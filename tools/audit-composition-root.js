// Read-only snapshot of the classic-script composition root. No application code is executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const playwrightRoot = path.dirname(require.resolve('playwright/package.json'));
// Development-only parser already installed with Playwright. Fail explicitly if its bundle changes.
const babel = require(path.join(playwrightRoot, 'lib/transform/babelBundle.js'));

// Follow lexical factory aliases, not function bodies or the runtime ownership of their results.
function constructionOrigins(root, statements, nodes, source) {
  function propertyPath(pattern, identifier) {
    if (pattern === identifier) return [];
    if (pattern.type !== 'ObjectPattern') return null;
    for (const property of pattern.properties) {
      if (property.type !== 'ObjectProperty' || property.computed || property.key.type !== 'Identifier') continue;
      const nested = propertyPath(property.value, identifier);
      if (nested) return [property.key.name, ...nested];
    }
    return null;
  }
  function trace(node, seen = new Set()) {
    if (!node) return null;
    if (node.type === 'Identifier') {
      if (seen.has(node.name)) return null;
      const binding = root.scope.getBinding(node.name);
      if (!binding || binding.scope !== root.scope || binding.kind !== 'const' || !binding.constant
        || !binding.path.isVariableDeclarator()) return null;
      const next = new Set(seen); next.add(node.name);
      const path = propertyPath(binding.path.node.id, binding.identifier);
      if (!path) return null;
      const origin = trace(binding.path.node.init, next);
      return origin && { namespace: origin.namespace, path: [...origin.path, ...path] };
    }
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
      if (node.object.type === 'Identifier' && node.object.name === 'window' && !root.scope.getBinding('window')) {
        return { namespace: 'window.' + node.property.name, path: [] };
      }
      const origin = trace(node.object, seen);
      return origin && { namespace: origin.namespace, path: [...origin.path, node.property.name] };
    }
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const origin = trace(node.callee, seen);
      if (!origin) return null;
      const path = [...origin.path], marker = node.type === 'NewExpression' ? ' new()' : '()';
      if (path.length) path[path.length - 1] += marker;
      else path.push(marker.trim());
      return { namespace: origin.namespace, path };
    }
    return null;
  }
  const result = [];
  statements.forEach((statement, index) => {
    if (statement.type !== 'VariableDeclaration') return;
    for (const declaration of statement.declarations) {
      if (!['CallExpression', 'NewExpression'].includes(declaration.init?.type)) continue;
      result.push({ statement: nodes[index].id, kind: declaration.init.type,
        callee: source.slice(declaration.init.callee.start, declaration.init.callee.end),
        origin: trace(declaration.init.callee) });
    }
  });
  return result;
}

function components(nodes, edges) {
  const graph = new Map(nodes.map(node => [node.id, []]));
  for (const edge of edges) graph.get(edge.from).push(edge.to);
  const index = new Map(), low = new Map(), pending = [], active = new Set(), result = [];
  function visit(id) {
    index.set(id, index.size); low.set(id, index.get(id)); pending.push(id); active.add(id);
    for (const next of graph.get(id)) {
      if (!index.has(next)) { visit(next); low.set(id, Math.min(low.get(id), low.get(next))); }
      else if (active.has(next)) low.set(id, Math.min(low.get(id), index.get(next)));
    }
    if (low.get(id) !== index.get(id)) return;
    const group = []; let item;
    do { item = pending.pop(); active.delete(item); group.push(item); } while (item !== id);
    if (group.length > 1 || graph.get(id).includes(id)) result.push(group.sort((a, b) => a - b));
  }
  for (const node of nodes) if (!index.has(node.id)) visit(node.id);
  return result.sort((a, b) => b.length - a.length || a[0] - b[0]);
}

function auditSource(input) {
  const source = input.replace(/\r\n/g, '\n');
  const ast = babel.babelParse(source, 'app.js', false);
  const roots = [];
  babel.traverse(ast, { FunctionExpression(p) {
    if (p.parentPath.isCallExpression() && p.parentPath.node.callee === p.node
      && p.parentPath.parentPath.isExpressionStatement() && p.parentPath.parentPath.parentPath.isProgram()) roots.push(p);
  } });
  if (roots.length !== 1) throw new Error('Expected one top-level classic-script function IIFE');
  const [root] = roots;
  const statements = root.node.body.body, lines = source.trimEnd().split('\n'), covered = new Map();
  const text = node => node ? source.slice(node.start, node.end) : null;
  const callName = node => node?.type === 'CallExpression' ? text(node.callee) : null;
  function category(node) {
    if (node.type === 'FunctionDeclaration') {
      if (['installTestHooks', 'createTestApi'].includes(node.id.name)) return 'testHooks';
      const body = node.body.body;
      return body.length === 1 && (body[0].type === 'ReturnStatement' && body[0].argument?.type === 'CallExpression'
        || body[0].type === 'ExpressionStatement' && body[0].expression.type === 'CallExpression') ? 'delegates' : 'otherFunctions';
    }
    if (node.type === 'VariableDeclaration') {
      if (node.kind === 'let') return 'lateReferences';
      if (node.declarations.some(d => ['CallExpression', 'NewExpression'].includes(d.init?.type))) return 'construction';
      if (node.declarations.every(d => ['StringLiteral', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral'].includes(d.init?.type))) return 'policyValues';
      return 'aliasesAndConfiguration';
    }
    if (node.type === 'ExpressionStatement') {
      const value = node.expression, callee = callName(value);
      if (value.type === 'AssignmentExpression') return 'lateAssignments';
      if (callee && /(?:^|\.)bind\w*$/.test(callee)) return 'bindingCalls';
      if (callee && /(?:^|\.)(?:start|initialize)\w*$/.test(callee)) return 'startupCalls';
      return 'otherCalls';
    }
    return 'otherStatements';
  }
  const nodes = statements.map((node, index) => {
    const nonblank = [];
    for (let line = node.loc.start.line; line <= node.loc.end.line; line++) {
      if (!lines[line - 1]?.trim()) continue;
      if (covered.has(line)) throw new Error('Overlapping root statements on line ' + line);
      covered.set(line, index + 1); nonblank.push(line);
    }
    return { id: index + 1, category: category(node), line: node.loc.start.line, endLine: node.loc.end.line,
      nonblank: nonblank.length, bindings: [], writes: node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression'
        && node.expression.left.type === 'Identifier' ? [node.expression.left.name] : [], call: node.type === 'VariableDeclaration' ? callName(node.declarations[0].init) :
        node.type === 'ExpressionStatement' ? callName(node.expression) : null };
  });
  const byNode = new Map(statements.map((node, i) => [node, nodes[i]]));
  function statement(p) {
    while (p && p.parentPath?.node !== root.node.body) p = p.parentPath;
    return p && byNode.get(p.node);
  }
  const bindings = new Map();
  for (const [name, binding] of Object.entries(root.scope.bindings)) {
    const owner = statement(binding.path);
    if (!owner) throw new Error('Unassigned root binding: ' + name);
    owner.bindings.push(name); bindings.set(name, owner.id);
  }
  const edges = new Map(), free = new Set();
  root.traverse({ ReferencedIdentifier(p) {
    const binding = p.scope.getBinding(p.node.name), from = statement(p);
    if (!binding) { free.add(p.node.name); return; }
    if (!from || binding.scope !== root.scope) return;
    let deferred = false;
    for (let ancestor = p.parentPath; ancestor && ancestor !== root; ancestor = ancestor.parentPath) {
      if (ancestor.isFunction()) deferred = true;
    }
    const to = bindings.get(p.node.name), phase = deferred ? 'deferredSyntax' : 'immediateSyntax';
    const key = `${from.id}/${to}/${phase}`;
    if (!edges.has(key)) edges.set(key, { from: from.id, to, phase, names: new Set(), uses: 0 });
    const edge = edges.get(key); edge.names.add(p.node.name); edge.uses++;
  } });
  const dependencies = [...edges.values()].map(edge => ({ ...edge, names: [...edge.names].sort() }))
    .sort((a, b) => a.from - b.from || a.to - b.to || a.phase.localeCompare(b.phase));
  const categories = {};
  for (const node of nodes) {
    categories[node.category] ||= { statements: 0, nonblank: 0 };
    categories[node.category].statements++; categories[node.category].nonblank += node.nonblank;
  }
  const nonblank = lines.filter(line => line.trim()).length;
  const outsideStatements = lines.flatMap((line, i) => line.trim() && !covered.has(i + 1) ? [i + 1] : []);
  if (covered.size + outsideStatements.length !== nonblank) throw new Error('Incomplete line coverage');
  return { source: { lines: lines.length, nonblank, sha256: crypto.createHash('sha256').update(source).digest('hex') },
    limits: 'Syntactic references only; writes are listed separately. Calls can execute callbacks immediately. SCCs are not module boundaries or a runtime-order proof.',
    summary: { statements: nodes.length, bindings: bindings.size, categories, outsideStatements, freeIdentifiers: [...free].sort(),
      cyclesIncludingDeferred: components(nodes, dependencies), cyclesImmediateSyntax: components(nodes, dependencies.filter(edge => edge.phase === 'immediateSyntax')) },
    statements: nodes, dependencies, constructionOrigins: constructionOrigins(root, statements, nodes, source) };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..'), file = path.join(root, 'app.js');
  const result = auditSource(fs.readFileSync(file, 'utf8'));
  result.source.path = 'app.js';
  result.source.gitBlob = execFileSync('git', ['hash-object', '--', 'app.js'], { cwd: root, encoding: 'utf8' }).trim();
  result.source.lastModifiedCommit = execFileSync('git', ['log', '-1', '--format=%H', '--', 'app.js'], { cwd: root, encoding: 'utf8' }).trim();
  result.parser = { package: 'playwright', version: require(path.join(playwrightRoot, 'package.json')).version, bundle: 'lib/transform/babelBundle.js' };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
module.exports = { auditSource };

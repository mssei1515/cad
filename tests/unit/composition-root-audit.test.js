const assert = require('node:assert/strict');
const test = require('node:test');
const { auditSource } = require('../../tools/audit-composition-root');

test('composition audit distinguishes deferred captures, immediate reads, shadowed locals and property keys', () => {
  const result = auditSource('(function(){ "use strict";\nconst source = external();\nconst callback = () => source;\nconst local = (() => { const source = 2; return source; })();\nconst direct = source.value;\n})();');
  const names = Object.fromEntries(result.statements.flatMap(node => node.bindings.map(name => [name, node.id])));
  const callback = result.dependencies.find(edge => edge.from === names.callback);
  assert.equal(callback.to, names.source); assert.equal(callback.phase, 'deferredSyntax');
  assert.equal(result.dependencies.some(edge => edge.from === names.local), false);
  assert.equal(result.dependencies.find(edge => edge.from === names.direct).phase, 'immediateSyntax');
  assert.deepEqual(result.summary.freeIdentifiers, ['external']);
});

test('composition audit reports late-reference cycles without equating callback cycles with immediate initialization cycles', () => {
  const result = auditSource('(function(){\nlet late = null;\nconst read = () => late;\nlate = { read };\n})();');
  assert.equal(result.summary.categories.lateReferences.statements, 1);
  assert.equal(result.summary.categories.lateAssignments.statements, 1);
  assert.deepEqual(result.statements.find(node => node.category === 'lateAssignments').writes, ['late']);
  // The assignment and reader both refer to the declaration; neither makes a declaration-to-assignment edge.
  assert.deepEqual(result.summary.cyclesImmediateSyntax, []);
  const cyclic = auditSource('(function(){\nconst a = () => b();\nconst b = () => a();\n})();');
  assert.deepEqual(cyclic.summary.cyclesIncludingDeferred, [[1, 2]]);
  assert.deepEqual(cyclic.summary.cyclesImmediateSyntax, []);
});

test('composition audit accounts for every nonblank line deterministically and rejects unsupported entrypoints', () => {
  const source = '/* entry */\n(function(){\n"use strict";\n\nfunction delegate(x){ return owner.run(x); }\nfunction fixed(){ return true; }\n})();\n';
  const result = auditSource(source);
  assert.deepEqual(result, auditSource(source.replace(/\n/g, '\r\n')));
  assert.equal(result.source.lines, 7); assert.equal(result.source.nonblank, 6);
  assert.equal(Object.values(result.summary.categories).reduce((n, group) => n + group.nonblank, 0) + result.summary.outsideStatements.length, 6);
  assert.equal(result.summary.categories.delegates.statements, 1); assert.equal(result.summary.categories.otherFunctions.statements, 1);
  assert.throws(() => auditSource('const app = {};'), /classic-script/);
  assert.throws(() => auditSource('(function(){})(); (function(){})();'), /one top-level/);
  assert.throws(() => auditSource('register(function(){});'), /classic-script/);
  assert.throws(() => auditSource('(function(){ const a=1; const b=2; })();'), /Overlapping root statements/);
});

test('construction origins follow staged factories and nested lexical aliases without executing application code', () => {
  const result = auditSource('(function(){\nconst prepared = window.Canvas.prepare();\nconst { create: build, nested: { factory } } = prepared;\nconst scene = build({ danger: () => { throw Error("must not run"); } });\nconst { createPreview } = scene;\nconst preview = createPreview();\nconst another = factory();\nconst item = new window.Model.Item();\n})();');
  const origins = Object.fromEntries(result.constructionOrigins.map(item => [item.callee, item]));
  assert.deepEqual(origins.build.origin, { namespace: 'window.Canvas', path: ['prepare()', 'create'] });
  assert.deepEqual(origins.createPreview.origin, { namespace: 'window.Canvas', path: ['prepare()', 'create()', 'createPreview'] });
  assert.deepEqual(origins.factory.origin, { namespace: 'window.Canvas', path: ['prepare()', 'nested', 'factory'] });
  assert.equal(origins['window.Model.Item'].kind, 'NewExpression');
  assert.deepEqual(origins['window.Model.Item'].origin, { namespace: 'window.Model', path: ['Item'] });
  assert.equal(result.statements.find(node => node.id === origins.build.statement).call, 'build');
});

test('construction origins leave reassigned, computed, defaulted, spread and cyclic aliases unresolved', () => {
  const result = auditSource('(function(){\nlet mutable = window.A.prepare();\nmutable = window.B.prepare();\nconst x = mutable.create();\nconst { factory = fallback, ...rest } = window.A;\nconst a = factory();\nconst b = rest.create();\nconst dynamic = window[key].create();\nconst { [key]: computed } = window.A;\nconst c = computed();\nconst left = right;\nconst right = left;\nconst d = left();\nconst unknown = external();\n})();');
  const origins = Object.fromEntries(result.constructionOrigins.map(item => [item.callee, item.origin]));
  assert.deepEqual(origins['window.A.prepare'], { namespace: 'window.A', path: ['prepare'] });
  for (const callee of ['mutable.create', 'factory', 'rest.create', 'window[key].create', 'computed', 'left', 'external']) {
    assert.equal(origins[callee], null, callee);
  }
});

test('construction origins respect a shadowed window and report each constructor in a shared declaration', () => {
  const shadowed = auditSource('(function(){\nconst window = external();\nconst fake = window.A.create();\n})();');
  assert.equal(shadowed.constructionOrigins.find(item => item.callee === 'window.A.create').origin, null);
  const result = auditSource('(function(){\nconst first = window.A.create(), second = window.B.create();\n})();');
  assert.equal(result.constructionOrigins.length, 2);
  assert.deepEqual(result.constructionOrigins.map(item => item.statement), [1, 1]);
  assert.deepEqual(result.constructionOrigins.map(item => item.origin.namespace), ['window.A', 'window.B']);
});

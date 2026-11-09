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

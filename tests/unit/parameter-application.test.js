const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/parameters/application.js'), 'utf8'), sandbox);
function fixture({ stored = false, failure = null } = {}) {
  const scope = { parameters: [{ name: 'old', expression: '1' }] };
  const driving = { parameterName: 'oldD', expression: '1' }, measured = { parameterName: 'oldR', expression: 'preserved' };
  const session = { namespace: scope, parameters: [{ name: ' width ', expression: '12' }], dimensions: [
    { constraint: driving, name: ' d1 ', expression: '24' }, { constraint: measured, name: ' d2 ', expression: 'ignored', readOnly: true },
  ] };
  const calls = [], marker = new Error('failure');
  const application = sandbox.window.ParameterApplication.create({
    namespace: { expressionFromUserInput: value => value, ensureParameterNamespace() { calls.push('normalize'); if (failure === 'normalize') throw marker; } },
    currentScope: () => stored ? {} : scope,
    capture() { calls.push('capture'); return { parameters: scope.parameters, driving: { ...driving }, measured: { ...measured } }; },
    restore(checkpoint) { calls.push('restore'); scope.parameters = checkpoint.parameters; Object.assign(driving, checkpoint.driving); Object.assign(measured, checkpoint.measured); },
    stabilize(target) { assert.equal(target, scope); calls.push('solve'); return {
      success: failure !== 'solve', dependent: { success: failure !== 'dependent' }, result: { errorNorm: failure === 'errorNorm' ? 2 : 0 },
    }; },
    propagate(target) { assert.equal(target, scope); calls.push('propagate'); if (failure === 'propagate') throw marker; },
    acceptError: 1, applicationText: (_ja, en) => en,
  });
  const apply = () => application.apply(session, () => { calls.push('commit'); if (failure === 'commit') throw marker; });
  return { application, apply, scope, driving, measured, calls };
}
test('parameter application preserves measured expression and commits only after solve', () => {
  const f = fixture(); assert.equal(f.apply().success, true);
  assert.equal(f.scope.parameters[0].name, 'width'); assert.equal(f.driving.expression, '24');
  assert.equal(f.measured.parameterName, 'd2'); assert.equal(f.measured.expression, 'preserved');
  assert.deepEqual(f.calls, ['capture', 'normalize', 'solve', 'commit']);
});
test('stored definition propagates before commit', () => {
  const f = fixture({ stored: true }); assert.equal(f.apply().success, true);
  assert.deepEqual(f.calls, ['capture', 'normalize', 'solve', 'propagate', 'commit']);
});
for (const failure of ['normalize', 'solve', 'dependent', 'errorNorm', 'propagate', 'commit']) {
  test(`parameter application restores original values after ${failure} failure`, () => {
    const f = fixture({ stored: true, failure }), original = f.scope.parameters;
    const outcome = f.apply(); assert.equal(outcome.success, false); assert.ok(outcome.error);
    assert.equal(f.scope.parameters, original); assert.equal(f.driving.parameterName, 'oldD');
    assert.equal(f.measured.parameterName, 'oldR'); assert.equal(f.calls.at(-1), 'restore');
    if (failure !== 'commit') assert.equal(f.calls.includes('commit'), false);
  });
}
test('closed dialog does not capture or apply', () => {
  const f = fixture(); assert.equal(f.application.apply(null, () => assert.fail()).success, false);
  assert.deepEqual(f.calls, []);
});

test('parameter dialog rejects direct edits to a locked sketch dimension before solving', () => {
  const f = fixture();
  f.driving.sketchId = 'S1';
  f.scope.sketches = [{ id: 'S1', locked: true }];
  const before = { ...f.driving };
  const outcome = f.apply();
  assert.equal(outcome.success, false);
  assert.match(outcome.error.message, /Unlock/);
  assert.deepEqual(f.driving, before);
  assert.equal(f.calls.includes('solve'), false);
});


test('symbol deletion guard follows current or explicit namespace and stays silent for permitted removal', () => {
  let current = { id: 'document' }, reads = 0;
  const explicit = { id: 'block' }, items = new Set([Object.freeze({ parameterName: 'd1' })]), calls = [];
  const api = sandbox.window.ParameterApplication.createDeletionGuard({
    currentNamespace: () => { reads++; return current; },
    symbolDeletionDependents: (actual, namespace) => { assert.equal(actual, items); calls.push(namespace); return { removedNames: ['d1'], dependents: [] }; },
    readLanguage: () => { throw Error('no notification'); }, setHint: () => assert.fail('no hint'), log: () => assert.fail('no log'),
  });
  assert.deepEqual(calls, []);
  assert.equal(api.guard(items), true);
  current = { id: 'other' };
  assert.equal(api.guard(items), true);
  assert.equal(api.guard(items, explicit), true);
  assert.equal(api.guard(items, undefined), true);
  assert.deepEqual(calls, [{ id: 'document' }, current, explicit, current]);
  assert.equal(reads, 3); assert.equal(items.size, 1);
});

test('symbol deletion guard reports dependency names in the live language, hint before log, and propagates query failure', () => {
  let language = 'ja', failure = null;
  const events = [], marker = new Error('query failed'), namespace = {};
  const removedNames = Object.freeze(['d1', 'note1']), dependents = Object.freeze(['width', 'd2']);
  const api = sandbox.window.ParameterApplication.createDeletionGuard({
    currentNamespace: () => namespace,
    symbolDeletionDependents: () => { if (failure) throw failure; return { removedNames, dependents }; },
    readLanguage: () => language,
    setHint: (message, kind) => events.push(['hint', message, kind]), log: message => events.push(['log', message]),
  });
  assert.equal(api.guard([]), false);
  const ja = 'd1、note1 は width、d2 から参照されているため削除できません';
  assert.deepEqual(events.splice(0), [['hint', ja, 'error'], ['log', ja]]);
  language = 'en'; assert.equal(api.guard([]), false);
  const en = 'Cannot delete d1, note1; referenced by width, d2';
  assert.deepEqual(events.splice(0), [['hint', en, 'error'], ['log', en]]);
  failure = marker; assert.throws(() => api.guard([]), error => error === marker);
  assert.deepEqual(events, []);
});

function editingFixture({ block = false, stored = false } = {}) {
  const events = [], result = { success: true, result: { errorNorm: 0 } };
  const scope = { parameters: [], sketches: [{ id: "ROOT", root: true }, { id: "S1" }, { id: "S2", locked: true }] };
  const state = { scope, editor: block ? {} : null, active: "S1", name: "before", captureError: null };
  const target = stored ? { parameters: [] } : scope;
  const localCheckpoint = Object.freeze({ marker: "same local values" });
  const documentCheckpoint = { marker: "document before apply" };
  const support = sandbox.window.ParameterApplication.createEditingSupport({
    namespace: { expressionFromUserInput: value => value, ensureParameterNamespace: value => events.push(["normalize", value]) },
    currentScope: () => scope, acceptError: 1, applicationText: (_ja, en) => en,
    readEditingScope: () => { events.push(["scope", state.scope]); return state.scope; },
    readBlockEditor: () => { events.push(["editor", state.editor]); return state.editor; },
    snapshotDocument: () => { events.push(["document snapshot"]); if (state.captureError) throw state.captureError; return JSON.stringify(documentCheckpoint); },
    snapshotValues: () => { events.push(["local snapshot"]); return localCheckpoint; },
    restoreValues: values => events.push(["restore local", values]),
    loadDocument: (data, options) => events.push(["restore document", data, options.documentNameFallback]),
    readDocumentName: () => state.name,
    activeSketchId: () => { events.push(["active", state.active]); return state.active; },
    isRootSketch: sketch => Boolean(sketch.root),
    stabilizeNamespace: (id, options) => { events.push(["stabilize active", id, Array.from(options.allSketches)]); return result; },
    stabilizeStoredNamespace: value => { events.push(["stabilize stored", value]); return result; },
  });
  const application = support.createApplication({ propagate: value => events.push(["propagate", value]) });
  return { state, scope, target, support, application, events, result, localCheckpoint, documentCheckpoint,
    session: { namespace: target, parameters: [{ name: " width ", expression: "12" }], dimensions: [] } };
}

test("parameter editing support stays lazy and reads current scope and active Sketch for each document stabilization", () => {
  const f = editingFixture(); assert.deepEqual(f.events, []);
  assert.equal(f.support.stabilizeDocument(), f.result);
  assert.deepEqual(f.events.splice(0), [["active", "S1"], ["scope", f.scope], ["stabilize active", "S1", ["S1", "S2"]]]);
  f.state.scope = { sketches: [{ id: "NEW" }, { id: "ROOT", root: true }] }; f.state.active = "NEW";
  assert.equal(f.support.stabilizeDocument(), f.result);
  assert.deepEqual(f.events, [["active", "NEW"], ["scope", f.state.scope], ["stabilize active", "NEW", ["NEW"]]]);
});

for (const block of [false, true]) {
  test("parameter editing recovers " + (block ? "local Block values" : "Document") + " after the commit callback fails", () => {
    const f = editingFixture({ block }), marker = new Error("commit failed");
    const outcome = f.application.apply(f.session, () => { f.events.push(["commit"]); f.state.name = "at failure"; throw marker; });
    assert.equal(outcome.success, false); assert.equal(outcome.error, marker);
    assert.deepEqual(f.events.slice(0, 3).map(event => event[0]), block ? ["editor", "editor", "local snapshot"] : ["editor", "document snapshot", "editor"]);
    assert.deepEqual(f.events.slice(-3).map(event => event[0]), ["commit", "editor", block ? "restore local" : "restore document"]);
    const restored = f.events.at(-1);
    if (block) { assert.equal(restored[1], f.localCheckpoint); assert.equal(f.events.some(event => event[0] === "document snapshot"), false); }
    else { assert.equal(JSON.stringify(restored[1]), JSON.stringify(f.documentCheckpoint)); assert.equal(restored[2], "at failure"); assert.equal(f.events.some(event => event[0] === "local snapshot"), false); }
  });
}

test("stored parameter namespace uses stored stabilization and propagation before commit", () => {
  const f = editingFixture({ block: true, stored: true });
  const outcome = f.application.apply(f.session, () => f.events.push(["commit"]));
  assert.equal(outcome.success, true);
  assert.deepEqual(f.events.slice(-3), [["stabilize stored", f.target], ["propagate", f.target], ["commit"]]);
  assert.equal(f.events.some(event => event[0] === "stabilize active"), false);
});

test("parameter editing capture errors escape before draft mutation and recovery", () => {
  const f = editingFixture(), marker = new Error("capture failed"), original = f.scope.parameters; f.state.captureError = marker;
  assert.throws(() => f.application.apply(f.session, () => assert.fail("no commit")), error => error === marker);
  assert.equal(f.scope.parameters, original); assert.deepEqual(f.events.map(event => event[0]), ["editor", "document snapshot"]);
});

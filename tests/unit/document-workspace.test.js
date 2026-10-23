const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture() {
  const state = { ready: false, hatch: 12, reads: 0, failure: null };
  const model = w.DocumentWorkspace.create({ applicationText: (_ja, en) => { assert.equal(state.ready, true); return en; },
    constraintGraphNodes: () => { assert.equal(state.ready, true); return []; },
    nextHatchIndex: () => { assert.equal(state.ready, true); state.reads++; if (state.failure) throw state.failure; return state.hatch; } });
  assert.equal(state.reads, 0); state.ready = true;
  return { model, state };
}

test('Document composition preserves initial data and returns the actual independent state, workspace and ID owners', () => {
  const { model } = fixture(), other = fixture().model;
  assert.ok(Object.isFrozen(model)); assert.equal(Object.isFrozen(model.document), false);
  assert.equal(model.workspace.document, model.document); assert.equal(model.workspace.current(), model.document);
  assert.equal(model.workspace.snapshotSource(), model.document);
  assert.equal(JSON.stringify(model.document), JSON.stringify(w.DocumentState.create()));
  assert.equal(model.geometryIds.allocate('point'), 'P1'); assert.equal(model.documentIds.allocate('sketch'), 'S2');
  assert.equal(other.geometryIds.allocate('point'), 'P1'); assert.equal(other.documentIds.allocate('sketch'), 'S2');
  assert.notEqual(model.document.points, other.document.points); assert.notEqual(model.document.sketches, other.document.sketches);
});

test('Sketch and Parameter queries follow the same workspace through local editing and restoration', () => {
  const { model } = fixture(), root = model.document;
  root.parameters.push({ name: 'width', expression: '10' });
  assert.equal(model.parameters.evaluateDimensionExpressionDraft(null, '"width"'), 10);
  assert.equal(model.sketches.activeSketchId(), 'S1');
  const host = model.workspace.capture(), local = w.DocumentState.create();
  local.sketches[1].id = 'S5'; local.activeSketchId = 'S5'; local.parameters.push({ name: 'width', expression: '20' });
  model.workspace.activate(local);
  assert.equal(model.sketches.activeSketchId(), 'S5'); assert.equal(model.sketches.sketchById('S5'), local.sketches[1]);
  assert.equal(model.parameters.evaluateDimensionExpressionDraft(null, '"width"'), 20);
  const source = model.workspace.snapshotSource(); assert.equal(source.parameters, local.parameters); assert.equal(source.blockDefinitions, root.blockDefinitions);
  model.workspace.restore(host);
  assert.equal(model.workspace.current(), root); assert.equal(model.sketches.activeSketchId(), 'S1');
  assert.equal(model.parameters.evaluateDimensionExpressionDraft(null, '"width"'), 10);
});

test('reservation shares the returned counters and keeps the delayed Hatch read and partial failure order', () => {
  const { model, state } = fixture(), source = { points: [{ id: 'P20' }], hatches: [{ id: 'H8' }],
    referenceImages: [{ id: 'IMG3' }], sketches: [{ id: 'S7' }], annotations: [{ id: 'AN4' }] };
  model.reservation.geometry(source); assert.equal(state.reads, 0);
  assert.equal(model.geometryIds.peek('point'), 21); assert.equal(model.documentIds.peek('hatch'), 9);
  assert.equal(model.documentIds.peek('referenceImage'), 4); assert.equal(model.documentIds.peek('sketch'), 2);
  const failure = new Error('Hatch scope not ready'); state.failure = failure;
  assert.throws(() => model.reservation.scope(source), error => error === failure);
  assert.equal(state.reads, 1); assert.equal(model.geometryIds.peek('point'), 21); assert.equal(model.documentIds.peek('hatch'), 9);
  assert.equal(model.documentIds.peek('sketch'), 2); assert.equal(model.documentIds.peek('annotation'), 1);
  state.failure = null; model.reservation.scope(source);
  assert.equal(state.reads, 2); assert.equal(model.documentIds.peek('hatch'), 12);
  assert.equal(model.documentIds.peek('sketch'), 8); assert.equal(model.documentIds.peek('annotation'), 5);
});

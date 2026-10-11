const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const W = sandbox.window, plain = value => JSON.parse(JSON.stringify(value));
function fixture(rejectConstraint = false) {
  const model = Object.fromEntries(['points', 'lines', 'circles', 'arcs', 'splines', 'blockInstances', 'geometryInstances', 'annotations', 'hatches', 'referenceImages', 'constraints'].map(key => [key, []]));
  Object.assign(model, { parameters: [], nextDimensionParameterIndex: 4, nextHatchIndex: 1 });
  const ids = W.GeometryIds.create(), counters = { annotationSeq: 1, hatchSeq: 1, referenceImageSeq: 1 }, events = [];
  const transfer = W.ClipboardTransfer.create({ geometryInstanceBundle: () => ({ valid: true, points: [], lines: [], circles: [], arcs: [], splines: [] }) });
  const geometry = W.ClipboardGeometry.create({ geometryIds: ids, ensureLineMinimumLength: () => {}, normalizeArcSweep: () => {} });
  const parameters = W.ParameterNamespace.create({ currentParameterNamespace: () => model, applicationText: (_ja, en) => en });
  const graph = W.ClipboardGraph.create({ geometry: { ...geometry, appendDerived(...args) {
    assert.equal(args[5].has('oldH'), true); events.push('derived'); return geometry.appendDerived(...args);
  } }, transfer: { ...transfer, reconnectDerivedInstances(...args) {
    assert.equal(model.annotations.length, 1); assert.equal(model.hatches.length, 1); assert.equal(model.referenceImages.length, 1);
    events.push('reconnect'); return transfer.reconnectDerivedInstances(...args);
  } }, parameters,
    elementIds: { annotation: () => 'AN' + counters.annotationSeq++, hatch: () => 'H' + counters.hatchSeq++,
      image: () => 'IMG' + counters.referenceImageSeq++, nextHatchIndex: () => counters.hatchSeq },
    invalidateProjection: () => events.push('invalidate'), applicationText: (_ja, en) => en,
    deserializeConstraint: (data, points) => {
      events.push('constraint'); if (rejectConstraint) return null;
      return Object.assign(new W.GeometrySolver.DistanceConstraint(points.get(data.p1), points.get(data.p2), data.target), data, { p1: points.get(data.p1), p2: points.get(data.p2) });
    },
  });
  const face = W.HatchRegionEngine.findFaceAtPoint([{ kind: 'circle', id: 'oldC', center: { x: 0, y: 0 }, radius: 10 }], { x: 0, y: 0 });
  const payload = { parameterNamespaceKey: 'document', cut: false,
    points: [{ id: 'p', x: 0, y: 0 }, { id: 'q', x: 3, y: 4 }], lines: [{ id: 'oldL', p1: 'p', p2: 'q' }],
    circles: [{ id: 'oldC', center: 'p', radius: 10 }], arcs: [], splines: [], blockInstances: [],
    annotations: [{ id: 'oldA', type: 'text', x: 1, y: 2, parameterEnabled: true, parameterName: 'a', expression: '"d1" + 1' }],
    hatches: [{ id: 'oldH', sketchId: 'S1', seed: { x: 0, y: 0 }, boundaryLoops: plain(face.boundaryLoops), appearance: {} }],
    referenceImages: [{ id: 'oldI', x: 2, y: 3, scale: 2, dataUrl: 'data:image/png;base64,AA==' }],
    constraints: [{ type: 'distance', p1: 'p', p2: 'q', target: 5, parameterName: 'd1', expression: '5' }],
  };
  const checkpoint = W.ClipboardPasteCheckpoint.create({ geometryIds: ids, captureSequences: () => ({ ...counters }),
    restoreSequences: values => { for (const key of Object.keys(counters)) counters[key] = values[key]; } });
  return { model, payload, ids, counters, events, checkpoint,
    append: () => graph.append(model, payload, { sketchId: 'S2', dx: 10, dy: -4, namespace: model, namespaceKey: 'document' }) };
}

test('clipboard graph builds mixed model elements with shared references before symbols and constraints', () => {
  const f = fixture(), before = JSON.stringify(f.payload), pasted = f.append(), { model } = f;
  assert.deepEqual(f.events, ['derived', 'invalidate', 'invalidate', 'reconnect', 'constraint']);
  assert.equal(model.lines[0].p1, model.points[0]); assert.equal(model.circles[0].center, model.points[0]);
  assert.equal(model.constraints[0].p1, model.points[0]); assert.equal(model.constraints[0].p2, model.points[1]);
  assert.equal(pasted.maps.lineById.get(model.lines[0].id), model.lines[0]);
  for (const key of ['annotations', 'hatches', 'referenceImages']) assert.equal(pasted[key][0], model[key][0]);
  assert.equal(model.annotations[0].parameterName, 'd5'); assert.equal(model.annotations[0].expression, '"d4" + 1');
  assert.equal(model.constraints[0].parameterName, 'd4'); assert.equal(model.constraints[0].sketchId, 'S2');
  assert.equal(model.constraints[0].reference, false); assert.equal(model.constraints[0].referenceSketchId, null);
  assert.equal(model.nextHatchIndex, 2); assert.equal(model.referenceImages[0].x, 12); assert.equal(JSON.stringify(f.payload), before);
});

test('constraint failure propagates to enclosing checkpoint without hiding partial model construction', () => {
  const f = fixture(true), checkpoint = f.checkpoint.capture(f.model);
  assert.throws(f.append, /distance/); assert.equal(f.model.annotations.length, 1); assert.equal(f.model.constraints.length, 0);
  checkpoint.rollback();
  for (const key of ['points', 'lines', 'circles', 'annotations', 'hatches', 'referenceImages', 'geometryInstances']) assert.equal(f.model[key].length, 0);
  assert.equal(f.ids.peek('point'), 1); assert.equal(f.model.nextDimensionParameterIndex, 4); assert.equal(f.model.nextHatchIndex, 1);
  assert.deepEqual(f.counters, { annotationSeq: 1, hatchSeq: 1, referenceImageSeq: 1 });
});

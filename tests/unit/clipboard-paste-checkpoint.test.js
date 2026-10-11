const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/editing/geometry_ids.js', 'src/editing/clipboard_paste_checkpoint.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const keys = ['points', 'lines', 'circles', 'arcs', 'splines', 'constraints', 'blockInstances', 'geometryInstances', 'annotations', 'hatches', 'referenceImages'];
const scope = () => Object.assign(Object.fromEntries(keys.map(key => [key, [{ id: key, x: 1 }]])), { nextHatchIndex: 7, nextDimensionParameterIndex: 8 });

test('paste rollback preserves existing objects and array identity, restores all append kinds and counters', () => {
  const model = scope(), ids = sandbox.window.GeometryIds.create(); ids.allocate('point');
  let counters = { annotationSeq: 10, hatchSeq: 20, referenceImageSeq: 30, blockInstanceSeq: 40,
    sketchProjectionInstanceSeq: 50, mirrorInstanceSeq: 60, patternInstanceSeq: 70, freeInstanceSeq: 80 };
  const before = { ...counters }, arrays = keys.map(key => model[key]), existing = keys.map(key => model[key][0]);
  const api = sandbox.window.ClipboardPasteCheckpoint.create({ geometryIds: ids,
    captureSequences: () => ({ ...counters }), restoreSequences: values => {
      assert.equal(model.points.length, 1); assert.equal(ids.peek('point'), 2);
      assert.equal(model.nextHatchIndex, 99); // Sequence restoration precedes model counters.
      for (const key of Object.keys(counters)) counters[key] = values[key];
    } });
  const checkpoint = api.capture(model);
  keys.forEach(key => model[key].push({ id: 'pasted' }));
  Object.keys(counters).forEach(key => counters[key]++); ids.allocate('point'); ids.allocate('spline');
  model.nextHatchIndex = 99; model.nextDimensionParameterIndex = 100;
  checkpoint.rollback();
  keys.forEach((key, i) => { assert.equal(model[key], arrays[i]); assert.equal(model[key].length, 1); assert.equal(model[key][0], existing[i]); });
  assert.deepEqual(counters, before); assert.equal(ids.peek('spline'), 1);
  assert.equal(model.nextHatchIndex, 7); assert.equal(model.nextDimensionParameterIndex, 8);
});

test('checkpoint belongs to the captured scope and retains the limited existing rollback boundary', () => {
  const first = scope(), second = scope(), ids = sandbox.window.GeometryIds.create();
  const api = sandbox.window.ClipboardPasteCheckpoint.create({ geometryIds: ids, captureSequences: () => ({}), restoreSequences: () => {} });
  const checkpoint = api.capture(first);
  first.points[0].x = 5; first.points.push({ id: 'new' }); second.points.push({ id: 'other' });
  const clipboard = { pasteCount: 4 }; clipboard.pasteCount++;
  checkpoint.rollback();
  assert.equal(first.points.length, 1); assert.equal(first.points[0].x, 5);
  assert.equal(second.points.length, 2); assert.equal(clipboard.pasteCount, 5);
});

test('each paste captures counters afresh and successful append stays intact without rollback', () => {
  const model = scope(), ids = sandbox.window.GeometryIds.create(); let annotationSeq = 1;
  const api = sandbox.window.ClipboardPasteCheckpoint.create({ geometryIds: ids,
    captureSequences: () => ({ annotationSeq }), restoreSequences: values => { annotationSeq = values.annotationSeq; } });
  api.capture(model); model.annotations.push({ id: 'first' }); annotationSeq++;
  const second = api.capture(model); model.annotations.push({ id: 'failed' }); annotationSeq++;
  second.rollback(); assert.equal(model.annotations.length, 2); assert.equal(model.annotations[1].id, 'first'); assert.equal(annotationSeq, 2);
});

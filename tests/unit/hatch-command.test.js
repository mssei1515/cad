const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { Appearance: { DEFAULT_HATCH_APPEARANCE: { spacing: 5 } } } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/hatch_command.js'), 'utf8'), sandbox);
function fixture() {
  const scope = { hatches: [] }, history = [], calls = [], selected = [];
  let mode = 'select', sketch = 'S1', seq = 1, pointerPreview = null, allowed = true;
  let result = { ok: true, boundaryLoops: [{ role: 'outer', spans: [] }], resolved: {} };
  const command = sandbox.window.HatchCommand.create({ currentScope: () => scope,
    hatchGeometryQuery: { hatchFaceAt: pointer => typeof result === 'function' ? result(pointer) : result, forget: h => calls.push(['forget', h]) },
    getMode: () => mode, setMode: value => { mode = value; }, lastPointer: () => ({ x: 2, y: 3 }),
    getPointerPreview: () => pointerPreview, setPointerPreview: value => { pointerPreview = value; },
    activeSketchId: () => sketch, setActiveSketch: value => { sketch = value; }, canCreateInActiveSketch: () => allowed,
    rejectRootSketchCreation: () => calls.push('reject'), nextHatchId: () => `H${seq++}`, hatchSequence: () => seq,
    cancelConstraintTargetCommand: () => calls.push('cancel-target'), cancelPendingCommand: () => command.reset(),
    clearSnap: () => calls.push('clear-snap'), clearSelection: () => { selected.length = 0; }, canvasSelection: { set: (_type, items) => selected.push(...items) },
    updateToolbar: () => {}, updateStatusUI: () => {}, updateUI: () => {}, setHint: (...args) => calls.push(args),
    draw: () => {}, recordHistory: label => history.push(label), applicationText: (_ja, en) => en, hatchRegionErrorText: value => value.code,
  });
  return { command, scope, history, calls, selected, get mode() { return mode; }, get sketch() { return sketch; }, get pointer() { return pointerPreview; },
    allow: value => { allowed = value; }, result: value => { result = value; } };
}

test('creation keeps continuous mode and commits one history entry per hatch', () => {
  const f = fixture(); f.command.startHatchCreation();
  assert.equal(f.mode, 'hatch'); assert.equal(f.command.preview.result.ok, true);
  const copy = f.command.preview; copy.pointer.x = 999; assert.equal(f.command.preview.pointer.x, 2);
  assert.equal(f.command.commitHatchAt({ x: 4, y: 5 }), true);
  assert.equal(f.command.finish(), true);
  assert.equal(f.command.commitHatchAt({ x: 6, y: 7 }), true);
  assert.equal(f.command.finish(), true);
  assert.deepEqual(f.scope.hatches.map(h => h.id), ['H1', 'H2']);
  assert.equal(f.scope.nextHatchIndex, 3); assert.equal(f.mode, 'hatch'); assert.equal(f.history.length, 2);
  assert.equal(f.selected[0], f.scope.hatches[1]);
  assert.notEqual(f.scope.hatches[0].appearance, f.scope.hatches[1].appearance);
});

test('repair requires explicit drawing destination, preserves identity and returns to selection after commit', () => {
  const f = fixture(), hatch = { id: 'H9', sketchId: 'S2', appearance: { spacing: 8 } };
  f.scope.hatches.push(hatch);
  assert.equal(f.command.startHatchBoundaryRepair(hatch), false); assert.equal(f.sketch, 'S1');
  hatch.sketchId = 'S1';
  assert.equal(f.command.startHatchBoundaryRepair(hatch), true);
  assert.equal(f.command.commitHatchAt({ x: 10, y: 12 }), true);
  assert.equal(f.scope.hatches.length, 1); assert.equal(hatch.seed, undefined);
  assert.equal(f.command.finish(), true); assert.equal(f.selected[0], hatch);
  assert.equal(hatch.seed.x, 10); assert.equal(hatch.appearance.spacing, 8);
  assert.equal(f.mode, 'select'); assert.equal(f.command.preview, null); assert.equal(f.pointer, null);
  assert.deepEqual(f.history, ['塗りつぶし境界再指定']);
  assert.ok(f.calls.some(c => Array.isArray(c) && c[0] === 'forget' && c[1] === hatch));
});

test('invalid regions preserve repair session without changing geometry or recording history', () => {
  const f = fixture(), hatch = { id: 'H1', sketchId: 'S1', seed: { x: 1, y: 2 } };
  f.scope.hatches.push(hatch); f.command.startHatchBoundaryRepair(hatch);
  f.result({ ok: false, code: 'open-boundary' });
  assert.equal(f.command.commitHatchAt({ x: 3, y: 4 }), false);
  assert.deepEqual(hatch.seed, { x: 1, y: 2 }); assert.equal(f.mode, 'hatch-repair'); assert.equal(f.history.length, 0);
  assert.equal(f.command.preview.result.code, 'open-boundary');
});

test('reset discards preview and repair target without editing the model or recording history', () => {
  const f = fixture(), hatch = { id: 'H0', sketchId: 'S1' }; f.scope.hatches.push(hatch);
  f.command.startHatchBoundaryRepair(hatch); f.command.reset();
  assert.equal(f.command.preview, null); assert.equal(f.history.length, 0);
  f.command.startHatchCreation(); f.command.commitHatchAt({ x: 0, y: 0 }); f.command.finish();
  assert.equal(f.scope.hatches.length, 2); assert.equal(hatch.seed, undefined);
});

test('root creation and foreign or projected repair targets are rejected', () => {
  const f = fixture(); f.allow(false); f.command.startHatchCreation();
  assert.equal(f.mode, 'select'); assert.ok(f.calls.includes('reject'));
  assert.equal(f.command.startHatchBoundaryRepair(null), false);
  assert.equal(f.command.startHatchBoundaryRepair({ id: 'foreign' }), false);
  const hatch = { id: 'projected', blockProjection: true }; f.scope.hatches.push(hatch);
  assert.equal(f.command.startHatchBoundaryRepair(hatch), false);
  assert.equal(f.history.length, 0);
});


test('multiple regions toggle without model writes and commit as one history entry', () => {
  const f = fixture();
  f.result(point => ({ ok: true, boundaryLoops: [{ role: 'outer', spans: [{ source: { kind: 'circle', path: [point.x < 5 ? 'C1' : 'C2'] } }] }], resolved: { area: 100 } }));
  f.command.startHatchCreation();
  assert.equal(f.command.finish(), false);
  f.command.commitHatchAt({ x: 1, y: 1 }); f.command.commitHatchAt({ x: 10, y: 1 });
  assert.equal(f.command.regions.length, 2); assert.equal(f.scope.hatches.length, 0); assert.equal(f.history.length, 0);
  f.command.commitHatchAt({ x: 2, y: 2 }); assert.equal(f.command.regions.length, 1);
  f.command.commitHatchAt({ x: 1, y: 1 });
  f.command.select(0); assert.equal(f.command.regions[0].selected, true);
  assert.equal(f.command.finish(), true);
  assert.equal(f.scope.hatches.length, 1); assert.equal(f.scope.hatches[0].boundaryLoops.length, 2); assert.equal(f.history.length, 1);
  assert.equal(f.command.regions.length, 0);
});

test('list removal and cancellation preserve the original repair boundary', () => {
  const f = fixture(), hatch = { id: 'H1', sketchId: 'S1', seed: { x: 1, y: 2 }, boundaryLoops: ['original'] };
  f.scope.hatches.push(hatch); f.command.startHatchBoundaryRepair(hatch);
  f.command.commitHatchAt({ x: 3, y: 4 }); f.command.remove(0);
  assert.equal(f.command.finish(), false); assert.deepEqual(hatch.boundaryLoops, ['original']);
  f.command.commitHatchAt({ x: 3, y: 4 }); f.command.reset();
  assert.deepEqual(hatch.boundaryLoops, ['original']); assert.equal(f.history.length, 0);
});

test('changed geometry refuses atomic completion', () => {
  const f = fixture(); f.command.startHatchCreation(); f.command.commitHatchAt({ x: 3, y: 4 });
  f.result({ ok: false, code: 'open-boundary' });
  assert.equal(f.command.finish(), false); assert.equal(f.scope.hatches.length, 0); assert.equal(f.history.length, 0);
});

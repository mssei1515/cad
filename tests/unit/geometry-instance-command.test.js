const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/geometry_instance_command.js'), 'utf8'), sandbox);
class Line { constructor(id, sketchId = 'S1') { this.id = id; this.sketchId = sketchId; } }
function fixture() {
  let mode = 'select', ids = 0;
  const source = new Line('L1'), model = { geometryInstances: [] }, calls = [], answers = [];
  const command = sandbox.window.GeometryInstanceCommand.create({
    cancelConstraintTargetCommand() {}, cancelPendingCommand() {}, canCreateInActiveSketch: () => true, rejectRootSketchCreation() {},
    selectedItemsForGeometryInstance: () => [source], geometryRefForItem: item => ({ kind: 'line', id: item.id }), clearSelection() {},
    normalizeGeometryInstance: raw => ({ rotation: 0, ...raw }), previewFreeId: () => 'FI1', nextInstanceId: type => { ids++; return `${type}-${ids}`; },
    activeSketchId: () => 'S1', getMode: () => mode, setMode: value => { mode = value; }, updateToolbar() {}, updateUI() {},
    applicationText: (_ja, en) => en, setHint: () => calls.push('hint'), draw() {}, currentScope: () => model,
    canvasSelection: { set: (_field, items) => calls.push(items[0]) }, recordHistory: () => calls.push('history'),
    Line, lineHasDirection: () => true, elementSketchId: item => item.sketchId, prompt: () => answers.shift(),
    resolveGeometryRef: () => source, createGeometryInstanceBundle: instance => ({ instance }),
  });
  return { command, source, model, calls, answers, mode: () => mode, ids: () => ids };
}

test('free placement allocates only on commit and previews use the same pending instance', () => {
  const f = fixture(); f.command.start('free'); const pending = f.command.pending;
  assert.equal(f.mode(), 'free-instance-origin'); assert.equal(pending.id, 'FI1'); assert.equal(f.ids(), 0);
  f.command.placeFree({ x: 10, y: 20 }); assert.equal(f.mode(), 'free-instance-place');
  assert.equal(pending.origin.x, 10); assert.equal(f.command.preview({ x: 40, y: 50 }).instance, pending);
  assert.equal(pending.x, 40); assert.equal(f.ids(), 0); assert.equal(f.model.geometryInstances.length, 0);
  f.command.placeFree({ x: 60, y: 70 });
  assert.equal(f.model.geometryInstances[0], pending); assert.equal(pending.x, 60); assert.equal(f.ids(), 1);
  assert.equal(f.command.pending, null); assert.equal(f.mode(), 'select'); assert.equal(f.calls.filter(v => v === 'history').length, 1);
});

test('canceled pattern dialogs retain sources without allocating IDs and a later confirmation succeeds', () => {
  const f = fixture(); f.command.start('pattern'); f.answers.push(null);
  assert.equal(f.command.commitReference(f.source), false); assert.equal(f.ids(), 0); assert.equal(f.mode(), 'pattern-direction');
  f.answers.push('5', '3'); assert.equal(f.command.commitReference(f.source), true);
  const instance = f.model.geometryInstances[0];
  assert.equal(instance.sources[0].id, 'L1'); assert.equal(instance.direction.id, 'L1'); assert.equal(instance.spacing, 5); assert.equal(instance.copies, 3);
  assert.equal(f.ids(), 1); assert.equal(f.calls.filter(v => v === 'history').length, 1);
});

test('cross-sketch mirror axes are rejected and reset cancels a free placement without creating document data', () => {
  const f = fixture(); f.command.start('mirror'); assert.equal(f.command.commitReference(new Line('L2', 'S2')), false);
  assert.equal(f.model.geometryInstances.length, 0); assert.equal(f.ids(), 0);
  f.command.start('free'); f.command.placeFree({ x: 1, y: 2 }); f.command.reset();
  assert.equal(f.command.preview({ x: 3, y: 4 }), null); f.command.placeFree({ x: 3, y: 4 });
  assert.equal(f.model.geometryInstances.length, 0); assert.equal(f.ids(), 0); assert.equal(f.calls.includes('history'), false);
});

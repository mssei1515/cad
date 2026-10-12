const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/geometry_instance_command.js'), 'utf8'), sandbox);
class Line { constructor(id, sketchId = 'S1') { this.id = id; this.sketchId = sketchId; } }
function fixture(preselect = true) {
  let mode = 'select', ids = 0;
  const source = new Line('L1'), model = { geometryInstances: [] }, calls = [], view = { draws: 0 };
  const items = new Map([[source.id, source]]);
  const command = sandbox.window.GeometryInstanceCommand.create({
    cancelConstraintTargetCommand() {}, cancelPendingCommand() {}, canCreateInActiveSketch: () => true, rejectRootSketchCreation() {},
    selectedItemsForGeometryInstance: () => preselect ? [source] : [], geometryRefForItem: item => { if (!item) return null; items.set(item.id, item); return { kind: 'line', id: item.id }; },
    geometryRefsEqual: (a,b) => a?.id === b?.id, isVisibleSketchElement: item => !item.hidden, clearSelection() {},
    normalizeGeometryInstance: raw => ({ rotation: 0, ...raw }), previewFreeId: () => 'FI1', nextInstanceId: type => { ids++; return `${type}-${ids}`; },
    activeSketchId: () => 'S1', getMode: () => mode, setMode: value => { mode = value; }, updateToolbar() {}, updateUI() {},
    applicationText: (_ja, en) => en, setHint: () => calls.push('hint'), draw: () => { view.draws++; }, currentScope: () => model,
    canvasSelection: { set: (_field, items) => calls.push(items[0]) }, recordHistory: () => calls.push('history'),
    Line, lineHasDirection: () => true, elementSketchId: item => item.sketchId,
    resolveGeometryRef: ref => items.get(ref.id), createGeometryInstanceBundle: instance => ({ instance }),
  });
  return { command, source, model, calls, view, mode: () => mode, ids: () => ids };
}

test('rectangle source additions update the view once and retain duplicate sources', () => {
  const f = fixture(); f.command.start('mirror'); f.view.draws = 0;
  f.command.addSources([new Line('L2'), new Line('L3'), new Line('L2')]);
  assert.equal(f.command.sources.length, 3); assert.equal(f.view.draws, 1);
  f.command.addSources([new Line('L2')]); assert.equal(f.view.draws, 1);
});

test('free placement allocates only on commit and previews use the same pending instance', () => {
  const f = fixture(); f.command.start('free'); const pending = f.command.pending;
  assert.equal(f.mode(), 'free-instance-origin'); assert.equal(pending.id, 'FI1'); assert.equal(f.ids(), 0);
  f.command.placeFree({ x: 10, y: 20 }); assert.equal(f.mode(), 'free-instance-place');
  f.command.selectInput('destination');
  assert.equal(pending.origin.x, 10); assert.equal(f.command.preview({ x: 40, y: 50 }).instance, pending);
  assert.equal(pending.x, 40); assert.equal(f.ids(), 0); assert.equal(f.model.geometryInstances.length, 0);
  f.command.placeFree({ x: 60, y: 70 });
  assert.equal(f.model.geometryInstances.length, 0); f.command.finish();
  assert.equal(f.model.geometryInstances[0], pending); assert.equal(pending.x, 60); assert.equal(f.ids(), 1);
  assert.equal(f.command.pending, null); assert.equal(f.mode(), 'select'); assert.equal(f.calls.filter(v => v === 'history').length, 1);
});

test('pattern reference and settings remain drafts until explicit completion', () => {
  const f = fixture(); f.command.start('pattern');
  assert.equal(f.command.finish(), false);
  assert.equal(f.command.selectReference(f.source), true); assert.equal(f.ids(), 0); assert.equal(f.mode(), 'pattern-direction');
  f.command.changeSetting('spacing', '5'); f.command.changeSetting('copies', '3'); f.command.changeSetting('reversed', true);
  assert.equal(f.command.finish(), true);
  const instance = f.model.geometryInstances[0];
  assert.equal(instance.sources[0].id, 'L1'); assert.equal(instance.direction.id, 'L1'); assert.equal(instance.spacing, 5); assert.equal(instance.copies, 3);
  assert.equal(instance.reversed, true);
  assert.equal(f.ids(), 1); assert.equal(f.calls.filter(v => v === 'history').length, 1);
});

test('cross-sketch mirror axes are rejected and reset cancels a free placement without creating document data', () => {
  const f = fixture(); f.command.start('mirror'); assert.equal(f.command.selectReference(new Line('L2', 'S2')), false);
  assert.equal(f.model.geometryInstances.length, 0); assert.equal(f.ids(), 0);
  f.command.start('free'); f.command.placeFree({ x: 1, y: 2 }); f.command.reset();
  assert.equal(f.command.preview({ x: 3, y: 4 }), null); f.command.placeFree({ x: 3, y: 4 });
  assert.equal(f.model.geometryInstances.length, 0); assert.equal(f.ids(), 0); assert.equal(f.calls.includes('history'), false);
});

test('mirror axis changes and cancel do not create geometry or history before finish', () => {
  const f = fixture(); f.command.start('mirror'); f.command.selectReference(f.source);
  const axis = new Line('L2'); f.command.selectReference(axis);
  assert.equal(f.model.geometryInstances.length, 0); assert.equal(f.ids(), 0);
  assert.equal(f.command.finish(), true); assert.equal(f.model.geometryInstances[0].axis.id, 'L2');
  assert.equal(f.command.reference, null); assert.equal(f.mode(), 'select');
  f.command.start('mirror'); f.command.selectReference(axis); f.command.reset();
  assert.equal(f.command.finish(), false); assert.equal(f.ids(), 1);
});

test('pattern rejects invalid spacing and fractional or excessive copies without allocation', () => {
  const f = fixture(); f.command.start('pattern'); f.command.selectReference(f.source);
  for (const [key, value] of [['spacing', ''], ['spacing', 'Infinity'], ['spacing', '-2'], ['copies', '2.5'], ['copies', '1001']]) {
    f.command.changeSetting('spacing', '10'); f.command.changeSetting('copies', '2');
    assert.equal(f.command.changeSetting(key, value), false); assert.equal(f.command.finish(), false);
    assert.equal(f.ids(), 0); assert.equal(f.model.geometryInstances.length, 0);
  }
});

test('empty start retains independently editable reference and sources', () => {
  for (const type of ['mirror','pattern']) {
    const f=fixture(false); f.command.start(type);
    assert.equal(f.command.canFinish(),false);
    f.command.selectInput('reference'); f.command.selectReference(f.source);
    f.command.selectInput('sources'); f.command.toggleSource(f.source);
    assert.equal(f.command.canFinish(),true);
    f.command.removeInput('sources',0); assert.equal(f.command.canFinish(),false);
    assert.equal(f.command.reference,f.source);
    f.command.toggleSource(f.source); assert.equal(f.command.finish(),true);
  }
});
test('preview cannot overwrite a destination picked before the anchor', () => {
  const f=fixture(false); f.command.start('free');
  f.command.selectInput('destination'); f.command.placeFree({x:60,y:70});
  f.command.selectInput('sources'); f.command.toggleSource(f.source);
  f.command.selectInput('origin'); f.command.placeFree({x:5,y:10});
  f.command.selectInput('destination'); f.command.preview({x:900,y:900});
  assert.equal(f.command.destination.x,60); f.command.finish();
  assert.equal(f.model.geometryInstances[0].x,60);
});

test('cancel discards free placement without allocating an instance or history', () => {
  const f = fixture(); f.command.start('free'); f.command.placeFree({ x: 2, y: 3 });
  f.command.selectInput('destination'); f.command.placeFree({ x: 8, y: 9 }); f.calls.length = 0;
  assert.equal(f.command.cancel(), true); assert.equal(f.mode(), 'select');
  assert.equal(f.command.pending, null); assert.equal(f.command.origin, null); assert.equal(f.command.destination, null);
  assert.equal(f.command.sources.length, 0); assert.equal(f.model.geometryInstances.length, 0); assert.equal(f.ids(), 0);
  assert.deepEqual(f.calls, []);
  assert.equal(f.command.cancel(), false); assert.deepEqual(f.calls, []);
});
test('cancel clears mirror and pattern operands while retaining existing settings semantics', () => {
  for (const type of ['mirror', 'pattern']) {
    const f = fixture(); f.command.start(type); f.command.selectReference(f.source);
    if (type === 'pattern') f.command.changeSetting('copies', 5);
    f.calls.length = 0; assert.equal(f.command.cancel(), true);
    assert.equal(f.mode(), 'select'); assert.equal(f.command.sources.length, 0); assert.equal(f.command.reference, null);
    assert.equal(f.model.geometryInstances.length, 0); assert.equal(f.ids(), 0); assert.deepEqual(f.calls, ['hint']);
    if (type === 'pattern') assert.equal(f.command.settings.copies, 5);
  }
});

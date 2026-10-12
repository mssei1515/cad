const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {}, structuredClone }; vm.createContext(sandbox);
for (const file of ['src/geometry/synchronized_instance.js', 'src/commands/geometry_instance_command.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const M = sandbox.window.SynchronizedInstance;
class Line { constructor(id, sketchId = 'S1') { this.id = id; this.sketchId = sketchId; this.p1 = { id: id + 'a', x: 0, y: 0, sketchId }; this.p2 = { id: id + 'b', x: 10, y: 0, sketchId }; } }
function fixture(preselect = true) {
  let mode = 'select', ids = 0, histories = 0, draws = 0;
  const source = new Line('L1'), model = { geometryInstances: [] }, items = new Map();
  const ref = item => { if (!item) return null; items.set(item.id, item); if (item.p1) { items.set(item.p1.id, item.p1); items.set(item.p2.id, item.p2); } return { kind: item.p1 ? 'line' : 'point', path: [item.id] }; };
  ref(source);
  const command = sandbox.window.GeometryInstanceCommand.create({ cancelConstraintTargetCommand() {}, cancelPendingCommand() {}, canCreateInActiveSketch: () => true,
    selectedItemsForGeometryInstance: () => preselect ? [source] : [], geometryRefForItem: ref, geometryRefsEqual: M.sameRef, elementSketchId: item => item.sketchId,
    isVisibleSketchElement: item => !item.hidden, clearSelection() {}, previewFreeId: () => 'FI1', nextInstanceId: () => 'FI' + (++ids), activeSketchId: () => 'S1',
    getMode: () => mode, setMode: value => mode = value, updateToolbar() {}, updateUI() {}, draw: () => draws++, applicationText: s => s, setHint() {},
    currentScope: () => model, canvasSelection: { set() {} }, recordHistory: () => histories++, resolveGeometryRef: r => r && items.get(r.path.join('@')),
    createGeometryInstanceBundle: instance => ({ instance }) });
  const anchor = () => { command.selectInput('origin'); command.placeFree({ x: 5, y: 0 }, { data: { line: source, midpoint: true } }); };
  return { command, source, model, anchor, ids: () => ids, histories: () => histories, draws: () => draws, mode: () => mode };
}
test('rectangle additions are unique and refresh once', () => {
  const f = fixture(); f.command.start(); const before = f.draws(); f.command.addSources([new Line('L2'), new Line('L3'), new Line('L2')]);
  assert.equal(f.command.sources.length, 3); assert.equal(f.draws() - before, 1);
});
test('destination and sources may precede anchor and preview cannot overwrite the picked destination', () => {
  const f = fixture(false); f.command.start(); f.command.selectInput('destination'); f.command.placeFree({ x: 60, y: 70 });
  f.command.selectInput('sources'); f.command.toggleSource(f.source); f.anchor(); f.command.selectInput('destination'); f.command.preview({ x: 900, y: 900 });
  assert.equal(f.command.destination.x, 60); assert.equal(f.command.finish(), true); assert.equal(f.model.geometryInstances[0].x, 60); assert.equal(f.histories(), 1);
});
test('invalid total count and interval input cannot change draft settings', () => {
  const f = fixture(); f.command.start(); f.anchor(); f.command.changeSetting('placement', 'circular');
  for (const value of ['', '1', '1002', '2.5', 'Infinity']) assert.equal(f.command.changeSetting('count', value), false);
  for (const value of ['', '0', '360', '-360', 'Infinity']) assert.equal(f.command.changeSetting('angleStep', value), false);
  assert.equal(f.command.pending.count, 2); assert.equal(f.ids(), 0); assert.equal(f.histories(), 0);
});
test('blank anchor clicks and sources outside the owning sketch are refused', () => {
  const f = fixture(); f.command.start(); assert.equal(f.command.placeFree({ x: 0, y: 0 }, null), false);
  assert.equal(f.command.toggleSource(new Line('other', 'S2')), false); assert.equal(f.command.canFinish(), false);
});
test('numeric offsets are signed and may be zero; they provide a destination', () => {
  const f = fixture(); f.command.start(); f.anchor(); f.command.changeSetting('offsetX', '0'); f.command.changeSetting('offsetY', '-15');
  assert.equal(f.command.canFinish(), true); assert.equal(f.command.finish(), true); assert.equal(f.model.geometryInstances[0].x, 5); assert.equal(f.model.geometryInstances[0].y, -15);
});
test('cancel discards all creation and edit input without allocation or history', () => {
  const f = fixture(); f.command.start(); f.anchor(); f.command.changeSetting('placement', 'circular'); assert.equal(f.command.cancel(), true);
  assert.equal(f.command.pending, null); assert.equal(f.ids(), 0); assert.equal(f.histories(), 0); assert.equal(f.model.geometryInstances.length, 0);
});
test('existing fixed anchor may be retained in settings edit but must be replaced in anchor edit', () => {
  const f = fixture(), instance = M.normalize({ type: 'free', id: 'FI9', sources: [{ kind: 'line', path: ['L1'] }], sketchId: 'S1', x: 10, y: 20, origin: { x: 3, y: 4 } });
  f.command.startEdit(instance, 'destination'); assert.equal(f.command.canFinish(), true); f.command.cancel();
  f.command.startEdit(instance, 'origin'); assert.equal(f.command.canFinish(), false); f.anchor(); assert.equal(f.command.canFinish(), true); f.command.finish(); assert.equal(instance.anchor.relation.kind, 'lineMidpoint');
});

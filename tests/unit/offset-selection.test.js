const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/offset_selection.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
}
const g = sandbox.window.GeometrySolver;
function fixture() {
  const model = { lines: [], arcs: [], constraints: [] }; let notifications = 0;
  const selection = sandbox.window.OffsetSelection.create({ ...g, getModel: () => model,
    activeSketchId: () => 'S1', elementSketchId: item => item.sketchId || 'S1',
    constraintSketchId: item => item.sketchId || 'S1', onSelectionChanged: () => notifications++ });
  let seq = 0;
  const point = () => new g.Point(`P${++seq}`, 0, 0);
  const line = (a = point(), b = point()) => { const item = new g.Line(`L${++seq}`, a, b); model.lines.push(item); return item; };
  const arc = () => { const item = new g.Arc(`A${++seq}`, point(), 5, 0, Math.PI); model.arcs.push(item); return item; };
  return { model, selection, point, line, arc, get notifications() { return notifications; } };
}
test('orients appended and prepended lines, closes a chain and rejects further additions atomically', () => {
  const f = fixture(), a = f.point(), b = f.point(), c = f.point(), d = f.point();
  const first = f.line(a, b), reversed = f.line(c, b), prepend = f.line(d, a), close = f.line(c, d);
  assert.equal(f.selection.add(first).ok, true);
  assert.equal(f.selection.add(reversed).ok, true);
  assert.equal(f.selection.add(prepend).ok, true);
  assert.equal(f.selection.source, prepend);
  assert.deepEqual(Array.from(f.selection.entries, e => e.reversed), [false, false, true]);
  assert.equal(f.selection.add(close).closed, true);
  assert.equal(f.selection.isClosed(), true);
  assert.equal(f.selection.add(first).code, 'already-selected');
  assert.equal(f.selection.add(f.line()).code, 'closed-chain');
  assert.equal(f.notifications, 4);
  f.selection.commitSelection(); assert.equal(f.selection.committed, true);
  const previous = f.selection.entries; f.selection.reset();
  assert.equal(f.selection.entries.length, 0); assert.equal(previous.length, 4);
  assert.equal(f.selection.source, null); assert.equal(f.selection.committed, false);
  assert.equal(f.notifications, 4);
});
test('uses enabled same-sketch constraints rather than coincident coordinates to connect line and arc endpoints', () => {
  const f = fixture(), line = f.line(), arc = f.arc(), next = f.arc();
  f.selection.add(line);
  assert.equal(f.selection.add(arc).code, 'not-connected');
  const join = new g.ArcEndpointCoincidentConstraint(arc, 'end', line.p2);
  f.model.constraints.push(join); join.enabled = false;
  assert.equal(f.selection.add(arc).code, 'not-connected');
  join.enabled = true; join.sketchId = 'S2';
  assert.equal(f.selection.add(arc).code, 'not-connected');
  join.sketchId = 'S1'; assert.equal(f.selection.add(arc).ok, true);
  assert.equal(f.selection.entries[1].reversed, true);
  f.model.constraints.push(new g.ArcEndpointArcEndpointCoincidentConstraint(arc, 'start', next, 'start'));
  assert.equal(f.selection.add(next).ok, true);
  const foreign = f.line(); foreign.sketchId = 'S2';
  assert.equal(f.selection.add(foreign).code, 'unsupported');
  foreign.sketchId = 'S1'; foreign.blockProjection = {};
  assert.equal(f.selection.add(foreign).code, 'unsupported');
});
test('offset-chain constraints connect distinct endpoint objects and instances keep independent selection', () => {
  const f = fixture(), first = f.line(), second = f.line();
  f.model.constraints.push(new g.OffsetChainConstraint([], [first, second], 5));
  f.selection.add(first); assert.equal(f.selection.add(second).ok, true);
  const copy = f.selection.entries; copy.length = 0;
  assert.equal(f.selection.entries.length, 2);
  const other = fixture(); other.selection.selectSource(other.arc());
  assert.equal(other.selection.entries.length, 0); assert.equal(f.selection.source, first);
});

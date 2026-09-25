const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
class HorizontalConstraint { constructor(line) { this.line = line; } }
class VerticalConstraint { constructor(line) { this.line = line; } }
const sandbox = { window: { GeometrySolver: { HorizontalConstraint, VerticalConstraint } } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/rectangle_command.js'), 'utf8'), sandbox);
function fixture() {
  const points = [], lines = [], constraints = [], snaps = [], events = [];
  const addPoint = (x, y) => { const point = { x, y }; points.push(point); return point; };
  const command = sandbox.window.RectangleCommand.create({ addPoint, endpointAt: addPoint,
    addLine: (p1, p2) => { const line = { p1, p2 }; lines.push(line); return line; },
    addPointSnapConstraints: (point, snap) => snaps.push({ point, snap }), pushModelConstraint: c => constraints.push(c),
    minLineLength: 12, samePosition: (a, b) => a.x === b.x && a.y === b.y,
    selection: { set: () => {} }, setPointerPreview: value => events.push(['preview', value]),
    clearSnap: () => events.push(['snap']), clearSelection: () => events.push(['selection']),
    setHint: () => {}, updateUI: () => {}, draw: () => {},
    solveAndRefresh: () => { events.push(['solve']); return { success: true }; }, log: () => events.push(['log']),
  });
  return { command, points, lines, constraints, snaps, events };
}
test('two clicks share four corners and apply alternating horizontal and vertical constraints', () => {
  const f = fixture(); const snap = { x: 40, y: 30 };
  f.command.click({ x: 0, y: 0 }, null); const start = f.command.startPoint;
  f.command.click(snap, snap);
  assert.equal(f.points.length, 4); assert.equal(f.lines.length, 4);
  assert.equal(f.lines[0].p1, start); assert.equal(f.lines[3].p2, start);
  assert.equal(f.lines[1].p1, f.lines[0].p2);
  assert.ok(f.constraints[0] instanceof HorizontalConstraint);
  assert.ok(f.constraints[1] instanceof VerticalConstraint);
  assert.ok(f.constraints[2] instanceof HorizontalConstraint);
  assert.ok(f.constraints[3] instanceof VerticalConstraint);
  assert.equal(f.snaps[1].snap, snap); assert.equal(f.command.startPoint, null);
  assert.deepEqual(f.events.slice(-5).map(e => e[0]), ['preview', 'snap', 'selection', 'solve', 'log']);
});
test('minimum side adjustment preserves sign and drops an incompatible diagonal snap', () => {
  const f = fixture(); f.command.click({ x: 10, y: 10 }, null);
  const snap = { x: 9, y: 10 }; f.command.click(snap, snap);
  assert.equal(f.points[2].x, -2); assert.equal(f.points[2].y, 22);
  assert.equal(f.snaps[1].snap, null);
});
test('reset discards only command state and preserves the existing starting point', () => {
  const f = fixture(); f.command.click({ x: 0, y: 0 }, null);
  f.command.reset(); assert.equal(f.command.startPoint, null);
  assert.equal(f.points.length, 1); assert.equal(f.lines.length, 0);
  f.command.click({ x: 50, y: 50 }, null); assert.equal(f.lines.length, 0);
});

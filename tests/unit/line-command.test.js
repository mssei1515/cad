const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
class HorizontalConstraint { constructor(line) { this.line = line; } }
class VerticalConstraint { constructor(line) { this.line = line; } }
const sandbox = { window: { GeometrySolver: { hypot2: (x, y) => Math.sqrt(x * x + y * y), HorizontalConstraint, VerticalConstraint } } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/line_command.js'), 'utf8'), sandbox);
function fixture(fail = false) {
  const points = [], lines = [], constraints = [], calls = [], snaps = [];
  const addPoint = (x, y) => { const p = { x, y }; points.push(p); return p; };
  const command = sandbox.window.LineCommand.create({ minLineLength: 12, addPoint,
    endpointAt: (x, y) => { calls.push('endpoint'); return addPoint(x, y); },
    snapForDrawing: point => ({ point, snap: point }), samePosition: (a, b) => a.x === b.x && a.y === b.y,
    addLine: (p1, p2) => { if (fail) return null; const l = { id: 'L1', p1, p2 }; lines.push(l); return l; },
    addPointSnapConstraints: (_point, snap) => snaps.push(snap), pushModelConstraint: c => constraints.push(c),
    transientAuthoring: { beginTransientLineStartRollback: () => calls.push('start'), beginTransientLineCompletionRollback: () => calls.push('completion'),
      clearTransientLineStartRollback: () => calls.push('clearStart'), markCompletedLine: () => calls.push('mark') },
    selection: { set: () => {} }, setPointerPreview: () => {}, clearSelection: () => calls.push('clearSelection'),
    setHint: () => {}, updateUI: () => {}, draw: () => {}, solveAndRefresh: () => { calls.push('solve'); return { success: true }; }, log: () => {},
  });
  return { command, points, lines, constraints, calls, snaps };
}
test('continuous line uses completion rollback before geometry and advances its start', () => {
  const f = fixture(); f.command.click({ x: 0, y: 0 }); const start = f.command.startPoint;
  f.command.click({ x: 40, y: 20 });
  assert.equal(f.lines[0].p1, start); assert.equal(f.command.startPoint, f.lines[0].p2);
  assert.deepEqual(f.calls, ['start', 'endpoint', 'completion', 'endpoint', 'mark', 'clearStart', 'clearSelection', 'solve']);
  f.command.reset(); assert.equal(f.command.startPoint, null); assert.equal(f.lines.length, 1);
});
test('orthogonal click and preview use the dominant axis and add its orientation constraint', () => {
  const f = fixture(); f.command.click({ x: 0, y: 0 });
  const preview = f.command.previewPoint({ x: 20, y: 40 }, true);
  assert.equal(preview.x, 0); assert.equal(preview.y, 40);
  f.command.click({ x: 20, y: 40 }, true);
  assert.equal(f.lines[0].p2.x, 0); assert.ok(f.constraints[0] instanceof VerticalConstraint);
});
test('zero distance creates a fresh minimum-length endpoint and invalidates its snap', () => {
  const f = fixture(); f.command.click({ x: 0, y: 0 }); f.command.click({ x: 0, y: 0 });
  assert.equal(f.lines[0].p2.x, 12); assert.equal(f.lines[0].p2.y, 0);
  assert.equal(f.snaps[1], null); assert.equal(f.calls.filter(c => c === 'endpoint').length, 1);
});
test('failed line creation retains the start and does not solve or mark completion', () => {
  const f = fixture(true); f.command.click({ x: 0, y: 0 }); const start = f.command.startPoint;
  f.command.click({ x: 40, y: 0 });
  assert.equal(f.command.startPoint, start); assert.equal(f.calls.includes('solve'), false); assert.equal(f.calls.includes('mark'), false);
});

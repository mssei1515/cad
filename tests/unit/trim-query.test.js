const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/trim_query.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
const { Point, Line, Circle, Arc } = sandbox.window.GeometrySolver;
const point = (x, y) => new Point('', x, y);
const line = (x1, y1, x2, y2, construction = false) => new Line('', point(x1, y1), point(x2, y2), construction);
const circle = (x, y, radius) => new Circle('', point(x, y), radius);
function fixture(minLength = 1) {
  const state = { scope: { lines: [], circles: [], arcs: [] } };
  const query = sandbox.window.TrimQuery.create({ currentScope: () => state.scope, isActiveSketchElement: item => item.active !== false, minLineLength: minLength, minArcLength: minLength });
  return { state, query };
}
const values = boundaries => Array.from(boundaries, b => b.t);
test('line trim boundaries preserve source identity and ignore construction and inactive boundaries', () => {
  const { state, query } = fixture(); const target = line(0, 0, 20, 0), left = line(5, -5, 5, 5), right = line(15, -5, 15, 5), inactive = line(12, -5, 12, 5); inactive.active = false;
  state.scope.lines = [target, left, right, line(5, -10, 5, 10), line(10, -5, 10, 5, true), inactive];
  const before = JSON.stringify(state.scope); const boundaries = query.lineTrimBoundaries(target);
  assert.deepEqual(values(boundaries), [0, 0.25, 0.75, 1]); assert.equal(boundaries[1].source.line, left); assert.equal(boundaries[2].source.line, right); assert.equal(boundaries[0].point, target.p1);
  const preview = query.trimPreviewForLine(target, { x: 10, y: 2 }); assert.equal(preview.item, target); assert.equal(preview.interval.left.t, 0.25); assert.equal(preview.interval.right.t, 0.75);
  assert.equal(JSON.stringify(state.scope), before);
});
test('signed arc trim uses sweep parameters and rejects a pointer outside the sweep', () => {
  const { state, query } = fixture(); const target = new Arc('', point(0, 0), 10, Math.PI / 2, -Math.PI / 2);
  const boundary = line(-20, 0, 20, 0); state.scope.arcs = [target]; state.scope.lines = [boundary];
  const boundaries = query.arcTrimBoundaries(target); assert.deepEqual(values(boundaries), [0, 0.5, 1]); assert.equal(boundaries[1].source.line, boundary);
  const preview = query.trimPreviewForArc(target, { x: 7, y: 7 }); assert.equal(preview.interval.left.t, 0); assert.equal(preview.interval.right.t, 0.5);
  assert.equal(query.trimPreviewForArc(target, { x: -10, y: 0 }), null);
});
test('circle trim carries a wrapping interval across zero and keeps original boundary sources', () => {
  const { state, query } = fixture(); const target = circle(0, 0, 10), boundary = line(-20, 0, 20, 0); state.scope.circles = [target]; state.scope.lines = [boundary];
  const preview = query.trimPreviewForCircle(target, { x: 0, y: -10 });
  assert.equal(preview.item, target); assert.deepEqual(values(preview.boundaries), [0, 0.5]); assert.equal(preview.interval.left.angle, Math.PI); assert.equal(preview.interval.right.angle, 2 * Math.PI);
  assert.equal(preview.interval.left.source.line, boundary); assert.equal(preview.interval.right.source.line, boundary);
});
test('circle tangent, no-intersection and minimum interval cases retain distinct results', () => {
  const { state, query } = fixture(100); const target = circle(0, 0, 10); state.scope.circles = [target];
  assert.equal(query.trimPreviewForCircle(target, { x: 10, y: 0 }).deleteWhole, true);
  state.scope.lines = [line(-20, 10, 20, 10)]; assert.equal(query.circleTrimBoundaries(target).length, 1); assert.equal(query.trimPreviewForCircle(target, { x: 0, y: 10 }), null);
  state.scope.lines = [line(-20, 0, 20, 0)]; assert.equal(query.circleTrimBoundaries(target).length, 2); assert.equal(query.trimPreviewForCircle(target, { x: 0, y: 10 }), null);
});
test('candidate search accepts caller tolerance and falls through an unusable nearer interval', () => {
  const { state, query } = fixture(100); state.scope.lines = [line(-10, 0, 10, 0), line(-5, -1, -5, 1), line(5, -1, 5, 1)];
  const target = circle(0, 52, 50); state.scope.circles = [target];
  assert.equal(query.computeTrimPreview({ x: 0, y: 0 }, 1), null);
  const preview = query.computeTrimPreview({ x: 0, y: 0 }, 3); assert.equal(preview.item, target); assert.equal(preview.deleteWhole, true);
});
test('active scope is resolved per query and construction geometry remains a trim target', () => {
  const { state, query } = fixture(); const old = line(0, 0, 20, 0); state.scope.lines = [old];
  const target = line(0, 10, 20, 10, true); state.scope = { lines: [target], circles: [], arcs: [] };
  assert.equal(query.computeTrimPreview({ x: 10, y: 0 }, 1), null); assert.equal(query.computeTrimPreview({ x: 10, y: 10 }, 1).item, target);
  target.active = false; assert.equal(query.computeTrimPreview({ x: 10, y: 10 }, 1), null);
});
test('circular intersections keep source kinds and filter the boundary arc sweep', () => {
  const { state, query } = fixture(); const target = circle(0, 0, 10), other = circle(10, 0, 10);
  state.scope.circles = [target, other];
  let boundaries = query.circleTrimBoundaries(target); assert.equal(boundaries.length, 2);
  assert.ok(Math.abs(boundaries[0].t - 1 / 6) < 1e-12); assert.ok(Math.abs(boundaries[1].t - 5 / 6) < 1e-12);
  assert.equal(boundaries[0].source.primitive, other);
  const arc = new Arc('', point(10, 0), 10, 0, Math.PI); state.scope.circles = [target]; state.scope.arcs = [arc];
  boundaries = query.circleTrimBoundaries(target); assert.equal(boundaries.length, 1); assert.ok(Math.abs(boundaries[0].t - 1 / 6) < 1e-12); assert.equal(boundaries[0].source.arc, arc);
});

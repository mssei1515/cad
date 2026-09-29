const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['geometry/geometry_kernel.js', 'geometry/spline_geometry.js', 'solver/constraint_solver.js', 'editing/first_dimension_scaling.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
}
const { Point, Line, Circle, Arc, LineFixedConstraint } = sandbox.window.GeometrySolver;
function fixture() {
  const p = new Point('P1', 0, 0), q = new Point('P2', 10, 0), foreign = new Point('P3', 100, 100);
  p.sketchId = q.sketchId = 'S1'; foreign.sketchId = 'S2';
  const line = new Line('L1', p, q), circle = new Circle('C1', p, 2), arc = new Arc('A1', q, 3, 0, 1);
  circle.sketchId = arc.sketchId = 'S1';
  let scope = { points: [p, q, foreign], circles: [circle], arcs: [arc], constraints: [] };
  const api = sandbox.window.FirstDimensionScaling.create({ currentScope: () => scope, activeSketchId: () => 'S1',
    constraintSketchId: c => c.sketchId, elementSketchId: item => item.sketchId,
    sketchGeometryBounds: () => ({ x1: 0, y1: 0, x2: 10, y2: 0 }), minLength: 0.01,
  });
  return { api, p, q, foreign, line, circle, arc, get scope() { return scope; }, setScope: value => { scope = value; } };
}

test('initial scaling updates only target sketch geometry and dimension placement', () => {
  const f = fixture();
  const dimension = { x: 10, y: 5, labelX: 8, offsetU: 3, angleRadius: 7, unrelated: 9 };
  assert.equal(f.api.scaleSketchForFirstDimension('S1', { kind: 'line-length', line: f.line }, 20, dimension), true);
  assert.equal(f.p.x, -5); assert.equal(f.q.x, 15); assert.equal(f.foreign.x, 100);
  assert.equal(f.circle.radiusValue, 4); assert.equal(f.arc.radiusValue, 6);
  assert.deepEqual(dimension, { x: 15, y: 10, labelX: 11, offsetU: 6, angleRadius: 14, unrelated: 9 });
});

test('fixed and reference geometry prevent scaling even when a constraint is disabled', () => {
  for (const reason of ['point', 'line', 'reference']) {
    const f = fixture();
    if (reason === 'point') f.p.fixed = true;
    else {
      const c = reason === 'line' ? new LineFixedConstraint(f.line) : { reference: true };
      c.sketchId = 'S1'; c.enabled = false; f.scope.constraints.push(c);
    }
    assert.equal(f.api.scaleSketchForFirstDimension('S1', { kind: 'line-length', line: f.line }, 20, {}), false);
    assert.equal(f.p.x, 0); assert.equal(f.q.x, 10);
  }
});

test('invalid, angular and unchanged target values leave the model untouched', () => {
  const f = fixture();
  for (const value of [0, -1, Infinity, NaN, 10]) assert.equal(f.api.scaleSketchForFirstDimension('S1', { kind: 'line-length', line: f.line }, value, {}), false);
  assert.equal(f.api.scaleSketchForFirstDimension('S1', { kind: 'angle', value: 45 }, 90, {}), false);
  assert.equal(f.p.x, 0); assert.equal(f.q.x, 10);
});

test('axis measurement and scope replacement use current values without retaining prior geometry', () => {
  const f = fixture();
  const p = new Point('P4', 0, 0), q = new Point('P5', 3, 4);
  p.sketchId = q.sketchId = 'S1';
  f.setScope({ points: [p, q], circles: [], arcs: [], constraints: [] });
  assert.equal(f.api.scaleSketchForFirstDimension('S1', { kind: 'point-point', p1: p, p2: q, dimensionAxis: 'x' }, 6, null), true);
  assert.equal(q.x - p.x, 6); assert.equal(q.y - p.y, 8);
  assert.equal(f.q.x, 10);
});

const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['geometry/geometry_kernel.js', 'geometry/spline_geometry.js', 'solver/constraint_solver.js', 'constraints/line_collapse_query.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
const solver = sandbox.window.GeometrySolver;
function fixture(before = 10000, after = 1) {
  const a = { x: 0, y: 0 }, b = { x: after, y: 0 };
  const line = { p1: a, p2: b, length: () => b.x }; const nodes = [a, b], component = { nodes };
  const calls = []; const constraint = Object.create(solver.HorizontalConstraint.prototype);
  const query = sandbox.window.LineCollapseQuery.create({ minLineLength: 1,
    constraintGraphNodes: c => { assert.equal(c, constraint); return nodes; },
    connectedComponentFromSeeds: value => { assert.equal(value, nodes); return component; },
    localSolveLines: (value, sketch) => { assert.equal(value, component); calls.push(sketch); return [line]; } });
  return { query, constraint, line, calls, snapshot: { points: [{ point: a, x: 0, y: 0 }, { point: b, x: before, y: 0 }] } };
}
test('collapse query uses snapshot identity and requested solve scope without changing geometry', () => {
  const f = fixture(); const result = f.query.find(f.constraint, f.snapshot, 'S2');
  assert.equal(result.line, f.line); assert.equal(result.before, 10000); assert.equal(result.after, 1);
  assert.deepEqual(f.calls, ['S2']); assert.equal(f.line.p2.x, 1); assert.equal(f.snapshot.points[1].x, 10000);
});
test('absolute and relative collapse thresholds must both hold, and initially short lines are exempt', () => {
  for (const [before, after, collapsed] of [[100, 0, false], [101, .001, true], [10000, 1, true], [10000, 1.001, false], [100000, 5, true], [100000, 5.001, false]]) {
    const f = fixture(before, after); assert.equal(Boolean(f.query.find(f.constraint, f.snapshot, 'S1')), collapsed);
  }
});
test('unrelated constraints skip graph traversal and missing snapshot points use current length', () => {
  const f = fixture(); assert.equal(f.query.find({}, f.snapshot, 'S1'), null); assert.deepEqual(f.calls, []);
  assert.equal(f.query.find(f.constraint, null, 'S1'), null);
  assert.equal(f.query.find(f.constraint, { points: [] }, 'S1'), null);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/solver/solve_scope_query.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const { Point, Line } = sandbox.window.GeometrySolver;
function fixture() {
  const state = { scope: { points: [], lines: [], circles: [], arcs: [], splines: [], geometryInstances: [], blockInstances: [], constraints: [] }, sketch: 'S1' };
  const geometryReads = { resolveGeometryRef: ref => ref.target };
  for (const name of ['Points', 'Lines', 'Circles', 'Arcs', 'Splines']) geometryReads['allGeometry' + name] = () => state.scope[name.toLowerCase()];
  const query = sandbox.window.SolveScopeQuery.create({ currentScope: () => state.scope, geometryReads,
    activeSketchId: () => state.sketch, elementSketchId: item => item.sketchId || 'S1',
    constraintSketchId: item => item.sketchId || 'S1', isVisibleSketchElement: item => !item.hidden,
    constraintIsOperational: item => item.enabled !== false, constraintGraphNodes: item => item.nodes,
    geometryInstanceDependencyRefs: item => item.refs || [], minimumLength: 0.01 });
  return { state, query };
}
test('fixed shared points stop connectivity while retaining their identity in the local component', () => {
  const { state, query } = fixture();
  const a = new Point('a', 0, 0), fixed = new Point('fixed', 1, 0, true), b = new Point('b', 2, 0);
  const left = new Line('left', a, fixed), right = new Line('right', fixed, b);
  Object.assign(state.scope, { points: [a, fixed, b], lines: [left, right] });
  const local = query.localSolveContextFromSeeds([left, left, null]);
  assert.deepEqual(new Set(local.component), new Set([left, a, fixed]));
  assert.deepEqual(Array.from(local.lines), [left]);
  assert.deepEqual(Array.from(local.variables, v => v.object), [a, a]);
  assert.deepEqual(new Set(query.connectedComponentFromSeeds([fixed])), new Set([fixed]));
});
test('projection owners, spline points, dependency refs and operational constraints connect by identity', () => {
  const { state, query } = fixture();
  const owner = { id: 'owner', refs: [] }, derived = { id: 'derived', refs: [{ target: owner }] };
  const a = new Point('a', 0, 0), b = new Point('b', 2, 0), c = new Point('c', 3, 0), excluded = new Point('excluded', 4, 0);
  a.blockInstance = owner; b.derivedInstance = derived;
  const spline = { fitPoints: [b, c] };
  Object.assign(state.scope, { points: [a, b, c, excluded], splines: [spline], geometryInstances: [derived],
    constraints: [{ nodes: [c, excluded], enabled: false }] });
  assert.deepEqual(new Set(query.connectedComponentFromSeeds([a])), new Set([a, owner, derived, b, spline, c]));
  state.scope.constraints[0].enabled = true;
  assert.equal(query.connectedComponentFromSeeds([a]).has(excluded), true);
});
test('local and whole-sketch inputs preserve visibility differences, variable order and placement locks', () => {
  const { state, query } = fixture();
  const p = new Point('p', 0, 0); p.hidden = true;
  const fixed = new Point('fixed', 0, 0, true), other = new Point('other', 0, 0); other.sketchId = 'S2';
  const circle = { id: 'circle' }, arc = { id: 'arc' };
  const free = { id: 'free', type: 'free', sketchId: 'S1' }, linked = { id: 'linked', type: 'linked', sketchId: 'S1' };
  const block = { id: 'block', sketchId: 'S1', rotationLocked: true }, locked = { id: 'locked', sketchId: 'S1', fixed: true };
  Object.assign(state.scope, { points: [p, fixed, other], circles: [circle], arcs: [arc], geometryInstances: [free, linked], blockInstances: [block, locked] });
  const component = new Set([p, fixed, other, circle, arc, free, linked, block, locked]);
  const local = query.localSolveVariables(component);
  assert.deepEqual(Array.from(local, v => v.label), ['free.x', 'free.y', 'free.rotation', 'circle.r', 'arc.r', 'arc.startAngle', 'arc.endAngle', 'block.x', 'block.y']);
  assert.equal(local.find(v => v.object === circle).min, 0.01);
  assert.equal(query.sketchSolveVariables().filter(v => v.object === p).length, 2);
  block.rotationLocked = false;
  assert.equal(query.localSolveVariables(component).at(-1).prop, 'rotation');
  state.sketch = 'S2';
  assert.deepEqual(Array.from(query.sketchSolveVariables(), v => v.object), [other, other]);
});
test('constraint scope, fixed-only references and replacing the current workspace are reflected on every read', () => {
  const { state, query } = fixture();
  const p = new Point('p', 0, 0), fixed = new Point('fixed', 0, 0, true);
  const active = { nodes: [p] }, fixedOnly = { nodes: [fixed] }, disabled = { nodes: [p], enabled: false }, other = { nodes: [p], sketchId: 'S2' };
  state.scope.constraints = [active, fixedOnly, disabled, other];
  assert.deepEqual(Array.from(query.localSolveConstraints(new Set([p, fixed]))), [active]);
  assert.deepEqual(Array.from(query.sketchSolveConstraints()), [active, fixedOnly]);
  state.scope = { ...state.scope, constraints: [], points: [p] };
  assert.equal(query.sketchSolveConstraints().length, 0);
  assert.equal(query.localSolveContextFromSeeds([p]).variables[0].object, p);
});

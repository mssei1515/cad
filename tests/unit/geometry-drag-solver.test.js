const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/solver/geometry_drag_solver.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const geometry = sandbox.window.GeometrySolver;
const ok = () => ({ success: true, errorNorm: 0, iterations: 1 });
const failed = () => ({ success: false, errorNorm: 1, iterations: 1 });
const coordinates = point => ['x', 'y'].map(prop => ({ object: point, prop }));
function fixture() {
  const point = { x: 0, y: 0 }, variables = coordinates(point), constraints = [{}];
  const state = { scale: 1, active: 'S1', full: ok, guided: ok, local: ok, residual: 0 };
  const calls = { full: [], guided: [], local: [] };
  const solver = {
    maxStepNorm: 2, maxIterations: 20,
    getVariables: () => variables,
    clone: vars => vars.map(v => ({ ...v, value: v.object[v.prop] })),
    restore: snapshot => snapshot.forEach(v => { v.object[v.prop] = v.value; }),
    computeErrorVectorForConstraints: () => [state.residual],
    solveSubset: options => { calls.local.push(options); return state.local(options); },
    solveSubsetGuided: options => { calls.guided.push(options); return state.guided(options); },
  };
  const session = Object.freeze({ kind: 'point', mode: 'points', sketchId: 'S1', local: { variables, constraints, lines: [] } });
  const drag = sandbox.window.GeometryDragSolver.create({ solver,
    activeSketchId: () => state.active, sketchSolveVariables: () => variables, sketchSolveConstraints: () => constraints,
    solveSketchById: (id, extra, variableAllowed) => {
      calls.full.push({ id, extra, variableAllowed }); return state.full({ id, extra, variableAllowed });
    }, viewScale: () => state.scale, arcEndpointPoint: () => ({ x: 0, y: 0 }), acceptError: 1e-4, previewMaxModelError: 0.125 });
  return { point, variables, constraints, state, calls, solver, session, drag };
}

test('unconstrained targets update geometry directly and respect parameter minima without solving', () => {
  const f = fixture(), radius = { radiusValue: 5 };
  f.session.local.constraints = [];
  const result = f.drag.guided(f.session, [{ point: f.point, x: 4, y: 7 }, { object: radius, prop: 'radiusValue', value: -1, min: 0.01 }], []);
  assert.equal(result.success, true);
  assert.deepEqual(f.point, { x: 4, y: 7 });
  assert.equal(radius.radiusValue, 0.01);
  assert.equal(f.calls.guided.length + f.calls.local.length + f.calls.full.length, 0);
  assert.equal(f.drag.targetConstraintCount(f.session), 0);
});

test('numerical progress is private per session and repeated targets retain the original step during repair', () => {
  const f = fixture(), extra = [{}], active = [{ object: f.point, prop: 'x' }];
  f.state.guided = () => ({ ...ok(), targetConstraints: extra, activeTargetVariables: active });
  f.drag.guided(f.session, [{ point: f.point, x: 3, y: 4 }], extra);
  f.point.x = 100;
  f.state.scale = 10;
  f.drag.guided(f.session, [{ point: f.point, x: 3, y: 4 }], extra);
  assert.equal(f.calls.guided[0].targetStepNorm, 5);
  assert.equal(f.calls.guided[1].targetStepNorm, 5);
  assert.equal(f.calls.guided[1].errorTolerance, 0.01);
  assert.equal(f.calls.guided[1].activeTargetVariables, active);
  f.drag.guided(f.session, [{ point: f.point, x: 6, y: 8 }], extra);
  assert.equal(f.calls.guided[2].targetStepNorm, 5);
  assert.equal(f.drag.targetConstraintCount(f.session), 1);
  const second = Object.freeze({ ...f.session });
  f.drag.guided(second, [{ point: f.point, x: 100, y: 1 }], []);
  assert.equal(f.calls.guided[3].targetStepNorm, 1);
  assert.equal(f.calls.guided[3].activeTargetVariables.length, 0);
});

test('local failure restores the supplied geometry before full solve and restores solver options even on throw', () => {
  const f = fixture(), extra = [new geometry.DragConstraint(f.point, 100, 0)];
  const start = f.solver.clone(f.variables), allowed = v => v.prop === 'x';
  const session = { ...f.session, sketchId: 'S2', variableAllowed: allowed };
  f.state.local = () => { f.point.x = -99; return failed(); };
  f.state.full = ({ id, extra: passed, variableAllowed }) => {
    assert.equal(f.point.x, 0);
    assert.equal(id, 'S2'); assert.equal(passed, extra); assert.equal(variableAllowed, allowed);
    assert.ok(f.solver.maxStepNorm >= 125);
    return ok();
  };
  const result = f.drag.solve(session, extra, start);
  assert.equal(result.fallback, true); assert.equal(result.localErrorNorm, 1);
  assert.equal(f.solver.maxStepNorm, 2);
  f.state.full = () => { throw new Error('solver failure'); };
  assert.throws(() => f.drag.solve(session, extra, start), /solver failure/);
  assert.equal(f.solver.maxStepNorm, 2);
});

test('guided preview rejects excessive model residual despite acceptable pointer error and restores each retry', () => {
  const f = fixture(), start = f.solver.clone(f.variables), targets = [{ point: f.point, x: 10, y: 0 }];
  f.state.residual = 0.01;
  f.state.guided = () => {
    assert.equal(f.point.x, 0); f.point.x = 99;
    return { success: true, errorNorm: 0.01, acceptError: 0.1 };
  };
  f.state.full = () => { assert.equal(f.point.x, 0); return failed(); };
  const result = f.drag.guided(f.session, targets, [], start);
  assert.equal(result.success, false); assert.equal(result.guidedRetryCount, 5);
  assert.deepEqual(f.calls.guided.map(call => call.targetStepNorm), [10, 5, 2.5, 1.25, 0.625]);
  assert.equal(f.drag.targetConstraintCount(f.session), 0);
  assert.equal(f.solver.maxStepNorm, 2);
});

test('sparse line fallback restores the whole sketch before subdividing and retains target progress', () => {
  const f = fixture(), second = { x: 10, y: 0 }, unrelated = { x: 77, y: 0 };
  f.variables.push(...coordinates(second), ...coordinates(unrelated));
  const session = Object.freeze({ ...f.session, kind: 'line', points: [f.point, second],
    local: { ...f.session.local, variables: f.variables.slice(0, 4), fixedPointCount: 0 } });
  const targets = [{ point: f.point, x: 60, y: 0 }, { point: second, x: 70, y: 0 }];
  let attempts = 0;
  f.state.guided = ({ targets: step }) => {
    attempts += 1;
    if (attempts === 1) { f.point.x = -999; return failed(); }
    assert.equal(unrelated.x, 77);
    for (const target of step) Object.assign(target.point, { x: target.x, y: target.y });
    return { ...ok(), projectedNorm: 2, targetConstraints: [{}] };
  };
  f.state.full = () => {
    assert.equal(f.point.x, 0); assert.equal(f.solver.maxIterations, 100);
    unrelated.x = -999; return failed();
  };
  const result = f.drag.guided(session, targets, [], f.solver.clone(session.local.variables));
  assert.equal(result.success, true); assert.equal(result.guidedSubstepCount, 22);
  assert.equal(result.iterations, 22); assert.equal(result.projectedNorm, 44);
  assert.equal(f.point.x, 60); assert.equal(second.x, 70); assert.equal(unrelated.x, 77);
  assert.equal(f.drag.targetConstraintCount(session), 1);
  assert.equal(f.solver.maxIterations, 20); assert.equal(f.solver.maxStepNorm, 2);
});

test('Line-Circle distance preview pins line targets and solves only the remaining variables', () => {
  const f = fixture(), second = { x: 10, y: 0 }, center = { x: 5, y: 5 };
  const line = new geometry.Line('L', f.point, second), circle = new geometry.Circle('C', center, 2);
  const constraint = new geometry.LineCircleDistanceConstraint(line, circle, 5);
  const remaining = coordinates(center);
  const session = Object.freeze({ ...f.session, kind: 'line', local: {
    variables: [...coordinates(f.point), ...coordinates(second), ...remaining], constraints: [constraint], lines: [line] } });
  f.state.local = options => {
    assert.deepEqual(options.variables, remaining);
    assert.equal(f.point.y, 2); assert.equal(second.y, 2);
    return ok();
  };
  const result = f.drag.guided(session, [{ point: f.point, x: 0, y: 2 }, { point: second, x: 10, y: 2 }], [{}]);
  assert.equal(result.pinnedLineTargets, true);
  assert.equal(f.calls.guided.length + f.calls.full.length, 0);
  assert.equal(f.drag.targetConstraintCount(session), 1);
});

test('final solve retries without targets after restoration and accepts the existing drag tolerance', () => {
  const f = fixture(), extra = [{}];
  f.state.guided = () => ({ ...ok(), targetConstraints: extra });
  f.drag.guided(f.session, [{ point: f.point, x: 3, y: 4 }], extra);
  f.state.full = ({ extra: targets }) => {
    assert.equal(f.point.x, 0);
    if (targets.length) { assert.equal(targets, extra); f.point.x = 99; return failed(); }
    return { success: false, errorNorm: 5e-5 };
  };
  const result = f.drag.finish(f.session);
  assert.equal(result.success, true); assert.equal(result.guidedFinalFallback, true);
  assert.equal(result.acceptedAtDragTolerance, true); assert.equal(f.calls.full.length, 2);
  assert.equal(f.point.x, 0);
});

test('approximate preview receives a larger local correction budget at finish without a full solve', () => {
  const f = fixture();
  f.state.guided = () => ({ success: false, errorNorm: 0.01, acceptError: 0.1, targetConstraints: [{}] });
  const preview = f.drag.guided(f.session, [{ point: f.point, x: 3, y: 4 }], []);
  assert.equal(preview.success, true); assert.equal(preview.approximate, true);
  f.state.local = ({ extra }) => {
    assert.equal(f.solver.maxIterations, 100); assert.equal(extra.length, 0);
    return { success: false, errorNorm: 5e-5 };
  };
  const result = f.drag.finish(f.session);
  assert.equal(result.success, true); assert.equal(result.localFinalCorrection, true);
  assert.equal(f.calls.full.length, 0); assert.equal(f.solver.maxIterations, 20);
  f.state.local = () => { throw new Error('correction failure'); };
  assert.throws(() => f.drag.finish(f.session), /correction failure/);
  assert.equal(f.solver.maxIterations, 20);
});

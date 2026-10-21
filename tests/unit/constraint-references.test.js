const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { structuredClone, window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/geometry/pattern_instance_model.js", "src/constraints/references.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Arc, Spline, DistanceConstraint, ArcEndpointCoincidentConstraint, PointOnSplineConstraint, SketchProjectionConstraint, OffsetChainConstraint } = sandbox.window.GeometrySolver;
const create = sandbox.window.ConstraintReferences.create;
for (const file of ["src/geometry/geometry_ref.js", "src/geometry/objects.js", "src/editing/selection_highlight.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { LineFixedConstraint, ArcEndpointFixedConstraint } = sandbox.window.GeometrySolver;
function fixedStateFixture() {
  const state = { scope: { constraints: [] }, reads: 0, compares: [], readFailure: null, compareFailure: null };
  const highlight = sandbox.window.SelectionHighlight.create({ types: sandbox.window.GeometrySolver,
    geometryRefForItem: sandbox.window.GeometryObjects.geometryRefForItem, geometryRefsEqual: sandbox.window.GeometryRef.equals });
  const api = sandbox.window.ConstraintReferences.createFixedState({
    currentScope: () => { state.reads++; if (state.readFailure) throw state.readFailure; return state.scope; },
    sameConstraintDisplayElement: (a, b) => { state.compares.push([a, b]); if (state.compareFailure) throw state.compareFailure; return highlight.sameConstraintDisplayElement(a, b); } });
  assert.equal(state.reads, 0); assert.deepEqual(state.compares, []); assert.equal(Object.isFrozen(api), true);
  return { state, api };
}

test('fixed queries use current constraints, strict enabled flags and actual types and return the first original match', () => {
  const f = fixedStateFixture(), p = new Point('P1', 0, 0), q = new Point('P2', 10, 0), line = new Line('L1', p, q);
  const disabled = new LineFixedConstraint(line), first = new LineFixedConstraint(line), second = new LineFixedConstraint(line);
  disabled.enabled = false; f.state.scope.constraints = [{ line }, disabled, first, second]; const original = f.state.scope.constraints;
  for (const enabled of [true, undefined, null, 0, 'false']) {
    first.enabled = enabled; f.state.compares.length = 0;
    assert.equal(f.api.findLineFixedConstraint(line), first); assert.deepEqual(f.state.compares, [[line, line]]);
  }
  assert.equal(f.api.findLineFixedConstraint(new Line('L1', p, q)), undefined); assert.equal(f.state.scope.constraints, original);
  f.state.scope.constraints = [second]; assert.equal(f.api.findLineFixedConstraint(line), second);
  f.state.scope = { constraints: [] }; assert.equal(f.api.findLineFixedConstraint(line), undefined); assert.equal(f.api.pointLockedByLineFixed(p), false);
});

test('fixed display queries share real projected identity while arc endpoints retain comparison before endpoint filtering', () => {
  const f = fixedStateFixture(), p = new Point('P1', 0, 0), q = new Point('P2', 10, 0);
  const projected = Object.assign(new Line('B1@L1', p, q), { blockProjection: true });
  const replacement = Object.assign(new Line('B1@L1', p, q), { blockProjection: true }), fixed = new LineFixedConstraint(projected);
  f.state.scope.constraints = [fixed]; assert.equal(f.api.findLineFixedConstraint(replacement), fixed);
  assert.equal(f.api.findLineFixedConstraint(Object.assign(new Line('B2@L1', p, q), { blockProjection: true })), undefined);
  assert.equal(f.api.findLineFixedConstraint(new Line('B1@L1', p, q)), undefined);
  const arc = Object.assign(new Arc('B1@A1', p, 10, 0, Math.PI), { blockProjection: true });
  const regenerated = Object.assign(new Arc('B1@A1', p, 10, 0, Math.PI), { blockProjection: true });
  const end = new ArcEndpointFixedConstraint(arc, 'end', -10, 0), start = new ArcEndpointFixedConstraint(arc, 'start', 10, 0);
  f.state.scope.constraints = [fixed, end, start]; f.state.compares.length = 0;
  assert.equal(f.api.findArcEndpointFixedConstraint(regenerated, 'start'), start); assert.deepEqual(f.state.compares, [[arc, regenerated], [arc, regenerated]]);
  assert.equal(f.api.findArcEndpointFixedConstraint(regenerated, 'end'), end);
  assert.equal(f.api.findArcEndpointFixedConstraint(regenerated, 'START'), undefined);
  start.enabled = false; assert.equal(f.api.findArcEndpointFixedConstraint(regenerated, 'start'), undefined);
});

test('fixed-line point locks use raw endpoint identity without display comparisons and follow replaced scopes', () => {
  const f = fixedStateFixture(), p = new Point('P1', 0, 0), q = new Point('P2', 10, 0), line = new Line('L1', p, q), fixed = new LineFixedConstraint(line);
  f.state.scope.constraints = [fixed]; f.state.compareFailure = new Error('point lock must not compare display references');
  assert.equal(f.api.pointLockedByLineFixed(p), true); assert.equal(f.api.pointLockedByLineFixed(q), true);
  assert.equal(f.api.pointLockedByLineFixed(new Point('P1', 0, 0)), false); assert.deepEqual(f.state.compares, []);
  fixed.enabled = false; assert.equal(f.api.pointLockedByLineFixed(p), false);
  fixed.enabled = true; f.state.scope.constraints = [fixed, null]; assert.equal(f.api.pointLockedByLineFixed(p), true);
  f.state.scope = { constraints: [new LineFixedConstraint(new Line('L1', new Point('P1', 0, 0), new Point('P2', 10, 0)))] };
  assert.equal(f.api.pointLockedByLineFixed(p), false); assert.equal(line.p1, p); assert.equal(line.p2, q);
});

test('fixed queries retain read, comparison and malformed-constraint error boundaries without filtering or mutation', () => {
  const f = fixedStateFixture(), error = new Error('query failed'), p = new Point('P1', 0, 0), q = new Point('P2', 10, 0), line = new Line('L1', p, q);
  f.state.readFailure = error;
  for (const invoke of [() => f.api.findLineFixedConstraint(line), () => f.api.findArcEndpointFixedConstraint({}, 'start'), () => f.api.pointLockedByLineFixed(p)]) assert.throws(invoke, value => value === error);
  assert.deepEqual(f.state.compares, []); f.state.readFailure = null;
  const disabled = new LineFixedConstraint(line); disabled.enabled = false; f.state.scope.constraints = [disabled, { line }]; f.state.compareFailure = error;
  assert.equal(f.api.findLineFixedConstraint(line), undefined); assert.deepEqual(f.state.compares, []);
  const fixed = new LineFixedConstraint(line); f.state.scope.constraints = [fixed];
  assert.throws(() => f.api.findLineFixedConstraint(line), value => value === error); assert.equal(f.state.scope.constraints[0], fixed); assert.equal(fixed.line, line);
  f.state.compareFailure = null; f.state.scope.constraints = [null];
  assert.throws(() => f.api.findLineFixedConstraint(line), value => value.name === 'TypeError');
  assert.throws(() => f.api.pointLockedByLineFixed(p), value => value.name === 'TypeError'); assert.equal(f.state.scope.constraints[0], null);
});

test("line dependencies preserve point identity and recognize either distance endpoint order", () => {
  const queries = create({ resolveGeometryRef: () => null });
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0);
  const c = new DistanceConstraint(p, q, 10);
  assert.equal(queries.constraintReferencesLine(c, new Line("L1", q, p)), true);
  assert.equal(queries.constraintReferencesPoint(c, new Point("P1", 0, 0)), false);
  assert.deepEqual(Array.from(queries.constraintGraphNodes(c)), [p, q]);
  assert.deepEqual(Array.from(queries.constraintGraphNodes({})), []);
});

test("arc endpoint and spline constraints enumerate their defining points without solving", () => {
  const queries = create({ resolveGeometryRef: () => null });
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0), r = new Point("P3", 10, 10);
  const arc = new Arc("A1", p, 10, 0, Math.PI);
  const endpoint = new ArcEndpointCoincidentConstraint(arc, "end", q);
  assert.equal(queries.constraintReferencesPoint(endpoint, p), true);
  assert.equal(queries.constraintReferencesPoint(endpoint, q), true);
  assert.equal(queries.constraintReferencesPrimitive(endpoint, arc), true);
  const spline = new Spline("SP1", [p, q, r]);
  const c = new PointOnSplineConstraint(p, spline, 0.3);
  const nodes = queries.constraintGraphNodes(c);
  assert.equal(nodes.length, 4);
  assert.ok([p, q, r, spline].every(item => nodes.includes(item)));
  assert.equal(queries.constraintReferencesPoint(c, r), true);
  assert.equal(queries.constraintReferencesPrimitive(c, spline), true);
  assert.equal(c.parameter, 0.3);
});

test("intrinsic instance references use the supplied scope and can be excluded without resolving", () => {
  const source = new Point("P1", 0, 0), target = new Point("P2", 0, 0);
  const a = new Point("P1", 1, 0), b = new Point("P1", 2, 0);
  const ref = { kind: "point", id: "P1" };
  const axis = { kind: "line", id: "L1" }, direction = { kind: "line", id: "L2" };
  const block = { id: "BI1" }, instance = { id: "FI1", sources: [ref], placement: { axis, direction } };
  source.derivedInstance = instance;
  source.blockInstance = block;
  const c = new SketchProjectionConstraint("point", source, target);
  const calls = [];
  const first = create({ resolveGeometryRef: r => { calls.push(r); return r === ref ? a : null; } });
  const second = create({ resolveGeometryRef: r => r === ref ? b : null });
  const direct = first.constraintGraphNodes(c, { includeIntrinsicDependencies: false });
  assert.deepEqual(Array.from(direct), [source, target]);
  assert.equal(calls.length, 0);
  const expanded = first.constraintGraphNodes(c);
  assert.ok([source, target, block, instance, a].every(item => expanded.includes(item)));
  assert.equal(expanded.includes(b), false);
  assert.deepEqual(calls, [ref, axis, direction]);
  assert.equal(second.constraintGraphNodes(c).includes(b), true);
  assert.equal(first.constraintReferencesPoint(c, a), true);
  assert.equal(second.constraintReferencesPoint(c, a), false);
});

test("offset chains enumerate both sides and shared endpoints only once", () => {
  const queries = create({ resolveGeometryRef: () => null });
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0), r = new Point("P3", 10, 10);
  const a = new Line("L1", p, q), b = new Line("L2", q, r);
  const c = new OffsetChainConstraint([a], [b], 2);
  const nodes = queries.constraintGraphNodes(c);
  assert.equal(nodes.length, 5);
  assert.ok([a, b, p, q, r].every(item => nodes.includes(item)));
  assert.equal(queries.constraintReferencesPoint(c, r), true);
  assert.equal(queries.constraintReferencesLine(c, b), true);
});

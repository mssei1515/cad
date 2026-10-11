const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/editing/point_usage.js', 'src/editing/geometry_deletion.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
function fixture() {
 const model = { points: [], lines: [], circles: [], arcs: [], splines: [], constraints: [] };
 const references = (constraint, item) => constraint.nodes.includes(item);
 const usage = sandbox.window.PointUsage.create({ currentScope: () => model, constraintReferencesPoint: references });
 const planner = sandbox.window.GeometryDeletion.create({ ...usage,
  constraintReferencesPoint: references, constraintReferencesLine: references, constraintReferencesPrimitive: references,
  geometryElementKey: item => item.id, annotationReferencesRemovedGeometry: (item, ids, keys) => ids.has(item.anchorId) || keys.has(item.anchorKey) });
 return { model, planner };
}
const point = (id, kind = 'endpoint') => ({ id, kind });
test('line deletion preserves shared endpoints and explicit points without mutating model or input', () => {
 const { model, planner } = fixture();
 const a = point('a'), b = point('b'), c = point('c', 'explicit');
 const removed = { p1: a, p2: b }, retained = { p1: b, p2: c }, explicit = { p1: c, p2: a };
 model.points.push(a, b, c); model.lines.push(removed, retained, explicit);
 const input = { lines: [removed, explicit] }, pointsArray = model.points, linesArray = model.lines;
 const plan = planner.plan(model, input);
 assert.deepEqual([...plan.pointSet], [a]); assert.equal(plan.lineSet.has(retained), false);
 assert.equal(model.points, pointsArray); assert.equal(model.lines, linesArray); assert.equal(model.lines.length, 3);
 assert.deepEqual(input.lines, [removed, explicit]); assert.equal(plan.lineSet.has(removed), true);
});
test('selected point expands across primitive types and removes dependent constraints including disabled ones', () => {
 const { model, planner } = fixture(); const a = point('a'), b = point('b');
 const line = { p1: a, p2: b }, circle = { center: a }, arc = { center: a }, spline = { fitPoints: [a, b] };
 model.points.push(a, b); model.lines.push(line); model.circles.push(circle); model.arcs.push(arc); model.splines.push(spline);
 const constraints = [a, line, circle, arc, spline].map(node => ({ nodes: [node], enabled: false }));
 const retained = { nodes: [point('a')] }, selected = { nodes: [] };
 model.constraints.push(...constraints, retained, selected);
 const plan = planner.plan(model, { points: [a], constraints: [selected] });
 for (const [field, item] of [['lineSet', line], ['circleSet', circle], ['arcSet', arc], ['splineSet', spline]]) assert.equal(plan[field].has(item), true);
 assert.equal(plan.pointSet.has(b), true); assert.equal(plan.constraintSet.size, 6);
 assert.equal(plan.constraintSet.has(retained), false); assert.equal(model.constraints.length, 7);
});
test('orphan center and fit points remain when used by any retained primitive type', () => {
 const { model, planner } = fixture(); const a = point('a'), b = point('b'), c = point('c');
 const circle = { center: a }, arc = { center: b }, spline = { fitPoints: [c] };
 model.circles.push(circle); model.arcs.push(arc); model.splines.push(spline);
 model.lines.push({ p1: a, p2: b }); model.circles.push({ center: c });
 const plan = planner.plan(model, { circles: [circle], arcs: [arc], splines: [spline] });
 assert.equal(plan.pointSet.size, 0);
});
test('constraint-only and empty plans retain object identity and do not imply geometry deletion', () => {
 const { model, planner } = fixture(); const constraint = { nodes: [] }; model.constraints.push(constraint);
 const plan = planner.plan(model, { constraints: [constraint] });
 assert.equal(plan.constraintSet.has(constraint), true); assert.equal(plan.pointSet.size, 0);
 const empty = planner.plan(model); for (const set of Object.values(empty)) assert.equal(set.size, 0);
});


test('apply removes planned geometry and dependent annotations while retaining surviving object identity', () => {
 const { model, planner } = fixture(); const removed = point('p1'), survivor = point('p2', 'explicit');
 const line = { id: 'l1', p1: removed, p2: survivor }, keptCircle = { id: 'c1', center: survivor };
 const constraint = { nodes: [line] }, keptConstraint = { nodes: [survivor] };
 model.points.push(removed, survivor); model.lines.push(line); model.circles.push(keptCircle);
 model.constraints.push(constraint, keptConstraint);
 const annotation = { anchorId: 'p1' }, keyed = { anchorKey: 'l1' }, keptAnnotation = { anchorId: 'p2' };
 model.annotations = [annotation, keyed, keptAnnotation]; model.hatches = [{ id: 'h1' }];
 const originalPoints = model.points, hatches = model.hatches, plan = planner.plan(model, { lines: [line] });
 planner.apply(model, plan);
 assert.deepEqual(model.points, [survivor]); assert.notEqual(model.points, originalPoints);
 assert.equal(model.lines.length, 0); assert.deepEqual(model.circles, [keptCircle]);
 assert.deepEqual(model.constraints, [keptConstraint]); assert.deepEqual(model.annotations, [keptAnnotation]);
 assert.equal(model.hatches, hatches); assert.equal(plan.lineSet.has(line), true); assert.equal(plan.pointSet.has(removed), true);
});


function instanceFixture() {
 const callbacks = [];
 const editing = sandbox.window.GeometryDeletion.create({
  geometryInstanceBundle: instance => { callbacks.push('derived:' + instance.id); return instance.bundle; },
  blockAllProjectionBundle: instance => { callbacks.push('block:' + instance.id); return instance.bundle; },
  constraintGraphNodes: constraint => constraint.nodes,
  geometryElementKey: item => item.key,
  annotationReferencesRemovedGeometry: (item, ids, keys) => ids.has(item.anchorId) || keys.has(item.anchorKey),
 });
 const projected = { id: 'p1', key: 'path/p1' }, regenerated = { id: 'p1', key: 'path/p1' };
 const instance = { id: 'i1', key: 'owner/i1', bundle: { points: [projected], lines: [], circles: [], arcs: [], splines: [] } };
 const survivor = { id: 'i2', key: 'owner/i2' };
 const direct = { nodes: [instance] }, projection = { nodes: [projected] }, regeneratedConstraint = { nodes: [regenerated] }, unrelated = { nodes: [survivor] };
 const attached = { anchorId: 'p1' }, keyed = { anchorKey: 'path/p1' }, annotation = { anchorId: 'p2' };
 const model = { constraints: [direct, projection, regeneratedConstraint, unrelated], annotations: [attached, keyed, annotation],
  geometryInstances: [instance, survivor], blockInstances: [instance, survivor], points: [projected] };
 return { editing, model, instance, survivor, direct, projection, regeneratedConstraint, unrelated, annotation, callbacks };
}
test('derived removal plans projection identity and regenerated keys without treating owner nodes as projections', () => {
 const f = instanceFixture(), constraints = f.model.constraints;
 const plan = f.editing.planDerivedInstances(f.model, [f.instance]);
 assert.deepEqual([...plan.removedConstraints], [f.projection, f.regeneratedConstraint]);
 assert.equal(f.model.constraints, constraints); assert.equal(f.model.geometryInstances.length, 2);
 f.editing.applyInstances(f.model, plan);
 assert.deepEqual(f.model.constraints, [f.direct, f.unrelated]); assert.deepEqual(f.model.annotations, [f.annotation]);
 assert.deepEqual(f.model.geometryInstances, [f.survivor]); assert.equal(f.model.blockInstances.length, 2);
 assert.equal(f.model.points.length, 1); assert.deepEqual(f.callbacks, ['derived:i1']);
});
test('Block removal also includes constraints on owner nodes and supports older bundles without splines', () => {
 const f = instanceFixture(); delete f.instance.bundle.splines;
 const plan = f.editing.planBlockInstances(f.model, [f.instance]);
 assert.deepEqual([...plan.removedConstraints], [f.direct, f.projection, f.regeneratedConstraint]);
 f.editing.applyInstances(f.model, plan);
 assert.deepEqual(f.model.constraints, [f.unrelated]); assert.deepEqual(f.model.blockInstances, [f.survivor]);
 assert.equal(f.model.geometryInstances.length, 2); assert.deepEqual(f.callbacks, ['block:i1']);
});
test('derived projection keys omit falsy keys while Block keeps the existing key semantics', () => {
 const f = instanceFixture(); const noKey = { id: 'p0' }; f.instance.bundle.points = [noKey];
 const unrelatedNoKey = { nodes: [{}] }; f.model.constraints = [unrelatedNoKey];
 const derived = f.editing.planDerivedInstances(f.model, [f.instance]);
 assert.equal(derived.removedKeys.size, 0); assert.equal(derived.removedConstraints.size, 0);
 const block = f.editing.planBlockInstances(f.model, [f.instance]);
 assert.equal(block.removedKeys.has(undefined), true); assert.equal(block.removedConstraints.has(unrelatedNoKey), true);
});

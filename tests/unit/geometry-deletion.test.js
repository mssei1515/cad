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

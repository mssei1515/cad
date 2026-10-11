const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/editing/selection.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Circle, Arc } = sandbox.window.GeometrySolver;
const create = sandbox.window.CanvasSelection.create;

test('clipboard selection resolves copied IDs to actual objects and keeps primitive kinds separate', () => {
  const selection = create(), p = new Point('P2', 0, 0), q = new Point('P3', 10, 0);
  const line = new Line('L2', p, q), circle = new Circle('C2', p, 2), arc = new Arc('A2', p, 3, 0, 1);
  const spline = new sandbox.window.GeometrySolver.Spline('SP2', [p, q], false, false);
  const maps = { idMap: new Map([['p', p.id], ['l', line.id], ['c', circle.id], ['a', arc.id], ['s', spline.id]]),
    pointById: new Map([[p.id, p]]), lineById: new Map([[line.id, line]]),
    primitiveById: new Map([[circle.id, circle], [arc.id, arc], [spline.id, spline]]) };
  selection.set('sketchId', 'S9');
  selection.applyClipboard({ points: ['p', 'missing'], lines: ['l'], circles: ['c', 'a'], arcs: ['a', 'c'], splines: ['s', 'c'] }, maps,
    { blockInstances: [], annotations: [], hatches: [], geometryInstances: [], referenceImages: [] });
  assert.equal(selection.points.length, 1); assert.equal(selection.points[0], p); assert.equal(selection.lines[0], line);
  assert.equal(selection.circles.length, 1); assert.equal(selection.circles[0], circle);
  assert.equal(selection.arcs.length, 1); assert.equal(selection.arcs[0], arc);
  assert.equal(selection.splines.length, 1); assert.equal(selection.splines[0], spline); assert.equal(selection.sketchId, null);
});

test('clipboard selection restricts annotations and hatches to selected IDs but selects every pasted instance and image', () => {
  const selection = create(), annotation = { id: 'AN2' }, hatch = { id: 'H2' }, block = { id: 'BI2' }, instance = { id: 'FI2' }, image = { id: 'IMG2' };
  const maps = { idMap: new Map([['an', 'AN2'], ['h', 'H2']]), pointById: new Map(), lineById: new Map(), primitiveById: new Map() };
  selection.applyClipboard({ points: [], lines: [], circles: [], arcs: [], annotations: ['an', 'missing'], hatches: ['h'] }, maps,
    { annotations: [annotation, { id: 'AN3' }], hatches: [hatch, { id: 'H3' }], blockInstances: [block], geometryInstances: [instance], referenceImages: [image] });
  assert.equal(selection.annotations.length, 1); assert.equal(selection.annotations[0], annotation);
  assert.equal(selection.hatches.length, 1); assert.equal(selection.hatches[0], hatch);
  assert.equal(selection.blockInstances[0], block); assert.equal(selection.geometryInstances[0], instance); assert.equal(selection.referenceImages[0], image);
  assert.equal(selection.splines.length, 0);
});

test('read-only selection shares tree and canvas targets but never exposes edit operands across sketches', () => {
  const selection = create(), line = new Line('L1', new Point('P1', 0, 0), new Point('P2', 10, 0));
  const target = { kind: 'geometry', category: 'line', item: line };
  selection.selectInspection(target, 'S1');
  assert.equal(selection.inspectionContains(line), true);
  assert.equal(selection.selectedElementCount(), 0);
  assert.equal(selection.currentConstraintTargets().lines.length, 0);
  selection.selectInspection({ ...target, item: { id: 'L2' } }, 'S2', true);
  assert.equal(selection.inspection.sketchId, 'S1');
  assert.equal(selection.inspection.targets.length, 1);
  selection.selectInspection({ ...target, item: { id: 'L3' } }, 'S1', true);
  assert.equal(selection.inspection.targets.length, 2);
  selection.selectInspection(target, 'S1', true);
  assert.equal(selection.inspectionContains(line), false);
  selection.set('lines', [line]);
  selection.selectInspection(target, 'S2', true);
  assert.equal(selection.inspection, null);
  assert.equal(selection.lines[0], line);
});

test("selection instances are isolated and preserve Canvas identity versus sidebar ID matching", () => {
  const first = create(), second = create();
  const point = new Point("P1", 0, 0), regenerated = new Point("P1", 0, 0);
  first.togglePointSelection(point);
  first.togglePointSelection(regenerated);
  assert.equal(first.points.length, 2);
  assert.equal(second.points.length, 0);
  first.togglePointSelection(point);
  assert.equal(first.points[0], regenerated);
  first.toggleById("points", point);
  assert.equal(first.points.length, 0);
  second.set("points", [point]);
  first.clear();
  assert.equal(second.points[0], point);
});

test("geometry replacement clears endpoint and dimension selection but preserves other categories", () => {
  const selection = create(), point = new Point("P1", 0, 0);
  const annotation = { id: "N1" }, constraint = { type: "horizontal" };
  selection.set("annotations", [annotation]);
  selection.set("constraint", constraint);
  selection.set("arcEndpoint", { arc: {}, endpoint: "start" });
  selection.set("arcEndpointPair", [{ arc: {}, endpoint: "end" }]);
  selection.set("dimensionConstraint", {});
  selection.setGeometrySelection({ kind: "point", item: point });
  assert.equal(selection.points[0], point);
  assert.equal(selection.arcEndpoint, null);
  assert.equal(selection.arcEndpointPair, null);
  assert.equal(selection.dimensionConstraint, null);
  assert.equal(selection.annotations[0], annotation);
  assert.equal(selection.constraint, constraint);
  assert.equal(selection.effectiveSelectedConstraint(), null);
  selection.setGeometrySelection({ kind: "point", item: point }, true);
  assert.equal(selection.effectiveSelectedConstraint(), constraint);
  selection.clear();
  assert.equal(selection.hasSelection(), false);
});

test("arc endpoint targets preserve order, highlight their arc and supersede point pairs", () => {
  const selection = create();
  const p = new Point("P1", 0, 0), other = new Point("P2", 10, 0);
  const arc = new Arc("A1", p, 10, 0, Math.PI);
  selection.set("points", [other]);
  selection.set("arcEndpoint", { arc, endpoint: "end" });
  let targets = selection.currentConstraintTargets();
  assert.equal(targets.axisPointPair[0].arc, arc);
  assert.equal(targets.axisPointPair[0].endpoint, "end");
  assert.equal(targets.axisPointPair[1].point, other);
  assert.equal(selection.geometryItemSelectedInCanvas(arc), true);
  selection.set("arcEndpointPair", [{ arc, endpoint: "start" }, { arc, endpoint: "end" }]);
  targets = selection.currentConstraintTargets();
  assert.equal(targets.axisPointPair[0].endpoint, "start");
  assert.equal(targets.axisPointPair[1].endpoint, "end");
});

test("constraint trimming preserves mixed geometry precedence and Circle before Arc ordering", () => {
  const selection = create();
  const p = new Point("P1", 0, 0), q = new Point("P2", 10, 0);
  const line = new Line("L1", p, q), circle = new Circle("C1", p, 10), arc = new Arc("A1", p, 10, 0, 1);
  selection.set("points", [p, q]);
  selection.set("lines", [line]);
  selection.set("circles", [circle]);
  selection.set("arcs", [arc]);
  selection.trimConstraintSelection("distance");
  assert.equal(selection.points.length, 1);
  assert.equal(selection.lines[0], line);
  assert.equal(selection.selectedPrimitives().length, 0);
  selection.clear();
  selection.set("points", [p]);
  selection.set("circles", [circle]);
  selection.set("arcs", [arc]);
  selection.trimConstraintSelection("pointOnCircle");
  assert.equal(selection.selectedPrimitives().length, 1);
  assert.equal(selection.selectedPrimitives()[0], circle);
});

test("appearance targets distinguish ordinary geometry and instance overrides", () => {
  const selection = create(), instance = { id: "FI1" };
  selection.set("geometryInstances", [instance]);
  assert.equal(selection.appearanceSelectionTarget().key, "appearanceOverride");
  selection.set("points", [new Point("P1", 0, 0)]);
  assert.equal(selection.appearanceSelectionTarget(), null);
  selection.clear();
  const point = new Point("P1", 0, 0);
  selection.set("points", [point]);
  assert.equal(selection.appearanceSelectionTarget().item, point);
  point.blockProjection = true;
  assert.equal(selection.appearanceSelectionTarget(), null);
});


test('rectangle application merges and replaces derived instances with other candidates', () => {
  const selection = create(), a = { id: 'P1' }, b = { id: 'P1' }, instance = { id: 'GI1' };
  selection.set('points', [a]); selection.set('geometryInstances', [instance]); selection.set('constraint', {}); selection.set('arcEndpointPair', {});
  const candidates = { points: [a, b], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], annotations: [], hatches: [], referenceImages: [] };
  selection.applyRectangle(candidates, true); assert.deepEqual(Array.from(selection.points), [a, b]);
  assert.equal(selection.constraint, null); assert.equal(selection.arcEndpointPair, null); assert.equal(selection.geometryInstances[0], instance);
  candidates.points = [b]; candidates.geometryInstances = [instance]; selection.applyRectangle(candidates); assert.deepEqual(Array.from(selection.points), [b]); assert.equal(selection.geometryInstances[0], instance);
  selection.applyRectangle({}); assert.equal(selection.geometryInstances.length, 0);
});


test('tree selections clear with Canvas selections and never become editing operands', () => {
  const s = create(), point = new Point('P1', 0, 0);
  s.set('inspection', { sketchId: 'S2', targets: [{ kind: 'geometry', item: point }] });
  assert.equal(s.hasSelection(), true);
  assert.equal(s.selectedGeometryItems().length, 0);
  assert.equal(s.currentConstraintTargets().points.length, 0);
  assert.equal(s.appearanceSelectionTarget(), null);
  s.togglePointSelection(point); assert.equal(s.inspection, null);
  s.clear(); s.set('sketchId', 'S2'); assert.equal(s.hasSelection(), true);
  s.set('lines', []); assert.equal(s.sketchId, 'S2');
  s.append('points', point); assert.equal(s.sketchId, null);
  s.clear(); assert.equal(s.hasSelection(), false); assert.equal(s.inspection, null);
});


test('drag points preserve geometry identity, source order and shared point multiplicity', () => {
  const selection=create(),p={id:'P'},q={id:'Q'},r={id:'R'};
  selection.set('points',[p]);selection.set('lines',[{p1:p,p2:q}]);selection.set('circles',[{center:r}]);
  selection.set('arcs',[{center:q}]);selection.set('splines',[{fitPoints:[p,r]}]);
  const result=selection.selectedDragPoints();
  assert.deepEqual(Array.from(result),[p,p,q,r,q,p,r]);
  result.pop();assert.equal(selection.splines[0].fitPoints.length,2);assert.equal(selection.points.length,1);
});
test('element count includes drawable selections and endpoint separately but excludes tree and other constraints', () => {
  const selection=create();
  for(const field of ['points','lines','circles','arcs','splines','blockInstances','geometryInstances','annotations','hatches','referenceImages']) selection.set(field,[{}]);
  selection.set('arcEndpoint',{arc:{},endpoint:'start'});selection.set('dimensionConstraint',{});selection.set('constraint',{});
  assert.equal(selection.selectedElementCount(),12);
  selection.clear();selection.set('sketchId','S');selection.set('inspection',{});selection.set('constraint',{});
  assert.equal(selection.selectedElementCount(),0);
});

 test('dimensions toggle by identity, coexist with geometry and survive additive rectangles', () => {
  const selection=create(),a={},b={},line={id:'L'};
  selection.toggleDimensionConstraint(a); selection.toggleDimensionConstraint(b);
  assert.equal(selection.dimensionConstraint,null); assert.equal(selection.dimensionConstraints.length,2);
  selection.setGeometrySelection({kind:'line',item:line},true);
  assert.equal(selection.lines[0],line); assert.equal(selection.constraintSelectedInCanvas(b),true);
  selection.applyRectangle({dimensionConstraints:[a]},true);
  assert.equal(selection.dimensionConstraints.length,2);
  selection.toggleDimensionConstraint(a); assert.equal(selection.dimensionConstraint,b);
  selection.applyRectangle({dimensionConstraints:[a,b]}); assert.equal(selection.dimensionConstraints.length,2); assert.equal(selection.lines.length,0);
  selection.set('dimensionConstraint',a); assert.equal(selection.dimensionConstraints.length,1);
  selection.clear(); assert.equal(selection.dimensionConstraints.length,0);
 });

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["src/geometry/geometry_kernel.js", "src/geometry/spline_geometry.js", "src/solver/constraint_solver.js", "src/editing/selection.js", "src/editing/offset_selection.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8"), sandbox, { filename: file });
}
const { Point, Line, Circle, Arc } = sandbox.window.GeometrySolver;
const create = sandbox.window.CanvasSelection.create;

test('Tree inspection selection matches category and identity or stable ID without changing inspection state', () => {
 const selection = create(), item = { id: 'H1' }, point = { id: 'P1' }, constraint = { id: 'K1' };
 const inspection = { targets: [{ category: 'hatch', item }, { category: 'constraint', item: point }, { category: 'constraint', item: constraint }] };
 selection.set('sketchId', 'S1'); selection.set('inspection', inspection);
 assert.equal(selection.sketchTreeObjectSelected('hatch', item), true);
 assert.equal(selection.sketchTreeObjectSelected('hatch', { id: 'H1' }), true);
 assert.equal(selection.sketchTreeObjectSelected('image', item), false);
 assert.equal(selection.sketchTreeObjectSelected('hatch', { id: 'H2' }), false);
 assert.equal(selection.sketchTreeObjectSelected('constraint', { kind: 'fixed-point', point: { id: 'P1' } }), true);
 assert.equal(selection.sketchTreeObjectSelected('constraint', { constraint: { id: 'K1' } }), true);
 assert.equal(selection.sketchId, 'S1'); assert.equal(selection.inspection, inspection);
 assert.equal(selection.hatches.length, 0); assert.equal(selection.dimensionConstraints.length, 0);
});

test('Tree attachment and instance selection uses actual selected objects rather than matching IDs', () => {
 const selection = create(), cases = [['hatch', 'hatches'], ['image', 'referenceImages'], ['block', 'blockInstances'],
  ['instance', 'geometryInstances'], ['annotation', 'annotations']];
 for (const [category, field] of cases) {
  const item = { id: 'same' }, values = [item]; selection.set(field, values);
  assert.equal(selection.sketchTreeObjectSelected(category, item), true);
  assert.equal(selection.sketchTreeObjectSelected(category, { id: 'same' }), false);
  assert.equal(selection[field], values);
 }
});

test('Tree fixed-point, constraint and geometry queries retain endpoint selection and effective-constraint precedence', () => {
 const selection = create(), p = new Point('P1', 0, 0), q = new Point('P2', 10, 0), line = new Line('L1', p, q);
 const arc = new Arc('A1', p, 3, 0, 1), constraint = {};
 selection.set('constraint', constraint);
 assert.equal(selection.sketchTreeObjectSelected('constraint', { constraint }), true);
 selection.set('points', [p]);
 assert.equal(selection.sketchTreeObjectSelected('constraint', { kind: 'fixed-point', point: p }), true);
 assert.equal(selection.sketchTreeObjectSelected('constraint', { kind: 'fixed-point', point: new Point('P1', 0, 0) }), false);
 assert.equal(selection.sketchTreeObjectSelected('constraint', { constraint }), false);
 selection.set('dimensionConstraints', [constraint]);
 assert.equal(selection.sketchTreeObjectSelected('constraint', { constraint }), true);
 selection.set('lines', [line]); assert.equal(selection.sketchTreeObjectSelected('line', line), true);
 assert.equal(selection.sketchTreeObjectSelected('line', new Line('L1', p, q)), false);
 selection.set('arcEndpoint', { arc, endpoint: 'start' }); assert.equal(selection.sketchTreeObjectSelected('arc', arc), true);
 selection.set('arcEndpoint', null); selection.set('arcEndpointPair', [{ arc, endpoint: 'end' }]);
 assert.equal(selection.sketchTreeObjectSelected('arc', arc), true);
 selection.clear(); assert.equal(selection.sketchTreeObjectSelected('arc', arc), undefined);
});

test('offset selection preserves chain geometry identity and only replaces its existing selection fields', () => {
  const selection = create(), point = new Point('P1', 0, 0), line = new Line('L1', point, point);
  const arc = new Arc('A1', point, 3, 0, 1), circle = new Circle('C1', point, 2);
  const spline = {}, instance = {}, projected = {}, constraint = {};
  for (const field of ['points', 'lines', 'circles', 'arcs', 'blockInstances', 'annotations', 'hatches', 'referenceImages', 'dimensionConstraints']) selection.set(field, [constraint]);
  for (const field of ['arcEndpoint', 'arcEndpointPair', 'constraint']) selection.set(field, constraint);
  selection.set('splines', [spline]); selection.set('geometryInstances', [instance]); selection.set('instanceGeometry', projected);
  selection.set('sketchId', 'S1'); selection.set('inspection', { targets: [] });
  const entries = [{ geometry: arc, reversed: true }, { geometry: line }, { geometry: circle }];
  assert.equal(selection.applyOffsetSelection({ source: line, entries }), undefined);
  assert.deepEqual(Array.from(selection.lines), [line]); assert.deepEqual(Array.from(selection.arcs), [arc]);
  for (const field of ['points', 'circles', 'blockInstances', 'annotations', 'hatches', 'referenceImages', 'dimensionConstraints']) assert.equal(selection[field].length, 0, field);
  for (const field of ['arcEndpoint', 'arcEndpointPair', 'constraint', 'dimensionConstraint', 'sketchId', 'inspection']) assert.equal(selection[field], null, field);
  assert.equal(selection.splines[0], spline); assert.equal(selection.geometryInstances[0], instance); assert.equal(selection.instanceGeometry, projected);
  assert.equal(entries[0].geometry, arc); assert.equal(entries[0].reversed, true); assert.equal(entries.length, 3);
});

test('empty offset selection retains tree inspection and does not become a full selection reset', () => {
  const selection = create(), inspection = { targets: [] }, spline = {}, instance = {};
  selection.set('splines', [spline]); selection.set('geometryInstances', [instance]);
  selection.set('sketchId', 'S1'); selection.set('inspection', inspection);
  selection.applyOffsetSelection({ source: null, entries: [] });
  assert.equal(selection.sketchId, 'S1'); assert.equal(selection.inspection, inspection);
  assert.equal(selection.splines[0], spline); assert.equal(selection.geometryInstances[0], instance);
});

test('offset notifications update the current chain while rejection, reset and circle source assignment keep their notification boundaries', () => {
  const selection = create(), p = new Point('P1', 0, 0), q = new Point('P2', 5, 0), r = new Point('P3', 10, 0);
  const first = new Line('L1', p, q), second = new Line('L2', q, r), circle = new Circle('C1', p, 2);
  let notifications = 0;
  const offset = sandbox.window.OffsetSelection.create({ ...sandbox.window.GeometrySolver,
    getModel: () => ({ lines: [first, second], arcs: [], constraints: [] }), activeSketchId: () => 'S1',
    elementSketchId: () => 'S1', constraintSketchId: () => 'S1',
    onSelectionChanged: () => { notifications++; selection.applyOffsetSelection(offset); },
  });
  assert.equal(offset.add(first).ok, true); assert.equal(offset.add(second).ok, true);
  assert.deepEqual(Array.from(selection.lines), [first, second]);
  const selectedLines = selection.lines;
  assert.equal(offset.add(first).code, 'already-selected'); assert.equal(selection.lines, selectedLines);
  offset.commitSelection(); offset.reset(); offset.selectSource(circle);
  assert.equal(notifications, 2); assert.equal(selection.lines, selectedLines);
  selection.applyOffsetSelection(offset);
  assert.equal(selection.circles[0], circle); assert.equal(selection.lines.length, 0); assert.equal(selection.arcs.length, 0);
});

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


test('deletion selection cleanup retains survivors by identity and preserves separate Spline/constraint phases', () => {
 const selection = create(); const removed = new Point(0, 0), survivor = new Point(1, 1);
 const removedAnnotation = { id: 'a1' }, annotation = { id: 'a2' }, deletedConstraint = {}, keptConstraint = {};
 selection.set('points', [removed, survivor]); selection.set('annotations', [removedAnnotation, annotation]);
 selection.set('dimensionConstraints', [deletedConstraint, keptConstraint]); selection.set('constraint', deletedConstraint);
 selection.set('hatches', [{ id: 'h1' }]); selection.set('sketchId', 'S2');
 const sets = { pointSet: new Set([removed]), lineSet: new Set(), circleSet: new Set(), arcSet: new Set(), splineSet: new Set() };
 selection.discardDeletedGeometry(sets, [annotation]);
 assert.deepEqual(selection.points, [survivor]); assert.deepEqual(selection.annotations, [annotation]);
 assert.equal(selection.constraint, deletedConstraint); assert.equal(selection.dimensionConstraints.length, 2);
 selection.discardDeletedConstraints(new Set([deletedConstraint]));
 assert.deepEqual(selection.dimensionConstraints, [keptConstraint]); assert.equal(selection.constraint, null);
 assert.equal(selection.hatches.length, 1); assert.equal(selection.sketchId, null);
});


test('constraint target reflection owns geometry selection and clears only the existing tree and instance fields', () => {
 const selection=create(),p={},l={},c={},a={},s={},endpoint={arc:a,endpoint:'start'},pair=[endpoint,endpoint],annotation={};
 const target={points:[p],lines:[l],circles:[c],arcs:[a],splines:[s],arcEndpoint:endpoint,arcEndpointPair:pair};
 selection.set('annotations',[annotation]);selection.set('blockInstances',[{}]);selection.set('geometryInstances',[{}]);selection.set('instanceGeometry',{});selection.set('sketchId','S1');
 selection.applyConstraintTargets(target);
 for(const field of ['points','lines','circles','arcs','splines'])assert.equal(selection[field],target[field]);
 assert.equal(selection.arcEndpoint,endpoint);assert.equal(selection.arcEndpointPair,pair);assert.equal(selection.annotations[0],annotation);
 assert.equal(selection.blockInstances.length,0);assert.equal(selection.geometryInstances.length,0);assert.equal(selection.instanceGeometry,null);assert.equal(selection.sketchId,null);
});

test('selection scope query keeps category order/duplicates/refs and first-item versus inspection Sketch precedence', () => {
  const selection = create(), geometry = { id: 'g', sketchId: 'geometry' }, block = { id: 'b', sketchId: 'block' }, instance = { id: 'i' }, annotation = {}, hatch = {}, image = {}, constraint = {}, arc = {};
  selection.set('blockInstances', [block]); selection.set('geometryInstances', [instance]); selection.set('annotations', [annotation]); selection.set('hatches', [hatch]); selection.set('referenceImages', [image]); selection.set('dimensionConstraints', [constraint]); selection.set('constraint', constraint); selection.set('arcEndpoint', { arc });
  let items = [geometry]; const query = sandbox.window.CanvasSelection.createScopeQuery({ canvasSelection: selection, selectedGeometryItems: () => items });
  assert.deepEqual(Array.from(query.selectionItems()), [geometry, block, instance, annotation, hatch, image, constraint, constraint, arc]); assert.equal(query.selectionSketchId(), 'geometry');
  items = []; assert.equal(query.selectionSketchId(), 'block'); selection.set('inspection', { sketchId: 'inspection', targets: [] });
  items = [{ id: 'unassigned' }]; assert.equal(query.selectionSketchId(), 'inspection');
  selection.clear(); items = []; assert.equal(query.selectionSketchId(), null); assert.equal(query.selectionItems().length, 0);
});

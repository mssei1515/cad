const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
const { Point, Line, Circle, Arc, Spline } = sandbox.window.GeometrySolver;
const point = (id, x, y) => Object.assign(new Point(id, x, y), { sketchId: 'S1' });
const scoped = item => Object.assign(item, { sketchId: 'S1' });
const empty = () => ({ points: [], lines: [], circles: [], arcs: [], splines: [] });
function fixture() {
  let model = empty(), scale = 1;
  const query = sandbox.window.GeometryHitQuery.create({ currentScope: () => model, viewportScale: () => scale,
    isEditableSketchElement: item => item.sketchId === 'S1', isSelectableEndpointPoint: item => item.endpoint === true,
    isExplicitPoint: item => item.endpoint !== true });
  return { query, model: () => model, scope: value => { model = value; }, zoom: value => { scale = value; } };
}
test('endpoints have priority over later explicit points, with reverse order within each class', () => {
  const f = fixture(), a = Object.assign(point('a', 0, 0), { endpoint: true }), b = Object.assign(point('b', 1, 0), { endpoint: true }), c = point('c', 0, 0);
  f.model().points.push(a, b, c);
  assert.equal(f.query.hitPoint(0, 0), b); assert.equal(f.query.hitAnyPoint(0, 0), b);
  assert.equal(f.query.hitExplicitPoint(0, 0), c);
  b.sketchId = 'S2'; assert.equal(f.query.hitEndpointPoint(0, 0), a);
});
test('line hits prefer drawing order rather than distance and never reorder the model', () => {
  const f = fixture(), a = scoped(new Line('a', point('a1', -20, 0), point('a2', 20, 0))), b = scoped(new Line('b', point('b1', -20, 4), point('b2', 20, 4)));
  a.drawingOrder = 1; b.drawingOrder = 2; f.model().lines.push(a, b);
  assert.equal(f.query.hitLine(0, 0), b); assert.deepEqual(f.model().lines, [a, b]);
  b.sketchId = 'S2'; assert.equal(f.query.hitLine(0, 0), a);
});
test('circle and signed arc hits respect radial tolerance and sweep', () => {
  const f = fixture(), center = point('O', 0, 0), circle = scoped(new Circle('C', center, 100)), arc = scoped(new Arc('A', center, 100, 0, -Math.PI / 2));
  f.model().circles.push(circle); f.model().arcs.push(arc);
  assert.equal(f.query.hitCircle(103, 0), circle); assert.equal(f.query.hitCircle(110, 0), null);
  assert.equal(f.query.hitArc(70.71, -70.71), arc); assert.equal(f.query.hitArc(70.71, 70.71), null);
});
test('arc endpoints use reverse arc order and end before start when both are within tolerance', () => {
  const f = fixture(), a = scoped(new Arc('a', point('O', 0, 0), 2, 0, Math.PI / 2)), b = scoped(new Arc('b', point('O2', 0, 0), 2, 0, Math.PI / 2));
  f.model().arcs.push(a, b); const hit = f.query.hitArcEndpoint(0, 0);
  assert.equal(hit.arc, b); assert.equal(hit.endpoint, 'end');
  assert.ok(Math.abs(hit.point.y - 2) < 1e-8);
});
test('queries use current scope and zoom, including fitted spline distance', () => {
  const f = fixture(), p = point('P', 8, 0); f.model().points.push(p);
  assert.equal(f.query.hitPoint(0, 0), p); f.zoom(2); assert.equal(f.query.hitPoint(0, 0), null);
  const next = empty(), spline = scoped(new Spline('S', [point('p1', 0, 0), point('p2', 10, 0), point('p3', 20, 0)]));
  next.splines.push(spline); f.scope(next);
  assert.equal(f.query.hitPoint(8, 0), null); assert.equal(f.query.hitSpline(10, 3), spline); assert.equal(f.query.hitSpline(10, 4), null);
});

test('identity query gives dimensions priority and preserves their owning sketch', () => {
  const model = empty(), constraint = { name: 'Length', sketchId: 'S2' }; model.points.push(point('P', 0, 0));
  const query = sandbox.window.GeometryHitQuery.create({ currentScope: () => model, viewportScale: () => 1,
    hitDimension: (x, y, options) => { assert.equal(options.activeOnly, false); return { constraint }; },
    constraintSketchId: item => item.sketchId });
  const result = query.hitSketchIdentityElement(0, 0);
  assert.equal(result.item, constraint); assert.equal(result.sketchId, 'S2'); assert.equal(result.label, 'Length');
});
test('identity query optionally includes inactive geometry but always excludes hidden geometry', () => {
  const model = empty(), p = Object.assign(point('P', 0, 0), { sketchId: 'S2' }), block = { id: 'B', definitionId: 'D', sketchId: 'S1' };
  model.points.push(p); const flags = [];
  const query = sandbox.window.GeometryHitQuery.create({ currentScope: () => model, viewportScale: () => 1, hitDimension: () => null,
    isExplicitPoint: () => true, isSelectableEndpointPoint: () => false,
    isVisibleSketchElement: item => item.visible !== false, isEditableSketchElement: item => item.sketchId === 'S1', elementSketchId: item => item.sketchId,
    hitBlockInstance: (x, y, editableOnly) => { flags.push(editableOnly); return block; }, blockDefinitionById: () => ({ name: 'Door' }) });
  assert.equal(query.hitSketchIdentityElement(0, 0).item, block); assert.equal(flags[0], true);
  assert.equal(query.hitSketchIdentityElement(0, 0, { allowInactiveGeometry: true }).item, p);
  p.visible = false; const result = query.hitSketchIdentityElement(0, 0, { allowInactiveGeometry: true });
  assert.equal(result.label, 'Block B: Door'); assert.equal(flags.at(-1), false);
});

test('visible inactive curves expose their owning sketch without entering editable hit queries', () => {
  const model = empty();
  const circle = Object.assign(new Circle('C', point('O', 0, 0), 20), { sketchId: 'S2' });
  const arc = Object.assign(new Arc('A', point('AO', 100, 0), 20, 0, Math.PI), { sketchId: 'S2' });
  const spline = Object.assign(new Spline('S', [point('a', 200, 0), point('b', 220, 0), point('c', 240, 0)]), { sketchId: 'S2' });
  model.circles.push(circle); model.arcs.push(arc); model.splines.push(spline);
  const query = sandbox.window.GeometryHitQuery.create({ currentScope: () => model, viewportScale: () => 1,
    isEditableSketchElement: item => item.sketchId === 'S1', isVisibleSketchElement: item => item.visible !== false,
    isExplicitPoint: () => true, isSelectableEndpointPoint: () => false,
    hitDimension: () => null, hitBlockInstance: () => null, elementSketchId: item => item.sketchId });
  for (const [item, x, kind] of [[circle, 20, 'circle'], [arc, 120, 'arc'], [spline, 220, 'spline']]) {
    const hit = query.hitSketchIdentityElement(x, 0, { allowInactiveGeometry: true });
    assert.equal(hit.item, item); assert.equal(hit.kind, kind); assert.equal(hit.sketchId, 'S2');
    assert.equal(query.hitSketchIdentityElement(x, 0), null);
    item.visible = false;
    assert.equal(query.hitSketchIdentityElement(x, 0, { allowInactiveGeometry: true }), null);
  }
});

function instanceFixture() {
  const state = { scope: { blockInstances: [] }, bundles: [], scale: 1 }, calls = [];
  const bundleFor = owner => ({ instance: owner, points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [] });
  const query = sandbox.window.GeometryHitQuery.createInstances({
    currentScope: () => state.scope, viewportScale: () => state.scale,
    hitSketchAllowed: id => id !== 'blocked', isVisibleSketchId: id => id !== 'hidden',
    blockProjectionBundle: instance => state.bundles.find(bundle => bundle.instance === instance), geometryInstanceBundles: () => state.bundles,
    annotationBounds: annotation => { calls.push('annotation'); return annotation.bounds; },
    resolvedHatchBoundary: hatch => { calls.push('resolve'); return hatch.resolved; },
    isVisibleValue: value => value !== false, hatchAppearanceForDisplay: hatch => hatch.appearance || {},
    hatchContainsSelectablePoint: hatch => { calls.push('hatch'); return hatch.contains; },
  });
  return { query, state, calls, bundleFor };
}

test('instance hits use drawing order, visibility and explicit eligibility without reordering source arrays', () => {
  const f = instanceFixture(), low = { id: 'low', sketchId: 'active', drawingOrder: 0 }, high = { id: 'high', sketchId: 'blocked', drawingOrder: 2 }, hidden = { id: 'hidden', sketchId: 'hidden', drawingOrder: 3 };
  const owners = [low, high, hidden]; f.state.scope.blockInstances = owners;
  f.state.bundles = owners.map(owner => ({ ...f.bundleFor(owner), points: [point('p', 0, 0)] }));
  assert.equal(f.query.hitBlockInstance(0, 0), low); assert.equal(f.query.hitBlockInstance(0, 0, false), high);
  assert.equal(f.query.hitGeometryInstance(0, 0), low); assert.equal(f.query.hitGeometryInstance(0, 0, false), high);
  assert.deepEqual(owners, [low, high, hidden]); assert.deepEqual(f.state.bundles.map(bundle => bundle.instance), owners);
  f.state.scope = { blockInstances: [low] }; f.state.scale = 2;
  assert.equal(f.query.hitBlockInstance(5, 0), null);
  f.state.scale = 1; assert.equal(f.query.hitBlockInstance(5, 0), low);
});

test('Block and derived hits preserve their different geometry and hatch evaluation order', () => {
  const f = instanceFixture(), owner = { sketchId: 'active' }, bundle = f.bundleFor(owner);
  bundle.points.push(point('p', 0, 0)); bundle.hatches.push({ contains: true, resolved: { ok: true } });
  f.state.scope.blockInstances = [owner]; f.state.bundles = [bundle];
  assert.equal(f.query.hitBlockInstance(0, 0), owner); assert.equal(f.calls.length, 0);
  assert.equal(f.query.hitGeometryInstance(0, 0), owner); assert.deepEqual(f.calls, ['resolve', 'hatch']);
  bundle.points.length = 0; bundle.hatches[0].resolved.ok = false; f.calls.length = 0;
  assert.equal(f.query.hitBlockInstance(0, 0), null); assert.deepEqual(f.calls, ['resolve']);
  bundle.hatches.length = 0; bundle.annotations.push({ bounds: { x1: 0, y1: 0, x2: 2, y2: 2 } });
  assert.equal(f.query.hitBlockInstance(1, 1), owner); assert.equal(f.query.hitGeometryInstance(1, 1), null);
});

test('derived drag hits preserve point priority, reverse occurrence order and end before start', () => {
  const f = instanceFixture(), owner = { sketchId: 'active' }, bundle = f.bundleFor(owner);
  const first = point('first', 0, 0), last = point('last', 1, 0);
  bundle.points.push(first, last); bundle.lines.push(new Line('line', first, point('end', 30, 0)));
  const arc = new Arc('arc', point('center', 0, 0), 1, 0, Math.PI / 2); bundle.arcs.push(arc);
  f.state.bundles = [bundle];
  let hit = f.query.hitDerivedGeometryForDrag(0, 0); assert.equal(hit.kind, 'point'); assert.equal(hit.item, last); assert.equal(hit.instance, owner);
  bundle.points.length = 0; hit = f.query.hitDerivedGeometryForDrag(0, 0); assert.equal(hit.kind, 'arc-endpoint'); assert.equal(hit.item, arc); assert.equal(hit.endpoint, 'end');
  owner.sketchId = 'blocked'; assert.equal(f.query.hitDerivedGeometryForDrag(0, 0), null);
});

function dimensionFixture() {
  const state = { constraints: [], scale: 1, ordinary: true }, measured = [];
  const query = sandbox.window.GeometryHitQuery.createDimensions({
    pointInExpandedBox: sandbox.window.GeometryBounds.pointInExpandedBox,
    currentScope: () => state, viewportScale: () => state.scale, ordinarySelectionMode: () => state.ordinary,
    isActiveSketchConstraint: constraint => constraint.sketchId === 'active', isVisibleSketchId: id => id !== 'hidden',
    constraintSketchId: constraint => constraint.sketchId, targetFromConstraint: constraint => constraint.target,
    defaultDimensionForTarget: target => target.defaultDimension, isVisibleValue: value => value !== false,
    effectiveDimensionAppearance: dimension => dimension.appearance || {}, dimensionLayout: (_target, dimension) => dimension.layout,
    dimensionLabelForConstraint: constraint => constraint.label || '1', dimensionTextDrawingMetrics: () => ({ gap: 0, height: 20 }),
    dimensionTextWidth: (label, _appearance, expression) => { measured.push({ label, expression }); return 10; }, dimensionUsesExpression: constraint => Boolean(constraint.expression),
  });
  const dimension = { layout: { text: { x: 0, y: 0 }, hitA: { x: 100, y: 100 }, hitB: { x: 200, y: 100 } } };
  const make = (id, sketchId = 'active') => ({ id, sketchId, dimension, target: { id: 'target' } });
  return { query, state, measured, dimension, make };
}

test('dimension hits preserve reverse constraint order, visibility, scope eligibility and returned references', () => {
  const f = dimensionFixture(), first = f.make('first'), last = f.make('last', 'other'), hidden = f.make('hidden', 'hidden');
  f.state.constraints = [first, last, hidden];
  let hit = f.query.hitDimension(0, 0); assert.equal(hit.constraint, last); assert.equal(hit.target, last.target); assert.equal(hit.dimension, f.dimension); assert.equal(hit.part, 'label');
  f.state.ordinary = false; assert.equal(f.query.hitDimension(0, 0).constraint, first);
  assert.equal(f.query.hitDimension(0, 0, { activeOnly: false }).constraint, last);
  first.dimension = { ...f.dimension, appearance: { visible: false } }; assert.equal(f.query.hitDimension(0, 0), null);
  assert.deepEqual(f.state.constraints, [first, last, hidden]);
});

test('dimension hits distinguish line and label, use fallback dimensions and read current scale', () => {
  const f = dimensionFixture(), constraint = f.make('c');
  delete constraint.dimension; constraint.target.defaultDimension = f.dimension; f.state.constraints = [constraint];
  assert.equal(f.query.hitDimension(150, 100).part, 'line'); assert.equal(f.query.hitDimension(0, 0).part, 'label');
  assert.equal(f.query.hitDimension(30, 0), null); f.state.scale = 0.5;
  assert.equal(f.query.hitDimension(30, 0).part, 'label');
  f.state.constraints = []; assert.equal(f.query.hitDimension(0, 0), null);
});

test('rotated multiline and world-size dimension labels use text bounds and expression metrics', () => {
  const f = dimensionFixture(), constraint = f.make('c'); f.state.constraints = [constraint];
  f.dimension.layout.textAngle = Math.PI / 2; constraint.label = 'A\nB'; constraint.expression = true;
  assert.equal(f.query.hitDimension(30, 0).part, 'label'); assert.deepEqual(f.measured.at(-1), { label: 'A\nB', expression: true });
  constraint.label = 'A'; assert.equal(f.query.hitDimension(30, 0), null);
  f.dimension.appearance = { fixedDisplaySize: false }; assert.equal(f.query.hitDimension(30, 0).part, 'label');
});

function regionFixture() {
  const state = { referenceImages: [], hatches: [], ordinary: true }, resolved = [];
  const query = sandbox.window.GeometryHitQuery.createRegions({
    currentScope: () => state, ordinarySelectionMode: () => state.ordinary, allHatches: () => state.hatches,
    isVisibleSketchId: id => id !== 'hidden', isVisibleValue: value => value !== false,
    hatchAppearanceForDisplay: hatch => hatch.appearance || {}, activeSketchId: () => 'active', drawingOrderOwner: hatch => hatch.owner || hatch,
    resolvedHatchBoundary: hatch => { resolved.push(hatch); return hatch.resolved; }, hatchContainsSelectablePoint: (_hatch, result) => Boolean(result?.inside),
    referenceImageWorldToLocal: sandbox.window.ReferenceImageGeometry.referenceImageWorldToLocal,
  });
  return { query, state, resolved };
}

test('region Hatch hits use owner drawing order, scope and visibility without mutating candidate order', () => {
  const f = regionFixture();
  const first = { sketchId: 'active', drawingOrder: 2, resolved: { inside: true } };
  const projected = { sketchId: 'other', drawingOrder: 0, owner: { drawingOrder: 4 }, resolved: { inside: true } };
  const hidden = { sketchId: 'hidden', drawingOrder: 10, resolved: { inside: true } };
  f.state.hatches = [first, projected, hidden];
  assert.equal(f.query.hitHatchAt(0, 0), projected); assert.deepEqual(f.resolved, [projected]);
  f.state.ordinary = false; assert.equal(f.query.hitHatchAt(0, 0), first);
  assert.equal(f.query.hitHatchAt(0, 0, { activeOnly: false }), projected);
  projected.appearance = { visible: false }; assert.equal(f.query.hitHatchAt(0, 0, { activeOnly: false }), first);
  assert.deepEqual(f.state.hatches, [first, projected, hidden]);
});

test('region Hatch hits preserve stable ties and skip nonselectable interiors', () => {
  const f = regionFixture(), first = { sketchId: 'active', resolved: { inside: false } }, second = { sketchId: 'active', resolved: { inside: true } };
  f.state.hatches = [first, second]; assert.equal(f.query.hitHatchAt(0, 0), second); assert.deepEqual(f.resolved, [first, second]);
  first.resolved.inside = true; assert.equal(f.query.hitHatchAt(0, 0), first);
  f.state.hatches = []; assert.equal(f.query.hitHatchAt(0, 0), null);
});

test('Reference Image hits use reverse array order, transformed inclusive bounds and current eligibility', () => {
  const f = regionFixture();
  const first = { sketchId: 'active', drawingOrder: 10, x: 0, y: 0, scale: 2, rotation: Math.PI / 2, pixelWidth: 20, pixelHeight: 10 };
  const last = { ...first, sketchId: 'other', drawingOrder: 0, locked: true };
  f.state.referenceImages = [first, last]; assert.equal(f.query.hitReferenceImageAt(0, 20), last);
  assert.equal(f.query.hitReferenceImageAt(0, 20.1), null);
  f.state.ordinary = false; assert.equal(f.query.hitReferenceImageAt(0, 0), first);
  assert.equal(f.query.hitReferenceImageAt(0, 0, { activeOnly: false }), last);
  last.visible = false; assert.equal(f.query.hitReferenceImageAt(0, 0, { activeOnly: false }), first);
  first.sketchId = 'hidden'; assert.equal(f.query.hitReferenceImageAt(0, 0), null);
  assert.deepEqual(f.state.referenceImages, [first, last]);
  f.state.referenceImages = []; assert.equal(f.query.hitReferenceImageAt(0, 0), null);
});

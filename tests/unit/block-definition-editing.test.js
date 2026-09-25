const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const { Point, Line, Circle, Arc, Spline, GeometryFixedConstraint, ArcEndpointFixedConstraint, LineFixedConstraint } = sandbox.window.GeometrySolver;
const codec = sandbox.window.GeometryInstancePersistence.create({ applicationText: (_ja, en) => en });
function fixture() {
  const p1 = new Point('P1', 1, 2), p2 = new Point('P2', 3, 4), p3 = new Point('P3', 5, 6);
  const line = new Line('L1', p1, p2), circle = new Circle('C1', p1, 2), arc = new Arc('A1', p2, 3, 0, 1), spline = new Spline('SP1', [p1, p2, p3]);
  for (const item of [p1, p2, p3, line, circle, arc, spline]) Object.assign(item, { sketchId: 'S1', appearance: {}, drawingOrder: 5 });
  return { id: 'B1', name: 'Block', origin: { x: 0, y: 0 }, revision: 4, sketches: [{ id: 'S1' }], activeSketchId: 'S1',
    points: [p1, p2, p3], lines: [line], circles: [circle], arcs: [arc], splines: [spline],
    constraints: [{ point: p1, line, primitive: arc }], annotations: [], hatches: [], referenceImages: [],
    blockInstances: [{ id: 'BI1', definitionId: 'child', sketchId: 'S1', x: 0, y: 0, enabledSketchIds: ['S1'] }],
    geometryInstances: [], parameters: [{ name: 'width', expression: '2' }], nextDimensionParameterIndex: 2, nextHatchIndex: 1 };
}
function service() {
  const nested = new Point('BI1/P1', 9, 10), derived = new Point('FI1/P1', 20, 30);
  const bundle = points => ({ points, lines: [], circles: [], arcs: [], splines: [] });
  const editing = sandbox.window.BlockDefinitionEditing.create({ normalizedSketchCopy: sketch => ({ ...sketch }),
    cloneConstraintForBlock: (constraint, points, lines, primitives, origin, preserveReference) => ({
      point: points.get(constraint.point?.id), line: lines.get(constraint.line?.id), primitive: primitives.get(constraint.primitive?.id), preserveReference }),
    blockDefinitionById: () => ({ id: 'child' }), createBlockProjectionBundle: () => bundle([nested]),
    geometryInstanceBundlesForScope: () => [bundle([derived])], emptyGeometryInstanceBundle: () => bundle([]),
    normalizeGeometryInstance: codec.normalize, hatchSequence: () => 12 });
  return { editing, nested, derived };
}
test('Block copy isolates geometry and reconnects local, nested and derived constraint references', () => {
  const original = fixture(), { editing, nested, derived } = service();
  original.constraints.push({ point: nested }, { point: derived });
  const copy = editing.clone(original);
  for (const field of ['points', 'lines', 'circles', 'arcs', 'splines', 'blockInstances']) assert.notEqual(copy[field][0], original[field][0]);
  assert.equal(copy.lines[0].p1, copy.points[0]);
  assert.equal(copy.circles[0].center, copy.points[0]);
  assert.equal(copy.splines[0].fitPoints[1], copy.points[1]);
  assert.equal(copy.constraints[0].line, copy.lines[0]);
  assert.equal(copy.constraints[0].primitive, copy.arcs[0]);
  assert.equal(copy.constraints[1].point, nested); assert.equal(copy.constraints[2].point, derived);
  assert.equal(copy.constraints[0].preserveReference, true);
  copy.points[0].x = 99; copy.blockInstances[0].enabledSketchIds.push('S2'); copy.parameters[0].expression = '8';
  assert.equal(original.points[0].x, 1); assert.equal(original.blockInstances[0].enabledSketchIds.length, 1); assert.equal(original.parameters[0].expression, '2');
});
test('Block application retains existing geometry identities, reconnects new points and invalidates spline cache', () => {
  const target = fixture(), { editing } = service(), draft = editing.clone(target);
  const originals = Object.fromEntries(['points', 'lines', 'circles', 'arcs', 'splines', 'blockInstances'].map(field => [field, target[field][0]]));
  const removed = target.points[2], added = Object.assign(new Point('P4', 11, 12), { sketchId: 'S1' });
  draft.points = [draft.points[0], draft.points[1], added]; draft.lines[0].p2 = added;
  draft.splines[0].fitPoints = [draft.points[0], added]; target.splines[0]._curveCache = { stale: true };
  draft.points[0].x = 40; draft.circles[0].radiusValue = 7; draft.arcs[0].startAngle = 0.4; draft.name = 'updated';
  assert.equal(editing.apply(target, draft), target);
  for (const field of Object.keys(originals)) assert.equal(target[field][0], originals[field]);
  assert.equal(target.points.includes(removed), false);
  assert.equal(target.lines[0].p2, target.points[2]); assert.notEqual(target.points[2], added);
  assert.equal(target.splines[0].fitPoints[1], target.points[2]); assert.equal(target.splines[0]._curveCache, null);
  assert.equal(target.constraints[0].point, originals.points); assert.equal(target.constraints[0].line, originals.lines);
  assert.equal(target.circles[0].radius(), 7); assert.equal(target.arcs[0].startAngle, 0.4);
  assert.equal(target.revision, 5); assert.equal(target.nextHatchIndex, 12); assert.equal(target.name, 'updated');
});
test('Block translation moves fixed targets, placement origins and auxiliary geometry together', () => {
  const target = fixture(), { editing } = service();
  const fixed = new GeometryFixedConstraint(target.points[0]), lineFixed = new LineFixedConstraint(target.lines[0]);
  const endpoint = new ArcEndpointFixedConstraint(target.arcs[0], 'start', 6, 4);
  fixed.dimension = { x: '2', y: 3, labelX: 4, labelY: 5, offset: 8 };
  target.constraints = [fixed, lineFixed, endpoint];
  target.geometryInstances = [{ type: 'free', x: 1, y: 2, origin: { x: 3, y: 4 } }, { type: 'mirror', x: 1, y: 2 }];
  target.annotations = [{ x: 1, y: 2, start: { x: 3, y: 4 }, end: { x: 5, y: 6 } }];
  target.hatches = [{ seed: { x: 1, y: 2 } }]; target.referenceImages = [{ x: 1, y: 2 }];
  editing.translate(target, 10, -5);
  assert.deepEqual([target.points[0].x, target.points[0].y, fixed.x, fixed.y], [11, -3, 11, -3]);
  assert.deepEqual([lineFixed.p2x, lineFixed.p2y, endpoint.x, endpoint.y], [13, -1, 16, -1]);
  assert.deepEqual([fixed.dimension.x, fixed.dimension.y, fixed.dimension.labelX, fixed.dimension.labelY, fixed.dimension.offset], [12, -2, 14, 0, 8]);
  assert.deepEqual([target.geometryInstances[0].origin.x, target.geometryInstances[0].origin.y], [13, -1]);
  assert.equal(target.geometryInstances[1].x, 1);
  assert.deepEqual([target.annotations[0].start.x, target.annotations[0].start.y], [13, -1]);
  assert.equal(target.hatches[0].seed.x, 11); assert.equal(target.referenceImages[0].y, -3);
  assert.deepEqual([target.blockInstances[0].x, target.blockInstances[0].y], [10, -5]);
});

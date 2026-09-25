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
function service(overrides = {}) {
  const nested = new Point('BI1/P1', 9, 10), derived = new Point('FI1/P1', 20, 30);
  const bundle = points => ({ points, lines: [], circles: [], arcs: [], splines: [] });
  const editing = sandbox.window.BlockDefinitionEditing.create({ normalizedSketchCopy: sketch => ({ ...sketch }),
    cloneConstraintForBlock: (constraint, points, lines, primitives, origin, preserveReference) => ({
      point: points.get(constraint.point?.id), line: lines.get(constraint.line?.id), primitive: primitives.get(constraint.primitive?.id), preserveReference }),
    blockDefinitionById: () => ({ id: 'child' }), createBlockProjectionBundle: () => bundle([nested]),
    geometryInstanceBundlesForScope: () => [bundle([derived])], emptyGeometryInstanceBundle: () => bundle([]),
    normalizeGeometryInstance: codec.normalize, hatchSequence: () => 12, ...overrides });
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
test('selection conversion rebases geometry and annotations, freezes dimension formulas and allocates a local namespace', () => {
  const selection = fixture(), { DistanceConstraint } = sandbox.window.GeometrySolver;
  const driving = Object.assign(new DistanceConstraint(selection.points[0], selection.points[1], 42), { parameterName: 'width', expression: '="sourceWidth" * 2' });
  const measured = Object.assign(new DistanceConstraint(selection.points[0], selection.points[1], 10), { parameterName: 'measured', readOnlyDimension: true });
  selection.constraints = [driving, measured];
  selection.annotations = [{ id: 'AN1', type: 'leader', sketchId: 'SOURCE', x: 12, y: 22, start: { x: 13, y: 23 }, elbow: { x: 14, y: 24 }, end: { x: 15, y: 25 }, style: {} }];
  selection.hatches = [{ id: 'H5', sketchId: 'SOURCE', seed: { x: 16, y: 26 }, boundaryLoops: [], appearance: {} }];
  const parameters = sandbox.window.ParameterNamespace.create({ currentParameterNamespace: () => null, applicationText: (_ja, en) => en });
  let allocated = 0;
  const { editing } = service({ nextDefinitionId: () => `B${++allocated}`,
    isDimensionConstraint: sandbox.window.DimensionQueries.isDimensionConstraint, isReadOnlyDimension: sandbox.window.DimensionQueries.isReadOnlyDimension,
    numericDimensionExpression: parameters.numericDimensionExpression, ensureParameterNamespace: parameters.ensureParameterNamespace,
    cloneConstraintForBlock: (source, points, _lines, _primitives, origin, preserveReference) => {
      assert.equal(origin.x, 10); assert.equal(origin.y, 20); assert.equal(preserveReference, undefined);
      return Object.assign(new DistanceConstraint(points.get(source.p1.id), points.get(source.p2.id), source.target), {
        parameterName: source.parameterName, expression: source.expression, readOnlyDimension: source.readOnlyDimension });
    } });
  const draft = editing.fromSelection(selection, { x: 10, y: 20 }, 'New');
  assert.equal(draft.id, 'B1'); assert.equal(draft.activeSketchId, 'S1');
  assert.deepEqual([draft.points[0].x, draft.points[0].y, draft.lines[0].sketchId], [-9, -18, 'S1']);
  assert.equal(draft.constraints[0].p1, draft.points[0]);
  assert.equal(draft.constraints[0].expression, '42'); assert.equal(draft.constraints[0].parameterName, 'd1');
  assert.equal(draft.constraints[1].parameterName, 'd2'); assert.equal(draft.constraints[1].expression, undefined);
  assert.equal(draft.parameters.length, 0); assert.equal(draft.nextDimensionParameterIndex, 3);
  assert.deepEqual([draft.annotations[0].x, draft.annotations[0].start.y, draft.hatches[0].seed.x], [2, 3, 6]);
  assert.equal(draft.nextHatchIndex, 6);
  assert.deepEqual([draft.blockInstances[0].x, draft.blockInstances[0].y], [-10, -20]);
  assert.equal(selection.annotations[0].x, 12); assert.equal(selection.points[0].x, 1); assert.equal(driving.parameterName, 'width');
  assert.equal(driving.expression, '="sourceWidth" * 2');
});
test('failed selection conversion does not allocate a definition id and empty drafts have independent Sketch state', () => {
  let allocated = 0;
  const { editing } = service({ nextDefinitionId: () => `B${++allocated}`, cloneConstraintForBlock: () => { throw new Error('unsupported constraint'); } });
  assert.throws(() => editing.fromSelection(fixture(), { x: 0, y: 0 }, 'fail'), /unsupported/);
  assert.equal(allocated, 0);
  const first = editing.empty('first'), second = editing.empty('second');
  assert.equal(first.id, 'B1'); assert.equal(second.id, 'B2');
  assert.equal(first.sketches[0].kind, 'root'); assert.equal(first.sketches[1].parentSketchId, first.sketches[0].id);
  first.sketches[1].appearance.color = '#123456';
  assert.equal(second.sketches[1].appearance.color, undefined);
  assert.equal(first.constraints.length, 0); assert.equal(first.nextDimensionParameterIndex, 1);
});


test('Block history snapshots retain detached restoration geometry and a stable value signature', () => {
  const { editing } = service();
  const snapshots = sandbox.window.BlockHistorySnapshot.create({ cloneDefinition: editing.clone,
    serializeConstraint: constraint => ({ type: 'test', point: constraint.point.id }),
    decorateSerializedConstraint: data => data });
  const original = fixture(), first = snapshots.capture(original);
  assert.notEqual(first.definition, original); assert.notEqual(first.definition.points[0], original.points[0]);
  assert.equal(first.definition.constraints[0].point, first.definition.points[0]);
  assert.equal(snapshots.capture(original).signature, first.signature);
  original.revision += 1; original.points[0].temporaryCache = { ignored: true };
  assert.equal(snapshots.capture(original).signature, first.signature);
  original.points[0].x = 99;
  assert.notEqual(snapshots.capture(original).signature, first.signature);
  assert.equal(first.definition.points[0].x, 1);
  first.definition.points[0].x = -1;
  assert.equal(original.points[0].x, 99);
});

test('Block history signature preserves reference metadata and normalized allocation counters', () => {
  const original = fixture(); original.parentDefinitionId = 'parent'; original.nextHatchIndex = 8;
  original.constraints = [{ sketchId: 'S2', reference: true, referenceSketchId: 'S3' }, { unsupported: true }];
  const snapshots = sandbox.window.BlockHistorySnapshot.create({ cloneDefinition: source => source,
    serializeConstraint: source => source.unsupported ? null : { type: 'distance' },
    decorateSerializedConstraint: data => data && ({ ...data, parameterName: 'd1', expression: '25' }) });
  const data = JSON.parse(snapshots.capture(original).signature);
  assert.equal(data.parentDefinitionId, 'parent'); assert.equal(data.nextHatchIndex, 8);
  assert.equal(data.nextDimensionParameterIndex, 2); assert.equal(data.constraints.length, 1);
  assert.deepEqual(data.constraints[0], { type: 'distance', parameterName: 'd1', expression: '25', sketchId: 'S2', reference: true, referenceSketchId: 'S3' });
  assert.equal(data.lines[0].p1, 'P1'); assert.equal(data.splines[0].definitionMode, 'fit');
});

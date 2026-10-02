const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const { SketchMove, SketchMoveCommand, GeometrySolver: G, ConstraintReferences, DrawingOrder } = sandbox.window;
function fixture() {
  let scope = Object.fromEntries([...SketchMove.fields, 'constraints', 'geometryInstances'].map(field => [field, []]));
  scope.activeSketchId = 'S1';
  scope.sketches = [{ id: 'ROOT', kind: 'root' }, { id: 'S1', kind: 'sketch', parentSketchId: 'ROOT' },
    { id: 'S2', name: 'Destination', kind: 'sketch', parentSketchId: 'ROOT', visible: false },
    { id: 'S3', kind: 'sketch', parentSketchId: 'S1' }, { id: 'S4', kind: 'sketch', parentSketchId: 'S2' }];
  const selected = Object.fromEntries(SketchMove.fields.map(field => [field, []])), extra = [];
  const resolve = ref => [...SketchMove.fields.flatMap(field => scope[field]), ...extra].find(item => item.id === sandbox.window.GeometryRef.id(ref));
  const refs = ConstraintReferences.create({ resolveGeometryRef: resolve });
  const query = SketchMove.create({ currentScope: () => scope, activeSketchId: () => scope.activeSketchId,
    constraintGraphNodes: refs.constraintGraphNodes, constraintSketchId: c => c.sketchId,
    resolveGeometryRef: resolve, geometryInstanceDependencyRefs: refs.geometryInstanceDependencyRefs,
    isReferenceSourceSketchId: (source, subject) => sandbox.window.SketchHierarchy.isReferenceSourceSketchId(scope.sketches, source, subject),
    applicationText: (_ja, en) => en });
  const point = (id, x = 0, y = 0, sketchId = 'S1') => { const p = Object.assign(new G.Point(id, x, y), { sketchId }); scope.points.push(p); return p; };
  const line = (id, p1, p2, sketchId = 'S1') => { const l = Object.assign(new G.Line(id, p1, p2), { sketchId }); scope.lines.push(l); return l; };
  const ready = () => DrawingOrder.ensureDrawingOrderState(scope);
  const apply = target => { ready(); return query.apply(selected, target, () => {}); };
  return { get scope() { return scope; }, selected, query, point, line, extra, apply, ready, changeScope: value => { scope = value; } };
}
test('ownership transfer preserves identities, precision, fixed values, IDs and individual appearance', () => {
  const f = fixture(), a = f.point('P1', 0.123456789), b = f.point('P2', 10.987654321), l = f.line('L1', a, b);
  a.fixed = true; l.appearance = { color: '#112233' }; l.construction = true;
  const fixed = Object.assign(new G.LineFixedConstraint(l), { sketchId: 'S1' });
  f.scope.constraints.push(fixed); f.selected.lines.push(l);
  const before = JSON.stringify([a.x, b.x, fixed.p1x, fixed.p2x, l.appearance]);
  assert.equal(f.apply('S2').ok, true);
  assert.equal(f.scope.lines[0], l); assert.equal(f.scope.constraints[0], fixed);
  for (const item of [a, b, l, fixed]) assert.equal(item.sketchId, 'S2');
  assert.equal(JSON.stringify([a.x, b.x, fixed.p1x, fixed.p2x, l.appearance]), before);
  assert.equal(a.fixed, true); assert.equal(l.construction, true);
  assert.equal(f.scope.activeSketchId, 'S1'); assert.equal(f.scope.sketches[2].visible, false);
});
test('shared points report unselected geometry and do not mutate the model', () => {
  const f = fixture(), a = f.point('P1'), b = f.point('P2', 10), c = f.point('P3', 20);
  const l = f.line('L1', a, b); f.line('L2', b, c); f.selected.lines.push(l);
  const before = JSON.stringify(f.scope);
  assert.match(f.query.collect(f.selected).reason, /L2/);
  assert.equal(JSON.stringify(f.scope), before);
});
test('ordinary constraints require all operands but need not be selected separately', () => {
  const f = fixture(), a = f.point('P1'), b = f.point('P2', 10);
  const c = Object.assign(new G.DistanceConstraint(a, b, 10), { sketchId: 'S1', parameterName: 'length', expression: '10' });
  f.scope.constraints.push(c); f.selected.points.push(a);
  assert.match(f.query.collect(f.selected).reason, /P2/);
  f.selected.points.push(b); assert.equal(f.apply('S2').ok, true);
  assert.equal(c.sketchId, 'S2'); assert.equal(c.parameterName, 'length'); assert.equal(c.expression, '10');
});
test('valid ancestor references retain their roles and reference metadata follows a moved source', () => {
  const f = fixture(), ancestor = f.point('P1'), child = f.point('P2', 0, 0, 'S3');
  f.scope.sketches[3].parentSketchId = 'S2';
  const c = Object.assign(new G.CoincidentConstraint(child, ancestor), { sketchId: 'S3', reference: true, referenceSketchId: 'S1' });
  f.scope.constraints.push(c); f.selected.points.push(ancestor);
  assert.equal(f.apply('S2').ok, true);
  assert.equal(c.sketchId, 'S3'); assert.equal(c.referenceSketchId, 'S2'); assert.equal(c.reference, true);
});
test('moving a constrained subject can preserve an ancestor reference or reject a sibling destination', () => {
  const f = fixture(), ancestor = f.point('P1', 0, 0, 'ROOT'), local = f.point('P2');
  ancestor.sketchId = 'S2'; f.scope.sketches[1].parentSketchId = 'S2'; f.scope.sketches[3].parentSketchId = 'S2';
  const c = Object.assign(new G.CoincidentConstraint(local, ancestor), { sketchId: 'S1', reference: true, referenceSketchId: 'S2' });
  f.scope.constraints.push(c); f.selected.points.push(local);
  const plan = f.query.collect(f.selected);
  assert.equal(f.query.destination(plan, 'S3').ok, true);
  assert.equal(f.query.destination(plan, 'S2').ok, false);
  assert.equal(f.apply('S3').ok, true); assert.equal(c.sketchId, 'S3'); assert.equal(c.referenceSketchId, 'S2');
});
test('read-only ancestor measurements retain their owner and reject invalid ancestry', () => {
  const f = fixture(), a = f.point('P1'), b = f.point('P2', 10);
  const c = Object.assign(new G.DistanceConstraint(a, b, 10), { sketchId: 'S3', readOnlyDimension: true, referenceSketchId: 'S1' });
  f.scope.constraints.push(c); f.selected.points.push(a, b);
  assert.equal(f.query.destination(f.query.collect(f.selected), 'S2').ok, false);
  f.scope.sketches[3].parentSketchId = 'S2';
  assert.equal(f.apply('S2').ok, true); assert.equal(c.sketchId, 'S3'); assert.equal(c.referenceSketchId, 'S2');
});
test('fills and leaders require complete paired selection in both directions', () => {
  const f = fixture(), a = f.point('P1'), circle = Object.assign(new G.Circle('C1', a, 10), { sketchId: 'S1' });
  f.scope.circles.push(circle);
  const hatch = { id: 'H1', sketchId: 'S1', boundaryLoops: [{ role: 'outer', spans: [{ source: { kind: 'circle', path: ['C1'] }, fullCircle: true }] }] };
  const leader = { id: 'N1', type: 'leader', sketchId: 'S1', geometryRef: { kind: 'circle', path: ['C1'] } };
  f.scope.hatches.push(hatch); f.scope.annotations.push(leader);
  f.selected.hatches.push(hatch); assert.match(f.query.collect(f.selected).reason, /C1/);
  f.selected.hatches.length = 0; f.selected.circles.push(circle); assert.match(f.query.collect(f.selected).reason, /H1/);
  f.selected.hatches.push(hatch); assert.match(f.query.collect(f.selected).reason, /N1/);
  f.selected.annotations.push(leader); assert.equal(f.apply('S2').ok, true);
  for (const item of [a, circle, hatch, leader]) assert.equal(item.sketchId, 'S2');
});
test('derived references remain valid only within their permitted sketch relationship', () => {
  const f = fixture(), p = f.point('P1'); f.selected.points.push(p);
  const instance = { id: 'SPI1', type: 'sketchProjection', sketchId: 'S3', sources: [{ kind: 'point', path: ['P1'] }] };
  f.scope.geometryInstances.push(instance);
  assert.match(f.query.destination(f.query.collect(f.selected), 'S2').reason, /SPI1/);
  f.scope.sketches[3].parentSketchId = 'S2'; assert.equal(f.query.destination(f.query.collect(f.selected), 'S2').ok, true);
  instance.type = 'free'; assert.equal(f.query.destination(f.query.collect(f.selected), 'S2').ok, false);
});
test('Block projection references move with their whole owning instance', () => {
  const f = fixture(), block = { id: 'BI1', sketchId: 'S1', fixed: true }, p = f.point('P1');
  f.scope.blockInstances.push(block);
  const projected = { id: 'BI1/P1', sketchId: 'S1', blockInstance: block, blockProjection: true };
  f.extra.push(projected);
  const c = Object.assign(new G.CoincidentConstraint(p, projected), { sketchId: 'S1' }); f.scope.constraints.push(c);
  f.selected.blockInstances.push(block); assert.match(f.query.collect(f.selected).reason, /P1/);
  f.selected.points.push(p); assert.equal(f.apply('S2').ok, true); assert.equal(c.sketchId, 'S2'); assert.equal(block.fixed, true);
});
test('mixed placement objects and drawing order append at the destination front', () => {
  const f = fixture(), a = f.point('P1'), b = f.point('P2', 10), c = f.point('P3', 20), d = f.point('P4', 30);
  const l1 = f.line('L1', a, b), l2 = f.line('L2', c, d), existing = f.line('L3', f.point('P5', 0, 0, 'S2'), f.point('P6', 10, 0, 'S2'), 'S2');
  const image = { id: 'IMG1', sketchId: 'S1', locked: true }, text = { id: 'N1', sketchId: 'S1', type: 'text', expression: '1' };
  f.scope.referenceImages.push(image); f.scope.annotations.push(text);
  f.ready(); f.selected.lines.push(l2, l1); f.selected.referenceImages.push(image); f.selected.annotations.push(text);
  assert.equal(f.apply('S2').ok, true);
  assert.deepEqual(Array.from(DrawingOrder.orderedItems(f.scope, 'S2'), item => item.id), [existing.id, l1.id, l2.id]);
  assert.equal(image.sketchId, 'S2'); assert.equal(image.locked, true); assert.equal(text.expression, '1');
});
test('refresh failure restores ownership, reference metadata, order and the constraint collection', () => {
  const f = fixture(), p = f.point('P1'); f.selected.points.push(p); f.ready();
  const before = JSON.stringify(f.scope), original = f.scope.constraints;
  const result = f.query.apply(f.selected, 'S2', () => { f.scope.constraints = []; throw Error('refresh'); });
  assert.equal(result.ok, false); assert.equal(f.scope.constraints, original); assert.equal(JSON.stringify(f.scope), before);
});
test('foreign, unsupported and stale destination selections are rejected', () => {
  const f = fixture(), p = f.point('P1'); f.selected.points.push(p);
  const plan = f.query.collect(f.selected);
  for (const target of ['ROOT', 'S1', 'missing']) assert.equal(f.query.destination(plan, target).ok, false);
  assert.equal(f.query.collect({ ...f.selected, geometryInstances: [{}] }).ok, false);
  assert.equal(f.query.collect({ points: [{ id: 'foreign', sketchId: 'S1' }] }).ok, false);
  f.scope.activeSketchId = 'S2'; assert.equal(f.query.destination(plan, 'S3').ok, false);
});
test('destination command preserves selection on cancel, commits one history entry and resets on scope changes', () => {
  const f = fixture(), p = f.point('P1'); f.selected.points.push(p); f.ready();
  const history = [];
  const command = SketchMoveCommand.create({ currentScope: () => f.scope, activeSketchId: () => f.scope.activeSketchId,
    selection: f.selected, query: f.query, prepare() {}, refresh() {}, clearSelection: () => { f.selected.points.length = 0; },
    updateUI() {}, draw() {}, setHint() {}, recordHistory: label => history.push(label), applicationText: (_ja, en) => en });
  assert.equal(command.start(), true); assert.equal(command.state().canCommit, false);
  assert.equal(command.choose('ROOT'), false); assert.equal(command.choose('S2'), true);
  assert.equal(command.cancel(), true); assert.equal(f.selected.points[0], p); assert.equal(p.sketchId, 'S1');
  command.start(); command.choose('S2'); assert.equal(command.commit(), true);
  assert.equal(history.length, 1); assert.equal(f.selected.points.length, 0); assert.equal(command.active, false);
  p.sketchId = 'S1'; f.selected.points.push(p); command.start();
  f.changeScope({ ...f.scope }); assert.equal(command.active, false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({ window: {}, structuredClone });
for (const file of ['geometry/geometry_kernel', 'geometry/geometry_ref', 'geometry/spline_geometry', 'solver/constraint_solver', 'geometry/pattern_instance_model', 'geometry/objects', 'geometry/instance_projection', 'commands/geometry_instance_command', 'commands/derived_instance_editing']) vm.runInContext(fs.readFileSync(`src/${file}.js`, 'utf8'), ctx);
const M = ctx.window.PatternInstanceModel, G = ctx.window.GeometrySolver;
const ref = (kind, id) => ({ kind, path: id.split('@') });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function fixture() {
  const p = Object.assign(new G.Point('P1', 20, 10), { sketchId: 'S1' });
  const q = Object.assign(new G.Point('P2', 40, 10), { sketchId: 'S1' });
  const line = Object.assign(new G.Line('L1', p, q), { sketchId: 'S1' });
  const values = new Map([p, q, line].map(item => [item.id, item]));
  const resolve = r => r && values.get(r.path.join('@'));
  const instance = M.createDraft({ id: 'FI1', sketchId: 'S1', sources: [ref('line', 'L1')], appearanceOverride: {} });
  instance.anchor.relation = { kind: 'lineMidpoint', target: ref('line', 'L1') }; instance.x = 30; instance.y = 40;
  return { instance, resolve, p, q, line };
}
test('linear count includes source, accepts zero offset, and anchor edits recalculate every copy', () => {
  const f = fixture(), i = f.instance; M.resize(i, 3);
  near(M.transform(i, f.p, 1, f.resolve).y, 40); near(M.transform(i, f.p, 2, f.resolve).y, 70);
  i.anchor.relation = { kind: 'point', target: ref('point', 'P1') };
  near(M.transform(i, f.p, 1, f.resolve).x, 30); near(M.transform(i, f.p, 2, f.resolve).x, 40);
  i.x = f.p.x; i.y = f.p.y; assert.equal(M.error(i, f.resolve), ''); near(M.transform(i, f.q, 2, f.resolve).x, 40);
  assert.equal(f.p.x, 20); assert.equal(f.q.x, 40);
});
test('source point relation is limited to copied elements, including their defining points', () => {
  const f = fixture(); assert.ok(M.sourceContains(f.instance, ref('point', 'P1'), f.resolve));
  const circle = new G.Circle('C1', f.p, 5), circular = { ...f.instance, sources: [ref('circle', 'C1')] };
  const resolveCircle = r => r?.kind === 'circle' ? circle : f.resolve(r);
  assert.equal(M.sourceContains(circular, ref('point', 'P1'), resolveCircle), false);
  circular.sources.push(ref('point', 'P1'));
  assert.equal(M.sourceContains(circular, ref('point', 'P1'), resolveCircle), true);
  assert.equal(M.relationFromSnap(f.instance, { data: { point: new G.Point('P9', 0, 0) } }, item => ref('point', item.id), f.resolve), null);
  const relation = M.relationFromSnap(f.instance, { data: { line: f.line, midpoint: true } }, item => ref('line', item.id), f.resolve);
  assert.equal(relation.kind, 'lineMidpoint');
  f.q.x = 80; near(M.anchorPoint(f.instance, f.resolve).x, 50); assert.equal(f.p.x, 20);
});
test('circular positive angles turn counterclockwise on screen and rotate the shape', () => {
  const f = fixture(), i = f.instance; i.anchor.relation = { kind: 'point', target: ref('point', 'P1') };
  i.placement = { kind: 'circular', angleStep: Math.PI / 2, angleMode: 'numeric', angleSign: 1 }; M.resize(i, 6);
  const a = M.transform(i, f.q, 1, f.resolve); near(a.x, 20); near(a.y, -10);
  const b = M.transform(i, f.q, 4, f.resolve); near(b.x, f.q.x); near(b.y, f.q.y);
  near(M.transform(i, f.q, 5, f.resolve).y, -10);
  i.placement.angleStep = -Math.PI / 2; i.placement.angleSign = -1; near(M.transform(i, f.q, 1, f.resolve).y, 30);
});
test('forward and inverse mapping preserve reflected rotated shapes for both patterns', () => {
  for (const kind of ['linear', 'circular']) for (const reflected of [false, true]) {
    const f = fixture(), i = f.instance; i.reflected = reflected; i.rotation = 0.7;
    if (kind === 'circular') i.placement = { kind, angleStep: -0.8, angleMode: 'constraint', angleSign: -1 };
    for (const n of [1, 2, 7]) { const p = M.transform(i, f.q, n, f.resolve), q = M.transform(i, p, n, f.resolve, true); near(q.x, f.q.x); near(q.y, f.q.y); }
  }
});
test('obsolete synchronized format is rejected', () => { assert.throws(() => M.normalize({ type: 'free' }), /同期インスタンス/); });
test('copy keys survive growth/shrink and numeric angle intervals are excluded from solve variables', () => {
  const f = fixture(), i = f.instance; i.occurrences = ['']; M.resize(i, 4); assert.deepEqual([...i.occurrences], ['', '1', '2']); M.resize(i, 3); assert.deepEqual([...i.occurrences], ['', '1']);
  assert.deepEqual(Array.from(M.variables(i), v => v.prop).sort(), ['x', 'y']); i.rotationLocked = false; assert.ok(M.variables(i).some(v => v.prop === 'rotation'));
  i.placement = { kind: 'circular', angleStep: -.5, angleMode: 'numeric', angleSign: -1 }; assert.equal(M.variables(i).length, 1);
  i.placement.angleMode = 'constraint'; const v = M.variables(i).find(v => v.prop === 'angleStep'); assert.ok(v.max < 0); assert.ok(v.min > -2 * Math.PI);
});
test('midpoint constraints stay live and interval constraints use the shared scalar', () => {
  const f = fixture(), p = new G.Point('P3', 30, 10), c = new G.LineMidpointCoincidentConstraint(p, f.line);
  assert.deepEqual([...c.rawError()], [0, 0]); f.q.x = 60; assert.deepEqual([...c.rawError()], [-10, 0]);
  f.instance.type = 'circularPattern'; f.instance.placement = { kind: 'circular', angleStep: .6, angleMode: 'constraint', angleSign: 1 };
  const anchor = { id: 'FI1@anchor', derivedInstance: f.instance }, interval = new G.InstanceAngleIntervalConstraint(anchor, .6);
  near(interval.rawError(), 0); f.instance.placement.angleStep = .8; near(interval.rawError(), .2);
});
test('new draft requires a source anchor, permits circular completion without a destination, and cancel leaves no model mutation', () => {
  const f = fixture(); let mode = 'select', history = 0; const scope = { geometryInstances: [] };
  const command = ctx.window.GeometryInstanceCommand.create({ selectedItemsForGeometryInstance: () => [f.line], cancelConstraintTargetCommand() {}, cancelPendingCommand() {}, canCreateInActiveSketch: () => true,
    geometryRefForItem: item => ref(item instanceof G.Point ? 'point' : 'line', item.id), geometryRefsEqual: M.sameRef, elementSketchId: item => item.sketchId, isVisibleSketchElement: () => true,
    clearSelection() {}, previewFreeId: () => 'FI1', nextInstanceId: () => 'FI1', activeSketchId: () => 'S1', getMode: () => mode, setMode: v => mode = v,
    updateToolbar() {}, updateUI() {}, draw() {}, setHint() {}, applicationText: s => s, currentScope: () => scope, recordHistory: () => history++, canvasSelection: { set() {} }, resolveGeometryRef: f.resolve });
  command.start("circularPattern"); assert.equal(command.canFinish(), false); assert.equal(command.placeFree({ x: 0, y: 0 }, null), false);
  command.placeFree({ x: 30, y: 10 }, { data: { line: f.line, midpoint: true } }); assert.equal(command.canFinish(), true);
  command.cancel(); assert.equal(history, 0); assert.equal(scope.geometryInstances.length, 0);
  command.start("circularPattern"); command.placeFree({ x: 30, y: 10 }, { data: { line: f.line, midpoint: true } }); assert.equal(command.finish(), true); assert.equal(history, 1);
});
function editor(success = true) {
  const f = fixture(); f.instance.placementPointDefined = true; M.resize(f.instance, 3);
  const scope = { points: [f.p, f.q], lines: [f.line], circles: [], arcs: [], splines: [], geometryInstances: [f.instance], constraints: [], annotations: [], hatches: [] };
  const projection = ctx.window.InstanceProjection.create({ elementSketchId: item => item.sketchId, applicationText: s => s });
  let histories = 0, restored = 0;
  const editing = ctx.window.DerivedInstanceEditing.create({ currentScope: () => scope,
    snapshotModelState: () => structuredClone(f.instance), restoreModelState: snapshot => { Object.assign(f.instance, snapshot); restored++; },
    geometryInstanceBundle: instance => projection.geometryInstanceBundlesForScope(scope).find(bundle => bundle.instance === instance),
    geometryInstanceBundlesForScope: projection.geometryInstanceBundlesForScope, blockProjectionBundles: () => [],
    serializeModel: () => ({ ...scope, constraints: scope.constraints.map(c => ({ line: c.line?.id || c.line })) }),
    geometryInstanceSourceObjects: () => new Set([f.p, f.q, f.line]), resolveGeometryRef: f.resolve, rebind() {}, addPointSnapConstraints() {},
    stabilize: (_id, options) => { assert.equal(options.variableAllowed({ object: f.p, prop: 'x' }), false); return { success, result: { errorNorm: success ? 0 : 1 } }; },
    acceptError: 1e-5, setHint() {}, recordHistory: () => histories++, updateUI() {}, draw() {} });
  return { ...f, scope, editing, histories: () => histories, restored: () => restored };
}
test('referenced copy reduction is rejected atomically; surviving keys persist after an unreferenced reduction', () => {
  const f = editor(), before = structuredClone(f.instance); f.scope.constraints.push({ line: 'FI1@2@L1' });
  assert.equal(f.editing.change(f.instance, 'count', '2'), false); assert.deepEqual(structuredClone(f.instance), before); assert.equal(f.histories(), 0);
  f.scope.constraints.length = 0; assert.equal(f.editing.change(f.instance, 'count', '2'), true); assert.deepEqual([...f.instance.occurrences], ['1']); assert.equal(f.histories(), 1);
});
test('failed unified property edits restore the complete model and record no history', () => {
  const f = editor(false), before = structuredClone(f.instance);
  assert.equal(f.editing.change(f.instance, 'rotation', '25'), false); assert.deepEqual(structuredClone(f.instance), before); assert.equal(f.histories(), 0); assert.equal(f.restored(), 1);
});
test('rotation lock and interval mode changes preserve configured angles', () => {
  const f = editor(); f.instance.rotation = .4;
  assert.equal(f.editing.change(f.instance, 'rotationLocked', false), true); near(f.instance.rotation, .4);
  f.instance.type = 'circularPattern'; f.instance.placement = { kind: 'circular', angleStep: -.7, angleMode: 'numeric', angleSign: -1 };
  assert.equal(f.editing.change(f.instance, 'angleMode', 'constraint'), true); near(f.instance.placement.angleStep, -.7);
});

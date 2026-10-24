const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({ window: {}, structuredClone });
for (const file of ['geometry/geometry_kernel', 'geometry/geometry_ref', 'geometry/spline_geometry', 'solver/constraint_solver', 'geometry/pattern_instance_model', 'geometry/objects', 'geometry/instance_projection', 'commands/geometry_instance_command', 'commands/derived_instance_editing', 'commands/instance_source_command', 'editing/selection', 'application/derived_instance_feature']) vm.runInContext(fs.readFileSync(`src/${file}.js`, 'utf8'), ctx);
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
test('copy keys survive growth/shrink and circular angles are always solver variables', () => {
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
function editor(success = true, build = options => ctx.window.DerivedInstanceEditing.create(options)) {
  const f = fixture(); f.instance.placementPointDefined = true; M.resize(f.instance, 3);
  const scope = { points: [f.p, f.q], lines: [f.line], circles: [], arcs: [], splines: [], geometryInstances: [f.instance], constraints: [], annotations: [], hatches: [] };
  const projection = ctx.window.InstanceProjection.create({ elementSketchId: item => item.sketchId, applicationText: s => s });
  let histories = 0, restored = 0;
  const editing = build({ currentScope: () => scope,
    snapshotModelState: () => structuredClone(f.instance), restoreModelState: snapshot => { Object.assign(f.instance, snapshot); restored++; },
    geometryInstanceBundle: instance => projection.geometryInstanceBundlesForScope(scope).find(bundle => bundle.instance === instance),
    geometryInstanceBundlesForScope: projection.geometryInstanceBundlesForScope, blockProjectionBundles: () => [],
    serializeModel: () => ({ ...scope, constraints: scope.constraints.map(c => ({ line: c.line?.id || c.line })) }),
    geometryInstanceSourceObjects: () => new Set([f.p, f.q, f.line]), resolveGeometryRef: f.resolve, rebind() {}, addPointSnapConstraints() {},
    stabilize: (_id, options) => { assert.equal(options.variableAllowed({ object: f.p, prop: 'x' }), false); return { success, result: { errorNorm: success ? 0 : 1 } }; },
    acceptError: 1e-5, setHint() {}, recordHistory: () => histories++, updateUI() {}, draw() {} }, f);
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
test('linear lock edits preserve angles and obsolete circular mode edits are refused', () => {
  const f = editor(); f.instance.rotation = .4;
  assert.equal(f.editing.change(f.instance, 'rotationLocked', false), true); near(f.instance.rotation, .4);
  f.instance.type = 'circularPattern'; f.instance.placement = { kind: 'circular', angleStep: -.7, angleMode: 'numeric', angleSign: -1 };
  assert.equal(f.editing.change(f.instance, 'angleMode', 'constraint'), false); near(f.instance.placement.angleStep, -.7);
});

test('linear occurrence angles accumulate while the placement vector stays constant', () => {
  const f = fixture(), i = f.instance; i.anchor.relation = { kind: 'point', target: ref('point','P1') };
  i.x = 50; i.y = 10; i.rotation = Math.PI / 6; M.resize(i,4);
  for (const n of [1,2,3]) {
    const anchor = M.transform(i,f.p,n,f.resolve), output = M.transform(i,f.q,n,f.resolve);
    near(anchor.x,20+n*30); near(anchor.y,10);
    near(output.x,anchor.x+20*Math.cos(n*Math.PI/6)); near(output.y,10+20*Math.sin(n*Math.PI/6));
    const inverse=M.transform(i,output,n,f.resolve,true); near(inverse.x,f.q.x); near(inverse.y,f.q.y);
  }
  near(f.q.x,40); near(f.q.y,10);
});
test('anchor descriptions retain nested canonical references and relation roles', () => {
  const i = fixture().instance;
  i.anchor.relation = {kind:'lineEndpoint',target:ref('line','BI7@SPI5@L52'),endpoint:'end'};
  assert.equal(M.anchorLabel(i),'線の端点: BI7@SPI5@L52');
  i.anchor.relation.kind='lineMidpoint'; assert.equal(M.anchorLabel(i),'線の中点: BI7@SPI5@L52');
});

test('circular interval alone determines posture with fixed sources', () => {
 const f=fixture(), i=M.createDraft({id:'PI9',type:'circularPattern',sketchId:'S1',sources:[ref('line','L1')]});
 i.anchor.relation={kind:'point',target:ref('point','P1')}; f.p.fixed=f.q.fixed=true;
 const scope={points:[f.p,f.q],lines:[f.line],circles:[],arcs:[],splines:[],geometryInstances:[i],constraints:[]};
 const provider=ctx.window.InstanceProjection.create({elementSketchId:item=>item.sketchId,applicationText:ja=>ja});
 const bundle=provider.geometryInstanceBundlesForScope(scope)[0];
 scope.constraints=[new G.InstanceAngleIntervalConstraint(bundle.controlPoints[0],Math.PI/3)];
 const before={px:f.p.x,py:f.p.y,qx:f.q.x,qy:f.q.y};
 const result=new G.ConstraintSolver(scope).solve(); assert.equal(result.success,true);
 assert.ok(Math.abs(i.placement.angleStep-Math.PI/3)<1e-6);
 assert.equal("rotation" in i,false);
 assert.ok(Math.abs(Math.atan2(bundle.lines[0].dy(),bundle.lines[0].dx())+Math.PI/3)<1e-6);
 assert.deepEqual({px:f.p.x,py:f.p.y,qx:f.q.x,qy:f.q.y},before);
 assert.equal('rotationLocked' in i,false); assert.equal('angleMode' in i.placement,false);
});

test('old circular posture is discarded while retaining interval and source references', () => {
 const i=M.createDraft({id:'PI7',type:'circularPattern',sources:[ref('line','L1')]});
 i.rotation=.4; i.rotationLocked=true; i.placement.angleMode='numeric'; i.placement.angleStep=.7;
 const normalized=M.normalize(i);
 assert.equal("rotation" in normalized,false); assert.equal(normalized.placement.angleStep,.7);
 assert.deepEqual(normalized.sources,i.sources); assert.equal('rotationLocked' in normalized,false); assert.equal('angleMode' in normalized.placement,false);
 assert.deepEqual(Array.from(M.variables(normalized),v=>v.prop),['angleStep']);
});

test('circular placement cannot compensate inconsistent interval constraints with a hidden posture angle', () => {
 const f=fixture(), i=M.createDraft({id:'PI8',type:'circularPattern',sketchId:'S1',sources:[ref('line','L1')]});
 i.anchor.relation={kind:'point',target:ref('point','P1')}; f.p.fixed=f.q.fixed=true;
 const scope={points:[f.p,f.q],lines:[f.line],circles:[],arcs:[],splines:[],geometryInstances:[i],constraints:[]};
 const provider=ctx.window.InstanceProjection.create({elementSketchId:item=>item.sketchId,applicationText:ja=>ja});
 const bundle=provider.geometryInstanceBundlesForScope(scope)[0];
 scope.constraints=[new G.HorizontalConstraint(bundle.lines[0]),new G.InstanceAngleIntervalConstraint(bundle.controlPoints[0],Math.PI/3)];
 assert.equal(new G.ConstraintSolver(scope).solve().success,false);
 assert.equal('rotation' in i,false); assert.deepEqual(Array.from(M.variables(i),v=>v.prop),['angleStep']);
});

function featureFixture(success = true) {
  const shared = { ready:false, mode:'select', scopeReads:0 }, selection=ctx.window.CanvasSelection.create(); let api;
  const f = editor(success, (options, geometry) => {
    const currentScope=()=>{assert.equal(shared.ready,true);shared.scopeReads++;return options.currentScope();};
    const feature=ctx.window.DerivedInstanceFeature.create({currentScope,resolveGeometryRef:options.resolveGeometryRef,
      setHint:options.setHint,recordHistory:options.recordHistory,updateUI:options.updateUI,draw:options.draw,
      cancelConstraintTargetCommand() {},cancelPendingCommand() {},canCreateInActiveSketch:()=>true,rejectRootSketchCreation() {},
      selectedItemsForGeometryInstance:()=>[geometry.line],geometryRefForItem:item=>ref(item instanceof G.Line?'line':'point',item.id),
      geometryRefsEqual:M.sameRef,isVisibleSketchElement:()=>true,clearSelection:selection.clear,canvasSelection:selection,
      previewFreeId:()=> 'preview',nextInstanceId:()=> 'next',activeSketchId:()=> 'S1',getMode:()=>shared.mode,setMode:value=>{shared.mode=value;},
      updateToolbar() {},applicationText:ja=>ja,Line:G.Line,lineHasDirection:ctx.window.GeometryKernel.lineHasDirection,elementSketchId:item=>item.sketchId,
      createGeometryInstanceBundle:instance=>options.geometryInstanceBundlesForScope({...options.currentScope(),geometryInstances:[instance]},[])[0],
      commitDraft:(...args)=>editing.commit(...args)});
    const sources=feature.createSourceCommand({guardSketchEdit:()=>true,exitDrawMode(){},updatePropertiesUI(){},
      sketchProjectionEntryFromItem(){},sketchProjectionSourceIsCovered:()=>false,
      geometryInstanceBundlesForScope:options.geometryInstanceBundlesForScope,blockProjectionBundles:options.blockProjectionBundles,
      geometryElementKey:item=>item.id,geometryInstanceBundle:options.geometryInstanceBundle,constraintGraphNodes:()=>[],
      guardDimensionSymbolDeletion:()=>true,annotationReferencesRemovedGeometry:()=>false,clearSketchSolveState(){}});
    const {editing,changeProperty}=feature.createEditing(options);
    api={feature,command:feature.command,sources,changeProperty};return editing;
  });
  assert.equal(shared.scopeReads,0);shared.ready=true;
  return{...f,...api,shared,selection};
}

test('derived feature shares placement and source sessions while property changes route by exact instance identity',()=>{
  const f=featureFixture(), before=JSON.stringify(f.instance);
  f.sources.startForInstance(f.instance);assert.equal(f.command.editing,f.instance);assert.equal(f.command.activeInput,'sources');assert.equal(f.sources.current,null);
  const draft=f.command.pending;assert.notEqual(draft,f.instance);assert.equal(f.changeProperty(draft,'count',4),true);
  assert.equal(f.command.pending,draft);assert.equal(draft.count,4);assert.equal(JSON.stringify(f.instance),before);assert.equal(f.histories(),0);
  assert.equal(f.command.cancel(),true);assert.equal(f.command.pending,null);assert.equal(JSON.stringify(f.instance),before);
  assert.equal(f.changeProperty(f.instance,'count',5),true);assert.equal(f.instance.count,5);assert.equal(f.scope.geometryInstances[0],f.instance);assert.equal(f.histories(),1);
  assert.equal(f.p.x,20);assert.equal(f.q.x,40);
});

test('derived feature preserves committed edit rollback and pending settings remain outside model history',()=>{
  const f=featureFixture(false), before=JSON.stringify(f.instance);f.selection.set('lines',[f.line]);
  assert.equal(f.changeProperty(f.instance,'count',6),false);assert.equal(JSON.stringify(f.instance),before);assert.equal(f.histories(),0);assert.equal(f.restored(),1);assert.equal(f.selection.lines[0],f.line);
  f.sources.startForInstance(f.instance);const draft=f.command.pending;
  assert.equal(f.changeProperty(draft,'count',4),true);assert.equal(draft.count,4);assert.equal(JSON.stringify(f.instance),before);assert.equal(f.histories(),0);
  const copy=structuredClone(draft);assert.equal(f.changeProperty(copy,'count',5),false);assert.equal(f.command.pending,draft);assert.equal(draft.count,4);
  assert.equal(f.command.finish(),false);assert.equal(f.command.pending,draft);assert.equal(JSON.stringify(f.instance),before);assert.equal(f.histories(),0);
  f.command.cancel();assert.equal(f.shared.mode,'select');assert.equal(f.command.pending,null);assert.equal(JSON.stringify(f.instance),before);
});

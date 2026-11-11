const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js',
  'src/geometry/geometry_ref.js', 'src/geometry/objects.js', 'src/editing/selection.js',
  'src/constraints/sketch_projection_queries.js', 'src/commands/sketch_projection_command.js',
  'src/application/sketch_projection_feature.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
const w = sandbox.window, { Point, Line, SketchProjectionConstraint } = w.GeometrySolver;
const scope = () => ({ constraints: [], geometryInstances: [] });
function fixture() {
  const state = { scope: scope(), active: 'target', selected: [], mode: 'select', ready: false, reads: 0, editable: true };
  const events = [], hints = [], guarded = [];
  const currentScope = () => { assert.equal(state.ready, true); state.reads++; return state.scope; };
  const queries = w.SketchProjectionQueries.create({ currentScope, constraintIsOperational: c => c.enabled !== false });
  const geometry = { points: () => state.selected };
  let rectangleRead;
  const ports = { currentScope, queries,
    activeSketchId: () => state.active, geometryRefForItem: item => item ? { kind: 'line', path: [item.id] } : null,
    geometryRefsEqual: (a, b) => a.kind === b.kind && a.path.join('/') === b.path.join('/'),
    constraintIsOperational: c => c.enabled !== false, constraintSketchId: c => c.sketchId,
    geometryElementKey: item => item ? `line:${item.id}` : '', geometryKindForItem: item => item ? 'line' : null,
    elementSketchId: item => item?.sketchId, isReferenceSourceSketchId: id => id === 'source',
    isVisibleSketchElement: item => item.visible !== false,
    operandElement: operand => { assert.equal(state.ready, true); return operand.item; },
    guardSketchEdit: id => { guarded.push(id); return state.editable; }, geometry,
    readProjectionRectangle: (rect, crossing, reads, entryFromItem) => {
      assert.equal(state.ready, true); rectangleRead = { rect, crossing, reads };
      return reads.points().map(entryFromItem).filter(Boolean);
    },
    selectedGeometryItems: () => state.selected, cancelConstraintTargetCommand: () => events.push('constraint-cancel'),
    cancelPendingCommand: () => events.push('pending-cancel'), canCreateInActiveSketch: () => state.active !== 'root',
    rejectRootSketchCreation: () => events.push('root-rejected'), clearSelection: () => { state.selected = []; events.push('clear'); },
    getMode: () => state.mode, setMode: mode => { state.mode = mode; }, clearSnap: () => events.push('snap'),
    updateToolbar: () => events.push('toolbar'), setHint: (...args) => hints.push(args), applicationText: (_ja, en) => en,
    updateUI: () => events.push('ui'), draw: () => events.push('draw'), normalizeGeometryInstance: instance => instance,
    nextId: () => 'SPI1', canvasSelection: { set: (kind, values) => { state.selection = { kind, values }; } },
    refreshConstraintAnalysis: () => events.push('analysis'), recordHistory: () => events.push('history'),
    clearHover: () => events.push('hover'),
  };
  const feature = w.SketchProjectionFeature.create(ports);
  const line = id => Object.assign(new Line(id, new Point(`${id}a`, 0, 0), new Point(`${id}b`, 10, 0)), { sketchId: 'source' });
  return { state, events, hints, guarded, queries, geometry, feature, ports, line, rectangleRead: () => rectangleRead };
}

test('projection composition defers scope, operand and rectangle reads until operations and follows replacement scope', () => {
  const f = fixture(); assert.equal(f.state.reads, 0); assert.deepEqual(f.events, []); f.state.ready = true;
  const source = f.line('L1');
  assert.equal(f.feature.sources.sketchProjectionEntryFromOperand({ item: source }).item, source);
  f.state.scope.geometryInstances.push({ type: 'sketchProjection', sketchId: 'target', sources: [{ kind: 'line', path: ['L1'] }] });
  assert.equal(f.feature.sources.sketchProjectionSourceIsCovered(source), true);
  f.state.scope = scope(); assert.equal(f.feature.sources.sketchProjectionSourceIsCovered(source), false);
  const legacy = new SketchProjectionConstraint('line', source, f.line('T1')); legacy.sketchId = 'target';
  f.state.scope.constraints.push(legacy); assert.equal(f.feature.sources.sketchProjectionSourceIsCovered(source), true);
  f.state.active = 'other'; assert.equal(f.feature.sources.sketchProjectionSourceIsCovered(source), false);
});

test('source selection, rectangle selection and commit share filtering and preserve instance identity and history', () => {
  const f = fixture(); f.state.ready = true;
  const a = f.line('A'), b = f.line('B'), hidden = f.line('H'); hidden.visible = false;
  f.state.selected = [a, a, hidden]; f.feature.command.start(); assert.equal(f.feature.command.count, 1);
  assert.equal(f.feature.command.sources[0].item, a); assert.equal(f.state.mode, 'sketch-projection');
  f.state.selected = [a, b, hidden]; const rect = { x1: 0, x2: 20 };
  assert.equal(f.feature.command.addByRect(rect, true), 1);
  assert.equal(f.rectangleRead().rect, rect); assert.equal(f.rectangleRead().crossing, true);
  assert.equal(f.rectangleRead().reads, f.geometry); assert.equal(f.feature.command.count, 2);
  assert.equal(f.feature.command.commit(), true);
  const instance = f.state.scope.geometryInstances[0];
  assert.deepEqual(Array.from(instance.sources, ref => ref.path[0]), ['A', 'B']);
  assert.equal(instance.type, 'sketchProjection'); assert.equal(instance.sketchId, 'target');
  assert.equal(f.state.selection.kind, 'geometryInstances'); assert.equal(f.state.selection.values[0], instance);
  assert.equal(f.state.mode, 'select'); assert.equal(f.feature.command.count, 0); assert.equal(f.events.at(-1), 'history');
});

test('legacy edit guard retains permission short-circuit, shared-node option, operational filtering and message', () => {
  const f = fixture(); f.state.ready = true;
  const source = f.line('S'), target = f.line('T'); target.sketchId = 'target'; target.p1.sketchId = 'target';
  const legacy = new SketchProjectionConstraint('line', source, target); f.state.scope.constraints.push(legacy);
  assert.equal(f.feature.guardSketchProjectionShapeEdit([target.p1], { action: 'Drag' }), false);
  assert.equal(f.hints.at(-1)[0], 'Drag: Delete the legacy sketch projection constraint before editing the shape.');
  assert.equal(f.hints.at(-1)[1], 'error');
  assert.equal(f.feature.guardSketchProjectionShapeEdit([target.p1], { includeSharedNodes: false }), true);
  legacy.enabled = false; assert.equal(f.feature.guardSketchProjectionShapeEdit([target]), true);
  f.state.editable = false; f.state.ready = false; const before = f.state.reads, hints = f.hints.length;
  assert.equal(f.feature.guardSketchProjectionShapeEdit([null, target]), false);
  assert.equal(f.state.reads, before); assert.equal(f.hints.length, hints);
  assert.deepEqual(f.guarded, ['target', 'target', 'target', 'target']); assert.equal(f.events.length, 0);
});

test('commit rechecks coverage, rejected operations do not write history, and cancel clears staged sources', () => {
  const f = fixture(); f.state.ready = true; const source = f.line('A');
  f.state.selected = [source]; f.feature.command.start();
  f.state.scope.geometryInstances.push({ type: 'sketchProjection', sketchId: 'target', sources: [{ kind: 'line', path: ['A'] }] });
  assert.equal(f.feature.command.commit(), false); assert.equal(f.feature.command.count, 1);
  assert.equal(f.events.includes('history'), false); assert.equal(f.state.scope.geometryInstances.length, 1);
  f.feature.command.cancel(); assert.equal(f.feature.command.count, 0); assert.equal(f.state.mode, 'select');
  assert.equal(f.events.includes('hover'), true); f.state.active = 'root'; f.state.selected = [source];
  f.feature.command.start(); assert.equal(f.state.mode, 'select'); assert.equal(f.events.at(-1), 'root-rejected');
  assert.equal(f.feature.command.count, 0); assert.equal(f.events.includes('history'), false);
});

function editingFixture() {
 const f=fixture(),selection=w.CanvasSelection.create(),editingScope=scope(),state={id:0,failure:null},dimension={id:'D1'};
 let operandReader,rectangleQuery,snapClear;
 const hover={current:{point:{id:'old'},dimension},update(patch){assert.equal(this,hover);Object.assign(this.current,patch);f.events.push('hover');}};
 const ids={allocate(kind){assert.equal(this,ids);assert.equal(kind,'sketchProjection');state.id++;f.events.push('allocate');return 'SPI'+state.id;}};
 const reads={allGeometryPoints:()=>[],allGeometryLines:()=>f.state.selected,allGeometryCircles:()=>[],allGeometryArcs:()=>[],allGeometrySplines:()=>[],allHatches:()=>[]};
 const feature=w.SketchProjectionFeature.createForEditing({currentScope:()=>{assert.equal(f.state.ready,true);return editingScope;},queries:f.queries,
  sketches:{activeSketchId:f.ports.activeSketchId,constraintSketchId:f.ports.constraintSketchId,elementSketchId:f.ports.elementSketchId,isReferenceSourceSketchId:f.ports.isReferenceSourceSketchId},
  readServices:{reads,geometryAppearance:{isVisibleSketchElement:f.ports.isVisibleSketchElement}},referenceState:{constraintIsOperational:f.ports.constraintIsOperational},
  access:{guardSketchEdit:f.ports.guardSketchEdit,canCreateInActiveSketch:f.ports.canCreateInActiveSketch,rejectRootSketchCreation:f.ports.rejectRootSketchCreation},
  selection,lifecycle:{readMode:f.ports.getMode,setMode:f.ports.setMode},ids,hover,operandElement:operand=>operandReader(operand),
  readProjectionRectangle:(...args)=>rectangleQuery.readProjection(...args),cancelConstraintTargetCommand:f.ports.cancelConstraintTargetCommand,cancelPendingCommand:f.ports.cancelPendingCommand,
  clearSelection:()=>{selection.clear();f.events.push('clear');},clearSnap:()=>snapClear(),updateToolbar:f.ports.updateToolbar,setHint:f.ports.setHint,
  applicationText:f.ports.applicationText,updateUI:f.ports.updateUI,draw:f.ports.draw,normalizeGeometryInstance:item=>{if(state.failure)throw state.failure;return item;},
  refreshConstraintAnalysis:f.ports.refreshConstraintAnalysis,recordHistory:f.ports.recordHistory});
 assert.equal(f.state.reads,0);assert.deepEqual(f.events,[]);
 operandReader=operand=>operand.item;
 rectangleQuery={readProjection(rect,crossing,geometry,entry){assert.equal(this,rectangleQuery);assert.equal(f.state.ready,true);state.rectangle={rect,crossing,geometry};return geometry.lines().map(entry).filter(Boolean);}};
 snapClear=()=>f.events.push('snap');f.state.ready=true;
 return {...f,feature,selection,editingScope,editingState:state,hover,dimension,reads};
}

test('editing projection composition keeps delayed inputs and shares live selection, canonical geometry refs and the distinct editing scope',()=>{
 const f=editingFixture(),a=f.line('A'),b=f.line('B'),hidden=f.line('H');hidden.visible=false;
 f.selection.set('lines',[a,hidden]);f.feature.command.start();assert.equal(f.feature.command.count,1);assert.equal(f.feature.command.sources[0].item,a);
 assert.equal(f.feature.sources.sketchProjectionEntryFromOperand({item:b}).item,b);
 f.state.selected=[a,b,hidden];const rect={x1:0,x2:20};assert.equal(f.feature.command.addByRect(rect,true),1);
 assert.equal(f.editingState.rectangle.rect,rect);assert.equal(f.editingState.rectangle.crossing,true);assert.equal(f.editingState.rectangle.geometry.lines,f.reads.allGeometryLines);
 assert.equal(f.feature.command.commit(),true);assert.equal(f.state.scope.geometryInstances.length,0);assert.equal(f.editingScope.geometryInstances.length,1);
 const instance=f.editingScope.geometryInstances[0];assert.equal(f.selection.geometryInstances[0],instance);assert.equal(instance.id,'SPI1');assert.equal(instance.sketchId,'target');
 assert.deepEqual(Array.from(instance.sources,ref=>ref.path[0]),['A','B']);assert.equal(f.events.at(-1),'history');assert.equal(f.editingState.id,1);
 f.state.active='other';assert.equal(f.feature.sources.sketchProjectionSourceIsCovered(a),false);f.state.active='target';assert.equal(f.feature.sources.sketchProjectionSourceIsCovered(a),true);
});

test('editing projection normalization failure preserves original partial state and cancellation clears only the original hover fields',()=>{
 const f=editingFixture(),a=f.line('A');f.selection.set('lines',[a]);f.feature.command.start();const marker=new Error('normalization failed');f.editingState.failure=marker;
 assert.throws(()=>f.feature.command.commit(),error=>error===marker);assert.equal(f.editingState.id,1);assert.equal(f.feature.command.count,1);assert.equal(f.state.mode,'sketch-projection');
 assert.equal(f.editingScope.geometryInstances.length,0);assert.equal(f.state.scope.geometryInstances.length,0);assert.equal(f.events.includes('history'),false);
 f.feature.command.cancel();assert.equal(f.state.mode,'select');assert.equal(f.feature.command.count,0);assert.equal(f.hover.current.point,null);assert.equal(f.hover.current.dimension,f.dimension);
 f.state.active='root';f.events.length=0;f.feature.command.start();assert.deepEqual(f.events,['constraint-cancel','pending-cancel','root-rejected']);
});
vm.runInContext(fs.readFileSync('src/constraints/reference_constraint_state.js', 'utf8'), sandbox);
function projectionWorkspaceFixture(composed, probe) {
  'use strict'; probe ||= {};
  const f = fixture(), state = { bound: scope(), fail: null, seq: 0, language: 'en' }, marker = new Error('projection workspace failure');
  function check(stage) { if (state.fail === stage) throw marker; }
  function current() { assert.equal(this, undefined); check('workspace'); assert.equal(f.state.ready,true); f.state.reads++; return f.state.scope; }
  const editingScope = { get current() { check('editing'); assert.equal(f.state.ready,true); return state.bound; } };
  const sketches = { activeSketchId: f.ports.activeSketchId, constraintSketchId: f.ports.constraintSketchId, elementSketchId: f.ports.elementSketchId, isReferenceSourceSketchId: f.ports.isReferenceSourceSketchId };
  const referenceState = w.ReferenceConstraintState.create({ currentScope: current, constraintSketchId: sketches.constraintSketchId, isReferenceSourceSketchId: sketches.isReferenceSourceSketchId });
  const selection = w.CanvasSelection.create(), hover = { current: { dimension: { id: 'D1' } }, update(patch) { assert.equal(this,hover); Object.assign(this.current,patch); f.events.push('hover'); } };
  const ids = { allocate(kind) { assert.equal(this,ids); assert.equal(kind,'sketchProjection'); return 'SPI'+ ++state.seq; } };
  const interaction = { selection, hover, access: { guardSketchEdit(id) { check('guard'); return f.ports.guardSketchEdit(id); }, canCreateInActiveSketch:f.ports.canCreateInActiveSketch, rejectRootSketchCreation:f.ports.rejectRootSketchCreation },
    lifecycle: { readMode:f.ports.getMode, setMode:f.ports.setMode } };
  const presentation = { settings: { applicationText(ja,en) { assert.equal(this,undefined); check('text'); return state.language==='en'?en:ja; } }, setHint:f.ports.setHint,
    updateUI() { assert.equal(this,undefined); check('ui'); f.events.push('ui'); }, draw() { assert.equal(this,undefined); check('draw'); f.events.push('draw'); } };
  const readServices = { reads: Object.fromEntries(['Points','Lines','Circles','Arcs','Splines','Hatches'].map(kind => ['all'+(kind==='Hatches'?'':'Geometry')+kind, () => kind==='Lines'?selection.lines:[]])),
    geometryAppearance: { isVisibleSketchElement:f.ports.isVisibleSketchElement } };
  const documentWorkspace = { workspace: { current }, sketches, documentIds:ids };
  let operandReader, rectangleQuery, snap;
  const options = { documentWorkspace, editingScope, readServices, referenceState, interaction, presentation,
    operandElement: operand=>operandReader(operand), readProjectionRectangle:(...args)=>rectangleQuery.readProjection(...args),
    cancelConstraintTargetCommand:f.ports.cancelConstraintTargetCommand,cancelPendingCommand:f.ports.cancelPendingCommand,
    clearSelection:()=>{ selection.clear(); f.events.push('clear'); },clearSnap:()=>snap(),updateToolbar:f.ports.updateToolbar,
    normalizeGeometryInstance:instance=>{check('normalize');return instance;},refreshConstraintAnalysis:f.ports.refreshConstraintAnalysis,
    recordHistory:()=>{check('history');f.events.push('history');} };
  const originalQueries=w.SketchProjectionQueries,originalCommand=w.SketchProjectionCommand;
  probe.order=[];probe.ports={};probe.events=f.events;
  const observe=(name,factory)=>ports=>{probe.order.push(name);probe.ports[name]=ports;if(probe.failAt===name)throw probe.marker;const result=factory(ports);if(name==='queries')probe.queries=result;return result;};
  w.SketchProjectionQueries={...originalQueries,create:observe('queries',originalQueries.create),createSources:observe('sources',originalQueries.createSources)};
  w.SketchProjectionCommand={create:observe('command',originalCommand.create)};
  let feature,queries;
  try {
    if(composed){feature=w.SketchProjectionFeature.createForWorkspace(options);queries=feature.queries;}
    else {queries=w.SketchProjectionQueries.create({currentScope:current,constraintIsOperational:referenceState.constraintIsOperational});feature=w.SketchProjectionFeature.createForEditing({
      ...options,currentScope:()=>editingScope.current,queries,sketches,access:interaction.access,selection,lifecycle:interaction.lifecycle,ids,hover,
      setHint:presentation.setHint,applicationText:presentation.settings.applicationText,updateUI:presentation.updateUI,draw:presentation.draw});}
  } finally {w.SketchProjectionQueries=originalQueries;w.SketchProjectionCommand=originalCommand;}
  assert.equal(f.state.reads,0);assert.deepEqual(f.events,[]);
  operandReader=operand=>operand.item;rectangleQuery={readProjection(rect,crossing,geometry,entry){assert.equal(this,rectangleQuery);check('rectangle');return geometry.lines().map(entry).filter(Boolean);}};snap=()=>f.events.push('snap');f.state.ready=true;
  return {...f,feature,queries,referenceState,selection,interaction,presentation,documentWorkspace,editingScope,readServices,workspaceState:state,marker,probe,
    snapshot(){return JSON.parse(JSON.stringify({events:f.events,hints:f.hints,mode:f.state.mode,count:feature.command.count,seq:state.seq,
      documentInstances:f.state.scope.geometryInstances,boundInstances:state.bound.geometryInstances,selected:selection.geometryInstances.map(i=>i.id),hover:hover.current}));} };
}

test('workspace projection assembles one actual query before sources and command and reuses existing owners without eager reads',()=>{
  const f=projectionWorkspaceFixture(true),p=f.probe.ports;
  assert.deepEqual(f.probe.order,['queries','sources','command']);assert.equal(f.feature.queries,f.probe.queries);assert.equal(p.sources.queries,f.queries);
  assert.equal(p.queries.currentScope,f.documentWorkspace.workspace.current);assert.equal(p.queries.constraintIsOperational,f.referenceState.constraintIsOperational);
  assert.equal(p.command.canvasSelection,f.selection);assert.equal(p.command.applicationText,f.presentation.settings.applicationText);assert.ok(Object.isFrozen(f.feature));
  const source=f.line('S');assert.equal(f.feature.sources.sketchProjectionEntryFromOperand({item:source}).item,source);
});

test('workspace projection keeps query and bound editing scopes distinct through replacement, legacy filtering and instance commit',()=>{
  const run=composed=>{
    const f=projectionWorkspaceFixture(composed),source=f.line('S'),target=f.line('T');target.sketchId='target';
    const legacy=new SketchProjectionConstraint('line',source,target);legacy.sketchId='target';f.state.scope.constraints.push(legacy);
    assert.equal(f.queries.sketchProjectionConstraintForTarget(target),legacy);assert.equal(f.feature.sources.sketchProjectionSourceIsCovered(source),true);
    legacy.enabled=false;assert.equal(f.queries.sketchProjectionConstraintForTarget(target),null);assert.equal(f.queries.sketchProjectionConstraintForTarget(target,{operationalOnly:false}),legacy);
    f.state.scope=scope();assert.equal(f.queries.sketchProjectionConstraintForTarget(target),null);assert.equal(f.feature.sources.sketchProjectionSourceIsCovered(source),false);
    f.selection.set('lines',[source]);f.feature.command.start();assert.equal(f.feature.command.count,1);
    const previous=f.workspaceState.bound;f.workspaceState.bound=scope();assert.equal(f.feature.command.commit(),true);assert.equal(previous.geometryInstances.length,0);
    assert.equal(f.state.scope.geometryInstances.length,0);assert.equal(f.workspaceState.bound.geometryInstances.length,1);assert.equal(f.selection.geometryInstances[0],f.workspaceState.bound.geometryInstances[0]);
    f.workspaceState.language='ja';assert.match(f.feature.sketchProjectionShapeEditBlockedMessage('drag'),/旧形式/);
    f.workspaceState.language='en';assert.match(f.feature.sketchProjectionShapeEditBlockedMessage('drag'),/legacy/);return f.snapshot();
  };assert.deepEqual(run(true),run(false));
});

test('workspace projection preserves constructor and live query, input, notification and commit failure boundaries',()=>{
  for(const failAt of ['queries','sources','command']){const marker=new Error(failAt),raw={failAt,marker},composed={failAt,marker};
    for(const [mode,p]of [[false,raw],[true,composed]])assert.throws(()=>projectionWorkspaceFixture(mode,p),error=>error===marker);
    assert.deepEqual(composed.order,raw.order);assert.deepEqual(composed.events,raw.events);}
  for(const failure of ['workspace','editing','guard','rectangle','text','normalize','ui','draw','history']){
    const run=composed=>{const f=projectionWorkspaceFixture(composed),source=f.line('S');f.selection.set('lines',[source]);
      if(['rectangle','normalize','ui','draw','history'].includes(failure))f.feature.command.start();f.workspaceState.fail=failure;
      const operation=failure==='workspace'?()=>f.queries.sketchProjectionConstraints():failure==='editing'?()=>f.feature.sources.sketchProjectionSourceIsCovered(source):
        failure==='guard'?()=>f.feature.guardSketchProjectionShapeEdit([source]):failure==='rectangle'?()=>f.feature.command.addByRect({},true):
        failure==='text'?()=>f.feature.sketchProjectionShapeEditBlockedMessage():()=>f.feature.command.commit();
      assert.throws(operation,error=>error===f.marker);return f.snapshot();};assert.deepEqual(run(true),run(false),failure);
  }
});
for (const file of ['src/document/appearance.js','src/editing/geometry_ids.js','src/editing/geometry_creation.js','src/constraints/references.js','src/editing/sketch_projection_editing.js']) vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
function projectionModelFixture(composed, failure) {
  'use strict';
  const f=projectionWorkspaceFixture(true),state={failure,normalizations:0},marker=new Error('projection metadata failure');
  f.workspaceState.bound={...scope(),points:[],lines:[],circles:[],arcs:[],splines:[],annotations:[]};
  const check=name=>{if(state.failure===name)throw marker;};
  function resolve(ref){assert.equal(this,undefined);check('resolve');const model=f.state.scope;return [...model.points,...model.lines,...model.circles,...model.arcs,...model.splines].find(item=>item.id===ref.path.at(-1))||null;}
  f.readServices.reads.resolveGeometryRef=resolve;
  const ids=w.GeometryIds.create(),creation=w.GeometryCreation.create({currentScope:f.documentWorkspace.workspace.current,ids,assignSketchId:item=>{item.sketchId=f.state.active;},currentConstruction:()=>false,minLineLength:.01,minArcLength:.01});
  const add=creation.addPointToSketch;
  const geometry={...creation,addPointToSketch(x,y,sketchId,kind){assert.equal(this,undefined);check('add');return add(x,y,sketchId,kind);}};
  const actualReferences=w.ConstraintReferences.create({resolveGeometryRef:resolve}),references={constraintReferencesPoint(c,p){assert.equal(this,undefined);check('refs');return actualReferences.constraintReferencesPoint(c,p);}};
  const original=w.SketchProjectionEditing,appearance=w.Appearance;let ports,actual;
  if(failure==='normalize')w.Appearance={...appearance,normalizeAppearance(value){if(++state.normalizations===2)throw marker;return appearance.normalizeAppearance(value);}};
  w.SketchProjectionEditing={create(input){ports=input;check('constructor');return actual=original.create(input);}};
  let editing;
  try{editing=composed?(composed==='construction'?f.feature.createModelEditingForConstruction({geometry,references}):f.feature.createModelEditing({geometry,references})):w.SketchProjectionEditing.create({
    currentScope:f.documentWorkspace.workspace.current,queries:f.queries,resolveGeometryRef:resolve,geometryRefForItem:w.GeometryObjects.geometryRefForItem,geometryKindForItem:w.GeometryObjects.geometryKindForItem,
    constraintSketchId:f.documentWorkspace.sketches.constraintSketchId,constraintIsOperational:f.referenceState.constraintIsOperational,addPointToSketch:geometry.addPointToSketch,
    constraintReferencesPoint:references.constraintReferencesPoint,nextSeq:w.GeometryIds.nextSeq,normalizeAppearance:w.Appearance.normalizeAppearance});
  }finally{w.SketchProjectionEditing=original;w.Appearance=appearance;}
  assert.equal(f.state.reads,0);assert.deepEqual(f.events,[]);
  const point=(id,x,y)=>Object.assign(new Point(id,x,y,false,'endpoint'),{sketchId:'target'});
  function sharedNamespace(){const a=point('P1',1,2),b=point('P2',3,4),spare=point('P9',9,9);a.fixed=true;a.appearance={color:'#123456'};
    const first=Object.assign(new Line('L1',a,b),{sketchId:'target'}),second=Object.assign(new Line('L2',a,b),{sketchId:'target'}),source=f.line('source');
    const constraints=[new SketchProjectionConstraint('line',source,first),new SketchProjectionConstraint('line',source,second),new SketchProjectionConstraint('line',source,second)];
    return{namespace:{points:[a,b,spare],constraints},a,b,first,second};}
  function splineNamespace(){const p1=point('P1',0,0),p2=point('P2',10,0),p4=point('P4',20,10),t1=point('P31',0,0),t2=point('P32',10,0),obsolete=point('P33',20,0);
    const source=Object.assign(new w.GeometrySolver.Spline('SP1',[p2,p1,p4]),{sketchId:'source',construction:true,closed:true});
    const stale=Object.assign(new w.GeometrySolver.Spline('SP1',[p1,p2]),{sketchId:'source'}),target=Object.assign(new w.GeometrySolver.Spline('SP2',[t1,t2,obsolete]),{sketchId:'target',closed:false,_curveCache:{old:true}});
    const constraint=Object.assign(new SketchProjectionConstraint('spline',stale,target),{sketchId:'target',sourcePointIds:['P1','P2','P3']});
    const other=new w.GeometrySolver.CoincidentConstraint(p1,p2);other.sketchId='source';
    const namespace={...scope(),points:[p1,p2,p4,t1,t2,obsolete],lines:[],circles:[],arcs:[],annotations:[],splines:[source,target],constraints:[constraint,other]};f.state.scope=namespace;ids.reserve(namespace);
    return{namespace,source,target,constraint,t1,t2,obsolete};}
  return{...f,editing,actual,ports,geometry,references,ids,scopeMarker:f.marker,marker,modelState:state,sharedNamespace,splineNamespace};
}

test('Projection model editing reuses the actual query, Geometry insertion and reference capabilities at the late cold stage',()=>{
  const f=projectionModelFixture(true),p=f.ports;
  assert.equal(f.editing,f.actual);assert.equal(p.queries,f.feature.queries);assert.equal(p.currentScope,f.documentWorkspace.workspace.current);
  assert.equal(p.addPointToSketch,f.geometry.addPointToSketch);assert.equal(p.constraintReferencesPoint,f.references.constraintReferencesPoint);
  assert.equal(p.resolveGeometryRef,f.readServices.reads.resolveGeometryRef);assert.equal(p.constraintIsOperational,f.referenceState.constraintIsOperational);
  assert.equal(p.nextSeq,w.GeometryIds.nextSeq);assert.equal(p.normalizeAppearance,w.Appearance.normalizeAppearance);
});

test('Projection model editing keeps explicit namespace repair, endpoint identities, live Workspace and Spline metadata synchronization',()=>{
  const run=composed=>{const f=projectionModelFixture(composed),shared=f.sharedNamespace();
    f.workspaceState.fail='workspace';assert.equal(f.editing.separateSharedSketchProjectionTargetPoints(shared.namespace),2);f.workspaceState.fail=null;
    assert.equal(shared.first.p1,shared.a);assert.notEqual(shared.second.p1,shared.a);assert.equal(shared.second.p1.id,'P10');assert.equal(shared.second.p2.id,'P11');
    assert.equal(shared.second.p1.fixed,true);assert.equal(shared.second.p1.sketchId,'target');assert.deepEqual(shared.second.p1.appearance,w.Appearance.normalizeAppearance(shared.a.appearance));
    assert.equal(f.editing.separateSharedSketchProjectionTargetPoints(shared.namespace),0);
    const s=f.splineNamespace();assert.equal(f.editing.synchronizeSketchProjectionMetadata('other'),false);assert.equal(f.editing.synchronizeSketchProjectionMetadata('target'),true);
    assert.equal(s.constraint.source,s.source);assert.equal(s.target.fitPoints[0],s.t2);assert.equal(s.target.fitPoints[1],s.t1);assert.equal(s.target.fitPoints[2],s.namespace.points.at(-1));
    assert.equal(s.namespace.points.includes(s.obsolete),false);assert.equal(s.target._curveCache,null);assert.equal(s.target.closed,true);assert.equal(s.target.construction,true);
    assert.equal(f.workspaceState.bound.points.length,0);assert.equal(f.editing.synchronizeSketchProjectionMetadata(),false);
    s.constraint.enabled=false;s.source.closed=false;assert.equal(f.editing.synchronizeSketchProjectionMetadata(),false);assert.equal(s.target.closed,true);
    return JSON.parse(JSON.stringify({shared:shared.namespace,model:s.namespace,seq:f.ids.peek('point')}));};
  assert.deepEqual(run(true),run(false));
});

test('Projection model editing preserves constructor errors and partial endpoint repair and Spline synchronization on failures',()=>{
  for(const composed of [false,true])assert.throws(()=>projectionModelFixture(composed,'constructor'),/projection metadata failure/);
  for(const failure of ['workspace','resolve','add','refs','normalize']){
    const run=composed=>{const f=projectionModelFixture(composed,failure);let namespace,operation;
      if(failure==='normalize'){namespace=f.sharedNamespace().namespace;operation=()=>f.editing.separateSharedSketchProjectionTargetPoints(namespace);}
      else{namespace=f.splineNamespace().namespace;if(failure==='workspace')f.workspaceState.fail='workspace';operation=()=>f.editing.synchronizeSketchProjectionMetadata();}
      assert.throws(operation,error=>error===(failure==='workspace'?f.scopeMarker:f.marker));
      return JSON.parse(JSON.stringify({namespace,seq:f.ids.peek('point')}));};assert.deepEqual(run(true),run(false),failure);
  }
});

test('projection drag inputs share the native query and defer both translations until each blocked operation', () => {
  const f = projectionWorkspaceFixture(true); f.state.ready = false;
  const inputs = f.feature.createDragInputs(); assert.ok(Object.isFrozen(inputs)); assert.equal(inputs.projectionQueries, f.queries);
  assert.equal(f.state.reads, 0); assert.deepEqual(f.events, []); assert.deepEqual(f.hints, []);
  const { projectionBlockedMessage } = inputs; assert.equal(projectionBlockedMessage.name, 'projectionBlockedMessage'); assert.equal(projectionBlockedMessage.length, 0);
  f.workspaceState.language = 'en'; assert.equal(projectionBlockedMessage(), 'Drag: Delete the legacy sketch projection constraint before editing the shape.');
  f.workspaceState.language = 'ja'; assert.equal(projectionBlockedMessage(), 'ドラッグ: 旧形式の投影拘束を削除してから形状を編集してください');
  f.workspaceState.fail = 'text'; assert.throws(projectionBlockedMessage, error => error === f.marker);
  assert.equal(f.state.reads, 0); assert.deepEqual(f.events, []); assert.deepEqual(f.hints, []);
});


test('construction metadata publication keeps native editing identity, cold construction and live Workspace synchronization',()=>{
  const f=projectionModelFixture('construction'),s=f.splineNamespace();assert.equal(f.editing,f.actual);
  assert.equal(f.feature.synchronizeConstructionMetadata.name,'synchronizeSketchProjectionMetadata');assert.equal(f.feature.synchronizeConstructionMetadata.length,0);
  assert.equal(f.feature.synchronizeConstructionMetadata('ignored'),true);assert.equal(s.constraint.source,s.source);assert.equal(s.target.closed,true);assert.equal(f.workspaceState.bound.points.length,0);
  assert.equal(f.feature.synchronizeConstructionMetadata(),false);f.state.scope={...scope(),points:[],lines:[],circles:[],arcs:[],splines:[],constraints:[]};assert.equal(f.feature.synchronizeConstructionMetadata(),false);
});

test('construction metadata keeps its original guard, zero-argument bare call and only replaces a fully captured native capability',()=>{
  const f=projectionWorkspaceFixture(true),original=w.SketchProjectionEditing,marker=new Error('metadata publication'),a={},b={};let calls=0,reads=0,method;
  const guard=()=>assert.throws(()=>f.feature.synchronizeConstructionMetadata(),error=>error.name==='ReferenceError'&&error.message==="Cannot access 'synchronizeSketchProjectionMetadata' before initialization");guard();
  function native(){'use strict';assert.equal(this,undefined);assert.equal(arguments.length,0);calls++;return method;}
  const options={geometry:{addPointToSketch(){}},references:{constraintReferencesPoint(){}}};
  try{
    w.SketchProjectionEditing={create(){guard();return Object.freeze({synchronizeSketchProjectionMetadata:native});}};
    const raw=f.feature.createModelEditing(options);assert.equal(raw.synchronizeSketchProjectionMetadata,native);guard();
    const actual=Object.freeze({get synchronizeSketchProjectionMetadata(){reads++;return native;}});w.SketchProjectionEditing={create(){guard();return actual;}};
    assert.equal(f.feature.createModelEditingForConstruction(options),actual);assert.equal(reads,1);method=a;assert.equal(f.feature.synchronizeConstructionMetadata('drop'),a);assert.equal(reads,1);assert.equal(calls,1);
    for(const failGetter of [false,true]){
      w.SketchProjectionEditing={create(){assert.equal(f.feature.synchronizeConstructionMetadata(),a);if(!failGetter)throw marker;return{get synchronizeSketchProjectionMetadata(){throw marker;}};}};
      assert.throws(()=>f.feature.createModelEditingForConstruction(options),error=>error===marker);assert.equal(f.feature.synchronizeConstructionMetadata(),a);
    }
    const next=Object.freeze({synchronizeSketchProjectionMetadata(){'use strict';assert.equal(this,undefined);assert.equal(arguments.length,0);return b;}});w.SketchProjectionEditing={create:()=>next};
    assert.equal(f.feature.createModelEditing(options),next);assert.equal(f.feature.synchronizeConstructionMetadata(),a);
    assert.equal(f.feature.createModelEditingForConstruction(options),next);assert.equal(f.feature.synchronizeConstructionMetadata(),b);
    w.SketchProjectionEditing={create:()=>Object.freeze({synchronizeSketchProjectionMetadata:undefined})};f.feature.createModelEditingForConstruction(options);assert.throws(()=>f.feature.synchronizeConstructionMetadata(),error=>error.name==='TypeError');
  }finally{w.SketchProjectionEditing=original;}
});


test('native Construction toggle uses the published editor to synchronize actual projected Spline metadata without replacing geometry',()=>{
  vm.runInContext(fs.readFileSync('src/commands/construction_command.js','utf8'),sandbox);
  const f=projectionModelFixture('construction'),s=f.splineNamespace(),events=[];const source=s.source,target=s.target;
  assert.equal(source.construction,true);const noop=()=>{};
  const command=w.ConstructionCommand.create({cancelConstraintTargetCommand:noop,selectedConstructionTogglePrimitives:()=>[source],guardSketchProjectionShapeEdit:()=>true,
    applicationText:(_ja,en)=>en,synchronizeSketchProjectionMetadata:f.feature.synchronizeConstructionMetadata,setHint:()=>events.push('hint'),clearSelection:()=>events.push('clear'),
    updateUI:()=>events.push('ui'),draw:()=>events.push('draw'),recordHistory:()=>events.push('history')});
  assert.equal(command.toggle(),undefined);assert.equal(s.source,source);assert.equal(s.target,target);assert.equal(source.construction,false);assert.equal(target.construction,false);
  assert.equal(target.closed,true);assert.equal(target._curveCache,null);assert.equal(s.constraint.source,source);assert.deepEqual(events,['hint','clear','ui','draw','history']);
});

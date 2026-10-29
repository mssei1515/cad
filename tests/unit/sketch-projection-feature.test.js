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

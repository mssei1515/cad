const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { GeometrySolver: { hypot2: Math.hypot } } };
vm.runInNewContext(fs.readFileSync('src/commands/geometry_drag.js', 'utf8'), sandbox);
const event = { pointerId: 7, type: 'pointerup' };
function fixture() {
  const events = [], state = { scale: 2, scope: { splines: [], blockInstances: [] },
    preview: { success: true }, final: { success: true, errorNorm: 0 }, dependent: { success: true },
    stabilized: { success: true, dependent: { success: true }, result: { errorNorm: 0 } }, stable: true };
  let command;
  const notify = name => (...args) => events.push({ name, args });
  command = sandbox.window.GeometryDrag.create({
    prepareSession: session => { events.push({ name: 'prepare' }); state.prepare?.(session); },
    dragResultForSession: (session, point) => { events.push({ name: 'preview', args: [point] }); state.onPreview?.(session); return state.preview; },
    solveFinalDragSession: session => { events.push({ name: 'final', args: [session.sketchId] }); return state.final; },
    currentScope: () => state.scope, activeSketchId: () => 'active', viewScale: () => state.scale,
    beginPointer: notify('begin'), endPointer: id => { assert.equal(command.active, false); notify('end')(id); },
    projectionBlockedMessage: () => 'projection blocked', canvasSelection: { set: notify('select') },
    restoreModelState: notify('restoreModel'), restoreSolverState: notify('restoreSolver'),
    solveReferenceDependentSketches: id => { notify('dependent')(id); return state.dependent; },
    normalizeArcSweeps: notify('normalize'), clearSketchSolveState: notify('clearSolve'),
    invalidateBlockProjectionCache: notify('invalidate'),
    stabilizeActiveParameterNamespace: (id, options) => { notify('stabilize')(id, options); return state.stabilized; },
    refreshConstraintAnalysis: () => { notify('analysis')(); return { analysis: { stable: state.stable } }; },
    acceptError: 1e-4, applicationText: text => text, setHint: notify('hint'), updateUI: notify('ui'),
    updateGeometrySelectionUI: notify('selectionUI'), draw: notify('draw'), recordHistory: notify('history'),
  });
  const plan = { kind: 'point', mode: 'points', sketchId: 'S1', startPointer: { x: 0, y: 0 }, points: [{ point: {} }] };
  return { command, events, state, plan, names: () => events.map(e => e.name) };
}

test('begin owns the session and highlights while reset drops it without completion side effects', () => {
  const f = fixture(), point = f.plan.points[0].point;
  assert.equal(f.command.begin(event, null), false); assert.equal(f.events.length, 0);
  assert.equal(f.command.begin(event, f.plan), true);
  assert.deepEqual(f.names(), ['prepare', 'begin']); assert.equal(f.command.isPoint(point), true);
  f.plan.kind = 'circle'; assert.equal(f.command.isPoint(point), true);
  f.command.reset(); f.command.update({ x: 9, y: 9 });
  assert.equal(f.command.active, false); assert.equal(f.command.isPoint(point), false);
  assert.equal(f.command.finish(event), false); assert.deepEqual(f.names(), ['prepare', 'begin']);
  const arc = { center: point };
  f.command.begin(event, { ...f.plan, kind: 'arc-endpoint', item: arc, endpoint: 'start' });
  assert.equal(f.command.isCenter(point), true); assert.equal(f.command.isArcEndpoint(arc, 'start'), true);
  assert.equal(f.command.isArcEndpoint(arc, 'end'), false);
});

test('threshold uses display coordinates before pointer mapping and only gates the first movement', () => {
  const f = fixture();
  f.plan.displayStartPointer = { x: 100, y: 100 };
  f.plan.pointerMap = p => ({ x: p.x - 100, y: p.y - 100 });
  f.command.begin(event, f.plan); f.events.length = 0;
  f.command.update({ x: 101.5, y: 100 }); assert.equal(f.events.length, 0);
  f.command.update({ x: 102, y: 100 });
  assert.deepEqual(f.events[0].args[0], { x: 2, y: 0 });
  assert.deepEqual(f.names(), ['preview', 'dependent', 'hint', 'draw']);
  f.command.update({ x: 100, y: 100 });
  assert.equal(f.events.filter(e => e.name === 'preview').length, 2);
  assert.equal(f.names().includes('history'), false);
});

test('an unmoved click selects instance geometry but pointercancel does not and neither solves nor records history', () => {
  for (const type of ['pointerup', 'pointercancel']) {
    const f = fixture(), selected = { instanceId: 'I1', id: 'L1' };
    f.plan.clickGeometrySelection = selected;
    f.command.begin(event, f.plan); f.events.length = 0;
    assert.equal(f.command.finish({ ...event, type }), true);
    assert.deepEqual(f.names(), type === 'pointerup' ? ['end', 'select', 'selectionUI', 'hint', 'draw'] : ['end', 'hint', 'draw']);
    if (type === 'pointerup') assert.equal(f.events[1].args[1], selected);
    assert.equal(f.command.finish(event), false);
  }
});

test('projection locks reject attempted movement without solving or committing', () => {
  const f = fixture(); f.state.prepare = session => { session.projectionShapeLocked = true; };
  f.command.begin(event, f.plan); f.events.length = 0;
  f.command.update({ x: 3, y: 0 }); f.command.finish(event);
  assert.deepEqual(f.names(), ['hint', 'draw', 'end', 'hint', 'draw']);
  assert.equal(f.events[0].args[0], 'projection blocked');
});

test('blocked preview and dependent failure retain their distinct UI paths without recording history', () => {
  const f = fixture(); f.command.begin(event, f.plan); f.events.length = 0;
  f.state.preview = { blocked: true, reason: 'blocked' };
  f.command.update({ x: 3, y: 0 });
  assert.deepEqual(f.names(), ['preview', 'hint', 'ui', 'draw']);
  assert.equal(f.events[2].args[0].refreshAnalysis, false);
  f.events.length = 0; f.state.preview = { success: true }; f.state.dependent.success = false;
  f.command.update({ x: 4, y: 0 });
  assert.deepEqual(f.names(), ['preview', 'dependent', 'hint', 'ui', 'draw']);
  assert.equal(f.events[3].args.length, 0);
});

test('final failure or invalid spline restores the initial snapshot before UI and never adds history', () => {
  for (const failure of ['solve', 'tolerance', 'spline']) for (const fullSnapshot of [true, false]) {
    const f = fixture(), values = {}, solverValues = [];
    f.plan.parameterDragSnapshot = fullSnapshot ? values : null; f.plan.fullDragState = solverValues;
    f.command.begin(event, f.plan); f.command.update({ x: 3, y: 0 }); f.events.length = 0;
    if (failure === 'solve') f.state.final.success = false;
    if (failure === 'tolerance') f.state.final.errorNorm = 0.01;
    if (failure === 'spline') f.state.scope = { splines: [{ id: 'SP1', curve: () => ({ valid: false }) }], blockInstances: [] };
    f.command.finish(event);
    assert.deepEqual(f.names(), ['end', 'final', 'normalize', fullSnapshot ? 'restoreModel' : 'restoreSolver', 'clearSolve', 'hint', 'ui', 'draw']);
    assert.equal(f.events[3].args[0], fullSnapshot ? values : solverValues);
    assert.equal(f.events[4].args[0], 'S1');
  }
});

test('parameter and dependent failures restore the full snapshot after final solve without committing', () => {
  for (const failure of ['parameter', 'dependent', 'tolerance']) {
    const f = fixture(), snapshot = {}; f.plan.parameterDragSnapshot = snapshot;
    f.command.begin(event, f.plan); f.command.update({ x: 3, y: 0 }); f.events.length = 0;
    if (failure === 'parameter') f.state.stabilized.success = false;
    if (failure === 'dependent') f.state.stabilized.dependent.success = false;
    if (failure === 'tolerance') f.state.stabilized.result.errorNorm = 0.01;
    f.command.finish(event);
    assert.deepEqual(f.names(), ['end', 'final', 'normalize', 'stabilize', 'restoreModel', 'clearSolve', 'hint', 'ui', 'draw']);
    assert.equal(f.events[4].args[0], snapshot);
  }
});

test('successful moved Block completion invalidates projection before parameters and records one history after drawing', () => {
  const f = fixture(), block = { id: 'B1' }, allowed = () => true;
  Object.assign(f.plan, { kind: 'block', mode: 'block', item: block, variableAllowed: allowed });
  f.state.scope.blockInstances.push(block);
  f.command.begin(event, f.plan); f.command.update({ x: 3, y: 0 }); f.events.length = 0;
  // Existing behavior also finalizes an already moved geometry on pointercancel.
  f.command.finish({ ...event, type: 'pointercancel' });
  assert.deepEqual(f.names(), ['end', 'final', 'normalize', 'invalidate', 'stabilize', 'analysis', 'hint', 'ui', 'draw', 'history']);
  assert.equal(f.events[3].args[0], 'B1'); assert.equal(f.events[4].args[1].variableAllowed, allowed);
  assert.equal(f.events[9].args[0], 'ブロック移動ドラッグ');
  assert.equal(f.command.finish(event), false);
});

test('annotation solve input is released on completion, failure and cancellation', () => {
  for (const mode of ['finish', 'failure', 'reset']) {
    const f = fixture(); let synced = 0, ended = 0;
    f.plan.syncAnnotation = () => { synced++; };
    f.plan.onEnd = () => { ended++; };
    f.command.begin(event, f.plan); f.command.update({ x: 3, y: 0 });
    assert.equal(synced, 1);
    if (mode === 'failure') f.state.final = { success: false, errorNorm: 1 };
    if (mode === 'reset') f.command.reset(); else f.command.finish(event);
    assert.equal(ended, 1); assert.equal(f.command.active, false);
    f.command.reset(); assert.equal(ended, 1);
    if (mode === 'finish') assert.equal(synced, 3);
  }
});

vm.runInNewContext(fs.readFileSync('src/geometry/pattern_instance_model.js', 'utf8'), sandbox);
class EntryPoint { constructor(x, y) { this.x = x; this.y = y; } }
class EntryLine { constructor(p1, p2) { this.id = 'I1/L1'; this.p1 = p1; this.p2 = p2; } }
function derivedEntryFixture() {
  const calls = [], source = {}, instance = { id: 'I1', type: 'pattern', sketchId: 'S1', x: 4, y: 5, placement: { kind: 'linear' } };
  const item = new EntryLine(new EntryPoint(0, 0), new EntryPoint(10, 0));
  const hit = { instance, item, kind: 'line', endpoint: 'end' }, pointer = { x: 4, y: 3 };
  const selection = { geometryInstances: [], instanceGeometry: null, set(key, value) { this[key] = value; calls.push(['set', key]); } };
  const state = { allowed: true, sources: new Set([source]), sourcePoints: [], plan: {}, resolved: { item: source, pointer: { x: 2, y: 1 }, mapPointer: p => p } };
  const drag = { label: 'Dragging', begin(e, plan) { assert.equal(this, drag); state.started = { e, plan }; calls.push(['begin']); }, reset() { calls.push(['reset']); } };
  const entry = sandbox.window.GeometryDrag.createDerivedEntry({ types: { Point: EntryPoint, Line: EntryLine },
    canEdit: id => { calls.push(['guard', id]); return state.allowed; }, canvasSelection: selection,
    geometryInstanceSourceObjects: () => { calls.push(['sources']); return state.sources; },
    clearSelection: () => { calls.push(['clear']); selection.geometryInstances = []; selection.instanceGeometry = null; },
    geometryInstanceSourcePoints: () => state.sourcePoints,
    resolveDerivedDragSource: () => { calls.push(['resolve']); return state.resolved; },
    buildDragSession: (kind, item, pointer) => { state.built = { kind, item, pointer }; return state.plan; }, geometryDrag: drag,
    setHint: (...args) => calls.push(['hint', ...args]), applicationText: (_ja, en) => en,
    updateGeometrySelectionUI: () => calls.push(['selectionUI']), updateUI: options => calls.push(['ui', options.refreshAnalysis]), draw: () => calls.push(['draw']),
  });
  return { entry, calls, state, source, instance, item, hit, pointer, selection };
}

test('derived drag entry rejects anchor controls and denied owners before changing selection', () => {
  const f = derivedEntryFixture();
  f.entry.begin(event, { item: { instanceControl: 'anchor' } }, f.pointer); assert.deepEqual(f.calls, []);
  f.state.allowed = false; const selected = f.selection.geometryInstances;
  f.entry.begin(event, f.hit, f.pointer);
  assert.deepEqual(f.calls, [['guard', 'S1']]); assert.equal(f.selection.geometryInstances, selected); assert.equal(f.state.started, undefined);
});

test('whole placed instance drag retains click-selection metadata, source exclusions and completion order', () => {
  const f = derivedEntryFixture(); f.selection.geometryInstances = [f.instance];
  f.entry.begin(event, f.hit, f.pointer);
  const { plan, e } = f.state.started;
  assert.equal(e, event); assert.equal(plan.item, f.instance); assert.equal(plan.startPointer, f.pointer);
  assert.equal(plan.kind, 'free-instance'); assert.equal(plan.startX, 4); assert.equal(plan.startY, 5);
  assert.equal(plan.clickGeometrySelection.id, f.item.id);
  assert.equal(plan.variableAllowed({ object: f.source, prop: 'x' }), false);
  assert.equal(plan.variableAllowed({ object: f.instance, prop: 'rotation' }), false);
  assert.equal(plan.variableAllowed({ object: f.instance, prop: 'x' }), true);
  assert.deepEqual(f.calls.map(call => call[0]), ['guard', 'sources', 'clear', 'set', 'begin', 'hint', 'selectionUI', 'draw']);
});

test('unplaced and circular placements keep a live line anchor and a separate starting snapshot', () => {
  for (const placement of [undefined, { kind: 'circular' }]) {
    const f = derivedEntryFixture(); f.instance.placement = placement;
    f.entry.begin(event, f.hit, f.pointer);
    const plan = f.state.started.plan;
    assert.equal(plan.kind, 'derived-instance'); assert.equal(plan.mode, 'derived-placement');
    assert.equal(plan.anchor.x, 4); assert.equal(plan.anchor.y, 0);
    f.item.p1.y = 10; f.item.p2.y = 20;
    assert.equal(plan.anchor.y, 14); assert.equal(plan.startAnchor.y, 0);
    assert.equal(plan.clickGeometrySelection, null);
  }
});

test('source drag keeps Block or arc-endpoint operands, pointer mapping and placed-instance variable exclusions', () => {
  for (const kind of ['block', 'arc-endpoint']) {
    const f = derivedEntryFixture(); f.selection.geometryInstances = [f.instance]; f.selection.instanceGeometry = { instanceId: 'I1' };
    const owner = {}, source = kind === 'block' ? { blockProjection: true, blockInstance: owner } : {};
    f.state.resolved.item = source; f.hit.kind = 'arc-endpoint';
    f.hit.item.derivedProjection = true; f.hit.item.derivedInstance = f.instance;
    f.state.plan.variableAllowed = () => false;
    f.entry.begin(event, f.hit, f.pointer);
    assert.equal(f.state.built.kind, kind);
    if (kind === 'block') assert.equal(f.state.built.item, owner);
    else { assert.equal(f.state.built.item.arc, source); assert.equal(f.state.built.item.endpoint, 'end'); }
    assert.equal(f.state.built.pointer, f.state.resolved.pointer);
    const plan = f.state.started.plan;
    assert.equal(plan, f.state.plan); assert.equal(plan.derivedSource, source); assert.equal(plan.derivedInstance, f.instance);
    assert.equal(plan.pointerMap, f.state.resolved.mapPointer); assert.equal(plan.displayStartPointer, f.pointer);
    assert.equal(plan.variableAllowed({ object: f.instance }), false); assert.equal(plan.variableAllowed({ object: source }), true);
    assert.deepEqual(f.calls.at(-2), ['ui', false]); assert.deepEqual(f.calls.at(-1), ['draw']);
  }
});

test('unresolved, projected and fixed sources preserve selection feedback and never start a drag', () => {
  for (const reason of ['unresolved', 'projection', 'fixed']) {
    const f = derivedEntryFixture(); f.selection.geometryInstances = [f.instance]; f.selection.instanceGeometry = { instanceId: 'I1' };
    if (reason === 'unresolved') f.state.resolved = null;
    if (reason === 'projection') { f.instance.type = 'sketchProjection'; f.state.resolved.crossesSketchProjection = true; }
    if (reason === 'fixed') f.state.plan = null;
    f.entry.begin(event, f.hit, f.pointer);
    assert.equal(f.state.started, undefined); assert.equal(f.selection.geometryInstances[0], f.instance);
    assert.equal(f.calls.find(call => call[0] === 'hint')[2], 'error');
    assert.equal(f.calls.some(call => call[0] === 'reset'), reason === 'fixed');
    if (reason === 'projection') assert.equal(f.selection.instanceGeometry, null);
    assert.deepEqual(f.calls.slice(-2), [['selectionUI'], ['draw']]);
  }
});

test('missing whole-instance anchor stops after selecting the instance without starting or refreshing', () => {
  const f = derivedEntryFixture(); f.instance.placement = undefined; f.hit.item = {};
  f.entry.begin(event, f.hit, f.pointer);
  assert.equal(f.selection.geometryInstances[0], f.instance); assert.equal(f.state.started, undefined);
  assert.deepEqual(f.calls.map(call => call[0]), ['guard', 'sources', 'clear', 'set']);
});


function blockEntryFixture() {
 const events=[],state={accepted:true,plan:{id:'plan'},selected:null};
 const canvasSelection={set(kind,items){assert.equal(this,canvasSelection);events.push('select');assert.equal(kind,'blockInstances');state.selected=items;}};
 const geometryDrag={begin(event,plan){assert.equal(this,geometryDrag);assert.equal(plan,state.plan);events.push('begin');state.event=event;return state.accepted;}};
 const entry=sandbox.window.GeometryDrag.createBlockEntry({clearSelection:()=>events.push('clear'),canvasSelection,
  buildDragSession:(kind,instance,pointer)=>{events.push('plan');assert.equal(state.selected[0],instance);state.kind=kind;state.instance=instance;state.pointer=pointer;return state.plan;},
  geometryDrag,setHint:(message,type)=>events.push(['hint',message,type]),updateUI:options=>events.push(['ui',options.refreshAnalysis]),draw:()=>events.push('draw')});
 return {entry,events,state};
}

test('Block drag entry shares current instance, pointer and plan and refreshes after successful start',()=>{
 const f=blockEntryFixture(),instance={id:'B1'},pointer={x:10,y:20},event={pointerId:7};assert.deepEqual(f.events,[]);
 assert.equal(f.entry.begin(event,instance,pointer),undefined);assert.equal(f.state.kind,'block');assert.equal(f.state.instance,instance);
 assert.equal(f.state.pointer,pointer);assert.equal(f.state.event,event);
 assert.deepEqual(f.events,['clear','select','plan','begin',['hint','ブロックを移動中',undefined],['ui',false],'draw']);
 f.events.length=0;f.state.plan={id:'rotationPlan'};f.entry.begin(event,instance,pointer,true);
 assert.equal(f.state.kind,'block-rotation');assert.equal(f.events[4][1],'ブロックを回転中');
});

test('rejected Block drag retains selection and distinguishes rotation lock without success UI refresh',()=>{
 for(const [rotate,locked,message] of [[false,true,'固定されたブロックインスタンスです'],[true,false,'固定されたブロックインスタンスです'],[true,true,'回転がロックされたブロックインスタンスです']]){
  const f=blockEntryFixture(),instance={rotationLocked:locked};f.state.accepted=false;
  assert.equal(f.entry.begin({},instance,{},rotate),undefined);assert.equal(f.state.selected[0],instance);
  assert.deepEqual(f.events,['clear','select','plan','begin',['hint',message,'error'],'draw']);
 }
});

test('Block entry delegates missing plans to GeometryDrag and does not invent a second permission or lifecycle check',()=>{
 const f=blockEntryFixture(),instance={};f.state.plan=null;f.state.accepted=false;
 f.entry.begin({},instance,{});assert.deepEqual(f.events.slice(0,4),['clear','select','plan','begin']);
 assert.equal(f.events.at(-1),'draw');assert.equal(f.events.filter(e=>Array.isArray(e)&&e[0]==='ui').length,0);
});

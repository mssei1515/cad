'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function fixture() {
  const events = [], ports = {}, state = { sketch: 'S1', editable: true, selectionAllowed: true, failure: null, result: {} };
  const invoke = (owner, name) => function (...args) { assert.equal(this, owner); events.push([name, ...args]); if (state.failure) throw state.failure; return state.result; };
  const query = {}, targets = {}, dimensions = {};
  for (const name of ['canComplete', 'distanceTarget', 'resolution']) query[name] = invoke(query, name);
  targets.cancel = invoke(targets, 'cancel');
  for (const name of ['startDistanceResolution', 'startDistanceCommand', 'startDistanceValueInput']) dimensions[name] = invoke(dimensions, name);
  const factory = (name, owner) => options => { events.push(name); ports[name] = options; return owner; };
  const context = { window: { ConstraintSelectionQuery: { create: factory('query', query) },
    ConstraintTargetCommand: { create: factory('targets', targets) }, DimensionPlacementCommand: { create: factory('dimensions', dimensions) } } };
  vm.runInNewContext(fs.readFileSync('src/application/constraint_editing.js', 'utf8'), context);
  const input = { session: {}, selection: {}, pending: { read() {}, replace() {} }, candidates: {},
    lifecycle: { prepareConstraintStart() {}, prepareConstraintCancel() {}, prepareDimensionStart() {}, selectMode() {} },
    valueInput: { hide() {}, sync() {}, focus() {} }, placement: {}, types: {},
    activeSketchId: () => { events.push('active'); return state.sketch; },
    guardSketchEdit: (...args) => { events.push(['sketch-guard', ...args]); if (state.failure) throw state.failure; return state.editable; },
    guardSelectionEdit: (...args) => { events.push(['selection-guard', ...args]); return state.selectionAllowed; },
    resolveConstraintIntent() {}, constraintOperandsFromSelection() {}, syncSelectionFromConstraintOperands() {},
    startAnnotationAnchorConstraint() {}, cancelPendingCommand() {}, blurConstraintControl() {} };
  const feature = context.window.ConstraintEditing.create(input);
  return { feature, input, state, events, ports, query, targets, dimensions };
}

test('constraint assembly preserves construction order, real owners, shared sessions and distinct lifecycle/input callbacks', () => {
  const f = fixture(); assert.deepEqual(f.events, ['query', 'targets', 'dimensions']);
  assert.equal(f.feature.selectionQuery, f.query); assert.equal(f.feature.targets, f.targets); assert.equal(f.feature.dimensions, f.dimensions);
  for (const name of ['query', 'targets', 'dimensions']) assert.equal(f.ports[name].session, f.input.session);
  assert.equal(f.ports.query.selection, f.input.selection); assert.equal(f.ports.dimensions.selection, f.input.selection);
  assert.equal(f.ports.dimensions.getPending, f.input.pending.read); assert.equal(f.ports.dimensions.setPending, f.input.pending.replace);
  assert.equal(f.ports.targets.prepareStart, f.input.lifecycle.prepareConstraintStart); assert.equal(f.ports.targets.prepareCancel, f.input.lifecycle.prepareConstraintCancel);
  assert.equal(f.ports.dimensions.prepareStart, f.input.lifecycle.prepareDimensionStart); assert.equal(f.ports.dimensions.selectMode, f.input.lifecycle.selectMode);
  assert.equal(f.ports.dimensions.hideDimensionValueInput, f.input.valueInput.hide); assert.equal(f.ports.dimensions.syncDimensionValueInput, f.input.valueInput.sync);
  assert.equal(f.ports.dimensions.focusDimensionValueInput, f.input.valueInput.focus);
  assert.equal(f.ports.targets.startAnnotationAnchorConstraint, f.input.startAnnotationAnchorConstraint);
  assert.equal(f.ports.targets.blurConstraintControl, f.input.blurConstraintControl); assert.equal(f.ports.targets.types, f.input.types);
});

test('both starts use the current sketch and preserve permission order, short circuit, return value and exceptions', () => {
  const f = fixture(); assert.equal(f.ports.targets.canStart, f.ports.dimensions.canStart); f.events.length = 0;
  f.state.editable = false; assert.equal(f.ports.targets.canStart(), false);
  assert.deepEqual(f.events, ['active', ['sketch-guard', 'S1', 'create']]);
  f.events.length = 0; f.state.sketch = 'S2'; f.state.editable = true; f.state.selectionAllowed = 'allowed';
  assert.equal(f.ports.dimensions.canStart(), 'allowed');
  assert.deepEqual(f.events, ['active', ['sketch-guard', 'S2', 'create'], ['selection-guard', 'constraint']]);
  f.events.length = 0; const error = new Error('guard'); f.state.failure = error;
  assert.throws(() => f.ports.targets.canStart(), value => value === error);
  assert.deepEqual(f.events, ['active', ['sketch-guard', 'S2', 'create']]);
});

test('cross-command callbacks retain actual receivers, argument boundaries, results and original exceptions', () => {
  const f = fixture(); f.events.length = 0; const resolution = {}, pointer = {};
  assert.equal(f.ports.targets.startDistanceResolution(resolution, pointer, 'ignored'), f.state.result);
  assert.equal(f.ports.targets.startDistanceCommand('ignored'), f.state.result);
  assert.equal(f.ports.targets.startDistanceValueInput(pointer, 'ignored'), f.state.result);
  assert.equal(f.ports.targets.canCompleteConstraintCommand('distance', 'ignored'), f.state.result);
  assert.equal(f.ports.targets.distanceTargetFromSelection('ignored'), f.state.result);
  assert.equal(f.ports.dimensions.constraintResolutionFromCurrentSelection('horizontal', 'ignored'), f.state.result);
  assert.equal(f.ports.dimensions.cancelConstraintTargetCommand('message', 'ignored'), f.state.result);
  assert.deepEqual(f.events, [['startDistanceResolution', resolution, pointer], ['startDistanceCommand'], ['startDistanceValueInput', pointer],
    ['canComplete', 'distance'], ['distanceTarget'], ['resolution', 'horizontal'], ['cancel', 'message']]);
  const error = new Error('placement'); f.state.failure = error;
  assert.throws(() => f.ports.targets.startDistanceCommand(), value => value === error);
  assert.throws(() => f.ports.dimensions.cancelConstraintTargetCommand(''), value => value === error);
});

const controlsContext = { window: {} }; vm.createContext(controlsContext);
const controlSources = vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of controlSources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file,'utf8'), controlsContext, { filename: file });
function controlsFixture(build = (w, input) => w.ConstraintEditing.create(input)) {
  const w = controlsContext.window, events = [], state = { ready: false, geometry: true, canApply: false, target: null, queryError: null, pending: null };
  const ready = () => assert.equal(state.ready, true), note = name => (...args) => { ready(); events.push([name,...args]); };
  function button(dataset) {
    const attrs = {}, listeners = new Set(), classes = new Set();
    return { dataset, attrs, classList: { toggle(name,value) { if(value)classes.add(name);else classes.delete(name); }, remove(name) { classes.delete(name); }, contains: name => classes.has(name) },
      setAttribute(name,value) { attrs[name] = value; }, getAttribute: name => attrs[name],
      addEventListener(type,handler) { assert.equal(type,'click'); listeners.add(handler); }, removeEventListener(type,handler) { listeners.delete(handler); },
      click() { for(const handler of listeners)handler.call(this,{}); }, closest() { return { removeAttribute: () => events.push(['close-menu']) }; } };
  }
  const buttons = ['horizontal','distance','symmetry'].map(type => button({ constraint: type, label: type })), fix = button({}),
    menu = ['horizontal','distance','fixed'].map(type => button({ menuConstraint: type }));
  const hint = {}, document = { getElementById(id) { ready(); assert.equal(id,'hint'); return hint; } };
  const session = w.ConstraintTargetSession.create({ acceptTarget: () => ({ ok: false }) }), selection = w.CanvasSelection.create();
  const pending = { get current() { ready(); return state.pending; }, read: () => { ready(); return state.pending; },
    replace: value => { ready(); state.pending = value; events.push(['pending',value]); } };
  let controls;
  const input = { session, selection, pending,
    candidates: { distanceTargetFromTargets: () => { ready(); events.push(['distance-target']); if(state.queryError)throw state.queryError; return state.target; },
      canApplyConstraintToTargets: () => { ready(); return state.canApply; }, constraintFromTargets: () => state.createdConstraint || null,
      constraintTargetsFromOperands: () => selection.currentConstraintTargets(), distanceTargetFromOperands: () => state.target },
    lifecycle: { prepareConstraintStart: note('prepare-start'), prepareConstraintCancel: note('prepare-cancel'), prepareDimensionStart: note('prepare-dimension'), selectMode: note('select-mode') },
    valueInput: { hide() {}, sync() {}, focus() {} }, placement: { ...w.DimensionPlacement.create({ viewport: { scale: 1 } }), defaultDimensionForTarget: () => ({ x: 1, y: 2 }) },
    resolveConstraintIntent: (type, operands) => state.resolveIntent ? state.resolveIntent(type, operands) : null, constraintOperandsFromSelection: () => [], activeSketchId: () => 'S1',
    isGeometryMode: () => { ready(); return state.geometry; }, elementSketchId: item => item.sketchId, canEditSketch: () => true,
    findLineFixedConstraint: () => null, selectedGeometryItems: selection.selectedGeometryItems, guardSketchEdit: () => { ready(); return state.editable !== false; }, guardSelectionEdit: () => true,
    startAnnotationAnchorConstraint: () => false, constraintLabel: type => type, clearSelection: selection.clear, trimConstraintSelection() {},
    commitConstraintResolution() {}, syncSelectionFromConstraintOperands() {}, updateToolbar: note('toolbar'),
    updateConstraintButtons: () => { ready(); events.push(['buttons']); controls.view.update(); }, setHint: note('hint'), constraintTargetHint: type => type,
    draw: note('draw'), blurConstraintControl: note('blur'), addConstraint: note('add'), annotationAnchorConstraints: { reset: note('reset-anchor') },
    hitConstraintOperand: () => null, invalidConstraintTargetHint: () => '', toggleGeometryFixedOperand: note('operand-fixed'),
    toggleSelectedFixed: note('selected-fixed'), updateGeometrySelectionUI: note('selection-ui'), types: w.GeometrySolver,
    isPlacingInstance: () => false, cancelPendingCommand: message => { ready(); events.push(['cancel-pending',message]); state.pending = null; },
    selectedPrimitives: () => [], applicationText: (_ja,en) => en, log: note('log') };
  const feature = build(w, input, { buttons, state, events });
  controls = feature.createControls({ document, constraintButtons: buttons, constraintMenuButtons: menu, fixPointBtn: fix,
    hasSelection: () => selection.selectedElementCount() > 0, translatedExactText: value => value });
  const binding = controls.createBinding(); buttons[0].click(); assert.equal(session.command,null); assert.deepEqual(events, []);
  binding.bind(); binding.bind(); assert.deepEqual(events, []); state.ready = true;
  return { feature, controls, binding, state, session, selection, events, buttons, menu, fix, hint, w, input };
}

test('constraint feature controls share actual target, dimension and Selection state through late binding and menu delegation', () => {
  const f = controlsFixture(); f.menu[0].click(); assert.equal(f.session.command.type,'horizontal'); assert.equal(f.buttons[0].attrs['aria-pressed'],'true');
  f.menu[0].click(); assert.equal(f.session.command,null); assert.equal(f.buttons[0].attrs['aria-pressed'],'false');
  f.menu[2].click(); assert.equal(f.session.command.type,'fixed'); assert.equal(f.fix.attrs['aria-pressed'],'true'); f.fix.click(); assert.equal(f.session.command,null);
  f.state.canApply = true; f.state.target = { kind: 'line-length', value: 10 }; f.buttons[1].click();
  assert.equal(f.session.command.type,'distance'); assert.equal(f.state.pending.type,'distance-place'); assert.equal(f.state.pending.target,f.state.target);
  f.binding.dispose(); f.buttons[0].click(); assert.equal(f.session.command.type,'distance');
  f.binding.bind(); f.events.length = 0; f.buttons[0].click(); assert.equal(f.session.command.type,'horizontal');
  assert.equal(f.events.filter(event => event[0] === 'add').length,1);
  const point = new f.w.GeometrySolver.Point('P1',0,0); point.sketchId = 'S1'; f.selection.set('points',[point]);
  f.events.length = 0; f.fix.click(); assert.deepEqual(f.events,[['selected-fixed']]); assert.equal(f.session.command.type,'horizontal');
});

test('constraint control preparation retains distance exceptions, cancellation and short circuit before DOM updates', () => {
  const f = controlsFixture(), update = () => f.controls.view.update();
  f.state.pending = { type: 'distance-value', target: {} }; update(); assert.equal(f.state.pending,null);
  assert.ok(f.events.some(event => event[0] === 'cancel-pending' && event[1] === '寸法入力をキャンセルしました'));
  for(const target of [{ annotationAnchor: true },{ interval: true }]) {
    f.state.pending = { type: 'distance-value', target }; f.events.length = 0; update();
    assert.equal(f.state.pending.target,target); assert.equal(f.events.some(event => event[0] === 'distance-target'),false);
  }
  f.state.target = { kind: 'invalid' }; f.state.pending = { type: 'distance-place', target: {} }; update(); assert.equal(f.state.pending,null);
  const pending = { type: 'distance-value', target: {} }; f.state.pending = pending; f.state.geometry = false; f.events.length = 0; update();
  assert.equal(f.state.pending,pending); assert.deepEqual(f.events,[]); assert.equal(f.buttons[0].attrs['aria-disabled'],'true');
  f.state.geometry = true; f.state.queryError = new Error('distance query failed'); f.buttons[0].attrs['aria-pressed'] = 'unchanged';
  assert.throws(update,error => error === f.state.queryError); assert.equal(f.state.pending,pending); assert.equal(f.buttons[0].attrs['aria-pressed'],'unchanged');
});

function commitCompositionFixture(bound = true) {
  const f = controlsFixture(), g = f.w.GeometrySolver, model = { constraints: [] }, history = [];
  const a = Object.assign(new g.Point('P1',0,0), { sketchId:'S1' }), b = Object.assign(new g.Point('P2',10,0), { sketchId:'S1' });
  const line = Object.assign(new g.Line('L1',a,b), { sketchId:'S1' }); f.selection.set('lines',[line]);
  f.state.createdConstraint = Object.assign(new g.HorizontalConstraint(line), { sketchId:'S1' });
  const record = name => (...args) => f.events.push([name,...args]); let time = 0;
  const options = { currentScope: () => model, linesAreParallel: () => true, assignSketch: (c,id) => { c.sketchId=id;return c; }, probeRedundancy: () => ({redundant:false}),
    constraintTargetsAreActive: () => true, snapshotModelState: () => { record('capture')();return{constraints:[...model.constraints],y:b.y}; },
    restoreModelState: snapshot => { record('restore')();model.constraints=snapshot.constraints;b.y=snapshot.y; },
    solveStepNormForConstraint: () => 1, preconditionNewConstraint: record('precondition'), withTemporarySolveStepNorm: (_step,work) => work(),
    pushModelConstraint: c => { record('push')();model.constraints.push(c); },
    solveConstraintComponentAndDependents: () => { record('solve')();if(f.state.rejectSolve)b.y=33;return{success:!f.state.rejectSolve,result:{errorNorm:f.state.rejectSolve?1:0,reason:'fixture',variableCount:2,constraintCount:1}}; },
    isDimensionConstraint: () => false, isReadOnlyDimension: () => false, stabilizeActiveParameterNamespace: () => { record('stabilize')();return{success:true}; },
    constraintSketchId: c => c.sketchId, lineCollapseQuery: {find: () => null}, redundantConstraintInfo: () => null, acceptError:0.001,
    measuredConstraintTargetValue: () => 10, refreshConstraintAnalysis: record('analysis'), updateUI: record('ui'),
    recordHistory: label => { history.push(label);record('history')(label); }, isReferenceSourceSketchId: () => true, descendantSketchIds: () => ['child'], wouldCreateReferenceCycle: () => false,
    sketchName: id => id, now: () => ++time };
  const common = { canvasSelection:f.selection, guardSketchEdit:f.input.guardSketchEdit, activeSketchId:f.input.activeSketchId,
    targetFromConstraint:f.input.targetFromConstraint, clearSelection:f.input.clearSelection, setHint:f.input.setHint, draw:f.input.draw, log:f.input.log, applicationText:f.input.applicationText,
    resolveSelection:type=>f.feature.selectionQuery.resolution(type), startDistanceResolution:(resolution,pointer)=>f.feature.dimensions.startDistanceResolution(resolution,pointer) };
  f.state.ready=false;
  const support = bound ? f.feature.createCommit(options) : f.w.ConstraintCommitCommand.createWithDimensions({...options,...common});
  const intentOptions = { operands:{subjectFromOperand:o=>o,referenceTargetFromOperand:o=>o,referenceSubjectElement:o=>o.item,referenceSubjectSketchId:o=>o.sketchId},
    types:g, isActiveSketchElement:()=>true, isEditableSketchElement:()=>true };
  const resolver = bound ? support.createIntentResolver(intentOptions) : f.w.ConstraintIntentResolver.create({...intentOptions,candidates:f.input.candidates,
    activeSketchId:f.input.activeSketchId,isReferenceSourceSketchId:options.isReferenceSourceSketchId,descendantSketchIds:options.descendantSketchIds,
    wouldCreateReferenceCycle:options.wouldCreateReferenceCycle,applicationText:f.input.applicationText,invalidConstraintTargetHint:f.input.invalidConstraintTargetHint});
  f.state.resolveIntent=(type,operands)=>resolver.resolve(type,operands); assert.deepEqual(f.events,[]); f.state.ready=true;
  return{...f,...support,resolver,model,history,line,a,b};
}

test('shared constraint composition keeps actual intent, selection and commit behavior identical through success and solver rollback',()=>{
  for(const rejectSolve of [false,true]) {
    const results=[];
    for(const bound of [false,true]) {
      const f=commitCompositionFixture(bound), operand={kind:'line',line:f.line,item:f.line,relation:'active',sketchId:'S1'};
      const intent=f.resolver.resolve('horizontal',[operand]); assert.equal(intent.constraint,f.state.createdConstraint);
      f.session.begin('horizontal',[operand]); f.state.rejectSolve=rejectSolve; f.command.fromSelection('horizontal');
      assert.equal(f.b.y,0); assert.equal(f.model.constraints.length,rejectSolve?0:1);
      if(rejectSolve){assert.equal(f.selection.lines[0],f.line);assert.equal(f.history.length,0);}else{assert.equal(f.model.constraints[0].line,f.line);assert.equal(f.selection.lines.length,0);}
      results.push(JSON.stringify({events:f.events,history:f.history,trace:f.command.readPerformance()}));
    }
    assert.equal(results[1],results[0]);
  }
});

test('shared commit delegates distance to the same placement session and preserves reference rejection and edit guards',()=>{
  const results=[];
  for(const bound of [false,true]) {
    const f=commitCompositionFixture(bound), target={kind:'point-point',p1:f.a,p2:f.b};f.state.target=target;
    f.command.fromSelection('distance'); assert.equal(f.state.pending.target,target); assert.equal(f.state.pending.type,'distance-place');assert.equal(f.model.constraints.length,0);assert.equal(f.history.length,0);
    const rejected=f.resolver.resolve('horizontal',[{relation:'descendant',kind:'line',line:f.line,sketchId:'child'}]);assert.match(rejected.error,/子孫/);
    f.state.editable=false;const before=f.events.length;assert.equal(f.command.ordinary('horizontal',f.state.createdConstraint),false);assert.equal(f.events.length,before);assert.equal(f.selection.lines[0],f.line);
    results.push(JSON.stringify({events:f.events,pending:f.state.pending,history:f.history}));
  }
  assert.equal(results[1],results[0]);
});

function stagedConstraintInputFixture(bound) {
  let support, hover;
  const f = controlsFixture((w, input, { buttons, state, events }) => {
    state.language = 'en';
    const readLanguage = () => { assert.equal(state.ready,true); return state.language; };
    const feedback = w.ConstraintFeedback.create({ applicationText: input.applicationText, readLanguage });
    input.hitConstraintOperand = (pointer, type, hits) => { assert.equal(state.ready,true); events.push(['hit',pointer,type,hits]); if(state.hitError)throw state.hitError; return state.operand; };
    input.sameConstraintOperand = (a,b) => a === b;
    const options = { ...input, constraintButtons: buttons, feedback, readLanguage };
    let editing;
    if (bound) editing = w.ConstraintEditing.createWithFeedback(options);
    else {
      const presentation = w.ConstraintControlsView.createFeedback({ constraintButtons: buttons, feedback, readLanguage,
        applicationText: input.applicationText, readOperands: () => input.session.operands });
      editing = { ...w.ConstraintEditing.create({ ...input, constraintLabel: presentation.label,
        constraintTargetHint: presentation.targetHint, invalidConstraintTargetHint: presentation.invalidTargetHint }),
        constraintTargetHint: presentation.targetHint };
    }
    hover = w.CanvasHover.create({ isEndpointPoint: () => false });
    const ports = { canvasHover: hover, canvasPoint: event => { assert.equal(state.ready,true); return event.pointer; },
      referenceTargetFromOperand: operand => ({ kind: 'line', line: operand.line }) };
    if (bound) support = editing.createCommandInput(ports);
    else {
      const preview = w.ConstraintCommandInput.createRetargetHover({ getPending: input.pending.read, canvasHover: hover,
        hitConstraintOperand: input.hitConstraintOperand, sameConstraintOperand: input.sameConstraintOperand,
        resolveConstraintIntent: input.resolveConstraintIntent, referenceTargetFromOperand: ports.referenceTargetFromOperand,
        Circle: input.types.Circle, Arc: input.types.Arc });
      support = { updateHover: preview.update, createFeature: () => w.ConstraintCommandInput.createFeature({
        canvasHover: hover, canvasPoint: ports.canvasPoint, pending: input.pending, targets: input.session,
        placement: editing.dimensions, constraints: editing.targets }) };
    }
    return editing;
  });
  return { ...f, support, hover };
}

test('feedback composition matches direct wiring through live session, language, labels and actual controls', () => {
  function run(bound) {
    const f = stagedConstraintInputFixture(bound);
    f.session.replaceOperands([{ kind:'line' },{ kind:'line' }]);
    const en = f.feature.constraintTargetHint('symmetry');
    f.state.language='ja';const ja=f.feature.constraintTargetHint('symmetry');assert.notEqual(en,ja);
    f.session.replaceOperands([]);assert.notEqual(f.feature.constraintTargetHint('symmetry'),ja);
    f.buttons[0].dataset.label='Localized Horizontal';
    f.buttons[0].click();assert.equal(f.session.command.type,'horizontal');
    f.buttons[0].click();assert.equal(f.session.command,null);
    assert.ok(f.events.some(event=>event[0]==='hint'&&event[1].includes('Localized Horizontal')));
    return JSON.parse(JSON.stringify({ en,ja,events:f.events,attrs:f.buttons.map(button=>button.attrs) }));
  }
  assert.deepEqual(run(true),run(false));
});

test('staged constraint input matches direct hover and real dimension retargeting without committing or losing identity', () => {
  function run(bound) {
    const f=stagedConstraintInputFixture(bound), g=f.w.GeometrySolver;
    const p1=new g.Point('P1',0,0),p2=new g.Point('P2',10,0),p3=new g.Point('P3',0,10);
    const first=new g.Line('L1',p1,p2),second=new g.Line('L2',p1,p3),base={kind:'line',line:first},operand={kind:'line',line:second};
    const pointer={x:2,y:3},target={kind:'line-length',line:second,p1,p2:p3},draft={type:'distance-place',target:{kind:'line-length',line:first,p1,p2},operands:[base]};
    f.state.pending=draft;f.state.operand=operand;f.session.begin('distance',[base]);
    f.state.resolveIntent=()=>({target,operands:[base,operand]});
    f.state.ready=false;
    const feature=f.support.createFeature();
    const input=feature.createInput({dragging:{selectedLineGroup:()=>null,command:{begin:()=>assert.fail('not dragging')}},
      canvasSelection:f.selection,constraintTargetHint:f.feature.constraintTargetHint,setHint:f.input.setHint,
      updateGeometrySelectionUI:f.input.updateGeometrySelectionUI,draw:f.input.draw});
    f.state.ready=true;f.events.length=0;
    assert.equal(f.support.updateHover(pointer),true);assert.equal(f.hover.current.line,second);
    assert.equal(f.state.pending,draft);assert.equal(f.session.operands.length,1);assert.equal(f.session.operands[0],base);
    const marker=new Error('operand hit');f.state.hitError=marker;const before=f.hover.current;
    assert.throws(()=>f.support.updateHover(pointer),error=>error===marker);assert.equal(f.hover.current,before);assert.equal(f.state.pending,draft);f.state.hitError=null;
    f.state.resolveIntent=()=>({error:'Rejected'});
    const event={preventDefault:()=>f.events.push(['prevent'])};
    assert.equal(input.click(event,pointer,{}),true);assert.equal(f.state.pending,draft);
    assert.ok(f.events.some(event=>event[0]==='hint'&&event[1]==='Rejected'));
    f.state.target=target;f.state.resolveIntent=()=>({target,operands:[base,operand]});
    assert.equal(input.click(event,pointer,{}),true);assert.notEqual(f.state.pending,draft);
    assert.equal(f.state.pending.target,target);assert.equal(f.state.pending.pointer,pointer);
    assert.equal(f.session.operands[0],base);assert.equal(f.session.operands[1],operand);
    assert.equal(feature.dimension.isActive(),true);f.state.pending={type:'distance-value'};assert.equal(feature.dimension.isActive(),false);
    f.session.reset();f.state.pending=null;f.support.updateHover(pointer);assert.equal(f.hover.current.line,null);
    return JSON.parse(JSON.stringify(f.events));
  }
  assert.deepEqual(run(true),run(false));
});

'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function fixture(configure = () => {}) {
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
  configure(input, state, events, context, query);
  const feature = context.window.ConstraintEditing.create(input);
  return { feature, input, state, events, ports, query, targets, dimensions, context };
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
  const feature = build(w, input, { buttons, state, events, controls: { document, constraintMenuButtons: menu, fixPointBtn: fix, translatedExactText: value => value } });
  controls = feature.controls || feature.createControls({ document, constraintButtons: buttons, constraintMenuButtons: menu, fixPointBtn: fix,
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

function fixedEditingFixture() {
 const model={window:{},structuredClone};vm.createContext(model);
 const sources=vm.runInNewContext(fs.readFileSync('index.html','utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
 for(const file of sources.filter(file=>file.startsWith('src/')))vm.runInContext(fs.readFileSync(file,'utf8'),model,{filename:file});
 const types=model.window.GeometrySolver,p=Object.assign(new types.Point('P1',0,0),{sketchId:'S1'}),q=Object.assign(new types.Point('P2',10,0),{sketchId:'S1'}),line=Object.assign(new types.Line('L1',p,q),{sketchId:'S1'});
 const f=fixture((input,state,events,context,query)=>{
  Object.assign(state,{ready:false,scope:{constraints:[]},history:[],fullyFixed:false,projectionAllowed:true,batch:{points:[p],lines:[line],sketchId:'S1'},solved:{success:true,result:{success:true,errorNorm:0},dependent:{success:true}}});
  const ready=()=>assert.equal(state.ready,true,'fixed command construction must not query or edit');state.readyCheck=ready;
  input.selection=model.window.CanvasSelection.create();input.selection.set('points',[p]);input.selection.set('lines',[line]);
  Object.assign(input,{guardSketchEdit:()=>{ready();events.push('guard-sketch');return state.editable;},guardSelectionEdit:()=>{ready();events.push('guard-selection');return state.selectionAllowed;},
   elementSketchId:item=>{ready();return item.sketchId;},findLineFixedConstraint:item=>{ready();return state.scope.constraints.find(c=>c instanceof types.LineFixedConstraint&&c.line===item);},
   applicationText:(_ja,en)=>en,setHint:()=>events.push('hint'),draw:()=>events.push('draw'),log:()=>events.push('log'),clearSelection:()=>{ready();input.selection.set('points',[]);input.selection.set('lines',[]);}});
  query.fixedBatch=function(){assert.equal(this,query);ready();events.push('batch');if(state.queryError)throw state.queryError;return state.batch;};
  query.fullyFixed=function(batch){assert.equal(this,query);assert.equal(batch,state.batch);ready();events.push('fully-fixed');return state.fullyFixed;};
  context.window.GeometrySolver=types;context.window.FixedToggleCommand=Object.freeze({
   createOperand(options){events.push('fixed-operand');state.rawOperand=model.window.FixedToggleCommand.createOperand(options);return state.rawOperand;},
   createSelection(options){events.push('fixed-selection');state.rawSelection=model.window.FixedToggleCommand.createSelection(options);return state.rawSelection;}});
 });
 const {state,events}=f,ready=state.readyCheck;
 const shared={operandElement:operand=>{ready();return operand.element;},guardSketchProjectionShapeEdit:()=>{ready();events.push('projection');return state.projectionAllowed;},findArcEndpointFixedConstraint:()=>null,arcEndpointPoint:model.window.GeometryKernel.arcEndpointPoint,
  currentScope:()=>{ready();return state.scope;},sameConstraintDisplayElement:(a,b)=>a===b,
  deleteElements:({constraints})=>{ready();for(const c of constraints)state.scope.constraints.splice(state.scope.constraints.indexOf(c),1);return true;},
  commitNewConstraint:(_type,c)=>{ready();state.scope.constraints.push(c);events.push('commit');return true;},solveAndRefresh:()=>{ready();events.push('refresh');}};
 const late={blockDefinitionById:()=>null,updateUI:()=>events.push('ui'),recordHistory:label=>state.history.push(label),
  snapshotModelState:()=>{ready();events.push('snapshot');return {scope:state.scope,fixed:p.fixed,constraints:[...state.scope.constraints]};},
  restoreModelState:snapshot=>{ready();events.push('restore');state.scope=snapshot.scope;p.fixed=snapshot.fixed;state.scope.constraints.splice(0,Infinity,...snapshot.constraints);},
  pushModelConstraint:c=>{ready();state.scope.constraints.push(c);},solveSketchAndDependents:(id,snapshot)=>{ready();assert.equal(id,'S1');assert.equal(snapshot.scope,state.scope);events.push('solve');return state.solved;},acceptError:.01,refreshConstraintAnalysis:()=>events.push('analysis')};
 events.length=0;const stage=f.feature.createFixedEditing(shared);assert.deepEqual(events,['fixed-operand']);assert.equal(stage.operand,state.rawOperand);
 return {...f,stage,late,p,line,types};
}

test('fixed editing builds real operand and selection commands in separate cold stages and shares actual model and Selection',()=>{
 const f=fixedEditingFixture();assert(Object.isFrozen(f.stage));f.state.ready=true;
 assert.equal(f.stage.operand.toggle({kind:'line',element:f.line}),true);const fixed=f.state.scope.constraints[0];assert(fixed instanceof f.types.LineFixedConstraint);assert.equal(fixed.line,f.line);
 f.state.ready=false;f.events.length=0;const selected=f.stage.createSelection(f.late);assert.deepEqual(f.events,['fixed-selection']);assert.equal(selected,f.state.rawSelection);assert(Object.isFrozen(selected));
 f.state.ready=true;assert.equal(selected.toggle(),true);assert.equal(f.p.fixed,true);assert.equal(f.state.scope.constraints[0],fixed);assert.equal(f.state.scope.constraints.length,1);assert.equal(f.state.history.length,1);assert.equal(f.input.selection.points[0],f.p);
 f.state.fullyFixed=true;assert.equal(selected.toggle(),true);assert.equal(f.p.fixed,false);assert.equal(f.state.scope.constraints.length,0);
});

test('fixed editing retains failed solve restoration and selection/projection refusal before mutation',()=>{
 const f=fixedEditingFixture(),selected=f.stage.createSelection(f.late);f.state.ready=true;f.state.solved={success:false,result:{success:false,errorNorm:1}};
 assert.equal(selected.toggle(),false);assert.equal(f.p.fixed,false);assert.equal(f.state.scope.constraints.length,0);assert.equal(f.state.history.length,0);assert.equal(f.events.filter(e=>e==='restore').length,1);
 f.events.length=0;f.state.selectionAllowed=false;assert.equal(selected.toggle(),false);assert.deepEqual(f.events,['guard-selection']);
 f.state.selectionAllowed=true;f.state.projectionAllowed=false;f.events.length=0;assert.equal(selected.toggle(),false);assert.equal(f.events.includes('snapshot'),false);assert.equal(f.p.fixed,false);assert.equal(f.state.scope.constraints.length,0);
 f.state.editable=false;f.events.length=0;assert.equal(f.stage.operand.toggle({kind:'line',element:f.line}),false);assert.deepEqual(f.events,['guard-sketch']);
});

test('fixed editing reads the current scope and shared query owner at operation time and propagates query failures',()=>{
 const f=fixedEditingFixture();f.state.ready=true;f.stage.operand.toggle({kind:'line',element:f.line});const first=f.state.scope;
 f.state.scope={constraints:[]};f.stage.operand.toggle({kind:'line',element:f.line});assert.equal(first.constraints.length,1);assert.equal(f.state.scope.constraints.length,1);assert.notEqual(first.constraints[0],f.state.scope.constraints[0]);
 f.state.ready=false;const marker=new Error('batch lookup failed');f.state.queryError=marker;const selected=f.stage.createSelection(f.late);f.state.ready=true;
 const current=f.state.scope.constraints[0];assert.throws(()=>selected.toggle(),error=>error===marker);assert.equal(f.state.scope.constraints[0],current);assert.equal(f.p.fixed,false);assert.equal(f.state.history.length,0);
});

function dimensionInputDragFixture(composed) {
  let assembled, ports;
  const f = controlsFixture((w,input,{state,events}) => {
    const note = name => (...args) => { assert.equal(state.ready,true); events.push([name,...args]); };
    const viewport={scale:2};input.placement=w.DimensionPlacement.create({viewport});input.valueInput.sync=note('sync-value');input.readOnlyDimensionConstraintForPlacement=()=>null;
    state.scope={constraints:[]};state.visible=true;
    const editing=w.ConstraintEditing.create(input),support=editing.createCommandInput({canvasHover:w.CanvasHover.create({isEndpointPoint:()=>false}),
      canvasPoint:event=>event.pointer,referenceTargetFromOperand:operand=>operand});
    ports={viewport,currentScope:()=>{assert.equal(state.ready,true);return state.scope;},
      sketches:{constraintSketchId:c=>c.sketchId,isEditableSketchId:()=>state.editable!==false},
      readServices:{geometryAppearance:{isVisibleSketchId:()=>state.visible,isVisibleValue:v=>v!==false},dimensionAppearance:{effectiveDimensionAppearance:c=>({visible:c.dimension?.display?.visible!==false})}},
      pointer:{markThenCapture:note('capture'),release:note('release')},clearSnap:note('snap'),updateUI:note('ui'),recordHistory:note('history')};
    if(composed)assembled=support.createWithDragging(ports);
    else {
      const feature=support.createFeature();
      assembled={input:feature,dragging:w.DimensionDragFeature.create({placement:input.placement,viewport,canvasSelection:input.selection,currentScope:ports.currentScope,
        constraintSketchId:ports.sketches.constraintSketchId,isEditableSketchId:ports.sketches.isEditableSketchId,isVisibleSketchId:ports.readServices.geometryAppearance.isVisibleSketchId,
        effectiveDimensionAppearance:ports.readServices.dimensionAppearance.effectiveDimensionAppearance,isVisibleValue:ports.readServices.geometryAppearance.isVisibleValue,
        guardSketchEdit:input.guardSketchEdit,commandInput:feature.dimension,setHint:input.setHint,clearSnap:ports.clearSnap,hypot2:w.GeometrySolver.hypot2,
        beginPointer:ports.pointer.markThenCapture,endPointer:ports.pointer.release,draw:input.draw,updateUI:ports.updateUI,
        updateGeometrySelectionUI:input.updateGeometrySelectionUI,syncDimensionValueInput:input.valueInput.sync,recordHistory:ports.recordHistory})};
    }
    return editing;
  });
  function distance(id,y){const g=f.w.GeometrySolver,c=new g.DistanceConstraint(new g.Point(id+'a',0,y),new g.Point(id+'b',100,y),100);c.sketchId='S1';
    const target=f.w.DimensionQueries.targetFromConstraint(c);c.dimension=f.input.placement.dimensionFromAnchor(target,{x:50,y:y-20});return {constraint:c,target,dimension:c.dimension};}
  return {...f,...assembled,ports,distance};
}

test('dimension input and drag composition matches direct real owners for live groups, permissions, movement and one history entry',()=>{
  const results=[];
  for(const composed of [false,true]){
    const f=dimensionInputDragFixture(composed),a=f.distance('a',0),b=f.distance('b',40),command=f.dragging.command;
    assert.deepEqual(f.events,[]);f.state.scope.constraints=[a.constraint,b.constraint];f.selection.set('dimensionConstraints',[a.constraint,b.constraint]);
    assert.equal(f.dragging.selectedLineGroup(a.constraint).members[1].constraint,b.constraint);
    f.state.visible=false;assert.equal(f.dragging.selectedLineGroup(a.constraint),null);f.state.visible=true;
    f.state.editable=false;command.begin({pointerId:3},a,{x:0,y:0});assert.equal(command.active,false);assert.deepEqual(f.events,[]);
    f.state.editable=true;const selected=f.selection.dimensionConstraints;command.begin({pointerId:3},a,{x:0,y:0});command.update({x:12,y:8});command.finish({pointerId:3});
    assert.equal(command.active,false);assert.equal(f.selection.dimensionConstraints,selected);assert.equal(f.events.filter(e=>e[0]==='history').length,1);
    f.state.scope={constraints:[a.constraint]};assert.equal(f.dragging.selectedLineGroup(a.constraint),null);
    results.push(JSON.stringify({events:f.events,dimensions:[a.constraint.dimension,b.constraint.dimension]}));
  }
  assert.equal(results[1],results[0]);
});

test('dimension input and drag composition preserves distance continuation, threshold, shared pending and reset without extra history',()=>{
  const results=[];
  for(const composed of [false,true]){
    const f=dimensionInputDragFixture(composed),hit=f.distance('c',0),p={x:0,y:0},command=f.dragging.command;
    f.state.pending={type:'distance-place',target:hit.target,dimension:hit.dimension,operands:[]};const pending=f.state.pending;f.session.begin('distance',[]);f.state.target=hit.target;
    assert.equal(f.input.dimension.isActive(),true);command.begin({pointerId:8},hit,p,{hitD:hit});command.update({x:1,y:0});
    f.events.length=0;command.finish({pointerId:8,pointer:p});assert.equal(f.state.pending.type,'distance-value');assert.notEqual(f.state.pending,pending);
    assert.equal(f.selection.dimensionConstraint,null);assert.equal(f.events.some(e=>e[0]==='history'),false);assert.equal(command.active,false);
    f.state.pending=null;command.begin({pointerId:9},hit,p);command.reset();f.events.length=0;assert.equal(command.finish({pointerId:9}),false);assert.deepEqual(f.events,[]);
    results.push(JSON.stringify({dimension:hit.constraint.dimension,pending:f.state.pending}));
  }
  assert.equal(results[1],results[0]);
});

test('staged input construction precedes drag construction and propagates failures without reading or changing model state',()=>{
  const order=[],marker=new Error('dimension drag construction');let received;
  const f=fixture((input,_state,_events,context)=>{
    context.window.GeometrySolver={hypot2:Math.hypot};
    context.window.ConstraintCommandInput={createRetargetHover:()=>({update(){}}),createFeature:()=>{order.push('input');return {dimension:{}};}};
    context.window.DimensionDragFeature={create:options=>{order.push('drag');received=options;throw marker;}};
  });
  const support=f.feature.createCommandInput({});assert.deepEqual(order,[]);
  const scope=()=>assert.fail('early scope read'),ports={viewport:{},currentScope:scope,sketches:{},readServices:{geometryAppearance:{},dimensionAppearance:{}},pointer:{}};
  assert.throws(()=>support.createWithDragging(ports),error=>error===marker);assert.deepEqual(order,['input','drag']);assert.equal(received.currentScope,scope);assert.deepEqual(f.events,['query','targets','dimensions']);
  f.context.window.ConstraintCommandInput.createFeature=()=>{throw marker;};order.length=0;
  assert.throws(()=>support.createWithDragging(ports),error=>error===marker);assert.deepEqual(order,[]);
});

function controlsAssemblyFixture(composed, probe = {}, assemble = null) {
  let hover;
  probe.order = []; probe.ports = {}; probe.results = {};
  const f = controlsFixture((w, input, { buttons, state, events, controls }) => {
    probe.state = state; probe.input = input; state.language = 'en';
    const readLanguage = () => { assert.equal(state.ready, true); return state.language; };
    const feedback = w.ConstraintFeedback.create({ applicationText: input.applicationText, readLanguage });
    hover = w.CanvasHover.create({ isEndpointPoint: () => false });
    input.hitConstraintOperand = (pointer, type) => { assert.equal(state.ready, true); events.push(['hit', pointer, type]); if (state.hitError) throw state.hitError; return state.operand; };
    input.sameConstraintOperand = (a, b) => a === b;
    const retargeting = { canvasHover: hover, canvasPoint: event => { assert.equal(state.ready, true); return event.pointer; },
      referenceTargetFromOperand: operand => ({ kind: 'line', line: operand.line }) };
    const originals = new Map();
    for (const [namespace, method, name] of [['ConstraintControlsView', 'createFeedback', 'feedback'], ['ConstraintSelectionQuery', 'create', 'query'],
      ['ConstraintTargetCommand', 'create', 'targets'], ['DimensionPlacementCommand', 'create', 'dimensions'],
      ['ConstraintCommandInput', 'createRetargetHover', 'retarget'], ['ConstraintControlsView', 'create', 'controls']]) {
      if (!originals.has(namespace)) { originals.set(namespace, w[namespace]); w[namespace] = { ...w[namespace] }; }
      const factory = originals.get(namespace)[method];
      w[namespace][method] = options => { probe.order.push(name); probe.ports[name] = options; if (probe.failAt === name) throw probe.error;
        return probe.results[name] = factory(options); };
    }
    try {
      const options = { ...input, constraintButtons: buttons, feedback, readLanguage };
      let result;
      if (assemble) result = assemble(w, { ...options, retargeting, controls }, probe);
      else if (composed) result = w.ConstraintEditing.createWithControls({ ...options, retargeting, controls });
      else {
        const editing = w.ConstraintEditing.createWithFeedback(options), support = editing.createCommandInput(retargeting);
        const presentation = editing.createControls({ ...controls, constraintButtons: buttons, hasSelection: input.selection.hasSelection });
        result = { ...editing, input: support, controls: presentation };
      }
      assert.deepEqual(events, []); buttons[0].click(); assert.deepEqual(events, []); assert.equal(input.session.command, null);
      return result;
    } finally { for (const [namespace, original] of originals) w[namespace] = original; }
  });
  return { ...f, hover, probe, support: f.feature.input };
}

test('constraint control assembly constructs shared feedback, targets, provisional input and View once without binding early', () => {
  for (const composed of [false, true]) {
    const f = controlsAssemblyFixture(composed), { ports, results, order } = f.probe;
    assert.deepEqual(order, ['feedback', 'query', 'targets', 'dimensions', 'retarget', 'controls']); assert.deepEqual(f.events, []);
    assert.equal(f.feature.selectionQuery, results.query); assert.equal(f.feature.targets, results.targets); assert.equal(f.feature.dimensions, results.dimensions);
    assert.equal(f.support.updateHover, results.retarget.update); assert.equal(f.controls.view, results.controls);
    assert.equal(f.feature.constraintTargetHint, results.feedback.targetHint); assert.equal(ports.retarget.canvasHover, f.hover);
    assert.equal(ports.retarget.getPending, f.input.pending.read); assert.equal(ports.retarget.hitConstraintOperand, f.input.hitConstraintOperand);
    assert.equal(ports.controls.constraintButtons, f.buttons); assert.equal(ports.controls.hasSelection, f.selection.hasSelection);
    assert.equal(ports.targets.session, f.session); assert.equal(ports.dimensions.selection, f.selection);
    if (composed) assert.equal(Object.isFrozen(f.feature), true);
    f.binding.dispose(); f.buttons[0].click(); assert.equal(f.session.command, null); f.binding.bind(); f.buttons[0].click(); assert.equal(f.session.command.type, 'horizontal');
  }
});

test('assembled constraint controls and retarget hover share live Selection, target and pending sessions through refusal and errors', () => {
  const traces = [];
  for (const composed of [false, true]) {
    const f = controlsAssemblyFixture(composed), g = f.w.GeometrySolver;
    f.menu[0].click(); assert.equal(f.session.command.type, 'horizontal'); f.menu[0].click(); assert.equal(f.session.command, null);
    const line = id => new g.Line(id, new g.Point(id + 'a', 0, 0), new g.Point(id + 'b', 10, 0)), first = line('a'), second = line('b');
    const base = { kind: 'line', line: first }, operand = { kind: 'line', line: second }, target = { kind: 'line-length', line: second };
    f.state.operand = operand; f.state.resolveIntent = () => ({ target, operands: [base, operand] });
    f.session.begin('distance', [base]); const pending = f.state.pending = { type: 'distance-place', target: { kind: 'line-length', line: first }, dimension: {}, operands: [base] };
    assert.equal(f.support.updateHover({ x: 1, y: 2 }), true); assert.equal(f.hover.current.line, second); assert.equal(f.state.pending, pending);
    assert.equal(f.session.operands[0], base); assert.equal(f.session.operands.length, 1);
    f.state.language = 'ja'; assert.equal(f.probe.ports.feedback.readLanguage(), 'ja'); assert.equal(f.probe.ports.feedback.readOperands(), f.session.operands);
    const marker = new Error('hit'); f.state.hitError = marker; const priorHover = f.hover.current;
    assert.throws(() => f.support.updateHover({ x: 3, y: 4 }), error => error === marker); assert.equal(f.hover.current, priorHover); assert.equal(f.state.pending, pending);
    f.state.hitError = null; f.state.queryError = marker; f.buttons[0].attrs['aria-pressed'] = 'before';
    assert.throws(() => f.controls.view.update(), error => error === marker); assert.equal(f.buttons[0].attrs['aria-pressed'], 'before'); assert.equal(f.state.pending, pending);
    f.state.queryError = null; f.state.pending = { type: 'distance-value', target: { annotationAnchor: true } }; f.events.length = 0; f.controls.view.update();
    assert.equal(f.state.pending.target.annotationAnchor, true); assert.equal(f.events.some(event => event[0] === 'distance-target'), false);
    traces.push(JSON.stringify(f.events));
  }
  assert.equal(traces[1], traces[0]);
});

test('constraint control assembly stops at input or View construction failure before binding or changing sessions', () => {
  for (const composed of [false, true]) for (const failAt of ['retarget', 'controls']) {
    const marker = new Error(failAt), probe = { failAt, error: marker };
    assert.throws(() => controlsAssemblyFixture(composed, probe), error => error === marker);
    assert.deepEqual(probe.order, ['feedback', 'query', 'targets', 'dimensions', 'retarget', ...(failAt === 'controls' ? ['controls'] : [])]);
    assert.equal(probe.state.ready, false); assert.equal(probe.state.pending, null); assert.equal(probe.input.session.command, null);
    assert.equal(probe.input.selection.hasSelection(), false);
  }
});

function editingOwnersFixture(composed, probe = {}) {
  const f = controlsAssemblyFixture(true, probe, (w, options) => {
    Object.assign(options, { selectedGeometryItems: options.selection.selectedGeometryItems, trimConstraintSelection: options.selection.trimConstraintSelection,
      selectedPrimitives: options.selection.selectedPrimitives, targetFromConstraint: w.DimensionQueries.targetFromConstraint,
      angleDegrees: w.DimensionQueries.angleDegrees, angleDimensionAngles: w.DimensionQueries.angleDimensionAngles,
      types: { Circle: w.GeometrySolver.Circle, Arc: w.GeometrySolver.Arc } });
    const originals = Object.fromEntries(['commitConstraintResolution','addConstraint','toggleGeometryFixedOperand','toggleSelectedFixed'].map(name => [name, options[name]]));
    for (const name of Object.keys(originals)) options[name] = (...args) => { assert.equal(probe.commandsReady, true, 'late commands must not run during construction'); return originals[name](...args); };
    options.controls.document.querySelectorAll = () => assert.fail('prepared controls must not be requeried');
    const controls = Object.freeze({ constraintButtons: options.constraintButtons, constraintMenuButtons: options.controls.constraintMenuButtons, fixPointBtn: options.controls.fixPointBtn });
    const settings = { applicationText: options.applicationText, translatedExactText: options.controls.translatedExactText, get language() { return options.readLanguage(); } };
    const input = {
      document: options.controls.document, controls,
      interaction: { selection: options.selection, hover: options.retargeting.canvasHover, lifecycle: options.lifecycle, access: { guardSketchEdit: options.guardSketchEdit, guardSelectionEdit: options.guardSelectionEdit } },
      sessions: { targets: options.session, pending: options.pending },
      sketches: { activeSketchId: options.activeSketchId, elementSketchId: options.elementSketchId, canEditSketch: options.canEditSketch },
      presentation: { settings, constraintFeedback: options.feedback, setHint: options.setHint, draw: options.draw, updateGeometrySelectionUI: options.updateGeometrySelectionUI, log: options.log },
      operands: { candidates: options.candidates, operands: { referenceTargetFromOperand: options.retargeting.referenceTargetFromOperand, makeConstraintOperand: options.makeConstraintOperand, sameConstraintOperand: options.sameConstraintOperand },
        fromSelection: options.constraintOperandsFromSelection, syncSelection: options.syncSelectionFromConstraintOperands },
      viewport: { canvasPoint: options.retargeting.canvasPoint }, annotationFeature: { startAnchorConstraint: options.startAnnotationAnchorConstraint, anchors: options.annotationAnchorConstraints },
      instances: { isPlacing: options.isPlacingInstance }, valueInput: options.valueInput, resolveConstraintIntent: options.resolveConstraintIntent,
      isGeometryMode: options.isGeometryMode, findLineFixedConstraint: options.findLineFixedConstraint, clearSelection: options.clearSelection,
      commitConstraintResolution: options.commitConstraintResolution, updateToolbar: options.updateToolbar, updateConstraintButtons: options.updateConstraintButtons,
      blurConstraintControl: options.blurConstraintControl, addConstraint: options.addConstraint, hitConstraintOperand: options.hitConstraintOperand,
      toggleGeometryFixedOperand: options.toggleGeometryFixedOperand, toggleSelectedFixed: options.toggleSelectedFixed, geometryInstanceBundle: options.geometryInstanceBundle,
      cancelPendingCommand: options.cancelPendingCommand, placement: options.placement, readOnlyDimensionConstraintForPlacement: options.readOnlyDimensionConstraintForPlacement,
      addReadOnlyDimensionConstraint: options.addReadOnlyDimensionConstraint,
    };
    probe.ownerInputs = input; probe.originalOptions = options;
    return composed ? w.ConstraintEditing.createForEditing(input) : w.ConstraintEditing.createWithControls(options);
  });
  probe.commandsReady = true; return f;
}

test('constraint editing owners retain cold Feedback/Input/Controls stages, prepared nodes, actual sessions and late callbacks', () => {
  for (const composed of [false, true]) {
    const f = editingOwnersFixture(composed), { ports, results, ownerInputs: input } = f.probe;
    assert.deepEqual(f.probe.order, ['feedback','query','targets','dimensions','retarget','controls']); assert.deepEqual(f.events, []);
    assert.equal(ports.feedback.constraintButtons, f.buttons); assert.equal(ports.controls.constraintMenuButtons, f.menu); assert.equal(ports.controls.fixPointBtn, f.fix);
    assert.equal(ports.query.session, f.session); assert.equal(ports.targets.session, f.session); assert.equal(ports.dimensions.selection, f.selection);
    assert.equal(ports.query.constraintOperandsFromSelection, input.operands.fromSelection); assert.equal(ports.targets.syncSelectionFromConstraintOperands, input.operands.syncSelection);
    assert.equal(ports.targets.commitConstraintResolution, input.commitConstraintResolution); assert.equal(ports.targets.addConstraint, input.addConstraint);
    assert.equal(ports.targets.types.Circle, f.w.GeometrySolver.Circle); assert.equal(ports.retarget.canvasHover, f.hover);
    assert.equal(f.feature.constraintTargetHint, results.feedback.targetHint); assert.equal(Object.isFrozen(f.feature), true);
    f.binding.dispose(); f.buttons[0].click(); assert.equal(f.session.command, null); f.binding.bind(); f.buttons[0].click(); assert.equal(f.session.command.type, 'horizontal');
  }
});

test('constraint editing owners preserve live language, menu cancellation, hover identity and query failure boundaries', () => {
  const traces=[];for (const composed of [false,true]) {
    const f=editingOwnersFixture(composed),g=f.w.GeometrySolver;
    f.menu[0].click();assert.equal(f.session.command.type,'horizontal');f.menu[0].click();assert.equal(f.session.command,null);
    f.state.language='ja';assert.equal(f.probe.ports.feedback.readLanguage(),'ja');assert.equal(f.probe.ports.feedback.readOperands(),f.session.operands);
    const first=new g.Line('a',new g.Point('a1',0,0),new g.Point('a2',10,0)),second=new g.Line('b',new g.Point('b1',0,0),new g.Point('b2',10,0));
    const base={kind:'line',line:first},operand={kind:'line',line:second},target={kind:'line-length',line:second};
    f.state.operand=operand;f.state.resolveIntent=()=>({target,operands:[base,operand]});f.session.begin('distance',[base]);
    const pending=f.state.pending={type:'distance-place',target:{kind:'line-length',line:first},dimension:{},operands:[base]};
    assert.equal(f.support.updateHover({x:1,y:2}),true);assert.equal(f.hover.current.line,second);assert.equal(f.state.pending,pending);assert.equal(f.session.operands[0],base);
    const marker=new Error('owner hit failed'),hover=f.hover.current;f.state.hitError=marker;
    assert.throws(()=>f.support.updateHover({x:3,y:4}),error=>error===marker);assert.equal(f.hover.current,hover);assert.equal(f.state.pending,pending);
    f.state.hitError=null;f.state.queryError=marker;f.buttons[0].attrs['aria-pressed']='before';
    assert.throws(()=>f.controls.view.update(),error=>error===marker);assert.equal(f.buttons[0].attrs['aria-pressed'],'before');assert.equal(f.state.pending,pending);
    traces.push(JSON.stringify(f.events));
  }assert.equal(traces[1],traces[0]);
});

test('constraint editing owners retain failure identity and stop before later construction or binding', () => {
  const order=['feedback','query','targets','dimensions','retarget','controls'];
  for (const composed of [false,true]) for (const failAt of ['feedback','query','retarget','controls']) {
    const probe={failAt,error:new Error(failAt)};assert.throws(()=>editingOwnersFixture(composed,probe),error=>error===probe.error);
    assert.deepEqual(probe.order,order.slice(0,order.indexOf(failAt)+1));assert.equal(probe.state.ready,false);assert.equal(probe.state.pending,null);
    assert.equal(probe.input.session.command,null);assert.equal(probe.input.selection.hasSelection(),false);assert.notEqual(probe.commandsReady,true);
  }
});

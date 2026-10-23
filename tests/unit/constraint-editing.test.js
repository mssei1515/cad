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
function controlsFixture() {
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
  const feature = w.ConstraintEditing.create({ session, selection, pending,
    candidates: { distanceTargetFromTargets: () => { ready(); events.push(['distance-target']); if(state.queryError)throw state.queryError; return state.target; },
      canApplyConstraintToTargets: () => { ready(); return state.canApply; }, constraintFromTargets: () => null },
    lifecycle: { prepareConstraintStart: note('prepare-start'), prepareConstraintCancel: note('prepare-cancel'), prepareDimensionStart: note('prepare-dimension'), selectMode: note('select-mode') },
    valueInput: { hide() {}, sync() {}, focus() {} }, placement: { defaultDimensionForTarget: () => ({ x: 1, y: 2 }) },
    resolveConstraintIntent: () => null, constraintOperandsFromSelection: () => [], activeSketchId: () => 'S1',
    isGeometryMode: () => { ready(); return state.geometry; }, elementSketchId: item => item.sketchId, canEditSketch: () => true,
    findLineFixedConstraint: () => null, selectedGeometryItems: selection.selectedGeometryItems, guardSketchEdit: () => true, guardSelectionEdit: () => true,
    startAnnotationAnchorConstraint: () => false, constraintLabel: type => type, clearSelection: selection.clear, trimConstraintSelection() {},
    commitConstraintResolution() {}, syncSelectionFromConstraintOperands() {}, updateToolbar: note('toolbar'),
    updateConstraintButtons: () => { ready(); events.push(['buttons']); controls.view.update(); }, setHint: note('hint'), constraintTargetHint: type => type,
    draw: note('draw'), blurConstraintControl: note('blur'), addConstraint: note('add'), annotationAnchorConstraints: { reset: note('reset-anchor') },
    hitConstraintOperand: () => null, invalidConstraintTargetHint: () => '', toggleGeometryFixedOperand: note('operand-fixed'),
    toggleSelectedFixed: note('selected-fixed'), updateGeometrySelectionUI: note('selection-ui'), types: w.GeometrySolver,
    isPlacingInstance: () => false, cancelPendingCommand: message => { ready(); events.push(['cancel-pending',message]); state.pending = null; },
    selectedPrimitives: () => [], applicationText: (_ja,en) => en, log: note('log') });
  controls = feature.createControls({ document, constraintButtons: buttons, constraintMenuButtons: menu, fixPointBtn: fix,
    hasSelection: () => selection.selectedElementCount() > 0, translatedExactText: value => value });
  const binding = controls.createBinding(); buttons[0].click(); assert.equal(session.command,null); assert.deepEqual(events, []);
  binding.bind(); binding.bind(); assert.deepEqual(events, []); state.ready = true;
  return { feature, controls, binding, state, session, selection, events, buttons, menu, fix, hint, w };
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

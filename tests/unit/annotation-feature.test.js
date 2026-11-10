'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function fixture(build = (w, input) => w.AnnotationFeature.create(input)) {
  const events = [], ports = {}, item = { id: 'AN1', sketchId: 'S1', position: { x: 1, y: 2 } };
  const state = { scope: { annotations: [item], constraints: ['base'], parameters: [{ name: 'p' }] },
    scale: 2, scaleReads: 0, count: 1, result: { id: 'result' }, command: null, operands: [], dimensions: ['dimension'], allowed: true };
  const step = name => (...args) => { events.push([name, ...args]); return state.result; };
  const renderer = { annotationPlacementAnchor(element) { assert.equal(this, undefined); return element.position; },
    annotationLeaderDisplayGeometry: step('leader'),
    annotationTextLayout(element) { assert.equal(this, undefined); events.push(['layout', element]); return 'layout' in state ? state.layout : state.result; },
    annotationTextMetrics(...args) { assert.equal(this, undefined); events.push(['metrics', ...args]); return state.metrics; } };
  const spatial = {}, layer = {}, materialization = { materialize(...args) { assert.equal(this, materialization); return state.result; } };
  const anchors = { startFromSelection(type, element) { assert.equal(this, anchors); events.push(['start', type, element]); return element ? state.result : false; } };
  const dimensions = { entries() { assert.equal(this, dimensions); return state.dimensions; } };
  const command = { preview() { assert.equal(this, command); return state.result; } }, parameterCommand = { commit: step('parameter-commit') },
    textEditing = { commit: step('text-commit') }, editor = {}, drag = {};
  const factory = (name, value) => options => { events.push(name); ports[name] = options; return value; };
  const context = { window: { AnnotationDisplay: { create: factory('display', { renderer, layer, createSpatialQueries: () => spatial }) }, AnnotationAnchorConstraints: {
    createMaterialization: factory('materialization', materialization), create: factory('anchors', anchors), createDimensions: factory('dimensions', dimensions),
  }, AnnotationCommand: { create: factory('command', command), createTextEditing: factory('text-editing', textEditing) },
    AnnotationParameterCommand: { create: factory('parameter-editing', parameterCommand) },
    AnnotationInputController: { create: factory('editor', editor) }, AnnotationDrag: { create: factory('drag', drag) } } };
  vm.runInNewContext(fs.readFileSync('src/application/annotation_feature.js', 'utf8'), context);
  const input = Object.fromEntries(['canvasThemeColor', 'effectiveAnnotationStyle', 'annotationLeaderAnchor', 'resolveGeometryRef',
    'isEditableSketchElement', 'resizeEnabled', 'activeSketchId', 'allAnnotations', 'isVisibleValue', 'isVisibleSketchId',
    'isReferenceSourceSketchId', 'geometryRefForItem', 'constraintOperandsFromSelection', 'recordHistory', 'updateUI', 'draw',
    'setHint', 'cancelPendingCommand', 'cancelConstraintTargetCommand', 'applicationText', 'startDistanceResolution',
    'defaultDimensionForTarget', 'normalizeDimension', 'evaluateDimensionExpressionDraft', 'parameterErrorText',
    'exitDrawMode', 'nextAnnotationId', 'canCreateInActiveSketch', 'rejectRootSketchCreation', 'clearSelection', 'updateToolbar',
    'annotationLeaderTargetFromHit', 'applyStyle', 'lastPointer', 'readHover', 'readExportFrame'].map(name => [name, step(name)]));
  Object.assign(input, { ctx: {}, surface: {}, viewport: { get scale() { state.scaleReads++; return state.scale; } },
    currentScope: () => state.workspace || ({ id: 'workspace' }), readEditingScope: () => { events.push('scope'); return state.scopes?.shift() || state.scope; },
    canvasSelection: { annotations: [item], selectedElementCount: () => state.count, set: step('select') },
    constraintTargetSession: { get command() { return state.command; }, get operands() { return state.operands; },
      replaceCommand(value) { assert.equal(this, input.constraintTargetSession); state.command = value; } },
    pendingCommandSession: { read: step('pending-read'), replace: step('pending-replace') },
    elementSketchId: element => { events.push('elementSketchId'); return element.sketchId; },
    guardSketchEdit: (...args) => { events.push('guard'); state.guardArgs = args; return state.allowed; },
    ensureDimensionParameter: (element, scope) => { events.push(['ensure', element, scope]); if (state.nextScope) state.scope = state.nextScope; },
    parameterNamespace: { renameDimension: step('rename'), allocateDimensionParameterName(scope) { assert.equal(this, input.parameterNamespace); state.allocated = scope; return 'd1'; },
      validateNewDimensionParameter(draft, scope) { assert.equal(this, input.parameterNamespace); return { draft, scope }; },
      evaluateParameterNamespace(scope) { assert.equal(this, input.parameterNamespace); events.push(['evaluate', scope]); } },
  });
  const feature = build(context.window, input, state, events);
  return { feature, input, state, item, events, ports, renderer, layer, spatial, materialization, anchors, dimensions, command, editor, parameterCommand, textEditing, drag };
}

test('annotation assembly retains construction order, shared owners and lazy preview, scope and scale reads', () => {
  const f = fixture();
  assert.deepEqual(f.events, ['display', 'materialization', 'anchors', 'dimensions', 'command']);
  assert.equal(f.state.scaleReads, 0);
  for (const name of ['renderer', 'layer', 'spatial', 'anchors', 'dimensions', 'command']) assert.equal(f.feature[name], f[name]);
  assert.equal(f.ports.command.currentScope, f.input.currentScope);
  assert.equal(f.ports.command.getPending, f.input.pendingCommandSession.read);
  assert.equal(f.ports.command.setPending, f.input.pendingCommandSession.replace);
  assert.equal(f.ports.command.applyStyle, f.input.applyStyle);
  assert.equal(f.ports.command.annotationTextLayout, f.renderer.annotationTextLayout);
  assert.equal(f.ports.display.readPreview(), f.state.result);
  assert.equal(f.feature.placementAnchor(f.item), f.item.position);
  assert.equal(f.ports.dimensions.capturePosition(f.item), f.state.result);
  f.state.scale = 7; assert.equal(f.ports.command.viewScale(), 7);
});

test('mixed selection entry, projection guards and distinct preparation sequences keep their original order', () => {
  const f = fixture(); f.events.length = 0; f.state.count = 2;
  assert.equal(f.ports.anchors.selectedAnnotation(), null);
  assert.equal(f.feature.startAnchorConstraint('horizontal'), f.state.result);
  assert.deepEqual(f.events, [['start', 'horizontal', f.item]]);
  assert.equal(f.feature.startAnchorConstraint('horizontal', null), false);
  const projected = { ...f.item, blockProjection: true }; f.events.length = 0;
  assert.equal(f.ports.anchors.canEdit(projected), false); assert.deepEqual(f.events, []);
  assert.equal(f.ports.command.canEdit(projected), false); assert.deepEqual(f.events, ['elementSketchId', 'guard']);
  f.events.length = 0; f.ports.anchors.cancelCommands(); f.ports.command.prepare();
  assert.deepEqual(f.events, [['cancelPendingCommand', ''], ['cancelConstraintTargetCommand', ''], ['exitDrawMode'], ['cancelConstraintTargetCommand', '']]);
});

test('parameter callbacks use live editing scopes, preserve shallow copy boundaries and evaluate after ensuring', () => {
  const f = fixture(); assert.equal(f.ports.command.nextParameterName(), 'd1');
  const copy = f.state.allocated;
  assert.notEqual(copy.parameters, f.state.scope.parameters); assert.notEqual(copy.parameters[0], f.state.scope.parameters[0]);
  assert.notEqual(copy.annotations, f.state.scope.annotations); assert.equal(copy.annotations[0], f.item);
  copy.parameters[0].name = 'changed'; assert.equal(f.state.scope.parameters[0].name, 'p');
  const next = { annotations: [], constraints: [], parameters: [] }; f.state.nextScope = next; f.events.length = 0;
  const old = f.state.scope; f.ports.command.commitParameter(f.item);
  assert.deepEqual(f.events, ['scope', ['ensure', f.item, old], 'scope', ['evaluate', next]]);
  assert.equal(f.ports.command.validateParameter('draft').scope, next);
});

test('dimension view scopes retain separate reads, actual dimension entries and unbound renderer calls', () => {
  const f = fixture(), spread = { tag: 'first', constraints: ['first'] }, constraints = { constraints: ['second'] };
  f.state.scopes = [spread, constraints];
  const result = f.feature.dimensionScope();
  assert.equal(result.tag, 'first'); assert.equal(JSON.stringify(result.constraints), '["second","dimension"]');
  assert.deepEqual(spread.constraints, ['first']); assert.deepEqual(constraints.constraints, ['second']);
  const error = new Error('original renderer failure');
  f.item.position = null; assert.equal(f.feature.placementAnchor(f.item), null);
  Object.defineProperty(f.item, 'position', { get() { throw error; } });
  assert.throws(() => f.feature.placementAnchor(f.item), value => value === error);
});

test('existing annotation editor is generated separately and keeps real commands, workspace lookup and preparation order', () => {
  const f = fixture(); f.events.length = 0;
  const options = { document: {}, host: {}, capture() {}, restore() {}, guardDimensionSymbolDeletion() {},
    readParameterNamespace: () => f.state.namespace, expressionFromUserInput() {}, stabilize() {}, resetDrag: () => f.events.push('drag-reset'),
    toScreen() {}, expressionInputValue() {} };
  const editor = f.feature.createEditor(options);
  assert.deepEqual(f.events, ['parameter-editing', 'text-editing', 'editor']);
  assert.equal(editor.controller, f.editor); assert.equal(editor.commitParameterEdit, f.parameterCommand.commit);
  assert.equal(f.ports.editor.commit, f.textEditing.commit); assert.equal(f.ports['text-editing'].commitParameterEdit, f.parameterCommand.commit);
  assert.equal(f.ports.editor.getPending, f.input.pendingCommandSession.read); assert.equal(f.ports.editor.setPending, f.input.pendingCommandSession.replace);
  assert.equal(f.ports['parameter-editing'].renameParameter, f.input.parameterNamespace.renameDimension);
  f.state.workspace = { annotations: [f.item] }; f.state.scope.annotations = [];
  assert.equal(f.ports.editor.find(f.item.id), f.item);
  f.state.namespace = { id: 'current-parameter-namespace' }; f.events.length = 0;
  f.ports['parameter-editing'].ensureParameter(f.item);
  assert.deepEqual(f.events, [['ensure', f.item, f.state.namespace]]);
  f.events.length = 0; f.ports.editor.prepare(); f.ports.editor.select(f.item);
  assert.deepEqual(f.events.slice(0, 5), [['exitDrawMode'], ['cancelConstraintTargetCommand', ''], ['cancelPendingCommand', ''], 'drag-reset', ['clearSelection']]);
  assert.equal(f.events.length, 6); assert.equal(f.events[5][0], 'select'); assert.equal(f.events[5][1], 'annotations');
  assert.equal(f.events[5][2].length, 1); assert.equal(f.events[5][2][0], f.item);
  f.events.length = 0; assert.equal(f.ports.editor.canEdit({ ...f.item, blockProjection: true }), false);
  assert.deepEqual(f.events, ['elementSketchId', 'guard']);
});

test('owned editor uses the same Parameter helpers and viewport projection with real commit, live Workspace and rollback', () => {
  const actual = { window: {} }; vm.runInNewContext(fs.readFileSync('src/commands/annotation_parameter_command.js', 'utf8'), actual);
  const outcomes = [];
  for (const owned of [false, true]) {
    let parameterPorts;
    const f = fixture((w, input) => {
      w.AnnotationParameterCommand = { create(options) { parameterPorts = options; return actual.window.AnnotationParameterCommand.create(options); } };
      return w.AnnotationFeature.create(input);
    });
    const namespace = f.input.parameterNamespace, calls = [];
    namespace.expressionFromUserInput = function(value) { assert.equal(this, undefined); assert.equal(arguments.length, 1); calls.push('expression'); return value.slice(1); };
    namespace.expressionInputValue = item => item.expression;
    f.input.viewport.worldToCanvasScreen = point => ({ x: point.x * 2, y: point.y * 2 });
    f.item.text = 'Current note'; f.state.workspace = { id: 'host', annotations: [f.item] };
    let solved = { success: true };
    const options = { document: {}, host: {}, capture: () => { calls.push('capture'); return structuredClone(f.item); },
      restore(snapshot) { calls.push('restore'); for (const key of Object.keys(f.item)) delete f.item[key]; Object.assign(f.item, snapshot); },
      guardDimensionSymbolDeletion: () => true, stabilize: () => solved, resetDrag() {} };
    f.events.length = 0;
    const editor = owned ? f.feature.createEditorForEditing(options) : f.feature.createEditor({ ...options,
      readParameterNamespace: f.input.currentScope, expressionFromUserInput: namespace.expressionFromUserInput,
      expressionInputValue: namespace.expressionInputValue, toScreen: f.input.viewport.worldToCanvasScreen });
    assert.equal(editor.controller, f.editor); assert.equal(editor.commitParameterEdit, f.ports['text-editing'].commitParameterEdit);
    assert.equal(parameterPorts.expressionFromUserInput, namespace.expressionFromUserInput);
    assert.equal(f.ports.editor.expressionInputValue, namespace.expressionInputValue); assert.equal(f.ports.editor.toScreen, f.input.viewport.worldToCanvasScreen);
    assert.deepEqual(calls, []); assert.equal(f.state.scaleReads, 0);
    assert.equal(editor.commitParameterEdit(f.item, 'annotation-parameter-enabled', true), true);
    assert.equal(f.item.style.prefix, 'Current note'); assert.equal(f.events.find(e => e[0] === 'ensure')[2], f.state.workspace);
    const bound = f.state.scope; f.state.workspace = { id: 'local', annotations: [f.item] }; f.item.parameterEnabled = false; f.events.length = 0;
    assert.equal(editor.commitParameterEdit(f.item, 'annotation-parameter-enabled', true), true);
    assert.equal(f.events.find(e => e[0] === 'ensure')[2], f.state.workspace); assert.equal(f.state.scope, bound);
    assert.equal(editor.commitParameterEdit(f.item, 'annotation-expression', '=n+2'), true); assert.equal(f.item.expression, 'n+2');
    const before = JSON.stringify(f.item); solved = { success: false, result: { reason: 'rejected' } };
    assert.equal(editor.commitParameterEdit(f.item, 'annotation-expression', '=rollback'), false); assert.equal(JSON.stringify(f.item), before);
    assert.equal(calls.at(-1), 'restore'); outcomes.push(JSON.stringify({ item: f.item, calls }));
  }
  assert.equal(outcomes[1], outcomes[0]);
});

test('owned drag retains pointer functions, resize receiver and argument boundary, live appearance methods and original errors', () => {
  const outcomes = [];
  for (const owned of [false, true]) {
    const calls = [], result = {}, failure = new Error('resize failed'); let ready = false, appearanceReads = 0, currentAppearance;
    const f = fixture((w, input) => w.AnnotationFeature.create({ ...input, readAppearance: () => {
      assert.equal(ready, true, 'appearance is initialized after the drag factory'); appearanceReads++; return currentAppearance;
    } }));
    const appearance = { applyAnnotationStyleValue(item, key, height) {
      assert.equal(this, appearance); assert.equal(arguments.length, 3); calls.push([item, key, height]); return result;
    } };
    function begin(id) { assert.equal(this, undefined); calls.push(['begin', id]); return result; }
    function end(id) { assert.equal(this, undefined); calls.push(['end', id]); return result; }
    const constrained = { begin }, pointer = { captureThenMark: begin, release: end };
    const drag = owned ? f.feature.createDragForEditing({ constrained, pointer }) : f.feature.createDrag({
      beginConstrainedDrag: constrained.begin, resizeText: (item, height) => currentAppearance.applyAnnotationStyleValue(item, 'textHeight', height),
      beginPointer: pointer.captureThenMark, endPointer: pointer.release });
    assert.equal(drag, f.drag); assert.deepEqual(calls, []); assert.equal(appearanceReads, 0); currentAppearance = appearance; ready = true;
    assert.equal(f.ports.drag.beginConstrainedDrag, constrained.begin); assert.equal(f.ports.drag.beginPointer, pointer.captureThenMark); assert.equal(f.ports.drag.endPointer, pointer.release);
    const resize = f.ports.drag.resizeText; assert.equal(resize.length, 2); assert.equal(resize(f.item, 12, 'ignored'), result);
    assert.equal(calls[0][0], f.item); assert.equal(calls[0][1], 'textHeight'); assert.equal(calls[0][2], 12);
    appearance.applyAnnotationStyleValue = function() { assert.equal(this, appearance); throw failure; };
    assert.throws(() => resize(f.item, 14), error => error === failure);
    const replacement = { applyAnnotationStyleValue() { assert.equal(this, replacement); return result; } }; currentAppearance = replacement;
    assert.equal(resize(f.item, 16), result); assert.equal(appearanceReads, owned ? 3 : 0);
    const start = f.ports.drag.beginPointer, stop = f.ports.drag.endPointer; assert.equal(start(7), result); assert.equal(stop(7), result);
    outcomes.push(JSON.stringify(calls));
  }
  assert.equal(outcomes[1], outcomes[0]);
});

test('owned editor and drag preserve factory failure stages and stop before creating later owners', () => {
  for (const owned of [false, true]) for (const stage of ['parameter-editing', 'text-editing', 'editor', 'drag']) {
    let owner;
    const f = fixture((w, input) => { owner = w; return w.AnnotationFeature.create(input); });
    const failure = new Error(stage), keys = { 'parameter-editing': ['AnnotationParameterCommand', 'create'],
      'text-editing': ['AnnotationCommand', 'createTextEditing'], editor: ['AnnotationInputController', 'create'], drag: ['AnnotationDrag', 'create'] };
    const [name, method] = keys[stage]; owner[name][method] = () => { f.events.push(stage); throw failure; }; f.events.length = 0;
    const create = stage === 'drag' ? () => owned ? f.feature.createDragForEditing({ constrained: {}, pointer: {} }) : f.feature.createDrag({})
      : () => owned ? f.feature.createEditorForEditing({}) : f.feature.createEditor({});
    assert.throws(create, error => error === failure);
    const order = stage === 'drag' ? ['drag'] : ['parameter-editing', 'text-editing', 'editor'];
    assert.deepEqual(f.events, order.slice(0, order.indexOf(stage) + 1));
  }
});

test('editor layout uses live scale and preserves layout-first, text and leader metric fallback without changing boxes', () => {
  const f = fixture(); f.feature.createEditor({});
  f.state.layout = { x: 3, y: 4, fontSize: 2 }; f.state.scale = 5; f.events.length = 0;
  const box = f.ports.editor.layout(f.item); assert.equal(box.screenFontSize, 10); assert.notEqual(box, f.state.layout);
  assert.equal(f.state.layout.screenFontSize, undefined); assert.deepEqual(f.events, [['layout', f.item]]);
  f.state.layout = null; f.state.metrics = { x: 7, y: 8, fontSize: 4 }; f.state.scale = 3; f.events.length = 0;
  assert.equal(f.ports.editor.layout(f.item).screenFontSize, 12); assert.deepEqual(f.events, [['layout', f.item], ['metrics', f.item, f.item]]);
  f.item.type = 'leader'; f.events.length = 0;
  assert.equal(f.ports.editor.layout(f.item).screenFontSize, 12);
  assert.deepEqual(f.events, [['layout', f.item], ['leader', f.item], ['metrics', f.item, f.state.result]]);
});

test('normal drag reuses the actual owner and callbacks without constructing early or changing pointer/error boundaries', () => {
  const f = fixture(); assert.equal(f.ports.drag, undefined); f.events.length = 0;
  const options = { beginConstrainedDrag() {}, resizeText() {}, beginPointer() {}, endPointer() {} };
  assert.equal(f.feature.createDrag(options), f.drag); assert.deepEqual(f.events, ['drag']);
  for (const key of Object.keys(options)) assert.equal(f.ports.drag[key], options[key]);
  assert.equal(f.ports.drag.canvasSelection, f.input.canvasSelection);
  assert.equal(f.ports.drag.materializeAnchor, f.feature.materialize);
  assert.equal(f.ports.drag.annotationLeaderDisplayGeometry, f.renderer.annotationLeaderDisplayGeometry);
  assert.equal(f.ports.drag.annotationTextLayout, f.renderer.annotationTextLayout);
  assert.equal(f.ports.drag.recordHistory, f.input.recordHistory);
});

test('normal drag resolves current editing identities lazily and guards the annotation own sketch without normalization', () => {
  const f = fixture(); f.feature.createDrag({}); f.events.length = 0;
  for (const id of [null, undefined, '', 0]) assert.equal(f.ports.drag.annotationById(id), null);
  assert.deepEqual(f.events, []); f.state.workspace = { annotations: [{ ...f.item, sketchId: 'other' }] };
  assert.equal(f.ports.drag.annotationById(f.item.id), f.item);
  const replacement = { ...f.item, sketchId: 'block-scope' }; f.state.scope = { annotations: [replacement] };
  assert.equal(f.ports.drag.annotationById(f.item.id), replacement); assert.equal(f.ports.drag.annotationById('missing'), null);
  f.events.length = 0; assert.equal(f.ports.drag.canEdit(replacement), true);
  assert.deepEqual(f.events, ['guard']); assert.deepEqual(f.state.guardArgs, ['block-scope']);
  f.state.allowed = false; assert.equal(f.ports.drag.canEdit({}), false); assert.equal(f.state.guardArgs[0], undefined);
});

function editingFixture(composed=true, assemble=null) {
  let options, lateDrag, lateAppearance, ownerState;
  const f=fixture((w,p,state,events)=>{
    ownerState=state;state.nextId=10;
    w.GeometryObjects={geometryRefForItem:p.geometryRefForItem};
    Object.assign(p.parameterNamespace,{evaluateEditingExpressionDraft:p.evaluateDimensionExpressionDraft,ensureDimensionParameter:p.ensureDimensionParameter,parameterErrorText:p.parameterErrorText});
    const ids={allocate(type){assert.equal(this,ids);events.push(['allocate',type]);if(state.idFailure)throw state.idFailure;return 'AN'+(++state.nextId);}},
      appearance={applyLeaderAppearanceValue(style,key,value,configuration){assert.equal(this,appearance);events.push(['style',style,key,value,configuration]);if(state.styleFailure)throw state.styleFailure;return state.result;}};
    p.applyStyle=(style,key,value,effective)=>lateAppearance.applyLeaderAppearanceValue(style,key,value,{viewportScale:p.viewport.scale,effective});
    p.nextAnnotationId=()=>ids.allocate('annotation');p.resizeEnabled=element=>lateDrag.resizeEnabled(element);
    options={ctx:p.ctx,viewport:p.viewport,surface:p.surface,
      documentWorkspace:{workspace:{current:p.currentScope},sketches:{activeSketchId:p.activeSketchId,elementSketchId:p.elementSketchId,isEditableSketchElement:p.isEditableSketchElement,isReferenceSourceSketchId:p.isReferenceSourceSketchId},parameters:p.parameterNamespace,documentIds:ids},
      editingScope:{get current(){return p.readEditingScope();}},readServices:{annotationAppearance:{effectiveAnnotationStyle:p.effectiveAnnotationStyle},reads:{resolveGeometryRef:p.resolveGeometryRef,allAnnotations:p.allAnnotations},geometryAppearance:{isVisibleValue:p.isVisibleValue,isVisibleSketchId:p.isVisibleSketchId}},
      interaction:{selection:p.canvasSelection,hover:{get current(){return p.readHover();}},access:{guardSketchEdit:p.guardSketchEdit,canCreateInActiveSketch:p.canCreateInActiveSketch,rejectRootSketchCreation:p.rejectRootSketchCreation},lifecycle:{exit:p.exitDrawMode}},
      sessions:{pending:p.pendingCommandSession,targets:p.constraintTargetSession,pointer:{readLastPointer:p.lastPointer}},targets:{annotationLeaderAnchor:p.annotationLeaderAnchor,annotationLeaderTargetFromHit:p.annotationLeaderTargetFromHit},
      placement:{defaultDimensionForTarget:p.defaultDimensionForTarget,normalizeDimension:p.normalizeDimension},presentation:{settings:{applicationText:p.applicationText},updateUI:p.updateUI,draw:p.draw,setHint:p.setHint},readAppearance:()=>{assert.ok(lateAppearance,'appearance is constructed after annotations');return lateAppearance;},
      readExportFrame:p.readExportFrame,canvasThemeColor:p.canvasThemeColor,resizeEnabled:p.resizeEnabled,constraintOperandsFromSelection:p.constraintOperandsFromSelection,
      recordHistory:p.recordHistory,cancelPendingCommand:p.cancelPendingCommand,cancelConstraintTargetCommand:p.cancelConstraintTargetCommand,startDistanceResolution:p.startDistanceResolution,clearSelection:p.clearSelection,updateToolbar:p.updateToolbar};
    const feature=assemble?assemble(w,options,p,state,events):composed?w.AnnotationFeature.createForEditing(options):w.AnnotationFeature.create(p);
    lateAppearance=appearance;return feature;
  });
  const replaceDrag=()=>{const actor={resizeEnabled(element){assert.equal(this,actor);f.events.push(['resize',element]);return ownerState.allowed;}};lateDrag=actor;};replaceDrag();
  return{...f,options,replaceDrag};
}

function drawingAnchorFixture() {
  const trace = [], live = { sources: [], ready: false }, failure = new Error('snap source failure');
  const check = stage => { assert.equal(live.ready, true); trace.push(stage); if (live.fail === stage) throw failure; };
  function read() { assert.equal(this, undefined); check('read'); return live.sources; }
  function visible(element) {
    assert.equal(this, undefined); check('visible:' + element.id);
    live.onVisible?.(element); return !element.hiddenSketch;
  }
  const f = editingFixture(true, (w, options) => {
    options.readServices.reads.allAnnotations = read;
    options.readServices.geometryAppearance.isVisibleSketchElement = visible;
    const createDisplay = w.AnnotationDisplay.create;
    w.AnnotationDisplay.create = options => {
      const display = createDisplay(options);
      display.renderer.annotationPlacementAnchor = function(element) {
        assert.equal(this, undefined); check('anchor:' + element.id); return element.position;
      };
      return display;
    };
    return w.AnnotationFeature.createForEditing(options);
  });
  assert.deepEqual(trace, []);
  assert.deepEqual(f.events, ['display', 'materialization', 'anchors', 'dimensions', 'command']);
  live.ready = true;
  function previous() {
    return read().filter(element => visible(element) && element.visible !== false)
      .map(element => ({ element, ...f.feature.placementAnchor(element) }));
  }
  return { ...f, trace, live, failure, visible, previous };
}

test('drawing annotation anchors read live sources, preserve identities and finish visibility before placement', () => {
  for (const legacy of [true, false]) {
    const f = drawingAnchorFixture(), query = legacy ? f.previous : f.feature.drawingAnchors;
    const symbol = Symbol('anchor metadata');
    const first = { id: 'first', sketchId: 'inactive', locked: true, position: { x: 1, y: 2, [symbol]: 'kept' } };
    const hidden = { id: 'hidden', hiddenSketch: true, get visible() { throw new Error('must short circuit'); } };
    const off = { id: 'off', visible: false };
    const projected = { id: 'projected', blockProjection: true, position: { x: 3, y: 4 } };
    f.live.sources = [first, hidden, off, projected];
    f.live.onVisible = element => { if (element === projected) first.position.x = 9; };
    const result = query();
    assert.deepEqual(f.trace, ['read', 'visible:first', 'visible:hidden', 'visible:off', 'visible:projected', 'anchor:first', 'anchor:projected']);
    assert.equal(result.length, 2); assert.equal(result[0].element, first); assert.equal(result[1].element, projected);
    assert.equal(result[0].x, 9); assert.equal(result[0][symbol], 'kept');
    const again = query(); assert.notEqual(again, result); assert.notEqual(again[0], result[0]);
    first.position = { x: 20, y: 30 }; f.live.sources = [first];
    assert.equal(query()[0].x, 20); f.live.sources = []; assert.equal(query().length, 0);
    assert.equal(f.state.scaleReads, 0); assert.equal(f.events.includes('scope'), false);
  }
});

test('annotation snap source and placement errors retain identity and stop at the same phase', () => {
  for (const stage of ['read', 'visible:a', 'property', 'anchor:a']) {
    const traces = [];
    for (const legacy of [true, false]) {
      const f = drawingAnchorFixture();
      const a = { id: 'a', position: { x: 1, y: 2 }, get visible() {
        f.trace.push('property'); if (stage === 'property') throw f.failure; return true;
      } };
      f.live.sources = [a, { id: 'b', position: { x: 3, y: 4 } }]; f.live.fail = stage;
      assert.throws(legacy ? f.previous : f.feature.drawingAnchors, error => error === f.failure);
      traces.push(f.trace); assert.equal(f.live.sources[0], a); assert.equal(a.position.x, 1);
    }
    assert.deepEqual(traces[1], traces[0]);
  }
});

test('real DrawingSnap consumes annotation anchors across source replacement and visibility changes', () => {
  const f = drawingAnchorFixture(), context = { window: {} }; vm.createContext(context);
  for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/drawing_snap.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  const drawing = context.window.DrawingSnap.create({
    geometryReads: Object.fromEntries(['Points', 'Lines', 'Circles', 'Arcs', 'Splines'].map(name => ['allGeometry' + name, () => []])),
    annotationAnchors: f.feature.drawingAnchors, isVisibleSketchElement: f.visible,
    isActiveSketchElement: () => false, applicationText: (ja, en) => en,
  });
  const original = { id: 'original', sketchId: 'other', position: { x: 10, y: 20 } };
  f.live.sources = [original]; assert.equal(drawing.resolve({ x: 11, y: 20 }, 2).x, 10);
  assert.equal(drawing.active.data.annotation, original);
  const projected = { id: 'projection', blockProjection: true, position: { x: 30, y: 40 } };
  f.live.sources = [projected]; drawing.resolve({ x: 30, y: 41 }, 2);
  assert.equal(drawing.active.data.annotation, projected);
  projected.hiddenSketch = true;
  const miss = { x: 30, y: 40 }; assert.equal(drawing.resolve(miss, 2), miss); assert.equal(drawing.active, null);
  projected.hiddenSketch = false; projected.visible = false;
  assert.equal(drawing.resolve(miss, 2), miss);
  assert.equal(f.events.includes('scope'), false);
});

test('editing annotation composition shares actual owners at the original creation stage without reading scope, scale or late drag',()=>{
  const f=editingFixture();assert.deepEqual(f.events,['display','materialization','anchors','dimensions','command']);assert.equal(f.state.scaleReads,0);assert.equal(f.state.nextId,10);
  assert.equal(f.feature.command,f.command);assert.equal(f.feature.layer,f.layer);assert.equal(f.feature.renderer,f.renderer);assert.equal(f.feature.dimensions,f.dimensions);
  for(const key of ['ctx','surface','viewport','canvasSelection','effectiveAnnotationStyle','annotationLeaderAnchor','resolveGeometryRef','isEditableSketchElement','resizeEnabled','allAnnotations','isVisibleValue','isVisibleSketchId'])assert.equal(f.ports.display[key],f.input[key],key);
  for(const key of ['recordHistory','clearSelection','canCreateInActiveSketch','rejectRootSketchCreation','annotationLeaderTargetFromHit','cancelPendingCommand'])assert.equal(f.ports.command[key],f.input[key],key);
  assert.equal(f.ports.dimensions.defaultDimension,f.input.defaultDimensionForTarget);assert.equal(f.ports.dimensions.normalizeDimension,f.input.normalizeDimension);
  assert.equal(f.ports.command.getPending,f.options.sessions.pending.read);assert.equal(f.ports.command.setPending,f.options.sessions.pending.replace);assert.equal(f.ports.command.lastPointer,f.options.sessions.pointer.readLastPointer);
});

test('editing annotation composition preserves distinct Workspace editor lookup and bound anchor, drag and dimension views',()=>{
  for(const composed of [false,true]){
    const f=editingFixture(composed),workspaceItem={...f.item,source:'Workspace'},boundItem={...f.item,source:'bound'};
    f.state.workspace={annotations:[workspaceItem]};f.state.scope={annotations:[boundItem],parameters:[],constraints:['bound']};
    assert.equal(f.ports.command.currentScope(),f.state.workspace);assert.equal(f.ports.anchors.byId(f.item.id),boundItem);
    f.feature.createEditor({document:{},host:{},capture(){},restore(){},guardDimensionSymbolDeletion(){},readParameterNamespace:()=>f.state.scope,expressionFromUserInput(){},stabilize(){},resetDrag(){},toScreen(){},expressionInputValue(){}});
    f.feature.createDrag({beginConstrainedDrag(){},resizeText(){},beginPointer(){},endPointer(){}});
    assert.equal(f.ports.editor.find(f.item.id),workspaceItem);assert.equal(f.ports.drag.annotationById(f.item.id),boundItem);
    const spread={annotations:[boundItem],constraints:['spread'],parameters:[],source:'first'},constraintScope={...spread,constraints:['second']};f.state.scopes=[spread,constraintScope];f.events.length=0;
    const view=f.feature.dimensionScope();assert.equal(view.source,'first');assert.deepEqual(Array.from(view.constraints),['second','dimension']);assert.deepEqual(f.events,['scope','scope']);
    const replacement={...workspaceItem,source:'replacement'};f.state.workspace={annotations:[replacement]};assert.equal(f.ports.editor.find(f.item.id),replacement);assert.equal(f.ports.drag.annotationById(f.item.id),boundItem);
  }
});

test('editing annotation style and ID callbacks retain live scale, method receivers, exact options and original failures',()=>{
  for(const composed of [false,true]){
    const f=editingFixture(composed),style={color:'old'},effective={lineWidth:3};f.events.length=0;f.state.scale=7;
    assert.equal(f.ports.command.applyStyle(style,'lineWidth','5',effective),f.state.result);const call=f.events[0];assert.equal(call[0],'style');assert.equal(call[1],style);assert.equal(call[4].viewportScale,7);assert.equal(call[4].effective,effective);assert.equal(f.state.scaleReads,1);
    const prior=call[4];f.state.scale=4;f.events.length=0;f.ports.command.applyStyle(style,'color','red');assert.notEqual(f.events[0][4],prior);assert.equal(f.events[0][4].viewportScale,4);assert.equal(Object.hasOwn(f.events[0][4],'effective'),true);
    f.events.length=0;assert.equal(f.ports.command.nextAnnotationId(),'AN11');assert.deepEqual(f.events,[['allocate','annotation']]);
    const marker=new Error('boundary');f.state.idFailure=marker;assert.throws(()=>f.ports.command.nextAnnotationId(),error=>error===marker);
    f.state.styleFailure=marker;f.events.length=0;assert.throws(()=>f.ports.command.applyStyle(style,'color','blue',effective),error=>error===marker);assert.equal(f.events.length,1);assert.equal(f.events[0][0],'style');assert.equal(style.color,'old');
  }
});

test('editing annotation composition preserves late drag access, parameter scope copies and cancel preparation order',()=>{
  for(const composed of [false,true]){
    const f=editingFixture(composed);f.events.length=0;assert.equal(f.ports.display.resizeEnabled(f.item),true);f.replaceDrag();f.state.allowed=false;assert.equal(f.ports.display.resizeEnabled(f.item),false);
    assert.deepEqual(f.events,[['resize',f.item],['resize',f.item]]);f.state.allowed=true;f.events.length=0;
    assert.equal(f.ports.command.nextParameterName(),'d1');assert.notEqual(f.state.allocated.parameters,f.state.scope.parameters);assert.notEqual(f.state.allocated.parameters[0],f.state.scope.parameters[0]);assert.notEqual(f.state.allocated.annotations,f.state.scope.annotations);assert.equal(f.state.allocated.annotations[0],f.item);
    const old=f.state.scope,next={annotations:[],constraints:[],parameters:[]};f.state.nextScope=next;f.events.length=0;f.ports.command.commitParameter(f.item);
    assert.deepEqual(f.events,['scope',['ensure',f.item,old],'scope',['evaluate',next]]);
    f.events.length=0;f.ports.anchors.cancelCommands();f.ports.command.prepare();assert.deepEqual(f.events,[['cancelPendingCommand',''],['cancelConstraintTargetCommand',''],['exitDrawMode'],['cancelConstraintTargetCommand','']]);
  }
});

function workspaceStagesFixture(composed, probe = {}) {
  probe.order = []; probe.error = new Error(probe.failAt || 'stage failure');
  const f = editingFixture(true, (w, options, p, state) => {
    const raw = { window: {} }; vm.createContext(raw);
    for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), raw);
    raw.window.GeometryObjects = w.GeometryObjects;
    probe.geometry = { valid: true, point: { x: 20, y: 30 }, constraints: [{ id: 'aux' }], variables: [{ id: 'x' }, { id: 'y' }, { id: 'extra' }] };
    raw.window.AnnotationAnchorConstraints = { createDragGeometry(_item, _anchor, resolve) { assert.equal(resolve, options.readServices.reads.resolveGeometryRef); return probe.geometry; } };
    for (const file of ['src/geometry/annotation_anchor_query.js', 'src/commands/annotation_drag.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), raw);
    probe.point = Object.assign(new raw.window.GeometrySolver.Point('G1', 4, 5), { sketchId: 'S1' });
    const requireReady = () => assert.equal(probe.ready, true, 'stage construction must not access live owners');
    const current = options.documentWorkspace.workspace.current;
    options.documentWorkspace.workspace.current = () => { requireReady(); return current(); };
    Object.assign(options.documentWorkspace.sketches, { activeSketchId: () => 'S1', isReferenceSourceSketchId: () => false });
    options.interaction.pointUsage = { isExplicitPoint: () => true, isPointUsedByPrimitive: () => false, isPointUsedByLine: () => false, isReferencePoint: () => false };
    options.interaction.selection.selectedGeometryItems = () => { requireReady(); return [probe.point]; };
    options.readServices.geometryAppearance.isVisibleSketchElement = () => true;
    for (const name of ['Points', 'Lines', 'Circles', 'Arcs', 'Splines']) options.readServices.reads['allGeometry' + name] = () => { requireReady(); return name === 'Points' ? [probe.point] : []; };
    const viewportScale = () => { requireReady(); return options.viewport.scale; };
    w.AnnotationAnchorQuery = { create(input) { probe.order.push('query'); probe.queryPorts = input; if (probe.failAt === 'query') throw probe.error; return probe.targets = raw.window.AnnotationAnchorQuery.create(input); } };
    w.AnnotationDrag = { ...w.AnnotationDrag, createConstrained(input) { probe.order.push('constrained'); probe.constrainedPorts = input; if (probe.failAt === 'constrained') throw probe.error; return raw.window.AnnotationDrag.createConstrained(input); } };
    const display = w.AnnotationDisplay.create;
    w.AnnotationDisplay.create = input => {
      probe.order.push('feature'); if (probe.failAt === 'feature') throw probe.error;
      const result = display(input); probe.renderer = result.renderer;
      result.renderer.annotationLeaderDisplayGeometry = function (item) {
        assert.equal(this, undefined); requireReady(); assert.equal(arguments.length, 1); probe.leaderItem = item;
        if (probe.leaderError) throw probe.leaderError; return { shelfScale: state.scale };
      };
      return result;
    };
    let prepared;
    if (composed) prepared = w.AnnotationFeature.prepareForWorkspace({ documentWorkspace: options.documentWorkspace, readServices: options.readServices, interaction: options.interaction, presentation: options.presentation, viewportScale });
    else prepared = { targets: w.AnnotationFeature.createAnchorQuery({ sketches: options.documentWorkspace.sketches, readServices: options.readServices, pointUsage: options.interaction.pointUsage, selection: options.interaction.selection, viewportScale }) };
    assert.deepEqual(probe.order, ['query']); assert.equal(state.scaleReads, 0); probe.prepared = prepared;
    const constrainedInput = { placementAnchor: (...args) => { if (probe.readerError) throw probe.readerError; return probe.feature.placementAnchor(...args); },
      buildPlan(kind, point, pointer) { assert.equal(kind, 'point'); assert.equal(point, probe.geometry.point); assert.equal(probe.constrained.scope().points.at(-1), point); return probe.plan = { pointer }; },
      beginGeometryDrag(_event, plan) { assert.equal(plan, probe.plan); return true; }, leaderDisplay: item => {
        if (probe.readerError) throw probe.readerError; const { annotationLeaderDisplayGeometry } = probe.renderer; return annotationLeaderDisplayGeometry(item);
      },
      invalidateAnalysis() { assert.equal(probe.constrained.scope(), state.workspace); probe.invalidated = true; } };
    const readFeature = function () {
      assert.equal(this, undefined); assert.equal(arguments.length, 0); requireReady(); probe.featureReads = (probe.featureReads || 0) + 1;
      if (probe.readerError) throw probe.readerError; return probe.feature;
    };
    probe.constrained = composed === 'feature' ? prepared.createConstrainedDragForFeature({ readFeature,
      buildPlan: constrainedInput.buildPlan, beginGeometryDrag: constrainedInput.beginGeometryDrag, invalidateAnalysis: constrainedInput.invalidateAnalysis })
      : composed ? prepared.createConstrainedDrag(constrainedInput) : w.AnnotationDrag.createConstrained({ ...constrainedInput,
      currentScope: options.documentWorkspace.workspace.current, resolveGeometryRef: options.readServices.reads.resolveGeometryRef, leaderAnchor: prepared.targets.annotationLeaderAnchor,
      applicationText: options.presentation.settings.applicationText, setHint: options.presentation.setHint, updateUI: options.presentation.updateUI, draw: options.presentation.draw });
    assert.deepEqual(probe.order, ['query', 'constrained']); assert.equal(state.scaleReads, 0);
    const { documentWorkspace, readServices, interaction, presentation, targets, ...late } = options;
    return probe.feature = composed ? prepared.createFeature(late) : w.AnnotationFeature.createForEditing({ ...options, targets: prepared.targets });
  });
  Object.freeze(f.renderer); probe.ready = true; f.state.workspace = { points: [probe.point], constraints: [], annotations: [f.item] }; return { ...f, probe };
}

test('Annotation preparation keeps query, constrained drag and Feature stages cold and shares actual APIs with live viewport hits', () => {
  for (const composed of [false, true, 'feature']) {
    const f = workspaceStagesFixture(composed), p = f.probe;
    assert.deepEqual(p.order, ['query', 'constrained', 'feature']); assert.equal(f.state.scaleReads, 0);
    assert.equal(p.prepared.targets, p.targets); assert.equal(p.constrainedPorts.leaderAnchor, p.targets.annotationLeaderAnchor);
    assert.equal(p.constrainedPorts.currentScope, f.options.documentWorkspace.workspace.current);
    assert.equal(f.feature.renderer, f.renderer); assert.equal(f.feature.command, f.command);
    assert.equal(p.targets.hitAnnotationTarget(4, 5).item, p.point); f.state.scale = 20;
    assert.equal(p.targets.hitAnnotationTarget(6, 5), null); assert.ok(f.state.scaleReads > 0);
    if (composed) assert.equal(Object.isFrozen(p.prepared), true);
  }
});

test('Annotation preparation keeps virtual geometry lifecycle, distinct Workspace scope and late appearance and drag callbacks', () => {
  for (const composed of [false, true, 'feature']) {
    const f = workspaceStagesFixture(composed), p = f.probe, original = f.state.workspace;
    Object.assign(f.item, { type: 'text', anchorConstraints: [{ type: 'coincident' }] });
    assert.equal(p.constrained.begin({ pointerId: 1 }, f.item, { x: 3, y: 4 }), true);
    const virtual = p.constrained.scope(); assert.notEqual(virtual, original); assert.equal(virtual.points.at(-1), p.geometry.point);
    assert.equal(virtual.points[0], p.point); assert.equal(original.points.length, 1); assert.equal(p.constrained.additionalVariables()[0], p.geometry.variables[2]);
    p.geometry.point.x = 44; p.plan.syncAnnotation(); assert.equal(f.item.x, 44); p.plan.onEnd();
    assert.equal(p.invalidated, true); assert.equal(p.constrained.scope(), original); assert.equal(p.constrained.additionalVariables().length, 0);
    assert.equal(f.ports.command.currentScope(), original); assert.notEqual(original, f.state.scope);
    const resize = () => {}, begin = () => {}, end = () => {};
    assert.equal(f.feature.createDrag({ beginConstrainedDrag: p.constrained.begin, resizeText: resize, beginPointer: begin, endPointer: end }), f.drag);
    assert.equal(f.ports.drag.beginConstrainedDrag, p.constrained.begin); assert.equal(f.ports.drag.beginPointer, begin);
    f.state.scale = 7; f.ports.command.applyStyle({}, 'textHeight', 3, {}); assert.equal(f.events.at(-1)[4].viewportScale, 7);
  }
});

test('Annotation preparation preserves constructor short circuits at each original stage', () => {
  for (const composed of [false, true, 'feature']) for (const failAt of ['query', 'constrained', 'feature']) {
    const probe = { failAt }; assert.throws(() => workspaceStagesFixture(composed, probe), error => error === probe.error);
    assert.deepEqual(probe.order, ['query', 'constrained', 'feature'].slice(0, ['query', 'constrained', 'feature'].indexOf(failAt) + 1));
  }
});

test('late Annotation Feature readers preserve constrained leader movement, bare rendering calls and live scale without a second owner', () => {
  const snapshots = [];
  for (const composed of [false, true, 'feature']) {
    const f = workspaceStagesFixture(composed), p = f.probe, original = f.state.workspace;
    assert.equal(p.featureReads, undefined); assert.ok(Object.isFrozen(f.feature)); assert.ok(Object.isFrozen(f.renderer));
    Object.assign(f.item, { type: 'leader', start: { x: 2, y: 3 }, anchorConstraints: [{ type: 'coincident' }] }); f.events.length = 0;
    assert.equal(p.constrained.begin({ pointerId: 1 }, f.item, { x: 3, y: 4 }), true); const positions = [];
    for (const [x, scale] of [[44, 2], [84, 4]]) {
      p.geometry.point.x = x; f.state.scale = scale;
      const anchor = p.prepared.targets.annotationLeaderAnchor(f.item) || f.item.start;
      p.plan.syncAnnotation(); assert.equal(p.leaderItem, f.item);
      assert.equal(f.item.x, f.item.start.x + (x - anchor.x) / scale);
      assert.equal(f.item.y, f.item.start.y + (p.geometry.point.y - anchor.y) / scale); positions.push([f.item.x, f.item.y]);
    }
    if (composed === 'feature') assert.equal(p.featureReads, 3);
    assert.equal(original.points.length, 1); assert.equal(p.constrained.scope().points[0], p.point);
    p.plan.onEnd(); assert.equal(p.constrained.scope(), original); assert.equal(p.constrained.additionalVariables().length, 0);
    snapshots.push(JSON.stringify({ positions, events: f.events, points: original.points.map(point => point.id) }));
  }
  assert.equal(snapshots[1], snapshots[0]); assert.equal(snapshots[2], snapshots[0]);
});

test('late Annotation Feature reader, anchor and leader failures retain the same exception and virtual geometry boundaries', () => {
  for (const composed of [false, true, 'feature']) for (const failure of ['reader', 'anchor', 'leader']) {
    const f = workspaceStagesFixture(composed), p = f.probe, original = f.state.workspace, marker = new Error(failure);
    Object.assign(f.item, { type: 'leader', start: { x: 2, y: 3 }, anchorConstraints: [{ type: 'coincident' }] });
    if (failure === 'reader') p.readerError = marker;
    if (failure === 'anchor') Object.defineProperty(f.item, 'position', { get() { throw marker; } });
    if (failure === 'leader') assert.equal(p.constrained.begin({}, f.item, { x: 3, y: 4 }), true);
    p.leaderError = marker; f.events.length = 0; const before = [f.item.x, f.item.y];
    assert.throws(() => failure === 'leader' ? p.plan.syncAnnotation() : p.constrained.begin({}, f.item, {}), error => error === marker);
    assert.deepEqual([f.item.x, f.item.y], before); assert.deepEqual(f.events, []); assert.equal(original.points.length, 1);
    assert.equal(p.constrained.additionalVariables().length, failure === 'leader' ? 1 : 0);
    if (failure === 'leader') { assert.notEqual(p.constrained.scope(), original); p.plan.onEnd(); }
    assert.equal(p.constrained.scope(), original); assert.equal(original.constraints.length, 0);
  }
});

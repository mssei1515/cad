'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function fixture() {
  const events = [], ports = {}, item = { id: 'AN1', sketchId: 'S1', position: { x: 1, y: 2 } };
  const state = { scope: { annotations: [item], constraints: ['base'], parameters: [{ name: 'p' }] },
    scale: 2, scaleReads: 0, count: 1, result: { id: 'result' }, command: null, operands: [], dimensions: ['dimension'], allowed: true };
  const step = name => (...args) => { events.push([name, ...args]); return state.result; };
  const renderer = { annotationPlacementAnchor(element) { assert.equal(this, undefined); return element.position; },
    annotationLeaderDisplayGeometry: step('leader'),
    annotationTextLayout(element) { assert.equal(this, undefined); events.push(['layout', element]); return 'layout' in state ? state.layout : state.result; },
    annotationTextMetrics(...args) { assert.equal(this, undefined); events.push(['metrics', ...args]); return state.metrics; } };
  const layer = {}, materialization = { materialize(...args) { assert.equal(this, materialization); return state.result; } };
  const anchors = { startFromSelection(type, element) { assert.equal(this, anchors); events.push(['start', type, element]); return element ? state.result : false; } };
  const dimensions = { entries() { assert.equal(this, dimensions); return state.dimensions; } };
  const command = { preview() { assert.equal(this, command); return state.result; } }, parameterCommand = { commit: step('parameter-commit') },
    textEditing = { commit: step('text-commit') }, editor = {}, drag = {};
  const factory = (name, value) => options => { events.push(name); ports[name] = options; return value; };
  const context = { window: { AnnotationDisplay: { create: factory('display', { renderer, layer }) }, AnnotationAnchorConstraints: {
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
  const feature = context.window.AnnotationFeature.create(input);
  return { feature, input, state, item, events, ports, renderer, layer, materialization, anchors, dimensions, command, editor, parameterCommand, textEditing, drag };
}

test('annotation assembly retains construction order, shared owners and lazy preview, scope and scale reads', () => {
  const f = fixture();
  assert.deepEqual(f.events, ['display', 'materialization', 'anchors', 'dimensions', 'command']);
  assert.equal(f.state.scaleReads, 0);
  for (const name of ['renderer', 'layer', 'anchors', 'dimensions', 'command']) assert.equal(f.feature[name], f[name]);
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

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
    annotationLeaderDisplayGeometry: step('leader'), annotationTextLayout: step('layout'), annotationTextMetrics: step('metrics') };
  const layer = {}, materialization = { materialize(...args) { assert.equal(this, materialization); return state.result; } };
  const anchors = { startFromSelection(type, element) { assert.equal(this, anchors); events.push(['start', type, element]); return element ? state.result : false; } };
  const dimensions = { entries() { assert.equal(this, dimensions); return state.dimensions; } };
  const command = { preview() { assert.equal(this, command); return state.result; } };
  const factory = (name, value) => options => { events.push(name); ports[name] = options; return value; };
  const context = { window: { AnnotationDisplay: { create: factory('display', { renderer, layer }) }, AnnotationAnchorConstraints: {
    createMaterialization: factory('materialization', materialization), create: factory('anchors', anchors), createDimensions: factory('dimensions', dimensions),
  }, AnnotationCommand: { create: factory('command', command) } } };
  vm.runInNewContext(fs.readFileSync('src/application/annotation_feature.js', 'utf8'), context);
  const input = Object.fromEntries(['canvasThemeColor', 'effectiveAnnotationStyle', 'annotationLeaderAnchor', 'resolveGeometryRef',
    'isEditableSketchElement', 'resizeEnabled', 'activeSketchId', 'allAnnotations', 'isVisibleValue', 'isVisibleSketchId',
    'isReferenceSourceSketchId', 'geometryRefForItem', 'constraintOperandsFromSelection', 'recordHistory', 'updateUI', 'draw',
    'setHint', 'cancelPendingCommand', 'cancelConstraintTargetCommand', 'applicationText', 'startDistanceResolution',
    'defaultDimensionForTarget', 'normalizeDimension', 'evaluateDimensionExpressionDraft', 'parameterErrorText',
    'exitDrawMode', 'nextAnnotationId', 'canCreateInActiveSketch', 'rejectRootSketchCreation', 'clearSelection', 'updateToolbar',
    'annotationLeaderTargetFromHit', 'applyStyle', 'lastPointer', 'readHover', 'readExportFrame'].map(name => [name, step(name)]));
  Object.assign(input, { ctx: {}, surface: {}, viewport: { get scale() { state.scaleReads++; return state.scale; } },
    currentScope: () => ({ id: 'workspace' }), readEditingScope: () => { events.push('scope'); return state.scopes?.shift() || state.scope; },
    canvasSelection: { annotations: [item], selectedElementCount: () => state.count, set: step('select') },
    constraintTargetSession: { get command() { return state.command; }, get operands() { return state.operands; },
      replaceCommand(value) { assert.equal(this, input.constraintTargetSession); state.command = value; } },
    pendingCommandSession: { read: step('pending-read'), replace: step('pending-replace') },
    elementSketchId: element => { events.push('elementSketchId'); return element.sketchId; },
    guardSketchEdit: () => { events.push('guard'); return state.allowed; },
    ensureDimensionParameter: (element, scope) => { events.push(['ensure', element, scope]); if (state.nextScope) state.scope = state.nextScope; },
    parameterNamespace: { allocateDimensionParameterName(scope) { assert.equal(this, input.parameterNamespace); state.allocated = scope; return 'd1'; },
      validateNewDimensionParameter(draft, scope) { assert.equal(this, input.parameterNamespace); return { draft, scope }; },
      evaluateParameterNamespace(scope) { assert.equal(this, input.parameterNamespace); events.push(['evaluate', scope]); } },
  });
  const feature = context.window.AnnotationFeature.create(input);
  return { feature, input, state, item, events, ports, renderer, layer, materialization, anchors, dimensions, command };
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

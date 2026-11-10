const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {}, structuredClone };
vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;

function fixture(composed, failure) {
  'use strict';
  const events = [], marker = new Error('selection support failure');
  const state = { scope: w.DocumentState.create(), id: 0, moving: null, editing: null };
  const check = name => { events.push(name); if (failure === name) throw marker; };
  const current = () => { check('scope'); return state.scope; };
  const documentModel = w.DocumentState.create();
  const sketches = w.SketchContext.create({ currentScope: current, constraintGraphNodes: () => [] });
  const selection = w.CanvasSelection.create(), hover = { current: {} };
  const ids = w.GeometryIds.create();
  const geometry = w.GeometryCreation.create({ currentScope: current, ids, assignSketchId: sketches.assignSketchId,
    currentConstruction: () => false, minLineLength: .01, minArcLength: .01 });
  const documentIds = { allocate(kind) { assert.equal(this, documentIds); assert.equal(kind, 'blockInstance'); check('allocate'); return 'BI' + ++state.id; } };
  const documentWorkspace = { document: documentModel, workspace: { current }, sketches, documentIds };
  const effect = name => function () { assert.equal(this, undefined); check(name); };
  const clearSelection = () => { check('clear'); selection.clear(); };
  const presentation = { updateUI: effect('ui'), draw: effect('draw') };
  const readServices = { projections: { invalidateBlockProjectionCache: effect('invalidate') } };
  const interaction = { selection, hover };
  const support = composed ? w.CanvasSelectionTestDriver.createForWorkspace({ documentWorkspace, geometry, readServices, interaction, presentation, clearSelection }) :
    w.CanvasSelectionTestDriver.createSupport({ canvasSelection: selection, currentScope: current, clearSelection, updateUI: presentation.updateUI, draw: presentation.draw });
  assert.deepEqual(events, []);
  const blockEditor = { get current() { check('editor'); return state.editing; } };
  const sketchMoveCommand = { state() { assert.equal(this, sketchMoveCommand); check('move'); return state.moving; } };
  const blockSelection = { read() { assert.equal(this, undefined); check('block'); return { constraints: [1], externalConstraints: [2, 3] }; } };
  const blocks = { editing: { empty(name) { assert.equal(this, undefined); check('empty'); return { ...w.DocumentState.create(), id: 'B1', name }; } } };
  const drawingFit = { fitSketchToViewport: effect('fit') };
  const canvas = { getBoundingClientRect() { check('rect'); return { left: 10, top: 20 }; } };
  const viewport = { x: 4, y: 6, scale: 2 };
  const canvasDriver = { clientPosition(point) { assert.equal(this, undefined); check('client'); return { x: 14 + point.x * 2, y: 26 + point.y * 2 }; } };
  const canvasContextMenu = { hidden: true };
  const canvasContextController = { candidates() { assert.equal(this, canvasContextController); check('candidates'); return [{ kind: 'line', id: 'L1' }]; } };
  const canvasContextCandidatePresentation = target => { check('candidate'); return { id: target.id, type: 'Line', secondary: 'Sketch' }; };
  const serializeConstraint = value => { check('constraint'); return { id: value.id }; };
  const decorateSerializedConstraint = (data, value) => { check('decorate'); return { ...data, sketchId: value.sketchId }; };
  const serializeModel = () => { check('serialize'); return { activeSketchId: state.scope.activeSketchId }; };
  const resetHistory = effect('history');
  const resetModelState = () => { check('reset'); state.scope = w.DocumentState.create(); documentModel.blockDefinitions = []; ids.reset(); state.id = 0; };
  const options = { sketchMoveCommand, blockEditor, blockSelection, blocks, drawingFit, canvasDriver, canvas, viewport,
    canvasContextMenu, canvasContextController, canvasContextCandidatePresentation, decorateSerializedConstraint,
    serializeConstraint, serializeModel, resetModelState, resetHistory };
  const api = composed ? support.createApiForEditing(options) : support.createApi({ sketchMoveCommand, activeSketchId: sketches.activeSketchId, fields: w.SketchMove.fields,
    decorateSerializedConstraint, serializeConstraint, serializeModel, isEditingBlock: () => Boolean(blockEditor.current),
    blockSelectionGeometry: blockSelection.read, resetModelState, addLine: geometry.addLine, addPoint: geometry.addPoint, addArc: geometry.addArc,
    ROOT_SKETCH_ID: w.SketchHierarchy.ROOT_SKETCH_ID, DEFAULT_SKETCH_ID: w.SketchHierarchy.DEFAULT_SKETCH_ID,
    createEmptyBlockDefinition: blocks.editing.empty, Point: w.GeometrySolver.Point, Line: w.GeometrySolver.Line,
    appendDefinition: definition => documentModel.blockDefinitions.push(definition), nextInstanceId: () => documentIds.allocate('blockInstance'),
    invalidateBlockProjectionCache: readServices.projections.invalidateBlockProjectionCache, fitSketchToViewport: drawingFit.fitSketchToViewport,
    resetHistory, clientPosition: canvasDriver.clientPosition, arcEndpointPoint: w.GeometryKernel.arcEndpointPoint,
    canvasHover: hover, canvasContextMenu, canvasContextController, canvasContextCandidatePresentation, canvas, viewport });
  assert.deepEqual(events, []);
  return { state, events, marker, api, support, selection, hover, documentModel, canvasContextMenu, geometry, viewport,
    snapshot() { return JSON.parse(JSON.stringify({ events, scope: state.scope, definitions: documentModel.blockDefinitions, selected: support.readSelectedGeometry() })); } };
}

test('selection workspace support stays cold and preserves seven ordered APIs, live selection, replacement scope and block state', () => {
  const run = composed => {
    const f = fixture(composed);
    assert.ok(Object.isFrozen(f.api)); assert.ok(Object.isFrozen(f.support)); assert.equal(Object.keys(f.api).length, 7);
    assert.equal(f.api.selectedGeometryIdsForTest, f.support.readSelectedGeometry);
    const p = f.geometry.addPoint(1, 2), line = f.geometry.addLine(p, f.geometry.addPoint(20, 2));
    const selected = f.api.selectGeometryIdsForTest({ lines: [line.id], points: [p.id] });
    assert.equal(f.selection.lines[0], line); assert.equal(selected.internalConstraintCount, 1); assert.equal(selected.externalConstraintCount, 2);
    f.state.moving = { targetId: 'S2' }; f.state.editing = {};
    f.state.scope = w.DocumentState.create(); f.state.scope.activeSketchId = 'ROOT';
    f.state.scope.constraints.push({ id: 'C1', sketchId: 'ROOT' });
    const move = f.api.sketchMoveStateForTest(); assert.equal(move.editingBlock, true); assert.equal(move.targetId, 'S2');
    assert.equal(move.ownership.points.length, 0); assert.equal(move.selected.points[0], p.id);
    f.hover.current = { arcEndpoint: { arc: { id: 'A1' }, endpoint: 'end' }, line };
    f.canvasContextMenu.hidden = false;
    const context = f.api.canvasContextSelectionStateForTest(); assert.equal(context.menuOpen, true); assert.equal(context.hovered, line.id);
    return JSON.parse(JSON.stringify({ keys: Object.keys(f.api), selected, move, context, events: f.events }));
  };
  assert.deepEqual(run(true), run(false));
});

test('selection fixtures preserve actual Geometry, root definition allocation and viewport insertion', () => {
  const run = composed => {
    const f = fixture(composed), overlap = f.api.resetForOverlappingContextSelectionTest();
    assert.equal(f.documentModel.blockDefinitions.length, 1); assert.equal(f.state.scope.blockDefinitions.length, 0);
    assert.ok(f.state.scope.lines[0] instanceof w.GeometrySolver.Line);
    assert.equal(f.selection.lines[0], f.state.scope.lines[0]);
    const endpoints = f.api.resetForArcEndpointConstraintSelectionTest();
    f.viewport.scale = 4;
    const inserted = f.api.addIsolatedFixedPointForContextTest({ x: 54, y: 66 });
    const point = f.state.scope.points.at(-1); assert.equal(point.x, 10); assert.equal(point.y, 10); assert.equal(point.fixed, true);
    return JSON.parse(JSON.stringify({ overlap, endpoints, inserted, snapshot: f.snapshot() }));
  };
  assert.deepEqual(run(true), run(false));
});

test('selection workspace adapters propagate failures without changing partial model, selection or callback order', () => {
  for (const failure of ['scope', 'clear', 'block', 'reset', 'empty', 'allocate', 'invalidate', 'fit', 'history', 'ui', 'draw', 'client', 'rect', 'move', 'constraint', 'decorate', 'serialize', 'editor', 'candidates', 'candidate']) {
    const run = composed => {
      const f = fixture(composed, failure);
      f.state.scope.constraints.push({ id: 'C1' });
      const action = ['move', 'constraint', 'decorate', 'serialize', 'editor'].includes(failure) ? () => f.api.sketchMoveStateForTest() :
        ['candidates', 'candidate'].includes(failure) ? () => f.api.canvasContextSelectionStateForTest() :
        failure === 'rect' ? () => f.api.addIsolatedFixedPointForContextTest({ x: 0, y: 0 }) :
        ['clear', 'block'].includes(failure) ? () => f.api.selectGeometryIdsForTest() : () => f.api.resetForOverlappingContextSelectionTest();
      assert.throws(action, error => error === f.marker);
      return f.snapshot();
    };
    assert.deepEqual(run(true), run(false), failure);
  }
});

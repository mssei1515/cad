'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture(composed) {
  const events = [], marker = new Error('spline port failed'), state = { ready: false, mode: 'select', editing: null, failure: null };
  const check = () => assert.equal(state.ready, true, 'construction must not query model or DOM');
  function record(name) { check(); events.push(name); if (state.failure === name) throw marker; }
  const documentWorkspace = w.DocumentWorkspace.create({ applicationText: (_ja, en) => en, constraintGraphNodes: () => [], nextHatchIndex: () => 1 });
  const root = documentWorkspace.document, currentScope = documentWorkspace.workspace.current;
  state.bound = root;
  const geometry = w.GeometryCreation.create({ currentScope, ids: documentWorkspace.geometryIds,
    assignSketchId: documentWorkspace.sketches.assignSketchId, currentConstruction: () => false, minLineLength: 1, minArcLength: 1 });
  const selection = w.CanvasSelection.create();
  const lifecycle = { get mode() { record('mode'); return state.mode; } };
  const editingScope = { get current() { record('bound'); return state.bound; } };
  const splineEditing = { get current() { record('editing'); return state.editing; } };
  const presentation = { updateUI() { assert.equal(this, undefined); record('ui'); }, draw() { assert.equal(this, undefined); record('draw'); } };
  const viewport = { update(value) { assert.equal(this, viewport); record('viewport'); state.scale = value.scale; },
    worldToCanvasScreen(point) { assert.equal(this, undefined); record('screen'); return { x: point.x * 2, y: point.y * 2 }; } };
  const canvas = { getBoundingClientRect() { assert.equal(this, canvas); record('rect'); return { left: 5, top: 7 }; } };
  const document = { querySelectorAll() { record('rows'); return []; }, getElementById() { record('properties'); return { textContent: 'Spline' }; } };
  const blockSelection = { read() { assert.equal(this, undefined); record('block-selection'); return { splines: [...selection.splines], annotations: [...selection.annotations] }; },
    center(value) { assert.equal(this, undefined); record('center'); assert.ok(value.splines); return { x: 0, y: 0 }; } };
  const blocks = { editing: { fromSelection(value, center, name) { assert.equal(this, undefined); record('definition');
    return { id: 'BD1', name, points: value.splines.flatMap(s => s.fitPoints), splines: value.splines, annotations: value.annotations, center }; } } };
  const readServices = { hatches: { hatchFaceAt() { record('hatch'); return { ok: true, resolved: { loops: [{ points: currentScope().points.map(p => ({ x: p.x, y: p.y })) }] } }; } },
    catalog: { blockDefinitionDrawableSketchIds() { assert.equal(this, undefined); record('drawable'); return ['S1']; } },
    projections: { invalidateBlockProjectionCache() { assert.equal(this, undefined); record('invalidate'); },
      blockProjectionBundle(instance) { assert.equal(this, undefined); record('bundle'); return { splines: [{ id: 'projected', fitPoints: currentScope().splines[0].fitPoints, blockInstance: instance }], annotations: root.blockDefinitions[0].annotations }; } } };
  const clipboardSession = { replaceForDiagnostics(payload) { assert.equal(this, clipboardSession); record('replace'); state.payload = payload; } };
  const options = { documentWorkspace, editingScope, geometry, readServices, interaction: { lifecycle, selection }, presentation,
    splineEditing, blockSelection, blocks, viewport, canvas, document,
    resizeCanvas(value) { assert.equal(this, undefined); record('resize'); assert.equal(value.centerWorld.x, 0); },
    resetModelState() { assert.equal(this, undefined); record('reset'); }, resetHistory() { assert.equal(this, undefined); record('history'); },
    serializeModel() { assert.equal(this, undefined); record('serialize'); return { splines: currentScope().splines.map(s => ({ id: s.id })), constraints: currentScope().constraints.map(c => ({ type: c.type })) }; },
    pushModelConstraint(value) { assert.equal(this, undefined); record('push'); currentScope().constraints.push(value); return value; },
    solveAndRefresh() { assert.equal(this, undefined); record('solve'); return { success: true }; },
    serializeConstraint(value) { assert.equal(this, undefined); record('constraint'); return { type: value.type }; },
    annotationLeaderTargetFromItem(source, anchor) { assert.equal(this, undefined); record('leader'); return { geometryRef: w.GeometryObjects.geometryRefForItem(source), anchor }; },
    clearSelection() { assert.equal(this, undefined); record('clear'); selection.clear(); },
    copyableSelectionPayload() { assert.equal(this, undefined); record('copy'); return { spline: selection.splines[0] }; }, clipboardSession,
    pasteGeometryClipboard() { assert.equal(this, undefined); record('paste'); currentScope().splines.push({ ...state.payload.spline, id: 'pasted' });
      for (const a of selection.annotations) currentScope().annotations.push({ ...a, id: a.id + '-copy' }); return true; } };
  let api;
  if (composed) api = w.SplineTestDriver.createForWorkspace(options);
  else {
    const { addPoint, addLine, addSpline } = geometry, { updateUI, draw } = presentation;
    const setup = w.SplineTestDriver.create({ ...options, updateUI, draw, canvasSelection: selection, addPoint, addLine, addSpline,
      worldToCanvasScreen: viewport.worldToCanvasScreen, readOperation: () => ({ mode: lifecycle.mode, editSplineId: splineEditing.current?.spline?.id || null }),
      readSpline: () => editingScope.current.splines[0] || null, hatchGeometryQuery: readServices.hatches, splineGeometry: w.SplineGeometry,
      PointOnSplineConstraint: w.GeometrySolver.PointOnSplineConstraint, SplineLineTangentConstraint: w.GeometrySolver.SplineLineTangentConstraint });
    const transfer = w.SplineTestDriver.createTransfer({ ...options, currentScope, updateUI, draw, canvasSelection: selection, splineGeometry: w.SplineGeometry,
      nextAnnotationId: () => documentWorkspace.documentIds.allocate('annotation'), activeSketchId: documentWorkspace.sketches.activeSketchId,
      defaultAnnotationStyle: w.Appearance.DEFAULT_ANNOTATION_STYLE, blockSelectionGeometry: blockSelection.read,
      blockSelectionBoundsCenter: blockSelection.center, createBlockDefinitionFromSelection: blocks.editing.fromSelection,
      appendDefinition: value => root.blockDefinitions.push(value), nextInstanceId: () => documentWorkspace.documentIds.allocate('blockInstance'),
      blockDefinitionDrawableSketchIds: readServices.catalog.blockDefinitionDrawableSketchIds,
      invalidateBlockProjectionCache: readServices.projections.invalidateBlockProjectionCache, blockProjectionBundle: readServices.projections.blockProjectionBundle });
    api = { setup, transfer };
  }
  assert.deepEqual(events, []); state.ready = true;
  return { api, state, events, options, root, geometry, marker };
}
const plain = value => JSON.parse(JSON.stringify(value));
function run(composed) {
  const f = fixture(composed), { api, geometry, state, options } = f;
  const reset = api.setup.reset();
  const spline = geometry.addSpline([geometry.addPoint(0, 0), geometry.addPoint(30, 20), geometry.addPoint(60, 0)], false, false);
  options.interaction.selection.set('splines', [spline]); state.mode = 'spline'; state.editing = { spline };
  const observation = api.setup.state(), constraints = api.setup.exerciseConstraints(), transfer = api.transfer.exercise();
  return plain({ reset, observation, constraints, transfer, events: f.events, annotations: f.root.annotations, definitions: f.root.blockDefinitions.map(d => d.id), instances: f.root.blockInstances });
}
test('Spline Workspace support preserves setup, observation, constraint and transfer behavior through actual Geometry owners', () => {
  const actual = run(true); assert.deepEqual(actual, run(false));
  assert.equal(actual.observation.mode, 'spline'); assert.equal(actual.transfer.copied, true);
  assert.equal(actual.transfer.definition.splineCount, 1); assert.equal(actual.transfer.projection.ownerId, 'BI1');
});
test('Spline support keeps bound editing observations separate from Workspace transfer and reads current operation each time', () => {
  const f = fixture(true), local = w.DocumentState.create();
  f.state.bound = local;
  assert.equal(f.api.setup.exerciseConstraints(), null); assert.equal(f.api.transfer.exercise(), null);
  f.state.mode = 'select'; assert.equal(f.api.setup.state().mode, 'select');
  f.state.mode = 'spline'; f.state.editing = { spline: { id: 'new-edit' } };
  assert.equal(f.api.setup.state().editSplineId, 'new-edit');
  const host = f.options.documentWorkspace.workspace.capture(); f.options.documentWorkspace.workspace.activate(local);
  const preview = f.api.setup.hatchPreviewCache(); assert.equal(local.splines[0].id, preview.splineId); assert.equal(f.root.splines.length, 0);
  assert.equal(preview.beforeMaxX, 100); assert.equal(preview.afterMaxX, 180);
  f.options.documentWorkspace.workspace.restore(host);
});
test('Spline support preserves exception identity and callback order without constructor queries', () => {
  for (const failure of ['reset', 'viewport', 'resize', 'history', 'ui', 'draw', 'rect', 'screen', 'serialize']) {
    const old = fixture(false), next = fixture(true); old.state.failure = next.state.failure = failure;
    for (const f of [old, next]) assert.throws(() => f.api.setup.reset(), error => error === f.marker);
    assert.deepEqual(next.events, old.events);
  }
});

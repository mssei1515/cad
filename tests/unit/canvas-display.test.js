const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/ui/number_display.js', 'src/ui/canvas_input_binding.js', 'src/rendering/viewport.js', 'src/ui/canvas_navigation.js', 'src/ui/canvas_zoom_control.js', 'src/rendering/canvas_surface.js', 'src/rendering/canvas_export.js', 'src/ui/canvas_workspace_layout.js', 'src/application/canvas_display.js', 'src/geometry/export_region.js', 'src/persistence/document_files.js', 'src/persistence/png_file.js', 'src/commands/png_export_command.js', 'src/application/png_export.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
function fixture(fitVisibleGeometry = () => true, library = sandbox.window) {
  const calls = [], state = { ready: false, rect: { left: 0, top: 0, width: 200, height: 100 }, pending: false, dpr: 2, error: null, onDraw: null };
  const element = () => {
    const handlers = {};
    return { hidden: false, textContent: '', value: '', valueAsNumber: 100,
      addEventListener(name, handler) { handlers[name] = handler; }, removeEventListener(name) { delete handlers[name]; },
      emit(name, event = {}) { handlers[name]?.({ preventDefault() {}, stopPropagation() {}, ...event }); },
      focus() { calls.push('focus'); }, select() {}, checkValidity: () => true, reportValidity() {} };
  };
  const button = element(), input = element(), browser = element(), status = element();
  const ready = () => assert.equal(state.ready, true);
  const document = { getElementById(id) { calls.push(['element', id]); return id === 'statusZoom' ? button : id === 'statusZoomInput' ? input : id === 'statusCoordinates' ? status : null; }, querySelector: () => null };
  const canvas = { ...element(), width: 0, height: 0, getBoundingClientRect() { ready(); calls.push('rect'); return state.rect; }, classList: { add() {}, remove() {} }, setPointerCapture() {} };
  const ctx = { setTransform(...args) { ready(); calls.push(['transform', ...args]); } };
  const display = library.CanvasDisplay.create({ canvas, document, initialScale: 2, minZoom: 0.1, maxZoom: 20, minLength: 1e-6,
    draw: () => { ready(); calls.push('draw'); state.onDraw?.(); }, setHint: () => calls.push('hint'), fitVisibleGeometry,
    flushPointerMoves: () => { ready(); calls.push('flush'); if (state.error) throw state.error; }, syncDimensionValueInput: () => calls.push('input'),
  });
  assert.deepEqual(calls, [['element', 'statusZoom'], ['element', 'statusZoomInput']]); calls.length = 0;
  class Observer { constructor(callback) { ready(); state.resize = callback; calls.push('observer'); } observe(value) { assert.equal(value, canvas); calls.push('observe'); } disconnect() { calls.push('disconnect'); } }
  const workspace = display.createWorkspace({ ctx, readPixelRatio: () => { ready(); return state.dpr; }, ResizeObserverClass: Observer,
    withGeometryReadCache: callback => { calls.push('cache'); return callback(); }, drawCanvas: () => { ready(); calls.push('content'); state.onContent?.(); },
    isValueInputPending: () => { calls.push('pending'); return state.pending; }, window: browser, updatePropertiesUI() {}, closeContextMenu: () => calls.push('close-menu'),
    applySketchTreeWidth: () => calls.push('tree'), applicationText: (_ja, en) => en, readLanguage: () => 'en',
  });
  assert.deepEqual(calls, []); state.ready = true;
  const enter = percent => { button.emit('click'); input.valueAsNumber = percent; input.emit('keydown', { key: 'Enter' }); };
  return { display, workspace, state, calls, button, input, browser, canvas, ctx, enter, status, document };
}

function inputFixture() {
  const f = fixture(), events = [], state = { panel: null, png: null, suppressed: false };
  const pointer = Object.fromEntries(['down', 'move', 'finish', 'leave', 'doubleClick'].map(name => [name, (...args) => events.push([name, ...args])]));
  f.state.ready = false;
  const binding = f.workspace.createInputBinding({ pointer,
    readCommandPanel: () => { assert.equal(f.state.ready, true); return state.panel; },
    readPngExportCommand: () => { assert.equal(f.state.ready, true); return state.png; },
    blankCanvasGesture: { suppressNext: () => { state.suppressed = true; }, takeSuppression: () => { const value = state.suppressed; state.suppressed = false; return value; } },
    isBlankCommandPanelPoint: () => true,
    scheduler: { flush: () => { f.calls.push('flush'); if (f.state.error) throw f.state.error; }, schedule: event => binding.processMove(event) },
    profileCommit: work => { events.push(['profile']); return work(); },
  });
  assert.deepEqual(f.calls, []); assert.deepEqual(events, []); binding.bind(); assert.deepEqual(f.calls, []); f.state.ready = true;
  return { ...f, binding, events, routing: state };
}

test('workspace input shares viewport coordinates, navigation and late pending-input synchronization', () => {
  const f = inputFixture();
  f.canvas.emit('pointermove', { offsetX: 8, offsetY: 12, shiftKey: true });
  const world = f.display.viewport.screenToWorld({ x: 8, y: 12 });
  const format = sandbox.window.NumberDisplay.formatDisplayNumber;
  assert.equal(f.status.textContent, `X ${format(world.x, 3)} / Y ${format(world.y, 3)}`);
  assert.equal(f.events[0][0], 'move'); assert.equal(f.events[0][2].x, world.x); assert.equal(f.events[0][3], true);
  for (const pending of [false, true]) {
    f.state.pending = pending; f.calls.length = 0;
    const previousScale = f.display.viewport.scale;
    f.canvas.emit('wheel', { clientX: 8, clientY: 12, offsetX: 8, offsetY: 12, deltaY: -100, preventDefault: () => f.calls.push('prevent') });
    assert.ok(f.display.viewport.scale > previousScale);
    const zoomed = f.display.viewport.screenToWorld({ x: 8, y: 12 });
    assert.ok(Math.abs(zoomed.x - world.x) < 1e-12); assert.ok(Math.abs(zoomed.y - world.y) < 1e-12);
    assert.deepEqual(f.calls.filter(value => typeof value === 'string' && value !== 'rect'),
      ['prevent', 'flush', 'close-menu', 'hint', 'draw', 'pending', ...(pending ? ['input'] : [])]);
  }
  const before = f.display.viewport.snapshot(), failure = new Error('flush failed'); f.state.error = failure; f.calls.length = 0;
  assert.throws(() => f.canvas.emit('wheel', { preventDefault: () => f.calls.push('prevent') }), error => error === failure);
  assert.deepEqual(f.calls, ['prevent', 'flush']); assert.deepEqual(f.display.viewport.snapshot(), before);
});

test('workspace input combines native flush and profile boundaries with live panel and PNG routing', () => {
  const f = inputFixture();
  const event = { button: 0, clientX: 8, clientY: 12, offsetX: 8, offsetY: 12, preventDefault: () => f.events.push(['prevent']) };
  f.canvas.emit('pointerdown', event); assert.equal(f.calls[0], 'flush'); assert.equal(f.events[0][0], 'down');
  f.routing.panel = { active: true, canvasPress: () => true, canvasDoubleClick: () => f.events.push(['panel-double']) };
  f.events.length = 0; f.canvas.emit('pointerdown', event); assert.equal(f.routing.suppressed, true);
  f.canvas.emit('dblclick', event); assert.equal(f.routing.suppressed, false); assert.deepEqual(f.events.map(value => value[0]), ['prevent', 'prevent']);
  f.routing.panel = null; const picked = [];
  f.routing.png = { active: true, pick: point => picked.push(point) }; f.canvas.emit('pointerdown', event);
  assert.equal(picked[0].x, f.display.viewport.screenToWorld({ x: 8, y: 12 }).x);
  f.events.length = 0; f.canvas.emit('pointerup', event); assert.deepEqual(f.events, [['profile']]);
  f.routing.png = null; f.canvas.emit('pointercancel', event); assert.deepEqual(f.events.map(value => value[0]), ['profile', 'profile', 'finish']);
});

test('Canvas display preserves staged initialization and centered zoom through the same viewport and navigation', () => {
  const f = fixture(); assert.ok(Object.isFrozen(f.display)); assert.ok(Object.isFrozen(f.workspace));
  f.display.viewport.update({ x: 10, y: 20 }); f.calls.length = 0;
  f.enter(150);
  assert.equal(f.display.viewport.scale, 3); assert.equal(f.display.viewport.x, -35); assert.equal(f.display.viewport.y, 5);
  assert.deepEqual(f.calls.filter(call => typeof call === 'string' && call !== 'rect'), ['focus', 'flush', 'hint', 'draw', 'input', 'focus']);
  assert.equal(f.button.textContent, '150%'); assert.equal(f.input.hidden, true);
  assert.equal(f.display.navigation.setScale(4), true); f.display.zoomControl.sync(); assert.equal(f.button.textContent, '200%');
  assert.equal(f.workspace.surface.appearanceLineDash('dashed')[0], 2.5);
});

test('zoom rejection retains input and synchronization order while a flush error stops scale and redraw', () => {
  const f = fixture(); f.state.rect.width = 0; f.enter(200);
  assert.equal(f.display.viewport.scale, 2); assert.equal(f.input.hidden, false);
  assert.deepEqual(f.calls.filter(call => typeof call === 'string' && call !== 'rect'), ['focus', 'flush', 'input']);
  f.calls.length = 0; f.enter(NaN); assert.deepEqual(f.calls, ['focus']);
  f.state.rect.width = 200; const error = new Error('flush failed'); f.state.error = error; f.calls.length = 0;
  assert.throws(() => f.enter(200), value => value === error); assert.deepEqual(f.calls, ['focus', 'flush']); assert.equal(f.display.viewport.scale, 2);
});

test('surface observation starts explicitly and resize reads pending after draw while layout uses the same bitmap and viewport', () => {
  const f = fixture(); f.workspace.surface.start(); assert.deepEqual(f.calls, ['observer', 'observe']); f.calls.length = 0;
  f.state.onDraw = () => { f.state.pending = true; };
  f.state.resize([{ contentRect: { width: 200, height: 100 } }]);
  assert.equal(f.canvas.width, 400); assert.equal(f.canvas.height, 200); assert.equal(f.workspace.surface.dpr, 2);
  assert.deepEqual(f.calls.slice(1), ['draw', 'pending', 'input']);
  f.calls.length = 0; f.workspace.layout.resizeCanvas({ centerWorld: { x: 10, y: 15 } });
  assert.equal(f.display.viewport.x, 80); assert.equal(f.display.viewport.y, 20);
  assert.deepEqual(f.calls.slice(2), ['tree', 'draw', 'pending', 'input']);
  f.calls.length = 0; f.workspace.layout.bindWindow(); assert.deepEqual(f.calls, []);
  f.browser.emit('resize'); assert.equal(f.calls[0], 'close-menu');
  f.workspace.surface.dispose(); assert.equal(f.calls.at(-1), 'disconnect');
});

test('export uses the shared viewport and restores its frame before interactive bitmap and drawing', () => {
  const f = fixture(), renderer = f.workspace.exportRenderer; f.display.viewport.update({ x: 10, y: 20, scale: 4 });
  assert.equal(renderer.frame, null);
  f.state.onContent = () => { assert.deepEqual({ ...renderer.frame.region }, { x: 18, y: 32 }); assert.deepEqual({ ...renderer.frame.ratio }, { x: 2, y: 3 }); };
  renderer.render({ x: 2, y: 3, width: 10, height: 20 }, { x: 8, y: 12 });
  assert.deepEqual({ ...renderer.frame.worldBounds }, { x1: 2, y1: 3, x2: 12, y2: 23 }); assert.deepEqual(f.calls, ['cache', 'content']);
  f.calls.length = 0; f.state.onDraw = () => assert.equal(renderer.frame, null); renderer.restore();
  assert.equal(renderer.frame, null); assert.equal(f.canvas.width, 400); assert.equal(f.calls.at(-1), 'draw');
  assert.deepEqual({ ...f.display.viewport.snapshot() }, { x: 10, y: 20, scale: 4 });
});

const interactiveOrder = ['block-handles', 'dimensions', 'dimension-preview', 'annotations', 'annotation-preview', 'authoring',
  'block-placement', 'free-instance', 'offset', 'trim', 'snap', 'arc-handles', 'spline-handles', 'points', 'image-overlays', 'identity', 'selection-rect', 'export-overlay'];
function workspaceRenderingFixture() {
  const f = fixture(), stages = [];
  f.state.ready = false;
  function stage(name) {
    assert.equal(f.state.ready, true); stages.push(name);
    if (f.state.failure === name) throw f.state.error;
  }
  for (const name of ['clearRect', 'save', 'translate', 'scale', 'restore', 'setLineDash']) {
    f.ctx[name] = (...args) => { assert.equal(f.state.ready, true); f.calls.push([name, ...args]); };
  }
  function owner(methods) {
    const api = {};
    for (const [method, name] of Object.entries(methods)) api[method] = function () { assert.equal(this, api); stage(name); };
    return api;
  }
  const rendering = f.workspace.createRendering({ recordDraw: () => stage('record'),
    geometry: owner({ drawArcEndpointHandles: 'arc-handles', drawSplineEditHandles: 'spline-handles', drawPoints: 'points' }),
    dimensions: owner({ draw: 'dimensions' }), annotations: owner({ draw: 'annotations', drawPreview: 'annotation-preview' }),
    drawDimensionPreview: () => stage('dimension-preview'), authoringPreview: owner({ draw: 'authoring', drawTrimPreview: 'trim' }),
    placements: owner({ drawBlockPlacementPreview: 'block-placement', drawFreeInstancePreview: 'free-instance' }),
    offsetPreview: owner({ draw: 'offset' }), drawBlockInstanceHandles: () => stage('block-handles'), drawSnapMarker: () => stage('snap'),
    drawReferenceImages: () => stage('images'), drawHatches: () => stage('hatches'), drawDrawingStack: () => stage('stack'),
    drawReferenceImageOverlays: () => stage('image-overlays'), drawSketchIdentityLabel: () => stage('identity'),
    drawSelectionRect: () => stage('selection-rect'), drawExportOverlay: () => stage('export-overlay') });
  assert.deepEqual(f.calls, []); assert.deepEqual(stages, []); assert.ok(Object.isFrozen(rendering));
  f.state.onContent = rendering.draw; f.state.onDraw = rendering.draw; f.state.ready = true;
  return { ...f, rendering, stages };
}

test('Workspace rendering shares the live viewport, bitmap, zoom display and PNG frame without repeated infrastructure ports', () => {
  const f = workspaceRenderingFixture(), other = workspaceRenderingFixture();
  f.display.viewport.update({ x: 10, y: 20, scale: 4 });
  f.rendering.draw(); assert.equal(f.button.textContent, '200%');
  assert.equal(f.canvas.width, 400); assert.equal(f.workspace.surface.dpr, 2);
  assert.deepEqual(f.stages, ['record', 'images', 'hatches', 'stack', ...interactiveOrder]);
  assert.equal(other.canvas.width, 0); assert.deepEqual(other.stages, []);
  f.stages.length = 0; f.calls.length = 0;
  f.workspace.exportRenderer.render({ x: 2, y: 3, width: 10, height: 20 }, { x: 8, y: 12 });
  assert.deepEqual(f.stages, ['images', 'hatches', 'stack', 'dimensions', 'annotations', 'points']);
  assert.ok(f.calls.some(c => c[0] === 'transform' && c[1] === 2 && c[4] === 3 && c[5] === -36 && c[6] === -96));
  assert.deepEqual({ ...f.display.viewport.snapshot() }, { x: 10, y: 20, scale: 4 });
  f.stages.length = 0; f.state.dpr = 3; f.workspace.exportRenderer.restore();
  assert.equal(f.workspace.exportRenderer.frame, null); assert.equal(f.canvas.width, 600);
  assert.deepEqual(f.stages, ['record', 'images', 'hatches', 'stack', ...interactiveOrder]);
});

test('Workspace rendering retains export failure and restore boundaries on the same renderer', () => {
  const f = workspaceRenderingFixture(), error = new Error('annotations failed');
  f.state.failure = 'annotations'; f.state.error = error;
  assert.throws(() => f.workspace.exportRenderer.render({ x: 0, y: 0, width: 10, height: 10 }, { x: 1, y: 1 }), value => value === error);
  assert.ok(f.workspace.exportRenderer.frame); assert.deepEqual(f.stages, ['images', 'hatches', 'stack', 'dimensions', 'annotations']);
  assert.equal(f.calls.some(c => c[0] === 'restore'), false);
  f.state.failure = null; f.stages.length = 0; f.workspace.exportRenderer.restore();
  assert.equal(f.workspace.exportRenderer.frame, null);
  assert.deepEqual(f.stages, ['record', 'images', 'hatches', 'stack', ...interactiveOrder]);
});

function renderingFixture() {
  const calls = [], state = { ready: false, failure: null, onStage: null, dpr: 2, overlay: null, override: undefined };
  const ready = () => assert.equal(state.ready, true, 'rendering construction must stay lazy');
  function stage(name) { ready(); calls.push(name); state.onStage?.(name); if (state.failure === name) throw state.error; }
  const ctx = Object.fromEntries(['setTransform', 'clearRect', 'save', 'translate', 'scale', 'restore', 'setLineDash'].map(name => [name, (...args) => { ready(); calls.push([name, ...args]); }]));
  const canvas = { width: 0, height: 0, getBoundingClientRect() { ready(); return { width: 100, height: 60 }; } }, viewport = { x: 10, y: 20, scale: 3 };
  const surface = sandbox.window.CanvasSurface.create({ canvas, ctx, viewport, readPixelRatio: () => state.dpr });
  function owner(methods) {
    const api = {};
    for (const [method, name] of Object.entries(methods)) api[method] = function () { assert.equal(this, api); stage(name); };
    return api;
  }
  const geometry = owner({ drawArcEndpointHandles: 'arc-handles', drawSplineEditHandles: 'spline-handles', drawPoints: 'points' });
  const annotations = owner({ draw: 'annotations', drawPreview: 'annotation-preview' });
  const png = sandbox.window.CanvasExport.createRenderer({ viewport, withGeometryReadCache: work => { stage('cache'); return work(); },
    drawCanvas: () => rendering.draw(), syncCanvasBitmapSize: surface.syncCanvasBitmapSize, draw: () => rendering.draw() });
  const hatchCalls = [];
  const rendering = sandbox.window.CanvasDisplay.createRendering({ canvas, ctx, viewport, surface, zoomControl: owner({ sync: 'zoom' }),
    readExportFrame: () => { ready(); return state.override === undefined ? png.frame : state.override; }, recordDraw: () => stage('record'),
    geometry, dimensions: owner({ draw: 'dimensions' }), drawDimensionPreview: () => stage('dimension-preview'), annotations,
    authoringPreview: owner({ draw: 'authoring', drawTrimPreview: 'trim' }), placements: owner({ drawBlockPlacementPreview: 'block-placement', drawFreeInstancePreview: 'free-instance' }),
    offsetPreview: owner({ draw: 'offset' }), drawBlockInstanceHandles: () => stage('block-handles'), drawSnapMarker: () => stage('snap'),
    drawReferenceImages: () => stage('images'), drawHatches: (items, options) => { hatchCalls.push([items, options]); stage('hatches'); }, drawDrawingStack: () => stage('stack'),
    drawReferenceImageOverlays: () => stage('image-overlays'), drawSketchIdentityLabel: () => stage('identity'), drawSelectionRect: () => stage('selection-rect'),
    drawExportOverlay: () => { stage('export-overlay'); state.overlay?.(ctx, viewport.scale); } });
  assert.deepEqual(calls, []); assert.equal(Object.isFrozen(rendering), true); state.ready = true;
  return { rendering, calls, state, viewport, surface, canvas, ctx, png, geometry, annotations, hatchCalls, stages: () => calls.filter(call => typeof call === 'string') };
}

test('rendering composition connects content and all interactive stages with current owners and overlay', () => {
  const f = renderingFixture(); f.rendering.draw();
  assert.deepEqual(f.stages(), ['zoom', 'record', 'images', 'hatches', 'stack', ...interactiveOrder]);
  assert.equal(f.hatchCalls[0][0].length, 0); assert.equal(f.hatchCalls[0][1].includePreview, true);
  assert.equal(f.canvas.width, 200); assert.equal(f.canvas.height, 120);
  f.calls.length = 0; f.viewport.scale = 5; f.state.dpr = 3; f.surface.syncCanvasBitmapSize();
  f.state.overlay = (ctx, scale) => { assert.equal(ctx, f.ctx); assert.equal(scale, 5); };
  f.annotations.drawPreview = function () { assert.equal(this, f.annotations); f.calls.push('current-preview'); };
  f.geometry.drawPoints = function () { assert.equal(this, f.geometry); f.calls.push('current-points'); };
  f.rendering.draw();
  assert.deepEqual(f.stages(), ['zoom', 'record', 'images', 'hatches', 'stack', ...interactiveOrder.map(name => name === 'annotation-preview' ? 'current-preview' : name === 'points' ? 'current-points' : name)]);
  assert.ok(f.calls.some(c => c[0] === 'setTransform' && c[1] === 3 && c[4] === 3));
  assert.notEqual(f.hatchCalls[0][0], f.hatchCalls[1][0]);
});

test('PNG rendering shares content and document layers, then restore returns to interactive drawing', () => {
  const f = renderingFixture(); f.png.render({ x: 2, y: 3, width: 10, height: 20 }, { x: 12, y: 15 });
  assert.deepEqual(f.stages(), ['cache', 'zoom', 'images', 'hatches', 'stack', 'dimensions', 'annotations', 'points']);
  assert.ok(f.calls.some(c => c[0] === 'setTransform' && c[1] === 4 && c[4] === 5 && c[5] === -64 && c[6] === -145));
  assert.deepEqual({ ...f.viewport }, { x: 10, y: 20, scale: 3 });
  f.calls.length = 0; f.png.restore(); assert.equal(f.png.frame, null);
  assert.deepEqual(f.stages(), ['zoom', 'record', 'images', 'hatches', 'stack', ...interactiveOrder]);
});

test('frame routing reads export state again after content instead of capturing it during construction or draw entry', () => {
  const f = renderingFixture();
  f.state.onStage = name => { if (name === 'stack') f.state.override = { ratio: { x: 1, y: 1 }, region: { x: 0, y: 0 } }; };
  f.rendering.draw(); assert.deepEqual(f.stages(), ['zoom', 'record', 'images', 'hatches', 'stack', 'dimensions', 'annotations', 'points']);
  assert.equal(f.calls.filter(c => c[0] === 'restore').length, 1);
  f.calls.length = 0; f.state.onStage = name => { if (name === 'stack') f.state.override = null; };
  f.rendering.draw(); assert.deepEqual(f.stages(), ['zoom', 'images', 'hatches', 'stack', ...interactiveOrder]);
});

test('composition retains failure boundaries without adding restoration or swallowing errors', () => {
  for (const failed of ['hatches', 'stack', 'annotation-preview', 'points', 'export-overlay']) {
    const f = renderingFixture(), error = new Error(failed); f.state.failure = failed; f.state.error = error;
    assert.throws(() => f.rendering.draw(), value => value === error);
    const order = ['zoom', 'record', 'images', 'hatches', 'stack', ...interactiveOrder];
    assert.deepEqual(f.stages(), order.slice(0, order.indexOf(failed) + 1));
    assert.equal(f.calls.some(c => c[0] === 'restore'), false);
  }
  const f = renderingFixture(), error = new Error('export annotations'); f.state.failure = 'annotations'; f.state.error = error;
  assert.throws(() => f.png.render({ x: 0, y: 0, width: 10, height: 10 }, { x: 1, y: 1 }), value => value === error);
  assert.ok(f.png.frame); assert.deepEqual(f.stages(), ['cache', 'zoom', 'images', 'hatches', 'stack', 'dimensions', 'annotations']);
  f.state.failure = null; f.calls.length = 0; f.png.restore(); assert.equal(f.png.frame, null); assert.ok(f.stages().includes('export-overlay'));
});

function workspacePngFixture() {
  const f = fixture(), stages = [], s = f.state; s.mode = 'line';
  const button = new EventTarget(), originalGet = f.document.getElementById;
  f.document.getElementById = id => id === 'pngExportBtn' ? button : originalGet(id);
  let resolveFonts;
  const fonts = new Promise(resolve => { resolveFonts = resolve; });
  f.document.fonts = { get ready() { stages.push('fonts'); return fonts; } };
  f.document.createElement = kind => {
    assert.equal(kind, 'canvas'); stages.push('output');
    return { getContext: () => ({ drawImage(source) { assert.equal(source, f.canvas); assert.equal(source.width, 40); assert.equal(source.height, 20); stages.push('copy'); } }),
      toBlob(callback) { stages.push('blob'); callback({ type: 'image/png' }); } };
  };
  f.browser.DocumentFiles = sandbox.window.DocumentFiles;
  f.browser.showSaveFilePicker = async options => { assert.equal(options.suggestedName, 'current-name.png'); stages.push('picker'); return {
    createWritable: async () => ({ write: async blob => { assert.equal(blob.type, 'image/png'); stages.push('write'); }, close: async () => stages.push('close') }) }; };
  const pending = { get current() { assert.equal(s.ready, true); return s.command; }, replace(value) { assert.equal(this, pending); s.command = value; }, clear() { assert.equal(this, pending); s.command = null; } };
  const lifecycle = { readMode: function() { 'use strict'; assert.equal(this, undefined); assert.equal(s.ready, true); return s.mode; },
    setMode: function(mode) { 'use strict'; assert.equal(this, undefined); assert.equal(s.ready, true); s.mode = mode; }, active() { assert.equal(this, lifecycle); return false; } };
  f.workspace.surface.syncCanvasBitmapSize(); f.calls.length = 0; s.ready = false;
  const feature = f.workspace.createPngExport({ documentName: () => 'current-name', prepareImages: async () => stages.push('images'),
    drawOperationLifecycle: lifecycle, pendingCommandSession: pending, fileSession: { get busy() { return s.fileBusy; } },
    constraintTargetSession: { get command() { return s.constraint; } },
    findSnap: (point, tolerance) => { s.snapArgs = [point, tolerance]; if (s.snapError) throw s.snapError; return s.snap; },
    flushPointerMove: () => { f.calls.push('flush'); if (s.flushError) throw s.flushError; } });
  assert.deepEqual(f.calls, []); assert.deepEqual(stages, []); s.ready = true;
  return { ...f, feature, stages, button, pending, resolveFonts };
}

test('Workspace PNG uses the same live viewport, mode, pending session and read cache after explicit start', () => {
  const f = workspacePngFixture(); f.button.dispatchEvent(new Event('click')); assert.equal(f.feature.command.active, false);
  f.feature.start(); f.feature.start(); f.state.fileBusy = true; f.button.dispatchEvent(new Event('click'));
  assert.deepEqual(f.calls, ['flush','hint']); assert.equal(f.state.mode, 'line'); assert.equal(f.feature.command.active, false);
  f.calls.length = 0; f.state.fileBusy = false; f.state.flushError = new Error('flush failed');
  assert.throws(() => f.feature.open(), error => error === f.state.flushError); assert.deepEqual(f.calls, ['flush']);
  f.state.flushError = null; f.calls.length = 0; f.feature.open(); assert.equal(f.state.mode, 'png-export'); assert.equal(f.pending.current.type, 'png-export');
  f.display.viewport.update({ x: 10, y: 20, scale: 4 }); const point = { x: 1, y: 2 }; f.state.snap = { x: 3, y: 4 };
  f.feature.command.pick(point); assert.equal(f.state.snapArgs[0], point); assert.equal(f.state.snapArgs[1], 2.5); assert.equal(f.calls.includes('cache'), true);
  const previous = f.workspace.exportRenderer.frame; f.state.snapError = new Error('snap failed');
  assert.throws(() => f.feature.command.move(point), error => error === f.state.snapError); assert.equal(f.workspace.exportRenderer.frame, previous);
  f.feature.command.cancel(); assert.equal(f.state.mode, 'line'); assert.equal(f.pending.current, null);
  f.feature.dispose(); f.button.dispatchEvent(new Event('click')); assert.equal(f.feature.command.active, false);
});

test('Workspace PNG captures through the existing renderer after fonts and images, restoring the same bitmap and viewport on success or failure', async () => {
  for (const fail of [false, true]) {
    const f = workspacePngFixture(); f.display.viewport.update({ x: 10, y: 20, scale: 4 }); f.feature.open();
    f.feature.command.pick({ x: 0, y: 0 }); f.feature.command.pick({ x: 10, y: 5 }); f.feature.command.onSetting('dpi', 96);
    const viewport = { ...f.display.viewport.snapshot() }, bitmap = [f.canvas.width, f.canvas.height];
    f.state.onContent = () => {
      const frame = f.workspace.exportRenderer.frame; assert.ok(frame); assert.equal(frame.ratio.x, 1);
      assert.deepEqual({ ...frame.worldBounds }, { x1: 0, y1: 0, x2: 10, y2: 5 }); f.stages.push('render');
      if (fail) throw new Error('capture failed');
    };
    const saving = f.feature.command.onAction('finish'); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.stages, ['picker','fonts']); assert.equal(f.feature.command.busy, true);
    f.resolveFonts(); await saving;
    assert.deepEqual(f.stages, fail ? ['picker','fonts','images','output','render'] : ['picker','fonts','images','output','render','copy','blob','write','close']);
    assert.equal(f.workspace.exportRenderer.frame, null); assert.deepEqual([f.canvas.width, f.canvas.height], bitmap);
    assert.deepEqual({ ...f.display.viewport.snapshot() }, viewport); assert.equal(f.feature.command.busy, false);
    assert.equal(f.feature.command.active, fail); assert.equal(f.state.mode, fail ? 'png-export' : 'line');
    if (fail) { assert.equal(f.feature.command.readState().message.includes('capture failed'), true); f.feature.command.cancel(); }
    assert.equal(f.pending.current, null);
  }
});

test('drawing fit shares the actual viewport while deferring active Sketch, bounds and Canvas size reads', () => {
  const f = fixture(), reads = [], state = { active: 'S1', selected: { x1: 0, y1: 0, x2: 100, y2: 50 },
    all: { x1: -200, y1: -100, x2: 200, y2: 100 }, visible: null };
  f.state.ready = false; f.calls.length = 0;
  const fit = f.display.createDrawingFit({ activeSketchId: () => { reads.push('active'); return state.active; }, bounds: {
    sketchGeometryBounds: id => { reads.push(['sketch', id]); return state.selected; },
    allGeometryBounds: () => { reads.push('all'); return state.all; },
    visibleGeometryBounds: () => { reads.push('visible'); return state.visible; },
  } });
  assert.ok(Object.isFrozen(fit)); assert.deepEqual(reads, []); assert.deepEqual(f.calls, []);
  f.state.ready = true; f.state.rect = { left: 0, top: 0, width: 1000, height: 800 };
  assert.equal(fit.fitSketchToViewport(), true); assert.deepEqual(reads.splice(0), ['active', ['sketch', 'S1']]);
  assert.equal(f.display.viewport.scale, 8.08); assert.equal(f.display.viewport.x, 96); assert.equal(f.display.viewport.y, 198);
  state.active = 'S2'; assert.equal(fit.fitSketchToViewport(undefined, 200), true);
  assert.deepEqual(reads.splice(0), ['active', ['sketch', 'S2']]); assert.equal(f.display.viewport.scale, 6);
  assert.equal(fit.fitAllGeometryToViewport(0), true); assert.deepEqual(reads.splice(0), ['all']); assert.equal(f.display.viewport.scale, 2.5);
  const previous = { ...f.display.viewport.snapshot() };
  assert.equal(fit.fitVisibleGeometryToViewport(), false); assert.deepEqual(reads.splice(0), ['visible']);
  assert.deepEqual({ ...f.display.viewport.snapshot() }, previous);
  state.visible = { x1: 10, y1: 10, x2: 30, y2: 20 }; assert.equal(fit.fitVisibleGeometryToViewport(), true);
  assert.deepEqual({ ...f.display.viewport.snapshot() }, { x: 100, y: 100, scale: 20 });
  assert.equal(f.calls.includes('draw'), false); assert.equal(f.calls.includes('hint'), false);
});

test('drawing fit retains late navigation routing and stops on query failure before changing viewport or redrawing', () => {
  let fit; const f = fixture(() => fit.fitVisibleGeometryToViewport()), marker = new Error('bounds read');
  const state = { bounds: { x1: 0, y1: 0, x2: 20, y2: 10 }, fail: false }; let reads = 0;
  fit = f.display.createDrawingFit({ activeSketchId: () => 'S1', bounds: {
    visibleGeometryBounds() { reads++; if (state.fail) throw marker; return state.bounds; },
  } });
  sandbox.performance = { now: () => 100 }; f.calls.length = 0;
  const event = { button: 1, clientX: 20, clientY: 30 };
  assert.equal(f.display.navigation.doubleClickFit(event), false); assert.equal(reads, 0);
  assert.equal(f.display.navigation.doubleClickFit(event), true); assert.equal(reads, 1);
  assert.deepEqual(f.calls.filter(call => ['hint', 'draw'].includes(call)), ['hint', 'draw']);
  const before = { ...f.display.viewport.snapshot() }; f.calls.length = 0; state.fail = true;
  assert.throws(() => fit.fitVisibleGeometryToViewport(), error => error === marker);
  assert.deepEqual({ ...f.display.viewport.snapshot() }, before); assert.deepEqual(f.calls, []);
  state.fail = false; state.bounds = null;
  assert.equal(fit.fitVisibleGeometryToViewport(), false); assert.deepEqual({ ...f.display.viewport.snapshot() }, before);
});

test('empty viewport reset reads the current Canvas size only on demand and restores its initial scale and center', () => {
  const f = fixture(); f.state.ready = false;
  const fit = f.display.createDrawingFit({ activeSketchId: () => assert.fail('no Sketch query'), bounds: {
    sketchGeometryBounds: () => assert.fail('no Sketch bounds'), allGeometryBounds: () => assert.fail('no drawing bounds'),
    visibleGeometryBounds: () => assert.fail('no visible bounds'),
  } });
  assert.deepEqual(f.calls, []); f.state.ready = true;
  f.display.viewport.update({ scale: 9, x: 10, y: 20 }); f.state.rect = { width: 320, height: 180 };
  assert.equal(fit.resetEmptyViewport(), undefined); assert.deepEqual({ ...f.display.viewport.snapshot() }, { scale: 2, x: 160, y: 90 });
  assert.deepEqual(f.calls, ['rect']); f.calls.length = 0;
  f.display.viewport.update({ scale: 7, x: 1, y: 2 }); f.state.rect = { width: 0, height: 0 };
  fit.resetEmptyViewport(); assert.deepEqual({ ...f.display.viewport.snapshot() }, { scale: 2, x: 0, y: 0 }); assert.deepEqual(f.calls, ['rect']);
});

test('empty viewport reset preserves scale then X then Y updates and the existing partial state on a Canvas read error', () => {
  for (const failAt of ['rect','width','height']) {
    const f = fixture(), marker = new Error(failAt), fit = f.display.createDrawingFit({ bounds: {}, activeSketchId: () => assert.fail('no Sketch query') });
    f.display.viewport.update({ scale: 9, x: 10, y: 20 });
    f.canvas.getBoundingClientRect = () => {
      f.calls.push('rect'); if (failAt === 'rect') throw marker;
      return {
        get width() {
          f.calls.push('width'); assert.deepEqual({ ...f.display.viewport.snapshot() }, { scale: 2, x: 10, y: 20 });
          if (failAt === 'width') throw marker; return 320;
        },
        get height() {
          f.calls.push('height'); assert.deepEqual({ ...f.display.viewport.snapshot() }, { scale: 2, x: 160, y: 20 });
          throw marker;
        },
      };
    };
    assert.throws(() => fit.resetEmptyViewport(), error => error === marker);
    assert.deepEqual(f.calls, ['rect','width','height'].slice(0, ['rect','width','height'].indexOf(failAt) + 1));
    assert.deepEqual({ ...f.display.viewport.snapshot() }, failAt === 'rect' ? { scale: 9, x: 10, y: 20 }
      : failAt === 'width' ? { scale: 2, x: 10, y: 20 } : { scale: 2, x: 160, y: 20 });
  }
});

const sceneSandbox = { window: {} }; vm.createContext(sceneSandbox);
const sceneSources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sceneSources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sceneSandbox, { filename: file });
const sceneWindow = sceneSandbox.window;
function sceneFixture() {
  const f = fixture(() => true, sceneWindow), reads = [], strokes = [], stack = [];
  const state = { active: 'S1', sidebar: null, language: 'en', failure: null,
    scope: Object.fromEntries(['points','lines','circles','arcs','splines','annotations','hatches','referenceImages'].map(key => [key, []])) };
  const read = name => { assert.equal(f.state.ready, true); reads.push(name); if (state.failure) throw state.failure; };
  const styles = ['strokeStyle','fillStyle','lineWidth','globalAlpha','shadowBlur','shadowColor','lineCap','lineJoin'];
  f.ctx.save = () => { assert.equal(f.state.ready, true); f.calls.push('save'); stack.push(Object.fromEntries(styles.map(key => [key, f.ctx[key]]))); };
  f.ctx.restore = () => { f.calls.push('restore'); Object.assign(f.ctx, stack.pop()); };
  for (const name of ['beginPath','closePath','lineTo','fill','arc','fillText','setLineDash']) f.ctx[name] = (...args) => { assert.equal(f.state.ready, true); f.calls.push([name, ...args]); };
  f.ctx.moveTo = (...args) => { assert.equal(f.state.ready, true); f.ctx.start = args; };
  f.ctx.stroke = () => { assert.equal(f.state.ready, true);
    strokes.push({ color: f.ctx.strokeStyle, width: f.ctx.lineWidth, start: f.ctx.start }); };
  const selection = { points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], geometryInstances: [] }, hover = { current: {} };
  const visible = item => { read('visibility'); return item.visible !== false; }, active = item => item.sketchId === state.active;
  const sketches = { activeSketchId: () => { read('active'); return state.active; }, elementSketchId: item => item.sketchId,
    sketchRelationToActive: id => id === state.active ? 'active' : 'inactive', sketchName: id => id, isEditableSketchElement: active };
  const geometryReads = Object.fromEntries(['points','lines','circles','arcs','splines'].map(key => [
    'allGeometry' + key[0].toUpperCase() + key.slice(1), () => { read(key); return state.scope[key]; } ]));
  Object.assign(geometryReads, { allAnnotations: () => { read('annotations'); return state.scope.annotations; }, allHatches: () => { read('hatches'); return state.scope.hatches; } });
  const geometryAppearance = { effectiveAppearanceForElement: item => ({ color: '#334455', lineWidth: 1.5, lineType: 'solid', endpointOverhang: false, ...item.appearance }),
    isVisibleSketchElement: visible, isVisibleSketchId: () => true, isVisibleValue: value => value !== false };
  const sketchStyle = sceneWindow.GeometryPresentation.createSketchStyle({ isVisibleSketchElement: visible, isActiveSketchElement: active,
    sketchHasSolveError: () => false, elementSketchId: sketches.elementSketchId, sketchRelationOfElement: item => active(item) ? 'active' : 'inactive', constraintStatusOf: () => 'under' });
  const commandTargets = sceneWindow.GeometryPresentation.createCommandTargets({ readPanelSelection: () => null, readMode: () => 'select',
    readOperands: () => [], readConstraintCommand: () => null, readPending: () => null, sameArcEndpoint: () => false });
  f.state.ready = false;
  const scene = f.workspace.createScene({ Point: sceneWindow.GeometrySolver.Point, currentScope: () => { read('scope'); return state.scope; }, sketches,
    readServices: { reads: geometryReads, geometryAppearance, hatches: { resolvedHatchBoundary: () => { read('boundary'); return {}; } } },
    pointUsage: { isSplineOnlyFitPoint: () => false, isEditableSplineFitPoint: () => false, isExplicitPoint: () => true,
      isPointUsedByPrimitive: () => false, isReferencePoint: () => false, isAnyLineEndpoint: () => false, isEndpointPoint: () => false },
    commandTargets, sketchStyle, canvasSelection: selection, canvasHover: hover,
    selectionHighlight: { get current() { read('sidebar'); return state.sidebar; }, isSidebarHoveredElement: () => false, isSelectedConstraintRelatedElement: () => false },
    viewState: {}, isSidebarHighlightedElement: () => false, canvasThemeColor: color => color,
    applicationText: (ja,en) => state.language === 'en' ? en : ja, constructionAlpha: .72, constructionExtensionScreenPx: 10,
    sameArcEndpoint: () => false, arcEndpointPoint: sceneWindow.GeometryKernel.arcEndpointPoint, findArcEndpointFixedConstraint: () => null, pointLockedByLineFixed: () => false,
    editingQueries: { isDraggingArcEndpoint: () => { read('drag-arc'); return false; }, isDraggingPoint: () => { read('drag-point'); return false; },
      isDraggingCenter: () => { read('drag-center'); return false; }, editedSpline: () => { read('spline-edit'); return null; } },
    annotationBounds: () => { read('annotation-bounds'); return null; }, resolvedLoopBounds: () => { read('hatch-bounds'); return null; }, hatchAppearanceForDisplay: () => ({ visible: true }),
  });
  assert.deepEqual(reads, []); assert.deepEqual(f.calls, []); f.state.ready = true;
  f.workspace.surface.syncCanvasBitmapSize(200,100); f.calls.length = 0;
  return { ...f, scene, sceneState: state, reads, strokes, stack, selection };
}

test('workspace scene shares visibility, current scope and viewport across actual geometry rendering, bounds, fit and export', () => {
  const f = sceneFixture(), { Point, Line } = sceneWindow.GeometrySolver;
  assert.equal(Object.isFrozen(f.scene), true);
  const p1 = Object.assign(new Point('P1',0,0), { sketchId: 'S1' }), p2 = Object.assign(new Point('P2',20,10), { sketchId: 'S1' });
  const line = Object.assign(new Line('L1',p1,p2), { sketchId: 'S1' }), other = Object.assign(new Line('L2',new Point('P3',100,100),new Point('P4',200,150)), { sketchId: 'S2', visible: false });
  f.sceneState.scope.points.push(p1,p2); f.sceneState.scope.lines.push(line,other); f.selection.lines.push(line);
  f.scene.geometry.drawLines(); assert.equal(f.strokes.length, 1); assert.equal(f.strokes[0].color, '#1d4ed8');
  assert.deepEqual({ ...f.scene.bounds.visibleGeometryBounds() }, { x1:0,y1:0,x2:20,y2:10 });
  assert.deepEqual({ ...f.scene.bounds.allGeometryBounds() }, { x1:0,y1:0,x2:200,y2:150 });
  assert.equal(f.scene.fit.fitVisibleGeometryToViewport(0), true); assert.equal(f.display.viewport.scale, 10);
  f.state.onContent = () => f.scene.geometry.drawLines(); f.workspace.exportRenderer.render({ x:0,y:0,width:20,height:10 }, { x:2,y:2 });
  assert.equal(f.strokes.at(-1).color, '#334455'); f.workspace.exportRenderer.restore(); f.scene.geometry.drawLines(); assert.equal(f.strokes.at(-1).color, '#1d4ed8');
  other.visible = true; assert.equal(f.scene.fit.fitVisibleGeometryToViewport(0), true); assert.ok(f.display.viewport.scale < 10);
  f.sceneState.active = 'S2'; assert.deepEqual({ ...f.scene.bounds.sketchGeometryBounds() }, { x1:100,y1:100,x2:200,y2:150 });
  assert.equal(f.sceneState.scope.points[0], p1); assert.equal(f.sceneState.scope.lines[0], line); assert.equal(line.p2, p2);
  assert.equal(p1.x, 0); assert.equal(p2.x, 20); assert.equal(f.stack.length, 0);
});

test('workspace scene propagates query errors and keeps the original overlay Canvas cleanup', () => {
  const f = sceneFixture(), { Point, Line } = sceneWindow.GeometrySolver;
  const p1 = Object.assign(new Point('P1',0,0), { sketchId: 'S1' }), p2 = Object.assign(new Point('P2',20,10), { sketchId: 'S1' }), line = Object.assign(new Line('L1',p1,p2), { sketchId: 'S1' });
  f.sceneState.scope.lines.push(line); const points = f.sceneState.scope.points, lines = f.sceneState.scope.lines;
  const before = { ...f.display.viewport.snapshot() }, marker = new Error('scene read'); f.sceneState.failure = marker;
  assert.throws(() => f.scene.fit.fitAllGeometryToViewport(), error => error === marker);
  assert.deepEqual({ ...f.display.viewport.snapshot() }, before); assert.deepEqual(f.calls, []);
  f.sceneState.failure = null; f.ctx.strokeStyle = 'overlay-original'; f.ctx.globalAlpha = .4; f.ctx.shadowBlur = 8;
  f.ctx.fillRect = () => {}; f.ctx.strokeRect = () => { throw marker; };
  assert.throws(() => f.scene.overlay.drawSelectionRect({ rect: { x1:0,y1:0,x2:10,y2:20 }, crossing: false }), error => error === marker);
  assert.equal(f.ctx.strokeStyle, 'overlay-original'); assert.equal(f.ctx.globalAlpha, 1); assert.equal(f.ctx.shadowBlur, 0);
  assert.equal(f.stack.length, 0);
  assert.equal(f.calls.filter(call => call === 'save').length, f.calls.filter(call => call === 'restore').length);
  assert.equal(f.sceneState.scope.lines, lines); assert.equal(f.sceneState.scope.points, points); assert.equal(lines[0], line); assert.equal(line.p1, p1);
  assert.deepEqual({ ...f.display.viewport.snapshot() }, before);
});

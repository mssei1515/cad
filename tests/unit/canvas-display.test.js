const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/ui/number_display.js', 'src/ui/canvas_input_binding.js', 'src/rendering/viewport.js', 'src/ui/canvas_navigation.js', 'src/ui/canvas_zoom_control.js', 'src/rendering/canvas_surface.js', 'src/rendering/canvas_export.js', 'src/ui/canvas_workspace_layout.js', 'src/application/canvas_display.js', 'src/geometry/export_region.js', 'src/persistence/document_files.js', 'src/persistence/png_file.js', 'src/commands/png_export_command.js', 'src/application/png_export.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
function fixture(fitVisibleGeometry = () => true, library = sandbox.window, buildWorkspace = (display, options) => display.createWorkspace(options)) {
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
  const workspace = buildWorkspace(display, { ctx, readPixelRatio: () => { ready(); return state.dpr; }, ResizeObserverClass: Observer,
    withGeometryReadCache: callback => { calls.push('cache'); return callback(); }, drawCanvas: () => { ready(); calls.push('content'); state.onContent?.(); },
    isValueInputPending: () => { calls.push('pending'); return state.pending; }, window: browser, updatePropertiesUI() {}, closeContextMenu: () => calls.push('close-menu'),
    applySketchTreeWidth: () => calls.push('tree'), applicationText: (_ja, en) => en, readLanguage: () => 'en',
  }, { state, calls, canvas, ctx, document });
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
function sceneFixture(fromEditing = false, configure = null) {
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
  const sketchStyle = fromEditing ? null : sceneWindow.GeometryPresentation.createSketchStyle({ isVisibleSketchElement: visible, isActiveSketchElement: active,
    sketchHasSolveError: () => false, elementSketchId: sketches.elementSketchId, sketchRelationOfElement: item => active(item) ? 'active' : 'inactive', constraintStatusOf: () => { if(state.statusFailure)throw state.statusFailure;return 'under'; } });
  const commandTargets = fromEditing ? null : sceneWindow.GeometryPresentation.createCommandTargets({ readPanelSelection: () => null, readMode: () => 'select',
    readOperands: () => [], readConstraintCommand: () => null, readPending: () => null, sameArcEndpoint: () => false });
  f.state.ready = false;
  const sceneOptions = { Point: sceneWindow.GeometrySolver.Point, currentScope: () => { read('scope'); return state.scope; }, sketches,
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
  };
  configure?.({ f, state, sceneOptions, read });
  let scene, editing;
  if (fromEditing) {
    Object.assign(state, { mode:'select', operands:[], command:null, pending:null, panel:null, status:'under', sourceRefs:[], projected:[], reference:null });
    Object.assign(sketches, { isActiveSketchElement:active, isReferenceSourceSketchId:id=>id==='S0', sketchRelationOfElement:item=>active(item)?'active':'inactive' });
    const { Point, commandTargets, sketchStyle, canvasSelection, canvasHover, pointUsage, resolvedLoopBounds, hatchAppearanceForDisplay, ...common } = sceneOptions;
    const solveState=sceneWindow.SketchSolving.createState();
    const interaction={selection:canvasSelection,hover:canvasHover,pointUsage,lifecycle:{readMode:()=>{read('mode');return state.mode;}}};
    const targets={get operands(){read('operands');return state.operands;},get command(){read('command');return state.command;}},pending={get current(){read('pending');return state.pending;}};
    scene=f.workspace.createSceneForEditing({...common,interaction,targets,pending,solveState,
      analysis:{statusOf:()=>{read('status');if(state.statusFailure)throw state.statusFailure;return state.status;}},
      readPanelSelection:()=>{read('panel');return state.panel;},operandElement:operand=>operand.element,
      instanceSources:{includesRef:ref=>{read('sources');return state.sourceRefs.some(source=>sceneWindow.GeometryRef.equals(ref,source));}},
      projection:{includes:item=>{read('projection');return state.projected.includes(item);}},
      instances:{get reference(){read('reference');return state.reference;},get sources(){read('sources');return state.sourceRefs;}}});
    editing={solveState,interaction,targets,pending,viewState:common.viewState};
  } else scene=f.workspace.createScene(sceneOptions);
  assert.deepEqual(reads, []); assert.deepEqual(f.calls, []); f.state.ready = true;
  f.workspace.surface.syncCanvasBitmapSize(200,100); f.calls.length = 0;
  return { ...f, scene, sceneState: state, reads, strokes, stack, selection, editing, viewState:sceneOptions.viewState };
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

test('editing scene shares live result status and operands with actual rendering, bounds, fit and export',()=>{
 const f=sceneFixture(true),{Point,Line}=sceneWindow.GeometrySolver,p=new Point('P1',0,0),q=new Point('P2',20,10),line=Object.assign(new Line('L1',p,q),{sketchId:'S1'});
 f.sceneState.scope.lines.push(line);f.editing.viewState.constraintStatus=true;f.scene.geometry.drawLines();assert.equal(f.strokes.at(-1).color,'#f59e0b');
 f.editing.solveState.setSketchSolveError('S1',{errorNorm:1});f.scene.geometry.drawLines();assert.equal(f.strokes.at(-1).color,'#dc2626');
 f.editing.solveState.clearAll();f.sceneState.status='full';f.scene.geometry.drawLines();assert.equal(f.strokes.at(-1).color,'#111827');
 f.sceneState.operands=[{element:line}];f.scene.geometry.drawLines();assert.equal(f.strokes.at(-1).color,'#1d4ed8');
 assert.deepEqual({...f.scene.bounds.visibleGeometryBounds()},{x1:0,y1:0,x2:20,y2:10});assert.equal(f.scene.fit.fitAllGeometryToViewport(0),true);assert.equal(f.display.viewport.scale,10);
 f.state.onContent=()=>f.scene.geometry.drawLines();f.workspace.exportRenderer.render({x:0,y:0,width:20,height:10},{x:2,y:2});assert.equal(f.strokes.at(-1).color,'#334455');f.workspace.exportRenderer.restore();f.scene.geometry.drawLines();assert.equal(f.strokes.at(-1).color,'#1d4ed8');
 assert.equal(f.sceneState.scope.lines[0],line);assert.equal(line.p1,p);assert.equal(line.p2,q);assert.equal(p.x,0);assert.equal(q.y,10);assert.equal(f.stack.length,0);
});

test('editing scene keeps panel precedence and reads current mode, sources, projection and reference command owners',()=>{
 const f=sceneFixture(true),{Point,Line}=sceneWindow.GeometrySolver,line=Object.assign(new Line('L1',new Point('P1',0,0),new Point('P2',1,1)),{sketchId:'S1'}),other=Object.assign(new Line('L2',line.p1,line.p2),{sketchId:'S0'}),query=f.scene.commandTargets;
 f.sceneState.operands=[{element:line}];f.sceneState.panel=other;assert.equal(query.isConstraintOperandSelected(line),false);f.sceneState.panel=null;assert.equal(query.isConstraintOperandSelected(line),true);
 f.sceneState.operands=[];f.sceneState.mode='instance-sources';f.sceneState.sourceRefs=[sceneWindow.GeometryObjects.geometryRefForItem(line)];assert.equal(query.isConstraintOperandSelected(line),true);
 f.sceneState.mode='sketch-projection';f.sceneState.projected=[line];assert.equal(query.isConstraintOperandSelected(line),true);assert.equal(query.isConstraintOperandSelected(other),false);
 f.sceneState.mode='pattern-placement-linear';f.sceneState.sourceRefs=[];f.sceneState.reference=line;assert.equal(query.isConstraintOperandSelected(line),true);f.sceneState.reference=null;assert.equal(query.isConstraintOperandSelected(line),false);
 f.sceneState.command={};assert.equal(query.isReferenceHoverElement(other),true);f.sceneState.command=null;assert.equal(query.isReferenceHoverElement(other),false);
});

test('editing scene preserves legacy partial Canvas state and leaves model, viewport and result records unchanged on query failure',()=>{
 for(const fromEditing of [false,true]){
  const f=sceneFixture(fromEditing),{Point,Line}=sceneWindow.GeometrySolver,line=Object.assign(new Line('L1',new Point('P1',0,0),new Point('P2',1,1)),{sketchId:'S1'}),marker=new Error('status query');f.sceneState.scope.lines.push(line);
  f.viewState.constraintStatus=true;
  const solveState=f.editing?.solveState||sceneWindow.SketchSolving.createState();solveState.setSketchSolveOk('S1',{errorNorm:0});const record=solveState.sketchSolveState('S1'),before={...f.display.viewport.snapshot()},lines=f.sceneState.scope.lines;
  f.sceneState.statusFailure=marker;
  assert.throws(()=>f.scene.geometry.drawLines(),error=>error===marker);assert.equal(f.stack.length,1);assert.equal(f.strokes.length,0);f.ctx.restore();
  f.sceneState.statusFailure=null;f.sceneState.failure=marker;assert.throws(()=>f.scene.fit.fitAllGeometryToViewport(),error=>error===marker);
  assert.equal(solveState.sketchSolveState('S1'),record);assert.equal(f.sceneState.scope.lines,lines);assert.equal(lines[0],line);assert.deepEqual({...f.display.viewport.snapshot()},before);
 }
});

function dimensionWorkspaceFixture(composed, probe = {}) {
  const w = sceneWindow, events = {}, frames = [], operations = [], reads = [], classes = new Set();
  const value = { hidden: true, value: '', style: { setProperty() {} }, classList: { contains: name => classes.has(name), remove: name => classes.delete(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) },
    addEventListener: (name, fn) => { events[name] = fn; }, focus: () => operations.push('focus'), select: () => operations.push('select') };
  const shell = { hidden: true, style: { setProperty() {} } }; probe.order = []; probe.ports = {}; probe.results = {};
  const f = fixture(() => true, w, (display, options, { state, calls, ctx, document }) => {
    probe.state = state; state.dimensionPending = null; state.dimensionLines = []; state.activeSketch = 'S1'; state.height = 3;
    const ready = () => assert.equal(state.ready, true, 'workspace construction must defer model and viewport queries');
    ctx.font = '12px test'; ctx.measureText = text => { ready(); return { width: String(text).length * 6 }; };
    const getElement = document.getElementById;
    document.getElementById = id => { if (!id.startsWith('dimensionValueInput')) return getElement(id); reads.push(id);
      if (probe.lookupError) throw probe.lookupError; return id === 'dimensionValueInput' ? probe.missing ? null : value : shell; };
    const appearance = { effectiveDimensionAppearance(dimension, sketchId) { ready(); operations.push(['appearance', sketchId]); return { ...w.Appearance.DEFAULT_DIMENSION_APPEARANCE, dimensionTextHeight: state.height }; },
      dimensionDisplayState() { ready(); return w.Appearance.DEFAULT_DIMENSION_APPEARANCE; } };
    const sketches = { constraintSketchId: constraint => constraint.sketchId, activeSketchId: () => { ready(); return state.activeSketch; } };
    const dimensionScene = { currentLines: () => { ready(); return state.dimensionLines; }, minLineLength: 1e-6, canvasThemeColor: color => color,
      onExpressionMark: mark => operations.push(['mark', mark]), appearance, sketches };
    const dimensionInput = { syncHighlight: input => { ready(); assert.equal(input, value); operations.push('highlight'); }, scheduleFrame: fn => frames.push(fn),
      pending: { read() { ready(); state.pendingReads = (state.pendingReads || 0) + 1; return state.dimensionPending; } },
      evaluateDimensionExpressionDraft: (_constraint, text) => Number(text), expressionFromUserInput: text => text,
      cancelPendingCommand: () => operations.push('cancel'), startDistanceValueInput: () => operations.push('start'),
      submitOffsetValue: () => operations.push('offset'), submitDistanceValue: () => operations.push('distance') };
    const originals = new Map();
    for (const [namespace, method, name] of [['CanvasSurface', 'create', 'surface'], ['CanvasExport', 'createRenderer', 'export'],
      ['CanvasWorkspaceLayout', 'create', 'layout'], ['CanvasInputBinding', 'createDragPointer', 'pointer'], ['DimensionDisplay', 'createForScene', 'dimensions'], ['DimensionInput', 'createForDocument', 'input']]) {
      if (!originals.has(namespace)) { originals.set(namespace, w[namespace]); w[namespace] = { ...w[namespace] }; }
      const factory = originals.get(namespace)[method];
      w[namespace][method] = input => { probe.order.push(name); probe.ports[name] = input; if (probe.failAt === name) throw probe.error; return probe.results[name] = factory(input); };
    }
    try {
      if (composed) return display.createEditingWorkspace({ ...options, dimensionScene, dimensionInput });
      const workspace = display.createWorkspace(options), dimensions = w.DimensionDisplay.createForScene({ ctx, viewport: display.viewport, ...dimensionScene });
      const input = w.DimensionInput.createForDocument({ ...dimensionInput, document, viewport: display.viewport, display: dimensions.display,
        worldToCanvasScreen: display.viewport.worldToCanvasScreen, effectiveDimensionAppearance: appearance.effectiveDimensionAppearance,
        constraintSketchId: sketches.constraintSketchId, activeSketchId: sketches.activeSketchId, applicationText: options.applicationText,
        setHint: probe.ports.layout.setHint, draw: probe.ports.layout.draw });
      return { ...workspace, dimensions: { ...dimensions, input: input.feature, element: input.input } };
    } finally { for (const [namespace, original] of originals) w[namespace] = original; }
  });
  return { ...f, dimensions: f.workspace.dimensions, value, shell, events, frames, operations, reads, probe };
}

test('editing Workspace creates Surface, export, layout, dimensions and inline input in order on the same viewport without starting or binding', () => {
  for (const composed of [false, true]) {
    const f = dimensionWorkspaceFixture(composed), { ports, results } = f.probe;
    assert.deepEqual(f.probe.order, ['surface', 'export', 'layout', 'pointer', 'dimensions', 'input']); assert.deepEqual(f.calls, []); assert.deepEqual(f.operations, []);
    assert.deepEqual(f.events, {}); assert.deepEqual(f.frames, []); assert.equal(f.state.resize, undefined);
    assert.deepEqual(f.reads, ['dimensionValueInput', 'dimensionValueInputShell']); assert.equal(f.dimensions.element, f.value);
    assert.equal(f.workspace.surface, results.surface); assert.equal(f.workspace.exportRenderer, results.export); assert.equal(f.workspace.layout, results.layout);
    assert.equal(f.dimensions.display, results.dimensions.display); assert.equal(f.dimensions.labels, results.dimensions.labels); assert.equal(f.dimensions.input, results.input.feature);
    for (const name of ['surface', 'export', 'layout', 'dimensions', 'input']) assert.equal(ports[name].viewport, f.display.viewport, name);
    assert.equal(ports.dimensions.ctx, f.ctx); assert.equal(ports.input.display, f.dimensions.display); assert.equal(ports.input.document, f.document);
    assert.equal(ports.input.worldToCanvasScreen, f.display.viewport.worldToCanvasScreen); assert.equal(ports.input.effectiveDimensionAppearance, ports.dimensions.appearance.effectiveDimensionAppearance);
    const lines = []; f.state.dimensionLines = lines; assert.equal(ports.dimensions.currentLines(), lines);
    f.dimensions.input.bind(); assert.deepEqual(Object.keys(f.events), ['pointerdown', 'dblclick', 'input', 'keydown']);
    f.workspace.surface.start(); assert.deepEqual(f.calls, ['observer', 'observe']);
  }
});

test('editing Workspace inline input uses live viewport, appearance and pending values through delayed focus and both submission paths', () => {
  const results = [];
  for (const composed of [false, true]) {
    const f = dimensionWorkspaceFixture(composed), g = sceneWindow.GeometrySolver;
    const target = { kind: 'point-point', p1: new g.Point('A', 0, 0), p2: new g.Point('B', 100, 0), value: 100 };
    const dimension = f.dimensions.display.placement.dimensionFromAnchor(target, { x: 50, y: 20 });
    const old = f.state.dimensionPending = { type: 'distance-value', target, dimension, buffer: 'old' };
    f.dimensions.input.controller.focus(); assert.equal(f.frames.length, 1); assert.deepEqual(f.operations, []);
    f.display.viewport.update({ scale: 4, x: 25, y: 30 }); f.state.height = 5;
    const current = f.state.dimensionPending = { type: 'distance-value', target, dimension, buffer: '12', constraint: { sketchId: 'S9' } };
    f.frames.shift()(); assert.equal(f.value.hidden, false); assert.equal(f.shell.hidden, false); assert.equal(f.value.value, '12');
    assert.ok(f.operations.some(event => event[0] === 'appearance' && event[1] === 'S9')); assert.deepEqual(f.operations.slice(-2), ['focus', 'select']);
    const left = f.shell.style.left; f.display.viewport.update({ x: 55 }); f.dimensions.input.controller.sync(); assert.notEqual(f.shell.style.left, left);
    f.dimensions.input.bind(); f.value.value = '22'; f.events.input(); assert.equal(current.buffer, '22'); assert.equal(current.editing, true); assert.equal(old.buffer, 'old');
    const key = () => ({ key: 'Enter', stopPropagation() {}, preventDefault() {} }); f.events.keydown(key()); assert.equal(f.operations.at(-1), 'distance');
    current.type = 'offset-value'; f.events.keydown(key()); assert.equal(f.operations.at(-1), 'offset');
    f.events.keydown({ ...key(), key: 'Escape' }); assert.equal(f.operations.at(-1), 'cancel');
    f.state.dimensionPending = null; f.dimensions.input.controller.sync(); assert.equal(f.shell.hidden, true);
    results.push(JSON.stringify({ styles: f.shell.style, operations: f.operations, buffer: current.buffer }));
  }
  assert.equal(results[1], results[0]);
});

test('editing Workspace preserves missing input and stops at display or DOM lookup failure before observation or binding', () => {
  for (const composed of [false, true]) {
    const missing = dimensionWorkspaceFixture(composed, { missing: true }); missing.dimensions.input.bind(); missing.dimensions.input.controller.sync();
    assert.equal(missing.dimensions.element, null); assert.deepEqual(missing.events, {}); assert.equal(missing.state.pendingReads, undefined);
    for (const failAt of ['dimensions', 'lookup']) {
      const marker = new Error(failAt), probe = failAt === 'lookup' ? { lookupError: marker } : { failAt, error: marker };
      assert.throws(() => dimensionWorkspaceFixture(composed, probe), error => error === marker);
      assert.deepEqual(probe.order, ['surface', 'export', 'layout', 'pointer', 'dimensions', ...(failAt === 'lookup' ? ['input'] : [])]);
      assert.equal(probe.state.resize, undefined); assert.equal(probe.state.pendingReads, undefined);
    }
  }
});

function placementWorkspaceFixture(composed, probe = {}) {
 const f=fixture(()=>true,sceneWindow),{state,calls,ctx}=f,draws=[],stack=[];
 state.ready=false;state.mode='select';state.pointer={x:5,y:8};state.definitionId='BD1';
 const effect=(name,...args)=>{assert.equal(state.ready,true,'no eager placement operation');draws.push([name,...args]);if(state.failAt===name)throw state.error;};
 for(const name of ['setLineDash','beginPath','moveTo','lineTo','stroke','arc'])ctx[name]=(...args)=>effect(name,...args);
 ctx.save=()=>{effect('save');stack.push(true);};ctx.restore=()=>{effect('restore');assert.equal(stack.pop(),true);};
 const hatch=Object.freeze({id:'H1',appearance:Object.freeze({color:'red'}),patternOrigin:Object.freeze({x:0,y:0})});
 const text=Object.freeze({type:'text',style:Object.freeze({color:'black'})}),leader=Object.freeze({type:'leader',style:Object.freeze({color:'green'})}),spline={id:'SP1'};
 state.bundle={lines:[{p1:{x:0,y:0},p2:{x:10,y:0}}],circles:[],arcs:[],splines:[spline],points:[{x:1,y:2}],hatches:[hatch],annotations:[text,leader]};
 state.instance={id:'B1'};state.definition={id:'BD1'};state.blockPlan={instance:state.instance,definition:state.definition};state.freePlan=state.bundle;state.boundary={id:'boundary'};
 const geometry={traceSplinePath(value){'use strict';assert.equal(this,undefined);effect('spline',value);}};
 const annotations={drawAnnotationText(value){'use strict';assert.equal(this,undefined);effect('text',value);},
  drawAnnotationLeader(value,preview){'use strict';assert.equal(this,undefined);effect('leader',value,preview);}};
 const hatchLayer={drawResolvedHatch(...args){assert.equal(this,hatchLayer);effect('hatch',...args);}};
 const readServices={hatches:{resolvedHatchBoundary(value){'use strict';assert.equal(this,undefined);effect('boundary',value);return state.boundary;}}};
 const interaction={lifecycle:{readMode:()=>{effect('mode');return state.mode;}}},sessions={preview:{get pointer(){effect('pointer',state.pointer);return state.pointer;}}};
 const blockPlacementCommand={get definitionId(){effect('definition');return state.definitionId;},
  preview(pointer){assert.equal(this,blockPlacementCommand);effect('block-preview',pointer);return state.blockPlan;}};
 const geometryInstanceCommand={preview(pointer){assert.equal(this,geometryInstanceCommand);effect('instance-preview',pointer);return state.freePlan;}};
 function createBlockProjectionBundle(instance,definition){'use strict';assert.equal(this,undefined);effect('bundle',instance,definition);return state.bundle;}
 const input={geometry,annotations,hatchLayer,readServices,interaction,sessions,blockPlacementCommand,geometryInstanceCommand,createBlockProjectionBundle};
 const original=sceneWindow.PlacementPreviewRenderer;probe.order=[];probe.ports={};
 sceneWindow.PlacementPreviewRenderer={create(ports){probe.order.push('renderer');probe.ports.renderer=ports;if(probe.failAt==='renderer')throw probe.error;return probe.renderer=original.create(ports);},
  createLayer(ports){probe.order.push('layer');probe.ports.layer=ports;if(probe.failAt==='layer')throw probe.error;return probe.layer=original.createLayer(ports);}};
 let layer;
 try{
  if(composed)layer=f.workspace.createPlacementPreview(input);
  else{
   const renderer=sceneWindow.PlacementPreviewRenderer.create({ctx,viewport:f.display.viewport,withCanvasState:f.workspace.surface.withCanvasState,
    traceSplinePath:geometry.traceSplinePath,drawResolvedHatch:(...args)=>hatchLayer.drawResolvedHatch(...args),
    resolvedHatchBoundary:readServices.hatches.resolvedHatchBoundary,hatchAppearanceForDisplay:sceneWindow.HatchData.hatchAppearanceForDisplay,hatchPatternOrigin:sceneWindow.HatchData.hatchPatternOrigin,
    drawAnnotationLeader:annotations.drawAnnotationLeader,drawAnnotationText:annotations.drawAnnotationText});
   layer=sceneWindow.PlacementPreviewRenderer.createLayer({renderer,readMode:interaction.lifecycle.readMode,readPointer:()=>sessions.preview.pointer,
    blockPlacementCommand,geometryInstanceCommand,createBlockProjectionBundle});
  }
 }finally{sceneWindow.PlacementPreviewRenderer=original;}
 assert.deepEqual(calls,[]);assert.deepEqual(draws,[]);state.ready=true;
 return {...f,layer,probe,draws,stack,input,hatch,text,leader,spline};
}

test('Workspace placement assembly shares the surface and existing painter owners, constructs cold renderer then layer and retains live Block guards',()=>{
 for(const composed of [false,true]){
  const f=placementWorkspaceFixture(composed),{probe:{ports:p},input:i,layer,state,draws}=f;
  assert.deepEqual(f.probe.order,['renderer','layer']);assert.equal(layer,f.probe.layer);assert.equal(Object.isFrozen(layer),true);
  assert.equal(p.renderer.ctx,f.ctx);assert.equal(p.renderer.viewport,f.display.viewport);assert.equal(p.renderer.withCanvasState,f.workspace.surface.withCanvasState);
  assert.equal(p.renderer.traceSplinePath,i.geometry.traceSplinePath);assert.equal(p.renderer.drawAnnotationText,i.annotations.drawAnnotationText);
  assert.equal(p.renderer.resolvedHatchBoundary,i.readServices.hatches.resolvedHatchBoundary);assert.equal(p.layer.renderer,f.probe.renderer);
  layer.drawBlockPlacementPreview();assert.deepEqual(draws.map(e=>e[0]),['mode']);
  state.mode='block-place';state.definitionId=null;draws.length=0;layer.drawBlockPlacementPreview();assert.deepEqual(draws.map(e=>e[0]),['mode','definition']);
  state.definitionId='BD1';state.pointer=null;draws.length=0;layer.drawBlockPlacementPreview();assert.deepEqual(draws.map(e=>e[0]),['mode','definition','pointer']);
  state.pointer={x:12,y:16};draws.length=0;layer.drawBlockPlacementPreview();
  assert.deepEqual(draws.filter(e=>['block-preview','bundle','hatch','spline','text','leader'].includes(e[0])).map(e=>e[0]),['block-preview','bundle','hatch','spline','text','leader']);
  assert.equal(draws.find(e=>e[0]==='block-preview')[1],state.pointer);const bundle=draws.find(e=>e[0]==='bundle');assert.equal(bundle[1],state.instance);assert.equal(bundle[2],state.definition);
  assert.equal(draws.find(e=>e[0]==='hatch')[1],state.boundary);assert.equal(draws.find(e=>e[0]==='hatch')[2].color,'#2563eb');
  assert.notEqual(draws.find(e=>e[0]==='text')[1],f.text);assert.equal(f.text.style.color,'black');assert.equal(f.leader.style.color,'green');assert.equal(f.hatch.appearance.color,'red');
  assert.deepEqual(f.stack,[]);assert.equal(f.ctx.globalAlpha,1);
 }
});

test('Workspace Instance preview uses current pointer and viewport with independent mode and preserves null plans without painting',()=>{
 for(const composed of [false,true]){
  const f=placementWorkspaceFixture(composed),{state,layer,draws}=f;state.mode='block-place';state.pointer={x:30,y:40};
  f.display.viewport.update({scale:4});layer.drawFreeInstancePreview();
  assert.equal(draws.some(e=>e[0]==='mode'),false);assert.equal(draws.find(e=>e[0]==='instance-preview')[1],state.pointer);
  assert.equal(draws.find(e=>e[0]==='arc')[3],3/4);assert.deepEqual(f.stack,[]);
  state.pointer=null;state.freePlan=null;draws.length=0;layer.drawFreeInstancePreview();
  assert.deepEqual(draws,[['pointer',null],['instance-preview',null]]);
 }
});

test('Workspace placement keeps constructor and painter failures at their original stages and restores Canvas state before propagating',()=>{
 for(const composed of [false,true]){
  for(const failAt of ['renderer','layer']){const probe={failAt,error:new Error(failAt)};assert.throws(()=>placementWorkspaceFixture(composed,probe),value=>value===probe.error);
   assert.deepEqual(probe.order,failAt==='renderer'?['renderer']:['renderer','layer']);}
  for(const failAt of ['block-preview','bundle','boundary','hatch','spline','text','leader']){
   const f=placementWorkspaceFixture(composed),error=new Error(failAt);f.state.mode='block-place';f.state.error=error;f.state.failAt=failAt;
   assert.throws(()=>f.layer.drawBlockPlacementPreview(),value=>value===error);
   assert.deepEqual(f.stack,[]);const painted=!['block-preview','bundle'].includes(failAt);
   assert.equal(f.draws.filter(e=>e[0]==='restore').length,painted?1:0);
   if(painted)assert.equal(f.ctx.globalAlpha,1);
   const index=f.draws.findIndex(e=>e[0]===failAt);assert.ok(index>=0);assert.ok(f.draws.slice(index+1).every(e=>['restore','setLineDash'].includes(e[0])));
  }
 }
});

function sceneFrameFixture(composed, probe = {}) {
 const f=sceneFixture(true),{state,ctx}=f,operations=[];state.ready=false;
 ctx.measureText=text=>({width:String(text).length*7});
 const stage=(name,...args)=>{assert.equal(state.ready,true,'no eager frame operation');operations.push([name,...args]);if(state.failAt===name)throw state.error;};
 for(const name of ['clearRect','translate','scale','fillRect','strokeRect'])ctx[name]=(...args)=>{assert.equal(state.ready,true);f.calls.push([name,...args]);};
 function owner(methods){const api={};for(const[method,name]of Object.entries(methods))api[method]=function(){assert.equal(this,api);stage(name);};return api;}
 const scheduler={recordDraw(){assert.equal(this,scheduler);stage('record');return 7;}};
 const rectangle={preview(){assert.equal(this,rectangle);stage('rectangle');return state.rectangle??null;}};
 const snap={get active(){stage('snap');return state.snap??null;}},pointer={get lastWorld(){stage('pointer',state.pointer);return state.pointer;}};
 const imageLayer={drawImages(){'use strict';assert.equal(this,undefined);stage('images');},
  drawOverlays(){'use strict';assert.equal(this,undefined);stage('image-overlays');}};
 function readPngCommand(){'use strict';assert.equal(this,undefined);stage('png-read');return state.png??null;}
 const input={recordDraw:()=>scheduler.recordDraw(),rectangle,snap,pointer,referenceImageLayer:imageLayer,readPngCommand,
  dimensions:owner({draw:'dimensions'}),drawDimensionPreview:()=>stage('dimension-preview'),annotations:owner({draw:'annotations',drawPreview:'annotation-preview'}),
  authoringPreview:owner({draw:'authoring',drawTrimPreview:'trim'}),placements:owner({drawBlockPlacementPreview:'block-placement',drawFreeInstancePreview:'free-instance'}),
  offsetPreview:owner({draw:'offset'}),drawBlockInstanceHandles:()=>stage('block-handles'),
  drawHatches(items,options){'use strict';assert.equal(this,undefined);assert.equal(arguments.length,2);assert.equal(items.length,0);assert.equal(options.includePreview,true);stage('hatches');},
  drawDrawingStack:()=>stage('stack')};
 const originalOverlay=sceneWindow.InteractionOverlayRenderer,originalSurface=sceneWindow.CanvasSurface;
 probe.order=[];probe.ports={};probe.results={};
 function observe(name,original,ports){probe.order.push(name);probe.ports[name]=ports;if(probe.failAt===name)throw probe.error;return probe.results[name]=original(ports);}
 sceneWindow.InteractionOverlayRenderer={...originalOverlay,createLayer:ports=>observe('overlays',originalOverlay.createLayer,ports)};
 sceneWindow.CanvasSurface={...originalSurface,createInteractiveRenderer:ports=>observe('interactive',originalSurface.createInteractiveRenderer,ports),
  createFrameRenderer:ports=>observe('frame',originalSurface.createFrameRenderer,ports)};
 let result;
 try{
  if(composed)result=f.scene.createFrame(input);
  else{
   const overlays=sceneWindow.InteractionOverlayRenderer.createLayer({renderer:f.scene.overlay,rectangle,snap,hover:f.editing.interaction.hover,selection:f.selection,pointer});
   const frame=f.workspace.createRendering({recordDraw:()=>scheduler.recordDraw(),geometry:f.scene.geometry,dimensions:input.dimensions,
    drawDimensionPreview:input.drawDimensionPreview,annotations:input.annotations,authoringPreview:input.authoringPreview,placements:input.placements,offsetPreview:input.offsetPreview,
    drawBlockInstanceHandles:input.drawBlockInstanceHandles,drawSnapMarker:overlays.drawSnapMarker,drawReferenceImages:imageLayer.drawImages,drawHatches:input.drawHatches,
    drawDrawingStack:input.drawDrawingStack,drawReferenceImageOverlays:imageLayer.drawOverlays,drawSketchIdentityLabel:overlays.drawSketchIdentityLabel,drawSelectionRect:overlays.drawSelectionRect,
    drawExportOverlay:()=>readPngCommand()?.drawOverlay(ctx,f.display.viewport.scale)});
   result={frame,overlays};
  }
 }finally{sceneWindow.InteractionOverlayRenderer=originalOverlay;sceneWindow.CanvasSurface=originalSurface;}
 assert.deepEqual(operations,[]);assert.deepEqual(f.calls,[]);state.ready=true;
 f.state.onContent=result.frame.draw;f.state.onDraw=result.frame.draw;
 return {...f,...result,operations,input,probe};
}

const sceneFrameOrder=['record','images','hatches','stack','block-handles','dimensions','dimension-preview','annotations','annotation-preview','authoring','block-placement','free-instance','offset','trim','snap','image-overlays','pointer','rectangle','png-read'];

test('scene frame assembles overlays then interactive and frame renderers cold on the actual scene owners and preserves normal paint order',()=>{
 for(const composed of [false,true]){
  const f=sceneFrameFixture(composed),{probe:{ports:p,results:r},input:i}=f;
  assert.deepEqual(f.probe.order,['overlays','interactive','frame']);assert.equal(f.frame,r.frame);assert.equal(f.overlays,r.overlays);
  assert.equal(p.overlays.renderer,f.scene.overlay);assert.equal(p.overlays.selection,f.selection);assert.equal(p.overlays.hover,f.editing.interaction.hover);assert.equal(p.overlays.pointer,i.pointer);
  assert.equal(p.frame.ctx,f.ctx);assert.equal(p.frame.viewport,f.display.viewport);assert.equal(p.frame.surface,f.workspace.surface);
  assert.equal(p.interactive.drawSnapMarker,f.overlays.drawSnapMarker);assert.equal(p.interactive.drawSelectionRect,f.overlays.drawSelectionRect);
  assert.equal(p.interactive.drawReferenceImageOverlays,i.referenceImageLayer.drawOverlays);
  f.frame.draw();assert.deepEqual(f.operations.map(e=>e[0]),sceneFrameOrder);assert.equal(f.stack.length,0);assert.equal(f.button.textContent,'100%');
 }
});

test('scene frame reads current rectangle, snap, pointer and PNG command, preserves captured Image callbacks and skips interactive work during export',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=sceneFrameFixture(composed);f.state.pointer={x:7,y:9};f.state.rectangle={rect:{x1:1,y1:2,x2:5,y2:8},crossing:false};f.state.snap={x:10,y:20,label:'snap'};
  const png={drawOverlay(ctx,scale){assert.equal(this,png);assert.equal(ctx,f.ctx);f.operations.push(['png',scale]);}};f.state.png=png;
  f.input.referenceImageLayer.drawImages=()=>{throw new Error('must retain captured image callback');};
  f.display.viewport.update({scale:4,x:10,y:20});f.frame.draw();
  assert.equal(f.operations.find(e=>e[0]==='pointer')[1],f.state.pointer);assert.equal(f.operations.at(-1)[0],'png');assert.equal(f.operations.at(-1)[1],4);
  assert.ok(f.calls.some(e=>e[0]==='strokeRect'&&e[1]===1&&e[2]===2&&e[3]===4&&e[4]===6));
  assert.equal(f.stack.length,0);const normal=f.operations.map(e=>e[0]);
  f.operations.length=0;f.calls.length=0;const before={...f.display.viewport.snapshot()};
  f.workspace.exportRenderer.render({x:2,y:3,width:20,height:30},{x:8,y:12});
  assert.deepEqual(f.operations.map(e=>e[0]),['images','hatches','stack','dimensions','annotations']);assert.equal(f.stack.length,0);
  assert.deepEqual({...f.display.viewport.snapshot()},before);
  f.operations.length=0;f.state.png=null;f.state.rectangle=null;f.state.snap=null;f.workspace.exportRenderer.restore();
  assert.equal(f.workspace.exportRenderer.frame,null);assert.deepEqual(f.operations.map(e=>e[0]),sceneFrameOrder);assert.equal(f.stack.length,0);
  results.push(JSON.stringify({normal,restored:f.operations.map(e=>e[0]),view:before}));
 }
 assert.equal(results[1],results[0]);
});

test('scene frame keeps constructor and drawing exception identity and the original partial Canvas/export state without extra recovery',()=>{
 for(const composed of [false,true]){
  for(const failAt of ['overlays','interactive','frame']){const probe={failAt,error:new Error(failAt)};
   assert.throws(()=>sceneFrameFixture(composed,probe),value=>value===probe.error);
   const order=['overlays','interactive','frame'];assert.deepEqual(probe.order,order.slice(0,order.indexOf(failAt)+1));}
  for(const failAt of ['record','images','dimensions','image-overlays','rectangle']){
   const f=sceneFrameFixture(composed),error=new Error(failAt),scope=f.sceneState.scope;f.state.failAt=failAt;f.state.error=error;
   assert.throws(()=>f.frame.draw(),value=>value===error);assert.equal(f.operations.at(-1)[0],failAt);assert.equal(f.sceneState.scope,scope);
   assert.equal(f.stack.length,failAt==='record'?0:1);
  }
  const f=sceneFrameFixture(composed),error=new Error('export annotations');f.state.failAt='annotations';f.state.error=error;
  assert.throws(()=>f.workspace.exportRenderer.render({x:0,y:0,width:10,height:10},{x:2,y:2}),value=>value===error);
  assert.ok(f.workspace.exportRenderer.frame);assert.equal(f.stack.length,1);assert.deepEqual(f.operations.map(e=>e[0]),['images','hatches','stack','dimensions','annotations']);
 }
});

function hatchStackSceneFixture(composed, probe = {}) {
 let options;
 const f=sceneFixture(true,({state,sceneOptions,read})=>{
  options=sceneOptions;state.scope=sceneWindow.DocumentState.create();state.scope.sketches=[{id:'S1',name:'One'},{id:'S2',name:'Two'}];state.hidden=new Set();
  sceneOptions.canvasSelection=sceneWindow.CanvasSelection.create();sceneOptions.canvasHover=sceneWindow.CanvasHover.create({isEndpointPoint:()=>false});
  sceneOptions.readServices.reads.allHatches=()=>{read('hatches');return state.scope.hatches;};
  sceneOptions.readServices.geometryAppearance.isVisibleSketchId=id=>{read('sketch-visible');return !state.hidden.has(id);};
  sceneOptions.readServices.geometryAppearance.isVisibleSketchElement=item=>{read('element-visible');return item.visible!==false&&!state.hidden.has(item.sketchId);};
  sceneOptions.readServices.hatches.resolvedHatchBoundary=hatch=>{read('boundary');if(state.boundaryFailure)throw state.boundaryFailure;return hatch.resolved;};
  sceneOptions.readServices.hatches.hatchBoundaryGeometryItems=()=>{read('boundary-items');return state.boundaryItems??[];};
 });
 const {sceneState:state}=f,selection=f.editing.interaction.selection,hover=f.editing.interaction.hover,paints=[],fills=[];
 f.state.ready=false;f.calls.length=0;f.reads.length=0;
 f.ctx.clip=(...args)=>{assert.equal(f.state.ready,true);f.calls.push(['clip',...args]);};
 const fill=f.ctx.fill;f.ctx.fill=(...args)=>{fills.push({color:f.ctx.fillStyle,alpha:f.ctx.globalAlpha});if(state.fillFailure)throw state.fillFailure;return fill(...args);};
 state.command={regions:[],preview:null};state.commandReads=0;
 function readCommand(){assert.equal(f.state.ready,true);state.commandReads++;return state.command;}
 const originalHatch=sceneWindow.HatchRenderer,originalStack=sceneWindow.DrawingStack;
 probe.order=[];probe.ports={};
 sceneWindow.HatchRenderer={...originalHatch,create(ports){probe.order.push('content');probe.ports.content=ports;if(probe.failAt==='content')throw probe.error;return originalHatch.create(ports);},
  createLayer(ports){probe.order.push('layer');probe.ports.layer=ports;if(probe.failAt==='layer')throw probe.error;return probe.layer=originalHatch.createLayer(ports);}};
 sceneWindow.DrawingStack={create(ports){probe.order.push('stack');probe.ports.stack=ports;if(probe.failAt==='stack')throw probe.error;
  const painters=Object.fromEntries(Object.entries(ports.painters).map(([name,paint])=>[name,(...args)=>{paints.push([name,...args]);return paint.apply(ports.painters,args);}]));
  return probe.stack=originalStack.create({...ports,painters});}};
 let rendering,stack;
 try{
  if(composed)rendering=f.scene.createHatchRendering({readCommand});
  else{
   const {Line,Circle,Arc,Spline}=sceneWindow.GeometrySolver,{hatchAppearanceForDisplay,hatchPatternOrigin}=sceneWindow.HatchData;
   const {drawLines,drawCircles,drawArcs,drawSplines}=f.scene.geometry,{isVisibleSketchId,isVisibleSketchElement,isVisibleValue}=options.readServices.geometryAppearance;
   const {visibleWorldBounds}=f.display.viewport;
   const {drawResolvedHatchContent}=sceneWindow.HatchRenderer.create({viewport:f.display.viewport,visibleWorldBounds:()=>f.workspace.exportRenderer.frame?.worldBounds||visibleWorldBounds(),canvasThemeColor:options.canvasThemeColor,isVisibleValue});
   const layer=sceneWindow.HatchRenderer.createLayer({ctx:f.ctx,drawResolvedHatchContent,hatchBoundaryGeometryItems:options.readServices.hatches.hatchBoundaryGeometryItems,
    boundaryPainters:[{type:Line,draw:drawLines},{type:Circle,draw:drawCircles},{type:Arc,draw:drawArcs},{type:Spline,draw:drawSplines}],
    allHatches:options.readServices.reads.allHatches,isVisibleSketchId,hatchAppearanceForDisplay,isConstraintOperandSelected:f.scene.commandTargets.isConstraintOperandSelected,canvasSelection:selection,
    activeSketchId:options.sketches.activeSketchId,readHover:()=>hover.current,resolvedHatchBoundary:options.readServices.hatches.resolvedHatchBoundary,hatchPatternOrigin,
    isExporting:()=>Boolean(f.workspace.exportRenderer.frame),sketchAlpha:f.scene.sketchStyle.sketchAlpha,readMode:f.editing.interaction.lifecycle.readMode,readCommand});
   function drawHatches(...args){return layer.drawHatches(...args);}
   rendering={layer,drawHatches,createStack:()=>sceneWindow.DrawingStack.create({currentScope:options.currentScope,activeSketchId:options.sketches.activeSketchId,geometryReads:options.readServices.reads,
    isVisibleSketchId,isVisibleSketchElement,hatchAppearanceForDisplay,isVisibleValue,painters:{hatch:items=>drawHatches(items,{includePreview:false}),line:drawLines,circle:drawCircles,arc:drawArcs,spline:drawSplines}})};
  }
  assert.deepEqual(probe.order,['content','layer']);assert.deepEqual(f.reads,[]);probe.order.push('between');stack=rendering.createStack();
 }finally{sceneWindow.HatchRenderer=originalHatch;sceneWindow.DrawingStack=originalStack;}
 assert.deepEqual(f.reads,[]);assert.deepEqual(f.calls,[]);assert.equal(state.commandReads,0);f.state.ready=true;
 const hatch=(id,sketchId='S1',drawingOrder=1)=>({id,sketchId,drawingOrder,appearance:{patternType:'solid',color:'#556677',opacity:0.5},
  resolved:{ok:true,loops:[{points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}]}]}});
 const line=(id,sketchId='S1',drawingOrder=2)=>Object.assign(new sceneWindow.GeometrySolver.Line(id,new sceneWindow.GeometrySolver.Point(id+'A',0,0),new sceneWindow.GeometrySolver.Point(id+'B',20,0)),{sketchId,drawingOrder});
 return {...f,selection,hover,rendering,drawingStack:stack,probe,options,paints,fills,hatch,line};
}

test('scene Hatch and stack assembly shares real content, painter and query owners at separate cold construction stages',()=>{
 for(const composed of [false,true]){
  const f=hatchStackSceneFixture(composed),{ports:p}=f.probe;
  assert.deepEqual(f.probe.order,['content','layer','between','stack']);assert.equal(f.rendering.layer,f.probe.layer);assert.equal(f.drawingStack,f.probe.stack);
  assert.equal(p.layer.ctx,f.ctx);assert.equal(p.content.viewport,f.display.viewport);assert.equal(p.layer.canvasSelection,f.selection);
  assert.equal(p.layer.isConstraintOperandSelected,f.scene.commandTargets.isConstraintOperandSelected);assert.equal(p.layer.sketchAlpha,f.scene.sketchStyle.sketchAlpha);
  assert.equal(p.layer.hatchBoundaryGeometryItems,f.options.readServices.hatches.hatchBoundaryGeometryItems);
  assert.equal(p.stack.geometryReads,f.options.readServices.reads);assert.equal(p.stack.isVisibleSketchElement,f.options.readServices.geometryAppearance.isVisibleSketchElement);
  assert.equal(p.layer.boundaryPainters[0].type,sceneWindow.GeometrySolver.Line);assert.equal(p.layer.boundaryPainters[0].draw,f.scene.geometry.drawLines);
  assert.equal(p.stack.painters.line,f.scene.geometry.drawLines);assert.equal(f.rendering.drawHatches.length,0);
  const h=f.hatch('H1'),l=f.line('L1');f.sceneState.scope.hatches.push(h);f.sceneState.scope.lines.push(l);
  f.drawingStack.drawDrawingStack();assert.deepEqual(f.paints.map(e=>e[0]),['hatch','line','circle','arc','spline']);
  assert.equal(f.paints[0][1],f.sceneState.scope.hatches);assert.equal(f.paints[1][1][0],l);assert.equal(f.sceneState.commandReads,0);assert.equal(f.stack.length,0);
 }
});

test('scene Hatch and stack composition preserves sorted batching, preview exclusion, live visibility/selection and export bounds',()=>{
 const results=[];
 for(const composed of [false,true]){
  const f=hatchStackSceneFixture(composed),h=f.hatch('H2','S2',7),l=f.line('L1','S1',1);f.sceneState.scope.hatches.push(h);f.sceneState.scope.lines.push(l);
  f.sceneState.mode='hatch';f.sceneState.command.regions=[{resolved:h.resolved,selected:true}];
  f.drawingStack.drawDrawingStack();assert.deepEqual(f.paints.map(e=>e[0]),['hatch','line']);assert.equal(f.sceneState.commandReads,0);
  const order=f.drawingStack.drawingStackEntries().map(e=>[e.kind,e.item.id]);f.sceneState.hidden.add('S2');f.fills.length=0;f.rendering.drawHatches([h],{includePreview:false});assert.equal(f.fills.length,0);
  f.sceneState.hidden.clear();h.sketchId='S1';f.selection.set('hatches',[h]);f.hover.update({hatch:h});f.fills.length=0;
  f.rendering.drawHatches([h],{includePreview:false});const normal=f.fills[0];assert.ok(normal.color.includes('2563eb'));
  f.rendering.drawHatches([],{includePreview:true});assert.ok(f.sceneState.commandReads>0);const reads=f.sceneState.commandReads;
  f.workspace.exportRenderer.render({x:0,y:0,width:10,height:10},{x:2,y:2});assert.equal(f.probe.ports.content.visibleWorldBounds(),f.workspace.exportRenderer.frame.worldBounds);
  f.fills.length=0;f.rendering.drawHatches([h]);const exported=f.fills[0];assert.ok(exported.color.includes('556677'));assert.equal(f.sceneState.commandReads,reads);
  f.workspace.exportRenderer.restore();assert.equal(f.stack.length,0);
  results.push(JSON.stringify({order,normal,exported,model:f.sceneState.scope}));
 }
 assert.equal(results[1],results[0]);
});

test('scene Hatch and stack keep constructor, query and paint failure identity and existing partial-state boundaries',()=>{
 for(const composed of [false,true]){
  for(const failAt of ['content','layer','stack']){const probe={failAt,error:new Error(failAt)};assert.throws(()=>hatchStackSceneFixture(composed,probe),value=>value===probe.error);
   const order=['content','layer','between','stack'];assert.deepEqual(probe.order,order.slice(0,order.indexOf(failAt)+1));}
  for(const failAt of ['scope','boundary','fill']){
   const f=hatchStackSceneFixture(composed),error=new Error(failAt),model=f.sceneState.scope,h=f.hatch('H1');model.hatches.push(h);
   if(failAt==='scope')f.sceneState.failure=error;else if(failAt==='boundary')f.sceneState.boundaryFailure=error;else f.sceneState.fillFailure=error;
   assert.throws(()=>failAt==='scope'?f.drawingStack.drawDrawingStack():f.rendering.drawHatches([h]),value=>value===error);
   assert.equal(f.sceneState.scope,model);assert.equal(model.hatches[0],h);assert.equal(f.stack.length,failAt==='fill'?1:0);
  }
 }
});
function preparedWorkspaceFixture(composed, probe) {
  'use strict';
  probe ||= {};
  let seed;
  const f = sceneFixture(true, value => { seed = value.sceneOptions; }), w = sceneWindow, state = f.sceneState;
  f.state.ready = false; f.calls.length = 0; f.reads.length = 0;
  const pending = w.PendingCommandSession.create({}), targets = w.ConstraintTargetSession.create({});
  const pointer = Object.fromEntries(['down','move','finish','leave','doubleClick'].map(name => [name, () => f.calls.push(name)]));
  const sessions = { pending, targets, pointer, preview: { pointer: null } }, interaction = { ...f.editing.interaction, lifecycle: { ...f.editing.interaction.lifecycle, active: () => false, setMode: value => { state.mode = value; } } };
  const settings = { applicationText: seed.applicationText, get theme() { return state.theme || 'light'; }, get language() { return state.language; } };
  const presentation = { settings, draw: () => f.calls.push('draw'), setHint: () => f.calls.push('hint'), updatePropertiesUI: () => f.calls.push('properties'),
    readCommandPanel: () => null, get selectedItem() { return state.panel; }, profiler: { phase(label, work) { assert.equal(this, undefined); f.calls.push(label); return work(); } } };
  const readServices = { ...seed.readServices, reads: { ...seed.readServices.reads, withGeometryReadCache: work => { f.calls.push('cache'); return work(); } },
    dimensionAppearance: { effectiveDimensionAppearance: () => w.Appearance.DEFAULT_DIMENSION_APPEARANCE, dimensionDisplayState: () => w.Appearance.DEFAULT_DIMENSION_APPEARANCE } };
  const documentWorkspace = { workspace: { current: seed.currentScope }, sketches: seed.sketches };
  f.browser.devicePixelRatio = 2; f.browser.ResizeObserver = class { observe() { f.calls.push('observe'); } disconnect() {} };
  const originals = new Map(); probe.order = []; probe.ports = {}; probe.results = {}; probe.calls = f.calls;
  const factories = [['CanvasViewControls','create','controls'],['CanvasViewport','create','viewport'],['CanvasNavigation','create','navigation'],['CanvasZoomControl','create','zoom'],
    ['CanvasSurface','create','surface'],['CanvasExport','createRenderer','export'],['CanvasWorkspaceLayout','create','layout'],['CanvasInputBinding','createDragPointer','dragPointer'],
    ['DimensionDisplay','createForScene','dimensions'],['DimensionInput','createForDocument','input'],['GeometryPresentation','createCommandTargets','targets'],['GeometryPresentation','createSketchStyle','style'],
    ['GeometryDisplay','create','geometry'],['InteractionOverlayRenderer','create','overlay'],['DrawingBounds','create','bounds'],['PlacementPreviewRenderer','create','placementRenderer'],
    ['PlacementPreviewRenderer','createLayer','placementLayer'],['CanvasInputBinding','createCommandRouting','routing'],['CanvasInputBinding','create','inputBinding'],['PngExport','create','png']];
  for (const [namespace, method, name] of factories) {
    if (!originals.has(namespace)) { originals.set(namespace, w[namespace]); w[namespace] = { ...w[namespace] }; }
    const original = originals.get(namespace)[method];
    w[namespace][method] = ports => { probe.order.push(name); probe.ports[name] = ports; if (probe.failAt === name) throw probe.marker; return probe.results[name] = original(ports); };
  }
  let prepared, controls, color, display, workspace, scene, placement, binding, png;
  try {
    if (composed) { prepared = w.CanvasDisplay.prepareForWorkspace({ canvas: f.canvas, document: f.document, window: f.browser, ctx: f.ctx, documentWorkspace, readServices, interaction, sessions, presentation }); controls = prepared.controls; color = prepared.canvasThemeColor; }
    else { controls = w.CanvasViewControls.create({ document: f.document, window: f.browser, setHint: presentation.setHint, draw: presentation.draw }); color = value => w.CanvasThemeColors.color(value, settings.theme); }
    assert.deepEqual(probe.order, ['controls']); assert.deepEqual(f.reads, []);
    const displayOptions = { initialScale: 2, minLength: 1e-6, fitVisibleGeometry: () => true, flushPointerMoves: () => f.calls.push('flush'), syncDimensionValueInput: () => f.calls.push('sync') };
    display = composed ? prepared.createForEditing(displayOptions) : w.CanvasDisplay.create({ ...displayOptions, canvas: f.canvas, document: f.document, minZoom: .002, maxZoom: 20000000, draw: presentation.draw, setHint: presentation.setHint });
    const dimensionInput = { syncHighlight() {}, scheduleFrame() {}, evaluateDimensionExpressionDraft: (_c,text) => Number(text), expressionFromUserInput: text => text,
      cancelPendingCommand() {}, startDistanceValueInput() {}, submitOffsetValue() {}, submitDistanceValue() {} };
    const workspaceOptions = { dimensionScene: { onExpressionMark() {} }, dimensionInput, drawCanvas: () => f.calls.push('content'), closeContextMenu: () => f.calls.push('close'), applySketchTreeWidth: () => f.calls.push('tree') };
    workspace = display.createEditingWorkspace(composed ? workspaceOptions : { ...workspaceOptions,
      dimensionScene: { ...workspaceOptions.dimensionScene, currentLines: () => documentWorkspace.workspace.current().lines, minLineLength: 1e-6, canvasThemeColor: color, appearance: readServices.dimensionAppearance, sketches: seed.sketches },
      dimensionInput: { ...dimensionInput, pending }, ctx: f.ctx, readPixelRatio: () => f.browser.devicePixelRatio || 1, ResizeObserverClass: f.browser.ResizeObserver,
      withGeometryReadCache: readServices.reads.withGeometryReadCache, isValueInputPending: () => pending.current && ['distance-value','offset-value'].includes(pending.current.type),
      window: f.browser, updatePropertiesUI: presentation.updatePropertiesUI, applicationText: settings.applicationText, readLanguage: () => settings.language });
    const { Point, commandTargets, sketchStyle, canvasSelection, canvasHover, pointUsage, resolvedLoopBounds, hatchAppearanceForDisplay, ...common } = seed;
    for (const name of ['currentScope','sketches','readServices','viewState','canvasThemeColor','applicationText']) delete common[name];
    const sceneOptions = { ...common, solveState: f.editing.solveState, analysis: { statusOf: () => state.status }, operandElement: operand => operand.element,
      instanceSources: { includesRef: () => false }, projection: { includes: () => false }, instances: { reference: null, sources: [] } };
    scene = workspace.createSceneForEditing(composed ? sceneOptions : { ...sceneOptions, currentScope: documentWorkspace.workspace.current, sketches: seed.sketches, readServices, interaction, targets, pending,
      readPanelSelection: () => presentation.selectedItem, viewState: controls.state, canvasThemeColor: color, applicationText: settings.applicationText });
    const placementOptions = { geometry: scene.geometry, annotations: { drawAnnotationLeader() {}, drawAnnotationText() {} }, hatchLayer: { drawResolvedHatch() {} }, blockPlacementCommand: {}, geometryInstanceCommand: {}, createBlockProjectionBundle() {} };
    placement = workspace.createPlacementPreview(composed ? placementOptions : { ...placementOptions, readServices, interaction, sessions });
    const inputOptions = { readPngExportCommand: () => null, blankCanvasGesture: {}, isBlankCommandPanelPoint: () => false, scheduler: { flush() {} } };
    const { phase } = presentation.profiler;
    binding = workspace.createInputBinding(composed ? inputOptions : { ...inputOptions, pointer, readCommandPanel: presentation.readCommandPanel, profileCommit: work => phase('commit',work) });
    const pngOptions = { documentName: () => 'untitled', prepareImages: async () => {}, fileSession: { busy: false }, findSnap: () => null, flushPointerMove() {} };
    png = workspace.createPngExport(composed ? pngOptions : { ...pngOptions, drawOperationLifecycle: interaction.lifecycle, pendingCommandSession: pending, constraintTargetSession: targets });
  } finally { for (const [namespace, original] of originals) w[namespace] = original; }
  assert.deepEqual(f.reads, []); assert.ok(f.calls.every(call => Array.isArray(call) && call[0] === 'element')); f.state.ready = true;
  return { ...f, prepared, controls, color, display, workspace, scene, placement, binding, png, pending, targets, sessions, interaction, documentWorkspace, readServices, presentation, probe };
}

test('Canvas workspace preparation preserves staged construction and shares actual controls, viewport, context and editing owners', () => {
  const raw = preparedWorkspaceFixture(false), f = preparedWorkspaceFixture(true), p = f.probe.ports, r = f.probe.results;
  assert.deepEqual(f.probe.order, raw.probe.order); assert.deepEqual(f.calls, raw.calls); assert.ok(Object.isFrozen(f.prepared));
  assert.equal(f.controls, r.controls); assert.equal(f.display.viewport, r.viewport); assert.equal(f.workspace.surface, r.surface); assert.equal(f.workspace.dimensions.display, r.dimensions.display);
  assert.equal(f.scene.geometry, r.geometry); assert.equal(f.placement, r.placementLayer); assert.equal(f.binding, r.inputBinding); assert.equal(f.png, r.png);
  for (const name of ['surface','export','layout','dimensions','placementRenderer']) assert.equal(p[name].viewport, f.display.viewport, name);
  assert.equal(p.geometry.ctx, f.ctx); assert.equal(p.geometry.viewState, f.controls.state); assert.equal(p.targets.readMode, f.interaction.lifecycle.readMode);
  assert.equal(p.input.pending, f.pending); assert.equal(p.routing.canvasPoint, f.display.viewport.canvasPoint); assert.equal(p.routing.pointer, f.sessions.pointer); assert.equal(p.png.pendingCommandSession, f.pending); assert.equal(p.png.constraintTargetSession, f.targets);
  assert.equal(p.dimensions.appearance, f.readServices.dimensionAppearance); assert.equal(p.dimensions.canvasThemeColor, f.color);
});

test('Canvas workspace preparation preserves live scope, language, theme, DPR, pending resize and original zoom bounds', () => {
  const run = composed => {
    const f = preparedWorkspaceFixture(composed); f.calls.length = 0; f.reads.length = 0;
    f.sceneState.theme = 'dark'; f.sceneState.language = 'ja';
    assert.equal(f.color('#ffffff'), sceneWindow.CanvasThemeColors.color('#ffffff','dark')); assert.equal(f.probe.ports.layout.readLanguage(), 'ja');
    f.sceneState.scope = { points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [], referenceImages: [] };
    const p1 = Object.assign(new sceneWindow.GeometrySolver.Point('P1',0,0),{sketchId:'S1'}), p2 = Object.assign(new sceneWindow.GeometrySolver.Point('P2',20,10),{sketchId:'S1'});
    const line = Object.assign(new sceneWindow.GeometrySolver.Line('L1',p1,p2),{sketchId:'S1'}); f.sceneState.scope.lines.push(line); f.sceneState.scope.points.push(p1,p2);
    assert.equal(f.probe.ports.dimensions.currentLines()[0], line); f.scene.geometry.drawLines([line]); const bounds = f.scene.bounds.allGeometryBounds();
    f.browser.devicePixelRatio = 3; f.workspace.surface.syncCanvasBitmapSize(160,80); assert.equal(f.canvas.width,480);
    f.pending.replace({type:'distance-value'}); f.probe.ports.surface.onResize(); assert.equal(f.calls.at(-1),'sync'); f.pending.clear(); f.probe.ports.surface.onResize(); assert.equal(f.calls.at(-1),'draw');
    f.display.navigation.setScale(1e12); const max = f.display.viewport.scale; f.display.navigation.setScale(1e-12); const min = f.display.viewport.scale;
    assert.equal(max,20000000); assert.equal(min,.002);
    return JSON.parse(JSON.stringify({calls:f.calls,reads:f.reads,strokes:f.strokes,bounds,min,max}));
  };
  assert.deepEqual(run(true),run(false));
});

test('Canvas staged workspace assembly keeps constructor failures and existing partially created owners without extra startup', () => {
  for (const failAt of ['controls','viewport','navigation','zoom','surface','export','layout','dragPointer','dimensions','input','targets','style','geometry','overlay','bounds','placementRenderer','placementLayer','routing','inputBinding','png']) {
    const marker = new Error(failAt), raw = {failAt,marker}, composed = {failAt,marker};
    for (const [mode,probe] of [[false,raw],[true,composed]]) assert.throws(() => preparedWorkspaceFixture(mode,probe), error => error === marker);
    assert.deepEqual(composed.order,raw.order,failAt); assert.deepEqual(composed.calls,raw.calls,failAt); assert.equal(composed.order.at(-1),failAt);
  }
});

function dimensionTraversalFixture(composed, failure, probe) {
  'use strict';
  probe ||= {}; probe.events = []; probe.draws = []; probe.marker ||= new Error('dimension traversal failure');
  const w = sceneWindow, original = w.DimensionPresentation;
  const state = { ready: false, active: 'S1', scope: { constraints: [] }, hidden: null, dragged: null, expression: false };
  const check = name => { assert.equal(state.ready, true); probe.events.push(name); if (failure === name) throw probe.marker; };
  const construct = name => { probe.events.push(name); if (failure === name) throw probe.marker; };
  w.DimensionPresentation = { ...original,
    createLabel: () => Object.freeze({ label: constraint => { check('label'); return constraint.id; } }),
    createPainter: () => Object.freeze({ drawDimension: function (...args) { assert.equal(this, undefined); check('paint'); probe.draws.push(args); } }),
    createSelectionBounds(input) { construct('bounds'); probe.boundsPorts = input; return probe.bounds = original.createSelectionBounds(input); },
    createLayer(input) { construct('layer'); probe.ports = input; return probe.layer = original.createLayer(input); },
  };
  let f, traversal;
  try {
    f = preparedWorkspaceFixture(true);
    const sketches = f.documentWorkspace.sketches, appearance = f.readServices.geometryAppearance;
    sketches.isActiveSketchConstraint = constraint => { check('active'); return constraint.sketchId === state.active; };
    sketches.constraintSketchId = constraint => constraint.sketchId;
    appearance.isVisibleSketchId = id => { check('visible'); return id !== state.hidden; };
    f.interaction.selection.inspectionContains = () => false; f.interaction.selection.constraintSelectedInCanvas = () => false;
    const input = { currentScope: () => { check('scope'); return state.scope; },
      readDraggedDimension: () => { check('drag'); return state.dragged; }, dimensionUsesExpression: () => { check('expression'); return state.expression; } };
    traversal = composed ? f.workspace.createDimensionTraversal(input) : f.workspace.dimensions.display.createTraversal({
      ...input, isActiveSketchConstraint: sketches.isActiveSketchConstraint, isVisibleSketchId: appearance.isVisibleSketchId,
      constraintSketchId: sketches.constraintSketchId, isVisibleValue: appearance.isVisibleValue, canvasSelection: f.interaction.selection,
      readHoverDimension: () => f.interaction.hover.current.dimension, readPending: () => f.pending.current,
      readExportFrame: () => f.workspace.exportRenderer.frame, readConstraintStatus: () => f.controls.state.constraintStatus,
      inactiveColor: w.GeometryPresentation.INACTIVE_CONSTRAINT_STATUS_COLOR, dimensionLabelForConstraint: f.workspace.dimensions.labels.label });
    assert.deepEqual(probe.events, ['bounds', 'layer']);
    assert.equal(traversal.selectionBounds, probe.bounds); assert.equal(traversal.layer, probe.layer);
    assert.equal(probe.ports.canvasSelection, f.interaction.selection);
    assert.equal(probe.ports.dimensionLabelForConstraint, f.workspace.dimensions.labels.label);
  } finally { w.DimensionPresentation = original; }
  f.ctx.measureText = function (text) { assert.equal(this, f.ctx); return { width: String(text).length * 5 }; };
  state.ready = true; probe.events.length = 0;
  const point = new w.GeometrySolver.Point('P1', 0, 0), other = new w.GeometrySolver.Point('P2', 10, 0);
  function constraint(id, sketchId) {
    const value = Object.assign(new w.GeometrySolver.DistanceConstraint(point, other, 10), { id, sketchId });
    value.dimension = f.workspace.dimensions.display.placement.defaultDimensionForTarget(w.DimensionQueries.targetFromConstraint(value));
    return value;
  }
  const active = constraint('active', 'S1'), inactive = constraint('inactive', 'S2'); state.scope.constraints.push(active, inactive);
  return { ...f, state, probe, traversal, active, inactive,
    snapshot() { return JSON.parse(JSON.stringify({ events: probe.events, draws: probe.draws, order: state.scope.constraints.map(c => c.id), calls: f.calls, stack: f.stack.length })); } };
}

test('Canvas dimension traversal shares existing bounds and layer while preserving custom scope, sorting and live interaction/export readers', () => {
  const run = composed => {
    const f = dimensionTraversalFixture(composed); assert.ok(Object.isFrozen(f.traversal)); f.traversal.layer.draw();
    assert.deepEqual(f.probe.draws.map(args => args[2]), ['inactive', 'active']);
    f.controls.constraintStatus.setLatched(true); f.interaction.hover.current = { dimension: f.active }; f.state.dragged = f.inactive;
    f.pending.replace({ type: 'distance-value', constraint: f.active }); f.state.expression = true; f.traversal.layer.draw();
    const editing = f.probe.draws.at(-1); assert.equal(editing[4], true); assert.equal(editing[5].hidden, true); assert.equal(editing[8], true);
    f.workspace.exportRenderer.render({ x: 0, y: 0, width: 10, height: 10 }, { x: 2, y: 2 }); f.traversal.layer.draw();
    assert.equal(f.probe.draws.at(-1)[4], false); assert.equal(f.probe.draws.at(-1)[5], null); assert.equal(f.probe.draws.at(-1)[8], false);
    f.state.scope = { constraints: [f.inactive] }; f.state.hidden = 'S2'; const count = f.probe.draws.length; f.traversal.layer.draw(); assert.equal(f.probe.draws.length, count);
    return f.snapshot();
  };
  assert.deepEqual(run(true), run(false));
});

test('Canvas dimension selection bounds retain real layout metrics, active/hidden short circuits and expression reads', () => {
  const run = composed => {
    const f = dimensionTraversalFixture(composed); const bounds = f.traversal.selectionBounds.read(f.active);
    assert.ok(Number.isFinite(bounds.x1)); assert.ok(bounds.x2 > bounds.x1);
    assert.equal(f.traversal.selectionBounds.read(f.inactive), null);
    f.state.hidden = 'S1'; assert.equal(f.traversal.selectionBounds.read(f.active), null);
    f.state.hidden = null; f.state.active = 'S2'; const other = f.traversal.selectionBounds.read(f.inactive); assert.ok(Number.isFinite(other.y1));
    return { bounds: { ...bounds }, other: { ...other }, snapshot: f.snapshot() };
  };
  assert.deepEqual(run(true), run(false));
});

test('Canvas dimension traversal preserves factory and reader/paint failures, consumed sort and unmatched save state', () => {
  for (const failure of ['bounds', 'layer']) {
    const marker = new Error('dimension traversal failure'), raw = { marker }, composed = { marker };
    assert.throws(() => dimensionTraversalFixture(false, failure, raw), error => error === marker);
    assert.throws(() => dimensionTraversalFixture(true, failure, composed), error => error === marker);
    assert.deepEqual(composed.events, raw.events);
  }
  for (const failure of ['scope', 'active', 'visible', 'drag', 'label', 'expression', 'paint']) {
    const run = composed => { const f = dimensionTraversalFixture(composed, failure);
      assert.throws(() => f.traversal.layer.draw(), error => error === f.probe.marker); return f.snapshot(); };
    assert.deepEqual(run(true), run(false), failure);
  }
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/ui/number_display.js', 'src/ui/canvas_input_binding.js', 'src/rendering/viewport.js', 'src/ui/canvas_navigation.js', 'src/ui/canvas_zoom_control.js', 'src/rendering/canvas_surface.js', 'src/rendering/canvas_export.js', 'src/ui/canvas_workspace_layout.js', 'src/application/canvas_display.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
function fixture() {
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
  const display = sandbox.window.CanvasDisplay.create({ canvas, document, initialScale: 2, minZoom: 0.1, maxZoom: 20, minLength: 1e-6,
    draw: () => { ready(); calls.push('draw'); state.onDraw?.(); }, setHint: () => calls.push('hint'), fitVisibleGeometry: () => true,
    flushPointerMoves: () => { ready(); calls.push('flush'); if (state.error) throw state.error; }, syncDimensionValueInput: () => calls.push('input'),
  });
  assert.deepEqual(calls, [['element', 'statusZoom'], ['element', 'statusZoomInput']]); calls.length = 0;
  class Observer { constructor(callback) { ready(); state.resize = callback; calls.push('observer'); } observe(value) { assert.equal(value, canvas); calls.push('observe'); } disconnect() { calls.push('disconnect'); } }
  const workspace = display.createWorkspace({ ctx, readPixelRatio: () => { ready(); return state.dpr; }, ResizeObserverClass: Observer,
    withGeometryReadCache: callback => { calls.push('cache'); callback(); }, drawCanvas: () => { ready(); calls.push('content'); state.onContent?.(); },
    isValueInputPending: () => { calls.push('pending'); return state.pending; }, window: browser, updatePropertiesUI() {}, closeContextMenu: () => calls.push('close-menu'),
    applySketchTreeWidth: () => calls.push('tree'), applicationText: (_ja, en) => en, readLanguage: () => 'en',
  });
  assert.deepEqual(calls, []); state.ready = true;
  const enter = percent => { button.emit('click'); input.valueAsNumber = percent; input.emit('keydown', { key: 'Enter' }); };
  return { display, workspace, state, calls, button, input, browser, canvas, ctx, enter, status };
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

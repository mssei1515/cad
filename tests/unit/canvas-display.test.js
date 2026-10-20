const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/rendering/viewport.js', 'src/ui/canvas_navigation.js', 'src/ui/canvas_zoom_control.js', 'src/rendering/canvas_surface.js', 'src/rendering/canvas_export.js', 'src/ui/canvas_workspace_layout.js', 'src/application/canvas_display.js']) {
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
  const button = element(), input = element(), browser = element();
  const ready = () => assert.equal(state.ready, true);
  const document = { getElementById(id) { calls.push(['element', id]); return id === 'statusZoom' ? button : id === 'statusZoomInput' ? input : null; }, querySelector: () => null };
  const canvas = { width: 0, height: 0, getBoundingClientRect() { ready(); calls.push('rect'); return state.rect; }, classList: { add() {}, remove() {} }, setPointerCapture() {} };
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
  return { display, workspace, state, calls, button, input, browser, canvas, enter };
}

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

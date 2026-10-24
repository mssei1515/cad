const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/canvas_input_binding.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], listeners = {}, status = { textContent: '' }; const record = name => (...args) => calls.push([name, ...args]);
  const binding = sandbox.window.CanvasInputBinding.create({ canvas: { addEventListener: (name, handler, options) => { listeners[name] = { handler, options }; } },
    pointer: Object.fromEntries(['down','move','finish','leave','doubleClick'].map(name => [name, record(name)])),
    scheduler: { flush: record('flush'), schedule: record('schedule') }, navigation: { zoom: record('zoom'), doubleClickFit: record('fit') },
    profileCommit: work => { calls.push(['profile']); return work(); }, closeContextMenu: record('close'), afterZoom: record('after'),
    screenToWorld: p => ({ x: p.x / 2, y: p.y / 2 }), formatCoordinate: (v, digits) => v.toFixed(digits), coordinateStatus: () => status });
  binding.bind(); return { binding, calls, listeners, status };
}
test('press, activation and completion flush before delegation and preserve original events', () => {
  const f = fixture(), event = {};
  for (const [name, target] of [['pointerdown','down'],['dblclick','doubleClick'],['pointerup','finish'],['pointercancel','finish']]) {
    f.calls.length = 0; f.listeners[name].handler(event);
    assert.equal(f.calls[0][0], 'flush'); assert.equal(f.calls.at(-1)[0], target); assert.equal(f.calls.at(-1)[1], event);
    assert.equal(f.calls.some(c => c[0] === 'profile'), target === 'finish');
  }
  f.calls.length = 0; f.listeners.pointerleave.handler(event); assert.deepEqual(f.calls, [['leave']]);
  f.calls.length = 0; f.listeners.pointermove.handler(event); assert.equal(f.calls[0][0], 'schedule'); assert.equal(f.calls[0][1], event);
});
test('wheel orders prevention, flush, menu closure, zoom and input synchronization', () => {
  const f = fixture(), event = { preventDefault: () => f.calls.push(['prevent']) };
  f.listeners.wheel.handler(event); assert.deepEqual(f.calls.map(c => c[0]), ['prevent','flush','close','zoom','after']);
  assert.equal(f.listeners.wheel.options.passive, false); assert.equal(f.calls[3][1], event);
  f.calls.length = 0; f.listeners.auxclick.handler({ button: 0 }); assert.deepEqual(f.calls, []);
  f.listeners.auxclick.handler({ ...event, button: 1 }); assert.deepEqual(f.calls.map(c => c[0]), ['prevent','fit']);
});
test('processed movement updates coordinates before forwarding screen, world and shift', () => {
  const f = fixture(); f.binding.processMove({ offsetX: 8, offsetY: 12, shiftKey: true });
  assert.equal(f.status.textContent, 'X 4.000 / Y 6.000'); assert.equal(f.calls[0][1].x, 8); assert.equal(f.calls[0][2].y, 6); assert.equal(f.calls[0][3], true);
  let writes = 0; Object.defineProperty(f.status, 'textContent', { get: () => 'X 4.000 / Y 6.000', set: () => writes++ });
  f.binding.processMove({ offsetX: 8, offsetY: 12 }); assert.equal(writes, 0);
});

function routingFixture() {
  const calls = [], state = { ready: false, panel: null, png: null, consume: false, suppressed: false, panning: false, onPanelMove: null, onPan: null, pressError: null };
  const record = name => (...args) => calls.push([name, ...args]);
  const pointer = Object.fromEntries(['down', 'move', 'finish', 'leave', 'doubleClick'].map(name => [name, function(...args) { assert.equal(this, pointer); calls.push([name, ...args]); }]));
  // Leave is spread without wrapping, as in the original application adapter.
  pointer.leave = record('leave');
  const ready = () => assert.equal(state.ready, true);
  const panel = { active: true,
    canvasPress(screen, blank) { assert.equal(this, panel); calls.push(['panel-press', screen, blank]); if (state.pressError) throw state.pressError; return state.consume; },
    canvasMove(screen) { assert.equal(this, panel); calls.push(['panel-move', screen]); state.onPanelMove?.(); },
    canvasDoubleClick(blank) { assert.equal(this, panel); calls.push(['panel-double', blank]); },
  };
  const png = { active: true, pick(world) { assert.equal(this, png); calls.push(['pick', world]); }, move(world) { assert.equal(this, png); calls.push(['png-move', world]); } };
  const screen = { x: 8, y: 12 }, world = { x: 4, y: 6 };
  const navigation = { movePan(value) { assert.equal(this, navigation); calls.push(['pan', value]); state.onPan?.(); return state.panning; } };
  const routing = sandbox.window.CanvasInputBinding.createCommandRouting({ pointer,
    readCommandPanel: () => { ready(); calls.push(['read-panel']); return state.panel; },
    readPngExportCommand: () => { ready(); calls.push(['read-png']); return state.png; },
    blankCanvasGesture: { suppressNext: () => { calls.push(['suppress']); state.suppressed = true; }, takeSuppression: () => { calls.push(['take']); const value = state.suppressed; state.suppressed = false; return value; } },
    canvasScreenPoint: event => { calls.push(['screen', event]); return screen; }, canvasPoint: event => { calls.push(['world', event]); return world; },
    isBlankCommandPanelPoint: point => { assert.equal(point, world); calls.push(['blank']); return true; },
    screenToWorld: point => { calls.push(['convert', point]); return world; }, navigation,
  });
  assert.deepEqual(calls, []); state.ready = true;
  const event = { button: 0, offsetX: 8, offsetY: 12, preventDefault: () => calls.push(['prevent']) };
  return { routing, state, calls, panel, png, event, screen, world, navigation, names: () => calls.map(call => call[0]) };
}

test('panel consumes left press before PNG and ordinary interaction and preserves coordinate, suppression and error order', () => {
  const f = routingFixture(); f.state.panel = f.panel; f.state.png = f.png; f.state.consume = true;
  assert.equal(f.routing.down(f.event), undefined);
  assert.deepEqual(f.names(), ['read-panel', 'read-panel', 'screen', 'world', 'blank', 'panel-press', 'suppress', 'prevent']);
  assert.equal(f.calls[5][1], f.screen); assert.equal(f.calls[5][2], true); assert.equal(f.state.suppressed, true);
  f.calls.length = 0; const error = new Error('panel failed'); f.state.pressError = error;
  assert.throws(() => f.routing.down(f.event), value => value === error);
  assert.deepEqual(f.names(), ['read-panel', 'read-panel', 'screen', 'world', 'blank', 'panel-press']);
});

test('unconsumed panel press routes left PNG coordinates and all other presses to the original controller', () => {
  const f = routingFixture(); f.state.panel = f.panel; f.state.png = f.png;
  f.routing.down(f.event); assert.deepEqual(f.names().slice(-4), ['read-png', 'read-png', 'convert', 'pick']);
  assert.deepEqual({ ...f.calls.at(-2)[1] }, { x: 8, y: 12 }); assert.equal(f.calls.at(-1)[1], f.world);
  f.calls.length = 0; const right = { ...f.event, button: 2 }; f.routing.down(right);
  assert.deepEqual(f.names(), ['read-png', 'down']); assert.equal(f.calls.at(-1)[1], right);
  f.calls.length = 0; f.state.panel = null; f.state.png = null; f.routing.down(f.event);
  assert.deepEqual(f.names(), ['read-panel', 'read-png', 'down']); assert.equal(f.calls.at(-1)[1], f.event);
});

test('movement notifies even inactive panels before reading current PNG and pan takes priority over crop movement', () => {
  const f = routingFixture(); f.panel.active = false; f.state.panel = f.panel;
  f.state.onPanelMove = () => { f.state.png = f.png; }; f.state.panning = true;
  f.routing.move(f.screen, f.world, true); assert.deepEqual(f.names(), ['read-panel', 'panel-move', 'read-png', 'pan']);
  f.calls.length = 0; f.state.panning = false;
  const replacement = { move(point) { assert.equal(this, replacement); f.calls.push(['replacement-move', point]); } };
  f.state.onPan = () => { f.state.png = replacement; };
  f.routing.move(f.screen, f.world, false); assert.deepEqual(f.names(), ['read-panel', 'panel-move', 'read-png', 'pan', 'read-png', 'replacement-move']);
  assert.equal(f.calls.at(-1)[1], f.world);
  f.calls.length = 0; f.state.panel = null; f.state.png = null;
  f.routing.move(f.screen, f.world, true); assert.deepEqual(f.names(), ['read-panel', 'read-png', 'move']);
  assert.deepEqual(f.calls.at(-1).slice(1), [f.screen, f.world, true]);
});

test('completion and double click preserve PNG guards, one-shot suppression and panel priority', () => {
  const f = routingFixture(); f.state.png = f.png; f.routing.finish(f.event); assert.deepEqual(f.names(), ['read-png']);
  f.calls.length = 0; const middle = { ...f.event, button: 1 }; f.routing.finish(middle);
  assert.deepEqual(f.names(), ['read-png', 'finish']); assert.equal(f.calls.at(-1)[1], middle);
  f.calls.length = 0; f.state.suppressed = true; f.routing.doubleClick(f.event); assert.deepEqual(f.names(), ['take', 'prevent']);
  f.calls.length = 0; f.state.panel = f.panel; f.routing.doubleClick(f.event);
  assert.deepEqual(f.names(), ['take', 'read-panel', 'read-panel', 'world', 'blank', 'panel-double', 'prevent']);
  f.calls.length = 0; f.state.panel = null; f.routing.doubleClick(f.event); assert.deepEqual(f.names(), ['take', 'read-panel', 'read-png']);
  f.calls.length = 0; f.state.png = null; f.routing.doubleClick(f.event); assert.deepEqual(f.names(), ['take', 'read-panel', 'read-png', 'doubleClick']);
  assert.equal(f.calls.at(-1)[1], f.event); f.calls.length = 0; f.routing.leave(); assert.deepEqual(f.names(), ['leave']);
});

test('native input binding retains flush, coordinate update and completion profiling around panel and PNG routing', () => {
  const f = routingFixture(), listeners = {}, status = { textContent: '' }; f.state.panel = f.panel; f.state.consume = true;
  const binding = sandbox.window.CanvasInputBinding.create({ canvas: { addEventListener: (name, handler) => { listeners[name] = handler; } }, pointer: f.routing,
    scheduler: { flush: () => f.calls.push(['flush']), schedule() {} }, navigation: f.navigation,
    profileCommit: work => { f.calls.push(['profile']); return work(); }, closeContextMenu() {}, afterZoom() {},
    screenToWorld: () => f.world, formatCoordinate: value => String(value), coordinateStatus: () => status });
  assert.deepEqual(f.calls, []); binding.bind(); listeners.pointerdown(f.event); assert.equal(f.calls[0][0], 'flush');
  f.calls.length = 0; listeners.dblclick(f.event); assert.deepEqual(f.names(), ['flush', 'take', 'prevent']);
  f.calls.length = 0; f.state.png = f.png; binding.processMove({ offsetX: 8, offsetY: 12, shiftKey: true });
  assert.equal(status.textContent, 'X 4 / Y 6'); assert.equal(f.calls.at(-1)[1], f.world);
  f.calls.length = 0; listeners.pointercancel(f.event); assert.deepEqual(f.names(), ['flush', 'profile', 'read-png']);
});

function dragPointerFixture() {
  const calls=[],classes=new Set(),state={ready:false,fail:null};
  const step=(name,id)=>{assert.equal(state.ready,true);calls.push([name,id]);if(state.fail===name)throw state.error;};
  const classList={add(name){assert.equal(this,classList);step('add',name);classes.add(name);},remove(name){assert.equal(this,classList);step('remove',name);classes.delete(name);}};
  const canvas={get classList(){assert.equal(state.ready,true);return classList;},
    setPointerCapture(id){assert.equal(this,canvas);step('capture',id);},releasePointerCapture(id){assert.equal(this,canvas);step('release',id);}};
  const pointer=sandbox.window.CanvasInputBinding.createDragPointer({canvas});assert.deepEqual(calls,[]);state.ready=true;
  return{pointer,calls,classes,state};
}
test('drag pointer effects preserve both begin orders, exact pointer IDs and class cleanup without construction reads',()=>{
  const f=dragPointerFixture(),id={pointer:7};
  f.pointer.markThenCapture(id);assert.deepEqual(f.calls,[['add','is-dragging'],['capture',id]]);assert.equal(f.classes.has('is-dragging'),true);
  f.calls.length=0;f.pointer.release(id);assert.deepEqual(f.calls,[['remove','is-dragging'],['release',id]]);assert.equal(f.classes.has('is-dragging'),false);
  f.calls.length=0;f.pointer.captureThenMark(id);assert.deepEqual(f.calls,[['capture',id],['add','is-dragging']]);
});
test('drag pointer failures preserve partial begin effects and only suppress capture release errors',()=>{
  const f=dragPointerFixture(),marker=new Error('pointer');f.state.error=marker;f.state.fail='capture';
  assert.throws(()=>f.pointer.markThenCapture(9),error=>error===marker);assert.equal(f.classes.has('is-dragging'),true);
  f.classes.clear();f.calls.length=0;assert.throws(()=>f.pointer.captureThenMark(9),error=>error===marker);assert.deepEqual(f.calls,[['capture',9]]);assert.equal(f.classes.size,0);
  f.state.fail='release';f.classes.add('is-dragging');f.calls.length=0;assert.doesNotThrow(()=>f.pointer.release(9));assert.deepEqual(f.calls,[['remove','is-dragging'],['release',9]]);assert.equal(f.classes.size,0);
  f.state.fail='remove';f.calls.length=0;assert.throws(()=>f.pointer.release(9),error=>error===marker);assert.deepEqual(f.calls,[['remove','is-dragging']]);
});

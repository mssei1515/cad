const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/ui/canvas_context_menu.js', 'utf8'), sandbox);
function surface() {
  const handlers = new Map();
  return { addEventListener(type, handler) { const set = handlers.get(type) || new Set(); set.add(handler); handlers.set(type, set); },
    removeEventListener(type, handler) { handlers.get(type)?.delete(handler); },
    fire(type, event = {}) { for (const handler of handlers.get(type) || []) handler(event); },
    count() { return [...handlers.values()].reduce((n, set) => n + set.size, 0); } };
}
function fixture({ fromDocument = false, menuOverride } = {}) {
  const document = surface(), window = surface(), canvas = surface(), menu = surface(), calls = [], state = { original: true };
  const classes = new Set(); let buttons = [];
  Object.assign(menu, { hidden: true, innerHTML: '', style: {}, classList: { add: x => classes.add(x), remove: x => classes.delete(x) },
    setAttribute() {}, getBoundingClientRect: () => ({ width: 100, height: 60 }), contains: button => buttons.includes(button),
    querySelector: () => buttons[0], querySelectorAll: () => buttons });
  canvas.closest = () => ({ getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }) });
  const domReads = [];
  document.getElementById = id => { domReads.push(id); return menu; };
  const options = { document, window, canvas, menu: menuOverride === undefined ? (fromDocument ? undefined : menu) : menuOverride,
    escapeHtml: text => String(text).replaceAll('<', '&lt;'), applicationText: (ja, en) => en,
    presentCandidate: target => ({ icon: '', type: target.kind, id: target.item.id, secondary: '' }),
    hover: { capture: () => state, restore: value => calls.push(['restore', value]), clear: () => calls.push(['clear']),
      preview: value => calls.push(['preview', value]), draw: () => calls.push(['draw']) },
    onOpen: () => calls.push(['open']), onSelect: (target, pointer) => calls.push(['select', target, pointer, menu.hidden]),
    onAction: (action, target, pointer) => calls.push(['action', action, target, pointer, menu.hidden]) };
  const resolved = fromDocument ? sandbox.window.CanvasContextMenu.createForDocument(options) : null;
  const controller = resolved?.controller || sandbox.window.CanvasContextMenu.create(options);
  const target = { kind: 'line', item: { id: 'L1' } }, pointer = { x: 3, y: 4 };
  function button(dataset) { const value = { dataset, disabled: false, contains: () => false,
    closest: selector => selector.includes('candidate') ? (dataset.contextCandidateIndex != null ? value : null) : selector.includes('action') ? (dataset.contextAction ? value : null) : null,
    focus() { document.activeElement = value; } }; buttons.push(value); return value; }
  function open(showCandidates = true) { controller.open({ event: { clientX: 300, clientY: 200 }, pointer, target,
    candidates: [target], showCandidates, items: [{ action: 'copy', label: '<Copy>' }] }); }
  return { controller, document, window, canvas, menu, calls, state, target, pointer, open, button, domReads, resolved };
}

test('Document Canvas menu resolves one live element and leaves session/listener ownership with the controller', () => {
  const f = fixture({ fromDocument: true });
  assert.deepEqual(f.domReads, ['canvasContextMenu']); assert.equal(f.resolved.element, f.menu);
  assert.equal(f.menu.count() + f.canvas.count() + f.document.count() + f.window.count(), 0);
  f.controller.start(); f.open(false); assert.equal(f.resolved.element.hidden, false);
  assert.equal(f.controller.close(), true); assert.equal(f.resolved.element.hidden, true); assert.equal(f.domReads.length, 1);
  f.controller.dispose(); assert.equal(f.menu.count() + f.canvas.count() + f.document.count() + f.window.count(), 0);
});

test('explicit Canvas menu and null bypass Document lookup and retain legacy null behavior', () => {
  const direct = fixture(); assert.deepEqual(direct.domReads, []);
  const disabled = fixture({ fromDocument: true, menuOverride: null });
  assert.equal(disabled.resolved.element, null); assert.deepEqual(disabled.domReads, []);
  disabled.controller.start(); assert.equal(disabled.controller.close(), false);
  const legacy = fixture({ menuOverride: null }); legacy.controller.start();
  const count = f => f.menu.count() + f.canvas.count() + f.document.count() + f.window.count();
  assert.equal(count(disabled), count(legacy));
  let legacyFailure; try { legacy.open(); } catch (error) { legacyFailure = error; }
  assert.ok(legacyFailure);
  assert.throws(() => disabled.open(), error => error.name === legacyFailure.name && error.message === legacyFailure.message);
  disabled.controller.dispose(); legacy.controller.dispose(); assert.equal(count(disabled) + count(legacy), 0);
});
test('candidate session owns its list, clamps menu placement and restores hover on dismissal', () => {
  const f = fixture(); f.open();
  assert.equal(f.menu.style.left, '96px'); assert.equal(f.menu.style.top, '36px');
  f.controller.candidates().pop(); assert.equal(f.controller.candidates().length, 1);
  assert.equal(f.controller.close(), true); assert.equal(f.menu.hidden, true);
  assert.equal(f.calls[0][0], 'restore'); assert.equal(f.calls[0][1], f.state);
  assert.equal(f.controller.candidates().length, 0); assert.equal(f.controller.close(), false);
});
test('candidate activation clears preview and closes before notifying selection with the saved pointer', () => {
  const f = fixture(), button = f.button({ contextCandidateIndex: '0' }); f.controller.start(); f.open();
  f.menu.fire('pointerover', { target: button }); assert.equal(f.calls[0][1], f.target);
  f.menu.fire('click', { target: button });
  assert.deepEqual(f.calls.at(-1), ['select', f.target, f.pointer, true]);
  assert.ok(f.calls.some(call => call[0] === 'clear')); assert.ok(!f.calls.some(call => call[0] === 'restore'));
});
test('action dispatch retains target and pointer after session is cleared and ignores disabled buttons', () => {
  const f = fixture(), button = f.button({ contextAction: 'copy' }); f.controller.start(); f.open(false);
  assert.match(f.menu.innerHTML, /&lt;Copy>/); button.disabled = true;
  f.menu.fire('click', { target: button }); assert.equal(f.calls.length, 0);
  button.disabled = false; f.menu.fire('click', { target: button });
  assert.deepEqual(f.calls.at(-1), ['action', 'copy', f.target, f.pointer, true]);
});
test('start is idempotent and dispose removes every listener and restores an open preview', () => {
  const f = fixture(); f.controller.start(); const count = f.menu.count(); f.controller.start();
  assert.equal(f.menu.count(), count); f.canvas.fire('contextmenu'); assert.equal(f.calls.length, 1);
  f.open(); f.controller.dispose(); assert.equal(f.menu.hidden, true);
  assert.equal(f.menu.count() + f.canvas.count() + f.document.count() + f.window.count(), 0);
  assert.ok(f.calls.some(call => call[0] === 'restore'));
  f.controller.start(); f.canvas.fire('contextmenu'); assert.equal(f.calls.filter(call => call[0] === 'open').length, 2);
});
test('Escape restores hover and keyboard confirmation selects the focused candidate', () => {
  const f = fixture(); f.button({ contextCandidateIndex: '0' }); f.controller.start(); f.open();
  const event = key => ({ key, preventDefault() {}, stopPropagation() {} });
  f.menu.fire('keydown', event('Escape')); assert.equal(f.menu.hidden, true);
  assert.ok(f.calls.some(call => call[0] === 'restore'));
  f.open(); f.menu.fire('keydown', event('Enter')); assert.deepEqual(f.calls.at(-1), ['select', f.target, f.pointer, true]);
});

function entryFixture({ menu = {} } = {}) {
  const f = { calls: [], geometry: true, command: false, constraint: {}, candidates: [], pointer: { x: 1, y: 2 } };
  const controller = { open(options) { assert.equal(this, controller); f.options = options; f.calls.push(['open']); } };
  f.event = { preventDefault() { f.calls.push(['prevent']); } };
  f.entry = sandbox.window.CanvasContextMenu.createEntry({
    canvasContextMenu: menu, isGeometryMode: () => { f.calls.push(['geometry']); return f.geometry; },
    closeAppMenus: () => f.calls.push(['close']),
    canvasPoint: event => { assert.equal(event, f.event); f.calls.push(['point']); return f.pointer; },
    setLastPointer: pointer => { assert.equal(pointer, f.pointer); f.calls.push(['pointer']); },
    hasCancellableCanvasCommand: () => { f.calls.push(['command']); return f.command; },
    constraintTargetSession: f.constraint,
    canvasContextCandidatesAt: pointer => { assert.equal(pointer, f.pointer); f.calls.push(['candidates']); return f.candidates; },
    selectCanvasContextTarget: (target, options) => f.calls.push(['select', target, options]),
    updateUI: options => f.calls.push(['ui', options.refreshAnalysis]), draw: () => f.calls.push(['draw']),
    canvasContextController: controller,
    canvasContextMenuItems: (target, active) => { f.calls.push(['items', target, active]); return f.items; },
  });
  f.items = [{ action: 'copy' }];
  return f;
}

test('entry rejects missing menu or non-geometry mode before suppressing the native event', () => {
  const absent = entryFixture({ menu: null }); absent.entry.open(absent.event);
  assert.equal(absent.calls.length, 0);
  const f = entryFixture(); f.geometry = false; f.entry.open(f.event);
  assert.deepEqual(f.calls, [['geometry']]);
  f.calls.length = 0; f.geometry = true; f.entry.open(f.event);
  assert.equal(f.calls[1][0], 'prevent');
  assert.equal(f.options.target.kind, 'blank');
  assert.equal(f.calls.some(call => call[0] === 'select'), false);
});

test('entry preserves single-target selection and pointer/UI/menu ordering', () => {
  const f = entryFixture(), target = { kind: 'line', item: {} };
  f.candidates.push(target); f.entry.open(f.event);
  assert.deepEqual(f.calls.map(call => call[0]), ['geometry', 'prevent', 'close', 'point', 'pointer', 'command', 'candidates', 'select', 'ui', 'draw', 'items', 'open']);
  assert.equal(f.options.target, target);
  assert.equal(f.options.pointer, f.pointer);
  assert.equal(f.options.event, f.event);
  assert.equal(f.options.candidates, f.candidates);
  assert.equal(f.options.items, f.items);
  assert.equal(f.options.showCandidates, false);
  assert.equal(f.calls.find(call => call[0] === 'select')[2], undefined);
  assert.deepEqual(f.calls.find(call => call[0] === 'ui'), ['ui', false]);
});

test('entry distinguishes ordinary command, constraint operands and overlapping candidates without selecting', () => {
  const f = entryFixture(); f.candidates.push({ kind: 'line', item: {} }); f.command = true;
  f.entry.open(f.event);
  assert.equal(f.calls.some(call => call[0] === 'candidates'), false);
  assert.equal(f.options.candidates.length, 0);
  assert.equal(f.options.showCandidates, false);
  assert.equal(f.options.target.kind, 'blank');
  f.calls.length = 0; f.constraint.command = { type: 'horizontal' };
  f.entry.open(f.event);
  assert.equal(f.calls.some(call => call[0] === 'candidates'), true);
  assert.equal(f.calls.some(call => call[0] === 'items' || call[0] === 'select' || call[0] === 'ui'), false);
  assert.equal(f.options.showCandidates, true);
  assert.equal(f.options.items.length, 0);
  f.calls.length = 0; f.constraint.command = null; f.command = false; f.candidates.push({ kind: 'line', item: {} });
  f.entry.open(f.event);
  assert.equal(f.options.showCandidates, true);
  assert.equal(f.options.target.kind, 'blank');
  assert.equal(f.calls.some(call => call[0] === 'select'), false);
});

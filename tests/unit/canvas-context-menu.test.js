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
function fixture() {
  const document = surface(), window = surface(), canvas = surface(), menu = surface(), calls = [], state = { original: true };
  const classes = new Set(); let buttons = [];
  Object.assign(menu, { hidden: true, innerHTML: '', style: {}, classList: { add: x => classes.add(x), remove: x => classes.delete(x) },
    setAttribute() {}, getBoundingClientRect: () => ({ width: 100, height: 60 }), contains: button => buttons.includes(button),
    querySelector: () => buttons[0], querySelectorAll: () => buttons });
  canvas.closest = () => ({ getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }) });
  const controller = sandbox.window.CanvasContextMenu.create({ document, window, canvas, menu,
    escapeHtml: text => String(text).replaceAll('<', '&lt;'), applicationText: (ja, en) => en,
    presentCandidate: target => ({ icon: '', type: target.kind, id: target.item.id, secondary: '' }),
    hover: { capture: () => state, restore: value => calls.push(['restore', value]), clear: () => calls.push(['clear']),
      preview: value => calls.push(['preview', value]), draw: () => calls.push(['draw']) },
    onOpen: () => calls.push(['open']), onSelect: (target, pointer) => calls.push(['select', target, pointer, menu.hidden]),
    onAction: (action, target, pointer) => calls.push(['action', action, target, pointer, menu.hidden]) });
  const target = { kind: 'line', item: { id: 'L1' } }, pointer = { x: 3, y: 4 };
  function button(dataset) { const value = { dataset, disabled: false, contains: () => false,
    closest: selector => selector.includes('candidate') ? (dataset.contextCandidateIndex != null ? value : null) : selector.includes('action') ? (dataset.contextAction ? value : null) : null,
    focus() { document.activeElement = value; } }; buttons.push(value); return value; }
  function open(showCandidates = true) { controller.open({ event: { clientX: 300, clientY: 200 }, pointer, target,
    candidates: [target], showCandidates, items: [{ action: 'copy', label: '<Copy>' }] }); }
  return { controller, document, window, canvas, menu, calls, state, target, pointer, open, button };
}
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

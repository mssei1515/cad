const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/constraint_status_view.js'), 'utf8'), sandbox);
function fixture() {
  const calls = []; const viewState = { constraintStatus: false }; const menuInput = {};
  const button = { classList: { toggle: (_, active) => { button.active = active; } }, setAttribute: (_, value) => { button.pressed = value; } };
  const controller = sandbox.window.ConstraintStatusView.create({ viewState, button, menuInput,
    setHint: value => calls.push(value), draw: () => calls.push('draw') });
  return { controller, calls, viewState, button, menuInput,
    event: (code = 'Space') => ({ code, preventDefault: () => calls.push('prevent') }) };
}
test('latch and held key independently keep visualization active', () => {
  const f = fixture(); f.controller.toggle();
  assert.equal(f.viewState.constraintStatus, true); assert.equal(f.button.pressed, 'true'); assert.equal(f.menuInput.checked, true);
  f.calls.length = 0; assert.equal(f.controller.hold(f.event(), false), true);
  f.controller.setLatched(false); assert.equal(f.viewState.constraintStatus, true);
  assert.deepEqual(f.calls, ['prevent']);
  f.controller.release(f.event()); assert.equal(f.viewState.constraintStatus, false);
  assert.equal(f.button.active, false); assert.equal(f.menuInput.checked, false);
  assert.equal(f.calls.at(-1), 'draw');
});
test('text inputs, repeated holds and unrelated releases do not change state', () => {
  const f = fixture(); assert.equal(f.controller.hold(f.event(), true), false);
  assert.equal(f.controller.hold(f.event('KeyA'), false), false); assert.deepEqual(f.calls, []);
  f.controller.hold(f.event(), false); f.calls.length = 0;
  assert.equal(f.controller.hold(f.event(), false), false); f.controller.release(f.event('KeyA'));
  assert.equal(f.controller.spaceHeld, true); assert.deepEqual(f.calls, []);
});
test('blur releases temporary state silently while preserving the latch', () => {
  for (const latched of [false, true]) {
    const f = fixture(); f.controller.setLatched(latched); f.controller.hold(f.event(), false); f.calls.length = 0;
    f.controller.blur(); assert.equal(f.controller.spaceHeld, false); assert.equal(f.controller.mouseLatched, latched);
    assert.equal(f.viewState.constraintStatus, latched); assert.deepEqual(f.calls, latched ? [] : ['draw']);
    f.calls.length = 0; f.controller.blur(); f.controller.release(f.event()); assert.deepEqual(f.calls, []);
  }
});

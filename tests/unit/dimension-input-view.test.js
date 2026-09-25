const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/dimension_input_view.js'), 'utf8'), sandbox);
function fixture(withShell = true) {
  const calls = [], frames = [], classes = new Set(); let value = '', writes = 0;
  const style = () => ({ setProperty(name, value) { this[name] = value; } });
  const input = { hidden: true, style: style(),
    get value() { return value; }, set value(next) { value = next; writes++; },
    classList: { contains: key => classes.has(key), remove: key => classes.delete(key), toggle: (key, on) => on ? classes.add(key) : classes.delete(key) },
    focus: () => calls.push('focus'), select: () => calls.push('select'),
  };
  const shell = withShell ? { hidden: true, style: style() } : null;
  const view = sandbox.window.DimensionInputView.create({ input, shell, screenPxPerMm: 4,
    syncHighlight: target => { assert.equal(target, input); calls.push('highlight'); }, scheduleFrame: callback => frames.push(callback) });
  const state = { screen: { x: 10, y: 20 }, angle: 0.5, labelOffset: { x: 2, y: -3 }, textHeight: 3, buffer: '25' };
  return { view, input, shell, state, calls, frames, classes, writes: () => writes };
}
test('positions the shell in screen pixels and preserves equal input values', () => {
  const f = fixture(); f.view.render(f.state); f.view.render(f.state);
  assert.equal(f.shell.style.left, '12px'); assert.equal(f.shell.style.top, '17px');
  assert.equal(f.shell.style['--dimension-text-angle'], '0.5rad'); assert.equal(f.shell.style.fontSize, '12px');
  assert.equal(f.shell.style.width, '132px'); assert.equal(f.writes(), 1);
  f.view.render({ ...f.state, buffer: '1'.repeat(40), textHeight: 0 });
  assert.equal(f.shell.style.width, '280px'); assert.equal(f.shell.style.fontSize, '8px');
});
test('without a shell it styles the input and hide clears invalid presentation', () => {
  const f = fixture(false); f.view.render(f.state); f.view.setInvalid(true);
  assert.equal(f.input.style.left, '12px'); assert.equal(f.classes.has('is-invalid'), true);
  assert.deepEqual(f.calls, ['highlight']); f.view.hide();
  assert.equal(f.input.hidden, true); assert.equal(f.classes.has('is-invalid'), false);
});
test('scheduled focus synchronizes first and skips focus if the command became hidden', () => {
  const f = fixture(); f.view.focus(() => f.view.render(f.state));
  assert.equal(f.calls.length, 0); f.frames.shift()(); assert.deepEqual(f.calls, ['focus', 'select']);
  f.calls.length = 0; f.view.focus(() => f.view.hide()); f.frames.shift()(); assert.deepEqual(f.calls, []);
});

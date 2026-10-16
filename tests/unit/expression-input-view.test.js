const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/expression_input_view.js'), 'utf8'), sandbox);
class Input extends EventTarget {
  constructor(value, start, end = start) { super(); Object.assign(this, { value, selectionStart: start, selectionEnd: end, isConnected: true, calls: [] }); }
  dispatchEvent(event) { this.calls.push(['event', event.type, event.bubbles]); return super.dispatchEvent(event); }
  focus(options) { this.calls.push(['focus', options.preventScroll]); }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; this.calls.push(['caret', start, end]); }
}
const insertion = sandbox.window.ExpressionInputView.createInsertion({ Event, formatParameterReference: id => `"${id}"` });

test('identifier insertion preserves equals, selected text, padding, input event order, focus and caret', () => {
  const input = new Input('xyZ', 1, 2);
  insertion.insert(input, 'd1');
  assert.equal(input.value, '=x "d1" Z'); assert.equal(input.selectionStart, 8); assert.equal(input.selectionEnd, 8);
  assert.deepEqual(input.calls, [['event', 'input', true], ['focus', true], ['caret', 8, 8]]);
  const equals = new Input('=abc', 0, 1);
  insertion.insert(equals, 'd1'); assert.equal(equals.value, '="d1" abc'); assert.equal(equals.selectionStart, 6);
  const noSelection = new Input('12', null, null);
  insertion.insert(noSelection, 'd1'); assert.equal(noSelection.value, '=12 "d1"'); assert.equal(noSelection.selectionStart, 8);
});

test('blur emits change only for a connected input without an earlier native change', () => {
  for (const mode of ['synthetic', 'native', 'disconnected']) {
    const input = new Input('=1', 2); let changes = 0;
    input.addEventListener('change', event => { assert.equal(event.bubbles, true); changes++; });
    insertion.insert(input, 'd1');
    if (mode === 'native') input.dispatchEvent(new Event('change', { bubbles: true }));
    if (mode === 'disconnected') input.isConnected = false;
    input.dispatchEvent(new Event('blur'));
    assert.equal(changes, mode === 'disconnected' ? 0 : 1);
    input.dispatchEvent(new Event('blur'));
    assert.equal(changes, mode === 'disconnected' ? 0 : 1);
  }
});

test('multiple insertions before blur still commit through only one change notification', () => {
  const input = new Input('=1', 2); let changes = 0;
  input.addEventListener('change', () => changes++);
  insertion.insert(input, 'd1'); insertion.insert(input, 'd2');
  assert.equal(changes, 0);
  input.dispatchEvent(new Event('blur')); assert.equal(changes, 1);
  input.dispatchEvent(new Event('blur')); assert.equal(changes, 1);
});

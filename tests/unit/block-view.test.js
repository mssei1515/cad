const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/ui/block_view.js', 'utf8'), sandbox);
function fixture() {
  const elements = {}, calls = [];
  for (const id of ['blockList', 'blockOverlayTitle', 'blockEditorOverlay', 'blockEditorNameInput', 'blockEditorActions', 'openBlockDefinitionsBtn', 'completeBlockEditBtn', 'cancelBlockEditBtn', 'blockDefinitionsDialog']) {
    elements[id] = { events: {}, addEventListener(type, fn) { this.events[type] = fn; }, showModal() { calls.push('show'); }, close() { calls.push('close'); } };
  }
  const document = { getElementById: id => elements[id], querySelectorAll: () => [] };
  let editing = { name: 'original' };
  const view = sandbox.window.BlockView.create({ document, escapeHtml: value => value.replaceAll('<', '&lt;'),
    readEditing: () => editing, blockDefinitionsInCurrentScope: () => [{ id: 'B1', name: '<name>' }],
    blockDefinitionUsageCount: () => 2, selectedDefinitionIds: () => [],
    refresh: () => calls.push('refresh'), localizeApplicationUI: () => calls.push('localize'),
    changeName: value => { calls.push(['name', value]); return !!editing; }, commitName: () => calls.push('commit'),
    completeBlockDefinitionEdit: () => calls.push('complete'), cancelBlockDefinitionEdit: () => calls.push('cancel') });
  return { elements, calls, document, view, setEditing: value => { editing = value; } };
}
test('Block view preserves focused name input and escapes definition names', () => {
  const f = fixture(); f.view.render();
  assert.equal(f.elements.blockEditorNameInput.value, 'original');
  assert.match(f.elements.blockList.innerHTML, /&lt;name>/);
  f.document.activeElement = f.elements.blockEditorNameInput;
  f.elements.blockEditorNameInput.value = 'typing'; f.view.render();
  assert.equal(f.elements.blockEditorNameInput.value, 'typing');
  f.setEditing(null); f.view.render();
  assert.equal(f.elements.blockEditorOverlay.hidden, true);
  assert.equal(f.elements.blockOverlayTitle.textContent, 'ブロック');
});
test('Block view delegates editing and refreshes and localizes before showing dialog', () => {
  const f = fixture(); f.view.bind();
  f.elements.openBlockDefinitionsBtn.events.click();
  assert.deepEqual(f.calls, ['refresh', 'localize', 'show']);
  f.elements.blockEditorNameInput.events.input({ target: { value: '' } });
  f.elements.blockEditorNameInput.events.change();
  assert.deepEqual(f.calls.slice(3), [['name', ''], 'commit']);
  f.elements.completeBlockEditBtn.events.click(); f.elements.cancelBlockEditBtn.events.click();
  assert.deepEqual(f.calls.slice(-2), ['complete', 'cancel']);
});
test('Block view closes only an open list and owns the editor body class', () => {
  const f = fixture(), flags = [];
  f.document.body = { classList: { toggle: (name, active) => flags.push([name, active]) } };
  f.view.closeDefinitions(); assert.equal(f.calls.length, 0);
  f.elements.blockDefinitionsDialog.open = true; f.view.closeDefinitions();
  assert.deepEqual(f.calls, ['close']);
  f.view.setEditorActive(true); f.view.setEditorActive(false);
  assert.deepEqual(flags, [['block-editing', true], ['block-editing', false]]);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['document/appearance', 'ui/appearance_controls', 'ui/appearance_palette']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', `${file}.js`), 'utf8'), sandbox);
}
const appearance = sandbox.window.Appearance;
const controls = sandbox.window.AppearanceControls.create({ ...appearance,
  applicationText: (_ja, en) => en, escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('"', '&quot;'), formatDisplayNumber: String,
  dimensionLengthKeys: appearance.DIMENSION_APPEARANCE_LENGTH_KEYS, defaultDimensionAppearance: appearance.DEFAULT_DIMENSION_APPEARANCE });
test('appearance controls preserve inherited dimension options and normalize shorthand colors', () => {
  assert.equal(controls.colorPickerValue('#AbC'), '#aabbcc');
  assert.equal(controls.colorPickerValue('invalid'), '#111827');
  const effective = appearance.normalizeDimensionAppearance({ terminatorType: 'dot', suffix: '<x>' }, { partial: false });
  const html = controls.dimensionAppearancePropertyRows({}, effective);
  assert.ok(html.includes('data-terminator-angle-row hidden')); assert.ok(html.includes('&lt;x>'));
  const direct = controls.dimensionAppearancePropertyRows({ terminatorType: 'arrow' }, effective);
  assert.equal(direct.includes('data-terminator-angle-row hidden'), false);
});
function fixture() {
  const events = [], handlers = {};
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; handlers.close?.(); }, addEventListener: (name, fn) => { handlers[name] = fn; } };
  const docModel = { defaultAppearance: { color: '#111827' } };
  let target = null;
  const palette = sandbox.window.AppearancePalette.create({ document: { getElementById: id => id === 'colorPaletteDialog' ? dialog : null }, documentModel: docModel,
    currentScope: () => ({}), applicationText: (_ja, en) => en, escapeHtml: String, colorPickerValue: controls.colorPickerValue,
    localizeApplicationUI() {}, selectedPropertiesTarget: () => target, appearanceOwnerForPropertiesTarget: value => value.item.appearance,
    ...appearance, applyAppearanceInput: (owner, key, value) => { owner[key] = value; },
    multiplePropertyValue: () => '#111827', applyMultipleProperty: (value, key, color) => events.push(['multiple', value, key, color]),
    recordHistory: label => events.push(label), updateUI: () => events.push('ui'), draw: () => events.push('draw') });
  palette.bind();
  const button = { dataset: {}, closest: () => null, querySelector: () => null };
  return { palette, dialog, docModel, button, events, setTarget: value => { target = value; } };
}
test('closing cancels the palette session and committing a document color records exactly one change', () => {
  const f = fixture(); f.palette.open(f.button, 'document'); f.dialog.close(); f.palette.commit('#abc');
  assert.equal(f.docModel.defaultAppearance.color, '#111827'); assert.equal(f.events.length, 0);
  f.palette.open(f.button, 'document'); f.palette.commit('#abc');
  assert.equal(f.docModel.defaultAppearance.color, '#aabbcc');
  assert.deepEqual(f.events, ['Document Default Appearance変更', 'ui', 'draw']);
  f.palette.commit('#fff'); assert.equal(f.events.length, 3);
});
test('multiple selection color delegates one bulk commit after closing the palette', () => {
  const f = fixture(), target = { kind: 'multiple', items: [] }; f.setTarget(target);
  f.palette.open(f.button); f.palette.commit('#abc');
  assert.equal(f.dialog.open, false); assert.deepEqual(f.events, [['multiple', target, 'color', '#aabbcc']]);
});

const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
function fixture() {
  const events = [], fields = Object.fromEntries(['documentAppearanceFields', 'documentConstructionAppearanceFields', 'documentDimensionAppearanceFields', 'documentTerminatorAppearanceFields', 'documentLeaderAppearanceFields'].map(key => [key, {}]));
  const state = { button: new EventTarget(), scale: 2, defaults: { defaultAppearance: { color: 'red' }, defaultConstructionAppearance: {}, defaultDimensionAppearance: {}, defaultTerminatorAppearance: {}, defaultLeaderAppearance: {} }, failure: null };
  const clone = value => ({ ...value });
  const sandbox = { window: { Appearance: { normalizeAppearance: clone, normalizeConstructionAppearance: clone, normalizeDimensionAppearance: clone, dimensionDefaults: clone, normalizeTerminator: clone } } }; vm.createContext(sandbox);
  for (const file of ['src/commands/document_default_appearance_command.js', 'src/ui/document_appearance_settings.js', 'src/application/document_appearance_editor.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
  const document = { getElementById: id => id === 'documentSettingsBtn' ? state.button : id === 'documentSettingsDialog' ? { showModal: () => events.push('show') } : fields[id] };
  const editing = {
    applyAppearanceInput: (target, key, value) => { target[key] = value; }, applyDimensionAppearanceValue: (target, key, value) => { target[key] = value; },
    applyLeaderAppearanceValue(target, key, value, options) { assert.equal(this, editing); assert.equal(options.viewportScale, state.scale); target[key] = value; },
  };
  const editor = sandbox.window.DocumentAppearanceEditor.create({ document,
    readDefault: key => state.defaults[key], writeDefault: (key, value) => { state.defaults[key] = value; }, editing,
    appearanceControls: { terminatorPropertyRows: () => { events.push('terminal'); return 'terminal'; }, leaderAppearancePropertyRows: () => { events.push('leader'); return 'leader'; } },
    rows: { geometry: (value, effective, options) => { if (state.failure) throw state.failure; events.push(options.idPrefix); return JSON.stringify(value); }, dimension: () => { events.push('dimension'); return 'dimension'; } },
    prepareAffixInputs() {}, localizeApplicationUI() {}, updateDimensionTerminatorAngleVisibility() {},
    effectiveLeaderAppearanceForSketch: () => state.defaults.defaultLeaderAppearance, readViewportScale: () => state.scale,
    openAppearanceColorPalette: (button, target) => events.push(['palette', target]), recordHistory: label => events.push(['history', label]), updateUI: () => events.push('ui'), draw: () => events.push('draw'),
  });
  return { editor, state, fields, events };
}

test('Document appearance editor prepares all groups before opening and owns an idempotent removable listener', () => {
  const f = fixture(); assert.deepEqual(f.events, []); f.editor.start(); f.editor.start();
  f.state.button.dispatchEvent(new Event('click'));
  assert.deepEqual(f.events, ['documentProperty', 'documentConstructionProperty', 'dimension', 'terminal', 'leader', 'show']);
  const previous = f.state.button; f.editor.dispose(); f.state.button = new EventTarget(); f.events.length = 0;
  previous.dispatchEvent(new Event('click')); f.state.button.dispatchEvent(new Event('click')); assert.deepEqual(f.events, []);
  f.state.defaults.defaultAppearance = { color: 'blue' }; f.editor.start(); f.state.button.dispatchEvent(new Event('click'));
  assert.equal(JSON.parse(f.fields.documentAppearanceFields.innerHTML).color, 'blue'); assert.equal(f.events.at(-1), 'show');
});

test('composed appearance fields still use live defaults, viewport scale and original history/display sequencing', () => {
  const f = fixture(); f.editor.open(); f.events.length = 0;
  f.fields.documentAppearanceFields.onchange({ target: { dataset: { appearanceKey: 'color' }, value: ' green ' } });
  assert.equal(f.state.defaults.defaultAppearance.color, 'green');
  assert.deepEqual(f.events, [['history', 'Document Default Appearance変更'], 'ui', 'draw']);
  f.events.length = 0; f.state.scale = 5; f.state.defaults.defaultLeaderAppearance = {};
  f.fields.documentLeaderAppearanceFields.onchange({ target: { dataset: { leaderStyle: 'length' }, type: 'text', value: '8' } });
  assert.equal(f.state.defaults.defaultLeaderAppearance.length, '8');
  assert.deepEqual(f.events, ['terminal', 'leader', ['history', 'Document引出線外観変更'], 'ui', 'draw']);
  f.events.length = 0;
  f.fields.documentLeaderAppearanceFields.onclick({ target: { closest: () => ({}) } }); assert.deepEqual(f.events, [['palette', 'document-leader']]);
});

test('appearance preparation failure propagates without opening a partial dialog', () => {
  const f = fixture(), marker = new Error('prepare failed'); f.state.failure = marker;
  assert.throws(() => f.editor.open(), error => error === marker); assert.deepEqual(f.events, []);
});

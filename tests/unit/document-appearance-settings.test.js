const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/commands/document_default_appearance_command.js', 'src/ui/document_appearance_settings.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox);
}
function commandFixture() {
  const f = { defaults: {}, calls: [], fail: false };
  const normalize = kind => (value, options) => { assert.equal(options.partial, false); f.calls.push(['normalize', kind, value]); if (f.fail) throw new Error('normalize failed'); return { ...value, normalized: kind }; };
  f.command = sandbox.window.DocumentDefaultAppearanceCommand.createGeometry({
    readDefault: key => f.defaults[key], writeDefault: (key, value) => { f.calls.push(['write', key, value]); f.defaults[key] = value; },
    applyAppearanceInput: (value, key, raw) => { f.calls.push(['apply', value, key, raw]); value[key] = raw; },
    normalizeAppearance: normalize('normal'), normalizeConstructionAppearance: normalize('construction'),
    recordHistory: label => f.calls.push(['history', label]), updateUI: () => f.calls.push(['ui']), draw: () => f.calls.push(['draw']),
  });
  return f;
}
test('Geometry defaults mutate current objects, normalize through the right owner, then record and display', () => {
  const f = commandFixture();
  for (const [method, field, kind] of [['normal', 'defaultAppearance', 'normal'], ['construction', 'defaultConstructionAppearance', 'construction']]) {
    f.calls.length = 0; const original = {}; f.defaults[field] = original;
    f.command[method]('color', '#123456');
    assert.equal(f.calls[0][1], original); assert.equal(original.color, '#123456');
    assert.deepEqual(f.calls.map(call => call[0]), ['apply', 'normalize', 'write', 'history', 'ui', 'draw']);
    assert.equal(f.calls[1][1], kind); assert.equal(f.calls[1][2], original);
    assert.equal(f.defaults[field], f.calls[2][2]); assert.notEqual(f.defaults[field], original);
  }
});
test('normalization errors propagate without inventing rollback, history or display updates', () => {
  const f = commandFixture(), original = {}; f.defaults.defaultAppearance = original; f.fail = true;
  assert.throws(() => f.command.normal('lineWidth', '3'), /normalize failed/);
  assert.equal(f.defaults.defaultAppearance, original); assert.equal(original.lineWidth, '3');
  assert.deepEqual(f.calls.map(call => call[0]), ['apply', 'normalize']);
});
function viewFixture() {
  const f = { fields: { documentAppearanceFields: {}, documentConstructionAppearanceFields: {} },
    defaults: { defaultAppearance: { color: 'base', lineWidth: 2 }, defaultConstructionAppearance: { lineType: 'dashed' } }, calls: [], rows: [] };
  f.view = sandbox.window.DocumentAppearanceSettings.createGeometry({
    document: { getElementById: id => f.fields[id] }, readDefault: key => f.defaults[key],
    normalizeAppearance: value => ({ ...value }), normalizeConstructionAppearance: value => ({ ...value }),
    appearancePropertyRows: (direct, effective, options) => { f.rows.push({ direct, effective, options }); return options.idPrefix; },
    localizeApplicationUI: fields => f.calls.push(['localize', fields]),
    openAppearanceColorPalette: (button, target) => f.calls.push(['palette', button, target]),
    commands: { normal: (key, value) => f.calls.push(['normal', key, value]), construction: (key, value) => f.calls.push(['construction', key, value]) },
  });
  return f;
}
test('Geometry fields retain inheritance, key guards, trimming and palette targets while preparing latest defaults', () => {
  const f = viewFixture(); f.view.prepare();
  assert.equal(f.rows[0].direct, f.rows[0].effective);
  assert.equal(f.rows[0].options.allowInheritance, false);
  assert.equal(f.rows[1].effective.color, 'base'); assert.equal(f.rows[1].effective.lineType, 'dashed');
  assert.equal(f.rows[1].options.constructionEndpoints, true);
  f.calls.length = 0;
  f.fields.documentAppearanceFields.onchange({ target: { dataset: {}, get value() { throw new Error('invalid key must skip value'); } } });
  assert.equal(f.calls.length, 0);
  f.fields.documentAppearanceFields.onchange({ target: { dataset: { appearanceKey: 'color' }, value: ' red ' } });
  f.fields.documentConstructionAppearanceFields.onchange({ target: { dataset: { appearanceKey: 'lineType' }, value: ' dashed ' } });
  assert.deepEqual(f.calls, [['normal', 'color', 'red'], ['construction', 'lineType', 'dashed']]);
  const button = {}; f.fields.documentConstructionAppearanceFields.onclick({ target: { closest: () => button } });
  assert.deepEqual(f.calls.at(-1), ['palette', button, 'document-construction']);
  f.defaults.defaultAppearance = { color: 'latest' }; f.view.prepare();
  assert.equal(f.rows.at(-1).effective.color, 'latest');
});
test('missing Geometry fields skip normalization, markup and handler setup', () => {
  const f = viewFixture(); f.fields = {}; f.view.prepare();
  assert.equal(f.calls.length, 0); assert.equal(f.rows.length, 0);
});

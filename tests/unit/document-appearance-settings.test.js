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

test('Dimension defaults apply live values without inheritance and distinguish preview from committed history', () => {
  let defaults = {}, calls = [];
  const command = sandbox.window.DocumentDefaultAppearanceCommand.createDimension({
    readDefault: key => { assert.equal(key, 'defaultDimensionAppearance'); return defaults; },
    writeDefault: (key, value) => { assert.equal(key, 'defaultDimensionAppearance'); calls.push('write'); defaults = value; },
    applyDimensionAppearanceValue: (target, key, raw, options) => { assert.equal(target, defaults); assert.equal(options.allowInheritance, false); calls.push('apply'); target[key] = raw; },
    normalizeDimensionDefaults: value => { assert.equal(value, defaults); calls.push('normalize'); return { ...value }; },
    recordHistory: label => { assert.equal(label, 'Document Default Dimension Appearance変更'); calls.push('history'); }, draw: () => calls.push('draw'),
  });
  const prefix = '  first\nsecond  ';
  command.apply('prefix', prefix, { history: false });
  assert.equal(defaults.prefix, prefix); assert.deepEqual(calls, ['apply', 'normalize', 'write', 'draw']);
  calls = []; defaults = { suffix: 'new document' }; command.apply('suffix', '  tail  ');
  assert.equal(defaults.suffix, '  tail  '); assert.deepEqual(calls, ['apply', 'normalize', 'write', 'history', 'draw']);
});

function dimensionViewFixture() {
  const f = { field: {}, calls: [], defaults: { defaultDimensionAppearance: { color: 'dimension' }, defaultTerminatorAppearance: { color: 'terminal' } } };
  f.view = sandbox.window.DocumentAppearanceSettings.createDimension({
    document: { getElementById: () => f.field }, readDefault: key => f.defaults[key],
    normalizeDimensionAppearance: (value, options) => { assert.equal(options.partial, false); f.normalized = value; return value; },
    dimensionAppearancePropertyRows: (direct, effective, options) => { assert.equal(direct, effective); assert.equal(options.terminals, false); assert.equal(options.allowInheritance, false); f.calls.push('rows'); return 'rows'; },
    prepareAffixInputs: () => f.calls.push('affix'), localizeApplicationUI: () => f.calls.push('localize'),
    updateDimensionTerminatorAngleVisibility: () => f.calls.push('angle'), updateUI: () => f.calls.push('ui'),
    openAppearanceColorPalette: (button, target) => f.calls.push(['palette', button, target]),
    commands: { apply: (key, raw, options) => f.calls.push(['apply', key, raw, options.history]) },
  });
  return f;
}
test('Dimension input preserves multiline affixes and separates live input from change/update order', () => {
  const f = dimensionViewFixture(); f.view.prepare();
  assert.equal(f.normalized.color, 'terminal'); assert.deepEqual(f.calls, ['rows', 'affix', 'localize', 'angle']);
  const prefix = '  text\nnext  '; f.calls.length = 0;
  f.field.oninput({ target: { dataset: { dimensionDisplay: 'prefix' }, value: prefix } });
  assert.deepEqual(f.calls, [['apply', 'prefix', prefix, false]]);
  f.calls.length = 0; f.field.oninput({ target: { dataset: { dimensionDisplay: 'textHeight' }, value: ' 3 ' } });
  assert.equal(f.calls.length, 0);
  f.field.onchange({ target: { dataset: { dimensionDisplay: 'textHeight' }, value: ' 3 ' } });
  assert.deepEqual(f.calls, [['apply', 'textHeight', '3', true], 'angle', 'ui']);
  f.calls.length = 0;
  f.field.onchange({ target: { dataset: {}, get value() { throw new Error('invalid key must skip value'); } } });
  assert.deepEqual(f.calls, ['angle', 'ui']);
  const button = {}; f.field.onclick({ target: { closest: () => button } });
  assert.deepEqual(f.calls.at(-1), ['palette', button, 'document-dimension']);
});
test('missing Dimension field skips rendering and preparation dependencies', () => {
  const f = dimensionViewFixture(); f.field = null; f.view.prepare(); assert.equal(f.calls.length, 0);
});

test('shared defaults preserve object identity and refresh before history/UI/draw using live leader context', () => {
  const defaults = { defaultTerminatorAppearance: { retained: true }, defaultLeaderAppearance: {} }, calls = [];
  let scale = 2, effective = { color: 'old' };
  const command = sandbox.window.DocumentDefaultAppearanceCommand.createShared({
    readDefault: key => defaults[key], normalizeTerminator: value => { calls.push('normalize'); return value; },
    applyLeaderAppearanceValue: (target, key, value, options) => {
      assert.equal(target, defaults.defaultLeaderAppearance); assert.equal(options.viewportScale, scale); assert.equal(options.effective, effective);
      calls.push('leader'); target[key] = value;
    },
    readViewportScale: () => scale, effectiveLeaderAppearanceForSketch: id => { assert.equal(id, null); return effective; },
    recordHistory: label => calls.push(['history', label]), updateUI: () => calls.push('ui'), draw: () => calls.push('draw'),
  });
  const original = defaults.defaultTerminatorAppearance;
  command.terminal('color', 'red', () => { assert.equal(original.color, 'red'); calls.push('refresh'); });
  assert.equal(defaults.defaultTerminatorAppearance, original); assert.equal(original.retained, true);
  assert.deepEqual(calls, ['normalize', 'refresh', ['history', 'Document端末記号変更'], 'ui', 'draw']);
  calls.length = 0; scale = 4; effective = { color: 'latest' };
  command.leader('sizeLock', false, () => { assert.equal(defaults.defaultLeaderAppearance.sizeLock, false); calls.push('refresh'); });
  assert.deepEqual(calls, ['leader', 'refresh', ['history', 'Document引出線外観変更'], 'ui', 'draw']);
});

function sharedViewFixture() {
  const f = { terminal: {}, leader: {}, defaults: { color: 'terminal' }, effective: { color: 'leader' }, calls: [] };
  const controls = {
    terminatorPropertyRows(direct, effective, options) { assert.equal(this, controls); assert.equal(direct, f.defaults); assert.equal(direct, effective); assert.equal(options.attribute, 'data-terminal-style'); f.calls.push('terminalRows'); return 'terminal'; },
    leaderAppearancePropertyRows(direct, effective, options) { assert.equal(this, controls); assert.equal(direct, f.effective); assert.equal(direct, effective); assert.equal(options.terminals, false); f.calls.push('leaderRows'); return 'leader'; },
  };
  const changed = name => (key, value, refresh) => { f.calls.push([name, key, value]); refresh(); };
  f.view = sandbox.window.DocumentAppearanceSettings.createShared({
    document: { getElementById: id => id === 'documentTerminatorAppearanceFields' ? f.terminal : f.leader },
    readDefault: key => { assert.equal(key, 'defaultTerminatorAppearance'); return f.defaults; }, appearanceControls: controls,
    effectiveLeaderAppearanceForSketch: id => { assert.equal(id, null); return f.effective; },
    openAppearanceColorPalette: (button, target) => f.calls.push(['palette', button, target]),
    commands: { terminal: changed('terminal'), leader: changed('leader') },
  });
  return f;
}
test('shared fields guard keys, invert checkbox values, preserve other raw values and refresh both sections', () => {
  const f = sharedViewFixture(); f.view.prepare(); assert.deepEqual(f.calls, ['terminalRows', 'leaderRows']);
  f.calls.length = 0;
  f.terminal.onchange({ target: { dataset: {}, get value() { throw new Error('missing key must skip value'); } } });
  f.leader.onchange({ target: { dataset: {}, get type() { throw new Error('missing key must skip type'); } } });
  assert.equal(f.calls.length, 0);
  f.terminal.onchange({ target: { dataset: { terminalStyle: 'color' }, value: ' red ' } });
  assert.deepEqual(f.calls, [['terminal', 'color', ' red '], 'terminalRows', 'leaderRows']);
  f.calls.length = 0;
  f.leader.onchange({ target: { dataset: { leaderStyle: 'sizeLock' }, type: 'checkbox', checked: true } });
  assert.deepEqual(f.calls, [['leader', 'sizeLock', false], 'terminalRows', 'leaderRows']);
  f.calls.length = 0;
  f.leader.onchange({ target: { dataset: { leaderStyle: 'size' }, type: 'number', value: ' 9 ' } });
  assert.deepEqual(f.calls, [['leader', 'size', ' 9 '], 'terminalRows', 'leaderRows']);
  const button = {}; f.leader.onclick({ target: { closest: () => button } });
  assert.deepEqual(f.calls.at(-1), ['palette', button, 'document-leader']);
});
test('shared settings retain required-field failure instead of silently skipping missing sections', () => {
  const f = sharedViewFixture(); f.terminal = null;
  assert.throws(() => f.view.prepare(), /innerHTML/);
});

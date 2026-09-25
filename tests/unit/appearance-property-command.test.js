const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['document/appearance', 'editing/appearance_editing', 'commands/appearance_property_command']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', `${file}.js`), 'utf8'), sandbox);
}
const appearance = sandbox.window.Appearance;
function fixture() {
  const calls = [];
  const editing = sandbox.window.AppearanceEditing.create({ ...appearance,
    defaultDimensionAppearance: appearance.DEFAULT_DIMENSION_APPEARANCE,
    dimensionNumericRules: appearance.DIMENSION_APPEARANCE_NUMERIC_RULES });
  const command = sandbox.window.AppearancePropertyCommand.create({ editing, ...appearance,
    invalidateBlockProjectionCache: id => calls.push(`invalidate:${id}`),
    recordHistory: () => calls.push('history'), updateUI: () => calls.push('ui'),
    updatePropertiesUI: () => calls.push('properties'), draw: () => calls.push('draw') });
  return { command, calls };
}

test('block appearance previews invalidate projection without history and clearing a field restores inheritance', () => {
  const { command, calls } = fixture();
  const target = { kind: 'block', item: { id: 'B1' } };
  command.apply(target, { category: 'appearance', key: 'color', value: '#123456' }, { commit: false });
  assert.equal(target.item.appearanceOverride.color, '#123456');
  assert.deepEqual(calls, ['invalidate:B1', 'draw']); calls.length = 0;
  command.apply(target, { category: 'appearance', key: 'color', value: '' });
  assert.equal(Object.hasOwn(target.item.appearanceOverride, 'color'), false);
  assert.deepEqual(calls, ['invalidate:B1', 'history', 'ui', 'draw']);
});

test('dimension text preserves whitespace and caret while numeric changes refresh Properties', () => {
  for (const target of [{ kind: 'constraint', item: { dimension: {} } }, { kind: 'sketch', item: {} }]) {
    const { command, calls } = fixture();
    command.apply(target, { category: 'dimension', context: 'dimension', key: 'prefix', value: ' approx ' });
    const display = target.kind === 'constraint' ? target.item.dimension.display : target.item.dimensionAppearance;
    assert.equal(display.prefix, ' approx ');
    assert.deepEqual(calls, ['history', 'draw']); calls.length = 0;
    command.apply(target, { category: 'dimension', context: 'dimension', key: 'precision', value: '3' });
    assert.equal(display.precision, 3);
    assert.deepEqual(calls, ['history', 'properties', 'draw']);
  }
});

test('Sketch construction appearance uses its own layer and unsupported dimension targets remain untouched', () => {
  const { command, calls } = fixture();
  const target = { kind: 'sketch', item: { appearance: { color: '#112233' } } };
  command.apply(target, { category: 'appearance', context: 'construction', key: 'color', value: '#334455' });
  assert.equal(target.item.appearance.color, '#112233'); assert.equal(target.item.constructionAppearance.color, '#334455');
  assert.deepEqual(calls, ['history', 'ui', 'draw']); calls.length = 0;
  assert.equal(command.apply({ kind: 'constraint', item: {} }, { category: 'dimension', key: 'prefix', value: 'x' }), false);
  assert.deepEqual(calls, []);
});

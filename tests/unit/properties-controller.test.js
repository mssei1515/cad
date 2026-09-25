const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['commands/element_property_command', 'ui/properties_controller']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', `${file}.js`), 'utf8'), sandbox);
}
class Input {
  constructor(dataset, value, type = 'text') { Object.assign(this, { dataset, value, type, validity: { valid: true }, checked: false }); }
  closest() { return null; }
}
class TextArea extends Input {}
class Spline {}
function fixture(target) {
  const calls = [];
  const updates = { recordHistory: () => calls.push('history'), updateUI: () => calls.push('ui'), updatePropertiesUI: () => calls.push('properties'), draw: () => calls.push('draw') };
  const elements = sandbox.window.ElementPropertyCommand.create(updates);
  const controller = sandbox.window.PropertiesController.create({ ...updates,
    HTMLInputElement: Input, HTMLTextAreaElement: TextArea, Spline, selectedPropertiesTarget: () => target,
    elementPropertyCommand: elements,
    appearancePropertyCommand: { apply: (_target, request, options) => { calls.push({ request, options }); return true; } },
    geometryPropertyCommand: { setConstruction: () => ({ success: false, checked: false, refresh: 'properties' }) },
  });
  return { controller, elements, calls };
}

test('reference image lock protects geometry while allowing opacity; only successful commits create history', () => {
  const item = { locked: true, x: 10, opacity: 0.5, pixelWidth: 100, scale: 1 };
  const f = fixture({ kind: 'referenceImage', item });
  f.controller.input({ target: new Input({ referenceImageProperty: 'x' }, '20', 'number') });
  assert.equal(item.x, 10); assert.deepEqual(f.calls, ['draw']); f.calls.length = 0;
  f.controller.change({ target: new Input({ referenceImageProperty: 'x' }, '20', 'number') });
  assert.equal(item.x, 10); assert.deepEqual(f.calls, []);
  f.controller.change({ target: new Input({ referenceImageProperty: 'opacity' }, '80', 'number') });
  assert.equal(item.opacity, 0.8); assert.deepEqual(f.calls, ['history', 'ui', 'draw']); f.calls.length = 0;
  item.locked = false;
  f.elements.referenceImage(item, 'width', 250);
  assert.equal(item.scale, 2.5);
});

test('empty annotation text previews immediately and commits once without trimming whitespace', () => {
  const item = { text: 'old' }, f = fixture({ kind: 'annotation', item });
  const input = new TextArea({ property: 'annotation-text' }, '');
  f.controller.input({ target: input }); assert.equal(item.text, ''); assert.deepEqual(f.calls, ['draw']); f.calls.length = 0;
  input.value = ' a\n ';
  f.controller.change({ target: input }); assert.equal(item.text, ' a\n ');
  assert.deepEqual(f.calls, ['history', 'ui', 'draw']);
});

test('instance previews clamp copies without history and invalid commits restore the displayed values', () => {
  const item = { copies: 2 }, f = fixture({ kind: 'geometryInstance', item });
  const input = new Input({ geometryInstanceProperty: 'copies' }, '2000', 'number');
  f.controller.input({ target: input }); assert.equal(item.copies, 1000); assert.deepEqual(f.calls, ['draw']); f.calls.length = 0;
  input.value = '-1'; f.controller.change({ target: input });
  assert.equal(item.copies, 1000); assert.deepEqual(f.calls, ['properties']);
});

test('appearance routing rejects partial colors and invalid numeric previews but preserves dimension text', () => {
  const f = fixture({ kind: 'constraint', item: { dimension: {} } });
  const input = new Input({ dimensionDisplay: 'color' }, '#123');
  f.controller.input({ target: input }); assert.deepEqual(f.calls, []);
  input.value = '#123456'; f.controller.input({ target: input });
  assert.equal(f.calls[0].request.value, '#123456'); assert.equal(f.calls[0].options.commit, false); f.calls.length = 0;
  input.dataset = { dimensionDisplay: 'prefix' }; input.value = ' approx ';
  f.controller.change({ target: input }); assert.equal(f.calls[0].request.value, ' approx '); f.calls.length = 0;
  input.dataset = { dimensionDisplay: 'lineWidth' }; input.type = 'number'; input.value = '3'; input.validity.valid = false;
  f.controller.input({ target: input }); assert.deepEqual(f.calls, []);
});

test('rejected geometry edits restore the checkbox and refresh the panel without mutating the selected item', () => {
  const item = Object.freeze({ construction: false }), f = fixture({ kind: 'geometry', item });
  const input = new Input({ property: 'construction' }, '', 'checkbox'); input.checked = true;
  f.controller.change({ target: input });
  assert.equal(input.checked, false); assert.deepEqual(f.calls, ['properties', 'draw']);
});

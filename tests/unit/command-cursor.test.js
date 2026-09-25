const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/command_cursor.js'), 'utf8'), sandbox);
function fixture() {
  const writes = [], classes = new Set(), buttons = new Map();
  const button = (id, constraint = null) => {
    const value = { id, dataset: { constraint }, querySelector: () => ({ innerHTML: '<path d="M0 0L1 1"/>' }) };
    buttons.set(id, value); return value;
  };
  const fixed = button('fixPointBtn'), distance = button('', 'distance');
  for (const id of ['toolLine', 'toolSpline', 'toolFillet', 'annotationLeaderBtn']) button(id);
  const canvas = { dataset: {}, style: { setProperty: (name, value) => writes.push({ name, value }) }, classList: { add: value => classes.add(value) } };
  const cursor = sandbox.window.CommandCursor.create({ canvas, document: { getElementById: id => buttons.get(id) || null }, fixPointBtn: fixed, constraintButtons: [distance] });
  return { cursor, canvas, writes, classes, buttons };
}
test('fixed and pending commands take precedence over drawing modes', () => {
  const f = fixture();
  f.cursor.update({ constraintType: 'fixed', pendingType: 'distance-place', mode: 'line' });
  assert.equal(f.canvas.dataset.commandCursorSource, 'fixPointBtn');
  f.cursor.update({ pendingType: 'distance-value', mode: 'line' });
  assert.equal(f.canvas.dataset.commandCursorSource, 'constraint:distance');
  f.cursor.update({ pendingType: 'annotation-leader-place', mode: 'line' });
  assert.equal(f.canvas.dataset.commandCursorSource, 'annotationLeaderBtn');
  f.cursor.update({ splineEditing: true, mode: 'line' });
  assert.equal(f.canvas.dataset.commandCursorSource, 'toolSpline');
});
test('unchanged source does not rewrite CSS and selection restores the default cursor', () => {
  const f = fixture(); f.cursor.update({ mode: 'line' });
  const value = f.writes[0].value; assert.match(decodeURIComponent(value), /<svg/);
  f.cursor.update({ mode: 'line' }); assert.equal(f.writes.length, 1);
  f.cursor.update({ mode: 'select' }); assert.equal(f.writes.length, 2);
  assert.equal(f.canvas.dataset.commandCursorSource, undefined);
  assert.equal(f.classes.has('has-native-cursor'), true);
});
test('missing SVG leaves the current cursor untouched and caches stay per view', () => {
  const f = fixture(); f.cursor.update({ mode: 'line' });
  f.buttons.get('toolFillet').querySelector = () => null;
  f.cursor.update({ mode: 'fillet' }); assert.equal(f.writes.length, 1);
  assert.equal(f.canvas.dataset.commandCursorSource, 'toolLine');
  const other = fixture(); other.cursor.update({ mode: 'line' }); assert.equal(other.writes.length, 1);
});

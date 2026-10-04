const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/canvas_theme_colors.js'), 'utf8'), sandbox);
const colors = sandbox.window.CanvasThemeColors;
test('light theme and unsupported color syntax preserve the original value', () => {
  for (const value of ['#111827', '#AbC', 'red', 'rgb(1, 2, 3)', null]) assert.equal(colors.color(value, 'light'), value);
  for (const value of ['red', 'rgba(1,2,3,.5)', '#12345678', '#zzzzzz', null]) assert.equal(colors.color(value, 'dark'), value);
});
test('dark theme brightens low-contrast hex colors without altering legible colors', () => {
  const background = [15, 23, 42];
  for (const value of ['#000', '#111827', '#1d4ed8', '#dc2626']) {
    const adjusted = colors.color(value, 'dark');
    assert.notEqual(adjusted, value);
    assert.ok(colors.contrast(colors.channels(adjusted), background) >= 4.5);
    assert.equal(colors.color(adjusted, 'dark'), adjusted);
  }
  for (const value of ['#fff', '#FFFFFF', '#abcdef']) assert.equal(colors.color(value, 'dark'), value);
});
test('three-digit parsing and contrast retain the existing numeric definition', () => {
  assert.deepEqual(Array.from(colors.channels(' #AbC ')), [170, 187, 204]);
  assert.equal(colors.channels('#1234'), null);
  assert.equal(colors.contrast([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(colors.contrast([15, 23, 42], [15, 23, 42]), 1);
});

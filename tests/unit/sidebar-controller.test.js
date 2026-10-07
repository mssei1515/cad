const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/sidebar_controller.js'), 'utf8'), sandbox);
function element(data = {}) {
  const classes = new Set(); return { dataset: data, attrs: {}, listeners: {},
    classList: { contains: key => classes.has(key), toggle: (key, on) => on ? classes.add(key) : classes.delete(key) },
    setAttribute(key, value) { this.attrs[key] = value; }, addEventListener(key, fn) { this.listeners[key] = fn; }, click() { this.listeners.click(); } };
}
function fixture() {
  const app = element(), toggle = element(), tabs = ['a', 'b'].map(id => element({ sidebarTab: id })), panels = ['a', 'b'].map(id => element({ sidebarPanel: id })), hints = [];
  tabs[0].classList.toggle('active', true); panels[0].classList.toggle('active', true);
  sandbox.window.SidebarController.create({ document: { querySelector: () => app, getElementById: () => toggle, querySelectorAll: selector => selector === '[data-sidebar-tab]' ? tabs : panels }, setHint: hint => hints.push(hint) }).bind();
  return { app, toggle, tabs, panels, hints };
}
test('active tab collapses and reopens, while another tab changes only sidebar presentation', () => {
  const f = fixture(); f.tabs[0].click(); assert.equal(f.app.classList.contains('side-collapsed'), true);
  f.tabs[0].click(); assert.equal(f.app.classList.contains('side-collapsed'), false);
  f.tabs[1].click(); assert.equal(f.tabs[0].attrs['aria-selected'], 'false'); assert.equal(f.tabs[1].attrs['aria-selected'], 'true');
  assert.equal(f.panels[0].hidden, true); assert.equal(f.panels[1].hidden, false); assert.deepEqual(f.hints, []);
});
test('toggle updates accessible label, tooltip and user hint without switching tabs', () => {
  const f = fixture(); f.toggle.click(); assert.equal(f.toggle.attrs['aria-label'], 'サイドバーを開く'); assert.equal(f.toggle.dataset.tooltip, f.toggle.attrs.title);
  f.toggle.click(); assert.equal(f.toggle.attrs['aria-label'], 'サイドバーをたたむ'); assert.equal(f.tabs[0].classList.contains('active'), true);
  assert.deepEqual(f.hints, ['サイドバーをたたみました', 'サイドバーを表示しました']);
});

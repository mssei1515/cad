const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/properties_view.js'), 'utf8'), sandbox);

test('Properties restores section expansion while ignoring detached toggle events', () => {
  const events = {}, summaryEvents = {}, calls = [];
  const section = { dataset: { propertySection: 'general' }, open: false, isConnected: true,
    querySelector: () => ({ addEventListener: (key, fn) => { summaryEvents[key] = fn; } }),
    addEventListener: (key, fn) => { events[key] = fn; } };
  const panel = { innerHTML: '', querySelectorAll: () => [section] };
  const onInput = () => calls.push('input');
  const view = sandbox.window.PropertiesView.create({ document: { getElementById: () => panel },
    applicationText: (_ja, en) => en, content: () => '<section/>',
    localizeApplicationUI: () => calls.push('localize'), installExpressionInputHighlights: () => calls.push('highlight'), onInput });
  const html = () => view.collapsibleSketchAppearanceSection('general', '一般', 'General', 'content');
  view.render({ kind: 'sketch', item: {} });
  assert.deepEqual(calls, ['localize', 'highlight']);
  assert.equal(panel.oninput, onInput);
  assert.equal(html().includes(' open>'), false);
  summaryEvents.click();
  assert.equal(html().includes(' open>'), true);
  section.isConnected = false; events.toggle();
  assert.equal(html().includes(' open>'), true);
  section.isConnected = true; events.toggle();
  assert.equal(html().includes(' open>'), false);
});

test('Properties marks mixed checkboxes without editing targets or installing expression highlights', () => {
  const checkbox = {}, calls = [], target = Object.freeze({ kind: 'multiple', items: Object.freeze([]) });
  const panel = { querySelectorAll: () => [checkbox] };
  const view = sandbox.window.PropertiesView.create({ document: { getElementById: () => panel },
    content: value => { assert.equal(value, target); return 'mixed'; },
    localizeApplicationUI: () => calls.push('localize'), installExpressionInputHighlights: () => calls.push('highlight') });
  view.render(target);
  assert.equal(panel.innerHTML, 'mixed'); assert.equal(checkbox.indeterminate, true);
  assert.deepEqual(calls, ['localize']);
  view.render({ kind: 'sketch', item: null });
  assert.ok(panel.innerHTML.includes('properties-empty'));
  assert.deepEqual(calls, ['localize', 'localize']);
});

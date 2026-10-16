const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/command_panel.js'), 'utf8'), sandbox);
function fixture() {
  const state = { mode: 'select', annotation: false }, calls = [];
  function panel(name) {
    const api = { name };
    for (const method of ['readState', 'onAction', 'onSetting', 'onSelect', 'onRemove']) {
      api[method] = function (...args) { assert.equal(this, api); calls.push([name, method, ...args]); return api; };
    }
    return api;
  }
  const derived = panel('derived'), hatch = panel('hatch'), annotation = panel('annotation'), png = panel('png');
  derived.selectedItem = () => derived;
  png.active = false;
  const routing = sandbox.window.CommandPanel.createRouting({
    readMode: () => state.mode, isAnnotationActive: () => state.annotation,
    derivedPanel: derived, hatchPanel: hatch, annotationPanel: annotation, pngExportCommand: png,
  });
  return { state, calls, derived, hatch, annotation, png, routing };
}

test('command presentation routing follows current mode and annotation state with PNG taking priority', () => {
  const f = fixture(); assert.deepEqual(f.calls, []);
  assert.equal(f.routing.readState(), f.derived);
  for (const mode of ['hatch', 'hatch-repair']) { f.state.mode = mode; assert.equal(f.routing.readState(), f.hatch); }
  f.state.annotation = true; assert.equal(f.routing.readState(), f.annotation);
  f.png.active = true; assert.equal(f.routing.readState(), f.png);
  f.png.active = false; f.state.annotation = false; f.state.mode = 'instance-sources';
  assert.equal(f.routing.readState(), f.derived);
  assert.equal(f.routing.selectedItem, f.derived.selectedItem);
});

test('routing keeps receiver identity, result and exact action, setting and row arguments', () => {
  const f = fixture(); f.png.active = true; f.state.annotation = true;
  assert.equal(f.routing.onAction('finish'), f.png);
  assert.equal(f.routing.onSetting('transparent', false), f.png);
  assert.equal(f.routing.onSelect('source', null), f.annotation);
  assert.equal(f.routing.onRemove('source', 2), f.annotation);
  assert.deepEqual(f.calls, [['png', 'onAction', 'finish'], ['png', 'onSetting', 'transparent', false],
    ['annotation', 'onSelect', 'source', null], ['annotation', 'onRemove', 'source', 2]]);
  f.png.active = false; f.state.annotation = false; f.state.mode = 'hatch';
  assert.equal(f.routing.onAction('cancel'), f.hatch);
  assert.equal(f.routing.onSetting('pattern', 'solid'), f.hatch);
});

test('optional row events stay optional and dispatch reevaluates the active command each time', () => {
  const f = fixture(); delete f.hatch.onSelect; delete f.hatch.onRemove;
  f.state.mode = 'hatch';
  assert.equal(f.routing.onSelect('region', 0), undefined); assert.equal(f.routing.onRemove('region', 0), undefined);
  assert.deepEqual(f.calls, []);
  f.state.mode = 'select'; assert.equal(f.routing.onSelect('source', 1), f.derived);
  f.state.annotation = true; assert.equal(f.routing.onAction('finish'), f.annotation);
});

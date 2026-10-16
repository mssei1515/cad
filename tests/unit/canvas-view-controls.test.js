'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function fixture(ids = ['constraintStatusViewBtn', 'viewConstraintStatusInput', 'viewShowHiddenElementsInput', 'viewGeometryIdsInput']) {
  const events = [], browser = new EventTarget();
  const nodes = Object.fromEntries(ids.map(id => [id, new EventTarget()]));
  for (const node of Object.values(nodes)) {
    node.checked = false; node.attributes = {};
    node.classList = { toggle: (name, value) => { node[name] = value; } };
    node.setAttribute = (name, value) => { node.attributes[name] = value; };
  }
  const document = { getElementById: id => nodes[id] || null };
  const sandbox = { window: {} }; vm.createContext(sandbox);
  for (const file of ['constraint_status_view.js', 'canvas_view_controls.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui', file), 'utf8'), sandbox);
  }
  const controls = sandbox.window.CanvasViewControls.create({ document, window: browser,
    setHint: value => events.push(['hint', value]), draw: () => events.push(['draw', { ...controls.state }]),
  });
  function space(type = 'keyup') { const event = new Event(type, { cancelable: true }); event.code = 'Space'; return event; }
  return { controls, nodes, browser, events, space };
}

test('display options expose live read-only defaults and redraw after each checkbox change without history', () => {
  const f = fixture(), state = f.controls.state;
  assert.deepEqual({ ...state }, { constraintStatus: false, geometryIds: false, showHiddenElements: false });
  assert.equal(Object.isFrozen(state), true); assert.throws(() => { state.geometryIds = true; }, TypeError);
  assert.deepEqual(f.events, []); f.controls.bindControls(); f.controls.bindControls();
  for (const [id, key] of [['viewGeometryIdsInput', 'geometryIds'], ['viewShowHiddenElementsInput', 'showHiddenElements']]) {
    f.nodes[id].checked = true; f.nodes[id].dispatchEvent(new Event('change'));
    assert.equal(state[key], true); assert.equal(f.events.at(-1)[1][key], true);
    f.nodes[id].dispatchEvent(new Event('change'));
  }
  assert.equal(f.events.length, 4); assert.ok(f.events.every(e => e[0] === 'draw'));
});

test('constraint controls preserve mouse latch and held Space through release and blur', () => {
  const f = fixture(); f.controls.bindWindow(); f.controls.bindWindow(); f.controls.bindControls();
  f.nodes.constraintStatusViewBtn.dispatchEvent(new Event('click'));
  assert.equal(f.controls.state.constraintStatus, true); assert.equal(f.nodes.viewConstraintStatusInput.checked, true);
  assert.equal(f.nodes.constraintStatusViewBtn.attributes['aria-pressed'], 'true');
  f.controls.constraintStatus.hold(f.space('keydown'), false);
  f.nodes.viewConstraintStatusInput.checked = false; f.nodes.viewConstraintStatusInput.dispatchEvent(new Event('change'));
  assert.equal(f.controls.state.constraintStatus, true);
  const release = f.space(); f.browser.dispatchEvent(release);
  assert.equal(release.defaultPrevented, true); assert.equal(f.controls.state.constraintStatus, false);
  f.controls.constraintStatus.hold(f.space('keydown'), false); f.events.length = 0;
  f.browser.dispatchEvent(new Event('blur'));
  assert.equal(f.controls.state.constraintStatus, false); assert.deepEqual(f.events.map(e => e[0]), ['draw']);
  f.controls.constraintStatus.toggle(); f.controls.constraintStatus.hold(f.space('keydown'), false);
  f.browser.dispatchEvent(new Event('blur')); assert.equal(f.controls.state.constraintStatus, true);
});

test('dispose removes only owned listeners and rebinding preserves display values with one handler', () => {
  const f = fixture(); let external = 0; f.browser.addEventListener('keyup', () => external++);
  f.controls.bindWindow(); f.controls.bindControls();
  f.nodes.viewGeometryIdsInput.checked = true; f.nodes.viewGeometryIdsInput.dispatchEvent(new Event('change'));
  f.controls.dispose(); f.events.length = 0;
  f.nodes.constraintStatusViewBtn.dispatchEvent(new Event('click')); f.browser.dispatchEvent(f.space());
  assert.equal(external, 1); assert.deepEqual(f.events, []); assert.equal(f.controls.state.geometryIds, true);
  f.controls.bindControls(); f.controls.bindWindow(); f.nodes.constraintStatusViewBtn.dispatchEvent(new Event('click'));
  assert.equal(f.controls.state.constraintStatus, true); assert.deepEqual(f.events.map(e => e[0]), ['hint', 'draw']);
  f.controls.dispose(); f.controls.dispose();
});

test('optional controls may be absent while keyboard constraint display still releases', () => {
  const f = fixture([]); f.controls.bindControls(); f.controls.bindWindow();
  assert.equal(f.controls.constraintStatus.hold(f.space('keydown'), true), false);
  assert.equal(f.controls.constraintStatus.hold(f.space('keydown'), false), true);
  f.browser.dispatchEvent(f.space()); assert.equal(f.controls.state.constraintStatus, false); f.controls.dispose();
});

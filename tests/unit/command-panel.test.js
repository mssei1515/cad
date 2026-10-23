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

function featureFixture() {
  'use strict';
  const context = { window: {} }, events = [], queries = [];
  for (const file of ['src/ui/command_panel.js', 'src/ui/derived_command_panel.js', 'src/ui/hatch_command_panel.js',
    'src/ui/annotation_command_panel.js', 'src/document/annotation_anchor_data.js', 'src/commands/annotation_anchor_constraints.js']) {
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), context);
  }
  const created = {};
  for (const name of ['DerivedCommandPanel', 'HatchCommandPanel', 'AnnotationCommandPanel']) {
    const original = context.window[name].create;
    context.window[name] = { create: options => { events.push(name); return created[name] = original(options); } };
  }
  const state = { mode: 'sketch-projection', sketch: 'S1', fail: null }, item = { id: 'L1', sketchId: 'SOURCE' };
  const section = { setAttribute: (key, value) => events.push(['attribute', key, value]),
    addEventListener: type => events.push(['listen', type]) };
  const raw = (name, result) => function(...args) { assert.equal(this, undefined); events.push([name, ...args]);
    if (state.fail === name) throw state.error; return result; };
  const ports = {
    document: { createElement: tag => { events.push(['create', tag]); return section; } }, host: { append: node => { assert.equal(node, section); events.push('append'); } },
    readMode: () => { queries.push('mode'); return state.mode; }, sketchContext: {
      sketchName: function(id) { 'use strict'; assert.equal(this, undefined); return id; },
      activeSketchId: () => state.sketch, elementSketchId: value => value.sketchId,
    },
    projectionCommand: { get sources() { queries.push('sources'); return [{ key: 'L1', item }]; }, remove: raw('remove') },
    geometryCommand: {}, sourceCommand: {}, resolveGeometryRef: () => item, geometryRefForItem: value => value.id,
    applicationText: (ja, en) => en, formatDisplayNumber: String, finishProjection: raw('finishProjection'), finishSourceEdit: raw('finishSourceEdit', item),
    exitDrawMode: raw('exit'), changeFreeProperty: raw('changeFreeProperty'), updateUI: raw('ui'), updatePropertiesUI: raw('properties'), setHint: raw('hint'), draw: raw('draw'),
    hatchCommand: { regions: [], includeConstruction: false },
    annotationCommand: { active: false, draft: { style: {}, withLeader: false }, validContent: () => true, canFinish: () => true },
    effectiveAnnotationStyle: raw('style', {}), pngExportCommand: { active: false, readState() { events.push('png'); return { actions: [{ id: 'cancel' }] }; },
      onAction(action) { assert.equal(this, ports.pngExportCommand); events.push(['pngAction', action]); } },
  };
  const feature = context.window.CommandPanel.createFeature(ports);
  return { feature, ports, state, events, queries, section, item, created };
}

test('panel feature creates the real adapters before DOM without querying commands and keeps live selection and style scope', () => {
  const f = featureFixture();
  assert.deepEqual(f.queries, []);
  assert.deepEqual(f.events, ['DerivedCommandPanel', 'HatchCommandPanel', 'AnnotationCommandPanel', ['create', 'section'],
    ['attribute', 'aria-label', 'Command panel'], 'append', ['listen', 'click'], ['listen', 'input'], ['listen', 'change'], ['listen', 'keydown']]);
  assert.equal(f.feature.derivedPanel, f.created.DerivedCommandPanel);
  assert.equal(f.section.id, 'commandPanel'); assert.equal(f.section.hidden, true);
  const derived = f.feature.derivedPanel;
  assert.equal(derived.readState().message.startsWith('Destination: S1'), true);
  f.events.length = 0; derived.onSelect('sources', 0); assert.deepEqual(f.events, [['properties'], ['draw']]);
  assert.equal(derived.selectedItem(), f.item);
  derived.onRemove('sources', 0); assert.deepEqual(f.events.at(-1), ['remove', 0]);
  derived.onAction('finish'); assert.deepEqual(f.events.at(-1), ['finishProjection']);
  f.ports.annotationCommand.active = true; f.events.length = 0;
  for (const sketch of ['S2', 'S3']) { f.state.sketch = sketch; assert.equal(f.feature.commandPanel.active, true); assert.equal(f.events.at(-1)[1].sketchId, sketch); }
  assert.equal(f.ports.annotationCommand.draft.sketchId, undefined);
  f.ports.pngExportCommand.active = true; f.events.length = 0; f.queries.length = 0;
  assert.equal(f.feature.commandPanel.canvasDoubleClick(true), true);
  assert.deepEqual(f.events, ['png', ['pngAction', 'cancel']]); assert.deepEqual(f.queries, []);
});

test('panel feature preserves distinct source, derived and Hatch cancellation and stops on the original error', () => {
  const f = featureFixture(); f.events.length = 0;
  f.state.mode = 'instance-sources'; assert.equal(f.feature.derivedPanel.onAction('cancel'), f.item);
  assert.deepEqual(f.events, [['finishSourceEdit', false]]);
  f.state.mode = 'sketch-projection'; f.events.length = 0;
  assert.equal(f.feature.derivedPanel.onAction('cancel'), undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(f.events)), [['exit'], ['ui', { refreshAnalysis: false }], ['hint', 'Command canceled.'], ['draw']]);
  f.state.mode = 'hatch-repair'; f.events.length = 0;
  assert.equal(f.feature.commandPanel.canvasDoubleClick(true), true);
  assert.deepEqual(JSON.parse(JSON.stringify(f.events)), [['exit'], ['ui', { refreshAnalysis: false }], ['draw']]);
  f.state.error = new Error('UI failed'); f.state.fail = 'ui'; f.events.length = 0;
  assert.throws(() => f.feature.commandPanel.canvasDoubleClick(true), error => error === f.state.error);
  assert.deepEqual(JSON.parse(JSON.stringify(f.events)), [['exit'], ['ui', { refreshAnalysis: false }]]);
  f.state.mode = 'instance-sources'; f.state.fail = 'finishSourceEdit'; f.events.length = 0;
  assert.throws(() => f.feature.derivedPanel.onAction('cancel'), error => error === f.state.error);
  assert.deepEqual(f.events, [['finishSourceEdit', false]]);
});

const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
const sandbox = { window: {}, structuredClone }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/sketch_projection_test_driver.js'), 'utf8'), sandbox);
function fixture() {
  class Point { constructor(id,x,y) { Object.assign(this,{id,x,y}); } } class Line {} class Circle {} class Arc {} class Spline {}
  const events = [], state = { scope: { sketches: [] }, constraints: [], mode: 'select', staged: 0, data: { version: 26, constraints: [] }, history: {}, selected: null, properties: 'initial' };
  const ports = { types: { Point, Line, Circle, Arc, Spline }, currentScope: () => { events.push('scope'); return state.scope; },
    readMode: () => state.mode, readStagedCount: () => state.staged, readConstraints: () => state.constraints,
    constraintGeometryId: item => item.id, constraintSketchId: item => item.sketchId, effectiveAppearanceForElement: () => ({ color: 'black' }), geometryDisplayColor: () => 'black',
    constraintStatusOf: () => 'under', constraintStatusColor: () => 'blue', constraintIsRedundant: () => false,
    serializeModel: () => { events.push('serialize'); return state.data; }, readHistory: () => state.history,
    document: { getElementById: id => ({ textContent: id === 'propertiesPanel' ? state.properties : 'tree' }) },
    CURRENT_JSON_VERSION: 26, loadModelData: data => { events.push(['load',data.version]); state.data = data; }, updateUI: () => events.push('ui'), draw: () => events.push('draw'),
    clearSelection: () => events.push('clear'), canvasSelection: { set(field, values) { state.selected = { field, values }; events.push(['select',field]); } },
    clientPosition: point => ({ x: point.x + 10, y: point.y + 20 }),
    copySelectionToClipboard: () => { events.push('copy'); return true; }, pasteGeometryClipboard: () => { events.push('paste'); return true; }, clipboardSession: { payload: { constraints: [{ type: 'sketchProjection' }] } },
  };
  const support = sandbox.window.SketchProjectionTestDriver.createSupport(ports); assert.deepEqual(events, []);
  return { support, state, ports, events, Point };
}

test('projection support preserves all ordered public entries and performs no eager model reads', () => {
  const f = fixture();
  assert.deepEqual(Object.keys(f.support), [
    'resetForSketchProjectionTest', 'resetForSketchProjectionRectangleTest', 'resetForSketchProjectionSharedKindsTest', 'sketchProjectionEligibilityForTest',
    'resetForSketchProjectionBlockEditorTest', 'completeSketchProjectionBlockEditorForTest', 'resetForBlockProjectionSketchProjectionTest',
    'moveBlockProjectionSketchProjectionSourceForTest', 'deleteBlockProjectionSketchProjectionSourceForTest', 'sketchProjectionStateForTest',
    'moveSketchProjectionSourcesForTest', 'createSketchProjectionChainForTest', 'selectSketchProjectionTargetForTest', 'removeFirstSketchProjectionConstraintForTest',
    'setSketchProjectionAppearanceForTest', 'deleteSketchProjectionSourceGeometryForTest', 'deleteSketchProjectionTargetGeometryForTest', 'deleteSketchProjectionSourceSketchForTest',
    'copySketchProjectionTargetForTest', 'blockizeSketchProjectionTargetForTest', 'reloadSketchProjectionForTest',
  ]);
  assert.equal(Object.isFrozen(f.support), true); for (const value of Object.values(f.support)) assert.equal(typeof value, 'function');
  f.state.mode = 'sketch-project'; f.state.staged = 3; f.state.scope = { sketches: [{ id: 'S3', parentSketchId: 'S2' }] };
  const snapshot = f.support.sketchProjectionStateForTest(); assert.equal(snapshot.mode, 'sketch-project'); assert.equal(snapshot.stagedCount, 3); assert.equal(snapshot.sketches[0].id, 'S3');
  assert.equal(snapshot.history, f.state.history); assert.notEqual(snapshot.serialized, f.state.data);
});

test('projection reload and selection/transfer reuse the shared live observation', () => {
  const f = fixture(); f.state.properties = 'latest';
  const source = new f.Point('P1',0,0), target = new f.Point('P2',4,5);
  f.state.constraints = [{ kind: 'point', source, target, sketchId: 'S3', referenceSketchId: 'S2' }];
  const selected = f.support.selectSketchProjectionTargetForTest('point');
  assert.equal(selected.targetId, 'P2'); assert.equal(selected.propertiesText, 'latest'); assert.equal(selected.client.x, 14);
  assert.equal(f.state.selected.field, 'points'); assert.equal(f.state.selected.values[0], target);
  f.events.length = 0; const copied = f.support.copySketchProjectionTargetForTest('point');
  assert.equal(copied.copied, true); assert.equal(copied.pasted, true); assert.equal(copied.clipboardProjectionCount, 1);
  assert.ok(f.events.indexOf('copy') < f.events.indexOf('paste'));
  f.events.length = 0; const reloaded = f.support.reloadSketchProjectionForTest(25);
  assert.deepEqual(f.events.slice(0,4), ['serialize', ['load',25], 'ui', 'draw']);
  assert.equal(reloaded.serialized.version, 25); assert.equal(reloaded.propertiesText, 'latest');
});

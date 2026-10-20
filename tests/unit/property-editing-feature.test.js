const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture() {
  const calls = [], state = { ready: false, allowed: true, scope: { constraints: [] }, targets: [], hidden: false, solved: true };
  const notify = name => (...args) => { assert.equal(state.ready, true); calls.push([name, ...args]); };
  const feature = w.PropertyEditingFeature.create({
    currentScope: () => { assert.equal(state.ready, true); return state.scope; }, viewport: { scale: w.Appearance.CSS_PX_PER_MM * 2 },
    guardSketchProjectionShapeEdit: () => state.allowed, applicationText: (_ja, en) => en,
    synchronizeSketchProjectionMetadata: notify('sync'), snapshotModelState: () => { calls.push(['capture']); return { closed: state.item.closed }; },
    restoreModelState: snapshot => { state.item.closed = snapshot.closed; calls.push(['restore']); },
    stabilizeActiveParameterNamespace: id => { calls.push(['solve', id]); return { success: state.solved }; }, elementSketchId: item => item.sketchId,
    recordHistory: notify('history'), materializeAnchor: (item, options) => { calls.push(['anchor', item, options]); return { x: 12, y: 34 }; },
    annotationAppearance: { effectiveAnnotationStyle: item => item.style, effectiveLeaderAppearanceForSketch: sketch => sketch.leaderAppearance },
    invalidateBlockProjectionCache: notify('invalidate'), updateUI: notify('ui'), updatePropertiesUI: notify('properties'), draw: notify('draw'),
    propertySelection: w.PropertySelection.create({}), isGeometryMode: () => true, selectedVisibilityTargets: () => state.targets,
    selectionVisibilityIsHidden: () => state.hidden, toggleSketchVisibility: notify('sketch'), guardSelectionEdit: () => state.allowed,
  });
  assert.deepEqual(calls, []); state.ready = true;
  return { feature, state, calls };
}

test('composed geometry editing reads the current scope and restores its checkpoint without committing a failed solve', () => {
  const { feature, state, calls } = fixture();
  const item = state.item = { sketchId: 'S2', closed: false, curve: () => ({ valid: true }) };
  const tangent = Object.assign(Object.create(w.GeometrySolver.SplineLineTangentConstraint.prototype), { spline: item });
  state.scope = { constraints: [tangent] };
  assert.equal(feature.geometry.setSplineClosed(item, true).success, false);
  assert.equal(item.closed, false); assert.deepEqual(calls, []);
  state.scope = { constraints: [] }; state.solved = false;
  assert.equal(feature.geometry.setSplineClosed(item, true).success, false);
  assert.equal(item.closed, false); assert.deepEqual(calls, [['capture'], ['solve', 'S2'], ['restore']]);
  calls.length = 0; state.solved = true;
  assert.equal(feature.geometry.setSplineClosed(item, true).success, true);
  assert.equal(item.closed, true); assert.deepEqual(calls, [['capture'], ['solve', 'S2'], ['history', 'スプライン開閉変更']]);
});

test('mixed visibility shares ordinary and derived appearance mutation with one final history and preserves guards', () => {
  const { feature, state, calls } = fixture();
  const geometry = { kind: 'geometry', item: { appearance: { color: '#123456' } } };
  const derived = { kind: 'geometryInstance', item: { appearanceOverride: { color: '#abcdef' } } };
  state.targets = [geometry, derived]; state.allowed = false;
  feature.visibility.toggle(); assert.deepEqual(calls, []); assert.equal(geometry.item.appearance.visible, undefined);
  state.allowed = true; feature.visibility.toggle();
  assert.equal(geometry.item.appearance.visible, false); assert.equal(derived.item.appearanceOverride.visible, false);
  assert.equal(geometry.item.appearance.color, '#123456'); assert.equal(derived.item.appearanceOverride.color, '#abcdef');
  assert.deepEqual(calls, [['draw'], ['draw'], ['history', '選択図形の表示切替'], ['ui'], ['draw']]);
  state.hidden = true; calls.length = 0; feature.visibility.toggle();
  assert.equal(geometry.item.appearance.visible, true); assert.equal(derived.item.appearanceOverride.visible, true);
  assert.equal(calls.filter(call => call[0] === 'history').length, 1);
  calls.length = 0; state.targets = [{ kind: 'sketch', item: { id: 'S3' } }]; state.allowed = false;
  feature.visibility.toggle(); assert.deepEqual(calls, [['sketch', 'S3']]);
});

test('single and bulk external edits use the shared value conversion and preserve preview and commit boundaries', () => {
  const { feature, calls } = fixture();
  const block = { kind: 'block', item: { id: 'B1' } }, geometry = { kind: 'geometry', item: {} };
  feature.appearance.apply(block, { category: 'appearance', key: 'lineWidth', value: '25' }, { commit: false });
  assert.equal(block.item.appearanceOverride.lineWidth, 10); assert.deepEqual(calls, [['invalidate', 'B1'], ['draw']]);
  calls.length = 0; feature.applyMultiple({ kind: 'multiple', items: [block, geometry] }, 'lineWidth', '25');
  assert.equal(geometry.item.appearance.lineWidth, block.item.appearanceOverride.lineWidth);
  assert.deepEqual(calls, [['invalidate', 'B1'], ['history', '複数Objectプロパティ変更'], ['ui'], ['draw']]);
  const settings = {}; feature.appearanceEditing.applyAppearanceInput(settings, 'lineWidth', '25');
  assert.equal(settings.lineWidth, geometry.item.appearance.lineWidth);
  calls.length = 0; feature.appearance.apply(block, { category: 'appearance', key: 'lineWidth', value: '' });
  assert.equal(Object.hasOwn(block.item.appearanceOverride, 'lineWidth'), false);
  assert.deepEqual(calls, [['invalidate', 'B1'], ['history', 'Appearance Override変更'], ['ui'], ['draw']]);
});

test('element edits materialize anchors before clearing references and retain image preview restrictions', () => {
  const { feature, calls } = fixture(), item = { anchorConstraints: [{ id: 'A1' }] };
  feature.element.annotation(item, 'annotation-anchor-clear', true);
  assert.equal(item.x, 12); assert.equal(item.y, 34); assert.equal(Object.hasOwn(item, 'anchorConstraints'), false);
  assert.equal(calls[0][0], 'anchor'); assert.equal(calls[0][1], item); assert.equal(calls[0][2].capture, true);
  assert.deepEqual(calls.slice(1), [['history', '注記変更'], ['ui'], ['draw']]);
  calls.length = 0; const image = { locked: true, x: 5 };
  assert.equal(feature.element.referenceImage(image, 'x', '10'), false);
  assert.equal(image.x, 5); assert.deepEqual(calls, []);
  assert.equal(feature.element.referenceImage(image, 'opacity', '150', { commit: false }), true);
  assert.equal(image.opacity, 1); assert.deepEqual(calls, [['draw']]);
});

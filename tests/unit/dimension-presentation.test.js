const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/dimension_presentation.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/number_display.js'), 'utf8'), sandbox);
function labelFixture() {
  const calls = [], state = { readOnly: false, measured: 30.000005,
    display: { precision: null, prefix: '', suffix: '', toleranceUpper: '', toleranceLower: '' } };
  const api = sandbox.window.DimensionPresentation.createLabel({
    isReadOnlyDimension: constraint => { calls.push(['readonly', constraint]); return state.readOnly; },
    measuredDimensionValue: (target, dimension) => { calls.push(['measured', target, dimension]); return state.measured; },
    angleDegrees: radians => { calls.push(['angle', radians]); return Math.abs(radians * 180 / Math.PI); },
    constraintSketchId: constraint => { calls.push(['sketch', constraint]); return constraint.sketchId; },
    dimensionDisplayState: (dimension, sketchId) => { calls.push(['display', dimension, sketchId]); return state.display; },
    formatDimensionLabel: value => { calls.push(['format', value]); return sandbox.window.NumberDisplay.formatDimensionLabel(value); },
    formatMeasuredDimensionLabel: value => { calls.push(['measured-format', value]); return sandbox.window.NumberDisplay.formatMeasuredDimensionLabel(value); },
  });
  return { api, calls, state };
}

test('reference labels use the current measurement and measured rounding without reading the stored target', () => {
  const f = labelFixture(), target = { kind: 'angle', interval: true }, dimension = {};
  const constraint = { sketchId: 'owner', get target() { throw Error('reference label must not read target'); } };
  f.state.readOnly = true;
  assert.deepEqual(f.calls, []); assert.equal(f.api.label(constraint, target, dimension), '(30°)');
  assert.deepEqual(f.calls, [['readonly', constraint], ['measured', target, dimension], ['sketch', constraint], ['display', dimension, 'owner'], ['measured-format', 30.000005]]);
  f.calls.length = 0; f.state.measured = 42.125; f.state.display.precision = 2;
  assert.equal(f.api.label(constraint, target, dimension), '(42.13°)');
  assert.equal(f.calls.some(call => call[0].includes('format') || call[0] === 'angle'), false);
});

test('ordinary angle labels use absolute degrees while interval labels preserve signed degrees and lengths keep their value', () => {
  const f = labelFixture(), constraint = { target: -Math.PI / 2, sketchId: 'S1' }, dimension = {};
  assert.equal(f.api.label(constraint, { kind: 'angle' }, dimension), '90°');
  assert.equal(f.calls.filter(call => call[0] === 'angle').length, 1);
  f.calls.length = 0;
  assert.equal(f.api.label(constraint, { kind: 'angle', interval: true }, dimension), '-90°');
  assert.equal(f.calls.some(call => call[0] === 'angle' || call[0] === 'measured'), false);
  constraint.target = -30.000005;
  assert.equal(f.api.label(constraint, { kind: 'distance' }, dimension), '-30.000005');
  f.state.display.precision = 3;
  assert.equal(f.api.label(constraint, { kind: 'distance' }, dimension), '-30.000');
});

test('dimension labels preserve multiline affixes, one-sided tolerance and reference parentheses without changing display values', () => {
  const f = labelFixture(), constraint = { target: 5, sketchId: 'S2' }, target = { kind: 'distance' }, dimension = {};
  Object.assign(f.state.display, { prefix: 'A\n', suffix: 'mm', toleranceLower: '-0.2' });
  const before = JSON.stringify(f.state.display);
  assert.equal(f.api.label(constraint, target, dimension), 'A\n5mm +0/-0.2');
  assert.equal(JSON.stringify(f.state.display), before);
  f.state.display.toleranceUpper = '0.1'; f.state.display.toleranceLower = '';
  assert.equal(f.api.label(constraint, target, dimension), 'A\n5mm +0.1/-0');
  f.state.readOnly = true; f.state.measured = 5;
  assert.equal(f.api.label(constraint, target, dimension), '(A\n5mm +0.1/-0)');
});
function boundsFixture() {
  const calls = [], target = {}, dimension = {}, appearance = { visible: true }, layout = { text: { x: 10, y: 20 }, textAngle: Math.PI / 2, hitA: { x: -7, y: 0 } };
  const state = { active: true, visible: true, target, dimension, appearance, layout, label: 'one\ntwo\r\nthree', expression: true };
  function query(name, fn) { return (...args) => { calls.push([name, ...args]); return fn(...args); }; }
  const api = sandbox.window.DimensionPresentation.createSelectionBounds({
    isActiveSketchConstraint: query('active', () => state.active), isVisibleSketchId: query('sketch-visible', () => state.visible), constraintSketchId: query('sketch', c => c.sketchId),
    targetFromConstraint: query('target', () => state.target), defaultDimensionForTarget: query('default', () => state.dimension), effectiveDimensionAppearance: query('appearance', () => state.appearance),
    isVisibleValue: query('visible', value => value), dimensionLayout: query('layout', () => state.layout),
    dimensionTextDrawingMetrics: query('metrics', () => ({ gap: 2, height: 4 })), dimensionLabelForConstraint: query('label', () => state.label),
    dimensionTextWidth: query('width', () => 6), dimensionUsesExpression: query('expression', () => state.expression),
  });
  return { api, calls, state, target, dimension, appearance, layout };
}
test('selection bounds cover rotated multiline labels and shaft hits with current expression metrics and original references', () => {
  const h = boundsFixture(), constraint = { sketchId: 'S', dimension: h.dimension }; const bounds = h.api.read(constraint);
  assert.ok(Math.abs(bounds.x1 + 7) < 1e-10); assert.ok(Math.abs(bounds.y1) < 1e-10);
  assert.ok(Math.abs(bounds.x2 - 25.6) < 1e-10); assert.ok(Math.abs(bounds.y2 - 23) < 1e-10);
  assert.equal(h.calls.some(c => c[0] === 'default'), false);
  const layoutCall = h.calls.find(c => c[0] === 'layout'); assert.equal(layoutCall[1], h.target); assert.equal(layoutCall[2], h.dimension); assert.equal(layoutCall[3], h.appearance);
  const width = h.calls.find(c => c[0] === 'width'); assert.equal(width[1], h.state.label); assert.equal(width[2], h.appearance); assert.equal(width[3], true);
  h.calls.length = 0; h.layout.textAngle = 0; h.state.label = 'one'; h.layout.hitA = null; h.api.read(constraint);
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.read(constraint))), { x1: 7, y1: 14, x2: 13, y2: 18 });
});
test('selection bounds preserve visibility/target/layout short circuits and defer default dimension until needed', () => {
  for (const [field, value, last] of [['active', false, 'active'], ['visible', false, 'sketch-visible'], ['target', null, 'target'], ['appearance', { visible: false }, 'visible'], ['layout', null, 'layout']]) {
    const h = boundsFixture(); h.state[field] = value; assert.equal(h.api.read({ sketchId: 'S' }), null); assert.equal(h.calls.at(-1)[0], last);
  }
  const h = boundsFixture(); h.api.read({ sketchId: 'S' }); assert.equal(h.calls.find(c => c[0] === 'default')[1], h.target);
});
test('dimension layer observes live scope/interaction/export state, keeps order and suppresses editing marks in PNG', () => {
  const calls = [], a = { id: 'active', active: true, sketchId: 'A', dimension: {} }, b = { id: 'inactive', active: false, sketchId: 'B', dimension: {} }, hidden = { id: 'hidden', active: true, sketchId: 'hidden' };
  let scope = { constraints: [a, hidden, b] }, frame = null, pending = { type: 'distance-value', constraint: a }, hover = b, drag = null, status = true;
  const target = {}, defaultDimension = {}, selection = { inspectionContains(c) { assert.equal(this, selection); return false; }, constraintSelectedInCanvas(c) { assert.equal(this, selection); return false; } };
  const api = sandbox.window.DimensionPresentation.createLayer({ ctx: { save: () => calls.push(['save']), restore: () => calls.push(['restore']) }, currentScope: () => scope,
    isActiveSketchConstraint: c => c.active, isVisibleSketchId: id => id !== 'hidden', constraintSketchId: c => c.sketchId,
    targetFromConstraint: c => { calls.push(['target', c]); return c.noTarget ? null : target; }, defaultDimensionForTarget: () => defaultDimension,
    effectiveDimensionAppearance: () => ({ visible: true }), isVisibleValue: value => value, canvasSelection: selection,
    readHoverDimension: () => hover, readDraggedDimension: () => drag, readPending: () => pending, readExportFrame: () => frame, readConstraintStatus: () => status, inactiveColor: 'inactive',
    dimensionLabelForConstraint: c => c.id, dimensionUsesExpression: c => { calls.push(['expression', c]); return true; }, drawDimension: (...args) => calls.push(['draw', ...args]),
  });
  api.draw(); let draws = calls.filter(c => c[0] === 'draw'); assert.deepEqual(draws.map(c => c[3]), ['inactive', 'active']);
  assert.equal(draws[0][2], b.dimension); assert.equal(draws[0][5], true); assert.equal(draws[0][7], 'inactive');
  assert.equal(draws[1][2], a.dimension); assert.equal(draws[1][6].hidden, true); assert.equal(draws[1][9], true);
  assert.equal(calls.filter(c => c[0] === 'target').some(c => c[1] === hidden), false);
  assert.deepEqual(calls.filter(c => ['save', 'draw', 'expression', 'restore'].includes(c[0])).map(c => c[0]), ['save', 'expression', 'draw', 'restore', 'save', 'expression', 'draw', 'restore']);
  calls.length = 0; frame = {}; api.draw(); draws = calls.filter(c => c[0] === 'draw');
  for (const d of draws) { assert.equal(d[5], false); assert.equal(d[6], null); assert.equal(d[7], null); assert.equal(d[9], false); } assert.equal(calls.some(c => c[0] === 'expression'), false);
  calls.length = 0; frame = null; pending = null; hover = null; drag = a; status = false; scope = { constraints: [a] }; api.draw();
  assert.equal(calls.filter(c => c[0] === 'draw').length, 1); assert.equal(calls.find(c => c[0] === 'draw')[5], true);
});

function painterFixture() {
  const calls = [], layout = { signed: -Math.PI / 2, radius: 2 }, appearance = { terminatorSize: 4 }, plan = {}, arc = {}, extensions = [];
  const state = { active: 'A', layout, angleLayout: layout, outside: true };
  const renderer = { drawLinear(payload) { assert.equal(this, renderer); calls.push(['linear', payload]); return 'ignored'; }, drawAngle(payload) { assert.equal(this, renderer); calls.push(['angle-draw', payload]); return 'ignored'; } };
  const painter = sandbox.window.DimensionPresentation.createPainter({ renderer, activeSketchId: () => { calls.push(['active']); return state.active; }, outsideShaftLengthFactor: 1.5,
    effectiveDimensionAppearance: (...args) => { calls.push(['appearance', ...args]); return appearance; },
    dimensionLayout: (...args) => { calls.push(['layout', ...args]); return state.layout; },
    layouts: { linearDimensionRenderPlan: (...args) => { calls.push(['plan', ...args]); return plan; }, arcRadiusDimensionExtensionSegment: (...args) => { calls.push(['arc', ...args]); return arc; },
      angleDimensionLayout: (...args) => { calls.push(['angle-layout', ...args]); return state.angleLayout; }, angleDimensionExtensionSegments: (...args) => { calls.push(['extensions', ...args]); return extensions; } },
    metrics: { shouldPlaceDimensionTerminatorsOutside: (...args) => { calls.push(['outside', ...args]); return state.outside; }, dimensionMillimetersToWorld: (...args) => { calls.push(['world', ...args]); return 12; } },
  });
  return { painter, calls, state, layout, appearance, plan, arc, extensions };
}
test('dimension painter preserves missing target/layout short circuits and live default Sketch evaluation', () => {
  const h = painterFixture(); assert.equal(h.painter.drawDimension(null, {}), undefined); assert.deepEqual(h.calls.map(c => c[0]), ['active']);
  h.calls.length = 0; h.state.layout = null; const target = { kind: 'radius' }, dimension = {};
  h.painter.drawDimension(target, dimension, 'R'); assert.deepEqual(h.calls.map(c => c[0]), ['active', 'appearance', 'layout']); assert.equal(h.calls[1][2], 'A');
  h.calls.length = 0; h.state.angleLayout = null; h.painter.drawDimension({ kind: 'angle' }, dimension, 'a'); assert.deepEqual(h.calls.map(c => c[0]), ['active', 'angle-layout']);
  h.calls.length = 0; h.state.active = 'B'; h.painter.drawAngleDimension(target, dimension, 'a'); assert.deepEqual(h.calls.map(c => c[0]), ['active', 'angle-layout']);
});
test('linear dimension painter passes unchanged layout/plan/extension/flags to its renderer in the original order', () => {
  const h = painterFixture(), target = { kind: 'radius' }, dimension = {}, editState = { hidden: true };
  assert.equal(h.painter.drawDimension(target, dimension, 'R5', true, true, editState, 'color', 'explicit', true), undefined);
  assert.deepEqual(h.calls.map(c => c[0]), ['appearance', 'layout', 'plan', 'arc', 'linear']);
  assert.equal(h.calls[0][1], dimension); assert.equal(h.calls[0][2], 'explicit'); assert.equal(h.calls[1][1], target); assert.equal(h.calls[1][3], h.appearance);
  assert.equal(h.calls[2][5], dimension); assert.equal(h.calls[2][6], true);
  const payload = h.calls.at(-1)[1]; assert.equal(payload.layout, h.layout); assert.equal(payload.renderPlan, h.plan); assert.equal(payload.arcExtension, h.arc); assert.equal(payload.appearance, h.appearance); assert.equal(payload.editState, editState);
  assert.equal(payload.label, 'R5'); assert.equal(payload.preview, true); assert.equal(payload.highlighted, true); assert.equal(payload.colorOverride, 'color'); assert.equal(payload.expressionMark, true);
});
test('angle painter keeps span sign handling, outside shaft conversion/radius clamp and inside conversion short circuit', () => {
  const h = painterFixture(), target = { kind: 'angle' }, dimension = {};
  h.painter.drawDimension(target, dimension, '90°', false, false, null, null, null, true);
  assert.deepEqual(h.calls.map(c => c[0]), ['angle-layout', 'appearance', 'extensions', 'outside', 'world', 'angle-draw']);
  assert.equal(h.calls[1][2], null); assert.equal(h.calls[3][1], Math.PI); assert.equal(h.calls[3][5], true); assert.equal(h.calls[4][1], 6); assert.equal(h.calls[4][2], h.appearance);
  let payload = h.calls.at(-1)[1]; assert.equal(payload.layout, h.layout); assert.equal(payload.extensions, h.extensions); assert.equal(payload.outside, true); assert.equal(payload.arcExtension, 6); assert.equal(payload.expressionMark, true);
  h.calls.length = 0; h.layout.radius = 0; h.painter.drawAngleDimension(target, dimension, 'a'); assert.equal(h.calls.at(-1)[1].arcExtension, 12 / 1e-12);
  h.calls.length = 0; h.state.outside = false; h.painter.drawAngleDimension(target, dimension, 'a'); payload = h.calls.at(-1)[1]; assert.equal(payload.arcExtension, 0); assert.equal(h.calls.some(c => c[0] === 'world'), false);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/dimension_presentation.js'), 'utf8'), sandbox);
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

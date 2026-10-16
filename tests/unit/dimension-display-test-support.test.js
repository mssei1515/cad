const assert = require('node:assert/strict'); const fs = require('node:fs');
const path = require('node:path'); const vm = require('node:vm'); const test = require('node:test');
const sandbox = { window: {}, structuredClone }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/dimension_test_driver.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], selected = {}, hovered = {}, state = { doc: { defaultDimensionAppearance: { terminatorSize: 1, prefix: 'old' }, defaultTerminatorAppearance: { terminatorSize: 2 }, blockDefinitions: [] }, scope: { constraints: [], sketches: [{ id:'S2', dimensionAppearance:{} }] }, failure: null };
  const selection = { dimensionConstraint: selected, constraint: selected, set(key,value) { assert.equal(this,selection); this[key] = value; } };
  const hover = { current: { dimension: hovered }, update(patch) { assert.equal(this,hover); Object.assign(this.current,patch); } };
  const ctx = { strokeStyle:'', stroke() { calls.push('stroke'); } };
  const ports = { readDocument: () => { calls.push('document'); return state.doc; }, currentScope: () => state.scope, isDimensionConstraint: () => false, activeSketchId: () => 'S2',
    normalizeDimensionAppearance: value => ({...value}), effectiveDimensionAppearanceForSketch: () => ({}),
    viewport: { scale:2 }, screenPxPerMm:3, fitMarginFactor:4,
    layouts: { linearDimensionRenderPlan: (target,layout,label,appearance) => { calls.push(['plan',appearance.prefix]); return { outside:false, shafts:[] }; } },
    metrics: { linearDimensionTerminatorDirections: () => ({ first:1, second:-1 }), dimensionTextWidth: () => 5 },
    formatDimensionLabel: value => 'D'+value, formatMeasuredDimensionLabel: value => 'M'+value,
    canvasSelection:selection, canvasHover:hover, ctx,
    drawDimensions: () => { assert.equal(selection.dimensionConstraint,null); assert.equal(hover.current.dimension,null); ctx.strokeStyle='RED'; ctx.stroke(); if(state.failure) throw state.failure; },
  };
  const support = sandbox.window.DimensionTestDriver.createDisplaySupport(ports); assert.deepEqual(calls, []);
  return { support, state, calls, ports, selected, hovered };
}

test('display support keeps eight API names in their ordered groups without eager measurements', () => {
  const f = fixture();
  assert.deepEqual(Object.keys({ ...f.support.appearance, ...f.support.cases }), ['dimensionAppearanceStateForTest','arcRadiusDimensionRenderPlanForTest','dimensionAppearanceRenderMetricsForTest','dimensionTerminatorFitForTest','dimensionArrowTipAlignmentForTest','drawnDimensionColorsForTest','dimensionDisplayPrecisionCases','dimensionTextAngleCases']);
  for(const group of Object.values(f.support)) { assert.equal(Object.isFrozen(group),true); for(const fn of Object.values(group)) assert.equal(typeof fn,'function'); }
  const cases = f.support.cases.dimensionDisplayPrecisionCases(); assert.equal(cases.integerTrailingZero,'D140'); assert.equal(cases.measuredMinimumResolution,'M0.000001');
});

test('appearance and terminator measurements follow live merged Document defaults and viewport scale', () => {
  const f = fixture();
  let appearance = f.support.appearance.dimensionAppearanceStateForTest(); assert.equal(appearance.documentDefault.terminatorSize,2);
  let fit = f.support.appearance.dimensionTerminatorFitForTest(100,'label'); assert.equal(fit.fitMargin,24); assert.equal(fit.textWidth,10);
  f.state.doc = { defaultDimensionAppearance:{prefix:'new'}, defaultTerminatorAppearance:{terminatorSize:5}, blockDefinitions:[] }; f.ports.viewport.scale=3;
  appearance=f.support.appearance.dimensionAppearanceStateForTest(); fit=f.support.appearance.dimensionTerminatorFitForTest(100,'label');
  assert.equal(appearance.documentDefault.prefix,'new'); assert.equal(appearance.documentDefault.terminatorSize,5); assert.equal(fit.fitMargin,60); assert.equal(fit.textWidth,15);
  assert.equal(f.calls.at(-1)[1],'new');
});

test('color observation preserves existing selection/hover and stroke restoration even when rendering fails', () => {
  const f = fixture(), stroke = f.ports.ctx.stroke;
  const colors=f.support.appearance.drawnDimensionColorsForTest(); assert.equal(colors[0],'red');
  assert.equal(f.ports.canvasSelection.dimensionConstraint,f.selected); assert.equal(f.ports.canvasHover.current.dimension,f.hovered); assert.equal(f.ports.ctx.stroke,stroke);
  const marker=new Error('render'); f.state.failure=marker;
  assert.throws(()=>f.support.appearance.drawnDimensionColorsForTest(),error=>error===marker);
  assert.equal(f.ports.canvasSelection.constraint,f.selected); assert.equal(f.ports.canvasHover.current.dimension,f.hovered); assert.equal(f.ports.ctx.stroke,stroke);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window, { Point, Line } = w.GeometrySolver;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fixture() {
  const model = w.DocumentState.create(), selection = w.CanvasSelection.create(), calls = [];
  const state = { ready: false, scope: model, operation: {}, controls: [{ disabled: false }], checkbox: {}, section: null };
  const panel = { innerHTML: '', querySelectorAll(selector) {
    if (selector === 'input, select, textarea, button') return state.controls;
    if (selector.includes('data-mixed')) return [state.checkbox];
    if (selector.includes('property-section-collapsible')) return state.section ? [state.section] : [];
    return [];
  }, insertAdjacentHTML(_where, html) { this.innerHTML = html + this.innerHTML; } };
  state.panel = panel;
  const document = { getElementById: id => { assert.equal(state.ready, true); assert.equal(id, 'propertiesPanel'); return state.panel; } };
  const applicationText = (_ja, en) => en, activeSketchId = () => state.scope.activeSketchId;
  const sketchById = id => model.sketches.find(s => s.id === id), isRootSketch = sketch => sketch?.kind === 'root';
  const sketchName = id => sketchById(id)?.name || id;
  const services = w.GeometryReadServices.create({ document: model, currentScope: () => { assert.equal(state.ready, true); return state.scope; },
    currentSketches: () => model.sketches, prepareBlocks() {}, elementSketchId: item => item?.sketchId,
    applicationText, hatchGeometryQuery: { resolvedHatchBoundary: () => ({ ok: false }), hatchPrimitivesFromElements: () => [], hatchPrimitivesForScope: () => [] },
    sketchById, isRootSketch, activeSketchId, showHiddenElements: () => false });
  const appearance = w.Appearance;
  const propertySelection = w.PropertySelection.create({ Point, Line, canvasSelection: selection, getOperation: () => state.operation,
    effectiveSelectedConstraint: selection.effectiveSelectedConstraint, selectedGeometryItems: selection.selectedGeometryItems,
    blockDefinitionById: services.catalog.blockDefinitionById, sketchById, activeSketchId,
    blockProjectionBundle: services.projections.blockProjectionBundle, effectiveAppearanceForElement: services.geometryAppearance.effectiveAppearanceForElement,
    documentModel: model, normalizeAppearance: appearance.normalizeAppearance, hatchAppearanceForDisplay: item => appearance.normalizeHatchAppearance(item.appearance),
    normalizeAnnotationStyle: appearance.normalizeAnnotationStyle, effectiveAnnotationStyle: services.annotationAppearance.effectiveAnnotationStyle,
    effectiveDimensionAppearance: services.dimensionAppearance.effectiveDimensionAppearance, isRootSketch,
    isDimensionConstraint: w.DimensionQueries.isDimensionConstraint, geometryInstanceBundle: services.reads.geometryInstanceBundle,
    resolveGeometryAppearance: appearance.resolveGeometryAppearance });
  const controls = w.AppearanceControls.create({ applicationText, escapeHtml, formatDisplayNumber: w.NumberDisplay.formatDisplayNumber,
    normalizeAppearance: appearance.normalizeAppearance, normalizeDimensionAppearance: appearance.normalizeDimensionAppearance,
    dimensionLengthKeys: appearance.DIMENSION_APPEARANCE_LENGTH_KEYS, defaultDimensionAppearance: appearance.DEFAULT_DIMENSION_APPEARANCE });
  const controller = {};
  for (const name of ['input', 'change', 'click']) controller[name] = function(event) { assert.equal(this, panel); calls.push([name, event]); };
  const view = w.PropertiesDisplay.create({ document, documentModel: model, currentScope: () => state.scope, canvasSelection: selection,
    getOperation: () => state.operation, propertySelection, geometryAppearance: services.geometryAppearance,
    dimensionAppearance: services.dimensionAppearance, annotationAppearance: services.annotationAppearance,
    catalog: services.catalog, projections: services.projections, instances: services.instances, geometryReads: services.reads,
    appearanceControls: controls, controller, sketchName, sketchById, isRootSketch, activeSketchId,
    constraintSketchId: c => c.sketchId || activeSketchId(), sketchProjectionConstraintForTarget: () => null,
    constraintGeometryId: item => item?.id, constraintStatusBadge: () => '', constraintStatusOf: () => 'stable',
    snappedBlockRotation: value => value, constraintDefiningGeometryEntries: () => [],
    hatchAppearanceForDisplay: item => appearance.normalizeHatchAppearance(item.appearance), resolvedHatchBoundary: () => ({ ok: false }),
    applicationText, escapeHtml, hatchRegionErrorText: () => '', geometryInstanceTypeLabel: value => value,
    expressionInputValue: value => String(value || ''), numericDimensionExpression: c => String(c.target), localizedConstraintName: value => value,
    localizeApplicationUI: () => calls.push('localize'), installExpressionInputHighlights: () => calls.push('highlight') });
  function point(id, x = 1) { const item = Object.assign(new Point(id, x, 2), { sketchId: activeSketchId() }); state.scope.points.push(item); return item; }
  return { model, state, panel, calls, controller, view, selection, propertySelection, point };
}

test('Properties display construction defers DOM/data reads and uses live appearance without changing model data', () => {
  const f = fixture(); assert.deepEqual(f.calls, []); f.state.ready = true;
  const item = f.point('P<&>'), target = Object.freeze({ kind: 'geometry', item });
  const before = JSON.stringify(f.model); f.view.render(target);
  assert.match(f.panel.innerHTML, /P&lt;&amp;&gt;/); assert.match(f.panel.innerHTML, /X coordinate/);
  assert.equal(JSON.stringify(f.model), before); assert.equal(f.panel.oninput, f.controller.input);
  assert.equal(f.panel.onchange, f.controller.change); assert.equal(f.panel.onclick, f.controller.click);
  const event = {}; f.panel.oninput(event); assert.deepEqual(f.calls.at(-1), ['input', event]);
  f.model.defaultAppearance = { color: '#123456' }; f.view.render(target); assert.match(f.panel.innerHTML, /#123456/);
  const replacement = Object.assign(new Point('P<&>', 99, 2), { sketchId: item.sketchId });
  f.state.scope = { ...f.model, points: [replacement] }; f.view.render({ kind: 'geometry', item: replacement });
  assert.match(f.panel.innerHTML, /99/); assert.equal(item.x, 1);
});

test('the real mixed-value query and rows keep mixed controls and read-only state while rendering no model edits', () => {
  const f = fixture(); f.state.ready = true; const a = f.point('P1'), b = f.point('P2');
  a.appearance = { color: '#112233', visible: true }; b.appearance = { color: '#445566', visible: false };
  f.selection.set('points', [a, b]); const target = f.propertySelection.selectedPropertiesTarget(), before = JSON.stringify(f.model);
  f.view.render({ ...target, readOnly: true });
  assert.match(f.panel.innerHTML, /Mixed/); assert.match(f.panel.innerHTML, /Locked/); assert.equal(f.state.checkbox.indeterminate, true);
  assert.equal(f.state.controls[0].disabled, true); assert.equal(f.calls.includes('highlight'), false);
  assert.equal(JSON.stringify(f.model), before);
});

test('section callbacks use the same View state across renders and missing DOM short-circuits content reads', () => {
  const f = fixture(); f.state.ready = true; const handlers = {};
  f.state.section = { dataset: { propertySection: 'general' }, open: false, isConnected: true,
    querySelector: () => ({ addEventListener: (name, handler) => { handlers[name] = handler; } }), addEventListener() {} };
  const item = f.model.sketches.find(s => !isRoot(s)); function isRoot(sketch) { return sketch.kind === 'root'; }
  f.view.render({ kind: 'sketch', item }); assert.doesNotMatch(f.panel.innerHTML, /data-property-section="general"[^>]*\bopen/);
  handlers.click(); f.view.render({ kind: 'sketch', item });
  assert.match(f.panel.innerHTML, /data-property-section="general"[^>]*\bopen/);
  f.state.panel = null; assert.doesNotThrow(() => f.view.render({ get item() { throw Error('content must not be read'); } }));
});

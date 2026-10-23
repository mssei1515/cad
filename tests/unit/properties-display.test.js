const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window, { Point, Line } = w.GeometrySolver;
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
class Input {
  constructor(dataset, value, type = 'text') { Object.assign(this, { dataset, value, type, checked: false, validity: { valid: true } }); }
  closest() { return null; }
}
class TextArea extends Input {}
function fixture({ interactive = false, sharedScene = false, sharedOwners = false, featureComposition = false } = {}) {
  const model = w.DocumentState.create(), selection = w.CanvasSelection.create(), calls = [];
  const state = { ready: false, scope: model, operation: {}, controls: [{ disabled: false }], checkbox: {}, section: null };
  const panel = { innerHTML: '', querySelectorAll(selector) {
    if (selector === 'input, select, textarea, button') return state.controls;
    if (selector.includes('data-mixed')) return [state.checkbox];
    if (selector.includes('property-section-collapsible')) return state.section ? [state.section] : [];
    return [];
  }, insertAdjacentHTML(_where, html) { this.innerHTML = html + this.innerHTML; }, prepend(element) { state.ownership = element; } };
  state.panel = panel;
  const document = { getElementById: id => { assert.equal(state.ready, true); assert.equal(id, 'propertiesPanel'); return state.panel; },
    createElement: tag => { assert.equal(state.ready, true); assert.equal(tag, 'p'); return {}; } };
  const applicationText = (_ja, en) => en, activeSketchId = () => state.scope.activeSketchId;
  const sketchById = id => model.sketches.find(s => s.id === id), isRootSketch = sketch => sketch?.kind === 'root';
  const sketchName = id => sketchById(id)?.name || id;
  const sketchContext = { sketchName, sketchById, isRootSketch, activeSketchId, constraintSketchId: c => c.sketchId || activeSketchId() };
  const services = w.GeometryReadServices.create({ document: model, currentScope: () => { assert.equal(state.ready, true); return state.scope; },
    currentSketches: () => model.sketches, prepareBlocks() {}, elementSketchId: item => item?.sketchId,
    applicationText, hatchGeometryQuery: { resolvedHatchBoundary: () => ({ ok: false }), hatchPrimitivesFromElements: () => [], hatchPrimitivesForScope: () => [] },
    sketchById, isRootSketch, activeSketchId, showHiddenElements: () => false });
  const appearance = w.Appearance;
  const composition = featureComposition ? w.PropertiesDisplay.createFeature({ document, documentModel: model,
    currentScope: () => { assert.equal(state.ready,true); state.scopeReads = (state.scopeReads || 0) + 1; return state.scope; },
    canvasSelection: selection, readServices: services, sketchContext, hatchAppearanceForDisplay: item => appearance.normalizeHatchAppearance(item.appearance),
    selectionOperation: () => { assert.equal(state.ready,true); state.selectionReads = (state.selectionReads || 0) + 1; return state.selectionOperation || state.operation; } }) : null;
  const propertySelection = composition ? composition.selection : sharedScene ? w.PropertiesDisplay.createSelection({ canvasSelection: selection, getOperation: () => state.operation,
    documentModel: model, readServices: services, sketchContext, hatchAppearanceForDisplay: item => appearance.normalizeHatchAppearance(item.appearance) })
    : w.PropertySelection.create({ Point, Line, canvasSelection: selection, getOperation: () => state.operation,
    effectiveSelectedConstraint: selection.effectiveSelectedConstraint, selectedGeometryItems: selection.selectedGeometryItems,
    blockDefinitionById: services.catalog.blockDefinitionById, sketchById, sketchName, activeSketchId,
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
  const notify = name => (...args) => { calls.push([name, ...args]); };
  const propertyEditing = {
    appearance: { apply: (...args) => { calls.push(['appearance', ...args]); return true; } },
    geometry: { setConstruction: (...args) => { calls.push(['construction', ...args]); return { checked: false, refresh: 'properties' }; } },
    element: { annotation: notify('annotation'), referenceImage: notify('image'), geometryInstance: notify('instance') },
    applyMultiple: notify('multiple'),
  };
  const interactivePorts = { propertyEditing, appearanceUI: { controls, openPalette: notify('palette') },
    HTMLInputElement: Input, HTMLTextAreaElement: TextArea, canEditStructure: item => { calls.push(['guard', item]); return state.structureAllowed !== false; },
    updateUI: () => calls.push('ui'), updatePropertiesUI: () => calls.push('properties'), draw: () => calls.push('draw'),
    setPlacementRotationLocked: notify('placement-lock'), setPlacementSketchIds: notify('placement-sketches'),
    startInstancePlacementEdit: (...args) => { calls.push(['placement-edit', ...args]); return 'placement-result'; }, setHint: notify('hint') };
  const build = interactive ? w.PropertiesDisplay.createWithController : w.PropertiesDisplay.create;
  const presentationPorts = { applicationText, constraintStatusBadge: () => '',
    expressionInputValue: value => String(value || ''), numericDimensionExpression: c => String(c.target),
    localizedConstraintName: value => value, localizeApplicationUI: () => calls.push('localize') };
  const ownerPorts = sharedOwners ? {
    applicationSettings: { applicationText, localizeApplicationUI: presentationPorts.localizeApplicationUI },
    constraintFeedback: { constraintStatusBadge: presentationPorts.constraintStatusBadge, localizedConstraintName: presentationPorts.localizedConstraintName },
    parameterNamespace: { expressionInputValue: presentationPorts.expressionInputValue, numericDimensionExpression: presentationPorts.numericDimensionExpression },
    blockPlacement: { setRotationLocked: interactivePorts.setPlacementRotationLocked, setEnabledSketchIds: interactivePorts.setPlacementSketchIds },
  } : presentationPorts;
  if (sharedOwners) { delete interactivePorts.setPlacementRotationLocked; delete interactivePorts.setPlacementSketchIds; }
  const scenePorts = interactive && sharedScene ? { readServices: services, sketchContext } : {
    geometryAppearance: services.geometryAppearance, dimensionAppearance: services.dimensionAppearance, annotationAppearance: services.annotationAppearance,
    catalog: services.catalog, projections: services.projections, instances: services.instances, geometryReads: services.reads,
    sketchName, sketchById, isRootSketch, activeSketchId, constraintSketchId: sketchContext.constraintSketchId };
  const viewOptions = { document, documentModel: model, currentScope: () => state.scope, canvasSelection: selection,
    getOperation: () => { if(featureComposition) { assert.equal(state.ready,true); state.viewReads = (state.viewReads || 0) + 1; } return state.operation; }, propertySelection, ...scenePorts,
    appearanceControls: controls, controller, sketchProjectionConstraintForTarget: () => null,
    constraintGeometryId: item => item?.id, constraintStatusOf: () => 'stable',
    snappedBlockRotation: value => value, constraintDefiningGeometryEntries: () => [],
    hatchAppearanceForDisplay: item => appearance.normalizeHatchAppearance(item.appearance), resolvedHatchBoundary: () => ({ ok: false }),
    ...ownerPorts, escapeHtml, hatchRegionErrorText: () => '', geometryInstanceTypeLabel: value => value,
    installExpressionInputHighlights: () => calls.push('highlight'),
    ...(interactive ? interactivePorts : {}) };
  const editor = composition ? composition.createEditing({ appearanceScope: () => { assert.equal(state.ready,true); return state.appearanceScope || state.scope; },
    viewport: { get scale() { assert.equal(state.ready,true); return 2; } }, checkpoint: { captureValues: () => ({}), restoreValues() {} },
    parameterStabilization: { stabilize: () => true }, guardSketchProjectionShapeEdit: () => true,
    synchronizeSketchProjectionMetadata() {}, materializeAnchor() {}, isGeometryMode: () => true, toggleSketchVisibility() {}, guardSelectionEdit: () => true,
    applicationSettings: ownerPorts.applicationSettings || { applicationText, localizeApplicationUI: presentationPorts.localizeApplicationUI }, escapeHtml,
    invalidateBlockProjectionCache: services.projections.invalidateBlockProjectionCache, recordHistory: notify('history'),
    updateUI: interactivePorts.updateUI, updatePropertiesUI: interactivePorts.updatePropertiesUI, draw: interactivePorts.draw }) : null;
  const view = editor ? editor.createView(viewOptions) : build(viewOptions);
  function point(id, x = 1) { const item = Object.assign(new Point(id, x, 2), { sketchId: activeSketchId() }); state.scope.points.push(item); return item; }
  return { model, state, panel, calls, controller, view, selection, propertySelection, point, services, sketchContext, composition, editor };
}

test('shared scene owners preserve mixed markup, current locks and interactive property routing without construction reads', () => {
  const results = [];
  for (const sharedScene of [false, true]) {
    const f = fixture({ interactive: true, sharedScene }); assert.deepEqual(f.calls, []); f.state.ready = true;
    const a = f.point('P1'), b = f.point('P2', 5); a.appearance = { color: '#123456' }; b.appearance = { color: '#abcdef' };
    const pending = { id: 'GI1', sketchId: a.sketchId }; f.state.operation = { freeInstancePlacement: pending };
    assert.equal(f.propertySelection.selectedPropertiesTarget().item, pending); f.state.operation = {};
    f.selection.set('points', [a, b]); const before = JSON.stringify(f.model);
    f.view.render(f.propertySelection.selectedDisplayTarget()); const mixedHTML = f.panel.innerHTML;
    assert.equal(JSON.stringify(f.model), before); f.calls.length = 0;
    f.panel.onchange({ target: new Input({ bulkProperty: 'color' }, ' #aabbcc ') });
    assert.equal(f.calls[0][1].items[0].item, a); assert.equal(f.calls[0][3], '#aabbcc');
    f.model.sketches.find(s => s.id === a.sketchId).locked = true;
    const target = f.propertySelection.selectedDisplayTarget(); assert.equal(target.readOnly, true);
    f.view.render(target); f.calls.length = 0;
    f.panel.onchange({ target: new Input({ appearanceKey: 'color' }, '#ffffff') }); assert.deepEqual(f.calls, []);
    results.push({ mixedHTML, lockedHTML: f.panel.innerHTML, ownership: f.state.ownership.textContent, model: JSON.stringify(f.model) });
  }
  assert.deepEqual(results[0], results[1]);
});

test('shared presentation owners preserve dimension markup, localization and placement actions', () => {
  const results = [];
  for (const sharedOwners of [false, true]) {
    const f = fixture({ interactive: true, sharedScene: true, sharedOwners });
    assert.deepEqual(f.calls, []); f.state.ready = true;
    const a = f.point('P1'), b = f.point('P2', 11);
    const constraint = new w.GeometrySolver.DistanceConstraint(a, b, 10);
    constraint.sketchId = a.sketchId; constraint.dimension = {};
    f.model.constraints.push(constraint);
    const before = JSON.stringify(f.model);
    f.view.render({ kind: 'constraint', item: constraint });
    assert.equal(JSON.stringify(f.model), before);
    const html = f.panel.innerHTML;
    assert.match(html, /10/); assert.ok(f.calls.includes('localize'));
    f.model.blockDefinitions.push({ id: 'BD1' });
    f.state.operation = { mode: 'block-place', blockPlacementDefinitionId: 'BD1' };
    f.calls.length = 0;
    f.panel.onchange({ target: new Input({ placementRotationMode: 'locked' }, '') });
    const input = new Input({ placementSketchId: 'S1' }, '');
    input.closest = () => ({ querySelectorAll: () => [{ dataset: { placementSketchId: 'S1' } }] });
    f.panel.onchange({ target: input });
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.filter(Array.isArray))), [['placement-lock', true],
      ['hint', 'Placement rotation is locked to 90° increments'], ['placement-sketches', ['S1']]]);
    results.push({ html, calls: f.calls });
  }
  assert.deepEqual(results[0], results[1]);
});

test('selection assembly defers owner queries, preserves receivers and arguments, and propagates appearance failures', () => {
  const f = fixture(), calls = [], marker = new Error('appearance failed'); let fail = false;
  const owner = name => ({ query() { assert.equal(this, owners[name]); const args = Array.from(arguments); calls.push([name, args]); if (fail) throw marker; return { color: '#123456' }; } });
  const owners = { geometry: owner('geometry'), annotation: owner('annotation'), dimension: owner('dimension') };
  owners.geometry.effectiveAppearanceForElement = owners.geometry.query;
  owners.annotation.effectiveAnnotationStyle = owners.annotation.query; owners.dimension.effectiveDimensionAppearance = owners.dimension.query;
  const query = w.PropertiesDisplay.createSelection({ canvasSelection: f.selection, getOperation: () => f.state.operation,
    documentModel: f.model, readServices: { ...f.services, geometryAppearance: owners.geometry, annotationAppearance: owners.annotation, dimensionAppearance: owners.dimension },
    sketchContext: f.sketchContext, hatchAppearanceForDisplay: () => ({}) });
  assert.deepEqual(calls, []); const item = { sketchId: 'S2', dimension: {} };
  query.multiplePropertyAppearance({ kind: 'geometry', item }); assert.equal(calls[0][1][0], item);
  query.multiplePropertyAppearance({ kind: 'annotation', item }); assert.deepEqual(calls[1][1], [item]);
  query.multiplePropertyAppearance({ kind: 'constraint', item }); assert.deepEqual(calls[2][1], [item.dimension, 'S2']);
  fail = true; assert.throws(() => query.multiplePropertyAppearance({ kind: 'geometry', item }), error => error === marker);
  assert.equal(item.sketchId, 'S2'); assert.equal(f.selection.points.length, 0);
});

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


test('interactive Panel reads fresh selection and routes appearance preview, commit and geometry feedback through the supplied editing owner', () => {
  const f = fixture({ interactive: true }); assert.deepEqual(f.calls, []); f.state.ready = true;
  const a = f.point('P1'), b = f.point('P2'); f.selection.set('points', [a]); f.view.render({ kind: 'geometry', item: a }); f.calls.length = 0;
  const input = new Input({ appearanceKey: 'color' }, '#123456'); f.panel.oninput({ target: input });
  assert.equal(f.calls[0][0], 'appearance'); assert.equal(f.calls[0][1].item, a); assert.equal(f.calls[0][2].value, '#123456'); assert.equal(f.calls[0][3].commit, false);
  f.selection.set('points', [b]); f.calls.length = 0; f.panel.onchange({ target: input });
  assert.equal(f.calls[0][0], 'appearance'); assert.equal(f.calls[0][1].item, b); assert.equal(f.calls[0][3].commit, true);
  f.calls.length = 0; const construction = new Input({ property: 'construction' }, '', 'checkbox'); construction.checked = true;
  f.panel.onchange({ target: construction }); assert.deepEqual(f.calls, [['construction', b, true], 'properties', 'draw']); assert.equal(construction.checked, false);
});

test('interactive Panel shares element and multiple editing routes and blocks input, change and click when the owning Sketch is locked', () => {
  const f = fixture({ interactive: true }); f.state.ready = true; const a = f.point('P1'), b = f.point('P2');
  f.view.render({ kind: 'geometry', item: a }); f.calls.length = 0;
  const note = { id: 'AN1', type: 'text', sketchId: a.sketchId }; f.selection.set('annotations', [note]);
  f.panel.oninput({ target: new TextArea({ property: 'annotation-text' }, 'next\nline') });
  assert.equal(f.calls[0][0], 'annotation'); assert.equal(f.calls[0][1], note); assert.equal(f.calls[0][2], 'annotation-text'); assert.equal(f.calls[0][3], 'next\nline'); assert.equal(f.calls[0][4].commit, false);
  f.selection.set('annotations', []); f.selection.set('points', [a, b]); f.calls.length = 0;
  f.panel.onchange({ target: new Input({ bulkProperty: 'color' }, ' #abcdef ') });
  assert.equal(f.calls[0][0], 'multiple'); assert.equal(f.calls[0][1].items[0].item, a); assert.equal(f.calls[0][1].items[1].item, b); assert.equal(f.calls[0][3], '#abcdef');
  f.model.sketches.find(sketch => sketch.id === a.sketchId).locked = true; f.calls.length = 0;
  const input = new Input({ appearanceKey: 'color' }, '#123456'); f.panel.oninput({ target: input }); f.panel.onchange({ target: input });
  assert.equal(f.panel.onclick({ target: { closest() { throw Error('locked actions must short-circuit'); } } }), false); assert.deepEqual(f.calls, []);
});

test('interactive Panel uses late placement state, propagates action results and guards, and opens the existing shared palette', () => {
  const f = fixture({ interactive: true }); f.state.ready = true; const point = f.point('P1'); f.view.render({ kind: 'geometry', item: point }); f.calls.length = 0;
  f.model.blockDefinitions.push({ id: 'BD1' }); f.state.operation = { mode: 'block-place', blockPlacementDefinitionId: 'BD1' };
  f.panel.onchange({ target: new Input({ placementRotationMode: 'locked' }, '') }); assert.deepEqual(f.calls[0], ['placement-lock', true]); assert.equal(f.calls.at(-1), 'draw');
  const instance = { id: 'FI1', sketchId: point.sketchId }; f.state.operation = { freeInstancePlacement: instance }; f.calls.length = 0;
  const action = { closest: selector => selector === '[data-property-action]' ? { dataset: { propertyAction: 'instance-anchor' } } : null };
  assert.equal(f.panel.onclick({ target: action }), 'placement-result'); assert.deepEqual(f.calls, [['guard', instance], ['placement-edit', instance, 'origin']]);
  f.state.structureAllowed = false; f.calls.length = 0; assert.equal(f.panel.onclick({ target: action }), false); assert.deepEqual(f.calls, [['guard', instance]]);
  f.state.operation = {}; f.selection.set('points', [point]); f.calls.length = 0;
  const button = { closest: () => null }; f.panel.onclick({ target: { closest: selector => selector === '[data-appearance-palette-open]' ? button : null } });
  assert.deepEqual(f.calls, [['palette', button, 'properties']]);
});

test('Properties feature shares the real query, editing owners and View while preserving live selection, preview and commit', () => {
  const f = fixture({ interactive: true, sharedScene: true, sharedOwners: true, featureComposition: true });
  assert.deepEqual(f.calls, []); assert.equal(f.state.selectionReads || 0, 0); assert.equal(f.state.viewReads || 0, 0);
  assert.equal(f.composition.selection, f.propertySelection); f.state.ready = true;
  const a = f.point('P1'), b = f.point('P2', 11); f.selection.set('points',[a]); f.view.render(f.propertySelection.selectedDisplayTarget());
  f.calls.length = 0; f.panel.oninput({ target: new Input({ appearanceKey: 'color' }, '#135790') });
  assert.equal(a.appearance.color,'#135790'); assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'history'),false);
  f.panel.onchange({ target: new Input({ appearanceKey: 'color' }, '#135790') });
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'history').length,1);
  f.selection.set('points',[b]); f.panel.onchange({ target: new Input({ appearanceKey: 'color' }, '#246801') });
  assert.equal(b.appearance.color,'#246801'); assert.equal(a.appearance.color,'#135790'); assert.equal(f.state.scope.points[1],b);
  f.model.sketches.find(sketch => sketch.id === b.sketchId).locked = true; f.calls.length = 0;
  f.panel.onchange({ target: new Input({ appearanceKey: 'color' }, '#ff0000') });
  assert.equal(b.appearance.color,'#246801'); assert.deepEqual(f.calls,[]);
});

test('Properties feature keeps selection operation and presentation operation distinct and forwards action results', () => {
  const f = fixture({ interactive: true, sharedScene: true, sharedOwners: true, featureComposition: true }); f.state.ready = true;
  const definition = { ...w.DocumentState.create(), id: 'BD1', name: 'Placed block' }; f.model.blockDefinitions.push(definition);
  f.state.selectionOperation = { mode: 'block-place', blockPlacementDefinitionId: definition.id };
  f.state.operation = { mode: 'block-place', blockPlacementEnabledSketchIds: [f.model.activeSketchId], blockPlacementRotationLocked: true };
  const target = f.propertySelection.selectedDisplayTarget(); assert.equal(target.item,definition); f.view.render(target);
  assert.match(f.panel.innerHTML,/data-placement-rotation-mode/); assert.ok(f.state.selectionReads > 0); assert.ok(f.state.viewReads > 0);
  f.calls.length = 0; f.panel.onchange({ target: new Input({ placementRotationMode: 'locked' }, '') });
  assert.deepEqual(f.calls[0],['placement-lock',true]);
  const instance = { id: 'FI1', sketchId: f.model.activeSketchId }; f.state.selectionOperation = { freeInstancePlacement: instance }; f.state.operation = {};
  f.calls.length = 0; const action = { closest: selector => selector === '[data-property-action]' ? { dataset: { propertyAction: 'instance-anchor' } } : null };
  assert.equal(f.panel.onclick({ target: action }),'placement-result'); assert.equal(f.calls[1][1],instance);
});

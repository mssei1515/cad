const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture({ composed = false } = {}) {
 const events = [], bindings = [], elements = {};
 const arrays = ['points', 'lines', 'circles', 'arcs', 'splines', 'blockInstances', 'geometryInstances', 'annotations', 'hatches', 'referenceImages', 'sketches', 'constraints'];
 const state = { ready: false, scope: Object.fromEntries(arrays.map(key => [key, []])), scale: 2, target: null, selectionReads: 0 };
 const model = { defaultAppearance: { color: '#111827' }, defaultConstructionAppearance: {}, defaultDimensionAppearance: {}, defaultTerminatorAppearance: {}, defaultLeaderAppearance: {}, blockDefinitions: [] };
 const element = id => elements[id] ||= { id, handlers: {}, dataset: {}, value: '', innerHTML: '', open: false,
  addEventListener(type, callback) { bindings.push(id + ':' + type); this.handlers[type] = callback; },
  querySelectorAll: () => [], querySelector: () => null, closest: () => null,
  showModal() { this.open = true; events.push('show:' + id); }, close() { this.open = false; this.handlers.close?.(); } };
 for (const id of ['documentSettingsBtn', 'documentSettingsDialog', 'documentAppearanceFields', 'documentConstructionAppearanceFields', 'documentDimensionAppearanceFields', 'documentTerminatorAppearanceFields', 'documentLeaderAppearanceFields', 'colorPaletteDialog', 'applyCustomColorBtn', 'customColorPicker', 'defaultColorPalette', 'usedColorPalette']) element(id);
 const document = { getElementById: id => { assert.equal(state.ready, true, 'no DOM read during composition'); return elements[id] || null; } };
 const appearanceEditing = w.AppearanceEditing.create({ ...w.Appearance, defaultDimensionAppearance: w.Appearance.DEFAULT_DIMENSION_APPEARANCE, dimensionNumericRules: w.Appearance.DIMENSION_APPEARANCE_NUMERIC_RULES });
 const uiPorts = { document, documentModel: model, currentScope: () => state.scope, appearanceEditing,
  propertySelection: { selectedDisplayTarget: () => { state.selectionReads++; return state.target; }, multiplePropertyValue: () => w.PropertySelection.mixedValue, multiplePropertyAppearance: () => ({ color: '#123456' }) },
  appearancePropertyCommand: { owner: target => target.item.appearance }, applyMultipleProperty: (...args) => events.push(['multiple', ...args]),
  applicationText: (_ja, en) => en, escapeHtml: String, localizeApplicationUI: () => {},
  effectiveLeaderAppearanceForSketch: () => w.Appearance.normalizeLeaderAppearance(model.defaultLeaderAppearance, { partial: false }),
  readViewportScale: () => state.scale, invalidateBlockProjectionCache: id => events.push(['invalidate', id]),
  recordHistory: label => events.push(['history', label]), updateUI: () => events.push('ui'), draw: () => events.push('draw') };
 state.editingScope = { constraints: [] }; state.editingReads = 0; state.appearanceReads = 0;
 const stabilization = { stabilize(id) { assert.equal(this, stabilization); events.push(['solve', id]); return { success: Boolean(state.solved) }; } };
 const composition = composed ? w.PropertiesDisplay.createEditing({ document, documentModel: model,
  currentScope: () => { assert.equal(state.ready, true); state.editingReads++; return state.editingScope; },
  appearanceScope: () => { assert.equal(state.ready, true); state.appearanceReads++; return state.scope; },
  viewport: { get scale() { assert.equal(state.ready, true); return state.scale; } },
  propertySelection: { ...uiPorts.propertySelection, multiplePropertySupports: () => true, visibilityTargets: () => [], visibilityIsHidden: () => false },
  readServices: { annotationAppearance: { effectiveAnnotationStyle: item => item.style,
   effectiveLeaderAppearanceForSketch: uiPorts.effectiveLeaderAppearanceForSketch } }, sketchContext: { elementSketchId: item => item.sketchId },
  checkpoint: { captureValues: () => { assert.equal(state.ready, true); events.push('capture'); return { closed: state.item.closed }; },
   restoreValues: value => { state.item.closed = value.closed; events.push('restore'); } }, parameterStabilization: stabilization,
  guardSketchProjectionShapeEdit: () => true, synchronizeSketchProjectionMetadata: () => {}, materializeAnchor: () => ({}),
  isGeometryMode: () => true, toggleSketchVisibility: () => {}, guardSelectionEdit: () => true,
  applicationSettings: { applicationText: uiPorts.applicationText, localizeApplicationUI: uiPorts.localizeApplicationUI }, escapeHtml: String,
  invalidateBlockProjectionCache: uiPorts.invalidateBlockProjectionCache, recordHistory: uiPorts.recordHistory,
  updateUI: uiPorts.updateUI, updatePropertiesUI: () => events.push('properties'), draw: uiPorts.draw }) : null;
 const ui = composition?.appearanceUI || w.AppearanceUI.create(uiPorts);
 assert.deepEqual(bindings, []); assert.deepEqual(events, []); assert.equal(state.selectionReads, 0); state.ready = true;
 const commit = color => { elements.customColorPicker.value = color; elements.applyCustomColorBtn.handlers.click(); };
 return { ui, state, model, elements, events, bindings, commit, composition, button: { dataset: {}, closest: () => null, querySelector: () => null } };
}

test('Properties editing assembly preserves rollback and keeps editing scope separate from palette color scope', () => {
 const f = fixture({ composed: true }); assert.ok(Object.isFrozen(f.composition));
 const item = f.state.item = { sketchId: 'S2', closed: false, curve: () => ({ valid: true }) };
 assert.equal(f.composition.editing.geometry.setSplineClosed(item, true).success, false);
 assert.equal(item.closed, false); assert.deepEqual(f.events, ['capture', ['solve', 'S2'], 'restore']);
 assert.ok(f.state.editingReads > 0); assert.equal(f.state.appearanceReads, 0);
 f.events.length = 0; f.state.solved = true;
 assert.equal(f.composition.editing.geometry.setSplineClosed(item, true).success, true);
 assert.deepEqual(f.events, ['capture', ['solve', 'S2'], ['history', 'スプライン開閉変更']]);
 f.state.editingReads = 0; f.events.length = 0; f.ui.start();
 f.state.scope.lines.push({ appearance: { color: '#334455' } });
 const target = { appearance: {} }; f.state.target = { kind: 'geometry', item: target };
 f.ui.openPalette(f.button); f.commit('#aabbcc');
 assert.equal(target.appearance.color, '#aabbcc'); assert.ok(f.state.appearanceReads > 0); assert.equal(f.state.editingReads, 0);
 assert.deepEqual(f.bindings, ['documentSettingsBtn:click', 'colorPaletteDialog:click', 'applyCustomColorBtn:click', 'colorPaletteDialog:close']);
 f.elements.documentSettingsBtn.handlers.click(); f.model.defaultAppearance = { color: '#112233' };
 f.elements.documentAppearanceFields.onchange({ target: { dataset: { appearanceKey: 'lineWidth' }, value: '2.5' } });
 assert.equal(f.model.defaultAppearance.lineWidth, 2.5); assert.equal(f.model.defaultAppearance.color, '#112233');
 f.state.scale = 8; f.model.defaultLeaderAppearance = {};
 f.elements.documentLeaderAppearanceFields.onchange({ target: { dataset: { leaderStyle: 'fixedDisplaySize' }, type: 'checkbox', checked: true } });
 assert.equal(f.model.defaultLeaderAppearance.displayScale, 8 / w.Appearance.CSS_PX_PER_MM); assert.equal(f.state.editingReads, 0);
});

test('shared appearance UI defers binding and prepares all Document groups with the same rendered controls', () => {
 const f = fixture(); f.ui.start();
 assert.deepEqual(f.bindings, ['documentSettingsBtn:click', 'colorPaletteDialog:click', 'applyCustomColorBtn:click', 'colorPaletteDialog:close']);
 assert.deepEqual(f.events, []); f.elements.documentSettingsBtn.handlers.click();
 const expected = w.Appearance.normalizeAppearance(f.model.defaultAppearance, { partial: false });
 assert.equal(f.elements.documentAppearanceFields.innerHTML, f.ui.controls.appearancePropertyRows(expected, expected, { allowInheritance: false, idPrefix: 'documentProperty' }));
 for (const id of ['documentConstructionAppearanceFields', 'documentDimensionAppearanceFields', 'documentTerminatorAppearanceFields', 'documentLeaderAppearanceFields']) assert.ok(f.elements[id].innerHTML.length > 0, id);
 assert.deepEqual(f.events, ['show:documentSettingsDialog']); assert.equal(f.state.selectionReads, 0);
});

test('Properties and Document use one palette session with captured owners, live scope colors and cancellation', () => {
 const f = fixture(); f.ui.start(); const original = { appearance: { color: '#334455' } }, replacement = { appearance: { color: '#445566' } };
 f.state.target = { kind: 'line', item: original }; f.ui.openPalette(f.button); f.state.target = { kind: 'line', item: replacement }; f.events.length = 0; f.commit('#abc');
 assert.equal(original.appearance.color, '#aabbcc'); assert.equal(replacement.appearance.color, '#445566');
 assert.deepEqual(f.events, [['history', 'Appearance変更'], 'ui', 'draw']);
 f.ui.openPalette(f.button); f.elements.colorPaletteDialog.close(); f.events.length = 0; f.commit('#fff'); assert.deepEqual(f.events, []); assert.equal(replacement.appearance.color, '#445566');
 f.state.scope = { ...f.state.scope, points: [{ appearance: { color: '#987654' } }] };
 f.model.defaultAppearance = { color: '#112233' }; const reads = f.state.selectionReads;
 f.elements.documentSettingsBtn.handlers.click();
 f.elements.documentAppearanceFields.onclick({ target: { closest: () => f.button } }); assert.ok(f.elements.usedColorPalette.innerHTML.includes('#987654')); assert.equal(f.state.selectionReads, reads);
 f.events.length = 0; f.commit('#def'); assert.equal(f.model.defaultAppearance.color, '#ddeeff'); assert.equal(replacement.appearance.color, '#445566');
 assert.deepEqual(f.events, [['history', 'Document Default Appearance変更'], 'ui', 'draw']);
});

test('Document fields use replaced defaults and the current viewport through the shared editing implementation', () => {
 const f = fixture(); f.ui.start(); f.elements.documentSettingsBtn.handlers.click();
 f.model.defaultAppearance = { color: '#112233' }; f.events.length = 0;
 f.elements.documentAppearanceFields.onchange({ target: { dataset: { appearanceKey: 'lineWidth' }, value: ' 2.5 ' } });
 assert.equal(f.model.defaultAppearance.color, '#112233'); assert.equal(f.model.defaultAppearance.lineWidth, 2.5);
 assert.deepEqual(f.events, [['history', 'Document Default Appearance変更'], 'ui', 'draw']);
 f.state.scale = 8; f.model.defaultLeaderAppearance = {}; f.events.length = 0;
 f.elements.documentLeaderAppearanceFields.onchange({ target: { dataset: { leaderStyle: 'fixedDisplaySize' }, type: 'checkbox', checked: true } });
 assert.equal(f.model.defaultLeaderAppearance.fixedDisplaySize, false); assert.equal(f.model.defaultLeaderAppearance.displayScale, 8 / (96 / 25.4));
 assert.deepEqual(f.events, [['history', 'Document引出線外観変更'], 'ui', 'draw']);
});

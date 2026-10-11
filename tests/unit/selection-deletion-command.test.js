const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/commands/selection_deletion_command.js', 'utf8'), sandbox);
function fixture() {
 const events = [], hints = [], state = { editable: true, symbols: true, dependent: false, geometryDeleted: false };
 const model = { annotations: [], hatches: [], referenceImages: [], geometryInstances: [], blockInstances: [] };
 const selection = { annotations: [], hatches: [], referenceImages: [], geometryInstances: [], blockInstances: [],
  points: [], lines: [], circles: [], arcs: [], splines: [], dimensionConstraints: [], instanceGeometry: {} };
 selection.set = (field, value) => { selection[field] = value; events.push('selection:' + field); };
 const plan = (input, instances, field) => { events.push('plan:' + field); return { instances, field, removedConstraints: new Set(), removedIds: new Set(), removedKeys: new Set() }; };
 const command = sandbox.window.SelectionDeletionCommand.create({ currentScope: () => { events.push('scope'); return model; }, canvasSelection: selection,
  geometryDeletion: { planDerivedInstances: (m, i) => plan(m, i, 'geometryInstances'), planBlockInstances: (m, i) => plan(m, i, 'blockInstances'),
   applyInstances: (m, removal) => { events.push('apply:' + removal.field); m[removal.field] = m[removal.field].filter(item => !removal.instances.includes(item)); } },
  referenceImageInteraction: { forget: items => events.push('forget:' + items.length) },
  guardSelectionEdit: () => { events.push('guard'); return state.editable; }, selectionSketchId: () => 'S2', activeSketchId: () => 'S1',
  geometryRefKey: ref => ref.id, geometryRefForItem: item => item,
  geometryInstanceUsesRemovedGeometry: (instance, keys, owners) => state.dependent && Boolean(owners?.has("g1")), rejectReferencedGeometryDeletion: instances => instances.length > 0,
  guardDimensionSymbolDeletion: () => state.symbols, annotationReferencesRemovedGeometry: () => false,
  invalidateBlockProjectionCache: () => events.push('cache'), effectiveSelectedConstraint: () => null,
  deleteElements: candidates => { events.push('geometry'); state.candidates = candidates; return state.geometryDeleted; },
  clearSelection: () => events.push('clear'), solveAndRefresh: (label, owner) => events.push('solve:' + owner),
  refreshView: () => events.push('view'), recordHistory: label => events.push('history:' + label), setHint: text => hints.push(text), applicationText: text => text,
 });
 function select(field, item) { model[field].push(item); selection[field].push(item); }
 return { command, model, selection, state, events, hints, select };
}
test('selection edit guard rejects before model lookup', () => {
 const f = fixture(); f.state.editable = false; assert.equal(f.command.remove(), false); assert.deepEqual(f.events, ['guard']);
});
test('empty selection has no clear, view, solve or history effects', () => {
 const f = fixture(); assert.equal(f.command.remove(), false); assert.deepEqual(f.events, ['guard', 'scope', 'geometry']);
});
test('mixed annotation fill and image deletion forgets image interaction before selection and records image history', () => {
 const f = fixture(); f.select('annotations', {}); f.select('hatches', { id: 'h1' }); f.select('referenceImages', {});
 assert.equal(f.command.remove(), true); assert.equal(f.model.annotations.length, 0); assert.equal(f.model.hatches.length, 0); assert.equal(f.model.referenceImages.length, 0);
 assert.deepEqual(f.events, ['guard', 'scope', 'selection:annotations', 'selection:hatches', 'forget:1', 'selection:referenceImages', 'geometry', 'clear', 'view', 'history:画像削除']);
});
test('derived removal precedes Block removal, cache and owner-scoped solve', () => {
 const f = fixture(); f.select('geometryInstances', { id: 'g1' }); f.select('blockInstances', { id: 'b1' });
 assert.equal(f.command.remove(), true);
 assert.deepEqual(f.events, ['guard', 'scope', 'plan:geometryInstances', 'apply:geometryInstances', 'selection:geometryInstances', 'selection:instanceGeometry', 'plan:blockInstances', 'apply:blockInstances', 'cache', 'selection:blockInstances', 'geometry', 'clear', 'solve:S2']);
 assert.equal(f.model.geometryInstances.length, 0); assert.equal(f.model.blockInstances.length, 0);
});
test('late dependency rejection preserves the existing partial annotation removal without adding history', () => {
 const f = fixture(); f.select('annotations', {}); f.select('geometryInstances', { id: 'g1' }); f.model.geometryInstances.push({ id: 'dependent' }); f.state.dependent = true;
 assert.equal(f.command.remove(), false); assert.equal(f.model.annotations.length, 0); assert.equal(f.model.geometryInstances.length, 2);
 assert.deepEqual(f.events, ['guard', 'scope', 'selection:annotations']);
});
test('primitive deletion delegates history and avoids duplicate mixed-selection finalization', () => {
 const f = fixture(); f.select('annotations', {}); const point = {}; f.selection.points.push(point); f.state.geometryDeleted = true;
 assert.equal(f.command.remove(), true); assert.equal(f.state.candidates.points[0], point);
 assert.equal(f.events.at(-1), 'geometry'); assert.equal(f.hints.length, 0);
});

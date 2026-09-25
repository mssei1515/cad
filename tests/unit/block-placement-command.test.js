const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/block_placement_command.js'), 'utf8'), sandbox);
function fixture() {
  const definition = { id: 'D1', name: 'Part' }, model = { blockInstances: [] }, calls = [];
  let pointer = null, collapsed = true, mode = 'select';
  const command = sandbox.window.BlockPlacementCommand.create({
    isGeometryMode: () => true, canCreateInActiveSketch: () => true,
    blockDefinitionById: id => id === 'D1' ? definition : null, blockDefinitionScopeError: () => null,
    blockDefinitionDrawableSketchIds: () => ['S1', 'S2'], blockDefinitionGeometrySketchIds: () => ['S1'],
    snappedBlockRotation: angle => Math.round(angle / (Math.PI / 2)) * Math.PI / 2,
    blockInstanceTranslationForAnchor: (_def, _ids, anchor) => ({ x: anchor.x - 5, y: anchor.y - 7 }),
    activeSketchId: () => 'S3', currentScope: () => model, nextInstanceId: () => 'BI1',
    clearSelection: () => calls.push('clear'), canvasSelection: { set: (_key, items) => calls.push(items[0].id) },
    invalidateBlockProjectionCache: () => calls.push('invalidate'), isPropertiesCollapsed: () => collapsed,
    setPropertiesPanelCollapsed: value => { collapsed = value; calls.push(`collapsed:${value}`); },
    getPointerPreview: () => pointer, setPointerPreview: value => { pointer = value; }, getLastPointerWorld: () => null,
    setMode: value => { mode = value; }, setHint: () => calls.push('hint'), updateUI: () => calls.push('ui'),
    draw: () => calls.push('draw'), solveAndRefresh: () => calls.push('solve'), recordHistory: () => calls.push('history'),
  });
  return { command, model, calls, collapsed: () => collapsed, mode: () => mode, pointer: () => pointer };
}

test('two-click placement shares its locked rotation with preview and records one final history step', () => {
  const f = fixture(); f.command.start('D1');
  assert.equal(f.mode(), 'block-place'); assert.equal(f.collapsed(), false);
  f.command.click({ x: 20, y: 30 });
  assert.equal(f.model.blockInstances.length, 0);
  const preview = f.command.preview({ x: 21, y: 40 });
  assert.equal(preview.instance.rotation, Math.PI / 2);
  assert.equal(preview.instance.x, 15); assert.equal(preview.instance.y, 23);
  f.calls.length = 0; f.command.click({ x: 21, y: 40 });
  const placed = f.model.blockInstances[0];
  assert.equal(placed.rotation, preview.instance.rotation); assert.equal(placed.sketchId, 'S3');
  assert.equal(f.command.anchor, null); assert.equal(f.pointer(), null); assert.equal(f.collapsed(), true);
  assert.deepEqual(f.calls, ['invalidate', 'clear', 'BI1', 'collapsed:true', 'solve', 'hint', 'ui', 'draw', 'history']);
});

test('empty drawable selection rejects placement and state accessors cannot mutate settings', () => {
  const f = fixture(); f.command.start('D1'); f.command.setEnabledSketchIds(['S2']); f.calls.length = 0;
  f.command.enabledSketchIds.push('S1'); f.command.click({ x: 1, y: 2 });
  assert.equal(f.command.anchor, null); assert.equal(f.model.blockInstances.length, 0); assert.deepEqual(f.calls, ['hint']);
  f.command.setEnabledSketchIds(['S1']); f.command.setAnchor({ x: 1, y: 2 });
  f.command.anchor.x = 99; assert.equal(f.command.anchor.x, 1);
  f.command.setRotationLocked(false); assert.equal(f.command.rotation({ x: 2, y: 3 }), Math.PI / 4);
});

test('cancel restores the previously collapsed panel once while document reset discards that restoration', () => {
  const f = fixture(); f.command.start('D1');
  f.command.reset({ preservePanelState: true }); f.command.restorePropertiesPanel();
  assert.equal(f.collapsed(), true); assert.equal(f.command.definitionId, null);
  f.calls.length = 0; f.command.restorePropertiesPanel(); assert.deepEqual(f.calls, []);
  f.command.start('D1'); f.command.reset(); f.command.restorePropertiesPanel();
  assert.equal(f.collapsed(), false);
});

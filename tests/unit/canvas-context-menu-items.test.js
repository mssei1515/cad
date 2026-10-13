const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/canvas_context_presentation.js'), 'utf8'), sandbox);
function fixture() {
  const f = { calls: [], mode: 'select', projection: { count: 0 }, pending: {}, command: {}, spline: {}, buttons: {},
    canCreate: false, bounds: null, fix: null, primitives: [], geometry: [], order: {}, copyable: false, hasSelection: false };
  f.selection = Object.fromEntries(['points', 'lines', 'circles', 'arcs', 'splines', 'blockInstances', 'annotations', 'hatches'].map(field => [field, []]));
  const query = (name, read) => (...args) => { f.calls.push(name); return read(...args); };
  f.builder = sandbox.window.CanvasContextPresentation.createItems({
    readMode: query('mode', () => f.mode), sketchProjectionCommand: f.projection,
    applicationText: (ja, en) => en,
    document: { getElementById: id => { f.calls.push(id); return f.buttons[id]; } },
    canCreateInActiveSketch: query('create', () => f.canCreate), visibleGeometryBounds: query('bounds', () => f.bounds),
    pendingCommandSession: f.pending, constraintTargetSession: f.command, splineEditing: f.spline,
    isReadOnlyDimension: query('readOnly', () => f.readOnly), selectedDimensionLineGroup: query('dimensionGroup', () => f.group),
    blockDefinitionScopeError: query('scopeError', () => f.scopeError), blockDefinitionEditError: query('editError', () => f.editError),
    canvasContextFixState: query('fix', () => f.fix), selectedConstructionTogglePrimitives: query('construction', () => f.primitives),
    canvasSelection: f.selection, selectedGeometryItems: query('geometry', () => f.geometry),
    drawingOrderCommandState: query('order', () => f.order), hasCopyableCanvasSelection: query('copy', () => f.copyable),
    hasSelection: query('selection', () => f.hasSelection),
  });
  return f;
}
const actions = items => Array.from(items, item => item.separator ? '|' : item.action);
const action = (items, name) => items.find(item => item.action === name);

test('command menu reads current mode and projection count without querying object state', () => {
  const f = fixture(); f.mode = 'sketch-projection'; f.buttons.undoBtn = { disabled: true };
  let items = f.builder.items(null, true);
  assert.deepEqual(actions(items), ['sketch-projection-commit', '|', 'cancel-command', '|', 'undo', 'redo']);
  assert.deepEqual(f.calls, ['mode', 'undoBtn', 'redoBtn']);
  assert.equal(action(items, 'sketch-projection-commit').disabled, true);
  assert.equal(action(items, 'undo').disabled, true);
  assert.equal(action(items, 'redo').disabled, false);
  f.projection.count = 1;
  assert.equal(action(f.builder.items(null, true), 'sketch-projection-commit').disabled, false);
  f.mode = 'line';
  items = f.builder.items(null, true);
  assert.deepEqual(actions(items), ['cancel-command', '|', 'undo', 'redo']);
  assert.equal(action(items, 'cancel-command').shortcut, 'Esc');
});

test('blank menu preserves permissions, missing history buttons and visible-bounds query order', () => {
  const f = fixture();
  const items = f.builder.items({ kind: 'blank', item: null });
  assert.deepEqual(actions(items), ['paste', '|', 'undo', 'redo', '|', 'fit-visible']);
  assert.deepEqual(f.calls, ['create', 'undoBtn', 'redoBtn', 'bounds']);
  assert.equal(action(items, 'paste').disabled, true);
  assert.equal(action(items, 'undo').disabled, false);
  assert.equal(action(items, 'fit-visible').disabled, true);
  f.canCreate = true; f.bounds = {};
  const next = f.builder.items({ kind: 'blank' });
  assert.equal(action(next, 'paste').disabled, false);
  assert.equal(action(next, 'fit-visible').disabled, false);
});

test('edited fit points suppress ordinary Fix and clipboard queries and preserve minimum-point guard', () => {
  const f = fixture(), point = {};
  f.spline.current = { spline: { fitPoints: [point, {}, {}] } };
  const items = f.builder.items({ kind: 'point', item: point });
  assert.deepEqual(actions(items), ['sketch-move', 'spline-fit-point-delete', '|', 'show-properties']);
  assert.deepEqual(f.calls, ['mode']);
  assert.equal(action(items, 'spline-fit-point-delete').disabled, true);
  assert.equal(action(items, 'spline-fit-point-delete').danger, true);
  f.spline.current.spline.fitPoints.push({});
  assert.equal(action(f.builder.items({ kind: 'point', item: point }), 'spline-fit-point-delete').disabled, false);
});

test('block menu preserves error short-circuit, live rotation labels and drawing-order grouping', () => {
  const f = fixture(), block = { definitionId: 'B1', fixed: true, rotationLocked: true };
  f.selection.blockInstances.push(block); f.scopeError = 'scope'; f.fix = { enabled: true, fixed: true };
  f.order = { canForward: false, canBackward: true }; f.copyable = true; f.hasSelection = true; f.canCreate = true;
  let items = f.builder.items({ kind: 'block', item: block });
  assert.equal(f.calls.includes('editError'), false);
  assert.equal(action(items, 'block-edit').disabled, true);
  assert.equal(action(items, 'block-rotation-toggle').label, 'Free Rotation');
  assert.equal(action(items, 'block-rotation-toggle').disabled, true);
  assert.equal(action(items, 'fix-toggle').label, 'Unfix');
  assert.equal(action(items, 'drawing-front').disabled, true);
  assert.equal(action(items, 'drawing-back').disabled, false);
  assert.deepEqual(actions(items).slice(-10), ['drawing-front', 'drawing-forward', 'drawing-backward', 'drawing-back', '|', 'cut', 'copy', 'delete', '|', 'show-properties']);
  f.scopeError = null; block.rotationLocked = false; block.fixed = false;
  items = f.builder.items({ kind: 'block', item: block });
  assert.equal(f.calls.includes('editError'), true);
  assert.equal(action(items, 'block-edit').disabled, false);
  assert.equal(action(items, 'block-rotation-toggle').label, 'Lock Orthogonal Rotation');
  assert.equal(f.selection.blockInstances[0], block);
});

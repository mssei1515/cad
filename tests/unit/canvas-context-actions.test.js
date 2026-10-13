const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/commands/canvas_context_actions.js'), 'utf8'), sandbox);
function fixture() {
  const f = { calls: [], selectionAllowed: true, sketchAllowed: true, structureAllowed: true, selectedSketch: null, activeSketch: 'S1', aligned: true, fit: true, spline: {} };
  const record = name => (...args) => { f.calls.push([name, ...args]); return name; };
  f.group = {};
  const align = { align(group) { assert.equal(this, align); assert.equal(group, f.group); f.calls.push(['align', group]); return f.aligned; } };
  const clipboard = { pasteFromMenu() { assert.equal(this, clipboard); f.calls.push(['paste']); return Promise.resolve(); } };
  const move = { start() { assert.equal(this, move); f.calls.push(['move']); } };
  const ports = {
    guardSelectionEdit: () => { f.calls.push(['selectionGuard']); return f.selectionAllowed; },
    guardSketchEdit: (id, kind) => { f.calls.push(['sketchGuard', id, kind]); return kind === 'structure' ? f.structureAllowed : f.sketchAllowed; },
    elementSketchId: item => item.sketchId, selectionSketchId: () => f.selectedSketch, activeSketchId: () => f.activeSketch,
    imageClipboard: clipboard, document: { getElementById: id => ({ click() { f.calls.push(['click', id]); } }) },
    fixPointBtn: { click() { f.calls.push(['fixClick']); } },
    selectedDimensionLineGroup: item => { f.calls.push(['group', item]); return f.group; }, dimensionLineGroup: align,
    applicationText: (ja, en) => en, sketchMoveCommand: move, splineEditing: f.spline,
    fitVisibleGeometryToViewport: () => { f.calls.push(['fit']); return f.fit; },
  };
  for (const name of ['commitSketchProjectionCommand', 'cancelCanvasCommandFromContextMenu', 'undoHistory', 'redoHistory', 'copySelectionToClipboard', 'showSelectedObjectProperties', 'enterBlockDefinitionEdit', 'setBlockInstanceRotationLocked', 'startDimensionEditInput', 'updateGeometrySelectionUI', 'draw', 'recordHistory', 'setHint', 'startHatchBoundaryRepair', 'reorderSelectedDrawingObjects', 'addSplineFitPointFromContext', 'deleteSplineFitPointFromContext']) ports[name] = record(name);
  f.actions = sandbox.window.CanvasContextActions.create(ports);
  return f;
}

test('context editing guards short-circuit before dispatch and structure checks use current scope fallback', () => {
  const f = fixture(), item = { sketchId: 'S2' };
  f.selectionAllowed = false;
  assert.equal(f.actions.execute('fix-toggle', { item }), undefined);
  assert.deepEqual(f.calls, [['selectionGuard']]);
  f.calls.length = 0; f.selectionAllowed = true; f.sketchAllowed = false;
  f.actions.execute('fix-toggle', { item });
  assert.deepEqual(f.calls, [['selectionGuard'], ['sketchGuard', 'S2', undefined]]);
  f.calls.length = 0; f.sketchAllowed = true; f.structureAllowed = false;
  f.actions.execute('fix-toggle', { item });
  assert.deepEqual(f.calls, [['selectionGuard'], ['sketchGuard', 'S2', undefined], ['sketchGuard', 'S2', 'structure']]);
  f.calls.length = 0; f.structureAllowed = true; f.selectedSketch = 'S3';
  f.actions.execute('fix-toggle', null);
  assert.deepEqual(f.calls, [['selectionGuard'], ['sketchGuard', 'S3', 'structure'], ['fixClick']]);
  f.calls.length = 0; f.selectedSketch = null; f.activeSketch = 'S4';
  f.actions.execute('fix-toggle', null);
  assert.deepEqual(f.calls, [['selectionGuard'], ['sketchGuard', 'S4', 'structure'], ['fixClick']]);
});

test('context dimension alignment preserves successful update order and skips side effects on failure', () => {
  const f = fixture(), item = { sketchId: 'S2' };
  f.actions.execute('dimension-align', { item });
  assert.deepEqual(f.calls, [['selectionGuard'], ['sketchGuard', 'S2', undefined], ['group', item], ['align', f.group],
    ['updateGeometrySelectionUI'], ['draw'], ['recordHistory', 'Align dimension lines'], ['setHint', 'Aligned to the reference dimension line.']]);
  f.calls.length = 0; f.aligned = false;
  f.actions.execute('dimension-align', { item });
  assert.deepEqual(f.calls.map(call => call[0]), ['selectionGuard', 'sketchGuard', 'group', 'align']);
  f.calls.length = 0; f.group = null;
  f.actions.execute('dimension-align', { item });
  assert.deepEqual(f.calls.map(call => call[0]), ['selectionGuard', 'sketchGuard', 'group']);
});

test('non-edit actions delegate without edit guards, preserve receivers and discard command return values', () => {
  const f = fixture(); f.selectionAllowed = false;
  assert.equal(f.actions.execute('copy'), undefined);
  f.actions.execute('paste'); f.actions.execute('undo'); f.actions.execute('show-properties');
  assert.deepEqual(f.calls, [['copySelectionToClipboard'], ['paste'], ['undoHistory'], ['showSelectedObjectProperties']]);
  f.calls.length = 0; f.fit = false;
  f.actions.execute('fit-visible');
  assert.deepEqual(f.calls, [['fit'], ['setHint', 'There is no visible geometry.', 'error'], ['draw']]);
  f.calls.length = 0; f.fit = true;
  f.actions.execute('fit-visible');
  assert.deepEqual(f.calls, [['fit'], ['setHint', 'Fitted all visible geometry.'], ['draw']]);
  f.calls.length = 0; f.actions.execute('unknown');
  assert.equal(f.calls.length, 0);
});

test('target actions retain hit and spline references and required-pointer checks', () => {
  const f = fixture(), item = { sketchId: 'S2', definitionId: 'B1', rotationLocked: true }, hit = { constraint: {} }, pointer = { x: 1, y: 2 };
  f.actions.execute('dimension-edit', { item, hit });
  assert.equal(f.calls.at(-1)[1], hit);
  f.calls.length = 0;
  f.actions.execute('spline-fit-point-add', { item });
  assert.equal(f.calls.some(call => call[0] === 'addSplineFitPointFromContext'), false);
  f.actions.execute('spline-fit-point-add', { item }, pointer);
  assert.equal(f.calls.at(-1)[1], item); assert.equal(f.calls.at(-1)[2], pointer);
  const spline = {}; f.spline.current = { spline };
  f.actions.execute('spline-fit-point-delete', { item });
  assert.equal(f.calls.at(-1)[1], spline); assert.equal(f.calls.at(-1)[2], item);
  f.actions.execute('block-rotation-toggle', { item });
  assert.deepEqual(f.calls.at(-1), ['setBlockInstanceRotationLocked', item, false]);
});

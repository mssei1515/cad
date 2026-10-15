const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: { SketchHierarchy: { ROOT_SKETCH_ID: 'ROOT', isRootSketch: sketch => sketch?.id === 'ROOT' },
  Appearance: { normalizeAppearance: value => ({ ...value }) } } };
vm.runInNewContext(fs.readFileSync('src/commands/sketch_command.js', 'utf8'), sandbox);
function fixture() {
  const root = { id: 'ROOT', name: 'Root', kind: 'root' }, first = { id: 'S1', name: 'Sketch-1', parentSketchId: 'ROOT', appearance: {} };
  const state = { model: { sketches: [root, first], activeSketchId: 'S1' }, next: 2, answer: null, visible: true }, events = [];
  const byId = id => state.model.sketches.find(sketch => sketch.id === id);
  const command = sandbox.window.SketchCommand.create({ currentScope: () => state.model, ensureSketchState: () => {},
    activeSketch: () => byId(state.model.activeSketchId), activeSketchId: () => state.model.activeSketchId,
    sketchById: byId, childSketchesOf: id => state.model.sketches.filter(sketch => sketch.parentSketchId === id),
    sketchName: id => byId(id)?.name, nextSketchId: () => `S${state.next++}`,
    clearInteractionForSketchChange: () => events.push('clear'), setHint: text => events.push(['hint', text]),
    updateUI: () => events.push('ui'), draw: () => events.push('draw'), recordHistory: label => events.push(['history', label]),
    promptName: () => state.answer, effectiveAppearanceForElement: () => ({ visible: state.visible }),
    clearTreeHover: () => events.push('hover'), clearSnap: () => events.push('snap') });
  return { state, events, command, first, root };
}
test('Sketch creation uses hierarchy names and records one completed operation', () => {
  const f = fixture(); f.state.model.sketches.push({ id: 'S9', name: 'Sketch-9', parentSketchId: 'ROOT' });
  f.command.createSketch(); const sibling = f.state.model.sketches.at(-1);
  assert.equal(sibling.name, 'Sketch-10'); assert.equal(sibling.parentSketchId, 'ROOT'); assert.equal(f.state.model.activeSketchId, sibling.id);
  assert.deepEqual(f.events.map(event => Array.isArray(event) ? event[0] : event), ['clear', 'hint', 'ui', 'draw', 'history']);
  f.command.createSketch('child'); const child = f.state.model.sketches.at(-1);
  assert.equal(child.name, 'Sketch-10-1'); assert.equal(child.parentSketchId, sibling.id);
});
test('Sketch activation makes its appearance visible without recording history and follows scope changes', () => {
  const f = fixture(); f.command.activate('S1'); assert.deepEqual(f.events, []);
  f.state.model = { sketches: [f.root, { id: 'S2', name: 'Other', appearance: { color: 'red', visible: false }, visible: false }], activeSketchId: 'ROOT' };
  f.command.activate('S2'); assert.equal(f.state.model.activeSketchId, 'S2');
  assert.equal(f.state.model.sketches[1].appearance.visible, true); assert.equal(f.state.model.sketches[1].appearance.color, 'red');
  assert.deepEqual(f.events.map(event => Array.isArray(event) ? event[0] : event), ['clear', 'hint', 'ui', 'draw']);
});
test('Sketch rename preserves root and cancelled names while trimming accepted input', () => {
  const f = fixture(); f.state.answer = ' changed '; f.command.rename('ROOT'); assert.equal(f.root.name, 'Root');
  f.state.answer = null; f.command.rename('S1'); assert.deepEqual(f.events, []);
  f.state.answer = ' changed '; f.command.rename('S1'); assert.equal(f.first.name, 'changed');
  f.state.answer = '   '; f.command.rename('S1'); assert.equal(f.first.name, 'changed');
  assert.equal(f.events.filter(event => event[0] === 'history').length, 2);
});
test('Sketch visibility rejects root and active scope and clears hover and snaps on a valid toggle', () => {
  const f = fixture(); assert.equal(f.command.toggleVisibility('ROOT'), false); assert.equal(f.command.toggleVisibility('S1'), false);
  assert.deepEqual(f.events, []); f.state.model.activeSketchId = 'ROOT';
  assert.equal(f.command.toggleVisibility('S1'), true); assert.equal(f.first.visible, false); assert.equal(f.first.appearance.visible, false);
  assert.deepEqual(f.events.map(event => Array.isArray(event) ? event[0] : event), ['hover', 'snap', 'hint', 'ui', 'draw', 'history']);
  f.state.visible = false; f.command.toggleVisibility('S1'); assert.equal(f.first.visible, true);
});
function editAccessFixture() {
  const state = { active: 'S1', geometryMode: true, selected: [], allowed: true, locked: false, pointer: { x: 10 }, snap: { id: 'P1' } };
  const events = [];
  const access = sandbox.window.SketchCommand.createEditAccess({
    activeSketchId: () => state.active,
    canEditSketch: (id, operation) => { events.push(['check', id, operation]); return typeof state.allowed === 'function' ? state.allowed(id) : state.allowed; },
    sketchById: id => { events.push(['sketch', id]); return { locked: state.locked }; },
    selectionItems: () => state.selected, elementSketchId: item => item.sketchId,
    isGeometryMode: () => state.geometryMode,
    applicationText: (ja, en) => en, setHint: (text, kind) => events.push(['hint', text, kind]),
    clearSnap: () => { state.snap = null; events.push('snap'); },
    clearPointerPreview: () => { state.pointer = null; events.push('pointer'); },
    draw: () => events.push('draw'),
  });
  return { state, events, access };
}

test('edit access checks the current destination and operation without changing selection or previews', () => {
  const { state, events, access } = editAccessFixture();
  const pointer = state.pointer, snap = state.snap;
  assert.equal(access.guardSketchEdit(), true);
  state.active = 'BLOCK-S1';
  assert.equal(access.guardSketchEdit(undefined, 'structure'), true);
  assert.equal(access.guardSketchEdit(null, 'constraint'), true);
  assert.deepEqual(events, [['check', 'S1', 'edit'], ['check', 'BLOCK-S1', 'structure'], ['check', null, 'constraint']]);
  assert.equal(state.pointer, pointer); assert.equal(state.snap, snap);
});

test('edit access reports the first denied unique selection owner and preserves the selection', () => {
  const { state, events, access } = editAccessFixture();
  const selected = [{ sketchId: 'S1' }, { sketchId: 'S1' }, { sketchId: 'S2' }, { sketchId: 'S3' }];
  state.selected = selected; state.allowed = id => id !== 'S2';
  assert.equal(access.guardSelectionEdit('constraint'), false);
  assert.deepEqual(events, [['check', 'S1', 'constraint'], ['check', 'S2', 'constraint'], ['sketch', 'S2'],
    ['hint', 'Set the owning sketch as the drawing sketch for this operation.', 'error']]);
  assert.equal(state.selected, selected);
  events.length = 0; state.selected = [];
  assert.equal(access.guardSelectionEdit(), true);
  assert.deepEqual(events, []);
});

test('rejected creation reports a lock before clearing snap and pointer then drawing', () => {
  const { state, events, access } = editAccessFixture();
  state.active = 'LOCKED'; state.allowed = false; state.locked = true;
  assert.equal(access.rejectRootSketchCreation(), true);
  assert.deepEqual(events, [['check', 'LOCKED', 'create'], ['check', 'LOCKED', 'create'], ['sketch', 'LOCKED'],
    ['hint', 'Sketch is locked. Unlock it or change the drawing sketch.', 'error'], 'snap', 'pointer', 'draw']);
  assert.equal(state.pointer, null); assert.equal(state.snap, null); assert.equal(state.active, 'LOCKED');
});

test('creation admission has no effects and keeps the geometry-mode short circuit', () => {
  const { state, events, access } = editAccessFixture();
  const pointer = state.pointer, snap = state.snap;
  assert.equal(access.rejectRootSketchCreation(), false);
  assert.deepEqual(events, [['check', 'S1', 'create']]);
  assert.equal(state.pointer, pointer); assert.equal(state.snap, snap);
  events.length = 0; state.geometryMode = false;
  assert.equal(access.canCreateInActiveSketch(), false);
  assert.deepEqual(events, []);
  // Existing cleanup still occurs if mode rejects creation even while Sketch permission allows it.
  assert.equal(access.rejectRootSketchCreation(), true);
  assert.deepEqual(events, [['check', 'S1', 'create'], 'snap', 'pointer', 'draw']);
});

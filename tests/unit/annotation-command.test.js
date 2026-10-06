const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['document/appearance.js', 'commands/annotation_command.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
function fixture() {
  let pending = null, scope = { annotations: [] }, text = 'note', seq = 1, scale = 2, allowed = true, selectedTarget = null;
  const history = [], calls = [];
  const command = sandbox.window.AnnotationCommand.create({ currentScope: () => scope,
    getPending: () => pending, setPending: value => { pending = value; }, lastPointer: () => ({ x: 10, y: 20 }), viewScale: () => scale,
    promptText: () => text, nextAnnotationId: () => `AN${seq++}`, activeSketchId: () => 'S1', canCreateInActiveSketch: () => allowed,
    rejectRootSketchCreation: () => !allowed, annotationLeaderTargetFromSelection: () => selectedTarget,
    annotationLeaderTargetFromHit: hit => hit?.target || null, setGeometrySelection: hit => calls.push(hit), clearSelection: () => calls.push('clear'),
    cancelPendingCommand: () => { pending = null; }, setHint: (...args) => calls.push(args), updateToolbar: () => {}, updateUI: () => {}, draw: () => {}, recordHistory: label => history.push(label),
  });
  return { command, history, calls, get pending() { return pending; }, get scope() { return scope; },
    reply: value => { text = value; }, allow: value => { allowed = value; }, select: value => { selectedTarget = value; },
    setScope: value => { scope = value; }, zoom: value => { scale = value; } };
}
const target = () => ({ anchor: { x: 0, y: 0 }, geometryRef: { kind: 'line', path: ['L1'] } });

test('text creation adds a normalized annotation and one history entry then clears pending state', () => {
  const f = fixture(); f.command.createTextAnnotation();
  assert.equal(f.pending.type, 'annotation-text-place');
  assert.equal(f.command.commitTextAnnotationAt({ x: 4, y: 8 }), true);
  const item = f.scope.annotations[0];
  assert.equal(item.id, 'AN1'); assert.equal(item.sketchId, 'S1'); assert.equal(item.rotation, 0);
  assert.equal(item.visible, true); assert.equal(item.text, 'note'); assert.equal(item.x, 4); assert.equal(item.y, 8);
  assert.equal(f.pending, null); assert.deepEqual(f.history, ['テキスト追加']);
});

test('cancelled text and leader prompts clear pending without creating data or history', () => {
  const f = fixture(); f.reply(null); f.command.createTextAnnotation();
  assert.equal(f.command.commitTextAnnotationAt({ x: 0, y: 0 }), true);
  assert.equal(f.pending, null);
  f.command.startLeaderAnnotationPlacement(target()); f.reply(''); f.command.commitLeaderAnnotationAt({ x: 4, y: 8 }); f.command.commitLeaderAnnotationAt({ x: 12, y: 80 });
  assert.equal(f.pending, null); assert.equal(f.scope.annotations.length, 0); assert.equal(f.history.length, 0);
});

test('leader preview and committed geometry share the exact three-click layout', () => {
  const f = fixture(), t = target(); f.command.startLeaderAnnotationPlacement(t);
  assert.equal(f.pending.pointer.x, 45); assert.equal(f.pending.pointer.y, -18);
  f.command.commitLeaderAnnotationAt({ x: 13, y: -7 });
  f.pending.pointer = { x: -20, y: 99 };
  const preview = f.command.leaderPreview();
  assert.equal(preview.text, '注記'); assert.equal(f.scope.annotations.length, 0);
  f.command.commitLeaderAnnotationAt(f.pending.pointer);
  const item = f.scope.annotations[0];
  for (const key of ['start', 'elbow', 'end']) assert.deepEqual(item[key], preview[key]);
  assert.equal(item.x, preview.x); assert.equal(item.y, preview.y); assert.equal(item.geometryRef, t.geometryRef);
  assert.deepEqual(f.history, ['引出線追加']); assert.equal(f.pending, null);
  assert.equal(f.command.leaderPreview(), undefined);
});

test('leader creation selects a target or waits for a valid hit without recording history', () => {
  const f = fixture(); f.command.createLeaderAnnotation();
  assert.equal(f.pending.type, 'annotation-leader-select');
  assert.equal(f.command.handleLeaderAnnotationTargetClick({}, { x: 1, y: 2 }), true);
  assert.equal(f.pending.type, 'annotation-leader-select');
  const hit = { target: target() };
  assert.equal(f.command.handleLeaderAnnotationTargetClick(hit, { x: 3, y: 4 }), true);
  assert.equal(f.pending.leaderTarget, hit.target); assert.ok(f.calls.includes(hit));
  assert.equal(f.command.handleLeaderAnnotationTargetClick(hit, { x: 3, y: 4 }), false);
  assert.equal(f.history.length, 0);
  f.select(target()); f.command.createLeaderAnnotation(); assert.equal(f.pending.type, 'annotation-leader-select');
});

test('root rejection and scope switching preserve the current document boundary', () => {
  const f = fixture(); f.allow(false); f.command.createTextAnnotation(); f.command.createLeaderAnnotation();
  assert.equal(f.pending, null); assert.equal(f.command.pushAnnotation({ type: 'text' }), null);
  const previous = f.scope; f.setScope({ annotations: [] }); f.allow(true);
  f.command.pushAnnotation({ type: 'text', text: 'new scope', rotation: '30' });
  assert.equal(previous.annotations.length, 0); assert.equal(f.scope.annotations[0].rotation, 30);
  assert.equal(f.history.length, 0);
});

test('free elbow and horizontal end allow both directions without zoom-dependent length constraints', () => {
  for (const endX of [-2, 14]) for (const zoom of [0.5, 10]) {
    const f = fixture(); f.zoom(zoom); f.command.startLeaderAnnotationPlacement(target(), { x: 0, y: 0 });
    f.command.commitLeaderAnnotationAt({ x: 3, y: 7 });
    assert.equal(f.scope.annotations.length, 0); assert.equal(f.history.length, 0);
    f.command.commitLeaderAnnotationAt({ x: endX, y: 900 });
    const item = f.scope.annotations[0];
    assert.deepEqual({ ...item.elbow }, { x: 3, y: 7 });
    assert.deepEqual({ ...item.end }, { x: endX, y: 7 });
    assert.equal(item.appearanceInheritance, true);
    assert.equal(Object.keys(item.style).length, 0);
  }
});

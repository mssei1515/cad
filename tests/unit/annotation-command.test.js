const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['document/appearance.js', 'document/annotations.js', 'commands/annotation_command.js', 'ui/annotation_command_panel.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8'), sandbox);
function fixture() {
  let pending = null, scope = { annotations: [] }, seq = 1, scale = 2, allowed = true, selected = null;
  const history = [];
  const command = sandbox.window.AnnotationCommand.create({ currentScope: () => scope,
    getPending: () => pending, setPending: value => { pending = value; }, lastPointer: () => ({ x: 10, y: 20 }), viewScale: () => scale,
    nextAnnotationId: () => `AN${seq++}`, activeSketchId: () => 'S1', canCreateInActiveSketch: () => allowed,
    rejectRootSketchCreation: () => !allowed, canEdit: () => allowed,
    annotationLeaderTargetFromHit: hit => hit?.target || null, clearSelection: () => { selected = null; }, selectAnnotation: item => { selected = item; },
    effectiveAnnotationStyle: item => ({ ...sandbox.window.Appearance.resolveLeaderAppearance({}, {}, {}, item.style), prefix: item.style?.prefix || '', suffix: item.style?.suffix || '', precision: item.style?.precision }),
    annotationTextMetrics: item => ({ fontSize: 10, bounds: { x1: item.x, x2: item.x + 20, y1: item.y - 5, y2: item.y + 5 } }),
    annotationTextLayout: item => ({ x: item.x + 100, y: item.y + 200 }), annotationLeaderDisplayGeometry: item => item,
    cancelPendingCommand: () => { pending = null; }, setHint: () => {}, updateToolbar: () => {}, updateUI: () => {}, draw: () => {}, recordHistory: label => history.push(label),
  });
  const panel = sandbox.window.AnnotationCommandPanel.create({ command, applicationText: (_ja, en) => en });
  return { command, panel, history, get pending() { return pending; }, get scope() { return scope; }, get selected() { return selected; },
    allow: value => { allowed = value; }, setScope: value => { scope = value; }, zoom: value => { scale = value; } };
}
const target = (x = 0) => ({ anchor: { x, y: 0 }, geometryRef: { kind: 'line', path: ['L1'] }, attachment: { kind: 'line', t: 0.5 } });
function placeLeader(f, endX = 14) {
  f.command.createLeaderAnnotation(); f.command.changeSetting('text', 'note\nline 2');
  f.command.handleLeaderAnnotationTargetClick({ target: target() }, { x: 0, y: 0 });
  f.command.commitLeaderAnnotationAt({ x: 3, y: 7 });
  f.command.commitLeaderAnnotationAt({ x: endX, y: 900 });
}
test('placement clicks commit one annotation each and preserve the multiline draft until Done', () => {
  const f = fixture(); f.command.start();
  f.command.commitTextAnnotationAt({ x: 4, y: 8 });
  assert.equal(f.scope.annotations.length, 0);
  f.command.changeSetting('text', '\n note\nline 2');
  f.command.commitTextAnnotationAt({ x: 4, y: 8 });
  const item = f.scope.annotations[0];
  assert.equal(item.text, '\n note\nline 2'); assert.equal(item.x, 4); assert.equal(item.y, 8);
  assert.equal(item.appearanceInheritance, true); assert.equal(f.selected, item);
  assert.equal(f.pending.text, item.text); assert.equal(f.pending.position, undefined);
  f.command.commitTextAnnotationAt({ x: 14, y: 18 });
  assert.equal(f.scope.annotations.length, 2); assert.notEqual(f.scope.annotations[1].id, item.id);
  assert.equal(f.command.finish(), true); assert.equal(f.pending, null);
  assert.deepEqual(f.history, ['注記追加', '注記追加']);
});

test('switching leader setting retains content, clears incomplete placement and remembers mode', () => {
  const f = fixture(); f.command.start(); f.command.changeSetting('text', 'note');
  f.command.changeSetting('withLeader', true);
  f.command.handleLeaderAnnotationTargetClick({ target: target() }, { x: 0, y: 0 });
  f.command.commitLeaderAnnotationAt({ x: 3, y: 7 });
  f.command.changeSetting('withLeader', false);
  assert.equal(f.pending.text, 'note'); assert.equal(f.pending.leaderTarget, undefined); assert.equal(f.pending.elbow, undefined);
  f.command.changeSetting('withLeader', true); f.command.cancel();
  f.command.start(); assert.equal(f.pending.withLeader, true); assert.equal(f.pending.text, '');
  assert.equal(f.scope.annotations.length, 0); assert.equal(f.history.length, 0);
});

test('leader endpoint click commits in either direction and resets only placement', () => {
  for (const endX of [-2, 14, 3]) for (const scale of [0.5, 10]) {
    const f = fixture(); f.zoom(scale); placeLeader(f, endX);
    const item = f.scope.annotations[0];
    assert.deepEqual({ ...item.elbow }, { x: 3, y: 7 });
    assert.deepEqual({ ...item.end }, { x: endX, y: 7 });
    assert.equal(item.textPlacement, 'shelf'); assert.equal(item.shelfReferenceScale, scale);
    assert.equal(f.pending.type, 'annotation-leader-select'); assert.equal(f.pending.text, 'note\nline 2');
    assert.deepEqual(f.history, ['注記追加']);
    f.command.cancel(); assert.equal(f.scope.annotations.length, 1);
  }
});

test('invalid targets and incomplete placement do not create annotations', () => {
  const f = fixture(); f.command.createLeaderAnnotation(); f.command.changeSetting('text', 'note');
  f.command.handleLeaderAnnotationTargetClick({}, { x: 0, y: 0 });
  assert.equal(f.pending.type, 'annotation-leader-select');
  f.command.handleLeaderAnnotationTargetClick({ target: target() }, { x: 0, y: 0 });
  f.command.commitLeaderAnnotationAt({ x: 3, y: 7 }); f.command.cancel();
  assert.equal(f.pending, null); assert.equal(f.scope.annotations.length, 0); assert.equal(f.history.length, 0);
});

test('root rejection and scope switching preserve document boundaries', () => {
  const f = fixture(); f.allow(false); f.command.start();
  assert.equal(f.pending, null); assert.equal(f.command.pushAnnotation({ type: 'text' }), null);
  const previous = f.scope; f.setScope({ annotations: [] }); f.allow(true);
  f.command.pushAnnotation({ type: 'text', text: 'new scope' });
  assert.equal(previous.annotations.length, 0); assert.equal(f.scope.annotations.length, 1);
});
test('adding and removing leader preserves identity, parameter references, text and appearance', () => {
  for (const x of [-100, 20, 100]) {
    const f = fixture();
    const source = { id: 'AN9', type: 'text', sketchId: 'S1', x: 10, y: 15, text: 'note', rotation: 0.7,
      parameterEnabled: true, parameterName: 'result', expression: '"source" + 1', evaluatedParameterValue: 12,
      style: { color: '#abcdef', textHeight: 8, prefix: 'P', suffix: 'mm', precision: 2, fixedDisplaySize: false, displayScale: 2 } };
    f.scope.annotations.push(source);
    const before = JSON.stringify(source);
    assert.equal(f.command.addLeader(source), true);
    f.command.handleLeaderAnnotationTargetClick({ target: target(x) }, { x, y: 0 });
    assert.equal(JSON.stringify(source), before);
    const preview = f.command.preview();
    assert.equal(preview.x, 10); assert.equal(preview.y, 15);
    assert.equal(preview.elbow.x, x < 20 ? 5 : 30);
    assert.equal(preview.elbow.y, preview.end.y);
    f.command.finish(); assert.equal(source, f.scope.annotations[0]);
    assert.equal(source.style.rotation, 0.7); assert.equal(source.style.color, '#abcdef');
    assert.equal(source.textPlacement, 'text');
    const encoded = sandbox.window.AnnotationData.serializeAnnotation(source);
    assert.equal(encoded.textPlacement, 'text'); assert.equal(encoded.appearanceInheritance, true);
    f.command.removeLeader(source);
    assert.equal(source.type, 'text'); assert.equal(source.x, 110); assert.equal(source.y, 215);
    for (const key of ['geometryRef', 'attachment', 'start', 'elbow', 'end', 'textPlacement', 'shelfReferenceScale']) assert.equal(key in source, false);
    assert.equal(source.id, 'AN9'); assert.equal(source.parameterName, 'result'); assert.equal(source.expression, '"source" + 1');
    assert.equal(source.style.prefix, 'P'); assert.equal(source.style.precision, 2);
    const savedText = sandbox.window.AnnotationData.serializeAnnotation(source);
    assert.equal(savedText.appearanceInheritance, true); assert.equal(savedText.style.rotation, 0.7);
    assert.deepEqual(f.history, ['引出線追加', '引出線解除']);
  }
});
test('cancelled or disallowed conversion leaves the annotation unchanged', () => {
  const f = fixture(), item = { id: 'AN1', type: 'text', x: 0, y: 0, text: 'note' };
  f.scope.annotations.push(item); f.command.addLeader(item);
  f.command.handleLeaderAnnotationTargetClick({ target: target() }, { x: 0, y: 0 }); f.command.cancel();
  assert.equal(f.selected, item); assert.equal(item.type, 'text'); assert.equal(f.history.length, 0);
  f.allow(false); assert.equal(f.command.addLeader(item), false); assert.equal(f.pending, null);
});

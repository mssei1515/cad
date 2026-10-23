const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function fixture({ allowCommands = false } = {}) {
  const context = { window: {} };
  for (const name of ['GeometrySolver', ...(allowCommands ? [] : ['AnnotationAnchorConstraints'])]) {
    Object.defineProperty(context.window, name, { get() { throw new Error(`Unexpected dependency on ${name}`); } });
  }
  vm.createContext(context);
  const load = file => vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), context, { filename: file });
  for (const file of ['src/document/appearance.js', 'src/geometry/geometry_ref.js',
    'src/document/annotation_anchor_data.js', 'src/document/annotations.js']) load(file);
  return { data: context.window.AnnotationAnchorData, annotations: context.window.AnnotationData, context, load };
}

test('anchor annotations round trip with only data modules and retain editor object identity', () => {
  const { annotations } = fixture();
  const dimension = { offset: 3, display: { precision: 2 } };
  const item = { id: 'AN1', type: 'text', sketchId: 'S1', x: 2, y: 3, text: 'Note', anchorPosition: 'center-middle',
    anchorConstraints: [{ type: 'distance-x', geometryRef: { kind: 'point', path: ['B1', 'P1'] }, value: '12.5', dimension }] };
  const [normalized] = annotations.normalizeAnnotations([item]);
  assert.equal(normalized, item);
  assert.equal(normalized.anchorConstraints[0].value, 12.5);
  assert.notEqual(normalized.anchorConstraints[0].dimension, dimension);
  const stored = annotations.serializeAnnotation(normalized);
  assert.equal(stored.anchorPosition, 'center-middle');
  assert.equal(JSON.stringify(stored.anchorConstraints[0].geometryRef), '{"kind":"point","path":["B1","P1"]}');
  assert.equal(JSON.stringify(stored.anchorConstraints[0].dimension), JSON.stringify(dimension));
  const [reloaded] = annotations.normalizeAnnotations([JSON.parse(JSON.stringify(stored))]);
  assert.equal(JSON.stringify(annotations.serializeAnnotation(reloaded)), JSON.stringify(stored));
});

test('data-only annotation validation retains invalid relation errors and pre-error normalization', () => {
  const { annotations } = fixture();
  const point = { kind: 'point', path: ['P1'] }, line = { kind: 'line', path: ['L1'] };
  const cases = [
    { anchorPosition: 'unknown', expected: 'Invalid annotation anchor position' },
    { anchorConstraints: [{ type: 'horizontal', geometryRef: point }, { type: 'horizontal', geometryRef: point }] },
    { anchorConstraints: Array.from({ length: 3 }, () => ({ type: 'on-line', geometryRef: line })) },
    { anchorConstraints: [{ type: 'distance', geometryRef: point, value: -1 }] },
    { anchorConstraints: { type: 'coincident', geometryRef: point } },
  ];
  for (const { expected = 'Invalid annotation anchor constraints', ...fields } of cases) {
    const item = { id: 'AN1', type: 'text', text: 'Note', x: '3', anchorPosition: 'left-middle', ...fields };
    assert.throws(() => annotations.normalizeAnnotations([item], 'S1'), error => error.message === `AN1: ${expected}`);
    assert.equal(item.x, 3);
    assert.equal(item.sketchId, 'S1');
  }
});

test('legacy command APIs share the same data functions and placement choices', () => {
  const { data, context, load } = fixture({ allowCommands: true });
  load('src/commands/annotation_anchor_constraints.js');
  const commands = context.window.AnnotationAnchorConstraints;
  for (const name of ['POSITIONS', 'axes', 'degree', 'normalize', 'refs', 'referencesRemovedGeometry']) {
    assert.equal(commands[name], data[name], name);
  }
  assert.equal(commands.POSITIONS.length, 9);
  assert.equal(commands.LABELS[0], '左上');
  assert.equal(commands.LABELS[8], '右下');
  assert.equal(commands.LABELS.length, commands.POSITIONS.length);
});

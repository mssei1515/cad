const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/constraints/rebinding.js', 'src/editing/clipboard_transfer.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
const plain = value => JSON.parse(JSON.stringify(value));
const create = bundle => sandbox.window.ClipboardTransfer.create({ blockProjectionBundle: instance => { assert.equal(instance.id, 'new'); return bundle; }, blockProjectionLocalId: item => item.localId });

test('clipboard remapping recursively copies values without rewriting object keys or source data', () => {
  const api = create(), map = new Map([['P1', 'P9'], ['L1', 'L9']]);
  const source = { P1: 'P1', nested: [{ line: 'L1' }, null, 3, false], unknown: 'unchanged' };
  const result = api.remapClipboardValue(source, map);
  assert.deepEqual(plain(result), { P1: 'P9', nested: [{ line: 'L9' }, null, 3, false], unknown: 'unchanged' });
  assert.notEqual(result.nested, source.nested); assert.equal(source.P1, 'P1');
});

test('copied constraints translate absolute dimension and fixed values but keep relative placement', () => {
  const api = create(), source = { type: 'lineFixed', line: 'L1', p1x: 1, p1y: 2, p2x: 3, p2y: 4,
    reference: true, referenceSketchId: 'S2', dimension: { x: '5', y: 6, labelX: 7, labelY: 8, offsetU: 9, offsetN: 10, angleRadius: 20 } };
  const before = structuredClone(source), result = api.translatedClipboardConstraintData(source, new Map([['L1', 'L2']]), 100, -20);
  assert.equal(result.line, 'L2'); assert.equal(result.p1x, 101); assert.equal(result.p2y, -16);
  assert.deepEqual(plain(result.dimension), { x: 105, y: -14, labelX: 107, labelY: -12, offsetU: 9, offsetN: 10, angleRadius: 20 });
  assert.equal('reference' in result, false); assert.equal('referenceSketchId' in result, false); assert.deepEqual(source, before);
  for (const type of ['geometryFixed', 'arcEndpointFixed']) {
    const moved = api.translatedClipboardConstraintData({ type, x: 1, y: 2 }, new Map(), 3, 4);
    assert.equal(moved.x, 4); assert.equal(moved.y, 6);
  }
});

test('dimension coordinate conversion preserves existing null, missing and nonnumeric handling', () => {
  const api = create(), result = api.translatedClipboardConstraintData({ dimension: { x: null, y: 'invalid', labelX: 0 } }, new Map(), 10, 20);
  assert.equal(result.dimension.x, 10); assert.equal(result.dimension.y, 'invalid'); assert.equal(result.dimension.labelX, 10);
  assert.equal('labelY' in result.dimension, false);
});

test('projection remapping reconnects all kinds by local ID and preserves destination object identity', () => {
  const kinds = ['points', 'lines', 'circles', 'arcs', 'splines'];
  const bundle = Object.fromEntries(kinds.map(kind => [kind, [{ id: 'new-'+kind, localId: 7 }]]));
  const source = { projection: Object.fromEntries(kinds.map(kind => [kind, [{ id: 'old-'+kind, localId: '7' }, { id: 'missing', localId: 8 }]])) };
  const api = create(bundle), ids = new Map(), points = new Map(), lines = new Map(), primitives = new Map();
  api.mapClipboardBlockProjection(source, { id: 'new' }, ids, points, lines, primitives);
  for (const kind of kinds) {
    assert.equal(ids.get('old-'+kind), 'new-'+kind);
    assert.equal((kind === 'points' ? points : kind === 'lines' ? lines : primitives).get('new-'+kind), bundle[kind][0]);
  }
  assert.equal(ids.has('missing'), false); assert.equal(primitives.size, 3);
  delete bundle.splines;
  api.mapClipboardBlockProjection({}, { id: 'new' }, ids, points, lines, primitives);
  assert.equal(ids.size, 5);
});

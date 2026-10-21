const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/editing/geometry_ids.js', 'src/editing/document_ids.js', 'src/persistence/document_sequences.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
const create = sandbox.window.DocumentIds.create;
const plain = value => JSON.parse(JSON.stringify(value));
const items = (...ids) => ids.map(id => ({ id }));

test('document IDs keep independent prefixes and initial Sketch numbering without consuming preview reads', () => {
  const ids = create(), other = create();
  const prefixes = { sketch: 'S', annotation: 'AN', hatch: 'H', referenceImage: 'IMG', blockDefinition: 'B', blockInstance: 'BI', sketchProjection: 'SPI', mirror: 'MI', pattern: 'PI', free: 'FI' };
  const before = ids.snapshot(); before.sketchSeq = 999;
  for (const [kind, prefix] of Object.entries(prefixes)) {
    const first = kind === 'sketch' ? 2 : 1;
    assert.equal(ids.peek(kind), first); assert.equal(ids.peek(kind), first);
    assert.equal(ids.allocate(kind), prefix + first); assert.equal(ids.peek(kind), first + 1);
    assert.equal(other.peek(kind), first);
  }
  ids.reset(); assert.equal(ids.allocate('sketch'), 'S2'); assert.equal(ids.allocate('mirror'), 'MI1');
});

test('paste checkpoint restores only its eight sequence families and keeps other allocations', () => {
  const ids = create(), kinds = ['annotation', 'hatch', 'referenceImage', 'sketchProjection', 'mirror', 'pattern', 'free', 'blockInstance'];
  for (const kind of kinds) ids.allocate(kind);
  const checkpoint = ids.snapshot(kinds);
  for (const kind of kinds) ids.allocate(kind);
  ids.allocate('sketch'); ids.allocate('blockDefinition');
  ids.restore(checkpoint);
  for (const kind of kinds) assert.equal(ids.peek(kind), 2);
  assert.equal(ids.peek('sketch'), 3); assert.equal(ids.peek('blockDefinition'), 2);
  assert.deepEqual(Object.keys(checkpoint), ['annotationSeq', 'hatchSeq', 'referenceImageSeq', 'sketchProjectionInstanceSeq', 'mirrorInstanceSeq', 'patternInstanceSeq', 'freeInstanceSeq', 'blockInstanceSeq']);
  checkpoint.hatchSeq = 200; assert.equal(ids.peek('hatch'), 2);
});

test('scope and attachment reservation preserve high watermarks, source identity and Hatch reservation semantics', () => {
  const ids = create(), source = { sketches: items('S20'), annotations: items('AN8'), hatches: items('H4'), referenceImages: items('IMG6') };
  const before = JSON.stringify(source);
  ids.reserveAttachments(source);
  assert.equal(ids.peek('sketch'), 2); assert.equal(ids.peek('annotation'), 1);
  assert.equal(ids.peek('hatch'), 5); assert.equal(ids.peek('referenceImage'), 7);
  ids.reserveScope(source, 30);
  assert.equal(ids.allocate('sketch'), 'S21'); assert.equal(ids.allocate('annotation'), 'AN9');
  assert.equal(ids.allocate('hatch'), 'H30'); assert.equal(ids.allocate('referenceImage'), 'IMG7');
  ids.reserveScope({ sketches: [], annotations: [], hatches: [], referenceImages: [] }, 1);
  ids.reserveAttachments(null);
  assert.equal(ids.peek('hatch'), 31); assert.equal(ids.peek('referenceImage'), 8);
  assert.equal(JSON.stringify(source), before);
});

test('decoded document recovery replaces runtime sequences and round trips reserved and legacy counters', () => {
  const model = { sketches: items('S3'), hatches: [], nextHatchIndex: 44, geometryInstances: items('SPI6', 'MI7', 'PI8', 'FI9') };
  const definitions = [{ id: 'B4', annotations: items('AN5'), blockInstances: items('BI10'), points: items('P12') }];
  const sequences = sandbox.window.DocumentSequences.recover(model, definitions), ids = create();
  ids.restore(sequences);
  const { geometry, ...counters } = sequences;
  assert.deepEqual(plain(ids.snapshot()), plain(counters));
  assert.equal(ids.allocate('hatch'), 'H44'); assert.equal(ids.allocate('blockInstance'), 'BI11');
  assert.equal(ids.allocate('sketchProjection'), 'SPI7'); assert.equal(ids.allocate('free'), 'FI10');
  assert.equal(ids.snapshot().blockElementSeq, 13);
  ids.reset(); assert.equal(ids.snapshot().blockElementSeq, 1);
});

test('runtime reservations share existing allocators and distinguish Geometry attachments from the current Block scope', () => {
  const geometryIds = sandbox.window.GeometryIds.create(), documentIds = create(); let reads = 0, next = 30;
  const reservation = sandbox.window.DocumentIds.createReservation({ geometryIds, documentIds, nextHatchIndex: () => { reads++; return next; } });
  const source = { points: items('P9'), lines: items('L4'), hatches: items('H3'), referenceImages: items('IMG6'), sketches: items('S20'), annotations: items('AN8') };
  const before = JSON.stringify(source); assert.equal(reads, 0);
  assert.equal(reservation.geometry(source), undefined); assert.equal(reads, 0);
  assert.equal(geometryIds.peek('point'), 10); assert.equal(geometryIds.peek('line'), 5);
  assert.equal(documentIds.peek('hatch'), 4); assert.equal(documentIds.peek('referenceImage'), 7);
  assert.equal(documentIds.peek('sketch'), 2); assert.equal(documentIds.peek('annotation'), 1);
  assert.equal(reservation.scope(source), undefined); assert.equal(reads, 1);
  assert.equal(documentIds.allocate('sketch'), 'S21'); assert.equal(documentIds.allocate('annotation'), 'AN9'); assert.equal(documentIds.allocate('hatch'), 'H30');
  next = 80; reservation.scope(source); assert.equal(documentIds.peek('hatch'), 80); assert.equal(reads, 2);
  assert.equal(JSON.stringify(source), before);
});

test('reservation order preserves owner receivers, late Hatch counter reads and completed work on failure', () => {
  for (const fail of [null, 'geometry', 'attachments', 'index', 'scope']) {
    const events = [], source = {}, marker = new Error('reservation failed'); let counter = 1;
    const emit = name => { events.push(name); if (name === fail) throw marker; };
    const geometryIds = { reserve(value) { assert.equal(this, geometryIds); assert.equal(value, source); counter = 7; emit('geometry'); } };
    const documentIds = { reserveAttachments(value) { assert.equal(this, documentIds); assert.equal(value, source); counter = 20; emit('attachments'); },
      reserveScope(value, index) { assert.equal(this, documentIds); assert.equal(value, source); assert.equal(index, 20); emit('scope'); } };
    const reservation = sandbox.window.DocumentIds.createReservation({ geometryIds, documentIds, nextHatchIndex: function() {
      'use strict'; assert.equal(this, undefined); emit('index'); return counter;
    } });
    assert.deepEqual(events, []);
    if (fail) assert.throws(() => reservation.scope(source), error => error === marker); else assert.equal(reservation.scope(source), undefined);
    const expected = ['geometry','attachments','index','scope'];
    assert.deepEqual(events, fail ? expected.slice(0, expected.indexOf(fail) + 1) : expected);
    assert.equal(counter, fail === 'geometry' ? 7 : 20);
  }
});

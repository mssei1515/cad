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

test('derived clipboard copies rewrite paths, retain uncopied references and shift free placement', () => {
  const api=create(),map=new Map([['FI1','FI2'],['MI1','MI2'],['L1','L9'],['legacy','MI2@L9']]);
  const source={id:'FI1',type:'free',sketchId:'S1',sources:[{kind:'line',path:['L1']}],origin:{x:1,y:2},x:10,y:20,rotation:0.4,mirrorX:true,mirrorY:false,appearanceOverride:{color:'red'}};
  let copy=api.copiedGeometryInstance(source,map,'S2',3,4);
  assert.deepEqual(plain(copy.sources),[{kind:'line',path:['L9']}]);assert.deepEqual(plain(copy.origin),source.origin);assert.equal(copy.x,13);assert.equal(copy.y,24);
  map.delete('L1');copy=api.copiedGeometryInstance(source,map,'S1',3,4);assert.deepEqual(plain(copy.origin),source.origin);assert.equal(copy.sources[0].path[0],'L1');
  assert.deepEqual(plain(api.remapGeometryRef({kind:'line',path:['legacy']},map)),{kind:'line',path:['MI2','L9']});
  assert.deepEqual(plain(api.remapGeometryRef({kind:'line',path:['MI1','L1']},map)),{kind:'line',path:['MI2','L1']});
  assert.equal(source.x,10);
});

test('free origin follows the actual uniform source translation rather than copied owner IDs', () => {
  const api=create(),source={origin:{x:1,y:2},sourcePositions:[[{x:10,y:20},{x:30,y:40}]]},instance={sources:[{}]};
  assert.deepEqual(plain(api.copiedFreeOrigin(source,instance,()=>[{x:13,y:24},{x:33,y:44}])),{x:4,y:6});
  assert.deepEqual(plain(api.copiedFreeOrigin(source,instance,()=>[{x:10,y:20},{x:30,y:40}])),source.origin);
  assert.deepEqual(plain(api.copiedFreeOrigin(source,instance,()=>[{x:13,y:24},{x:30,y:40}])),source.origin);
});

const elementSandbox = { window: {} }; vm.createContext(elementSandbox);
const scriptSources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of scriptSources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), elementSandbox, { filename: file });
const elements = elementSandbox.window;
const elementTransfer = elements.ClipboardTransfer.create({});

test('annotation transfer shifts fixed anchors and leader points and reconnects geometry and axis paths', () => {
  const source = { id: 'AN1', type: 'leader', sketchId: 'S1', x: 1, y: 2,
    start: { x: 3, y: 4 }, elbow: { x: 5, y: 6 }, end: { x: 7, y: 8 },
    geometryRef: { kind: 'line', path: ['L1'] },
    anchorConstraints: [{ type: 'fixed', anchor: 'topLeft', x: 9, y: 10 },
      { type: 'distance', geometryRef: { kind: 'point', path: ['BI1', 'P1'] }, axisRef: { kind: 'line', path: ['L1'] }, value: 20 }] };
  const before = structuredClone(source), copy = elements.AnnotationData.serializeAnnotation(source);
  const result = elementTransfer.translateAnnotation(copy, new Map([['L1', 'L2'], ['BI1', 'BI2']]), 100, -10);
  assert.equal(result, copy); assert.equal(copy.x, 101); assert.equal(copy.y, -8);
  assert.deepEqual(plain(copy.start), { x: 103, y: -6 }); assert.deepEqual(plain(copy.end), { x: 107, y: -2 });
  assert.equal(copy.geometryRef.path[0], 'L2'); assert.equal(copy.anchorConstraints[0].x, 109);
  assert.equal(copy.anchorConstraints[0].y, 0); assert.equal(copy.anchorConstraints[1].value, 20);
  assert.deepEqual(plain(copy.anchorConstraints[1].geometryRef.path), ['BI2', 'P1']);
  assert.equal(copy.anchorConstraints[1].axisRef.path[0], 'L2'); assert.deepEqual(source, before);
});

test('hatch transfer returns detached mapped boundaries and rejects missing geometry without changing the source', () => {
  const circle = { kind: 'circle', id: 'C1', center: { x: 0, y: 0 }, radius: 10 };
  const face = elements.HatchRegionEngine.findFaceAtPoint([circle], { x: 0, y: 0 });
  assert.equal(face.ok, true);
  const source = { id: 'H1', sketchId: 'S1', seed: { x: '2', y: 3 }, boundaryLoops: plain(face.boundaryLoops), appearance: {} };
  const before = structuredClone(source);
  const result = elementTransfer.copiedHatch(source, new Map([['H1', 'H2'], ['C1', 'C2']]), 'S2', 5, -4);
  assert.equal(result.id, 'H2'); assert.equal(result.sketchId, 'S2'); assert.deepEqual(plain(result.seed), { x: 7, y: -1 });
  assert.equal(result.boundaryLoops[0].spans[0].source.path[0], 'C2');
  assert.equal(elementTransfer.copiedHatch(source, new Map(), 'S2', 5, -4), null);
  result.seed.x = 100; result.boundaryLoops[0].spans[0].source.path[0] = 'changed'; assert.deepEqual(source, before);
});

test('reference image transfer shifts only placement and preserves scale rotation and embedded data', () => {
  const source = { id: 'IMG1', x: 5, y: 6, scale: 2, rotation: 0.4, dataUrl: 'data:image/png;base64,AA==' };
  const copy = elements.ReferenceImageData.serializeReferenceImage(source);
  const result = elementTransfer.translateReferenceImage(copy, -3, 10);
  assert.equal(result, copy); assert.equal(copy.x, 2); assert.equal(copy.y, 16);
  assert.equal(copy.scale, 2); assert.equal(copy.rotation, 0.4); assert.equal(copy.dataUrl, source.dataUrl);
  assert.equal(source.x, 5); assert.equal(source.y, 6);
});

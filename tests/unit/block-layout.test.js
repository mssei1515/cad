const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {} };
vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
const { Point, Line, Arc } = sandbox.window.GeometrySolver;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const inSketch = (item, sketchId = 'S1') => Object.assign(item, { sketchId });
function definition(id) {
  return { id, revision: 1, sketches: [{ id: 'ROOT', kind: 'root' }, { id: 'S1' }, { id: 'S2' }], points: [], lines: [], circles: [], arcs: [], splines: [], annotations: [], hatches: [], blockInstances: [], geometryInstances: [] };
}
function fixture(definitions) {
  const catalog = sandbox.window.BlockCatalog.create({ definitions: () => definitions });
  const instanceProjections = sandbox.window.InstanceProjection.create({ elementSketchId: item => item.sketchId, applicationText: (_ja, en) => en });
  const hatchPrimitivesFromElements = elements => elements.filter(item => item instanceof Line).map(item => ({ kind: 'line', id: item.id, p1: item.p1, p2: item.p2 }));
  const hatchPrimitivesForScope = scope => hatchPrimitivesFromElements(scope.lines);
  const projections = sandbox.window.BlockProjection.create({ blockCatalog: catalog, ...instanceProjections, hatchPrimitivesFromElements, hatchPrimitivesForScope });
  const layout = sandbox.window.BlockLayout.create({ catalog, projections, instanceProjections, hatchPrimitivesForScope, annotationBounds: annotation => annotation.bounds });
  return { layout, projections };
}
function line(id, x1, y1, x2, y2, sketchId = 'S1') {
  return inSketch(new Line(id, inSketch(new Point(`${id}a`, x1, y1), sketchId), inSketch(new Point(`${id}b`, x2, y2), sketchId)), sketchId);
}

test('enabled sketches and arc sweeps determine local placement bounds', () => {
  const d = definition('D');
  d.lines.push(line('L', -100, -100, 100, 100, 'S2'));
  d.arcs.push(inSketch(new Arc('A', new Point('C', 0, 0), 10, 0, Math.PI / 2)));
  const { layout } = fixture([d]);
  const bounds = layout.blockLocalGeometryBounds(d, ['S1']);
  near(bounds.minX, 0); near(bounds.minY, 0); near(bounds.maxX, 10); near(bounds.maxY, 10);
  near(layout.blockLocalGeometryBounds(d).minX, -100);
});

test('nested bounds transform corners while recursive definition cycles terminate', () => {
  const parent = definition('parent'), child = definition('child');
  child.lines.push(line('L', 0, 0, 10, 4));
  parent.blockInstances.push({ id: 'nested', definitionId: 'child', sketchId: 'S1', x: 20, y: 30, rotation: Math.PI / 2 });
  child.blockInstances.push({ id: 'cycle', definitionId: 'parent', sketchId: 'S1', x: 0, y: 0, rotation: 0 });
  const { layout } = fixture([parent, child]);
  const bounds = layout.blockLocalGeometryBounds(parent);
  near(bounds.minX, 16); near(bounds.maxX, 20); near(bounds.minY, 30); near(bounds.maxY, 40);
});

test('hidden annotations and hatches are excluded while unresolved hatch seeds contribute', () => {
  const d = definition('D');
  d.annotations.push({ sketchId: 'S1', visible: false, bounds: { x1: -100, y1: -100, x2: 100, y2: 100 } });
  d.hatches.push({ sketchId: 'S1', boundaryLoops: [], seed: { x: 7, y: 9 } });
  d.hatches.push({ sketchId: 'S1', appearance: { visible: false }, boundaryLoops: [], seed: { x: 300, y: 400 } });
  const { layout } = fixture([d]);
  const bounds = layout.blockLocalGeometryBounds(d);
  near(bounds.minX, 7); near(bounds.maxX, 7); near(bounds.minY, 9); near(bounds.maxY, 9);
});

test('placement anchor rotates the chosen center and empty definitions use origin', () => {
  const d = definition('D'); d.origin = { x: 3, y: 5 };
  const { layout } = fixture([d]);
  const anchor = { x: 20, y: 30 }, rotation = Math.PI / 2;
  const position = layout.blockInstanceTranslationForAnchor(d, ['S1'], anchor, rotation);
  near(position.x, 25); near(position.y, 27);
  const center = layout.blockInstanceDisplayCenter({ definitionId: 'D', ...position, rotation });
  near(center.x, anchor.x); near(center.y, anchor.y);
  assert.equal(layout.blockLocalGeometryBounds(null), null);
});

test('derived geometry inside a definition contributes through the projection service', () => {
  const d = definition('D');
  d.lines.push(line('L', 0, 2, 10, 4), line('axis', 0, 0, 10, 0));
  d.points.push(...d.lines.flatMap(l => [l.p1, l.p2]));
  d.geometryInstances.push({ id: 'MI1', type: 'mirror', sketchId: 'S1', sources: [{ kind: 'line', path: ['L'] }], axis: { kind: 'line', path: ['axis'] } });
  const { layout } = fixture([d]);
  const bounds = layout.blockLocalGeometryBounds(d);
  near(bounds.minY, -4); near(bounds.maxY, 4); near(bounds.maxX, 10);
});

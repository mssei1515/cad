const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const { Point, Line } = sandbox.window.GeometrySolver;
function fixture() {
  const document = sandbox.window.DocumentState.create(); sandbox.window.DocumentState.resetDefaults(document);
  const scope = sandbox.window.DocumentState.create(); sandbox.window.DocumentState.resetDefaults(scope);
  const catalog = sandbox.window.BlockCatalog.create({ definitions: () => document.blockDefinitions });
  const sketches = sandbox.window.SketchContext.create({ currentScope: () => scope, constraintGraphNodes() { return []; } });
  const state = sandbox.window.BlockState.create({
    blockDefinitionDrawableSketchIds: catalog.blockDefinitionDrawableSketchIds,
    blockDefinitionGeometrySketchIds: catalog.blockDefinitionGeometrySketchIds,
    isDrawableSketch: sketches.isDrawableSketch, firstDrawableSketchId: sketches.firstDrawableSketchId,
  });
  return { document, scope, normalize: parent => state.normalize(document, scope, parent) };
}
const instance = (id, definitionId, extra = {}) => ({ id, definitionId, ...extra });

test('block normalization retains geometry identity and repairs root, sketch membership and appearance', () => {
  const f = fixture(), a = new Point('P1', 0, 0), b = new Point('P2', 5, 0), line = new Line('L1', a, b);
  a.sketchId = 'ROOT'; b.sketchId = 'missing'; line.sketchId = 'S2'; line.appearance = { color: '#ABCDEF' };
  const points = [a, b], definition = { id: 'B1', points, lines: [line], sketches: [
    { id: 'ROOT', kind: 'root', appearance: { lineWidth: 4, color: '#123456' } },
    { id: 'S2', parentSketchId: 'S2', appearance: { lineWidth: 2 } },
  ], activeSketchId: 'missing', annotations: [{ type: 'text', text: 'memo' }] };
  f.document.blockDefinitions = [definition]; f.normalize();
  assert.equal(f.document.blockDefinitions[0], definition); assert.equal(definition.points, points);
  assert.equal(definition.lines[0], line); assert.equal(line.p1, a);
  assert.equal(a.sketchId, 'S2'); assert.equal(b.sketchId, 'S2'); assert.equal(definition.activeSketchId, 'S2');
  assert.equal(definition.sketches[1].parentSketchId, 'ROOT'); assert.equal(definition.sketches[1].appearance.color, '#123456');
  assert.equal(definition.sketches[1].appearance.lineWidth, 2); assert.equal(line.appearance.color, '#abcdef');
  assert.equal(Object.keys(definition.sketches[0].appearance).length, 0);
  assert.equal(definition.annotations[0].sketchId, 'S2');
  const once = JSON.stringify(definition); f.normalize(); assert.equal(JSON.stringify(definition), once);
});

test('inferred ownership filters nested placements and active scope accepts only its own children', () => {
  const f = fixture();
  const child = { id: 'child' }, parent = { id: 'parent', blockInstances: [instance('nested', 'child'), instance('bad', 'missing')] };
  f.document.blockDefinitions = [parent, child];
  const top = instance('top', 'parent'), nested = instance('active', 'child');
  f.scope.blockInstances = [top, nested]; f.normalize();
  assert.equal(child.parentDefinitionId, 'parent'); assert.equal(parent.blockInstances.length, 1);
  assert.equal(f.scope.blockInstances.length, 1); assert.equal(f.scope.blockInstances[0], top);
  f.scope.blockInstances = [top, nested]; f.normalize('parent');
  assert.equal(f.scope.blockInstances.length, 1); assert.equal(f.scope.blockInstances[0], nested);
});

test('ambiguous ownership is not inferred and self ownership is cleared', () => {
  const f = fixture(), child = { id: 'child' }, self = { id: 'self', parentDefinitionId: 'self' };
  const a = { id: 'a', blockInstances: [instance('a1', 'child')] }, b = { id: 'b', blockInstances: [instance('b1', 'child')] };
  f.document.blockDefinitions = [a, b, child, self]; f.normalize();
  assert.equal(child.parentDefinitionId, null); assert.equal(self.parentDefinitionId, null);
  assert.equal(a.blockInstances.length, 0); assert.equal(b.blockInstances.length, 0);
});

test('placement IDs, numeric values and enabled sketch fallback preserve projected-only content', () => {
  const f = fixture(); const definition = { id: 'B', sketches: [{ id: 'S2' }], geometryInstances: [{ sketchId: 'S2' }] };
  f.document.blockDefinitions = [null, definition, { id: 'B' }];
  const placement = instance('same', 'B', { x: '12', y: 'bad', rotation: '90', fixed: 1, enabledSketchIds: ['missing'], sketchId: 'missing' });
  f.scope.blockInstances = [placement, instance('same', 'B', { enabledSketchIds: ['S2', 'S2'] }), instance('bad', 'missing')];
  f.normalize(); assert.equal(f.document.blockDefinitions[1].id, 'B2-2');
  assert.equal(f.scope.blockInstances.length, 2); assert.equal(f.scope.blockInstances[0], placement);
  assert.equal(f.scope.blockInstances[1].id, 'BI2-2'); assert.equal(placement.sketchId, 'S1');
  assert.equal(placement.x, 12); assert.equal(placement.y, 0); assert.equal(placement.rotation, 90); assert.equal(placement.fixed, true);
  assert.deepEqual(Array.from(placement.enabledSketchIds), ['S2']);
  assert.deepEqual(Array.from(f.scope.blockInstances[1].enabledSketchIds), ['S2']);
});

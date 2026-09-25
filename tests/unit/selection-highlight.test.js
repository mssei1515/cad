const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/selection_highlight.js'), 'utf8'), sandbox);
function fixture() {
  let hoveredDimension = null, draws = 0;
  const selection = { points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [] };
  const highlight = sandbox.window.SelectionHighlight.create({ canvasSelection: selection,
    blockProjectionBundle: instance => instance.bundle, geometryRefsEqual: (a, b) => a === b, geometryRefForItem: item => item.ref,
    constraintGraphNodes: item => item.nodes, constraintHighlightNodes: item => item.nodes,
    effectiveSelectedConstraint: () => selection.constraint, targetFromConstraint: item => item.dimension,
    getHoveredDimension: () => hoveredDimension, setHoveredDimension: value => { hoveredDimension = value; }, draw: () => draws++ });
  return { highlight, selection, get dimension() { return hoveredDimension; }, get draws() { return draws; } };
}
test('stale pointer leave does not clear a newer hover and dimension hover clears only its own marker', () => {
  const f = fixture(), first = { dimension: true }, second = { dimension: true };
  f.highlight.setSidebarHover('constraint', first, f.highlight.sidebarHoverElementsForConstraint(first));
  assert.equal(f.dimension, first); assert.equal(f.highlight.current.elements.size, 0);
  f.highlight.setSidebarHover('constraint', second, new Set());
  f.highlight.clearSidebarHover('constraint', first);
  assert.equal(f.dimension, second); assert.equal(f.draws, 2);
  f.highlight.clearSidebarHover('geometry', second); assert.equal(f.draws, 2);
  f.highlight.clearSidebarHover('constraint', second);
  assert.equal(f.dimension, null); assert.equal(f.highlight.current, null); assert.equal(f.draws, 3);
  f.highlight.setSidebarHover('geometry', {}, new Set()); const before = f.draws;
  f.highlight.reset(); assert.equal(f.highlight.current, null); assert.equal(f.draws, before);
});
test('projection identity survives regenerated objects while ordinary equal ids do not alias', () => {
  const f = fixture(), original = { blockProjection: {}, ref: 'B1/L1' }, regenerated = { blockProjection: {}, ref: 'B1/L1' };
  f.highlight.setSidebarHover('geometry', original, new Set([original]));
  assert.equal(f.highlight.isSidebarHoveredElement(regenerated), true);
  assert.equal(f.highlight.isSidebarHoveredElement({ ref: 'B1/L1' }), false);
  assert.equal(f.highlight.isSidebarHoveredElement({ blockProjection: {}, ref: 'B2/L1' }), false);
  f.selection.constraint = { nodes: [original] };
  assert.equal(f.highlight.isSelectedConstraintRelatedElement(regenerated), true);
});
test('selection reference expansion includes primitive endpoints and block projections without duplicates', () => {
  const f = fixture(), a = {}, b = {}, line = { p1: a, p2: b }, projected = {};
  f.selection.points.push(a); f.selection.lines.push(line);
  const block = { bundle: { points: [projected], lines: [], circles: [], arcs: [] } };
  f.selection.blockInstances.push(block);
  const elements = f.highlight.selectedConstraintReferenceElements();
  assert.deepEqual(Array.from(elements), [a, line, b, block, projected]);
  assert.equal(f.highlight.constraintDirectlyReferencesCanvasSelection({ nodes: [b] }), true);
  assert.equal(f.highlight.constraintDirectlyReferencesCanvasSelection({ nodes: [{}] }), false);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);
const { AnnotationAnchorConstraints: A, AnnotationData: D, Appearance } = sandbox.window;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function renderer() {
  const calls = [], ctx = {}, viewport = { scale: Appearance.CSS_PX_PER_MM };
  for (const key of ['save', 'restore', 'translate', 'rotate', 'fillText', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'rect', 'setLineDash', 'fill', 'closePath']) ctx[key] = (...args) => calls.push([key, ...args]);
  ctx.measureText = text => ({ width: text.length * 2 });
  let target = { x: 30, y: 40 }, arrow = { x: 0, y: 0 }, hover = false;
  const api = sandbox.window.AnnotationRenderer.create({ ctx, viewport, withCanvasState: f => f(), annotationLeaderAnchor: () => arrow, annotationDisplayColor: () => 'blue', appearanceLineDash: type => type === 'dashed' ? [2, 1] : [],
    effectiveAnnotationStyle: element => Appearance.resolveLeaderAppearance({}, {}, {}, element.style), showFrame: () => hover,
    resolvePlacement: (element, base) => A.resolve(element, base, () => target) });
  return { api, calls, viewport, target: p => { target = p; }, arrow: p => { arrow = p; }, hover: value => { hover = value; } };
}
const note = extra => ({ id: 'AN1', type: 'text', text: 'AB\nC', sketchId: 'S1', x: 10, y: 20, anchorPosition: 'left-middle', appearanceInheritance: true, style: { textHeight: 5, framePaddingX: 2, framePaddingY: 3, fixedDisplaySize: false, displayScale: 1 }, ...extra });

test('nine positions keep the model anchor while changing text, padding, alignment, rotation and zoom', () => {
  const h = renderer();
  for (const position of A.POSITIONS) for (const textAlign of ['left', 'center', 'right']) {
    const item = note({ anchorPosition: position, style: { ...note().style, rotation: 0.7, textAlign } });
    for (const scale of [Appearance.CSS_PX_PER_MM, 2 * Appearance.CSS_PX_PER_MM]) {
      h.viewport.scale = scale;
      const layout = h.api.annotationTextLayout(item);
      near(layout.anchorX, 10); near(layout.anchorY, 20);
      const [column, row] = position.split('-');
      const fractions = { left: 0, center: 0.5, right: 1, top: 0, middle: 0.5, bottom: 1 };
      const localX = layout.frame.left + layout.frame.width * fractions[column];
      const localY = layout.frame.top + layout.frame.height * fractions[row];
      near(layout.x + localX * Math.cos(layout.rotation) - localY * Math.sin(layout.rotation), 10);
      near(layout.y + localX * Math.sin(layout.rotation) + localY * Math.cos(layout.rotation), 20);
      const measured = h.api.annotationTextMetrics(item, layout);
      near(measured.x, layout.x); near(measured.y, layout.y);
    }
  }
});
test('one-way relations follow target changes without mutating geometry; rotated block axes remain local', () => {
  const point = { x: 30, y: 40 }, item = note({ anchorConstraints: [{ type: 'distance-x', geometryRef: { kind: 'point', path: ['P1'] }, value: 5 }, { type: 'horizontal', geometryRef: { kind: 'point', path: ['P1'] } }] });
  let result = A.resolve(item, item, () => point); near(result.x, 35); near(result.y, 40);
  point.x = 50; point.y = 60; result = A.resolve(item, item, () => point); near(result.x, 55); near(result.y, 60); assert.deepEqual(point, { x: 50, y: 60 });
  const projected = { ...item, annotationTransformOrigin: { x: 100, y: 200 }, annotationTransformRotation: Math.PI / 2 };
  result = A.resolve(projected, { x: 90, y: 210 }, () => ({ x: 60, y: 230 })); near(result.x, 60); near(result.y, 235);
});
test('independent leader arrow and constrained label both follow their targets', () => {
  const h = renderer(), item = note({ type: 'leader', textPlacement: 'anchor', start: { x: 0, y: 0 }, elbow: { x: 10, y: 30 }, end: { x: 40, y: 30 }, shelfReferenceScale: Appearance.CSS_PX_PER_MM,
    anchorConstraints: [{ type: 'coincident', geometryRef: { kind: 'point', path: ['P1'] } }] });
  const before = JSON.stringify(item), first = h.api.annotationTextLayout(item);
  near(first.anchorX, 30); near(first.anchorY, 40);
  h.arrow({ x: -20, y: 15 }); const second = h.api.annotationTextLayout(item); near(second.anchorX, 30); near(second.anchorY, 40);
  h.target({ x: 70, y: 80 }); const third = h.api.annotationTextLayout(item); near(third.anchorX, 70); near(third.anchorY, 80);
  assert.notDeepEqual(h.api.annotationLeaderDisplayGeometry(item).elbow, item.elbow); assert.equal(JSON.stringify(item), before);
});
test('hidden borders appear only for interaction; visible border uses its own dash and color', () => {
  const h = renderer(), item = note(); h.api.drawAnnotationText(item); assert.equal(h.calls.some(call => call[0] === 'rect'), false);
  h.hover(true); h.api.drawAnnotationText(item); assert.equal(h.calls.filter(call => call[0] === 'rect').length, 2);
  h.hover(false); item.style.frameVisible = true; item.style.frameLineType = 'dashed'; h.api.drawAnnotationText(item);
  assert.ok(h.calls.some(call => call[0] === 'setLineDash' && call[1].length === 2 && call[1][0] === 2));
});
test('shelf preview and committed anchor layout agree with padding, rotation and every chosen point', () => {
  const h = renderer();
  for (const position of A.POSITIONS) {
    const preview = note({ type: 'leader', textPlacement: 'shelf', start: { x: 0, y: 0 }, elbow: { x: 10, y: 30 }, end: { x: 50, y: 30 }, anchorPosition: position,
      shelfReferenceScale: Appearance.CSS_PX_PER_MM, style: { ...note().style, rotation: 0.4 } });
    const layout = h.api.annotationTextLayout(preview);
    const committed = { ...preview, textPlacement: 'anchor', x: layout.anchorX, y: layout.anchorY };
    const result = h.api.annotationTextLayout(committed), shelf = h.api.annotationLeaderDisplayGeometry(committed);
    near(result.x, layout.x); near(result.y, layout.y); near(shelf.elbow.x, 10); near(shelf.elbow.y, 30); near(shelf.end.x, 50); near(shelf.end.y, 30);
  }
});
test('serialization retains frame, anchor and fixed coordinates; invalid and duplicate-axis relations are rejected', () => {
  const item = note({ anchorConstraints: [{ type: 'fixed', x: 10, y: 20 }] });
  const saved = D.serializeAnnotation(item), loaded = D.normalizeAnnotations([structuredClone(saved)])[0];
  assert.deepEqual(JSON.parse(JSON.stringify(D.serializeAnnotation(loaded))), JSON.parse(JSON.stringify(saved)));
  assert.throws(() => D.normalizeAnnotations([note({ anchorConstraints: [{ type: 'distance-x', value: 'bad', geometryRef: { kind: 'point', path: ['P1'] } }] })]), /Invalid/);
  assert.throws(() => D.normalizeAnnotations([note({ anchorConstraints: [{ type: 'fixed', x: 1, y: 2 }, { type: 'fixed', x: 3, y: 4 }] })]), /Invalid/);
  assert.equal(Appearance.leaderDefaults().textHeight, 5); near(Appearance.normalizeAnnotationStyle({}).textHeight, 13 / Appearance.CSS_PX_PER_MM);
});
test('constraint drafting is atomic, rejects another relation on the same axis and cancels without edits', () => {
  let pending = null, records = 0;
  const item = note(), target = { id: 'P1', sketchId: 'S1', x: 0, y: 0 };
  const command = A.create({ getCommand: () => pending, setCommand: value => { pending = value; }, selectedAnnotation: () => item, byId: () => item,
    canEdit: () => true, canReference: () => true, anchor: () => ({ x: item.x, y: item.y }), materialize: () => {},
    pointRef: point => sandbox.window.GeometryRef.create('point', point.id), resolveRef: () => target,
    recordHistory: () => { records++; }, updateUI: () => {}, draw: () => {}, setHint: () => {}, cancelCommands: () => { pending = null; }, applicationText: (ja, en) => en });
  const original = JSON.stringify(item);
  assert.equal(command.start('horizontal'), true); command.click(target); assert.equal(JSON.stringify(item), original);
  command.onAction('cancel'); assert.equal(JSON.stringify(item), original); assert.equal(records, 0);
  command.start('horizontal'); command.click(target); command.onAction('finish'); assert.equal(records, 1);
  const constrained = JSON.stringify(item);
  command.start('coincident'); command.click(target); assert.equal(command.onAction('finish'), false); assert.equal(JSON.stringify(item), constrained); assert.equal(records, 1);
  command.onAction('cancel'); command.start('distance'); command.click(target); command.onSetting('axis', 'x'); command.onSetting('value', -5); command.onAction('finish');
  assert.equal(records, 2); const resolved = A.resolve(item, item, () => target); near(resolved.x, -5); near(resolved.y, 0); assert.deepEqual(target, { id: 'P1', sketchId: 'S1', x: 0, y: 0 });
});

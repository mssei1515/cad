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

test('materialization skips display reads for established anchors and capture preserves their stored coordinates', () => {
  const calls = [], element = { type: 'text', x: 10, y: 20, anchorPosition: 'left-middle' };
  const api = A.createMaterialization({ annotationPlacementAnchor: item => { calls.push(item); return { x: 30, y: 40 }; },
    annotationLeaderDisplayGeometry: () => { throw Error('text must not read leader geometry'); },
    annotationLeaderAnchor: () => { throw Error('text must not read leader target'); },
    effectiveAnnotationStyle: () => { throw Error('existing anchor must not read alignment'); } });
  assert.deepEqual(calls, []); const before = JSON.stringify(element), position = api.materialize(element);
  assert.equal(position.x, 10); assert.equal(position.y, 20); assert.deepEqual(calls, []);
  position.x = 100; assert.equal(element.x, 10);
  const captured = api.materialize(element, { capture: true });
  assert.equal(captured.x, 30); assert.equal(captured.y, 40); assert.equal(calls[0], element);
  assert.equal(JSON.stringify(element), before);
});

test('new text anchors copy display coordinates before resolving alignment and retain the source position object', () => {
  const anchor = { x: 12, y: 34 }, element = { type: 'text', x: 1, y: 2 }, calls = [];
  const api = A.createMaterialization({ annotationPlacementAnchor: item => { assert.equal(item, element); return anchor; },
    effectiveAnnotationStyle: item => { calls.push([item.x, item.y]); return { textAlign: 'right' }; } });
  const position = api.materialize(element);
  assert.notEqual(position, anchor); assert.equal(position.x, 12); assert.equal(position.y, 34);
  assert.deepEqual(calls, [[12, 34]]); assert.equal(element.anchorPosition, 'right-middle');
  position.x = 99; assert.equal(anchor.x, 12); assert.equal(element.x, 12);
});

test('leader materialization reverses shelf scaling around its resolved anchor and capture falls back to stored start without overwriting an existing anchor', () => {
  let target = { x: 10, y: 20 };
  const calls = [], api = A.createMaterialization({ annotationPlacementAnchor: () => ({ x: 110, y: 220 }),
    annotationLeaderDisplayGeometry: element => { calls.push(['geometry', element]); return { shelfScale: 2 }; },
    annotationLeaderAnchor: element => { calls.push(['target', element]); return target; },
    effectiveAnnotationStyle: element => { assert.equal(element.textPlacement, 'anchor'); return { textAlign: 'center' }; } });
  const element = { type: 'leader', x: 1, y: 2, start: { x: 50, y: 100 }, textPlacement: 'shelf' };
  const position = api.materialize(element);
  assert.equal(position.x, 100); assert.equal(position.y, 200); assert.equal(element.x, 100); assert.equal(element.y, 200);
  assert.equal(element.anchorPosition, 'center-middle'); assert.equal(element.textPlacement, 'anchor');
  assert.deepEqual(calls.map(c => c[0]), ['geometry', 'target']);
  target = null; element.textPlacement = 'shelf';
  const captured = api.materialize(element, { capture: true });
  assert.equal(captured.x, 80); assert.equal(captured.y, 160);
  assert.equal(element.x, 100); assert.equal(element.y, 200); assert.equal(element.anchorPosition, 'center-middle');
  assert.equal(element.textPlacement, 'anchor'); assert.equal(element.start.x, 50); assert.equal(element.start.y, 100);
});
function renderer(handles = false, hoveredHandle = null) {
  const calls = [], ctx = {}, viewport = { scale: Appearance.CSS_PX_PER_MM };
  for (const key of ['save', 'restore', 'translate', 'rotate', 'fillText', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'rect', 'arc', 'setLineDash', 'fill', 'closePath']) ctx[key] = (...args) => calls.push([key, ...args]);
  ctx.fill = () => calls.push(['fill', ctx.fillStyle]);
  ctx.measureText = text => ({ width: text.length * 2 });
  let target = { x: 30, y: 40 }, arrow = { x: 0, y: 0 }, hover = false;
  const api = sandbox.window.AnnotationRenderer.create({ ctx, viewport, withCanvasState: f => f(), annotationLeaderAnchor: () => arrow, annotationDisplayColor: () => 'blue', appearanceLineDash: type => type === 'dashed' ? [2, 1] : [],
    effectiveAnnotationStyle: element => Appearance.resolveLeaderAppearance({}, {}, {}, element.style), showFrame: () => hover, showResizeHandles: () => handles, isResizeHandleHovered: (element, handle) => handle.resizeX === hoveredHandle?.resizeX && handle.resizeY === hoveredHandle?.resizeY,
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
      const placement = h.api.annotationPlacementAnchor(item);
      near(placement.x, 10); near(placement.y, 20);
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
  h.hover(true); h.api.drawAnnotationText(item); assert.equal(h.calls.filter(call => call[0] === 'rect').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'arc').length, 1);
  h.hover(false); item.style.frameVisible = true; item.style.frameLineType = 'dashed'; h.api.drawAnnotationText(item);
  assert.ok(h.calls.some(call => call[0] === 'setLineDash' && call[1].length === 2 && call[1][0] === 2));
});
test('selected annotation handles are distinct from its anchor and only the handles resize', () => {
  const h = renderer(true), item = note({ anchorPosition: 'right-top' }); h.hover(true);
  const layout = h.api.annotationTextLayout(item), handles = sandbox.window.AnnotationRenderer.resizeHandles(layout);
  assert.equal(handles.length, 3); h.api.drawAnnotationText(item);
  assert.equal(h.calls.filter(call => call[0] === 'fill').length, 3);
  let selected = false, enabled = false;
  const query = sandbox.window.AnnotationSpatialQuery.create({ viewportScale: () => h.viewport.scale, annotationTextWorldHeight: () => 5, formatDisplayNumber: String,
    allAnnotations: () => [item], isVisibleSketchId: () => true, activeSketchId: () => 'S1', annotationLeaderAnchor: () => null,
    annotationTextLayout: () => layout, isFrameInteractive: () => selected, resizeHandlesEnabled: () => enabled });
  const handle = handles[0], pointer = { x: layout.x + handle.x, y: layout.y + handle.y };
  assert.notEqual(query.hitAnnotationElement(pointer.x, pointer.y).part, 'frame');
  selected = true; assert.equal(query.hitAnnotationElement(pointer.x, pointer.y).part, 'frame-enable');
  enabled = true; assert.equal(query.hitAnnotationElement(pointer.x, pointer.y).part, 'frame');
  assert.equal(query.hitAnnotationElement(layout.anchorX, layout.anchorY).part, 'anchor');
  assert.notEqual(query.hitAnnotationElement(layout.x + layout.frame.left, layout.y + layout.frame.top + layout.frame.height / 4).part, 'frame');
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
  assert.equal(command.start('horizontal'), true); assert.equal(JSON.stringify(item), original);
  command.cancel(); assert.equal(JSON.stringify(item), original); assert.equal(records, 0);
  command.start('horizontal'); command.click(target); assert.equal(records, 1); assert.equal(pending, null);
  const constrained = JSON.stringify(item);
  command.start('coincident'); command.click(target); assert.equal(command.complete(), false); assert.equal(JSON.stringify(item), constrained); assert.equal(records, 1);
  command.cancel(); command.start('distance'); command.click(target); command.submitDistance(5, 'x');
  assert.equal(records, 2); const resolved = A.resolve(item, item, () => target); near(resolved.x, 5); near(resolved.y, 0); assert.deepEqual(target, { id: 'P1', sketchId: 'S1', x: 0, y: 0 });
});

test('curve, concentric, symmetry and length constraints solve only the annotation point', () => {
  const G = sandbox.window.GeometrySolver, ref = (kind, id) => sandbox.window.GeometryRef.create(kind, id);
  const origin = new G.Point('P1', 0, 0), end = new G.Point('P2', 100, 0);
  const line = new G.Line('L1', origin, end), circle = new G.Circle('C1', origin, 10), arc = new G.Arc('A1', origin, 10, 0, Math.PI / 2);
  const target = new G.Point('P3', 5, 7), spline = new G.Spline('SP1', [origin, new G.Point('PM', 50, 0), end]), targets = { L1: line, C1: circle, A1: arc, P3: target, SP1: spline };
  spline.curve();
  const resolve = r => targets[r.path[0]], original = JSON.stringify(targets);
  const cases = [
    [{ type: 'on-line', geometryRef: ref('line', 'L1') }, p => Math.abs(p.y) < 1e-6],
    [{ type: 'on-spline', geometryRef: ref('spline', 'SP1'), parameter: 0.5 }, p => Math.abs(p.y) < 1e-6 && p.x >= 0 && p.x <= 100],
    [{ type: 'on-circle', geometryRef: ref('circle', 'C1') }, p => Math.abs(Math.hypot(p.x, p.y) - 10) < 1e-6],
    [{ type: 'concentric', geometryRef: ref('circle', 'C1') }, p => Math.hypot(p.x, p.y) < 1e-6],
    [{ type: 'endpoint', geometryRef: ref('arc', 'A1'), endpoint: 'end' }, p => Math.hypot(p.x, p.y - 10) < 1e-6],
    [{ type: 'symmetry', geometryRef: ref('point', 'P3'), axisRef: ref('line', 'L1') }, p => Math.hypot(p.x - 5, p.y + 7) < 1e-6],
    [{ type: 'distance', geometryRef: ref('point', 'P3'), value: 8 }, p => Math.abs(Math.hypot(p.x - 5, p.y - 7) - 8) < 1e-6],
    [{ type: 'distance-line', geometryRef: ref('line', 'L1'), value: 3, sign: -1 }, p => Math.abs(p.y + 3) < 1e-6],
  ];
  for (const [relation, check] of cases) {
    const item = note({ anchorConstraints: [relation] }), result = A.solvePlacement(item, { x: 12, y: 20 }, resolve, true);
    assert.equal(result.valid, true, relation.type); assert.ok(check(result.point), relation.type);
    const saved = D.serializeAnnotation(item); assert.equal(D.normalizeAnnotations([saved])[0].anchorConstraints[0].type, relation.type);
  }
  assert.equal(JSON.stringify(targets), original);
  const beyond = A.solvePlacement(note({ anchorConstraints: [{ type: 'on-spline', geometryRef: ref('spline', 'SP1'), parameter: 0.5 }] }), { x: 200, y: 20 }, resolve, true);
  assert.equal(beyond.valid, true); near(beyond.point.x, 100); near(beyond.point.y, 0);
  const combined = note({ anchorConstraints: [{ type: 'on-circle', geometryRef: ref('circle', 'C1') }, { type: 'horizontal', geometryRef: ref('point', 'P3') }] });
  const solved = A.solvePlacement(combined, { x: 12, y: 20 }, resolve, true);
  assert.equal(solved.valid, true); assert.ok(Math.abs(solved.point.y - 7) < 1e-6); assert.ok(Math.abs(Math.hypot(solved.point.x, solved.point.y) - 10) < 1e-6);
  combined.anchorConstraints[0] = { type: 'on-line', geometryRef: ref('line', 'L1') };
  assert.equal(A.solvePlacement(combined, { x: 12, y: 20 }, resolve, true).valid, false);
});

test('only the hovered enabled resize corner is filled in the interaction color', () => {
  const item = note({ anchorPosition: 'right-top' });
  for (const enabled of [false, true]) {
    const h = renderer(enabled, { resizeX: -1, resizeY: 1 }); h.hover(true);
    h.api.drawAnnotationText(item);
    const fills = h.calls.filter(call => call[0] === 'fill');
    assert.equal(fills.length, enabled ? 3 : 0);
    assert.equal(fills.filter(call => call[1] === 'blue').length, enabled ? 1 : 0);
    assert.equal(fills.filter(call => call[1] === '#ffffff').length, enabled ? 2 : 0);
  }
});

test('annotation dimensions retain layout, use live anchors, expose stable identities and remove only their relation', () => {
  const target = { id: 'P1', sketchId: 'S1', x: 0, y: 0 }, item = note({ anchorConstraints: [{type:'distance-x',geometryRef:{kind:'point',path:['P1']},value:10,dimension:{x:20,y:-30,axis:'x',display:{color:'#112233'}}}] });
  let position = {x:10,y:20};
  const dimensions = A.createDimensions({annotations:()=>[item],anchor:()=>position,resolveRef:()=>target,
    defaultDimension:()=>({x:0,y:0}),normalizeDimension:(t,d)=>d,capturePosition:()=>position,evaluateValue:Number});
  const first = dimensions.entries()[0]; assert.equal(dimensions.entries()[0], first);
  assert.equal(first.p1.x,10); position={x:30,y:40}; assert.equal(first.p1.x,30);
  first.dimension={x:50,y:60,axis:'x',display:{visible:false}};
  const saved=D.serializeAnnotation(item); assert.equal(saved.anchorConstraints[0].dimension.x,50);
  saved.anchorConstraints[0].dimension.display.visible=true; assert.equal(item.anchorConstraints[0].dimension.display.visible,false);
  assert.equal(dimensions.setValue(first,12),true); assert.equal(item.anchorConstraints[0].value,12);
  assert.equal(dimensions.remove(first),true); assert.equal(item.anchorConstraints.length,0); assert.equal(item.x,30); assert.equal(item.y,40);
  assert.equal(dimensions.entries().length,0);
});

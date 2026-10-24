const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window;
function fixture() {
  const state = { ready: false, hover: {}, exportFrame: null, editable: true, resize: true, active: 'S1', elements: [], preview: null,
    arrow: { x: 10, y: 20 }, target: { x: 30, y: 40 }, hiddenSketches: new Set() };
  const calls = [], reads = [], raw = {}, selection = w.CanvasSelection.create(), viewport = { scale: w.Appearance.CSS_PX_PER_MM };
  const document = { defaultLeaderAppearance: { color: '#334455' } };
  const appearance = w.GeometryAppearanceQuery.createAnnotation({ document, currentSketches: () => [] });
  for (const key of ['save', 'restore', 'translate', 'rotate', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'closePath', 'arc', 'setLineDash', 'rect']) raw[key] = (...args) => calls.push([key, ...args]);
  raw.fill = () => calls.push(['fill', raw.fillStyle]);
  raw.fillText = (...args) => calls.push(['fillText', ...args, raw.fillStyle]);
  raw.measureText = text => ({ width: String(text).length * 4 });
  const ctx = new Proxy(raw, { get(target, key) { assert.equal(state.ready, true); return target[key]; } });
  const live = (name, fn) => (...args) => { assert.equal(state.ready, true); reads.push([name, ...args]); return fn(...args); };
  const display = w.AnnotationDisplay.create({ ctx, viewport, canvasSelection: selection,
    surface: { withCanvasState: fn => fn(), appearanceLineDash: () => [] },
    effectiveAnnotationStyle: live('style', appearance.effectiveAnnotationStyle), readHover: live('hover', () => state.hover),
    readExportFrame: live('export', () => state.exportFrame), canvasThemeColor: color => color,
    annotationLeaderAnchor: live('arrow', () => state.arrow), resolveGeometryRef: live('ref', () => state.target),
    isEditableSketchElement: live('editable', () => state.editable), resizeEnabled: live('resize', () => state.resize),
    activeSketchId: live('active', () => state.active), allAnnotations: live('all', () => state.elements),
    isVisibleValue: value => value !== false, isVisibleSketchId: id => !state.hiddenSketches.has(id), readPreview: live('preview', () => state.preview) });
  assert.deepEqual(calls, []); assert.deepEqual(reads, []); state.ready = true;
  const note = extra => ({ id: 'AN1', type: 'text', text: 'AB', x: 1, y: 2, sketchId: 'S1', anchorPosition: 'left-middle', appearanceInheritance: true,
    style: { textHeight: 5, frameVisible: false, terminatorType: 'none' }, ...extra });
  return { display, state, calls, reads, selection, note, document, viewport };
}

function worldPoint(layout, x, y) {
  return { x: layout.x + x * Math.cos(layout.rotation) - y * Math.sin(layout.rotation),
    y: layout.y + x * Math.sin(layout.rotation) + y * Math.cos(layout.rotation) };
}

test('spatial queries share the actual live rotated text layout without painting or materializing', () => {
  const f = fixture(); f.state.ready = false;
  const spatial = f.display.createSpatialQueries();
  assert.deepEqual(f.reads, []); assert.deepEqual(f.calls, []); f.state.ready = true; f.state.arrow = null;
  const item = f.note({ text: 'First\nSecond', annotationTransformRotation: 0.7 }); f.state.elements = [item];
  const before = JSON.stringify(item);
  for (const scale of [2, 8]) {
    f.viewport.scale = scale;
    const layout = f.display.renderer.annotationTextLayout(item);
    assert.equal(layout.rotation, 0.7);
    const pointer = worldPoint(layout, layout.left + layout.width / 2, 0);
    assert.deepEqual(spatial.annotationBounds(item), layout.bounds);
    assert.equal(spatial.hitAnnotationElement(pointer.x, pointer.y).element, item);
    assert.equal(spatial.canvasContextAnnotationHit(item, pointer).element, item);
  }
  assert.equal(JSON.stringify(item), before);
  assert.equal(f.calls.every(call => call[0] === 'save' || call[0] === 'restore'), true);
  assert.equal(f.calls.filter(call => call[0] === 'save').length, f.calls.filter(call => call[0] === 'restore').length);
  f.state.elements = [];
  assert.equal(spatial.hitAnnotationElement(item.x, item.y), null);
});

test('spatial frame handles retain selection, editability, resize and visibility guards', () => {
  const f = fixture(), spatial = f.display.createSpatialQueries(); f.state.arrow = null;
  const item = f.note({ text: 'Long annotation for handles', anchorPosition: null }); f.state.elements = [item];
  const layout = f.display.renderer.annotationTextLayout(item);
  const handle = w.AnnotationRenderer.resizeHandles(layout).find(value => value.resizeX === 1 && value.resizeY === 1);
  const point = worldPoint(layout, handle.x, handle.y);
  const hit = () => spatial.hitAnnotationElement(point.x, point.y);
  f.selection.set('annotations', [item]);
  assert.equal(hit().part, 'frame'); assert.equal(hit().resizeX, 1); assert.equal(hit().resizeY, 1);
  f.state.resize = false; assert.equal(hit().part, 'frame-enable');
  f.state.resize = true; f.state.editable = false; assert.notEqual(hit()?.part, 'frame');
  f.state.editable = true; f.selection.set('annotations', []); f.state.hover = { annotation: item };
  assert.notEqual(hit()?.part, 'frame', 'hover decoration does not grant frame interaction');
  f.selection.set('annotations', [item]); f.state.active = 'S2'; assert.equal(hit(), null);
  assert.equal(spatial.hitAnnotationElement(point.x, point.y, { activeOnly: false }).element, item);
  f.state.active = 'S1'; f.state.hiddenSketches.add('S1'); assert.equal(hit(), null);
  f.state.hiddenSketches.clear(); item.visible = false; assert.equal(hit(), null);
});

test('annotation decorations share live selection, inspection, hover and export policy with color', () => {
  const f = fixture(), item = f.note(); f.state.elements = [item];
  f.selection.set('annotations', [item]); f.display.layer.draw();
  const handles = w.AnnotationRenderer.resizeHandles(f.display.renderer.annotationTextLayout(item));
  assert.equal(f.calls.filter(call => call[0] === 'rect').length, 1 + handles.length);
  assert.equal(f.display.color.annotationDisplayColor(item), '#2563eb');
  for (const mode of ['readonly', 'projected', 'hover', 'inspection', 'parent-inspection', 'export']) {
    f.calls.length = 0; f.reads.length = 0; f.state.editable = true; delete item.blockProjection;
    f.state.hover = {}; f.state.exportFrame = null; f.selection.set('inspection', null); f.selection.set('annotations', [item]);
    if (mode === 'readonly') f.state.editable = false;
    if (mode === 'projected') item.blockProjection = true;
    if (mode === 'hover') { f.selection.set('annotations', []); f.state.hover = { annotation: item }; }
    if (mode === 'inspection') { f.selection.set('annotations', []); f.selection.set('inspection', { targets: [{ item }] }); }
    if (mode === 'parent-inspection') { f.selection.set('annotations', []); item.blockInstance = {}; f.selection.set('inspection', { targets: [{ item: item.blockInstance }] }); }
    if (mode === 'export') f.state.exportFrame = {};
    f.display.layer.draw();
    assert.equal(f.calls.filter(call => call[0] === 'rect').length, mode === 'export' ? 0 : 1, mode);
    assert.equal(f.reads.some(read => read[0] === 'resize'), false, mode);
    assert.equal(f.display.color.annotationDisplayColor(item), mode === 'export' ? '#334455' : mode === 'hover' ? '#0ea5e9' : '#2563eb');
  }
  item.style.frameVisible = true; f.calls.length = 0; f.display.layer.draw();
  assert.equal(f.calls.filter(call => call[0] === 'rect').length, 1, 'saved frames remain visible during export');
});

test('resize handle hover uses exact element and handle identity and resize enablement remains late', () => {
  const f = fixture(), item = f.note(); f.selection.set('annotations', [item]);
  const handle = w.AnnotationRenderer.resizeHandles(f.display.renderer.annotationTextLayout(item))[0];
  f.state.hover = { annotationHandle: { element: item, resizeX: handle.resizeX, resizeY: handle.resizeY } };
  f.calls.length = 0; f.display.renderer.drawAnnotationText(item);
  assert.equal(f.calls.filter(call => call[0] === 'fill' && call[1] === '#2563eb').length, 1);
  f.state.hover.annotationHandle.element = { ...item }; f.calls.length = 0; f.display.renderer.drawAnnotationText(item);
  assert.equal(f.calls.some(call => call[0] === 'fill' && call[1] === '#2563eb'), false);
  f.state.resize = false; f.calls.length = 0; f.display.renderer.drawAnnotationText(item);
  assert.equal(f.calls.filter(call => call[0] === 'rect').length, 1);
});

test('leader endpoint handles preserve active, projection, anchor and preview restrictions', () => {
  const f = fixture(), item = { type: 'leader', text: '', sketchId: 'S1', start: { x: 1, y: 2 }, elbow: { x: 30, y: 20 }, end: { x: 40, y: 20 }, style: { terminatorType: 'none' } };
  f.selection.set('annotations', [item]);
  f.display.renderer.drawAnnotationLeader(item);
  assert.equal(f.calls.filter(call => call[0] === 'rect').length, 1);
  assert.deepEqual(f.calls.find(call => call[0] === 'moveTo'), ['moveTo', 10, 20]);
  for (const mode of ['inactive', 'projected', 'attached', 'export', 'preview']) {
    f.state.active = 'S1'; delete item.blockProjection; delete item.anchorConstraints; f.state.exportFrame = null;
    if (mode === 'inactive') f.state.active = 'S2';
    if (mode === 'projected') item.blockProjection = true;
    if (mode === 'attached') item.anchorConstraints = [{ type: 'fixed', x: 1, y: 2 }];
    if (mode === 'export') f.state.exportFrame = {};
    f.calls.length = 0; f.reads.length = 0; f.display.renderer.drawAnnotationLeader(item, mode === 'preview');
    assert.equal(f.calls.filter(call => call[0] === 'rect').length, 0, mode);
    if (mode === 'preview') { assert.equal(f.reads.some(read => read[0] === 'arrow'), false); assert.deepEqual(f.calls.find(call => call[0] === 'moveTo'), ['moveTo', 1, 2]); }
  }
});

test('shared layout resolves current anchors without materializing, and layer visibility differs from preview', () => {
  const f = fixture(), ref = { kind: 'point', path: ['P1'] }, item = f.note({ anchorConstraints: [{ type: 'coincident', geometryRef: ref }] });
  const before = JSON.stringify(item), first = f.display.renderer.annotationPlacementAnchor(item);
  assert.equal(first.x, 30); assert.equal(first.y, 40); assert.equal(f.reads.find(read => read[0] === 'ref')[1].path[0], 'P1');
  f.state.target = { x: 50, y: 60 };
  assert.equal(f.display.renderer.annotationPlacementAnchor(item).x, 50); assert.equal(JSON.stringify(item), before);
  f.state.elements = [item, f.note({ id: 'hidden', visible: false }), f.note({ id: 'sketch-hidden', sketchId: 'S2' })];
  f.state.hiddenSketches.add('S2'); f.calls.length = 0; f.display.layer.draw();
  assert.equal(f.calls.filter(call => call[0] === 'fillText').length, 1);
  f.state.preview = f.note({ visible: false, sketchId: 'S2' }); f.calls.length = 0; f.reads.length = 0; f.display.layer.drawPreview();
  assert.equal(f.calls.filter(call => call[0] === 'fillText').length, 1);
  assert.equal(f.reads.filter(read => read[0] === 'preview').length, 1);
  assert.equal(f.calls.find(call => call[0] === 'fillText').at(-1), '#2563eb');
});

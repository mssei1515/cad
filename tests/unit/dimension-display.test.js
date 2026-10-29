const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { structuredClone, window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(source => source.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const w = sandbox.window, { Point, Line } = w.GeometrySolver;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function fixture(buildDisplay = ports => ({ display: w.DimensionDisplay.create(ports) })) {
  const state = { ready: false, scale: 2, active: 'S1', scope: { lines: [] }, resolves: [] }, calls = [], marks = [], stack = [];
  const document = { defaultDimensionAppearance: { color: '#123456' } };
  const viewport = { get scale() { assert.equal(state.ready, true); return state.scale; } };
  const raw = { font: 'original' };
  for (const key of ['beginPath', 'moveTo', 'lineTo', 'arc', 'fill', 'closePath', 'setLineDash', 'translate', 'rotate', 'rect', 'fillRect']) raw[key] = (...args) => calls.push([key, ...args]);
  raw.save = () => { stack.push(raw.font); calls.push(['save']); };
  raw.restore = () => { raw.font = stack.pop(); calls.push(['restore']); };
  raw.measureText = text => ({ width: String(text).length * parseFloat(raw.font) / 2 });
  raw.fillText = (...args) => calls.push(['fillText', ...args, raw.font]);
  raw.stroke = () => calls.push(['stroke', raw.strokeStyle]);
  const ctx = new Proxy(raw, { get(target, key) { assert.equal(state.ready, true); return target[key]; } });
  const appearance = w.GeometryAppearanceQuery.createDimension({ document, currentSketches: () => state.sketches || [],
    activeSketchId: () => state.active, isRootSketch: () => false });
  const bundle = buildDisplay({ ctx, viewport,
    currentLines: () => { assert.equal(state.ready, true); return state.scope.lines; }, minLineLength: 1e-6,
    canvasThemeColor: color => { calls.push(['theme', color]); return color; }, onExpressionMark: mark => marks.push(mark),
    effectiveDimensionAppearance: (dimension, sketchId) => { assert.equal(state.ready, true); state.resolves.push([dimension, sketchId]); return appearance.effectiveDimensionAppearance(dimension, sketchId); },
    activeSketchId: () => { assert.equal(state.ready, true); return state.active; } }, appearance, state);
  const { display } = bundle;
  assert.deepEqual(calls, []); assert.deepEqual(state.resolves, []); state.ready = true;
  return { state, display, labels: bundle.labels, bundle, viewport, document, calls, marks, raw, stack };
}

test('display preview shares placement and painter while reading current pending expressions and appearance', () => {
  const f = fixture(), p1 = new Point('A', 0, 0), p2 = new Point('B', 100, 0);
  const target = { kind: 'point-point', p1, p2, value: 100 };
  let pending = null, evaluation = 25;
  const evaluations = [];
  f.state.ready = false;
  const preview = f.display.createPreview({ readPending: () => { assert.equal(f.state.ready, true); return pending; },
    drawFilletPreviewArc: () => { throw new Error('not a Fillet'); }, evaluateDimensionExpressionDraft: (...args) => { evaluations.push(args); return evaluation; } });
  assert.deepEqual(f.calls, []); assert.deepEqual(evaluations, []); assert.ok(Object.isFrozen(preview)); f.state.ready = true;
  preview.draw(); assert.deepEqual(f.calls, []);
  const dimension = f.display.placement.dimensionFromAnchor(target, { x: 50, y: -20 });
  const constraint = {}; pending = { type: 'distance-value', target, dimension, constraint, buffer: '25' };
  const before = JSON.stringify({ pending, p1, p2 }); preview.draw();
  assert.equal(f.calls.some(c => c[0] === 'fillText'), false); // Pending value text stays in the input, as in the existing painter.
  assert.ok(f.calls.some(c => c[0] === 'stroke'));
  assert.equal(evaluations[0][0], constraint); assert.equal(evaluations[0][1], '25'); assert.equal(evaluations[0][2], undefined);
  assert.equal(evaluations[0][3].signedAngle, false); assert.equal(JSON.stringify({ pending, p1, p2 }), before);
  f.calls.length = 0; pending = { type: 'distance-place', target, pointer: { x: 50, y: -10 } };
  f.document.defaultDimensionAppearance = { dimensionTextHeight: 12 }; f.state.scale = 4; preview.draw();
  assert.deepEqual(f.calls.filter(c => c[0] === 'fillText').map(c => c[1]), ['100']);
  assert.equal(f.state.resolves.at(-1)[1], 'S1'); assert.equal(f.stack.length, 0);
  f.calls.length = 0; pending = { type: 'offset-value', buffer: '5' }; preview.draw(); assert.deepEqual(f.calls, []);
});

test('display preview keeps the Fillet geometry identity, read-only model and failure boundary before dimension painting', () => {
  const f = fixture(), geometry = { ok: true, center: new Point('C', 1, 2), radius: 10, startAngle: 0, endAngle: Math.PI };
  let pending = { type: 'fillet-radius-place', preview: geometry }, failure = null;
  const arcs = [], before = JSON.stringify(geometry);
  const preview = f.display.createPreview({ readPending: () => pending,
    drawFilletPreviewArc: arc => { arcs.push(arc); if (failure) throw failure; }, evaluateDimensionExpressionDraft: () => { throw new Error('not an expression'); } });
  preview.draw(); assert.equal(arcs[0], geometry);
  assert.equal(f.calls.some(c => c[0] === 'fillText'), false);
  assert.ok(f.calls.some(c => c[0] === 'stroke'));
  assert.equal(JSON.stringify(geometry), before); assert.equal(f.stack.length, 0);
  f.calls.length = 0; failure = new Error('Fillet paint failed');
  assert.throws(() => preview.draw(), error => error === failure); assert.deepEqual(f.calls, []);
  pending = { type: 'fillet-radius-place', preview: { ok: false } }; preview.draw(); assert.equal(arcs.length, 2);
});

test('display layout reads current incident geometry and fresh defaults while preserving point identity', () => {
  const f = fixture(), point = new Point('P', 0, 0), line = new Line('L', new Point('A', 20, -100), new Point('B', 20, 100));
  const target = { kind: 'point-line', point, line }, dimension = f.display.placement.dimensionFromAnchor(target, { x: 0, y: 10 });
  const first = f.display.layout(target, dimension); assert.equal(first.points[0].source, point); assert.equal(first.points[0].showExtension, true);
  f.state.scope = { lines: [new Line('incident', point, new Point('C', 0, 20))] };
  assert.equal(f.display.layout(target, dimension).points[0].showExtension, false);
  f.state.scope = { lines: [new Line('same-coordinates', new Point('other', 0, 0), new Point('D', 0, 20))] };
  assert.equal(f.display.layout(target, dimension).points[0].showExtension, true);
  assert.equal(f.state.resolves.length, 3); assert.equal(f.state.resolves[0][0], dimension);
  const before = JSON.stringify(dimension);
  f.document.defaultDimensionAppearance = { extensionLineOvershoot: 8 };
  const fresh = f.display.layout(target, dimension);
  close(fresh.points[0].extensionEnd.y - first.points[0].extensionEnd.y,
    (8 - w.Appearance.DEFAULT_DIMENSION_APPEARANCE.extensionLineOvershoot) * w.Appearance.CSS_PX_PER_MM / f.state.scale);
  const appearance = w.Appearance.normalizeDimensionAppearance({ extensionLineOvershoot: 2 }, { partial: false });
  const resolved = f.display.layout(target, dimension, appearance);
  assert.equal(f.state.resolves.length, 4);
  close(fresh.points[0].extensionEnd.y - resolved.points[0].extensionEnd.y, 6 * w.Appearance.CSS_PX_PER_MM / f.state.scale);
  assert.equal(JSON.stringify(dimension), before);
});

test('linear paint shares resolved appearance, viewport metrics, theme flags and expression probe without new resolution', () => {
  const f = fixture(), target = { kind: 'point-point', p1: new Point('A', 0, 0), p2: new Point('B', 100, 0) };
  const dimension = f.display.placement.dimensionFromAnchor(target, { x: 50, y: -20 });
  const appearance = Object.freeze(w.Appearance.normalizeDimensionAppearance({ color: '#abcdef' }, { partial: false }));
  const paint = () => f.display.painter.drawDimension(target, dimension, '100\nmm', true, false, null, null, 'S1', true, appearance);
  paint(); assert.equal(f.state.resolves.length, 0); assert.equal(f.marks.length, 1); assert.equal(f.marks[0].pointCount, 6); assert.equal(f.marks[0].filled, true);
  assert.ok(f.calls.some(call => call[0] === 'theme' && call[1] === '#2563eb'));
  assert.deepEqual(Array.from(f.calls.find(call => call[0] === 'setLineDash')[1]), [2.5, 2]);
  const text = f.calls.filter(call => call[0] === 'fillText'); assert.deepEqual(text.map(call => call[1]), ['100', 'mm']);
  const height = f.display.metrics.dimensionTextDrawingMetrics(appearance).height;
  close(parseFloat(text[0].at(-1)), height); assert.equal(f.raw.font, 'original'); assert.equal(f.stack.length, 0);
  f.state.scale *= 2; f.calls.length = 0; paint();
  close(parseFloat(f.calls.find(call => call[0] === 'fillText').at(-1)), height / 2);
  assert.equal(f.state.resolves.length, 0); assert.equal(f.stack.length, 0);
});

test('standalone linear and angle paints resolve live defaults and preserve hidden labels and resolved-appearance bypass', () => {
  const f = fixture(), origin = new Point('O', 0, 0);
  const targets = [{ kind: 'point-point', p1: origin, p2: new Point('P', 100, 0) },
    { kind: 'angle', line1: new Line('L1', origin, new Point('A', 100, 0)), line2: new Line('L2', origin, new Point('B', 0, 100)) }];
  for (const target of targets) {
    const dimension = f.display.placement.dimensionFromAnchor(target, { x: 20, y: 20 });
    f.state.active = 'S2'; f.document.defaultDimensionAppearance = { color: '#445566' }; f.calls.length = 0;
    f.display.painter.drawDimension(target, dimension, 'value');
    assert.equal(f.state.resolves.at(-1)[0], dimension); assert.equal(f.state.resolves.at(-1)[1], 'S2');
    assert.ok(f.calls.some(call => call[0] === 'stroke' && call[1] === '#445566'));
    const count = f.state.resolves.length, resolved = w.Appearance.normalizeDimensionAppearance({ color: '#778899' }, { partial: false });
    f.calls.length = 0; const marks = f.marks.length;
    f.display.painter.drawDimension(target, dimension, 'value', false, false, { hidden: true }, null, 'S2', true, resolved);
    assert.equal(f.state.resolves.length, count); assert.equal(f.calls.some(call => call[0] === 'fillText'), false);
    assert.equal(f.marks.length, marks); assert.equal(f.stack.length, 0);
  }
});

function traversalFixture() {
  const f = fixture(), selection = w.CanvasSelection.create();
  Object.assign(f.state, { scope: { lines: [], constraints: [] }, annotations: [], hiddenSketches: new Set(), labels: [],
    hover: null, dragged: null, pending: null, exportFrame: null, constraintStatus: true });
  const labels = w.DimensionPresentation.createLabel({ ...w.DimensionQueries,
    dimensionDisplayState: () => { throw Error('traversal must supply its resolved appearance'); }, constraintSketchId: item => item.sketchId,
    formatDimensionLabel: String, formatMeasuredDimensionLabel: String });
  const live = read => (...args) => { assert.equal(f.state.ready, true); return read(...args); };
  f.state.ready = false;
  const traversal = f.display.createTraversal({
    currentScope: live(() => { f.state.presented = { constraints: [...f.state.scope.constraints, ...f.state.annotations] }; return f.state.presented; }),
    isActiveSketchConstraint: live(item => item.sketchId === f.state.active), isVisibleSketchId: live(id => !f.state.hiddenSketches.has(id)),
    constraintSketchId: item => item.sketchId, isVisibleValue: value => value !== false, canvasSelection: selection,
    readHoverDimension: live(() => f.state.hover), readDraggedDimension: live(() => f.state.dragged), readPending: live(() => f.state.pending),
    readExportFrame: live(() => f.state.exportFrame), readConstraintStatus: live(() => f.state.constraintStatus), inactiveColor: '#999999',
    dimensionLabelForConstraint: (constraint, target, dimension, appearance) => { f.state.labels.push([constraint, appearance]); return labels.label(constraint, target, dimension, appearance); },
    dimensionUsesExpression: () => true });
  assert.deepEqual(f.calls, []); assert.deepEqual(f.state.resolves, []); f.state.ready = true;
  function dimension(id, sketchId = 'S1') {
    const item = new w.GeometrySolver.DistanceConstraint(new Point(`${id}a`, 0, 0), new Point(`${id}b`, 100, 0), 100);
    item.sketchId = sketchId;
    item.dimension = f.display.placement.dimensionFromAnchor(w.DimensionQueries.targetFromConstraint(item), { x: 50, y: -20 });
    return item;
  }
  return { ...f, traversal, selection, dimension };
}

test('display traversal keeps the supplied presentation scope, object identity and one appearance resolution per visible dimension', () => {
  const f = traversalFixture(), active = f.dimension('a'), inactive = f.dimension('b', 'S2'), annotation = f.dimension('annotation');
  annotation.readOnlyDimension = true;
  const hidden = f.dimension('hidden', 'S3'); f.state.hiddenSketches.add('S3');
  f.state.scope.constraints = [active, inactive, hidden]; f.state.annotations = [annotation];
  const source = f.state.scope.constraints, before = JSON.stringify(source);
  f.traversal.layer.draw();
  assert.deepEqual(f.state.labels.map(entry => entry[0]), [inactive, active, annotation]);
  assert.deepEqual(Array.from(f.state.presented.constraints), [inactive, hidden, active, annotation]);
  assert.equal(f.state.scope.constraints, source); assert.equal(JSON.stringify(source), before);
  assert.equal(f.state.resolves.length, 3);
  assert.deepEqual(f.calls.filter(call => call[0] === 'fillText').map(call => call[1]), ['100', '100', '(100)']);
  const replacement = f.dimension('same-id', 'S2');
  f.state.scope = { lines: [], constraints: [replacement] }; f.state.annotations = []; f.state.active = 'S2';
  f.document.defaultDimensionAppearance = { color: '#445566' }; f.state.labels.length = 0; f.calls.length = 0;
  f.traversal.layer.draw();
  assert.equal(f.state.resolves.length, 4); assert.equal(f.state.labels[0][0], replacement);
  assert.equal(f.state.labels[0][1].color, '#445566'); assert.equal(f.stack.length, 0);
});

test('selection bounds share live metrics and resolved labels without mutating dimensions or reading inactive geometry', () => {
  const f = traversalFixture(), item = f.dimension('a'), before = JSON.stringify(item);
  const first = f.traversal.selectionBounds.read(item);
  assert.ok([first.x1, first.y1, first.x2, first.y2].every(Number.isFinite));
  assert.equal(f.state.resolves.length, 1); assert.equal(f.state.labels[0][0], item);
  f.document.defaultDimensionAppearance = { dimensionTextHeight: 12 };
  const larger = f.traversal.selectionBounds.read(item); assert.ok(larger.y1 < first.y1);
  assert.equal(f.state.resolves.length, 2); assert.equal(JSON.stringify(item), before);
  f.state.active = 'S2'; assert.equal(f.traversal.selectionBounds.read(item), null); assert.equal(f.state.resolves.length, 2);
  f.state.active = 'S1'; f.state.hiddenSketches.add('S1');
  assert.equal(f.traversal.selectionBounds.read(item), null); assert.equal(f.state.resolves.length, 2);
  f.state.hiddenSketches.clear(); item.dimension.display = { visible: false };
  assert.equal(f.traversal.selectionBounds.read(item), null); assert.equal(f.state.resolves.length, 3);
});

test('traversal observes hover, drag, selection, editing and PNG export flags through the same painter', () => {
  const f = traversalFixture(), active = f.dimension('a'), inactive = f.dimension('b', 'S2');
  f.state.scope.constraints = [active];
  for (const kind of ['hover', 'dragged', 'selected', 'inspection']) {
    f.state.hover = null; f.state.dragged = null; f.selection.set('dimensionConstraint', null); f.selection.set('inspection', null);
    if (kind === 'selected') f.selection.set('dimensionConstraint', active);
    else if (kind === 'inspection') f.selection.set('inspection', { targets: [{ kind: 'constraint', item: active }] });
    else f.state[kind] = active;
    f.calls.length = 0; f.traversal.layer.draw();
    assert.ok(f.calls.some(call => call[0] === 'stroke' && call[1] === '#2563eb'), kind);
  }
  f.state.pending = { type: 'distance-value', constraint: active }; f.state.scope.constraints.push(inactive);
  f.calls.length = 0; f.marks.length = 0; f.traversal.layer.draw();
  assert.equal(f.calls.filter(call => call[0] === 'fillText').length, 1); assert.equal(f.marks.length, 1);
  assert.ok(f.calls.some(call => call[0] === 'stroke' && call[1] === '#999999'));
  f.state.exportFrame = {}; f.calls.length = 0; f.marks.length = 0; f.traversal.layer.draw();
  assert.equal(f.calls.filter(call => call[0] === 'fillText').length, 2); assert.equal(f.marks.length, 0);
  assert.equal(f.calls.some(call => call[0] === 'stroke' && ['#2563eb', '#999999'].includes(call[1])), false);
  assert.equal(f.stack.length, 0);
});

function buildSceneDisplay(ports, appearance, state) {
  const { effectiveDimensionAppearance, activeSketchId, ...options } = ports;
  return w.DimensionDisplay.createForScene({ ...options,
    appearance: { effectiveDimensionAppearance, dimensionDisplayState: appearance.dimensionDisplayState },
    sketches: { activeSketchId, constraintSketchId: constraint => { assert.equal(state.ready, true); return constraint.sketchId || state.active; } },
  });
}

test('scene composition shares live Sketch appearance across labels, layout and the actual painter without eager reads', () => {
  const f = fixture(buildSceneDisplay); assert.ok(Object.isFrozen(f.bundle)); assert.ok(Object.isFrozen(f.display)); assert.ok(Object.isFrozen(f.labels));
  assert.equal(f.bundle.display, f.display); f.document.defaultDimensionAppearance = { precision: 1, suffix: 'mm' };
  f.state.sketches = [
    { id: 'S1', kind: 'sketch', dimensionAppearance: { prefix: 'A', precision: 2, color: '#aa0000', extensionLineOvershoot: 1 } },
    { id: 'S2', kind: 'sketch', dimensionAppearance: { prefix: 'B', precision: 1, color: '#0000aa', extensionLineOvershoot: 5 } },
  ];
  const target = { kind: 'point-point', p1: new Point('A', 0, 0), p2: new Point('B', 100, 0) };
  const dimension = f.display.placement.dimensionFromAnchor(target, { x: 50, y: -20 }), constraint = { target: 12, sketchId: 'S1' };
  const first = f.display.layout(target, dimension), label = f.labels.label(constraint, target, dimension);
  assert.equal(label, 'A12.00mm'); assert.equal(first.points[0].source, target.p1);
  f.calls.length = 0; f.display.painter.drawDimension(target, dimension, label);
  assert.ok(f.calls.some(call => call[0] === 'fillText' && call[1] === label)); assert.ok(f.calls.some(call => call[0] === 'stroke' && call[1] === '#aa0000'));
  f.state.active = 'S2'; constraint.sketchId = 'S2';
  const second = f.display.layout(target, dimension), nextLabel = f.labels.label(constraint, target, dimension);
  assert.equal(nextLabel, 'B12.0mm'); close(Math.abs(second.points[0].extensionEnd.y - first.points[0].extensionEnd.y), 4 * w.Appearance.CSS_PX_PER_MM / f.state.scale);
  f.calls.length = 0; f.display.painter.drawDimension(target, dimension, nextLabel);
  assert.ok(f.calls.some(call => call[0] === 'fillText' && call[1] === nextLabel)); assert.ok(f.calls.some(call => call[0] === 'stroke' && call[1] === '#0000aa'));
  assert.equal(f.stack.length, 0);
});

test('scene labels and layout propagate the same appearance failure while explicit resolved display remains usable', () => {
  const f = fixture(buildSceneDisplay), marker = new Error('dimension appearance');
  const target = { kind: 'point-point', p1: new Point('A', 0, 0), p2: new Point('B', 100, 0) };
  const dimension = f.display.placement.dimensionFromAnchor(target, { x: 50, y: -20 }), constraint = { target: 12, sketchId: 'S1' };
  const before = JSON.stringify({ target, dimension });
  Object.defineProperty(f.document, 'defaultDimensionAppearance', { get() { throw marker; } });
  assert.throws(() => f.labels.label(constraint, target, dimension), error => error === marker);
  assert.throws(() => f.display.layout(target, dimension), error => error === marker);
  assert.equal(JSON.stringify({ target, dimension }), before); assert.deepEqual(f.calls, []);
  const resolved = w.Appearance.normalizeDimensionAppearance({ prefix: 'R', precision: 3 }, { partial: false });
  assert.equal(f.labels.label(constraint, target, dimension, resolved), 'R12.000');
  assert.equal(f.display.layout(target, dimension, resolved).points[0].source, target.p1);
});

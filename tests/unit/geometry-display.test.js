const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/rendering/canvas_surface.js', 'src/rendering/geometry_presentation.js',
  'src/rendering/geometry_renderer.js', 'src/application/geometry_display.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
class Point { constructor(x, y) { Object.assign(this, { x, y, kind: 'explicit', sketchId: 'S1' }); } }
function fixture() {
  const state = { ready: false, dpr: 2, exporting: false, active: 'S1', edited: null, label: 'Fixed', scope: { points: [], lines: [], circles: [], arcs: [], splines: [] } };
  const calls = [], strokes = [], reads = [], ctx = {}, viewport = { scale: 2 };
  const ready = () => assert.equal(state.ready, true, 'construction must not read scene or paint');
  for (const method of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'fill', 'arc', 'fillText', 'setLineDash', 'setTransform']) {
    ctx[method] = (...args) => { ready(); calls.push([method, ...args]); if (method === 'moveTo') ctx.start = args; };
  }
  ctx.stroke = () => { ready(); if (state.failure) throw state.failure; strokes.push({ start: ctx.start, color: ctx.strokeStyle, blur: ctx.shadowBlur, width: ctx.lineWidth }); };
  const surface = sandbox.window.CanvasSurface.create({ canvas: {}, ctx, viewport, readPixelRatio: () => state.dpr });
  const selection = { points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], geometryInstances: [] }, hover = { current: {} };
  const visible = item => { ready(); return item.visible !== false; }, active = item => item.sketchId === state.active;
  const sketchStyle = sandbox.window.GeometryPresentation.createSketchStyle({ isVisibleSketchElement: visible, isActiveSketchElement: active,
    sketchHasSolveError: () => false, elementSketchId: item => item.sketchId, sketchRelationOfElement: item => active(item) ? 'active' : 'inactive', constraintStatusOf: () => 'under' });
  const sameArcEndpoint = (a, b) => Boolean(a && b && a.arc === b.arc && a.endpoint === b.endpoint);
  const commandTargets = sandbox.window.GeometryPresentation.createCommandTargets({ readPanelSelection: () => null, readMode: () => 'select',
    readOperands: () => [], readConstraintCommand: () => null, readPending: () => null, sameArcEndpoint });
  const geometryReads = Object.fromEntries(['points', 'lines', 'circles', 'arcs', 'splines'].map(kind => [
    'allGeometry' + kind[0].toUpperCase() + kind.slice(1), () => { ready(); reads.push(kind); if (state.readFailure) throw state.readFailure; return state.scope[kind]; }
  ]));
  const pointUsage = { isSplineOnlyFitPoint: () => false, isEditableSplineFitPoint: () => false, isExplicitPoint: p => p.kind === 'explicit',
    isPointUsedByPrimitive: () => false, isReferencePoint: () => false, isAnyLineEndpoint: () => false, isEndpointPoint: p => p.kind === 'endpoint' };
  const display = sandbox.window.GeometryDisplay.create({ Point, ctx, viewport, surface, pointUsage, commandTargets, sketchStyle, geometryReads,
    canvasSelection: selection, canvasHover: hover, viewState: {}, isExporting: () => state.exporting,
    effectiveAppearanceForElement: item => ({ color: '#111827', lineWidth: 1.5, lineType: 'solid', endpointOverhang: false, ...item.appearance }),
    isEditableSketchElement: active, isSidebarHighlightedElement: () => false, isSidebarHoveredElement: () => false, isSelectedConstraintRelatedElement: () => false,
    canvasThemeColor: color => color, constructionAlpha: .72, constructionExtensionScreenPx: 10, fixedPointLabel: () => state.label, isVisibleSketchElement: visible,
    handleQueries: { sameArcEndpoint, arcEndpointPoint: (arc, end) => arc[end], findArcEndpointFixedConstraint: () => null, isDraggingArcEndpoint: () => false,
      editedSpline: () => state.edited, currentScope: () => state.scope },
    pointQueries: { pointLockedByLineFixed: () => false, sidebarHoveredItem: () => null, isDraggingPoint: () => false, isDraggingCenter: () => false } });
  assert.equal(Object.isFrozen(display), true); assert.deepEqual(calls, []); assert.deepEqual(reads, []);
  state.ready = true; surface.syncCanvasBitmapSize(100, 80); calls.length = 0;
  return { state, calls, strokes, reads, display, selection, hover, viewport, surface, ctx };
}
function line(x, extra = {}) { return { p1: new Point(x, 0), p2: new Point(x + 10, 0), sketchId: 'S1', ...extra }; }

test('geometry display retains scene ordering, explicit lists, selection options and shared DPR', () => {
  const f = fixture(), a = line(10), b = line(20, { sketchId: 'S2' }), hidden = line(30, { visible: false });
  f.state.scope.lines = [a, hidden, b]; f.selection.lines.push(a); f.display.drawLines();
  assert.deepEqual(f.strokes.map(s => s.start[0]), [20, 10]); assert.equal(f.strokes[1].blur, 16);
  assert.deepEqual(f.state.scope.lines, [a, hidden, b]); assert.equal(f.selection.lines[0], a);
  f.strokes.length = 0; f.reads.length = 0; f.display.drawLines([a, hidden, b], { selectionGlow: false });
  assert.deepEqual(f.strokes.map(s => s.start[0]), [10, 20]); assert.deepEqual(f.reads, []);
  assert.equal(f.strokes[0].blur, 0); assert.equal(f.strokes[0].color, '#1d4ed8'); assert.equal(f.strokes[0].width, 1.5);
  f.state.dpr = 3; f.viewport.scale = 4; f.surface.syncCanvasBitmapSize(100, 80); f.strokes.length = 0;
  f.state.scope.lines = [a]; f.display.drawLines(); assert.equal(f.strokes[0].blur, 24); assert.equal(f.strokes[0].width, .75);
  f.state.exporting = true; f.display.drawLines(); assert.equal(f.strokes.at(-1).color, '#111827'); assert.equal(f.strokes.at(-1).blur, 0);
});

test('primitive reads and construction extension use shared viewport without changing geometry', () => {
  const f = fixture(), a = line(10, { construction: true, appearance: { endpointOverhang: true, endpointMarkers: false }, length: () => 10, dx: () => 10, dy: () => 0 });
  f.display.drawLines([a]); assert.deepEqual(f.strokes[0].start, [5, 0]); assert.equal(a.p1.x, 10);
  f.viewport.scale = 5; f.display.drawLines([a]); assert.deepEqual(f.strokes[1].start, [8, 0]);
  f.state.scope.circles = [{ center: new Point(1, 2), radius: () => 3 }];
  f.state.scope.arcs = [{ center: new Point(4, 5), radius: () => 6, startAngle: 2, endAngle: -1 }];
  const curve = sandbox.window.SplineGeometry.build([new Point(0, 0), new Point(3, 2), new Point(6, 0)]);
  const spline = { curve: () => curve, closed: false }; f.state.scope.splines = [spline];
  f.display.drawCircles(); f.display.drawArcs(); f.display.drawSplines();
  assert.deepEqual(f.reads, ['circles', 'arcs', 'splines']);
  assert.deepEqual(f.calls.filter(c => c[0] === 'arc'), [['arc', 1, 2, 3, 0, Math.PI * 2], ['arc', 4, 5, 6, 2, -1, true]]);
  f.calls.length = 0; const samples = f.display.traceSplinePath(spline);
  assert.ok(samples.length > 2); assert.equal(f.calls[0][0], 'beginPath');
  assert.deepEqual(f.calls[1], ['moveTo', samples[0].point.x, samples[0].point.y]);
  assert.equal(f.calls.filter(c => c[0] === 'lineTo').length, samples.length - 1);
});

test('points and edit handles read current scope with object identity and current labels', () => {
  const f = fixture(), p = Object.assign(new Point(1, 2), { fixed: true, id: 'P1' });
  f.state.scope.points = [p]; f.selection.points.push(p); f.display.drawPoints();
  assert.ok(f.calls.some(c => c[0] === 'fillText' && c[1] === 'Fixed'));
  f.state.label = '固定'; f.calls.length = 0; f.display.drawPoints(); assert.ok(f.calls.some(c => c[1] === '固定'));
  const arc = { id: 'A1', sketchId: 'S1', start: p, end: new Point(3, 4) };
  f.selection.arcEndpoint = { arc, endpoint: 'start' }; f.state.scope.arcs = [arc]; f.calls.length = 0;
  f.display.drawArcEndpointHandles(); assert.equal(f.calls.filter(c => c[0] === 'arc').length, 1);
  for (const replacement of [{ ...arc }, Object.assign(arc, { visible: false })]) {
    f.state.scope.arcs = [replacement]; f.calls.length = 0; f.display.drawArcEndpointHandles(); assert.equal(f.calls.filter(c => c[0] === 'arc').length, 0);
  }
  const spline = { id: 'SP1', fitPoints: [p, new Point(5, 6)], closed: true };
  f.state.edited = spline; f.state.scope.splines = [{ ...spline }]; f.calls.length = 0; f.display.drawSplineEditHandles(); assert.deepEqual(f.calls, []);
  f.state.scope.splines = [spline]; f.display.drawSplineEditHandles(); assert.equal(f.calls.filter(c => c[0] === 'arc').length, 2);
  assert.ok(f.calls.some(c => c[0] === 'closePath')); assert.equal(f.selection.points[0], p); assert.equal(spline.fitPoints[0], p);
});

test('reader errors propagate before paint and handle failures retain Canvas cleanup and selection', () => {
  const f = fixture(), failure = new Error('scene query failed'); f.state.readFailure = failure;
  assert.throws(() => f.display.drawPoints(), error => error === failure); assert.deepEqual(f.calls, []);
  delete f.state.readFailure;
  const p = new Point(1, 2), spline = { fitPoints: [p], closed: false }; f.selection.points.push(p);
  f.state.edited = spline; f.state.scope.splines = [spline]; f.state.failure = failure;
  assert.throws(() => f.display.drawSplineEditHandles(), error => error === failure);
  assert.ok(f.calls.some(c => c[0] === 'restore')); assert.equal(f.ctx.shadowBlur, 0); assert.equal(f.ctx.globalAlpha, 1);
  assert.equal(f.calls.at(-1)[0], 'setLineDash'); assert.equal(f.calls.at(-1)[1].length, 0);
  assert.equal(f.selection.points[0], p); assert.equal(f.state.scope.splines[0], spline);
});

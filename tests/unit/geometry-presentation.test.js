const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/geometry_presentation.js'), 'utf8'), sandbox);
class Point {}
function fixture() {
  const selection = { points: [], lines: [], circles: [], arcs: [], splines: [], blockInstances: [], geometryInstances: [] };
  const hover = { current: {} }, view = { geometryIds: false, constraintStatus: false };
  const presentation = sandbox.window.GeometryPresentation.create({ Point, canvasSelection: selection, canvasHover: hover, viewState: view, isExporting: () => !!view.exporting,
    effectiveAppearanceForElement: item => item.appearance || { color: 'normal', lineWidth: 1.5 },
    isEditableSketchElement: item => !item.inactive, isConstraintOperandSelected: item => !!item.operand,
    isPendingReferenceTarget: item => !!item.reference, isSidebarHighlightedElement: item => !!item.tree,
    isSidebarHoveredElement: item => !!item.sidebar, isReferenceHoverElement: item => !!item.referenceHover,
    isSelectedConstraintRelatedElement: item => !!item.related, sketchAlpha: () => 0.5, sketchStrokeWidth: () => 2,
    constraintStatusColor: () => 'constraint', canvasThemeColor: value => `theme:${value}`, constructionAlpha: 0.72, handleQueries: {
      sameArcEndpoint: (a, b) => !!a && a.arc === b.arc && a.endpoint === b.endpoint,
      arcEndpointPoint: (arc, end) => arc[end], findArcEndpointFixedConstraint: arc => arc.fixed,
      isDraggingArcEndpoint: (arc, end) => arc.dragEnd === end,
      editedSpline: () => view.editedSpline, currentScope: () => view.scope,
    }, pointQueries: {
      isSplineOnlyFitPoint: p => !!p.splineOnly, isEditableSplineFitPoint: p => !!p.editableFit,
      isExplicitPoint: p => p.kind === 'explicit', isPointUsedByPrimitive: p => !!p.used,
      isReferencePoint: p => !!p.referencePoint, isAnyLineEndpoint: p => !!p.lineEnd,
      isEndpointPoint: p => p.kind === 'endpoint', isDraggingPoint: p => !!p.dragging,
      isDraggingCenter: p => !!p.draggingCenter, sidebarHoveredItem: () => hover.sidebarItem,
      pointLockedByLineFixed: p => !!p.fixedByLine,
    } });
  return { presentation, selection, hover, view };
}
test('export paints document appearance without interaction highlights or editing points', () => {
  const f = fixture(), line = { related: true, operand: true, sidebar: true };
  f.selection.lines.push(line); f.hover.current.line = line;
  f.view.exporting = true; f.view.constraintStatus = true; f.view.geometryIds = true;
  const state = f.presentation.geometryPaintState(line, 'lines');
  assert.equal(state.selected, false); assert.equal(state.hovered, false); assert.equal(state.showId, false);
  assert.equal(state.color, 'theme:normal'); assert.equal(state.strokeWidth, 1.5);
  assert.equal(f.presentation.pointPaintState({ kind: 'endpoint', used: true }), null);
  assert.equal(f.presentation.pointPaintState({ kind: 'explicit', fixed: true }).showFixed, false);
  assert.deepEqual(f.selection.lines, [line]);
});
test('instance ownership distinguishes whole instances, internal geometry and point projections', () => {
  const f = fixture(), instance = { id: 'FI1' }, line = { id: 'L1', derivedInstance: instance };
  const point = Object.assign(new Point(), { derivedInstance: instance });
  f.selection.geometryInstances.push(instance); f.hover.current.geometryInstance = instance;
  assert.equal(f.presentation.ownerInstanceSelected(line), true);
  assert.equal(f.presentation.ownerInstanceSelected(point), false);
  point.sourceRef = {}; assert.equal(f.presentation.ownerInstanceSelected(point), true);
  f.selection.instanceGeometry = { instanceId: 'FI1', id: 'L2' };
  assert.equal(f.presentation.ownerInstanceSelected(line), false);
  assert.equal(f.presentation.ownerInstanceHovered(line), false);
  f.selection.instanceGeometry.id = 'L1'; assert.equal(f.presentation.ownerInstanceSelected(line), true);
  const block = {}; f.selection.blockInstances.push(block); f.hover.current.block = block;
  assert.equal(f.presentation.ownerInstanceSelected({ blockInstance: block }), true);
  assert.equal(f.presentation.ownerInstanceHovered({ blockInstance: block }), true);
  assert.equal(f.presentation.ownerInstanceSelected(Object.assign(new Point(), { blockInstance: block })), false);
});
test('selection highlight is independent of editability; hover follows its own policy', () => {
  const f = fixture(), item = { inactive: true };
  f.selection.lines.push(item); f.hover.current.line = item;
  let state = f.presentation.geometryPaintState(item, 'lines');
  assert.equal(state.selected, true); assert.equal(state.hovered, false);
  item.referenceHover = true;
  state = f.presentation.geometryPaintState(item, 'lines');
  assert.equal(state.hovered, true); assert.equal(state.strokeWidth, 3); assert.equal(state.showId, true);
  f.hover.current = {}; assert.equal(f.presentation.geometryPaintState(item, 'lines').hovered, false);
});
test('construction dimming and reference selection preserve spline-specific display rules', () => {
  const f = fixture(), item = { construction: true, related: true };
  const line = f.presentation.geometryPaintState(item, 'lines');
  const spline = f.presentation.geometryPaintState(item, 'splines');
  assert.equal(line.alpha, 0.5); assert.equal(spline.alpha, 0.5 * 0.72);
  assert.equal(line.color, '#0ea5e9'); assert.equal(line.strokeWidth, 3);
  assert.equal(line.showId, true); assert.equal(spline.showId, false);
  item.related = false; item.reference = true;
  assert.equal(f.presentation.geometryPaintState(item, 'lines').selected, true);
  assert.equal(f.presentation.geometryPaintState(item, 'splines').selected, false);
  item.sidebar = true;
  assert.equal(f.presentation.geometryPaintState(item, 'circles').construction, false);
  assert.equal(f.presentation.geometryPaintState(item, 'lines').construction, true);
});
test('color and width precedence reads current view flags and keeps fallback widths', () => {
  const f = fixture(), item = {}, appearance = { color: 'normal', lineWidth: 1.5 };
  assert.equal(f.presentation.geometryDisplayColor(item, appearance), 'theme:normal');
  f.view.constraintStatus = true;
  assert.equal(f.presentation.geometryDisplayColor(item, appearance), 'theme:constraint');
  assert.equal(f.presentation.geometryDisplayColor(item, appearance, true, true), 'theme:#1d4ed8');
  assert.equal(f.presentation.geometryStrokeWidth(item, { appearance, selected: true, hovered: true }), 3);
  assert.equal(f.presentation.geometryStrokeWidth(item, { appearance }), 1.5);
  assert.equal(f.presentation.geometryStrokeWidth(item, { construction: true }), 1.1);
  assert.equal(f.presentation.geometryStrokeWidth(item), 2);
  f.view.geometryIds = true; assert.equal(f.presentation.geometryPaintState(item, 'splines').showId, true);
});

test('point visibility distinguishes spline edit points, endpoints, references and projections', () => {
  const f = fixture(), point = Object.assign(new Point(), { kind: 'explicit', splineOnly: true });
  assert.equal(f.presentation.pointPaintState(point), null);
  point.editableFit = true; assert.ok(f.presentation.pointPaintState(point));
  point.splineOnly = false; point.kind = 'endpoint'; point.used = true;
  assert.equal(f.presentation.pointPaintState(point), null);
  point.dragging = true; assert.equal(f.presentation.pointPaintState(point).showId, true);
  point.dragging = false; point.referencePoint = true;
  assert.equal(f.presentation.pointPaintState(point), null);
  point.related = true; assert.equal(f.presentation.pointPaintState(point).radius, 7);
  point.related = false; point.referencePoint = false; point.derivedProjection = {};
  assert.equal(f.presentation.pointPaintState(point), null);
  point.draggingCenter = true; assert.ok(f.presentation.pointPaintState(point));
});
test('constraint status endpoint visibility ignores sidebar-only emphasis and follows Canvas hover', () => {
  const f = fixture(), point = Object.assign(new Point(), { kind: 'endpoint', used: true, sidebar: true });
  f.view.constraintStatus = true;
  assert.equal(f.presentation.pointPaintState(point), null);
  f.hover.current.endpointPoint = point;
  assert.ok(f.presentation.pointPaintState(point));
  f.hover.current = {}; f.selection.points.push(point);
  assert.equal(f.presentation.pointPaintState(point).radius, 7);
});
test('primitive centers follow selection, hover, sidebar and drag while fixed colors preserve precedence', () => {
  const f = fixture(), point = Object.assign(new Point(), { kind: 'endpoint', used: true });
  f.selection.circles.push({ center: point }); assert.ok(f.presentation.pointPaintState(point));
  f.selection.circles.length = 0; f.hover.current.arcEndpoint = { arc: { center: point } };
  assert.ok(f.presentation.pointPaintState(point));
  f.hover.current = {}; f.hover.sidebarItem = { center: point }; assert.ok(f.presentation.pointPaintState(point));
  point.fixed = true; f.selection.points.push(point);
  let state = f.presentation.pointPaintState(point);
  assert.equal(state.fillColor, '#fee2e2'); assert.equal(state.color, '#dc2626'); assert.equal(state.showFixed, true);
  point.related = true; state = f.presentation.pointPaintState(point);
  assert.equal(state.color, '#0ea5e9'); assert.equal(state.fillColor, '#fee2e2');
  point.derivedProjection = {}; state = f.presentation.pointPaintState(point);
  assert.equal(state.showFixed, false); assert.equal(state.fillColor, '#1d4ed8');
});

test('arc handles require editable geometry and an actual selected, hovered or dragged endpoint', () => {
  const f = fixture(), arc = { start: { x: 1, y: 2 }, end: { x: 3, y: 4 }, operand: true };
  assert.equal(f.presentation.arcEndpointPaintState(arc, 'start'), null);
  f.hover.current.arcEndpoint = { arc, endpoint: 'start' };
  assert.equal(f.presentation.arcEndpointPaintState(arc, 'start').radius, 7);
  arc.operand = false; assert.equal(f.presentation.arcEndpointPaintState(arc, 'start').radius, 5);
  arc.fixed = true; assert.equal(f.presentation.arcEndpointPaintState(arc, 'start').color, 'theme:#dc2626');
  arc.inactive = true; assert.equal(f.presentation.arcEndpointPaintState(arc, 'start'), null);
  arc.inactive = false; f.hover.current = {}; f.selection.arcEndpointPair = [{ arc, endpoint: 'end' }];
  assert.equal(f.presentation.arcEndpointPaintState(arc, 'end').point, arc.end);
  arc.dragEnd = 'start'; assert.equal(f.presentation.arcEndpointPaintState(arc, 'start').radius, 7);
});
test('spline handle state follows current scope identity and point selection', () => {
  const f = fixture(), a = {}, b = {}, spline = { id: 'S1', closed: true, fitPoints: [a, b] };
  assert.equal(f.presentation.splineHandleState(), null);
  f.view.editedSpline = spline; f.view.scope = { splines: [{ id: 'S1' }] };
  assert.equal(f.presentation.splineHandleState(), null);
  f.view.scope.splines = [spline]; f.selection.points.push(b);
  const state = f.presentation.splineHandleState();
  assert.equal(state.closed, true); assert.equal(state.points[0].point, a);
  assert.equal(state.points[0].selected, false); assert.equal(state.points[1].selected, true);
});

test('construction line display preserves endpoint refs when disabled and computes zoom-dependent extensions without editing geometry', () => {
  const viewport = { scale: 2 }, p1 = { x: 0, y: 0 }, p2 = { x: 6, y: 8 }, line = { p1, p2, construction: true, length: () => 10, dx: () => 6, dy: () => 8 };
  let appearance = {}, reads = 0;
  const display = sandbox.window.GeometryPresentation.createLineDisplay({ viewport, constructionExtensionScreenPx: 12,
    effectiveAppearanceForElement: item => { assert.equal(item, line); reads++; return appearance; } });
  let segment = display.lineDisplaySegment(line); assert.ok(Math.abs(segment.p1.x + 3.6) < 1e-10); assert.ok(Math.abs(segment.p1.y + 4.8) < 1e-10); assert.ok(Math.abs(segment.p2.x - 9.6) < 1e-10); assert.equal(reads, 1);
  assert.equal(line.p1, p1); assert.equal(line.p2, p2); assert.equal(p1.x, 0); assert.equal(p2.x, 6);
  viewport.scale = 4; segment = display.lineDisplaySegment(line); assert.ok(Math.abs(segment.p1.x + 1.8) < 1e-10);
  appearance = { endpointOverhang: false }; segment = display.lineDisplaySegment(line); assert.equal(segment.p1, p1); assert.equal(segment.p2, p2);
  const before = reads; line.construction = false; segment = display.lineDisplaySegment(line, {}); assert.equal(reads, before); assert.equal(segment.p1, p1);
});
test('construction extension guard returns original refs for zero length and nonpositive/nonfinite world extensions', () => {
  const viewport = { scale: 1 }, line = { p1: {}, p2: {}, construction: true, length: () => 0, dx: () => { throw Error('must not evaluate direction'); }, dy: () => { throw Error('must not evaluate direction'); } };
  const display = sandbox.window.GeometryPresentation.createLineDisplay({ viewport, constructionExtensionScreenPx: 12, effectiveAppearanceForElement: () => ({}) });
  assert.equal(display.lineDisplaySegment(line).p1, line.p1); line.length = () => 10;
  for (const scale of [0, -1, NaN, Infinity]) { viewport.scale = scale; const segment = display.lineDisplaySegment(line); assert.equal(segment.p1, line.p1); assert.equal(segment.p2, line.p2); }
});

function commandTargetFixture() {
  const calls = [], item = { id: 'I', sketchId: 'reference' }, selected = { id: 'I' };
  const state = { panel: null, mode: 'select', operands: [], command: null, pending: null, active: false, reference: true };
  const sources = { includesRef(ref) { assert.equal(this, sources); calls.push('sources'); return ref.id === 'I'; } };
  const projection = { includes(value) { assert.equal(this, projection); calls.push('projection'); return value === item; } };
  const instance = { reference: null, sources: [] };
  const api = sandbox.window.GeometryPresentation.createCommandTargets({ readPanelSelection: () => state.panel, readMode: () => state.mode, instanceSourceCommand: sources, sketchProjectionCommand: projection, geometryInstanceCommand: instance,
    geometryRefForItem: value => { calls.push('ref'); return value; }, geometryRefsEqual: (a, b) => a.id === b.id,
    readOperands: () => { calls.push('operands'); return state.operands; }, sameArcEndpoint: (a, b) => a.arc === b.arc && a.endpoint === b.endpoint, operandElement: op => op.item,
    readConstraintCommand: () => state.command, isActiveSketchElement: () => { calls.push('active'); return state.active; },
    isReferenceSourceSketchId: id => { calls.push('reference'); assert.equal(id, item.sketchId); return state.reference; }, elementSketchId: value => value.sketchId,
    readPending: () => { calls.push('pending'); return state.pending; },
  });
  return { api, state, calls, item, selected, instance };
}
test('command target highlight keeps panel snapshot precedence and current Instance/projection/pattern sources', () => {
  const h = commandTargetFixture(); assert.equal(h.api.isConstraintOperandSelected(null), false); assert.equal(h.calls.length, 0);
  h.state.mode = 'instance-sources'; h.state.panel = { id: 'other' }; h.state.operands = [{ item: h.item }]; assert.equal(h.api.isConstraintOperandSelected(h.item), false);
  assert.equal(h.calls.includes('sources'), false); assert.equal(h.calls.includes('operands'), false);
  h.state.panel = h.selected; assert.equal(h.api.isConstraintOperandSelected(h.item), true);
  h.state.panel = null; h.calls.length = 0; assert.equal(h.api.isConstraintOperandSelected(h.item), true); assert.equal(h.calls.includes('operands'), false);
  h.state.mode = 'sketch-projection'; h.calls.length = 0; assert.equal(h.api.isConstraintOperandSelected(h.item), true); assert.deepEqual(h.calls, ['projection']);
  h.state.mode = 'pattern-placement-rotate'; h.instance.reference = h.item; h.calls.length = 0; assert.equal(h.api.isConstraintOperandSelected(h.item), true); assert.equal(h.calls.length, 0);
  h.instance.reference = null; h.instance.sources = [h.selected]; assert.equal(h.api.isConstraintOperandSelected(h.item), true);
});
test('operand highlighting preserves identity and explicit arc-endpoint priority over matching element operands', () => {
  const h = commandTargetFixture(), arc = {}, endpoint = { arc, endpoint: 'start' };
  h.state.operands = [{ item: h.item }]; assert.equal(h.api.isConstraintOperandSelected(h.item), true); assert.equal(h.api.isConstraintOperandSelected({ ...h.item }), false);
  assert.equal(h.api.isConstraintOperandSelected(h.item, { arcEndpoint: endpoint }), false);
  h.state.operands = [{ kind: 'arc-endpoint', ...endpoint, item: h.item }]; assert.equal(h.api.isConstraintOperandSelected(h.item, { arcEndpoint: endpoint }), true);
  assert.equal(h.api.isConstraintOperandSelected(h.item, { arcEndpoint: { arc, endpoint: 'end' } }), false);
});
test('reference hover and pending target reads keep command priority, short circuit and point/line/primitive identity', () => {
  const h = commandTargetFixture(); assert.equal(h.api.isReferenceHoverElement(h.item), false); assert.equal(h.calls.length, 0);
  h.state.command = {}; assert.equal(h.api.isReferenceHoverElement(h.item), true); h.state.active = true; h.calls.length = 0; assert.equal(h.api.isReferenceHoverElement(h.item), false); assert.deepEqual(h.calls, ['active']);
  for (const [kind, key] of [['point', 'point'], ['line', 'line'], ['primitive', 'primitive']]) {
    h.state.command = { referenceTarget: { kind, [key]: h.item } }; h.state.pending = { referenceTarget: { kind: 'point', point: {} } }; h.calls.length = 0;
    assert.equal(h.api.isPendingReferenceTarget(h.item), true); assert.equal(h.calls.includes('pending'), false); assert.equal(h.api.isPendingReferenceTarget({ ...h.item }), false);
  }
  h.state.command = { referenceTarget: { kind: 'unknown' } }; h.state.pending = { referenceTarget: { kind: 'point', point: h.item } }; h.calls.length = 0; assert.equal(h.api.isPendingReferenceTarget(h.item), false); assert.equal(h.calls.length, 0);
  h.state.command = null; assert.equal(h.api.isPendingReferenceTarget(h.item), true); h.state.pending = null; assert.equal(h.api.isPendingReferenceTarget(h.item), false);
});

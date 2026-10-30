const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/canvas_render_test_driver.js'), 'utf8'), sandbox);
for (const file of ['src/rendering/viewport.js', 'src/testing/canvas_test_driver.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);

test('construction observation restores Canvas methods on draw and appearance errors and forwards arc context', () => {
  for (const failureAt of [null, 'draw', 'appearance']) {
    const failure = new Error('failed'), arcCalls = [];
    const originalMove = () => {}, originalLine = () => {};
    function originalArc(...args) { arcCalls.push([this, args]); return 7; }
    const ctx = { moveTo: originalMove, lineTo: originalLine, arc: originalArc };
    const line = { id: 'L1', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } };
    const observation = sandbox.window.CanvasRenderTestDriver.createConstructionLineObservation({
      allGeometryLines: () => [line], ctx, viewport: { scale: 2 },
      drawLines: () => {
        ctx.moveTo(-2, 0); ctx.lineTo(12, 0);
        assert.equal(ctx.arc(0, 0, 1, 0, Math.PI), 7);
        if (failureAt === 'draw') throw failure;
      },
      effectiveAppearanceForElement: value => {
        assert.equal(value, line); assert.equal(ctx.moveTo, originalMove); assert.equal(ctx.lineTo, originalLine); assert.equal(ctx.arc, originalArc);
        if (failureAt === 'appearance') throw failure;
        return { endpointOverhang: false, endpointMarkers: true };
      },
    });
    assert.equal(observation.state('missing'), null);
    if (failureAt) assert.throws(() => observation.state('L1'), error => error === failure);
    else assert.deepEqual({ ...observation.state('L1') }, { endpointOverhang: false, endpointMarkers: true, overhangPx: 4, endpointMarkerCount: 1 });
    assert.equal(ctx.moveTo, originalMove); assert.equal(ctx.lineTo, originalLine); assert.equal(ctx.arc, originalArc);
    assert.equal(arcCalls.length, 1); assert.equal(arcCalls[0][0], ctx);
    assert.deepEqual(arcCalls[0][1], [0, 0, 1, 0, Math.PI]);
  }
});


function supportFixture(buildSupport = options => sandbox.window.CanvasRenderTestDriver.createRenderingSupport(options)) {
  const events = [], arcContexts = [], state = { ready: false, mode: 'select', dash: [], scope: { points: [], lines: [], blockInstances: [] }, definitions: [], hover: {}, selected: {}, appearance: {}, fail: null };
  const requireReady = () => assert.equal(state.ready, true, 'construction must not read or change a scene');
  class Point { constructor(id,x,y,fixed,kind) { requireReady(); Object.assign(this, { id,x,y,fixed,kind }); } }
  class Line { constructor(id,p1,p2,construction = false) { requireReady(); Object.assign(this, { id,p1,p2,construction }); } }
  const ctx = { setLineDash(value) { requireReady(); state.dash = Array.from(value); }, getLineDash: () => state.dash.slice(), moveTo() {}, lineTo() {}, arc() { arcContexts.push(this); return 7; } };
  const viewport = { scale: 1, update(value) { requireReady(); events.push(['view', value]); Object.assign(this, value); } };
  const reset = () => { requireReady(); events.push(['reset']); state.scope = { points: [], lines: [], blockInstances: [] }; state.definitions = []; state.selected = {}; state.hover = {}; lineCommand.startPoint = null; };
  const addPoint = (x,y,fixed,kind) => { const point = new Point('P'+(state.scope.points.length+1),x,y,fixed,kind); state.scope.points.push(point); return point; };
  const addLine = (p1,p2,construction) => { const line = new Line('L'+(state.scope.lines.length+1),p1,p2,construction); state.scope.lines.push(line); return line; };
  const lineCommand = { startPoint: null, click(point) { this.startPoint = addPoint(point.x, point.y, false, 'endpoint'); } };
  const circularCommands = { clickCircle(point) { this.circleCenterPoint = addPoint(point.x,point.y); }, clickArc(point) { this.arcCenterPoint ||= addPoint(point.x,point.y); } };
  const render = name => () => { requireReady(); events.push(['draw', name, ctx.getLineDash()]); if (state.fail?.name === name) throw state.fail.error;
    if (name === 'blockHandles') assert.equal(state.selected.blockInstances[0], state.scope.blockInstances[0]); };
  const bundle = instance => { requireReady(); return { lines: state.definitions.find(definition => definition.id === instance.definitionId).lines }; };
  const allLines = () => { requireReady(); return [...state.scope.lines, ...state.scope.blockInstances.flatMap(instance => bundle(instance).lines)]; };
  const drawLines = () => { requireReady(); for (const line of allLines()) { ctx.moveTo(line.p1.x-3,line.p1.y); ctx.lineTo(line.p2.x+3,line.p2.y); ctx.arc(); ctx.arc(); }
    if (state.fail?.name === 'lines') throw state.fail.error; };
  const options = {
    setMode: mode => { requireReady(); state.mode = mode; events.push(['mode', mode]); }, lineCommand,
    rectangleCommand: { click: () => { requireReady(); } }, slotCommand: { click: () => { requireReady(); } }, circularCommands,
    offsetSelection: { selectSource: line => { requireReady(); assert.ok(state.scope.lines.includes(line)); } },
    drawingPreview: { reset: () => { events.push(['preview-reset']); state.pointer = state.trim = null; }, setPointer: value => { state.pointer = value; }, setTrim: value => { state.trim = value; } }, addLine, addPoint,
    authoringPreviewLayer: { drawTemporaryLine: render('line'), drawRectanglePreview: render('rectangle'), drawSlotPreview: render('slot'), drawCirclePreview: render('circle'), drawArcPreview: render('arc'), drawTrimPreview: render('trim') },
    offsetPreviewLayer: { draw: render('offset') }, placementPreviewLayer: { drawBlockPlacementPreview: render('blockPlacement') },
    createEmptyBlockDefinition: name => { requireReady(); return { id: 'BD'+(state.definitions.length+1), name, points: [], lines: [] }; }, Point, Line, defaultSketchId: 'S1',
    appendDefinition: definition => { requireReady(); state.definitions.push(definition); events.push(['definition']); },
    blockPlacementCommand: { prepare: (id, ids) => { assert.equal(state.definitions[0].id, id); assert.deepEqual(Array.from(ids), ['S1']); } },
    activeSketchId: () => 'S1', currentScope: () => { requireReady(); return state.scope; }, canvasSelection: { set: (field, value) => { state.selected[field] = value; } }, drawBlockInstanceHandles: render('blockHandles'),
    resetModelState: reset, viewport, selectionRectangle: { reset: () => events.push(['selection-reset']), begin: () => { requireReady(); } }, ctx,
    drawSelectionRect: render('selection'), drawAnnotationLeader: render('annotationLeader'), draw: render('frame'),
    drawLines, canvasHover: { update: value => { requireReady(); Object.assign(state.hover,value); } }, invalidateBlockProjectionCache: () => { events.push(['invalidate']); }, blockProjectionBundle: bundle,
    allGeometryLines: allLines, effectiveAppearanceForElement: () => state.appearance,
  };
  const support = buildSupport(options, { state, events, requireReady });
  assert.deepEqual(events, []); state.ready = true;
  return { support, state, events, ctx, viewport: options.viewport, arcContexts };
}

test('rendering support defers scene access and connects draft, selection, Block, annotation and frame cases through shared draw owners', () => {
  const f = supportFixture(); assert.equal(Object.isFrozen(f.support), true);
  assert.deepEqual(Object.keys(f.support), ['canvasDashIsolationCases', 'constructionLineHoverDisplayCasesForTest', 'constructionLineRenderingForTest']);
  const result = f.support.canvasDashIsolationCases();
  const names = ['line','rectangle','slot','circle','arc','offset','trim','selection','blockPlacement','blockHandles','annotationLeader','frame'];
  assert.deepEqual(Object.keys(result), names); for (const value of Object.values(result)) assert.deepEqual(Array.from(value), [13,7]);
  assert.deepEqual(f.events.filter(event => event[0] === 'draw').map(event => event[1]), names);
  assert.equal(f.events.filter(event => event[0] === 'reset').length, 12); assert.equal(f.events.filter(event => event[0] === 'definition').length, 2);
  assert.deepEqual(f.events.slice(0,8).map(event => event[0]), ['reset','view','view','view','preview-reset','selection-reset','mode','mode']);
  assert.deepEqual(f.events.filter(event => event[0] === 'mode').map(event => event[1]), ['select','line','select','rectangle','select','slot','select','circle','select','arc','select','offset','select','trim','select','select','block-place','select','select','select']);
});

test('shared rendering support captures direct and Block overhang and reads current viewport and appearance while restoring the same Canvas', () => {
  const f = supportFixture(), original = [f.ctx.moveTo,f.ctx.lineTo,f.ctx.arc];
  assert.deepEqual({ ...f.support.constructionLineHoverDisplayCasesForTest() }, { direct: 6, block: 6 });
  assert.equal(f.state.hover.line, null); assert.equal(f.state.hover.block, null); assert.equal(f.state.definitions.length, 1);
  assert.deepEqual({ ...f.support.constructionLineRenderingForTest('BL1') }, { endpointOverhang: true, endpointMarkers: true, overhangPx: 6, endpointMarkerCount: 2 });
  f.viewport.scale = 4; f.state.appearance = { endpointOverhang: false, endpointMarkers: false };
  assert.deepEqual({ ...f.support.constructionLineRenderingForTest('BL1') }, { endpointOverhang: false, endpointMarkers: false, overhangPx: 12, endpointMarkerCount: 2 });
  assert.equal(f.support.constructionLineRenderingForTest('missing'), null);
  assert.ok(f.arcContexts.every(context => context === f.ctx));
  assert.equal(f.ctx.moveTo, original[0]); assert.equal(f.ctx.lineTo, original[1]); assert.equal(f.ctx.arc, original[2]);
});

test('rendering support propagates draft and recording errors at the original boundaries without running later cases', () => {
  const f = supportFixture(), error = new Error('rectangle draw failed'); f.state.fail = { name: 'rectangle', error };
  assert.throws(() => f.support.canvasDashIsolationCases(), value => value === error);
  assert.deepEqual(f.events.filter(event => event[0] === 'draw').map(event => event[1]), ['line','rectangle']); assert.equal(f.state.definitions.length, 0); assert.equal(f.state.mode, 'rectangle');
  f.state.fail = null; f.support.constructionLineHoverDisplayCasesForTest();
  const original = [f.ctx.moveTo,f.ctx.lineTo,f.ctx.arc]; f.state.fail = { name: 'lines', error };
  assert.throws(() => f.support.constructionLineRenderingForTest('BL1'), value => value === error);
  assert.equal(f.ctx.moveTo, original[0]); assert.equal(f.ctx.lineTo, original[1]); assert.equal(f.ctx.arc, original[2]);
});


function canvasSceneFixture(composed, probe = {}) {
  probe.order = []; const w = sandbox.window;
  const f = supportFixture((rendering, { state, events, requireReady }) => {
    state.units = { length: 'mm' }; const canvas = { getBoundingClientRect() { requireReady(); return { left: 5, top: 7, width: 200, height: 100 }; } };
    const viewport = w.CanvasViewport.create({ canvasRect: () => canvas.getBoundingClientRect(), initialScale: 1, minZoom: 0.1, maxZoom: 10, minLength: 0.001 });
    rendering.viewport = new Proxy(viewport, { get(target, key, receiver) { if (key === 'clampZoom') { probe.order.push('display'); if (probe.failAt === 'display') throw probe.error; } return Reflect.get(target, key, receiver); } });
    const document = { elementFromPoint(x, y) { requireReady(); assert.equal(this, document); events.push(['element', x, y]); return canvas; } };
    const model = { get units() { requireReady(); events.push(['units']); return state.units; },
      get blockDefinitions() { requireReady(); events.push(['append-access']); return state.definitions; } };
    rendering.appendDefinition = definition => model.blockDefinitions.push(definition);
    const display = { viewport: rendering.viewport, canvas, resizeCanvas: value => { requireReady(); events.push(['resize', value]); }, draw: rendering.draw,
      resetModelState: rendering.resetModelState, geometry: { addPoint: rendering.addPoint, addLine: rendering.addLine }, currentScope: rendering.currentScope, rootSketchId: 'ROOT',
      fitAllGeometryToViewport: () => true, allGeometryBounds: () => null, visibleGeometryBounds: () => null, isVisibleSketchId: () => true,
      updateUI: () => { requireReady(); events.push(['ui']); }, readUnits: () => model.units, cssPxPerMm: 1,
      snapCandidates: () => [], hits: Object.fromEntries(['hitArcEndpoint', 'hitPoint', 'hitLine', 'hitCircle', 'hitArc', 'hitSpline', 'hitDimension'].map(key => [key, () => null])),
      evaluateSpline: () => null, elementFromPoint: (x, y) => document.elementFromPoint(x, y) };
    const input = { document, canvas, viewport: rendering.viewport,
      documentWorkspace: { document: model, workspace: { current: rendering.currentScope }, sketches: { activeSketchId: rendering.activeSketchId } },
      readServices: { reads: { allGeometryLines: rendering.allGeometryLines }, projections: { invalidateBlockProjectionCache: rendering.invalidateBlockProjectionCache, blockProjectionBundle: rendering.blockProjectionBundle },
        geometryAppearance: { effectiveAppearanceForElement: rendering.effectiveAppearanceForElement, isVisibleSketchId: display.isVisibleSketchId } },
      geometry: display.geometry, interaction: { lifecycle: { setMode: rendering.setMode }, selection: rendering.canvasSelection, hover: rendering.canvasHover }, sessions: { preview: rendering.drawingPreview },
      authoring: { tools: { line: rendering.lineCommand, rectangle: rendering.rectangleCommand, slot: rendering.slotCommand, circular: rendering.circularCommands }, snap: { candidates: display.snapCandidates }, offsetSelection: rendering.offsetSelection },
      presentation: { draw: rendering.draw, updateUI: display.updateUI }, display: { bounds: { allGeometryBounds: display.allGeometryBounds, visibleGeometryBounds: display.visibleGeometryBounds }, fit: { fitAllGeometryToViewport: display.fitAllGeometryToViewport }, geometry: { drawLines: rendering.drawLines } },
      ctx: rendering.ctx, selectionRectangle: rendering.selectionRectangle, layers: { authoringPreviewLayer: rendering.authoringPreviewLayer, offsetPreviewLayer: rendering.offsetPreviewLayer, placementPreviewLayer: rendering.placementPreviewLayer },
      blocks: { createEmptyBlockDefinition: rendering.createEmptyBlockDefinition, blockPlacementCommand: rendering.blockPlacementCommand, drawBlockInstanceHandles: rendering.drawBlockInstanceHandles },
      drawSelectionRect: rendering.drawSelectionRect, drawAnnotationLeader: rendering.drawAnnotationLeader, resizeCanvas: display.resizeCanvas, resetModelState: rendering.resetModelState,
      rootSketchId: 'ROOT', defaultSketchId: rendering.defaultSketchId, cssPxPerMm: 1, types: { Point: rendering.Point, Line: rendering.Line }, hits: display.hits, evaluateSpline: display.evaluateSpline };
    const original = w.CanvasRenderTestDriver; w.CanvasRenderTestDriver = { ...original, createRenderingSupport(ports) {
      probe.order.push('rendering'); probe.renderingPorts = ports; if (probe.failAt === 'rendering') throw probe.error;
      return probe.rendering = original.createRenderingSupport(ports);
    } };
    try {
      const result = composed ? w.CanvasTestDriver.createForScene(input) : { display: w.CanvasTestDriver.createDisplaySupport(display), rendering: w.CanvasRenderTestDriver.createRenderingSupport(rendering) };
      probe.result = result; probe.input = input; probe.displayOptions = display; return result.rendering;
    } finally { w.CanvasRenderTestDriver = original; }
  });
  return { ...f, probe, display: probe.result.display };
}

test('Canvas scene test support constructs actual display then rendering without eager model, units, viewport or drawing operations', () => {
  for (const composed of [false, true]) {
    const f = canvasSceneFixture(composed), { input, renderingPorts: ports } = f.probe;
    assert.deepEqual(f.probe.order, ['display', 'rendering']); assert.deepEqual(f.events, []); assert.equal(f.support, f.probe.rendering);
    assert.equal(f.display.publicAPI.focusWorldForTest, f.display.focus); assert.equal(f.display.publicAPI.worldClientPositionForTest, f.display.clientPosition);
    assert.equal(ports.viewport, input.viewport); assert.equal(ports.ctx, f.ctx); assert.equal(ports.currentScope, input.documentWorkspace.workspace.current);
    assert.equal(ports.drawingPreview, input.sessions.preview); assert.equal(ports.canvasSelection, input.interaction.selection); assert.equal(ports.addPoint, input.geometry.addPoint);
    const point = { x: 3, y: 4 }; const client = f.display.clientPosition(point), screen = f.viewport.worldToCanvasScreen(point);
    assert.deepEqual({ ...client }, { x: screen.x + 5, y: screen.y + 7 });
    f.display.focus({ x: 10, y: 20 }, 3); assert.equal(f.viewport.scale, 3); f.display.publicAPI.displayZoomStateForTest(); assert.ok(f.events.some(event => event[0] === 'units'));
    if (composed) assert.equal(Object.isFrozen(f.probe.result), true);
  }
});

test('Canvas scene test support shares live viewport, current Block registry, Geometry and context restoration across display and render observations', () => {
  for (const composed of [false, true]) {
    const f = canvasSceneFixture(composed), methods = [f.ctx.moveTo, f.ctx.lineTo, f.ctx.arc];
    const result = f.support.canvasDashIsolationCases(); assert.equal(Object.keys(result).length, 12); for (const value of Object.values(result)) assert.deepEqual(Array.from(value), [13, 7]);
    assert.equal(f.events.filter(event => event[0] === 'append-access').length, 2);
    assert.deepEqual({ ...f.support.constructionLineHoverDisplayCasesForTest() }, { direct: 6, block: 6 });
    assert.equal(f.state.definitions.length, 1); assert.ok(f.state.scope.blockInstances[0]); assert.equal(f.state.definitions[0].lines[0], f.probe.renderingPorts.blockProjectionBundle(f.state.scope.blockInstances[0]).lines[0]);
    f.viewport.update({ scale: 4 }); f.state.appearance = { endpointOverhang: false, endpointMarkers: false };
    assert.deepEqual({ ...f.support.constructionLineRenderingForTest('BL1') }, { endpointOverhang: false, endpointMarkers: false, overhangPx: 12, endpointMarkerCount: 2 });
    assert.equal(f.ctx.moveTo, methods[0]); assert.equal(f.ctx.lineTo, methods[1]); assert.equal(f.ctx.arc, methods[2]); assert.ok(f.arcContexts.every(context => context === f.ctx));
  }
});

test('Canvas scene support preserves construction short circuits and rendering failure boundaries without running later cases', () => {
  for (const composed of [false, true]) {
    for (const failAt of ['display', 'rendering']) {
      const probe = { failAt, error: new Error(failAt) }; assert.throws(() => canvasSceneFixture(composed, probe), error => error === probe.error);
      assert.deepEqual(probe.order, failAt === 'display' ? ['display'] : ['display', 'rendering']);
    }
    const f = canvasSceneFixture(composed), marker = new Error('rectangle'); f.state.fail = { name: 'rectangle', error: marker };
    assert.throws(() => f.support.canvasDashIsolationCases(), error => error === marker);
    assert.deepEqual(f.events.filter(event => event[0] === 'draw').map(event => event[1]), ['line', 'rectangle']); assert.equal(f.state.definitions.length, 0);
    f.state.fail = null; f.support.constructionLineHoverDisplayCasesForTest(); const methods = [f.ctx.moveTo, f.ctx.lineTo, f.ctx.arc];
    f.state.fail = { name: 'lines', error: marker }; assert.throws(() => f.support.constructionLineRenderingForTest('BL1'), error => error === marker);
    assert.equal(f.ctx.moveTo, methods[0]); assert.equal(f.ctx.lineTo, methods[1]); assert.equal(f.ctx.arc, methods[2]);
  }
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/testing/canvas_render_test_driver.js'), 'utf8'), sandbox);

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


function supportFixture() {
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
  const support = sandbox.window.CanvasRenderTestDriver.createRenderingSupport({
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
  });
  assert.deepEqual(events, []); state.ready = true;
  return { support, state, events, ctx, viewport, arcContexts };
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


const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/editing/instance_command_input.js'),'utf8'),sandbox);
for (const file of ['src/geometry/spline_geometry.js', 'src/editing/rectangle_selection_query.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
function rectangleSourcesFixture() {
  const calls = [], state = { mode: 'instance-sources', instance: { type: 'mirror' }, active: 'S1', entries: [], scene: { points: [], lines: [], circles: [], arcs: [], splines: [], hatches: [] },
    failure: null, error: new Error('source selection failed'), providers: [], visible: [], sourceResult: null, geometryResult: null };
  function stage(name) { calls.push(name); if (state.failure === name) throw state.error; }
  const inside = (p, r) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
  const contains = (b, r) => b.x1 >= r.x1 && b.x2 <= r.x2 && b.y1 >= r.y1 && b.y2 <= r.y2;
  const intersects = (b, r) => b.x1 <= r.x2 && b.x2 >= r.x1 && b.y1 <= r.y2 && b.y2 >= r.y1;
  const realQuery = sandbox.window.RectangleSelectionQuery.create({ isExplicitPoint: p => p.kind === 'explicit', isReferencePoint: p => p.reference,
    pointInRect: inside, lineIntersectsRect: (l, r) => intersects(l.box, r), lineBBox: l => l.box, primitiveBBox: item => item.box,
    bboxInRect: contains, bboxIntersectsRect: intersects, arcSamplePoints: arc => arc.samples, viewScale: () => 2,
    resolvedLoopBounds: box => box, resolvedHatchBoundary: hatch => hatch.box });
  const geometryReads = Object.fromEntries(Object.keys(state.scene).map(kind => [kind === 'hatches' ? 'allHatches' : 'allGeometry' + kind[0].toUpperCase() + kind.slice(1),
    () => { stage('read:' + kind); return state.scene[kind]; }]));
  const query = { readProjection(rect, crossing, providers, predicate) {
    assert.equal(this, query); stage('query'); state.providers.push(providers); state.queryArgs = { rect, crossing };
    const result = realQuery.readProjection(rect, crossing, providers, predicate); state.result = result; state.onQuery?.(); return result;
  } };
  const source = { get instance() { stage('instance'); return state.instance; }, addSources(items) { assert.equal(this, source); stage('source-add'); state.sourceResult = items; return 42; } };
  const geometry = { addSources(items) { assert.equal(this, geometry); stage('geometry-add'); state.geometryResult = items; return 42; } };
  const api = sandbox.window.InstanceCommandInput.createRectangleSources({ getMode: () => { stage('mode'); return state.mode; },
    instanceSourceCommand: source, geometryInstanceCommand: geometry, query, geometryReads,
    sketchProjectionEntriesByRect: (rect, crossing) => { stage('entries'); state.entryArgs = { rect, crossing }; state.onEntries?.(); return state.entries; },
    elementSketchId: item => { stage('element'); return item.sketchId; }, activeSketchId: () => { stage('active'); return state.active; },
    isVisibleSketchElement: item => { stage('visible'); state.visible.push(item); return item.visible !== false; } });
  assert.deepEqual(calls, []); assert.equal(Object.isFrozen(api), true);
  return { state, calls, api, geometryReads, rect: { x1: 0, y1: 0, x2: 10, y2: 10 } };
}

test('projection instance rectangle sources map entries in order without normal queries or retargeting after query', () => {
  const f = rectangleSourcesFixture(), first = { id: 'P1' }, second = { id: 'L1' }; f.state.instance.type = 'sketchProjection';
  f.state.entries = [{ item: first }, { item: second }, { item: first }]; f.state.onEntries = () => { f.state.mode = 'pattern-placement-place'; };
  assert.equal(f.api.add(f.rect, true), undefined); assert.deepEqual(f.calls, ['mode', 'instance', 'entries', 'source-add']);
  assert.deepEqual(Array.from(f.state.sourceResult), [first, second, first]); assert.equal(f.state.geometryResult, null);
  assert.equal(f.state.entryArgs.rect, f.rect); assert.equal(f.state.entryArgs.crossing, true);
});

test('normal rectangle sources use all six current readers and existing containment and active visible filters', () => {
  const f = rectangleSourcesFixture(), box = { x1: 2, y1: 2, x2: 4, y2: 4 };
  const point = { kind: 'explicit', x: 2, y: 3, sketchId: 'S1' }, inactive = { ...point, sketchId: 'S2' }, hidden = { ...point, visible: false };
  const line = { box, sketchId: 'S1' }, crossing = { box: { ...box, x1: -2 }, sketchId: 'S1' }, circle = { box, sketchId: 'S1' };
  const arc = { samples: [{ x: 2, y: 2 }, { x: 3, y: 3 }], sketchId: 'S1' };
  const spline = { curve: () => sandbox.window.SplineGeometry.build([{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 2 }]), sketchId: 'S1' }, hatch = { box, sketchId: 'S1' };
  f.state.scene = { points: [point, inactive, hidden, { ...point, kind: 'support' }], lines: [line, crossing], circles: [circle], arcs: [arc], splines: [spline], hatches: [hatch] };
  const before = JSON.stringify(f.state.scene);
  assert.equal(f.api.add(f.rect, false), undefined); assert.equal(f.state.sourceResult, f.state.result);
  assert.deepEqual(Array.from(f.state.sourceResult), [point, line, circle, arc, spline, hatch]); assert.ok(!f.state.visible.includes(inactive));
  assert.deepEqual(f.calls.filter(c => c.startsWith('read:')), ['read:points', 'read:lines', 'read:circles', 'read:arcs', 'read:splines', 'read:hatches']);
  const names = { points: 'allGeometryPoints', lines: 'allGeometryLines', circles: 'allGeometryCircles', arcs: 'allGeometryArcs', splines: 'allGeometrySplines', hatches: 'allHatches' };
  for (const [kind, name] of Object.entries(names)) assert.equal(f.state.providers[0][kind], f.geometryReads[name]);
  assert.equal(f.state.queryArgs.rect, f.rect); assert.equal(f.state.queryArgs.crossing, false); assert.equal(JSON.stringify(f.state.scene), before);
  f.api.add(f.rect, true); assert.ok(f.state.sourceResult.includes(crossing)); assert.notEqual(f.state.providers[0], f.state.providers[1]);
  f.state.scene.points = [{ ...point, id: 'fresh' }]; f.api.add(f.rect, true); assert.equal(f.state.sourceResult[0], f.state.scene.points[0]);
});

test('normal rectangle sources choose the current command after query and do not introduce an extra mode restriction', () => {
  for (const [before, after, target] of [['instance-sources', 'pattern-placement-place', 'geometryResult'], ['pattern-placement-place', 'instance-sources', 'sourceResult'], ['select', 'select', 'geometryResult']]) {
    const f = rectangleSourcesFixture(); f.state.mode = before; f.state.instance = null;
    f.state.onQuery = () => { f.state.mode = after; }; f.api.add(f.rect, undefined);
    assert.equal(f.state[target], f.state.result); assert.equal(f.calls.filter(c => c === 'mode').length, 2);
    assert.equal(f.state.queryArgs.crossing, undefined); assert.equal(f.calls.includes('instance'), before === 'instance-sources');
  }
});

test('source rectangle query and command errors propagate without invoking a later or alternate command', () => {
  for (const failed of ['mode', 'instance', 'entries', 'query', 'read:points', 'element', 'active', 'visible', 'source-add', 'geometry-add']) {
    const f = rectangleSourcesFixture(); f.state.failure = failed; f.state.scene.points = [{ kind: 'explicit', x: 2, y: 2, sketchId: 'S1' }];
    if (failed === 'entries') f.state.instance.type = 'sketchProjection'; if (failed === 'geometry-add') f.state.mode = 'pattern-placement-place';
    assert.throws(() => f.api.add(f.rect, true), error => error === f.state.error); assert.equal(f.calls.at(-1), failed);
    assert.equal(f.state.sourceResult, null); assert.equal(f.state.geometryResult, null);
    if (!['source-add', 'geometry-add'].includes(failed)) assert.ok(!f.calls.includes('source-add') && !f.calls.includes('geometry-add'));
  }
});
function fixture(){
  const f={mode:'select',calls:[],reference:null,derived:null,block:null};const record=name=>(...args)=>f.calls.push({name,args});
  f.source={instance:{type:'mirror'},toggle:record('toggle')};f.geometry={placeFree:record('place'),selectReference:record('commit')};
  f.p={x:1,y:2};f.snapped={x:3,y:4};f.e={pointerId:7,preventDefault:record('prevent')};
  f.controller=sandbox.window.InstanceCommandInput.create({getMode:()=>f.mode,instanceSourceCommand:f.source,geometryInstanceCommand:f.geometry,
    hitReferenceTarget:()=>{record('referenceHit')();return f.reference;},hitDerivedProjectionOperand:()=>{record('derivedHit')();return f.derived;},
    hitBlockProjectionOperand:()=>{record('blockHit')();return f.block;},operandElement:operand=>operand.element,toggleSketchProjectionSource:record('projection'),
    clearSnap:record('clearSnap'),selectionRectangle:{begin:record('rectangle')},capturePointer:record('capture'),snapForDrawing:p=>{assert.equal(p,f.p);record('snap')();return f.snapped;},
    makeConstraintOperand:(kind,{line})=>({kind,line}),setHint:record('hint'),applicationText:a=>a,releasePanelFocus() {}});
  f.click=hits=>f.controller.click(f.e,f.p,hits||{});f.names=()=>f.calls.map(c=>c.name);return f;
}
test('source editing uses projection reference queries or derived-before-block operands',()=>{
  const f=fixture();f.mode='instance-sources';f.source.instance.type='sketchProjection';const element={id:'P'};f.reference={element};
  assert.equal(f.click(),true);assert.deepEqual(f.names(),['prevent','referenceHit','toggle']);assert.equal(f.calls.at(-1).args[0],element);
  f.calls=[];f.source.instance.type='mirror';f.derived={element};f.block={element:{id:'B'}};f.click();assert.deepEqual(f.names(),['prevent','derivedHit','toggle']);
  f.calls=[];f.derived=null;f.click();assert.equal(f.calls.at(-1).args[0],f.block.element);
});
test('source editing falls back to direct hits in point line circle arc spline order',()=>{
  const f=fixture();f.mode='instance-sources';const hits={hitP:{},hitL:{},hitC:{},hitA:{},hitS:{}};
  for(const key of Object.keys(hits)){f.calls=[];f.click(hits);assert.equal(f.calls.at(-1).args[0],hits[key]);delete hits[key];}
});
test('projection empty-space input clears snap and begins a captured projection rectangle',()=>{
  const f=fixture();f.mode='sketch-projection';assert.equal(f.click(),true);assert.deepEqual(f.names(),['prevent','referenceHit','clearSnap','rectangle','capture']);
  assert.equal(f.calls[3].args[0],f.p);assert.equal(f.calls[3].args[1].kind,'sketch-projection');assert.equal(f.calls[4].args[0],7);
  f.reference={id:'R'};f.calls=[];f.click();assert.deepEqual(f.names(),['prevent','referenceHit','projection']);assert.equal(f.calls[2].args[0],f.reference);
});
test('free placement forwards snapped coordinates without suppressing browser input',()=>{
  const f=fixture();for(const mode of ['pattern-placement-origin','pattern-placement-place']){f.mode=mode;f.calls=[];assert.equal(f.click(),true);assert.deepEqual(f.names(),['snap','place']);assert.equal(f.calls[1].args[0],f.snapped);}
});
test('migrated line-reference placement edits use the unified input mode',()=>{
 const f=fixture();f.mode='pattern-placement-place';f.geometry.activeInput='reference';const line={id:'L'};
 f.click({hitL:line});assert.deepEqual(f.names(),['snap','commit']);assert.equal(f.calls.at(-1).args[0],line);
 f.mode='select';f.calls=[];assert.equal(f.click({hitL:line}),false);
});

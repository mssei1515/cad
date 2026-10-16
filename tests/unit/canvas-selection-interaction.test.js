
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing/canvas_selection_interaction.js'), 'utf8'), sandbox);
function fixture() {
  const f = { calls: [], count: 1, top: null };
  const selection = {};
  const arrays = ['points','lines','circles','arcs','splines','blockInstances','geometryInstances','annotations','hatches','referenceImages'];
  const clear = () => { arrays.forEach(k => selection[k] = []); selection.arcEndpoint = null; };
  clear();
  Object.assign(selection, { set: (k,v) => selection[k]=v, append: (k,v) => selection[k].push(v),
    removeAt: (k,i,n) => selection[k].splice(i,n), toggleById: (k,v) => { const i=selection[k].findIndex(x=>x.id===v.id); if(i<0)selection[k].push(v);else selection[k].splice(i,1); } });
  for(const [name,key] of Object.entries({Point:'points',Line:'lines',Circle:'circles',Arc:'arcs',Spline:'splines',BlockInstance:'blockInstances'})) {
    selection['toggle'+name+'Selection'] = v => selection.toggleById(key,v);
  }
  selection.selectedElementCount = () => f.count;
  selection.selectedDragPoints = () => f.dragPoints;
  const record = name => (...args) => f.calls.push({name,args});
  f.selection=selection; f.event={pointerId:3}; f.point={x:1,y:2};
  f.controller=sandbox.window.CanvasSelectionInteraction.create({canvasSelection:selection,clearSelection:clear,
    sameArcEndpoint:(a,b)=>a?.arc===b?.arc&&a?.endpoint===b?.endpoint,
    topmostDrawingOrderOwner:items=>f.top||items.find(Boolean),drawingOrderOwner:x=>x.owner||x,
    beginDerivedGeometryDrag:record('derived'),beginBlockDrag:record('block'),beginDimensionDrag:record('dimension'),
    beginReferenceImageDrag:record('image'),buildDragSession:(...args)=>{f.plan=args;return args;},
    geometryDrag:{begin:(...args)=>{record('geometry')(...args);return true;},label:'drag'},
    selectionRectangle:{begin:record('rectangle')},capturePointer:record('capture'),setHint:record('hint'),
    applicationText:a=>a,updateGeometrySelectionUI:record('ui'),draw:record('draw')});
  f.begin=hits=>f.controller.begin(f.event,f.point,hits);
  f.names=()=>f.calls.map(c=>c.name);return f;
}
test('drawing order chooses front geometry while a direct point wins over a block handle',()=>{
  const f=fixture(),line={id:'L'},circle={id:'C'};f.top=circle;f.begin({hitL:line,hitC:circle});
  assert.equal(f.plan[0],'circle');assert.equal(f.plan[1],circle);assert.deepEqual(f.names(),['geometry','hint','ui','draw']);
  f.calls=[];const block={id:'B'},point={id:'P'};f.top=block;f.begin({hitBlock:block,hitBlockHandle:block,hitP:point});
  assert.equal(f.plan[0],'point');assert.equal(f.plan[1],point);assert.equal(f.calls[0].args[0],f.event);
});
test('derived geometry additive selection toggles its owner and clears constraint selection',()=>{
  const f=fixture(),instance={id:'I'};f.event.shiftKey=true;f.selection.constraint={};f.selection.instanceGeometry={};
  f.begin({hitDerivedGeometry:{instance}});assert.equal(f.selection.geometryInstances[0],instance);
  assert.equal(f.selection.constraint,null);assert.equal(f.selection.instanceGeometry,null);
  f.begin({hitDerivedGeometry:{instance}});assert.equal(f.selection.geometryInstances.length,0);
});
test('arc endpoint additive selection retains a distinct endpoint pair',()=>{
  const f=fixture(),arc={id:'A'},first={arc,endpoint:'start'},last={arc,endpoint:'end'};
  f.event.ctrlKey=true;f.selection.arcEndpoint=first;f.begin({hitArcEnd:last});
  assert.equal(f.selection.arcEndpointPair[0],first);assert.equal(f.selection.arcEndpointPair[1].endpoint,'end');
  assert.equal(f.selection.arcs[0],arc);
});
test('spline dragging preserves mixed selection or replaces it for an unselected spline',()=>{
  const f=fixture(),spline={id:'S'},point={id:'P'};f.count=2;f.dragPoints=[point];f.selection.splines=[spline];f.selection.points=[point];
  f.begin({hitS:spline});assert.equal(f.plan[0],'selection');assert.equal(f.plan[1],f.dragPoints);assert.equal(f.selection.points[0],point);
  const other={id:'S2'};f.begin({hitS:other});assert.equal(f.plan[0],'spline');assert.equal(f.plan[1],other);assert.equal(f.selection.points.length,0);
});
test('projected hatch selects its block and image drag owns its update path',()=>{
  const f=fixture(),block={id:'B'};f.begin({hatchHit:{blockProjection:true,blockInstance:block}});
  assert.equal(f.selection.blockInstances[0],block);assert.equal(f.selection.hatches.length,0);
  f.calls=[];f.begin({referenceImageHit:{id:'R'}});assert.deepEqual(f.names(),['image']);
});
test('blank additive selection begins a rectangle and captures the same pointer',()=>{
  const f=fixture();f.event.shiftKey=true;f.begin({});assert.deepEqual(f.names(),['rectangle','capture','ui','draw']);
  assert.equal(f.calls[0].args[0],f.point);assert.equal(f.calls[0].args[1].additive,true);assert.equal(f.calls[1].args[0],3);
});

test('dragging a selected primitive preserves the mixed selection and clears constraint selection',()=>{
  const f=fixture(),line={id:'L'},point={id:'P'};f.count=2;f.dragPoints=[point];
  f.selection.lines=[line];f.selection.points=[point];f.selection.constraint={};f.selection.dimensionConstraint={};
  f.begin({hitL:line});assert.equal(f.plan[0],'selection');assert.equal(f.plan[1],f.dragPoints);
  assert.equal(f.selection.points[0],point);assert.equal(f.selection.lines[0],line);
  assert.equal(f.selection.constraint,null);assert.equal(f.selection.dimensionConstraint,null);
});
test('unselected primitive replaces drawable selection before starting its plan',()=>{
  const f=fixture(),line={id:'new'},old={id:'old'};f.count=2;
  for(const key of ['points','lines','circles','arcs','splines','blockInstances','annotations','hatches','referenceImages']) f.selection[key]=[old];
  f.begin({hitL:line});assert.equal(f.plan[0],'line');assert.equal(f.plan[1],line);assert.equal(f.plan[2],f.point);
  assert.equal(f.selection.lines[0],line);
  for(const key of ['points','circles','arcs','splines','blockInstances','annotations','hatches','referenceImages']) assert.equal(f.selection[key].length,0);
});
test('selected endpoint preserves mixed drag only for the same arc reference and endpoint',()=>{
  const f=fixture(),arc={id:'A'},point={id:'P'};f.count=2;f.dragPoints=[point];f.selection.arcEndpoint={arc,endpoint:'start'};
  f.begin({hitArcEnd:{arc,endpoint:'start'}});assert.equal(f.plan[0],'selection');
  const end={arc,endpoint:'end'};f.begin({hitArcEnd:end});assert.equal(f.plan[0],'arc-endpoint');assert.equal(f.plan[1],end);
  assert.equal(f.selection.arcEndpoint.endpoint,'end');assert.equal(f.selection.arcs[0],arc);
});

function identityFixture() {
  const calls = [], state = { sketchId: null };
  const selection = { set(field, items) { assert.equal(this, selection); calls.push(['set', field, items]); }, toggleById(field, item) { assert.equal(this, selection); calls.push(['toggle', field, item]); } };
  const api = sandbox.window.CanvasSelectionInteraction.createIdentitySelection({ canvasSelection: selection,
    selectionSketchId: () => { calls.push(['sketch']); return state.sketchId; }, clearSelection: () => calls.push(['clear']), updateGeometrySelectionUI: () => calls.push(['ui']), draw: () => calls.push(['draw']) });
  return { api, calls, state };
}
test('identity selection retains field mappings, Block-before-derived owner priority and update/draw order without rewriting identity', () => {
  const h = identityFixture();
  for (const [kind, field] of [['point', 'points'], ['line', 'lines'], ['circle', 'circles'], ['arc', 'arcs'], ['spline', 'splines'], ['block', 'blockInstances'], ['instance', 'geometryInstances'], ['geometry-instance', 'geometryInstances'], ['dimension', 'dimensionConstraints'], ['annotation', 'annotations'], ['hatch', 'hatches'], ['image', 'referenceImages']]) {
    h.calls.length = 0; const item = {}, identity = { kind, item, sketchId: 'S' }; assert.equal(h.api.selectIdentity(identity), true);
    assert.deepEqual(h.calls.map(c => c[0]), ['clear', 'set', 'ui', 'draw']); assert.equal(h.calls[1][1], field); assert.equal(h.calls[1][2][0], item); assert.equal(identity.item, item); assert.equal(identity.kind, kind);
  }
  const block = {}, derived = {}, projected = { blockInstance: block, derivedInstance: derived }; h.calls.length = 0;
  assert.equal(h.api.selectIdentity({ kind: 'line', item: projected, sketchId: 'S' }), true); assert.equal(h.calls[1][1], 'blockInstances'); assert.equal(h.calls[1][2][0], block);
  h.calls.length = 0; assert.equal(h.api.selectIdentity({ kind: 'point', item: { derivedInstance: derived }, sketchId: 'S' }), true); assert.equal(h.calls[1][1], 'geometryInstances'); assert.equal(h.calls[1][2][0], derived);
});
test('identity additive selection preserves Sketch refusal, ID-toggle receiver and clear-before-unknown-kind behavior', () => {
  const h = identityFixture(), item = {}, identity = { kind: 'line', item, sketchId: 'S' }; h.state.sketchId = 'other';
  assert.equal(h.api.selectIdentity(identity, true), false); assert.deepEqual(h.calls.map(c => c[0]), ['sketch', 'sketch']);
  h.calls.length = 0; h.state.sketchId = 'S'; assert.equal(h.api.selectIdentity(identity, true), true); assert.deepEqual(h.calls.map(c => c[0]), ['sketch', 'sketch', 'toggle', 'ui', 'draw']); assert.equal(h.calls[2][2], item);
  h.calls.length = 0; assert.equal(h.api.selectIdentity({ kind: 'unknown', item, sketchId: 'S' }), false); assert.deepEqual(h.calls.map(c => c[0]), ['clear']);
  h.calls.length = 0; h.state.sketchId = null; assert.equal(h.api.selectIdentity(identity, true), true); assert.deepEqual(h.calls.map(c => c[0]), ['sketch', 'toggle', 'ui', 'draw']);
});

for (const file of ['src/editing/constraint_target_session.js', 'src/editing/canvas_hover.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}

test('clearing selection retains the active constraint command and unrelated hover references', () => {
  const session = sandbox.window.ConstraintTargetSession.create({});
  const command = { type: 'horizontal' }; session.replaceCommand(command); session.replaceOperands([{}]);
  const hover = sandbox.window.CanvasHover.create({ isEndpointPoint: () => false });
  const keep = { point: {}, endpointPoint: {}, line: {}, circle: {}, arc: {}, arcEndpoint: {}, dimension: {}, annotationHandle: {} };
  hover.update({ ...keep, sketchIdentity: {}, block: {}, geometryInstance: {}, annotation: {}, hatch: {}, referenceImage: {}, spline: {} });
  const selection = { items: [{}], clear() { this.items = []; } };
  const highlight = { current: {}, reset() { this.current = null; } };
  const clearing = sandbox.window.CanvasSelectionInteraction.createClearing({ canvasSelection: selection,
    constraintTargetSession: session, canvasHover: hover, selectionHighlight: highlight });
  assert.equal(clearing.clear(), undefined);
  assert.deepEqual(selection.items, []); assert.equal(highlight.current, null);
  assert.equal(session.command, command); assert.equal(session.operands.length, 0);
  for (const [key, value] of Object.entries(keep)) assert.equal(hover.current[key], value, key);
  for (const key of ['sketchIdentity', 'block', 'geometryInstance', 'annotation', 'hatch', 'referenceImage', 'spline']) assert.equal(hover.current[key], null, key);
});

test('selection clearing preserves receiver and the two hover phases around highlight reset', () => {
  const events = [];
  const selection = { clear() { assert.equal(this, selection); events.push('selection'); } };
  const session = { clearOperands() { assert.equal(this, session); events.push('operands'); } };
  const highlight = { reset() { assert.equal(this, highlight); events.push('highlight'); } };
  const hover = { update(patch) { assert.equal(this, hover); events.push(Object.keys(patch)); } };
  const clearing = sandbox.window.CanvasSelectionInteraction.createClearing({ canvasSelection: selection,
    constraintTargetSession: session, canvasHover: hover, selectionHighlight: highlight });
  assert.deepEqual(events, []);
  clearing.clear();
  assert.deepEqual(events, ['selection', 'operands', ['sketchIdentity', 'block', 'geometryInstance'], 'highlight',
    ['annotation', 'hatch', 'referenceImage', 'spline']]);
});


test('document Canvas reset uses live owners and preserves fields outside the explicit replacement phase', () => {
  const context = { window: { GeometrySolver: {} } }; vm.createContext(context);
  for (const file of ['selection.js', 'canvas_hover.js', 'canvas_selection_interaction.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/editing', file), 'utf8'), context);
  }
  const selection = context.window.CanvasSelection.create();
  const hover = context.window.CanvasHover.create({ isEndpointPoint: () => false });
  const retained = Object.freeze({ id: 'retained' }), events = [];
  for (const field of ['points', 'lines', 'circles', 'arcs', 'splines', 'annotations', 'hatches', 'referenceImages', 'blockInstances', 'geometryInstances', 'dimensionConstraints']) selection.set(field, [retained]);
  selection.set('arcEndpoint', retained); selection.set('arcEndpointPair', retained);
  selection.set('constraint', retained); selection.set('instanceGeometry', retained);
  selection.set('sketchId', 'S2');
  hover.update(Object.fromEntries(Object.keys(hover.current).map(key => [key, retained])));
  let pointer = retained, snap = retained;
  const api = context.window.CanvasSelectionInteraction.createDocumentReset({
    canvasSelection: selection, canvasHover: hover,
    selectionHighlight: { reset() { events.push('highlight'); } },
    clearPointer: () => { pointer = null; events.push('pointer'); }, clearSnap: () => { snap = null; events.push('snap'); },
  });
  assert.equal(pointer, retained); assert.equal(selection.annotations[0], retained);
  assert.equal(api.reset(), undefined); assert.equal(pointer, null); assert.equal(snap, null);
  assert.deepEqual(events, ['highlight', 'pointer', 'snap']);
  for (const field of ['points', 'lines', 'circles', 'arcs']) assert.equal(selection[field][0], retained);
  for (const field of ['splines', 'annotations', 'hatches', 'referenceImages', 'blockInstances', 'geometryInstances', 'dimensionConstraints']) assert.equal(selection[field].length, 0);
  for (const field of ['arcEndpoint', 'arcEndpointPair', 'constraint', 'instanceGeometry']) assert.equal(selection[field], null);
  assert.equal(selection.sketchId, 'S2');
  for (const [key, value] of Object.entries(hover.current)) assert.equal(value, ['annotation', 'annotationHandle'].includes(key) ? retained : null, key);
  assert.equal(api.reset(), undefined);
});

test('document Canvas reset retains phases around pointer, snap and related selection clearing', () => {
  const events = [], selection = { set(key, value) { assert.equal(this, selection); events.push(['set', key]); } };
  const hover = { update(patch) { assert.equal(this, hover); events.push(['hover', ...Object.keys(patch)]); } };
  const highlight = { reset() { assert.equal(this, highlight); events.push(['highlight']); } };
  const api = sandbox.window.CanvasSelectionInteraction.createDocumentReset({ canvasSelection: selection, canvasHover: hover, selectionHighlight: highlight,
    clearPointer: () => events.push(['pointer']), clearSnap: () => events.push(['snap']),
  });
  assert.deepEqual(events, []); api.reset();
  assert.deepEqual(events, [
    ['hover', 'point', 'endpointPoint', 'line', 'circle', 'arc', 'spline', 'arcEndpoint', 'dimension'],
    ['highlight'], ['hover', 'sketchIdentity'], ['pointer'], ['snap'],
    ...['arcEndpoint', 'arcEndpointPair', 'dimensionConstraint', 'constraint', 'annotations', 'hatches', 'referenceImages', 'splines', 'blockInstances', 'geometryInstances'].map(key => ['set', key]),
    ['hover', 'block'], ['set', 'instanceGeometry'], ['hover', 'geometryInstance', 'hatch', 'referenceImage'],
  ]);
});

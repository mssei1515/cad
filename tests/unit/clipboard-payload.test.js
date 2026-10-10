const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync('index.html', 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(file => file.startsWith('src/'))) vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
const { Point, Line, GeometryFixedConstraint, SketchProjectionConstraint } = sandbox.window.GeometrySolver;
const arrays = ['points','lines','circles','arcs','splines','blockInstances','geometryInstances','annotations','hatches','referenceImages'];
function fixture() {
  const model = Object.fromEntries([...arrays, 'constraints'].map(key => [key, []]));
  const selection = Object.fromEntries(arrays.map(key => [key, []]));
  const state = { target: null, serialized: [] }, bundle = { points: [], lines: [], circles: [], arcs: [], splines: [] };
  const builder = sandbox.window.ClipboardPayload.create({ geometryInstanceBundle: () => bundle, serializeGeometryInstance: sandbox.window.DocumentSnapshot.serializeGeometryInstance, blockProjectionBundle: () => bundle, blockProjectionLocalId: item => item.localId,
    resolveGeometryRef: () => state.target, constraintGraphNodes: c => c.nodes,
    serializeConstraint: c => { state.serialized.push(c); return { tag: c.tag }; }, applicationText: (_ja, en) => en });
  return { model, selection, state, bundle, build: scope => builder.build(model, selection, scope) };
}

test('payload retains model point order and collects dependent endpoints while copying only contained constraints', () => {
  const f = fixture(), a = new Point('P1', 1, 2), b = new Point('P2', 3, 4), foreign = new Point('P3', 8, 9);
  a.fixed = true; a.kind = 'endpoint'; a.appearance = { color: '#123456' };
  const line = new Line('L1', a, b); f.model.points = [b, a]; f.model.lines = [line];
  f.selection.points = [a, foreign]; f.selection.lines = [line];
  const included = { tag: 'inside', nodes: [a, line] };
  f.model.constraints = [included, { tag: 'outside', nodes: [foreign, line] }, { tag: 'empty', nodes: [] },
    Object.assign(Object.create(GeometryFixedConstraint.prototype), { nodes: [line] }), Object.assign(Object.create(SketchProjectionConstraint.prototype), { nodes: [line] })];
  const { payload, error } = f.build('block:B1'); assert.equal(error, null);
  assert.deepEqual(Array.from(payload.points, p => p.id), ['P2', 'P1']); assert.equal(payload.points[1].fixed, false);
  assert.equal(payload.parameterNamespaceKey, 'block:B1'); assert.equal(payload.lines[0].p1, 'P1');
  assert.deepEqual(Array.from(payload.selection.points), ['P1']); assert.deepEqual(f.state.serialized, [included]);
  payload.points[1].appearance.color = '#ffffff'; assert.equal(a.appearance.color, '#123456'); assert.equal(a.fixed, true);
  assert.equal(f.model.lines[0], line); assert.equal(f.selection.points.length, 2);
});

test('empty selection returns no payload and a leader requires its referenced geometry', () => {
  const f = fixture(); assert.equal(f.build().payload, null); assert.equal(f.build().error, null);
  const leader = { id: 'AN1', type: 'leader', geometryRef: {} };
  f.model.annotations = [leader]; f.selection.annotations = [leader];
  const result = f.build(); assert.equal(result.payload, null); assert.equal(result.error, 'Also select the target referenced by annotation AN1');
  assert.equal(f.model.annotations[0], leader);
});

test('block projection IDs allow reference reconnection even when graph nodes use another projection object', () => {
  const f = fixture(), instance = { id: 'BI1', definitionId: 'B1', enabledSketchIds: ['S1'] };
  f.model.blockInstances = [instance]; f.selection.blockInstances = [instance];
  const projected = { id: 'BI1:P1', localId: 'P1', blockProjection: true }; f.bundle.points = [projected];
  const constraint = { tag: 'projected', nodes: [{ ...projected }] }; f.model.constraints = [constraint];
  const payload = f.build().payload;
  assert.equal(payload.blockInstances[0].projection.points[0].localId, 'P1'); assert.equal(payload.constraints[0].tag, 'projected');
  payload.blockInstances[0].enabledSketchIds.push('S2'); assert.deepEqual(instance.enabledSketchIds, ['S1']);
  assert.equal(payload.pasteCount, 0); assert.equal(payload.cut, false); assert.equal(payload.parameterNamespaceKey, 'document');
});

test('derived instance payload preserves detached settings and includes projected constraints and leader targets', () => {
  const f=fixture(), a=new Point('P1',0,0), b=new Point('P2',10,0), line=new Line('L1',a,b);
  const instance={id:'MI1',type:'mirror',sketchId:'S1',sources:[{kind:'line',path:['L1']}],axis:{kind:'line',path:['L2']},appearanceOverride:{color:'#123456'}};
  const output=new Line('MI1@L1',a,b);Object.assign(output,{derivedProjection:true,derivedInstance:instance,sourceElement:line,occurrenceIndex:0});
  f.model.geometryInstances=[instance];f.selection.geometryInstances=[instance];f.bundle.lines=[output];
  f.model.constraints=[{tag:'dimension',nodes:[{...output}]}];
  f.state.target=output;f.model.annotations=[{id:'AN1',type:'leader',geometryRef:{kind:'line',path:['MI1','L1']}}];f.selection.annotations=f.model.annotations;
  const result=f.build();assert.equal(result.error,null);const payload=result.payload;
  assert.equal(payload.geometryInstances[0].projection.lines[0].id,output.id);assert.equal(payload.constraints[0].tag,'dimension');
  assert.deepEqual(Array.from(payload.selection.geometryInstances),['MI1']);
  payload.geometryInstances[0].sources[0].path[0]='different';assert.equal(instance.sources[0].path[0],'L1');
});

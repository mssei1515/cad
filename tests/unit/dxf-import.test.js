const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
for (const file of ['src/geometry/geometry_kernel.js', 'src/geometry/spline_geometry.js', 'src/solver/constraint_solver.js', 'src/editing/geometry_ids.js', 'src/editing/geometry_creation.js', 'src/persistence/document_files.js', 'src/persistence/dxf_import.js', 'src/commands/dxf_import_command.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), sandbox, { filename: file });
}
const { DxfImport: parser, DxfImportCommand, GeometryCreation, GeometryIds, DocumentFiles } = sandbox.window;
const plain = value => JSON.parse(JSON.stringify(value));
const dxf = (entities, units = 4) => [0, 'SECTION', 2, 'HEADER', 9, '$INSUNITS', 70, units, 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES', ...entities, 0, 'ENDSEC', 0, 'EOF', ''].join('\n');
const line = [0, 'LINE', 8, 'layer1', 10, 1, 20, 2, 11, 11, 21, 12];
const prepare = (entities, units = 4) => { const parsed = parser.parse(dxf(entities, units)); return parser.prepare(parsed, parsed.scale || 1, 1e-6); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test('DXF units, coordinates and layers convert to exact millimetre primitives', () => {
  const result = prepare([...line, 0, 'CIRCLE', 10, 4, 20, 3, 40, 2, 0, 'POINT', 10, 5, 20, 6], 1);
  near(result.geometries[0].a.x, 25.4); near(result.geometries[0].a.y, -50.8);
  near(result.geometries[1].radius, 50.8); near(result.geometries[2].y, -152.4);
  assert.deepEqual(plain(result.skipped), {});
  assert.equal(parser.parse(dxf([], 0)).scale, null);
  assert.equal(parser.parse(dxf([], 6)).scale, 1000);
  assert.equal(parser.parse(dxf([], 21)).scale, 1200000 / 3937);
});
test('DXF arcs retain counterclockwise major sweeps, wrapping and negative OCS normal', () => {
  const arc = (start, end, normal = 1) => prepare([0, 'ARC', 10, 3, 20, 4, 40, 10, 50, start, 51, end, 230, normal]).geometries[0];
  near(arc(0, 270).end - arc(0, 270).start, -Math.PI * 1.5);
  near(arc(350, 10).end - arc(350, 10).start, -Math.PI / 9);
  const mirrored = arc(0, 90, -1);
  near(mirrored.center.x, -3); near(mirrored.start, -Math.PI); near(mirrored.end - mirrored.start, Math.PI / 2);
});
test('open and closed lightweight polylines convert bulges without tessellation', () => {
  for (const bulge of [1, -1, 2, -2]) {
    const { geometries } = prepare([0, 'LWPOLYLINE', 90, 2, 70, 1, 10, 0, 20, 0, 42, bulge, 10, 10, 20, 0]);
    assert.equal(geometries.length, 2);
    const arc = geometries[0];
    near(arc.center.x + arc.radius * Math.cos(arc.start), 0);
    near(arc.center.y + arc.radius * Math.sin(arc.start), 0);
    near(arc.center.x + arc.radius * Math.cos(arc.end), 10);
    near(arc.center.y + arc.radius * Math.sin(arc.end), 0);
    near(arc.end - arc.start, -4 * Math.atan(bulge));
    assert.equal(geometries[1].type, 'line');
  }
});
test('legacy POLYLINE consumes vertices and sequence; ignores blocks and paper space', () => {
  const legacy = [0, 'POLYLINE', 70, 0, 0, 'VERTEX', 10, 0, 20, 0, 0, 'VERTEX', 10, 10, 20, 0, 0, 'SEQEND'];
  assert.equal(prepare(legacy).geometries.length, 1);
  assert.throws(() => prepare(legacy.slice(0, -2)), /SEQEND/);
  const text = [0, 'SECTION', 2, 'BLOCKS', ...line, 0, 'ENDSEC', ...dxf([...line, 67, 1]).trim().split('\n')].join('\n');
  const result = parser.prepare(parser.parse(text), 1, 1e-6);
  assert.equal(result.geometries.length, 0); assert.equal(result.skipped.LINE, 1);
});
test('unsupported, nonplanar, invalid and undersized entities are skipped, not distorted', () => {
  const result = prepare([...line, 0, 'SPLINE', 0, 'ELLIPSE', 0, 'INSERT', ...line, 30, 5,
    0, 'CIRCLE', 10, 0, 20, 0, 40, -1,
    0, 'LINE', 10, 0, 20, 0, 11, 0.0000001, 21, 0,
    0, 'LWPOLYLINE', 90, 2, 10, 0, 20, 0, 10, 'NaN', 20, 1]);
  assert.equal(result.geometries.length, 1);
  assert.deepEqual(plain(result.skipped), { SPLINE: 1, ELLIPSE: 1, INSERT: 1, LINE: 2, CIRCLE: 1, LWPOLYLINE: 1 });
});
test('malformed files, missing EOF and binary DXF cannot partially import', () => {
  for (const text of ['garbage', '0\nSECTION\n2\nENTITIES\n', dxf(line).replace('ENDSEC\n0\nEOF', 'EOF'), 'AutoCAD Binary DXF\u0000', dxf(line) + '0\nLINE\n']) assert.throws(() => parser.parse(text));
  assert.equal(parser.parse('\uFEFF' + dxf(line).replaceAll('\n', '\r\n')).entities.length, 1);
});
function fixture() {
  const scope = { points: [], lines: [], circles: [], arcs: [], constraints: [] };
  const state = { scope, sketch: 'S1', content: 'same', allowed: true, imported: 0, hints: [], questions: [] };
  const ids = GeometryIds.create(), fileSession = DocumentFiles.create();
  const geometry = GeometryCreation.create({ currentScope: () => state.scope, ids, assignSketchId: item => { item.sketchId = state.sketch; }, currentConstruction: () => true, minLineLength: 1e-6, minArcLength: 1e-6 });
  const options = { parser, geometry, ids, currentScope: () => state.scope, activeSketchId: () => state.sketch,
    canImport: () => state.allowed, signature: () => state.content, fileSession, minimumLength: 1e-6,
    requestChoice: async options => { state.questions.push(options); return options.defaultValue; },
    applicationText: (_ja, en) => en, onImported: () => state.imported++, setHint: hint => state.hints.push(hint) };
  return { state, ids, fileSession, options, command: DxfImportCommand.create(options) };
}
const file = (text = dxf(line)) => ({ name: 'drawing.dxf', size: text.length, text: async () => text });
test('import uses active sketch, normal geometry, fresh IDs, and one history callback', async () => {
  const f = fixture();
  assert.equal(await f.command.importFile(file()), true);
  assert.equal(await f.command.importFile(file()), true);
  assert.equal(f.state.scope.lines.length, 2); assert.equal(f.state.imported, 2);
  assert.equal(f.state.scope.lines[0].construction, false);
  assert.equal(f.state.scope.lines[0].sketchId, 'S1');
  assert.notEqual(f.state.scope.lines[0].id, f.state.scope.lines[1].id);
  assert.equal(f.fileSession.busy, false);
});
test('unknown units and skipped entities prompt before mutation; cancel leaves no history', async () => {
  const f = fixture();
  assert.equal(await f.command.importFile(file(dxf([...line, 0, 'SPLINE'], 0))), true);
  assert.equal(f.state.questions.length, 2);
  const canceled = fixture(); canceled.options.requestChoice = async () => null;
  assert.equal(await DxfImportCommand.create(canceled.options).importFile(file(dxf(line, 0))), false);
  assert.equal(canceled.state.scope.points.length, 0); assert.equal(canceled.state.imported, 0);
});
test('file read races cannot append to changed document, sketch, scope, or locked sketch', async () => {
  for (const change of [f => { f.state.content = 'changed'; }, f => { f.state.sketch = 'S2'; }, f => { f.state.scope = { ...f.state.scope }; }, f => { f.state.allowed = false; }]) {
    const f = fixture();
    const input = file(); input.text = async () => { change(f); return dxf(line); };
    assert.equal(await f.command.importFile(input), false);
    assert.equal(f.state.scope.points.length, 0); assert.equal(f.state.imported, 0);
  }
});
test('failed geometry insertion rolls back arrays and ID sequences', async () => {
  const f = fixture();
  f.options.geometry = { ...f.options.geometry, addLine() { throw new Error('insertion failed'); } };
  assert.equal(await DxfImportCommand.create(f.options).importFile(file()), false);
  assert.equal(f.state.scope.points.length, 0); assert.equal(f.ids.peek('point'), 1);
  assert.equal(f.state.imported, 0); assert.equal(f.fileSession.busy, false);
});

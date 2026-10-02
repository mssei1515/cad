const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('src/editing/canvas_hover.js', 'utf8'), sandbox);
const create = () => sandbox.window.CanvasHover.create({ isEndpointPoint: p => p.endpoint === true });
test('partial updates preserve unrelated hover references and expose an immutable read view', () => {
  const hover = create(), point = { id: 'P' }, line = { id: 'L' };
  hover.update({ point, line }); const before = hover.current;
  hover.update({ line: null }); assert.equal(hover.current.point, point); assert.equal(hover.current.line, null);
  assert.equal(before.line, line); assert.equal(Object.isFrozen(hover.current), true);
  assert.equal(Reflect.set(hover.current, 'point', null), false);
  point.x = 12; assert.equal(hover.current.point.x, 12);
});
test('clear removes all canvas hover types including reference images', () => {
  const hover = create(), marker = {};
  hover.update(Object.fromEntries(Object.keys(hover.current).map(key => [key, marker])));
  hover.clear(); assert.ok(Object.values(hover.current).every(value => value === null));
});
test('context snapshot restores its original fields including reference images', () => {
  const hover = create(), point = {}, firstImage = {}, secondImage = {};
  hover.update({ point, referenceImage: firstImage }); const snapshot = hover.capture();
  assert.equal(snapshot.referenceImage, firstImage);
  hover.update({ point: null, referenceImage: secondImage }); hover.restore(snapshot);
  assert.equal(hover.current.point, point); assert.equal(hover.current.referenceImage, firstImage);
  snapshot.point = null; assert.equal(hover.current.point, point);
  const before = hover.current; hover.restore(null); assert.equal(hover.current, before);
});
test('candidate preview replaces prior highlights and distinguishes endpoint points from ordinary points', () => {
  const hover = create(), line = {}, point = { endpoint: true };
  hover.update({ referenceImage: {}, hatch: {}, line }); hover.previewCandidate({ kind: 'point', item: point });
  assert.equal(hover.current.point, point); assert.equal(hover.current.endpointPoint, point);
  assert.equal(hover.current.line, null); assert.equal(hover.current.referenceImage, null); assert.equal(hover.current.hatch, null);
  point.endpoint = false; hover.previewCandidate({ kind: 'point', item: point }); assert.equal(hover.current.endpointPoint, null);
});
test('candidate preview maps each selectable type and creates an arc endpoint descriptor', () => {
  const hover = create(), item = {};
  for (const [kind, field] of Object.entries({ line: 'line', circle: 'circle', arc: 'arc', spline: 'spline', dimension: 'dimension', block: 'block', 'geometry-instance': 'geometryInstance', annotation: 'annotation', hatch: 'hatch', image: 'referenceImage' })) {
    hover.previewCandidate({ kind, item }); assert.equal(hover.current[field], item);
    assert.equal(Object.values(hover.current).filter(value => value !== null).length, 1);
  }
  hover.previewCandidate({ kind: 'arc-endpoint', item, endpoint: 'end' });
  assert.equal(hover.current.arcEndpoint.arc, item); assert.equal(hover.current.arcEndpoint.endpoint, 'end');
});

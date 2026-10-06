const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.resolve(__dirname, '../..');
const sandbox = { window: {} }; vm.createContext(sandbox);
const sources = vm.runInNewContext(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/const sources = (\[[\s\S]*?\]);/)[1]);
for (const file of sources.filter(p => p.startsWith('src/'))) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox);

function fixture() {
  let scale = 2, elements = [], active = 'S1', anchor = null, showHidden = false;
  const query = sandbox.window.AnnotationSpatialQuery.create({
    isVisibleValue: visible => showHidden || visible !== false,
    viewportScale: () => scale, annotationTextWorldHeight: () => 10 / scale,
    formatDisplayNumber: value => value.toFixed(1), allAnnotations: () => elements,
    isVisibleSketchId: id => id !== 'hidden', activeSketchId: () => active,
    annotationLeaderAnchor: element => anchor || element.start,
  });
  return { query, showHidden: value => { showHidden = value; }, zoom: value => { scale = value; }, list: value => { elements = value; },
    activate: value => { active = value; }, anchor: value => { anchor = value; } };
}
const text = overrides => ({ type: 'text', x: 0, y: 0, text: 'X', sketchId: 'S1', style: {}, ...overrides });

test('rotated text hit uses local coordinates and current viewport scale', () => {
  const f = fixture(), label = text({ rotation: Math.PI / 2 });
  assert.equal(f.query.pointInAnnotationTextBox(0, 20, label), true);
  assert.equal(f.query.pointInAnnotationTextBox(20, 0, label), false);
  f.zoom(1);
  assert.equal(f.query.pointInAnnotationTextBox(9, 10, label), true);
  f.zoom(10);
  assert.equal(f.query.pointInAnnotationTextBox(9, 10, label), false);
});

test('bounds include rotated text and resolved leader anchors', () => {
  const f = fixture(), label = text(), flat = f.query.annotationBounds(label);
  const rotated = f.query.annotationBounds({ ...label, rotation: Math.PI / 2 });
  assert.ok(Math.abs((flat.x2-flat.x1)-(rotated.y2-rotated.y1)) < 1e-8);
  f.anchor({ x: -500, y: -500 });
  const bounds = f.query.annotationBounds({ ...label, type: 'leader', start: { x: -100, y: -80 }, end: { x: 200, y: 100 } });
  assert.equal(bounds.x1, -500); assert.equal(bounds.x2, 200);
  assert.equal(bounds.y1, -500); assert.equal(bounds.y2, 100);
  assert.equal(f.query.annotationBounds(null), null);
});

test('selection queries preserve reverse order and visibility; inactive projections require read-only queries', () => {
  const f = fixture(), first = text(), second = text(); f.list([first, second]);
  assert.equal(f.query.hitAnnotationElement(2, 0).element, second);
  second.visible = false; assert.equal(f.query.hitAnnotationElement(2, 0).element, first);
  first.sketchId = 'S2'; assert.equal(f.query.hitAnnotationElement(2, 0), null);
  first.blockProjection = true; assert.equal(f.query.hitAnnotationElement(2, 0), null);
  assert.equal(f.query.hitAnnotationElement(2, 0, { activeOnly: false }).element, first);
  first.sketchId = 'hidden'; assert.equal(f.query.hitAnnotationElement(2, 0), null);
});

test('context queries retain distance and accept caller-filtered inactive sketch items', () => {
  const f = fixture(), leader = text({ type: 'leader', sketchId: 'S2', x: 100, y: 100,
    start: { x: 0, y: 0 }, elbow: { x: 50, y: 0 }, end: { x: 50, y: 50 } });
  const hit = f.query.canvasContextAnnotationHit(leader, { x: 20, y: 3 });
  assert.equal(hit.part, 'line'); assert.equal(hit.distance, 3);
  f.list([leader]); assert.equal(f.query.hitAnnotationElement(20, 3), null);
  f.activate('S2'); assert.equal(f.query.hitAnnotationElement(20, 3).part, 'line');
  assert.equal(f.query.canvasContextAnnotationHit({ ...leader, visible: false }, { x: 20, y: 3 }), null);
  assert.equal(f.query.canvasContextAnnotationHit({ ...leader, end: null }, { x: 20, y: 3 }), null);
});

test('projected parameter labels measure current formatted value and affixes', () => {
  const f = fixture(), label = text({ parameterEnabled: true, text: '', evaluatedParameterValue: 1, style: { prefix: 'Value: ', suffix: ' mm' } });
  const original = f.query.annotationBounds(label);
  label.evaluatedParameterValue = 123456789;
  assert.ok(f.query.annotationBounds(label).x2 > original.x2);
  const projected = { ...label, localElement: { parameterEnabled: true, evaluatedParameterValue: 1 } };
  assert.equal(f.query.annotationBounds(projected).x2, original.x2);
});

test('show hidden restores annotation hit and context queries without changing its flag', () => {
  const f = fixture(), label = text({ visible: false }); f.list([label]);
  assert.equal(f.query.hitAnnotationElement(2, 0), null);
  assert.equal(f.query.canvasContextAnnotationHit(label, { x: 2, y: 0 }), null);
  f.showHidden(true); assert.equal(f.query.hitAnnotationElement(2, 0).element, label);
  assert.ok(f.query.canvasContextAnnotationHit(label, { x: 2, y: 0 }));
  assert.equal(label.visible, false);
  f.showHidden(false); assert.equal(f.query.hitAnnotationElement(2, 0), null);
});

test('leader endpoint takes priority over shelf body with a screen-sized hit radius', () => {
  const f = fixture(), leader = text({ type: 'leader', start: { x: 0, y: 0 }, elbow: { x: 20, y: 20 }, end: { x: 60, y: 20 } });
  f.list([leader]);
  assert.equal(f.query.hitAnnotationElement(63, 20).part, 'end');
  assert.equal(f.query.canvasContextAnnotationHit(leader, { x: 63, y: 20 }).part, 'end');
  f.zoom(4);
  assert.equal(f.query.hitAnnotationElement(63, 20).part, 'line');
  assert.equal(f.query.hitAnnotationElement(60, 20).part, 'end');
});


test('leader pointer queries reject empty bounding-box space and wide label halos at every zoom', () => {
  for (const scale of [0.5, 2, 8]) {
    const f = fixture(); f.zoom(scale);
    const leader = text({ type: 'leader', x: 200, y: 100,
      start: { x: 0, y: 0 }, elbow: { x: 100, y: 100 }, end: { x: 200, y: 100 } });
    f.list([leader]);
    for (const point of [{ x: 150, y: 20 }, { x: 150, y: 100 + 13 / scale }, { x: 200 - 30 / scale, y: 100 + 18 / scale }]) {
      assert.equal(f.query.hitAnnotationElement(point.x, point.y), null);
      assert.equal(f.query.canvasContextAnnotationHit(leader, point), null);
    }
    for (const point of [{ x: 50, y: 50 }, { x: 150, y: 100 + 11 / scale }, { x: 205, y: 100 }]) {
      assert.ok(f.query.hitAnnotationElement(point.x, point.y));
      assert.ok(f.query.canvasContextAnnotationHit(leader, point));
    }
    const bounds = f.query.annotationBounds(leader);
    assert.equal(bounds.x1, 0); assert.equal(bounds.y1, 0);
  }
});

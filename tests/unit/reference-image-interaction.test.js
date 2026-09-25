const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync('src/commands/reference_image_interaction.js', 'utf8'), sandbox);
function fixture() {
  const item = { x: 10, y: 20, scale: 2, rotation: 0 }, events = [], state = { answer: '20', hit: item };
  const toWorld = (image, point) => ({ x: image.x + image.scale * (point.x * Math.cos(image.rotation) - point.y * Math.sin(image.rotation)), y: image.y + image.scale * (point.x * Math.sin(image.rotation) + point.y * Math.cos(image.rotation)) });
  const toLocal = (image, point) => ({ x: ((point.x-image.x)*Math.cos(image.rotation)+(point.y-image.y)*Math.sin(image.rotation))/image.scale, y: (-(point.x-image.x)*Math.sin(image.rotation)+(point.y-image.y)*Math.cos(image.rotation))/image.scale });
  const command = sandbox.window.ReferenceImageInteraction.create({ clearSelection: () => events.push('clear'), canvasSelection: { set: (_kind, items) => events.push(['select', items[0]]) },
    applicationText: (_ja, en) => en, setHint: (text, kind) => events.push(['hint', text, kind]), updateUI: () => events.push('ui'), draw: () => events.push('draw'),
    beginPointer: id => events.push(['begin', id]), endPointer: id => events.push(['end', id]), viewScale: () => 2, hypot2: Math.hypot,
    clearSnap: () => events.push('snap'), hitReferenceImageAt: () => state.hit,
    referenceImageWorldToLocal: toLocal, referenceImageLocalToWorld: toWorld, promptDistance: () => state.answer,
    formatDisplayNumber: String, recordHistory: label => events.push(['history', label]) });
  return { command, item, events, state, toWorld, toLocal };
}
test('image drag crosses the screen threshold and records only at completion', () => {
  const f = fixture(); f.command.beginDrag({ pointerId: 7 }, f.item, { x: 0, y: 0 });
  assert.equal(f.command.dragging, true); f.command.updateDrag({ x: 1.5, y: 0 }); assert.equal(f.item.x, 10);
  f.command.updateDrag({ x: 2, y: 3 }); assert.deepEqual([f.item.x, f.item.y], [12, 23]);
  assert.equal(f.events.some(e => e[0] === 'history'), false);
  assert.equal(f.command.finishDrag({ pointerId: 7 }), true); assert.equal(f.command.dragging, false);
  assert.deepEqual(f.events.at(-1), ['history', '画像移動']); assert.equal(f.command.finishDrag({ pointerId: 7 }), false);
});
test('locked image selection and unmoved clicks add no history', () => {
  const f = fixture(); f.item.locked = true; f.command.beginDrag({ pointerId: 1 }, f.item, { x: 0, y: 0 });
  assert.equal(f.command.dragging, false); assert.equal(f.events.some(e => e[0] === 'begin'), false);
  f.item.locked = false; f.command.beginDrag({ pointerId: 1 }, f.item, { x: 0, y: 0 }); f.command.finishDrag({ pointerId: 1 });
  assert.equal(f.events.some(e => e[0] === 'history'), false);
});
test('two-point scale calibration anchors the first point on a rotated image', () => {
  const f = fixture(); f.item.rotation = Math.PI / 3;
  const first = f.toWorld(f.item, { x: 2, y: 3 }), second = f.toWorld(f.item, { x: 7, y: 3 });
  assert.equal(f.command.startCalibration(f.item), true); f.command.calibrationClick(first);
  assert.equal(f.command.calibrationPointCount, 1); f.command.calibrationClick(second);
  assert.equal(f.command.calibrating, false); assert.ok(Math.abs(f.item.scale - 4) < 1e-10);
  const anchored = f.toWorld(f.item, { x: 2, y: 3 }); assert.ok(Math.hypot(anchored.x-first.x, anchored.y-first.y) < 1e-10);
  assert.equal(f.events.filter(e => e[0] === 'history').length, 1);
});
test('invalid scale retries points and cancelled or wrong-image input leaves geometry unchanged', () => {
  const f = fixture(), before = JSON.stringify(f.item); f.command.startCalibration(f.item); f.state.hit = {};
  f.command.calibrationClick({ x: 10, y: 20 }); assert.equal(f.command.calibrationPointCount, 0);
  f.state.hit = f.item; f.state.answer = '0'; f.command.calibrationClick({ x: 10, y: 20 }); f.command.calibrationClick({ x: 20, y: 20 });
  assert.equal(f.command.calibrating, true); assert.equal(f.command.calibrationPointCount, 0);
  f.state.answer = null; f.command.calibrationClick({ x: 10, y: 20 }); f.command.calibrationClick({ x: 20, y: 20 });
  assert.equal(f.command.calibrating, false); assert.equal(JSON.stringify(f.item), before); assert.equal(f.events.some(e => e[0] === 'history'), false);
});
test('image deletion and scope resets discard sessions without committing', () => {
  const f = fixture(); f.command.startCalibration(f.item); f.command.forget([{}]); assert.equal(f.command.calibrating, true);
  f.command.forget([f.item]); assert.equal(f.command.calibrating, false);
  f.command.startCalibration(f.item); f.command.beginDrag({ pointerId: 1 }, f.item, { x: 0, y: 0 }); f.command.reset();
  assert.equal(f.command.dragging, false); assert.equal(f.command.calibrationPoints, null); assert.equal(f.events.some(e => e[0] === 'history'), false);
  f.item.locked = true; assert.equal(f.command.startCalibration(f.item), false);
});

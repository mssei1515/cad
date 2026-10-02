const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} }; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/rendering/authoring_preview_renderer.js'), 'utf8'), sandbox);
function fixture() {
  const calls = [], ctx = {}, queries = [];
  for (const name of ['save','restore','beginPath','moveTo','lineTo','arc','stroke','fill','strokeRect','setLineDash']) ctx[name] = (...args) => calls.push([name,...args]);
  const f = { calls, ctx, queries, slot: null, three: null };
  f.renderer = sandbox.window.AuthoringPreviewRenderer.create({ ctx, viewport: { scale: 2 },
    withCanvasState: fn => { calls.push(['enter']); try { fn(); } finally { calls.push(['exit']); } },
    hypot2: Math.hypot, shortestAngleFrom: (start, end) => end,
    slotGeometry: (...args) => { queries.push(args); return f.slot; },
    threePointArcGeometry: (...args) => { queries.push(args); return f.three; }, minimumLineLength: 12, minimumArcLength: 12 });
  return f;
}
test('line fallback and signed rectangle preview preserve scale and incomplete-input guards', () => {
  const f = fixture(), start = { x: 10, y: 20 };
  f.renderer.drawLine(null, start); f.renderer.drawRectangle(start, null); assert.equal(f.calls.length, 0);
  f.renderer.drawLine(start, null);
  assert.deepEqual(f.calls.find(c => c[0] === 'lineTo'), ['lineTo',10,20]);
  assert.deepEqual(f.calls.find(c => c[0] === 'arc').slice(1,4), [10,20,6]);
  assert.equal(f.ctx.lineWidth, 1);
  f.renderer.drawRectangle(start, { x: 2, y: 5 });
  assert.deepEqual(f.calls.find(c => c[0] === 'strokeRect'), ['strokeRect',10,20,-8,-15]);
});
test('circle and arc previews preserve radius, direction and center-only stage', () => {
  const f = fixture(), center = { x: 0, y: 0 };
  f.renderer.drawCircle(center, { x: 3, y: 4 });
  assert.deepEqual(f.calls.find(c => c[0] === 'arc'), ['arc',0,0,5,0,Math.PI*2]);
  f.calls.length = 0; f.renderer.drawArc(center, null, null);
  assert.deepEqual(f.calls.find(c => c[0] === 'arc').slice(1,4), [0,0,2.5]);
  f.calls.length = 0; f.renderer.drawArc(center, { startAngle: 1, radius: 7 }, { x: 0, y: -3 });
  assert.deepEqual(f.calls.find(c => c[0] === 'arc'), ['arc',0,0,7,1,-Math.PI/2,true]);
});
test('slot stages retain construction centers and reject a short provisional axis', () => {
  const f = fixture(), a = { x: 0, y: 0 }, b = { x: 20, y: 0 }, p = { x: 0, y: 4 };
  f.renderer.drawSlot(a, null, p);
  assert.equal(f.calls.some(c => c[0] === 'lineTo'), false);
  f.renderer.drawSlot(a, null, b); assert.ok(f.calls.some(c => c[0] === 'lineTo'));
  f.calls.length = 0; f.renderer.drawSlot(a, b, p);
  assert.equal(f.calls.filter(c => c[0] === 'arc').length, 2);
  assert.deepEqual(f.queries[0], [a,b,p,12]);
  f.slot = { firstCenter: a, secondCenter: b, radius: 4, sideStart: p, sideEnd: {x:20,y:4}, oppositeStart:{x:0,y:-4}, startArc:{startAngle:-1,endAngle:1}, endArc:{startAngle:1,endAngle:-1} };
  f.calls.length=0; f.renderer.drawSlot(a,b,p);
  assert.equal(f.calls.filter(c=>c[0]==='arc').length,4);
  assert.equal(f.calls.filter(c=>c[0]==='arc')[2].at(-1),true);
});
test('three-point arc keeps end markers when invalid and adds the computed center when valid', () => {
  const f=fixture(),a={x:0,y:0},b={x:20,y:0},p={x:10,y:5};
  f.renderer.drawThreePointArc(a,b,p);
  assert.equal(f.calls.filter(c=>c[0]==='arc').length,2);
  assert.deepEqual(f.queries[0],[a,b,p,12]);
  f.three={center:p,radius:10,startAngle:2,endAngle:1};f.calls.length=0;
  f.renderer.drawThreePointArc(a,b,p);
  const circles=f.calls.filter(c=>c[0]==='arc');assert.equal(circles.length,4);
  assert.equal(circles[2].at(-1),true);assert.deepEqual(circles[3].slice(1,4),[10,5,2.5]);
  f.calls.length=0;f.renderer.drawFilletArc(f.three);
  assert.deepEqual(f.calls.find(c=>c[0]==='arc'),circles[2]);
});

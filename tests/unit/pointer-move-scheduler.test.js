const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../src/ui/pointer_move_scheduler.js'), 'utf8'), sandbox);

function fixture(process) {
  const frames = new Map();
  const moves = [];
  let next = 0;
  const scheduler = sandbox.window.PointerMoveScheduler.create({
    requestFrame: callback => { frames.set(next, callback); return next++; },
    cancelFrame: id => frames.delete(id),
    processMove: pointer => { moves.push({ ...pointer }); process?.(pointer); },
  });
  return { scheduler, frames, moves, tick() {
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback();
  } };
}

test('coalesces to the latest copied input in one frame, including frame id zero', () => {
  const f = fixture();
  assert.equal(f.scheduler.stats(), null);
  f.scheduler.resetStats();
  const event = { offsetX: 1, offsetY: 2, shiftKey: false };
  f.scheduler.schedule(event);
  event.offsetX = 99;
  f.scheduler.schedule({ offsetX: 3, offsetY: 4, shiftKey: true });
  assert.equal(f.frames.size, 1);
  f.tick();
  assert.deepEqual(f.moves, [{ offsetX: 3, offsetY: 4, shiftKey: true }]);
  assert.deepEqual({ ...f.scheduler.stats() }, { receivedMoves: 2, processedMoves: 1, coalescedMoves: 1, animationFrames: 1, synchronousFlushes: 0, canvasDraws: 0, pendingMove: false, frameScheduled: false });
});

test('flush cancels the frame and processes once, while discard processes nothing', () => {
  const f = fixture();
  f.scheduler.resetStats();
  f.scheduler.schedule({ offsetX: 1 });
  assert.equal(f.scheduler.flush(), true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.scheduler.flush(), false);
  f.scheduler.schedule({ offsetX: 2 });
  assert.equal(f.scheduler.flush({ discard: true }), false);
  assert.equal(f.frames.size, 0);
  assert.equal(f.moves.length, 1);
  assert.equal(f.scheduler.stats().synchronousFlushes, 1);
});

test('reset flushes preceding input before starting fresh diagnostic counts', () => {
  const f = fixture();
  f.scheduler.schedule({ offsetX: 7 });
  const result = f.scheduler.resetStats();
  assert.equal(f.moves.length, 1);
  assert.equal(result.receivedMoves, 0);
  result.receivedMoves = 99;
  f.scheduler.recordDraw();
  assert.equal(f.scheduler.stats().receivedMoves, 0);
  assert.equal(f.scheduler.stats().canvasDraws, 1);
});

test('processing can queue a subsequent frame without losing its pending input', () => {
  let f;
  f = fixture(pointer => { if (pointer.offsetX === 1) f.scheduler.schedule({ offsetX: 2 }); });
  f.scheduler.schedule({ offsetX: 1 });
  f.tick();
  assert.equal(f.frames.size, 1);
  f.tick();
  assert.deepEqual(f.moves.map(p => p.offsetX), [1, 2]);
  assert.equal(f.frames.size, 0);
});

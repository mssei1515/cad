/* Own queued pointer input, frame scheduling and opt-in frame diagnostics. */
(() => {
  "use strict";
  function create({ processMove, requestFrame, cancelFrame }) {
    let pendingCanvasPointerMove = null;
    let canvasPointerMoveFrame = null;
    let interactionFrameStats = null;
    function processScheduledCanvasPointerMove({ animationFrame = false, synchronousFlush = false } = {}) {
      if (!pendingCanvasPointerMove) return false;
      const pointer = pendingCanvasPointerMove;
      pendingCanvasPointerMove = null;
      if (interactionFrameStats) {
        interactionFrameStats.processedMoves += 1;
        if (animationFrame) interactionFrameStats.animationFrames += 1;
        if (synchronousFlush) interactionFrameStats.synchronousFlushes += 1;
      }
      processMove(pointer);
      return true;
    }

    function scheduleCanvasPointerMove(e) {
      if (interactionFrameStats) interactionFrameStats.receivedMoves += 1;
      if (pendingCanvasPointerMove) {
        if (interactionFrameStats) interactionFrameStats.coalescedMoves += 1;
        pendingCanvasPointerMove.offsetX = e.offsetX;
        pendingCanvasPointerMove.offsetY = e.offsetY;
        pendingCanvasPointerMove.shiftKey = e.shiftKey;
      } else {
        pendingCanvasPointerMove = { offsetX: e.offsetX, offsetY: e.offsetY, shiftKey: e.shiftKey };
      }
      if (canvasPointerMoveFrame != null) return;
      canvasPointerMoveFrame = requestFrame(() => {
        canvasPointerMoveFrame = null;
        processScheduledCanvasPointerMove({ animationFrame: true });
      });
    }

    function flushScheduledCanvasPointerMove({ discard = false } = {}) {
      if (canvasPointerMoveFrame != null) {
        cancelFrame(canvasPointerMoveFrame);
        canvasPointerMoveFrame = null;
      }
      if (discard) {
        pendingCanvasPointerMove = null;
        return false;
      }
      return processScheduledCanvasPointerMove({ synchronousFlush: true });
    }


    function resetStats() {
      flushScheduledCanvasPointerMove();
      interactionFrameStats = { receivedMoves: 0, processedMoves: 0, coalescedMoves: 0, animationFrames: 0, synchronousFlushes: 0, canvasDraws: 0 };
      return { ...interactionFrameStats };
    }
    function stats() {
      return interactionFrameStats ? { ...interactionFrameStats, pendingMove: Boolean(pendingCanvasPointerMove), frameScheduled: canvasPointerMoveFrame != null } : null;
    }
    function recordDraw() {
      if (interactionFrameStats) interactionFrameStats.canvasDraws += 1;
    }
    return Object.freeze({ schedule: scheduleCanvasPointerMove, flush: flushScheduledCanvasPointerMove, resetStats, stats, recordDraw });
  }
  window.PointerMoveScheduler = Object.freeze({ create });
})();

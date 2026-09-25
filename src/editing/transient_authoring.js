/* Point and line authoring rollback, including provisional history entries. */
(() => {
  "use strict";
  function create({ currentScope, ids, selection, historySnapshot, documentHistory,
    isHistoryRestoring, updateHistoryButtons, invalidateAnalysis, now = () => performance.now() }) {
    let lineStartRollback = null, lineCompletionRollback = null, pointStartRollback = null;
    function beginTransientLineStartRollback() {
      lineStartRollback = {
        pointLength: currentScope().points.length,
        constraintLength: currentScope().constraints.length,
        pointSeq: ids.peek("point"),
        lineLength: currentScope().lines.length,
      };
    }

    function clearTransientLineStartRollback() {
      lineStartRollback = null;
    }

    function beginTransientLineCompletionRollback() {
      lineCompletionRollback = {
        pointLength: currentScope().points.length,
        constraintLength: currentScope().constraints.length,
        lineLength: currentScope().lines.length,
        pointSeq: ids.peek("point"),
        lineSeq: ids.peek("line"),
        completedEndpoint: null,
        completedLine: null,
        startRollback: lineStartRollback ? { ...lineStartRollback } : null,
        createdAt: now(),
      };
    }

    function clearTransientLineCompletionRollback() {
      lineCompletionRollback = null;
    }

    function rollbackTransientLineCompletion() {
      if (!lineCompletionRollback) return false;
      const transientSnapshot = historySnapshot();
      const target = lineCompletionRollback.startRollback || lineCompletionRollback;
      currentScope().points.length = target.pointLength;
      currentScope().lines.length = target.lineLength ?? lineCompletionRollback.lineLength;
      currentScope().constraints.length = target.constraintLength;
      ids.restore({ pointSeq: target.pointSeq });
      ids.restore({ lineSeq: lineCompletionRollback.lineSeq });
      invalidateAnalysis();
      lineCompletionRollback = null;
      lineStartRollback = null;
      if (!isHistoryRestoring() && documentHistory.discardLatest(transientSnapshot)) {
        updateHistoryButtons();
      }
      return true;
    }

    function beginTransientPointRollback() {
      pointStartRollback = {
        pointLength: currentScope().points.length,
        constraintLength: currentScope().constraints.length,
        pointSeq: ids.peek("point"),
        createdPoint: null,
        createdAt: now(),
      };
    }

    function clearTransientPointRollback() {
      pointStartRollback = null;
    }

    function rollbackTransientPoint() {
      if (!pointStartRollback) return false;
      const transientSnapshot = historySnapshot();
      currentScope().points.length = pointStartRollback.pointLength;
      currentScope().constraints.length = pointStartRollback.constraintLength;
      const retainedPoints = new Set(currentScope().points);
      selection.set("points", selection.points.filter((point) => retainedPoints.has(point)));
      ids.restore({ pointSeq: pointStartRollback.pointSeq });
      invalidateAnalysis();
      pointStartRollback = null;
      if (!isHistoryRestoring() && documentHistory.discardLatest(transientSnapshot)) {
        updateHistoryButtons();
      }
      return true;
    }

    function rollbackTransientLineStart() {
      if (!lineStartRollback) return false;
      if (currentScope().lines.length === lineStartRollback.lineLength) {
        currentScope().points.length = lineStartRollback.pointLength;
        currentScope().constraints.length = lineStartRollback.constraintLength;
        ids.restore({ pointSeq: lineStartRollback.pointSeq });
        invalidateAnalysis();
      }
      lineStartRollback = null;
      return true;
    }
    function markCompletedLine(endpoint, line) {
      if (!lineCompletionRollback) return;
      lineCompletionRollback.completedEndpoint = endpoint;
      lineCompletionRollback.completedLine = line;
      lineCompletionRollback.createdAt = now();
    }
    function markCreatedPoint(point) { if (pointStartRollback) pointStartRollback.createdPoint = point; }
    function isLineStartHit(hit, start) {
      return Boolean(lineStartRollback && start && hit === start && currentScope().points.indexOf(start) >= lineStartRollback.pointLength);
    }
    function isLineCompletionHit(hit, start) {
      return Boolean(lineCompletionRollback && lineCompletionRollback.completedEndpoint
        && now() - lineCompletionRollback.createdAt <= 650 && hit === lineCompletionRollback.completedEndpoint
        && hit === start && currentScope().lines.includes(lineCompletionRollback.completedLine));
    }
    function isPointHit(hit) {
      return Boolean(pointStartRollback && pointStartRollback.createdPoint && now() - pointStartRollback.createdAt <= 650
        && hit === pointStartRollback.createdPoint && currentScope().points.indexOf(hit) >= pointStartRollback.pointLength);
    }
    return Object.freeze({
      beginTransientLineStartRollback, clearTransientLineStartRollback, beginTransientLineCompletionRollback,
      clearTransientLineCompletionRollback, rollbackTransientLineCompletion, beginTransientPointRollback,
      clearTransientPointRollback, rollbackTransientPoint, rollbackTransientLineStart,
      markCompletedLine, markCreatedPoint, isLineStartHit, isLineCompletionHit, isPointHit,
      get hasLineStart() { return lineStartRollback !== null; },
      get hasLineCompletion() { return lineCompletionRollback !== null; },
    });
  }
  window.TransientAuthoring = Object.freeze({ create });
})();

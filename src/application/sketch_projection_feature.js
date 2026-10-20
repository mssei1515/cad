/* Compose projection source selection and command interaction; retain shared legacy queries. */
(() => {
  "use strict";
  function create({ currentScope, queries, activeSketchId, geometryRefForItem, geometryRefsEqual,
    constraintIsOperational, constraintSketchId, geometryElementKey, geometryKindForItem, elementSketchId,
    isReferenceSourceSketchId, isVisibleSketchElement, operandElement, guardSketchEdit, readProjectionRectangle, geometry,
    selectedGeometryItems, cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    clearSelection, getMode, setMode, clearSnap, updateToolbar, setHint, applicationText, updateUI, draw,
    normalizeGeometryInstance, nextId, canvasSelection, refreshConstraintAnalysis, recordHistory, clearHover }) {
    const sources = window.SketchProjectionQueries.createSources({
      currentScope, activeSketchId, geometryRefForItem, geometryRefsEqual, queries,
      constraintIsOperational, constraintSketchId, geometryElementKey, geometryKindForItem, elementSketchId,
      isReferenceSourceSketchId, isVisibleSketchElement, operandElement,
    });
    function sketchProjectionEntriesByRect(rect, crossing) {
      return readProjectionRectangle(rect, crossing, geometry, sources.sketchProjectionEntryFromItem);
    }
    function sketchProjectionShapeEditBlockedMessage(action = "") {
      const prefix = action ? `${action}: ` : "";
      return applicationText(
        `${prefix}旧形式の投影拘束を削除してから形状を編集してください`,
        `${prefix}Delete the legacy sketch projection constraint before editing the shape.`,
      );
    }
    function guardSketchProjectionShapeEdit(items, { includeSharedNodes = true, action = "" } = {}) {
      if (!items.filter(Boolean).every(item => guardSketchEdit(elementSketchId(item)))) return false;
      if (queries.sketchProjectionConstraintsAffectingItems(items, { includeSharedNodes }).length === 0) return true;
      setHint(sketchProjectionShapeEditBlockedMessage(action), "error");
      return false;
    }
    const command = window.SketchProjectionCommand.create({
      selectedGeometryItems, ...sources, sketchProjectionEntriesByRect,
      cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
      clearSelection, getMode, setMode, clearSnap, updateToolbar, setHint, applicationText, updateUI, draw,
      activeSketchId, normalizeGeometryInstance, nextId, geometryRefForItem, currentScope,
      canvasSelection, refreshConstraintAnalysis, recordHistory, clearHover,
    });
    return Object.freeze({ command, sources, sketchProjectionEntriesByRect,
      guardSketchProjectionShapeEdit, sketchProjectionShapeEditBlockedMessage });
  }
  window.SketchProjectionFeature = Object.freeze({ create });
})();

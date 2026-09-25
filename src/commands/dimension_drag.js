/* Own dimension placement drag state and commit routing. */
(() => {
  "use strict";
  function create({ dimensionAnchor, migrateAngleDimensionLabelPlacement, canvasSelection, angleDimensionLabelOffsets,
    viewScale, isDimensionConstraintCommandActive, beginPointer, endPointer, setHint, clearSnap, hypot2,
    angleDimensionFromLabelPoint, dimensionWithLabelAt, dimensionFromAnchor, setAngleDimensionLabelOffsets,
    syncAngleConstraintFromDimension, draw, continueCommandClick, updateUI, updateGeometrySelectionUI,
    syncDimensionValueInput, recordHistory }) {
    let dimensionDragSession = null;
    function beginDimensionDrag(e, hit, pointer, commandHits = null) {
      const anchor = dimensionAnchor(hit.target, hit.dimension);
      migrateAngleDimensionLabelPlacement(hit.target, hit.dimension);
      canvasSelection.set("dimensionConstraint", hit.constraint);
      canvasSelection.set("constraint", null);
      dimensionDragSession = {
        pointerId: e.pointerId,
        constraint: hit.constraint,
        target: hit.target,
        part: hit.part || "line",
        startPointer: pointer,
        startAnchor: anchor,
        startLabelOffsetU: Number(hit.dimension?.labelOffsetU) || 0,
        startDisplay: hit.dimension?.display ? { ...hit.dimension.display } : null,
        startAngleLabelOffsets:
          hit.target.kind === "angle"
            ? angleDimensionLabelOffsets(hit.target, hit.dimension) || { radial: 14 / viewScale(), tangent: 0 }
            : null,
        startedDuringDimensionCommand: isDimensionConstraintCommandActive(),
        commandHits,
        moved: false,
      };
      beginPointer(e.pointerId);
      setHint("寸法線を移動中");
    }

    function preserveDimensionDragDisplay(session, dimension) {
      if (session?.startDisplay) dimension.display = { ...session.startDisplay };
      return dimension;
    }

    function update(p) {
      if (!dimensionDragSession) return;
      clearSnap();
      const dx = p.x - dimensionDragSession.startPointer.x;
      const dy = p.y - dimensionDragSession.startPointer.y;
      if (dimensionDragSession.startedDuringDimensionCommand && !dimensionDragSession.moved) {
        if (hypot2(dx, dy) * viewScale() <= 3) return;
        dimensionDragSession.moved = true;
      }
      if (dimensionDragSession.part === "label") {
        if (dimensionDragSession.target.kind === "angle") {
          const nextDimension = angleDimensionFromLabelPoint(
            dimensionDragSession.target,
            p,
            dimensionDragSession.startAngleLabelOffsets,
          );
          if (!nextDimension) return;
          preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
          dimensionDragSession.constraint.dimension = nextDimension;
          syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
          draw();
          return;
        }
        const anchor =
          dimensionDragSession.target.kind === "radius" || dimensionDragSession.target.kind === "diameter"
            ? p
            : {
                x: dimensionDragSession.startAnchor.x + dx,
                y: dimensionDragSession.startAnchor.y + dy,
              };
        const nextDimension = dimensionWithLabelAt(
          dimensionDragSession.target,
          dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false }),
          p,
        );
        preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
        dimensionDragSession.constraint.dimension = nextDimension;
        syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
        draw();
        return;
      }
      const anchor =
        dimensionDragSession.target.kind === "radius" || dimensionDragSession.target.kind === "diameter"
          ? p
          : {
              x: dimensionDragSession.startAnchor.x + dx,
              y: dimensionDragSession.startAnchor.y + dy,
            };
      const nextDimension = dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false });
      nextDimension.labelOffsetU = dimensionDragSession.startLabelOffsetU;
      preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
      if (dimensionDragSession.target.kind === "angle") {
        setAngleDimensionLabelOffsets(nextDimension, dimensionDragSession.startAngleLabelOffsets);
      }
      dimensionDragSession.constraint.dimension = nextDimension;
      syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
      draw();
      return;
    }
    function finish(event) {
      if (!dimensionDragSession) return false;
      const session = dimensionDragSession;
      dimensionDragSession = null;
      endPointer(event.pointerId);
      if (session.startedDuringDimensionCommand && !session.moved) {
        canvasSelection.set("dimensionConstraint", null);
        continueCommandClick(event, session.commandHits || {});
        return true;
      }
      setHint("寸法線の位置を更新しました");
      if (session.target.kind === "angle") updateUI();
      else { updateGeometrySelectionUI(); syncDimensionValueInput(); }
      draw();
      recordHistory("寸法線移動");
      return true;
    }
    return Object.freeze({ begin: beginDimensionDrag, update, finish,
      reset: () => { dimensionDragSession = null; },
      get active() { return Boolean(dimensionDragSession); },
      get constraint() { return dimensionDragSession?.constraint; } });
  }
  window.DimensionDrag = Object.freeze({ create });
})();

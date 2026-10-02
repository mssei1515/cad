/* Own transient drawing previews and coordinate their snap/hover feedback. */
(() => {
  "use strict";
  function create({ types, canvasHover, canCreateInActiveSketch, clearSnap, snapForDrawing, draw,
    linePreviewPoint, readCenterline, projectPointToCenterlineSupport, readOffsetSelection, computeTrimPreview, hits }) {
    const { Point, Line, Circle, Arc } = types;
    const { hitPoint, hitLine, hitCircle, hitArc } = hits;
    let pointerPreview = null;
    let trimPreview = null;
    function setPointer(value) { pointerPreview = value; }
    function setTrim(value) { trimPreview = value; }
    function reset() { pointerPreview = null; trimPreview = null; }
    // True consumes the move; false deliberately continues ordinary hover/drag handling.
    function updateAuthoring(mode, p, shiftKey) {
      if (["point", "line", "centerline", "circle-center-cross", "rectangle", "slot", "circle", "arc", "three-point-arc", "spline", "fillet", "trim", "offset", "block-place"].includes(mode) && !canCreateInActiveSketch()) {
        clearSnap();
        pointerPreview = null;
        trimPreview = null;
        canvasHover.update({ sketchIdentity: null });
        return true;
      }

      if (mode === "line") {
        canvasHover.update({ sketchIdentity: null });
        const rawPreview = linePreviewPoint(p, shiftKey);
        pointerPreview = snapForDrawing(rawPreview);
        draw();
      }

      if (mode === "centerline") {
        const centerline = readCenterline();
        clearSnap();
        canvasHover.update({ sketchIdentity: null });
        pointerPreview = centerline.support?.ok ? projectPointToCenterlineSupport(snapForDrawing(p)) : p;
        if (centerline.targets.length < 2) {
          clearSnap();
          const wantsLine = centerline.targets[0] instanceof Line;
          const wantsPoint = centerline.targets[0] instanceof Point;
          canvasHover.update({ point: wantsLine ? null : hitPoint(p.x, p.y) });
          canvasHover.update({ endpointPoint: canvasHover.current.point });
          canvasHover.update({ line: wantsPoint || canvasHover.current.point ? null : hitLine(p.x, p.y) });
        } else {
          canvasHover.update({
            point: null, endpointPoint: null, line: null,
          });
        }
        canvasHover.update({
          circle: null, arc: null, arcEndpoint: null,
          spline: null, dimension: null,
        });
        draw();
        return true;
      }

      if (mode === "circle-center-cross") {
        clearSnap();
        canvasHover.update({ sketchIdentity: null });
        pointerPreview = p;
        canvasHover.update({
          point: null, endpointPoint: null, line: null,
        });
        canvasHover.update({ circle: hitCircle(p.x, p.y) });
        canvasHover.update({
          arc: null, arcEndpoint: null, spline: null,
          dimension: null,
        });
        draw();
        return true;
      }

      if (mode === "rectangle" || mode === "slot" || mode === "circle" || mode === "arc" || mode === "three-point-arc" || mode === "spline") {
        canvasHover.update({ sketchIdentity: null });
        pointerPreview = snapForDrawing(p);
        draw();
      }

      if (mode === "block-place") {
        clearSnap();
        canvasHover.update({ sketchIdentity: null });
        pointerPreview = p;
        draw();
        return true;
      }
      return false;
    }
    function updateTrim(p) {
      clearSnap();
      const hadHover = Boolean(canvasHover.current.point || canvasHover.current.endpointPoint || canvasHover.current.line || canvasHover.current.circle || canvasHover.current.arcEndpoint || canvasHover.current.arc || canvasHover.current.dimension);
      canvasHover.update({
        point: null, endpointPoint: null, line: null,
        circle: null, arcEndpoint: null, arc: null,
        spline: null, dimension: null, sketchIdentity: null,
      });
      const nextTrimPreview = computeTrimPreview(p);
      if (nextTrimPreview !== trimPreview || hadHover) {
        trimPreview = nextTrimPreview;
        draw();
      }
    }
    function updateOffset(p, valuePending) {
      const offsetSelection = readOffsetSelection();
      clearSnap();
      canvasHover.update({ sketchIdentity: null });
      if (valuePending) {
        draw();
        return;
      }
      pointerPreview = p;
      if (offsetSelection.source instanceof Circle || offsetSelection.committed) {
        canvasHover.update({
          point: null, endpointPoint: null, line: offsetSelection.source instanceof Line ? offsetSelection.source : null,
          circle: offsetSelection.source instanceof Circle ? offsetSelection.source : null, arc: offsetSelection.source instanceof Arc ? offsetSelection.source : null,
        });
      } else {
        const nextLine = hitLine(p.x, p.y);
        const nextCircle = nextLine ? null : hitCircle(p.x, p.y);
        const nextArc = nextLine || nextCircle ? null : hitArc(p.x, p.y);
        canvasHover.update({
          point: null, endpointPoint: null, line: nextLine,
          circle: nextCircle, arc: nextArc,
        });
      }
      canvasHover.update({
        arcEndpoint: null, dimension: null,
      });
      draw();
    }
    function updateFreeInstance(p) { pointerPreview = snapForDrawing(p); draw(); }
    return Object.freeze({ setPointer, setTrim, reset, updateAuthoring, updateTrim, updateOffset, updateFreeInstance,
      get pointer() { return pointerPreview; }, get trim() { return trimPreview; } });
  }
  window.DrawingPreview = Object.freeze({ create });
})();

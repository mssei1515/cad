/* Spline browser-test setup and observations through explicit application ports. */
(() => {
  "use strict";
  function create({ resetModelState, viewport, resizeCanvas, resetHistory, updateUI, draw, canvas,
    worldToCanvasScreen, serializeModel, readOperation, canvasSelection, document, addPoint, addSpline, hatchGeometryQuery }) {
    function reset() {
      resetModelState();
      viewport.update({ scale: 2 });
      resizeCanvas({ centerWorld: { x: 0, y: 0 } });
      resetHistory("spline test");
      updateUI();
      draw();
      const rect = canvas.getBoundingClientRect();
      const client = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      };
      return {
        clients: [
          client({ x: -90, y: 20 }),
          client({ x: -30, y: -45 }),
          client({ x: 30, y: 45 }),
          client({ x: 90, y: -20 }),
        ],
        serialized: serializeModel(),
      };
    }
    function state() {
      const serialized = serializeModel();
      const { mode, editSplineId } = readOperation();
      return {
        mode,
        editSplineId,
        direct: serialized.splines,
        selectedIds: canvasSelection.splines.map((spline) => spline.id),
        selectedPointIds: canvasSelection.points.map((point) => point.id),
        treeRows: document.querySelectorAll('#sketchList [data-object-kind="spline"]').length,
        propertiesText: document.getElementById("propertiesPanel")?.textContent || "",
        serialized,
      };
    }
    function hatchPreviewCache() {
      resetModelState();
      const points = [
        addPoint(0, 0, false, "endpoint"), addPoint(100, 0, false, "endpoint"),
        addPoint(100, 80, false, "endpoint"), addPoint(0, 80, false, "endpoint"),
      ];
      const spline = addSpline(points, true, false);
      const seed = { x: 50, y: 40 };
      const before = hatchGeometryQuery.hatchFaceAt(seed);
      points[1].x = 180;
      points[2].x = 180;
      const after = hatchGeometryQuery.hatchFaceAt(seed);
      const maxX = (result) => result?.ok
        ? Math.max(...result.resolved.loops.flatMap((loop) => loop.points.map((point) => point.x)))
        : null;
      return { splineId: spline?.id || null, beforeOk: Boolean(before?.ok), afterOk: Boolean(after?.ok), beforeMaxX: maxX(before), afterMaxX: maxX(after) };
    }
    return Object.freeze({ reset, state, hatchPreviewCache });
  }
  window.SplineTestDriver = Object.freeze({ create });
})();

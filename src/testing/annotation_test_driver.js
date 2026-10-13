/* Browser-test annotation fixtures and observations delegate to existing editing/display owners. */
(() => {
  "use strict";
  function createDragFixture({ resetModelState, addPoint, addLine, annotationLeaderTargetFromItem, pushAnnotation, defaultStyle, resizeCanvas, readSnapshot }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(-60, -25, false, "endpoint");
      const p2 = addPoint(60, -25, false, "endpoint");
      const p3 = addPoint(60, 35, false, "endpoint");
      const p4 = addPoint(-60, 35, false, "endpoint");
      addLine(p1, p2);
      addLine(p2, p3);
      const l3 = addLine(p3, p4);
      addLine(p4, p1);
      const leaderTarget = annotationLeaderTargetFromItem(l3, { x: 0, y: 35 });
      pushAnnotation({
        type: "leader",
        text: "注記",
        start: { ...leaderTarget.anchor },
        elbow: { x: 56, y: 82 },
        end: { x: 112, y: 82 },
        geometryRef: leaderTarget.geometryRef,
        style: { ...defaultStyle },
      });
      pushAnnotation({ type: "text", text: "自由テキスト", x: -90, y: 80, style: { ...defaultStyle } });
      resizeCanvas({ centerWorld: { x: 20, y: 20 } });
      return readSnapshot();
    }
    return Object.freeze({ reset });
  }

  function createSnapshot({ currentScope, annotationLeaderDisplayGeometry, canvas, worldToCanvasScreen }) {
    function snapshot() {
      const leaderElement = [...currentScope().annotations].reverse().find((element) => element.type === "leader");
      const textElement = [...currentScope().annotations].reverse().find((element) => element.type === "text");
      const leaderGeometry = leaderElement ? annotationLeaderDisplayGeometry(leaderElement) : null;
      const canvasRect = canvas.getBoundingClientRect();
      const toViewport = (point) => {
        const screen = worldToCanvasScreen(point);
        return { x: canvasRect.left + screen.x, y: canvasRect.top + screen.y };
      };
      return {
        leader: leaderElement
          ? {
              world: { ...leaderElement.end },
              viewport: toViewport(leaderGeometry.end),
              displayEnd: { ...leaderGeometry.end },
              bodyViewport: toViewport({ x: (leaderGeometry.elbow.x + leaderGeometry.end.x) / 2, y: leaderGeometry.end.y }),
              end: { ...leaderElement.end },
              elbow: leaderElement.elbow ? { ...leaderElement.elbow } : null,
            }
          : null,
        text: textElement ? { world: { x: textElement.x, y: textElement.y }, viewport: toViewport(textElement) } : null,
      };
    }
    return Object.freeze({ snapshot });
  }

  function createHitObservation({ canvas, screenToWorld, hitAnnotationElement }) {
    function hit(viewportPoint) {
      const canvasRect = canvas.getBoundingClientRect();
      const world = screenToWorld({ x: viewportPoint.x - canvasRect.left, y: viewportPoint.y - canvasRect.top });
      const hit = hitAnnotationElement(world.x, world.y);
      return hit ? { type: hit.type, part: hit.part } : null;
    }
    return Object.freeze({ hit });
  }

  window.AnnotationTestDriver = Object.freeze({ createDragFixture, createSnapshot, createHitObservation });
})();

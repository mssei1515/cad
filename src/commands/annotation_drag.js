/* Own annotation drag identity, initial coordinates and commit lifecycle. */
(() => {
  "use strict";
  function create({ annotationById, canvasSelection, beginPointer, endPointer, setHint, updateUI, draw, recordHistory }) {
    let annotationDragSession = null;
    function beginAnnotationDrag(e, hit, pointer) {
      annotationDragSession = {
        pointerId: e.pointerId,
        elementId: hit.element?.id || null,
        hit,
        startPointer: pointer,
        startEnd: hit.element?.end ? { ...hit.element.end } : null,
        startElbow: hit.element?.elbow ? { ...hit.element.elbow } : null,
        startText: hit.element ? { x: hit.element.x, y: hit.element.y } : null,
      };
      canvasSelection.set("annotations", [hit.element]);
      beginPointer(e.pointerId);
      setHint(hit.type === "leader" ? "引出線を移動中" : "テキストを移動中");
    }

    function updateAnnotationDrag(pointer) {
      const session = annotationDragSession;
      if (!session) return;
      const dx = pointer.x - session.startPointer.x;
      const dy = pointer.y - session.startPointer.y;
      const element = annotationById(session.elementId) || session.hit.element;
      if (!element) return;
      if (session.hit.type === "leader") {
        if (session.startEnd) element.end = { x: session.startEnd.x + dx, y: session.startEnd.y + dy };
        if (session.startElbow) element.elbow = { x: session.startElbow.x + dx, y: session.startElbow.y + dy };
        if (session.startText) {
          element.x = session.startText.x + dx;
          element.y = session.startText.y + dy;
        }
      } else if (session.hit.type === "text" && session.startText) {
        element.x = session.startText.x + dx;
        element.y = session.startText.y + dy;
      }
      draw();
    }

    function finish(event) {
      if (!annotationDragSession) return false;
      annotationDragSession = null;
      endPointer(event.pointerId);
      setHint("注記の位置を更新しました");
      updateUI();
      draw();
      recordHistory("注記移動");
      return true;
    }
    function inspect() {
      const element = annotationById(annotationDragSession?.elementId);
      return annotationDragSession ? { type: annotationDragSession.hit?.type,
        hasStart: Boolean(annotationDragSession.start), elementId: element?.id || null } : null;
    }
    return Object.freeze({ begin: beginAnnotationDrag, update: updateAnnotationDrag, finish, inspect,
      reset: () => { annotationDragSession = null; }, get active() { return Boolean(annotationDragSession); } });
  }
  window.AnnotationDrag = Object.freeze({ create });
})();

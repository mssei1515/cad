/* Own annotation drag identity, initial coordinates and commit lifecycle. */
(() => {
  "use strict";
  function create({ canEdit = () => true, annotationById, canvasSelection, beginPointer, endPointer, setHint, updateUI, draw, recordHistory, annotationLeaderDisplayGeometry = element => ({ ...element, shelfScale: 1 }) }) {
    let annotationDragSession = null;
    function beginAnnotationDrag(e, hit, pointer) {
      if (!canEdit(hit.element)) return;
      const selected = canvasSelection.annotations || [];
      const elements = hit.type === "text" && selected.includes(hit.element) && selected.every(item => item.type === "text")
        ? selected : [hit.element];
      canvasSelection.set("annotations", elements);
      if (hit.part === "end" && hit.element.anchorConstraints?.length || (hit.element.anchorConstraints || []).some(item => item.type === "fixed" || item.type === "coincident")) return;
      annotationDragSession = {
        pointerId: e.pointerId,
        elementId: hit.element?.id || null,
        hit,
        startPointer: pointer,
        startEnd: hit.element?.end ? { ...hit.element.end } : null,
        startElbow: hit.element?.elbow ? { ...hit.element.elbow } : null,
        startText: hit.element ? { x: hit.element.x, y: hit.element.y } : null,
        shelfScale: hit.type === "leader" ? annotationLeaderDisplayGeometry(hit.element)?.shelfScale || 1 : 1,
        texts: hit.type === "text" ? elements.map(element => ({ element, id: element.id, x: element.x, y: element.y })) : [],
      };
      canvasSelection.set("annotations", elements);
      beginPointer(e.pointerId);
      setHint(hit.part === "end" ? "引出線の横棒の長さを変更中" : hit.type === "leader" ? "引出線を移動中" : "テキストを移動中");
    }

    function updateAnnotationDrag(pointer) {
      const session = annotationDragSession;
      if (!session) return;
      let dx = pointer.x - session.startPointer.x;
      let dy = pointer.y - session.startPointer.y;
      const element = annotationById(session.elementId) || session.hit.element;
      if (!element) return;
      const axes = (element.anchorConstraints || []).flatMap(item => window.AnnotationAnchorConstraints.axes(item.type));
      if (axes.includes("x")) dx = 0;
      if (axes.includes("y")) dy = 0;
      if (session.hit.type === "leader" && session.hit.part === "end" && session.startEnd && session.startElbow) {
        const offset = dx / session.shelfScale;
        element.end = { x: session.startEnd.x + offset, y: session.startElbow.y };
        // Legacy text follows the shelf midpoint; shelf-positioned labels resolve this at draw time.
        if (session.startText && !["text", "anchor"].includes(element.textPlacement)) element.x = session.startText.x + offset / 2;
      } else if (session.hit.type === "leader") {
        const offsetX = dx / session.shelfScale, offsetY = dy / session.shelfScale;
        if (session.startEnd) element.end = { x: session.startEnd.x + offsetX, y: session.startEnd.y + offsetY };
        if (session.startElbow) element.elbow = { x: session.startElbow.x + offsetX, y: session.startElbow.y + offsetY };
        if (session.startText) {
          element.x = session.startText.x + offsetX;
          element.y = session.startText.y + offsetY;
        }
      } else if (session.hit.type === "text") {
        for (const start of session.texts) {
          const text = annotationById(start.id) || start.element;
          const lockedAxes = (text.anchorConstraints || []).flatMap(item => window.AnnotationAnchorConstraints.axes(item.type));
          text.x = start.x + (lockedAxes.includes("x") ? 0 : dx);
          text.y = start.y + (lockedAxes.includes("y") ? 0 : dy);
        }
      }
      draw();
    }

    function finish(event) {
      if (!annotationDragSession) return false;
      const resizing = annotationDragSession.hit.part === "end";
      annotationDragSession = null;
      endPointer(event.pointerId);
      setHint(resizing ? "引出線の横棒の長さを更新しました" : "注記の位置を更新しました");
      updateUI();
      draw();
      recordHistory(resizing ? "引出線横棒長さ変更" : "注記移動");
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

/* Own annotation drag identity, initial coordinates and commit lifecycle. */
(() => {
  "use strict";
  function create({ canEdit = () => true, annotationById, canvasSelection, beginPointer, endPointer, setHint, updateUI, draw, recordHistory, annotationLeaderDisplayGeometry = element => ({ ...element, shelfScale: 1 }), annotationTextLayout, effectiveAnnotationStyle, materializeAnchor = () => {}, resizeText }) {
    let annotationDragSession = null;
    let resizeHandlesId = null;
    function syncResizeSelection(enabled = true) {
      if (!enabled || !(canvasSelection.annotations || []).some(item => item.id === resizeHandlesId)) resizeHandlesId = null;
    }
    function beginAnnotationDrag(e, hit, pointer) {
      if (!canEdit(hit.element)) return;
      const selected = canvasSelection.annotations || [];
      const elements = hit.type === "text" && selected.includes(hit.element) && selected.every(item => item.type === "text")
        ? selected : [hit.element];
      canvasSelection.set("annotations", elements);
      if (hit.part === "frame-enable") {
        resizeHandlesId = hit.element.id;
        setHint("文字サイズのハンドルをドラッグしてください"); draw(); return;
      }
      if (hit.part === "frame") {
        const layout = annotationTextLayout(hit.element), original = {};
        if (!layout) return;
        for (const key of ["style", "x", "y", "anchorPosition", "textPlacement", "appearanceInheritance"]) original[key] = hit.element[key] == null ? hit.element[key] : JSON.parse(JSON.stringify(hit.element[key]));
        materializeAnchor(hit.element);
        const [column, row] = hit.element.anchorPosition.split("-");
        const fractions = { left: 0, center: 0.5, right: 1, top: 0, middle: 0.5, bottom: 1 };
        const derivativeX = hit.resizeX * layout.width * ((hit.resizeX < 0 ? fractions[column] : 1 - fractions[column]) || 1);
        const derivativeY = hit.resizeY * layout.height * ((hit.resizeY < 0 ? fractions[row] : 1 - fractions[row]) || 1);
        annotationDragSession = { pointerId: e.pointerId, elementId: hit.element.id, hit, original, layout, startPointer: pointer,
          derivativeX, derivativeY, textHeight: effectiveAnnotationStyle(hit.element).textHeight, changed: false };
        beginPointer(e.pointerId); setHint("注記の文字サイズを変更中"); return;
      }
      if (hit.part === "end" && hit.element.anchorConstraints?.length || (hit.element.anchorConstraints || []).some(item => window.AnnotationAnchorConstraints.axes(item.type).length === 2)) return;
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
      if (session.hit.part === "frame") {
        const cos = Math.cos(session.layout.rotation), sin = Math.sin(session.layout.rotation);
        const localX = dx * cos + dy * sin, localY = -dx * sin + dy * cos;
        const squared = session.derivativeX ** 2 + session.derivativeY ** 2;
        const factor = squared > 1e-12 ? 1 + (localX * session.derivativeX + localY * session.derivativeY) / squared : 1;
        const height = Math.max(0.5, Math.min(100, session.textHeight * factor));
        resizeText(element, height); session.changed = Math.abs(height - session.textHeight) > 1e-8;
        draw(); return;
      }
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
      if (annotationDragSession.hit.part === "frame") {
        const session = annotationDragSession;
        if (!session.changed) restoreResize(session);
        annotationDragSession = null; endPointer(event.pointerId);
        setHint("注記の文字サイズを更新しました"); updateUI(); draw();
        if (session.changed) recordHistory("注記文字サイズ変更");
        return true;
      }
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
    function restoreResize(session) {
      const item = annotationById(session.elementId) || session.hit.element;
      for (const [key, value] of Object.entries(session.original)) {
        if (value === undefined) delete item[key]; else item[key] = value;
      }
    }
    return Object.freeze({ begin: beginAnnotationDrag, update: updateAnnotationDrag, finish, inspect,
      syncResizeSelection, resizeEnabled: element => resizeHandlesId === element?.id,
      reset: () => { if (annotationDragSession?.hit.part === "frame") { restoreResize(annotationDragSession); endPointer(annotationDragSession.pointerId); } annotationDragSession = null; resizeHandlesId = null; },
      get handlesActive() { return Boolean(resizeHandlesId); },
      get resizing() { return annotationDragSession?.hit.part === "frame"; }, get active() { return Boolean(annotationDragSession); } });
  }
  window.AnnotationDrag = Object.freeze({ create });
})();

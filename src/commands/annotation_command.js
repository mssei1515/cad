/* Coordinate annotation creation, text prompts and leader preview data. */
(() => {
  "use strict";
  const { DEFAULT_ANNOTATION_STYLE, normalizeAnnotationStyle } = window.Appearance;
  function create({ currentScope, getPending, setPending, lastPointer, viewScale, promptText, nextAnnotationId,
    activeSketchId, canCreateInActiveSketch, rejectRootSketchCreation, annotationLeaderTargetFromSelection,
    annotationLeaderTargetFromHit, setGeometrySelection, clearSelection, cancelPendingCommand,
    setHint, updateToolbar, updateUI, draw, recordHistory }) {
    function pushAnnotation(element) {
      if (!canCreateInActiveSketch()) {
        rejectRootSketchCreation();
        return null;
      }
      const item = {
        id: nextAnnotationId(),
        sketchId: activeSketchId(),
        visible: true,
        style: {},
        ...element,
      };
      item.rotation = Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0;
      item.style = normalizeAnnotationStyle(item.style);
      currentScope().annotations.push(item);
      updateUI();
      draw();
      return item;
    }

    function createLeaderAnnotation() {
      if (rejectRootSketchCreation()) return;
      const target = annotationLeaderTargetFromSelection(lastPointer());
      if (target) {
        startLeaderAnnotationPlacement(target, lastPointer());
        return;
      }
      clearSelection();
      setPending({ type: "annotation-leader-select" });
      setHint("引出線を付ける図形をクリックしてください");
      updateToolbar();
      draw();
    }

    function handleLeaderAnnotationTargetClick(hit, pointer) {
      if (getPending()?.type !== "annotation-leader-select") return false;
      const target = annotationLeaderTargetFromHit(hit, pointer);
      if (!target) {
        setHint("引出線を付ける図形をクリックしてください", "error");
        return true;
      }
      setGeometrySelection(hit, false);
      startLeaderAnnotationPlacement(target, pointer);
      return true;
    }

    function startLeaderAnnotationPlacement(target, pointer = null) {
      setPending({
        type: "annotation-leader-place",
        leaderTarget: target,
        pointer: pointer || {
          x: target.anchor.x + 90 / viewScale(),
          y: target.anchor.y - 36 / viewScale(),
        },
      });
      setHint("引出線の文字位置をクリックしてください");
      updateToolbar();
      draw();
    }

    function annotationLeaderLayout(anchor, pointer) {
      const side = pointer.x >= anchor.x ? 1 : -1;
      const minShelf = 64 / viewScale();
      const end = { x: pointer.x, y: pointer.y };
      if (Math.abs(end.x - anchor.x) < minShelf) end.x = anchor.x + side * minShelf;
      const elbowX = side > 0 ? Math.min(anchor.x + 42 / viewScale(), end.x - minShelf) : Math.max(anchor.x - 42 / viewScale(), end.x + minShelf);
      const elbow = { x: elbowX, y: end.y };
      const text = {
        x: (elbow.x + end.x) / 2,
        y: end.y - 10 / viewScale(),
      };
      return { start: anchor, elbow, end, text };
    }

    function commitLeaderAnnotationAt(pointer) {
      if (getPending()?.type !== "annotation-leader-place" || !getPending().leaderTarget) return;
      const target = getPending().leaderTarget;
      const layout = annotationLeaderLayout(target.anchor, pointer);
      const text = promptText("引出線テキスト", "注記");
      if (!text) {
        setHint("引出線をキャンセルしました");
        setPending(null);
        updateToolbar();
        draw();
        return;
      }
      pushAnnotation({
        type: "leader",
        text,
        start: layout.start,
        elbow: layout.elbow,
        end: layout.end,
        x: layout.text.x,
        y: layout.text.y,
        geometryRef: target.geometryRef,
        style: { ...DEFAULT_ANNOTATION_STYLE },
      });
      setPending(null);
      setHint("引出線を追加しました");
      updateToolbar();
      recordHistory("引出線追加");
    }

    function leaderPreview() {
      if (getPending()?.type !== "annotation-leader-place" || !getPending().leaderTarget) return;
      const layout = annotationLeaderLayout(getPending().leaderTarget.anchor, getPending().pointer);
      return {
        start: layout.start,
        elbow: layout.elbow,
        end: layout.end,
        x: layout.text.x,
        y: layout.text.y,
        text: "注記",
        style: { ...DEFAULT_ANNOTATION_STYLE, color: "#2563eb" },
      };
    }

    function createTextAnnotation() {
      if (rejectRootSketchCreation()) return;
      cancelPendingCommand("");
      setPending({ type: "annotation-text-place", pointer: lastPointer() || { x: 0, y: 0 } });
      setHint("テキストを配置する位置をクリックしてください");
      updateToolbar();
      draw();
    }

    function commitTextAnnotationAt(pointer) {
      if (getPending()?.type !== "annotation-text-place") return false;
      const text = promptText("テキスト", "注記");
      if (text) {
        pushAnnotation({ type: "text", text, x: pointer.x, y: pointer.y, style: { ...DEFAULT_ANNOTATION_STYLE } });
        recordHistory("テキスト追加");
        setHint("テキストを追加しました");
      } else {
        setHint("テキストをキャンセルしました");
      }
      setPending(null);
      updateToolbar();
      draw();
      return true;
    }


    return Object.freeze({ pushAnnotation, createLeaderAnnotation, handleLeaderAnnotationTargetClick,
      startLeaderAnnotationPlacement, commitLeaderAnnotationAt, createTextAnnotation, commitTextAnnotationAt, leaderPreview });
  }
  window.AnnotationCommand = Object.freeze({ create });
})();

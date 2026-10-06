/* Coordinate annotation creation, text prompts and leader preview data. */
(() => {
  "use strict";
  const { DEFAULT_ANNOTATION_STYLE, normalizeAnnotationStyle } = window.Appearance;
  function create({ currentScope, getPending, setPending, lastPointer, viewScale, promptText, nextAnnotationId,
    activeSketchId, canCreateInActiveSketch, rejectRootSketchCreation, annotationLeaderTargetFromSelection,
    annotationLeaderTargetFromHit, annotationLeaderAnchor = element => element.start, effectiveAnnotationStyle = element => normalizeAnnotationStyle(element.style), setGeometrySelection, clearSelection, cancelPendingCommand,
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
      item.style = window.Appearance.annotationStoredStyle(item);
      currentScope().annotations.push(item);
      updateUI();
      draw();
      return item;
    }

    function createLeaderAnnotation() {
      if (rejectRootSketchCreation()) return;
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
      setHint("引出線の折れ位置をクリックしてください");
      updateToolbar();
      draw();
    }

    function annotationLeaderLayout(anchor, pointer, fixedElbow) {
      const elbow = fixedElbow || { ...pointer };
      const end = { x: pointer.x, y: elbow.y };
      return { start: anchor, elbow, end, text: { x: (elbow.x + end.x) / 2, y: end.y - 10 / viewScale() } };
    }

    function shelfReferenceScale() {
      const style = effectiveAnnotationStyle({ type: "leader", appearanceInheritance: true, sketchId: activeSketchId(), style: {} });
      return viewScale() / window.Appearance.annotationDisplayFactor(style, viewScale());
    }

    function currentLeaderAnchor(target) {
      return annotationLeaderAnchor({ start: target.anchor, geometryRef: target.geometryRef, attachment: target.attachment }) || target.anchor;
    }

    function commitLeaderAnnotationAt(pointer) {
      if (getPending()?.type !== "annotation-leader-place" || !getPending().leaderTarget) return;
      const target = getPending().leaderTarget;
      if (!getPending().elbow) {
        getPending().elbow = { x: pointer.x, y: pointer.y };
        getPending().pointer = { ...pointer };
        setHint("引出線の横線の終端をクリックしてください");
        draw();
        return;
      }
      const layout = annotationLeaderLayout(currentLeaderAnchor(target), pointer, getPending().elbow);
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
        attachment: target.attachment,
        appearanceInheritance: true,
        textPlacement: "shelf",
        shelfReferenceScale: shelfReferenceScale(),
        style: {},
      });
      setPending(null);
      setHint("引出線を追加しました");
      updateToolbar();
      recordHistory("引出線追加");
    }

    function leaderPreview() {
      if (getPending()?.type !== "annotation-leader-place" || !getPending().leaderTarget) return;
      const layout = annotationLeaderLayout(currentLeaderAnchor(getPending().leaderTarget), getPending().pointer, getPending().elbow);
      return {
        start: layout.start,
        elbow: layout.elbow,
        end: layout.end,
        x: layout.text.x,
        y: layout.text.y,
        text: "注記",
        type: "leader",
        appearanceInheritance: true,
        textPlacement: "shelf",
        shelfReferenceScale: shelfReferenceScale(),
        style: { ...effectiveAnnotationStyle({ type: "leader", appearanceInheritance: true, sketchId: activeSketchId(), style: {} }), color: "#2563eb" },
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

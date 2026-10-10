/* Own annotation drafts, leader conversion and atomic history boundaries. */
(() => {
  "use strict";
  function create({ currentScope, getPending, setPending, lastPointer, viewScale, nextAnnotationId,
    activeSketchId, canCreateInActiveSketch, rejectRootSketchCreation, annotationLeaderTargetFromHit,
    annotationLeaderAnchor = element => element.start, effectiveAnnotationStyle = element => window.Appearance.normalizeAnnotationStyle(element.style),
    annotationTextLayout, annotationLeaderDisplayGeometry, annotationTextMetrics, selectAnnotation = () => {},
    canEdit = () => true, prepare = () => {}, clearSelection, cancelPendingCommand,
    setHint, updateToolbar, updateUI, draw, recordHistory }) {
    let lastWithLeader = false;
    const active = () => Boolean(getPending()?.annotationDraft);
    function refresh() { updateToolbar(); draw(); }
    function pushAnnotation(element) {
      if (!canCreateInActiveSketch()) { rejectRootSketchCreation(); return null; }
      const item = { id: nextAnnotationId(), sketchId: activeSketchId(), visible: true, style: {}, ...element };
      item.rotation = Number(item.rotation) || 0;
      item.style = window.Appearance.annotationStoredStyle(item);
      currentScope().annotations.push(item);
      return item;
    }
    function start(withLeader = lastWithLeader) {
      if (rejectRootSketchCreation()) return;
      prepare(); cancelPendingCommand(""); clearSelection();
      setPending({ annotationDraft: true, type: withLeader ? "annotation-leader-select" : "annotation-text-place",
        withLeader, text: "", pointer: lastPointer() || { x: 0, y: 0 } });
      updateUI(); refresh();
    }
    function changeSetting(key, value) {
      const draft = getPending();
      if (!active() || draft.editId) return;
      if (key === "text") draft.text = String(value);
      if (key === "withLeader" && Boolean(value) !== draft.withLeader) {
        lastWithLeader = Boolean(value);
        setPending({ annotationDraft: true, type: value ? "annotation-leader-select" : "annotation-text-place",
          withLeader: Boolean(value), text: draft.text, pointer: lastPointer() || { x: 0, y: 0 } });
      }
      refresh();
    }
    function handleLeaderAnnotationTargetClick(hit, pointer) {
      const draft = getPending();
      if (!active() || draft.type !== "annotation-leader-select") return false;
      const target = annotationLeaderTargetFromHit(hit, pointer, draft.sketchId);
      if (!target) { setHint("引出線を付ける図形をクリックしてください", "error"); return true; }
      draft.leaderTarget = target;
      if (!draft.editId) draft.type = "annotation-leader-place";
      draft.pointer = { ...pointer };
      refresh(); return true;
    }
    function commitLeaderAnnotationAt(pointer) {
      const draft = getPending();
      if (!active() || draft.type !== "annotation-leader-place") return false;
      if (!draft.elbow) draft.elbow = { ...pointer };
      else draft.end = { x: pointer.x, y: draft.elbow.y };
      draft.pointer = { ...pointer };
      refresh(); return true;
    }
    function commitTextAnnotationAt(pointer) {
      if (!active() || getPending().type !== "annotation-text-place") return false;
      getPending().position = { ...pointer };
      refresh(); return true;
    }
    function currentAnchor(target) {
      return annotationLeaderAnchor({ start: target.anchor, geometryRef: target.geometryRef, attachment: target.attachment }) || target.anchor;
    }
    function referenceScale(item) {
      return viewScale() / window.Appearance.annotationDisplayFactor(effectiveAnnotationStyle(item), viewScale());
    }
    function preservedStyle(source) {
      if (source.appearanceInheritance) return { ...source.style };
      const style = effectiveAnnotationStyle(source);
      const defaults = effectiveAnnotationStyle({ type: "leader", appearanceInheritance: true, sketchId: source.sketchId, style: {} });
      return { ...defaults, ...style, ...window.Appearance.annotationDisplaySettings(style),
        rotation: source.appearanceInheritance ? Number(style.rotation) || 0 : Number(source.rotation) || 0 };
    }
    function preview() {
      const draft = getPending();
      if (!active()) return null;
      if (draft.editId) {
        if (!draft.leaderTarget) return null;
        const source = currentScope().annotations.find(item => item.id === draft.editId);
        if (!source) return null;
        const storedStyle = preservedStyle(source);
        const style = effectiveAnnotationStyle({ ...source, type: "leader", appearanceInheritance: true, style: storedStyle });
        const metrics = annotationTextMetrics(source);
        const gap = ((style.textGap ?? 1) * window.Appearance.CSS_PX_PER_MM + style.lineWidth / 2)
          / viewScale() * window.Appearance.annotationDisplayFactor(style, viewScale());
        const left = { x: metrics.bounds.x1, y: metrics.bounds.y2 + gap };
        const right = { x: metrics.bounds.x2, y: left.y };
        const start = currentAnchor(draft.leaderTarget);
        const leftNear = Math.hypot(start.x - left.x, start.y - left.y) <= Math.hypot(start.x - right.x, start.y - right.y);
        const result = { ...source, type: "leader", appearanceInheritance: true, style: storedStyle, textPlacement: "text",
          start, elbow: leftNear ? left : right, end: leftNear ? right : left,
          geometryRef: draft.leaderTarget.geometryRef, attachment: draft.leaderTarget.attachment };
        result.shelfReferenceScale = referenceScale(result);
        return result;
      }
      const item = { type: draft.withLeader ? "leader" : "text", sketchId: activeSketchId(),
        text: draft.text, style: {}, appearanceInheritance: true, rotation: 0 };
      if (!draft.withLeader) return { ...item, ...(draft.position || draft.pointer) };
      if (!draft.leaderTarget) return null;
      const start = currentAnchor(draft.leaderTarget);
      const elbow = draft.elbow || draft.pointer;
      const end = draft.end || { x: draft.pointer.x, y: elbow.y };
      return { ...item, start, elbow, end, x: (elbow.x + end.x) / 2, y: end.y,
        geometryRef: draft.leaderTarget.geometryRef, attachment: draft.leaderTarget.attachment,
        textPlacement: "shelf", shelfReferenceScale: referenceScale(item) };
    }
    function canFinish() {
      const draft = getPending();
      if (!active()) return false;
      if (draft.editId) return Boolean(draft.leaderTarget);
      return draft.text.length > 0 && Boolean(draft.withLeader ? draft.end : draft.position);
    }
    function finish() {
      if (!canFinish()) return false;
      const draft = getPending(), value = preview();
      let item;
      if (draft.editId) {
        item = currentScope().annotations.find(item => item.id === draft.editId);
        if (!item || !canEdit(item)) return false;
        Object.assign(item, value);
      } else {
        item = pushAnnotation(value);
        if (!item) return false;
        lastWithLeader = draft.withLeader;
      }
      setPending(null); clearSelection(); selectAnnotation(item);
      recordHistory(draft.editId ? "引出線追加" : "注記追加");
      updateUI(); refresh(); return true;
    }
    function cancel() {
      if (!active()) return;
      const item = currentScope().annotations.find(item => item.id === getPending().editId);
      setPending(null);
      if (item) { clearSelection(); selectAnnotation(item); }
      updateUI(); refresh();
    }
    function addLeader(item) {
      if (item?.type !== "text" || !canEdit(item)) return false;
      prepare(); cancelPendingCommand("");
      setPending({ annotationDraft: true, type: "annotation-leader-select", editId: item.id, sketchId: item.sketchId,
        withLeader: true, text: item.text });
      refresh(); return true;
    }
    function removeLeader(item) {
      if (item?.type !== "leader" || !canEdit(item)) return false;
      const position = annotationTextLayout(item) || annotationLeaderDisplayGeometry(item) || item;
      const style = preservedStyle(item);
      const rotation = item.appearanceInheritance ? effectiveAnnotationStyle(item).rotation || 0 : Number(item.rotation) || 0;
      Object.assign(item, { type: "text", x: position.x, y: position.y, rotation,
        appearanceInheritance: true, style });
      for (const key of ["geometryRef", "attachment", "start", "elbow", "end", "textPlacement", "shelfReferenceScale"]) delete item[key];
      recordHistory("引出線解除"); updateUI(); refresh(); return true;
    }
    return Object.freeze({ start, createTextAnnotation: () => start(false), createLeaderAnnotation: () => start(true),
      pushAnnotation, handleLeaderAnnotationTargetClick, commitLeaderAnnotationAt, commitTextAnnotationAt,
      changeSetting, preview, canFinish, finish, cancel, addLeader, removeLeader,
      get active() { return active(); }, get draft() { return active() ? getPending() : null; } });
  }
  window.AnnotationCommand = Object.freeze({ create });
})();

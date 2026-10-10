/* Own annotation drafts, leader conversion and atomic history boundaries. */
(() => {
  "use strict";
  function create({ currentScope, getPending, setPending, lastPointer, viewScale, nextAnnotationId,
    activeSketchId, canCreateInActiveSketch, rejectRootSketchCreation, annotationLeaderTargetFromHit,
    annotationLeaderAnchor = element => element.start, effectiveAnnotationStyle = element => window.Appearance.normalizeAnnotationStyle(element.style),
    annotationTextLayout, annotationLeaderDisplayGeometry, annotationTextMetrics, selectAnnotation = () => {},
    canEdit = () => true, prepare = () => {}, clearSelection, cancelPendingCommand,
    nextParameterName = () => "d1", validateParameter = () => ({ value: 0 }), commitParameter = () => {},
    applyStyle = (style, key, value) => { style[key] = value; }, parameterErrorText = error => error.message,
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
        withLeader, text: "", style: {}, visible: true, parameterEnabled: false, parameterName: nextParameterName(), expression: "0", pointer: lastPointer() || { x: 0, y: 0 } });
      updateUI(); refresh();
    }
    function changeSetting(key, value) {
      const draft = getPending();
      if (!active() || draft.editId) return;
      draft.error = "";
      if (["text", "parameterName", "expression"].includes(key)) draft[key] = String(value);
      if (key === "visible") draft.visible = Boolean(value);
      if (key === "parameterEnabled" && Boolean(value) !== draft.parameterEnabled) {
        if (value) draft.style.prefix = draft.text;
        else draft.text = draft.style.prefix || "";
        draft.parameterEnabled = Boolean(value);
      }
      if (key.startsWith("style.")) {
        const name = key.slice(6);
        if (["prefix", "suffix"].includes(name)) draft.style[name] = String(value);
        else if (name === "precision") draft.style.precision = value === "auto" ? null : Number(value);
        else applyStyle(draft.style, name, value, effectiveAnnotationStyle({ type: "text", sketchId: activeSketchId(), appearanceInheritance: true, style: draft.style }));
      }
      if (key === "withLeader" && Boolean(value) !== draft.withLeader) {
        lastWithLeader = Boolean(value);
        resetPlacement(draft, Boolean(value));
      }
      refresh();
    }
    function resetPlacement(draft, withLeader = draft.withLeader) {
      const next = { ...draft, withLeader, style: { ...draft.style }, type: withLeader ? "annotation-leader-select" : "annotation-text-place", pointer: lastPointer() || { x: 0, y: 0 } };
      for (const key of ["position", "leaderTarget", "elbow", "end"]) delete next[key];
      setPending(next);
    }
    function content() {
      const draft = getPending();
      const item = { type: draft.withLeader ? "leader" : "text", sketchId: activeSketchId(),
        text: draft.text, style: { ...draft.style }, visible: draft.visible !== false, appearanceInheritance: true, rotation: 0 };
      if (draft.parameterEnabled) {
        item.parameterEnabled = true; item.parameterName = draft.parameterName.trim();
        try { const result = validateParameter(draft); item.expression = result.expression; item.evaluatedParameterValue = result.value; }
        catch (error) { draft.error = parameterErrorText(error); }
      }
      return item;
    }
    function validContent() {
      const draft = getPending();
      if (draft.parameterEnabled) {
        try { validateParameter(draft); draft.error = ""; return true; }
        catch (error) { draft.error = parameterErrorText(error); return false; }
      }
      return draft.text.length > 0;
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
      if (draft.end) place();
      refresh(); return true;
    }
    function commitTextAnnotationAt(pointer) {
      if (!active() || getPending().type !== "annotation-text-place") return false;
      getPending().position = { ...pointer };
      place();
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
        const left = { x: metrics.bounds.x1 - metrics.fontSize / 2, y: metrics.bounds.y2 + gap };
        const right = { x: metrics.bounds.x2, y: left.y };
        const start = currentAnchor(draft.leaderTarget);
        const leftNear = Math.hypot(start.x - left.x, start.y - left.y) <= Math.hypot(start.x - right.x, start.y - right.y);
        const result = { ...source, type: "leader", appearanceInheritance: true, style: storedStyle, textPlacement: "text",
          start, elbow: leftNear ? left : right, end: leftNear ? right : left,
          geometryRef: draft.leaderTarget.geometryRef, attachment: draft.leaderTarget.attachment };
        result.shelfReferenceScale = referenceScale(result);
        return result;
      }
      const item = content();
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
      return true;
    }
    function place() {
      const draft = getPending();
      if (!active() || draft.editId || !validContent() || !(draft.withLeader ? draft.end : draft.position)) return false;
      const item = pushAnnotation(preview());
      if (!item) return false;
      if (item.parameterEnabled) commitParameter(item);
      lastWithLeader = draft.withLeader;
      clearSelection(); selectAnnotation(item); recordHistory("注記追加");
      resetPlacement({ ...draft, parameterName: nextParameterName(), error: "" });
      updateUI(); refresh(); return true;
    }
    function finish() {
      if (!canFinish()) return false;
      if (!getPending().editId) { setPending(null); updateUI(); refresh(); return true; }
      const draft = getPending(), value = preview();
      const item = currentScope().annotations.find(item => item.id === draft.editId);
      if (!item || !canEdit(item)) return false;
      Object.assign(item, value);
      setPending(null); clearSelection(); selectAnnotation(item);
      recordHistory("引出線追加");
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
      changeSetting, preview, canFinish, validContent, evaluatedValue: () => content().evaluatedParameterValue, finish, cancel, addLeader, removeLeader,
      get active() { return active(); }, get draft() { return active() ? getPending() : null; } });
  }
  window.AnnotationCommand = Object.freeze({ create });
})();

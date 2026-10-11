/* One-way annotation placement constraints; geometry remains read-only. */
(() => {
  "use strict";
  const POSITIONS = ["left-top", "center-top", "right-top", "left-middle", "center-middle", "right-middle", "left-bottom", "center-bottom", "right-bottom"];
  const LABELS = ["左上", "中上", "右上", "左中", "中中", "右中", "左下", "中下", "右下"];
  const axes = type => type === "horizontal" || type === "distance-y" ? ["y"] : type === "vertical" || type === "distance-x" ? ["x"] : ["x", "y"];
  function normalize(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && ["coincident", "horizontal", "vertical", "distance-x", "distance-y", "fixed"].includes(item.type) && (item.type === "fixed" || item.geometryRef?.kind === "point" && (!item.type.startsWith("distance-") || Number.isFinite(Number(item.value))))).map(item => ({
      type: item.type, ...(item.type === "fixed" ? { x: Number(item.x), y: Number(item.y) } : { geometryRef: window.GeometryRef.create("point", item.geometryRef?.path), value: Number(item.value) || 0 })
    })).filter(item => item.type === "fixed" ? Number.isFinite(item.x) && Number.isFinite(item.y) : Boolean(item.geometryRef));
  }
  const refs = element => [...(element.type === "leader" && element.geometryRef ? [element.geometryRef] : []), ...normalize(element.anchorConstraints).filter(item => item.geometryRef).map(item => item.geometryRef)];
  function resolve(element, base, resolveRef) {
    const items = normalize(element.anchorConstraints);
    if (!items.length) return base;
    const rotation = element.annotationTransformRotation || 0, cos = Math.cos(rotation), sin = Math.sin(rotation);
    const origin = element.annotationTransformOrigin || { x: 0, y: 0 };
    const local = p => ({ x: (p.x - origin.x) * cos + (p.y - origin.y) * sin, y: -(p.x - origin.x) * sin + (p.y - origin.y) * cos });
    const result = local(base);
    for (const item of items) {
      const target = item.type === "fixed" ? item : resolveRef(item.geometryRef);
      if (!target) continue;
      const point = item.type === "fixed" ? target : local(target);
      for (const axis of axes(item.type)) result[axis] = point[axis] + (item.type === `distance-${axis}` ? item.value : 0);
    }
    return { x: origin.x + result.x * cos - result.y * sin, y: origin.y + result.x * sin + result.y * cos };
  }
  function create({ getCommand, setCommand, selectedAnnotation, byId, canEdit, canReference, anchor, materialize,
    pointRef, resolveRef, recordHistory, updateUI, draw, setHint, cancelCommands, applicationText: t }) {
    let draft = null;
    function start(type, selected = selectedAnnotation()) {
      if (!selected || !canEdit(selected)) return false;
      if (!["coincident", "horizontal", "vertical", "distance", "fixed"].includes(type)) { setHint(t("注記基準点は一致・水平・垂直・距離・固定に対応します", "Annotation anchors support coincidence, horizontal, vertical, distance and fixed constraints."), "error"); return true; }
      cancelCommands();
      if (type === "fixed") {
        const base = anchor(selected);
        if ((selected.anchorConstraints || []).some(item => item.type === "fixed")) selected.anchorConstraints = selected.anchorConstraints.filter(item => item.type !== "fixed");
        else {
          if (selected.anchorConstraints?.length) { setHint(t("既存の基準点拘束を解除してから固定してください", "Remove anchor constraints before fixing the position."), "error"); return true; }
          materialize(selected); selected.anchorConstraints = [{ type: "fixed", x: base.x, y: base.y }];
        }
        recordHistory("注記基準点固定変更"); updateUI(); draw(); return true;
      }
      draft = { id: selected.id, type, axis: "x", value: 0, target: null };
      setCommand({ type, annotationAnchor: true }); updateUI(); draw(); return true;
    }
    function click(point) {
      if (!active()) return false;
      const item = byId(draft.id);
      if (!point || !canReference(item, point)) { setHint(t("所属Sketchまたは参照可能Sketchの点を指定してください", "Choose a point in the owning or a referenceable sketch."), "error"); return true; }
      draft.target = pointRef(point); updateUI(); draw(); return true;
    }
    function active() { return Boolean(draft && getCommand()?.annotationAnchor); }
    function finish() {
      const item = byId(draft?.id), target = resolveRef(draft?.target);
      if (!active() || !item || !canEdit(item) || !target || !canReference(item, target) || !Number.isFinite(Number(draft.value))) return false;
      const type = draft.type === "distance" ? `distance-${draft.axis}` : draft.type;
      const existing = normalize(item.anchorConstraints);
      if (existing.some(relation => axes(relation.type).some(axis => axes(type).includes(axis)))) {
        setHint(t("同じ方向の基準点拘束が既にあります。解除してから設定してください", "An anchor constraint already controls this axis. Remove it first."), "error"); return false;
      }
      materialize(item);
      item.anchorConstraints = [...existing, { type, geometryRef: draft.target, value: Number(draft.value) }];
      draft = null; setCommand(null); recordHistory("注記基準点拘束追加"); updateUI(); draw(); return true;
    }
    function cancel() { draft = null; setCommand(null); updateUI(); draw(); }
    function readState() {
      if (!active()) return null;
      return { id: "annotation-anchor-constraint", title: t("注記基準点の拘束", "Annotation anchor constraint"), step: t("参照する点をクリックし、完了してください", "Click the reference point and finish."),
        selections: [{ key: "target", label: t("参照点", "Reference point"), active: true, items: draft.target ? [{ key: window.GeometryRef.key(draft.target), label: window.GeometryRef.id(draft.target) }] : [] }],
        settings: draft.type === "distance" ? [{ key: "axis", label: t("方向", "Direction"), type: "select", value: draft.axis, options: [{ value: "x", label: t("水平距離", "Horizontal distance") }, { value: "y", label: t("垂直距離", "Vertical distance") }] }, { key: "value", label: t("基準点 − 参照点 (mm)", "Anchor − reference point (mm)"), type: "number", step: "any", value: draft.value }] : [],
        actions: [{ id: "finish", label: t("完了", "Finish"), disabled: !draft.target }, { id: "cancel", label: t("キャンセル", "Cancel") }] };
    }
    return Object.freeze({ start, click, readState, get active() { return active(); }, onAction: action => action === "finish" ? finish() : cancel(), onSetting: (key, value) => { if (active() && ["axis", "value"].includes(key)) { draft[key] = value; draw(); } }, onSelect: () => {}, reset: () => { draft = null; } });
  }
  window.AnnotationAnchorConstraints = Object.freeze({ POSITIONS, LABELS, normalize, resolve, axes, refs, create });
})();

/* One-way annotation placement constraints; geometry remains read-only. */
(() => {
  "use strict";
  const POSITIONS = ["left-top", "center-top", "right-top", "left-middle", "center-middle", "right-middle", "left-bottom", "center-bottom", "right-bottom"];
  const LABELS = ["左上", "中上", "右上", "左中", "中中", "右中", "左下", "中下", "右下"];
  const axes = type => type === "horizontal" || type === "distance-y" ? ["y"] : type === "vertical" || type === "distance-x" ? ["x"] : ["coincident", "concentric", "endpoint", "symmetry", "fixed"].includes(type) ? ["x", "y"] : [];
  const degree = type => axes(type).length || 1;
  const targetKinds = { coincident: ["point"], horizontal: ["point", "arc"], vertical: ["point", "arc"], "distance-x": ["point", "arc"], "distance-y": ["point", "arc"],
    "on-line": ["line"], "on-circle": ["circle", "arc"], "on-spline": ["spline"], concentric: ["circle", "arc"], endpoint: ["arc"], distance: ["point", "arc"], "distance-line": ["line"], symmetry: ["point", "arc"] };
  function normalize(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && (item.type === "fixed" || targetKinds[item.type]?.includes(item.geometryRef?.kind))
      && (!item.type.startsWith("distance") || Number.isFinite(Number(item.value)))
      && (!item.endpoint || item.geometryRef?.kind === "arc" && ["start", "end"].includes(item.endpoint))
      && (item.geometryRef?.kind !== "arc" || ["on-circle", "concentric"].includes(item.type) || ["start", "end"].includes(item.endpoint))
      && (item.type !== "symmetry" || item.axisRef?.kind === "line" && window.GeometryRef.create("line", item.axisRef.path))).map(item => ({
      type: item.type, ...(item.type === "fixed" ? { x: Number(item.x), y: Number(item.y) } : { geometryRef: window.GeometryRef.create(item.geometryRef.kind, item.geometryRef.path), value: Number(item.value) || 0,
        ...(item.endpoint ? { endpoint: item.endpoint } : {}), ...(item.axisRef ? { axisRef: window.GeometryRef.create("line", item.axisRef.path) } : {}),
        ...(item.type === "distance-line" ? { sign: item.sign === -1 ? -1 : 1 } : {}), ...(item.type === "on-spline" ? { parameter: Math.max(0, Math.min(1, Number(item.parameter) || 0)) } : {}) })
    })).filter(item => item.type === "fixed" ? Number.isFinite(item.x) && Number.isFinite(item.y) : Boolean(item.geometryRef) && (!item.type.startsWith("distance") || item.type.startsWith("distance-") && item.type !== "distance-line" || item.value >= 0));
  }
  const refs = element => [...(element.type === "leader" && element.geometryRef ? [element.geometryRef] : []), ...normalize(element.anchorConstraints).flatMap(item => [item.geometryRef, item.axisRef].filter(Boolean))];
  function solvePlacement(element, base, resolveRef, strict = false) {
    const items = normalize(element.anchorConstraints), G = window.GeometrySolver;
    const point = new G.Point("annotation-anchor", base.x, base.y), constraints = [], variables = [{ object: point, prop: "x" }, { object: point, prop: "y" }];
    const rotation = element.annotationTransformRotation || 0, cos = Math.cos(rotation), sin = Math.sin(rotation), origin = element.annotationTransformOrigin || { x: 0, y: 0 };
    const local = p => ({ x: (p.x - origin.x) * cos + (p.y - origin.y) * sin, y: -(p.x - origin.x) * sin + (p.y - origin.y) * cos });
    for (const item of items) {
      const target = item.type === "fixed" ? { x: origin.x + item.x * cos - item.y * sin, y: origin.y + item.x * sin + item.y * cos } : resolveRef(item.geometryRef);
      if (!target) return { point: base, valid: false };
      const reference = item.endpoint ? window.GeometryKernel.arcEndpointPoint(target, item.endpoint) : target;
      let relation;
      if (["coincident", "fixed", "endpoint"].includes(item.type)) relation = new G.CoincidentConstraint(point, reference);
      else if (["horizontal", "vertical", "distance-x", "distance-y"].includes(item.type)) {
        relation = new G.Constraint("annotation axis", 1);
        const axis = axes(item.type)[0], value = item.type.startsWith("distance-") ? item.value : 0;
        relation.rawError = () => local(point)[axis] - local(reference)[axis] - value;
      } else if (item.type === "concentric") relation = new G.CoincidentConstraint(point, target.center);
      else if (item.type === "on-line") relation = new G.PointOnLineConstraint(point, target);
      else if (item.type === "on-circle") relation = new G.PointOnCircleConstraint(point, target);
      else if (item.type === "distance") relation = new G.DistanceConstraint(point, reference, item.value);
      else if (item.type === "distance-line") relation = new G.PointLineDistanceConstraint(point, target, item.value, item.sign);
      else if (item.type === "on-spline") {
        const closest = window.SplineGeometry.closestPoint(target.curve(), point, { samplesPerSpan: 28 });
        if (!closest) return { point: base, valid: false };
        point.x = closest.point.x; point.y = closest.point.y;
        relation = new G.PointOnSplineConstraint(point, target, closest.t);
        variables.push({ object: relation, prop: "parameter", min: 0, max: 1 });
      } else if (item.type === "symmetry") {
        const axis = resolveRef(item.axisRef);
        if (!axis || axis.length() < 1e-8) return { point: base, valid: false };
        relation = new G.SymmetryConstraint(point, reference, axis);
      }
      if (!relation) return { point: base, valid: false };
      constraints.push(relation);
    }
    const solver = new G.ConstraintSolver({ points: [point], constraints, lines: [] });
    solver.maxIterations = 100;
    const result = solver.solveSubset({ variables, constraints });
    const valid = Number.isFinite(result.errorNorm) && result.errorNorm < 1e-6;
    const independent = !strict || solver.constraintRankState({ variables, constraints }).rank >= items.reduce((sum, item) => sum + degree(item.type), 0) + variables.length - 2;
    return { point: { x: point.x, y: point.y }, valid: valid && independent };
  }
  function resolve(element, base, resolveRef) {
    const items = normalize(element.anchorConstraints);
    if (!items.length) return base;
    if (items.some(item => !["coincident", "horizontal", "vertical", "distance-x", "distance-y", "fixed"].includes(item.type) || item.endpoint)) {
      const result = solvePlacement(element, base, resolveRef); return result.valid ? result.point : base;
    }
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
    function start(type, selected = selectedAnnotation(), targets = []) {
      if (!selected || !canEdit(selected)) return false;
      if (!["coincident", "pointOnCircle", "concentric", "horizontal", "vertical", "distance", "symmetry", "fixed"].includes(type)) { setHint(t("この拘束は点を対象にできません", "This constraint does not accept a point."), "error"); return true; }
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
      draft = { id: selected.id, type, axis: "x", value: 0, target: null, axisRef: null, endpoint: null };
      setCommand({ type, annotationAnchor: true }); updateUI(); draw();
      for (const target of targets) { if (!active()) break; click(target); }
      return true;
    }
    function click(operand) {
      if (!active()) return false;
      const item = byId(draft.id);
      const target = operand?.point || operand?.line || operand?.primitive || operand?.spline || operand?.arc || operand;
      const ref = target && pointRef(target), endpoint = operand?.kind === "arc-endpoint" ? operand.endpoint : null;
      if (!ref || !canReference(item, target)) { setHint(t("所属Sketchまたは参照可能Sketchの対象を指定してください", "Choose a target in the owning or a referenceable sketch."), "error"); return true; }
      if (draft.type === "symmetry" && ref.kind === "line") draft.axisRef = ref;
      else {
        const pointTarget = ref.kind === "point" || ref.kind === "arc" && endpoint;
        if ((["horizontal", "vertical", "symmetry"].includes(draft.type) && !pointTarget)
          || draft.type === "distance" && !pointTarget && ref.kind !== "line"
          || draft.type === "concentric" && !["circle", "arc"].includes(ref.kind)
          || draft.type === "pointOnCircle" && !["circle", "arc"].includes(ref.kind)) {
          setHint(t("この拘束の対象の組み合わせには対応していません", "This target combination is not supported by the constraint."), "error"); return true;
        }
        draft.target = ref; draft.endpoint = endpoint; draft.parameter = operand?.parameter || 0;
        if (draft.type === "distance") {
          const base = anchor(item), p = endpoint ? window.GeometryKernel.arcEndpointPoint(target, endpoint) : target;
          draft.axis = ref.kind === "line" ? "normal" : "length";
          const signed = ref.kind === "line" ? window.GeometryKernel.signedPointLineDistance(base, target) : Math.hypot(base.x - p.x, base.y - p.y);
          draft.value = Math.abs(signed); draft.sign = signed < 0 ? -1 : 1;
        }
      }
      updateUI(); draw();
      if (draft.type !== "distance" && draft.target && (draft.type !== "symmetry" || draft.axisRef)) finish();
      return true;
    }
    function active() { return Boolean(draft && getCommand()?.annotationAnchor); }
    function finish() {
      const item = byId(draft?.id), target = resolveRef(draft?.target);
      if (!active() || !item || !canEdit(item) || !target || !canReference(item, target) || !Number.isFinite(Number(draft.value))) return false;
      let type = draft.type;
      if (type === "distance") type = draft.axis === "length" ? "distance" : draft.axis === "normal" ? "distance-line" : `distance-${draft.axis}`;
      else if (type === "coincident") type = draft.endpoint ? "endpoint" : { point: "coincident", line: "on-line", circle: "on-circle", arc: "on-circle", spline: "on-spline" }[draft.target.kind];
      else if (type === "pointOnCircle") type = "on-circle";
      const existing = normalize(item.anchorConstraints);
      if (existing.reduce((sum, relation) => sum + degree(relation.type), 0) + degree(type) > 2 || existing.some(relation => axes(relation.type).some(axis => axes(type).includes(axis)))) {
        setHint(t("同じ方向の基準点拘束が既にあります。解除してから設定してください", "An anchor constraint already controls this axis. Remove it first."), "error"); return false;
      }
      const relation = { type, geometryRef: draft.target, value: Number(draft.value), ...(draft.endpoint ? { endpoint: draft.endpoint } : {}),
        ...(type === "symmetry" ? { axisRef: draft.axisRef } : {}), ...(type === "distance-line" ? { sign: draft.sign } : {}), ...(type === "on-spline" ? { parameter: draft.parameter } : {}) };
      if (normalize([relation]).length !== 1 || !solvePlacement({ ...item, anchorConstraints: [...existing, relation] }, anchor(item), resolveRef, true).valid) {
        setHint(t("基準点拘束が成立しません", "The anchor constraints cannot be satisfied."), "error"); return false;
      }
      materialize(item);
      item.anchorConstraints = [...existing, relation];
      draft = null; setCommand(null); recordHistory("注記基準点拘束追加"); updateUI(); draw(); return true;
    }
    function cancel() { draft = null; setCommand(null); updateUI(); draw(); }
    function readState() {
      if (!active()) return null;
      return { id: "annotation-anchor-constraint", title: t("注記基準点の拘束", "Annotation anchor constraint"), step: draft.type === "distance" ? t("参照対象と距離を指定し、完了してください", "Choose a target and distance, then finish.") : draft.type === "symmetry" ? t("相手の点と対称軸を指定してください", "Choose the other point and symmetry axis.") : t("参照対象を指定してください", "Choose the reference target."),
        selections: [{ key: "target", label: t("参照対象", "Reference target"), active: true, items: [draft.target, draft.axisRef].filter(Boolean).map(ref => ({ key: window.GeometryRef.key(ref), label: window.GeometryRef.id(ref) })) }],
        settings: draft.type === "distance" ? [{ key: "axis", label: t("方向", "Direction"), type: "select", value: draft.axis, options: draft.target?.kind === "line" ? [{ value: "normal", label: t("線への垂直距離", "Normal distance to line") }] : [{ value: "length", label: t("2点間距離", "Point-to-point distance") }, { value: "x", label: t("水平距離", "Horizontal distance") }, { value: "y", label: t("垂直距離", "Vertical distance") }] }, { key: "value", label: t("距離 (mm、水平・垂直は符号付き)", "Distance (mm, signed for X/Y)"), type: "number", step: "any", value: draft.value }] : [],
        actions: [{ id: "finish", label: t("完了", "Finish"), disabled: !draft.target || draft.type === "symmetry" && !draft.axisRef }, { id: "cancel", label: t("キャンセル", "Cancel") }] };
    }
    return Object.freeze({ start, click, readState, get active() { return active(); }, onAction: action => action === "finish" ? finish() : cancel(), onSetting: (key, value) => { if (active() && ["axis", "value"].includes(key)) { draft[key] = value; draw(); } }, onSelect: () => {}, reset: () => { draft = null; } });
  }
  window.AnnotationAnchorConstraints = Object.freeze({ POSITIONS, LABELS, normalize, resolve, solvePlacement, axes, degree, refs, create });
})();

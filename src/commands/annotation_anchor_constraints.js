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
        ...(item.type === "distance-line" ? { sign: item.sign === -1 ? -1 : 1 } : {}), ...(item.type === "on-spline" ? { parameter: Math.max(0, Math.min(1, Number(item.parameter) || 0)) } : {}),
        ...(item.type.startsWith("distance") && item.dimension && typeof item.dimension === "object" ? { dimension: JSON.parse(JSON.stringify(item.dimension)) } : {}) })
    })).filter(item => item.type === "fixed" ? Number.isFinite(item.x) && Number.isFinite(item.y) : Boolean(item.geometryRef) && (!item.type.startsWith("distance") || item.type.startsWith("distance-") && item.type !== "distance-line" || item.value >= 0));
  }
  const refs = element => [...(element.type === "leader" && element.geometryRef ? [element.geometryRef] : []), ...normalize(element.anchorConstraints).flatMap(item => [item.geometryRef, item.axisRef].filter(Boolean))];
  function solvePlacement(element, base, resolveRef, strict = false, collectOnly = false) {
    const items = normalize(element.anchorConstraints), G = window.GeometrySolver;
    const point = new G.Point("annotation-anchor:" + element.id, base.x, base.y), constraints = [], variables = [{ object: point, prop: "x" }, { object: point, prop: "y" }];
    const rotation = element.annotationTransformRotation || 0, cos = Math.cos(rotation), sin = Math.sin(rotation), origin = element.annotationTransformOrigin || { x: 0, y: 0 };
    const local = p => ({ x: (p.x - origin.x) * cos + (p.y - origin.y) * sin, y: -(p.x - origin.x) * sin + (p.y - origin.y) * cos });
    for (const item of items) {
      const target = item.type === "fixed" ? { x: origin.x + item.x * cos - item.y * sin, y: origin.y + item.x * sin + item.y * cos } : resolveRef(item.geometryRef);
      if (!target) return { point: base, valid: false };
      const reference = item.endpoint ? { get x() { return window.GeometryKernel.arcEndpointPoint(target, item.endpoint).x; }, get y() { return window.GeometryKernel.arcEndpointPoint(target, item.endpoint).y; } } : target;
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
      relation.sketchId = element.sketchId;
      relation.annotationGeometryNodes = [point, target, ...(item.axisRef ? [resolveRef(item.axisRef)] : [])];
      constraints.push(relation);
    }
    point.sketchId = element.sketchId;
    if (collectOnly) return { point, constraints, variables, valid: true };
    const solver = new G.ConstraintSolver({ points: [point], constraints, lines: [] });
    solver.maxIterations = 100;
    const result = solver.solveSubset({ variables, constraints });
    const valid = Number.isFinite(result.errorNorm) && result.errorNorm < 1e-6;
    const independent = !strict || solver.constraintRankState({ variables, constraints }).rank >= items.reduce((sum, item) => sum + degree(item.type), 0) + variables.length - 2;
    return { point: { x: point.x, y: point.y }, valid: valid && independent };
  }
  function createDragGeometry(element, base, resolveRef) { return solvePlacement(element, base, resolveRef, false, true); }
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
  function createDimensions({ annotations, anchor, resolveRef, defaultDimension, normalizeDimension, capturePosition, evaluateValue, applicationText = (ja, en) => ja }) {
    const cache = new WeakMap(), G = window.GeometrySolver;
    const pointAt = (id, read, sketchId) => {
      const point = new G.Point(id, 0, 0); point.sketchId = sketchId;
      Object.defineProperties(point, { x: { get: () => read()?.x || 0 }, y: { get: () => read()?.y || 0 } });
      return point;
    };
    function entries() {
      return annotations().flatMap(annotation => (annotation.anchorConstraints || []).filter(relation => relation.type.startsWith("distance")).map(relation => {
        const ref = () => resolveRef(relation.geometryRef);
        if (!ref()) return null;
        if (cache.has(relation)) return cache.get(relation);
        const point = pointAt(annotation.id + ".anchor", () => anchor(annotation), annotation.sketchId);
        const targetPoint = pointAt(window.GeometryRef.id(relation.geometryRef), () => relation.endpoint ? window.GeometryKernel.arcEndpointPoint(ref(), relation.endpoint) : ref(), ref().sketchId);
        const constraint = relation.type === "distance-line" ? new G.PointLineDistanceConstraint(point, ref(), relation.value, relation.sign)
          : relation.type === "distance" ? new G.DistanceConstraint(point, targetPoint, relation.value)
          : new G.PointAxisDistanceConstraint(point, targetPoint, Math.abs(relation.value), relation.type.endsWith("x") ? "x" : "y");
        constraint.sketchId = annotation.sketchId; constraint.annotationOwner = annotation; constraint.annotationRelation = relation;
        const label = relation.type === "distance-x" ? applicationText("水平距離", "Horizontal distance") : relation.type === "distance-y" ? applicationText("垂直距離", "Vertical distance") : relation.type === "distance-line" ? applicationText("線への距離", "Distance to line") : applicationText("距離", "Distance");
        constraint.name = applicationText("注記", "Annotation") + " " + annotation.id + " / " + label;
        if (relation.type === "distance-line") Object.defineProperty(constraint, "line", { get: ref });
        Object.defineProperties(constraint, {
          target: { get: () => Math.abs(relation.value), set: value => { relation.value = Number(value) * (relation.value < 0 ? -1 : 1); } },
          expression: { get: () => String(Math.abs(relation.value)), set: expression => {
            if (!setValue(constraint, evaluateValue(expression))) throw new Error("注記の距離拘束が成立しません");
          } },
          dimension: { get: () => relation.dimension, set: dimension => { relation.dimension = dimension; } },
        });
        relation.dimension = normalizeDimension(window.DimensionQueries.targetFromConstraint(constraint), relation.dimension || defaultDimension(window.DimensionQueries.targetFromConstraint(constraint)));
        cache.set(relation, constraint); return constraint;
      }).filter(Boolean));
    }
    function setValue(constraint, value) {
      const annotation = constraint.annotationOwner, relation = constraint.annotationRelation;
      if (!annotation?.anchorConstraints?.includes(relation) || !Number.isFinite(value) || value <= 0) return false;
      const next = { ...relation, value: value * (relation.value < 0 ? -1 : 1) };
      if (!solvePlacement({ ...annotation, anchorConstraints: annotation.anchorConstraints.map(item => item === relation ? next : item) }, anchor(annotation), resolveRef, true).valid) return false;
      relation.value = next.value; return true;
    }
    function remove(constraint) {
      const annotation = constraint.annotationOwner, relation = constraint.annotationRelation;
      if (!annotation?.anchorConstraints?.includes(relation)) return false;
      Object.assign(annotation, capturePosition(annotation));
      annotation.anchorConstraints = annotation.anchorConstraints.filter(item => item !== relation); return true;
    }
    return Object.freeze({ entries, setValue, remove });
  }
  function create({ getCommand, setCommand, selectedAnnotation, byId, canEdit, canReference, anchor, materialize,
    pointRef, resolveRef, recordHistory, updateUI, draw, setHint, cancelCommands, applicationText: t, startDistancePlacement = () => {} }) {
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
      setCommand({ type, annotationAnchor: true });
      setHint(t("拘束する相手の図形を指定してください。Escで終了します", "Choose the other geometry to constrain. Press Esc to cancel.")); updateUI(); draw();
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
      if (draft.type === "distance" && draft.target) {
        const base = anchor(item), point = new window.GeometrySolver.Point("annotation-anchor:" + item.id, base.x, base.y);
        point.sketchId = item.sketchId;
        const referenced = draft.endpoint ? window.GeometryKernel.arcEndpointPoint(target, draft.endpoint) : target;
        const dimensionTarget = ref.kind === "line" ? { kind: "point-line", point, line: target, value: draft.value } : { kind: "point-point", p1: point, p2: referenced, value: draft.value };
        startDistancePlacement({ target: { ...dimensionTarget, annotationAnchor: true }, sketchId: item.sketchId });
      } else if (draft.target && (draft.type !== "symmetry" || draft.axisRef)) finish();
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
        ...(draft.dimension ? { dimension: JSON.parse(JSON.stringify(draft.dimension)) } : {}),
        ...(type === "symmetry" ? { axisRef: draft.axisRef } : {}), ...(type === "distance-line" ? { sign: draft.sign } : {}), ...(type === "on-spline" ? { parameter: draft.parameter } : {}) };
      if (normalize([relation]).length !== 1 || !solvePlacement({ ...item, anchorConstraints: [...existing, relation] }, anchor(item), resolveRef, true).valid) {
        setHint(t("基準点拘束が成立しません", "The anchor constraints cannot be satisfied."), "error"); return false;
      }
      materialize(item);
      item.anchorConstraints = [...existing, relation];
      draft = null; setCommand(null); recordHistory("注記基準点拘束追加"); updateUI(); draw(); return true;
    }
    function cancel() { draft = null; setCommand(null); updateUI(); draw(); }
    function submitDistance(value, axis, dimension) {
      if (!active() || draft.type !== "distance" || !draft.target) return false;
      const item = byId(draft.id), target = resolveRef(draft.target);
      if (!item || !target) return false;
      draft.axis = draft.target.kind === "line" ? "normal" : axis || "length";
      const p = draft.endpoint ? window.GeometryKernel.arcEndpointPoint(target, draft.endpoint) : target;
      draft.dimension = dimension;
      draft.value = value;
      if (["x", "y"].includes(draft.axis)) draft.value *= anchor(item)[draft.axis] < p[draft.axis] ? -1 : 1;
      return finish();
    }
    return Object.freeze({ start, click, complete: finish, cancel, submitDistance, get active() { return active(); }, reset: () => { draft = null; } });
  }
  window.AnnotationAnchorConstraints = Object.freeze({ POSITIONS, LABELS, normalize, resolve, solvePlacement, createDragGeometry, createDimensions, axes, degree, refs, create });
})();

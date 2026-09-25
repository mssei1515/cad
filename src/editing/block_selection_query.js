/* Validate Block creation candidates and calculate their placement center. */
(() => {
  "use strict";
  function create({ currentScope, canvasSelection, blockProjectionBundle, elementSketchId, activeSketchId,
    constraintGraphNodes, serializeConstraint, constraintLabelForList, resolveGeometryRef,
    applicationText, mergeBounds, lineBBox, primitiveBBox, splineBBox, annotationBounds }) {
    const { Point, Line, Circle, Arc, Spline } = window.GeometrySolver;
    const { geometryKindForItem } = window.GeometryObjects;
    const { id: geometryRefId } = window.GeometryRef;
    const { boundaryGeometryRefs: hatchBoundaryGeometryRefs } = window.HatchRegionEngine;

    function blockSelectionGeometry() {
      const model = currentScope();
      const lines = canvasSelection.lines.filter((item) => !item.blockProjection);
      const circles = canvasSelection.circles.filter((item) => !item.blockProjection);
      const arcs = canvasSelection.arcs.filter((item) => !item.blockProjection);
      const splines = canvasSelection.splines.filter((item) => !item.blockProjection);
      const points = new Set(canvasSelection.points.filter((item) => !item.blockProjection));
      const blockInstances = canvasSelection.blockInstances.filter((instance) => model.blockInstances.includes(instance));
      const annotations = canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation));
      const hatches = canvasSelection.hatches.filter((hatch) => model.hatches.includes(hatch));
      for (const line of lines) {
        points.add(line.p1);
        points.add(line.p2);
      }
      for (const primitive of [...circles, ...arcs]) points.add(primitive.center);
      for (const spline of splines) for (const point of spline.fitPoints) points.add(point);
      const projectedGeometry = blockInstances.flatMap((instance) => {
        const bundle = blockProjectionBundle(instance);
        return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])];
      });
      const geometry = [...points, ...lines, ...circles, ...arcs, ...splines, ...blockInstances, ...projectedGeometry];
      if (lines.length + circles.length + arcs.length + splines.length + blockInstances.length + annotations.length + hatches.length === 0) return { error: applicationText("ブロック化する図形、ハッチングまたは注記を選択してください", "Select geometry, hatching, or annotations to create a block") };
      if (!geometry.every((item) => elementSketchId(item) === activeSketchId())) return { error: "アクティブスケッチ内の図形だけをブロック化できます" };
      if (!annotations.every((item) => item.sketchId === activeSketchId())) return { error: applicationText("アクティブスケッチ内の注記だけをブロック化できます", "Only annotations in the active sketch can be converted to a block") };
      if (!hatches.every((item) => item.sketchId === activeSketchId())) return { error: applicationText("アクティブスケッチ内のハッチングだけをブロック化できます", "Only hatching in the active sketch can be converted to a block") };
      const selectedSet = new Set(geometry);
      const selectedProjectionIds = new Set(projectedGeometry.map((item) => item.id));
      const isSelectedNode = (node) => selectedSet.has(node) || Boolean(node?.blockProjection && selectedProjectionIds.has(node.id));
      for (const point of points) {
        const shared = model.lines.some((line) => !selectedSet.has(line) && (line.p1 === point || line.p2 === point)) ||
          model.circles.some((circle) => !selectedSet.has(circle) && circle.center === point) ||
          model.arcs.some((arc) => !selectedSet.has(arc) && arc.center === point);
        const sharedBySpline = model.splines.some((spline) => !selectedSet.has(spline) && spline.fitPoints.includes(point));
        if (shared || sharedBySpline) return { error: `${point.id} は非選択図形と共有されています` };
      }
      const internalConstraints = [];
      const externalConstraints = [];
      for (const constraint of model.constraints) {
        const nodes = constraintGraphNodes(constraint).filter((node) => node instanceof Point || node instanceof Line || node instanceof Circle || node instanceof Arc || node instanceof Spline);
        if (!nodes.some(isSelectedNode)) continue;
        if (constraint.reference || nodes.some((node) => !isSelectedNode(node))) externalConstraints.push(constraint);
        else {
          if (!serializeConstraint(constraint)) return { error: `ブロック化で保持できない拘束があります: ${constraintLabelForList(constraint)}` };
          internalConstraints.push(constraint);
        }
      }
      for (const annotation of annotations) {
        if (annotation.type !== "leader") continue;
        const referenced = resolveGeometryRef(annotation.geometryRef);
        if (!referenced || !isSelectedNode(referenced)) return { error: applicationText(`注記 ${annotation.id} の参照先も選択してください`, `Also select the target referenced by annotation ${annotation.id}`) };
      }
      for (const annotation of model.annotations) {
        if (annotations.includes(annotation)) continue;
        const referenced = annotation.type === "leader" ? resolveGeometryRef(annotation.geometryRef) : null;
        if (referenced && isSelectedNode(referenced)) return { error: `注記 ${annotation.id} が選択図形を参照しています` };
      }
      const selectedBoundaryKeys = new Set([...lines, ...circles, ...arcs, ...splines].map((item) => `${geometryKindForItem(item)}:${item.id}`));
      for (const hatch of hatches) {
        const missing = hatchBoundaryGeometryRefs(hatch.boundaryLoops).filter((ref) => !selectedBoundaryKeys.has(`${ref.kind}:${geometryRefId(ref)}`));
        if (missing.length) return { error: applicationText(`ハッチング ${hatch.id} の境界 ${missing.map(geometryRefId).join("、")} も選択してください`, `Also select boundary ${missing.map(geometryRefId).join(", ")} for hatch ${hatch.id}`) };
      }
      for (const hatch of model.hatches) {
        if (hatches.includes(hatch)) continue;
        if (hatchBoundaryGeometryRefs(hatch.boundaryLoops).some((ref) => selectedBoundaryKeys.has(`${ref.kind}:${geometryRefId(ref)}`))) {
          return { error: applicationText(`ハッチング ${hatch.id} も選択してください`, `Also select hatch ${hatch.id}`) };
        }
      }
      return { points: [...points], lines, circles, arcs, splines, annotations, hatches, blockInstances, projectedGeometry, constraints: internalConstraints, externalConstraints };
    }

    function blockSelectionBoundsCenter(selection) {
      let bounds = null;
      for (const line of selection.lines || []) bounds = mergeBounds(bounds, lineBBox(line));
      for (const primitive of [...(selection.circles || []), ...(selection.arcs || [])]) bounds = mergeBounds(bounds, primitiveBBox(primitive));
      for (const spline of selection.splines || []) bounds = mergeBounds(bounds, splineBBox(spline));
      for (const annotation of selection.annotations || []) bounds = mergeBounds(bounds, annotationBounds(annotation));
      for (const instance of selection.blockInstances || []) {
        const bundle = blockProjectionBundle(instance);
        for (const line of bundle.lines) bounds = mergeBounds(bounds, lineBBox(line));
        for (const primitive of [...bundle.circles, ...bundle.arcs]) bounds = mergeBounds(bounds, primitiveBBox(primitive));
        for (const spline of bundle.splines || []) bounds = mergeBounds(bounds, splineBBox(spline));
        for (const point of bundle.points) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
        for (const annotation of bundle.annotations || []) bounds = mergeBounds(bounds, annotationBounds(annotation));
      }
      return bounds ? { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 } : { x: 0, y: 0 };
    }

    return Object.freeze({ read: blockSelectionGeometry, center: blockSelectionBoundsCenter });
  }
  window.BlockSelectionQuery = Object.freeze({ create });
})();

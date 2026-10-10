/* Build detached copied values from explicit scope and selection; no clipboard session or UI writes. */
(() => {
  "use strict";
  function create({ geometryInstanceBundle, geometryInstanceSourcePoints, serializeGeometryInstance, blockProjectionBundle, blockProjectionLocalId, resolveGeometryRef,
    constraintGraphNodes, serializeConstraint, applicationText }) {
    const { SketchProjectionConstraint, LineFixedConstraint, ArcEndpointFixedConstraint, GeometryFixedConstraint } = window.GeometrySolver;
    const { normalizeAppearance } = window.Appearance;
    const { geometryKindForItem } = window.GeometryObjects;
    const { id: geometryRefId } = window.GeometryRef;
    const { boundaryGeometryRefs: hatchBoundaryGeometryRefs } = window.HatchRegionEngine;
    const { serializeAnnotation } = window.AnnotationData;
    const { serializeHatch } = window.HatchData;
    const { serializeReferenceImage } = window.ReferenceImageData;
    function build(model, canvasSelection, parameterNamespaceKey = "document") {
      const points = new Set(canvasSelection.points.filter((point) => model.points.includes(point)));
      const lines = canvasSelection.lines.filter((line) => model.lines.includes(line));
      const circles = canvasSelection.circles.filter((circle) => model.circles.includes(circle));
      const arcs = canvasSelection.arcs.filter((arc) => model.arcs.includes(arc));
      const splines = canvasSelection.splines.filter((spline) => model.splines.includes(spline));
      const blockInstances = canvasSelection.blockInstances.filter((instance) => model.blockInstances.includes(instance));
      const geometryInstances = (canvasSelection.geometryInstances || []).filter(instance => (model.geometryInstances || []).includes(instance));
      const annotations = canvasSelection.annotations.filter((annotation) => model.annotations.includes(annotation));
      const hatches = canvasSelection.hatches.filter((hatch) => model.hatches.includes(hatch));
      const referenceImages = canvasSelection.referenceImages.filter(image => model.referenceImages.includes(image));
      const dependentPoints = new Set();
      for (const line of lines) {
        points.add(line.p1);
        points.add(line.p2);
        dependentPoints.add(line.p1);
        dependentPoints.add(line.p2);
      }
      for (const primitive of [...circles, ...arcs]) {
        points.add(primitive.center);
        dependentPoints.add(primitive.center);
      }
      for (const spline of splines) {
        for (const point of spline.fitPoints) {
          points.add(point);
          dependentPoints.add(point);
        }
      }
      if (points.size + lines.length + circles.length + arcs.length + splines.length + blockInstances.length + geometryInstances.length + annotations.length + hatches.length + referenceImages.length === 0) return { payload: null, error: null };

      const selectedNodes = new Set([...points, ...lines, ...circles, ...arcs, ...splines, ...blockInstances]);
      const selectedBlockProjectionIds = new Set();
      const blockProjectionData = new Map();
      for (const instance of blockInstances) {
        const bundle = blockProjectionBundle(instance);
        const projectedItems = [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])];
        for (const item of projectedItems) {
          selectedNodes.add(item);
          selectedBlockProjectionIds.add(item.id);
        }
        blockProjectionData.set(instance, {
          points: bundle.points.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
          lines: bundle.lines.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
          circles: bundle.circles.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
          arcs: bundle.arcs.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
          splines: (bundle.splines || []).map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
        });
      }
      const instanceProjectionData = new Map();
      for (const instance of geometryInstances) {
        const bundle = geometryInstanceBundle(instance);
        const projection = {};
        for (const kind of ['points', 'lines', 'circles', 'arcs', 'splines', 'hatches']) {
          projection[kind] = (bundle[kind] || []).map(item => {
            selectedNodes.add(item); selectedBlockProjectionIds.add(item.id);
            const sourceRef = window.GeometryObjects.geometryRefForItem(item.sourceElement);
            return { id: item.id, path: [instance.id, ...(instance.type === 'pattern' ? [String(item.occurrenceIndex)] : []), ...(sourceRef?.path || [item.sourceElement.id])] };
          });
        }
        instanceProjectionData.set(instance, projection);
      }
      for (const annotation of annotations) {
        if (annotation.type !== "leader") continue;
        const referenced = resolveGeometryRef(annotation.geometryRef);
        if (!referenced || (!selectedNodes.has(referenced) && !selectedBlockProjectionIds.has(referenced.id))) {
          return { payload: null, error: applicationText(`注記 ${annotation.id} の参照先も選択してください`, `Also select the target referenced by annotation ${annotation.id}`) };
        }
      }
      const selectedBoundaryKeys = new Set([...lines, ...circles, ...arcs, ...splines].map((item) => `${geometryKindForItem(item)}:${item.id}`));
      for (const instance of geometryInstances) {
        const bundle = geometryInstanceBundle(instance);
        for (const item of [...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])]) selectedBoundaryKeys.add(geometryKindForItem(item) + ':' + item.id);
      }
      for (const hatch of hatches) {
        const missing = hatchBoundaryGeometryRefs(hatch.boundaryLoops).filter((ref) => !selectedBoundaryKeys.has(`${ref.kind}:${geometryRefId(ref)}`));
        if (missing.length) {
          return { payload: null, error: applicationText(`塗りつぶし ${hatch.id} の境界 ${missing.map(geometryRefId).join("、")} も選択してください`, `Also select boundary ${missing.map(geometryRefId).join(", ")} for fill ${hatch.id}`) };
        }
      }

      const constraints = model.constraints.map((constraint) => {
        if (constraint instanceof SketchProjectionConstraint) return null;
        if (constraint instanceof LineFixedConstraint || constraint instanceof ArcEndpointFixedConstraint || constraint instanceof GeometryFixedConstraint) return null;
        const nodes = constraintGraphNodes(constraint, { includeIntrinsicDependencies: false });
        if (nodes.length === 0 || !nodes.every((node) => selectedNodes.has(node) || Boolean((node?.blockProjection || node?.derivedProjection) && selectedBlockProjectionIds.has(node.id)))) return null;
        return serializeConstraint(constraint);
      }).filter(Boolean);
      const orderedPoints = model.points.filter((point) => points.has(point));
      const payload = {
        pasteCount: 0,
        parameterNamespaceKey,
        cut: false,
        points: orderedPoints.map((point) => ({
          id: point.id,
          x: point.x,
          y: point.y,
          fixed: false,
          kind: dependentPoints.has(point) ? point.kind || "endpoint" : "explicit",
          appearance: normalizeAppearance(point.appearance),
        })),
        lines: lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, construction: Boolean(line.construction), appearance: normalizeAppearance(line.appearance) })),
        circles: circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), construction: Boolean(circle.construction), appearance: normalizeAppearance(circle.appearance) })),
        arcs: arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, construction: Boolean(arc.construction), appearance: normalizeAppearance(arc.appearance) })),
        splines: splines.map((spline) => ({ id: spline.id, fitPoints: spline.fitPoints.map((point) => point.id), closed: Boolean(spline.closed), construction: Boolean(spline.construction), appearance: normalizeAppearance(spline.appearance) })),
        constraints,
        blockInstances: blockInstances.map((instance) => ({
          id: instance.id,
          definitionId: instance.definitionId,
          x: instance.x,
          y: instance.y,
          rotation: instance.rotation,
          fixed: false,
          rotationLocked: Boolean(instance.rotationLocked),
          enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
          appearanceOverride: normalizeAppearance(instance.appearanceOverride),
          projection: blockProjectionData.get(instance),
        })),
        geometryInstances: geometryInstances.map(instance => ({ ...serializeGeometryInstance(instance), projection: instanceProjectionData.get(instance),
          sourcePositions: instance.type === 'free' ? instance.sources.map(ref => {
            const item = resolveGeometryRef(ref);
            return (geometryInstanceSourcePoints(item).length ? geometryInstanceSourcePoints(item) : item?.seed ? [item.seed] : []).map(point => ({ x: point.x, y: point.y }));
          }) : undefined,
        })),
        annotations: annotations.map(annotation => ({ ...serializeAnnotation(annotation), parameterValue: annotation.evaluatedParameterValue })),
        hatches: hatches.map(serializeHatch),
        referenceImages: referenceImages.map(serializeReferenceImage),
        selection: {
          points: canvasSelection.points.filter((point) => points.has(point)).map((point) => point.id),
          lines: lines.map((line) => line.id),
          circles: circles.map((circle) => circle.id),
          arcs: arcs.map((arc) => arc.id),
          splines: splines.map((spline) => spline.id),
          blockInstances: blockInstances.map((instance) => instance.id),
          geometryInstances: geometryInstances.map(instance => instance.id),
          annotations: annotations.map((annotation) => annotation.id),
          hatches: hatches.map((hatch) => hatch.id),
        },
      };
      return { payload, error: null };
    }
    return Object.freeze({ build });
  }
  window.ClipboardPayload = Object.freeze({ create });
})();

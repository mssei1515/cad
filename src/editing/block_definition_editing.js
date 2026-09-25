/* Block draft copying, coordinate translation and identity-preserving application. */
(() => {
  "use strict";
  function create({ normalizedSketchCopy, cloneConstraintForBlock, blockDefinitionById,
    createBlockProjectionBundle, geometryInstanceBundlesForScope, emptyGeometryInstanceBundle,
    normalizeGeometryInstance, hatchSequence }) {
    const { Point, Line, Circle, Arc, Spline, GeometryFixedConstraint, ArcEndpointFixedConstraint, LineFixedConstraint } = window.GeometrySolver;
    const { normalizeAppearance } = window.Appearance;
    const { normalizedDrawingOrder } = window.DrawingOrder;
    const { normalizeAnnotations, serializeAnnotation } = window.AnnotationData;
    const { normalizeHatches, serializeHatch } = window.HatchData;
    const { normalizeReferenceImages, serializeReferenceImage } = window.ReferenceImageData;
    const { serializeGeometryInstance } = window.DocumentSnapshot;
    const { addGeometryBundleToMaps } = window.GeometryObjects;
    const { nextSeq } = window.GeometryIds;
    function cloneBlockInstance(instance, offset = { x: 0, y: 0 }) {
      return {
        id: instance.id,
        definitionId: instance.definitionId,
        sketchId: instance.sketchId,
        drawingOrder: normalizedDrawingOrder(instance.drawingOrder),
        x: Number(instance.x) - (Number(offset.x) || 0),
        y: Number(instance.y) - (Number(offset.y) || 0),
        rotation: Number(instance.rotation) || 0,
        fixed: Boolean(instance.fixed),
        rotationLocked: Boolean(instance.rotationLocked),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
        appearanceOverride: normalizeAppearance(instance.appearanceOverride),
      };
    }

    function cloneBlockDefinition(definition) {
      const pointById = new Map();
      const points = definition.points.map((source) => {
        const point = new Point(source.id, source.x, source.y, source.fixed, source.kind || "endpoint");
        point.sketchId = source.sketchId;
        point.appearance = normalizeAppearance(source.appearance);
        pointById.set(point.id, point);
        return point;
      });
      const lineById = new Map();
      const lines = definition.lines.map((source) => {
        const line = new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
        line.sketchId = source.sketchId;
        line.drawingOrder = normalizedDrawingOrder(source.drawingOrder);
        line.appearance = normalizeAppearance(source.appearance);
        lineById.set(line.id, line);
        return line;
      });
      const primitiveById = new Map();
      const circles = definition.circles.map((source) => {
        const circle = new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
        circle.sketchId = source.sketchId;
        circle.drawingOrder = normalizedDrawingOrder(source.drawingOrder);
        circle.appearance = normalizeAppearance(source.appearance);
        primitiveById.set(circle.id, circle);
        return circle;
      });
      const arcs = definition.arcs.map((source) => {
        const arc = new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
        arc.sketchId = source.sketchId;
        arc.drawingOrder = normalizedDrawingOrder(source.drawingOrder);
        arc.appearance = normalizeAppearance(source.appearance);
        primitiveById.set(arc.id, arc);
        return arc;
      });
      const splines = (definition.splines || []).map((source) => {
        const spline = new Spline(source.id, source.fitPoints.map((point) => pointById.get(point.id)), source.closed, source.construction);
        spline.sketchId = source.sketchId;
        spline.drawingOrder = normalizedDrawingOrder(source.drawingOrder);
        spline.appearance = normalizeAppearance(source.appearance);
        primitiveById.set(spline.id, spline);
        return spline;
      });
      const blockInstances = (definition.blockInstances || []).map((instance) => cloneBlockInstance(instance));
      for (const instance of blockInstances) {
        const nestedDefinition = blockDefinitionById(instance.definitionId);
        if (nestedDefinition) addGeometryBundleToMaps(createBlockProjectionBundle(instance, nestedDefinition), pointById, lineById, primitiveById);
      }
      const geometryInstances = (definition.geometryInstances || []).map((instance, index) => normalizeGeometryInstance(serializeGeometryInstance(instance), (value) => String(value), index));
      const nestedBundles = blockInstances.map((instance) => {
        const nestedDefinition = blockDefinitionById(instance.definitionId);
        return nestedDefinition ? createBlockProjectionBundle(instance, nestedDefinition) : emptyGeometryInstanceBundle(instance);
      });
      for (const bundle of geometryInstanceBundlesForScope({ sketches: definition.sketches, points, lines, circles, arcs, splines, geometryInstances }, nestedBundles)) {
        addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById);
      }
      const constraints = definition.constraints.map((constraint) => cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, { x: 0, y: 0 }, true));
      return {
        id: definition.id,
        name: definition.name,
        parentDefinitionId: definition.parentDefinitionId || null,
        origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
        sketches: definition.sketches.map(normalizedSketchCopy),
        activeSketchId: definition.activeSketchId,
        points,
        lines,
        circles,
        arcs,
        splines,
        annotations: normalizeAnnotations(definition.annotations, definition.activeSketchId).map((annotation) => serializeAnnotation(annotation)),
        hatches: normalizeHatches(definition.hatches, definition.activeSketchId).map(serializeHatch),
        referenceImages: normalizeReferenceImages(definition.referenceImages, definition.activeSketchId).map(serializeReferenceImage),
        nextHatchIndex: Math.max(nextSeq(definition.hatches || [], "H"), Number(definition.nextHatchIndex) || 1),
        blockInstances,
        geometryInstances,
        constraints,
        parameters: (definition.parameters || []).map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
        nextDimensionParameterIndex: Math.max(1, Number(definition.nextDimensionParameterIndex) || 1),
        revision: Number(definition.revision) || 0,
      };
    }

    function translateBlockDefinition(definition, dx, dy) {
      for (const point of definition.points) {
        point.x += dx;
        point.y += dy;
      }
      for (const constraint of definition.constraints) {
        if (constraint instanceof GeometryFixedConstraint || constraint instanceof ArcEndpointFixedConstraint) {
          constraint.x += dx;
          constraint.y += dy;
        } else if (constraint instanceof LineFixedConstraint) {
          constraint.p1x += dx;
          constraint.p2x += dx;
          constraint.p1y += dy;
          constraint.p2y += dy;
        }
        const dimension = constraint.dimension;
        if (!dimension) continue;
        for (const key of ["x", "labelX"]) if (Number.isFinite(Number(dimension[key]))) dimension[key] = Number(dimension[key]) + dx;
        for (const key of ["y", "labelY"]) if (Number.isFinite(Number(dimension[key]))) dimension[key] = Number(dimension[key]) + dy;
      }
      for (const instance of definition.blockInstances || []) {
        instance.x += dx;
        instance.y += dy;
      }
      for (const instance of definition.geometryInstances || []) {
        if (instance.type !== "free") continue;
        instance.x += dx;
        instance.y += dy;
        instance.origin.x += dx;
        instance.origin.y += dy;
      }
      for (const annotation of definition.annotations || []) {
        annotation.x += dx;
        annotation.y += dy;
        for (const key of ["start", "elbow", "end"]) if (annotation[key]) annotation[key] = { x: annotation[key].x + dx, y: annotation[key].y + dy };
      }
      for (const hatch of definition.hatches || []) {
        hatch.seed.x += dx;
        hatch.seed.y += dy;
      }
      for (const image of definition.referenceImages || []) {
        image.x += dx;
        image.y += dy;
      }
    }

    function mergeBlockDefinitionDraft(target, draft) {
      const pointById = new Map();
      const oldPoints = new Map(target.points.map((point) => [point.id, point]));
      const points = draft.points.map((source) => {
        const point = oldPoints.get(source.id) || new Point(source.id, source.x, source.y, source.fixed, source.kind || "endpoint");
        point.x = source.x;
        point.y = source.y;
        point.fixed = source.fixed;
        point.kind = source.kind;
        point.sketchId = source.sketchId;
        point.appearance = normalizeAppearance(source.appearance);
        pointById.set(point.id, point);
        return point;
      });
      const oldLines = new Map(target.lines.map((line) => [line.id, line]));
      const lineById = new Map();
      const lines = draft.lines.map((source) => {
        const line = oldLines.get(source.id) || new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
        line.p1 = pointById.get(source.p1.id);
        line.p2 = pointById.get(source.p2.id);
        line.construction = source.construction;
        line.sketchId = source.sketchId;
        line.appearance = normalizeAppearance(source.appearance);
        lineById.set(line.id, line);
        return line;
      });
      const primitiveById = new Map();
      const oldCircles = new Map(target.circles.map((circle) => [circle.id, circle]));
      const circles = draft.circles.map((source) => {
        const circle = oldCircles.get(source.id) || new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
        circle.center = pointById.get(source.center.id);
        circle.radiusValue = source.radius();
        circle.construction = source.construction;
        circle.sketchId = source.sketchId;
        circle.appearance = normalizeAppearance(source.appearance);
        primitiveById.set(circle.id, circle);
        return circle;
      });
      const oldArcs = new Map(target.arcs.map((arc) => [arc.id, arc]));
      const arcs = draft.arcs.map((source) => {
        const arc = oldArcs.get(source.id) || new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
        arc.center = pointById.get(source.center.id);
        arc.radiusValue = source.radius();
        arc.startAngle = source.startAngle;
        arc.endAngle = source.endAngle;
        arc.construction = source.construction;
        arc.sketchId = source.sketchId;
        arc.appearance = normalizeAppearance(source.appearance);
        primitiveById.set(arc.id, arc);
        return arc;
      });
      const oldSplines = new Map((target.splines || []).map((spline) => [spline.id, spline]));
      const splines = (draft.splines || []).map((source) => {
        const spline = oldSplines.get(source.id) || new Spline(source.id, [], source.closed, source.construction);
        spline.fitPoints = source.fitPoints.map((point) => pointById.get(point.id)).filter(Boolean);
        spline.closed = Boolean(source.closed);
        spline.construction = Boolean(source.construction);
        spline.sketchId = source.sketchId;
        spline.appearance = normalizeAppearance(source.appearance);
        primitiveById.set(spline.id, spline);
        spline._curveCache = null;
        return spline;
      });
      const oldBlockInstances = new Map((target.blockInstances || []).map((instance) => [instance.id, instance]));
      const blockInstances = (draft.blockInstances || []).map((source) => {
        const instance = oldBlockInstances.get(source.id) || cloneBlockInstance(source);
        instance.definitionId = source.definitionId;
        instance.sketchId = source.sketchId;
        instance.x = Number(source.x) || 0;
        instance.y = Number(source.y) || 0;
        instance.rotation = Number(source.rotation) || 0;
        instance.fixed = Boolean(source.fixed);
        instance.rotationLocked = Boolean(source.rotationLocked);
        instance.enabledSketchIds = Array.isArray(source.enabledSketchIds) ? source.enabledSketchIds.slice() : [];
        instance.appearanceOverride = normalizeAppearance(source.appearanceOverride);
        return instance;
      });
      for (const instance of blockInstances) {
        const nestedDefinition = blockDefinitionById(instance.definitionId);
        if (nestedDefinition) addGeometryBundleToMaps(createBlockProjectionBundle(instance, nestedDefinition), pointById, lineById, primitiveById);
      }
      const constraints = draft.constraints.map((constraint) => cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, { x: 0, y: 0 }, true));
      target.name = draft.name;
      target.parentDefinitionId = draft.parentDefinitionId || null;
      target.origin = { ...draft.origin };
      target.sketches = draft.sketches.map(normalizedSketchCopy);
      target.activeSketchId = draft.activeSketchId;
      target.points = points;
      target.lines = lines;
      target.circles = circles;
      target.arcs = arcs;
      target.splines = splines;
      target.annotations = normalizeAnnotations(draft.annotations, draft.activeSketchId).map((annotation) => serializeAnnotation(annotation));
      target.hatches = normalizeHatches(draft.hatches, draft.activeSketchId).map(serializeHatch);
      target.referenceImages = normalizeReferenceImages(draft.referenceImages, draft.activeSketchId).map(serializeReferenceImage);
      target.nextHatchIndex = Math.max(hatchSequence(), Number(draft.nextHatchIndex) || 1, nextSeq(target.hatches, "H"));
      target.blockInstances = blockInstances;
      target.geometryInstances = (draft.geometryInstances || []).map((instance, index) => normalizeGeometryInstance(serializeGeometryInstance(instance), (value) => String(value), index));
      target.constraints = constraints;
      target.parameters = (draft.parameters || []).map((parameter) => ({ name: parameter.name, expression: parameter.expression }));
      target.nextDimensionParameterIndex = Math.max(1, Number(draft.nextDimensionParameterIndex) || 1);
      target.revision = (Number(target.revision) || 0) + 1;
      return target;
    }
    return Object.freeze({ clone: cloneBlockDefinition, cloneInstance: cloneBlockInstance,
      translate: translateBlockDefinition, apply: mergeBlockDefinitionDraft });
  }
  window.BlockDefinitionEditing = Object.freeze({ create });
})();

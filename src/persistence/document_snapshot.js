/* Document snapshot fields. UI ownership and constraint placement enter through two read adapters. */
(function () {
  "use strict";
  const { normalizeAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance } = window.Appearance;
  const { normalizedDrawingOrder } = window.DrawingOrder;
  const { normalizeAnnotations, serializeAnnotation } = window.AnnotationData;
  const { normalizeHatches, serializeHatch } = window.HatchData;
  const { normalizeReferenceImages, serializeReferenceImage } = window.ReferenceImageData;

  function serializeGeometryInstance(instance) {
    const data = {
      id: instance.id,
      type: instance.type,
      sketchId: instance.sketchId,
      drawingOrder: normalizedDrawingOrder(instance.drawingOrder) ?? 0,
      sources: instance.sources.map((ref) => ({ kind: ref.kind, path: [...ref.path] })),
      appearanceOverride: normalizeAppearance(instance.appearanceOverride),
    };
    if (instance.type === "free") Object.assign(data, {
      x: instance.x, y: instance.y, rotation: instance.rotation, origin: { ...instance.origin },
      mirrorX: instance.mirrorX, mirrorY: instance.mirrorY,
    });
    if (instance.type === "mirror") data.axis = instance.axis ? { kind: "line", path: [...instance.axis.path] } : null;
    if (instance.type === "pattern") {
      data.direction = instance.direction ? { kind: "line", path: [...instance.direction.path] } : null;
      data.spacing = instance.spacing;
      data.copies = instance.copies;
      data.reversed = Boolean(instance.reversed);
    }
    if (instance.legacyOutput) data.legacyOutput = { ...instance.legacyOutput, pointIds: [...(instance.legacyOutput.pointIds || [])] };
    return data;
  }

  function serializeBlockInstance(instance) {
    return {
      id: instance.id, definitionId: instance.definitionId, sketchId: instance.sketchId,
      drawingOrder: normalizedDrawingOrder(instance.drawingOrder) ?? 0,
      x: instance.x, y: instance.y, rotation: instance.rotation,
      fixed: Boolean(instance.fixed), rotationLocked: Boolean(instance.rotationLocked),
      enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
      appearanceOverride: normalizeAppearance(instance.appearanceOverride),
    };
  }

  function serializeSketch(sketch) {
    return {
      id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId || null,
      kind: sketch.kind === "root" ? "root" : "sketch",
      appearance: normalizeAppearance(sketch.appearance),
      constructionAppearance: normalizeConstructionAppearance(sketch.constructionAppearance),
      dimensionAppearance: normalizeDimensionAppearance(sketch.dimensionAppearance),
    };
  }

  function serializeGeometry(scope, metadata) {
    const common = (item) => ({
      construction: Boolean(item.construction), sketchId: metadata(item).sketchId,
      drawingOrder: normalizedDrawingOrder(item.drawingOrder) ?? 0,
      appearance: normalizeAppearance(item.appearance),
    });
    return {
      points: scope.points.map((point) => {
        const values = metadata(point);
        return { id: point.id, x: point.x, y: point.y, fixed: point.fixed,
          kind: point.kind || values.kind, sketchId: values.sketchId, appearance: normalizeAppearance(point.appearance) };
      }),
      lines: scope.lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, ...common(line) })),
      circles: scope.circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), ...common(circle) })),
      arcs: scope.arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, ...common(arc) })),
      splines: (scope.splines || []).map((spline) => ({ id: spline.id, definitionMode: "fit", degree: 3,
        fitPoints: spline.fitPoints.map((point) => point.id), closed: Boolean(spline.closed), endCondition: "natural", ...common(spline) })),
    };
  }

  const serializeParameter = (parameter) => ({ name: parameter.name, expression: parameter.expression });
  const localGeometryMetadata = (item) => ({ sketchId: item.sketchId, kind: "endpoint" });

  function create({ geometryMetadata, constraintData }) {
    function constraints(scope) {
      return scope.constraints.map((constraint) => constraintData(constraint, scope)).filter(Boolean);
    }

    function serializeDefinition(definition) {
      return {
        id: definition.id, name: definition.name, parentDefinitionId: definition.parentDefinitionId || null,
        revision: Number(definition.revision) || 0,
        origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
        sketches: definition.sketches.map(serializeSketch), activeSketchId: definition.activeSketchId,
        parameters: (definition.parameters || []).map(serializeParameter),
        nextDimensionParameterIndex: Math.max(1, Number(definition.nextDimensionParameterIndex) || 1),
        ...serializeGeometry(definition, localGeometryMetadata),
        annotations: normalizeAnnotations(definition.annotations, definition.activeSketchId).map(serializeAnnotation),
        hatches: normalizeHatches(definition.hatches, definition.activeSketchId).map(serializeHatch),
        referenceImages: normalizeReferenceImages(definition.referenceImages, definition.activeSketchId).map(serializeReferenceImage),
        nextHatchIndex: Math.max((definition.hatches || []).reduce((max, hatch) => {
          const match = /^H(\d+)$/.exec(String(hatch.id));
          return match ? Math.max(max, Number(match[1])) : max;
        }, 0) + 1, Number(definition.nextHatchIndex) || 1),
        blockInstances: (definition.blockInstances || []).map(serializeBlockInstance),
        geometryInstances: (definition.geometryInstances || []).map(serializeGeometryInstance),
        constraints: constraints(definition),
      };
    }

    function serialize(scope, { version, savedAt, documentName, nextHatchIndex }) {
      return {
        version, savedAt, documentName, units: { ...scope.units },
        defaultAppearance: normalizeAppearance(scope.defaultAppearance, { partial: false }),
        defaultConstructionAppearance: normalizeConstructionAppearance(scope.defaultConstructionAppearance, { partial: false }),
        defaultDimensionAppearance: normalizeDimensionAppearance(scope.defaultDimensionAppearance, { partial: false }),
        sketches: scope.sketches.map(serializeSketch), activeSketchId: scope.activeSketchId,
        annotations: normalizeAnnotations(scope.annotations).map(serializeAnnotation),
        hatches: normalizeHatches(scope.hatches).map(serializeHatch),
        referenceImages: normalizeReferenceImages(scope.referenceImages).map(serializeReferenceImage),
        nextHatchIndex: Math.max(nextHatchIndex, Number(scope.nextHatchIndex) || 1),
        parameters: scope.parameters.map(serializeParameter), nextDimensionParameterIndex: scope.nextDimensionParameterIndex,
        blockDefinitions: scope.blockDefinitions.map(serializeDefinition),
        blockInstances: scope.blockInstances.map(serializeBlockInstance),
        geometryInstances: scope.geometryInstances.map(serializeGeometryInstance),
        ...serializeGeometry(scope, geometryMetadata), constraints: constraints(scope),
      };
    }
    return Object.freeze({ serialize });
  }

  window.DocumentSnapshot = Object.freeze({ create, serializeGeometryInstance });
})();

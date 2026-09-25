/* Block undo snapshots: detached restoration data and the existing change signature. */
(() => {
  "use strict";
  function create({ cloneDefinition, serializeConstraint, decorateSerializedConstraint }) {
    const { normalizedDrawingOrder } = window.DrawingOrder;
    const { normalizeAnnotations, serializeAnnotation } = window.AnnotationData;
    const { normalizeHatches, serializeHatch } = window.HatchData;
    const { normalizeReferenceImages, serializeReferenceImage } = window.ReferenceImageData;
    const { serializeGeometryInstance } = window.DocumentSnapshot;
    const { nextSeq } = window.GeometryIds;
    function blockEditorHistoryData(definition) {
      return {
        id: definition.id,
        name: definition.name,
        parentDefinitionId: definition.parentDefinitionId || null,
        origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
        sketches: definition.sketches.map((sketch) => ({ ...sketch })),
        activeSketchId: definition.activeSketchId,
        parameters: (definition.parameters || []).map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
        nextDimensionParameterIndex: Math.max(1, Number(definition.nextDimensionParameterIndex) || 1),
        points: definition.points.map((point) => ({ id: point.id, x: point.x, y: point.y, fixed: point.fixed, kind: point.kind, sketchId: point.sketchId })),
        lines: definition.lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, construction: Boolean(line.construction), sketchId: line.sketchId, drawingOrder: normalizedDrawingOrder(line.drawingOrder) ?? 0 })),
        circles: definition.circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), construction: Boolean(circle.construction), sketchId: circle.sketchId, drawingOrder: normalizedDrawingOrder(circle.drawingOrder) ?? 0 })),
        arcs: definition.arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, construction: Boolean(arc.construction), sketchId: arc.sketchId, drawingOrder: normalizedDrawingOrder(arc.drawingOrder) ?? 0 })),
        splines: (definition.splines || []).map((spline) => ({ id: spline.id, definitionMode: "fit", degree: 3, fitPoints: spline.fitPoints.map((point) => point.id), closed: Boolean(spline.closed), endCondition: "natural", construction: Boolean(spline.construction), sketchId: spline.sketchId, drawingOrder: normalizedDrawingOrder(spline.drawingOrder) ?? 0 })),
        annotations: normalizeAnnotations(definition.annotations, definition.activeSketchId).map(serializeAnnotation),
        hatches: normalizeHatches(definition.hatches, definition.activeSketchId).map(serializeHatch),
        referenceImages: normalizeReferenceImages(definition.referenceImages, definition.activeSketchId).map(serializeReferenceImage),
        nextHatchIndex: Math.max(nextSeq(definition.hatches || [], "H"), Number(definition.nextHatchIndex) || 1),
        blockInstances: (definition.blockInstances || []).map((instance) => ({
          id: instance.id,
          definitionId: instance.definitionId,
          sketchId: instance.sketchId,
          drawingOrder: normalizedDrawingOrder(instance.drawingOrder) ?? 0,
          x: instance.x,
          y: instance.y,
          rotation: instance.rotation,
          fixed: Boolean(instance.fixed),
          rotationLocked: Boolean(instance.rotationLocked),
          enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
        })),
        geometryInstances: (definition.geometryInstances || []).map(serializeGeometryInstance),
        constraints: definition.constraints.map((constraint) => {
          const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
          if (!data) return null;
          data.sketchId = constraint.sketchId;
          if (constraint.reference) {
            data.reference = true;
            data.referenceSketchId = constraint.referenceSketchId || null;
          }
          return data;
        }).filter(Boolean),
      };
    }
    function capture(source) {
      const definition = cloneDefinition(source);
      return { definition, signature: JSON.stringify(blockEditorHistoryData(definition)) };
    }
    return Object.freeze({ capture });
  }
  window.BlockHistorySnapshot = Object.freeze({ create });
})();

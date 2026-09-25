(() => {
  "use strict";

  function translateFixedConstraintValues(data, dx, dy) {
    if (data.type === "arcEndpointFixed" || data.type === "geometryFixed") {
      data.x += dx;
      data.y += dy;
    } else if (data.type === "lineFixed") {
      data.p1x += dx;
      data.p2x += dx;
      data.p1y += dy;
      data.p2y += dy;
    }
  }

  function create({ catalog, projections, geometryInstanceBundlesForScope,
    serializeConstraint, decorateSerializedConstraint, deserializeConstraint, applicationText }) {
    const { addGeometryBundleToMaps } = window.GeometryObjects;
    const { DEFAULT_SKETCH_ID } = window.SketchHierarchy;
    function cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, origin = { x: 0, y: 0 }, preserveReference = false) {
      const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
      if (!data) throw new Error("未対応の内部拘束があります");
      if (data.dimension) {
        data.dimension = { ...data.dimension };
        for (const key of ["x", "labelX"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) - origin.x;
        for (const key of ["y", "labelY"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) - origin.y;
      }
      translateFixedConstraintValues(data, -origin.x, -origin.y);
      const cloned = deserializeConstraint(data, pointById, lineById, primitiveById);
      if (!cloned) throw new Error("内部拘束を複製できません");
      cloned.sketchId = constraint.sketchId || DEFAULT_SKETCH_ID;
      cloned.reference = preserveReference && Boolean(constraint.reference);
      cloned.referenceSketchId = cloned.reference ? constraint.referenceSketchId || null : null;
      return cloned;
    }
    function rebuildBlockDefinitionConstraintObjects(definition) {
      const pointById = new Map(definition.points.map((point) => [point.id, point]));
      const lineById = new Map(definition.lines.map((line) => [line.id, line]));
      const primitiveById = new Map([...definition.circles, ...definition.arcs, ...(definition.splines || [])].map((primitive) => [primitive.id, primitive]));
      const nestedBundles = [];
      for (const instance of definition.blockInstances || []) {
        const nestedDefinition = catalog.blockDefinitionById(instance.definitionId);
        if (!nestedDefinition) continue;
        const bundle = projections.createBlockProjectionBundle(instance, nestedDefinition);
        nestedBundles.push(bundle);
        addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById);
      }
      for (const bundle of geometryInstanceBundlesForScope(definition, nestedBundles)) addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById);
      let removed = 0;
      const constraints = [];
      for (const source of definition.constraints || []) {
        const data = decorateSerializedConstraint(serializeConstraint(source), source);
        let constraint = null;
        try {
          constraint = data ? deserializeConstraint(data, pointById, lineById, primitiveById) : null;
        } catch (_error) {
          constraint = null;
        }
        if (!constraint) {
          removed += 1;
          continue;
        }
        constraint.sketchId = source.sketchId;
        constraint.reference = Boolean(source.reference);
        constraint.referenceSketchId = source.referenceSketchId || null;
        constraints.push(constraint);
      }
      definition.constraints = constraints;
      return removed;
    }

    function rebuildDocument(model, bundles) {
      const pointById = new Map(model.points.map((point) => [point.id, point]));
      const lineById = new Map(model.lines.map((line) => [line.id, line]));
      const primitiveById = new Map([...model.circles, ...model.arcs, ...model.splines].map((primitive) => [primitive.id, primitive]));
      for (const bundle of bundles) addGeometryBundleToMaps(bundle, pointById, lineById, primitiveById);
      model.constraints = model.constraints.map((source) => {
        const data = decorateSerializedConstraint(serializeConstraint(source), source);
        const constraint = data ? deserializeConstraint(data, pointById, lineById, primitiveById) : null;
        if (!constraint) throw new Error(applicationText("Document拘束を再構築できません", "Document constraints could not be rebuilt"));
        constraint.sketchId = source.sketchId;
        constraint.reference = Boolean(source.reference);
        constraint.referenceSketchId = source.referenceSketchId || null;
        return constraint;
      });
    }

    return Object.freeze({ rebuildDefinition: rebuildBlockDefinitionConstraintObjects, rebuildDocument, cloneForBlock: cloneConstraintForBlock });
  }
  window.ConstraintRebinding = Object.freeze({ create, translateFixedValues: translateFixedConstraintValues });
})();

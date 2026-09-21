(() => {
  "use strict";

  function create({ catalog, projections, geometryInstanceBundlesForScope,
    serializeConstraint, decorateSerializedConstraint, deserializeConstraint, applicationText }) {
    const { addGeometryBundleToMaps } = window.GeometryObjects;
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

    return Object.freeze({ rebuildDefinition: rebuildBlockDefinitionConstraintObjects, rebuildDocument });
  }
  window.ConstraintRebinding = Object.freeze({ create });
})();

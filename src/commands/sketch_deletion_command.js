/* Validate and apply Sketch deletion as one user operation. */
(() => {
  "use strict";
  function create({ currentScope, ensureSketchState, sketchById, descendantSketchIds, constraintSketchId,
    geometryInstanceDependencyRefs, resolveGeometryRef, elementSketchId, rejectReferencedGeometryDeletion,
    sketchName, setHint, log, blockAllProjectionBundle, geometryElementKey, constraintGraphNodes,
    guardDimensionSymbolDeletion, invalidateBlockProjectionCache, annotationReferencesRemovedGeometry,
    clearSketchSolveState, clearInteractionForSketchChange, invalidateAnalysis, solveSketchAndDependents,
    activeSketchId, refreshConstraintAnalysis, updateUI, draw, recordHistory, confirmDeletion }) {
    const { ROOT_SKETCH_ID, isRootSketch } = window.SketchHierarchy;
    const { SketchProjectionConstraint } = window.GeometrySolver;
    function deleteSketch(sketchId, confirmFirst = true) {
      ensureSketchState();
      const model = currentScope();
      const sketch = sketchById(sketchId);
      if (!sketch || isRootSketch(sketch)) return false;
  
      const descendants = descendantSketchIds(sketch.id);
      const preserveDescendants = model.constraints.some((constraint) =>
        constraint instanceof SketchProjectionConstraint
        && constraint.referenceSketchId === sketch.id
        && descendants.includes(constraintSketchId(constraint)));
      const sketchIds = new Set(preserveDescendants ? [sketch.id] : [sketch.id, ...descendants]);
      const geometryInstancesToRemove = model.geometryInstances.filter((instance) => sketchIds.has(instance.sketchId));
      const externallyDependentInstances = model.geometryInstances.filter((instance) => !geometryInstancesToRemove.includes(instance) && geometryInstanceDependencyRefs(instance).some((ref) => {
        const referenced = resolveGeometryRef(ref);
        return referenced && sketchIds.has(elementSketchId(referenced));
      }));
      if (rejectReferencedGeometryDeletion(externallyDependentInstances, sketch.name)) return false;
      const externalReferences = model.constraints.filter((constraint) => {
        if (constraint instanceof SketchProjectionConstraint) return false;
        if (!constraint.reference || !sketchIds.has(constraint.referenceSketchId)) return false;
        return !sketchIds.has(constraintSketchId(constraint));
      });
      if (externalReferences.length > 0) {
        const owners = new Map();
        for (const constraint of externalReferences) {
          const ownerId = constraintSketchId(constraint);
          owners.set(ownerId, (owners.get(ownerId) || 0) + 1);
        }
        const ownerText = [...owners.entries()].map(([ownerId, count]) => `${sketchName(ownerId)} ${count}件`).join("、");
        const msg = `削除できません: ${sketch.name} またはその子孫が ${ownerText} から参照されています`;
        setHint(msg, "error");
        log(msg);
        return false;
      }
      const blockInstancesToRemove = model.blockInstances.filter((instance) => sketchIds.has(instance.sketchId));
      const blockProjectionItemsToRemove = blockInstancesToRemove.flatMap((instance) => {
        const bundle = blockAllProjectionBundle(instance);
        return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])];
      });
      const geometryCount = [...model.points, ...model.lines, ...model.circles, ...model.arcs, ...model.splines].filter((item) => sketchIds.has(elementSketchId(item))).length + blockProjectionItemsToRemove.length;
      const confirmation = preserveDescendants
        ? `${sketch.name} を削除します。配下のスケッチは親へ移動します。\n図形 ${geometryCount} 件と、このスケッチの派生インスタンスも削除されます。`
        : `${sketch.name} と配下のスケッチを削除します。\n図形 ${geometryCount} 件も削除されます。`;
      if (confirmFirst && !confirmDeletion(confirmation)) return false;
  
      const pointSet = new Set(model.points.filter((point) => sketchIds.has(elementSketchId(point))));
      const lineSet = new Set(model.lines.filter((line) => sketchIds.has(elementSketchId(line)) || pointSet.has(line.p1) || pointSet.has(line.p2)));
      const circleSet = new Set(model.circles.filter((circle) => sketchIds.has(elementSketchId(circle)) || pointSet.has(circle.center)));
      const arcSet = new Set(model.arcs.filter((arc) => sketchIds.has(elementSketchId(arc)) || pointSet.has(arc.center)));
      const splineSet = new Set(model.splines.filter((spline) => sketchIds.has(elementSketchId(spline)) || spline.fitPoints.some((point) => pointSet.has(point))));
      const removedItems = [...pointSet, ...lineSet, ...circleSet, ...arcSet, ...splineSet, ...blockProjectionItemsToRemove];
      const removedIds = new Set(removedItems.map((item) => item.id));
      const removedKeys = new Set(removedItems.map(geometryElementKey).filter(Boolean));
      const removedConstraints = new Set(model.constraints.filter((constraint) =>
        sketchIds.has(constraintSketchId(constraint))
        || sketchIds.has(constraint.referenceSketchId)
        || constraintGraphNodes(constraint).some((node) => removedItems.includes(node) || removedKeys.has(geometryElementKey(node))),
      ));
      if (!guardDimensionSymbolDeletion(removedConstraints)) return false;
  
      model.constraints = model.constraints.filter((constraint) => !removedConstraints.has(constraint));
      model.lines = model.lines.filter((line) => !lineSet.has(line));
      model.circles = model.circles.filter((circle) => !circleSet.has(circle));
      model.arcs = model.arcs.filter((arc) => !arcSet.has(arc));
      model.splines = model.splines.filter((spline) => !splineSet.has(spline));
      model.points = model.points.filter((point) => !pointSet.has(point));
      model.blockInstances = model.blockInstances.filter((instance) => !blockInstancesToRemove.includes(instance));
      model.geometryInstances = model.geometryInstances.filter((instance) => !geometryInstancesToRemove.includes(instance));
      invalidateBlockProjectionCache();
  
      model.annotations = model.annotations.filter((annotation) => !sketchIds.has(annotation.sketchId) && !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
      model.hatches = model.hatches.filter((hatch) => !sketchIds.has(hatch.sketchId));
      model.referenceImages = model.referenceImages.filter((image) => !sketchIds.has(image.sketchId));
  
      const fallbackId = sketch.parentSketchId && !sketchIds.has(sketch.parentSketchId) ? sketch.parentSketchId : ROOT_SKETCH_ID;
      if (preserveDescendants) {
        for (const child of model.sketches) if (child.parentSketchId === sketch.id && !sketchIds.has(child.id)) child.parentSketchId = fallbackId;
      }
      model.sketches = model.sketches.filter((item) => !sketchIds.has(item.id));
      if (sketchIds.has(model.activeSketchId)) model.activeSketchId = sketchById(fallbackId)?.id || ROOT_SKETCH_ID;
      for (const id of sketchIds) clearSketchSolveState(id);
  
      clearInteractionForSketchChange();
      invalidateAnalysis();
      solveSketchAndDependents(activeSketchId());
      refreshConstraintAnalysis();
      updateUI({ refreshAnalysis: false });
      draw();
      setHint(`${sketch.name} を削除しました`);
      recordHistory("スケッチ削除");
      return true;
    }
    return Object.freeze({ remove: deleteSketch });
  }
  window.SketchDeletionCommand = Object.freeze({ create });
})();

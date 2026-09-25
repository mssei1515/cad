/* Resolve Properties display data from the current editing scope and operation. */
(() => {
  "use strict";
  function create({ currentScope, documentModel, getOperation, canvasSelection,
    effectiveAppearanceForElement, sketchName, hatchAppearanceForDisplay, resolvedHatchBoundary,
    blockDefinitionById, blockProjectionBundle, normalizeAppearance, emptyGeometryInstanceBundle,
    geometryInstanceBundle, activeSketchId, targetFromConstraint, dimensionDisplayState,
    constraintSketchId, isReadOnlyDimension, measuredDimensionValue, angleDegrees,
    sketchById, isRootSketch, effectiveAppearanceForSketch, effectiveConstructionAppearanceForSketch,
    effectiveDimensionAppearanceForSketch, blockDefinitionSketchRows }) {
    function read(target) {
      const item = target.item;
      if (target.kind === "multiple") return {};
      if (target.kind === "geometry") return { effective: effectiveAppearanceForElement(item) };
      if (target.kind === "referenceImage" || target.kind === "annotation") return { owningSketchName: sketchName(item.sketchId) };
      if (target.kind === "hatch") return {
        appearance: hatchAppearanceForDisplay(item), boundary: resolvedHatchBoundary(item), owningSketchName: sketchName(item.sketchId),
      };
      if (target.kind === "block") {
        const definition = blockDefinitionById(item.definitionId);
        const effective = blockProjectionBundle(item).lines[0] ? effectiveAppearanceForElement(blockProjectionBundle(item).lines[0]) : normalizeAppearance(documentModel.defaultAppearance, { partial: false });
        return { definition, effective };
      }
      if (target.kind === "geometryInstance") {
        const operation = getOperation();
        const placing = item === operation.freeInstancePlacement;
        const bundle = placing ? { ...emptyGeometryInstanceBundle(item), valid: true } : geometryInstanceBundle(item);
        const first = [...bundle.lines, ...bundle.circles, ...bundle.arcs, ...bundle.splines, ...bundle.points][0];
        const effective = first ? effectiveAppearanceForElement(first) : normalizeAppearance(documentModel.defaultAppearance, { partial: false });
        const editingSources = operation.mode === "instance-sources";
        const sources = editingSources && operation.instanceSourceEdit?.instance === item ? operation.instanceSourceEdit.sources : item.sources;
        return { bundle, effective, placing, sources, editingSources,
          canEditSources: currentScope().geometryInstances.includes(item) && item.sketchId === activeSketchId(),
          editingSharedShape: canvasSelection.instanceGeometry?.instanceId === item.id };
      }
      if (target.kind === "constraint") {
        const targetValue = targetFromConstraint(item);
        const display = dimensionDisplayState(item.dimension, constraintSketchId(item));
        const readOnly = isReadOnlyDimension(item);
        const value = readOnly ? measuredDimensionValue(targetValue, item.dimension)
          : targetValue?.kind === "angle" ? angleDegrees(item.target) : item.target;
        return { targetValue, display, readOnly, value };
      }
      if (target.kind === "blockPlacement") {
        const operation = getOperation();
        return { enabledSketchIds: [...operation.blockPlacementEnabledSketchIds], rotationLocked: operation.blockPlacementRotationLocked,
          sketchRows: blockDefinitionSketchRows(item) };
      }
      const parent = sketchById(item.parentSketchId), root = isRootSketch(item);
      return { parent, root, ...(root ? {} : { effective: effectiveAppearanceForSketch(item),
        constructionAppearance: effectiveConstructionAppearanceForSketch(item), dimensionAppearance: effectiveDimensionAppearanceForSketch(item) }) };
    }
    return Object.freeze({ read });
  }
  window.PropertyPresentation = Object.freeze({ create });
})();

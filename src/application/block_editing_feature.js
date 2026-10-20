/* Compose Block drafts, nested editing sessions and queries over the same owners. */
(() => {
  "use strict";
  function create({ workspace, documentModel, ids, catalog, projections, instances, rebinding,
    normalizedSketchCopy, normalizeGeometryInstance, isDimensionConstraint, isReadOnlyDimension,
    numericDimensionExpression, ensureParameterNamespace, activeSketchId, blockProjectionBundles, geometryElementKey,
    readViewport, activateScope, reserveScopeSequences, createHistory,
    rebuildStoredBlockDefinitionConstraints, rebuildBlockDefinitionConstraintObjects }) {
    const editing = window.BlockDefinitionEditing.create({
      normalizedSketchCopy, cloneConstraintForBlock: rebinding.cloneForBlock, blockDefinitionById: catalog.blockDefinitionById,
      createBlockProjectionBundle: projections.createBlockProjectionBundle,
      geometryInstanceBundlesForScope: instances.geometryInstanceBundlesForScope, emptyGeometryInstanceBundle: instances.emptyGeometryInstanceBundle,
      normalizeGeometryInstance, hatchSequence: () => ids.peek("hatch"), nextDefinitionId: () => ids.allocate("blockDefinition"),
      isDimensionConstraint, isReadOnlyDimension, numericDimensionExpression, ensureParameterNamespace,
    });
    const session = window.BlockEditorSession.create({
      currentScope: workspace.current, documentModel, hatchSequence: () => ids.peek("hatch"),
      normalizedSketchCopy, activeSketchId, blockProjectionBundles, geometryElementKey,
      captureHost: () => ({ ...workspace.capture(), viewport: readViewport().snapshot() }),
      restoreHostState: original => { activateScope(workspace.restore(original)); readViewport().update(original.viewport); },
      activateScope, reserveScopeSequences, cloneBlockDefinition: editing.clone, createHistory, mergeBlockDefinitionDraft: editing.apply,
      rebuildStoredBlockDefinitionConstraints, invalidateBlockProjectionCache: projections.invalidateBlockProjectionCache,
      blockDefinitionOwnedSubtreeIds: catalog.blockDefinitionOwnedSubtreeIds, rebuildBlockDefinitionConstraintObjects,
    });
    const queries = window.BlockEditingQueries.create({ definitions: () => documentModel.blockDefinitions,
      currentScope: workspace.current, editor: session, catalog });
    return Object.freeze({ editing, session, queries });
  }
  window.BlockEditingFeature = Object.freeze({ create });
})();

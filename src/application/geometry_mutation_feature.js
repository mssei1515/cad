/* Prepare transient authoring and later mutation checkpoints over the same editing owners. */
(() => {
  "use strict";
  function prepareForWorkspace({ documentWorkspace, readServices, interaction, history, analysis, updateHistoryButtons }) {
    const { workspace, geometryIds } = documentWorkspace;
    const { controller, captureDocument, documentHistory } = history;
    const transient = window.TransientAuthoring.create({
      currentScope: workspace.current, ids: geometryIds, selection: interaction.selection, historySnapshot: captureDocument, documentHistory,
      isHistoryRestoring: () => controller.restoring, updateHistoryButtons,
      invalidateAnalysis: () => { analysis.invalidate(); },
    });
    let checkpoint = null;
    function requireCheckpoint(binding) {
      if (!checkpoint) throw new ReferenceError(`Cannot access '${binding}' before initialization`);
      return checkpoint;
    }
    const geometryCheckpoint = Object.freeze({
      capture(...args) {
        const { captureGeometry } = requireCheckpoint("snapshotGeometryMutationState");
        return captureGeometry(...args);
      },
      restore(...args) {
        const { restoreGeometry } = requireCheckpoint("restoreGeometryMutationState");
        return restoreGeometry(...args);
      },
    });
    function createCheckpoint() {
      const completed = window.EditingCheckpoint.create({
        currentScope: workspace.current, ids: geometryIds, invalidateProjection: readServices.projections.invalidateBlockProjectionCache,
        invalidateAnalysis: () => { analysis.invalidate(); },
      });
      checkpoint = completed;
      return completed;
    }
    return Object.freeze({ transient, createCheckpoint, geometryCheckpoint });
  }
  window.GeometryMutationFeature = Object.freeze({ prepareForWorkspace });
})();

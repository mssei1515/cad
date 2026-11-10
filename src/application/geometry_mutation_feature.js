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
    function createCheckpoint() {
      return window.EditingCheckpoint.create({
        currentScope: workspace.current, ids: geometryIds, invalidateProjection: readServices.projections.invalidateBlockProjectionCache,
        invalidateAnalysis: () => { analysis.invalidate(); },
      });
    }
    return Object.freeze({ transient, createCheckpoint });
  }
  window.GeometryMutationFeature = Object.freeze({ prepareForWorkspace });
})();

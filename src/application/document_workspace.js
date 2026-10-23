/* Compose Document data, editing scope queries and ID owners without UI or history. */
(() => {
  "use strict";
  function create({ applicationText, constraintGraphNodes, nextHatchIndex }) {
    const document = window.DocumentState.create();
    const workspace = window.EditingWorkspace.create(document);
    const parameters = window.ParameterNamespace.create({ currentParameterNamespace: workspace.current, applicationText });
    const sketches = window.SketchContext.create({ currentScope: workspace.current, constraintGraphNodes });
    const geometryIds = window.GeometryIds.create();
    const documentIds = window.DocumentIds.create();
    const reservation = window.DocumentIds.createReservation({ geometryIds, documentIds, nextHatchIndex });
    function createGeometryReadServices({ currentSketches, prepareBlocks, showHiddenElements, viewportScale, profileRead }) {
      const { elementSketchId, sketchById, isRootSketch, activeSketchId } = sketches;
      return window.GeometryReadServices.createWithHatches({ document, currentScope: workspace.current, currentSketches,
        prepareBlocks, elementSketchId, applicationText, sketchById, isRootSketch, activeSketchId,
        showHiddenElements, viewportScale, profileRead });
    }
    return Object.freeze({ document, workspace, parameters, sketches, geometryIds, documentIds, reservation, createGeometryReadServices });
  }
  window.DocumentWorkspace = Object.freeze({ create });
})();

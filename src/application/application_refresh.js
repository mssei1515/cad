/* Coordinate full and selection-only view refreshes without owning model or view state. */
(() => {
  "use strict";
  function create({ document, interactionProfiler, profileInteractionWork, syncAnnotationResize,
    prepareParameterNamespace, refreshConstraintAnalysis, updateDocumentName, updateToolbar, renderSketch,
    updateBlockUI, renderProperties, readSketchMoving, updateStatusUI, updateConstraintButtons,
    localizeApplicationUI, syncDimensionInput, refreshSketchSelection }) {
    function properties() {
      if (!interactionProfiler.active) return renderProperties();
      return profileInteractionWork("properties", renderProperties);
    }
    function sketch() {
      if (!interactionProfiler.active) return renderSketch();
      return profileInteractionWork("tree", renderSketch);
    }
    function selectionUnprofiled() {
      syncAnnotationResize();
      updateToolbar();
      updateConstraintButtons();
      if (document.getElementById("blockDefinitionsDialog")?.open) updateBlockUI();
      refreshSketchSelection();
      properties();
    }
    function selection() {
      if (!interactionProfiler.active) return selectionUnprofiled();
      return profileInteractionWork("ui", selectionUnprofiled);
    }
    function refreshUnprofiled({ refreshAnalysis = true } = {}) {
      syncAnnotationResize();
      prepareParameterNamespace();
      if (refreshAnalysis) refreshConstraintAnalysis();
      updateDocumentName();
      updateToolbar();
      sketch();
      updateBlockUI();
      properties();
      const panel = document.getElementById("propertiesPanel");
      if (panel) panel.inert = readSketchMoving();
      updateStatusUI();
      updateConstraintButtons();
      localizeApplicationUI();
      syncDimensionInput();
    }
    function refresh({ refreshAnalysis = true } = {}) {
      if (!interactionProfiler.active) return refreshUnprofiled({ refreshAnalysis });
      return profileInteractionWork("ui", () => refreshUnprofiled({ refreshAnalysis }));
    }
    return Object.freeze({ refresh, selection, properties, sketch });
  }
  window.ApplicationRefresh = Object.freeze({ create });
})();

/* Browser document fixtures delegate file import and model application to their existing owners. */
(() => {
  "use strict";
  function createImport({ performance, File, importFileData, readDocumentName, effectiveDocumentName, serializeModel, document }) {
    async function importName(data, fileName) {
      const startedAt = performance.now();
      const file = new File([JSON.stringify(data)], fileName, { type: "application/json" });
      const success = await importFileData(file);
      return {
        success,
        elapsedMs: performance.now() - startedAt,
        modelName: readDocumentName(),
        displayName: effectiveDocumentName(),
        serializedName: serializeModel().documentName,
        title: document.title,
      };
    }
    return Object.freeze({ importName });
  }

  function createLoad({ loadModelData, fileNameStem, resetHistory, updateUI, draw, currentScope }) {
    function load(data, fileName = "drag-fixture.json", { resetLoadedHistory = false } = {}) {
      try {
        loadModelData(structuredClone(data), { documentNameOverride: fileNameStem(fileName) });
        if (resetLoadedHistory) resetHistory("fixture load");
        updateUI();
        draw();
        return { success: true, constraintCount: currentScope().constraints.length };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    return Object.freeze({ load });
  }
  window.DocumentTestDriver = Object.freeze({ createImport, createLoad });
})();

/* Browser document fixtures delegate import, model application and Sketch deletion to product owners. */
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
  function createSketchDeletionFixture({ resetModelState, currentScope, rootSketchId, addPoint, addLine, addCircle, geometryRefForItem, deleteSketch }) {
    function reset() {
      resetModelState();
      currentScope().sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: rootSketchId, kind: "sketch" });
      currentScope().sketches.push({ id: "S3", name: "Sketch-2-1", parentSketchId: "S2", kind: "sketch" });
      currentScope().sketches.push({ id: "S4", name: "Sketch-3", parentSketchId: rootSketchId, kind: "sketch" });
      currentScope().activeSketchId = "S2";
      const p1 = addPoint(0, 0, false, "endpoint");
      const p2 = addPoint(80, 0, false, "endpoint");
      const line = addLine(p1, p2);
      currentScope().activeSketchId = "S3";
      const center = addPoint(30, 30, false, "center");
      const circle = addCircle(center, 20);
      line.appearance = { color: "#ef4444" };
      circle.appearance = { color: "#22c55e" };
      currentScope().annotations.push({ id: "AN-test", type: "leader", visible: true, sketchId: "S2", geometryRef: geometryRefForItem(line), start: { x: 0, y: 0 }, end: { x: 30, y: 20 }, style: {} });
      currentScope().activeSketchId = "S3";
      const deleted = deleteSketch("S2", false);
      return {
        deleted,
        sketchIds: currentScope().sketches.map((sketch) => sketch.id),
        activeSketchId: currentScope().activeSketchId,
        geometry: { points: currentScope().points.length, lines: currentScope().lines.length, circles: currentScope().circles.length, arcs: currentScope().arcs.length },
        annotationCount: currentScope().annotations.length,
      };
    }
    function remove(sketchId) {
      return deleteSketch(sketchId, false);
    }
    return Object.freeze({ reset, remove });
  }
  function createCyclicReferenceFixture({ resetModelState, currentScope, rootSketchId, defaultSketchId, addPoint, markReferenceConstraint, CoincidentConstraint, serializeModel, loadModelData, refreshConstraintAnalysis, updateUI, constraintIsOperational, readReferenceErrors, document }) {
    function loadCase() {
      resetModelState();
      currentScope().sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: rootSketchId, kind: "sketch", visible: true });
      currentScope().activeSketchId = defaultSketchId;
      const p1 = addPoint(0, 0, false, "explicit");
      currentScope().activeSketchId = "S2";
      const p2 = addPoint(20, 0, false, "explicit");
      const forward = markReferenceConstraint(new CoincidentConstraint(p1, p2), "S2", defaultSketchId);
      const reverse = markReferenceConstraint(new CoincidentConstraint(p2, p1), defaultSketchId, "S2");
      currentScope().constraints.push(forward, reverse);
      const serialized = serializeModel();
      serialized.activeSketchId = defaultSketchId;
      loadModelData(serialized);
      refreshConstraintAnalysis();
      updateUI();
      return {
        total: currentScope().constraints.length,
        operational: currentScope().constraints.filter(constraintIsOperational).length,
        invalid: readReferenceErrors(),
        badges: document.querySelectorAll(".sketch-reference-error-badge, .constraint-reference-error-badge").length,
      };
    }
    return Object.freeze({ loadCase });
  }

  window.DocumentTestDriver = Object.freeze({ createImport, createLoad, createSketchDeletionFixture, createCyclicReferenceFixture });
})();

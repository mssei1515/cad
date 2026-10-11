/* Reference-image browser observation, data import and Block fixtures through existing owners. */
(() => {
  "use strict";
  function createObservation({ canvasSelection, currentScope, serializeReferenceImage, isEditingBlock, liveBlockEditorDefinition, referenceImageInteraction, readHistory, viewport }) {
    function state() {
      return {
        selectedIds: canvasSelection.referenceImages.map((item) => item.id),
        images: currentScope().referenceImages.map(serializeReferenceImage),
        liveBlockImages: isEditingBlock() ? (liveBlockEditorDefinition().referenceImages || []).map(serializeReferenceImage) : [],
        calibrationPointCount: referenceImageInteraction.calibrationPointCount,
        dragging: referenceImageInteraction.dragging,
        history: readHistory(),
        viewport: viewport.snapshot(),
      };
    }
    return Object.freeze({ state });
  }

  function createImport({ fetch, File, importReferenceImageFile }) {
    async function importData(dataUrl, name = "image.png", type = "image/png") {
      const blob = await (await fetch(dataUrl)).blob();
      return importReferenceImageFile(new File([blob], name, { type }));
    }
    return Object.freeze({ importData });
  }

  function createBlockFixture({ resetModelState, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, openBlockDefinitionEditor, completeBlockDefinitionEdit, serializeModel }) {
    function open(options = {}) {
      if (!options.preserveDocument) resetModelState();
      const draft = createEmptyBlockDefinition("Image Block");
      const p1 = new Point("P1", -20, 0, false, "endpoint");
      const p2 = new Point("P2", 20, 0, false, "endpoint");
      p1.sketchId = DEFAULT_SKETCH_ID;
      p2.sketchId = DEFAULT_SKETCH_ID;
      const line = new Line("L1", p1, p2, false);
      line.sketchId = DEFAULT_SKETCH_ID;
      draft.points.push(p1, p2);
      draft.lines.push(line);
      openBlockDefinitionEditor(draft, { isNew: true });
      return true;
    }

    function complete() {
      completeBlockDefinitionEdit({ rotationLocked: true });
      return structuredClone(serializeModel());
    }
    return Object.freeze({ open, complete });
  }
  window.ReferenceImageTestDriver = Object.freeze({ createObservation, createImport, createBlockFixture });
})();

/* Coordinate canvas presentation refresh; commands, inputs, profiling and caches keep their owners. */
(() => {
  "use strict";
  function create({ readPngCommand, readPending, readMode, readCommandPanel, syncAnnotationInput,
    readDerivedPanel, interactionProfiler, profileInteractionWork, withGeometryReadCache, drawCanvas }) {
    let selectedItem = null;
    function drawUnprofiled() {
      return withGeometryReadCache(drawCanvas);
    }
    function draw() {
      if (readPngCommand()?.active && !readPngCommand().busy && (readPending()?.type !== "png-export" || readMode() !== "png-export")) readPngCommand().cancel();
      readCommandPanel()?.update();
      syncAnnotationInput();
      selectedItem = readDerivedPanel()?.selectedItem() || null;
      if (!interactionProfiler.active) return drawUnprofiled();
      return profileInteractionWork("draw", () => drawUnprofiled());
    }
    return Object.freeze({ draw, get selectedItem() { return selectedItem; } });
  }
  window.CanvasRefresh = Object.freeze({ create });
})();

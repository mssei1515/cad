/* Compose reference-image preparation, placement and native/file input wiring. */
(() => {
  "use strict";
  function create({ document, window: browserWindow, applicationText, canvas, viewport, screenToWorld,
    currentScope, activeSketchId, nextId, canCreateInActiveSketch, clearSelection, canvasSelection,
    updateUI, draw, recordHistory, setHint, pasteGeometry, copyGeometry, isGeometryMode, isTextEditingTarget }) {
    const referenceImageImport = window.ReferenceImageImport.create({ window: browserWindow, document, applicationText });
    const command = window.ReferenceImageCommand.create({
      referenceImageImport, canvas, viewport, screenToWorld, currentScope, activeSketchId, nextId,
      canCreateInActiveSketch, clearSelection, canvasSelection, updateUI, draw, recordHistory, setHint, applicationText,
    });
    const clipboard = window.ImageClipboard.create({ window: browserWindow,
      importFile: command.importFile, pasteGeometry, copyGeometry, isGeometryMode, isTextEditingTarget, setHint, applicationText,
    });
    let clipboardBound = false, controlsBound = false;
    const removers = [];
    function listen(target, type, handler) {
      if (!target) return;
      target.addEventListener(type, handler);
      removers.push(() => target.removeEventListener(type, handler));
    }
    function bindClipboard() {
      if (clipboardBound) return;
      clipboardBound = true;
      listen(document, "paste", clipboard.paste);
      listen(document, "copy", clipboard.copy);
      listen(document, "cut", clipboard.copy);
    }
    function bindControls() {
      if (controlsBound) return;
      controlsBound = true;
      listen(document.getElementById("importReferenceImageBtn"), "click", () => document.getElementById("referenceImageFileInput")?.click());
      listen(document.getElementById("referenceImageFileInput"), "change", event => {
        const input = event.currentTarget;
        const file = input.files?.[0] || null;
        input.value = "";
        void command.importFile(file);
      });
    }
    function dispose() {
      for (const remove of removers.splice(0)) remove();
      clipboardBound = controlsBound = false;
    }
    return Object.freeze({ importFile: command.importFile, clipboard, bindClipboard, bindControls, dispose });
  }
  window.ReferenceImageInput = Object.freeze({ create });
})();

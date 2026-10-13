/* Document and DXF control events delegate file processing to existing commands. */
(() => {
  "use strict";
  function binding(register) {
    const removers = [];
    let bound = false;
    function listen(node, type, handler, optional = false) {
      if (optional && !node) return;
      node.addEventListener(type, handler);
      removers.push(() => node.removeEventListener(type, handler));
    }
    function bind() {
      if (bound) return;
      bound = true;
      register(listen);
    }
    function dispose() {
      for (const remove of removers.splice(0)) remove();
      bound = false;
    }
    return Object.freeze({ bind, dispose });
  }
  function createDocument({ document, saveJot2DFile, saveJot2DFileAs, openJot2DFile, documentFileCommand }) {
    return binding(listen => {
      listen(document.getElementById("exportBtn"), "click", () => void saveJot2DFile());
      listen(document.getElementById("saveAsBtn"), "click", () => void saveJot2DFileAs(), true);
      listen(document.getElementById("importBtn"), "click", () => void openJot2DFile());
      const fileInput = document.getElementById("documentFileInput");
      if (fileInput != null) listen(fileInput, "change", documentFileCommand.fileInputChanged);
      listen(document.getElementById("copyDocumentLinkBtn"), "click", () => void documentFileCommand.copyDocumentLink(), true);
      listen(document.getElementById("openDocumentLinkBtn"), "click", () => void documentFileCommand.openLinkedDocument(), true);
    });
  }
  function createDxf({ document, flushScheduledCanvasPointerMove, fileSession, canImportDxf, setHint, applicationText, dxfImportCommand }) {
    return binding(listen => {
      listen(document.getElementById("dxfImportBtn"), "click", () => {
        flushScheduledCanvasPointerMove();
        if (fileSession.busy || !canImportDxf()) {
          setHint(applicationText("作図可能なスケッチを選び、進行中の操作を終了してください", "Select an editable sketch and finish the current operation"), "error");
          return;
        }
        document.getElementById("dxfFileInput").click();
      });
      listen(document.getElementById("dxfFileInput"), "change", event => {
        const input = event.currentTarget, file = input.files?.[0];
        input.value = "";
        void dxfImportCommand.importFile(file);
      });
    });
  }
  window.DocumentFileControls = Object.freeze({ createDocument, createDxf });
})();

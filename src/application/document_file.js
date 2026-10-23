/* Compose Document file commands, save status and browser controls. */
(() => {
  "use strict";
  function create({ window: browserWindow, document, fileSession, applicationText,
    readDocumentName, currentSnapshot, isEditingBlock, serializeModel, requestChoice,
    loadModelData, solveAndRefresh, resetHistory, fitAllGeometryToViewport, repairMessage, setHint, log, draw }) {
    const { effectiveDocumentNameFromValue, fileNameStem } = window.DocumentFiles;
    const status = window.DocumentStatusView.create({
      document, applicationText, fileSession, getDocumentName: () => effectiveDocumentNameFromValue(readDocumentName()),
      currentSnapshot, isEditingBlock,
    });
    function refreshStatus() { status.render(); }
    function markCheckpoint(kind, data = serializeModel()) {
      fileSession.markCheckpoint(kind, data);
      refreshStatus();
    }
    const command = window.DocumentFileCommand.create({
      window: browserWindow, document, fileSession, choiceDialog: { show: requestChoice }, applicationText,
      bookmarks: window.DocumentBookmarks.create({ indexedDB: browserWindow.indexedDB, crypto: browserWindow.crypto }),
      isEditingBlock, getDocumentName: readDocumentName,
      serializeModel, markDocumentFileCheckpoint: markCheckpoint, updateDocumentNameUI: refreshStatus, setHint, log,
      applyLoadedDocument: (data, fileName) => {
        loadModelData(data, { documentNameOverride: fileNameStem(fileName) });
        solveAndRefresh("ファイル読み込み");
        resetHistory("ファイル読み込み");
        markCheckpoint("saved");
        refreshStatus();
        fitAllGeometryToViewport();
        draw();
        if (repairMessage()) setHint(repairMessage());
      },
    });
    const controls = window.DocumentFileControls.createDocument({
      document, saveJot2DFile: command.save, saveJot2DFileAs: command.saveAs, openJot2DFile: command.open, documentFileCommand: command,
    });
    function createDxf({ geometry, ids, currentScope, activeSketchId, canImport, minimumLength, clearSelection, updateUI, recordHistory }) {
      const dxfCommand = window.DxfImportCommand.create({
        parser: window.DxfImport, geometry, ids, currentScope, activeSketchId, canImport,
        signature: () => window.DocumentFiles.documentContentSignature(serializeModel()),
        fileSession, requestChoice, applicationText, minimumLength, setHint,
        onImported: () => {
          clearSelection();
          updateUI();
          recordHistory("DXF読み込み");
          fitAllGeometryToViewport();
          draw();
        },
      });
      function createControls({ flushScheduledCanvasPointerMove }) {
        return window.DocumentFileControls.createDxf({ document, flushScheduledCanvasPointerMove, fileSession,
          canImportDxf: canImport, setHint, applicationText, dxfImportCommand: dxfCommand });
      }
      return Object.freeze({ command: dxfCommand, createControls });
    }
    let started = false;
    function start() {
      if (started) return;
      started = true;
      browserWindow.addEventListener("beforeunload", command.beforeUnload);
      void command.openStartupDocument();
    }
    function dispose() {
      controls.dispose();
      if (started) browserWindow.removeEventListener("beforeunload", command.beforeUnload);
      started = false;
    }
    return Object.freeze({ refreshStatus, markCheckpoint, createDxf, bindControls: controls.bind, start, dispose,
      save: command.save, saveAs: command.saveAs, open: command.open, importFileData: command.importFileData });
  }
  window.DocumentFileFeature = Object.freeze({ create });
})();

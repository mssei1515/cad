/* Compose Document file commands, save status and browser controls. */
(() => {
  "use strict";
  function prepare() {
    const session = window.DocumentFiles.create();
    function createForWorkspace({ window: browserWindow, document, documentWorkspace, history, blockEditor, presentation, fit,
      serializeModel, requestChoice, loadModelData, solveAndRefresh, repairMessage }) {
      const feature = create({ window: browserWindow, document, fileSession: session, applicationText: presentation.settings.applicationText,
        readDocumentName: () => documentWorkspace.document.documentName, currentSnapshot: () => history.documentHistory.currentSnapshot,
        isEditingBlock: () => Boolean(blockEditor.current), serializeModel, requestChoice, loadModelData, solveAndRefresh,
        resetHistory: history.controller.resetDocument, fitAllGeometryToViewport: fit.fitAllGeometryToViewport,
        repairMessage, setHint: presentation.setHint, log: presentation.log, draw: presentation.draw });
      function createDxfForWorkspace({ geometry, interaction, sessions, minimumLength, clearSelection }) {
        function recordHistory(label = "変更") { return history.record(label); }
        return feature.createDxfForEditing({ documentWorkspace, geometry, interaction, sessions, minimumLength, clearSelection,
          updateUI: presentation.updateUI, recordHistory });
      }
      return Object.freeze({ ...feature, createDxfForWorkspace });
    }
    return Object.freeze({ session, createForWorkspace });
  }
  function create({ window: browserWindow, document, fileSession, applicationText,
    readDocumentName, currentSnapshot, isEditingBlock, serializeModel, requestChoice,
    loadModelData, solveAndRefresh, resetHistory, fitAllGeometryToViewport, repairMessage, setHint, log, draw }) {
    const { effectiveDocumentNameFromValue, fileNameStem } = window.DocumentFiles;
    function effectiveDocumentName() { return effectiveDocumentNameFromValue(readDocumentName()); }
    const status = window.DocumentStatusView.create({
      document, applicationText, fileSession, getDocumentName: effectiveDocumentName,
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
    function createDxfForEditing({ documentWorkspace, geometry, interaction, sessions, minimumLength, clearSelection, updateUI, recordHistory }) {
      const { workspace, geometryIds: ids, sketches: { activeSketchId } } = documentWorkspace;
      const { canCreateInActiveSketch } = interaction.access, { active: hasActiveDrawOperation } = interaction.lifecycle;
      const { pending, targets } = sessions;
      const canImport = () => canCreateInActiveSketch() && !hasActiveDrawOperation()
        && !pending.current && !targets.command && interaction.lifecycle.mode !== "block-place";
      const dxf = createDxf({ geometry, ids, currentScope: workspace.current, activeSketchId, canImport,
        minimumLength, clearSelection, updateUI, recordHistory });
      function bindControls(options) {
        const controls = dxf.createControls(options);
        controls.bind();
        return controls;
      }
      return Object.freeze({ ...dxf, bindControls });
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
    return Object.freeze({ effectiveDocumentName, refreshStatus, markCheckpoint, createDxf, createDxfForEditing, bindControls: controls.bind, start, dispose,
      save: command.save, saveAs: command.saveAs, open: command.open, importFileData: command.importFileData });
  }
  window.DocumentFileFeature = Object.freeze({ create, prepare });
})();

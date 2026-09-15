/* File naming, content checkpoints, and operation exclusion for one session. */
(function () {
  "use strict";

  const DEFAULT_DOCUMENT_NAME = "無題";
  const JOT2D_FILE_EXTENSION = ".jot2d";
  const JOT2D_FILE_MIME_TYPE = "application/json";

  function sanitizeDocumentNameValue(value) {
    return String(value ?? "").replace(/[\r\n\t]+/g, " ");
  }

  function fileNameStem(fileName) {
    const name = sanitizeDocumentNameValue(fileName).trim();
    return name.replace(/\.[^.\\/]+$/, "") || DEFAULT_DOCUMENT_NAME;
  }

  function safeDownloadBaseName(name) {
    return effectiveDocumentNameFromValue(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/[. ]+$/g, "").trim() || "jot2d-model";
  }

  function effectiveDocumentNameFromValue(value) {
    const name = sanitizeDocumentNameValue(value).trim();
    return name || DEFAULT_DOCUMENT_NAME;
  }

  function documentContentSignature(data) {
    const { savedAt, activeSketchId, documentName, ...content } = data;
    content.blockDefinitions = (content.blockDefinitions || []).map(({ activeSketchId, ...definition }) => definition);
    return JSON.stringify({ ...content, documentName });
  }

  async function writeJot2DFile(handle, content) {
    const writable = await handle.createWritable();
    try {
      await writable.write(content);
      await writable.close();
    } catch (error) {
      try { await writable.abort?.(); } catch (_abortError) { /* Keep the original write error. */ }
      throw error;
    }
  }

  function create() {
    let handle = null;
    let savedSignature = null;
    let operationPending = false;
    let savePending = false;
    let checkpointKind = "new";
    let lastSnapshot = null;
    let lastSignature = null;

    function canSave({ replacingDocument = false } = {}) {
      return !savePending && (!operationPending || replacingDocument);
    }

    function beginSave(options) {
      if (!canSave(options)) return false;
      savePending = true;
      return true;
    }

    function beginOpen() {
      if (operationPending || savePending) return false;
      operationPending = true;
      return true;
    }

    function markCheckpoint(kind, data) {
      savedSignature = documentContentSignature(data);
      checkpointKind = kind;
      lastSnapshot = null;
    }

    // The status bar compares committed history. Replacement/unload compare live data.
    function hasUnsavedChanges({ snapshot, documentName, editingBlock = false }) {
      if (savedSignature === null) return false;
      if (editingBlock) return true;
      if (!snapshot) return false;
      if (snapshot !== lastSnapshot) {
        lastSnapshot = snapshot;
        lastSignature = documentContentSignature({ ...JSON.parse(snapshot), documentName });
      }
      return lastSignature !== savedSignature;
    }

    return Object.freeze({
      get handle() { return handle; },
      get savePending() { return savePending; },
      get busy() { return operationPending || savePending; },
      get checkpointKind() { return checkpointKind; },
      canSave, beginSave, beginOpen,
      finishSave() { savePending = false; },
      finishOpen() { operationPending = false; },
      setHandle(value) { handle = value; },
      markCheckpoint, hasUnsavedChanges,
      matchesCheckpoint(data) { return documentContentSignature(data) === savedSignature; },
    });
  }

  window.DocumentFiles = Object.freeze({
    DEFAULT_DOCUMENT_NAME, JOT2D_FILE_EXTENSION, JOT2D_FILE_MIME_TYPE,
    sanitizeDocumentNameValue, fileNameStem, safeDownloadBaseName,
    effectiveDocumentNameFromValue, documentContentSignature, writeJot2DFile, create,
  });
})();

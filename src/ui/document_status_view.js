/* Present committed document save status without changing file or history state. */
(() => {
  "use strict";
  function create({ document, applicationText, fileSession, getDocumentName, currentSnapshot, isEditingBlock }) {
    function updateDocumentNameUI() {
      const displayName = getDocumentName();
      const dirty = hasUnsavedDocumentChanges();
      document.title = `${dirty ? "● " : ""}${displayName} - Jot2D`;
      const status = document.getElementById("documentSaveStatus");
      if (status) {
        const label = fileSession.savePending ? applicationText("保存中…", "Saving…")
          : isEditingBlock() ? applicationText("ブロック編集中", "Editing block")
          : dirty ? applicationText("未保存の変更", "Unsaved changes")
          : fileSession.checkpointKind === "new" ? applicationText("新規ドキュメント", "New document")
          : fileSession.checkpointKind === "download" ? applicationText("ダウンロード開始済み", "Download started")
          : applicationText("保存済み", "Saved");
        const text = `${displayName} · ${label}`;
        if (status.textContent !== text) status.textContent = text;
        status.title = fileSession.handle ? `${text}\n${fileSession.handle.name}` : text;
        status.dataset.dirty = String(dirty);
      }
    }

    function hasUnsavedDocumentChanges() {
      return fileSession.hasUnsavedChanges({
        snapshot: currentSnapshot(), documentName: getDocumentName(), editingBlock: Boolean(isEditingBlock()),
      });
    }

    return Object.freeze({ render: updateDocumentNameUI });
  }
  window.DocumentStatusView = Object.freeze({ create });
})();

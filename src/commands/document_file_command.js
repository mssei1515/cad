/* Coordinate browser file operations; codecs, file state and model loading have separate owners. */
(() => {
  "use strict";
  const { JOT2D_FILE_EXTENSION, JOT2D_FILE_MIME_TYPE, safeDownloadBaseName,
    documentContentSignature, writeJot2DFile } = window.DocumentFiles;
  function create({ window, document, fileSession, choiceDialog, applicationText,
    isEditingBlock, getDocumentName, serializeModel, importFileData,
    markDocumentFileCheckpoint, updateDocumentNameUI, setHint, log }) {
    async function confirmDocumentReplacement() {
      if (!isEditingBlock() && fileSession.matchesCheckpoint(serializeModel())) return true;
      const choice = await choiceDialog.show({
        title: applicationText("未保存の変更があります", "Unsaved changes"),
        message: applicationText("別のファイルを開く前に、現在の図面を保存しますか？", "Save the current drawing before opening another file?"),
        choices: [
          { value: "save", label: applicationText("保存して開く", "Save and open") },
          { value: "discard", label: applicationText("保存せずに開く", "Open without saving") },
        ],
        defaultValue: "save",
        cancelLabel: applicationText("キャンセル", "Cancel"),
        closeLabel: applicationText("閉じる", "Close"),
      });
      if (choice === "save") return await saveJot2DFile({ replacingDocument: true })
        && !isEditingBlock() && fileSession.matchesCheckpoint(serializeModel());
      return choice === "discard";
    }

    function jot2dFilePickerTypes() {
      return [{
        description: applicationText("Jot2Dドキュメント", "Jot2D document"),
        accept: { [JOT2D_FILE_MIME_TYPE]: [JOT2D_FILE_EXTENSION] },
      }];
    }

    function fileSystemAccessSupported(method) {
      return typeof window[method] === "function";
    }

    function filePickerCanceled(error) {
      return error?.name === "AbortError";
    }

    function serializedJot2DFileData() {
      return JSON.stringify(serializeModel(), null, 2);
    }

    function downloadJot2DFile(content, name) {
      const url = window.URL.createObjectURL(new window.Blob([content], { type: JOT2D_FILE_MIME_TYPE }));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      try { link.click(); } finally {
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      }
    }

    async function saveJot2DFile({ saveAs = false, replacingDocument = false } = {}) {
      if (!fileSession.canSave({ replacingDocument })) return false;
      if (isEditingBlock()) {
        setHint("ブロック定義編集を終了してから保存してください", "error");
        return false;
      }
      let handle = saveAs ? null : fileSession.handle;
      fileSession.beginSave({ replacingDocument });
      updateDocumentNameUI();
      try {
        const nativeSave = handle || fileSystemAccessSupported("showSaveFilePicker");
        if (!handle && nativeSave) {
          handle = await window.showSaveFilePicker({
            suggestedName: `${safeDownloadBaseName(getDocumentName())}${JOT2D_FILE_EXTENSION}`,
            types: jot2dFilePickerTypes(),
            excludeAcceptAllOption: true,
          });
        }
        if (isEditingBlock()) {
          setHint("ブロック定義編集を終了してから保存してください", "error");
          return false;
        }
        const content = serializedJot2DFileData();
        const name = handle?.name || `${safeDownloadBaseName(getDocumentName())}${JOT2D_FILE_EXTENSION}`;
        if (handle) {
          await writeJot2DFile(handle, content);
          fileSession.setHandle(handle);
        } else {
          downloadJot2DFile(content, name);
        }
        markDocumentFileCheckpoint(handle ? "saved" : "download", JSON.parse(content));
        const message = handle ? applicationText(`保存しました: ${name}`, `Saved: ${name}`)
          : applicationText(`ダウンロードを開始しました: ${name}`, `Download started: ${name}`);
        setHint(message);
        log(message);
        return true;
      } catch (error) {
        if (filePickerCanceled(error)) {
          setHint("保存をキャンセルしました");
          return false;
        }
        const message = applicationText(`ファイル保存に失敗しました: ${error.message}`, `Failed to save the file: ${error.message}`);
        setHint(message, "error");
        log(message);
        return false;
      } finally {
        fileSession.finishSave();
        updateDocumentNameUI();
      }
    }

    function saveJot2DFileAs() {
      return saveJot2DFile({ saveAs: true });
    }

    function htmlDocumentFilePickerRequested() {
      return new window.URLSearchParams(window.location.search).get("filePicker") === "input";
    }

    function requestDocumentFileInput() {
      const input = document.getElementById("documentFileInput");
      if (!input) {
        setHint(applicationText("互換ファイル入力を開始できません", "The compatible file input is unavailable"), "error");
        return false;
      }
      input.click();
      return true;
    }

    async function openJot2DFile() {
      if (fileSession.busy) return false;
      if (isEditingBlock()) {
        setHint("ブロック定義編集を終了してから読み込んでください", "error");
        return false;
      }
      if (htmlDocumentFilePickerRequested() || !fileSystemAccessSupported("showOpenFilePicker")) return requestDocumentFileInput();
      if (!fileSession.beginOpen()) return false;
      try {
        const [handle] = await window.showOpenFilePicker({
          types: jot2dFilePickerTypes(),
          excludeAcceptAllOption: true,
          multiple: false,
        });
        if (!handle) return false;
        if (!await confirmDocumentReplacement()) return false;
        const expectedContentSignature = documentContentSignature(serializeModel());
        // Re-read after saving: the chosen file may be the current save target.
        const file = await handle.getFile();
        const opened = await importFileData(file, { expectedContentSignature });
        if (!opened) return false;
        fileSession.setHandle(handle);
        updateDocumentNameUI();
        const message = applicationText(`ファイルを開きました: ${file.name}`, `Opened: ${file.name}`);
        setHint(message);
        log(message);
        return true;
      } catch (error) {
        if (filePickerCanceled(error)) {
          setHint("ファイルを開く操作をキャンセルしました");
          return false;
        }
        const message = applicationText(`ファイル読み込みに失敗しました: ${error.message}`, `Failed to open the file: ${error.message}`);
        setHint(message, "error");
        log(message);
        return false;
      } finally {
        fileSession.finishOpen();
      }
    }

    async function fileInputChanged(event) {
      const input = event.currentTarget;
      const file = input.files?.[0] || null;
      input.value = "";
      if (!file || !fileSession.beginOpen()) return;
      try {
        if (!await confirmDocumentReplacement()) return;
        const opened = await importFileData(file, { expectedContentSignature: documentContentSignature(serializeModel()) });
        if (!opened) return;
        fileSession.setHandle(null);
        updateDocumentNameUI();
        const message = applicationText(`ファイルを開きました: ${file.name}`, `Opened: ${file.name}`);
        setHint(message);
        log(message);
      } catch (error) {
        setHint(applicationText(`ファイル読み込みに失敗しました: ${error.message}`, `Failed to open the file: ${error.message}`), "error");
      } finally {
        fileSession.finishOpen();
      }
    }
    function beforeUnload(event) {
      const dirty = isEditingBlock() || fileSession.savePending || !fileSession.matchesCheckpoint(serializeModel());
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    return Object.freeze({ beforeUnload, save: saveJot2DFile, saveAs: saveJot2DFileAs, open: openJot2DFile, fileInputChanged });
  }
  window.DocumentFileCommand = Object.freeze({ create });
})();

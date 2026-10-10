/* Coordinate browser file operations; codecs, file state and model loading have separate owners. */
(() => {
  "use strict";
  const { JOT2D_FILE_EXTENSION, JOT2D_FILE_MIME_TYPE, safeDownloadBaseName,
    documentContentSignature, writeJot2DFile } = window.DocumentFiles;
  function create({ window, document, fileSession, choiceDialog, applicationText,
    isEditingBlock, getDocumentName, serializeModel, applyLoadedDocument,
    markDocumentFileCheckpoint, updateDocumentNameUI, setHint, log, bookmarks }) {
    let linkedHandle = null;
    let linkGeneration = 0;

    function linksSupported() {
      const prototype = window.FileSystemFileHandle?.prototype;
      return Boolean(bookmarks && window.indexedDB && window.crypto?.randomUUID
        && typeof window.showOpenFilePicker === "function"
        && typeof prototype?.isSameEntry === "function"
        && typeof prototype?.queryPermission === "function"
        && typeof prototype?.requestPermission === "function");
    }

    function replaceDocumentId(id = null) {
      try {
        const url = new window.URL(window.location.href);
        if (id) url.searchParams.set("document", id);
        else url.searchParams.delete("document");
        if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
      } catch (_error) {
        // Optional URL updates must never turn a successful file operation into a failure.
      }
    }

    async function synchronizeDocumentLink(handle) {
      const generation = ++linkGeneration;
      linkedHandle = null;
      const retry = document.getElementById("openDocumentLinkBtn");
      if (retry) retry.hidden = true;
      replaceDocumentId();
      if (!handle || !linksSupported()) return;
      try {
        const id = await bookmarks.register(handle);
        if (generation === linkGeneration && fileSession.handle === handle) replaceDocumentId(id);
      } catch (_error) {
        // Reading and saving do not depend on registration storage being available.
      }
    }

    async function copyDocumentLink() {
      if (!linksSupported()) return false;
      const handle = fileSession.handle;
      if (!handle || !bookmarks) {
        setHint(applicationText("ファイルを開くか、名前を付けて保存してからリンクを作成してください", "Open a file or Save As before creating a link."), "error");
        return false;
      }
      try {
        const id = await bookmarks.register(handle);
        const url = new window.URL(window.location.href);
        url.search = "";
        url.hash = "";
        url.searchParams.set("document", id);
        const input = document.getElementById("documentLinkInput");
        const dialog = document.getElementById("documentLinkDialog");
        if (input && dialog) {
          input.value = url.href;
          const link = document.getElementById("documentLinkOpen");
          if (link) link.href = url.href;
          if (!dialog.open) dialog.showModal();
          input.focus();
          input.select();
        }
        try {
          await window.navigator.clipboard.writeText(url.href);
          setHint(applicationText("図面のリンクをコピーしました。Chromeのブックマークに登録できます", "Drawing link copied. Add it as a Chrome bookmark."));
        } catch (_error) {
          setHint(applicationText("専用リンクを作成しました。表示されたURLをコピーしてください", "Drawing link created. Copy the displayed URL."));
        }
        return url.href;
      } catch (error) {
        setHint(applicationText(`図面のリンクを作成できません: ${error.message}`, `Unable to create drawing link: ${error.message}`), "error");
        return false;
      }
    }

    async function openLinkedDocument({ requestPermission = true } = {}) {
      if (!linkedHandle || isEditingBlock() || !fileSession.beginOpen()) return false;
      const handle = linkedHandle;
      try {
        // Request immediately from the retry button/dialog click, before asynchronous file reads.
        const permission = requestPermission
          ? await handle.requestPermission({ mode: "read" })
          : await handle.queryPermission({ mode: "read" });
        if (permission !== "granted") {
          setHint(applicationText("図面を開くにはファイルへのアクセス許可が必要です。ファイルメニューから再試行できます", "File access is required. Retry from the File menu."), "error");
          return false;
        }
        if (!await confirmDocumentReplacement()) return false;
        const expectedContentSignature = documentContentSignature(serializeModel());
        const file = await handle.getFile();
        if (!await importFileData(file, { expectedContentSignature })) return false;
        fileSession.setHandle(handle);
        updateDocumentNameUI();
        await synchronizeDocumentLink(fileSession.handle);
        setHint(applicationText(`ファイルを開きました: ${file.name}`, `Opened: ${file.name}`));
        return true;
      } catch (error) {
        setHint(applicationText(`リンクの図面を開けません: ${error.message}`, `Unable to open linked drawing: ${error.message}`), "error");
        return false;
      } finally {
        fileSession.finishOpen();
      }
    }

    async function openStartupDocument() {
      const supported = linksSupported();
      const copyButton = document.getElementById("copyDocumentLinkBtn");
      if (copyButton) copyButton.hidden = !supported;
      if (!supported) { replaceDocumentId(); return false; }
      const id = new window.URLSearchParams(window.location.search).get("document");
      if (!id || !bookmarks) return false;
      const generation = linkGeneration;
      try {
        const registration = await bookmarks.get(id);
        if (generation !== linkGeneration) return false;
        linkedHandle = registration?.handle || null;
        if (!linkedHandle) {
          setHint(applicationText("この図面の登録情報がありません。元のファイルを開いてリンクを作り直してください", "This drawing is not registered here. Open the original file and create a new link."), "error");
          return false;
        }
        const button = document.getElementById("openDocumentLinkBtn");
        if (button) button.hidden = false;
        if (await linkedHandle.queryPermission({ mode: "read" }) === "granted") return await openLinkedDocument({ requestPermission: false });
        const choice = await choiceDialog.show({
          title: applicationText("リンクの図面を開く", "Open linked drawing"),
          message: applicationText(`${linkedHandle.name} へのアクセスを許可して開きます`, `Allow access to ${linkedHandle.name} and open it.`),
          choices: [{ value: "open", label: applicationText("許可して開く", "Allow and open") }],
          defaultValue: "open", cancelLabel: applicationText("キャンセル", "Cancel"),
        });
        return choice === "open" ? await openLinkedDocument() : false;
      } catch (error) {
        setHint(applicationText(`リンクの図面を開けません: ${error.message}`, `Unable to open linked drawing: ${error.message}`), "error");
        return false;
      }
    }
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
        await synchronizeDocumentLink(handle);
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
        await synchronizeDocumentLink(handle);
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
        await synchronizeDocumentLink(null);
        const message = applicationText(`ファイルを開きました: ${file.name}`, `Opened: ${file.name}`);
        setHint(message);
        log(message);
      } catch (error) {
        setHint(applicationText(`ファイル読み込みに失敗しました: ${error.message}`, `Failed to open the file: ${error.message}`), "error");
      } finally {
        fileSession.finishOpen();
      }
    }
    function importFileData(file, { expectedContentSignature = null } = {}) {
      if (!file) return Promise.resolve(false);
      if (isEditingBlock()) {
        setHint("ブロック定義編集を終了してから読み込んでください", "error");
        return Promise.resolve(false);
      }

      return new Promise((resolve) => {
        const reader = new window.FileReader();
        reader.addEventListener("load", () => {
          try {
            if (isEditingBlock()) {
              setHint("ブロック定義編集を終了してから読み込んでください", "error");
              resolve(false);
              return;
            }
            if (expectedContentSignature !== null && documentContentSignature(serializeModel()) !== expectedContentSignature) {
              setHint(applicationText("読込待機中に図面が変更されたため、ファイルを開く操作を中止しました", "Opening was canceled because the drawing changed while the file was being read."));
              resolve(false);
              return;
            }
            applyLoadedDocument(JSON.parse(String(reader.result)), file.name);
            log(`ファイルを読み込みました: ${file.name}`);
            resolve(true);
          } catch (err) {
            setHint(`ファイル読み込みに失敗しました: ${err.message}`);
            log(`ファイル読み込みに失敗しました: ${err.message}`);
            resolve(false);
          }
        });
        reader.addEventListener("error", () => {
          setHint("ファイル読み込みに失敗しました");
          log("ファイル読み込みに失敗しました");
          resolve(false);
        });
        reader.readAsText(file);
      });
    }

    function beforeUnload(event) {
      const dirty = isEditingBlock() || fileSession.savePending || !fileSession.matchesCheckpoint(serializeModel());
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    return Object.freeze({ importFileData, beforeUnload, save: saveJot2DFile, saveAs: saveJot2DFileAs, open: openJot2DFile, fileInputChanged, copyDocumentLink, openLinkedDocument, openStartupDocument });
  }
  window.DocumentFileCommand = Object.freeze({ create });
})();

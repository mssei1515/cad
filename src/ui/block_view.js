/* Block list and editor chrome. Model changes are delegated to explicit actions. */
(() => {
  "use strict";
  function create({ document, escapeHtml, readEditing, blockDefinitionsInCurrentScope,
    blockDefinitionUsageCount, selectedDefinitionIds, startBlockPlacement, enterBlockDefinitionEdit,
    renameBlockDefinition, deleteBlockDefinition, completeBlockDefinitionEdit, cancelBlockDefinitionEdit,
    changeName, commitName, refresh, localizeApplicationUI }) {
    function render() {
      const editing = readEditing();
      const list = document.getElementById("blockList");
      const title = document.getElementById("blockOverlayTitle");
      const editorOverlay = document.getElementById("blockEditorOverlay");
      const nameInput = document.getElementById("blockEditorNameInput");
      const editorActions = document.getElementById("blockEditorActions");
      if (title) title.textContent = editing ? "ブロックエディタ" : "ブロック";
      if (editorOverlay) editorOverlay.hidden = !editing;
      if (nameInput) {
        nameInput.hidden = !editing;
        if (editing && document.activeElement !== nameInput) nameInput.value = editing.name;
      }
      if (editorActions) editorActions.hidden = !editing;
      if (!list) return;
      list.hidden = false;
      const scopedDefinitions = blockDefinitionsInCurrentScope();
      if (scopedDefinitions.length === 0) {
        list.innerHTML = '<div class="block-item"><span class="block-item-name" data-i18n-ja="ブロックはありません" data-i18n-en="No blocks">ブロックはありません</span></div>';
        return;
      }
      list.innerHTML = scopedDefinitions.map((definition) => {
        const count = blockDefinitionUsageCount(definition.id);
        return `<div class="block-item" data-id="${escapeHtml(definition.id)}"><span class="block-item-name" title="${escapeHtml(definition.name)}">${escapeHtml(definition.name)}</span><span class="block-item-count">${count}</span><button class="blockPlaceBtn" data-id="${escapeHtml(definition.id)}">配置</button><button class="blockEditBtn" data-id="${escapeHtml(definition.id)}">編集</button><button class="blockRenameBtn" data-id="${escapeHtml(definition.id)}">Aa</button><button class="blockDeleteBtn" data-id="${escapeHtml(definition.id)}">削除</button></div>`;
      }).join("");
      const selectedIds = new Set(selectedDefinitionIds());
      for (const row of document.querySelectorAll(".block-item[data-id]")) {
        const selected = selectedIds.has(row.dataset.id);
        row.classList.toggle("block-selected", selected);
        row.setAttribute("aria-selected", String(selected));
      }
      for (const button of document.querySelectorAll(".blockPlaceBtn")) button.addEventListener("click", () => {
        document.getElementById("blockDefinitionsDialog")?.close();
        startBlockPlacement(button.dataset.id);
      });
      for (const button of document.querySelectorAll(".blockEditBtn")) button.addEventListener("click", () => {
        document.getElementById("blockDefinitionsDialog")?.close();
        enterBlockDefinitionEdit(button.dataset.id);
      });
      for (const button of document.querySelectorAll(".blockRenameBtn")) button.addEventListener("click", () => renameBlockDefinition(button.dataset.id));
      for (const button of document.querySelectorAll(".blockDeleteBtn")) button.addEventListener("click", () => deleteBlockDefinition(button.dataset.id));
      for (const row of document.querySelectorAll(".block-item[data-id]")) row.addEventListener("dblclick", (event) => {
        if (!event.target.closest("button")) {
          document.getElementById("blockDefinitionsDialog")?.close();
          enterBlockDefinitionEdit(row.dataset.id);
        }
      });
    }
    function bind() {
      document.getElementById("openBlockDefinitionsBtn")?.addEventListener("click", () => {
        refresh();
        const dialog = document.getElementById("blockDefinitionsDialog");
        if (dialog && !dialog.open) {
          localizeApplicationUI(dialog);
          dialog.showModal();
        }
      });
      document.getElementById("completeBlockEditBtn")?.addEventListener("click", completeBlockDefinitionEdit);
      document.getElementById("cancelBlockEditBtn")?.addEventListener("click", cancelBlockDefinitionEdit);
      document.getElementById("blockEditorNameInput")?.addEventListener("input", (event) => {
        if (!changeName(event.target.value)) return;
        const title = document.getElementById("blockOverlayTitle");
        if (title) title.textContent = "ブロックエディタ";
      });
      document.getElementById("blockEditorNameInput")?.addEventListener("change", () => {
        commitName();
      });
    }
    return Object.freeze({ render, bind });
  }
  window.BlockView = Object.freeze({ create });
})();

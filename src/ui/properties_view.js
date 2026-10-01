/* Owns Properties DOM lifecycle and section expansion state. Editing is delegated. */
(() => {
  "use strict";
  function create({ document, applicationText, localizeApplicationUI, installExpressionInputHighlights,
    content, onInput, onChange, onClick }) {
    const sketchAppearanceSectionOpenState = { general: false, construction: false, dimension: false };
    function collapsibleSketchAppearanceSection(key, labelJa, labelEn, content, attributes = "") {
      const open = sketchAppearanceSectionOpenState[key] === true ? " open" : "";
      return `<details class="property-section property-section-collapsible" data-property-section="${key}"${attributes}${open}><summary><h3>${applicationText(labelJa, labelEn)}</h3></summary><div class="property-section-content">${content}</div></details>`;
    }

    function render(target) {
      const panel = document.getElementById("propertiesPanel");
      if (!panel) return;
      if (!target.item && target.kind !== "multiple") {
        panel.innerHTML = '<p class="properties-empty">選択したオブジェクトのプロパティを表示します。</p>';
        localizeApplicationUI(panel);
        return;
      }
      panel.innerHTML = content(target);
      localizeApplicationUI(panel);
      if (target.readOnly) {
        panel.insertAdjacentHTML("afterbegin", `<p class="properties-read-only">${applicationText("読み取り専用：編集するには所属スケッチをアクティブにしてください", "Read-only: activate the owning sketch to edit")}</p>`);
        for (const control of panel.querySelectorAll("input, select, textarea, button")) control.disabled = true;
      }
      if (target.kind === "sketch" && target.active) {
        for (const control of panel.querySelectorAll('[data-appearance-key="visible"]')) {
          if (!control.closest("[data-sketch-default-appearance]")) control.disabled = true;
        }
      }
      if (target.kind === "multiple") {
        for (const checkbox of panel.querySelectorAll('input[type="checkbox"][data-mixed="true"]')) checkbox.indeterminate = true;
      } else {
        installExpressionInputHighlights(panel);
        for (const section of panel.querySelectorAll(".property-section-collapsible[data-property-section]")) {
          section.querySelector("summary")?.addEventListener("click", () => {
            sketchAppearanceSectionOpenState[section.dataset.propertySection] = !section.open;
          });
          section.addEventListener("toggle", () => {
            if (!section.isConnected) return;
            sketchAppearanceSectionOpenState[section.dataset.propertySection] = section.open;
          });
        }
      }
      panel.oninput = onInput;
      panel.onchange = onChange;
      panel.onclick = onClick;
    }
    return Object.freeze({ render, collapsibleSketchAppearanceSection });
  }
  window.PropertiesView = Object.freeze({ create });
})();

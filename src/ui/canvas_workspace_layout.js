/* Canvas size and Properties panel presentation; no model editing or history. */
(() => {
  "use strict";
  function create({ canvas, document, viewport, syncCanvasBitmapSize, applySketchTreeWidth, draw,
    isValueInputPending, syncDimensionValueInput, currentCanvasCenterWorld, applicationText, readLanguage }) {
    function resizeCanvas(options = {}) {
      const rect = canvas.getBoundingClientRect();
      syncCanvasBitmapSize(rect.width, rect.height);
      if (options.centerWorld && rect.width > 0 && rect.height > 0) {
        viewport.update({ x: rect.width / 2 - options.centerWorld.x * viewport.scale });
        viewport.update({ y: rect.height / 2 - options.centerWorld.y * viewport.scale });
      }
      applySketchTreeWidth();
      draw();
      if (isValueInputPending()) syncDimensionValueInput();
    }


    function setPropertiesPanelCollapsed(collapsed) {
      const workspace = document.querySelector(".workspace");
      const button = document.getElementById("togglePropertiesPanelBtn");
      if (!workspace || !button) return;
      const centerWorld = currentCanvasCenterWorld();
      const label = applicationText("プロパティ", "Properties");
      workspace.classList.toggle("properties-collapsed", collapsed);
      button.setAttribute("aria-expanded", String(!collapsed));
      const actionLabel = readLanguage() === "en" ? `${collapsed ? "Expand" : "Collapse"} ${label}` : `${label}を${collapsed ? "展開" : "最小化"}`;
      button.setAttribute("aria-label", actionLabel);
      button.title = actionLabel;
      resizeCanvas({ centerWorld });
    }
    return Object.freeze({ resizeCanvas, setPropertiesPanelCollapsed });
  }
  window.CanvasWorkspaceLayout = Object.freeze({ create });
})();

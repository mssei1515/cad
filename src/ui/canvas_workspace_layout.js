/* Canvas size and Properties panel presentation; no model editing or history. */
(() => {
  "use strict";
  function create({ canvas, document, viewport, syncCanvasBitmapSize, applySketchTreeWidth, draw,
    isValueInputPending, syncDimensionValueInput, currentCanvasCenterWorld, applicationText, readLanguage,
    window: browserWindow, updatePropertiesUI, setHint, closeContextMenu }) {
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
    function showSelectedObjectProperties() {
      setPropertiesPanelCollapsed(false);
      updatePropertiesUI();
      const panel = document.getElementById("propertiesPanel");
      if (panel) panel.scrollTop = 0;
      setHint(applicationText("選択したオブジェクトのプロパティを表示します。", "Select an object to display its properties."));
    }
    function togglePropertiesPanel() {
      const workspace = document.querySelector(".workspace");
      setPropertiesPanelCollapsed(!workspace?.classList.contains("properties-collapsed"));
    }
    function onResize() {
      closeContextMenu();
      resizeCanvas({ centerWorld: currentCanvasCenterWorld() });
    }
    let controlsBound = false, windowBound = false, toggleButton = null;
    function bindControls() {
      if (controlsBound) return;
      controlsBound = true;
      toggleButton = document.getElementById("togglePropertiesPanelBtn");
      toggleButton?.addEventListener("click", togglePropertiesPanel);
    }
    function bindWindow() {
      if (windowBound) return;
      windowBound = true;
      browserWindow.addEventListener("resize", onResize);
    }
    function dispose() {
      toggleButton?.removeEventListener("click", togglePropertiesPanel);
      if (windowBound) browserWindow.removeEventListener("resize", onResize);
      controlsBound = windowBound = false;
      toggleButton = null;
    }
    return Object.freeze({ resizeCanvas, setPropertiesPanelCollapsed, showSelectedObjectProperties, bindControls, bindWindow, dispose });
  }
  window.CanvasWorkspaceLayout = Object.freeze({ create });
})();

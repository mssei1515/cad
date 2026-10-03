/* Place prepared reference images in the current editing scope. */
(() => {
  "use strict";
  const { REFERENCE_IMAGE_MAX_SIDE_PX } = window.ReferenceImageData;
  function create({ referenceImageImport, canvas, viewport, screenToWorld, currentScope, activeSketchId, nextId,
    canCreateInActiveSketch, clearSelection, canvasSelection, updateUI, draw, recordHistory, setHint, applicationText }) {
    async function importReferenceImageFile(file) {
      if (!file) return false;
      if (!canCreateInActiveSketch()) {
        setHint(applicationText("画像を所属させる子スケッチをアクティブにしてください", "Activate a child sketch for the image"), "error");
        return false;
      }
      try {
        const prepared = await referenceImageImport.prepare(file);
        const rect = canvas.getBoundingClientRect();
        const screenScale = Math.min(Math.max(80, rect.width * 0.68) / prepared.pixelWidth, Math.max(80, rect.height * 0.68) / prepared.pixelHeight);
        const center = screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
        const item = {
          id: nextId(),
          name: String(file.name || "Image").replace(/\.[^.]+$/, "") || "Image",
          sketchId: activeSketchId(),
          mimeType: prepared.mimeType,
          dataUrl: prepared.dataUrl,
          pixelWidth: prepared.pixelWidth,
          pixelHeight: prepared.pixelHeight,
          x: center.x,
          y: center.y,
          scale: screenScale / viewport.scale,
          rotation: 0,
          opacity: 0.5,
          visible: true,
          locked: false,
        };
        currentScope().referenceImages.push(item);
        clearSelection();
        canvasSelection.set("referenceImages", [item]);
        updateUI({ refreshAnalysis: false });
        draw();
        recordHistory("画像読み込み");
        setHint(prepared.resized
          ? applicationText(`画像を読み込み、長辺${REFERENCE_IMAGE_MAX_SIDE_PX}px以下に縮小しました`, `Image loaded and resized to at most ${REFERENCE_IMAGE_MAX_SIDE_PX}px on the long side`)
          : applicationText("画像を読み込みました", "Image loaded"));
        return true;
      } catch (error) {
        setHint(applicationText(`画像の読み込みに失敗しました: ${error.message}`, `Failed to load image: ${error.message}`), "error");
        return false;
      }
    }

    return Object.freeze({ importFile: importReferenceImageFile });
  }
  window.ReferenceImageCommand = Object.freeze({ create });
})();

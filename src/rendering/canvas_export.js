/* Re-render at output resolution and restore the interactive bitmap synchronously. */
(() => {
  "use strict";
  function create({ canvas, createCanvas, render, restore, text }) {
    function capture(region, pixelsPerMm = 96 / 25.4) {
      const size = window.ExportRegion.pixelSize(region, pixelsPerMm);
      if (!size?.supported) throw new Error(text("出力サイズが大きすぎます。範囲またはDPIを小さくしてください", "Output is too large. Reduce the region or resolution"));
      const output = createCanvas();
      output.width = size.width;
      output.height = size.height;
      const target = output.getContext("2d");
      if (!target) throw new Error(text("画像の描画領域を作成できませんでした", "Could not create the image canvas"));
      const original = { width: canvas.width, height: canvas.height };
      try {
        canvas.width = size.width;
        canvas.height = size.height;
        render(region, { x: size.width / region.width, y: size.height / region.height });
        target.drawImage(canvas, 0, 0);
      } finally {
        canvas.width = original.width;
        canvas.height = original.height;
        restore();
      }
      return output;
    }
    return Object.freeze({ capture });
  }
  window.CanvasExport = Object.freeze({ create });
})();

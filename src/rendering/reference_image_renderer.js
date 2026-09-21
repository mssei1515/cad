/* Reference-image resources and Canvas painting; visibility and selection are caller-owned. */
(function () {
  "use strict";
  function create({ ctx, viewport, withCanvasState, createImage, onImageLoad, referenceImageCorners }) {
    const images = new Map();
    function cachedImage(item) {
      let image = images.get(item.dataUrl);
      if (image) return image;
      image = createImage();
      image.addEventListener("load", onImageLoad, { once: true });
      image.src = item.dataUrl;
      images.set(item.dataUrl, image);
      return image;
    }
    function clear() { images.clear(); }
    function drawImages(items) {
      for (const item of items) {
        const image = cachedImage(item);
        if (!image.complete || image.naturalWidth < 1) continue;
        withCanvasState(() => {
          ctx.translate(item.x, item.y);
          ctx.rotate(item.rotation);
          ctx.scale(item.scale, item.scale);
          ctx.globalAlpha = item.opacity;
          ctx.drawImage(image, -item.pixelWidth / 2, -item.pixelHeight / 2, item.pixelWidth, item.pixelHeight);
        });
      }
    }
    function drawOverlays(item, selected, calibrationPoints = null) {
      if (item) {
        const corners = referenceImageCorners(item);
        withCanvasState(() => {
          ctx.strokeStyle = selected ? "#2563eb" : "#0ea5e9";
          ctx.lineWidth = 1.5 / viewport.scale;
          ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          for (let index = 1; index < corners.length; index += 1) ctx.lineTo(corners[index].x, corners[index].y);
          ctx.closePath();
          ctx.stroke();
          if (item.locked) {
            ctx.setLineDash([]);
            ctx.fillStyle = "#2563eb";
            ctx.font = `${14 / viewport.scale}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🔒", item.x, item.y);
          }
        });
      }
      if (calibrationPoints) {
        withCanvasState(() => {
          ctx.strokeStyle = "#f97316";
          ctx.fillStyle = "#fff7ed";
          ctx.lineWidth = 2 / viewport.scale;
          if (calibrationPoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
            ctx.lineTo(calibrationPoints[1].x, calibrationPoints[1].y);
            ctx.stroke();
          }
          for (const point of calibrationPoints) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5 / viewport.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        });
      }
    }
    return Object.freeze({ clear, drawImages, drawOverlays });
  }
  window.ReferenceImageRenderer = Object.freeze({ create });
})();

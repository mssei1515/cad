/* Read and resize supported images before any document mutation. */
(() => {
  "use strict";
  const { referenceImageMimeType, REFERENCE_IMAGE_MAX_SIDE_PX } = window.ReferenceImageData;
  function create({ window, document, applicationText }) {
    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new window.FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result)));
        reader.addEventListener("error", () => reject(reader.error || new Error(applicationText("画像を読み込めません", "The image could not be read"))));
        reader.readAsDataURL(file);
      });
    }

    function decodeImageDataUrl(dataUrl) {
      return new Promise((resolve, reject) => {
        const image = new window.Image();
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener("error", () => reject(new Error(applicationText("画像をデコードできません", "The image could not be decoded"))), { once: true });
        image.src = dataUrl;
      });
    }

    async function preparedReferenceImageData(file) {
      const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
      const fallbackMimeType = extension === "png" ? "image/png" : ["jpg", "jpeg"].includes(extension) ? "image/jpeg" : extension === "webp" ? "image/webp" : null;
      const mimeType = referenceImageMimeType(file?.type) || fallbackMimeType;
      if (!mimeType) throw new Error(applicationText("PNG、JPEG、WebP画像を選択してください", "Select a PNG, JPEG, or WebP image"));
      const readDataUrl = await readFileAsDataUrl(file);
      const dataSeparatorIndex = readDataUrl.indexOf(",");
      if (dataSeparatorIndex < 0) throw new Error(applicationText("画像データの形式が正しくありません", "Invalid image data"));
      const originalDataUrl = `data:${mimeType};base64,${readDataUrl.slice(dataSeparatorIndex + 1)}`;
      const decoded = await decodeImageDataUrl(originalDataUrl);
      const ratio = Math.min(1, REFERENCE_IMAGE_MAX_SIDE_PX / Math.max(decoded.naturalWidth, decoded.naturalHeight));
      if (ratio >= 1) return { dataUrl: originalDataUrl, mimeType, pixelWidth: decoded.naturalWidth, pixelHeight: decoded.naturalHeight, resized: false };
      const pixelWidth = Math.max(1, Math.round(decoded.naturalWidth * ratio));
      const pixelHeight = Math.max(1, Math.round(decoded.naturalHeight * ratio));
      const resizeCanvas = document.createElement("canvas");
      resizeCanvas.width = pixelWidth;
      resizeCanvas.height = pixelHeight;
      resizeCanvas.getContext("2d").drawImage(decoded, 0, 0, pixelWidth, pixelHeight);
      return { dataUrl: resizeCanvas.toDataURL(mimeType, 0.92), mimeType, pixelWidth, pixelHeight, resized: true };
    }

    return Object.freeze({ prepare: preparedReferenceImageData });
  }
  window.ReferenceImageImport = Object.freeze({ create });
})();

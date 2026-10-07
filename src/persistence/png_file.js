/* PNG output has its own destination and does not mark the Document saved. */
(() => {
  "use strict";
  function create({ window, document, capture, documentName, text, prepare = async () => {} }) {
    async function save(region, pixelsPerMm) {
      const name = `${window.DocumentFiles.safeDownloadBaseName(documentName())}.png`;
      let handle = null;
      if (typeof window.showSaveFilePicker === "function") {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "PNG", accept: { "image/png": [".png"] } }] });
      }
      await prepare();
      const bitmap = capture(region, pixelsPerMm);
      const blob = await new Promise((resolve, reject) => bitmap.toBlob(value => value ? resolve(value)
        : reject(new Error(text("PNG画像を生成できませんでした", "Could not create the PNG image"))), "image/png"));
      if (handle) {
        await window.DocumentFiles.writeJot2DFile(handle, blob);
        return "saved";
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      try { link.click(); } finally {
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      }
      return "download";
    }
    return Object.freeze({ save });
  }
  window.PngFile = Object.freeze({ create });
})();

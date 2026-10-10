/* Route native image paste and menu paste through reference-image import. */
(() => {
  "use strict";
  const marker = "Jot2D internal selection";
  function create({ window, importFile, pasteGeometry, copyGeometry, isGeometryMode, isTextEditingTarget, setHint, applicationText }) {
    const supported = type => ["image/png", "image/jpeg", "image/webp"].includes(type);
    function paste(event) {
      if (!isGeometryMode() || isTextEditingTarget(event.target)) return;
      if (event.clipboardData?.getData("text/plain") === marker) { event.preventDefault(); pasteGeometry(); return; }
      const files = [...(event.clipboardData?.files || [])];
      const image = files.find(file => supported(file.type));
      event.preventDefault();
      if (image) void importFile(image);
      else if (files.some(file => file.type.startsWith("image/"))) {
        setHint(applicationText("PNG、JPEG、WebP画像を貼り付けてください", "Paste a PNG, JPEG, or WebP image"), "error");
      } else pasteGeometry();
    }
    function copy(event) {
      if (!isGeometryMode() || isTextEditingTarget(event.target)) return;
      if (!copyGeometry({ cut: event.type === "cut" })) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", marker);
    }
    function markCopy() {
      if (window.navigator.clipboard?.writeText) void window.navigator.clipboard.writeText(marker).catch(() => {});
    }
    async function pasteFromMenu() {
      if (!isGeometryMode()) return false;
      if (window.navigator.clipboard?.read) {
        try {
          const items = await window.navigator.clipboard.read();
          for (const item of items) {
            const type = item.types.find(supported);
            if (type) return await importFile(new window.File([await item.getType(type)], "Clipboard image", { type }));
          }
        } catch (_) {
          // Browser clipboard permissions do not affect native Ctrl+V paste.
        }
      }
      if (pasteGeometry()) return true;
      setHint(applicationText("画像の貼り付けには Ctrl+V を使用してください", "Use Ctrl+V to paste an image"), "error");
      return false;
    }
    return Object.freeze({ paste, copy, markCopy, pasteFromMenu });
  }
  window.ImageClipboard = Object.freeze({ create });
})();

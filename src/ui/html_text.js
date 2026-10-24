/* Encode shared UI text for HTML without model, DOM or mutable application state. */
(() => {
  "use strict";
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }
  window.HtmlText = Object.freeze({ escapeHtml });
})();

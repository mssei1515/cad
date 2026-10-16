/* Decorate expression inputs while leaving symbol resolution and evaluation to callers. */
(() => {
  "use strict";
  function create({ document, InputElement, referenceNamesForInput, escapeHtml }) {
    function expressionHighlightMarkup(input) {
      const value = String(input?.value ?? "");
      if (!value.trimStart().startsWith("=")) return escapeHtml(value);
      const names = referenceNamesForInput(input);
      const pattern = /"([A-Za-z_][A-Za-z0-9_]*)"/g;
      let result = "";
      let cursor = 0;
      for (const match of value.matchAll(pattern)) {
        result += escapeHtml(value.slice(cursor, match.index));
        const token = match[0];
        result += names.has(match[1])
          ? `<span class="expression-reference-token">${escapeHtml(token)}</span>`
          : escapeHtml(token);
        cursor = match.index + token.length;
      }
      return result + escapeHtml(value.slice(cursor));
    }

    function syncExpressionInputHighlight(input) {
      if (!(input instanceof InputElement)) return;
      const shell = input.closest(".expression-input-shell");
      const text = shell?.querySelector(".expression-input-highlight-text");
      if (!text) return;
      text.innerHTML = expressionHighlightMarkup(input) || "&#8203;";
      text.style.transform = `translateX(${-input.scrollLeft}px)`;
    }

    function installExpressionInputHighlight(input) {
      if (!(input instanceof InputElement) || input.readOnly) return;
      let shell = input.closest(".expression-input-shell");
      if (!shell) {
        shell = document.createElement("span");
        shell.className = "expression-input-shell";
        const highlight = document.createElement("span");
        highlight.className = "expression-input-highlight";
        highlight.setAttribute("aria-hidden", "true");
        const text = document.createElement("span");
        text.className = "expression-input-highlight-text";
        highlight.append(text);
        input.before(shell);
        shell.append(highlight, input);
      }
      input.classList.add("expression-input-source");
      if (input.dataset.expressionHighlightInstalled !== "true") {
        input.dataset.expressionHighlightInstalled = "true";
        input.addEventListener("input", () => syncExpressionInputHighlight(input));
        input.addEventListener("scroll", () => syncExpressionInputHighlight(input));
      }
      syncExpressionInputHighlight(input);
    }

    function installExpressionInputHighlights(root = document) {
      const selector = '#dimensionValueInput, #propertiesPanel [data-property="constraint-expression"], #propertiesPanel [data-property="annotation-expression"], [data-parameter-field="expression"], [data-dimension-field="expression"]:not([readonly])';
      if (root instanceof InputElement && root.matches(selector)) installExpressionInputHighlight(root);
      for (const input of root.querySelectorAll?.(selector) || []) installExpressionInputHighlight(input);
    }

    function refreshExpressionInputHighlights(root = document) {
      for (const input of root.querySelectorAll?.(".expression-input-source") || []) syncExpressionInputHighlight(input);
    }


    return Object.freeze({
      sync: syncExpressionInputHighlight, install: installExpressionInputHighlights, refresh: refreshExpressionInputHighlights,
    });
  }
  // Insert a reference and preserve browser input, blur/change, focus and caret behavior.
  function createInsertion({ Event: EventType, formatParameterReference }) {
    function insertIdentifierIntoExpressionInput(input, identifier) {
      let value = String(input.value ?? "");
      let start = Number.isInteger(input.selectionStart) ? input.selectionStart : value.length;
      let end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
      if (!value.trimStart().startsWith("=")) {
        value = `=${value}`;
        start += 1;
        end += 1;
      } else if (value.startsWith("=")) {
        start = Math.max(1, start);
        end = Math.max(1, end);
      }
      const identifierCharacter = /[A-Za-z0-9_]/;
      const leftPadding = start > 0 && identifierCharacter.test(value[start - 1]) ? " " : "";
      const rightPadding = end < value.length && identifierCharacter.test(value[end]) ? " " : "";
      const insertion = `${leftPadding}${formatParameterReference(identifier)}${rightPadding}`;
      input.value = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
      const caret = start + insertion.length;
      input.dispatchEvent(new EventType("input", { bubbles: true }));
      // Programmatic insertion alone does not make the browser emit change on blur.
      let changed = false;
      const onChange = () => { changed = true; };
      input.addEventListener("change", onChange, { once: true });
      input.addEventListener("blur", () => {
        if (!changed && input.isConnected) input.dispatchEvent(new EventType("change", { bubbles: true }));
        input.removeEventListener("change", onChange);
      }, { once: true });
      input.focus({ preventScroll: true });
      input.setSelectionRange(caret, caret);
    }
    return Object.freeze({ insert: insertIdentifierIntoExpressionInput });
  }
  window.ExpressionInputView = Object.freeze({ create, createInsertion });
})();

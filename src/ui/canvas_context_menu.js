/* Canvas menu session, candidate preview and DOM lifecycle; editing is supplied as actions. */
(() => {
  "use strict";
  function create({ document, window, canvas, menu: canvasContextMenu, escapeHtml, applicationText, presentCandidate, hover, onOpen, onSelect, onAction }) {
    let canvasContextTarget = null;
    let canvasContextPointer = null;
    let canvasContextCandidates = [];
    let canvasContextBaseHoverState = null;
    function closeCanvasContextMenu({ restoreHover = true } = {}) {
      if (!canvasContextMenu || canvasContextMenu.hidden) return false;
      canvasContextMenu.hidden = true;
      canvasContextMenu.innerHTML = "";
      canvasContextMenu.classList.remove("candidate-menu");
      if (canvasContextBaseHoverState) {
        if (restoreHover) hover.restore(canvasContextBaseHoverState);
        else hover.clear();
        hover.draw();
      }
      canvasContextTarget = null;
      canvasContextPointer = null;
      canvasContextCandidates = [];
      canvasContextBaseHoverState = null;
      return true;
    }

    function renderCanvasContextMenu(items) {
      if (!canvasContextMenu) return;
      canvasContextMenu.classList.remove("candidate-menu");
      canvasContextMenu.innerHTML = items.map((item) => item.separator
        ? '<div class="canvas-context-menu-separator" role="separator"></div>'
        : `<button type="button" role="menuitem" data-context-action="${item.action}" class="${item.danger ? "danger" : ""}" ${item.disabled ? "disabled" : ""}><span>${escapeHtml(item.label)}</span>${item.shortcut ? `<kbd>${escapeHtml(item.shortcut)}</kbd>` : ""}</button>`).join("");
    }

    function renderCanvasContextCandidates(candidates) {
      if (!canvasContextMenu) return;
      canvasContextMenu.classList.add("candidate-menu");
      const heading = applicationText("選択候補", "Selection Candidates");
      canvasContextMenu.innerHTML = `<div class="canvas-context-candidate-heading" role="presentation">${escapeHtml(heading)}<span>${candidates.length}</span></div>${candidates.map((target, index) => {
        const presentation = presentCandidate(target);
        const title = `${presentation.type} ${presentation.id}${presentation.secondary ? ` — ${presentation.secondary}` : ""}`;
        return `<button type="button" role="menuitem" class="canvas-context-candidate" data-context-candidate-index="${index}" title="${escapeHtml(title)}">${presentation.icon}<span class="canvas-context-candidate-content"><span class="canvas-context-candidate-primary"><span>${escapeHtml(presentation.type)}</span><strong>${escapeHtml(presentation.id)}</strong></span><span class="canvas-context-candidate-secondary">${escapeHtml(presentation.secondary)}</span></span></button>`;
      }).join("")}`;
    }

    function focusedCanvasContextCandidate() {
      const button = document.activeElement?.closest?.("[data-context-candidate-index]");
      if (!button || !canvasContextMenu?.contains(button)) return null;
      return canvasContextCandidates[Number(button.dataset.contextCandidateIndex)] || null;
    }

    function restoreFocusedCanvasContextCandidatePreview() {
      previewCanvasContextCandidate(focusedCanvasContextCandidate());
    }

    function open({ event, pointer, target, candidates, showCandidates, items }) {
      canvasContextTarget = target;
      canvasContextPointer = pointer;
      canvasContextCandidates = showCandidates ? candidates : [];
      canvasContextBaseHoverState = showCandidates ? hover.capture() : null;
      if (showCandidates) renderCanvasContextCandidates(candidates);
      else renderCanvasContextMenu(items);
      canvasContextMenu.setAttribute("aria-label", applicationText("キャンバスコンテキストメニュー", "Canvas context menu"));
      canvasContextMenu.hidden = false;
      canvasContextMenu.style.left = "0px";
      canvasContextMenu.style.top = "0px";
      const area = canvas.closest(".canvas-area")?.getBoundingClientRect();
      const bounds = canvasContextMenu.getBoundingClientRect();
      if (area) {
        const left = Math.max(4, Math.min(event.clientX - area.left, area.width - bounds.width - 4));
        const top = Math.max(4, Math.min(event.clientY - area.top, area.height - bounds.height - 4));
        canvasContextMenu.style.left = `${left}px`;
        canvasContextMenu.style.top = `${top}px`;
      }
      canvasContextMenu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    }

    function previewCanvasContextCandidate(target = null) {
      if (!canvasContextBaseHoverState) return;
      if (target) hover.preview(target);
      else { hover.restore(canvasContextBaseHoverState); hover.draw(); }
    }
    function selectCanvasContextCandidate(index) {
      const target = canvasContextCandidates[index];
      if (!target) return;
      const pointer = canvasContextPointer;
      closeCanvasContextMenu({ restoreHover: false });
      onSelect(target, pointer);
    }
    function executeCanvasContextAction(action) {
      const target = canvasContextTarget, pointer = canvasContextPointer;
      closeCanvasContextMenu();
      onAction(action, target, pointer);
    }
    let started = false;
    const listeners = [];
    function listen(target, type, handler) {
      if (!target) return;
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    }
    function start() {
      if (started) return;
      started = true;
      listen(canvasContextMenu, "click", (event) => {
        const candidateButton = event.target.closest("[data-context-candidate-index]");
        if (candidateButton) {
          selectCanvasContextCandidate(Number(candidateButton.dataset.contextCandidateIndex));
          return;
        }
        const button = event.target.closest("[data-context-action]");
        if (!button || button.disabled) return;
        executeCanvasContextAction(button.dataset.contextAction);
      });
      listen(canvasContextMenu, "pointerover", (event) => {
        const button = event.target.closest("[data-context-candidate-index]");
        if (!button || button.contains(event.relatedTarget)) return;
        button.focus({ preventScroll: true });
        previewCanvasContextCandidate(canvasContextCandidates[Number(button.dataset.contextCandidateIndex)] || null);
      });
      listen(canvasContextMenu, "pointerout", (event) => {
        const button = event.target.closest("[data-context-candidate-index]");
        if (!button || button.contains(event.relatedTarget)) return;
        restoreFocusedCanvasContextCandidatePreview();
      });
      listen(canvasContextMenu, "focusin", (event) => {
        const button = event.target.closest("[data-context-candidate-index]");
        if (button) previewCanvasContextCandidate(canvasContextCandidates[Number(button.dataset.contextCandidateIndex)] || null);
      });
      listen(canvasContextMenu, "focusout", (event) => {
        if (event.relatedTarget && canvasContextMenu.contains(event.relatedTarget)) return;
        previewCanvasContextCandidate();
      });
      listen(canvasContextMenu, "keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeCanvasContextMenu();
          return;
        }
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          const candidateButton = document.activeElement?.closest?.("[data-context-candidate-index]");
          if (candidateButton && canvasContextMenu.contains(candidateButton)) {
            event.preventDefault();
            event.stopPropagation();
            selectCanvasContextCandidate(Number(candidateButton.dataset.contextCandidateIndex));
          }
          return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...canvasContextMenu.querySelectorAll("button:not(:disabled)")];
        if (buttons.length === 0) return;
        const current = buttons.indexOf(document.activeElement);
        let next = current;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else if (event.key === "ArrowDown") next = (current + 1 + buttons.length) % buttons.length;
        else next = (current - 1 + buttons.length) % buttons.length;
        buttons[next].focus({ preventScroll: true });
      });
      listen(canvas, "contextmenu", onOpen);
      listen(document, "pointerdown", (event) => {
        if (!event.target.closest("#canvasContextMenu")) closeCanvasContextMenu();
      });
      listen(window, "blur", closeCanvasContextMenu);


    }
    function dispose() {
      for (const remove of listeners.splice(0)) remove();
      closeCanvasContextMenu();
      started = false;
    }
    return Object.freeze({ open, close: closeCanvasContextMenu, start, dispose, candidates: () => canvasContextCandidates.slice() });

  }
  window.CanvasContextMenu = Object.freeze({ create });
})();

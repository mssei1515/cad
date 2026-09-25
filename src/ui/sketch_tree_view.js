/* Sketch tree DOM, expansion state and resizing; editing actions are delegated. */
(() => {
  "use strict";
  function create({ document, sketchOverlay, sketchOverlayResizeHandle, getScopeKey,
    currentScope, ensureSketchState, isRootSketch, activeSketchId, applicationText, escapeHtml,
    objects, sketchHasSolveError, referenceConstraintErrorCountForSketch,
    constraintDuplicateCountForSketch, actions }) {
    const { index: sketchTreeObjectIndex, row: sketchTreeObjectRow,
      selected: sketchTreeObjectSelected, hovered: sketchTreeObjectHovered,
      summary: sketchConstraintSummaryMarkup } = objects;
    const sketchTreeSketchOpenState = new Map();
    const sketchTreeGroupOpenState = new Map();
    let sketchTreeWidth = 320;
    let sketchTreeResizeSession = null;
    const SKETCH_TREE_MIN_WIDTH = 220, SKETCH_TREE_MAX_WIDTH = 560, SKETCH_TREE_KEYBOARD_RESIZE_STEP = 16;
    function sketchTreeScopeKey() {
      return getScopeKey();
    }

    function sketchTreeSketchKey(sketchId) {
      return `${sketchTreeScopeKey()}|${sketchId}`;
    }

    function sketchTreeSketchIsOpen(sketch) {
      const key = sketchTreeSketchKey(sketch.id);
      return sketchTreeSketchOpenState.has(key)
        ? sketchTreeSketchOpenState.get(key) === true
        : isRootSketch(sketch);
    }

    function sketchTreeGroupKey(sketchId, category) {
      return `${sketchTreeScopeKey()}|${sketchId}|${category}`;
    }

    function sketchTreeSketchIcon() {
      return '<svg class="sketch-row-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7l7-4 7 4-7 4-7-4Z"/><path d="M5 12l7 4 7-4M5 17l7 4 7-4"/></svg>';
    }

    function sketchTreeWidthBounds() {
      const canvasAreaWidth = sketchOverlay?.parentElement?.getBoundingClientRect().width || SKETCH_TREE_MAX_WIDTH + 24;
      const max = Math.max(160, Math.min(SKETCH_TREE_MAX_WIDTH, canvasAreaWidth - 24));
      return { min: Math.min(SKETCH_TREE_MIN_WIDTH, max), max };
    }

    function applySketchTreeWidth(width = sketchTreeWidth) {
      if (!sketchOverlay) return 0;
      const bounds = sketchTreeWidthBounds();
      const actual = Math.max(bounds.min, Math.min(bounds.max, Number(width) || 320));
      sketchOverlay.style.width = `${actual}px`;
      if (sketchOverlayResizeHandle) {
        sketchOverlayResizeHandle.setAttribute("aria-valuemin", String(Math.round(bounds.min)));
        sketchOverlayResizeHandle.setAttribute("aria-valuemax", String(Math.round(bounds.max)));
        sketchOverlayResizeHandle.setAttribute("aria-valuenow", String(Math.round(actual)));
      }
      return actual;
    }

    function finishSketchTreeResize(pointerId = null) {
      if (!sketchTreeResizeSession) return;
      if (pointerId != null && sketchTreeResizeSession.pointerId !== pointerId) return;
      sketchTreeResizeSession = null;
      sketchOverlay?.classList.remove("resizing");
    }

    sketchOverlayResizeHandle?.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      sketchTreeResizeSession = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: sketchOverlay?.getBoundingClientRect().width || sketchTreeWidth,
      };
      sketchOverlay?.classList.add("resizing");
      sketchOverlayResizeHandle.setPointerCapture(event.pointerId);
    });
    sketchOverlayResizeHandle?.addEventListener("pointermove", (event) => {
      if (!sketchTreeResizeSession || sketchTreeResizeSession.pointerId !== event.pointerId) return;
      event.preventDefault();
      sketchTreeWidth = sketchTreeResizeSession.startWidth + event.clientX - sketchTreeResizeSession.startX;
      sketchTreeWidth = applySketchTreeWidth(sketchTreeWidth);
    });
    sketchOverlayResizeHandle?.addEventListener("pointerup", (event) => finishSketchTreeResize(event.pointerId));
    sketchOverlayResizeHandle?.addEventListener("pointercancel", (event) => finishSketchTreeResize(event.pointerId));
    sketchOverlayResizeHandle?.addEventListener("lostpointercapture", () => finishSketchTreeResize());
    sketchOverlayResizeHandle?.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const bounds = sketchTreeWidthBounds();
      if (event.key === "Home") sketchTreeWidth = bounds.min;
      else if (event.key === "End") sketchTreeWidth = bounds.max;
      else sketchTreeWidth += event.key === "ArrowRight" ? SKETCH_TREE_KEYBOARD_RESIZE_STEP : -SKETCH_TREE_KEYBOARD_RESIZE_STEP;
      sketchTreeWidth = applySketchTreeWidth(sketchTreeWidth);
    });
    applySketchTreeWidth();

    function updateSketchUIUnprofiled() {
      ensureSketchState();
      const model = currentScope();
      const activeLabel = document.getElementById("activeSketchLabel");
      if (activeLabel) activeLabel.textContent = applicationText("スケッチツリー", "Sketch Tree");
      const sketchList = document.getElementById("sketchList");
      if (!sketchList) return;
      const objectIndex = sketchTreeObjectIndex();
      const children = new Map();
      for (const sketch of model.sketches) {
        const key = sketch.parentSketchId || "";
        if (!children.has(key)) children.set(key, []);
        children.get(key).push(sketch);
      }
      const categoryDefinitions = [
        ["point", applicationText("点", "Point")], ["line", applicationText("線", "Line")], ["circle", applicationText("円", "Circle")],
        ["arc", applicationText("円弧", "Arc")], ["spline", applicationText("スプライン", "Spline")], ["hatch", applicationText("ハッチング", "Hatching")], ["image", applicationText("画像", "Image")], ["block", applicationText("ブロック", "Block")], ["instance", applicationText("派生インスタンス", "Derived Instance")], ["constraint", applicationText("拘束", "Constraint")], ["annotation", applicationText("注記", "Annotation")],
      ];
      const html = [];
      const renderSketch = (sketch, depth, ancestorHasNext, isLast) => {
        const groups = objectIndex.get(sketch.id) || { point: [], line: [], circle: [], arc: [], spline: [], hatch: [], image: [], block: [], instance: [], constraint: [], annotation: [] };
        const nonEmptyCategories = isRootSketch(sketch) ? [] : categoryDefinitions.filter(([category]) => groups[category].length > 0);
        const childSketches = children.get(sketch.id) || [];
        const hasGroups = nonEmptyCategories.length > 0;
        const open = hasGroups && sketchTreeSketchIsOpen(sketch);
        const segments = depth === 0 && isRootSketch(sketch) ? [] : [...ancestorHasNext.map((hasNext) => hasNext ? "pipe" : "blank"), isLast ? "elbow" : "tee"];
        const isActive = sketch.id === activeSketchId();
        const isRoot = isRootSketch(sketch);
        const visibilityEnabled = sketch.visible !== false;
        const solveError = sketchHasSolveError(sketch.id);
        const referenceErrorCount = referenceConstraintErrorCountForSketch(sketch.id);
        const duplicateCount = constraintDuplicateCountForSketch(sketch.id);
        const count = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
        const visibilityButton = isRoot ? "" : `<button class="sketchVisibilityBtn icon-small-btn ${visibilityEnabled ? "visible-on" : "visible-off"}" data-id="${sketch.id}" title="${visibilityEnabled ? applicationText("非表示にする", "Hide") : applicationText("表示する", "Show")}" aria-pressed="${visibilityEnabled}" ${isActive ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>${visibilityEnabled ? "" : '<path class="visibility-slash" d="M4 4l16 16"/>'}</svg></button>`;
        const expandButton = hasGroups
          ? `<button class="sketchExpandBtn" type="button" data-id="${escapeHtml(sketch.id)}" title="${applicationText(open ? "図形と拘束を折りたたむ" : "図形と拘束を展開する", open ? "Collapse objects and constraints" : "Expand objects and constraints")}" aria-label="${applicationText(open ? `${sketch.name}の図形と拘束を折りたたむ` : `${sketch.name}の図形と拘束を展開する`, `${open ? "Collapse" : "Expand"} objects and constraints in ${sketch.name}`)}" aria-expanded="${open}"><span class="sketch-expand-chevron" aria-hidden="true">${open ? "▼" : "▶"}</span></button>`
          : '<span class="sketch-expand-spacer" aria-hidden="true">▼</span>';
        const expandedAttribute = hasGroups ? ` aria-expanded="${open}"` : "";
        html.push(`<div class="item sketch-item ${isActive ? "active" : ""} ${visibilityEnabled ? "visible" : ""} ${solveError ? "solve-error" : ""} ${referenceErrorCount ? "reference-error" : ""} ${hasGroups ? "has-groups" : ""} ${open ? "open" : ""}" data-id="${escapeHtml(sketch.id)}" style="--sketch-depth:${depth}"${expandedAttribute}>${sketchTreeGutter(segments)}${expandButton}<button class="sketchActivateBtn" data-id="${escapeHtml(sketch.id)}" aria-current="${isActive}">${sketchTreeSketchIcon()}<span class="sketch-name">${escapeHtml(sketch.name)}</span></button><span class="sketch-badges">${solveError ? '<span class="badge">!</span>' : ""}${referenceErrorCount ? `<span class="badge sketch-reference-error-badge">${applicationText("参照", "Ref")}!${referenceErrorCount}</span>` : ""}${duplicateCount ? `<span class="badge">${applicationText("重複", "Duplicate")}${duplicateCount}</span>` : ""}<span class="badge">${count}</span></span>${visibilityButton}${isRoot ? "" : `<button class="sketchRenameBtn icon-small-btn" data-id="${escapeHtml(sketch.id)}" title="${applicationText("名前変更", "Rename")}">Aa</button><button class="sketchDeleteBtn icon-small-btn" data-id="${escapeHtml(sketch.id)}" title="${applicationText("スケッチ削除", "Delete sketch")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg></button>`}</div>`);
        const entries = [
          ...(open ? nonEmptyCategories.map(([category, label]) => ({ type: "category", category, label })) : []),
          ...childSketches.map((child) => ({ type: "sketch", sketch: child })),
        ];
        entries.forEach((entry, entryIndex) => {
          const entryLast = entryIndex === entries.length - 1;
          if (entry.type === "sketch") {
            renderSketch(entry.sketch, depth + 1, [...ancestorHasNext, !isLast], entryLast);
            return;
          }
          const key = sketchTreeGroupKey(sketch.id, entry.category);
          const open = sketchTreeGroupOpenState.get(key) === true;
          const items = groups[entry.category];
          const childSegments = [...ancestorHasNext.map((hasNext) => hasNext ? "pipe" : "blank"), !isLast ? "pipe" : "blank", entryLast ? "elbow" : "tee"];
          const hasState = items.some((item) => sketchTreeObjectSelected(entry.category, item) || sketchTreeObjectHovered(entry.category, item));
          html.push(`<div class="sketch-group-row ${open ? "open" : ""} ${hasState ? "has-active-descendant" : ""}" data-category="${entry.category}" data-sketch-id="${escapeHtml(sketch.id)}" aria-expanded="${open}">${sketchTreeGutter(childSegments)}<span class="sketch-group-chevron" aria-hidden="true">${open ? "▼" : "▶"}</span><span class="sketch-group-label">${escapeHtml(entry.label)}</span><span class="sketch-group-count">${items.length}</span></div>`);
          if (!open) return;
          if (entry.category === "constraint") {
            const summarySegments = [...childSegments.slice(0, -1), entryLast ? "blank" : "pipe", "tee"];
            html.push(sketchConstraintSummaryMarkup(sketch.id, groups, summarySegments));
          }
          items.forEach((item, itemIndex) => {
            const objectSegments = [...childSegments.slice(0, -1), entryLast ? "blank" : "pipe", itemIndex === items.length - 1 ? "elbow" : "tee"];
            html.push(sketchTreeObjectRow(entry.category, item, objectSegments, sketch.id));
          });
        });
      };
      const roots = children.get("") || model.sketches.filter((sketch) => !sketch.parentSketchId);
      roots.forEach((sketch, index) => renderSketch(sketch, 0, [], index === roots.length - 1));
      sketchList.innerHTML = html.join("");
      sketchList.onclick = actions.click;
      sketchList.onpointerover = actions.pointerOver;
      sketchList.onpointerout = actions.pointerOut;
      sketchList.onmouseleave = actions.leave;
    }

    function updateSketchTreeSelectionState() {
      const selectedConstraintElements = objects.selectedReferenceElements();
      for (const row of document.querySelectorAll("#sketchList .sketch-object-row")) {
        const category = row.dataset.objectKind;
        const entry = objects.resolveSelectionEntry(row.dataset);
        const selected = Boolean(entry && sketchTreeObjectSelected(category, entry));
        const hovered = Boolean(entry && sketchTreeObjectHovered(category, entry));
        const related = Boolean(entry && category === "constraint" && entry.kind !== "fixed-point"
          && objects.related(entry.constraint, selectedConstraintElements));
        row.classList.toggle("selected", selected);
        row.classList.toggle("sidebar-selected", selected);
        row.classList.toggle("sidebar-related", hovered || related);
      }
      const objectIndex = sketchTreeObjectIndex();
      for (const groupRow of document.querySelectorAll("#sketchList .sketch-group-row")) {
        const items = objectIndex.get(groupRow.dataset.sketchId)?.[groupRow.dataset.category] || [];
        groupRow.classList.toggle("has-active-descendant", items.some((item) =>
          sketchTreeObjectSelected(groupRow.dataset.category, item) || sketchTreeObjectHovered(groupRow.dataset.category, item),
        ));
      }
    }

    function reset() { sketchTreeSketchOpenState.clear(); sketchTreeGroupOpenState.clear(); }
    function capture() { return { sketches: new Map(sketchTreeSketchOpenState), groups: new Map(sketchTreeGroupOpenState) }; }
    function restore(snapshot) {
      reset();
      for (const [key, value] of snapshot.sketches) sketchTreeSketchOpenState.set(key, value);
      for (const [key, value] of snapshot.groups) sketchTreeGroupOpenState.set(key, value);
    }
    function toggleGroup(sketchId, category) {
      const key = sketchTreeGroupKey(sketchId, category);
      sketchTreeGroupOpenState.set(key, sketchTreeGroupOpenState.get(key) !== true);
    }
    function setSketchOpen(sketchId, open) { sketchTreeSketchOpenState.set(sketchTreeSketchKey(sketchId), open); }
    return Object.freeze({ refreshSelection: updateSketchTreeSelectionState, render: updateSketchUIUnprofiled, applyWidth: applySketchTreeWidth,
      reset, capture, restore, toggleGroup, setSketchOpen });
  }
  function sketchTreeGutter(segments) {
    return `<span class="sketch-tree-gutter" style="--tree-segment-count:${segments.length}" aria-hidden="true">${segments.map((segment) => `<span class="tree-segment ${segment}"></span>`).join("")}</span>`;
  }

  window.SketchTreeView = Object.freeze({ create, gutter: sketchTreeGutter });
})();

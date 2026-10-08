/* Sketch tree DOM, expansion state and resizing; editing actions are delegated. */
(() => {
  "use strict";
  function create({ document, sketchOverlay, sketchOverlayResizeHandle, getScopeKey,
    currentScope, ensureSketchState, isRootSketch, activeSketchId, applicationText, escapeHtml,
    objects, selectedSketchId = () => null, sketchHasSolveError, referenceConstraintErrorCountForSketch,
    constraintDuplicateCountForSketch, actions, moveState = () => null }) {
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
      if (activeLabel) { const target = model.sketches.find(sketch => sketch.id === activeSketchId()); activeLabel.textContent = `${applicationText("作図先", "Drawing sketch")}: ${target?.name || "—"}${target?.locked ? applicationText("（ロック中）", " (locked)") : ""}`; }
      const sketchList = document.getElementById("sketchList");
      if (!sketchList) return;
      const objectIndex = sketchTreeObjectIndex();
      const moving = moveState();
      const focused = moving && sketchList.contains(document.activeElement) ? document.activeElement : null;
      const focusedSketchId = focused?.classList.contains("sketchActivateBtn") ? focused.dataset.id : null;
      const focusedMoveAction = focused?.dataset.sketchMoveAction;
      const children = new Map();
      for (const sketch of model.sketches) {
        const key = sketch.parentSketchId || "";
        if (!children.has(key)) children.set(key, []);
        children.get(key).push(sketch);
      }
      const categoryDefinitions = [
        ["point", applicationText("点", "Point")], ["line", applicationText("線", "Line")], ["circle", applicationText("円", "Circle")],
        ["arc", applicationText("円弧", "Arc")], ["spline", applicationText("スプライン", "Spline")], ["hatch", applicationText("塗りつぶし", "Fill")], ["image", applicationText("画像", "Image")], ["block", applicationText("ブロック", "Block")], ["instance", applicationText("派生インスタンス", "Derived Instance")], ["constraint", applicationText("拘束", "Constraint")], ["annotation", applicationText("注記", "Annotation")],
      ];
      const html = [];
      if (moving) {
        const target = model.sketches.find(sketch => sketch.id === moving.targetId);
        html.push(`<div class="sketch-move-panel" role="region" aria-label="${applicationText("スケッチ間の移動", "Move between sketches")}"><strong>${applicationText(`${moving.count}個の図形を移動`, `Move ${moving.count} objects`)}</strong><span>${applicationText("移動先", "Destination")}: ${target ? escapeHtml(`${target.name} (${target.id})`) : applicationText("スケッチ行を選択してください", "Select a sketch row")}</span>${moving.reason ? `<span class="sketch-move-error" role="alert">${escapeHtml(moving.reason)}</span>` : ""}<div class="sketch-move-actions"><button type="button" data-sketch-move-action="commit" ${moving.canCommit ? "" : "disabled"}>${applicationText("移動", "Move")}</button><button type="button" data-sketch-move-action="cancel">${applicationText("取消", "Cancel")}</button></div></div>`);
      }
      const renderSketch = (sketch, depth, ancestorHasNext, isLast) => {
        const groups = objectIndex.get(sketch.id) || { point: [], line: [], circle: [], arc: [], spline: [], hatch: [], image: [], block: [], instance: [], constraint: [], annotation: [] };
        const nonEmptyCategories = isRootSketch(sketch) ? [] : categoryDefinitions.filter(([category]) => groups[category].length > 0);
        const childSketches = children.get(sketch.id) || [];
        const hasGroups = nonEmptyCategories.length > 0;
        const open = hasGroups && sketchTreeSketchIsOpen(sketch);
        const segments = depth === 0 && isRootSketch(sketch) ? [] : [...ancestorHasNext.map((hasNext) => hasNext ? "pipe" : "blank"), isLast ? "elbow" : "tee"];
        const isActive = sketch.id === activeSketchId();
        const isSelected = sketch.id === selectedSketchId();
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
        html.push(`<div class="item sketch-item ${isActive ? "active" : ""} ${isSelected ? "selected" : ""} ${visibilityEnabled ? "visible" : ""} ${solveError ? "solve-error" : ""} ${referenceErrorCount ? "reference-error" : ""} ${hasGroups ? "has-groups" : ""} ${open ? "open" : ""}" data-id="${escapeHtml(sketch.id)}" style="--sketch-depth:${depth}"${expandedAttribute}>${sketchTreeGutter(segments)}${expandButton}<button class="sketchActivateBtn" data-id="${escapeHtml(sketch.id)}" aria-current="${isActive}" aria-pressed="${isSelected}" title="${isRoot ? applicationText("クリックで選択", "Click to select") : applicationText("クリックで選択、ダブルクリックまたはAlt+Enterで作図先に指定", "Click to select; double-click or Alt+Enter to set drawing sketch")}">${sketchTreeSketchIcon()}<span class="sketch-name">${escapeHtml(sketch.name)}</span></button><span class="sketch-badges"><button type="button" class="sketchEditBtn" data-id="${escapeHtml(sketch.id)}" title="${applicationText("作図先", "Drawing sketch")}" ${moving || isActive || isRoot ? "hidden" : ""} ${isActive ? "disabled" : ""}>${applicationText("作図先", "Drawing sketch")}</button>${isActive && !isRoot ? `<span class="sketch-active-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 12-12 4 4-12 12H4Z"/><path d="m13 7 4 4"/></svg>${applicationText("作図先", "Drawing sketch")}</span>` : ""}${solveError ? '<span class="badge">!</span>' : ""}${referenceErrorCount ? `<span class="badge sketch-reference-error-badge">${applicationText("参照", "Ref")}!${referenceErrorCount}</span>` : ""}${duplicateCount ? `<span class="badge">${applicationText("重複", "Duplicate")}${duplicateCount}</span>` : ""}<span class="badge">${count}</span></span>${visibilityButton}${isRoot ? "" : `<button type="button" class="sketchLockBtn icon-small-btn" data-id="${escapeHtml(sketch.id)}" aria-pressed="${Boolean(sketch.locked)}" title="${sketch.locked ? applicationText("ロック解除", "Unlock sketch") : applicationText("スケッチをロック", "Lock sketch")}"><svg viewBox="0 0 24 24" aria-hidden="true">${sketch.locked ? '<rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor" fill-opacity=".2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>' : '<rect x="3" y="11" width="13" height="10" rx="2"/><path d="M10 11V5a5 5 0 0 1 10 0v2M9.5 15v2"/>'}</svg></button>`}</div>`);
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
      if (moving) {
        for (const row of sketchList.querySelectorAll(".sketch-item")) {
          const candidate = moving.destinations.get(row.dataset.id);
          row.classList.add(candidate?.ok ? "move-eligible" : "move-unavailable");
          if (row.dataset.id === moving.targetId) row.classList.add("move-destination");
          row.title = candidate?.ok ? applicationText("クリックで移動先に指定", "Click to choose destination") : candidate?.reason || "";
          const button = row.querySelector(".sketchActivateBtn");
          button.disabled = !candidate?.ok;
          button.title = row.title;
          button.setAttribute("aria-pressed", String(row.dataset.id === moving.targetId));
        }
        for (const button of sketchList.querySelectorAll(".sketchEditBtn, .sketchVisibilityBtn, .sketchLockBtn, .sketch-object-row button")) button.disabled = true;
        const focusTarget = focusedSketchId
          ? [...sketchList.querySelectorAll(".sketchActivateBtn")].find(button => button.dataset.id === focusedSketchId && !button.disabled)
          : [...sketchList.querySelectorAll("[data-sketch-move-action]")].find(button => button.dataset.sketchMoveAction === focusedMoveAction && !button.disabled);
        (focusTarget || sketchList.querySelector('[data-sketch-move-action="cancel"]'))?.focus();
      }
      sketchList.onclick = actions.click;
      sketchList.ondblclick = actions.doubleClick;
      sketchList.onkeydown = actions.keyDown;
      sketchList.onpointerover = actions.pointerOver;
      sketchList.onpointerout = actions.pointerOut;
      sketchList.onmouseleave = actions.leave;
    }

    function updateSketchTreeSelectionState() {
      for (const row of document.querySelectorAll("#sketchList .sketch-item")) {
        row.classList.toggle("selected", row.dataset.id === selectedSketchId());
        const edit = row.querySelector(".sketchEditBtn");
        if (edit) edit.hidden = Boolean(moveState()) || row.classList.contains("active") || isRootSketch(currentScope().sketches.find(sketch => sketch.id === row.dataset.id));
        row.querySelector(".sketchActivateBtn")?.setAttribute("aria-pressed", String(row.dataset.id === selectedSketchId()));
      }
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

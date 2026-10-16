/* Sketch creation, activation, naming, visibility and lock operations. */
(() => {
  "use strict";
  function create({ currentScope, ensureSketchState, activeSketch, activeSketchId, sketchById, childSketchesOf,
    sketchName, nextSketchId, clearInteractionForSketchChange, setHint, updateUI, draw, recordHistory,
    promptName, effectiveAppearanceForElement, clearTreeHover, clearSnap, guardEdit, applicationText, prepareLockToggle }) {
    const { ROOT_SKETCH_ID, isRootSketch } = window.SketchHierarchy;
    const { normalizeAppearance } = window.Appearance;
    function nextRootSketchName() {
      const model = currentScope();
      let max = 0;
      for (const sketch of model.sketches) {
        if (sketch.parentSketchId !== ROOT_SKETCH_ID || isRootSketch(sketch)) continue;
        const match = /^Sketch[-\s](\d+)$/.exec(sketch.name || "");
        if (match) max = Math.max(max, Number(match[1]));
      }
      return `Sketch-${max + 1}`;
    }

    function nextChildSketchName(parentSketchId) {
      const parent = sketchById(parentSketchId);
      if (isRootSketch(parent)) return nextRootSketchName();
      if (!parent) return nextRootSketchName();
      const prefix = `${parent.name}-`;
      let max = 0;
      for (const sketch of childSketchesOf(parentSketchId)) {
        if (!sketch.name?.startsWith(prefix)) continue;
        const suffix = sketch.name.slice(prefix.length);
        if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
      }
      return `${prefix}${max + 1}`;
    }

    function nextSketchName(parentSketchId) {
      return parentSketchId && parentSketchId !== ROOT_SKETCH_ID ? nextChildSketchName(parentSketchId) : nextRootSketchName();
    }

    function createSketch(kind = "sibling") {
      const model = currentScope();
      ensureSketchState();
      const current = activeSketch();
      const parentSketchId = kind === "child" ? current.id : current.parentSketchId || ROOT_SKETCH_ID;
      const sketch = { id: nextSketchId(), name: nextSketchName(parentSketchId), parentSketchId, kind: "sketch", appearance: {}, constructionAppearance: {}, dimensionAppearance: {} };
      model.sketches.push(sketch);
      model.activeSketchId = sketch.id;
      clearInteractionForSketchChange();
      setHint(parentSketchId ? `作図先: ${sketch.name} / 親: ${sketchName(parentSketchId)}` : `作図先: ${sketch.name}`);
      updateUI();
      draw();
      recordHistory("スケッチ追加");
    }

    function setActiveSketch(sketchId) {
      const model = currentScope();
      ensureSketchState();
      const sketch = model.sketches.find((item) => item.id === sketchId);
      if (!sketch) return;
      if (model.activeSketchId === sketchId) return;
      sketch.appearance = { ...normalizeAppearance(sketch.appearance), visible: true };
      sketch.visible = true;
      model.activeSketchId = sketchId;
      clearInteractionForSketchChange();
      setHint(`作図先: ${sketchName(sketchId)}`);
      updateUI();
      draw();
    }

    function renameSketch(sketchId) {
      if (!guardEdit(sketchId)) return;
      const model = currentScope();
      const sketch = model.sketches.find((item) => item.id === sketchId);
      if (!sketch || isRootSketch(sketch)) return;
      const next = promptName("スケッチ名", sketch.name);
      if (!next) return;
      sketch.name = next.trim() || sketch.name;
      updateUI();
      draw();
      recordHistory("スケッチ名変更");
    }

    function toggleSketchVisibility(sketchId) {
      const sketch = sketchById(sketchId);
      if (!sketch || isRootSketch(sketch) || sketch.id === activeSketchId()) return false;
      const nextVisible = effectiveAppearanceForElement({ sketchId: sketch.id, appearance: {} }).visible === false;
      sketch.appearance = { ...normalizeAppearance(sketch.appearance), visible: nextVisible };
      sketch.visible = nextVisible;
      clearTreeHover();
      clearSnap();
      setHint(`${sketch.name}: ${sketch.visible ? "表示" : "非表示"}`);
      updateUI();
      draw();
      recordHistory(sketch.visible ? "スケッチ表示" : "スケッチ非表示");
      return true;
    }

    function toggleLock(id) {
      const sketch = sketchById(id);
      if (!sketch || isRootSketch(sketch)) return false;
      prepareLockToggle();
      sketch.locked = !sketch.locked;
      updateUI(); draw(); recordHistory(applicationText("スケッチロック切替", "Toggle sketch lock"));
      return true;
    }

    return Object.freeze({ createSketch, activate: setActiveSketch, rename: renameSketch, toggleLock, toggleVisibility: toggleSketchVisibility });
  }
  // Editing permission stays in SketchContext; this boundary handles refusal feedback and cleanup.
  function createEditAccess({ activeSketchId, canEditSketch, sketchById, selectionItems, elementSketchId,
    isGeometryMode, setHint, applicationText, clearSnap, clearPointerPreview, draw }) {
    function guardSketchEdit(sketchId = activeSketchId(), operation = "edit") {
      if (canEditSketch(sketchId, operation)) return true;
      setHint(sketchById(sketchId)?.locked
        ? applicationText("スケッチはロック中です。ロック解除または作図先変更が必要です", "Sketch is locked. Unlock it or change the drawing sketch.")
        : applicationText("この操作には所属スケッチを作図先に指定してください", "Set the owning sketch as the drawing sketch for this operation."), "error");
      return false;
    }

    function guardSelectionEdit(operation = "edit") {
      return [...new Set(selectionItems().map(elementSketchId))].every(id => guardSketchEdit(id, operation));
    }

    function canCreateInActiveSketch() {
      return isGeometryMode() && canEditSketch(activeSketchId(), "create");
    }

    function rejectRootSketchCreation() {
      if (canCreateInActiveSketch()) return false;
      guardSketchEdit(activeSketchId(), "create");
      clearSnap();
      clearPointerPreview();
      draw();
      return true;
    }

    return Object.freeze({ guardSketchEdit, guardSelectionEdit, canCreateInActiveSketch, rejectRootSketchCreation });
  }
  // Sketch transitions retain their own reset scope and effect order.
  function createInteractionReset({ resetSketchMove, clearSelection, resetGeometryDrag, resetDimensionDrag,
    referenceImage, selectionRectangle, drawing, pending, constraint, projection, instances, instanceSources,
    hover, clearPointer, hideValueInput, clearSnap, selectMode, updateToolbar }) {
    function clear() {
      resetSketchMove();
      clearSelection();
      resetGeometryDrag();
      resetDimensionDrag();
      referenceImage.reset();
      selectionRectangle.reset();
      drawing.resetInputsForSketchChange();
      pending.clear();
      constraint.clearCommand();
      projection.reset();
      instances.clearSources();
      instanceSources.reset();
      hover.update({ sketchIdentity: null });
      clearPointer();
      hideValueInput();
      clearSnap();
      selectMode();
      updateToolbar();
    }
    return Object.freeze({ clear });
  }

  window.SketchCommand = Object.freeze({ create, createEditAccess, createInteractionReset });
})();

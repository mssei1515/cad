/* Sketch creation, activation, naming and visibility operations. */
(() => {
  "use strict";
  function create({ currentScope, ensureSketchState, activeSketch, activeSketchId, sketchById, childSketchesOf,
    sketchName, nextSketchId, clearInteractionForSketchChange, setHint, updateUI, draw, recordHistory,
    promptName, effectiveAppearanceForElement, clearTreeHover, clearSnap }) {
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
      setHint(parentSketchId ? `編集中: ${sketch.name} / 親: ${sketchName(parentSketchId)}` : `編集中: ${sketch.name}`);
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
      setHint(`編集中: ${sketchName(sketchId)}`);
      updateUI();
      draw();
    }

    function renameSketch(sketchId) {
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

    return Object.freeze({ createSketch, activate: setActiveSketch, rename: renameSketch, toggleVisibility: toggleSketchVisibility });
  }
  window.SketchCommand = Object.freeze({ create });
})();

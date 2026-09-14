/* Sketch hierarchy rules, independent of editor state, DOM and Solver. */
(function () {
  "use strict";
  const { normalizeAppearance, normalizeConstructionAppearance, normalizeDimensionAppearance } = window.Appearance;
  const ROOT_SKETCH_ID = "ROOT";
  const ROOT_SKETCH_NAME = "Root Sketch";
  const DEFAULT_SKETCH_ID = "S1";
  const DEFAULT_SKETCH_NAME = "Sketch-1";

  function isRootSketch(sketch) {
    return sketch?.kind === "root" || sketch?.id === ROOT_SKETCH_ID;
  }

  function ensure(scope) {
    if (!Array.isArray(scope.sketches)) scope.sketches = [];
    let root = scope.sketches.find((sketch) => sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID);
    if (!root) {
      root = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} };
      scope.sketches.unshift(root);
    }
    scope.sketches = [root, ...scope.sketches.filter((sketch) => sketch !== root && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
    root.id = ROOT_SKETCH_ID;
    root.name = root.name || ROOT_SKETCH_NAME;
    root.parentSketchId = null;
    root.kind = "root";
    root.appearance = normalizeAppearance(root.appearance);
    root.constructionAppearance = normalizeConstructionAppearance(root.constructionAppearance);
    root.dimensionAppearance = normalizeDimensionAppearance(root.dimensionAppearance);
    root.visible = true;
    const ids = new Set(scope.sketches.map((sketch) => sketch.id));
    for (const sketch of scope.sketches) {
      if (sketch === root) continue;
      sketch.kind = "sketch";
      sketch.appearance = normalizeAppearance(sketch.appearance || (sketch.visible === false ? { visible: false } : {}));
      sketch.constructionAppearance = normalizeConstructionAppearance(sketch.constructionAppearance);
      sketch.dimensionAppearance = normalizeDimensionAppearance(sketch.dimensionAppearance);
      sketch.visible = sketch.appearance.visible !== false;
      if (!Object.prototype.hasOwnProperty.call(sketch, "parentSketchId")) sketch.parentSketchId = null;
      if (sketch.parentSketchId === sketch.id || !ids.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      if (sketch.parentSketchId == null) sketch.parentSketchId = ROOT_SKETCH_ID;
    }
    if (!scope.activeSketchId || !scope.sketches.some((sketch) => sketch.id === scope.activeSketchId)) {
      scope.activeSketchId = ROOT_SKETCH_ID;
    }
  }

  function sketchById(sketches, sketchId) {
    return sketches.find((sketch) => sketch.id === sketchId) || null;
  }

  function parentSketchOf(sketches, sketch) {
    return sketch?.parentSketchId ? sketchById(sketches, sketch.parentSketchId) : null;
  }

  function childSketchesOf(sketches, sketchId) {
    return sketches.filter((sketch) => sketch.parentSketchId === sketchId);
  }

  function descendantSketchIds(sketches, sketchId) {
    const result = [];
    const visit = (id) => {
      for (const child of childSketchesOf(sketches, id)) {
        result.push(child.id);
        visit(child.id);
      }
    };
    visit(sketchId);
    return result;
  }

  function ancestorSketchIds(sketches, sketchId) {
    const result = [];
    const visited = new Set([sketchId]);
    let current = sketchById(sketches, sketchId);
    while (current?.parentSketchId && !visited.has(current.parentSketchId)) {
      const parent = sketchById(sketches, current.parentSketchId);
      if (!parent) break;
      visited.add(parent.id);
      if (!isRootSketch(parent)) result.push(parent.id);
      current = parent;
    }
    return result;
  }

  function isReferenceSourceSketchId(sketches, referenceSketchId, subjectSketchId) {
    if (!referenceSketchId || !subjectSketchId) return false;
    const reference = sketchById(sketches, referenceSketchId);
    if (!reference || isRootSketch(reference)) return false;
    if (referenceSketchId === subjectSketchId) return false;
    return ancestorSketchIds(sketches, subjectSketchId).includes(referenceSketchId);
  }

  function referenceSourceSketchIds(sketches, subjectSketchId) {
    return sketches
      .filter((sketch) => isReferenceSourceSketchId(sketches, sketch.id, subjectSketchId))
      .map((sketch) => sketch.id);
  }

  function sketchDepth(sketches, sketch) {
    let depth = 0;
    const visited = new Set();
    let current = sketch;
    while (current?.parentSketchId && !visited.has(current.id)) {
      visited.add(current.id);
      current = sketchById(sketches, current.parentSketchId);
      if (current) depth++;
    }
    return depth;
  }

  function wouldCreateSketchCycle(sketches, sketchId, parentSketchId) {
    let current = sketchById(sketches, parentSketchId);
    const visited = new Set([sketchId]);
    while (current) {
      if (visited.has(current.id)) return true;
      visited.add(current.id);
      current = parentSketchOf(sketches, current);
    }
    return false;
  }

  function orderedSketches(sketches) {
    const byParent = new Map();
    for (const sketch of sketches) {
      const key = sketch.parentSketchId || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(sketch);
    }
    const ordered = [];
    const visit = (parentId) => {
      for (const sketch of byParent.get(parentId || "") || []) {
        ordered.push(sketch);
        visit(sketch.id);
      }
    };
    visit("");
    for (const sketch of sketches) {
      if (!ordered.includes(sketch)) ordered.push(sketch);
    }
    return ordered;
  }

  function sketchTreeRows(sketches) {
    const byParent = new Map();
    for (const sketch of sketches) {
      const key = sketch.parentSketchId || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(sketch);
    }
    const rows = [];
    const visit = (parentId, depth, ancestorHasNext) => {
      const children = byParent.get(parentId || "") || [];
      children.forEach((sketch, index) => {
        const isLast = index === children.length - 1;
        const segments = depth === 0 && isRootSketch(sketch) ? [] : [...ancestorHasNext.map((hasNext) => (hasNext ? "pipe" : "blank")), isLast ? "elbow" : "tee"];
        rows.push({ sketch, depth, isLast, hasChildren: childSketchesOf(sketches, sketch.id).length > 0, segments });
        visit(sketch.id, depth + 1, [...ancestorHasNext, !isLast]);
      });
    };
    visit("", 0, []);
    for (const sketch of sketches) {
      if (!rows.some((row) => row.sketch === sketch)) rows.push({ sketch, depth: 0, isLast: true, hasChildren: false, segments: ["elbow"] });
    }
    return rows;
  }

  // Loaded files always have a drawable fallback; runtime normalization does not add one.
  function decode(items, { dimensionAppearanceLoader = normalizeDimensionAppearance, definition = false } = {}) {
    const scope = {
      sketches: Array.isArray(items) && items.length > 0 ? items.map((sketch, index) => ({
        id: String(sketch.id || `S${index + 1}`),
        name: String(sketch.name || sketch.id || `Sketch-${index + 1}`),
        parentSketchId: sketch.parentSketchId == null ? null : String(sketch.parentSketchId),
        kind: sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID ? "root" : "sketch",
        appearance: normalizeAppearance(sketch.appearance || (sketch.visible === false ? { visible: false } : {})),
        constructionAppearance: normalizeConstructionAppearance(sketch.constructionAppearance),
        dimensionAppearance: dimensionAppearanceLoader(sketch.dimensionAppearance),
      })) : [],
    };
    if (!scope.sketches.some((sketch) => !isRootSketch(sketch))) {
      scope.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
    }
    ensure(scope);
    if (definition) scope.sketches[0].name = ROOT_SKETCH_NAME;
    const ids = new Set(scope.sketches.map((sketch) => sketch.id));
    const fallbackSketchId = scope.sketches.find((sketch) => !isRootSketch(sketch)).id;
    const normalizeId = (sketchId) => {
      const id = sketchId == null ? fallbackSketchId : String(sketchId);
      return id !== ROOT_SKETCH_ID && ids.has(id) ? id : fallbackSketchId;
    };
    return { sketches: scope.sketches, ids, normalizeId };
  }

  window.SketchHierarchy = Object.freeze({
    ROOT_SKETCH_ID, ROOT_SKETCH_NAME, DEFAULT_SKETCH_ID, DEFAULT_SKETCH_NAME,
    ensure, decode, isRootSketch, sketchById, parentSketchOf, childSketchesOf, descendantSketchIds, ancestorSketchIds, isReferenceSourceSketchId, referenceSourceSketchIds, sketchDepth, wouldCreateSketchCycle, orderedSketches, sketchTreeRows,
  });
})();

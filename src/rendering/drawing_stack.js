/* Visible drawing order and batching, including the collection-order fast path. */
(function () {
  "use strict";
  const { Line, Circle, Arc, Spline } = window.GeometrySolver;
  const { normalizedDrawingOrder, drawingOrderOwner, ensureDrawingOrderState } = window.DrawingOrder;
  const DRAWING_STACK_KIND_ORDER = Object.freeze({ hatch: 0, line: 1, circle: 2, arc: 3, spline: 4 });
  function create({ currentScope, activeSketchId, geometryReads, isVisibleSketchId, isVisibleSketchElement, hatchAppearanceForDisplay, painters }) {
    const { allHatches, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines } = geometryReads;
    function drawingOrderInternalValue(item, kind) {
      if (!item?.blockProjection && !item?.derivedProjection) return 0;
      const local = item.localElement || item.sourceElement;
      return normalizedDrawingOrder(local?.drawingOrder) ?? DRAWING_STACK_KIND_ORDER[kind] ?? 0;
    }

    function drawingStackEntries() {
      const model = currentScope();
      const entries = [];
      const append = (kind, items, visible) => {
        for (const item of items) {
          if (!visible(item)) continue;
          entries.push({ kind, item, owner: drawingOrderOwner(item), insertionIndex: entries.length });
        }
      };
      append("hatch", allHatches(), (item) => isVisibleSketchId(item.sketchId) && hatchAppearanceForDisplay(item).visible !== false);
      append("line", allGeometryLines(), isVisibleSketchElement);
      append("circle", allGeometryCircles(), isVisibleSketchElement);
      append("arc", allGeometryArcs(), isVisibleSketchElement);
      append("spline", allGeometrySplines(), isVisibleSketchElement);
      const sketchIndex = new Map(model.sketches.map((sketch, index) => [String(sketch.id), index]));
      const activeId = String(activeSketchId());
      for (const entry of entries) {
        const sketchId = String(entry.owner.sketchId);
        entry.sketchOrder = sketchId === activeId ? model.sketches.length : sketchIndex.get(sketchId) ?? -1;
        entry.ownerOrder = normalizedDrawingOrder(entry.owner.drawingOrder) ?? 0;
        entry.internalOrder = drawingOrderInternalValue(entry.item, entry.kind);
        entry.kindOrder = DRAWING_STACK_KIND_ORDER[entry.kind];
      }
      return entries.sort((a, b) => {
        const sketchDifference = a.sketchOrder - b.sketchOrder;
        if (sketchDifference !== 0) return sketchDifference;
        const orderDifference = a.ownerOrder - b.ownerOrder;
        if (orderDifference !== 0) return orderDifference;
        const internalDifference = a.internalOrder - b.internalOrder;
        if (internalDifference !== 0) return internalDifference;
        const kindDifference = a.kindOrder - b.kindOrder;
        return kindDifference || a.insertionIndex - b.insertionIndex;
      });
    }

    function drawDrawingStack() {
      const model = currentScope();
      ensureDrawingOrderState(model);
      if (model.blockInstances.length === 0 && model.geometryInstances.length === 0) {
        const collectionOrdered = [
          ...model.hatches,
          ...model.lines,
          ...model.circles,
          ...model.arcs,
          ...model.splines,
        ].filter((item) => isVisibleSketchId(item.sketchId) && (item instanceof Line || item instanceof Circle || item instanceof Arc || item instanceof Spline ? isVisibleSketchElement(item) : hatchAppearanceForDisplay(item).visible !== false));
        const visibleSketchIds = new Set(collectionOrdered.map((item) => String(item.sketchId)));
        const alreadyInCollectionOrder = collectionOrdered.every((item, index) => index === 0 || item.drawingOrder > collectionOrdered[index - 1].drawingOrder);
        if (visibleSketchIds.size <= 1 && alreadyInCollectionOrder) {
          painters.hatch(model.hatches);
          painters.line(model.lines);
          painters.circle(model.circles);
          painters.arc(model.arcs);
          painters.spline(model.splines);
          return;
        }
      }
      const entries = drawingStackEntries();
      for (let start = 0; start < entries.length;) {
        const kind = entries[start].kind;
        let end = start + 1;
        while (end < entries.length && entries[end].kind === kind) end += 1;
        const items = entries.slice(start, end).map((entry) => entry.item);
        if (kind === "hatch") painters.hatch(items);
        else if (kind === "line") painters.line(items);
        else if (kind === "circle") painters.circle(items);
        else if (kind === "arc") painters.arc(items);
        else if (kind === "spline") painters.spline(items);
        start = end;
      }
    }
    return Object.freeze({ drawingStackEntries, drawDrawingStack });
  }
  window.DrawingStack = Object.freeze({ create });
})();

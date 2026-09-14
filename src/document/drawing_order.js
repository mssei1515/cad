/* Drawing order within an explicit Document or Block Definition scope. */
(function () {
  "use strict";

  function normalizedDrawingOrder(value) {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  function drawingOrderItemsForScope(scope, sketchId = null) {
    const items = [
      ...(scope?.hatches || []),
      ...(scope?.lines || []),
      ...(scope?.circles || []),
      ...(scope?.arcs || []),
      ...(scope?.splines || []),
      ...(scope?.blockInstances || []),
      ...(scope?.geometryInstances || []),
    ].filter(Boolean);
    return sketchId == null ? items : items.filter((item) => String(item.sketchId) === String(sketchId));
  }

  function ensureDrawingOrderState(scope) {
    const items = drawingOrderItemsForScope(scope);
    const indexByItem = new Map(items.map((item, index) => [item, index]));
    const bySketch = new Map();
    for (const item of items) {
      const sketchId = String(item.sketchId || "");
      if (!bySketch.has(sketchId)) bySketch.set(sketchId, []);
      bySketch.get(sketchId).push(item);
    }
    for (const sketchItems of bySketch.values()) {
      const seenOrders = new Set();
      let maxOrder = -1;
      let alreadyNormalized = true;
      for (const item of sketchItems) {
        const order = normalizedDrawingOrder(item.drawingOrder);
        if (order == null || seenOrders.has(order)) {
          alreadyNormalized = false;
          break;
        }
        seenOrders.add(order);
        maxOrder = Math.max(maxOrder, order);
      }
      if (alreadyNormalized && maxOrder === sketchItems.length - 1) continue;
      const existing = sketchItems.filter((item) => normalizedDrawingOrder(item.drawingOrder) != null);
      const missing = sketchItems.filter((item) => normalizedDrawingOrder(item.drawingOrder) == null);
      const ordered = existing.length === 0
        ? sketchItems
        : [
            ...missing.filter((item) => (scope?.hatches || []).includes(item)),
            ...existing.sort((a, b) => normalizedDrawingOrder(a.drawingOrder) - normalizedDrawingOrder(b.drawingOrder) || indexByItem.get(a) - indexByItem.get(b)),
            ...missing.filter((item) => !(scope?.hatches || []).includes(item)),
          ];
      ordered.forEach((item, index) => {
        item.drawingOrder = index;
      });
    }
    return scope;
  }

  function drawingOrderOwner(item) {
    return item?.blockInstance || item?.derivedInstance || item;
  }

  function ownersForScope(scope, sketchId, candidates) {
    ensureDrawingOrderState(scope);
    const valid = new Set(drawingOrderItemsForScope(scope, sketchId));
    return [...new Set((candidates || []).filter(Boolean).map(drawingOrderOwner))].filter((item) => valid.has(item));
  }

  function topmostOwner(scope, sketchId, candidates) {
    return ownersForScope(scope, sketchId, candidates)
      .sort((a, b) => normalizedDrawingOrder(b.drawingOrder) - normalizedDrawingOrder(a.drawingOrder))[0] || null;
  }

  function orderedItems(scope, sketchId) {
    return drawingOrderItemsForScope(scope, sketchId).slice()
      .sort((a, b) => normalizedDrawingOrder(a.drawingOrder) - normalizedDrawingOrder(b.drawingOrder));
  }

  function commandState(scope, sketchId, candidates) {
    const selected = new Set(ownersForScope(scope, sketchId, candidates));
    const ordered = orderedItems(scope, sketchId);
    return {
      count: selected.size,
      canForward: ordered.some((item, index) => selected.has(item) && ordered.slice(index + 1).some((next) => !selected.has(next))),
      canBackward: ordered.some((item, index) => selected.has(item) && ordered.slice(0, index).some((previous) => !selected.has(previous))),
    };
  }

  // Updates only drawingOrder; the caller owns UI refresh and history recording.
  function reorder(scope, sketchId, candidates, action) {
    const selected = new Set(ownersForScope(scope, sketchId, candidates));
    if (selected.size === 0) return false;
    const ordered = orderedItems(scope, sketchId);
    if (action === "drawing-front") {
      ordered.splice(0, ordered.length, ...ordered.filter((item) => !selected.has(item)), ...ordered.filter((item) => selected.has(item)));
    } else if (action === "drawing-back") {
      ordered.splice(0, ordered.length, ...ordered.filter((item) => selected.has(item)), ...ordered.filter((item) => !selected.has(item)));
    } else if (action === "drawing-forward") {
      for (let index = ordered.length - 2; index >= 0; index -= 1) {
        if (selected.has(ordered[index]) && !selected.has(ordered[index + 1])) [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]];
      }
    } else if (action === "drawing-backward") {
      for (let index = 1; index < ordered.length; index += 1) {
        if (selected.has(ordered[index]) && !selected.has(ordered[index - 1])) [ordered[index], ordered[index - 1]] = [ordered[index - 1], ordered[index]];
      }
    } else return false;
    ordered.forEach((item, index) => {
      item.drawingOrder = index;
    });
    return true;
  }

  window.DrawingOrder = Object.freeze({
    normalizedDrawingOrder, drawingOrderItemsForScope, ensureDrawingOrderState,
    drawingOrderOwner, ownersForScope, topmostOwner, commandState, reorder,
  });
})();

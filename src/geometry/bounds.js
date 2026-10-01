/* Pure rectangle and geometry bounds shared by queries and editing. */
(() => {
  "use strict";
  function rectFromPoints(a, b) {
    return {
      x1: Math.min(a.x, b.x),
      y1: Math.min(a.y, b.y),
      x2: Math.max(a.x, b.x),
      y2: Math.max(a.y, b.y),
    };
  }

  function pointInRect(p, rect) {
    return p.x >= rect.x1 && p.x <= rect.x2 && p.y >= rect.y1 && p.y <= rect.y2;
  }

  function bboxInRect(box, rect) {
    return box.x1 >= rect.x1 && box.x2 <= rect.x2 && box.y1 >= rect.y1 && box.y2 <= rect.y2;
  }

  function bboxIntersectsRect(box, rect) {
    return box.x2 >= rect.x1 && box.x1 <= rect.x2 && box.y2 >= rect.y1 && box.y1 <= rect.y2;
  }

  function lineBBox(line) {
    return {
      x1: Math.min(line.p1.x, line.p2.x),
      y1: Math.min(line.p1.y, line.p2.y),
      x2: Math.max(line.p1.x, line.p2.x),
      y2: Math.max(line.p1.y, line.p2.y),
    };
  }

  function primitiveBBox(primitive) {
    const r = primitive.radius();
    return {
      x1: primitive.center.x - r,
      y1: primitive.center.y - r,
      x2: primitive.center.x + r,
      y2: primitive.center.y + r,
    };
  }

  function mergeBounds(bounds, box) {
    if (!box) return bounds;
    const x1 = box.x1 ?? box.left;
    const y1 = box.y1 ?? box.top;
    const x2 = box.x2 ?? box.right;
    const y2 = box.y2 ?? box.bottom;
    if (![x1, y1, x2, y2].every(Number.isFinite)) return bounds;
    if (!bounds) return { x1, y1, x2, y2 };
    return {
      x1: Math.min(bounds.x1, x1),
      y1: Math.min(bounds.y1, y1),
      x2: Math.max(bounds.x2, x2),
      y2: Math.max(bounds.y2, y2),
    };
  }

  function splineBBox(spline) {
    const bounds = window.SplineGeometry.bounds(spline.curve());
    return bounds ? { x1: bounds.minX, y1: bounds.minY, x2: bounds.maxX, y2: bounds.maxY } : null;
  }

  function pointInExpandedBox(x, y, box, padding) {
    return x >= box.left - padding && x <= box.right + padding && y >= box.top - padding && y <= box.bottom + padding;
  }

  window.GeometryBounds = Object.freeze({ pointInExpandedBox, rectFromPoints, pointInRect, bboxInRect, bboxIntersectsRect, lineBBox, primitiveBBox, mergeBounds, splineBBox });
})();

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

  function lineIntersectsRect(line, rect) {
    if (!bboxIntersectsRect(lineBBox(line), rect)) return false;
    if (pointInRect(line.p1, rect) || pointInRect(line.p2, rect)) return true;
    const edges = [
      [{ x: rect.x1, y: rect.y1 }, { x: rect.x2, y: rect.y1 }],
      [{ x: rect.x2, y: rect.y1 }, { x: rect.x2, y: rect.y2 }],
      [{ x: rect.x2, y: rect.y2 }, { x: rect.x1, y: rect.y2 }],
      [{ x: rect.x1, y: rect.y2 }, { x: rect.x1, y: rect.y1 }],
    ];
    return edges.some(([a, b]) => segmentsIntersect(line.p1, line.p2, a, b));
  }

  function segmentsIntersect(a, b, c, d) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const onSegment = (p, q, r) =>
      Math.min(p.x, q.x) - 1e-9 <= r.x &&
      r.x <= Math.max(p.x, q.x) + 1e-9 &&
      Math.min(p.y, q.y) - 1e-9 <= r.y &&
      r.y <= Math.max(p.y, q.y) + 1e-9;
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    if (Math.abs(c1) < 1e-9 && onSegment(a, b, c)) return true;
    if (Math.abs(c2) < 1e-9 && onSegment(a, b, d)) return true;
    if (Math.abs(c3) < 1e-9 && onSegment(c, d, a)) return true;
    if (Math.abs(c4) < 1e-9 && onSegment(c, d, b)) return true;
    return c1 * c2 < 0 && c3 * c4 < 0;
  }

  window.GeometryBounds = Object.freeze({ lineIntersectsRect, pointInExpandedBox, rectFromPoints, pointInRect, bboxInRect, bboxIntersectsRect, lineBBox, primitiveBBox, mergeBounds, splineBBox });
})();

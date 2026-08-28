/* offset_chain.js: Pure ordered Line/Arc chain offset geometry. */
(function () {
  "use strict";

  const TWO_PI = Math.PI * 2;
  const DEFAULT_EPSILON = 1e-7;

  function finitePoint(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y);
  }

  function clonePoint(point) {
    return { x: Number(point.x), y: Number(point.y) };
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function primitiveRadius(item) {
    return Number(typeof item?.radius === "function" ? item.radius() : item?.radius);
  }

  function segmentKind(item) {
    if (item?.p1 && item?.p2) return "line";
    if (item?.center && Number.isFinite(Number(item?.startAngle)) && Number.isFinite(Number(item?.endAngle))) return "arc";
    return null;
  }

  function normalizeEntry(entry) {
    const item = entry?.geometry || entry;
    const reversed = Boolean(entry?.reversed);
    const kind = segmentKind(item);
    if (kind === "line") {
      if (!finitePoint(item.p1) || !finitePoint(item.p2)) return null;
      const start = clonePoint(reversed ? item.p2 : item.p1);
      const end = clonePoint(reversed ? item.p1 : item.p2);
      const length = distance(start, end);
      if (length <= DEFAULT_EPSILON) return null;
      return { kind, item, reversed, start, end, length };
    }
    if (kind === "arc") {
      const radius = primitiveRadius(item);
      const nativeStart = Number(item.startAngle);
      const nativeEnd = Number(item.endAngle);
      if (!finitePoint(item.center) || !Number.isFinite(radius) || radius <= DEFAULT_EPSILON || Math.abs(nativeEnd - nativeStart) <= DEFAULT_EPSILON) return null;
      const startAngle = reversed ? nativeEnd : nativeStart;
      const endAngle = reversed ? nativeStart : nativeEnd;
      const sweep = endAngle - startAngle;
      return {
        kind,
        item,
        reversed,
        center: clonePoint(item.center),
        radius,
        startAngle,
        endAngle,
        sweep,
        start: { x: item.center.x + Math.cos(startAngle) * radius, y: item.center.y + Math.sin(startAngle) * radius },
        end: { x: item.center.x + Math.cos(endAngle) * radius, y: item.center.y + Math.sin(endAngle) * radius },
      };
    }
    return null;
  }

  function leftNormalAt(segment, endpoint = "start") {
    if (segment.kind === "line") {
      const tx = (segment.end.x - segment.start.x) / segment.length;
      const ty = (segment.end.y - segment.start.y) / segment.length;
      return { x: -ty, y: tx };
    }
    const angle = endpoint === "end" ? segment.endAngle : segment.startAngle;
    const sweepSign = segment.sweep < 0 ? -1 : 1;
    const tx = -Math.sin(angle) * sweepSign;
    const ty = Math.cos(angle) * sweepSign;
    return { x: -ty, y: tx };
  }

  function offsetSupport(segment, distanceValue, side) {
    if (segment.kind === "line") {
      const normal = leftNormalAt(segment);
      const dx = normal.x * side * distanceValue;
      const dy = normal.y * side * distanceValue;
      return {
        kind: "line",
        source: segment,
        start: { x: segment.start.x + dx, y: segment.start.y + dy },
        end: { x: segment.end.x + dx, y: segment.end.y + dy },
      };
    }
    const sweepSign = segment.sweep < 0 ? -1 : 1;
    const radius = segment.radius - sweepSign * side * distanceValue;
    if (radius <= DEFAULT_EPSILON) return null;
    return {
      kind: "arc",
      source: segment,
      center: clonePoint(segment.center),
      radius,
      startAngle: segment.startAngle,
      endAngle: segment.endAngle,
      sweepSign,
      start: { x: segment.center.x + Math.cos(segment.startAngle) * radius, y: segment.center.y + Math.sin(segment.startAngle) * radius },
      end: { x: segment.center.x + Math.cos(segment.endAngle) * radius, y: segment.center.y + Math.sin(segment.endAngle) * radius },
    };
  }

  function infiniteLineIntersection(first, second, epsilon) {
    const x1 = first.start.x;
    const y1 = first.start.y;
    const x2 = first.end.x;
    const y2 = first.end.y;
    const x3 = second.start.x;
    const y3 = second.start.y;
    const x4 = second.end.x;
    const y4 = second.end.y;
    const determinant = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(determinant) <= epsilon) return [];
    return [{
      x: ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / determinant,
      y: ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / determinant,
    }];
  }

  function infiniteLineCircleIntersections(line, circle, epsilon) {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const fx = line.start.x - circle.center.x;
    const fy = line.start.y - circle.center.y;
    const a = dx * dx + dy * dy;
    if (a <= epsilon * epsilon) return [];
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circle.radius * circle.radius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -epsilon) return [];
    if (Math.abs(discriminant) <= epsilon) {
      const t = -b / (2 * a);
      return [{ x: line.start.x + dx * t, y: line.start.y + dy * t }];
    }
    const root = Math.sqrt(Math.max(0, discriminant));
    return [(-b - root) / (2 * a), (-b + root) / (2 * a)].map((t) => ({ x: line.start.x + dx * t, y: line.start.y + dy * t }));
  }

  function circleCircleIntersections(first, second, epsilon) {
    const dx = second.center.x - first.center.x;
    const dy = second.center.y - first.center.y;
    const centerDistance = Math.hypot(dx, dy);
    if (centerDistance <= epsilon) return [];
    if (centerDistance > first.radius + second.radius + epsilon) return [];
    if (centerDistance < Math.abs(first.radius - second.radius) - epsilon) return [];
    const along = (first.radius * first.radius - second.radius * second.radius + centerDistance * centerDistance) / (2 * centerDistance);
    const heightSquared = first.radius * first.radius - along * along;
    if (heightSquared < -epsilon) return [];
    const base = { x: first.center.x + dx * along / centerDistance, y: first.center.y + dy * along / centerDistance };
    if (Math.abs(heightSquared) <= epsilon) return [base];
    const height = Math.sqrt(Math.max(0, heightSquared));
    const ox = -dy * height / centerDistance;
    const oy = dx * height / centerDistance;
    return [{ x: base.x + ox, y: base.y + oy }, { x: base.x - ox, y: base.y - oy }];
  }

  function supportIntersections(first, second, epsilon) {
    if (first.kind === "line" && second.kind === "line") return infiniteLineIntersection(first, second, epsilon);
    if (first.kind === "line" && second.kind === "arc") return infiniteLineCircleIntersections(first, second, epsilon);
    if (first.kind === "arc" && second.kind === "line") return infiniteLineCircleIntersections(second, first, epsilon);
    return circleCircleIntersections(first, second, epsilon);
  }

  function coincidentSupports(first, second, epsilon) {
    if (first.kind === "line" && second.kind === "line") {
      const dx = first.end.x - first.start.x;
      const dy = first.end.y - first.start.y;
      const length = Math.hypot(dx, dy);
      if (length <= epsilon) return false;
      return Math.abs((second.start.x - first.start.x) * dy - (second.start.y - first.start.y) * dx) / length <= epsilon;
    }
    if (first.kind === "arc" && second.kind === "arc") {
      return distance(first.center, second.center) <= epsilon && Math.abs(first.radius - second.radius) <= epsilon;
    }
    return false;
  }

  function closestCandidate(candidates, reference) {
    return candidates.reduce((best, point) => !best || distance(point, reference) < distance(best, reference) ? point : best, null);
  }

  function unwrapNear(angle, reference) {
    return angle + Math.round((reference - angle) / TWO_PI) * TWO_PI;
  }

  function directedEndAngle(angle, startAngle, reference, direction) {
    const candidates = [];
    for (let turn = -3; turn <= 3; turn++) {
      const value = angle + turn * TWO_PI;
      if (direction > 0 ? value > startAngle + DEFAULT_EPSILON : value < startAngle - DEFAULT_EPSILON) candidates.push(value);
    }
    return candidates.reduce((best, value) => best == null || Math.abs(value - reference) < Math.abs(best - reference) ? value : best, null);
  }

  function finalizedGeometry(support) {
    if (support.kind === "line") {
      if (distance(support.start, support.end) <= DEFAULT_EPSILON) return null;
      return { kind: "line", source: support.source.item, p1: clonePoint(support.start), p2: clonePoint(support.end) };
    }
    const startAngle = unwrapNear(Math.atan2(support.start.y - support.center.y, support.start.x - support.center.x), support.startAngle);
    const endRaw = Math.atan2(support.end.y - support.center.y, support.end.x - support.center.x);
    const endAngle = directedEndAngle(endRaw, startAngle, support.endAngle, support.sweepSign);
    if (endAngle == null) return null;
    const sweep = endAngle - startAngle;
    if (Math.abs(sweep) <= DEFAULT_EPSILON || Math.abs(sweep) >= TWO_PI - DEFAULT_EPSILON) return null;
    return { kind: "arc", source: support.source.item, center: clonePoint(support.center), radius: support.radius, startAngle, endAngle };
  }

  function parameterOnLine(point, line) {
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= DEFAULT_EPSILON * DEFAULT_EPSILON) return NaN;
    return ((point.x - line.p1.x) * dx + (point.y - line.p1.y) * dy) / lengthSquared;
  }

  function normalizePositive(angle) {
    return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  }

  function pointOnArc(point, arc, epsilon) {
    if (Math.abs(distance(point, arc.center) - arc.radius) > epsilon * 10) return false;
    const angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
    const sweep = arc.endAngle - arc.startAngle;
    return sweep > 0
      ? normalizePositive(angle - arc.startAngle) <= sweep + epsilon
      : normalizePositive(arc.startAngle - angle) <= -sweep + epsilon;
  }

  function finiteIntersections(first, second, epsilon) {
    const firstSupport = first.kind === "line"
      ? { kind: "line", start: first.p1, end: first.p2 }
      : { kind: "arc", center: first.center, radius: first.radius };
    const secondSupport = second.kind === "line"
      ? { kind: "line", start: second.p1, end: second.p2 }
      : { kind: "arc", center: second.center, radius: second.radius };
    return supportIntersections(firstSupport, secondSupport, epsilon).filter((point) => {
      const firstOn = first.kind === "line"
        ? parameterOnLine(point, first) >= -epsilon && parameterOnLine(point, first) <= 1 + epsilon
        : pointOnArc(point, first, epsilon);
      const secondOn = second.kind === "line"
        ? parameterOnLine(point, second) >= -epsilon && parameterOnLine(point, second) <= 1 + epsilon
        : pointOnArc(point, second, epsilon);
      return firstOn && secondOn;
    });
  }

  function selfIntersects(geometries, closed, epsilon) {
    for (let first = 0; first < geometries.length; first++) {
      for (let second = first + 1; second < geometries.length; second++) {
        if (second === first + 1 || closed && first === 0 && second === geometries.length - 1) continue;
        if (finiteIntersections(geometries[first], geometries[second], epsilon).length > 0) return true;
      }
    }
    return false;
  }

  function build(entries, options = {}) {
    const distanceValue = Number(options.distance);
    const side = Number(options.side) < 0 ? -1 : 1;
    const closed = Boolean(options.closed);
    const epsilon = Math.max(DEFAULT_EPSILON, Number(options.epsilon) || 0);
    if (!Array.isArray(entries) || entries.length === 0) return { ok: false, code: "empty-chain" };
    if (!Number.isFinite(distanceValue) || distanceValue <= epsilon) return { ok: false, code: "invalid-distance" };
    const segments = entries.map(normalizeEntry);
    if (segments.some((segment) => !segment)) return { ok: false, code: "invalid-segment" };
    const supports = segments.map((segment) => offsetSupport(segment, distanceValue, side));
    if (supports.some((support) => !support)) return { ok: false, code: "collapsed-radius" };

    const joinCount = closed ? supports.length : supports.length - 1;
    for (let index = 0; index < joinCount; index++) {
      const nextIndex = (index + 1) % supports.length;
      const first = supports[index];
      const second = supports[nextIndex];
      const reference = midpoint(first.end, second.start);
      let join = closestCandidate(supportIntersections(first, second, epsilon), reference);
      if (!join && coincidentSupports(first, second, epsilon)) join = reference;
      if (!join || !finitePoint(join)) return { ok: false, code: "missing-miter", joinIndex: index };
      first.end = clonePoint(join);
      second.start = clonePoint(join);
    }

    const geometries = supports.map(finalizedGeometry);
    if (geometries.some((geometry) => !geometry)) return { ok: false, code: "collapsed-segment" };
    if (selfIntersects(geometries, closed, epsilon)) return { ok: false, code: "self-intersection" };
    return { ok: true, closed, side, distance: distanceValue, geometries };
  }

  window.OffsetChainEngine = Object.freeze({ build });
})();

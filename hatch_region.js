/* hatch_region.js: Closed-region detection and associative boundary resolution. */
(function () {
  "use strict";

  const TWO_PI = Math.PI * 2;
  const DEFAULT_EPSILON = 1e-7;
  const SplineGeometry = typeof window !== "undefined" ? window.SplineGeometry : null;

  function finitePoint(point) {
    return point && Number.isFinite(point.x) && Number.isFinite(point.y);
  }

  function clonePoint(point) {
    return { x: Number(point.x), y: Number(point.y) };
  }

  function normalizeAngle(angle) {
    return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  }

  function primitiveRadius(primitive) {
    const value = typeof primitive?.radius === "function" ? primitive.radius() : primitive?.radius;
    return Number(value);
  }

  function primitiveId(primitive) {
    return String(primitive?.id || "");
  }

  function primitiveKind(primitive) {
    if (["line", "circle", "arc", "spline"].includes(primitive?.kind)) return primitive.kind;
    if (Array.isArray(primitive?.points) || Array.isArray(primitive?.fitPoints)) return "spline";
    if (primitive?.p1 && primitive?.p2) return "line";
    if (primitive?.center && Number.isFinite(primitive?.startAngle) && Number.isFinite(primitive?.endAngle)) return "arc";
    if (primitive?.center && Number.isFinite(primitiveRadius(primitive))) return "circle";
    return null;
  }

  function normalizePrimitive(source) {
    const kind = primitiveKind(source);
    const id = primitiveId(source);
    if (!kind || !id) return null;
    if (kind === "line") {
      if (!finitePoint(source.p1) || !finitePoint(source.p2)) return null;
      return { kind, id, p1: clonePoint(source.p1), p2: clonePoint(source.p2), source };
    }
    if (kind === "spline") {
      const points = (source.points || source.fitPoints || []).map(clonePoint);
      const curve = source.curve?.valid ? source.curve : SplineGeometry?.build(points, { closed: Boolean(source.closed) });
      if (!curve?.valid) return null;
      return { kind, id, points, closed: Boolean(source.closed), curve, source };
    }
    const radius = primitiveRadius(source);
    if (!finitePoint(source.center) || !Number.isFinite(radius) || radius <= 0) return null;
    if (kind === "arc") {
      const startAngle = Number(source.startAngle);
      const endAngle = Number(source.endAngle);
      if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle) || Math.abs(endAngle - startAngle) <= 1e-12) return null;
      return { kind, id, center: clonePoint(source.center), radius, startAngle, endAngle, source };
    }
    return { kind, id, center: clonePoint(source.center), radius, source };
  }

  function primitiveRef(primitive) {
    return { kind: primitive.kind, path: [primitive.id] };
  }

  function refId(ref) {
    return ref && Array.isArray(ref.path) && ref.path.length ? String(ref.path[ref.path.length - 1]) : null;
  }

  function refKey(ref) {
    const id = refId(ref);
    return ref?.kind && id ? `${ref.kind}:${id}` : null;
  }

  function boundsForPrimitive(primitive) {
    if (primitive.kind === "line") {
      return {
        minX: Math.min(primitive.p1.x, primitive.p2.x),
        minY: Math.min(primitive.p1.y, primitive.p2.y),
        maxX: Math.max(primitive.p1.x, primitive.p2.x),
        maxY: Math.max(primitive.p1.y, primitive.p2.y),
      };
    }
    if (primitive.kind === "spline") return SplineGeometry.bounds(primitive.curve);
    return {
      minX: primitive.center.x - primitive.radius,
      minY: primitive.center.y - primitive.radius,
      maxX: primitive.center.x + primitive.radius,
      maxY: primitive.center.y + primitive.radius,
    };
  }

  function boundsOverlap(a, b, epsilon) {
    return a.minX <= b.maxX + epsilon && a.maxX >= b.minX - epsilon && a.minY <= b.maxY + epsilon && a.maxY >= b.minY - epsilon;
  }

  function geometryScale(primitives) {
    if (!primitives.length) return 1;
    const bounds = primitives.map(boundsForPrimitive);
    const minX = Math.min(...bounds.map((item) => item.minX));
    const minY = Math.min(...bounds.map((item) => item.minY));
    const maxX = Math.max(...bounds.map((item) => item.maxX));
    const maxY = Math.max(...bounds.map((item) => item.maxY));
    return Math.max(1, maxX - minX, maxY - minY);
  }

  function pointAt(primitive, t) {
    if (primitive.kind === "spline") return SplineGeometry.evaluate(primitive.curve, t);
    if (primitive.kind === "line") {
      return {
        x: primitive.p1.x + (primitive.p2.x - primitive.p1.x) * t,
        y: primitive.p1.y + (primitive.p2.y - primitive.p1.y) * t,
      };
    }
    const angle = primitive.kind === "circle"
      ? t * TWO_PI
      : primitive.startAngle + (primitive.endAngle - primitive.startAngle) * t;
    return {
      x: primitive.center.x + Math.cos(angle) * primitive.radius,
      y: primitive.center.y + Math.sin(angle) * primitive.radius,
    };
  }

  function tangentAt(primitive, t) {
    if (primitive.kind === "spline") return SplineGeometry.derivative(primitive.curve, t);
    if (primitive.kind === "line") return { x: primitive.p2.x - primitive.p1.x, y: primitive.p2.y - primitive.p1.y };
    const angle = primitive.kind === "circle"
      ? t * TWO_PI
      : primitive.startAngle + (primitive.endAngle - primitive.startAngle) * t;
    const sweep = primitive.kind === "circle" ? TWO_PI : primitive.endAngle - primitive.startAngle;
    return { x: -Math.sin(angle) * primitive.radius * sweep, y: Math.cos(angle) * primitive.radius * sweep };
  }

  function primitiveParam(primitive, point, tolerance = 1e-8) {
    if (primitive.kind === "spline") {
      const closest = SplineGeometry.closestPoint(primitive.curve, point, { samplesPerSpan: 32 });
      return closest && closest.distance <= Math.max(tolerance * 16, DEFAULT_EPSILON) ? closest.t : null;
    }
    if (primitive.kind === "line") {
      const dx = primitive.p2.x - primitive.p1.x;
      const dy = primitive.p2.y - primitive.p1.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared <= tolerance * tolerance) return null;
      const t = ((point.x - primitive.p1.x) * dx + (point.y - primitive.p1.y) * dy) / lengthSquared;
      return t >= -tolerance && t <= 1 + tolerance ? Math.max(0, Math.min(1, t)) : null;
    }
    const angle = Math.atan2(point.y - primitive.center.y, point.x - primitive.center.x);
    if (primitive.kind === "circle") return normalizeAngle(angle) / TWO_PI;
    const sweep = primitive.endAngle - primitive.startAngle;
    if (sweep > 0) {
      const delta = normalizeAngle(angle - primitive.startAngle);
      if (delta > sweep + tolerance) return null;
      return Math.max(0, Math.min(1, delta / sweep));
    }
    const delta = normalizeAngle(primitive.startAngle - angle);
    if (delta > -sweep + tolerance) return null;
    return Math.max(0, Math.min(1, delta / -sweep));
  }

  function lineLineIntersections(a, b, epsilon) {
    const ax = a.p2.x - a.p1.x;
    const ay = a.p2.y - a.p1.y;
    const bx = b.p2.x - b.p1.x;
    const by = b.p2.y - b.p1.y;
    const determinant = ax * by - ay * bx;
    const qx = b.p1.x - a.p1.x;
    const qy = b.p1.y - a.p1.y;
    if (Math.abs(determinant) <= epsilon) {
      const collinear = Math.abs(qx * ay - qy * ax) <= epsilon * Math.max(1, Math.hypot(ax, ay));
      if (!collinear) return { points: [], overlap: false };
      const parameter = (point) => Math.abs(ax) >= Math.abs(ay)
        ? (point.x - a.p1.x) / (Math.abs(ax) <= epsilon ? 1 : ax)
        : (point.y - a.p1.y) / (Math.abs(ay) <= epsilon ? 1 : ay);
      const t1 = parameter(b.p1);
      const t2 = parameter(b.p2);
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(1, Math.max(t1, t2));
      return { points: [], overlap: hi - lo > epsilon };
    }
    const t = (qx * by - qy * bx) / determinant;
    const u = (qx * ay - qy * ax) / determinant;
    if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) return { points: [], overlap: false };
    return { points: [{ x: a.p1.x + ax * t, y: a.p1.y + ay * t }], overlap: false };
  }

  function lineCircularIntersections(line, circular, epsilon) {
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const fx = line.p1.x - circular.center.x;
    const fy = line.p1.y - circular.center.y;
    const qa = dx * dx + dy * dy;
    if (qa <= epsilon * epsilon) return [];
    const qb = 2 * (fx * dx + fy * dy);
    const qc = fx * fx + fy * fy - circular.radius * circular.radius;
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant < -epsilon) return [];
    const root = Math.sqrt(Math.max(0, discriminant));
    const roots = root <= epsilon ? [-qb / (2 * qa)] : [(-qb - root) / (2 * qa), (-qb + root) / (2 * qa)];
    return roots.map((t) => ({ x: line.p1.x + dx * t, y: line.p1.y + dy * t }))
      .filter((point) => primitiveParam(line, point, epsilon) != null && primitiveParam(circular, point, epsilon) != null);
  }

  function circularIntersections(a, b, epsilon) {
    const dx = b.center.x - a.center.x;
    const dy = b.center.y - a.center.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= epsilon && Math.abs(a.radius - b.radius) <= epsilon) return { points: [], overlap: true };
    if (distance <= epsilon || distance > a.radius + b.radius + epsilon || distance < Math.abs(a.radius - b.radius) - epsilon) return { points: [], overlap: false };
    const along = (a.radius * a.radius - b.radius * b.radius + distance * distance) / (2 * distance);
    const heightSquared = a.radius * a.radius - along * along;
    if (heightSquared < -epsilon) return { points: [], overlap: false };
    const height = Math.sqrt(Math.max(0, heightSquared));
    const ux = dx / distance;
    const uy = dy / distance;
    const base = { x: a.center.x + ux * along, y: a.center.y + uy * along };
    const candidates = height <= epsilon
      ? [base]
      : [{ x: base.x - uy * height, y: base.y + ux * height }, { x: base.x + uy * height, y: base.y - ux * height }];
    return {
      points: candidates.filter((point) => primitiveParam(a, point, epsilon) != null && primitiveParam(b, point, epsilon) != null),
      overlap: false,
    };
  }

  function pairIntersections(a, b, epsilon) {
    if (a.kind === "spline" || b.kind === "spline") return SplineGeometry.intersections(a, b, { tolerance: epsilon * 8 });
    if (a.kind === "line" && b.kind === "line") return lineLineIntersections(a, b, epsilon);
    if (a.kind === "line") return { points: lineCircularIntersections(a, b, epsilon), overlap: false };
    if (b.kind === "line") return { points: lineCircularIntersections(b, a, epsilon), overlap: false };
    return circularIntersections(a, b, epsilon);
  }

  function dedupePoints(points, epsilon) {
    const result = [];
    for (const point of points) {
      if (!result.some((item) => Math.hypot(item.x - point.x, item.y - point.y) <= epsilon)) result.push(point);
    }
    return result;
  }

  function endpointAnchor(primitive, t, epsilon) {
    if (primitive.kind === "line") {
      if (Math.abs(t) <= epsilon) return { type: "endpoint", name: "p1" };
      if (Math.abs(t - 1) <= epsilon) return { type: "endpoint", name: "p2" };
    }
    if (primitive.kind === "arc" || (primitive.kind === "spline" && !primitive.closed)) {
      if (Math.abs(t) <= epsilon) return { type: "endpoint", name: "start" };
      if (Math.abs(t - 1) <= epsilon) return { type: "endpoint", name: "end" };
    }
    return null;
  }

  function markerAnchor(primitive, t, records, epsilon) {
    const endpoint = endpointAnchor(primitive, t, epsilon);
    if (endpoint) return endpoint;
    const nearest = records
      .filter((record) => record.primitive === primitive)
      .sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
    if (!nearest || Math.abs(nearest.t - t) > epsilon * 8) return null;
    return { type: "intersection", other: primitiveRef(nearest.other), occurrence: nearest.occurrence };
  }

  function anchorKey(anchor) {
    if (!anchor) return "";
    if (anchor.type === "endpoint") return `e:${anchor.name}`;
    return `i:${refKey(anchor.other)}:${anchor.occurrence}`;
  }

  function addMarker(markers, marker, epsilon) {
    const existing = markers.find((item) => Math.abs(item.t - marker.t) <= epsilon);
    if (!existing) markers.push(marker);
  }

  function vertexFor(vertices, point, epsilon) {
    let vertex = vertices.find((item) => Math.hypot(item.point.x - point.x, item.point.y - point.y) <= epsilon);
    if (!vertex) {
      vertex = { id: vertices.length, point: clonePoint(point), outgoing: [] };
      vertices.push(vertex);
    }
    return vertex;
  }

  function sampleSpan(primitive, startT, endT, reversed = false) {
    if (primitive.kind === "spline") {
      const points = SplineGeometry.flatten(primitive.curve, {
        start: startT,
        end: endT,
        tolerance: Math.max(DEFAULT_EPSILON, geometryScale([primitive]) * 1e-4),
      });
      const sampled = points.map((entry) => entry.point);
      return reversed ? sampled.reverse() : sampled;
    }
    const delta = endT - startT;
    const sweep = primitive.kind === "line" ? 0 : Math.abs(delta * (primitive.kind === "circle" ? TWO_PI : primitive.endAngle - primitive.startAngle));
    const count = primitive.kind === "line" ? 1 : Math.max(2, Math.ceil(sweep / (Math.PI / 24)));
    const points = [];
    for (let index = 0; index <= count; index++) {
      const fraction = index / count;
      const t = reversed ? endT - delta * fraction : startT + delta * fraction;
      points.push(pointAt(primitive, primitive.kind === "circle" ? ((t % 1) + 1) % 1 : t));
    }
    return points;
  }

  function polygonArea(points) {
    let area = 0;
    for (let index = 0; index < points.length; index++) {
      const next = points[(index + 1) % points.length];
      area += points[index].x * next.y - next.x * points[index].y;
    }
    return area / 2;
  }

  function pointOnSegment(point, a, b, epsilon) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= epsilon * epsilon) return Math.hypot(point.x - a.x, point.y - a.y) <= epsilon;
    const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
    if (t < -epsilon || t > 1 + epsilon) return false;
    const projection = { x: a.x + dx * t, y: a.y + dy * t };
    return Math.hypot(point.x - projection.x, point.y - projection.y) <= epsilon;
  }

  function pointInPolygon(point, polygon, epsilon = DEFAULT_EPSILON) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j];
      const b = polygon[i];
      if (pointOnSegment(point, a, b, epsilon)) return { inside: true, boundary: true };
      const crosses = (a.y > point.y) !== (b.y > point.y)
        && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return { inside, boundary: false };
  }

  function cyclePoints(halfEdges) {
    const points = [];
    for (const halfEdge of halfEdges) {
      const spanPoints = sampleSpan(halfEdge.edge.primitive, halfEdge.edge.startT, halfEdge.edge.endT, halfEdge.reversed);
      if (points.length) spanPoints.shift();
      points.push(...spanPoints);
    }
    if (points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) <= DEFAULT_EPSILON) points.pop();
    return points;
  }

  function cycleRepresentative(cycle, epsilon) {
    for (let index = 0; index < cycle.points.length; index++) {
      const a = cycle.points[index];
      const b = cycle.points[(index + 1) % cycle.points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (length <= epsilon) continue;
      const offset = Math.max(epsilon * 16, length * 1e-6);
      return { x: (a.x + b.x) / 2 - (dy / length) * offset, y: (a.y + b.y) / 2 + (dx / length) * offset };
    }
    return cycle.points[0];
  }

  function serializeHalfEdge(halfEdge) {
    const edge = halfEdge.edge;
    return {
      source: primitiveRef(edge.primitive),
      start: edge.startAnchor ? JSON.parse(JSON.stringify(edge.startAnchor)) : null,
      end: edge.endAnchor ? JSON.parse(JSON.stringify(edge.endAnchor)) : null,
      reversed: Boolean(halfEdge.reversed),
      fullCircle: false,
      fullLoop: false,
    };
  }

  function buildArrangement(rawPrimitives) {
    const primitives = (rawPrimitives || []).map(normalizePrimitive).filter(Boolean);
    const scale = geometryScale(primitives);
    const epsilon = Math.max(DEFAULT_EPSILON, scale * 1e-9);
    const parameterEpsilon = Math.max(1e-9, epsilon / scale);
    const markers = new Map(primitives.map((primitive) => [primitive, []]));
    const intersectionRecords = [];
    const overlaps = [];
    for (const primitive of primitives) {
      if (primitive.kind !== "circle" && !(primitive.kind === "spline" && primitive.closed)) {
        markers.get(primitive).push({ t: 0, point: pointAt(primitive, 0) }, { t: 1, point: pointAt(primitive, 1) });
      }
    }
    const bounds = new Map(primitives.map((primitive) => [primitive, boundsForPrimitive(primitive)]));
    for (let firstIndex = 0; firstIndex < primitives.length; firstIndex++) {
      const first = primitives[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < primitives.length; secondIndex++) {
        const second = primitives[secondIndex];
        if (!boundsOverlap(bounds.get(first), bounds.get(second), epsilon)) continue;
        const result = pairIntersections(first, second, epsilon);
        if (result.overlap) {
          overlaps.push([first, second]);
          continue;
        }
        const points = dedupePoints(result.points, epsilon * 4);
        const firstPoints = points.map((point) => ({ point, t: primitiveParam(first, point, parameterEpsilon) })).filter((item) => item.t != null).sort((a, b) => a.t - b.t);
        const secondPoints = points.map((point) => ({ point, t: primitiveParam(second, point, parameterEpsilon) })).filter((item) => item.t != null).sort((a, b) => a.t - b.t);
        for (let index = 0; index < firstPoints.length; index++) {
          const item = firstPoints[index];
          addMarker(markers.get(first), item, parameterEpsilon);
          intersectionRecords.push({ primitive: first, other: second, t: item.t, occurrence: index });
        }
        for (let index = 0; index < secondPoints.length; index++) {
          const item = secondPoints[index];
          addMarker(markers.get(second), item, parameterEpsilon);
          intersectionRecords.push({ primitive: second, other: first, t: item.t, occurrence: index });
        }
      }
    }

    const vertices = [];
    const edges = [];
    const standaloneCycles = [];
    for (const primitive of primitives) {
      const list = markers.get(primitive).sort((a, b) => a.t - b.t);
      const closedPrimitive = primitive.kind === "circle" || (primitive.kind === "spline" && primitive.closed);
      if (closedPrimitive && list.length < 2) {
        standaloneCycles.push({
          primitive,
          points: sampleSpan(primitive, 0, 1, false).slice(0, -1),
          area: Math.abs(polygonArea(sampleSpan(primitive, 0, 1, false).slice(0, -1))),
          fullLoop: true,
        });
        continue;
      }
      const intervals = [];
      if (closedPrimitive) {
        for (let index = 0; index < list.length; index++) {
          const start = list[index];
          const endBase = list[(index + 1) % list.length];
          intervals.push({ start, end: { ...endBase, t: index === list.length - 1 ? endBase.t + 1 : endBase.t } });
        }
      } else {
        for (let index = 0; index < list.length - 1; index++) intervals.push({ start: list[index], end: list[index + 1] });
      }
      for (const interval of intervals) {
        if (interval.end.t - interval.start.t <= parameterEpsilon) continue;
        const startPoint = pointAt(primitive, closedPrimitive ? interval.start.t % 1 : interval.start.t);
        const endPoint = pointAt(primitive, closedPrimitive ? interval.end.t % 1 : interval.end.t);
        const edge = {
          primitive,
          startT: interval.start.t,
          endT: interval.end.t,
          start: vertexFor(vertices, startPoint, epsilon * 8),
          end: vertexFor(vertices, endPoint, epsilon * 8),
          startAnchor: markerAnchor(primitive, closedPrimitive ? interval.start.t % 1 : interval.start.t, intersectionRecords, parameterEpsilon),
          endAnchor: markerAnchor(primitive, closedPrimitive ? interval.end.t % 1 : interval.end.t, intersectionRecords, parameterEpsilon),
        };
        edges.push(edge);
      }
    }

    const halfEdges = [];
    for (const edge of edges) {
      const forward = { edge, from: edge.start, to: edge.end, reversed: false, twin: null, next: null, visited: false };
      const reverse = { edge, from: edge.end, to: edge.start, reversed: true, twin: forward, next: null, visited: false };
      forward.twin = reverse;
      halfEdges.push(forward, reverse);
      edge.start.outgoing.push(forward);
      edge.end.outgoing.push(reverse);
    }
    const outgoingAngle = (halfEdge) => {
      const t = halfEdge.reversed ? halfEdge.edge.endT : halfEdge.edge.startT;
      const closedPrimitive = halfEdge.edge.primitive.kind === "circle" || (halfEdge.edge.primitive.kind === "spline" && halfEdge.edge.primitive.closed);
      const tangent = tangentAt(halfEdge.edge.primitive, closedPrimitive ? ((t % 1) + 1) % 1 : t);
      const x = halfEdge.reversed ? -tangent.x : tangent.x;
      const y = halfEdge.reversed ? -tangent.y : tangent.y;
      return Math.atan2(y, x);
    };
    for (const vertex of vertices) vertex.outgoing.sort((a, b) => outgoingAngle(a) - outgoingAngle(b));
    for (const halfEdge of halfEdges) {
      const outgoing = halfEdge.to.outgoing;
      const twinIndex = outgoing.indexOf(halfEdge.twin);
      halfEdge.next = twinIndex < 0 ? null : outgoing[(twinIndex - 1 + outgoing.length) % outgoing.length];
    }

    const cycles = [];
    for (const start of halfEdges) {
      if (start.visited) continue;
      const sequence = [];
      let current = start;
      const guard = halfEdges.length + 1;
      while (current && !current.visited && sequence.length <= guard) {
        current.visited = true;
        sequence.push(current);
        current = current.next;
        if (current === start) break;
      }
      if (current !== start || sequence.length < 2) continue;
      const points = cyclePoints(sequence);
      const area = polygonArea(points);
      if (points.length >= 3 && area > epsilon * epsilon * 8) cycles.push({ halfEdges: sequence, points, area, fullLoop: false });
    }
    for (const standalone of standaloneCycles) cycles.push({ ...standalone, halfEdges: [], fullLoop: true });

    for (let index = 0; index < cycles.length; index++) {
      const cycle = cycles[index];
      const representative = cycleRepresentative(cycle, epsilon);
      let parent = null;
      for (let candidateIndex = 0; candidateIndex < cycles.length; candidateIndex++) {
        if (candidateIndex === index) continue;
        const candidate = cycles[candidateIndex];
        if (candidate.area <= cycle.area) continue;
        if (!pointInPolygon(representative, candidate.points, epsilon).inside) continue;
        if (parent == null || candidate.area < cycles[parent].area) parent = candidateIndex;
      }
      cycle.parent = parent;
    }
    return { primitives, epsilon, parameterEpsilon, cycles, overlaps };
  }

  function overlapAffectsCycle(overlap, cycle) {
    const keys = new Set(cycle.fullLoop
      ? [`${cycle.primitive.kind}:${cycle.primitive.id}`]
      : cycle.halfEdges.map((halfEdge) => `${halfEdge.edge.primitive.kind}:${halfEdge.edge.primitive.id}`));
    return overlap.some((primitive) => keys.has(`${primitive.kind}:${primitive.id}`));
  }

  function serializeCycle(cycle, role) {
    if (cycle.fullLoop) {
      return {
        role,
        spans: [{ source: primitiveRef(cycle.primitive), start: null, end: null, reversed: false, fullCircle: cycle.primitive.kind === "circle", fullLoop: true }],
      };
    }
    return { role, spans: cycle.halfEdges.map(serializeHalfEdge) };
  }

  function findFaceInIndex(arrangement, point) {
    if (!finitePoint(point)) return { ok: false, code: "invalid-point", reason: "Invalid point." };
    if (!arrangement?.cycles || !Array.isArray(arrangement.overlaps)) return { ok: false, code: "invalid-boundary", reason: "Invalid region index." };
    const candidates = arrangement.cycles
      .map((cycle, index) => ({ cycle, index, hit: pointInPolygon(point, cycle.points, arrangement.epsilon) }))
      .filter((item) => item.hit.inside)
      .sort((a, b) => a.cycle.area - b.cycle.area);
    if (candidates.some((item) => item.hit.boundary)) return { ok: false, code: "point-on-boundary", reason: "Click inside the region, away from its boundary." };
    const selected = candidates[0];
    if (!selected) {
      if (arrangement.overlaps.length) return { ok: false, code: "overlapping-boundary", reason: "The boundary contains overlapping geometry." };
      return { ok: false, code: "open-region", reason: "No closed region was found." };
    }
    if (arrangement.overlaps.some((overlap) => overlapAffectsCycle(overlap, selected.cycle))) {
      return { ok: false, code: "overlapping-boundary", reason: "The boundary contains overlapping geometry." };
    }
    const holes = arrangement.cycles.filter((cycle) => cycle.parent === selected.index);
    const boundaryLoops = [serializeCycle(selected.cycle, "outer"), ...holes.map((cycle) => serializeCycle(cycle, "hole"))];
    return {
      ok: true,
      boundaryLoops,
      resolved: { loops: [{ role: "outer", points: selected.cycle.points }, ...holes.map((cycle) => ({ role: "hole", points: cycle.points }))] },
    };
  }

  function createRegionIndex(rawPrimitives) {
    return buildArrangement(rawPrimitives);
  }

  function findFaceAtPoint(rawPrimitives, point) {
    return findFaceInIndex(createRegionIndex(rawPrimitives), point);
  }

  function normalizeAnchor(anchor) {
    if (!anchor || typeof anchor !== "object") return null;
    if (anchor.type === "endpoint" && ["p1", "p2", "start", "end"].includes(anchor.name)) return { type: "endpoint", name: anchor.name };
    if (anchor.type === "intersection" && refKey(anchor.other) && Number.isInteger(Number(anchor.occurrence)) && Number(anchor.occurrence) >= 0) {
      return { type: "intersection", other: { kind: anchor.other.kind, path: anchor.other.path.map(String) }, occurrence: Number(anchor.occurrence) };
    }
    return null;
  }

  function normalizeBoundaryLoops(boundaryLoops) {
    if (!Array.isArray(boundaryLoops) || boundaryLoops.length === 0) return null;
    const loops = [];
    for (let loopIndex = 0; loopIndex < boundaryLoops.length; loopIndex++) {
      const loop = boundaryLoops[loopIndex];
      if (!loop || !Array.isArray(loop.spans) || loop.spans.length === 0) return null;
      const role = loopIndex === 0 ? "outer" : "hole";
      const spans = [];
      for (const rawSpan of loop.spans) {
        if (!rawSpan || !refKey(rawSpan.source)) return null;
        const fullLoop = Boolean(rawSpan.fullLoop || rawSpan.fullCircle);
        const start = fullLoop ? null : normalizeAnchor(rawSpan.start);
        const end = fullLoop ? null : normalizeAnchor(rawSpan.end);
        if (!fullLoop && (!start || !end)) return null;
        spans.push({
          source: { kind: rawSpan.source.kind, path: rawSpan.source.path.map(String) },
          start,
          end,
          reversed: Boolean(rawSpan.reversed),
          fullCircle: Boolean(rawSpan.fullCircle),
          fullLoop,
        });
      }
      loops.push({ role, spans });
    }
    return loops;
  }

  function resolveAnchor(source, anchor, primitiveMap, epsilon) {
    if (anchor.type === "endpoint") {
      if (source.kind === "line" && anchor.name === "p1") return 0;
      if (source.kind === "line" && anchor.name === "p2") return 1;
      if (source.kind === "arc" && anchor.name === "start") return 0;
      if (source.kind === "arc" && anchor.name === "end") return 1;
      if (source.kind === "spline" && !source.closed && anchor.name === "start") return 0;
      if (source.kind === "spline" && !source.closed && anchor.name === "end") return 1;
      return null;
    }
    const other = primitiveMap.get(refKey(anchor.other));
    if (!other) return null;
    const result = pairIntersections(source, other, epsilon);
    if (result.overlap) return null;
    const points = dedupePoints(result.points, epsilon * 4)
      .map((point) => ({ point, t: primitiveParam(source, point, epsilon) }))
      .filter((item) => item.t != null)
      .sort((a, b) => a.t - b.t);
    return points[anchor.occurrence]?.t ?? null;
  }

  function resolveBoundary(boundaryLoops, rawPrimitives) {
    const normalizedLoops = normalizeBoundaryLoops(boundaryLoops);
    if (!normalizedLoops) return { ok: false, code: "invalid-boundary", reason: "The hatch boundary data is invalid." };
    const primitives = (rawPrimitives || []).map(normalizePrimitive).filter(Boolean);
    const scale = geometryScale(primitives);
    const epsilon = Math.max(DEFAULT_EPSILON, scale * 1e-9);
    const primitiveMap = new Map(primitives.map((primitive) => [`${primitive.kind}:${primitive.id}`, primitive]));
    const resolvedLoops = [];
    for (const loop of normalizedLoops) {
      const resolvedSpans = [];
      const points = [];
      for (const span of loop.spans) {
        const primitive = primitiveMap.get(refKey(span.source));
        if (!primitive) return { ok: false, code: "missing-boundary", reason: `Boundary geometry ${refId(span.source)} is missing.` };
        if (span.fullLoop) {
          if (primitive.kind !== "circle" && !(primitive.kind === "spline" && primitive.closed)) return { ok: false, code: "invalid-boundary", reason: "A full-loop boundary no longer resolves to a closed primitive." };
          const sampled = sampleSpan(primitive, 0, 1, span.reversed);
          resolvedSpans.push({ primitive, startT: 0, endT: 1, reversed: span.reversed, fullCircle: primitive.kind === "circle", fullLoop: true });
          points.push(...sampled.slice(0, -1));
          continue;
        }
        let startT = resolveAnchor(primitive, span.start, primitiveMap, epsilon);
        let endT = resolveAnchor(primitive, span.end, primitiveMap, epsilon);
        if (startT == null || endT == null) return { ok: false, code: "changed-topology", reason: `Boundary geometry ${primitive.id} no longer has the stored connection.` };
        if ((primitive.kind === "circle" || (primitive.kind === "spline" && primitive.closed)) && endT <= startT + 1e-10) endT += 1;
        if (endT - startT <= 1e-10) return { ok: false, code: "changed-topology", reason: `Boundary geometry ${primitive.id} has a collapsed span.` };
        const sampled = sampleSpan(primitive, startT, endT, span.reversed);
        if (points.length) {
          const previous = points[points.length - 1];
          if (Math.hypot(previous.x - sampled[0].x, previous.y - sampled[0].y) > epsilon * 16) {
            return { ok: false, code: "open-boundary", reason: "The hatch boundary is no longer closed." };
          }
          sampled.shift();
        }
        points.push(...sampled);
        resolvedSpans.push({ primitive, startT, endT, reversed: span.reversed, fullCircle: false, fullLoop: false });
      }
      if (points.length < 3) return { ok: false, code: "invalid-boundary", reason: "The hatch boundary has too few points." };
      const first = points[0];
      const last = points[points.length - 1];
      if (Math.hypot(first.x - last.x, first.y - last.y) <= epsilon * 16) points.pop();
      else if (loop.spans.length > 1) return { ok: false, code: "open-boundary", reason: "The hatch boundary is no longer closed." };
      if (Math.abs(polygonArea(points)) <= epsilon * epsilon * 8) return { ok: false, code: "collapsed-boundary", reason: "The hatch boundary has collapsed." };
      resolvedLoops.push({ role: loop.role, spans: resolvedSpans, points });
    }
    const outer = resolvedLoops[0];
    for (const hole of resolvedLoops.slice(1)) {
      const representative = cycleRepresentative(hole, epsilon);
      if (!pointInPolygon(representative, outer.points, epsilon).inside) return { ok: false, code: "changed-topology", reason: "A hatch hole is no longer inside its outer boundary." };
    }
    return { ok: true, loops: resolvedLoops, epsilon };
  }

  function containsPoint(resolved, point) {
    if (!resolved?.loops?.length || !finitePoint(point)) return false;
    const epsilon = resolved.epsilon || DEFAULT_EPSILON;
    if (!pointInPolygon(point, resolved.loops[0].points, epsilon).inside) return false;
    return !resolved.loops.slice(1).some((loop) => pointInPolygon(point, loop.points, epsilon).inside);
  }

  function boundaryGeometryRefs(boundaryLoops) {
    const loops = normalizeBoundaryLoops(boundaryLoops);
    if (!loops) return [];
    const unique = new Map();
    for (const loop of loops) for (const span of loop.spans) unique.set(refKey(span.source), span.source);
    return [...unique.values()].map((ref) => ({ kind: ref.kind, path: ref.path.slice() }));
  }

  function rewriteBoundaryRefs(boundaryLoops, mapper) {
    const loops = normalizeBoundaryLoops(boundaryLoops);
    if (!loops || typeof mapper !== "function") return null;
    const rewriteRef = (ref) => {
      const mapped = mapper({ kind: ref.kind, path: ref.path.slice() });
      return refKey(mapped) ? { kind: mapped.kind, path: mapped.path.map(String) } : null;
    };
    const result = [];
    for (const loop of loops) {
      const spans = [];
      for (const span of loop.spans) {
        const source = rewriteRef(span.source);
        if (!source) return null;
        const rewriteAnchor = (anchor) => {
          if (!anchor || anchor.type === "endpoint") return anchor ? { ...anchor } : null;
          const other = rewriteRef(anchor.other);
          return other ? { type: "intersection", other, occurrence: anchor.occurrence } : null;
        };
        const start = rewriteAnchor(span.start);
        const end = rewriteAnchor(span.end);
        if (!span.fullLoop && (!start || !end)) return null;
        spans.push({ source, start, end, reversed: span.reversed, fullCircle: span.fullCircle, fullLoop: span.fullLoop });
      }
      result.push({ role: loop.role, spans });
    }
    return result;
  }

  window.HatchRegionEngine = Object.freeze({
    findFaceAtPoint,
    createRegionIndex,
    findFaceInIndex,
    resolveBoundary,
    containsPoint,
    normalizeBoundaryLoops,
    boundaryGeometryRefs,
    rewriteBoundaryRefs,
  });
})();

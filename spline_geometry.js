/* spline_geometry.js: Pure cubic interpolating-spline geometry helpers. */
(function () {
  "use strict";

  const EPSILON = 1e-9;

  function finitePoint(point) {
    return Boolean(point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)));
  }

  function point(point) {
    return { x: Number(point.x), y: Number(point.y) };
  }

  function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function solveLinearSystem(matrix, values) {
    const n = values.length;
    const rows = matrix.map((row, index) => [...row, values[index]]);
    for (let column = 0; column < n; column++) {
      let pivot = column;
      for (let row = column + 1; row < n; row++) {
        if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
      }
      if (Math.abs(rows[pivot][column]) <= EPSILON) return null;
      [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
      const scale = rows[column][column];
      for (let index = column; index <= n; index++) rows[column][index] /= scale;
      for (let row = 0; row < n; row++) {
        if (row === column) continue;
        const factor = rows[row][column];
        if (Math.abs(factor) <= EPSILON) continue;
        for (let index = column; index <= n; index++) rows[row][index] -= factor * rows[column][index];
      }
    }
    return rows.map((row) => row[n]);
  }

  function segmentLengths(points, closed) {
    const count = closed ? points.length : points.length - 1;
    const lengths = [];
    for (let index = 0; index < count; index++) {
      const length = distance(points[index], points[(index + 1) % points.length]);
      if (!Number.isFinite(length) || length <= EPSILON) return null;
      lengths.push(length);
    }
    return lengths;
  }

  function solveSecondDerivatives(points, lengths, closed, key) {
    const n = points.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const values = Array(n).fill(0);
    if (!closed) {
      matrix[0][0] = 1;
      matrix[n - 1][n - 1] = 1;
      for (let index = 1; index < n - 1; index++) {
        const previousLength = lengths[index - 1];
        const nextLength = lengths[index];
        matrix[index][index - 1] = previousLength;
        matrix[index][index] = 2 * (previousLength + nextLength);
        matrix[index][index + 1] = nextLength;
        values[index] = 6 * (
          (points[index + 1][key] - points[index][key]) / nextLength
          - (points[index][key] - points[index - 1][key]) / previousLength
        );
      }
      return solveLinearSystem(matrix, values);
    }
    for (let index = 0; index < n; index++) {
      const previous = (index - 1 + n) % n;
      const next = (index + 1) % n;
      const previousLength = lengths[previous];
      const nextLength = lengths[index];
      matrix[index][previous] += previousLength;
      matrix[index][index] += 2 * (previousLength + nextLength);
      matrix[index][next] += nextLength;
      values[index] = 6 * (
        (points[next][key] - points[index][key]) / nextLength
        - (points[index][key] - points[previous][key]) / previousLength
      );
    }
    return solveLinearSystem(matrix, values);
  }

  function build(rawPoints, options = {}) {
    const closed = Boolean(options.closed);
    const source = Array.isArray(rawPoints) ? rawPoints.filter(finitePoint).map(point) : [];
    if (source.length >= 2 && distance(source[0], source[source.length - 1]) <= EPSILON) source.pop();
    if (source.length < 3) return { valid: false, reason: "at-least-three-points", closed, spans: [] };
    const lengths = segmentLengths(source, closed);
    if (!lengths) return { valid: false, reason: "duplicate-adjacent-points", closed, spans: [] };
    const secondX = solveSecondDerivatives(source, lengths, closed, "x");
    const secondY = solveSecondDerivatives(source, lengths, closed, "y");
    if (!secondX || !secondY) return { valid: false, reason: "singular-fit-points", closed, spans: [] };
    const total = lengths.reduce((sum, value) => sum + value, 0);
    const spans = [];
    let accumulated = 0;
    for (let index = 0; index < lengths.length; index++) {
      const next = (index + 1) % source.length;
      const h = lengths[index];
      const p0 = source[index];
      const p3 = source[next];
      const startDerivative = {
        x: (p3.x - p0.x) / h - h * (2 * secondX[index] + secondX[next]) / 6,
        y: (p3.y - p0.y) / h - h * (2 * secondY[index] + secondY[next]) / 6,
      };
      const endDerivative = {
        x: (p3.x - p0.x) / h + h * (secondX[index] + 2 * secondX[next]) / 6,
        y: (p3.y - p0.y) / h + h * (secondY[index] + 2 * secondY[next]) / 6,
      };
      spans.push({
        p0: point(p0),
        p1: { x: p0.x + startDerivative.x * h / 3, y: p0.y + startDerivative.y * h / 3 },
        p2: { x: p3.x - endDerivative.x * h / 3, y: p3.y - endDerivative.y * h / 3 },
        p3: point(p3),
        t0: accumulated / total,
        t1: (accumulated + h) / total,
      });
      accumulated += h;
    }
    return { valid: true, degree: 3, closed, points: source, spans, totalParameterLength: total };
  }

  function normalizedParameter(curve, value) {
    const numeric = Number(value) || 0;
    if (curve.closed) return ((numeric % 1) + 1) % 1;
    return Math.max(0, Math.min(1, numeric));
  }

  function spanAt(curve, parameter) {
    if (!curve?.valid || !curve.spans.length) return null;
    const t = normalizedParameter(curve, parameter);
    if (!curve.closed && t >= 1) return { span: curve.spans[curve.spans.length - 1], local: 1, t: 1 };
    const span = curve.spans.find((item) => t >= item.t0 - EPSILON && t < item.t1 - EPSILON) || curve.spans[curve.spans.length - 1];
    const width = Math.max(EPSILON, span.t1 - span.t0);
    return { span, local: Math.max(0, Math.min(1, (t - span.t0) / width)), t };
  }

  function cubicValue(a, b, c, d, t) {
    const mt = 1 - t;
    return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
  }

  function evaluate(curve, parameter) {
    const resolved = spanAt(curve, parameter);
    if (!resolved) return null;
    const { span, local } = resolved;
    return {
      x: cubicValue(span.p0.x, span.p1.x, span.p2.x, span.p3.x, local),
      y: cubicValue(span.p0.y, span.p1.y, span.p2.y, span.p3.y, local),
    };
  }

  function derivative(curve, parameter) {
    const resolved = spanAt(curve, parameter);
    if (!resolved) return null;
    const { span, local } = resolved;
    const mt = 1 - local;
    const scale = 1 / Math.max(EPSILON, span.t1 - span.t0);
    return {
      x: 3 * (mt * mt * (span.p1.x - span.p0.x) + 2 * mt * local * (span.p2.x - span.p1.x) + local * local * (span.p3.x - span.p2.x)) * scale,
      y: 3 * (mt * mt * (span.p1.y - span.p0.y) + 2 * mt * local * (span.p2.y - span.p1.y) + local * local * (span.p3.y - span.p2.y)) * scale,
    };
  }

  function secondDerivative(curve, parameter) {
    const resolved = spanAt(curve, parameter);
    if (!resolved) return null;
    const { span, local } = resolved;
    const scale = 1 / Math.max(EPSILON, (span.t1 - span.t0) ** 2);
    return {
      x: 6 * ((1 - local) * (span.p2.x - 2 * span.p1.x + span.p0.x) + local * (span.p3.x - 2 * span.p2.x + span.p1.x)) * scale,
      y: 6 * ((1 - local) * (span.p2.y - 2 * span.p1.y + span.p0.y) + local * (span.p3.y - 2 * span.p2.y + span.p1.y)) * scale,
    };
  }

  function distancePointToSegment(value, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared <= EPSILON ? 0 : Math.max(0, Math.min(1, ((value.x - a.x) * dx + (value.y - a.y) * dy) / lengthSquared));
    const projection = { x: a.x + dx * ratio, y: a.y + dy * ratio };
    return { distance: distance(value, projection), ratio, point: projection };
  }

  function sampleRange(curve, start, end, tolerance, output, depth = 0) {
    const a = evaluate(curve, start);
    const b = evaluate(curve, end);
    if (!a || !b) return;
    const quarter = evaluate(curve, start + (end - start) * 0.25);
    const middle = evaluate(curve, (start + end) / 2);
    const threeQuarter = evaluate(curve, start + (end - start) * 0.75);
    const flatness = Math.max(
      distancePointToSegment(quarter, a, b).distance,
      distancePointToSegment(middle, a, b).distance,
      distancePointToSegment(threeQuarter, a, b).distance,
    );
    if (depth >= 14 || flatness <= tolerance) {
      if (!output.length) output.push({ t: start, point: a });
      output.push({ t: end, point: b });
      return;
    }
    const mid = (start + end) / 2;
    sampleRange(curve, start, mid, tolerance, output, depth + 1);
    sampleRange(curve, mid, end, tolerance, output, depth + 1);
  }

  function flatten(curve, options = {}) {
    if (!curve?.valid) return [];
    const tolerance = Math.max(EPSILON, Number(options.tolerance) || Math.max(1e-4, curve.totalParameterLength * 1e-4));
    let start = Number.isFinite(Number(options.start)) ? Number(options.start) : 0;
    let end = Number.isFinite(Number(options.end)) ? Number(options.end) : 1;
    const reversed = end < start;
    if (reversed) [start, end] = [end, start];
    const ranges = [];
    if (curve.closed && end > 1) ranges.push([start, 1], [0, end - 1]);
    else ranges.push([Math.max(0, start), Math.min(1, end)]);
    const result = [];
    for (const [rangeStart, rangeEnd] of ranges) {
      for (const span of curve.spans) {
        const from = Math.max(rangeStart, span.t0);
        const to = Math.min(rangeEnd, span.t1);
        if (to - from <= EPSILON) continue;
        const sampled = [];
        sampleRange(curve, from, to, tolerance, sampled);
        if (result.length && sampled.length) sampled.shift();
        result.push(...sampled);
      }
    }
    if (reversed) result.reverse();
    return result;
  }

  function quadraticRoots(a, b, c) {
    if (Math.abs(a) <= EPSILON) return Math.abs(b) <= EPSILON ? [] : [-c / b];
    const discriminant = b * b - 4 * a * c;
    if (discriminant < -EPSILON) return [];
    const root = Math.sqrt(Math.max(0, discriminant));
    return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
  }

  function bounds(curve) {
    if (!curve?.valid || !curve.spans.length) return null;
    const values = [];
    for (const span of curve.spans) {
      values.push(span.p0, span.p3);
      for (const key of ["x", "y"]) {
        const a = -span.p0[key] + 3 * span.p1[key] - 3 * span.p2[key] + span.p3[key];
        const b = 2 * (span.p0[key] - 2 * span.p1[key] + span.p2[key]);
        const c = span.p1[key] - span.p0[key];
        for (const root of quadraticRoots(a, b, c)) {
          if (root > 0 && root < 1) values.push({
            x: cubicValue(span.p0.x, span.p1.x, span.p2.x, span.p3.x, root),
            y: cubicValue(span.p0.y, span.p1.y, span.p2.y, span.p3.y, root),
          });
        }
      }
    }
    return {
      minX: Math.min(...values.map((item) => item.x)),
      minY: Math.min(...values.map((item) => item.y)),
      maxX: Math.max(...values.map((item) => item.x)),
      maxY: Math.max(...values.map((item) => item.y)),
    };
  }

  function closestPoint(curve, target, options = {}) {
    if (!curve?.valid || !finitePoint(target)) return null;
    const samples = flatten(curve, { tolerance: Number(options.tolerance) || Math.max(1e-4, curve.totalParameterLength * 1e-4) });
    let best = null;
    for (let index = 0; index < samples.length - 1; index++) {
      const projection = distancePointToSegment(target, samples[index].point, samples[index + 1].point);
      if (!best || projection.distance < best.distance) {
        best = {
          distance: projection.distance,
          t: samples[index].t + (samples[index + 1].t - samples[index].t) * projection.ratio,
        };
      }
    }
    if (!best) return null;
    let t = best.t;
    for (let iteration = 0; iteration < 10; iteration++) {
      const value = evaluate(curve, t);
      const first = derivative(curve, t);
      const second = secondDerivative(curve, t);
      const rx = value.x - target.x;
      const ry = value.y - target.y;
      const numerator = rx * first.x + ry * first.y;
      const denominator = first.x * first.x + first.y * first.y + rx * second.x + ry * second.y;
      if (!Number.isFinite(denominator) || Math.abs(denominator) <= EPSILON) break;
      const next = curve.closed ? normalizedParameter(curve, t - numerator / denominator) : Math.max(0, Math.min(1, t - numerator / denominator));
      if (Math.abs(next - t) <= 1e-12) break;
      t = next;
    }
    const resolvedPoint = evaluate(curve, t);
    return { t, point: resolvedPoint, distance: distance(target, resolvedPoint) };
  }

  function approximateLength(curve, tolerance = null) {
    const samples = flatten(curve, { tolerance: tolerance || Math.max(1e-4, curve.totalParameterLength * 2e-5) });
    let total = 0;
    for (let index = 1; index < samples.length; index++) total += distance(samples[index - 1].point, samples[index].point);
    return total;
  }

  function lineIntersection(a1, a2, b1, b2, epsilon) {
    const ax = a2.x - a1.x;
    const ay = a2.y - a1.y;
    const bx = b2.x - b1.x;
    const by = b2.y - b1.y;
    const determinant = ax * by - ay * bx;
    const qx = b1.x - a1.x;
    const qy = b1.y - a1.y;
    if (Math.abs(determinant) <= epsilon) return null;
    const ta = (qx * by - qy * bx) / determinant;
    const tb = (qx * ay - qy * ax) / determinant;
    if (ta < -epsilon || ta > 1 + epsilon || tb < -epsilon || tb > 1 + epsilon) return null;
    return { x: a1.x + ax * ta, y: a1.y + ay * ta, ta, tb };
  }

  function primitivePolyline(primitive, tolerance) {
    if (primitive.kind === "spline") {
      const curve = primitive.curve?.valid ? primitive.curve : build(primitive.points || primitive.fitPoints || [], { closed: primitive.closed });
      return flatten(curve, { tolerance });
    }
    if (primitive.kind === "line") return [{ t: 0, point: point(primitive.p1) }, { t: 1, point: point(primitive.p2) }];
    const radius = Number(primitive.radius);
    const start = primitive.kind === "circle" ? 0 : Number(primitive.startAngle);
    const sweep = primitive.kind === "circle" ? Math.PI * 2 : Number(primitive.endAngle) - start;
    const count = Math.max(24, Math.ceil(Math.abs(sweep) * Math.sqrt(Math.max(radius, 1) / Math.max(tolerance, 1e-6))));
    return Array.from({ length: count + 1 }, (_, index) => {
      const t = index / count;
      const angle = start + sweep * t;
      return { t, point: { x: primitive.center.x + Math.cos(angle) * radius, y: primitive.center.y + Math.sin(angle) * radius } };
    });
  }

  function intersections(first, second, options = {}) {
    const scale = Math.max(first?.curve?.totalParameterLength || 1, second?.curve?.totalParameterLength || 1);
    const tolerance = Math.max(1e-6, Number(options.tolerance) || scale * 1e-5);
    const a = primitivePolyline(first, tolerance);
    const b = primitivePolyline(second, tolerance);
    const points = [];
    for (let ai = 0; ai < a.length - 1; ai++) {
      for (let bi = 0; bi < b.length - 1; bi++) {
        const hit = lineIntersection(a[ai].point, a[ai + 1].point, b[bi].point, b[bi + 1].point, tolerance * 0.1);
        if (!hit) continue;
        const candidate = {
          x: hit.x,
          y: hit.y,
          t1: a[ai].t + (a[ai + 1].t - a[ai].t) * hit.ta,
          t2: b[bi].t + (b[bi + 1].t - b[bi].t) * hit.tb,
        };
        if (!points.some((item) => distance(item, candidate) <= tolerance * 4)) points.push(candidate);
      }
    }
    const overlap = a.length === b.length && a.length > 1 && (
      a.every((entry, index) => distance(entry.point, b[index].point) <= tolerance)
      || a.every((entry, index) => distance(entry.point, b[b.length - 1 - index].point) <= tolerance)
    );
    return { points, overlap };
  }

  const api = Object.freeze({ build, evaluate, derivative, secondDerivative, flatten, bounds, closestPoint, approximateLength, intersections });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.SplineGeometry = api;
})();

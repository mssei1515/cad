/* constraint_solver.js: 2D geometry constraint solver core */
(function () {
  "use strict";

  const MIN_MODEL_LENGTH = 1e-6;
  const MIN_ORIENTATION_LENGTH = 1e-9;
  const GUIDED_DRAG_BACKGROUND_WEIGHT = 1e-4;
  const GUIDED_DRAG_TARGET_CONSTRAINT_WEIGHT = 1;
  const GUIDED_DRAG_SINGLE_TARGET_MOTION_FACTOR = 1;
  const GUIDED_DRAG_MULTI_TARGET_MOTION_FACTOR = 2;
  const GUIDED_DRAG_ACTIVITY_TOLERANCE = 1e-4;
  const GUIDED_DRAG_FAST_TARGET_STEP = 10;
  const GUIDED_DRAG_FAST_MULTI_TARGET_TOLERANCE = 5e-2;
  // Direct point coordinates stay precise during previews; curved multi-part
  // motion uses the relaxed preview tolerance above and is solved exactly on
  // pointer-up.
  const GUIDED_DRAG_SMALL_ERROR_TOLERANCE = 1e-5;

  function hypot2(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function vectorNorm(v) {
    let s = 0;
    for (const x of v) s += x * x;
    return Math.sqrt(s);
  }

  function normalizeAngle(angle) {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a <= -Math.PI) a += Math.PI * 2;
    return a;
  }

  function normalizeAxisAngle(angle) {
    let a = Math.abs(normalizeAngle(angle));
    return clamp(a, 0, Math.PI);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function centerOf(item) {
    return item.center || item;
  }

  function radiusOf(item) {
    return typeof item.radius === "function" ? item.radius() : 0;
  }

  function arcEndpointPoint(arc, endpoint) {
    const angle = endpoint === "start" ? arc.startAngle : arc.endAngle;
    return {
      x: arc.center.x + Math.cos(angle) * arc.radius(),
      y: arc.center.y + Math.sin(angle) * arc.radius(),
    };
  }

  class Point {
    constructor(id, x, y, fixed = false, kind = "explicit") {
      this.id = id;
      this.x = x;
      this.y = y;
      this.fixed = fixed;
      this.kind = kind;
    }
  }

  class Line {
    constructor(id, p1, p2, construction = false) {
      this.id = id;
      this.p1 = p1;
      this.p2 = p2;
      this.construction = Boolean(construction);
      this.orientationHint = null;
    }

    dx() {
      return this.p2.x - this.p1.x;
    }

    dy() {
      return this.p2.y - this.p1.y;
    }

    length() {
      return hypot2(this.dx(), this.dy());
    }
  }

  class Circle {
    constructor(id, center, radiusValue, construction = false) {
      this.id = id;
      this.center = center;
      this.radiusValue = Math.max(Number(radiusValue) || 0, MIN_MODEL_LENGTH);
      this.construction = Boolean(construction);
    }

    radius() {
      return this.radiusValue;
    }
  }

  class Arc {
    constructor(id, center, radiusValue, startAngle, endAngle, construction = false) {
      this.id = id;
      this.center = center;
      this.radiusValue = Math.max(Number(radiusValue) || 0, MIN_MODEL_LENGTH);
      this.startAngle = Number(startAngle) || 0;
      this.endAngle = Number(endAngle) || 0;
      this.construction = Boolean(construction);
    }

    radius() {
      return this.radiusValue;
    }

    startPoint() {
      return {
        x: this.center.x + Math.cos(this.startAngle) * this.radiusValue,
        y: this.center.y + Math.sin(this.startAngle) * this.radiusValue,
      };
    }

    endPoint() {
      return {
        x: this.center.x + Math.cos(this.endAngle) * this.radiusValue,
        y: this.center.y + Math.sin(this.endAngle) * this.radiusValue,
      };
    }
  }

  class Constraint {
    constructor(name, weight = 1) {
      this.name = name;
      this.weight = weight;
      this.enabled = true;
    }

    rawError() {
      throw new Error("rawError() is not implemented");
    }

    error() {
      const e = this.rawError();
      return Array.isArray(e) ? e.map((v) => v * this.weight) : e * this.weight;
    }
  }

  class DistanceConstraint extends Constraint {
    constructor(p1, p2, target) {
      super(`寸法 ${p1.id}-${p2.id} = ${target}`, 1);
      this.p1 = p1;
      this.p2 = p2;
      this.target = target;
    }

    rawError() {
      return hypot2(this.p2.x - this.p1.x, this.p2.y - this.p1.y) - this.target;
    }
  }

  function lineAxisAngle(line1, line2, startFlip = 0, endFlip = 0) {
    const flip1 = startFlip ? -1 : 1;
    const flip2 = endFlip ? -1 : 1;
    const ax = line1.dx() * flip1;
    const ay = line1.dy() * flip1;
    const bx = line2.dx() * flip2;
    const by = line2.dy() * flip2;
    const la = hypot2(ax, ay);
    const lb = hypot2(bx, by);
    if (la < MIN_ORIENTATION_LENGTH || lb < MIN_ORIENTATION_LENGTH) return 0;
    const cos = (ax * bx + ay * by) / (la * lb);
    return Math.acos(clamp(cos, -1, 1));
  }

  class PointAxisDistanceConstraint extends Constraint {
    constructor(p1, p2, target, axis = "x", sign = null) {
      super(`${axis === "y" ? "垂直寸法" : "水平寸法"} ${p1.id}-${p2.id} = ${target}`, 1);
      this.p1 = p1;
      this.p2 = p2;
      this.target = target;
      this.axis = axis === "y" ? "y" : "x";
      const current = this.p2[this.axis] - this.p1[this.axis];
      this.sign = sign || (current < 0 ? -1 : 1);
    }

    rawError() {
      return (this.p2[this.axis] - this.p1[this.axis]) * this.sign - this.target;
    }
  }

  function signedPointLineDistance(point, line) {
    let dx = line.dx();
    let dy = line.dy();
    let anchor = line.p1;
    if (line.orientationHint === "horizontal") {
      dx = 1;
      dy = 0;
      anchor = { x: line.p1.x, y: (line.p1.y + line.p2.y) / 2 };
    } else if (line.orientationHint === "vertical") {
      dx = 0;
      dy = 1;
      anchor = { x: (line.p1.x + line.p2.x) / 2, y: line.p1.y };
    }
    const len = hypot2(dx, dy);
    if (len < 1e-12) return 0;
    return ((point.x - anchor.x) * -dy + (point.y - anchor.y) * dx) / len;
  }

  function signedPointDirectedLineDistance(point, line) {
    const dx = line.dx();
    const dy = line.dy();
    const len = hypot2(dx, dy);
    if (len < 1e-12) return 0;
    return ((point.x - line.p1.x) * -dy + (point.y - line.p1.y) * dx) / len;
  }

  class LineMinimumLengthConstraint extends Constraint {
    constructor(line, target) {
      super(`最小線長 ${line.id}`, 1);
      this.line = line;
      this.target = target;
    }

    rawError() {
      const length = this.line.length();
      return length >= this.target ? 0 : this.target - length;
    }
  }

  class PointLineDistanceConstraint extends Constraint {
    constructor(point, line, target, sign = null) {
      super(`点-線寸法 ${point.id}-${line.id} = ${target}`, 1);
      this.point = point;
      this.line = line;
      this.target = target;
      const current = signedPointLineDistance(point, line);
      this.sign = sign || (current < 0 ? -1 : 1);
    }

    rawError() {
      return signedPointLineDistance(this.point, this.line) * this.sign - this.target;
    }
  }

  class LineLineDistanceConstraint extends Constraint {
    constructor(line1, line2, target, sign = null) {
      super(`線-線寸法 ${line1.id}-${line2.id} = ${target}`, 1);
      this.line1 = line1;
      this.line2 = line2;
      this.target = target;
      const current = signedPointLineDistance(line2.p1, line1);
      this.sign = sign || (current < 0 ? -1 : 1);
    }

    rawError() {
      const ax = this.line1.dx();
      const ay = this.line1.dy();
      const bx = this.line2.dx();
      const by = this.line2.dy();
      const la = hypot2(ax, ay);
      const lb = hypot2(bx, by);
      const parallel = la < MIN_ORIENTATION_LENGTH || lb < MIN_ORIENTATION_LENGTH ? 0 : ((ax * by - ay * bx) / (la * lb)) * Math.max(this.target, 1);
      return [signedPointLineDistance(this.line2.p1, this.line1) * this.sign - this.target, parallel];
    }
  }

  class OffsetConstraint extends Constraint {
    constructor(source, offset, target, sign = null) {
      super(`オフセット寸法 ${source.id}-${offset.id} = ${target}`, 1);
      this.source = source;
      this.offset = offset;
      this.target = target;
      if (source instanceof Line && offset instanceof Line) {
        const current = signedPointDirectedLineDistance(offset.p1, source);
        this.sign = sign || (current < 0 ? -1 : 1);
      } else {
        const current = radiusOf(offset) - radiusOf(source);
        this.sign = sign || (current < 0 ? -1 : 1);
      }
    }

    rawError() {
      if (this.source instanceof Line && this.offset instanceof Line) {
        const sx = this.source.dx();
        const sy = this.source.dy();
        const len = hypot2(sx, sy);
        const tx = len > MIN_ORIENTATION_LENGTH ? sx / len : 1;
        const ty = len > MIN_ORIENTATION_LENGTH ? sy / len : 0;
        const dx = this.offset.p1.x - this.source.p1.x;
        const dy = this.offset.p1.y - this.source.p1.y;
        return [
          this.offset.dx() - sx,
          this.offset.dy() - sy,
          dx * tx + dy * ty,
          signedPointDirectedLineDistance(this.offset.p1, this.source) * this.sign - this.target,
        ];
      }

      const errors = [
        this.offset.center.x - this.source.center.x,
        this.offset.center.y - this.source.center.y,
        (radiusOf(this.offset) - radiusOf(this.source)) * this.sign - this.target,
      ];
      if (this.source instanceof Arc && this.offset instanceof Arc) {
        errors.push(normalizeAngle(this.offset.startAngle - this.source.startAngle));
        errors.push(normalizeAngle(this.offset.endAngle - this.source.endAngle));
      }
      return errors;
    }
  }

  class LineAngleConstraint extends Constraint {
    constructor(line1, line2, target, startFlip = 0, endFlip = 0) {
      super(`角度 ${line1.id}-${line2.id} = ${target}`, 1);
      this.line1 = line1;
      this.line2 = line2;
      this.target = normalizeAxisAngle(target);
      this.startFlip = startFlip ? 1 : 0;
      this.endFlip = endFlip ? 1 : 0;
    }

    rawError() {
      return lineAxisAngle(this.line1, this.line2, this.startFlip, this.endFlip) - this.target;
    }
  }

  class CoincidentConstraint extends Constraint {
    constructor(p1, p2) {
      super(`一致 ${p1.id}-${p2.id}`, 1);
      this.p1 = p1;
      this.p2 = p2;
    }

    rawError() {
      return [this.p1.x - this.p2.x, this.p1.y - this.p2.y];
    }
  }

  class ArcEndpointCoincidentConstraint extends Constraint {
    constructor(arc, endpoint, point) {
      super(`円弧端点一致 ${arc.id}.${endpoint}-${point.id}`, 1);
      this.arc = arc;
      this.endpoint = endpoint;
      this.point = point;
    }

    rawError() {
      const p = arcEndpointPoint(this.arc, this.endpoint);
      return [p.x - this.point.x, p.y - this.point.y];
    }
  }

  class ArcEndpointArcEndpointCoincidentConstraint extends Constraint {
    constructor(a, endpointA, b, endpointB) {
      super(`円弧端点一致 ${a.id}.${endpointA}-${b.id}.${endpointB}`, 1);
      this.a = a;
      this.endpointA = endpointA;
      this.b = b;
      this.endpointB = endpointB;
    }

    rawError() {
      const a = arcEndpointPoint(this.a, this.endpointA);
      const b = arcEndpointPoint(this.b, this.endpointB);
      return [a.x - b.x, a.y - b.y];
    }
  }

  class PointOnLineConstraint extends Constraint {
    constructor(point, line) {
      super(`点-線一致 ${point.id}-${line.id}`, 1);
      this.point = point;
      this.line = line;
    }

    rawError() {
      return signedPointLineDistance(this.point, this.line);
    }
  }

  class PointOnLineMidpointConstraint extends Constraint {
    constructor(point, line) {
      super(`中点一致 ${point.id}-${line.id}`, 1);
      this.point = point;
      this.line = line;
    }

    rawError() {
      return [
        this.point.x - (this.line.p1.x + this.line.p2.x) / 2,
        this.point.y - (this.line.p1.y + this.line.p2.y) / 2,
      ];
    }
  }

  class ArcEndpointOnLineConstraint extends Constraint {
    constructor(arc, endpoint, line) {
      super(`円弧端点-線一致 ${arc.id}.${endpoint}-${line.id}`, 1);
      this.arc = arc;
      this.endpoint = endpoint;
      this.line = line;
    }

    rawError() {
      return signedPointLineDistance(arcEndpointPoint(this.arc, this.endpoint), this.line);
    }
  }

  class ArcEndpointFixedConstraint extends Constraint {
    constructor(arc, endpoint, x, y) {
      super(`Arc endpoint fixed ${arc.id}.${endpoint}`, 1);
      this.arc = arc;
      this.endpoint = endpoint;
      this.x = x;
      this.y = y;
    }

    rawError() {
      const p = arcEndpointPoint(this.arc, this.endpoint);
      return [p.x - this.x, p.y - this.y];
    }
  }

  class LineFixedConstraint extends Constraint {
    constructor(line, p1x = line.p1.x, p1y = line.p1.y, p2x = line.p2.x, p2y = line.p2.y) {
      super(`線固定 ${line.id}`, 1);
      this.line = line;
      this.p1x = p1x;
      this.p1y = p1y;
      this.p2x = p2x;
      this.p2y = p2y;
    }

    rawError() {
      return [this.line.p1.x - this.p1x, this.line.p1.y - this.p1y, this.line.p2.x - this.p2x, this.line.p2.y - this.p2y];
    }
  }

  class HorizontalConstraint extends Constraint {
    constructor(line) {
      super(`水平 ${line.id}`, 1);
      this.line = line;
      this.degenerateAtCreation = line.length() < MIN_ORIENTATION_LENGTH;
    }

    rawError() {
      if (this.degenerateAtCreation || this.line.length() < MIN_ORIENTATION_LENGTH) return 0;
      return this.line.p2.y - this.line.p1.y;
    }
  }

  class VerticalConstraint extends Constraint {
    constructor(line) {
      super(`垂直 ${line.id}`, 1);
      this.line = line;
      this.degenerateAtCreation = line.length() < MIN_ORIENTATION_LENGTH;
    }

    rawError() {
      if (this.degenerateAtCreation || this.line.length() < MIN_ORIENTATION_LENGTH) return 0;
      return this.line.p2.x - this.line.p1.x;
    }
  }

  class ParallelConstraint extends Constraint {
    constructor(l1, l2) {
      super(`平行 ${l1.id}-${l2.id}`, 10);
      this.line1 = l1;
      this.line2 = l2;
      this.degenerateAtCreation = l1.length() < MIN_ORIENTATION_LENGTH || l2.length() < MIN_ORIENTATION_LENGTH;
    }

    rawError() {
      const ax = this.line1.dx();
      const ay = this.line1.dy();
      const bx = this.line2.dx();
      const by = this.line2.dy();
      const la = hypot2(ax, ay);
      const lb = hypot2(bx, by);
      if (this.degenerateAtCreation || la < MIN_ORIENTATION_LENGTH || lb < MIN_ORIENTATION_LENGTH) return 0;
      return (ax * by - ay * bx) / (la * lb);
    }
  }

  class PerpendicularConstraint extends Constraint {
    constructor(l1, l2) {
      super(`垂直 ${l1.id}-${l2.id}`, 10);
      this.line1 = l1;
      this.line2 = l2;
      this.degenerateAtCreation = l1.length() < MIN_ORIENTATION_LENGTH || l2.length() < MIN_ORIENTATION_LENGTH;
    }

    rawError() {
      const ax = this.line1.dx();
      const ay = this.line1.dy();
      const bx = this.line2.dx();
      const by = this.line2.dy();
      const la = hypot2(ax, ay);
      const lb = hypot2(bx, by);
      if (this.degenerateAtCreation || la < MIN_ORIENTATION_LENGTH || lb < MIN_ORIENTATION_LENGTH) return 0;
      return (ax * bx + ay * by) / (la * lb);
    }
  }

  class CollinearConstraint extends Constraint {
    constructor(l1, l2) {
      super(`同一直線 ${l1.id}-${l2.id}`, 10);
      this.line1 = l1;
      this.line2 = l2;
      this.degenerateAtCreation = l1.length() < MIN_ORIENTATION_LENGTH || l2.length() < MIN_ORIENTATION_LENGTH;
    }

    rawError() {
      const ax = this.line1.dx();
      const ay = this.line1.dy();
      const bx = this.line2.dx();
      const by = this.line2.dy();
      const la = hypot2(ax, ay);
      const lb = hypot2(bx, by);
      if (this.degenerateAtCreation || la < MIN_ORIENTATION_LENGTH || lb < MIN_ORIENTATION_LENGTH) return [0, 0];
      return [(ax * by - ay * bx) / (la * lb), signedPointLineDistance(this.line2.p1, this.line1) / Math.max(la, 1)];
    }
  }

  class EqualLengthConstraint extends Constraint {
    constructor(line1, line2) {
      super(`等寸 ${line1.id}-${line2.id}`, 1);
      this.line1 = line1;
      this.line2 = line2;
    }

    rawError() {
      return this.line1.length() - this.line2.length();
    }
  }

  class RadiusConstraint extends Constraint {
    constructor(primitive, target) {
      super(`半径 ${primitive.id} = ${target}`, 1);
      this.primitive = primitive;
      this.target = target;
    }

    rawError() {
      return this.primitive.radius() - this.target;
    }
  }

  class DiameterConstraint extends Constraint {
    constructor(primitive, target) {
      super(`直径 ${primitive.id} = ${target}`, 1);
      this.primitive = primitive;
      this.target = target;
    }

    rawError() {
      return this.primitive.radius() * 2 - this.target;
    }
  }

  class ConcentricConstraint extends Constraint {
    constructor(a, b) {
      super(`同心 ${a.id}-${b.id}`, 1);
      this.a = a;
      this.b = b;
    }

    rawError() {
      const a = centerOf(this.a);
      const b = centerOf(this.b);
      return [a.x - b.x, a.y - b.y];
    }
  }

  class EqualRadiusConstraint extends Constraint {
    constructor(a, b) {
      super(`等寸 ${a.id}-${b.id}`, 1);
      this.a = a;
      this.b = b;
    }

    rawError() {
      return radiusOf(this.a) - radiusOf(this.b);
    }
  }

  class PointOnCircleConstraint extends Constraint {
    constructor(point, primitive) {
      super(`点-円周一致 ${point.id}-${primitive.id}`, 1);
      this.point = point;
      this.primitive = primitive;
    }

    rawError() {
      const c = this.primitive.center;
      return hypot2(this.point.x - c.x, this.point.y - c.y) - this.primitive.radius();
    }
  }

  class ArcEndpointOnCircleConstraint extends Constraint {
    constructor(arc, endpoint, primitive) {
      super(`円弧端点-円周一致 ${arc.id}.${endpoint}-${primitive.id}`, 1);
      this.arc = arc;
      this.endpoint = endpoint;
      this.primitive = primitive;
    }

    rawError() {
      const p = arcEndpointPoint(this.arc, this.endpoint);
      const c = this.primitive.center;
      return hypot2(p.x - c.x, p.y - c.y) - this.primitive.radius();
    }
  }

  class LineCircleTangentConstraint extends Constraint {
    constructor(line, primitive, sign = null) {
      super(`接線 ${line.id}-${primitive.id}`, 1);
      this.line = line;
      this.primitive = primitive;
      const current = signedPointLineDistance(primitive.center, line);
      this.sign = sign || (current < 0 ? -1 : 1);
    }

    rawError() {
      return signedPointLineDistance(this.primitive.center, this.line) * this.sign - this.primitive.radius();
    }
  }

  class CircleCircleTangentConstraint extends Constraint {
    constructor(a, b, mode = null) {
      const currentDistance = hypot2(b.center.x - a.center.x, b.center.y - a.center.y);
      const externalError = Math.abs(currentDistance - (a.radius() + b.radius()));
      const internalError = Math.abs(currentDistance - Math.abs(a.radius() - b.radius()));
      const selectedMode = mode || (internalError < externalError ? "internal" : "external");
      super(`接線 ${a.id}-${b.id}`, 1);
      this.a = a;
      this.b = b;
      this.mode = selectedMode;
    }

    rawError() {
      const distance = hypot2(this.b.center.x - this.a.center.x, this.b.center.y - this.a.center.y);
      const target = this.mode === "internal" ? Math.abs(this.a.radius() - this.b.radius()) : this.a.radius() + this.b.radius();
      return distance - target;
    }
  }

  class DragConstraint extends Constraint {
    constructor(point, x, y) {
      super(`ドラッグ ${point.id}`, 0.005);
      this.point = point;
      this.targetX = x;
      this.targetY = y;
    }

    rawError() {
      return [this.point.x - this.targetX, this.point.y - this.targetY];
    }
  }

  class ParameterDragConstraint extends Constraint {
    constructor(object, prop, target, min = null) {
      super(`ドラッグ ${prop}`, 0.005);
      this.object = object;
      this.prop = prop;
      this.target = target;
      this.min = min;
    }

    rawError() {
      const target = Number.isFinite(this.min) ? Math.max(this.min, this.target) : this.target;
      return this.object[this.prop] - target;
    }
  }

  class PointHorizontalConstraint extends Constraint {
    constructor(p1, p2) {
      super(`点水平 ${p1.id}-${p2.id}`, 1);
      this.p1 = p1;
      this.p2 = p2;
    }

    rawError() {
      return this.p2.y - this.p1.y;
    }
  }

  class PointVerticalConstraint extends Constraint {
    constructor(p1, p2) {
      super(`点垂直 ${p1.id}-${p2.id}`, 1);
      this.p1 = p1;
      this.p2 = p2;
    }

    rawError() {
      return this.p2.x - this.p1.x;
    }
  }

  class ArcEndpointDragConstraint extends Constraint {
    constructor(arc, endpoint, x, y) {
      super(`ドラッグ ${arc.id}.${endpoint}`, 0.005);
      this.arc = arc;
      this.endpoint = endpoint;
      this.targetX = x;
      this.targetY = y;
    }

    rawError() {
      const p = arcEndpointPoint(this.arc, this.endpoint);
      return [p.x - this.targetX, p.y - this.targetY];
    }
  }

  class LinearAlgebra {
    static getColumn(A, c) {
      return A.map((r) => r[c]);
    }

    static modifiedGramSchmidtQR(A) {
      const m = A.length;
      const n = A[0].length;
      const Q = Array.from({ length: m }, () => Array(n).fill(0));
      const R = Array.from({ length: n }, () => Array(n).fill(0));
      const V = Array.from({ length: n }, (_, j) => LinearAlgebra.getColumn(A, j));

      for (let i = 0; i < n; i++) {
        R[i][i] = vectorNorm(V[i]);
        if (R[i][i] > 1e-14) {
          for (let r = 0; r < m; r++) Q[r][i] = V[i][r] / R[i][i];
        }
        for (let j = i + 1; j < n; j++) {
          const qi = LinearAlgebra.getColumn(Q, i);
          R[i][j] = dot(qi, V[j]);
          for (let r = 0; r < m; r++) V[j][r] -= R[i][j] * qi[r];
        }
      }

      return { Q, R };
    }

    static multiplyTransposeVector(Q, b) {
      const m = Q.length;
      const n = Q[0].length;
      const y = Array(n).fill(0);
      for (let c = 0; c < n; c++) {
        for (let r = 0; r < m; r++) y[c] += Q[r][c] * b[r];
      }
      return y;
    }

    static backSubstitution(R, y) {
      const n = R.length;
      const x = Array(n).fill(0);
      for (let i = n - 1; i >= 0; i--) {
        let s = y[i];
        for (let j = i + 1; j < n; j++) s -= R[i][j] * x[j];
        x[i] = Math.abs(R[i][i]) < 1e-14 ? 0 : s / R[i][i];
      }
      return x;
    }

    static solveLeastSquaresQR(A, b) {
      const { Q, R } = LinearAlgebra.modifiedGramSchmidtQR(A);
      const y = LinearAlgebra.multiplyTransposeVector(Q, b);
      return LinearAlgebra.backSubstitution(R, y);
    }

    static reducedRowEchelon(A, tolerance = 1e-9) {
      const rows = A.map((row) => [...row]);
      const m = rows.length;
      const n = rows[0]?.length || 0;
      const maxAbs = rows.reduce((best, row) => Math.max(best, ...row.map((v) => Math.abs(v))), 0);
      const eps = tolerance * Math.max(1, maxAbs);
      const pivotCols = [];
      let r = 0;

      for (let c = 0; c < n && r < m; c++) {
        let pivot = r;
        for (let i = r + 1; i < m; i++) {
          if (Math.abs(rows[i][c]) > Math.abs(rows[pivot][c])) pivot = i;
        }
        if (Math.abs(rows[pivot][c]) <= eps) continue;
        [rows[r], rows[pivot]] = [rows[pivot], rows[r]];
        const v = rows[r][c];
        for (let j = c; j < n; j++) rows[r][j] /= v;
        for (let i = 0; i < m; i++) {
          if (i === r) continue;
          const f = rows[i][c];
          if (Math.abs(f) <= eps) continue;
          for (let j = c; j < n; j++) rows[i][j] -= f * rows[r][j];
        }
        pivotCols.push(c);
        r++;
      }

      return { rows, pivotCols, rank: pivotCols.length };
    }

    static nullspaceActivity(A, tolerance = 1e-9, activityTolerance = 1e-7) {
      const n = A[0]?.length || 0;
      if (n === 0) return { active: [], rank: 0, freeColumns: [], basis: [] };
      if (A.length === 0) {
        const basis = Array.from({ length: n }, (_, i) => {
          const vector = Array(n).fill(0);
          vector[i] = 1;
          return vector;
        });
        return { active: Array(n).fill(true), rank: 0, freeColumns: Array.from({ length: n }, (_, i) => i), basis };
      }
      const { rows, pivotCols, rank } = LinearAlgebra.reducedRowEchelon(A, tolerance);
      const pivotSet = new Set(pivotCols);
      const freeColumns = [];
      const active = Array(n).fill(false);
      const basis = [];
      for (let c = 0; c < n; c++) {
        if (!pivotSet.has(c)) {
          freeColumns.push(c);
          active[c] = true;
        }
      }
      for (const freeCol of freeColumns) {
        const vector = Array(n).fill(0);
        vector[freeCol] = 1;
        for (let r = 0; r < pivotCols.length; r++) {
          vector[pivotCols[r]] = -rows[r][freeCol];
          if (Math.abs(rows[r][freeCol]) > activityTolerance) active[pivotCols[r]] = true;
        }
        basis.push(vector);
      }
      const stableBasis = LinearAlgebra.orthonormalizeVectors(basis);
      const stableActive = Array.from({ length: n }, (_, index) =>
        vectorNorm(stableBasis.map((basisVector) => basisVector[index])) > activityTolerance,
      );
      return { active: stableActive, rank, freeColumns, basis: stableBasis };
    }

    static nullspaceBasis(A, tolerance = 1e-9) {
      const n = A[0]?.length || 0;
      if (n === 0) return [];
      if (A.length === 0) {
        return Array.from({ length: n }, (_, i) => {
          const v = Array(n).fill(0);
          v[i] = 1;
          return v;
        });
      }
      const { rows, pivotCols } = LinearAlgebra.reducedRowEchelon(A, tolerance);
      const pivotSet = new Set(pivotCols);
      const basis = [];
      for (let c = 0; c < n; c++) {
        if (pivotSet.has(c)) continue;
        const v = Array(n).fill(0);
        v[c] = 1;
        for (let r = 0; r < pivotCols.length; r++) v[pivotCols[r]] = -rows[r][c];
        basis.push(v);
      }
      return basis;
    }

    static orthonormalizeVectors(vectors, tolerance = 1e-10) {
      const result = [];
      for (const vector of vectors) {
        const candidate = [...vector];
        const originalNorm = vectorNorm(candidate);
        // Re-orthogonalize once; RREF-derived null-space vectors can have very
        // different scales and a single Gram-Schmidt pass loses accuracy.
        for (let pass = 0; pass < 2; pass++) {
          for (const basisVector of result) {
            const coefficient = dot(candidate, basisVector);
            for (let index = 0; index < candidate.length; index++) candidate[index] -= coefficient * basisVector[index];
          }
        }
        const norm = vectorNorm(candidate);
        if (norm <= tolerance * Math.max(1, originalNorm)) continue;
        result.push(candidate.map((value) => value / norm));
      }
      return result;
    }

    static projectOntoBasis(vector, basis, weights = null) {
      const projected = Array(vector.length).fill(0);
      if (basis.length === 0) return projected;
      const stableBasis = LinearAlgebra.orthonormalizeVectors(basis);
      if (stableBasis.length === 0) return projected;
      const weightAt = (index) => weights?.[index] ?? 1;
      const A = Array.from({ length: vector.length }, (_, r) => stableBasis.map((b) => b[r] * weightAt(r)));
      const weightedVector = vector.map((value, index) => value * weightAt(index));
      const coeffs = LinearAlgebra.solveLeastSquaresQR(A, weightedVector);
      for (let j = 0; j < stableBasis.length; j++) {
        for (let i = 0; i < projected.length; i++) projected[i] += stableBasis[j][i] * coeffs[j];
      }
      return projected;
    }
  }

  class ConstraintSolver {
    constructor(model) {
      this.model = model;
      this.diffStep = 1e-6;
      this.tolerance = 1e-7;
      this.maxIterations = 50;
      this.initialLambda = 1e-3;
      this.maxLambda = 1e10;
      this.maxStepNorm = 50;
      this.minLineLength = MIN_MODEL_LENGTH;
    }

    getVariables() {
      this.syncLineOrientationHints();
      const vs = [];
      for (const p of this.model.points) {
        if (!p.fixed) {
          vs.push({ object: p, prop: "x", label: `${p.id}.x` });
          vs.push({ object: p, prop: "y", label: `${p.id}.y` });
        }
      }
      for (const c of this.model.circles || []) {
        vs.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: MIN_MODEL_LENGTH });
      }
      for (const a of this.model.arcs || []) {
        vs.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: MIN_MODEL_LENGTH });
        vs.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
        vs.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
      }
      for (const instance of this.model.blockInstances || []) {
        if (instance.fixed) continue;
        vs.push({ object: instance, prop: "x", label: `${instance.id}.x` });
        vs.push({ object: instance, prop: "y", label: `${instance.id}.y` });
        vs.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
      }
      return vs;
    }

    syncLineOrientationHints(extra = [], baseConstraints = this.model.constraints) {
      for (const line of this.model.lines || []) line.orientationHint = null;
      const hints = new Map();
      for (const c of [...baseConstraints, ...extra]) {
        if (!c.enabled) continue;
        if (c instanceof HorizontalConstraint) {
          const hint = hints.get(c.line);
          hints.set(c.line, hint && hint !== "horizontal" ? "conflict" : "horizontal");
        } else if (c instanceof VerticalConstraint) {
          const hint = hints.get(c.line);
          hints.set(c.line, hint && hint !== "vertical" ? "conflict" : "vertical");
        }
      }
      for (const [line, hint] of hints) line.orientationHint = hint === "conflict" ? null : hint;
    }

    getConstraints(extra = []) {
      this.syncLineOrientationHints(extra);
      return this.constraintsWithLineMinimums(this.model.constraints, extra, this.model.lines || []);
    }

    constraintsWithLineMinimums(constraints = [], extra = [], lines = []) {
      const lineMinimums = (lines || []).map((line) => new LineMinimumLengthConstraint(line, this.minLineLength));
      return [...constraints, ...lineMinimums, ...extra].filter((c) => c.enabled);
    }

    computeErrorVector(extra = []) {
      return this.computeErrorVectorForConstraints(this.getConstraints(extra));
    }

    computeErrorVectorForConstraints(constraints) {
      const errors = [];
      for (const c of constraints) {
        const e = c.error();
        const vals = Array.isArray(e) ? e : [e];
        for (const v of vals) errors.push(v);
      }
      return errors;
    }

    computeJacobian(vars, baseErrors, extra = []) {
      return this.computeJacobianForConstraints(vars, baseErrors, this.getConstraints(extra));
    }

    computeJacobianForConstraints(vars, baseErrors, constraints) {
      const m = baseErrors.length;
      const n = vars.length;
      const J = Array.from({ length: m }, () => Array(n).fill(0));
      for (let j = 0; j < n; j++) {
        const v = vars[j];
        const orig = v.object[v.prop];
        const h = this.diffStep * Math.max(1, Math.abs(orig));
        v.object[v.prop] = Number.isFinite(v.min) ? Math.max(v.min, orig + h) : orig + h;
        const plus = this.computeErrorVectorForConstraints(constraints);
        v.object[v.prop] = Number.isFinite(v.min) ? Math.max(v.min, orig - h) : orig - h;
        const minus = this.computeErrorVectorForConstraints(constraints);
        v.object[v.prop] = orig;
        for (let i = 0; i < m; i++) J[i][j] = (plus[i] - minus[i]) / (2 * h);
      }
      return J;
    }

    buildAugmentedSystem(J, F, lambda) {
      const n = J[0].length;
      const A = [];
      const b = [];
      const s = Math.sqrt(lambda);

      for (let i = 0; i < J.length; i++) {
        A.push([...J[i]]);
        b.push(-F[i]);
      }
      for (let j = 0; j < n; j++) {
        const row = Array(n).fill(0);
        row[j] = s;
        A.push(row);
        b.push(0);
      }

      return { A, b };
    }

    clone(vars) {
      return vars.map((v) => ({ object: v.object, prop: v.prop, value: v.object[v.prop] }));
    }

    restore(states) {
      for (const s of states) s.object[s.prop] = s.value;
    }

    applyDelta(vars, dx) {
      for (let i = 0; i < vars.length; i++) {
        vars[i].object[vars[i].prop] += dx[i];
        if (Number.isFinite(vars[i].min)) vars[i].object[vars[i].prop] = Math.max(vars[i].min, vars[i].object[vars[i].prop]);
      }
    }

    limitStep(dx, maxNorm = this.maxStepNorm) {
      const n = vectorNorm(dx);
      if (n <= maxNorm) return dx;
      const scale = maxNorm / n;
      return dx.map((v) => v * scale);
    }

    variableMotionScale(variable) {
      if (
        (variable?.prop === "startAngle" || variable?.prop === "endAngle")
        && Number.isFinite(variable?.object?.radiusValue)
      ) {
        return Math.max(MIN_MODEL_LENGTH, Math.abs(variable.object.radiusValue));
      }
      return 1;
    }

    solveCore(vars, constraints, tolerance = this.tolerance) {
      let lambda = this.initialLambda;
      let F = this.computeErrorVectorForConstraints(constraints);
      let errorNorm = vectorNorm(F);
      if (F.length === 0) {
        return { success: true, errorNorm: 0, iterations: 0, reason: "拘束がありません" };
      }
      if (vars.length === 0) {
        return {
          success: errorNorm < tolerance,
          errorNorm,
          iterations: 0,
          reason: errorNorm < tolerance ? "可動変数がありません" : "可動変数がなく拘束を満たせません",
        };
      }

      for (let iter = 0; iter < this.maxIterations; iter++) {
        if (errorNorm < tolerance) return { success: true, errorNorm, iterations: iter, reason: "収束しました" };

        const state = this.clone(vars);
        const J = this.computeJacobianForConstraints(vars, F, constraints);
        const { A, b } = this.buildAugmentedSystem(J, F, lambda);
        let dx = LinearAlgebra.solveLeastSquaresQR(A, b);
        dx = this.limitStep(dx);
        this.applyDelta(vars, dx);

        const trialF = this.computeErrorVectorForConstraints(constraints);
        const trialNorm = vectorNorm(trialF);
        if (trialNorm < errorNorm) {
          F = trialF;
          errorNorm = trialNorm;
          lambda = clamp(lambda * 0.3, 1e-12, this.maxLambda);
        } else {
          this.restore(state);
          lambda = clamp(lambda * 10, 1e-12, this.maxLambda);
        }

        if (lambda >= this.maxLambda) return { success: false, errorNorm, iterations: iter + 1, reason: "lambda上限" };
      }

      return { success: false, errorNorm, iterations: this.maxIterations, reason: "最大反復" };
    }

    solve(extra = []) {
      const vars = this.getVariables();
      return this.solveCore(vars, this.getConstraints(extra));
    }

    solveSubset({ variables = [], constraints = [], extra = [], lines = [] } = {}) {
      this.syncLineOrientationHints(extra, constraints);
      const activeConstraints = this.constraintsWithLineMinimums(constraints, extra, lines);
      const result = this.solveCore(variables, activeConstraints);
      result.local = true;
      result.variableCount = variables.length;
      result.constraintCount = activeConstraints.length;
      return result;
    }

    constraintRankState({ variables = [], constraints = [], errorTolerance = 1e-4, rankTolerance = 1e-8 } = {}) {
      this.syncLineOrientationHints([], constraints);
      const activeConstraints = (constraints || []).filter((c) => c.enabled !== false);
      const F = this.computeErrorVectorForConstraints(activeConstraints);
      const errorNorm = vectorNorm(F);
      if (errorNorm > errorTolerance) {
        return { stable: false, errorNorm, rank: 0, rowCount: F.length, variableCount: variables.length };
      }
      if (F.length === 0 || variables.length === 0) {
        return { stable: true, errorNorm, rank: 0, rowCount: F.length, variableCount: variables.length };
      }
      const J = this.computeJacobianForConstraints(variables, F, activeConstraints);
      const { rank } = LinearAlgebra.reducedRowEchelon(J, rankTolerance);
      return { stable: true, errorNorm, rank, rowCount: F.length, variableCount: variables.length };
    }

    constraintRedundancyState({ variables = [], constraints = [], errorTolerance = 1e-4, rankTolerance = 1e-8 } = {}) {
      this.syncLineOrientationHints([], constraints);
      const activeConstraints = (constraints || []).filter((constraint) => constraint.enabled !== false);
      const errors = [];
      const rowRanges = [];
      for (const constraint of activeConstraints) {
        const value = constraint.error();
        const values = Array.isArray(value) ? value : [value];
        const start = errors.length;
        errors.push(...values);
        rowRanges.push({ constraint, start, end: errors.length });
      }
      const errorNorm = vectorNorm(errors);
      if (errorNorm > errorTolerance) {
        return { stable: false, errorNorm, rank: 0, byConstraint: new Map() };
      }
      if (errors.length === 0) {
        return { stable: true, errorNorm, rank: 0, byConstraint: new Map() };
      }
      if (variables.length === 0) {
        const byConstraint = new Map(activeConstraints.map((constraint) => [constraint, {
          redundant: true,
          rankBefore: 0,
          rankAfter: 0,
        }]));
        return { stable: true, errorNorm, rank: 0, byConstraint };
      }

      // Compute the finite-difference Jacobian once, then incrementally extend
      // a row-echelon basis in constraint order. The previous implementation
      // rebuilt the entire Jacobian for every prefix of the constraint list.
      const jacobian = this.computeJacobianForConstraints(variables, errors, activeConstraints);
      const basis = [];
      const pivots = [];
      const addIndependentRow = (source) => {
        const row = [...source];
        for (let index = 0; index < basis.length; index += 1) {
          const pivot = pivots[index];
          const factor = row[pivot];
          if (Math.abs(factor) <= rankTolerance) continue;
          for (let column = pivot; column < row.length; column += 1) row[column] -= factor * basis[index][column];
        }
        const pivot = row.findIndex((value) => Math.abs(value) > rankTolerance);
        if (pivot < 0) return false;
        const scale = row[pivot];
        for (let column = pivot; column < row.length; column += 1) row[column] /= scale;
        let insertAt = pivots.findIndex((value) => value > pivot);
        if (insertAt < 0) insertAt = pivots.length;
        pivots.splice(insertAt, 0, pivot);
        basis.splice(insertAt, 0, row);
        return true;
      };

      const byConstraint = new Map();
      for (const range of rowRanges) {
        const rankBefore = basis.length;
        for (let row = range.start; row < range.end; row += 1) addIndependentRow(jacobian[row]);
        const rankAfter = basis.length;
        byConstraint.set(range.constraint, {
          redundant: rankAfter <= rankBefore,
          rankBefore,
          rankAfter,
        });
      }
      return { stable: true, errorNorm, rank: basis.length, byConstraint };
    }

    variableTargetDelta(variables, targets = []) {
      const delta = Array(variables.length).fill(0);
      for (let i = 0; i < variables.length; i++) {
        const v = variables[i];
        for (const target of targets) {
          if (target.point && target.point === v.object) {
            if (v.prop === "x") delta[i] = target.x - v.object.x;
            if (v.prop === "y") delta[i] = target.y - v.object.y;
          } else if (target.object && target.object === v.object && target.prop === v.prop) {
            const value = Number.isFinite(target.min) ? Math.max(target.min, target.value) : target.value;
            delta[i] = value - v.object[v.prop];
          }
        }
      }
      return delta;
    }

    variableTargetMask(variables, targets = []) {
      return variables.map((variable) => targets.some((target) =>
        (target.point && target.point === variable.object && (variable.prop === "x" || variable.prop === "y")) ||
        (target.object && target.object === variable.object && target.prop === variable.prop),
      ));
    }

    independentTargetMask(variables, targetMask, desired, activity, retainedTargets = []) {
      // Target coordinates form a local chart for the reachable drag motion. Keep
      // only independent, well-conditioned rows so one DOF is not pinned by both x and y.
      const selected = [];
      let selectedRank = 0;
      const retained = new Set(variables
        .map((variable, index) => retainedTargets.some((target) => target.object === variable.object && target.prop === variable.prop) ? index : -1)
        .filter((index) => index >= 0));
      const candidates = targetMask
        .map((targeted, index) => targeted && activity.active[index] ? index : -1)
        .filter((index) => index >= 0)
        .sort((a, b) => {
          const retainedDifference = Number(retained.has(b)) - Number(retained.has(a));
          if (retainedDifference !== 0) return retainedDifference;
          const normAt = (index) => vectorNorm(activity.basis.map((basis) => basis[index]));
          const normDifference = normAt(b) - normAt(a);
          if (normDifference !== 0) return normDifference;
          return Math.abs(desired[b]) - Math.abs(desired[a]);
        });

      for (const index of candidates) {
        const rows = [...selected, index].map((variableIndex) => activity.basis.map((basis) => basis[variableIndex]));
        const rank = LinearAlgebra.reducedRowEchelon(rows, 1e-8).rank;
        if (rank <= selectedRank) continue;
        selected.push(index);
        selectedRank = rank;
      }

      const selectedSet = new Set(selected);
      return targetMask.map((_, index) => selectedSet.has(index));
    }

    solveSubsetGuided({ variables = [], constraints = [], targets = [], lines = [], errorTolerance = 1e-4, activeTargetVariables = [], targetStepNorm = null } = {}) {
      this.syncLineOrientationHints([], constraints);
      const activeConstraints = this.constraintsWithLineMinimums(constraints, [], lines);
      const baseErrors = this.computeErrorVectorForConstraints(activeConstraints);
      const startingErrorNorm = vectorNorm(baseErrors);
      const J = this.computeJacobianForConstraints(variables, baseErrors, activeConstraints);
      const desired = this.variableTargetDelta(variables, targets);
      const targetMask = this.variableTargetMask(variables, targets);
      const activity = LinearAlgebra.nullspaceActivity(J, 1e-8, GUIDED_DRAG_ACTIVITY_TOLERANCE);
      const basis = activity.basis;
      const activeTargetMask = this.independentTargetMask(variables, targetMask, desired, activity, activeTargetVariables);
      const projectionTargetMask = targetMask.map((targeted, index) => targeted && activity.active[index]);
      const targetActivity = targetMask.map((targeted, index) => targeted
        ? vectorNorm(basis.map((basisVector) => basisVector[index]))
        : 0);
      const targetVariableCount = activeTargetMask.filter(Boolean).length;
      if (targetVariableCount === 0) {
        return {
          success: true,
          errorNorm: startingErrorNorm,
          iterations: 0,
          reason: "可動方向なし",
          local: true,
          guided: true,
          variableCount: variables.length,
          constraintCount: activeConstraints.length,
          freeDof: basis.length,
          targetActivity: targetActivity.filter((_, index) => targetMask[index]),
          targetNorm: vectorNorm(desired),
          projectedNorm: 0,
          projectedErrorNorm: startingErrorNorm,
          targetErrorNorm: 0,
          acceptError: Math.max(this.tolerance, errorTolerance),
          targetConstraints: [],
          activeTargetVariables: [],
        };
      }
      const motionScales = variables.map((variable) => this.variableMotionScale(variable));
      const physicalDesired = desired.map((value, index) => value * motionScales[index]);
      const physicalBasis = basis.map((basisVector) =>
        basisVector.map((value, index) => value * motionScales[index]));
      const weights = projectionTargetMask.map((targeted) => targeted ? 1 : GUIDED_DRAG_BACKGROUND_WEIGHT);
      const physicalProjected = LinearAlgebra.projectOntoBasis(physicalDesired, physicalBasis, weights);
      const componentScale = Math.sqrt(Math.max(1, variables.length / Math.max(1, targetVariableCount)));
      // Near-singular null-space directions can turn a tiny pointer movement into
      // enormous changes in remote geometry. A rigid component legitimately moves
      // several variables, so scale with its size, but always keep that motion
      // proportional to the actual cursor request.
      const requestedTargetNorm = vectorNorm(physicalDesired);
      const boundedTargetNorm = Number.isFinite(targetStepNorm) && targetStepNorm > 0
        ? Math.min(requestedTargetNorm, targetStepNorm)
        : requestedTargetNorm;
      const motionFactor = targetVariableCount === 1
        ? GUIDED_DRAG_SINGLE_TARGET_MOTION_FACTOR
        : GUIDED_DRAG_MULTI_TARGET_MOTION_FACTOR;
      const cursorScaledMaxNorm = boundedTargetNorm * componentScale * motionFactor;
      const guidedMaxNorm = Math.min(this.maxStepNorm * componentScale, cursorScaledMaxNorm);
      let limitedPhysical = this.limitStep(physicalProjected, guidedMaxNorm);
      let limited = limitedPhysical.map((value, index) => value / motionScales[index]);
      const relativeErrorLimit = Math.min(startingErrorNorm * 1.1 + 1e-9, errorTolerance * 2);
      const acceptProjectedError = Math.max(this.tolerance, errorTolerance, relativeErrorLimit);
      const projectionState = this.clone(variables);
      const directPointTargetVariables = variables.filter((_, index) => activeTargetMask[index]);
      const requestedPointTargets = targets.filter((target) => target.point).map((target) => target.point);
      const preserveDirectPointTarget = directPointTargetVariables.length > 0
        && directPointTargetVariables.every((variable) => variable.prop === "x" || variable.prop === "y")
        && targets.length === requestedPointTargets.length
        && new Set(requestedPointTargets).size === 1;
      const requestedParameterTargets = targets.filter((target) => target.object).map((target) => target.object);
      const preserveDirectBlockTarget = Boolean(requestedParameterTargets.length === targets.length
        && new Set(requestedParameterTargets).size === 1
        && requestedParameterTargets[0]?.definitionId);
      const preserveDirectTarget = preserveDirectPointTarget || preserveDirectBlockTarget;
      let projectionScale = 1;
      let projectedErrors = [];
      let projectedErrorNorm = Infinity;
      // The null-space is a tangent approximation. On strongly curved
      // manifolds, backtrack before invoking the nonlinear solver so one large
      // pointer event cannot spend dozens of iterations returning to the
      // constraint surface.
      while (true) {
        this.restore(projectionState);
        this.applyDelta(variables, limited);
        projectedErrors = this.computeErrorVectorForConstraints(activeConstraints);
        projectedErrorNorm = vectorNorm(projectedErrors);
        if (preserveDirectTarget || projectedErrorNorm <= acceptProjectedError * 2 || projectionScale <= 1 / 32) break;
        projectionScale *= 0.5;
        limitedPhysical = limitedPhysical.map((value) => value * 0.5);
        limited = limited.map((value) => value * 0.5);
      }
      const projectedTargetValues = variables.map((variable) => variable.object[variable.prop]);
      const holdSingleTargetDuringPreview = targetVariableCount === 1 && (
        preserveDirectPointTarget
        || !Number.isFinite(targetStepNorm)
        || targetStepNorm < GUIDED_DRAG_FAST_TARGET_STEP
      );
      const previewTargetConstraints = holdSingleTargetDuringPreview
        ? variables
            .map((variable, index) => {
              if (!activeTargetMask[index]) return null;
              const constraint = new ParameterDragConstraint(variable.object, variable.prop, projectedTargetValues[index], variable.min);
              constraint.weight = GUIDED_DRAG_TARGET_CONSTRAINT_WEIGHT;
              return constraint;
            })
            .filter(Boolean)
        : [];
      const previewTargetErrors = this.computeErrorVectorForConstraints(previewTargetConstraints);
      const previewTargetErrorNorm = vectorNorm(previewTargetErrors);
      const previewErrorNorm = vectorNorm([...projectedErrors, ...previewTargetErrors]);
      const previewSolveTolerance = targetVariableCount === 1 && preserveDirectPointTarget
        ? GUIDED_DRAG_SMALL_ERROR_TOLERANCE
        : GUIDED_DRAG_FAST_MULTI_TARGET_TOLERANCE;
      const solveTolerance = Math.min(acceptProjectedError, previewSolveTolerance);
      const result =
        previewErrorNorm <= solveTolerance
          ? { success: true, errorNorm: previewErrorNorm, iterations: 0, reason: "投影移動" }
          : this.solveCore(variables, [...activeConstraints, ...previewTargetConstraints], solveTolerance);
      // The preview solve is deliberately free to make the smallest normal
      // correction back onto the constraint manifold. Pin the coordinates it
      // actually reached for mouse-up; pinning the pre-solve projection during
      // the preview can make otherwise valid underconstrained systems singular.
      const targetConstraints = variables
        .map((variable, index) => {
          if (!activeTargetMask[index]) return null;
          const constraint = new ParameterDragConstraint(variable.object, variable.prop, variable.object[variable.prop], variable.min);
          constraint.weight = GUIDED_DRAG_TARGET_CONSTRAINT_WEIGHT;
          return constraint;
        })
        .filter(Boolean);
      result.local = true;
      result.guided = true;
      result.variableCount = variables.length;
      result.constraintCount = activeConstraints.length;
      result.freeDof = basis.length;
      result.targetActivity = targetActivity.filter((_, index) => targetMask[index]);
      result.targetNorm = requestedTargetNorm;
      result.targetStepNorm = targetStepNorm;
      result.projectedNorm = vectorNorm(limitedPhysical);
      result.projectionScale = projectionScale;
      result.projectedErrorNorm = projectedErrorNorm;
      result.targetErrorNorm = previewTargetErrorNorm;
      result.acceptError = acceptProjectedError;
      result.targetConstraints = targetConstraints;
      result.activeTargetVariables = targetConstraints.map((constraint) => ({ object: constraint.object, prop: constraint.prop }));
      return result;
    }

    solveWithDrag(point, x, y) {
      return this.solve([new DragConstraint(point, x, y)]);
    }

    solveWithDragTargets(targets) {
      return this.solve(targets.map((target) => new DragConstraint(target.point, target.x, target.y)));
    }

    solveWithParameterDragTargets(targets) {
      return this.solve(targets.map((target) => new ParameterDragConstraint(target.object, target.prop, target.value, target.min)));
    }

    analyzeConstraintState(options = {}) {
      const errorTolerance = Number.isFinite(options.errorTolerance) ? options.errorTolerance : 1e-4;
      const rankTolerance = Number.isFinite(options.rankTolerance) ? options.rankTolerance : 1e-8;
      const activityTolerance = Number.isFinite(options.activityTolerance) ? options.activityTolerance : 1e-7;
      const hasSubset = Array.isArray(options.variables) || Array.isArray(options.constraints);
      const vars = Array.isArray(options.variables) ? options.variables : this.getVariables();
      if (hasSubset) this.syncLineOrientationHints(options.extra || [], options.constraints || []);
      const constraints = hasSubset
        ? this.constraintsWithLineMinimums(options.constraints || [], options.extra || [], options.lines || [])
        : this.getConstraints(options.extra || []);
      const F = this.computeErrorVectorForConstraints(constraints);
      const errorNorm = vectorNorm(F);
      const unstable = errorNorm > errorTolerance;
      const J = unstable || vars.length === 0 ? [] : this.computeJacobianForConstraints(vars, F, constraints);
      const activity = unstable
        ? { active: Array(vars.length).fill(false), rank: 0, freeColumns: [], basis: [] }
        : F.length === 0
          ? {
              active: Array(vars.length).fill(true),
              rank: 0,
              freeColumns: Array.from({ length: vars.length }, (_, i) => i),
              basis: Array.from({ length: vars.length }, (_, i) => {
                const vector = Array(vars.length).fill(0);
                vector[i] = 1;
                return vector;
              }),
            }
          : LinearAlgebra.nullspaceActivity(J, rankTolerance, activityTolerance);
      const variableFreedom = new Map();
      const variableIndex = new Map();
      for (let i = 0; i < vars.length; i++) {
        variableFreedom.set(vars[i].object, { ...(variableFreedom.get(vars[i].object) || {}), [vars[i].prop]: Boolean(activity.active[i]) });
        variableIndex.set(vars[i].object, { ...(variableIndex.get(vars[i].object) || {}), [vars[i].prop]: i });
      }
      return {
        stable: !unstable,
        errorNorm,
        rank: activity.rank,
        variableCount: vars.length,
        freeVariableCount: activity.freeColumns.length,
        variables: vars,
        variableFreedom,
        variableIndex,
        nullspaceBasis: activity.basis || [],
      };
    }
  }

  window.GeometrySolver = {
    hypot2,
    vectorNorm,
    MIN_ORIENTATION_LENGTH,
    Point,
    Line,
    Circle,
    Arc,
    Constraint,
    DistanceConstraint,
    PointAxisDistanceConstraint,
    PointLineDistanceConstraint,
    LineLineDistanceConstraint,
    OffsetConstraint,
    LineAngleConstraint,
    signedPointLineDistance,
    signedPointDirectedLineDistance,
    CoincidentConstraint,
    ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint,
    PointOnLineConstraint,
    PointOnLineMidpointConstraint,
    ArcEndpointOnLineConstraint,
    ArcEndpointFixedConstraint,
    LineFixedConstraint,
    HorizontalConstraint,
    VerticalConstraint,
    PointHorizontalConstraint,
    PointVerticalConstraint,
    ParallelConstraint,
    PerpendicularConstraint,
    CollinearConstraint,
    EqualLengthConstraint,
    RadiusConstraint,
    DiameterConstraint,
    ConcentricConstraint,
    EqualRadiusConstraint,
    PointOnCircleConstraint,
    ArcEndpointOnCircleConstraint,
    LineCircleTangentConstraint,
    CircleCircleTangentConstraint,
    DragConstraint,
    ParameterDragConstraint,
    ArcEndpointDragConstraint,
    ConstraintSolver,
  };
})();

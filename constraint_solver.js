/* constraint_solver.js: 2D geometry constraint solver core */
(function () {
  "use strict";

  const MIN_MODEL_LENGTH = 1e-6;
  const MIN_ORIENTATION_LENGTH = 1e-9;

  function hypot2(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function vectorNorm(v) {
    let s = 0;
    for (const x of v) s += x * x;
    return Math.sqrt(s);
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
    constructor(id, p1, p2) {
      this.id = id;
      this.p1 = p1;
      this.p2 = p2;
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
    constructor(id, center, radiusValue) {
      this.id = id;
      this.center = center;
      this.radiusValue = Math.max(Number(radiusValue) || 0, MIN_MODEL_LENGTH);
    }

    radius() {
      return this.radiusValue;
    }
  }

  class Arc {
    constructor(id, center, radiusValue, startAngle, endAngle) {
      this.id = id;
      this.center = center;
      this.radiusValue = Math.max(Number(radiusValue) || 0, MIN_MODEL_LENGTH);
      this.startAngle = Number(startAngle) || 0;
      this.endAngle = Number(endAngle) || 0;
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
      super(`寸法 ${point.id}-${line.id} = ${target}`, 1);
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
      super(`寸法 ${line1.id}-${line2.id} = ${target}`, 1);
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

  class CoincidentConstraint extends Constraint {
    constructor(p1, p2) {
      super(`点一致 ${p1.id}-${p2.id}`, 1);
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
      super(`轤ｹ-邱壹荳閾ｴ ${point.id}-${line.id}`, 1);
      this.point = point;
      this.line = line;
    }

    rawError() {
      return signedPointLineDistance(this.point, this.line);
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
      super(`直交 ${l1.id}-${l2.id}`, 10);
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
      super(`等長 ${line1.id}-${line2.id}`, 1);
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
      super(`同半径 ${a.id}-${b.id}`, 1);
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
      if (n === 0) return { active: [], rank: 0, freeColumns: [] };
      if (A.length === 0) return { active: Array(n).fill(true), rank: 0, freeColumns: Array.from({ length: n }, (_, i) => i) };
      const { rows, pivotCols, rank } = LinearAlgebra.reducedRowEchelon(A, tolerance);
      const pivotSet = new Set(pivotCols);
      const freeColumns = [];
      const active = Array(n).fill(false);
      for (let c = 0; c < n; c++) {
        if (!pivotSet.has(c)) {
          freeColumns.push(c);
          active[c] = true;
        }
      }
      for (const freeCol of freeColumns) {
        for (let r = 0; r < pivotCols.length; r++) {
          if (Math.abs(rows[r][freeCol]) > activityTolerance) active[pivotCols[r]] = true;
        }
      }
      return { active, rank, freeColumns };
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
      return vs;
    }

    syncLineOrientationHints(extra = []) {
      for (const line of this.model.lines || []) line.orientationHint = null;
      const hints = new Map();
      for (const c of [...this.model.constraints, ...extra]) {
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
      const lineMinimums = (this.model.lines || []).map((line) => new LineMinimumLengthConstraint(line, this.minLineLength));
      return [...this.model.constraints, ...lineMinimums, ...extra].filter((c) => c.enabled);
    }

    computeErrorVector(extra = []) {
      const errors = [];
      for (const c of this.getConstraints(extra)) {
        const e = c.error();
        const vals = Array.isArray(e) ? e : [e];
        for (const v of vals) errors.push(v);
      }
      return errors;
    }

    computeJacobian(vars, baseErrors, extra = []) {
      const m = baseErrors.length;
      const n = vars.length;
      const J = Array.from({ length: m }, () => Array(n).fill(0));
      for (let j = 0; j < n; j++) {
        const v = vars[j];
        const orig = v.object[v.prop];
        const h = this.diffStep * Math.max(1, Math.abs(orig));
        v.object[v.prop] = Number.isFinite(v.min) ? Math.max(v.min, orig + h) : orig + h;
        const plus = this.computeErrorVector(extra);
        v.object[v.prop] = Number.isFinite(v.min) ? Math.max(v.min, orig - h) : orig - h;
        const minus = this.computeErrorVector(extra);
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

    limitStep(dx) {
      const n = vectorNorm(dx);
      if (n <= this.maxStepNorm) return dx;
      const scale = this.maxStepNorm / n;
      return dx.map((v) => v * scale);
    }

    solve(extra = []) {
      const vars = this.getVariables();
      let lambda = this.initialLambda;
      let F = this.computeErrorVector(extra);
      let errorNorm = vectorNorm(F);
      if (F.length === 0) {
        return { success: true, errorNorm: 0, iterations: 0, reason: "拘束がありません" };
      }
      if (vars.length === 0) {
        return {
          success: errorNorm < this.tolerance,
          errorNorm,
          iterations: 0,
          reason: errorNorm < this.tolerance ? "可動変数がありません" : "可動変数がなく拘束を満たせません",
        };
      }

      for (let iter = 0; iter < this.maxIterations; iter++) {
        if (errorNorm < this.tolerance) return { success: true, errorNorm, iterations: iter, reason: "収束しました" };

        const state = this.clone(vars);
        const J = this.computeJacobian(vars, F, extra);
        const { A, b } = this.buildAugmentedSystem(J, F, lambda);
        let dx = LinearAlgebra.solveLeastSquaresQR(A, b);
        dx = this.limitStep(dx);
        this.applyDelta(vars, dx);

        const trialF = this.computeErrorVector(extra);
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
      const rankTolerance = Number.isFinite(options.rankTolerance) ? options.rankTolerance : 1e-9;
      const activityTolerance = Number.isFinite(options.activityTolerance) ? options.activityTolerance : 1e-7;
      const vars = this.getVariables();
      const F = this.computeErrorVector();
      const errorNorm = vectorNorm(F);
      const unstable = errorNorm > errorTolerance;
      const J = unstable || vars.length === 0 ? [] : this.computeJacobian(vars, F);
      const activity = unstable ? { active: Array(vars.length).fill(false), rank: 0, freeColumns: [] } : LinearAlgebra.nullspaceActivity(J, rankTolerance, activityTolerance);
      const variableFreedom = new Map();
      for (let i = 0; i < vars.length; i++) variableFreedom.set(vars[i].object, { ...(variableFreedom.get(vars[i].object) || {}), [vars[i].prop]: Boolean(activity.active[i]) });
      return {
        stable: !unstable,
        errorNorm,
        rank: activity.rank,
        variableCount: vars.length,
        freeVariableCount: activity.freeColumns.length,
        variables: vars,
        variableFreedom,
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
    PointLineDistanceConstraint,
    LineLineDistanceConstraint,
    signedPointLineDistance,
    CoincidentConstraint,
    ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint,
    PointOnLineConstraint,
    ArcEndpointOnLineConstraint,
    ArcEndpointFixedConstraint,
    HorizontalConstraint,
    VerticalConstraint,
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
    ConstraintSolver,
  };
})();

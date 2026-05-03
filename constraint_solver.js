/* constraint_solver.js: 2D geometry constraint solver core */
(function () {
  "use strict";

  const MIN_ORIENTATION_LENGTH = 1e-3;

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
    constructor(id, center, radiusPoint) {
      this.id = id;
      this.center = center;
      this.radiusPoint = radiusPoint;
    }

    radius() {
      return hypot2(this.radiusPoint.x - this.center.x, this.radiusPoint.y - this.center.y);
    }
  }

  class Arc {
    constructor(id, center, startPoint, endPoint) {
      this.id = id;
      this.center = center;
      this.startPoint = startPoint;
      this.endPoint = endPoint;
    }

    radius() {
      return hypot2(this.startPoint.x - this.center.x, this.startPoint.y - this.center.y);
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
    const dx = line.dx();
    const dy = line.dy();
    const len = hypot2(dx, dy);
    if (len < 1e-12) return 0;
    return ((point.x - line.p1.x) * -dy + (point.y - line.p1.y) * dx) / len;
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
    }

    getVariables() {
      const vs = [];
      for (const p of this.model.points) {
        if (!p.fixed) {
          vs.push({ object: p, prop: "x", label: `${p.id}.x` });
          vs.push({ object: p, prop: "y", label: `${p.id}.y` });
        }
      }
      return vs;
    }

    getConstraints(extra = []) {
      return [...this.model.constraints, ...extra].filter((c) => c.enabled);
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
        v.object[v.prop] = orig + h;
        const plus = this.computeErrorVector(extra);
        v.object[v.prop] = orig - h;
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
      for (let i = 0; i < vars.length; i++) vars[i].object[vars[i].prop] += dx[i];
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
    PointOnLineConstraint,
    HorizontalConstraint,
    VerticalConstraint,
    ParallelConstraint,
    PerpendicularConstraint,
    DragConstraint,
    ConstraintSolver,
  };
})();

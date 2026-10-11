/* Constraint operand values; geometry identity is retained and selection is caller-owned. */
(() => {
  "use strict";
  function create({ elementSketchId, operandRelationForSketch, sameArcEndpoint, Arc, lineHasDirection, closestSplinePoint }) {
    function fromSelection(selection, pointer) {
      const operands = [];
      for (const p of selection.points) operands.push(makeConstraintOperand("point", { point: p }));
      for (const l of selection.lines) operands.push(makeConstraintOperand("line", { line: l }));
      for (const c of selection.circles) operands.push(makeConstraintOperand("primitive", { primitive: c }));
      for (const a of selection.arcs) {
        if (selection.arcEndpoint?.arc === a) continue;
        operands.push(makeConstraintOperand("primitive", { primitive: a }));
      }
      if (selection.arcEndpoint) operands.push(makeConstraintOperand("arc-endpoint", { arc: selection.arcEndpoint.arc, endpoint: selection.arcEndpoint.endpoint }));
      for (const spline of selection.splines) {
        const closest = closestSplinePoint(spline.curve(), pointer || spline.startPoint() || { x: 0, y: 0 }, { samplesPerSpan: 28 });
        const parameter = closest?.t ?? 0;
        operands.push(makeConstraintOperand("spline", { spline, parameter, endpoint: parameter <= 0.5 ? "start" : "end" }));
      }
      return operands.filter(Boolean);
    }

    function operandElement(operand) {
      if (!operand) return null;
      if (operand.kind === "point") return operand.point;
      if (operand.kind === "line") return operand.line;
      if (operand.kind === "primitive") return operand.primitive;
      if (operand.kind === "spline") return operand.spline;
      if (operand.kind === "arc-endpoint") return operand.arc;
      return operand.element || null;
    }

    function makeConstraintOperand(kind, data) {
      const element = data.element || data.point || data.line || data.primitive || data.spline || data.arc || null;
      const sketchId = data.sketchId || elementSketchId(element);
      const relation = operandRelationForSketch(sketchId);
      if (!element || !sketchId || !relation) return null;
      return { kind, ...data, element, sketchId, relation };
    }

    function operandFromReferenceTarget(target) {
      if (!target) return null;
      if (target.kind === "point") return makeConstraintOperand("point", { point: target.point, sketchId: target.sketchId });
      if (target.kind === "line") return makeConstraintOperand("line", { line: target.line, sketchId: target.sketchId });
      if (target.kind === "primitive") return makeConstraintOperand("primitive", { primitive: target.primitive, sketchId: target.sketchId });
      if (target.kind === "spline") return makeConstraintOperand("spline", { spline: target.spline, parameter: target.parameter, endpoint: target.endpoint, sketchId: target.sketchId });
      return null;
    }

    function referenceTargetFromOperand(operand) {
      if (!operand) return null;
      if (operand.kind === "point") return { kind: "point", point: operand.point, sketchId: operand.sketchId };
      if (operand.kind === "line") return { kind: "line", line: operand.line, sketchId: operand.sketchId };
      if (operand.kind === "primitive") return { kind: "primitive", primitive: operand.primitive, sketchId: operand.sketchId };
      if (operand.kind === "spline") return { kind: "spline", spline: operand.spline, parameter: operand.parameter, endpoint: operand.endpoint, sketchId: operand.sketchId };
      return null;
    }

    function subjectFromOperand(operand) {
      if (!operand) return null;
      if (operand.kind === "point") return { kind: "point", point: operand.point };
      if (operand.kind === "line") return { kind: "line", line: operand.line };
      if (operand.kind === "primitive") return { kind: "primitive", primitive: operand.primitive };
      if (operand.kind === "spline") return { kind: "spline", spline: operand.spline, parameter: operand.parameter, endpoint: operand.endpoint };
      if (operand.kind === "arc-endpoint") return { kind: "arc-endpoint", arc: operand.arc, endpoint: operand.endpoint };
      return null;
    }

    function sameConstraintOperand(a, b) {
      if (!a || !b || a.kind !== b.kind) return false;
      if (a.kind === "arc-endpoint") return sameArcEndpoint(a, b);
      return operandElement(a) === operandElement(b);
    }

    function referenceSubjectElement(subject) {
      if (!subject) return null;
      if (subject.kind === "point") return subject.point;
      if (subject.kind === "line") return subject.line;
      if (subject.kind === "primitive") return subject.primitive;
      if (subject.kind === "spline") return subject.spline;
      if (subject.kind === "arc-endpoint") return subject.arc;
      return null;
    }

    function referenceSubjectSketchId(subject) {
      return elementSketchId(referenceSubjectElement(subject));
    }
    function constraintOperandLimit(type, operands) {
      if (type === "distance") return 2;
      if (type === "horizontal" || type === "vertical") return operands.some((operand) => operand.kind === "point" || operand.kind === "arc-endpoint") ? 2 : 1;
      if (type === "symmetry") return 3;
      return 2;
    }

    function appendTarget(type, operands, operand, invalidHint) {
      if (!operand) return { ok: false, error: invalidHint() };
      if (type === "symmetry") {
        const step = operands.length;
        if (step === 0 && operand.kind !== "line") return { ok: false, error: invalidHint() };
        if (step > 0 && operand.kind !== "point" && operand.kind !== "line" && !(operand.kind === "primitive" && operand.primitive instanceof Arc)) return { ok: false, error: invalidHint() };
        if (operand.kind === "line" && !lineHasDirection(operand.line)) return { ok: false, error: step === 0 ? "対称軸の線が短すぎます" : "対称対象の線が短すぎます" };
        if (operands.some((existing) => sameConstraintOperand(existing, operand))) return { ok: false, error: "対称軸と2つの対象には異なる要素を選択してください" };
        if (step >= 2 && operand.kind !== operands[1].kind) return { ok: false, error: invalidHint() };
        if (step >= 3) return { ok: false, error: "対称拘束の対象はすでに3つ選択されています" };
        return { ok: true, operands: [...operands, operand] };
      }
      if ((type === "parallel" || type === "perpendicular" || type === "collinear") && operand.kind !== "line") return { ok: false, error: invalidHint() };
      if ((type === "parallel" || type === "perpendicular" || type === "collinear") && !lineHasDirection(operand.line)) return { ok: false, error: "向き拘束の対象線が短すぎます" };
      if ((type === "horizontal" || type === "vertical") && operand.kind !== "line" && operand.kind !== "point" && operand.kind !== "arc-endpoint") return { ok: false, error: invalidHint() };
      if (type === "tangent" && operand.kind !== "line" && operand.kind !== "primitive" && operand.kind !== "spline") return { ok: false, error: invalidHint() };
      if (operand.kind === "spline" && type !== "coincident" && type !== "tangent") return { ok: false, error: invalidHint() };
      if ((type === "equal" || type === "equalRadius" || type === "concentric") && operand.kind !== "line" && operand.kind !== "primitive" && operand.kind !== "point") return { ok: false, error: invalidHint() };
      if (type === "pointOnCircle" && operand.kind !== "point" && operand.kind !== "primitive" && operand.kind !== "arc-endpoint") return { ok: false, error: invalidHint() };
      if (type === "distance" && operand.kind === "arc-endpoint") return { ok: false, error: invalidHint() };

      let next = operands.filter((existing) => !sameConstraintOperand(existing, operand));
      next.push(operand);
      const limit = constraintOperandLimit(type, next);
      if (next.length > limit) next = next.slice(next.length - limit);
      return { ok: true, operands: next };
    }

    return Object.freeze({ fromSelection, appendTarget, operandElement, makeConstraintOperand, operandFromReferenceTarget, referenceTargetFromOperand, subjectFromOperand, sameConstraintOperand, referenceSubjectElement, referenceSubjectSketchId });
  }
  window.ConstraintOperands = Object.freeze({ create });
})();

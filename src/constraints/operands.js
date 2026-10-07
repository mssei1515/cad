/* Constraint operand values; geometry identity is retained and selection is caller-owned. */
(() => {
  "use strict";
  function create({ elementSketchId, operandRelationForSketch, sameArcEndpoint }) {
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
    return Object.freeze({ operandElement, makeConstraintOperand, operandFromReferenceTarget, referenceTargetFromOperand, subjectFromOperand, sameConstraintOperand, referenceSubjectElement, referenceSubjectSketchId });
  }
  window.ConstraintOperands = Object.freeze({ create });
})();

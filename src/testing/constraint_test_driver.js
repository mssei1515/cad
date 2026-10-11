/* Constraint browser-test scenarios through explicit application ports. */
(() => {
  "use strict";
  function createForcedCommit({ resetModelState, addPoint, DistanceConstraint, solver, commitNewConstraint, currentScope, document }) {
    function commit(forcedResult) {
      resetModelState();
      const p1 = addPoint(0, 0, true, "endpoint");
      const p2 = addPoint(10, 0, false, "endpoint");
      const constraint = new DistanceConstraint(p1, p2, 10);
      const solveSubset = solver.solveSubset;
      solver.solveSubset = () => ({
        success: Boolean(forcedResult?.success),
        errorNorm: Number(forcedResult?.errorNorm),
        iterations: Number(forcedResult?.iterations) || 0,
        reason: String(forcedResult?.reason || "test"),
        variableCount: 2,
        constraintCount: 1,
      });
      let committed = false;
      try {
        committed = commitNewConstraint("distance", constraint) === true;
      } finally {
        solver.solveSubset = solveSubset;
      }
      const hint = document.getElementById("hint");
      return {
        committed,
        constraintCount: currentScope().constraints.length,
        hint: hint?.textContent || "",
        hintIsError: Boolean(hint?.classList.contains("error")),
      };
    }
    return Object.freeze({ commit });
  }
  function createInputObservation({ readSelectedGeometry, canvasSelection, constraintTargetSession, operandElement }) {
    function state() {
      return {
        selected: readSelectedGeometry(),
        geometryInstances: canvasSelection.geometryInstances.map((item) => item.id),
        arcEndpoint: canvasSelection.arcEndpoint ? { arc: canvasSelection.arcEndpoint.arc.id, endpoint: canvasSelection.arcEndpoint.endpoint } : null,
        arcEndpointPair: canvasSelection.arcEndpointPair?.map((item) => ({ arc: item.arc.id, endpoint: item.endpoint })) || null,
        operands: constraintTargetSession.operands.map((item) => ({ kind: item.kind, id: operandElement(item)?.id, endpoint: item.endpoint })),
        pendingType: constraintTargetSession.command?.type || null,
      };
    }
    return Object.freeze({ state });
  }

  function createIntentResolution({ currentScope, makeConstraintOperand, resolveConstraintIntent, serializeConstraint }) {
    function resolve(type, inputs) {
      const operands = inputs.map(({ kind, id, endpoint, parameter }) => {
        const items = kind === "point" ? currentScope().points : kind === "line" ? currentScope().lines
          : kind === "spline" ? currentScope().splines : kind === "arc-endpoint" ? currentScope().arcs : [...currentScope().circles, ...currentScope().arcs];
        const element = items.find((item) => item.id === id);
        if (!element) throw new Error(`Missing test operand: ${id}`);
        const key = kind === "arc-endpoint" ? "arc" : kind;
        return makeConstraintOperand(kind, { [key]: element, endpoint, parameter });
      });
      const resolution = resolveConstraintIntent(type, operands);
      return resolution ? {
        action: resolution.action || null,
        error: resolution.error || null,
        constraint: resolution.constraint ? serializeConstraint(resolution.constraint) : null,
        targetKind: resolution.target?.kind || null,
      } : null;
    }
    return Object.freeze({ resolve });
  }

  window.ConstraintTestDriver = Object.freeze({ createForcedCommit, createInputObservation, createIntentResolution });
})();

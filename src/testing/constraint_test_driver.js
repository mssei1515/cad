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
  window.ConstraintTestDriver = Object.freeze({ createForcedCommit });
})();

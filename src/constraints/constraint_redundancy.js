/* Analyze duplicate constraints and own the latest display diagnostics. */
(() => {
  "use strict";
  const { LineCircleTangentConstraint, Arc, ArcEndpointCoincidentConstraint } = window.GeometrySolver;
  function create({ currentScope, solver, sketchSolveVariables, constraintSketchId, constraintIsOperational, isRootSketch, acceptError }) {
    let constraintRedundancyState = { constraints: new Map(), sketches: new Map(), count: 0 };
    function constraintsForRedundancy(sketchId) {
      return currentScope().constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId);
    }

    function shouldRetainConnectedLineArcTangency(constraint, constraints) {
      // Endpoint tangency can have zero first-order rank while still preserving the nonlinear shape.
      if (!(constraint instanceof LineCircleTangentConstraint) || !(constraint.primitive instanceof Arc)) return false;
      const firstEquivalent = constraints.find((item) =>
        item instanceof LineCircleTangentConstraint &&
        item.line === constraint.line &&
        item.primitive === constraint.primitive &&
        item.sign === constraint.sign);
      if (firstEquivalent !== constraint) return false;
      return constraints.some((item) =>
        item instanceof ArcEndpointCoincidentConstraint &&
        item.arc === constraint.primitive &&
        (item.point === constraint.line.p1 || item.point === constraint.line.p2));
    }

    function redundantConstraintInfo(constraint, sketchId = constraintSketchId(constraint)) {
      if (!constraint || constraint.enabled === false) return { redundant: false };
      const constraints = constraintsForRedundancy(sketchId);
      if (!constraints.includes(constraint)) return { redundant: false };
      const redundancy = solver.constraintRedundancyState({
        variables: sketchSolveVariables(sketchId),
        constraints,
        errorTolerance: acceptError,
        rankTolerance: 1e-8,
      });
      const contribution = redundancy.byConstraint.get(constraint);
      if (!redundancy.stable || !contribution) return { redundant: false, unstable: true, redundancy };
      return {
        redundant: contribution.redundant && !shouldRetainConnectedLineArcTangency(constraint, constraints),
        rankBefore: contribution.rankBefore,
        rankAfter: contribution.rankAfter,
        redundancy,
      };
    }

    function refreshConstraintRedundancy(precomputedBySketch = null) {
      const byConstraint = new Map();
      const bySketch = new Map();
      let count = 0;
      for (const sketch of currentScope().sketches.filter((item) => !isRootSketch(item))) {
        const sketchId = sketch.id;
        const constraints = constraintsForRedundancy(sketchId);
        const redundancy = precomputedBySketch?.get(sketchId) || solver.constraintRedundancyState({
            variables: sketchSolveVariables(sketchId),
            constraints,
            errorTolerance: acceptError,
            rankTolerance: 1e-8,
          });
        let sketchCount = 0;
        for (const constraint of constraints) {
          const contribution = redundancy.byConstraint.get(constraint);
          if (!redundancy.stable || !contribution?.redundant || shouldRetainConnectedLineArcTangency(constraint, constraints)) continue;
          const info = { redundant: true, sketchId, rankBefore: contribution.rankBefore, rankAfter: contribution.rankAfter };
          byConstraint.set(constraint, info);
          sketchCount += 1;
          count += 1;
        }
        if (sketchCount > 0) bySketch.set(sketchId, sketchCount);
      }
      constraintRedundancyState = { constraints: byConstraint, sketches: bySketch, count };
      return snapshot();
    }

    function constraintRedundancyInfo(constraint) {
      return constraintRedundancyState?.constraints?.get(constraint) || null;
    }

    function constraintIsRedundant(constraint) {
      return Boolean(constraintRedundancyInfo(constraint)?.redundant);
    }

    function constraintDuplicateCountForSketch(sketchId) {
      return constraintRedundancyState?.sketches?.get(sketchId) || 0;
    }


    function snapshot() {
      return { constraints: new Map(constraintRedundancyState.constraints),
        sketches: new Map(constraintRedundancyState.sketches), count: constraintRedundancyState.count };
    }
    return Object.freeze({
      redundantConstraintInfo, refreshConstraintRedundancy, constraintRedundancyInfo,
      constraintIsRedundant, constraintDuplicateCountForSketch,
      get count() { return constraintRedundancyState.count; },
      // Rejecting a new constraint only discards its detail; counts refresh with the next analysis.
      forgetConstraint: constraint => constraintRedundancyState.constraints.delete(constraint),
    });
  }
  window.ConstraintRedundancy = Object.freeze({ create });
})();

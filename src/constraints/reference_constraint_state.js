/* Own reference validity diagnostics without altering persisted constraints. */
(() => {
  "use strict";
  function create({ currentScope, constraintSketchId, isReferenceSourceSketchId }) {
    let invalidReferenceConstraints = new Map();
    function constraintIsOperational(constraint) {
      return constraint?.enabled !== false && !invalidReferenceConstraints.has(constraint);
    }

    function referenceSketchTargets(sketchId) {
      return [...new Set(currentScope().constraints
        .filter((constraint) => constraintIsOperational(constraint) && constraint.reference && constraintSketchId(constraint) === sketchId && constraint.referenceSketchId)
        .map((constraint) => constraint.referenceSketchId))];
    }

    function referencePathExists(fromSketchId, toSketchId) {
      const pending = [fromSketchId];
      const visited = new Set();
      while (pending.length > 0) {
        const current = pending.pop();
        if (current === toSketchId) return true;
        if (!current || visited.has(current)) continue;
        visited.add(current);
        pending.push(...referenceSketchTargets(current));
      }
      return false;
    }

    function wouldCreateReferenceCycle(subjectSketchId, referenceSketchId) {
      return subjectSketchId === referenceSketchId || referencePathExists(referenceSketchId, subjectSketchId);
    }

    function refreshReferenceConstraintValidity() {
      const invalid = new Map();
      const acceptedTargets = new Map();
      const targetsOf = (sketchId) => acceptedTargets.get(sketchId) || [];
      const pathExists = (fromSketchId, toSketchId) => {
        const pending = [fromSketchId];
        const visited = new Set();
        while (pending.length > 0) {
          const current = pending.pop();
          if (current === toSketchId) return true;
          if (!current || visited.has(current)) continue;
          visited.add(current);
          pending.push(...targetsOf(current));
        }
        return false;
      };
      for (const constraint of currentScope().constraints) {
        if (constraint.enabled === false || !constraint.reference || !constraint.referenceSketchId) continue;
        const ownerSketchId = constraintSketchId(constraint);
        const referenceSketchId = constraint.referenceSketchId;
        if (!isReferenceSourceSketchId(referenceSketchId, ownerSketchId)) {
          invalid.set(constraint, "参照範囲外");
          continue;
        }
        if (ownerSketchId === referenceSketchId || pathExists(referenceSketchId, ownerSketchId)) {
          invalid.set(constraint, "循環参照");
          continue;
        }
        if (!acceptedTargets.has(ownerSketchId)) acceptedTargets.set(ownerSketchId, []);
        acceptedTargets.get(ownerSketchId).push(referenceSketchId);
      }
      invalidReferenceConstraints = invalid;
      return new Map(invalid);
    }

    function referenceConstraintErrorInfo(constraint) {
      return invalidReferenceConstraints.get(constraint) || null;
    }

    function referenceConstraintErrorCountForSketch(sketchId) {
      let count = 0;
      for (const constraint of invalidReferenceConstraints.keys()) {
        if (constraintSketchId(constraint) === sketchId) count += 1;
      }
      return count;
    }


    return Object.freeze({
      constraintIsOperational, wouldCreateReferenceCycle, refreshReferenceConstraintValidity,
      referenceConstraintErrorInfo, referenceConstraintErrorCountForSketch,
      get errorCount() { return invalidReferenceConstraints.size; },
      errorReasons: () => [...invalidReferenceConstraints.values()],
      clear: () => invalidReferenceConstraints.clear(),
    });
  }
  window.ReferenceConstraintState = Object.freeze({ create });
})();

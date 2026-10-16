(() => {
  "use strict";

  // Applies a draft with recovery using the caller's scope-specific checkpoint.
  function create({ namespace, currentScope, capture, restore, stabilize, propagate,
    acceptError, applicationText }) {
    function apply(session, committed) {
      if (!session) return { success: false };
      const checkpoint = capture();
      try {
        for (const dimension of session.dimensions) {
          const item = dimension.constraint;
          if (!session.namespace.sketches?.some(sketch => sketch.id === item.sketchId && sketch.locked)) continue;
          if (dimension.name.trim() !== item.parameterName || !dimension.readOnly && namespace.expressionFromUserInput(dimension.expression) !== item.expression) {
            throw new Error(applicationText("ロック中のスケッチの寸法・注記は変更できません", "Unlock the owning sketch to edit dimensions or annotations"));
          }
        }
        session.namespace.parameters = session.parameters.map(parameter => ({
          name: parameter.name.trim(), expression: namespace.expressionFromUserInput(parameter.expression),
        }));
        session.dimensions.forEach(dimension => {
          dimension.constraint.parameterName = dimension.name.trim();
          if (!dimension.readOnly) dimension.constraint.expression = namespace.expressionFromUserInput(dimension.expression);
        });
        namespace.ensureParameterNamespace(session.namespace);
        const result = stabilize(session.namespace);
        if (!result.success || result.dependent?.success === false || result.result.errorNorm > acceptError) {
          throw new Error(result.result.reason || applicationText("拘束が成立しません", "Constraints could not be satisfied"));
        }
        if (session.namespace !== currentScope()) propagate(session.namespace);
        committed();
        return { success: true };
      } catch (error) {
        restore(checkpoint);
        return { success: false, error };
      }
    }
    return Object.freeze({ apply });
  }
  // Guard symbol removal shared by Geometry, Sketch, Block and annotation edits.
  function createDeletionGuard({ currentNamespace, symbolDeletionDependents, readLanguage, setHint, log }) {
    function guard(constraints, namespace = currentNamespace()) {
      const { removedNames, dependents } = symbolDeletionDependents(constraints, namespace);
      if (dependents.length === 0) return true;
      const message = readLanguage() === "en"
        ? `Cannot delete ${removedNames.join(", ")}; referenced by ${dependents.join(", ")}`
        : `${removedNames.join("、")} は ${dependents.join("、")} から参照されているため削除できません`;
      setHint(message, "error");
      log(message);
      return false;
    }
    return Object.freeze({ guard });
  }
  window.ParameterApplication = Object.freeze({ create, createDeletionGuard });
})();

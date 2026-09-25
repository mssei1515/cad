(() => {
  "use strict";

  // Applies a draft with recovery using the caller's scope-specific checkpoint.
  function create({ namespace, currentScope, capture, restore, stabilize, propagate,
    acceptError, applicationText }) {
    function apply(session, committed) {
      if (!session) return { success: false };
      const checkpoint = capture();
      try {
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
  window.ParameterApplication = Object.freeze({ create });
})();

/* Parameter dialog draft ownership; model application and DOM rendering are separate. */
(function () {
  "use strict";
  const { dependencies: expressionDependencies, evaluateDefinitions: evaluateParameterDefinitions } = window.ParameterEngine;
  const { isReadOnlyDimension, targetFromConstraint, measuredDimensionValue } = window.DimensionQueries;
  function create({ namespace }) {
    const { ensureParameterNamespace, dimensionConstraintsInNamespace, expressionInputValue, expressionFromUserInput, rewriteExpressionInputIdentifiers, validateParameterSymbolNames } = namespace;
    let parameterDialogSession = null;
    function parameterDraftSignature(session = parameterDialogSession) {
      if (!session) return "";
      return JSON.stringify({
        parameters: session.parameters.map(({ name, expression }) => ({ name, expression })),
        dimensions: session.dimensions.map(({ name, expression, readOnly }) => ({ name, expression: readOnly ? null : expression, readOnly })),
      });
    }

    function parameterDialogIsDirty() {
      return Boolean(parameterDialogSession && parameterDraftSignature() !== parameterDialogSession.originalSignature);
    }

    function createParameterDialogSession(scope) {
      ensureParameterNamespace(scope.namespace);
      const dimensions = dimensionConstraintsInNamespace(scope.namespace).map((constraint) => ({
        constraint,
        name: constraint.parameterName,
        committedName: constraint.parameterName,
        expression: isReadOnlyDimension(constraint) ? "" : expressionInputValue(constraint.expression),
        readOnly: isReadOnlyDimension(constraint),
      }));
      const session = {
        key: scope.key,
        namespace: scope.namespace,
        parameters: scope.namespace.parameters.map((parameter) => ({ name: parameter.name, committedName: parameter.name, expression: expressionInputValue(parameter.expression), isNew: false })),
        dimensions,
      };
      session.originalSignature = parameterDraftSignature(session);
      return session;
    }

    function parameterDraftEvaluation(session = parameterDialogSession) {
      validateParameterSymbolNames(session.parameters, session.dimensions);
      const inputValues = new Map();
      const definitions = session.parameters.map((parameter) => ({ name: parameter.name, expression: expressionFromUserInput(parameter.expression), kind: "parameter" }));
      for (const dimension of session.dimensions) {
        if (dimension.readOnly) {
          const target = targetFromConstraint(dimension.constraint);
          inputValues.set(dimension.name, measuredDimensionValue(target, dimension.constraint.dimension));
        } else {
          definitions.push({ name: dimension.name, expression: expressionFromUserInput(dimension.expression), kind: "dimension" });
        }
      }
      return evaluateParameterDefinitions(definitions, inputValues);
    }

    function rewriteParameterDraftName(oldName, nextName) {
      if (!oldName || oldName === nextName) return;
      const replacements = new Map([[oldName, nextName]]);
      for (const parameter of parameterDialogSession.parameters) parameter.expression = rewriteExpressionInputIdentifiers(parameter.expression, replacements);
      for (const dimension of parameterDialogSession.dimensions) if (!dimension.readOnly) dimension.expression = rewriteExpressionInputIdentifiers(dimension.expression, replacements);
    }

    function open(scope) { parameterDialogSession = createParameterDialogSession(scope); }
    function close() { parameterDialogSession = null; }
    function current() {
      if (!parameterDialogSession) return null;
      return Object.freeze({ ...parameterDialogSession,
        parameters: Object.freeze(parameterDialogSession.parameters.map(row => Object.freeze({ ...row }))),
        dimensions: Object.freeze(parameterDialogSession.dimensions.map(row => Object.freeze({ ...row }))),
      });
    }
    function updateInput(data, value) {
      if (!parameterDialogSession) return;
      if (data.parameterRow != null) {
        const row = parameterDialogSession.parameters[Number(data.parameterRow)];
        if (row) row[data.parameterField] = value;
      }
      if (data.dimensionRow != null) {
        const row = parameterDialogSession.dimensions[Number(data.dimensionRow)];
        if (row && !(row.readOnly && data.dimensionField === "expression")) row[data.dimensionField] = value;
      }
    }
    function commitName(data) {
      if (!parameterDialogSession) return;
      let row = null;
      if (data.parameterRow != null) row = parameterDialogSession.parameters[Number(data.parameterRow)];
      if (data.dimensionRow != null) row = parameterDialogSession.dimensions[Number(data.dimensionRow)];
      const isName = data.parameterField === "name" || data.dimensionField === "name";
      if (row && isName) {
        rewriteParameterDraftName(row.committedName, row.name);
        row.committedName = row.name;
      }
    }
    function remove(index) {
      const parameter = parameterDialogSession?.parameters[index];
      if (!parameter) return null;
      const dependencies = [];
      for (const item of [
        ...parameterDialogSession.parameters.filter((_, itemIndex) => itemIndex !== index),
        ...parameterDialogSession.dimensions.filter(dimension => !dimension.readOnly),
      ]) {
        try {
          if (expressionDependencies(expressionFromUserInput(item.expression)).has(parameter.name)) dependencies.push(item.name);
        } catch (_error) {
          // The complete draft validation reports unrelated syntax errors.
        }
      }
      if (dependencies.length > 0) return { removed: false, name: parameter.name, dependencies };
      parameterDialogSession.parameters.splice(index, 1);
      return { removed: true };
    }
    function add() {
      if (!parameterDialogSession) return false;
      const used = new Set([...parameterDialogSession.parameters.map(item => item.name), ...parameterDialogSession.dimensions.map(item => item.name)]);
      let index = 1;
      while (used.has(`parameter${index}`)) index += 1;
      const name = `parameter${index}`;
      parameterDialogSession.parameters.push({ name, committedName: name, expression: "0", isNew: true });
      return true;
    }

    return Object.freeze({ open, close, updateInput, commitName, remove, add, isDirty: parameterDialogIsDirty, evaluate: parameterDraftEvaluation, get current() { return current(); } });
  }
  window.ParameterDialogDraft = Object.freeze({ create });
})();

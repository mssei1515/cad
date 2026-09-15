/* Parameter namespace normalization, dimension symbols and expression evaluation. */
(function () {
  "use strict";
  const { isDimensionConstraint, targetFromConstraint, measuredDimensionValue, isReadOnlyDimension, angleDegrees } = window.DimensionQueries;
  const {
    dependencies: expressionDependencies, evaluateDefinitions: evaluateParameterDefinitions,
    validateIdentifier: validateParameterIdentifier, rewriteIdentifiers: rewriteParameterIdentifiers,
  } = window.ParameterEngine;
  const DIRECT_NUMERIC_INPUT_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  function create({ currentParameterNamespace, applicationText }) {
    function dimensionExpressionValue(constraint) {
      const target = targetFromConstraint(constraint);
      return target?.kind === "angle" ? angleDegrees(constraint.target) : Number(constraint.target);
    }

    function numericDimensionExpression(constraint) {
      const value = dimensionExpressionValue(constraint);
      return Number.isFinite(value) ? String(Number(value.toPrecision(15))) : "0";
    }

    function isDirectNumericExpressionInput(value) {
      return DIRECT_NUMERIC_INPUT_PATTERN.test(String(value ?? "").trim());
    }

    function dimensionUsesExpression(constraint) {
      const expression = String(constraint?.expression ?? "").trim();
      return Boolean(expression) && !isReadOnlyDimension(constraint) && !isDirectNumericExpressionInput(expression);
    }

    function expressionInputValue(expression) {
      const value = String(expression ?? "").trim();
      if (!value || isDirectNumericExpressionInput(value)) return value;
      return value.startsWith("=") ? value : `=${value}`;
    }

    function expressionFromUserInput(value) {
      const input = String(value ?? "").trim();
      if (!input) throw Object.assign(new Error("Expression is empty"), { code: "EMPTY_EXPRESSION" });
      if (isDirectNumericExpressionInput(input)) return input;
      if (!input.startsWith("=")) throw Object.assign(new Error("Expressions must begin with '='"), { code: "EXPRESSION_PREFIX_REQUIRED" });
      const expression = input.slice(1).trim();
      if (!expression) throw Object.assign(new Error("Expression is empty"), { code: "EMPTY_EXPRESSION" });
      return expression;
    }

    function rewriteExpressionInputIdentifiers(value, replacements) {
      try {
        return expressionInputValue(rewriteParameterIdentifiers(expressionFromUserInput(value), replacements));
      } catch (_error) {
        return value;
      }
    }

    function dimensionConstraintsInNamespace(namespace) {
      return (namespace?.constraints || []).filter(isDimensionConstraint);
    }

    function allocateDimensionParameterName(namespace) {
      ensureParameterNamespace(namespace, { assignDimensions: false });
      const used = new Set([
        ...(namespace.parameters || []).map((parameter) => String(parameter.name)),
        ...dimensionConstraintsInNamespace(namespace).map((constraint) => String(constraint.parameterName || "")),
      ]);
      let index = Math.max(1, Number(namespace.nextDimensionParameterIndex) || 1);
      while (used.has(`d${index}`)) index += 1;
      namespace.nextDimensionParameterIndex = index + 1;
      return `d${index}`;
    }

    function ensureDimensionParameter(constraint, namespace = currentParameterNamespace()) {
      if (!isDimensionConstraint(constraint)) return constraint;
      if (!constraint.parameterName) constraint.parameterName = allocateDimensionParameterName(namespace);
      const autoMatch = /^d(\d+)$/.exec(String(constraint.parameterName));
      if (autoMatch) namespace.nextDimensionParameterIndex = Math.max(Number(namespace.nextDimensionParameterIndex) || 1, Number(autoMatch[1]) + 1);
      if (isReadOnlyDimension(constraint)) {
        delete constraint.expression;
      } else if (typeof constraint.expression !== "string" || !constraint.expression.trim()) {
        constraint.expression = numericDimensionExpression(constraint);
      }
      return constraint;
    }

    function ensureParameterNamespace(namespace, options = {}) {
      if (!namespace) return namespace;
      namespace.parameters = Array.isArray(namespace.parameters) ? namespace.parameters : [];
      for (let index = 0; index < namespace.parameters.length; index += 1) {
        const parameter = namespace.parameters[index];
        if (!parameter || typeof parameter !== "object") namespace.parameters[index] = { name: "", expression: "" };
        else {
          parameter.name = String(parameter.name || "");
          parameter.expression = String(parameter.expression ?? "");
        }
      }
      namespace.nextDimensionParameterIndex = Math.max(1, Number(namespace.nextDimensionParameterIndex) || 1);
      if (options.assignDimensions !== false) {
        for (const constraint of dimensionConstraintsInNamespace(namespace)) ensureDimensionParameter(constraint, namespace);
      }
      return namespace;
    }

    function parameterErrorText(error) {
      const name = error?.identifier ? ` ${error.identifier}` : "";
      const messages = {
        INVALID_IDENTIFIER: applicationText(`名前${name}は使用できません`, `Name${name} is invalid`),
        RESERVED_IDENTIFIER: applicationText(`名前${name}は寸法用に予約されています`, `Name${name} is reserved for dimensions`),
        DUPLICATE_IDENTIFIER: applicationText(`名前${name}が重複しています`, `Name${name} is duplicated`),
        UNKNOWN_IDENTIFIER: applicationText(`未定義の名前${name}があります`, `Unknown name${name}`),
        CYCLE: applicationText("Parameterに循環参照があります", "Parameters contain a circular dependency"),
        DIVISION_BY_ZERO: applicationText("0で除算しています", "Division by zero"),
        NON_FINITE: applicationText("計算結果が有限値ではありません", "The result is not finite"),
        EMPTY_EXPRESSION: applicationText("値 / 数式が空です", "Value / Expression is empty"),
        EXPRESSION_PREFIX_REQUIRED: applicationText("数式は先頭に = を入力してください", "Expressions must begin with ="),
        REFERENCE_QUOTES_REQUIRED: applicationText(`Parameter参照${name}はダブルクオーテーションで括ってください`, `Parameter reference${name} must be enclosed in double quotes`),
        UNTERMINATED_REFERENCE: applicationText("Parameter参照のダブルクオーテーションが閉じていません", "The parameter reference has an unterminated double quote"),
      };
      return messages[error?.code] || error?.message || applicationText("Parameterを評価できません", "Could not evaluate parameters");
    }

    function referenceDimensionValues(namespace) {
      const values = new Map();
      for (const constraint of dimensionConstraintsInNamespace(namespace)) {
        if (!isReadOnlyDimension(constraint)) continue;
        const target = targetFromConstraint(constraint);
        const measured = target ? measuredDimensionValue(target, constraint.dimension) : NaN;
        if (!Number.isFinite(measured)) throw new Error(`${constraint.parameterName}: ${applicationText("参照寸法を測定できません", "Reference dimension could not be measured")}`);
        values.set(constraint.parameterName, measured);
        constraint.target = target?.kind === "angle" ? (measured * Math.PI) / 180 : measured;
        constraint.evaluatedParameterValue = measured;
      }
      return values;
    }

    function validateParameterSymbolNames(parameters, dimensions) {
      const seen = new Set();
      for (const parameter of parameters || []) {
        const name = validateParameterIdentifier(parameter.name);
        if (seen.has(name)) throw Object.assign(new Error(`Duplicate identifier '${name}'`), { code: "DUPLICATE_IDENTIFIER", identifier: name });
        seen.add(name);
      }
      for (const dimension of dimensions || []) {
        const name = validateParameterIdentifier(dimension.parameterName != null ? dimension.parameterName : dimension.name, { dimension: true });
        if (seen.has(name)) throw Object.assign(new Error(`Duplicate identifier '${name}'`), { code: "DUPLICATE_IDENTIFIER", identifier: name });
        seen.add(name);
      }
    }

    function evaluateParameterNamespace(namespace, options = {}) {
      ensureParameterNamespace(namespace);
      validateParameterSymbolNames(namespace.parameters, dimensionConstraintsInNamespace(namespace));
      const inputs = options.referenceValues || referenceDimensionValues(namespace);
      const definitions = [
        ...namespace.parameters.map((parameter) => ({ ...parameter, kind: "parameter" })),
        ...dimensionConstraintsInNamespace(namespace)
          .filter((constraint) => !isReadOnlyDimension(constraint))
          .map((constraint) => ({ name: constraint.parameterName, expression: constraint.expression, kind: "dimension", constraint })),
      ];
      const evaluated = evaluateParameterDefinitions(definitions, inputs);
      for (const parameter of namespace.parameters) parameter.evaluatedValue = evaluated.values.get(parameter.name);
      for (const constraint of dimensionConstraintsInNamespace(namespace)) {
        const value = evaluated.values.get(constraint.parameterName);
        if (!Number.isFinite(value)) throw new Error(`${constraint.parameterName}: ${applicationText("値を計算できません", "Value could not be evaluated")}`);
        const target = targetFromConstraint(constraint);
        if (!isReadOnlyDimension(constraint)) {
          const max = target?.kind === "angle" ? 180 : Infinity;
          if (value <= 0 || value >= max) throw new Error(`${constraint.parameterName}: ${applicationText("寸法値の範囲が正しくありません", "Dimension value is out of range")}`);
          constraint.target = target?.kind === "angle" ? (value * Math.PI) / 180 : value;
        }
        constraint.evaluatedParameterValue = value;
      }
      namespace.parameterValues = evaluated.values;
      namespace.parameterDependencies = evaluated.dependencies;
      return evaluated;
    }

    function validateParameterNamespace(namespace) {
      try {
        return { success: true, evaluation: evaluateParameterNamespace(namespace) };
      } catch (error) {
        return { success: false, error, reason: parameterErrorText(error) };
      }
    }

    function prepareLoadedParameterNamespace(namespace, sourceVersion, label) {
      if (sourceVersion >= 10) {
        if (!Array.isArray(namespace.parameters) || !Number.isInteger(Number(namespace.nextDimensionParameterIndex)) || Number(namespace.nextDimensionParameterIndex) < 1) {
          throw new Error(`${label}: ${applicationText("Parameter名前空間の形式が正しくありません", "The parameter namespace is invalid")}`);
        }
        for (const constraint of dimensionConstraintsInNamespace(namespace)) {
          if (typeof constraint.parameterName !== "string" || !constraint.parameterName) {
            throw new Error(`${label}: ${applicationText("寸法のParameter名がありません", "A dimension parameter name is missing")}`);
          }
          if (!isReadOnlyDimension(constraint) && (typeof constraint.expression !== "string" || !constraint.expression.trim())) {
            throw new Error(`${label}/${constraint.parameterName}: ${applicationText("寸法の値 / 数式がありません", "The dimension has no Value / Expression")}`);
          }
        }
      }
      ensureParameterNamespace(namespace);
      const validation = validateParameterNamespace(namespace);
      if (!validation.success) throw new Error(`${label}: ${validation.reason}`);
      return namespace;
    }

    function parameterDependents(namespace, names, removedConstraints = new Set()) {
      ensureParameterNamespace(namespace);
      const removedNames = new Set(names);
      const dependents = [];
      const formulas = [
        ...namespace.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
        ...dimensionConstraintsInNamespace(namespace)
          .filter((constraint) => !isReadOnlyDimension(constraint) && !removedConstraints.has(constraint))
          .map((constraint) => ({ name: constraint.parameterName, expression: constraint.expression })),
      ];
      for (const item of formulas) {
        if (removedNames.has(item.name)) continue;
        let dependencies;
        try {
          dependencies = expressionDependencies(item.expression);
        } catch (_error) {
          continue;
        }
        if ([...dependencies].some((name) => removedNames.has(name))) dependents.push(item.name);
      }
      return [...new Set(dependents)];
    }

    return Object.freeze({
      dimensionExpressionValue, numericDimensionExpression, isDirectNumericExpressionInput,
      dimensionUsesExpression, expressionInputValue, expressionFromUserInput,
      rewriteExpressionInputIdentifiers, dimensionConstraintsInNamespace, allocateDimensionParameterName,
      ensureDimensionParameter, ensureParameterNamespace, parameterErrorText,
      referenceDimensionValues, validateParameterSymbolNames, evaluateParameterNamespace,
      validateParameterNamespace, prepareLoadedParameterNamespace, parameterDependents,
    });
  }
  window.ParameterNamespace = Object.freeze({ create });
})();

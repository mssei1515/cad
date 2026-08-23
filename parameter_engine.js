/* parameter_engine.js: Safe scalar expression parsing and namespace evaluation. */
(function () {
  "use strict";

  const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const DIMENSION_NAME_PATTERN = /^d\d+$/;

  class ParameterExpressionError extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = "ParameterExpressionError";
      this.code = code;
      Object.assign(this, details);
    }
  }

  function tokenize(source) {
    const text = String(source ?? "");
    const tokens = [];
    let index = 0;
    while (index < text.length) {
      const rest = text.slice(index);
      const whitespace = /^\s+/.exec(rest);
      if (whitespace) {
        index += whitespace[0].length;
        continue;
      }
      const number = /^(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/.exec(rest);
      if (number) {
        const value = Number(number[0]);
        if (!Number.isFinite(value)) throw new ParameterExpressionError("NON_FINITE", `Number is not finite at ${index}`, { index });
        tokens.push({ type: "number", text: number[0], value, start: index, end: index + number[0].length });
        index += number[0].length;
        continue;
      }
      const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
      if (identifier) {
        tokens.push({ type: "identifier", text: identifier[0], start: index, end: index + identifier[0].length });
        index += identifier[0].length;
        continue;
      }
      const character = text[index];
      if ("+-*/()".includes(character)) {
        tokens.push({ type: character === "(" || character === ")" ? "paren" : "operator", text: character, start: index, end: index + 1 });
        index += 1;
        continue;
      }
      throw new ParameterExpressionError("INVALID_TOKEN", `Unexpected character '${character}' at ${index}`, { index });
    }
    tokens.push({ type: "eof", text: "", start: index, end: index });
    return tokens;
  }

  function parse(source) {
    const tokens = tokenize(source);
    let cursor = 0;
    const current = () => tokens[cursor];
    const consume = () => tokens[cursor++];

    function primary() {
      const token = current();
      if (token.type === "number") {
        consume();
        return { type: "number", value: token.value };
      }
      if (token.type === "identifier") {
        consume();
        return { type: "identifier", name: token.text };
      }
      if (token.type === "paren" && token.text === "(") {
        consume();
        const node = additive();
        if (current().type !== "paren" || current().text !== ")") {
          throw new ParameterExpressionError("EXPECTED_PAREN", `Expected ')' at ${current().start}`, { index: current().start });
        }
        consume();
        return node;
      }
      throw new ParameterExpressionError("EXPECTED_VALUE", `Expected a number, identifier, or '(' at ${token.start}`, { index: token.start });
    }

    function unary() {
      const token = current();
      if (token.type === "operator" && (token.text === "+" || token.text === "-")) {
        consume();
        return { type: "unary", operator: token.text, operand: unary() };
      }
      return primary();
    }

    function multiplicative() {
      let node = unary();
      while (current().type === "operator" && (current().text === "*" || current().text === "/")) {
        const operator = consume().text;
        node = { type: "binary", operator, left: node, right: unary() };
      }
      return node;
    }

    function additive() {
      let node = multiplicative();
      while (current().type === "operator" && (current().text === "+" || current().text === "-")) {
        const operator = consume().text;
        node = { type: "binary", operator, left: node, right: multiplicative() };
      }
      return node;
    }

    if (tokens.length === 1) throw new ParameterExpressionError("EMPTY_EXPRESSION", "Expression is empty", { index: 0 });
    const ast = additive();
    if (current().type !== "eof") {
      throw new ParameterExpressionError("UNEXPECTED_TOKEN", `Unexpected token '${current().text}' at ${current().start}`, { index: current().start });
    }
    return ast;
  }

  function astDependencies(ast, result = new Set()) {
    if (ast.type === "identifier") result.add(ast.name);
    else if (ast.type === "unary") astDependencies(ast.operand, result);
    else if (ast.type === "binary") {
      astDependencies(ast.left, result);
      astDependencies(ast.right, result);
    }
    return result;
  }

  function dependencies(source) {
    return astDependencies(parse(source));
  }

  function evaluateAst(ast, resolver) {
    let value;
    if (ast.type === "number") value = ast.value;
    else if (ast.type === "identifier") {
      value = resolver(ast.name);
      if (!Number.isFinite(value)) throw new ParameterExpressionError("UNKNOWN_IDENTIFIER", `Unknown identifier '${ast.name}'`, { identifier: ast.name });
    } else if (ast.type === "unary") {
      const operand = evaluateAst(ast.operand, resolver);
      value = ast.operator === "-" ? -operand : operand;
    } else {
      const left = evaluateAst(ast.left, resolver);
      const right = evaluateAst(ast.right, resolver);
      if (ast.operator === "+") value = left + right;
      else if (ast.operator === "-") value = left - right;
      else if (ast.operator === "*") value = left * right;
      else {
        if (right === 0) throw new ParameterExpressionError("DIVISION_BY_ZERO", "Division by zero");
        value = left / right;
      }
    }
    if (!Number.isFinite(value)) throw new ParameterExpressionError("NON_FINITE", "Expression result is not finite");
    return value;
  }

  function evaluate(source, values = {}) {
    const resolver = typeof values === "function"
      ? values
      : (name) => values && typeof values.get === "function" ? values.get(name) : values[name];
    return evaluateAst(parse(source), resolver);
  }

  function validateIdentifier(name, options = {}) {
    const value = String(name ?? "");
    if (!IDENTIFIER_PATTERN.test(value)) {
      throw new ParameterExpressionError("INVALID_IDENTIFIER", `Invalid identifier '${value}'`, { identifier: value });
    }
    if (!options.dimension && DIMENSION_NAME_PATTERN.test(value)) {
      throw new ParameterExpressionError("RESERVED_IDENTIFIER", `Identifier '${value}' is reserved for dimensions`, { identifier: value });
    }
    return value;
  }

  function evaluateDefinitions(definitions, inputValues = new Map()) {
    const entries = Array.isArray(definitions) ? definitions : [];
    const suppliedEntries = inputValues && typeof inputValues.entries === "function" ? [...inputValues.entries()] : Object.entries(inputValues || {});
    const suppliedNames = new Set(suppliedEntries.map(([name]) => name));
    const byName = new Map();
    const parsed = new Map();
    for (const entry of entries) {
      const name = validateIdentifier(entry?.name, { dimension: entry?.kind === "dimension" });
      if (byName.has(name) || suppliedNames.has(name)) {
        throw new ParameterExpressionError("DUPLICATE_IDENTIFIER", `Duplicate identifier '${name}'`, { identifier: name });
      }
      const ast = parse(entry?.expression);
      byName.set(name, entry);
      parsed.set(name, ast);
    }

    const values = new Map(suppliedEntries);
    const states = new Map();
    const dependencyMap = new Map();
    for (const [name, ast] of parsed) dependencyMap.set(name, astDependencies(ast));

    function visit(name, path = []) {
      if (values.has(name)) return values.get(name);
      if (!byName.has(name)) throw new ParameterExpressionError("UNKNOWN_IDENTIFIER", `Unknown identifier '${name}'`, { identifier: name, path });
      if (states.get(name) === "visiting") {
        const cycleStart = path.indexOf(name);
        const cycle = [...path.slice(Math.max(0, cycleStart)), name];
        throw new ParameterExpressionError("CYCLE", `Circular dependency: ${cycle.join(" -> ")}`, { identifier: name, cycle });
      }
      if (states.get(name) === "done") return values.get(name);
      states.set(name, "visiting");
      const value = evaluateAst(parsed.get(name), (dependency) => visit(dependency, [...path, name]));
      states.set(name, "done");
      values.set(name, value);
      return value;
    }

    for (const name of byName.keys()) visit(name);
    return { values, dependencies: dependencyMap };
  }

  function rewriteIdentifiers(source, replacements) {
    const mapping = new Map(replacements && typeof replacements.entries === "function" ? [...replacements.entries()] : Object.entries(replacements || {}));
    const text = String(source ?? "");
    const tokens = tokenize(text).filter((token) => token.type !== "eof");
    let result = "";
    let cursor = 0;
    for (const token of tokens) {
      result += text.slice(cursor, token.start);
      result += token.type === "identifier" && mapping.has(token.text) ? mapping.get(token.text) : token.text;
      cursor = token.end;
    }
    return result + text.slice(cursor);
  }

  window.ParameterEngine = Object.freeze({
    ParameterExpressionError,
    IDENTIFIER_PATTERN,
    DIMENSION_NAME_PATTERN,
    tokenize,
    parse,
    dependencies,
    evaluate,
    evaluateDefinitions,
    validateIdentifier,
    rewriteIdentifiers,
  });
})();

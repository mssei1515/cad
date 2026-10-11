/* Own the pending constraint target command and its ordered operand selection. */
(() => {
  "use strict";
  function create({ acceptTarget }) {
    let command = null;
    let operands = [];
    function begin(type, initialOperands) { operands = initialOperands; command = { type }; }
    function append(type, candidate, invalidHint) {
      const result = acceptTarget(type, operands, candidate, invalidHint);
      if (!result.ok) return result;
      operands = result.operands;
      return { ok: true };
    }
    function reset() { command = null; operands = []; }
    function clearCommand() { command = null; }
    function clearOperands() { operands = []; }
    function replaceCommand(value) { command = value; }
    function replaceOperands(value) { operands = value; }
    return Object.freeze({ begin, append, reset, clearCommand, clearOperands, replaceCommand, replaceOperands,
      get command() { return command; }, get operands() { return operands; },
    });
  }
  window.ConstraintTargetSession = Object.freeze({ create });
})();

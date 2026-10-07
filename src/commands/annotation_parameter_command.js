/* Commit an annotation parameter change with existing guard and rollback semantics. */
(() => {
  "use strict";
  function create({ capture, restore, guardDimensionSymbolDeletion, ensureParameter, renameParameter,
    expressionFromUserInput, stabilize, recordHistory, setHint, parameterErrorText }) {
    function commit(item, property, value) {
      const snapshot = capture();
      try {
        if (property === "annotation-parameter-enabled") {
          if (!value && !guardDimensionSymbolDeletion([item])) return false;
          if (value && !item.parameterEnabled) {
            (item.style ||= {}).prefix = item.text || "";
          } else if (!value && item.parameterEnabled) {
            item.text = item.style?.prefix || "";
          }
          item.parameterEnabled = Boolean(value);
          if (item.parameterEnabled) ensureParameter(item);
        } else if (property === "annotation-parameter-name") renameParameter(item, value);
        else if (property === "annotation-expression") item.expression = expressionFromUserInput(value);
        const solved = stabilize();
        if (!solved.success || solved.dependent?.success === false) throw new Error(solved.result.reason);
        recordHistory("注記Parameter変更");
        return true;
      } catch (error) {
        restore(snapshot);
        setHint(parameterErrorText(error), "error");
        return false;
      }
    }
    return Object.freeze({ commit });
  }
  window.AnnotationParameterCommand = Object.freeze({ create });
})();

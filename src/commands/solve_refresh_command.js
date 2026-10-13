/* Complete solve feedback and history in the original order; solver recovery remains delegated. */
(() => {
  "use strict";
  function create({ activeSketchId, stabilizeActiveParameterNamespace, refreshConstraintAnalysis,
    setSolveResultHint, updateUI, draw, historyController, recordHistory }) {
    function run(label = "自動solve", sketchId = activeSketchId()) {
      const solved = stabilizeActiveParameterNamespace(sketchId);
      const result = solved.result;
      const analysis = refreshConstraintAnalysis();
      setSolveResultHint(label, solved, analysis, solved.dependent);
      updateUI({ refreshAnalysis: false });
      draw();
      if (solved.success && !historyController.restoring) recordHistory(label);
      return result;
    }
    return Object.freeze({ run });
  }
  window.SolveRefreshCommand = Object.freeze({ create });
})();

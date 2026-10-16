/* Assemble parameter editing UI and expression presentation around existing owners. */
(() => {
  "use strict";
  function create({ document, window: browserWindow, InputElement, Event: EventType,
    namespace, currentScope, readDefinitions, readBlockEditor, applicationText, language,
    formatting: { escapeHtml, formatDisplayNumber, formatParameterReference, parameterErrorText, defaultSketchId },
    localizeApplicationUI, applyDraft, recordHistory, setHint, updateUI, draw, pickDimension }) {
    const parameterDraft = window.ParameterDialogDraft.create({ namespace });
    function expressionReferenceNamesForInput(input) {
      if (input?.closest("#parametersDialog") && parameterDraft.current) {
        return new Set([
          ...parameterDraft.current.parameters.map((parameter) => String(parameter.name || "")),
          ...parameterDraft.current.dimensions.map((dimension) => String(dimension.name || "")),
        ]);
      }
      return new Set([
        ...(currentScope().parameters || []).map((parameter) => String(parameter.name || "")),
        ...namespace.symbolElementsInNamespace(currentScope()).map((constraint) => String(constraint.parameterName || "")),
      ]);
    }
    function parameterScopeOptions() {
      if (readBlockEditor()) return [{ key: `block:${readBlockEditor().draft.id}`, label: `${applicationText("ブロック", "Block")}: ${readBlockEditor().draft.name}`, namespace: currentScope() }];
      return [
        { key: "document", label: "Document", namespace: currentScope() },
        ...readDefinitions().map((definition) => ({ key: `block:${definition.id}`, label: `${applicationText("ブロック", "Block")}: ${definition.name}`, namespace: definition })),
      ];
    }
    const expressionInputView = window.ExpressionInputView.create({
      document, InputElement, referenceNamesForInput: expressionReferenceNamesForInput, escapeHtml,
    });
    const { insert: insertIdentifierIntoExpressionInput } = window.ExpressionInputView.createInsertion({ Event: EventType, formatParameterReference });
    const { sync: syncExpressionInputHighlight, install: installExpressionInputHighlights,
      refresh: refreshExpressionInputHighlights } = expressionInputView;
    const parameterDialogView = window.ParameterDialogView.create({
      document, applicationText, escapeHtml, formatDisplayNumber, parameterErrorText,
      localizeApplicationUI, installExpressionInputHighlights, defaultSketchId,
    });
    const { setError: setParameterDialogError } = parameterDialogView;
    const controller = window.ParameterDialogController.create({
      document, window: browserWindow, draft: parameterDraft, view: parameterDialogView,
      scopes: parameterScopeOptions, scopeLocked: () => Boolean(readBlockEditor()),
      apply: () => application.apply(), applicationText, language,
      refreshExpressionInputHighlights, pickDimension,
    });
    const application = window.ParameterDialogController.createApplication({
      draft: parameterDraft, application: { apply: applyDraft }, recordHistory, applicationText, setHint,
      loadScope: controller.loadScope, setError: setParameterDialogError, parameterErrorText, updateUI, draw,
    });
    return Object.freeze({
      draft: parameterDraft, setParameterDialogError, insertIdentifierIntoExpressionInput,
      syncExpressionInputHighlight, installExpressionInputHighlights,
      start: controller.start, dispose: controller.dispose, apply: application.apply,
    });
  }
  window.ParameterEditor = Object.freeze({ create });
})();

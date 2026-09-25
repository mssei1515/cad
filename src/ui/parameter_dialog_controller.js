(() => {
  "use strict";

  function create({ document, window, draft: parameterDraft, view: parameterDialogView,
    scopes: parameterScopeOptions, scopeLocked, apply: applyParameterDialogDraft,
    applicationText, language, refreshExpressionInputHighlights, pickDimension }) {
    const { setError: setParameterDialogError } = parameterDialogView;
    function parameterScopeForKey(key) {
      return parameterScopeOptions().find((option) => option.key === key) || parameterScopeOptions()[0] || null;
    }

    function renderParameterDialog() {
      const session = parameterDraft.current;
      if (!session) return;
      let evaluation = null;
      let evaluationError = null;
      try {
        evaluation = parameterDraft.evaluate(session);
      } catch (error) {
        evaluationError = error;
      }
      parameterDialogView.render({ session, scopes: parameterScopeOptions(),
        scopeLocked: scopeLocked(), evaluation, evaluationError });
    }

    function loadParameterDialogScope(key) {
      const scope = parameterScopeForKey(key);
      if (!scope) return false;
      parameterDraft.open(scope);
      renderParameterDialog();
      return true;
    }

    function resolveDirtyParameterDialog() {
      if (!parameterDraft.isDirty()) return true;
      if (window.confirm(applicationText("未適用の変更を適用しますか？", "Apply the pending changes?"))) return applyParameterDialogDraft();
      return window.confirm(applicationText("未適用の変更を破棄しますか？", "Discard the pending changes?"));
    }

    function openParametersDialog() {
      const options = parameterScopeOptions();
      if (options.length === 0) return;
      loadParameterDialogScope(options[0].key);
      const dialog = document.getElementById("parametersDialog");
      if (dialog && !dialog.open) dialog.showModal();
    }


    let started = false;
    const listeners = [];
    function listen(target, type, handler) {
      if (!target) return;
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    }
    function start() {
      if (started) return;
      started = true;
      listen(document.getElementById("parametersBtn"), "click", openParametersDialog);
      listen(document.getElementById("parameterScopeSelect"), "change", (event) => {
        const previousKey = parameterDraft.current?.key;
        if (!resolveDirtyParameterDialog()) {
          event.target.value = previousKey;
          return;
        }
        loadParameterDialogScope(event.target.value);
      });
      listen(document.getElementById("parametersForm"), "input", (event) => {
        if (!parameterDraft.current) return;
        const input = event.target;
        parameterDraft.updateInput(input.dataset, input.value);
        refreshExpressionInputHighlights(event.currentTarget);
      });
      listen(document.getElementById("parametersForm"), "change", (event) => {
        if (!parameterDraft.current) return;
        const input = event.target;
        parameterDraft.commitName(input.dataset);
        if (input.id !== "parameterScopeSelect") renderParameterDialog();
      });
      listen(document.getElementById("parametersForm"), "click", (event) => {
        const deleteButton = event.target.closest("[data-delete-parameter]");
        if (!deleteButton || !parameterDraft.current) return;
        const index = Number(deleteButton.dataset.deleteParameter);
        const result = parameterDraft.remove(index);
        if (!result) return;
        if (!result.removed) {
          setParameterDialogError(language() === "en" ? `${result.name} is referenced by ${result.dependencies.join(", ")}` : `${result.name} は ${result.dependencies.join("、")} から参照されています`);
          return;
        }
        renderParameterDialog();
      });
      listen(document.getElementById("addParameterBtn"), "click", () => {
        if (parameterDraft.add()) renderParameterDialog();
      });
      listen(document.getElementById("applyParametersBtn"), "click", applyParameterDialogDraft);
      listen(document.getElementById("discardParametersBtn"), "click", () => loadParameterDialogScope(parameterDraft.current?.key));
      listen(document.getElementById("parametersCloseBtn"), "click", () => {
        if (!resolveDirtyParameterDialog()) return;
        document.getElementById("parametersDialog")?.close();
      });
      listen(document.getElementById("parametersDialog"), "pointerdown", (event) => {
        const dialog = event.currentTarget;
        if (event.button !== 0 || event.target !== dialog) return;
        pickDimension(event);
      });
      listen(document.getElementById("parametersDialog"), "cancel", (event) => {
        if (!resolveDirtyParameterDialog()) event.preventDefault();
      });
      listen(document.getElementById("parametersDialog"), "close", () => {
        parameterDraft.close();
      });

    }
    function dispose() {
      listeners.splice(0).forEach(remove => remove());
      started = false;
    }
    return Object.freeze({ start, dispose, open: openParametersDialog,
      render: renderParameterDialog, loadScope: loadParameterDialogScope });
  }
  window.ParameterDialogController = Object.freeze({ create });
})();

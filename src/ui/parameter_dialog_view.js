(() => {
  "use strict";

  // Renders supplied snapshots without editing the document or draft.
  function create({ document, applicationText, escapeHtml, formatDisplayNumber, parameterErrorText,
    localizeApplicationUI, installExpressionInputHighlights, defaultSketchId }) {
    const DEFAULT_SKETCH_ID = defaultSketchId;
    const { isReadOnlyDimension } = window.DimensionQueries;
    function setParameterDialogError(message = "") {
      const error = document.getElementById("parameterDialogError");
      if (!error) return;
      error.hidden = !message;
      error.textContent = message;
    }

    function parameterDimensionSource(dimension, namespace) {
      const constraint = dimension.constraint;
      const sketchId = constraint.sketchId || DEFAULT_SKETCH_ID;
      const sketch = (namespace.sketches || []).find((item) => item.id === sketchId);
      const kind = isReadOnlyDimension(constraint) ? applicationText("参照寸法", "Reference dimension") : applicationText("拘束寸法", "Driving dimension");
      return `${kind} / ${sketch?.name || sketchId}`;
    }

    function render({ session, scopes, scopeLocked, evaluation, evaluationError }) {
      if (!session) return;
      const scopeSelect = document.getElementById("parameterScopeSelect");
      if (scopeSelect) {
        scopeSelect.innerHTML = scopes.map((option) => `<option value="${escapeHtml(option.key)}" ${option.key === session.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
        scopeSelect.disabled = scopeLocked;
      }
      const parameterRows = document.getElementById("parameterRows");
      if (parameterRows) parameterRows.innerHTML = session.parameters.length > 0
        ? session.parameters.map((parameter, index) => `<tr><td><input data-parameter-row="${index}" data-parameter-field="name" value="${escapeHtml(parameter.name)}"></td><td><input data-parameter-row="${index}" data-parameter-field="expression" inputmode="text" value="${escapeHtml(parameter.expression)}"></td><td class="parameter-value">${escapeHtml(formatDisplayNumber(evaluation?.values.get(parameter.name)))}</td><td class="parameter-delete-cell"><button class="compact-button" type="button" data-delete-parameter="${index}">${applicationText("削除", "Delete")}</button></td></tr>`).join("")
        : `<tr><td colspan="4" class="parameter-source">${applicationText("Parameterはありません", "No parameters")}</td></tr>`;
      const dimensionRows = document.getElementById("parameterDimensionRows");
      if (dimensionRows) dimensionRows.innerHTML = session.dimensions.length > 0
        ? session.dimensions.map((dimension, index) => `<tr><td><input data-dimension-row="${index}" data-dimension-field="name" value="${escapeHtml(dimension.name)}"></td><td class="parameter-source">${escapeHtml(parameterDimensionSource(dimension, session.namespace))}</td><td><input data-dimension-row="${index}" data-dimension-field="expression" inputmode="text" value="${escapeHtml(dimension.readOnly ? applicationText("Geometryから測定", "Measured from geometry") : dimension.expression)}" ${dimension.readOnly ? "readonly" : ""}></td><td class="parameter-value">${escapeHtml(formatDisplayNumber(evaluation?.values.get(dimension.name)))}</td></tr>`).join("")
        : `<tr><td colspan="4" class="parameter-source">${applicationText("寸法はありません", "No dimensions")}</td></tr>`;
      setParameterDialogError(evaluationError ? parameterErrorText(evaluationError) : "");
      localizeApplicationUI(document.getElementById("parametersDialog"));
      installExpressionInputHighlights(document.getElementById("parametersDialog"));
    }


    return Object.freeze({ render, setError: setParameterDialogError });
  }

  window.ParameterDialogView = Object.freeze({ create });
})();

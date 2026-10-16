/* Coordinate Canvas references with the currently focused expression input. */
(() => {
  "use strict";
  function create({ document, types: { InputElement, TextAreaElement }, currentNamespace, dimensionValueInput,
    pendingCommandSession, parameterDraft, ensureDimensionParameter, setParameterDialogError,
    setHint, applicationText, language, insertIdentifierIntoExpressionInput }) {
    function focusedExpressionInputContext() {
      const input = document.activeElement;
      if (!(input instanceof InputElement || input instanceof TextAreaElement) || input.readOnly || input.disabled) return null;
      if (input.matches('#commandPanel [data-setting="expression"]') || input.id === "annotationValueInput" && input.dataset.expression === "true") return { input, namespace: currentNamespace() };
      if (input === dimensionValueInput && pendingCommandSession.current?.type === "distance-value") return { input, namespace: currentNamespace() };
      if (input.matches('#propertiesPanel [data-property="constraint-expression"], #propertiesPanel [data-property="annotation-expression"]')) return { input, namespace: currentNamespace() };
      const parameterExpression = input.matches('[data-parameter-field="expression"], [data-dimension-field="expression"]');
      if (parameterExpression && input.closest("#parametersDialog") && parameterDraft.current) {
        return { input, namespace: parameterDraft.current.namespace };
      }
      return null;
    }

    function insertClickedDimensionParameter(event, dimensionHit) {
      const context = focusedExpressionInputContext();
      if (!context || !dimensionHit?.constraint || dimensionHit.constraint.annotationOwner) return false;
      if (context.namespace !== currentNamespace()) {
        const message = applicationText("表示中のCanvasと異なる名前空間のため、この寸法は参照できません", "This dimension cannot be referenced because the canvas shows a different namespace.");
        setParameterDialogError(message);
        setHint(message, "error");
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      ensureDimensionParameter(dimensionHit.constraint, currentNamespace());
      if (!dimensionHit.constraint.parameterName) return false;
      event.preventDefault();
      event.stopPropagation();
      insertIdentifierIntoExpressionInput(context.input, dimensionHit.constraint.parameterName);
      setParameterDialogError("");
      setHint(language() === "en"
        ? `Inserted ${dimensionHit.constraint.parameterName}.`
        : `${dimensionHit.constraint.parameterName} を挿入しました`);
      return true;
    }

    function insertClickedAnnotationParameter(event, annotationHit) {
      const context = focusedExpressionInputContext();
      const item = annotationHit?.element;
      if (!context || !item?.parameterEnabled || !item.parameterName || !currentNamespace().annotations.includes(item)) return false;
      event.preventDefault();
      event.stopPropagation();
      if (context.namespace !== currentNamespace()) {
        const message = applicationText("表示中のCanvasと異なる名前空間のため、この注記は参照できません", "This annotation cannot be referenced because the canvas shows a different namespace.");
        setParameterDialogError(message);
        setHint(message, "error");
        return true;
      }
      insertIdentifierIntoExpressionInput(context.input, item.parameterName);
      setParameterDialogError("");
      setHint(language() === "en" ? `Inserted ${item.parameterName}.` : `${item.parameterName} を挿入しました`);
      return true;
    }
    return Object.freeze({ context: focusedExpressionInputContext, insertDimension: insertClickedDimensionParameter, insertAnnotation: insertClickedAnnotationParameter });
  }
  window.ExpressionInputController = Object.freeze({ create });
})();

/* Compose Properties read presentation, rows, markup and view; editing stays with the controller. */
(() => {
  "use strict";
  function create({ document, documentModel, currentScope, canvasSelection, getOperation, propertySelection,
    geometryAppearance, dimensionAppearance, annotationAppearance, catalog, projections, instances, geometryReads,
    appearanceControls, controller, sketchName, sketchById, isRootSketch, activeSketchId, constraintSketchId,
    sketchProjectionConstraintForTarget, constraintGeometryId, constraintStatusBadge, constraintStatusOf,
    snappedBlockRotation, constraintDefiningGeometryEntries, hatchAppearanceForDisplay, resolvedHatchBoundary,
    applicationText, escapeHtml, hatchRegionErrorText, geometryInstanceTypeLabel, expressionInputValue,
    numericDimensionExpression, localizedConstraintName, localizeApplicationUI, installExpressionInputHighlights }) {
    const { Point, Line, Circle, Arc, Spline, SketchProjectionConstraint } = window.GeometrySolver;
    const { formatDisplayNumber } = window.NumberDisplay;
    const { id: geometryRefId } = window.GeometryRef;
    const { normalizeAppearance, normalizeAnnotationStyle } = window.Appearance;
    const { targetFromConstraint, isReadOnlyDimension, measuredDimensionValue, angleDegrees } = window.DimensionQueries;
    const rows = window.PropertyRows.create({ Point, Line, Circle, Arc, Spline, applicationText, escapeHtml, formatDisplayNumber,
      multiplePropertySameType: propertySelection.multiplePropertySameType, multiplePropertySupports: propertySelection.multiplePropertySupports,
      multiplePropertyValue: propertySelection.multiplePropertyValue, multiplePropertyAppearance: propertySelection.multiplePropertyAppearance,
      mixedValue: window.PropertySelection.mixedValue, colorPickerValue: appearanceControls.colorPickerValue,
      sketchProjectionConstraintForTarget, sketchName, constraintGeometryId, constraintStatusBadge, constraintStatusOf, angleDegrees,
      blockInstanceEnabledSketchSet: catalog.blockInstanceEnabledSketchSet, blockDefinitionSketchRows: catalog.blockDefinitionSketchRows,
      snappedBlockRotation, constraintDefiningGeometryEntries, normalizeAnnotationStyle,
      effectiveAnnotationStyle: annotationAppearance.effectiveAnnotationStyle, leaderAppearancePropertyRows: appearanceControls.leaderAppearancePropertyRows,
    });
    const presentation = window.PropertyPresentation.create({ currentScope, documentModel, canvasSelection, getOperation,
      effectiveAppearanceForElement: geometryAppearance.effectiveAppearanceForElement, sketchName, hatchAppearanceForDisplay, resolvedHatchBoundary,
      blockDefinitionById: catalog.blockDefinitionById, blockProjectionBundle: projections.blockProjectionBundle, normalizeAppearance,
      emptyGeometryInstanceBundle: instances.emptyGeometryInstanceBundle, geometryInstanceBundle: geometryReads.geometryInstanceBundle,
      activeSketchId, targetFromConstraint, dimensionDisplayState: dimensionAppearance.dimensionDisplayState,
      constraintSketchId, isReadOnlyDimension, measuredDimensionValue, angleDegrees, sketchById, isRootSketch,
      effectiveAppearanceForSketch: geometryAppearance.effectiveAppearanceForSketch,
      effectiveConstructionAppearanceForSketch: geometryAppearance.effectiveConstructionAppearanceForSketch,
      effectiveDimensionAppearanceForSketch: dimensionAppearance.effectiveDimensionAppearanceForSketch,
      effectiveLeaderAppearanceForSketch: annotationAppearance.effectiveLeaderAppearanceForSketch, blockDefinitionSketchRows: catalog.blockDefinitionSketchRows,
    });
    const content = window.PropertiesContent.create({ presentation, rows, appearanceControls, Line, SketchProjectionConstraint,
      applicationText, escapeHtml, formatDisplayNumber, hatchRegionErrorText, geometryInstanceTypeLabel, geometryRefId,
      expressionInputValue, numericDimensionExpression, sketchName, localizedConstraintName,
      collapsibleSketchAppearanceSection: (...args) => view.collapsibleSketchAppearanceSection(...args),
    });
    const view = window.PropertiesView.create({ document, applicationText, localizeApplicationUI, installExpressionInputHighlights,
      content: content.render, prepareAffixInputs: appearanceControls.prepareAffixInputs,
      onInput: controller.input, onChange: controller.change, onClick: controller.click });
    return view;
  }
  window.PropertiesDisplay = Object.freeze({ create });
})();

/* Assemble Properties queries, editing commands, shared appearance UI and display around existing owners. */
(() => {
  "use strict";
  function createFeature({ document, documentModel, currentScope, canvasSelection, readServices, sketchContext,
    hatchAppearanceForDisplay, selectionOperation }) {
    const selection = createSelection({ canvasSelection, documentModel, readServices, sketchContext,
      hatchAppearanceForDisplay, getOperation: selectionOperation });
    function createFeatureEditing({ applicationSettings, escapeHtml, updateUI, updatePropertiesUI, draw, ...options }) {
      const { editing, appearanceUI } = createEditing({ ...options, document, documentModel, currentScope,
        propertySelection: selection, readServices, sketchContext, applicationSettings, escapeHtml, updateUI, updatePropertiesUI, draw });
      function createView(options) {
        return createWithController({ ...options, document, documentModel, currentScope, canvasSelection,
          propertySelection: selection, readServices, sketchContext, applicationSettings, escapeHtml, hatchAppearanceForDisplay,
          propertyEditing: editing, appearanceUI, updateUI, updatePropertiesUI, draw });
      }
      return Object.freeze({ editing, appearanceUI, createView });
    }
    return Object.freeze({ selection, createEditing: createFeatureEditing });
  }
  function createEditing({ document, documentModel, currentScope, appearanceScope, viewport, propertySelection, readServices, sketchContext,
    checkpoint, parameterStabilization, guardSketchProjectionShapeEdit, synchronizeSketchProjectionMetadata, materializeAnchor,
    isGeometryMode, toggleSketchVisibility, guardSelectionEdit, applicationSettings, escapeHtml,
    invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw }) {
    const { applicationText, localizeApplicationUI } = applicationSettings;
    const { annotationAppearance } = readServices;
    const editing = window.PropertyEditingFeature.create({ currentScope, viewport, guardSketchProjectionShapeEdit, applicationText,
      synchronizeSketchProjectionMetadata, snapshotModelState: checkpoint.captureValues, restoreModelState: checkpoint.restoreValues,
      stabilizeActiveParameterNamespace: (...args) => parameterStabilization.stabilize(...args), elementSketchId: sketchContext.elementSketchId,
      recordHistory, materializeAnchor, annotationAppearance, invalidateBlockProjectionCache, updateUI, updatePropertiesUI, draw,
      propertySelection, isGeometryMode, selectedVisibilityTargets: () => propertySelection.visibilityTargets(),
      selectionVisibilityIsHidden: targets => propertySelection.visibilityIsHidden(targets), toggleSketchVisibility, guardSelectionEdit });
    const appearanceUI = window.AppearanceUI.create({ document, documentModel, currentScope: appearanceScope, propertySelection,
      appearanceEditing: editing.appearanceEditing, appearancePropertyCommand: editing.appearance, applyMultipleProperty: editing.applyMultiple,
      applicationText, escapeHtml, localizeApplicationUI,
      effectiveLeaderAppearanceForSketch: sketch => annotationAppearance.effectiveLeaderAppearanceForSketch(sketch), readViewportScale: () => viewport.scale,
      invalidateBlockProjectionCache, recordHistory, updateUI, draw });
    return Object.freeze({ editing, appearanceUI });
  }
  function createSelection({ canvasSelection, getOperation, documentModel, readServices, sketchContext, hatchAppearanceForDisplay }) {
    const { Point, Line } = window.GeometrySolver;
    const { normalizeAppearance, normalizeAnnotationStyle, resolveGeometryAppearance } = window.Appearance;
    const { isDimensionConstraint } = window.DimensionQueries;
    const { geometryAppearance, annotationAppearance, dimensionAppearance, catalog, projections, reads } = readServices;
    const { sketchById, sketchName, activeSketchId, isRootSketch } = sketchContext;
    return window.PropertySelection.create({ Point, Line, canvasSelection, getOperation, documentModel,
      effectiveSelectedConstraint: canvasSelection.effectiveSelectedConstraint, selectedGeometryItems: canvasSelection.selectedGeometryItems,
      blockDefinitionById: catalog.blockDefinitionById, sketchById, sketchName, activeSketchId, blockProjectionBundle: projections.blockProjectionBundle,
      effectiveAppearanceForElement: (...args) => geometryAppearance.effectiveAppearanceForElement(...args), normalizeAppearance, hatchAppearanceForDisplay,
      normalizeAnnotationStyle, effectiveAnnotationStyle: element => annotationAppearance.effectiveAnnotationStyle(element),
      effectiveDimensionAppearance: (...args) => dimensionAppearance.effectiveDimensionAppearance(...args),
      isRootSketch, isDimensionConstraint, geometryInstanceBundle: reads.geometryInstanceBundle, resolveGeometryAppearance });
  }
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
  function createWithController({ document, documentModel, currentScope, canvasSelection, getOperation, propertySelection,
    readServices, sketchContext, parameterNamespace, constraintFeedback, blockPlacement, applicationSettings,
    geometryAppearance = readServices?.geometryAppearance, dimensionAppearance = readServices?.dimensionAppearance,
    annotationAppearance = readServices?.annotationAppearance, catalog = readServices?.catalog, projections = readServices?.projections,
    instances = readServices?.instances, geometryReads = readServices?.reads,
    sketchName = sketchContext?.sketchName, sketchById = sketchContext?.sketchById, isRootSketch = sketchContext?.isRootSketch,
    activeSketchId = sketchContext?.activeSketchId, constraintSketchId = sketchContext?.constraintSketchId,
    sketchProjectionConstraintForTarget, constraintGeometryId, constraintStatusBadge = constraintFeedback?.constraintStatusBadge, constraintStatusOf,
    snappedBlockRotation, constraintDefiningGeometryEntries, hatchAppearanceForDisplay, resolvedHatchBoundary,
    applicationText = applicationSettings?.applicationText, escapeHtml, hatchRegionErrorText, geometryInstanceTypeLabel,
    expressionInputValue = parameterNamespace?.expressionInputValue, numericDimensionExpression = parameterNamespace?.numericDimensionExpression,
    localizedConstraintName = constraintFeedback?.localizedConstraintName, localizeApplicationUI = applicationSettings?.localizeApplicationUI, installExpressionInputHighlights,
    propertyEditing, appearanceUI, HTMLTextAreaElement, HTMLInputElement, canEditStructure,
    changeFreeInstanceProperty, commitDimensionPropertyEdit, commitAnnotationParameterEdit, updateUI, updatePropertiesUI, draw, setHint,
    setPlacementRotationLocked = blockPlacement?.setRotationLocked, setPlacementSketchIds = blockPlacement?.setEnabledSketchIds,
    setBlockInstanceRotationLocked, setBlockInstanceEnabledSketchIds, setBlockInstanceOrthogonalRotation,
    annotationCommand, startInstanceSourceEdit, startInstancePlacementEdit, startInstanceAngleDimension, startReferenceImageCalibration, startHatchBoundaryRepair, startSplineEdit }) {
    const { Spline } = window.GeometrySolver;
    const controller = window.PropertiesController.create({
      HTMLTextAreaElement, HTMLInputElement, Spline, selectedPropertiesTarget: propertySelection.selectedDisplayTarget, activeSketchId,
      canEditStructure,
      elementPropertyCommand: propertyEditing.element, appearancePropertyCommand: propertyEditing.appearance,
      geometryPropertyCommand: propertyEditing.geometry, applyMultipleProperty: propertyEditing.applyMultiple,
      changeFreeInstanceProperty, commitDimensionPropertyEdit, commitAnnotationParameterEdit, updateUI, updatePropertiesUI, draw,
      applicationText, setHint, setPlacementRotationLocked, setPlacementSketchIds,
      setBlockInstanceRotationLocked, setBlockInstanceEnabledSketchIds, setBlockInstanceOrthogonalRotation,
      annotationCommand, startInstanceSourceEdit, startInstancePlacementEdit, startInstanceAngleDimension, startReferenceImageCalibration, startHatchBoundaryRepair,
      startSplineEdit, openAppearanceColorPalette: appearanceUI.openPalette,
    });
    return create({
      document, documentModel, currentScope, canvasSelection, getOperation,
      propertySelection, geometryAppearance, dimensionAppearance, annotationAppearance,
      catalog, projections, instances, geometryReads, appearanceControls: appearanceUI.controls, controller,
      sketchName, sketchById, isRootSketch, activeSketchId, constraintSketchId, sketchProjectionConstraintForTarget,
      constraintGeometryId, constraintStatusBadge, constraintStatusOf, snappedBlockRotation, constraintDefiningGeometryEntries,
      hatchAppearanceForDisplay, resolvedHatchBoundary, applicationText, escapeHtml, hatchRegionErrorText,
      geometryInstanceTypeLabel, expressionInputValue, numericDimensionExpression, localizedConstraintName,
      localizeApplicationUI, installExpressionInputHighlights,
    });
  }
  window.PropertiesDisplay = Object.freeze({ create, createFeature, createSelection, createEditing, createWithController });
})();

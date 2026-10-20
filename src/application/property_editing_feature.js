/* Compose property mutation commands and shared value conversion without owning DOM or selection. */
(() => {
  "use strict";
  function create({ currentScope, viewport, guardSketchProjectionShapeEdit, applicationText, synchronizeSketchProjectionMetadata,
    snapshotModelState, restoreModelState, stabilizeActiveParameterNamespace, elementSketchId, recordHistory,
    materializeAnchor, annotationAppearance, invalidateBlockProjectionCache, updateUI, updatePropertiesUI, draw,
    propertySelection, isGeometryMode, selectedVisibilityTargets, selectionVisibilityIsHidden, toggleSketchVisibility, guardSelectionEdit }) {
    const { SplineLineTangentConstraint, SplineSplineTangentConstraint } = window.GeometrySolver;
    const { normalizeAppearance, normalizeAnnotationStyle, normalizeHatchAppearance, normalizeDimensionAppearance,
      DEFAULT_DIMENSION_APPEARANCE, DIMENSION_APPEARANCE_NUMERIC_RULES } = window.Appearance;
    const geometry = window.GeometryPropertyCommand.create({ currentScope, SplineLineTangentConstraint, SplineSplineTangentConstraint,
      guardSketchProjectionShapeEdit, applicationText, synchronizeSketchProjectionMetadata,
      snapshotModelState, restoreModelState, stabilizeActiveParameterNamespace, elementSketchId, recordHistory });
    const appearanceEditing = window.AppearanceEditing.create({ normalizeAppearance, normalizeAnnotationStyle, normalizeHatchAppearance,
      normalizeDimensionAppearance, defaultDimensionAppearance: DEFAULT_DIMENSION_APPEARANCE, dimensionNumericRules: DIMENSION_APPEARANCE_NUMERIC_RULES });
    const appearance = window.AppearancePropertyCommand.create({ materializeAnchor, editing: appearanceEditing, viewport,
      effectiveAnnotationStyle: annotationAppearance.effectiveAnnotationStyle,
      effectiveLeaderAppearanceForSketch: annotationAppearance.effectiveLeaderAppearanceForSketch,
      normalizeHatchAppearance, normalizeAnnotationStyle, invalidateBlockProjectionCache, recordHistory, updateUI, updatePropertiesUI, draw });
    const { apply: applyMultiple } = window.BulkPropertyCommand.create({ appearancePropertyCommand: appearance, viewport,
      guardSketchProjectionShapeEdit, applicationText, updatePropertiesUI, draw, multiplePropertySupports: propertySelection.multiplePropertySupports,
      applyDimensionAppearanceValue: appearanceEditing.applyDimensionAppearanceValue, applyAnnotationStyleValue: appearanceEditing.applyAnnotationStyleValue,
      normalizeHatchAppearance, applyAppearanceInput: appearanceEditing.applyAppearanceInput,
      invalidateBlockProjectionCache, synchronizeSketchProjectionMetadata, recordHistory, updateUI });
    const visibility = window.SelectionVisibilityCommand.create({ isGeometryMode, selectedVisibilityTargets, selectionVisibilityIsHidden,
      toggleSketchVisibility, guardSelectionEdit, applyMultipleProperty: applyMultiple, applyAppearance: appearance.apply, recordHistory, updateUI, draw });
    const element = window.ElementPropertyCommand.create({ materializeAnchor, recordHistory, updateUI, updatePropertiesUI, draw });
    return Object.freeze({ geometry, appearanceEditing, appearance, applyMultiple, visibility, element });
  }
  window.PropertyEditingFeature = Object.freeze({ create });
})();

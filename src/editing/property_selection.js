/* Resolve property targets, supported fields and common effective values. */
(() => {
  "use strict";
  const MULTIPLE_PROPERTY_MIXED = Symbol("multiple-property-mixed");
  function create({ Point, Line, canvasSelection, getOperation, effectiveSelectedConstraint,
    selectedGeometryItems, blockDefinitionById, sketchById, activeSketchId, blockProjectionBundle,
    effectiveAppearanceForElement, documentModel, normalizeAppearance, hatchAppearanceForDisplay,
    normalizeAnnotationStyle }) {
    function selectedPropertiesTarget() {
      const { mode, instanceSourceEdit, freeInstancePlacement, blockPlacementDefinitionId } = getOperation();
      if (mode === "instance-sources" && instanceSourceEdit) return { kind: "geometryInstance", item: instanceSourceEdit.instance };
      if (freeInstancePlacement) return { kind: "geometryInstance", item: freeInstancePlacement };
      if (mode === "block-place" && blockPlacementDefinitionId) return { kind: "blockPlacement", item: blockDefinitionById(blockPlacementDefinitionId) };
      const constraint = canvasSelection.dimensionConstraint || effectiveSelectedConstraint();
      if (constraint) return { kind: "constraint", item: constraint };
      if (canvasSelection.geometryInstances.length === 1 && canvasSelection.referenceImages.length === 0 && canvasSelection.hatches.length === 0 && canvasSelection.annotations.length === 0 && canvasSelection.blockInstances.length === 0 && selectedGeometryItems().length === 0) return { kind: "geometryInstance", item: canvasSelection.geometryInstances[0] };
      if (canvasSelection.referenceImages.length === 1 && canvasSelection.hatches.length === 0 && canvasSelection.annotations.length === 0 && canvasSelection.blockInstances.length === 0 && canvasSelection.geometryInstances.length === 0 && selectedGeometryItems().length === 0) return { kind: "referenceImage", item: canvasSelection.referenceImages[0] };
      if (canvasSelection.hatches.length === 1 && canvasSelection.referenceImages.length === 0 && canvasSelection.annotations.length === 0 && canvasSelection.blockInstances.length === 0 && canvasSelection.geometryInstances.length === 0 && selectedGeometryItems().length === 0) return { kind: "hatch", item: canvasSelection.hatches[0] };
      if (canvasSelection.annotations.length === 1 && canvasSelection.referenceImages.length === 0 && canvasSelection.hatches.length === 0 && canvasSelection.blockInstances.length === 0 && canvasSelection.geometryInstances.length === 0 && selectedGeometryItems().length === 0) return { kind: "annotation", item: canvasSelection.annotations[0] };
      if (canvasSelection.blockInstances.length === 1 && canvasSelection.referenceImages.length === 0 && canvasSelection.geometryInstances.length === 0 && selectedGeometryItems().length === 0 && canvasSelection.annotations.length === 0 && canvasSelection.hatches.length === 0) return { kind: "block", item: canvasSelection.blockInstances[0] };
      const geometry = selectedGeometryItems();
      if (geometry.length === 1 && canvasSelection.referenceImages.length === 0 && canvasSelection.blockInstances.length === 0 && canvasSelection.geometryInstances.length === 0 && canvasSelection.annotations.length === 0 && canvasSelection.hatches.length === 0) return { kind: "geometry", item: geometry[0] };
      const multipleItems = [
        ...geometry.map((item) => ({ kind: "geometry", item })),
        ...canvasSelection.blockInstances.map((item) => ({ kind: "block", item })),
        ...canvasSelection.geometryInstances.map((item) => ({ kind: "geometryInstance", item })),
        ...canvasSelection.annotations.map((item) => ({ kind: "annotation", item })),
        ...canvasSelection.hatches.map((item) => ({ kind: "hatch", item })),
      ];
      if (multipleItems.length > 1) return { kind: "multiple", count: multipleItems.length, items: multipleItems };
      return { kind: "sketch", item: sketchById(activeSketchId()) };
    }

    function multiplePropertyTypeKey(target) {
      if (target.kind === "geometry") return `${target.kind}:${target.item?.constructor?.name || "Geometry"}`;
      if (target.kind === "annotation") return `${target.kind}:${target.item?.type || "annotation"}`;
      return target.kind;
    }

    function multiplePropertySameType(target) {
      return new Set((target.items || []).map(multiplePropertyTypeKey)).size === 1;
    }

    function blockPropertyAppearance(item) {
      const bundle = blockProjectionBundle(item);
      const projected = [...(bundle.points || []), ...(bundle.lines || []), ...(bundle.circles || []), ...(bundle.arcs || []), ...(bundle.splines || [])][0];
      return projected
        ? effectiveAppearanceForElement(projected)
        : { ...normalizeAppearance(documentModel.defaultAppearance, { partial: false }), ...normalizeAppearance(item.appearanceOverride) };
    }

    function multiplePropertyAppearance(target) {
      if (target.kind === "geometry") return effectiveAppearanceForElement(target.item);
      if (target.kind === "block") return blockPropertyAppearance(target.item);
      if (target.kind === "hatch") return hatchAppearanceForDisplay(target.item);
      if (target.kind === "annotation") return { ...normalizeAnnotationStyle(target.item.style), visible: target.item.visible !== false };
      return {};
    }

    function multiplePropertySupports(target, key) {
      if (key === "visible" || key === "color") return true;
      if (key === "lineType") return target.kind === "geometry" || target.kind === "block" || (target.kind === "annotation" && target.item.type === "leader");
      if (key === "lineWidth") return target.kind === "geometry" || target.kind === "block" || (target.kind === "hatch" && target.item.appearance?.patternType !== "solid") || (target.kind === "annotation" && target.item.type === "leader");
      if (key === "construction") return target.kind === "geometry" && !(target.item instanceof Point);
      if (key === "endpointOverhang" || key === "endpointMarkers") return target.kind === "geometry" && target.item instanceof Line && target.item.construction;
      if (["patternType", "angle", "spacing", "opacity"].includes(key)) return target.kind === "hatch";
      if (["textHeight", "fontFamily", "bold", "italic", "textAlign", "rotation"].includes(key)) return target.kind === "annotation";
      if (["terminatorType", "terminatorSize"].includes(key)) return target.kind === "annotation" && target.item.type === "leader";
      return false;
    }

    function multiplePropertyValue(target, key) {
      const values = (target.items || []).map((entry) => {
        if (key === "construction") return Boolean(entry.item.construction);
        if (key === "rotation") return (Number(entry.item.rotation) || 0) * 180 / Math.PI;
        const appearance = multiplePropertyAppearance(entry);
        return key === "opacity" ? Number(appearance.opacity) * 100 : appearance[key];
      });
      if (values.length === 0) return MULTIPLE_PROPERTY_MIXED;
      return values.every((value) => Object.is(value, values[0])) ? values[0] : MULTIPLE_PROPERTY_MIXED;
    }

    return Object.freeze({ selectedPropertiesTarget, multiplePropertyTypeKey, multiplePropertySameType, blockPropertyAppearance, multiplePropertyAppearance, multiplePropertySupports, multiplePropertyValue });
  }
  window.PropertySelection = Object.freeze({ create, mixedValue: MULTIPLE_PROPERTY_MIXED });
})();

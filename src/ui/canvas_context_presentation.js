/* Context candidate labels and icons; no geometry ranking or menu session. */
(() => {
  "use strict";
  function create({ toolbarSvgMarkup, applicationText, formatDisplayNumber, constraintToolbarIcon, localizedConstraintName,
    blockDefinitionById, geometryInstanceTypeLabel, hatchPatternTypeLabel, hatchAppearanceForDisplay }) {
    function canvasContextCandidatePresentation(target) {
      const item = target.item;
      if (target.kind === "point") return {
        icon: toolbarSvgMarkup("#toolPoint"),
        type: applicationText("点", "Point"),
        id: item.id,
        secondary: `X ${formatDisplayNumber(item.x)} / Y ${formatDisplayNumber(item.y)}`,
      };
      if (target.kind === "arc-endpoint") return {
        icon: toolbarSvgMarkup("#toolArc"),
        type: applicationText("円弧端点", "Arc Endpoint"),
        id: item.id,
        secondary: target.endpoint === "start" ? applicationText("始点", "Start") : applicationText("終点", "End"),
      };
      if (target.kind === "line") return {
        icon: toolbarSvgMarkup("#toolLine"),
        type: applicationText("線", "Line"),
        id: item.id,
        secondary: `${item.p1.id}–${item.p2.id}`,
      };
      if (target.kind === "circle" || target.kind === "arc") return {
        icon: toolbarSvgMarkup(target.kind === "circle" ? "#toolCircle" : "#toolArc"),
        type: target.kind === "circle" ? applicationText("円", "Circle") : applicationText("円弧", "Arc"),
        id: item.id,
        secondary: `${applicationText("中心", "Center")} ${item.center.id} / R ${formatDisplayNumber(item.radius())}`,
      };
      if (target.kind === "spline") return {
        icon: toolbarSvgMarkup("#toolSpline"),
        type: applicationText("スプライン", "Spline"),
        id: item.id,
        secondary: `${item.fitPoints.length} ${applicationText("通過点", "fit points")}`,
      };
      if (target.kind === "dimension") return {
        icon: constraintToolbarIcon(item),
        type: applicationText("寸法", "Dimension"),
        id: item.parameterName || "—",
        secondary: localizedConstraintName(item.name),
      };
      if (target.kind === "annotation") return {
        icon: toolbarSvgMarkup(item.type === "leader" ? "#annotationLeaderBtn" : "#annotationTextBtn"),
        type: item.type === "leader" ? applicationText("引出線", "Leader") : applicationText("自由テキスト", "Free Text"),
        id: item.id,
        secondary: String(item.text || "").slice(0, 40),
      };
      if (target.kind === "block") return {
        icon: toolbarSvgMarkup("#toolCreateBlock"),
        type: applicationText("ブロック", "Block"),
        id: item.id,
        secondary: blockDefinitionById(item.definitionId)?.name || item.definitionId,
      };
      if (target.kind === "geometry-instance") return {
        icon: toolbarSvgMarkup(target.item.type === "free" ? "#toolFreeInstance" : target.item.type === "mirror" ? "#toolMirror" : target.item.type === "pattern" ? "#toolPattern" : "#toolSketchProjection"),
        type: applicationText("派生インスタンス", "Derived Instance"),
        id: item.id,
        secondary: geometryInstanceTypeLabel(item.type),
      };
      return {
        icon: toolbarSvgMarkup("#toolHatch"),
        type: applicationText("ハッチング", "Hatch"),
        id: item.id,
        secondary: hatchPatternTypeLabel(hatchAppearanceForDisplay(item).patternType),
      };
    }

    return canvasContextCandidatePresentation;
  }
  window.CanvasContextPresentation = Object.freeze({ create });
})();

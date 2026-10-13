/* Context candidate labels and menu items; no geometry ranking, editing or menu session. */
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
        icon: toolbarSvgMarkup(item.type === "leader" ? "#annotationLeaderIcon" : "#annotationTextBtn"),
        type: applicationText("注記", "Annotation"),
        id: item.id,
        secondary: String(item.text || "").slice(0, 40),
      };
      if (target.kind === "block") return {
        icon: toolbarSvgMarkup("#toolCreateBlock"),
        type: applicationText("ブロック", "Block"),
        id: item.id,
        secondary: blockDefinitionById(item.definitionId)?.name || item.definitionId,
      };
      if (target.kind === "image") return {
        icon: toolbarSvgMarkup("#importReferenceImageBtn"),
        type: applicationText("参照画像", "Reference Image"),
        id: item.id,
        secondary: item.name || "",
      };
      if (target.kind === "geometry-instance") return {
        icon: toolbarSvgMarkup(target.item.type === "mirror" ? "#toolMirror" : target.item.type === "circularPattern" ? "#toolCircularPattern" : Boolean(target.item.placement) ? "#toolPattern" : "#toolSketchProjection"),
        type: applicationText("派生インスタンス", "Derived Instance"),
        id: item.id,
        secondary: geometryInstanceTypeLabel(item.type),
      };
      return {
        icon: toolbarSvgMarkup("#toolHatch"),
        type: applicationText("塗りつぶし", "Fill"),
        id: item.id,
        secondary: hatchPatternTypeLabel(hatchAppearanceForDisplay(item).patternType),
      };
    }

    return canvasContextCandidatePresentation;
  }
  function createItems({ readMode, sketchProjectionCommand, applicationText, document, canCreateInActiveSketch, visibleGeometryBounds, pendingCommandSession, constraintTargetSession, splineEditing, isReadOnlyDimension, selectedDimensionLineGroup, blockDefinitionScopeError, blockDefinitionEditError, canvasContextFixState, selectedConstructionTogglePrimitives, canvasSelection, selectedGeometryItems, drawingOrderCommandState, hasCopyableCanvasSelection, hasSelection }) {
    function items(target, commandActive = false) {
      const groups = [];
      if (commandActive) {
        if (readMode() === "sketch-projection") {
          groups.push([{ action: "sketch-projection-commit", label: applicationText("実行", "Execute"), shortcut: "Enter", disabled: sketchProjectionCommand.count === 0 }]);
        }
        groups.push([{ action: "cancel-command", label: applicationText("コマンドをキャンセル", "Cancel Command"), shortcut: "Esc" }]);
        groups.push([
          { action: "undo", label: applicationText("元に戻す", "Undo"), shortcut: "Ctrl+Z", disabled: Boolean(document.getElementById("undoBtn")?.disabled) },
          { action: "redo", label: applicationText("やり直す", "Redo"), shortcut: "Ctrl+Y", disabled: Boolean(document.getElementById("redoBtn")?.disabled) },
        ]);
      } else if (target.kind === "blank") {
        groups.push([{ action: "paste", label: applicationText("貼り付け", "Paste"), shortcut: "Ctrl+V", disabled: !canCreateInActiveSketch() }]);
        groups.push([
          { action: "undo", label: applicationText("元に戻す", "Undo"), shortcut: "Ctrl+Z", disabled: Boolean(document.getElementById("undoBtn")?.disabled) },
          { action: "redo", label: applicationText("やり直す", "Redo"), shortcut: "Ctrl+Y", disabled: Boolean(document.getElementById("redoBtn")?.disabled) },
        ]);
        groups.push([{ action: "fit-visible", label: applicationText("表示中図形へフィット", "Fit Visible Geometry"), disabled: !visibleGeometryBounds() }]);
      } else {
        const specific = [];
        if (["point", "line", "circle", "arc", "spline", "block", "hatch", "annotation", "image"].includes(target.kind)) {
          specific.push({ action: "sketch-move", label: applicationText("別スケッチへ移動…", "Move to Another Sketch…"), disabled: readMode() !== "select" || Boolean(pendingCommandSession.current || constraintTargetSession.command) });
        }
        const editingFitPoint = target.kind === "point" && Boolean(splineEditing.current?.spline?.fitPoints.includes(target.item));
        if (target.kind === "spline" && splineEditing.current?.spline === target.item) {
          specific.push({ action: "spline-fit-point-add", label: applicationText("通過点を追加", "Add Fit Point") });
        }
        if (editingFitPoint) {
          specific.push({ action: "spline-fit-point-delete", label: applicationText("通過点を削除", "Delete Fit Point"), disabled: splineEditing.current.spline.fitPoints.length <= 3, danger: true });
        }
        if (target.kind === "dimension") {
          specific.push({ action: "dimension-edit", label: applicationText("値 / 数式を編集", "Edit Value / Expression"), disabled: isReadOnlyDimension(target.item) });
          specific.push({ action: "dimension-align", label: applicationText("寸法線を揃える", "Align Dimension Lines"), disabled: !selectedDimensionLineGroup(target.item) });
        }
        if (target.kind === "block") {
          specific.push({ action: "block-edit", label: applicationText("ブロック定義を編集", "Edit Block Definition"), disabled: Boolean(blockDefinitionScopeError(target.item.definitionId) || blockDefinitionEditError(target.item.definitionId)) });
          specific.push({ action: "block-rotation-toggle", label: target.item.rotationLocked ? applicationText("自由回転", "Free Rotation") : applicationText("直交回転ロック", "Lock Orthogonal Rotation"), disabled: Boolean(target.item.fixed) });
        }
        if (target.kind === "hatch") specific.push({ action: "hatch-repair", label: applicationText("境界を再指定", "Reselect Boundary") });
        const fix = editingFitPoint ? null : canvasContextFixState(target);
        if (fix) specific.push({ action: "fix-toggle", label: fix.fixed ? applicationText("固定解除", "Unfix") : applicationText("固定", "Fix"), disabled: !fix.enabled });
        if (["line", "circle", "arc", "spline"].includes(target.kind)) {
          const primitives = selectedConstructionTogglePrimitives();
          const construction = primitives.length > 0 && primitives.every((item) => item.construction);
          specific.push({ action: "construction-toggle", label: construction ? applicationText("実線に変更", "Convert to Normal") : applicationText("補助線に変更", "Convert to Construction"), disabled: primitives.length === 0 });
          if (target.kind !== "spline") specific.push({ action: "offset", label: applicationText("ここからオフセット", "Offset from Here"), disabled: primitives.length !== 1 });
          if (target.kind === "line") specific.push({ action: "fillet", label: applicationText("R面取り", "Fillet"), disabled: canvasSelection.lines.length !== 2 || canvasSelection.points.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.blockInstances.length > 0 });
        }
        if (!editingFitPoint && ["point", "line", "circle", "arc", "spline"].includes(target.kind)) {
          specific.push({ action: "add-leader", label: applicationText("引出線を追加", "Add Leader"), disabled: selectedGeometryItems().length !== 1 || canvasSelection.blockInstances.length + canvasSelection.annotations.length > 0 });
        }
        if (["line", "circle", "arc", "spline", "hatch", "block", "annotation"].includes(target.kind)) {
          const canCreateBlock = canvasSelection.lines.length + canvasSelection.circles.length + canvasSelection.arcs.length + canvasSelection.splines.length + canvasSelection.hatches.length + canvasSelection.blockInstances.length + canvasSelection.annotations.length > 0;
          specific.push({ action: "create-block", label: applicationText("選択からブロック作成", "Create Block from Selection"), disabled: !canCreateBlock || !canCreateInActiveSketch() });
        }
        if (specific.length > 0) groups.push(specific);
        if (["line", "circle", "arc", "spline", "hatch", "block", "geometry-instance"].includes(target.kind)) {
          const orderState = drawingOrderCommandState();
          groups.push([
            { action: "drawing-front", label: applicationText("最前面へ", "Bring to Front"), disabled: !orderState.canForward },
            { action: "drawing-forward", label: applicationText("1つ前面へ", "Bring Forward"), disabled: !orderState.canForward },
            { action: "drawing-backward", label: applicationText("1つ背面へ", "Send Backward"), disabled: !orderState.canBackward },
            { action: "drawing-back", label: applicationText("最背面へ", "Send to Back"), disabled: !orderState.canBackward },
          ]);
        }
        if (!editingFitPoint) {
          const copyable = hasCopyableCanvasSelection();
          groups.push([
            { action: "cut", label: applicationText("切り取り", "Cut"), shortcut: "Ctrl+X", disabled: !copyable },
            { action: "copy", label: applicationText("コピー", "Copy"), shortcut: "Ctrl+C", disabled: !copyable },
            { action: "delete", label: applicationText("削除", "Delete"), shortcut: "Del", disabled: !hasSelection(), danger: true },
          ]);
        }
        groups.push([{ action: "show-properties", label: applicationText("プロパティを表示", "Show Properties") }]);
      }
      return groups.flatMap((group, groupIndex) => [
        ...(groupIndex > 0 ? [{ separator: true }] : []),
        ...group,
      ]);
    }
    return Object.freeze({ items });
  }

  window.CanvasContextPresentation = Object.freeze({ create, createItems });
})();

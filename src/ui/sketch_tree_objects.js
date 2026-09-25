/* Present sketch-owned objects and constraint summaries without owning UI or edit state. */
(() => {
  "use strict";
  function create({ currentScope, getLanguage, ensureAnalysis, types,
    isExplicitPoint, isPointUsedByLine, elementSketchId, constraintSketchId,
    constraintStatusOf, blockProjectionBundle, applicationText, escapeHtml, formatDisplayNumber,
    toolbarSvgMarkup, constraintToolbarIcon, sketchTreeGutter, isSketchProjectedGeometry,
    findLineFixedConstraint, blockDefinitionById, geometryInstanceTypeLabel, geometryInstanceBundle,
    resolvedHatchBoundary, hatchPatternTypeLabel, hatchAppearanceForDisplay,
    isDimensionConstraint, localizedConstraintName, constraintGeometryId, isReadOnlyDimension,
    constraintIsRedundant, referenceConstraintErrorInfo, sketchTreeObjectSelected, sketchTreeObjectHovered,
    constraintDirectlyReferencesCanvasSelection, selectedConstraintReferenceElements }) {
    const { ParallelLinesCenterlineConstraint, PointPairCenterlineConstraint, SketchProjectionConstraint } = types;
    function sketchTreeObjectIndex() {
      const model = currentScope();
      const index = new Map(model.sketches.map((sketch) => [sketch.id, { point: [], line: [], circle: [], arc: [], spline: [], hatch: [], image: [], block: [], instance: [], constraint: [], annotation: [] }]));
      const group = (sketchId, category) => index.get(sketchId)?.[category];
      for (const point of model.points) if ((isExplicitPoint(point) || isPointUsedByLine(point)) && group(elementSketchId(point), "point")) group(elementSketchId(point), "point").push(point);
      for (const line of model.lines) group(elementSketchId(line), "line")?.push(line);
      for (const circle of model.circles) group(elementSketchId(circle), "circle")?.push(circle);
      for (const arc of model.arcs) group(elementSketchId(arc), "arc")?.push(arc);
      for (const spline of model.splines) group(elementSketchId(spline), "spline")?.push(spline);
      for (const hatch of model.hatches) group(hatch.sketchId, "hatch")?.push(hatch);
      for (const image of model.referenceImages) group(image.sketchId, "image")?.push(image);
      for (const block of model.blockInstances) group(block.sketchId, "block")?.push(block);
      for (const instance of model.geometryInstances) group(instance.sketchId, "instance")?.push(instance);
      model.constraints.forEach((constraint, modelIndex) => group(constraintSketchId(constraint), "constraint")?.push({ kind: "constraint", constraint, modelIndex }));
      for (const point of model.points.filter((item) => item.fixed)) group(elementSketchId(point), "constraint")?.push({ kind: "fixed-point", point });
      for (const annotation of model.annotations) group(annotation.sketchId, "annotation")?.push(annotation);
      return index;
    }

    function sketchConstraintSummaryCounts(sketchId, groups) {
      const model = currentScope();
      ensureAnalysis();
      const statuses = [
        ...groups.point.map(constraintStatusOf), ...groups.line.map(constraintStatusOf), ...groups.circle.map(constraintStatusOf), ...groups.arc.map(constraintStatusOf), ...groups.spline.map(constraintStatusOf),
        ...model.blockInstances.filter((instance) => instance.sketchId === sketchId).flatMap((instance) => {
          const bundle = blockProjectionBundle(instance);
          return [...bundle.lines, ...bundle.circles, ...bundle.arcs, ...(bundle.splines || [])].map(constraintStatusOf);
        }),
      ];
      const count = (status) => statuses.filter((item) => item === status).length;
      return { full: count("full"), support: count("support"), under: count("under"), conflict: count("conflict") };
    }

    function sketchConstraintSummaryText(sketchId, groups) {
      const counts = sketchConstraintSummaryCounts(sketchId, groups);
      return getLanguage() === "en"
        ? `Fully constrained: ${counts.full} / Supported position: ${counts.support} / Under-constrained: ${counts.under} / Conflict: ${counts.conflict}`
        : `完全拘束: ${counts.full} / 支持位置拘束: ${counts.support} / 未拘束: ${counts.under} / 矛盾: ${counts.conflict}`;
    }

    function sketchConstraintSummaryMarkup(sketchId, groups, segments) {
      const counts = sketchConstraintSummaryCounts(sketchId, groups);
      const items = getLanguage() === "en"
        ? [["full", "Full"], ["support", "Support"], ["under", "Under"], ["conflict", "Conflict"]]
        : [["full", "完全"], ["support", "支持"], ["under", "未拘束"], ["conflict", "矛盾"]];
      const content = items.map(([status, label]) => `<span class="sketch-tree-summary-item status-${status}"><span class="sketch-tree-summary-dot" aria-hidden="true"></span><span>${label}</span><strong>${counts[status]}</strong></span>`).join("");
      return `<div class="sketch-tree-summary" title="${escapeHtml(sketchConstraintSummaryText(sketchId, groups))}">${sketchTreeGutter(segments)}<span class="sketch-tree-summary-content">${content}</span></div>`;
    }

    function sketchTreeObjectRow(category, entry, segments, sketchId) {
      const model = currentScope();
      const deleteSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>';
      let icon = "";
      let primary = "";
      let secondary = "";
      let badges = "";
      let action = "";
      let data = `data-object-kind="${category}"`;
      if (category === "point") {
        icon = toolbarSvgMarkup("#toolPoint"); primary = entry.id; secondary = `X ${formatDisplayNumber(entry.x)} / Y ${formatDisplayNumber(entry.y)}`;
        if (entry.fixed) badges += `<span class="badge">${applicationText("固定", "Fixed")}</span>`;
        if (isSketchProjectedGeometry(entry)) badges += `<span class="badge">${applicationText("投影", "Projected")}</span>`;
        action = `<button data-id="${escapeHtml(entry.id)}" class="removePointBtn icon-delete-btn" title="${applicationText("削除", "Delete")}" aria-label="${applicationText("削除", "Delete")}">${deleteSvg}</button>`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (category === "line") {
        const isCenterline = model.constraints.some((constraint) =>
          (constraint instanceof ParallelLinesCenterlineConstraint || constraint instanceof PointPairCenterlineConstraint) && constraint.centerline === entry);
        icon = toolbarSvgMarkup(isCenterline ? "#toolCenterline" : "#toolLine"); primary = entry.id; secondary = `${entry.p1.id}–${entry.p2.id}`;
        if (isCenterline) badges += `<span class="badge">${applicationText("中心線", "Centerline")}</span>`;
        else if (entry.construction) badges += `<span class="badge">${applicationText("補助", "Construction")}</span>`;
        if (findLineFixedConstraint(entry)) badges += `<span class="badge">${applicationText("固定", "Fixed")}</span>`;
        if (isSketchProjectedGeometry(entry)) badges += `<span class="badge">${applicationText("投影", "Projected")}</span>`;
        action = `<button data-id="${escapeHtml(entry.id)}" class="removeLineBtn icon-delete-btn" title="${applicationText("削除", "Delete")}" aria-label="${applicationText("削除", "Delete")}">${deleteSvg}</button>`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (category === "circle" || category === "arc") {
        icon = toolbarSvgMarkup(category === "circle" ? "#toolCircle" : "#toolArc"); primary = entry.id; secondary = `${applicationText("中心", "Center")} ${entry.center.id} / R ${formatDisplayNumber(entry.radius())}`;
        if (entry.construction) badges += `<span class="badge">${applicationText("補助", "Construction")}</span>`;
        if (isSketchProjectedGeometry(entry)) badges += `<span class="badge">${applicationText("投影", "Projected")}</span>`;
        action = `<button data-id="${escapeHtml(entry.id)}" class="${category === "circle" ? "removeCircleBtn" : "removeArcBtn"} icon-delete-btn" title="${applicationText("削除", "Delete")}" aria-label="${applicationText("削除", "Delete")}">${deleteSvg}</button>`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (category === "spline") {
        icon = toolbarSvgMarkup("#toolSpline"); primary = entry.id; secondary = `${entry.fitPoints.length} ${applicationText("通過点", "fit points")}${entry.closed ? ` / ${applicationText("閉じる", "Closed")}` : ""}`;
        if (entry.construction) badges += `<span class="badge">${applicationText("補助", "Construction")}</span>`;
        if (isSketchProjectedGeometry(entry)) badges += `<span class="badge">${applicationText("投影", "Projected")}</span>`;
        action = `<button data-id="${escapeHtml(entry.id)}" class="removeSplineBtn icon-delete-btn" title="${applicationText("削除", "Delete")}" aria-label="${applicationText("削除", "Delete")}">${deleteSvg}</button>`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (category === "block") {
        icon = toolbarSvgMarkup("#toolCreateBlock"); primary = entry.id; secondary = blockDefinitionById(entry.definitionId)?.name || entry.definitionId;
        if (entry.fixed) badges += `<span class="badge">${applicationText("固定", "Fixed")}</span>`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (category === "instance") {
        icon = toolbarSvgMarkup(entry.type === "free" ? "#toolFreeInstance" : entry.type === "mirror" ? "#toolMirror" : entry.type === "pattern" ? "#toolPattern" : "#toolSketchProjection");
        primary = entry.id;
        secondary = entry.type === "pattern" ? applicationText(`直線パターン ${entry.copies}個`, `Linear Pattern ${entry.copies} copies`) : geometryInstanceTypeLabel(entry.type);
        const bundle = geometryInstanceBundle(entry);
        if (!bundle.valid) badges += `<span class="badge constraint-reference-error-badge">${applicationText("参照エラー", "Reference error")}</span>`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (category === "hatch") {
        const resolved = resolvedHatchBoundary(entry);
        icon = toolbarSvgMarkup("#toolHatch"); primary = entry.id; secondary = hatchPatternTypeLabel(hatchAppearanceForDisplay(entry).patternType);
        if (!resolved.ok) badges += `<span class="badge constraint-reference-error-badge">${applicationText("境界エラー", "Boundary error")}</span>`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (category === "image") {
        icon = toolbarSvgMarkup("#importReferenceImageBtn"); primary = entry.name; secondary = `${entry.pixelWidth} × ${entry.pixelHeight}px`;
        if (entry.visible === false) badges += `<span class="badge">${applicationText("非表示", "Hidden")}</span>`;
        if (entry.locked) badges += `<span class="badge">${applicationText("固定", "Locked")}</span>`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (category === "annotation") {
        icon = toolbarSvgMarkup(entry.type === "leader" ? "#annotationLeaderBtn" : "#annotationTextBtn"); primary = entry.id;
        secondary = `${entry.type === "leader" ? applicationText("引出線", "Leader") : applicationText("テキスト", "Text")} ${String(entry.text || "").slice(0, 28)}`;
        data += ` data-id="${escapeHtml(entry.id)}"`;
      } else if (entry.kind === "fixed-point") {
        icon = constraintToolbarIcon(null, true); primary = entry.point.id; secondary = applicationText("固定", "Fixed");
        action = `<button data-id="${escapeHtml(entry.point.id)}" class="removeFixedPointBtn icon-delete-btn" title="${applicationText("固定解除", "Unfix")}" aria-label="${applicationText("固定解除", "Unfix")}">${deleteSvg}</button>`;
        data += ` data-fixed-point-id="${escapeHtml(entry.point.id)}"`;
      } else {
        const constraint = entry.constraint;
        icon = constraintToolbarIcon(constraint);
        primary = constraint instanceof SketchProjectionConstraint
          ? applicationText("スケッチ投影", "Sketch Projection")
          : isDimensionConstraint(constraint) ? constraint.parameterName || "—" : localizedConstraintName(constraint.name);
        secondary = constraint instanceof SketchProjectionConstraint
          ? `${constraintGeometryId(constraint.source) || "—"} → ${constraintGeometryId(constraint.target) || "—"}`
          : isDimensionConstraint(constraint) ? localizedConstraintName(constraint.name) : "";
        if (isReadOnlyDimension(constraint)) badges += `<span class="badge">${applicationText("読み取り専用", "Read-only")}</span>`;
        if (constraintIsRedundant(constraint)) badges += `<span class="badge">${applicationText("重複", "Duplicate")}</span>`;
        if (referenceConstraintErrorInfo(constraint)) badges += `<span class="badge constraint-reference-error-badge">${applicationText("参照エラー", "Reference error")}</span>`;
        action = `<button data-idx="${entry.modelIndex}" class="removeConstraintBtn" title="${applicationText("削除", "Delete")}" aria-label="${applicationText("削除", "Delete")}">${deleteSvg}</button>`;
        data += ` data-constraint-index="${entry.modelIndex}"`;
      }
      const selected = sketchTreeObjectSelected(category, entry);
      const hovered = sketchTreeObjectHovered(category, entry);
      const related = category === "constraint" && entry.kind !== "fixed-point"
        ? constraintDirectlyReferencesCanvasSelection(entry.constraint, selectedConstraintReferenceElements())
        : false;
      const title = `${primary}${secondary ? ` — ${secondary}` : ""}`;
      return `<div class="sketch-object-row ${selected ? "selected sidebar-selected" : ""} ${hovered || related ? "sidebar-related" : ""}" ${data} data-sketch-id="${escapeHtml(sketchId)}" title="${escapeHtml(title)}">${sketchTreeGutter(segments)}${icon}<span class="sketch-object-content"><span class="sketch-object-primary">${escapeHtml(primary)}</span><span class="sketch-object-secondary">${escapeHtml(secondary)}</span>${badges}</span><span class="sketch-object-actions">${action}</span></div>`;
    }

    return Object.freeze({ index: sketchTreeObjectIndex, row: sketchTreeObjectRow,
      summary: sketchConstraintSummaryMarkup, summaryCounts: sketchConstraintSummaryCounts,
      selected: sketchTreeObjectSelected, hovered: sketchTreeObjectHovered });
  }
  window.SketchTreeObjects = Object.freeze({ create });
})();

/* Route sketch tree actions to selection, editing commands and expansion state. */
(() => {
  "use strict";
  function create({ currentScope, activeSketchId, setActiveSketch, clearSelection, canvasSelection,
    sidebarGeometryItem, toggleBlockInstanceSelection, targetFromConstraint, updateUI, draw,
    sketchTreeView, updateSketchUI, toggleSketchVisibility, renameSketch, deleteSketch, deleteElements, unfixPoint,
    resolveSelectionEntry, updateSelectionUI = updateUI, hover = {} }) {
    const { canvasHover, setSidebarHover, clearSidebarHover, sidebarHoverElementsForItem, sidebarHoverElementsForConstraint, elementSketchId, ROOT_SKETCH_ID } = hover;
    let hoveredSketchTreeId = null;
    function selectSketch(sketchId) {
      if (!currentScope().sketches.some((sketch) => sketch.id === sketchId)) return;
      clearSelection();
      canvasSelection.set("sketchId", sketchId);
      updateSelectionUI();
      draw();
    }

    function inspectObject(row, additive) {
      const data = row.dataset, category = data.objectKind;
      const entry = resolveSelectionEntry(data);
      if (!entry) return;
      const item = category === "constraint" ? entry.point || entry.constraint : entry;
      const kind = category === "constraint" && !entry.point ? "constraint"
        : ["point", "line", "circle", "arc", "spline"].includes(category) || entry.point ? "geometry"
          : ({ image: "referenceImage", instance: "geometryInstance" }[category] || category);
      const target = { kind, item, category };
      const previous = canvasSelection.inspection;
      let targets = additive && category !== "constraint" && previous?.sketchId === data.sketchId
        && previous.targets.every((candidate) => candidate.category !== "constraint") ? [...previous.targets] : [];
      const index = targets.findIndex((candidate) => candidate.kind === kind && candidate.category === category
        && (candidate.item === item || item.id && candidate.item.id === item.id));
      if (index >= 0) targets.splice(index, 1); else targets.push(target);
      clearSelection();
      if (targets.length) canvasSelection.set("inspection", { sketchId: data.sketchId, targets });
      updateUI();
      draw();
    }

    function activateSketchTreeObject(row, additive) {
      const sketchId = row.dataset.sketchId;
      const category = row.dataset.objectKind;
      if (sketchId !== activeSketchId()) {
        return inspectObject(row, additive);
      }
      const model = currentScope();
      if (canvasSelection.inspection || canvasSelection.sketchId) additive = false;
      if (!additive || category === "constraint" || canvasSelection.inspection || canvasSelection.sketchId) clearSelection();
      if (["point", "line", "circle", "arc", "spline"].includes(category)) {
        const item = sidebarGeometryItem(category, row.dataset.id);
        if (item) {
          const selectionKind = `${category}s`;
          if (additive) canvasSelection.toggleById(selectionKind, item); else canvasSelection.append(selectionKind, item);
        }
      } else if (category === "hatch") {
        const item = model.hatches.find((hatch) => hatch.id === row.dataset.id);
        if (item) additive ? canvasSelection.toggleById("hatches", item) : canvasSelection.append("hatches", item);
      } else if (category === "image") {
        const item = model.referenceImages.find((image) => image.id === row.dataset.id);
        if (item) additive ? canvasSelection.toggleById("referenceImages", item) : canvasSelection.append("referenceImages", item);
      } else if (category === "block") {
        const item = model.blockInstances.find((block) => block.id === row.dataset.id);
        if (item) additive ? toggleBlockInstanceSelection(item) : canvasSelection.append("blockInstances", item);
      } else if (category === "instance") {
        const item = model.geometryInstances.find((instance) => instance.id === row.dataset.id);
        if (item) {
          if (additive && canvasSelection.geometryInstances.includes(item)) canvasSelection.set("geometryInstances", canvasSelection.geometryInstances.filter((entry) => entry !== item));
          else if (!canvasSelection.geometryInstances.includes(item)) canvasSelection.append("geometryInstances", item);
          canvasSelection.set("instanceGeometry", null);
        }
      } else if (category === "annotation") {
        const item = model.annotations.find((annotation) => annotation.id === row.dataset.id);
        if (item) {
          if (additive) canvasSelection.toggleById("annotations", item); else canvasSelection.append("annotations", item);
        }
      } else if (row.dataset.fixedPointId) {
        const point = model.points.find((item) => item.id === row.dataset.fixedPointId);
        if (point) canvasSelection.set("points", [point]);
      } else {
        const constraint = model.constraints[Number(row.dataset.constraintIndex)];
        if (constraint) {
          if (targetFromConstraint(constraint)) canvasSelection.set("dimensionConstraint", constraint);
          else canvasSelection.set("constraint", constraint);
        }
      }
      updateUI();
      draw();
    }

    function handleSketchTreeClick(event) {
      const model = currentScope();
      const categoryRow = event.target.closest(".sketch-group-row");
      if (categoryRow) {
        sketchTreeView.toggleGroup(categoryRow.dataset.sketchId, categoryRow.dataset.category);
        updateSketchUI();
        return;
      }
      const action = event.target.closest("button");
      const actionObjectRow = action?.closest(".sketch-object-row");
      if (actionObjectRow && actionObjectRow.dataset.sketchId !== activeSketchId()) return;
      if (action?.classList.contains("sketchExpandBtn")) {
        sketchTreeView.setSketchOpen(action.dataset.id, action.getAttribute("aria-expanded") !== "true");
        updateSketchUI();
        return;
      }
      if (action?.classList.contains("sketchVisibilityBtn")) return void toggleSketchVisibility(action.dataset.id);
      if (action?.classList.contains("sketchRenameBtn")) return void renameSketch(action.dataset.id);
      if (action?.classList.contains("sketchDeleteBtn")) return void deleteSketch(action.dataset.id);
      if (action?.classList.contains("removePointBtn")) return void deleteElements({ points: [model.points.find((item) => item.id === action.dataset.id)].filter(Boolean) });
      if (action?.classList.contains("removeLineBtn")) return void deleteElements({ lines: [model.lines.find((item) => item.id === action.dataset.id)].filter(Boolean) });
      if (action?.classList.contains("removeCircleBtn")) return void deleteElements({ circles: [model.circles.find((item) => item.id === action.dataset.id)].filter(Boolean) });
      if (action?.classList.contains("removeArcBtn")) return void deleteElements({ arcs: [model.arcs.find((item) => item.id === action.dataset.id)].filter(Boolean) });
      if (action?.classList.contains("removeSplineBtn")) return void deleteElements({ splines: [model.splines.find((item) => item.id === action.dataset.id)].filter(Boolean) });
      if (action?.classList.contains("removeConstraintBtn")) return void deleteElements({ constraints: [model.constraints[Number(action.dataset.idx)]].filter(Boolean) });
      if (action?.classList.contains("removeFixedPointBtn")) {
        const point = model.points.find((item) => item.id === action.dataset.id);
        if (point) unfixPoint(point);
        return;
      }
      const objectRow = event.target.closest(".sketch-object-row");
      if (objectRow) return void activateSketchTreeObject(objectRow, event.ctrlKey || event.shiftKey);
      const sketchRow = event.target.closest(".sketch-item");
      if (sketchRow) selectSketch(sketchRow.dataset.id);
    }

    function activateRow(event) {
      const action = event.target.closest("button");
      if (action && !action.classList.contains("sketchActivateBtn")) return;
      const row = event.target.closest(".sketch-item");
      if (!row) return;
      setActiveSketch(row.dataset.id);
      selectSketch(row.dataset.id);
    }

    function keyDown(event) {
      const button = event.target.closest(".sketchActivateBtn");
      if (!button || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter" && event.altKey) activateRow(event);
      else selectSketch(button.dataset.id);
    }

    function handleSketchTreePointerOver(event) {
      const objectRow = event.target.closest(".sketch-object-row");
      if (objectRow && !objectRow.contains(event.relatedTarget) && objectRow.dataset.sketchId === activeSketchId()) {
        const category = objectRow.dataset.objectKind;
        if (category === "block") canvasHover.update({ block: currentScope().blockInstances.find((item) => item.id === objectRow.dataset.id) || null });
        else if (category === "instance") canvasHover.update({ geometryInstance: currentScope().geometryInstances.find((item) => item.id === objectRow.dataset.id) || null });
        else if (category === "hatch") canvasHover.update({ hatch: currentScope().hatches.find((item) => item.id === objectRow.dataset.id) || null });
        else if (category === "image") canvasHover.update({ referenceImage: currentScope().referenceImages.find((item) => item.id === objectRow.dataset.id) || null });
        else if (category === "annotation") canvasHover.update({ annotation: currentScope().annotations.find((item) => item.id === objectRow.dataset.id) || null });
        else if (objectRow.dataset.fixedPointId) {
          const point = currentScope().points.find((item) => item.id === objectRow.dataset.fixedPointId);
          setSidebarHover("fixed-point", point, sidebarHoverElementsForItem(point));
        } else if (category === "constraint") {
          const constraint = currentScope().constraints[Number(objectRow.dataset.constraintIndex)];
          setSidebarHover("constraint", constraint, sidebarHoverElementsForConstraint(constraint));
        } else {
          const item = sidebarGeometryItem(category, objectRow.dataset.id);
          setSidebarHover("geometry", item, sidebarHoverElementsForItem(item));
        }
        draw();
        return;
      }
      const sketchRow = event.target.closest(".sketch-item");
      if (sketchRow && !sketchRow.contains(event.relatedTarget)) {
        hoveredSketchTreeId = sketchRow.dataset.id;
        draw();
      }
    }

    function handleSketchTreePointerOut(event) {
      const objectRow = event.target.closest(".sketch-object-row");
      if (objectRow && !objectRow.contains(event.relatedTarget)) {
        clearSidebarHover();
        canvasHover.update({
          block: null, geometryInstance: null, annotation: null,
          hatch: null, referenceImage: null,
        });
        draw();
      }
      const sketchRow = event.target.closest(".sketch-item");
      if (sketchRow && !sketchRow.contains(event.relatedTarget) && hoveredSketchTreeId === sketchRow.dataset.id) {
        hoveredSketchTreeId = null;
        draw();
      }
    }

    function isSidebarHighlightedElement(item) {
      if (!hoveredSketchTreeId || !item) return false;
      const itemSketchId = elementSketchId(item);
      return hoveredSketchTreeId === ROOT_SKETCH_ID ? itemSketchId !== ROOT_SKETCH_ID : itemSketchId === hoveredSketchTreeId;
    }


    function clearHoverSketch() { hoveredSketchTreeId = null; }
    function leave() {
      clearHoverSketch(); clearSidebarHover();
      canvasHover.update({ block: null, annotation: null, hatch: null, referenceImage: null });
      draw();
    }
    return Object.freeze({ pointerOver: handleSketchTreePointerOver, pointerOut: handleSketchTreePointerOut, isHighlightedElement: isSidebarHighlightedElement, clearHoverSketch, leave, click: handleSketchTreeClick, doubleClick: activateRow, keyDown, activateObject: activateSketchTreeObject });
  }
  window.SketchTreeController = Object.freeze({ create });
})();

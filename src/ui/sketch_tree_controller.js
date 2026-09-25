/* Route sketch tree actions to selection, editing commands and expansion state. */
(() => {
  "use strict";
  function create({ currentScope, activeSketchId, setActiveSketch, clearSelection, canvasSelection,
    sidebarGeometryItem, toggleBlockInstanceSelection, targetFromConstraint, updateUI, draw,
    sketchTreeView, updateSketchUI, toggleSketchVisibility, renameSketch, deleteSketch, deleteElements, unfixPoint }) {
    function activateSketchTreeObject(row, additive) {
      const sketchId = row.dataset.sketchId;
      const category = row.dataset.objectKind;
      if (sketchId !== activeSketchId()) {
        setActiveSketch(sketchId);
        additive = false;
      }
      const model = currentScope();
      if (!additive || category === "constraint") clearSelection();
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
      if (sketchRow) {
        const wasActive = sketchRow.dataset.id === activeSketchId();
        setActiveSketch(sketchRow.dataset.id);
        if (wasActive && sketchRow.classList.contains("has-groups")) {
          sketchTreeView.setSketchOpen(sketchRow.dataset.id, sketchRow.getAttribute("aria-expanded") !== "true");
          updateSketchUI();
        }
      }
    }

    return Object.freeze({ click: handleSketchTreeClick, activateObject: activateSketchTreeObject });
  }
  window.SketchTreeController = Object.freeze({ create });
})();

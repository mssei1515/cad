/* Reflect interaction and selection capabilities in toolbar DOM; command execution is caller-owned. */
(() => {
  "use strict";
  function create({ document, isGeometryMode, constructionToggleState, readInteraction, updateHistoryButtons,
    selectedVisibilityTargets, selectionVisibilityIsHidden, canEditTarget, syncFlyouts, updateCursor }) {
    function update() {
      const geometryMode = isGeometryMode();
      const constructionState = constructionToggleState(geometryMode);
      const interaction = readInteraction();
      const { mode } = interaction;
      const states = {
        toolSelect: geometryMode && mode === "select" && !interaction.hasConstraint && !interaction.hasPending,
        toolPoint: geometryMode && mode === "point",
        toolLine: geometryMode && mode === "line",
        toolCenterline: geometryMode && mode === "centerline",
        toolCircleCenterCross: geometryMode && mode === "circle-center-cross",
        toolConstructionLine: constructionState.active,
        toolRectangle: geometryMode && mode === "rectangle",
        toolSlot: geometryMode && mode === "slot",
        toolCreateBlock: false,
        toolFillet: geometryMode && mode === "fillet",
        toolTrim: geometryMode && mode === "trim",
        toolOffset: geometryMode && mode === "offset",
        toolCircle: geometryMode && mode === "circle",
        toolArc: geometryMode && mode === "arc",
        toolThreePointArc: geometryMode && mode === "three-point-arc",
        toolSpline: geometryMode && mode === "spline",
        toolSketchProjection: geometryMode && mode === "sketch-projection",
        toolPattern: geometryMode && mode.startsWith("pattern-placement-") && !["pattern-placement-mirror", "pattern-placement-circular"].includes(mode),
        toolMirror: geometryMode && mode === "pattern-placement-mirror",
        toolCircularPattern: geometryMode && mode === "pattern-placement-circular",
        toolHatch: geometryMode && (mode === "hatch" || mode === "hatch-repair"),
        annotationTextBtn: interaction.annotationDraft,
      };
      for (const [id, active] of Object.entries(states)) {
        const button = document.getElementById(id);
        if (!button) continue;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
        button.setAttribute("aria-disabled", String(!geometryMode));
      }
      for (const id of ["toolCreateBlock"]) {
        const button = document.getElementById(id);
        if (button) button.disabled = !geometryMode;
      }
      updateHistoryButtons();
      const visibilityButton = document.getElementById("selectionVisibilityBtn");
      const visibilityTargets = selectedVisibilityTargets();
      if (visibilityButton) {
        const hidden = selectionVisibilityIsHidden(visibilityTargets);
        visibilityButton.disabled = !geometryMode || visibilityTargets.length === 0 || visibilityTargets.some(target => target.kind !== "sketch"
          && !canEditTarget(target));
        visibilityButton.classList.toggle("active", hidden);
        visibilityButton.setAttribute("aria-pressed", String(hidden));
      }
      syncFlyouts();
      const current = readInteraction();
      updateCursor({ pendingType: current.pendingType, constraintType: current.constraintType,
        splineEditing: current.splineEditing, mode: current.mode });
    }
    return Object.freeze({ update });
  }
  function createBinding({ document, drawOperationLifecycle, startCenterlineCommand, startCircleCenterCrossCommand, startSketchProjectionCommand, startGeometryInstanceCommand, constructionCommand, filletCommand, startBlockCreation, offsetCommand, beginSplineCreation, startHatchCreation }) {
    let bound = false;
    const removers = [];
    function listen(id, readHandler, optional = false) {
      const button = document.getElementById(id);
      if (optional && button == null) return;
      const handler = readHandler();
      button.addEventListener("click", handler);
      removers.push(() => button.removeEventListener("click", handler));
    }
    function bind() {
      if (bound) return;
      bound = true;
      listen("toolSelect", () => () => drawOperationLifecycle.start("select"));
      listen("toolPoint", () => () => drawOperationLifecycle.start("point"));
      listen("toolLine", () => () => drawOperationLifecycle.start("line"));
      listen("toolCenterline", () => startCenterlineCommand, true);
      listen("toolCircleCenterCross", () => startCircleCenterCrossCommand, true);
      listen("toolSketchProjection", () => startSketchProjectionCommand, true);
      listen("toolMirror", () => () => startGeometryInstanceCommand("mirror"), true);
      listen("toolCircularPattern", () => () => startGeometryInstanceCommand("circularPattern"), true);
      listen("toolPattern", () => () => startGeometryInstanceCommand("pattern"), true);

      listen("toolConstructionLine", () => constructionCommand.toggle, true);

      listen("toolRectangle", () => () => drawOperationLifecycle.start("rectangle"), true);
      listen("toolSlot", () => () => drawOperationLifecycle.start("slot"), true);
      listen("toolFillet", () => filletCommand.begin, true);

      listen("toolTrim", () => () => drawOperationLifecycle.start("trim"), true);
      listen("toolCreateBlock", () => startBlockCreation, true);

      listen("toolOffset", () => offsetCommand.begin, true);

      listen("toolCircle", () => () => drawOperationLifecycle.start("circle"));
      listen("toolArc", () => () => drawOperationLifecycle.start("arc"));
      listen("toolThreePointArc", () => () => drawOperationLifecycle.start("three-point-arc"), true);
      listen("toolSpline", () => beginSplineCreation, true);
      listen("toolHatch", () => startHatchCreation, true);
    }
    function dispose() {
      for (const remove of removers.splice(0)) remove();
      bound = false;
    }
    return Object.freeze({ bind, dispose });
  }

  // Bind editing controls independently of drawing-tool registration.
  function createEditingBinding({ document, undo, redo, toggleVisibility, isGeometryMode, deleteSelection, updateUI, draw, annotation }) {
    let bound = false;
    const removers = [];
    function bind() {
      if (bound) return;
      bound = true;
      const handlers = [
        ["undoBtn", undo],
        ["redoBtn", redo],
        ["selectionVisibilityBtn", toggleVisibility],
        ["deleteSelectionBtn", () => {
          if (!isGeometryMode()) return;
          if (deleteSelection()) {
            updateUI();
            draw();
          }
        }],
        ["annotationTextBtn", () => annotation.start()],
      ];
      for (const [id, handler] of handlers) {
        const button = document.getElementById(id);
        if (!button) continue;
        button.addEventListener("click", handler);
        removers.push(() => button.removeEventListener("click", handler));
      }
    }
    function dispose() {
      for (const remove of removers.splice(0)) remove();
      bound = false;
    }
    return Object.freeze({ bind, dispose });
  }

  function createCommandStatus({ document, applicationText, readMode, readPendingType, readConstraintCommand }) {
    function updateStatusUI() {
      const command = document.getElementById("statusCommand");
      const modeLabels = {
        "pattern-placement-origin": applicationText("配置基準点", "Placement anchor"),
        "pattern-placement-place": applicationText("直線パターン", "Linear Pattern"),
        "pattern-placement-mirror": applicationText("ミラー", "Mirror"),
        "pattern-placement-circular": applicationText("円形パターン", "Circular Pattern"),
        select: applicationText("選択", "Select"), point: applicationText("点", "Point"), line: applicationText("線", "Line"), centerline: applicationText("中心線", "Centerline"), "circle-center-cross": applicationText("円中心十字線", "Circle Center Cross"), rectangle: applicationText("矩形", "Rectangle"),
        slot: applicationText("長穴", "Slot"), circle: applicationText("円", "Circle"), arc: applicationText("円弧", "Arc"), "three-point-arc": applicationText("3点円弧", "Three-point Arc"), spline: applicationText("スプライン", "Spline"), fillet: applicationText("R面取り", "Fillet"), trim: applicationText("トリム", "Trim"),
        offset: applicationText("オフセット", "Offset"), hatch: applicationText("塗りつぶし", "Fill"), "hatch-repair": applicationText("境界を再指定", "Reselect boundary"), "block-place": applicationText("ブロック配置", "Block placement"),
      };
      if (command) {
        command.textContent = readPendingType()?.startsWith("annotation-") ? applicationText("注記", "Annotation") : readConstraintCommand() ? applicationText("拘束", "Constraint") : modeLabels[readMode()] || readMode();
      }
    }
    return Object.freeze({ update: updateStatusUI });
  }
  function createIcons({ document, isDimensionConstraint, types }) {
    const { LineFixedConstraint, ArcEndpointFixedConstraint, GeometryFixedConstraint,
      SketchProjectionConstraint, ParallelLinesCenterlineConstraint, PointPairCenterlineConstraint } = types;
    function toolbarSvgMarkup(selector) {
      const svg = document.querySelector(selector)?.querySelector("svg");
      return svg ? svg.outerHTML.replace("<svg", '<svg class="sketch-object-icon"') : "";
    }

    function constraintToolbarIcon(constraint, fixedPoint = false) {
      if (fixedPoint || constraint instanceof LineFixedConstraint || constraint instanceof ArcEndpointFixedConstraint || constraint instanceof GeometryFixedConstraint) return toolbarSvgMarkup("#fixPointBtn");
      if (constraint instanceof SketchProjectionConstraint) return toolbarSvgMarkup("#toolSketchProjection");
      if (constraint instanceof ParallelLinesCenterlineConstraint || constraint instanceof PointPairCenterlineConstraint) return toolbarSvgMarkup("#toolCenterline");
      if (isDimensionConstraint(constraint)) return toolbarSvgMarkup('[data-constraint="distance"]');
      const name = String(constraint?.name || "");
      const mappings = [
        [/水平/, "horizontal"], [/垂直/, "vertical"], [/平行/, "parallel"], [/直角/, "perpendicular"], [/対称/, "symmetry"],
        [/同心/, "concentric"], [/等寸/, "equal"], [/接線/, "tangent"], [/一致|円周/, "coincident"],
      ];
      const type = mappings.find(([pattern]) => pattern.test(name))?.[1] || "coincident";
      return toolbarSvgMarkup(`[data-constraint="${type}"]`);
    }
    return Object.freeze({ toolbarSvgMarkup, constraintToolbarIcon });
  }
  window.ToolbarView = Object.freeze({ create, createBinding, createEditingBinding, createCommandStatus, createIcons });
})();

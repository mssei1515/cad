/* Command cursor presentation. Input is a read-only description of active commands. */
(() => {
  "use strict";
  function create({ document, canvas, fixPointBtn, constraintButtons }) {
    let commandCursorSource = null;
    const commandCursorCache = new Map();
    function activeCommandToolbarButton({ pendingType, constraintType, splineEditing, mode }) {
      if (constraintType === "fixed") return fixPointBtn;
      if (pendingType?.startsWith("annotation-leader")) return document.getElementById("annotationLeaderBtn");
      if (pendingType === "annotation-text-place") return document.getElementById("annotationTextBtn");
      if (pendingType?.startsWith("distance")) return constraintButtons.find((button) => button.dataset.constraint === "distance") || null;
      if (pendingType === "fillet-radius-place") return document.getElementById("toolFillet");
      if (constraintType) return constraintButtons.find((button) => button.dataset.constraint === constraintType) || null;
      if (splineEditing) return document.getElementById("toolSpline");
      const buttonByMode = {
        point: "toolPoint",
        line: "toolLine",
        centerline: "toolCenterline",
        "circle-center-cross": "toolCircleCenterCross",
        rectangle: "toolRectangle",
        slot: "toolSlot",
        circle: "toolCircle",
        arc: "toolArc",
        "three-point-arc": "toolThreePointArc",
        spline: "toolSpline",
        "sketch-projection": "toolSketchProjection",
        "free-instance-origin": "toolFreeInstance",
        "free-instance-place": "toolFreeInstance",
        "mirror-axis": "toolMirror",
        "pattern-direction": "toolPattern",
        hatch: "toolHatch",
        "hatch-repair": "toolHatch",
        fillet: "toolFillet",
        trim: "toolTrim",
        offset: "toolOffset",
        "block-place": "toolCreateBlock",
      };
      return buttonByMode[mode] ? document.getElementById(buttonByMode[mode]) : null;
    }

    function commandCursorSourceKey(button) {
      if (!button) return "";
      return button.id || (button.dataset.constraint ? `constraint:${button.dataset.constraint}` : "");
    }

    function commandCursorValue(button, source) {
      if (commandCursorCache.has(source)) return commandCursorCache.get(source);
      const toolbarSvg = button?.querySelector("svg");
      if (button && !toolbarSvg) return null;
      const pointer = `<path d="M1.5 1.5V17l3.8-3.9 2.9 6.8 2.5-1.15-2.9-6.6h5.4L1.5 1.5Z" fill="#fff" stroke="#0f172a" stroke-width=".8" stroke-linejoin="round"/>`;
      const badge = toolbarSvg
        ? `<rect x="15" y="12" width="22" height="22" rx="4" fill="#f8fafc" stroke="#c5cedb"/><g transform="translate(17 14) scale(.75)" fill="none" stroke="#1f2937" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${toolbarSvg.innerHTML}</g>`
        : "";
      const width = toolbarSvg ? 39 : 15;
      const height = toolbarSvg ? 36 : 21;
      const cursorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${pointer}${badge}</svg>`;
      const cursorValue = `url("data:image/svg+xml,${encodeURIComponent(cursorSvg)}") 2 2, default`;
      commandCursorCache.set(source, cursorValue);
      return cursorValue;
    }

    function update(state) {
      const button = activeCommandToolbarButton(state);
      const source = button ? commandCursorSourceKey(button) : "default";
      const cursorValue = commandCursorValue(button, source);
      if (!cursorValue) return;
      if (commandCursorSource !== source) {
        canvas.style.setProperty("--canvas-native-cursor", cursorValue);
        if (button) canvas.dataset.commandCursorSource = source;
        else delete canvas.dataset.commandCursorSource;
        commandCursorSource = source;
      }
      canvas.classList.add("has-native-cursor");
    }
    return Object.freeze({ update });
  }
  window.CommandCursor = Object.freeze({ create });
})();

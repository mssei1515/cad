/* Present pending dimension input without committing geometry, constraints or history. */
(() => {
  "use strict";
  function create({ readPending, drawDimension, drawFilletPreviewArc, dimensionFromAnchor,
    applyDefaultCircleDimensionLabelOffset, defaultDimensionForTarget, evaluateDimensionExpressionDraft,
    formatDisplayNumber, angleDegrees, angleDimensionAngles, dimensionAnchor, formatDimensionLabel, dimensionWithLabelAt }) {
    function draw() {
      if (readPending()?.type === "fillet-radius-place") {
        const geometry = readPending().preview;
        if (!geometry.ok) return;
        const primitive = {
          id: "R",
          center: geometry.center,
          radius: () => geometry.radius,
        };
        const target = { kind: "radius", primitive, value: geometry.radius };
        const anchor = readPending().pointer || {
          x: geometry.center.x + Math.cos((geometry.startAngle + geometry.endAngle) / 2) * geometry.radius,
          y: geometry.center.y + Math.sin((geometry.startAngle + geometry.endAngle) / 2) * geometry.radius,
        };
        drawFilletPreviewArc(geometry);
        drawDimension(target, dimensionFromAnchor(target, anchor), `R${formatDisplayNumber(geometry.radius)}`, true, false, {
          selecting: true,
          invalid: false,
          hidden: true,
        });
        return;
      }
      if (!readPending()?.type?.startsWith("distance")) return;
      const dimension =
        readPending().type === "distance-place"
          ? readPending().dimension || applyDefaultCircleDimensionLabelOffset(readPending().target, readPending().pointer ? dimensionFromAnchor(readPending().target, readPending().pointer) : defaultDimensionForTarget(readPending().target))
          : readPending().dimension;
      if (readPending().type === "distance-value") {
        let value = NaN;
        let invalid = false;
        try {
          value = evaluateDimensionExpressionDraft(readPending().constraint || null, readPending().buffer, undefined, { signedAngle: readPending().target.interval === true });
          invalid = readPending().target.interval ? value === 0 || Math.abs(value) >= 360
            : value <= 0 || (readPending().target.kind === "angle" && value >= 180);
        } catch (_error) {
          invalid = true;
        }
        const suffix = readPending().target.kind === "angle" ? "°" : "";
        drawDimension(readPending().target, dimension, `${Number.isFinite(value) ? formatDisplayNumber(value) : "_"}${suffix}|`, true, false, {
          selecting: !readPending().editing,
          invalid,
          hidden: true,
        });
        return;
      }
      const previewTarget =
        readPending().target.kind === "point-point" && (dimension.axis === "x" || dimension.axis === "y")
          ? { ...readPending().target, dimensionAxis: dimension.axis }
          : readPending().target;
      const previewValue =
        previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "x"
          ? Math.abs(previewTarget.p2.x - previewTarget.p1.x)
          : previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "y"
            ? Math.abs(previewTarget.p2.y - previewTarget.p1.y)
            : previewTarget.kind === "angle"
              ? angleDegrees(angleDimensionAngles(previewTarget, readPending().pointer || dimensionAnchor(previewTarget, dimension), dimension).signed)
            : previewTarget.value;
      const label = previewTarget.kind === "angle" ? formatDimensionLabel(previewValue, "°") : formatDimensionLabel(previewValue);
      drawDimension(previewTarget, dimensionWithLabelAt(previewTarget, dimension, readPending().pointer), label, true);
    }
    return Object.freeze({ draw });
  }
  window.DimensionPreview = Object.freeze({ create });
})();

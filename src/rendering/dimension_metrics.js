/* Dimension measurement and arrow geometry with renderer-owned caches. */
(function () {
  "use strict";
  const { CSS_PX_PER_MM, DEFAULT_DIMENSION_APPEARANCE, normalizeDimensionAppearance } = window.Appearance;
  const DIMENSION_SCREEN_PX_PER_MM = CSS_PX_PER_MM;
  const DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR = 1;
  const DIMENSION_EXPRESSION_MARK_WIDTH_FACTOR = 0.58;
  const DIMENSION_EXPRESSION_MARK_GAP_FACTOR = 0.16;
  const DIMENSION_ARROW_MITER_LIMIT = 10;
  function create({ ctx, viewport }) {
    const dimensionTextWidthCache = new WeakMap();
    const dimensionArrowheadFactorCache = new Map();
    function dimensionMillimetersToWorld(value) {
      return Number(value) * DIMENSION_SCREEN_PX_PER_MM / viewport.scale;
    }

    function dimensionTextDrawingMetrics(appearance = DEFAULT_DIMENSION_APPEARANCE) {
      const resolved = normalizeDimensionAppearance(appearance, { partial: false });
      return {
        height: dimensionMillimetersToWorld(resolved.dimensionTextHeight),
        gap: dimensionMillimetersToWorld(resolved.dimensionTextGap),
      };
    }

    function dimensionTextWidth(label, appearance = DEFAULT_DIMENSION_APPEARANCE, expressionMark = false) {
      const resolved = normalizeDimensionAppearance(appearance, { partial: false });
      return dimensionTextWidthFromResolved(label, resolved, null, expressionMark);
    }

    function dimensionTextWidthFromResolved(label, resolved, cacheOwner = null, expressionMark = false) {
      const text = String(label ?? "");
      const screenHeight = resolved.dimensionTextHeight * DIMENSION_SCREEN_PX_PER_MM;
      const cached = cacheOwner && typeof cacheOwner === "object" ? dimensionTextWidthCache.get(cacheOwner) : null;
      if (cached?.text === text && cached.screenHeight === screenHeight && cached.expressionMark === expressionMark) return cached.screenWidth / viewport.scale;
      ctx.save();
      ctx.font = `${screenHeight / viewport.scale}px system-ui`;
      const textScreenWidth = ctx.measureText(text).width * viewport.scale;
      ctx.restore();
      const markScreenWidth = expressionMark
        ? screenHeight * (DIMENSION_EXPRESSION_MARK_WIDTH_FACTOR + DIMENSION_EXPRESSION_MARK_GAP_FACTOR)
        : 0;
      const screenWidth = textScreenWidth + markScreenWidth;
      if (cacheOwner && typeof cacheOwner === "object") dimensionTextWidthCache.set(cacheOwner, { text, screenHeight, screenWidth, expressionMark });
      return screenWidth / viewport.scale;
    }

    function shouldPlaceDimensionTerminatorsOutside(availableLength, label, appearance = DEFAULT_DIMENSION_APPEARANCE, cacheOwner = null, expressionMark = false) {
      const terminatorType = appearance.terminatorType;
      if (!["arrow", "filledArrow"].includes(terminatorType)) return false;
      const normalizedAvailableLength = Math.max(0, Number(availableLength) || 0);
      const cached = cacheOwner && typeof cacheOwner === "object" ? dimensionTextWidthCache.get(cacheOwner) : null;
      if (cached?.label === label
        && cached.availableLength === normalizedAvailableLength
        && cached.viewportScale === viewport.scale
        && cached.dimensionTextHeight === appearance.dimensionTextHeight
        && cached.terminatorType === terminatorType
        && cached.terminatorSize === appearance.terminatorSize
        && cached.expressionMark === expressionMark) return cached.outside;
      const availableScreenLength = normalizedAvailableLength * viewport.scale;
      const text = String(label ?? "");
      const screenHeight = appearance.dimensionTextHeight * DIMENSION_SCREEN_PX_PER_MM;
      const screenWidth = cached?.text === text && cached.screenHeight === screenHeight && cached.expressionMark === expressionMark
        ? cached.screenWidth
        : dimensionTextWidthFromResolved(text, appearance, cacheOwner, expressionMark) * viewport.scale;
      const fitMargin = appearance.terminatorSize * DIMENSION_SCREEN_PX_PER_MM * DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR;
      const outside = availableScreenLength < screenWidth + fitMargin;
      if (cacheOwner && typeof cacheOwner === "object") {
        dimensionTextWidthCache.set(cacheOwner, {
          label,
          text,
          screenHeight,
          screenWidth,
          availableLength: normalizedAvailableLength,
          viewportScale: viewport.scale,
          dimensionTextHeight: appearance.dimensionTextHeight,
          terminatorType,
          terminatorSize: appearance.terminatorSize,
          expressionMark,
          outside,
        });
      }
      return outside;
    }

    function linearDimensionTerminatorDirections(direction, outside) {
      const factor = outside ? -1 : 1;
      const component = (value) => {
        const result = value * factor;
        return Object.is(result, -0) ? 0 : result;
      };
      const oppositeComponent = (value) => {
        const result = -value * factor;
        return Object.is(result, -0) ? 0 : result;
      };
      return {
        first: { x: component(direction.x), y: component(direction.y) },
        second: { x: oppositeComponent(direction.x), y: oppositeComponent(direction.y) },
      };
    }

    function dimensionStrokeWidth(appearance = DEFAULT_DIMENSION_APPEARANCE, highlighted = false) {
      const numeric = Number(appearance?.lineWidth);
      const lineWidth = Number.isFinite(numeric) ? Math.max(0.5, Math.min(10, numeric)) : DEFAULT_DIMENSION_APPEARANCE.lineWidth;
      return highlighted ? Math.max(2, lineWidth + 0.8) : lineWidth;
    }

    function dimensionArrowheadPoints(point, direction, appearance = DEFAULT_DIMENSION_APPEARANCE) {
      const resolved = normalizeDimensionAppearance(appearance, { partial: false });
      return dimensionArrowheadPointsFromResolved(point, direction, resolved);
    }

    function dimensionArrowheadFactors(arrowheadAngle) {
      const angle = Math.max(1, Math.min(179, Number(arrowheadAngle) || 30));
      const cached = dimensionArrowheadFactorCache.get(angle);
      if (cached) return cached;
      const halfAngle = angle * Math.PI / 360;
      const sine = Math.max(1e-9, Math.sin(halfAngle));
      const factors = {
        wing: Math.tan(halfAngle),
        tipInset: 1 / sine <= DIMENSION_ARROW_MITER_LIMIT ? 0.5 / sine : 0.5 * sine,
        openInsetRatios: new Map(),
      };
      dimensionArrowheadFactorCache.set(angle, factors);
      return factors;
    }

    function dimensionArrowheadPointsFromResolved(point, direction, resolved, factors = dimensionArrowheadFactors(resolved.arrowheadAngle)) {
      const size = dimensionMillimetersToWorld(resolved.terminatorSize);
      const wing = size * factors.wing;
      const n = { x: -direction.y, y: direction.x };
      return [
        { x: point.x, y: point.y },
        { x: point.x + direction.x * size + n.x * wing, y: point.y + direction.y * size + n.y * wing },
        { x: point.x + direction.x * size - n.x * wing, y: point.y + direction.y * size - n.y * wing },
      ];
    }

    function dimensionOpenArrowTipInset(strokeWidth, arrowheadAngle) {
      // A miter join projects past the path vertex toward the visual arrow tip.
      // Very acute joins are bevelled by Canvas once they exceed miterLimit.
      return Math.max(0, Number(strokeWidth) || 0) * dimensionArrowheadFactors(arrowheadAngle).tipInset;
    }

    function dimensionOpenArrowJoinProjection(strokeWidth, halfAngle) {
      const sine = Math.max(1e-9, Math.sin(halfAngle));
      const factor = 1 / sine <= DIMENSION_ARROW_MITER_LIMIT ? 0.5 / sine : 0.5 * sine;
      return Math.max(0, Number(strokeWidth) || 0) * factor;
    }

    function dimensionOpenArrowPathTipInset(strokeWidth, nominalSize, wing) {
      const width = Math.max(0, Number(strokeWidth) || 0);
      const size = Math.max(0, Number(nominalSize) || 0);
      const halfWidth = Math.max(1e-9, Number(wing) || 0);
      const halfStroke = width / 2;
      let inset = Math.min(size, dimensionOpenArrowTipInset(width, Math.atan2(halfWidth, Math.max(1e-9, size)) * 360 / Math.PI));
      for (let iteration = 0; iteration < 4; iteration += 1) {
        const shaft = Math.max(1e-9, size - inset);
        const radius = Math.hypot(shaft, halfWidth);
        const sine = Math.max(1e-9, halfWidth / radius);
        const mitered = 1 / sine <= DIMENSION_ARROW_MITER_LIMIT;
        const projection = mitered ? halfStroke / sine : halfStroke * sine;
        const derivative = mitered
          ? 1 + halfStroke * shaft / (halfWidth * radius)
          : 1 - halfStroke * halfWidth * shaft / (radius * radius * radius);
        const nextInset = Math.max(0, Math.min(size, inset - (inset - projection) / Math.max(1e-9, derivative)));
        if (Math.abs(nextInset - inset) <= 1e-9) {
          inset = nextInset;
          break;
        }
        inset = nextInset;
      }
      return inset;
    }

    function dimensionOpenArrowheadRenderPoints(point, direction, resolved, strokeWidth) {
      const factors = dimensionArrowheadFactors(resolved.arrowheadAngle);
      const screenNominalSize = resolved.terminatorSize * DIMENSION_SCREEN_PX_PER_MM;
      const screenStrokeWidth = Math.max(0, Number(strokeWidth) || 0) * viewport.scale;
      const screenWing = screenNominalSize * factors.wing;
      const strokeRatio = screenNominalSize > 0 ? screenStrokeWidth / screenNominalSize : 0;
      let insetRatio = factors.openInsetRatios.get(strokeRatio);
      if (insetRatio == null) {
        insetRatio = dimensionOpenArrowPathTipInset(strokeRatio, 1, factors.wing);
        factors.openInsetRatios.set(strokeRatio, insetRatio);
      }
      const nominalSize = screenNominalSize / viewport.scale;
      const wing = screenWing / viewport.scale;
      const inset = nominalSize * insetRatio;
      const n = { x: -direction.y, y: direction.x };
      return [
        { x: point.x + direction.x * inset, y: point.y + direction.y * inset },
        { x: point.x + direction.x * nominalSize + n.x * wing, y: point.y + direction.y * nominalSize + n.y * wing },
        { x: point.x + direction.x * nominalSize - n.x * wing, y: point.y + direction.y * nominalSize - n.y * wing },
      ];
    }
    return Object.freeze({ dimensionMillimetersToWorld, dimensionTextDrawingMetrics, dimensionTextWidth, shouldPlaceDimensionTerminatorsOutside, linearDimensionTerminatorDirections, dimensionStrokeWidth, dimensionArrowheadPoints, dimensionArrowheadPointsFromResolved, dimensionOpenArrowJoinProjection, dimensionOpenArrowheadRenderPoints });
  }
  window.DimensionMetrics = Object.freeze({ create, DIMENSION_SCREEN_PX_PER_MM, DIMENSION_TERMINATOR_FIT_MARGIN_FACTOR, DIMENSION_EXPRESSION_MARK_WIDTH_FACTOR, DIMENSION_EXPRESSION_MARK_GAP_FACTOR, DIMENSION_ARROW_MITER_LIMIT });
})();

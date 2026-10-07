/* Serialize dimension placement and appearance using explicit placement adapters. */
(() => {
  "use strict";
  const { normalizeDimensionAppearance } = window.Appearance;
  function create({ migrateAngleDimensionLabelPlacement, dimensionAnchor, storedDimensionAxis }) {
    function serializeDimension(dimension, target = null) {
      if (!dimension) return null;
      if (target?.kind === "angle") migrateAngleDimensionLabelPlacement(target, dimension);
      const anchor = target ? dimensionAnchor(target, dimension) : dimension;
      const axis = target ? storedDimensionAxis(target, dimension) : dimension.axis || null;
      const data = {
        x: Number(anchor.x),
        y: Number(anchor.y),
        offsetU: Number.isFinite(dimension.offsetU) ? dimension.offsetU : null,
        offsetN: Number.isFinite(dimension.offsetN) ? dimension.offsetN : null,
        labelOffsetU: Number.isFinite(dimension.labelOffsetU) ? dimension.labelOffsetU : 0,
        axis,
        display: dimension.display ? normalizeDimensionAppearance(dimension.display) : null,
      };
      if (Number.isFinite(dimension.labelX) && Number.isFinite(dimension.labelY)) {
        data.labelX = Number(dimension.labelX);
        data.labelY = Number(dimension.labelY);
      }
      if (target?.kind === "angle") {
        data.angleStartFlip = Number.isInteger(dimension.angleStartFlip) ? dimension.angleStartFlip : null;
        data.angleEndFlip = Number.isInteger(dimension.angleEndFlip) ? dimension.angleEndFlip : null;
        data.angleRadius = Number.isFinite(dimension.angleRadius) ? dimension.angleRadius : null;
        if (Number.isFinite(dimension.angleLabelOffsetR) && Number.isFinite(dimension.angleLabelOffsetT)) {
          data.angleLabelOffsetR = dimension.angleLabelOffsetR;
          data.angleLabelOffsetT = dimension.angleLabelOffsetT;
          data.angleLabelPlacementVersion = 2;
        }
      }
      return data;
    }
    return Object.freeze({ serialize: serializeDimension });
  }
  window.DimensionPersistence = Object.freeze({ create });
})();

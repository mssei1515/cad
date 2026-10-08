/* Present transient snap and Sketch identity overlays without owning interaction state. */
(() => {
  "use strict";
  function create({ ctx, viewport, elementSketchId, sketchRelationToActive, applicationText, isVisibleSketchId, activeSketchId, sketchName }) {
    function drawSnapMarker(snap) {
      if (!snap) return;
      ctx.save();
      const r = 6 / viewport.scale;
      ctx.strokeStyle = "#f59e0b";
      ctx.fillStyle = "#f59e0b";
      ctx.lineWidth = 1.5 / viewport.scale;
      ctx.beginPath();
      ctx.moveTo(snap.x - r, snap.y);
      ctx.lineTo(snap.x + r, snap.y);
      ctx.moveTo(snap.x, snap.y - r);
      ctx.lineTo(snap.x, snap.y + r);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(snap.x, snap.y, 3 / viewport.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${11 / viewport.scale}px system-ui`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const pointLike = Boolean(snap.data?.point) || snap.priority === 0;
      const labelX = snap.x + 8 / viewport.scale;
      const labelY = snap.y + (pointLike ? 20 : -8) / viewport.scale;
      const paddingX = 3 / viewport.scale;
      const paddingY = 2 / viewport.scale;
      const metrics = ctx.measureText(snap.label);
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fillRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, metrics.width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fillText(snap.label, labelX, labelY);
      ctx.restore();
    }

    function selectedSketchIdentityElement(canvasSelection) {
      const inspection = canvasSelection.inspection;
      if (inspection?.targets.length) {
        const item = inspection.targets.at(-1).item;
        return { id: item.id || item.name, sketchId: inspection.sketchId, item };
      }
      if (canvasSelection.arcEndpoint?.arc) return { id: `${canvasSelection.arcEndpoint.arc.id}端点`, sketchId: elementSketchId(canvasSelection.arcEndpoint.arc), item: canvasSelection.arcEndpoint.arc };
      const item = canvasSelection.points.at(-1) || canvasSelection.lines.at(-1) || canvasSelection.circles.at(-1) || canvasSelection.arcs.at(-1) || canvasSelection.splines.at(-1);
      return item ? { id: item.id, sketchId: elementSketchId(item), item } : null;
    }

    function sketchIdentityRelationLabel(sketchId) {
      const relation = sketchRelationToActive(sketchId);
      if (relation === "reference") return applicationText("参照可", "Reference available");
      if (relation === "descendant") return applicationText("参照不可（子孫）", "Not referenceable (descendant)");
      if (relation === "inactive") return applicationText("参照不可", "Not referenceable");
      return "";
    }

    function sketchIdentityRelationColor(sketchId) {
      const relation = sketchRelationToActive(sketchId);
      if (relation === "reference") return "#1d4ed8";
      if (relation === "descendant") return "#b91c1c";
      return "#64748b";
    }

    function sketchIdentityRelationBackground(sketchId) {
      const relation = sketchRelationToActive(sketchId);
      if (relation === "reference") return "rgba(219, 234, 254, 0.96)";
      if (relation === "descendant") return "rgba(254, 226, 226, 0.96)";
      return "rgba(241, 245, 249, 0.96)";
    }

    function drawSketchIdentityLabel({ hoveredIdentity, selection, pointer }) {
      const identity = hoveredIdentity || selectedSketchIdentityElement(selection);
      if (!identity || !pointer || !isVisibleSketchId(identity.sketchId) || identity.sketchId === activeSketchId()) return;
      const baseLabel = `${identity.label || identity.id} / ${sketchName(identity.sketchId)}`;
      const relationLabel = `${applicationText("別スケッチ", "Other sketch")} / ${sketchIdentityRelationLabel(identity.sketchId)}`;
      const separator = relationLabel ? " / " : "";
      ctx.save();
      ctx.font = `${11 / viewport.scale}px system-ui`;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const paddingX = 4 / viewport.scale;
      const paddingY = 2 / viewport.scale;
      const labelX = pointer.x + 14 / viewport.scale;
      const labelY = pointer.y + 26 / viewport.scale;
      const baseWidth = ctx.measureText(baseLabel).width;
      const separatorWidth = ctx.measureText(separator).width;
      const relationWidth = relationLabel ? ctx.measureText(relationLabel).width : 0;
      const width = baseWidth + separatorWidth + relationWidth;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
      ctx.lineWidth = 1 / viewport.scale;
      ctx.strokeRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
      ctx.fillStyle = "#64748b";
      ctx.fillText(baseLabel, labelX, labelY);
      if (relationLabel) {
        const relationX = labelX + baseWidth + separatorWidth;
        const relationPadX = 4 / viewport.scale;
        const relationPadY = 1 / viewport.scale;
        ctx.fillText(separator, labelX + baseWidth, labelY);
        ctx.fillStyle = sketchIdentityRelationBackground(identity.sketchId);
        ctx.fillRect(relationX - relationPadX, labelY - 12 / viewport.scale - relationPadY, relationWidth + relationPadX * 2, 14 / viewport.scale + relationPadY * 2);
        ctx.fillStyle = sketchIdentityRelationColor(identity.sketchId);
        ctx.font = `700 ${11 / viewport.scale}px system-ui`;
        ctx.fillText(relationLabel, relationX, labelY);
      }
      ctx.restore();
    }
    return Object.freeze({ drawSnapMarker, drawSketchIdentityLabel, sketchIdentityRelationLabel, sketchIdentityRelationColor });
  }
  window.InteractionOverlayRenderer = Object.freeze({ create });
})();

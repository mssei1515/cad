/* Draw transient construction previews from explicit points; no command or document ownership. */
(() => {
  "use strict";
  function create({ ctx, viewport, withCanvasState, hypot2, shortestAngleFrom, slotGeometry, threePointArcGeometry, minimumLineLength, minimumArcLength }) {
    function drawFilletArc(geometry) {
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        ctx.beginPath();
        ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.endAngle < geometry.startAngle);
        ctx.stroke();
      });
    }

    function drawLine(startPoint, pointerPreview) {
      if (!startPoint) return;
      const target = pointerPreview || startPoint;
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, 12 / viewport.scale, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    function drawRectangle(startPoint, pointerPreview) {
      if (!startPoint || !pointerPreview) return;
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        ctx.strokeRect(startPoint.x, startPoint.y, pointerPreview.x - startPoint.x, pointerPreview.y - startPoint.y);
      });
    }

    function drawSlot(firstCenter, secondCenter, pointerPreview) {
      if (!firstCenter) return;
      drawConstructionPoint(firstCenter);
      if (!secondCenter) {
        if (!pointerPreview || hypot2(pointerPreview.x - firstCenter.x, pointerPreview.y - firstCenter.y) < minimumLineLength) return;
        withCanvasState(() => {
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2 / viewport.scale;
          ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
          ctx.beginPath();
          ctx.moveTo(firstCenter.x, firstCenter.y);
          ctx.lineTo(pointerPreview.x, pointerPreview.y);
          ctx.stroke();
        });
        return;
      }
      drawConstructionPoint(secondCenter);
      if (!pointerPreview) return;
      const geometry = slotGeometry(firstCenter, secondCenter, pointerPreview, minimumArcLength);
      if (!geometry) return;
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        ctx.beginPath();
        ctx.moveTo(geometry.sideStart.x, geometry.sideStart.y);
        ctx.lineTo(geometry.sideEnd.x, geometry.sideEnd.y);
        ctx.arc(geometry.secondCenter.x, geometry.secondCenter.y, geometry.radius, geometry.endArc.startAngle, geometry.endArc.endAngle, geometry.endArc.endAngle < geometry.endArc.startAngle);
        ctx.lineTo(geometry.oppositeStart.x, geometry.oppositeStart.y);
        ctx.arc(geometry.firstCenter.x, geometry.firstCenter.y, geometry.radius, geometry.startArc.startAngle, geometry.startArc.endAngle, geometry.startArc.endAngle < geometry.startArc.startAngle);
        ctx.stroke();
      });
    }

    function drawCircle(center, pointerPreview) {
      if (!center || !pointerPreview) return;
      const radius = hypot2(pointerPreview.x - center.x, pointerPreview.y - center.y);
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    function drawArc(center, startPoint, pointerPreview) {
      if (!center) return;
      if (!startPoint) {
        drawConstructionPoint(center);
        return;
      }
      if (!pointerPreview) return;
      const angles = {
        start: startPoint.startAngle,
        end: shortestAngleFrom(startPoint.startAngle, Math.atan2(pointerPreview.y - center.y, pointerPreview.x - center.x)),
      };
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        ctx.beginPath();
        ctx.arc(center.x, center.y, startPoint.radius, angles.start, angles.end, angles.end < angles.start);
        ctx.stroke();
      });
      drawConstructionPoint(center);
    }

    function drawThreePointArc(startPoint, endPoint, pointerPreview) {
      if (!startPoint) return;
      drawConstructionPoint(startPoint);
      if (!endPoint) return;
      drawConstructionPoint(endPoint);
      if (!pointerPreview) return;
      const geometry = threePointArcGeometry(startPoint, endPoint, pointerPreview, minimumArcLength);
      if (!geometry) return;
      withCanvasState(() => {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
        ctx.beginPath();
        ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.endAngle < geometry.startAngle);
        ctx.stroke();
      });
      drawConstructionPoint(geometry.center);
    }

    function drawConstructionPoint(point) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5 / viewport.scale, 0, Math.PI * 2);
      ctx.fillStyle = "#eff6ff";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.stroke();
      ctx.restore();
    }
    return Object.freeze({ drawFilletArc, drawLine, drawRectangle, drawSlot, drawCircle, drawArc, drawThreePointArc });
  }
  window.AuthoringPreviewRenderer = Object.freeze({ create });
})();

/* Reference image coordinate transforms and world bounds. */
(() => {
  "use strict";
  function referenceImageLocalToWorld(image, point) {
    const cos = Math.cos(image.rotation);
    const sin = Math.sin(image.rotation);
    const x = point.x * image.scale;
    const y = point.y * image.scale;
    return { x: image.x + x * cos - y * sin, y: image.y + x * sin + y * cos };
  }

  function referenceImageWorldToLocal(image, point) {
    const cos = Math.cos(image.rotation);
    const sin = Math.sin(image.rotation);
    const dx = point.x - image.x;
    const dy = point.y - image.y;
    return { x: (dx * cos + dy * sin) / image.scale, y: (-dx * sin + dy * cos) / image.scale };
  }

  function referenceImageCorners(image) {
    const halfWidth = image.pixelWidth / 2;
    const halfHeight = image.pixelHeight / 2;
    return [
      referenceImageLocalToWorld(image, { x: -halfWidth, y: -halfHeight }),
      referenceImageLocalToWorld(image, { x: halfWidth, y: -halfHeight }),
      referenceImageLocalToWorld(image, { x: halfWidth, y: halfHeight }),
      referenceImageLocalToWorld(image, { x: -halfWidth, y: halfHeight }),
    ];
  }

  function referenceImageBounds(image) {
    const corners = referenceImageCorners(image);
    return {
      x1: Math.min(...corners.map((point) => point.x)),
      y1: Math.min(...corners.map((point) => point.y)),
      x2: Math.max(...corners.map((point) => point.x)),
      y2: Math.max(...corners.map((point) => point.y)),
    };
  }


  window.ReferenceImageGeometry = Object.freeze({ referenceImageLocalToWorld, referenceImageWorldToLocal, referenceImageCorners, referenceImageBounds });
})();

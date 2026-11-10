/* Apply a block's local reflection before its placement rotation and translation. */
(() => {
  "use strict";
  function worldAngle(transform, angle) {
    return transform.rotation + (transform.mirrored ? Math.PI - angle : angle);
  }

  function worldPoint(transform, point) {
    const x = transform.mirrored ? -point.x : point.x;
    const y = point.y;
    const cos = Math.cos(transform.rotation), sin = Math.sin(transform.rotation);
    return { x: transform.x + x * cos - y * sin, y: transform.y + x * sin + y * cos };
  }

  function translationForCenter(center, anchor, rotation, mirrored) {
    const offset = worldPoint({ x: 0, y: 0, rotation, mirrored }, center);
    return { x: anchor.x - offset.x, y: anchor.y - offset.y };
  }

  function compose(parent, child, sketchId) {
    return { ...child, sketchId,
      get mirrored() { return Boolean(parent.mirrored) !== Boolean(child.mirrored); },
      get x() { return worldPoint(parent, child).x; },
      get y() { return worldPoint(parent, child).y; },
      get rotation() { return parent.rotation + (parent.mirrored ? -child.rotation : child.rotation); },
    };
  }

  window.BlockTransform = Object.freeze({ worldAngle, worldPoint, translationForCenter, compose });
})();

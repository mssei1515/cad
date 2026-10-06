/* Parallel linear dimension placement, independent of selection, UI and history. */
(() => {
  "use strict";
  function create({ placement, Line }) {
    function snapshot(constraint, target) {
      const linear = target && (["point-point", "line-length", "point-line", "line-circle", "line-line"].includes(target.kind)
        || target.kind === "offset-distance" && target.source instanceof Line && target.offset instanceof Line);
      if (!linear) return null;
      const dimension = constraint.dimension || placement.defaultDimensionForTarget(target);
      const axis = placement.storedDimensionAxis(target, dimension);
      const direction = placement.targetDirection({ ...target, dimensionAxis: axis });
      const anchor = placement.dimensionAnchor(target, dimension);
      if (![direction.x, direction.y, anchor.x, anchor.y].every(Number.isFinite)) return null;
      return { constraint, target: { ...target, dimensionAxis: axis }, dimension: { ...dimension }, anchor, direction };
    }
    function group(entries, reference) {
      if (entries.length < 2 || !entries.some(entry => entry.constraint === reference)) return null;
      const members = entries.map(entry => snapshot(entry.constraint, entry.target));
      if (members.some(member => !member)) return null;
      const basis = members.find(member => member.constraint === reference);
      if (members.some(member => Math.abs(member.direction.x * basis.direction.y - member.direction.y * basis.direction.x) > 1e-8)) return null;
      return { members, basis, normal: { x: -basis.direction.y, y: basis.direction.x } };
    }
    function move(member, normal, distance) {
      const anchor = { x: member.anchor.x + normal.x * distance, y: member.anchor.y + normal.y * distance };
      member.constraint.dimension = { ...member.dimension,
        ...placement.dimensionFromAnchor(member.target, anchor, { allowPointAxis: false }),
        labelOffsetU: member.dimension.labelOffsetU || 0 };
    }
    function translate(group, delta) {
      const distance = delta.x * group.normal.x + delta.y * group.normal.y;
      for (const member of group.members) move(member, group.normal, distance);
    }
    function align(group) {
      let changed = false;
      for (const member of group.members) {
        const distance = (group.basis.anchor.x - member.anchor.x) * group.normal.x
          + (group.basis.anchor.y - member.anchor.y) * group.normal.y;
        if (Math.abs(distance) <= 1e-10) continue;
        move(member, group.normal, distance);
        changed = true;
      }
      return changed;
    }
    return Object.freeze({ group, translate, align });
  }
  window.DimensionLineGroup = Object.freeze({ create });
})();

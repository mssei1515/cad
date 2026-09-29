/* Read-only selection of constraint components and solver inputs. */
(() => {
  "use strict";
  const { Point } = window.GeometrySolver;
  function create({ currentScope, geometryReads, activeSketchId, elementSketchId, constraintSketchId, isVisibleSketchElement, constraintIsOperational, constraintGraphNodes, geometryInstanceDependencyRefs, minimumLength }) {
    const { allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, resolveGeometryRef } = geometryReads;
    function addIntrinsicGraphEdges(adjacency, a, b) {
      if (!a || !b) return;
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      if (!adjacency.has(b)) adjacency.set(b, new Set());
      adjacency.get(a).add(b);
      adjacency.get(b).add(a);
    }

    function buildConstraintAdjacency() {
      const adjacency = new Map();
      for (const p of allGeometryPoints()) {
        if (!adjacency.has(p)) adjacency.set(p, new Set());
        if (p.blockInstance) addIntrinsicGraphEdges(adjacency, p, p.blockInstance);
        if (p.derivedInstance) addIntrinsicGraphEdges(adjacency, p, p.derivedInstance);
      }
      for (const line of allGeometryLines()) {
        addIntrinsicGraphEdges(adjacency, line, line.p1);
        addIntrinsicGraphEdges(adjacency, line, line.p2);
        if (line.blockInstance) addIntrinsicGraphEdges(adjacency, line, line.blockInstance);
        if (line.derivedInstance) addIntrinsicGraphEdges(adjacency, line, line.derivedInstance);
      }
      for (const circle of allGeometryCircles()) {
        addIntrinsicGraphEdges(adjacency, circle, circle.center);
        if (circle.blockInstance) addIntrinsicGraphEdges(adjacency, circle, circle.blockInstance);
        if (circle.derivedInstance) addIntrinsicGraphEdges(adjacency, circle, circle.derivedInstance);
      }
      for (const arc of allGeometryArcs()) {
        addIntrinsicGraphEdges(adjacency, arc, arc.center);
        if (arc.blockInstance) addIntrinsicGraphEdges(adjacency, arc, arc.blockInstance);
        if (arc.derivedInstance) addIntrinsicGraphEdges(adjacency, arc, arc.derivedInstance);
      }
      for (const spline of allGeometrySplines()) {
        for (const point of spline.fitPoints) addIntrinsicGraphEdges(adjacency, spline, point);
        if (spline.blockInstance) addIntrinsicGraphEdges(adjacency, spline, spline.blockInstance);
        if (spline.derivedInstance) addIntrinsicGraphEdges(adjacency, spline, spline.derivedInstance);
      }
      for (const instance of currentScope().geometryInstances) {
        if (!adjacency.has(instance)) adjacency.set(instance, new Set());
        for (const ref of geometryInstanceDependencyRefs(instance)) addIntrinsicGraphEdges(adjacency, instance, resolveGeometryRef(ref));
      }

      for (const constraint of currentScope().constraints) {
        if (!constraintIsOperational(constraint)) continue;
        const nodes = constraintGraphNodes(constraint);
        for (const node of nodes) {
          if (!adjacency.has(node)) adjacency.set(node, new Set());
        }
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) addIntrinsicGraphEdges(adjacency, nodes[i], nodes[j]);
        }
      }
      return adjacency;
    }

    function connectedComponentFromSeeds(seeds) {
      const adjacency = buildConstraintAdjacency();
      const seen = new Set();
      const queue = [];
      for (const seed of seeds) {
        if (!seed || seen.has(seed)) continue;
        seen.add(seed);
        queue.push(seed);
      }
      while (queue.length > 0) {
        const node = queue.shift();
        // A fixed point is a kinematic boundary: it contributes a constant to
        // constraints on either side, but motion cannot propagate through it to
        // otherwise independent geometry. Stopping here keeps large anchored
        // sketches local during interactive dragging.
        if (node instanceof Point && node.fixed) continue;
        for (const next of adjacency.get(node) || []) {
          if (seen.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      return seen;
    }

    function localSolveVariables(component, sketchId = activeSketchId()) {
      const vars = [];
      for (const instance of currentScope().geometryInstances) {
        if (instance.type !== "free" || instance.sketchId !== sketchId || !component.has(instance)) continue;
        for (const prop of ["x", "y", "rotation"]) vars.push({ object: instance, prop, label: `${instance.id}.${prop}` });
      }
      for (const p of currentScope().points) {
        if (!isVisibleSketchElement(p)) continue;
        if (component.has(p) && elementSketchId(p) === sketchId && !p.fixed) {
          vars.push({ object: p, prop: "x", label: `${p.id}.x` });
          vars.push({ object: p, prop: "y", label: `${p.id}.y` });
        }
      }
      for (const c of currentScope().circles) {
        if (component.has(c) && elementSketchId(c) === sketchId) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: minimumLength });
      }
      for (const a of currentScope().arcs) {
        if (component.has(a) && elementSketchId(a) === sketchId) {
          vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: minimumLength });
          vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
          vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
        }
      }
      for (const instance of currentScope().blockInstances) {
        if (!component.has(instance) || instance.sketchId !== sketchId || instance.fixed) continue;
        vars.push({ object: instance, prop: "x", label: `${instance.id}.x` });
        vars.push({ object: instance, prop: "y", label: `${instance.id}.y` });
        if (!instance.rotationLocked) vars.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
      }
      return vars;
    }

    function localSolveConstraints(component, sketchId = activeSketchId()) {
      return currentScope().constraints.filter((constraint) =>
        constraintIsOperational(constraint)
        && constraintSketchId(constraint) === sketchId
        && constraintGraphNodes(constraint).some((node) => component.has(node) && !(node instanceof Point && node.fixed)),
      );
    }

    function localSolveLines(component, sketchId = activeSketchId()) {
      return currentScope().lines.filter((line) => component.has(line) && elementSketchId(line) === sketchId);
    }

    function sketchSolveVariables(sketchId = activeSketchId()) {
      const vars = [];
      for (const instance of currentScope().geometryInstances) {
        if (instance.type !== "free" || instance.sketchId !== sketchId) continue;
        for (const prop of ["x", "y", "rotation"]) vars.push({ object: instance, prop, label: `${instance.id}.${prop}` });
      }
      for (const p of currentScope().points) {
        if (elementSketchId(p) === sketchId && !p.fixed) {
          vars.push({ object: p, prop: "x", label: `${p.id}.x` });
          vars.push({ object: p, prop: "y", label: `${p.id}.y` });
        }
      }
      for (const c of currentScope().circles) {
        if (elementSketchId(c) === sketchId) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: minimumLength });
      }
      for (const a of currentScope().arcs) {
        if (elementSketchId(a) === sketchId) {
          vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: minimumLength });
          vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
          vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
        }
      }
      for (const instance of currentScope().blockInstances) {
        if (instance.sketchId !== sketchId || instance.fixed) continue;
        vars.push({ object: instance, prop: "x", label: `${instance.id}.x` });
        vars.push({ object: instance, prop: "y", label: `${instance.id}.y` });
        if (!instance.rotationLocked) vars.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
      }
      return vars;
    }

    function sketchSolveConstraints(sketchId = activeSketchId()) {
      return currentScope().constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId);
    }

    function sketchSolveLines(sketchId = activeSketchId()) {
      return currentScope().lines.filter((line) => elementSketchId(line) === sketchId);
    }

    function localSolveContextFromSeeds(seeds, sketchId = activeSketchId()) {
      const component = connectedComponentFromSeeds(seeds);
      return {
        component,
        variables: localSolveVariables(component, sketchId),
        constraints: localSolveConstraints(component, sketchId),
        lines: localSolveLines(component, sketchId),
      };
    }

    return Object.freeze({ connectedComponentFromSeeds, localSolveVariables, localSolveConstraints, localSolveLines, sketchSolveVariables, sketchSolveConstraints, sketchSolveLines, localSolveContextFromSeeds });
  }
  window.SolveScopeQuery = Object.freeze({ create });
})();

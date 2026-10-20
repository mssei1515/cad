/* Resolve instance source and placement input through the existing command owners. */
(() => {
  "use strict";
  function create({ getMode, instanceSourceCommand, geometryInstanceCommand, hitReferenceTarget, hitDerivedProjectionOperand,
    hitBlockProjectionOperand, operandElement, toggleSketchProjectionSource, hitHatch = () => null, clearSnap, selectionRectangle,
    capturePointer, snapForDrawing, getSnap = () => null, makeConstraintOperand, setHint, applicationText, releasePanelFocus }) {
    function click(e, p, { hitP, hitL, hitC, hitA, hitS, hatchHit }) {
      if (["instance-sources", "sketch-projection"].includes(getMode()) || getMode().startsWith("pattern-placement-")) releasePanelFocus();
      if (getMode() === "instance-sources") {
        e.preventDefault();
        const operand = instanceSourceCommand.instance.type === "sketchProjection"
          ? hitReferenceTarget(p.x, p.y)
          : hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y);
        const item = operand ? operandElement(operand) : hitP || hitL || hitC || hitA || hitS || hatchHit || hitHatch(p);
        if (item) instanceSourceCommand.toggle(item);
        else { clearSnap(); selectionRectangle.begin(p, { kind: "instance-sources" }); capturePointer(e.pointerId); }
        return true;
      }
      if (getMode() === "sketch-projection") {
        e.preventDefault();
        const target = hitReferenceTarget(p.x, p.y);
        if (target) {
          toggleSketchProjectionSource(target);
          return true;
        }
        const hatch = hitHatch(p);
        if (hatch) { toggleSketchProjectionSource({ kind: "hatch", item: hatch }); return true; }
        clearSnap();
        selectionRectangle.begin(p, { kind: "sketch-projection" });
        capturePointer(e.pointerId);
        return true;
      }
      if (getMode().startsWith("pattern-placement-") && geometryInstanceCommand.activeInput === "sources") {
        e.preventDefault();
        const operand = hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y);
        const item = operand ? operandElement(operand) : hitP || hitL || hitC || hitA || hitS || hatchHit;
        if (item) geometryInstanceCommand.toggleSource(item);
        else { clearSnap(); selectionRectangle.begin(p, { kind: "instance-sources" }); capturePointer(e.pointerId); }
        return true;
      }
      if (getMode().startsWith("pattern-placement-")) {
        const point = snapForDrawing(p);
        if (geometryInstanceCommand.activeInput === "reference") geometryInstanceCommand.selectReference(hitL || getSnap()?.data?.line);
        else geometryInstanceCommand.placeFree(point, getSnap());
        return true;
      }

      return false;
    }
    return Object.freeze({ click });
  }
  function createRectangleSources({ getMode, instanceSourceCommand, geometryInstanceCommand, query, geometryReads,
    sketchProjectionEntriesByRect, elementSketchId, activeSketchId, isVisibleSketchElement }) {
    const { allGeometryPoints, allGeometryLines, allGeometryCircles, allGeometryArcs, allGeometrySplines, allHatches } = geometryReads;
    function add(rect, crossing) {
      if (getMode() === "instance-sources" && instanceSourceCommand.instance?.type === "sketchProjection") {
        const entries = sketchProjectionEntriesByRect(rect, crossing);
        instanceSourceCommand.addSources(entries.map(entry => entry.item));
      } else {
        const items = query.readProjection(rect, crossing, {
          points: allGeometryPoints, lines: allGeometryLines, circles: allGeometryCircles,
          arcs: allGeometryArcs, splines: allGeometrySplines, hatches: allHatches,
        }, item => elementSketchId(item) === activeSketchId() && isVisibleSketchElement(item) ? item : null);
        (getMode() === "instance-sources" ? instanceSourceCommand : geometryInstanceCommand).addSources(items);
      }
    }
    return Object.freeze({ add });
  }
  window.InstanceCommandInput = Object.freeze({ create, createRectangleSources });
})();

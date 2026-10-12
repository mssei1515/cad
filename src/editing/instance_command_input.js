/* Resolve instance source and placement input through the existing command owners. */
(() => {
  "use strict";
  function create({ getMode, instanceSourceCommand, geometryInstanceCommand, hitReferenceTarget, hitDerivedProjectionOperand,
    hitBlockProjectionOperand, operandElement, toggleSketchProjectionSource, hitHatch = () => null, clearSnap, selectionRectangle,
    capturePointer, snapForDrawing, makeConstraintOperand, setHint, applicationText, releasePanelFocus }) {
    function click(e, p, { hitP, hitL, hitC, hitA, hitS, hatchHit }) {
      if (["instance-sources", "sketch-projection", "mirror-axis", "pattern-direction"].includes(getMode()) || getMode().startsWith("free-instance-")) releasePanelFocus();
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
      if ((getMode().startsWith("free-instance-") || ["mirror-axis", "pattern-direction"].includes(getMode())) && geometryInstanceCommand.activeInput === "sources") {
        e.preventDefault();
        const operand = hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y);
        const item = operand ? operandElement(operand) : hitP || hitL || hitC || hitA || hitS || hatchHit;
        if (item) geometryInstanceCommand.toggleSource(item);
        else { clearSnap(); selectionRectangle.begin(p, { kind: "instance-sources" }); capturePointer(e.pointerId); }
        return true;
      }
      if (getMode().startsWith("free-instance-")) {
        geometryInstanceCommand.placeFree(snapForDrawing(p));
        return true;
      }
      if (getMode() === "mirror-axis" || getMode() === "pattern-direction") {
        e.preventDefault();
        const operand = hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y) || (hitL ? makeConstraintOperand("line", { line: hitL }) : null);
        if (operand?.kind === "line") geometryInstanceCommand.selectReference(operand.line);
        else setHint(applicationText("基準にする線をクリックしてください", "Click a reference line."), "error");
        return true;
      }

      return false;
    }
    return Object.freeze({ click });
  }
  window.InstanceCommandInput = Object.freeze({ create });
})();

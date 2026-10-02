/* Resolve instance source and placement input through the existing command owners. */
(() => {
  "use strict";
  function create({ getMode, instanceSourceCommand, geometryInstanceCommand, hitReferenceTarget, hitDerivedProjectionOperand,
    hitBlockProjectionOperand, operandElement, toggleSketchProjectionSource, clearSnap, selectionRectangle,
    capturePointer, snapForDrawing, makeConstraintOperand, setHint, applicationText }) {
    function click(e, p, { hitP, hitL, hitC, hitA, hitS }) {
      if (getMode() === "instance-sources") {
        e.preventDefault();
        const operand = instanceSourceCommand.instance.type === "sketchProjection"
          ? hitReferenceTarget(p.x, p.y)
          : hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y);
        instanceSourceCommand.toggle(operand ? operandElement(operand) : hitP || hitL || hitC || hitA || hitS);
        return true;
      }
      if (getMode() === "sketch-projection") {
        e.preventDefault();
        const target = hitReferenceTarget(p.x, p.y);
        if (target) {
          toggleSketchProjectionSource(target);
          return true;
        }
        clearSnap();
        selectionRectangle.begin(p, { kind: "sketch-projection" });
        capturePointer(e.pointerId);
        return true;
      }
      if (getMode().startsWith("free-instance-")) {
        geometryInstanceCommand.placeFree(snapForDrawing(p));
        return true;
      }
      if (getMode() === "mirror-axis" || getMode() === "pattern-direction") {
        e.preventDefault();
        const operand = hitDerivedProjectionOperand(p.x, p.y) || hitBlockProjectionOperand(p.x, p.y) || (hitL ? makeConstraintOperand("line", { line: hitL }) : null);
        if (operand?.kind === "line") geometryInstanceCommand.commitReference(operand.line);
        else setHint(applicationText("基準にする線をクリックしてください", "Click a reference line."), "error");
        return true;
      }

      return false;
    }
    return Object.freeze({ click });
  }
  window.InstanceCommandInput = Object.freeze({ create });
})();

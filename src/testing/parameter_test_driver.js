/* Parameter browser fixtures, observations and existing edit operations with explicit ownership. */
(() => {
  "use strict";
  function createFixture({ resetModelState, addPoint, addLine, pushModelConstraint, HorizontalConstraint, DistanceConstraint, dimensionFromAnchor, currentScope, formatParameterReference, createEmptyBlockDefinition, Point, Line, DEFAULT_SKETCH_ID, ensureParameterNamespace, appendDefinition, nextInstanceId, invalidateBlockProjectionCache, stabilizeActiveParameterNamespace, activeSketchId, resetHistory, updateUI, draw }) {
    function reset() {
      resetModelState();
      const p1 = addPoint(0, 0, true, "endpoint");
      const p2 = addPoint(100, 0, false, "endpoint");
      const drivenLine = addLine(p1, p2);
      pushModelConstraint(new HorizontalConstraint(drivenLine));
      const driven = new DistanceConstraint(p1, p2, 100);
      driven.dimension = dimensionFromAnchor({ kind: "line-length", line: drivenLine, p1, p2, value: 100 }, { x: 50, y: -30 });
      pushModelConstraint(driven);
      const p3 = addPoint(0, 60, true, "endpoint");
      const p4 = addPoint(40, 60, true, "endpoint");
      const measuredLine = addLine(p3, p4);
      const measured = new DistanceConstraint(p3, p4, 40);
      measured.dimension = dimensionFromAnchor({ kind: "line-length", line: measuredLine, p1: p3, p2: p4, value: 40 }, { x: 20, y: 85 });
      measured.readOnlyDimension = true;
      measured.enabled = false;
      pushModelConstraint(measured);
      currentScope().parameters = [
        { name: "width", expression: `${formatParameterReference(measured.parameterName)} * 2` },
        { name: "margin", expression: "10" },
      ];
      driven.expression = '"width" / 2 + "margin"';
      const definition = createEmptyBlockDefinition("Param Block");
      const bp1 = new Point("BP1", 0, 0, true, "endpoint");
      const bp2 = new Point("BP2", 25, 0, false, "endpoint");
      bp1.sketchId = DEFAULT_SKETCH_ID;
      bp2.sketchId = DEFAULT_SKETCH_ID;
      const blockLine = new Line("BL1", bp1, bp2);
      blockLine.sketchId = DEFAULT_SKETCH_ID;
      const blockHorizontal = new HorizontalConstraint(blockLine);
      blockHorizontal.sketchId = DEFAULT_SKETCH_ID;
      const blockDimension = new DistanceConstraint(bp1, bp2, 25);
      blockDimension.sketchId = DEFAULT_SKETCH_ID;
      blockDimension.dimension = { x: 12.5, y: -20 };
      definition.points.push(bp1, bp2);
      definition.lines.push(blockLine);
      definition.constraints.push(blockHorizontal, blockDimension);
      definition.parameters = [{ name: "width", expression: "25" }];
      ensureParameterNamespace(definition);
      blockDimension.expression = '"width"';
      appendDefinition(definition);
      currentScope().blockInstances.push({ id: nextInstanceId(), definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: 180, y: 0, rotation: 0, fixed: false, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} });
      const otherDefinition = createEmptyBlockDefinition("Other Param Block");
      const op1 = new Point("BP1", 0, 0, true, "endpoint");
      const op2 = new Point("BP2", 15, 0, false, "endpoint");
      op1.sketchId = DEFAULT_SKETCH_ID;
      op2.sketchId = DEFAULT_SKETCH_ID;
      const otherLine = new Line("BL1", op1, op2);
      otherLine.sketchId = DEFAULT_SKETCH_ID;
      const otherHorizontal = new HorizontalConstraint(otherLine);
      otherHorizontal.sketchId = DEFAULT_SKETCH_ID;
      const otherDimension = new DistanceConstraint(op1, op2, 15);
      otherDimension.sketchId = DEFAULT_SKETCH_ID;
      otherDimension.dimension = { x: 7.5, y: -20 };
      otherDefinition.points.push(op1, op2);
      otherDefinition.lines.push(otherLine);
      otherDefinition.constraints.push(otherHorizontal, otherDimension);
      otherDefinition.parameters = [{ name: "width", expression: "15" }];
      ensureParameterNamespace(otherDefinition);
      otherDimension.expression = '"width"';
      appendDefinition(otherDefinition);
      currentScope().blockInstances.push({ id: nextInstanceId(), definitionId: otherDefinition.id, sketchId: DEFAULT_SKETCH_ID, x: 260, y: 0, rotation: 0, fixed: false, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} });
      invalidateBlockProjectionCache();
      const result = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: [activeSketchId()] });
      resetHistory("parameter test");
      updateUI();
      draw();
      return { success: result.success, drivenName: driven.parameterName, measuredName: measured.parameterName, length: drivenLine.length() };
    }

    function resetFeedback() {
      resetModelState();
      const p1 = addPoint(0, 0, true, "endpoint");
      const p2 = addPoint(40, 0, false, "endpoint");
      const line = addLine(p1, p2);
      pushModelConstraint(new HorizontalConstraint(line));
      const driving = new DistanceConstraint(p1, p2, 40);
      driving.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 40 }, { x: 20, y: -25 });
      pushModelConstraint(driving);
      const measured = new DistanceConstraint(p1, p2, 40);
      measured.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 40 }, { x: 20, y: 25 });
      measured.readOnlyDimension = true;
      measured.enabled = false;
      pushModelConstraint(measured);
      driving.expression = "40";
      const result = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: [activeSketchId()] });
      resetHistory("parameter feedback test");
      updateUI();
      draw();
      return { success: result.success, drivingName: driving.parameterName, measuredName: measured.parameterName, length: line.length() };
    }
    return Object.freeze({ reset, resetFeedback });
  }

  function createObservation({ currentScope, readDocument, validateParameterNamespace, dimensionConstraintsInNamespace, isReadOnlyDimension, dimensionExpressionValue, blockProjectionBundle, serializeModel }) {
    function state() {
      const evaluation = validateParameterNamespace(currentScope());
      return {
        valid: evaluation.success,
        parameters: currentScope().parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression, value: parameter.evaluatedValue })),
        dimensions: dimensionConstraintsInNamespace(currentScope()).map((constraint) => ({
          name: constraint.parameterName,
          expression: constraint.expression || null,
          readOnly: isReadOnlyDimension(constraint),
          value: constraint.evaluatedParameterValue,
          target: dimensionExpressionValue(constraint),
        })),
        blockNamespaces: readDocument().blockDefinitions.map((definition) => ({
          id: definition.id,
          parameters: definition.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
          dimensions: dimensionConstraintsInNamespace(definition).map((constraint) => ({ name: constraint.parameterName, expression: constraint.expression, target: dimensionExpressionValue(constraint) })),
          lineLengths: definition.lines.map((line) => line.length()),
        })),
        instanceProjectionLengths: currentScope().blockInstances.flatMap((instance) => blockProjectionBundle(instance).lines.map((line) => line.length())),
        serialized: serializeModel(),
      };
    }
    return Object.freeze({ state });
  }

  function createInteraction({ currentScope, clearSelection, canvasSelection, blockSelectionGeometry, createBlockDefinitionFromSelection, blockSelectionBoundsCenter, dimensionConstraintsInNamespace, deleteElements, document }) {
    function freezeBlock() {
      const line = currentScope().lines[0];
      if (!line) return null;
      clearSelection();
      canvasSelection.set("lines", [line]);
      const selection = blockSelectionGeometry();
      if (selection.error) return { error: selection.error };
      const definition = createBlockDefinitionFromSelection(selection, blockSelectionBoundsCenter(selection), "Frozen Formula Block");
      const dimension = dimensionConstraintsInNamespace(definition)[0];
      return {
        parameters: definition.parameters,
        name: dimension?.parameterName || null,
        expression: dimension?.expression || null,
        sourceExpression: dimensionConstraintsInNamespace(currentScope())[0]?.expression || null,
      };
    }

    function deleteDimension(name) {
      const constraint = dimensionConstraintsInNamespace(currentScope()).find((item) => item.parameterName === name);
      const deleted = constraint ? deleteElements({ constraints: [constraint] }) : false;
      return { deleted, names: dimensionConstraintsInNamespace(currentScope()).map((item) => item.parameterName), hint: document.getElementById("hint")?.textContent || "" };
    }
    return Object.freeze({ freezeBlock, deleteDimension });
  }
  window.ParameterTestDriver = Object.freeze({ createFixture, createObservation, createInteraction });
})();

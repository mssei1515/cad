/* Translate Properties DOM events into explicit editing operations. No model state is owned here. */
(() => {
  "use strict";
  function create({ HTMLTextAreaElement, HTMLInputElement, Spline, selectedPropertiesTarget,
    elementPropertyCommand, appearancePropertyCommand, geometryPropertyCommand, applyMultipleProperty,
    changeFreeInstanceProperty, commitDimensionPropertyEdit, updateUI, updatePropertiesUI, draw,
    applicationText, setHint, setPlacementRotationLocked, setPlacementSketchIds,
    setBlockInstanceRotationLocked, setBlockInstanceEnabledSketchIds, setBlockInstanceOrthogonalRotation,
    startInstanceSourceEdit, startReferenceImageCalibration, startHatchBoundaryRepair, startSplineEdit,
    openAppearanceColorPalette }) {
    function sketchDefaultAppearanceContext(input, target = selectedPropertiesTarget()) {
      if (target.kind !== "sketch") return null;
      return input.closest("[data-sketch-default-appearance]")?.dataset.sketchDefaultAppearance || null;
    }

    function applyAppearancePropertyInput(target, input, { commit = true, rawValue } = {}) {
      const data = input.dataset;
      const category = target.kind === "annotation" && data.annotationStyle ? "annotation"
        : target.kind === "hatch" && data.hatchProperty ? "hatch"
          : data.appearanceKey ? "appearance" : data.dimensionDisplay ? "dimension" : null;
      if (!category) return false;
      const key = category === "annotation" ? data.annotationStyle : category === "hatch" ? data.hatchProperty
        : category === "appearance" ? data.appearanceKey : data.dimensionDisplay;
      let value = rawValue;
      if (commit || category === "dimension" && target.kind === "constraint") {
        value = category === "dimension" && ["prefix", "suffix"].includes(key) ? input.value : input.value.trim();
        if (input.type === "checkbox" && (category === "annotation" || category === "hatch")) value = input.checked;
        if (input.type === "checkbox" && category === "dimension" && target.kind === "constraint") value = String(input.checked);
      }
      return appearancePropertyCommand.apply(target, { category, key, value, context: sketchDefaultAppearanceContext(input, target) }, { commit });
    }

    function handlePropertiesInput(event) {
      if (event.target.dataset.freeInstanceProperty) return;
      const input = event.target;
      const target = selectedPropertiesTarget();
      const isTextInput = input instanceof HTMLTextAreaElement
        || input instanceof HTMLInputElement && ["text", "number"].includes(input.type);
      if (!isTextInput) return;
      if (target.kind === "referenceImage" && input.dataset.referenceImageProperty) {
        const raw = input.value;
        if (input.type !== "number" || raw !== "" && input.validity.valid && Number.isFinite(Number(raw))) {
          elementPropertyCommand.referenceImage(target.item, input.dataset.referenceImageProperty, raw, { commit: false });
        }
        return;
      }
      if (target.kind === "annotation" && input.dataset.property === "annotation-text") {
        elementPropertyCommand.annotation(target.item, "annotation-text", input.value, { commit: false });
        return;
      }
      if (target.kind === "constraint" && ["constraint-parameter-name", "constraint-expression"].includes(input.dataset.property)) return;
      if (target.kind === "geometryInstance" && input.dataset.geometryInstanceProperty && input.type === "number") {
        elementPropertyCommand.geometryInstance(target.item, input.dataset.geometryInstanceProperty, input.value, { commit: false });
        return;
      }
      const rawValue = input.type === "number" || input.dataset.annotationStyle || input.dataset.hatchProperty || input.dataset.bulkProperty || input.dataset.appearanceKey
        ? input.value.trim()
        : input.value;
      const appearanceAllowsEmpty = Boolean(input.dataset.appearanceKey || input.dataset.dimensionDisplay);
      const colorInput = input.dataset.appearanceKey === "color"
        || input.dataset.dimensionDisplay === "color"
        || input.dataset.annotationStyle === "color"
        || input.dataset.hatchProperty === "color"
        || input.dataset.bulkProperty === "color";
      if (rawValue === "" && !appearanceAllowsEmpty) return;
      if (input.type === "number" && rawValue !== "" && (!input.validity.valid || !Number.isFinite(Number(rawValue)))) return;
      if (colorInput && rawValue !== "" && !/^#[0-9a-fA-F]{6}$/.test(rawValue)) return;
      if (target.kind === "multiple" && input.dataset.bulkProperty) {
        applyMultipleProperty(target, input.dataset.bulkProperty, rawValue, { commit: false });
        return;
      }
      if (target.kind === "annotation" && input.dataset.property === "annotation-rotation") {
        elementPropertyCommand.annotation(target.item, "annotation-rotation", rawValue, { commit: false });
        return;
      }
      applyAppearancePropertyInput(target, input, { commit: false, rawValue });
    }

    function handlePropertiesChange(event) {
      const target = selectedPropertiesTarget();
      const input = event.target;
      if (target.kind === "geometryInstance" && input.dataset.freeInstanceProperty) {
        changeFreeInstanceProperty(target.item, input.dataset.freeInstanceProperty, input.type === "checkbox" ? input.checked : input.value);
        updateUI();
        draw();
        return;
      }
      if (target.kind === "geometryInstance" && input.dataset.geometryInstanceProperty) {
        elementPropertyCommand.geometryInstance(target.item, input.dataset.geometryInstanceProperty, input.type === "checkbox" ? input.checked : input.value);
        return;
      }
      if (target.kind === "referenceImage" && input.dataset.referenceImageProperty) {
        const raw = input.type === "checkbox" ? input.checked : input.value;
        elementPropertyCommand.referenceImage(target.item, input.dataset.referenceImageProperty, raw);
        return;
      }
      if (target.kind === "multiple" && input.dataset.bulkProperty) {
        const raw = input.type === "checkbox" ? input.checked : input.value.trim();
        applyMultipleProperty(target, input.dataset.bulkProperty, raw);
        return;
      }
      if (target.kind === "blockPlacement" && input.dataset.placementRotationMode) {
        const locked = input.dataset.placementRotationMode === "locked";
        setPlacementRotationLocked(locked);
        setHint(locked ? applicationText("配置角度を90°単位にロックします", "Placement rotation is locked to 90° increments") : applicationText("配置角度を自由回転にします", "Placement rotation is free"));
        draw();
        return;
      }
      if (target.kind === "blockPlacement" && input.dataset.placementSketchId) {
        setPlacementSketchIds([...input.closest("#propertiesPanel").querySelectorAll("input[data-placement-sketch-id]:checked")].map((item) => item.dataset.placementSketchId));
        draw();
        return;
      }
      if (applyAppearancePropertyInput(target, input)) return;
      if (target.kind === "block" && input.dataset.blockRotationMode) {
        if (!setBlockInstanceRotationLocked(target.item, input.dataset.blockRotationMode === "locked")) updatePropertiesUI();
        return;
      }
      if (target.kind === "block" && input.dataset.blockSketchId) {
        const next = [...input.closest("#propertiesPanel").querySelectorAll("input[data-block-sketch-id]:checked")].map((item) => item.dataset.blockSketchId);
        if (!setBlockInstanceEnabledSketchIds(target.item, next)) updatePropertiesUI();
        return;
      }
      const property = input.dataset.property;
      if (!property) return;
      if (target.kind === "block" && property === "block-orthogonal-rotation") {
        if (!setBlockInstanceOrthogonalRotation(target.item, Number(input.value) * Math.PI / 180)) updatePropertiesUI();
        return;
      }
      if (target.kind === "geometry" && (property === "construction" || target.item instanceof Spline && property === "spline-closed")) {
        const result = property === "construction"
          ? geometryPropertyCommand.setConstruction(target.item, input.checked)
          : geometryPropertyCommand.setSplineClosed(target.item, input.checked);
        if (Object.hasOwn(result, "checked")) input.checked = result.checked;
        if (result.message) setHint(result.message, "error");
        if (result.refresh === "properties") updatePropertiesUI();
        else if (result.refresh === "all") updateUI();
        if (result.refresh) draw();
        return;
      } else if (target.kind === "constraint" && (property === "constraint-parameter-name" || property === "constraint-expression")) {
        commitDimensionPropertyEdit(target.item, property, input.value);
        updateUI();
        draw();
        return;
      } else if (target.kind === "annotation") {
        elementPropertyCommand.annotation(target.item, property, property === "annotation-visible" ? input.checked : input.value);
        return;
      }
      updateUI();
      draw();
    }

    function handlePropertiesClick(event) {
      const action = event.target.closest("[data-property-action]")?.dataset.propertyAction;
      if (action === "instance-sources") return startInstanceSourceEdit(selectedPropertiesTarget().item);
      if (action === "reference-image-calibrate") {
        const target = selectedPropertiesTarget();
        return target.kind === "referenceImage" ? startReferenceImageCalibration(target.item) : false;
      }
      if (action === "hatch-repair") {
        const target = selectedPropertiesTarget();
        return target.kind === "hatch" ? startHatchBoundaryRepair(target.item) : false;
      }
      if (action === "spline-edit") {
        const target = selectedPropertiesTarget();
        if (target.kind !== "geometry" || !(target.item instanceof Spline) || target.item.blockProjection) return false;
        startSplineEdit(target.item);
        setHint(applicationText(`${target.item.id} の通過点を編集します。Escまたは空白のダブルクリックで終了します`, `Editing fit points of ${target.item.id}. Press Esc or double-click blank canvas to finish.`));
        draw();
        return true;
      }
      const button = event.target.closest("[data-appearance-palette-open]");
      if (!button) return;
      const sketchContext = sketchDefaultAppearanceContext(button);
      openAppearanceColorPalette(button, sketchContext ? `sketch-${sketchContext}` : "properties");
    }
    return Object.freeze({ input: handlePropertiesInput, change: handlePropertiesChange, click: handlePropertiesClick });
  }
  window.PropertiesController = Object.freeze({ create });
})();

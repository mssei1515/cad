/* Own independently editable inputs and creation of free, mirror and pattern instances. */
(() => {
  "use strict";
  function create({ cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    selectedItemsForGeometryInstance, geometryRefForItem, geometryRefsEqual, isVisibleSketchElement, clearSelection, normalizeGeometryInstance,
    previewFreeId, nextInstanceId, activeSketchId, getMode, setMode, updateToolbar, updateUI,
    applicationText, setHint, draw, currentScope, canvasSelection, recordHistory,
    Line, lineHasDirection, elementSketchId, resolveGeometryRef, createGeometryInstanceBundle }) {
    let freeInstancePlacement = null;
    let sources = [];
    let referenceRef = null;
    let commandType = null;
    let activeInput = "sources";
    let origin = null;
    let destination = null;
    let previewingDestination = false;
    let settings = { spacing: 10, copies: 2, reversed: false };
    const active = () => commandType === "free" ? getMode().startsWith("free-instance-")
      : commandType === "mirror" ? getMode() === "mirror-axis" : commandType === "pattern" && getMode() === "pattern-direction";
    const reference = () => referenceRef ? resolveGeometryRef(referenceRef) : null;
    function refresh() {
      if (freeInstancePlacement) freeInstancePlacement.sources = [...sources];
      updateToolbar();
      updateUI({ refreshAnalysis: false });
      draw();
    }
    function start(type) {
      const selected = selectedItemsForGeometryInstance();
      cancelConstraintTargetCommand("");
      cancelPendingCommand("");
      if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
      reset();
      commandType = type;
      sources = selected.map(geometryRefForItem).filter(Boolean);
      settings = { spacing: 10, copies: 2, reversed: false };
      clearSelection();
      if (type === "free") {
        freeInstancePlacement = normalizeGeometryInstance({ id: previewFreeId(), type: "free", sources, sketchId: activeSketchId() });
        setMode("free-instance-origin");
      } else setMode(type === "mirror" ? "mirror-axis" : "pattern-direction");
      activeInput = sources.length ? (type === "free" ? "origin" : "reference") : "sources";
      setHint(applicationText("リストで入力項目を選び、キャンバスで指定してください。完了で確定、Escでキャンセル", "Select an input in the list, then pick on the canvas. Finish confirms; Esc cancels."));
      refresh();
    }
    function selectInput(key) {
      if (!active() || !["sources", ...(commandType === "free" ? ["origin", "destination"] : ["reference"])].includes(key)) return false;
      activeInput = key;
      previewingDestination = key === "destination";
      if (commandType === "free") setMode(key === "destination" || origin ? "free-instance-place" : "free-instance-origin");
      refresh();
      return true;
    }
    function toggleSource(item) {
      if (!active() || !item) return false;
      const ref = geometryRefForItem(item);
      const index = sources.findIndex(source => geometryRefsEqual(source, ref));
      if (index >= 0) return removeInput("sources", index);
      if (!ref || elementSketchId(item) !== activeSketchId() || !isVisibleSketchElement(item)) {
        setHint(applicationText("同じSketchの表示中の図形を選択してください", "Select visible geometry in the same sketch."), "error");
        return false;
      }
      sources.push(ref);
      refresh();
      return true;
    }
    function removeInput(key, index = 0) {
      if (!active()) return false;
      if (key === "sources") {
        if (!Number.isInteger(index) || index < 0 || index >= sources.length) return false;
        sources.splice(index, 1);
      } else if (key === "reference") referenceRef = null;
      else if (key === "origin") origin = null;
      else if (key === "destination") destination = null;
      else return false;
      activeInput = key;
      previewingDestination = key === "destination";
      refresh();
      return true;
    }
    function placeFree(pointer) {
      if (!active() || commandType !== "free" || !["origin", "destination"].includes(activeInput)
        || !Number.isFinite(pointer?.x) || !Number.isFinite(pointer?.y)) return false;
      const point = { x: pointer.x, y: pointer.y };
      if (activeInput === "origin") {
        origin = point;
        freeInstancePlacement.origin = { ...point };
      } else {
        destination = point;
        Object.assign(freeInstancePlacement, point);
        previewingDestination = false;
      }
      setMode(origin ? "free-instance-place" : "free-instance-origin");
      refresh();
      return true;
    }
    function validReference(line) {
      return line instanceof Line && lineHasDirection(line) && elementSketchId(line) === activeSketchId() && isVisibleSketchElement(line);
    }
    function selectReference(line) {
      if (!active() || commandType === "free" || !validReference(line)) {
        setHint(applicationText("同じSketchの有効な線を選択してください", "Select a valid line in the same sketch."), "error");
        return false;
      }
      referenceRef = geometryRefForItem(line);
      refresh();
      return true;
    }
    function validSettings() {
      return Number.isFinite(settings.spacing) && settings.spacing > 0 && Number.isInteger(settings.copies) && settings.copies > 0 && settings.copies <= 1000;
    }
    function canFinish() {
      if (!active() || !sources.length || sources.some(ref => {
        const item = resolveGeometryRef(ref);
        return !item || elementSketchId(item) !== activeSketchId() || !isVisibleSketchElement(item);
      })) return false;
      if (commandType === "free") return Boolean(origin && destination);
      return validReference(reference()) && (commandType !== "pattern" || validSettings());
    }
    function finish() {
      if (!canFinish()) return false;
      const type = commandType;
      const id = nextInstanceId(type);
      let instance;
      if (type === "free") {
        instance = freeInstancePlacement;
        Object.assign(instance, { id, sources: [...sources], origin: { ...origin }, x: destination.x, y: destination.y });
      } else {
        const raw = { id, type, sketchId: activeSketchId(), sources: [...sources], appearanceOverride: {} };
        if (type === "mirror") raw.axis = referenceRef;
        else Object.assign(raw, { direction: referenceRef, ...settings });
        instance = normalizeGeometryInstance(raw);
      }
      currentScope().geometryInstances.push(instance);
      reset();
      setMode("select");
      clearSelection();
      canvasSelection.set("geometryInstances", [instance]);
      recordHistory(type === "free" ? "同期インスタンス追加" : type === "mirror" ? "ミラーインスタンス追加" : "パターンインスタンス追加");
      updateToolbar();
      updateUI();
      draw();
      setHint(applicationText("派生インスタンスを作成しました", "Derived instance created."));
      return true;
    }
    function changeSetting(key, value) {
      if (!active() || commandType !== "pattern" || !["spacing", "copies", "reversed"].includes(key)) return false;
      settings[key] = key === "reversed" ? Boolean(value) : String(value).trim() === "" ? NaN : Number(value);
      draw();
      return validSettings();
    }
    function clearSources() { sources = []; referenceRef = null; }
    function clearPlacement() { freeInstancePlacement = null; origin = null; destination = null; previewingDestination = false; }
    function reset() { clearSources(); clearPlacement(); commandType = null; activeInput = "sources"; }
    function preview(pointer) {
      if (!active() || !freeInstancePlacement || !origin || !sources.length) return null;
      const point = previewingDestination && pointer ? pointer : destination;
      if (!point) return null;
      // Preview never overwrites the explicitly picked destination.
      Object.assign(freeInstancePlacement, { x: point.x, y: point.y, origin: { ...origin } });
      const resolved = sources.map(ref => ({ ref, item: resolveGeometryRef(ref) }));
      if (resolved.some(({ item }) => !item)) return null;
      return createGeometryInstanceBundle(freeInstancePlacement, resolved, null, null);
    }
    return Object.freeze({ start, placeFree, selectInput, toggleSource, removeInput, selectReference, canFinish, finish,
      changeSetting, validSettings, clearSources, clearPlacement, reset, preview,
      get activeInput() { return activeInput; },
      get sources() { return [...sources]; },
      get reference() { return reference(); },
      get origin() { return origin && { ...origin }; },
      get destination() { return destination && { ...destination }; },
      get settings() { return { ...settings }; },
      isPlacing: instance => instance === freeInstancePlacement,
      get pending() { return freeInstancePlacement; },
    });
  }
  window.GeometryInstanceCommand = Object.freeze({ create });
})();

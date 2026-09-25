/* Own pending sources and creation of free, mirror and pattern instances. */
(() => {
  "use strict";
  function create({ cancelConstraintTargetCommand, cancelPendingCommand, canCreateInActiveSketch, rejectRootSketchCreation,
    selectedItemsForGeometryInstance, geometryRefForItem, clearSelection, normalizeGeometryInstance,
    previewFreeId, nextInstanceId, activeSketchId, getMode, setMode, updateToolbar, updateUI,
    applicationText, setHint, draw, currentScope, canvasSelection, recordHistory,
    Line, lineHasDirection, elementSketchId, prompt, resolveGeometryRef, createGeometryInstanceBundle }) {
    let freeInstancePlacement = null;
    let geometryInstanceCommandSources = [];
    function startGeometryInstanceCommand(type) {
      cancelConstraintTargetCommand("");
      cancelPendingCommand("");
      if (!canCreateInActiveSketch()) return void rejectRootSketchCreation();
      const sources = selectedItemsForGeometryInstance();
      if (sources.length === 0) {
        setHint(applicationText("同じSketchの複写元Geometryを先に選択してください", "Select source geometry in the active sketch first."), "error");
        return;
      }
      geometryInstanceCommandSources = sources.map(geometryRefForItem).filter(Boolean);
      clearSelection();
      if (type === "free") {
        freeInstancePlacement = normalizeGeometryInstance({ id: previewFreeId(), type: "free", sources: geometryInstanceCommandSources, sketchId: activeSketchId() });
        setMode("free-instance-origin");
        updateToolbar();
        updateUI({ refreshAnalysis: false });
        setHint(applicationText("配置基準点をクリックしてください。Escでキャンセルします", "Click the source anchor. Press Esc to cancel."));
        draw();
        return;
      }
      setMode(type === "mirror" ? "mirror-axis" : "pattern-direction");
      updateToolbar();
      setHint(type === "mirror"
        ? applicationText("対称軸にする線をクリックしてください。Escでキャンセルします", "Click the mirror axis line. Press Esc to cancel.")
        : applicationText("配列方向にする線をクリックしてください。Escでキャンセルします", "Click the pattern direction line. Press Esc to cancel."));
      draw();
    }

    function placeFreeInstance(pointer) {
      if (!freeInstancePlacement) return;
      if (getMode() === "free-instance-origin") {
        freeInstancePlacement.origin = { x: pointer.x, y: pointer.y };
        setMode("free-instance-place");
        setHint(applicationText("配置先をクリックしてください。回転と鏡像はPropertiesで設定できます", "Click the destination. Set rotation and reflection in Properties."));
        updateUI({ refreshAnalysis: false });
      } else {
        Object.assign(freeInstancePlacement, { x: pointer.x, y: pointer.y, id: nextInstanceId("free") });
        const instance = freeInstancePlacement;
        currentScope().geometryInstances.push(instance);
        freeInstancePlacement = null;
        geometryInstanceCommandSources = [];
        setMode("select");
        clearSelection();
        canvasSelection.set("geometryInstances", [instance]);
        recordHistory("同期インスタンス追加");
        updateUI();
        setHint(applicationText("同期インスタンスを作成しました", "Synchronized instance created"));
      }
      updateToolbar();
      draw();
    }

    function commitGeometryInstanceReference(line) {
      if (!(line instanceof Line) || !lineHasDirection(line) || elementSketchId(line) !== activeSketchId()) {
        setHint(applicationText("同じSketchの有効な線を選択してください", "Select a valid line in the active sketch."), "error");
        return false;
      }
      const type = getMode() === "mirror-axis" ? "mirror" : getMode() === "pattern-direction" ? "pattern" : null;
      if (!type || geometryInstanceCommandSources.length === 0) return false;
      let spacing = 10;
      let copies = 2;
      if (type === "pattern") {
        const rawSpacing = prompt(applicationText("パターン間隔 (mm)", "Pattern spacing (mm)"), "10");
        if (rawSpacing == null) return false;
        const rawCopies = prompt(applicationText("コピー数（元図形を含まない）", "Number of copies (excluding source)"), "2");
        if (rawCopies == null) return false;
        spacing = Number(rawSpacing);
        copies = Math.trunc(Number(rawCopies));
        if (!(spacing > 0) || !(copies > 0) || copies > 1000) {
          setHint(applicationText("間隔は正数、コピー数は1〜1000で指定してください", "Spacing must be positive and copies must be from 1 to 1000."), "error");
          return false;
        }
      }
      const id = nextInstanceId(type);
      const raw = { id, type, sketchId: activeSketchId(), sources: geometryInstanceCommandSources, appearanceOverride: {} };
      if (type === "mirror") raw.axis = geometryRefForItem(line);
      else Object.assign(raw, { direction: geometryRefForItem(line), spacing, copies, reversed: false });
      const instance = normalizeGeometryInstance(raw);
      currentScope().geometryInstances.push(instance);
      geometryInstanceCommandSources = [];
      setMode("select");
      clearSelection();
      canvasSelection.set("geometryInstances", [instance]);
      updateToolbar();
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory(type === "mirror" ? "ミラーインスタンス追加" : "パターンインスタンス追加");
      setHint(type === "mirror" ? applicationText("ミラーインスタンスを作成しました", "Mirror instance created") : applicationText("パターンインスタンスを作成しました", "Pattern instance created"));
      return true;
    }
    function clearSources() { geometryInstanceCommandSources = []; }
    function clearPlacement() { freeInstancePlacement = null; }
    function reset() { clearSources(); clearPlacement(); }
    function preview(pointer) {
      if (getMode() !== "free-instance-place" || !freeInstancePlacement || !pointer) return null;
      Object.assign(freeInstancePlacement, { x: pointer.x, y: pointer.y });
      const sources = freeInstancePlacement.sources.map(ref => ({ ref, item: resolveGeometryRef(ref) }));
      if (sources.some(({ item }) => !item)) return null;
      return createGeometryInstanceBundle(freeInstancePlacement, sources, null, null);
    }
    return Object.freeze({ start: startGeometryInstanceCommand, placeFree: placeFreeInstance,
      commitReference: commitGeometryInstanceReference, clearSources, clearPlacement, reset, preview,
      isPlacing: instance => instance === freeInstancePlacement,
      get pending() { return freeInstancePlacement; },
    });
  }
  window.GeometryInstanceCommand = Object.freeze({ create });
})();

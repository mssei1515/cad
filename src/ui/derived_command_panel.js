/* Adapt derived command drafts to the shared panel contract. */
(() => {
  "use strict";
  function create({ getMode, projectionSources, geometryCommand, sourceCommand, resolveGeometryRef,
    sketchName, activeSketchId, elementSketchId, applicationText: t, finishProjection, cancel,
    changeFreeProperty, refresh }) {
    function itemLabel(item) { return item ? `${sketchName(elementSketchId(item))} / ${item.id}` : t("参照切れ", "Missing reference"); }
    const refs = sources => sources.map(ref => itemLabel(resolveGeometryRef(ref)));
    function readState() {
      const mode = getMode();
      const state = { id: mode, title: "", step: "", selections: [], settings: [], actions: [] };
      let ready = false;
      if (mode === "sketch-projection") {
        const sources = projectionSources();
        state.title = t("スケッチ投影", "Sketch Projection");
        state.step = sources.length ? t("対象を追加・解除するか、完了で投影します", "Add/remove sources or finish to project.") : t("表示中の先祖スケッチの図形を選択してください", "Select visible geometry in ancestor sketches.");
        state.selections.push({ label: t("投影対象", "Projection sources"), items: sources.map(entry => itemLabel(entry.item)) });
        state.message = `${t("投影先", "Destination")}: ${sketchName(activeSketchId())}`;
        ready = sources.length > 0;
      } else if (mode === "mirror-axis" || mode === "pattern-direction") {
        const mirror = mode === "mirror-axis";
        state.title = mirror ? t("ミラー投影", "Mirror Projection") : t("直線パターン", "Linear Pattern");
        state.selections.push({ label: t("複写元", "Source geometry"), items: refs(geometryCommand.sources) });
        state.selections.push({ label: mirror ? t("対称軸", "Mirror axis") : t("方向線", "Direction line"), items: geometryCommand.reference ? [itemLabel(geometryCommand.reference)] : [] });
        state.step = geometryCommand.reference ? t("基準線を変更するか、完了で生成します", "Change the reference line or finish to create.") : mirror ? t("同じスケッチの対称軸となる線を選択してください", "Select a mirror axis line in the same sketch.") : t("同じスケッチの配列方向となる線を選択してください", "Select a direction line in the same sketch.");
        if (!mirror) {
          const settings = geometryCommand.settings;
          state.settings = [
            { key: "spacing", label: t("間隔 (mm)", "Spacing (mm)"), value: Number.isFinite(settings.spacing) ? settings.spacing : "", min: 0, step: "any" },
            { key: "copies", label: t("コピー数（元を除く）", "Copies (excluding source)"), value: Number.isFinite(settings.copies) ? settings.copies : "", min: 1, max: 1000, step: 1 },
            { key: "reversed", label: t("方向反転", "Reverse direction"), value: settings.reversed, type: "checkbox" },
          ];
          if (!geometryCommand.validSettings()) state.message = t("間隔は正数、コピー数は整数1〜1000で指定してください", "Use positive spacing and an integer copy count from 1 to 1000.");
        }
        ready = Boolean(geometryCommand.reference) && (mirror || geometryCommand.validSettings());
      } else if (mode.startsWith("free-instance-") && geometryCommand.pending) {
        const pending = geometryCommand.pending;
        state.title = t("同期インスタンス", "Synchronized Instance");
        state.selections.push({ label: t("複写元", "Source geometry"), items: refs(geometryCommand.sources) });
        state.step = mode === "free-instance-origin" ? t("参照元の配置基準点をクリックしてください", "Click the source anchor.") : t("設定を確認し、キャンバスの配置先をクリックして完了します", "Check settings, then click the destination on the canvas to finish.");
        if (mode === "free-instance-place") {
          state.message = `${t("基準点", "Anchor")}: (${pending.origin.x}, ${pending.origin.y})`;
          state.settings = [
            { key: "rotation", label: t("角度 (°)", "Angle (°)"), value: pending.rotation * 180 / Math.PI, step: "any" },
            { key: "mirrorX", label: t("左右反転", "Reflect left/right"), value: pending.mirrorX, type: "checkbox" },
            { key: "mirrorY", label: t("上下反転", "Reflect up/down"), value: pending.mirrorY, type: "checkbox" },
          ];
        }
      } else if (mode === "instance-sources" && sourceCommand.current) {
        const edit = sourceCommand.current;
        state.title = t("対象図形を編集", "Edit Source Geometry");
        state.step = t("図形をクリックして追加・解除し、完了で確定します", "Click geometry to add/remove sources, then finish.");
        state.message = `${t("編集対象", "Instance")}: ${edit.instance.id}`;
        state.selections.push({ label: t("対象図形", "Source geometry"), items: refs(edit.sources) });
        ready = edit.sources.length > 0;
      } else return null;
      state.actions.push({ id: "finish", label: mode.startsWith("free-instance-") ? t("配置先クリックで完了", "Click destination to finish") : t("完了", "Finish"), disabled: !ready });
      state.actions.push({ id: "cancel", label: t("キャンセル", "Cancel") });
      return state;
    }
    function onAction(action) {
      if (action === "cancel") return cancel();
      if (action !== "finish" || !readState()?.actions.some(entry => entry.id === "finish" && !entry.disabled)) return;
      if (getMode() === "sketch-projection") finishProjection();
      else if (getMode() === "instance-sources") sourceCommand.finish(true);
      else geometryCommand.finish();
    }
    function onSetting(key, value) {
      if (getMode() === "pattern-direction") geometryCommand.changeSetting(key, value);
      else if (getMode() === "free-instance-place") { changeFreeProperty(geometryCommand.pending, key, value); refresh(); }
    }
    return Object.freeze({ readState, onAction, onSetting });
  }
  window.DerivedCommandPanel = Object.freeze({ create });
})();

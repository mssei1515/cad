/* Adapt derived command drafts to the shared, directly selectable panel inputs. */
(() => {
  "use strict";
  function create({ getMode, projectionSources, geometryCommand, sourceCommand, resolveGeometryRef,
    sketchName, activeSketchId, elementSketchId, geometryRefForItem, applicationText: t, finishProjection, removeProjectionSource, cancel,
    changeFreeProperty, refresh }) {
    let selected = null;
    let previousSession = null;
    function itemLabel(item) { return item ? sketchName(elementSketchId(item)) + " / " + item.id : t("参照切れ", "Missing reference"); }
    function inputRows(key, label, entries, active) {
      return { key, label, active, emptyLabel: t("クリックして指定", "Click to pick"), items: entries.map(({ id, label: text }) => ({
        key: id, label: text, selected: selected?.group === key && selected.id === id,
      })) };
    }
    const sourceRows = refs => refs.map(ref => ({ id: JSON.stringify(ref), label: itemLabel(resolveGeometryRef(ref)) }));
    function commandSession() {
      const mode = getMode();
      if (mode === "instance-sources") return sourceCommand.instance;
      if (mode.startsWith("pattern-placement-")) return geometryCommand.pending;
      return mode;
    }
    function readState() {
      const mode = getMode(), session = commandSession();
      if (session !== previousSession) { selected = null; previousSession = session; }
      const state = { id: mode.startsWith("pattern-placement-") ? "derived-pattern" : mode, title: "", step: "", selections: [], settings: [], actions: [] };
      let ready = false;
      if (mode === "sketch-projection") {
        const sources = projectionSources();
        state.title = t("スケッチ投影", "Sketch Projection");
        state.step = t("表示中の先祖スケッチの図形を選択してください", "Select visible geometry in ancestor sketches.");
        state.selections.push(inputRows("sources", t("投影対象", "Projection sources"), sources.map(entry => ({ id: entry.key, label: itemLabel(entry.item) })), true));
        state.message = t("投影先", "Destination") + ": " + sketchName(activeSketchId());
        ready = sources.length > 0;
      } else if ((mode.startsWith("pattern-placement-") && geometryCommand.pending)) {
        const input = geometryCommand.activeInput;
        state.title = geometryCommand.pending.type === "mirror" ? t("ミラー", "Mirror") : geometryCommand.pending.type === "circularPattern" ? t("円形パターン", "Circular Pattern") : t("直線パターン", "Linear Pattern");
        state.selections.push(inputRows("sources", t("複写元", "Source geometry"), sourceRows(geometryCommand.sources), input === "sources"));
        {
          const pending = geometryCommand.pending;
          const kind = pending.placement.kind;
          const inputs = [...(["linear", "circular"].includes(kind) ? [["origin", t("配置基準点", "Source anchor")]] : []), ...(kind === "linear" ? [["destination", t("配置点", "Placement point")]] : [])];
          for (const [key, label] of inputs) {
            const point = geometryCommand[key];
            state.selections.push(inputRows(key, label, point ? [{ id: key, label: "(" + point.x + ", " + point.y + ")" }] : [], input === key));
          }
          if (["axisReflection", "directionLinear"].includes(kind)) state.selections.push(inputRows("reference", kind === "axisReflection" ? t("対称軸", "Axis") : t("方向線", "Direction"), geometryCommand.reference ? [{ id: "reference", label: itemLabel(geometryCommand.reference) }] : [], input === "reference"));
          state.settings = [
            { key: "count", label: t("個数（元を含む）", "Count (including source)"), value: pending.count, min: 2, max: 1001, step: 1 },
            { key: "rotation", label: t("配置角度 (°)", "Placement angle (°)"), value: pending.rotation * 180 / Math.PI, step: "any" },
            { key: "reflected", label: t("反転", "Reflect"), value: pending.reflected, type: "checkbox" },
            { key: "rotationLocked", label: t("回転ロック", "Rotation lock"), value: pending.rotationLocked, type: "checkbox" },
          ];
          if (!["linear", "circular"].includes(kind)) state.settings = state.settings.filter(setting => !["rotation", "reflected", "rotationLocked"].includes(setting.key));
          if (kind === "axisReflection") state.settings = state.settings.filter(setting => !["count", "placement"].includes(setting.key));
          if (kind === "linear" || kind === "directionLinear") state.settings = state.settings.filter(setting => setting.key !== "reflected");
          if (kind === "linear") {
            const a = geometryCommand.origin;
            for (const axis of ["X", "Y"]) state.settings.push({ key: "offset" + axis, label: t("相対" + axis + " (mm)", "Relative " + axis + " (mm)"), value: geometryCommand.destination && a ? pending[axis.toLowerCase()] - a[axis.toLowerCase()] : "", step: "any" });
          }
          if (kind === "circular") state.settings.push(
            { key: "angleStep", label: t("角度間隔 (°)", "Angle interval (°)"), value: pending.placement.angleStep * 180 / Math.PI, step: "any" },
            { key: "angleMode", label: t("角度間隔の制御", "Interval control"), type: "select", value: pending.placement.angleMode, options: [{ value: "numeric", label: t("数値指定", "Numeric") }, { value: "constraint", label: t("拘束で制御", "Constraints") }] });
          if (kind === "directionLinear") state.settings.push({ key: "spacing", label: t("間隔 (mm)", "Spacing (mm)"), value: pending.placement.spacing, step: "any" }, { key: "reversed", label: t("方向反転", "Reverse direction"), type: "checkbox", value: pending.placement.reversed });
          state.step = input === "sources" ? t("コピー対象を選択してください", "Select sources") : input === "origin" ? t("コピー対象の点・端点・線の中点を指定してください", "Pick a source point, endpoint or midpoint") : t("配置点または参照線を指定してください", "Pick the placement point or reference line");
        }
        ready = geometryCommand.canFinish();
      } else if (mode === "instance-sources" && sourceCommand.current) {
        const edit = sourceCommand.current;
        state.title = t("対象図形を編集", "Edit Source Geometry");
        state.step = t("図形をクリックして追加・解除し、完了で確定します", "Click geometry to add/remove sources, then finish.");
        state.message = t("編集対象", "Instance") + ": " + edit.instance.id;
        state.selections.push(inputRows("sources", t("対象図形", "Source geometry"), sourceRows(edit.sources), true));
        ready = edit.sources.length > 0;
      } else { selected = null; return null; }
      state.message = [state.message, t("項目・対象行を直接選択。Deleteで対象を解除します", "Select input or object rows directly. Delete removes the selected input.")].filter(Boolean).join("\n");
      state.actions.push({ id: "finish", label: t("完了", "Finish"), disabled: !ready });
      state.actions.push({ id: "cancel", label: t("キャンセル", "Cancel") });
      return state;
    }
    function onSelect(key, index) {
      const group = readState()?.selections.find(group => group.key === key);
      if (!group || (index != null && !group.items[index])) return;
      selected = index == null ? null : { group: key, id: group.items[index].key };
      if (getMode().startsWith("pattern-placement-")) geometryCommand.selectInput(key);
      else refresh();
    }
    function onRemove(key, index) {
      const group = readState()?.selections.find(group => group.key === key);
      if (!group?.items[index]) return;
      selected = null;
      if (getMode() === "sketch-projection") removeProjectionSource(index);
      else if (getMode() === "instance-sources") sourceCommand.remove(index);
      else geometryCommand.removeInput(key, index);
    }
    function onAction(action) {
      if (action === "cancel") return cancel();
      if (action !== "finish" || !readState()?.actions.some(entry => entry.id === "finish" && !entry.disabled)) return;
      if (getMode() === "sketch-projection") finishProjection();
      else if (getMode() === "instance-sources") sourceCommand.finish(true);
      else geometryCommand.finish();
    }
    function onSetting(key, value) {
      if (getMode().startsWith("pattern-placement-")) { geometryCommand.changeSetting(key, value); }
    }
    function selectedItem() {
      if (!selected) return null;
      const group = readState()?.selections.find(group => group.key === selected?.group);
      const index = group?.items.findIndex(item => item.key === selected?.id) ?? -1;
      if (index < 0) return null;
      if (selected.group === "reference") return geometryCommand.reference;
      if (selected.group !== "sources") return null;
      if (getMode() === "sketch-projection") return projectionSources()[index]?.item;
      const refs = getMode() === "instance-sources" ? sourceCommand.current?.sources : geometryCommand.sources;
      return refs?.[index] ? resolveGeometryRef(refs[index]) : null;
    }
    return Object.freeze({ readState, onAction, onSetting, onSelect, onRemove, selectedItem });
  }
  window.DerivedCommandPanel = Object.freeze({ create });
})();

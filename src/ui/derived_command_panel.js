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
      if (mode.startsWith("free-instance-")) return geometryCommand.pending;
      return mode;
    }
    function readState() {
      const mode = getMode(), session = commandSession();
      if (session !== previousSession) { selected = null; previousSession = session; }
      const state = { id: mode.startsWith("free-instance-") ? "free-instance" : mode, title: "", step: "", selections: [], settings: [], actions: [] };
      let ready = false;
      if (mode === "sketch-projection") {
        const sources = projectionSources();
        state.title = t("スケッチ投影", "Sketch Projection");
        state.step = t("表示中の先祖スケッチの図形を選択してください", "Select visible geometry in ancestor sketches.");
        state.selections.push(inputRows("sources", t("投影対象", "Projection sources"), sources.map(entry => ({ id: entry.key, label: itemLabel(entry.item) })), true));
        state.message = t("投影先", "Destination") + ": " + sketchName(activeSketchId());
        ready = sources.length > 0;
      } else if (["mirror-axis", "pattern-direction"].includes(mode) || (mode.startsWith("free-instance-") && geometryCommand.pending)) {
        const free = mode.startsWith("free-instance-"), mirror = mode === "mirror-axis", input = geometryCommand.activeInput;
        state.title = free ? t("同期インスタンス", "Synchronized Instance") : mirror ? t("ミラー投影", "Mirror Projection") : t("直線パターン", "Linear Pattern");
        state.selections.push(inputRows("sources", t("複写元", "Source geometry"), sourceRows(geometryCommand.sources), input === "sources"));
        if (free) {
          const pending = geometryCommand.pending;
          for (const [key, label] of [["origin", t("配置基準点", "Source anchor")], ["destination", t("配置先", "Destination")]]) {
            const point = geometryCommand[key];
            state.selections.push(inputRows(key, label, point ? [{ id: key, label: "(" + point.x + ", " + point.y + ")" }] : [], input === key));
          }
          state.settings = [
            { key: "rotation", label: t("角度 (°)", "Angle (°)"), value: pending.rotation * 180 / Math.PI, step: "any" },
            { key: "mirrorX", label: t("左右反転", "Reflect left/right"), value: pending.mirrorX, type: "checkbox" },
            { key: "mirrorY", label: t("上下反転", "Reflect up/down"), value: pending.mirrorY, type: "checkbox" },
          ];
          state.step = input === "sources" ? t("同じスケッチの複写元をクリックして追加・解除します", "Click source geometry in the same sketch to add/remove it.")
            : input === "origin" ? t("配置基準点をクリックしてください", "Click the source anchor.") : t("配置先をクリックしてください", "Click the destination.");
        } else {
          const reference = geometryCommand.reference;
          state.selections.push(inputRows("reference", mirror ? t("対称軸", "Mirror axis") : t("方向線", "Direction line"),
            reference ? [{ id: JSON.stringify(geometryRefForItem(reference)), label: itemLabel(reference) }] : [], input === "reference"));
          state.step = input === "sources" ? t("同じスケッチの複写元をクリックして追加・解除します", "Click source geometry in the same sketch to add/remove it.")
            : mirror ? t("同じスケッチの対称軸となる線を選択してください", "Select a mirror axis line in the same sketch.") : t("同じスケッチの配列方向となる線を選択してください", "Select a direction line in the same sketch.");
          if (!mirror) {
            const settings = geometryCommand.settings;
            state.settings = [
              { key: "spacing", label: t("間隔 (mm)", "Spacing (mm)"), value: Number.isFinite(settings.spacing) ? settings.spacing : "", min: 0, step: "any" },
              { key: "copies", label: t("コピー数（元を除く）", "Copies (excluding source)"), value: Number.isFinite(settings.copies) ? settings.copies : "", min: 1, max: 1000, step: 1 },
              { key: "reversed", label: t("方向反転", "Reverse direction"), value: settings.reversed, type: "checkbox" },
            ];
            if (!geometryCommand.validSettings()) state.message = t("間隔は正数、コピー数は整数1〜1000で指定してください", "Use positive spacing and an integer copy count from 1 to 1000.");
          }
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
      if (["mirror-axis", "pattern-direction"].includes(getMode()) || getMode().startsWith("free-instance-")) geometryCommand.selectInput(key);
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
      if (getMode() === "pattern-direction") geometryCommand.changeSetting(key, value);
      else if (getMode().startsWith("free-instance-")) { changeFreeProperty(geometryCommand.pending, key, value); refresh(); }
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

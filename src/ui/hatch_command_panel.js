/* Present Hatch draft regions through the shared command panel. */
(() => {
  "use strict";
  function create({ command, getMode, applicationText: t, formatDisplayNumber, cancel }) {
    function readState() {
      const mode = getMode();
      if (!["hatch", "hatch-repair"].includes(mode)) return null;
      const regions = command.regions;
      const area = regions.reduce((sum, region) => sum + (region.area || 0), 0);
      return {
        id: mode, title: mode === "hatch" ? t("塗りつぶし", "Fill") : t("境界を再指定", "Reselect boundary"),
        step: t("閉領域をクリックして追加・解除します", "Click closed regions to add/remove them."),
        completeOnEnter: true,
        settings: [{ key: "includeConstruction", type: "checkbox", value: command.includeConstruction,
          label: t("補助線を境界に含める", "Include construction geometry as boundaries") }],
        selections: [{ key: "regions", label: t("選択した領域", "Selected regions"), active: true,
          emptyLabel: t("閉領域の内側をクリック", "Click inside a closed region"),
          items: regions.map((region, index) => ({ key: String(region.id), selected: region.selected,
            label: `${t("領域", "Region")} ${index + 1} — ${formatDisplayNumber(region.area)} mm²` })) }],
        message: `${t("合計面積", "Total area")}: ${formatDisplayNumber(area)} mm²\n`
          + t("リストで領域を選択し、Deleteで解除。Enterまたは完了で確定、Escで取消", "Select a region in the list; Delete removes it. Enter or Finish confirms; Esc cancels."),
        actions: [{ id: "finish", label: t("完了", "Finish"), disabled: regions.length === 0 },
          { id: "cancel", label: t("キャンセル", "Cancel") }],
      };
    }
    function onAction(action) { if (action === "finish") command.finish(); else if (action === "cancel") cancel(); }
    return Object.freeze({ readState, onAction,
      onSetting: command.changeSetting,
      onSelect: (key, index) => { if (key === "regions") command.select(index); },
      onRemove: (key, index) => { if (key === "regions") command.remove(index); },
    });
  }
  window.HatchCommandPanel = Object.freeze({ create });
})();

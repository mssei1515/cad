/* Adapt annotation drafts to the shared command panel. */
(() => {
  "use strict";
  function create({ command, applicationText: t }) {
    function readState() {
      const draft = command.draft;
      if (!draft) return null;
      const step = draft.editId || draft.type === "annotation-leader-select"
        ? t("引出線を付ける図形をクリックしてください", "Click the geometry to attach the leader.")
        : !draft.withLeader ? t("文字の配置位置をクリックしてください", "Click the text position.")
        : !draft.elbow ? t("引出線の折れ位置をクリックしてください", "Click the elbow position.")
        : t("横線の終端をクリックし、完了してください", "Click the shelf end, then finish.");
      return { id: draft.editId ? "annotation-attach" : "annotation", title: t("注記", "Annotation"), step,
        settings: draft.editId ? [] : [
          { key: "withLeader", type: "checkbox", label: t("引出線あり", "With leader"), value: draft.withLeader },
          { key: "text", type: "textarea", label: t("本文", "Text"), value: draft.text }],
        message: command.canFinish() ? t("配置を確認して完了してください", "Review the placement and finish.")
          : t("本文と配置を指定してください", "Specify the text and placement."),
        actions: [{ id: "finish", label: t("完了", "Finish"), disabled: !command.canFinish() },
          { id: "cancel", label: t("キャンセル", "Cancel") }] };
    }
    return Object.freeze({ readState, onSetting: command.changeSetting,
      onAction: action => action === "finish" ? command.finish() : command.cancel() });
  }
  window.AnnotationCommandPanel = Object.freeze({ create });
})();

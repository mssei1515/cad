/* Present supplied solve and constraint results without querying or mutating a model. */
(() => {
  "use strict";
  function create({ applicationText }) {
    function solveOperationLabel(label) {
      const labels = {
        "点追加": ["点の追加", "Point creation"],
        "線追加": ["連続線の追加", "Polyline creation"],
        "矩形追加": ["矩形の追加", "Rectangle creation"],
        "長穴追加": ["長穴の追加", "Slot creation"],
        "円追加": ["円の追加", "Circle creation"],
        "円弧追加": ["円弧の追加", "Arc creation"],
        "3点円弧追加": ["3点円弧の追加", "Three-point arc creation"],
        "スプライン追加": ["スプラインの追加", "Spline creation"],
        "ブロック配置": ["ブロック配置", "Block placement"],
        "インスタンス削除": ["インスタンス削除", "Instance deletion"],
        "貼り付け": ["貼り付け", "Paste"],
        "ファイル読み込み": ["ファイル読み込み", "File load"],
        "サンプル復元": ["サンプル復元", "Sample restore"],
      };
      const pair = labels[String(label)];
      return applicationText(pair?.[0] || String(label), pair?.[1] || String(label));
    }

    function resultHint(label, solved, analysis, dependent, duplicateCount) {
      const hasDependentError = dependent?.success === false;
      const hasDuplicateConstraints = duplicateCount > 0;
      const stable = Boolean(solved?.success && analysis?.analysis?.stable && !hasDependentError && !hasDuplicateConstraints);
      const operation = solveOperationLabel(label);
      const message = stable
        ? applicationText(`${operation}が完了しました`, `${operation} completed`)
        : solved?.success
          ? applicationText(`${operation}が完了しました。拘束状態を確認してください`, `${operation} completed. Check the constraint status`)
          : applicationText(`${operation}を完了できませんでした。拘束や形状を確認してください`, `${operation} could not be completed. Check the constraints and geometry`);
      return { message, kind: stable ? "normal" : "error" };
    }

    function constraintDuplicateSummary(count, language) {
      return count > 0 ? language === "en" ? ` / Duplicate constraints: ${count}` : ` / 重複拘束: ${count}` : "";
    }

    function referenceConstraintErrorSummary(count, language) {
      return count > 0 ? language === "en" ? ` / Reference errors: ${count}` : ` / 参照エラー: ${count}` : "";
    }

    function constraintStatusBadge(status) {
      if (status === "conflict") return applicationText("矛盾", "Conflict");
      if (status === "support") return applicationText("支持位置拘束", "Supported position");
      if (status === "under") return applicationText("未拘束", "Under-constrained");
      return applicationText("完全拘束", "Fully constrained");
    }

    function summaryText(s, duplicateCount, referenceErrorCount, language) {
      return language === "en"
        ? `Fully constrained: ${s.full} / Supported position: ${s.support} / Under-constrained: ${s.under} / Conflict: ${s.conflict}${constraintDuplicateSummary(duplicateCount, language)}${referenceConstraintErrorSummary(referenceErrorCount, language)}`
        : `完全拘束: ${s.full} / 支持位置拘束: ${s.support} / 未拘束: ${s.under} / 矛盾: ${s.conflict}${constraintDuplicateSummary(duplicateCount, language)}${referenceConstraintErrorSummary(referenceErrorCount, language)}`;
    }
    return Object.freeze({ resultHint, summaryText, constraintStatusBadge });
  }
  window.ConstraintFeedback = Object.freeze({ create });
})();

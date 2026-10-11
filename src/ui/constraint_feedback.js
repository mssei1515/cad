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
    function targetHint(type, operands, language, label) {
      if (type === "fixed") return applicationText("固定／解除する点、線、円、円弧、円弧端点を選択してください。ブロック内も図形単位で固定します。Escで終了します。", "Select a point, line, circle, arc, or arc endpoint to fix/unfix. Geometry inside blocks is fixed individually. Press Esc to finish.");
      if (type === "distance") {
        if (operands.length === 1 && operands[0]?.kind === "line") {
          return applicationText("2本目の線を選ぶと線間・角度寸法、円を選ぶと円中心距離寸法、空白をクリックすると線長寸法になります。Enterまたは同じ線のダブルクリックでも線長を確定できます。", "Select a second line for a line-to-line or angle dimension, a circle for a center-to-line dimension, or click empty space for a line-length dimension. Enter or double-clicking the same line also confirms line length.");
        }
        if (operands.length === 1 && operands[0]?.kind === "primitive") {
          return applicationText("円の場合は線を選ぶと円中心距離寸法、円または円弧では同心の円／円弧を選ぶと半径差寸法になります。空白をクリックすると単独の半径／直径寸法になります。", "After a circle, select a line for a center-to-line dimension. After a circle or arc, select a concentric circle/arc for a radius-difference dimension. Click empty space for the primitive's radius/diameter dimension.");
        }
        return applicationText("寸法対象を選択してください。", "Select dimension targets.");
      }
      if (type === "concentric") return applicationText("同心にする円/円弧を2つ、または点と円/円弧を選択してください", "Select two circles/arcs, or a point and a circle/arc, to make them concentric.");
      if (type === "equalRadius") return applicationText("同じ半径にする円または円弧を2つ選択してください", "Select two circles or arcs to give them equal radii.");
      if (type === "pointOnCircle") return applicationText("円周上に置く点と、円または円弧を選択してください", "Select a point and a circle or arc to place the point on its circumference.");
      if (type === "tangent") return applicationText("接線にする線と円/円弧/スプライン、円/円弧を2つ、またはスプラインを2つ選択してください", "Select a line and a circle/arc/spline, two circles/arcs, or two splines to make them tangent.");
      if (type === "coincident") return applicationText("一致させる点同士、点と線、点と円周、または同一線上にする線2本を選択してください", "Select two points, a point and line, a point and circumference, or two lines to make coincident.");
      if (type === "collinear") return applicationText("同一直線上にする線を2本選択してください", "Select two lines to make them collinear.");
      if (type === "equal") return applicationText("等寸にする線2本、または同じ半径にする円/円弧を2つ選択してください", "Select two lines for equal length, or two circles/arcs for equal radii.");
      if (type === "horizontal") return applicationText("水平にする線1本、または水平関係にする点2つを選択してください", "Select one line to make horizontal, or two points to align horizontally.");
      if (type === "vertical") return applicationText("垂直にする線1本、または鉛直関係にする点2つを選択してください", "Select one line to make vertical, or two points to align vertically.");
      if (type === "parallel") return applicationText("平行にする線を2本選択してください", "Select two lines to make parallel.");
      if (type === "perpendicular") return applicationText("直交させる線を2本選択してください", "Select two lines to make perpendicular.");
      if (type === "symmetry") {
        if (operands.length === 0) return applicationText("最初に対称軸にする線を選択してください", "First select the symmetry-axis line.");
        if (operands.length === 1) return applicationText("対称にする1つ目の点、線、または円弧を選択してください", "Select the first point, line, or arc to mirror.");
        const subjectKind = operands[1]?.kind === "line" ? applicationText("線", "line") : operands[1]?.kind === "primitive" ? applicationText("円弧", "arc") : applicationText("点", "point");
        return language === "en" ? `Select the second ${subjectKind} to mirror.` : `対称にする2つ目の${subjectKind}を選択してください`;
      }
      return language === "en" ? `Select targets for ${label()}.` : `${label()} の対象を選択してください`;
    }

    function invalidTargetHint(type, operands, language) {
      if (language === "en") {
        if (type === "symmetry") {
          if (operands.length === 0) return "Select a line as the symmetry axis for the first target.";
          if (operands.length === 1) return "Select a point, line, or arc to mirror for the second target.";
          return `Select a ${operands[1]?.kind === "line" ? "line" : operands[1]?.kind === "primitive" ? "arc" : "point"} matching the second target type.`;
        }
        const hints = {
          concentric: "Select two circles/arcs, or a point and a circle/arc, for this constraint.",
          equalRadius: "Select two circles or arcs for this constraint.",
          pointOnCircle: "Select a point and a circle or arc for this constraint.",
          tangent: "Select a line and a circle/arc/spline, two circles/arcs, or two splines for this constraint.",
          coincident: "Select points, lines, circles, arcs, or splines supported by this constraint.",
          collinear: "Select two lines for this constraint.", equal: "Select two lines or two circles/arcs for this constraint.",
          horizontal: "Select one line or two points for this constraint.", vertical: "Select one line or two points for this constraint.",
          parallel: "Select lines for this constraint.", perpendicular: "Select lines for this constraint.", distance: "Select points, lines, circles, or arcs as dimension targets.",
        };
        return hints[type] || "The current selection cannot be used for this constraint.";
      }
      if (type === "concentric") return "この拘束では円/円弧を2つ、または点と円/円弧を選択してください";
      if (type === "equalRadius") return "この拘束では円または円弧を2つ選択してください";
      if (type === "pointOnCircle") return "この拘束では点と円または円弧を選択してください";
      if (type === "tangent") return "この拘束では線と円/円弧/スプライン、円/円弧を2つ、またはスプラインを2つ選択してください";
      if (type === "coincident") return "この拘束では点、線、円、円弧またはスプラインを選択してください";
      if (type === "collinear") return "この拘束では線を2本選択してください";
      if (type === "equal") return "この拘束では線2本、または円/円弧を2つ選択してください";
      if (type === "horizontal" || type === "vertical") {
        return "この拘束では線1本、または点2つを選択してください";
      }
      if (type === "parallel" || type === "perpendicular") {
        return "この拘束では線を選択してください";
      }
      if (type === "symmetry") {
        if (operands.length === 0) return "最初の対象には対称軸にする線を選択してください";
        if (operands.length === 1) return "2番目の対象には対称にする点、線、または円弧を選択してください";
        return `3番目の対象には2番目と同じ種類の${operands[1]?.kind === "line" ? "線" : operands[1]?.kind === "primitive" ? "円弧" : "点"}を選択してください`;
      }
      if (type === "distance") return "寸法対象として点、線、円または円弧を選択してください";
      return "この拘束では選択できません";
    }

    return Object.freeze({ resultHint, summaryText, constraintStatusBadge, targetHint, invalidTargetHint });
  }
  window.ConstraintFeedback = Object.freeze({ create });
})();

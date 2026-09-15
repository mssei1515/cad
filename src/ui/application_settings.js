/* Application language/theme preferences, localization and settings dialog lifecycle. */
(function () {
  "use strict";
  const APPLICATION_LANGUAGE_STORAGE_KEY = "jot2d.application.language";
  const APPLICATION_THEME_STORAGE_KEY = "jot2d.application.theme";
  const UI_TRANSLATIONS = [
    ["同期インスタンス", "Synchronized Instance"],
    ["ファイル", "File"], ["編集", "Edit"], ["ヘルプ", "Help"],
    ["上書き保存", "Overwrite Save"], ["名前を付けて保存", "Save As"], ["開く", "Open"], ["Parameter…", "Parameters…"], ["ドキュメント設定", "Document Settings"], ["アプリケーション設定", "Application Settings"],
    ["元に戻す", "Undo"], ["やり直す", "Redo"], ["削除", "Delete"], ["選択", "Select"], ["選択・ドラッグ", "Select / Drag"],
    ["ジオメトリ", "Geometry"], ["拘束", "Constraint"], ["注記", "Annotation"], ["ツールバー", "Toolbar"], ["メニューバー", "Menu bar"], ["表示ツール", "View"],
    ["点", "Point"], ["線", "Line"], ["連続線", "Polyline"], ["中心線", "Centerline"], ["円中心十字線", "Circle Center Cross"], ["矩形", "Rectangle"], ["長穴", "Slot"], ["円", "Circle"], ["円弧", "Arc"], ["3点円弧", "Three-point Arc"], ["スプライン", "Spline"], ["スケッチ投影", "Sketch Projection"], ["ミラー", "Mirror"], ["直線パターン", "Linear Pattern"], ["派生インスタンス", "Derived Instance"], ["投影", "Projected"],
    ["実線／補助線", "Normal / Construction"], ["トリム", "Trim"], ["R面取り", "Fillet"], ["フィレット", "Fillet"], ["オフセット", "Offset"], ["ハッチング", "Hatching"],
    ["寸法", "Dimension"], ["一致", "Coincident"], ["水平", "Horizontal"], ["垂直", "Vertical"], ["平行", "Parallel"], ["直角", "Perpendicular"],
    ["対称", "Symmetry"], ["同心", "Concentric"], ["等寸", "Equal"], ["接線", "Tangent"], ["固定／解除", "Fix / Unfix"], ["固定解除", "Unfix"],
    ["引出線", "Leader"], ["自由テキスト", "Free Text"], ["画像を読み込み", "Import Image"], ["画像", "Image"], ["参照画像", "Reference Image"], ["位置ロック", "Position lock"], ["2点から縮尺を設定", "Calibrate scale from two points"], ["幅", "Width"], ["拘束状態表示", "Constraint Status View"],
    ["拘束状態表示を切り替え（Space長押しでも一時表示）", "Toggle constraint status view (hold Space for temporary view)"],
    ["拘束ツールはツールバーから選択します", "Select constraint tools from the toolbar"],
    ["プロパティ", "Properties"], ["スケッチ", "Sketch"], ["スケッチツリー", "Sketch Tree"],
    ["スケッチ一覧", "Sketches"], ["ブロック一覧", "Blocks"], ["ブロック", "Block"], ["ブロック定義", "Block Definitions"], ["ブロック定義…", "Block Definitions…"], ["ブロックインスタンス", "Block Instance"],
    ["スケッチツリーの幅を変更", "Resize Sketch Tree"],
    ["ブロック作成", "Create Block"], ["作成", "Create"], ["キャンセル", "Cancel"], ["完了", "Done"], ["閉じる", "Close"], ["子＋", "Child +"],
    ["名前変更", "Rename"], ["スケッチ削除", "Delete Sketch"], ["ブロック名", "Block name"], ["配置", "Place"], ["非表示にする", "Hide"], ["表示する", "Show"],
    ["キャンバス", "Canvas"], ["ステータスバー", "Status Bar"], ["寸法値", "Dimension value"],
    ["既定の外観", "Default Appearance"], ["既定の補助線外観", "Default Construction Appearance"], ["既定の寸法外観", "Default Dimension Appearance"], ["一般外観", "General Appearance"], ["補助線外観", "Construction Appearance"], ["寸法外観", "Dimension Appearance"], ["基本情報", "Basic Information"], ["一般", "General"], ["言語", "Language"], ["表示テーマ", "Theme"], ["ライト", "Light"], ["ダーク", "Dark"],
    ["アプリケーション全体の設定をドキュメント設定から分離して管理します。", "Application-wide settings are managed separately from document settings."],
    ["既定", "Default"], ["表示", "Visible"], ["非表示", "Hidden"], ["色", "Color"], ["線種", "Line type"], ["線幅", "Line width"],
    ["実線", "Solid"], ["破線", "Dashed"], ["一点鎖線", "Dash-dot"], ["二点鎖線", "Dash-dot-dot"], ["点線", "Dotted"], ["端部のはみ出し", "Endpoint overhang"], ["端部の点", "Endpoint points"], ["あり", "Enabled"], ["なし", "Disabled"], ["使用済みの色", "Colors used in this file"],
    ["標準色", "Standard colors"], ["このファイルで使用中の色", "Colors used in this file"], ["任意の色", "Custom color"], ["使用中の色はありません", "No colors are used yet"], ["適用", "Apply"], ["破棄", "Discard"], ["追加", "Add"],
    ["名前空間", "Namespace"], ["名前", "Name"], ["値 / 数式", "Value / Expression"], ["評価値", "Evaluated value"], ["種類／所属", "Type / owner"], ["Parameter名", "Parameter name"], ["読み取り専用", "Read-only"], ["Geometryから測定", "Measured from geometry"],
    ["外観", "Appearance"], ["外観の上書き", "Appearance Override"], ["配置情報", "Placement"], ["定義", "Definition"], ["回転", "Rotation"], ["不透明度", "Opacity"],
    ["長さ", "Length"], ["半径", "Radius"], ["補助線", "Construction"], ["種類", "Type"], ["値", "Value"],
    ["精度", "Precision"], ["接頭辞", "Prefix"], ["接尾辞", "Suffix"], ["端末記号", "Terminators"], ["標準矢印", "Standard arrow"], ["塗りつぶし矢印", "Filled arrow"], ["サイズ", "Size"], ["寸法補助線", "Extension lines"], ["寸法文字", "Dimension text"],
    ["突出量", "Overshoot"], ["起点すき間", "Origin gap"], ["開き角", "Opening angle"], ["高さ", "Height"], ["寸法線との間隔", "Gap from dimension line"],
    ["テキスト", "Text"], ["文字サイズ", "Font size"], ["アクティブ", "Active"], ["はい", "Yes"], ["いいえ", "No"],
    ["選択したオブジェクトのプロパティを表示します。", "Select an object to display its properties."],
    ["個のオブジェクト", "objects"], ["選択数", "Selected objects"], ["混在", "Mixed"], ["自動", "Auto"], ["中心", "Center"], ["角度", "Angle"], ["補助", "Construction"], ["固定", "Fixed"],
    ["完全拘束", "Fully constrained"], ["支持位置拘束", "Supported position"], ["未拘束", "Under-constrained"], ["矛盾", "Conflict"],
    ["参照エラー", "Reference error"], ["重複", "Duplicate"], ["拘束状態表示中", "Constraint status view"],
    ["Geometryを選択または作成します。Spaceで拘束状態を表示します。", "Select or create geometry. Hold Space to show constraint status."],
    ["プロパティを最小化", "Collapse Properties"], ["プロパティを展開", "Expand Properties"],
    ["カラーパレット", "Color palette"], ["ジオメトリID", "Geometry ID"], ["日本語", "Japanese"], ["英語", "English"],
    ["通常表示", "Normal view"], ["選択・ドラッグできます。Shift/Ctrlクリックで複数選択できます。", "Select and drag geometry. Use Shift/Ctrl-click for multiple selection."],
    ["キャンバスをクリックして点を追加します。", "Click the canvas to add a point."], ["端点位置をクリックして連続線を作成します。終了はEscです。", "Click endpoint positions to create connected lines. Press Esc to finish."],
    ["矩形の1つ目の角をクリックしてください。Escで選択モードに戻ります", "Click the first rectangle corner. Press Esc to return to selection mode."],
    ["長穴の1つ目の半円中心をクリックしてください。Escで選択モードに戻ります", "Click the first semicircle center of the slot. Press Esc to return to selection mode."],
    ["長穴の2つ目の半円中心をクリックしてください。Escで作図をキャンセルします", "Click the second semicircle center of the slot. Press Esc to cancel drawing."],
    ["1つ目の中心から離れた位置をクリックしてください", "Click a position away from the first center."],
    ["長穴の幅位置をクリックしてください。Escで作図をキャンセルします", "Click a point that defines the slot width. Press Esc to cancel drawing."],
    ["中心線から離れた幅位置をクリックしてください", "Click a width position away from the centerline."],
    ["拘束を維持できないため長穴の作成を戻しました", "The slot was restored because its constraints could not be maintained."],
    ["円の中心をクリックしてください。Escで選択モードに戻ります", "Click the circle center. Press Esc to return to selection mode."],
    ["円弧の中心をクリックしてください。Escで選択モードに戻ります", "Click the arc center. Press Esc to return to selection mode."],
    ["3点円弧の始点をクリックしてください。Escで選択モードに戻ります", "Click the three-point arc start point. Press Esc to return to selection mode."],
    ["3点円弧の終点をクリックしてください。Escで作図をキャンセルします", "Click the three-point arc end point. Press Esc to cancel this drawing."],
    ["円弧が通過する円周上の点をクリックしてください。Escで作図をキャンセルします", "Click a circumference point for the arc to pass through. Press Esc to cancel this drawing."],
    ["始点から離れた終点をクリックしてください", "Click an end point away from the start point."],
    ["3点が同一直線上にならない位置をクリックしてください", "Click a position that is not collinear with the two endpoints."],
    ["通過点をクリックしてください。Enterまたは空白のダブルクリックで終了（ダブルクリック位置は追加しません）、始点クリックで閉じます", "Click fit points. Press Enter or double-click blank canvas to finish without adding that position, or click the start point to close."],
    ["スプラインには3点以上の通過点が必要です", "A spline requires at least three fit points."],
    ["閉じる", "Closed"], ["通過点", "Fit points"], ["編集", "Edit"], ["スプライン編集", "Edit spline"],
    ["引出線を付ける図形をクリックしてください", "Click geometry to attach the leader."], ["引出線の文字位置をクリックしてください", "Click the leader text position."],
    ["引出線をキャンセルしました", "Leader creation was canceled."], ["引出線を追加しました", "Leader was added."],
    ["テキストを配置する位置をクリックしてください", "Click where you want to place the text."], ["テキストを追加しました", "Text was added."], ["テキストをキャンセルしました", "Text creation was canceled."],
    ["Root Sketchには図形を作成できません。子スケッチを選択してください。", "Geometry cannot be created in the Root Sketch. Select a child sketch."],
    ["配置する内部スケッチを選び、表示中心をクリックしてください", "Select internal sketches to place, then click the display center."],
    ["オブジェクトを持つ内部スケッチを1つ以上有効にしてください", "Enable at least one internal sketch that contains objects."],
    ["回転方向をクリックしてください。Escで角度0度として配置します", "Click to set the rotation direction. Press Esc to place at 0 degrees."],
    ["ブロック定義編集をキャンセルしました", "Block definition editing was canceled."], ["ブロック作成をキャンセルしました", "Block creation was canceled."],
    ["指定した側にはオフセットを作成できません", "An offset cannot be created on the specified side."],
    ["オフセット距離を入力してください。Enterまたはダブルクリックで決定します", "Enter the offset distance. Confirm with Enter or double-click."],
    ["作成可能な0より大きいオフセット距離を入力してください", "Enter an offset distance greater than zero."],
    ["ブロック定義編集を終了してから保存してください", "Finish block definition editing before saving."], ["ファイルとして保存しました", "The document was saved to a file."],
    ["保存をキャンセルしました", "Save was canceled."], ["ファイルを開く操作をキャンセルしました", "Open was canceled."],
    ["ブロック定義編集を終了してから読み込んでください", "Finish block definition editing before opening a file."], ["ファイル読み込みに失敗しました", "Failed to open the file."],
    ["連続線を終了しました", "Polyline creation finished."], ["選択・ドラッグモードに戻りました", "Returned to Select / Drag mode."], ["作図操作をキャンセルしました", "Drawing was canceled."],
    ["コピーする図形を選択してください", "Select geometry to copy."], ["貼り付ける図形がありません", "There is no geometry to paste."], ["貼り付け先のスケッチをアクティブにしてください", "Activate the destination sketch before pasting."],
    ["寸法線の位置をクリックしてください", "Click the dimension-line position."], ["寸法対象を選択してください。", "Select dimension targets."],
    ["寸法値を入力中: 数式は = から開始し、Parameter参照はダブルクオーテーションで括ります。Canvas寸法のクリックで参照を挿入できます", "Editing dimension: begin expressions with = and enclose parameter references in double quotes. Click a canvas dimension to insert a reference."],
    ["オフセット距離を入力中: Enter/ダブルクリックで決定、Escでキャンセル", "Entering an offset distance: confirm with Enter/double-click, or cancel with Esc."],
    ["読み取り専用寸法の値は編集できません", "A read-only dimension value cannot be edited."], ["寸法値には0より大きい数値を入力してください", "Enter a dimension value greater than zero."],
    ["回転がロックされたブロックインスタンスです", "This block instance has locked rotation."], ["固定されたブロックインスタンスです", "This block instance is fixed."],
    ["ブロックを回転中", "Rotating block"], ["ブロックを移動中", "Moving block"], ["引出線を移動中", "Moving leader"], ["テキストを移動中", "Moving text"],
    ["トリムできる交点がありません", "No intersection is available for trimming."], ["R面取りする線をクリックしてください", "Click a line to fillet."],
    ["接続する2本目の線をクリックしてください", "Click the second connected line."], ["別の接続線をクリックしてください", "Click a different connected line."],
    ["マウスを動かしてR寸法を決め、クリックで確定してください。Escでキャンセルします", "Move the pointer to set the fillet radius, then click to confirm. Press Esc to cancel."],
    ["共有端点から離れた位置へマウスを移動してください", "Move the pointer away from the shared endpoint."],
    ["半径位置をクリックすると円を作成します。Escで選択モードに戻ります", "Click the radius position to create the circle. Press Esc to return to selection mode."],
    ["円弧の始点をクリックしてください。Escで選択モードに戻ります", "Click the arc start point. Press Esc to return to selection mode."], ["中心から離れた位置をクリックしてください", "Click a position away from the center."],
    ["円弧の終点をクリックすると円弧を作成します。Escで選択モードに戻ります", "Click the arc end point to create the arc. Press Esc to return to selection mode."],
    ["画面移動中: マウススクロールボタンを押しながらドラッグ", "Panning: drag while holding the middle mouse button."],
    ["オフセットする線、円、円弧をクリックしてください", "Click the line, circle, or arc to offset."], ["オフセットする側と距離の目安をクリックしてください", "Click the offset side and an approximate distance."],
    ["画面移動を終了しました", "Panning finished."], ["注記の位置を更新しました", "Annotation position updated."], ["寸法線の位置を更新しました", "Dimension-line position updated."],
    ["矩形選択を更新しました", "Rectangle selection updated."], ["図形を選択しました", "Geometry selected."], ["線の作図をキャンセルしました", "Line creation canceled."],
    ["選択を解除しました", "Selection cleared."], ["表示中の図形全体が見えるように調整しました", "Fitted all visible geometry."], ["表示中の図形がありません", "There is no visible geometry."],
    ["ブロック配置をキャンセルしました", "Block placement canceled."], ["選択図形を補助作図にしました", "Selected geometry changed to construction geometry."],
    ["選択図形を通常作図にしました", "Selected geometry changed to normal geometry."], ["補助線作図: 端点位置をクリックしてください", "Construction line: click an endpoint position."],
    ["通常線作図に戻しました", "Returned to normal line creation."], ["R面取りする接続線を2本クリックしてください", "Click two connected lines to fillet."],
    ["トリムする線、円、円弧の削除したい区間をクリックしてください。Escで選択モードに戻ります", "Click the segment of a line, circle, or arc to trim. Press Esc to return to selection mode."],
    ["ブロックはありません", "No blocks"], ["配置するスケッチ", "Sketches to place"], ["表示するスケッチ", "Visible sketches"],
    ["キャンバスコンテキストメニュー", "Canvas context menu"], ["コマンドをキャンセル", "Cancel Command"],
    ["切り取り", "Cut"], ["コピー", "Copy"], ["貼り付け", "Paste"], ["プロパティを表示", "Show Properties"], ["表示中図形へフィット", "Fit Visible Geometry"],
    ["補助線に変更", "Convert to Construction"], ["実線に変更", "Convert to Normal"], ["ここからオフセット", "Offset from Here"], ["引出線を追加", "Add Leader"],
    ["選択からブロック作成", "Create Block from Selection"], ["ブロック定義を編集", "Edit Block Definition"], ["直交回転ロック", "Lock Orthogonal Rotation"], ["自由回転", "Free Rotation"], ["値 / 数式を編集", "Edit Value / Expression"],
  ];

  function create({ document, storage, refreshViews, redrawCanvas, refreshVersion }) {
    const { Node, NodeFilter } = document.defaultView;
    let applicationLanguage = (() => {
      try {
        return storage().getItem(APPLICATION_LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ja";
      } catch (_error) {
        return "ja";
      }
    })();
    let applicationTheme = (() => {
      try {
        return storage().getItem(APPLICATION_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
      } catch (_error) {
        return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      }
    })();
    document.documentElement.lang = applicationLanguage;
    document.documentElement.dataset.theme = applicationTheme;

    function applicationText(ja, en) {
      return applicationLanguage === "en" ? en : ja;
    }

    function translatedExactText(value) {
      const text = String(value ?? "");
      const match = text.match(/^(\s*)(.*?)(\s*)$/s);
      const prefix = match?.[1] || "";
      const core = match?.[2] || "";
      const suffix = match?.[3] || "";
      if (!core) return text;
      if (applicationLanguage === "en") {
        const pair = UI_TRANSLATIONS.find(([ja]) => ja === core);
        return pair ? `${prefix}${pair[1]}${suffix}` : text;
      }
      const pair = UI_TRANSLATIONS.find(([, en]) => en === core);
      return pair ? `${prefix}${pair[0]}${suffix}` : text;
    }

    function translatedHintText(value) {
      const exact = translatedExactText(value);
      if (applicationLanguage !== "en") {
        return exact
          .replace(/^Sample restored:/, "サンプル復元:")
          .replace(/^Constraint added:/, "拘束追加:")
          .replace(/^Reference constraint added:/, "参照拘束追加:")
          .replace(/^Slot added:/, "長穴追加:")
          .replace(/^Fixed state updated:/, "固定状態変更:")
          .replace(/^Dimension value updated:/, "寸法値更新:")
          .replace(/Fully constrained:/g, "完全拘束:")
          .replace(/Supported position:/g, "支持位置拘束:")
          .replace(/Under-constrained:/g, "未拘束:")
          .replace(/Conflict:/g, "矛盾:")
          .replace(/Duplicate constraints:/g, "重複拘束:")
          .replace(/Reference errors:/g, "参照エラー:");
      }
      if (exact !== String(value ?? "")) return exact;
      return String(value ?? "")
        .replace(/^サンプル復元:/, "Sample restored:")
        .replace(/^拘束追加:/, "Constraint added:")
        .replace(/^参照拘束追加:/, "Reference constraint added:")
        .replace(/^長穴追加:/, "Slot added:")
        .replace(/^固定状態変更:/, "Fixed state updated:")
        .replace(/^寸法値更新:/, "Dimension value updated:")
        .replace(/完全拘束:/g, "Fully constrained:")
        .replace(/支持位置拘束:/g, "Supported position:")
        .replace(/未拘束:/g, "Under-constrained:")
        .replace(/矛盾:/g, "Conflict:")
        .replace(/重複拘束:/g, "Duplicate constraints:")
        .replace(/参照エラー:/g, "Reference errors:");
    }

    function shouldSkipAutomaticLocalization(node) {
      const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
      return Boolean(element?.closest("script, style, canvas, input, textarea, .sketch-name, .block-item-name, [data-user-content]"));
    }

    function localizeApplicationUI(root = document) {
      const scope = root.nodeType === Node.ELEMENT_NODE ? root : document.documentElement;
      const explicit = [scope, ...(scope.querySelectorAll?.("[data-i18n-ja][data-i18n-en]") || [])]
        .filter((element) => element?.matches?.("[data-i18n-ja][data-i18n-en]"));
      for (const element of explicit) element.textContent = element.dataset[applicationLanguage === "en" ? "i18nEn" : "i18nJa"];

      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      for (const node of textNodes) {
        if (shouldSkipAutomaticLocalization(node) || node.parentElement?.closest("[data-i18n-ja][data-i18n-en]")) continue;
        const translated = translatedExactText(node.nodeValue);
        if (translated !== node.nodeValue) node.nodeValue = translated;
      }

      const attributes = ["title", "aria-label", "placeholder", "data-tooltip", "data-label"];
      for (const element of [scope, ...(scope.querySelectorAll?.("*") || [])]) {
        if (element.closest?.("script, style, canvas, .sketch-name, .block-item-name, [data-user-content]")) continue;
        for (const attribute of attributes) {
          if (!element.hasAttribute?.(attribute)) continue;
          const value = element.getAttribute(attribute);
          const translated = translatedExactText(value);
          if (translated !== value) element.setAttribute(attribute, translated);
        }
      }
      const select = document.getElementById("applicationLanguageSelect");
      if (select) select.value = applicationLanguage;
      const themeSelect = document.getElementById("applicationThemeSelect");
      if (themeSelect) themeSelect.value = applicationTheme;
    }

    function setApplicationLanguage(language, { persist = true, refresh = true } = {}) {
      applicationLanguage = language === "en" ? "en" : "ja";
      document.documentElement.lang = applicationLanguage;
      if (persist) {
        try {
          storage().setItem(APPLICATION_LANGUAGE_STORAGE_KEY, applicationLanguage);
        } catch (_error) {
          // The setting remains active for this session when storage is unavailable.
        }
      }
      if (refresh) refreshViews({ refreshAnalysis: false });
      localizeApplicationUI();
      refreshVersion();
      const hint = document.getElementById("hint");
      if (hint?.dataset.hintSource) hint.textContent = translatedHintText(hint.dataset.hintSource);
    }

    function setApplicationTheme(theme, { persist = true, redraw = true } = {}) {
      applicationTheme = theme === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = applicationTheme;
      const select = document.getElementById("applicationThemeSelect");
      if (select) select.value = applicationTheme;
      if (persist) {
        try {
          storage().setItem(APPLICATION_THEME_STORAGE_KEY, applicationTheme);
        } catch (_error) {
          // The setting remains active for this session when storage is unavailable.
        }
      }
      if (redraw) redrawCanvas();
    }

    const listeners = [];
    let started = false;
    function listen(id, event, handler) {
      const target = document.getElementById(id);
      if (!target) return;
      target.addEventListener(event, handler);
      listeners.push(() => target.removeEventListener(event, handler));
    }
    function start() {
      if (started) return;
      started = true;
      listen("applicationSettingsBtn", "click", () => {
        const select = document.getElementById("applicationLanguageSelect");
        if (select) select.value = applicationLanguage;
        const themeSelect = document.getElementById("applicationThemeSelect");
        if (themeSelect) themeSelect.value = applicationTheme;
        document.getElementById("applicationSettingsDialog")?.showModal();
      });
      listen("applicationLanguageSelect", "change", (event) => {
        setApplicationLanguage(event.target.value);
        redrawCanvas();
      });
      listen("applicationThemeSelect", "change", (event) => {
        setApplicationTheme(event.target.value);
      });

    }
    function dispose() {
      for (const remove of listeners.splice(0)) remove();
      started = false;
    }
    function storedTheme() {
      try { return storage().getItem(APPLICATION_THEME_STORAGE_KEY); }
      catch (_error) { return null; }
    }
    return Object.freeze({
      get language() { return applicationLanguage; },
      get theme() { return applicationTheme; },
      applicationText, translatedExactText, translatedHintText, localizeApplicationUI,
      setApplicationLanguage, setApplicationTheme, storedTheme, start, dispose,
    });
  }
  window.ApplicationSettings = Object.freeze({ create });
})();

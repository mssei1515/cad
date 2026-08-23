/* app.js: Canvas UI and event handling */
(function () {
  "use strict";

  const {
    MIN_ORIENTATION_LENGTH,
    normalizeAnglePositive,
    normalizeAngleSigned,
    arcEndpointPoint,
    arcSweep,
    unwrapAngleNear,
    shortestAngleFrom,
    angleOnSignedSweep,
    arcParamOnSweep,
    angleAtArcParam,
    arcSamplePoints,
    lineUnit,
    lineNormal,
    lineSupportNormal,
    lineHasDirection,
    lineAngle,
    signedPointLineDistance,
    signedPointDirectedLineDistance,
    projectPointToLine,
    projectPointToSegmentPoint,
    closestPointOnSegment,
    distancePointToSegment,
    distancePointToSegmentPoints,
    lineIntersection,
  } = window.GeometryKernel;

  const {
    create: createGeometryRef,
    parseId: parseGeometryRefId,
    parseKey: parseGeometryRefKey,
    id: geometryRefId,
    key: geometryRefKey,
    equals: geometryRefsEqual,
    resolve: resolveGeometryRefValue,
  } = window.GeometryRef;

  const { create: createConstraintCodecRegistry } = window.ConstraintCodecRegistry;
  const {
    dependencies: expressionDependencies,
    evaluate: evaluateParameterExpression,
    evaluateDefinitions: evaluateParameterDefinitions,
    validateIdentifier: validateParameterIdentifier,
    rewriteIdentifiers: rewriteParameterIdentifiers,
  } = window.ParameterEngine;

  const {
    hypot2,
    vectorNorm,
    Point,
    Line,
    Circle,
    Arc,
    DistanceConstraint,
    PointAxisDistanceConstraint,
    PointLineDistanceConstraint,
    LineLineDistanceConstraint,
    OffsetConstraint,
    LineAngleConstraint,
    CoincidentConstraint,
    ArcEndpointCoincidentConstraint,
    ArcEndpointArcEndpointCoincidentConstraint,
    PointOnLineConstraint,
    PointOnLineMidpointConstraint,
    ArcEndpointOnLineConstraint,
    ArcEndpointFixedConstraint,
    LineFixedConstraint,
    HorizontalConstraint,
    VerticalConstraint,
    PointHorizontalConstraint,
    PointVerticalConstraint,
    SymmetryConstraint,
    LineSymmetryConstraint,
    ParallelConstraint,
    PerpendicularConstraint,
    CollinearConstraint,
    EqualLengthConstraint,
    RadiusConstraint,
    DiameterConstraint,
    ConcentricConstraint,
    EqualRadiusConstraint,
    PointOnCircleConstraint,
    ArcEndpointOnCircleConstraint,
    LineCircleTangentConstraint,
    CircleCircleTangentConstraint,
    DragConstraint,
    ParameterDragConstraint,
    ArcEndpointDragConstraint,
    ConstraintSolver,
  } = window.GeometrySolver;

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const dimensionValueInput = document.getElementById("dimensionValueInput");
  const APPLICATION_LANGUAGE_STORAGE_KEY = "cad2.application.language";
  const DEFAULT_COLOR_PALETTE = [
    "#000000", "#111827", "#374151", "#64748b", "#94a3b8", "#cbd5e1", "#ffffff",
    "#fca5a5", "#dc2626", "#991b1b",
    "#fdba74", "#f97316", "#c2410c",
    "#fde68a", "#f59e0b", "#b45309",
    "#86efac", "#16a34a", "#166534",
    "#5eead4", "#14b8a6", "#0f766e",
    "#67e8f9", "#0ea5e9", "#0e7490",
    "#93c5fd", "#2563eb", "#1e40af",
    "#c4b5fd", "#7c3aed", "#5b21b6",
    "#f9a8d4", "#db2777", "#9d174d",
  ];
  const UI_TRANSLATIONS = [
    ["ファイル", "File"], ["編集", "Edit"], ["ヘルプ", "Help"],
    ["保存", "Save"], ["開く", "Open"], ["Parameter…", "Parameters…"], ["ドキュメント設定", "Document Settings"], ["アプリケーション設定", "Application Settings"],
    ["元に戻す", "Undo"], ["やり直す", "Redo"], ["削除", "Delete"], ["選択", "Select"], ["選択・ドラッグ", "Select / Drag"],
    ["ジオメトリ", "Geometry"], ["拘束", "Constraint"], ["注記", "Annotation"], ["ツールバー", "Toolbar"], ["メニューバー", "Menu bar"], ["表示ツール", "View"],
    ["点", "Point"], ["線", "Line"], ["連続線", "Polyline"], ["矩形", "Rectangle"], ["円", "Circle"], ["円弧", "Arc"],
    ["実線／補助線", "Normal / Construction"], ["トリム", "Trim"], ["R面取り", "Fillet"], ["フィレット", "Fillet"], ["オフセット", "Offset"],
    ["寸法", "Dimension"], ["一致", "Coincident"], ["水平", "Horizontal"], ["垂直", "Vertical"], ["平行", "Parallel"], ["直角", "Perpendicular"],
    ["対称", "Symmetry"], ["同心", "Concentric"], ["等寸", "Equal"], ["接線", "Tangent"], ["固定／解除", "Fix / Unfix"], ["固定解除", "Unfix"],
    ["引出線", "Leader"], ["自由テキスト", "Free Text"], ["拘束状態表示", "Constraint Status View"],
    ["拘束状態表示を切り替え（Space長押しでも一時表示）", "Toggle constraint status view (hold Space for temporary view)"],
    ["拘束ツールはツールバーから選択します", "Select constraint tools from the toolbar"],
    ["エクスプローラー", "Explorer"], ["プロパティ", "Properties"], ["スケッチ", "Sketch"], ["スケッチツリー", "Sketch Tree"],
    ["スケッチ一覧", "Sketches"], ["ブロック一覧", "Blocks"], ["ブロック", "Block"], ["ブロック定義", "Block Definitions"], ["ブロック定義…", "Block Definitions…"], ["ブロックインスタンス", "Block Instance"],
    ["ブロック作成", "Create Block"], ["作成", "Create"], ["キャンセル", "Cancel"], ["完了", "Done"], ["閉じる", "Close"], ["子＋", "Child +"],
    ["名前変更", "Rename"], ["スケッチ削除", "Delete Sketch"], ["ブロック名", "Block name"], ["配置", "Place"], ["非表示にする", "Hide"], ["表示する", "Show"],
    ["キャンバス", "Canvas"], ["ステータスバー", "Status Bar"], ["寸法値", "Dimension value"],
    ["既定の外観", "Default Appearance"], ["既定の補助線外観", "Default Construction Appearance"], ["一般", "General"], ["言語", "Language"],
    ["アプリケーション全体の設定をドキュメント設定から分離して管理します。", "Application-wide settings are managed separately from document settings."],
    ["既定", "Default"], ["表示", "Visible"], ["非表示", "Hidden"], ["色", "Color"], ["線種", "Line type"], ["線幅", "Line width"],
    ["実線", "Solid"], ["破線", "Dashed"], ["一点鎖線", "Dash-dot"], ["点線", "Dotted"], ["端部のはみ出し", "Endpoint overhang"], ["端部の点", "Endpoint points"], ["あり", "Enabled"], ["なし", "Disabled"], ["使用済みの色", "Colors used in this file"],
    ["標準色", "Standard colors"], ["このファイルで使用中の色", "Colors used in this file"], ["任意の色", "Custom color"], ["使用中の色はありません", "No colors are used yet"], ["適用", "Apply"], ["破棄", "Discard"], ["追加", "Add"],
    ["名前空間", "Namespace"], ["名前", "Name"], ["数式", "Expression"], ["評価値", "Evaluated value"], ["種類／所属", "Type / owner"], ["Parameter名", "Parameter name"], ["読み取り専用", "Read-only"], ["Geometryから測定", "Measured from geometry"],
    ["外観", "Appearance"], ["外観の上書き", "Appearance Override"], ["配置情報", "Placement"], ["定義", "Definition"], ["回転", "Rotation"],
    ["長さ", "Length"], ["半径", "Radius"], ["補助線", "Construction"], ["種類", "Type"], ["値", "Value"],
    ["寸法表示", "Dimension Display"], ["精度", "Precision"], ["接頭辞", "Prefix"], ["接尾辞", "Suffix"], ["矢印", "Arrows"], ["寸法補助線", "Extension lines"],
    ["テキスト", "Text"], ["文字サイズ", "Font size"], ["アクティブ", "Active"], ["はい", "Yes"], ["いいえ", "No"],
    ["選択したオブジェクトのプロパティを表示します。", "Select an object to display its properties."],
    ["複数選択の共通プロパティ編集は今回の対象外です。", "Editing shared properties for multiple selections is not supported."],
    ["個のオブジェクト", "objects"], ["自動", "Auto"], ["中心", "Center"], ["角度", "Angle"], ["補助", "Construction"], ["固定", "Fixed"],
    ["完全拘束", "Fully constrained"], ["支持位置拘束", "Supported position"], ["未拘束", "Under-constrained"], ["矛盾", "Conflict"],
    ["参照エラー", "Reference error"], ["重複", "Duplicate"], ["拘束状態表示中", "Constraint status view"],
    ["Geometryを選択または作成します。Spaceで拘束状態を表示します。", "Select or create geometry. Hold Space to show constraint status."],
    ["エクスプローラーを最小化", "Collapse Explorer"], ["エクスプローラーを展開", "Expand Explorer"], ["プロパティを最小化", "Collapse Properties"], ["プロパティを展開", "Expand Properties"],
    ["カラーパレット", "Color palette"], ["ジオメトリID", "Geometry ID"], ["日本語", "Japanese"], ["英語", "English"],
    ["小さいサイズでも見やすい、Cad2のシンプルなロゴ", "A simple Cad2 logo designed to remain clear at small sizes"],
    ["通常表示", "Normal view"], ["選択・ドラッグできます。Shift/Ctrlクリックで複数選択できます。", "Select and drag geometry. Use Shift/Ctrl-click for multiple selection."],
    ["キャンバスをクリックして点を追加します。", "Click the canvas to add a point."], ["端点位置をクリックして連続線を作成します。終了はEscです。", "Click endpoint positions to create connected lines. Press Esc to finish."],
    ["矩形の1つ目の角をクリックしてください。Escで選択モードに戻ります", "Click the first rectangle corner. Press Esc to return to selection mode."],
    ["円の中心をクリックしてください。Escで選択モードに戻ります", "Click the circle center. Press Esc to return to selection mode."],
    ["円弧の中心をクリックしてください。Escで選択モードに戻ります", "Click the arc center. Press Esc to return to selection mode."],
    ["引出線を付ける図形をクリックしてください", "Click geometry to attach the leader."], ["引出線の文字位置をクリックしてください", "Click the leader text position."],
    ["引出線をキャンセルしました", "Leader creation was canceled."], ["引出線を追加しました", "Leader was added."],
    ["テキストを配置する位置をクリックしてください", "Click where you want to place the text."], ["テキストを追加しました", "Text was added."], ["テキストをキャンセルしました", "Text creation was canceled."],
    ["Root Sketchには図形を作成できません。子スケッチを選択してください。", "Geometry cannot be created in the Root Sketch. Select a child sketch."],
    ["配置する内部スケッチを選び、表示中心をクリックしてください", "Select internal sketches to place, then click the display center."],
    ["図形を持つ内部スケッチを1つ以上有効にしてください", "Enable at least one internal sketch that contains geometry."],
    ["回転方向をクリックしてください。Escで角度0度として配置します", "Click to set the rotation direction. Press Esc to place at 0 degrees."],
    ["ブロック定義編集をキャンセルしました", "Block definition editing was canceled."], ["ブロック作成をキャンセルしました", "Block creation was canceled."],
    ["指定した側にはオフセットを作成できません", "An offset cannot be created on the specified side."],
    ["オフセット距離を入力してください。Enterまたはダブルクリックで決定します", "Enter the offset distance. Confirm with Enter or double-click."],
    ["作成可能な0より大きいオフセット距離を入力してください", "Enter an offset distance greater than zero."],
    ["ブロック定義編集を終了してから保存してください", "Finish block definition editing before saving."], ["ファイルとして保存しました", "The document was saved to a file."],
    ["ブロック定義編集を終了してから読み込んでください", "Finish block definition editing before opening a file."], ["ファイル読み込みに失敗しました", "Failed to open the file."],
    ["連続線を終了しました", "Polyline creation finished."], ["選択・ドラッグモードに戻りました", "Returned to Select / Drag mode."], ["作図操作をキャンセルしました", "Drawing was canceled."],
    ["コピーする図形を選択してください", "Select geometry to copy."], ["貼り付ける図形がありません", "There is no geometry to paste."], ["貼り付け先のスケッチをアクティブにしてください", "Activate the destination sketch before pasting."],
    ["寸法線の位置をクリックしてください", "Click the dimension-line position."], ["寸法対象を選択してください。", "Select dimension targets."],
    ["寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル", "Entering a dimension value: type a number, confirm with Enter/double-click, or cancel with Esc."],
    ["オフセット距離を入力中: Enter/ダブルクリックで決定、Escでキャンセル", "Entering an offset distance: confirm with Enter/double-click, or cancel with Esc."],
    ["読み取り専用寸法の値は編集できません", "A read-only dimension value cannot be edited."], ["寸法値には0より大きい数値を入力してください", "Enter a dimension value greater than zero."],
    ["回転がロックされたブロックインスタンスです", "This block instance has locked rotation."], ["固定されたブロックインスタンスです", "This block instance is fixed."],
    ["ブロックを回転中", "Rotating block"], ["ブロックを移動中", "Moving block"], ["引出線を移動中", "Moving leader"], ["テキストを移動中", "Moving text"],
    ["トリムできる交点がありません", "No intersection is available for trimming."], ["R寸法を入力してください。数字キーで編集、Enterで作成、Escでキャンセル", "Enter the fillet radius. Type a number, press Enter to create, or Esc to cancel."],
    ["R寸法には0より大きい数値を入力してください", "Enter a fillet radius greater than zero."], ["R面取りする線をクリックしてください", "Click a line to fillet."],
    ["接続する2本目の線をクリックするとR面取りを作成します", "Click the second connected line to create the fillet."], ["別の接続線をクリックしてください", "Click a different connected line."],
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
  ];
  let applicationLanguage = (() => {
    try {
      return localStorage.getItem(APPLICATION_LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ja";
    } catch (_error) {
      return "ja";
    }
  })();
  document.documentElement.lang = applicationLanguage;
  const DEFAULT_DOCUMENT_NAME = "無題";
  const ROOT_SKETCH_ID = "ROOT";
  const ROOT_SKETCH_NAME = "Root Sketch";
  const DEFAULT_SKETCH_ID = "S1";
  const DEFAULT_SKETCH_NAME = "Sketch-1";
  const model = {
    documentName: DEFAULT_DOCUMENT_NAME,
    defaultAppearance: null,
    defaultConstructionAppearance: null,
    sketches: [
      { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} },
      { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} },
    ],
    activeSketchId: DEFAULT_SKETCH_ID,
    annotations: [],
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints: [],
    parameters: [],
    nextDimensionParameterIndex: 1,
    blockDefinitions: [],
    blockInstances: [],
  };
  const solver = new ConstraintSolver(model);

  let mode = "select";
  let selectedPoints = [];
  let selectedLines = [];
  let selectedCircles = [];
  let selectedArcs = [];
  let selectedBlockInstances = [];
  let dragSession = null;
  let dimensionDragSession = null;
  let annotationDragSession = null;
  let hoveredPoint = null;
  let hoveredEndpointPoint = null;
  let hoveredLine = null;
  let hoveredCircle = null;
  let hoveredArc = null;
  let hoveredBlockInstance = null;
  let hoveredArcEndpoint = null;
  let hoveredDimensionConstraint = null;
  let selectedArcEndpoint = null;
  let selectedArcEndpointPair = null;
  let selectedDimensionConstraint = null;
  let selectedConstraint = null;
  let selectedAnnotation = null;
  let hoveredAnnotation = null;
  let hoveredSidebarItem = null;
  let constraintAnalysisState = null;
  let constraintRedundancyState = { constraints: new Map(), sketches: new Map(), count: 0 };
  let lastAuthoringPerformance = null;
  let sketchSolveStates = new Map();
  let invalidReferenceConstraints = new Map();
  let panSession = null;
  let selectionRectSession = null;
  let blankDoubleClickCandidate = null;
  let suppressNextBlankDoubleClickEvent = false;
  let lineStartPoint = null;
  let pointStartRollback = null;
  let rectangleStartPoint = null;
  let lineStartRollback = null;
  let lineCompletionRollback = null;
  let filletFirstLine = null;
  let circleCenterPoint = null;
  let arcCenterPoint = null;
  let arcStartPoint = null;
  let pointerPreview = null;
  let activeSnap = null;
  let trimPreview = null;
  let offsetSource = null;
  let pendingCommand = null;
  let pendingConstraintCommand = null;
  let constraintOperands = [];
  let lastPointerWorld = null;
  let colorPaletteSession = null;
  let parameterDialogSession = null;
  let hoveredSketchIdentity = null;
  let hoveredSketchTreeId = null;
  let constructionLineMode = false;
  let pointSeq = 1;
  let lineSeq = 1;
  let circleSeq = 1;
  let arcSeq = 1;
  let sketchSeq = 2;
  let annotationSeq = 1;
  let blockDefinitionSeq = 1;
  let blockInstanceSeq = 1;
  let blockElementSeq = 1;
  let lastMiddleAuxClick = null;
  let blockPlacementDefinitionId = null;
  let blockPlacementAnchor = null;
  let blockPlacementEnabledSketchIds = [];
  let blockPlacementRotationLocked = true;
  let blockEditSession = null;
  let blockProjectionCache = new Map();
  let undoStack = [];
  let redoStack = [];
  let historyRestoring = false;
  let geometryClipboard = null;
  const HISTORY_LIMIT = 80;
  const CLIPBOARD_PASTE_OFFSET_SCREEN_PX = 24;
  const BLOCK_ORTHOGONAL_ROTATION_STEP = Math.PI / 2;
  const viewport = { x: 0, y: 0, scale: 1 };
  const viewState = { constraintStatus: false, geometryIds: false };
  let constraintStatusMouseLatched = false;
  let constraintStatusSpaceHeld = false;
  const MIN_ZOOM = 0.001;
  const MAX_ZOOM = 10000000;
  const CONSTRUCTION_EXTENSION_SCREEN_PX = 12;
  const CONSTRUCTION_GEOMETRY_ALPHA = 0.72;
  const DIMENSION_EXTENSION_GAP_SCREEN_PX = 6;
  const DIMENSION_EXTENSION_SCREEN_PX = 6;
  const DIMENSION_POINT_MARKER_RADIUS_SCREEN_PX = 5;
  const DIMENSION_ARROW_LENGTH_SCREEN_PX = 10;
  const DIMENSION_ARROW_HALF_WIDTH_SCREEN_PX = 2.4;
  const DIMENSION_DISPLAY_PRECISION = 1e-6;
  const MEASURED_DIMENSION_SNAP_TOLERANCE = 1e-5;
  const CONSTRAINT_ACCEPT_ERROR = 1e-4;
  const PARAMETER_STABILIZATION_MAX_PASSES = 20;
  const PARAMETER_STABILIZATION_RELATIVE_TOLERANCE = 1e-7;
  const DRAG_PREVIEW_ERROR_SCREEN_PX = 0.1;
  const DRAG_PREVIEW_MAX_MODEL_ERROR = 0.125;
  const DEFAULT_FILLET_RADIUS = 30;
  const MIN_LINE_LENGTH = Math.max(MIN_ORIENTATION_LENGTH, solver.minLineLength || 12);
  const MIN_ARC_LENGTH = MIN_LINE_LENGTH;
  const CONSTRAINT_STATUS_COLORS = {
    full: "#111827",
    support: "#0f766e",
    under: "#f59e0b",
    conflict: "#dc2626",
  };
  const DEFAULT_APPEARANCE = {
    visible: true,
    color: "#111827",
    lineType: "solid",
    lineWidth: 2,
  };
  const DEFAULT_CONSTRUCTION_APPEARANCE = {
    color: "#64748b",
    lineType: "dashdot",
    lineWidth: 1.1,
    endpointOverhang: true,
    endpointMarkers: true,
  };
  const SKETCH_SOLVE_ERROR_COLOR = "#dc2626";
  let lastLoadLineRepairMessage = "";
  let lastLoadBlockConstraintRepairMessage = "";

  const constraintButtons = Array.from(document.querySelectorAll("[data-constraint]"));
  const fixPointBtn = document.getElementById("fixPointBtn");

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
  }

  function setApplicationLanguage(language, { persist = true, refresh = true } = {}) {
    applicationLanguage = language === "en" ? "en" : "ja";
    document.documentElement.lang = applicationLanguage;
    if (persist) {
      try {
        localStorage.setItem(APPLICATION_LANGUAGE_STORAGE_KEY, applicationLanguage);
      } catch (_error) {
        // The setting remains active for this session when storage is unavailable.
      }
    }
    if (refresh) updateUI({ refreshAnalysis: false });
    localizeApplicationUI();
    const hint = document.getElementById("hint");
    if (hint?.dataset.hintSource) hint.textContent = translatedHintText(hint.dataset.hintSource);
  }

  for (const btn of document.querySelectorAll("button[aria-label]")) {
    btn.dataset.tooltip = btn.getAttribute("aria-label");
  }

  function log(msg) {
    const el = document.getElementById("log");
    if (!el) return;
    el.textContent = `${msg}\n` + el.textContent;
  }

  function activateSidebarTab(tabId) {
    for (const button of document.querySelectorAll("[data-sidebar-tab]")) {
      const active = button.dataset.sidebarTab === tabId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const panel of document.querySelectorAll("[data-sidebar-panel]")) {
      const active = panel.dataset.sidebarPanel === tabId;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    }
  }

  function setSidebarCollapsed(collapsed, hintText = "") {
    const app = document.querySelector(".app");
    if (!app) return false;
    const changed = app.classList.contains("side-collapsed") !== collapsed;
    app.classList.toggle("side-collapsed", collapsed);
    const btn = document.getElementById("toggleSideBtn");
    const label = collapsed ? "サイドバーを開く" : "サイドバーをたたむ";
    btn?.setAttribute("aria-label", label);
    btn?.setAttribute("title", label);
    if (btn) btn.dataset.tooltip = label;
    if (hintText) setHint(hintText);
    return changed;
  }

  function setHint(msg, kind = "normal") {
    const el = document.getElementById("hint");
    el.dataset.hintSource = String(msg);
    el.textContent = translatedHintText(msg);
    el.classList.toggle("error", kind === "error");
  }

  function sanitizeDocumentNameValue(value) {
    return String(value ?? "").replace(/[\r\n\t]+/g, " ");
  }

  function effectiveDocumentName() {
    const name = sanitizeDocumentNameValue(model.documentName).trim();
    return name || DEFAULT_DOCUMENT_NAME;
  }

  function fileNameStem(fileName) {
    const name = sanitizeDocumentNameValue(fileName).trim();
    return name.replace(/\.[^.\\/]+$/, "") || DEFAULT_DOCUMENT_NAME;
  }

  function safeDownloadBaseName(name) {
    return effectiveDocumentNameFromValue(name).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/[. ]+$/g, "").trim() || "cad-model";
  }

  function effectiveDocumentNameFromValue(value) {
    const name = sanitizeDocumentNameValue(value).trim();
    return name || DEFAULT_DOCUMENT_NAME;
  }

  function updateDocumentNameUI() {
    const displayName = effectiveDocumentName();
    document.title = `${displayName} - Cad2`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  function normalizeAppearance(value, { partial = true } = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const result = partial ? {} : { ...DEFAULT_APPEARANCE };
    if (Object.prototype.hasOwnProperty.call(source, "visible")) result.visible = source.visible !== false;
    if (typeof source.color === "string" && /^#[0-9a-fA-F]{6}$/.test(source.color)) result.color = source.color.toLowerCase();
    if (["solid", "dashed", "dashdot", "dotted"].includes(source.lineType)) result.lineType = source.lineType;
    const lineWidth = Number(source.lineWidth ?? source.lineWidthPx);
    if (Number.isFinite(lineWidth)) result.lineWidth = Math.max(0.5, Math.min(10, lineWidth));
    if (Object.prototype.hasOwnProperty.call(source, "endpointOverhang")) result.endpointOverhang = source.endpointOverhang !== false;
    if (Object.prototype.hasOwnProperty.call(source, "endpointMarkers")) result.endpointMarkers = source.endpointMarkers !== false;
    return result;
  }

  function normalizeConstructionAppearance(value, { partial = true } = {}) {
    return { ...(partial ? {} : DEFAULT_CONSTRUCTION_APPEARANCE), ...normalizeAppearance(value) };
  }

  function normalizeAnnotations(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const type = item.type === "text" ? "text" : item.type === "leader" ? "leader" : null;
      if (!type) return null;
      const normalized = {
        id: String(item.id || `AN${index + 1}`),
        type,
        visible: item.visible !== false,
        text: String(item.text || ""),
        x: Number.isFinite(Number(item.x)) ? Number(item.x) : 0,
        y: Number.isFinite(Number(item.y)) ? Number(item.y) : 0,
        style: item.style && typeof item.style === "object" ? { ...item.style } : {},
      };
      if (type === "leader") {
        normalized.geometryRef = item.geometryRef && typeof item.geometryRef === "object" ? { ...item.geometryRef } : null;
        for (const key of ["start", "elbow", "end"]) {
          const point = item[key];
          normalized[key] = point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)) ? { x: Number(point.x), y: Number(point.y) } : null;
        }
      }
      return normalized;
    }).filter(Boolean);
  }

  function ensureSketchState() {
    if (!Array.isArray(model.sketches)) model.sketches = [];
    let root = model.sketches.find((sketch) => sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID);
    if (!root) {
      root = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} };
      model.sketches.unshift(root);
    }
    model.sketches = [root, ...model.sketches.filter((sketch) => sketch !== root && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
    root.id = ROOT_SKETCH_ID;
    root.name = root.name || ROOT_SKETCH_NAME;
    root.parentSketchId = null;
    root.kind = "root";
    root.appearance = normalizeAppearance(root.appearance);
    root.visible = true;
    const ids = new Set(model.sketches.map((sketch) => sketch.id));
    for (const sketch of model.sketches) {
      if (sketch === root) continue;
      sketch.kind = "sketch";
      sketch.appearance = normalizeAppearance(sketch.appearance || (sketch.visible === false ? { visible: false } : {}));
      sketch.visible = sketch.appearance.visible !== false;
      if (!Object.prototype.hasOwnProperty.call(sketch, "parentSketchId")) sketch.parentSketchId = null;
      if (sketch.parentSketchId === sketch.id || !ids.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      if (sketch.parentSketchId == null) sketch.parentSketchId = ROOT_SKETCH_ID;
    }
    if (!model.activeSketchId || !model.sketches.some((sketch) => sketch.id === model.activeSketchId)) {
      model.activeSketchId = ROOT_SKETCH_ID;
    }
  }

  function ensureAppearanceState() {
    model.defaultAppearance = normalizeAppearance(model.defaultAppearance, { partial: false });
    model.defaultConstructionAppearance = normalizeConstructionAppearance(model.defaultConstructionAppearance, { partial: false });
    model.annotations = normalizeAnnotations(model.annotations);
    for (const item of [...model.points, ...model.lines, ...model.circles, ...model.arcs]) item.appearance = normalizeAppearance(item.appearance);
  }

  function ensureBlockState() {
    if (!Array.isArray(model.blockDefinitions)) model.blockDefinitions = [];
    if (!Array.isArray(model.blockInstances)) model.blockInstances = [];
    const definitionIds = new Set();
    model.blockDefinitions = model.blockDefinitions.filter(Boolean).map((definition, index) => {
      let id = String(definition.id || `B${index + 1}`);
      while (definitionIds.has(id)) id = `B${index + 1}-${definitionIds.size + 1}`;
      definitionIds.add(id);
      definition.id = id;
      definition.name = String(definition.name || `Block-${index + 1}`);
      definition.parentDefinitionId = definition.parentDefinitionId == null ? null : String(definition.parentDefinitionId);
      definition.origin = {
        x: Number(definition.origin?.x) || 0,
        y: Number(definition.origin?.y) || 0,
      };
      if (!Array.isArray(definition.sketches) || definition.sketches.length === 0) {
        definition.sketches = [
          { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} },
          { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} },
        ];
      }
      let root = definition.sketches.find((sketch) => sketch?.kind === "root" || sketch?.id === ROOT_SKETCH_ID);
      if (!root) {
        root = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} };
        definition.sketches.unshift(root);
      }
      root.id = ROOT_SKETCH_ID;
      root.name = ROOT_SKETCH_NAME;
      root.parentSketchId = null;
      root.kind = "root";
      root.appearance = normalizeAppearance(root.appearance);
      root.visible = true;
      definition.sketches = [root, ...definition.sketches.filter((sketch) => sketch && sketch !== root && sketch.id !== ROOT_SKETCH_ID && sketch.kind !== "root")];
      if (!definition.sketches.some((sketch) => sketch.kind !== "root")) {
        definition.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
      }
      const sketchIds = new Set(definition.sketches.map((sketch) => String(sketch.id)));
      for (const sketch of definition.sketches) {
        sketch.id = String(sketch.id);
        if (sketch === root) continue;
        sketch.kind = "sketch";
        sketch.name = String(sketch.name || sketch.id);
        sketch.appearance = normalizeAppearance(sketch.appearance || (sketch.visible === false ? { visible: false } : {}));
        sketch.visible = sketch.appearance.visible !== false;
        sketch.parentSketchId = sketch.parentSketchId == null ? ROOT_SKETCH_ID : String(sketch.parentSketchId);
        if (sketch.parentSketchId === sketch.id || !sketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      }
      const fallbackSketchId = definition.sketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
      definition.activeSketchId = sketchIds.has(String(definition.activeSketchId)) ? String(definition.activeSketchId) : fallbackSketchId;
      definition.points = Array.isArray(definition.points) ? definition.points : [];
      definition.lines = Array.isArray(definition.lines) ? definition.lines : [];
      definition.circles = Array.isArray(definition.circles) ? definition.circles : [];
      definition.arcs = Array.isArray(definition.arcs) ? definition.arcs : [];
      definition.blockInstances = Array.isArray(definition.blockInstances) ? definition.blockInstances : [];
      definition.constraints = Array.isArray(definition.constraints) ? definition.constraints : [];
      for (const item of [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs, ...definition.constraints]) {
        if (!sketchIds.has(String(item.sketchId)) || item.sketchId === ROOT_SKETCH_ID) item.sketchId = fallbackSketchId;
        else item.sketchId = String(item.sketchId);
        if (item instanceof Point || item instanceof Line || item instanceof Circle || item instanceof Arc) item.appearance = normalizeAppearance(item.appearance);
      }
      definition.revision = Number(definition.revision) || 0;
      return definition;
    });
    const containingDefinitionIds = new Map();
    for (const definition of model.blockDefinitions) {
      for (const instance of definition.blockInstances || []) {
        const childId = String(instance?.definitionId || "");
        if (!definitionIds.has(childId)) continue;
        if (!containingDefinitionIds.has(childId)) containingDefinitionIds.set(childId, new Set());
        containingDefinitionIds.get(childId).add(definition.id);
      }
    }
    for (const definition of model.blockDefinitions) {
      const inferredParents = [...(containingDefinitionIds.get(definition.id) || [])];
      if (!definition.parentDefinitionId && inferredParents.length === 1) definition.parentDefinitionId = inferredParents[0];
      if (definition.parentDefinitionId === definition.id) definition.parentDefinitionId = null;
    }
    for (const definition of model.blockDefinitions) {
      const drawableSketchIds = blockDefinitionDrawableSketchIds(definition);
      const fallbackSketchId = drawableSketchIds[0] || DEFAULT_SKETCH_ID;
      definition.blockInstances = definition.blockInstances
        .filter((instance) => instance && definitionIds.has(String(instance.definitionId)) && model.blockDefinitions.find((item) => item.id === String(instance.definitionId))?.parentDefinitionId === definition.id)
        .map((instance, index) => {
          instance.id = String(instance.id || `BI${index + 1}`);
          instance.definitionId = String(instance.definitionId);
          instance.sketchId = drawableSketchIds.includes(String(instance.sketchId)) ? String(instance.sketchId) : fallbackSketchId;
          instance.x = Number(instance.x) || 0;
          instance.y = Number(instance.y) || 0;
          instance.rotation = Number(instance.rotation) || 0;
          instance.fixed = Boolean(instance.fixed);
          instance.rotationLocked = Boolean(instance.rotationLocked);
          instance.appearanceOverride = normalizeAppearance(instance.appearanceOverride);
          const nestedDefinition = model.blockDefinitions.find((item) => item.id === instance.definitionId);
          const nestedDrawableIds = blockDefinitionDrawableSketchIds(nestedDefinition);
          const requested = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : nestedDrawableIds;
          instance.enabledSketchIds = [...new Set(requested.filter((id) => nestedDrawableIds.includes(id)))];
          if (instance.enabledSketchIds.length === 0) instance.enabledSketchIds = blockDefinitionGeometrySketchIds(nestedDefinition);
          return instance;
        });
    }
    const instanceIds = new Set();
    const activeContainerDefinitionId = blockEditSession?.draft?.id || null;
    model.blockInstances = model.blockInstances.filter((instance) => {
      if (!instance || !definitionIds.has(String(instance.definitionId))) return false;
      const instanceDefinition = model.blockDefinitions.find((definition) => definition.id === String(instance.definitionId));
      return (instanceDefinition?.parentDefinitionId || null) === activeContainerDefinitionId;
    }).map((instance, index) => {
      let id = String(instance.id || `BI${index + 1}`);
      while (instanceIds.has(id)) id = `BI${index + 1}-${instanceIds.size + 1}`;
      instanceIds.add(id);
      instance.id = id;
      instance.definitionId = String(instance.definitionId);
      instance.sketchId = isDrawableSketch(instance.sketchId) ? String(instance.sketchId) : firstDrawableSketchId();
      instance.x = Number(instance.x) || 0;
      instance.y = Number(instance.y) || 0;
      instance.rotation = Number(instance.rotation) || 0;
      instance.fixed = Boolean(instance.fixed);
      instance.rotationLocked = Boolean(instance.rotationLocked);
      instance.appearanceOverride = normalizeAppearance(instance.appearanceOverride);
      const definition = model.blockDefinitions.find((item) => item.id === instance.definitionId);
      const drawableIds = blockDefinitionDrawableSketchIds(definition);
      const requested = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : drawableIds;
      instance.enabledSketchIds = [...new Set(requested.filter((id) => drawableIds.includes(id)))];
      if (instance.enabledSketchIds.length === 0) instance.enabledSketchIds = blockDefinitionGeometrySketchIds(definition);
      return instance;
    });
  }

  function ensureModelState() {
    ensureSketchState();
    ensureAppearanceState();
    ensureBlockState();
    ensureParameterNamespace(model);
  }

  function currentParameterNamespace() {
    return model;
  }

  function dimensionExpressionValue(constraint) {
    const target = targetFromConstraint(constraint);
    return target?.kind === "angle" ? angleDegrees(constraint.target) : Number(constraint.target);
  }

  function numericDimensionExpression(constraint) {
    const value = dimensionExpressionValue(constraint);
    return Number.isFinite(value) ? String(Number(value.toPrecision(15))) : "0";
  }

  function dimensionConstraintsInNamespace(namespace) {
    return (namespace?.constraints || []).filter(isDimensionConstraint);
  }

  function allocateDimensionParameterName(namespace) {
    ensureParameterNamespace(namespace, { assignDimensions: false });
    const used = new Set([
      ...(namespace.parameters || []).map((parameter) => String(parameter.name)),
      ...dimensionConstraintsInNamespace(namespace).map((constraint) => String(constraint.parameterName || "")),
    ]);
    let index = Math.max(1, Number(namespace.nextDimensionParameterIndex) || 1);
    while (used.has(`d${index}`)) index += 1;
    namespace.nextDimensionParameterIndex = index + 1;
    return `d${index}`;
  }

  function ensureDimensionParameter(constraint, namespace = currentParameterNamespace()) {
    if (!isDimensionConstraint(constraint)) return constraint;
    if (!constraint.parameterName) constraint.parameterName = allocateDimensionParameterName(namespace);
    const autoMatch = /^d(\d+)$/.exec(String(constraint.parameterName));
    if (autoMatch) namespace.nextDimensionParameterIndex = Math.max(Number(namespace.nextDimensionParameterIndex) || 1, Number(autoMatch[1]) + 1);
    if (isReadOnlyDimension(constraint)) {
      delete constraint.expression;
    } else if (typeof constraint.expression !== "string" || !constraint.expression.trim()) {
      constraint.expression = numericDimensionExpression(constraint);
    }
    return constraint;
  }

  function ensureParameterNamespace(namespace, options = {}) {
    if (!namespace) return namespace;
    namespace.parameters = Array.isArray(namespace.parameters) ? namespace.parameters : [];
    for (let index = 0; index < namespace.parameters.length; index += 1) {
      const parameter = namespace.parameters[index];
      if (!parameter || typeof parameter !== "object") namespace.parameters[index] = { name: "", expression: "" };
      else {
        parameter.name = String(parameter.name || "");
        parameter.expression = String(parameter.expression ?? "");
      }
    }
    namespace.nextDimensionParameterIndex = Math.max(1, Number(namespace.nextDimensionParameterIndex) || 1);
    if (options.assignDimensions !== false) {
      for (const constraint of dimensionConstraintsInNamespace(namespace)) ensureDimensionParameter(constraint, namespace);
    }
    return namespace;
  }

  function parameterErrorText(error) {
    const name = error?.identifier ? ` ${error.identifier}` : "";
    const messages = {
      INVALID_IDENTIFIER: applicationText(`名前${name}は使用できません`, `Name${name} is invalid`),
      RESERVED_IDENTIFIER: applicationText(`名前${name}は寸法用に予約されています`, `Name${name} is reserved for dimensions`),
      DUPLICATE_IDENTIFIER: applicationText(`名前${name}が重複しています`, `Name${name} is duplicated`),
      UNKNOWN_IDENTIFIER: applicationText(`未定義の名前${name}があります`, `Unknown name${name}`),
      CYCLE: applicationText("Parameterに循環参照があります", "Parameters contain a circular dependency"),
      DIVISION_BY_ZERO: applicationText("0で除算しています", "Division by zero"),
      NON_FINITE: applicationText("計算結果が有限値ではありません", "The result is not finite"),
      EMPTY_EXPRESSION: applicationText("数式が空です", "The expression is empty"),
    };
    return messages[error?.code] || error?.message || applicationText("Parameterを評価できません", "Could not evaluate parameters");
  }

  function referenceDimensionValues(namespace) {
    const values = new Map();
    for (const constraint of dimensionConstraintsInNamespace(namespace)) {
      if (!isReadOnlyDimension(constraint)) continue;
      const target = targetFromConstraint(constraint);
      const measured = target ? measuredDimensionValue(target, constraint.dimension) : NaN;
      if (!Number.isFinite(measured)) throw new Error(`${constraint.parameterName}: ${applicationText("参照寸法を測定できません", "Reference dimension could not be measured")}`);
      values.set(constraint.parameterName, measured);
      constraint.target = target?.kind === "angle" ? (measured * Math.PI) / 180 : measured;
      constraint.evaluatedParameterValue = measured;
    }
    return values;
  }

  function validateParameterSymbolNames(parameters, dimensions) {
    const seen = new Set();
    for (const parameter of parameters || []) {
      const name = validateParameterIdentifier(parameter.name);
      if (seen.has(name)) throw Object.assign(new Error(`Duplicate identifier '${name}'`), { code: "DUPLICATE_IDENTIFIER", identifier: name });
      seen.add(name);
    }
    for (const dimension of dimensions || []) {
      const name = validateParameterIdentifier(dimension.parameterName != null ? dimension.parameterName : dimension.name, { dimension: true });
      if (seen.has(name)) throw Object.assign(new Error(`Duplicate identifier '${name}'`), { code: "DUPLICATE_IDENTIFIER", identifier: name });
      seen.add(name);
    }
  }

  function evaluateParameterNamespace(namespace, options = {}) {
    ensureParameterNamespace(namespace);
    validateParameterSymbolNames(namespace.parameters, dimensionConstraintsInNamespace(namespace));
    const inputs = options.referenceValues || referenceDimensionValues(namespace);
    const definitions = [
      ...namespace.parameters.map((parameter) => ({ ...parameter, kind: "parameter" })),
      ...dimensionConstraintsInNamespace(namespace)
        .filter((constraint) => !isReadOnlyDimension(constraint))
        .map((constraint) => ({ name: constraint.parameterName, expression: constraint.expression, kind: "dimension", constraint })),
    ];
    const evaluated = evaluateParameterDefinitions(definitions, inputs);
    for (const parameter of namespace.parameters) parameter.evaluatedValue = evaluated.values.get(parameter.name);
    for (const constraint of dimensionConstraintsInNamespace(namespace)) {
      const value = evaluated.values.get(constraint.parameterName);
      if (!Number.isFinite(value)) throw new Error(`${constraint.parameterName}: ${applicationText("値を計算できません", "Value could not be evaluated")}`);
      const target = targetFromConstraint(constraint);
      if (!isReadOnlyDimension(constraint)) {
        const max = target?.kind === "angle" ? 180 : Infinity;
        if (value <= 0 || value >= max) throw new Error(`${constraint.parameterName}: ${applicationText("寸法値の範囲が正しくありません", "Dimension value is out of range")}`);
        constraint.target = target?.kind === "angle" ? (value * Math.PI) / 180 : value;
      }
      constraint.evaluatedParameterValue = value;
    }
    namespace.parameterValues = evaluated.values;
    namespace.parameterDependencies = evaluated.dependencies;
    return evaluated;
  }

  function validateParameterNamespace(namespace) {
    try {
      return { success: true, evaluation: evaluateParameterNamespace(namespace) };
    } catch (error) {
      return { success: false, error, reason: parameterErrorText(error) };
    }
  }

  function prepareLoadedParameterNamespace(namespace, sourceVersion, label) {
    if (sourceVersion >= 10) {
      if (!Array.isArray(namespace.parameters) || !Number.isInteger(Number(namespace.nextDimensionParameterIndex)) || Number(namespace.nextDimensionParameterIndex) < 1) {
        throw new Error(`${label}: ${applicationText("Parameter名前空間の形式が正しくありません", "The parameter namespace is invalid")}`);
      }
      for (const constraint of dimensionConstraintsInNamespace(namespace)) {
        if (typeof constraint.parameterName !== "string" || !constraint.parameterName) {
          throw new Error(`${label}: ${applicationText("寸法のParameter名がありません", "A dimension parameter name is missing")}`);
        }
        if (!isReadOnlyDimension(constraint) && (typeof constraint.expression !== "string" || !constraint.expression.trim())) {
          throw new Error(`${label}/${constraint.parameterName}: ${applicationText("寸法式がありません", "The dimension expression is missing")}`);
        }
      }
    }
    ensureParameterNamespace(namespace);
    const validation = validateParameterNamespace(namespace);
    if (!validation.success) throw new Error(`${label}: ${validation.reason}`);
    return namespace;
  }

  function parameterDependents(namespace, names, removedConstraints = new Set()) {
    ensureParameterNamespace(namespace);
    const removedNames = new Set(names);
    const dependents = [];
    const formulas = [
      ...namespace.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
      ...dimensionConstraintsInNamespace(namespace)
        .filter((constraint) => !isReadOnlyDimension(constraint) && !removedConstraints.has(constraint))
        .map((constraint) => ({ name: constraint.parameterName, expression: constraint.expression })),
    ];
    for (const item of formulas) {
      if (removedNames.has(item.name)) continue;
      let dependencies;
      try {
        dependencies = expressionDependencies(item.expression);
      } catch (_error) {
        continue;
      }
      if ([...dependencies].some((name) => removedNames.has(name))) dependents.push(item.name);
    }
    return [...new Set(dependents)];
  }

  function guardDimensionSymbolDeletion(constraints, namespace = currentParameterNamespace()) {
    const removedConstraints = new Set(constraints || []);
    const removedNames = [...removedConstraints].filter(isDimensionConstraint).map((constraint) => constraint.parameterName).filter(Boolean);
    if (removedNames.length === 0) return true;
    const dependents = parameterDependents(namespace, removedNames, removedConstraints);
    if (dependents.length === 0) return true;
    const message = applicationLanguage === "en"
      ? `Cannot delete ${removedNames.join(", ")}; referenced by ${dependents.join(", ")}`
      : `${removedNames.join("、")} は ${dependents.join("、")} から参照されているため削除できません`;
    setHint(message, "error");
    log(message);
    return false;
  }

  function evaluateDimensionExpressionDraft(constraint, expression, namespace = currentParameterNamespace()) {
    ensureParameterNamespace(namespace);
    validateParameterSymbolNames(namespace.parameters, dimensionConstraintsInNamespace(namespace));
    const referenceValues = new Map();
    const definitions = namespace.parameters.map((parameter) => ({ ...parameter, kind: "parameter" }));
    for (const item of dimensionConstraintsInNamespace(namespace)) {
      if (isReadOnlyDimension(item)) {
        const target = targetFromConstraint(item);
        const value = target ? measuredDimensionValue(target, item.dimension) : NaN;
        referenceValues.set(item.parameterName, value);
      } else {
        definitions.push({
          name: item.parameterName,
          expression: item === constraint ? String(expression) : item.expression,
          kind: "dimension",
        });
      }
    }
    const evaluated = evaluateParameterDefinitions(definitions, referenceValues);
    const value = constraint
      ? evaluated.values.get(constraint.parameterName)
      : evaluateParameterExpression(String(expression), evaluated.values);
    const target = constraint ? targetFromConstraint(constraint) : null;
    const max = target?.kind === "angle" ? 180 : Infinity;
    if (!Number.isFinite(value) || value <= 0 || value >= max) throw new Error(applicationText("寸法値の範囲が正しくありません", "Dimension value is out of range"));
    return value;
  }

  function isGeometryMode() {
    return true;
  }

  function nextAnnotationId() {
    return `AN${annotationSeq++}`;
  }

  function pushAnnotation(element) {
    const item = {
      id: nextAnnotationId(),
      visible: true,
      style: {},
      ...element,
    };
    model.annotations.push(item);
    updateUI();
    draw();
    return item;
  }

  function serializeAnnotation(element) {
    const data = {
      id: element.id,
      type: element.type,
      visible: element.visible !== false,
      text: element.text || "",
      x: Number(element.x) || 0,
      y: Number(element.y) || 0,
      style: element.style && typeof element.style === "object" ? { ...element.style } : {},
    };
    if (element.type === "leader") {
      data.geometryRef = element.geometryRef && typeof element.geometryRef === "object" ? { ...element.geometryRef } : null;
      data.start = element.start;
      data.elbow = element.elbow;
      data.end = element.end;
    }
    return data;
  }

  function geometryKindForItem(item) {
    if (item instanceof Line) return "line";
    if (item instanceof Circle) return "circle";
    if (item instanceof Arc) return "arc";
    if (item instanceof Point) return "point";
    return null;
  }

  function geometryRefForItem(item) {
    const kind = geometryKindForItem(item);
    return kind ? parseGeometryRefId(kind, item?.id) : null;
  }

  function constraintGeometryId(item) {
    return geometryRefId(geometryRefForItem(item));
  }

  function resolveGeometryRef(ref) {
    return resolveGeometryRefValue(ref, (kind, canonicalId) => {
      if (kind === "point") return allGeometryPoints().find((item) => item.id === canonicalId);
      if (kind === "line") return allGeometryLines().find((item) => item.id === canonicalId);
      if (kind === "circle") return allGeometryCircles().find((item) => item.id === canonicalId);
      if (kind === "arc") return allGeometryArcs().find((item) => item.id === canonicalId);
      return null;
    });
  }

  function geometryElementKey(item) {
    return geometryRefKey(geometryRefForItem(item)) || "";
  }

  function geometryElementFromKey(key) {
    return resolveGeometryRef(parseGeometryRefKey(key));
  }

  function blockDefinitionById(id) {
    return model.blockDefinitions.find((definition) => definition.id === id) || null;
  }

  function blockDefinitionDrawableSketchIds(definition) {
    return (definition?.sketches || []).filter((sketch) => sketch && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID).map((sketch) => String(sketch.id));
  }

  function blockDefinitionHasGeometry(definition, visiting = new Set()) {
    if (!definition || visiting.has(definition.id)) return false;
    if ((definition.lines?.length || 0) + (definition.circles?.length || 0) + (definition.arcs?.length || 0) > 0) return true;
    const nextVisiting = new Set(visiting).add(definition.id);
    return (definition.blockInstances || []).some((instance) => blockDefinitionHasGeometry(blockDefinitionById(instance.definitionId), nextVisiting));
  }

  function blockDefinitionGeometrySketchIds(definition, visiting = new Set()) {
    if (!definition || visiting.has(definition.id)) return [];
    const ids = new Set([...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || [])].map((item) => String(item.sketchId || DEFAULT_SKETCH_ID)));
    const nextVisiting = new Set(visiting).add(definition.id);
    for (const instance of definition.blockInstances || []) {
      if (blockDefinitionHasGeometry(blockDefinitionById(instance.definitionId), nextVisiting)) ids.add(String(instance.sketchId || DEFAULT_SKETCH_ID));
    }
    return blockDefinitionDrawableSketchIds(definition).filter((id) => ids.has(id));
  }

  function blockInstanceEnabledSketchSet(instance, definition = blockDefinitionById(instance?.definitionId)) {
    const drawableIds = blockDefinitionDrawableSketchIds(definition);
    const requested = Array.isArray(instance?.enabledSketchIds) ? instance.enabledSketchIds.map(String) : drawableIds;
    const enabled = requested.filter((id) => drawableIds.includes(id));
    return new Set(enabled.length > 0 ? enabled : blockDefinitionGeometrySketchIds(definition));
  }

  function blockLocalGeometryBounds(definition, enabledSketchIds = blockDefinitionDrawableSketchIds(definition), visiting = new Set()) {
    if (!definition) return null;
    if (visiting.has(definition.id)) return null;
    const nextVisiting = new Set(visiting).add(definition.id);
    const enabled = new Set(enabledSketchIds);
    const points = [];
    for (const line of definition.lines || []) {
      if (!enabled.has(String(line.sketchId))) continue;
      points.push(line.p1, line.p2);
    }
    for (const circle of definition.circles || []) {
      if (!enabled.has(String(circle.sketchId))) continue;
      points.push({ x: circle.center.x - circle.radius(), y: circle.center.y - circle.radius() }, { x: circle.center.x + circle.radius(), y: circle.center.y + circle.radius() });
    }
    for (const arc of definition.arcs || []) {
      if (!enabled.has(String(arc.sketchId))) continue;
      const samples = [arc.startAngle, arc.endAngle, 0, Math.PI / 2, Math.PI, Math.PI * 1.5];
      for (const angle of samples) {
        if (angle === arc.startAngle || angle === arc.endAngle || angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) {
          points.push({ x: arc.center.x + Math.cos(angle) * arc.radius(), y: arc.center.y + Math.sin(angle) * arc.radius() });
        }
      }
    }
    for (const instance of definition.blockInstances || []) {
      if (!enabled.has(String(instance.sketchId))) continue;
      const nestedDefinition = blockDefinitionById(instance.definitionId);
      const nestedBounds = blockLocalGeometryBounds(nestedDefinition, [...blockInstanceEnabledSketchSet(instance, nestedDefinition)], nextVisiting);
      if (!nestedBounds) continue;
      for (const localPoint of [
        { x: nestedBounds.minX, y: nestedBounds.minY },
        { x: nestedBounds.minX, y: nestedBounds.maxY },
        { x: nestedBounds.maxX, y: nestedBounds.minY },
        { x: nestedBounds.maxX, y: nestedBounds.maxY },
      ]) points.push(blockWorldPoint(instance, localPoint));
    }
    if (points.length === 0) return null;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } };
  }

  function blockInstanceDisplayCenter(instance) {
    const definition = blockDefinitionById(instance?.definitionId);
    const bounds = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(instance, definition)]);
    const center = bounds?.center || definition?.origin || { x: 0, y: 0 };
    return blockWorldPoint(instance, center);
  }

  function blockInstanceTranslationForAnchor(definition, enabledSketchIds, anchor, rotation) {
    const localCenter = blockLocalGeometryBounds(definition, enabledSketchIds)?.center || definition?.origin || { x: 0, y: 0 };
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: anchor.x - localCenter.x * cos + localCenter.y * sin,
      y: anchor.y - localCenter.x * sin - localCenter.y * cos,
      localCenter,
    };
  }

  function snappedBlockRotation(rotation) {
    const quarterTurns = Math.round((Number(rotation) || 0) / BLOCK_ORTHOGONAL_ROTATION_STEP);
    return ((quarterTurns % 4) + 4) % 4 * BLOCK_ORTHOGONAL_ROTATION_STEP;
  }

  function blockPlacementRotation(pointer = pointerPreview) {
    if (!blockPlacementAnchor || !pointer) return 0;
    const rotation = Math.atan2(pointer.y - blockPlacementAnchor.y, pointer.x - blockPlacementAnchor.x);
    return blockPlacementRotationLocked ? snappedBlockRotation(rotation) : rotation;
  }

  function setBlockInstanceRotationAroundDisplayCenter(instance, rotation) {
    const definition = blockDefinitionById(instance?.definitionId);
    if (!instance || !definition) return false;
    const localCenter = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(instance, definition)])?.center || definition.origin || { x: 0, y: 0 };
    const pivot = blockWorldPoint(instance, localCenter);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    instance.x = pivot.x - localCenter.x * cos + localCenter.y * sin;
    instance.y = pivot.y - localCenter.x * sin - localCenter.y * cos;
    instance.rotation = rotation;
    invalidateBlockProjectionCache(instance.id);
    return true;
  }

  function blockInstanceById(id) {
    return model.blockInstances.find((instance) => instance.id === id) || null;
  }

  function blockProjectionId(kind, instance, localElement) {
    const localRef = createGeometryRef(kind, Array.isArray(localElement) ? localElement : typeof localElement === "string" ? localElement : localElement?.id);
    if (!localRef) return "";
    return geometryRefId(createGeometryRef(kind, [String(instance.id), ...localRef.path])) || "";
  }

  function blockProjectionLocalId(item) {
    return item?.blockLocalId || item?.localElement?.id || null;
  }

  function blockWorldPoint(instance, localPoint) {
    const cos = Math.cos(instance.rotation);
    const sin = Math.sin(instance.rotation);
    return {
      x: instance.x + localPoint.x * cos - localPoint.y * sin,
      y: instance.y + localPoint.x * sin + localPoint.y * cos,
    };
  }

  function createProjectedPoint(transform, ownerInstance, definition, localPoint, localPath) {
    const point = new Point(blockProjectionId("point", ownerInstance, localPath), 0, 0, false, localPoint.kind || "endpoint");
    Object.defineProperties(point, {
      x: { configurable: true, enumerable: true, get: () => blockWorldPoint(transform, localPoint).x },
      y: { configurable: true, enumerable: true, get: () => blockWorldPoint(transform, localPoint).y },
    });
    point.sketchId = ownerInstance.sketchId;
    point.blockProjection = true;
    point.blockInstance = ownerInstance;
    point.blockDefinition = definition;
    point.localElement = localPoint;
    point.blockLocalId = geometryRefId(createGeometryRef("point", localPath));
    return point;
  }

  function createBlockProjectionBundle(instance, definition, enabledSketchIdsOverride = null, options = {}) {
    if (!definition) return { points: [], lines: [], circles: [], arcs: [], pointByLocalId: new Map() };
    const visiting = options.visiting || new Set();
    if (visiting.has(definition.id)) return { points: [], lines: [], circles: [], arcs: [], pointByLocalId: new Map() };
    const nextVisiting = new Set(visiting).add(definition.id);
    const ownerInstance = options.ownerInstance || instance;
    const pathPrefix = Array.isArray(options.pathPrefix) ? options.pathPrefix.map(String) : [];
    const definitionResolver = options.definitionResolver || blockDefinitionById;
    const includeAllSketches = Boolean(options.includeAllSketches);
    const appearanceOverrides = [instance.appearanceOverride, ...(options.appearanceOverrides || [])].filter(Boolean);
    const enabledSketchIds = includeAllSketches
      ? new Set(blockDefinitionDrawableSketchIds(definition))
      : enabledSketchIdsOverride
      ? new Set(enabledSketchIdsOverride.map(String))
      : blockInstanceEnabledSketchSet(instance, definition);
    const localPath = (id) => [...pathPrefix, String(id)];
    const localId = (kind, id) => geometryRefId(createGeometryRef(kind, localPath(id)));
    const pointByLocalId = new Map();
    const allPoints = definition.points.map((localPoint) => {
      const path = localPath(localPoint.id);
      const point = createProjectedPoint(instance, ownerInstance, definition, localPoint, path);
      point.blockAppearanceOverrides = appearanceOverrides;
      pointByLocalId.set(localId("point", localPoint.id), point);
      return point;
    });
    const mark = (item, localElement, kind) => {
      const path = localPath(localElement.id);
      item.id = blockProjectionId(kind, ownerInstance, path);
      item.sketchId = ownerInstance.sketchId;
      item.blockProjection = true;
      item.blockInstance = ownerInstance;
      item.blockDefinition = definition;
      item.localElement = localElement;
      item.blockLocalId = geometryRefId(createGeometryRef(kind, path));
      item.blockAppearanceOverrides = appearanceOverrides;
      return item;
    };
    const lines = definition.lines.filter((localLine) => enabledSketchIds.has(String(localLine.sketchId))).map((localLine) => mark(new Line(localLine.id, pointByLocalId.get(localId("point", localLine.p1.id)), pointByLocalId.get(localId("point", localLine.p2.id)), localLine.construction), localLine, "line"));
    const circles = definition.circles.filter((localCircle) => enabledSketchIds.has(String(localCircle.sketchId))).map((localCircle) => {
      const circle = mark(new Circle(localCircle.id, pointByLocalId.get(localId("point", localCircle.center.id)), localCircle.radius(), localCircle.construction), localCircle, "circle");
      Object.defineProperty(circle, "radiusValue", { configurable: true, enumerable: true, get: () => localCircle.radius() });
      return circle;
    });
    const arcs = definition.arcs.filter((localArc) => enabledSketchIds.has(String(localArc.sketchId))).map((localArc) => {
      const arc = mark(new Arc(localArc.id, pointByLocalId.get(localId("point", localArc.center.id)), localArc.radius(), localArc.startAngle, localArc.endAngle, localArc.construction), localArc, "arc");
      Object.defineProperties(arc, {
        radiusValue: { configurable: true, enumerable: true, get: () => localArc.radius() },
        startAngle: { configurable: true, enumerable: true, get: () => localArc.startAngle + instance.rotation },
        endAngle: { configurable: true, enumerable: true, get: () => localArc.endAngle + instance.rotation },
      });
      return arc;
    });
    const visiblePointIds = new Set();
    for (const line of lines) visiblePointIds.add(line.p1.id).add(line.p2.id);
    for (const primitive of [...circles, ...arcs]) visiblePointIds.add(primitive.center.id);
    for (const localPoint of definition.points) if (enabledSketchIds.has(String(localPoint.sketchId)) && localPoint.kind === "explicit") visiblePointIds.add(blockProjectionId("point", ownerInstance, localPath(localPoint.id)));
    const points = allPoints.filter((point) => visiblePointIds.has(point.id));
    for (const nestedInstance of definition.blockInstances || []) {
      if (!enabledSketchIds.has(String(nestedInstance.sketchId))) continue;
      const nestedDefinition = definitionResolver(nestedInstance.definitionId);
      if (!nestedDefinition) continue;
      const nestedTransform = { ...nestedInstance, sketchId: ownerInstance.sketchId };
      Object.defineProperties(nestedTransform, {
        x: { configurable: true, enumerable: true, get: () => blockWorldPoint(instance, nestedInstance).x },
        y: { configurable: true, enumerable: true, get: () => blockWorldPoint(instance, nestedInstance).y },
        rotation: { configurable: true, enumerable: true, get: () => instance.rotation + nestedInstance.rotation },
      });
      const nestedPath = localPath(nestedInstance.id);
      const nestedBundle = createBlockProjectionBundle(nestedTransform, nestedDefinition, null, {
        ownerInstance,
        pathPrefix: nestedPath,
        definitionResolver,
        includeAllSketches,
        visiting: nextVisiting,
        appearanceOverrides,
      });
      points.push(...nestedBundle.points);
      lines.push(...nestedBundle.lines);
      circles.push(...nestedBundle.circles);
      arcs.push(...nestedBundle.arcs);
      for (const [id, point] of nestedBundle.pointByLocalId) pointByLocalId.set(id, point);
    }
    return { definition, revision: definition.revision, sketchId: instance.sketchId, enabledSketchKey: [...enabledSketchIds].sort().join("|"), instance, points, lines, circles, arcs, pointByLocalId };
  }

  function blockAllProjectionBundle(instance) {
    const definition = blockDefinitionById(instance?.definitionId);
    if (!definition) return { points: [], lines: [], circles: [], arcs: [], pointByLocalId: new Map() };
    return createBlockProjectionBundle(instance, definition, blockDefinitionDrawableSketchIds(definition), { includeAllSketches: true });
  }

  function blockProjectionBundle(instance) {
    const definition = blockDefinitionById(instance.definitionId);
    if (!definition) return { points: [], lines: [], circles: [], arcs: [], pointByLocalId: new Map() };
    const cached = blockProjectionCache.get(instance.id);
    const enabledSketchKey = [...blockInstanceEnabledSketchSet(instance, definition)].sort().join("|");
    if (cached && cached.definition === definition && cached.revision === definition.revision && cached.sketchId === instance.sketchId && cached.enabledSketchKey === enabledSketchKey) return cached;
    const bundle = createBlockProjectionBundle(instance, definition);
    blockProjectionCache.set(instance.id, bundle);
    return bundle;
  }

  function invalidateBlockProjectionCache(instanceId = null) {
    if (instanceId) blockProjectionCache.delete(instanceId);
    else blockProjectionCache.clear();
  }

  function blockProjectionBundles() {
    ensureBlockState();
    return model.blockInstances.map(blockProjectionBundle);
  }

  function allGeometryPoints() {
    return [...model.points, ...blockProjectionBundles().flatMap((bundle) => bundle.points)];
  }

  function allGeometryLines() {
    return [...model.lines, ...blockProjectionBundles().flatMap((bundle) => bundle.lines)];
  }

  function allGeometryCircles() {
    return [...model.circles, ...blockProjectionBundles().flatMap((bundle) => bundle.circles)];
  }

  function allGeometryArcs() {
    return [...model.arcs, ...blockProjectionBundles().flatMap((bundle) => bundle.arcs)];
  }

  function allGeometryPrimitives() {
    return [...allGeometryCircles(), ...allGeometryArcs()];
  }

  function decorateSerializedConstraint(data, constraint) {
    if (!data || !constraint) return data;
    if (constraint.readOnlyDimension) data.readOnlyDimension = true;
    if (isDimensionConstraint(constraint)) {
      data.parameterName = constraint.parameterName || null;
      if (!constraint.readOnlyDimension) data.expression = constraint.expression || numericDimensionExpression(constraint);
    }
    return data;
  }

  function effectiveAppearanceForElement(item) {
    let result = { ...normalizeAppearance(model.defaultAppearance, { partial: false }) };
    const construction = (item instanceof Line || item instanceof Circle || item instanceof Arc) && item.construction;
    if (construction) result = { ...result, ...normalizeConstructionAppearance(model.defaultConstructionAppearance, { partial: false }) };
    const outerSketch = sketchById(elementSketchId(item));
    if (outerSketch) result = cascadeSketchAppearance(outerSketch, model.sketches, result);
    if (item?.blockProjection) {
      const definitionSketch = item.blockDefinition?.sketches?.find((sketch) => sketch.id === item.localElement?.sketchId);
      if (definitionSketch) result = cascadeSketchAppearance(definitionSketch, item.blockDefinition.sketches, result);
      result = { ...result, ...normalizeAppearance(item.localElement?.appearance) };
      for (const override of item.blockAppearanceOverrides || [item.blockInstance?.appearanceOverride]) result = { ...result, ...normalizeAppearance(override) };
    } else {
      result = { ...result, ...normalizeAppearance(item?.appearance) };
    }
    return result;
  }

  function appearanceLineDash(lineType) {
    if (lineType === "dashed") return [10 / viewport.scale, 6 / viewport.scale];
    if (lineType === "dashdot") return [12 / viewport.scale, 4 / viewport.scale, 2 / viewport.scale, 4 / viewport.scale];
    if (lineType === "dotted") return [2 / viewport.scale, 5 / viewport.scale];
    return [];
  }

  function selectedGeometryItems() {
    return [...selectedPoints, ...selectedLines, ...selectedCircles, ...selectedArcs];
  }

  function appearanceSelectionTarget() {
    if (selectedBlockInstances.length === 1 && selectedGeometryItems().length === 0) {
      return { kind: "blockInstance", item: selectedBlockInstances[0], key: "appearanceOverride" };
    }
    const items = selectedGeometryItems().filter((item) => !item.blockProjection);
    if (items.length !== 1 || selectedBlockInstances.length > 0) return null;
    return { kind: "geometry", item: items[0], key: "appearance" };
  }

  function setAppearanceForSelection(patch) {
    const target = appearanceSelectionTarget();
    if (!target) return false;
    target.item[target.key] = normalizeAppearance({ ...target.item[target.key], ...patch });
    if (target.kind === "blockInstance") invalidateBlockProjectionCache(target.item.id);
    updatePropertiesUI();
    draw();
    recordHistory("Appearance変更");
    return true;
  }

  function setGeometrySelection(hit, additive = false) {
    if (!additive) {
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      selectedArcEndpointPair = null;
      selectedDimensionConstraint = null;
    }
    if (!hit?.item) return;
    if (hit.kind === "point") {
      if (additive && selectedPoints.includes(hit.item)) selectedPoints = selectedPoints.filter((item) => item !== hit.item);
      else if (!selectedPoints.includes(hit.item)) selectedPoints.push(hit.item);
    } else if (hit.kind === "line") {
      if (additive && selectedLines.includes(hit.item)) selectedLines = selectedLines.filter((item) => item !== hit.item);
      else if (!selectedLines.includes(hit.item)) selectedLines.push(hit.item);
    } else if (hit.kind === "circle") {
      if (additive && selectedCircles.includes(hit.item)) selectedCircles = selectedCircles.filter((item) => item !== hit.item);
      else if (!selectedCircles.includes(hit.item)) selectedCircles.push(hit.item);
    } else if (hit.kind === "arc") {
      if (additive && selectedArcs.includes(hit.item)) selectedArcs = selectedArcs.filter((item) => item !== hit.item);
      else if (!selectedArcs.includes(hit.item)) selectedArcs.push(hit.item);
    }
  }

  function createLeaderAnnotation() {
    const target = annotationLeaderTargetFromSelection(lastPointerWorld);
    if (target) {
      startLeaderAnnotationPlacement(target, lastPointerWorld);
      return;
    }
    clearSelection();
    pendingCommand = { type: "annotation-leader-select" };
    setHint("引出線を付ける図形をクリックしてください");
    updateToolbar();
    draw();
  }

  function handleLeaderAnnotationTargetClick(hit, pointer) {
    if (pendingCommand?.type !== "annotation-leader-select") return false;
    const target = annotationLeaderTargetFromHit(hit, pointer);
    if (!target) {
      setHint("引出線を付ける図形をクリックしてください", "error");
      return true;
    }
    setGeometrySelection(hit, false);
    startLeaderAnnotationPlacement(target, pointer);
    return true;
  }

  function annotationLeaderTargetFromSelection(pointer = null) {
    const items = selectedGeometryItems();
    if (items.length !== 1) return null;
    return annotationLeaderTargetFromItem(items[0], pointer);
  }

  function annotationLeaderTargetFromHit(hit, pointer = null) {
    if (!hit?.item) return null;
    return annotationLeaderTargetFromItem(hit.item, pointer);
  }

  function annotationLeaderTargetFromItem(item, pointer = null) {
    if (item instanceof Point) return { item, anchor: { x: item.x, y: item.y }, geometryRef: geometryRefForItem(item) };
    if (item instanceof Line) {
      const anchor = pointer ? projectPointToSegmentPoint(pointer, item) : { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 };
      return { item, anchor, geometryRef: geometryRefForItem(item) };
    }
    if (item instanceof Circle) {
      const base = pointer || { x: item.center.x + item.radius(), y: item.center.y };
      const angle = Math.atan2(base.y - item.center.y, base.x - item.center.x);
      return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, geometryRef: geometryRefForItem(item) };
    }
    if (item instanceof Arc) {
      const base = pointer || arcEndpointPoint(item, "start");
      const angle = clampAngleToArcSweep(item, Math.atan2(base.y - item.center.y, base.x - item.center.x));
      return { item, anchor: { x: item.center.x + Math.cos(angle) * item.radius(), y: item.center.y + Math.sin(angle) * item.radius() }, geometryRef: geometryRefForItem(item) };
    }
    return null;
  }

  function annotationLeaderAnchor(element) {
    const item = resolveGeometryRef(element?.geometryRef);
    if (!item) return element?.start || null;
    return annotationLeaderTargetFromItem(item, element.start || null)?.anchor || element.start || null;
  }

  function clampAngleToArcSweep(arc, angle) {
    if (angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return angle;
    const start = arcEndpointPoint(arc, "start");
    const end = arcEndpointPoint(arc, "end");
    const point = {
      x: arc.center.x + Math.cos(angle) * arc.radius(),
      y: arc.center.y + Math.sin(angle) * arc.radius(),
    };
    return hypot2(point.x - start.x, point.y - start.y) <= hypot2(point.x - end.x, point.y - end.y) ? arc.startAngle : arc.endAngle;
  }

  function startLeaderAnnotationPlacement(target, pointer = null) {
    pendingCommand = {
      type: "annotation-leader-place",
      leaderTarget: target,
      pointer: pointer || {
        x: target.anchor.x + 90 / viewport.scale,
        y: target.anchor.y - 36 / viewport.scale,
      },
    };
    setHint("引出線の文字位置をクリックしてください");
    updateToolbar();
    draw();
  }

  function annotationLeaderLayout(anchor, pointer) {
    const side = pointer.x >= anchor.x ? 1 : -1;
    const minShelf = 64 / viewport.scale;
    const end = { x: pointer.x, y: pointer.y };
    if (Math.abs(end.x - anchor.x) < minShelf) end.x = anchor.x + side * minShelf;
    const elbowX = side > 0 ? Math.min(anchor.x + 42 / viewport.scale, end.x - minShelf) : Math.max(anchor.x - 42 / viewport.scale, end.x + minShelf);
    const elbow = { x: elbowX, y: end.y };
    const text = {
      x: (elbow.x + end.x) / 2,
      y: end.y - 10 / viewport.scale,
    };
    return { start: anchor, elbow, end, text };
  }

  function commitLeaderAnnotationAt(pointer) {
    if (pendingCommand?.type !== "annotation-leader-place" || !pendingCommand.leaderTarget) return;
    const target = pendingCommand.leaderTarget;
    const layout = annotationLeaderLayout(target.anchor, pointer);
    const text = window.prompt("引出線テキスト", "注記");
    if (!text) {
      setHint("引出線をキャンセルしました");
      pendingCommand = null;
      updateToolbar();
      draw();
      return;
    }
    pushAnnotation({
      type: "leader",
      text,
      start: layout.start,
      elbow: layout.elbow,
      end: layout.end,
      x: layout.text.x,
      y: layout.text.y,
      geometryRef: target.geometryRef,
      style: { color: "#111827", fontSize: 13, lineWidth: 1.4 },
    });
    pendingCommand = null;
    setHint("引出線を追加しました");
    updateToolbar();
    recordHistory("引出線追加");
  }

  function drawLeaderAnnotationCommandPreview() {
    if (pendingCommand?.type !== "annotation-leader-place" || !pendingCommand.leaderTarget) return;
    const layout = annotationLeaderLayout(pendingCommand.leaderTarget.anchor, pendingCommand.pointer);
    drawAnnotationLeader({
      start: layout.start,
      elbow: layout.elbow,
      end: layout.end,
      x: layout.text.x,
      y: layout.text.y,
      text: "注記",
      style: { color: "#2563eb", fontSize: 13, lineWidth: 1.4 },
    }, true);
  }

  function createTextAnnotation() {
    cancelPendingCommand("");
    pendingCommand = { type: "annotation-text-place", pointer: lastPointerWorld || { x: 0, y: 0 } };
    setHint("テキストを配置する位置をクリックしてください");
    updateToolbar();
    draw();
  }

  function commitTextAnnotationAt(pointer) {
    if (pendingCommand?.type !== "annotation-text-place") return false;
    const text = window.prompt("テキスト", "注記");
    if (text) {
      pushAnnotation({ type: "text", text, x: pointer.x, y: pointer.y, style: { color: "#111827", fontSize: 13 } });
      recordHistory("テキスト追加");
      setHint("テキストを追加しました");
    } else {
      setHint("テキストをキャンセルしました");
    }
    pendingCommand = null;
    updateToolbar();
    draw();
    return true;
  }

  function isRootSketch(sketchOrId) {
    const sketch = typeof sketchOrId === "string" ? sketchById(sketchOrId) : sketchOrId;
    return sketch?.kind === "root" || sketch?.id === ROOT_SKETCH_ID;
  }

  function isDrawableSketch(sketchOrId) {
    const sketch = typeof sketchOrId === "string" ? sketchById(sketchOrId) : sketchOrId;
    return Boolean(sketch && !isRootSketch(sketch));
  }

  function canCreateInActiveSketch() {
    return isGeometryMode() && isDrawableSketch(activeSketchId());
  }

  function rejectRootSketchCreation() {
    if (canCreateInActiveSketch()) return false;
    setHint("Root Sketchには図形を作成できません。子スケッチを選択してください。", "error");
    clearSnap();
    pointerPreview = null;
    draw();
    return true;
  }

  function firstDrawableSketchId() {
    ensureSketchState();
    return model.sketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
  }

  function activeSketch() {
    ensureSketchState();
    return model.sketches.find((sketch) => sketch.id === model.activeSketchId) || model.sketches.find((sketch) => isRootSketch(sketch)) || model.sketches[0];
  }

  function sketchName(sketchId) {
    ensureSketchState();
    return model.sketches.find((sketch) => sketch.id === sketchId)?.name || sketchId || DEFAULT_SKETCH_NAME;
  }

  function sketchById(sketchId) {
    ensureSketchState();
    return model.sketches.find((sketch) => sketch.id === sketchId) || null;
  }

  function parentSketchOf(sketch) {
    return sketch?.parentSketchId ? sketchById(sketch.parentSketchId) : null;
  }

  function childSketchesOf(sketchId) {
    ensureSketchState();
    return model.sketches.filter((sketch) => sketch.parentSketchId === sketchId);
  }

  function descendantSketchIds(sketchId) {
    const result = [];
    const visit = (id) => {
      for (const child of childSketchesOf(id)) {
        result.push(child.id);
        visit(child.id);
      }
    };
    visit(sketchId);
    return result;
  }

  function ancestorSketchIds(sketchId) {
    const result = [];
    const visited = new Set([sketchId]);
    let current = sketchById(sketchId);
    while (current?.parentSketchId && !visited.has(current.parentSketchId)) {
      const parent = sketchById(current.parentSketchId);
      if (!parent) break;
      visited.add(parent.id);
      if (isDrawableSketch(parent)) result.push(parent.id);
      current = parent;
    }
    return result;
  }

  function isReferenceSourceSketchId(referenceSketchId, subjectSketchId = activeSketchId()) {
    if (!referenceSketchId || !subjectSketchId) return false;
    if (!isDrawableSketch(referenceSketchId)) return false;
    if (referenceSketchId === subjectSketchId) return false;
    return ancestorSketchIds(subjectSketchId).includes(referenceSketchId);
  }

  function referenceSourceSketchIds(subjectSketchId = activeSketchId()) {
    ensureSketchState();
    return model.sketches
      .filter((sketch) => isReferenceSourceSketchId(sketch.id, subjectSketchId))
      .map((sketch) => sketch.id);
  }

  function constraintIsOperational(constraint) {
    return constraint?.enabled !== false && !invalidReferenceConstraints.has(constraint);
  }

  function referenceSketchTargets(sketchId) {
    return [...new Set(model.constraints
      .filter((constraint) => constraintIsOperational(constraint) && constraint.reference && constraintSketchId(constraint) === sketchId && constraint.referenceSketchId)
      .map((constraint) => constraint.referenceSketchId))];
  }

  function referencePathExists(fromSketchId, toSketchId) {
    const pending = [fromSketchId];
    const visited = new Set();
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === toSketchId) return true;
      if (!current || visited.has(current)) continue;
      visited.add(current);
      pending.push(...referenceSketchTargets(current));
    }
    return false;
  }

  function wouldCreateReferenceCycle(subjectSketchId, referenceSketchId) {
    return subjectSketchId === referenceSketchId || referencePathExists(referenceSketchId, subjectSketchId);
  }

  function refreshReferenceConstraintValidity() {
    const invalid = new Map();
    const acceptedTargets = new Map();
    const targetsOf = (sketchId) => acceptedTargets.get(sketchId) || [];
    const pathExists = (fromSketchId, toSketchId) => {
      const pending = [fromSketchId];
      const visited = new Set();
      while (pending.length > 0) {
        const current = pending.pop();
        if (current === toSketchId) return true;
        if (!current || visited.has(current)) continue;
        visited.add(current);
        pending.push(...targetsOf(current));
      }
      return false;
    };
    for (const constraint of model.constraints) {
      if (constraint.enabled === false || !constraint.reference || !constraint.referenceSketchId) continue;
      const ownerSketchId = constraintSketchId(constraint);
      const referenceSketchId = constraint.referenceSketchId;
      if (!isReferenceSourceSketchId(referenceSketchId, ownerSketchId)) {
        invalid.set(constraint, "参照範囲外");
        continue;
      }
      if (ownerSketchId === referenceSketchId || pathExists(referenceSketchId, ownerSketchId)) {
        invalid.set(constraint, "循環参照");
        continue;
      }
      if (!acceptedTargets.has(ownerSketchId)) acceptedTargets.set(ownerSketchId, []);
      acceptedTargets.get(ownerSketchId).push(referenceSketchId);
    }
    invalidReferenceConstraints = invalid;
    return invalid;
  }

  function sketchDepth(sketch) {
    let depth = 0;
    const visited = new Set();
    let current = sketch;
    while (current?.parentSketchId && !visited.has(current.id)) {
      visited.add(current.id);
      current = sketchById(current.parentSketchId);
      if (current) depth++;
    }
    return depth;
  }

  function wouldCreateSketchCycle(sketchId, parentSketchId) {
    let current = sketchById(parentSketchId);
    const visited = new Set([sketchId]);
    while (current) {
      if (visited.has(current.id)) return true;
      visited.add(current.id);
      current = parentSketchOf(current);
    }
    return false;
  }

  function orderedSketches() {
    ensureSketchState();
    const byParent = new Map();
    for (const sketch of model.sketches) {
      const key = sketch.parentSketchId || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(sketch);
    }
    const ordered = [];
    const visit = (parentId) => {
      for (const sketch of byParent.get(parentId || "") || []) {
        ordered.push(sketch);
        visit(sketch.id);
      }
    };
    visit("");
    for (const sketch of model.sketches) {
      if (!ordered.includes(sketch)) ordered.push(sketch);
    }
    return ordered;
  }

  function sketchTreeRows() {
    ensureSketchState();
    const byParent = new Map();
    for (const sketch of model.sketches) {
      const key = sketch.parentSketchId || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(sketch);
    }
    const rows = [];
    const visit = (parentId, depth, ancestorHasNext) => {
      const children = byParent.get(parentId || "") || [];
      children.forEach((sketch, index) => {
        const isLast = index === children.length - 1;
        const segments = depth === 0 && isRootSketch(sketch) ? [] : [...ancestorHasNext.map((hasNext) => (hasNext ? "pipe" : "blank")), isLast ? "elbow" : "tee"];
        rows.push({ sketch, depth, isLast, hasChildren: childSketchesOf(sketch.id).length > 0, segments });
        visit(sketch.id, depth + 1, [...ancestorHasNext, !isLast]);
      });
    };
    visit("", 0, []);
    for (const sketch of model.sketches) {
      if (!rows.some((row) => row.sketch === sketch)) rows.push({ sketch, depth: 0, isLast: true, hasChildren: false, segments: ["elbow"] });
    }
    return rows;
  }

  function activeSketchId() {
    return activeSketch().id;
  }

  function assignSketchId(item, sketchId = activeSketchId()) {
    const targetSketchId = isDrawableSketch(sketchId) ? sketchId : firstDrawableSketchId();
    if (item) item.sketchId = targetSketchId || activeSketchId();
    return item;
  }

  function elementSketchId(item) {
    ensureSketchState();
    if (!item) return activeSketchId();
    if (item.sketchId) return item.sketchId;
    if (item instanceof Line) return item.p1?.sketchId || item.p2?.sketchId || activeSketchId();
    if (item instanceof Circle || item instanceof Arc) return item.center?.sketchId || activeSketchId();
    return activeSketchId();
  }

  function isActiveSketchElement(item) {
    return elementSketchId(item) === activeSketchId();
  }

  function isEditableSketchId(sketchId) {
    const id = sketchId || activeSketchId();
    return id === activeSketchId();
  }

  function isEditableSketchElement(item) {
    return isEditableSketchId(elementSketchId(item));
  }

  function isVisibleSketchId(sketchId) {
    const id = sketchId || activeSketchId();
    if (viewState.constraintStatus) return true;
    const sketch = sketchById(id);
    if (!sketch) return false;
    const appearance = effectiveAppearanceForSketch(sketch);
    return appearance.visible !== false;
  }

  function isVisibleSketchElement(item) {
    return viewState.constraintStatus || (isVisibleSketchId(elementSketchId(item)) && effectiveAppearanceForElement(item).visible !== false);
  }

  function sketchRelationToActive(sketchId) {
    const id = sketchId || activeSketchId();
    if (id === activeSketchId()) return "active";
    if (descendantSketchIds(activeSketchId()).includes(id)) return "descendant";
    if (isReferenceSourceSketchId(id)) return "reference";
    return "inactive";
  }

  function sketchRelationOfElement(item) {
    return sketchRelationToActive(elementSketchId(item));
  }

  function constraintSketchId(constraint) {
    ensureSketchState();
    if (!constraint) return activeSketchId();
    if (constraint.sketchId) return constraint.sketchId;
    const ids = [...new Set(constraintGraphNodes(constraint).map(elementSketchId).filter(Boolean))];
    return ids.length === 1 ? ids[0] : activeSketchId();
  }

  function isActiveSketchConstraint(constraint) {
    return constraintSketchId(constraint) === activeSketchId();
  }

  function assignConstraintSketchId(constraint, sketchId = activeSketchId()) {
    const targetSketchId = isDrawableSketch(sketchId) ? sketchId : firstDrawableSketchId();
    if (constraint) constraint.sketchId = targetSketchId || activeSketchId();
    return constraint;
  }

  function pushModelConstraint(constraint, sketchId = activeSketchId()) {
    assignConstraintSketchId(constraint, sketchId);
    model.constraints.push(constraint);
    ensureDimensionParameter(constraint, currentParameterNamespace());
    return constraint;
  }

  function sameSketchElements(items, sketchId = activeSketchId()) {
    return items.filter(Boolean).every((item) => elementSketchId(item) === sketchId);
  }

  function constraintTargetsAreActive(constraint) {
    return sameSketchElements(constraintGraphNodes(constraint), activeSketchId());
  }

  function constraintReferencesSketch(constraint, sketchId) {
    return constraintGraphNodes(constraint).some((node) => elementSketchId(node) === sketchId);
  }

  function operandElement(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return operand.point;
    if (operand.kind === "line") return operand.line;
    if (operand.kind === "primitive") return operand.primitive;
    if (operand.kind === "arc-endpoint") return operand.arc;
    return operand.element || null;
  }

  function operandRelationForSketch(sketchId) {
    if (isEditableSketchId(sketchId)) return "active";
    if (descendantSketchIds(activeSketchId()).includes(sketchId)) return "descendant";
    if (isReferenceSourceSketchId(sketchId)) return "reference";
    return null;
  }

  function makeConstraintOperand(kind, data) {
    const element = data.element || data.point || data.line || data.primitive || data.arc || null;
    const sketchId = data.sketchId || elementSketchId(element);
    const relation = operandRelationForSketch(sketchId);
    if (!element || !sketchId || !relation) return null;
    return { kind, ...data, element, sketchId, relation };
  }

  function operandFromReferenceTarget(target) {
    if (!target) return null;
    if (target.kind === "point") return makeConstraintOperand("point", { point: target.point, sketchId: target.sketchId });
    if (target.kind === "line") return makeConstraintOperand("line", { line: target.line, sketchId: target.sketchId });
    if (target.kind === "primitive") return makeConstraintOperand("primitive", { primitive: target.primitive, sketchId: target.sketchId });
    return null;
  }

  function referenceTargetFromOperand(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return { kind: "point", point: operand.point, sketchId: operand.sketchId };
    if (operand.kind === "line") return { kind: "line", line: operand.line, sketchId: operand.sketchId };
    if (operand.kind === "primitive") return { kind: "primitive", primitive: operand.primitive, sketchId: operand.sketchId };
    return null;
  }

  function subjectFromOperand(operand) {
    if (!operand) return null;
    if (operand.kind === "point") return { kind: "point", point: operand.point };
    if (operand.kind === "line") return { kind: "line", line: operand.line };
    if (operand.kind === "primitive") return { kind: "primitive", primitive: operand.primitive };
    if (operand.kind === "arc-endpoint") return { kind: "arc-endpoint", arc: operand.arc, endpoint: operand.endpoint };
    return null;
  }

  function sameConstraintOperand(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === "arc-endpoint") return sameArcEndpoint(a, b);
    return operandElement(a) === operandElement(b);
  }

  function isConstraintOperandSelected(item, options = {}) {
    if (!item) return false;
    if (options.arcEndpoint) {
      return constraintOperands.some((operand) => operand.kind === "arc-endpoint" && sameArcEndpoint(operand, options.arcEndpoint));
    }
    return constraintOperands.some((operand) => operandElement(operand) === item);
  }

  function syncSelectionFromConstraintOperands() {
    selectedPoints = [];
    selectedLines = [];
    selectedCircles = [];
    selectedArcs = [];
    selectedBlockInstances = [];
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    for (const operand of constraintOperands) {
      if (operand.kind === "point" && !selectedPoints.includes(operand.point)) selectedPoints.push(operand.point);
      else if (operand.kind === "line" && !selectedLines.includes(operand.line)) selectedLines.push(operand.line);
      else if (operand.kind === "primitive") {
        if (operand.primitive instanceof Circle && !selectedCircles.includes(operand.primitive)) selectedCircles.push(operand.primitive);
        if (operand.primitive instanceof Arc && !selectedArcs.includes(operand.primitive)) selectedArcs.push(operand.primitive);
      } else if (operand.kind === "arc-endpoint") {
        if (selectedArcEndpoint && !sameArcEndpoint(selectedArcEndpoint, operand)) selectedArcEndpointPair = [selectedArcEndpoint, operand];
        selectedArcEndpoint = { arc: operand.arc, endpoint: operand.endpoint };
        if (!selectedArcs.includes(operand.arc)) selectedArcs.push(operand.arc);
      }
    }
  }

  function constraintOperandsFromSelection() {
    const operands = [];
    for (const p of selectedPoints) operands.push(makeConstraintOperand("point", { point: p }));
    for (const l of selectedLines) operands.push(makeConstraintOperand("line", { line: l }));
    for (const c of selectedCircles) operands.push(makeConstraintOperand("primitive", { primitive: c }));
    for (const a of selectedArcs) {
      if (selectedArcEndpoint?.arc === a) continue;
      operands.push(makeConstraintOperand("primitive", { primitive: a }));
    }
    if (selectedArcEndpoint) operands.push(makeConstraintOperand("arc-endpoint", { arc: selectedArcEndpoint.arc, endpoint: selectedArcEndpoint.endpoint }));
    return operands.filter(Boolean);
  }

  function referenceSubjectElement(subject) {
    if (!subject) return null;
    if (subject.kind === "point") return subject.point;
    if (subject.kind === "line") return subject.line;
    if (subject.kind === "primitive") return subject.primitive;
    if (subject.kind === "arc-endpoint") return subject.arc;
    return null;
  }

  function referenceSubjectSketchId(subject) {
    return elementSketchId(referenceSubjectElement(subject));
  }

  function resultIsAccepted(result) {
    return Boolean(result) && Number.isFinite(result.errorNorm) && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR;
  }

  function constraintsForRedundancy(sketchId) {
    return model.constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId);
  }

  function redundantConstraintInfo(constraint, sketchId = constraintSketchId(constraint)) {
    if (!constraint || constraint.enabled === false) return { redundant: false };
    const constraints = constraintsForRedundancy(sketchId);
    if (!constraints.includes(constraint)) return { redundant: false };
    const redundancy = solver.constraintRedundancyState({
      variables: sketchSolveVariables(sketchId),
      constraints,
      errorTolerance: CONSTRAINT_ACCEPT_ERROR,
      rankTolerance: 1e-8,
    });
    const contribution = redundancy.byConstraint.get(constraint);
    if (!redundancy.stable || !contribution) return { redundant: false, unstable: true, redundancy };
    return {
      redundant: contribution.redundant,
      rankBefore: contribution.rankBefore,
      rankAfter: contribution.rankAfter,
      redundancy,
    };
  }

  function refreshConstraintRedundancy(precomputedBySketch = null) {
    const byConstraint = new Map();
    const bySketch = new Map();
    let count = 0;
    for (const sketch of model.sketches.filter((item) => !isRootSketch(item))) {
      const sketchId = sketch.id;
      const constraints = constraintsForRedundancy(sketchId);
      const redundancy = precomputedBySketch?.get(sketchId) || solver.constraintRedundancyState({
          variables: sketchSolveVariables(sketchId),
          constraints,
          errorTolerance: CONSTRAINT_ACCEPT_ERROR,
          rankTolerance: 1e-8,
        });
      let sketchCount = 0;
      for (const constraint of constraints) {
        const contribution = redundancy.byConstraint.get(constraint);
        if (!redundancy.stable || !contribution?.redundant) continue;
        const info = { redundant: true, sketchId, rankBefore: contribution.rankBefore, rankAfter: contribution.rankAfter };
        byConstraint.set(constraint, info);
        sketchCount += 1;
        count += 1;
      }
      if (sketchCount > 0) bySketch.set(sketchId, sketchCount);
    }
    constraintRedundancyState = { constraints: byConstraint, sketches: bySketch, count };
    return constraintRedundancyState;
  }

  function constraintRedundancyInfo(constraint) {
    return constraintRedundancyState?.constraints?.get(constraint) || null;
  }

  function constraintIsRedundant(constraint) {
    return Boolean(constraintRedundancyInfo(constraint)?.redundant);
  }

  function constraintDuplicateCountForSketch(sketchId) {
    return constraintRedundancyState?.sketches?.get(sketchId) || 0;
  }

  function constraintDuplicateSummary() {
    const count = constraintRedundancyState?.count || 0;
    return count > 0 ? applicationLanguage === "en" ? ` / Duplicate constraints: ${count}` : ` / 重複拘束: ${count}` : "";
  }

  function referenceConstraintErrorInfo(constraint) {
    return invalidReferenceConstraints.get(constraint) || null;
  }

  function referenceConstraintErrorCountForSketch(sketchId) {
    let count = 0;
    for (const constraint of invalidReferenceConstraints.keys()) {
      if (constraintSketchId(constraint) === sketchId) count += 1;
    }
    return count;
  }

  function referenceConstraintErrorSummary() {
    const count = invalidReferenceConstraints.size;
    return count > 0 ? applicationLanguage === "en" ? ` / Reference errors: ${count}` : ` / 参照エラー: ${count}` : "";
  }

  function clearSketchSolveState(sketchId) {
    sketchSolveStates.delete(sketchId);
  }

  function setSketchSolveOk(sketchId, result, sourceSketchId = sketchId) {
    sketchSolveStates.set(sketchId, { status: "ok", sourceSketchId, result });
  }

  function setSketchSolveError(sketchId, result, sourceSketchId = sketchId) {
    sketchSolveStates.set(sketchId, {
      status: "error",
      sourceSketchId,
      errorNorm: Number.isFinite(result?.errorNorm) ? result.errorNorm : Infinity,
      reason: result?.reason || "solve failed",
      result,
    });
  }

  function sketchSolveState(sketchId) {
    return sketchSolveStates.get(sketchId) || null;
  }

  function sketchHasSolveError(sketchId) {
    return sketchSolveState(sketchId)?.status === "error";
  }

  function sketchSolveErrorTitle(sketchId) {
    const state = sketchSolveState(sketchId);
    if (state?.status !== "error") return "";
    const errorText = Number.isFinite(state.errorNorm) ? state.errorNorm.toExponential(3) : "unknown";
    return `子スケッチ破綻: error=${errorText}, reason=${state.reason}`;
  }

  function dependentErrorSummary(dependent) {
    const failures = dependent?.results?.filter((entry) => entry.status === "error") || [];
    if (failures.length === 0) return "";
    const first = failures[0];
    return ` / 参照スケッチ破綻: ${sketchName(first.sketchId)} (error=${first.result.errorNorm.toExponential(3)})`;
  }

  function solveAndRefresh(label = "自動solve") {
    const solved = stabilizeActiveParameterNamespace(activeSketchId());
    const result = solved.result;
    const analysis = refreshConstraintAnalysis();
    const hasDependentError = solved.dependent?.success === false;
    const hasDuplicateConstraints = (constraintRedundancyState?.count || 0) > 0;
    const statusKind = solved.success && analysis.analysis.stable && !hasDependentError && !hasDuplicateConstraints ? "normal" : "error";
    const dependentText = solved.dependent?.results?.length > 0 ? `, dependent=${solved.dependent.results.length}` : "";
    setHint(`${label}: success=${solved.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}${dependentText}${dependentErrorSummary(solved.dependent)} / ${constraintSummaryText()}`, statusKind);
    updateUI({ refreshAnalysis: false });
    draw();
    if (solved.success && !historyRestoring) recordHistory(label);
    return result;
  }

  function referenceValuesConverged(previous, next) {
    if (previous.size !== next.size) return false;
    for (const [name, value] of next) {
      const before = previous.get(name);
      if (!Number.isFinite(before)) return false;
      const tolerance = PARAMETER_STABILIZATION_RELATIVE_TOLERANCE * Math.max(1, Math.abs(value));
      if (Math.abs(value - before) > tolerance) return false;
    }

    return true;
  }

  function parameterFailureResult(reason) {
    return { success: false, errorNorm: Infinity, iterations: 0, reason };
  }

  function stabilizeActiveParameterNamespace(sketchId = activeSketchId(), options = {}) {
    let previous;
    try {
      ensureParameterNamespace(currentParameterNamespace());
      previous = referenceDimensionValues(currentParameterNamespace());
    } catch (error) {
      const result = parameterFailureResult(parameterErrorText(error));
      return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterError: error };
    }
    const hasReferences = previous.size > 0;
    for (let pass = 0; pass < PARAMETER_STABILIZATION_MAX_PASSES; pass += 1) {
      try {
        evaluateParameterNamespace(currentParameterNamespace(), { referenceValues: previous });
      } catch (error) {
        const result = parameterFailureResult(parameterErrorText(error));
        return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterError: error };
      }
      const requestedSketchIds = Array.isArray(options.allSketches) && options.allSketches.length > 0 ? options.allSketches : [sketchId];
      let solved = null;
      const dependentResults = [];
      for (const requestedSketchId of [...new Set(requestedSketchIds)]) {
        const item = solveSketchAndDependents(requestedSketchId);
        solved ||= item;
        dependentResults.push(...(item.dependent?.results || []));
        if (!item.success || item.dependent?.success === false) return item;
      }
      solved ||= { success: true, sketchId, result: { success: true, errorNorm: 0, iterations: 0 }, dependent: { success: true, results: [] } };
      solved.dependent = { success: true, results: dependentResults };
      let next;
      try {
        next = referenceDimensionValues(currentParameterNamespace());
      } catch (error) {
        const result = parameterFailureResult(parameterErrorText(error));
        return { success: false, sketchId, result, dependent: solved.dependent, parameterError: error };
      }
      if (!hasReferences || referenceValuesConverged(previous, next)) {
        evaluateParameterNamespace(currentParameterNamespace(), { referenceValues: next });
        solved.parameterPasses = pass + 1;
        return solved;
      }
      previous = next;
    }
    const result = parameterFailureResult(applicationText("Parameter計算が収束しません", "Parameter calculation did not converge"));
    return { success: false, sketchId, result, dependent: { success: true, results: [] }, parameterNonConvergent: true };
  }

  function geometryErrorNorm() {
    return vectorNorm(solver.computeErrorVector());
  }

  function pointHasConstraintFreedom(point, analysis) {
    if (point.fixed) return false;
    const freedom = analysis.variableFreedom.get(point);
    return Boolean(freedom?.x || freedom?.y);
  }

  function objectHasConstraintFreedom(object, prop, analysis) {
    return Boolean(analysis.variableFreedom.get(object)?.[prop]);
  }

  function variableDeltaInBasis(object, prop, basis, analysis) {
    const index = analysis.variableIndex?.get(object)?.[prop];
    return index >= 0 ? basis[index] || 0 : 0;
  }

  function lineSupportHasConstraintFreedom(line, analysis) {
    const normal = lineSupportNormal(line);
    for (const basis of analysis.nullspaceBasis || []) {
      const norm = Math.max(1, Math.sqrt(basis.reduce((sum, value) => sum + value * value, 0)));
      const p1Normal = normal.x * variableDeltaInBasis(line.p1, "x", basis, analysis) + normal.y * variableDeltaInBasis(line.p1, "y", basis, analysis);
      const p2Normal = normal.x * variableDeltaInBasis(line.p2, "x", basis, analysis) + normal.y * variableDeltaInBasis(line.p2, "y", basis, analysis);
      if (Math.abs(p1Normal) > 1e-7 * norm || Math.abs(p2Normal) > 1e-7 * norm) return true;
    }
    return false;
  }

  function classifyConstraintStatus(item, kind, analysis) {
    if (!analysis.stable) return "conflict";
    if (kind === "point") return pointHasConstraintFreedom(item, analysis) ? "under" : "full";
    if (kind === "line") {
      const hasEndpointFreedom = pointHasConstraintFreedom(item.p1, analysis) || pointHasConstraintFreedom(item.p2, analysis);
      if (!hasEndpointFreedom) return "full";
      return lineSupportHasConstraintFreedom(item, analysis) ? "under" : "support";
    }
    if (kind === "circle") return pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis) ? "under" : "full";
    if (kind === "arc") {
      const supportFreedom = pointHasConstraintFreedom(item.center, analysis) || objectHasConstraintFreedom(item, "radiusValue", analysis);
      const endpointFreedom = objectHasConstraintFreedom(item, "startAngle", analysis) || objectHasConstraintFreedom(item, "endAngle", analysis);
      if (!supportFreedom && !endpointFreedom) return "full";
      return !supportFreedom && endpointFreedom ? "support" : "under";
    }
    return "full";
  }

  function classifyBlockProjectionStatus(item, analysis) {
    if (!analysis.stable) return "conflict";
    const instance = item?.blockInstance;
    if (!instance || instance.fixed) return "full";
    const freedom = analysis.variableFreedom.get(instance) || {};
    const translationFree = Boolean(freedom.x || freedom.y);
    const rotationFree = Boolean(freedom.rotation);
    if (item instanceof Arc) {
      if (translationFree) return "under";
      return rotationFree ? "support" : "full";
    }
    if (item instanceof Circle || item instanceof Point) return translationFree ? "under" : "full";
    if (item instanceof Line) {
      if (!translationFree && !rotationFree) return "full";
      const length = Math.max(item.length(), MIN_LINE_LENGTH);
      const direction = { x: item.dx() / length, y: item.dy() / length };
      for (const basis of analysis.nullspaceBasis || []) {
        const norm = Math.max(1, Math.sqrt(basis.reduce((sum, value) => sum + value * value, 0)));
        const dx = variableDeltaInBasis(instance, "x", basis, analysis);
        const dy = variableDeltaInBasis(instance, "y", basis, analysis);
        const dr = variableDeltaInBasis(instance, "rotation", basis, analysis);
        const normalMotion = -direction.y * dx + direction.x * dy;
        if (Math.abs(normalMotion) > 1e-7 * norm || Math.abs(dr) > 1e-7 * norm) return "under";
      }
      return "support";
    }
    return translationFree || rotationFree ? "under" : "full";
  }

  function refreshConstraintAnalysis(options = {}) {
    refreshReferenceConstraintValidity();
    const rootSketchId = activeSketchId();
    const sketchIds = [rootSketchId, ...descendantSketchIds(rootSketchId)];
    const analyses = new Map();
    const statuses = new Map();
    const items = [];
    for (const sketchId of sketchIds) {
      const analysis = solver.analyzeConstraintState({
        variables: sketchSolveVariables(sketchId),
        constraints: sketchSolveConstraints(sketchId),
        lines: sketchSolveLines(sketchId),
        errorTolerance: CONSTRAINT_ACCEPT_ERROR,
      });
      const forceConflict = sketchHasSolveError(sketchId);
      analyses.set(sketchId, analysis);
      for (const p of model.points) {
        if (elementSketchId(p) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(p, "point", analysis);
        statuses.set(p, status);
        if (isEditableSketchElement(p) && isExplicitPoint(p)) items.push(status);
      }
      for (const l of model.lines) {
        if (elementSketchId(l) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(l, "line", analysis);
        statuses.set(l, status);
        if (isEditableSketchElement(l)) items.push(status);
      }
      for (const c of model.circles) {
        if (elementSketchId(c) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(c, "circle", analysis);
        statuses.set(c, status);
        if (isEditableSketchElement(c)) items.push(status);
      }
      for (const a of model.arcs) {
        if (elementSketchId(a) !== sketchId) continue;
        const status = forceConflict ? "conflict" : classifyConstraintStatus(a, "arc", analysis);
        statuses.set(a, status);
        if (isEditableSketchElement(a)) items.push(status);
      }
      for (const bundle of blockProjectionBundles()) {
        if (bundle.instance.sketchId !== sketchId) continue;
        for (const item of [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs]) {
          const status = forceConflict ? "conflict" : classifyBlockProjectionStatus(item, analysis);
          statuses.set(item, status);
          if (isEditableSketchElement(item) && !(item instanceof Point)) items.push(status);
        }
      }
    }
    const summary = {
      full: items.filter((status) => status === "full").length,
      support: items.filter((status) => status === "support").length,
      under: items.filter((status) => status === "under").length,
      conflict: items.filter((status) => status === "conflict").length,
      total: items.length,
    };
    constraintAnalysisState = { analysis: analyses.get(rootSketchId), analyses, statuses, summary };
    refreshConstraintRedundancy(options.redundancyBySketch || null);
    return constraintAnalysisState;
  }

  function constraintStatusOf(item) {
    if (!constraintAnalysisState) refreshConstraintAnalysis();
    return constraintAnalysisState?.statuses.get(item) || "full";
  }

  function constraintStatusColor(item, selected = false, hovered = false) {
    if (selected) return "#1d4ed8";
    if (hovered) return "#3b82f6";
    if (sketchHasSolveError(elementSketchId(item))) return SKETCH_SOLVE_ERROR_COLOR;
    const relation = sketchRelationOfElement(item);
    if (relation !== "active") return "#cbd5e1";
    const status = constraintStatusOf(item);
    if (status === "conflict") return CONSTRAINT_STATUS_COLORS.conflict;
    return CONSTRAINT_STATUS_COLORS[status] || CONSTRAINT_STATUS_COLORS.full;
  }

  function sketchStrokeWidth(item) {
    const relation = sketchRelationOfElement(item);
    if (relation === "active") return 2;
    if (relation === "reference" || relation === "descendant" || relation === "inactive") return 1.2;
    return 0;
  }

  function geometryDisplayColor(item, appearance, selected = false, hovered = false) {
    if (selected) return "#1d4ed8";
    if (hovered) return "#3b82f6";
    return viewState.constraintStatus ? constraintStatusColor(item) : appearance.color;
  }

  function geometryStrokeWidth(item, { auxiliaryHighlighted = false, selected = false, hovered = false, appearance = null, construction = false } = {}) {
    if (auxiliaryHighlighted || selected) return 3;
    if (hovered) return 2.2;
    if (appearance) return appearance.lineWidth;
    if (construction) return Math.max(0.9, sketchStrokeWidth(item) * 0.55);
    return sketchStrokeWidth(item);
  }

  function isSidebarHighlightedElement(item) {
    return Boolean(hoveredSketchTreeId && elementSketchId(item) === hoveredSketchTreeId);
  }

  function sameConstraintDisplayElement(a, b) {
    if (a === b) return true;
    if (!a?.blockProjection || !b?.blockProjection) return false;
    return geometryRefsEqual(geometryRefForItem(a), geometryRefForItem(b));
  }

  function isSidebarHoveredElement(item) {
    if (!item || !hoveredSidebarItem?.elements) return false;
    if (hoveredSidebarItem.elements.has(item)) return true;
    return [...hoveredSidebarItem.elements].some((element) => sameConstraintDisplayElement(element, item));
  }

  function hasPrimaryCanvasSelection() {
    return selectedPoints.length > 0 ||
      selectedLines.length > 0 ||
      selectedCircles.length > 0 ||
      selectedArcs.length > 0 ||
      selectedBlockInstances.length > 0 ||
      Boolean(selectedArcEndpoint) ||
      Boolean(selectedArcEndpointPair) ||
      Boolean(selectedDimensionConstraint);
  }

  function effectiveSelectedConstraint() {
    return hasPrimaryCanvasSelection() ? null : selectedConstraint;
  }

  function isSelectedConstraintRelatedElement(item) {
    const constraint = effectiveSelectedConstraint();
    return Boolean(constraint && constraintGraphNodes(constraint).some((element) => sameConstraintDisplayElement(element, item)));
  }

  function isReferenceHoverElement(item) {
    return Boolean(pendingConstraintCommand && item && !isActiveSketchElement(item) && isReferenceSourceSketchId(elementSketchId(item)));
  }

  function isPendingReferenceTarget(item) {
    const target = pendingConstraintCommand?.referenceTarget || pendingCommand?.referenceTarget;
    if (!target || !item) return false;
    if (target.kind === "point") return target.point === item;
    if (target.kind === "line") return target.line === item;
    if (target.kind === "primitive") return target.primitive === item;
    return false;
  }

  function drawOrderBySketch(items) {
    return items.filter(isVisibleSketchElement).sort((a, b) => Number(isEditableSketchElement(a)) - Number(isEditableSketchElement(b)));
  }

  function sketchAlpha(item) {
    const relation = sketchRelationOfElement(item);
    if (relation === "active") return 1;
    if (relation === "reference" || relation === "descendant" || relation === "inactive") return 1;
    return 0;
  }

  function constraintStatusBadge(status) {
    if (status === "conflict") return applicationText("矛盾", "Conflict");
    if (status === "support") return applicationText("支持位置拘束", "Supported position");
    if (status === "under") return applicationText("未拘束", "Under-constrained");
    return applicationText("完全拘束", "Fully constrained");
  }

  function constraintSummaryText() {
    if (!constraintAnalysisState) refreshConstraintAnalysis();
    const s = constraintAnalysisState?.summary || { full: 0, support: 0, under: 0, conflict: 0 };
    return applicationLanguage === "en"
      ? `Fully constrained: ${s.full} / Supported position: ${s.support} / Under-constrained: ${s.under} / Conflict: ${s.conflict}${constraintDuplicateSummary()}${referenceConstraintErrorSummary()}`
      : `完全拘束: ${s.full} / 支持位置拘束: ${s.support} / 未拘束: ${s.under} / 矛盾: ${s.conflict}${constraintDuplicateSummary()}${referenceConstraintErrorSummary()}`;
  }

  function syncConstraintStatusView({ hint = true } = {}) {
    const next = constraintStatusMouseLatched || constraintStatusSpaceHeld;
    const changed = viewState.constraintStatus !== next;
    viewState.constraintStatus = next;
    const button = document.getElementById("constraintStatusViewBtn");
    button?.classList.toggle("active", next);
    button?.setAttribute("aria-pressed", String(next));
    if (hint && changed) setHint(next ? "拘束状態表示: Document内の全Geometryを表示しています" : "通常表示");
    if (changed) draw();
  }

  function addPoint(x, y, fixed = false, kind = "explicit") {
    const p = new Point(`P${pointSeq++}`, x, y, fixed, kind);
    assignSketchId(p);
    model.points.push(p);
    return p;
  }

  function addLine(p1, p2, construction = constructionLineMode) {
    if (p1 === p2) return null;
    const l = new Line(`L${lineSeq++}`, p1, p2, construction);
    assignSketchId(l);
    ensureLineMinimumLength(l);
    model.lines.push(l);
    return l;
  }

  function preferredDirectionFrom(start, p) {
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    const len = hypot2(dx, dy);
    if (len >= MIN_LINE_LENGTH) return { x: dx / len, y: dy / len };
    if (len > 1e-9) return { x: dx / len, y: dy / len };
    return { x: 1, y: 0 };
  }

  function pointAtMinimumDistance(start, p) {
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    const len = hypot2(dx, dy);
    if (len >= MIN_LINE_LENGTH) return p;
    const dir = preferredDirectionFrom(start, p);
    return { x: start.x + dir.x * MIN_LINE_LENGTH, y: start.y + dir.y * MIN_LINE_LENGTH };
  }

  function ensureLineMinimumLength(line, preferred = null) {
    if (!line) return { changed: false, failed: false };
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const len = hypot2(dx, dy);
    if (len >= MIN_LINE_LENGTH) return { changed: false, failed: false };
    const fallback = preferred || (len > 1e-9 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 });
    const dirLen = hypot2(fallback.x, fallback.y);
    const dir = dirLen > 1e-9 ? { x: fallback.x / dirLen, y: fallback.y / dirLen } : { x: 1, y: 0 };
    if (!line.p2.fixed) {
      line.p2.x = line.p1.x + dir.x * MIN_LINE_LENGTH;
      line.p2.y = line.p1.y + dir.y * MIN_LINE_LENGTH;
      return { changed: true, failed: false };
    }
    if (!line.p1.fixed) {
      line.p1.x = line.p2.x - dir.x * MIN_LINE_LENGTH;
      line.p1.y = line.p2.y - dir.y * MIN_LINE_LENGTH;
      return { changed: true, failed: false };
    }
    return { changed: false, failed: true };
  }

  function enforceMinimumLineLengths(lines = model.lines) {
    let changed = 0;
    let failed = 0;
    for (const line of lines) {
      const result = ensureLineMinimumLength(line);
      if (result.changed) changed += 1;
      if (result.failed) failed += 1;
    }
    return { changed, failed };
  }

  function snapshotLineLength(snapshot, line) {
    if (!snapshot || !line) return line?.length?.() || 0;
    const pointState = new Map(snapshot.points.map((p) => [p.point, p]));
    const p1 = pointState.get(line.p1);
    const p2 = pointState.get(line.p2);
    if (!p1 || !p2) return line.length();
    return hypot2(p2.x - p1.x, p2.y - p1.y);
  }

  function constraintShouldRejectLineCollapse(constraint) {
    return (
      constraint instanceof HorizontalConstraint ||
      constraint instanceof VerticalConstraint ||
      constraint instanceof PointHorizontalConstraint ||
      constraint instanceof PointVerticalConstraint ||
      constraint instanceof SymmetryConstraint ||
      constraint instanceof LineSymmetryConstraint ||
      constraint instanceof ParallelConstraint ||
      constraint instanceof PerpendicularConstraint ||
      constraint instanceof CollinearConstraint ||
      constraint instanceof PointOnLineConstraint ||
      constraint instanceof PointOnLineMidpointConstraint ||
      constraint instanceof ArcEndpointOnLineConstraint ||
      constraint instanceof LineCircleTangentConstraint
    );
  }

  function findLineCollapseAfterConstraint(constraint, snapshot, sketchId = activeSketchId()) {
    if (!constraintShouldRejectLineCollapse(constraint)) return null;
    const component = connectedComponentFromSeeds(constraintGraphNodes(constraint));
    const lines = localSolveLines(component, sketchId);
    for (const line of lines) {
      const before = snapshotLineLength(snapshot, line);
      const after = line.length();
      if (before <= MIN_LINE_LENGTH * 100) continue;
      const nearMinimum = after <= MIN_LINE_LENGTH * 5;
      const collapsedRelativeToBefore = after <= before * 1e-4;
      if (nearMinimum && collapsedRelativeToBefore) {
        return { line, before, after };
      }
    }
    return null;
  }

  function addCircle(center, radiusValue, construction = constructionLineMode) {
    if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
    const c = new Circle(`C${circleSeq++}`, center, radiusValue, construction);
    assignSketchId(c);
    model.circles.push(c);
    return c;
  }

  function addArc(center, radiusValue, startAngle, endAngle, construction = constructionLineMode) {
    if (!center || !Number.isFinite(radiusValue) || radiusValue < MIN_ORIENTATION_LENGTH) return null;
    if (!Number.isFinite(startAngle) || !Number.isFinite(endAngle)) return null;
    const a = new Arc(`A${arcSeq++}`, center, radiusValue, startAngle, endAngle, construction);
    assignSketchId(a);
    normalizeArcSweep(a);
    model.arcs.push(a);
    return a;
  }

  function blockSelectionGeometry() {
    const lines = selectedLines.filter((item) => !item.blockProjection);
    const circles = selectedCircles.filter((item) => !item.blockProjection);
    const arcs = selectedArcs.filter((item) => !item.blockProjection);
    const points = new Set(selectedPoints.filter((item) => !item.blockProjection));
    const blockInstances = selectedBlockInstances.filter((instance) => model.blockInstances.includes(instance));
    for (const line of lines) {
      points.add(line.p1);
      points.add(line.p2);
    }
    for (const primitive of [...circles, ...arcs]) points.add(primitive.center);
    const projectedGeometry = blockInstances.flatMap((instance) => {
      const bundle = blockProjectionBundle(instance);
      return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs];
    });
    const geometry = [...points, ...lines, ...circles, ...arcs, ...blockInstances, ...projectedGeometry];
    if (lines.length + circles.length + arcs.length + blockInstances.length === 0) return { error: "ブロック化する図形を選択してください" };
    if (!geometry.every((item) => elementSketchId(item) === activeSketchId())) return { error: "アクティブスケッチ内の図形だけをブロック化できます" };
    const selectedSet = new Set(geometry);
    const selectedProjectionIds = new Set(projectedGeometry.map((item) => item.id));
    const isSelectedNode = (node) => selectedSet.has(node) || Boolean(node?.blockProjection && selectedProjectionIds.has(node.id));
    for (const point of points) {
      const shared = model.lines.some((line) => !selectedSet.has(line) && (line.p1 === point || line.p2 === point)) ||
        model.circles.some((circle) => !selectedSet.has(circle) && circle.center === point) ||
        model.arcs.some((arc) => !selectedSet.has(arc) && arc.center === point);
      if (shared) return { error: `${point.id} は非選択図形と共有されています` };
    }
    const internalConstraints = [];
    const externalConstraints = [];
    for (const constraint of model.constraints) {
      const nodes = constraintGraphNodes(constraint).filter((node) => node instanceof Point || node instanceof Line || node instanceof Circle || node instanceof Arc);
      if (!nodes.some(isSelectedNode)) continue;
      if (constraint.reference || nodes.some((node) => !isSelectedNode(node))) externalConstraints.push(constraint);
      else {
        if (!serializeConstraint(constraint)) return { error: `ブロック化で保持できない拘束があります: ${constraintLabelForList(constraint)}` };
        internalConstraints.push(constraint);
      }
    }
    for (const annotation of model.annotations) {
      const referenced = annotation.type === "leader" ? resolveGeometryRef(annotation.geometryRef) : null;
      if (referenced && isSelectedNode(referenced)) return { error: `注記 ${annotation.id} が選択図形を参照しています` };
    }
    return { points: [...points], lines, circles, arcs, blockInstances, projectedGeometry, constraints: internalConstraints, externalConstraints };
  }

  function cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, origin = { x: 0, y: 0 }, preserveReference = false) {
    const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
    if (!data) throw new Error("未対応の内部拘束があります");
    if (data.dimension) {
      data.dimension = { ...data.dimension };
      for (const key of ["x", "labelX"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) - origin.x;
      for (const key of ["y", "labelY"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) - origin.y;
    }
    const cloned = deserializeConstraint(data, pointById, lineById, primitiveById);
    if (!cloned) throw new Error("内部拘束を複製できません");
    cloned.sketchId = constraint.sketchId || DEFAULT_SKETCH_ID;
    cloned.reference = preserveReference && Boolean(constraint.reference);
    cloned.referenceSketchId = cloned.reference ? constraint.referenceSketchId || null : null;
    return cloned;
  }

  function createBlockSketchState() {
    return {
      sketches: [
        { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} },
        { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} },
      ],
      activeSketchId: DEFAULT_SKETCH_ID,
    };
  }

  function blockSelectionBoundsCenter(selection) {
    let bounds = null;
    for (const line of selection.lines || []) bounds = mergeBounds(bounds, lineBBox(line));
    for (const primitive of [...(selection.circles || []), ...(selection.arcs || [])]) bounds = mergeBounds(bounds, primitiveBBox(primitive));
    for (const instance of selection.blockInstances || []) {
      const bundle = blockProjectionBundle(instance);
      for (const line of bundle.lines) bounds = mergeBounds(bounds, lineBBox(line));
      for (const primitive of [...bundle.circles, ...bundle.arcs]) bounds = mergeBounds(bounds, primitiveBBox(primitive));
      for (const point of bundle.points) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
    return bounds ? { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 } : { x: 0, y: 0 };
  }

  function addBlockProjectionElementsToMaps(bundle, pointById, lineById, primitiveById) {
    for (const point of bundle.points) pointById.set(point.id, point);
    for (const line of bundle.lines) lineById.set(line.id, line);
    for (const primitive of [...bundle.circles, ...bundle.arcs]) primitiveById.set(primitive.id, primitive);
  }

  function cloneBlockInstance(instance, offset = { x: 0, y: 0 }) {
    return {
      id: instance.id,
      definitionId: instance.definitionId,
      sketchId: instance.sketchId,
      x: Number(instance.x) - (Number(offset.x) || 0),
      y: Number(instance.y) - (Number(offset.y) || 0),
      rotation: Number(instance.rotation) || 0,
      fixed: Boolean(instance.fixed),
      rotationLocked: Boolean(instance.rotationLocked),
      enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
      appearanceOverride: normalizeAppearance(instance.appearanceOverride),
    };
  }

  function createBlockDefinitionFromSelection(selection, origin, name) {
    const sketchState = createBlockSketchState();
    const pointById = new Map();
    const points = selection.points.map((source) => {
      const point = new Point(source.id, source.x - origin.x, source.y - origin.y, source.fixed, source.kind || "endpoint");
      point.sketchId = DEFAULT_SKETCH_ID;
      point.appearance = normalizeAppearance(source.appearance);
      pointById.set(point.id, point);
      return point;
    });
    const lineById = new Map();
    const lines = selection.lines.map((source) => {
      const line = new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
      line.sketchId = DEFAULT_SKETCH_ID;
      line.appearance = normalizeAppearance(source.appearance);
      lineById.set(line.id, line);
      return line;
    });
    const primitiveById = new Map();
    const circles = selection.circles.map((source) => {
      const circle = new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
      circle.sketchId = DEFAULT_SKETCH_ID;
      circle.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(circle.id, circle);
      return circle;
    });
    const arcs = selection.arcs.map((source) => {
      const arc = new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
      arc.sketchId = DEFAULT_SKETCH_ID;
      arc.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(arc.id, arc);
      return arc;
    });
    const blockInstances = (selection.blockInstances || []).map((source) => {
      const instance = cloneBlockInstance(source, origin);
      instance.sketchId = DEFAULT_SKETCH_ID;
      return instance;
    });
    for (const instance of blockInstances) {
      const nestedDefinition = blockDefinitionById(instance.definitionId);
      if (nestedDefinition) addBlockProjectionElementsToMaps(createBlockProjectionBundle(instance, nestedDefinition), pointById, lineById, primitiveById);
    }
    const constraints = selection.constraints.map((constraint) => {
      const cloned = cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, origin);
      cloned.sketchId = DEFAULT_SKETCH_ID;
      if (isDimensionConstraint(cloned)) {
        delete cloned.parameterName;
        if (!isReadOnlyDimension(cloned)) cloned.expression = numericDimensionExpression(cloned);
      }
      return cloned;
    });
    const definition = { id: `B${blockDefinitionSeq++}`, name, parentDefinitionId: null, origin: { x: 0, y: 0 }, ...sketchState, points, lines, circles, arcs, blockInstances, constraints, parameters: [], nextDimensionParameterIndex: 1, revision: 1 };
    ensureParameterNamespace(definition);
    return definition;
  }

  function createEmptyBlockDefinition(name) {
    const sketchState = createBlockSketchState();
    return { id: `B${blockDefinitionSeq++}`, name, parentDefinitionId: null, origin: { x: 0, y: 0 }, ...sketchState, points: [], lines: [], circles: [], arcs: [], blockInstances: [], constraints: [], parameters: [], nextDimensionParameterIndex: 1, revision: 1 };
  }

  function cloneBlockDefinition(definition) {
    const pointById = new Map();
    const points = definition.points.map((source) => {
      const point = new Point(source.id, source.x, source.y, source.fixed, source.kind || "endpoint");
      point.sketchId = source.sketchId;
      point.appearance = normalizeAppearance(source.appearance);
      pointById.set(point.id, point);
      return point;
    });
    const lineById = new Map();
    const lines = definition.lines.map((source) => {
      const line = new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
      line.sketchId = source.sketchId;
      line.appearance = normalizeAppearance(source.appearance);
      lineById.set(line.id, line);
      return line;
    });
    const primitiveById = new Map();
    const circles = definition.circles.map((source) => {
      const circle = new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
      circle.sketchId = source.sketchId;
      circle.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(circle.id, circle);
      return circle;
    });
    const arcs = definition.arcs.map((source) => {
      const arc = new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
      arc.sketchId = source.sketchId;
      arc.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(arc.id, arc);
      return arc;
    });
    const blockInstances = (definition.blockInstances || []).map((instance) => cloneBlockInstance(instance));
    for (const instance of blockInstances) {
      const nestedDefinition = blockDefinitionById(instance.definitionId);
      if (nestedDefinition) addBlockProjectionElementsToMaps(createBlockProjectionBundle(instance, nestedDefinition), pointById, lineById, primitiveById);
    }
    const constraints = definition.constraints.map((constraint) => cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, { x: 0, y: 0 }, true));
    return {
      id: definition.id,
      name: definition.name,
      parentDefinitionId: definition.parentDefinitionId || null,
      origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
      sketches: definition.sketches.map((sketch) => ({ ...sketch, appearance: normalizeAppearance(sketch.appearance) })),
      activeSketchId: definition.activeSketchId,
      points,
      lines,
      circles,
      arcs,
      blockInstances,
      constraints,
      parameters: (definition.parameters || []).map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
      nextDimensionParameterIndex: Math.max(1, Number(definition.nextDimensionParameterIndex) || 1),
      revision: Number(definition.revision) || 0,
    };
  }

  function rebuildBlockDefinitionConstraintObjects(definition) {
    const pointById = new Map(definition.points.map((point) => [point.id, point]));
    const lineById = new Map(definition.lines.map((line) => [line.id, line]));
    const primitiveById = new Map([...definition.circles, ...definition.arcs].map((primitive) => [primitive.id, primitive]));
    for (const instance of definition.blockInstances || []) {
      const nestedDefinition = blockDefinitionById(instance.definitionId);
      if (nestedDefinition) addBlockProjectionElementsToMaps(createBlockProjectionBundle(instance, nestedDefinition), pointById, lineById, primitiveById);
    }
    let removed = 0;
    const constraints = [];
    for (const source of definition.constraints || []) {
      const data = decorateSerializedConstraint(serializeConstraint(source), source);
      let constraint = null;
      try {
        constraint = data ? deserializeConstraint(data, pointById, lineById, primitiveById) : null;
      } catch (_error) {
        constraint = null;
      }
      if (!constraint) {
        removed += 1;
        continue;
      }
      constraint.sketchId = source.sketchId;
      constraint.reference = Boolean(source.reference);
      constraint.referenceSketchId = source.referenceSketchId || null;
      constraints.push(constraint);
    }
    definition.constraints = constraints;
    return removed;
  }

  function rebuildStoredBlockDefinitionConstraints() {
    return model.blockDefinitions.reduce((removed, definition) => removed + rebuildBlockDefinitionConstraintObjects(definition), 0);
  }

  function blockDefinitionOwnedSubtreeIds(rootDefinitionIds) {
    const ids = new Set(rootDefinitionIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const definition of model.blockDefinitions) {
        if (!definition.parentDefinitionId || !ids.has(definition.parentDefinitionId) || ids.has(definition.id)) continue;
        ids.add(definition.id);
        changed = true;
      }
    }
    return ids;
  }

  function selectedBlockDefinitionMoveError(selection) {
    const selectedInstances = new Set(selection?.blockInstances || []);
    const definitionIds = [...new Set((selection?.blockInstances || []).map((instance) => instance.definitionId))];
    for (const definitionId of definitionIds) {
      const definition = blockDefinitionById(definitionId);
      if (!definition) return `ブロック定義 ${definitionId} が見つかりません`;
      const unselected = model.blockInstances.filter((instance) => instance.definitionId === definitionId && !selectedInstances.has(instance));
      if (unselected.length === 0) continue;
      return `${definition.name} を使用する未選択インスタンス（${unselected.map((instance) => instance.id).join(", ")}）があります。対象インスタンスをすべて選択してください`;
    }
    return null;
  }

  function stageSelectedBlockDefinitionsForParent(draft) {
    const rootDefinitionIds = [...new Set((draft?.blockInstances || []).map((instance) => instance.definitionId))];
    if (!draft || rootDefinitionIds.length === 0) return new Map();
    const rootIdSet = new Set(rootDefinitionIds);
    const subtreeIds = blockDefinitionOwnedSubtreeIds(rootDefinitionIds);
    const rollbackEntries = new Map();
    const stagedDefinitions = new Map();
    for (let index = 0; index < model.blockDefinitions.length; index += 1) {
      const definition = model.blockDefinitions[index];
      if (!subtreeIds.has(definition.id)) continue;
      rollbackEntries.set(definition.id, { definition, index });
      const staged = cloneBlockDefinition(definition);
      if (rootIdSet.has(staged.id)) staged.parentDefinitionId = draft.id;
      stagedDefinitions.set(staged.id, staged);
    }
    model.blockDefinitions = model.blockDefinitions.map((definition) => stagedDefinitions.get(definition.id) || definition);
    for (const definition of stagedDefinitions.values()) rebuildBlockDefinitionConstraintObjects(definition);
    rebuildBlockDefinitionConstraintObjects(draft);
    invalidateBlockProjectionCache();
    return rollbackEntries;
  }

  function syncBlockEditorDraft(session = blockEditSession) {
    if (!session) return null;
    session.draft.points = model.points;
    session.draft.lines = model.lines;
    session.draft.circles = model.circles;
    session.draft.arcs = model.arcs;
    session.draft.blockInstances = model.blockInstances;
    session.draft.constraints = model.constraints;
    session.draft.parameters = model.parameters;
    session.draft.nextDimensionParameterIndex = model.nextDimensionParameterIndex;
    session.draft.sketches = model.sketches.map((sketch) => ({ ...sketch }));
    session.draft.activeSketchId = activeSketchId();
    return session.draft;
  }

  function blockEditorSessionChain() {
    const sessions = [];
    for (let session = blockEditSession; session; session = session.parentSession) sessions.push(session);
    return sessions;
  }

  function blockDefinitionIsTransientInEditor(definitionId) {
    return blockEditorSessionChain().some((session) =>
      session.transientDefinitionIds?.has(definitionId) || session.definitionRollbackEntries?.has(definitionId),
    );
  }

  function currentBlockDefinitionScopeId() {
    return blockEditSession?.draft?.id || null;
  }

  function blockDefinitionsInCurrentScope() {
    const parentDefinitionId = currentBlockDefinitionScopeId();
    return model.blockDefinitions.filter((definition) => (definition.parentDefinitionId || null) === parentDefinitionId);
  }

  function blockDefinitionScopeError(definitionId) {
    const definition = blockDefinitionById(definitionId);
    if (!definition) return "ブロック定義が見つかりません";
    return (definition.parentDefinitionId || null) === currentBlockDefinitionScopeId()
      ? null
      : "このブロックは現在の階層では使用できません";
  }

  function blockDefinitionForDependency(definitionId) {
    const session = blockEditorSessionChain().find((item) => item.draft?.id === definitionId);
    return session?.draft || blockDefinitionById(definitionId);
  }

  function blockDefinitionDependsOn(definitionId, targetDefinitionId, visiting = new Set()) {
    if (!definitionId || !targetDefinitionId || visiting.has(definitionId)) return false;
    if (definitionId === targetDefinitionId) return true;
    const definition = blockDefinitionForDependency(definitionId);
    if (!definition) return false;
    const nextVisiting = new Set(visiting).add(definitionId);
    return (definition.blockInstances || []).some((instance) => blockDefinitionDependsOn(instance.definitionId, targetDefinitionId, nextVisiting));
  }

  function blockInstancesInEditingScope() {
    const instances = new Set(model.blockInstances);
    for (const session of blockEditorSessionChain()) {
      for (const instance of session.draft?.blockInstances || []) instances.add(instance);
      for (const instance of session.original?.blockInstances || []) instances.add(instance);
    }
    for (const definition of model.blockDefinitions) for (const instance of definition.blockInstances || []) instances.add(instance);
    return [...instances];
  }

  function storedBlockInstancesReferencing(definitionId, hostInstances = null) {
    const instances = hostInstances
      ? [...hostInstances, ...model.blockDefinitions.flatMap((definition) => definition.blockInstances || [])]
      : blockInstancesInEditingScope();
    return [...new Set(instances)].filter((instance) => instance.definitionId === definitionId);
  }

  function blockDefinitionUsageCount(definitionId) {
    return model.blockInstances.filter((instance) => instance.definitionId === definitionId).length;
  }

  function blockDefinitionEditError(definitionId) {
    const activeSession = blockEditorSessionChain().find((session) => session.draft?.id === definitionId);
    return activeSession ? `${activeSession.draft.name} は現在編集中です` : null;
  }

  function blockDefinitionCyclePath(startDefinitionId) {
    const complete = new Set();
    const visit = (definitionId, path) => {
      const repeatedAt = path.indexOf(definitionId);
      if (repeatedAt >= 0) return [...path.slice(repeatedAt), definitionId];
      if (complete.has(definitionId)) return null;
      const definition = blockDefinitionForDependency(definitionId);
      if (!definition) return null;
      const nextPath = [...path, definitionId];
      for (const instance of definition.blockInstances || []) {
        const cycle = visit(instance.definitionId, nextPath);
        if (cycle) return cycle;
      }
      complete.add(definitionId);
      return null;
    };
    return visit(startDefinitionId, []);
  }

  function nestedBlockPlacementError(definitionId) {
    if (!blockEditSession) return null;
    for (const session of blockEditorSessionChain()) {
      if (blockDefinitionDependsOn(definitionId, session.draft.id)) {
        return `${session.draft.name} を循環参照するため、このブロックは配置できません`;
      }
    }
    return null;
  }

  function startBlockCreation() {
    if (!isGeometryMode() || !canCreateInActiveSketch()) return;
    const definitionsDialog = document.getElementById("blockDefinitionsDialog");
    if (definitionsDialog?.open) definitionsDialog.close();
    const creationHost = {
      points: model.points,
      lines: model.lines,
      circles: model.circles,
      arcs: model.arcs,
      constraints: model.constraints,
      parameters: model.parameters,
      nextDimensionParameterIndex: model.nextDimensionParameterIndex,
      blockInstances: model.blockInstances,
      sketches: model.sketches,
      activeSketchId: model.activeSketchId,
      viewport: { ...viewport },
    };
    const defaultName = `Block-${blockDefinitionSeq}`;
    const hasGeometrySelection = selectedLines.length + selectedCircles.length + selectedArcs.length > 0;
    let selection = null;
    let origin = { x: 0, y: 0 };
    if (hasGeometrySelection || selectedBlockInstances.length > 0) {
      selection = blockSelectionGeometry();
      if (selection.error) {
        setHint(selection.error, "error");
        return;
      }
      const definitionMoveError = selectedBlockDefinitionMoveError(selection);
      if (definitionMoveError) {
        setHint(definitionMoveError, "error");
        return;
      }
      if (!guardDimensionSymbolDeletion(new Set([...(selection.constraints || []), ...(selection.externalConstraints || [])]))) return;
      origin = blockSelectionBoundsCenter(selection);
    }
    const draft = selection ? createBlockDefinitionFromSelection(selection, origin, defaultName) : createEmptyBlockDefinition(defaultName);
    draft.parentDefinitionId = currentBlockDefinitionScopeId();
    const definitionRollbackEntries = selection ? stageSelectedBlockDefinitionsForParent(draft) : new Map();
    openBlockDefinitionEditor(draft, { isNew: true, creationSelection: selection, replacementCenter: origin, definitionRollbackEntries, originalHost: creationHost });
  }

  function startBlockPlacement(definitionId) {
    if (!isGeometryMode() || !canCreateInActiveSketch()) return;
    if (!blockDefinitionById(definitionId)) return;
    const scopeError = blockDefinitionScopeError(definitionId);
    if (scopeError) {
      setHint(scopeError, "error");
      return;
    }
    clearSelection();
    mode = "block-place";
    blockPlacementDefinitionId = definitionId;
    blockPlacementAnchor = null;
    blockPlacementEnabledSketchIds = blockDefinitionDrawableSketchIds(blockDefinitionById(definitionId));
    blockPlacementRotationLocked = true;
    pointerPreview = lastPointerWorld || { x: 0, y: 0 };
    setHint("配置する内部スケッチを選び、表示中心をクリックしてください");
    updateToolbar();
    updateBlockUI();
    draw();
  }

  function commitBlockPlacement(rotation = 0) {
    const definition = blockDefinitionById(blockPlacementDefinitionId);
    if (!definition || !blockPlacementAnchor) return null;
    const enabledSketchIds = blockPlacementEnabledSketchIds.filter((id) => blockDefinitionDrawableSketchIds(definition).includes(id));
    if (!enabledSketchIds.some((id) => blockDefinitionGeometrySketchIds(definition).includes(id))) {
      setHint("図形を持つ内部スケッチを1つ以上有効にしてください", "error");
      return null;
    }
    const committedRotation = blockPlacementRotationLocked ? snappedBlockRotation(rotation) : rotation;
    const translation = blockInstanceTranslationForAnchor(definition, enabledSketchIds, blockPlacementAnchor, committedRotation);
    const instance = { id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: activeSketchId(), x: translation.x, y: translation.y, rotation: committedRotation, fixed: false, rotationLocked: blockPlacementRotationLocked, enabledSketchIds: enabledSketchIds.slice(), appearanceOverride: {} };
    model.blockInstances.push(instance);
    invalidateBlockProjectionCache(instance.id);
    clearSelection();
    selectedBlockInstances = [instance];
    blockPlacementAnchor = null;
    blockPlacementEnabledSketchIds = [];
    pointerPreview = null;
    mode = "select";
    solveAndRefresh("ブロック配置");
    setHint(`${definition.name} を配置しました`);
    updateUI();
    draw();
    recordHistory("ブロック配置");
    return instance;
  }

  function handleBlockPlacementClick(pointer) {
    if (!blockPlacementAnchor) {
      if (!blockPlacementEnabledSketchIds.some((id) => blockDefinitionGeometrySketchIds(blockDefinitionById(blockPlacementDefinitionId)).includes(id))) {
        setHint("図形を持つ内部スケッチを1つ以上有効にしてください", "error");
        return;
      }
      blockPlacementAnchor = { x: pointer.x, y: pointer.y };
      pointerPreview = pointer;
      setHint("回転方向をクリックしてください。Escで角度0度として配置します");
      draw();
      return;
    }
    commitBlockPlacement(blockPlacementRotation(pointer));
  }

  function openBlockDefinitionEditor(draft, options = {}) {
    if (!draft) return;
    const parentSession = blockEditSession;
    if (parentSession) syncBlockEditorDraft(parentSession);
    const originalProjectionItems = blockProjectionBundles().flatMap((bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs]);
    const original = options.originalHost || {
      points: model.points,
      lines: model.lines,
      circles: model.circles,
      arcs: model.arcs,
      constraints: model.constraints,
      parameters: model.parameters,
      nextDimensionParameterIndex: model.nextDimensionParameterIndex,
      blockInstances: model.blockInstances,
      sketches: model.sketches,
      activeSketchId: model.activeSketchId,
      viewport: { ...viewport },
    };
    const sourceDefinition = options.sourceDefinition || null;
    const sourceDefinitionSnapshot = sourceDefinition ? cloneBlockDefinition(sourceDefinition) : null;
    const originalElementIds = new Set(sourceDefinition ? [...sourceDefinition.points, ...sourceDefinition.lines, ...sourceDefinition.circles, ...sourceDefinition.arcs].map((item) => item.id) : []);
    blockEditSession = {
      draft,
      parentSession,
      sourceDefinition,
      sourceDefinitionSnapshot,
      original,
      originalElementIds,
      isNew: Boolean(options.isNew),
      creationSelection: options.creationSelection || null,
      replacementCenter: options.replacementCenter || null,
      transientDefinitionIds: new Set(options.initialTransientDefinitionIds || []),
      definitionRollbackEntries: new Map(options.definitionRollbackEntries || []),
      originalProjectionIds: new Set(originalProjectionItems.map((item) => item.id)),
      originalProjectionKeys: new Set(originalProjectionItems.map(geometryElementKey)),
      historyUndo: [],
      historyRedo: [],
    };
    model.points = draft.points;
    model.lines = draft.lines;
    model.circles = draft.circles;
    model.arcs = draft.arcs;
    model.constraints = draft.constraints;
    model.parameters = draft.parameters || [];
    model.nextDimensionParameterIndex = Math.max(1, Number(draft.nextDimensionParameterIndex) || 1);
    model.blockInstances = draft.blockInstances || [];
    model.sketches = draft.sketches;
    model.activeSketchId = draft.activeSketchId;
    reserveGeometryElementSequences(draft);
    sketchSeq = Math.max(sketchSeq, nextSeq(draft.sketches || [], "S"));
    resetBlockEditorHistory();
    clearSelection();
    mode = "select";
    document.body.classList.add("block-editing");
    if (draft.lines.length + draft.circles.length + draft.arcs.length + model.blockInstances.length > 0) fitAllGeometryToViewport();
    else {
      const rect = canvas.getBoundingClientRect();
      viewport.scale = 1;
      viewport.x = rect.width / 2;
      viewport.y = rect.height / 2;
    }
    const externalConstraintCount = blockEditSession.creationSelection?.externalConstraints?.length || 0;
    setHint(
      externalConstraintCount > 0
        ? `ブロックエディタ: ${draft.name} / 選択外につながる拘束${externalConstraintCount}件は完了時に解除されます`
        : `ブロックエディタ: ${draft.name}`,
    );
    updateUI();
    draw();
  }

  function enterBlockDefinitionEdit(definitionId) {
    const scopeError = blockDefinitionScopeError(definitionId);
    if (scopeError) {
      setHint(scopeError, "error");
      return;
    }
    const editError = blockDefinitionEditError(definitionId);
    if (editError) {
      setHint(editError, "error");
      return;
    }
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    openBlockDefinitionEditor(cloneBlockDefinition(definition), { sourceDefinition: definition });
  }

  function validateBlockDraft(draft) {
    if (draft.lines.length + draft.circles.length + draft.arcs.length + (draft.blockInstances?.length || 0) === 0) return { success: false, reason: "ブロックには図形が必要です" };
    const outOfScopeInstance = (draft.blockInstances || []).find((instance) => blockDefinitionById(instance.definitionId)?.parentDefinitionId !== draft.id);
    if (outOfScopeInstance) return { success: false, reason: "現在のブロックに属さない子ブロックが含まれています" };
    const cycle = blockDefinitionCyclePath(draft.id);
    if (cycle) return { success: false, reason: `ブロックの循環参照があります: ${cycle.join(" → ")}` };
    const duplicateId = duplicateBlockElementId(draft);
    if (duplicateId) return { success: false, reason: `内部図形ID ${duplicateId} が重複しています。編集をキャンセルしてデータを確認してください` };
    refreshReferenceConstraintValidity();
    if (invalidReferenceConstraints.size > 0) return { success: false, reason: "内部スケッチの参照関係に循環または無効な参照があります" };
    const drawableIds = blockDefinitionDrawableSketchIds(draft);
    for (const sketchId of drawableIds) {
      const result = solveSketchById(sketchId);
      if (!resultIsAccepted(result)) return { success: false, reason: `${sketchName(sketchId)} が成立しません (error=${result.errorNorm.toExponential(3)})` };
      const dependent = solveReferenceDependentSketches(sketchId);
      if (!dependent.success) return { success: false, reason: `${sketchName(dependent.sketchId)} が成立しません` };
    }
    return { success: true };
  }

  function translateBlockDefinition(definition, dx, dy) {
    for (const point of definition.points) {
      point.x += dx;
      point.y += dy;
    }
    for (const constraint of definition.constraints) {
      const dimension = constraint.dimension;
      if (!dimension) continue;
      for (const key of ["x", "labelX"]) if (Number.isFinite(Number(dimension[key]))) dimension[key] = Number(dimension[key]) + dx;
      for (const key of ["y", "labelY"]) if (Number.isFinite(Number(dimension[key]))) dimension[key] = Number(dimension[key]) + dy;
    }
    for (const instance of definition.blockInstances || []) {
      instance.x += dx;
      instance.y += dy;
    }
  }

  function mergeBlockDefinitionDraft(target, draft) {
    const pointById = new Map();
    const oldPoints = new Map(target.points.map((point) => [point.id, point]));
    const points = draft.points.map((source) => {
      const point = oldPoints.get(source.id) || new Point(source.id, source.x, source.y, source.fixed, source.kind || "endpoint");
      point.x = source.x;
      point.y = source.y;
      point.fixed = source.fixed;
      point.kind = source.kind;
      point.sketchId = source.sketchId;
      point.appearance = normalizeAppearance(source.appearance);
      pointById.set(point.id, point);
      return point;
    });
    const oldLines = new Map(target.lines.map((line) => [line.id, line]));
    const lineById = new Map();
    const lines = draft.lines.map((source) => {
      const line = oldLines.get(source.id) || new Line(source.id, pointById.get(source.p1.id), pointById.get(source.p2.id), source.construction);
      line.p1 = pointById.get(source.p1.id);
      line.p2 = pointById.get(source.p2.id);
      line.construction = source.construction;
      line.sketchId = source.sketchId;
      line.appearance = normalizeAppearance(source.appearance);
      lineById.set(line.id, line);
      return line;
    });
    const primitiveById = new Map();
    const oldCircles = new Map(target.circles.map((circle) => [circle.id, circle]));
    const circles = draft.circles.map((source) => {
      const circle = oldCircles.get(source.id) || new Circle(source.id, pointById.get(source.center.id), source.radius(), source.construction);
      circle.center = pointById.get(source.center.id);
      circle.radiusValue = source.radius();
      circle.construction = source.construction;
      circle.sketchId = source.sketchId;
      circle.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(circle.id, circle);
      return circle;
    });
    const oldArcs = new Map(target.arcs.map((arc) => [arc.id, arc]));
    const arcs = draft.arcs.map((source) => {
      const arc = oldArcs.get(source.id) || new Arc(source.id, pointById.get(source.center.id), source.radius(), source.startAngle, source.endAngle, source.construction);
      arc.center = pointById.get(source.center.id);
      arc.radiusValue = source.radius();
      arc.startAngle = source.startAngle;
      arc.endAngle = source.endAngle;
      arc.construction = source.construction;
      arc.sketchId = source.sketchId;
      arc.appearance = normalizeAppearance(source.appearance);
      primitiveById.set(arc.id, arc);
      return arc;
    });
    const oldBlockInstances = new Map((target.blockInstances || []).map((instance) => [instance.id, instance]));
    const blockInstances = (draft.blockInstances || []).map((source) => {
      const instance = oldBlockInstances.get(source.id) || cloneBlockInstance(source);
      instance.definitionId = source.definitionId;
      instance.sketchId = source.sketchId;
      instance.x = Number(source.x) || 0;
      instance.y = Number(source.y) || 0;
      instance.rotation = Number(source.rotation) || 0;
      instance.fixed = Boolean(source.fixed);
      instance.rotationLocked = Boolean(source.rotationLocked);
      instance.enabledSketchIds = Array.isArray(source.enabledSketchIds) ? source.enabledSketchIds.slice() : [];
      instance.appearanceOverride = normalizeAppearance(source.appearanceOverride);
      return instance;
    });
    for (const instance of blockInstances) {
      const nestedDefinition = blockDefinitionById(instance.definitionId);
      if (nestedDefinition) addBlockProjectionElementsToMaps(createBlockProjectionBundle(instance, nestedDefinition), pointById, lineById, primitiveById);
    }
    const constraints = draft.constraints.map((constraint) => cloneConstraintForBlock(constraint, pointById, lineById, primitiveById, { x: 0, y: 0 }, true));
    target.name = draft.name;
    target.parentDefinitionId = draft.parentDefinitionId || null;
    target.origin = { ...draft.origin };
    target.sketches = draft.sketches.map((sketch) => ({ ...sketch, appearance: normalizeAppearance(sketch.appearance) }));
    target.activeSketchId = draft.activeSketchId;
    target.points = points;
    target.lines = lines;
    target.circles = circles;
    target.arcs = arcs;
    target.blockInstances = blockInstances;
    target.constraints = constraints;
    target.parameters = (draft.parameters || []).map((parameter) => ({ name: parameter.name, expression: parameter.expression }));
    target.nextDimensionParameterIndex = Math.max(1, Number(draft.nextDimensionParameterIndex) || 1);
    target.revision = (Number(target.revision) || 0) + 1;
    return target;
  }

  function restoreBlockEditorHost(session) {
    const { original } = session;
    model.points = original.points;
    model.lines = original.lines;
    model.circles = original.circles;
    model.arcs = original.arcs;
    model.constraints = original.constraints;
    model.parameters = original.parameters || [];
    model.nextDimensionParameterIndex = Math.max(1, Number(original.nextDimensionParameterIndex) || 1);
    model.blockInstances = original.blockInstances;
    model.sketches = original.sketches;
    model.activeSketchId = original.activeSketchId;
    Object.assign(viewport, original.viewport);
    blockEditSession = session.parentSession || null;
    document.body.classList.toggle("block-editing", Boolean(blockEditSession));
  }

  function propagateBlockDefinitionRollbacks(targetSession, sourceSession) {
    if (!targetSession || !sourceSession?.definitionRollbackEntries) return;
    if (!targetSession.definitionRollbackEntries) targetSession.definitionRollbackEntries = new Map();
    for (const [definitionId, entry] of sourceSession.definitionRollbackEntries) {
      if (!targetSession.definitionRollbackEntries.has(definitionId)) targetSession.definitionRollbackEntries.set(definitionId, entry);
    }
  }

  function restoreBlockDefinitionRollbacks(session) {
    const entries = [...(session?.definitionRollbackEntries?.values() || [])].sort((a, b) => a.index - b.index);
    for (const entry of entries) {
      const existingIndex = model.blockDefinitions.findIndex((definition) => definition.id === entry.definition.id);
      if (existingIndex >= 0) model.blockDefinitions[existingIndex] = entry.definition;
      else model.blockDefinitions.splice(Math.min(entry.index, model.blockDefinitions.length), 0, entry.definition);
    }
    if (entries.length > 0) {
      rebuildStoredBlockDefinitionConstraints();
      invalidateBlockProjectionCache();
    }
  }

  function completeBlockDefinitionEdit() {
    if (!blockEditSession) return;
    const session = blockEditSession;
    const { draft, sourceDefinition, originalElementIds, creationSelection } = session;
    draft.points = model.points;
    draft.lines = model.lines;
    draft.circles = model.circles;
    draft.arcs = model.arcs;
    draft.blockInstances = model.blockInstances;
    draft.constraints = model.constraints;
    draft.parameters = model.parameters;
    draft.nextDimensionParameterIndex = model.nextDimensionParameterIndex;
    draft.sketches = model.sketches.map((sketch) => ({ ...sketch, appearance: normalizeAppearance(sketch.appearance) }));
    draft.activeSketchId = activeSketchId();
    const validation = validateBlockDraft(draft);
    if (!validation.success) {
      setHint(validation.reason, "error");
      draw();
      return;
    }
    if (session.isNew && !creationSelection) {
      const center = blockLocalGeometryBounds(draft, blockDefinitionDrawableSketchIds(draft))?.center || { x: 0, y: 0 };
      translateBlockDefinition(draft, -center.x, -center.y);
      draft.origin = { x: 0, y: 0 };
    }
    if (sourceDefinition) {
      for (const instance of storedBlockInstancesReferencing(sourceDefinition.id, session.original.blockInstances)) {
        const remaining = instance.enabledSketchIds.filter((id) => blockDefinitionGeometrySketchIds(draft).includes(id));
        if (remaining.length === 0) {
          setHint(`${instance.id} の有効スケッチが空になるため編集を完了できません`, "error");
          return;
        }
      }
    }
    restoreBlockEditorHost(session);
    let definition = draft;
    let createdInstance = null;
    let blockCreationExternalConstraints = [];
    if (sourceDefinition) {
      definition = mergeBlockDefinitionDraft(sourceDefinition, draft);
      for (const instance of storedBlockInstancesReferencing(definition.id)) {
        instance.enabledSketchIds = instance.enabledSketchIds.filter((id) => blockDefinitionGeometrySketchIds(definition).includes(id));
      }
      const removedStoredConstraints = rebuildStoredBlockDefinitionConstraints();
      if (removedStoredConstraints > 0) log(`削除された入れ子図形を参照する内部拘束を${removedStoredConstraints}件解除しました`);
    } else {
      definition.revision = 1;
      model.blockDefinitions.push(definition);
      if (creationSelection) {
        const enabledSketchIds = blockDefinitionGeometrySketchIds(definition);
        createdInstance = { id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: model.activeSketchId, x: session.replacementCenter.x, y: session.replacementCenter.y, rotation: 0, fixed: false, rotationLocked: true, enabledSketchIds, appearanceOverride: {} };
        model.blockInstances.push(createdInstance);
        blockCreationExternalConstraints = creationSelection.externalConstraints || [];
        model.constraints = model.constraints.filter((constraint) => !creationSelection.constraints.includes(constraint) && !blockCreationExternalConstraints.includes(constraint));
        model.lines = model.lines.filter((line) => !creationSelection.lines.includes(line));
        model.circles = model.circles.filter((circle) => !creationSelection.circles.includes(circle));
        model.arcs = model.arcs.filter((arc) => !creationSelection.arcs.includes(arc));
        model.points = model.points.filter((point) => !creationSelection.points.includes(point));
        model.blockInstances = model.blockInstances.filter((instance) => !(creationSelection.blockInstances || []).includes(instance));
      }
    }
    if (blockEditSession) {
      propagateBlockDefinitionRollbacks(blockEditSession, session);
      const definitionIdsToKeepTransactional = new Set(session.transientDefinitionIds);
      if (!sourceDefinition) definitionIdsToKeepTransactional.add(definition.id);
      if (!sourceDefinition || blockDefinitionIsTransientInEditor(sourceDefinition.id)) {
        for (const definitionId of definitionIdsToKeepTransactional) blockEditSession.transientDefinitionIds.add(definitionId);
      }
    }
    const currentElementIds = new Set([...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs].map((item) => item.id));
    const removedLocalIds = new Set([...originalElementIds].filter((id) => !currentElementIds.has(id)));
    if (removedLocalIds.size > 0) {
      model.constraints = model.constraints.filter((constraint) => !constraintGraphNodes(constraint).some((node) =>
        node?.blockDefinition === definition && removedLocalIds.has(node.localElement?.id),
      ));
      const removedProjectionIds = new Set();
      const removedProjectionKeys = new Set();
      for (const instance of model.blockInstances.filter((item) => item.definitionId === definition.id)) {
        for (const localId of removedLocalIds) {
          for (const kind of ["point", "line", "circle", "arc"]) {
            const ref = createGeometryRef(kind, [String(instance.id), String(localId)]);
            removedProjectionIds.add(geometryRefId(ref));
            removedProjectionKeys.add(geometryRefKey(ref));
          }
        }
      }
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedProjectionIds, removedProjectionKeys));
    }
    invalidateBlockProjectionCache();
    const currentProjectionItems = blockProjectionBundles().flatMap((bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs]);
    const currentProjectionIds = new Set(currentProjectionItems.map((item) => item.id));
    const currentProjectionKeys = new Set(currentProjectionItems.map(geometryElementKey));
    const removedProjectionIds = new Set([...session.originalProjectionIds].filter((id) => !currentProjectionIds.has(id)));
    const removedProjectionKeys = new Set([...session.originalProjectionKeys].filter((key) => !currentProjectionKeys.has(key)));
    if (removedProjectionIds.size > 0) {
      model.constraints = model.constraints.filter((constraint) => !constraintGraphNodes(constraint).some((node) => removedProjectionIds.has(node?.id)));
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedProjectionIds, removedProjectionKeys));
    }
    const affectedSketchIds = [...new Set(model.blockInstances.filter((instance) => blockDefinitionDependsOn(instance.definitionId, definition.id)).map((instance) => instance.sketchId))];
    for (const sketchId of affectedSketchIds) {
      const placementResult = solveSketchById(sketchId);
      if (placementResult.success && placementResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) setSketchSolveOk(sketchId, placementResult, definition.id);
      else setSketchSolveError(sketchId, placementResult, definition.id);
      solveReferenceDependentSketches(sketchId);
    }
    clearSelection();
    if (createdInstance) selectedBlockInstances = [createdInstance];
    mode = "select";
    const completionHint = sourceDefinition ? `ブロック定義を更新しました: ${definition.name}` : `ブロックを作成しました: ${definition.name}`;
    const externalConstraintHint = blockCreationExternalConstraints.length > 0 ? ` / 外部拘束${blockCreationExternalConstraints.length}件を解除しました` : "";
    setHint(`${completionHint}${externalConstraintHint}`);
    if (blockCreationExternalConstraints.length > 0) log(`ブロック外部拘束を${blockCreationExternalConstraints.length}件解除しました`);
    updateUI();
    draw();
    recordHistory(sourceDefinition ? "ブロック定義編集" : "ブロック作成");
  }

  function cancelBlockDefinitionEdit() {
    if (!blockEditSession) return;
    const session = blockEditSession;
    restoreBlockEditorHost(session);
    if (session.transientDefinitionIds.size > 0) {
      model.blockDefinitions = model.blockDefinitions.filter((definition) => !session.transientDefinitionIds.has(definition.id));
    }
    restoreBlockDefinitionRollbacks(session);
    if (session.sourceDefinition && session.sourceDefinitionSnapshot) {
      const revision = session.sourceDefinitionSnapshot.revision;
      mergeBlockDefinitionDraft(session.sourceDefinition, session.sourceDefinitionSnapshot);
      session.sourceDefinition.revision = revision;
    }
    invalidateBlockProjectionCache();
    clearSelection();
    mode = "select";
    setHint(session.sourceDefinition ? "ブロック定義編集をキャンセルしました" : "ブロック作成をキャンセルしました");
    updateUI();
    draw();
  }

  function exitBlockDefinitionEdit() {
    completeBlockDefinitionEdit();
  }

  function renameBlockDefinition(definitionId) {
    const scopeError = blockDefinitionScopeError(definitionId);
    if (scopeError) {
      setHint(scopeError, "error");
      return;
    }
    const editError = blockDefinitionEditError(definitionId);
    if (editError) {
      setHint(`${editError}。編集中の名前欄を使用してください`, "error");
      return;
    }
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    const name = window.prompt("ブロック名", definition.name);
    if (name == null || !name.trim()) return;
    definition.name = name.trim();
    updateBlockUI();
    recordHistory("ブロック名変更");
  }

  function deleteBlockDefinition(definitionId) {
    const scopeError = blockDefinitionScopeError(definitionId);
    if (scopeError) {
      setHint(scopeError, "error");
      return;
    }
    const editError = blockDefinitionEditError(definitionId);
    if (editError) {
      setHint(`${editError}。完了またはキャンセルしてから削除してください`, "error");
      return;
    }
    const definition = blockDefinitionById(definitionId);
    if (!definition) return;
    const instances = model.blockInstances.filter((instance) => instance.definitionId === definitionId);
    if (instances.length > 0) {
      setHint(`${definition.name} は ${instances.length}個のインスタンスで使用中のため削除できません`, "error");
      return;
    }
    const removedDefinitionIds = new Set([definitionId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of model.blockDefinitions) {
        if (item.parentDefinitionId && removedDefinitionIds.has(item.parentDefinitionId) && !removedDefinitionIds.has(item.id)) {
          removedDefinitionIds.add(item.id);
          changed = true;
        }
      }
    }
    model.blockDefinitions = model.blockDefinitions.filter((item) => !removedDefinitionIds.has(item.id));
    for (const session of blockEditorSessionChain()) {
      for (const removedId of removedDefinitionIds) session.transientDefinitionIds?.delete(removedId);
    }
    invalidateBlockProjectionCache();
    updateBlockUI();
    draw();
    recordHistory("ブロック定義削除");
  }

  function offsetDistanceFromPointer(source, pointer) {
    if (source instanceof Line) {
      const signed = signedPointDirectedLineDistance(pointer, source);
      return { distance: Math.abs(signed), sign: signed < 0 ? -1 : 1 };
    }
    const radial = hypot2(pointer.x - source.center.x, pointer.y - source.center.y);
    const signed = radial - source.radius();
    return { distance: Math.abs(signed), sign: signed < 0 ? -1 : 1 };
  }

  function offsetDraftGeometry(source, distance, sign) {
    if (!source || !Number.isFinite(distance) || distance <= 0) return null;
    if (source instanceof Line) {
      const normal = lineNormal(source);
      const dx = normal.x * sign * distance;
      const dy = normal.y * sign * distance;
      const p1 = new Point("OP1", source.p1.x + dx, source.p1.y + dy, false, "endpoint");
      const p2 = new Point("OP2", source.p2.x + dx, source.p2.y + dy, false, "endpoint");
      return new Line("OFFSET", p1, p2, source.construction);
    }
    const radius = source.radius() + sign * distance;
    if (radius < MIN_ORIENTATION_LENGTH) return null;
    const center = new Point("OC", source.center.x, source.center.y, false, "center");
    if (source instanceof Circle) return new Circle("OFFSET", center, radius, source.construction);
    if (source instanceof Arc) return new Arc("OFFSET", center, radius, source.startAngle, source.endAngle, source.construction);
    return null;
  }

  function offsetDimensionTarget(source, offset, distance, sign) {
    return { kind: "offset-distance", source, offset, value: distance, sign };
  }

  function startOffsetDistanceInput(source, pointer) {
    if (!source || !pointer) return false;
    let { distance, sign } = offsetDistanceFromPointer(source, pointer);
    if (distance < MIN_ORIENTATION_LENGTH) distance = Math.max(20 / viewport.scale, MIN_ORIENTATION_LENGTH * 10);
    const offset = offsetDraftGeometry(source, distance, sign);
    if (!offset) {
      setHint("指定した側にはオフセットを作成できません", "error");
      return false;
    }
    const target = offsetDimensionTarget(source, offset, distance, sign);
    pendingCommand = {
      type: "offset-value",
      source,
      sign,
      pointer: { ...pointer },
      target,
      dimension: dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer),
      buffer: formatDisplayNumber(distance),
      editing: false,
    };
    setHint("オフセット距離を入力してください。Enterまたはダブルクリックで決定します");
    updateToolbar();
    draw();
    focusDimensionValueInput();
    return true;
  }

  function createOffsetGeometry(source, distance, sign, pointer) {
    const state = {
      pointLength: model.points.length,
      lineLength: model.lines.length,
      circleLength: model.circles.length,
      arcLength: model.arcs.length,
      pointSeq,
      lineSeq,
      circleSeq,
      arcSeq,
    };
    let offset = null;
    if (source instanceof Line) {
      const normal = lineNormal(source);
      const dx = normal.x * sign * distance;
      const dy = normal.y * sign * distance;
      const p1 = addPoint(source.p1.x + dx, source.p1.y + dy, false, "endpoint");
      const p2 = addPoint(source.p2.x + dx, source.p2.y + dy, false, "endpoint");
      offset = addLine(p1, p2, source.construction);
    } else {
      const radius = source.radius() + sign * distance;
      if (radius < MIN_ORIENTATION_LENGTH) return false;
      const center = addPoint(source.center.x, source.center.y, false, "center");
      offset = source instanceof Circle
        ? addCircle(center, radius, source.construction)
        : addArc(center, radius, source.startAngle, source.endAngle, source.construction);
    }
    if (!offset) return false;
    const constraint = new OffsetConstraint(source, offset, distance, sign);
    const target = offsetDimensionTarget(source, offset, distance, sign);
    constraint.dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer);
    const ok = commitNewConstraint("offset", constraint);
    if (ok) return true;

    model.points.length = state.pointLength;
    model.lines.length = state.lineLength;
    model.circles.length = state.circleLength;
    model.arcs.length = state.arcLength;
    pointSeq = state.pointSeq;
    lineSeq = state.lineSeq;
    circleSeq = state.circleSeq;
    arcSeq = state.arcSeq;
    constraintAnalysisState = null;
    updateUI();
    draw();
    return false;
  }

  function submitOffsetValue() {
    if (pendingCommand?.type !== "offset-value") return false;
    const value = Number(pendingCommand.buffer);
    const { source, sign, pointer } = pendingCommand;
    if (!Number.isFinite(value) || value <= 0 || (!(source instanceof Line) && source.radius() + sign * value < MIN_ORIENTATION_LENGTH)) {
      setHint("作成可能な0より大きいオフセット距離を入力してください", "error");
      draw();
      return false;
    }
    pendingCommand = null;
    hideDimensionValueInput();
    const ok = createOffsetGeometry(source, value, sign, pointer);
    offsetSource = null;
    pointerPreview = null;
    clearSelection();
    updateToolbar();
    if (ok) setHint(`オフセット ${formatDimensionLabel(value)} を作成しました。次の図形を選択してください`);
    draw();
    return ok;
  }

  function snapshotModelState() {
    return {
      points: model.points.map((p) => ({ point: p, x: p.x, y: p.y, fixed: p.fixed })),
      circles: model.circles.map((c) => ({ circle: c, radiusValue: c.radiusValue })),
      arcs: model.arcs.map((a) => ({ arc: a, radiusValue: a.radiusValue, startAngle: a.startAngle, endAngle: a.endAngle })),
      blockInstances: model.blockInstances.map((instance) => ({
        instance,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: instance.fixed,
        rotationLocked: instance.rotationLocked,
      })),
      constraintLength: model.constraints.length,
      constraints: model.constraints.map((constraint) => ({
        constraint,
        target: constraint.target,
        parameterName: constraint.parameterName,
        expression: constraint.expression,
        evaluatedParameterValue: constraint.evaluatedParameterValue,
      })),
      parameters: model.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
      nextDimensionParameterIndex: model.nextDimensionParameterIndex,
    };
  }

  function restoreModelState(snapshot) {
    for (const p of snapshot.points) {
      p.point.x = p.x;
      p.point.y = p.y;
      p.point.fixed = p.fixed;
    }
    for (const c of snapshot.circles || []) c.circle.radiusValue = c.radiusValue;
    for (const a of snapshot.arcs || []) {
      a.arc.radiusValue = a.radiusValue;
      a.arc.startAngle = a.startAngle;
      a.arc.endAngle = a.endAngle;
    }
    for (const entry of snapshot.blockInstances || []) {
      entry.instance.x = entry.x;
      entry.instance.y = entry.y;
      entry.instance.rotation = entry.rotation;
      entry.instance.fixed = entry.fixed;
      entry.instance.rotationLocked = Boolean(entry.rotationLocked);
    }
    invalidateBlockProjectionCache();
    model.constraints.length = snapshot.constraintLength;
    for (const entry of snapshot.constraints || []) {
      entry.constraint.target = entry.target;
      entry.constraint.parameterName = entry.parameterName;
      if (entry.expression == null) delete entry.constraint.expression;
      else entry.constraint.expression = entry.expression;
      entry.constraint.evaluatedParameterValue = entry.evaluatedParameterValue;
    }
    model.parameters = (snapshot.parameters || []).map((parameter) => ({ ...parameter }));
    model.nextDimensionParameterIndex = Math.max(1, Number(snapshot.nextDimensionParameterIndex) || 1);
    constraintAnalysisState = null;
  }

  function resetModelState() {
    mode = "select";
    lastAuthoringPerformance = null;
    model.documentName = DEFAULT_DOCUMENT_NAME;
    model.points.length = 0;
    model.lines.length = 0;
    model.circles.length = 0;
    model.arcs.length = 0;
    model.constraints.length = 0;
    model.parameters = [];
    model.nextDimensionParameterIndex = 1;
    model.blockDefinitions.length = 0;
    model.blockInstances.length = 0;
    invalidateBlockProjectionCache();
    sketchSolveStates.clear();
    invalidReferenceConstraints.clear();
    constraintAnalysisState = null;
    clearSelection();
    dragSession = null;
    dimensionDragSession = null;
    panSession = null;
    suppressNextBlankDoubleClickEvent = false;
    lineStartPoint = null;
    pointStartRollback = null;
    lineCompletionRollback = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    offsetSource = null;
    pendingCommand = null;
    pendingConstraintCommand = null;
    constraintOperands = [];
    constructionLineMode = false;
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArc = null;
    hoveredArcEndpoint = null;
    hoveredDimensionConstraint = null;
    hoveredSidebarItem = null;
    hoveredSketchIdentity = null;
    lastPointerWorld = null;
    lastMiddleAuxClick = null;
    clearSnap();
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    selectedAnnotation = null;
    selectedBlockInstances = [];
    hoveredBlockInstance = null;
    pointSeq = 1;
    lineSeq = 1;
    circleSeq = 1;
    arcSeq = 1;
    sketchSeq = 2;
    annotationSeq = 1;
    blockDefinitionSeq = 1;
    blockInstanceSeq = 1;
    blockElementSeq = 1;
    blockPlacementDefinitionId = null;
    blockPlacementAnchor = null;
    blockPlacementEnabledSketchIds = [];
    blockPlacementRotationLocked = true;
    blockEditSession = null;
    model.sketches.length = 0;
    model.sketches.push({ id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} });
    model.sketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
    model.activeSketchId = DEFAULT_SKETCH_ID;
    model.defaultAppearance = { ...DEFAULT_APPEARANCE };
    model.defaultConstructionAppearance = { ...DEFAULT_CONSTRUCTION_APPEARANCE };
    model.annotations = [];
    annotationDragSession = null;
  }

  function nextSeq(items, prefix) {
    const max = items.reduce((n, item) => {
      const match = String(item.id).match(new RegExp(`^${prefix}(\\d+)$`));
      return match ? Math.max(n, Number(match[1])) : n;
    }, 0);
    return max + 1;
  }

  function reserveGeometryElementSequences(source) {
    pointSeq = Math.max(pointSeq, nextSeq(source?.points || [], "P"));
    lineSeq = Math.max(lineSeq, nextSeq(source?.lines || [], "L"));
    circleSeq = Math.max(circleSeq, nextSeq(source?.circles || [], "C"));
    arcSeq = Math.max(arcSeq, nextSeq(source?.arcs || [], "A"));
  }

  function duplicateBlockElementId(definition) {
    const seen = new Set();
    for (const item of [...(definition?.points || []), ...(definition?.lines || []), ...(definition?.circles || []), ...(definition?.arcs || []), ...(definition?.blockInstances || [])]) {
      const id = String(item?.id || "");
      if (seen.has(id)) return id;
      seen.add(id);
    }
    return null;
  }

  function serializeDimension(dimension, target = null) {
    if (!dimension) return null;
    if (target?.kind === "angle") migrateAngleDimensionLabelPlacement(target, dimension);
    const anchor = target ? dimensionAnchor(target, dimension) : dimension;
    const axis = target ? storedDimensionAxis(target, dimension) : dimension.axis || null;
    const data = {
      x: Number(anchor.x),
      y: Number(anchor.y),
      offsetU: Number.isFinite(dimension.offsetU) ? dimension.offsetU : null,
      offsetN: Number.isFinite(dimension.offsetN) ? dimension.offsetN : null,
      labelOffsetU: Number.isFinite(dimension.labelOffsetU) ? dimension.labelOffsetU : 0,
      axis,
      display: dimension.display ? { ...dimensionDisplayState(dimension) } : null,
    };
    if (Number.isFinite(dimension.labelX) && Number.isFinite(dimension.labelY)) {
      data.labelX = Number(dimension.labelX);
      data.labelY = Number(dimension.labelY);
    }
    if (target?.kind === "angle") {
      data.angleStartFlip = Number.isInteger(dimension.angleStartFlip) ? dimension.angleStartFlip : null;
      data.angleEndFlip = Number.isInteger(dimension.angleEndFlip) ? dimension.angleEndFlip : null;
      data.angleRadius = Number.isFinite(dimension.angleRadius) ? dimension.angleRadius : null;
      if (Number.isFinite(dimension.angleLabelOffsetR) && Number.isFinite(dimension.angleLabelOffsetT)) {
        data.angleLabelOffsetR = dimension.angleLabelOffsetR;
        data.angleLabelOffsetT = dimension.angleLabelOffsetT;
        data.angleLabelPlacementVersion = 2;
      }
    }
    return data;
  }

  const constraintCodecs = createConstraintCodecRegistry([
    {
      type: "pointAxisDistance",
      constraintClass: PointAxisDistanceConstraint,
      serialize: (c) => ({ p1: constraintGeometryId(c.p1), p2: constraintGeometryId(c.p2), axis: c.axis, sign: c.sign, target: c.target, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled }),
      deserialize: (data, refs) => new PointAxisDistanceConstraint(refs.point(data.p1), refs.point(data.p2), Number(data.target), data.axis === "y" ? "y" : "x", Number(data.sign) || null),
    },
    {
      type: "distance",
      constraintClass: DistanceConstraint,
      serialize: (c) => ({ p1: constraintGeometryId(c.p1), p2: constraintGeometryId(c.p2), target: c.target, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled }),
      deserialize: (data, refs) => new DistanceConstraint(refs.point(data.p1), refs.point(data.p2), Number(data.target)),
    },
    {
      type: "pointLineDistance",
      constraintClass: PointLineDistanceConstraint,
      serialize: (c) => ({ point: constraintGeometryId(c.point), line: constraintGeometryId(c.line), target: c.target, sign: c.sign, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled }),
      deserialize: (data, refs) => new PointLineDistanceConstraint(refs.point(data.point), refs.line(data.line), Number(data.target), Number(data.sign) || null),
    },
    {
      type: "lineLineDistance",
      constraintClass: LineLineDistanceConstraint,
      serialize: (c) => ({ line1: constraintGeometryId(c.line1), line2: constraintGeometryId(c.line2), target: c.target, sign: c.sign, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled }),
      deserialize: (data, refs) => new LineLineDistanceConstraint(refs.line(data.line1), refs.line(data.line2), Number(data.target), Number(data.sign) || null),
    },
    {
      type: "offsetDimension",
      constraintClass: OffsetConstraint,
      serialize: (c) => ({ source: constraintGeometryId(c.source), offset: constraintGeometryId(c.offset), target: c.target, sign: c.sign, directionBasis: c.source instanceof Line ? "endpoint" : "radial", dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled }),
      deserialize(data, refs) {
        const source = refs.lineOrPrimitive(data.source);
        const offset = refs.lineOrPrimitive(data.offset);
        if (!source || !offset) throw new Error(`オフセット対象 ${data.source}/${data.offset} が見つかりません`);
        const savedSign = data.directionBasis === "endpoint" || data.directionBasis === "radial" ? Number(data.sign) || null : null;
        return new OffsetConstraint(source, offset, Number(data.target), savedSign);
      },
    },
    {
      type: "lineAngle",
      constraintClass: LineAngleConstraint,
      serialize: (c) => ({ line1: constraintGeometryId(c.line1), line2: constraintGeometryId(c.line2), target: c.target, startFlip: c.startFlip || 0, endFlip: c.endFlip || 0, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled }),
      deserialize: (data, refs) => new LineAngleConstraint(refs.line(data.line1), refs.line(data.line2), Number(data.target), Number(data.startFlip) || 0, Number(data.endFlip) || 0),
    },
    {
      type: "coincident",
      constraintClass: CoincidentConstraint,
      serialize: (c) => ({ p1: constraintGeometryId(c.p1), p2: constraintGeometryId(c.p2), enabled: c.enabled }),
      deserialize: (data, refs) => new CoincidentConstraint(refs.point(data.p1), refs.point(data.p2)),
    },
    {
      type: "arcEndpointCoincident",
      constraintClass: ArcEndpointCoincidentConstraint,
      serialize: (c) => ({ arc: constraintGeometryId(c.arc), endpoint: c.endpoint, point: constraintGeometryId(c.point), enabled: c.enabled }),
      deserialize: (data, refs) => new ArcEndpointCoincidentConstraint(refs.primitive(data.arc), data.endpoint === "end" ? "end" : "start", refs.point(data.point)),
    },
    {
      type: "arcEndpointArcEndpointCoincident",
      constraintClass: ArcEndpointArcEndpointCoincidentConstraint,
      serialize: (c) => ({ a: constraintGeometryId(c.a), endpointA: c.endpointA, b: constraintGeometryId(c.b), endpointB: c.endpointB, enabled: c.enabled }),
      deserialize: (data, refs) => new ArcEndpointArcEndpointCoincidentConstraint(refs.primitive(data.a), data.endpointA === "end" ? "end" : "start", refs.primitive(data.b), data.endpointB === "end" ? "end" : "start"),
    },
    {
      type: "pointOnLine",
      constraintClass: PointOnLineConstraint,
      serialize: (c) => ({ point: constraintGeometryId(c.point), line: constraintGeometryId(c.line), enabled: c.enabled }),
      deserialize: (data, refs) => new PointOnLineConstraint(refs.point(data.point), refs.line(data.line)),
    },
    {
      type: "pointOnLineMidpoint",
      constraintClass: PointOnLineMidpointConstraint,
      serialize: (c) => ({ point: constraintGeometryId(c.point), line: constraintGeometryId(c.line), enabled: c.enabled }),
      deserialize: (data, refs) => new PointOnLineMidpointConstraint(refs.point(data.point), refs.line(data.line)),
    },
    {
      type: "arcEndpointOnLine",
      constraintClass: ArcEndpointOnLineConstraint,
      serialize: (c) => ({ arc: constraintGeometryId(c.arc), endpoint: c.endpoint, line: constraintGeometryId(c.line), enabled: c.enabled }),
      deserialize: (data, refs) => new ArcEndpointOnLineConstraint(refs.primitive(data.arc), data.endpoint === "end" ? "end" : "start", refs.line(data.line)),
    },
    {
      type: "arcEndpointFixed",
      constraintClass: ArcEndpointFixedConstraint,
      serialize: (c) => ({ arc: constraintGeometryId(c.arc), endpoint: c.endpoint, x: c.x, y: c.y, enabled: c.enabled }),
      deserialize: (data, refs) => new ArcEndpointFixedConstraint(refs.primitive(data.arc), data.endpoint === "end" ? "end" : "start", Number(data.x), Number(data.y)),
    },
    {
      type: "lineFixed",
      constraintClass: LineFixedConstraint,
      serialize: (c) => ({ line: constraintGeometryId(c.line), p1x: c.p1x, p1y: c.p1y, p2x: c.p2x, p2y: c.p2y, enabled: c.enabled }),
      deserialize: (data, refs) => new LineFixedConstraint(refs.line(data.line), Number(data.p1x), Number(data.p1y), Number(data.p2x), Number(data.p2y)),
    },
    {
      type: "horizontal",
      constraintClass: HorizontalConstraint,
      serialize: (c) => ({ line: constraintGeometryId(c.line), enabled: c.enabled }),
      deserialize: (data, refs) => new HorizontalConstraint(refs.line(data.line)),
    },
    {
      type: "vertical",
      constraintClass: VerticalConstraint,
      serialize: (c) => ({ line: constraintGeometryId(c.line), enabled: c.enabled }),
      deserialize: (data, refs) => new VerticalConstraint(refs.line(data.line)),
    },
    {
      type: "pointHorizontal",
      constraintClass: PointHorizontalConstraint,
      serialize: (c) => ({ p1: constraintGeometryId(c.p1), p2: constraintGeometryId(c.p2), enabled: c.enabled }),
      deserialize: (data, refs) => new PointHorizontalConstraint(refs.point(data.p1), refs.point(data.p2)),
    },
    {
      type: "pointVertical",
      constraintClass: PointVerticalConstraint,
      serialize: (c) => ({ p1: constraintGeometryId(c.p1), p2: constraintGeometryId(c.p2), enabled: c.enabled }),
      deserialize: (data, refs) => new PointVerticalConstraint(refs.point(data.p1), refs.point(data.p2)),
    },
    {
      type: "symmetry",
      constraintClass: SymmetryConstraint,
      serialize: (c) => ({ p1: constraintGeometryId(c.p1), p2: constraintGeometryId(c.p2), axis: constraintGeometryId(c.axis), enabled: c.enabled }),
      deserialize: (data, refs) => new SymmetryConstraint(refs.point(data.p1), refs.point(data.p2), refs.line(data.axis)),
    },
    {
      type: "lineSymmetry",
      constraintClass: LineSymmetryConstraint,
      serialize: (c) => ({ line1: constraintGeometryId(c.line1), line2: constraintGeometryId(c.line2), axis: constraintGeometryId(c.axis), reversed: c.reversed, enabled: c.enabled }),
      deserialize: (data, refs) => new LineSymmetryConstraint(refs.line(data.line1), refs.line(data.line2), refs.line(data.axis), typeof data.reversed === "boolean" ? data.reversed : null),
    },
    {
      type: "parallel",
      constraintClass: ParallelConstraint,
      serialize: (c) => ({ line1: constraintGeometryId(c.line1), line2: constraintGeometryId(c.line2), enabled: c.enabled }),
      deserialize: (data, refs) => new ParallelConstraint(refs.line(data.line1), refs.line(data.line2)),
    },
    {
      type: "perpendicular",
      constraintClass: PerpendicularConstraint,
      serialize: (c) => ({ line1: constraintGeometryId(c.line1), line2: constraintGeometryId(c.line2), enabled: c.enabled }),
      deserialize: (data, refs) => new PerpendicularConstraint(refs.line(data.line1), refs.line(data.line2)),
    },
    {
      type: "collinear",
      constraintClass: CollinearConstraint,
      serialize: (c) => ({ line1: constraintGeometryId(c.line1), line2: constraintGeometryId(c.line2), enabled: c.enabled }),
      deserialize: (data, refs) => new CollinearConstraint(refs.line(data.line1), refs.line(data.line2)),
    },
    {
      type: "equalLength",
      constraintClass: EqualLengthConstraint,
      serialize: (c) => ({ line1: constraintGeometryId(c.line1), line2: constraintGeometryId(c.line2), enabled: c.enabled }),
      deserialize: (data, refs) => new EqualLengthConstraint(refs.line(data.line1), refs.line(data.line2)),
    },
    {
      type: "radiusDimension",
      constraintClass: RadiusConstraint,
      serialize: (c) => ({ primitive: constraintGeometryId(c.primitive), target: c.target, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled }),
      deserialize: (data, refs) => new RadiusConstraint(refs.primitive(data.primitive), Number(data.target)),
    },
    {
      type: "diameterDimension",
      constraintClass: DiameterConstraint,
      serialize: (c) => ({ primitive: constraintGeometryId(c.primitive), target: c.target, dimension: serializeDimension(c.dimension, targetFromConstraint(c)), enabled: c.enabled }),
      deserialize: (data, refs) => new DiameterConstraint(refs.primitive(data.primitive), Number(data.target)),
    },
    {
      type: "concentric",
      constraintClass: ConcentricConstraint,
      serialize: (c) => ({ a: constraintGeometryId(c.a), b: constraintGeometryId(c.b), enabled: c.enabled }),
      deserialize: (data, refs) => new ConcentricConstraint(refs.pointOrPrimitive(data.a), refs.pointOrPrimitive(data.b)),
    },
    {
      type: "equalRadius",
      constraintClass: EqualRadiusConstraint,
      serialize: (c) => ({ a: constraintGeometryId(c.a), b: constraintGeometryId(c.b), enabled: c.enabled }),
      deserialize: (data, refs) => new EqualRadiusConstraint(refs.primitive(data.a), refs.primitive(data.b)),
    },
    {
      type: "pointOnCircle",
      constraintClass: PointOnCircleConstraint,
      serialize: (c) => ({ point: constraintGeometryId(c.point), primitive: constraintGeometryId(c.primitive), enabled: c.enabled }),
      deserialize: (data, refs) => new PointOnCircleConstraint(refs.point(data.point), refs.primitive(data.primitive)),
    },
    {
      type: "arcEndpointOnCircle",
      constraintClass: ArcEndpointOnCircleConstraint,
      serialize: (c) => ({ arc: constraintGeometryId(c.arc), endpoint: c.endpoint, primitive: constraintGeometryId(c.primitive), enabled: c.enabled }),
      deserialize: (data, refs) => new ArcEndpointOnCircleConstraint(refs.primitive(data.arc), data.endpoint === "end" ? "end" : "start", refs.primitive(data.primitive)),
    },
    {
      type: "lineCircleTangent",
      constraintClass: LineCircleTangentConstraint,
      serialize: (c) => ({ line: constraintGeometryId(c.line), primitive: constraintGeometryId(c.primitive), sign: c.sign, enabled: c.enabled }),
      deserialize: (data, refs) => new LineCircleTangentConstraint(refs.line(data.line), refs.primitive(data.primitive), Number(data.sign) || null),
    },
    {
      type: "circleCircleTangent",
      constraintClass: CircleCircleTangentConstraint,
      serialize: (c) => ({ a: constraintGeometryId(c.a), b: constraintGeometryId(c.b), mode: c.mode, enabled: c.enabled }),
      deserialize: (data, refs) => new CircleCircleTangentConstraint(refs.primitive(data.a), refs.primitive(data.b), data.mode === "internal" ? "internal" : "external"),
    },
  ]);

  function serializeConstraint(c) {
    return constraintCodecs.serialize(c);
  }

  function serializeModel() {
    ensureModelState();
    return {
      version: 10,
      savedAt: new Date().toISOString(),
      documentName: effectiveDocumentName(),
      defaultAppearance: normalizeAppearance(model.defaultAppearance, { partial: false }),
      defaultConstructionAppearance: normalizeConstructionAppearance(model.defaultConstructionAppearance, { partial: false }),
      sketches: model.sketches.map((sketch) => ({
        id: sketch.id,
        name: sketch.name,
        parentSketchId: sketch.parentSketchId || null,
        kind: isRootSketch(sketch) ? "root" : "sketch",
        appearance: normalizeAppearance(sketch.appearance),
      })),
      activeSketchId: activeSketchId(),
      annotations: normalizeAnnotations(model.annotations).map(serializeAnnotation),
      parameters: model.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
      nextDimensionParameterIndex: model.nextDimensionParameterIndex,
      blockDefinitions: model.blockDefinitions.map((definition) => ({
        id: definition.id,
        name: definition.name,
        parentDefinitionId: definition.parentDefinitionId || null,
        revision: Number(definition.revision) || 0,
        origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
        sketches: definition.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId || null, kind: sketch.kind === "root" ? "root" : "sketch", appearance: normalizeAppearance(sketch.appearance) })),
        activeSketchId: definition.activeSketchId,
        parameters: (definition.parameters || []).map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
        nextDimensionParameterIndex: Math.max(1, Number(definition.nextDimensionParameterIndex) || 1),
        points: definition.points.map((point) => ({ id: point.id, x: point.x, y: point.y, fixed: point.fixed, kind: point.kind || "endpoint", sketchId: point.sketchId, appearance: normalizeAppearance(point.appearance) })),
        lines: definition.lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, construction: Boolean(line.construction), sketchId: line.sketchId, appearance: normalizeAppearance(line.appearance) })),
        circles: definition.circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), construction: Boolean(circle.construction), sketchId: circle.sketchId, appearance: normalizeAppearance(circle.appearance) })),
        arcs: definition.arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, construction: Boolean(arc.construction), sketchId: arc.sketchId, appearance: normalizeAppearance(arc.appearance) })),
        blockInstances: (definition.blockInstances || []).map((instance) => ({
          id: instance.id,
          definitionId: instance.definitionId,
          sketchId: instance.sketchId,
          x: instance.x,
          y: instance.y,
          rotation: instance.rotation,
          fixed: Boolean(instance.fixed),
          rotationLocked: Boolean(instance.rotationLocked),
          enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
          appearanceOverride: normalizeAppearance(instance.appearanceOverride),
        })),
        constraints: definition.constraints.map((constraint) => {
          const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
          if (!data) return null;
          data.sketchId = constraint.sketchId;
          if (constraint.reference) {
            data.reference = true;
            data.referenceSketchId = constraint.referenceSketchId || null;
          }
          return data;
        }).filter(Boolean),
      })),
      blockInstances: model.blockInstances.map((instance) => ({
        id: instance.id,
        definitionId: instance.definitionId,
        sketchId: instance.sketchId,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: Boolean(instance.fixed),
        rotationLocked: Boolean(instance.rotationLocked),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
        appearanceOverride: normalizeAppearance(instance.appearanceOverride),
      })),
      points: model.points.map((p) => ({ id: p.id, x: p.x, y: p.y, fixed: p.fixed, kind: p.kind || (isPointUsedByPrimitive(p) ? "endpoint" : "explicit"), sketchId: elementSketchId(p), appearance: normalizeAppearance(p.appearance) })),
      lines: model.lines.map((l) => ({ id: l.id, p1: l.p1.id, p2: l.p2.id, construction: Boolean(l.construction), sketchId: elementSketchId(l), appearance: normalizeAppearance(l.appearance) })),
      circles: model.circles.map((c) => ({ id: c.id, center: c.center.id, radius: c.radius(), construction: Boolean(c.construction), sketchId: elementSketchId(c), appearance: normalizeAppearance(c.appearance) })),
      arcs: model.arcs.map((a) => ({ id: a.id, center: a.center.id, radius: a.radius(), startAngle: a.startAngle, endAngle: a.endAngle, construction: Boolean(a.construction), sketchId: elementSketchId(a), appearance: normalizeAppearance(a.appearance) })),
      constraints: model.constraints
        .map((constraint) => {
          const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
          if (data) data.sketchId = constraintSketchId(constraint);
          if (data && constraint.reference) {
            data.reference = true;
            data.referenceSketchId = constraint.referenceSketchId || null;
          }
          return data;
        })
        .filter(Boolean),
    };
  }

  function historySnapshot() {
    const data = serializeModel();
    delete data.savedAt;
    delete data.documentName;
    return JSON.stringify(data);
  }

  function liveBlockEditorDefinition() {
    if (!blockEditSession) return null;
    return {
      ...blockEditSession.draft,
      points: model.points,
      lines: model.lines,
      circles: model.circles,
      arcs: model.arcs,
      blockInstances: model.blockInstances,
      constraints: model.constraints,
      parameters: model.parameters,
      nextDimensionParameterIndex: model.nextDimensionParameterIndex,
      sketches: model.sketches,
      activeSketchId: activeSketchId(),
    };
  }

  function blockEditorHistoryData(definition) {
    return {
      id: definition.id,
      name: definition.name,
      parentDefinitionId: definition.parentDefinitionId || null,
      origin: { x: Number(definition.origin?.x) || 0, y: Number(definition.origin?.y) || 0 },
      sketches: definition.sketches.map((sketch) => ({ ...sketch })),
      activeSketchId: definition.activeSketchId,
      parameters: (definition.parameters || []).map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
      nextDimensionParameterIndex: Math.max(1, Number(definition.nextDimensionParameterIndex) || 1),
      points: definition.points.map((point) => ({ id: point.id, x: point.x, y: point.y, fixed: point.fixed, kind: point.kind, sketchId: point.sketchId })),
      lines: definition.lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, construction: Boolean(line.construction), sketchId: line.sketchId })),
      circles: definition.circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), construction: Boolean(circle.construction), sketchId: circle.sketchId })),
      arcs: definition.arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, construction: Boolean(arc.construction), sketchId: arc.sketchId })),
      blockInstances: (definition.blockInstances || []).map((instance) => ({
        id: instance.id,
        definitionId: instance.definitionId,
        sketchId: instance.sketchId,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: Boolean(instance.fixed),
        rotationLocked: Boolean(instance.rotationLocked),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
      })),
      constraints: definition.constraints.map((constraint) => {
        const data = decorateSerializedConstraint(serializeConstraint(constraint), constraint);
        if (!data) return null;
        data.sketchId = constraint.sketchId;
        if (constraint.reference) {
          data.reference = true;
          data.referenceSketchId = constraint.referenceSketchId || null;
        }
        return data;
      }).filter(Boolean),
    };
  }

  function captureBlockEditorHistorySnapshot() {
    const definition = cloneBlockDefinition(liveBlockEditorDefinition());
    return { definition, signature: JSON.stringify(blockEditorHistoryData(definition)) };
  }

  function resetBlockEditorHistory() {
    if (!blockEditSession) return;
    blockEditSession.historyUndo = [captureBlockEditorHistorySnapshot()];
    blockEditSession.historyRedo = [];
    updateHistoryButtons();
  }

  function recordBlockEditorHistory(label) {
    if (!blockEditSession) return;
    const snapshot = captureBlockEditorHistorySnapshot();
    const undo = blockEditSession.historyUndo;
    if (undo[undo.length - 1]?.signature === snapshot.signature) {
      updateHistoryButtons();
      return;
    }
    undo.push(snapshot);
    if (undo.length > HISTORY_LIMIT) undo.shift();
    blockEditSession.historyRedo = [];
    updateHistoryButtons();
    log(`ブロック編集履歴に追加しました: ${label}`);
  }

  function updateHistoryButtons() {
    const undoBtn = document.getElementById("undoBtn");
    const redoBtn = document.getElementById("redoBtn");
    const activeUndo = blockEditSession ? blockEditSession.historyUndo : undoStack;
    const activeRedo = blockEditSession ? blockEditSession.historyRedo : redoStack;
    if (undoBtn) undoBtn.disabled = activeUndo.length <= 1;
    if (redoBtn) redoBtn.disabled = activeRedo.length === 0;
  }

  function resetHistory(label = "initial") {
    undoStack = [historySnapshot()];
    redoStack = [];
    updateHistoryButtons();
    log(`履歴を初期化しました: ${label}`);
  }

  function recordHistory(label = "変更") {
    if (historyRestoring) return;
    if (blockEditSession) {
      recordBlockEditorHistory(label);
      return;
    }
    const snapshot = historySnapshot();
    if (undoStack[undoStack.length - 1] === snapshot) {
      updateHistoryButtons();
      return;
    }
    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
    log(`履歴に追加しました: ${label}`);
  }

  function restoreHistorySnapshot(snapshot, label) {
    const constructionModeBeforeRestore = constructionLineMode;
    const documentNameBeforeRestore = model.documentName;
    historyRestoring = true;
    try {
      loadModelData(JSON.parse(snapshot), { documentNameFallback: documentNameBeforeRestore });
      model.documentName = documentNameBeforeRestore;
      constructionLineMode = constructionModeBeforeRestore;
      clearInteractionForSketchChange();
      solveAndRefresh(label);
      setHint(label);
    } finally {
      historyRestoring = false;
      updateHistoryButtons();
    }
  }

  function restoreBlockEditorHistorySnapshot(snapshot, label) {
    if (!blockEditSession || !snapshot?.definition) return false;
    historyRestoring = true;
    try {
      const restored = cloneBlockDefinition(snapshot.definition);
      blockEditSession.draft = restored;
      model.points = restored.points;
      model.lines = restored.lines;
      model.circles = restored.circles;
      model.arcs = restored.arcs;
      model.constraints = restored.constraints;
      model.parameters = restored.parameters || [];
      model.nextDimensionParameterIndex = Math.max(1, Number(restored.nextDimensionParameterIndex) || 1);
      model.blockInstances = restored.blockInstances || [];
      model.sketches = restored.sketches;
      model.activeSketchId = restored.activeSketchId;
      reserveGeometryElementSequences(restored);
      sketchSeq = Math.max(sketchSeq, nextSeq(restored.sketches || [], "S"));
      invalidateBlockProjectionCache();
      clearInteractionForSketchChange();
      solveAndRefresh(label);
      setHint(label);
      return true;
    } finally {
      historyRestoring = false;
      updateHistoryButtons();
    }
  }

  function undoHistory() {
    if (blockEditSession) {
      if (blockEditSession.historyUndo.length <= 1) return false;
      const current = blockEditSession.historyUndo.pop();
      blockEditSession.historyRedo.push(current);
      return restoreBlockEditorHistorySnapshot(blockEditSession.historyUndo[blockEditSession.historyUndo.length - 1], "ブロック編集を戻す");
    }
    if (undoStack.length <= 1) return false;
    const current = undoStack.pop();
    redoStack.push(current);
    restoreHistorySnapshot(undoStack[undoStack.length - 1], "戻る");
    return true;
  }

  function redoHistory() {
    if (blockEditSession) {
      if (blockEditSession.historyRedo.length === 0) return false;
      const snapshot = blockEditSession.historyRedo.pop();
      blockEditSession.historyUndo.push(snapshot);
      return restoreBlockEditorHistorySnapshot(snapshot, "ブロック編集を進む");
    }
    if (redoStack.length === 0) return false;
    const snapshot = redoStack.pop();
    undoStack.push(snapshot);
    restoreHistorySnapshot(snapshot, "進む");
    return true;
  }

  function deserializeConstraint(data, pointById, lineById, primitiveById) {
    const resolveStoredGeometry = (kind, storedId) => resolveGeometryRefValue(
      parseGeometryRefId(kind, String(storedId)),
      (resolvedKind, canonicalId) => {
        if (resolvedKind === "point") return pointById.get(canonicalId);
        if (resolvedKind === "line") return lineById.get(canonicalId);
        const primitiveValue = primitiveById.get(canonicalId);
        if (resolvedKind === "circle") return primitiveValue instanceof Circle ? primitiveValue : null;
        if (resolvedKind === "arc") return primitiveValue instanceof Arc ? primitiveValue : null;
        return null;
      },
    );
    const primitiveValue = (id) => resolveStoredGeometry("circle", id) || resolveStoredGeometry("arc", id);
    const point = (id) => {
      const p = resolveStoredGeometry("point", id);
      if (!p) throw new Error(`点 ${id} が見つかりません`);
      return p;
    };
    const line = (id) => {
      const l = resolveStoredGeometry("line", id);
      if (!l) throw new Error(`線 ${id} が見つかりません`);
      return l;
    };
    const primitive = (id) => {
      const p = primitiveValue(id);
      if (!p) throw new Error(`円/円弧 ${id} が見つかりません`);
      return p;
    };
    const pointOrPrimitive = (id) => resolveStoredGeometry("point", id) || primitive(id);
    const lineOrPrimitive = (id) => resolveStoredGeometry("line", id) || primitiveValue(id);
    const constraint = constraintCodecs.deserialize(data, { point, line, primitive, pointOrPrimitive, lineOrPrimitive });

    if (constraint) {
      constraint.enabled = data.enabled !== false;
      constraint.readOnlyDimension = Boolean(data.readOnlyDimension);
      if (constraint.readOnlyDimension) constraint.enabled = false;
      if (isDimensionConstraint(constraint)) {
        constraint.parameterName = typeof data.parameterName === "string" ? data.parameterName : null;
        if (!constraint.readOnlyDimension && typeof data.expression === "string") constraint.expression = data.expression;
      }
      if (data.dimension && Number.isFinite(Number(data.dimension.x)) && Number.isFinite(Number(data.dimension.y))) {
        constraint.dimension = {
          x: Number(data.dimension.x),
          y: Number(data.dimension.y),
          offsetU: Number.isFinite(Number(data.dimension.offsetU)) ? Number(data.dimension.offsetU) : NaN,
          offsetN: Number.isFinite(Number(data.dimension.offsetN)) ? Number(data.dimension.offsetN) : NaN,
          labelOffsetU: Number.isFinite(Number(data.dimension.labelOffsetU)) ? Number(data.dimension.labelOffsetU) : 0,
          labelX: Number.isFinite(Number(data.dimension.labelX)) ? Number(data.dimension.labelX) : NaN,
          labelY: Number.isFinite(Number(data.dimension.labelY)) ? Number(data.dimension.labelY) : NaN,
          axis: data.dimension.axis || null,
          angleStartFlip: Number.isInteger(data.dimension.angleStartFlip) ? data.dimension.angleStartFlip : null,
          angleEndFlip: Number.isInteger(data.dimension.angleEndFlip) ? data.dimension.angleEndFlip : null,
          angleRadius: Number.isFinite(Number(data.dimension.angleRadius)) ? Number(data.dimension.angleRadius) : NaN,
          angleLabelOffsetR: data.dimension.angleLabelOffsetR != null && Number.isFinite(Number(data.dimension.angleLabelOffsetR)) ? Number(data.dimension.angleLabelOffsetR) : NaN,
          angleLabelOffsetT: data.dimension.angleLabelOffsetT != null && Number.isFinite(Number(data.dimension.angleLabelOffsetT)) ? Number(data.dimension.angleLabelOffsetT) : NaN,
          angleLabelPlacementVersion: Number.isInteger(data.dimension.angleLabelPlacementVersion) ? data.dimension.angleLabelPlacementVersion : null,
        };
        if (data.dimension.display) constraint.dimension.display = { ...dimensionDisplayState({ display: data.dimension.display }) };
        if (constraint instanceof LineAngleConstraint && !Number.isInteger(data.startFlip) && Number.isInteger(constraint.dimension.angleStartFlip)) {
          constraint.startFlip = constraint.dimension.angleStartFlip ? 1 : 0;
          constraint.endFlip = constraint.dimension.angleEndFlip ? 1 : 0;
        }
      }
    }
    return constraint;
  }

  function loadModelData(data, options = {}) {
    if (!data || !Array.isArray(data.points) || !Array.isArray(data.lines) || !Array.isArray(data.constraints)) {
      throw new Error("保存データの形式が正しくありません");
    }
    lastLoadBlockConstraintRepairMessage = "";
    const sourceVersion = Number(data.version) || 1;
    const loadedDocumentName = effectiveDocumentNameFromValue(options.documentNameOverride || data.documentName || options.documentNameFallback || DEFAULT_DOCUMENT_NAME);

    let loadedSketches =
      Array.isArray(data.sketches) && data.sketches.length > 0
        ? data.sketches.map((sketch, index) => ({
            id: String(sketch.id || `S${index + 1}`),
            name: String(sketch.name || sketch.id || `Sketch-${index + 1}`),
            parentSketchId: sketch.parentSketchId == null ? null : String(sketch.parentSketchId),
            kind: sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID ? "root" : "sketch",
            appearance: normalizeAppearance(sketch.appearance || (sketch.visible === false ? { visible: false } : {})),
          }))
        : [{ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} }];
    let loadedRoot = loadedSketches.find((sketch) => sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID);
    if (!loadedRoot) loadedRoot = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} };
    loadedSketches = [loadedRoot, ...loadedSketches.filter((sketch) => sketch !== loadedRoot && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
    loadedRoot.id = ROOT_SKETCH_ID;
    loadedRoot.name = loadedRoot.name || ROOT_SKETCH_NAME;
    loadedRoot.parentSketchId = null;
    loadedRoot.kind = "root";
    loadedRoot.appearance = normalizeAppearance(loadedRoot.appearance);
    loadedRoot.visible = true;
    if (!loadedSketches.some((sketch) => sketch.kind !== "root")) {
      loadedSketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
    }
    const loadedSketchIds = new Set(loadedSketches.map((sketch) => sketch.id));
    for (const sketch of loadedSketches) {
      if (sketch.kind === "root") continue;
      sketch.kind = "sketch";
      sketch.appearance = normalizeAppearance(sketch.appearance);
      sketch.visible = sketch.appearance.visible !== false;
      if (sketch.parentSketchId === sketch.id || !loadedSketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      if (sketch.parentSketchId == null) sketch.parentSketchId = ROOT_SKETCH_ID;
    }
    const fallbackSketchId = loadedSketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
    const normalizeSketchId = (sketchId) => {
      const id = sketchId == null ? fallbackSketchId : String(sketchId);
      if (id === ROOT_SKETCH_ID) return fallbackSketchId;
      return loadedSketchIds.has(id) ? id : fallbackSketchId;
    };

    const loadedBlockDefinitions = [];
    const loadedBlockDefinitionMeta = new Map();
    for (const rawDefinition of Array.isArray(data.blockDefinitions) ? data.blockDefinitions : []) {
      let definitionSketches = Array.isArray(rawDefinition.sketches) && rawDefinition.sketches.length > 0
        ? rawDefinition.sketches.map((sketch, index) => ({
            id: String(sketch.id || `S${index + 1}`),
            name: String(sketch.name || sketch.id || `Sketch-${index + 1}`),
            parentSketchId: sketch.parentSketchId == null ? null : String(sketch.parentSketchId),
            kind: sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID ? "root" : "sketch",
            appearance: normalizeAppearance(sketch.appearance || (sketch.visible === false ? { visible: false } : {})),
          }))
        : [
            { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} },
            { id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} },
          ];
      let definitionRoot = definitionSketches.find((sketch) => sketch.kind === "root" || sketch.id === ROOT_SKETCH_ID);
      if (!definitionRoot) definitionRoot = { id: ROOT_SKETCH_ID, name: ROOT_SKETCH_NAME, parentSketchId: null, kind: "root", appearance: {} };
      definitionSketches = [definitionRoot, ...definitionSketches.filter((sketch) => sketch !== definitionRoot && sketch.kind !== "root" && sketch.id !== ROOT_SKETCH_ID)];
      definitionRoot.id = ROOT_SKETCH_ID;
      definitionRoot.name = ROOT_SKETCH_NAME;
      definitionRoot.parentSketchId = null;
      definitionRoot.kind = "root";
      definitionRoot.appearance = normalizeAppearance(definitionRoot.appearance);
      definitionRoot.visible = true;
      if (!definitionSketches.some((sketch) => sketch.kind !== "root")) definitionSketches.push({ id: DEFAULT_SKETCH_ID, name: DEFAULT_SKETCH_NAME, parentSketchId: ROOT_SKETCH_ID, kind: "sketch", appearance: {} });
      const definitionSketchIds = new Set(definitionSketches.map((sketch) => sketch.id));
      const definitionFallbackSketchId = definitionSketches.find((sketch) => sketch.kind !== "root")?.id || DEFAULT_SKETCH_ID;
      for (const sketch of definitionSketches) {
        if (sketch.kind === "root") continue;
        sketch.kind = "sketch";
        sketch.appearance = normalizeAppearance(sketch.appearance);
        sketch.visible = sketch.appearance.visible !== false;
        sketch.parentSketchId = sketch.parentSketchId == null ? ROOT_SKETCH_ID : String(sketch.parentSketchId);
        if (sketch.parentSketchId === sketch.id || !definitionSketchIds.has(sketch.parentSketchId)) sketch.parentSketchId = ROOT_SKETCH_ID;
      }
      const normalizeDefinitionSketchId = (sketchId) => {
        const id = sketchId == null ? definitionFallbackSketchId : String(sketchId);
        return id !== ROOT_SKETCH_ID && definitionSketchIds.has(id) ? id : definitionFallbackSketchId;
      };
      const pointById = new Map();
      const points = (rawDefinition.points || []).map((rawPoint) => {
        const point = new Point(String(rawPoint.id), Number(rawPoint.x), Number(rawPoint.y), Boolean(rawPoint.fixed), rawPoint.kind === "explicit" ? "explicit" : "endpoint");
        point.sketchId = normalizeDefinitionSketchId(rawPoint.sketchId);
        point.appearance = normalizeAppearance(rawPoint.appearance);
        pointById.set(point.id, point);
        return point;
      });
      const lineById = new Map();
      const lines = (rawDefinition.lines || []).map((rawLine) => {
        const p1 = pointById.get(String(rawLine.p1));
        const p2 = pointById.get(String(rawLine.p2));
        if (!p1 || !p2) throw new Error(`ブロック ${rawDefinition.id} の線端点が見つかりません`);
        const line = new Line(String(rawLine.id), p1, p2, Boolean(rawLine.construction));
        line.sketchId = normalizeDefinitionSketchId(rawLine.sketchId || p1.sketchId || p2.sketchId);
        line.appearance = normalizeAppearance(rawLine.appearance);
        lineById.set(line.id, line);
        return line;
      });
      const primitiveById = new Map();
      const circles = (rawDefinition.circles || []).map((rawCircle) => {
        const center = pointById.get(String(rawCircle.center));
        if (!center) throw new Error(`ブロック ${rawDefinition.id} の円中心が見つかりません`);
        const circle = new Circle(String(rawCircle.id), center, Number(rawCircle.radius), Boolean(rawCircle.construction));
        circle.sketchId = normalizeDefinitionSketchId(rawCircle.sketchId || center.sketchId);
        circle.appearance = normalizeAppearance(rawCircle.appearance);
        primitiveById.set(circle.id, circle);
        return circle;
      });
      const arcs = (rawDefinition.arcs || []).map((rawArc) => {
        const center = pointById.get(String(rawArc.center));
        if (!center) throw new Error(`ブロック ${rawDefinition.id} の円弧中心が見つかりません`);
        const arc = new Arc(String(rawArc.id), center, Number(rawArc.radius), Number(rawArc.startAngle), Number(rawArc.endAngle), Boolean(rawArc.construction));
        arc.sketchId = normalizeDefinitionSketchId(rawArc.sketchId || center.sketchId);
        arc.appearance = normalizeAppearance(rawArc.appearance);
        primitiveById.set(arc.id, arc);
        return arc;
      });
      const definition = {
        id: String(rawDefinition.id),
        name: String(rawDefinition.name || rawDefinition.id || "Block"),
        parentDefinitionId: null,
        origin: { x: Number(rawDefinition.origin?.x) || 0, y: Number(rawDefinition.origin?.y) || 0 },
        sketches: definitionSketches,
        activeSketchId: normalizeDefinitionSketchId(rawDefinition.activeSketchId),
        parameters: Array.isArray(rawDefinition.parameters) ? rawDefinition.parameters.map((parameter) => ({ name: String(parameter?.name || ""), expression: String(parameter?.expression ?? "") })) : [],
        nextDimensionParameterIndex: Number(rawDefinition.nextDimensionParameterIndex) || 1,
        points,
        lines,
        circles,
        arcs,
        blockInstances: [],
        constraints: [],
        revision: Number(rawDefinition.revision) || 0,
      };
      loadedBlockDefinitions.push(definition);
      loadedBlockDefinitionMeta.set(definition.id, {
        rawDefinition,
        normalizeDefinitionSketchId,
        hasExplicitParentDefinitionId: Object.prototype.hasOwnProperty.call(rawDefinition, "parentDefinitionId"),
      });
    }
    const loadedDefinitionIds = new Set(loadedBlockDefinitions.map((definition) => definition.id));
    const loadedDefinitionById = (definitionId) => loadedBlockDefinitions.find((definition) => definition.id === definitionId) || null;
    const loadedDefinitionHasGeometry = (definition, visiting = new Set()) => {
      if (!definition || visiting.has(definition.id)) return false;
      if (definition.lines.length + definition.circles.length + definition.arcs.length > 0) return true;
      const next = new Set(visiting).add(definition.id);
      return definition.blockInstances.some((instance) => loadedDefinitionHasGeometry(loadedDefinitionById(instance.definitionId), next));
    };
    const loadedDefinitionGeometrySketchIds = (definition) => {
      if (!definition) return [];
      const ids = new Set([...definition.lines, ...definition.circles, ...definition.arcs].map((item) => String(item.sketchId)));
      for (const instance of definition.blockInstances) if (loadedDefinitionHasGeometry(loadedDefinitionById(instance.definitionId))) ids.add(String(instance.sketchId));
      return blockDefinitionDrawableSketchIds(definition).filter((id) => ids.has(id));
    };
    for (const definition of loadedBlockDefinitions) {
      const meta = loadedBlockDefinitionMeta.get(definition.id);
      definition.blockInstances = (meta.rawDefinition.blockInstances || [])
        .filter((instance) => loadedDefinitionIds.has(String(instance.definitionId)))
        .map((instance, index) => {
          const nestedDefinition = loadedDefinitionById(String(instance.definitionId));
          const drawableIds = blockDefinitionDrawableSketchIds(nestedDefinition);
          const enabled = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String).filter((id) => drawableIds.includes(id)) : drawableIds;
          return {
            id: String(instance.id || `BI${index + 1}`),
            definitionId: String(instance.definitionId),
            sketchId: meta.normalizeDefinitionSketchId(instance.sketchId),
            x: Number(instance.x) || 0,
            y: Number(instance.y) || 0,
            rotation: Number(instance.rotation) || 0,
            fixed: Boolean(instance.fixed),
            rotationLocked: Boolean(instance.rotationLocked),
            enabledSketchIds: [...new Set(enabled.length > 0 ? enabled : drawableIds)],
            appearanceOverride: normalizeAppearance(instance.appearanceOverride),
          };
        });
    }
    const loadedContainingDefinitionIds = new Map();
    for (const definition of loadedBlockDefinitions) {
      for (const instance of definition.blockInstances) {
        if (!loadedContainingDefinitionIds.has(instance.definitionId)) loadedContainingDefinitionIds.set(instance.definitionId, new Set());
        loadedContainingDefinitionIds.get(instance.definitionId).add(definition.id);
      }
    }
    for (const definition of loadedBlockDefinitions) {
      const meta = loadedBlockDefinitionMeta.get(definition.id);
      const inferredParents = [...(loadedContainingDefinitionIds.get(definition.id) || [])];
      if (inferredParents.length > 1) throw new Error(`子ブロック ${definition.name} が複数の親ブロックから参照されています`);
      if (meta.hasExplicitParentDefinitionId) {
        const explicitParentId = meta.rawDefinition.parentDefinitionId == null ? null : String(meta.rawDefinition.parentDefinitionId);
        if (explicitParentId && !loadedDefinitionIds.has(explicitParentId)) throw new Error(`子ブロック ${definition.name} の親ブロックが見つかりません`);
        if (explicitParentId === definition.id) throw new Error(`ブロック ${definition.name} が自身を親にしています`);
        if (inferredParents.length > 0 && inferredParents[0] !== explicitParentId) throw new Error(`子ブロック ${definition.name} は親ブロック以外から参照されています`);
        definition.parentDefinitionId = explicitParentId;
      } else {
        definition.parentDefinitionId = inferredParents[0] || null;
      }
    }
    const loadedCyclePath = (definitionId, path = [], complete = new Set()) => {
      const repeatedAt = path.indexOf(definitionId);
      if (repeatedAt >= 0) return [...path.slice(repeatedAt), definitionId];
      if (complete.has(definitionId)) return null;
      const definition = loadedDefinitionById(definitionId);
      if (!definition) return null;
      const nextPath = [...path, definitionId];
      for (const instance of definition.blockInstances) {
        const cycle = loadedCyclePath(instance.definitionId, nextPath, complete);
        if (cycle) return cycle;
      }
      complete.add(definitionId);
      return null;
    };
    for (const definition of loadedBlockDefinitions) {
      const cycle = loadedCyclePath(definition.id);
      if (cycle) throw new Error(`ブロックの循環参照があります: ${cycle.join(" → ")}`);
    }
    let repairedBlockConstraintCount = 0;
    for (const definition of loadedBlockDefinitions) {
      const meta = loadedBlockDefinitionMeta.get(definition.id);
      const pointById = new Map(definition.points.map((point) => [point.id, point]));
      const lineById = new Map(definition.lines.map((line) => [line.id, line]));
      const primitiveById = new Map([...definition.circles, ...definition.arcs].map((primitive) => [primitive.id, primitive]));
      for (const instance of definition.blockInstances) {
        const nestedDefinition = loadedDefinitionById(instance.definitionId);
        addBlockProjectionElementsToMaps(createBlockProjectionBundle(instance, nestedDefinition, null, { definitionResolver: loadedDefinitionById }), pointById, lineById, primitiveById);
      }
      definition.constraints = (meta.rawDefinition.constraints || []).map((rawConstraint) => {
        let constraint = null;
        try {
          constraint = deserializeConstraint(rawConstraint, pointById, lineById, primitiveById);
        } catch (_error) {
          constraint = null;
        }
        if (!constraint) {
          repairedBlockConstraintCount += 1;
          return null;
        }
        constraint.sketchId = meta.normalizeDefinitionSketchId(rawConstraint.sketchId || constraintSketchId(constraint));
        constraint.reference = Boolean(rawConstraint.reference);
        constraint.referenceSketchId = rawConstraint.referenceSketchId == null ? null : meta.normalizeDefinitionSketchId(rawConstraint.referenceSketchId);
        return constraint;
      }).filter(Boolean);
      prepareLoadedParameterNamespace(definition, sourceVersion, `${applicationText("ブロック", "Block")} ${definition.name}`);
    }
    const loadedBlockInstances = (Array.isArray(data.blockInstances) ? data.blockInstances : [])
      .filter((instance) => loadedDefinitionIds.has(String(instance.definitionId)))
      .map((instance, index) => ({
        id: String(instance.id || `BI${index + 1}`),
        definitionId: String(instance.definitionId),
        sketchId: normalizeSketchId(instance.sketchId),
        x: Number(instance.x) || 0,
        y: Number(instance.y) || 0,
        rotation: Number(instance.rotation) || 0,
        fixed: Boolean(instance.fixed),
        rotationLocked: Boolean(instance.rotationLocked),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.map(String) : null,
        appearanceOverride: normalizeAppearance(instance.appearanceOverride),
      }));
    for (const instance of loadedBlockInstances) {
      const definition = loadedDefinitionById(instance.definitionId);
      if (definition?.parentDefinitionId) throw new Error(`子ブロック ${definition.name} は親ブロック内でのみ使用できます`);
    }
    for (const instance of loadedBlockInstances) {
      const definition = loadedBlockDefinitions.find((item) => item.id === instance.definitionId);
      const drawableIds = blockDefinitionDrawableSketchIds(definition);
      const enabled = Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.filter((id) => drawableIds.includes(id)) : drawableIds;
      instance.enabledSketchIds = enabled.length > 0 ? [...new Set(enabled)] : loadedDefinitionGeometrySketchIds(definition);
    }
    const loadedAnnotations = normalizeAnnotations(data.annotations);

    const pointById = new Map();
    const points = [];
    const hasPointKind = data.points.some((p) => p.kind === "explicit" || p.kind === "endpoint");
    for (const p of data.points) {
      const point = new Point(String(p.id), Number(p.x), Number(p.y), Boolean(p.fixed), p.kind === "endpoint" ? "endpoint" : "explicit");
      point.sketchId = normalizeSketchId(p.sketchId);
      const appearance = normalizeAppearance(p.appearance);
      if (Object.keys(appearance).length > 0) point.appearance = appearance;
      points.push(point);
      pointById.set(point.id, point);
    }

    const lineById = new Map();
    const lines = [];
    for (const l of data.lines) {
      const p1 = pointById.get(String(l.p1));
      const p2 = pointById.get(String(l.p2));
      if (!p1 || !p2) throw new Error(`線 ${l.id} の端点が見つかりません`);
      const line = new Line(String(l.id), p1, p2, Boolean(l.construction));
      line.sketchId = normalizeSketchId(l.sketchId || p1.sketchId || p2.sketchId);
      const appearance = normalizeAppearance(l.appearance);
      if (Object.keys(appearance).length > 0) line.appearance = appearance;
      if (!hasPointKind) {
        p1.kind = "endpoint";
        p2.kind = "endpoint";
      }
      lines.push(line);
      lineById.set(line.id, line);
    }

    const circles = [];
    for (const c of data.circles || []) {
      const center = pointById.get(String(c.center));
      if (!center) throw new Error(`円 ${c.id} の中心点が見つかりません`);
      center.kind = "endpoint";
      let radius = Number(c.radius);
      if (!Number.isFinite(radius) && c.radiusPoint !== undefined) {
        const radiusPoint = pointById.get(String(c.radiusPoint));
        if (!radiusPoint) throw new Error(`円 ${c.id} の参照点が見つかりません`);
        radius = hypot2(radiusPoint.x - center.x, radiusPoint.y - center.y);
        if (!hasPointKind) radiusPoint.kind = "endpoint";
      }
      if (!Number.isFinite(radius) || radius < MIN_ORIENTATION_LENGTH) throw new Error(`円 ${c.id} の半径が正しくありません`);
      const circle = new Circle(String(c.id), center, radius, Boolean(c.construction));
      circle.sketchId = normalizeSketchId(c.sketchId || center.sketchId);
      const appearance = normalizeAppearance(c.appearance);
      if (Object.keys(appearance).length > 0) circle.appearance = appearance;
      circles.push(circle);
    }

    const arcs = [];
    for (const a of data.arcs || []) {
      const center = pointById.get(String(a.center));
      if (!center) throw new Error(`円弧 ${a.id} の中心点が見つかりません`);
      center.kind = "endpoint";
      let radius = Number(a.radius);
      let startAngle = Number(a.startAngle);
      let endAngle = Number(a.endAngle);
      if ((!Number.isFinite(radius) || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) && a.startPoint !== undefined && a.endPoint !== undefined) {
        const startPoint = pointById.get(String(a.startPoint));
        const endPoint = pointById.get(String(a.endPoint));
        if (!startPoint || !endPoint) throw new Error(`円弧 ${a.id} の参照点が見つかりません`);
        radius = hypot2(startPoint.x - center.x, startPoint.y - center.y);
        startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
        if (!hasPointKind) {
          startPoint.kind = "endpoint";
          endPoint.kind = "endpoint";
        }
      }
      if (!Number.isFinite(radius) || radius < MIN_ORIENTATION_LENGTH || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) throw new Error(`円弧 ${a.id} の形状が正しくありません`);
      const arc = new Arc(String(a.id), center, radius, startAngle, endAngle, Boolean(a.construction));
      arc.sketchId = normalizeSketchId(a.sketchId || center.sketchId);
      const appearance = normalizeAppearance(a.appearance);
      if (Object.keys(appearance).length > 0) arc.appearance = appearance;
      arcs.push(arc);
    }

    const primitiveById = new Map();
    for (const c of circles) primitiveById.set(c.id, c);
    for (const a of arcs) primitiveById.set(a.id, a);
    for (const instance of loadedBlockInstances) {
      const definition = loadedBlockDefinitions.find((item) => item.id === instance.definitionId);
      const bundle = createBlockProjectionBundle(instance, definition, null, { definitionResolver: loadedDefinitionById });
      for (const point of bundle.points) pointById.set(point.id, point);
      for (const line of bundle.lines) lineById.set(line.id, line);
      for (const primitive of [...bundle.circles, ...bundle.arcs]) primitiveById.set(primitive.id, primitive);
    }

    const constraints = [];
    for (const c of data.constraints) {
      const constraint = deserializeConstraint(c, pointById, lineById, primitiveById);
      if (!constraint) throw new Error(`未対応の制約です: ${c.type}`);
      constraint.sketchId = normalizeSketchId(c.sketchId || constraintSketchId(constraint));
      constraint.reference = Boolean(c.reference);
      constraint.referenceSketchId = c.referenceSketchId == null ? null : normalizeSketchId(c.referenceSketchId);
      constraints.push(constraint);
    }

    const loadedRootNamespace = {
      constraints,
      parameters: Array.isArray(data.parameters) ? data.parameters.map((parameter) => ({ name: String(parameter?.name || ""), expression: String(parameter?.expression ?? "") })) : [],
      nextDimensionParameterIndex: Number(data.nextDimensionParameterIndex) || 1,
    };
    prepareLoadedParameterNamespace(loadedRootNamespace, sourceVersion, applicationText("Document", "Document"));

    const retainedPoints = points.filter((p) => {
      if (p.kind !== "endpoint") return true;
      if (isPointUsedByLine(p, lines) || isPointUsedByCircle(p, circles) || isPointUsedByArc(p, arcs)) return true;
      return constraints.some((constraint) => constraintReferencesPoint(constraint, p));
    });

    resetModelState();
    model.documentName = loadedDocumentName;
    model.sketches.length = 0;
    model.sketches.push(...loadedSketches);
    model.activeSketchId = normalizeSketchId(data.activeSketchId);
    model.defaultAppearance = normalizeAppearance(data.defaultAppearance, { partial: false });
    model.defaultConstructionAppearance = normalizeConstructionAppearance(data.defaultConstructionAppearance, { partial: false });
    model.annotations = loadedAnnotations;
    model.blockDefinitions = loadedBlockDefinitions;
    model.blockInstances = loadedBlockInstances;
    invalidateBlockProjectionCache();
    model.points.push(...retainedPoints);
    model.lines.push(...lines);
    model.circles.push(...circles);
    model.arcs.push(...arcs);
    normalizeArcSweeps(model.arcs);
    model.constraints.push(...constraints);
    model.parameters = loadedRootNamespace.parameters;
    model.nextDimensionParameterIndex = loadedRootNamespace.nextDimensionParameterIndex;
    refreshReferenceConstraintValidity();
    const lineRepair = enforceMinimumLineLengths(model.lines);
    lastLoadLineRepairMessage =
      lineRepair.changed > 0 || lineRepair.failed > 0
        ? `短すぎる線を補正しました: ${lineRepair.changed}件${lineRepair.failed ? ` / 補正不能 ${lineRepair.failed}件` : ""}`
        : "";
    if (lastLoadLineRepairMessage) log(lastLoadLineRepairMessage);
    lastLoadBlockConstraintRepairMessage = repairedBlockConstraintCount > 0
      ? `参照先が見つからないブロック内部拘束を${repairedBlockConstraintCount}件解除しました`
      : "";
    if (lastLoadBlockConstraintRepairMessage) log(lastLoadBlockConstraintRepairMessage);
    ensureDimensionDefaults();
    reserveGeometryElementSequences({
      points: [...model.points, ...model.blockDefinitions.flatMap((definition) => definition.points)],
      lines: [...model.lines, ...model.blockDefinitions.flatMap((definition) => definition.lines)],
      circles: [...model.circles, ...model.blockDefinitions.flatMap((definition) => definition.circles)],
      arcs: [...model.arcs, ...model.blockDefinitions.flatMap((definition) => definition.arcs)],
    });
    sketchSeq = Math.max(
      nextSeq(model.sketches, "S"),
      ...model.blockDefinitions.map((definition) => nextSeq(definition.sketches || [], "S")),
    );
    annotationSeq = nextSeq(model.annotations, "AN");
    blockDefinitionSeq = nextSeq(model.blockDefinitions, "B");
    blockInstanceSeq = nextSeq([...model.blockInstances, ...model.blockDefinitions.flatMap((definition) => definition.blockInstances || [])], "BI");
    blockElementSeq = Math.max(1, ...model.blockDefinitions.flatMap((definition) => [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs].map((element) => Number(/^[PLCA](\d+)$/.exec(element.id || "")?.[1]) + 1 || 1)));
    ensureAppearanceState();
    ensureBlockState();
  }

  function exportFileData() {
    if (blockEditSession) {
      setHint("ブロック定義編集を終了してから保存してください", "error");
      return;
    }
    try {
      const data = JSON.stringify(serializeModel(), null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeDownloadBaseName(model.documentName)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setHint("ファイルとして保存しました");
      log("ファイルとして保存しました");
    } catch (err) {
      setHint(`ファイル保存に失敗しました: ${err.message}`);
      log(`ファイル保存に失敗しました: ${err.message}`);
    }
  }

  function importFileData(file) {
    if (!file) return Promise.resolve(false);
    if (blockEditSession) {
      setHint("ブロック定義編集を終了してから読み込んでください", "error");
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          loadModelData(JSON.parse(String(reader.result)), { documentNameOverride: fileNameStem(file.name) });
          solveAndRefresh("ファイル読み込み");
          updateDocumentNameUI();
          fitAllGeometryToViewport();
          draw();
          if (lastLoadBlockConstraintRepairMessage) setHint(lastLoadBlockConstraintRepairMessage);
          log(`ファイルを読み込みました: ${file.name}`);
          resolve(true);
        } catch (err) {
          setHint(`ファイル読み込みに失敗しました: ${err.message}`);
          log(`ファイル読み込みに失敗しました: ${err.message}`);
          resolve(false);
        }
      });
      reader.addEventListener("error", () => {
        setHint("ファイル読み込みに失敗しました");
        log("ファイル読み込みに失敗しました");
        resolve(false);
      });
      reader.readAsText(file);
    });
  }

  function pointAt(x, y) {
    return hitAnyPoint(x, y) || addPoint(x, y);
  }

  function endpointAt(x, y) {
    const endpoint = hitEndpointPoint(x, y);
    if (endpoint) return endpoint;
    const explicit = hitExplicitPoint(x, y);
    if (explicit) return addPoint(explicit.x, explicit.y, false, "endpoint");
    return addPoint(x, y, false, "endpoint");
  }

  function clearSnap() {
    activeSnap = null;
  }

  function clearSelection() {
    selectedPoints = [];
    selectedLines = [];
    selectedCircles = [];
    selectedArcs = [];
    selectedBlockInstances = [];
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    selectedAnnotation = null;
    constraintOperands = [];
    hoveredSketchIdentity = null;
    hoveredBlockInstance = null;
    hoveredSidebarItem = null;
    hoveredAnnotation = null;
  }

  function selectableSketchElement(item) {
    return isEditableSketchElement(item);
  }

  function exitLineMode() {
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    pointerPreview = null;
    trimPreview = null;
    offsetSource = null;
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("連続線を終了しました");
    updateUI();
    draw();
  }

  function exitDrawMode() {
    lineStartPoint = null;
    pointStartRollback = null;
    lineCompletionRollback = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    offsetSource = null;
    clearSnap();
    mode = "select";
    updateToolbar();
    setHint("選択・ドラッグモードに戻りました");
    updateUI();
    draw();
  }

  function hasActiveDrawOperation() {
    return Boolean(lineStartPoint || rectangleStartPoint || filletFirstLine || circleCenterPoint || arcCenterPoint || arcStartPoint || offsetSource);
  }

  function beginTransientLineStartRollback() {
    lineStartRollback = {
      pointLength: model.points.length,
      constraintLength: model.constraints.length,
      pointSeq,
      lineLength: model.lines.length,
    };
  }

  function clearTransientLineStartRollback() {
    lineStartRollback = null;
  }

  function beginTransientLineCompletionRollback() {
    lineCompletionRollback = {
      pointLength: model.points.length,
      constraintLength: model.constraints.length,
      lineLength: model.lines.length,
      pointSeq,
      lineSeq,
      completedEndpoint: null,
      completedLine: null,
      startRollback: lineStartRollback ? { ...lineStartRollback } : null,
      createdAt: performance.now(),
    };
  }

  function clearTransientLineCompletionRollback() {
    lineCompletionRollback = null;
  }

  function rollbackTransientLineCompletion() {
    if (!lineCompletionRollback) return false;
    const transientSnapshot = historySnapshot();
    const target = lineCompletionRollback.startRollback || lineCompletionRollback;
    model.points.length = target.pointLength;
    model.lines.length = target.lineLength ?? lineCompletionRollback.lineLength;
    model.constraints.length = target.constraintLength;
    pointSeq = target.pointSeq;
    lineSeq = lineCompletionRollback.lineSeq;
    constraintAnalysisState = null;
    lineCompletionRollback = null;
    lineStartRollback = null;
    if (!historyRestoring && undoStack.length > 1 && undoStack[undoStack.length - 1] === transientSnapshot) {
      undoStack.pop();
      redoStack = [];
      updateHistoryButtons();
    }
    return true;
  }

  function beginTransientPointRollback() {
    pointStartRollback = {
      pointLength: model.points.length,
      constraintLength: model.constraints.length,
      pointSeq,
      createdPoint: null,
      createdAt: performance.now(),
    };
  }

  function clearTransientPointRollback() {
    pointStartRollback = null;
  }

  function rollbackTransientPoint() {
    if (!pointStartRollback) return false;
    const transientSnapshot = historySnapshot();
    model.points.length = pointStartRollback.pointLength;
    model.constraints.length = pointStartRollback.constraintLength;
    pointSeq = pointStartRollback.pointSeq;
    constraintAnalysisState = null;
    pointStartRollback = null;
    if (!historyRestoring && undoStack.length > 1 && undoStack[undoStack.length - 1] === transientSnapshot) {
      undoStack.pop();
      redoStack = [];
      updateHistoryButtons();
    }
    return true;
  }

  function rollbackTransientLineStart() {
    if (!lineStartRollback) return false;
    if (model.lines.length === lineStartRollback.lineLength) {
      model.points.length = lineStartRollback.pointLength;
      model.constraints.length = lineStartRollback.constraintLength;
      pointSeq = lineStartRollback.pointSeq;
      constraintAnalysisState = null;
    }
    lineStartRollback = null;
    return true;
  }

  function cancelActiveDrawOperation() {
    rollbackTransientLineStart();
    clearTransientPointRollback();
    clearTransientLineCompletionRollback();
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    offsetSource = null;
    clearSnap();
    clearSelection();
    setHint("作図操作をキャンセルしました");
    updateUI();
    draw();
  }

  function sampleModel() {
    resetModelState();

    const A = addPoint(160, 160, true, "endpoint");
    const B = addPoint(300, 180, false, "endpoint");
    const C = addPoint(280, 290, false, "endpoint");
    const D = addPoint(140, 270, false, "endpoint");
    const AB = addLine(A, B);
    const BC = addLine(B, C);
    const CD = addLine(C, D);
    const DA = addLine(D, A);

    pushModelConstraint(new DistanceConstraint(A, B, 140));
    pushModelConstraint(new DistanceConstraint(B, C, 100));
    pushModelConstraint(new ParallelConstraint(AB, CD));
    pushModelConstraint(new ParallelConstraint(BC, DA));
    pushModelConstraint(new PerpendicularConstraint(AB, BC));
    ensureDimensionDefaults();

    solveAndRefresh("サンプル復元");
    log("サンプルを復元しました");
  }

  function resizeCanvas(options = {}) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (options.centerWorld && rect.width > 0 && rect.height > 0) {
      viewport.x = rect.width / 2 - options.centerWorld.x * viewport.scale;
      viewport.y = rect.height / 2 - options.centerWorld.y * viewport.scale;
    }
    draw();
  }

  function setWorkspacePanelCollapsed(side, collapsed) {
    const workspace = document.querySelector(".workspace");
    const button = document.getElementById(side === "explorer" ? "toggleExplorerPanelBtn" : "togglePropertiesPanelBtn");
    if (!workspace || !button) return;
    const centerWorld = currentCanvasCenterWorld();
    const className = `${side}-collapsed`;
    const label = side === "explorer" ? applicationText("エクスプローラー", "Explorer") : applicationText("プロパティ", "Properties");
    workspace.classList.toggle(className, collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    const actionLabel = applicationLanguage === "en" ? `${collapsed ? "Expand" : "Collapse"} ${label}` : `${label}を${collapsed ? "展開" : "最小化"}`;
    button.setAttribute("aria-label", actionLabel);
    button.title = actionLabel;
    resizeCanvas({ centerWorld });
  }

  function currentCanvasCenterWorld() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return screenToWorld({ x: rect.width / 2, y: rect.height / 2 });
  }

  function clampZoom(scale) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
  }

  function formatZoom(scale) {
    const percent = scale * 100;
    if (percent >= 1000000) return `${(percent / 1000000).toFixed(2)}M%`;
    if (percent >= 10000) return `${(percent / 1000).toFixed(1)}k%`;
    if (percent >= 1000) return `${percent.toFixed(0)}%`;
    if (percent >= 100) return `${percent.toFixed(0)}%`;
    if (percent >= 1) return `${percent.toFixed(1)}%`;
    return `${percent.toFixed(2)}%`;
  }

  function formatDisplayNumber(value, maxFractionDigits = 10, snapTolerance = DIMENSION_DISPLAY_PRECISION) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const displayDigits = Math.max(0, Math.min(10, maxFractionDigits));
    const floatingPointSlack = Number.EPSILON * Math.max(1, Math.abs(n)) * 8;
    const effectiveSnapTolerance = Math.max(0, snapTolerance) + floatingPointSlack;
    let rounded = Number(n.toFixed(displayDigits));
    let roundedDigits = displayDigits;
    for (let digits = 0; digits <= displayDigits; digits += 1) {
      const candidate = Number(n.toFixed(digits));
      if (candidate === 0 && n !== 0) continue;
      if (Math.abs(n - candidate) <= effectiveSnapTolerance) {
        rounded = candidate;
        roundedDigits = digits;
        break;
      }
    }
    if (Object.is(rounded, -0)) return "0";
    const formatted = rounded.toFixed(roundedDigits);
    if (!formatted.includes(".")) return formatted;
    return formatted.replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatDimensionLabel(value, suffix = "") {
    return `${formatDisplayNumber(value)}${suffix}`;
  }

  function formatMeasuredDimensionLabel(value, suffix = "") {
    return `${formatDisplayNumber(value, 10, MEASURED_DIMENSION_SNAP_TOLERANCE)}${suffix}`;
  }

  function canvasScreenPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function screenToWorld(p) {
    return {
      x: (p.x - viewport.x) / viewport.scale,
      y: (p.y - viewport.y) / viewport.scale,
    };
  }

  function worldToCanvasScreen(p) {
    return {
      x: p.x * viewport.scale + viewport.x,
      y: p.y * viewport.scale + viewport.y,
    };
  }

  function canvasPoint(e) {
    return screenToWorld(canvasScreenPoint(e));
  }

  function isPointUsedByLine(point, lines = model.lines) {
    return lines.some((line) => line.p1 === point || line.p2 === point);
  }

  function isAnyLineEndpoint(point) {
    return isPointUsedByLine(point, allGeometryLines());
  }

  function isPointUsedByCircle(point, circles = model.circles) {
    return circles.some((circle) => circle.center === point);
  }

  function isPointUsedByArc(point, arcs = model.arcs) {
    return arcs.some((arc) => arc.center === point);
  }

  function isPointUsedByPrimitive(point) {
    return isPointUsedByLine(point) || isPointUsedByCircle(point) || isPointUsedByArc(point);
  }

  function isEndpointPoint(point) {
    return point?.kind === "endpoint" || isPointUsedByPrimitive(point);
  }

  function isExplicitPoint(point) {
    return point?.kind !== "endpoint";
  }

  function isReferencePoint(point) {
    return Boolean(point?.kind === "endpoint" && !isPointUsedByPrimitive(point) && model.constraints.some((c) => c.enabled !== false && constraintReferencesPoint(c, point)));
  }

  function isPrimitiveCenterPoint(point) {
    return model.circles.some((circle) => circle.center === point) || model.arcs.some((arc) => arc.center === point);
  }

  function isStandalonePoint(point) {
    return isExplicitPoint(point) && !isPointUsedByPrimitive(point);
  }

  function hitPointByPredicate(x, y, predicate) {
    const radius = 10 / viewport.scale;
    for (let i = model.points.length - 1; i >= 0; i--) {
      const p = model.points[i];
      if (!isEditableSketchElement(p)) continue;
      if (!predicate(p)) continue;
      if (hypot2(p.x - x, p.y - y) <= radius) return p;
    }
    return null;
  }

  function hitEndpointPoint(x, y) {
    return hitPointByPredicate(x, y, (p) => (isEndpointPoint(p) && isPointUsedByPrimitive(p)) || isReferencePoint(p));
  }

  function hitExplicitPoint(x, y) {
    return hitPointByPredicate(x, y, isExplicitPoint);
  }

  function hitAnyPoint(x, y) {
    return hitEndpointPoint(x, y) || hitExplicitPoint(x, y);
  }

  function hitPoint(x, y) {
    return hitAnyPoint(x, y);
  }

  function rectFromPoints(a, b) {
    return {
      x1: Math.min(a.x, b.x),
      y1: Math.min(a.y, b.y),
      x2: Math.max(a.x, b.x),
      y2: Math.max(a.y, b.y),
    };
  }

  function pointInRect(p, rect) {
    return p.x >= rect.x1 && p.x <= rect.x2 && p.y >= rect.y1 && p.y <= rect.y2;
  }

  function bboxInRect(box, rect) {
    return box.x1 >= rect.x1 && box.x2 <= rect.x2 && box.y1 >= rect.y1 && box.y2 <= rect.y2;
  }

  function bboxIntersectsRect(box, rect) {
    return box.x2 >= rect.x1 && box.x1 <= rect.x2 && box.y2 >= rect.y1 && box.y1 <= rect.y2;
  }

  function lineBBox(line) {
    return {
      x1: Math.min(line.p1.x, line.p2.x),
      y1: Math.min(line.p1.y, line.p2.y),
      x2: Math.max(line.p1.x, line.p2.x),
      y2: Math.max(line.p1.y, line.p2.y),
    };
  }

  function primitiveBBox(primitive) {
    const r = primitive.radius();
    return {
      x1: primitive.center.x - r,
      y1: primitive.center.y - r,
      x2: primitive.center.x + r,
      y2: primitive.center.y + r,
    };
  }

  function mergeBounds(bounds, box) {
    if (!box) return bounds;
    const x1 = box.x1 ?? box.left;
    const y1 = box.y1 ?? box.top;
    const x2 = box.x2 ?? box.right;
    const y2 = box.y2 ?? box.bottom;
    if (![x1, y1, x2, y2].every(Number.isFinite)) return bounds;
    if (!bounds) return { x1, y1, x2, y2 };
    return {
      x1: Math.min(bounds.x1, x1),
      y1: Math.min(bounds.y1, y1),
      x2: Math.max(bounds.x2, x2),
      y2: Math.max(bounds.y2, y2),
    };
  }

  function sketchGeometryBounds(sketchId = activeSketchId()) {
    let bounds = null;
    for (const line of allGeometryLines()) {
      if (elementSketchId(line) === sketchId) bounds = mergeBounds(bounds, lineBBox(line));
    }
    for (const circle of allGeometryCircles()) {
      if (elementSketchId(circle) === sketchId) bounds = mergeBounds(bounds, primitiveBBox(circle));
    }
    for (const arc of allGeometryArcs()) {
      if (elementSketchId(arc) === sketchId) bounds = mergeBounds(bounds, primitiveBBox(arc));
    }
    for (const point of allGeometryPoints()) {
      if (elementSketchId(point) === sketchId) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
    return bounds;
  }

  function allGeometryBounds() {
    let bounds = null;
    for (const line of allGeometryLines()) bounds = mergeBounds(bounds, lineBBox(line));
    for (const circle of allGeometryCircles()) bounds = mergeBounds(bounds, primitiveBBox(circle));
    for (const arc of allGeometryArcs()) bounds = mergeBounds(bounds, primitiveBBox(arc));
    for (const point of allGeometryPoints()) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    return bounds;
  }

  function isVisibleOnCanvasGeometry(item) {
    return isVisibleSketchElement(item);
  }

  function visibleGeometryBounds() {
    let bounds = null;
    for (const line of allGeometryLines()) {
      if (isVisibleOnCanvasGeometry(line)) bounds = mergeBounds(bounds, lineBBox(line));
    }
    for (const circle of allGeometryCircles()) {
      if (isVisibleOnCanvasGeometry(circle)) bounds = mergeBounds(bounds, primitiveBBox(circle));
    }
    for (const arc of allGeometryArcs()) {
      if (isVisibleOnCanvasGeometry(arc)) bounds = mergeBounds(bounds, primitiveBBox(arc));
    }
    for (const point of allGeometryPoints()) {
      if (isVisibleOnCanvasGeometry(point)) bounds = mergeBounds(bounds, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
    return bounds;
  }

  function fitBoundsToViewport(bounds, paddingPx = 96) {
    if (!bounds) return false;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const width = Math.max(bounds.x2 - bounds.x1, MIN_LINE_LENGTH);
    const height = Math.max(bounds.y2 - bounds.y1, MIN_LINE_LENGTH);
    const availableWidth = Math.max(80, rect.width - paddingPx * 2);
    const availableHeight = Math.max(80, rect.height - paddingPx * 2);
    const nextScale = clampZoom(Math.min(availableWidth / width, availableHeight / height));
    const centerX = (bounds.x1 + bounds.x2) / 2;
    const centerY = (bounds.y1 + bounds.y2) / 2;
    viewport.scale = nextScale;
    viewport.x = rect.width / 2 - centerX * viewport.scale;
    viewport.y = rect.height / 2 - centerY * viewport.scale;
    return true;
  }

  function fitSketchToViewport(sketchId = activeSketchId(), paddingPx = 96) {
    return fitBoundsToViewport(sketchGeometryBounds(sketchId), paddingPx);
  }

  function fitAllGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(allGeometryBounds(), paddingPx);
  }

  function fitVisibleGeometryToViewport(paddingPx = 96) {
    return fitBoundsToViewport(visibleGeometryBounds(), paddingPx);
  }

  function screenBoxForBounds(bounds) {
    if (!bounds) return null;
    const p1 = worldToCanvasScreen({ x: bounds.x1, y: bounds.y1 });
    const p2 = worldToCanvasScreen({ x: bounds.x2, y: bounds.y2 });
    return {
      left: Math.min(p1.x, p2.x),
      right: Math.max(p1.x, p2.x),
      top: Math.min(p1.y, p2.y),
      bottom: Math.max(p1.y, p2.y),
    };
  }

  function captureSketchScreenFootprint(sketchId = activeSketchId()) {
    const bounds = sketchGeometryBounds(sketchId);
    const screenBox = screenBoxForBounds(bounds);
    if (!bounds || !screenBox) return null;
    return {
      bounds,
      screenBox,
      center: {
        x: (screenBox.left + screenBox.right) / 2,
        y: (screenBox.top + screenBox.bottom) / 2,
      },
      width: Math.max(screenBox.right - screenBox.left, 1),
      height: Math.max(screenBox.bottom - screenBox.top, 1),
    };
  }

  function restoreSketchScreenFootprint(sketchId, footprint) {
    if (!footprint) return false;
    const bounds = sketchGeometryBounds(sketchId);
    if (!bounds) return false;
    const worldWidth = bounds.x2 - bounds.x1;
    const worldHeight = bounds.y2 - bounds.y1;
    const scaleCandidates = [];
    if (worldWidth > MIN_LINE_LENGTH) scaleCandidates.push(footprint.width / worldWidth);
    if (worldHeight > MIN_LINE_LENGTH) scaleCandidates.push(footprint.height / worldHeight);
    if (scaleCandidates.length === 0) return false;
    const nextScale = clampZoom(Math.min(...scaleCandidates));
    const centerX = (bounds.x1 + bounds.x2) / 2;
    const centerY = (bounds.y1 + bounds.y2) / 2;
    viewport.scale = nextScale;
    viewport.x = footprint.center.x - centerX * viewport.scale;
    viewport.y = footprint.center.y - centerY * viewport.scale;
    return true;
  }

  function scalePointAbout(point, origin, scale) {
    point.x = origin.x + (point.x - origin.x) * scale;
    point.y = origin.y + (point.y - origin.y) * scale;
  }

  function scaleValueAbout(value, originValue, scale) {
    return originValue + (value - originValue) * scale;
  }

  function scaleDimensionAbout(dimension, origin, scale) {
    if (!dimension) return dimension;
    for (const key of ["x", "labelX"]) {
      if (Number.isFinite(dimension[key])) dimension[key] = scaleValueAbout(dimension[key], origin.x, scale);
    }
    for (const key of ["y", "labelY"]) {
      if (Number.isFinite(dimension[key])) dimension[key] = scaleValueAbout(dimension[key], origin.y, scale);
    }
    for (const key of ["offsetU", "offsetN", "labelOffsetU", "angleRadius", "angleLabelOffsetR", "angleLabelOffsetT"]) {
      if (Number.isFinite(dimension[key])) dimension[key] *= scale;
    }
    return dimension;
  }

  function currentTargetValue(target) {
    if (!target) return NaN;
    if (target.kind === "point-point") {
      if (target.dimensionAxis === "x") return Math.abs(target.p2.x - target.p1.x);
      if (target.dimensionAxis === "y") return Math.abs(target.p2.y - target.p1.y);
      return hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y);
    }
    if (target.kind === "line-length") return target.line.length();
    if (target.kind === "point-line") return Math.abs(signedPointLineDistance(target.point, target.line));
    if (target.kind === "line-line") return Math.abs(signedPointLineDistance(target.line1.p1, target.line2));
    if (target.kind === "radius") return target.primitive.radius();
    if (target.kind === "diameter") return target.primitive.radius() * 2;
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line) return Math.abs(signedPointLineDistance(target.offset.p1, target.source));
      return Math.abs(target.offset.radius() - target.source.radius());
    }
    return target.value;
  }

  function sketchHasReferenceConstraint(sketchId = activeSketchId()) {
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.reference);
  }

  function sketchHasFixedGeometry(sketchId = activeSketchId()) {
    if (model.points.some((point) => elementSketchId(point) === sketchId && point.fixed)) return true;
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint instanceof LineFixedConstraint);
  }

  function scaleSketchForFirstDimension(sketchId, target, targetValue, dimension) {
    if (!sketchId || target?.kind === "angle" || sketchHasReferenceConstraint(sketchId) || sketchHasFixedGeometry(sketchId)) return false;
    const current = currentTargetValue(target);
    if (!Number.isFinite(current) || current <= MIN_LINE_LENGTH || !Number.isFinite(targetValue) || targetValue <= 0) return false;
    const scale = targetValue / current;
    if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return false;
    const bounds = sketchGeometryBounds(sketchId);
    if (!bounds) return false;
    const origin = { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 };
    for (const point of model.points) {
      if (elementSketchId(point) === sketchId) scalePointAbout(point, origin, scale);
    }
    for (const circle of model.circles) {
      if (elementSketchId(circle) === sketchId) circle.radiusValue = Math.max(MIN_LINE_LENGTH, circle.radiusValue * scale);
    }
    for (const arc of model.arcs) {
      if (elementSketchId(arc) === sketchId) arc.radiusValue = Math.max(MIN_LINE_LENGTH, arc.radiusValue * scale);
    }
    scaleDimensionAbout(dimension, origin, scale);
    return true;
  }

  function arcEndpointDragValue(arc, endpoint, rawAngle) {
    const twoPi = Math.PI * 2;
    const maxSweep = twoPi - 1e-6;
    const prop = endpoint === "start" ? "startAngle" : "endAngle";
    const value = unwrapAngleNear(rawAngle, arc[prop]);
    const sweep = endpoint === "start" ? arc.endAngle - value : value - arc.startAngle;
    if (Math.abs(sweep) >= maxSweep) {
      // Stay on the same angular branch at the almost-full-circle boundary.
      // Returning the opposite endpoint collapses the sweep to zero and makes
      // a small pointer crossing jump most of the circumference.
      const direction = sweep < 0 ? -1 : 1;
      return endpoint === "start"
        ? arc.endAngle - direction * maxSweep
        : arc.startAngle + direction * maxSweep;
    }
    return value;
  }

  function normalizeArcSweep(arc) {
    const twoPi = Math.PI * 2;
    const sweep = arcSweep(arc);
    if (Math.abs(sweep) >= twoPi - 1e-9) {
      arc.endAngle = arc.startAngle;
      return true;
    }
    if (Math.abs(sweep) > 0 && Math.abs(sweep) * arc.radius() < MIN_ARC_LENGTH) {
      arc.endAngle = arc.startAngle;
      return true;
    }
    return false;
  }

  function normalizeArcSweeps(arcs = model.arcs) {
    let changed = 0;
    for (const arc of arcs) {
      if (normalizeArcSweep(arc)) changed += 1;
    }
    return changed;
  }

  function sameArcEndpoint(a, b) {
    return a?.arc === b?.arc && a?.endpoint === b?.endpoint;
  }

  function findArcEndpointFixedConstraint(arc, endpoint) {
    return model.constraints.find((c) => c.enabled !== false && c instanceof ArcEndpointFixedConstraint && c.arc === arc && c.endpoint === endpoint);
  }

  function findLineFixedConstraint(line) {
    return model.constraints.find((c) => c.enabled !== false && c instanceof LineFixedConstraint && c.line === line);
  }

  function pointLockedByLineFixed(point) {
    return model.constraints.some((c) => c.enabled !== false && c instanceof LineFixedConstraint && (c.line.p1 === point || c.line.p2 === point));
  }

  function hitLine(x, y) {
    const threshold = 7 / viewport.scale;
    for (let i = model.lines.length - 1; i >= 0; i--) {
      const l = model.lines[i];
      if (!isEditableSketchElement(l)) continue;
      if (distancePointToSegment(x, y, l) <= threshold) return l;
    }
    return null;
  }

  function hitCircle(x, y) {
    const threshold = 7 / viewport.scale;
    for (let i = model.circles.length - 1; i >= 0; i--) {
      const c = model.circles[i];
      if (!isEditableSketchElement(c)) continue;
      const d = hypot2(x - c.center.x, y - c.center.y);
      if (Math.abs(d - c.radius()) <= threshold) return c;
    }
    return null;
  }

  function hitArc(x, y) {
    const threshold = 7 / viewport.scale;
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const a = model.arcs[i];
      if (!isEditableSketchElement(a)) continue;
      const radius = a.radius();
      const d = hypot2(x - a.center.x, y - a.center.y);
      if (Math.abs(d - radius) > threshold) continue;
      const angle = Math.atan2(y - a.center.y, x - a.center.x);
      if (angleOnSignedSweep(angle, a.startAngle, a.endAngle)) return a;
    }
    return null;
  }

  function hitArcEndpoint(x, y) {
    const threshold = 10 / viewport.scale;
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const arc = model.arcs[i];
      if (!isEditableSketchElement(arc)) continue;
      for (const endpoint of ["end", "start"]) {
        const point = arcEndpointPoint(arc, endpoint);
        if (hypot2(point.x - x, point.y - y) <= threshold) return { arc, endpoint, point };
      }
    }
    return null;
  }

  function makeSnapCandidate(source, x, y, label, priority, data = {}) {
    if (data.line && priority === 1) data = { ...data, midpoint: true };
    const sketchTarget = data.point || data.line || data.primitive || data.arc;
    if (sketchTarget && !isActiveSketchElement(sketchTarget)) label = `${label} / ${sketchName(elementSketchId(sketchTarget))}`;
    return {
      x,
      y,
      label,
      priority,
      source,
      data,
      distance: hypot2(source.x - x, source.y - y),
    };
  }

  function addSnapCandidate(candidates, source, x, y, label, priority, data = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    candidates.push(makeSnapCandidate(source, x, y, label, priority, data));
  }

  function circlePointAtPointer(source, primitive) {
    const dx = source.x - primitive.center.x;
    const dy = source.y - primitive.center.y;
    const len = hypot2(dx, dy);
    if (len < 1e-12) return null;
    const r = primitive.radius();
    return { x: primitive.center.x + (dx / len) * r, y: primitive.center.y + (dy / len) * r };
  }

  function snapCandidates(source) {
    const candidates = [];
    for (const p of allGeometryPoints()) {
      if (!isVisibleSketchElement(p)) continue;
      if (p.blockProjection) addSnapCandidate(candidates, source, p.x, p.y, "ブロック点", 0, { point: p });
      else if (isReferencePoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "参照点", 0, { point: p });
      else if (isPrimitiveCenterPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "中心", 0, { point: p });
      else if (isEndpointPoint(p) && isPointUsedByPrimitive(p)) addSnapCandidate(candidates, source, p.x, p.y, "端点", 0, { point: p });
      else if (isExplicitPoint(p)) addSnapCandidate(candidates, source, p.x, p.y, "点", 0, { point: p });
    }
    for (const line of allGeometryLines()) {
      if (!isVisibleSketchElement(line)) continue;
      addSnapCandidate(candidates, source, (line.p1.x + line.p2.x) / 2, (line.p1.y + line.p2.y) / 2, "中点", 1, { line });
      const closest = closestPointOnSegment(source.x, source.y, line);
      addSnapCandidate(candidates, source, closest.x, closest.y, "線上", 2, { line });
    }
    for (const circle of allGeometryCircles()) {
      if (!isVisibleSketchElement(circle)) continue;
      addSnapCandidate(candidates, source, circle.center.x, circle.center.y, "中心", 0, { primitive: circle });
      const p = circlePointAtPointer(source, circle);
      if (p) addSnapCandidate(candidates, source, p.x, p.y, "円周", 2, { primitive: circle });
    }
    for (const arc of allGeometryArcs()) {
      if (!isVisibleSketchElement(arc)) continue;
      addSnapCandidate(candidates, source, arc.center.x, arc.center.y, "中心", 0, { primitive: arc });
      for (const endpoint of ["start", "end"]) {
        const p = arcEndpointPoint(arc, endpoint);
        addSnapCandidate(candidates, source, p.x, p.y, "端点", 0, { arc, endpoint });
      }
      const p = circlePointAtPointer(source, arc);
      if (p && angleOnSignedSweep(Math.atan2(p.y - arc.center.y, p.x - arc.center.x), arc.startAngle, arc.endAngle)) {
        addSnapCandidate(candidates, source, p.x, p.y, "円弧", 2, { arc });
      }
    }
    return candidates;
  }

  function snapForDrawing(p) {
    const threshold = 10 / viewport.scale;
    let best = null;
    for (const candidate of snapCandidates(p)) {
      if (candidate.distance > threshold) continue;
      if (
        !best ||
        candidate.priority < best.priority ||
        (candidate.priority === best.priority && candidate.distance < best.distance)
      ) {
        best = candidate;
      }
    }
    activeSnap = best;
    return best ? { x: best.x, y: best.y } : p;
  }

  function samePosition(a, b, tolerance = 1e-9) {
    return Boolean(a && b && hypot2(a.x - b.x, a.y - b.y) <= tolerance);
  }

  function addConstraintIfMissing(constraint, matches, options = {}) {
    if (!constraint) return false;
    if (model.constraints.some((c) => c.enabled !== false && matches(c))) return false;
    const sketchId = options.sketchId || activeSketchId();
    if (options.referenceSketchId) {
      if (!isReferenceSourceSketchId(options.referenceSketchId, sketchId) || wouldCreateReferenceCycle(sketchId, options.referenceSketchId)) return false;
      markReferenceConstraint(constraint, options.referenceSketchId, sketchId);
    }
    pushModelConstraint(constraint, sketchId);
    const duplicate = redundantConstraintInfo(constraint, constraintSketchId(constraint));
    if (duplicate?.redundant) {
      model.constraints = model.constraints.filter((item) => item !== constraint);
      constraintRedundancyState.constraints.delete(constraint);
      return false;
    }
    return true;
  }

  function snapTargetElement(snap) {
    if (!snap?.data) return null;
    const { point, line, primitive, arc } = snap.data;
    return point || line || primitive || arc || null;
  }

  function snapReferenceSketchId(snap) {
    const target = snapTargetElement(snap);
    if (!target || isActiveSketchElement(target)) return null;
    const sketchId = elementSketchId(target);
    return isReferenceSourceSketchId(sketchId) ? sketchId : null;
  }

  function snapCanCreateConstraint(snap) {
    const target = snapTargetElement(snap);
    return !target || isActiveSketchElement(target) || Boolean(snapReferenceSketchId(snap));
  }

  function addPointSnapConstraints(point, snap) {
    if (!point || !snap?.data) return 0;
    if (!snapCanCreateConstraint(snap)) return 0;
    const referenceSketchId = snapReferenceSketchId(snap);
    const options = referenceSketchId ? { referenceSketchId } : {};
    const { point: snapPoint, line, midpoint, primitive, arc, endpoint } = snap.data;
    let added = 0;
    if (snapPoint && snapPoint !== point) {
      added += addConstraintIfMissing(
        new CoincidentConstraint(point, snapPoint),
        (c) => c instanceof CoincidentConstraint && ((c.p1 === point && c.p2 === snapPoint) || (c.p1 === snapPoint && c.p2 === point)),
        options,
      ) ? 1 : 0;
    }
    if (line && midpoint) {
      added += addConstraintIfMissing(
        new PointOnLineMidpointConstraint(point, line),
        (c) => c instanceof PointOnLineMidpointConstraint && c.point === point && c.line === line,
        options,
      ) ? 1 : 0;
    } else if (line) {
      added += addConstraintIfMissing(
        new PointOnLineConstraint(point, line),
        (c) => c instanceof PointOnLineConstraint && c.point === point && c.line === line,
        options,
      ) ? 1 : 0;
    }
    if (primitive && primitive.center !== point) {
      added += addConstraintIfMissing(
        new PointOnCircleConstraint(point, primitive),
        (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === primitive,
        options,
      ) ? 1 : 0;
    }
    if (arc && endpoint) {
      added += addConstraintIfMissing(
        new ArcEndpointCoincidentConstraint(arc, endpoint, point),
        (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpoint && c.point === point,
        options,
      ) ? 1 : 0;
    } else if (arc) {
      added += addConstraintIfMissing(
        new PointOnCircleConstraint(point, arc),
        (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === arc,
        options,
      ) ? 1 : 0;
    }
    return added;
  }

  function addArcEndpointSnapConstraints(arc, endpointName, snap) {
    if (!arc || !snap?.data) return 0;
    if (!snapCanCreateConstraint(snap)) return 0;
    const referenceSketchId = snapReferenceSketchId(snap);
    const options = referenceSketchId ? { referenceSketchId } : {};
    const { point, line, midpoint, primitive, arc: snapArc, endpoint } = snap.data;
    let added = 0;
    if (point) {
      added += addConstraintIfMissing(
        new ArcEndpointCoincidentConstraint(arc, endpointName, point),
        (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpointName && c.point === point,
        options,
      ) ? 1 : 0;
    }
    if (line && midpoint) {
      const ref = addPoint(snap.x, snap.y, false, "endpoint");
      added += addPointSnapConstraints(ref, snap);
      added += addConstraintIfMissing(
        new ArcEndpointCoincidentConstraint(arc, endpointName, ref),
        (c) => c instanceof ArcEndpointCoincidentConstraint && c.arc === arc && c.endpoint === endpointName && c.point === ref,
      ) ? 1 : 0;
    } else if (line) {
      added += addConstraintIfMissing(
        new ArcEndpointOnLineConstraint(arc, endpointName, line),
        (c) => c instanceof ArcEndpointOnLineConstraint && c.arc === arc && c.endpoint === endpointName && c.line === line,
        options,
      ) ? 1 : 0;
    }
    if (primitive && primitive !== arc) {
      added += addConstraintIfMissing(
        new ArcEndpointOnCircleConstraint(arc, endpointName, primitive),
        (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpointName && c.primitive === primitive,
        options,
      ) ? 1 : 0;
    }
    if (snapArc && endpoint) {
      added += addConstraintIfMissing(
        new ArcEndpointArcEndpointCoincidentConstraint(arc, endpointName, snapArc, endpoint),
        (c) =>
          c instanceof ArcEndpointArcEndpointCoincidentConstraint &&
          ((c.a === arc && c.endpointA === endpointName && c.b === snapArc && c.endpointB === endpoint) ||
            (c.a === snapArc && c.endpointA === endpoint && c.b === arc && c.endpointB === endpointName)),
        options,
      ) ? 1 : 0;
    } else if (snapArc && snapArc !== arc) {
      added += addConstraintIfMissing(
        new ArcEndpointOnCircleConstraint(arc, endpointName, snapArc),
        (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpointName && c.primitive === snapArc,
        options,
      ) ? 1 : 0;
    }
    return added;
  }

  function addCircleBoundarySnapConstraints(circle, snap) {
    if (!circle || !snap?.data) return 0;
    if (!snapCanCreateConstraint(snap)) return 0;
    const referenceSketchId = snapReferenceSketchId(snap);
    const options = referenceSketchId ? { referenceSketchId } : {};
    const { point, line, primitive, arc, endpoint } = snap.data;
    let added = 0;
    if (point) {
      added += addConstraintIfMissing(
        new PointOnCircleConstraint(point, circle),
        (c) => c instanceof PointOnCircleConstraint && c.point === point && c.primitive === circle,
        options,
      ) ? 1 : 0;
    } else if (arc && endpoint) {
      added += addConstraintIfMissing(
        new ArcEndpointOnCircleConstraint(arc, endpoint, circle),
        (c) => c instanceof ArcEndpointOnCircleConstraint && c.arc === arc && c.endpoint === endpoint && c.primitive === circle,
        options,
      ) ? 1 : 0;
    } else {
      const ref = addPoint(snap.x, snap.y, false, "endpoint");
      added += addPointSnapConstraints(ref, snap);
      added += addConstraintIfMissing(
        new PointOnCircleConstraint(ref, circle),
        (c) => c instanceof PointOnCircleConstraint && c.point === ref && c.primitive === circle,
      ) ? 1 : 0;
      if (primitive && primitive !== circle) {
        added += addConstraintIfMissing(
          new PointOnCircleConstraint(ref, primitive),
          (c) => c instanceof PointOnCircleConstraint && c.point === ref && c.primitive === primitive,
          options,
        ) ? 1 : 0;
      }
    }
    return added;
  }

  function hitDimension(x, y, { activeOnly = true } = {}) {
    const threshold = 12 / viewport.scale;
    for (let i = model.constraints.length - 1; i >= 0; i--) {
      const constraint = model.constraints[i];
      if (activeOnly && !isActiveSketchConstraint(constraint)) continue;
      if (!isVisibleSketchId(constraintSketchId(constraint))) continue;
      const target = targetFromConstraint(constraint);
      if (!target) continue;
      const dimension = constraint.dimension || defaultDimensionForTarget(target);
      if (!viewState.constraintStatus && dimension?.display?.visible === false) continue;
      const layout = dimensionLayout(target, dimension);
      if (!layout) continue;
      if (hypot2(x - layout.text.x, y - layout.text.y) <= threshold * 2.2) {
        return { constraint, target, dimension, part: "label" };
      }
      if (distancePointToSegmentPoints(x, y, layout.hitA, layout.hitB) <= threshold * 1.4) {
        return { constraint, target, dimension, part: "line" };
      }
    }
    return null;
  }

  function linesAreParallel(l1, l2) {
    if (!lineHasDirection(l1) || !lineHasDirection(l2)) return false;
    const a = lineUnit(l1);
    const b = lineUnit(l2);
    return Math.abs(a.x * b.y - a.y * b.x) < 1e-3;
  }

  function signedAngleBetweenLines(line1, line2) {
    return normalizeAngleSigned(lineAngle(line2) - lineAngle(line1));
  }

  function axisAngleBetweenLines(line1, line2) {
    if (!lineHasDirection(line1) || !lineHasDirection(line2)) return 0;
    const a = lineUnit(line1);
    const b = lineUnit(line2);
    const dot = a.x * b.x + a.y * b.y;
    return Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  function angleDimensionSweep(target) {
    return signedAngleBetweenLines(target.line1, target.line2);
  }

  function angleDimensionCandidate(target, startFlip = 0, endFlip = 0) {
    const start = lineAngle(target.line1) + (startFlip ? Math.PI : 0);
    const endAngle = lineAngle(target.line2) + (endFlip ? Math.PI : 0);
    const signed = normalizeAngleSigned(endAngle - start);
    if (Math.abs(signed) < 1e-9 || Math.abs(Math.abs(signed) - Math.PI) < 1e-9) return null;
    return { start, end: start + signed, signed, mid: start + signed / 2, startFlip, endFlip };
  }

  function angleDimensionAngles(target, anchor = null, dimension = null) {
    if (dimension && Number.isInteger(dimension.angleStartFlip) && Number.isInteger(dimension.angleEndFlip)) {
      const stored = angleDimensionCandidate(target, dimension.angleStartFlip, dimension.angleEndFlip);
      if (stored) return stored;
    }
    const fallbackSigned = angleDimensionSweep(target);
    const baseStart = lineAngle(target.line1);
    const fallback = {
      start: baseStart,
      end: baseStart + fallbackSigned,
      signed: fallbackSigned,
      mid: baseStart + fallbackSigned / 2,
      startFlip: 0,
      endFlip: fallbackSigned === signedAngleBetweenLines(target.line1, target.line2) ? 0 : 1,
    };
    if (!anchor) return fallback;
    const vertex = lineIntersection(target.line1, target.line2);
    if (!vertex) return fallback;
    const anchorAngle = Math.atan2(anchor.y - vertex.y, anchor.x - vertex.x);
    let best = fallback;
    let bestScore = Infinity;
    for (const startFlip of [0, 1]) {
      for (const endFlip of [0, 1]) {
        const candidate = angleDimensionCandidate(target, startFlip, endFlip);
        if (!candidate) continue;
        const score = Math.abs(normalizeAngleSigned(candidate.mid - anchorAngle));
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }
    return best;
  }

  function angleDegrees(radians) {
    return Math.abs((radians * 180) / Math.PI);
  }

  function selectedPrimitives() {
    return [...selectedCircles, ...selectedArcs];
  }

  function primitiveId(primitive) {
    return primitive?.id || "";
  }

  function isPrimitive(item) {
    return item instanceof Circle || item instanceof Arc;
  }

  function circlePointAtAngle(primitive, angle) {
    return {
      x: primitive.center.x + Math.cos(angle) * primitive.radius(),
      y: primitive.center.y + Math.sin(angle) * primitive.radius(),
    };
  }

  function distanceTargetFromSelection() {
    const primitives = selectedPrimitives();
    if (selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 1) {
      const [primitive] = primitives;
      if (primitive instanceof Circle) return { kind: "diameter", primitive, value: primitive.radius() * 2 };
      return { kind: "radius", primitive, value: primitive.radius() };
    }
    if (selectedPoints.length === 2 && selectedLines.length === 0) {
      const [p1, p2] = selectedPoints;
      return { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
    }
    if (selectedPoints.length === 0 && selectedLines.length === 1) {
      const [line] = selectedLines;
      return { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
    }
    if (selectedPoints.length === 1 && selectedLines.length === 1) {
      const [point] = selectedPoints;
      const [line] = selectedLines;
      if (!lineHasDirection(line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
      return { kind: "point-line", point, line, value: Math.abs(signedPointLineDistance(point, line)) };
    }
    if (selectedPoints.length === 0 && selectedLines.length === 2) {
      const [line1, line2] = selectedLines;
      if (!lineHasDirection(line1) || !lineHasDirection(line2)) return { kind: "invalid", reason: "線-線寸法の対象線が短すぎます" };
      if (!linesAreParallel(line1, line2)) {
        const signedValue = angleDimensionSweep({ line1, line2 });
        return { kind: "angle", line1, line2, value: angleDegrees(axisAngleBetweenLines(line1, line2)), signedValue };
      }
      return { kind: "line-line", line1, line2, value: Math.abs(signedPointLineDistance(line2.p1, line1)) };
    }
    return null;
  }

  function hitBlockInstance(x, y, editableOnly = true) {
    const threshold = 8 / viewport.scale;
    for (let i = model.blockInstances.length - 1; i >= 0; i--) {
      const instance = model.blockInstances[i];
      if (editableOnly && !isEditableSketchId(instance.sketchId)) continue;
      if (!isVisibleSketchId(instance.sketchId)) continue;
      const bundle = blockProjectionBundle(instance);
      if (bundle.points.some((point) => hypot2(point.x - x, point.y - y) <= threshold)) return instance;
      if (bundle.lines.some((line) => distancePointToSegment(x, y, line) <= threshold)) return instance;
      if (bundle.circles.some((circle) => Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold)) return instance;
      if (bundle.arcs.some((arc) => Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(Math.atan2(y - arc.center.y, x - arc.center.x), arc.startAngle, arc.endAngle))) return instance;
    }
    return null;
  }

  function hitBlockRotationHandle(x, y) {
    return null;
  }

  function hitBlockProjectionOperand(x, y) {
    const threshold = 8 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    for (const bundle of blockProjectionBundles().slice().reverse()) {
      if (!isVisibleSketchId(bundle.instance.sketchId)) continue;
      const relation = operandRelationForSketch(bundle.instance.sketchId);
      if (!relation) continue;
      for (const point of bundle.points.slice().reverse()) {
        if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("point", { point });
      }
      for (const line of bundle.lines.slice().reverse()) {
        if (distancePointToSegment(x, y, line) <= threshold) return makeConstraintOperand("line", { line });
      }
      for (const circle of bundle.circles.slice().reverse()) {
        if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return makeConstraintOperand("primitive", { primitive: circle });
      }
      for (const arc of bundle.arcs.slice().reverse()) {
        for (const endpoint of ["start", "end"]) {
          const point = arcEndpointPoint(arc, endpoint);
          if (hypot2(point.x - x, point.y - y) <= pointThreshold) return makeConstraintOperand("arc-endpoint", { arc, endpoint });
        }
        const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
        if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return makeConstraintOperand("primitive", { primitive: arc });
      }
    }
    return null;
  }

  function distanceTargetFromOperands(operands) {
    const points = operands.filter((operand) => operand.kind === "point").map((operand) => operand.point);
    const lines = operands.filter((operand) => operand.kind === "line").map((operand) => operand.line);
    const primitives = operands.filter((operand) => operand.kind === "primitive").map((operand) => operand.primitive);
    if (points.length === 0 && lines.length === 0 && primitives.length === 1) {
      const [primitive] = primitives;
      if (primitive instanceof Circle) return { kind: "diameter", primitive, value: primitive.radius() * 2 };
      return { kind: "radius", primitive, value: primitive.radius() };
    }
    if (points.length === 2 && lines.length === 0 && primitives.length === 0) {
      const [p1, p2] = points;
      return { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
    }
    if (points.length === 0 && lines.length === 1 && primitives.length === 0) {
      const [line] = lines;
      return { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
    }
    if (points.length === 1 && lines.length === 1 && primitives.length === 0) {
      const [point] = points;
      const [line] = lines;
      if (!lineHasDirection(line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
      return { kind: "point-line", point, line, value: Math.abs(signedPointLineDistance(point, line)) };
    }
    if (points.length === 0 && lines.length === 2 && primitives.length === 0) {
      const [line1, line2] = lines;
      if (!lineHasDirection(line1) || !lineHasDirection(line2)) return { kind: "invalid", reason: "線-線寸法の対象線が短すぎます" };
      if (!linesAreParallel(line1, line2)) {
        const signedValue = angleDimensionSweep({ line1, line2 });
        return { kind: "angle", line1, line2, value: angleDegrees(axisAngleBetweenLines(line1, line2)), signedValue };
      }
      return { kind: "line-line", line1, line2, value: Math.abs(signedPointLineDistance(line2.p1, line1)) };
    }
    return null;
  }

  function targetDirection(target) {
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line && target.offset instanceof Line) {
        const dx = target.offset.p1.x - target.source.p1.x;
        const dy = target.offset.p1.y - target.source.p1.y;
        const len = hypot2(dx, dy);
        if (len > 1e-12) return { x: dx / len, y: dy / len };
        const normal = lineNormal(target.source);
        return { x: normal.x * (target.sign || 1), y: normal.y * (target.sign || 1) };
      }
      const defaultAngle = target.source instanceof Arc ? (target.source.startAngle + target.source.endAngle) / 2 : 0;
      const anchor = target.dimensionAnchor || circlePointAtAngle(target.offset, defaultAngle);
      const dx = anchor.x - target.source.center.x;
      const dy = anchor.y - target.source.center.y;
      const len = hypot2(dx, dy);
      if (len > 1e-12) return { x: dx / len, y: dy / len };
      return { x: 1, y: 0 };
    }
    if (target.kind === "radius" || target.kind === "diameter") {
      const defaultAngle = target.primitive instanceof Arc ? (target.primitive.startAngle + target.primitive.endAngle) / 2 : 0;
      const anchor = target.dimensionAnchor || circlePointAtAngle(target.primitive, defaultAngle);
      const dx = anchor.x - target.primitive.center.x;
      const dy = anchor.y - target.primitive.center.y;
      const len = hypot2(dx, dy);
      if (len > 1e-12) return { x: dx / len, y: dy / len };
      return { x: 1, y: 0 };
    }
    if (target.kind === "point-point" || target.kind === "line-length") {
      if (target.dimensionAxis === "x") return { x: 1, y: 0 };
      if (target.dimensionAxis === "y") return { x: 0, y: 1 };
      return lineUnit({ dx: () => target.p2.x - target.p1.x, dy: () => target.p2.y - target.p1.y, length: () => hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y) });
    }
    if (target.kind === "point-line") {
      const projection = projectPointToLine(target.point, target.line);
      const dx = target.point.x - projection.x;
      const dy = target.point.y - projection.y;
      const len = hypot2(dx, dy);
      if (len > 1e-12) return { x: dx / len, y: dy / len };
      return lineNormal(target.line);
    }
    if (target.kind === "line-line") {
      const projection = projectPointToLine(target.line1.p1, target.line2);
      const dx = target.line1.p1.x - projection.x;
      const dy = target.line1.p1.y - projection.y;
      const len = hypot2(dx, dy);
      if (len > 1e-12) return { x: dx / len, y: dy / len };
      return lineNormal(target.line1);
    }
    return { x: 1, y: 0 };
  }

  function targetPointsForDimension(target, anchor = null) {
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line && target.offset instanceof Line) {
        const guide = anchor || {
          x: (target.source.p1.x + target.source.p2.x + target.offset.p1.x + target.offset.p2.x) / 4,
          y: (target.source.p1.y + target.source.p2.y + target.offset.p1.y + target.offset.p2.y) / 4,
        };
        const sourcePoint = projectPointToLine(guide, target.source);
        const offsetPoint = projectPointToLine(guide, target.offset);
        return [sourcePoint, offsetPoint];
      }
      const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
      return [
        {
          x: target.source.center.x + dir.x * target.source.radius(),
          y: target.source.center.y + dir.y * target.source.radius(),
        },
        {
          x: target.offset.center.x + dir.x * target.offset.radius(),
          y: target.offset.center.y + dir.y * target.offset.radius(),
        },
      ];
    }
    if (target.kind === "radius") {
      const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
      return [target.primitive.center, { x: target.primitive.center.x + dir.x * target.primitive.radius(), y: target.primitive.center.y + dir.y * target.primitive.radius() }];
    }
    if (target.kind === "diameter") {
      const dir = targetDirection({ ...target, dimensionAnchor: anchor || target.dimensionAnchor });
      return [
        { x: target.primitive.center.x - dir.x * target.primitive.radius(), y: target.primitive.center.y - dir.y * target.primitive.radius() },
        { x: target.primitive.center.x + dir.x * target.primitive.radius(), y: target.primitive.center.y + dir.y * target.primitive.radius() },
      ];
    }
    if (target.kind === "point-point" || target.kind === "line-length") return [target.p1, target.p2];
    if (target.kind === "point-line") return [target.point, projectPointToSegmentPoint(anchor || target.point, target.line)];
    if (target.kind === "line-line") {
      return [nearestLineEndpoint(target.line1, anchor), nearestLineEndpoint(target.line2, anchor)];
    }
    return [];
  }

  function nearestLineEndpoint(line, anchor = null) {
    if (!anchor) return line.p1;
    const d1 = hypot2(line.p1.x - anchor.x, line.p1.y - anchor.y);
    const d2 = hypot2(line.p2.x - anchor.x, line.p2.y - anchor.y);
    return d1 <= d2 ? line.p1 : line.p2;
  }

  function dimensionBasis(target) {
    const d = targetDirection(target);
    return { d, n: { x: -d.y, y: d.x } };
  }

  function dimensionBasePoint(target) {
    const points = targetPointsForDimension(target);
    if (points.length < 2) return { x: 0, y: 0 };
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  function dominantDimensionAxis(target) {
    if (target.kind !== "point-point") return null;
    return Math.abs(target.p2.x - target.p1.x) >= Math.abs(target.p2.y - target.p1.y) ? "x" : "y";
  }

  function dimensionAxisForAnchor(target, anchor, options = {}) {
    if (target.kind !== "point-point") return target.dimensionAxis || null;
    if (target.dimensionAxis) return target.dimensionAxis;
    if (options.allowPointAxis === false) return null;
    const lineDistance = distancePointToSegmentPoints(anchor.x, anchor.y, target.p1, target.p2);
    if (lineDistance <= 10 / viewport.scale) return null;
    const base = dimensionBasePoint(target);
    const dx = anchor.x - base.x;
    const dy = anchor.y - base.y;
    return Math.abs(dy) >= Math.abs(dx) ? "x" : "y";
  }

  function dimensionFromAnchor(target, anchor, options = {}) {
    if (target.kind === "angle") {
      const vertex = lineIntersection(target.line1, target.line2);
      const angles = angleDimensionAngles(target, anchor);
      return {
        x: anchor.x,
        y: anchor.y,
        offsetU: NaN,
        offsetN: NaN,
        labelOffsetU: 0,
        axis: null,
        angleStartFlip: angles.startFlip,
        angleEndFlip: angles.endFlip,
        angleRadius: vertex ? Math.max(14 / viewport.scale, hypot2(anchor.x - vertex.x, anchor.y - vertex.y)) : NaN,
      };
    }
    const axis = dimensionAxisForAnchor(target, anchor, options);
    const basisTarget = axis ? { ...target, dimensionAxis: axis } : target;
    const base = dimensionBasePoint(target);
    const { d, n } = dimensionBasis(basisTarget);
    const dx = anchor.x - base.x;
    const dy = anchor.y - base.y;
    return {
      x: anchor.x,
      y: anchor.y,
      offsetU: dx * d.x + dy * d.y,
      offsetN: dx * n.x + dy * n.y,
      labelOffsetU: 0,
      axis,
    };
  }

  function angleDimensionLabelBasis(target, dimension) {
    if (target?.kind !== "angle" || !dimension) return null;
    const vertex = lineIntersection(target.line1, target.line2);
    if (!vertex) return null;
    const anchor = dimensionAnchor(target, dimension);
    const radius = Math.max(14 / viewport.scale, hypot2(anchor.x - vertex.x, anchor.y - vertex.y));
    const { mid } = angleDimensionAngles(target, anchor, dimension);
    const radial = { x: Math.cos(mid), y: Math.sin(mid) };
    const tangent = { x: -radial.y, y: radial.x };
    return {
      vertex,
      radius,
      radial,
      tangent,
      arcPoint: {
        x: vertex.x + radial.x * radius,
        y: vertex.y + radial.y * radius,
      },
    };
  }

  function angleDimensionLabelOffsets(target, dimension) {
    if (!dimension) return null;
    if (Number.isFinite(dimension.angleLabelOffsetR) && Number.isFinite(dimension.angleLabelOffsetT)) {
      return { radial: dimension.angleLabelOffsetR, tangent: dimension.angleLabelOffsetT };
    }
    if (!Number.isFinite(dimension.labelX) || !Number.isFinite(dimension.labelY)) return null;
    const basis = angleDimensionLabelBasis(target, dimension);
    if (!basis) return null;
    const dx = dimension.labelX - basis.arcPoint.x;
    const dy = dimension.labelY - basis.arcPoint.y;
    return {
      radial: dx * basis.radial.x + dy * basis.radial.y,
      tangent: dx * basis.tangent.x + dy * basis.tangent.y,
    };
  }

  function setAngleDimensionLabelOffsets(dimension, offsets) {
    if (!dimension || !offsets) return dimension;
    dimension.angleLabelOffsetR = offsets.radial;
    dimension.angleLabelOffsetT = offsets.tangent;
    dimension.angleLabelPlacementVersion = 2;
    delete dimension.labelX;
    delete dimension.labelY;
    return dimension;
  }

  function migrateAngleDimensionLabelPlacement(target, dimension) {
    if (target?.kind !== "angle" || !dimension) return dimension;
    if (Number.isFinite(dimension.angleLabelOffsetR) && Number.isFinite(dimension.angleLabelOffsetT)) {
      if (dimension.angleLabelPlacementVersion !== 2) {
        dimension.angleLabelOffsetR = 0;
        dimension.angleLabelOffsetT = 0;
      }
      dimension.angleLabelPlacementVersion = 2;
      delete dimension.labelX;
      delete dimension.labelY;
      return dimension;
    }
    return setAngleDimensionLabelOffsets(dimension, angleDimensionLabelOffsets(target, dimension));
  }

  function dimensionWithLabelAt(target, dimension, labelPoint) {
    if (!target || !dimension || !labelPoint) return dimension;
    if (target.kind === "angle") {
      const next = { ...dimension };
      const basis = angleDimensionLabelBasis(target, next);
      if (!basis) return next;
      const dx = labelPoint.x - basis.arcPoint.x;
      const dy = labelPoint.y - basis.arcPoint.y;
      return setAngleDimensionLabelOffsets(next, {
        radial: dx * basis.radial.x + dy * basis.radial.y,
        tangent: dx * basis.tangent.x + dy * basis.tangent.y,
      });
    }
    const anchor = dimensionAnchor(target, dimension);
    const basisTarget = { ...target, dimensionAxis: storedDimensionAxis(target, dimension) };
    const radial = target.kind === "radius" || target.kind === "diameter" || (target.kind === "offset-distance" && !(target.source instanceof Line));
    const d = radial ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
    const points = targetPointsForDimension(target, anchor);
    if (points.length < 2) return dimension;
    const projections = points.map((p) => (p.x - anchor.x) * d.x + (p.y - anchor.y) * d.y);
    const midpointProjection = (Math.min(...projections) + Math.max(...projections)) / 2;
    const labelProjection = (labelPoint.x - anchor.x) * d.x + (labelPoint.y - anchor.y) * d.y;
    return { ...dimension, labelOffsetU: labelProjection - midpointProjection };
  }

  function angleDimensionFromLabelPoint(target, labelPoint, labelOffsets = null) {
    if (target?.kind !== "angle" || !labelPoint) return null;
    const offsets = labelOffsets || { radial: 14 / viewport.scale, tangent: 0 };
    const vertex = lineIntersection(target.line1, target.line2);
    if (!vertex) return null;
    const angles = angleDimensionAngles(target, labelPoint);
    const radial = { x: Math.cos(angles.mid), y: Math.sin(angles.mid) };
    const projectedLabelRadius =
      (labelPoint.x - vertex.x) * radial.x +
      (labelPoint.y - vertex.y) * radial.y;
    const radius = Math.max(14 / viewport.scale, projectedLabelRadius - offsets.radial);
    const anchor = {
      x: vertex.x + radial.x * radius,
      y: vertex.y + radial.y * radius,
    };
    const dimension = dimensionFromAnchor(target, anchor, { allowPointAxis: false });
    return setAngleDimensionLabelOffsets(dimension, offsets);
  }

  function applyDefaultCircleDimensionLabelOffset(target, dimension) {
    if (!dimension || !(target?.primitive instanceof Circle)) return dimension;
    if (target.kind !== "radius" && target.kind !== "diameter") return dimension;
    dimension.labelOffsetU = target.primitive.radius() * 0.5;
    return dimension;
  }

  function storedDimensionAxis(target, dimension = null) {
    if (target.kind === "point-point") return target.dimensionAxis || null;
    return dimension?.axis || target.dimensionAxis || null;
  }

  function dimensionAnchor(target, dimension) {
    if (!dimension) return defaultDimensionForTarget(target);
    if (target.kind === "radius" || target.kind === "diameter" || (target.kind === "offset-distance" && !(target.source instanceof Line))) {
      if (Number.isFinite(dimension.x) && Number.isFinite(dimension.y)) return { x: dimension.x, y: dimension.y };
    }
    if (target.kind === "angle") {
      const vertex = lineIntersection(target.line1, target.line2);
      if (vertex && Number.isFinite(dimension.angleRadius)) {
        const { mid } = angleDimensionAngles(target, null, dimension);
        return {
          x: vertex.x + Math.cos(mid) * dimension.angleRadius,
          y: vertex.y + Math.sin(mid) * dimension.angleRadius,
        };
      }
      return { x: dimension.x, y: dimension.y };
    }
    const base = dimensionBasePoint(target);
    const axis = storedDimensionAxis(target, dimension);
    const { d, n } = dimensionBasis({ ...target, dimensionAxis: axis });
    if (Number.isFinite(dimension.offsetU) && Number.isFinite(dimension.offsetN)) {
      return {
        x: base.x + d.x * dimension.offsetU + n.x * dimension.offsetN,
        y: base.y + d.y * dimension.offsetU + n.y * dimension.offsetN,
      };
    }
    return { x: dimension.x, y: dimension.y };
  }

  function defaultDimensionForTarget(target) {
    if (target.kind === "angle") {
      const vertex = lineIntersection(target.line1, target.line2);
      if (!vertex) return { x: 0, y: 0, offsetU: NaN, offsetN: NaN, labelOffsetU: 0, axis: null };
      const angles = angleDimensionAngles(target);
      const radius = 45 / viewport.scale;
      return {
        x: vertex.x + Math.cos(angles.mid) * radius,
        y: vertex.y + Math.sin(angles.mid) * radius,
        offsetU: NaN,
        offsetN: NaN,
        labelOffsetU: 0,
        axis: null,
        angleStartFlip: angles.startFlip,
        angleEndFlip: angles.endFlip,
        angleRadius: radius,
      };
    }
    const points = targetPointsForDimension(target);
    if (points.length < 2) return { x: 0, y: 0 };
    if (target.kind === "radius") {
      const dimension = dimensionFromAnchor(target, points[1]);
      return applyDefaultCircleDimensionLabelOffset(target, dimension);
    }
    const mid = dimensionBasePoint(target);
    const defaultAxis = target.kind === "point-point" ? target.dimensionAxis || null : null;
    const dir = targetDirection(defaultAxis ? { ...target, dimensionAxis: defaultAxis } : target);
    const normal = { x: -dir.y, y: dir.x };
    const dimension = dimensionFromAnchor(defaultAxis ? { ...target, dimensionAxis: defaultAxis } : target, { x: mid.x + normal.x * 30, y: mid.y + normal.y * 30 }, { allowPointAxis: false });
    applyDefaultCircleDimensionLabelOffset(target, dimension);
    if (defaultAxis) dimension.axis = defaultAxis;
    return dimension;
  }

  function targetFromConstraint(c) {
    if (c instanceof DistanceConstraint) return { kind: "point-point", p1: c.p1, p2: c.p2, value: c.target };
    if (c instanceof PointAxisDistanceConstraint) return { kind: "point-point", p1: c.p1, p2: c.p2, value: c.target, dimensionAxis: c.axis };
    if (c instanceof PointLineDistanceConstraint) return { kind: "point-line", point: c.point, line: c.line, value: c.target };
    if (c instanceof LineLineDistanceConstraint) return { kind: "line-line", line1: c.line1, line2: c.line2, value: c.target };
    if (c instanceof OffsetConstraint) return { kind: "offset-distance", source: c.source, offset: c.offset, value: c.target, sign: c.sign };
    if (c instanceof LineAngleConstraint) return { kind: "angle", line1: c.line1, line2: c.line2, value: angleDegrees(c.target), signedValue: angleDimensionSweep({ line1: c.line1, line2: c.line2 }) };
    if (c instanceof RadiusConstraint) return { kind: "radius", primitive: c.primitive, value: c.target };
    if (c instanceof DiameterConstraint) return { kind: "diameter", primitive: c.primitive, value: c.target };
    return null;
  }

  function isDimensionConstraint(constraint) {
    return (
      constraint instanceof DistanceConstraint ||
      constraint instanceof PointAxisDistanceConstraint ||
      constraint instanceof PointLineDistanceConstraint ||
      constraint instanceof LineLineDistanceConstraint ||
      constraint instanceof OffsetConstraint ||
      constraint instanceof LineAngleConstraint ||
      constraint instanceof RadiusConstraint ||
      constraint instanceof DiameterConstraint
    );
  }

  function isReadOnlyDimension(constraint) {
    return Boolean(constraint?.readOnlyDimension);
  }

  function measuredDimensionValue(target, dimension = null) {
    if (!target) return NaN;
    if (target.kind === "angle") {
      return angleDegrees(angleDimensionAngles(target, null, dimension).signed);
    }
    return geometryTargetValue(target);
  }

  function measuredConstraintTargetValue(constraint, target = targetFromConstraint(constraint), dimension = constraint?.dimension) {
    if (!target) return NaN;
    const measured = measuredDimensionValue(target, dimension);
    return target.kind === "angle" ? (measured * Math.PI) / 180 : measured;
  }

  function dimensionLabelForConstraint(constraint, target, dimension) {
    const readOnly = isReadOnlyDimension(constraint);
    const value = readOnly ? measuredDimensionValue(target, dimension) : target.kind === "angle" ? angleDegrees(constraint.target) : constraint.target;
    const formatLabel = readOnly ? formatMeasuredDimensionLabel : formatDimensionLabel;
    const display = dimensionDisplayState(dimension);
    const number = display.precision == null ? formatLabel(value) : Number(value).toFixed(display.precision);
    const unit = target.kind === "angle" ? "°" : "";
    const tolerance = display.toleranceUpper !== "" || display.toleranceLower !== ""
      ? ` +${display.toleranceUpper === "" ? "0" : display.toleranceUpper}/-${display.toleranceLower === "" ? "0" : Math.abs(Number(display.toleranceLower))}`
      : "";
    const label = `${display.prefix}${number}${unit}${display.suffix}${tolerance}`;
    return readOnly ? `(${label})` : label;
  }

  function constraintReferencesPoint(c, point) {
    if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) return c.p1 === point || c.p2 === point;
    if (c instanceof PointLineDistanceConstraint) return c.point === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof LineLineDistanceConstraint) return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
    if (c instanceof OffsetConstraint) {
      if (c.source instanceof Line && c.offset instanceof Line) {
        return c.source.p1 === point || c.source.p2 === point || c.offset.p1 === point || c.offset.p2 === point;
      }
      return c.source.center === point || c.offset.center === point;
    }
    if (c instanceof CoincidentConstraint) return c.p1 === point || c.p2 === point;
    if (c instanceof ArcEndpointCoincidentConstraint) return c.arc.center === point || c.point === point;
    if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) return c.a.center === point || c.b.center === point;
    if (c instanceof ArcEndpointFixedConstraint) return c.arc.center === point;
    if (c instanceof LineFixedConstraint) return c.line.p1 === point || c.line.p2 === point;
    if (c instanceof PointOnLineConstraint || c instanceof PointOnLineMidpointConstraint) return c.point === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof ArcEndpointOnLineConstraint) return c.arc.center === point || c.line.p1 === point || c.line.p2 === point;
    if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return c.line.p1 === point || c.line.p2 === point;
    if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) return c.p1 === point || c.p2 === point;
    if (c instanceof SymmetryConstraint) return c.p1 === point || c.p2 === point || c.axis.p1 === point || c.axis.p2 === point;
    if (c instanceof LineSymmetryConstraint) {
      return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point || c.axis.p1 === point || c.axis.p2 === point;
    }
    if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint) {
      return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
    }
    if (c instanceof CollinearConstraint || c instanceof EqualLengthConstraint || c instanceof LineAngleConstraint) return c.line1.p1 === point || c.line1.p2 === point || c.line2.p1 === point || c.line2.p2 === point;
    if (c instanceof ConcentricConstraint) return c.a === point || c.b === point || c.a.center === point || c.b.center === point;
    if (c instanceof PointOnCircleConstraint) return c.point === point || c.primitive.center === point;
    if (c instanceof ArcEndpointOnCircleConstraint) return c.arc.center === point || c.primitive.center === point;
    if (c instanceof RadiusConstraint || c instanceof DiameterConstraint) return c.primitive.center === point;
    if (c instanceof EqualRadiusConstraint || c instanceof CircleCircleTangentConstraint) return c.a.center === point || c.b.center === point;
    if (c instanceof LineCircleTangentConstraint) return c.line.p1 === point || c.line.p2 === point || c.primitive.center === point;
    return false;
  }

  function constraintReferencesLine(c, line) {
    if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) {
      return (c.p1 === line.p1 && c.p2 === line.p2) || (c.p1 === line.p2 && c.p2 === line.p1);
    }
    if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) {
      return (c.p1 === line.p1 && c.p2 === line.p2) || (c.p1 === line.p2 && c.p2 === line.p1);
    }
    if (c instanceof SymmetryConstraint) return c.axis === line;
    if (c instanceof LineSymmetryConstraint) return c.line1 === line || c.line2 === line || c.axis === line;
    if (c instanceof PointLineDistanceConstraint) return c.line === line;
    if (c instanceof LineLineDistanceConstraint) return c.line1 === line || c.line2 === line;
    if (c instanceof OffsetConstraint) return c.source === line || c.offset === line;
    if (c instanceof LineFixedConstraint) return c.line === line;
    if (c instanceof PointOnLineConstraint || c instanceof PointOnLineMidpointConstraint) return c.line === line;
    if (c instanceof ArcEndpointOnLineConstraint) return c.line === line;
    if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return c.line === line;
    if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint) return c.line1 === line || c.line2 === line;
    if (c instanceof CollinearConstraint || c instanceof EqualLengthConstraint || c instanceof LineAngleConstraint) return c.line1 === line || c.line2 === line;
    if (c instanceof LineCircleTangentConstraint) return c.line === line;
    return false;
  }

  function constraintReferencesPrimitive(c, primitive) {
    if (c instanceof OffsetConstraint) return c.source === primitive || c.offset === primitive;
    if (c instanceof ArcEndpointCoincidentConstraint) return c.arc === primitive;
    if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) return c.a === primitive || c.b === primitive;
    if (c instanceof ArcEndpointOnLineConstraint) return c.arc === primitive;
    if (c instanceof ArcEndpointFixedConstraint) return c.arc === primitive;
    if (c instanceof RadiusConstraint || c instanceof DiameterConstraint || c instanceof PointOnCircleConstraint || c instanceof LineCircleTangentConstraint) return c.primitive === primitive;
    if (c instanceof ArcEndpointOnCircleConstraint) return c.arc === primitive || c.primitive === primitive;
    if (c instanceof ConcentricConstraint || c instanceof EqualRadiusConstraint || c instanceof CircleCircleTangentConstraint) return c.a === primitive || c.b === primitive;
    return false;
  }

  function addNode(nodes, value) {
    if (value) nodes.add(value);
  }

  function constraintGraphNodes(c) {
    const nodes = new Set();
    if (c instanceof DistanceConstraint || c instanceof PointAxisDistanceConstraint) {
      addNode(nodes, c.p1);
      addNode(nodes, c.p2);
    } else if (c instanceof PointLineDistanceConstraint) {
      addNode(nodes, c.point);
      addNode(nodes, c.line);
      addNode(nodes, c.line.p1);
      addNode(nodes, c.line.p2);
    } else if (c instanceof LineLineDistanceConstraint) {
      for (const line of [c.line1, c.line2]) {
        addNode(nodes, line);
        addNode(nodes, line.p1);
        addNode(nodes, line.p2);
      }
    } else if (c instanceof OffsetConstraint) {
      for (const item of [c.source, c.offset]) {
        addNode(nodes, item);
        if (item instanceof Line) {
          addNode(nodes, item.p1);
          addNode(nodes, item.p2);
        } else {
          addNode(nodes, item.center);
        }
      }
    } else if (c instanceof CoincidentConstraint) {
      addNode(nodes, c.p1);
      addNode(nodes, c.p2);
    } else if (c instanceof ArcEndpointCoincidentConstraint) {
      addNode(nodes, c.arc);
      addNode(nodes, c.arc.center);
      addNode(nodes, c.point);
    } else if (c instanceof ArcEndpointArcEndpointCoincidentConstraint) {
      for (const arc of [c.a, c.b]) {
        addNode(nodes, arc);
        addNode(nodes, arc.center);
      }
    } else if (c instanceof PointOnLineConstraint || c instanceof PointOnLineMidpointConstraint) {
      addNode(nodes, c.point);
      addNode(nodes, c.line);
      addNode(nodes, c.line.p1);
      addNode(nodes, c.line.p2);
    } else if (c instanceof ArcEndpointOnLineConstraint) {
      addNode(nodes, c.arc);
      addNode(nodes, c.arc.center);
      addNode(nodes, c.line);
      addNode(nodes, c.line.p1);
      addNode(nodes, c.line.p2);
    } else if (c instanceof ArcEndpointFixedConstraint) {
      addNode(nodes, c.arc);
      addNode(nodes, c.arc.center);
    } else if (c instanceof LineFixedConstraint || c instanceof HorizontalConstraint || c instanceof VerticalConstraint) {
      addNode(nodes, c.line);
      addNode(nodes, c.line.p1);
      addNode(nodes, c.line.p2);
    } else if (c instanceof PointHorizontalConstraint || c instanceof PointVerticalConstraint) {
      addNode(nodes, c.p1);
      addNode(nodes, c.p2);
    } else if (c instanceof SymmetryConstraint) {
      addNode(nodes, c.p1);
      addNode(nodes, c.p2);
      addNode(nodes, c.axis);
      addNode(nodes, c.axis.p1);
      addNode(nodes, c.axis.p2);
    } else if (c instanceof LineSymmetryConstraint) {
      for (const line of [c.line1, c.line2, c.axis]) {
        addNode(nodes, line);
        addNode(nodes, line.p1);
        addNode(nodes, line.p2);
      }
    } else if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint || c instanceof CollinearConstraint || c instanceof EqualLengthConstraint || c instanceof LineAngleConstraint) {
      for (const line of [c.line1, c.line2]) {
        addNode(nodes, line);
        addNode(nodes, line.p1);
        addNode(nodes, line.p2);
      }
    } else if (c instanceof RadiusConstraint || c instanceof DiameterConstraint || c instanceof PointOnCircleConstraint || c instanceof ArcEndpointOnCircleConstraint || c instanceof LineCircleTangentConstraint) {
      if (c.point) addNode(nodes, c.point);
      if (c.arc) {
        addNode(nodes, c.arc);
        addNode(nodes, c.arc.center);
      }
      if (c.line) {
        addNode(nodes, c.line);
        addNode(nodes, c.line.p1);
        addNode(nodes, c.line.p2);
      }
      if (c.primitive) {
        addNode(nodes, c.primitive);
        addNode(nodes, c.primitive.center);
      }
    } else if (c instanceof ConcentricConstraint || c instanceof EqualRadiusConstraint || c instanceof CircleCircleTangentConstraint) {
      for (const item of [c.a, c.b]) {
        addNode(nodes, item);
        addNode(nodes, item.center || item);
      }
    }
    for (const node of [...nodes]) {
      if (node?.blockInstance) addNode(nodes, node.blockInstance);
    }
    return [...nodes];
  }

  function addIntrinsicGraphEdges(adjacency, a, b) {
    if (!a || !b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }

  function buildConstraintAdjacency() {
    const adjacency = new Map();
    for (const p of allGeometryPoints()) {
      if (!adjacency.has(p)) adjacency.set(p, new Set());
      if (p.blockInstance) addIntrinsicGraphEdges(adjacency, p, p.blockInstance);
    }
    for (const line of allGeometryLines()) {
      addIntrinsicGraphEdges(adjacency, line, line.p1);
      addIntrinsicGraphEdges(adjacency, line, line.p2);
      if (line.blockInstance) addIntrinsicGraphEdges(adjacency, line, line.blockInstance);
    }
    for (const circle of allGeometryCircles()) {
      addIntrinsicGraphEdges(adjacency, circle, circle.center);
      if (circle.blockInstance) addIntrinsicGraphEdges(adjacency, circle, circle.blockInstance);
    }
    for (const arc of allGeometryArcs()) {
      addIntrinsicGraphEdges(adjacency, arc, arc.center);
      if (arc.blockInstance) addIntrinsicGraphEdges(adjacency, arc, arc.blockInstance);
    }

    for (const constraint of model.constraints) {
      if (!constraintIsOperational(constraint)) continue;
      const nodes = constraintGraphNodes(constraint);
      for (const node of nodes) {
        if (!adjacency.has(node)) adjacency.set(node, new Set());
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) addIntrinsicGraphEdges(adjacency, nodes[i], nodes[j]);
      }
    }
    return adjacency;
  }

  function connectedComponentFromSeeds(seeds) {
    const adjacency = buildConstraintAdjacency();
    const seen = new Set();
    const queue = [];
    for (const seed of seeds) {
      if (!seed || seen.has(seed)) continue;
      seen.add(seed);
      queue.push(seed);
    }
    while (queue.length > 0) {
      const node = queue.shift();
      // A fixed point is a kinematic boundary: it contributes a constant to
      // constraints on either side, but motion cannot propagate through it to
      // otherwise independent geometry. Stopping here keeps large anchored
      // sketches local during interactive dragging.
      if (node instanceof Point && node.fixed) continue;
      for (const next of adjacency.get(node) || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  }

  function localSolveVariables(component, sketchId = activeSketchId()) {
    const vars = [];
    for (const p of model.points) {
      if (!isVisibleSketchElement(p)) continue;
      if (component.has(p) && elementSketchId(p) === sketchId && !p.fixed) {
        vars.push({ object: p, prop: "x", label: `${p.id}.x` });
        vars.push({ object: p, prop: "y", label: `${p.id}.y` });
      }
    }
    for (const c of model.circles) {
      if (component.has(c) && elementSketchId(c) === sketchId) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: MIN_LINE_LENGTH });
    }
    for (const a of model.arcs) {
      if (component.has(a) && elementSketchId(a) === sketchId) {
        vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: MIN_LINE_LENGTH });
        vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
        vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
      }
    }
    for (const instance of model.blockInstances) {
      if (!component.has(instance) || instance.sketchId !== sketchId || instance.fixed) continue;
      vars.push({ object: instance, prop: "x", label: `${instance.id}.x` });
      vars.push({ object: instance, prop: "y", label: `${instance.id}.y` });
      if (!instance.rotationLocked) vars.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
    }
    return vars;
  }

  function localSolveConstraints(component, sketchId = activeSketchId()) {
    return model.constraints.filter((constraint) =>
      constraintIsOperational(constraint)
      && constraintSketchId(constraint) === sketchId
      && constraintGraphNodes(constraint).some((node) => component.has(node) && !(node instanceof Point && node.fixed)),
    );
  }

  function localSolveLines(component, sketchId = activeSketchId()) {
    return model.lines.filter((line) => component.has(line) && elementSketchId(line) === sketchId);
  }

  function sketchSolveVariables(sketchId = activeSketchId()) {
    const vars = [];
    for (const p of model.points) {
      if (elementSketchId(p) === sketchId && !p.fixed) {
        vars.push({ object: p, prop: "x", label: `${p.id}.x` });
        vars.push({ object: p, prop: "y", label: `${p.id}.y` });
      }
    }
    for (const c of model.circles) {
      if (elementSketchId(c) === sketchId) vars.push({ object: c, prop: "radiusValue", label: `${c.id}.r`, min: MIN_LINE_LENGTH });
    }
    for (const a of model.arcs) {
      if (elementSketchId(a) === sketchId) {
        vars.push({ object: a, prop: "radiusValue", label: `${a.id}.r`, min: MIN_LINE_LENGTH });
        vars.push({ object: a, prop: "startAngle", label: `${a.id}.startAngle` });
        vars.push({ object: a, prop: "endAngle", label: `${a.id}.endAngle` });
      }
    }
    for (const instance of model.blockInstances) {
      if (instance.sketchId !== sketchId || instance.fixed) continue;
      vars.push({ object: instance, prop: "x", label: `${instance.id}.x` });
      vars.push({ object: instance, prop: "y", label: `${instance.id}.y` });
      if (!instance.rotationLocked) vars.push({ object: instance, prop: "rotation", label: `${instance.id}.rotation` });
    }
    return vars;
  }

  function sketchSolveConstraints(sketchId = activeSketchId()) {
    return model.constraints.filter((constraint) => constraintIsOperational(constraint) && constraintSketchId(constraint) === sketchId);
  }

  function sketchSolveLines(sketchId = activeSketchId()) {
    return model.lines.filter((line) => elementSketchId(line) === sketchId);
  }

  function solveActiveSketch(extra = []) {
    const sketchId = activeSketchId();
    return solver.solveSubset({
      variables: sketchSolveVariables(sketchId),
      constraints: sketchSolveConstraints(sketchId),
      lines: sketchSolveLines(sketchId),
      extra,
    });
  }

  function solveSketchById(sketchId, extra = []) {
    return solver.solveSubset({
      variables: sketchSolveVariables(sketchId),
      constraints: sketchSolveConstraints(sketchId),
      lines: sketchSolveLines(sketchId),
      extra,
    });
  }

  function solveDragSketch(session, extra = []) {
    return solveSketchById(session?.sketchId || activeSketchId(), extra);
  }

  function solveFinalDragSession(session) {
    const extra = session?.finalDragConstraints || [];
    if (session?.lastGuidedPreviewError > CONSTRAINT_ACCEPT_ERROR) {
      // Mouse-up is allowed a larger local iteration budget than an animation
      // frame. This removes accumulated preview error without invoking the
      // much heavier full-sketch solve for an otherwise isolated component.
      const localResult = withSolverMaxIterations(100, () => solveLocalDrag(session, []));
      if (localResult) {
        const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session?.sketchId || activeSketchId())));
        localResult.baseErrorNorm = baseErrorNorm;
        localResult.localFinalCorrection = true;
        if (localResult.success || baseErrorNorm <= CONSTRAINT_ACCEPT_ERROR) {
          localResult.success = true;
          return localResult;
        }
      }
      const result = solveDragSketch(session);
      result.guidedFinalFallback = true;
      return result;
    }
    const variables = sketchSolveVariables(session?.sketchId || activeSketchId());
    const state = solver.clone(variables);
    const guidedResult = solveDragSketch(session, extra);
    if (guidedResult.success || guidedResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) {
      if (!guidedResult.success) guidedResult.acceptedAtDragTolerance = true;
      guidedResult.success = true;
      return guidedResult;
    }
    solver.restore(state);
    const fallbackResult = solveDragSketch(session);
    fallbackResult.guidedFinalFallback = true;
    if (!fallbackResult.success && fallbackResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) {
      fallbackResult.acceptedAtDragTolerance = true;
      fallbackResult.success = true;
    }
    return fallbackResult;
  }

  function solveReferenceDependentSketches(rootSketchId) {
    refreshReferenceConstraintValidity();
    const results = [];
    const dependentsBySource = new Map();
    for (const constraint of model.constraints) {
      if (!constraintIsOperational(constraint) || !constraint.reference || !constraint.referenceSketchId) continue;
      const dependentSketchId = constraintSketchId(constraint);
      if (!dependentSketchId || dependentSketchId === constraint.referenceSketchId) continue;
      if (!dependentsBySource.has(constraint.referenceSketchId)) dependentsBySource.set(constraint.referenceSketchId, new Set());
      dependentsBySource.get(constraint.referenceSketchId).add(dependentSketchId);
    }

    const affected = new Set([rootSketchId]);
    const pending = [rootSketchId];
    while (pending.length > 0) {
      const sourceSketchId = pending.shift();
      for (const dependentSketchId of dependentsBySource.get(sourceSketchId) || []) {
        if (affected.has(dependentSketchId)) continue;
        affected.add(dependentSketchId);
        pending.push(dependentSketchId);
      }
    }

    const indegree = new Map([...affected].map((sketchId) => [sketchId, 0]));
    for (const [sourceSketchId, dependents] of dependentsBySource) {
      if (!affected.has(sourceSketchId)) continue;
      for (const dependentSketchId of dependents) {
        if (affected.has(dependentSketchId)) indegree.set(dependentSketchId, (indegree.get(dependentSketchId) || 0) + 1);
      }
    }
    const orderIndex = new Map(orderedSketches().map((sketch, index) => [sketch.id, index]));
    const ready = [...affected]
      .filter((sketchId) => (indegree.get(sketchId) || 0) === 0)
      .sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
    const processed = new Set();
    while (ready.length > 0) {
      const sketchId = ready.shift();
      if (processed.has(sketchId)) continue;
      processed.add(sketchId);
      if (sketchId !== rootSketchId) {
        clearSketchSolveState(sketchId);
        const result = solveSketchById(sketchId);
        normalizeArcSweeps();
        const status = resultIsAccepted(result) ? "ok" : "error";
        if (status === "ok") setSketchSolveOk(sketchId, result, rootSketchId);
        else setSketchSolveError(sketchId, result, rootSketchId);
        results.push({ sketchId, result, status });
      }
      for (const dependentSketchId of dependentsBySource.get(sketchId) || []) {
        if (!affected.has(dependentSketchId)) continue;
        indegree.set(dependentSketchId, (indegree.get(dependentSketchId) || 0) - 1);
        if (indegree.get(dependentSketchId) === 0) {
          ready.push(dependentSketchId);
          ready.sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
        }
      }
    }

    for (const sketchId of affected) {
      if (sketchId === rootSketchId || processed.has(sketchId)) continue;
      const result = { success: false, errorNorm: Infinity, iterations: 0, reason: "循環参照" };
      setSketchSolveError(sketchId, result, rootSketchId);
      results.push({ sketchId, result, status: "error" });
    }
    const failed = results.find((entry) => entry.status === "error");
    return { success: !failed, sketchId: failed?.sketchId || null, result: failed?.result || null, results };
  }

  function solveSketchAndDependents(sketchId = activeSketchId(), rollbackState = null) {
    refreshReferenceConstraintValidity();
    clearSketchSolveState(sketchId);
    const result = solveSketchById(sketchId);
    normalizeArcSweeps();
    if (!resultIsAccepted(result)) {
      if (rollbackState) {
        restoreModelState(rollbackState);
        clearSketchSolveState(sketchId);
      } else {
        setSketchSolveError(sketchId, result, sketchId);
      }
      return { success: false, sketchId, result, dependent: { success: true, results: [] } };
    }
    setSketchSolveOk(sketchId, result, sketchId);
    const dependent = solveReferenceDependentSketches(sketchId);
    return { success: true, sketchId, result, dependent };
  }

  function solveConstraintComponentAndDependents(constraint, rollbackState = null) {
    const sketchId = constraintSketchId(constraint);
    refreshReferenceConstraintValidity();
    clearSketchSolveState(sketchId);
    const context = localSolveContextFromSeeds(constraintGraphNodes(constraint), sketchId);
    let result = solver.solveSubset(context);
    normalizeArcSweeps();
    const globalConstraints = sketchSolveConstraints(sketchId);
    const globalErrorAfterLocal = vectorNorm(solver.computeErrorVectorForConstraints(globalConstraints));
    let fullFallback = false;
    if (resultIsAccepted(result) && globalErrorAfterLocal > CONSTRAINT_ACCEPT_ERROR) {
      result = solveSketchById(sketchId);
      normalizeArcSweeps();
      result.localErrorNorm = globalErrorAfterLocal;
      result.fullFallback = true;
      fullFallback = true;
    }
    if (!resultIsAccepted(result)) {
      if (rollbackState) {
        restoreModelState(rollbackState);
        clearSketchSolveState(sketchId);
      } else {
        setSketchSolveError(sketchId, result, sketchId);
      }
      return { success: false, sketchId, result, dependent: { success: true, results: [] }, local: !fullFallback, fullFallback };
    }
    setSketchSolveOk(sketchId, result, sketchId);
    const dependent = solveReferenceDependentSketches(sketchId);
    return { success: true, sketchId, result, dependent, local: !fullFallback, fullFallback };
  }

  function solveElementSketchAndDescendants(element, rollbackState = null) {
    return solveSketchAndDependents(elementSketchId(element), rollbackState);
  }

  function localSolveContextFromSeeds(seeds, sketchId = activeSketchId()) {
    const component = connectedComponentFromSeeds(seeds);
    return {
      component,
      variables: localSolveVariables(component, sketchId),
      constraints: localSolveConstraints(component, sketchId),
      lines: localSolveLines(component, sketchId),
    };
  }

  function removeFromArray(array, item) {
    const i = array.indexOf(item);
    if (i >= 0) array.splice(i, 1);
  }

  function deleteElements({ points = [], lines = [], circles = [], arcs = [], constraints = [] } = {}) {
    const pointSet = new Set(points);
    const lineSet = new Set(lines);
    const circleSet = new Set(circles);
    const arcSet = new Set(arcs);
    const constraintSet = new Set(constraints);

    for (const line of model.lines) {
      if (pointSet.has(line.p1) || pointSet.has(line.p2)) lineSet.add(line);
    }

    for (const circle of model.circles) {
      if (pointSet.has(circle.center)) circleSet.add(circle);
    }
    for (const arc of model.arcs) {
      if (pointSet.has(arc.center)) arcSet.add(arc);
    }
    const remainingLines = model.lines.filter((line) => !lineSet.has(line));
    const remainingCircles = model.circles.filter((circle) => !circleSet.has(circle));
    const remainingArcs = model.arcs.filter((arc) => !arcSet.has(arc));
    for (const line of lineSet) {
      if (line.p1.kind === "endpoint" && !isPointUsedByLine(line.p1, remainingLines) && !isPointUsedByCircle(line.p1, remainingCircles) && !isPointUsedByArc(line.p1, remainingArcs)) pointSet.add(line.p1);
      if (line.p2.kind === "endpoint" && !isPointUsedByLine(line.p2, remainingLines) && !isPointUsedByCircle(line.p2, remainingCircles) && !isPointUsedByArc(line.p2, remainingArcs)) pointSet.add(line.p2);
    }
    for (const circle of circleSet) {
      if (circle.center.kind === "endpoint" && !isPointUsedByCircle(circle.center, remainingCircles) && !isPointUsedByLine(circle.center, remainingLines) && !isPointUsedByArc(circle.center, remainingArcs)) pointSet.add(circle.center);
    }
    for (const arc of arcSet) {
      if (arc.center.kind === "endpoint" && !isPointUsedByArc(arc.center, remainingArcs) && !isPointUsedByLine(arc.center, remainingLines) && !isPointUsedByCircle(arc.center, remainingCircles)) pointSet.add(arc.center);
    }

    for (const constraint of model.constraints) {
      for (const point of pointSet) {
        if (constraintReferencesPoint(constraint, point)) constraintSet.add(constraint);
      }
      for (const line of lineSet) {
        if (constraintReferencesLine(constraint, line)) constraintSet.add(constraint);
      }
      for (const circle of circleSet) {
        if (constraintReferencesPrimitive(constraint, circle)) constraintSet.add(constraint);
      }
      for (const arc of arcSet) {
        if (constraintReferencesPrimitive(constraint, arc)) constraintSet.add(constraint);
      }
    }

    if (pointSet.size === 0 && lineSet.size === 0 && circleSet.size === 0 && arcSet.size === 0 && constraintSet.size === 0) return false;
    if (!guardDimensionSymbolDeletion(constraintSet)) return false;

    dragSession = null;
    dimensionDragSession = null;
    annotationDragSession = null;
    pendingCommand = null;
    pendingConstraintCommand = null;
    lineStartPoint = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    mode = "select";

    model.constraints = model.constraints.filter((c) => !constraintSet.has(c));
    model.lines = model.lines.filter((l) => !lineSet.has(l));
    model.circles = model.circles.filter((c) => !circleSet.has(c));
    model.arcs = model.arcs.filter((a) => !arcSet.has(a));
    model.points = model.points.filter((p) => !pointSet.has(p));
    selectedPoints = selectedPoints.filter((p) => !pointSet.has(p));
    selectedLines = selectedLines.filter((l) => !lineSet.has(l));
    selectedCircles = selectedCircles.filter((c) => !circleSet.has(c));
    selectedArcs = selectedArcs.filter((a) => !arcSet.has(a));
    if (constraintSet.has(selectedDimensionConstraint)) selectedDimensionConstraint = null;
    if (constraintSet.has(selectedConstraint)) selectedConstraint = null;
    if (constraintSet.has(hoveredDimensionConstraint)) hoveredDimensionConstraint = null;

    const result = solveActiveSketch();
    normalizeArcSweeps();
    updateToolbar();
    updateUI();
    draw();
    const msg = `削除しました: 点${pointSet.size} / 線${lineSet.size} / 円${circleSet.size} / 円弧${arcSet.size} / 拘束${constraintSet.size}`;
    setHint(`${msg} (error=${result.errorNorm.toExponential(2)}) / ${constraintSummaryText()}`, result.success && constraintAnalysisState?.analysis?.stable ? "normal" : "error");
    log(`${msg}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory("削除");
    return true;
  }

  function deleteCurrentSelection() {
    if (selectedAnnotation) {
      const id = selectedAnnotation.id;
      model.annotations = model.annotations.filter((item) => item !== selectedAnnotation);
      selectedAnnotation = null;
      updateUI();
      draw();
      setHint(`注記 ${id} を削除しました`);
      recordHistory("注記削除");
      return true;
    }
    let deletedBlockCount = 0;
    if (selectedBlockInstances.length > 0) {
      const instances = [...selectedBlockInstances];
      const projectionItems = instances.flatMap((instance) => {
        const bundle = blockAllProjectionBundle(instance);
        return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs];
      });
      const removedIds = new Set(projectionItems.map((item) => item.id));
      const removedKeys = new Set(projectionItems.map(geometryElementKey));
      const removedConstraints = new Set(model.constraints.filter((constraint) => constraintGraphNodes(constraint).some((node) => instances.includes(node) || projectionItems.includes(node))));
      if (!guardDimensionSymbolDeletion(removedConstraints)) return false;
      model.constraints = model.constraints.filter((constraint) => !removedConstraints.has(constraint));
      model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));
      model.blockInstances = model.blockInstances.filter((instance) => !instances.includes(instance));
      invalidateBlockProjectionCache();
      selectedBlockInstances = [];
      deletedBlockCount = instances.length;
    }
    const constraints = [...new Set([selectedDimensionConstraint, effectiveSelectedConstraint()].filter(Boolean))];
    const deletedGeometry = deleteElements({ points: selectedPoints, lines: selectedLines, circles: selectedCircles, arcs: selectedArcs, constraints });
    if (deletedGeometry) return true;
    if (deletedBlockCount === 0) return false;
    clearSelection();
    solveAndRefresh("ブロックインスタンス削除");
    setHint(`ブロックインスタンスを${deletedBlockCount}個削除しました`);
    return true;
  }

  function copyableSelectionPayload() {
    const points = new Set(selectedPoints.filter((point) => model.points.includes(point)));
    const lines = selectedLines.filter((line) => model.lines.includes(line));
    const circles = selectedCircles.filter((circle) => model.circles.includes(circle));
    const arcs = selectedArcs.filter((arc) => model.arcs.includes(arc));
    const blockInstances = selectedBlockInstances.filter((instance) => model.blockInstances.includes(instance));
    const dependentPoints = new Set();
    for (const line of lines) {
      points.add(line.p1);
      points.add(line.p2);
      dependentPoints.add(line.p1);
      dependentPoints.add(line.p2);
    }
    for (const primitive of [...circles, ...arcs]) {
      points.add(primitive.center);
      dependentPoints.add(primitive.center);
    }
    if (points.size + lines.length + circles.length + arcs.length + blockInstances.length === 0) return null;

    const selectedNodes = new Set([...points, ...lines, ...circles, ...arcs, ...blockInstances]);
    const selectedBlockProjectionIds = new Set();
    const blockProjectionData = new Map();
    for (const instance of blockInstances) {
      const bundle = blockProjectionBundle(instance);
      const projectedItems = [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs];
      for (const item of projectedItems) {
        selectedNodes.add(item);
        selectedBlockProjectionIds.add(item.id);
      }
      blockProjectionData.set(instance, {
        points: bundle.points.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
        lines: bundle.lines.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
        circles: bundle.circles.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
        arcs: bundle.arcs.map((item) => ({ id: item.id, localId: blockProjectionLocalId(item) })),
      });
    }

    const constraints = model.constraints.map((constraint) => {
      if (constraint instanceof LineFixedConstraint || constraint instanceof ArcEndpointFixedConstraint) return null;
      const nodes = constraintGraphNodes(constraint);
      if (nodes.length === 0 || !nodes.every((node) => selectedNodes.has(node) || Boolean(node?.blockProjection && selectedBlockProjectionIds.has(node.id)))) return null;
      return decorateSerializedConstraint(serializeConstraint(constraint), constraint);
    }).filter(Boolean);
    const orderedPoints = model.points.filter((point) => points.has(point));
    return {
      pasteCount: 0,
      parameterNamespaceKey: currentBlockDefinitionScopeId() ? `block:${currentBlockDefinitionScopeId()}` : "document",
      cut: false,
      points: orderedPoints.map((point) => ({
        id: point.id,
        x: point.x,
        y: point.y,
        fixed: false,
        kind: dependentPoints.has(point) ? point.kind || "endpoint" : "explicit",
        appearance: normalizeAppearance(point.appearance),
      })),
      lines: lines.map((line) => ({ id: line.id, p1: line.p1.id, p2: line.p2.id, construction: Boolean(line.construction), appearance: normalizeAppearance(line.appearance) })),
      circles: circles.map((circle) => ({ id: circle.id, center: circle.center.id, radius: circle.radius(), construction: Boolean(circle.construction), appearance: normalizeAppearance(circle.appearance) })),
      arcs: arcs.map((arc) => ({ id: arc.id, center: arc.center.id, radius: arc.radius(), startAngle: arc.startAngle, endAngle: arc.endAngle, construction: Boolean(arc.construction), appearance: normalizeAppearance(arc.appearance) })),
      constraints,
      blockInstances: blockInstances.map((instance) => ({
        id: instance.id,
        definitionId: instance.definitionId,
        x: instance.x,
        y: instance.y,
        rotation: instance.rotation,
        fixed: false,
        rotationLocked: Boolean(instance.rotationLocked),
        enabledSketchIds: Array.isArray(instance.enabledSketchIds) ? instance.enabledSketchIds.slice() : [],
        appearanceOverride: normalizeAppearance(instance.appearanceOverride),
        projection: blockProjectionData.get(instance),
      })),
      selection: {
        points: selectedPoints.filter((point) => points.has(point)).map((point) => point.id),
        lines: lines.map((line) => line.id),
        circles: circles.map((circle) => circle.id),
        arcs: arcs.map((arc) => arc.id),
        blockInstances: blockInstances.map((instance) => instance.id),
      },
    };
  }

  function clipboardPayloadCount(payload = geometryClipboard) {
    if (!payload) return 0;
    return payload.points.length + payload.lines.length + payload.circles.length + payload.arcs.length + payload.blockInstances.length;
  }

  function copySelectionToClipboard(options = {}) {
    if (!isGeometryMode()) return false;
    const payload = copyableSelectionPayload();
    if (!payload) {
      setHint("コピーする図形を選択してください", "error");
      updateToolbar();
      return false;
    }
    geometryClipboard = payload;
    geometryClipboard.cut = Boolean(options.cut);
    updateToolbar();
    if (options.cut) {
      const deleted = deleteCurrentSelection();
      if (deleted) setHint(`図形をカットしました（${clipboardPayloadCount(payload)}要素）`);
      return deleted;
    }
    setHint(`図形をコピーしました（${clipboardPayloadCount(payload)}要素）`);
    return true;
  }

  function remapClipboardValue(value, idMap) {
    if (typeof value === "string") return idMap.get(value) || value;
    if (Array.isArray(value)) return value.map((item) => remapClipboardValue(item, idMap));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapClipboardValue(item, idMap)]));
    }
    return value;
  }

  function translatedClipboardConstraintData(source, idMap, dx, dy) {
    const data = remapClipboardValue(source, idMap);
    if (data.dimension) {
      for (const key of ["x", "labelX"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) + dx;
      for (const key of ["y", "labelY"]) if (Number.isFinite(Number(data.dimension[key]))) data.dimension[key] = Number(data.dimension[key]) + dy;
    }
    if (data.type === "arcEndpointFixed") {
      if (Number.isFinite(Number(data.x))) data.x = Number(data.x) + dx;
      if (Number.isFinite(Number(data.y))) data.y = Number(data.y) + dy;
    }
    if (data.type === "lineFixed") {
      for (const key of ["p1x", "p2x"]) if (Number.isFinite(Number(data[key]))) data[key] = Number(data[key]) + dx;
      for (const key of ["p1y", "p2y"]) if (Number.isFinite(Number(data[key]))) data[key] = Number(data[key]) + dy;
    }
    delete data.reference;
    delete data.referenceSketchId;
    return data;
  }

  function serializedDimensionExpressionValue(data) {
    const value = Number(data?.target);
    return data?.type === "lineAngle" ? angleDegrees(value) : value;
  }

  function mapClipboardBlockProjection(source, instance, idMap, pointById, lineById, primitiveById) {
    const projection = source.projection || {};
    const bundle = blockProjectionBundle(instance);
    const mapKind = (records, items, destination) => {
      const byLocalId = new Map(items.map((item) => [String(blockProjectionLocalId(item)), item]));
      for (const record of records || []) {
        const item = byLocalId.get(String(record.localId));
        if (!item) continue;
        idMap.set(String(record.id), item.id);
        destination.set(item.id, item);
      }
    };
    mapKind(projection.points, bundle.points, pointById);
    mapKind(projection.lines, bundle.lines, lineById);
    mapKind(projection.circles, bundle.circles, primitiveById);
    mapKind(projection.arcs, bundle.arcs, primitiveById);
  }

  function pasteGeometryClipboard() {
    if (!isGeometryMode() || !geometryClipboard) {
      setHint("貼り付ける図形がありません", "error");
      return false;
    }
    if (!canCreateInActiveSketch()) {
      setHint("貼り付け先のスケッチをアクティブにしてください", "error");
      return false;
    }

    const payload = geometryClipboard;
    if (payload.blockInstances.length > 0) {
      const invalid = payload.blockInstances.find((instance) => blockDefinitionScopeError(instance.definitionId));
      if (invalid) {
        setHint(blockDefinitionScopeError(invalid.definitionId), "error");
        return false;
      }
    }
    const targetSketchId = activeSketchId();
    const pasteNumber = payload.pasteCount + 1;
    const offset = (CLIPBOARD_PASTE_OFFSET_SCREEN_PX * pasteNumber) / viewport.scale;
    const dx = offset;
    const dy = offset;
    const initialLengths = {
      points: model.points.length,
      lines: model.lines.length,
      circles: model.circles.length,
      arcs: model.arcs.length,
      constraints: model.constraints.length,
      blockInstances: model.blockInstances.length,
    };
    const initialSequences = { pointSeq, lineSeq, circleSeq, arcSeq, blockInstanceSeq, nextDimensionParameterIndex: model.nextDimensionParameterIndex };

    try {
      const idMap = new Map();
      const pointById = new Map();
      const lineById = new Map();
      const primitiveById = new Map();
      for (const source of payload.points) {
        const point = new Point(`P${pointSeq++}`, source.x + dx, source.y + dy, source.fixed, source.kind === "endpoint" ? "endpoint" : "explicit");
        point.sketchId = targetSketchId;
        point.appearance = normalizeAppearance(source.appearance);
        model.points.push(point);
        idMap.set(source.id, point.id);
        pointById.set(point.id, point);
      }
      for (const source of payload.lines) {
        const line = new Line(`L${lineSeq++}`, pointById.get(idMap.get(source.p1)), pointById.get(idMap.get(source.p2)), source.construction);
        line.sketchId = targetSketchId;
        line.appearance = normalizeAppearance(source.appearance);
        ensureLineMinimumLength(line);
        model.lines.push(line);
        idMap.set(source.id, line.id);
        lineById.set(line.id, line);
      }
      for (const source of payload.circles) {
        const circle = new Circle(`C${circleSeq++}`, pointById.get(idMap.get(source.center)), source.radius, source.construction);
        circle.sketchId = targetSketchId;
        circle.appearance = normalizeAppearance(source.appearance);
        model.circles.push(circle);
        idMap.set(source.id, circle.id);
        primitiveById.set(circle.id, circle);
      }
      for (const source of payload.arcs) {
        const arc = new Arc(`A${arcSeq++}`, pointById.get(idMap.get(source.center)), source.radius, source.startAngle, source.endAngle, source.construction);
        arc.sketchId = targetSketchId;
        arc.appearance = normalizeAppearance(source.appearance);
        normalizeArcSweep(arc);
        model.arcs.push(arc);
        idMap.set(source.id, arc.id);
        primitiveById.set(arc.id, arc);
      }
      const pastedBlockInstances = [];
      for (const source of payload.blockInstances) {
        const definition = blockDefinitionById(source.definitionId);
        if (!definition) throw new Error(`ブロック定義 ${source.definitionId} が見つかりません`);
        const instance = {
          id: `BI${blockInstanceSeq++}`,
          definitionId: source.definitionId,
          sketchId: targetSketchId,
          x: source.x + dx,
          y: source.y + dy,
          rotation: source.rotation,
          fixed: source.fixed,
          rotationLocked: Boolean(source.rotationLocked),
          enabledSketchIds: source.enabledSketchIds.slice(),
          appearanceOverride: normalizeAppearance(source.appearanceOverride),
        };
        model.blockInstances.push(instance);
        pastedBlockInstances.push(instance);
        idMap.set(source.id, instance.id);
      }
      if (pastedBlockInstances.length > 0) invalidateBlockProjectionCache();
      payload.blockInstances.forEach((source, index) => mapClipboardBlockProjection(source, pastedBlockInstances[index], idMap, pointById, lineById, primitiveById));

      const targetNamespaceKey = currentBlockDefinitionScopeId() ? `block:${currentBlockDefinitionScopeId()}` : "document";
      const sameNamespace = payload.parameterNamespaceKey === targetNamespaceKey;
      const copiedDimensionNames = new Map();
      for (const source of payload.constraints) {
        if (!source.parameterName) continue;
        const keepCutName = payload.cut && sameNamespace
          && !dimensionConstraintsInNamespace(currentParameterNamespace()).some((constraint) => constraint.parameterName === source.parameterName)
          && !(currentParameterNamespace().parameters || []).some((parameter) => parameter.name === source.parameterName);
        copiedDimensionNames.set(source.parameterName, keepCutName ? source.parameterName : allocateDimensionParameterName(currentParameterNamespace()));
      }
      for (const source of payload.constraints) {
        const data = translatedClipboardConstraintData(source, idMap, dx, dy);
        if (source.parameterName) {
          data.parameterName = copiedDimensionNames.get(source.parameterName);
          if (!data.readOnlyDimension) {
            data.expression = sameNamespace
              ? rewriteParameterIdentifiers(source.expression || String(serializedDimensionExpressionValue(source)), copiedDimensionNames)
              : String(serializedDimensionExpressionValue(source));
          }
        }
        const constraint = deserializeConstraint(data, pointById, lineById, primitiveById);
        if (!constraint) throw new Error(`拘束 ${source.type} を複製できません`);
        constraint.sketchId = targetSketchId;
        constraint.reference = false;
        constraint.referenceSketchId = null;
        model.constraints.push(constraint);
        ensureDimensionParameter(constraint, currentParameterNamespace());
      }

      clearSelection();
      const selectedIds = payload.selection;
      selectedPoints = selectedIds.points.map((id) => pointById.get(idMap.get(id))).filter(Boolean);
      selectedLines = selectedIds.lines.map((id) => lineById.get(idMap.get(id))).filter(Boolean);
      selectedCircles = selectedIds.circles.map((id) => primitiveById.get(idMap.get(id))).filter((item) => item instanceof Circle);
      selectedArcs = selectedIds.arcs.map((id) => primitiveById.get(idMap.get(id))).filter((item) => item instanceof Arc);
      selectedBlockInstances = pastedBlockInstances;
      payload.pasteCount = pasteNumber;
      mode = "select";
      solveAndRefresh("貼り付け");
      setHint(`${sketchName(targetSketchId)} に図形を貼り付けました（${clipboardPayloadCount(payload)}要素）`);
      return true;
    } catch (error) {
      model.points.length = initialLengths.points;
      model.lines.length = initialLengths.lines;
      model.circles.length = initialLengths.circles;
      model.arcs.length = initialLengths.arcs;
      model.constraints.length = initialLengths.constraints;
      model.blockInstances.length = initialLengths.blockInstances;
      pointSeq = initialSequences.pointSeq;
      lineSeq = initialSequences.lineSeq;
      circleSeq = initialSequences.circleSeq;
      arcSeq = initialSequences.arcSeq;
      blockInstanceSeq = initialSequences.blockInstanceSeq;
      model.nextDimensionParameterIndex = initialSequences.nextDimensionParameterIndex;
      invalidateBlockProjectionCache();
      clearSelection();
      updateUI();
      draw();
      setHint(`貼り付けに失敗しました: ${error.message}`, "error");
      return false;
    }
  }

  function ensureDimensionDefaults() {
    for (const c of model.constraints) {
      const target = targetFromConstraint(c);
      if (!target) continue;
      if (!c.dimension) {
        c.dimension = defaultDimensionForTarget(target);
      } else if (target.kind === "angle") {
        migrateAngleDimensionLabelPlacement(target, c.dimension);
        if (!Number.isFinite(c.dimension.angleRadius) || !Number.isInteger(c.dimension.angleStartFlip) || !Number.isInteger(c.dimension.angleEndFlip)) {
          const previousDimension = c.dimension;
          const previousAnchor = dimensionAnchor(target, previousDimension);
          c.dimension = dimensionFromAnchor(target, previousAnchor, { allowPointAxis: false });
          setAngleDimensionLabelOffsets(c.dimension, angleDimensionLabelOffsets(target, previousDimension));
        }
      } else if (!Number.isFinite(c.dimension.offsetU) || !Number.isFinite(c.dimension.offsetN)) {
        const previous = c.dimension;
        c.dimension = dimensionFromAnchor(target, previous, { allowPointAxis: false });
        c.dimension.labelOffsetU = Number.isFinite(previous.labelOffsetU) ? previous.labelOffsetU : 0;
        if (target.dimensionAxis) c.dimension.axis = target.dimensionAxis;
      }
      if (!Number.isFinite(c.dimension.labelOffsetU)) c.dimension.labelOffsetU = 0;
    }
  }

  function togglePointSelection(p) {
    if (!p) return;
    selectedConstraint = null;
    const i = selectedPoints.indexOf(p);
    if (i >= 0) selectedPoints.splice(i, 1);
    else selectedPoints.push(p);
  }

  function toggleLineSelection(l) {
    if (!l) return;
    selectedConstraint = null;
    const i = selectedLines.indexOf(l);
    if (i >= 0) selectedLines.splice(i, 1);
    else selectedLines.push(l);
  }

  function toggleCircleSelection(c) {
    if (!c) return;
    selectedConstraint = null;
    const i = selectedCircles.indexOf(c);
    if (i >= 0) selectedCircles.splice(i, 1);
    else selectedCircles.push(c);
  }

  function toggleArcSelection(a) {
    if (!a) return;
    selectedConstraint = null;
    const i = selectedArcs.indexOf(a);
    if (i >= 0) selectedArcs.splice(i, 1);
    else selectedArcs.push(a);
  }

  function toggleSidebarSelectionById(selection, item) {
    if (!item) return;
    const i = selection.findIndex((selected) => selected === item || selected?.id === item.id);
    if (i >= 0) selection.splice(i, 1);
    else selection.push(item);
  }

  function toggleBlockInstanceSelection(instance) {
    const index = selectedBlockInstances.indexOf(instance);
    if (index >= 0) selectedBlockInstances.splice(index, 1);
    else selectedBlockInstances.push(instance);
  }

  function addUnique(target, item) {
    if (item && !target.includes(item)) target.push(item);
  }

  function lineIntersectsRect(line, rect) {
    if (!bboxIntersectsRect(lineBBox(line), rect)) return false;
    if (pointInRect(line.p1, rect) || pointInRect(line.p2, rect)) return true;
    const edges = [
      [{ x: rect.x1, y: rect.y1 }, { x: rect.x2, y: rect.y1 }],
      [{ x: rect.x2, y: rect.y1 }, { x: rect.x2, y: rect.y2 }],
      [{ x: rect.x2, y: rect.y2 }, { x: rect.x1, y: rect.y2 }],
      [{ x: rect.x1, y: rect.y2 }, { x: rect.x1, y: rect.y1 }],
    ];
    return edges.some(([a, b]) => segmentsIntersect(line.p1, line.p2, a, b));
  }

  function segmentsIntersect(a, b, c, d) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const onSegment = (p, q, r) =>
      Math.min(p.x, q.x) - 1e-9 <= r.x &&
      r.x <= Math.max(p.x, q.x) + 1e-9 &&
      Math.min(p.y, q.y) - 1e-9 <= r.y &&
      r.y <= Math.max(p.y, q.y) + 1e-9;
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    if (Math.abs(c1) < 1e-9 && onSegment(a, b, c)) return true;
    if (Math.abs(c2) < 1e-9 && onSegment(a, b, d)) return true;
    if (Math.abs(c3) < 1e-9 && onSegment(c, d, a)) return true;
    if (Math.abs(c4) < 1e-9 && onSegment(c, d, b)) return true;
    return c1 * c2 < 0 && c3 * c4 < 0;
  }

  function selectByRect(rect, crossing, additive = false) {
    const nextPoints = additive ? [...selectedPoints] : [];
    const nextLines = additive ? [...selectedLines] : [];
    const nextCircles = additive ? [...selectedCircles] : [];
    const nextArcs = additive ? [...selectedArcs] : [];
    const nextBlocks = additive ? [...selectedBlockInstances] : [];

    for (const p of model.points) {
      if (!selectableSketchElement(p)) continue;
      if (!isExplicitPoint(p) && !isReferencePoint(p)) continue;
      if (pointInRect(p, rect)) addUnique(nextPoints, p);
    }
    for (const line of model.lines) {
      if (!selectableSketchElement(line)) continue;
      const selected = crossing ? lineIntersectsRect(line, rect) : bboxInRect(lineBBox(line), rect);
      if (selected) addUnique(nextLines, line);
    }
    for (const circle of model.circles) {
      if (!isVisibleSketchElement(circle)) continue;
      if (!selectableSketchElement(circle)) continue;
      const box = primitiveBBox(circle);
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextCircles, circle);
    }
    for (const arc of model.arcs) {
      if (!isVisibleSketchElement(arc)) continue;
      if (!selectableSketchElement(arc)) continue;
      const samples = arcSamplePoints(arc);
      const selected = crossing ? samples.some((p) => pointInRect(p, rect)) : samples.every((p) => pointInRect(p, rect));
      if (selected) addUnique(nextArcs, arc);
    }
    for (const instance of model.blockInstances) {
      if (!isEditableSketchId(instance.sketchId) || !isVisibleSketchId(instance.sketchId)) continue;
      const bundle = blockProjectionBundle(instance);
      let box = null;
      for (const line of bundle.lines) box = mergeBounds(box, lineBBox(line));
      for (const circle of bundle.circles) box = mergeBounds(box, primitiveBBox(circle));
      for (const arc of bundle.arcs) box = mergeBounds(box, primitiveBBox(arc));
      for (const point of bundle.points) box = mergeBounds(box, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      if (!box) continue;
      const selected = crossing ? bboxIntersectsRect(box, rect) : bboxInRect(box, rect);
      if (selected) addUnique(nextBlocks, instance);
    }

    selectedPoints = nextPoints;
    selectedLines = nextLines;
    selectedCircles = nextCircles;
    selectedArcs = nextArcs;
    selectedBlockInstances = nextBlocks;
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    selectedDimensionConstraint = null;
    selectedConstraint = null;
  }

  function resetCanvasStrokeState() {
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.lineWidth = 1;
  }

  function withCanvasState(drawFn) {
    ctx.save();
    try {
      resetCanvasStrokeState();
      drawFn();
    } finally {
      ctx.restore();
      resetCanvasStrokeState();
    }
  }

  function drawBlockInstanceHandles() {
    resetCanvasStrokeState();
  }

  function drawBlockPlacementPreview() {
    if (mode !== "block-place" || !blockPlacementDefinitionId || !pointerPreview) return;
    const definition = blockDefinitionById(blockPlacementDefinitionId);
    if (!definition) return;
    const anchor = blockPlacementAnchor || pointerPreview;
    const rotation = blockPlacementRotation(pointerPreview);
    const translation = blockInstanceTranslationForAnchor(definition, blockPlacementEnabledSketchIds, anchor, rotation);
    const previewInstance = { id: "BLOCK_PREVIEW", definitionId: definition.id, sketchId: activeSketchId(), x: translation.x, y: translation.y, rotation, fixed: false, rotationLocked: blockPlacementRotationLocked, enabledSketchIds: blockPlacementEnabledSketchIds.slice() };
    const bundle = createBlockProjectionBundle(previewInstance, definition);
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      for (const line of bundle.lines) {
        ctx.beginPath();
        ctx.moveTo(line.p1.x, line.p1.y);
        ctx.lineTo(line.p2.x, line.p2.y);
        ctx.stroke();
      }
      for (const circle of bundle.circles) {
        ctx.beginPath();
        ctx.arc(circle.center.x, circle.center.y, circle.radius(), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const arc of bundle.arcs) {
        ctx.beginPath();
        ctx.arc(arc.center.x, arc.center.y, arc.radius(), arc.startAngle, arc.endAngle, arc.endAngle < arc.startAngle);
        ctx.stroke();
      }
    });
  }

  function draw() {
    const r = canvas.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const dpr = window.devicePixelRatio || 1;
    const bitmapWidth = Math.max(1, Math.floor(w * dpr));
    const bitmapHeight = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    resetCanvasStrokeState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resetCanvasStrokeState();
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);
    resetCanvasStrokeState();
    drawLines();
    drawCircles();
    drawArcs();
    drawBlockInstanceHandles();
    drawDimensions();
    drawDimensionPreview();
    drawAnnotations();
    drawLeaderAnnotationCommandPreview();
    drawTemporaryLine();
    drawRectanglePreview();
    drawCirclePreview();
    drawArcPreview();
    drawBlockPlacementPreview();
    drawOffsetPreview();
    drawTrimPreview();
    drawSnapMarker();
    drawArcEndpointHandles();
    drawPoints();
    drawSketchIdentityLabel();
    drawSelectionRect();
    resetCanvasStrokeState();
    ctx.restore();
    resetCanvasStrokeState();
    syncDimensionValueInput();
    updateSidebarSelectionRowClasses();
  }

  function hideDimensionValueInput() {
    if (!dimensionValueInput) return;
    dimensionValueInput.hidden = true;
    dimensionValueInput.classList.remove("is-invalid");
  }

  function filletRadiusDimensionAnchor(geometry) {
    const angle = geometry.startAngle + (geometry.endAngle - geometry.startAngle) / 2;
    const distance = geometry.radius + 34 / viewport.scale;
    return {
      x: geometry.center.x + Math.cos(angle) * distance,
      y: geometry.center.y + Math.sin(angle) * distance,
    };
  }

  function dimensionInputLayoutForPendingCommand() {
    if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return null;
    if (pendingCommand.type === "fillet-radius-value") {
      const value = Number(pendingCommand.buffer);
      const radius = Number.isFinite(value) && value > 0 ? value : DEFAULT_FILLET_RADIUS;
      const geometry = computeFilletGeometry(pendingCommand.line1, pendingCommand.line2, radius);
      if (!geometry.ok) return null;
      const primitive = {
        id: "R",
        center: geometry.center,
        radius: () => geometry.radius,
      };
      const target = { kind: "radius", primitive, value: radius };
      const anchor = filletRadiusDimensionAnchor(geometry);
      return dimensionLayout(target, dimensionFromAnchor(target, anchor));
    }
    return dimensionLayout(pendingCommand.target, pendingCommand.dimension);
  }

  function syncDimensionValueInput() {
    if (!dimensionValueInput) return;
    if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) {
      hideDimensionValueInput();
      return;
    }
    const layout = dimensionInputLayoutForPendingCommand();
    if (!layout?.text) {
      hideDimensionValueInput();
      return;
    }
    const screen = worldToCanvasScreen(layout.text);
    const angle = Number.isFinite(layout.textAngle) ? layout.textAngle : 0;
    const labelGap = 4;
    const labelOffset = dimensionTextOffset(angle, labelGap);
    dimensionValueInput.hidden = false;
    dimensionValueInput.style.left = `${screen.x + labelOffset.x}px`;
    dimensionValueInput.style.top = `${screen.y + labelOffset.y}px`;
    dimensionValueInput.style.setProperty("--dimension-text-angle", `${angle}rad`);
    dimensionValueInput.style.width = `${Math.max(132, Math.min(280, pendingCommand.buffer.length * 9 + 34))}px`;
    if (dimensionValueInput.value !== pendingCommand.buffer) dimensionValueInput.value = pendingCommand.buffer;
    let invalid = pendingCommand.buffer === "";
    if (!invalid) {
      try {
        const value = pendingCommand.type === "distance-value"
          ? evaluateDimensionExpressionDraft(pendingCommand.constraint || null, pendingCommand.buffer)
          : Number(pendingCommand.buffer);
        invalid = !Number.isFinite(value) || value <= 0 || (pendingCommand.target?.kind === "angle" && value >= 180);
      } catch (_error) {
        invalid = true;
      }
    }
    dimensionValueInput.classList.toggle("is-invalid", invalid);
  }

  function focusDimensionValueInput() {
    requestAnimationFrame(() => {
      syncDimensionValueInput();
      if (dimensionValueInput?.hidden === false) {
        dimensionValueInput.focus();
        dimensionValueInput.select();
      }
    });
  }

  function drawSelectionRect() {
    if (!selectionRectSession?.current) return;
    const rect = rectFromPoints(selectionRectSession.start, selectionRectSession.current);
    withCanvasState(() => {
      ctx.strokeStyle = selectionRectSession.current.x < selectionRectSession.start.x ? "#f59e0b" : "#2563eb";
      ctx.fillStyle = selectionRectSession.current.x < selectionRectSession.start.x ? "rgba(245, 158, 11, 0.08)" : "rgba(37, 99, 235, 0.08)";
      ctx.lineWidth = 1.2 / viewport.scale;
      ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
      ctx.fillRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
      ctx.strokeRect(rect.x1, rect.y1, rect.x2 - rect.x1, rect.y2 - rect.y1);
    });
  }

  function extendedLineSegment(line, extension) {
    const len = line.length();
    if (len < 1e-12 || !Number.isFinite(extension) || extension <= 0) return { p1: line.p1, p2: line.p2 };
    const ux = line.dx() / len;
    const uy = line.dy() / len;
    return {
      p1: { x: line.p1.x - ux * extension, y: line.p1.y - uy * extension },
      p2: { x: line.p2.x + ux * extension, y: line.p2.y + uy * extension },
    };
  }

  function lineDisplaySegment(line, appearance = effectiveAppearanceForElement(line)) {
    return line.construction && appearance.endpointOverhang !== false
      ? extendedLineSegment(line, CONSTRUCTION_EXTENSION_SCREEN_PX / viewport.scale)
      : { p1: line.p1, p2: line.p2 };
  }

  function drawLines() {
    ctx.save();
    for (const l of drawOrderBySketch(allGeometryLines())) {
      const appearance = effectiveAppearanceForElement(l);
      const active = isEditableSketchElement(l);
      const refSelected = isPendingReferenceTarget(l) || isConstraintOperandSelected(l);
      const treeHovered = isSidebarHighlightedElement(l);
      const sidebarHovered = isSidebarHoveredElement(l);
      const relatedHighlighted = isSelectedConstraintRelatedElement(l);
      const auxiliaryHighlighted = relatedHighlighted;
      const blockSelected = l.blockInstance && selectedBlockInstances.includes(l.blockInstance);
      const geometrySelected = (active && selectedLines.includes(l)) || refSelected;
      const sel = blockSelected || geometrySelected;
      const canvasHovered = (active || isReferenceHoverElement(l)) && hoveredLine === l;
      const directlyHovered = treeHovered || sidebarHovered || canvasHovered;
      const hovered = directlyHovered || (l.blockInstance && hoveredBlockInstance === l.blockInstance);
      const construction = Boolean(l.construction);
      ctx.globalAlpha = sketchAlpha(l) * (construction && !sel && !hovered && !auxiliaryHighlighted ? CONSTRUCTION_GEOMETRY_ALPHA : 1);
      const lineColor = auxiliaryHighlighted ? "#0ea5e9" : geometryDisplayColor(l, appearance, sel, hovered);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = geometryStrokeWidth(l, { auxiliaryHighlighted, selected: sel, hovered, appearance, construction }) / viewport.scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(appearanceLineDash(appearance.lineType));
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      const drawSegment = lineDisplaySegment(l, appearance);
      ctx.beginPath();
      ctx.moveTo(drawSegment.p1.x, drawSegment.p1.y);
      ctx.lineTo(drawSegment.p2.x, drawSegment.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      if (construction && appearance.endpointMarkers !== false && !viewState.constraintStatus) {
        ctx.fillStyle = lineColor;
        const endpointRadius = 2.4 / viewport.scale;
        for (const p of [l.p1, l.p2]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, endpointRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (viewState.geometryIds || geometrySelected || sidebarHovered || canvasHovered || relatedHighlighted) {
        const mx = (l.p1.x + l.p2.x) / 2;
        const my = (l.p1.y + l.p2.y) / 2;
        ctx.fillStyle = "#2563eb";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(l.id, mx + 4 / viewport.scale, my - 4 / viewport.scale);
      }
    }
    ctx.restore();
  }

  function drawCircles() {
    ctx.save();
    ctx.lineCap = "round";
    for (const c of drawOrderBySketch(allGeometryCircles())) {
      const appearance = effectiveAppearanceForElement(c);
      const active = isEditableSketchElement(c);
      const refSelected = isPendingReferenceTarget(c) || isConstraintOperandSelected(c);
      const treeHovered = isSidebarHighlightedElement(c);
      const sidebarHovered = isSidebarHoveredElement(c);
      const relatedHighlighted = isSelectedConstraintRelatedElement(c);
      const auxiliaryHighlighted = relatedHighlighted;
      const blockSelected = c.blockInstance && selectedBlockInstances.includes(c.blockInstance);
      const geometrySelected = (active && selectedCircles.includes(c)) || refSelected;
      const sel = blockSelected || geometrySelected;
      const canvasHovered = (active || isReferenceHoverElement(c)) && hoveredCircle === c;
      const directlyHovered = treeHovered || sidebarHovered || canvasHovered;
      const hovered = directlyHovered || (c.blockInstance && hoveredBlockInstance === c.blockInstance);
      const construction = Boolean(c.construction) && !sel && !hovered;
      ctx.globalAlpha = sketchAlpha(c) * (construction && !auxiliaryHighlighted ? CONSTRUCTION_GEOMETRY_ALPHA : 1);
      ctx.strokeStyle = auxiliaryHighlighted ? "#0ea5e9" : geometryDisplayColor(c, appearance, sel, hovered);
      ctx.lineWidth = geometryStrokeWidth(c, { auxiliaryHighlighted, selected: sel, hovered, appearance, construction }) / viewport.scale;
      ctx.setLineDash(appearanceLineDash(appearance.lineType));
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      ctx.beginPath();
      ctx.arc(c.center.x, c.center.y, c.radius(), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      if (viewState.geometryIds || geometrySelected || sidebarHovered || canvasHovered || relatedHighlighted) {
        ctx.fillStyle = "#2563eb";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(c.id, c.center.x + c.radius() + 4 / viewport.scale, c.center.y - 4 / viewport.scale);
      }
    }
    ctx.restore();
  }

  function drawArcs() {
    ctx.save();
    ctx.lineCap = "round";
    for (const a of drawOrderBySketch(allGeometryArcs())) {
      const appearance = effectiveAppearanceForElement(a);
      const active = isEditableSketchElement(a);
      const refSelected = isPendingReferenceTarget(a) || isConstraintOperandSelected(a);
      const treeHovered = isSidebarHighlightedElement(a);
      const sidebarHovered = isSidebarHoveredElement(a);
      const relatedHighlighted = isSelectedConstraintRelatedElement(a);
      const auxiliaryHighlighted = relatedHighlighted;
      const blockSelected = a.blockInstance && selectedBlockInstances.includes(a.blockInstance);
      const geometrySelected = (active && selectedArcs.includes(a)) || refSelected;
      const sel = blockSelected || geometrySelected;
      const canvasHovered = (active || isReferenceHoverElement(a)) && hoveredArc === a;
      const directlyHovered = treeHovered || sidebarHovered || canvasHovered;
      const hovered = directlyHovered || (a.blockInstance && hoveredBlockInstance === a.blockInstance);
      const construction = Boolean(a.construction) && !sel && !hovered;
      ctx.globalAlpha = sketchAlpha(a) * (construction && !auxiliaryHighlighted ? CONSTRUCTION_GEOMETRY_ALPHA : 1);
      ctx.strokeStyle = auxiliaryHighlighted ? "#0ea5e9" : geometryDisplayColor(a, appearance, sel, hovered);
      ctx.lineWidth = geometryStrokeWidth(a, { auxiliaryHighlighted, selected: sel, hovered, appearance, construction }) / viewport.scale;
      ctx.setLineDash(appearanceLineDash(appearance.lineType));
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      ctx.beginPath();
      ctx.arc(a.center.x, a.center.y, a.radius(), a.startAngle, a.endAngle, a.endAngle < a.startAngle);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      if (viewState.geometryIds || geometrySelected || sidebarHovered || canvasHovered || relatedHighlighted) {
        const mid = a.startAngle + arcSweep(a) / 2;
        ctx.fillStyle = "#2563eb";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(a.id, a.center.x + Math.cos(mid) * a.radius(), a.center.y + Math.sin(mid) * a.radius());
      }
    }
    ctx.restore();
  }

  function drawDimension(target, dimension, label, preview = false, highlighted = false, editState = null) {
    if (!target || !dimension) return;
    if (target.kind === "angle") return drawAngleDimension(target, dimension, label, preview, highlighted, editState);
    const layout = dimensionLayout(target, dimension);
    if (!layout) return;
    const { a, b, lineA, lineB, points, d, text, textAngle } = layout;

    ctx.save();
    ctx.strokeStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.fillStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.lineWidth = (highlighted ? 2 : 1.2) / viewport.scale;
    ctx.setLineDash(preview ? [5 / viewport.scale, 4 / viewport.scale] : []);
    ctx.beginPath();
    ctx.moveTo((lineA || a).x, (lineA || a).y);
    ctx.lineTo((lineB || b).x, (lineB || b).y);
    ctx.stroke();

    for (const p of points) {
      if (dimension?.display?.extensionLines === false) continue;
      if (p.showExtension === false) continue;
      ctx.beginPath();
      ctx.moveTo(p.extensionStart.x, p.extensionStart.y);
      ctx.lineTo(p.extensionEnd.x, p.extensionEnd.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    if (dimension?.display?.arrows !== false) {
      drawArrowhead(a, d);
      drawArrowhead(b, { x: -d.x, y: -d.y });
    }

    drawDimensionLabel(label, text, textAngle, editState);
    ctx.restore();
  }

  function drawAngleDimension(target, dimension, label, preview = false, highlighted = false, editState = null) {
    const layout = angleDimensionLayout(target, dimension);
    if (!layout) return;
    const { vertex, radius, start, end, signed, text, textAngle } = layout;
    ctx.save();
    ctx.strokeStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.fillStyle = preview || highlighted ? "#2563eb" : "#6b7280";
    ctx.lineWidth = (highlighted ? 2 : 1.2) / viewport.scale;
    ctx.setLineDash(preview ? [5 / viewport.scale, 4 / viewport.scale] : []);
    const extension = DIMENSION_EXTENSION_SCREEN_PX / viewport.scale;
    const gap = DIMENSION_EXTENSION_GAP_SCREEN_PX / viewport.scale;
    const visibleGap = Math.min(gap, Math.max(0, radius - 2 / viewport.scale));
    const p1 = { x: vertex.x + Math.cos(start) * radius, y: vertex.y + Math.sin(start) * radius };
    const p2 = { x: vertex.x + Math.cos(end) * radius, y: vertex.y + Math.sin(end) * radius };
    const s1 = { x: vertex.x + Math.cos(start) * visibleGap, y: vertex.y + Math.sin(start) * visibleGap };
    const s2 = { x: vertex.x + Math.cos(end) * visibleGap, y: vertex.y + Math.sin(end) * visibleGap };
    const e1 = { x: vertex.x + Math.cos(start) * (radius + extension), y: vertex.y + Math.sin(start) * (radius + extension) };
    const e2 = { x: vertex.x + Math.cos(end) * (radius + extension), y: vertex.y + Math.sin(end) * (radius + extension) };
    if (dimension?.display?.extensionLines !== false) {
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(e1.x, e1.y);
      ctx.moveTo(s2.x, s2.y);
      ctx.lineTo(e2.x, e2.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(vertex.x, vertex.y, radius, start, end, signed < 0);
    ctx.stroke();
    ctx.setLineDash([]);
    if (dimension?.display?.arrows !== false) {
      drawArrowhead(p1, { x: Math.cos(start + (signed < 0 ? -Math.PI / 2 : Math.PI / 2)), y: Math.sin(start + (signed < 0 ? -Math.PI / 2 : Math.PI / 2)) });
      drawArrowhead(p2, { x: Math.cos(end + (signed < 0 ? Math.PI / 2 : -Math.PI / 2)), y: Math.sin(end + (signed < 0 ? Math.PI / 2 : -Math.PI / 2)) });
    }
    drawDimensionLabel(label, text, textAngle, editState);
    ctx.restore();
  }

  function jisDimensionTextAngle(direction) {
    const x = Number(direction?.x) || 0;
    const y = Number(direction?.y) || 0;
    // JIS aligned notation: horizontal text is read from the bottom edge and
    // vertical text from the right edge. Non-vertical text always progresses
    // left-to-right; an exact vertical always progresses bottom-to-top.
    if (Math.abs(x) <= 1e-12 && Math.abs(y) > 1e-12) return -Math.PI / 2;
    let angle = Math.atan2(y, x);
    if (angle >= Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    return angle;
  }

  function dimensionTextOffset(angle, distance) {
    return {
      x: Math.sin(angle) * distance,
      y: -Math.cos(angle) * distance,
    };
  }

  function drawDimensionLabel(label, text, angle = 0, editState = null) {
    if (editState?.hidden) return;
    if (editState) {
      drawDimensionEditLabel(label, text, angle, editState);
    } else {
      ctx.save();
      ctx.translate(text.x, text.y);
      ctx.rotate(angle);
      ctx.font = `${12 / viewport.scale}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, 0, -4 / viewport.scale);
      ctx.restore();
    }
  }

  function drawDimensionEditLabel(label, text, angle, state) {
    const fontSize = 12 / viewport.scale;
    const padX = 6 / viewport.scale;
    const padY = 4 / viewport.scale;
    const height = 22 / viewport.scale;
    ctx.save();
    ctx.translate(text.x, text.y);
    ctx.rotate(angle);
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = Math.max(44 / viewport.scale, ctx.measureText(label).width + padX * 2);
    const x = -width / 2;
    const y = -height - 4 / viewport.scale;
    const border = state.invalid ? "#dc2626" : "#2563eb";

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5 / viewport.scale;
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.fill();
    ctx.stroke();

    if (state.selecting && !state.invalid) {
      ctx.fillStyle = "#dbeafe";
      ctx.fillRect(x + padX / 2, y + padY / 2, width - padX, height - padY);
    }

    ctx.fillStyle = border;
    ctx.fillText(label, 0, y + height / 2);
    ctx.restore();
  }

  function dimensionLayout(target, dimension) {
    if (target.kind === "angle") return angleDimensionLayout(target, dimension);
    const anchor = dimensionAnchor(target, dimension);
    const basisTarget = { ...target, dimensionAxis: storedDimensionAxis(target, dimension) };
    const radial = target.kind === "radius" || target.kind === "diameter" || (target.kind === "offset-distance" && !(target.source instanceof Line));
    const d = radial ? targetDirection({ ...basisTarget, dimensionAnchor: anchor }) : targetDirection(basisTarget);
    const points = targetPointsForDimension(target, anchor);
    if (points.length < 2) return null;
    const tick = 9 / viewport.scale;
    const extension = DIMENSION_EXTENSION_SCREEN_PX / viewport.scale;
    const gap = DIMENSION_EXTENSION_GAP_SCREEN_PX / viewport.scale;
    const projectedPoints = points.map((source, index) => {
      const t = (source.x - anchor.x) * d.x + (source.y - anchor.y) * d.y;
      const onDimension = { x: anchor.x + d.x * t, y: anchor.y + d.y * t };
      const ex = onDimension.x - source.x;
      const ey = onDimension.y - source.y;
      const el = hypot2(ex, ey);
      const ux = el > 1e-12 ? ex / el : d.x;
      const uy = el > 1e-12 ? ey / el : d.y;
      const extensionDirection = { x: ux, y: uy };
      const pointClearance = dimensionPointSourceClearance(target, index, source, extensionDirection);
      const constructionClearance = dimensionConstructionExtensionClearance(target, index, source, extensionDirection);
      const visibleGap = Math.min(gap + pointClearance + constructionClearance, Math.max(0, el - 2 / viewport.scale));
      return {
        source,
        projection: t,
        showExtension: shouldShowDimensionExtension(target, index, { source, onDimension, extensionDirection }),
        extensionStart: {
          x: source.x + ux * visibleGap,
          y: source.y + uy * visibleGap,
        },
        onDimension,
        extensionEnd: {
          x: onDimension.x + ux * extension,
          y: onDimension.y + uy * extension,
        },
      };
    });
    const projections = projectedPoints.map((p) => p.projection);
    const min = Math.min(...projections);
    const max = Math.max(...projections);
    const a = { x: anchor.x + d.x * min, y: anchor.y + d.y * min };
    const b = { x: anchor.x + d.x * max, y: anchor.y + d.y * max };
    const labelOffset = Number(dimension?.labelOffsetU) || 0;
    const textProjection = (min + max) / 2 + labelOffset;
    const labelPad = 18 / viewport.scale;
    const lineMin = Math.min(min, textProjection - labelPad);
    const lineMax = Math.max(max, textProjection + labelPad);
    const lineA = { x: anchor.x + d.x * lineMin, y: anchor.y + d.y * lineMin };
    const lineB = { x: anchor.x + d.x * lineMax, y: anchor.y + d.y * lineMax };
    return {
      a,
      b,
      lineA,
      lineB,
      d,
      textAngle: jisDimensionTextAngle(d),
      points: projectedPoints,
      text: { x: anchor.x + d.x * textProjection, y: anchor.y + d.y * textProjection },
      hitA: { x: lineA.x - d.x * tick, y: lineA.y - d.y * tick },
      hitB: { x: lineB.x + d.x * tick, y: lineB.y + d.y * tick },
    };
  }

  function incidentLinesAtPoint(point) {
    if (!point) return [];
    return model.lines.filter((line) => line.p1 === point || line.p2 === point);
  }

  function chooseIncidentLineForExtension(point, extensionDirection = null) {
    const candidates = incidentLinesAtPoint(point).filter(lineHasDirection);
    if (candidates.length === 0) return null;
    if (!extensionDirection) return candidates[0];
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const line of candidates) {
      const u = lineUnit(line);
      const score = Math.abs(u.x * extensionDirection.x + u.y * extensionDirection.y);
      if (score > bestScore) {
        bestScore = score;
        best = line;
      }
    }
    return best;
  }

  function dimensionSourceLine(target, index, source = null, extensionDirection = null) {
    if (target.kind === "point-line" && index === 1) return target.line;
    if (target.kind === "line-line") return index === 0 ? target.line1 : target.line2;
    if (target.kind === "line-length") return target.line;
    if (target.kind === "offset-distance" && target.source instanceof Line) return index === 0 ? target.source : target.offset;
    if (target.kind === "point-point") return null;
    if (source instanceof Point) return chooseIncidentLineForExtension(source, extensionDirection);
    return null;
  }

  function lineOutwardDirectionAtSource(line, source) {
    const u = lineUnit(line);
    const tol = Math.max(MIN_LINE_LENGTH * 10, 1e-7);
    const d1 = hypot2(source.x - line.p1.x, source.y - line.p1.y);
    const d2 = hypot2(source.x - line.p2.x, source.y - line.p2.y);
    if (d1 <= tol && d1 <= d2) return { x: -u.x, y: -u.y, endpoint: "p1" };
    if (d2 <= tol) return { x: u.x, y: u.y, endpoint: "p2" };
    return null;
  }

  function shouldShowDimensionExtension(target, index, context = {}) {
    const line = dimensionSourceLine(target, index, context.source, context.extensionDirection);
    if (!line || !context.source || !context.onDimension) return true;
    const vx = context.onDimension.x - context.source.x;
    const vy = context.onDimension.y - context.source.y;
    const len = hypot2(vx, vy);
    if (len <= 1e-12) return false;
    const v = { x: vx / len, y: vy / len };
    const u = lineUnit(line);
    const parallel = Math.abs(v.x * u.y - v.y * u.x) <= 0.08;
    if (!parallel) return true;
    const outward = lineOutwardDirectionAtSource(line, context.source);
    if (!outward) return false;
    return v.x * outward.x + v.y * outward.y > 0.1;
  }

  function dimensionPointSourceClearance(target, index, source = null, extensionDirection = null) {
    if (!(source instanceof Point)) return 0;
    if (dimensionSourceLine(target, index, source, extensionDirection)) return 0;
    return DIMENSION_POINT_MARKER_RADIUS_SCREEN_PX / viewport.scale;
  }

  function dimensionConstructionExtensionClearance(target, index, source = null, extensionDirection = null) {
    if (!source || !extensionDirection) return 0;
    const line = dimensionSourceLine(target, index, source, extensionDirection);
    if (!line?.construction) return 0;
    if (effectiveAppearanceForElement(line).endpointOverhang === false) return 0;
    const outward = lineOutwardDirectionAtSource(line, source);
    if (!outward) return 0;
    const directionalComponent = outward.x * extensionDirection.x + outward.y * extensionDirection.y;
    return Math.max(0, directionalComponent) * (CONSTRUCTION_EXTENSION_SCREEN_PX / viewport.scale);
  }

  function angleDimensionLayout(target, dimension) {
    migrateAngleDimensionLabelPlacement(target, dimension);
    const vertex = lineIntersection(target.line1, target.line2);
    if (!vertex) return null;
    const anchor = dimensionAnchor(target, dimension);
    const radius = Math.max(14 / viewport.scale, hypot2(anchor.x - vertex.x, anchor.y - vertex.y));
    const { start, end, signed, mid } = angleDimensionAngles(target, anchor, dimension);
    const radial = { x: Math.cos(mid), y: Math.sin(mid) };
    const tangent = { x: -radial.y, y: radial.x };
    const arcPoint = { x: vertex.x + radial.x * radius, y: vertex.y + radial.y * radius };
    const labelOffsets = angleDimensionLabelOffsets(target, dimension);
    const labelOffsetR = labelOffsets ? labelOffsets.radial : 14 / viewport.scale;
    const labelOffsetT = labelOffsets ? labelOffsets.tangent : 0;
    return {
      vertex,
      radius,
      start,
      end,
      signed,
      textAngle: jisDimensionTextAngle(tangent),
      text: {
        x: arcPoint.x + radial.x * labelOffsetR + tangent.x * labelOffsetT,
        y: arcPoint.y + radial.y * labelOffsetR + tangent.y * labelOffsetT,
      },
      hitA: { x: vertex.x + Math.cos(start) * radius, y: vertex.y + Math.sin(start) * radius },
      hitB: { x: vertex.x + Math.cos(end) * radius, y: vertex.y + Math.sin(end) * radius },
    };
  }

  function drawArrowhead(point, direction) {
    const size = DIMENSION_ARROW_LENGTH_SCREEN_PX / viewport.scale;
    const wing = DIMENSION_ARROW_HALF_WIDTH_SCREEN_PX / viewport.scale;
    const n = { x: -direction.y, y: direction.x };
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + direction.x * size + n.x * wing, point.y + direction.y * size + n.y * wing);
    ctx.lineTo(point.x + direction.x * size - n.x * wing, point.y + direction.y * size - n.y * wing);
    ctx.closePath();
    ctx.fill();
  }

  function drawDimensions() {
    for (const c of [...model.constraints].sort((a, b) => Number(isActiveSketchConstraint(a)) - Number(isActiveSketchConstraint(b)))) {
      if (!isVisibleSketchId(constraintSketchId(c))) continue;
      const target = targetFromConstraint(c);
      if (!target) continue;
      const dimension = c.dimension || defaultDimensionForTarget(target);
      if (!viewState.constraintStatus && dimension?.display?.visible === false) continue;
      const highlighted = c === hoveredDimensionConstraint || c === selectedDimensionConstraint || c === dimensionDragSession?.constraint;
      const label = dimensionLabelForConstraint(c, target, dimension);
      const editing = pendingCommand?.type === "distance-value" && pendingCommand.constraint === c;
      ctx.save();
      drawDimension(target, dimension, label, false, highlighted || editing, editing ? { hidden: true } : null);
      ctx.restore();
    }
  }

  function drawAnnotations() {
    for (const element of model.annotations) {
      if (element.visible === false) continue;
      if (element.type === "leader") drawAnnotationLeader(element);
      else if (element.type === "text") drawAnnotationText(element);
    }
  }

  function drawAnnotationText(element) {
    ctx.save();
    ctx.font = `${Number(element.style?.fontSize || 13) / viewport.scale}px system-ui`;
    ctx.fillStyle = element === selectedAnnotation ? "#2563eb" : element === hoveredAnnotation ? "#0ea5e9" : element.style?.color || "#111827";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(element.text || "", element.x, element.y);
    ctx.restore();
  }

  function drawAnnotationLeader(element, preview = false) {
    if (!element.start || !element.end) return;
    const start = preview ? element.start : annotationLeaderAnchor(element);
    if (!start) return;
    const elbow = element.elbow || {
      x: (start.x + element.end.x) / 2,
      y: element.end.y,
    };
    withCanvasState(() => {
      const color = element === selectedAnnotation ? "#2563eb" : element === hoveredAnnotation ? "#0ea5e9" : element.style?.color || "#111827";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Number(element.style?.lineWidth || 1.4) / viewport.scale;
      if (preview) ctx.setLineDash([5 / viewport.scale, 4 / viewport.scale]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(elbow.x, elbow.y);
      ctx.lineTo(element.end.x, element.end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const dx = elbow.x - start.x;
      const dy = elbow.y - start.y;
      const len = Math.max(1e-9, hypot2(dx, dy));
      drawArrowhead(start, { x: dx / len, y: dy / len });
      if (element.text) drawAnnotationText(element);
    });
  }

  function textHitBox(text, x, y, fontSize = 13) {
    const width = Math.max(28, String(text || "").length * fontSize * 0.62);
    const height = fontSize + 10;
    return {
      left: x - width / 2,
      right: x + width / 2,
      top: y - height / 2,
      bottom: y + height / 2,
    };
  }

  function pointInExpandedBox(x, y, box, padding) {
    return x >= box.left - padding && x <= box.right + padding && y >= box.top - padding && y <= box.bottom + padding;
  }

  function boxFromPoints(points) {
    const valid = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (valid.length === 0) return null;
    return {
      left: Math.min(...valid.map((p) => p.x)),
      right: Math.max(...valid.map((p) => p.x)),
      top: Math.min(...valid.map((p) => p.y)),
      bottom: Math.max(...valid.map((p) => p.y)),
    };
  }

  function hitAnnotationElement(x, y) {
    const threshold = 12 / viewport.scale;
    for (let i = model.annotations.length - 1; i >= 0; i--) {
      const element = model.annotations[i];
      if (!element || element.visible === false) continue;
      if (element.type === "leader") {
        const start = annotationLeaderAnchor(element);
        if (!start || !element.end) continue;
        const elbow = element.elbow || { x: (start.x + element.end.x) / 2, y: element.end.y };
        if (distancePointToSegmentPoints(x, y, start, elbow) <= threshold * 2.2 || distancePointToSegmentPoints(x, y, elbow, element.end) <= threshold * 2.2) return { element, type: "leader", part: "line" };
        if (pointInExpandedBox(x, y, textHitBox(element.text, element.x, element.y, Number(element.style?.fontSize || 13) / viewport.scale), threshold)) return { element, type: "leader", part: "label" };
        if (hypot2(x - element.x, y - element.y) <= threshold * 3) return { element, type: "leader", part: "label" };
        const leaderBox = boxFromPoints([start, elbow, element.end, { x: element.x, y: element.y }]);
        if (leaderBox && pointInExpandedBox(x, y, leaderBox, threshold * 2.2)) return { element, type: "leader", part: "line" };
      } else if (element.type === "text") {
        if (pointInExpandedBox(x, y, textHitBox(element.text, element.x, element.y, Number(element.style?.fontSize || 13) / viewport.scale), threshold)) return { element, type: "text", part: "label" };
      }
    }
    return null;
  }

  function annotationById(id) {
    return id ? model.annotations.find((element) => element.id === id) || null : null;
  }

  function beginAnnotationDrag(e, hit, pointer) {
    annotationDragSession = {
      pointerId: e.pointerId,
      elementId: hit.element?.id || null,
      hit,
      startPointer: pointer,
      startEnd: hit.element?.end ? { ...hit.element.end } : null,
      startElbow: hit.element?.elbow ? { ...hit.element.elbow } : null,
      startText: hit.element ? { x: hit.element.x, y: hit.element.y } : null,
    };
    selectedAnnotation = hit.element;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-dragging");
    setHint(hit.type === "leader" ? "引出線を移動中" : "テキストを移動中");
  }

  function updateAnnotationDrag(pointer) {
    const session = annotationDragSession;
    if (!session) return;
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    const element = annotationById(session.elementId) || session.hit.element;
    if (!element) return;
    if (session.hit.type === "leader") {
      if (session.startEnd) element.end = { x: session.startEnd.x + dx, y: session.startEnd.y + dy };
      if (session.startElbow) element.elbow = { x: session.startElbow.x + dx, y: session.startElbow.y + dy };
      if (session.startText) {
        element.x = session.startText.x + dx;
        element.y = session.startText.y + dy;
      }
    } else if (session.hit.type === "text" && session.startText) {
      element.x = session.startText.x + dx;
      element.y = session.startText.y + dy;
    }
    draw();
  }

  function drawDimensionPreview() {
    if (pendingCommand?.type === "fillet-radius-value") {
      const value = Number(pendingCommand.buffer);
      const radius = Number.isFinite(value) && value > 0 ? value : DEFAULT_FILLET_RADIUS;
      const geometry = computeFilletGeometry(pendingCommand.line1, pendingCommand.line2, radius);
      if (!geometry.ok) return;
      const primitive = {
        id: "R",
        center: geometry.center,
        radius: () => geometry.radius,
      };
      const target = { kind: "radius", primitive, value: radius };
      const anchor = {
        x: geometry.center.x + Math.cos((geometry.startAngle + geometry.endAngle) / 2) * geometry.radius,
        y: geometry.center.y + Math.sin((geometry.startAngle + geometry.endAngle) / 2) * geometry.radius,
      };
      drawFilletPreviewArc(geometry);
      const invalid = pendingCommand.buffer === "" || !Number.isFinite(value) || value <= 0 || !geometry.ok;
      drawDimension(target, dimensionFromAnchor(target, anchor), `R${pendingCommand.buffer || "_"}|`, true, false, {
        selecting: !pendingCommand.editing,
        invalid,
        hidden: true,
      });
      return;
    }
    if (!pendingCommand?.type?.startsWith("distance")) return;
    const dimension =
      pendingCommand.type === "distance-place"
        ? pendingCommand.dimension || applyDefaultCircleDimensionLabelOffset(pendingCommand.target, pendingCommand.pointer ? dimensionFromAnchor(pendingCommand.target, pendingCommand.pointer) : defaultDimensionForTarget(pendingCommand.target))
        : pendingCommand.dimension;
    if (pendingCommand.type === "distance-value") {
      let value = NaN;
      let invalid = false;
      try {
        value = evaluateDimensionExpressionDraft(pendingCommand.constraint || null, pendingCommand.buffer);
        invalid = value <= 0 || (pendingCommand.target.kind === "angle" && value >= 180);
      } catch (_error) {
        invalid = true;
      }
      const suffix = pendingCommand.target.kind === "angle" ? "°" : "";
      drawDimension(pendingCommand.target, dimension, `${Number.isFinite(value) ? formatDisplayNumber(value) : "_"}${suffix}|`, true, false, {
        selecting: !pendingCommand.editing,
        invalid,
        hidden: true,
      });
      return;
    }
    const previewTarget =
      pendingCommand.target.kind === "point-point" && (dimension.axis === "x" || dimension.axis === "y")
        ? { ...pendingCommand.target, dimensionAxis: dimension.axis }
        : pendingCommand.target;
    const previewValue =
      previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "x"
        ? Math.abs(previewTarget.p2.x - previewTarget.p1.x)
        : previewTarget.kind === "point-point" && previewTarget.dimensionAxis === "y"
          ? Math.abs(previewTarget.p2.y - previewTarget.p1.y)
          : previewTarget.kind === "angle"
            ? angleDegrees(angleDimensionAngles(previewTarget, pendingCommand.pointer || dimensionAnchor(previewTarget, dimension), dimension).signed)
          : previewTarget.value;
    const label = previewTarget.kind === "angle" ? formatDimensionLabel(previewValue, "°") : formatDimensionLabel(previewValue);
    drawDimension(previewTarget, dimensionWithLabelAt(previewTarget, dimension, pendingCommand.pointer), label, true);
  }

  function drawFilletPreviewArc(geometry) {
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, geometry.startAngle, geometry.endAngle, geometry.endAngle < geometry.startAngle);
      ctx.stroke();
    });
  }

  function drawTemporaryLine() {
    if (mode !== "line" || !lineStartPoint) return;
    const target = pointerPreview || lineStartPoint;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.moveTo(lineStartPoint.x, lineStartPoint.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(lineStartPoint.x, lineStartPoint.y, 12 / viewport.scale, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawRectanglePreview() {
    if (mode !== "rectangle" || !rectangleStartPoint || !pointerPreview) return;
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.strokeRect(rectangleStartPoint.x, rectangleStartPoint.y, pointerPreview.x - rectangleStartPoint.x, pointerPreview.y - rectangleStartPoint.y);
    });
  }

  function drawCirclePreview() {
    if (mode !== "circle" || !circleCenterPoint || !pointerPreview) return;
    const radius = hypot2(pointerPreview.x - circleCenterPoint.x, pointerPreview.y - circleCenterPoint.y);
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(circleCenterPoint.x, circleCenterPoint.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawArcPreview() {
    if (mode !== "arc" || !arcCenterPoint) return;
    if (!arcStartPoint) {
      drawConstructionPoint(arcCenterPoint);
      return;
    }
    if (!pointerPreview) return;
    const angles = {
      start: arcStartPoint.startAngle,
      end: shortestAngleFrom(arcStartPoint.startAngle, Math.atan2(pointerPreview.y - arcCenterPoint.y, pointerPreview.x - arcCenterPoint.x)),
    };
    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      ctx.arc(arcCenterPoint.x, arcCenterPoint.y, arcStartPoint.radius, angles.start, angles.end, angles.end < angles.start);
      ctx.stroke();
    });
    drawConstructionPoint(arcCenterPoint);
  }

  function drawOffsetPreview() {
    if (mode !== "offset" || !offsetSource) return;
    const pointer = pendingCommand?.type === "offset-value" ? pendingCommand.pointer : pointerPreview;
    if (!pointer) return;
    const measured = offsetDistanceFromPointer(offsetSource, pointer);
    const sign = pendingCommand?.type === "offset-value" ? pendingCommand.sign : measured.sign;
    const inputValue = pendingCommand?.type === "offset-value" ? Number(pendingCommand.buffer) : measured.distance;
    const distance = Number.isFinite(inputValue) && inputValue > 0 ? inputValue : measured.distance;
    const offset = offsetDraftGeometry(offsetSource, distance, sign);
    if (!offset) return;

    withCanvasState(() => {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2 / viewport.scale;
      ctx.setLineDash([6 / viewport.scale, 5 / viewport.scale]);
      ctx.beginPath();
      if (offset instanceof Line) {
        ctx.moveTo(offset.p1.x, offset.p1.y);
        ctx.lineTo(offset.p2.x, offset.p2.y);
      } else if (offset instanceof Circle) {
        ctx.arc(offset.center.x, offset.center.y, offset.radius(), 0, Math.PI * 2);
      } else {
        ctx.arc(offset.center.x, offset.center.y, offset.radius(), offset.startAngle, offset.endAngle, offset.endAngle < offset.startAngle);
      }
      ctx.stroke();
    });

    const target = offsetDimensionTarget(offsetSource, offset, distance, sign);
    const dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer, { allowPointAxis: false }), pointer);
    if (pendingCommand?.type === "offset-value") {
      pendingCommand.target = target;
      pendingCommand.dimension = dimension;
    }
    drawDimension(target, dimension, formatDimensionLabel(distance), true);
  }

  function drawTrimPreview() {
    if (mode !== "trim" || !trimPreview) return;
    withCanvasState(() => {
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 4 / viewport.scale;
      ctx.lineCap = "round";
      ctx.setLineDash([8 / viewport.scale, 5 / viewport.scale]);
      if (trimPreview.kind === "line") {
        ctx.beginPath();
        ctx.moveTo(trimPreview.interval.left.point.x, trimPreview.interval.left.point.y);
        ctx.lineTo(trimPreview.interval.right.point.x, trimPreview.interval.right.point.y);
        ctx.stroke();
      } else if (trimPreview.kind === "arc") {
        const arc = trimPreview.item;
        ctx.beginPath();
        ctx.arc(arc.center.x, arc.center.y, arc.radius(), angleAtArcParam(arc, trimPreview.interval.left.t), angleAtArcParam(arc, trimPreview.interval.right.t), arc.endAngle < arc.startAngle);
        ctx.stroke();
      } else if (trimPreview.kind === "circle") {
        const circle = trimPreview.item;
        ctx.beginPath();
        if (trimPreview.deleteWhole) ctx.arc(circle.center.x, circle.center.y, circle.radius(), 0, Math.PI * 2);
        else ctx.arc(circle.center.x, circle.center.y, circle.radius(), trimPreview.interval.left.angle, trimPreview.interval.right.angle);
        ctx.stroke();
      }
    });
  }

  function drawSnapMarker() {
    if (!activeSnap) return;
    ctx.save();
    const r = 6 / viewport.scale;
    ctx.strokeStyle = "#f59e0b";
    ctx.fillStyle = "#f59e0b";
    ctx.lineWidth = 1.5 / viewport.scale;
    ctx.beginPath();
    ctx.moveTo(activeSnap.x - r, activeSnap.y);
    ctx.lineTo(activeSnap.x + r, activeSnap.y);
    ctx.moveTo(activeSnap.x, activeSnap.y - r);
    ctx.lineTo(activeSnap.x, activeSnap.y + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(activeSnap.x, activeSnap.y, 3 / viewport.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${11 / viewport.scale}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const pointLike = Boolean(activeSnap.data?.point) || activeSnap.priority === 0;
    const labelX = activeSnap.x + 8 / viewport.scale;
    const labelY = activeSnap.y + (pointLike ? 20 : -8) / viewport.scale;
    const paddingX = 3 / viewport.scale;
    const paddingY = 2 / viewport.scale;
    const metrics = ctx.measureText(activeSnap.label);
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.fillRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, metrics.width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(activeSnap.label, labelX, labelY);
    ctx.restore();
  }

  function selectedSketchIdentityElement() {
    if (selectedArcEndpoint?.arc) return { id: `${selectedArcEndpoint.arc.id}端点`, sketchId: elementSketchId(selectedArcEndpoint.arc), item: selectedArcEndpoint.arc };
    const item = selectedPoints.at(-1) || selectedLines.at(-1) || selectedCircles.at(-1) || selectedArcs.at(-1);
    return item ? { id: item.id, sketchId: elementSketchId(item), item } : null;
  }

  function sketchIdentityRelationLabel(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "reference") return applicationText("参照可", "Reference available");
    if (relation === "descendant") return applicationText("参照不可（子孫）", "Not referenceable (descendant)");
    if (relation === "inactive") return applicationText("参照不可", "Not referenceable");
    return "";
  }

  function sketchIdentityRelationColor(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "reference") return "#1d4ed8";
    if (relation === "descendant") return "#b91c1c";
    return "#64748b";
  }

  function sketchIdentityRelationBackground(sketchId) {
    const relation = sketchRelationToActive(sketchId);
    if (relation === "reference") return "rgba(219, 234, 254, 0.96)";
    if (relation === "descendant") return "rgba(254, 226, 226, 0.96)";
    return "rgba(241, 245, 249, 0.96)";
  }

  function drawSketchIdentityLabel() {
    const identity = hoveredSketchIdentity || selectedSketchIdentityElement();
    const pointer = lastPointerWorld;
    if (!identity || !pointer || !isVisibleSketchId(identity.sketchId) || identity.sketchId === activeSketchId()) return;
    const baseLabel = `${identity.label || identity.id} / ${sketchName(identity.sketchId)}`;
    const relationLabel = sketchIdentityRelationLabel(identity.sketchId);
    const separator = relationLabel ? " / " : "";
    ctx.save();
    ctx.font = `${11 / viewport.scale}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const paddingX = 4 / viewport.scale;
    const paddingY = 2 / viewport.scale;
    const labelX = pointer.x + 14 / viewport.scale;
    const labelY = pointer.y + 26 / viewport.scale;
    const baseWidth = ctx.measureText(baseLabel).width;
    const separatorWidth = ctx.measureText(separator).width;
    const relationWidth = relationLabel ? ctx.measureText(relationLabel).width : 0;
    const width = baseWidth + separatorWidth + relationWidth;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
    ctx.lineWidth = 1 / viewport.scale;
    ctx.strokeRect(labelX - paddingX, labelY - 12 / viewport.scale - paddingY, width + paddingX * 2, 14 / viewport.scale + paddingY * 2);
    ctx.fillStyle = "#64748b";
    ctx.fillText(baseLabel, labelX, labelY);
    if (relationLabel) {
      const relationX = labelX + baseWidth + separatorWidth;
      const relationPadX = 4 / viewport.scale;
      const relationPadY = 1 / viewport.scale;
      ctx.fillText(separator, labelX + baseWidth, labelY);
      ctx.fillStyle = sketchIdentityRelationBackground(identity.sketchId);
      ctx.fillRect(relationX - relationPadX, labelY - 12 / viewport.scale - relationPadY, relationWidth + relationPadX * 2, 14 / viewport.scale + relationPadY * 2);
      ctx.fillStyle = sketchIdentityRelationColor(identity.sketchId);
      ctx.font = `700 ${11 / viewport.scale}px system-ui`;
      ctx.fillText(relationLabel, relationX, labelY);
    }
    ctx.restore();
  }

  function drawConstructionPoint(point) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5 / viewport.scale, 0, Math.PI * 2);
    ctx.fillStyle = "#eff6ff";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2 / viewport.scale;
    ctx.stroke();
    ctx.restore();
  }

  function shouldShowPrimitiveCenter(point) {
    if (selectedCircles.some((circle) => circle.center === point) || selectedArcs.some((arc) => arc.center === point)) return true;
    if (hoveredCircle?.center === point || hoveredArc?.center === point || hoveredArcEndpoint?.arc?.center === point) return true;
    if (hoveredSidebarItem?.item?.center === point) return true;
    if ((dragSession?.kind === "circle" || dragSession?.kind === "arc" || dragSession?.kind === "arc-endpoint") && dragSession.item?.center === point) return true;
    return false;
  }

  function shouldShowArcEndpointHandle(arc, endpoint) {
    if (selectedArcs.includes(arc) || hoveredArc === arc) return true;
    if (sameArcEndpoint(hoveredArcEndpoint, { arc, endpoint }) || sameArcEndpoint(selectedArcEndpoint, { arc, endpoint })) return true;
    if (selectedArcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint }))) return true;
    if (dragSession?.kind === "arc-endpoint" && dragSession.item === arc && dragSession.endpoint === endpoint) return true;
    return false;
  }

  function drawArcEndpointHandles() {
    ctx.save();
    for (const arc of allGeometryArcs()) {
      if (!isEditableSketchElement(arc)) continue;
      for (const endpoint of ["start", "end"]) {
        if (!shouldShowArcEndpointHandle(arc, endpoint)) continue;
        const p = arcEndpointPoint(arc, endpoint);
        const selected = sameArcEndpoint(selectedArcEndpoint, { arc, endpoint }) || selectedArcEndpointPair?.some((item) => sameArcEndpoint(item, { arc, endpoint })) || isConstraintOperandSelected(arc, { arcEndpoint: { arc, endpoint } }) || (dragSession?.kind === "arc-endpoint" && dragSession.item === arc && dragSession.endpoint === endpoint);
        const hovered = sameArcEndpoint(hoveredArcEndpoint, { arc, endpoint });
        const fixed = Boolean(findArcEndpointFixedConstraint(arc, endpoint));
        ctx.beginPath();
        ctx.arc(p.x, p.y, (selected ? 7 : 5) / viewport.scale, 0, Math.PI * 2);
        ctx.fillStyle = fixed ? "#fee2e2" : selected ? "#2563eb" : hovered ? "#eff6ff" : "#fff";
        ctx.fill();
        ctx.strokeStyle = fixed ? "#dc2626" : selected || hovered ? "#2563eb" : "#111827";
        ctx.lineWidth = 2 / viewport.scale;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPoints() {
    ctx.save();
    for (const p of drawOrderBySketch(allGeometryPoints())) {
      const appearance = effectiveAppearanceForElement(p);
      if (viewState.constraintStatus && p.kind === "endpoint") continue;
      if (!viewState.constraintStatus && !p.blockProjection && !isExplicitPoint(p) && !isPointUsedByPrimitive(p) && !isReferencePoint(p)) continue;
      const active = isEditableSketchElement(p);
      ctx.globalAlpha = sketchAlpha(p);
      const refSelected = isPendingReferenceTarget(p) || isConstraintOperandSelected(p);
      const treeHovered = isSidebarHighlightedElement(p) && !p.blockProjection && !isAnyLineEndpoint(p);
      const sidebarHovered = isSidebarHoveredElement(p);
      const relatedHighlighted = isSelectedConstraintRelatedElement(p);
      const auxiliaryHighlighted = relatedHighlighted;
      const sel = (active && selectedPoints.includes(p)) || refSelected;
      const endpoint = isEndpointPoint(p);
      const canvasHovered = (active || isReferenceHoverElement(p)) && (hoveredPoint === p || hoveredEndpointPoint === p);
      const hovered = treeHovered || sidebarHovered || canvasHovered;
      const dragging = dragSession?.kind === "point" && dragSession.points.some((target) => target.point === p);
      const primitiveCenter = shouldShowPrimitiveCenter(p);
      const fixedByLine = pointLockedByLineFixed(p);
      const fixedHighlighted = (p.fixed || fixedByLine) && (sel || hovered);
      const reference = isReferencePoint(p);
      if (!viewState.constraintStatus && p.blockProjection && !sel && !hovered && !dragging && !primitiveCenter && !auxiliaryHighlighted) continue;
      if (!viewState.constraintStatus && reference && !sel && !hovered && !dragging && !auxiliaryHighlighted) continue;
      if (!viewState.constraintStatus && endpoint && !reference && !sel && !hovered && !dragging && !primitiveCenter && !auxiliaryHighlighted) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (sel || auxiliaryHighlighted ? 7 : endpoint || reference ? 5 : 5) / viewport.scale, 0, Math.PI * 2);
      ctx.fillStyle = fixedHighlighted ? "#fee2e2" : sel ? "#1d4ed8" : auxiliaryHighlighted ? "#e0f2fe" : hovered || primitiveCenter || reference ? "#eff6ff" : "#fff";
      ctx.fill();
      ctx.strokeStyle = auxiliaryHighlighted ? "#0ea5e9" : fixedHighlighted ? "#dc2626" : geometryDisplayColor(p, appearance, sel, hovered || primitiveCenter || reference);
      ctx.lineWidth = (sel || auxiliaryHighlighted ? 3 : Math.max(1.2, sketchStrokeWidth(p))) / viewport.scale;
      ctx.shadowColor = sel || auxiliaryHighlighted ? "rgba(14, 165, 233, 0.45)" : "transparent";
      ctx.shadowBlur = sel || auxiliaryHighlighted ? 8 / viewport.scale : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      if (viewState.geometryIds || sel || sidebarHovered || canvasHovered || dragging || relatedHighlighted) {
        ctx.fillStyle = hovered || endpoint ? "#2563eb" : "#111827";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(p.id, p.x + 8 / viewport.scale, p.y - 8 / viewport.scale);
      }

      if (p.fixed && (sel || hovered)) {
        ctx.fillStyle = "#dc2626";
        ctx.font = `${12 / viewport.scale}px system-ui`;
        ctx.fillText(applicationText("固定", "Fixed"), p.x + 8 / viewport.scale, p.y + 8 / viewport.scale);
      }
    }
    ctx.restore();
  }

  function updateToolbar() {
    const geometryMode = isGeometryMode();
    const constructionState = constructionToggleState(geometryMode);
    const states = {
      toolSelect: geometryMode && mode === "select" && !pendingConstraintCommand && !pendingCommand,
      toolPoint: geometryMode && mode === "point",
      toolLine: geometryMode && mode === "line",
      toolConstructionLine: constructionState.active,
      toolRectangle: geometryMode && mode === "rectangle",
      toolCreateBlock: false,
      toolFillet: geometryMode && mode === "fillet",
      toolTrim: geometryMode && mode === "trim",
      toolOffset: geometryMode && mode === "offset",
      toolCircle: geometryMode && mode === "circle",
      toolArc: geometryMode && mode === "arc",
      annotationLeaderBtn: Boolean(pendingCommand?.type?.startsWith("annotation-leader")),
      annotationTextBtn: pendingCommand?.type === "annotation-text-place",
    };
    for (const [id, active] of Object.entries(states)) {
      const button = document.getElementById(id);
      if (!button) continue;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-disabled", String(!geometryMode));
    }
    for (const id of ["toolCreateBlock"]) {
      const button = document.getElementById(id);
      if (button) button.disabled = !geometryMode;
    }
    updateHistoryButtons();
  }

  function constructionToggleState(geometryMode = isGeometryMode()) {
    if (!geometryMode) return { active: false, mixed: false };
    const primitives = selectedConstructionTogglePrimitives();
    if (primitives.length > 0) {
      const constructionCount = primitives.filter((item) => item.construction).length;
      return {
        active: constructionCount === primitives.length,
        mixed: false,
      };
    }
    return { active: constructionLineMode, mixed: false };
  }

  function selectedConstructionTogglePrimitives() {
    if (selectedPoints.length > 0 || selectedArcEndpoint || selectedArcEndpointPair || selectedDimensionConstraint) return [];
    return [...selectedLines, ...selectedCircles, ...selectedArcs];
  }

  function canApplyConstraint(type) {
    if (!isGeometryMode()) return false;
    if (pendingConstraintCommand?.type === type && constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      return Boolean(resolution && !resolution.error && (resolution.constraint || resolution.target || resolution.action));
    }
    const primitives = selectedPrimitives();
    const selectedItems = [...selectedPoints, ...selectedLines, ...primitives, selectedArcEndpoint?.arc, ...(selectedArcEndpointPair || []).map((item) => item.arc)].filter(Boolean);
    if (!sameSketchElements(selectedItems, activeSketchId())) return false;
    const coincidentPrimitives = selectedArcEndpoint ? primitives.filter((p) => p !== selectedArcEndpoint.arc) : primitives;
    if (type === "distance") {
      const target = distanceTargetFromSelection();
      return Boolean(target && target.kind !== "invalid");
    }
    if (type === "concentric") return (selectedPoints.length === 1 && selectedLines.length === 0 && primitives.length === 1) || (selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 2);
    if (type === "equal") return (selectedLines.length === 2 && selectedPoints.length === 0 && primitives.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 2);
    if (type === "equalRadius") return selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 2;
    if (type === "pointOnCircle") return selectedPoints.length === 1 && selectedLines.length === 0 && primitives.length === 1;
    if (type === "tangent") return (selectedPoints.length === 0 && selectedLines.length === 1 && primitives.length === 1) || (selectedPoints.length === 0 && selectedLines.length === 0 && primitives.length === 2);
    if (type === "coincident") {
      if (selectedArcEndpointPair?.length === 2) return true;
      if ((selectedPoints.length === 2 && selectedLines.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 2 && selectedLines.every(lineHasDirection)) || (selectedPoints.length === 1 && selectedLines.length === 1) || (selectedPoints.length === 1 && selectedLines.length === 0 && coincidentPrimitives.length === 1)) return true;
      return Boolean(selectedArcEndpoint && ((selectedPoints.length === 1 && selectedLines.length === 0 && coincidentPrimitives.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 1 && coincidentPrimitives.length === 0) || (selectedPoints.length === 0 && selectedLines.length === 0 && coincidentPrimitives.length === 1)));
    }
    if (type === "horizontal" || type === "vertical") return (selectedLines.length === 1 && selectedPoints.length === 0 && lineHasDirection(selectedLines[0])) || (selectedPoints.length === 2 && selectedLines.length === 0);
    if (type === "parallel" || type === "perpendicular") return selectedLines.length === 2 && selectedLines.every(lineHasDirection);
    if (type === "symmetry") {
      const pointTargets = selectedPoints.length === 2 && selectedLines.length === 1;
      const lineTargets = selectedPoints.length === 0 && selectedLines.length === 3;
      return primitives.length === 0 && (pointTargets || lineTargets) && selectedLines.every(lineHasDirection);
    }
    if (type === "collinear") return selectedLines.length === 2 && selectedLines.every(lineHasDirection);
    return false;
  }

  function canCompleteConstraintCommand(type) {
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (!resolution || resolution.error) return false;
      if (type === "distance") return Boolean(resolution.target);
      return Boolean(resolution.constraint);
    }
    if (type !== "distance") return canApplyConstraint(type);
    const target = distanceTargetFromSelection();
    if (!target || target.kind === "invalid") return false;
    return target.kind !== "line-length" || !pendingConstraintCommand;
  }

  function constraintLabel(type) {
    const btn = constraintButtons.find((b) => b.dataset.constraint === type);
    return btn?.dataset.label || btn?.title || type;
  }

  function constraintTargetHint(type) {
    if (type === "distance") {
      if (constraintOperands.length === 1 && constraintOperands[0]?.kind === "line") {
        return applicationText("2本目の線を選ぶと線間・角度寸法、空白をクリックすると線長寸法になります。Enterまたは同じ線のダブルクリックでも線長を確定できます。", "Select a second line for a line-to-line or angle dimension, or click empty space for a line-length dimension. Enter or double-clicking the same line also confirms line length.");
      }
      return applicationText("寸法対象を選択してください。", "Select dimension targets.");
    }
    if (type === "concentric") return applicationText("同心にする円/円弧を2つ、または点と円/円弧を選択してください", "Select two circles/arcs, or a point and a circle/arc, to make them concentric.");
    if (type === "equalRadius") return applicationText("同じ半径にする円または円弧を2つ選択してください", "Select two circles or arcs to give them equal radii.");
    if (type === "pointOnCircle") return applicationText("円周上に置く点と、円または円弧を選択してください", "Select a point and a circle or arc to place the point on its circumference.");
    if (type === "tangent") return applicationText("接線にする線と円/円弧、または円/円弧を2つ選択してください", "Select a line and a circle/arc, or two circles/arcs, to make them tangent.");
    if (type === "coincident") return applicationText("一致させる点同士、点と線、点と円周、または同一線上にする線2本を選択してください", "Select two points, a point and line, a point and circumference, or two lines to make coincident.");
    if (type === "collinear") return applicationText("同一直線上にする線を2本選択してください", "Select two lines to make them collinear.");
    if (type === "equal") return applicationText("等寸にする線2本、または同じ半径にする円/円弧を2つ選択してください", "Select two lines for equal length, or two circles/arcs for equal radii.");
    if (type === "horizontal") return applicationText("水平にする線1本、または水平関係にする点2つを選択してください", "Select one line to make horizontal, or two points to align horizontally.");
    if (type === "vertical") return applicationText("垂直にする線1本、または鉛直関係にする点2つを選択してください", "Select one line to make vertical, or two points to align vertically.");
    if (type === "parallel") return applicationText("平行にする線を2本選択してください", "Select two lines to make parallel.");
    if (type === "perpendicular") return applicationText("直交させる線を2本選択してください", "Select two lines to make perpendicular.");
    if (type === "symmetry") {
      if (constraintOperands.length === 0) return applicationText("最初に対称軸にする線を選択してください", "First select the symmetry-axis line.");
      if (constraintOperands.length === 1) return applicationText("対称にする1つ目の点または線を選択してください", "Select the first point or line to mirror.");
      const subjectKind = constraintOperands[1]?.kind === "line" ? "線" : "点";
      return applicationLanguage === "en" ? `Select the second ${subjectKind === "線" ? "line" : "point"} to mirror.` : `対称にする2つ目の${subjectKind}を選択してください`;
    }
    return applicationLanguage === "en" ? `Select targets for ${constraintLabel(type)}.` : `${constraintLabel(type)} の対象を選択してください`;
  }

  function invalidConstraintTargetHint(type) {
    if (applicationLanguage === "en") {
      if (type === "symmetry") {
        if (constraintOperands.length === 0) return "Select a line as the symmetry axis for the first target.";
        if (constraintOperands.length === 1) return "Select a point or line to mirror for the second target.";
        return `Select a ${constraintOperands[1]?.kind === "line" ? "line" : "point"} matching the second target type.`;
      }
      const hints = {
        concentric: "Select two circles/arcs, or a point and a circle/arc, for this constraint.",
        equalRadius: "Select two circles or arcs for this constraint.",
        pointOnCircle: "Select a point and a circle or arc for this constraint.",
        tangent: "Select a line and a circle/arc, or two circles/arcs, for this constraint.",
        coincident: "Select points, lines, circles, or arcs supported by this constraint.",
        collinear: "Select two lines for this constraint.", equal: "Select two lines or two circles/arcs for this constraint.",
        horizontal: "Select one line or two points for this constraint.", vertical: "Select one line or two points for this constraint.",
        parallel: "Select lines for this constraint.", perpendicular: "Select lines for this constraint.", distance: "Select a point or line as a dimension target.",
      };
      return hints[type] || "The current selection cannot be used for this constraint.";
    }
    if (type === "concentric") return "この拘束では円/円弧を2つ、または点と円/円弧を選択してください";
    if (type === "equalRadius") return "この拘束では円または円弧を2つ選択してください";
    if (type === "pointOnCircle") return "この拘束では点と円または円弧を選択してください";
    if (type === "tangent") return "この拘束では線と円/円弧、または円/円弧を2つ選択してください";
    if (type === "coincident") return "この拘束では点、線、円または円弧を選択してください";
    if (type === "collinear") return "この拘束では線を2本選択してください";
    if (type === "equal") return "この拘束では線2本、または円/円弧を2つ選択してください";
    if (type === "horizontal" || type === "vertical") {
      return "この拘束では線1本、または点2つを選択してください";
    }
    if (type === "parallel" || type === "perpendicular") {
      return "この拘束では線を選択してください";
    }
    if (type === "symmetry") {
      if (constraintOperands.length === 0) return "最初の対象には対称軸にする線を選択してください";
      if (constraintOperands.length === 1) return "2番目の対象には対称にする点または線を選択してください";
      return `3番目の対象には2番目と同じ種類の${constraintOperands[1]?.kind === "line" ? "線" : "点"}を選択してください`;
    }
    if (type === "distance") return "寸法対象として点または線を選択してください";
    return "この拘束では選択できません";
  }

  function trimConstraintSelection(type) {
    const trimPrimitives = (count) => {
      const primitives = selectedPrimitives().slice(0, count);
      selectedCircles = primitives.filter((p) => p instanceof Circle);
      selectedArcs = primitives.filter((p) => p instanceof Arc);
    };
    if (type === "coincident") {
      selectedPoints = selectedPoints.slice(0, 2);
      selectedLines = selectedPoints.length >= 2 ? [] : selectedLines.slice(0, 2);
      trimPrimitives(selectedPoints.length === 1 && selectedLines.length === 0 ? 1 : 0);
    } else if (type === "horizontal" || type === "vertical") {
      selectedPoints = selectedLines.length > 0 ? [] : selectedPoints.slice(0, 2);
      selectedCircles = [];
      selectedArcs = [];
      selectedLines = selectedPoints.length > 0 ? [] : selectedLines.slice(0, 1);
    } else if (type === "parallel" || type === "perpendicular") {
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedLines = selectedLines.slice(0, 2);
      selectedArcEndpoint = null;
    } else if (type === "symmetry") {
      selectedPoints = selectedPoints.slice(0, 2);
      selectedLines = selectedPoints.length > 0 ? selectedLines.slice(0, 1) : selectedLines.slice(0, 3);
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
    } else if (type === "collinear") {
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      selectedLines = selectedLines.slice(0, 2);
    } else if (type === "equal" || type === "equalRadius") {
      selectedPoints = [];
      selectedArcEndpoint = null;
      if (selectedLines.length > 0) {
        selectedLines = selectedLines.slice(0, 2);
        selectedCircles = [];
        selectedArcs = [];
      } else {
        selectedLines = [];
        trimPrimitives(2);
      }
    } else if (type === "concentric" || type === "pointOnCircle") {
      selectedPoints = selectedPoints.slice(0, 1);
      selectedLines = [];
      trimPrimitives(type === "concentric" && selectedPoints.length === 0 ? 2 : 1);
    } else if (type === "tangent") {
      selectedPoints = [];
      selectedLines = selectedLines.slice(0, 1);
      trimPrimitives(selectedLines.length === 1 ? 1 : 2);
    } else if (type === "distance") {
      selectedPoints = selectedPoints.slice(0, 2);
      selectedLines = selectedLines.slice(0, 2);
      trimPrimitives(1);
      if (selectedPoints.length > 0 && selectedLines.length > 0) {
        selectedPoints = selectedPoints.slice(0, 1);
        selectedLines = selectedLines.slice(0, 1);
        selectedCircles = [];
        selectedArcs = [];
      }
    }
  }

  function startConstraintTargetCommand(type) {
    cancelPendingCommand("");
    mode = "select";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    updateToolbar();
    if (pendingConstraintCommand?.type === type) {
      cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      return;
    }
    if (type === "symmetry") clearSelection();
    constraintOperands = type === "symmetry" ? [] : constraintOperandsFromSelection();
    pendingConstraintCommand = { type };
    trimConstraintSelection(type);
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (resolution?.action === "place-dimension") {
        startDistanceResolution(resolution, null);
        return;
      }
      if (resolution?.action === "commit" && resolution.constraint) {
        commitConstraintResolution(resolution);
        return;
      }
      syncSelectionFromConstraintOperands();
    }
    updateToolbar();
    updateConstraintButtons();
    setHint(constraintTargetHint(type));
    draw();
  }

  function cancelConstraintTargetCommand(message = "拘束対象の選択をキャンセルしました") {
    if (!pendingConstraintCommand) return;
    pendingConstraintCommand = null;
    constraintOperands = [];
    if (message) setHint(message);
    updateConstraintButtons();
    updateToolbar();
    if (document.activeElement instanceof HTMLElement && document.activeElement.matches("[data-constraint]")) {
      document.activeElement.blur();
    }
    draw();
  }

  function executeConstraintCommandIfReady() {
    if (!pendingConstraintCommand) return false;
    const type = pendingConstraintCommand.type;
    if (constraintOperands.length > 0) {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (resolution?.error) {
        setHint(resolution.error, "error");
        return false;
      }
      if (resolution?.action === "place-dimension") {
        startDistanceResolution(resolution, null);
        return true;
      }
      if (resolution?.action === "commit" && resolution.constraint) {
        commitConstraintResolution(resolution);
        return true;
      }
      setHint(constraintTargetHint(type));
      return false;
    }
    if (!canCompleteConstraintCommand(type)) {
      const target = type === "distance" ? distanceTargetFromSelection() : null;
      if (target?.kind === "invalid") {
        setHint(target.reason, "error");
        return false;
      }
      if (target?.kind === "line-length") {
        updateConstraintButtons();
        startDistanceCommand();
        return true;
      }
      setHint(constraintTargetHint(type));
      return false;
    }
    updateConstraintButtons();
    addConstraint(type);
    return true;
  }

  function completePendingDimensionLineLength() {
    if (pendingConstraintCommand?.type !== "distance") return false;
    const target = distanceTargetFromSelection();
    if (!target || target.kind !== "line-length") return false;
    updateConstraintButtons();
    startDistanceCommand();
    return true;
  }

  function pushPrimitiveSelection(primitive) {
    if (!primitive) return;
    if (primitive instanceof Circle) {
      if (!selectedCircles.includes(primitive)) selectedCircles.push(primitive);
    } else if (primitive instanceof Arc) {
      if (!selectedArcs.includes(primitive)) selectedArcs.push(primitive);
    }
  }

  function hitConstraintOperand(pointer, type, hits = {}) {
    const hitP = hits.hitP ?? hitPoint(pointer.x, pointer.y);
    const hitL = hits.hitL ?? hitLine(pointer.x, pointer.y);
    const hitC = hits.hitC ?? hitCircle(pointer.x, pointer.y);
    const hitA = hits.hitA ?? hitArc(pointer.x, pointer.y);
    const hitArcEnd = hits.hitArcEnd ?? hitArcEndpoint(pointer.x, pointer.y);
    if (type === "symmetry") {
      const subjectKind = constraintOperands[1]?.kind || null;
      if (constraintOperands.length === 0 && hitL) return makeConstraintOperand("line", { line: hitL });
      if (subjectKind === "point" && hitP) return makeConstraintOperand("point", { point: hitP });
      if (subjectKind === "line" && hitL) return makeConstraintOperand("line", { line: hitL });
      if (!subjectKind && hitP) return makeConstraintOperand("point", { point: hitP });
      if (!subjectKind && hitL) return makeConstraintOperand("line", { line: hitL });
    }
    if (hitArcEnd && (type === "coincident" || type === "pointOnCircle")) return makeConstraintOperand("arc-endpoint", { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint });
    if (hitP) return makeConstraintOperand("point", { point: hitP });
    if (hitL) return makeConstraintOperand("line", { line: hitL });
    if (hitC || hitA) return makeConstraintOperand("primitive", { primitive: hitC || hitA });
    const blockOperand = hitBlockProjectionOperand(pointer.x, pointer.y);
    if (blockOperand) return blockOperand;
    return operandFromReferenceTarget(hitReferenceTarget(pointer.x, pointer.y));
  }

  function constraintOperandLimit(type, operands) {
    if (type === "distance") return operands.some((operand) => operand.kind === "primitive") ? 1 : 2;
    if (type === "horizontal" || type === "vertical") return operands.some((operand) => operand.kind === "point") ? 2 : 1;
    if (type === "symmetry") return 3;
    return 2;
  }

  function appendConstraintOperand(type, operand) {
    if (!operand) return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "symmetry") {
      const step = constraintOperands.length;
      if (step === 0 && operand.kind !== "line") return { ok: false, error: invalidConstraintTargetHint(type) };
      if (step > 0 && operand.kind !== "point" && operand.kind !== "line") return { ok: false, error: invalidConstraintTargetHint(type) };
      if (operand.kind === "line" && !lineHasDirection(operand.line)) return { ok: false, error: step === 0 ? "対称軸の線が短すぎます" : "対称対象の線が短すぎます" };
      if (constraintOperands.some((existing) => sameConstraintOperand(existing, operand))) return { ok: false, error: "対称軸と2つの対象には異なる要素を選択してください" };
      if (step >= 2 && operand.kind !== constraintOperands[1].kind) return { ok: false, error: invalidConstraintTargetHint(type) };
      if (step >= 3) return { ok: false, error: "対称拘束の対象はすでに3つ選択されています" };
      constraintOperands = [...constraintOperands, operand];
      syncSelectionFromConstraintOperands();
      return { ok: true };
    }
    if ((type === "parallel" || type === "perpendicular" || type === "collinear") && operand.kind !== "line") return { ok: false, error: invalidConstraintTargetHint(type) };
    if ((type === "parallel" || type === "perpendicular" || type === "collinear") && !lineHasDirection(operand.line)) return { ok: false, error: "向き拘束の対象線が短すぎます" };
    if ((type === "horizontal" || type === "vertical") && operand.kind !== "line" && operand.kind !== "point") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "tangent" && operand.kind !== "line" && operand.kind !== "primitive") return { ok: false, error: invalidConstraintTargetHint(type) };
    if ((type === "equal" || type === "equalRadius" || type === "concentric") && operand.kind !== "line" && operand.kind !== "primitive" && operand.kind !== "point") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "pointOnCircle" && operand.kind !== "point" && operand.kind !== "primitive" && operand.kind !== "arc-endpoint") return { ok: false, error: invalidConstraintTargetHint(type) };
    if (type === "distance" && operand.kind === "arc-endpoint") return { ok: false, error: invalidConstraintTargetHint(type) };

    let next = constraintOperands.filter((existing) => !sameConstraintOperand(existing, operand));
    if (type === "distance" && operand.kind === "primitive") next = [];
    if (type === "distance" && next.some((existing) => existing.kind === "primitive")) next = [];
    next.push(operand);
    const limit = constraintOperandLimit(type, next);
    if (next.length > limit) next = next.slice(next.length - limit);
    constraintOperands = next;
    syncSelectionFromConstraintOperands();
    return { ok: true };
  }

  function handleConstraintOperandClick(pointer, type, hits = {}) {
    const operand = hitConstraintOperand(pointer, type, hits);
    if (!operand && type === "distance") {
      const resolution = resolveConstraintIntent(type, constraintOperands);
      if (resolution?.action === "place-dimension" && resolution.target?.kind === "line-length") {
        startDistanceResolution(resolution, pointer);
        startDistanceValueInput(pointer);
        return true;
      }
    }
    const added = appendConstraintOperand(type, operand);
    if (!added.ok) {
      setHint(added.error, "error");
      return true;
    }
    const resolution = resolveConstraintIntent(type, constraintOperands);
    if (resolution?.error) {
      setHint(resolution.error, "error");
      draw();
      return true;
    }
    if (resolution?.action === "place-dimension") {
      if (resolution.target?.kind === "line-length" && constraintOperands.length === 1) {
        startDistanceResolution(resolution, pointer);
        return true;
      }
      startDistanceResolution(resolution, null);
      return true;
    }
    if (resolution?.action === "commit" && resolution.constraint) {
      commitConstraintResolution(resolution);
      return true;
    }
    updateGeometrySelectionUI();
    setHint(constraintTargetHint(type));
    draw();
    return true;
  }

  function handleConstraintTargetClick(hitP, hitL, hitC, hitA, hitArcEnd) {
    if (!pendingConstraintCommand) return false;
    const type = pendingConstraintCommand.type;
    selectedDimensionConstraint = null;
    const hitPrimitive = hitC || hitA;

    if (type === "coincident") {
      if (!hitP && !hitL && !hitPrimitive && !hitArcEnd) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitArcEnd) {
        const next = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
        if (selectedArcEndpoint && !sameArcEndpoint(selectedArcEndpoint, next)) selectedArcEndpointPair = [selectedArcEndpoint, next];
        selectedArcEndpoint = next;
      } else if (hitP) {
        selectedArcEndpointPair = null;
        if (!selectedPoints.includes(hitP)) selectedPoints.push(hitP);
        selectedPoints = selectedPoints.slice(-2);
        if (selectedPoints.length >= 2) selectedLines = [];
      } else if (hitL) {
        selectedArcEndpointPair = null;
        if (selectedPoints.length > 0) {
          selectedLines = [hitL];
          selectedPoints = selectedPoints.slice(0, 1);
        } else {
          if (!selectedLines.includes(hitL)) selectedLines.push(hitL);
          selectedLines = selectedLines.slice(-2);
        }
        selectedCircles = [];
        selectedArcs = [];
      } else if (hitPrimitive) {
        selectedArcEndpointPair = null;
        pushPrimitiveSelection(hitPrimitive);
        selectedPoints = selectedPoints.slice(0, 1);
        selectedLines = [];
      }
    } else if (type === "horizontal" || type === "vertical") {
      if (!hitL && !hitP) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitP) {
        selectedLines = [];
        if (!selectedPoints.includes(hitP)) selectedPoints.push(hitP);
        selectedPoints = selectedPoints.slice(-2);
      } else if (!lineHasDirection(hitL)) {
        setHint("向き拘束の対象線が短すぎます", "error");
        return true;
      } else {
        selectedLines = [hitL];
        selectedPoints = [];
      }
    } else if (type === "parallel" || type === "perpendicular" || type === "collinear") {
      if (!hitL) {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (!lineHasDirection(hitL)) {
        setHint("向き拘束の対象線が短すぎます", "error");
        return true;
      }
      selectedPoints = [];
      if (!selectedLines.includes(hitL)) selectedLines.push(hitL);
      selectedLines = selectedLines.slice(-2);
    } else if (type === "distance") {
      if (!hitP && !hitL && !hitPrimitive) {
        const target = distanceTargetFromSelection();
        if (target?.kind === "line-length") {
          setHint("線の長さ寸法は、配置したい位置をダブルクリックしてください");
          return true;
        }
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      if (hitP) {
        if (!selectedPoints.includes(hitP)) selectedPoints.push(hitP);
        selectedPoints = selectedPoints.slice(-2);
        selectedLines = selectedLines.slice(0, 1);
      } else if (hitL) {
        if (!selectedLines.includes(hitL)) selectedLines.push(hitL);
        selectedLines = selectedLines.slice(-2);
        selectedPoints = selectedPoints.slice(0, 1);
        selectedCircles = [];
        selectedArcs = [];
      } else if (hitPrimitive) {
        selectedPoints = [];
        selectedLines = [];
        selectedCircles = [];
        selectedArcs = [];
        pushPrimitiveSelection(hitPrimitive);
      }
      trimConstraintSelection(type);
    } else if (type === "equal") {
      if (hitL) {
        selectedPoints = [];
        selectedCircles = [];
        selectedArcs = [];
        if (!selectedLines.includes(hitL)) selectedLines.push(hitL);
        selectedLines = selectedLines.slice(-2);
      } else if (hitPrimitive) {
        selectedPoints = [];
        selectedLines = [];
        pushPrimitiveSelection(hitPrimitive);
      } else {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      trimConstraintSelection(type);
    } else if (type === "concentric" || type === "equalRadius" || type === "pointOnCircle" || type === "tangent") {
      if (hitP && (type === "concentric" || type === "pointOnCircle")) {
        if (!selectedPoints.includes(hitP)) selectedPoints.push(hitP);
        selectedPoints = selectedPoints.slice(-1);
      } else if (hitL && type === "tangent") {
        selectedLines = [hitL];
      } else if (hitPrimitive) {
        pushPrimitiveSelection(hitPrimitive);
      } else {
        setHint(invalidConstraintTargetHint(type), "error");
        return true;
      }
      trimConstraintSelection(type);
    }

    updateUI();
    if (!executeConstraintCommandIfReady()) draw();
    return true;
  }

  function handleConstraintTargetDoubleClick(hitP, hitL, pointer) {
    if (pendingConstraintCommand?.type !== "distance") return false;
    if (selectedPoints.length !== 0 || selectedLines.length !== 1) return false;
    if (hitL && selectedLines[0] !== hitL) return false;
    updateConstraintButtons();
    startDistanceCommand();
    if (pendingCommand?.type === "distance-place") startDistanceValueInput(defaultDimensionForTarget(pendingCommand.target));
    return true;
  }

  function startDistanceCommand() {
    if (constraintOperands.length === 0) constraintOperands = constraintOperandsFromSelection();
    const resolution = constraintResolutionFromCurrentSelection("distance");
    if (!resolution) return;
    if (resolution.error) {
      setHint(resolution.error, "error");
      log(resolution.error);
      return;
    }
    mode = "select";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = {
      type: "distance-place",
      target: resolution.target,
      resolution,
      pointer: defaultDimensionForTarget(resolution.target),
      operands: resolution.operands || constraintOperands.slice(),
      referenceSketchId: resolution.referenceSketchId,
      sketchId: resolution.sketchId,
    };
    updateConstraintButtons();
    updateToolbar();
    setHint("寸法線の位置をクリックしてください");
    draw();
  }

  function startPrimitiveDimensionCommand(kind) {
    const primitive = selectedPrimitives()[0];
    if (!primitive) return;
    const value = kind === "diameter" ? primitive.radius() * 2 : primitive.radius();
    mode = "select";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = { type: "distance-place", target: { kind, primitive, value }, pointer: defaultDimensionForTarget({ kind, primitive, value }) };
    updateConstraintButtons();
    updateToolbar();
    setHint("寸法線の位置をクリックしてください");
    draw();
  }

  function cancelPendingCommand(message = "コマンドをキャンセルしました") {
    if (!pendingCommand) return;
    if (pendingCommand.type === "offset-value") {
      offsetSource = null;
      pointerPreview = null;
    }
    pendingCommand = null;
    hideDimensionValueInput();
    if (message) setHint(message);
    updateToolbar();
    updateConstraintButtons();
    draw();
  }

  function startDistanceValueInput(pointer) {
    if (!pendingCommand || pendingCommand.type !== "distance-place") return;
    const referenceSketchId = pendingCommand.referenceSketchId;
    const sketchId = pendingCommand.sketchId;
    const dimension = dimensionWithLabelAt(
      pendingCommand.target,
      applyDefaultCircleDimensionLabelOffset(pendingCommand.target, dimensionFromAnchor(pendingCommand.target, pointer)),
      pointer,
    );
    const target = { ...pendingCommand.target, dimensionAxis: dimension.axis };
    const value =
      pendingCommand.target.kind === "point-point" && dimension.axis === "x"
        ? Math.abs(pendingCommand.target.p2.x - pendingCommand.target.p1.x)
        : pendingCommand.target.kind === "point-point" && dimension.axis === "y"
          ? Math.abs(pendingCommand.target.p2.y - pendingCommand.target.p1.y)
          : pendingCommand.target.kind === "angle"
            ? angleDegrees(angleDimensionAngles(pendingCommand.target, pointer, dimension).signed)
          : pendingCommand.target.value;
    const readOnlyConstraint = readOnlyDimensionConstraintForPlacement(target, value, dimension, { referenceSketchId, sketchId });
    if (readOnlyConstraint) {
      pendingCommand = null;
      hideDimensionValueInput();
      addReadOnlyDimensionConstraint(readOnlyConstraint, sketchId || activeSketchId(), referenceSketchId ? "重複参照寸法" : "重複寸法");
      return;
    }
    pendingCommand = {
      type: "distance-value",
      target,
      dimension,
      buffer: String(value),
      editing: false,
      referenceSketchId,
      sketchId,
    };
    setHint("寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    updateConstraintButtons();
    draw();
    focusDimensionValueInput();
  }

  function retargetDistancePlaceWithOperand(pointer, hits = {}) {
    if (pendingCommand?.type !== "distance-place" || pendingCommand.target.kind !== "line-length") return false;
    const baseOperands = pendingCommand.operands?.length ? pendingCommand.operands : [{ kind: "line", line: pendingCommand.target.line, element: pendingCommand.target.line, sketchId: elementSketchId(pendingCommand.target.line), relation: "active" }];
    const operand = hitConstraintOperand(pointer, "distance", hits);
    if (!operand || sameConstraintOperand(baseOperands[0], operand)) return false;
    const resolution = resolveConstraintIntent("distance", [baseOperands[0], operand]);
    if (resolution?.error) {
      setHint(resolution.error, "error");
      return true;
    }
    if (!resolution?.target) return false;
    startDistanceResolution(resolution, null);
    pendingCommand.pointer = pointer;
    pendingCommand.dimension = null;
    return true;
  }

  function applyReferenceHoverTarget(referenceTarget) {
    hoveredPoint = referenceTarget?.kind === "point" ? referenceTarget.point : null;
    hoveredEndpointPoint = hoveredPoint;
    hoveredLine = referenceTarget?.kind === "line" ? referenceTarget.line : null;
    hoveredCircle = referenceTarget?.primitive instanceof Circle ? referenceTarget.primitive : null;
    hoveredArc = referenceTarget?.primitive instanceof Arc ? referenceTarget.primitive : null;
    hoveredArcEndpoint = null;
    hoveredDimensionConstraint = null;
  }

  function updatePendingLineLengthHover(pointer) {
    if (pendingCommand?.type !== "distance-place" || pendingCommand.target.kind !== "line-length") {
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      return false;
    }
    const baseLine = pendingCommand.target.line;
    const blockOperand = hitBlockProjectionOperand(pointer.x, pointer.y);
    const blockTarget = blockOperand && operandElement(blockOperand) !== baseLine ? referenceTargetFromOperand(blockOperand) : null;
    if (blockTarget) {
      const changed =
        (blockTarget.kind === "point" ? blockTarget.point : null) !== hoveredPoint ||
        (blockTarget.kind === "line" ? blockTarget.line : null) !== hoveredLine ||
        (blockTarget.primitive instanceof Circle ? blockTarget.primitive : null) !== hoveredCircle ||
        (blockTarget.primitive instanceof Arc ? blockTarget.primitive : null) !== hoveredArc ||
        hoveredArcEndpoint ||
        hoveredDimensionConstraint;
      applyReferenceHoverTarget(blockTarget);
      hoveredBlockInstance = null;
      return changed;
    }
    const referenceTarget = hitReferenceTarget(pointer.x, pointer.y);
    if (referenceTarget) {
      const changed =
        (referenceTarget.kind === "point" ? referenceTarget.point : null) !== hoveredPoint ||
        (referenceTarget.kind === "line" ? referenceTarget.line : null) !== hoveredLine ||
        (referenceTarget.primitive instanceof Circle ? referenceTarget.primitive : null) !== hoveredCircle ||
        (referenceTarget.primitive instanceof Arc ? referenceTarget.primitive : null) !== hoveredArc ||
        hoveredDimensionConstraint;
      applyReferenceHoverTarget(referenceTarget);
      return changed;
    }
    const nextEndpointHover = hitEndpointPoint(pointer.x, pointer.y);
    const nextPointHover = nextEndpointHover || hitExplicitPoint(pointer.x, pointer.y);
    const candidateLine = nextPointHover ? null : hitLine(pointer.x, pointer.y);
    const nextLineHover = candidateLine && candidateLine !== baseLine && lineHasDirection(baseLine) && lineHasDirection(candidateLine) ? candidateLine : null;
    const changed = nextPointHover !== hoveredPoint || nextEndpointHover !== hoveredEndpointPoint || nextLineHover !== hoveredLine || hoveredCircle || hoveredArc || hoveredArcEndpoint || hoveredDimensionConstraint;
    hoveredPoint = nextPointHover;
    hoveredEndpointPoint = nextEndpointHover;
    hoveredLine = nextLineHover;
    hoveredCircle = null;
    hoveredArcEndpoint = null;
    hoveredArc = null;
    hoveredDimensionConstraint = null;
    return changed;
  }

  function startDimensionEditInput(hit) {
    if (!hit?.constraint) return false;
    const target = targetFromConstraint(hit.constraint);
    if (!target) return false;
    if (isReadOnlyDimension(hit.constraint)) {
      selectedDimensionConstraint = hit.constraint;
      selectedConstraint = null;
      dimensionDragSession = null;
      setHint("読み取り専用寸法の値は編集できません");
      draw();
      return true;
    }
    pendingCommand = {
      type: "distance-value",
      target,
      dimension: hit.constraint.dimension || hit.dimension || defaultDimensionForTarget(target),
      buffer: hit.constraint.expression || numericDimensionExpression(hit.constraint),
      editing: false,
      constraint: hit.constraint,
    };
    selectedDimensionConstraint = hit.constraint;
    selectedConstraint = null;
    dimensionDragSession = null;
    setHint("寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    draw();
    focusDimensionValueInput();
    return true;
  }

  function updateDistanceBufferLabel() {
    if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return;
    setHint(pendingCommand.type === "offset-value" ? "オフセット距離を入力中: Enter/ダブルクリックで決定、Escでキャンセル" : "寸法値を入力中: 数値キーで編集、Enter/ダブルクリックで決定、Escでキャンセル");
    draw();
  }

  function sketchHasDimensionConstraint(sketchId = activeSketchId()) {
    return model.constraints.some((constraint) => constraintSketchId(constraint) === sketchId && constraint.dimension);
  }

  function submitDistanceValue() {
    if (!pendingCommand || pendingCommand.type !== "distance-value") return;
    const expression = pendingCommand.buffer.trim();
    let value;
    try {
      value = evaluateDimensionExpressionDraft(pendingCommand.constraint || null, expression);
    } catch (error) {
      setHint(`${applicationText("寸法式を評価できません", "Could not evaluate the dimension expression")}: ${parameterErrorText(error)}`, "error");
      syncDimensionValueInput();
      draw();
      return;
    }
    const maxAngle = pendingCommand.target?.kind === "angle" ? 180 : Infinity;
    if (!Number.isFinite(value) || value <= 0 || value >= maxAngle) {
      setHint(applicationText("寸法値の範囲が正しくありません", "Dimension value is out of range"), "error");
      draw();
      return;
    }
    const { target, dimension, constraint, referenceSketchId, sketchId } = pendingCommand;
    const targetSketchId = sketchId || activeSketchId();
    const shouldFitFirstDimension = !constraint && !sketchHasDimensionConstraint(targetSketchId);
    const firstDimensionFootprint = shouldFitFirstDimension ? captureSketchScreenFootprint(targetSketchId) : null;
    if (constraint) {
      const snapshot = snapshotModelState();
      constraint.expression = expression;
      constraint.target = target.kind === "angle" ? (value * Math.PI) / 180 : value;
      preconditionNewConstraint(constraint);
      const solved = withTemporarySolveStepNorm(solveStepNormForConstraint(constraint), () => stabilizeActiveParameterNamespace(sketchId || constraintSketchId(constraint)));
      const result = solved.result;
      if (!solved.success || solved.dependent?.success === false || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
        restoreModelState(snapshot);
        setHint(`${applicationText("寸法式を更新できません", "Could not update the dimension expression")}: ${result.reason || `error=${result.errorNorm.toExponential(3)}`}`, "error");
        syncDimensionValueInput();
      } else {
        pendingCommand = null;
        hideDimensionValueInput();
        setHint(`寸法値更新: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}`);
        recordHistory("寸法値変更");
      }
      updateUI();
      draw();
      return;
    }
    if (shouldFitFirstDimension) scaleSketchForFirstDimension(targetSketchId, target, value, dimension);
    const ok = addDistanceConstraintFromTarget(target, value, dimension, { referenceSketchId, sketchId, expression });
    if (ok) {
      pendingCommand = null;
      hideDimensionValueInput();
    }
    if (ok && firstDimensionFootprint && restoreSketchScreenFootprint(targetSketchId, firstDimensionFootprint)) {
      setHint(`最初の寸法 ${value} に合わせて、見た目の大きさを保つよう表示スケールを調整しました`);
      draw();
    }
  }

  function handleDistanceKey(e) {
    if (!pendingCommand) return false;
    if (e.key === "Escape") {
      e.preventDefault();
      cancelPendingCommand("寸法入力をキャンセルしました");
      return true;
    }
    if (pendingCommand.type === "distance-place" && e.key === "Enter") {
      e.preventDefault();
      startDistanceValueInput(pendingCommand.pointer || defaultDimensionForTarget(pendingCommand.target));
      return true;
    }
    if (!["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return false;
    if (e.key === "Enter") {
      e.preventDefault();
      if (pendingCommand.type === "fillet-radius-value") submitFilletRadiusValue();
      else if (pendingCommand.type === "offset-value") submitOffsetValue();
      else submitDistanceValue();
      return true;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      pendingCommand.buffer = pendingCommand.buffer.slice(0, -1);
      pendingCommand.editing = true;
      updateDistanceBufferLabel();
      return true;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      pendingCommand.buffer = "";
      pendingCommand.editing = true;
      updateDistanceBufferLabel();
      return true;
    }
    if (/^[0-9.]$/.test(e.key)) {
      e.preventDefault();
      if (!pendingCommand.editing) {
        pendingCommand.buffer = "";
        pendingCommand.editing = true;
      }
      if (e.key === "." && pendingCommand.buffer.includes(".")) return true;
      pendingCommand.buffer += e.key;
      updateDistanceBufferLabel();
      return true;
    }
    return false;
  }

  function updateConstraintButtons() {
    if (!isGeometryMode()) {
      for (const btn of constraintButtons) {
        btn.classList.remove("active");
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("aria-pressed", "false");
      }
      fixPointBtn?.setAttribute("aria-disabled", "true");
      return;
    }
    if (pendingCommand?.type?.startsWith("distance")) {
      const target = distanceTargetFromSelection();
      if (!target || target.kind === "invalid") cancelPendingCommand("寸法入力をキャンセルしました");
    }

    for (const btn of constraintButtons) {
      btn.setAttribute("aria-disabled", "false");
      const active = pendingConstraintCommand?.type === btn.dataset.constraint;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
    const selectedProjectionItems = [...selectedPoints, ...selectedLines, ...selectedCircles, ...selectedArcs].filter((item) => item?.blockProjection);
    const selectedProjectionInstances = [...new Set(selectedProjectionItems.map((item) => item.blockInstance))];
    const canToggleFixed =
      selectedBlockInstances.length === 1 ||
      (selectedProjectionItems.length > 0 && selectedProjectionInstances.length === 1 && selectedProjectionItems.length === selectedPoints.length + selectedLines.length + selectedCircles.length + selectedArcs.length) ||
      Boolean(selectedArcEndpoint) ||
      (selectedPoints.length >= 1 && selectedLines.length === 0 && selectedCircles.length === 0 && selectedArcs.length === 0) ||
      (selectedPoints.length === 0 && selectedLines.length === 1 && selectedCircles.length === 0 && selectedArcs.length === 0);
    fixPointBtn.setAttribute("aria-disabled", String(!canToggleFixed));

    const enabled = constraintButtons
      .filter((btn) => btn.getAttribute("aria-disabled") !== "true")
      .map((btn) => translatedExactText(btn.dataset.label || btn.title));
    const help = enabled.length > 0
      ? `${applicationText("追加可能", "Available")}: ${enabled.join(" / ")}`
      : applicationText("点または線を選択すると、追加できる拘束だけが有効になります。", "Select points or lines to enable applicable constraints.");
    document.getElementById("hint").title = help;
  }

  function clearInteractionForSketchChange() {
    clearSelection();
    dragSession = null;
    dimensionDragSession = null;
    selectionRectSession = null;
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    pendingCommand = null;
    pendingConstraintCommand = null;
    hoveredSketchIdentity = null;
    lastPointerWorld = null;
    hideDimensionValueInput();
    clearSnap();
    mode = "select";
    updateToolbar();
  }

  function nextRootSketchName() {
    let max = 0;
    for (const sketch of model.sketches) {
      if (sketch.parentSketchId !== ROOT_SKETCH_ID || isRootSketch(sketch)) continue;
      const match = /^Sketch[-\s](\d+)$/.exec(sketch.name || "");
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `Sketch-${max + 1}`;
  }

  function nextChildSketchName(parentSketchId) {
    const parent = sketchById(parentSketchId);
    if (isRootSketch(parent)) return nextRootSketchName();
    if (!parent) return nextRootSketchName();
    const prefix = `${parent.name}-`;
    let max = 0;
    for (const sketch of childSketchesOf(parentSketchId)) {
      if (!sketch.name?.startsWith(prefix)) continue;
      const suffix = sketch.name.slice(prefix.length);
      if (/^\d+$/.test(suffix)) max = Math.max(max, Number(suffix));
    }
    return `${prefix}${max + 1}`;
  }

  function nextSketchName(parentSketchId) {
    return parentSketchId && parentSketchId !== ROOT_SKETCH_ID ? nextChildSketchName(parentSketchId) : nextRootSketchName();
  }

  function createSketch(kind = "sibling") {
    ensureSketchState();
    const current = activeSketch();
    const parentSketchId = kind === "child" ? current.id : current.parentSketchId || ROOT_SKETCH_ID;
    const sketch = { id: `S${sketchSeq++}`, name: nextSketchName(parentSketchId), parentSketchId, kind: "sketch", appearance: {} };
    model.sketches.push(sketch);
    model.activeSketchId = sketch.id;
    clearInteractionForSketchChange();
    setHint(parentSketchId ? `編集中: ${sketch.name} / 親: ${sketchName(parentSketchId)}` : `編集中: ${sketch.name}`);
    updateUI();
    draw();
    recordHistory("スケッチ追加");
  }

  function setActiveSketch(sketchId) {
    ensureSketchState();
    const sketch = model.sketches.find((item) => item.id === sketchId);
    if (!sketch) return;
    if (model.activeSketchId === sketchId) return;
    sketch.appearance = { ...normalizeAppearance(sketch.appearance), visible: true };
    sketch.visible = true;
    model.activeSketchId = sketchId;
    clearInteractionForSketchChange();
    setHint(`編集中: ${sketchName(sketchId)}`);
    updateUI();
    draw();
  }

  function renameSketch(sketchId) {
    const sketch = model.sketches.find((item) => item.id === sketchId);
    if (!sketch || isRootSketch(sketch)) return;
    const next = window.prompt("スケッチ名", sketch.name);
    if (!next) return;
    sketch.name = next.trim() || sketch.name;
    updateUI();
    draw();
    recordHistory("スケッチ名変更");
  }

  function toggleSketchVisibility(sketchId) {
    const sketch = sketchById(sketchId);
    if (!sketch || isRootSketch(sketch) || sketch.id === activeSketchId()) return false;
    const nextVisible = effectiveAppearanceForElement({ sketchId: sketch.id, appearance: {} }).visible === false;
    sketch.appearance = { ...normalizeAppearance(sketch.appearance), visible: nextVisible };
    sketch.visible = nextVisible;
    hoveredSketchTreeId = null;
    clearSnap();
    setHint(`${sketch.name}: ${sketch.visible ? "表示" : "非表示"}`);
    updateUI();
    draw();
    recordHistory(sketch.visible ? "スケッチ表示" : "スケッチ非表示");
    return true;
  }

  function valueReferencesRemovedGeometry(value, removedIds, removedKeys) {
    if (typeof value === "string") return removedIds.has(value) || removedKeys.has(value);
    if (Array.isArray(value)) return value.some((item) => valueReferencesRemovedGeometry(item, removedIds, removedKeys));
    if (value && typeof value === "object") return Object.values(value).some((item) => valueReferencesRemovedGeometry(item, removedIds, removedKeys));
    return false;
  }

  function annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys) {
    if (annotation?.type !== "leader" || !annotation.geometryRef) return false;
    const id = geometryRefId(annotation.geometryRef);
    const key = geometryRefKey(annotation.geometryRef);
    return Boolean((id && removedIds.has(id)) || (key && removedKeys.has(key)));
  }

  function deleteSketch(sketchId, confirmFirst = true) {
    ensureSketchState();
    const sketch = sketchById(sketchId);
    if (!sketch || isRootSketch(sketch)) return false;

    const sketchIds = new Set([sketch.id, ...descendantSketchIds(sketch.id)]);
    const externalReferences = model.constraints.filter((constraint) => {
      if (!constraint.reference || !sketchIds.has(constraint.referenceSketchId)) return false;
      return !sketchIds.has(constraintSketchId(constraint));
    });
    if (externalReferences.length > 0) {
      const owners = new Map();
      for (const constraint of externalReferences) {
        const ownerId = constraintSketchId(constraint);
        owners.set(ownerId, (owners.get(ownerId) || 0) + 1);
      }
      const ownerText = [...owners.entries()].map(([ownerId, count]) => `${sketchName(ownerId)} ${count}件`).join("、");
      const msg = `削除できません: ${sketch.name} またはその子孫が ${ownerText} から参照されています`;
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const blockInstancesToRemove = model.blockInstances.filter((instance) => sketchIds.has(instance.sketchId));
    const blockProjectionItemsToRemove = blockInstancesToRemove.flatMap((instance) => {
      const bundle = blockAllProjectionBundle(instance);
      return [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs];
    });
    const geometryCount = [...model.points, ...model.lines, ...model.circles, ...model.arcs].filter((item) => sketchIds.has(elementSketchId(item))).length + blockProjectionItemsToRemove.length;
    if (confirmFirst && !window.confirm(`${sketch.name} と配下のスケッチを削除します。\n図形 ${geometryCount} 件も削除されます。`)) return false;

    const pointSet = new Set(model.points.filter((point) => sketchIds.has(elementSketchId(point))));
    const lineSet = new Set(model.lines.filter((line) => sketchIds.has(elementSketchId(line)) || pointSet.has(line.p1) || pointSet.has(line.p2)));
    const circleSet = new Set(model.circles.filter((circle) => sketchIds.has(elementSketchId(circle)) || pointSet.has(circle.center)));
    const arcSet = new Set(model.arcs.filter((arc) => sketchIds.has(elementSketchId(arc)) || pointSet.has(arc.center)));
    const removedItems = [...pointSet, ...lineSet, ...circleSet, ...arcSet, ...blockProjectionItemsToRemove];
    const removedIds = new Set(removedItems.map((item) => item.id));
    const removedKeys = new Set(removedItems.map(geometryElementKey).filter(Boolean));
    const removedConstraints = new Set(model.constraints.filter((constraint) =>
      sketchIds.has(constraintSketchId(constraint))
      || sketchIds.has(constraint.referenceSketchId)
      || constraintGraphNodes(constraint).some((node) => removedItems.includes(node)),
    ));
    if (!guardDimensionSymbolDeletion(removedConstraints)) return false;

    model.constraints = model.constraints.filter((constraint) => !removedConstraints.has(constraint));
    model.lines = model.lines.filter((line) => !lineSet.has(line));
    model.circles = model.circles.filter((circle) => !circleSet.has(circle));
    model.arcs = model.arcs.filter((arc) => !arcSet.has(arc));
    model.points = model.points.filter((point) => !pointSet.has(point));
    model.blockInstances = model.blockInstances.filter((instance) => !blockInstancesToRemove.includes(instance));
    invalidateBlockProjectionCache();

    model.annotations = model.annotations.filter((annotation) => !annotationReferencesRemovedGeometry(annotation, removedIds, removedKeys));

    const fallbackId = sketch.parentSketchId && !sketchIds.has(sketch.parentSketchId) ? sketch.parentSketchId : ROOT_SKETCH_ID;
    model.sketches = model.sketches.filter((item) => !sketchIds.has(item.id));
    if (sketchIds.has(model.activeSketchId)) model.activeSketchId = sketchById(fallbackId)?.id || ROOT_SKETCH_ID;
    for (const id of sketchIds) sketchSolveStates.delete(id);

    clearInteractionForSketchChange();
    constraintAnalysisState = null;
    solveSketchAndDependents(activeSketchId());
    refreshConstraintAnalysis();
    updateUI({ refreshAnalysis: false });
    draw();
    setHint(`${sketch.name} を削除しました`);
    recordHistory("スケッチ削除");
    return true;
  }

  function updateSketchUI() {
    ensureSketchState();
    const activeLabel = document.getElementById("activeSketchLabel");
    if (activeLabel) activeLabel.textContent = "スケッチツリー";
    const sketchList = document.getElementById("sketchList");
    if (!sketchList) return;
    sketchList.onmouseleave = () => {
      if (hoveredSketchTreeId) {
        hoveredSketchTreeId = null;
        draw();
      }
    };
    sketchList.innerHTML = sketchTreeRows()
      .map(({ sketch, depth, hasChildren, segments }) => {
        const isActive = sketch.id === activeSketchId();
        const isRoot = isRootSketch(sketch);
        const visible = isVisibleSketchId(sketch.id);
        const visibilityEnabled = sketch.visible !== false;
        const solveError = sketchHasSolveError(sketch.id);
        const solveErrorTitle = sketchSolveErrorTitle(sketch.id);
        const duplicateCount = constraintDuplicateCountForSketch(sketch.id);
        const referenceErrorCount = referenceConstraintErrorCountForSketch(sketch.id);
        const count =
          model.points.filter((item) => elementSketchId(item) === sketch.id).length +
          model.lines.filter((item) => elementSketchId(item) === sketch.id).length +
          model.circles.filter((item) => elementSketchId(item) === sketch.id).length +
          model.arcs.filter((item) => elementSketchId(item) === sketch.id).length +
          model.blockInstances.filter((item) => item.sketchId === sketch.id).length;
        const treeLines = segments.length
          ? `<span class="sketch-tree-gutter" aria-hidden="true">${segments.map((segment) => `<span class="tree-segment ${segment}"></span>`).join("")}</span>`
          : "";
        const visibilityButton = isRoot
          ? ""
          : `<button class="sketchVisibilityBtn icon-small-btn ${visibilityEnabled ? "visible-on" : "visible-off"}" data-id="${sketch.id}" title="${visibilityEnabled ? "非表示にする" : "表示する"}" aria-label="${visibilityEnabled ? "非表示にする" : "表示する"}" aria-pressed="${visibilityEnabled}" ${isActive ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>${visibilityEnabled ? "" : '<path class="visibility-slash" d="M4 4l16 16"/>'}</svg></button>`;
        return (
          `<div class="item sketch-item ${visible ? "visible" : ""} ${visibilityEnabled ? "visibility-on" : "visibility-off"} ${isRoot ? "root" : ""} ${isActive ? "active" : ""} ${solveError ? "solve-error" : ""} ${referenceErrorCount ? "reference-error" : ""} ${hasChildren ? "has-children" : ""}" data-id="${sketch.id}" title="${escapeHtml(solveErrorTitle || (referenceErrorCount ? `参照エラー ${referenceErrorCount}件` : ""))}" style="--sketch-depth:${depth}">` +
          treeLines +
          `<button class="sketchActivateBtn" data-id="${sketch.id}" ${isActive ? "disabled" : ""}>${escapeHtml(sketch.name)}</button>` +
          `<span class="sketch-badges">${solveError ? `<span class="badge sketch-error-badge">!</span>` : ""}${referenceErrorCount ? `<span class="badge sketch-reference-error-badge" title="参照エラー">参照!${referenceErrorCount}</span>` : ""}${duplicateCount ? `<span class="badge sketch-duplicate-badge">重複${duplicateCount}</span>` : ""}<span class="badge">${count}</span></span>` +
          visibilityButton +
          (isRoot ? "" : `<button class="sketchRenameBtn icon-small-btn" data-id="${sketch.id}" title="名前変更" aria-label="名前変更">Aa</button><button class="sketchDeleteBtn icon-small-btn" data-id="${sketch.id}" title="スケッチ削除" aria-label="スケッチ削除"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg></button>`) +
          `</div>`
        );
      })
      .join("");
    for (const btn of document.querySelectorAll(".sketchActivateBtn")) {
      btn.addEventListener("click", () => setActiveSketch(btn.dataset.id));
    }
    for (const row of document.querySelectorAll(".sketch-item")) {
      row.addEventListener("click", (event) => {
        if (event.target.closest(".sketchVisibilityBtn, .sketchRenameBtn, .sketchDeleteBtn")) return;
        setActiveSketch(row.dataset.id);
      });
      row.addEventListener("mouseenter", () => {
        hoveredSketchTreeId = row.dataset.id;
        draw();
      });
      row.addEventListener("mouseleave", () => {
        if (hoveredSketchTreeId === row.dataset.id) {
          hoveredSketchTreeId = null;
          draw();
        }
      });
    }
    for (const btn of document.querySelectorAll(".sketchRenameBtn")) {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        renameSketch(btn.dataset.id);
      });
    }
    for (const btn of document.querySelectorAll(".sketchVisibilityBtn")) {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleSketchVisibility(btn.dataset.id);
      });
    }
    for (const btn of document.querySelectorAll(".sketchDeleteBtn")) {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteSketch(btn.dataset.id);
      });
    }
  }

  function geometryItemSelectedInCanvas(item) {
    if (!item) return false;
    if (item instanceof Point) return selectedPoints.includes(item);
    if (item instanceof Line) return selectedLines.includes(item);
    if (item instanceof Circle) return selectedCircles.includes(item);
    if (item instanceof Arc) return selectedArcs.includes(item) || selectedArcEndpoint?.arc === item || selectedArcEndpointPair?.some((endpoint) => endpoint.arc === item);
    return false;
  }

  function constraintSelectedInCanvas(constraint) {
    return Boolean(constraint && (selectedDimensionConstraint === constraint || effectiveSelectedConstraint() === constraint));
  }

  function selectedConstraintReferenceElements() {
    const elements = new Set(selectedPoints);
    for (const line of selectedLines) {
      elements.add(line);
      elements.add(line.p1);
      elements.add(line.p2);
    }
    for (const circle of selectedCircles) {
      elements.add(circle);
      elements.add(circle.center);
    }
    for (const arc of selectedArcs) {
      elements.add(arc);
      elements.add(arc.center);
    }
    if (selectedArcEndpoint) {
      elements.add(selectedArcEndpoint.arc);
      elements.add(selectedArcEndpoint.arc.center);
    }
    for (const endpoint of selectedArcEndpointPair || []) {
      elements.add(endpoint.arc);
      elements.add(endpoint.arc.center);
    }
    for (const instance of selectedBlockInstances) {
      elements.add(instance);
      const bundle = blockProjectionBundle(instance);
      for (const item of [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs]) elements.add(item);
    }
    return [...elements];
  }

  function constraintDirectlyReferencesCanvasSelection(constraint, selectedElements = selectedConstraintReferenceElements()) {
    if (!constraint || selectedElements.length === 0) return false;
    return constraintGraphNodes(constraint).some((node) => selectedElements.some((selected) => sameConstraintDisplayElement(node, selected)));
  }

  function fixedPointSelectedInCanvas(point) {
    return Boolean(point && selectedPoints.includes(point));
  }

  function sidebarHoverElementsForItem(item) {
    const elements = new Set();
    if (!item) return elements;
    elements.add(item);
    return elements;
  }

  function sidebarHoverElementsForConstraint(constraint) {
    if (constraint && targetFromConstraint(constraint)) return new Set();
    return new Set(constraint ? constraintGraphNodes(constraint).filter(Boolean) : []);
  }

  function setSidebarHover(type, item, elements) {
    hoveredSidebarItem = { type, item, elements };
    if (type === "constraint" && targetFromConstraint(item)) hoveredDimensionConstraint = item;
    draw();
  }

  function clearSidebarHover(type = null, item = null) {
    if (!hoveredSidebarItem) return;
    if (type && hoveredSidebarItem.type !== type) return;
    if (item && hoveredSidebarItem.item !== item) return;
    if (hoveredDimensionConstraint === hoveredSidebarItem.item) hoveredDimensionConstraint = null;
    hoveredSidebarItem = null;
    draw();
  }

  function updateSidebarSelectionRowClasses() {
    const selectedConstraintElements = selectedConstraintReferenceElements();
    for (const row of document.querySelectorAll(".geometry-list-row")) {
      const item = sidebarGeometryItem(row.dataset.kind, row.dataset.id);
      row.classList.toggle("sidebar-selected", geometryItemSelectedInCanvas(item));
    }
    for (const row of document.querySelectorAll(".constraint-list-row[data-idx]")) {
      const constraint = model.constraints[Number(row.dataset.idx)];
      row.classList.toggle("sidebar-selected", constraintSelectedInCanvas(constraint));
      row.classList.toggle("sidebar-related", constraintDirectlyReferencesCanvasSelection(constraint, selectedConstraintElements));
    }
    for (const row of document.querySelectorAll(".fixed-point-list-row")) {
      const point = model.points.find((item) => item.id === row.dataset.pointId);
      row.classList.toggle("sidebar-selected", fixedPointSelectedInCanvas(point));
    }
  }

  function updateGeometrySelectionUI() {
    updateToolbar();
    updateConstraintButtons();
    updateBlockUI();
    updateSidebarSelectionRowClasses();
    updatePropertiesUI();
  }

  function selectSidebarGeometryItem(item) {
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    if (!item) {
      updateSidebarSelectionRowClasses();
      draw();
      return;
    }
    if (item instanceof Point) toggleSidebarSelectionById(selectedPoints, item);
    else if (item instanceof Line) toggleSidebarSelectionById(selectedLines, item);
    else if (item instanceof Circle) toggleSidebarSelectionById(selectedCircles, item);
    else if (item instanceof Arc) toggleSidebarSelectionById(selectedArcs, item);
    updateToolbar();
    updateSidebarSelectionRowClasses();
    draw();
  }

  function selectSidebarConstraintItem(constraint) {
    clearSelection();
    if (!constraint) {
      updateGeometrySelectionUI();
      draw();
      return;
    }
    if (targetFromConstraint(constraint)) selectedDimensionConstraint = constraint;
    else selectedConstraint = constraint;
    updateGeometrySelectionUI();
    draw();
  }

  function selectSidebarFixedPoint(point) {
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    selectedArcEndpoint = null;
    selectedArcEndpointPair = null;
    if (point) toggleSidebarSelectionById(selectedPoints, point);
    updateToolbar();
    updateSidebarSelectionRowClasses();
    draw();
  }

  function sidebarGeometryItem(kind, id) {
    if (kind === "point") return model.points.find((item) => item.id === id) || null;
    if (kind === "line") return model.lines.find((item) => item.id === id) || null;
    if (kind === "circle") return model.circles.find((item) => item.id === id) || null;
    if (kind === "arc") return model.arcs.find((item) => item.id === id) || null;
    return null;
  }

  function bindSidebarItemHover() {
    for (const row of document.querySelectorAll(".geometry-list-row")) {
      row.addEventListener("mouseenter", () => {
        const item = sidebarGeometryItem(row.dataset.kind, row.dataset.id);
        setSidebarHover("geometry", item, sidebarHoverElementsForItem(item));
      });
      row.addEventListener("mouseleave", () => {
        const item = sidebarGeometryItem(row.dataset.kind, row.dataset.id);
        clearSidebarHover("geometry", item);
      });
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        const item = sidebarGeometryItem(row.dataset.kind, row.dataset.id);
        selectSidebarGeometryItem(item);
      });
    }
    for (const row of document.querySelectorAll(".constraint-list-row[data-idx]")) {
      row.addEventListener("mouseenter", () => {
        const constraint = model.constraints[Number(row.dataset.idx)];
        setSidebarHover("constraint", constraint, sidebarHoverElementsForConstraint(constraint));
      });
      row.addEventListener("mouseleave", () => {
        const constraint = model.constraints[Number(row.dataset.idx)];
        clearSidebarHover("constraint", constraint);
      });
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        const constraint = model.constraints[Number(row.dataset.idx)];
        selectSidebarConstraintItem(constraint);
      });
    }
    for (const row of document.querySelectorAll(".fixed-point-list-row")) {
      row.addEventListener("mouseenter", () => {
        const point = model.points.find((item) => item.id === row.dataset.pointId);
        setSidebarHover("fixed-point", point, sidebarHoverElementsForItem(point));
      });
      row.addEventListener("mouseleave", () => {
        const point = model.points.find((item) => item.id === row.dataset.pointId);
        clearSidebarHover("fixed-point", point);
      });
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        const point = model.points.find((item) => item.id === row.dataset.pointId);
        selectSidebarFixedPoint(point);
      });
    }
    updateSidebarSelectionRowClasses();
  }

  function blockInstanceDisableImpact(instance, nextEnabledSketchIds) {
    const definition = blockDefinitionById(instance.definitionId);
    const allItems = blockProjectionBundle(instance);
    const nextItems = createBlockProjectionBundle(instance, definition, nextEnabledSketchIds);
    const nextIds = new Set([...nextItems.points, ...nextItems.lines, ...nextItems.circles, ...nextItems.arcs].map((item) => item.id));
    const removedIds = new Set([...allItems.points, ...allItems.lines, ...allItems.circles, ...allItems.arcs].map((item) => item.id).filter((id) => !nextIds.has(id)));
    const constraints = model.constraints.filter((constraint) => constraintGraphNodes(constraint).some((node) => removedIds.has(node?.id)));
    const removedKeys = new Set([...removedIds].flatMap((id) => ["point", "line", "circle", "arc"].map((kind) => geometryRefKey(parseGeometryRefId(kind, id)))));
    const annotation = model.annotations.find((item) => annotationReferencesRemovedGeometry(item, removedIds, removedKeys));
    if (annotation) return { constraints, referenceError: `注記 ${annotation.id} から参照されています` };
    return { constraints, referenceError: null };
  }

  function setBlockInstanceEnabledSketchIds(instance, nextIds) {
    if (!instance) return false;
    const definition = blockDefinitionById(instance.definitionId);
    const drawableIds = blockDefinitionDrawableSketchIds(definition);
    const next = [...new Set(nextIds.filter((id) => drawableIds.includes(id)))];
    if (!next.some((id) => blockDefinitionGeometrySketchIds(definition).includes(id))) {
      setHint("図形を持つ内部スケッチを1つ以上有効にしてください", "error");
      updateBlockUI();
      return false;
    }
    const disableImpact = blockInstanceDisableImpact(instance, next);
    if (disableImpact.referenceError) {
      setHint(`スケッチを無効にできません: ${disableImpact.referenceError}`, "error");
      updateBlockUI();
      return false;
    }
    const removedConstraintSet = new Set(disableImpact.constraints);
    if (removedConstraintSet.size > 0) {
      if (!guardDimensionSymbolDeletion(removedConstraintSet)) {
        updateBlockUI();
        return false;
      }
      model.constraints = model.constraints.filter((constraint) => !removedConstraintSet.has(constraint));
      if (removedConstraintSet.has(selectedDimensionConstraint)) selectedDimensionConstraint = null;
      if (removedConstraintSet.has(selectedConstraint)) selectedConstraint = null;
      if (removedConstraintSet.has(hoveredDimensionConstraint)) hoveredDimensionConstraint = null;
    }
    instance.enabledSketchIds = next;
    invalidateBlockProjectionCache(instance.id);
    const instanceName = blockDefinitionById(instance.definitionId)?.name || instance.id;
    const removalNotice = removedConstraintSet.size > 0 ? ` / 関連拘束を${removedConstraintSet.size}件、自動解除しました` : "";
    setHint(`${instanceName} の表示スケッチを更新しました${removalNotice}`);
    if (removedConstraintSet.size > 0) log(`${instanceName}: スケッチ無効化に伴い関連拘束を${removedConstraintSet.size}件、自動解除しました`);
    updateUI();
    draw();
    recordHistory("ブロック構成変更");
    return true;
  }

  function setBlockInstanceRotationLocked(instance, nextLocked) {
    if (!instance || !model.blockInstances.includes(instance)) return false;
    if (instance.fixed) {
      setHint("全固定を解除してから回転モードを変更してください", "error");
      updateBlockUI();
      return false;
    }
    const locked = Boolean(nextLocked);
    if (Boolean(instance.rotationLocked) === locked) return true;
    if (!locked) {
      instance.rotationLocked = false;
      refreshConstraintAnalysis();
      setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} を自由回転にしました`);
      updateUI({ refreshAnalysis: false });
      draw();
      recordHistory("ブロック回転ロック解除");
      return true;
    }

    const snapshot = snapshotModelState();
    const targetRotation = snappedBlockRotation(instance.rotation);
    instance.rotationLocked = true;
    setBlockInstanceRotationAroundDisplayCenter(instance, targetRotation);
    const solved = solveSketchAndDependents(instance.sketchId);
    if (!solved.success || solved.dependent?.success === false) {
      restoreModelState(snapshot);
      solveSketchAndDependents(instance.sketchId);
      refreshConstraintAnalysis();
      setHint("既存の拘束が成立しないため、直交回転ロックを適用できません", "error");
      updateUI({ refreshAnalysis: false });
      draw();
      return false;
    }
    refreshConstraintAnalysis();
    setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} を${Math.round(targetRotation * 180 / Math.PI)}°で直交回転ロックしました`);
    updateUI({ refreshAnalysis: false });
    draw();
    recordHistory("ブロック直交回転ロック");
    return true;
  }

  function blockDefinitionSketchRows(definition) {
    if (!definition) return [];
    const children = new Map();
    for (const sketch of definition.sketches) {
      if (!children.has(sketch.parentSketchId)) children.set(sketch.parentSketchId, []);
      children.get(sketch.parentSketchId).push(sketch);
    }
    const rows = [];
    const visit = (parentId, depth) => {
      for (const sketch of children.get(parentId) || []) {
        if (sketch.kind === "root") continue;
        const count = [...definition.lines, ...definition.circles, ...definition.arcs, ...(definition.blockInstances || [])].filter((item) => item.sketchId === sketch.id).length;
        rows.push({ sketch, depth, count });
        visit(sketch.id, depth + 1);
      }
    };
    visit(ROOT_SKETCH_ID, 0);
    return rows;
  }

  function updateBlockUI() {
    ensureBlockState();
    const list = document.getElementById("blockList");
    const title = document.getElementById("blockOverlayTitle");
    const editorOverlay = document.getElementById("blockEditorOverlay");
    const nameInput = document.getElementById("blockEditorNameInput");
    const editorActions = document.getElementById("blockEditorActions");
    const sketchConfig = document.getElementById("blockSketchConfig");
    if (title) title.textContent = blockEditSession ? "ブロックエディタ" : "ブロック";
    if (editorOverlay) editorOverlay.hidden = !blockEditSession;
    if (nameInput) {
      nameInput.hidden = !blockEditSession;
      if (blockEditSession && document.activeElement !== nameInput) nameInput.value = blockEditSession.draft.name;
    }
    if (editorActions) editorActions.hidden = !blockEditSession;
    if (!list) return;
    list.hidden = false;
    const scopedDefinitions = blockDefinitionsInCurrentScope();
    if (scopedDefinitions.length === 0) {
      list.innerHTML = '<div class="block-item"><span class="block-item-name" data-i18n-ja="ブロックはありません" data-i18n-en="No blocks">ブロックはありません</span></div>';
      if (sketchConfig) sketchConfig.hidden = true;
      return;
    }
    list.innerHTML = scopedDefinitions.map((definition) => {
      const count = blockDefinitionUsageCount(definition.id);
      return `<div class="block-item" data-id="${escapeHtml(definition.id)}"><span class="block-item-name" title="${escapeHtml(definition.name)}">${escapeHtml(definition.name)}</span><span class="block-item-count">${count}</span><button class="blockPlaceBtn" data-id="${escapeHtml(definition.id)}">配置</button><button class="blockEditBtn" data-id="${escapeHtml(definition.id)}">編集</button><button class="blockRenameBtn" data-id="${escapeHtml(definition.id)}">Aa</button><button class="blockDeleteBtn" data-id="${escapeHtml(definition.id)}">削除</button></div>`;
    }).join("");
    const selectedDefinitionIds = new Set(selectedBlockInstances.map((instance) => instance.definitionId));
    for (const row of document.querySelectorAll(".block-item[data-id]")) {
      const selected = selectedDefinitionIds.has(row.dataset.id);
      row.classList.toggle("block-selected", selected);
      row.setAttribute("aria-selected", String(selected));
    }
    for (const button of document.querySelectorAll(".blockPlaceBtn")) button.addEventListener("click", () => {
      document.getElementById("blockDefinitionsDialog")?.close();
      startBlockPlacement(button.dataset.id);
    });
    for (const button of document.querySelectorAll(".blockEditBtn")) button.addEventListener("click", () => {
      document.getElementById("blockDefinitionsDialog")?.close();
      enterBlockDefinitionEdit(button.dataset.id);
    });
    for (const button of document.querySelectorAll(".blockRenameBtn")) button.addEventListener("click", () => renameBlockDefinition(button.dataset.id));
    for (const button of document.querySelectorAll(".blockDeleteBtn")) button.addEventListener("click", () => deleteBlockDefinition(button.dataset.id));
    for (const row of document.querySelectorAll(".block-item[data-id]")) row.addEventListener("dblclick", (event) => {
      if (!event.target.closest("button")) {
        document.getElementById("blockDefinitionsDialog")?.close();
        enterBlockDefinitionEdit(row.dataset.id);
      }
    });
    const configuringPlacement = mode === "block-place" && blockPlacementDefinitionId;
    const definition = configuringPlacement ? blockDefinitionById(blockPlacementDefinitionId) : null;
    if (!sketchConfig || !definition) {
      if (sketchConfig) sketchConfig.hidden = true;
      return;
    }
    sketchConfig.hidden = false;
    const enabled = new Set(blockPlacementEnabledSketchIds);
    const rotationConfig = `<div class="block-rotation-config"><div class="block-sketch-config-title">回転</div><label><input type="radio" name="blockRotationMode" data-rotation-mode="locked" ${blockPlacementRotationLocked ? "checked" : ""}><span>直交回転ロック</span></label><label><input type="radio" name="blockRotationMode" data-rotation-mode="free" ${blockPlacementRotationLocked ? "" : "checked"}><span>自由回転</span></label></div>`;
    sketchConfig.innerHTML = rotationConfig + `<div class="block-sketch-config-title">配置するスケッチ</div>` + blockDefinitionSketchRows(definition).map(({ sketch, depth, count }) => {
      return `<label class="block-sketch-option" style="--block-sketch-depth:${depth}"><input type="checkbox" data-sketch-id="${escapeHtml(sketch.id)}" ${enabled.has(sketch.id) ? "checked" : ""}><span>${escapeHtml(sketch.name)}</span><small>${count}</small></label>`;
    }).join("");
    for (const input of sketchConfig.querySelectorAll("input[data-rotation-mode]")) {
      input.addEventListener("change", () => {
        blockPlacementRotationLocked = input.dataset.rotationMode === "locked";
        setHint(blockPlacementRotationLocked ? "配置角度を90°単位にロックします" : "配置角度を自由回転にします");
        draw();
      });
    }
    for (const input of sketchConfig.querySelectorAll("input[data-sketch-id]")) {
      input.addEventListener("change", () => {
        blockPlacementEnabledSketchIds = [...sketchConfig.querySelectorAll("input[data-sketch-id]:checked")].map((item) => item.dataset.sketchId);
        invalidateBlockProjectionCache();
        draw();
      });
    }
  }

  function cascadeSketchAppearance(sketch, sketches, base) {
    let result = { ...base };
    const chain = [];
    let current = sketch;
    while (current) {
      chain.unshift(current);
      current = current.parentSketchId ? sketches.find((item) => item.id === current.parentSketchId) : null;
    }
    for (const item of chain) result = { ...result, ...normalizeAppearance(item.appearance) };
    return result;
  }

  function effectiveAppearanceForSketch(sketch) {
    return cascadeSketchAppearance(sketch, model.sketches, normalizeAppearance(model.defaultAppearance, { partial: false }));
  }

  function defaultAppearanceLabel() {
    return applicationText("既定", "Default");
  }

  function colorPickerValue(value) {
    const color = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map((part) => part.repeat(2)).join("")}`.toLowerCase();
    return "#111827";
  }

  function usedFileColors() {
    const colors = [];
    const seen = new Set();
    const add = (value) => {
      const color = String(value || "").trim();
      if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return;
      const normalized = colorPickerValue(color);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      colors.push(normalized);
    };
    const addAppearance = (appearance) => add(appearance?.color);
    addAppearance(model.defaultAppearance);
    addAppearance(model.defaultConstructionAppearance);
    for (const sketch of model.sketches) addAppearance(sketch.appearance);
    for (const item of [...model.points, ...model.lines, ...model.circles, ...model.arcs]) addAppearance(item.appearance);
    for (const instance of model.blockInstances) addAppearance(instance.appearanceOverride);
    for (const annotation of model.annotations) add(annotation.style?.color);
    for (const definition of model.blockDefinitions) {
      for (const sketch of definition.sketches || []) addAppearance(sketch.appearance);
      for (const item of [...(definition.points || []), ...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || [])]) addAppearance(item.appearance);
      for (const instance of definition.blockInstances || []) addAppearance(instance.appearanceOverride);
      for (const annotation of definition.annotations || []) add(annotation.style?.color);
    }
    return colors;
  }

  function colorPaletteSwatches(colors, selectedColor, groupLabel) {
    const selected = colorPickerValue(selectedColor);
    return colors.map((color) =>
      `<button class="property-color-swatch" data-palette-color="${color}" type="button" style="--swatch-color:${color}" title="${escapeHtml(groupLabel)}: ${color}" aria-label="${escapeHtml(groupLabel)}: ${color}" aria-pressed="${selected === color}"></button>`,
    ).join("");
  }

  function appearancePropertyRows(owner, effective, { allowInheritance = true, constructionEndpoints = false, idPrefix = "property" } = {}) {
    const direct = normalizeAppearance(owner);
    const inherited = (key) => allowInheritance && direct[key] == null;
    const option = (value, label, selected) => `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
    const defaultLabel = defaultAppearanceLabel();
    const colorValue = colorPickerValue(direct.color || effective.color);
    const endpointRows = constructionEndpoints ? `
      <div class="property-row"><label for="${idPrefix}EndpointOverhang">${applicationText("端部のはみ出し", "Endpoint overhang")}</label><select id="${idPrefix}EndpointOverhang" data-appearance-key="endpointOverhang">
        ${allowInheritance ? option("", defaultLabel, inherited("endpointOverhang")) : ""}
        ${option("true", applicationText("あり", "Enabled"), direct.endpointOverhang === true || !allowInheritance && effective.endpointOverhang !== false)}${option("false", applicationText("なし", "Disabled"), direct.endpointOverhang === false)}
      </select></div>
      <div class="property-row"><label for="${idPrefix}EndpointMarkers">${applicationText("端部の点", "Endpoint points")}</label><select id="${idPrefix}EndpointMarkers" data-appearance-key="endpointMarkers">
        ${allowInheritance ? option("", defaultLabel, inherited("endpointMarkers")) : ""}
        ${option("true", applicationText("表示", "Visible"), direct.endpointMarkers === true || !allowInheritance && effective.endpointMarkers !== false)}${option("false", applicationText("非表示", "Hidden"), direct.endpointMarkers === false)}
      </select></div>` : "";
    return `
      <div class="property-row"><label for="${idPrefix}Visible">Visible</label><select id="${idPrefix}Visible" data-appearance-key="visible">
        ${allowInheritance ? option("", defaultLabel, inherited("visible")) : ""}
        ${option("true", "表示", direct.visible === true || !allowInheritance && effective.visible !== false)}${option("false", "非表示", direct.visible === false)}
      </select></div>
      <div class="property-row"><label for="${idPrefix}Color">Color</label><div class="property-color-control"><input id="${idPrefix}Color" data-appearance-key="color" type="text" placeholder="${defaultLabel}" value="${escapeHtml(direct.color || "")}" /><button class="property-color-picker" data-appearance-palette-open data-current-color="${colorValue}" type="button" title="カラーパレット" aria-label="カラーパレット"><span class="property-color-picker-swatch" style="--swatch-color:${colorValue}" aria-hidden="true"></span></button></div></div>
      <div class="property-row"><label for="${idPrefix}LineType">Line type</label><select id="${idPrefix}LineType" data-appearance-key="lineType">
        ${allowInheritance ? option("", defaultLabel, inherited("lineType")) : ""}
        ${option("solid", "実線", direct.lineType === "solid" || !allowInheritance && effective.lineType === "solid")}${option("dashed", "破線", direct.lineType === "dashed")}${option("dashdot", "一点鎖線", direct.lineType === "dashdot")}${option("dotted", "点線", direct.lineType === "dotted")}
      </select></div>
      <div class="property-row"><label for="${idPrefix}LineWidth">Line width</label><input id="${idPrefix}LineWidth" data-appearance-key="lineWidth" type="number" min="0.1" max="20" step="0.1" placeholder="${defaultLabel}" value="${direct.lineWidth ?? ""}" /></div>${endpointRows}`;
  }

  function selectedPropertiesTarget() {
    if (selectedAnnotation) return { kind: "annotation", item: selectedAnnotation };
    const constraint = selectedDimensionConstraint || effectiveSelectedConstraint();
    if (constraint) return { kind: "constraint", item: constraint };
    if (selectedBlockInstances.length === 1 && selectedGeometryItems().length === 0) return { kind: "block", item: selectedBlockInstances[0] };
    const geometry = selectedGeometryItems();
    if (geometry.length === 1 && selectedBlockInstances.length === 0) return { kind: "geometry", item: geometry[0] };
    if (geometry.length + selectedBlockInstances.length > 1) return { kind: "multiple", count: geometry.length + selectedBlockInstances.length };
    return { kind: "sketch", item: sketchById(activeSketchId()) };
  }

  function geometryPropertyName(item) {
    if (item instanceof Point) return `${applicationText("点", "Point")} ${item.id}`;
    if (item instanceof Line) return `${applicationText("線", "Line")} ${item.id}`;
    if (item instanceof Circle) return `${applicationText("円", "Circle")} ${item.id}`;
    if (item instanceof Arc) return `${applicationText("円弧", "Arc")} ${item.id}`;
    return item?.id || applicationText("ジオメトリ", "Geometry");
  }

  function propertyReadonlyRow(labelJa, labelEn, value, { userContent = false } = {}) {
    return `<div class="property-row"><span>${escapeHtml(applicationText(labelJa, labelEn))}</span><span class="property-readonly" ${userContent ? "data-user-content" : ""}>${escapeHtml(value)}</span></div>`;
  }

  function geometryPropertyRows(item) {
    const type = item instanceof Point
      ? applicationText("点", "Point")
      : item instanceof Line
        ? applicationText("線", "Line")
        : item instanceof Circle
          ? applicationText("円", "Circle")
          : applicationText("円弧", "Arc");
    let rows = propertyReadonlyRow("種類", "Type", type) + propertyReadonlyRow("ID", "ID", item.id);
    if (item instanceof Point) {
      rows += propertyReadonlyRow("X座標", "X coordinate", formatDisplayNumber(item.x));
      rows += propertyReadonlyRow("Y座標", "Y coordinate", formatDisplayNumber(item.y));
      rows += propertyReadonlyRow("固定", "Fixed", applicationText(item.fixed ? "はい" : "いいえ", item.fixed ? "Yes" : "No"));
      return rows;
    }
    if (item instanceof Line) {
      rows += propertyReadonlyRow("始点ID", "Start point ID", item.p1.id);
      rows += propertyReadonlyRow("終点ID", "End point ID", item.p2.id);
      rows += propertyReadonlyRow("長さ", "Length", formatDisplayNumber(item.length()));
      rows += propertyReadonlyRow("拘束状態", "Constraint status", constraintStatusBadge(constraintStatusOf(item)));
    } else {
      rows += propertyReadonlyRow("中心点ID", "Center point ID", item.center.id);
      rows += propertyReadonlyRow("半径", "Radius", formatDisplayNumber(item.radius()));
      if (item instanceof Arc) {
        rows += propertyReadonlyRow("始点角度", "Start angle", `${formatDisplayNumber(angleDegrees(item.startAngle))}°`);
        rows += propertyReadonlyRow("終点角度", "End angle", `${formatDisplayNumber(angleDegrees(item.endAngle))}°`);
      }
    }
    rows += `<div class="property-row"><label>${applicationText("補助線", "Construction")}</label><input data-property="construction" type="checkbox" aria-label="${applicationText("補助線", "Construction")}" ${item.construction ? "checked" : ""}></div>`;
    return rows;
  }

  function blockPropertiesConfiguration(item, definition) {
    const enabled = blockInstanceEnabledSketchSet(item, definition);
    const rotationLocked = Boolean(item.rotationLocked);
    const rotationDisabled = Boolean(item.fixed);
    const rows = blockDefinitionSketchRows(definition);
    return `
      <div class="property-option-group">
        <div class="property-option-group-title">${applicationText("回転モード", "Rotation mode")}</div>
        <label class="property-option"><input type="radio" name="propertyBlockRotationMode" data-block-rotation-mode="locked" ${rotationLocked ? "checked" : ""} ${rotationDisabled ? "disabled" : ""}><span>${applicationText("直交回転ロック", "Orthogonal rotation lock")}</span></label>
        <label class="property-option"><input type="radio" name="propertyBlockRotationMode" data-block-rotation-mode="free" ${rotationLocked ? "" : "checked"} ${rotationDisabled ? "disabled" : ""}><span>${applicationText("自由回転", "Free rotation")}</span></label>
        ${rotationDisabled ? `<small>${applicationText("全固定中", "Fully fixed")}</small>` : ""}
      </div>
      <div class="property-option-group">
        <div class="property-option-group-title">${applicationText("表示するスケッチ", "Visible sketches")}</div>
        ${rows.map(({ sketch, depth, count }) => `<label class="property-option property-sketch-option" style="--property-sketch-depth:${depth}"><input type="checkbox" data-block-sketch-id="${escapeHtml(sketch.id)}" ${enabled.has(sketch.id) ? "checked" : ""}><span data-user-content>${escapeHtml(sketch.name)}</span><small>${count}</small></label>`).join("")}
      </div>`;
  }

  function dimensionDisplayState(dimension) {
    const display = dimension?.display || {};
    return {
      visible: display.visible !== false,
      precision: Number.isInteger(display.precision) ? Math.max(0, Math.min(10, display.precision)) : null,
      prefix: String(display.prefix || ""),
      suffix: String(display.suffix || ""),
      toleranceUpper: display.toleranceUpper == null ? "" : String(display.toleranceUpper),
      toleranceLower: display.toleranceLower == null ? "" : String(display.toleranceLower),
      arrows: display.arrows !== false,
      extensionLines: display.extensionLines !== false,
    };
  }

  function localizedConstraintName(name) {
    const value = String(name || applicationText("拘束", "Constraint"));
    if (applicationLanguage !== "en") return value;
    const replacements = [
      [/^円弧端点-円周一致/, "Arc endpoint on circumference"], [/^円弧端点-線一致/, "Arc endpoint on line"], [/^円弧端点一致/, "Arc endpoint coincident"],
      [/^点-線寸法/, "Point-line dimension"], [/^線-線寸法/, "Line-line dimension"], [/^オフセット寸法/, "Offset dimension"],
      [/^水平寸法/, "Horizontal dimension"], [/^垂直寸法/, "Vertical dimension"], [/^点-線一致/, "Point-line coincident"], [/^点-円周一致/, "Point on circumference"],
      [/^中点一致/, "Midpoint coincident"], [/^最小線長/, "Minimum line length"], [/^線固定/, "Fixed line"], [/^点水平/, "Point horizontal"], [/^点垂直/, "Point vertical"],
      [/^線対称/, "Line symmetry"], [/^同一直線/, "Collinear"], [/^寸法/, "Dimension"], [/^角度/, "Angle"], [/^一致/, "Coincident"],
      [/^水平/, "Horizontal"], [/^垂直/, "Vertical"], [/^平行/, "Parallel"], [/^等寸/, "Equal"], [/^半径/, "Radius"], [/^直径/, "Diameter"],
      [/^同心/, "Concentric"], [/^接線/, "Tangent"], [/^対称/, "Symmetry"], [/^ドラッグ/, "Drag"],
    ];
    for (const [pattern, replacement] of replacements) if (pattern.test(value)) return value.replace(pattern, replacement);
    return value;
  }

  function updatePropertiesUI() {
    const panel = document.getElementById("propertiesPanel");
    if (!panel) return;
    const target = selectedPropertiesTarget();
    if (!target.item && target.kind !== "multiple") {
      panel.innerHTML = '<p class="properties-empty">選択したオブジェクトのプロパティを表示します。</p>';
      localizeApplicationUI(panel);
      return;
    }
    if (target.kind === "multiple") {
      panel.innerHTML = `<h2 class="property-heading">${target.count} ${applicationText("個のオブジェクト", "objects")}</h2><p class="properties-empty">複数選択の共通プロパティ編集は今回の対象外です。</p>`;
      localizeApplicationUI(panel);
      return;
    }
    const item = target.item;
    if (target.kind === "geometry") {
      const effective = effectiveAppearanceForElement(item);
      panel.innerHTML = `<h2 class="property-heading">${escapeHtml(geometryPropertyName(item))}</h2><section class="property-section"><h3>Geometry</h3>${geometryPropertyRows(item)}</section><section class="property-section"><h3>Appearance</h3>${appearancePropertyRows(item.appearance, effective, { constructionEndpoints: item instanceof Line && item.construction })}</section>`;
    } else if (target.kind === "block") {
      const definition = blockDefinitionById(item.definitionId);
      const effective = blockProjectionBundle(item).lines[0] ? effectiveAppearanceForElement(blockProjectionBundle(item).lines[0]) : normalizeAppearance(model.defaultAppearance, { partial: false });
      const definitionLabel = definition ? `${definition.name} (${definition.id})` : item.definitionId;
      const rows = propertyReadonlyRow("種類", "Type", applicationText("ブロック", "Block"))
        + propertyReadonlyRow("ID", "ID", item.id)
        + propertyReadonlyRow("ブロック定義", "Block definition", definitionLabel, { userContent: true })
        + propertyReadonlyRow("X座標", "X coordinate", formatDisplayNumber(item.x))
        + propertyReadonlyRow("Y座標", "Y coordinate", formatDisplayNumber(item.y))
        + propertyReadonlyRow("回転角度", "Rotation angle", `${formatDisplayNumber(angleDegrees(item.rotation))}°`);
      panel.innerHTML = `<h2 class="property-heading">${applicationText("ブロック", "Block")} ${escapeHtml(item.id)}</h2><section class="property-section"><h3>Block</h3>${rows}${blockPropertiesConfiguration(item, definition)}</section><section class="property-section"><h3>Appearance Override</h3>${appearancePropertyRows(item.appearanceOverride, effective)}</section>`;
    } else if (target.kind === "constraint") {
      const dimension = item.dimension;
      const display = dimensionDisplayState(dimension);
      const targetValue = targetFromConstraint(item);
      const value = isReadOnlyDimension(item)
        ? measuredDimensionValue(targetValue, dimension)
        : targetValue?.kind === "angle" ? angleDegrees(item.target) : item.target;
      const parameterRows = dimension
        ? `<div class="property-row"><label>${applicationText("Parameter名", "Parameter name")}</label><input data-property="constraint-parameter-name" value="${escapeHtml(item.parameterName || "")}"></div>`
          + (!isReadOnlyDimension(item)
            ? `<div class="property-row"><label>${applicationText("数式", "Expression")}</label><input data-property="constraint-expression" value="${escapeHtml(item.expression || numericDimensionExpression(item))}"></div>`
            : `<div class="property-row"><span>${applicationText("数式", "Expression")}</span><span class="property-readonly">${applicationText("Geometryから測定", "Measured from geometry")}</span></div>`)
          + propertyReadonlyRow("評価値", "Evaluated value", Number.isFinite(value) ? formatDisplayNumber(value) : "—")
        : "";
      panel.innerHTML = `<h2 class="property-heading">${escapeHtml(localizedConstraintName(item.name))}</h2><section class="property-section"><h3>Constraint</h3><div class="property-row"><span>Type</span><span class="property-readonly">${escapeHtml(item.constructor.name)}</span></div>${parameterRows}</section>${dimension ? `<section class="property-section"><h3>Dimension Display</h3><div class="property-row"><label>Visible</label><input data-dimension-display="visible" type="checkbox" ${display.visible ? "checked" : ""}></div><div class="property-row"><label>Precision</label><input data-dimension-display="precision" type="number" min="0" max="10" placeholder="自動" value="${display.precision ?? ""}"></div><div class="property-row"><label>Prefix</label><input data-dimension-display="prefix" value="${escapeHtml(display.prefix)}"></div><div class="property-row"><label>Suffix</label><input data-dimension-display="suffix" value="${escapeHtml(display.suffix)}"></div><div class="property-row"><label>Arrows</label><input data-dimension-display="arrows" type="checkbox" ${display.arrows ? "checked" : ""}></div><div class="property-row"><label>Extension lines</label><input data-dimension-display="extensionLines" type="checkbox" ${display.extensionLines ? "checked" : ""}></div></section>` : ""}`;
    } else if (target.kind === "annotation") {
      const annotationType = item.type === "leader" ? applicationText("引出線", "Leader") : applicationText("自由テキスト", "Free Text");
      panel.innerHTML = `<h2 class="property-heading">${annotationType} ${escapeHtml(item.id)}</h2><section class="property-section"><h3>Annotation</h3>${propertyReadonlyRow("種類", "Type", annotationType)}${propertyReadonlyRow("ID", "ID", item.id)}<div class="property-row"><label>Visible</label><input data-property="annotation-visible" type="checkbox" ${item.visible !== false ? "checked" : ""}></div>${item.type === "text" ? `<div class="property-row"><label>Text</label><textarea data-property="annotation-text">${escapeHtml(item.text || "")}</textarea></div><div class="property-row"><label>Font size</label><input data-property="annotation-font-size" type="number" min="6" max="72" value="${Number(item.style?.fontSize || 13)}"></div>` : ""}<div class="property-row"><label>Color</label><input data-property="annotation-color" type="text" value="${escapeHtml(item.style?.color || "#111827")}"></div></section>`;
    } else {
      const effective = effectiveAppearanceForSketch(item);
      const parent = sketchById(item.parentSketchId);
      const parentLabel = parent ? `${parent.name} (${parent.id})` : applicationText("なし", "None");
      const rows = propertyReadonlyRow("種類", "Type", applicationText("スケッチ", "Sketch"))
        + propertyReadonlyRow("ID", "ID", item.id)
        + propertyReadonlyRow("名前", "Name", item.name, { userContent: true })
        + propertyReadonlyRow("親スケッチ", "Parent sketch", parentLabel, { userContent: Boolean(parent) })
        + propertyReadonlyRow("アクティブ", "Active", applicationText("はい", "Yes"));
      panel.innerHTML = `<h2 class="property-heading">${applicationText("スケッチ", "Sketch")} <span data-user-content>${escapeHtml(item.name)}</span></h2><section class="property-section"><h3>Sketch</h3>${rows}</section><section class="property-section"><h3>Appearance</h3>${appearancePropertyRows(item.appearance, effective)}</section>`;
    }

    localizeApplicationUI(panel);
    panel.oninput = handlePropertiesInput;
    panel.onchange = handlePropertiesChange;
    panel.onclick = handlePropertiesClick;
  }

  function applyAppearanceInput(target, key, rawValue) {
    if (!target) return;
    const next = { ...normalizeAppearance(target) };
    if (rawValue === "") delete next[key];
    else if (["visible", "endpointOverhang", "endpointMarkers"].includes(key)) next[key] = rawValue === "true";
    else if (key === "lineWidth") next[key] = Math.max(0.1, Math.min(20, Number(rawValue)));
    else next[key] = rawValue;
    Object.assign(target, normalizeAppearance(next));
    for (const existingKey of ["visible", "color", "lineType", "lineWidth", "endpointOverhang", "endpointMarkers"]) if (next[existingKey] == null) delete target[existingKey];
  }

  function applyDimensionDisplayInput(constraint, input) {
    if (!constraint?.dimension || !input?.dataset.dimensionDisplay) return false;
    const display = { ...(constraint.dimension.display || {}) };
    const key = input.dataset.dimensionDisplay;
    if (input.type === "checkbox") display[key] = input.checked;
    else if (key === "precision") display[key] = input.value === "" ? null : Math.max(0, Math.min(10, Math.round(Number(input.value))));
    else if (key === "toleranceUpper" || key === "toleranceLower") display[key] = input.value === "" ? null : Number(input.value);
    else display[key] = input.value;
    constraint.dimension.display = display;
    return true;
  }

  function appearanceOwnerForPropertiesTarget(target) {
    if (target.kind === "block") return (target.item.appearanceOverride ||= {});
    if (target.kind === "geometry" || target.kind === "sketch") return (target.item.appearance ||= {});
    return null;
  }

  function renderColorPaletteDialog(selectedColor) {
    const defaultPalette = document.getElementById("defaultColorPalette");
    const usedPalette = document.getElementById("usedColorPalette");
    const customPicker = document.getElementById("customColorPicker");
    const defaultsLabel = applicationText("標準色", "Standard colors");
    const usedLabel = applicationText("このファイルで使用中の色", "Colors used in this file");
    const selected = colorPickerValue(selectedColor);
    if (defaultPalette) defaultPalette.innerHTML = colorPaletteSwatches(DEFAULT_COLOR_PALETTE, selected, defaultsLabel);
    if (usedPalette) {
      const colors = usedFileColors();
      usedPalette.innerHTML = colors.length > 0
        ? colorPaletteSwatches(colors, selected, usedLabel)
        : `<p class="color-palette-empty">${applicationText("使用中の色はありません", "No colors are used yet")}</p>`;
    }
    if (customPicker) customPicker.value = selected;
    const dialog = document.getElementById("colorPaletteDialog");
    if (dialog) localizeApplicationUI(dialog);
  }

  function openAppearanceColorPalette(button, context = "properties") {
    let target = null;
    let owner = null;
    let historyLabel = "Appearance変更";
    if (context === "document") {
      owner = model.defaultAppearance;
      historyLabel = "Document Default Appearance変更";
    } else if (context === "document-construction") {
      owner = model.defaultConstructionAppearance;
      historyLabel = "Document Default Construction Appearance変更";
    } else {
      target = selectedPropertiesTarget();
      owner = appearanceOwnerForPropertiesTarget(target);
      historyLabel = target.kind === "block" ? "Appearance Override変更" : "Appearance変更";
    }
    if (!owner) return;
    colorPaletteSession = {
      owner,
      target,
      historyLabel,
      context,
      sourceButton: button,
      sourceInput: button.closest(".property-color-control")?.querySelector('[data-appearance-key="color"]') || null,
    };
    const selected = colorPaletteSession.sourceInput?.value.trim() || button.dataset.currentColor || owner.color;
    renderColorPaletteDialog(selected);
    const dialog = document.getElementById("colorPaletteDialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function commitColorPaletteValue(value) {
    if (!colorPaletteSession) return;
    const color = colorPickerValue(value);
    const { owner, target, historyLabel, context, sourceButton, sourceInput } = colorPaletteSession;
    applyAppearanceInput(owner, "color", color);
    if (target?.kind === "block") invalidateBlockProjectionCache(target.item.id);
    if (!target && context === "document") model.defaultAppearance = normalizeAppearance(model.defaultAppearance, { partial: false });
    if (!target && context === "document-construction") model.defaultConstructionAppearance = normalizeConstructionAppearance(model.defaultConstructionAppearance, { partial: false });
    if (sourceInput) sourceInput.value = color;
    if (sourceButton) {
      sourceButton.dataset.currentColor = color;
      sourceButton.querySelector(".property-color-picker-swatch")?.style.setProperty("--swatch-color", color);
    }
    recordHistory(historyLabel);
    document.getElementById("colorPaletteDialog")?.close();
    colorPaletteSession = null;
    updateUI();
    draw();
  }

  function handlePropertiesInput(event) {
    const input = event.target;
    if (!input.matches('[data-dimension-display="prefix"], [data-dimension-display="suffix"]')) return;
    const target = selectedPropertiesTarget();
    if (target.kind !== "constraint" || !applyDimensionDisplayInput(target.item, input)) return;
    draw();
  }

  function clearCanvasHover() {
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArcEndpoint = null;
    hoveredArc = null;
    hoveredDimensionConstraint = null;
    hoveredSketchIdentity = null;
    hoveredBlockInstance = null;
    hoveredAnnotation = null;
  }

  function commitDimensionParameterName(constraint, requestedName) {
    const namespace = currentParameterNamespace();
    ensureParameterNamespace(namespace);
    const oldName = constraint.parameterName;
    const nextName = validateParameterIdentifier(String(requestedName || "").trim(), { dimension: true });
    if (nextName === oldName) return true;
    const conflict = namespace.parameters.some((parameter) => parameter.name === nextName)
      || dimensionConstraintsInNamespace(namespace).some((item) => item !== constraint && item.parameterName === nextName);
    if (conflict) throw Object.assign(new Error(`Duplicate identifier '${nextName}'`), { code: "DUPLICATE_IDENTIFIER", identifier: nextName });
    const replacements = new Map([[oldName, nextName]]);
    for (const parameter of namespace.parameters) parameter.expression = rewriteParameterIdentifiers(parameter.expression, replacements);
    for (const item of dimensionConstraintsInNamespace(namespace)) {
      if (!isReadOnlyDimension(item)) item.expression = rewriteParameterIdentifiers(item.expression, replacements);
    }
    constraint.parameterName = nextName;
    const autoMatch = /^d(\d+)$/.exec(nextName);
    if (autoMatch) namespace.nextDimensionParameterIndex = Math.max(namespace.nextDimensionParameterIndex, Number(autoMatch[1]) + 1);
    return true;
  }

  function commitDimensionPropertyEdit(constraint, property, value) {
    const snapshot = snapshotModelState();
    try {
      if (property === "constraint-parameter-name") commitDimensionParameterName(constraint, value);
      else if (property === "constraint-expression") constraint.expression = String(value).trim();
      const solved = stabilizeActiveParameterNamespace(constraintSketchId(constraint));
      if (!solved.success || solved.dependent?.success === false || solved.result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
        throw new Error(solved.result.reason || applicationText("拘束が成立しません", "Constraints could not be satisfied"));
      }
      recordHistory(property === "constraint-parameter-name" ? "寸法Parameter名変更" : "寸法式変更");
      setHint(property === "constraint-parameter-name" ? applicationText("寸法Parameter名を変更しました", "Dimension parameter name changed") : applicationText("寸法式を変更しました", "Dimension expression changed"));
      return true;
    } catch (error) {
      restoreModelState(snapshot);
      setHint(parameterErrorText(error), "error");
      return false;
    }
  }

  function handlePropertiesChange(event) {
    const target = selectedPropertiesTarget();
    const input = event.target;
    if (input.dataset.appearanceKey) {
      const owner = appearanceOwnerForPropertiesTarget(target);
      applyAppearanceInput(owner, input.dataset.appearanceKey, input.value.trim());
      if (target.kind === "block") invalidateBlockProjectionCache(target.item.id);
      recordHistory(target.kind === "block" ? "Appearance Override変更" : "Appearance変更");
      updateUI();
      draw();
      return;
    }
    if (input.dataset.dimensionDisplay && target.kind === "constraint" && target.item.dimension) {
      const liveTextInput = input.dataset.dimensionDisplay === "prefix" || input.dataset.dimensionDisplay === "suffix";
      applyDimensionDisplayInput(target.item, input);
      recordHistory("寸法表示変更");
      if (!liveTextInput) updatePropertiesUI();
      draw();
      return;
    }
    if (target.kind === "block" && input.dataset.blockRotationMode) {
      if (!setBlockInstanceRotationLocked(target.item, input.dataset.blockRotationMode === "locked")) updatePropertiesUI();
      return;
    }
    if (target.kind === "block" && input.dataset.blockSketchId) {
      const next = [...input.closest("#propertiesPanel").querySelectorAll("input[data-block-sketch-id]:checked")].map((item) => item.dataset.blockSketchId);
      if (!setBlockInstanceEnabledSketchIds(target.item, next)) updatePropertiesUI();
      return;
    }
    const property = input.dataset.property;
    if (!property) return;
    if (target.kind === "geometry" && property === "construction") {
      target.item.construction = input.checked;
      recordHistory("補助線変更");
    } else if (target.kind === "constraint" && (property === "constraint-parameter-name" || property === "constraint-expression")) {
      commitDimensionPropertyEdit(target.item, property, input.value);
      updateUI();
      draw();
      return;
    } else if (target.kind === "annotation") {
      if (property === "annotation-visible") target.item.visible = input.checked;
      if (property === "annotation-text") target.item.text = input.value;
      if (property === "annotation-font-size") target.item.style = { ...target.item.style, fontSize: Math.max(6, Math.min(72, Number(input.value) || 13)) };
      if (property === "annotation-color") target.item.style = { ...target.item.style, color: input.value || "#111827" };
      recordHistory("注記変更");
    }
    updateUI();
    draw();
  }

  function handlePropertiesClick(event) {
    const button = event.target.closest("[data-appearance-palette-open]");
    if (!button) return;
    openAppearanceColorPalette(button);
  }

  function updateObjectExplorerUI() {
    const blockList = document.getElementById("blockInstanceObjectList");
    if (blockList) blockList.innerHTML = model.blockInstances.filter(isActiveSketchElement).map((item) => `<div class="item object-row ${selectedBlockInstances.includes(item) ? "selected" : ""}" data-object-kind="block" data-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.id)}</span><span class="badge">${escapeHtml(blockDefinitionById(item.definitionId)?.name || item.definitionId)}</span></div>`).join("");
    const annotationList = document.getElementById("annotationObjectList");
    if (annotationList) annotationList.innerHTML = model.annotations.map((item) => `<div class="item object-row ${selectedAnnotation === item ? "selected" : ""}" data-object-kind="annotation" data-id="${escapeHtml(item.id)}"><span>${item.type === "leader" ? applicationText("引出線", "Leader") : applicationText("テキスト", "Text")} ${escapeHtml(item.id)}</span></div>`).join("");
    for (const row of document.querySelectorAll(".geometry-list-row")) {
      const kind = row.dataset.kind;
      const item = kind === "point" ? model.points.find((value) => value.id === row.dataset.id) : kind === "line" ? model.lines.find((value) => value.id === row.dataset.id) : kind === "circle" ? model.circles.find((value) => value.id === row.dataset.id) : model.arcs.find((value) => value.id === row.dataset.id);
      row.classList.toggle("selected", selectedGeometryItems().includes(item));
    }
    for (const row of document.querySelectorAll(".constraint-list-row")) row.classList.toggle("selected", model.constraints[Number(row.dataset.idx)] === (selectedDimensionConstraint || effectiveSelectedConstraint()));
  }

  function updateStatusUI() {
    const command = document.getElementById("statusCommand");
    const modeLabels = {
      select: applicationText("選択", "Select"), point: applicationText("点", "Point"), line: applicationText("線", "Line"), rectangle: applicationText("矩形", "Rectangle"),
      circle: applicationText("円", "Circle"), arc: applicationText("円弧", "Arc"), fillet: applicationText("R面取り", "Fillet"), trim: applicationText("トリム", "Trim"),
      offset: applicationText("オフセット", "Offset"), "block-place": applicationText("ブロック配置", "Block placement"),
    };
    if (command) command.textContent = pendingCommand?.type?.startsWith("annotation-") ? applicationText("注記", "Annotation") : pendingConstraintCommand ? applicationText("拘束", "Constraint") : modeLabels[mode] || mode;
    const constraint = document.getElementById("statusConstraint");
    if (constraint) constraint.textContent = viewState.constraintStatus ? "拘束状態表示中" : constraintSummaryText();
  }

  function updateUI({ refreshAnalysis = true } = {}) {
    ensureParameterNamespace(currentParameterNamespace());
    if (refreshAnalysis) refreshConstraintAnalysis();
    updateDocumentNameUI();
    updateToolbar();
    updateSketchUI();
    updateBlockUI();
    const listedPoints = model.points.filter(isActiveSketchElement).filter((point) => isExplicitPoint(point) || isPointUsedByLine(point));
    const listedLines = model.lines.filter(isActiveSketchElement);
    const listedCircles = model.circles.filter(isActiveSketchElement);
    const listedArcs = model.arcs.filter(isActiveSketchElement);
    document.getElementById("pointCount").textContent = String(listedPoints.length);
    document.getElementById("lineCount").textContent = String(listedLines.length);
    document.getElementById("circleCount").textContent = String(listedCircles.length);
    document.getElementById("arcCount").textContent = String(listedArcs.length);
    document.getElementById("annotationCount").textContent = String(model.annotations.length);
    document.getElementById("pointList").innerHTML = listedPoints
      .map(
        (p) =>
          `<div class="item list-item geometry-list-row" data-kind="point" data-id="${p.id}"><span>${p.id}` +
          `<span class="badge">x=${p.x.toFixed(1)}</span>` +
          `<span class="badge">y=${p.y.toFixed(1)}</span>` +
          `<span class="badge">${constraintStatusBadge(constraintStatusOf(p))}</span>` +
          `${p.fixed ? "<span class='badge'>固定</span>" : ""}</span>` +
          `<button data-id="${p.id}" class="removePointBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    document.getElementById("lineList").innerHTML = listedLines
      .map(
        (l) =>
          `<div class="item list-item geometry-list-row" data-kind="line" data-id="${l.id}"><span>${l.id}: ${l.p1.id} - ${l.p2.id}<span class="badge">len=${formatDisplayNumber(l.length())}</span><span class="badge">${constraintStatusBadge(constraintStatusOf(l))}</span>${l.construction ? "<span class='badge'>補助</span>" : ""}${findLineFixedConstraint(l) ? "<span class='badge'>固定</span>" : ""}</span>` +
          `<button data-id="${l.id}" class="removeLineBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    document.getElementById("circleList").innerHTML = listedCircles
      .map(
        (circle) =>
          `<div class="item list-item geometry-list-row" data-kind="circle" data-id="${circle.id}"><span>${circle.id}: 中心 ${circle.center.id}<span class="badge">R=${formatDisplayNumber(circle.radius())}</span><span class="badge">${constraintStatusBadge(constraintStatusOf(circle))}</span>${circle.construction ? "<span class='badge'>補助</span>" : ""}</span>` +
          `<button data-id="${circle.id}" class="removeCircleBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    document.getElementById("arcList").innerHTML = listedArcs
      .map(
        (arc) =>
          `<div class="item list-item geometry-list-row" data-kind="arc" data-id="${arc.id}"><span>${arc.id}: 中心 ${arc.center.id}<span class="badge">R=${formatDisplayNumber(arc.radius())}</span><span class="badge">角度=${formatDisplayNumber(angleDegrees(Math.abs(arc.endAngle - arc.startAngle)))}°</span><span class="badge">${constraintStatusBadge(constraintStatusOf(arc))}</span>${arc.construction ? "<span class='badge'>補助</span>" : ""}</span>` +
          `<button data-id="${arc.id}" class="removeArcBtn icon-delete-btn" title="削除" aria-label="削除" data-tooltip="削除">` +
          `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
          `</button></div>`,
      )
      .join("");

    const listedConstraints = model.constraints
      .map((constraint, index) => ({ constraint, index }))
      .filter(({ constraint }) => isActiveSketchConstraint(constraint));
    const fixedPoints = model.points.filter((point) => isActiveSketchElement(point) && point.fixed);
    const constraintRows = listedConstraints.map(({ constraint, index }, displayIndex) => {
      const duplicate = constraintIsRedundant(constraint);
      const referenceError = referenceConstraintErrorInfo(constraint);
      const parameterPrefix = isDimensionConstraint(constraint) ? `${constraint.parameterName}: ` : "";
      const readOnlyBadge = isReadOnlyDimension(constraint) ? `<span class="badge">${applicationText("読み取り専用", "Read-only")}</span>` : "";
      return `<div class="item constraint-item constraint-list-row ${duplicate ? "duplicate" : ""} ${referenceError ? "reference-error" : ""}" data-idx="${index}" title="${escapeHtml(referenceError || "")}"><span>${displayIndex + 1}. ${escapeHtml(parameterPrefix + localizedConstraintName(constraint.name))}${readOnlyBadge}${referenceError ? `<span class="badge constraint-reference-error-badge">参照エラー</span>` : ""}${duplicate ? `<span class="badge constraint-duplicate-badge">重複</span>` : ""}</span>` +
        `<button data-idx="${index}" class="removeConstraintBtn" title="削除" aria-label="削除" data-tooltip="削除">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
        `</button></div>`;
    });
    const fixedPointRows = fixedPoints.map((point, fixedIndex) => {
      const displayIndex = listedConstraints.length + fixedIndex + 1;
      return `<div class="item constraint-item fixed-point-list-row" data-point-id="${point.id}"><span>${displayIndex}. 固定 ${point.id}</span>` +
        `<button data-id="${point.id}" class="removeFixedPointBtn icon-delete-btn" title="固定解除" aria-label="固定解除" data-tooltip="固定解除">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>` +
        `</button></div>`;
    });
    document.getElementById("constraintList").innerHTML =
      `<div class="constraint-summary-row"><span>${constraintSummaryText()}</span></div>` + [...constraintRows, ...fixedPointRows].join("");

    for (const btn of document.querySelectorAll(".removeConstraintBtn")) {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.idx);
        deleteElements({ constraints: [model.constraints[i]] });
      });
    }

    for (const btn of document.querySelectorAll(".removePointBtn")) {
      btn.addEventListener("click", () => {
        const point = model.points.find((p) => p.id === btn.dataset.id);
        if (point) deleteElements({ points: [point] });
      });
    }

    for (const btn of document.querySelectorAll(".removeLineBtn")) {
      btn.addEventListener("click", () => {
        const line = model.lines.find((l) => l.id === btn.dataset.id);
        if (line) deleteElements({ lines: [line] });
      });
    }

    for (const btn of document.querySelectorAll(".removeFixedPointBtn")) {
      btn.addEventListener("click", () => {
        const point = model.points.find((item) => item.id === btn.dataset.id);
        if (!point) return;
        point.fixed = false;
        solveAndRefresh(`固定解除 ${point.id}`);
      });
    }

    for (const btn of document.querySelectorAll(".removeCircleBtn")) {
      btn.addEventListener("click", () => {
        const circle = model.circles.find((item) => item.id === btn.dataset.id);
        if (circle) deleteElements({ circles: [circle] });
      });
    }

    for (const btn of document.querySelectorAll(".removeArcBtn")) {
      btn.addEventListener("click", () => {
        const arc = model.arcs.find((item) => item.id === btn.dataset.id);
        if (arc) deleteElements({ arcs: [arc] });
      });
    }

    bindSidebarItemHover();

    updateObjectExplorerUI();
    updatePropertiesUI();
    updateStatusUI();
    updateConstraintButtons();
    localizeApplicationUI();
  }

  function supportLineBasis(line) {
    if (line.orientationHint === "horizontal") {
      return { anchor: { x: line.p1.x, y: (line.p1.y + line.p2.y) / 2 }, nx: 0, ny: 1 };
    }
    if (line.orientationHint === "vertical") {
      return { anchor: { x: (line.p1.x + line.p2.x) / 2, y: line.p1.y }, nx: 1, ny: 0 };
    }
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_ORIENTATION_LENGTH) return null;
    return { anchor: line.p1, nx: -dy / len, ny: dx / len };
  }

  function preconditionArcEndpointOnLineConstraint(constraint) {
    solver.syncLineOrientationHints?.();
    const basis = supportLineBasis(constraint.line);
    if (!basis) return;
    const arc = constraint.arc;
    const prop = constraint.endpoint === "start" ? "startAngle" : "endAngle";
    const current = arc[prop];
    let radius = arc.radius();
    const offset = basis.nx * (arc.center.x - basis.anchor.x) + basis.ny * (arc.center.y - basis.anchor.y);
    let k = -offset / radius;
    if (Math.abs(k) > 1 && !hasDirectRadiusDimension(arc)) {
      arc.radiusValue = Math.max(Math.abs(offset) + MIN_LINE_LENGTH, MIN_LINE_LENGTH);
      radius = arc.radius();
      k = -offset / radius;
    }
    if (Math.abs(k) > 1) return;

    const normalAngle = Math.atan2(basis.ny, basis.nx);
    const delta = Math.acos(Math.max(-1, Math.min(1, k)));
    const candidates = [normalAngle + delta, normalAngle - delta].map((angle) => unwrapAngleNear(angle, current));
    arc[prop] = candidates.reduce((best, angle) => (Math.abs(angle - current) < Math.abs(best - current) ? angle : best), candidates[0]);
  }

  function preconditionArcEndpointToPoint(arc, endpoint, point) {
    if (!arc || !point) return;
    const dx = point.x - arc.center.x;
    const dy = point.y - arc.center.y;
    const distance = hypot2(dx, dy);
    if (distance < MIN_LINE_LENGTH) return;
    if (!hasDirectRadiusDimension(arc)) arc.radiusValue = Math.max(distance, MIN_LINE_LENGTH);
    const prop = endpoint === "start" ? "startAngle" : "endAngle";
    arc[prop] = unwrapAngleNear(Math.atan2(dy, dx), arc[prop]);
  }

  function preconditionArcEndpointCoincidentConstraint(constraint) {
    preconditionArcEndpointToPoint(constraint.arc, constraint.endpoint, constraint.point);
  }

  function preconditionArcEndpointArcEndpointCoincidentConstraint(constraint) {
    const aPoint = arcEndpointPoint(constraint.a, constraint.endpointA);
    const bPoint = arcEndpointPoint(constraint.b, constraint.endpointB);
    if (hasDirectRadiusDimension(constraint.a) && !hasDirectRadiusDimension(constraint.b)) {
      preconditionArcEndpointToPoint(constraint.b, constraint.endpointB, aPoint);
    } else {
      preconditionArcEndpointToPoint(constraint.a, constraint.endpointA, bPoint);
    }
  }

  function preconditionOffsetConstraint(constraint) {
    if (!(constraint instanceof OffsetConstraint)) return;
    const { source, offset, target, sign } = constraint;
    if (source instanceof Line && offset instanceof Line) {
      const normal = lineNormal(source);
      const dx = normal.x * sign * target;
      const dy = normal.y * sign * target;
      offset.p1.x = source.p1.x + dx;
      offset.p1.y = source.p1.y + dy;
      offset.p2.x = source.p2.x + dx;
      offset.p2.y = source.p2.y + dy;
      return;
    }
    offset.center.x = source.center.x;
    offset.center.y = source.center.y;
    offset.radiusValue = Math.max(MIN_ORIENTATION_LENGTH, source.radius() + sign * target);
    if (source instanceof Arc && offset instanceof Arc) {
      offset.startAngle = source.startAngle;
      offset.endAngle = source.endAngle;
    }
  }

  function preconditionNewConstraint(constraint) {
    if (constraint instanceof ArcEndpointOnLineConstraint) {
      preconditionArcEndpointOnLineConstraint(constraint);
    } else if (constraint instanceof ArcEndpointCoincidentConstraint) {
      preconditionArcEndpointCoincidentConstraint(constraint);
    } else if (constraint instanceof ArcEndpointArcEndpointCoincidentConstraint) {
      preconditionArcEndpointArcEndpointCoincidentConstraint(constraint);
    } else if (constraint instanceof OffsetConstraint) {
      preconditionOffsetConstraint(constraint);
    }
  }

  function solveStepNormForConstraint(constraint) {
    if (!constraint) return solver.maxStepNorm;
    const e = constraint.error();
    const values = Array.isArray(e) ? e : [e];
    const errorNorm = vectorNorm(values);
    return Math.max(solver.maxStepNorm, errorNorm * 1.5);
  }

  function withTemporarySolveStepNorm(stepNorm, callback) {
    const previous = solver.maxStepNorm;
    solver.maxStepNorm = Math.max(previous, Number.isFinite(stepNorm) ? stepNorm : previous);
    try {
      return callback();
    } finally {
      solver.maxStepNorm = previous;
    }
  }

  function addReadOnlyDimensionConstraint(constraint, sketchId = constraintSketchId(constraint), messagePrefix = "重複寸法") {
    if (!isDimensionConstraint(constraint)) return false;
    const target = targetFromConstraint(constraint);
    if (!target) return false;
    constraint.target = measuredConstraintTargetValue(constraint, target, constraint.dimension);
    constraint.readOnlyDimension = true;
    constraint.enabled = false;
    pushModelConstraint(constraint, sketchId);
    clearSelection();
    refreshConstraintAnalysis();
    updateUI({ refreshAnalysis: false });
    draw();
    setHint(`${messagePrefix}を読み取り専用寸法として追加しました`);
    log(`${messagePrefix}を読み取り専用寸法として追加しました`);
    recordHistory(`${messagePrefix}を読み取り専用寸法として追加`);
    return true;
  }

  function commitNewConstraint(type, constraint) {
    if (!constraintTargetsAreActive(constraint)) {
      const msg = "別スケッチ同士は通常拘束できません";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const performanceTrace = { kind: "constraint", type, startedAt: performance.now() };
    const snapshot = snapshotModelState();
    performanceTrace.snapshotMs = performance.now() - performanceTrace.startedAt;
    const solveStepNorm = solveStepNormForConstraint(constraint);
    pushModelConstraint(constraint);
    preconditionNewConstraint(constraint);

    const solveStartedAt = performance.now();
    let solved = withTemporarySolveStepNorm(solveStepNorm, () => solveConstraintComponentAndDependents(constraint, snapshot));
    if (solved.success && isDimensionConstraint(constraint) && !isReadOnlyDimension(constraint)) {
      const stabilized = stabilizeActiveParameterNamespace(constraintSketchId(constraint));
      if (!stabilized.success || stabilized.dependent?.success === false) solved = stabilized;
    }
    performanceTrace.solveMs = performance.now() - solveStartedAt;
    const result = solved.result;
    performanceTrace.solveVariableCount = result.variableCount;
    performanceTrace.solveConstraintCount = result.constraintCount;
    performanceTrace.solveErrorNorm = result.errorNorm;
    performanceTrace.solveIterations = result.iterations;
    performanceTrace.fullFallback = Boolean(result.fullFallback);
    const collapse = findLineCollapseAfterConstraint(constraint, snapshot, constraintSketchId(constraint));
    const redundancyStartedAt = performance.now();
    const duplicate = solved.success && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR && !collapse ? redundantConstraintInfo(constraint, constraintSketchId(constraint)) : null;
    performanceTrace.redundancyMs = performance.now() - redundancyStartedAt;
    if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse || duplicate?.redundant) {
      if (duplicate?.redundant && isDimensionConstraint(constraint)) {
        restoreModelState(snapshot);
        return addReadOnlyDimensionConstraint(constraint, constraintSketchId(constraint));
      }
      restoreModelState(snapshot);
      const msg = `拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      const collapseMsg = collapse
        ? `拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
        : msg;
      const duplicateMsg = duplicate?.redundant
        ? `拘束を追加できません: 重複しています (rank ${duplicate.rankBefore} -> ${duplicate.rankAfter})`
        : collapseMsg;
      setHint(duplicateMsg, "error");
      updateUI();
      draw();
      log(duplicateMsg);
      return;
    }

    clearSelection();
    const redundancyBySketch = duplicate?.redundancy ? new Map([[constraintSketchId(constraint), duplicate.redundancy]]) : null;
    const analysisStartedAt = performance.now();
    refreshConstraintAnalysis({ redundancyBySketch });
    performanceTrace.analysisMs = performance.now() - analysisStartedAt;
    const uiStartedAt = performance.now();
    updateUI({ refreshAnalysis: false });
    draw();
    performanceTrace.uiMs = performance.now() - uiStartedAt;
    setHint(`拘束追加: success=${solved.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations} / ${constraintSummaryText()}`);
    log(`拘束を追加しました: ${type}\n自動solve: success=${solved.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory(`拘束追加: ${type}`);
    performanceTrace.totalMs = performance.now() - performanceTrace.startedAt;
    lastAuthoringPerformance = performanceTrace;
    return true;
  }

  function markReferenceConstraint(constraint, referenceSketchId, sketchId = activeSketchId()) {
    constraint.reference = true;
    constraint.referenceSketchId = referenceSketchId;
    constraint.sketchId = sketchId;
    constraint.name = `参照 ${constraint.name}`;
    return constraint;
  }

  function commitReferenceConstraint(type, constraint, referenceSketchId, sketchId = activeSketchId()) {
    if (!constraint || !isReferenceSourceSketchId(referenceSketchId, sketchId)) {
      const msg = descendantSketchIds(sketchId).includes(referenceSketchId) ? "子孫スケッチは参照できません" : "先祖スケッチのみ参照できます";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    if (wouldCreateReferenceCycle(sketchId, referenceSketchId)) {
      const msg = "スケッチ間の参照が循環するため追加できません";
      setHint(msg, "error");
      log(msg);
      return false;
    }
    const snapshot = snapshotModelState();
    markReferenceConstraint(constraint, referenceSketchId, sketchId);
    const solveStepNorm = solveStepNormForConstraint(constraint);
    pushModelConstraint(constraint, sketchId);
    preconditionNewConstraint(constraint);
    const solved = withTemporarySolveStepNorm(solveStepNorm, () => solveConstraintComponentAndDependents(constraint, snapshot));
    const result = solved.result;
    const collapse = findLineCollapseAfterConstraint(constraint, snapshot, sketchId);
    const duplicate = solved.success && result.errorNorm <= CONSTRAINT_ACCEPT_ERROR && !collapse ? redundantConstraintInfo(constraint, sketchId) : null;
    if (!solved.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR || collapse || duplicate?.redundant) {
      if (duplicate?.redundant && isDimensionConstraint(constraint)) {
        restoreModelState(snapshot);
        return addReadOnlyDimensionConstraint(constraint, sketchId, "重複参照寸法");
      }
      restoreModelState(snapshot);
      const msg = `参照拘束を追加できません: 矛盾しています (error=${result.errorNorm.toExponential(3)}, reason=${result.reason})`;
      const collapseMsg = collapse
        ? `参照拘束を追加できません: 線${collapse.line.id}が退化するため矛盾しています (${collapse.before.toExponential(3)} -> ${collapse.after.toExponential(3)})`
        : msg;
      const duplicateMsg = duplicate?.redundant
        ? `参照拘束を追加できません: 重複しています (rank ${duplicate.rankBefore} -> ${duplicate.rankAfter})`
        : collapseMsg;
      setHint(duplicateMsg, "error");
      updateUI();
      draw();
      log(duplicateMsg);
      return false;
    }
    clearSelection();
    const redundancyBySketch = duplicate?.redundancy ? new Map([[sketchId, duplicate.redundancy]]) : null;
    refreshConstraintAnalysis({ redundancyBySketch });
    updateUI({ refreshAnalysis: false });
    draw();
    setHint(`参照拘束追加: ${sketchName(referenceSketchId)} を参照 / success=${result.success}, error=${result.errorNorm.toExponential(2)}`);
    log(`参照拘束を追加しました: ${type}\n自動solve: success=${result.success}, error=${result.errorNorm.toExponential(3)}`);
    recordHistory(`参照拘束追加: ${type}`);
    return true;
  }

  function referenceConstraintForSubject(subject, referenceTarget) {
    if (!subject || !referenceTarget) return null;
    if (subject.kind === "point") {
      if (referenceTarget.kind === "point") return new CoincidentConstraint(subject.point, referenceTarget.point);
      if (referenceTarget.kind === "line") return new PointOnLineConstraint(subject.point, referenceTarget.line);
      if (referenceTarget.kind === "primitive") return new PointOnCircleConstraint(subject.point, referenceTarget.primitive);
    }
    if (subject.kind === "line") {
      if (referenceTarget.kind === "point") return new PointOnLineConstraint(referenceTarget.point, subject.line);
      if (referenceTarget.kind === "line") return new CollinearConstraint(subject.line, referenceTarget.line);
    }
    if (subject.kind === "primitive") {
      if (referenceTarget.kind === "point") return new PointOnCircleConstraint(referenceTarget.point, subject.primitive);
      if (referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.primitive, referenceTarget.primitive);
    }
    if (subject.kind === "arc-endpoint") {
      if (referenceTarget.kind === "point") return new ArcEndpointCoincidentConstraint(subject.arc, subject.endpoint, referenceTarget.point);
      if (referenceTarget.kind === "line") return new ArcEndpointOnLineConstraint(subject.arc, subject.endpoint, referenceTarget.line);
      if (referenceTarget.kind === "primitive") return new ArcEndpointOnCircleConstraint(subject.arc, subject.endpoint, referenceTarget.primitive);
    }
    return null;
  }

  function referenceConstraintForType(type, subject, referenceTarget) {
    if (type === "coincident") return referenceConstraintForSubject(subject, referenceTarget);
    if (!subject || !referenceTarget) return null;
    if (type === "horizontal") {
      if (subject.kind === "point" && referenceTarget.kind === "point") return new PointHorizontalConstraint(subject.point, referenceTarget.point);
      return null;
    }
    if (type === "vertical") {
      if (subject.kind === "point" && referenceTarget.kind === "point") return new PointVerticalConstraint(subject.point, referenceTarget.point);
      return null;
    }
    if (type === "parallel") {
      if (subject.kind === "line" && referenceTarget.kind === "line") return new ParallelConstraint(subject.line, referenceTarget.line);
      return null;
    }
    if (type === "perpendicular") {
      if (subject.kind === "line" && referenceTarget.kind === "line") return new PerpendicularConstraint(subject.line, referenceTarget.line);
      return null;
    }
    if (type === "collinear") {
      if (subject.kind === "line" && referenceTarget.kind === "line") return new CollinearConstraint(subject.line, referenceTarget.line);
      return null;
    }
    if (type === "equal") {
      if (subject.kind === "line" && referenceTarget.kind === "line") return new EqualLengthConstraint(subject.line, referenceTarget.line);
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new EqualRadiusConstraint(subject.primitive, referenceTarget.primitive);
      return null;
    }
    if (type === "equalRadius") {
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new EqualRadiusConstraint(subject.primitive, referenceTarget.primitive);
      return null;
    }
    if (type === "concentric") {
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.primitive, referenceTarget.primitive);
      if (subject.kind === "primitive" && referenceTarget.kind === "point") return new ConcentricConstraint(subject.primitive, referenceTarget.point);
      if (subject.kind === "point" && referenceTarget.kind === "primitive") return new ConcentricConstraint(subject.point, referenceTarget.primitive);
      return null;
    }
    if (type === "pointOnCircle") {
      if (subject.kind === "point" && referenceTarget.kind === "primitive") return new PointOnCircleConstraint(subject.point, referenceTarget.primitive);
      if (subject.kind === "primitive" && referenceTarget.kind === "point") return new PointOnCircleConstraint(referenceTarget.point, subject.primitive);
      if (subject.kind === "arc-endpoint" && referenceTarget.kind === "primitive") return new ArcEndpointOnCircleConstraint(subject.arc, subject.endpoint, referenceTarget.primitive);
      return null;
    }
    if (type === "tangent") {
      if (subject.kind === "line" && referenceTarget.kind === "primitive") return new LineCircleTangentConstraint(subject.line, referenceTarget.primitive);
      if (subject.kind === "primitive" && referenceTarget.kind === "line") return new LineCircleTangentConstraint(referenceTarget.line, subject.primitive);
      if (subject.kind === "primitive" && referenceTarget.kind === "primitive") return new CircleCircleTangentConstraint(subject.primitive, referenceTarget.primitive);
      return null;
    }
    return null;
  }

  function referenceDistanceTargetForSubject(subject, referenceTarget) {
    if (!subject || !referenceTarget) return null;
    if (subject.kind === "point" && referenceTarget.kind === "point") {
      return { kind: "point-point", p1: subject.point, p2: referenceTarget.point, value: hypot2(referenceTarget.point.x - subject.point.x, referenceTarget.point.y - subject.point.y) };
    }
    if (subject.kind === "point" && referenceTarget.kind === "line") {
      return { kind: "point-line", point: subject.point, line: referenceTarget.line, value: Math.abs(signedPointLineDistance(subject.point, referenceTarget.line)) };
    }
    if (subject.kind === "line" && referenceTarget.kind === "point") {
      return { kind: "point-line", point: referenceTarget.point, line: subject.line, value: Math.abs(signedPointLineDistance(referenceTarget.point, subject.line)) };
    }
    if (subject.kind === "line" && referenceTarget.kind === "line") {
      if (!lineHasDirection(subject.line) || !lineHasDirection(referenceTarget.line)) return { kind: "invalid", reason: "寸法対象の線が短すぎます" };
      if (!linesAreParallel(subject.line, referenceTarget.line)) {
        return { kind: "angle", line1: subject.line, line2: referenceTarget.line, value: angleDegrees(axisAngleBetweenLines(subject.line, referenceTarget.line)), signedValue: angleDimensionSweep({ line1: subject.line, line2: referenceTarget.line }) };
      }
      return { kind: "line-line", line1: subject.line, line2: referenceTarget.line, value: Math.abs(signedPointLineDistance(referenceTarget.line.p1, subject.line)) };
    }
    return null;
  }

  function geometryTargetValue(target) {
    if (!target) return NaN;
    if (target.kind === "point-point") {
      if (target.dimensionAxis === "x") return Math.abs(target.p2.x - target.p1.x);
      if (target.dimensionAxis === "y") return Math.abs(target.p2.y - target.p1.y);
      return hypot2(target.p2.x - target.p1.x, target.p2.y - target.p1.y);
    }
    if (target.kind === "point-line") return Math.abs(signedPointLineDistance(target.point, target.line));
    if (target.kind === "line-line") return Math.abs(signedPointLineDistance(target.line1.p1, target.line2));
    if (target.kind === "line-length") return target.line.length();
    if (target.kind === "angle") return angleDegrees(Math.abs(angleDimensionSweep(target)));
    if (target.kind === "radius") return target.primitive.radius();
    if (target.kind === "diameter") return target.primitive.radius() * 2;
    if (target.kind === "offset-distance") {
      if (target.source instanceof Line) return Math.abs(signedPointLineDistance(target.offset.p1, target.source));
      return Math.abs(target.offset.radius() - target.source.radius());
    }
    return target.value;
  }

  function splitConstraintOperands(operands) {
    return {
      active: operands.filter((operand) => operand.relation === "active"),
      reference: operands.filter((operand) => operand.relation === "reference"),
      descendant: operands.filter((operand) => operand.relation === "descendant"),
    };
  }

  function referenceResolutionFromOperands(type, operands) {
    const { active, reference } = splitConstraintOperands(operands);
    if (active.length !== 1 || reference.length !== 1) return { error: "参照拘束はアクティブスケッチ側1つと先祖スケッチ側1つを選択してください" };
    return constraintResolutionFromSubjectAndReference(type, subjectFromOperand(active[0]), referenceTargetFromOperand(reference[0]));
  }

  function normalConstraintFromOperands(type, operands) {
    if (type === "symmetry") return symmetryConstraintFromOperands(operands);
    const previous = {
      points: selectedPoints,
      lines: selectedLines,
      circles: selectedCircles,
      arcs: selectedArcs,
      arcEndpoint: selectedArcEndpoint,
      arcEndpointPair: selectedArcEndpointPair,
    };
    constraintOperands = operands.slice();
    syncSelectionFromConstraintOperands();
    const constraint = constraintFromSelection(type);
    selectedPoints = previous.points;
    selectedLines = previous.lines;
    selectedCircles = previous.circles;
    selectedArcs = previous.arcs;
    selectedArcEndpoint = previous.arcEndpoint;
    selectedArcEndpointPair = previous.arcEndpointPair;
    return constraint;
  }

  function symmetryConstraintFromOperands(operands) {
    if (operands.length !== 3) return null;
    const [axisOperand, first, second] = operands;
    if (axisOperand.kind !== "line" || !axisOperand.line || first.kind !== second.kind) return null;
    if (first.kind === "point") return new SymmetryConstraint(first.point, second.point, axisOperand.line);
    if (first.kind === "line") return new LineSymmetryConstraint(first.line, second.line, axisOperand.line);
    return null;
  }

  function symmetryReferenceResolutionFromOperands(operands) {
    if (operands.length < 3) return null;
    const { active, reference } = splitConstraintOperands(operands);
    const constraint = symmetryConstraintFromOperands(operands);
    if (!constraint || active.length === 0 || reference.length === 0) return { error: "参照対称拘束では、対称軸、同種の対象2つの順に選択してください" };
    const referenceSketchIds = [...new Set(reference.map((operand) => operand.sketchId))];
    if (referenceSketchIds.length !== 1) return { error: "参照対称拘束の参照対象は同じ先祖スケッチから選択してください" };
    const sketchId = active[0].sketchId;
    const referenceSketchId = referenceSketchIds[0];
    if (!active.every((operand) => operand.sketchId === sketchId) || !isReferenceSourceSketchId(referenceSketchId, sketchId)) {
      return { error: "参照対称拘束ではアクティブスケッチと1つの先祖スケッチだけを選択してください" };
    }
    if (wouldCreateReferenceCycle(sketchId, referenceSketchId)) return { error: "スケッチ間の参照が循環するため追加できません" };
    return {
      type: "symmetry",
      action: "commit",
      constraint,
      operands,
      referenceSketchId,
      sketchId,
    };
  }

  function resolveConstraintIntent(type, operands) {
    const cleanOperands = operands.filter(Boolean);
    const { active, reference, descendant } = splitConstraintOperands(cleanOperands);
    if (descendant.length > 0) return { error: "子孫スケッチは参照できません" };
    if (reference.length > 0) {
      if (type === "symmetry") return symmetryReferenceResolutionFromOperands(cleanOperands);
      if (cleanOperands.length < 2 || active.length === 0) return null;
      if (cleanOperands.length !== 2) return { error: "参照拘束はアクティブスケッチ側と先祖スケッチ側を1つずつ選択してください" };
      const resolution = referenceResolutionFromOperands(type, cleanOperands);
      if (type === "distance" && resolution?.target) return { ...resolution, action: "place-dimension", operands: cleanOperands };
      return resolution?.constraint ? { ...resolution, action: "commit", operands: cleanOperands } : resolution;
    }
    if (active.length !== cleanOperands.length) return { error: "拘束対象はアクティブスケッチ、または先祖スケッチだけを選択できます" };
    const sketchIds = [...new Set(cleanOperands.map((operand) => operand.sketchId))];
    if (sketchIds.length > 1) return { error: "別スケッチ同士は通常拘束できません" };
    if (type === "distance") {
      const target = distanceTargetFromOperands(cleanOperands);
      if (!target || target.kind === "invalid") return target?.kind === "invalid" ? { error: target.reason } : null;
      return { type, action: "place-dimension", target, operands: cleanOperands, sketchId: sketchIds[0] || activeSketchId() };
    }
    const constraint = normalConstraintFromOperands(type, cleanOperands);
    return constraint ? { type, action: "commit", constraint, operands: cleanOperands, sketchId: sketchIds[0] || activeSketchId() } : null;
  }

  function referenceSketchIdFromPair(subject, referenceTarget) {
    const subjectSketchId = referenceSubjectSketchId(subject);
    if (!subjectSketchId || !referenceTarget?.sketchId) return null;
    return isReferenceSourceSketchId(referenceTarget.sketchId, subjectSketchId) ? referenceTarget.sketchId : null;
  }

  function constraintResolutionFromSubjectAndReference(type, subject, referenceTarget) {
    const subjectElement = referenceSubjectElement(subject);
    const subjectSketchId = referenceSubjectSketchId(subject);
    const referenceSketchId = referenceSketchIdFromPair(subject, referenceTarget);
    if (!subject || !subjectElement || !isEditableSketchElement(subjectElement)) {
      return { error: "アクティブスケッチ側の対象を選択してください" };
    }
    if (!referenceTarget || !referenceSketchId) {
      return { error: referenceTarget?.sketchId && descendantSketchIds(subjectSketchId).includes(referenceTarget.sketchId) ? "子孫スケッチは参照できません" : "先祖スケッチのみ参照できます" };
    }
    if (wouldCreateReferenceCycle(subjectSketchId, referenceSketchId)) {
      return { error: "スケッチ間の参照が循環するため追加できません" };
    }
    if (type === "distance") {
      const target = referenceDistanceTargetForSubject(subject, referenceTarget);
      if (!target || target.kind === "invalid") return { error: target?.reason || "参照寸法の組み合わせに対応していません" };
      return { type, target, referenceSketchId, sketchId: subjectSketchId };
    }
    const constraint = referenceConstraintForType(type, subject, referenceTarget);
    if (!constraint) return { error: "この参照拘束の組み合わせには対応していません" };
    return { type, constraint, referenceSketchId, sketchId: subjectSketchId };
  }

  function constraintResolutionFromCurrentSelection(type) {
    if (constraintOperands.length > 0) return resolveConstraintIntent(type, constraintOperands);
    if (type === "distance") {
      const target = distanceTargetFromSelection();
      if (!target) return null;
      if (target.kind === "invalid") return { error: target.reason };
      return { type, target, sketchId: activeSketchId() };
    }
    const constraint = constraintFromSelection(type);
    if (!constraint) return null;
    return { type, constraint, sketchId: activeSketchId() };
  }

  function startDistanceResolution(resolution, pointer) {
    if (!resolution || resolution.error || !resolution.target) {
      if (resolution?.error) setHint(resolution.error, "error");
      return false;
    }
    mode = "select";
    const initialDimension = pointer ? null : defaultDimensionForTarget(resolution.target);
    const initialPointer = pointer || dimensionAnchor(resolution.target, initialDimension);
    if (resolution.operands) {
      constraintOperands = resolution.operands.slice();
      syncSelectionFromConstraintOperands();
    }
    pendingConstraintCommand = { type: "distance" };
    pendingCommand = {
      type: "distance-place",
      target: resolution.target,
      resolution,
      pointer: initialPointer,
      dimension: initialDimension,
      operands: resolution.operands || constraintOperands.slice(),
      referenceSketchId: resolution.referenceSketchId,
      sketchId: resolution.sketchId,
    };
    updateConstraintButtons();
    updateToolbar();
    setHint(
      resolution.referenceSketchId
        ? "参照寸法線の位置をクリックしてください"
        : resolution.target.kind === "line-length"
          ? "仮寸法の位置をマウスで調整し、空白をクリックして線長寸法を確定してください。2本目の線を選ぶと線間・角度寸法になります。"
          : "寸法線の位置をクリックしてください",
    );
    draw();
    return true;
  }

  function commitConstraintResolution(resolution, pointer = null) {
    if (!resolution || resolution.error) {
      if (resolution?.error) setHint(resolution.error, "error");
      return false;
    }
    if (resolution.type === "distance") return startDistanceResolution(resolution, resolution.referenceSketchId ? null : pointer);
    if (!resolution.constraint) return false;
    const ok = resolution.referenceSketchId
      ? commitReferenceConstraint(resolution.type || "reference", resolution.constraint, resolution.referenceSketchId, resolution.sketchId || activeSketchId())
      : commitNewConstraint(resolution.type || "constraint", resolution.constraint);
    if (ok) recordHistory(`拘束追加: ${resolution.type || "constraint"}`);
    return ok;
  }

  function distanceConstraintFromTarget(target, value, dimension, options = {}) {
    if (!target || target.kind === "invalid") return null;
    let constraint = null;
    if (target.kind === "point-point" || target.kind === "line-length") {
      const axis = target.dimensionAxis || dimension?.axis;
      constraint = target.kind === "point-point" && (axis === "x" || axis === "y")
        ? new PointAxisDistanceConstraint(target.p1, target.p2, value, axis)
        : new DistanceConstraint(target.p1, target.p2, value);
    } else if (target.kind === "point-line") {
      constraint = new PointLineDistanceConstraint(target.point, target.line, value);
    } else if (target.kind === "line-line") {
      if (!linesAreParallel(target.line1, target.line2)) {
        if (!options.silent) {
          setHint("線-線寸法は平行線のみです", "error");
          log("線-線寸法は平行線のみです");
        }
        return null;
      }
      constraint = new LineLineDistanceConstraint(target.line1, target.line2, value);
    } else if (target.kind === "angle") {
      constraint = new LineAngleConstraint(target.line1, target.line2, (value * Math.PI) / 180, dimension?.angleStartFlip || 0, dimension?.angleEndFlip || 0);
    } else if (target.kind === "radius") {
      constraint = new RadiusConstraint(target.primitive, value);
    } else if (target.kind === "diameter") {
      constraint = new DiameterConstraint(target.primitive, value);
    }
    if (constraint) constraint.dimension = dimension;
    return constraint;
  }

  function readOnlyDimensionConstraintForPlacement(target, value, dimension, options = {}) {
    const constraint = distanceConstraintFromTarget(target, value, dimension, { silent: true });
    if (!constraint) return null;
    const targetItems = target.kind === "point-point"
      ? [target.p1, target.p2]
      : target.kind === "point-line"
        ? [target.point, target.line]
        : target.kind === "line-line" || target.kind === "angle"
          ? [target.line1, target.line2]
          : target.kind === "line-length"
            ? [target.line]
            : target.primitive
              ? [target.primitive]
              : [];
    const blockInstances = [...new Set(targetItems.map((item) => item?.blockInstance).filter(Boolean))];
    if (targetItems.length > 0 && blockInstances.length === 1 && targetItems.every((item) => item?.blockInstance === blockInstances[0])) return constraint;
    const sketchId = options.sketchId || activeSketchId();
    assignConstraintSketchId(constraint, sketchId);
    if (options.referenceSketchId) markReferenceConstraint(constraint, options.referenceSketchId, sketchId);
    model.constraints.push(constraint);
    const duplicate = redundantConstraintInfo(constraint, sketchId);
    model.constraints = model.constraints.filter((item) => item !== constraint);
    return duplicate?.redundant ? constraint : null;
  }

  function addDistanceConstraintFromTarget(target, value, dimension, options = {}) {
    const constraint = distanceConstraintFromTarget(target, value, dimension);
    if (!constraint) return false;
    if (!options.referenceSketchId) constraint.expression = String(options.expression || value);
    return commitConstraintResolution({
      type: options.referenceSketchId ? "referenceDimension" : "dimension",
      constraint,
      referenceSketchId: options.referenceSketchId,
      sketchId: options.sketchId || activeSketchId(),
    });
  }

  function constraintFromSelection(type) {
    let constraint = null;
    const allPrimitives = selectedPrimitives();
    const primitives = type === "coincident" && selectedArcEndpoint ? allPrimitives.filter((p) => p !== selectedArcEndpoint.arc) : allPrimitives;
    if (type === "coincident") {
      const endpointPair = selectedArcEndpointPair;
      if (endpointPair?.length === 2) {
        constraint = new ArcEndpointArcEndpointCoincidentConstraint(endpointPair[0].arc, endpointPair[0].endpoint, endpointPair[1].arc, endpointPair[1].endpoint);
      } else if (selectedArcEndpoint && selectedPoints.length === 1) {
        constraint = new ArcEndpointCoincidentConstraint(selectedArcEndpoint.arc, selectedArcEndpoint.endpoint, selectedPoints[0]);
      } else if (selectedArcEndpoint && selectedLines.length === 1) {
        constraint = new ArcEndpointOnLineConstraint(selectedArcEndpoint.arc, selectedArcEndpoint.endpoint, selectedLines[0]);
      } else if (selectedArcEndpoint && primitives.length === 1) {
        constraint = new ArcEndpointOnCircleConstraint(selectedArcEndpoint.arc, selectedArcEndpoint.endpoint, primitives[0]);
      } else if (selectedPoints.length === 1 && selectedLines.length === 1) {
        constraint = new PointOnLineConstraint(selectedPoints[0], selectedLines[0]);
      } else if (selectedPoints.length === 1 && primitives.length === 1) {
        constraint = new PointOnCircleConstraint(selectedPoints[0], primitives[0]);
      } else if (selectedPoints.length === 0 && selectedLines.length === 2) {
        constraint = new CollinearConstraint(selectedLines[0], selectedLines[1]);
      } else {
        constraint = new CoincidentConstraint(selectedPoints[0], selectedPoints[1]);
      }
    } else if (type === "horizontal") {
      constraint = selectedPoints.length === 2 ? new PointHorizontalConstraint(selectedPoints[0], selectedPoints[1]) : new HorizontalConstraint(selectedLines[0]);
    } else if (type === "vertical") {
      constraint = selectedPoints.length === 2 ? new PointVerticalConstraint(selectedPoints[0], selectedPoints[1]) : new VerticalConstraint(selectedLines[0]);
    } else if (type === "parallel") {
      constraint = new ParallelConstraint(selectedLines[0], selectedLines[1]);
    } else if (type === "perpendicular") {
      constraint = new PerpendicularConstraint(selectedLines[0], selectedLines[1]);
    } else if (type === "symmetry") {
      if (selectedPoints.length === 2 && selectedLines.length === 1) constraint = new SymmetryConstraint(selectedPoints[0], selectedPoints[1], selectedLines[0]);
      else if (selectedPoints.length === 0 && selectedLines.length === 3) constraint = new LineSymmetryConstraint(selectedLines[1], selectedLines[2], selectedLines[0]);
    } else if (type === "collinear") {
      constraint = new CollinearConstraint(selectedLines[0], selectedLines[1]);
    } else if (type === "equal") {
      if (selectedLines.length === 2) constraint = new EqualLengthConstraint(selectedLines[0], selectedLines[1]);
      else constraint = new EqualRadiusConstraint(primitives[0], primitives[1]);
    } else if (type === "concentric") {
      constraint = new ConcentricConstraint(selectedPoints[0] || primitives[0], primitives[selectedPoints.length === 1 ? 0 : 1]);
    } else if (type === "equalRadius") {
      constraint = new EqualRadiusConstraint(primitives[0], primitives[1]);
    } else if (type === "pointOnCircle") {
      constraint = new PointOnCircleConstraint(selectedPoints[0], primitives[0]);
    } else if (type === "tangent") {
      solver.syncLineOrientationHints?.();
      if (selectedLines.length === 1) constraint = new LineCircleTangentConstraint(selectedLines[0], primitives[0]);
      else constraint = new CircleCircleTangentConstraint(primitives[0], primitives[1]);
    }
    return constraint;
  }

  function addConstraint(type) {
    const resolution = constraintResolutionFromCurrentSelection(type);
    if (!resolution || resolution.error) {
      if (resolution?.error) setHint(resolution.error, "error");
      return;
    }
    if (resolution.action === "place-dimension" || resolution.target) return startDistanceResolution(resolution, null);
    if (resolution?.constraint) {
      selectedArcEndpointPair = null;
      commitConstraintResolution(resolution);
    }
  }

  function dragSketchIdFromSelection(points = []) {
    const ids = [...new Set(points.filter(Boolean).map(elementSketchId).filter(isEditableSketchId))];
    if (ids.length === 1) return ids[0];
    if (ids.includes(activeSketchId())) return activeSketchId();
    return ids[0] || activeSketchId();
  }

  function dragSketchIdFor(kind, item) {
    if (kind === "arc-endpoint") return elementSketchId(item?.arc);
    if (kind === "selection") return dragSketchIdFromSelection(item);
    return elementSketchId(item);
  }

  function buildDragSession(kind, item, pointer) {
    const sketchId = dragSketchIdFor(kind, item);
    if (kind === "block" || kind === "block-rotation") {
      if (item.fixed || (kind === "block-rotation" && item.rotationLocked)) return null;
      const definition = blockDefinitionById(item.definitionId);
      const localCenter = blockLocalGeometryBounds(definition, [...blockInstanceEnabledSketchSet(item, definition)])?.center || definition?.origin || { x: 0, y: 0 };
      return {
        kind,
        sketchId: item.sketchId,
        mode: kind,
        item,
        startPointer: pointer,
        startX: item.x,
        startY: item.y,
        startRotation: item.rotation,
        localCenter,
        rotationPivot: blockWorldPoint(item, localCenter),
      };
    }
    if (kind === "selection") {
      const points = item
        .filter((p, index, arr) => p && elementSketchId(p) === sketchId && !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
        .map((p) => ({ point: p, startX: p.x, startY: p.y }));
      if (points.length === 0) return null;
      return { kind, sketchId, startPointer: pointer, points };
    }

    if (kind === "point") {
      if (item.fixed || pointLockedByLineFixed(item)) return null;
      return {
        kind,
        sketchId,
        startPointer: pointer,
        points: [{ point: item, startX: item.x, startY: item.y }],
      };
    }

    if (kind === "line" && findLineFixedConstraint(item)) return null;

    if (kind === "circle" || kind === "arc") {
      return {
        kind,
        sketchId,
        mode: "radius",
        item,
        startPointer: pointer,
        startRadius: item.radius(),
        startCenterX: item.center.x,
        startCenterY: item.center.y,
      };
    }

    if (kind === "arc-endpoint") {
      if (findArcEndpointFixedConstraint(item.arc, item.endpoint)) return null;
      return {
        kind,
        sketchId,
        mode: "arc-endpoint",
        item: item.arc,
        endpoint: item.endpoint,
        startPointer: pointer,
      };
    }

    const sourcePoints = [item.p1, item.p2];
    const points = sourcePoints
      .filter((p, index, arr) => !p.fixed && !pointLockedByLineFixed(p) && arr.indexOf(p) === index)
      .map((p) => ({ point: p, startX: p.x, startY: p.y }));
    if (points.length === 0) return null;
    return { kind, sketchId, item, startPointer: pointer, points };
  }

  function dragSessionSeeds(session) {
    const seeds = [];
    if (!session) return seeds;
    if (session.item) {
      seeds.push(session.item);
      if (session.item.center) seeds.push(session.item.center);
    }
    for (const p of session.points || []) seeds.push(p.point);
    return seeds;
  }

  function attachLocalSolveContext(session) {
    if (!session) return session;
    session.local = localSolveContextFromSeeds(dragSessionSeeds(session), session.sketchId);
    if ((session.kind === "block" || session.kind === "block-rotation") && session.item && !session.item.fixed) {
      const existing = new Set(session.local.variables.filter((variable) => variable.object === session.item).map((variable) => variable.prop));
      if (!existing.has("x")) session.local.variables.push({ object: session.item, prop: "x", label: `${session.item.id}.x` });
      if (!existing.has("y")) session.local.variables.push({ object: session.item, prop: "y", label: `${session.item.id}.y` });
      if (!session.item.rotationLocked && !existing.has("rotation")) session.local.variables.push({ object: session.item, prop: "rotation", label: `${session.item.id}.rotation` });
    }
    session.local.pointStarts = model.points
      .filter((p) => session.local.component.has(p) && !p.fixed && !pointLockedByLineFixed(p))
      .map((point) => ({ point, startX: point.x, startY: point.y }));
    session.local.fixedPointCount = model.points.filter((p) => session.local.component.has(p) && (p.fixed || pointLockedByLineFixed(p))).length;
    // In an anchored component with one remaining DOF, translating both
    // endpoints asks that DOF to satisfy redundant drag targets. Use the most
    // active endpoint so line dragging follows its responsive point-drag path.
    if (session.kind === "line" && session.points.length > 1 && session.local.fixedPointCount > 0) {
      const analysis = solver.analyzeConstraintState({
        variables: session.local.variables,
        constraints: session.local.constraints,
        lines: session.local.lines,
      });
      if (analysis.stable && analysis.freeVariableCount === 1) {
        const fixedPoints = model.points.filter((point) =>
          session.local.component.has(point) && (point.fixed || pointLockedByLineFixed(point)));
        const pointActivity = (entry) => {
          const index = analysis.variableIndex.get(entry.point) || {};
          return Math.sqrt((analysis.nullspaceBasis || []).reduce((sum, basis) =>
            sum + (basis[index.x] || 0) ** 2 + (basis[index.y] || 0) ** 2, 0));
        };
        const nearestFixedDistance = (entry) => Math.min(...fixedPoints.map((fixed) =>
          hypot2(entry.point.x - fixed.x, entry.point.y - fixed.y)));
        const best = session.points.reduce((current, candidate) => {
          if (!current) return candidate;
          const activityDifference = pointActivity(candidate) - pointActivity(current);
          if (Math.abs(activityDifference) > 1e-8) return activityDifference > 0 ? candidate : current;
          return nearestFixedDistance(candidate) > nearestFixedDistance(current) ? candidate : current;
        }, null);
        if (best && pointActivity(best) > 1e-8) session.lineDragPoint = best;
      }
    }
    session.fullDragState = solver.clone(solver.getVariables());
    session.parameterDragSnapshot = snapshotModelState();
    return session;
  }

  function selectedDragPoints() {
    const points = [...selectedPoints];
    for (const line of selectedLines) points.push(line.p1, line.p2);
    for (const circle of selectedCircles) points.push(circle.center);
    for (const arc of selectedArcs) points.push(arc.center);
    return points;
  }

  function selectedElementCount() {
    return selectedPoints.length + selectedLines.length + selectedCircles.length + selectedArcs.length + selectedBlockInstances.length + (selectedArcEndpoint ? 1 : 0);
  }

  function hitIsSelected(hitP, hitL, hitC, hitA, hitArcEnd) {
    if (hitP && selectedPoints.includes(hitP)) return true;
    if (hitL && selectedLines.includes(hitL)) return true;
    if (hitC && selectedCircles.includes(hitC)) return true;
    if (hitA && selectedArcs.includes(hitA)) return true;
    if (hitArcEnd && sameArcEndpoint(selectedArcEndpoint, { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint })) return true;
    return false;
  }

  function selectHitOnly(hitP, hitL, hitC, hitA, hitArcEnd) {
    selectedDimensionConstraint = null;
    selectedConstraint = null;
    selectedPoints = hitP ? [hitP] : [];
    selectedLines = hitL ? [hitL] : [];
    selectedCircles = hitC ? [hitC] : [];
    selectedArcs = hitA ? [hitA] : hitArcEnd ? [hitArcEnd.arc] : [];
    selectedArcEndpoint = hitArcEnd ? { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint } : null;
    selectedArcEndpointPair = null;
    draw();
  }

  function dragTargets(session, pointer) {
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    const points = session.lineDragPoint ? [session.lineDragPoint] : session.points;
    return points.map((p) => ({ point: p.point, x: p.startX + dx, y: p.startY + dy }));
  }

  function radiusDragTargets(session, pointer) {
    return [
      {
        object: session.item,
        prop: "radiusValue",
        // Keep the radius request tied to the geometry at pointer-down. The
        // constrained solve may move the center; measuring from that moving
        // center feeds the solver's own correction back into the next event
        // and can amplify a one-pixel cursor step into a large radius jump.
        value: hypot2(pointer.x - session.startCenterX, pointer.y - session.startCenterY),
        min: MIN_ORIENTATION_LENGTH,
      },
    ];
  }

  function primitiveMoveTargets(session, pointer) {
    if (session.item.center.fixed) return [];
    const dx = pointer.x - session.startPointer.x;
    const dy = pointer.y - session.startPointer.y;
    return [{ point: session.item.center, x: session.startCenterX + dx, y: session.startCenterY + dy }];
  }

  function hasDirectRadiusDimension(primitive) {
    return model.constraints.some(
      (c) => c.enabled !== false && (c instanceof RadiusConstraint || c instanceof DiameterConstraint) && c.primitive === primitive,
    );
  }

  function guidedTargetHasNoActivity(result) {
    return Boolean(
      result?.guided
      && Array.isArray(result.targetConstraints)
      && result.targetConstraints.length === 0
      && Array.isArray(result.targetActivity)
      && result.targetActivity.every((activity) => activity <= 1e-8)
    );
  }

  function arcEndpointDragTargets(session, pointer) {
    const prop = session.endpoint === "start" ? "startAngle" : "endAngle";
    const rawAngle = Math.atan2(pointer.y - session.item.center.y, pointer.x - session.item.center.x);
    const value = arcEndpointDragValue(session.item, session.endpoint, rawAngle);
    return [
      {
        object: session.item,
        prop,
        value,
      },
    ];
  }

  function dragConstraintsFromTargets(targets) {
    return targets.map((target) => new DragConstraint(target.point, target.x, target.y));
  }

  function parameterDragConstraintsFromTargets(targets) {
    return targets.map((target) => new ParameterDragConstraint(target.object, target.prop, target.value, target.min));
  }

  function solveLocalDrag(session, extra) {
    if (!session?.local) return null;
    return solver.solveSubset({
      variables: session.local.variables,
      constraints: session.local.constraints,
      lines: session.local.lines,
      extra,
    });
  }

  function guidedTargetEntries(targets = []) {
    const entries = [];
    for (const target of targets) {
      if (target.point) {
        entries.push({ object: target.point, prop: "x", value: target.x });
        entries.push({ object: target.point, prop: "y", value: target.y });
      } else if (target.object && target.prop) {
        entries.push({ object: target.object, prop: target.prop, value: target.value });
      }
    }
    return entries;
  }

  function sameGuidedTargetEntries(a = [], b = []) {
    return a.length === b.length && a.every((entry, index) =>
      entry.object === b[index].object && entry.prop === b[index].prop && entry.value === b[index].value,
    );
  }

  function guidedTargetStepForSession(session, targets) {
    const entries = guidedTargetEntries(targets);
    if (sameGuidedTargetEntries(entries, session?.pendingGuidedTargetEntries)) {
      return { entries, norm: session.pendingGuidedTargetStepNorm };
    }
    const previous = session?.lastGuidedTargetEntries || [];
    const deltas = entries.map((entry) => {
      const prior = previous.find((candidate) => candidate.object === entry.object && candidate.prop === entry.prop);
      const previousValue = prior ? prior.value : entry.object[entry.prop];
      const rawDelta = entry.value - previousValue;
      if (
        (entry.prop === "startAngle" || entry.prop === "endAngle")
        && Number.isFinite(entry.object?.radiusValue)
      ) {
        return rawDelta * Math.max(MIN_ORIENTATION_LENGTH, Math.abs(entry.object.radiusValue));
      }
      return rawDelta;
    });
    const norm = vectorNorm(deltas);
    if (session) {
      session.pendingGuidedTargetEntries = entries;
      session.pendingGuidedTargetStepNorm = norm;
    }
    return { entries, norm };
  }

  function commitGuidedTargetStep(session, targetStep) {
    if (!session || !targetStep) return;
    session.lastGuidedTargetEntries = targetStep.entries;
  }

  function solveLocalGuidedDrag(session, targets, targetStepNorm = null) {
    if (!session?.local) return null;
    const errorTolerance = Math.max(
      CONSTRAINT_ACCEPT_ERROR,
      Math.min(DRAG_PREVIEW_MAX_MODEL_ERROR, DRAG_PREVIEW_ERROR_SCREEN_PX / Math.max(viewport.scale, 1e-9)),
    );
    return withDragStepNorm(dragStepNormForTargets(targets), () =>
      solver.solveSubsetGuided({
        variables: session.local.variables,
        constraints: session.local.constraints,
        lines: session.local.lines,
        targets,
        errorTolerance,
        activeTargetVariables: session.guidedTargetVariables || [],
        targetStepNorm,
      }),
    );
  }

  function dragStepNormForTargets(targets = []) {
    let maxDelta = solver.maxStepNorm;
    for (const target of targets) {
      if (target.point) {
        maxDelta = Math.max(maxDelta, hypot2(target.x - target.point.x, target.y - target.point.y));
      } else if (target.object && target.prop) {
        maxDelta = Math.max(maxDelta, Math.abs(target.value - target.object[target.prop]));
      }
    }
    return Math.max(solver.maxStepNorm, maxDelta * 1.25);
  }

  function dragStepNormForExtra(extra = []) {
    let maxDelta = solver.maxStepNorm;
    for (const constraint of extra) {
      if (constraint instanceof DragConstraint) {
        maxDelta = Math.max(maxDelta, hypot2(constraint.targetX - constraint.point.x, constraint.targetY - constraint.point.y));
      } else if (constraint instanceof ArcEndpointDragConstraint) {
        const p = arcEndpointPoint(constraint.arc, constraint.endpoint);
        maxDelta = Math.max(maxDelta, hypot2(constraint.targetX - p.x, constraint.targetY - p.y));
      } else if (constraint instanceof ParameterDragConstraint) {
        maxDelta = Math.max(maxDelta, Math.abs(constraint.target - constraint.object[constraint.prop]));
      }
    }
    return Math.max(solver.maxStepNorm, maxDelta * 1.25);
  }

  function withDragStepNorm(stepNorm, callback) {
    const previous = solver.maxStepNorm;
    solver.maxStepNorm = Math.max(previous, Number.isFinite(stepNorm) ? stepNorm : previous);
    try {
      return callback();
    } finally {
      solver.maxStepNorm = previous;
    }
  }

  function withSolverMaxIterations(maxIterations, callback) {
    const previous = solver.maxIterations;
    solver.maxIterations = Math.max(previous, maxIterations);
    try {
      return callback();
    } finally {
      solver.maxIterations = previous;
    }
  }

  function solveDragWithFallback(session, extra, fullSolve, restoreState = null) {
    const stepNorm = dragStepNormForExtra(extra);
    const localResult = withDragStepNorm(stepNorm, () => solveLocalDrag(session, extra));
    if (localResult && localResult.success && localResult.errorNorm <= CONSTRAINT_ACCEPT_ERROR) return localResult;
    if (restoreState) solver.restore(restoreState);
    const result = withDragStepNorm(stepNorm, fullSolve);
    result.local = false;
    result.fallback = Boolean(localResult);
    result.localErrorNorm = localResult?.errorNorm;
    return result;
  }

  function solveGuidedDragWithFallback(session, targets, fallbackExtra, fullSolve, restoreState = null) {
    const targetStep = guidedTargetStepForSession(session, targets);
    const stepNorm = Math.max(dragStepNormForTargets(targets), dragStepNormForExtra(fallbackExtra));
    if (session?.local && session.local.constraints.length === 0) {
      for (const target of targets) {
        if (target.point) {
          target.point.x = target.x;
          target.point.y = target.y;
        } else if (target.object && target.prop) {
          target.object[target.prop] = target.min != null ? Math.max(target.min, target.value) : target.value;
        }
      }
      commitGuidedTargetStep(session, targetStep);
      session.lastGuidedPreviewError = 0;
      return {
        success: true,
        errorNorm: 0,
        iterations: 0,
        reason: "直接移動",
        local: true,
        guided: true,
        variableCount: session.local.variables.length,
        constraintCount: 0,
      };
    }
    const guidedAttemptState = restoreState || solver.clone(session.local?.variables || solver.getVariables());
    let localResult = null;
    let localAcceptError = CONSTRAINT_ACCEPT_ERROR;
    let guidedRetryCount = 0;
    // A sparse pointer stream can deliver a very large reversal in one event.
    // Lines translate linearly and should follow that event exactly. For more
    // nonlinear point/arc drags, start with a shorter manifold step to avoid an
    // expensive, often singular full-step solve.
    const canShortenSparseStep = session?.mode !== "block" && session?.mode !== "block-rotation";
    const shouldTryExactSparseStep = session?.kind === "line";
    const guidedScales = canShortenSparseStep && targetStep.norm > 50
      ? (shouldTryExactSparseStep ? [1, 0.25, 0.125, 0.0625] : [0.25, 0.125, 0.0625])
      : [1, 0.5, 0.25, 0.125, 0.0625];
    for (const scale of guidedScales) {
      if (scale < 1) solver.restore(guidedAttemptState);
      localResult = withDragStepNorm(stepNorm, () => solveLocalGuidedDrag(session, targets, targetStep.norm * scale));
      localAcceptError = Number.isFinite(localResult?.acceptError) ? localResult.acceptError : CONSTRAINT_ACCEPT_ERROR;
      const locallyAcceptable = localResult
        && Number.isFinite(localResult.errorNorm)
        && localResult.errorNorm <= localAcceptError;
      if (locallyAcceptable) {
        // The nonlinear correction can exhaust its strict iteration budget
        // after already reaching the looser, screen-space preview tolerance.
        // Keep that visually valid local result; a full-document fallback is
        // both slower and less likely to converge during a sparse drag event.
        if (!localResult.success) {
          localResult.success = true;
          localResult.approximate = true;
          localResult.reason = "プレビュー許容誤差内";
        }
        break;
      }
      guidedRetryCount += 1;
    }
    if (localResult && localResult.success && localResult.errorNorm <= localAcceptError) {
      localResult.guidedRetryCount = guidedRetryCount;
      session.finalDragConstraints = localResult.targetConstraints || [];
      session.guidedTargetVariables = localResult.activeTargetVariables || [];
      commitGuidedTargetStep(session, targetStep);
      session.lastGuidedPreviewError = localResult.errorNorm;
      return localResult;
    }
    if (restoreState) solver.restore(restoreState);
    const result = withDragStepNorm(stepNorm, fullSolve);
    if (result.success) {
      session.finalDragConstraints = fallbackExtra;
      commitGuidedTargetStep(session, targetStep);
      session.lastGuidedPreviewError = result.errorNorm;
    }
    result.local = false;
    result.guided = false;
    result.fallback = Boolean(localResult);
    result.localErrorNorm = localResult?.errorNorm;
    result.guidedRetryCount = guidedRetryCount;
    return result;
  }

  function finalizeDragResult(result, state, session = null, extra = [], retry = null) {
    const lineRepair = enforceMinimumLineLengths(session?.local?.lines || model.lines);
    if (lineRepair.changed > 0) {
      result = retry ? retry() : session?.local ? solveDragWithFallback(session, extra, () => solveDragSketch(session, extra), state) : solveDragSketch(session, extra);
    }
    normalizeArcSweeps();
    result.lineRepair = lineRepair;
    if (lineRepair.failed) {
      solver.restore(state);
      result.blocked = true;
      result.success = false;
      result.reason = "R寸法と固定点によりこれ以上潰せません";
      result.lineRepair = lineRepair;
    } else if (!result.success) {
      solver.restore(state);
      result.blocked = true;
    }
    return result;
  }

  function dragResultForSession(session, pointer) {
    let result;
    const dragVars = session?.local?.variables || solver.getVariables();
    const dragState = solver.clone(dragVars);
    if (session.mode === "block" || session.mode === "block-rotation") {
      const targets = session.mode === "block"
        ? [
            { object: session.item, prop: "x", value: session.startX + pointer.x - session.startPointer.x },
            { object: session.item, prop: "y", value: session.startY + pointer.y - session.startPointer.y },
          ]
        : (() => {
            const rotation = Math.atan2(pointer.y - session.rotationPivot.y, pointer.x - session.rotationPivot.x);
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return [
              { object: session.item, prop: "x", value: session.rotationPivot.x - session.localCenter.x * cos + session.localCenter.y * sin },
              { object: session.item, prop: "y", value: session.rotationPivot.y - session.localCenter.x * sin - session.localCenter.y * cos },
              { object: session.item, prop: "rotation", value: rotation },
            ];
          })();
      const extra = parameterDragConstraintsFromTargets(targets);
      const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      invalidateBlockProjectionCache(session.item.id);
      return finalizeDragResult(result, dragState, session, extra, retry);
    }
    if (session.mode === "radius") {
      const moveTargets = primitiveMoveTargets(session, pointer);
      if (hasDirectRadiusDimension(session.item)) {
        session.activeMode = "move";
        const extra = dragConstraintsFromTargets(moveTargets);
        const targets = moveTargets;
        const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      }

      const state = solver.clone(dragVars);
      let targets = radiusDragTargets(session, pointer);
      let extra = parameterDragConstraintsFromTargets(targets);
      let retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      if ((!result.success || guidedTargetHasNoActivity(result)) && moveTargets.length > 0) {
        solver.restore(state);
        session.activeMode = "move";
        targets = moveTargets;
        extra = dragConstraintsFromTargets(moveTargets);
        retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
        result = retry();
        return finalizeDragResult(result, dragState, session, extra, retry);
      }
      session.activeMode = "radius";
      return finalizeDragResult(result, dragState, session, extra, retry);
    }
    let targets;
    let extra;
    if (session.mode === "arc-endpoint") {
      targets = arcEndpointDragTargets(session, pointer);
      extra = parameterDragConstraintsFromTargets(targets);
      const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
      result = retry();
      return finalizeDragResult(result, dragState, session, extra, retry);
    } else {
      const directTargets = dragTargets(session, pointer);
      targets = directTargets;
      extra = dragConstraintsFromTargets(directTargets);
    }
    const retry = () => solveGuidedDragWithFallback(session, targets, extra, () => solveDragSketch(session, extra), dragState);
    result = retry();
    return finalizeDragResult(result, dragState, session, extra, retry);
  }

  function dragLabel(session) {
    if (session.mode === "block") return applicationText("ブロック移動", "Block move");
    if (session.mode === "block-rotation") return applicationText("ブロック回転", "Block rotation");
    if (session.kind === "selection") return applicationText("選択移動", "Selection move");
    if (session.mode === "radius" && session.activeMode === "move") return applicationText("ドラッグ", "Drag");
    if (session.mode === "radius") return applicationText("半径変更", "Radius change");
    if (session.mode === "arc-endpoint") return applicationText("円弧端点変更", "Arc endpoint change");
    return applicationText("ドラッグ", "Drag");
  }

  function beginDrag(e, hitP, hitL, hitC, hitA, hitArcEnd, pointer) {
    selectedConstraint = null;
    if (selectedElementCount() > 1 && hitIsSelected(hitP, hitL, hitC, hitA, hitArcEnd)) {
      dragSession = buildDragSession("selection", selectedDragPoints(), pointer);
      selectedDimensionConstraint = null;
    } else if (hitP) {
      selectedPoints = [hitP];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      dragSession = buildDragSession("point", hitP, pointer);
    } else if (hitArcEnd) {
      selectedArcs = [hitArcEnd.arc];
      selectedArcEndpoint = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      dragSession = buildDragSession("arc-endpoint", hitArcEnd, pointer);
    } else if (hitL) {
      selectedLines = [hitL];
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      dragSession = buildDragSession("line", hitL, pointer);
    } else if (hitC) {
      selectedCircles = [hitC];
      selectedPoints = [];
      selectedLines = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      dragSession = buildDragSession("circle", hitC, pointer);
    } else if (hitA) {
      selectedArcs = [hitA];
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcEndpoint = null;
      dragSession = buildDragSession("arc", hitA, pointer);
    }

    if (dragSession) {
      attachLocalSolveContext(dragSession);
      canvas.classList.add("is-dragging");
      canvas.setPointerCapture(e.pointerId);
      setHint(`${dragLabel(dragSession)}中: 拘束を保ちながら自動solveしています`);
    }
  }

  function beginDimensionDrag(e, hit, pointer, commandHits = null) {
    const anchor = dimensionAnchor(hit.target, hit.dimension);
    migrateAngleDimensionLabelPlacement(hit.target, hit.dimension);
    selectedDimensionConstraint = hit.constraint;
    selectedConstraint = null;
    dimensionDragSession = {
      pointerId: e.pointerId,
      constraint: hit.constraint,
      target: hit.target,
      part: hit.part || "line",
      startPointer: pointer,
      startAnchor: anchor,
      startLabelOffsetU: Number(hit.dimension?.labelOffsetU) || 0,
      startDisplay: hit.dimension?.display ? { ...hit.dimension.display } : null,
      startAngleLabelOffsets:
        hit.target.kind === "angle"
          ? angleDimensionLabelOffsets(hit.target, hit.dimension) || { radial: 14 / viewport.scale, tangent: 0 }
          : null,
      startedDuringDimensionCommand: isDimensionConstraintCommandActive(),
      commandHits,
      moved: false,
    };
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
    setHint("寸法線を移動中");
  }

  function preserveDimensionDragDisplay(session, dimension) {
    if (session?.startDisplay) dimension.display = { ...session.startDisplay };
    return dimension;
  }

  function isDimensionConstraintCommandActive() {
    return pendingConstraintCommand?.type === "distance" && pendingCommand?.type !== "distance-value";
  }

  function syncAngleConstraintFromDimension(constraint, target, dimension) {
    if (!(constraint instanceof LineAngleConstraint) || target.kind !== "angle" || !dimension) return;
    if (isReadOnlyDimension(constraint)) return;
    const angles = angleDimensionAngles(target, null, dimension);
    constraint.startFlip = dimension.angleStartFlip ? 1 : 0;
    constraint.endFlip = dimension.angleEndFlip ? 1 : 0;
    constraint.target = Math.abs(angles.signed);
  }

  function orthogonalPointFrom(start, p) {
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    return Math.abs(dx) >= Math.abs(dy) ? { x: p.x, y: start.y } : { x: start.x, y: p.y };
  }

  function addLineOrientationConstraint(line) {
    if (!line) return;
    const dx = Math.abs(line.p2.x - line.p1.x);
    const dy = Math.abs(line.p2.y - line.p1.y);
    pushModelConstraint(dx >= dy ? new HorizontalConstraint(line) : new VerticalConstraint(line));
  }

  function handleLineClick(p, lockOrthogonal = false) {
    if (lineStartPoint && lockOrthogonal) p = orthogonalPointFrom(lineStartPoint, p);
    p = snapForDrawing(p);
    let snap = activeSnap;
    if (lineStartPoint) p = pointAtMinimumDistance(lineStartPoint, p);
    if (snap && !samePosition(p, snap)) snap = null;
    if (lineStartPoint) beginTransientLineCompletionRollback();
    else beginTransientLineStartRollback();
    const endpoint = lineStartPoint && hypot2(p.x - lineStartPoint.x, p.y - lineStartPoint.y) <= MIN_LINE_LENGTH + 1e-9 ? addPoint(p.x, p.y, false, "endpoint") : endpointAt(p.x, p.y);
    pointerPreview = p;

    if (!lineStartPoint) {
      addPointSnapConstraints(endpoint, snap);
      lineStartPoint = endpoint;
      selectedPoints = [endpoint];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("次の端点をクリックすると線を作成します。終了はEscです。");
      updateUI();
      draw();
      return;
    }

    const l = addLine(lineStartPoint, endpoint);
    if (l) {
      if (lineCompletionRollback) {
        lineCompletionRollback.completedEndpoint = endpoint;
        lineCompletionRollback.completedLine = l;
        lineCompletionRollback.createdAt = performance.now();
      }
      clearTransientLineStartRollback();
      addPointSnapConstraints(endpoint, snap);
      if (lockOrthogonal) addLineOrientationConstraint(l);
      selectedPoints = [];
      selectedLines = [l];
      selectedCircles = [];
      selectedArcs = [];
      lineStartPoint = endpoint;
      clearSelection();
      const result = solveAndRefresh("線追加");
      log(`線 ${l.id} を追加しました\n自動solve: success=${result.success}`);
    } else {
      selectedPoints = [endpoint];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("同じ端点です。別の位置をクリックしてください。終了はEscです。");
      updateUI();
      draw();
    }
  }

  function handleRectangleClick(p) {
    p = snapForDrawing(p);
    let snap = activeSnap;
    pointerPreview = p;
    if (!rectangleStartPoint) {
      rectangleStartPoint = endpointAt(p.x, p.y);
      addPointSnapConstraints(rectangleStartPoint, snap);
      selectedPoints = [rectangleStartPoint];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("対角の角をクリックすると矩形を作成します。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }

    const rx = p.x - rectangleStartPoint.x;
    const ry = p.y - rectangleStartPoint.y;
    if (Math.abs(rx) < MIN_LINE_LENGTH) p = { ...p, x: rectangleStartPoint.x + (rx < 0 ? -MIN_LINE_LENGTH : MIN_LINE_LENGTH) };
    if (Math.abs(ry) < MIN_LINE_LENGTH) p = { ...p, y: rectangleStartPoint.y + (ry < 0 ? -MIN_LINE_LENGTH : MIN_LINE_LENGTH) };
    if (snap && !samePosition(p, snap)) snap = null;
    const p1 = rectangleStartPoint;
    const p2 = addPoint(p.x, p1.y, false, "endpoint");
    const p3 = addPoint(p.x, p.y, false, "endpoint");
    const p4 = addPoint(p1.x, p.y, false, "endpoint");
    addPointSnapConstraints(p3, snap);
    const lines = [addLine(p1, p2), addLine(p2, p3), addLine(p3, p4), addLine(p4, p1)].filter(Boolean);
    if (lines[0]) pushModelConstraint(new HorizontalConstraint(lines[0]));
    if (lines[1]) pushModelConstraint(new VerticalConstraint(lines[1]));
    if (lines[2]) pushModelConstraint(new HorizontalConstraint(lines[2]));
    if (lines[3]) pushModelConstraint(new VerticalConstraint(lines[3]));
    selectedPoints = [];
    selectedLines = lines;
    selectedCircles = [];
    selectedArcs = [];
    rectangleStartPoint = null;
    pointerPreview = null;
    clearSnap();
    clearSelection();
    const result = solveAndRefresh("矩形追加");
    log(`矩形を追加しました\n自動solve: success=${result.success}`);
  }

  function pointOnLineAt(line, t) {
    return { x: line.p1.x + (line.p2.x - line.p1.x) * t, y: line.p1.y + (line.p2.y - line.p1.y) * t };
  }

  function lineParam(line, p) {
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return 0;
    return ((p.x - line.p1.x) * dx + (p.y - line.p1.y) * dy) / len2;
  }

  function addUniqueBoundary(list, boundary, tolerance = 1e-6) {
    if (!Number.isFinite(boundary.t)) return;
    if (boundary.t < -tolerance || boundary.t > 1 + tolerance) return;
    boundary.t = Math.max(0, Math.min(1, boundary.t));
    if (list.some((item) => Math.abs(item.t - boundary.t) <= tolerance)) return;
    list.push(boundary);
  }

  function lineLineBoundary(target, other) {
    const point = lineIntersection(target, other);
    if (!point) return null;
    const t = lineParam(target, point);
    const u = lineParam(other, point);
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
    return { t, point, source: { line: other } };
  }

  function lineCircleBoundaries(line, primitive, requireArc = false) {
    const dx = line.p2.x - line.p1.x;
    const dy = line.p2.y - line.p1.y;
    const fx = line.p1.x - primitive.center.x;
    const fy = line.p1.y - primitive.center.y;
    const qa = dx * dx + dy * dy;
    if (qa < 1e-12) return [];
    const qb = 2 * (fx * dx + fy * dy);
    const qc = fx * fx + fy * fy - primitive.radius() * primitive.radius();
    const disc = qb * qb - 4 * qa * qc;
    if (disc < -1e-9) return [];
    const roots = Math.abs(disc) < 1e-9 ? [-qb / (2 * qa)] : [(-qb - Math.sqrt(disc)) / (2 * qa), (-qb + Math.sqrt(disc)) / (2 * qa)];
    return roots.map((t) => {
      if (t < -1e-6 || t > 1 + 1e-6) return null;
      const point = pointOnLineAt(line, t);
      if (requireArc && !angleOnSignedSweep(Math.atan2(point.y - primitive.center.y, point.x - primitive.center.x), primitive.startAngle, primitive.endAngle)) return null;
      return { t, point, source: requireArc ? { arc: primitive } : { primitive } };
    }).filter(Boolean);
  }

  function circleCirclePoints(a, b) {
    const dx = b.center.x - a.center.x;
    const dy = b.center.y - a.center.y;
    const d = hypot2(dx, dy);
    const r0 = a.radius();
    const r1 = b.radius();
    if (d < 1e-12 || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9) return [];
    const x = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h2 = r0 * r0 - x * x;
    if (h2 < -1e-9) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const ux = dx / d;
    const uy = dy / d;
    const base = { x: a.center.x + ux * x, y: a.center.y + uy * x };
    if (h < 1e-9) return [base];
    return [{ x: base.x - uy * h, y: base.y + ux * h }, { x: base.x + uy * h, y: base.y - ux * h }];
  }

  function circleParam(circle, angle) {
    return normalizeAnglePositive(angle) / (Math.PI * 2);
  }

  function angleAtCircleParam(t) {
    return t * Math.PI * 2;
  }

  function lineTrimBoundaries(line) {
    const boundaries = [{ t: 0, point: line.p1 }, { t: 1, point: line.p2 }];
    for (const other of model.lines) {
      if (!isActiveSketchElement(other)) continue;
      if (other === line) continue;
      const b = lineLineBoundary(line, other);
      if (b) addUniqueBoundary(boundaries, b);
    }
    for (const circle of model.circles) if (isActiveSketchElement(circle)) for (const b of lineCircleBoundaries(line, circle)) addUniqueBoundary(boundaries, b);
    for (const arc of model.arcs) if (isActiveSketchElement(arc)) for (const b of lineCircleBoundaries(line, arc, true)) addUniqueBoundary(boundaries, b);
    return boundaries.sort((a, b) => a.t - b.t);
  }

  function arcTrimBoundaries(arc) {
    const boundaries = [{ t: 0, point: arcEndpointPoint(arc, "start") }, { t: 1, point: arcEndpointPoint(arc, "end") }];
    const addPointBoundary = (point, source) => {
      const t = arcParamOnSweep(arc, Math.atan2(point.y - arc.center.y, point.x - arc.center.x));
      if (t !== null) addUniqueBoundary(boundaries, { t, point, source });
    };
    for (const line of model.lines) if (isActiveSketchElement(line)) for (const b of lineCircleBoundaries(line, arc, true)) addPointBoundary(b.point, { line });
    for (const circle of model.circles) if (isActiveSketchElement(circle)) for (const point of circleCirclePoints(arc, circle)) addPointBoundary(point, { primitive: circle });
    for (const other of model.arcs) {
      if (!isActiveSketchElement(other)) continue;
      if (other === arc) continue;
      for (const point of circleCirclePoints(arc, other)) {
        if (angleOnSignedSweep(Math.atan2(point.y - other.center.y, point.x - other.center.x), other.startAngle, other.endAngle)) addPointBoundary(point, { arc: other });
      }
    }
    return boundaries.sort((a, b) => a.t - b.t);
  }

  function circleTrimBoundaries(circle) {
    const boundaries = [];
    const addPointBoundary = (point, source) => {
      const angle = Math.atan2(point.y - circle.center.y, point.x - circle.center.x);
      addUniqueBoundary(boundaries, { t: circleParam(circle, angle), angle, point, source });
    };
    for (const line of model.lines) if (isActiveSketchElement(line)) for (const b of lineCircleBoundaries(line, circle)) addPointBoundary(b.point, { line });
    for (const other of model.circles) {
      if (!isActiveSketchElement(other)) continue;
      if (other === circle) continue;
      for (const point of circleCirclePoints(circle, other)) addPointBoundary(point, { primitive: other });
    }
    for (const arc of model.arcs) {
      if (!isActiveSketchElement(arc)) continue;
      for (const point of circleCirclePoints(circle, arc)) {
        if (angleOnSignedSweep(Math.atan2(point.y - arc.center.y, point.x - arc.center.x), arc.startAngle, arc.endAngle)) addPointBoundary(point, { arc });
      }
    }
    return boundaries.sort((a, b) => a.t - b.t);
  }

  function trimInterval(boundaries, t) {
    for (let i = 0; i < boundaries.length - 1; i++) {
      if (t >= boundaries[i].t - 1e-6 && t <= boundaries[i + 1].t + 1e-6) return { left: boundaries[i], right: boundaries[i + 1] };
    }
    return null;
  }

  function hitSketchIdentityElement(x, y, options = {}) {
    const allowInactiveGeometry = Boolean(options.allowInactiveGeometry);
    const threshold = 7 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const accepts = (item) => isVisibleSketchElement(item) && (allowInactiveGeometry || isEditableSketchElement(item));
    const dimensionHit = hitDimension(x, y, { activeOnly: false });
    if (dimensionHit) {
      const sketchId = constraintSketchId(dimensionHit.constraint);
      return {
        id: dimensionHit.constraint.name || "寸法",
        label: dimensionHit.constraint.name || "寸法",
        sketchId,
        item: dimensionHit.constraint,
        kind: "dimension",
      };
    }
    for (let i = model.points.length - 1; i >= 0; i--) {
      const p = model.points[i];
      if (!accepts(p)) continue;
      if (hypot2(p.x - x, p.y - y) <= pointThreshold) return { id: p.id, sketchId: elementSketchId(p), item: p, kind: "point" };
    }
    for (let i = model.lines.length - 1; i >= 0; i--) {
      const line = model.lines[i];
      if (!accepts(line)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { id: line.id, sketchId: elementSketchId(line), item: line, kind: "line" };
    }
    for (let i = model.circles.length - 1; i >= 0; i--) {
      const circle = model.circles[i];
      if (!accepts(circle)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { id: circle.id, sketchId: elementSketchId(circle), item: circle, kind: "circle" };
    }
    for (let i = model.arcs.length - 1; i >= 0; i--) {
      const arc = model.arcs[i];
      if (!accepts(arc)) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { id: arc.id, sketchId: elementSketchId(arc), item: arc, kind: "arc" };
    }
    const block = hitBlockInstance(x, y, !allowInactiveGeometry);
    if (block) {
      const definition = blockDefinitionById(block.definitionId);
      return {
        id: block.id,
        label: `Block ${block.id}${definition?.name ? `: ${definition.name}` : ""}`,
        sketchId: block.sketchId,
        item: block,
        kind: "block",
      };
    }
    return null;
  }

  function beginBlockDrag(e, instance, pointer, rotate = false) {
    clearSelection();
    selectedBlockInstances = [instance];
    dragSession = buildDragSession(rotate ? "block-rotation" : "block", instance, pointer);
    if (!dragSession) {
      setHint(rotate && instance.rotationLocked ? "回転がロックされたブロックインスタンスです" : "固定されたブロックインスタンスです", "error");
      draw();
      return;
    }
    attachLocalSolveContext(dragSession);
    canvas.classList.add("is-dragging");
    canvas.setPointerCapture(e.pointerId);
    setHint(rotate ? "ブロックを回転中" : "ブロックを移動中");
    updateUI({ refreshAnalysis: false });
    draw();
  }

  function hitAnnotationTarget(x, y) {
    const threshold = 8 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const points = allGeometryPoints();
    const arcs = allGeometryArcs();
    const circles = allGeometryCircles();
    const lines = allGeometryLines();
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i];
      if (!isVisibleSketchElement(point)) continue;
      if (!point.blockProjection && !isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isPointUsedByLine(point) && !isReferencePoint(point)) continue;
      if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", item: point };
    }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      if (!isVisibleSketchElement(arc)) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "arc", item: arc };
    }
    for (let i = circles.length - 1; i >= 0; i--) {
      const circle = circles[i];
      if (!isVisibleSketchElement(circle)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "circle", item: circle };
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!isVisibleSketchElement(line)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", item: line };
    }
    return null;
  }

  function hitReferenceTarget(x, y) {
    const threshold = 7 / viewport.scale;
    const pointThreshold = 10 / viewport.scale;
    const allowedSketches = new Set(referenceSourceSketchIds());
    if (allowedSketches.size === 0) return null;
    const points = allGeometryPoints();
    const lines = allGeometryLines();
    const circles = allGeometryCircles();
    const arcs = allGeometryArcs();
    for (let i = points.length - 1; i >= 0; i--) {
      const point = points[i];
      const sketchId = elementSketchId(point);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(point)) continue;
      if (!point.blockProjection && !isExplicitPoint(point) && !isPointUsedByPrimitive(point) && !isReferencePoint(point)) continue;
      if (hypot2(point.x - x, point.y - y) <= pointThreshold) return { kind: "point", point, sketchId };
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const sketchId = elementSketchId(line);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(line)) continue;
      if (distancePointToSegment(x, y, line) <= threshold) return { kind: "line", line, sketchId };
    }
    for (let i = circles.length - 1; i >= 0; i--) {
      const circle = circles[i];
      const sketchId = elementSketchId(circle);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(circle)) continue;
      if (Math.abs(hypot2(x - circle.center.x, y - circle.center.y) - circle.radius()) <= threshold) return { kind: "primitive", primitive: circle, sketchId };
    }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      const sketchId = elementSketchId(arc);
      if (!allowedSketches.has(sketchId) || !isVisibleSketchElement(arc)) continue;
      const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
      if (Math.abs(hypot2(x - arc.center.x, y - arc.center.y) - arc.radius()) <= threshold && angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) return { kind: "primitive", primitive: arc, sketchId };
    }
    return null;
  }

  function cyclicTrimInterval(boundaries, t) {
    if (boundaries.length < 2) return null;
    for (let i = 0; i < boundaries.length; i++) {
      const left = boundaries[i];
      const right = boundaries[(i + 1) % boundaries.length];
      if (left.t <= right.t) {
        if (t >= left.t - 1e-6 && t <= right.t + 1e-6) return { left, right, wraps: false };
      } else if (t >= left.t - 1e-6 || t <= right.t + 1e-6) {
        return { left, right, wraps: true };
      }
    }
    return null;
  }

  function trimPreviewForLine(line, pointer) {
    const projected = closestPointOnSegment(pointer.x, pointer.y, line);
    const boundaries = lineTrimBoundaries(line);
    const interval = trimInterval(boundaries, lineParam(line, projected));
    if (boundaries.length <= 2) return { kind: "line", item: line, deleteWhole: true, interval: { left: boundaries[0], right: boundaries[1] } };
    if (!interval) return null;
    if (line.length() * Math.max(0, interval.right.t - interval.left.t) < MIN_LINE_LENGTH) return null;
    return { kind: "line", item: line, interval };
  }

  function trimPreviewForArc(arc, pointer) {
    const t = arcParamOnSweep(arc, Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x));
    if (t === null) return null;
    const boundaries = arcTrimBoundaries(arc);
    const interval = trimInterval(boundaries, t);
    if (boundaries.length <= 2) return { kind: "arc", item: arc, deleteWhole: true, interval: { left: boundaries[0], right: boundaries[1] } };
    if (!interval) return null;
    if (arc.radius() * Math.abs(arcSweep(arc)) * Math.max(0, interval.right.t - interval.left.t) < MIN_ARC_LENGTH) return null;
    return { kind: "arc", item: arc, interval };
  }

  function trimPreviewForCircle(circle, pointer) {
    const t = circleParam(circle, Math.atan2(pointer.y - circle.center.y, pointer.x - circle.center.x));
    const boundaries = circleTrimBoundaries(circle);
    if (boundaries.length === 0) return { kind: "circle", item: circle, deleteWhole: true };
    if (boundaries.length < 2) return null;
    const interval = cyclicTrimInterval(boundaries, t);
    if (!interval) return null;
    const left = { ...interval.left, angle: angleAtCircleParam(interval.left.t) };
    const right = { ...interval.right, angle: angleAtCircleParam(interval.right.t) + (interval.wraps ? Math.PI * 2 : 0) };
    const span = Math.max(0, right.angle - left.angle);
    if (span * circle.radius() < MIN_ARC_LENGTH) return null;
    return { kind: "circle", item: circle, interval: { left, right }, boundaries };
  }

  function computeTrimPreview(pointer) {
    const threshold = 7 / viewport.scale;
    const candidates = [];
    for (const line of model.lines) {
      if (!isActiveSketchElement(line)) continue;
      const p = closestPointOnSegment(pointer.x, pointer.y, line);
      const distance = hypot2(pointer.x - p.x, pointer.y - p.y);
      if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForLine(line, pointer) });
    }
    for (const arc of model.arcs) {
      if (!isActiveSketchElement(arc)) continue;
      const angle = Math.atan2(pointer.y - arc.center.y, pointer.x - arc.center.x);
      if (!angleOnSignedSweep(angle, arc.startAngle, arc.endAngle)) continue;
      const distance = Math.abs(hypot2(pointer.x - arc.center.x, pointer.y - arc.center.y) - arc.radius());
      if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForArc(arc, pointer) });
    }
    for (const circle of model.circles) {
      if (!isActiveSketchElement(circle)) continue;
      const distance = Math.abs(hypot2(pointer.x - circle.center.x, pointer.y - circle.center.y) - circle.radius());
      if (distance <= threshold) candidates.push({ distance, preview: () => trimPreviewForCircle(circle, pointer) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const candidate of candidates) {
      const preview = candidate.preview();
      if (preview) return preview;
    }
    return null;
  }

  function cleanupTrimConstraints(item, options = {}) {
    model.constraints = model.constraints.filter((c) => {
      if (item instanceof Line && constraintReferencesLine(c, item)) return options.preserveLineSupport && shouldPreserveTrimmedLineConstraint(c, item);
      if (item instanceof Arc && constraintReferencesPrimitive(c, item)) return false;
      if (item instanceof Circle && constraintReferencesPrimitive(c, item)) return false;
      return true;
    });
  }

  function shouldPreserveTrimmedLineConstraint(c, line) {
    if (c instanceof HorizontalConstraint || c instanceof VerticalConstraint) return true;
    if (c instanceof ParallelConstraint || c instanceof PerpendicularConstraint || c instanceof CollinearConstraint || c instanceof LineAngleConstraint) return true;
    if (c instanceof SymmetryConstraint && c.axis === line) return true;
    if (c instanceof LineSymmetryConstraint && c.axis === line) return true;
    if (c instanceof PointOnLineConstraint || c instanceof PointOnLineMidpointConstraint || c instanceof ArcEndpointOnLineConstraint) return true;
    if (c instanceof PointLineDistanceConstraint || c instanceof LineLineDistanceConstraint || c instanceof LineCircleTangentConstraint) return true;
    return false;
  }

  function cloneTrimmedLineConstraint(c, sourceLine, targetLine) {
    if (c instanceof HorizontalConstraint && c.line === sourceLine) return new HorizontalConstraint(targetLine);
    if (c instanceof VerticalConstraint && c.line === sourceLine) return new VerticalConstraint(targetLine);
    if (c instanceof ParallelConstraint) {
      if (c.line1 === sourceLine) return new ParallelConstraint(targetLine, c.line2);
      if (c.line2 === sourceLine) return new ParallelConstraint(c.line1, targetLine);
    }
    if (c instanceof PerpendicularConstraint) {
      if (c.line1 === sourceLine) return new PerpendicularConstraint(targetLine, c.line2);
      if (c.line2 === sourceLine) return new PerpendicularConstraint(c.line1, targetLine);
    }
    if (c instanceof CollinearConstraint) {
      if (c.line1 === sourceLine) return new CollinearConstraint(targetLine, c.line2);
      if (c.line2 === sourceLine) return new CollinearConstraint(c.line1, targetLine);
    }
    if (c instanceof LineAngleConstraint) {
      if (c.line1 === sourceLine) return new LineAngleConstraint(targetLine, c.line2, c.target, c.startFlip, c.endFlip);
      if (c.line2 === sourceLine) return new LineAngleConstraint(c.line1, targetLine, c.target, c.startFlip, c.endFlip);
    }
    return null;
  }

  function cloneTrimmedLineConstraints(sourceLine, targetLine) {
    const clones = model.constraints.map((c) => cloneTrimmedLineConstraint(c, sourceLine, targetLine)).filter(Boolean);
    for (const clone of clones) pushModelConstraint(clone, elementSketchId(sourceLine));
  }

  function trimmedLinePointConstraintAnchor(constraint, line) {
    if (constraint instanceof PointOnLineConstraint && constraint.line === line) return constraint.point;
    if (constraint instanceof ArcEndpointOnLineConstraint && constraint.line === line) return arcEndpointPoint(constraint.arc, constraint.endpoint);
    return null;
  }

  function captureRightTrimmedLinePointConstraints(line, rightBoundaryT) {
    return model.constraints.filter((constraint) => {
      const anchor = trimmedLinePointConstraintAnchor(constraint, line);
      return anchor && lineParam(line, anchor) >= rightBoundaryT - 1e-6;
    });
  }

  function retargetTrimmedLinePointConstraints(constraints, sourceLine, targetLine) {
    for (const constraint of constraints) {
      if (constraint.line !== sourceLine) continue;
      constraint.line = targetLine;
      if (constraint instanceof PointOnLineConstraint) constraint.name = new PointOnLineConstraint(constraint.point, targetLine).name;
      else if (constraint instanceof ArcEndpointOnLineConstraint) constraint.name = new ArcEndpointOnLineConstraint(constraint.arc, constraint.endpoint, targetLine).name;
    }
  }

  function addBoundaryPointConstraint(point, boundary) {
    const source = boundary?.source || {};
    if (source.line) pushModelConstraint(new PointOnLineConstraint(point, source.line));
    else if (source.primitive) pushModelConstraint(new PointOnCircleConstraint(point, source.primitive));
    else if (source.arc) pushModelConstraint(new PointOnCircleConstraint(point, source.arc));
  }

  function addArcBoundaryConstraint(arc, endpoint, boundary) {
    const source = boundary?.source || {};
    if (source.line) pushModelConstraint(new ArcEndpointOnLineConstraint(arc, endpoint, source.line));
    else if (source.primitive) pushModelConstraint(new ArcEndpointOnCircleConstraint(arc, endpoint, source.primitive));
    else if (source.arc) pushModelConstraint(new ArcEndpointOnCircleConstraint(arc, endpoint, source.arc));
  }

  function removeTrimmedItem(item) {
    cleanupTrimConstraints(item);
    if (item instanceof Line) {
      const endpoints = [item.p1, item.p2];
      model.lines = model.lines.filter((line) => line !== item);
      removeOrphanTrimmedEndpoints(endpoints);
    } else if (item instanceof Circle) {
      const center = item.center;
      model.circles = model.circles.filter((circle) => circle !== item);
      model.points = model.points.filter((point) => point !== center || point.kind !== "endpoint" || isPointUsedByPrimitive(point) || isReferencePoint(point));
    } else if (item instanceof Arc) {
      const center = item.center;
      model.arcs = model.arcs.filter((arc) => arc !== item);
      model.points = model.points.filter((point) => point !== center || point.kind !== "endpoint" || isPointUsedByPrimitive(point) || isReferencePoint(point));
    }
  }

  function removeOrphanTrimmedEndpoints(points) {
    const removable = points.filter((point) => point?.kind === "endpoint" && !isPointUsedByPrimitive(point));
    if (removable.length === 0) return;
    model.constraints = model.constraints.filter((constraint) => !removable.some((point) => constraintReferencesPoint(constraint, point)));
    model.points = model.points.filter((point) => !removable.includes(point));
  }

  function executeLineTrim(preview) {
    const line = preview.item;
    if (preview.deleteWhole) {
      removeTrimmedItem(line);
      return;
    }
    const { left, right } = preview.interval;
    cleanupTrimConstraints(line, { preserveLineSupport: true });
    if (left.t <= 1e-6) {
      const p = addPoint(right.point.x, right.point.y, false, "endpoint");
      line.p1 = p;
      addBoundaryPointConstraint(p, right);
    } else if (right.t >= 1 - 1e-6) {
      const p = addPoint(left.point.x, left.point.y, false, "endpoint");
      line.p2 = p;
      addBoundaryPointConstraint(p, left);
    } else {
      const rightSidePointConstraints = captureRightTrimmedLinePointConstraints(line, right.t);
      const oldP2 = line.p2;
      const pLeft = addPoint(left.point.x, left.point.y, false, "endpoint");
      const pRight = addPoint(right.point.x, right.point.y, false, "endpoint");
      line.p2 = pLeft;
      const newLine = addLine(pRight, oldP2, line.construction);
      if (newLine) {
        cloneTrimmedLineConstraints(line, newLine);
        retargetTrimmedLinePointConstraints(rightSidePointConstraints, line, newLine);
      }
      addBoundaryPointConstraint(pLeft, left);
      addBoundaryPointConstraint(pRight, right);
    }
    enforceMinimumLineLengths([line]);
  }

  function executeArcTrim(preview) {
    const arc = preview.item;
    if (preview.deleteWhole) {
      removeTrimmedItem(arc);
      return;
    }
    const { left, right } = preview.interval;
    cleanupTrimConstraints(arc);
    if (left.t <= 1e-6) {
      arc.startAngle = angleAtArcParam(arc, right.t);
      addArcBoundaryConstraint(arc, "start", right);
    } else if (right.t >= 1 - 1e-6) {
      arc.endAngle = angleAtArcParam(arc, left.t);
      addArcBoundaryConstraint(arc, "end", left);
    } else {
      const oldEnd = arc.endAngle;
      arc.endAngle = angleAtArcParam(arc, left.t);
      const newArc = addArc(arc.center, arc.radius(), angleAtArcParam(arc, right.t), oldEnd, arc.construction);
      addArcBoundaryConstraint(arc, "end", left);
      if (newArc) addArcBoundaryConstraint(newArc, "start", right);
    }
    normalizeArcSweeps();
  }

  function executeCircleTrim(preview) {
    const circle = preview.item;
    if (preview.deleteWhole) {
      removeTrimmedItem(circle);
      return;
    }
    cleanupTrimConstraints(circle);
    const kept = [];
    const boundaries = preview.boundaries || [];
    for (let i = 0; i < boundaries.length; i++) {
      const left = boundaries[i];
      const right = boundaries[(i + 1) % boundaries.length];
      const wraps = left.t > right.t;
      const start = angleAtCircleParam(left.t);
      const end = angleAtCircleParam(right.t) + (wraps ? Math.PI * 2 : 0);
      const sameRemoved = Math.abs(left.t - preview.interval.left.t) <= 1e-6 && Math.abs(right.t - preview.interval.right.t) <= 1e-6;
      if (sameRemoved || (end - start) * circle.radius() < MIN_ARC_LENGTH) continue;
      const arc = addArc(circle.center, circle.radius(), start, end, circle.construction);
      if (arc) {
        addArcBoundaryConstraint(arc, "start", left);
        addArcBoundaryConstraint(arc, "end", right);
        kept.push(arc);
      }
    }
    model.circles = model.circles.filter((item) => item !== circle);
    if (kept.length === 0) model.points = model.points.filter((p) => p !== circle.center || isPointUsedByPrimitive(p));
  }

  function executeTrimAt(pointer) {
    const preview = computeTrimPreview(pointer);
    if (!preview) {
      setHint("トリムできる交点がありません", "error");
      draw();
      return false;
    }
    if (preview.kind === "line") executeLineTrim(preview);
    else if (preview.kind === "arc") executeArcTrim(preview);
    else executeCircleTrim(preview);
    trimPreview = null;
    clearSelection();
    const result = solveAndRefresh("トリム");
    setHint(`トリムしました (error=${result.errorNorm.toExponential(2)})`);
    return true;
  }

  function sharedLinePoint(a, b) {
    if (a.p1 === b.p1 || a.p1 === b.p2) return a.p1;
    if (a.p2 === b.p1 || a.p2 === b.p2) return a.p2;
    return null;
  }

  function otherLinePoint(line, point) {
    return line.p1 === point ? line.p2 : line.p2 === point ? line.p1 : null;
  }

  function setLineEndpoint(line, from, to) {
    if (line.p1 === from) line.p1 = to;
    else if (line.p2 === from) line.p2 = to;
  }

  function computeFilletGeometry(line1, line2, radius = DEFAULT_FILLET_RADIUS) {
    const corner = sharedLinePoint(line1, line2);
    if (!corner) return { ok: false, reason: "接続された2本の線を選択してください" };
    const o1 = otherLinePoint(line1, corner);
    const o2 = otherLinePoint(line2, corner);
    const l1 = hypot2(o1.x - corner.x, o1.y - corner.y);
    const l2 = hypot2(o2.x - corner.x, o2.y - corner.y);
    if (l1 < MIN_ORIENTATION_LENGTH || l2 < MIN_ORIENTATION_LENGTH) return { ok: false, reason: "面取り対象の線が短すぎます" };

    const u1 = { x: (o1.x - corner.x) / l1, y: (o1.y - corner.y) / l1 };
    const u2 = { x: (o2.x - corner.x) / l2, y: (o2.y - corner.y) / l2 };
    const dot = Math.max(-0.999, Math.min(0.999, u1.x * u2.x + u1.y * u2.y));
    const theta = Math.acos(dot);
    const tangentScale = Math.tan(theta / 2);
    const maxTangent = Math.min(l1, l2) - MIN_LINE_LENGTH;
    if (!Number.isFinite(maxTangent) || maxTangent <= 0) return { ok: false, reason: "R面取り後の線長を確保できません" };
    const tangent = radius / tangentScale;
    if (Number.isFinite(tangent) && tangent >= maxTangent) return { ok: false, reason: "R寸法を保つための直線部を確保できません" };
    if (!Number.isFinite(tangent) || tangent <= 0 || tangent >= Math.min(l1, l2)) return { ok: false, reason: "この角度と線長ではR面取りを作成できません" };

    const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
    const bisLen = hypot2(bis.x, bis.y);
    if (bisLen < 1e-9) return { ok: false, reason: "180度の角にはR面取りを作成できません" };
    const centerDistance = radius / Math.sin(theta / 2);
    const t1 = { x: corner.x + u1.x * tangent, y: corner.y + u1.y * tangent };
    const t2 = { x: corner.x + u2.x * tangent, y: corner.y + u2.y * tangent };
    const center = { x: corner.x + (bis.x / bisLen) * centerDistance, y: corner.y + (bis.y / bisLen) * centerDistance };
    const startAngle = Math.atan2(t1.y - center.y, t1.x - center.x);
    const endAngle = shortestAngleFrom(startAngle, Math.atan2(t2.y - center.y, t2.x - center.x));
    return { ok: true, corner, t1, t2, center, radius, startAngle, endAngle };
  }

  function createFillet(line1, line2, radius = DEFAULT_FILLET_RADIUS) {
    const geometry = computeFilletGeometry(line1, line2, radius);
    if (!geometry.ok) return geometry;
    const { corner, t1: t1Pos, t2: t2Pos, center: centerPos, radius: finalRadius, startAngle, endAngle } = geometry;
    const t1 = addPoint(t1Pos.x, t1Pos.y, false, "endpoint");
    const t2 = addPoint(t2Pos.x, t2Pos.y, false, "endpoint");
    const center = addPoint(centerPos.x, centerPos.y, false, "endpoint");
    setLineEndpoint(line1, corner, t1);
    setLineEndpoint(line2, corner, t2);
    const arc = addArc(center, finalRadius, startAngle, endAngle, false);
    if (!arc) return { ok: false, reason: "R面取り円弧を作成できません" };
    const radiusConstraint = new RadiusConstraint(arc, finalRadius);
    radiusConstraint.dimension = defaultDimensionForTarget({ kind: "radius", primitive: arc, value: finalRadius });
    solver.syncLineOrientationHints?.();
    [
      new ArcEndpointCoincidentConstraint(arc, "start", t1),
      new ArcEndpointCoincidentConstraint(arc, "end", t2),
      new PointOnLineConstraint(corner, line1),
      new PointOnLineConstraint(corner, line2),
      new LineCircleTangentConstraint(line1, arc),
      new LineCircleTangentConstraint(line2, arc),
      radiusConstraint,
    ].forEach((constraint) => pushModelConstraint(constraint));
    return { ok: true, arc };
  }

  function startFilletRadiusInput(line1, line2) {
    pendingCommand = {
      type: "fillet-radius-value",
      line1,
      line2,
      buffer: String(DEFAULT_FILLET_RADIUS),
      editing: false,
    };
    setHint("R寸法を入力してください。数字キーで編集、Enterで作成、Escでキャンセル");
    draw();
    focusDimensionValueInput();
  }

  function submitFilletRadiusValue() {
    if (pendingCommand?.type !== "fillet-radius-value") return false;
    const value = Number(pendingCommand.buffer);
    if (!Number.isFinite(value) || value <= 0) {
      setHint("R寸法には0より大きい数値を入力してください", "error");
      draw();
      return true;
    }
    const { line1, line2 } = pendingCommand;
    pendingCommand = null;
    hideDimensionValueInput();
    const result = createFillet(line1, line2, value);
    if (!result.ok) {
      setHint(result.reason, "error");
      draw();
      return true;
    }
    clearSelection();
    filletFirstLine = null;
    solveAndRefresh("R面取り追加");
    return true;
  }

  function handleFilletClick(line) {
    if (!line) {
      setHint("R面取りする線をクリックしてください", "error");
      return;
    }
    if (!filletFirstLine) {
      filletFirstLine = line;
      selectedLines = [line];
      selectedPoints = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("接続する2本目の線をクリックするとR面取りを作成します");
      updateGeometrySelectionUI();
      draw();
      return;
    }
    if (filletFirstLine === line) {
      setHint("別の接続線をクリックしてください", "error");
      return;
    }
    startFilletRadiusInput(filletFirstLine, line);
    filletFirstLine = null;
  }

  function handleCircleClick(p) {
    p = snapForDrawing(p);
    const snap = activeSnap;
    pointerPreview = p;
    if (!circleCenterPoint) {
      const center = endpointAt(p.x, p.y);
      addPointSnapConstraints(center, snap);
      circleCenterPoint = center;
      selectedPoints = [center];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("半径位置をクリックすると円を作成します。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }
    const circle = addCircle(circleCenterPoint, hypot2(p.x - circleCenterPoint.x, p.y - circleCenterPoint.y));
    if (circle) {
      addCircleBoundarySnapConstraints(circle, snap);
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [circle];
      selectedArcs = [];
      circleCenterPoint = null;
      pointerPreview = null;
      clearSnap();
      clearSelection();
      solveAndRefresh("円追加");
    }
  }

  function handleArcClick(p) {
    p = snapForDrawing(p);
    const snap = activeSnap;
    pointerPreview = p;
    if (!arcCenterPoint) {
      const center = endpointAt(p.x, p.y);
      addPointSnapConstraints(center, snap);
      arcCenterPoint = center;
      selectedPoints = [center];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      setHint("円弧の始点をクリックしてください。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }
    if (!arcStartPoint) {
      const radius = hypot2(p.x - arcCenterPoint.x, p.y - arcCenterPoint.y);
      if (radius < MIN_ORIENTATION_LENGTH) {
        setHint("中心から離れた位置をクリックしてください", "error");
        draw();
        return;
      }
      arcStartPoint = {
        radius,
        startAngle: Math.atan2(p.y - arcCenterPoint.y, p.x - arcCenterPoint.x),
        snap,
      };
      selectedPoints = [arcCenterPoint];
      setHint("円弧の終点をクリックすると円弧を作成します。Escで選択モードに戻ります");
      updateUI();
      draw();
      return;
    }
    const arc = addArc(arcCenterPoint, arcStartPoint.radius, arcStartPoint.startAngle, shortestAngleFrom(arcStartPoint.startAngle, Math.atan2(p.y - arcCenterPoint.y, p.x - arcCenterPoint.x)));
    if (arc) {
      addArcEndpointSnapConstraints(arc, "start", arcStartPoint.snap);
      addArcEndpointSnapConstraints(arc, "end", snap);
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [arc];
      arcCenterPoint = null;
      arcStartPoint = null;
      pointerPreview = null;
      clearSnap();
      clearSelection();
      solveAndRefresh("円弧追加");
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      panSession = {
        pointerId: e.pointerId,
        startPointer: canvasScreenPoint(e),
        startX: viewport.x,
        startY: viewport.y,
      };
      canvas.classList.add("is-panning");
      canvas.setPointerCapture(e.pointerId);
      setHint("画面移動中: マウススクロールボタンを押しながらドラッグ");
      return;
    }

    const p = canvasPoint(e);
    lastPointerWorld = p;
    const hitP = hitPoint(p.x, p.y);
    const hitL = hitLine(p.x, p.y);
    const hitC = hitCircle(p.x, p.y);
    const hitArcEnd = hitArcEndpoint(p.x, p.y);
    const hitA = hitArc(p.x, p.y);
    const hitD = hitDimension(p.x, p.y);
    const hitBlockHandle = hitBlockRotationHandle(p.x, p.y);
    const hitBlock = hitBlockHandle || hitBlockInstance(p.x, p.y);
    hoveredSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
    const inactiveHit = null;
    const blankAnnotationHit = hitAnnotationElement(p.x, p.y);
    const annotationTargetHit = hitAnnotationTarget(p.x, p.y);

    const blankDoubleClickHits = { hitP, hitL, hitC, hitArcEnd, hitA, hitD, hitBlock, inactiveHit, annotationHit: blankAnnotationHit };
    if (isRepeatedBlankDoubleClick(e, blankDoubleClickHits) && handleBlankCanvasDoubleClick(p, blankDoubleClickHits)) {
      suppressNextBlankDoubleClickEvent = true;
      e.preventDefault();
      return;
    }

    if (pendingCommand?.type === "annotation-text-place") {
      e.preventDefault();
      commitTextAnnotationAt(p);
      return;
    }

    if (pendingCommand?.type === "annotation-leader-select") {
      e.preventDefault();
      handleLeaderAnnotationTargetClick(annotationTargetHit, p);
      return;
    }

    if (pendingCommand?.type === "annotation-leader-place") {
      e.preventDefault();
      commitLeaderAnnotationAt(p);
      return;
    }

    if (blankAnnotationHit && mode === "select" && !pendingCommand && !pendingConstraintCommand) {
      e.preventDefault();
      clearSelection();
      beginAnnotationDrag(e, blankAnnotationHit, p);
      updateUI({ refreshAnalysis: false });
      draw();
      return;
    }

    if (hitD && !e.shiftKey && !e.ctrlKey && ((!pendingCommand && !pendingConstraintCommand) || isDimensionConstraintCommandActive())) {
      e.preventDefault();
      if (!isDimensionConstraintCommandActive()) {
        selectedPoints = [];
        selectedLines = [];
        selectedCircles = [];
        selectedArcs = [];
        selectedArcEndpoint = null;
      }
      beginDimensionDrag(e, hitD, p, { hitP, hitL, hitC, hitA, hitArcEnd });
      return;
    }

    if (pendingCommand?.type === "distance-place") {
      e.preventDefault();
      if (retargetDistancePlaceWithOperand(p, { hitP, hitL, hitC, hitA, hitArcEnd })) return;
      startDistanceValueInput(p);
      return;
    }

    if (pendingCommand?.type === "distance-value" || pendingCommand?.type === "fillet-radius-value" || pendingCommand?.type === "offset-value") {
      e.preventDefault();
      return;
    }

    if (
      pendingConstraintCommand &&
      (selectedDimensionConstraint || effectiveSelectedConstraint()) &&
      !hitP &&
      !hitL &&
      !hitC &&
      !hitArcEnd &&
      !hitA &&
      !hitD &&
      !inactiveHit
    ) {
      e.preventDefault();
      selectedDimensionConstraint = null;
      selectedConstraint = null;
      hoveredDimensionConstraint = null;
      setHint(constraintTargetHint(pendingConstraintCommand.type));
      updateGeometrySelectionUI();
      draw();
      return;
    }

    if (pendingConstraintCommand) {
      e.preventDefault();
      handleConstraintOperandClick(p, pendingConstraintCommand.type, { hitP, hitL, hitC, hitA, hitArcEnd });
      return;
    }

    if (mode === "block-place") {
      e.preventDefault();
      handleBlockPlacementClick(p);
      return;
    }

    if (["point", "line", "rectangle", "circle", "arc", "fillet", "trim", "offset", "block-place"].includes(mode) && rejectRootSketchCreation()) {
      e.preventDefault();
      return;
    }

    if (mode === "point") {
      clearTransientPointRollback();
      beginTransientPointRollback();
      const sp = snapForDrawing(p);
      const snap = activeSnap;
      const np = addPoint(sp.x, sp.y, false);
      if (pointStartRollback) pointStartRollback.createdPoint = np;
      addPointSnapConstraints(np, snap);
      clearSnap();
      selectedPoints = [np];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      solveAndRefresh("点追加");
      return;
    }

    if (mode === "line") {
      handleLineClick(p, e.shiftKey);
      return;
    }

    if (mode === "rectangle") {
      handleRectangleClick(p);
      return;
    }

    if (mode === "fillet") {
      handleFilletClick(hitL);
      return;
    }

    if (mode === "circle") {
      handleCircleClick(p);
      return;
    }

    if (mode === "arc") {
      handleArcClick(p);
      return;
    }

    if (mode === "trim") {
      executeTrimAt(p);
      return;
    }

    if (mode === "offset") {
      if (!offsetSource) {
        offsetSource = hitL || hitC || hitA;
        if (!offsetSource) {
          setHint("オフセットする線、円、円弧をクリックしてください", "error");
          return;
        }
        selectedPoints = [];
        selectedLines = offsetSource instanceof Line ? [offsetSource] : [];
        selectedCircles = offsetSource instanceof Circle ? [offsetSource] : [];
        selectedArcs = offsetSource instanceof Arc ? [offsetSource] : [];
        pointerPreview = p;
        setHint("オフセットする側と距離の目安をクリックしてください");
        updateGeometrySelectionUI();
        draw();
        return;
      }
      startOffsetDistanceInput(offsetSource, p);
      return;
    }

    if (inactiveHit) {
      setHint(`${inactiveHit.id} / ${sketchName(inactiveHit.sketchId)} は非アクティブスケッチの要素です`);
      draw();
      return;
    }

    const multiSelect = e.shiftKey || e.ctrlKey;

    if (hitBlock) {
      if (multiSelect) {
        selectedDimensionConstraint = null;
        selectedConstraint = null;
        toggleBlockInstanceSelection(hitBlock);
        setHint(`ブロックインスタンスを${selectedBlockInstances.length}個選択`);
        updateGeometrySelectionUI();
        draw();
      } else beginBlockDrag(e, hitBlock, p, Boolean(hitBlockHandle));
    } else if (hitD && !multiSelect) {
      selectedPoints = [];
      selectedLines = [];
      selectedCircles = [];
      selectedArcs = [];
      selectedArcEndpoint = null;
      beginDimensionDrag(e, hitD, p);
    } else if (hitP) {
      selectedDimensionConstraint = null;
      if (multiSelect) togglePointSelection(hitP);
      else beginDrag(e, hitP, null, null, null, null, p);
    } else if (hitArcEnd) {
      selectedDimensionConstraint = null;
      if (multiSelect) {
        const next = { arc: hitArcEnd.arc, endpoint: hitArcEnd.endpoint };
        if (selectedArcEndpoint && !sameArcEndpoint(selectedArcEndpoint, next)) selectedArcEndpointPair = [selectedArcEndpoint, next];
        selectedArcEndpoint = next;
        if (!selectedArcs.includes(hitArcEnd.arc)) selectedArcs.push(hitArcEnd.arc);
      } else {
        beginDrag(e, null, null, null, null, hitArcEnd, p);
      }
    } else if (hitL) {
      selectedDimensionConstraint = null;
      if (multiSelect) toggleLineSelection(hitL);
      else beginDrag(e, null, hitL, null, null, null, p);
    } else if (hitC) {
      selectedDimensionConstraint = null;
      if (multiSelect) toggleCircleSelection(hitC);
      else beginDrag(e, null, null, hitC, null, null, p);
    } else if (hitA) {
      selectedDimensionConstraint = null;
      if (multiSelect) toggleArcSelection(hitA);
      else beginDrag(e, null, null, null, hitA, null, p);
    } else {
      selectionRectSession = {
        pointerId: e.pointerId,
        start: p,
        current: p,
        additive: multiSelect,
      };
      canvas.setPointerCapture(e.pointerId);
    }

    // Selection does not change the model, so keep the most recent constraint
    // analysis instead of repeating the expensive redundancy scan.
    updateGeometrySelectionUI();
    draw();
  });

  canvas.addEventListener("pointermove", (e) => {
    const coordinatePoint = screenToWorld(canvasScreenPoint(e));
    const coordinateStatus = document.getElementById("statusCoordinates");
    if (coordinateStatus) coordinateStatus.textContent = `X ${formatDisplayNumber(coordinatePoint.x, 3)} / Y ${formatDisplayNumber(coordinatePoint.y, 3)}`;
    if (panSession) {
      const p = canvasScreenPoint(e);
      viewport.x = panSession.startX + (p.x - panSession.startPointer.x);
      viewport.y = panSession.startY + (p.y - panSession.startPointer.y);
      draw();
      return;
    }

    const p = canvasPoint(e);
    lastPointerWorld = p;
    if (selectionRectSession) {
      clearSnap();
      hoveredSketchIdentity = null;
      selectionRectSession.current = p;
      draw();
      return;
    }

    if (annotationDragSession) {
      clearSnap();
      updateAnnotationDrag(p);
      return;
    }

    if (pendingCommand?.type === "annotation-leader-place" || pendingCommand?.type === "annotation-text-place") {
      pendingCommand.pointer = p;
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      hoveredCircle = null;
      hoveredArcEndpoint = null;
      hoveredArc = null;
      hoveredDimensionConstraint = null;
      hoveredSketchIdentity = null;
      draw();
      return;
    }

    if (dimensionDragSession) {
      clearSnap();
      const dx = p.x - dimensionDragSession.startPointer.x;
      const dy = p.y - dimensionDragSession.startPointer.y;
      if (dimensionDragSession.startedDuringDimensionCommand && !dimensionDragSession.moved) {
        if (hypot2(dx, dy) * viewport.scale <= 3) return;
        dimensionDragSession.moved = true;
      }
      if (dimensionDragSession.part === "label") {
        if (dimensionDragSession.target.kind === "angle") {
          const nextDimension = angleDimensionFromLabelPoint(
            dimensionDragSession.target,
            p,
            dimensionDragSession.startAngleLabelOffsets,
          );
          if (!nextDimension) return;
          preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
          dimensionDragSession.constraint.dimension = nextDimension;
          syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
          draw();
          return;
        }
        const anchor =
          dimensionDragSession.target.kind === "radius" || dimensionDragSession.target.kind === "diameter"
            ? p
            : {
                x: dimensionDragSession.startAnchor.x + dx,
                y: dimensionDragSession.startAnchor.y + dy,
              };
        const nextDimension = dimensionWithLabelAt(
          dimensionDragSession.target,
          dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false }),
          p,
        );
        preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
        dimensionDragSession.constraint.dimension = nextDimension;
        syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
        draw();
        return;
      }
      const anchor =
        dimensionDragSession.target.kind === "radius" || dimensionDragSession.target.kind === "diameter"
          ? p
          : {
              x: dimensionDragSession.startAnchor.x + dx,
              y: dimensionDragSession.startAnchor.y + dy,
            };
      const nextDimension = dimensionFromAnchor(dimensionDragSession.target, anchor, { allowPointAxis: false });
      nextDimension.labelOffsetU = dimensionDragSession.startLabelOffsetU;
      preserveDimensionDragDisplay(dimensionDragSession, nextDimension);
      if (dimensionDragSession.target.kind === "angle") {
        setAngleDimensionLabelOffsets(nextDimension, dimensionDragSession.startAngleLabelOffsets);
      }
      dimensionDragSession.constraint.dimension = nextDimension;
      syncAngleConstraintFromDimension(dimensionDragSession.constraint, dimensionDragSession.target, nextDimension);
      draw();
      return;
    }

    if (["point", "line", "rectangle", "circle", "arc", "fillet", "trim", "offset", "block-place"].includes(mode) && !canCreateInActiveSketch()) {
      clearSnap();
      pointerPreview = null;
      trimPreview = null;
      hoveredSketchIdentity = null;
      return;
    }

    if (mode === "line") {
      hoveredSketchIdentity = null;
      const rawPreview = lineStartPoint && e.shiftKey ? orthogonalPointFrom(lineStartPoint, p) : p;
      pointerPreview = snapForDrawing(rawPreview);
      draw();
    }

    if (mode === "rectangle" || mode === "circle" || mode === "arc") {
      hoveredSketchIdentity = null;
      pointerPreview = snapForDrawing(p);
      draw();
    }

    if (mode === "block-place") {
      clearSnap();
      hoveredSketchIdentity = null;
      pointerPreview = p;
      draw();
      return;
    }

    if (pendingCommand?.type === "distance-place") {
      clearSnap();
      const hitD = hitDimension(p.x, p.y);
      hoveredSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      pendingCommand.pointer = p;
      pendingCommand.dimension = null;
      updatePendingLineLengthHover(p);
      if (hitD) {
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = null;
        hoveredCircle = null;
        hoveredArcEndpoint = null;
        hoveredArc = null;
        hoveredDimensionConstraint = hitD.constraint;
      }
      draw();
      return;
    }

    if (mode === "trim") {
      clearSnap();
      const hadHover = Boolean(hoveredPoint || hoveredEndpointPoint || hoveredLine || hoveredCircle || hoveredArcEndpoint || hoveredArc || hoveredDimensionConstraint);
      hoveredPoint = null;
      hoveredEndpointPoint = null;
      hoveredLine = null;
      hoveredCircle = null;
      hoveredArcEndpoint = null;
      hoveredArc = null;
      hoveredDimensionConstraint = null;
      hoveredSketchIdentity = null;
      const nextTrimPreview = computeTrimPreview(p);
      if (nextTrimPreview !== trimPreview || hadHover) {
        trimPreview = nextTrimPreview;
        draw();
      }
      return;
    }

    if (mode === "offset") {
      clearSnap();
      hoveredSketchIdentity = null;
      if (pendingCommand?.type === "offset-value") {
        draw();
        return;
      }
      if (offsetSource) {
        pointerPreview = p;
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = offsetSource instanceof Line ? offsetSource : null;
        hoveredCircle = offsetSource instanceof Circle ? offsetSource : null;
        hoveredArc = offsetSource instanceof Arc ? offsetSource : null;
      } else {
        const nextLine = hitLine(p.x, p.y);
        const nextCircle = nextLine ? null : hitCircle(p.x, p.y);
        const nextArc = nextLine || nextCircle ? null : hitArc(p.x, p.y);
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = nextLine;
        hoveredCircle = nextCircle;
        hoveredArc = nextArc;
      }
      hoveredArcEndpoint = null;
      hoveredDimensionConstraint = null;
      draw();
      return;
    }

    if (pendingConstraintCommand && !dragSession) {
      const hitD = pendingConstraintCommand.type === "distance" ? hitDimension(p.x, p.y) : null;
      if (hitD) {
        hoveredPoint = null;
        hoveredEndpointPoint = null;
        hoveredLine = null;
        hoveredCircle = null;
        hoveredArcEndpoint = null;
        hoveredArc = null;
        hoveredDimensionConstraint = hitD.constraint;
        hoveredBlockInstance = null;
        draw();
        return;
      }
      const blockOperand = hitBlockProjectionOperand(p.x, p.y);
      if (blockOperand) {
        hoveredPoint = blockOperand.kind === "point" ? blockOperand.point : null;
        hoveredEndpointPoint = null;
        hoveredLine = blockOperand.kind === "line" ? blockOperand.line : null;
        hoveredCircle = blockOperand.kind === "primitive" && blockOperand.primitive instanceof Circle ? blockOperand.primitive : null;
        hoveredArc = blockOperand.kind === "primitive" && blockOperand.primitive instanceof Arc ? blockOperand.primitive : null;
        hoveredArcEndpoint = blockOperand.kind === "arc-endpoint" ? { arc: blockOperand.arc, endpoint: blockOperand.endpoint } : null;
        hoveredDimensionConstraint = null;
        hoveredBlockInstance = null;
        draw();
        return;
      }
      const referenceTarget = hitReferenceTarget(p.x, p.y);
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      const nextEndpointHover = referenceTarget ? null : hitEndpointPoint(p.x, p.y);
      const nextPointHover = referenceTarget ? (referenceTarget.kind === "point" ? referenceTarget.point : null) : nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = referenceTarget ? (referenceTarget.kind === "line" ? referenceTarget.line : null) : nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = referenceTarget
        ? referenceTarget.primitive instanceof Circle
          ? referenceTarget.primitive
          : null
        : nextPointHover || nextLineHover
          ? null
          : hitCircle(p.x, p.y);
      const nextArcEndpointHover = referenceTarget || nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = referenceTarget
        ? referenceTarget.primitive instanceof Arc
          ? referenceTarget.primitive
          : null
        : nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover
          ? null
          : hitArc(p.x, p.y);
      if (
        nextPointHover !== hoveredPoint ||
        nextEndpointHover !== hoveredEndpointPoint ||
        nextLineHover !== hoveredLine ||
        nextCircleHover !== hoveredCircle ||
        !sameArcEndpoint(nextArcEndpointHover, hoveredArcEndpoint) ||
        nextArcHover !== hoveredArc ||
        hoveredDimensionConstraint ||
        nextSketchIdentity?.item !== hoveredSketchIdentity?.item ||
        Boolean(nextSketchIdentity)
      ) {
        hoveredPoint = nextPointHover;
        hoveredEndpointPoint = nextEndpointHover;
        hoveredLine = nextLineHover;
        hoveredCircle = nextCircleHover;
        hoveredArcEndpoint = nextArcEndpointHover;
        hoveredArc = nextArcHover;
        hoveredDimensionConstraint = null;
        hoveredSketchIdentity = nextSketchIdentity;
        draw();
      }
      return;
    }

    if (!dragSession) {
      const hitD = hitDimension(p.x, p.y, { activeOnly: false });
      const nextHover = hitD && isActiveSketchConstraint(hitD.constraint) ? hitD.constraint : null;
      const nextEndpointHover = nextHover ? null : hitEndpointPoint(p.x, p.y);
      const nextPointHover = nextHover ? null : nextEndpointHover || hitExplicitPoint(p.x, p.y);
      const nextLineHover = nextPointHover ? null : hitLine(p.x, p.y);
      const nextCircleHover = nextPointHover || nextLineHover ? null : hitCircle(p.x, p.y);
      const nextArcEndpointHover = nextPointHover || nextLineHover || nextCircleHover ? null : hitArcEndpoint(p.x, p.y);
      const nextArcHover = nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover ? null : hitArc(p.x, p.y);
      const nextSketchIdentity = hitSketchIdentityElement(p.x, p.y, { allowInactiveGeometry: true });
      const nextBlockHover = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover ? null : hitBlockInstance(p.x, p.y);
      const annotationHit = nextHover || nextPointHover || nextLineHover || nextCircleHover || nextArcEndpointHover || nextArcHover || nextBlockHover
        ? null
        : hitAnnotationElement(p.x, p.y);
      const nextAnnotationHover = annotationHit?.element || null;
      if (
        nextPointHover !== hoveredPoint ||
        nextEndpointHover !== hoveredEndpointPoint ||
        nextLineHover !== hoveredLine ||
        nextCircleHover !== hoveredCircle ||
        !sameArcEndpoint(nextArcEndpointHover, hoveredArcEndpoint) ||
        nextArcHover !== hoveredArc ||
        nextHover !== hoveredDimensionConstraint ||
        nextSketchIdentity?.item !== hoveredSketchIdentity?.item ||
        Boolean(nextSketchIdentity) || nextBlockHover !== hoveredBlockInstance ||
        nextAnnotationHover !== hoveredAnnotation
      ) {
        hoveredPoint = nextPointHover;
        hoveredEndpointPoint = nextEndpointHover;
        hoveredLine = nextLineHover;
        hoveredCircle = nextCircleHover;
        hoveredArcEndpoint = nextArcEndpointHover;
        hoveredArc = nextArcHover;
        hoveredDimensionConstraint = nextHover;
        hoveredSketchIdentity = nextSketchIdentity;
        hoveredBlockInstance = nextBlockHover;
        hoveredAnnotation = nextAnnotationHover;
        draw();
      }
    }

    if (!dragSession) return;
    const pointerDistance = hypot2(p.x - dragSession.startPointer.x, p.y - dragSession.startPointer.y);
    if (!dragSession.previewMoved && pointerDistance <= 3 / viewport.scale) return;
    dragSession.previewMoved = true;
    const result = dragResultForSession(dragSession, p);
    const error = result.errorNorm;
    if (result.blocked) {
      setHint(result.reason, "error");
      updateUI({ refreshAnalysis: false });
      draw();
      return;
    }
    const scope = result.local
      ? `${result.guided ? "guided local" : "local"} vars=${result.variableCount}, constraints=${result.constraintCount}${Number.isFinite(result.freeDof) ? `, dof=${result.freeDof}` : ""}`
      : "global";
    const fallback = result.fallback ? ` fallback from local error=${result.localErrorNorm?.toExponential(2)}` : "";
    const dependentResult = solveReferenceDependentSketches(dragSession.sketchId || activeSketchId());
    const dependentText = dependentResult.results.length > 0 ? `, dependent=${dependentResult.results.length}` : "";
    const dependentErrorText = dependentErrorSummary(dependentResult);
    setHint(`${dragLabel(dragSession)}中: ${scope}, error=${error.toExponential(2)}, iter=${result.iterations}${fallback}${dependentText}${dependentErrorText}`, dependentResult.success ? "normal" : "error");
    if (!dependentResult.success) updateUI();
    draw();
  });

  function endDrag(e) {
    if (panSession) {
      panSession = null;
      canvas.classList.remove("is-panning");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      setHint("画面移動を終了しました");
      return;
    }

    if (annotationDragSession) {
      annotationDragSession = null;
      canvas.classList.remove("is-dragging");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      setHint("注記の位置を更新しました");
      updateUI();
      draw();
      recordHistory("注記移動");
      return;
    }

    if (dimensionDragSession) {
      const session = dimensionDragSession;
      dimensionDragSession = null;
      canvas.classList.remove("is-dragging");
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      if (session.startedDuringDimensionCommand && !session.moved) {
        selectedDimensionConstraint = null;
        hoveredDimensionConstraint = null;
        const pointer = canvasPoint(e);
        if (pendingCommand?.type === "distance-place") {
          if (!retargetDistancePlaceWithOperand(pointer, session.commandHits || {})) startDistanceValueInput(pointer);
        } else if (pendingConstraintCommand?.type === "distance") {
          handleConstraintOperandClick(pointer, "distance", session.commandHits || {});
        }
        return;
      }
      setHint("寸法線の位置を更新しました");
      updateUI();
      draw();
      recordHistory("寸法線移動");
      return;
    }

    if (selectionRectSession) {
      const session = selectionRectSession;
      selectionRectSession = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        // Pointer capture may already be released by the browser.
      }
      const current = session.current || session.start;
      const moved = hypot2(current.x - session.start.x, current.y - session.start.y);
      if (moved <= 3 / viewport.scale) {
        if (!session.additive) clearSelection();
      } else {
        selectByRect(rectFromPoints(session.start, current), current.x < session.start.x, session.additive);
        setHint("矩形選択を更新しました");
      }
      updateGeometrySelectionUI();
      draw();
      return;
    }

    if (!dragSession) {
      recordHistory("操作");
      return;
    }
    const session = dragSession;
    const completedLabel = dragLabel(session);
    dragSession = null;
    canvas.classList.remove("is-dragging");
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {
      // Pointer capture may already be released by the browser.
    }
    if (!session.previewMoved) {
      setHint("図形を選択しました");
      draw();
      return;
    }
    const result = solveFinalDragSession(session);
    normalizeArcSweeps();
    if (!result.success || result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      if (session.parameterDragSnapshot) restoreModelState(session.parameterDragSnapshot);
      else if (session.fullDragState) solver.restore(session.fullDragState);
      clearSketchSolveState(session.sketchId || activeSketchId());
      setHint(`${completedLabel}完了時の全体solveに失敗しました (error=${result.errorNorm.toExponential(3)})`, "error");
      updateUI();
      draw();
      return;
    }
    if (session.item && model.blockInstances.includes(session.item)) invalidateBlockProjectionCache(session.item.id);
    const stabilized = stabilizeActiveParameterNamespace(session.sketchId || activeSketchId());
    if (!stabilized.success || stabilized.dependent?.success === false || stabilized.result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      if (session.parameterDragSnapshot) restoreModelState(session.parameterDragSnapshot);
      clearSketchSolveState(session.sketchId || activeSketchId());
      setHint(`${completedLabel}${applicationText("後のParameter計算に失敗しました", " parameter calculation failed")}: ${stabilized.result.reason || "solve failed"}`, "error");
      updateUI();
      draw();
      return;
    }
    const dependentResult = stabilized.dependent;
    const analysis = refreshConstraintAnalysis();
    const dependentErrorText = dependentErrorSummary(dependentResult);
    setHint(`${completedLabel}完了: success=${result.success}, error=${result.errorNorm.toExponential(2)}, iter=${result.iterations}${dependentErrorText} / ${constraintSummaryText()}`, analysis.analysis.stable && dependentResult.success ? "normal" : "error");
    updateUI({ refreshAnalysis: false });
    draw();
    recordHistory(`${completedLabel}ドラッグ`);
  }

  function hasSelection() {
    return selectedPoints.length > 0 ||
      selectedLines.length > 0 ||
      selectedCircles.length > 0 ||
      selectedArcs.length > 0 ||
      selectedBlockInstances.length > 0 ||
      Boolean(selectedArcEndpoint) ||
      Boolean(selectedDimensionConstraint) ||
      Boolean(selectedAnnotation) ||
      Boolean(effectiveSelectedConstraint());
  }

  function isBlankCanvasHit(hits = {}) {
    return !hits.hitP &&
      !hits.hitL &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitD &&
      !hits.hitBlock &&
      !hits.annotationHit &&
      !hits.inactiveHit;
  }

  function isTransientLineStartHit(hits = {}) {
    return Boolean(
      lineStartRollback &&
        lineStartPoint &&
        hits.hitP === lineStartPoint &&
        model.points.indexOf(lineStartPoint) >= lineStartRollback.pointLength,
    );
  }

  function isTransientLineCompletionHit(hits = {}) {
    return Boolean(
      mode === "line" &&
        lineCompletionRollback &&
        lineCompletionRollback.completedEndpoint &&
        performance.now() - lineCompletionRollback.createdAt <= 650 &&
        hits.hitP === lineCompletionRollback.completedEndpoint &&
        hits.hitP === lineStartPoint &&
        model.lines.includes(lineCompletionRollback.completedLine),
    );
  }

  function isTransientPointCommandHit(hits = {}) {
    return Boolean(
      mode === "point" &&
        pointStartRollback &&
        pointStartRollback.createdPoint &&
        performance.now() - pointStartRollback.createdAt <= 650 &&
        hits.hitP === pointStartRollback.createdPoint &&
        model.points.indexOf(pointStartRollback.createdPoint) >= pointStartRollback.pointLength,
    );
  }

  function isBlankDoubleClickTarget(hits = {}) {
    if (isBlankCanvasHit(hits)) return true;
    if (
      isTransientPointCommandHit(hits) &&
      !hits.hitL &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitD &&
      !hits.annotationHit &&
      !hits.inactiveHit
    ) {
      return true;
    }
    if (isTransientLineCompletionHit(hits)) {
      return !hits.hitC &&
        !hits.hitArcEnd &&
        !hits.hitA &&
        !hits.hitD &&
        !hits.annotationHit &&
        !hits.inactiveHit;
    }
    return isTransientLineStartHit(hits) &&
      !hits.hitC &&
      !hits.hitArcEnd &&
      !hits.hitA &&
      !hits.hitD &&
      !hits.annotationHit &&
      !hits.inactiveHit;
  }

  function isRepeatedBlankDoubleClick(e, hits = {}) {
    const screen = canvasScreenPoint(e);
    const now = performance.now();
    const repeated = Boolean(
      isBlankDoubleClickTarget(hits) &&
        blankDoubleClickCandidate &&
        now - blankDoubleClickCandidate.time <= 450 &&
        hypot2(screen.x - blankDoubleClickCandidate.x, screen.y - blankDoubleClickCandidate.y) <= 6,
    );
    blankDoubleClickCandidate = isBlankDoubleClickTarget(hits) ? { time: now, x: screen.x, y: screen.y } : null;
    return repeated;
  }

  function isDrawToolMode() {
    return mode === "line" || mode === "point" || mode === "rectangle" || mode === "fillet" || mode === "trim" || mode === "offset" || mode === "circle" || mode === "arc";
  }

  function handleBlankCanvasDoubleClick(pointer, hits = {}) {
    if (!isBlankDoubleClickTarget(hits)) return false;
    blankDoubleClickCandidate = null;
    if (pendingCommand?.type === "distance-value") {
      submitDistanceValue();
      return true;
    }
    if (pendingCommand?.type === "fillet-radius-value") {
      submitFilletRadiusValue();
      return true;
    }
    if (pendingCommand?.type === "offset-value") {
      submitOffsetValue();
      return true;
    }
    if (pendingCommand) {
      cancelPendingCommand();
      if (isDrawToolMode()) exitDrawMode();
      return true;
    }
    if (pendingConstraintCommand) {
      cancelConstraintTargetCommand();
      return true;
    }
    if (mode === "line") {
      if (isTransientLineCompletionHit(hits)) {
        rollbackTransientLineCompletion();
        lineStartPoint = null;
        pointerPreview = null;
        clearSnap();
        clearSelection();
        setHint("線の作図をキャンセルしました");
        updateUI();
        draw();
      } else if (isTransientLineStartHit(hits) || (lineStartRollback && lineStartPoint && !lineCompletionRollback)) {
        cancelActiveDrawOperation();
        exitDrawMode();
      } else if (lineStartPoint) {
        cancelActiveDrawOperation();
        updateUI();
        draw();
      } else {
        exitDrawMode();
      }
      return true;
    }
    if (mode === "point") {
      rollbackTransientPoint();
      exitDrawMode();
      return true;
    }
    if (hasActiveDrawOperation()) {
      cancelActiveDrawOperation();
      exitDrawMode();
      return true;
    }
    if (isDrawToolMode()) {
      exitDrawMode();
      return true;
    }
    if (hasSelection()) {
      clearSelection();
      setHint("選択を解除しました");
      updateGeometrySelectionUI();
      draw();
      return true;
    }
    return false;
  }

  function handleMiddleButtonDoubleClickFit(e) {
    if (e.button !== 1) return false;
    const now = performance.now();
    const screen = canvasScreenPoint(e);
    const previous = lastMiddleAuxClick;
    const repeated =
      previous &&
      now - previous.time <= 450 &&
      hypot2(screen.x - previous.x, screen.y - previous.y) <= 12;
    lastMiddleAuxClick = repeated ? null : { time: now, x: screen.x, y: screen.y };
    if (!repeated) return false;
    if (fitVisibleGeometryToViewport()) {
      setHint("表示中の図形全体が見えるように調整しました");
    } else {
      setHint("表示中の図形がありません", "error");
    }
    draw();
    return true;
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => {
    if (dragSession || dimensionDragSession || annotationDragSession || selectionRectSession || panSession) return;
    clearCanvasHover();
    draw();
  });
  canvas.addEventListener("dblclick", (e) => {
    if (suppressNextBlankDoubleClickEvent) {
      suppressNextBlankDoubleClickEvent = false;
      e.preventDefault();
      return;
    }
    const p = canvasPoint(e);
    const hitL = hitLine(p.x, p.y);
    const hitP = hitPoint(p.x, p.y);
    const hitC = hitCircle(p.x, p.y);
    const hitArcEnd = hitArcEndpoint(p.x, p.y);
    const hitA = hitArc(p.x, p.y);
    const hitD = hitDimension(p.x, p.y);
    const hitBlock = hitBlockInstance(p.x, p.y);
    if (pendingCommand?.type === "fillet-radius-value") {
      e.preventDefault();
      submitFilletRadiusValue();
      return;
    }
    if (pendingCommand?.type === "offset-value") {
      e.preventDefault();
      submitOffsetValue();
      return;
    }
    if (!pendingCommand && hitD && startDimensionEditInput(hitD)) {
      e.preventDefault();
      return;
    }
    if (pendingCommand?.type?.startsWith("distance")) {
      e.preventDefault();
      if (pendingCommand.type === "distance-place") {
        startDistanceValueInput(p);
      }
      submitDistanceValue();
      return;
    }
    if (handleConstraintTargetDoubleClick(hitP, hitL, p)) {
      e.preventDefault();
      return;
    }
    if (!pendingCommand && !pendingConstraintCommand && hitBlock) {
      e.preventDefault();
      enterBlockDefinitionEdit(hitBlock.definitionId);
      return;
    }
    if (handleBlankCanvasDoubleClick(p, { hitP, hitL, hitC, hitArcEnd, hitA, hitD })) {
      e.preventDefault();
      return;
    }
  });
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      handleMiddleButtonDoubleClickFit(e);
    }
  });
  if (dimensionValueInput) {
    dimensionValueInput.addEventListener("pointerdown", (e) => e.stopPropagation());
    dimensionValueInput.addEventListener("dblclick", (e) => e.stopPropagation());
    dimensionValueInput.addEventListener("input", () => {
      if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return;
      pendingCommand.buffer = dimensionValueInput.value;
      pendingCommand.editing = true;
      updateDistanceBufferLabel();
    });
    dimensionValueInput.addEventListener("keydown", (e) => {
      if (!pendingCommand || !["distance-value", "fillet-radius-value", "offset-value"].includes(pendingCommand.type)) return;
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        if (pendingCommand.type === "fillet-radius-value") submitFilletRadiusValue();
        else if (pendingCommand.type === "offset-value") submitOffsetValue();
        else submitDistanceValue();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelPendingCommand("寸法入力をキャンセルしました");
      }
    });
  }
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const screen = canvasScreenPoint(e);
      const world = screenToWorld(screen);
      const nextScale = clampZoom(viewport.scale * Math.exp(-e.deltaY * 0.001));
      viewport.scale = nextScale;
      viewport.x = screen.x - world.x * viewport.scale;
      viewport.y = screen.y - world.y * viewport.scale;
      setHint(`表示倍率: ${formatZoom(viewport.scale)}`);
      draw();
    },
    { passive: false },
  );

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    const commandKey = e.ctrlKey || e.metaKey;
    const textEditingTarget = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target?.isContentEditable;
    if (e.code === "Space" && !textEditingTarget && !constraintStatusSpaceHeld) {
      e.preventDefault();
      constraintStatusSpaceHeld = true;
      syncConstraintStatusView();
      return;
    }
    if (commandKey && isGeometryMode() && !textEditingTarget && ["c", "x", "v"].includes(key)) {
      e.preventDefault();
      if (key === "c") copySelectionToClipboard();
      else if (key === "x") copySelectionToClipboard({ cut: true });
      else pasteGeometryClipboard();
      return;
    }
    if (commandKey && key === "z" && !e.shiftKey) {
      e.preventDefault();
      undoHistory();
      return;
    }
    if (commandKey && (key === "y" || (key === "z" && e.shiftKey))) {
      e.preventDefault();
      redoHistory();
      return;
    }

    if (handleDistanceKey(e)) return;

    if (!textEditingTarget && (e.key === "Delete" || e.key === "Backspace") && isGeometryMode() && deleteCurrentSelection()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && completePendingDimensionLineLength()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (mode === "block-place") {
        if (blockPlacementAnchor) commitBlockPlacement(0);
        else {
          blockPlacementDefinitionId = null;
          blockPlacementAnchor = null;
          blockPlacementEnabledSketchIds = [];
          blockPlacementRotationLocked = true;
          pointerPreview = null;
          mode = "select";
          setHint("ブロック配置をキャンセルしました");
          updateUI();
          draw();
        }
        return;
      }
      if (pendingCommand) {
        cancelPendingCommand();
        return;
      }
      if (pendingConstraintCommand) {
        cancelConstraintTargetCommand();
        return;
      }
      if (hasActiveDrawOperation()) {
        cancelActiveDrawOperation();
        return;
      }
      if (mode === "line" || mode === "point" || mode === "rectangle" || mode === "fillet" || mode === "trim" || mode === "offset" || mode === "circle" || mode === "arc") {
        exitDrawMode();
        return;
      }
      if (
        selectedPoints.length > 0 ||
        selectedLines.length > 0 ||
        selectedCircles.length > 0 ||
        selectedArcs.length > 0 ||
        selectedBlockInstances.length > 0 ||
        selectedArcEndpoint ||
        selectedDimensionConstraint ||
        selectedAnnotation ||
        effectiveSelectedConstraint()
      ) {
        clearSelection();
        setHint("選択を解除しました");
        updateUI();
        draw();
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code !== "Space" || !constraintStatusSpaceHeld) return;
    e.preventDefault();
    constraintStatusSpaceHeld = false;
    syncConstraintStatusView();
  });
  window.addEventListener("blur", () => {
    if (!constraintStatusSpaceHeld) return;
    constraintStatusSpaceHeld = false;
    syncConstraintStatusView({ hint: false });
  });

  document.getElementById("undoBtn")?.addEventListener("click", undoHistory);
  document.getElementById("redoBtn")?.addEventListener("click", redoHistory);
  document.getElementById("deleteSelectionBtn")?.addEventListener("click", () => {
    if (!isGeometryMode()) return;
    if (deleteCurrentSelection()) {
      updateUI();
      draw();
    }
  });
  document.getElementById("annotationLeaderBtn")?.addEventListener("click", createLeaderAnnotation);
  document.getElementById("annotationTextBtn")?.addEventListener("click", createTextAnnotation);
  document.getElementById("constraintStatusViewBtn")?.addEventListener("click", () => {
    constraintStatusMouseLatched = !constraintStatusMouseLatched;
    syncConstraintStatusView();
  });
  document.getElementById("viewGeometryIdsInput")?.addEventListener("change", (event) => {
    viewState.geometryIds = event.target.checked;
    draw();
  });
  function parameterScopeOptions() {
    if (blockEditSession) return [{ key: `block:${blockEditSession.draft.id}`, label: `${applicationText("ブロック", "Block")}: ${blockEditSession.draft.name}`, namespace: model }];
    return [
      { key: "document", label: "Document", namespace: model },
      ...model.blockDefinitions.map((definition) => ({ key: `block:${definition.id}`, label: `${applicationText("ブロック", "Block")}: ${definition.name}`, namespace: definition })),
    ];
  }

  function parameterScopeForKey(key) {
    return parameterScopeOptions().find((option) => option.key === key) || parameterScopeOptions()[0] || null;
  }

  function parameterDraftSignature(session = parameterDialogSession) {
    if (!session) return "";
    return JSON.stringify({
      parameters: session.parameters.map(({ name, expression }) => ({ name, expression })),
      dimensions: session.dimensions.map(({ name, expression, readOnly }) => ({ name, expression: readOnly ? null : expression, readOnly })),
    });
  }

  function parameterDialogIsDirty() {
    return Boolean(parameterDialogSession && parameterDraftSignature() !== parameterDialogSession.originalSignature);
  }

  function createParameterDialogSession(scope) {
    ensureParameterNamespace(scope.namespace);
    const dimensions = dimensionConstraintsInNamespace(scope.namespace).map((constraint) => ({
      constraint,
      name: constraint.parameterName,
      committedName: constraint.parameterName,
      expression: isReadOnlyDimension(constraint) ? "" : constraint.expression,
      readOnly: isReadOnlyDimension(constraint),
    }));
    const session = {
      key: scope.key,
      namespace: scope.namespace,
      parameters: scope.namespace.parameters.map((parameter) => ({ name: parameter.name, committedName: parameter.name, expression: parameter.expression, isNew: false })),
      dimensions,
    };
    session.originalSignature = parameterDraftSignature(session);
    return session;
  }

  function parameterDraftEvaluation(session = parameterDialogSession) {
    validateParameterSymbolNames(session.parameters, session.dimensions);
    const inputValues = new Map();
    const definitions = session.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression, kind: "parameter" }));
    for (const dimension of session.dimensions) {
      if (dimension.readOnly) {
        const target = targetFromConstraint(dimension.constraint);
        inputValues.set(dimension.name, measuredDimensionValue(target, dimension.constraint.dimension));
      } else {
        definitions.push({ name: dimension.name, expression: dimension.expression, kind: "dimension" });
      }
    }
    return evaluateParameterDefinitions(definitions, inputValues);
  }

  function setParameterDialogError(message = "") {
    const error = document.getElementById("parameterDialogError");
    if (!error) return;
    error.hidden = !message;
    error.textContent = message;
  }

  function parameterDimensionSource(dimension, namespace) {
    const constraint = dimension.constraint;
    const sketchId = constraint.sketchId || DEFAULT_SKETCH_ID;
    const sketch = (namespace.sketches || []).find((item) => item.id === sketchId);
    const kind = isReadOnlyDimension(constraint) ? applicationText("参照寸法", "Reference dimension") : applicationText("拘束寸法", "Driving dimension");
    return `${kind} / ${sketch?.name || sketchId}`;
  }

  function renderParameterDialog() {
    const session = parameterDialogSession;
    if (!session) return;
    const scopeSelect = document.getElementById("parameterScopeSelect");
    if (scopeSelect) {
      scopeSelect.innerHTML = parameterScopeOptions().map((option) => `<option value="${escapeHtml(option.key)}" ${option.key === session.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
      scopeSelect.disabled = Boolean(blockEditSession);
    }
    let evaluation = null;
    let evaluationError = null;
    try {
      evaluation = parameterDraftEvaluation(session);
    } catch (error) {
      evaluationError = error;
    }
    const parameterRows = document.getElementById("parameterRows");
    if (parameterRows) parameterRows.innerHTML = session.parameters.length > 0
      ? session.parameters.map((parameter, index) => `<tr><td><input data-parameter-row="${index}" data-parameter-field="name" value="${escapeHtml(parameter.name)}"></td><td><input data-parameter-row="${index}" data-parameter-field="expression" value="${escapeHtml(parameter.expression)}"></td><td class="parameter-value">${escapeHtml(formatDisplayNumber(evaluation?.values.get(parameter.name)))}</td><td class="parameter-delete-cell"><button class="compact-button" type="button" data-delete-parameter="${index}">${applicationText("削除", "Delete")}</button></td></tr>`).join("")
      : `<tr><td colspan="4" class="parameter-source">${applicationText("Parameterはありません", "No parameters")}</td></tr>`;
    const dimensionRows = document.getElementById("parameterDimensionRows");
    if (dimensionRows) dimensionRows.innerHTML = session.dimensions.length > 0
      ? session.dimensions.map((dimension, index) => `<tr><td><input data-dimension-row="${index}" data-dimension-field="name" value="${escapeHtml(dimension.name)}"></td><td class="parameter-source">${escapeHtml(parameterDimensionSource(dimension, session.namespace))}</td><td><input data-dimension-row="${index}" data-dimension-field="expression" value="${escapeHtml(dimension.readOnly ? applicationText("Geometryから測定", "Measured from geometry") : dimension.expression)}" ${dimension.readOnly ? "readonly" : ""}></td><td class="parameter-value">${escapeHtml(formatDisplayNumber(evaluation?.values.get(dimension.name)))}</td></tr>`).join("")
      : `<tr><td colspan="4" class="parameter-source">${applicationText("寸法はありません", "No dimensions")}</td></tr>`;
    setParameterDialogError(evaluationError ? parameterErrorText(evaluationError) : "");
    localizeApplicationUI(document.getElementById("parametersDialog"));
  }

  function rewriteParameterDraftName(oldName, nextName) {
    if (!oldName || oldName === nextName) return;
    const replacements = new Map([[oldName, nextName]]);
    for (const parameter of parameterDialogSession.parameters) parameter.expression = rewriteParameterIdentifiers(parameter.expression, replacements);
    for (const dimension of parameterDialogSession.dimensions) if (!dimension.readOnly) dimension.expression = rewriteParameterIdentifiers(dimension.expression, replacements);
  }

  function loadParameterDialogScope(key) {
    const scope = parameterScopeForKey(key);
    if (!scope) return false;
    parameterDialogSession = createParameterDialogSession(scope);
    renderParameterDialog();
    return true;
  }

  function withStoredDefinitionAsModel(definition, callback) {
    const saved = {
      points: model.points, lines: model.lines, circles: model.circles, arcs: model.arcs,
      constraints: model.constraints, parameters: model.parameters, nextDimensionParameterIndex: model.nextDimensionParameterIndex,
      blockInstances: model.blockInstances, sketches: model.sketches, activeSketchId: model.activeSketchId,
    };
    model.points = definition.points;
    model.lines = definition.lines;
    model.circles = definition.circles;
    model.arcs = definition.arcs;
    model.constraints = definition.constraints;
    model.parameters = definition.parameters;
    model.nextDimensionParameterIndex = definition.nextDimensionParameterIndex;
    model.blockInstances = definition.blockInstances || [];
    model.sketches = definition.sketches;
    model.activeSketchId = definition.activeSketchId;
    try {
      return callback();
    } finally {
      definition.points = model.points;
      definition.lines = model.lines;
      definition.circles = model.circles;
      definition.arcs = model.arcs;
      definition.constraints = model.constraints;
      definition.parameters = model.parameters;
      definition.nextDimensionParameterIndex = model.nextDimensionParameterIndex;
      definition.blockInstances = model.blockInstances;
      definition.sketches = model.sketches;
      definition.activeSketchId = model.activeSketchId;
      Object.assign(model, saved);
    }
  }

  function stabilizeStoredBlockDefinition(definition) {
    return withStoredDefinitionAsModel(definition, () => stabilizeActiveParameterNamespace(definition.activeSketchId, { allSketches: blockDefinitionDrawableSketchIds(definition) }));
  }

  function rebuildRootConstraintObjects() {
    const pointById = new Map(model.points.map((point) => [point.id, point]));
    const lineById = new Map(model.lines.map((line) => [line.id, line]));
    const primitiveById = new Map([...model.circles, ...model.arcs].map((primitive) => [primitive.id, primitive]));
    for (const bundle of blockProjectionBundles()) addBlockProjectionElementsToMaps(bundle, pointById, lineById, primitiveById);
    model.constraints = model.constraints.map((source) => {
      const data = decorateSerializedConstraint(serializeConstraint(source), source);
      const constraint = data ? deserializeConstraint(data, pointById, lineById, primitiveById) : null;
      if (!constraint) throw new Error(applicationText("Document拘束を再構築できません", "Document constraints could not be rebuilt"));
      constraint.sketchId = source.sketchId;
      constraint.reference = Boolean(source.reference);
      constraint.referenceSketchId = source.referenceSketchId || null;
      return constraint;
    });
    clearSelection();
  }

  function propagateBlockParameterChange(definition) {
    definition.revision = (Number(definition.revision) || 0) + 1;
    invalidateBlockProjectionCache();
    let parentId = definition.parentDefinitionId || null;
    while (parentId) {
      const parent = blockDefinitionById(parentId);
      if (!parent) throw new Error(applicationText("親Block Definitionが見つかりません", "Parent block definition was not found"));
      rebuildBlockDefinitionConstraintObjects(parent);
      const result = stabilizeStoredBlockDefinition(parent);
      if (!result.success || result.dependent?.success === false) throw new Error(result.result.reason || applicationText("親Blockの拘束が成立しません", "Parent block constraints could not be satisfied"));
      parent.revision = (Number(parent.revision) || 0) + 1;
      parentId = parent.parentDefinitionId || null;
      invalidateBlockProjectionCache();
    }
    rebuildRootConstraintObjects();
    const rootResult = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: model.sketches.filter((sketch) => !isRootSketch(sketch)).map((sketch) => sketch.id) });
    if (!rootResult.success || rootResult.dependent?.success === false) throw new Error(rootResult.result.reason || applicationText("Document拘束が成立しません", "Document constraints could not be satisfied"));
  }

  function applyParameterDialogDraft() {
    const session = parameterDialogSession;
    if (!session) return false;
    const documentSnapshot = blockEditSession ? null : historySnapshot();
    const localSnapshot = blockEditSession ? snapshotModelState() : null;
    try {
      session.namespace.parameters = session.parameters.map((parameter) => ({ name: parameter.name.trim(), expression: parameter.expression.trim() }));
      session.dimensions.forEach((dimension) => {
        dimension.constraint.parameterName = dimension.name.trim();
        if (!dimension.readOnly) dimension.constraint.expression = dimension.expression.trim();
      });
      ensureParameterNamespace(session.namespace);
      let result;
      if (session.namespace === model) {
        result = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: model.sketches.filter((sketch) => !isRootSketch(sketch)).map((sketch) => sketch.id) });
      } else {
        result = stabilizeStoredBlockDefinition(session.namespace);
      }
      if (!result.success || result.dependent?.success === false || result.result.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
        throw new Error(result.result.reason || applicationText("拘束が成立しません", "Constraints could not be satisfied"));
      }
      if (session.namespace !== model) propagateBlockParameterChange(session.namespace);
      recordHistory("Parameter変更");
      setHint(applicationText("Parameterを適用しました", "Parameters applied"));
      loadParameterDialogScope(session.key);
      updateUI();
      draw();
      return true;
    } catch (error) {
      if (blockEditSession && localSnapshot) restoreModelState(localSnapshot);
      else if (documentSnapshot) loadModelData(JSON.parse(documentSnapshot), { documentNameFallback: model.documentName });
      const scopeKey = session.key;
      loadParameterDialogScope(scopeKey);
      setParameterDialogError(parameterErrorText(error));
      setHint(parameterErrorText(error), "error");
      updateUI();
      draw();
      return false;
    }
  }

  function resolveDirtyParameterDialog() {
    if (!parameterDialogIsDirty()) return true;
    if (window.confirm(applicationText("未適用の変更を適用しますか？", "Apply the pending changes?"))) return applyParameterDialogDraft();
    return window.confirm(applicationText("未適用の変更を破棄しますか？", "Discard the pending changes?"));
  }

  function openParametersDialog() {
    const options = parameterScopeOptions();
    if (options.length === 0) return;
    loadParameterDialogScope(options[0].key);
    const dialog = document.getElementById("parametersDialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  const appMenus = Array.from(document.querySelectorAll(".app-menu"));
  let appMenuHoverTimer = null;
  function cancelAppMenuHoverSwitch() {
    if (appMenuHoverTimer == null) return;
    window.clearTimeout(appMenuHoverTimer);
    appMenuHoverTimer = null;
  }
  function closeAppMenus(except = null) {
    cancelAppMenuHoverSwitch();
    for (const menu of appMenus) {
      if (menu !== except) menu.removeAttribute("open");
    }
  }
  for (const menu of appMenus) {
    const summary = menu.querySelector(":scope > summary");
    summary?.addEventListener("click", () => closeAppMenus(menu));
    summary?.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      if (!appMenus.some((item) => item !== menu && item.open)) return;
      cancelAppMenuHoverSwitch();
      appMenuHoverTimer = window.setTimeout(() => {
        appMenuHoverTimer = null;
        if (!appMenus.some((item) => item !== menu && item.open)) return;
        closeAppMenus(menu);
        menu.setAttribute("open", "");
        summary.focus({ preventScroll: true });
      }, 16);
    });
    summary?.addEventListener("pointerleave", cancelAppMenuHoverSwitch);
    summary?.addEventListener("pointerdown", cancelAppMenuHoverSwitch);
    menu.addEventListener("toggle", () => {
      if (menu.open) closeAppMenus(menu);
    });
  }
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".app-menus")) closeAppMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openMenu = appMenus.find((menu) => menu.open);
    if (!openMenu) return;
    event.preventDefault();
    event.stopPropagation();
    closeAppMenus();
    openMenu.querySelector(":scope > summary")?.focus();
  });
  window.addEventListener("blur", () => closeAppMenus());
  for (const button of document.querySelectorAll("[data-menu-tool]")) {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.menuTool)?.click();
      button.closest("details")?.removeAttribute("open");
    });
  }
  document.querySelector(".app-menus")?.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    button?.closest("details")?.removeAttribute("open");
  });
  for (const button of document.querySelectorAll("[data-explorer-tab]")) {
    button.addEventListener("click", () => {
      const target = button.dataset.explorerTab;
      for (const panel of document.querySelectorAll("[data-explorer-panel]")) {
        panel.hidden = panel.dataset.explorerPanel !== target;
      }
      for (const tab of document.querySelectorAll("[data-explorer-tab]")) {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      }
    });
  }
  document.getElementById("toggleExplorerPanelBtn")?.addEventListener("click", () => {
    const workspace = document.querySelector(".workspace");
    setWorkspacePanelCollapsed("explorer", !workspace?.classList.contains("explorer-collapsed"));
  });
  document.getElementById("togglePropertiesPanelBtn")?.addEventListener("click", () => {
    const workspace = document.querySelector(".workspace");
    setWorkspacePanelCollapsed("properties", !workspace?.classList.contains("properties-collapsed"));
  });
  for (const panel of document.querySelectorAll(".object-explorer-panel")) {
    panel.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      const row = event.target.closest("[data-object-kind], .geometry-list-row, .constraint-list-row");
      if (!row) return;
      clearSelection();
      if (row.dataset.objectKind === "block") selectedBlockInstances = model.blockInstances.filter((item) => item.id === row.dataset.id);
      else if (row.dataset.objectKind === "annotation") selectedAnnotation = model.annotations.find((item) => item.id === row.dataset.id) || null;
      else if (row.classList.contains("constraint-list-row")) selectedConstraint = model.constraints[Number(row.dataset.idx)] || null;
      else {
        const kind = row.dataset.kind;
        if (kind === "point") selectedPoints = model.points.filter((item) => item.id === row.dataset.id);
        if (kind === "line") selectedLines = model.lines.filter((item) => item.id === row.dataset.id);
        if (kind === "circle") selectedCircles = model.circles.filter((item) => item.id === row.dataset.id);
        if (kind === "arc") selectedArcs = model.arcs.filter((item) => item.id === row.dataset.id);
      }
      updateUI();
      draw();
    });
    panel.addEventListener("pointerover", (event) => {
      const row = event.target.closest("[data-object-kind]");
      if (!row) return;
      if (row.dataset.objectKind === "block") hoveredBlockInstance = model.blockInstances.find((item) => item.id === row.dataset.id) || null;
      if (row.dataset.objectKind === "annotation") hoveredAnnotation = model.annotations.find((item) => item.id === row.dataset.id) || null;
      draw();
    });
    panel.addEventListener("pointerout", (event) => {
      if (!event.target.closest("[data-object-kind]")) return;
      hoveredBlockInstance = null;
      hoveredAnnotation = null;
      draw();
    });
  }
  document.getElementById("parametersBtn")?.addEventListener("click", openParametersDialog);
  document.getElementById("parameterScopeSelect")?.addEventListener("change", (event) => {
    const previousKey = parameterDialogSession?.key;
    if (!resolveDirtyParameterDialog()) {
      event.target.value = previousKey;
      return;
    }
    loadParameterDialogScope(event.target.value);
  });
  document.getElementById("parametersForm")?.addEventListener("input", (event) => {
    if (!parameterDialogSession) return;
    const input = event.target;
    if (input.dataset.parameterRow != null) {
      const row = parameterDialogSession.parameters[Number(input.dataset.parameterRow)];
      if (row) row[input.dataset.parameterField] = input.value;
    }
    if (input.dataset.dimensionRow != null) {
      const row = parameterDialogSession.dimensions[Number(input.dataset.dimensionRow)];
      if (row && !(row.readOnly && input.dataset.dimensionField === "expression")) row[input.dataset.dimensionField] = input.value;
    }
  });
  document.getElementById("parametersForm")?.addEventListener("change", (event) => {
    if (!parameterDialogSession) return;
    const input = event.target;
    let row = null;
    if (input.dataset.parameterRow != null) row = parameterDialogSession.parameters[Number(input.dataset.parameterRow)];
    if (input.dataset.dimensionRow != null) row = parameterDialogSession.dimensions[Number(input.dataset.dimensionRow)];
    const isName = input.dataset.parameterField === "name" || input.dataset.dimensionField === "name";
    if (row && isName) {
      rewriteParameterDraftName(row.committedName, row.name);
      row.committedName = row.name;
    }
    if (input.id !== "parameterScopeSelect") renderParameterDialog();
  });
  document.getElementById("parametersForm")?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-parameter]");
    if (!deleteButton || !parameterDialogSession) return;
    const index = Number(deleteButton.dataset.deleteParameter);
    const parameter = parameterDialogSession.parameters[index];
    if (!parameter) return;
    const dependencies = [];
    for (const item of [
      ...parameterDialogSession.parameters.filter((_, itemIndex) => itemIndex !== index),
      ...parameterDialogSession.dimensions.filter((dimension) => !dimension.readOnly),
    ]) {
      try {
        if (expressionDependencies(item.expression).has(parameter.name)) dependencies.push(item.name);
      } catch (_error) {
        // The complete draft validation reports unrelated syntax errors.
      }
    }
    if (dependencies.length > 0) {
      setParameterDialogError(applicationLanguage === "en" ? `${parameter.name} is referenced by ${dependencies.join(", ")}` : `${parameter.name} は ${dependencies.join("、")} から参照されています`);
      return;
    }
    parameterDialogSession.parameters.splice(index, 1);
    renderParameterDialog();
  });
  document.getElementById("addParameterBtn")?.addEventListener("click", () => {
    if (!parameterDialogSession) return;
    const used = new Set([...parameterDialogSession.parameters.map((item) => item.name), ...parameterDialogSession.dimensions.map((item) => item.name)]);
    let index = 1;
    while (used.has(`parameter${index}`)) index += 1;
    const name = `parameter${index}`;
    parameterDialogSession.parameters.push({ name, committedName: name, expression: "0", isNew: true });
    renderParameterDialog();
  });
  document.getElementById("applyParametersBtn")?.addEventListener("click", applyParameterDialogDraft);
  document.getElementById("discardParametersBtn")?.addEventListener("click", () => loadParameterDialogScope(parameterDialogSession?.key));
  document.getElementById("parametersCloseBtn")?.addEventListener("click", () => {
    if (!resolveDirtyParameterDialog()) return;
    document.getElementById("parametersDialog")?.close();
  });
  document.getElementById("parametersDialog")?.addEventListener("cancel", (event) => {
    if (!resolveDirtyParameterDialog()) event.preventDefault();
  });
  document.getElementById("parametersDialog")?.addEventListener("close", () => {
    parameterDialogSession = null;
  });
  document.getElementById("documentSettingsBtn")?.addEventListener("click", () => {
    const fields = document.getElementById("documentAppearanceFields");
    if (fields) {
      const effective = normalizeAppearance(model.defaultAppearance, { partial: false });
      fields.innerHTML = appearancePropertyRows(effective, effective, { allowInheritance: false, idPrefix: "documentProperty" });
      localizeApplicationUI(fields);
      fields.onchange = (event) => {
        const input = event.target;
        if (!input.dataset.appearanceKey) return;
        applyAppearanceInput(model.defaultAppearance, input.dataset.appearanceKey, input.value.trim());
        model.defaultAppearance = normalizeAppearance(model.defaultAppearance, { partial: false });
        recordHistory("Document Default Appearance変更");
        draw();
      };
      fields.onclick = (event) => {
        const button = event.target.closest("[data-appearance-palette-open]");
        if (!button) return;
        openAppearanceColorPalette(button, "document");
      };
    }
    const constructionFields = document.getElementById("documentConstructionAppearanceFields");
    if (constructionFields) {
      const construction = normalizeConstructionAppearance(model.defaultConstructionAppearance, { partial: false });
      const effective = { ...normalizeAppearance(model.defaultAppearance, { partial: false }), ...construction };
      constructionFields.innerHTML = appearancePropertyRows(construction, effective, {
        allowInheritance: false,
        constructionEndpoints: true,
        idPrefix: "constructionProperty",
      });
      localizeApplicationUI(constructionFields);
      constructionFields.onchange = (event) => {
        const input = event.target;
        if (!input.dataset.appearanceKey) return;
        applyAppearanceInput(model.defaultConstructionAppearance, input.dataset.appearanceKey, input.value.trim());
        model.defaultConstructionAppearance = normalizeConstructionAppearance(model.defaultConstructionAppearance, { partial: false });
        recordHistory("Document Default Construction Appearance変更");
        draw();
      };
      constructionFields.onclick = (event) => {
        const button = event.target.closest("[data-appearance-palette-open]");
        if (!button) return;
        openAppearanceColorPalette(button, "document-construction");
      };
    }
    document.getElementById("documentSettingsDialog")?.showModal();
  });
  document.getElementById("colorPaletteDialog")?.addEventListener("click", (event) => {
    const swatch = event.target.closest("[data-palette-color]");
    if (swatch) commitColorPaletteValue(swatch.dataset.paletteColor);
  });
  document.getElementById("applyCustomColorBtn")?.addEventListener("click", () => {
    commitColorPaletteValue(document.getElementById("customColorPicker")?.value);
  });
  document.getElementById("colorPaletteDialog")?.addEventListener("close", () => {
    colorPaletteSession = null;
  });
  document.getElementById("applicationSettingsBtn")?.addEventListener("click", () => {
    const select = document.getElementById("applicationLanguageSelect");
    if (select) select.value = applicationLanguage;
    document.getElementById("applicationSettingsDialog")?.showModal();
  });
  document.getElementById("applicationLanguageSelect")?.addEventListener("change", (event) => {
    setApplicationLanguage(event.target.value);
    draw();
  });
  document.getElementById("openBlockDefinitionsBtn")?.addEventListener("click", () => {
    updateBlockUI();
    const dialog = document.getElementById("blockDefinitionsDialog");
    if (dialog && !dialog.open) {
      localizeApplicationUI(dialog);
      dialog.showModal();
    }
  });
  document.getElementById("completeBlockEditBtn")?.addEventListener("click", completeBlockDefinitionEdit);
  document.getElementById("cancelBlockEditBtn")?.addEventListener("click", cancelBlockDefinitionEdit);
  document.getElementById("blockEditorNameInput")?.addEventListener("input", (event) => {
    if (!blockEditSession) return;
    blockEditSession.draft.name = event.target.value || blockEditSession.draft.name;
    const title = document.getElementById("blockOverlayTitle");
    if (title) title.textContent = "ブロックエディタ";
  });
  document.getElementById("blockEditorNameInput")?.addEventListener("change", () => {
    if (blockEditSession) recordHistory("ブロック名変更");
  });

  document.getElementById("toolSelect").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "select";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("選択・ドラッグできます。Shift/Ctrlクリックで複数選択できます。");
    draw();
  });

  document.getElementById("toolPoint").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "point";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("キャンバスをクリックして点を追加します。");
    draw();
  });

  document.getElementById("toolLine").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "line";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("端点位置をクリックして連続線を作成します。終了はEscです。");
    draw();
  });

  document.getElementById("toolConstructionLine")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    const primitives = selectedConstructionTogglePrimitives();
    if (primitives.length > 0) {
      const next = !primitives.every((item) => item.construction);
      for (const item of primitives) item.construction = next;
      setHint(next ? "選択図形を補助作図にしました" : "選択図形を通常作図にしました");
      clearSelection();
      updateUI();
      draw();
      recordHistory("補助線切替");
      return;
    }
    mode = "line";
    constructionLineMode = !constructionLineMode;
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint(constructionLineMode ? "補助線作図: 端点位置をクリックしてください" : "通常線作図に戻しました");
    draw();
  });

  document.getElementById("toolRectangle")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "rectangle";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("矩形の1つ目の角をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolFillet")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    if (selectedLines.length === 2) {
      startFilletRadiusInput(selectedLines[0], selectedLines[1]);
      filletFirstLine = null;
      return;
    }
    mode = "fillet";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("R面取りする接続線を2本クリックしてください");
    draw();
  });

  document.getElementById("toolTrim")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "trim";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    offsetSource = null;
    hoveredPoint = null;
    hoveredEndpointPoint = null;
    hoveredLine = null;
    hoveredCircle = null;
    hoveredArcEndpoint = null;
    hoveredArc = null;
    hoveredDimensionConstraint = null;
    clearSnap();
    updateToolbar();
    setHint("トリムする線、円、円弧の削除したい区間をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolCreateBlock")?.addEventListener("click", startBlockCreation);

  document.getElementById("toolOffset")?.addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    cancelPendingCommand("");
    mode = "offset";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    trimPreview = null;
    const selected = [...selectedLines, ...selectedCircles, ...selectedArcs];
    offsetSource = selected.length === 1 ? selected[0] : null;
    if (!offsetSource) clearSelection();
    clearSnap();
    updateToolbar();
    setHint(offsetSource ? "オフセットする側と距離の目安をクリックしてください" : "オフセットする線、円、円弧をクリックしてください");
    updateUI();
    draw();
  });

  document.getElementById("toolCircle").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "circle";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("円の中心をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("toolArc").addEventListener("click", () => {
    cancelConstraintTargetCommand("");
    mode = "arc";
    lineStartPoint = null;
    rectangleStartPoint = null;
    filletFirstLine = null;
    circleCenterPoint = null;
    arcCenterPoint = null;
    arcStartPoint = null;
    pointerPreview = null;
    clearSnap();
    updateToolbar();
    setHint("円弧の中心をクリックしてください。Escで選択モードに戻ります");
    draw();
  });

  document.getElementById("exportBtn").addEventListener("click", exportFileData);
  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });
  document.getElementById("importFileInput").addEventListener("change", (e) => {
    importFileData(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("addSketchBtn")?.addEventListener("click", () => createSketch("sibling"));
  document.getElementById("addChildSketchBtn")?.addEventListener("click", () => createSketch("child"));

  document.getElementById("toggleSideBtn")?.addEventListener("click", () => {
    const app = document.querySelector(".app");
    const isCollapsed = app?.classList.contains("side-collapsed");
    setSidebarCollapsed(!isCollapsed, isCollapsed ? "サイドバーを表示しました" : "サイドバーをたたみました");
  });

  for (const button of document.querySelectorAll("[data-sidebar-tab]")) {
    button.addEventListener("click", () => {
      const app = document.querySelector(".app");
      const isCollapsed = app?.classList.contains("side-collapsed");
      const isActive = button.classList.contains("active");
      if (isActive && !isCollapsed) {
        setSidebarCollapsed(true);
        return;
      }
      activateSidebarTab(button.dataset.sidebarTab);
      setSidebarCollapsed(false);
    });
  }

  for (const btn of constraintButtons) {
    btn.addEventListener("click", () => {
      const type = btn.dataset.constraint;
      if (pendingConstraintCommand?.type === type) {
        cancelConstraintTargetCommand(`${constraintLabel(type)}の対象選択をキャンセルしました`);
      } else if (type === "symmetry") {
        startConstraintTargetCommand(type);
      } else if (canApplyConstraint(type)) {
        cancelConstraintTargetCommand("");
        if (type === "distance") startDistanceCommand();
        else {
          cancelPendingCommand("");
          pendingConstraintCommand = { type };
          updateToolbar();
          updateConstraintButtons();
          addConstraint(type);
        }
      } else {
        startConstraintTargetCommand(type);
      }
    });
  }

  fixPointBtn.addEventListener("click", () => {
    const projectedSelection = [...selectedPoints, ...selectedLines, ...selectedCircles, ...selectedArcs].filter((item) => item?.blockProjection);
    const projectedInstances = [...new Set(projectedSelection.map((item) => item.blockInstance))];
    const instance = selectedBlockInstances.length === 1
      ? selectedBlockInstances[0]
      : projectedSelection.length > 0 && projectedInstances.length === 1 && projectedSelection.length === selectedPoints.length + selectedLines.length + selectedCircles.length + selectedArcs.length
        ? projectedInstances[0]
        : null;
    if (instance) {
      instance.fixed = !instance.fixed;
      setHint(`${blockDefinitionById(instance.definitionId)?.name || instance.id} を${instance.fixed ? "固定" : "固定解除"}しました`);
      clearSelection();
      updateUI();
      draw();
      recordHistory("ブロック固定切替");
      return;
    }
    if (selectedArcEndpoint) {
      const { arc, endpoint } = selectedArcEndpoint;
      const existing = findArcEndpointFixedConstraint(arc, endpoint);
      if (existing) {
        deleteElements({ constraints: [existing] });
        log(`${arc.id}.${endpoint} の固定を解除しました`);
        return;
      }
      const p = arcEndpointPoint(arc, endpoint);
      commitNewConstraint("fixed", new ArcEndpointFixedConstraint(arc, endpoint, p.x, p.y));
      return;
    }
    if (selectedPoints.length === 0 && selectedLines.length === 1 && selectedCircles.length === 0 && selectedArcs.length === 0) {
      const line = selectedLines[0];
      const existing = findLineFixedConstraint(line);
      if (existing) {
        deleteElements({ constraints: [existing] });
        log(`${line.id} の固定を解除しました`);
        return;
      }
      commitNewConstraint("fixed", new LineFixedConstraint(line));
      return;
    }
    if (selectedPoints.length < 1 || selectedLines.length > 0 || selectedCircles.length > 0 || selectedArcs.length > 0) return;
    const points = [...selectedPoints];
    const sketchId = elementSketchId(points[0]);
    if (!points.every((point) => elementSketchId(point) === sketchId)) return;
    const snapshot = snapshotModelState();
    const nextFixed = !points.every((point) => point.fixed);
    for (const point of points) point.fixed = nextFixed;
    const solved = solveSketchAndDependents(sketchId, snapshot);
    const fixedResult = solved.result;
    if (!solved.success || fixedResult.errorNorm > CONSTRAINT_ACCEPT_ERROR) {
      restoreModelState(snapshot);
      setHint(`子スケッチ内で固定状態を変更できません (error=${fixedResult.errorNorm.toExponential(3)})`, "error");
      updateUI();
      draw();
      return;
    }
    refreshConstraintAnalysis();
    setHint(`固定状態変更: success=${fixedResult.success}, error=${fixedResult.errorNorm.toExponential(2)}, iter=${fixedResult.iterations}`);
    updateUI({ refreshAnalysis: false });
    draw();
    log(`${points.map((point) => point.id).join(", ")} の固定状態を ${nextFixed} にしました\n自動solve: success=${fixedResult.success}`);
    return;
  });

  window.addEventListener("resize", () => {
    resizeCanvas({ centerWorld: currentCanvasCenterWorld() });
  });

  function installTestHooks() {
    if (!new URLSearchParams(window.location.search).has("test")) return;
    window.__cadTest = {
      commitConstraintWithForcedSolveResultForTest(forcedResult) {
        resetModelState();
        const p1 = addPoint(0, 0, true, "endpoint");
        const p2 = addPoint(10, 0, false, "endpoint");
        const constraint = new DistanceConstraint(p1, p2, 10);
        const solveSubset = solver.solveSubset;
        solver.solveSubset = () => ({
          success: Boolean(forcedResult?.success),
          errorNorm: Number(forcedResult?.errorNorm),
          iterations: Number(forcedResult?.iterations) || 0,
          reason: String(forcedResult?.reason || "test"),
          variableCount: 2,
          constraintCount: 1,
        });
        let committed = false;
        try {
          committed = commitNewConstraint("distance", constraint) === true;
        } finally {
          solver.solveSubset = solveSubset;
        }
        const hint = document.getElementById("hint");
        return {
          committed,
          constraintCount: model.constraints.length,
          hint: hint?.textContent || "",
          hintIsError: Boolean(hint?.classList.contains("error")),
        };
      },
      resetForGeometryClipboardTest() {
        resetModelState();
        geometryClipboard = null;
        viewport.scale = 1;
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        const p1 = addPoint(-120, -30, true, "endpoint");
        const p2 = addPoint(-20, -30, false, "endpoint");
        const line = addLine(p1, p2, true);
        const circleCenter = addPoint(50, -30, false, "endpoint");
        const circle = addCircle(circleCenter, 25);
        const arcCenter = addPoint(125, -30, false, "endpoint");
        const arc = addArc(arcCenter, 30, 0, Math.PI * 1.5);
        const standalone = addPoint(205, -30, false, "explicit");
        const external = addPoint(-20, 40, false, "explicit");
        pushModelConstraint(new HorizontalConstraint(line));
        const length = pushModelConstraint(new DistanceConstraint(p1, p2, 100));
        length.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 100 }, { x: -70, y: -58 });
        pushModelConstraint(new RadiusConstraint(circle, 25));
        pushModelConstraint(new EqualRadiusConstraint(circle, arc));
        pushModelConstraint(new PointVerticalConstraint(p2, external));
        pushModelConstraint(new LineFixedConstraint(line, p1.x, p1.y, p2.x, p2.y));
        const fixedArcEndpoint = arcEndpointPoint(arc, "start");
        pushModelConstraint(new ArcEndpointFixedConstraint(arc, "start", fixedArcEndpoint.x, fixedArcEndpoint.y));
        selectedPoints = [standalone];
        selectedLines = [line];
        selectedCircles = [circle];
        selectedArcs = [arc];
        resetHistory("clipboard geometry test");
        updateUI();
        draw();
        return this.clipboardStateForTest();
      },
      resetForBlockClipboardTest() {
        resetModelState();
        geometryClipboard = null;
        viewport.scale = 1;
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        const definition = createEmptyBlockDefinition("Clipboard Block");
        const bp1 = new Point("BP1", 0, 0, false, "endpoint");
        const bp2 = new Point("BP2", 80, 0, false, "endpoint");
        bp1.sketchId = DEFAULT_SKETCH_ID;
        bp2.sketchId = DEFAULT_SKETCH_ID;
        const blockLine = new Line("BL1", bp1, bp2);
        blockLine.sketchId = DEFAULT_SKETCH_ID;
        definition.points.push(bp1, bp2);
        definition.lines.push(blockLine);
        definition.constraints.push(Object.assign(new HorizontalConstraint(blockLine), { sketchId: DEFAULT_SKETCH_ID }));
        model.blockDefinitions.push(definition);
        const instance = { id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: 10, y: 20, rotation: 0, fixed: true, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID] };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();
        const projectionLine = blockProjectionBundle(instance).lines[0];
        pushModelConstraint(new HorizontalConstraint(projectionLine));
        selectedBlockInstances = [instance];
        resetHistory("clipboard block test");
        updateUI();
        draw();
        return this.clipboardStateForTest();
      },
      clipboardStateForTest() {
        const serialized = serializeModel();
        const geometryBySketch = Object.fromEntries(model.sketches.filter((sketch) => !isRootSketch(sketch)).map((sketch) => [sketch.id, {
          points: model.points.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, x: item.x, y: item.y, kind: item.kind, fixed: Boolean(item.fixed) })),
          lines: model.lines.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, p1: item.p1.id, p2: item.p2.id })),
          circles: model.circles.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, center: item.center.id, radius: item.radius() })),
          arcs: model.arcs.filter((item) => elementSketchId(item) === sketch.id).map((item) => ({ id: item.id, center: item.center.id, radius: item.radius() })),
          blockInstances: model.blockInstances.filter((item) => item.sketchId === sketch.id).map((item) => ({ id: item.id, x: item.x, y: item.y, definitionId: item.definitionId, fixed: Boolean(item.fixed), rotationLocked: Boolean(item.rotationLocked) })),
        }]));
        return {
          activeSketchId: activeSketchId(),
          geometryBySketch,
          constraints: serialized.constraints.map((item) => ({ type: item.type, sketchId: item.sketchId, line: item.line || null, reference: Boolean(item.reference), dimension: item.dimension || null })),
          selected: this.selectedGeometryIdsForTest(),
          selectedBlockInstanceIds: selectedBlockInstances.map((item) => item.id),
          clipboard: geometryClipboard ? {
            pasteCount: geometryClipboard.pasteCount,
            points: geometryClipboard.points.length,
            lines: geometryClipboard.lines.length,
            circles: geometryClipboard.circles.length,
            arcs: geometryClipboard.arcs.length,
            constraints: geometryClipboard.constraints.length,
            blockInstances: geometryClipboard.blockInstances.length,
          } : null,
          history: this.historyState(),
        };
      },
      documentNameState() {
        return {
          modelName: model.documentName,
          displayName: effectiveDocumentName(),
          serializedName: serializeModel().documentName,
          title: document.title,
        };
      },
      serializedModelForTest() {
        return structuredClone(serializeModel());
      },
      resetForParameterTest() {
        resetModelState();
        const p1 = addPoint(0, 0, true, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const drivenLine = addLine(p1, p2);
        pushModelConstraint(new HorizontalConstraint(drivenLine));
        const driven = new DistanceConstraint(p1, p2, 100);
        driven.dimension = dimensionFromAnchor({ kind: "line-length", line: drivenLine, p1, p2, value: 100 }, { x: 50, y: -30 });
        pushModelConstraint(driven);
        const p3 = addPoint(0, 60, true, "endpoint");
        const p4 = addPoint(40, 60, true, "endpoint");
        const measuredLine = addLine(p3, p4);
        const measured = new DistanceConstraint(p3, p4, 40);
        measured.dimension = dimensionFromAnchor({ kind: "line-length", line: measuredLine, p1: p3, p2: p4, value: 40 }, { x: 20, y: 85 });
        measured.readOnlyDimension = true;
        measured.enabled = false;
        pushModelConstraint(measured);
        model.parameters = [
          { name: "width", expression: `${measured.parameterName} * 2` },
          { name: "margin", expression: "10" },
        ];
        driven.expression = "width / 2 + margin";
        const definition = createEmptyBlockDefinition("Param Block");
        const bp1 = new Point("BP1", 0, 0, true, "endpoint");
        const bp2 = new Point("BP2", 25, 0, false, "endpoint");
        bp1.sketchId = DEFAULT_SKETCH_ID;
        bp2.sketchId = DEFAULT_SKETCH_ID;
        const blockLine = new Line("BL1", bp1, bp2);
        blockLine.sketchId = DEFAULT_SKETCH_ID;
        const blockHorizontal = new HorizontalConstraint(blockLine);
        blockHorizontal.sketchId = DEFAULT_SKETCH_ID;
        const blockDimension = new DistanceConstraint(bp1, bp2, 25);
        blockDimension.sketchId = DEFAULT_SKETCH_ID;
        blockDimension.dimension = { x: 12.5, y: -20 };
        definition.points.push(bp1, bp2);
        definition.lines.push(blockLine);
        definition.constraints.push(blockHorizontal, blockDimension);
        definition.parameters = [{ name: "width", expression: "25" }];
        ensureParameterNamespace(definition);
        blockDimension.expression = "width";
        model.blockDefinitions.push(definition);
        model.blockInstances.push({ id: `BI${blockInstanceSeq++}`, definitionId: definition.id, sketchId: DEFAULT_SKETCH_ID, x: 180, y: 0, rotation: 0, fixed: false, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} });
        const otherDefinition = createEmptyBlockDefinition("Other Param Block");
        const op1 = new Point("BP1", 0, 0, true, "endpoint");
        const op2 = new Point("BP2", 15, 0, false, "endpoint");
        op1.sketchId = DEFAULT_SKETCH_ID;
        op2.sketchId = DEFAULT_SKETCH_ID;
        const otherLine = new Line("BL1", op1, op2);
        otherLine.sketchId = DEFAULT_SKETCH_ID;
        const otherHorizontal = new HorizontalConstraint(otherLine);
        otherHorizontal.sketchId = DEFAULT_SKETCH_ID;
        const otherDimension = new DistanceConstraint(op1, op2, 15);
        otherDimension.sketchId = DEFAULT_SKETCH_ID;
        otherDimension.dimension = { x: 7.5, y: -20 };
        otherDefinition.points.push(op1, op2);
        otherDefinition.lines.push(otherLine);
        otherDefinition.constraints.push(otherHorizontal, otherDimension);
        otherDefinition.parameters = [{ name: "width", expression: "15" }];
        ensureParameterNamespace(otherDefinition);
        otherDimension.expression = "width";
        model.blockDefinitions.push(otherDefinition);
        model.blockInstances.push({ id: `BI${blockInstanceSeq++}`, definitionId: otherDefinition.id, sketchId: DEFAULT_SKETCH_ID, x: 260, y: 0, rotation: 0, fixed: false, rotationLocked: true, enabledSketchIds: [DEFAULT_SKETCH_ID], appearanceOverride: {} });
        invalidateBlockProjectionCache();
        const result = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: [activeSketchId()] });
        resetHistory("parameter test");
        updateUI();
        draw();
        return { success: result.success, drivenName: driven.parameterName, measuredName: measured.parameterName, length: drivenLine.length() };
      },
      resetForParameterFeedbackTest() {
        resetModelState();
        const p1 = addPoint(0, 0, true, "endpoint");
        const p2 = addPoint(40, 0, false, "endpoint");
        const line = addLine(p1, p2);
        pushModelConstraint(new HorizontalConstraint(line));
        const driving = new DistanceConstraint(p1, p2, 40);
        driving.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 40 }, { x: 20, y: -25 });
        pushModelConstraint(driving);
        const measured = new DistanceConstraint(p1, p2, 40);
        measured.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: 40 }, { x: 20, y: 25 });
        measured.readOnlyDimension = true;
        measured.enabled = false;
        pushModelConstraint(measured);
        driving.expression = "40";
        const result = stabilizeActiveParameterNamespace(activeSketchId(), { allSketches: [activeSketchId()] });
        resetHistory("parameter feedback test");
        updateUI();
        draw();
        return { success: result.success, drivingName: driving.parameterName, measuredName: measured.parameterName, length: line.length() };
      },
      parameterStateForTest() {
        const evaluation = validateParameterNamespace(model);
        return {
          valid: evaluation.success,
          parameters: model.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression, value: parameter.evaluatedValue })),
          dimensions: dimensionConstraintsInNamespace(model).map((constraint) => ({
            name: constraint.parameterName,
            expression: constraint.expression || null,
            readOnly: isReadOnlyDimension(constraint),
            value: constraint.evaluatedParameterValue,
            target: dimensionExpressionValue(constraint),
          })),
          blockNamespaces: model.blockDefinitions.map((definition) => ({
            id: definition.id,
            parameters: definition.parameters.map((parameter) => ({ name: parameter.name, expression: parameter.expression })),
            dimensions: dimensionConstraintsInNamespace(definition).map((constraint) => ({ name: constraint.parameterName, expression: constraint.expression, target: dimensionExpressionValue(constraint) })),
            lineLengths: definition.lines.map((line) => line.length()),
          })),
          instanceProjectionLengths: model.blockInstances.flatMap((instance) => blockProjectionBundle(instance).lines.map((line) => line.length())),
          serialized: serializeModel(),
        };
      },
      blockParameterFreezeForTest() {
        const line = model.lines[0];
        if (!line) return null;
        clearSelection();
        selectedLines = [line];
        const selection = blockSelectionGeometry();
        if (selection.error) return { error: selection.error };
        const definition = createBlockDefinitionFromSelection(selection, blockSelectionBoundsCenter(selection), "Frozen Formula Block");
        const dimension = dimensionConstraintsInNamespace(definition)[0];
        return {
          parameters: definition.parameters,
          name: dimension?.parameterName || null,
          expression: dimension?.expression || null,
          sourceExpression: dimensionConstraintsInNamespace(model)[0]?.expression || null,
        };
      },
      deleteDimensionByNameForTest(name) {
        const constraint = dimensionConstraintsInNamespace(model).find((item) => item.parameterName === name);
        const deleted = constraint ? deleteElements({ constraints: [constraint] }) : false;
        return { deleted, names: dimensionConstraintsInNamespace(model).map((item) => item.parameterName), hint: document.getElementById("hint")?.textContent || "" };
      },
      appearanceStateForTest(kind, id) {
        let item = null;
        if (kind === "point") item = allGeometryPoints().find((value) => value.id === id);
        if (kind === "line") item = allGeometryLines().find((value) => value.id === id);
        if (kind === "circle") item = allGeometryCircles().find((value) => value.id === id);
        if (kind === "arc") item = allGeometryArcs().find((value) => value.id === id);
        if (kind === "block") {
          const instance = blockInstanceById(id);
          item = instance ? [...blockProjectionBundle(instance).lines, ...blockProjectionBundle(instance).circles, ...blockProjectionBundle(instance).arcs][0] : null;
        }
        return item ? { direct: normalizeAppearance(item.appearance), effective: effectiveAppearanceForElement(item), visible: isVisibleSketchElement(item) } : null;
      },
      viewStateForTest() {
        return {
          ...viewState,
          mouseLatched: constraintStatusMouseLatched,
          spaceHeld: constraintStatusSpaceHeld,
        };
      },
      async importDocumentNameFixture(data, fileName) {
        const startedAt = performance.now();
        const file = new File([JSON.stringify(data)], fileName, { type: "application/json" });
        const success = await importFileData(file);
        return {
          success,
          elapsedMs: performance.now() - startedAt,
          modelName: model.documentName,
          displayName: effectiveDocumentName(),
          serializedName: serializeModel().documentName,
          title: document.title,
        };
      },
      loadDocumentFixtureForDragTest(data, fileName = "drag-fixture.json") {
        try {
          loadModelData(structuredClone(data), { documentNameOverride: fileNameStem(fileName) });
          return { success: true, constraintCount: model.constraints.length };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      selectedGeometryIdsForTest() {
        return {
          points: selectedPoints.map((point) => point.id),
          lines: selectedLines.map((line) => line.id),
          circles: selectedCircles.map((circle) => circle.id),
          arcs: selectedArcs.map((arc) => arc.id),
          blockInstances: selectedBlockInstances.map((instance) => instance.id),
        };
      },
      selectGeometryIdsForTest(ids = {}) {
        clearSelection();
        const pointIds = new Set(ids.points || []);
        const lineIds = new Set(ids.lines || []);
        const circleIds = new Set(ids.circles || []);
        const arcIds = new Set(ids.arcs || []);
        const blockInstanceIds = new Set(ids.blockInstances || []);
        selectedPoints = model.points.filter((point) => pointIds.has(point.id));
        selectedLines = model.lines.filter((line) => lineIds.has(line.id));
        selectedCircles = model.circles.filter((circle) => circleIds.has(circle.id));
        selectedArcs = model.arcs.filter((arc) => arcIds.has(arc.id));
        selectedBlockInstances = model.blockInstances.filter((instance) => blockInstanceIds.has(instance.id));
        updateUI();
        draw();
        const selection = blockSelectionGeometry();
        return {
          selected: this.selectedGeometryIdsForTest(),
          blockError: selection.error || null,
          internalConstraintCount: selection.constraints?.length || 0,
          externalConstraintCount: selection.externalConstraints?.length || 0,
        };
      },
      focusWorldForTest(center, scale = 1) {
        viewport.scale = clampZoom(Number(scale) || 1);
        resizeCanvas({ centerWorld: { x: Number(center?.x) || 0, y: Number(center?.y) || 0 } });
        draw();
        const rect = canvas.getBoundingClientRect();
        return {
          scale: viewport.scale,
          center: currentCanvasCenterWorld(),
          canvas: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        };
      },
      worldClientPositionForTest(point) {
        const rect = canvas.getBoundingClientRect();
        const screen = worldToCanvasScreen({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 });
        return { x: rect.left + screen.x, y: rect.top + screen.y };
      },
      hitGeometryAtWorldForTest(point) {
        const x = Number(point?.x) || 0;
        const y = Number(point?.y) || 0;
        const arcEndpoint = hitArcEndpoint(x, y);
        return {
          point: hitPoint(x, y)?.id || null,
          line: hitLine(x, y)?.id || null,
          circle: hitCircle(x, y)?.id || null,
          arc: hitArc(x, y)?.id || null,
          arcEndpoint: arcEndpoint ? { id: arcEndpoint.arc.id, endpoint: arcEndpoint.endpoint } : null,
        };
      },
      geometryClientPositionForTest(kind, id, detail = null) {
        let point = null;
        if (kind === "point") point = model.points.find((item) => item.id === id) || null;
        if (kind === "line") {
          const line = model.lines.find((item) => item.id === id);
          if (line) point = { x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 };
        }
        if (kind === "circle") {
          const circle = model.circles.find((item) => item.id === id);
          if (circle) point = { x: circle.center.x + circle.radius(), y: circle.center.y };
        }
        if (kind === "arc") {
          const arc = model.arcs.find((item) => item.id === id);
          if (arc) {
            const angle = detail === "start" ? arc.startAngle : detail === "end" ? arc.endAngle : arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
            point = { x: arc.center.x + arc.radius() * Math.cos(angle), y: arc.center.y + arc.radius() * Math.sin(angle) };
          }
        }
        return point ? this.worldClientPositionForTest(point) : null;
      },
      hoverDisplayStateForTest(kind, id) {
        let item = null;
        if (kind === "point") item = allGeometryPoints().find((value) => value.id === id);
        if (kind === "line") item = allGeometryLines().find((value) => value.id === id);
        if (kind === "circle") item = allGeometryCircles().find((value) => value.id === id);
        if (kind === "arc") item = allGeometryArcs().find((value) => value.id === id);
        if (kind === "block") {
          const instance = blockInstanceById(id);
          item = instance ? blockProjectionBundle(instance).lines[0] || blockProjectionBundle(instance).circles[0] || blockProjectionBundle(instance).arcs[0] : null;
        }
        if (!item) return null;
        const appearance = effectiveAppearanceForElement(item);
        const treeHovered = isSidebarHighlightedElement(item) && (!(item instanceof Point) || (!item.blockProjection && !isAnyLineEndpoint(item)));
        const sidebarHovered = isSidebarHoveredElement(item);
        const canvasHovered = hoveredLine === item || hoveredCircle === item || hoveredArc === item || hoveredPoint === item || hoveredEndpointPoint === item;
        const blockHovered = Boolean(item.blockInstance && hoveredBlockInstance === item.blockInstance);
        const hovered = treeHovered || sidebarHovered || canvasHovered || blockHovered;
        return {
          treeHovered,
          sidebarHovered,
          canvasHovered,
          blockHovered,
          color: geometryDisplayColor(item, appearance, false, hovered),
          width: geometryStrokeWidth(item, { hovered, appearance, construction: Boolean(item.construction) }),
        };
      },
      authoringStateForTest() {
        return {
          mode,
          pendingConstraintType: pendingConstraintCommand?.type || null,
          pendingCommandType: pendingCommand?.type || null,
          pendingPlacementPoint: pendingCommand?.type === "distance-place" && pendingCommand.pointer
            ? { x: pendingCommand.pointer.x, y: pendingCommand.pointer.y }
            : null,
          pendingCommandPreview: pendingCommand?.type === "fillet-radius-value"
            ? computeFilletGeometry(pendingCommand.line1, pendingCommand.line2, Number(pendingCommand.buffer) || DEFAULT_FILLET_RADIUS)
            : null,
          pointCount: model.points.length,
          lineCount: model.lines.length,
          circleCount: model.circles.length,
          arcCount: model.arcs.length,
          constraintCount: model.constraints.length,
          fixedPointIds: model.points.filter((point) => point.fixed).map((point) => point.id),
          lastLine: model.lines.length > 0 ? { id: model.lines[model.lines.length - 1].id, construction: Boolean(model.lines[model.lines.length - 1].construction) } : null,
          lastConstraint: model.constraints.length > 0 ? decorateSerializedConstraint(serializeConstraint(model.constraints[model.constraints.length - 1]), model.constraints[model.constraints.length - 1]) : null,
          lastPerformance: lastAuthoringPerformance ? { ...lastAuthoringPerformance } : null,
          selected: this.selectedGeometryIdsForTest(),
        };
      },
      selectableLineClientPositionForTest() {
        const rect = canvas.getBoundingClientRect();
        for (const line of model.lines) {
          for (const t of [0.37, 0.63, 0.5]) {
            const world = {
              x: line.p1.x + (line.p2.x - line.p1.x) * t,
              y: line.p1.y + (line.p2.y - line.p1.y) * t,
            };
            if (hitPoint(world.x, world.y) || hitLine(world.x, world.y) !== line || hitDimension(world.x, world.y)) continue;
            const screen = worldToCanvasScreen(world);
            const x = rect.left + screen.x;
            const y = rect.top + screen.y;
            if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
            if (document.elementFromPoint(x, y) !== canvas) continue;
            return { id: line.id, x, y };
          }
        }
        return null;
      },
      guidedPointDragForTest(id, dx, dy) {
        const point = model.points.find((item) => item.id === id);
        if (!point) return null;
        const startPointer = { x: point.x, y: point.y };
        const session = buildDragSession("point", point, startPointer);
        if (!session) return null;
        attachLocalSolveContext(session);
        const target = { x: startPointer.x + dx, y: startPointer.y + dy };
        const previewResult = dragResultForSession(session, target);
        const previewPoint = { x: point.x, y: point.y };
        const finalResult = solveFinalDragSession(session);
        normalizeArcSweeps();
        const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session.sketchId)));
        return {
          target,
          targetConstraintCount: session.finalDragConstraints?.length || 0,
          preview: {
            success: previewResult.success,
            errorNorm: previewResult.errorNorm,
            acceptError: previewResult.acceptError,
            iterations: previewResult.iterations,
            point: previewPoint,
          },
          final: {
            success: finalResult.success,
            errorNorm: finalResult.errorNorm,
            baseErrorNorm,
            iterations: finalResult.iterations,
            point: { x: point.x, y: point.y },
          },
        };
      },
      guidedPointDragPathForTest(id, deltas) {
        const point = model.points.find((item) => item.id === id);
        if (!point) return null;
        const startPointer = { x: point.x, y: point.y };
        const session = buildDragSession("point", point, startPointer);
        if (!session) return null;
        attachLocalSolveContext(session);
        const previews = [];
        for (const [dx, dy] of deltas) {
          const target = { x: startPointer.x + dx, y: startPointer.y + dy };
          const startedAt = performance.now();
          const result = dragResultForSession(session, target);
          previews.push({
            success: result.success,
            blocked: result.blocked,
            errorNorm: result.errorNorm,
            acceptError: result.acceptError,
            iterations: result.iterations,
            elapsedMs: performance.now() - startedAt,
            target,
            targetNorm: result.targetNorm,
            targetStepNorm: result.targetStepNorm,
            projectedNorm: result.projectedNorm,
            projectedErrorNorm: result.projectedErrorNorm,
            targetErrorNorm: result.targetErrorNorm,
            targetConstraintCount: result.targetConstraints?.length || 0,
            freeDof: result.freeDof,
            targetActivity: result.targetActivity,
            variableCount: result.variableCount,
            constraintCount: result.constraintCount,
            reason: result.reason,
            local: result.local,
            guided: result.guided,
            fallback: result.fallback,
            point: { x: point.x, y: point.y },
          });
        }
        const finalResult = solveFinalDragSession(session);
        normalizeArcSweeps();
        const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session.sketchId)));
        return {
          startPoint: startPointer,
          previews,
          final: {
            success: finalResult.success,
            errorNorm: finalResult.errorNorm,
            baseErrorNorm,
            iterations: finalResult.iterations,
            reason: finalResult.reason,
            point: { x: point.x, y: point.y },
          },
        };
      },
      geometryDragPathForTest(descriptor, deltas) {
        const kind = descriptor?.kind;
        const id = descriptor?.id;
        const endpoint = descriptor?.endpoint === "end" ? "end" : "start";
        let item = null;
        let sessionItem = null;
        let startPointer = null;
        if (kind === "point") {
          item = model.points.find((candidate) => candidate.id === id);
          sessionItem = item;
          if (item) startPointer = { x: item.x, y: item.y };
        } else if (kind === "line") {
          item = model.lines.find((candidate) => candidate.id === id);
          sessionItem = item;
          if (item) startPointer = { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 };
        } else if (kind === "circle") {
          item = model.circles.find((candidate) => candidate.id === id);
          sessionItem = item;
          if (item) startPointer = { x: item.center.x + item.radius(), y: item.center.y };
        } else if (kind === "arc") {
          item = model.arcs.find((candidate) => candidate.id === id);
          sessionItem = item;
          if (item) {
            const angle = (item.startAngle + item.endAngle) / 2;
            startPointer = { x: item.center.x + item.radius() * Math.cos(angle), y: item.center.y + item.radius() * Math.sin(angle) };
          }
        } else if (kind === "arc-endpoint") {
          item = model.arcs.find((candidate) => candidate.id === id);
          sessionItem = item ? { arc: item, endpoint } : null;
          if (item) startPointer = arcEndpointPoint(item, endpoint);
        }
        if (!item || !startPointer) return null;

        const snapshot = () => {
          if (kind === "point") return { x: item.x, y: item.y };
          if (kind === "line") {
            return {
              p1: { x: item.p1.x, y: item.p1.y },
              p2: { x: item.p2.x, y: item.p2.y },
              midpoint: { x: (item.p1.x + item.p2.x) / 2, y: (item.p1.y + item.p2.y) / 2 },
              length: item.length(),
            };
          }
          if (kind === "circle") return { center: { x: item.center.x, y: item.center.y }, radius: item.radius() };
          const start = arcEndpointPoint(item, "start");
          const end = arcEndpointPoint(item, "end");
          return {
            center: { x: item.center.x, y: item.center.y },
            radius: item.radius(),
            start,
            end,
            draggedEndpoint: kind === "arc-endpoint" ? (endpoint === "start" ? start : end) : null,
          };
        };

        const session = buildDragSession(kind, sessionItem, startPointer);
        const startState = snapshot();
        if (!session) return { sessionAvailable: false, startPointer, startState, previews: [], final: null };
        attachLocalSolveContext(session);
        const previews = [];
        for (const [dx, dy] of deltas) {
          const target = { x: startPointer.x + dx, y: startPointer.y + dy };
          const startedAt = performance.now();
          const result = dragResultForSession(session, target);
          previews.push({
            success: result.success,
            blocked: result.blocked,
            errorNorm: result.errorNorm,
            acceptError: result.acceptError,
            iterations: result.iterations,
            elapsedMs: performance.now() - startedAt,
            target,
            targetNorm: result.targetNorm,
            targetStepNorm: result.targetStepNorm,
            projectedNorm: result.projectedNorm,
            projectedErrorNorm: result.projectedErrorNorm,
            targetErrorNorm: result.targetErrorNorm,
            freeDof: result.freeDof,
            variableCount: result.variableCount,
            constraintCount: result.constraintCount,
            guidedRetryCount: result.guidedRetryCount,
            reason: result.reason,
            local: result.local,
            guided: result.guided,
            fallback: result.fallback,
            localErrorNorm: result.localErrorNorm,
            state: snapshot(),
          });
        }
        const finalResult = solveFinalDragSession(session);
        normalizeArcSweeps();
        const baseErrorNorm = vectorNorm(solver.computeErrorVectorForConstraints(sketchSolveConstraints(session.sketchId)));
        return {
          sessionAvailable: true,
          startPointer,
          startState,
          previews,
          final: {
            success: finalResult.success,
            errorNorm: finalResult.errorNorm,
            baseErrorNorm,
            iterations: finalResult.iterations,
            reason: finalResult.reason,
            state: snapshot(),
          },
        };
      },
      constraintAnalysisForTest() {
        const sketchId = activeSketchId();
        const variables = sketchSolveVariables(sketchId);
        const constraints = sketchSolveConstraints(sketchId);
        const analysis = solver.analyzeConstraintState({
          variables,
          constraints,
          lines: sketchSolveLines(sketchId),
          errorTolerance: CONSTRAINT_ACCEPT_ERROR,
        });
        const largestConstraintErrors = constraints
          .map((constraint, index) => {
            const error = constraint.error();
            const values = Array.isArray(error) ? error : [error];
            return {
              index,
              name: constraint.name,
              type: constraint.constructor.name,
              errorNorm: vectorNorm(values),
            };
          })
          .filter((entry) => entry.errorNorm > 1e-8)
          .sort((a, b) => b.errorNorm - a.errorNorm)
          .slice(0, 12);
        return {
          stable: analysis.stable,
          errorNorm: analysis.errorNorm,
          rank: analysis.rank,
          variableCount: analysis.variableCount,
          freeVariableCount: analysis.freeVariableCount,
          constraintCount: constraints.length,
          pointCount: model.points.filter((point) => elementSketchId(point) === sketchId).length,
          lineCount: model.lines.filter((line) => elementSketchId(line) === sketchId).length,
          circleCount: model.circles.filter((circle) => elementSketchId(circle) === sketchId).length,
          arcCount: model.arcs.filter((arc) => elementSketchId(arc) === sketchId).length,
          largestConstraintErrors,
        };
      },
      blockConstraintStatusForTest(instanceId = null) {
        const state = refreshConstraintAnalysis();
        const bundles = blockProjectionBundles().filter((bundle) => !instanceId || bundle.instance.id === instanceId);
        return {
          stable: state.analysis.stable,
          summary: { ...state.summary },
          projections: bundles.flatMap((bundle) => [...bundle.points, ...bundle.lines, ...bundle.circles, ...bundle.arcs].map((item) => ({
            id: item.id,
            status: state.statuses.get(item) || null,
          }))),
        };
      },
      addBlockPointOnLineConstraintForTest(pointInstanceId, pointLocalId, lineInstanceId, lineLocalId) {
        const pointInstance = blockInstanceById(pointInstanceId);
        const lineInstance = blockInstanceById(lineInstanceId);
        const point = pointInstance ? blockProjectionBundle(pointInstance).points.find((item) => item.localElement?.id === pointLocalId) : null;
        const line = lineInstance ? blockProjectionBundle(lineInstance).lines.find((item) => item.localElement?.id === lineLocalId) : null;
        if (!point || !line) return { committed: false, reason: "projection-not-found" };
        const committed = commitNewConstraint("coincident", new PointOnLineConstraint(point, line)) === true;
        return {
          committed,
          analysis: this.constraintAnalysisForTest(),
          status: this.blockConstraintStatusForTest(pointInstanceId),
          serialized: serializeModel(),
        };
      },
      resetForAnnotationDrag() {
        resetModelState();
        const p1 = addPoint(-60, -25, false, "endpoint");
        const p2 = addPoint(60, -25, false, "endpoint");
        const p3 = addPoint(60, 35, false, "endpoint");
        const p4 = addPoint(-60, 35, false, "endpoint");
        addLine(p1, p2);
        addLine(p2, p3);
        const l3 = addLine(p3, p4);
        addLine(p4, p1);
        const leaderTarget = annotationLeaderTargetFromItem(l3, { x: 0, y: 35 });
        pushAnnotation({
          type: "leader",
          text: "注記",
          start: { ...leaderTarget.anchor },
          elbow: { x: 56, y: 82 },
          end: { x: 112, y: 82 },
          geometryRef: leaderTarget.geometryRef,
          style: { color: "#111827", fontSize: 13, lineWidth: 1.4 },
        });
        pushAnnotation({ type: "text", text: "自由テキスト", x: -90, y: 80, style: { color: "#111827", fontSize: 13 } });
        resizeCanvas({ centerWorld: { x: 20, y: 20 } });
        return this.annotationSnapshot();
      },
      resetForReadOnlyDuplicateDimension() {
        resetModelState();
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        const firstDimension = dimensionFromAnchor(target, { x: 0, y: -28 });
        const first = addDistanceConstraintFromTarget(target, line.length(), firstDimension, { sketchId: activeSketchId() });
        const second = addDistanceConstraintFromTarget(target, line.length(), dimensionFromAnchor(target, { x: 0, y: -54 }), { sketchId: activeSketchId() });
        const dimensionConstraints = model.constraints.filter(isDimensionConstraint);
        const layout = dimensionLayout(target, firstDimension);
        const extensionAlignmentErrors = layout.points.map((point) => {
          const vx = point.extensionEnd.x - point.extensionStart.x;
          const vy = point.extensionEnd.y - point.extensionStart.y;
          const wx = point.source.x - point.extensionStart.x;
          const wy = point.source.y - point.extensionStart.y;
          return Math.abs(vx * wy - vy * wx) / Math.max(hypot2(vx, vy), 1e-12);
        });
        return {
          first,
          second,
          count: dimensionConstraints.length,
          enabledCount: dimensionConstraints.filter((constraint) => constraint.enabled !== false).length,
          readOnlyCount: dimensionConstraints.filter(isReadOnlyDimension).length,
          labels: dimensionConstraints.map((constraint) => dimensionLabelForConstraint(constraint, targetFromConstraint(constraint), constraint.dimension || defaultDimensionForTarget(targetFromConstraint(constraint)))),
          serializedReadOnlyCount: serializeModel().constraints.filter((constraint) => constraint.readOnlyDimension).length,
          extensionAlignmentErrors,
        };
      },
      resetForReadOnlyDimensionPlacement() {
        resetModelState();
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        addDistanceConstraintFromTarget(target, line.length(), dimensionFromAnchor(target, { x: 0, y: -28 }), { sketchId: activeSketchId() });
        pendingConstraintCommand = { type: "distance" };
        pendingCommand = {
          type: "distance-place",
          target,
          pointer: { x: 0, y: -54 },
          sketchId: activeSketchId(),
        };
        startDistanceValueInput({ x: 0, y: -54 });
        return {
          pendingType: pendingCommand?.type || null,
          inputHidden: dimensionValueInput.hidden,
          readOnlyCount: model.constraints.filter(isReadOnlyDimension).length,
          dimensionCount: model.constraints.filter(isDimensionConstraint).length,
        };
      },
      constructionDimensionClearanceCases() {
        resetModelState();
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const line = addLine(p1, p2);
        line.construction = true;
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        const screenClearance = (direction) => dimensionConstructionExtensionClearance(target, 1, p2, direction) * viewport.scale;
        const diagonal = Math.SQRT1_2;
        const result = {
          sameDirection: screenClearance({ x: 1, y: 0 }),
          diagonal: screenClearance({ x: diagonal, y: diagonal }),
          perpendicular: screenClearance({ x: 0, y: 1 }),
          opposite: screenClearance({ x: -1, y: 0 }),
        };
        line.appearance = { ...normalizeAppearance(line.appearance), endpointOverhang: false };
        result.disabled = screenClearance({ x: 1, y: 0 });
        return result;
      },
      pointPointRectangleDimensionExtensionVisibilityCases() {
        resetModelState();
        const p1 = addPoint(160, 160, true, "endpoint");
        const p2 = addPoint(297.73401510731196, 185.0866714097212, false, "endpoint");
        const p3 = addPoint(279.8149641009543, 283.468110772277, false, "endpoint");
        const p4 = addPoint(142.08094899119854, 258.38143937826186, false, "endpoint");
        addLine(p1, p2);
        const sideLine = addLine(p2, p3);
        addLine(p3, p4);
        addLine(p4, p1);
        const topTarget = { kind: "point-point", p1, p2, value: hypot2(p2.x - p1.x, p2.y - p1.y) };
        const sideTarget = { kind: "point-point", p1: p2, p2: p3, value: hypot2(p3.x - p2.x, p3.y - p2.y) };
        const sideLineTarget = { kind: "line-length", line: sideLine, p1: p2, p2: p3, value: sideLine.length() };
        const visibleFlags = (target, dimension) => {
          const layout = dimensionLayout(target, dimension);
          return layout.points.map((point) => point.showExtension !== false);
        };
        const previewFlags = (target, pointer) => {
          const dimension = dimensionWithLabelAt(target, dimensionFromAnchor(target, pointer), pointer);
          return visibleFlags(target, dimension);
        };
        const leftPointer = { x: 109.1051908103851, y: 208.70539753179494 };
        return {
          top: visibleFlags(topTarget, {
            x: 275.2991240975706,
            y: 146.73754454625083,
            offsetU: 41.05643170185708,
            offsetN: -33.70830342779351,
            labelOffsetU: 42.71350462481912,
            axis: null,
          }),
          left: visibleFlags(sideTarget, {
            x: 109.1051908103851,
            y: 208.70539753179494,
            offsetU: 7.036937956365918,
            offsetN: 181.34350081496538,
            labelOffsetU: 5.954777756734029,
            axis: null,
          }),
          pointPointPreviewLeft: previewFlags(sideTarget, leftPointer),
          lineLengthPreviewLeft: previewFlags(sideLineTarget, leftPointer),
        };
      },
      dimensionDisplayPrecisionCases() {
        return {
          integerTrailingZero: formatDimensionLabel(140),
          integerHundred: formatDimensionLabel(100),
          positiveNoise: formatDimensionLabel(15.0000000058),
          negativeNoise: formatDimensionLabel(824.9999999982),
          precisionBoundaryNoise: formatDimensionLabel(1844.999999),
          measuredAccumulatedNoise: formatMeasuredDimensionLabel(1844.9999986000548),
          minimumResolution: formatDimensionLabel(0.000001),
          measuredMinimumResolution: formatMeasuredDimensionLabel(0.000001),
          roundedFraction: formatDimensionLabel(1.2345674),
        };
      },
      dimensionTextAngleCases() {
        const resultForDrawingAngle = (degrees) => {
          const radians = (degrees * Math.PI) / 180;
          const direction = { x: Math.cos(radians), y: -Math.sin(radians) };
          const angle = jisDimensionTextAngle(direction);
          return {
            angle: (angle * 180) / Math.PI,
            offset: dimensionTextOffset(angle, 1),
          };
        };
        return {
          zero: resultForDrawingAngle(0),
          quadrant1: resultForDrawingAngle(30),
          vertical90: resultForDrawingAngle(90),
          quadrant2: resultForDrawingAngle(150),
          straight180: resultForDrawingAngle(180),
          quadrant3: resultForDrawingAngle(210),
          vertical270: resultForDrawingAngle(270),
          quadrant4: resultForDrawingAngle(330),
          quadrant4NearVertical: resultForDrawingAngle(273),
        };
      },
      angleDimensionLabelFollowCase() {
        resetModelState();
        const p1 = addPoint(-80, 0, false, "endpoint");
        const p2 = addPoint(80, 0, false, "endpoint");
        const p3 = addPoint(0, -80, false, "endpoint");
        const p4 = addPoint(0, 80, false, "endpoint");
        const line1 = addLine(p1, p2);
        const line2 = addLine(p3, p4);
        const target = { kind: "angle", line1, line2, value: 90 };
        const initial = dimensionFromAnchor(target, { x: 45, y: 45 });
        const initialBasis = angleDimensionLabelBasis(target, initial);
        initial.labelX = initialBasis.arcPoint.x + initialBasis.radial.x * 11 + initialBasis.tangent.x * 7;
        initial.labelY = initialBasis.arcPoint.y + initialBasis.radial.y * 11 + initialBasis.tangent.y * 7;

        const corruptedRelativePlacement = {
          ...dimensionFromAnchor(target, { x: 45, y: 45 }),
          angleLabelOffsetR: 27.337291652719134,
          angleLabelOffsetT: -6.399630529188789,
        };
        angleDimensionLayout(target, corruptedRelativePlacement);
        const recoveredCorruptedOffsets = angleDimensionLabelOffsets(target, corruptedRelativePlacement);

        const before = angleDimensionLayout(target, initial);
        const beforeBasis = angleDimensionLabelBasis(target, initial);
        const translation = { x: 34, y: -19 };
        for (const point of [p1, p2, p3, p4]) {
          point.x += translation.x;
          point.y += translation.y;
        }
        const afterTranslation = angleDimensionLayout(target, initial);
        const afterTranslationBasis = angleDimensionLabelBasis(target, initial);
        const labelTranslationError = hypot2(
          afterTranslation.text.x - before.text.x - translation.x,
          afterTranslation.text.y - before.text.y - translation.y,
        );
        const arcTranslationError = hypot2(
          afterTranslationBasis.arcPoint.x - beforeBasis.arcPoint.x - translation.x,
          afterTranslationBasis.arcPoint.y - beforeBasis.arcPoint.y - translation.y,
        );

        const storedOffsets = angleDimensionLabelOffsets(target, initial);
        const movedAnchor = {
          x: afterTranslationBasis.arcPoint.x + afterTranslationBasis.radial.x * 26,
          y: afterTranslationBasis.arcPoint.y + afterTranslationBasis.radial.y * 26,
        };
        const movedDimension = dimensionFromAnchor(target, movedAnchor, { allowPointAxis: false });
        setAngleDimensionLabelOffsets(movedDimension, storedOffsets);
        const afterRadiusMove = angleDimensionLayout(target, movedDimension);
        const afterRadiusMoveBasis = angleDimensionLabelBasis(target, movedDimension);
        const labelRadiusDelta = {
          x: afterRadiusMove.text.x - afterTranslation.text.x,
          y: afterRadiusMove.text.y - afterTranslation.text.y,
        };
        const arcRadiusDelta = {
          x: afterRadiusMoveBasis.arcPoint.x - afterTranslationBasis.arcPoint.x,
          y: afterRadiusMoveBasis.arcPoint.y - afterTranslationBasis.arcPoint.y,
        };
        let repeatedlyDraggedDimension = movedDimension;
        const dragOffsets = angleDimensionLabelOffsets(target, repeatedlyDraggedDimension);
        let repeatedDragOffsetError = 0;
        let repeatedDragRadialPointerError = 0;
        for (let index = 0; index < 8; index++) {
          const currentLayout = angleDimensionLayout(target, repeatedlyDraggedDimension);
          const pointer = {
            x: currentLayout.text.x + (index % 2 === 0 ? 13 : -9),
            y: currentLayout.text.y + (index % 3 === 0 ? 8 : -6),
          };
          repeatedlyDraggedDimension = angleDimensionFromLabelPoint(
            target,
            pointer,
            angleDimensionLabelOffsets(target, repeatedlyDraggedDimension),
          );
          const nextOffsets = angleDimensionLabelOffsets(target, repeatedlyDraggedDimension);
          const nextLayout = angleDimensionLayout(target, repeatedlyDraggedDimension);
          const nextBasis = angleDimensionLabelBasis(target, repeatedlyDraggedDimension);
          repeatedDragOffsetError = Math.max(
            repeatedDragOffsetError,
            hypot2(nextOffsets.radial - dragOffsets.radial, nextOffsets.tangent - dragOffsets.tangent),
          );
          repeatedDragRadialPointerError = Math.max(
            repeatedDragRadialPointerError,
            Math.abs(
              (nextLayout.text.x - pointer.x) * nextBasis.radial.x +
              (nextLayout.text.y - pointer.y) * nextBasis.radial.y,
            ),
          );
        }
        const serialized = serializeDimension(repeatedlyDraggedDimension, target);
        return {
          migratedLegacyCoordinates: !Object.hasOwn(initial, "labelX") && !Object.hasOwn(initial, "labelY"),
          recoveredCorruptedOffsets,
          storedOffsets,
          labelTranslationError,
          arcTranslationError,
          radiusFollowError: hypot2(labelRadiusDelta.x - arcRadiusDelta.x, labelRadiusDelta.y - arcRadiusDelta.y),
          repeatedDragOffsetError,
          repeatedDragRadialPointerError,
          serializedRelativeOffsets: Number.isFinite(serialized.angleLabelOffsetR) && Number.isFinite(serialized.angleLabelOffsetT),
          serializedPlacementVersion: serialized.angleLabelPlacementVersion,
          serializedLegacyCoordinates: Object.hasOwn(serialized, "labelX") || Object.hasOwn(serialized, "labelY"),
        };
      },
      resetForTrimConstraintTransfer() {
        resetModelState();
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const leftPoint = addPoint(25, 0, false, "endpoint");
        const rightPoint = addPoint(75, 0, false, "endpoint");
        const leftConstraint = pushModelConstraint(new PointOnLineConstraint(leftPoint, line));
        const rightConstraint = pushModelConstraint(new PointOnLineConstraint(rightPoint, line));
        executeLineTrim({
          kind: "line",
          item: line,
          interval: {
            left: { t: 0.4, point: { x: 40, y: 0 }, source: {} },
            right: { t: 0.6, point: { x: 60, y: 0 }, source: {} },
          },
        });
        const rightLine = model.lines.find((candidate) => candidate !== line);
        return {
          lineCount: model.lines.length,
          leftConstraintOnLeftLine: leftConstraint.line === line,
          rightConstraintOnRightLine: rightConstraint.line === rightLine,
          leftLineEnd: { x: line.p2.x, y: line.p2.y },
          rightLineStart: rightLine ? { x: rightLine.p1.x, y: rightLine.p1.y } : null,
        };
      },
      annotationSnapshot() {
        const leaderElement = [...model.annotations].reverse().find((element) => element.type === "leader");
        const textElement = [...model.annotations].reverse().find((element) => element.type === "text");
        const canvasRect = canvas.getBoundingClientRect();
        const toViewport = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: canvasRect.left + screen.x, y: canvasRect.top + screen.y };
        };
        return {
          leader: leaderElement
            ? {
                world: { ...leaderElement.end },
                viewport: toViewport(leaderElement.end),
                end: { ...leaderElement.end },
                elbow: leaderElement.elbow ? { ...leaderElement.elbow } : null,
              }
            : null,
          text: textElement ? { world: { x: textElement.x, y: textElement.y }, viewport: toViewport(textElement) } : null,
        };
      },
      annotationHitAt(viewportPoint) {
        const canvasRect = canvas.getBoundingClientRect();
        const world = screenToWorld({ x: viewportPoint.x - canvasRect.left, y: viewportPoint.y - canvasRect.top });
        const hit = hitAnnotationElement(world.x, world.y);
        return hit ? { type: hit.type, part: hit.part } : null;
      },
      annotationDragActive() {
        const element = annotationById(annotationDragSession?.elementId);
        return annotationDragSession
          ? {
              type: annotationDragSession.hit?.type,
              hasStart: Boolean(annotationDragSession.start),
              elementId: element?.id || null,
            }
          : null;
      },
      historyState() {
        const activeUndo = blockEditSession ? blockEditSession.historyUndo : undoStack;
        const activeRedo = blockEditSession ? blockEditSession.historyRedo : redoStack;
        return {
          undoCount: activeUndo.length,
          redoCount: activeRedo.length,
          blockEditing: Boolean(blockEditSession),
          undoDisabled: document.getElementById("undoBtn")?.disabled,
          redoDisabled: document.getElementById("redoBtn")?.disabled,
          constructionLineMode,
          constructionButtonActive: document.getElementById("toolConstructionLine")?.classList.contains("active"),
        };
      },
      resetForActiveSketchDimensionVisibility() {
        resetModelState();
        const firstSketchId = activeSketchId();
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(100, 0, false, "endpoint");
        const firstLine = addLine(p1, p2);
        addDistanceConstraintFromTarget(
          { kind: "line-length", line: firstLine, p1, p2, value: firstLine.length() },
          firstLine.length(),
          dimensionFromAnchor({ kind: "line-length", line: firstLine, p1, p2, value: firstLine.length() }, { x: 50, y: -30 }),
          { sketchId: firstSketchId },
        );

        const secondSketchId = "S2";
        model.sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = secondSketchId;
        const p3 = addPoint(0, 80, false, "endpoint");
        const p4 = addPoint(160, 80, false, "endpoint");
        const secondLine = addLine(p3, p4);
        addDistanceConstraintFromTarget(
          { kind: "line-length", line: secondLine, p1: p3, p2: p4, value: secondLine.length() },
          secondLine.length(),
          dimensionFromAnchor({ kind: "line-length", line: secondLine, p1: p3, p2: p4, value: secondLine.length() }, { x: 80, y: 50 }),
          { sketchId: secondSketchId },
        );
        model.activeSketchId = firstSketchId;
        const captureDimensionLabels = () => {
          const labels = [];
          const originalFillText = ctx.fillText;
          ctx.fillText = (value) => labels.push(String(value));
          try {
            drawDimensions();
          } finally {
            ctx.fillText = originalFillText;
          }
          return labels;
        };
        const drawnDimensionLabels = captureDimensionLabels();
        sketchById(secondSketchId).appearance = { ...sketchById(secondSketchId).appearance, visible: false };
        const labelsAfterHidingSecondSketch = captureDimensionLabels();
        sketchById(secondSketchId).appearance = { ...sketchById(secondSketchId).appearance, visible: true };
        return {
          activeSketchId: firstSketchId,
          dimensionSketchIds: model.constraints.filter(isDimensionConstraint).map((constraint) => constraintSketchId(constraint)),
          drawnDimensionSketchIds: model.constraints
            .filter((constraint) => isDimensionConstraint(constraint) && isVisibleSketchId(constraintSketchId(constraint)))
            .map((constraint) => constraintSketchId(constraint)),
          drawnDimensionLabels,
          labelsAfterHidingSecondSketch,
        };
      },
      resetForAllGeometryFit() {
        resetModelState();
        const p1 = addPoint(-50000, -25000, false, "endpoint");
        const p2 = addPoint(-40000, -25000, false, "endpoint");
        addLine(p1, p2);
        const secondSketchId = "S2";
        model.sketches.push({ id: secondSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = secondSketchId;
        const p3 = addPoint(45000, 30000, false, "endpoint");
        const p4 = addPoint(50000, 30000, false, "endpoint");
        addLine(p3, p4);
        viewport.scale = 10;
        viewport.x = -100000;
        viewport.y = 50000;
        fitAllGeometryToViewport();
        const bounds = allGeometryBounds();
        const screen = screenBoxForBounds(bounds);
        const rect = canvas.getBoundingClientRect();
        return {
          screen,
          canvas: { width: rect.width, height: rect.height },
          scale: viewport.scale,
        };
      },
      resetForMiddleButtonFit() {
        resetModelState();
        const nearLine = addLine(addPoint(0, 0, true, "endpoint"), addPoint(100, 0, true, "endpoint"));
        const hiddenSketchId = "S2";
        model.sketches.push({ id: hiddenSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: false });
        const previousActive = model.activeSketchId;
        model.activeSketchId = hiddenSketchId;
        addLine(addPoint(10000, 0, true, "endpoint"), addPoint(10100, 0, true, "endpoint"));
        model.activeSketchId = previousActive;
        viewport.scale = 0.02;
        viewport.x = 10;
        viewport.y = 10;
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        return {
          click: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          nearLineId: nearLine.id,
        };
      },
      middleButtonFitState() {
        const rect = canvas.getBoundingClientRect();
        return {
          scale: viewport.scale,
          visibleScreen: screenBoxForBounds(visibleGeometryBounds()),
          canvas: { width: rect.width, height: rect.height },
          hiddenVisible: isVisibleSketchId("S2"),
        };
      },
      canvasDashIsolationCases() {
        const results = {};
        const resetForCase = () => {
          resetModelState();
          viewport.scale = 1;
          viewport.x = 0;
          viewport.y = 0;
          pointerPreview = null;
          trimPreview = null;
          selectionRectSession = null;
          mode = "select";
        };
        const capture = (name, setup, drawFn) => {
          resetForCase();
          setup();
          ctx.setLineDash([13, 7]);
          drawFn();
          results[name] = ctx.getLineDash();
        };
        const makeBlockDefinition = () => {
          const definition = createEmptyBlockDefinition("Block-Dash");
          const p1 = new Point("BP1", 0, 0, false, "endpoint");
          const p2 = new Point("BP2", 40, 0, false, "endpoint");
          p1.sketchId = DEFAULT_SKETCH_ID;
          p2.sketchId = DEFAULT_SKETCH_ID;
          const line = new Line("BL1", p1, p2);
          line.sketchId = DEFAULT_SKETCH_ID;
          definition.points.push(p1, p2);
          definition.lines.push(line);
          model.blockDefinitions.push(definition);
          return definition;
        };

        capture("line", () => {
          mode = "line";
          lineStartPoint = addPoint(0, 0, true, "endpoint");
          pointerPreview = { x: 80, y: 0 };
        }, drawTemporaryLine);
        capture("rectangle", () => {
          mode = "rectangle";
          rectangleStartPoint = { x: 0, y: 0 };
          pointerPreview = { x: 80, y: 45 };
        }, drawRectanglePreview);
        capture("circle", () => {
          mode = "circle";
          circleCenterPoint = addPoint(0, 0, true, "center");
          pointerPreview = { x: 35, y: 0 };
        }, drawCirclePreview);
        capture("arc", () => {
          mode = "arc";
          arcCenterPoint = addPoint(0, 0, true, "center");
          arcStartPoint = { radius: 35, startAngle: 0 };
          pointerPreview = { x: 0, y: 35 };
        }, drawArcPreview);
        capture("offset", () => {
          mode = "offset";
          offsetSource = addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
          pointerPreview = { x: 40, y: 20 };
        }, drawOffsetPreview);
        capture("trim", () => {
          mode = "trim";
          trimPreview = {
            kind: "line",
            interval: {
              left: { point: { x: 0, y: 0 } },
              right: { point: { x: 80, y: 0 } },
            },
          };
        }, drawTrimPreview);
        capture("selection", () => {
          selectionRectSession = { start: { x: 0, y: 0 }, current: { x: 80, y: 45 } };
        }, drawSelectionRect);
        capture("blockPlacement", () => {
          const definition = makeBlockDefinition();
          mode = "block-place";
          blockPlacementDefinitionId = definition.id;
          blockPlacementEnabledSketchIds = [DEFAULT_SKETCH_ID];
          pointerPreview = { x: 120, y: 40 };
        }, drawBlockPlacementPreview);
        capture("blockHandles", () => {
          const definition = makeBlockDefinition();
          const instance = { id: "BI-DASH", definitionId: definition.id, sketchId: activeSketchId(), x: 20, y: 20, rotation: 0, fixed: false, enabledSketchIds: [DEFAULT_SKETCH_ID] };
          model.blockInstances.push(instance);
          selectedBlockInstances = [instance];
        }, drawBlockInstanceHandles);
        capture("annotationLeader", () => {}, () => drawAnnotationLeader({
          start: { x: 0, y: 0 },
          elbow: { x: 40, y: 15 },
          end: { x: 80, y: 15 },
          text: "note",
          style: {},
        }, true));
        capture("frame", () => {
          addLine(addPoint(0, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
        }, draw);
        return results;
      },
      resetForSidebarInspection() {
        resetModelState();
        const p1 = addPoint(-80, 0, true, "endpoint");
        const p2 = addPoint(20, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const circleCenter = addPoint(80, 0, false, "endpoint");
        const circle = addCircle(circleCenter, 28);
        const arcCenter = addPoint(0, 80, false, "endpoint");
        const arc = addArc(arcCenter, 32, Math.PI, Math.PI * 1.75);
        const horizontal = pushModelConstraint(new HorizontalConstraint(line));
        horizontal.reference = true;
        const readOnly = new DistanceConstraint(p1, p2, line.length());
        readOnly.dimension = dimensionFromAnchor({ kind: "line-length", line, p1, p2, value: line.length() }, { x: -30, y: -28 });
        readOnly.readOnlyDimension = true;
        readOnly.enabled = false;
        assignConstraintSketchId(readOnly, activeSketchId());
        model.constraints.push(readOnly);
        updateUI();
        fitAllGeometryToViewport(140);
        draw();
        const rect = canvas.getBoundingClientRect();
        const lineMid = worldToCanvasScreen({ x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 });
        return {
          line: line.id,
          lineEndpoints: [p1.id, p2.id],
          fixedPoint: p1.id,
          circle: circle.id,
          circleCenter: circleCenter.id,
          arc: arc.id,
          arcCenter: arcCenter.id,
          lineMid: { x: rect.left + lineMid.x, y: rect.top + lineMid.y },
          blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 },
        };
      },
      resetForFixedPointDisplayTest() {
        resetModelState();
        viewport.scale = 1;
        const point = addPoint(0, 0, true, "explicit");
        updateUI();
        fitAllGeometryToViewport(220);
        draw();
        const rect = canvas.getBoundingClientRect();
        return {
          pointId: point.id,
          point: this.worldClientPositionForTest(point),
          blank: { x: rect.left + rect.width - 30, y: rect.top + rect.height - 30 },
        };
      },
      resetForSketchTreeBlockHoverTest() {
        resetModelState();
        viewport.scale = 1;
        const definition = createEmptyBlockDefinition("Tree Hover Block");
        const lineP1 = new Point("BP1", -80, 0, false, "endpoint");
        const lineP2 = new Point("BP2", 80, 0, false, "endpoint");
        lineP1.sketchId = DEFAULT_SKETCH_ID;
        lineP2.sketchId = DEFAULT_SKETCH_ID;
        const blockLine = new Line("BL1", lineP1, lineP2);
        blockLine.sketchId = DEFAULT_SKETCH_ID;
        const explicitPoints = [
          new Point("BP3", -70, -45, false, "explicit"),
          new Point("BP4", 70, -45, false, "explicit"),
          new Point("BP5", -70, 45, false, "explicit"),
          new Point("BP6", 70, 45, false, "explicit"),
        ];
        explicitPoints.forEach((point) => {
          point.sketchId = DEFAULT_SKETCH_ID;
        });
        definition.points.push(lineP1, lineP2, ...explicitPoints);
        definition.lines.push(blockLine);
        model.blockDefinitions.push(definition);
        const instance = {
          id: `BI${blockInstanceSeq++}`,
          definitionId: definition.id,
          sketchId: DEFAULT_SKETCH_ID,
          x: 0,
          y: 0,
          rotation: 0,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: [DEFAULT_SKETCH_ID],
          appearanceOverride: {},
        };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();
        updateUI();
        fitAllGeometryToViewport(180);
        draw();
        const bundle = blockProjectionBundle(instance);
        return {
          sketchId: DEFAULT_SKETCH_ID,
          instanceId: instance.id,
          projectedExplicitPointIds: bundle.points.filter((point) => point.localElement?.kind === "explicit").map((point) => point.id),
          blockLineMid: this.worldClientPositionForTest({ x: 0, y: 0 }),
        };
      },
      resetForOffsetConstraints() {
        resetModelState();
        const lineP1 = addPoint(-120, -70, true, "endpoint");
        const lineP2 = addPoint(-20, -70, true, "endpoint");
        const sourceLine = addLine(lineP1, lineP2);
        const sourceCircle = addCircle(addPoint(80, -20, true, "center"), 30);
        const sourceArc = addArc(addPoint(0, 90, true, "center"), 40, 0, Math.PI / 2);
        pushModelConstraint(new RadiusConstraint(sourceCircle, 30));
        pushModelConstraint(new RadiusConstraint(sourceArc, 40));

        const lineCreated = createOffsetGeometry(sourceLine, 20, 1, { x: -70, y: -50 });
        const circleCreated = createOffsetGeometry(sourceCircle, 15, 1, { x: 125, y: -20 });
        const arcCreated = createOffsetGeometry(sourceArc, 10, -1, { x: 0, y: 120 });
        const offsets = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        offsets[0].target = 25;
        offsets[1].target = 18;
        offsets[2].target = 12;
        offsets[0].expression = "25";
        offsets[1].expression = "18";
        offsets[2].expression = "12";
        offsets.forEach(preconditionNewConstraint);
        solveSketchAndDependents(activeSketchId(), snapshotModelState());
        const measurements = offsets.map((constraint) => measuredConstraintTargetValue(constraint));
        const sourceRadii = [sourceCircle.radius(), sourceArc.radius()];
        const serialized = serializeModel();
        loadModelData(serialized);
        const restored = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        fitAllGeometryToViewport(140);
        draw();
        return {
          created: [lineCreated, circleCreated, arcCreated],
          measurements,
          sourceRadii,
          restoredCount: restored.length,
          restoredTypes: serializeModel().constraints.filter((constraint) => constraint.type === "offsetDimension").length,
          restoredTargets: restored.map((constraint) => constraint.target),
          geometry: { lines: model.lines.length, circles: model.circles.length, arcs: model.arcs.length },
        };
      },
      resetForOffsetUi() {
        resetModelState();
        const p1 = addPoint(-60, 0, false, "endpoint");
        const p2 = addPoint(60, 0, false, "endpoint");
        addLine(p1, p2);
        fitAllGeometryToViewport(220);
        draw();
        const rect = canvas.getBoundingClientRect();
        const source = worldToCanvasScreen({ x: 0, y: 0 });
        const side = worldToCanvasScreen({ x: 0, y: 35 });
        return {
          source: { x: rect.left + source.x, y: rect.top + source.y },
          side: { x: rect.left + side.x, y: rect.top + side.y },
        };
      },
      offsetUiState() {
        const constraints = model.constraints.filter((constraint) => constraint instanceof OffsetConstraint);
        const preview = offsetSource && pointerPreview ? offsetDistanceFromPointer(offsetSource, pointerPreview) : null;
        return {
          pendingType: pendingCommand?.type || null,
          lineCount: model.lines.length,
          constraintCount: constraints.length,
          targets: constraints.map((constraint) => constraint.target),
          toolActive: document.getElementById("toolOffset")?.classList.contains("active"),
          previewDistance: preview?.distance ?? null,
          previewSign: preview?.sign ?? null,
          lineOffsetDeltas: constraints
            .filter((constraint) => constraint.source instanceof Line)
            .map((constraint) => ({
              x: (constraint.offset.p1.x + constraint.offset.p2.x - constraint.source.p1.x - constraint.source.p2.x) / 2,
              y: (constraint.offset.p1.y + constraint.offset.p2.y - constraint.source.p1.y - constraint.source.p2.y) / 2,
            })),
        };
      },
      resetForOffsetDirection(directionCase = "vertical") {
        resetModelState();
        const horizontal = directionCase === "horizontal";
        const p1 = addPoint(horizontal ? 60 : 0, horizontal ? 0 : 60, false, "endpoint");
        const p2 = addPoint(horizontal ? -60 : 0, horizontal ? 0 : -60, false, "endpoint");
        const line = addLine(p1, p2);
        pushModelConstraint(horizontal ? new HorizontalConstraint(line) : new VerticalConstraint(line));
        solveAndRefresh("offset direction test");
        fitAllGeometryToViewport(220);
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          source: screenPoint({ x: 0, y: 0 }),
          side: screenPoint(horizontal ? { x: 0, y: 35 } : { x: 35, y: 0 }),
          expectedAxis: horizontal ? "y" : "x",
        };
      },
      resetForSketchDeletion() {
        resetModelState();
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.sketches.push({ id: "S3", name: "Sketch-2-1", parentSketchId: "S2", kind: "sketch" });
        model.sketches.push({ id: "S4", name: "Sketch-3", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = "S2";
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(80, 0, false, "endpoint");
        const line = addLine(p1, p2);
        model.activeSketchId = "S3";
        const center = addPoint(30, 30, false, "center");
        const circle = addCircle(center, 20);
        line.appearance = { color: "#ef4444" };
        circle.appearance = { color: "#22c55e" };
        model.annotations.push({ id: "AN-test", type: "leader", visible: true, geometryRef: geometryRefForItem(line), start: { x: 0, y: 0 }, end: { x: 30, y: 20 }, style: {} });
        model.activeSketchId = "S3";
        const deleted = deleteSketch("S2", false);
        return {
          deleted,
          sketchIds: model.sketches.map((sketch) => sketch.id),
          activeSketchId: model.activeSketchId,
          geometry: { points: model.points.length, lines: model.lines.length, circles: model.circles.length, arcs: model.arcs.length },
          annotationCount: model.annotations.length,
        };
      },
      resetForSiblingVisibility() {
        resetModelState();
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = "S2";
        const p1 = addPoint(-40, 0, false, "endpoint");
        const p2 = addPoint(40, 0, false, "endpoint");
        const line = addLine(p1, p2);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        updateUI();
        draw();
        return {
          visible: isVisibleSketchId("S2"),
          relation: sketchRelationToActive("S2"),
          strokeWidth: sketchStrokeWidth(line),
          color: constraintStatusColor(line),
          rowHasVisibleClass: document.querySelector('.sketch-item[data-id="S2"]')?.classList.contains("visible") || false,
        };
      },
      resetForInactiveDimensionAndBlockHover() {
        resetModelState();
        const sourceSketchId = activeSketchId();
        const p1 = addPoint(-120, -55, false, "endpoint");
        const p2 = addPoint(-20, -55, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        addDistanceConstraintFromTarget(
          target,
          line.length(),
          dimensionFromAnchor(target, { x: -70, y: -95 }),
          { sketchId: sourceSketchId },
        );
        const dimensionConstraint = model.constraints.find((constraint) => isDimensionConstraint(constraint));

        const definition = createEmptyBlockDefinition("Hover Block");
        const bp1 = new Point("BP1", -30, 0, false, "endpoint");
        const bp2 = new Point("BP2", 30, 0, false, "endpoint");
        bp1.sketchId = sourceSketchId;
        bp2.sketchId = sourceSketchId;
        const blockLine = new Line("BL1", bp1, bp2);
        blockLine.sketchId = sourceSketchId;
        definition.points.push(bp1, bp2);
        definition.lines.push(blockLine);
        model.blockDefinitions.push(definition);
        const instance = {
          id: `BI${blockInstanceSeq++}`,
          definitionId: definition.id,
          sketchId: sourceSketchId,
          x: 95,
          y: 65,
          rotation: 0,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: [sourceSketchId],
          appearanceOverride: {},
        };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();

        const activeChildId = "S2";
        model.sketches.push({ id: activeChildId, name: "Sketch-2", parentSketchId: sourceSketchId, kind: "sketch", visible: true, appearance: {} });
        model.activeSketchId = activeChildId;
        fitAllGeometryToViewport(180);
        updateUI();
        draw();
        const layout = dimensionLayout(targetFromConstraint(dimensionConstraint), dimensionConstraint.dimension);
        return {
          dimension: this.worldClientPositionForTest(layout.text),
          line: this.worldClientPositionForTest({ x: (line.p1.x + line.p2.x) / 2, y: (line.p1.y + line.p2.y) / 2 }),
          block: this.worldClientPositionForTest(blockInstanceDisplayCenter(instance)),
          dimensionId: dimensionConstraint.name || "寸法",
          lineId: line.id,
          blockId: instance.id,
          sourceSketchId,
          activeSketchId: activeChildId,
          relation: sketchIdentityRelationLabel(sourceSketchId),
        };
      },
      hoverIdentityStateForTest() {
        return hoveredSketchIdentity ? {
          kind: hoveredSketchIdentity.kind || null,
          id: hoveredSketchIdentity.id,
          sketchId: hoveredSketchIdentity.sketchId,
          relation: sketchIdentityRelationLabel(hoveredSketchIdentity.sketchId),
          hoveredDimension: hoveredDimensionConstraint ? hoveredDimensionConstraint.name || "寸法" : null,
          hoveredBlock: hoveredBlockInstance?.id || null,
        } : null;
      },
      geometryStrokeStyleCasesForTest() {
        resetModelState();
        const activeNormal = addLine(addPoint(-80, -25, false, "endpoint"), addPoint(80, -25, false, "endpoint"));
        const activeConstruction = addLine(addPoint(-80, 25, false, "endpoint"), addPoint(80, 25, false, "endpoint"), true);
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.activeSketchId = "S2";
        const inactiveNormal = addLine(addPoint(-80, 75, false, "endpoint"), addPoint(80, 75, false, "endpoint"));
        const inactiveConstruction = addLine(addPoint(-80, 125, false, "endpoint"), addPoint(80, 125, false, "endpoint"), true);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        return {
          activeNormal: geometryStrokeWidth(activeNormal),
          activeConstruction: geometryStrokeWidth(activeConstruction, { construction: true }),
          inactiveNormal: geometryStrokeWidth(inactiveNormal),
          inactiveConstruction: geometryStrokeWidth(inactiveConstruction, { construction: true }),
          selected: geometryStrokeWidth(activeNormal, { selected: true }),
          hovered: geometryStrokeWidth(activeNormal, { hovered: true }),
          constructionAlpha: CONSTRUCTION_GEOMETRY_ALPHA,
        };
      },
      constructionLineHoverDisplayCasesForTest() {
        const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const captureOverhang = (line, setupHover) => {
          const segments = [];
          let start = null;
          const originalMoveTo = ctx.moveTo;
          const originalLineTo = ctx.lineTo;
          ctx.moveTo = (x, y) => {
            start = { x, y };
          };
          ctx.lineTo = (x, y) => {
            if (start) segments.push({ p1: start, p2: { x, y } });
          };
          try {
            setupHover();
            drawLines();
          } finally {
            ctx.moveTo = originalMoveTo;
            ctx.lineTo = originalLineTo;
          }
          const segment = segments[0];
          return segment ? ((distance(segment.p1, line.p1) + distance(segment.p2, line.p2)) / 2) * viewport.scale : null;
        };

        resetModelState();
        viewport.scale = 2;
        const line = addLine(addPoint(-40, 0, false, "endpoint"), addPoint(40, 0, false, "endpoint"), true);
        const direct = captureOverhang(line, () => {
          hoveredLine = line;
        });

        resetModelState();
        viewport.scale = 2;
        const definition = createEmptyBlockDefinition("Block-Construction-Hover");
        const p1 = new Point("BP1", -40, 0, false, "endpoint");
        const p2 = new Point("BP2", 40, 0, false, "endpoint");
        p1.sketchId = DEFAULT_SKETCH_ID;
        p2.sketchId = DEFAULT_SKETCH_ID;
        const localLine = new Line("BL1", p1, p2, true);
        localLine.sketchId = DEFAULT_SKETCH_ID;
        definition.points.push(p1, p2);
        definition.lines.push(localLine);
        model.blockDefinitions.push(definition);
        const instance = {
          id: "BI-HOVER",
          definitionId: definition.id,
          sketchId: DEFAULT_SKETCH_ID,
          x: 0,
          y: 0,
          rotation: 0,
          fixed: false,
          rotationLocked: false,
          enabledSketchIds: [DEFAULT_SKETCH_ID],
          appearanceOverride: {},
        };
        model.blockInstances.push(instance);
        invalidateBlockProjectionCache();
        const projection = blockProjectionBundle(instance).lines[0];
        const block = captureOverhang(projection, () => {
          hoveredBlockInstance = instance;
        });
        hoveredLine = null;
        hoveredBlockInstance = null;
        return { direct, block };
      },
      constructionLineRenderingForTest(lineId) {
        const line = allGeometryLines().find((item) => item.id === lineId);
        if (!line) return null;
        const segments = [];
        let start = null;
        let endpointMarkerCount = 0;
        const originalMoveTo = ctx.moveTo;
        const originalLineTo = ctx.lineTo;
        const originalArc = ctx.arc;
        ctx.moveTo = (x, y) => {
          start = { x, y };
        };
        ctx.lineTo = (x, y) => {
          if (start) segments.push({ p1: start, p2: { x, y } });
        };
        ctx.arc = (...args) => {
          endpointMarkerCount += 1;
          return originalArc.apply(ctx, args);
        };
        try {
          drawLines();
        } finally {
          ctx.moveTo = originalMoveTo;
          ctx.lineTo = originalLineTo;
          ctx.arc = originalArc;
        }
        const segment = segments[0];
        const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const overhangPx = segment ? ((distance(segment.p1, line.p1) + distance(segment.p2, line.p2)) / 2) * viewport.scale : null;
        const appearance = effectiveAppearanceForElement(line);
        return {
          endpointOverhang: appearance.endpointOverhang !== false,
          endpointMarkers: appearance.endpointMarkers !== false,
          overhangPx: overhangPx == null ? null : Number(overhangPx.toFixed(6)),
          endpointMarkerCount,
        };
      },
      resetForSiblingSubtreeReference() {
        resetModelState();
        const parentSketchId = "S10";
        const siblingSketchId = "S2";
        const siblingChildId = "S3";
        const siblingGrandchildId = "S4";
        const unrelatedSketchId = "S9";
        const activeChildSketchId = "S11";
        const active = sketchById(DEFAULT_SKETCH_ID);
        active.parentSketchId = parentSketchId;
        model.sketches.push({ id: parentSketchId, name: "Sketch-P", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingSketchId, name: "Sketch-S", parentSketchId, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingChildId, name: "Sketch-S-1", parentSketchId: siblingSketchId, kind: "sketch", visible: true });
        model.sketches.push({ id: siblingGrandchildId, name: "Sketch-S-1-1", parentSketchId: siblingChildId, kind: "sketch", visible: true });
        model.sketches.push({ id: unrelatedSketchId, name: "Sketch-U", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: activeChildSketchId, name: "Sketch-1-1", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", visible: true });

        model.activeSketchId = DEFAULT_SKETCH_ID;
        const activePoint = addPoint(45, 70, false, "explicit");
        model.activeSketchId = activeChildSketchId;
        const childLine = addLine(addPoint(-80, 80, true, "endpoint"), addPoint(80, 80, true, "endpoint"));
        model.activeSketchId = siblingSketchId;
        addLine(addPoint(-80, 0, true, "endpoint"), addPoint(80, 0, true, "endpoint"));
        model.activeSketchId = siblingChildId;
        addLine(addPoint(-80, 20, true, "endpoint"), addPoint(80, 20, true, "endpoint"));
        model.activeSketchId = siblingGrandchildId;
        const referenceLine = addLine(addPoint(-80, 40, true, "endpoint"), addPoint(80, 40, true, "endpoint"));
        model.activeSketchId = unrelatedSketchId;
        const unrelatedLine = addLine(addPoint(-80, -40, true, "endpoint"), addPoint(80, -40, true, "endpoint"));
        model.activeSketchId = DEFAULT_SKETCH_ID;
        refreshReferenceConstraintValidity();
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          activePoint: screenPoint(activePoint),
          referenceLine: screenPoint({ x: 45, y: 40 }),
          unrelatedLine: screenPoint({ x: 45, y: -40 }),
          childLine: screenPoint({ x: 45, y: 80 }),
          relations: Object.fromEntries([parentSketchId, siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchRelationToActive(id)])),
          relationLabels: Object.fromEntries([unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchIdentityRelationLabel(id)])),
          relationColors: Object.fromEntries([unrelatedSketchId, activeChildSketchId].map((id) => [id, sketchIdentityRelationColor(id)])),
          rowBackgrounds: Object.fromEntries([siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => {
            const row = document.querySelector(`.sketch-item[data-id="${id}"]`);
            return [id, row ? getComputedStyle(row).backgroundColor : ""];
          })),
          visible: Object.fromEntries([parentSketchId, siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, isVisibleSketchId(id)])),
          rowClasses: Object.fromEntries([siblingSketchId, siblingChildId, siblingGrandchildId, unrelatedSketchId, activeChildSketchId].map((id) => [id, document.querySelector(`.sketch-item[data-id="${id}"]`)?.classList.contains("visible") || false])),
          referenceLineId: referenceLine.id,
          unrelatedLineId: unrelatedLine.id,
          childLineId: childLine.id,
        };
      },
      siblingSubtreeVisibilityState() {
        return Object.fromEntries(["S2", "S3", "S4"].map((id) => [id, {
          preferenceVisible: sketchById(id)?.visible !== false,
          effectiveVisible: isVisibleSketchId(id),
        }]));
      },
      moveSiblingSubtreeReferenceLine(dy) {
        const line = model.lines.find((item) => elementSketchId(item) === "S4");
        if (!line) return null;
        line.p1.y += dy;
        line.p2.y += dy;
        const result = solveReferenceDependentSketches("S4");
        refreshConstraintAnalysis();
        updateUI();
        draw();
        const point = model.points.find((item) => elementSketchId(item) === DEFAULT_SKETCH_ID && isExplicitPoint(item));
        return {
          success: result.success,
          dependentSketchIds: result.results.map((entry) => entry.sketchId),
          point: point ? { x: point.x, y: point.y } : null,
          line: { p1: { x: line.p1.x, y: line.p1.y }, p2: { x: line.p2.x, y: line.p2.y } },
        };
      },
      deleteSketchForTest(sketchId) {
        return deleteSketch(sketchId, false);
      },
      referenceDependencyOrderCase() {
        resetModelState();
        const parentSketchId = "S10";
        const childSketchId = "S5";
        sketchById(DEFAULT_SKETCH_ID).parentSketchId = parentSketchId;
        model.sketches.push({ id: parentSketchId, name: "Sketch-P", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.sketches.push({ id: childSketchId, name: "Sketch-1-1", parentSketchId: DEFAULT_SKETCH_ID, kind: "sketch", visible: true });
        model.activeSketchId = parentSketchId;
        const sourceLine = addLine(addPoint(-50, 0, true, "endpoint"), addPoint(50, 0, true, "endpoint"));
        model.activeSketchId = DEFAULT_SKETCH_ID;
        const activePoint = addPoint(0, 15, false, "explicit");
        const first = markReferenceConstraint(new PointOnLineConstraint(activePoint, sourceLine), parentSketchId, DEFAULT_SKETCH_ID);
        model.constraints.push(first);
        model.activeSketchId = childSketchId;
        const childPoint = addPoint(0, 30, false, "explicit");
        const second = markReferenceConstraint(new CoincidentConstraint(childPoint, activePoint), DEFAULT_SKETCH_ID, childSketchId);
        model.constraints.push(second);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        refreshReferenceConstraintValidity();
        sourceLine.p1.y = 25;
        sourceLine.p2.y = 25;
        const result = solveReferenceDependentSketches(parentSketchId);
        return {
          order: result.results.map((entry) => entry.sketchId),
          activePointY: activePoint.y,
          childPointY: childPoint.y,
        };
      },
      cyclicReferenceLoadCase() {
        resetModelState();
        model.sketches.push({ id: "S2", name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch", visible: true });
        model.activeSketchId = DEFAULT_SKETCH_ID;
        const p1 = addPoint(0, 0, false, "explicit");
        model.activeSketchId = "S2";
        const p2 = addPoint(20, 0, false, "explicit");
        const forward = markReferenceConstraint(new CoincidentConstraint(p1, p2), "S2", DEFAULT_SKETCH_ID);
        const reverse = markReferenceConstraint(new CoincidentConstraint(p2, p1), DEFAULT_SKETCH_ID, "S2");
        model.constraints.push(forward, reverse);
        const serialized = serializeModel();
        serialized.activeSketchId = DEFAULT_SKETCH_ID;
        loadModelData(serialized);
        refreshConstraintAnalysis();
        updateUI();
        return {
          total: model.constraints.length,
          operational: model.constraints.filter(constraintIsOperational).length,
          invalid: [...invalidReferenceConstraints.values()],
          badges: document.querySelectorAll(".sketch-reference-error-badge, .constraint-reference-error-badge").length,
        };
      },
      sketchVisibilityState(sketchId) {
        const sketch = sketchById(sketchId);
        const serialized = serializeModel().sketches.find((item) => item.id === sketchId);
        return {
          preferenceVisible: sketch?.visible !== false,
          effectiveVisible: isVisibleSketchId(sketchId),
          serializedVisible: serialized?.appearance?.visible,
          buttonPressed: document.querySelector(`.sketchVisibilityBtn[data-id="${sketchId}"]`)?.getAttribute("aria-pressed") || null,
        };
      },
      resetForConstraintDimensionSelection() {
        resetModelState();
        const p1 = addPoint(-50, 0, false, "endpoint");
        const p2 = addPoint(50, 0, false, "endpoint");
        const line = addLine(p1, p2);
        const target = { kind: "line-length", line, p1, p2, value: line.length() };
        const constraint = new DistanceConstraint(p1, p2, line.length());
        constraint.dimension = dimensionFromAnchor(target, { x: 0, y: -30 });
        pushModelConstraint(constraint);
        selectedDimensionConstraint = constraint;
        pendingConstraintCommand = { type: "parallel" };
        updateUI();
        fitAllGeometryToViewport(180);
        draw();
        const rect = canvas.getBoundingClientRect();
        return { blank: { x: rect.left + rect.width - 35, y: rect.top + rect.height - 35 } };
      },
      constraintDimensionSelectionState() {
        return {
          selected: Boolean(selectedDimensionConstraint),
          command: pendingConstraintCommand?.type || null,
        };
      },
      resetForSupportConstraintStatus() {
        resetModelState();

        const anchor = addPoint(-60, -40, true, "explicit");
        const supportLine = addLine(addPoint(-100, -40, false, "endpoint"), addPoint(-20, -40, false, "endpoint"));
        pushModelConstraint(new HorizontalConstraint(supportLine));
        pushModelConstraint(new PointOnLineConstraint(anchor, supportLine));

        const underLine = addLine(addPoint(20, 0, false, "endpoint"), addPoint(100, 0, false, "endpoint"));
        pushModelConstraint(new HorizontalConstraint(underLine));

        const fullLine = addLine(addPoint(-100, 50, true, "endpoint"), addPoint(-20, 50, true, "endpoint"));
        const supportArc = addArc(addPoint(65, 60, true, "center"), 30, Math.PI, Math.PI * 1.5);
        pushModelConstraint(new RadiusConstraint(supportArc, 30));

        solveSketchAndDependents(activeSketchId(), snapshotModelState());
        refreshConstraintAnalysis();
        fitAllGeometryToViewport(150);
        draw();
        return {
          supportLine: { status: constraintStatusOf(supportLine), color: constraintStatusColor(supportLine) },
          underLine: { status: constraintStatusOf(underLine), color: constraintStatusColor(underLine) },
          fullLine: { status: constraintStatusOf(fullLine), color: constraintStatusColor(fullLine) },
          supportArc: { status: constraintStatusOf(supportArc), color: constraintStatusColor(supportArc) },
          summary: constraintAnalysisState.summary,
        };
      },
      resetForReferencePointLineCoincidence() {
        resetModelState();
        const parentPoint = addPoint(-45, 0, false, "explicit");
        const parentLineP1 = addPoint(20, -20, false, "endpoint");
        const parentLineP2 = addPoint(80, -20, false, "endpoint");
        const parentLine = addLine(parentLineP1, parentLineP2);
        const childSketchId = "S2";
        const parentSketchId = activeSketchId();
        model.sketches.push({ id: childSketchId, name: "Sketch-1-1", parentSketchId, kind: "sketch" });
        model.activeSketchId = childSketchId;
        const childLineP1 = addPoint(-80, 35, false, "endpoint");
        const childLineP2 = addPoint(-10, 35, false, "endpoint");
        const childLine = addLine(childLineP1, childLineP2);
        const childPoint = addPoint(50, 30, false, "explicit");
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          parentPoint: screenPoint(parentPoint),
          parentLine: screenPoint({ x: 50, y: -20 }),
          childLine: screenPoint({ x: -45, y: 35 }),
          childPoint: screenPoint(childPoint),
        };
      },
      resetForSiblingPointLineReference() {
        resetModelState();
        const activePoint = addPoint(50, 35, false, "explicit");
        const siblingSketchId = "S2";
        model.sketches.push({ id: siblingSketchId, name: "Sketch-2", parentSketchId: ROOT_SKETCH_ID, kind: "sketch" });
        model.activeSketchId = siblingSketchId;
        const lineP1 = addPoint(10, 0, true, "endpoint");
        const lineP2 = addPoint(90, 0, true, "endpoint");
        const siblingLine = addLine(lineP1, lineP2);
        model.activeSketchId = DEFAULT_SKETCH_ID;
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const screenPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          activePoint: screenPoint(activePoint),
          siblingLine: screenPoint({ x: 50, y: 0 }),
        };
      },
      moveSiblingReferenceLine(dy) {
        const siblingLine = model.lines.find((line) => elementSketchId(line) === "S2");
        if (!siblingLine) return null;
        siblingLine.p1.y += dy;
        siblingLine.p2.y += dy;
        const result = solveReferenceDependentSketches("S2");
        refreshConstraintAnalysis();
        updateUI();
        draw();
        const activePoint = model.points.find((point) => elementSketchId(point) === DEFAULT_SKETCH_ID && isExplicitPoint(point));
        return {
          success: result.success,
          dependentSketchIds: result.results.map((entry) => entry.sketchId),
          activePoint: activePoint ? { x: activePoint.x, y: activePoint.y } : null,
          siblingLine: { p1: { x: siblingLine.p1.x, y: siblingLine.p1.y }, p2: { x: siblingLine.p2.x, y: siblingLine.p2.y } },
          reverseWouldCycle: wouldCreateReferenceCycle("S2", DEFAULT_SKETCH_ID),
        };
      },
      referencePointLineState() {
        const constraints = model.constraints.filter((constraint) => constraint instanceof PointOnLineConstraint && constraint.reference);
        return {
          count: constraints.length,
          errors: constraints.map((constraint) => Math.abs(signedPointLineDistance(constraint.point, constraint.line))),
          referenceSketchIds: constraints.map((constraint) => constraint.referenceSketchId),
          sketchIds: constraints.map((constraint) => constraintSketchId(constraint)),
        };
      },
      resetForBlockCreationUi() {
        resetModelState();
        const p1 = addPoint(-60, -30, false, "endpoint");
        const p2 = addPoint(60, -30, false, "endpoint");
        const p3 = addPoint(60, 30, false, "endpoint");
        const p4 = addPoint(-60, 30, false, "endpoint");
        const lines = [addLine(p1, p2), addLine(p2, p3), addLine(p3, p4), addLine(p4, p1)];
        pushModelConstraint(new HorizontalConstraint(lines[0]));
        pushModelConstraint(new VerticalConstraint(lines[1]));
        pushModelConstraint(new HorizontalConstraint(lines[2]));
        pushModelConstraint(new VerticalConstraint(lines[3]));
        selectedLines = lines.slice();
        fitAllGeometryToViewport(220);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const origin = worldToCanvasScreen({ x: 0, y: 0 });
        return { origin: { x: rect.left + origin.x, y: rect.top + origin.y } };
      },
      resetForEmptyBlockCreation() {
        resetModelState();
        updateUI();
        draw();
        return { definitions: model.blockDefinitions.length, lines: model.lines.length };
      },
      resetForDimensionCommandLineDrag() {
        resetModelState();
        const p1 = addPoint(-70, -35, false, "endpoint");
        const p2 = addPoint(70, -35, false, "endpoint");
        const dimensionedLine = addLine(p1, p2);
        const dimensionedTarget = { kind: "line-length", line: dimensionedLine, p1, p2, value: dimensionedLine.length() };
        addDistanceConstraintFromTarget(
          dimensionedTarget,
          dimensionedLine.length(),
          dimensionFromAnchor(dimensionedTarget, { x: 0, y: -75 }),
          { sketchId: activeSketchId() },
        );
        const p3 = addPoint(-55, 55, false, "endpoint");
        const p4 = addPoint(55, 55, false, "endpoint");
        const commandLine = addLine(p3, p4);
        constraintOperands = [];
        selectedPoints = [];
        selectedLines = [commandLine];
        selectedCircles = [];
        selectedArcs = [];
        fitAllGeometryToViewport(190);
        startDistanceCommand();
        const constraint = model.constraints.find((item) => isDimensionConstraint(item) && constraintGraphNodes(item).includes(p1) && constraintGraphNodes(item).includes(p2));
        const target = targetFromConstraint(constraint);
        const layout = dimensionLayout(target, constraint.dimension);
        const world = {
          x: layout.a.x * 0.75 + layout.b.x * 0.25,
          y: layout.a.y * 0.75 + layout.b.y * 0.25,
        };
        const screen = worldToCanvasScreen(world);
        const rect = canvas.getBoundingClientRect();
        return {
          point: { x: rect.left + screen.x, y: rect.top + screen.y },
          scale: viewport.scale,
          anchor: dimensionAnchor(target, constraint.dimension),
        };
      },
      resetForLineLengthClickPlacement() {
        resetModelState();
        const line = addLine(addPoint(-80, 0, false, "endpoint"), addPoint(80, 0, false, "endpoint"));
        fitAllGeometryToViewport(190);
        updateUI();
        draw();
        const rect = canvas.getBoundingClientRect();
        const clientPoint = (point) => {
          const screen = worldToCanvasScreen(point);
          return { x: rect.left + screen.x, y: rect.top + screen.y };
        };
        return {
          line: clientPoint({ x: 0, y: 0 }),
          placement: clientPoint({ x: 0, y: -50 }),
          lineId: line.id,
        };
      },
      lineLengthClickPlacementState() {
        const constraints = model.constraints.filter(isDimensionConstraint);
        const constraint = constraints.at(-1) || null;
        return {
          dimensionCount: constraints.length,
          target: constraint?.target ?? null,
          inputHidden: Boolean(dimensionValueInput?.hidden),
          pendingCommandType: pendingCommand?.type || null,
          previewTargetKind: pendingCommand?.target?.kind || null,
          previewPointer: pendingCommand?.pointer ? { ...pendingCommand.pointer } : null,
        };
      },
      dimensionCommandLineDragState() {
        const constraint = model.constraints.find(isDimensionConstraint);
        const target = targetFromConstraint(constraint);
        return {
          anchor: constraint && target ? dimensionAnchor(target, constraint.dimension) : null,
          pendingConstraintType: pendingConstraintCommand?.type || null,
          pendingCommandType: pendingCommand?.type || null,
          selectedLineIds: selectedLines.map((line) => line.id),
          dragging: Boolean(dimensionDragSession),
        };
      },
      blockState() {
        const bundles = blockProjectionBundles();
        return {
          definitions: model.blockDefinitions.map((definition) => ({
            id: definition.id,
            name: definition.name,
            parentDefinitionId: definition.parentDefinitionId || null,
            points: definition.points.length,
            lines: definition.lines.length,
            constraints: definition.constraints.length,
            blockInstances: (definition.blockInstances || []).map((instance) => ({
              id: instance.id,
              definitionId: instance.definitionId,
              sketchId: instance.sketchId,
              x: instance.x,
              y: instance.y,
              rotation: instance.rotation,
              fixed: Boolean(instance.fixed),
              rotationLocked: Boolean(instance.rotationLocked),
              enabledSketchIds: instance.enabledSketchIds.slice(),
            })),
            sketches: definition.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId, kind: sketch.kind })),
            activeSketchId: definition.activeSketchId,
            origin: { ...definition.origin },
          })),
          instances: model.blockInstances.map((instance) => ({
            id: instance.id,
            definitionId: instance.definitionId,
            sketchId: instance.sketchId,
            x: instance.x,
            y: instance.y,
            rotation: instance.rotation,
            fixed: instance.fixed,
            rotationLocked: Boolean(instance.rotationLocked),
            enabledSketchIds: instance.enabledSketchIds.slice(),
          })),
          projectionLineIds: bundles.flatMap((bundle) => bundle.lines.map((line) => line.id)),
          selectedInstanceIds: selectedBlockInstances.map((instance) => instance.id),
          mode,
          serialized: serializeModel(),
        };
      },
      blockInteractionPoints(instanceId = null) {
        const instance = instanceId ? blockInstanceById(instanceId) : model.blockInstances[0];
        if (!instance) return null;
        const rect = canvas.getBoundingClientRect();
        const firstLine = blockProjectionBundle(instance).lines[0];
        const hitPoint = firstLine
          ? { x: (firstLine.p1.x + firstLine.p2.x) / 2, y: (firstLine.p1.y + firstLine.p2.y) / 2 }
          : { x: instance.x, y: instance.y };
        const center = worldToCanvasScreen(hitPoint);
        const pivot = worldToCanvasScreen(blockInstanceDisplayCenter(instance));
        return {
          center: { x: rect.left + center.x, y: rect.top + center.y },
          pivot: { x: rect.left + pivot.x, y: rect.top + pivot.y },
          handle: null,
          scale: viewport.scale,
        };
      },
      blockRotationLockStateForTest(instanceId = null) {
        const instance = instanceId ? blockInstanceById(instanceId) : model.blockInstances[0];
        if (!instance) return null;
        const center = blockInstanceDisplayCenter(instance);
        const variables = solver.getVariables().filter((variable) => variable.object === instance).map((variable) => variable.prop).sort();
        return {
          id: instance.id,
          x: instance.x,
          y: instance.y,
          rotation: instance.rotation,
          fixed: Boolean(instance.fixed),
          rotationLocked: Boolean(instance.rotationLocked),
          displayCenter: { x: center.x, y: center.y },
          solverVariables: variables,
          translationSessionAvailable: Boolean(buildDragSession("block", instance, center)),
          rotationSessionAvailable: Boolean(buildDragSession("block-rotation", instance, center)),
        };
      },
      blockProjectionEndpointForTest() {
        const instance = model.blockInstances[0];
        const point = instance ? blockProjectionBundle(instance).lines[0]?.p1 : null;
        if (!point) return null;
        const screen = worldToCanvasScreen(point);
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + screen.x, y: rect.top + screen.y, id: point.id };
      },
      blockProjectionHoverState() {
        return {
          command: pendingConstraintCommand?.type || null,
          blockInstanceId: hoveredBlockInstance?.id || null,
          pointId: hoveredPoint?.id || null,
          pointIsBlockProjection: Boolean(hoveredPoint?.blockProjection),
          lineId: hoveredLine?.id || null,
          arcEndpointId: hoveredArcEndpoint ? `${hoveredArcEndpoint.arc.id}.${hoveredArcEndpoint.endpoint}` : null,
        };
      },
      drawnGeometryIdLabelsForTest() {
        const geometryIds = new Set([
          ...allGeometryPoints().map((point) => point.id),
          ...allGeometryLines().map((line) => line.id),
          ...allGeometryCircles().map((circle) => circle.id),
          ...allGeometryArcs().map((arc) => arc.id),
        ]);
        const labels = [];
        const originalFillText = ctx.fillText;
        ctx.fillText = (value) => {
          if (geometryIds.has(String(value))) labels.push(String(value));
        };
        try {
          drawLines();
          drawCircles();
          drawArcs();
          drawPoints();
        } finally {
          ctx.fillText = originalFillText;
        }
        return labels;
      },
      constraintStatusEndpointMarkerCountForTest() {
        let count = 0;
        const originalArc = ctx.arc;
        ctx.arc = (...args) => {
          count += 1;
          return originalArc.apply(ctx, args);
        };
        try {
          drawLines();
          drawPoints();
        } finally {
          ctx.arc = originalArc;
        }
        return count;
      },
      drawnPointMarkerCountForTest() {
        let count = 0;
        const originalArc = ctx.arc;
        ctx.arc = (...args) => {
          count += 1;
          return originalArc.apply(ctx, args);
        };
        try {
          drawPoints();
        } finally {
          ctx.arc = originalArc;
        }
        return count;
      },
      pointDisplayStateForTest(id) {
        const point = allGeometryPoints().find((item) => item.id === id);
        if (!point) return null;
        let drawingTarget = false;
        let marker = null;
        const labels = [];
        const originalArc = ctx.arc;
        const originalFill = ctx.fill;
        const originalStroke = ctx.stroke;
        const originalFillText = ctx.fillText;
        ctx.arc = (x, y, ...args) => {
          drawingTarget = Math.abs(x - point.x) < 1e-9 && Math.abs(y - point.y) < 1e-9;
          return originalArc.call(ctx, x, y, ...args);
        };
        ctx.fill = (...args) => {
          if (drawingTarget) marker = { ...(marker || {}), fill: String(ctx.fillStyle) };
          return originalFill.apply(ctx, args);
        };
        ctx.stroke = (...args) => {
          if (drawingTarget) marker = { ...(marker || {}), stroke: String(ctx.strokeStyle), lineWidth: ctx.lineWidth };
          return originalStroke.apply(ctx, args);
        };
        ctx.fillText = (value, ...args) => {
          if (drawingTarget) labels.push(String(value));
          return originalFillText.call(ctx, value, ...args);
        };
        try {
          drawPoints();
        } finally {
          ctx.arc = originalArc;
          ctx.fill = originalFill;
          ctx.stroke = originalStroke;
          ctx.fillText = originalFillText;
        }
        return { ...(marker || {}), labels };
      },
      drawnDimensionLabelsForTest() {
        const labels = [];
        const originalFillText = ctx.fillText;
        ctx.fillText = (value) => labels.push(String(value));
        try {
          drawDimensions();
        } finally {
          ctx.fillText = originalFillText;
        }
        return labels;
      },
      dimensionClientPositionForTest(index = 0) {
        const constraint = model.constraints.filter(isDimensionConstraint)[index] || null;
        const target = targetFromConstraint(constraint);
        const layout = constraint && target ? dimensionLayout(target, constraint.dimension) : null;
        return layout?.text ? this.worldClientPositionForTest(layout.text) : null;
      },
      blockDefinitionUpdateCase() {
        const definition = model.blockDefinitions[0];
        if (!definition || model.blockInstances.length === 0) return null;
        const before = blockProjectionBundle(model.blockInstances[0]).lines[0].length();
        enterBlockDefinitionEdit(definition.id);
        const editableLine = blockEditSession.draft.lines[0];
        editableLine.p2.x += 40;
        completeBlockDefinitionEdit();
        const lengths = model.blockInstances.map((instance) => blockProjectionBundle(instance).lines[0].length());
        return { before, lengths, revision: definition.revision, editing: Boolean(blockEditSession) };
      },
      blockReadOnlyDimensionCase() {
        const instance = model.blockInstances[0];
        if (!instance) return null;
        const line = blockProjectionBundle(instance).lines[0];
        const target = { kind: "line-length", line, p1: line.p1, p2: line.p2, value: line.length() };
        const dimension = defaultDimensionForTarget(target);
        const constraint = readOnlyDimensionConstraintForPlacement(target, target.value, dimension, { sketchId: instance.sketchId });
        if (!constraint) return { created: false };
        addReadOnlyDimensionConstraint(constraint, instance.sketchId, "ブロック固有寸法");
        return {
          created: true,
          readOnly: constraint.readOnlyDimension,
          enabled: constraint.enabled,
          target: constraint.target,
        };
      },
      blockExternalConstraintCase() {
        const instance = model.blockInstances[1] || model.blockInstances[0];
        if (!instance) return null;
        const definition = blockDefinitionById(instance.definitionId);
        const localPoint = definition?.points[0];
        const projectedPoint = blockProjectionBundle(instance).points.find((point) => point.localElement === localPoint);
        if (!localPoint || !projectedPoint) return null;
        const localBefore = { x: localPoint.x, y: localPoint.y };
        const anchor = addPoint(projectedPoint.x + 75, projectedPoint.y + 40, true, "explicit");
        const constraint = new CoincidentConstraint(projectedPoint, anchor);
        pushModelConstraint(constraint, instance.sketchId);
        const result = solveSketchById(instance.sketchId);
        invalidateBlockProjectionCache(instance.id);
        const nextProjection = blockProjectionBundle(instance).points.find((point) => point.localElement === localPoint);
        return {
          success: result.success,
          errorNorm: result.errorNorm,
          projectedError: hypot2(nextProjection.x - anchor.x, nextProjection.y - anchor.y),
          localBefore,
          localAfter: { x: localPoint.x, y: localPoint.y },
          instance: { x: instance.x, y: instance.y, rotation: instance.rotation },
        };
      },
      reloadBlockState() {
        const data = serializeModel();
        loadModelData(data);
        updateUI();
        draw();
        return {
          definitions: model.blockDefinitions.length,
          instances: model.blockInstances.length,
          projectionLines: allGeometryLines().filter((line) => line.blockProjection).length,
          serializedVersion: serializeModel().version,
        };
      },
      reloadLegacyBlockState() {
        const data = JSON.parse(JSON.stringify(serializeModel()));
        data.version = 7;
        for (const definition of data.blockDefinitions || []) {
          delete definition.origin;
          delete definition.sketches;
          delete definition.activeSketchId;
          for (const item of [...(definition.points || []), ...(definition.lines || []), ...(definition.circles || []), ...(definition.arcs || []), ...(definition.constraints || [])]) {
            delete item.sketchId;
          }
          for (const instance of definition.blockInstances || []) delete instance.rotationLocked;
        }
        for (const instance of data.blockInstances || []) {
          delete instance.enabledSketchIds;
          delete instance.rotationLocked;
        }
        loadModelData(data);
        updateUI();
        draw();
        const definition = model.blockDefinitions[0];
        const instance = model.blockInstances[0];
        return {
          version: serializeModel().version,
          sketches: definition?.sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId, kind: sketch.kind })) || [],
          origin: definition ? { ...definition.origin } : null,
          elementSketchIds: definition ? [...definition.points, ...definition.lines, ...definition.circles, ...definition.arcs].map((item) => item.sketchId) : [],
          enabledSketchIds: instance?.enabledSketchIds.slice() || [],
          rotationLocked: Boolean(instance?.rotationLocked),
          projectionLineIds: instance ? blockProjectionBundle(instance).lines.map((line) => line.id) : [],
        };
      },
      blockEditorState() {
        return {
          editing: Boolean(blockEditSession),
          depth: blockEditorSessionChain().length,
          isNew: Boolean(blockEditSession?.isNew),
          name: blockEditSession?.draft?.name || null,
          sketches: model.sketches.map((sketch) => ({ id: sketch.id, name: sketch.name, parentSketchId: sketch.parentSketchId, kind: sketch.kind })),
          activeSketchId: model.activeSketchId,
          hostLineCount: blockEditSession?.original?.lines?.length || 0,
          hostBlockInstanceCount: blockEditSession?.original?.blockInstances?.length || 0,
          editorLineCount: model.lines.length,
          editorBlockInstances: model.blockInstances.map((instance) => ({ id: instance.id, definitionId: instance.definitionId, x: instance.x, y: instance.y, rotation: instance.rotation, rotationLocked: Boolean(instance.rotationLocked) })),
        };
      },
      commitBlockPlacementForTest(anchor, rotation = 0) {
        if (mode !== "block-place" || !blockPlacementDefinitionId) return null;
        blockPlacementAnchor = { x: Number(anchor?.x) || 0, y: Number(anchor?.y) || 0 };
        const instance = commitBlockPlacement(Number(rotation) || 0);
        return instance ? { id: instance.id, definitionId: instance.definitionId, x: instance.x, y: instance.y, rotation: instance.rotation, rotationLocked: Boolean(instance.rotationLocked) } : null;
      },
      constrainFirstNestedBlockLineForTest(type = "vertical") {
        const instance = model.blockInstances[0];
        const line = instance ? blockProjectionBundle(instance).lines[0] : null;
        if (!line) return null;
        const constraint = type === "horizontal" ? new HorizontalConstraint(line) : new VerticalConstraint(line);
        pushModelConstraint(constraint, instance.sketchId);
        const result = solveSketchById(instance.sketchId);
        invalidateBlockProjectionCache(instance.id);
        recordHistory("入れ子ブロック拘束");
        updateUI();
        draw();
        return { success: result.success, errorNorm: result.errorNorm, line: serializeConstraint(constraint).line };
      },
      addBlockEditorChildGeometry() {
        if (!blockEditSession) return null;
        createSketch("child");
        const sketchId = activeSketchId();
        addLine(addPoint(-20, 50, false, "endpoint"), addPoint(20, 50, false, "endpoint"));
        recordHistory("ブロック内図形追加");
        updateUI();
        draw();
        return { sketchId, sketches: model.sketches.map((sketch) => ({ id: sketch.id, parentSketchId: sketch.parentSketchId })), lineCount: model.lines.length };
      },
      cancelBlockEditor() {
        cancelBlockDefinitionEdit();
        return { editing: Boolean(blockEditSession), definitions: model.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length };
      },
      completeBlockEditor() {
        completeBlockDefinitionEdit();
        return { editing: Boolean(blockEditSession), definitions: model.blockDefinitions.length, instances: model.blockInstances.length };
      },
      setFirstBlockInstanceSketches(ids) {
        const instance = model.blockInstances[0];
        if (!instance) return false;
        return setBlockInstanceEnabledSketchIds(instance, ids);
      },
      blockCreationRejectionCases() {
        resetModelState();
        const p1 = addPoint(0, 0, false, "endpoint");
        const p2 = addPoint(60, 0, false, "endpoint");
        const p3 = addPoint(100, 30, false, "endpoint");
        const selectedLine = addLine(p1, p2);
        addLine(p2, p3);
        selectedLines = [selectedLine];
        const sharedPointError = blockSelectionGeometry().error || null;
        const sharedCounts = { definitions: model.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length };

        resetModelState();
        const line = addLine(addPoint(0, 0, false, "endpoint"), addPoint(60, 0, false, "endpoint"));
        model.annotations.push({
          id: "AN-block-ref",
          type: "leader",
          visible: true,
          geometryRef: geometryRefForItem(line),
          start: { x: 0, y: 0 },
          end: { x: 30, y: 20 },
          style: {},
        });
        selectedLines = [line];
        const annotationError = blockSelectionGeometry().error || null;
        return {
          sharedPointError,
          sharedCounts,
          annotationError,
          annotationCounts: { definitions: model.blockDefinitions.length, instances: model.blockInstances.length, lines: model.lines.length },
        };
      },
      sidebarHighlightIds() {
        const ids = new Set();
        for (const point of selectedPoints) ids.add(point.id);
        for (const line of selectedLines) {
          ids.add(line.id);
          ids.add(line.p1.id);
          ids.add(line.p2.id);
        }
        for (const circle of selectedCircles) {
          ids.add(circle.id);
          ids.add(circle.center.id);
        }
        for (const arc of selectedArcs) {
          ids.add(arc.id);
          ids.add(arc.center.id);
        }
        const constraint = effectiveSelectedConstraint() || selectedDimensionConstraint;
        if (constraint) {
          for (const item of constraintGraphNodes(constraint)) {
            if (item?.id) ids.add(item.id);
          }
        }
        for (const item of hoveredSidebarItem?.elements || []) {
          if (item?.id) ids.add(item.id);
        }
        if (hoveredDimensionConstraint) {
          for (const item of constraintGraphNodes(hoveredDimensionConstraint)) {
            if (item?.id) ids.add(item.id);
          }
        }
        return [...ids].sort();
      },
      currentSidebarHoveredGeometryKeys() {
        return [...allGeometryPoints(), ...allGeometryLines(), ...allGeometryCircles(), ...allGeometryArcs()]
          .filter(isSidebarHoveredElement)
          .map(geometryElementKey)
          .sort();
      },
    };
  }

  installTestHooks();
  sampleModel();
  setApplicationLanguage(applicationLanguage, { persist: false, refresh: false });
  resizeCanvas();
  resetHistory("起動");
})();

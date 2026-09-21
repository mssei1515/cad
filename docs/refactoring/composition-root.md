# app.jsを起動・接続専用にする継続作業

開始点はdevelopの`457adea`。承認された最終目標は、`app.js`を数百行程度の生成・接続・起動・終了へ整理すること。部分的な抽出や中間のテスト成功をもって、この目標の完了とはしない。

## 数百行にする実現性と代償

設計上は実現可能。起動時にDocument／workspace、編集service、操作controller、読出しquery、Canvas renderer、DOM view、入力routerを生成し、必要な相手だけを接続する構成なら、app自体に各機能の実装を置く必要はない。目標は200〜500行程度だが、空行や宣言を詰めて達成する数値ではない。

現在の難所はファイル数ではなく、Block編集時の対象切替、操作ごとに異なるrollback、UI更新から実行されるモデル補完・解析、Projection/cacheを介した描画と編集の結合にある。テストhookだけを外へ出しても、これらの結合は残る。

| 代償・リスク | 対応 |
| --- | --- |
| 処理を追う際のファイル間移動が増える | 責務単位のfolderと公開APIを使い、現在の所有者をarchitecture specに記録する |
| 移行中は旧操作との接続codeが一時的に増える | 移行用bindingを明記し、機能側が新APIへ移った段階で削除する |
| 過剰な抽象化で引数・callbackが増える | 無関係なserviceを束ねたcontextや共通event busを導入しない。直接の呼出しと必要なportだけを接続する |
| 確定・取消・依存更新の順序が変わる | 操作別のrollback規則を保持し、取消・確定・Undo・保存再読込の組合せで検証する |
| read viewや通知の追加でdragが遅くなる | Geometryの同一性と同期pipelineを保ち、frameごとのDocument複製や全面通知を避け、既存性能テストを維持する |
| 大きな移行では原因の追跡が難しくなる | 分離単位で検証し、独立したcommitを残す。別の巨大なApplicationへ移す中間完了にはしない |

既存の`src/document/`、`src/editing/`、`src/geometry/`、`src/persistence/`、`src/ui/`を基礎にする。操作と描画が独立する段階で`src/commands/`と`src/rendering/`を追加し、test専用のfixture／検査APIは`tests/`側へ整理する。空の階層を先に増やさず、実際の所有者が成立した時点で配置する。

## 完了条件

- app.jsは概ね200〜500行で、機能の状態・計算・描画・DOMイベント本体を持たない。
- Document、編集scope、Selection、実行中操作、履歴、描画cacheの所有者が明示されている。
- 別名の巨大なApplication／contextへ旧closureを移していない。module間の循環依存がなく、必要なscopeと限定したAPIを渡す。
- UI、操作別のrollback、Blockのlocal履歴、保存version 22と旧形式互換、file／HTTP起動を維持する。
- 全体検証を通し、段階ごとのcommitと結果を残してdevelopへ統合・Pushする。

## 移行の順序

1. Document本体と現在の編集scopeを分離する。Block編集・Undo復元・保存済みDefinitionのParameter評価でDocumentの配列を差し替える経路を廃止する。
2. 操作の確定・取消・履歴を操作別の規則と共通の実行機構に分ける。Selectionと実行中コマンドの状態をそれぞれの所有者へ集める。
3. 点・線などの作図から機能ごとの操作APIへ移行し、Constraint・Parameter・Sketch・Block・派生Instanceの操作を続ける。巨大な共通contextを導入せず、移行済みの旧経路を削除する。
4. Geometry読出し・Projection・cacheの境界を整理し、Canvas描画、UI表示データ、DOM panel、入力振分けを分離する。表示更新に含まれるモデル補完・解析は操作側へ移す。
5. テストfixtureと検査hookを機能APIに接続して分離する。app.jsを接続だけにし、移行用bindingを削除する。

モジュール単位の入力・出力と現行仕様を確認してから移す。表示と操作の仕様判断が新たに必要になった場合は、既存仕様と照合して扱う。操作順序を変える汎用event bus、毎frameのモデル全複製、保存形式変更、UI framework導入はこの移行に含めない。

## 進捗

- `0f120cc`: 編集scopeを分離。`EditingWorkspace`はDocumentへの参照と現在のscope、scopeの復元用checkpointを所有する。Document名・単位・既定外観・Definition registryはDocument側へ明示した。単体139件、関連E2E169件、追加した同一Instance IDの取消・確定・再読込E2E1件が成功した。
- scope checkpointにGeometryInstanceを含め、Blockから戻るときにDocumentの派生Instanceを失う経路を解消した。DocumentとBlockの両方に`FI1`を置く回帰テストで区別を確認する。
- Selectionの状態と選択規則を`src/editing/selection.js`へ分離。15個の独立変数を廃止し、19個の選択・対象読出し関数を所有者へ移した。操作の入力列とhoverは別の責務として残す。`npm run test:all`は構文検査、単体144件、E2E304件が成功（E2E 19.4分、skip・expected failureなし）。
- 既存commandの移行用としてapp内の`model` bindingとSolverの対象更新を1か所に残す。これは最終APIではなく、後続の機能分離とともに削除する。
- 言語・テーマ設定とUI翻訳を`src/ui/application_settings.js`へ分離。設定state、storage境界、設定dialogのevent登録・解除を同じ所有者に集める。appは表示更新・再描画・version表示のportを接続する。構文検査、単体148件、関連E2E117件が成功した。
- 拘束参照の判定と依存Nodeの列挙を`src/constraints/references.js`へ分離。参照解決のread portだけを渡し、Document／Blockの対象scopeとProjection cacheをquery内へ隠して取り込まない。構文検査、単体152件、関連E2E200件、反転drag・実PointerとUndoの回帰8件が成功した。
- Sketchの所属・階層・参照関係を扱う28関数を`src/editing/sketch_context.js`へ分離。workspaceの現在scopeと拘束Nodeのread portを使い、appの`model` bindingから切り離す。表示可否・View State・作図モードの条件は含めない。初回browser検証で見つかった読込順を修正し、HTMLと同じ順でmoduleを初期化する検証を追加。修正後は構文検査、単体157件、高密度操作を含む関連E2E212件が成功した。
- Documentと各Blockの履歴stackを`EditHistory.create()`のinstanceへ集約。appのUndo／Redo配列とBlock sessionの履歴配列を廃止し、履歴のAPIを使う。構文検査、単体160件、関連E2E170件が成功した。復元中の記録抑止とsnapshot復元・UI更新のpolicyは引き続き操作側の整理対象とする。
- command、操作transaction、描画、UI、テストhookの分離は未完了。Selectionを更新する機能別の操作も引き続きappから移す。
- 寸法の対象・幾何測定を`src/constraints/dimension_queries.js`、名前空間の補完・寸法採番・式評価・読込検証を`src/parameters/namespace.js`へ分離。28関数の本体を保ち、既定の評価対象をworkspaceの現在scopeから取得する。構文検査、単体166件、関連E2E170件が成功。app.jsは26,550行となったが、数百行の最終目標は未達。
- 派生Instanceの幾何生成とscope内の依存解決を`src/geometry/instance_projection.js`へ分離し、共通のGeometry型・参照・Map登録を`src/geometry/objects.js`へ集約。元Geometryへのgetter、共有点、順逆変換、従来のcacheを維持する。構文検査、単体172件、性能・Block・Hatch・保存を含む関連E2E212件が成功。app.jsは26,341行。Block投影とcacheの所有者を整理してから描画側の分離へ進む。
- 寸法の型判定を保存moduleから`DimensionQueries`へ移し、Parameter評価から保存への依存を解消。Parameter単体検証は保存・UIを読み込まずに実行する。構文検査、単体172件、Parameterとfile起動のE2E7件が成功。app.jsは26,340行。
- BlockのGeometry・Annotation・Hatch投影と永続cacheを`src/geometry/block_projection.js`へ移し、Definition検索・有効Sketch判定を`src/document/block_catalog.js`へ分離。入れ子と読込専用resolver、部分・全cache無効化を維持する。構文検査、単体178件、性能を含む関連E2E212件が成功。app.jsは26,033行。

- Geometryの展開読出しと同期read cacheを`src/geometry/read_model.js`へ分離。workspace、Block／派生Instanceの投影、Hatchの有無、計測portを接続し、cache寿命と外観memoを所有者へ集約した。構文検査・単体184件が成功。関連E2E213件のうち212件が成功し、残る1件は分離前にも再現した旧Offset仕様前提の生成図面が原因だった。生成図面を修正し、作図・拘束復元・性能・ドラッグ関連14件は期待拘束数修正後の再実行を含め成功した。

- 拘束候補の分類・寸法対象・通常／参照／対称拘束の生成15関数を`src/constraints/candidates.js`へ分離。入力operandと限定したSketch・向き補正portを使い、Selectionと確定transactionを持たない。関数本体の比較でport置換以外の処理維持を確認。構文検査、単体190件、作図性能・Spline・保存互換を含む関連E2E131件が成功。app.jsは25,636行で、操作・描画・UI・テストhookの分離は引き続き未完了。

- `src/rendering/viewport.js`へ表示原点・倍率と座標変換／fit／表示範囲の計算を集約。appとテストhookの直接代入を更新APIへ、Block編集の退避を独立snapshotへ置換した。構文検査・単体193件と追加した表示範囲の単体1件、Block・保存・UI関連E2E149件が成功。Canvas描画本体と入力状態は次の分離対象として残る。

- 寸法文字幅・矢印形状の計算14関数と2種のcacheを`src/rendering/dimension_metrics.js`へ集約。Canvas contextとviewportだけを接続し、寸法配置・編集状態とは分ける。移動した関数本体の一致を確認し、構文検査・単体197件・寸法表示と作図性能を含むE2E104件が成功。

- 線・円・円弧・Splineの描画を`src/rendering/geometry_renderer.js`へ分離。選択やhover変数をrendererに渡さず、表示状態のadapterをapp側にまとめた。制御した表示状態2,048通りのCanvas命令を分離前と比較し一致を確認。構文検査・単体200件・Block／Spline／表示／性能を含むE2E146件が成功。可視性・表示順・表示状態のadapterは後続の分離対象として残る。

- `src/rendering/drawing_stack.js`へ描画順の組み立て・通常図形の高速経路・同種batchの描画を分離。Documentの順序規則は`DrawingOrder`に残し、scope／Geometry読出し／可視性／painterを接続する。構文検査・単体203件と追加したHatch可視性の単体1件、描画順・Hatch・Block・性能のE2E57件が成功。

- 描画分離の全体検証は構文・単体204件が成功、E2Eは304件成功／Offset連鎖1件失敗（19.1分）。同じ端点操作は分離前の`a5784b1`でも再現し、全体自由度7のまま特異姿勢でP12の局所微小変位が閾値以下になることを取得図面で確認した。判定仕様とテスト期待の整合は別途確認中。
- 参照画像のcacheと描画を`ReferenceImageRenderer`へ分離。可視性・選択・較正sessionの判断は呼出し側に残す。module読込と新規単体2件、参照画像のE2E2件が成功。

- 注記の文字・引出線・終端記号とworld文字寸法を`AnnotationRenderer`へ分離。Canvas状態・表示色・参照点解決を限定したportで接続し、previewの明示startと確定済み参照点を区別する。構文検査、単体209件、characterization／UIのE2E113件が成功。Offset特異姿勢の確認は未回答のため、関連判定と期待値は未変更。

- `CanvasSurface`へbitmap寸法・DPR・ResizeObserver・stroke状態保護・線種dashを集約。表示原点／倍率はViewport、resize後のUI同期は呼出し側へ分け、appの描画metricsとobserver変数を廃止した。構文検査、単体212件、Canvas／Hatch／参照画像を含むE2E101件が成功。

- Hatchのclip・pattern線・solid塗りを`HatchRenderer`へ分離し、解決済み輪郭のboundsを`HatchRegionEngine`に集約した。DocumentやSelectionをrendererへ渡さず、境界Geometryの再描画順も維持する。移動した4関数の本体比較、構文検査、単体216件、Hatch／Block／重なり順／UIのE2E137件が成功。

- `DimensionRenderer`へ直線／角度寸法のCanvas命令、ラベル、編集枠、終端記号、数式マークを分離。外観・配置・延長線計画は呼出し側で準備し、rendererへのSketch／Constraint依存を避けた。準備済み入力768通りのCanvas命令・style・数式マークを分離前と比較して一致。構文検査、単体220件、UI／characterization／作図性能のE2E125件が成功。寸法配置と操作controllerの分離は未完了。

- 寸法anchor・相対配置・ラベル位置を`DimensionPlacement`、補助線・hit範囲・描画計画を`DimensionLayout`へ分離。前者はDocument参照なし、後者は現在scopeの線一覧をread portで受け取る。角度ラベル補完の更新も明示して維持した。31関数の本体比較、構文検査、読込順修正後の単体228件、Block／UI／characterization／作図性能のE2E161件が成功。app.jsは24,153行で、操作・UI・テストhook等の分離は引き続き未完了。

- 長穴を`SlotCommand`と`SlotConstruction`に分離し、中心2点の操作状態をappから廃止した。入力再指定・Esc・生成前checkpoint・入力消去からsolve失敗復元までの既存順序を維持する。構文検査、単体233件、長穴のUndo／Redo・取消・保存再読込を追加した関連E2E162件が成功。高密度図面の長穴確定は233ms（基準350ms）。共通のGeometry追加とsnapshot／solveは移行用portとしてappに残り、他の操作と合わせて後続で分離する。

- 円・中心指定円弧・3点円弧の入力状態5個を`CircularCommands`へ、中心取得・図形生成・snap適用と3点円弧の生成不能時のPoint／採番復元を`CircularConstruction`へ分離。中心Pointを即時作る方式と座標入力だけ保持する方式、reset範囲、solve結果の扱いを維持した。構文検査、単体240件、各作図のUndo／Redo・保存再読込を追加した関連E2E165件が成功。高密度図面の円・円弧確定は117ms（基準350ms）。

- Geometry採番5種を`GeometryIds`へ、通常Geometry追加と最小形状補正8関数を`GeometryCreation`へ分離。scope切替後の参照、生成不能時の採番消費、操作ごとの部分復元を維持し、円弧constructionもcheckpoint APIへ接続した。8関数の本体比較、構文検査、単体246件、Spline／Block／コピー／保存互換／UI／作図性能のE2E176件が成功。高密度図面の作図clickは最大198ms（基準350ms）。全体目標は未完了で、Offset特異姿勢の判定仕様も確認中。

- 編集中の値・Geometry構造のsnapshot／復元4関数を`EditingCheckpoint`へ分離。実体参照、操作別の復元範囲、投影cacheと拘束解析の無効化順序を維持し、保存用snapshot・Undo stack・scope切替とは責務を分けた。4関数の本体比較、構文検査、単体252件、Block／Free Instance／Spline／ドラッグ／UI／作図性能のE2E208件が成功。全体目標とOffset特異姿勢の確認は引き続き未完了。

- トリム交点・削除区間・候補選択の18関数を`TrimQuery`へ分離。現在scopeと対象判定・最小長を明示し、Canvasの7px hit許容幅はapp側でworld距離へ変換する。Geometryを変更せず、交点sourceの実体参照と既存の符号付き円弧・循環区間・補助図形規則を維持した。18関数の本体比較、構文検査、単体259件、トリム拘束移送を含むUI／保存互換／作図性能のE2E126件が成功。図形の更新と拘束整理を含む操作側の分離は引き続き進める。

- トリムの図形変更・拘束整理／移送14関数を`TrimEditing`へ分離。GeometryCreation、ConstraintReferences、TrimQueryを接続し、UI・solve・履歴から独立させた。最小形状補正2関数もGeometryCreationへ集約した。16関数の本体比較、構文検査、単体266件、トリム・Block・Spline・保存互換・作図性能を含むE2E168件が成功。確定判定とUI／履歴の順序はapp側の操作処理に残り、全体のcomposition root化は未完了。

- R面取りを読出し計画の`FilletGeometry`と変更処理の`FilletConstruction`へ分離。共有Point判定、最大半径制限、3点・1円弧・7拘束の追加、方向hint同期の順序を維持した。7関数の本体比較、構文検査、単体271件、R面取り操作・性能を含むE2E126件が成功。半径入力のsessionと確定／取消の調整は操作側に残り、引き続き分離する。

- 中心線の対象列・支持線・端点・snap入力状態を`CenterlineCommand`へ、幾何計算を`CenterlineGeometry`、追加と部分rollbackを`CenterlineConstruction`へ分離。状態の直接参照を読出しAPIへ接続し、失敗時に入力を残す再指定と確定後の消去順を維持した。幾何4関数の本体比較、構文検査、単体276件、既存E2E167件と追加したUndo／Redo・端点入力取消のE2E1件が成功。全体目標とOffset特異姿勢の仕様確認は引き続き未完了。

- スナップ候補・優先度選択・現在状態を`DrawingSnap`へ、解決済みsnapからの拘束生成を`SnapConstraints`へ分離。円周への共通投影はGeometryKernelへ集約した。appのactiveSnap変数を廃止し、許容幅は画面10pxからworld距離へ変換して渡す。12関数の本体比較、構文検査、単体283件、点／線／円弧／長穴／中心線／Spline／Block／参照Sketch／保存互換／作図性能のE2E188件が成功。汎用拘束追加の循環・冗長判定と入力router／UIの分離は引き続き未完了。

- メニューバーの開閉・ホバーtimer・focus・Escとイベント登録を`ApplicationMenus`へ分離。ツールIDの実行はappからcallbackで接続し、start重複抑止とdispose時のtimer／listener解除を追加した。既存の16ms切替とイベント順序を維持し、構文検査、単体283件、独立DOMの終了／再起動を含むUIのE2E94件が成功。アプリ全体の起動・終了と入力routerの集約は引き続き未完了。

- Parameterダイアログのsessionと編集・名前確定・依存削除・追加・評価・dirty判定を`ParameterDialogDraft`へ分離。appのsession変数と行への直接書込みを廃止し、読出し専用の行snapshotと更新APIへ接続した。モデルへの適用・solve・復元順序は維持する。既存5関数の本体比較、構文検査、単体289件、Document／BlockのParameter編集・UI・保存互換のE2E150件が成功。DOM表示と適用処理の分離、全体目標、Offset特異姿勢の確認は未完了。

- Parameterダイアログの入力行・寸法出所・エラーのDOM表示を`ParameterDialogView`へ分離。下書きsnapshotと評価結果を明示的に渡し、モデル変更と評価はViewに持たせない。構文検査、単体289件、関連E2E150件が成功。入力イベント・適用処理の分離、数百行への縮小、Offset特異姿勢の確認は未完了。

- Parameterダイアログの入力イベント・開閉・scope切替・未適用変更の確認を`ParameterDialogController`へ分離。下書きとViewを接続し、適用とCanvas上の寸法取得はcallbackに限定した。start重複抑止とdispose／再start、適用失敗時の切替／終了拒否を独立DOMで検証。構文検査、単体289件、関連E2E151件が成功。モデル適用・復元の分離と全体目標は未完了。

- Parameterの下書き反映・拘束解決結果判定・保存Definition伝播・失敗時復元の順序を`ParameterApplication`へ分離。appは編集scope別のsnapshotとSolver・履歴・表示を接続する。従来の例外境界と参照寸法式の保持を維持し、単体298件、関連E2E151件、構文検査が成功。親Block伝播・モデル読込・入力routerなどの分離と、全体目標／Offset特異姿勢の確認は未完了。

- Block Parameterの親階層／Documentへの伝播順序を`BlockParameterPropagation`へ分離。revision更新・投影cache無効化・失敗時中断を維持し、rollbackはParameterApplicationへ委譲する。構文検査、単体305件、関連E2E150件が成功。拘束再構築・モデル読込・入力routerなどの分離と全体目標／Offset特異姿勢の確認は未完了。

- 投影Geometry更新後の拘束実体参照再構築を`ConstraintRebinding`へ分離。Definitionでは復元不能の拘束を除去し、Documentでは失敗として元配列を保持する既存ポリシーを維持した。構文検査、単体310件、Block／同期インスタンス／保存互換／UIのE2E172件が成功。モデル読込・入力routerなどの分離と全体目標／Offset特異姿勢の確認は未完了。

- 読込候補Blockの所有関係復元と配置循環検査を`BlockOwnershipPersistence`へ分離。旧形式の親推定と明示parentDefinitionIdの整合性検査を維持し、現在のDocumentへの反映とは分けた。構文検査、単体319件、Block／保存互換／UIのE2E150件が成功。loaderの残り、入力routerなどの分離と全体目標／Offset特異姿勢の確認は未完了。

- 保存Block一覧からの読込候補生成を`BlockDefinitionPersistence`へ分離。既存のSketch／Geometry／要素codecを組み合わせ、版別検査と後段の親・Instance・拘束接続用metadataを所有する。処理本体の比較、構文検査、単体327件、Block／ハッチ／参照画像／保存互換／UIのE2E159件が成功。loader後段・入力routerの分離と全体目標／Offset特異姿勢の確認は未完了。

- 派生Instanceの参照／配置正規化・保存形式検査・v19／v20投影移行を`GeometryInstancePersistence`へ分離。現在Sketch補完はapp側wrapperへ残し、保存形式処理から編集状態への依存を除いた。4関数の本体比較、構文検査、単体332件、同期Instance／Sketch投影／Block／保存互換／UIのE2E183件が成功。loaderの接続・反映と全体目標／Offset特異姿勢の確認は未完了。

- 読込候補内のInstance接続とDocument直下のBlock Instance復元を`BlockInstancePersistence`へ分離。読込候補専用resolverと、内外で異なる表示Sketch補完を維持する。3区間の本体比較、構文検査、単体336件、Block／同期Instance／保存互換／UIのE2E172件が成功。拘束接続・読込最終反映と全体目標／Offset特異姿勢の確認は未完了。

- 読込Blockの投影map・注記所属・拘束接続・修復数・後処理順序を`BlockConnectionsPersistence`へ分離。旧版補完と現行版の拒否条件を維持し、現在Documentへの反映から切り離した。処理本体比較、構文検査、単体342件、Block／同期Instance／Sketch投影／保存互換／UIのE2E183件が成功。Document側候補生成・最終反映と全体目標／Offset特異姿勢の確認は未完了。

- DocumentのGeometry・付随要素・拘束・Parameterと不要endpoint処理を`DocumentGeometryPersistence`へ分離。現在のモデルをリセットする前に検証済み候補を返し、最終反映との境界を明示した。処理本体比較、構文検査、単体345件、Block／同期Instance／Sketch投影／ハッチ／参照画像／保存互換／UIのE2E192件が成功。最終反映と全体目標／Offset特異姿勢の確認は未完了。

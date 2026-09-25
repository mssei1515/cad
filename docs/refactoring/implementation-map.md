# 実装対応表

現在の実装配置を調べるための開発資料。正式仕様や将来の分割設計ではない。仕様と保証内容は[仕様の入口](../../spec/README.md)および[検証対応](../../spec/verification/保証対応.md)を参照する。

## 1. 実装ファイルの責務

- `index.html`: 固定ワークスペースとコマンドUI
- `style.css`: レイアウトと状態表現
- `app.js`: moduleの組合せ、Documentと操作状態、描画、入力、保存読込の進行、履歴adapter、Block、Annotation、Reference Image
- `src/document/appearance.js`: 外観の初期値・正規化・旧形式変換と明示layerの解決
- `src/document/drawing_order.js`: scopeとSketchを明示した描画順補完・候補の所有者解決・操作可否・順序変更
- `src/persistence/document_files.js`: ファイル名、内容signature、保存session状態・排他、handleへの書込み
- `src/document/sketch_hierarchy.js`: Root補完、階層走査・参照元判定・ツリー行、読込時の階層復元
- `src/document/annotations.js`、`src/document/hatches.js`、`src/document/reference_images.js`: 各補助要素の値の正規化、保存fieldと保存値検証
- `src/persistence/constraints.js`: 具体的なConstraint保存形式、scopeごとの参照復元、寸法metadataの復元
- `src/persistence/geometry.js`: Document／BlockのローカルGeometry復元と参照Map
- `src/persistence/document_snapshot.js`: DocumentとBlockで共有する保存field writer、派生Instance保存値
- `src/editing/edit_history.js`: 履歴stack操作
- `src/diagnostics/interaction_profiler.js`: 同期処理の時間・実行回数計測
- `src/ui/choice_dialog.js`: 共通選択dialog
- `src/parameters/parameter_engine.js`: Parameter式の字句解析、構文解析、依存評価、識別子検証と名称書換え
- `src/solver/constraint_solver.js`: GeometryとConstraintのsolver
- `src/geometry/geometry_ref.js`: 直接GeometryとBlock Projectionの参照codec
- `src/geometry/objects.js`: Geometryの型、canonical参照、bundleのMap登録
- `src/document/block_catalog.js`: 現在のDefinition registry検索と有効Sketchの判定
- `src/geometry/block_projection.js`: 入れ子BlockのGeometry・Annotation・Hatch投影と永続cache
- `src/geometry/instance_projection.js`: 派生InstanceのGeometry読取りviewとscope内の依存解決
- `src/geometry/read_model.js`: 現在scopeと投影を合わせた一覧・参照解決、同期読出し中のGeometry／外観cache
- `src/geometry/spline_geometry.js`: Splineの補間、評価、微分、最近点、flatten、交点計算
- `src/geometry/hatch_region.js`: 閉領域の交点計算、平面グラフ、面探索、境界復元
- `src/geometry/offset_chain.js`: Line／Arcチェーンの支持曲線オフセット、マイター接続、退化・自己交差検出
- `src/persistence/constraint_codec_registry.js`: Constraint永続化dispatch

## 2. 領域とテスト

| 領域 | 実装 | 主なテスト |
| --- | --- | --- |
| Geometry kernel | `src/geometry/geometry_kernel.js` | `geometry-kernel.test.js` |
| Spline kernel | `src/geometry/spline_geometry.js` | `spline-geometry.test.js`、`spline.spec.js` |
| GeometryRef | `src/geometry/geometry_ref.js` | `geometry-ref.test.js` |
| Constraint codec | `src/persistence/constraint_codec_registry.js` | `constraint-codec-registry.test.js` |
| Parameter式 | `src/parameters/parameter_engine.js` | `parameter-engine.test.js` |
| Hatch region | `src/geometry/hatch_region.js` | `hatch-region.test.js`、`hatching.spec.js` |
| Appearance値・継承 | `src/document/appearance.js`、`app.js`の所属adapter | `appearance.test.js`、`unified-ui.spec.js`、`blocks.spec.js` |
| Sketch内描画順 | `src/document/drawing_order.js`、`app.js`の操作・描画adapter | `drawing-order.test.js`、`drawing-order.spec.js` |
| 保存session | `src/persistence/document_files.js`、`app.js`の保存読込adapter | `document-files.test.js`、`file-safety.spec.js` |
| Constraint永続形式 | `src/persistence/constraints.js` | `constraint-persistence.test.js`、`phase0-characterization.spec.js` |
| Geometry復元 | `src/persistence/geometry.js` | `geometry-persistence.test.js`、`spline.spec.js`、`blocks.spec.js` |
| Sketch階層 | `src/document/sketch_hierarchy.js` | `sketch-hierarchy.test.js`、`unified-ui.spec.js`、`sketch-projection.spec.js` |
| 補助要素の値 | `src/document/annotations.js`、`hatches.js`、`reference_images.js` | `document-elements.test.js`、`hatching.spec.js`、`reference-images.spec.js` |
| 保存snapshot | `src/persistence/document_snapshot.js` | `document-snapshot.test.js`、`phase0-characterization.spec.js`、`file-safety.spec.js` |
| Reference Image操作・描画 | `app.js`、`index.html` | `reference-images.spec.js` |
| Geometry読出し | `src/geometry/read_model.js`、`src/geometry/objects.js` | `geometry-read-model.test.js`、drag・描画E2E |
| 派生Geometry Instance | `src/geometry/instance_projection.js`、`app.js`の操作adapter | `instance-projection.test.js`、`sketch-projection.spec.js`、`free-instance.spec.js` |
| Offset chain | `src/geometry/offset_chain.js` | `offset-chain.test.js`、`geometry-solver.test.js`、`unified-ui.spec.js` |
| Solver | `src/solver/constraint_solver.js` | `geometry-solver.test.js`、drag E2E |
| Constraint Dimension | `app.js`、`src/solver/constraint_solver.js` | `geometry-solver.test.js`、`unified-ui.spec.js` |
| Document／Canvas／UI | `app.js`、`index.html`、`style.css` | `unified-ui.spec.js`、`phase0-characterization.spec.js` |
| Block | `src/document/block_catalog.js`、`src/geometry/block_projection.js`、`app.js`の操作adapter | `block-projection.test.js`、`blocks.spec.js` |

## 3. 計算と編集policyの現在の配置

- `src/geometry/geometry_kernel.js`: UI adapterとSolverが共有する副作用のない数学関数。角度範囲・符号付き距離・縮退境界は[幾何計算](../../spec/calculation/幾何計算.md)に従う。
- `app.js`: Arcモデルを補正する`normalizeArcSweep`、ほぼ一周判定を含む`arcEndpointDragValue`、dragのtarget選択・preview・確定、Sketch依存更新、Block配置、Parameter feedbackを扱う。
- `src/solver/constraint_solver.js`: 数値Jacobian、減衰付き最小二乗法、拘束残差・自由度の解析。
- `src/geometry/hatch_region.js`: 副作用のない交点・AABB候補絞り込み・平面グラフ・half-edge面探索・点包含・境界の保存復元。
- `src/parameters/parameter_engine.js`: 式のparserと依存評価。Geometry再測定を伴う確定処理とは分離している。
- `src/persistence/constraint_codec_registry.js`: 永続Constraint型のclass、保存type、serialize、deserializeは単一registryで対応付ける。参照列挙、表示名、未登録型のユーザー向け拒否policyは永続codecとは別の責務として保持する。

この配置は現在の実装対応であり、将来のモジュール構成を拘束する仕様ではない。

現在の抽出済みmoduleの契約とフォルダ配置は[モジュール構成](../../spec/architecture/モジュール構成.md)、全体の責務分析と分離範囲は[app.jsの責務分析](./app-responsibilities.md)を参照する。

`app.js`を生成・接続・起動へ整理する継続作業は[composition rootへの移行](./composition-root.md)を参照する。編集scopeは`src/editing/workspace.js`、Selectionの状態と選択規則は`src/editing/selection.js`が所有する。機能別操作・描画・UIの移行は継続中。


## 4. 検証の共通fixture

`tests/e2e/test-fixture.js`はbrowser実行時エラーを共通収集する。拘束選択経路を含め、pageerrorを除外せず検出する。保証の範囲は[保証対応](../../spec/verification/保証対応.md)を参照する。

playwright.config.jsがwebServerの起動・準備待ち・停止とbaseURLを一括管理する。各suiteからspawn・waitForServer・killとport加算を除去した。HTTPは相対URLを使い、JOT2D_E2E_PORTが全suiteへ適用される。再利用serverの所有権は引き継がず、Playwrightが起動したprocessだけを終了する。

test-fixture.jsのopenTestDocument(page)は通常のtest mode起動とhook準備待ちを共用する。file起動、filePicker query、reloadの時機は各ケースに残す。図面fixtureの内容・読込名・履歴reset・viewport調整は保証に影響するため一律のbeforeEachへ移さない。

`app.js`の`canApplyConstraintToTargets`は事前選択と生成前の組合せ判定を共用する。対象の組立てとUI選択の更新を分離し、拘束生成のための一時Selection書換えは行わない。テスト用の直接読込は通常のファイル操作と異なり履歴を初期化しないため、履歴を比較するケースは`resetLoadedHistory`を明示して読込状態を基準にする。

## 5. 拘束の入力・生成・確定の境界

| 経路 | 入力・出力 | 状態への影響 |
| --- | --- | --- |
| 事前選択 | currentConstraintTargets → canApplyConstraintToTargets／constraintFromTargets | 選択配列を読み、対象の成立可否または拘束案を返す。Selection・入力列は書き換えない |
| 逐次入力 | resolveConstraintIntent → normalConstraintFromOperands → constraintTargetsFromOperands → constraintFromTargets | operandsから種類別の対象を組み立てる。生成処理からconstraintOperandsへの代入とSelectionの退避・復元を除去 |
| 選択表示 | syncSelectionFromConstraintOperands | 同じ対象組立てを使い、UI選択へ反映する。Block／派生Instance選択の解除もこの明示的な更新経路で行う |
| 寸法 | distanceTargetFromSelection → distanceTargetFromTargets、またはdistanceTargetFromOperands | 前者は種類別の事前選択、後者は入力順序とhitPointを保持する。半径差寸法の表示基準点の違いを維持 |
| 対称 | symmetryConstraintFromOperands | 逐次入力の先頭を対称軸として扱う。事前選択の種類別配列から生成する経路も維持 |
| Spline | splineConstraintResolution、参照側のreferenceConstraintForType | 曲線parameter・始終端を入力から保持し、閉Splineの端点接線を拒否 |
| Sketch参照 | splitConstraintOperands／referenceResolutionFromOperands／symmetryReferenceResolutionFromOperands | active／先祖／子孫・参照循環を確認。Projectionの参照解決と参照元・先の役割を維持 |
| 確定 | commitConstraintResolution → commitNewConstraint／commitReferenceConstraint | ここでDocumentへの追加、solve、成立判定、復元、履歴記録を行う。今回の分離では変更しない |

対象組立ては既存の重複除去とCircle→Arcの分類順を保持する。Arc端点は対応するArcと端点情報を併せて持つ。事前選択と順序付き入力を無条件に相互変換しない。

接線の通常拘束生成では、従来どおりsolver.syncLineOrientationHintsで方向cacheを更新してからConstraintを構築する。このため生成処理全体を副作用のない純粋関数とは扱わない。今回除去したのはUI選択・入力列への書込みであり、solver準備処理の移動は別途扱う。

R1の照合では新しい製品仕様判断は不要。操作途中のDocument・履歴保持、所属条件、対称軸の順序、Spline端点条件は正式仕様を維持する。

## 6. 編集の復元と履歴の境界

| 操作 | 保存・復元 | 確定と履歴 |
| --- | --- | --- |
| 通常／参照拘束追加 | snapshotModelState → restoreModelState。追加前の形状・拘束・Parameterを保持 | commitNewConstraint／commitReferenceConstraintで追加・前処理・solve・退化／重複判定。失敗は復元、重複寸法は復元後に読み取り専用化。成功後に履歴 |
| Geometryドラッグ | previewのsolver状態と開始時のparameterDragSnapshotを区別 | endDragで最新pointer反映・最終solve・形状検証・Parameter／依存更新。失敗は該当の開始snapshotへ復元し、成功だけ履歴 |
| Document／保存DefinitionのParameter適用 | historySnapshotのDocument全体を保存し、失敗時はloadModelData | applyParameterDialogDraftで式評価・Definition／配置先更新を完了後に履歴。失敗時は画面scopeを再解決してエラー表示 |
| Block Editor内のParameter適用 | snapshotModelState／restoreModelStateで現在のdraftを保持 | 同じ適用入口だが、Document全体の再読込は行わずlocal履歴を使う |
| 通常のDefinition編集 | openBlockDefinitionEditorのhost保存、completeBlockDefinitionEdit／cancelBlockDefinitionEdit | draft検証後にhostを戻してDefinitionを反映。依存先エラーだけでは元編集を取り消さない。入れ子Editorは親のlocal履歴へ、最終完了はDocument履歴へ記録 |
| 作図取消 | Line・Point等の専用rollbackで配列長・採番・一時作成物を保持 | 最初のLine端点は仮入力。double clickで作った一時物の破棄など、固有の履歴調整を維持 |
| Undo／Redo | Documentは保存形式、Block EditorはcloneしたDefinitionとsignature | 復元中はhistoryRestoringで再記録を抑止。各scopeの復元後にInteractionを解消し、solve・表示更新 |

Documentと各Block編集sessionがsrc/editing/edit_history.jsの独立した履歴instanceを持ち、activeEditHistoryが現在のinstanceを選ぶ。snapshot作成、比較signature、復元処理、表示labelを生成時に渡す。recordHistoryとundoHistory／redoHistoryはinstanceのAPIを使い、履歴buttonも同じinstanceの件数を参照する。Undo／Redo配列はappとBlock sessionへ公開しない。

DocumentのhistorySnapshotとBlock EditorのcaptureBlockEditorHistorySnapshot、各復元関数、初期化処理は別々に保持する。共通処理はrollback範囲を決めず、失敗した操作を自動的に確定しない。TX-01〜05、snapshot形式、復元時の処理順は変更しない。操作別のsnapshotを一律のtransactionへ置き換える作業は今回の対象外。

## 7. ドラッグの計測と更新境界

| 経路・区分 | 現在の関数 | 計測範囲 |
| --- | --- | --- |
| preview | processScheduledCanvasPointerMove | 最新pointerの反映、Geometry読出しcache scope、必要な寸法入力同期 |
| commit | endDrag → finishPointerInteraction | 最後の未処理previewをflushした後の確定。flushはpreviewとして別計上 |
| solve | dragResultForSession／solveFinalDragSession | 準備・fallbackを含むdrag solver呼出し単位。内部の反復回数ではない |
| dependencies | solveReferenceDependentSketches | 参照依存先の再評価・solve |
| parameters／analysis | stabilizeActiveParameterNamespace／refreshConstraintAnalysis | Parameter安定化（内部のsolveを含む）／拘束解析 |
| draw／geometryReads | draw／cachedGeometryRead | Canvas描画の同期処理／cache missまたはcacheなしの実生成 |
| ui／tree／properties | updateUI・updateGeometrySelectionUI・setHint／updateSketchUI／updatePropertiesUI | UI更新をTree全再生成とPropertiesに分ける。Tree選択class変更はuiに含む |
| history | recordHistory | snapshot作成・比較・履歴追加 |

profileInteractionPhaseとprofileInteractionWorkはsrc/diagnostics/interaction_profiler.jsのphase／workへの参照であり、明示的に有効化した同期scopeだけを集計する。workのselfMsは入れ子の計測時間を除き、scope内の残りをotherMsとする。Parameterや依存更新内のsolveをsolve区分へ再加算しない。呼出し回数は各関数の粒度であり、ui呼出しの中にtree／propertiesの呼出しが含まれる。

角度以外の寸法確定はupdateGeometrySelectionUIとsyncDimensionValueInputを使用する。Properties・選択表示・履歴は保持し、形状不変の操作で拘束解析とTree全再生成を省く。角度寸法のsyncAngleConstraintFromDimensionはtargetを変更し得るためupdateUIを維持する。

## 8. 履歴操作・同期計測のmodule境界

| 配置 | 入出力と責務 | 依存・副作用 |
| --- | --- | --- |
| src/editing/edit_history.js | record(history, limit)は追加の有無、undo／redo(history)は復元結果を返す | 渡されたstackを更新し、capture・signature・clearRedo・restoreを呼ぶ。DOM・model・solverは参照しない |
| app.jsの履歴adapter | activeEditHistory、snapshot作成・復元、historyRestoring、button・log | Document／Block固有のscopeと復元順を保持。復元中の記録抑止もapp側で行う |
| src/diagnostics/interaction_profiler.js | create(now)で独立した計測器を作り、start／stop、phase／work、activeを提供 | clockと同期callbackだけに依存。集計状態は計測器ごとに保持し、DOM・modelを参照しない |
| app.jsの計測adapter | 計測する関数と区分、pointer flush、test hook | 実行経路を決め、moduleへ集計を委譲する。通常時は無効 |

履歴は既存どおりstackを移動してからrestoreを呼び、戻り値と例外をそのまま伝える。module側で自動rollbackを追加しない。初期化やsnapshot形式、TX-01〜05はapp側の既存実装を維持する。

計測のstart／stopは同期phaseの外で使用する。phase／workはcallbackの戻り値・例外を保ち、finallyで親の計測scopeを戻す。async処理の完了を追跡するAPIではない。テストではclockを注入して時間の内訳を決定的に比較する。

index.htmlは既存の通常script読込列で両moduleをapp.jsより先に読み、起動ごとのquery付与も共用する。ES moduleや新たなbuild工程は導入せず、file／HTTP両方の起動方式を維持する。

### 拘束候補の生成境界

`ConstraintCandidates`（`src/constraints/candidates.js`）がoperand分類と寸法／拘束候補を生成する。app側は入力操作の状態、参照先の選択可否、候補の確定、solve、履歴、UI通知を接続する。候補生成には可変アプリ全体のcontextを渡さない。

### Canvas座標

`src/rendering/viewport.js`が表示原点・倍率の状態と座標変換を所有する。appの直接代入を廃止し、操作側は`update()`、退避復元は`snapshot()`を使う。Canvas矩形の取得だけをportで接続する。

### 寸法描画の計測とcache

文字幅計測・矢印形状と関連cacheは`src/rendering/dimension_metrics.js`。`ctx`とviewportを接続する。配置計算・編集ラベル・描画順はappに残り、後続で描画moduleへ移す。

### 基本図形の描画

`GeometryRenderer`が線・円・円弧・SplineのCanvas命令を所有する。appの`geometryPaintState()`が操作状態から表示値を作り、4つの薄い描画adapterが可視性と描画順を適用してrendererへ渡す。表示判定の所有者の分離は後続で行う。

### 描画順とbatch

`DrawingStack`（`src/rendering/drawing_stack.js`）が描画順の組み立てと高速経路、painter呼出しを所有する。appは現在scope・Geometry読出し・可視性・描画先を接続する。永続化するdrawingOrderの規則は従来の`DrawingOrder`に残る。

### 注記と参照画像の描画

`AnnotationRenderer`は注記文字・引出線・終端記号、`ReferenceImageRenderer`は参照画像のURL cache・画像本体・選択枠・較正markerを所有する。appは対象の可視性や操作状態を判断し、描画入力と参照点解決を接続する。

### Canvas surface

`CanvasSurface`がbitmap寸法・DPR・ResizeObserver・stroke状態保護とdashを所有する。appはresize後の再描画／入力UI更新を接続する。`CanvasViewport`はworld座標と表示原点・倍率を引き続き所有し、bitmap状態と分ける。

### Hatchの描画

`HatchRenderer`は解決済み輪郭へのclip・pattern線・solid塗りを担当する。境界検索や操作状態を注入せず、呼出し側が描画入力を決める。輪郭boundsは`HatchRegionEngine`へ集約し、fitとBlock boundsからも利用する。

### 寸法のCanvas描画

`DimensionRenderer`は直線／角度寸法のCanvas命令とラベル・編集枠・終端記号・数式マークを所有する。`DimensionMetrics`は共有instanceとして接続する。appの描画adapterは外観・layout・描画計画を準備して渡し、rendererにSketchや拘束対象の検索をさせない。寸法配置と移動／編集操作は後続の整理対象。

### 寸法配置とlayout

`DimensionPlacement`（`src/rendering/dimension_placement.js`）は方向・anchor・相対配置・ラベル位置を担当し、Documentを参照しない。`DimensionLayout`（`src/rendering/dimension_layout.js`）は補助線・hit領域・文字方向・描画計画を担当し、現在scopeの線一覧だけをread portで取得する。appには外観継承を解決するadapterと描画先への接続を残す。既存の角度ラベル補完による寸法更新は明示して維持し、操作側への移行時も更新順序を保つ。

### 長穴command

`SlotCommand`（`src/commands/slot_command.js`）が入力段階と中心2点を所有し、appの`slotFirstCenter`／`slotSecondCenter`を廃止する。previewとmode終了は公開された読出し／reset APIを使う。`SlotConstruction`（`src/editing/slot_construction.js`）は長穴の図形・拘束・snap適用とcheckpoint復元を担当する。appのクリックadapterはsnap解決だけを行う。共通のGeometry追加、snapshot、solveと履歴の実装は移行用portとして引き続きappにあり、後続で所有者を整理する。

### 円・円弧command

`CircularCommands`（`src/commands/circular_commands.js`）が円・中心指定円弧・3点円弧の5つの入力状態を所有する。appはsnap解決後のclickとmode変更時のresetを振り分け、previewは読出しAPIを使う。`CircularConstruction`（`src/editing/circular_construction.js`）が図形生成とsnap拘束を担当する。3点円弧の中心追加失敗時のPoint除去と採番復元もここへ移した。Geometry追加・採番・共通solveの移行用portは引き続きappに残る。

- `GeometryIds`（`src/editing/geometry_ids.js`）: Geometry採番の所有者。種類ごとの割当・予約・部分checkpointを提供し、Document切替と操作取消のpolicyは呼出し側が指定する。
- `GeometryCreation`（`src/editing/geometry_creation.js`）: 現在scopeへの通常Geometry追加と最小形状補正。scope／採番／Sketch付与／補助作図modeを明示接続し、UIやsolveには依存しない。
- `EditingCheckpoint`（`src/editing/checkpoint.js`）: 編集中の値・Geometry構造のcheckpointと復元。実体参照と既存の復元範囲を維持し、scope／採番／投影・解析無効化だけを接続する。保存形式やUndo履歴stackは扱わない。
- `TrimQuery`（`src/editing/trim_query.js`）: トリム境界と削除区間の読出し計算。scope／アクティブ対象判定／最小長を受け取り、画面のhit許容幅は呼出しごとにworld距離で渡す。Geometry更新と拘束移送は担当しない。
- `TrimEditing`（`src/editing/trim_editing.js`）: トリム計画のGeometry変更・拘束移送・不要端点整理。GeometryCreation／ConstraintReferences／TrimQueryと限定した編集portを接続し、solveとUI・履歴は操作側に残す。
- `FilletGeometry`（`src/geometry/fillet_geometry.js`）: 共有端点からR面取りの接点・中心・角度・半径上限を計算する。プレビューと確定で共有し、モデルを変更しない。
- `FilletConstruction`（`src/editing/fillet_construction.js`）: 計画に従う点・円弧追加、元Lineの端点差替え、支持拘束と半径寸法の生成。GeometryCreationと寸法配置／方向hint同期／拘束追加を接続する。
- `CenterlineCommand`（`src/commands/centerline_command.js`）: 中心線の対象・支持線・端点・snap入力状態と再指定／reset。Geometry計画と生成を接続し、Canvas描画は所有しない。
- `CenterlineGeometry`（`src/geometry/centerline_geometry.js`）: 平行2線／2点からの支持線計算と端点投影。
- `CenterlineConstruction`（`src/editing/centerline_construction.js`）: 中心線の点・補助線・snap／中心線拘束の追加、失敗時の配列長と部分採番復元。
- `DrawingSnap`（`src/editing/drawing_snap.js`）: Geometry読出しからの候補生成・優先度選択と現在snapの所有。許容距離はworld単位で明示し、UI描画や拘束追加は持たない。
- `SnapConstraints`（`src/editing/snap_constraints.js`）: 解決済みsnapと参照Sketchの可否に基づく拘束追加。Geometry生成・重複回避の編集APIを接続する。
- `ApplicationMenus`（`src/ui/application_menus.js`）: メニューバーの開閉・ホバーtimer・focus・Escとイベント登録の寿命。ツールの機能はcallbackとしてappが接続する。
- `ParameterDialogDraft`（`src/parameters/dialog_draft.js`）: Parameterダイアログの編集行・名前確定・依存削除・追加・評価・dirty状態を所有する。行snapshotは読出し専用とし、DOMとモデル適用は別責務とする。

- `ParameterDialogView`（`src/ui/parameter_dialog_view.js`）: 下書きと評価結果を受けてDOM表示を担当する。状態変更・評価・モデル適用は所有しない。

- `ParameterDialogController`（`src/ui/parameter_dialog_controller.js`）: 下書きとViewの調整、開閉・scope切替・入力と確認dialog、listener寿命を所有する。適用とCanvasの寸法取得はcallbackへ委譲する。

- `ParameterApplication`（`src/parameters/application.js`）: 下書きのモデル反映・拘束解決結果判定・伝播・復元の順序を所有する。appは編集scopeに応じたsnapshotとSolver／履歴／表示を接続する。

- `BlockParameterPropagation`（`src/parameters/block_propagation.js`）: 親DefinitionからDocumentへの再構築・安定化・revision／投影cache更新順序を所有する。rollbackはParameterApplication、具体的な再構築／Solver呼出しは接続側に委譲する。

- `ConstraintRebinding`（`src/constraints/rebinding.js`）: 投影を含むGeometry ID mapと拘束実体参照の再構築。Definitionの除去許容とDocumentの失敗ポリシーを別APIとして維持し、選択・Solver・rollbackは所有しない。

- `BlockOwnershipPersistence`（`src/persistence/block_ownership.js`）: 読込候補Definitionの親復元と配置循環検査。raw metadataは読出しのみとし、Documentへの反映はloaderが担当する。

- `BlockDefinitionPersistence`（`src/persistence/block_definitions.js`）: 保存Blockの版別検査とSketch／Geometry／付随要素の読込候補生成。後段の親・Instance・拘束接続用metadataを返す。

- `GeometryInstancePersistence`（`src/persistence/geometry_instances.js`）: 派生Instanceの参照／配置正規化・保存形式検査・v19／v20投影移行。現在Sketchの補完と読込データの複製は呼出し側が担当する。

- `BlockInstancePersistence`（`src/persistence/block_instances.js`）: 読込候補登録簿内でのInstance接続とDocument配置の復元。内外の表示Sketch補完規則を区別し、現在のモデルや選択状態には依存しない。

- `BlockConnectionsPersistence`（`src/persistence/block_connections.js`）: 読込Blockの投影参照・注記所属・拘束接続・修復数と後処理の順序。現行Documentへの反映は所有しない。

- `DocumentGeometryPersistence`（`src/persistence/document_geometry.js`）: DocumentのGeometry・付随要素・拘束・Parameterを検証済み読込候補へ組み立てる。現在モデルの置換とUI復元は呼出し側に残す。

- `DocumentSequences`（`src/persistence/document_sequences.js`）: 復元済みDocumentと全Definitionを横断して採番予約を計算する。計算結果の反映は呼出し側に残し、モデル・採番器を変更しない。

- `DocumentLoading`（`src/persistence/document_loading.js`）: 既存codecから読込候補を構築し、リセット済みモデルへ反映する。decodeは現在モデルを変更せず、installは配列・実体の同一性と投影無効化／円弧正規化の順序を維持する。UI・履歴は所有しない。

- `DocumentState`（`src/document/state.js`）: Documentの初期構造・単位・内容消去・既定Sketchと表示設定の復元。編集状態の取消とcache破棄は呼出し側へ残し、データの初期化を単独検証できる。

- `CanvasNavigation`（`src/ui/canvas_navigation.js`）: 中ボタンのパン状態と全体表示用クリック履歴を所有し、開始・移動・終了・リセットを提供する。イベント購読と編集操作の優先順位はappに残す。

- `SplineDraft`（`src/editing/spline_draft.js`）: スプライン作成中の通過点とPoint rollbackを所有する。取消・Backspace・ダブルクリック追加点除去を担当し、Spline確定とUI更新の調整はSplineCommandへ委譲する。

- `SplineCommand`（`src/commands/spline_command.js`）: SplineDraftを用いたクリック／ダブルクリックの判定と確定処理。生成成功後の選択・解析・履歴・UI更新順を調整する。作図開始時の他コマンド取消と既存モードへの接続はappが担当する。

- `TransientAuthoring`（`src/editing/transient_authoring.js`）: 点・線の一時作図の復元記録、採番復元、暫定履歴破棄、SelectionのPoint除去と一時点判定。appは操作モードの判定と作成要素の通知を担当する。

- `RectangleCommand`（`src/commands/rectangle_command.js`）: 矩形の開始点、最小辺長補正、四辺と拘束の生成、確定・リセット。appはモード切替、スナップ解決とプレビューを担当する。

- `LineCommand`（`src/commands/line_command.js`）: 連続作図の開始点、直交・最小距離補正、確定とTransientAuthoringへの通知。appはモード遷移と取消ポリシーを担当する。

- `FilletCommand`（`src/commands/fillet_command.js`）: 最初の線と半径配置・生成・安定化・失敗時復元・履歴記録を調整する。pendingCommandへのget／setは既存取消規則を維持するための移行中の接続。

- `CommandCursor`（`src/ui/command_cursor.js`）: 読取り専用のコマンド種類とモードからカーソルを表示する。ボタン選択の優先順位とSVG cacheを所有し、入力状態やDocumentを変更しない。

- `DimensionInputView`（`src/ui/dimension_input_view.js`）: 寸法入力欄の配置・表示・非表示・検証結果の反映とfocus予約。寸法レイアウトと式評価は呼出し側で行い、DOMへコマンド状態を持ち込まない。

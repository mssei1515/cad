# 実装対応表

現在の実装配置を調べるための開発資料。正式仕様や将来の分割設計ではない。仕様と保証内容は[仕様の入口](../../spec/README.md)および[検証対応](../../spec/verification/保証対応.md)を参照する。

## 1. 実装ファイルの責務

- `src/constraints/operand_hit_query.js`: 参照SketchとBlock／派生Geometryの拘束対象hit。Sketch関係と探索優先順を扱う。
- `src/editing/point_usage.js`: 点の使用関係・端点／参照点／Spline通過点等の分類。scope・投影・編集sessionの読取り。
- `src/editing/pointer_hover.js`: 通常選択／拘束入力のhit優先順位とCanvasHover更新。再描画の要否を返す。
- `src/editing/geometry_hit_query.js`: 通常Geometry hitと所属Sketch表示の照会。点分類・描画順・倍率依存の許容距離を扱う。
- `src/editing/canvas_hover.js`: Canvas hover参照、一括更新・clear・メニュー退避復元・候補preview。読取り状態は変更不能。
- `src/editing/canvas_context_query.js`: 現在scopeの右クリック候補、投影の親への集約、距離／種類／描画順の順位付け。
- `src/ui/canvas_context_presentation.js`: 候補SVG・種類・ID・補助文字列。読取り／翻訳のみ。
- `src/ui/canvas_context_menu.js`: Canvasメニューsession・候補preview・HTML・DOMイベント。候補取得と編集実行はappから接続。
- `src/rendering/annotation_spatial_query.js`: Annotation表示範囲・文字領域・通常選択／右クリックのhit照会。描画と編集を持たない。
- `src/geometry/annotation_anchor_query.js`: 注記対象hit・引出線対象・最近点・GeometryRef再解決。Geometry／Selection／現在Sketchを明示依存とする読取り専用照会。
- `src/commands/annotation_command.js`: テキスト／引出線の作成・対象選択・文字入力・確定取消、配置計算とpreviewデータ。

- `src/commands/hatch_command.js`: Hatch作成・境界修復の進行、preview／修復対象の所有、取消時の破棄。

- `src/geometry/hatch_query.js`: Hatch primitive変換・境界解決・閉領域検索とcacheの所有、個別無効化／全破棄。

- `src/geometry/block_layout.js`: 入れ子を含むBlockのローカル範囲、表示中心、配置anchorへの平行移動。

- `src/editing/first_dimension_scaling.js`: 初回寸法に合わせたSketch geometryと寸法配置の拡縮。画面上の大きさの取得／復元は既存CanvasViewportへ統合。

- `src/geometry/bounds.js`: 矩形判定、図形boundsと結合。
- `src/geometry/reference_image_geometry.js`: 参照画像の座標変換・四隅・bounds。
- `src/rendering/drawing_bounds.js`: Sketch指定・全体・可視対象の範囲集計。

- `src/ui/pointer_move_scheduler.js`: pointermoveの保留入力・frame予約・flush／破棄と診断件数を所有する。

- `src/constraints/sketch_projection_queries.js`: 旧投影拘束の索引・対応点・影響対象の照会。
- `src/editing/sketch_projection_editing.js`: 旧投影先の共有Point分離と参照再接続・Spline metadata同期。

- `src/ui/expression_input_view.js`: 式入力の強調markup、入力欄装飾、input／scroll同期と一括更新。下書きの式評価は既存ParameterNamespaceへ統合。

- `src/parameters/stabilization.js`: 式評価・参照寸法の収束反復と、目標値変更の段階的求解／再試行。操作全体の復元と履歴は持たない。

- `src/constraints/constraint_analysis.js`: 拘束状態の解析対象・図形分類・cache・遅延評価と無効化。描画色と表示文言は含まない。

- `src/constraints/constraint_redundancy.js`: 重複拘束の個別解析・全Sketch集計、接線維持の例外、非公開の結果Mapと件数照会。

- `src/constraints/reference_constraint_state.js`: 参照拘束の範囲／循環判定、操作可否、非公開の参照エラー状態と読取りAPI。

- `src/solver/sketch_solving.js`: Sketch／局所求解、依存順序に沿う伝播、失敗時の値復元と非公開の求解結果状態。通知・履歴は操作側。

- `src/solver/solve_scope_query.js`: 拘束連結成分と局所／Sketch全体の求解入力の照会。求解・変更・cacheの所有は行わない。

- `src/editing/geometry_drag_editing.js`: 図形ドラッグの局所context準備・開始前snapshot・preview適用／補正／復元（操作と診断で共用）

- `src/commands/geometry_drag.js`: 図形ドラッグsessionの所有、移動開始閾値、更新、確定／失敗復元・履歴と強調対象の照会

- `src/solver/geometry_drag_solver.js`: 図形ドラッグの局所／guided求解・全Sketch再試行・終了時補正とsessionごとの非公開数値計算状態

- `src/editing/geometry_drag_plan.js`: 図形ドラッグ開始状態・移動先・一時拘束の生成

- `src/commands/dimension_drag.js`: 寸法表示位置ドラッグのsession・更新・確定と小移動時のコマンド継続通知

- `src/editing/rectangle_selection_query.js`: 現在scopeの矩形選択候補照会（選択更新はCanvasSelection）

- `src/commands/selection_rectangle.js`: 選択矩形のsession・previewと通常／投影選択の確定振分け

- `src/commands/annotation_drag.js`: 注記ドラッグのsession・ID再解決・位置更新・確定

- `src/commands/reference_image_interaction.js`: 参照画像ドラッグと2点縮尺校正のsession・更新・確定・取消

- `src/commands/sketch_deletion_command.js`: Sketch削除の参照ガード・確認・モデル更新と通知順序
- `src/commands/sketch_command.js`: Sketch作成・切替・名前変更・表示切替と通知順序

- `src/constraints/rebinding.js`: scopeの拘束再接続、Block用拘束複製、保存済み固定座標の移動

- `index.html`: 固定ワークスペースとコマンドUI
- `style.css`: レイアウトと状態表現
- `app.js`: moduleの構築・接続・起動と、移行中のmode／pointer／現在model別名、操作・履歴adapter、test hookの組立て。現在の残存責務と依存は[再監査](bootstrap-boundary-audit.md)を参照する。
- `src/document/appearance.js`: 外観の初期値・正規化・旧形式変換と明示layerの解決
- `src/document/drawing_order.js`: scopeとSketchを明示した描画順補完・候補の所有者解決・操作可否・順序変更
- `src/persistence/document_files.js`: ファイル名、内容signature、保存session状態・排他、handleへの書込み
- `src/document/sketch_hierarchy.js`: Root補完、階層走査・参照元判定・ツリー行、読込時の階層復元
- `src/document/annotations.js`、`src/document/hatches.js`、`src/document/reference_images.js`: 各補助要素の値の正規化、保存fieldと保存値検証
- `src/persistence/constraints.js`: 具体的なConstraint保存形式、scopeごとの参照復元、寸法metadataの復元
- `src/persistence/geometry.js`: Document／BlockのローカルGeometry復元と参照Map
- `src/persistence/document_snapshot.js`: DocumentとBlockで共有する保存field writer、派生Instance保存値
- `src/editing/block_definition_editing.js`: Block定義の複製・座標移動・選択からの下書き生成・Object同一性を維持するdraft反映
- `src/editing/block_selection_query.js`: Block作成候補の参照整合・内部／外部拘束分類と配置中心の読取り
- `src/editing/block_editing_queries.js`: 編集範囲・編集中定義・参照Instance・draftを優先する依存循環の読取り
- `src/editing/block_editor_session.js`: Block編集session連鎖、draft同期・差替え、親scope復帰、子定義の仮移動・復元記録引継ぎと取消
- `src/editing/block_history_snapshot.js`: Block履歴の復元用コピーと変更検出signatureの生成
- `src/editing/history_controller.js`: 現在scopeへの履歴操作振分け、復元中の記録抑止と変更通知
- `src/editing/edit_history.js`: 履歴stack操作
- `src/diagnostics/interaction_profiler.js`: 同期処理の時間・実行回数計測
- `src/ui/block_view.js`: Block一覧・編集パネルのDOM表示とイベント接続。状態変更は操作コールバックへ委譲
- `src/ui/choice_dialog.js`: 共通選択dialog
- `src/parameters/parameter_engine.js`: Parameter式の字句解析、構文解析、依存評価、識別子検証と名称書換え
- `src/solver/constraint_solver.js`: GeometryとConstraintのsolver
- `src/geometry/geometry_ref.js`: 直接GeometryとBlock Projectionの参照codec
- `src/geometry/objects.js`: Geometryの型、canonical参照、bundleのMap登録
- `src/document/block_catalog.js`: 現在のDefinition registry・所有子孫・Sketch表示行の照会と有効Sketchの判定
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

`AnnotationRenderer`は注記文字・引出線・終端記号、`ReferenceImageRenderer`は参照画像のURL cache・画像本体・選択枠・較正markerを所有する。Annotationの描画入力と参照点解決はAnnotationDisplayが共有readerへ接続する。ReferenceImageの表示入力は同rendererのcreateLayerが読取り専用の照会から構成する。

### Canvas surface

`CanvasSurface`がbitmap寸法・DPR・ResizeObserver・stroke状態保護とdashを所有する。appはresize後の再描画／入力UI更新を接続する。`CanvasViewport`はworld座標と表示原点・倍率を引き続き所有し、bitmap状態と分ける。

### Hatchの描画

`HatchRenderer.create`は解決済み輪郭へのclip・pattern線・solid塗りを担当する。塗描画へは操作状態を渡さず、`createLayer`の表示構成が読取り専用の照会と型別painterを使って入力を決める。輪郭boundsは`HatchRegionEngine`へ集約し、fitとBlock boundsからも利用する。

### 寸法のCanvas描画

`DimensionRenderer`は直線／角度寸法のCanvas命令とラベル・編集枠・終端記号・数式マークを所有する。`DimensionMetrics`は共有instanceとして接続する。DimensionDisplayが共有する計測・配置・描画器を生成し、DimensionPresentationのPainterが外観・layout・描画計画を準備して渡す。rendererにSketchや拘束対象の検索をさせない。寸法配置と移動／編集操作は後続の整理対象。

### 寸法配置とlayout

`DimensionPlacement`（`src/rendering/dimension_placement.js`）は方向・anchor・相対配置・ラベル位置を担当し、Documentを参照しない。`DimensionLayout`（`src/rendering/dimension_layout.js`）は補助線・hit領域・文字方向・描画計画を担当し、現在scopeの線一覧だけをread portで取得する。DimensionDisplayが省略時の外観解決と描画先への接続を所有する。既存の角度ラベル補完による寸法更新は明示して維持し、操作側への移行時も更新順序を保つ。

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

- `DimensionInputController`（`src/ui/dimension_input_controller.js`）: 入力待ち状態を読取り、寸法レイアウト・所有Sketchの表示設定・入力検証をviewへ接続する。Canvasのキー操作でbufferを編集し、入力開始・確定・取消はコマンドへ委譲する。モデル更新は所有しない。

- `DimensionValueCommand`（`src/commands/dimension_value_command.js`）: 寸法値・式の確定、既存寸法の更新と失敗時復元、初回寸法追加後の表示範囲復元。入力イベントとDOMを所有しない。

- `OffsetSelection`（`src/editing/offset_selection.js`）: Offset対象・向き付きチェーン・選択確定を所有。現在のSketchと拘束を読んで接続判定し、成功した追加だけ表示同期を通知する。クリック／Enter／取消／モード切替はこのAPIへ接続する。

- `OffsetGeometry`（`src/geometry/offset_geometry.js`）: 距離・側・draftの計算。Geometry型とkernel／チェーン計算に依存し、Documentを変更しない。
- `OffsetConstruction`（`src/editing/offset_construction.js`）: Geometry追加と拘束commit、失敗時の追加分と採番復元。現在の編集対象・生成API・計算・拘束commitへ接続する。
- `OffsetCommand`（`src/commands/offset_command.js`）: 距離入力の開始・検証・生成要求・選択解除を調整する。イベント登録とプレビュー描画はappに残る。

- `OffsetCommand`はクリック選択・Enter確定・プレビュー値の解決も担当する。入力待ちtargetの更新を描画処理から取り除き、Rendererへ渡す値を生成する。
- `OffsetPreviewRenderer`（`src/rendering/offset_preview_renderer.js`）: 解決済みGeometryと寸法を描画する。操作状態とDocumentへの依存を持たない。

- `SketchTreeView`（`src/ui/sketch_tree_view.js`）: 階層・カテゴリDOM、開閉Map、幅・リサイズセッションを所有。再読込はcapture／restore、初期化はresetへ接続する。図形行の情報生成・編集／選択・hoverの操作は明示した依存先へ委譲する。

- `SketchTreeObjects`（`src/ui/sketch_tree_objects.js`）: Sketch別索引、図形／拘束行、拘束状態集計を生成。現在スコープと照会関数を受け取り、DOM・編集状態を所有しない。
- `SketchTreeController`（`src/ui/sketch_tree_controller.js`）: ツリーのクリックを展開・選択・Sketch変更・削除・固定解除へ振り分ける。Viewと既存の編集APIへ接続する。

- `SelectionHighlight`（`src/editing/selection_highlight.js`）: サイドバーhover状態、投影図形の表示上の同一性、選択図形／拘束の参照集合を所有・照会する。Canvas選択と投影／拘束照会、寸法hover接続だけを受け取り、DOMに依存しない。
- ツリー行のclass更新は`SketchTreeView.refreshSelection`へ、行データの対象解決は`SketchTreeObjects.resolveSelectionEntry`へ統合した。呼出し元もDOM生成も存在しない旧一覧向けイベント登録・選択処理は削除した。

- `AppearanceUI`（`src/application/appearance_ui.js`）: PropertiesとDocument設定が共有するcontrols／Paletteと起動時設定の接続。実編集とPalette sessionは既存ownerを使用する。
- `AppearanceControls`（`src/ui/appearance_controls.js`）: 図形／寸法外観の入力欄と継承値表示。Document非依存でPropertiesとDocument設定が共用する。
- `AppearancePalette`（`src/ui/appearance_palette.js`）: 色選択session、標準色／使用中色、確定と取消を所有。各対象への適用と履歴は既存APIへ接続する。

- `PropertySelection`（`src/editing/property_selection.js`）: Properties対象と共通値・対応項目の解決。selectedDisplayTargetは元の対象にlock／readOnlyと所有・作図Sketch labelを付けて照会し、モデルやraw対象を変更しない。操作状態とCanvas選択を読み、表示と編集の判断を共通化する。
- `AppearanceEditing`（`src/editing/appearance_editing.js`）: 外観入力の正規化と指定対象への反映。DOM・Selection・履歴非依存。
- `BulkPropertyCommand`（`src/commands/bulk_property_command.js`）: 一括適用の事前確認・同期・履歴・更新。入力プレビューと確定を区別する。

- `PropertyRows`（`src/ui/property_rows.js`）: 図形・寸法・拘束・Block・注記・複数選択の表示行。照会と書式を受け取り、モデルを変更しない。
- `PropertiesView`（`src/ui/properties_view.js`）: DOM更新・装飾・開閉状態・イベント接続。内容生成と編集処理は明示したコールバックへ委譲する。対象別内容構成はPropertiesContent、入力イベントと編集transactionはPropertiesControllerと各commandへ分離した。

- 寸法Propertiesの名前／式確定は既存`DimensionValueCommand.commitProperty`へ統合。Canvas入力pendingを変更せずsnapshot・Solver・履歴を調整する。参照式書換えと採番予約は既存`ParameterNamespace.renameDimension`が担当する。

- `GeometryPropertyCommand`（`src/commands/geometry_property_command.js`）: 補助作図切替・Spline開閉の保護判定、同期、Solver、復元、履歴。DOMを受け取らず、チェック状態の差戻し・通知・再表示範囲を結果として返す。

- `AppearancePropertyCommand`（`src/commands/appearance_property_command.js`）: 単独対象の外観適用先、プレビュー／確定、Block cache、履歴と更新。AppearanceEditingへ正規化を委譲。UIは入力検証と値変換を担当し、色パレットは同じowner解決を共用する。

- `PropertiesController`（`src/ui/properties_controller.js`）: DOM入力の検証・値変換・編集commandと操作開始への振分け。モデル・配置sessionを直接変更しない。Viewへinput/change/clickを接続する。
- `ElementPropertyCommand`（`src/commands/element_property_command.js`）: Solverを必要としない参照画像・注記・派生Instanceの基本プロパティ適用、履歴・再表示。DOMとSelectionは受け取らない。

- `PropertyPresentation`（`src/editing/property_presentation.js`）: 現在のscope／操作／選択からProperties表示情報を照会。HTMLとDOMは扱わない。
- `PropertiesContent`（`src/ui/properties_content.js`）: 表示情報から対象別のHTMLを構成。PropertyRows／AppearanceControls／Viewのsection生成を接続し、Documentや操作sessionは直接参照しない。

- `BlockPlacementCommand`（`src/commands/block_placement_command.js`）: 配置定義・中心・有効Sketch・回転ロック・パネル復元状態、開始／クリック／確定とpreview Instance。mode／pointerと採番はappへ接続する。Propertiesや取消からの状態直接書込みは除去した。

- `InstanceSourceCommand`（`src/commands/instance_source_command.js`）: 参照元編集対象と候補、追加時投影検証、確定時の順序／legacy ID維持・削除保護・関連拘束と注記の整理。表示はcurrent、CanvasはincludesRef、取消はresetを利用する。

- `GeometryInstanceCommand`（`src/commands/geometry_instance_command.js`）: Free／Mirror／Pattern作成の参照元候補・配置Instance、開始／確定／preview。Propertiesと変換編集はpending／isPlacing、各取消経路はclearPlacement／clearSources／resetを使う。

- `InstanceTransformCommand`（`src/commands/instance_transform_command.js`）: Freeの共有元を固定した回転・反転、Blockの表示中心を保つ直交回転とロック変更。各経路のSolver・復元・履歴・通知を調整し、DOMを受け取らない。

- `BlockConfigurationCommand`（`src/commands/block_configuration_command.js`）: 有効Sketch変更の投影差分、拘束・注記参照の検査、削除保護、関連選択解除、cache・履歴・更新。hover解除は所有者へのコールバックを利用する。

- `BlockCompletionCommand`（`src/commands/block_completion_command.js`）: Block下書きの完了条件検証、回転確認待ち、定義反映・参照整理・配置先求解・履歴。BlockEditorSession／BlockDefinitionEditingへ委譲し、確認UIはPromiseで接続する。

- `BlockDefinitionCommand`（`src/commands/block_definition_command.js`）: 作成・編集開始／取消・定義名変更／削除の進行。既存Session・DefinitionEditing・EditingQueries・Catalogを組み合わせ、DOMとviewportは明示した操作へ委譲する。BlockViewは一覧dialogと編集classも担当する。

SketchTreeControllerは行hoverの所有、pointer入出力とCanvasHover／sidebar強調の更新も担当する。appから行hover変数とイベント本体を除去した。

SelectionHighlightが拘束の定義図形role・表示ラベル・端点除外による強調集合も所有する。GeometryReadModel.scopeGeometryItemは現在scopeの通常図形ID検索を提供し、SketchTreeObjects／Controllerが共有する。

- `GeometryPresentation`（`src/rendering/geometry_presentation.js`）: GeometryRenderer、点描画、診断へ共通の描画状態・所有Instance選択／hover・色／線幅照会を提供する。状態更新、DOM、Canvas描画を持たない。

GeometryPresentationは点の可視性・中心表示・強調・ID／固定表示も判断し、GeometryRenderer.drawPointsはその状態から描画する。appのdrawPointsは整列済み点一覧の接続のみ。

GeometryPresentationはarcEndpointPaintState／splineHandleStateを提供し、GeometryRendererが編集ハンドルを描く。編集中Splineとドラッグは遅延照会、所属確認は現在scopeを使う。

- `AuthoringPreviewRenderer`（`src/rendering/authoring_preview_renderer.js`）: 基本作図とFilletの一時描画。modeはapp、確定点はcommandが所有し、描画は座標引数と幾何計算portだけで行う。

AuthoringPreviewRendererへSpline／Centerline／Trim描画も統合。Spline構築・path描画・円弧parameter角度は明示port、Centerlineのpointer投影は呼出し側。

- `InteractionOverlayRenderer`（`src/rendering/interaction_overlay_renderer.js`）: snap十字・ラベル、非アクティブSketch識別・参照関係ラベルの表示。操作状態は引数、Sketch関係は照会port。Selection／CanvasHover／DrawingSnapは更新しない。

- `PlacementPreviewRenderer`（`src/rendering/placement_preview_renderer.js`）: Block／Free Instance配置bundleの描画と共通Geometry描画。Hatch・注記描画は明示portで既存rendererへ接続する。

- `DrawingPreview`（`src/editing/drawing_preview.js`）: 作図pointer／Trim候補の所有、更新・reset・snap／hover調整。描画は要求のみ。appのpointermoveは距離寸法との処理順と消費／継続判定を接続する。

- `PointerInteractionController`（`src/editing/pointer_interaction_controller.js`）: pointer移動・終了の優先順位・消費／継続を調整。終了時は操作の確定APIを順に呼び、未消費かつLine始点が仮置きでない場合だけ履歴確定を依頼。UI adapterが座標変換・表示し、Schedulerが間引き、controllerが各command／drag／hover APIを呼ぶ。pending配置record更新は既存sessionへの暫定接続。

- `CanvasSelectionInteraction`（`src/editing/canvas_selection_interaction.js`）: 通常pointerdownのhit結果から選択とdrag開始を調整。CanvasSelectionの状態更新API、描画順照会、各drag開始、矩形、UI通知を接続する。command受付とhit生成は呼出し側。

- CanvasSelectionの`selectedElementCount`／`selectedDragPoints`が選択数・drag対象点の照会を所有。CanvasSelectionInteractionが通常図形の単独／複数選択drag計画を生成しGeometryDragへ渡す。appからのbeginDrag・選択照会callbackを除去。

- `BlankCanvasGesture`（`src/editing/blank_canvas_gesture.js`）: 空白double clickの候補・重複抑止状態、時間／距離判定、終了・取消の優先順位を所有。command・sessionの照会と操作を明示注入。

- `DrawingCommandInput`（`src/editing/drawing_command_input.js`）: 基本作図の拒否判定とclick振分け。高優先度のcommand受付はapp側。
- `PointCommand`（`src/commands/point_command.js`）: 仮入力記録・snap・点作成・選択更新・求解の順序。状態はTransientAuthoring／DrawingSnap／CanvasSelectionを使う。

- `InstanceCommandInput`（`src/editing/instance_command_input.js`）: Instance source・Sketch投影・Free配置・基準線指定の入力を既存commandへ接続。投影operand優先順位と空白矩形開始の規則を所有する。

- `AnnotationCommandInput`（`src/editing/annotation_command_input.js`）: 注記の配置・選択を別入口で扱い、Filletとの入力優先順位を保つ。
- `ConstraintCommandInput`（`src/editing/constraint_command_input.js`）: 寸法drag・距離配置・数値入力中のクリック・拘束対象指定を調整する。

- `CanvasPressQuery`（`src/editing/canvas_press_query.js`）: pointerdownのGeometry・scene hit snapshotを読取り専用で構成。
- PointerInteractionControllerの`down`が各入力ownerを順に呼び出す。appのpointerdown listenerはflushと委譲のみ。press接続は入力専用query／座標／操作APIに限定する。

- PointerInteractionControllerのdoubleClick／leaveにCanvasの残るpointer操作を集約。CanvasPressQuery.readDoubleClickが専用hit順序を保持し、Spline編集の開始だけはappのsession操作へ接続。

- DimensionInputController: 寸法／Offset入力欄のイベント受付とbuffer更新を既存の表示・キー入力責務へ統合。app.jsはbindInputで接続する。

- CanvasViewControls: Canvas表示設定の値とread-only live state、表示checkbox／button・window keyup／blurのlistener寿命を所有。bindWindowとbindControlsで起動順を保持。
- ConstraintStatusView: 拘束状態表示の固定／Space保持状態、blur解除、表示同期。CanvasViewControlsの内部値へ投影し、keydownの受付と編集対象判定はKeyboardInteractionControllerへ残す。

- KeyboardInteractionController: キーボード受付順と操作APIへの委譲。KeyboardInputが取消方針と生成接続し、注記ハンドルと選択解除の表示adapterを担当する。
- src/application/keyboard_input.js: mode／pending／各commandを現在値で照会する取消とkeydownの組立て、自己listenerのstart／dispose。状態や取消規則は既存ownerに残し、appは明示portを渡す。keyup／blurの表示解除はCanvasViewControlsが所有。

- GeometryInstanceCommand.cancel／BlockPlacementCommand.finishOrCancel: Esc時の配置状態更新とUI復元を既存の状態所有者へ集約。追加の依存注入は不要。

- SketchProjectionCommand: 投影元draftと開始／選択／確定／取消／reset。幾何範囲照会はappの読取り関数に残り、既存Projection編集moduleは保存済み投影の同期を担当する。

- SplineEditCommand: 既存Spline編集sessionと通過点の追加／削除／求解復元。SplineDraftは新規作成、SplineCommandは作成確定を担当する。

- SplineCommand: 作成開始とBackspaceによる直前点取消も統合。appはToolbar／keyboardから公開操作を接続する。

- RectangleSelectionQuery.readProjection: 投影元の矩形照会を統合。通常選択と幾何判定を共有し、投影元の適格性・候補providerは分ける。

- DrawOperationLifecycle: 複数作図コマンドの開始準備／終了／取消／進行中判定の調整。draft所有は各コマンドに残る。

- DrawOperationLifecycle.start: 基本9モードの開始を統合。Slot／Trimの初期化差分を明示し、ToolbarはDOM接続だけにする。

- FilletCommand.begin／OffsetCommand.begin: 事前選択付き開始を所有。共通初期化はDrawOperationLifecycle.prepareへ委譲し、Toolbarは開始APIに接続。

- ConstructionCommand: 選択図形の補助作図切替と未来の作図設定を所有。DrawOperationLifecycle.resetInputsは既に設定済みのmodeに対するdraft初期化だけを担当する。

- CanvasInputBinding: Canvas DOM入力接続と座標表示。CanvasNavigation.zoom: pointer中心の倍率変更。操作判断と状態は既存controllerへ委譲。

CanvasInputBinding.createCommandRoutingは通常pointer controllerに共通command panelとPNG範囲選択の入力優先順位を接続する。pointer・panel／PNGのreader・blank gesture・座標変換・blank判定・navigationの9入口だけを受け、後段panel／PNGを生成時には読まない。左押下はactive panel→PNG→通常controller、移動はinactiveを含むpanel通知→現在PNGとpan優先→通常controller、終了はPNGの左buttonだけ通常処理を抑制する。double clickは一回のsuppression→active panel→PNG guard→通常controllerとし、preventDefault・world／screen座標・同じevent／receiver・例外の停止範囲を維持する。panel／pan操作の後に切り替わったPNGもその都度読む。gesture state・panel command・編集／取消は各既存ownerが保持し、bindingのschedule／flush・計測・座標statusは既存createに残す。appは遅延readerと操作を接続する。

- KeyboardInteractionController.createCancellation: Escの一段取消と優先順位。状態は各commandから照会し、appはcommandとpending／selectionの限定APIを接続する。

- src/ui/runtime_version_view.js: 実行コミット情報の検証・状態保持・Help表示。appが起動データと翻訳を接続。

- src/commands/document_file_command.js: 保存・別名保存・native／互換入力による読込の進行と置換確認。DocumentFilesが排他・保存先・checkpointを所有し、appのimportFileDataへ読込適用を依頼する。

- src/ui/document_status_view.js: 履歴に基づくDocumentの保存状態表示。DocumentFileCommand.beforeUnloadは実データによる終了保護を担当。

- DocumentFileCommand.importFileData: 読取と待機中変更検知。appのapplyLoadedDocumentはDocument適用・求解・履歴・表示更新を接続する。

- src/persistence/reference_image_import.js: 参照画像の読取・デコード・縮小。図面への配置とは独立したprepare API。

- src/commands/reference_image_command.js: 画像準備後の現在scopeへの配置・選択・履歴更新。準備失敗ではDocumentとIDを変更しない。

- src/rendering/canvas_theme_colors.js: themeを明示した表示色補正・hex解析・contrast計算。appは現在themeを接続する。

- src/ui/sidebar_controller.js: サイドバーの開閉・タブ選択・入力接続。appはdocumentとsetHintを接続して一度bindする。

- CenterlineCommand.start: 中心線の事前選択付き開始を既存入力状態所有者へ統合。

- src/commands/circle_center_cross_command.js: 円中心十字の開始と単位操作。重複円の排除、8拘束の生成、求解失敗復元、成功履歴を集約。

- src/constraints/line_collapse_query.js: 拘束後の線の潰れ判定。対象Sketchを明示し、モデルを変更しない。

- src/persistence/dimensions.js: 寸法の保存用変換。配置adapterは明示し、保存・履歴・診断から同じcodecを利用する。

- src/editing/history_restoration.js: Document／Blockの復元調整。モデル読込・draft所有・履歴抑止は各既存所有者へ依頼する。

- src/editing/document_application.js: 復号済みDocumentの編集状態への適用順と補正結果を所有。decode／installはDocumentLoading、reset・ID予約・既定値補正は既存adapterへ委譲し、ファイルUIや履歴は持たない。

- src/document/state.js: 初期化・resetに加え、Document／Block scopeの外観正規化を所有。旧Root外観の引継ぎ先は明示したblockEditing値で選び、編集sessionは参照しない。

- src/document/block_state.js: Block定義・親子所有・scope配置の正規化。BlockCatalogとSketchContextの限定した照会・補完に依存し、編集先はコンテナ定義IDで受け取る。

- src/rendering/dimension_placement.js: normalizeDimensionで欠損配置の既定値生成と旧配置の補正も所有。対象と配置を明示引数にし、拘束の列挙と書戻しは呼出側に残す。

- src/constraints/operands.js: 拘束対象の生成・参照target／subject変換・同一性判定。Sketch関係は注入した照会で都度解決し、選択・コマンド状態には依存しない。

- src/ui/constraint_feedback.js: 求解案内・拘束状態ラベル・集計文面。状態を参照せず、呼出側が渡す結果と件数からmessage／kindまたは文字列を返す。

- src/geometry/appearance_query.js: 有効外観の継承と可視性照会。描画と選択で共用し、キャッシュの期間管理はGeometryReadModelに残す。

- src/commands/annotation_parameter_command.js: 注記Parameterのガード・編集・求解・失敗復元・履歴確定を調整。Parameter規則とcheckpointは既存所有者へ委譲する。

- src/parameters/namespace.js: symbolDeletionDependentsで削除対象記号と依存する式の照会を所有。削除の拒否と案内表示は呼出側が担当する。

- src/editing/clipboard_transfer.js: コピー値のID／座標変換とBlock投影参照の再接続。貼付けの状態管理から独立した入力・出力とMap更新を持つ。

- src/editing/clipboard_payload.js: scopeとSelectionから依存要素・対象内拘束を集めてコピー値を生成し、参照不足はエラーとして返す。


ClipboardGeometry（src/editing/clipboard_geometry.js）はコピー値からPoint・Line・Circle・Arc・Splineを生成し、指定scopeの配列へ順に追加する。ID発行器と既存の最小長／円弧正規化を注入し、明示したmodel・payload・Sketch・移動量を使用する。端点・中心・通過点は生成済みの実オブジェクトへ結び直し、後続のBlock／拘束再接続に必要なID Map・オブジェクトMapを返す。途中失敗で追加された要素と採番の巻戻しは貼付け全体のtransactionが担当し、このmoduleはSelection・履歴・Clipboard session・UIを所有しない。GeometryCreationの通常作図とはコピー値の復元と参照Map生成が異なり、正規化方針は同じ既存APIへ委譲する。


ClipboardPasteCheckpoint（src/editing/clipboard_paste_checkpoint.js）は貼付け直前のscope配列長・Geometry採番・他要素の採番・model内カウンタを保持し、失敗時に同じscopeへ復元する。要素をdeep cloneせず既存Objectと配列の同一性を保つ。復元順は配列長、Geometry採番、他の採番、modelカウンタ。appの採番変数はcaptureSequences／restoreSequences adapterで接続する。既存要素の値、ClipboardのpasteCount、Selection、mode、履歴、投影cacheはこのcheckpointの対象外で、既存の失敗復元範囲を拡張しない。操作全体のtry/catchとUI更新は呼出側が所有する。


ClipboardTransferは貼付ける注記の座標・Leaderの折点・基準点拘束の固定座標／参照経路、塗りつぶしの境界参照／seed、参照画像の配置移動も担当する。translateAnnotation／translateReferenceImageは呼出側がserializeした独立した値を更新し、copiedHatchは独立した値または参照不足を示すnullを返す。境界を書き換えられない場合の案内・例外、ID発行、Sketch割当、配列追加と復元は操作側が所有する。Parameter式と相対距離、画像の倍率・回転・埋込データは移動しない。静的codec／GeometryRef／HatchRegionEngineは呼出時に照会するため、従来のscript初期化順を維持する。


ParameterNamespace.prepareCopiedSymbolsは、明示した名前空間とClipboard payload・貼付け済み注記から寸法／注記の置換名を先に確保し、注記の式を付け替える。切取り寸法は同じ名前空間で名前が空いている場合だけ保持し、注記は従来どおり新しい名前を使う。rewriteCopiedConstraintSymbolは翻訳済み拘束値に名前と式を反映し、別名前空間では数値（角度は度）へ変換する。読取専用寸法の式を書き換えない。名前空間の採番は既存規則で更新するが、拘束復元・モデルへの追加・checkpoint・UI・求解は所有しない。現在scopeは呼出側が明示し、この処理内で切り替えない。


ClipboardTransfer.reconnectDerivedInstancesは、コピー時のsourcePositionsと現在の参照先を比較してFree Instanceの原点を上流から下流へ繰り返し調整し、生成bundleの有効性を確認して実オブジェクトを参照Mapへ登録する。点群を持たないHatch参照はseedを使用し、非Free Instanceの原点は変更しない。参照解決・source点群・bundle照会・エラー翻訳だけを注入する。scope選択・Instance配列への追加・cache無効化・失敗時のcheckpoint復元・UIは呼出側が所有する。繰り返し上限と収束判定は既存処理を維持する。


CanvasSelection.applyClipboardはコピー時の選択ID、生成ID／実オブジェクトMap、貼付け済み要素から選択状態を復元する。プリミティブは種別を確認し、注記とHatchは選択IDのみ、Block／派生Instance／参照画像は貼付け済み全体を選択する。ID発行、モデル生成、履歴、UIは所有しない。呼出側は先に既存clearSelectionで選択と関連UIを解除し、applyClipboardへ生成結果を渡す。


ClipboardSession（src/editing/clipboard_session.js）はコピー内容とcutフラグ、要素数、段階的な貼付け位置とpasteCountを所有する。copyは値を保持して通知した後に切取り削除を依頼し、削除失敗でもpayloadを残す。preparePasteは現在倍率から位置と次回回数を返し、recordPasteは捕捉したpayloadの回数を更新する。操作側は従来どおり求解前にrecordし、model checkpointの復元では回数を戻さない。Selectionの収集、scope／権限ガード、Geometry生成、履歴、UIは所有せず、コピー通知と削除操作だけを注入する。従来の診断用payload代入はreplaceForDiagnostics、消去はclearへ統一する。payloadは既存診断と貼付け値参照のため照会できるが、通常の状態更新はsession APIを使う。


ClipboardGeometry.appendBlocksはコピーしたBlock Instanceの定義存在確認・採番・配置移動・指定Sketchへの追加とID対応表登録を担当する。定義照会とID発行を注入し、enabledSketchIdsと外観を独立した値として保持する。定義不足はそのInstanceの採番前に失敗し、先行した追加の復元はClipboardPasteCheckpointへ委譲する。投影cacheの無効化とBlock投影再接続は呼出側が生成直後に実施し、処理順を維持する。


ClipboardGeometry.appendDerivedは派生Instance全体のIDを先に予約し、legacy生成IDと多段参照経路を繰り返し付け替え、別名前空間では必要な参照先がコピー対象か検査してから正規化・配列追加を行う。型別ID発行、既存コピー値変換、Instance正規化、翻訳を注入し、名前空間は呼出側が明示する。同じ名前空間ではコピーされない参照先を保持できる既存規則を維持する。Hatch IDの事前予約、投影cacheと生成後の再接続、失敗時の採番復元は操作側へ残す。


ClipboardGraph（src/editing/clipboard_graph.js）は明示したmodel・payload・貼付け先Sketch／Parameter名前空間／移動量から、貼付けるモデルの参照グラフを構築する。ClipboardGeometry、ClipboardTransfer、ParameterNamespace、要素ID発行、拘束復元、投影無効化、翻訳の7つの依存を組み合わせ、プリミティブ→Block→Hatch ID予約→派生Instance→注記／Hatch／画像→投影再接続→記号予約→拘束復元の順序を所有する。生成要素と参照Mapを返し、Selection・Clipboard session・UI・求解・履歴・checkpointを持ち込まない。構築途中の失敗は例外として外へ伝え、呼出側が既存checkpointで復元する。名前空間とscopeは同期処理の開始時に明示して渡し、この構築中には切替えない。


ClipboardCommand（src/commands/clipboard_command.js）はコピー／切取り／貼付けのガード・実行順序・成功案内・失敗復元を調整する。ClipboardSession、ClipboardGraph、ClipboardPasteCheckpoint、CanvasSelectionの所有者へ委譲し、現在の貼付け先・Parameter名前空間を限定したproviderで照会する。Geometry作成権限のガード、求解／履歴確定、失敗後の投影・表示同期は既存adapterへ接続する。コピーpayload作成後の空選択案内、Block定義ガード、checkpoint捕捉後のParameter照会、選択→回数更新→求解、例外時のcheckpoint→表示復元の順序を維持する。Clipboard操作に関して、appは生成と接続、mode／共有表示更新のadapterを担当する。既存の早期接続で関数宣言を参照しているため、appのコピー／貼付け入口はhoisted wrapperを保つ。


GeometryDeletion（src/editing/geometry_deletion.js）は明示したmodelと削除候補から、点／図形／拘束の削除対象集合を計算し、別のapply APIで対象をモデルへ適用する。planはPointUsageと拘束参照判定を注入し、共有endpointと実オブジェクトの同一性を保持する非破壊照会である。applyは既存と同じ順序で配列を置換し、削除ID／Geometry keyを参照する注記も除く。権限／派生参照／Parameter保護と操作状態終了は適用前に呼出側で行い、求解・履歴・表示も呼出側が調整する。CanvasSelectionはdiscardDeletedGeometryとdiscardDeletedConstraintsで選択を整理する。両者の間にSpline編集状態の解除を挟む既存順序を維持するため、二つの更新APIを持つ。hoverの解除はその所有者側で行う。Sketch削除は異なる階層ルールを持つため今回は統合しない。


GeometryDeletionCommand（src/commands/geometry_deletion_command.js）はプリミティブ／拘束の削除操作を調整する。権限→削除計画→派生参照保護→空判定→Parameter保護→操作終了→削除適用→選択／Spline／hover整理→入力候補のownerごとの求解→円弧正規化→表示→案内／履歴の既存順序を所有する。GeometryDeletion、CanvasSelection、SplineEditing、CanvasHoverの既存所有者を使用し、現在scopeはガード後に照会する。操作終了の順序は同commandが所有し、既存のSession／command実体と後段dragの遅延reset、mode変更・表示同期・analysis安定性の限定portへ接続する。求解不成功でも削除を記録する既存挙動を維持し、新しいrollbackは導入しない。appのdeleteElementsは早期接続を保つhoisted wrapperとなる。Annotation／Hatch／Instance等を含む混在選択の削除は既存SelectionDeletionCommandが調整する。


GeometryDeletionのplanDerivedInstances／planBlockInstancesは、投影bundleから削除ID・Geometry key・依存拘束を非破壊で計算する。拘束の再生成された投影はkeyで対応し、Blockのみowner自体を参照する拘束も対象に含める。派生Instanceのfalsy key除外とBlockのkey保持、古いBlock bundleのsplines省略を維持する。applyInstancesは拘束→注記→指定Instance配列を更新し、別種類のInstance配列や投影元Geometryは変更しない。派生参照／Parameterのガード、Block投影cache無効化、選択・求解・履歴は呼出側が所有し、既存順序で接続する。


SelectionDeletionCommand（src/commands/selection_deletion_command.js）は混在するCanvas選択の削除を調整する。Selection権限とHatch／Parameter保護の後にAnnotation・Hatch・画像を処理し、派生Instance→Block→通常図形の既存順序で各編集所有者へ委譲する。Instanceの計画／適用はGeometryDeletion、通常図形と拘束の削除はGeometryDeletionCommand、画像操作状態の解除はReferenceImageInteractionが担当する。通常図形が削除を確定した場合は追加の履歴を作らず、その他の要素だけならowner Sketchの求解またはUI更新と種別別履歴を確定する。途中の参照ガード拒否までに他種別要素が既に除かれている既存挙動も維持し、atomic化を仕様変更として混ぜない。appは生成・限定した共有表示同期・hoisted入口の接続を担当する。


ConstraintFeedbackのtargetHint／invalidTargetHintは拘束種別・operand列・言語から、対象選択中と対象拒否時の案内文を生成する。固定・寸法・対称などの段階別の文言と日英分岐を保持し、Document・DOM・pending sessionを照会または変更しない。汎用案内だけで必要になる拘束labelは限定したproviderを遅延評価する。appは現在のoperandと言語を渡すwrapperを持ち、拘束の受入判断・状態遷移・確定／取消は操作側の責務として残す。Document初期化・Sketch切替・削除では解除対象と順序が異なり、案内分離に合わせて汎用resetへ統合しない。


ConstraintOperandsのappendTargetは拘束種別・現在operand列・候補から、受入結果と新しいoperand列または拒否理由を返す。対称の軸→同種の2対象、重複／短線拒否、通常拘束の種別制限、再選択時の末尾移動と対象数上限を維持する。Arc型と線の向き判定を注入し、拒否案内は必要時だけproviderを評価する。入力列・Geometry・CanvasSelection・pending sessionは変更しない。appは成功した列を操作状態へ反映して選択を同期する。拘束対象の保存状態と確定／取消の所有は継続して整理する。


ConstraintTargetSession（src/editing/constraint_target_session.js）はpending拘束commandと順序付きoperand列の状態を所有する。beginは開始状態を設定し、appendはConstraintOperandsの受入規則へ委譲して成功時だけ列を更新する。resetは両方を解除し、clearOperands／clearCommandは既存の選択解除／Sketch切替／削除の異なる解除範囲を保持する。Annotationアンカーや寸法配置でのcommand復元と対象列置換は明示APIへ接続し、Geometryとcommandの参照同一性を維持する。読取getterにsetterはなく、app内の変数は撤去する。CanvasSelection同期・案内・求解・確定／取消の操作調整はまだ呼出側に残る。sessionはDocument・DOM・共有modeを所有しない。受入規則への接続は遅延adapterでclassic scriptの初期化順序を保持する。


ConstraintTargetCommand（src/commands/constraint_target_command.js）は対象選択の開始・取消・確定要求と線長寸法の完了入口を調整する。Annotationアンカーへの委譲→権限→作図入力終了→同種commandのtoggle取消→session開始／選択整理→既選択の意図解決という順序を維持する。sessionはConstraintTargetSession、受入と意図は既存規則、案内はConstraintFeedback、寸法配置と拘束確定は既存操作へ委譲する。取消前のcenterline／slot reset、共有mode／作図draft終了、拘束controlのblurは限定adapterで接続する。取消時の案内・button・toolbar・blur・描画の順序と、準備済み対象の即時配置／確定時に重複した案内を出さない動作を維持する。appの4入口はhoisted wrapperで早期接続を保つ。Canvas hit／対象clickや実際の拘束commitは継続整理する。


OperandHitQueryのhitConstraintOperandはpointer・拘束種別・現在operand列と任意の既知hitから拘束候補を照会する。Point／Line／Circle／Arc／Spline／円弧端点のhit providerを順に評価し、nullishな既知hitは既存と同じく再照会する。対称の軸／subject kind、対象種別で許可する円弧端点、Point→Line→円／円弧→Spline→派生投影→Block投影→参照Sketchの優先順を保持する。円／円弧のhit位置とSplineのparameter／近い端点を既存の幾何APIで取得する。operand列やSelection・操作sessionは変更せず、appは現在の列を渡すwrapperとhit providerの接続を持つ。


ConstraintTargetCommandのoperandClickはAnnotationアンカー→固定切替→空白での線長寸法確定→対象追加→意図解決→寸法配置／拘束確定の振分けを調整する。hitはOperandHitQuery、受入と列更新はConstraintTargetSessionに委ねる。固定では参照／派生投影を拒否し、Block投影またはprimitiveを個別Geometry固定へ渡す。選択解除と同期後に現在commandを捕捉し、固定成功後の選択解除を経て同じcommand参照を復元する既存順序を維持する。対象拒否では案内だけ、意図エラーでは同期後に案内と描画、未完了では選択UIと案内・描画を行う。実際の固定編集、寸法配置・値入力、拘束commitとUI更新は明示した依存へ委譲する。appは生成時の接続とhoisted入口を担当する。


ConstraintCommitCommand（src/commands/constraint_commit_command.js）は通常／参照拘束の追加、snapshot捕捉、前処理、求解、Parameter安定化、線退化／重複判定、失敗復元、成功後の分析・表示・履歴を調整する。通常の作成権限と対象scope、参照の先祖／循環ガードは既存の順序を保持する。重複寸法は復元して同じcommandの読取寸法登録へ進む。通常拒否のundefinedと参照拒否のfalseの戻り値差も保持する。参照metadataは同じ拘束Objectへ付与し、診断用markReference入口も同じ所有者へ接続する。既存checkpoint・Solver・退化／重複照会・Parameter・UI／履歴を明示した依存として使用し、現在modelやDOMを直接探索しない。計測時計は注入し、通常成功後の性能traceは同commandが保持して任意のobserverへ通知する。appは生成／接続とhoisted入口を担当し、共有sessionと組立ての調整は継続整理する。


DimensionConstraintFactory（src/constraints/dimension_constraint_factory.js）は明示した寸法target・値・配置から拘束Objectを生成し、constraintまたは生成拒否理由を返す。Geometry型と平行判定を注入し、点axisの優先、角度のdegree→radian、半径／直径prefixと配置値の同一性／複製範囲を維持する。非平行の線同士は理由を返し、silentかどうかと案内／logの表示は呼出側が判断する。モデル配列やUI・sessionは変更しない。DimensionQueries.targetItemsはtargetに含まれる参照要素を順序と同一性を保って返し、読取寸法のBlock所有判定などから使用する。寸法配置session、読取寸法の仮追加／重複照会、最終commitは操作側に残る。


DimensionReadOnlyQuery（src/constraints/dimension_read_only_query.js）は配置候補から読取寸法にする拘束を返す。生成拒否、明示的な測定寸法、単一Block内の対象、通常／参照の重複照会の順序を維持する。生成・owner付与・参照metadata・対象照会・重複probeを限定した依存として注入し、UIと配置sessionを変更しない。ConstraintRedundancy.probeCandidateは現在scopeへの候補追加、owner単位の既存解析、候補の参照による除去を所有し、表示用の重複診断状態を更新しない。候補の追加後に配列をfilterで置換する既存の参照関係を維持する。求解・履歴確定・読取寸法の保存登録は操作側が担当する。


DimensionPlacementCommand（src/commands/dimension_placement_command.js）は選択からの寸法開始、半径／直径開始、解決済み意図からの配置開始、配置中の追加対象による再解決、位置確定後の値入力／読取寸法登録への進行を調整する。既存DimensionPlacementへ配置値の計算、DimensionReadOnlyQueryへ読取判定、ConstraintTargetSessionへ対象列／commandを委譲する。選択開始だけ作図draftを解除し、意図からの開始はmode変更だけを行う既存の違い、既定pointerとdimension anchorの違い、表示→draw→focusの順序を維持する。appには共有mode／作図draftの準備、PendingCommandSessionのread／replace port接続とhoisted入口を残す。保留状態は他種別commandと同じSessionを共有し、寸法だけのSessionへ複製しない。注入する操作依存は多く、配置sessionと入力表示の所有を整理する際に組立て境界を再検討する。寸法値の評価／求解／確定はDimensionValueCommandが引き続き担当する。


ConstraintIntentResolver（src/constraints/intent_resolver.js）は順序付きoperandから通常拘束、通常／参照寸法の配置、参照拘束、参照対称、Spline拘束の意図または拒否理由を返す。関係区分、対象数、編集権限、先祖／子孫、循環、Spline端点の検査順序を保持する。全対象が参照側の寸法はactive Sketch内の読取測定として解決する。候補生成はConstraintCandidates、operandからのsubject／参照への変換はConstraintOperands、権限と参照関係は注入した照会へ委譲する。型と現在Sketchを明示し、Selection・session・pendingCommand・モデル配列・UI・履歴を直接変更しない。appは生成／接続とresolve入口、現在Selectionから対象を取得するadapterを担当する。


ConstraintSolvePreparation（src/solver/constraint_solve_preparation.js）は拘束追加前の円弧端点とOffset／OffsetChainの幾何前処理、および求解ステップ幅の算定と一時変更／復元を所有する。型、幾何照会、半径寸法の有無、最小長さ、OffsetChain計画を明示して注入し、対象Geometryを同じObjectのまま補正する。半径寸法のある円弧の保護、角度の周回、前処理の適用順序と一時ステップ幅をfinallyで戻す契約を維持する。Document配列・Selection・UI・履歴を変更せず、snapshot／求解実行／失敗復元はConstraintCommitCommandとDimensionValueCommandなど呼出側が担当する。appは生成／接続と早期参照のための3つのhoisted入口を保持する。


拘束対象とCanvas選択の変換は、ConstraintOperands.fromSelectionとCanvasSelection.applyConstraintTargetsが所有する。fromSelectionは明示したSelectionとpointerから点→線→円→円弧→円弧端点→Splineの順に対象列を返し、端点選択した円弧の全体対象を重複させない。Splineは注入したclosest-point照会を28 samplesPerSpanで行い、pointer→startPoint→原点の優先、parameterの0 fallbackと0.5を含むstart側判定を維持する。applyConstraintTargetsは解決済み対象列を既存set入口で反映し、tree／Instanceの選択を既存の範囲で解除する。注記など他カテゴリの選択は保持する。appは現在sessionの対象を照会へ渡し、現在Selectionとpointerを変換へ渡す接続だけを保持する。未使用のhandleConstraintTargetClickは撤去し、Canvas拘束入力はConstraintCommandInput→ConstraintTargetCommand.operandClick→ConstraintTargetSessionの経路を使用する。既存のダブルクリック経路は維持する。


ConstraintCommitCommandはreadOnly・resolution・dimensionの入口も所有する。読取登録は測定値を設定してreadOnlyDimension=true／enabled=falseとし、同じ拘束Objectを既存モデル登録へ渡す。Selection整理→分析→UI→draw→案内／log→履歴を保持し、求解は実行しない。解決済み意図は権限検査後、距離配置または通常／参照commitへ振り分ける。生成済み寸法の通常expression設定と参照expression省略、成功後の既存commit履歴に続く意図履歴を保持する。重複寸法の失敗復元から読取登録への経路は同じcommand内で完結し、appへ戻る依存を撤去する。寸法構築と配置開始、モデル登録／UI／履歴は限定したportへ接続する。appは生成／接続とhoisted入口を保持し、Selectionから意図を取得する入口は継続整理する。


ConstraintSelectionQuery（src/editing/constraint_selection_query.js）は現在のSelectionとConstraintTargetSessionを読む拘束の実行可否／完了可否／意図照会を所有する。対象session→Spline選択変換→通常Selectionの優先を保持し、型候補はConstraintCandidates、対象意図はConstraintIntentResolverへ委譲する。canApplyのGeometry mode制限と、収集済みoperandがあるcanCompleteの既存の判定範囲を区別する。線長寸法はcommand開始後の追加対象待ちを保持する。現在Sketchと操作modeを限定した照会として受け取り、Selection・session・pending・UI・履歴を書き換えない。appは生成／接続とhoisted入口を保持し、UIと対象操作・寸法操作は同じ照会に接続する。移管後にappへ残っていた未使用候補／subject変換の分解代入も撤去する。


ToolbarView.create（src/ui/toolbar_view.js）は描画modeと操作状態の表示値からToolbarのactive／aria-pressed／aria-disabledと既存のdisabled属性を反映する。操作状態は必要な値だけをreadInteractionで受け取り、現在model・sessionを直接参照しない。選択可視性と対象の編集可否は注入した照会へ委譲し、ボタンがない場合やGeometry mode外の既存の短絡評価も保持する。ボタン反映→履歴ボタン→選択可視性→Flyout→カーソルの順序を維持し、カーソルはFlyout同期後の最新操作状態を読む。実行command、選択可視性の変更、履歴編集は所有しない。appは各照会と既存CommandCursor／ToolFlyoutsへの接続とhoisted updateToolbar入口を保持する。


PropertySelection（src/editing/property_selection.js）は選択可視性の対象列と全対象の非表示判定も所有する。Propertiesの対象優先順位とは独立した照会とし、inspection、Root／作図Sketch、Block投影Geometryの除外、寸法の同一参照による重複除去と対象順を保持する。派生Instanceは明示visible上書きを優先し、未指定なら解決済みGeometry／Hatchの実効外観、空bundleならDocument／Sketch／Instanceの継承値を照会する。状態や配列を変更しない。

SelectionVisibilityCommand（src/commands/selection_visibility_command.js）はGeometry mode確認、対象取得、Sketch委譲または選択編集権限確認、次のvisible値の照会、通常対象のBulkPropertyCommand適用、派生InstanceのAppearancePropertyCommand適用、履歴／UI／drawの順で実行する。子commandにはcommit=falseを渡して既存の中間drawを保持し、最後に一回の表示切替履歴を記録する。Sketchの表示切替はSketchCommandの契約へ委譲する。DOM・Selection状態・外観継承計算を所有せず、appは生成／接続と早期イベント接続用のhoisted入口を保持する。


ConstraintSelectionQueryは点／線のFix一括対象、全対象の固定状態、Fixボタンの操作可否も照会する。投影・他型との混在・Arc端点・複数owner・constraint操作権限を区別し、点／線のObject参照を保って返す。ボタン可否ではAnnotation単独、Block単独、単一Block投影、Arc端点の既存の代替条件を保持する。Selectionや固定状態を変更しない。

ConstraintControlsView.create（src/ui/constraint_controls_view.js）は拘束ボタン、拘束メニュー、Fixボタンのactive／ARIAとhintのtitleを反映する。DOM要素、操作種別の照会、Fix可否、選択有無、翻訳を明示的に受け取る。Geometry mode外では表示解除だけを行い、準備／能力照会を呼ばない。Geometry mode内では呼出し側の保留寸法確認→拘束ボタン→メニュー→Fixボタン→hintの順序を維持し、FixメニューはFixボタン更新前の属性を参照する既存の契約を保つ。appは保留寸法の取消条件とcancelPendingCommandを接続し、Viewはモデル変更やcommand取消を所有しない。


DimensionValueCommand.startEditは既存寸法の編集開始を所有する。所有Sketchの編集権限確認→hitと寸法targetの検査→読取専用判定の順序を維持する。権限拒否はhitを処理済みとして返し、対象なしは未処理を返す。読取専用では選択／drag解除とhint／drawだけを行い、現在のpendingを置換せず入力へfocusしない。編集可能な寸法では保存dimension→hitのdimension→既定配置の優先順位と、保存expression→数値式のfallbackを保ち、入力待ち状態→選択／drag解除→hint→draw→focusの順で開始する。開始時は拘束値・履歴・保存形式を変更しない。appは選択とdrag解除の小さな操作portと、共通pendingの取得／反映を接続する。

DimensionPlacementCommand.targetDoubleClickはdistance操作中の単独Line選択を検査し、拘束ボタン更新→既存の選択から配置開始→distance-placeになった場合だけ既定配置から値入力へ進める。クリック位置ではなく既定配置を利用する既存動作を保持し、異なるLineのhit／Point混在／複数Lineは未処理として返す。Canvas入力受付はhoisted adapter経由でこの入口を呼び、appに寸法編集・配置の進行本体を重複させない。


PendingCommandSession（src/editing/pending_command_session.js）は共有の保留操作Objectを一つだけ保持し、read／currentで同じObjectを返し、replace／clearで通知なしに置換・解除する。各commandのbuffer・pointer・draft編集は引き続き同じObjectへ作用し、複製やkindごとの別Sessionへ分散しない。currentの代入口は公開せず、各commandには従来のgetPending／setPendingに対応するportを渡す。Sessionより早く生成する入力受付には遅延読取りadapterを残す。Sessionの生成時点で未初期化のcommandや入力表示への接続も遅延callbackとし、生成時には参照しない。

Session.cancelはInstance配置解除を必ず最初に行い、その後の最新状態から注記draft→PNG→Offset→通常の経路を選ぶ。注記とPNGは専用commandへ委譲して終了し、PNGがbusyで取消を拒否した場合もSession側で強制クリアしない。Offsetは選択／pointerを解除してからpendingをクリアする。通常の取消はpending解除→入力非表示→空でないmessageのhint→Toolbar→拘束ボタン→drawの順で、履歴を作らない。Document初期化・Sketch切替・削除による直接clearは取消に統合せず、既存の解除範囲と順序を呼出し側が保持する。appはSession生成と専用command／UIへの操作port接続、hoisted cancel入口を担当する。


CanvasRenderProbe（src/diagnostics/canvas_render_probe.js）はCanvas描画のラベル・マーカー・点の外観・寸法式マークを同期的に観測する診断責務を所有する。Canvas context、現在Geometryの照会、対象描画の入口だけを明示的に受け取り、Document・Selection・DOM・UI更新・履歴を所有しない。計測中だけcontextメソッドを差し替え、finallyで元の関数参照へ戻す。マーカー／点外観の計測では元メソッドのreceiver・引数・戻り値を保持して描画を継続し、ラベル列の計測では既存どおりfillTextを記録だけに置換する。

寸法式マークの記録callbackはProbe内に保持し、DimensionRendererの通知portへcaptureExpressionMarkを接続する。未計測時は記録せず、例外を含め計測終了時にcallbackをnullへ戻す。ネスト時にも元のcallbackを復元せず終了時にnullへ戻す既存動作を保つ。appの可変capture変数を廃止し、テスト用APIの7つの既存名称をProbeの各入口へ直接接続する。シナリオ準備やモデル操作を巨大な診断contextとして移さず、描画計測だけをdiagnosticsに集約する。


src/testing/はbrowser内で既存機能を操作してテスト用状態を準備し、その結果を観測する支援モジュールの置き場とする。src/diagnostics/は描画の一時計測や性能計測を扱い、productionの機能実装はgeometry／editing／commands／rendering／uiなど既存のownerへ置く。testingに機能処理やmodel状態を複製せず、production機能からTestDriverへ依存しない。classic scriptとして定義を読み込み、appのinstallTestHooksでtest queryが指定された場合だけDriverを生成・接続する。

SplineTestDriver（src/testing/spline_test_driver.js）はSpline用の初期化とCanvas client座標生成、編集・選択・Tree／Properties表示と保存データの状態照会、閉Splineの点変更後のHatch preview cache確認を担当する。既存のreset／Geometry生成／cache照会／viewport／履歴／UI更新・drawを明示したportへ委譲し、ID採番やSpline計算、cache実装を持たない。操作状態は必要なmode・編集Spline IDだけをreadOperationで読む。reset→viewport→resize→履歴→UI→drawと、その後のclient座標取得の順序を保持し、cache確認では同じPoint参照を変更して既存照会の再解決結果を返す。拘束シナリオもDriverに集約し、現在の対象Splineの読取り、SplineGeometryの評価／微分、型constructor、Geometry生成、拘束登録、既存求解、直列化を明示したportから使用する。閉Spline／対象なしでは無変更でnullを返す。PointOnSpline→接線Line→SplineLineTangentの生成と登録、求解後の直列化の順序と参照を維持し、拘束やSolverの機能実装を複製しない。appは五つの既存SplineテストAPI名を各Driverの入口へ接続する。コピー／Block化のシナリオは同じnamespaceのcreateTransferから生成する独立Driverへ分離する。初期化／拘束用のcreateへClipboard／Block依存を追加せず、用途に必要なportだけを接続する。採番はappの既存sequence callback、定義追加はDocumentへの専用callback、現在のGeometry配列はWorkspaceのscope照会を使う。scopeは貼付けや復元の前の値を捕捉せず、必要な時点で取得する。DriverはSplineに付随するLeaderのfixtureを用意し、既存ClipboardとBlockの生成・投影を操作して結果を観測する。コピー／Block化の機能、cache、ID sequence、独自rollbackを複製しない。Annotationの作成と選択→コピー／貼付け→元Splineの再選択→Block定義／instance追加→投影無効化／照会→UI／draw→観測の順序、戻り値と既存テストAPI名を保持する。


HatchRenderer.createLayerはHatchの表示レイヤーを構成する。既存の解決済み領域paintへ委譲した後、通常表示だけで境界GeometryをLine→Circle→Arc→Splineの順に重ね描画する。境界照会と型別painter、領域・外観照会、Selection・hover・mode・command・exportの読取りを明示し、Document・Selection・commandを更新しない。直接／Block／派生Hatchとinspection／拘束operandの選択強調、owner別hover、非表示Sketch除外、Sketch alpha、作成／修復の確定前regionと現在previewの順序を維持する。PNG出力中は強調とプレビューを抑制する。状態は必要な時点で読むcallbackを使い、後から生成されるHatchCommandも初期化時に読まない。幾何解決・cache・hit判定は既存の照会が所有し、appには表示レイヤーの生成と早期接続用のhoisted描画入口を保持する。


HatchGeometryQueryは既存の境界解決・face cacheに加え、描画／hit判定で使う境界Geometry収集、線幅からの画面上の除外幅、解決済みloopからの最短境界距離、選択可能な内部点判定を所有する。既存boundaryGeometry照会を再利用し、直接参照はkind／ID、Block投影はinstance同一性とlocalElement／sourceElementで照合する。派生投影は従来どおり境界overlay対象なしとする。Geometry参照と順序を変えず、モデル・外観・選択を書き換えない。有限な表示線幅の最大値またはDocument既定幅を使用し、半幅の最小値0.5pxに1pxを足し、現在倍率でworld距離へ換算する。境界距離は穴・複数loopと閉じる辺も含み、厳密な大なり比較を維持する。既定幅と倍率は数値照会callbackとして注入し、DOM／viewport自体は保持しない。appは照会を取得してrenderer／hit入力へ接続する。


ReferenceImageRenderer.createLayerは画像の可視性／Sketch可視性による表示対象収集と、inspection→単一選択→hoverの優先順によるoverlay候補を所有する。候補の可視性とactive Sketch／inspectionを検査し、候補拒否時に別候補へfallbackしない既存動作を維持する。selected flagは候補が表示されなくても元候補から求め、較正markerは独立して既存rendererへ渡す。画像配列・hover・較正点は現在値を照会し、Geometry参照・順序・Selectionを変更しない。描画とURL cache／ready／clearは既存のresource rendererを共有する。表示レイヤーは画像のimport・hit／編集権限・drag・較正状態の更新を所有しない。appは生成時に限定した照会を接続し、二つの描画入口を既存Canvas描画へ直接渡す。


GeometryHitQuery.createInstancesはBlock／派生インスタンスの全体hitと派生drag用の部分Geometry hitを所有する。Workspace・倍率・投影bundle・Sketch可視性／hit資格・Annotation bounds・Hatch解決／外観／内部点判定を明示した照会として受け取り、Selection・mode・モデルを変更しない。全体hitの描画順優先とeditableOnlyの既存判定を維持する。Blockは点→線→円→円弧→Spline→Annotation→Hatch、派生bundleはHatchを先に検査する既存差を保つ。dragでは資格照会後に点→円弧端点→線→円→円弧→Splineを検査し、種別内の逆順と円弧end→start、各画面距離閾値を保持する。全体hitとdragの可視性判定を新しく統一しない。appには生成／接続と早期接続用のhoisted入口を残し、既存の無効なBlock回転handle入口は従来どおりnullを返す。


GeometryHitQuery.createDimensionsは寸法のラベル／寸法線のCanvas hitを所有する。現在scope・倍率・通常選択mode・Sketch資格／可視性と、拘束からtarget／既定dimensionを作る照会、外観／layout／label／text metrics／式flag・矩形判定を明示して受け取る。拘束配列の逆順、activeOnlyの既定値、可視性の検査順、layoutとlabelの評価回数、回転・複数行・world-sizeラベルの領域判定、ラベル優先と寸法線距離を維持する。結果は既存constraint／target／dimensionの参照とpartを返し、Selection・mode・寸法値・履歴を更新しない。幾何とtext metricsの実装は既存所有者に委譲し、appには生成／接続と早期接続用のhoisted入口を残す。


GeometryHitQuery.createRegionsはHatch／Reference Imageの内部領域のCanvas hitを所有する。現在scope、通常選択mode、Hatch列と表示外観、Sketch可視性と作図先、描画順owner、既存Hatch境界解決／選択可能内部点、Reference Imageのworld→local変換を明示して受け取る。activeOnlyの既定値と各可視性検査順を維持する。Hatchはowner描画順の降順と同順位の安定順、Reference Imageは配列の逆順を保持し、二つの順序規則を統一しない。Reference Imageは回転・scaleを変換したpixel矩形の辺も含む。画像lockをここで新たに除外せず、編集資格は従来の操作側が検査する。元のObject参照を返し、配列・Selection・mode・作図先を変更しない。境界解決やキャッシュ・画面境界距離・画像座標変換の実装は各既存所有者へ委譲する。appには生成／接続と早期接続用のhoisted hit入口を残す。


CanvasWorkspaceLayout（src/ui/canvas_workspace_layout.js）はCanvasの表示領域変更とPropertiesパネル開閉の表示調整を所有する。Canvas・DOM・viewportとbitmap同期、Sketch Tree幅適用、draw、値入力の保留照会／位置同期、現在中心と表示言語を明示して受け取る。サイズ取得→bitmap同期→指定中心を保つviewport更新→Tree幅→draw→現在pendingを照会して入力位置同期の順序を保つ。幅または高さが0の場合と中心指定なしではviewportを変更しない。パネル開閉は中心取得後にclass／ARIA／titleを更新し、同じ中心でサイズ調整する。必要DOMなしでは無変更。Sketch Tree幅・値入力・bitmap／DPR・モデルや履歴の状態を複製せず各既存所有者へ委譲する。appは後から生成されるTree／値入力入口を遅延callbackで接続し、controls／windowの登録と起動時の呼出しを組み合わせる。


CanvasCommandCancellation（src/commands/canvas_command_cancellation.js）はコンテキストメニューのcommand取消可否と順次取消を所有する。mode・pending・拘束command・作図operationをその時点で照会し、Block配置→pending→拘束→進行中作図→作図tool終了の順に既存所有者へ取消を委譲する。先の取消で状態が変わった場合は後続の照会に現在値を使う。Blockはpanel stateを保持するreset→preview pointer解除→選択mode→Properties復元→案内を維持し、各取消後の既存副作用もそのまま委譲する。どれかを取り消した場合だけ最後に共通案内・UI・drawを行いbooleanを返す。何も取消対象がない場合は表示も更新しない。queryの短絡順と、Escが一つの優先操作を解除する動作との違いを保持し、二つの取消規則を統一しない。新しいdraft／mode／履歴・rollback状態を所有しない。appは各所有者の入口と表示通知を接続し、既存メニューの可否・actionから呼ぶ。


ConstraintCommandInput.createRetargetHoverは、寸法配置中の対象変更候補の照会とCanvas強調表示の更新を所有する。現在pendingを読む入口、CanvasHover、operand hit／同一判定／意図解決／参照対象変換とCircle／Arc型を明示して受け取る。distance-placeのline-length／radius／diameterだけで、nullを除いたoperandが一つの場合に候補を照会し、別対象かつ有効な解決結果の場合だけ強調対象へ変換する。point更新→endpoint／line／circle／arc・寸法解除→arc端点／Block解除の順序と参照同一性を保持し、Spline／注記等の他hoverを変更しない。対象外の配置ではprimitiveのhoverだけを解除し、hit照会とarc端点／寸法／Block解除は行わない。既存のchanged戻り値（booleanまたは既存hover参照／null）を維持する。pending・hover・Selection・履歴やモデルを複製せず、それぞれの所有者へ照会／更新を委譲する。appは状態と照会の入口を接続し、PointerInteractionControllerへ更新入口を渡す。


ParameterDialogController.createApplicationはParameterダイアログの適用入口と結果表示を所有する。draft・ParameterApplication・履歴／案内・scope再読込／error表示・error変換・UI／drawを明示して受け取る。現在sessionなしではfalseを返し副作用を起こさない。モデルへの適用・安定化・Block伝播・checkpoint復元はParameterApplicationへ委譲する。成功callback内の履歴→成功案内→捕捉したsession.keyの再読込→UI→drawを保持し、callbackの例外も既存ParameterApplicationのtry／復元の対象に含める。失敗時はsession.keyを再読込→error表示→error案内→UI→drawの順に処理し、error変換は既存と同じ二回の呼出しを保つ。適用結果のsuccessをそのまま返す。draftやモデル／履歴／checkpoint状態を複製しない。既存のdialog listener・未適用変更確認はcreateが所有し、appは初期化順に合わせたhoisted適用adapterを接続する。


HatchTestDriver（src/testing/hatch_test_driver.js）はブラウザテスト用の通常Hatch準備、穴付きsolid領域準備、状態照会、表示倍率変更、境界破損／復旧の六つの入口を所有する。test queryがある場合だけappが生成し、既存__jot2dTestのAPI名はDriver入口へ直接接続する。現在scopeを呼出し時に照会し、Geometry作成・ID採番・境界解決／キャッシュ・mode／Selection／preview・履歴・表示・保存は各既存所有者へ明示したportで委譲する。固定fixtureの座標・ID／nextHatchIndex・Construction指定・表示更新順・クライアント座標と照会結果を維持する。stateの派生Hatch照会回数とserialize／DOM照会の順序も保持し、scaleは既存clamp後にdrawして現在scopeから間隔を返す。境界破損／復旧はrefreshAnalysis:falseのUI更新を維持する。独自モデル／seq／cacheを持たず、巨大app contextを受け取らない。Block投影・転送とdrawing-orderのfixtureは別用途としてappに残り、SplineTestDriverや製品HatchCommand／HatchRendererの責務を重複させない。


HatchTestDriver.createProjectionはネストしたBlockのHatch fixtureと投影状態照会を、createTransferは境界不足／境界付きコピー・貼付けとBlock化の検証手順を所有する。通常Driverと別に生成でき、projectionの型／描画・定義追加の依存をtransferへ持ち込まない。projectionは既存Block定義生成と定義追加入口へ委譲し、固定fixtureのID・親子参照・回転・外観を維持する。定義追加→現在scopeへInstance追加→projection cache無効化→UI→fit→投影取得→座標変換→draw→結果照会の順を保持する。transferは現在scopeを各model access時に読み、元Hatchと境界Lineの参照を保持したまま既存Selection／ClipboardSession／コピー／貼付け／Block化へ委譲する。貼付け後は現在scopeで新Hatchを再照会し、境界Geometry参照・解決結果と既存の失敗結果を返す。独自のDocument／seq／Clipboard／projection cacheを所有せず、既存__jot2dTestの3つのAPI名はそれぞれの入口へ直接接続する。


DrawingOrderTestDriver（src/testing/drawing_order_test_driver.js）は描画順のブラウザテスト支援を所有し、createFixture（図形／Hatch／Block／派生Instance／別Sketchの準備）とcreateInteraction（順序照会／対象選択／並替え）を独立して生成する。DrawingOrderの純粋な順序処理は生成時に明示して受け取り、classic script読込時に後から定義されるnamespaceを参照しない。fixtureはモデル・定義・ID・projection cacheを独自に持たず、現在scope／Geometry作成／Block定義追加／Instance正規化／表示／履歴／保存の既存入口へ委譲する。固定fixtureの座標・ID・外観・一時activeSketch切替と元に戻す順序を保持する。interactionはkindとIDで既存Selectionを更新し、refreshAnalysis:falseのUI→draw後にDriver内のstate入口を呼ぶ。並替えは既存commandへ委譲してstateを呼ぶ。stateは現在scopeの順序正規化・Sketch別sort／種別判定・保存値のclone・Hatch境界照会・履歴照会の既存順を維持する。外部test hook objectのthisによる相互呼出しは使わず、stateと明示したreadHistoryで接続する。app内の共有test履歴readerは既存のhistoryState APIへも接続し、他のtest APIとの互換を保持する。test queryがある場合だけappがDriverを生成し、既存の四つのAPI名を直接接続する。


ConstraintTestDriver.createForcedCommit（src/testing/constraint_test_driver.js）は拘束確定時のSolver結果を強制するブラウザテスト支援を所有する。モデル初期化・Point生成・DistanceConstraint型・Solver・既存commit入口・現在scope・DOM照会の七つの依存を明示して受け取る。固定Point／距離fixtureの準備後、Solver.solveSubsetを元の関数として保存し、既存と同じsuccess／errorNorm／iterations／reason変換とvariableCount／constraintCountを持つ結果へ一時差替えする。既存commitNewConstraintを実行し、例外時もfinallyで元関数へ復元する。例外は握り潰さず、通常終了時だけ復元後にhintと現在scopeのconstraint数を照会する。commit結果はliteral trueだけを受理する既存判定を維持する。Solver／モデル／履歴の状態を複製せず、製品のcommit・回復処理を変更しない。appはtest query時だけDriverを生成し、既存commitConstraintWithForcedSolveResultForTestへ直接接続する。


ClipboardTestDriver（src/testing/clipboard_test_driver.js）はブラウザテストのClipboard状態照会・通常図形fixture・Block fixtureをcreateObservation／createGeometryFixture／createBlockFixtureとして独立して生成する。観測は現在scope・保存・Sketch種別／所有Sketch・activeSketch・選択照会・Selection／ClipboardSession・履歴照会の九つの依存だけで動き、fixtureの型・ID採番・描画依存を持たない。保存値取得後に現在scopeからSketch別Geometryを照会し、選択→payload統計→履歴の順で既存結果を返す。各fixtureはモデル初期化→ClipboardSession.clear→viewport→固定Geometry／拘束とSelection→履歴→UI→draw→共通readStateの順を保持する。Block fixtureは定義追加とInstance IDの採番を既存app入口へ委譲し、projection cache無効化と投影拘束の追加を維持する。現在scopeを各旧model access時に読み、独自Clipboard／モデル／seq／Selectionを所有しない。thisによるhook相互参照は明示したreadState／readSelected／readHistoryへ置き換える。app内の共有test選択readerは既存selectedGeometryIdsForTest APIにも接続し、他機能のテスト結果を維持する。test query時だけappが生成し、既存の三つのAPI名を直接接続する。


DerivedInstanceTestDriver（src/testing/derived_instance_test_driver.js）は派生Instanceのブラウザテスト支援をcreateFixture（投影／Mirror／PatternとHatchの準備）とcreateInteraction（保存状態／投影結果の照会、読込、source／Instance削除）として独立して生成する。fixtureは固定Geometryと参照関係、S2へのactiveSketch切替、Projection→Mirror→PatternのID採番順、Hatch領域生成、履歴→UI→draw→観測を維持する。IDはそれぞれの既存app採番入口を呼び、独自seqを持たない。interactionは保存値のclone後に現在scopeのInstanceを既存projection bundleから観測し、元の種別別Geometry／拘束状態色・Selection・Hatch妥当性・Tree／Properties情報を同じ順に返す。読込はclone→既存load→UI→draw→state、削除は既存deleteElements／deleteCurrentSelection→state→hintを保持する。thisによるtest hook相互参照はDriver内stateと明示したreadStateに置換する。モデル・projection cache・Selection・履歴は既存所有者に保持し、現在scopeを各旧model access時に照会する。test query時だけappが生成し、既存の五つのAPI名を直接接続する。作図commandの別fixtureはcreateCommandFixtureで分離する。Sketch ProjectionのBlock関連fixtureは専用の生成入口で分離する。


CanvasTestDriver（src/testing/canvas_test_driver.js）はブラウザテストの表示中心／倍率設定とworldからclient座標への変換を所有する。viewport・clampZoom・resizeCanvas・draw・Canvas・現在中心・座標変換の七つの依存を明示して受け取り、独自viewport状態を持たない。focusは既存のNumber／fallback→clamp→viewport更新→中心指定resize→draw→Canvas rectangle／現在中心照会の順を維持する。clientPositionは現在rectangleを読み、既存数値変換を行って座標変換へ委譲し、drawを行わない。test query時だけappが生成し、既存focusWorldForTest／worldClientPositionForTestを直接接続する。DerivedInstanceTestDriver.createCommandFixtureはInstance作図用のsource／axis／directionの準備を所有し、明示したfocus／clientPosition入口を受け取る。初期化→Geometry生成→focus→履歴→UI→draw→軸／方向のclient位置照会を維持し、thisによるtest hook object依存を持たない。既存resetForGeometryInstanceCommandTest APIを直接接続する。


SketchProjectionTestDriver（src/testing/sketch_projection_test_driver.js）はSketch Projectionのブラウザテスト支援をcreateObservation（投影Geometry／拘束／外観／保存／履歴／Tree・Propertiesの照会）とcreateGeometryFixture（通常Geometryと投影先Sketchの準備）として独立して生成する。観測は呼出し時のmode／command件数／投影拘束／scopeを明示したreaderで照会し、Geometryの型別状態・外観と描画色・拘束状態・冗長性→保存値のclone→履歴→Sketch階層→DOMの既存順を保持する。生成型を除くGeometry作成・Solver・表示更新の依存を持たない。fixtureは既存Geometry生成入口とscope所有者へ委譲し、共有Point参照・Construction・ID／座標・activeSketch切替・focus→履歴→UI→draw→client位置照会の順を保持する。CanvasTestDriverのfocus／clientPositionを明示して受け取り、SplineGeometryの評価は生成時に接続する。モデル／seq／Selection／履歴／投影cacheを複製しない。appはtest query時だけ生成し、既存resetForSketchProjectionTest／sketchProjectionStateForTest APIを直接接続する。rectangle／shared kindsの旧形式再現はcreateCompatibilityFixtureで分離する。Block編集・Block投影fixtureは独立した生成入口で分離し、製品のmigrationとは統合しない。


SketchProjectionTestDriver.createCompatibilityFixtureは矩形とPoint／Line／Circle／Arc／Splineの共有ノードfixtureを準備する。各既存Geometry生成・投影先作成・SketchProjectionConstraint生成と参照metadata／拘束追加・metadata同期・依存求解の入口を明示して受け取り、元の呼出し順と参照を保持する。reloadSharedVersion19指定時だけ保存値のcloneを加工して投影先のPoint IDを共有化し、不要な旧target Pointを除いて既存loadModelDataへ渡す。これは旧形式を再現するテスト処理であり、製品の保存形式やmigration処理ではない。再読込後の履歴→UI→draw→明示したreadStateを保持し、モデル・seq・Solver／cache・履歴を独自に持たない。既存二つのAPI名を直接接続する。通常生成／旧形式再現をそれぞれ検証するE2Eでは、投影元の共有参照、投影先Pointの独立性、矩形座標と所属Sketchを確認する。


SketchProjectionTestDriverのBlock関連支援はcreateBlockEditorFixture（下書きscopeの準備／確定）、createBlockProjectionFixture（Definition／Instanceと投影先Sketchの準備）、createBlockProjectionInteraction（Instance移動／削除）を独立して生成する。下書きは既存openBlockDefinitionEditor後に現在scopeを再照会し、CanvasTestDriverのfocus／clientPositionとBlockローカル履歴へ接続する。確定は既存completeBlockDefinitionEditへ委譲して現在編集状態と保存値cloneを観測する。投影fixtureはDefinition追加とInstance採番を明示した既存app入口で行い、固定ID／座標／revision・所属Sketch・cache無効化→projection bundle→focus→履歴→UI→draw→client照会を保持する。操作支援は生成型・定義追加・採番依存を持たず、現在scopeのInstance更新→対象cache無効化→依存求解→UI→draw→state、Selection設定→既存削除→stateの順を保持する。モデル／seq／cache／履歴は複製せず、thisによるhook参照は明示した表示／readState入口へ置換する。appはtest query時だけ生成し、既存五つのAPI名を直接接続する。Block下書き確定時のhost Geometry分離とInstance移動／削除時のDefinition保持を既存Block E2E内で検証する。


SketchProjectionTestDriver.createGeometryInteractionは投影targetの選択・外観変更、最初の投影拘束削除、source／target Geometry削除、source Sketch削除を所有するブラウザテスト支援入口である。呼出し時の投影拘束reader、既存Selectionと編集／削除command、表示・状態照会・client座標変換だけを受け取り、fixture生成・求解・Clipboard／Block化依存を持たない。種別別の同一Geometry参照をSelectionまたはdeleteElementsへ渡し、選択→UI→draw→state→client、外観変更／target削除→state、Sketch削除→stateの順を保持する。対象なしのnull／falseと既存操作の拒否結果をそのまま返す。thisによるhook間参照はprivate selectと明示したreadState／clientPositionへ置換し、Selection／モデル／履歴／cacheを独自に所有しない。既存六つのAPI名を直接接続する。単体境界テストで五つのGeometry種別の参照同一性、選択後の表示順、live拘束reader、拒否結果、委譲先のpayload、操作後の状態照会を検証する。


SketchProjectionTestDriver.createSourceEditingはsource Geometryの移動・形状変更・Spline構造変更と投影chain fixture作成を所有する。現在scope／所属Sketch／投影拘束を呼出し時に照会し、source Sketchの既存Pointのみ移動、既存Circle／Arc形状値とSpline fitPoints同一参照の変更、source依存求解→UI→draw→stateを保持する。chainはS3のupstream targetをそのままsourceに用い、必要時だけS4を追加し、既存target生成→参照metadata／拘束追加→metadata同期→依存求解→UI→draw→stateへ委譲する。upstreamなしのnullと求解結果のdependent失敗判定を保持し、独自モデル・採番・cacheを持たない。createReloadは別の六依存の入口で、保存値clone→版数Number変換→既存load→UI→draw→stateだけを担当する。Geometry生成・Solver依存を持たず、load例外をそのまま伝播して以降の表示／観測を行わない。thisによるhook参照は明示したreadStateへ置換する。既存三つのAPI名を直接接続し、E2Eでsource変更の追随／Spline構造／chain参照の保存再読込、単体境界テストでclone／変換・操作順・load失敗を検証する。


SketchProjectionTestDriver.createEligibilityFixtureは祖先／非表示祖先／自Sketch／兄弟／子／RootのLine fixtureを準備し、現在scopeと既存sketchProjectionEntryFromOperandを用いて投影資格を照会する。固定ID・座標・共有Hierarchy・activeSketch切替と照会順を保持し、資格規則自体は所有しない。createTransferは投影target選択後のコピー／貼付けとBlock定義作成の観測を所有する。selectは既存createGeometryInteractionへ明示して接続する。コピー失敗時はpasteを呼ばず、前後拘束数・貼付け結果Boolean化・現在Clipboard payload中の投影拘束数→stateの順を保持する。Block化は既存Selection取得・検証→中心照会→定義作成へ委譲し、検証エラーは作成前に返す。Geometry／投影拘束／外部投影拘束数の結果を保持する。モデル・Clipboard／Selection・Definition／cacheを独自に持たず、thisによるhook相互参照はselect／readStateへ置換する。既存三つのAPI名を直接接続し、資格制限はE2E、転送の短絡・拒否・参照／payload・事後観測は単体境界テストで検証する。


ReferenceImageTestDriver（src/testing/reference_image_test_driver.js）は画像のブラウザテスト支援をcreateObservation（現在scope／Selection・下書き画像・画像operation・履歴・viewportの照会）、createImport（data URL→Blob→File→既存画像読込）、createBlockFixture（Block下書き準備／確定）の三つの独立した入口として所有する。観測は呼出し時のscope・Block編集状態を照会し、選択ID→scope画像serialize→下書き画像serialize→calibration／drag→履歴→viewportの既存順を保持する。読込はfetch／Fileと既存importだけを受け取り、二段階await／名称・MIME既定値と例外を維持する。下書きfixtureはpreserveDocument以外ではresetし、固定Point／Line ID・座標・所属Sketch・既存openBlockDefinitionEditorを使用する。確定は既存completeBlockDefinitionEditのrotationLocked指定後に保存値cloneを返す。モデル／operation／Selection／viewport／cache／seqを複製しない。thisによるhook参照は明示したreadHistoryへ置換し、test query時だけappが生成して既存四つのAPI名を直接接続する。

DimensionTestDriver（src/testing/dimension_test_driver.js）は寸法のブラウザ観測をcreateAppearanceObservationとcreateRenderObservationに分ける。前者は現在scope／Documentを呼出し時に照会し、Document既定値・Sketch直接指定／継承・寸法直接指定／継承・Block内の寸法値を既存Appearance照会で取得してcloneを返す。後者は既存DimensionPlacement／DimensionLayout／DimensionMetricsとviewport・表示倍率へ接続し、線形／角度の補助線、終端記号、線幅、文字高さ／間隔の画面寸法を観測する。Appearance照会に描画依存を持たせず、描画観測にDocument／Block一覧依存を持たせない。対象なし／angle時のnull、既定寸法の生成条件、呼出し順・数値式とcloneを維持し、scope／Appearance／viewportの独自コピーや計算実装を追加しない。test query時だけappが生成し、既存二つのAPI名に直接接続する。

DimensionTestDriverのcreateRadiusFixtureは固定ID／半径30の円弧を一時生成し、既存DimensionPlacement／DimensionLayoutへ委譲して半径寸法の終端／外側軸／円弧補助線を観測する。createTerminatorFixtureは指定画面幅の配置planと、指定線幅／開き角／倍率での矢印先端を既存DimensionLayout／DimensionMetricsに計算させる。両者は呼出し時のDocument既定外観をreaderで取得し、テスト用Geometryをモデル／採番へ登録しない。数値既定値・有限値判定・倍率下限・演算式・結果形式を維持し、矢印の一時倍率は成功／例外の双方でfinallyから呼出し前の値へ戻す。円弧生成依存は終端fixtureに持ち込まず、描画アルゴリズム／独自viewportは追加しない。test query時だけappが生成し、既存三つのAPI名へ直接接続する。

DimensionTestDriver.createColorObservationは寸法色のブラウザ観測に必要なSelection／Hoverの一時解除とCanvas strokeの差替え・復元を所有する。呼出し時の寸法選択／拘束選択／寸法Hoverとstroke参照を保存し、既存drawDimensionsを実行する。stroke呼出しは元のctxと引数で転送し、色は小文字・初出順で重複排除する。成功／描画例外の双方でfinallyから同一参照の選択／Hoverと元strokeへ戻し、他の選択／Hover情報は変更しない。通常のCanvasRenderProbeへSelection操作を混ぜず、製品描画・独自状態を追加しない。appはtest query時だけ生成し、既存drawnDimensionColorsForTestへ直接接続する。

ParameterTestDriver（src/testing/parameter_test_driver.js）はブラウザテスト支援をcreateFixture（Document／二つのBlockの式・参照寸法、およびフィードバック検証の準備）、createObservation（現在のParameter・寸法／Block名前空間・投影長・保存値の観測）、createInteraction（既存Block化／寸法削除操作の実行）の三つに分ける。fixtureは既存reset／図形生成／拘束登録・Parameter名前空間補完／安定化へ委譲し、定義追加とInstance採番はappの既存所有者へのcallbackにする。固定Geometry ID／座標／式・参照寸法のenabled／readOnly指定・cache無効化→安定化→履歴→UI→drawを維持する。観測は呼出し時のscope／Documentを照会し、既存validateParameterNamespaceを最初に実行してから現在値を取得する。操作は既存Selection／Block Selection／定義作成／削除へ委譲し、対象なし・検証拒否・削除後の名前一覧／hint、選択Geometryの同一参照を保持する。観測／操作にはfixtureのGeometry生成・採番・Solver依存を持たせず、独自モデル／Parameter評価／採番／cacheを追加しない。test query時だけappが生成し、既存五つのAPI名へ直接接続する。

PropertiesTestDriver（src/testing/properties_test_driver.js）は外観／複数選択Properties／固定のブラウザテスト支援を用途別に所有する。createAppearanceObservationは既存Geometry一覧／Block投影・外観／可視性の照会に委譲し、種別別検索・Block内Geometryの優先順と対象なしのnullを保持する。createFixtureは既存reset／Geometry生成とSelectionへ接続し、二線の直接外観・mixedTypesの円、固定検証用S2／Point・Line、所属／座標と履歴→UI→drawを維持する。createPropertiesObservationは現在Selectionの直接／有効外観・target種別／DOM／履歴を、createFixedObservationは現在scopeのS2固定Point／Line・LineFixedConstraint数／ボタン／履歴を既存照会から返す。thisによる履歴hook参照は明示したreadHistoryへ置換する。状態照会にfixtureのGeometry生成を持ち込まず、外観継承・固定ルール／独自モデル／Selection／履歴を追加しない。test query時だけappが生成し、既存五つのAPI名へ接続する。

DocumentTestDriver（src/testing/document_test_driver.js）はブラウザfixtureの読込をcreateImportとcreateLoadに分ける。createImportはJSON→File→既存importFileDataをawaitし、完了後のDocument名／表示名／保存名／titleと経過時間を照会する。拒否のfalseも元どおり観測し、import例外は伝播する。createLoadは入力clone→file名stemをoverrideとして既存loadModelData→任意の履歴reset→UI→drawを実行し、適用・表示後の現在scopeの拘束数を返す。load／history／UI／drawを含む元のcatch範囲、既定file名／resetLoadedHistory=falseとerror.messageを保持する。ファイルsession／形式変換／モデル置換／失敗復元は既存所有者が担当し、支援側へ重複実装・独自モデル／履歴を追加しない。test query時だけappが生成し、既存二つのAPI名へ直接接続する。

CanvasSelectionTestDriver（src/testing/canvas_selection_test_driver.js）はメニュー選択のブラウザ支援を四つの入口に分ける。createOverlapFixtureは同座標の二線／非表示線／inactive Sketch線／Block内線を既存Geometry生成へ委譲して用意し、Definition追加／Instance採番は既存所有者のcallbackを使う。createEndpointFixtureは線と二円弧の端点選択用Geometryを準備する。両fixtureは固定ID／座標／Sketch切替、Selection・cache無効化・fit→履歴→UI→draw→client位置照会の順序を保持する。createObservationは既存CanvasContextControllerの候補と表示query、現在Hover／Selectionを観測し、Hover優先順／id・parameterName fallback／arcEndpointとmenuOpenを維持する。createPointInsertionは現在Canvas矩形／viewportから指定client位置の固定explicit Pointを追加し、UI→draw後のclient位置を返す。this経由のhook参照は既存CanvasTestDriver.clientPositionとreadSelectedGeometryへ置換する。観測／Point追加にBlock生成・採番を持ち込まず、候補選定／hit判定／選択ルール・独自モデル／Selection／viewportを追加しない。test query時だけappが生成し、既存四つのAPI名へ接続する。

ConstraintTestDriverのcreateInputObservationは現在Selection／ConstraintTargetSession・operandElementと明示したreadSelectedGeometryへ接続し、選択ID／Instance・arcEndpoint／pair・入力operand／pending typeを観測する。createIntentResolutionは呼出し時のscopeから入力IDと種別に対応する同一Geometryを取得し、既存makeConstraintOperand／resolveConstraintIntentとserializeConstraintへ委譲する。arc-endpointのarc key、endpoint／parameterの転送、未存在IDの例外、resolutionなしのnull、結果のaction／error／targetKind fallbackを維持する。入力観測にモデル検索／resolver・保存変換を持ち込まず、Intent支援にSelection／sessionの操作を持ち込まない。拘束判断／Geometry変換／入力sessionを複製せず、test query時だけappが生成し、既存二つのAPI名へ接続する。

CanvasSelectionTestDriver.createIdSelectionはテスト用ID選択を所有する。現在scopeのPoint／Line／Circle／Arc／Spline／Block InstanceとHatch／Annotation／Reference Imageの同一参照を既存Selectionへ設定し、clear→種別順の設定→UI→draw→Block選択query→選択ID照会を維持する。入力の既定値、scope配列順、重複IDの扱いとBlockエラー／内部・外部拘束数のfallbackを保持する。選択ルールや独自scope／Selectionを追加せず、test query時だけ生成して既存selectGeometryIdsForTestへ接続する。

CanvasSelectionTestDriver.createMoveObservationは既存SketchMove command状態／fieldsと現在Selection・scopeを照会し、target／active Sketch、選択ID／所属・描画順・拘束serialize・保存値・Block編集状態を観測する。CanvasTestDriver.createZoomObservationは指定時だけ既存clampを使ってviewport倍率を更新し、呼出し時のDocument unitsを複製して倍率／formatZoom表示を返す。既定null・数値変換と計算順を保持し、移動session／所属／viewportを複製しない。移動の観測にviewport依存、倍率の観測にGeometry／Selection／履歴依存を持ち込まず、test query時だけappが生成して既存二つのAPI名へ接続する。

CanvasTestDriver.createHitObservationは入力座標の既存数値正規化後にArc端点→Point／Line／Circle／Arc／Splineの既存hit queryを呼び、ID／端点とnullを返す。createGeometryPositionは呼出し時のscopeから同一Geometryを取得し、Point位置／線中点／円の右端／円弧の指定端点または従来の角度平均／Splineの指定端点または0.5評価位置を既存client変換へ渡す。従来の計算・detail既定値と未存在Geometryのnullを保持し、Spline評価を明示したevaluateSplineへ委譲する。hit側へモデル／viewport・位置側へhit判定を持ち込まず、hitルール／Spline計算／独自scope・viewportを追加しない。test query時だけappが生成し、既存二つのAPI名へ接続する。

PropertiesTestDriver.createHoverObservationは既存Geometry一覧／Block投影を照会して対象を取得し、Tree強調／Sidebar Hover／Canvas Hover／Block Hoverと既存geometryDisplayColor／geometryStrokeWidthの結果を観測する。対象なしのnull、種別検索・Blockの線→円→円弧→Spline優先順／短絡、PointのBlock投影・線端点除外、同一参照によるHover照合、construction指定と既存照会順を保持する。Geometry／Highlight／Hover／表示計算の既存所有者へ接続し、独自状態・製品の表示ルールを追加しない。test query時だけappが生成し、既存hoverDisplayStateForTestへ接続する。


CanvasTestDriver.createSnapObservationは現在viewport倍率と既存snapCandidatesから従来の10 CSS px以内のラベルを候補順に返す。入力の数値変換・距離境界を保持し、独自snapルールを持たない。createAuthoringObservationは現在mode／scope、拘束対象・pending command・drawing snap・centerlineの既存所有者と計測・Selectionの照会を接続する。placement座標／centerline始点／計測値は従来どおり浅いコピー、fillet previewと選択結果は既存参照を返す。制約serialize→decorateの順とnull fallbackを保持し、独自session／モデル／履歴を持たない。appはtest query時だけ生成して既存snapLabelsAtWorldForTest／authoringStateForTestへ接続する。


CanvasTestDriver.createSelectableLinePositionは現在scopeの線配列順と既存の0.37／0.63／0.5位置を試し、Point hit→同一参照のLine hit→寸法hitの短絡判定、Canvas矩形の包含とelementFromPointによる画面重なりを確認して最初の操作可能client座標を返す。候補なしのnullと矩形境界の包含を保持する。scope・hit・座標変換・DOM照会は既存所有者へ委譲し、選択ルール／独自モデル／viewportを持たない。appはtest query時だけ生成し、既存selectableLineClientPositionForTestへ接続する。


GeometryDragTestDriver.createPointDriver（src/testing/geometry_drag_test_driver.js）はPointドラッグの単発／連続テスト手順と結果観測を所有する。現在scopeから同一Pointを取得し、既存session生成→local solve context接続→preview更新→最終求解→円弧正規化→所属Sketchの拘束誤差照会へ委譲する。連続更新は初期位置基準の移動量と各previewの座標コピー／計測を維持し、単発のtarget拘束数は従来どおり最終処理後に照会する。対象／sessionなしのnull、失敗結果でも継続する既存手順と例外の伝播を保持する。独自ドラッグ状態／Solver／履歴を持たず、appがtest query時だけ生成して既存guidedPointDragForTest／guidedPointDragPathForTestへ接続する。


GeometryDragTestDriver.createGeometryDriverはPoint／Line／Circle／Arc／Arc端点の開始位置、previewとfinalのsnapshot・計測を観測し、既存のsession生成・local context・ドラッグ更新・最終求解・円弧正規化・所属Sketchの誤差照会へ委譲する。fractionのfinite判定／clamp、Arc端点wrapper、初期位置基準、snapshot時機、対象なしのnullとsessionなしの初期状態、既存結果のboolean／0 fallbackを保持する。拘束状態はinspectConstraints時だけ明示したreadConstraintStatusesを呼び、app内の従来照会本体を共有する。公開test hook同士のthis参照を持たず、独自Solver／session／拘束状態／履歴を持たない。appはtest query時だけ生成し、既存geometryDragPathForTestを接続する。


ConstraintTestDriverは拘束診断とBlock投影支援を用途別に生成する。createStatusObservationは既存refresh結果から現在Sketchの状態を返し、createAnalysisObservationは既存求解scope／Solver解析と拘束errorを照会して閾値1e-8・降順・上位12件と所属Geometry数を返す。createBlockObservationは既存refresh後にInstanceで投影bundleを絞り、同一Geometry参照のstatus・浅いsummaryコピーを観測する。createBlockConstraintInsertionは既存投影からPoint／Lineを解決して既存commitへ委譲し、解析→Block状態→保存値の順で観測する。対象なしの理由とcommitのliteral true判定を保持する。状態／解析／Block投影／編集は既存所有者へ接続し、独自Solver／拘束状態／履歴を持たない。appはtest query時だけ生成して既存四API名とGeometryドラッグへ同じ観測入口を渡し、公開hook同士のthis依存を持たない。


AnnotationTestDriver（src/testing/annotation_test_driver.js）は注記のブラウザ支援をcreateDragFixture／createSnapshot／createHitObservationで役割別に生成する。fixtureは既存reset・Geometry生成・leader参照生成・注記追加・Canvas resizeへ委譲し、snapshot入口を明示して準備後に照会する。snapshotは現在scopeの最後のLeader／Textを取得し、既存Leader表示計算とclient変換からworld／display／viewport座標を返す。hitは現在Canvas矩形から既存screenToWorld／hitAnnotationElementを呼びtype／partまたはnullを返す。固定座標・文字列・styleコピー、末尾優先と各座標のコピー／照会順を保持する。独自注記モデル／描画・hitルール／履歴を持たず、appがtest query時だけ生成して既存三つのAPI名へ接続する。


AnnotationTestDriverはcreateDimensionObservation（注記関係寸法の保存値・layout・label・hit）、createAppearanceObservation（指定typeの先頭注記のstyle・表示metrics／Geometry・保存値）、createOwnershipObservation（現在scopeの直接注記とBlock投影注記・Selection・bounds）を役割別に生成する。寸法観測は既存annotationDimensions／寸法表示を使い、寸法値のJSONコピーとlayout参照を保持する。外観観測は対象探索→指定時の倍率更新→対象なしnull→既存style→draw→metrics／表示／保存照会を維持し、styleのdeep copyと継承rotationを保持する。所属観測は現在Canvas矩形のclient変換、投影の同一参照・可視性／rotation／style fallbackと選択順を保持する。既存AnnotationRenderer／Appearance／表示Geometry／Document／Selectionへ明示的に接続し、外観観測以外へviewport更新／drawを持ち込まない。独自注記モデル／表示ルール／履歴を持たず、appはtest query時だけ生成し既存三API名へ接続する。


DimensionTestDriver.createReadOnlyDuplicateFixtureは既存reset・Geometry／寸法生成から重複寸法を用意し、既存layout・label・保存値で寸法数／read-only数／引出線整列誤差を観測する。createReadOnlyPlacementFixtureは既存寸法追加後、constraintTargetSession→pendingCommandSession→寸法入力開始の順で既存所有者へ委譲し、入力表示と現在scopeの寸法数を観測する。固定座標・同一target参照・所属Sketch・既存filter／fallbackと照会順を保持する。重複の判定／寸法計算／session／input／履歴は独自に持たず、重複観測にpending／入力依存を渡さない。appはtest query時だけ役割別に生成し、既存resetForReadOnlyDuplicateDimension／resetForReadOnlyDimensionPlacementを直接接続する。


DimensionTestDriver.createExtensionVisibilityFixtureは固定の傾いた矩形Geometryを既存reset／Geometry生成で準備し、既存dimensionLayout／dimensionFromAnchor／dimensionWithLabelAtからPoint間・線長の引出線表示を観測する。createDisplayCasesは既存寸法／実測のformatterへ固定の整数・微小誤差・分解能の入力を渡し、createTextAngleCasesは固定方向の既存JIS文字角度／offsetを観測する。表示精度／JIS規則／引出線判定は製品側へ委譲し、固定入力・計算順・showExtensionのfalse判定を保持する。表示関数を呼ぶ二つの支援にはGeometry／reset依存を渡さず、独自モデル／寸法計算／表示ルール／履歴を持たない。appはtest query時だけ生成して既存三API名へ接続する。


DimensionTestDriver.createAngleLabelFixtureは固定の直交線Geometryから、平行移動／半径変更／8回のlabelドラッグを行うテスト手順と観測を所有する。Geometry準備は既存reset／生成、角度layout・basis／offset読取と更新・label位置からの配置・寸法保存値は既存関数へ委譲する。旧label座標と破損relative offsetの入力、参照を更新するlayoutの呼出し順、保持offset・半径方向の誤差・保存version／legacy座標有無の観測を維持する。製品の角度計算／旧変換／寸法保存形式・状態／履歴を持たず、appはtest query時だけ生成して既存angleDimensionLabelFollowCaseへ接続する。


TrimTestDriver（src/testing/trim_test_driver.js）はcreateLineTransferFixture（線Trim後の左右拘束参照）、createConstructionBoundaryFixture（線／円弧／円のconstruction境界とpreview区間）、createDiameterTransferFixture（円Trim後の直径拘束・寸法保存値）を役割別に生成する。固定Geometry・拘束の準備は既存reset／生成へ、境界とpreview・Trim実行・拘束移送は既存query／editingへ委譲する。固定入力・boundaryCount数値化／下限・呼出し順と同一Geometry／拘束参照、fallbackと返却値を保持する。独自交点／区間計算・拘束移送・モデル／履歴を持たず、appはtest query時だけ生成して既存三API名へ接続する。


CanvasTestDriverはcreateAllGeometryFitFixture（遠距離Geometry／Sketchを準備して既存fitの結果を照会）、createMiddleButtonFitFixture（visible／hidden Sketchを準備して操作位置を返却）、createFitObservation（現在Canvas／viewportと既存visible bounds）、createFitOperation（既存fit後にdraw）を役割別に生成する。固定座標・所属Sketch／active切替と復元、viewport更新の順、padding数値化／fallback・fit→drawの順と返却値を保持する。Geometry準備は既存reset／生成と現在scopeへ、fit／可視性／座標変換は既存所有者へ委譲する。観測とfit実行へGeometry生成／reset依存を渡さず、独自scope／viewport／fit・可視性ルール／履歴を持たない。appはtest query時だけ生成して既存四API名へ接続する。


DimensionTestDriver.createSketchVisibilityFixtureは二つのSketchの固定寸法を既存reset／Geometry・寸法生成で準備し、元のactive Sketchへ戻して既存drawDimensionsからlabelを観測する。現在scope／所属Sketch・可視性の照会と変更は既存所有者へ接続し、二番目のSketch非表示→描画観測→再表示の順、filter／返却値を保持する。fillTextの差替えは各描画のtry／finallyで元のmethodへ戻し、成功／例外時の既存復元範囲を広げない。独自Sketch／寸法モデル・可視性／描画ルール／履歴を持たず、appはtest query時だけ生成して既存resetForActiveSketchDimensionVisibilityへ接続する。


CanvasRenderTestDriver（src/testing/canvas_render_test_driver.js）はdash isolationのテスト支援を作図preview準備（createDraftDashCases）、Block準備（createBlockDashCases）、観測手順（createDashIsolation）に分ける。作図／Block準備は既存command・previewと生成型／Definition追加／scopeへ接続し、modeはappのテスト用入口で設定する。観測は元のreset→viewport→preview／Selection reset→mode→setup→dash設定→draw→dash照会と12case順を保持する。固定入力・同一参照・Block ID・Sketch所属と例外時の元の実行範囲を維持する。全アプリcontextを渡さず、Block生成を作図側・作図commandをBlock側へ渡さない。独自mode／command状態・Definition／seq・renderer／履歴を持たず、appはtest query時だけ生成して既存canvasDashIsolationCasesへ接続する。

CanvasRenderTestDriver.createRenderingSupportは既存の作図preview／Block準備、dash観測、補助線Hover fixture、補助線描画観測の五部品を生成・接続する。通常描画を所有せず、同じauthoring／offset／placement Layerとcommand・scope・Canvasを明示的に受け取る。内部の準備／観測依存は各既存factoryへ限定して渡し、公開はcanvasDashIsolationCases、constructionLineHoverDisplayCasesForTest、constructionLineRenderingForTestの三関数に絞る。appのtest hooks有効条件と公開名・順序は維持する。生成時はモデル／Canvasを読書きせず、診断実行時のreset／mode変更・12case順・例外伝播・Canvas method復元を維持する。独自state・renderer・アプリ全体のcontextは追加しない。


PropertiesTestDriver.createInspectionFixtureは固定Geometry／reference・read-only拘束を既存生成型／編集へ委譲して準備し、UI→fit→draw→現在Canvas位置／IDを観測する。SketchTreeTestDriver（src/testing/sketch_tree_test_driver.js）はRoot／子孫Sketchのhover用Geometry／Block（createRootHoverFixture）とBlockの線／explicit Pointのhover fixture（createBlockHoverFixture）を役割別に生成する。現在scope・既存生成型／cache・UI／fit／draw／投影へ接続し、Definition追加／Instance採番はappのcallbackに留め、Block位置は既存CanvasTestDriverの変換を使う。固定座標／ID・所属／active Sketchの切替・constraintのreference／read-only設定と呼出し順を保持する。独自scope／採番／定義・Selection／hoverルール／履歴を持たず、appはtest query時だけ生成して既存三API名へ接続する。


OffsetTestDriver（src/testing/offset_test_driver.js）は単独Offsetの生成／保存再読込fixture（createPrimitiveFixture）、UI準備（createUiFixture）、状態観測（createUiObservation）、方向fixture（createDirectionFixture）を役割別に生成する。既存Geometry／Offset生成・拘束precondition／求解・保存／読込とviewport／DOMへ委譲し、固定入力・同一参照・target／expression更新→求解→計測→保存／reload→現在scope照会とUI／方向の呼出し順を保持する。UI観測に生成／reset・保存依存を渡さず、独自Offset計算／拘束・scope／履歴を持たない。CanvasTestDriver.createFixedPointFixtureは既存固定explicit Point準備・UI→fit→draw→位置照会を維持し、既存clientPositionを明示的に受け取る。appはtest query時だけ生成して既存五API名へ接続する。


OffsetTestDriverはOffset chain支援をcreateChainFixture（Geometry／UI準備）、createChainObservation（Selection／pending・接続／保存値の観測）、createChainReload（既存保存→読込→現在scope照会）、createChainTargetEdit（既存target／expression更新→precondition→計測／join観測）、createChainReselection（既存Selection reset→二つの結果追加→観測→reset／clear）で役割別に生成する。固定入力・同一参照・null／空配列fallbackと元の更新／照会順を保持する。対象検索・Offset計算／拘束更新・選択／保存は既存所有者へ接続し、独自chainモデル・Selection／pending・保存互換性／履歴を持たない。appはtest query時だけ生成して既存五API名へ直接接続する。


DocumentTestDriver.createSketchDeletionFixtureは固定の親子／兄弟Sketch・Geometry／参照付き注記を既存reset／生成で準備し、既存deleteSketchへ確認なしの削除を委譲して現在scopeのSketch ID／active／Geometry・注記数を観測する。remove入口も既存deleteSketchへ同じ引数で直接委譲する。固定入力・色・Geometry参照・active Sketch切替と削除／照会順を保持し、cleanup／namespace／履歴・削除実装は持たない。appはtest query時だけ生成し、既存resetForSketchDeletion／deleteSketchForTestへ接続する。


SketchTreeTestDriver.createSiblingVisibilityFixtureは固定Sibling Sketch／線を準備して、既存可視性・active関係／線幅・拘束色・Tree行の表示を観測する。createInactiveHoverFixtureはsource Sketchの寸法／Blockとactive子Sketchを既存生成・編集へ委譲して用意し、cache→fit→viewport移動→UI→draw→layout／client位置と所属関係を照会する。Definition追加／採番はappの既存入口、client位置はCanvasTestDriverへ接続する。createIdentityObservationは呼出し時のCanvas Hoverと既存Sketch関係のlabelを観測し、元のfallback／nullを保持する。固定入力・同一参照・所属／active切替・更新／照会順を維持し、独自可視性／編集先・hoverルール／scope・採番／履歴を持たない。appはtest query時だけ役割別に生成して既存三API名へ接続する。


PropertiesTestDriver.createStrokeStyleCasesは固定のactive／inactive・通常／construction線を既存生成で準備し、既存geometryStrokeWidthとconstruction alphaを観測する。CanvasRenderTestDriver.createConstructionHoverFixtureは直接線／Block投影線を準備し、既存Hover／drawLinesから端点overhangを観測する。createConstructionLineObservationは既存全Geometry線の対象を取得し、描画segment／端点markerを観測して既存外観と合わせて返す。固定入力・同一参照・描画／照会順とnull・丸めを保持し、Canvas method差替えは元のtry／finallyで復元、arcは元のmethodへctxを保って転送する。Definition追加とscopeは既存所有者へ接続し、独自色／線幅・hover／renderer／履歴を持たない。appはtest query時だけ生成して既存三API名へ接続する。


SketchTreeTestDriver.createSubtreeReferenceFixtureは固定の親／Sibling subtree／無関係／active子SketchとGeometryを既存生成で準備し、参照有効性→fit→UI→draw後に既存関係label／色・可視性・Tree行／位置を観測する。createSubtreeVisibilityObservationは既存Sketchの可視性設定とeffective可視性を呼出し時に照会する。ConstraintTestDriver.createReferenceLineMoveは既存参照元Line移動→依存求解→解析→UI→drawの手順と現在Point／Line座標を観測する。createDependencyOrderFixtureは固定参照拘束を既存mark／有効性／依存求解へ接続し、返却順とPoint位置を観測する。固定入力・同一参照・所属／active切替と更新／照会順を保持し、独自参照規則／求解順・namespace／scope／履歴を持たない。appはtest query時だけ役割別に生成して既存四API名へ接続する。


DocumentTestDriver.createCyclicReferenceFixtureは固定の相互参照Point拘束を既存生成／markで準備して既存serialize／loadへ渡し、解析→UI後に現在scopeの拘束数・operational／参照errorとbadgeを観測する。ConstraintTestDriver.createDimensionSelectionFixture／createDimensionSelectionObservationは既存寸法生成・Selection／command設定・UI→fit→drawとSelection／command状態を観測する。createSupportStatusFixtureは固定の支持／未拘束／固定線・円弧を既存生成／求解・解析へ接続し、status／色とsummaryを観測する。固定入力・同一参照・更新／照会順とnull／booleanを保持し、readReferenceErrors／readSummaryは既存所有者へ明示した照会入口を渡す。独自cycle判定／参照・Selection／command／拘束状態／求解／履歴を持たず、appはtest query時だけ役割別に生成して既存四API名へ接続する。


ConstraintTestDriver.createParentPointLineFixture／createSiblingPointLineFixtureは固定の親子／Sibling SketchとPoint／Lineを既存reset／生成で準備し、元の所属／active切替・fit→UI→draw→client位置を観測する。createSiblingReferenceMoveは既存参照元Lineの移動→依存求解→解析→UI→draw後に現在Point／Lineと逆参照cycle判定を観測する。createPointLineObservationは現在scopeの既存参照PointOnLine拘束を絞り、既存signed distanceと参照／所属Sketch IDを返す。固定入力・同一参照・対象なしnullと更新／照会順を保持し、独自点線関係／参照・cycle規則／求解／scope／履歴を持たない。appはtest query時だけ役割別に生成して既存四API名へ接続する。


BlockTestDriver（src/testing/block_test_driver.js）は作成UI fixture（createCreationFixture）、空作成fixture（createEmptyFixture）、回転lock／drag可否（createRotationObservation）、投影端点のclient位置（createEndpointObservation）、投影hover（createHoverObservation）を役割別に生成する。準備は既存reset／Geometry・拘束生成／Selection・fit→UI→drawへ、観測は現在scope／Definition数・既存Solver変数／drag session・投影／座標変換・Hoverへ委譲する。固定入力・同一Instance参照・null／boolean、変数filter／sortと呼出し順を保持し、空fixtureにGeometry生成・観測に作成／履歴依存を渡さない。独自Definition／採番／下書き・Solver／lock／hoverルール／履歴を持たず、appはtest query時だけ生成して既存五API名へ接続する。


BlockTestDriverはeditor状態の観測（createEditorObservation）、配置（createPlacementAction）、nested拘束（createNestedConstraintAction）、子Sketch Geometry追加（createChildGeometryAction）、取消／確定（createCancelAction／createCompleteAction）、enabled Sketch変更（createEnabledSketchAction）、作成拒否fixture（createRejectionFixture）を役割別に生成する。既存editor／session chain・scope、配置／拘束生成・求解／cache・履歴／UI／draw、既存取消／確定・Sketch変更／Selection検査へ委譲し、操作後の現在状態・保存値と拒否理由を観測する。固定入力・同一Instance／投影参照・数値fallback／nullと更新／観測順を保持する。Definition数とmodeはappの明示した照会入口を使い、独自下書き／Definition／採番・namespace／履歴・拒否規則を持たない。appはtest query時だけ生成して既存八API名へ接続する。


BlockTestDriver.createStateObservationは既存投影bundle・呼出し時のDocument Definition／scope・Selection／mode・保存値を観測する。createReloadは既存保存→読込→UI→draw後のDefinition／Instance／投影数とversionを照会する。createLegacyReloadは既存保存値のJSON cloneをversion 7相当に加工して既存loadへ渡し、階層／origin／所属／enabled Sketch／rotation lock・投影IDとversionを観測する。旧データの加工はtest fixtureだけに留め、製品migrationを持たない。配列コピー・boolean／fallback・同一参照と呼出し順を保持し、独自Document／Definition／cache／保存規則／履歴を持たない。appはtest query時だけ役割別に生成して既存三API名へ接続する。


PropertiesTestDriver.createHighlightObservationは現在SelectionのGeometry／端点・中心、既存effective拘束／constraintHighlightNodes、selectionHighlight、Canvas dimension HoverからIDを観測し、元の重複除外・優先順・null除外／sortを維持する。createHoverKeyObservationは既存全Geometry照会→Sidebar Hover判定→Geometry key→sortの結果を返す。選択／強調・Hover／Geometry照会は既存所有者へ役割別に接続し、独自Selection／highlight・所属／編集先やHover規則を持たない。appはtest query時だけ生成して既存sidebarHighlightIds／currentSidebarHoveredGeometryKeysへ接続する。


BlockTestDriver.createDefinitionUpdateFixtureは既存Definition編集／下書きLine更新／確定後に全Instanceの投影長と元Definitionのrevisionを観測する。createReadOnlyDimensionFixtureは既存投影Lineから固有寸法のtargetを作り、既存寸法生成／追加へ委譲して結果を返す。createExternalConstraintFixtureは既存投影Pointと固定anchorの拘束を既存追加／求解へ渡し、cache更新後の投影誤差・local PointとInstance姿勢を観測する。固定入力・同一Definition／投影参照・nullと更新／照会順を保持する。呼出し時のDefinition／scopeと既存編集／寸法／求解へ役割別に接続し、独自下書き／Definition・投影／寸法／求解・cache／履歴を持たない。appはtest query時だけ生成して既存三API名へ接続する。


BlockTestDriver.createInteractionObservationは既存Instance検索／投影とCanvas座標変換から操作点・表示中心のclient位置とscaleを観測する。Instance指定／先頭fallback・投影Lineなしの位置fallback・対象なしnullと照会順を保持する。DimensionTestDriver.createPositionObservationは現在scopeの寸法拘束から既存target／layoutを照会し、CanvasTestDriverのclient位置変換へ直接接続する。createExpressionActionは同じ拘束参照を既存式編集開始へ渡す。createSelectionDriverは既存clear→Selection設定→UI→drawへ委譲し、現在scopeの寸法index／線IDと単一Selectionを観測する。既存API名・同一参照・null／falseを保持し、独自投影／layout・式編集／Selection・scope／履歴を持たない。appはtest query時だけ役割別に生成し、座標変換は別test APIのthis経由でなく明示した入口へ接続する。


DimensionTestDriverは寸法コマンド中の線ドラッグ準備（createCommandLineDragFixture）・クリック配置準備（createClickPlacementFixture）・線／円と半径差準備（createLineCircleFixture）、線／円・半径差の状態観測（createLineCircleObservation）、半径差拘束の求解確認（createRadiusDifferenceRecovery）、クリック配置／線ドラッグの状態観測（createClickPlacementObservation／createCommandLineDragObservation）を役割別に生成する。準備は既存reset／Geometry・寸法生成／Selection／command・fit／UI／draw／座標変換へ、求解確認は既存姿勢変更→snapshot／依存求解→解析→UI→drawへ、観測は呼出し時のscope／拘束・pending／operands・dimension input／dragと既存計測／保存へ接続する。固定入力・同じ拘束／Geometry参照・null／fallback・pointerコピーと呼出し順を保持し、観測側に生成／reset依存を渡さない。独自寸法／Selection・pending／drag・求解／layout・scope／履歴を持たず、appはtest query時だけ生成して既存七API名へ接続する。


DocumentTestDriver.createNameObservationは呼出し時のDocument名・既存有効名／保存値とdocument.titleを、createFileObservationは既存file sessionのhandle有無／nameを照会する。CanvasTestDriver.createViewObservationは既存viewStateのコピーと拘束状態表示のmouse／Space状態を返す。SketchTreeTestDriver.createVisibilityObservationは既存Sketch・保存値・effective可視性・Tree button表示を照会する。PropertiesTestDriver.createThemeObservationは既存設定／保存theme・呼出し時の既定Geometry色／Canvas色変換・dark時のcontrastを観測する。既定色は明示したgetterで各照会時に読み、固定値のsnapshotにしない。同一参照・objectコピー・null／boolean／fallbackと照会順を保持し、独自Document／file session・可視性／表示／theme状態・保存規則／履歴を持たない。appはtest query時だけ生成して既存五API名へ接続する。


DocumentTestDriver.createHistoryObservationは呼出し時のactiveEditHistoryを照会し、Undo／Redo件数・Block編集・button disabledとConstruction状態／button表示を返す。CanvasSelectionTestDriver.createIdObservationは既存Selectionの六種類のGeometry IDを同じ配列順でコピーして返す。GeometryDragTestDriver.createResponsiveFixtureは既存sample生成→fit→draw→履歴reset→保存値取得を同じ引数と順で実行する。既存公開APIと各test driverへ渡す共通照会入口を維持し、最新値・null／boolean・DOM要素なしのundefinedと同じ参照元を保持する。独自履歴／Selection・モデル／viewport・Geometry生成／求解規則を持たず、appはtest query時だけ生成して接続する。


CanvasContextTarget（src/editing/canvas_context_target.js）はcontext targetと既存Selection／拘束hit／Fix照会のadapterを所有する。createSelectionは対象の種類・同一参照／Arc端点・寸法の選択照会、既選択集合の保持またはclear→対象設定、拘束operand向けhit構成を提供する。既存hitがあればその参照を優先し、端点計算はfallback時だけ既存Geometry入口へ委譲する。createFixObservationは既存batch／固定拘束照会と現在Selectionからmenuのenabled／fixedを返し、batch優先・種類別の条件／nullと短絡順を保持する。Selection状態はCanvasSelection、拘束／batch規則は既存照会所有者へ留め、独自Selection／拘束・履歴・DOM／描画・menu表示／action実行を持たない。候補収集／順位はCanvasContextQuery、表示はCanvasContextPresentation／CanvasContextMenu、項目構成はCanvasContextPresentation.createItems、action調整はCanvasContextActionsが担う。CanvasContextInteractionが役割別の四port／六portで生成し、同じSelectionを項目構成・候補確定・Entryへ接続する。


CanvasContextPresentation.createItemsはcommand／空白／対象別のmenu項目データ構成を所有する。呼出し時のmode・既存command／Selection／Spline編集状態、編集／生成可否・read-only寸法／配置group・Block編集error・Fix／Construction／Geometry／Drawing Order・copy可否／選択とUndo／Redo button表示を明示した照会／所有者へ接続し、action ID・ラベル／shortcut・disabled／danger・group／separator順を返す。commandと空白の短絡、編集中fit pointの操作抑制、Block errorと生成可否の短絡・照会順を維持する。候補ラベルのcreateとは独立したfactoryと依存で生成し、Selection更新・action実行・履歴・menu session／DOM描画を持たない。CanvasContextMenuは表示／session、CanvasContextTargetはtarget／SelectionとFix照会を引き続き所有する。appは生成と既存menu呼出しへの接続を担い、action調整はCanvasContextActionsへ委譲する。


CanvasContextActions（src/commands/canvas_context_actions.js）はCanvas context actionの編集guardと既存操作への振分けを所有する。Selection／対象Sketchの編集guard→対象またはSelection／active Sketchの構造guardという順と短絡を維持し、command取消／実行・履歴・clipboard／既存button click・Properties・Block／寸法／Sketch／Hatch／Drawing Order／Spline／viewport操作を明示した既存入口へ委譲する。寸法整列が成功した場合だけUI→draw→履歴→hintを行い、fit結果ごとのhint後にdrawする。既存hit／target／pointer／Spline参照・必要引数の判定・method receiver・void paste／未定義returnと例外伝播を保持する。新しいSelection／command／model・履歴／求解規則・menu sessionは持たない。appは所有者を接続し、早いmenu生成時のcallback参照を保つ薄い委譲関数を残す。項目構成はCanvasContextPresentation、targetとFix照会はCanvasContextTarget、menu表示／sessionはCanvasContextMenuが所有する。


CanvasContextMenu.createEntryはCanvas context menu開始時の進行を所有する。menu有無／Geometry mode→native event抑制→既存menu終了→Canvas座標／last pointer更新→command照会→候補取得／表示分岐→単一対象選択／UI→draw→項目構成／既存sessionのopenという順と短絡を維持する。通常commandでは候補照会を省略し、拘束commandと重複候補では候補表示を優先する。pointer更新はappのsetterへ、候補／Selection・command・項目・表示sessionは既存所有者へ委譲し、新しいsession／操作状態を持たない。CanvasContextTarget.createCandidateActionは現在拘束commandがあれば既存hit構成→operand処理へ、それ以外は明示的な対象置換→UI→drawへ進める。pointerなしの原点fallback・同一target／pointer参照・未定義returnと例外伝播を保持する。CanvasContextInteractionは両factoryを生成・接続し、appは早いmenu callback登録を保つ薄い委譲関数を残す。後で初期化されるmenu終了入口は操作時のcallbackで照会する。


FixedToggleCommand（src/commands/fixed_toggle_command.js）は固定状態切替のoperand経路（createOperand）とSelection経路（createSelection）を独立した依存で生成する。operandは既存Sketch／投影shape guard後にLine／Arc端点／Geometryの固定拘束を照会し、同じ対象参照で既存delete／commitへ委譲する。Selectionは既存guard後、単一Instanceまたは同一Instanceだけの投影選択・Arc端点・Point／Line batchの優先順で切り替える。Instanceの更新／表示／履歴、端点commit失敗時のsnapshot復元、batchの固定拘束追加／逆順除去→依存求解→主／依存失敗または許容誤差超過時の復元と表示、成功時の解析→hint→UI→draw→log→履歴の順を維持する。現在scopeはgetter、許容誤差・型／参照照合・batch判定・snapshot／restore・求解／履歴は明示した既存所有者へ接続し、独自モデル／Selection・拘束型／Solver／snapshot形式／履歴を持たない。無関係な拘束・同一参照・既存enabled判定・boolean／return／例外伝播を保持する。appは二factoryを生成し、早いConstraintTargetCommand callback登録を維持する薄い委譲関数と既存button経路へ接続する。


ConstraintControlCommand（src/commands/constraint_control_command.js）は拘束button入力のcommand判断を所有する。activateは同じcommand再click取消→Annotation anchor優先→Symmetry開始→選択へ適用可能なら既存取消／距離開始またはpending取消→command置換→Toolbar／拘束button更新→拘束追加、それ以外は対象選択開始の順を維持する。activateFixedはGeometry mode確認→Annotation anchor優先→同じ固定command取消→Selectionなしの対象選択／Selectionありの既存FixedToggle切替を行う。両経路の優先順を統一せず、既存session／選択判定・各commandとUI通知へ明示したportで委譲し、独自mode／pending／Selection／拘束・求解／履歴を持たない。ConstraintControlsView.createBindingは拘束／menu／Fix buttonのclick登録と解除を所有し、datasetを操作時に読み、menuは元button click→details閉じの順を維持する。bindは二重登録せず、disposeで登録したlistenerだけを除去し再bindできる。状態表示のcreateとは独立した依存で生成し、command判断／モデルを持たない。appは二factoryを接続してbindする。


DocumentFileControls（src/ui/document_file_controls.js）はDocument入出力のUIイベントをDocument用（createDocument）とDXF用（createDxf）の独立した依存／登録寿命で生成する。Document用は保存／別名保存／読込・file input・Document linkを既存DocumentFileCommandへ委譲し、元のinput handler／method receiver・非同期void呼出しと必須／任意要素の扱いを維持する。任意input不在ではhandler照会も省く。DXF用はpointer flush→busy／編集可否の短絡→拒否hintまたはfile picker、change時の同じinput／File取得→input値解除→既存importという順を保持する。Fileなしのundefinedも既存どおり渡す。各bindingは二重登録せず、disposeで登録したlistenerだけを解除し再bindできる。ファイルsession・保存形式／互換性・リンク処理・import／モデル／履歴を所有しない。PNG／Reference Image／Sketch作成とstartup／beforeunloadは別の既存経路へ留め、appは二factoryの生成／bindと各所有者の接続を担う。


ToolbarView.createEditingBindingはUndo／Redo・選択可視性・選択削除・Annotation開始の五つのclick listenerとその登録寿命を所有する。Undo／Redo／可視性には同じ生handlerを登録し、Annotationは操作時に既存commandのstartを呼ぶ。削除はGeometry mode確認→既存削除→成功時だけUI更新→drawを維持する。任意button不在を許容し、二重bindを防止、disposeは自分のlistenerだけを解除し再bindできる。作図controlのcreateBindingとは独立して元の起動位置へ接続し、履歴・Selection・modelの更新規則は既存ownerへ残す。

ToolbarView.createBindingは作図／派生／Block／Hatch等21個のToolbar controlと既存command開始入口の接続・click listener登録寿命を所有する。Select／Point／Line／Rectangle／Slot／Trim／Circle／Arc／Three-point Arcは既存DrawOperationLifecycleへ、Centerline／Circle cross／Sketch projection／Instances／Construction／Fillet／Block／Offset／Spline／Hatchは各既存入口へ同じ引数とhandlerで委譲する。必須／任意要素、任意control不在でhandler照会しない短絡・元の生handler／DOM receiverとLifecycleメソッドの操作時照会を維持する。bindは二重登録せず、disposeで登録したlistenerだけを解除し再bindできる。状態表示のcreateとは独立した依存で生成し、mode／作図状態・開始／取消／guardルール・モデル／Solver／履歴を持たない。appは各commandを接続してbindし、開始処理と状態は既存所有者へ留める。


DocumentDefaultAppearanceCommand.createGeometry（src/commands/document_default_appearance_command.js）は通常／ConstructionのDocument既定外観更新を所有する。UIから検査済みkey／trim済み値を受け取り、現在の既定値を既存applyAppearanceInputへ渡す→対応normalize（partial:false）→Document既定値置換→同じ履歴label→UI→drawの順を維持する。readDefault／writeDefaultはappのDocument状態adapterへ、正規化・反映／履歴／表示は既存入口へ接続し、独自Document／外観型・正規化ルール／snapshot／履歴を持たない。正規化例外の伝播と既存の非rollback動作も保持する。DocumentAppearanceSettings.createGeometry（src/ui/document_appearance_settings.js）は設定を開く際の通常／Construction fieldのmarkup／localize・handler準備を所有する。現在の既定値・通常からConstructionへのeffective合成・継承なし／端点／idPrefixを維持し、key検査→trim→専用command、同じpalette対象へ接続する。要素不在は既存どおり短絡し、Document変更／描画／履歴・dialog／寸法／Terminator／Leaderを持たない。appは独立した八portずつで生成・接続し、設定clickからprepareを呼んだ後に残る設定とdialogを準備する。


DocumentDefaultAppearanceCommand.createDimensionはDocument既定寸法外観の値反映を所有し、検査済みkey／rawValueを既存applyDimensionAppearanceValue（allowInheritance:false）→dimensionDefaults→既定値置換→history指定時だけ同じ履歴→drawの順で処理する。既定値は限定getter／setter、dimensionDefaultsは既存namespace receiverを保つapp adapterへ接続し、独自正規化／履歴／Document状態を持たない。DocumentAppearanceSettings.createDimensionは現在寸法／Terminator既定値の合成→normalize（partial:false）→rows→affix準備→localize→angle可視性とinput／change／palette handler準備を所有する。inputはprefix／suffixだけを生文字列で履歴なし反映し、changeは検査／値反映後にangle可視性→UIを行う。prefix／suffixの空白・改行、他値のtrim、無効key時のvalue照会省略とchange側表示通知、要素不在の短絡を維持する。UIはDocument変更／履歴を持たず、commandはDOM準備を持たない。appはGeometry用とは独立した六／十portで生成し、設定clickでGeometry→Dimension→残る共有既定値→dialogの順に接続する。


DocumentDefaultAppearanceCommand.createSharedはDocument共通Terminator／Leader既定値の更新を所有する。Terminatorは既存normalizeTerminatorの部分値を現在objectへObject.assignし、Leaderは既存applyLeaderAppearanceValueへ現在既定値・viewportScale・Document実効外観を渡す。反映→呼出し元の共有再表示→同じ履歴→UI→drawの順とobject参照／namespace receiver／例外伝播を保持する。新しいDocument／外観規則・snapshot／履歴・DOMは持たない。DocumentAppearanceSettings.createSharedは既存共通property rowsと実効外観照会による二field表示・handler準備を所有する。key検査、Leader checkboxの反転と他値の生文字列、同じpalette対象・更新後の両section再表示、元の必須field扱いを維持する。commandへkey／値／再表示callbackを渡しDocument変更を持たない。appは八／六portで生成・接続し、Geometry→Dimension→Shared準備後に既存dialogを表示する。設定画面の外観値反映／field準備は三種類の明確なfactoryへ分かれ、appはその生成・接続と開く順を担う。


CanvasExport.createRendererはPNG出力の一時描画frame（region／ratio／worldBounds）をprivate状態として所有する。現在viewportから同じ変換式でframeを設定→既存Geometry read cache内でdrawCanvas、復元時はframe解除→bitmap同期→通常drawを行う。frame getterは描画／各rendererの出力中判定・worldBounds・UI抑制に使い、appは一時設定へ直接代入しない。CanvasExport.create.captureの既存bitmap退避／try／finally復元順・例外伝播を維持する。PngExportCommand.createModeSessionは復元用previousModeだけをprivate状態として所有し、現在mode退避→png-export設定→pending置換、終了時はPNG pendingだけclear→現在modeがPNGなら復元→退避解除を行う。他のpending／mode・二回終了時等の既存挙動を維持し、mode自体／pendingは注入した既存所有者へ留める。appはrendererをviewport／cache／描画／bitmapの五port、mode sessionをread／set／pendingの三portで生成・接続し、capture／PNG commandと各表示照会へAPIを渡す。独自Viewport／モデル・履歴・出力codecや新しい復元規則を持たない。


CanvasSurface.createFrameRendererはbitmap準備・DPR／PNG frameによるtransform・viewport変換・共通描画→出力／対話描画の選択・stroke resetとsave／restoreの順序を担当する。10個の限定したportで既存CanvasSurface、CanvasExportの現在frame、zoom／描画計測、三つの描画段階へ接続する。Geometry／寸法／注記の選定・command previewとoverlayの内容は既存rendererとapp側の移行中の組立てに残る。read cacheと入力同期・profilingも既存入口に残す。出力時は対話描画を短絡し、描画例外時の既存の復元しない挙動も保ち、新しいtry／finallyやDocument／mode状態を追加しない。drawCanvasのhoisted入口を残して、先に登録されたcallbackと後に生成されるframe rendererの参照時点を維持する。


DimensionPreviewは現在のpendingをread-only getterで取得し、fillet半径仮表示、距離配置／入力の表示寸法・値・axis／angle・invalid／selecting／hiddenを構成して既存dimension／fillet描画へ渡す。13個の限定portで既存DimensionPlacement、式評価・表示形式・角度照会と描画へ接続し、入力確定・求解・履歴・session変更を持たない。readPendingはcall時の現在sessionを読み、元の評価catch、target／dimension参照、point-point axisのshallow copy、短絡と呼出順を維持する。appは生成・接続と先に登録されたstage用のhoisted入口を持つ。


DimensionPresentationは通常寸法の表示対象／情報取得と矩形選択用の表示boundsを扱う。createLayerは19portで現在表示scope、可視性／外観／配置／ラベル、Selectionとhover／drag／pending／PNG／statusのread入口、既存寸法rendererへ接続する。createSelectionBoundsは12portでactive／visible短絡と配置／Text metricsを使い、回転・複数行・式記号を含む表示boundsを返す。モデル編集／求解／履歴を持たず、式表示マーク・PNG時の強調抑制・描画順・save／restoreと例外伝播は既存処理を維持する。矩形選択の採否とSelection更新は既存RectangleSelectionQuery／CanvasSelectionに残す。


GeometryAppearanceQuery.createAnnotationはDocumentと現在Sketch一覧の2portからLeader／Annotationの実効外観を照会する。通常Textの短絡、Block definition／localElement参照、外観継承とprecision／prefix／suffix、順序付きBlock overrideを維持し、保存styleへ代入しない。AnnotationRenderer.createColorは実効style／PNG／Selection／Hover／themeの5portで出力→選択／inspection→Hover→通常色の優先を扱い、createLayerは一覧／可視性／Leader・Text描画の5portで現在対象を巡回する。状態の複製・変更、求解や履歴は持たず、appのhoisted入口は先に登録されたcallbackの参照時点を維持する。


GeometryPresentation.createLineDisplayはviewport／実効外観／画面単位の延長量の3portからConstruction線分を表示用に延長する。短小線／非正・非有限延長量／overhang無効時の元point参照、explicit外観とcall時倍率を維持し、モデル端点を変更しない。GeometryRenderer.createLayerはrenderer／可視性／Sketch描画順／4種類の現在Geometry一覧の7portを持ち、明示itemsはvisible filter、既定itemsは現在一覧→既存描画順で処理する。空array・null／undefinedとoptions、painter receiver／元の戻り値・順序を維持し、appのhoisted入口はrenderer生成前のcallback登録を保持する。


InteractionOverlayRenderer.drawSelectionRectはSelectionRectangleが返すpreviewだけを受取り、crossing／enclosingの色・倍率に応じた線幅／破線・fill→strokeを描画する。preview不在の短絡と既存withCanvasStateによるCanvas状態の隔離を維持する。session進行・矩形範囲の生成／採否・Selection変更・pointer lifecycleは既存SelectionRectangleへ残し、rendererはsessionを参照／変更しない。


DimensionPresentation.createPainterは既存Layout／Metrics／Rendererと外観・現在Sketch・dimensionLayout入口・shaft係数の7portを接続し、直線／角度寸法の表示planを構成する。target／dimensionとlayoutの短絡、外観既定値の入口と評価順、RenderPlan／円弧延長／角度span・外側terminatorとshaftの変換・radius下限、既存rendererへ渡す参照／flags／呼出順を維持する。配置／計測の独自実装・モデルやsessionの変更は持たず、DimensionDisplayが生成接続し、appは既存callback用のhoisted描画入口を持つ。


AuthoringPreviewRenderer.createLayerは現在mode／pointer／trimとLine／Rectangle／Slot／Circular／Spline／Centerlineの既存command一時値、renderer・Centerline投影・Canvas寸法の12portに接続する。modeごとの短絡と現在値／元参照、Line→Centerline→Rectangle→Slot→Circle→Arc→ThreePointArc→Splineの判定／描画順を維持し、trimはBlock／Instance／Offsetの後に別入口で描く。モデル／sessionの更新を持たず、Centerline support不成立時の短絡とpointer不在時の投影省略も維持する。appは描画stageと診断入口を直接接続し、各preview guardと不要な中継関数を除く。


PlacementPreviewRenderer.createLayerはrenderer／mode・pointer read／Block・Instance command／Block projectionの6portに接続し、Block配置のmode→definition→pointer→preview短絡とbundle生成・描画、Instanceのmodeに依存しない現在preview描画を扱う。OffsetPreviewRenderer.createLayerはrenderer／mode・pointer read／Offset commandの4portでmode短絡後に既存planを取得して描く。query／painterのreceiverと参照、null previewと呼出順を維持し、モデル／session更新は持たない。appは通常描画と生成後の診断入口を直接接続する。


CanvasRefreshはCanvas表示更新の調整を10portで既存PNG command／pending・mode照会、CommandPanel／DerivedPanel、Annotation入力同期、profiling／Geometry read cache／Canvas描画へ接続する。panel選択対象の表示snapshotをprivate状態として所有し、取消→panel→入力→snapshot→profile／cache→描画の順を維持する。PNG busy／session／mode短絡とreceiver、snapshot代入前の失敗時は旧値保持、描画失敗の既存例外伝播とprofile／cacheのcleanup範囲を維持する。モデル／session／各commandを複製せず、snapshot getterは既存Geometry強調の入口へ接続する。appは生成接続と早期登録callback用のhoisted draw入口を持つ。


GeometryPresentation.createCommandTargetsはpanel選択snapshot／現在mode／Instance・Sketch投影・pattern command、Geometry ref／同一性、現在拘束operand／commandとpending、参照Sketch照会の15portでcommand対象の表示強調を照会する。panel最優先とfalse時の短絡、Instance／投影／pattern→arc endpoint／operand、拘束command referenceTarget→pendingの優先・種類／Object同一性、reference hoverの短絡を維持する。状態の複製／Selection・sessionの更新／Canvas命令は持たず、appのhoisted入口は先に登録されたpaint callbackの参照時点を保持する。


GeometryPresentation.createSketchStyleはsolve error／Sketch ID・関係／拘束status／可視性／activeの6照会portから色・線幅・alpha・描画順を返す。選択→Hover→solve error→非active→拘束statusの色優先、各Sketch関係の線幅／alpha、visible filter→stable inactive／active順と元item参照を維持する。表示色定義はGeometryPresentationが持ち、寸法で共有する非active色はINACTIVE_CONSTRAINT_STATUS_COLORを参照する。Solver・Sketch・Selectionの状態は照会のみで、元arrayやモデルを変更せず、appは既存callback用hoisted入口と接続を持つ。


SketchProjectionQueries.createSourcesは現在model／active Sketch、Geometry ref・種類・key／同一性、既存投影拘束query／operational／Sketch・参照元／可視性、operand変換の13portでsource coverageと候補entryを照会する。Instance優先→従来拘束、Point constraintのObject同一性／string ID、他Geometryのkind／source key・target Sketch・operational条件と候補guard順を維持する。currentScope adapterは元model aliasをcall時に読み、既存拘束queryのscopeとcacheを変更しない。新cache／重複規則・モデル／session更新を持たず、appのhoisted入口は初期command callback登録を維持する。


SketchProjectionTestDriver.createLegacyTargetConstructionは従来の投影拘束fixture用にPoint／Line／Circle／Arc／Splineのtargetを作る。既存addPointToSketch／addLine／addCircle／addArc／addSplineの5portに委譲し、座標・Sketch／point kind・construction／closed・radius／angleとpoint生成→geometry生成順、元source無変更と例外時の既存部分割当を維持する。現在この入口はcompatibility／source-editingのテスト支援だけで使用され、test query有効時だけ組み立てる。製品commandやGeometryCreationのID／モデル編集の所有へは移さず、appはtest factory接続のみを持つ。


GeometryBounds.lineIntersectsRectはbboxによる短絡、endpointの矩形内判定、4辺とのsegment交差を扱う。旧appのcross-product／onSegmentの1e-9許容値、inclusive矩形境界とnear-corner・退化線・bbox gateをそのまま保持する。segmentsIntersectは同モジュールprivate helperとし、既存pointInRect／lineBBox／bboxIntersectsRectを直接使う。モデル／UI／sessionへの依存や変更は持たず、appは既存RectangleSelectionQueryへ静的入口を接続する。未使用のprivate selectCreatedSketchProjectionTargetsは全tracked JS／HTML・仕様とtest hookの呼出関係を確認して除去し、Selection更新は現在のcommand／CanvasSelectionに残す。


DocumentState.normalizeDimensionStateは明示scopeの拘束を既存target解決／dimension正規化の2入口で順に処理する。targetがない拘束の短絡、constraint／array参照とdimensionへの代入順・失敗時の既存部分反映を維持し、独自の配置／既定値／Solver規則を持たない。app adapterはcall時の元modelとDimensionPlacementへのreceiverを維持する。呼出／公開のない旧sketchSolveErrorTitle／dependentErrorSummaryは除去し、現在の結果表示は既存ConstraintFeedbackへ残す。


SolveRefreshCommandはactive Sketch／既存ParameterStabilization・ConstraintAnalysis／hint／UI／draw／Historyと履歴記録の8入口に接続し、求解後の操作を調整する。求解→分析→hint→UI(refreshAnalysis:false)→描画→成功かつ現在restoringではない場合だけhistory確定の順とraw result参照、default Sketch評価・引数、各段階の例外伝播／後続省略を維持する。新しい求解／snapshot／回復規則や状態を持たず、モデル回復は既存ParameterStabilizationへ残す。appは生成接続と既存callback用のhoisted入口を持つ。


InstanceProjection.createSourceSelectionは現在model／選択Geometry・CanvasSelection／Block・派生bundle／Sketch ID・active／refの8照会入口でInstance source候補を構成する。選択Geometry→model内Hatch→Block bundle→派生bundleの順、Blockのlocal kind explicit／派生のPoint source explicit、SetによるObject同一性の重複除去とactive／ref filterを維持する。元model aliasと現在selectionをcall時に読み、独自cacheやID重複規則・Selection／session変更を持たない。appのhoisted入口は早期Instance commandのcallback登録を維持する。


CanvasSelection.createScopeQueryは現在CanvasSelection／選択Geometryの2入口からcategory順・重複／元参照を維持したselectionItemsと、先頭itemのSketch→inspection→nullのselectionSketchIdを返す。CanvasSelectionInteraction.createIdentitySelectionはSelection／所属Sketch照会／clear／UI／drawを用いてidentity選択を行い、press準備にはSketch照会／guardも受け取る。Block→derived ownerの優先、additive時のSketch拒否／ID toggle、non-additive clear→kind判定→set、UI→drawと結果を維持し、identityを変更しない。照会と状態更新を分け、appは早期callback用のhoisted入口と生成接続を持つ。

CanvasSelectionInteraction.createIdentitySelectionはCanvas pressのselectInactive／prepareSelectionも所有する。現在のSelection所属とSketchのlockを操作時に読み、Ctrl／Shiftの別Sketch拒否→lock対象の選択とguard→inspectionの追加選択保持→inspection／Tree選択の解除という既存優先順を維持する。selectInactiveは選択の結果にかかわらずその後の最新lockを照会し、選択時の例外は後続guardを停止する。guard拒否でもprepareSelectionは処理済みを返す。PointerInteractionControllerは従来のmode／pending条件でこの入口を呼び、pointer capture・command routing・通常dragを引き続き担当する。appは同じSelectionとSketch照会・guardを明示して接続し、新たな選択stateや汎用contextは作らない。

- src/commands/sketch_command.js: createEditAccessは既存SketchContextの編集可否に基づく拒否通知、選択所属のguard、作図拒否のpreview cleanupを担当。権限規則とSelection／preview状態の所有は各既存moduleに残し、appは生成・接続を担当する。

- src/editing/geometry_hit_query.js: createScopePolicyは通常select／commandの状態とSketchの表示・所属・編集可否から共通hit対象範囲を照会する。8個のread portのみで接続し、Geometry／Instance／寸法／Hatch／画像／Annotationで使う判定をappが接続する。

- src/commands/drawing_order_command.js: Selectionからの重なり順候補／操作可否／最前面owner照会と、権限guard・順序変更・表示／履歴完了を担当。現在modelを含む11個の限定portを接続し、owner解決・順序補完・並べ替えはsrc/document/drawing_order.jsへ委譲する。

- src/editing/clipboard_payload.js: canOfferCopyはCanvasメニューで使うコピー／切り取り可否をmodelとSelectionから照会する。既存のObject同一参照とHatch境界選択の条件を維持し、payload生成・clipboard session・UI更新を行わない。

- src/ui/number_display.js: NumberDisplayはUI／Canvas共通の自動数値表示、通常／実測寸法labelとsuffix整形を担当する。丸め許容差と3つの純粋関数を所有し、モデル計算値・UI状態・寸法の固定桁外観を更新しない。

- src/commands/sketch_command.js: renameの編集guardとtoggleLockの状態更新／UI・描画・履歴を所有する。appは権限照会と専用の取消準備callbackを接続し、Sketch切替の全体resetとは別の順序を維持する。

- src/ui/command_panel.js: createRoutingはPNG／注記／Hatch／派生の表示先選択とイベント振分けを6依存で担当する。row選択・削除のoptional性とPNGを経由しない経路、receiver・引数・結果を維持し、appは個別panelとviewを接続する。

- src/editing/canvas_selection_interaction.js: createClearingはSelection・拘束operand・hoverの限定した参照・強調表示の解除を4 ownerのAPIで調整する。拘束command本体や他のhover参照・snapを保ち、UI／履歴／model更新は担当しない。

- src/commands/geometry_drag.js: GeometryDrag.createBlockEntryはBlock移動／回転の開始調整を七つの依存で担当する。clearSelection→同じInstanceを選択→block／block-rotation plan生成→既存GeometryDrag.beginの順で委譲する。開始拒否時は選択を保持し、回転lock／固定の既存hint→drawだけを行う。成功時は移動／回転hint→updateUI（refreshAnalysis:false）→draw。planがnullでも既存beginへ渡し、独自の編集権限や開始可否判定を追加しない。drag session・求解・完了／復元・履歴は既存GeometryDrag／plan／solverのownerに残す。

- src/commands/geometry_drag.js: createDerivedEntryは派生Instance全体と参照元Geometryのdrag plan／開始調整を14依存で担当する。参照元照会と通常session生成、既存GeometryDrag lifecycleを接続し、Selection／拒否通知・live anchor・pointer map／variableAllowedの既存境界を保持する。

- src/geometry/instance_projection.js: createDragSourceQueryは参照元Object収集とinverse pointer chainの解決を担当。3 read portのみで接続し、Object参照・探索順・巡回拒否・pointer複写とSketch投影flagを保つ。UI／Selection／drag状態や独自scope cacheを所有しない。

- src/commands/trim_command.js: TrimCommandは対象検証・Geometry変更の依頼・求解／依存結果の判定・checkpoint復元・成功履歴を18依存で調整する。TrimEditingと既存Geometry checkpointの所有を維持し、復元条件や例外伝播・UI順を変えない。

- src/ui/expression_input_view.js: createInsertionは識別子の挿入とinput／blur-change・focus／caretのDOM操作を2依存で担当する。native changeの重複と切断inputへの補完を避ける既存挙動を保持し、Parameterの名前解決・評価・適用は担当しない。

- src/ui/expression_input_controller.js: フォーカス式field／namespace照会とCanvasの寸法・注記からの参照入力を16依存で担当する。pickCanvasはCanvas範囲判定・座標変換・寸法優先のhit照会から既存挿入処理へ接続し、ParameterEditorは遅延callbackで利用する。名前補完とDOM挿入は既存service／viewへ委譲し、namespaceの同一参照・拒否条件と異なるevent／通知順を保持する。

- src/ui/constraint_feedback.js: localizedConstraintNameは拘束名の言語／typeOnly表示を担当。2つの言語／文言read portを使い、正規表現の優先順と未知名・固定端点のfallback、Modelのname／保存値を維持する。

- src/ui/authoring_feedback.js: Hatch／Offsetの診断codeからUI文言への変換を1つの文言read portで担当する。未知code／reasonの既存fallbackと言語の実行時反映を保ち、Geometry判定・model編集・DOM更新は持たない。

- src/parameters/application.js: createDeletionGuardはsymbol依存照会を使った削除可否と拒否通知を所有。5依存だけを受け取り、namespaceやmodelは保持・変更しない。各削除commandは共通guardを利用し、削除範囲とtransactionは従来のownerが担当する。

- src/editing/draw_operation_lifecycle.js: resetForDocumentはDocument初期化時のLine／Centerline／円弧／Spline／投影／Instance等の16個の下書き破棄を順序どおり調整する。既存依存のみを使い、pending／Hatch／Selection／Document内容は初期化側が引き続き担当する。通常のexit／cancelとは独立した範囲を維持する。

- src/editing/canvas_selection_interaction.js: createDocumentResetはDocument置換時のhover／highlight／pointer／snapと明示Selection fieldのresetを5依存で調整する。通常clear、早期Selection解除、pending／constraint session、Document／採番の初期化は統合せず既存の順序を維持する。

- src/editing/document_ids.js: 11個のDocument採番状態を所有し、生成・preview照会・予約・reset・checkpoint復元を集約。Block編集の番号予約とclipboardの8種類だけのrollbackを維持。GeometryIdsは基本形状、persistence/DocumentSequencesは読込時の復元計算に専念する。

- src/application/reference_image_input.js: 参照画像の準備／配置／Clipboard生成接続とfile input登録を担当。bindClipboard／bindControlsで起動順を保持し、disposeで自分のlistenerだけを解除する。画像変換はReferenceImageImport、現在scopeへの配置はReferenceImageCommand、Geometry／画像／text入力判定はImageClipboardへ委譲。appは明示portと従来の起動タイミングを接続する。

- src/application/parameter_editor.js: Parameter編集UIの組立て。draft、式入力表示／挿入、dialog View／Controllerと適用結果adapterを接続し、live scope選択肢と入力欄に応じたsymbol名を提供する。モデル適用・Canvas hit判定は外部portに残し、controllerと適用adapterの相互接続を内部で完結する。

- src/application/document_appearance_editor.js: Document既定外観設定の三組のcommand／Viewを生成接続し、Geometry→Dimension→Shared準備とdialog表示、開始buttonのlistener寿命を担当。既定値のread／writeと既存編集service・rows・通知を受け、外観変更とfield表示は既存ownerへ委譲する。

- src/application/png_export.js: PNG出力の機能組立て。CanvasExport／PngFile／PngExportCommandとmode session、開始拒否の順序、snap解決、fonts→現在画像準備、開始buttonのstart／disposeを接続する。appは既存renderer・可視画像準備・session／read portを提供し、Canvas入力／CommandPanelには同じcommand APIを渡す。Documentファイルcontrolsは独立した既存ownerに残す。

- src/application/document_file.js: Documentの状態表示／checkpoint・bookmark・file command・control／startup／beforeunloadの機能組立て。モデル適用・solve・履歴・viewportは限定した操作portへ委譲し、statusの履歴snapshot照会とunloadの実データ照会を保持する。choice dialogと修復案内は遅延callbackで接続し、初期化時には実行しない。

- src/testing/offset_test_driver.js: createSupportは単独Offset／UI／方向とchain関連の9factoryの生成接続と公開API対応を所有する。個別factoryの実装とexportは維持し、appはOffset専用の操作／型／照会portを一度接続してAPIを展開する。巨大なapp contextは受け取らず、通常起動時は呼ばれない。

- src/testing/sketch_projection_test_driver.js: createSupportはSketch投影テスト支援の生成接続と21公開APIの対応を所有。共通observation、旧形式target生成、選択と転送の内部リンクを同じdriver内で完結し、個別factoryの実装／exportと通常起動のtest query guardを維持する。

- src/testing/annotation_test_driver.js: createSupportはAnnotationの6factoryとdrag状態照会を生成接続し、7公開APIを準備／状態観測／入力照会の三群で返す。appは各群を元の位置へ展開するだけとし、公開順と共有snapshot／drag fixtureの接続を維持する。

- src/testing/dimension_test_driver.js: createDisplaySupportは表示計測に関する7factoryと8公開APIを生成接続し、表示観測とprecision／angle casesの二群を返す。現在Documentの既定外観を合成するgetterを内部で共有し、appは関連portと公開位置だけを接続する。編集・配置の支援とは分離した境界。

- src/testing/dimension_test_driver.js: createInteractionSupportは編集・配置に関する10factoryと複数寸法fitの生成接続・公開対応を所有する。placementとselectionの二群で12 APIを返し、現在scope・session・Selection・Viewportを既存portへ委譲する。表示テスト支援とは独立した依存で生成する。

- src/testing/dimension_test_driver.js: createFixtureSupportは残る読み取り専用寸法・補助線・角度ラベル・Sketch表示の5fixtureの生成接続を所有し、5公開APIを提供する。app側のDimension支援の生成はcreateFixtureSupport／createInteractionSupport／createDisplaySupportの三入口へ整理済み。

- src/testing/block_test_driver.js: createEditorSupportはBlock定義編集・階層操作・配置・再読込の11factoryと11公開APIを組み立てる。readDefinitionsからの定義数のlive照会を内部で共有し、appは操作／read portと公開位置を接続する。createObservationSupportは一般状態・操作位置・回転lock・投影端点・hoverの五つの観測factoryと五つの公開API対応を組み立てる。16個の明示portで既存ownerへ接続し、照会時の現在値を使い、独自の製品状態を保持しない。


- src/commands/annotation_drag.js: AnnotationDrag.createConstrainedは拘束付き注記dragの補助Geometry状態を所有し、begin／scope／additionalVariablesを公開する。通常時のscopeは現在scopeそのものを返し、drag中だけpoints／constraints配列を拡張したwrapperを返す。補助Point・拘束・変数のObject同一性を保持し、追加変数は既存どおり先頭二つを除く新しい配列で照会する。開始失敗で補助状態だけを解除し、終了時は解除→解析無効化→UI→drawを維持する。引出線は現在の表示倍率と実効anchorで保存座標へ変換する。appは後から生成するdrag plan／GeometryDrag／ConstraintAnalysisを遅延callbackで接続し、Solverは同ownerの照会APIを使う。保存モデルへの補助要素追加や新しいreset方針は導入しない。


- src/testing/properties_test_driver.js: PropertiesTestDriver.createAppearanceActionはSketch投影テスト操作が使う選択対象の外観変更を担当する。照会時のappearanceSelectionTargetとtarget.keyを使い、既存値とpatchをmergeして既存normalizerへ渡し、対象fieldを置換する。Block Instanceだけ投影cacheを無効化し、Properties更新→draw→履歴（Appearance変更）の順を保持する。対象なしはfalseで無変更、正規化例外は書込み前に伝播する。製品commandへ新しい操作を追加せず、test query guard内で生成し、SketchProjectionTestDriverの既存setter portへ接続する。通常起動・UIの外観編集経路には追加しない。


- src/parameters/stabilization.js: ParameterStabilization.createStoredDefinitionは保存済みBlock定義のParameter安定化に必要な編集scope切替を担当する。currentScope／activateScope／nextHatchIndex／drawableSketchIds／stabilizeNamespaceの五つの依存を受け、現在scopeを同じ参照で保持→定義へ切替→定義のactive Sketchと描画Sketch一覧で安定化する。評価中の成功・失敗結果・例外にかかわらずfinallyで定義のnextHatchIndexを現在採番と既存値（Number変換と1既定）の最大へ更新してから元scopeへ戻す。返値と例外はそのまま伝播する。別のscopeスタックや採番器は持たず、切替に伴う既存UI／Solver／cache更新はactivateScopeへ委譲する。


- src/application/basic_drawing_tools.js: BasicDrawingTools（src/application/basic_drawing_tools.js）はLine／Rectangle／Circle・Arc／Slotの機能組立てを担当する。既存LineCommand・RectangleCommand・CircularConstruction／CircularCommands・SlotConstruction／SlotCommandを生成し、geometry生成、snap拘束、Selection、preview、checkpointと通知を明示的なcapabilityとして接続する。四つのcommandは同じ参照を公開し、Lineのclickは元メソッド、他の五つの入力はsnap解決後のactive snapと同じ点を各commandへ渡す。各draft・reset・取消・求解・履歴は既存ownerのままで統一しない。Circular／Slotの生成が早まるが、生成時にモデル操作やscope／checkpoint照会を行わず、appのcheckpoint portは後続constを操作時に読むcallbackとする。SplineとCenterlineは独立したcreateSpline／createCenterline入口とし、Offset等の異なる開始・取消責務を無理に含めない。modeや新しいモデル／操作状態は所有しない。


- src/application/basic_drawing_tools.js: BasicDrawingTools.createSplineはSplineDraftとSplineCommandを独立して生成接続し、draftとcommandを同じ参照で公開する。下書きの点・rollbackはSplineDraft、作図先guard／開始／確定／ダブルクリックの判定はSplineCommandが所有する。投影入力reset・preview更新・作成Spline選択→select modeのadapterを組立て側へ集約する。draftをcommand生成時に生成し、scope／採番は操作時だけ照会する。後に生成するSpline編集と空白gestureのresetはappから遅延callbackで受け取る。描画とDrawOperationLifecycleは公開draftを共有し、resetとcancelを統一しない。


- src/application/basic_drawing_tools.js: BasicDrawingTools.createCenterlineはCenterlineGeometry・CenterlineConstruction・CenterlineCommandの生成接続を担当し、元のcommand参照を返す。planに平行許容差、constructionに現在scope／Geometry／採番・snap拘束・commit、commandにSelection／guard／snap／preview・modeと表示更新を明示接続する。snap adapterは解決後のactive snapを返す。preselection／対象・端点stateはcommand、support計算はGeometry、部分rollbackはConstructionが保持する。各ownerのbody・開始／拒否・取消・確定方針や履歴を変更せず、新しい状態機械を持たない。


- src/testing/geometry_drag_test_driver.js: GeometryDragTestDriver.createResponsiveFixtureはドラッグ応答検証用図面の生成を所有する。resetModelState後、既存addPoint／addLineで4点・4線を生成し、同じ参照を使う距離二つ・平行二つ・直交一つの拘束を既存push APIへ渡す。寸法既定値→solveAndRefresh（サンプル復元）→log→fit（padding160）→draw→fixture履歴初期化→serializeの順を保持し、serialization結果をそのまま返す。求解例外は後続fit・履歴初期化等へ進まず伝播する。生成値・ID・拘束計算は既存ownerへ委譲し、独自モデル／採番／solverは持たない。旧sampleModelは通常起動から撤去し、test query内だけでfixtureを生成する。


- src/ui/canvas_workspace_layout.js: CanvasWorkspaceLayout.showSelectedObjectPropertiesはパネル展開→既存Properties更新→現在のpanel再取得とscrollTop初期化→hintを担当する。bindControlsは現在workspace classを読むtoggle、bindWindowはcontext menu解除→現在world中心照会→resizeの登録寿命を所有する。起動位置を分けて維持し、二重登録を防止、disposeは自己listenerだけを解除して再bindできる。panel／toggle／workspace不在の既存短絡を保ち、展開できない場合もProperties更新とhintは従来どおり続ける。model・Selection・履歴を編集しない。


- src/ui/sketch_tree_controller.js: SketchTreeController.createMoveInputBindingはSketch移動先選択中のTree外入力抑止とdocument listener寿命を所有する。documentとisMovingの二つの依存を受け、pointerdown／click／dblclick／contextmenu／input／changeを同じ順でcapture:true登録する。各eventで現在の移動状態を照会し、非移動時はtargetを読まず短絡する。移動時は#sketchListまたは#sketchOverlayResizeHandle内を許可し、それ以外でpreventDefault→stopImmediatePropagationの順に抑止する。bindの重複を防ぎ、disposeは同じhandlerとcapture指定で自己listenerだけを解除して再bindできる。移動state／commit／cancelはSketchMoveCommand、Keyboardの受付は既存KeyboardInput／Controllerに残す。


- src/editing/draw_operation_lifecycle.js: DrawOperationLifecycle.resetInputsForSketchChangeはSketch切替時の作図下書きだけを解除する限定入口。Line→Rectangle→Fillet→Circle→Arc→preview→Offsetの順に既存resetを呼ぶ。Document reset／通常cancelとは別の対象であり、Slot／Centerline／Spline／Hatchや一時Geometry rollback、Selection・snap・mode・UI／hintはここで更新しない。途中の例外はそのまま伝播し、後続ownerへ進まない。app側のSketch切替調整は、drag／Selection解除とpending／constraint／instance／pointer／mode更新の間で同入口を呼び、既存順を維持する。追加の依存や独自draftは持たない。


- src/commands/sketch_command.js: SketchCommand.createInteractionResetはSketch切替時の操作状態解除を担当する。Sketch移動reset→Selection解除→Geometry／Dimension drag→画像／矩形選択→作図下書き→pending／拘束command→投影／Instance sources→hoverのsketchIdentity→pointer→値入力→snap→select mode→Toolbarの順で限定APIを呼ぶ。後で生成するdragとnullableな移動commandはcallbackで操作時に参照する。hoverは他fieldを保持し、例外は同じ段階で伝播して後続resetを強制しない。Document初期化や通常cancelとは別の処理とし、独自操作stateやsnapshot／履歴／回復を持たない。appは履歴復元等から渡すhoisted入口を残して生成接続する。


- src/commands/constraint_commit_command.js: ConstraintCommitCommand.fromSelectionは選択解決結果の適用入口を担当する。注入したresolveSelectionへtypeを渡し、結果なしは無処理、errorありは既存hintだけで終了する。place-dimension actionまたはtargetありは同じresolutionとnull pointerを既存startDistanceResolutionへ渡し、その戻り値を透過する。通常constraintありはarcEndpointPairを解除して同じresolutionを既存resolution確定へ渡し、確定結果は返さず従来どおりundefinedとする。新しいguard／求解／履歴規則を追加せず、選択解決はConstraintSelectionQuery、配置は既存Dimension command、通常／参照確定とguardは既存commit処理が所有する。appはToolbar／対象選択から共有するhoisted addConstraint入口を同APIへ接続する。


- src/commands/dimension_drag.js: DimensionDrag.createAngleSynchronizationは寸法drag後のLineAngleConstraintと配置の同期を担当する。LineAngleConstraint型・target.kind===angle・dimensionありを順に確認し、既存isReadOnlyDimensionでreadonlyなら変更せず終了する。angleDimensionAngles(target,null,dimension)を呼んだ後、現在のangleStartFlip／angleEndFlipを1／0へ反映し、targetへsigned角度の絶対値を設定する。表示角度の計算は既存APIへ委譲し、角度計算の例外はfield更新前に伝播する。三つの依存だけを受けてsyncを公開し、drag state・求解・履歴は持たない。DimensionDragの各配置更新は同じsync callbackを共有する。


- src/editing/geometry_creation.js: GeometryCreation.createEndpointResolverは既存端点の再利用とendpoint Point生成の振分けを担当する。hitEndpointPoint→hitExplicitPoint→addPointの三つの依存を明示し、端点hitなら同じObjectを返して後続照会／採番を行わない。explicit Point hitではその現在座標でaddPoint(x,y,false,endpoint)を呼び、元Pointを変更せず現在Sketch／scopeへ新しいendpointを追加する。両hitがない場合は入力座標で同じaddPoint引数を使う。hitの選択／可視性規則は既存GeometryHitQuery、採番／所属付与は既存GeometryCreationに残す。appは後で生成されるhit照会を遅延callbackで接続する。


- app.js: 構文scopeの参照監査で未使用と確認した旧入口16個を撤去。Sketch階層／Instance参照／求解／Block完了／作図解除／寸法描画・配置／拘束適用は既存ownerを継続利用し、旧selectHitOnly等の重複経路を残さない。公開hook・現役接続・副作用を持つfactory初期化は維持する。


- app.js: 静的namespaceから受け取る未使用alias58個を撤去。Hatch領域engineへの直接destructureも廃止した。各既存ownerの依存・公開API・script読込順・factory生成は維持し、appの静的依存一覧を実際の利用へ合わせる。


- src/editing/selection.js: CanvasSelection.applyOffsetSelectionがOffset source／entriesの選択反映と限定した選択解除を所有する。OffsetSelectionはチェーン状態と通知、OffsetCommandは操作進行を所有し、appのsyncOffsetChainSelectionは既存二経路を同APIへ接続する。Geometryの参照・未解除の選択・空反映時のTree規則を維持する。


- src/geometry/appearance_query.js: GeometryAppearanceQuery.createDimensionがeffectiveDimensionAppearance／effectiveDimensionAppearanceForSketch／dimensionDisplayStateを所有する。Document既定と終端既定の合成、現在または明示Sketchの外観、個別displayの優先順とRoot除外を維持する。appはUI・label・テスト支援へのhoisted入口を接続し、初期化時に現在scopeを読み出さない。


- src/rendering/dimension_presentation.js: DimensionPresentation.createLabelが寸法labelの文字列構成を所有する。数値formatはNumberDisplay、外観はGeometryAppearanceQuery、測定／readonlyと角度値はDimensionQueriesの既存APIへ委譲。appは既存hoisted入口を描画・hit・観測へ接続し、参照寸法／角度interval／桁数／公差の規則を重複実装しない。


- src/rendering/annotation_renderer.js: annotationPlacementAnchorが表示位置の読取りを所有する。src/commands/annotation_anchor_constraints.js: createMaterializationが座標の具体化と既存条件に応じたAnnotation更新を所有する。appは同じ入口を拘束／寸法／drag／Properties／snapへ接続し、capture・既存anchor保持・leaderの倍率逆変換の規則を重複実装しない。


- src/geometry/geometry_kernel.js: arcEndpointDragValueが端点角の周回合わせとalmost-full-circleのsigned sweep制限を所有する。app内の同計算本体は撤去し、既存GeometryDragEditingの注入先へ同APIを接続する。開始／終了角の基準・符号・上限・非破壊性を維持する。


- src/commands/constraint_commit_command.js: ifMissingが作図時の重複回避・参照guard／属性付与・追加後冗長判定／除去を所有する。currentScopeとforgetConstraintのみ依存を追加し、既存の明示確定APIは変更しない。appはSnapConstraints／BasicDrawingToolsの既存入口を接続し、求解・UI・履歴の異なる暗黙追加と明示確定を混同しない。


- src/ui/toolbar_view.js: createCommandStatusが操作名ステータスの翻訳とDOM反映を所有する。mode／pending／constraintはappからの限定した読取りAPIで参照し、注記→拘束→mode→raw値の優先順と短絡を維持する。appのupdateStatusUIは接続だけを担う。


- src/ui/toolbar_view.js: createIconsがtoolbarSvgMarkup／constraintToolbarIconを所有する。TreeとCanvas候補の共用表示APIとして、現在DOMのSVG取得・既存class付与・欠損fallback・型優先と名前patternを維持。appは同APIをSketchTreeObjects／CanvasContextPresentationへ接続し、操作・選択・hover状態を同factoryへ渡さない。


- src/editing/selection.js: sketchTreeObjectSelectedがinspectionのcategory／Object／ID照合と、通常のカテゴリ別選択照会を所有する。固定Point・Constraint・Geometryは同ownerの既存判定を使用。app内の選択配列読取りを撤去し、SketchTreeObjectsへ同メソッドを接続する。hoverは引き続き別所有者。


- src/ui/sketch_tree_objects.js: Tree行のhover判定を同module内へ集約。readCanvasHover／readSidebarHoverの限定APIで現在値を読み、カテゴリ別のObject同一性と固定Point／Constraint解決を維持する。CanvasHover／SelectionHighlightの状態所有と既存hovered公開APIは維持し、appの照会本体を撤去。


- src/rendering/canvas_surface.js: createInteractiveRendererが通常Canvasの18段階の重ね描きを所有し、createFrameRendererのPNG分岐とは分ける。src/rendering/annotation_renderer.js: layer.drawPreviewが現在previewの取得とleader／textの描画振分けを所有。appは既存描画器と描画用callbackだけを接続し、model／操作contextやpreview stateを複製しない。


- src/application/offset_feature.js: Offsetの計算／生成／command／previewの機能組立て。OffsetSelection・pending・選択・preview・Geometry生成と採番は既存所有者を共有し、plans／command／previewLayer／createGeometry／chainDraftを公開する。appは同featureの生成・接続を行い、早期のOffsetSelection通知入口と他機能の共有Geometry／snapを維持する。


- src/application/fillet_feature.js: Filletの計算／生成／transactional commandの組立て。Geometry、選択、pending、値入力、checkpointは既存ownerを共有し、実FilletCommandをそのまま返す。appはcheckpoint生成後に同featureを作り、更新／確定／click／resetを既存利用者へ接続する。

- src/application/trim_feature.js: Trimの照会・編集・commandの組立て。現在scope／倍率、共有Geometry／preview／checkpointと既存の権限・求解・UI通知を接続し、computePreview／executeを公開する。src/testing/trim_test_driver.jsのcreateFeatureが同じquery／editingから既存fixtureを組み立て、appから内部API列挙を取り除く。

- src/testing/constraint_test_driver.js: createStatusObservationは解析更新後の現在Sketchを照会ごとに一度取得し、同じSketchで全statusを絞り込む。照会間の状態交換を維持し、返却用itemsは独立させる。

- src/editing/sketch_context.js: membershipQueryが正規化と所属の読取りを分ける。同じ所属resolverを共有し、現在Sketchへのfallbackを同期照会単位で捕捉する。src/constraints/constraint_analysis.jsは参照更新後、src/testing/constraint_test_driver.jsは解析更新後に取得し、appはreadSketchMembershipを両者へ接続する。Queryをscope切替後まで保存しない。

- src/rendering/dimension_presentation.js: createLayer.drawはその描画内だけActive判定を共有し、sort comparatorと非active色判定でのSketch照会の重複を減らす。次の描画へ判定を保持せず、既存配列と安定した描画順を維持する。


### Sketch投影の操作組立て

SketchProjectionFeature（src/application/sketch_projection_feature.js）は投影操作のsource queryとSketchProjectionCommandの生成・接続、矩形候補の取得、旧投影拘束による形状編集の拒否を担当する。draft・開始／確定／取消は既存command、投影の所属・coverageは既存queryが引き続き所有する。共有SketchProjectionQueriesと読込時のSketchProjectionEditingは別に生成し、同じqueryを渡す。source queryの生成はcommandと同時へ移したが、factoryはscope／operand／矩形を読まない。後段で初期化するoperand変換とRectangleSelectionQueryは操作時に委譲し、現在modelとactive Sketchを使う。編集guardはSketch権限の短絡、共有nodeの指定、稼働中の旧拘束だけを拒否する順序と既存文言を維持する。新たなmodel、cache、session、保存形式は導入しない。


### Geometryドラッグの機能組立て

GeometryDragFeature（src/application/geometry_drag_feature.js）はGeometryDragSolver／GeometryDragPlan／GeometryDragEditing／GeometryDragと派生Instance用entryの生成・接続を担当する。数値進行はsolverのsession別WeakMap、入力sessionと確定／復元／履歴はcommand、準備snapshotとpreview／finishはeditingが引き続き所有する。appはcommandとbuild／prepare／preview／finish／beginDerived／targetConstraintCountの狭い入口を利用し、内部solverやplanのinstanceを再配線しない。Annotation／Block／テスト支援も同じ入口を使う。preview／finishは操作時のprofileSolveで包み、active時だけsolve計測し、返り値と例外を透過する。Canvas pointerの開始終了と現在scope／倍率は注入し、生成時に実行しない。初期化順、可視移動の閾値、投影編集拒否、失敗時の復元優先順、onEndとhistory、求解アルゴリズム・許容誤差・保存形式を変更しない。


### 寸法外観の解決と描画への受渡し

DimensionPresentationのlayer／Selection boundsが解決済みの寸法外観をlabel／painterへ渡す。可視性・ラベル・線形／角度描画の同一寸法の解決を重複せず、次のdrawやscope／Sketch／Document外観の変更では新しく取得する。frameをまたぐcacheやmodel状態は追加しない。GeometryAppearanceQuery.dimensionDisplayStateForAppearanceは既存の表示値整形を純粋な変換として共有し、従来のdimensionDisplayStateも同じ変換を使う。単独label／painter／preview呼出しは外観引数がなければ従来どおり解決する。可視性の短絡、描画順、PNG flags、Canvas保存復元、precision／改行affix／公差、既定Sketch評価の順序と返り値、保存形式は維持する。


### 通常表示と選択表示の更新進行

ApplicationRefresh（src/application/application_refresh.js）は通常UI更新とGeometry選択更新の進行、Sketch／Properties更新のprofile境界を所有する。通常更新はAnnotation resize選択の同期→現在Parameter名前空間の準備→指定時のみ拘束解析→Document名／Toolbar／Sketch／Block／Properties→移動中Propertiesのinert→Status／拘束button／翻訳／寸法入力の順序を維持する。選択更新は名前空間や解析を準備せず、Toolbar／拘束button、開いているBlock dialog、Tree選択class、Propertiesだけを従来順に更新する。profileのui／tree／propertiesの包含と例外の停止位置を維持し、新しいmodel／cache／session／resetを持たない。appのhoisted入口はこのAPIへ委譲し、後段のview／AnnotationDrag／入力controllerは生成時に読まず操作時のcallbackで接続する。


### Geometry readサービスの生成・接続

GeometryReadServices（src/application/geometry_read_services.js）はBlockCatalog／InstanceProjection／BlockProjection／GeometryReadModelとGeometry・Dimension・AnnotationのAppearance queryの生成・接続を所有する。既存ownerを返す固定containerだけを公開し、modelやcacheを複製しない。Block投影cacheはBlockProjection、同期read窓と外観memoはGeometryReadModelが引き続き所有し、scope切替でappが従来のclearReadCache／invalidateBlockProjectionCacheを呼ぶ。Geometryはworkspace.current、Dimension／AnnotationのSketch一覧は従来model aliasを読むcurrentSketches、Block registryはDocumentを操作時に参照する。Hatchの解決とprimitive照会は既存HatchGeometryQueryを注入し、空間照会・Annotation描画・入力状態は取り込まない。factoryを早めてもscope／registry／view／profileを生成時に読まず、後段依存はcallbackのまま保持する。既存GeometryのObject同一性、投影IDと参照、入れ子read窓、scope／定義差替えの無効化、外観継承と非表示要素の一時表示、保存形式を維持する。


### Block下書き・Session・照会の生成・接続

BlockEditingFeature（src/application/block_editing_feature.js）はBlockDefinitionEditing／BlockEditorSession／BlockEditingQueriesを同じcatalog・投影・Instance・constraint rebinding・ID ownerへ接続する。編集Geometryと下書きの変換は既存editing、入れ子Sessionとrollbackは既存Sessionが所有し、queryはその同じSessionを参照する。host捕捉はworkspace.captureの後にviewport.snapshot、復元はworkspace.restore→既存activateEditingScope→viewport.updateの順で接続する。activateEditingScopeが行うmodel alias／Solverの切替とread cache無効化はappの既存入口に残す。viewportは後段生成のため操作時getterで受け、Document IDのpeek／allocate、現在scope／registry、historyも生成時に実行しない。採番・revision・元GeometryのObject同一性・共有点／拘束参照・入れ子の独立履歴・既存の取消と例外の復元範囲、保存形式を維持し、共有ConstraintRebindingやmodel切替の所有を変更しない。


### Block開始・取消・確定の組立て

BlockEditingFeature.createCommandsは生成済みediting／Session／queryを共有してBlockDefinitionCommandとBlockCompletionCommandを接続する。早期のmodel側生成と、choiceDialog準備後のcommand生成を分け、後段BlockViewはcallbackのまま利用する。host捕捉とID ownerを共有し、開始／取消／rename／deleteと検証／確認／確定は元のcommandに所有させる。確定のhost復帰は同じDefinitionCommand.restoreHostへ接続し、Session復帰後のEditor表示も維持する。選択範囲query、確認dialogと多重要求抑制、取消・別Sessionへの切替後の古い応答無視、scope復帰／定義反映／求解／履歴の順と既存復元範囲を変更しない。各commandは一度だけappから生成し、追加Sessionやmodelを作らない。


### Properties表示の生成・接続

PropertiesDisplay（src/application/properties_display.js）はPropertyRows／PropertyPresentation／PropertiesContent／PropertiesViewの生成・接続を所有する。選択共通値は既存PropertySelection、Geometry／Dimension／Annotation外観・投影・registryは既存read ownerを使い、モデルを編集しない。PropertiesControllerのinput／change／clickは元の関数をそのままViewへ渡し、編集commandの所有とDOM eventのreceiverを変えない。共有AppearanceControlsはpaletteとDocument設定にも使うため外で生成して受け取る。sectionの開閉状態とDOM lifecycleは同じPropertiesView instanceに残し、Contentのsection callbackはView生成後のrender時に解決する。対象や外観の変更、HTML escape、混在値、read-only control、式highlight・affix入力の準備、表示／保存仕様を維持する。

### Properties編集の生成・接続

PropertyEditingFeature（src/application/property_editing_feature.js）はGeometryPropertyCommand／AppearanceEditing／AppearancePropertyCommand／BulkPropertyCommand／SelectionVisibilityCommand／ElementPropertyCommandの生成・接続を所有する。外観の値変換は単一のAppearanceEditing、複数編集と可視性変更は同一のAppearancePropertyCommandを共有する。選択対象と権限の照会は注入し、DOM・Selection・checkpointを所有しない。現在scopeは操作時に取得し、snapshot／復元／Parameter安定化／投影metadata同期／cache無効化と履歴・通知は既存commandの順序と範囲を維持する。Toolbarの可視性変更、PropertiesController、palette、Document外観設定には既存と同じ編集入口を公開する。ElementPropertyCommandは同じanchor具体化処理を使い、生成時にモデルやDOMを読まない。


### 寸法ドラッグの生成・接続

DimensionDragFeature（src/application/dimension_drag_feature.js）は同じDimensionPlacementからDimensionLineGroup、選択group照会、角度同期とDimensionDragを生成・接続する。DimensionLineGroup.createは純粋な配置snapshot・移動・整列を保持し、createSelectionは現在scopeへのObject参照による所属、Sketchの編集／可視性、targetの解決と実効寸法外観の可視性を確認してからgroupを返す。選択配列とモデルは照会で変更せず、scope置換や外観変更は呼出しごとに反映する。dragとcontext整列・menu可否・入力振分けは同じ選択group入口を共有する。ドラッグsession、3pxの継続command click判定、display／label offset保持、pointer開始／終了、通知と一回の履歴は既存DimensionDragの順序・範囲を維持する。角度同期は同じDimensionQueriesとreadOnly規則を使い、新しい状態・cache・Solver・保存形式は追加しない。


### 寸法表示の生成・接続

DimensionDisplay（src/application/dimension_display.js）は同じctx／viewportでDimensionMetrics、DimensionPlacement、DimensionLayout、DimensionRendererとDimensionPresentationのPainterを生成・接続する。metrics／placement／layoutsは入力・drag・hit・Annotation・テスト支援にも同じObjectを公開し、rendererは内部のPainterへ接続する。layoutは外観が省略された場合だけ既存effectiveDimensionAppearanceへ委譲し、解決済み外観はPainter・Layoutへそのまま渡す。現在のlinesは照会時に取得し、scope置換を反映する。theme補正とCanvasRenderProbeの式マークcallbackは既存入口を共有する。生成時にはCanvas・scope・外観を読まない。既存metricsのcacheは単一ownerに維持し、描画間の外観cache、モデル編集、入力Controllerの所有は追加しない。


DimensionDisplay.createTraversalは生成済みの同じplacement／metrics／layout／PainterへDimensionPresentationのSelection boundsとLayerを接続する。表示用scope、Sketch可視性／active判定、label、hover／drag／pending／export／statusのread portは後段の組立て時に受け、生成時に評価しない。appのdimensionPresentationScopeをそのままLayerへ渡し、通常寸法とAnnotationの表示寸法を含む配列のsort・Object同一性・一回の外観解決を維持する。boundsは同じ外観・label・文字計測を使い、LayerはPainterへ解決済み外観と既存flagsを渡す。Model／Selection／入力の変更は追加せず、PNG時のhighlight／editing／status色／式mark抑制は既存Layerに維持する。


### 注記表示の生成・接続

AnnotationDisplay（src/application/annotation_display.js）はAnnotationRendererのColor／本体／Layerの生成・接続と、選択・inspection・hover・PNGに応じたframe／resize／Leader終端handleの表示条件を所有する。全て同じCanvasSelectionとhover／export reader、実効外観、rendererのlayout・Leader geometryを使い、状態を複製しない。現在のresize可否とcommand previewは遅延callbackで受け取り、後段のdrag／commandを生成時に読まない。アンカー表示位置は既存AnnotationAnchorConstraints.resolveと同じGeometry参照解決へ委譲し、materialization・拘束編集・採番・履歴を持たない。色の優先順位、保存frameのexport表示、投影／編集不可のresize拒否、active Sketch・anchorによるLeader handle抑制、previewの可視性とstart座標の扱いを維持する。appには共用geometry／描画入口と編集側の接続を残す。


### Document編集状態の初期化

DocumentEditingReset（src/application/document_editing_reset.js）は新規Document／読込に共通する編集初期化の順序を調整する。Sketch移動reset→Document scope復帰→保留pointer破棄→select modeと性能記録解除→DocumentState.clearContent→描画／解析cacheとSelection・操作sessionのreset→採番とBlock編集のreset→DocumentState.resetDefaults→Hatch／Tree／Annotation／画像操作のresetを既存順で実行する。各stateの所有は既存component、Documentの配列・既定値の更新はDocumentStateに維持する。画像操作の前後二回のreset、activateEditingScope内部のresetとcache更新を省略せず、例外時はその位置から伝播して後続を実行しない。新たなcancel・rollback・history・drawは追加しない。後段のGeometry／Dimension drag等を早期に捕捉しないよう、appは全owner生成後・test hooksと起動resetの前に組み立て、既存hoisted入口を委譲として維持する。


### 読込codecの生成・接続

DocumentLoading.createWithCodecsは既存のGeometryInstancePersistence／BlockDefinitionPersistence／BlockConnectionsPersistence／DocumentGeometryPersistenceを構成して同じcreateのdecode／installへ接続する。BlockとDocumentの接続・Parameter準備portを共有し、単一のInstance codecのlistError／normalize／migrateLegacyを直接渡す。読込では各namespaceのSketch正規化関数とindexを明示し、appのactive Sketch fallbackを経由しない。返すgeometryInstancesは他機能の明示的なnormalizerにも同じObjectを供給し、app側の通常編集用fallbackは維持する。codec注入用のcreateも維持する。生成時にモデル／projectionを読まず、現在DocumentのresetはDocumentApplicationが候補検証成功後に行い、codecと互換性・installの配列／Object同一性とcache無効化順は変更しない。


### Sketch外観の正規化コピー

SketchHierarchy.copyWithNormalizedAppearanceはSketchをshallow copyし、appearance／constructionAppearance／dimensionAppearance／leaderAppearanceだけを既存Appearanceの正規化で独立したObjectにする。未知fieldと外観以外のObject参照、ID・名前・親・kind・visible・lockedはそのまま保持し、元Sketchを変更しない。空値は継承用の空外観を返す従来規則を維持し、階層修復・既定ID・描画Sketchの補完や読込版の移行を行わない。BlockDefinitionEditingのclone／applyとBlockEditorSessionの同期、BlockHistorySnapshotのclone経由で同じ入口を共有する。appは同じ関数を既存featureへ渡すだけとし、新しいUI・採番・履歴・stateは追加しない。


### 拘束確定の性能traceの所有

ConstraintCommitCommandは通常確定の最後の性能traceを非公開stateとして保持し、readPerformanceで同じObjectを返す。analysis・UI／draw・hint／log・履歴とtotalMs計測の後にだけ更新し、既存recordPerformance observerがあれば同じtraceを通知する。権限拒否・scope拒否・求解／退化／重複拒否、参照寸法登録や公開前の例外では以前のtraceを維持する。clearPerformanceはnullへ戻すだけでobserver・時計・UI・履歴を呼ばない。appは性能用変数を保持せず、DocumentEditingResetとCanvasTestDriverへ同じcommandのclear／readを直接接続する。計測field・時機・時計呼出し数・性能基準は変更しない。


### 注記コピーの表示値変換

ClipboardTransfer.detachedAnnotationは、参照を外すコピーの現在表示anchorとLeader形状を独立した保存値へ変換する。既存AnnotationDataのserializeを用い、layoutがなければ文字metricsへfallbackし、明示anchorPositionを優先する。Leaderは解決済みstart・表示elbow／endを複製してtextPlacementをanchorとし、現在の外観とviewport倍率からshelfReferenceScaleを計算する。layout・metrics・Leader形状／anchor・外観・倍率は狭い読取り依存として注入し、生成時には読まない。元のAnnotation・表示geometry・Selection・sessionを変更しない。参照先の同時選択判定とanchorConstraints／geometryRef／attachmentの除去はClipboardPayloadが引き続き所有し、同時コピーできる参照は通常serialize経路で保持する。appはTransferをPayloadより先に生成して同じ関数を接続する。


### 共有外観UIの組立て

AppearanceUI（src/application/appearance_ui.js）はPropertiesとDocument設定が共用する外観UIの生成・接続を担当する。AppearanceControlsとAppearancePaletteを一つずつ生成し、既存PropertySelectionの対象・共通値と、同じAppearanceEditing／AppearancePropertyCommand／複数編集APIをPaletteへ接続する。公開するのはcontrols・openPalette・startであり、Palette session・編集値・Selectionの別stateは持たない。DOM・現在scope・選択対象・既定値・倍率を生成時に読み取らず、操作時の既存readerを維持する。startはアプリ起動時に一度呼び、同じcontrols／editingをDocumentAppearanceEditorへ渡して生成し、Document設定start→Palette.bindの順で登録する。Documentの既定値は固定Document ownerの最新fieldを読み書きし、使用中色は現在編集scopeから収集する。PropertiesController／PropertiesDisplayとDocument設定は同じPalette入口／controlsを共有し、各View・command・Paletteの実処理と状態の所有は変えない。


### PropertiesのControllerとViewの接続

PropertiesDisplay.createWithControllerは注入されたPropertyEditingFeatureの同じgeometry／appearance／element／applyMultipleをPropertiesControllerへ接続し、同じPropertySelectionのselectedDisplayTargetと既存AppearanceUIのcontrols／openPaletteをControllerとViewで共有する。Controllerを生成して既存createでViewを構築し、戻り値は同じView APIとする。個別command・Controller・Paletteの別stateやDOMを作らない。選択は操作時に読み、権限／lock・構造guard、preview／commit、拒否時の更新、actionの戻り値とPaletteの振分けは既存Controllerに委譲する。外部から必要な編集actionは明示portとして接続し、自由に探索できるapp contextや汎用service locatorは渡さない。従来のcreateはControllerとcontrolsを注入する表示専用APIとして維持する。


### Canvas context interactionの組立て

CanvasContextInteraction（src/application/canvas_context_interaction.js）はSelection／Fix照会・項目構成・候補確定・Entry・Actionsの六つの既存componentを生成・接続し、open／selectCandidate／execute／previewを公開する。項目とEntry／候補確定は同じTarget selectionを使い、Fix表示は同じCanvasSelectionから操作時に照会する。previewは既存CanvasHoverへ通知して描画するだけとし、hover snapshotと復元・候補一覧／DOM／focusは既存CanvasContextMenuが所有する。候補空間照会と候補presenterはappが独立して生成し、test supportにも同じpresenterを接続する。独自のmenu／Selection／command stateは持たず、既存componentのguard・順序・戻り値・同一参照を変更しない。外部の選択・command・UI操作依存64項目を明示し、任意のapp contextやservice locatorで隠さない。appは後段でInteractionを生成してから既存controllerをstartし、早いcallbackはhoisted委譲関数から操作時に参照する。closeAppMenusとpointer書込みも従来どおり操作時のadapterを維持する。


### 拘束・寸法配置の開始準備

DrawOperationLifecycle.prepareDimensionStartは選択mode→Line→Rectangle→Fillet→Circle→Arc→previewの順で既存commandをresetする。prepareConstraintStartはPending取消（空message）→Centerline→Slotを先行して同じ準備へ進む。両者はsnap・Selection・他draft・UI・履歴を追加操作せず、reset例外があればその場で伝播して後続に進まない。prepareConstraintCancelはCenterline／Slotの各判定直前に現在modeを個別に読み、該当commandだけをresetする。mode変数やdraftは新たに所有せず、既存selectMode／readModeと同じcommand実体へ接続する。

DimensionPlacementCommand.startInstanceAngleDimensionは対象Sketchの既存編集guard→配置中判定→circular kind判定で拒否し、拒否時は取消も行わずfalseを返す。受入時はPending取消→拘束command取消→selectMode→現在bundleのanchor取得→InstanceAngleIntervalConstraint生成→target／既定pointer→distance-placeのPending置換→案内／toolbar／drawの順でtrueを返す。通常寸法のprepareStartは呼ばず、Line等の一律resetを追加しない。anchor・instance・target・pointerの参照、現在angleStep、例外時の途中効果と停止位置を維持し、求解・履歴・保存形式は変更しない。


### Geometry削除時の操作終了

GeometryDeletionCommandは削除を受け入れた後、実削除前の操作終了手順も所有する。Geometry drag→Dimension drag→Annotation dragのreset、PendingCommandSession.clear、ConstraintTargetSession.clearCommand、Line.reset、Circle／Arc reset、preview.setPointer(null)、selectModeの順に既存ownerへ依頼する。Pendingのcancelや拘束session.reset、preview.resetへ置き換えず、operand配列とtrim preview、Rectangle／Slot／Centerline等の非対象draftを保持する。拒否・空planでは開始せず、途中例外は伝播して後続reset・削除適用・求解・履歴へ進まない。三種類のdragは削除commandより後で構築されるため、appはresetGeometryDrag／resetDimensionDrag／resetAnnotationDragという遅延callbackを接続する。他のSession／command／previewは同じ実体を渡し、mode変更は既存setterへ依頼する。旧endInteraction callbackは廃止し、自由なapp contextや汎用reset容器は渡さない。


### 拘束保存metadataの所有

ConstraintPersistence.createMetadataは拘束の保存用metadataを所有し、decorateとsnapshotDataを返す。decorateは渡されたdataを同じObjectのまま装飾し、readOnlyDimension、寸法parameterName（空値はnull）、非read-only寸法のexpression（空値時だけ既存数値式reader）を従来順に付与する。read-only時に既存data.expressionを削除せず、非寸法／null dataの扱いとfield順を維持する。snapshotDataは既存raw serializer→同じdecorate→sketchId→参照metadataの順で生成し、DocumentだけconstraintSketchId readerを使い、Blockではconstraint.sketchIdをそのまま付ける。scope引数は従来どおり使用せず、未指定とnullを新たに正規化しない。raw serialize／deserialize／typesとcodec registryは変更しない。

metadata ownerはSketchContextの後、早いBlock機能の前に生成する。raw serializerはhoisted関数を注入し、factory生成時には数値式・Sketch・raw codecを読み取らない。appのdecorateSerializedConstraintはhoisted委譲として維持し、Block編集／履歴・Clipboard・test supportが同じdecorateを使う。DocumentSnapshotにはsnapshotDataを直接渡し、共有装飾だけの用途へDocumentのscope／参照metadataを混ぜない。モデルは変更せず、例外は同じ位置で伝播する。


### 新規Parameter候補の読取り検証

ParameterNamespace.validateNewDimensionParameter(draft, namespace)は、明示した名前空間に追加する寸法／注記Parameter候補の読取り検証を所有する。名前trim・式入力の正規化→symbolを一度収集→既存Parameter／symbolと候補の名前検証→Parameter／可変symbol／新候補のdefinitionsとread-only値Map→既存ParameterEngine評価→有限値検査の順を維持し、{ expression, value }を返す。採番・symbol追加・target／evaluated値の更新やensureは行わず、入力draftとnamespaceを変更しない。有限の0・負数も従来どおり受け入れ、名前重複・式prefix・未知参照・循環のEngine例外はそのまま伝播する。非有限の結果は現在言語の既存errorを投げる。appはAnnotationCommandのvalidateParameterから現在modelを明示して同じNamespaceへ依頼し、DocumentとBlockのscopeを暗黙に切り替えない。commitParameterの登録・評価は既存経路に残し、モデル更新を伴うevaluateParameterNamespaceで候補検証を代替しない。


CanvasDisplay（src/application/canvas_display.js）は共有viewportと表示基盤の二段階の構築を所有する。createでCanvasViewport／CanvasNavigation／CanvasZoomControlを生成し、同じviewportを捕捉するcreateWorkspaceでCanvasSurface／CanvasExport renderer／CanvasWorkspaceLayoutを生成する。二段階の間にあるTransientAuthoringはappに残し、既存の生成順を変えない。ズームはpointer flush→同じnavigationで倍率適用→寸法入力同期、surface resizeはdraw→最新pending照会→入力同期を維持する。倍率入力のDOM listenerは従来の生成時に接続し、layout controls／windowのbindとsurface.startはappの既存の時機に残す。viewport・navigation・zoom controlとsurface・export renderer・layoutを明示的に返し、座標／gesture／DPR／export frame・DOM表示の実装とstateは各既存ownerだけに置く。createWorkspaceは生成時にCanvasサイズ・pending・Geometryを読まず、Observerも開始しない。後段で生成される寸法入力同期とTree幅適用はappから遅延callbackで接続し、初期化前のconstを直接渡さない。Document編集や履歴・アプリ全体のcontextは受け取らない。


CanvasCommandInputs（src/application/canvas_command_inputs.js）はPointerInteractionController.press.inputsへ渡すInstance／Annotation／Constraint／Drawing／Selectionの生成・接続を所有する。Annotation→Constraint→Instance→PointCommand→Drawing→Selectionの既存生成順を保ち、PointCommandはDrawing専用として内部へ閉じる。mode／pending／拘束pendingの同じreaderとSelection・Hover・command・snap・drag・UI通知を64の明示依存として受け、各子factoryには従来の必要な引数だけを渡す。panel focus解除とpointer captureは共通のprivate callbackへまとめる。生成時にDOM／model／scopeを読まず、原点指定のsnap許可判定は現在command.sourcesとviewport倍率を操作時に取得する。五つの入力APIだけを不変Objectとして返し、優先順位はpointer controller、各commandの確定／取消とrollbackは元のownerに維持する。独自mode・pending・Selectionやapp全体の可変contextは作らない。64入口の構築契約は依然広いため、これを最終的な数百行のcomposition root達成とは扱わず、上位機能の公開API整理を継続する。

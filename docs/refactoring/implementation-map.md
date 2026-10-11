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
- `app.js`: moduleの組合せ、Documentと操作状態、描画、入力、保存読込の進行、履歴adapter、Block、Annotation、Reference Image
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

`AnnotationRenderer`は注記文字・引出線・終端記号、`ReferenceImageRenderer`は参照画像のURL cache・画像本体・選択枠・較正markerを所有する。Annotationの描画入力と参照点解決はappが接続する。ReferenceImageの表示入力は同rendererのcreateLayerが読取り専用の照会から構成する。

### Canvas surface

`CanvasSurface`がbitmap寸法・DPR・ResizeObserver・stroke状態保護とdashを所有する。appはresize後の再描画／入力UI更新を接続する。`CanvasViewport`はworld座標と表示原点・倍率を引き続き所有し、bitmap状態と分ける。

### Hatchの描画

`HatchRenderer.create`は解決済み輪郭へのclip・pattern線・solid塗りを担当する。塗描画へは操作状態を渡さず、`createLayer`の表示構成が読取り専用の照会と型別painterを使って入力を決める。輪郭boundsは`HatchRegionEngine`へ集約し、fitとBlock boundsからも利用する。

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

- `AppearanceControls`（`src/ui/appearance_controls.js`）: 図形／寸法外観の入力欄と継承値表示。Document非依存でPropertiesとDocument設定が共用する。
- `AppearancePalette`（`src/ui/appearance_palette.js`）: 色選択session、標準色／使用中色、確定と取消を所有。各対象への適用と履歴は既存APIへ接続する。

- `PropertySelection`（`src/editing/property_selection.js`）: Properties対象と共通値・対応項目の解決。操作状態とCanvas選択を読み、表示と編集の判断を共通化する。
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

- ConstraintStatusView: 拘束状態表示の固定／Space保持状態、blur解除、表示同期。appは入力順と接続を担当する。

- KeyboardInteractionController: キーボード受付順と操作APIへの委譲。取消時の共通状態更新はapp側に残り、次の整理対象。

- GeometryInstanceCommand.cancel／BlockPlacementCommand.finishOrCancel: Esc時の配置状態更新とUI復元を既存の状態所有者へ集約。追加の依存注入は不要。

- SketchProjectionCommand: 投影元draftと開始／選択／確定／取消／reset。幾何範囲照会はappの読取り関数に残り、既存Projection編集moduleは保存済み投影の同期を担当する。

- SplineEditCommand: 既存Spline編集sessionと通過点の追加／削除／求解復元。SplineDraftは新規作成、SplineCommandは作成確定を担当する。

- SplineCommand: 作成開始とBackspaceによる直前点取消も統合。appはToolbar／keyboardから公開操作を接続する。

- RectangleSelectionQuery.readProjection: 投影元の矩形照会を統合。通常選択と幾何判定を共有し、投影元の適格性・候補providerは分ける。

- DrawOperationLifecycle: 複数作図コマンドの終了／取消／進行中判定の調整。draft所有は各コマンドに残る。

- DrawOperationLifecycle.start: 基本9モードの開始を統合。Slot／Trimの初期化差分を明示し、ToolbarはDOM接続だけにする。

- FilletCommand.begin／OffsetCommand.begin: 事前選択付き開始を所有。共通初期化はDrawOperationLifecycle.prepareへ委譲し、Toolbarは開始APIに接続。

- ConstructionCommand: 選択図形の補助作図切替と未来の作図設定を所有。DrawOperationLifecycle.resetInputsは既に設定済みのmodeに対するdraft初期化だけを担当する。

- CanvasInputBinding: Canvas DOM入力接続と座標表示。CanvasNavigation.zoom: pointer中心の倍率変更。操作判断と状態は既存controllerへ委譲。

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


GeometryDeletionCommand（src/commands/geometry_deletion_command.js）はプリミティブ／拘束の削除操作を調整する。権限→削除計画→派生参照保護→空判定→Parameter保護→操作終了→削除適用→選択／Spline／hover整理→入力候補のownerごとの求解→円弧正規化→表示→案内／履歴の既存順序を所有する。GeometryDeletion、CanvasSelection、SplineEditing、CanvasHoverの既存所有者を使用し、現在scopeはガード後に照会する。共通modeとpending command／dragの終了、表示同期、analysis安定性の照会は限定したadapterで接続する。求解不成功でも削除を記録する既存挙動を維持し、新しいrollbackは導入しない。appのdeleteElementsは早期接続を保つhoisted wrapperとなる。Annotation／Hatch／Instance等を含むdeleteCurrentSelectionの調整はまだapp側に残る。


GeometryDeletionのplanDerivedInstances／planBlockInstancesは、投影bundleから削除ID・Geometry key・依存拘束を非破壊で計算する。拘束の再生成された投影はkeyで対応し、Blockのみowner自体を参照する拘束も対象に含める。派生Instanceのfalsy key除外とBlockのkey保持、古いBlock bundleのsplines省略を維持する。applyInstancesは拘束→注記→指定Instance配列を更新し、別種類のInstance配列や投影元Geometryは変更しない。派生参照／Parameterのガード、Block投影cache無効化、選択・求解・履歴は呼出側が所有し、既存順序で接続する。


SelectionDeletionCommand（src/commands/selection_deletion_command.js）は混在するCanvas選択の削除を調整する。Selection権限とHatch／Parameter保護の後にAnnotation・Hatch・画像を処理し、派生Instance→Block→通常図形の既存順序で各編集所有者へ委譲する。Instanceの計画／適用はGeometryDeletion、通常図形と拘束の削除はGeometryDeletionCommand、画像操作状態の解除はReferenceImageInteractionが担当する。通常図形が削除を確定した場合は追加の履歴を作らず、その他の要素だけならowner Sketchの求解またはUI更新と種別別履歴を確定する。途中の参照ガード拒否までに他種別要素が既に除かれている既存挙動も維持し、atomic化を仕様変更として混ぜない。appは生成・限定した共有表示同期・hoisted入口の接続を担当する。


ConstraintFeedbackのtargetHint／invalidTargetHintは拘束種別・operand列・言語から、対象選択中と対象拒否時の案内文を生成する。固定・寸法・対称などの段階別の文言と日英分岐を保持し、Document・DOM・pending sessionを照会または変更しない。汎用案内だけで必要になる拘束labelは限定したproviderを遅延評価する。appは現在のoperandと言語を渡すwrapperを持ち、拘束の受入判断・状態遷移・確定／取消は操作側の責務として残す。Document初期化・Sketch切替・削除では解除対象と順序が異なり、案内分離に合わせて汎用resetへ統合しない。


ConstraintOperandsのappendTargetは拘束種別・現在operand列・候補から、受入結果と新しいoperand列または拒否理由を返す。対称の軸→同種の2対象、重複／短線拒否、通常拘束の種別制限、再選択時の末尾移動と対象数上限を維持する。Arc型と線の向き判定を注入し、拒否案内は必要時だけproviderを評価する。入力列・Geometry・CanvasSelection・pending sessionは変更しない。appは成功した列を操作状態へ反映して選択を同期する。拘束対象の保存状態と確定／取消の所有は継続して整理する。


ConstraintTargetSession（src/editing/constraint_target_session.js）はpending拘束commandと順序付きoperand列の状態を所有する。beginは開始状態を設定し、appendはConstraintOperandsの受入規則へ委譲して成功時だけ列を更新する。resetは両方を解除し、clearOperands／clearCommandは既存の選択解除／Sketch切替／削除の異なる解除範囲を保持する。Annotationアンカーや寸法配置でのcommand復元と対象列置換は明示APIへ接続し、Geometryとcommandの参照同一性を維持する。読取getterにsetterはなく、app内の変数は撤去する。CanvasSelection同期・案内・求解・確定／取消の操作調整はまだ呼出側に残る。sessionはDocument・DOM・共有modeを所有しない。受入規則への接続は遅延adapterでclassic scriptの初期化順序を保持する。


ConstraintTargetCommand（src/commands/constraint_target_command.js）は対象選択の開始・取消・確定要求と線長寸法の完了入口を調整する。Annotationアンカーへの委譲→権限→作図入力終了→同種commandのtoggle取消→session開始／選択整理→既選択の意図解決という順序を維持する。sessionはConstraintTargetSession、受入と意図は既存規則、案内はConstraintFeedback、寸法配置と拘束確定は既存操作へ委譲する。取消前のcenterline／slot reset、共有mode／作図draft終了、拘束controlのblurは限定adapterで接続する。取消時の案内・button・toolbar・blur・描画の順序と、準備済み対象の即時配置／確定時に重複した案内を出さない動作を維持する。appの4入口はhoisted wrapperで早期接続を保つ。Canvas hit／対象clickや実際の拘束commitは継続整理する。


OperandHitQueryのhitConstraintOperandはpointer・拘束種別・現在operand列と任意の既知hitから拘束候補を照会する。Point／Line／Circle／Arc／Spline／円弧端点のhit providerを順に評価し、nullishな既知hitは既存と同じく再照会する。対称の軸／subject kind、対象種別で許可する円弧端点、Point→Line→円／円弧→Spline→派生投影→Block投影→参照Sketchの優先順を保持する。円／円弧のhit位置とSplineのparameter／近い端点を既存の幾何APIで取得する。operand列やSelection・操作sessionは変更せず、appは現在の列を渡すwrapperとhit providerの接続を持つ。


ConstraintTargetCommandのoperandClickはAnnotationアンカー→固定切替→空白での線長寸法確定→対象追加→意図解決→寸法配置／拘束確定の振分けを調整する。hitはOperandHitQuery、受入と列更新はConstraintTargetSessionに委ねる。固定では参照／派生投影を拒否し、Block投影またはprimitiveを個別Geometry固定へ渡す。選択解除と同期後に現在commandを捕捉し、固定成功後の選択解除を経て同じcommand参照を復元する既存順序を維持する。対象拒否では案内だけ、意図エラーでは同期後に案内と描画、未完了では選択UIと案内・描画を行う。実際の固定編集、寸法配置・値入力、拘束commitとUI更新は明示した依存へ委譲する。appは生成時の接続とhoisted入口を担当する。


ConstraintCommitCommand（src/commands/constraint_commit_command.js）は通常／参照拘束の追加、snapshot捕捉、前処理、求解、Parameter安定化、線退化／重複判定、失敗復元、成功後の分析・表示・履歴を調整する。通常の作成権限と対象scope、参照の先祖／循環ガードは既存の順序を保持する。重複寸法は復元して同じcommandの読取寸法登録へ進む。通常拒否のundefinedと参照拒否のfalseの戻り値差も保持する。参照metadataは同じ拘束Objectへ付与し、診断用markReference入口も同じ所有者へ接続する。既存checkpoint・Solver・退化／重複照会・Parameter・UI／履歴を明示した依存として使用し、現在modelやDOMを直接探索しない。計測時計と通常成功後の性能記録更新はadapterへ接続する。appは生成／接続とhoisted入口を担当し、共有sessionと組立ての調整は継続整理する。


DimensionConstraintFactory（src/constraints/dimension_constraint_factory.js）は明示した寸法target・値・配置から拘束Objectを生成し、constraintまたは生成拒否理由を返す。Geometry型と平行判定を注入し、点axisの優先、角度のdegree→radian、半径／直径prefixと配置値の同一性／複製範囲を維持する。非平行の線同士は理由を返し、silentかどうかと案内／logの表示は呼出側が判断する。モデル配列やUI・sessionは変更しない。DimensionQueries.targetItemsはtargetに含まれる参照要素を順序と同一性を保って返し、読取寸法のBlock所有判定などから使用する。寸法配置session、読取寸法の仮追加／重複照会、最終commitは操作側に残る。


DimensionReadOnlyQuery（src/constraints/dimension_read_only_query.js）は配置候補から読取寸法にする拘束を返す。生成拒否、明示的な測定寸法、単一Block内の対象、通常／参照の重複照会の順序を維持する。生成・owner付与・参照metadata・対象照会・重複probeを限定した依存として注入し、UIと配置sessionを変更しない。ConstraintRedundancy.probeCandidateは現在scopeへの候補追加、owner単位の既存解析、候補の参照による除去を所有し、表示用の重複診断状態を更新しない。候補の追加後に配列をfilterで置換する既存の参照関係を維持する。求解・履歴確定・読取寸法の保存登録は操作側が担当する。


DimensionPlacementCommand（src/commands/dimension_placement_command.js）は選択からの寸法開始、半径／直径開始、解決済み意図からの配置開始、配置中の追加対象による再解決、位置確定後の値入力／読取寸法登録への進行を調整する。既存DimensionPlacementへ配置値の計算、DimensionReadOnlyQueryへ読取判定、ConstraintTargetSessionへ対象列／commandを委譲する。選択開始だけ作図draftを解除し、意図からの開始はmode変更だけを行う既存の違い、既定pointerとdimension anchorの違い、表示→draw→focusの順序を維持する。appには共有mode／作図draftの準備、PendingCommandSessionのread／replace port接続とhoisted入口を残す。保留状態は他種別commandと同じSessionを共有し、寸法だけのSessionへ複製しない。注入する操作依存は多く、配置sessionと入力表示の所有を整理する際に組立て境界を再検討する。寸法値の評価／求解／確定はDimensionValueCommandが引き続き担当する。


ConstraintIntentResolver（src/constraints/intent_resolver.js）は順序付きoperandから通常拘束、通常／参照寸法の配置、参照拘束、参照対称、Spline拘束の意図または拒否理由を返す。関係区分、対象数、編集権限、先祖／子孫、循環、Spline端点の検査順序を保持する。全対象が参照側の寸法はactive Sketch内の読取測定として解決する。候補生成はConstraintCandidates、operandからのsubject／参照への変換はConstraintOperands、権限と参照関係は注入した照会へ委譲する。型と現在Sketchを明示し、Selection・session・pendingCommand・モデル配列・UI・履歴を直接変更しない。appは生成／接続とresolve入口、現在Selectionから対象を取得するadapterを担当する。


ConstraintSolvePreparation（src/solver/constraint_solve_preparation.js）は拘束追加前の円弧端点とOffset／OffsetChainの幾何前処理、および求解ステップ幅の算定と一時変更／復元を所有する。型、幾何照会、半径寸法の有無、最小長さ、OffsetChain計画を明示して注入し、対象Geometryを同じObjectのまま補正する。半径寸法のある円弧の保護、角度の周回、前処理の適用順序と一時ステップ幅をfinallyで戻す契約を維持する。Document配列・Selection・UI・履歴を変更せず、snapshot／求解実行／失敗復元はConstraintCommitCommandとDimensionValueCommandなど呼出側が担当する。appは生成／接続と早期参照のための3つのhoisted入口を保持する。


拘束対象とCanvas選択の変換は、ConstraintOperands.fromSelectionとCanvasSelection.applyConstraintTargetsが所有する。fromSelectionは明示したSelectionとpointerから点→線→円→円弧→円弧端点→Splineの順に対象列を返し、端点選択した円弧の全体対象を重複させない。Splineは注入したclosest-point照会を28 samplesPerSpanで行い、pointer→startPoint→原点の優先、parameterの0 fallbackと0.5を含むstart側判定を維持する。applyConstraintTargetsは解決済み対象列を既存set入口で反映し、tree／Instanceの選択を既存の範囲で解除する。注記など他カテゴリの選択は保持する。appは現在sessionの対象を照会へ渡し、現在Selectionとpointerを変換へ渡す接続だけを保持する。未使用のhandleConstraintTargetClickは撤去し、Canvas拘束入力はConstraintCommandInput→ConstraintTargetCommand.operandClick→ConstraintTargetSessionの経路を使用する。既存のダブルクリック経路は維持する。


ConstraintCommitCommandはreadOnly・resolution・dimensionの入口も所有する。読取登録は測定値を設定してreadOnlyDimension=true／enabled=falseとし、同じ拘束Objectを既存モデル登録へ渡す。Selection整理→分析→UI→draw→案内／log→履歴を保持し、求解は実行しない。解決済み意図は権限検査後、距離配置または通常／参照commitへ振り分ける。生成済み寸法の通常expression設定と参照expression省略、成功後の既存commit履歴に続く意図履歴を保持する。重複寸法の失敗復元から読取登録への経路は同じcommand内で完結し、appへ戻る依存を撤去する。寸法構築と配置開始、モデル登録／UI／履歴は限定したportへ接続する。appは生成／接続とhoisted入口を保持し、Selectionから意図を取得する入口は継続整理する。


ConstraintSelectionQuery（src/editing/constraint_selection_query.js）は現在のSelectionとConstraintTargetSessionを読む拘束の実行可否／完了可否／意図照会を所有する。対象session→Spline選択変換→通常Selectionの優先を保持し、型候補はConstraintCandidates、対象意図はConstraintIntentResolverへ委譲する。canApplyのGeometry mode制限と、収集済みoperandがあるcanCompleteの既存の判定範囲を区別する。線長寸法はcommand開始後の追加対象待ちを保持する。現在Sketchと操作modeを限定した照会として受け取り、Selection・session・pending・UI・履歴を書き換えない。appは生成／接続とhoisted入口を保持し、UIと対象操作・寸法操作は同じ照会に接続する。移管後にappへ残っていた未使用候補／subject変換の分解代入も撤去する。


ToolbarView（src/ui/toolbar_view.js）は描画modeと操作状態の表示値からToolbarのactive／aria-pressed／aria-disabledと既存のdisabled属性を反映する。操作状態は必要な値だけをreadInteractionで受け取り、現在model・sessionを直接参照しない。選択可視性と対象の編集可否は注入した照会へ委譲し、ボタンがない場合やGeometry mode外の既存の短絡評価も保持する。ボタン反映→履歴ボタン→選択可視性→Flyout→カーソルの順序を維持し、カーソルはFlyout同期後の最新操作状態を読む。実行command、選択可視性の変更、履歴編集は所有しない。appは各照会と既存CommandCursor／ToolFlyoutsへの接続とhoisted updateToolbar入口を保持する。


PropertySelection（src/editing/property_selection.js）は選択可視性の対象列と全対象の非表示判定も所有する。Propertiesの対象優先順位とは独立した照会とし、inspection、Root／作図Sketch、Block投影Geometryの除外、寸法の同一参照による重複除去と対象順を保持する。派生Instanceは明示visible上書きを優先し、未指定なら解決済みGeometry／Hatchの実効外観、空bundleならDocument／Sketch／Instanceの継承値を照会する。状態や配列を変更しない。

SelectionVisibilityCommand（src/commands/selection_visibility_command.js）はGeometry mode確認、対象取得、Sketch委譲または選択編集権限確認、次のvisible値の照会、通常対象のBulkPropertyCommand適用、派生InstanceのAppearancePropertyCommand適用、履歴／UI／drawの順で実行する。子commandにはcommit=falseを渡して既存の中間drawを保持し、最後に一回の表示切替履歴を記録する。Sketchの表示切替はSketchCommandの契約へ委譲する。DOM・Selection状態・外観継承計算を所有せず、appは生成／接続と早期イベント接続用のhoisted入口を保持する。


ConstraintSelectionQueryは点／線のFix一括対象、全対象の固定状態、Fixボタンの操作可否も照会する。投影・他型との混在・Arc端点・複数owner・constraint操作権限を区別し、点／線のObject参照を保って返す。ボタン可否ではAnnotation単独、Block単独、単一Block投影、Arc端点の既存の代替条件を保持する。Selectionや固定状態を変更しない。

ConstraintControlsView（src/ui/constraint_controls_view.js）は拘束ボタン、拘束メニュー、Fixボタンのactive／ARIAとhintのtitleを反映する。DOM要素、操作種別の照会、Fix可否、選択有無、翻訳を明示的に受け取る。Geometry mode外では表示解除だけを行い、準備／能力照会を呼ばない。Geometry mode内では呼出し側の保留寸法確認→拘束ボタン→メニュー→Fixボタン→hintの順序を維持し、FixメニューはFixボタン更新前の属性を参照する既存の契約を保つ。appは保留寸法の取消条件とcancelPendingCommandを接続し、Viewはモデル変更やcommand取消を所有しない。


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


CanvasWorkspaceLayout（src/ui/canvas_workspace_layout.js）はCanvasの表示領域変更とPropertiesパネル開閉の表示調整を所有する。Canvas・DOM・viewportとbitmap同期、Sketch Tree幅適用、draw、値入力の保留照会／位置同期、現在中心と表示言語を明示して受け取る。サイズ取得→bitmap同期→指定中心を保つviewport更新→Tree幅→draw→現在pendingを照会して入力位置同期の順序を保つ。幅または高さが0の場合と中心指定なしではviewportを変更しない。パネル開閉は中心取得後にclass／ARIA／titleを更新し、同じ中心でサイズ調整する。必要DOMなしでは無変更。Sketch Tree幅・値入力・bitmap／DPR・モデルや履歴の状態を複製せず各既存所有者へ委譲する。appは後から生成されるTree／値入力入口を遅延callbackで接続し、window resizeのcontext menu解除と起動時の呼出しを組み合わせる。


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

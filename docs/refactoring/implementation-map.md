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

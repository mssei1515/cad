# 実装対応表

現在の実装配置を調べるための開発資料。正式仕様や将来の分割設計ではない。仕様と保証内容は[仕様の入口](../../spec/README.md)および[検証対応](../../spec/verification/保証対応.md)を参照する。

## 1. 実装ファイルの責務

- `index.html`: 固定ワークスペースとコマンドUI
- `style.css`: レイアウトと状態表現
- `app.js`: Document状態、描画、入力、保存、履歴、Block、Appearance、Annotation、Reference Image
- `parameter_engine.js`: Parameter式の字句解析、構文解析、依存評価、識別子検証と名称書換え
- `constraint_solver.js`: GeometryとConstraintのsolver
- `geometry_ref.js`: 直接GeometryとBlock Projectionの参照codec
- `spline_geometry.js`: Splineの補間、評価、微分、最近点、flatten、交点計算
- `hatch_region.js`: 閉領域の交点計算、平面グラフ、面探索、境界復元
- `offset_chain.js`: Line／Arcチェーンの支持曲線オフセット、マイター接続、退化・自己交差検出
- `constraint_codec_registry.js`: Constraint永続化dispatch

## 2. 領域とテスト

| 領域 | 実装 | 主なテスト |
| --- | --- | --- |
| Geometry kernel | `geometry_kernel.js` | `geometry-kernel.test.js` |
| Spline kernel | `spline_geometry.js` | `spline-geometry.test.js`、`spline.spec.js` |
| GeometryRef | `geometry_ref.js` | `geometry-ref.test.js` |
| Constraint codec | `constraint_codec_registry.js` | `constraint-codec-registry.test.js` |
| Parameter式 | `parameter_engine.js` | `parameter-engine.test.js` |
| Hatch region | `hatch_region.js` | `hatch-region.test.js`、`hatching.spec.js` |
| Sketch内描画順 | `app.js` | `drawing-order.spec.js` |
| Reference Image | `app.js`、`index.html` | `reference-images.spec.js` |
| 派生Geometry Instance | `app.js`、`index.html` | `sketch-projection.spec.js` |
| Offset chain | `offset_chain.js` | `offset-chain.test.js`、`geometry-solver.test.js`、`unified-ui.spec.js` |
| Solver | `constraint_solver.js` | `geometry-solver.test.js`、drag E2E |
| Constraint Dimension | `app.js`、`constraint_solver.js` | `geometry-solver.test.js`、`unified-ui.spec.js` |
| Document／Canvas／UI | `app.js`、`index.html`、`style.css` | `unified-ui.spec.js`、`phase0-characterization.spec.js` |
| Block | `app.js` | `blocks.spec.js` |

## 3. 計算と編集policyの現在の配置

- `geometry_kernel.js`: UI adapterとSolverが共有する副作用のない数学関数。角度範囲・符号付き距離・縮退境界は[幾何計算](../../spec/calculation/幾何計算.md)に従う。
- `app.js`: Arcモデルを補正する`normalizeArcSweep`、ほぼ一周判定を含む`arcEndpointDragValue`、dragのtarget選択・preview・確定、Sketch依存更新、Block配置、Parameter feedbackを扱う。
- `constraint_solver.js`: 数値Jacobian、減衰付き最小二乗法、拘束残差・自由度の解析。
- `hatch_region.js`: 副作用のない交点・AABB候補絞り込み・平面グラフ・half-edge面探索・点包含・境界の保存復元。
- `parameter_engine.js`: 式のparserと依存評価。Geometry再測定を伴う確定処理とは分離している。
- `constraint_codec_registry.js`: 永続Constraint型のclass、保存type、serialize、deserializeは単一registryで対応付ける。参照列挙、表示名、未登録型のユーザー向け拒否policyは永続codecとは別の責務として保持する。

この配置は現在の実装対応であり、将来のモジュール構成を拘束する仕様ではない。


## 4. 検証の共通fixture

`tests/e2e/test-fixture.js`はbrowser実行時エラーを共通収集する。拘束選択経路を含め、pageerrorを除外せず検出する。保証の範囲は[保証対応](../../spec/verification/保証対応.md)を参照する。

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

activeEditHistoryが現在のscopeのundo／redo、snapshot作成、比較signature、復元処理、表示labelを束ねる。recordHistoryとundoHistory／redoHistoryはedit_history.jsへ比較・追加・stack間移動を委譲する。履歴buttonも同じscopeを参照する。

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

profileInteractionPhaseとprofileInteractionWorkはinteraction_profiler.jsのphase／workへの参照であり、明示的に有効化した同期scopeだけを集計する。workのselfMsは入れ子の計測時間を除き、scope内の残りをotherMsとする。Parameterや依存更新内のsolveをsolve区分へ再加算しない。呼出し回数は各関数の粒度であり、ui呼出しの中にtree／propertiesの呼出しが含まれる。

角度以外の寸法確定はupdateGeometrySelectionUIとsyncDimensionValueInputを使用する。Properties・選択表示・履歴は保持し、形状不変の操作で拘束解析とTree全再生成を省く。角度寸法のsyncAngleConstraintFromDimensionはtargetを変更し得るためupdateUIを維持する。

## 8. 履歴操作・同期計測のmodule境界

| 配置 | 入出力と責務 | 依存・副作用 |
| --- | --- | --- |
| edit_history.js | record(history, limit)は追加の有無、undo／redo(history)は復元結果を返す | 渡されたstackを更新し、capture・signature・clearRedo・restoreを呼ぶ。DOM・model・solverは参照しない |
| app.jsの履歴adapter | activeEditHistory、snapshot作成・復元、historyRestoring、button・log | Document／Block固有のscopeと復元順を保持。復元中の記録抑止もapp側で行う |
| interaction_profiler.js | create(now)で独立した計測器を作り、start／stop、phase／work、activeを提供 | clockと同期callbackだけに依存。集計状態は計測器ごとに保持し、DOM・modelを参照しない |
| app.jsの計測adapter | 計測する関数と区分、pointer flush、test hook | 実行経路を決め、moduleへ集計を委譲する。通常時は無効 |

履歴は既存どおりstackを移動してからrestoreを呼び、戻り値と例外をそのまま伝える。module側で自動rollbackを追加しない。初期化やsnapshot形式、TX-01〜05はapp側の既存実装を維持する。

計測のstart／stopは同期phaseの外で使用する。phase／workはcallbackの戻り値・例外を保ち、finallyで親の計測scopeを戻す。async処理の完了を追跡するAPIではない。テストではclockを注入して時間の内訳を決定的に比較する。

index.htmlは既存の通常script読込列で両moduleをapp.jsより先に読み、起動ごとのquery付与も共用する。ES moduleや新たなbuild工程は導入せず、file／HTTP両方の起動方式を維持する。

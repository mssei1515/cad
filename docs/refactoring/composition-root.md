# app.jsを起動・接続専用にする継続作業

再開時は先に[リファクタリング方針と再開手順](refactoring-policy-and-resume.md)を読む。本書の古い記録は当時の経過であり、現在の課題は先頭の再開地点とGitの現物を優先する。

開始点はdevelopの`457adea`。承認された最終目標は、`app.js`を数百行程度の生成・接続・起動・終了へ整理すること。部分的な抽出や中間のテスト成功をもって、この目標の完了とはしない。

## 現在の再開地点（2026-09-25）

BlockSelectionQueryへBlock作成候補の検証と配置中心照会を分離。現在scopeを都度取得し、共有点・注記・ハッチ境界と内部／外部拘束を照会する。2関数の本体一致を確認した。依存の明示で旧未定義constraintLabelForList参照が起動時エラーとなることをE2Eで検出し、既存localizedConstraintNameへ接続して修正。構文247件・単体499件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,726行。次はcloneConstraintForBlockのappへの逆依存とBlock履歴adapterを整理する。全体目標と全体E2Eは未完了。

BlockDefinitionCommandへ作成・編集開始／取消・定義名変更／削除と親host復帰の調整を集約。Session／DefinitionEditing／EditingQueries／Catalogへ委譲し、BlockViewが一覧dialog閉鎖と編集classを担当する。空編集viewportの調整と履歴resetはappの明示adapterとして残る。構文245件・単体494件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,805行。次はBlock候補の選択検証と境界中心の照会、拘束複製と残るBlock履歴adapterを整理する。全体目標と全体E2Eは未完了。

選択からのBlock下書き生成と空定義生成を既存BlockDefinitionEditingへ、所有子孫の仮移動と復元記録生成を既存BlockEditorSession.stageChildrenへ統合。新しいmoduleは追加していない。座標変換・寸法式の数値固定と採番時点、全registry差替え後の拘束再接続を維持。4関数の本体比較、構文243件・単体487件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,917行。次はBlock作成・編集開始／取消・定義操作の進行と、選択からのBlock候補照会を整理する。全体目標と全体E2Eは未完了。

BlockEditingQueriesへ編集範囲・利用可否・参照Instance・draftを優先する依存循環と移動可否を集約。保存済み所有子孫とSketch表示行は既存BlockCatalogへ統合し、仮移動と削除の子孫探索を共用した。呼出し元のないnestedBlockPlacementErrorは除去。12照会関数の本体比較、構文243件・単体483件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,032行。次は選択からのBlock下書き生成・仮移動と作成開始、編集開始／取消・定義削除を既存の所有者へ接続して整理する。全体目標と全体E2Eは未完了。

Block編集の下書き検証・回転確認待ち・定義反映・参照整理・配置先求解・履歴をBlockCompletionCommandへ集約。待機状態も所有し、同じsessionへの回答だけ適用する。親scope復帰後にモデルを取得し、内部拒否とTX-05の配置先エラーを区別する。構文241件・単体477件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,164行。次は残るBlock定義の階層／依存照会、選択からの作成開始、編集開始・取消・削除の依存を整理する。全体目標と全体E2Eは未完了。

Block定義のclone／cloneInstance／translate／applyをBlockDefinitionEditingへ集約（`a70e9d0`）。Geometry同一性と拘束map接続、固定位置・寸法・補助要素の移動を維持し、session・DOM・履歴から独立。4関数の本体比較、構文239件・単体471件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,297行。次はvalidateBlockDraftとcompleteBlockDefinitionEditの依存を調べ、検証と確定commandを整理する。ユーザーの再開準備依頼により、全体方針・残作業・検証とGit運用・再開指示をrefactoring-policy-and-resume.mdに記録した。全体目標と全体E2Eは未完了。

BlockEditorSessionへsession連鎖、draft同期とUndo差替え、親scope復帰、一時定義／復元記録の引継ぎ・取消・削除時整理を集約した。appのsession変数と管理情報への直接書込みを除去し、名称変更も所有者へ委譲。確定処理とUIはcurrentの参照とAPIで接続する。構文237件・単体468件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,539行。次はBlock draftの検証・定義反映と確定commandを整理し、session所有者とは責務を分ける。全体目標と全体E2Eは未完了。

Block一覧と編集パネルのDOM表示・イベント接続をBlockViewへ分離。編集名は表示用コピー、モデル変更と履歴は明示した操作コールバックへ委譲し、focus中の入力保持とdialog更新順序を維持した。構文235件・単体463件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,673行。次はBlock編集sessionの開始・確定・取消とhost復元を一体で整理する。全体目標と全体E2Eは未完了。

Blockの有効Sketch変更と影響検査をBlockConfigurationCommandへ分離。投影差分から拘束／注記参照を確認し、拒否時の無変更、許可時の関連拘束と選択解除、cache・履歴・更新の順序を保持した。hover解除はappの所有者へのコールバック。構文233件・単体461件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,719行。次はBlock UIの内容生成・イベント接続、またはドラッグsessionの所有者を整理する。全体目標と全体E2Eは未完了。

Free Instanceの回転／反転とBlockの回転ロック／直交角度変更をInstanceTransformCommandへ分離した。Freeは共有元と指定InstanceをSolver変数から除外し、Blockは表示中心を保持する。各経路の局所／従属解、復元、解析・UI更新、履歴の違いを維持し、PropertiesとBlock UIが共用する。構文231件・単体458件・Block固定／Block／Free Instance／統合UI／保存互換E2E181件が成功。app.jsは18,761行。次はBlock構成変更の影響照会と確定処理、または残るドラッグsessionの所有者を整理する。全体目標と全体E2Eは未完了。

Free／Mirror／Patternの作成をGeometryInstanceCommandへ分離し、参照元候補と配置途中Instanceの所有者を集約。開始・配置・軸／方向確定・previewを同じcommandに接続し、Propertiesはpending、変換編集はisPlacing、取消は各破棄APIを使用する。Freeの確定時採番とPattern入力取消時の候補維持を保持した。構文229件・単体454件・Free Instance／統合UI／保存互換E2E136件が成功。app.jsは18,861行。次はFree Instanceの変換編集と共有元を動かさないSolver transaction、および残る描画／ドラッグsessionの所有者を整理する。全体目標と全体E2Eは未完了。

派生Instanceの参照元編集をInstanceSourceCommandへ分離。対象／候補状態、追加検証、確定時の参照順序とlegacy ID維持、削除保護、関連拘束・注記整理、履歴を同じ所有者にまとめた。Propertiesはcurrentの候補配列コピー、Canvas強調はincludesRef、モード終了／resetはAPIで接続する。構文227件・単体451件・Free Instance／Sketch投影／統合UI／保存互換E2E147件が成功。app.jsは18,944行。次はFree Instance配置とMirror／Pattern作成で共有する候補sourcesの所有者を整理する。全体目標と全体E2Eは未完了。

Block配置の5状態（定義・中心・有効Sketch・回転ロック・パネル復元記録）と開始／クリック／確定をBlockPlacementCommandへ分離した。previewも同じ所有者から予定Instanceを返す。Properties・通常取消・Documentリセット・test hookはAPIで接続し、直接状態書込みを除去した。構文225件・単体448件・Block／統合UI／保存互換E2E151件が成功。app.jsは19,014行。次はFree Instanceの配置・参照元編集sessionの所有者を整理する。mode／共通pointerと採番はapp側に残る移行用コールバック。全体目標と全体E2Eは未完了。

Propertiesの対象別HTML構成をPropertiesContent、現在scope／操作／選択からの表示情報取得をPropertyPresentationへ分離。配置中Instance、参照元編集中候補、Sketch外観、寸法評価値を照会側で解決し、ContentはDocument／操作sessionを直接参照しない。appはRows／Content／Controller／Viewと編集commandの接続を担当する。構文223件・単体445件・画像／Free Instance／Spline／統合UI／保存互換E2E144件が成功。app.jsは19,093行。次は共有の表示設定照会と、Block／Free Instanceの配置・編集sessionの所有者を整理する。全体目標と全体E2Eは未完了。

Propertiesのinput/change/clickをPropertiesControllerへ集約。参照画像・注記・派生Instanceの基本値適用はElementPropertyCommandへ分離し、Controllerはモデルやsessionを直接変更せず、既存commandと明示した操作コールバックを呼ぶ。Viewへ3イベントを接続した。構文220件・単体442件・画像／Free Instance／Spline／統合UI／保存互換E2E144件が成功。app.jsは19,208行。次はPropertiesの対象別内容構成と照会依存を整理する。Block配置・Spline編集sessionの所有者はまだappに残り、Controllerからは専用コールバック経由で接続する。全体目標と全体E2Eは未完了。

Properties外観の適用先・プレビュー／確定をAppearancePropertyCommandへ集約。色パレットもowner解決を共用する。UIは入力検証と値変換、AppearanceEditingは正規化適用、commandはcache・履歴・更新を担当し、寸法prefix／suffixの入力欄を再生成しない規則を保持した。構文217件・単体437件・統合UI／保存互換E2E114件が成功。app.jsは19,404行。次は残るPropertiesの入力振分けと参照画像／注記／派生Instance編集、対象別内容構成の照会依存を整理する。全体目標と全体E2Eは未完了。

Propertiesの補助作図切替とSpline開閉をGeometryPropertyCommandへ分離した。投影保護・曲線成立・Solver／従属解の確認と復元・履歴はcommand、入力欄の差戻しと通知・DOM／描画更新はappの接続処理が担当する。構文215件・単体434件・Spline／統合UI／保存互換E2E120件が成功。app.jsは19,474行。次はPropertiesの外観入力プレビュー／確定と対象別内容構成の依存を整理する。全体目標と全体E2Eは未完了。

寸法Propertiesの名前／式確定を既存DimensionValueCommand.commitPropertyへ、名前検証・参照式書換え・採番予約を既存ParameterNamespace.renameDimensionへ統合した。snapshot復元とSolver成功判定、履歴・通知の順序を維持し、Canvas入力pendingを操作しない。新規モジュールは増やしていない。構文213件・単体431件・統合UI／保存互換E2E114件が成功。app.jsは19,504行。次はProperties内の図形構造編集（construction／Spline開閉）の確定処理と、対象別内容構成の照会依存を整理する。全体目標と全体E2Eは未完了。

Propertiesの図形・寸法・拘束・Block・注記・複数選択の表示行をPropertyRowsへ、DOM更新・装飾・開閉状態・イベント接続をPropertiesViewへ分離した。内容生成はHTMLを返し、ViewがDOMへ反映する。構文213件・単体428件・統合UI／保存互換E2E114件が成功。app.jsは19,540行。次は対象別の内容構成の照会依存と、Properties入力の編集transactionを整理する。ユーザーの最新方針に従い、行数や残り利用枠に合わせて分割を急がず、今後の開発に適した責務の粒度を優先する。全体目標と全体E2Eは未完了。

Propertiesの対象／共通値照会を`PropertySelection`、外観の正規化適用を`AppearanceEditing`、一括変更の調整を`BulkPropertyCommand`へ分離。表示・パレット・一括編集が同じ対応項目とmixed値を使う。構文210件・単体426件・統合UI／保存互換E2E114件が成功。app.jsは19,775行。次はProperties表示行の生成と編集入力transactionを整理する。全体目標と全体E2Eは未完了。

Properties／Document設定の外観入力欄を`AppearanceControls`、色選択sessionと対象別適用・イベント接続を`AppearancePalette`へ分離。appからパレットsessionと使用中色収集・HTML生成を除去した。構文206件・単体423件・統合UI／保存互換E2E114件が成功。app.jsは19,914行。次はPropertiesの選択対象／表示モデルと入力編集transactionを整理する。全体目標と全体E2Eは未完了。

共有サイドバーhoverと選択／拘束の表示参照を`SelectionHighlight`へ集約。ツリーの選択class更新をViewと表示対象解決へ分離し、呼出し元とDOM生成の存在しない旧一覧用イベント／選択処理を除去した。構文203件・単体420件・統合UI／保存互換E2E114件が成功。app.jsは20,188行。次はPropertiesの表示と編集コマンド、Canvasの広範なhover状態の境界を整理する。全体目標と全体E2Eは未完了。

Sketchツリーの表示索引・図形行・拘束集計を`SketchTreeObjects`、クリック選択・展開・編集操作の振分けを`SketchTreeController`へ分離。Viewへ表示情報と操作を接続し、図形名のescape、拘束の元配列index、別Sketch選択時の追加選択解除を維持した。構文201件・単体417件・統合UI／保存互換E2E114件が成功。app.jsは20,406行。次はCanvasと共有する選択／hoverの所有者を整理し、Propertiesやツリーから直接参照する操作状態を減らす。全体目標と全体E2Eは未完了。

Sketchツリーの階層／カテゴリ描画・開閉状態・リサイズ操作を`SketchTreeView`へ集約。Document読込はcapture／restore APIで開閉状態を保存し、内部Mapへ直接書き込まない。構文198件・単体414件・統合UI／保存互換E2E114件が成功。app.jsは20,615行。次は図形行と拘束集計の表示モデル、ツリー操作からSelection／Document編集への接続をまとめる。全体目標と全体E2Eは未完了。

OffsetのクリックとEnter確定を既存`OffsetCommand`へ統合。プレビュー計算と入力待ちtargetの同期もcommandが担当し、`OffsetPreviewRenderer`は解決済みデータの描画だけを行う。構文196件・単体412件・統合UI／保存互換E2E114件が成功。app.jsは20,779行。残る大きな責務はBlock編集、Sketchツリー、Properties、Selection編集、拘束操作、ドラッグ／Canvasイベント、Document操作調整、test hook。次は機能単位の統合を優先し、細かな関数抽出だけを繰り返さない。全体目標と全体E2Eは未完了。

Offsetの距離・draft計算を`OffsetGeometry`、Geometry／拘束生成と失敗時復元を`OffsetConstruction`、入力開始・検証・確定を`OffsetCommand`へ分離。Geometry計算はDocument非依存、生成は現在の編集対象と採番を明示し、入力は選択状態と生成処理へ接続する。構文195件・単体410件・統合UI／保存互換E2E114件が成功。app.jsは20,896行。次は残ったOffsetクリック／hover／Enterイベントとプレビュー描画をcommand／rendererへ接続し、作図モード全体の開始・取消を整理する。全体目標と全体E2Eは未完了。

Offsetの対象・向き付きチェーン・選択確定を`OffsetSelection`へ集約。接続判定も同じ所有者に移し、クリック／Enter／モード切替／取消／test hookからの3変数への直接書込みを除去した。構文191件・単体407件・統合UI／保存互換E2E114件が成功。app.jsは21,162行。次はOffsetの距離測定・draft・入力開始・生成／失敗時復元を既存選択状態と接続し、機能全体のcommand境界を整理する。全体目標と全体E2Eは未完了。

寸法入力ControllerへCanvasキーによるbuffer編集と入力中表示更新を統合。Enterの入力開始／確定とEscape取消は明示したコールバックへ委譲し、モデル更新とは分離する。構文189件・単体404件・統合UI／保存互換E2E114件が成功。app.jsは21,278行。次はOffsetの選択状態（source、chain entries、選択確定フラグ）をまとめて所有させ、選択開始・追加・確定・取消とプレビュー／生成への接続を機能単位で整理する。現在の3変数はクリック・hover・Enter・モード切替・test hookに分散しており、単純な関数移動では解消しない。全体目標と全体E2Eは未完了。

寸法値・式の確定を`DimensionValueCommand`へ分離。既存寸法の更新失敗時のsnapshot復元と入力継続、成功時の履歴記録、初回寸法の拡縮と画面上の大きさの復元を同じ確定処理で調整する。構文189件・単体402件・統合UI／保存互換E2E114件が成功。app.jsは21,330行。次は入力待ちコマンドの開始・キーボード更新・取消を整理する。全体目標と全体E2Eは未完了。

寸法入力のlayout・所有Sketchの表示設定・入力検証とview同期を`DimensionInputController`へ分離。pendingCommandは読取りだけとし、距離の式評価とOffsetの数値判定、表示後の検証順序を維持した。構文187件・単体398件・統合UI E2E93件が成功。app.jsは21,374行。次は入力待ちコマンドの更新／確定／取消の所有者を整理する。全体目標と全体E2Eは未完了。

寸法入力欄のDOM操作を`DimensionInputView`へ分離。位置・角度・文字サイズ・幅・非表示・invalid表示・focus予約を担当し、寸法layoutと数式評価は呼出し側へ残す。表示後に検証結果を反映する順序と、focus予約後に取消された場合の非表示判定を維持した。構文185件・単体394件・統合UI E2E93件が成功。app.jsは21,410行。次は入力待ちコマンドの更新／取消と表示用値の生成を整理する。全体目標と全体E2Eは未完了。

入力待ちコマンドと描画モードからカーソルを表示する処理を`CommandCursor`へ分離。コマンド状態への直接依存を除き、種類とモードだけを値で渡す。SVG cacheと表示元の状態もviewが所有する。構文183件・単体391件・統合UI E2E93件が成功。app.jsは21,426行。次は入力待ち状態の表示依存（寸法入力欄）と取消・モード遷移の境界を整理する。全体目標と全体E2Eは未完了。

フィレットの最初の線と、半径配置から生成・拘束安定化・失敗時復元・履歴記録までを`FilletCommand`へ分離。pendingCommandは既存取消規則を維持する移行用get／setで接続する。構文181件・単体388件・統合UI／保存互換E2E114件・フィレットドラッグ回帰1件（3,744 previews）が成功。app.jsは21,495行。次は共通の入力待ち状態と作図モード遷移の境界を整理する。全体目標と全体E2Eは未完了。

連続線作図の開始Point、直交・最小距離補正と確定を`LineCommand`へ分離し、TransientAuthoringの復元記録へ接続した。開始点の直接書込みをreset／clickへ置き換え、プレビューも同じ直交補正を使用する。構文179件・単体383件・統合UI／保存互換E2E114件が成功。app.jsは21,583行。次は作図モード開始／終了の共通調整と、残る操作固有の状態を整理する。全体目標と全体E2Eは未完了。

矩形の開始Pointと二回クリック確定を`RectangleCommand`へ分離。各モード切替・取消はresetへ委譲し、プレビューは読出し専用の開始点を参照する。最小辺長、対角点snapの解除、四辺の水平／垂直拘束と確定後の更新順を維持した。構文177件・単体379件・統合UI／保存互換E2E114件が成功。app.jsは21,657行。次はLine作図の状態と確定処理を既存TransientAuthoringへ接続して分離する。全体目標と全体E2Eは未完了。

点・線作図の3個の復元記録を`TransientAuthoring`へ分離し、モデルと採番の復元・一時点判定・Selection整理・直前履歴破棄を同じ所有者へまとめた。appから復元記録への直接書込みを除き、作成Point／Lineの通知APIへ変更。構文175件・単体376件・統合UI／保存互換E2E114件が成功。app.jsは21,693行。次はモード遷移と各作図commandの開始／取消の接続を整理する。全体目標と全体E2Eは未完了。

スプラインのクリック判定・開閉曲線確定・ダブルクリック確定を`SplineCommand`へ分離。SplineDraft、Geometry生成、スナップ、選択・解析・履歴・表示更新を明示して接続した。appの初期化順序でGeometry生成とスナップが先行するよう調整。構文173件・単体372件・Spline／統合UI／保存互換E2E120件が成功。app.jsは21,803行。次は作図開始時のモード切替と他コマンド取消の責務を整理する。全体目標と全体E2Eは未完了。

スプライン作成中の通過点・Point rollback・最後のクリック情報を`SplineDraft`へ分離。開始、記録破棄、取消、Backspace、ダブルクリックの追加点除去を所有させ、appから3個の状態変数を除いた。既存Point保護と単点削除時に採番を戻さない規則を維持。構文171件・単体368件・Spline／統合UI／保存互換E2E120件が成功。app.jsは21,844行。次はスプライン確定・モード切替と残る作図操作の責務を整理する。全体目標と全体E2Eは未完了。

中ボタンのパン操作と全体表示用クリック履歴を`CanvasNavigation`へ分離した。開始・移動・終了・リセットを同じ所有者へまとめ、appはイベントの振分けを担当する。既存の計算順序、450ms／12pxの境界、Documentリセット時の状態破棄を維持。構文169件・単体364件・統合UI／保存互換のE2E114件が成功。app.jsは21,885行。次は残る描画操作のsession・取消処理を責務単位で整理する。全体目標と全体E2Eは未完了。

Document生成・内容消去・既定Sketchと表示設定の復元を`DocumentState`へ分離。編集scopeをDocumentへ戻し、内容消去→操作取消／cache破棄／採番リセット→既定値復元の順序を維持した。構文167件・単体360件が成功。関連E2E162件中161件が成功し、file URLテストの固定読込一覧へ新規3moduleを追加した後、残り1件も再実行成功。app.jsは21,930行。次は操作状態の所有者を分離し、resetModelStateの操作取消を各所有者へ委譲する。全体目標と全体E2Eは未完了。

続いてDocument読込の候補生成とモデル反映を`DocumentLoading`へ分離した。読込codec間の接続・版別検査・移行はdecode、リセット後のデータ反映はinstallが担当し、Sketchツリー復元・履歴・修復通知はapp側に残した。配列参照・拘束参照とcache無効化／円弧正規化の順序を保持。構文165件・単体357件・保存互換／Block／ファイル安全性／派生Instance／Sketch投影のE2E102件が成功。app.jsは21,980行。次はDocumentリセットと編集操作状態のリセットの境界を整理する。全体目標と全体E2Eは未完了。

継続指示により再開。`codex/composition-root-next`で読込後の採番復元を`DocumentSequences`へ分離した。入力を変更せず、Documentと全Definitionから予約対象と次番号を返す。Windowsのコマンド長制限に達した構文チェックは、対象161件を維持して新規2件を追加し、`tools/check-syntax.js`へ移した。構文163件・単体352件・Block／保存互換のE2E58件が成功。app.jsは22,056行で、数百行化の目標は未完了。次は読込候補の最終反映とUI復元の境界を整理する。

前回以降のSolver修正47494f0は取り込み済み。全体E2Eと航空機ドラッグの再検証はこの段階では実施しておらず、最終検証に残る。以下は一時停止時点の記録。

## 前回の一時停止地点（2026-09-21）

再開用ブランチは`codex/composition-root-next`。developの投影SketchのみのBlock配置修正（a995427）も統合した。検証は構文チェック・単体346件・Offset全10,296プレビューまで成功。全体E2Eは航空機A2/A3ドラッグで10分のタイムアウトが発生し、その後ユーザーのクレジット節約の指示により停止した。全313件の成功は未確認で、再開時にはこのタイムアウトの調査と全体検証が必要。今回はユーザー承認により残りのテストを省略してコミット・developへの統合を行う。

リファクタリング全体はユーザーの依頼で一時停止中。最後に完了した段階はDocumentGeometryPersistenceの分離で、次の着手箇所は読込結果の最終反映と採番予約の整理である。app.jsの数百行化は未完了。

Offset特異姿勢の確認は解決済み。ユーザー承認に従い局所Jacobianの判定を維持し、既知の特異姿勢でP12=完全拘束・L5=支持位置拘束を明示的に期待する回帰テストへ修正した。全体自由度7、残差、ほかの要素と前後のsampleの表示検証は維持する。以下の進捗記録にある「Offset確認未完了」は、その段階での履歴である。

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

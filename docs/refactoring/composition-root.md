# app.jsを起動・接続専用にする継続作業

再開時は先に[リファクタリング方針と再開手順](refactoring-policy-and-resume.md)を読む。本書の古い記録は当時の経過であり、現在の課題は先頭の再開地点とGitの現物を優先する。

開始点はdevelopの`457adea`。承認された最終目標は、`app.js`を数百行程度の生成・接続・起動・終了へ整理すること。部分的な抽出や中間のテスト成功をもって、この目標の完了とはしない。

## 現在の再開地点（2026-10-20）

### 最新：基本作図とプレビューの共有接続（2026-10-24、検証完了）

基準develop／origin/developは214e7a8。直前の参照画像組立て32ba943は統合・Push済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/authoring-preview-compositionで実施した。

BasicDrawingTools.createAuthoringへcreatePreviewを追加し、同じprimitive commands・Spline draft・DrawingPreviewと、外部で生成済みのCenterline commandへAuthoringPreviewRenderer／Layerを接続する。幾何libraryと最小長は同じ作図機能の依存を用い、appからcommand状態やpointer／trimを組み直して渡さない。実renderer／Layerを返し、Filletの補助描画は同じrendererの関数を使う。新しいmode・draft・preview state、可変phase参照、開始／取消・履歴は追加しない。旧factoryのAPIは維持する。

app.jsは2,574→2,565行（9行減）。対象のroot構築2→1、明示port24→7。元のLayer生成位置で両者を生成し、副作用のない早期renderer生成だけを後ろへ集約する。最初の利用である後段DimensionPreviewまでにFillet painterを接続し、Centerline生成・Lifecycle bind・Canvas描画の段階とbind／startは維持する。不要になった静的libraryの4別名とrootのSpline draft別名を除き、AST監査でroot未使用binding／追加接続の初期化前参照は0（cad-authoring-preview-audit.cjs）。

実renderer／Layerを使った2単体で、構築時の無照会、同じcommand／Spline draftと最新pointer、Centerline guard／サイズ照会例外、Filletの現在倍率を確認した。既存テストの期待は変更せず、関連単体27件・全単体1,894件・構文610ファイルが成功（cad-authoring-preview-{focused,unit,check}.log）。既存fileだけの変更で、script一覧・保存形式・UIは変えない。spec/architecture/モジュール構成.mdとimplementation-map.mdへ内部設計を追記した。

Centerline・Spline・Slot・command panel・PNG・既存UI・phase0保存互換性／描画比較の関連E2E151件が全成功（2.2分、exit 0、runner34006、cad-authoring-preview-e2e.log）。sourceを固定し、receiptのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した（cad-authoring-preview-e2e-receipt.json、cad-authoring-preview-last-run.json）。今回の全E2Eは未実行で、直前の全体基準は74a0d17の全587件成功。週枠使用2%／残量98%、停止条件未到達。mainは停止・release時の最後に反映する方針を維持し、全体目標はactiveで未完了。

次は残る構築依存と機能ownerを再監査する。previewという名前だけで異なるcommand／履歴／描画stateを一つに包まず、同じ実ownerを共有できる境界で生成・接続を整理する。小さな引数削減だけで数百行へ届くとは見積もらない。

### 最新：参照画像機能の組立て（2026-10-24、検証完了）

基準develop／origin/developはc0eba74。直前のWorkspace描画接続ad37b16は統合・Push済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/reference-image-featureで実施した。

ReferenceImageFeatureをsrc/applicationへ追加し、resource renderer→表示Layer→移動／縮尺校正Interaction→読込／clipboard Inputを同じCanvas・viewport・Selection・通知／履歴へ接続する。実renderer／Layer／Interaction／InputとPNG前のprepareImagesを返す。cache／状態／編集・履歴の実装は既存ownerに残す。表示scopeと配置先の編集scopeを別portで維持し、Layerの較正markerは同じInteractionの現在値、PNG prepareは同じrendererのcacheを使う。静的な画像座標変換は既存libraryから利用する。全app contextや可変phase参照は追加しない。

app.jsは2,585→2,574行（11行減）。対象のroot構築4→1、明示port52→32。後段のInteraction／Input生成を前段のrenderer／Layer生成時へ集約するが、全子factoryは生成時にDOM／scope／model／画像や操作callbackを読み書きせず、listenerを登録しない。Input.bindClipboardとbindControlsは元の異なる位置に残す。先に取得できないclearSnapは操作時に呼ぶ遅延callbackで接続した。最初のAST監査でその直接参照を検出して修正し、再監査でroot未使用binding／初期化前参照は0（cad-reference-image-feature-audit.cjs）。markerとdrag／校正、非同期import後のscope／権限／viewport、表示scopeとcacheの共有、bind／disposeを実componentの3単体で確認した。

構文610ファイル・全単体1,892件・関連単体25件が成功。新module／単体の明示一覧をindex.html、tools/check-syntax.js、tools/run-unit-tests.js、unified-uiのfile URL読込期待へ同期し、依存moduleの後に読込む。先行のfile URL Help／script読込E2E1件も成功（2.3秒）。参照画像・PNG・既存UI・phase0保存互換性／描画比較・Sketch権限／削除・menu・派生選択copyの関連E2E172件が全成功（2.5分、exit 0、runner33775、cad-reference-image-feature-e2e.log）。検証中はsourceを固定し、receiptのloaderCode 0／exitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した（cad-reference-image-feature-e2e-receipt.json、cad-reference-image-feature-last-run.json）。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新し、保存形式は変更しない。

今回の全E2Eは未実行。週枠使用1%／残量99%で停止条件未到達。mainは停止・release時に最後に反映する方針を維持し、全体目標はactiveで未完了。次も既存ownerと初期化段階に沿って複数の生成・接続をまとめられる境界を再監査する。小さな引数削減だけで数百行へ届くとは見積もらない。

### 最新：Workspaceと描画基盤の共有接続（2026-10-24、検証完了）

基準develop／origin/developはd815ea8。直前のCanvas周辺UI分離b8713c8は統合・Push済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/canvas-workspace-renderingで実施した。

CanvasDisplay.createWorkspaceの返却値へcreateRenderingを追加した。同じWorkspaceのCanvas・context・viewport・Surface・zoom controlと、CanvasExport rendererの現在frameを、既存の静的createRenderingへ接続する。appから渡す描画固有のportは23→17、対象3factory合計は46→40。rootの不要なzoomControl別名も除いた。初期のcreate→createWorkspace→後段のcreateRenderingという順序と、TransientAuthoringを挟む位置、各bind／startは維持する。frameは描画中に毎回既存ownerから読み、constructorで先読みしない。新たな可変phase参照・frameコピー・renderer cache・app contextはなく、旧静的APIは維持する。

app.jsは2,586→2,585行（1行減）。行数より、同じWorkspaceの描画基盤を組み合わせる責務と依存の削減を目的とする。AST監査でroot未使用bindingと追加接続の初期化前参照は0（cad-workspace-render-audit.cjs）。実componentを使い、遅延構築、同じviewport／bitmap／倍率表示／PNG frame、別Workspaceとの独立、対話→PNG→復元の描画順、例外時の既存frame／restore範囲を2単体で確認した。既存8単体は維持し、関連10件・構文608ファイル・全単体1,889件が成功。構文確認開始後のapp別名整理もnode --check app.jsで確認した。

PNG出力・Canvas zoom／選択glow・Hatch・画像・注記・既存UI・phase0保存互換性と描画比較の関連E2E182件が全成功（2.7分、exit 0、runner48093、cad-workspace-render-e2e.log）。sourceを固定し、専用receiptのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した（cad-workspace-render-e2e-receipt.json、cad-workspace-render-last-run.json）。今回の全E2Eは未実行で、直前の全体基準は74a0d17の全587件成功。週枠使用1%／残量99%で停止条件未到達。mainは停止・releaseの区切りで最後に反映する方針を維持し、全体目標はactiveで未完了。

次はroot構築の依存を再監査し、表示以外の機能単位で共有できるownerと初期化段階を確認する。小さな引数削減だけで数百行へ届くとは見積もらない。test hooks全体や巨大なcontextの移動は採用せず、Document／Blockの異なる復元scope、通常入力とPNG／command panelの違いを維持する。

### 最新：Canvas周辺UIのDOM取得責務（2026-10-24、検証完了）

基準develop／origin/developは7313e39。PointUsage接続41793b1を統合・Pushし、構文608・単体1,882件・関連E2E239件は成功済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/canvas-view-dom-ownershipで実施した。

DimensionInput.createForDocument、CanvasContextMenu.createForDocument、SketchTreeController.createWithDocumentViewへ各UI固有のDOM取得を置いた。input→shell、Canvas menu、Tree overlay→resize handleを各ownerが取得し、既存factoryへ同じ設定と実要素を渡す。寸法は実inputと既存feature、Canvas menuは実elementと既存controllerを返し、Treeは既存View／Controller／menuの実体をそのまま返す。Document入口だけがundefined時に取得し、明示要素・nullは優先する。旧create／createWithViewを変更せず、genericなSketch menuの生成や旧APIの欠損／例外／listener挙動も維持した。各component固有のoptionsだけを渡し、UI全体のDOM registryやapp contextを新設しない。

app.jsは2,591→2,586行（5行減）、対象のroot構築3→3、明示port69→65。5つのDOM取得が各View生成時へ移るが、index.htmlにある対象要素は前段factoryが置換せず、View／Controller生成・bind／start・resize listener登録／幅設定の時機と順序は維持する。未使用bindingと追加接続の初期化前参照は0。明示要素とnullの優先、欠損とlookup例外、実input／menu要素の返却と更新、遅延bind、既存Treeのresize setup順・幅変更・live scopeを5単体で確認した。Canvas menuのnullは一律inertとは仮定せず、旧controllerのstart／close／open例外を直接比較して維持し、製品bodyは変更していない。関連33件・構文608ファイル・全単体1,887件は成功（cad-view-dom-{focused,check,unit}.log）。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務とDOM取得時機を記録し、新file／script読込／保存形式は追加しない。

既存UI・寸法入力／Annotation anchor／prefix／複数寸法／Slot・Canvas menu・Sketch編集／移動／Tree削除／表示／権限／幅変更・Canvas zoom・画像・command panel／保存再読込の関連E2E238件が全成功（3.7分、cad-view-dom-e2e.log）。検証中のsourceは固定し、test-results/.last-run.jsonのpassed／failedTests空と自己起動port8799のlistener停止を確認した。runner77886は再接続時には終了済みで終了コードは再取得できず、成功件数は終端logとlast-runで確認した。今回の全E2Eは未実行で、74a0d17の全587成功を直前の全体基準として区別する。週枠は最新確認で使用1%／残量99%、停止条件未到達。以前の性能gateはSolver修正43ec1eaと74a0d17の全体検証で解消済みで、mainは各分離の途中では更新せず、停止・releaseの区切りで最後に反映する方針に従って保持する。全体目標はactiveで未完了。

次はCanvas表示のcreate／createWorkspace／createRenderingと、表示control・入力・描画の共通依存を確認する。生成段階の異なる部品を名前だけでまとめず、同じownerを共有する接続や公開portを整理する。通常入力とPNG／command panel、早期factoryとbind／startの順序の違いは維持する。
### 最新：PointUsageと幾何読取りの接続（2026-10-24、検証完了）

基準develop／origin/developは5876529。Canvas選択の二段階組立て9b9c980を統合・Pushし、構文608・単体1,880件・関連E2E268件は成功済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/point-usage-read-assemblyで実施した。

既存GeometryReadServicesの返却APIへcreatePointUsageを追加した。同じcurrentScopeとGeometryReadModelのLine／Circle／Arc／Spline readerを共有し、生成時には図形や編集中Splineの点を読まず、PointUsageの実体を返す。現在scopeの用途判定と展開図形の端点照会は統一せず、同じread窓／投影cacheと既存の無効化を使う。拘束のPoint参照判定と、編集中fit pointsのreaderだけをappから渡す。PointUsageの判定・短絡・Object同一性・例外、生成位置とCanvasHoverの生成／接続は元のままであり、hover／Spline sessionや新しいcacheをサービスへ取り込まない。

app.jsは2,594→2,591行（3行減）、root構築数はこの群1→1のまま、明示port7→2。rootの未使用bindingと追加接続の初期化前参照は0。生成時無照会、展開Block端点と通常scopeの用途判定の差、共有read窓のcache hit、同じIDのscope置換による参照更新、編集fit pointsの現在値、無効拘束の短絡と例外時無変更を2単体で確認した。関連14件・構文608ファイル・全単体1,882件は成功（cad-point-usage-read-{focused,check,unit}.log）。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と依存を記録し、新file／script読込／保存形式は追加しない。

既存UI・Spline編集／端点選択・Block・派生／Sketch投影・選択glow・Sketch権限・Hatch／コピー／履歴／保存再読込の関連E2E239件は3.5分で成功（runner80269 exit 0、自己起動port8799停止、cad-point-usage-read-e2e.log）。file URL起動も成功し、.last-run.jsonはpassed／failedTests空。実装・仕様・単体と再開資料の検証を完了し、Commit／Push・develop統合の対象とした。統合後の現在branch／HEADはGit現物を確認する。今回の全E2Eは未実行で、74a0d17の全587成功を直前の全体基準として区別する。週枠使用28%／残量72%、停止条件未到達。全体目標はactiveで未完了。

次はCanvas表示の早期DOM依存と入力／描画の組立てを確認する。DOM参照の一覧やapp全体のcallbackを別fileの大きなcontextへ移すのでなく、既存View ownerに固有の生成責任、現在値を読む時機、bind／startの順序から境界を選ぶ。
### 最新：Canvas選択の二段階組立て（2026-10-24、検証完了）

基準develop／origin/developは190adbd。Hatch読取り接続9dbfc0dを統合・Pushし、構文606・単体1,876件・関連E2E226件は成功済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/canvas-selection-assemblyで実施した。

src/application/canvas_selection_feature.jsへ初期のCanvasSelection→scope query→identity選択と、後段のSelectionHighlight→通常clearing→Document resetの組立てを集約した。初期5portと後段createPresentationの6portで同じ実ownerを共有し、hoverはPointUsage生成後の元の位置に残して後段へ渡す。Selection配列・target operands・hover／highlight・pointer・操作Sessionは既存ownerのままで、新たなstate・cache・可変phase接続・listenerは持たない。型と幾何ref／寸法照会は同じ不変libraryを共有する。rootのclearSelectionは早期identity callbackの遅延入口として保持し、生成時には操作を呼ばない。fixed state factoryより前へ通常clearingとDocument resetの生成を寄せたが、各constructorは照会・操作callback・表示更新を実行しないことを確認した。

app.jsは2,600→2,594行（6行減）、この群のroot構築6→2、明示port29→11。未使用binding・追加接続の初期化前参照は0。実部品を使い、二段階の生成時無照会、現在Selectionとscope／寸法hoverの共有、locked identityの選択→guard、通常clearがcommand本体を保持する範囲、Document resetの異なる解除範囲、snap例外のpointer解除後・Selection field解除前での停止を4単体で確認した。関連33件・構文608ファイル・全単体1,880件は成功（cad-selection-feature-{focused,check,unit}.log）。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と初期化段階を記録し、loader／単体・構文manifest／file URL読込期待も同期した。

既存UI・Sketch権限／表示／編集／移動／Tree削除・派生選択／コピー・glow・Annotation anchor・Block・command panel・保存再読込の関連E2E268件は4.2分で成功（runner41307 exit 0、自己起動port8799停止、cad-selection-feature-e2e.log）。file URL起動と読込順期待も成功し、.last-run.jsonはpassed／failedTests空。実装・仕様・loader同期・テストと再開資料の検証を完了し、Commit／Push・develop統合の対象とした。統合後の現在branch／HEADはGit現物を確認する。今回の全E2Eは未実行で、74a0d17の全587成功を直前の全体基準として区別する。週枠使用27%／残量73%、停止条件未到達。全体目標はactiveで未完了。

次はPointUsage／CanvasHoverを作る早期の幾何照会と、hit／矩形／表示側が使う実ownerの依存を確認する。今回の二段階APIへ目的なく部品を追加したり、root callback全体をcontextで渡したりせず、共有するstate／read ownerと生成段階から次の境界を選ぶ。
### 最新：Hatchと展開図形の読取り接続（2026-10-24、検証完了）

基準develop／origin/developはdf41dce。矩形選択組立て36f54c7を統合・Pushし、構文606・単体1,874件・関連E2E226件は成功済み。main／origin/mainはdf5aef2を保持する。現在はcodex/hatch-read-assemblyで作業中。

既存GeometryReadServices.createWithHatchesへHatchGeometryQueryの生成と、展開境界／実効外観との遅延接続を集約した。Hatch→Instance／Block投影→GeometryReadModel→外観の生成順を維持し、同じ実ownerをhatchesと従来の七ownerとして返す。appが各allGeometry readerを組み合わせていた相互接続は内部に収めた。Line→Circle→Arc→Splineの順序、現在Documentの数値線幅と同じDEFAULT_APPEARANCEへのfallback、後段Viewport／現在scope／Sketchの照会・計測を維持する。HatchのWeakMap／face cache、投影cache、read窓／外観memo、clear／forget／scope切替は既存ownerのままで、新たなcacheやmodel copyを持たない。外部Hatch照会を渡す既存createも維持し、file追加・読込順変更は行わない。

app.jsは2,605→2,600行（5行減）、この群のroot構築2→1、明示port19→12。rootの未使用bindingと追加接続の初期化前参照は0。新入口の生成時無照会、実際のHatch／派生Hatchの面積・source参照・境界cache・同じIDのscope置換・可視性変更、現在の線幅／Viewportとfallback／例外を2単体で検証した。初回は追加fixtureに既存Hatch仕様のseedがなく失敗したため、fixtureに正しいseedを加えて解決し、製品の仕様や計算は変更していない。関連16件・構文606ファイル・全単体1,876件は成功（cad-hatch-read-{focused,check,unit}.log）。spec/architecture/モジュール構成.mdとimplementation-map.mdへ所有境界と依存方向を記録した。

既存UI・Hatch・Block・派生／Sketch投影・画像・矩形選択／コピー・履歴・保存再読込・command panelの関連E2E226件は3.3分で成功（runner49624 exit 0、自己起動port8799停止、cad-hatch-read-e2e.log）。file URL起動・読込期待も成功し、.last-run.jsonはpassed／failedTests空。実装・仕様・単体と再開資料をこの単位でCommit／Pushし、developへ統合する区切りとする。今回の全E2Eは未実行で、74a0d17の全587成功は直前の全体基準として区別する。週枠使用26%／残量74%、停止条件未到達。全体目標はactiveで未完了。

次は早期のCanvasSelection／scope queryと、後段のhover／highlight／clear／Document resetの生成・接続を確認する。生成時期の異なるownerを巨大contextへまとめず、実際の選択と表示状態の所有、初期化段階、既存の参照・通知順から境界を選ぶ。
### 最新：矩形選択の機能組立て（2026-10-24、検証完了）

基準develop／origin/developは20fbe41。直前の拘束表示分離efcdefdを統合・Pushし、構文604・単体1,870件・関連E2E169件は成功済み。main／origin/mainはdf5aef2を保持する。現在はcodex/rectangle-selection-featureで作業中。

生成・接続の群を再監査し、RectangleSelectionQuery→通常選択適用→Instance参照元追加→SelectionRectangleをsrc/application/rectangle_selection_feature.jsへ集約した。queryと矩形Sessionの実体だけを返し、Selection／query／source command／Scope・外観・幾何・投影の既存ownerを共有する。通常選択とsource追加の判断、model編集、開始・更新・終了・reset、失敗時の解除・例外、通知・描画・履歴は各既存ownerへ残す。既存の不変な幾何計算を同じlibraryから使い、全app context／新state／model copyは追加しない。

app.jsは2,622→2,605行（17行減）、この群のroot構築4→1、明示port51→22。前段SketchProjectionFeatureのquery参照は遅延callbackのまま。instance adapterとSessionの生成をCanvas描画器の組立てより前へ寄せたが、実際の各constructorは生成時にscope／操作callback／描画／listenerを実行しないことを確認した。rootの未使用bindingと追加接続の初期化前参照は0。query・三経路・現在のscope／scale、source参照、追加選択のguard、例外の停止位置を実部品で確認する4単体を追加し、関連51件・構文606ファイル・全単体1,874件が成功。ログはcad-rectangle-feature-{focused,check,unit}.log。loader／構文・単体manifest／file URL読込期待も同期し、依存部品の後・appより前に新moduleを置いた。

bootstrap-boundary-audit.mdへ同じAST条件の再監査を記録した。root構築181→178、構築非空白1,064→1,053、test hooks440行のままで、200〜500行の最終目標は未達。Parameter群はDialog UI、計算、Document／Block別checkpointの混在を一括contextで包まず、初期化段階とportを改めて検討する。spec/architecture/モジュール構成.mdとimplementation-map.mdへ今回の所有境界・依存方向を記録した。

既存UI・Block・通常／派生／Sketch投影の矩形選択とコピー・履歴・保存再読込、Hatch・画像・command panelの関連E2E226件は3.3分で成功（runner79935 exit 0、自己起動port8799停止、cad-rectangle-feature-e2e.log）。file URL Help／読込順期待も成功し、.last-run.jsonはpassed／failedTests空。実装・仕様・再監査資料・loader同期・テストをこの単位でCommit／Pushし、developへ統合する区切りとする。今回の全E2Eは未実行で、74a0d17の全587成功は直前の全体基準として区別する。週枠使用25%／残量75%、停止条件未到達。全体目標はactiveで未完了。
### 最新：拘束コマンドのラベルと案内の接続（2026-10-24、検証完了）

基準develop／origin/developは74a0d17。前単位のConstraintEditing分離fbba968とSolver性能修正43ec1eaを統合・Pushし、全587 E2E（28.4分、exit 0）、構文604、単体1,867件の成功を確認済み。main／origin/mainはdf5aef2のまま。現在はcodex/constraint-target-feedbackで次の責務分離を実施中。

ConstraintControlsView.createFeedbackへconstraintLabel／constraintTargetHint／invalidConstraintTargetHintを集約した。ConstraintFeedbackはDOMを参照しないformatterという既存契約を保つため、ボタンの表示値読取りとSession／言語の接続は元のControls Viewが所有し、文面生成は同じConstraintFeedbackに委譲する。同じbutton配列・formatterと二reader、applicationTextの五portだけを受け、生成時照会・listener・DOM書込み・Session／Selectionの複製や更新を持たない。fixedの短絡、先頭一致とdataset.label→title→typeのtruthy fallback、最新operand→言語→必要時だけlabelの順序、receiver・返却値・参照・例外を維持した。appでは三入口を最初に直接使うConstraintEditing.createより前に生成し、旧hoisted宣言をconstへ移す際の初期化前参照を避けた。

app.jsは2,627→2,622行（5行減）。既存二moduleの責務境界を使い、新file／script読込／global state／保存形式を追加しない。spec/architecture/モジュール構成.mdとimplementation-map.mdへ所有境界と初期化順を記録した。Controls Viewの単体を3件追加し、現在値への追従、固定の短絡、fallback、元operand参照、遅延label、例外の停止順と委譲receiverを検証。関連単体20件・構文604ファイル・全単体1,870件が成功した（cad-target-feedback-{focused,check,unit}.log）。

既存UI・Annotation anchor・拘束メニュー・複数寸法・prefix・slot寸法の関連E2E169件は2.7分で成功（runner7701 exit 0、自己起動port8799停止、cad-target-feedback-e2e.log）。AST監査でもrootの未使用bindingなし、追加接続の初期化前参照なし。明示portは既存ConstraintEditingの50に表示接続の5を追加し、責務をUI ownerへ移した。実装・仕様・テストをこの単位でCommit／Pushし、developへ統合する区切りとする。前単位の全587成功を今回の全体検証とは扱わない。週枠使用24%／残量76%、停止条件未到達。全体目標はactiveで未完了。

次は最新appの構築・接続の群を再監査する。小関数の移動だけで数百行へ届くとは見積もらず、既存ownerを共有する機能の組立て、初期化とbind／startの段階、test hooksの公開境界を、依存portと生成順を明示して検討する。単なる一括移動・巨大context・state複製は採用しない。
### 最新：機体ドラッグのprofileに基づく行列アクセス削減（2026-10-24、検証完了）

直前のCholeskyだけの候補は機体E2Eが600,000ms timeoutで失敗（10.1分、exit 1）。runner38131は終了しport8799も停止済み、後続の全E2Eは起動していない。電源接続はユーザーから報告を受けたが、電源状態を原因とは断定しない。この時点ではmain／developへの統合を保留した。最終の検証結果は以下のとおり。

実際のA2／A3・fraction .2／.8の遅い反復120 previewをCPU profileし、最大hotspotがreducedRowEchelonとredundancyのaddIndependentRowであることを確認した。各操作は成功し、30 previewの所要時間は4.9〜8.2秒。診断は一時directoryのcad-aircraft-path-profile.cjs／.logとcad-aircraft-path.cpuprofile、runner13791はexit 0で自己起動port8798停止済み。

Solverだけに、行簡約の走査行／pivot行のローカル参照と疎な基底entryの添字アクセスを追加した。pivotの探索順・同値の扱い、積和・減算の順序、二回の再直交化、ゼロ／非有限値の演算、閾値を変えない。旧fbba968と候補の行簡約を10,000行列でdeep比較しbitwise一致（入力不変も確認）。代表200×256行列4回は旧86.4→新45.4msであり、全体速度の保証ではない。診断はcad-rank-access-differential.cjs。構文604・全単体1,867件はexit 0（cad-rank-access-{check,unit}.log）。app.jsは2,627→2,627行（0行差）。

旧Solver sourceを実配信するrouteをassertした実ブラウザ比較は成功（runner94275 exit 0、port8798停止、cad-rank-access-browser.cjs／.log／-records.json）。拘束状態と120 preview、保存modelが一致。代表4操作の合計は旧31.294→新21.406秒、状態照会3回は旧214.5〜221.9→新141.8〜168.3ms。未変更の機体E2Eは8.9分で成功（1 passed、1,872 preview、failures空、maximumMs=288.9）。fixture・timeout600,000ms・期待値は維持した。ログはcad-rank-access-aircraft.log、結果はcad-rank-access-aircraft-results。続けて同じrunner1441／自己起動port8799で全587 E2Eを実行した（cad-rank-access-e2e-full.log）。全587 E2Eは28.4分で成功（exit 0、runner1441終了、.last-run.jsonはpassed／failedTests空、自己起動port8799停止を確認）。フィレット3,744 preview（33.3秒）、Offset10,296 preview（2.7分）、機体1,872 preview（8.9分）もfailures空。機体は単独・全体の両実行で600,000ms以内に成功した。この性能修正は責務分離checkpoint fbba968とは別の論理的commitとしてCommit／Pushし、両変更をdevelopへ統合する区切りとする。mainは停止／release checkpointまで保持し、通常の分離途中で自動反映しない。経過時間とsavedAtのみ比較対象外とし、期待値・ケース数・timeoutは緩和しない。全検証が成功したため、developへの統合後に次の責務分離へ進める。週枠使用23%／残量77%、停止条件未到達。作業branch checkpoint fbba968、develop1592058、main df5aef2、追加差分はSolver／unit／仕様と本資料だけである。
性能対策後の次単位はConstraintFeedbackへの拘束label／hintの集約を検討する。現物ではconstraintLabel／constraintTargetHint／invalidConstraintTargetHintをConstraintEditing.create（現在1481行）が直接捕捉し、三関数の宣言はその後にある。constへ置換して同じ場所に残すと初期化前参照になるため、最初の直接利用より前で生成する必要がある。constraintButtonsは783行、target sessionは338行で準備済み。固定labelの短絡、dataset.label→title→typeのtruthy fallback、操作時の最新dataset／言語／operandの読取り、汎用hintでだけlabelを読む順序、例外の伝播を維持する。新たな状態複製やDOM listenerを持たせず、既存ownerに狭い読取りportを渡す。これはまだ実装していない。

### 経過：SolverのCholesky先頭ゼロ部分の省略（2026-10-24、旧候補）

作業branch codex/constraint-editing-assemblyのcheckpoint fbba968から、既存の機体E2E timeoutの性能対策を別の論理的変更として実施中。develop／origin/developは1592058、main／origin/mainはdf5aef2で、統合は保留する。src/solver/constraint_solver.jsのsolveDampedLeastSquaresで、Cholesky入力行の最初の非ゼロ列を記録し、二行の先頭ゼロ部分の積だけを省略する。fill-inはこの先頭より左には生じないため、残る積・減算の順序を変更しない。非有限の入力行列では旧dense範囲に戻し、正定性判定1e-12・QR fallback・減衰・許容誤差・反復回数を維持する。app.jsは2,627→2,627行（0行差）。UI・操作・保存形式は変更しない。

旧fbba968のprivate methodと候補を抽出した一時診断で20,000組の結果をObject.isで比較し一致。疎／密・不連結／rank不足、ゼロ減衰／負減衰、非常に大きい／小さい値と非有限値を含め、null判定も一致した。一時診断はcad-cholesky-prefix-{differential,same-realm,extremes}.cjs／.log。初回のVM内microbenchmarkは遅く出たため、それだけで採否を決めず同一realmと実ブラウザで比較した。同一realmの帯行列3回ではn=128が旧3.65→新1.17ms、n=256が旧6.08→新1.39ms。特定matrixの数値であり一般的な速度保証とはしない。

実ブラウザの同一機体fixtureで旧Solverだけをroute差替えし、旧source配信1回をassertして比較した。拘束状態3回、9 previewの全計算値・最終図形・保存modelが一致し、除外はelapsedMsとsavedAtのみ。照会前後のmodel不変も確認した。旧照会174.3〜192.2ms、新152.2〜160.7ms。一時診断はcad-cholesky-prefix-browser.cjs／.log／-browser-records.json。

geometry-solverの追加2件は公開solveCoreから、不連結な線形blockと変数順の入替え、元のゼロ箇所に必要なfill-inを保つ一意解、undampedな特異系のQR fallbackと有限解を確認する。private APIを公開せず既存の形状／drag検証を維持した。構文604ファイル・全単体1,867件・関連単体46件が成功。ログはcad-cholesky-prefix-{focused,check,unit}.log。

この旧候補の機体E2Eはtimeoutで終了し、後続の全E2Eは起動しなかった（tool session38131終了、自己起動port8799停止）。最終候補の結果は上節を参照。baselineのNode hookは適用せず、fixture・timeout600,000ms・期待値も変更しない。観測が途切れても同じhandle／実processを確認し、終了を確認せず重複起動しない。ログはcad-cholesky-prefix-aircraft.logと-e2e-full.log、機体の結果directoryは一時directoryのcad-cholesky-prefix-aircraft-results。この旧候補だけでは全E2E成功を確認できず、profileに基づく上節の追加対策へ進んだ。

修正の計算方法はspec/calculation/拘束と依存更新.mdへ記録した。Source構築のcheckpointはfbba968、現在の追加実装はSolver／対応unit／仕様・再開資料だけ。性能検証を通すためのテスト緩和やケース削除は行わない。性能問題が解決するまで新しい責務分離は止め、ConstraintFeedbackのlabel／hint移管は後続候補として残す。全体目標はactiveのまま。
### 最新：拘束照会・対象指定・寸法配置の組立て（2026-10-23）

基準develop 1592058からcodex/constraint-editing-assemblyで実施。src/application/constraint_editing.jsへConstraintSelectionQuery→ConstraintTargetCommand→DimensionPlacementCommandの生成・接続を集めた。同じSelection／target session・pending、Lifecycleと値入力Controllerを共有し、返すのは実際の三owner。型別の実操作・求解・履歴・復元は既存commandに残し、model／session／rollbackやapp contextを追加しない。

app.jsは2,645→2,627行（18行減）、この群のroot構築3→1、明示引数78→50。現在active Sketchのcreate guard→Selectionのconstraint guardを同じ関数で短絡評価し、二つの元のguardの戻り値・例外を保持する。通常拘束開始／取消と寸法開始の準備は別々のLifecycleメソッドのまま。queryの能力／現在選択照会と、targetから寸法配置・値入力への進行、寸法からtarget取消への接続はowner間のcallbackへまとめ、同じreceiver・引数境界・戻り値・例外を維持した。

元の三つの構築の間はfunction宣言だけで、実際の構築順序は維持した。constructorはこれらの操作callbackを呼ばず、データを先読みしない。appに残るhoistedな公開入口と、後段ConstraintIntentResolver／ConstraintCommitCommandへの既存接続は保持する。移管後に参照0になったprivate canCompleteConstraintCommandだけを除去し、残るrootの自己外参照なしbindingは0、直接引数を含む初期化前参照0をAST監査した。一時診断はcad-constraint-editing-audit.cjs。旧appと新moduleのASTで三childへ渡す全property key集合が一致することも確認し、子の依存契約を欠落させていない。

新moduleは三child scriptの後へ配置し、index.html／構文一覧／unit一覧／file URL Helpのscript期待値・namespace確認を同期した。構文604ファイル・全単体1,865件・関連単体37件・file URL Help読込1件が成功。追加3件で実owner／session／Selection／pending readerの同一性、別々のLifecycle／入力callback、起動時の遅延参照、開始guardの現在Sketch・評価順／短絡／戻り値・例外、交差callbackの引数数・receiverと元の例外を確認した。既存三childの振る舞いテストも維持する。

旧1592058のindex／appを実際に差し替え、両route利用と旧版に新namespaceがないことをassertしたブラウザ比較で125状態が一致。model・clipboard・mode・履歴・Selection・Hint・command panel・寸法／注記入力・drag中classとAPI204 key順に加え、拘束対象の順序／kind／endpointとcommand種別を比較した。savedAtだけ除外。寸法対象選択→preview→配置→値確定、円弧端点の水平拘束、同種toggle取消、Undo／Redoを追加し、以前の注記／コピー／削除・再読込も含む。一時診断はcad-constraint-editing-equivalence.cjs／.log。

全E2E587件は586件成功・1件失敗で終了（32.9分、exit 1）。機体A2／A3（constraint-drag-regressions.spec.js:92）が600,000msでtimeoutし、stackはload後のconstraintStatusesForTest照会（同file:14）を示す。図形・拘束結果の不一致とは未確定。runner44536終了と自己起動port8796のserver停止を回収した。完了扱い・Commit／Push・main反映は保留。全体のlast-runとerror-contextは一時directoryのcad-constraint-editing-full-last-run.json／-aircraft-full-error-context.mdへ保全した。閾値や期待値は緩和しない。ログはcad-constraint-editing-{focused,check,unit,loader,e2e-full}.log。UI期待値・性能上限・timeout・保存versionは変更しない。前単位の関連317件とreleaseの全587件を今回の検証へ代用しない。

変更前1592058のindex／appをpage routeで配信するNode hookを一時directoryに準備した。他source・図面・テストは同refから差がなく、fixtureもtimeoutも変更しない。既存の短いreloadテスト1件でsource配信を検証（1.5秒、exit 0）し、両routeの実配信と旧sourceのSHA256をprovenance JSONへ記録した。同じ機体テストの単独実行でも600,000ms timeoutが再現（10.1分、exit 1）。96通り中92通りのdrag呼出し終了までprogress記録がある。全体検証と同時には動かしていない。Node側に操作所要時間だけを記録し、browser内のmodel／測定値は変更していない。session59956は終了済み。診断はcad-constraint-editing-baseline-{hook.cjs,sources.json,preflight.log,aircraft.log,provenance-*.json,progress-*.jsonl}。追加のCPU診断（cad-constraint-analysis-profile.cjs／.log／.cpuprofile）では照会235.2ms、stable／freeDof=2、model不変を確認。Jacobian・nullspace／Damped least squares・redundancyが時間を使う。

main／origin/mainはdf5aef2、develop／origin/developは1592058のまま。週枠は開始使用17%／残量83%、診断後使用21%／残量79%で停止条件未到達。責務分離は作業branchだけへcheckpoint Commit／Pushし、既存timeoutの性能問題を別の論理的なcommitとして調査・修正する。全検証の成功までdevelop／mainへの統合は保留し、目標はactiveのまま継続する。次はprofileのhotspotと実matrixの疎性を確認し、式・許容誤差・fallback・図形結果を変えない計算の省略だけで改善できるか調べる。Choleskyの先頭zero prefixなどを候補とし、採用前に旧計算とのbitwise比較・代表matrix benchmark・既存Solver検証で判断する。テストのtimeoutや期待値は緩和しない。次のSolver変更後にbaselineを再実行する場合、旧app／indexの二つだけでなく変更したSolver sourceも旧refへ固定すること。ConstraintFeedbackへのUI label／hint集約は性能問題解決後へ延期する。性能修正の実装はまだ行っていない。
### 最新：通常注記ドラッグの生成・接続（2026-10-23）

基準develop 33832ecからcodex/annotation-drag-assemblyで実施。既存AnnotationFeature.createDragへ通常AnnotationDragの生成、共有renderer／materialization・Selection・通知／履歴の接続と現在editing scopeのID照会を集めた。実drag ownerを返し、session／resize handle状態は既存AnnotationDragだけに残す。pointer開始／終了・外観resize・拘束付きbegin callbackは同じ関数をそのまま渡し、DOM操作の順序や例外を変えるwrapperを加えない。新file／folder／scriptやモデル・履歴の複製は追加しない。

app.jsは2,652→2,645行（7行減）、該当生成のroot引数15→4。IDが偽値ならscopeを読まずnullを返し、正の照会では現在editing scopeを毎回読む。Workspace.currentによるインライン編集の照会と区別し、編集許可には注記自身のsketchIdを直接渡す。早期のAnnotationDrag.createConstrainedとSolveScopeQueryのscope／additionalVariables接続は維持した。pointer capture→class追加の順、class除去→release試行と例外抑制、後段appearanceEditingによるresizeはapp側の既存callbackのまま。

構文602ファイル・全単体1,862件・関連単体21件・file URL Help読込1件が成功。追加2件で実drag ownerとrenderer／materialization／Selection／操作callbackの共有、初期化時にdragを生成しないこと、偽値IDの短絡・scope切替後の参照同一性と未検出null、raw sketch IDのguardを検証した。自己外参照なしroot bindingは0、直接引数を含む初期化前参照0をAST監査した。一時診断はcad-annotation-drag-assembly-audit.cjs。

旧33832ecのindex／app／Featureを差し替え、全route利用と旧factoryにcreateDragがないことを確認したブラウザ比較で110状態が一致。model・clipboard・mode・履歴・Selection・Hint・command panel・寸法入力／注記textareaとAPI204 key順に加え、drag中classも比較した。本文移動・frameリサイズ・Leader端点の開始／移動／確定、Undo／Redo・再読込を含み、savedAtだけ除外する。

最初の追加診断は旧版でframe開始の前提を満たさず停止。既存E2Eと同じ基準点right-top／paddingと注記選択をfixtureに明示し、frame-enable→frameをassertした。次の診断はUndo／Redo後のProperties未選択でattachボタンを取得できず旧版で停止したため、既存UIのTreeから再選択する手順を追加した。製品側は変更せず、診断の既定値・選択前提を修正した。初回／一回目修正はcad-annotation-drag-assembly-equivalence{,-corrected}.log、成功した最終比較は-equivalence-selected.cjs／.logに残す。関連E2Eとは結果を区別し、失敗を上書きして通過扱いにしない。

関連E2E15ファイル317件が全成功（5.7分、exit 0）。runner終了と自己起動port8795のserver停止を確認済み。Commit／Pushしてdevelopへ統合し、検証済みsourceとのtree同一性を確認する。ログはcad-annotation-drag-assembly-{focused,check,unit,loader,e2e}.log。UI期待値・性能上限・timeout・保存versionは変更せず、最新全E2Eは未実行。前単位の317件やrelease587件を今回の全体検証に代用しない。

main／origin/mainはdf5aef2のまま。週枠は開始使用16%／残量84%、検証後使用17%／残量83%で新たな分離の停止条件未到達。次はConstraintSelectionQuery・ConstraintTargetCommand・DimensionPlacementCommandの生成・接続を監査する。共有Selection／target session・pending／operand values、二つの開始guard、現在選択の照会とcommand確定の境界を確認する。初期化順・hoisted入口、注記拘束への振分けと特殊寸法の継続、取消・初回寸法・権限拒否の意味を維持し、単に広いapp contextへ包む変更にはしない。早期のConstrained注記ownerを無理に後段へ移すことはしない。次単位の実装はまだ行っていない。
### 最新：既存注記の編集UIと本文確定（2026-10-23）

基準develop 5c51921からcodex/annotation-text-editingで実施。AnnotationFeature.createEditorへAnnotationParameterCommandとAnnotationInputControllerの後段生成・接続、開始準備／選択・layout解決を集約した。通常本文の代入→履歴記録とParameter式への分岐は既存AnnotationCommand.createTextEditingへ移管し、application／UIがモデル更新を再実装しない構成にした。返す実ControllerとParameter commit関数は既存の呼出し先へそのまま渡す。新しいfile／folder／script、model／pending／履歴の複製を追加しない。

app.jsは2,668→2,652行（16行減）、この群のroot構築2→1、明示引数25→11。textareaの生成・append・bindは従来の位置に維持し、最初のAnnotationFeature生成時には行わない。作図終了→拘束対象取消→pending取消→drag resetと、選択解除→注記選択の順序、guardを先に読む投影拒否、Workspace.currentのfindと現在Parameter namespaceの読取りを維持した。layout優先とtext／Leader metrics fallback、元boxを変更しない画面font size計算、Parameter編集時の全Sketch安定化とsnapshot復元、通常本文の履歴例外時に新たなrollbackを行わない境界も保持する。後段annotationDrag.resetは遅延callbackのまま。

構文602ファイル・全単体1,860件・関連単体19件・file URL Help読込1件が成功。追加4件で本文／式の履歴と結果・例外、実child／commit関数とpending readerの共有、現在Workspace／Parameter namespace、準備順・投影guard、倍率とlayout fallbackを検証した。新テスト初回のSelection配列比較はVMとhostのArray prototype差で失敗したため、順序・個数・各要素の参照同一性を個別にassertして修正した。製品の挙動や期待する選択結果は変更していない。初回はcad-annotation-editor-focused.log、修正後は-focused-corrected.log。

rootの自己外参照なしbindingは0、直接引数を含む初期化前参照0をAST監査した。一時診断はcad-annotation-editor-audit.cjs。既存scriptから追加本文確定入口をfile URLで確認する。旧5c51921のindex／app／Feature／AnnotationCommandの四つを実際に差し替え、全route利用と旧版に追加入口がないことをassertしたブラウザ比較で91状態が一致した。model・clipboard・mode・履歴・Selection・Hint・command panel・寸法入力に加え、注記textareaの値／表示／検証／行数／式表示／aria-label／styleとAPI204 key順を比較し、savedAtだけ除外した。本文編集・取消・Undo／Redoと、LeaderのParameter式の拒否・訂正・確定・再読込を含む。診断はcad-annotation-editor-equivalence.cjs／.log。

関連E2E15ファイル317件が全成功（4.9分、exit 0）。runner終了と自己起動port8794のserver停止を確認した。Commit／Pushしてdevelopへ統合し、検証済みsourceとのtree同一性を確認する。ログはcad-annotation-editor-{check,unit,loader,e2e}.log。UI期待値・性能上限・timeout・保存versionは変更せず、最新全E2Eは未実行。以前の304件やrelease587件を今回の全体検証へ代用しない。

main／origin/mainはdf5aef2のまま。週枠は開始使用15%／残量85%で新たな分離の停止条件未到達。次は通常AnnotationDragの生成とannotationById照会の境界を監査する。constrained版のscope／additionalVariablesは早期のSolveScopeQuery生成へ渡しており、全てを後段へ単純移動できない。早期のConstrained ownerと後段の通常drag sessionを共有したまま、Featureの実renderer／materialization・Selectionを用いて接続を減らせるか確認する。pointer capture／class表示、後段appearanceEditingによるresize、求解失敗時の復元と各scopeの違いを先に追う。次単位の実装はまだ行っていない。
### 最新：寸法値編集と特殊寸法支援の生成（2026-10-23）

基準develop 2be5478からcodex/dimension-value-assemblyで実施。既存DimensionValueCommandにcreateWithEditingSupportを追加し、createEditingSupport→createの生成・接続を同じownerへ集約した。共通の式評価／対象解決／エラー通知／履歴を一度だけ受け取り、同じ関数と実Selection／特殊操作ownerを渡す。返すのは実際の値編集commandであり、新たなwrapper state／model／pending／rollbackを持たない。app全体のcontextを渡す変更ではなく、両既存factoryの限定された編集依存を共有する。新しいfile／folder／scriptは追加しない。

app.jsは2,671→2,668行（3行減）、この群のroot構築2→1、明示引数45→38（旧側のsupport spreadも一項として数える）。依存の重複を減らす単位であり、38項の構築がまだ大きいことと200〜500行の全体目標が未完了であることを隠さない。最初の寸法のfootprint取得／復元、通常寸法のsnapshot復元、入力Controllerの接続は現在の呼出し側・ownerに残す。後段dimensionDrag.resetは遅延callbackのまま。既存create／createEditingSupportの本体は改行形式を揃えたAST範囲比較で一致し、旧公開APIも維持した。最初の文字列比較はGitと作業treeのCRLF／LF差で不一致だったため、改行だけ正規化して確認した。

自己外参照なしroot bindingは0、直接引数を含めた初期化前参照0をAST監査。一時診断はcad-dimension-value-audit.cjs。新たなscript登録は不要で、file URL Helpでは既存scriptから追加入口を確認する。UI期待値・性能上限・timeout・保存versionは変更していない。

構文602ファイル・全単体1,856件・関連単体18件・file URL Help読込1件が成功。追加2件で新しい生成入口から通常寸法の求解失敗時の式復元／入力保持・最初の寸法のscale→挿入→画面復元を確認し、特殊寸法の成功／拒否と同じpendingの保持、現在Parameter名前空間と符号付き角度の評価、履歴の重複がないことを確認した。既存の個別factoryテストも引き続き実行する。

旧2be5478のindex／app／DimensionValueCommandの三つを実際に差し替え、旧版に追加入口がないことと全route利用をassertしたブラウザ比較では、77状態でmodel・clipboard・mode・履歴・Selection・Hint・command panel・寸法入力欄の値／表示／検証状態／配置style／式highlightとAPI204 key順が一致した。savedAtだけ除外。一時診断はcad-dimension-value-equivalence.cjs／.log。

関連E2E14ファイル304件が全成功（4.8分、exit 0）。通常寸法の13fileにfree-instanceを追加し、派生Instance／角度間隔・注記基準点・Propertiesと求解を含めて確認した。runner終了と自己起動port8793のserver停止を確認済み。Commit／Pushしてdevelopへ統合し、検証済みsourceとのtree同一性を確認する。ログはcad-dimension-value-{focused,check,unit,loader,e2e}.log。最新全E2Eは未実行で、前単位282件やrelease587件を今回の全体検証に代用しない。

main／origin/mainはdf5aef2のまま。週枠は開始使用14%／残量86%、検証後使用15%／残量85%で新たな分離の停止条件未到達。次はappに残るAnnotationInputControllerの組立てを監査する。AnnotationFeatureの生成段階と既存注記の編集開始段階を区別し、textarea生成・bindの時機、準備取消とSelection、layout／metrics fallbackと画面font size、通常本文のmodel更新・履歴とParameter確定の責務境界を確認する。UIやapplication組立てへmodel変更を移さず、既存command ownerを使う方針で検討する。次単位の実装はまだ行っていない。
### 最新：寸法入力UIの生成・接続（2026-10-23）

基準develop b1c8bb9からcodex/dimension-input-assemblyで実施。src/application/dimension_input.jsへDimensionInputView／Controllerの生成、共有DimensionDisplayのlayout／placement／label offset、現在viewport倍率、後段の入力bindを接続する責務を集約した。入力表示と操作をDimensionDisplayへ混在させず、同じ実ControllerをOffset／Fillet／寸法編集／KeyboardInputへ公開する。pending sessionのreaderをそのまま使い、新たなbuffer／モデル／履歴／rollbackを追加しない。app.jsは2,675→2,671行（4行減）、この群のroot構築2→1、明示引数25→20。行数のための圧縮や全体目標の完了とは扱わない。

View生成後にControllerを生成する順序を維持し、生成段階にDOM bindやscope読取りを追加しない。appに残るplacement／layoutsの分解は凍結された通常propertyの取得のみであり、入力の生成時機との入替えに副作用はない。Canvas bindの後で入力をbindする順序、focusのframe予約、現在倍率と最新pendingの再読取り、Offset／Distance確定の後段callback、共用hoisted layout入口を維持した。自己外参照なしroot bindingは0、直接引数を含めた初期化前参照0をAST監査した。一時診断はcad-dimension-input-audit.cjs。

classic scriptを入力View／ControllerとDimensionMetricsの後に登録し、index.html／構文一覧／file URL Helpのscript期待値とnamespace確認／unit一覧を同期した。初回の一時script順診断はMetricsより前の登録を検出したため、定義時には実行されない依存も含めて読込み順を整理し、再監査した。既存UI期待値・timeout・性能上限・保存versionは変更しない。

構文602ファイル・全単体1,854件・関連単体14件・file URL Help読込1件が成功。追加3件は実View／ControllerとFeatureを組み合わせ、bind前にイベントがないこと、古いpendingを捕捉せず現在objectを編集すること、Offset／Distance別確定、遅延focus時の倍率／所有Sketch／符号付き角度の検証、入力要素なしのCanvasキー経路を確認した。

旧b1c8bb9のindex／appを実際に差し替えたブラウザ比較では、両route利用と旧版に新DimensionInputがないことをassertし、77状態でmodel・clipboard・mode・履歴・Selection・Hint・command panel・寸法入力欄の値／表示／検証状態／配置style／式highlightとAPI204 key順が一致した。savedAtだけ除外。式の不正／拒否／取消／確定、Offsetのpreview／不正値／確定、Undo／Redoを含む。一時診断はcad-dimension-input-equivalence.cjs／.log。

関連E2E13ファイル282件が全成功（4.5分、exit 0）。file URL loader→旧版比較→関連E2Eの順に実行し、runner終了と自己起動port8792のserver停止を確認した。作業branchをCommit／Pushしてdevelopへ統合し、検証済みsourceとのtree同一性を確認する。ログはcad-dimension-input-{focused,check,unit,loader,e2e}.log。最新全E2Eは未実行。以前の全587件や前単位317件を今回の全体検証に代用しない。

main／origin/mainはdf5aef2のまま。週枠は開始使用13%／残量87%、検証後使用14%／残量86%で新たな分離の停止条件未到達。次はDimensionValueCommand.createEditingSupportとcreateの生成・接続を監査する。特殊寸法／注記の既存ownerを維持し、共通する式評価・pending・入力Controller・履歴の依存を減らせるか確認する。初回寸法の画面範囲復元、求解失敗のsnapshot復元と特殊寸法の扱い、後段dimensionDragの遅延参照を先に追う。次単位の実装はまだ行っていない。
### 最新：注記機能の生成・接続と基準点開始の所有（2026-10-23）

基準develop 5c68decからcodex/annotation-feature-assemblyで実施。src/application/annotation_feature.jsへAnnotationDisplay→Materialization→基準点操作→表示用dimensions→AnnotationCommandの生成・接続を集めた。表示／draft／履歴／WeakMapは同じ実childに残し、Featureは必要な入口と実childを返す。巨大context、複製model／session、独自rollbackを追加しない。app.jsは2,711→2,675行（36行減）、この群のroot構築5→1、明示引数76→48。200〜500行の全体目標は未完了である。

startAnnotationAnchorConstraintの対象取得・対象数検査・同種toggle取消は既存AnnotationAnchorConstraints.startFromSelectionへ集約し、UI既定候補はFeatureに残した。注記が一つなら混在選択でも既定候補になる入口と、全選択数一つだけを許す既存startの既定候補を混同しない。取消前にoperandsをコピーし、pending取消の例外なら現在command／draftを保持する。基準点編集と配置の投影guardの評価順も維持した。Workspace.currentと現在editing scopeを区別し、Parameter名候補の浅いコピーとensure後のscope再読取り、dimension表示の二回のscope読取り・実entriesを保持した。

previewと後段AnnotationDrag／appearanceEditingは遅延callbackのままとし、早期のAnnotationSpatialQueryに渡すhoistedなannotationPlacementAnchorをappへ残した。rootの自己外参照なしbindingが0、直接引数も含めた初期化前参照0とchild script順をAST監査した。一時診断はcad-annotation-feature-audit.cjs。classic script追加に合わせindex.html、check-syntax、unit登録、file URL Helpのscript期待値とnamespace確認を同期した。

構文600ファイル・全単体1,851件・関連単体33件・file URL Help読込1件が成功。追加6件で生成時の遅延参照、実child／receiver、混在選択、取消例外時のstate保持、対象コピー、最新scopeと浅いコピー境界を検証した。新しいrenderer模擬がsloppy modeでthisをglobalへ変換していた初回単体失敗は、fixtureを製品と同じstrict modeにして修正した。製品側の呼出し方や既存期待値を変更して通したものではない。

旧5c68decのindex／app／基準点commandを差し替え、旧版にFeatureがないことと三つのroute利用をassertしたブラウザ比較で62状態が一致。注記の作成・連続配置・Parameter名／式・Leader・基準点開始／toggle取消、Sketch間copy／pasteと参照ID、削除、Undo／Redo・再読込を含み、model・clipboard・mode・履歴・Selection・Hint・command panel表示／入力値とAPI204 key順を比較した。除外はsavedAtのみ。一時診断はcad-annotation-feature-equivalence.cjs／.log。

関連E2E15ファイル317件が全成功（5.2分）。Playwrightの最終status=passed／failedTests=[]とrunner終了、自己起動port8791のserver停止を確認した。作業branchをCommit／Pushしてdevelopへ統合し、検証済みsourceとのtree同一性を確認する。ログはcad-annotation-feature-{focused,check,unit,loader,e2e}.log。最新の全E2Eは未実行で、以前のrelease全587件を今回の結果に代用しない。既存UI期待値・性能上限・timeout・保存versionを変更しない。

ユーザーから電源接続の報告を受けた。以前のbaseline／candidate双方の実行時間変動に影響した可能性はあるが、原因の確定とは扱わない。main／origin/mainはdf5aef2のまま。週枠使用12%／残量88%で新規分離の停止条件未到達。

次はDimensionInputView／ControllerとDimensionDisplayの境界を監査する。既存表示ownerに入力の確定／取消まで押し込まず、viewと入力操作の接続を独立した責務として減らせるか、DOM bind／初期化時照会とOffset／Distanceの後段callback、実際のplacement／layouts共有、hoisted layout入口を先に確認する。次単位の実装はまだ行っていない。
### 最新：注記の保存値を操作から分離（2026-10-23）

基準develop 4b3f726からcodex/annotation-anchor-dataで実施。src/document/annotation_anchor_data.js（31行）へ基準点・関係の軸／拘束数・normalize／refs／参照依存照会を集め、AnnotationDataとBlockSelectionQuery／ClipboardPayload／SketchMoveのデータ読取りをこのownerへ直接接続した。document／editingのこれらの処理からAnnotationAnchorConstraintsへの依存を除去した。appの依存照会aliasもデータownerへ接続する。AnnotationAnchorConstraintsにはUI日本語labelと位置解決／一時Geometry／操作draft／表示用寸法の所有を残し、既存の六つのデータAPIは同じ配列／関数を再公開する。独自model／cache／context、複製したルールやsetterを追加しない。

app.jsは2,711→2,711行（0行差）。今回は逆向きのデータ→command依存を除き、保存形式を操作・Solver・DOMなしで検証できる境界を作る単位であり、行数削減や200〜500行の全体目標の完了とは扱わない。command fileは252→227行。新data moduleの7宣言と残るcommandの7宣言は4b3f726の本体と一致することをASTで確認した。normalizeの適否、数値変換、dimensionのJSONコピー、refsの順序・短絡、AnnotationDataのfield順と検査失敗前の途中反映を保持した。

新しいclassic scriptをGeometryRefの後／AnnotationData・操作ownerの前へ追加し、index.html、tools/check-syntax.js、tools/run-unit-tests.js、unified-uiのfile URL script期待値／API確認を同期。CommandPanelの単体fixtureは新しいデータ定義も読込み、期待動作は変更していない。構文598ファイル・全単体1,845件・関連単体58件・file URL Help読込1件（2.5秒）が成功。追加3件でcommand／Solverへアクセスすると失敗するdata-only contextから保存／再読込・編集object identity・不正関係の例外と途中反映を確認し、既存command公開APIが同じ配列／関数を共有することも確認した。

旧4b3f726のnormalizer／refs／AnnotationDataと現在data-only実装の18,000組で、結果・保存JSON・例外message・失敗時の入力stateまで一致した。補助診断は一時directoryのcad-anchor-data-audit.cjs。ブラウザ比較ではappだけでなく旧index・command・AnnotationData・三つのediting moduleの計7fileを差し替えたことと、旧版には新Data namespaceがないことをassert。注記付き図形のSketch間copy→pasteの参照ID張替えとBlock候補の拒否／受入、削除・Undo／Redo・再読込を含む47状態でmodel・clipboard・mode・履歴・Selection・HintとAPI204 key順が一致した（savedAtだけ除外）。診断はcad-anchor-data-equivalence.cjs／.log。

関連E2E13ファイル304件が全成功（5.1分、exit 0）。前単位の12fileにsketch-move全8件を加え、annotation-anchors／annotation-display-size／unified-annotations／blocks／derived-patterns／free-instance／parameter-dialog-controller／phase0-characterization／sketch-edit／sketch-permissions／spline／unified-uiと合わせて検証。全runnerの終了と自己起動port8790のserver停止を回収した。ログはcad-anchor-data-{focused,check,unit,loader,e2e}.log。最新全E2Eは未実行で、以前の305件やreleaseの587全成功を今回の全体検証に代用しない。テストの既存UI期待値・性能制限・timeout・保存versionは変更していない。

仕様と実装mapを更新し、作業branchをCommit／Pushしてdevelopへ統合し、tree同一性を確認する。main／origin/mainはdf5aef2のまま。週枠は開始使用8%／残量92%、検証後使用10%／残量90%で停止条件未到達。検証後の変更は本記録を含む文書だけとし、停止条件に達した区切りで最新の全体検証・main反映とdevelop同期を行う。

次は通常機能の生成・接続へ戻り、AnnotationDisplay→Materialization→基準点command→表示用dimensions→AnnotationCommandの群を再監査する。startAnnotationAnchorConstraintの既定選択・同種toggle取消・対象数検査は、既存操作ownerへ寄せられるか確認する。renderer／WeakMapを含む実child・session・Parameter名前空間と採番、Workspace.currentと同期済みediting scopeの違い、後段AnnotationDragへの遅延callbackとhoisted入口を保持する。各factoryの初期化時照会・DOM登録と戻り値／例外を先に追い、単なる全app context包装や新たなモデル／履歴／rollbackを導入しない。この次単位の実装はまだ行っていない。

### 最新：注記の参照依存照会（2026-10-23）

基準develop d10adb8からcodex/annotation-reference-queryで実施。AnnotationAnchorConstraints.referencesRemovedGeometryへ、既存refs（leader付着先と正規化したanchorConstraints／対称軸）から完全なGeometryRef ID／kind付きkeyを調べる照会を集めた。appは同じ関数をInstance参照元、Block構成、Spline編集、Block完了、Geometry／Selection削除、Sketch削除の六つの構築箇所へ接続する。各commandの削除計画・guard／通知・求解・履歴と部分失敗の復元は変更していない。照会は注記やSetを変更せず、一般文字列再帰・親／末端IDへの自動展開・新しいcache／contextを追加しない。

app.jsは2,724→2,711行（13行減）。自己再帰以外の参照0だったvalueReferencesRemovedGeometryを撤去し、残るroot functionの自己外参照も監査した。旧binding.referencedだけの未使用0判定を無使用の証明にしない。geometryRefIdはHatch転送のtest driverで使用中のため保持する。新しいscript／folderは追加せず、関係の正規化・refsと依存照会を既存ownerにまとめた。GeometryRef関数の取得は照会時とし、CommandPanelが定義だけを読むscript評価の段階へ新たな必須依存を加えない。

構文596ファイル・全単体1,842件・関連単体48件が成功。追加3件でtyped refs／対称軸と完全path、kind付きkey、任意文字列を対象にしないこと、現在の関係の再読取り・正規化による除外、入力不変、ID先行の短絡／例外を確認した。d10adb8の元関数と現在関数の12,800組で結果と入力不変が一致し、rootの六consumerを保持・自己外参照のないbindingが0であることをASTで確認した。補助診断は一時directoryのcad-annotation-reference-audit.cjs。

旧d10adb8のappを実際に差し替えたブラウザ比較（route1回をassert）では、Geometry／Blockのcopy／Cut・削除、派生source／parent拒否、leaf削除、依存するanchor注記／leaderの削除と無関係な文字列を含む注記の保持、Undo／Redo／再読込を含む41状態でmodel・clipboard・mode・履歴・Selection・HintとAPI204 key順が一致（savedAtだけ除外）。最初の一時診断はfixture読込の既定resetLoadedHistory=falseを考慮しないUndo期待で旧版側で停止した。既存optionをtrueにして履歴初期化を明示し、製品や期待する削除挙動を変えずに修正後41状態を完走した。診断logはcad-annotation-reference-equivalence.log（初回）、cad-annotation-reference-equivalence-corrected.log（修正後）。

関連E2E12ファイル296件が全成功（4.9分、exit 0）。annotation-anchors／annotation-display-size／unified-annotations／blocks／derived-patterns／free-instance／parameter-dialog-controller／phase0-characterization／sketch-edit／sketch-permissions／spline／unified-uiを実行し、file URL Help読込も含む。runnerの終了と自己起動port8789のserver停止を回収済み。ログはcad-annotation-reference-{focused,check,unit,e2e}.log。期待値・性能制限・保存形式は変更せず、最新全E2Eは未実行。前回単位の305成功と今回の296成功、前回releaseの587全成功を混同しない。

仕様／実装mapを更新してCommit／Pushし、developへ統合してコード同一性を確認する。main／origin/mainはdf5aef2を維持。週枠は開始使用7%／残量93%、検証後使用8%／残量92%で停止条件未到達。200〜500行への全体目標は未完了。

次はAnnotationDataがPOSITIONS／normalize／axes／degreeをcommands層のAnnotationAnchorConstraintsから読む方向を確認する。純粋な基準点・関係の保存値定義／正規化・参照照会をdocument層へ分離し、実際の操作・求解・DOMを現在ownerに残す案を検討する。日本語UI labelはデータと区別し、既存公開API・同じ配列／関数の共有、変換条件／JSON field順と例外・評価時機を保持する。appを別の巨大contextへ移さず、既存classic scriptの追加が必要ならloader／check／unit／file URL期待値を同期する。まだこの次単位の実装は開始していない。

### 最新：表示機能の関連検証完了（2026-10-23）

製品コード9f700d5を固定した関連E2E18ファイル305件が全成功（5.0分、exit 0）。既存の性能12件を含み、空白矩形217ms（250ms未満）、pan144ms（175ms未満）。構文596・単体1,839・関連単体15・file URL読込1と、差し替え確認済みの旧mainとの86状態一致も同じ製品コードの結果。検証中・検証後にapp／src／tests／index／tools／specの内容を変更していない。この追記は文書だけで、app.jsは2,724→2,724行（0行差）。表示機能分離単位の前後は2,738→2,724行（14行減）、構築5→3・明示引数36→25。

再確認の前に、数値rule候補との固定4回の診断で無変更側の線選択103／103ms・空白矩形201／200msを観測し、実行条件による変動があることを確認した。候補も含めmodel／操作state／SelectionとCanvas PNGが全て一致したが、候補は採用しない。その新しい観測を根拠に元のassertion付き関連E2Eを一度通して確認し、305全成功を得た。以前の304／305失敗、baselineでも超過した比較、assertion省略診断を成功結果で上書きせず、[調査記録](presentation-performance-investigation.md)へ残す。根本原因の完全な特定や性能問題全般の解消とは扱わない。その後ユーザーから「先ほど電源につなぎました」と報告があり、電源状態の違いは測定値の改善と整合する有力な要因。接続時刻と各測定、CPU設定を厳密に記録していないため単一原因とは断定しない。

この記録を作業branchへCommit／Pushし、コード同一性を確認してdevelopへ統合・Pushする。main／origin/mainはdf5aef2を維持する。最新全E2Eは未実行で、前回releaseの587全成功を今回の全体検証へ代用しない。週枠使用7%／残量93%で停止条件未到達。通常の分離を続け、停止条件に達した区切りで最新の全体検証・develop先行／main最後の反映と同期を行う。全体の200〜500行への目標は未完了。

次はAnnotation参照依存照会と自己再帰だけの古い汎用参照探索を確認する。全JS検索とASTでvalueReferencesRemovedGeometryの外部参照0を確認した。binding.referencedだけの旧「未使用0」監査では自己参照を使用と数えていたため、今後は自身のbody以外の参照も調べる。実際の注記参照はAnnotationAnchorConstraints.refsの正規化済みtyped refsからID／kind付きkeyを読む。削除・Block変換／投影・Sketch削除・求解の各利用先を保ち、文字列再帰探索を参照判定へ戻さない。この実装はまだ変更していない。

### 前段の表示機能checkpoint（2026-10-23、当時の性能gateは未通過）

PresentationFeatureへ設定・計測・通知とUI／Canvas更新の接続をまとめた。既存五ownerの処理と状態は移さず、共有settings／profiler／formatterと八つの更新入口を一つの機能として公開する。appの当該構築は5→3、明示引数36→25、app.jsは2,738→2,724行（14行減）。private二参照は構築段階の接続専用で、モデル／UI stateや全app contextを追加しない。UIとCanvasの生成位置は保持し、Settingsのstorage／DOM反映より前に他ownerを実行しない。新moduleはsrc/applicationに配置し、既存UI ownerはsrc/uiに維持する。

構文596ファイル・単体1,839件・関連単体15件・file URL読込1件は成功。旧main df5aef2のappへの差し替えを実際に1回確認する修正済み診断で、UI／設定／コピー／Sketch切替16状態、作図／取消／Document置換48状態、寸法22状態が一致した。比較対象はmodel・履歴・mode／Selection、UI文言／状態、API204 key順等で、除外はsavedAtだけ。

関連E2E305件は304成功・性能1失敗（6.2分）。空白矩形333msで250ms未満の基準を超えた。無変更の旧mainでも選択性能が失敗することを確認したが、今回の差分の影響がないとは断定しない。性能制限・既存testの期待値は変更していない。最新全E2Eは未実行であり、前回release df5aef2の587全成功と区別する。詳細と再現入口は[presentation-performance-investigation.md](presentation-performance-investigation.md)。このcheckpointはタスク完了／release合格ではなく、develop／mainへの統合を保留した作業branchの保存とする。

再開時はGit状態／usage／同じ診断の進行中handle有無を確認する。次は性能のwall時間とCPU／描画回数を分離し、観測した処理に根拠のある改善だけを検討する。採用しなかった寸法hit／数値rule試作を無断で製品へ戻さない。mainはdf5aef2を保持し、全体の200〜500行への目標も未完了。週枠使用4%／残量96%で停止条件には達していない。

### 削除機能の生成・接続（2026-10-21）

DeletionFeatureが既存plan／Geometry command／Selection commandと参照拒否を共有し、同じscope／PointUsage／Selection・Annotationと後段resetを接続する。二つのrefresh・通知／例外・部分反映を保ち、独自のモデル／復元／履歴を持たない。構築3→1、明示引数64→47、群外root参照49→47。app.jsは2,765→2,738行（27行減）。旧appとのコピー／Cutと直接削除・参照拒否／leaf削除を含む36状態でmodel・clipboard・mode・履歴／選択・HintとAPI204 key順が一致。構文594・単体1,835・全E2E587件（24.9分）が成功。週枠残量49%に達したため、新しい分離を停止してdevelop先行／main最後で反映・同期する区切りとする。検証と再開地点は[再開手順](refactoring-policy-and-resume.md)を参照する。全体目標未完了。


### Clipboard機能の生成・接続（2026-10-21）

ClipboardFeatureが既存のTransfer／Payload／Session／Geometry／PasteCheckpoint／Graph／Commandを元の順序で構築する。実session／commandとコピー候補のbuild／照会を公開し、現在editing scope／Block namespaceとID／Parameter、通知／復元の時機を保持する。内部処理・stateの所有は各既存ownerのまま。構築7→1、明示引数60→45、群外root参照45→45。app.jsは2,805→2,765行（40行減）。旧appとのコピー／連続貼付け・Undo／Redo／再読込／Cutの21状態でmodel・clipboard・mode・履歴／選択・HintとAPI204 key順が一致。script／検証と再開地点は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。


### 寸法テスト支援の共有接続（2026-10-21）

DimensionTestDriver.createSupportが共通20 capabilityを受け、fixture／interaction／displayの各専用依存14／21／20個を元の生成位置で接続する。モデル／操作の実装や公開APIを移さず、test条件・遅延照会・参照／復元境界を保持した。明示引数100→75、異なる入力75は不変、構築3→4。app.jsは2,803→2,805行（2行増）で、共有段階の費用と依存重複の削減を区別する。検証と通常構築の再監査は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。


### pointer入力状態の所有（2026-10-21）

PointerInteractionController.createSessionを早期生成し、既存位置で入力依存をbindする。最後の生world座標と入力処理を同じownerへ集め、context menu更新とDocument／Sketch解除、各command／描画の照会を共有する。DrawingPreviewのsnap済み／仮表示座標とは区別し、pan／右中button・leaveと失敗時の座標保存時機を維持する。app.jsは2,803→2,803行（変化0）、元の7参照・4書込みを接続しroot letは7→6（全て後段接続）。検証と次のdriver境界検討は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。


### modeと作図Lifecycleの状態所有（2026-10-21）

DrawOperationLifecycle.createSessionを早期生成し、後段で既存command群をbindする。modeと開始／取消／終了・resetを同じownerへ集め、各command・表示・診断は同じ限定APIを共有する。既存遷移本体とdraft所有、modeを維持する取消／selectへ戻す終了、部分失敗と各reset範囲を保持した。app.jsは2,803→2,803行（変化0）、元の34参照・17書込みを接続しroot letは8→7。検証と再開地点は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。


### Offset／Filletの共有依存接続（2026-10-21）

authoringTools.createOffset／createFilletが共有Geometry・ID・Selection／preview・snapと通知を接続する。Offset独自の編集scope、Filletの実checkpoint／stabilizeと遅延Lifecycle準備、各featureの計算／取消・履歴を維持する。構築引数56→28、root参照41→25。app.jsは2,805→2,803行（2行減）。旧appとの13状態でmodel・mode／pending・履歴・選択・HintとAPI204 key順が一致。検証と次のmode所有監査は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。


### 最新の作図owner／Lifecycle接続単位

authoringTools.createLifecycleが同じcommand／draft・snap／preview／transientと通知を共有し、後段9依存で既存DrawOperationLifecycleを生成する。処理本体・状態の所有、終了／取消／Sketch限定reset／Document破棄の差、mode・通知／例外順を維持した。引数28→9、root参照30→12。app.jsは2,810→2,805行（5行減）。旧appとの48状態で作図・Escape取消／終了・Document置換のmodel／mode／履歴・選択とAPI204 key順が一致した。検証と次の単位は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新の基本作図二段階組立て単位

BasicDrawingTools.createAuthoringでsnap／Spline／snap拘束／primitive toolsetを構成し、Centerlineは同じGeometry・ID・snapと限定3依存で後段生成する。実draft・command・Selection／checkpointを共有し、scaleの毎入力取得と生成順、各取消／復元境界を維持した。構築5→2、引数93→39、root参照55→41。app.jsは2,822→2,810行（12行減）。旧appとの28状態で各作図途中／完成のmodel／履歴・選択とAPI204 key順が一致した。検証と次のLifecycle接続は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新の採番予約／Block重複ID照会単位

DocumentIds.createReservationへ同じGeometry／Document allocatorの予約順と現在Hatch値の遅延取得、BlockCatalogへDefinition内の重複ID照会を集約した。counter／scopeを複製せず、旧8 collectionと走査／変換順・空ID、Commandの明示checker優先と拒否時のHint／drawを維持した。app.jsは2,837→2,822行（15行減）。旧appとの14状態で再読込後の新規採番を含むmodel／履歴・Block editorとAPI204 key順が一致した。検証と次の構築境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のHint／log表示owner単位

ApplicationFeedbackへHint／logのDOM出力、Hint計測と求解結果の表示接続を集約した。4依存から同じ純粋なConstraintFeedbackを生成・共有し、翻訳・計測・文言のownerと操作時照会、例外時の部分反映を維持した。script／構文／単体／E2E読込期待も同期した。app.jsは2,853→2,837行（16行減）。旧appとの15状態でHint／log・言語切替とmodel／履歴、API204 key順が一致した。検証と次の単位は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のDocument準備と保存writer単位

DocumentApplication.createPreparationへunits／Sketch／外観／Block／描画順／Parameterの準備手順、DocumentSnapshot.createWriterへ準備後の保存元とmetadataを使う候補生成を集約した。各normalizeとcodec・scopeの所有、実行順／現在値と例外境界を維持した。準備6依存・writer7依存とし、app本体の暗黙依存を明示するため構築引数は6→13。app.jsは2,866→2,853行（13行減）。旧appとの13状態のmodel／履歴・Block editor／選択とボタン、API204 key順が一致した。検証と次の単位は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のDocument／Block履歴機能組立て単位

HistoryController.createFeatureへDocument／Block履歴の生成方針、既存Controller／Block snapshot／Restorationの接続、Document履歴metadata除外とrecord計測を集約した。stack／flag／復元のowner、Document履歴の共有実体、生成時無照会、scope切替・例外／通知順を維持し、DOMはUI adapterに残した。factory呼出し5→1、構築引数30→16、root参照21→17。app.jsは2,905→2,866行（39行減）。旧appとの13状態のmodel・履歴／Block editor／選択とボタン状態、API204 key順が一致した。検証と次の単位は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新の共通コマンドパネル組立て単位

CommandPanel.createFeatureへ既存3 adapter／routing／DOMの5 factoryの生成と結線を集約した。実panelとmode／styleの操作時照会、DOM登録順、参照元編集取消の即return・Derived／Hatchのhint差と通知／例外を維持した。factory呼出し5→1、構築引数32→23、root参照27→22。app.jsは2,924→2,905行（19行減）。旧appとの11状態のpanel／model・選択・履歴とtest API204 key順序が一致した。検証と次の境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 構築境界の再監査（2026-10-21）

develop caf19a0を再集計し、app.jsは2,924行、構築・接続1,266非空白行、test hooks438行、一文call237行、その他492行と確認した。旧46dd77dから164行減だが、modeの20代入と大半の構築は残る。今回は文書のみで2,924→2,924行（0行差）。次は共通CommandPanelの5 factoryの生成・接続を既存ownerへ集約する。候補比較・生成順・取消差と次の検証は[再監査](bootstrap-boundary-audit.md)および[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新の拘束解析の照会owner共有単位

分類／重複診断はSketchContextとGeometryReadServicesから必要な9関数を共有し、各子へ限定APIを渡す。個別引数を優先し、membership取得時機と各scope・cache／例外境界は維持した。構築引数19→12、異なるroot参照20→13、app.jsは2,926→2,924行（2行減）。旧appとの10状態の分類・解析・Tree・保存値／履歴比較が一致した。検証と次の監査は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新の拘束分類／重複診断の組立て単位

ConstraintAnalysis.createWithRedundancyで同じscope／Solver／scopeQuery／許容差を使う既存Redundancy→Analysisを生成し、元のrefresh関数を接続する。各cache・診断Map／count、遅延評価・例外境界とprofileは維持した。構築2→1、引数24→19、異なるroot参照22→20、app.jsは2,929→2,926行（3行減）。旧appとの10状態の分類・解析・Tree・保存値／履歴比較が一致した。検証と次の境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のTree View／Controller組立て単位

SketchTreeController.createWithViewが同じObjects・Selection・SketchContext・ApplicationSettings・移動commandを使い、View→Controller→menuを生成・接続する。表示と操作のscope、Viewのresize登録／幅設定・render時の行event、appの明示menu startは維持した。構築2→1、引数49→38、異なるroot参照47→42、app.jsは2,940→2,929行（11行減）。旧appとの12状態のメニュー／Tree／Properties HTML・モデル・履歴比較が一致した。検証と次の境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のTree Point固定解除の編集owner単位

FixedToggleCommandの既存operand commandへPoint固定flagの解除と既存求解への通知を集約した。同commandをTree生成前に構築し、Treeは同じunfixPoint APIを直接受け取る。guard・求解先の既定値・戻り値／例外と更新順を維持し、新state／command instanceは増やさない。app.jsは2,940→2,940行（0行差）。行数よりUI内のモデル直接更新の解消を優先した。検証と次の境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のTree Controller／Context menu結線単位

SketchTreeController.createWithContextMenuが既存Controller→CanvasContextMenuの生成と、Root／active／lockによる項目表示・名前変更／編集通知を所有する。同じControllerとmenuを返し、appの外部close入口への接続と明示startは維持した。構築2→1、引数36→32、異なるroot参照39→36、app.jsは2,953→2,940行（13行減）。旧appとの実ブラウザ比較でメニューを含む12状態のHTML・model・historyが一致した。検証と次の境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のTree行分類／照会owner共有単位

SketchTreeObjectsがTree categoryから可視性照会対象への分類を所有し、GeometryReadServices・SketchContext・ConstraintFeedback・ApplicationSettingsを共有する。表示scope、個別引数の互換性と後段PropertySelectionの遅延照会は維持した。構築引数38→32、異なるroot参照36→30、app.jsは2,957→2,953行（4行減）。旧appとの実ブラウザ比較で、7状態の展開Tree／Properties HTML・model・historyが一致した。検証と次の境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のdrag実行テスト支援組立て単位

既存GeometryDragTestDriverが同じGeometryDragFeature／Solverを使う二つの実行driverの組立てと三つの公開APIの接続を所有する。製品の状態・求解・計測手順は維持した。構築2→1、引数23→9、異なるroot参照11→7、app.jsは2,964→2,957行（7行減）。旧appとの実ブラウザ比較では公開API全204名の順序と三経路の結果・model・historyが一致した。検証と次の境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のProperties表示owner共有／Geometry ID変換単位

PropertiesDisplayがParameterNamespace・ConstraintFeedback・ApplicationSettings・BlockPlacementCommandの既存関数を共有し、個別指定の互換性と配置stateの所有を維持する。Properties以外でも使う図形ObjectのID／key変換はGeometryObjectsへ集約した。構築引数49→45、異なるroot参照46→43、app.jsは2,973→2,964行（9行減）。詳細な検証・次の境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のInstance参照元編集開始単位

参照元編集の配置有無判定・現在Sketch／guardと開始委譲を既存InstanceSourceCommandへ集約した。旧startの所属確認・sessionと配置commandのdraft・mode・取消／確定は維持し、新stateは持たない。app.jsは2,978→2,973行（5行減）。元app関数との48ケース比較が一致した。検証と次のProperties表示／actionのowner接続は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のProperties編集／AppearanceUI組立て単位

PropertiesDisplay.createEditingで既存の編集command群と共用AppearanceUIを生成し、Checkpoint・Parameter安定化・選択と二つのscopeを明示して接続する。生成順・start・Paletteと状態ownerは維持した。対象の構築2→1、引数38→23、root依存30→22、app.jsは2,984→2,978行（6行減）。旧appとの実ブラウザ比較でbulk編集・Document既定値・PaletteのHTML／model／historyが一致した。検証と次の表示Controllerのowner接続は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のProperties共通reader構築単位

PropertiesDisplayが既存PropertySelectionの結線を所有し、選択と表示で同じGeometryReadServices／SketchContextを共有する。編集層の判定実装や各scope・operation readerは維持し、新context／stateは増やさない。対象二構築の引数81→55、root依存71→47、app.jsは2,990→2,984行（6行減）。旧appとの実ブラウザ比較で六つの選択scenarioのHTML・保存値が一致した。検証と次の編集／AppearanceUIの接続境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のClipboardテスト支援組立て単位

ClipboardTestDriverで観測とGeometry／Block fixtureを同じsession・Selection・scope・履歴へ接続し、三つの公開APIを返す。生成順と元関数を維持し、新stateや汎用contextは増やさない。対象factory呼出し3→1、root依存35→21、app.jsは3,004→2,990行（14行減）。旧appとの実ブラウザ比較でAPI全204名の順序・fixture／Selection／履歴・保存値が一致した。検証と次の通常Properties／Appearance構築境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のCanvas表示テスト支援組立て単位

表示／座標／hit・snap／fit fixtureの11支援の生成と既存12個のAPI名の接続をCanvasTestDriver.createDisplaySupportへ集約した。既存viewport・Geometry生成と現在scopeを共有し、test guard内でのみ生成する。対象factory呼出し11→1、root依存29→23、app.jsは3,026→3,004行（22行減）。旧appとのブラウザ比較でAPI全204名・保存値・表示／fixture結果の一致を確認した。検証詳細と次のfamily境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のCanvas command終了判定単位

command panelの空白判定を既存CanvasHitInteractionへ、tool mode分類を既存DrawOperationLifecycleへ集約した。同じpress／参照／Hatch query、現在command stateと短絡順を維持する。appの早期callbackはstatic分類を使うhoisted入口で維持し、新stateや汎用contextは増やさない。app.jsは3,037→3,026行（11行減）。検証・次のtest支援familyの構築境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新の旧root接続整理単位

移管済み機能の未使用alias・委譲70個を除去し、実際の接続とtest公開だけを残した。ownerの生成・公開API・factory引数は変更していない。root未使用bindingは0、app.jsは3,055→3,037行（18行減）。実ブラウザのdata descriptor監査とtest公開204 keyの一致、削除以外にAST差分がないことを確認した。新たな分離ではなく旧接続の整理であり、200〜500行の目標は維持する。構文588・全単体1,772・全E2E584件が成功した（全E2E24.3分、exit 0）。最新全E2E未確認の状態は解消した。過去の性能ばらつきは根本解消と断定せず、main保留の合意と全体目標未完了は維持する。検証詳細と次の組立て境界は[再開手順](refactoring-policy-and-resume.md)を参照する。

### 最新のConstraint入力組立て単位

ConstraintCommandInput.createFeatureで寸法継続と通常拘束入力を二段階で組み立て、同じsession／command ownerを共有する。CanvasCommandInputs内の子factory順と既存APIを維持し、新stateや汎用contextは増やさない。canonical構築引数55→52、root参照54→51。app.jsは3,055→3,055行（0行差）。行数ではなく共有ownerと組立て境界を整理した。検証と次の候補は[再開手順](refactoring-policy-and-resume.md)へ記録する。main保留・全体目標未完了。

### 最新の寸法入力継続単位

Dimension dragから距離入力へ戻る処理と有効判定を、既存ConstraintCommandInputの専用APIへ集約した。六つの限定依存と二操作で分岐を所有し、DimensionDragFeatureへ共有する。rootの状態判定・hover解除／座標変換とcommand振分けの実装を除去し、生成順とdrag session・履歴は維持した。app.jsは3,063→3,055行（8行減）。旧実装との276ケース比較・単体と最新検証は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のInstance入力照会共有単位

CanvasCommandInputsで既存scene queryを共有し、投影／参照とHatch照会を同じownerから接続した。未使用のmakeConstraintOperand受渡しとrootのHatch委譲・投影aliasを除去し、必要なoperandElementは限定portのまま維持する。canonical構築引数59→55、root参照58→54、app.jsは3,064→3,063行（1行減）。正式仕様・実装mapを更新した。検証と次のCanvas構築境界は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新の基本作図入力API共有単位

CanvasCommandInputsへ既存BasicDrawingTools.inputを共有し、六つのroot関数aliasを除去した。canonical構築引数は64→59、引数内のroot参照は63→58。共有APIと従来の個別callback指定の両方を維持し、snap・モデル・Selectionや生成順は元ownerのまま。app.jsは3,066→3,064行（2行減）。正式仕様・実装mapを更新し、検証と次のowner共有候補は[再開手順](refactoring-policy-and-resume.md)へ記録する。main保留・全体目標未完了。

### 最新のpan CPU／描画順照会調査単位

pan CPU profileからGeometryPresentationのsortによるSketch照会の反復を特定し、Map案で実fixtureの照会1,050→530を確認した。しかし関連E2Eと固定比較で速度改善を示せず、複雑さに見合う効果がないため採用を見送った。実装・候補単体・正式仕様を08ec689へ戻し、確定変更は調査文書のみ。app.jsは3,066→3,066行（0行差）。全結果と次の構築依存整理は[調査記録](pan-latency-investigation.md)と[再開手順](refactoring-policy-and-resume.md)へ残す。main保留・全体目標未完了。

### 最新のTree hover描画責務とpan調査単位

pan開始時にTreeを離れる経路の重複描画を、SelectionHighlightの状態所有とTreeControllerの一括更新後の描画へ整理した。観測したCanvas描画は7→5、通常の移動処理4回は維持。app.jsは3,066→3,066行（0行差）。残る時間のばらつきを解決済みとは扱わない。比較・画像／保存内容の一致は[調査記録](pan-latency-investigation.md)、最新検証と再開条件は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のscene query共有単位

構築済みscene query APIのcreateInteractionからpress／hoverを接続し、appに列挙するroot参照を25→4へ狭めた（scene owner自体の依存は別）。後段の接続と既存reader直接指定API・判定優先順を維持し、未使用になったroot委譲二関数を除去した。app.jsは3,072→3,066行（6行減）。正式仕様・実装mapを更新済み。検証結果と次の再開条件は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新のscene hit構築単位

CanvasHitInteraction.createSceneへ、早期scope policyと後段のscene／operand照会構築を集約した。既存ownerと25個の限定依存を使い、判定は既存GeometryHitQuery／OperandHitQueryに残す。異なるscope reader・receiver・遅延参照と生成順を維持し、新state／cache／fileはない。app.jsは3,088→3,072行（16行減）。正式仕様と実装mapを更新し、検証結果と次の再開条件は[再開手順](refactoring-policy-and-resume.md)を参照する。main保留・全体目標未完了。

### 最新の構築境界再監査

develop 46dd77dを同条件で再監査した。app.jsは3,088→3,088行（0行差）、非空白2,595行中の構築は1,354行。次は既存CanvasHitInteractionでscope policyとscene／operand照会を二段階に組み立てる境界を検討する。25限定依存案・生成順・receiver／scope維持・候補比較は[監査記録](bootstrap-boundary-audit.md)を参照。今回は文書のみで実装案は未実装。製品テストの再実行はなく、最新全E2Eは未実行、main保留・目標未完了。

### 最新のoperand Sketch関係照会単位

operandRelationForSketchを既存SketchContextへ集約し、表示用sketchRelationToActiveも同じ判定を利用する。operandの未指定ID／該当なしはnull、表示用のfalsy ID補完とinactiveへの変換は分けて維持した。新しい依存port・state・cache・file・scriptはない。appの既存destructure 158行目で取得し、利用494／1,481行目に前方参照がないことをBabelで確認した。hoisted wrapper・新たな未使用root bindingなし。app.jsは3,094→3,088行（6行減）、今回再開時3,652行から564行減。

最終コードで構文588ファイル・単体1,751件・関連E2E187件（3.3分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／sketch-permissions／sketch-projection／free-instance／command-panel／adversarial-authoring-performanceで、file URL起動、通常／参照拘束のoperand・Sketch権限／Root・投影とInstance、既存画面比較・履歴・保存再読込を確認した。パンは152msで元の175ms未満の基準内。追加単体2件は未指定／無関係／Rootとactive・ancestor・descendantの返値差、lock／visibilityと別の階層照会、生成時遅延、同IDのDocument／Block切替と階層差替え、scope例外の伝播を確認する。既存6件と合わせたSketchContext単体8件成功。初回新単体1件は派生fieldのvisibleへ直接代入したfixtureにより失敗し、既存正規化に従いappearance.visibleの設定とensure後のsnapshotへ修正した。製品の正規化・期待する関係値は変更していない。変更前のroot operand関数とSketchContextを別VMへ読み、4種類のscope×11種類のID×2入口の一時診断88ケースで返値・scope読取り回数・正規化後状態が完全一致した。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-operand-relation-{check,unit,related}.log。

基準はdevelop 955f82b（前実装3f6a736）。開始時週枠残量98%／検証後97%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は今回までに揃えたowner APIを基にroot構築依存を再監査する。残る小関数の移動だけで数百行へ届くとは見積もらず、現在のfactory群・canonical ownerの再利用・初期化段階・後段callbackを実物から集計し、よりまとまった機能組立てを選ぶ。旧63c886cの集計は同条件の比較基準として保持し、巨大app contextや既存状態の再生成で行数を減らさない。次の実装単位は分析結果から決め、全体目標を縮小しない。


### 最新の拘束所属付与／挿入単位

既存ConstraintCommitCommand.createInsertionへassignConstraintSketchId／pushModelConstraintの所属選択・metadata付与・同期済みscopeへの同一Object追加・現在Parameter namespaceでのparameter確保を集約した。六つの限定依存とassignSketch／pushの二APIで、求解・重複判定・復元・UI／履歴とParameter計算は元ownerへ残す。同期済みscopeとWorkspace namespaceの読取りを別依存のまま保持し、default引数とfallbackの評価時機・nullの受渡し・戻り値・例外時の部分更新を維持する。新file・state・cache・scriptはない。app 216行目で構築し、所属付与の最初の参照2,226行目／pushの721行目に前方参照がないことをBabelで確認した。hoisted wrapper・新たな未使用root bindingなし。app.jsは3,101→3,094行（7行減）、今回再開時3,652行から558行減。

最終コードで構文588ファイル・単体1,749件・関連E2E222件（3.8分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／parameter-dialog-controller／sketch-permissions／blocks／free-instance／command-panel／multiple-dimensions／adversarial-authoring-performanceで、file URL起動、通常／暗黙拘束・寸法parameterと所属、Sketch権限・Block／Instance、既存画面比較・履歴・保存再読込を確認した。パンは149msで元の175ms未満の基準内。追加単体4件は生成時遅延、drawable／first／active fallbackとdefault引数の再評価、null受渡し、同じObjectの所属付与→配列追加→現在の別namespace照会とparameter確保、scope／namespace差替え、guard／metadata setter／配列追加／namespace／parameter例外の部分状態、既存implicit commitとの接続と重複拒否を確認する。既存21件と合わせたcommand単体25件も成功。新file・script・保存形式変更はない。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-constraint-insertion-{check,unit,related}.log。

基準はdevelop 21f5f07（前実装336a861）。週枠残量は開始時／検証後とも98%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はoperandRelationForSketchの階層関係照会を、既存SketchContextへ集約できるか確認する。active→descendant→reference→nullの優先と現在scope／activeの読取りを維持する。既存sketchRelationToActiveはfalsy IDをactiveへ補完し、該当なしをinactiveとするため、単純なaliasへ置換しない。共通判定を同じownerへまとめつつ両入口の相違、正規化／照会時機・例外と既存CanEdit／参照元規則を維持できるか検証する。新file・state・callback容器は増やさない。


### 最新の固定拘束照会単位

既存ConstraintReferences.createFixedStateへ円弧端点固定・線固定の先頭検索と、点が固定線端点かの照会を集約した。既存の型importを共有し、同期済みcurrentScope／表示要素比較の二portから三つの読取りAPIだけを返す。enabled厳密false・型・比較とendpointの短絡順、Block投影の参照比較と点端点のObject同一性の違い、現在配列・返却Object・undefined／boolean・例外を維持する。SelectionHighlight生成後の359行目で構築し、最初の利用は円弧固定580／線固定1,799／point lock583行目であることをBabelで確認した。hoisted wrapperや新file・state・cache・scriptは増やしていない。app.jsは3,107→3,101行（6行減）、今回再開時3,652行から551行減。新たな未使用root bindingなし。

最終コードで構文588ファイル・単体1,745件・関連E2E193件（5.0分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／fixed-command／block-geometry-fixed／blocks／selection-zoom-shadow／geometry-drag-smoothness／adversarial-authoring-performanceで、file URL起動、Fix／Unfix・Block内部の固定、拘束付きPoint／Line／Circle／Arc／端点drag、選択表示、既存画面比較・履歴・保存再読込を確認した。パンは163msで元の175ms未満の基準内。新単体4件は実拘束型・SelectionHighlight／GeometryRef／GeometryObjectsを組み合わせ、生成時遅延、enabled厳密falseと型・先頭の元Object、現在配列／scope、再生成Block投影と通常同ID別Objectの区別、Arc比較→endpointの順序、point lockの生の参照同一性と短絡、scope／比較／不正constraint例外の伝播と無変更を確認する。既存14件と合わせた関連単体18件も成功。新file・script・保存形式変更はない。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-fixed-queries-{check,unit,related}.log。

基準はdevelop ce37d28（前実装0e59ee8）。開始時週枠残量99%／検証後98%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はassignConstraintSketchId／pushModelConstraintを既存ConstraintCommitCommandの早期insertion APIへ集約できるか確認する。drawable判定→最初のdrawable／active fallback→metadata付与→同期済みscopeのconstraints追加→現在Parameter namespaceでの寸法parameter確保の順を維持する。currentScopeはEditingScopeBinding、currentParameterNamespaceは既存Workspace readerの別依存であり、一括して同じscopeへ寄せない。初期値／default引数の評価・現在値の照会・無効constraintと例外時の部分更新、後段のcommit／求解／履歴の所有を維持する。必要な関数・scopeが揃う初期化地点と最初の利用を確認し、全app context・新state・不必要なwrapperを増やさない。


### 最新のInstance参照元の矩形入力単位

既存InstanceCommandInput.createRectangleSourcesへSketchProjection型のentry→itemと、通常の六Geometry一覧→readProjection／active・visible条件→現在modeに応じたcommandへの追加を集約した。九つの限定APIからaddだけを返し、Geometryの選別・command state／確定・通常Selection／gestureとUI通知は元ownerへ残す。生成時照会、新file・state・cache・scriptはない。元の短絡とquery後のmode再読取り、同じreader／provider構造・候補array／item参照・receiver・undefined戻り値・例外の短絡を維持する。app.jsは3,114→3,107行（7行減）、今回再開時3,652行から545行減。新たな未使用root bindingがないことをBabelで確認した。

最終コードで構文588ファイル・単体1,741件・関連E2E239件（4.0分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／free-instance／sketch-projection／sketch-projection-compatibility-driver／blocks／hatching／command-panel／adversarial-authoring-performanceで、file URL起動、参照元編集・投影entry／互換経路、Block／Instance、Hatch・command panel、既存画面比較・履歴・保存再読込を確認した。パンは164msで元の175ms未満の基準内。追加単体4件は実RectangleSelectionQuery／SplineGeometryと組み合わせ、生成時遅延、projection型のentry順・重複／item参照とquery後も同じcommand、通常の六reader／包含とcrossing／active・visible短絡と新しい一覧、provider再生成・同じ関数、query後のmode変更による追加先再選択、戻り値とreceiver・query／predicate／command例外の短絡を確認する。既存click APIの5件も維持し、関連単体23件成功。新file・script・保存形式変更はない。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-instance-rectangle-{check,unit,related}.log。

基準はdevelop 99daae2（前実装ada73d2）。開始時週枠残量59%。検証後はusage toolの週枠reset時刻とusedPercentの表示が更新され、used 1%／残量99%を確認したため継続する。mainは5ee5f3fを維持し、全体目標は未完了。次はfindArcEndpointFixedConstraint／findLineFixedConstraint／pointLockedByLineFixedの三つの読取りを、既に両拘束型を参照するConstraintReferencesへ集約できるか確認する。currentScopeはEditingScopeBindingの同期済みscopeを使い、enabled厳密false・型判定・表示要素比較とpoint端点のObject同一性、現在配列の先頭一致／undefined／booleanと例外を維持する。同じ比較関数はSelectionHighlight生成後に利用可能になるため初期化順を確認し、必要のないhoisted wrapperや新たな小file・cache・編集stateは増やさない。


### 最新の通常矩形選択の適用単位

既存CanvasSelectionInteraction.createRectangleSelectionへ追加選択のSketch整合guard→Instance内部選択解除→矩形query→Selection反映を集約した。四つの限定APIとselectだけで、図形選別は既存RectangleSelectionQuery、集合更新はCanvasSelection、gesture／UI通知は既存SelectionRectangleに残す。生成時照会や新state・cache・scriptはない。元の短絡・照会回数、query前の解除、同じObject／rect・options・receiver・undefined戻り値・例外時の部分状態を維持する。selectByRectの唯一の参照は宣言後のSelectionRectangleへの接続であることをBabelで確認し、不要なhoisted wrapperを追加せずselectを直接接続した。app.jsは3,118→3,114行（4行減）、今回再開時3,652行から538行減。

最終コードで構文588ファイル・単体1,737件・関連E2E214件（3.7分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／sketch-permissions／free-instance／blocks／selection-zoom-shadow／command-panel／adversarial-authoring-performanceで、file URL起動、Sketchをまたぐ追加選択・lock／inspection、Block／Instance、通常選択・矩形・寸法と選択表示、既存画面比較・履歴・保存再読込を確認した。パンは150msで元の175ms未満の基準内。新単体4件は実CanvasSelectionと組み合わせ、生成時遅延、Sketch不一致時の無変更と空選択の短絡、全11カテゴリの置換・同じObject／metadata解除、追加時のObject同一性と同IDの別Object、現在query／rect／crossing・繰返しguard読取り、guard／解除／query／適用例外の部分状態と同じerrorの伝播を確認する。関連単体60件も成功。新file・script・保存形式の変更はない。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-rectangle-selection-{check,unit,related}.log。

基準はdevelop 84ac3c9（前実装e9ae445）。週枠残量は開始時／検証後とも59%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はSelectionRectangleへ渡すInstance参照元の矩形追加callbackを、既存InstanceCommandInputへ集約できるか確認する。SketchProjection型の参照元編集は投影entry→item、その他は同じGeometryReadModelの六一覧→既存readProjectionとactive／visible条件→現在modeに応じたcommandへ追加する。modeをquery前だけに固定せず、query後のcommand選択も従来時機で読み、provider Objectとpredicate・返却参照・例外／更新短絡を維持する。通常Selection・投影専用経路・gestureは混ぜず、全app contextや新stateを持ち込まない。


### 最新の編集scope／Solver同期の所有単位

EditingScopeBindingへ従来rootのmodel別名とSolver初期生成、context終了→move reset→Workspace切替→同期済みscope更新→Solver更新→Geometry read／projection無効化の手順を集約した。六つの明示依存とsolver／current／activateの三APIで、状態と更新の所有を揃えた。Workspace・Block session・Solverの計算／capture／restoreを移さず、cloneやscope stackは増やしていない。Block復帰のworkspace.restoreが同期処理より先に実行されるため、終了処理中のWorkspace currentと従来model／Solverの参照差をそのまま保つ。50読取りは同期済みcurrentへ接続し、DocumentApplicationの初期model捕捉、Clipboard targetのmodel property、Document固定参照とWorkspace直読は維持した。root letは9→8、app.jsは3,124→3,118行（6行減）、今回再開時3,652行から534行減。appのactivateEditingScopeは先行callback用hoisted委譲として残す。

最終コードで構文588ファイル・単体1,733件・関連E2E242件（4.0分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／blocks／block-geometry-fixed／free-instance／sketch-projection／file-safety／parameter-dialog-controller／png-export／adversarial-authoring-performanceで、file URL起動、Block入れ子編集・host復元・独立履歴、投影／Instance・拘束・Parameter、Document読込・保存再読込、PNGと既存画面比較を確認した。パンは164msで元の175ms未満の基準内。新単体4件は実Workspace／Solverで同じGeometry参照・単一Solverと生成時遅延、Workspace復元先と同期済みscopeが異なる途中状態、終了／prepare／Solver／read cache／projectionの例外と部分状態、遅延controllerのreceiverとconstructor例外を確認する。既存Workspace／Block feature単体10件も成功。初回AST置換の編集範囲重なりは構文検査で検出し、移管領域を置換対象から除外して再生成した。最終版は逆AST変換で元appを完全再現し、50読取りと切替protocolの移管以外に変更がないことを確認した。root letは9→8、新たな未使用bindingなし。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-scope-binding-{check,unit,related}.log。

基準はdevelop e8537c7（前実装4b94cc6）。開始時週枠残量60%／検証後59%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はappのselectByRectに残る追加選択のSketch整合guard、Instance内部選択解除、矩形query結果のSelection反映を、既存CanvasSelectionInteractionへ集約できるか確認する。RectangleSelectionQueryはGeometry選別、CanvasSelectionは集合更新、UI通知は既存終了処理へ残す。短絡・query前の解除・現在scope／参照・例外時の部分状態を維持し、新しいstateや選択ルールは追加しない。


### 最新のCanvas描画段階の組立て単位

既存CanvasDisplay.createRenderingへinteractive renderer→frame rendererの生成と、共通content（画像→Hatch preview→描画stack）／PNG出力（寸法→注記→点）の接続を集約した。Surfaceのtransform・stroke resetと18段階の対話描画、各rendererの描画内容とstate、PNG frame・read cacheは元ownerに残す。23個の明示portで同じGeometryDisplay・寸法／注記／作図／配置／Offsetを共有し、drawだけを返す。既存のcreate／createWorkspaceの初期生成順、後段PNG command／schedulerの遅延、各ownerのreceiver、現在frameの再照会と短絡・例外・既存のCanvas復元範囲を維持する。新file・state・scriptは追加しない。Babelで参照0になったSpline handle／Annotation描画のroot委譲二入口を確認して除き、他の先行callback／診断に必要な入口は残した。app.jsは3,132→3,124行（8行減）、今回再開時3,652行から528行減。

最終コードで構文586ファイル・単体1,729件・関連E2E177件（3.1分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／png-export／reference-images／drawing-order／canvas-zoom-input／selection-zoom-shadow／command-panel／hatching／adversarial-authoring-performanceで、file URL起動、共通描画と重なり順、画像・Hatch preview、倍率表示／選択強調、既存画面比較、PNG・履歴・保存再読込を確認した。パンは133msで元の175ms未満の基準内。追加単体4件は実Surface／Exportと組み合わせ、生成時遅延、共通contentと18段階の対話描画、各ownerのreceiver／現在method・後段overlay・viewport／DPR、PNG時の計測・対話描画の短絡と復帰、共通描画後のframe再照会、各段階の例外と後続短絡・既存の復元範囲を確認する。既存単体11件（CanvasDisplay 4件／CanvasSurface 7件）も維持した。Babelで新たな未使用root bindingがないことを確認済み。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-canvas-rendering-{check,unit,related}.log。

基準はdevelop 1c16328（前実装3da1bff）。開始時週枠残量61%／検証後60%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はrootのmodel別名とactivateEditingScopeの接続境界を分析する。現在はworkspace.activateの前にSketch contextをcloseしmoveをreset、返ったscopeをmodelとsolver.modelへ順に反映してGeometry read／projection cacheを無効化する。Workspaceは値とscopeの所有に限定し、UI／Solverを持ち込まない。後段controllerの遅延・Document固定参照と現在scope・例外時の部分状態を維持できる単位かを確認する。単なるgetter／setter容器や可変app contextへの移動は採用しない。


### 最新のGeometry描画群の組立て単位

GeometryDisplayへ描画policy・line display・renderer・Layerの四構築と、点一覧の整列／円弧端点の可視filter／Spline編集ハンドル状態の接続を集約した。既存PointUsage・command targets・Sketch style・CanvasSurface・GeometryReadModelを共有し、描画policy／Canvas命令／編集stateは元ownerに残す。24個の明示portから各子へ必要なものを接続し、10個の描画・照会APIを返す。全app contextや新stateを持ち込まない。Babelで参照0を確認したlineDisplaySegment／drawOrderBySketchのroot委譲とappearanceLineDashのroot aliasを除き、先行callback登録に必要なhoisted描画入口は維持した。app.jsは3,138→3,132行（6行減）、今回再開時3,652行から520行減。生成順、遅延照会、明示itemsと既定一覧の順序・options、同じObject／scope、viewport／DPR、exportとCanvas状態復元を維持する。

最終コードで構文586ファイル・単体1,725件・関連E2E210件（3.6分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／spline／blocks／selection-zoom-shadow／png-export／hatching／adversarial-authoring-performanceで、file URL起動、点・円弧・Spline編集、scope・投影・選択表示とzoom、既存画面比較、Hatch境界再描画、PNG・履歴・保存再読込を確認した。パンは150msで元の175ms未満の基準内。新単体4件は実Presentation／command targets／Sketch style／Renderer／Layer／CanvasSurfaceを組み合わせ、生成時遅延、既定一覧のinactive→active整列と明示itemsの順序／filter、Selection無変更、DPR／viewport／export、補助線延長、四種類の描画とSpline path、点の固定ラベル、現在scopeと同じIDの別Object、reader例外とSpline描画例外のCanvas復元を確認する。初回の新単体はVM由来arrayのprototypeを直接比較して1件失敗し、内容を確認するassertへ直した。製品の期待値・性能基準は変更していない。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-geometry-display-{check,unit,related}.log。

基準はdevelop c3c05e4（前実装cc7c11b）。週枠残量は開始時／検証後とも61%。mainは5ee5f3fを維持し、全体目標は未完了。次はCanvasSurface.createInteractiveRendererとcreateFrameRendererの接続、通常content／export／interactiveの描画順を分析する。GeometryDisplay・Annotation／Dimension等の既存APIを使い、Bitmap／Canvas resetはSurfaceへ残し、後段PNG command・scheduler・viewportの遅延と起動時機を維持できる機能組立てか確認する。二つのfactoryの全引数を広いcontextへ移すだけの案は採用しない。


### 最新の描画policy owner依存整理単位

GeometryPresentationへ既存commandTargetPresentation／sketchPresentationを共有し、六つの個別policy関数を二つのowner APIへ整理した。個別関数だけの既存呼出しも維持し、Hatch／他UI／test supportで使う四つのroot委譲入口は残す。参照0をBabelのbindingで確認したisReferenceHoverElement／isPendingReferenceTargetの未使用委譲二入口は除いた。後段sidebar／drag callbackや判定の実装・優先順位は変更しない。対象factoryのroot binding参照は27→23（PointUsage整理前33から計10減）。新file・state・script・保存形式変更はない。app.jsは3,142→3,138行（4行減）。

最終コードで構文584ファイル・単体1,721件・関連E2E176件（3.1分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／hatching／command-panel／sketch-permissions／png-export／adversarial-authoring-performanceで、file URL起動、operand／reference／選択強調、Sketch status／errorと関係色、Hatch・権限、既存画面比較、PNG・履歴・保存再読込を確認した。パンは157msで元の175ms未満の基準内。新単体4件は実CommandTargets／SketchStyleを共有し、生成時遅延と旧portよりowner優先、panel短絡とSelection無変更、現在status／solve error／relation、pendingとinactive reference hover・Arc endpoint options、旧portと新owner APIのpaint／width一致を検証する。既存22件も維持した。初回関連176件成功後、Babelで参照0を確認したroot委譲二入口を除去し、上記の構文・単体・関連全件を最終コードで再実行した。Hatch／test supportに必要な四委譲は維持した。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-geometry-policies-{focused,check,unit,related}.log、cleanup前ログはcad-geometry-policies-before-cleanup.log。

基準はdevelop 33a95a5（前実装c51f79e）。開始時の週枠残量63%／検証後62%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は依存を整理したGeometryPresentationとline display／GeometryRenderer／geometry Layerの生成結線を、同じPointUsage・command targets・Sketch styleとCanvasSurface／GeometryReadServicesの限定APIを使ってまとめられるか確認する。presentationの状態・renderer・Layerを重複生成せず、Point分類・style・queryとCanvas描画を元のownerに残す。既存readers・export frame・draw順・DPR・shadow／stroke・後段drag／Spline／sidebarの遅延を維持する。全appの可変contextを渡す／67個の参照をそのまま並べる構成を作らず、公開ownerと必要なqueryを限定した機能組立てへ進める。

### 最新の描画PointUsage依存整理単位

GeometryPresentationの七つの点分類依存を、同じPointUsage ownerのAPIへ整理した。appは既存生成結果を保持し、分類queryを個別列挙せず共有する。runtimeのdrag／center／sidebar／固定線queryは分けて遅延接続し、従来のpointQueriesだけの呼出しも維持する。対象factoryのroot binding参照は33→27。新file・state・script・保存形式変更はない。app.jsは3,142→3,142行（0行差）。owner保持の宣言が一行増え、個別点queryの列挙が一行減った。行数ではなく依存と所有の整理を行った。

構文584ファイル・単体1,717件・関連E2E182件（2.6分）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／spline／blocks／selection-zoom-shadow／png-exportで、file URL起動、点・Spline編集点・投影点、scope切替、選択とzoom、既存画面比較、PNG出力・履歴・保存再読込を確認した。新単体4件は実PointUsageとGeometryPresentationを組み合わせ、生成時遅延と同じIDの別Object、現在scope／拘束／Spline編集点／投影一覧、例外伝播とモデル・Selection無変更、runtime drag／center／sidebar queryの分離、新旧APIの選択・hover・status・fixed・export結果一致を検証する。既存の描画policy単体18件も維持した。既存Babel parserによる同factoryのroot binding参照数は33→27で、PointUsageの再生成やmodel cacheはない。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-geometry-point-usage-{focused,check,unit,related}.log。

基準はdevelop a134db9（前実装3c5d58b）。開始時の週枠残量64%／検証後63%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は同じGeometryPresentationに個別で渡すcommand targetの三照会とSketch styleの三照会を、既存commandTargetPresentation／sketchPresentationの限定APIとして共有できるか確認する。rootのhoisted入口はHatch／他UI・早期生成で使われるものを残す。PointUsageと同様に従来portの互換性、predicateの短絡と同じSelection／scope／status、後段ownerへの遅延参照を維持する。sidebar／drag等の後段ownerを早期にObjectへ置換せず、広い描画factoryをそのまま包む前に契約を減らす。

### 最新の特殊寸法編集支援単位

特殊寸法submit／Properties適用と編集対象選択を既存DimensionValueCommand.createEditingSupportへ集約した。一般commandへ返す三つのcallbackと11依存を明示し、非対象null／拒否false／成功、型・propertyの短絡順、式評価scope、例外、履歴・選択／drag解除の順を維持する。一般createのpending／入力表示／UI更新は変更しない。新file・state・script・保存形式変更はない。app.jsは3,162→3,142行（20行減）、今回の再開から3,652→3,142行（510行減）。

構文584ファイル・単体1,713件・関連E2E227件（3.5分）が成功（全runner exit 0）。関連はunified-ui／derived-patterns／annotation-anchors／unified-annotations／parameter-dialog-controller／blocksで、file URL起動、角度間隔の値／式、注記の距離・anchor拘束、Parameter依存・Document／Block scope、Undo／Redo・保存再読込を確認した。新単体5件は実InstanceAngleIntervalConstraint型と一般commandとの結線を用い、生成時遅延・選択同一性とdrag reset、特殊submitの優先／null・拒否・成功、現在の評価入口とAnnotationのnull constraint／property短絡、submitの例外伝播とPropertiesのhint化、履歴とpending／入力終了の順を検証する。interval submitの既存の二回の式正規化も保持し、拒否時はpendingを残す。既存一般commandの単体11件は維持した。support生成は関連する三ownerの生成後で、後段dimensionDragだけを遅延callbackで接続する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-special-dimension-editing-{focused,check,unit,related}.log。

基準はdevelop 2028fb4（監査4dcaa45、実装618b17d）。開始時の週枠残量65%／検証後64%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は描画の広い構築契約を減らすため、既存PointUsageを再利用できるownerとして保持し、GeometryPresentationに渡す点分類queryと、command targets／Sketch styleの既存APIとの関係を分析する。現在の個別queryと同じ判定／scope／参照を保ち、後段drag・Spline・sidebar hoverは操作時に読む。PointUsageを複製せず、全app contextを渡さず、既存呼出しとテストの互換性を維持する。67依存の描画factoryをそのまま包む案は採用せず、ownerの限定APIで依存を減らしてから生成群をまとめる。

### 最新の構築依存再監査単位

develop 63c886c（app blob 881fd70a4785a78445236016d0c6b64d705a118a）を基準に構築依存を再監査した。旧f37edc6の集計を同条件で再現し、root構築232→214文／1,564→1,376非空白行、test hooks488→478行、call一文261→264行、複文callback47→38個を確認した。stateはroot let9個、mode代入20箇所（通常19＋test1）、pointer代入4箇所。test hooks／一文callを仮に全て外しても非空白1,923行が残る。今回のapp.jsは3,162→3,162行（0行差）で、実装・UI・保存形式・正式仕様は変更していない。

監査の分類合計・Git blob・state更新元・初期化順を現物照合した。Geometry描画六構築は24物理行でもroot参照67種類を持つため、これを平坦な67依存の新factoryへ包む案は採用しない。既存のPointUsage／command targets／Sketch style／GeometryReadServices等のAPIを使う契約削減を先に検討する。後段constの静的参照121回は全てcallback内だが、constructorが即呼出ししない保証とは区別する。CanvasDisplayの二段階生成、DimensionDisplay.createTraversal、BlockEditingFeature.createCommands、DOM登録／startの既存順を維持する。詳しい数値・比較条件・採用基準は[再監査](bootstrap-boundary-audit.md)を参照する。

基準コードは前単位で構文584ファイル・単体1,708件・関連E2E189件が成功済み。この文書のみの監査で再実行した結果ではなく、全E2Eの代用にしない。開始時の週枠残量66%／監査後65%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はDimensionValueCommand.createのsubmitSpecialDistance／commitSpecialPropertyと対象選択callbackを分析する。Instance角度間隔、Annotation寸法、Annotation anchor距離の分岐・式評価・hint／履歴を既存の寸法値編集ownerへ集められるか確認する。非対象null／拒否false／成功、propertyによる短絡、現在scopeとAnnotationのnull constraint評価、履歴回数、submitとProperties編集で異なる例外境界、一般command側のpending／入力／UI更新の順を維持する。単なるcallback file・汎用context・モードsetter容器を作らず、状態所有と契約を整理してから上位の描画／入力／編集構築をまとめる。

### 最新のCanvas hit組立て単位

CanvasHitInteractionへpress query／hoverの共通hit入口の結線と注記interaction hit判定を集約した。Geometry／scene readerを共有しながら各子の依存は限定し、press読取りと既存CanvasHover更新を区別した。active SketchとGeometry／寸法／投影／注記の優先順位・参照・短絡・例外は既存ownerに維持する。classic scriptと構文・単体・E2E読込一覧を同期し、新state・cache・保存形式変更はない。app.jsは3,170→3,162行（8行減）、今回の再開から3,652→3,162行（490行減）。

構文584ファイル・単体1,708件・関連E2E189件（2.9分）が成功（全runner exit 0）。関連はunified-ui／annotation-anchors／command-panel／sketch-permissions／phase0-characterizationで、file URL起動、注記anchor／frame／本文と重なるGeometryの入力、Block投影、権限と所属、panel取消、既存画面比較、Undo／Redo・保存再読込を確認した。新単体4件は実PressQuery／PointerHoverと同じCanvasHoverを用い、生成時の遅延、active Sketch変更とpress／double clickの参照・照会順とhover無変更、注記部位／anchor-only／投影の優先条件、現在の寸法・endpoint・projection operand、query例外時の伝播とhover無変更を検証する。各queryの既存実装は変更せず、script／syntax／unit／E2E読込一覧を同期した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-canvas-hit-interaction-{focused,check,unit,related}.log。

基準はdevelop 01f4851（前実装e03f311）。開始時の週枠残量67%／検証後66%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は現在のcomposition rootの構築依存と残るcallback／stateを再監査する。旧f37edc6の集計を上書きせず、最新revisionのfactory群・外へ返すAPIと利用先・mode／pointerの更新入口・後段接続・bind／startを現物から整理する。小さな結線抽出だけを続けて200〜500行へ届くとは扱わず、UI／入力／描画／編集の機能境界と初期化段階を使って、次のまとまった生成責務を選ぶ。巨大context／service locatorや別の巨大bootstrapへ移す方針は取らない。64入口のCanvasCommandInputsを含む広い契約も再検討対象とし、責務と依存の削減を行数より優先する。

### 最新のCanvas command入力組立て単位

CanvasCommandInputsへ五つのCanvas入力adapterとDrawing専用PointCommandの生成結線を集約した。同じreader／Selection／command・queryを明示し、focus解除／pointer captureを共有する。入力優先順位はPointerInteractionControllerに残し、各adapterの実装・command確定／取消／rollback・現在のsnap条件は変更しない。classic scriptと構文・単体・E2E読込一覧を同期した。新たな操作stateや保存形式変更はない。app.jsは3,200→3,170行（30行減）、今回の再開から3,652→3,170行（482行減）。

構文582ファイル・単体1,704件・関連E2E150件（2.2分）が成功（全runner exit 0）。関連はunified-ui／command-panel／derived-patterns／sketch-permissions／unified-annotationsで、file URL起動、通常作図・寸法／拘束・Selection、派生配置と参照、注記・panel focusとblank double click、lock／Sketch所属、Undo／Redo・保存再読込を確認した。新単体4件は実五adapterとPointCommandを用い、生成時のDOM／scene遅延、Root拒否と点rollback／snap／同一Selection、注記とInstanceのfocus／source矩形／capture順、現在sourcesとviewportのorigin snap許可・通常snap、寸法group dragとpending／Selectionの共有を検証する。新module／testの構文・単体一覧とscript／E2E読込順を同期し、後段constの直接捕捉を増やしていない。appの最終整形後も個別syntaxを確認した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-canvas-command-inputs-{focused,check,unit,related}.log。

基準はdevelop 255db86（前実装508c916）。週枠残量67%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はCanvasPressQueryとPointerHoverの生成で重複するGeometry／scene hit入口と、appに残るAnnotation interaction hit判定を分析する。press／hoverの優先順位、通常hitとanchor-only hitの違い、Block投影の編集不可、現在Selection／active Sketchとの関係を維持し、共通の読取queryの組立て境界を作れるか確認する。入力commandの確定や新しいhover stateを読み取り側へ混ぜない。CanvasCommandInputsの64入口を汎用contextへ置き換えるのでなく、既存ownerを使う上位機能の公開APIを整理する。数百行という全体目標は未達である。

### 最新のCanvas command入力routing単位

共通command panel／PNG／通常pointerの入力振分けを既存CanvasInputBinding.createCommandRoutingへ統合した。九つの明示的な入口と後段panel／PNGの遅延readerで、press・move・finish・double clickの優先順位、座標、抑止・例外・参照を維持する。既存native event登録とschedule／flushは変更せず、新file・script・state・保存形式変更はない。app.jsは3,225→3,200行（25行減）、今回の再開から3,652→3,200行（452行減）。

構文580ファイル・単体1,700件・関連E2E165件（2.4分）が成功（全runner exit 0）。関連はunified-ui／command-panel／png-export／derived-patterns／hatching／unified-annotationsで、file URL起動、共通panelの空白double click取消と通常配置、PNG cropとpan、派生／Hatch／注記の入力、Undo／Redo・保存再読込を確認した。追加単体5件はpanelの左press優先・座標／prevent／suppression／例外、PNGと通常pointerへのfallback、inactive panelへのmove後の現在PNGとpan優先、finishと一回のdouble click抑止、実native bindingのflush／座標status／終了profileとの結線を検証する。生成時に後段readerを読まず、同じevent・world／screen・receiverを保持する。既存bindingの単体3件は変更しない。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-canvas-command-routing-{focused,check,unit,related}.log。

基準はdevelop e881647（前実装fd0efea）。開始時の週枠残量68%／検証後67%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は五つのCanvas command input（Instance／Annotation／Constraint／Drawing／Selection）の生成群を分析する。現在はappが共有mode／pending／Selection・command・hit queryとfocus／pointer captureを各dispatcherへ接続し、全五つをPointerInteractionController.press.inputsだけへ渡す。PointCommandの生成を含め、共有ownerを一つの機能として構築できるか確認する。個別のcommandの確定／取消・snap条件・panel focus解除は既存ownerと既存順に保つ。read portsと操作portsを明示し、各dispatcherへ不要な依存を渡す巨大contextにせず、初期化前constを直接捕捉しない。最終200〜500行という目標は未達であり、機能組立てと残るstate所有の整理を継続する。

### 最新のCanvas表示基盤組立て単位

CanvasDisplayへ座標・navigation・zoomと、surface・PNG renderer・workspace layoutの生成結線を集約した。create→既存TransientAuthoring→createWorkspaceの二段階で生成順を保ち、同じviewport／ctx／surfaceへの接続を明示する。六つの既存ownerのstateや処理は移さず、Zoomの生成時DOM接続・後段bind／start・flush／倍率変更／寸法入力同期・resizeとexport復元の順を維持する。classic scriptと構文・単体・E2E読込一覧を同期した。app.jsは3,247→3,225行（22行減）、今回の再開から3,652→3,225行（427行減）。

最終コードで構文580ファイル・単体1,695件・関連E2E149件（2.7分、性能file全12件を含む）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／png-export／selection-zoom-shadow／adversarial-authoring-performanceで、file URL起動・倍率入力と画面座標・resize／選択表示・既存画面比較・PNG出力／復元を確認した。パンは140msで元の175ms未満の基準内。新単体4件は実Viewport／Navigation／Zoom／Surface／Export／Layoutの二段階生成、倍率適用の拒否／flush例外、明示Observer開始と最新pending、同じCanvas／viewportのbitmap・export frame復元を検証する。初回E2Eは後段constであるsyncDimensionValueInputの直接参照による起動ReferenceErrorを検出し、中断した。従来の遅延callbackへ修正して全関連149件を再実行した結果が上記であり、初回から成功とは扱わない。最終構文一覧は新testも追加済み。初回ログはcad-canvas-display-related-initialization-failure.log、最終ログは一時ディレクトリのcad-canvas-display-{focused,check,unit,related}.log。専用serverはrunner終了後にPID／command lineを照合して終了した。この単位で全E2Eは未実行。最終main反映前に最新コードで全体検証する。

基準はdevelop 581d65b（前実装aa6342c）。開始時の週枠残量69%／検証後68%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は残る構築依存と初期化順を再監査し、Canvasの入力command群／pointer controllerの組立てと、表示側へ返している公開ownerの利用範囲を確認する。互いに参照する全stateを一つのcontextへ詰めず、入力のrouting・command確定・Selection・描画の担当を区別する。生成時に参照するconstと操作時に読むcallback、bind／start、既存ownerの同一性を保持する。小さなcallback抽出だけで数百行へ到達するとは扱わず、機能単位の公開APIを整理する。

### 最新のCanvas press選択準備単位

Canvas pressのselectInactive／prepareSelectionを、同じSelectionとidentity選択を扱う既存CanvasSelectionInteraction.createIdentitySelectionへ統合した。別Sketchへの追加拒否・lock時の選択→guard・inspection保持／解除・Tree選択解除・早期returnと例外伝播を維持し、PointerInteractionControllerには従来のmode／pending条件とroutingを残した。新file・script・state・保存形式変更はない。app.jsは3,260→3,247行（13行減）、今回の再開から3,652→3,247行（405行減）。

構文578ファイル・単体1,691件・関連E2E163件（2.4分）が成功（全runner exit 0）。関連はunified-ui／sketch-permissions／blocks／derived-selection-copyで、file URL起動、同一Sketch内の追加選択・別Sketch拒否、lock対象の確認と解除後編集、Block／派生Geometryの選択・コピー・履歴・保存再読込を確認した。追加単体4件はCtrl／Shiftの短絡とinspection保持、最新lockと選択→guardの順・拒否時終了、inspection／Tree選択解除と通常継続、非active選択後の最新lock照会・拒否後guard・例外伝播を検証する。既存selectIdentityの優先・型対応・参照同一性のテストは維持した。生成時にSelection／Sketch／guardを読まず、同じownerへ接続する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-canvas-press-selection-{focused,check,unit,related}.log。

基準はdevelop 784ab24（前実装771d208）。週枠残量69%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はCanvasのviewport／navigation／zoom control／surface／workspace layoutの構築境界を分析する。画面座標と倍率・Canvas bitmap・resizeを同じviewportで扱う生成群を、機能単位で組み立てられるか確認する。共有viewport／ctxの同一性、生成とbind／start、pointer move flush→scale変更→寸法入力同期、resize時のdraw→値入力同期、PNG export時の一時変更と復元を維持する。初期化順にまたがるTransientAuthoringやmodel編集は混ぜず、明示的な公開ownerと必要な遅延callbackに限定する。初期化順や依存が悪化するなら統合範囲を見直し、全app contextや別の巨大bootstrapへ移さない。

### 最新のCanvas描画診断組立て単位

CanvasRenderTestDriver.createRenderingSupportへ、既存の描画診断五部品の生成・接続を集約した。appは同じcommand／preview Layer／scope／Canvasを明示し、三つの既存ブラウザAPIへ接続する。test hooksの有効条件とAPI順・準備／描画／観測の実装は維持し、通常描画や新たなstateをtestingへ持ち込まない。新file・namespace・script・保存形式変更はない。app.jsは3,270→3,260行（10行減）、今回の再開から3,652→3,260行（392行減）。

構文578ファイル・単体1,687件・関連E2E140件（2.1分）が成功（全runner exit 0）。関連はunified-ui／phase0-characterization／png-export／annotation-display-sizeで、変更した三つの診断APIの破線・補助線overhang／marker、file URL起動、既存画面比較、PNG出力と注記表示を確認した。追加単体3件は生成時のscene無参照・共有ownerの結線と12case順、mode／reset、現在scope／viewport／外観、Block参照同一性、描画失敗時の停止とCanvas methodの同一参照復元を検証する。既存helperの本体・公開API名／順とtest hooks guardは変更しない。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-canvas-render-test-support-{focused,check,unit,related}.log。

基準はdevelop 4b679b9。週枠残量70%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はPointerInteractionControllerのpressへappが渡す非active identity選択と通常選択の事前処理を分析する。既存CanvasSelectionInteractionのidentity選択と同じSelection／Sketch照会へ責務を揃えられるか確認する。Ctrl／Shiftの異なるSketch拒否、lock時の選択→guard通知、inspection保持／解除、clearの条件と早期returnを維持し、pointer captureやcommand routingを変更しない。既存ownerへまとめられる場合だけ採用し、mode容器・巨大な入力context・新しい小fileは作らない。機能組立ての整理も継続し、細かなcallback抽出だけで200〜500行へ届くとは扱わない。

### 新規Parameter候補の読取り検証

AnnotationCommandのvalidateParameter本体を既存ParameterNamespace.validateNewDimensionParameterへ統合した。appは現在modelを明示して依頼し、名前／式／symbols／read-only値／Engine評価の順・一度のsymbol収集・例外・現在言語errorを同じownerで調整する。ensure・採番・target更新を行う通常評価とは別の読取り入口とし、draft／model無変更と有限の0／負数の許可を維持した。確定時のcommitParameterや履歴は変更しない。新file・state・script・保存形式変更はない。app.jsは3,281→3,270行（11行減）、今回の再開から3,652→3,270行（382行減）。

構文578ファイル・単体1,684件・関連E2E162件（2.4分）が成功（全runner exit 0）。関連はunified-ui／unified-annotations／parameter-dialog-controller／blocksで、file URL起動、Annotation Parameter作成・編集と式／依存、Document／Blockの名前空間、Undo／Redo・保存再読込を確認した。追加単体4件はParameter・可変寸法・注記・read-only定数の実Engine評価、symbol一度収集とdraft／model無変更、明示Document／Blockと最新値・0／負数、重複／prefix／未知参照／循環の失敗順序、非有限結果に対する現在言語のerrorを検証する。既存16件のNamespace評価／rename／Clipboard／削除依存等の期待値も維持した。候補検証は採番・target／評価値更新を行わず、appのmodelを明示する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-annotation-parameter-validation-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 40c41f3（前実装e6973ad）、開始時の週枠残量71%／検証後70%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はinstallTestHooks内のCanvas描画診断groupの構築・公開を分析する。既存CanvasRenderTestDriverのDraftDashCases／BlockDashCases→DashIsolationとConstructionHoverFixture／ConstructionLineObservationの五部品間の結線を、同じtesting ownerで閉じられるか検討する。既存三つのブラウザ公開API（canvasDashIsolationCases、constructionLineHoverDisplayCasesForTest、constructionLineRenderingForTest）の名前・関数契約・同じ描画／モデルowner・scene reset／mode変更順を維持する。test hooksの有効条件と生成時のread／副作用を監査し、通常描画の実装をtestingへ移さず、既存helperの組立てだけを担当させる。read／draw layer等の公開APIを必要な範囲で共有し、app全体や可変contextを渡さず、installTestHooks全体を別の巨大closureへ移さない。

### 拘束保存metadataの所有

ConstraintPersistence.createMetadataへ共有decorateとDocumentSnapshot用snapshotDataを統合した。raw codecを変更せず、null／未指定・data同一性・field順、read-only／式fallback、Document／BlockのSketch IDと参照情報の扱いを維持する。metadata ownerは早いBlock機能より前に生成し、raw codecの後段初期化はhoisted serializerの遅延呼出しで保つ。装飾のhoisted入口はBlock履歴・Clipboard・test support向けに残し、Snapshotには同じownerの保存用methodを直接接続する。新file・state・script・保存形式変更はない。app.jsは3,295→3,281行（14行減）、今回の再開から3,652→3,281行（371行減）。

構文578ファイル・単体1,680件・関連E2E177件（2.5分）が成功（全runner exit 0）。関連はunified-ui／file-safety／blocks／derived-patterns／derived-selection-copyで、file URL起動、保存読込・Block履歴／編集、Clipboard・派生参照、円形配列と角度間隔寸法、Undo／Redoを確認した。追加単体4件はdata／拡張Objectの同一性・field順、read-onlyと式fallback、null／未指定、DocumentだけのSketch queryとBlockの元field、遅延生成・raw失敗／数値式例外時の停止と途中効果、実Snapshot／raw codecのDocument・Block別JSONと復元・元拘束無変更を検証する。既存raw codec4件の参照scope・型判定・legacy読込の期待値も維持した。metadata初期化はParameterNamespace／SketchContext後・早いBlock機能前で、raw codecは後段まで読まない。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-constraint-save-metadata-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 1aa49fb（前実装0c0bf86）、開始時と検証後の週枠残量72%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はAnnotationCommand.validateParameterのapp内候補検証を分析する。名前のtrim／式正規化→現在modelのsymbol収集→名前検証→Parameterと可変寸法のdefinitions＋新候補→read-only寸法の定数Map→ParameterEngine評価→有限値検査という読取り処理で、既存ParameterNamespaceが同じsymbol・分類・式変換・Engineを所有する。既存Namespaceへ新規候補の検証を統合できるか確認し、model aliasを明示してDocument／Blockのscopeを保持する。ensure／evaluateParameterNamespace等のモデル更新経路へ一律置換せず、symbol収集回数、read-onlyの値、名前重複／未知参照／循環の例外・現在言語のerror、入力draft／modelの無変更を検証する。commitParameterの適用・評価・履歴は既存の担当に残す。新たな小fileや汎用contextは作らない。

### Geometry削除時の操作終了

GeometryDeletionCommandへ削除前の限定された操作終了手順を統合した。appのendInteraction callbackを除去し、後段で生成する三種類のdragは遅延reset callback、既に生成済みのSession／Line／Circular／previewは同じowner、modeは既存setterへ接続する。guardと依存／空plan／symbol検査後・実削除前の位置、clearとcancel／resetの違い、operand／trim保持と非対象draft、途中例外・求解／履歴の順序を維持した。不要になったArc reset aliasも除去した。新file・state・scriptや保存形式変更はない。app.jsは3,307→3,295行（12行減）、今回の再開から3,652→3,295行（357行減）。

構文578ファイル・単体1,676件・関連E2E192件（2.8分）が成功（全runner exit 0）。関連はunified-ui／sketch-permissions／derived-selection-copy／multiple-dimensions／blocks／unified-annotationsで、file URL起動、削除・派生参照拒否・権限・寸法／Block／注記、Undo／Redo・保存再読込を確認した。追加単体3件は実PendingCommandSession／ConstraintTargetSession／DrawingPreviewを使い、成功時のclearとcancel／resetの区別、operand配列とtrimの参照保持、選択mode依頼、四種の拒否時の状態無変更、drag／Arc reset例外時の停止を検証する。既存5件のguard・削除／選択整理／求解・履歴の期待順は維持し、操作終了の内訳を別traceで検証できるfixtureへ更新した。後段dragは初期化時に読まないこと、不要なArc reset aliasの参照が残らないことを確認した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-geometry-deletion-interaction-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop dd8e6e2（前実装1f3d954）、開始時の週枠残量74%／検証後73%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はdecorateSerializedConstraintとDocumentSnapshot.constraintDataの保存用metadata生成を分析する。既存ConstraintPersistence／DocumentSnapshotとの責務を確認し、raw codecのserialize／deserialize契約を変えず、readOnlyDimension・parameterName・expression、DocumentとBlockのsketchId、参照flag／referenceSketchIdの既存条件・null／未指定・field順とdata同一性を保持する。Block編集・履歴、Clipboard、test supportにも同じdecorate入口を渡すため、用途別にscope情報を混ぜない。早いBlock機能への登録はhoisted関数を使い、constraintCodecs生成は後段にあるので、新metadata ownerの生成位置と読取り遅延を監査して未初期化constを直接渡さない。新たな小fileや可変contextを増やさず、既存ownerで役割をまとめられるか検証する。

### 拘束・寸法配置の開始準備

拘束・寸法開始前のreset進行を既存DrawOperationLifecycleのprepareConstraintStart／prepareDimensionStartへ、mode別の拘束取消準備をprepareConstraintCancelへ統合した。Pending／Centerline／Slotの先行処理と共通のreset subsetを区別し、mode条件は各reset直前に読み取る。角度間隔寸法の開始は既存DimensionPlacementCommandへ統合し、通常寸法と異なる取消・select・anchor／target・Pending生成の経路を維持した。開始処理の三つの直接mode書込みを既存selectModeポートへ接続し、mode変数やdraft／sessionの新ownerは作らない。新file・script・保存形式変更はない。app.jsは3,331→3,307行（24行減）、今回の再開から3,652→3,307行（345行減）。

構文578ファイル・単体1,673件・関連E2E133件（1.9分）が成功（全runner exit 0）。関連はunified-ui／command-panel／derived-patterns／circular-authoring／multiple-dimensionsで、file URL起動、作図・拘束／寸法への切替、CommandPanel、円形配列の角度間隔寸法の直接操作・符号付き編集、Undo／Redo・保存再読込を確認した。追加単体6件は二種類の開始reset順・取消のmode別の独立した二回のread・reset例外時の停止、角度間隔寸法の拒否順／既存操作保持、実InstanceAngleIntervalConstraintのanchor／現在angleStepとtarget／pointer同一性、取消／target生成の例外時の途中効果と後続無実行を確認する。既存の関連単体21件も維持した。Centerline／Slot／Arcの旧aliasは同じ閉包resetを指し、isPlacingは同じownerのarrow query、既定pointerは同じplacement serviceであることを確認した。最終差分確認で不要になったCenterline／Slotのreset aliasを除去し、app構文・全単体1,673件・同じ関連E2E133件（1.9分）を再確認した（すべてexit 0）。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-dimension-start-lifecycle-{focused,check,unit,related,unit-final,related-final}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 5658e62（前実装d10eda4）、開始時の週枠残量75%／検証後74%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はGeometryDeletionCommand.endInteractionのapp側callbackを分析する。現在はGeometry／Dimension／Annotation drag reset→Pending.clear→拘束commandだけclear（operandは保持）→Line／Circle／Arc reset→preview pointerだけnull→select modeという限定的な操作終了を行う。削除commandのguard／依存参照検査後、実削除前に呼ばれる契約を維持し、GeometryDeletionCommand自身が具体的な操作ownerへ依頼する責務を持てるか検討する。cancel／rollbackやresetForDocument／通常寸法開始へ一律置換せず、Rectangle／Slot／Centerline等の未対象draftやoperands保持、拒否時の無変更、途中例外の停止位置を検証する。新しい汎用reset容器や可変app contextを作らず、既存APIの必要な範囲で接続する。

### Canvas context interactionの組立て

CanvasContextInteractionへTarget selection／Fix照会・Items・CandidateAction・Entry・Actionsの生成と結線、およびhover preview通知を集約した。候補Queryとpresenter、既存UI controllerのsessionは独立したまま使う。appは四つの操作入口へ委譲し、六部品間の一時的な参照を保持しない。早いcallback登録とcloseAppMenusの遅延参照、後段生成→controller.start、選択保持／明示置換・拘束振分け・pointer同一性・guard・履歴順は維持する。新しい操作stateや巨大contextを作らず、既存componentの明示portを接続する。外部依存64項目は残り、単一facade化で全体の依存整理を完了したとは扱わない。新classic script／単体testと四つの読込・検証一覧を同期した。app.jsは3,348→3,331行（17行減）、今回の再開から3,652→3,331行（321行減）。

構文578ファイル・単体1,667件・関連E2E169件（2.4分）が成功（全runner exit 0）。関連はunified-ui／blocks／fixed-command／sketch-permissions／drawing-order／multiple-dimensionsで、file URL起動、候補menu・Fix／寸法整列・描画順・権限、Block、Undo／Redo・保存再読込を確認した。追加単体4件は実Target／Items／Entry／Actions／CanvasSelection／CanvasHoverを接続し、単一対象での選択集合保持と最新Fix表示、重複候補のpreview無変更・明示置換・最新拘束commandへの振分け、取消時のquery省略と拘束時の例外・mode短絡、pointer／item同一性・編集guard・寸法整列のUI／draw／履歴順を検証する。生成時のDOM／Fix／Selection読取りがないことも確認する。新script／testの四一覧を同期した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-canvas-context-interaction-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 1f83000（前実装a0cf3be）、開始時の週枠残量76%／検証後75%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は拘束・寸法配置の開始準備を分析する。appのConstraintTargetCommand.prepareStartとDimensionPlacementCommand.prepareStartはmode変更とLine／Rectangle／Fillet／Circle／Arc／previewのresetを行い、前者だけPending取消とCenterline／Slotのresetが先行する。既存DrawOperationLifecycleが同じcommand実体を所有しているため、元の順序・reset範囲・途中例外とread時機を保って開始準備を担当できるか検証する。startInstanceAngleDimensionもappに残り、guard／配置中／circular判定→Pending取消→拘束取消→select mode→anchor／拘束target→pending置換→案内／toolbar／drawという独自経路を持つ。既存DimensionPlacementCommandへ統合できるか合わせて確認し、通常の寸法開始と一律に同じresetへ正規化しない。単なるmode getter／setter容器を新設せず、現在の状態ownerと開始・確定・取消の責務を揃える。

### PropertiesのControllerとViewの接続

既存PropertiesDisplayへcreateWithControllerを追加し、ControllerとViewの生成・編集command／選択照会／共有AppearanceUIの結線を集約した。appはPropertyEditingFeatureの結果を一つのAPIとして渡し、個別geometry／element command・controls／Palette入口・Controllerの中継参照を除去した。PropertySelection／EditingFeature／AppearanceUIの生成位置と既存state、選択の遅延照会、権限・preview／commit・操作の戻り値を維持する。新file・state・汎用contextは追加せず、表示専用create APIも維持する。外部actionとread ownerのportはまだ多く、引数を隠すだけで全体を分離済みとはしない。app.jsは3,354→3,348行（6行減）、今回の再開から3,652→3,348行（304行減）。

構文576ファイル・単体1,663件・関連E2E194件（2.9分）が成功（全runner exit 0）。関連はunified-ui／blocks／free-instance／sketch-permissions／unified-annotationsで、file URL起動、Properties編集・Palette・複数選択、配置状態・Block／Instance／注記・権限、Undo／Redo・保存再読込を確認した。追加単体3件は実Controller／View／PropertySelectionをつなぎ、生成時のDOM／scope遅延、描画後の選択変更と外観preview／commit、geometry結果のchecked／更新、element／multiple編集、owning Sketch lockでinput／change／clickを短絡すること、最新配置状態・構造guard・action戻り値と共有Palette接続を検証する。従来表示APIの3件も維持し、既存fixtureのSketch名readerを実APIに合わせて補完した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-properties-panel-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop a6d51fd（前実装395d892）、開始時の週枠残量77%／検証後76%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はCanvas context menuの機能組立てを分析する。Query・Presentation・Targetの選択／Fix照会／候補確定・Items・Entry・Actionsに散る結線を、既存ownerと外部で必要なopen／execute／candidate選択／表示APIに沿って整理する。早いCanvasContextMenu生成のcallbackは後段のpresenter等を操作時に参照し、test supportにも同じpresenterを渡すため、生成順・初期化時read・startの時機を照合する。候補hoverの復元、選択集合の保持／明示置換、拘束command時の候補振分け、mode／pointerと取消を維持し、新たなmenu sessionや任意commandを操作できるcontextを作らない。既存CanvasContextTargetで閉じられる依存と、applicationの機能組立てに属する依存を区別し、薄いwrapperの積み重ねだけで全体完了としない。

### 共有外観UIの組立て

PropertiesとDocument設定で共有するAppearanceControls／AppearancePalette、および起動時のDocumentAppearanceEditorの生成・接続をAppearanceUIへ集約した。同じAppearanceEditing・選択照会・外観commandを使い、appは外部portとcontrols／openPalette／startだけを接続する。Document設定の生成時機、設定start→Palette.bind、他の起動処理との順序、Palette session・最新scope／既定値・倍率・履歴／UI／drawの動作を維持する。共有componentや編集stateを再生成せず、移動で不要になったaliasを整理した。新classic scriptと単体testをindex／構文一覧／単体一覧／読込期待へ同期した。app.jsは3,375→3,354行（21行減）、今回の再開から3,652→3,354行（298行減）。

構文576ファイル・単体1,660件・関連E2E195件（2.9分）が成功（最終全runner exit 0）。関連はunified-ui／leader-appearance／blocks／hatching／unified-annotationsで、file URL起動、PropertiesとDocument既定値・Palette、使用中色・継承・複数選択、Block／Hatch／注記、Undo／Redo・保存再読込を確認した。追加単体3件は生成時のDOM／選択照会の遅延、Document設定start→Palette.bindの順、同じcontrolsによる全設定group、PropertiesとDocument設定から同じPaletteへの接続、取消・captured ownerと最新scopeの使用中色、置換された既定値と現在倍率、履歴→UI→drawを検証する。新単体の構文一覧への追加を最終確認し、構文・単体を再実行した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverを非表示で先に起動し、runner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-appearance-ui-{focused,check-final,unit-final,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 25f9124（前実装c595f3b）、開始時の週枠残量78%／検証後77%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は残るPropertySelection・PropertyEditingFeature・PropertiesController・PropertiesDisplayの生成と接続を分析する。geometry／appearance／element／multiple編集のapp内利用はControllerと共有AppearanceUIに集中し、appearanceEditingはAnnotationの編集にも公開される。対象・可視性照会は早いappのhoisted入口からも呼ばれるため、生成順と操作時readを維持する。Panelとして共有選択・編集・表示の結線を閉じられるか、既存のread owner／command APIを使って検討する。外部に必要なappearanceEditing・可視性操作・対象照会・表示更新を明確にし、共有AppearanceUIやDocument既定値をPanel内部で再生成しない。巨大contextやController引数の横流しだけなら境界を見直す。

### 注記コピーの表示値変換

ClipboardTransferへdetachedAnnotationの実処理を統合し、appは必要な表示照会と現在倍率を渡して同じ関数をClipboardPayloadへ接続する。元のserialize→layout／metrics→anchorPosition→Leader形状／anchor複製→倍率計算の順を維持する。参照を外す判断とmetadata除去はPayload、貼付け移動・再接続はTransfer、表示位置の解決は既存Renderer／Anchor queryが所有する。新file・state・汎用contextを増やさず、Transfer生成は読取り無処理であることと、全portの初期化済みを確認してPayloadより前へ移した。app.jsは3,386→3,375行（11行減）、今回の再開から3,652→3,375行（277行減）。

構文574ファイル・単体1,657件・関連E2E170件（4.7分）が成功（全runner exit 0）。関連はunified-ui／annotation-anchors／annotation-display-size／derived-selection-copyで、file URL起動、単独注記と参照先を含むコピー、Leader表示形状・倍率、派生参照、Undo／Redo・保存再読込を確認した。追加単体3件はlayout／metrics fallbackと明示anchor、生成時の遅延読取り、現在外観／倍率、解決pointの独立copy、元注記・表示geometryの無変更、実TransferとPayloadの接続による参照保持／除去を確認する。変換本体はserialize呼出先と倍率readerへの置換を除き移動前と一致した。この単位で全E2E・性能fileは未実行。最終main反映前に最新コードで全体検証する。E2E全170件の成功表示後、worker不在とこのrunが起動したserverを確認し、終了待ちの専用server（port8784）だけを終了して同じrunnerのexit 0を回収した。E2Eの再起動・既存テストの期待値変更はしていない。ログは一時ディレクトリのcad-clipboard-annotation-copy-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 11c6b16、開始時の週枠残量79%／検証後78%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はPropertiesの機能組立てを分析する。AppearanceControlsとPaletteはPropertiesだけでなくDocumentAppearanceEditorにも共有され、AppearanceEditingも同じ実体を使う。PropertySelection／PropertyEditingFeature／PropertiesDisplay／Controllerとの共用依存と、create・操作時read・bind／startの順序を照合し、重複する接続を同じownerで閉じる。共有部品をProperties専用に再生成せず、現在scopeとDocument既定値・Palette sessionを維持し、外部に必要なAPIだけを公開する。大量callbackの単なる横流しや新しい巨大contextになれば境界を見直す。未使用aliasは実際の利用先を確認して同単位で整理する。

### 拘束確定の性能traceの所有

ConstraintCommitCommandへ最後の性能traceの保持・読取り・解除を集めた。生成と成功後の公開を同じownerで行い、既存observerの同一Object通知と公開位置、失敗／短絡時の以前のtrace保持、Document resetの無通知null化を維持する。appのlastAuthoringPerformanceと生成／観測／resetの三つの中継callbackを除去し、readPerformance／clearPerformanceを直接接続した。新fileや汎用state容器は追加しない。app.jsは3,387→3,386行（1行減）、今回の再開から3,652→3,386行（266行減）。

構文574ファイル・単体1,654件・関連E2E122件（1.7分）・性能file全12件（48.0秒）が成功（全runner exit 0）。関連はunified-ui／command-panel／fixed-command／file-safety／parameter-dialog-controllerで、file URL起動、拘束確定・Fix／Undo、操作取消、Document reset・保存再読込を確認した。パンは150msで元の175ms未満の基準内。追加単体3件は成功後の公開順とobserverの同一Object、command間の独立、拒否・失敗・参照への切替時の旧trace保持、公開前例外時の旧trace保持、無通知の反復clearを確認する。このコードで全E2Eは未実行であり、最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-constraint-performance-owner-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量79%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はClipboardPayload.detachedAnnotationの値変換を既存ClipboardTransferの責務へ統合できるか分析する。現在表示中のanchor／文字layout／Leader geometry・倍率と保存用copyの関係、元Annotationの無変更、参照を持つ項目の扱いを確認する。現在TransferはPayloadより後で生成されるため、必要な読取り依存と生成時の無処理を確認して接続順を整理し、未初期化constを直接渡さない。Materializationやモデル編集と混同せず、新たな小fileや汎用contextを作らない。その後は再監査のProperties／context menu等の意味のある機能組立てへ進む。


### Composition rootの残存責務・依存の再監査

基準はdevelop f37edc6、app.js 3,387行。実装は変更せず、[再監査](bootstrap-boundary-audit.md)へAST分類と初期化依存、state／後段接続参照の区別、残る実処理と機能組立て、次の実装単位を記録した。再開手順section 5を更新し、目標を維持する。app.jsは3,387→3,387行（0行変化）。監査文書の関連local link 7件、ASTの分類と非空白行の合計、十個のletの読取り／代入先、次のtrace生成／reset／観測の呼出し箇所を確認した。app.jsのSHA-256一致と実装・テスト・設定のGit差分なしを確認した。文書のみの変更のため構文・単体・E2Eは再実行していない。同一実装の直前結果は構文574ファイル・単体1,651件・関連E2E163件成功であり、全E2E成功とは扱わない。この監査記録をCommit／Pushしてdevelopへ統合する。週枠残量80%で継続中、mainは5ee5f3fを維持する。次は再監査で特定したConstraintCommitCommandの性能trace生成・最後の結果・Document reset／test読取りの所有を揃える。全体目標は未完了。


### Sketch外観の正規化コピー

normalizedSketchCopyの本体をSketchHierarchy.copyWithNormalizedAppearanceへ統合した。Block clone／apply・Session同期・Block履歴が同じ関数を使う。四種の外観は独立して正規化し、その他のfieldはshallow copyで参照を維持する。ID／親／Root名の補正や読込版移行は行わず、null／未指定の継承用空外観、元Sketchの無変更を維持する。新file・state・依存portは増やさず、appは関数の接続だけを保持する。app.jsは3,396→3,387行（9行減）、今回の再開から3,652→3,387行（265行減）。

構文574ファイル・単体1,651件・関連E2E163件（2.3分）が成功（全runner exit 0）。関連はunified-ui／blocks／block-geometry-fixed／derived-selection-copy／sketch-editで、file URL起動、Blockのclone／編集／確定・取消と履歴、Sketch外観・階層、複写回帰、Undo／Redo・保存再読込を確認した。追加単体3件は四種の外観正規化・入力無変更・コピー間の独立性、未知fieldと外観以外の参照の維持、Root／親／IDを修復しないこと、空値と継承を確認する。呼出し監査では直接利用はBlock編集とSession同期、clone経由のBlock履歴であり、当初のClipboard経由という説明を修正した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-sketch-normalized-copy-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量81%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は現在のapp.js全体の残存責務と依存を再監査する。初期分析から大幅に構成が変わっており、残るstate・実処理・feature組立て・test hooks・起動を現在のownerと照合する。数百行のcomposition rootへ進むため、既存ownerを束ねる意味のある機能境界と初期化段階、循環参照・遅延callbackの理由を具体化してsection 5と再開候補を更新する。巨大context／app本体の移動／空行削除だけで目標を達成した扱いにせず、薄いfileを増やすだけの分割も見送る。監査結果から次の実装単位を選び、現在の中間成果で全体完了としない。


### 読込codecの生成・接続

DocumentLoading.createWithCodecsへGeometry／Block／Instance読込codecの組立てを統合した。BlockとDocumentの共通の接続・Parameter準備依存を共有し、同じInstance codecの検査・正規化・移行を直接接続してappへの中継依存を除いた。既存のcodec注入APIと通常編集用normalizerのactive Sketch fallback、候補decode→reset→installの順、読込形式と参照同一性を維持する。新file／state／registryは増やさず、不要になった検査用中継関数を削除した。app.jsは3,409→3,396行（13行減）、今回の再開から3,652→3,396行（256行減）。

構文574ファイル・単体1,648件・関連E2E220件（3.1分）が成功（全runner exit 0）。関連はunified-ui／blocks／file-safety／free-instance／sketch-projection／derived-selection-copy／hatching／reference-imagesで、file URL起動、候補拒否、Block／Instance／投影参照・複写、Hatch・画像、Undo／Redoと保存再読込を確認した。追加単体3件は実Block／Geometry／Instance codecと投影ownerによる生成時の遅延、Root／Blockの拘束参照とnamespace独立性、入力無変更、install時の配列／Object同一性と無効化順、同じInstance検査のRoot／Block拒否とDocumentApplicationのreset無実行、共通pattern正規化を確認する。読込では各namespaceの明示Sketch resolverを使い、通常編集時のactive fallbackはappの既存入口に維持する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-document-loading-codecs-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量82%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はappに残るnormalizedSketchCopyを、既存Sketchデータownerへ統合できるか分析する。Block編集とClipboardが共有する四種の外観正規化、未知fieldとObject参照を保つshallow copy、空値の既存規則を維持し、UI・採番・履歴へ依存させない。新たな小fileは追加せず、既存SketchHierarchy／Appearanceの責務との整合と読込時の正規化との違いを確認する。Hatch描画は既存境界で維持し、必要な依存整理が見つかった時点で再検討する。


### Document編集状態の初期化

DocumentEditingResetへresetModelStateの進行を分離した。DocumentStateの二段階reset、scope復帰と保留pointerの破棄、cache／Selection／draft／session／採番／Block編集のreset、既定値復元後のHatch／Tree／Annotation／画像操作の順を維持する。既存の重複resetも省略せず、例外境界・配列参照・取消／履歴なしの契約を維持する。各ownerを生成後に接続し、初期化前のconstを直接捕捉するgetter集合や汎用app contextを作らない。Hatchのcontent／Layerは既存renderer内に責務がまとまり、包むだけでは効果が小さいため今回は追加分割しない。app.jsは3,433→3,409行（24行減）、今回の再開から3,652→3,409行（243行減）。

構文574ファイル・単体1,645件・関連E2E189件（2.6分）が成功（全runner exit 0）。関連はunified-ui／blocks／file-safety／sketch-move／command-panel／reference-images／phase0-characterizationで、file URL起動、読込候補の拒否時に現在Documentを保持すること、Block／Sketch移動・取消、参照画像、既存画面比較、Undo／Redo・保存再読込を確認した。追加単体3件は実DocumentState／EditingWorkspace／Selection／Geometry・Document IDsによるscope復帰・入力破棄・二段階resetの配列参照と既定値／採番／session、画像操作二回のreset、例外の同一参照・停止位置と後続の無処理、繰返しresetを確認する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-document-editing-reset-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量83%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はDocumentLoading／DocumentApplicationとGeometry・Block・Instance persistenceの生成依存を分析する。decode／候補検証が成功する前に現在Documentをresetしないこと、Tree状態の退避／復元、install先のDocumentと編集scope、line repair・既定寸法・採番復旧・外観／drawing orderの更新順を確認する。codecの互換性責務と編集状態のresetを区別し、共有registry／ID ownerを増やさず、生成を束ねるだけの薄いfileを追加しない。Hatch描画は既存境界で維持し、必要な依存整理が見つかった時点で再検討する。


### 注記表示の生成・接続

AnnotationDisplayへColor／Renderer／Layerの生成・接続とframe／resize／Leader終端handleの表示規則を集約した。同じSelection／hover／export／実効外観とCanvasSurfaceを共有し、後段のAnnotation drag／commandはresize可否とpreviewの遅延callbackで参照する。アンカー解決、文字layout・Leader geometry、色の優先順位、保存frameのPNG表示、投影／編集不可・active／anchorのhandle抑制を維持する。Anchor materializationとモデル編集は既存ownerに残す。app.jsは3,437→3,433行（4行減）、今回の再開から3,652→3,433行（219行減）。

構文572ファイル・単体1,642件・関連E2E239件（3.8分）が成功（全runner exit 0）。関連はunified-ui／unified-annotations／annotation-anchors／leader-appearance／free-text-input-drag／annotation-display-size／png-export／phase0-characterizationで、file URL起動、選択／hover／投影／read-onlyの表示、frame／resize／Leader、アンカー追従と解除、既存画面比較、PNG・Undo／Redo・保存再読込を確認した。新単体4件は生成時のread遅延、色とframe／handle条件の共有、PNGでも保存frameは維持すること、elementとhover handleの同一性、遅延resize可否、Leaderのactive／投影／anchor／preview条件、アンカーの最新参照・保存座標無変更、通常表示の可視性とpreviewの違いを実Renderer／外観queryで確認する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-annotation-display-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量84%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はHatchRendererのcontent／Layerの生成・接続を分析する。境界Geometryの解決は既存HatchGeometryQueryに維持し、Geometry描画器の境界stroke、Sketch alpha、通常／Constructionの選択表示、PNG world bounds・alpha、previewの既存順序を確認する。後段のHatch commandとmode／hover／exportは現在の遅延readerで接続し、境界cacheやauthoring stateをもう一組作らない。静的なGeometry型・Painterと実行時の照会を区別し、単なる巨大contextへの移動を避ける。


### 寸法表示traversalの生成・接続

DimensionDisplay.createTraversalへ寸法のSelection bounds／Layerの生成・接続を統合した。前段で作成した同じplacement／metrics／layout／Painterを使い、後段のhover／drag／pending／export／statusはread portで操作時に読む。通常寸法とAnnotation表示寸法を含むdimensionPresentationScope、active順のsort、解決済み外観の一回受渡し、label・選択境界、PNG時のflags抑制を維持する。新しいstate・cache・fileは増やさない。app.jsは3,443→3,437行（6行減）、今回の再開から3,652→3,437行（215行減）。

構文570ファイル・単体1,638件・関連E2E169件（2.5分）・性能file全12件（48.9秒）が成功（全runner exit 0）。関連はunified-ui／multiple-dimensions／unified-annotations／phase0-characterization／png-export／annotation-display-sizeで、file URL起動、通常／Annotation寸法、矩形選択、既存画面比較、PNG・寸法移動・保存再読込を確認した。パンは147msで元の175ms未満の基準内。追加単体3件は後段組立て時のread遅延、合成scopeのsortとモデル配列／Object同一性、表示寸法ごと一回の外観解決、最新scope／defaults・文字サイズ／bounds・active／hidden短絡、hover／drag／Selection／inspection／編集／PNG flagsとCanvas保存復元を確認する。fixtureは既存CanvasSelection.set APIを使い、製品の選択規則は変更していない。このコードで全E2Eは未実行であり、最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-dimension-traversal-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量85%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はAnnotationRendererのColor／本体／Layerの生成・接続を分析する。文字layout・Leader geometry・描画は同じownerを共有し、選択／inspection／hover／PNGによる色・frame・handleの表示規則とアンカー解決を維持する。Annotation dragとcommandは後段に生成されるため、resize可否とpreviewは現在の遅延callbackとして接続し、未初期化constを早期に渡さない。Anchor materializationやモデル編集を表示featureへ混ぜず、表示用state・cacheをもう一組作らない。


### 寸法表示の生成・接続

DimensionDisplayへMetrics／Placement／Layout／Renderer／Painterの生成・接続を集約した。入力・drag・hit・Annotation・テスト支援にも同じmetrics／placement／layoutsを公開し、独自の計算やcacheを増やさない。layoutの省略外観fallback、Painterの解決済み外観受渡し、現在scopeの接続線、Canvas theme／式マークprobe、zoomとlabel配置を維持する。Input Controllerと表示traversalは既存の初期化位置に残す。app.jsは3,452→3,443行（9行減）、今回の再開から3,652→3,443行（209行減）。

構文570ファイル・単体1,635件・関連E2E152件（2.2分）・性能file全12件（48.6秒）が成功（全runner exit 0）。関連はunified-ui／multiple-dimensions／dimension-prefix／phase0-characterization／png-export／annotation-display-sizeで、file URL起動、既存画面比較、寸法表示・移動・編集、PNG・表示倍率・保存再読込を確認した。パンは151msで元の175ms未満の基準内。追加単体3件は生成時のCanvas／scope／外観の遅延、現在scopeの接続線とPoint同一性、最新Document既定外観と明示外観の受渡し、モデル無変更、実Painterの直線／角度描画とscope・zoom変更、式マークprobe・theme flags、編集時label非表示とCanvas save／restoreを確認する。このコードで全E2Eは未実行であり、最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-dimension-display-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量86%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は同じDimensionDisplayからDimensionPresentationのSelection bounds／Layerを生成・接続する境界を分析する。寸法labelは先に生成され、Layerは後段のdrag／export／hover／pendingを操作時に読む。初期化順・dimensionPresentationScopeの実体とsort・一回の外観解決・選択境界／描画の同じmetrics／placement／Painterを保ち、別の描画stateや早期読取りを増やさない。入力Controllerの確定処理やモデル編集を表示側へ混ぜない。


### 寸法ドラッグの生成・接続

DimensionDragFeatureへDimensionLineGroup、選択group照会、角度同期とDimensionDragの生成・接続を集約した。DimensionLineGroup.createSelectionへ現在scope・Sketch権限／可視性・寸法実効外観の照会を分離し、純粋なgroup配置計算とは別factoryにした。dragとcontext整列・入力／menu判定は同じ入口を使い、既存DimensionDragだけがsessionを所有する。既存配置、pointer capture、継続command click、display／label offset、角度参照値、通知と履歴の順を維持する。app.jsは3,468→3,452行（16行減）、今回の再開から3,652→3,452行（200行減）。

構文568ファイル・単体1,632件・関連E2E165件（2.4分）が成功（全runner exit 0）。関連はunified-ui／multiple-dimensions／dimension-prefix／sketch-permissions／blocksで、file URL起動、複数寸法の移動／整列と非平行時の単独操作、角度寸法、権限、Block scope、Undo／Redo・保存再読込を確認した。新単体4件は生成時の遅延、現在scopeへの所属と権限／可視性・実効外観の更新、Object同一性と選択無変更、実配置によるgroup移動／整列とsnapshot・一回の履歴、guard拒否と元のhits／3px閾値、角度同期・参照値維持とresetを確認する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-dimension-drag-feature-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量87%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は寸法表示のMetrics／Placement／Layout／Renderer／Painterの生成依存を分析する。既存の寸法入力・drag・hit・Annotationと共有する同じ配置／metricsを維持し、描画専用ownerと入力Controllerを区別する。解決済み外観の受渡し、Canvas probe・PNG描画・label配置と単独呼出しのfallbackを保持し、巨大contextや描画間cacheを導入しない。


### Properties対象context

PropertySelection.selectedDisplayTargetへProperties対象のlock／readOnlyと所有Sketch／作図Sketch labelの照会を統合した。元のraw対象APIと優先順位を維持し、複数対象は全ownerでlock判定・先頭ownerのlabelを使う。現在registryの置換、lock／名前／作図Sketch変更は操作時に取得し、選択配列とモデルObjectを変更しない。appの早期callback用hoisted入口は委譲だけを残し、Properties表示・Controller・palette・観測の同じ入口を保つ。新しいファイルやstateは増やさない。app.jsは3,476→3,468行（8行減）、今回の再開から3,652→3,468行（184行減）。

構文566ファイル・単体1,628件・関連E2E175件（2.6分）が成功（全runner exit 0）。関連はunified-ui／sketch-permissions／free-instance／blocksで、Properties表示・編集、ロック／参照表示、配置中対象、file URL起動、Undo／Redo・保存再読込を確認した。追加単体3件は生成時の遅延、registry置換と名前／lock／作図Sketchの最新照会、raw対象・選択配列・モデルの無変更とObject同一性、複数owner判定／先頭label、inspectionのreadOnly維持、Sketch／操作中対象の優先順位と所属不在を確認する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-property-target-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量88%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はDimensionDragとDimensionLineGroup、角度同期の生成・接続と選択group照会を分析する。現在scopeへの所属、Sketch編集／可視性、寸法の実効外観、parallel groupのsnapshot、drag時とcontext整列時の共通入口を確認する。純粋な配置計算とSelection照会、sessionの所有を区別し、pointer capture／継続command click／historyの順を保ってまとまった責務へ寄せる。巨大contextや新たなdrag stateは作らない。


### Properties編集の生成・接続

PropertyEditingFeatureへGeometry／Appearance／Bulk／SelectionVisibility／Elementの編集commandと共有AppearanceEditingの生成・接続を集約した。表示・対象決定・操作stateは移さず、現在scope、guard、snapshot／復元、Parameter安定化、投影metadata同期、anchor具体化、cache無効化と履歴／通知の順序・範囲を維持する。外観変更、複数編集、派生Instanceを含む可視性変更は同じ値変換とcommandを共有し、palette／Document設定にも同じ変換入口を渡す。app.jsは3,495→3,476行（19行減）、今回の再開から3,652→3,476行（176行減）。

構文566ファイル・単体1,625件・関連E2E205件（3.0分）が成功（全runner exit 0）。関連はunified-ui／blocks／free-instance／unified-annotations／dimension-prefix／hatching／reference-imagesで、file URL起動、Properties編集、外観継承、ロック、Undo／Redo、保存再読込を確認した。新単体4件は生成時の無処理、現在scopeでの接線拘束拒否と失敗checkpoint復元、通常／派生対象の可視性変更・guardと一回の履歴、単体／複数／外部設定での同じ値変換、anchor具体化と参照画像previewを確認する。新fixtureの外観fieldは既存の対応項目lineWidthと正規化上限10に合わせた。製品の正規化規則や既存期待値は変更していない。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-property-editing-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量88%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はappに残るProperties対象のロック判定・所有Sketch／作図Sketch labelを分析する。既存PropertySelectionへ読み取り専用の表示対象照会として統合できるか確認し、元のraw対象優先順位とObject参照を維持する。権限guardやモデル編集を照会側へ混ぜず、新たな小ファイルや可変contextを作らない。


### Properties表示の生成・接続

PropertiesDisplayへPropertyRows／PropertyPresentation／PropertiesContent／PropertiesViewの生成・接続を集約した。PropertySelection、Geometry／Dimension／Annotation外観、Block／Instance投影とGeometryReadModelの同じownerを使う。対象決定とモデル編集は移さず、共有AppearanceControlsはpalette／Document設定にも使うため外で生成する。Controllerの元のinput／change／click関数をそのままViewへ渡し、eventのreceiverを維持する。section開閉とDOM lifecycleは同じPropertiesViewが所有し、Contentからのsection callbackは生成後のrender時に解決する。app.jsは3,516→3,495行（21行減）、今回の再開から3,652→3,495行（157行減）。

構文564ファイル・単体1,621件・関連E2E205件（3.0分）・性能file全12件（47.9秒）が成功（全runner exit 0）。関連はunified-ui／blocks／free-instance／unified-annotations／dimension-prefix／hatching／reference-imagesで、file URL起動、Properties編集、型別表示、継承、参照画像、保存再読込を確認した。パンは135msで元の175ms未満の基準内。新単体3件は生成時のDOM／data遅延、実際のRow／Presentation／Content／Viewとread ownerによる最新外観／scope置換／HTML escape、モデル無変更、Controllerの同じ関数とreceiver、実PropertySelectionの混在値・read-only、section開閉の継続とDOM不在の短絡を確認する。このコードで全E2Eは未実行であり、最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-properties-display-{check,unit,related,performance}.log。全runnerの終了を回収済み。

週枠残量89%で継続中。次の候補はProperties編集／複数編集／可視性変更の生成依存。mainは停止条件到達時の最新全体検証後に反映する。

### 前単位の記録

### Block開始・取消・確定コマンドの生成

BlockEditingFeature.createCommandsへBlockDefinitionCommand／BlockCompletionCommandの生成・接続を集約した。model側で作成したediting／Session／queryを共有し、host捕捉も一つのadapterを使う。choiceDialog準備後にcommandを生成し、後段BlockViewはcallbackで操作時に参照する。確定のhost復帰は同じDefinitionCommand.restoreHostへ接続し、Editor表示の同期を省略しない。既存の開始・取消・検証・確認・確定・求解・履歴と失敗復元は各commandに残し、追加Session／model／確認状態は作らない。appから不要になったrestoreHost／依存循環／参照Instanceのaliasも除いた。app.jsは3,533→3,516行（17行減）、今回の再開から3,652→3,516行（136行減）。

構文562ファイル・単体1,618件・関連E2E199件（2.8分）が成功（全runner exit 0）。関連はblocks／block-geometry-fixed／unified-ui／free-instance／derived-selection-copy／hatching／parameter-dialog-controller。file URL起動、入れ子編集、取消、回転確認、拘束、Parameter、複写、保存再読込を確認した。追加単体3件は生成時の遅延と共通host捕捉、既定名とID owner、同じSessionの開始／取消、確認の多重要求抑制・取消後の再要求・確定前のhost復帰と一回の履歴、拒否時と取消後の古い応答での無変更を確認する。新fixtureは既存の「選択から作成した場合に回転確認」と選択queryの独立した配列という契約に合わせ、製品側の条件や期待値は変更していない。この単位で全E2Eと性能fileは未実行。最終main反映前には最新コードで全体検証する。ログは一時ディレクトリのcad-block-commands-{check,unit,related}.log。全runnerの終了を回収済み。

週枠残量90%で継続中。次の候補はProperties表示側の生成・接続。mainは停止条件到達時の最新全体検証後に反映する。

### 前単位の記録

### Block下書き・Session・照会の生成

BlockEditingFeatureへBlockDefinitionEditing／BlockEditorSession／BlockEditingQueriesの生成・接続とhost捕捉／復元adapterを集約した。既存のcatalog・投影・Instance・constraint rebinding・Document ID ownerを共有する。下書き・Session・rollback・queryの所有者は変更せず、同じSessionを各入口から利用する。host捕捉はworkspace.capture→viewport.snapshot、復元はworkspace.restore→既存activateEditingScope→viewport.updateを維持し、model alias／Solverの切替とread cache無効化は従来app入口へ委譲する。viewportは後段生成のためgetterで操作時に読み、生成時のscope／registry／採番／履歴操作は追加しない。app.jsは3,549→3,533行（16行減）、今回の再開から3,652→3,533行（119行減）。

構文562ファイル・単体1,615件・関連E2E199件（2.9分）が成功（全runner exit 0）。関連はblocks／block-geometry-fixed／unified-ui／free-instance／derived-selection-copy／hatching／parameter-dialog-controllerで、file URL起動、入れ子編集、取消、拘束、Parameter、複写、保存再読込を確認した。新単体5件は生成時の遅延と現在registry、入れ子のhost配列・viewport・独立履歴、実Geometry clone／apply／取消でのObject同一性とrevision、stageChildrenのregistry復元と共有query、host捕捉失敗の停止位置を確認する。この単位で全E2Eと性能fileは未実行であり、前単位の結果を最新コードの全件成功として流用しない。最終main反映前には最新コードで全体検証する。ログは一時ディレクトリのcad-block-feature-{check,unit,related}.log。全runnerの終了を回収済み。

週枠残量91%で継続中。次の候補はBlock開始／取消／確定コマンドの生成依存。mainは停止条件到達時の最新全体検証後に反映する。

### 前単位の記録

### Geometry read側の生成・接続

GeometryReadServicesへBlockCatalog／InstanceProjection／BlockProjection／GeometryReadModelとGeometry・Dimension・Annotation Appearance queryの生成・接続を集約した。固定containerから既存ownerのAPIを返し、modelやcacheを複製しない。同期read窓と外観memoはGeometryReadModel、Block投影cacheはBlockProjectionに残す。Geometryのworkspace.current、Dimension／Annotationの従来model aliasを読むcurrentSketches、DocumentのBlock registryを別々の入口として維持する。Hatchの解決とprimitive照会は注入し、空間照会・Annotation描画・選択やcommand状態は取り込まない。生成時のscope／view／profile読取りを追加せず、後段の依存は操作時に解決する。app.jsは3,562→3,549行（13行減）、今回の再開から3,652→3,549行（103行減）。

構文560ファイル・単体1,610件・関連E2E205件（2.9分）・性能file全12件（48.1秒）が成功（全runner exit 0）。関連はunified-ui／blocks／sketch-projection／derived-selection-copy／free-instance／hatchingで、file URL起動、投影参照と継承、Block編集、複写、保存再読込を確認した。パンは166msで元の175ms未満の基準内。新単体5件は生成時の遅延、現在registry、実Block／派生投影のObject・参照同一性と入れ子read窓、外観と別のSketch読取り源、同一IDでのscope／定義置換と無効化、Hatch解決の委譲を確認する。新しいfixtureは既存の先祖Sketch制限・parentSketchId・注記継承の形式に合わせ、製品側の規則は変更していない。このコードで全E2Eは未実行。最終main反映前には最新コードで全体検証する。ログは一時ディレクトリのcad-geometry-services-{check,unit,related,performance}.log。全runnerの終了を回収済み。

週枠残量92%で継続中。次の候補はBlock編集の下書き／Session／照会の生成依存。mainは停止条件到達時の最新全体検証後に反映する。

### 前単位の記録

### 通常UIと選択表示の更新進行

ApplicationRefreshへ通常UI更新、Geometry選択更新、Sketch／Properties更新のprofile境界を集約した。Annotation resize選択の同期、Parameter名前空間の準備、refreshAnalysis省略指定、Document名／Toolbar／Tree／Block／Properties／Status／拘束button／翻訳／寸法入力とProperties inertの順序を保つ。選択更新は解析やTree全再生成を行わず、Block dialogが開いている場合だけBlock表示を更新する。appのhoisted入口から委譲し、後段で生成するview／AnnotationDrag／dimension inputは操作時に読取り、生成時には実行しない。新たなmodel／cache／sessionや共通resetは作らない。app.jsは3,591→3,562行（29行減）、今回の再開から3,652→3,562行（90行減）。

構文558ファイル・単体1,605件・関連E2E163件（2.3分）・性能file全12件（47.9秒）が成功（すべてexit 0）。関連はunified-ui／blocks／sketch-permissions／parameter-dialog-controller／command-panel／annotation-display-sizeで、file URL起動も確認した。パンは149msで元の175ms未満の基準内。新単体4件は生成時の遅延、現在の名前空間と選択の更新、選択更新の範囲／dialog条件、ui／tree／propertiesのprofile包含、DOM不在と例外時の停止境界を確認する。最新コードで全E2Eは未実行。前単位の失敗履歴とその後の関連検証を区別し、最終main反映前には最新コードで全体検証する。ログは一時ディレクトリのcad-application-refresh-{check,unit,related,performance}.log。全runnerの終了を回収済み。

週枠残量93%で継続中。次の候補はGeometry read側の生成依存。mainは停止条件到達時の最新全体検証後に反映する。

### 前単位の記録

### 寸法外観の解決と描画への受渡し

寸法外観の解決と描画への受渡しを整理した。DimensionPresentationのlayer／Selection boundsが解決した外観をラベルと線形／角度painterへ渡す。GeometryAppearanceQueryは表示値の整形をdimensionDisplayStateForAppearanceへ分離し、既存のqueryと解決済み外観の両方から共有する。描画間cacheは作らず、次のdraw、Document／Sketchの外観変更、同一IDの別Objectやscope置換を新しく評価する。従来の単独label／painter／previewの呼出しは外観が渡されなければ従来どおり取得する。描画順・可視性短絡・PNG flags・Canvas状態・precision／affix／公差・保存形式は維持する。app.jsは3,591→3,591行（0行変化）。

構文556ファイル・単体1,601件・関連E2E157件（2.2分）・性能file全12件（48.4秒）・固定3回の性能case（9.9秒）が成功（すべてexit 0）。関連はunified-ui／dimension-prefix／png-export／drawing-order／phase0-characterization／unified-annotationsで、既存画面比較も含む。パンは全性能実行で131ms、固定3回は151／150／135msで元の175ms未満の基準内。基準や期待値は変更していない。最新コードで全E2Eは未実行であり、前単位の583成功・1失敗を全成功へ書き換えない。最終main反映前の最新コードで全体検証する。

変更前のCPU診断は同じ選択／削除／Undo／Redo／ツリー展開／zoom後に3回実施し、normalizeDimensionAppearanceの重複解決を主な負荷として観測した。変更後も描画4回を維持し、合計描画時間は変更前47.6／41.7／39msに対して42.5／35.7／36ms。診断全体の時間にはばらつきがあり、Profiler計測をE2E合格の代用にしない。診断scriptとbefore／afterログは一時ディレクトリのcad-pan-fullstate-profile.cjsとcad-pan-fullstate-{before,after}.log。検証ログはcad-dimension-appearance-{check,unit,performance,pan-repeat,related}.log。全runnerの終了を回収済み。

週枠残量94%で継続中。次はUI更新の調整を分析する。mainは停止条件到達時の最新全体検証後に反映する。

### 前単位の記録

### Geometryドラッグの生成・接続

GeometryDragFeatureへGeometryDragSolver／GeometryDragPlan／GeometryDragEditing／GeometryDragと派生Instance entryの生成・接続、preview／finishのprofile接続を集約した。appはbuild／prepare／preview／finish／beginDerivedとcommand／targetConstraintCountを共有し、Annotation／Block／テスト支援も同じ入口を使う。数値進行のWeakMap、snapshot、入力session、復元／onEnd／historyは既存ownerに残し、計算方法・許容値・保存形式・UIを変更していない。app.jsは3,622→3,591行（31行減）、今回の再開から3,652→3,591行（61行減）。

構文556ファイル・単体1,600件は成功（exit 0）。全E2E584件は583成功・1失敗（25.7分、exit 1）。失敗はmiddle-button-pan 178ms（基準175ms未満）。航空機は全96経路・1,872previewを7.5分で成功（最大276.9ms、失敗0）。フィレット3,744preview・オフセット10,296previewも成功した。全体結果を回収後、変更前54fbaf1の独立worktreeと現在版で同じ性能caseを固定3回ずつ順番に比較し、両版とも2成功・1失敗。変更前panは163／177／162ms、現在版は160／150／183msだった。変更前にも同じ基準超過が存在し、panは変更のないCanvasNavigation／Canvas描画経路を通る。今回の分離だけが原因とは判断できないが、全テスト成功や性能問題解消とは扱わない。期待値・性能基準は変更していない。

ログは一時ディレクトリのcad-drag-feature-{check,unit,full-e2e,baseline-performance,current-performance}.log。全runnerの終了を回収済み。新単体5件は遅延読取りとscope置換、実際のplan〜commandによる座標更新と履歴、失敗復元、権限／投影拒否、派生座標変換、例外時のprofile／onEndを確認する。

週枠残量95%で継続中。変更前にも再現するpan性能超過を次に切り分ける。mainはまだ反映しない。

### 前単位のSketch投影

SketchProjectionFeatureへ投影元query／commandの生成・接続、矩形候補取得、旧投影拘束の形状編集guardを集約した。shared queriesと読込時editingは従来の初期化位置・所有者を維持する。source factoryはcommandと同時に生成するがscope等を読まず、後段のoperand変換と矩形照会は操作時に委譲する。staged sources、重複・coverage判定、確定時の再照会、取消・履歴、Sketch権限の短絡と共有node判定、文言、保存形式は変更しない。巨大contextや新cacheは追加していない。app.jsは3,652→3,622行（30行減）。

構文554ファイル・単体1,595件・関連E2E140件が成功（全runner exit 0、E2E1.7分）。関連はsketch-projection／sketch-projection-compatibility-driver／sketch-permissions／command-panel／unified-uiであり、file URL起動も含む。このコードで全E2Eは未実行。新単体4件は遅延依存とscope置換、source共有と確定のObject同一性、権限短絡／共有node／稼働判定、確定時coverage再確認／取消を確認する。ログは一時ディレクトリのcad-projection-feature-{check,unit,e2e}.log。

週枠残量97%で継続中。次の境界分析は再開手順section 8を参照する。mainは前回releaseの5ee5f3fを維持し、今回の単位はdevelopまで統合する。

## 前回の再開・停止地点（2026-10-16）

最新の検証済みコードはaa9e3af（develop統合1be84e3）。構文552ファイル・単体1,591件・全E2E584件が成功（全E2E23.7分、exit 0）。app.jsは今回の3,949→3,652行（297行減）、直近の照会整理は3,652→3,652行（0行変化）。週枠残量49%の停止条件に達したため、この記録を保存後mainを最後に反映してdevelopと同期し、一時停止する。数百行への全体目標は未完了。再開時の判断と以前の失敗経緯はrefactoring-policy-and-resume.mdのsection 8を参照する。

### 寸法描画内のActive照会

DimensionPresentationの同じdraw内で、同一constraint ObjectのActive判定を共有した。従来はsort comparatorと色判定からSketch照会を繰り返していた。必要時に取得し次のdrawでは再評価するため、scope切替・同一IDの別Object・Active変更を持ち越さない。既存配列へのin-place sort、非active→activeの安定順、可視性の短絡、PNGのflagsとCanvas保存／復元を維持する。app.jsは3,652→3,652行（0行変化）。構文552ファイル・単体1,591件・関連E2E129件成功（通常UI／寸法／PNG／描画順117件1.5分、性能12件48.1秒、パン161ms）。この単位では全E2E未実行。

### Sketch所属の正規化と照会

SketchContext.membershipQueryが同期照会の入口で正規化を行い、現在Sketchと所属の読取りを返す。既存のelementSketchIdとresolverを共有し、照会をまたぐcacheや別の所属規則を持たない。ConstraintAnalysisは参照有効性の更新後、ConstraintTestDriverは解析更新後に取得し、appは生成済みAPIを接続する。app.jsは3,652→3,652行（0行変化）。構文552ファイル・単体1,590件・関連E2E168件が成功（通常UI／Block／対称拘束144件、権限11件、航空機1件9.2分、性能12件55.2秒）。航空機の全96経路・1,872previewが元の10分制限で成功し、性能基準も変更していない。この単位では全E2E未実行。

### 拘束状態観測の重複取得

航空機の時間超過を調査し、ConstraintTestDriver.createStatusObservation内で各要素ごとに現在Sketchを読み直していた処理を、解析更新後の1回へ整理した。Sketch取得はSketch全体の正規化を伴うため重複処理を減らす。返却する状態やSolver、テストの期待値・制限時間は変更しない。app.jsは3,652→3,652行（0行変化）。構文552ファイル・単体1,588件・関連E2E3件が成功。同じ航空機2経路の全resultは計測時間を除いて修正前と完全一致したが、元の96経路のE2Eは今回も10分timeoutとなった。時間超過解消や全テスト成功とは扱わない。

### Trim機能とテスト支援の生成・接続

TrimQuery／TrimEditing／TrimCommandをTrimFeatureへ集約し、同じquery／editingをTrimTestDriverのfixture組立てにも接続した。scopeと倍率は操作時に読み、既存のcheckpoint、拘束転送、失敗時の復元と選択解除順を維持する。appの早期プレビューcallbackはhoisted入口を残し、初期化時のモデル読取りを増やさない。app.jsは3,658→3,652行（6行減）。構文552ファイル、単体1,587件、読込E2E1件、関連E2E143件（unified-ui／blocks142件＋操作性能1件）が成功。全E2Eはこの単位では未実行。

### Fillet機能の生成・接続

FilletGeometry／FilletConstruction／FilletCommandは他機能から直接利用されていないことを確認し、新しいFilletFeatureへ生成と接続を集約した。同じcommand objectを返し、firstLine／半径入力／reset／snapshotと安定化失敗時の復元は既存FilletCommandへ維持する。Geometry／選択／pending／値入力／checkpointは既存ownerを共有し、選択線・pointer・開始準備と安定化は操作時に読む。計算と生成factoryは副作用を持たないためcheckpoint生成後のcommand生成位置へ集め、Trimの生成と役割は変更しない。入力状態や履歴の独立コピーを増やさず、現在未使用のstart aliasも外した。注入するUI通知は依然多く、app全体の可変contextへ隠さない。

app.jsは3,665→3,658行（7行減、今回再開から291行減）。実Fillet計算／生成／command／checkpointを接続するunit3件を追加し、生成時のscope無読取り、前選択からの半径入力・7拘束と円弧の生成、安定化拒否と円弧生成失敗で異なる選択保持／解除と端点Object・配列・採番復元を確認。構文550ファイル・単体1,583件・読込E2E1件・関連E2E107件成功（すべてexit 0）。関連はunified-ui／command-panel全106件（1.4分）と編集性能1件（4.4秒）。index.html／構文一覧／unit一覧／file URLの読込順期待を同期。ログは一時ディレクトリのcad-fillet-feature-{check,unit,loader-e2e,e2e,performance-e2e}.log。全E2Eは今回未実行。全体目標は未完了。

### Offset機能の生成・接続

GeometryCreation／snapはDXF・Trim・投影等にも共有されるため、基本作図へ一括で取り込まないことを確認。まとまりの明確なOffsetの5factory（計算→生成→command→preview renderer→layer）を新しいOffsetFeatureへ集約した。Geometry計算・配列／採番復元・入力確定・描画は既存ownerへ残し、現在scope・採番・選択・pending・previewを同じ所有者で共有する。選択の順序と反映、pointer更新、値入力のadapterを内部へ集め、外部にはplans／command／previewLayer／単体生成／closedを補うchainDraftを公開。新しいmodel・cache・独立sessionやアプリ全体の可変contextは作らない。既存通知callbackは多く残るが、Offsetの公開境界を超える状態操作を追加しない。appで不要になった計算・入力aliasは撤去し、早期のOffsetSelection通知入口は維持する。

app.jsは3,688→3,665行（23行減、今回再開から284行減）。実Offset計算・Geometry生成・選択・command・描画を使うunit4件を追加し、生成時のscope無読取り、source／既定chain plan、値入力と成功生成、scope差替えと拒否時の配列／採番復元、現在mode／pointerによる円previewを検証。構文548ファイル・単体1,580件・読込E2E1件・関連E2E143件成功（すべてexit 0）。関連はunified-ui／blocksの全142件（1.9分）とadversarial-authoring-performanceのOffset等編集操作1件（4.4秒）。classic scriptはindex.html／構文一覧／unit一覧／file URLの読込順期待を同期。ログは一時ディレクトリのcad-offset-feature-{check,unit,loader-e2e,e2e,performance-e2e}.log。unitの最終assert強化後も全unitを再実行・成功し、新testの構文を確認。全E2Eは今回未実行。全体目標は未完了。

### 通常Canvasの描画進行とAnnotation preview

drawInteractiveCanvasの描画順を既存CanvasSurface.createInteractiveRendererへ集約し、Annotation previewの読取りとleader／text振分けは既存AnnotationRenderer.createLayer.drawPreviewへ移した。通常CanvasはBlock handleからPNG操作overlayまでの18段階を維持し、寸法／注記／作図／配置／Offsetの既存描画器と描画用入口だけを受ける。Document／操作stateの可変contextは渡さない。previewは段階到達時に1回読み、leaderはtrue、truthyな非leaderは既存色で描く。appはannotationCommandの遅延読取りとnullable PNG commandのoverlayを接続し、receiverと現在scaleの参照時点を保持。createFrameRendererの通常／PNG分岐と出力経路は変更せず、新たなcatch／finallyやcleanupも加えない。

app.jsは3,704→3,688行（16行減、今回再開から261行減）。既存canvas-surface unitへ2件、annotation-renderer unitへ1件追加し、全段階順・renderer receiver・現在method参照・例外時の後続抑止、previewの1回読取り／引数／空値と保存注記の照会をしないことを確認。構文546ファイル・単体1,576件・関連E2E185件成功（すべてexit 0、E2E2.8分）。unified-ui／png-export／annotation-anchors／phase0-characterizationの全4fileでPNGと画面比較を含む。ログは一時ディレクトリのcad-interactive-canvas-pass-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### Treeのhover状態の照会

sketchTreeObjectHoveredを既存SketchTreeObjects.createの内部へ集約し、従来の外部predicate注入をreadCanvasHover／readSidebarHoverの2読取りへ置換した。Hatch／画像／Block／派生Instance／AnnotationはCanvasHoverの対応field、それ以外はSelectionHighlightの現在itemを同一参照で照合する。固定PointとConstraintのentry解決、dimensionからconstraintへの既存変換、関係ない側のhoverを読まない短絡を維持する。同IDの別Objectを一致にせず、状態複製・同期・書込みを加えない。Tree行と既存hovered公開APIは同じ内部判定を利用し、appは状態所有者からの読取りだけを接続する。新factoryは増やしていない。

app.jsは3,712→3,704行（8行減、今回再開から245行減）。既存sketch-tree-presentation unitへ3件追加し、カテゴリ別の参照元・現在値・Object同一性、固定Point／Constraint／dimension解決、Tree行の強調と非破壊性を確認。構文546ファイル・単体1,573件・関連E2E158件成功（すべてexit 0、E2E2.2分）。unified-ui／blocks／hatchingの全3file。ログは一時ディレクトリのcad-tree-hover-query-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### Treeの選択状態の照会

sketchTreeObjectSelectedを既存CanvasSelectionへ集約し、appは同メソッドを既存SketchTreeObjectsへ接続する。inspectionのcategory＋同一Object／truthyな同一ID照合、通常のHatch／画像／Block／派生Instance／Annotationの同一参照包含、固定Pointと通常Constraintの違いを維持した。Geometry／Constraintは同ownerの既存照会を使用し、Arcの未選択時に既存照会が返すundefinedもBoolean化しない。モデルや選択stateを変更せず、DOM・hover・求解・履歴・追加callback依存を持たない。appの未使用になったgeometryItemSelectedInCanvas aliasも同じ区切りで外したが、元APIは維持する。

app.jsは3,724→3,712行（12行減、今回再開から237行減）。既存selection unitへ3件追加し、inspectionのcategory／IDと状態保持、各カテゴリのObject包含、固定Point・寸法・effective constraintの優先、通常LineとArc端点選択を確認。構文546ファイル・単体1,570件・関連E2E135件成功（すべてexit 0、E2E1.9分）。unified-ui／sketch-tree-visibility／derived-selection-copyの全3file。ログは一時ディレクトリのcad-tree-selection-query-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### Tree／Canvas候補の共用Toolbarアイコン

toolbarSvgMarkup／constraintToolbarIconを既存ToolbarView.createIconsへ集約。調査でSketchTreeObjectsだけでなくCanvasContextPresentationも使うことを確認し、Treeの状態に依存しない共用Toolbar表示APIとした。document・6拘束型・寸法判定だけを受け、現在DOMのSVG読取り・最初のsvgタグへの既存class付与・欠損時空文字を維持する。固定flag／固定型→投影→中心線→寸法→既存の名前patternとcoincident fallbackの優先順もそのまま。appは生成結果の同じ2APIを両利用者へ接続し、cache・DOM変更・操作／選択／hover状態を加えない。参照は全て生成後なので不要なhoisted wrapperも残していない。

app.jsは3,738→3,724行（14行減、今回再開から225行減）。既存toolbar-view unitへ3件追加し、現在DOM／差替え・SVG欠損・markup非破壊、型とflagの優先・寸法短絡、全名前patternと欠損／未知のfallbackを確認。構文546ファイル・単体1,567件・関連E2E133件成功（すべてexit 0、E2E1.9分）。unified-ui／sketch-tree-visibility／block-geometry-fixedの全3file。ログは一時ディレクトリのcad-toolbar-icon-presentation-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### 操作名のステータス表示

updateStatusUIを既存ToolbarView.createCommandStatusへ集約。document・applicationText・mode／pending type／拘束commandの5依存だけを受け、操作stateを所有せず現在値を表示時に読む。statusCommandのDOM取得→21modeの現在言語表記構成→DOMありなら注記pending／拘束／mode名／raw modeの優先順を維持する。注記や拘束が優先される場合の下位stateの読取り短絡、DOMなし時の表記構成も保持。appはhoisted入口を同じUI更新順で呼び、Toolbarの他の更新・listener・操作遷移は変更していない。

app.jsは3,746→3,738行（8行減、今回再開から211行減）。既存toolbar-view unitへ3件追加し、表示優先順・全21modeの日英表記・未知mode・現在言語・DOM差替えと不在時短絡を確認。構文546ファイル・単体1,564件・関連E2E110件成功（すべてexit 0、E2E1.6分）。unified-ui／toolbar-layout／command-panelの全3file。ログは一時ディレクトリのcad-command-status-view-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### 作図時の暗黙拘束追加

addConstraintIfMissingの本体を既存ConstraintCommitCommand.ifMissingへ集約した。enabled一致の短絡、明示／現在Sketch、参照元許可→循環guard→既存markReferenceによる属性付与、push→冗長判定→同一Objectだけをfilterで除去→cache forgetの順序を維持する。既存依存を共有し、currentScopeとforgetConstraintだけを追加した。appのmodelはworkspace.activateの結果でのみ差し替わることも確認。通常のordinary／reference確定とは独立入口とし、求解・snapshot・UI・履歴・追加の権限guardを呼ばない。冗長時も元配列とconstraint属性を巻き戻さない。appはSnapConstraints／BasicDrawingToolsへ渡すhoisted入口を維持する。

app.jsは3,761→3,746行（15行減、今回再開から203行減）。既存constraint-commit-command unitへ4件追加し、空／enabled一致の無変更、disabled一致の除外、scope置換・明示Sketch、参照guardの短絡と属性、同一IDの別Objectを保持した除去とforget順を確認。構文546ファイル・単体1,561件・関連E2E126件成功（すべてexit 0、E2E1.7分）。unified-ui／spline／centerline／sketch-permissionsの全4file。ログは一時ディレクトリのcad-implicit-constraint-commit-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### 円弧端点dragの角度境界計算

arcEndpointDragValueを既存GeometryKernelへ集約。現在の開始／終了角にunwrapAngleNearで入力角を合わせ、signed sweepが2π−1e-6以上なら同じ正負の枝で一周直前に制限する。開始点はendAngle、終了点はstartAngleを基準とし、相手端点へ戻して円弧を縮退させない既存規則をそのまま維持した。入力Arc・操作state・求解・履歴を変更しない純粋計算で、appは同関数を既存GeometryDragPlanの端点処理へ渡す。新factoryやwrapperは追加していない。

app.jsは3,778→3,761行（17行減、今回再開から188行減）。既存geometry-kernel unitへ3件を追加し、複数周回の維持と非破壊性、開始／終了と正負両方向のalmost-full-circle境界、境界から離れる際の連続性・非clampを確認。構文546ファイル・単体1,557件・関連E2E115件成功（すべてexit 0、E2E1.6分）。unified-ui／block-geometry-fixed／fixed-commandの全3file。ログは一時ディレクトリのcad-arc-endpoint-angle-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### Annotationアンカー読取りと編集座標の具体化

annotationPlacementAnchorを既存AnnotationRendererの読取りAPIへ、materializeAnnotationAnchorを既存AnnotationAnchorConstraints.createMaterializationへ集約。前者はlayout優先とmetrics fallback、anchorX／anchorYのnullish判定を維持。後者は表示anchor・leader表示geometry・参照anchor・実効styleの4依存で、既存anchorPositionあり／captureなしでは保存座標だけを返し、未具体化またはcapture時は表示位置を読む。leaderは参照anchorまたはstartを基準にshelfScaleを逆適用しtextPlacementをanchorへ設定する。x／yとanchorPositionを書き込むのは既存anchorPositionがない場合だけで、styleを読む時機も同じ。appは早期生成される利用者へのhoisted入口を残し、履歴・UI・拘束確定は既存呼出し側へ維持する。

app.jsは3,792→3,778行（14行減、今回再開から171行減）。既存annotation-anchor-constraints unitへ3件追加し、既存anchorの照会短絡、captureで保存座標を保持、位置Objectの非共有、style読取り時点、leaderの逆変換と参照fallbackを確認。既存9位置・回転・倍率のテストからRendererのanchor読取りも確認。構文546ファイル・単体1,554件・関連E2E183件成功（すべてexit 0、E2E2.9分）。annotation-anchors／leader-appearance／unified-ui／free-text-input-dragの全4file。ログは一時ディレクトリのcad-annotation-anchor-materialization-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### 寸法label文字列の構成

dimensionLabelForConstraintを既存DimensionPresentation.createLabelへ集約した。readonly／測定値／角度変換／外観／拘束Sketch／通常と測定用のformatを限定した依存として受ける。参照寸法は現在の測定値と測定用丸め、通常寸法はtarget値、angle intervalは符号付きdegree、通常angleは既存angleDegreesを使用する。precision指定時のtoFixed、接頭辞・接尾辞・改行・片側公差の0補完・角度単位・参照括弧を維持する。NumberDisplayは数値format、DimensionQueriesは値の照会、GeometryAppearanceQueryは外観の所有を維持し、appは既存hoisted入口を接続する。元の本体を同じ順序で移し、生成時に寸法や現在scopeを読まない。

app.jsは3,800→3,792行（8行減、今回再開から157行減）。既存dimension-presentation unitへ3件を追加し、参照値のtarget非参照と測定用丸め、precision時のformatter短絡、通常／interval角度と距離、現在の外観・公差・非破壊性を確認。構文546ファイル・単体1,551件・関連E2E119件成功（すべてexit 0、E2E1.7分）。unified-ui／dimension-prefix／derived-patternsの全3file。ログは一時ディレクトリのcad-dimension-label-owner-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### 寸法外観の解決と表示値構成

effectiveDimensionAppearance／effectiveDimensionAppearanceForSketch／dimensionDisplayStateを既存GeometryAppearanceQuery.createDimensionへ集約。document・currentSketches・activeSketchId・isRootSketchの4依存で、操作時の現在Sketchとscope、明示されたBlock DefinitionのSketch一覧、Document寸法既定→終端既定→Root以外のSketch→個別displayの優先順を維持する。表示値のprecision制限、色fallback、接頭辞／接尾辞／公差の文字列化、終端・文字寸法の取出しを同ownerが担う。保存値を変更せず独自state／cache・UI更新を持たない。appは既存hoisted入口で利用者へ接続し、scopeを生成時に読まない。移動した3本体は明示したscope portの置換以外が元と一致することを確認。

app.jsは3,823→3,800行（23行減、今回再開から149行減）。既存geometry-appearance-query unitへ3件を追加し、遅延scope照会と置換、明示definition一覧、Root除外、外観優先順と表示値／非破壊snapshotを確認。構文546ファイル・単体1,548件・関連E2E144件成功（すべてexit 0、E2E2.0分）。unified-ui／blocks／dimension-prefixの全3file。ログは一時ディレクトリのcad-dimension-appearance-query-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### Offset入力状態のCanvas選択への反映

syncOffsetChainSelectionの選択更新本体を既存CanvasSelection.applyOffsetSelectionへ集約した。OffsetSelectionはsource／entries／確定状態・接続判定・通知を継続所有し、OffsetCommandは操作の進行を維持する。appはチェーン追加通知と円選択後の二経路を同APIへ接続する。sourceのCircle、entriesのLine／Arcを同じObjectで選択し、既存12項目のset順と選択解除対象を維持する。Spline／geometryInstances／instanceGeometryは変更せず、空反映時はTree／inspectionを一律解除しない。描画・UI・履歴・Offset resetを選択APIへ追加していない。

app.jsは3,836→3,823行（13行減、今回再開から126行減）。既存selection unitへ3件を追加し、同一参照／解除・保持対象、空反映のTree規則、実OffsetSelectionの追加・拒否・reset・円sourceの通知境界を確認。構文546ファイル・単体1,545件・関連E2E106件成功（すべてexit 0、E2E1.5分）。unified-ui／command-panelの全2fileで、線／円／円弧Offset・反転線・連結チェーン・既存取消を確認。ログは一時ディレクトリのcad-offset-selection-reflection-{check,unit,e2e}.log。新scriptなし。全E2Eは今回未実行。全体目標は未完了。

### 静的namespaceの未使用依存名を整理

app IIFEで未参照の静的alias58個を撤去した。ReferenceImageData／HatchData／Appearance／DrawingOrder／DocumentFiles／GeometryKernel／GeometryRef／HatchRegionEngine／ParameterEngine／GeometrySolver／DimensionQueriesに限定し、公開元が通常の値propertyでgetterや生成時の処理を持たないことを確認した。全aliasが不要だったHatchRegionEngineの直接destructureとcirclePointAtPointer宣言も削除したが、元namespaceの公開APIとscript読込を維持する。factory／sessionの生成、副作用の可能性があるその他の変数宣言には手を加えない。変更前の構文木から対象aliasだけを除いた構文木が変更後と一致することを検証した。

app.jsは3,885→3,836行（49行減、今回再開から113行減）。構文546ファイル・単体1,542件・関連E2E142件成功（すべてexit 0）。unified-ui／phase0-characterization／drawing-orderの126件（1.7分）とhatching全16件（13.7秒）で、既存保存形式・正規化・画面比較・描画順・Hatch再読込／Block投影を確認。ログは一時ディレクトリのcad-static-alias-{check,unit,e2e}.logとcad-static-alias-hatching-e2e.log。新規script／module／テストなし。全E2Eは今回未実行。全体目標は未完了。

### 分離済み責務の未使用旧入口の撤去

app IIFEのbindingを構文scopeで再監査し、参照のない関数宣言16個を撤去した。Instance参照正規化、Sketch階層照会、求解誤差、Block完了、作図解除、primitive判定、求解、配列削除、角度寸法描画、拘束完了・参照確定、primitive寸法開始と旧selectHitOnlyが対象。strict IIFE内の非公開宣言で、eval等の動的参照はなく、公開hookやcallbackは現役ownerへ接続されている。変更前後の残存top-level statement本文が同一であることも確認し、factory初期化やイベント登録は変更していない。新規module／状態／テストは追加していない。責務の再分離ではなく、移行後の重複経路と依存の整理である。

app.jsは3,949→3,885行（64行減）。構文546ファイル・単体1,542件・関連E2E156件成功（すべてexit 0、E2E2.8分）。E2Eはunified-ui／blocks／derived-patternsの全3fileで、寸法と拘束の既存UIケースを含む。ログは一時ディレクトリのcad-entry-audit-{check,unit,e2e}.log。全ケース／worker終了後に専用serverのみ残ったため、process実体を確認し同serverだけを終了して正常終了を回収。全E2Eは今回未実行。残る未参照124bindingは変数宣言であり、副作用・getter・生成時機を確認するまで自動削除しない。全体目標は未完了。

### 既存端点の解決とendpoint生成

endpointAtを既存GeometryCreation.createEndpointResolverへ集約。hit端点の同一参照優先→explicit Pointの現在座標で新endpoint→入力座標でendpoint生成という順序・引数を保持し、後続のhit queryには遅延callbackで接続する。既存採番／Sketch付与／scopeはaddPointへ、hit方針はGeometryHitQueryへ委譲。app内だけの未使用pointAtと未使用hitAnyPoint aliasを参照監査後に撤去した。新しいhit規則やPoint共有／固定の変更は加えない。

app.jsは3,956→3,949行（7行減、b120651から合計194行減）。新scriptなし。既存geometry-creation unitへ3件追加し、既存端点の同一性と無採番、explicitと別Object／固定状態・kind・所属、現在scope／IDと引数順を確認。構文546ファイル・単体1,542件・関連E2E154件成功（すべてexit 0、E2E2.2分）。unified-ui／spline／centerline／blocksの全4fileを実行。ログは一時ディレクトリのcad-endpoint-resolution-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は分離後に残った未参照の旧入口を監査する。Playwright同梱babelBundleのbabelParse(code,filename,false)とtraverseでapp IIFE scopeを調べ、未参照140binding中FunctionDeclaration候補16件を確認済み。変数initializerの副作用と区別し、自動一括削除せず関数／依存を現物で検証する。

### 寸法dragの角度constraint同期

DimensionDragだけが使うsyncAngleConstraintFromDimensionを同moduleのcreateAngleSynchronizationへ集約。三つの明示依存で型／target kind／dimension有無→readonly→既存角度計算→現在flip flags→target絶対値の順を保持し、既存dragの同期portへ接続する。新しい寸法計算や状態、guard／求解・履歴・例外回復は追加しない。

app.jsは3,960→3,956行（4行減、b120651から合計187行減）。新scriptなし。既存dimension-drag unitへ3件追加し、対象外の短絡・readonly無変更、同じtarget／dimensionとnull pointer、角度計算後のfield更新順、同一計算例外と値の保持を確認。構文546ファイル・単体1,539件・関連E2E121件成功（すべてexit 0、E2E1.7分）。multiple-dimensions／dimension-prefix／annotation-display-size／unified-uiの全4fileを実行。ログは一時ディレクトリのcad-dimension-angle-sync-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はendpointAtの既存端点優先／explicit Pointからのendpoint生成と、GeometryCreation・hit queryの責務を確認する。未使用のpointAtも参照を監査し、生成規則・ID・参照を変えずに整理する。

### 選択解決からの拘束適用

Toolbarと対象選択から使うaddConstraintの振分けを既存ConstraintCommitCommand.fromSelectionへ集約。SelectionQueryのresolutionとCanvasSelectionを明示portで受け、結果なし／errorの短絡、action／targetの寸法配置優先、同じresolution・null pointer・配置戻り値、通常constraintのarc pair解除→既存確定とundefined返値を維持する。既存guard／求解／回復・履歴は変更せず、新しい適用ルールを追加しない。appは先に生成する対象選択command用のhoisted delegateを残す。

app.jsは3,970→3,960行（10行減、b120651から合計183行減）。新scriptなし。既存constraint-commit-command unitへ3件追加し、解決なし／errorの無変更、寸法優先・参照／戻り値、通常確定成功と拒否時のarc pair解除順・undefined返値を確認。構文546ファイル・単体1,536件・関連E2E146件成功（すべてexit 0、E2E2.5分）。unified-ui／head-symmetry／multiple-dimensions／bolt-diameter／command-panelの全5fileを実行。ログは一時ディレクトリのcad-selection-constraint-application-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は寸法drag時の角度constraint同期（syncAngleConstraintFromDimension）の利用と既存DimensionDrag／寸法計算ownerを確認し、readonly拒否・flip／target更新の責務を整理する。

### Sketch切替の操作状態調整

SketchCommand.createInteractionResetへclearInteractionForSketchChangeの残る解除調整を集約。移動reset→Selection→drag／画像／矩形→作図下書き→pending／拘束→投影／Instance sources→hover／pointer／値入力→snap→mode→Toolbarの順序と各ownerの異なる入口を保つ。後続のGeometry／Dimension dragとnullableな移動commandは遅延callbackで参照し、履歴復元等へ渡すappのhoisted入口も維持する。bodyは明示capabilityへの置換以外一致。独自state・一般化したreset／rollback・例外後の強制復旧は追加しない。

app.jsは3,980→3,970行（10行減、b120651から合計173行減）。新scriptなし。既存sketch-command unitへ3件追加し、解除順とhover限定更新、pointer／input／modeの明示操作、late／nullable ownerの現在値参照、同じ例外と後続省略を確認。構文546ファイル・単体1,533件・関連E2E193件成功（すべてexit 0、E2E2.7分）。blocks／sketch-tree-visibility／sketch-move／phase0-characterization／unified-uiの全5fileを実行。ログは一時ディレクトリのcad-sketch-interaction-reset-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はaddConstraintの選択resolution→寸法配置／通常拘束確定の振分けと、ConstraintControlCommand／ConstraintCommitCommand／SelectionQueryの役割を確認する。既存guard・error／hint・arc endpoint pair解除と戻り値を保って所有者を選ぶ。

### Sketch切替の作図入力reset

clearInteractionForSketchChange内の連続する七つの作図resetを既存DrawOperationLifecycle.resetInputsForSketchChangeへ集約。追加依存なしで既存Line／Rectangle／Fillet／Circular／preview／Offsetのownerを利用し、順序を保持する。Document reset／通常cancelへ統一せず、元から対象でないSlot／Centerline／Spline／Hatchやrollbackを追加しない。前後のdrag・Selection、pending／constraint／instance／pointer／mode／Toolbar更新は元の位置に残す。

app.jsは3,986→3,980行（6行減、b120651から合計163行減）。新scriptなし。既存draw-operation-lifecycle unitへ2件追加し、限定reset順・他ownerの参照保持と無通知、途中例外の同一伝播と後続省略を確認。構文546ファイル・単体1,530件・関連E2E172件成功（すべてexit 0、E2E2.5分）。blocks／sketch-tree-visibility／sketch-move／unified-uiの全4fileを実行。ログは一時ディレクトリのcad-sketch-change-drawing-reset-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はclearInteractionForSketchChangeに残る操作状態の調整を既存SketchCommandの役割と照合する。dragやpointer等の後続初期化を遅延参照し、対象と順序を保って生成接続を整理する。

### Sketch移動中のTree外入力抑止

既存SketchTreeController.createMoveInputBindingへ移動中のdocument capture受付を集約。documentとisMovingの二portだけを受け、六eventの登録順、inactive時の短絡、Tree／resize handle許可、preventDefault→stopImmediatePropagationを維持。appは元の登録位置でbindし、二重登録防止・自己listenerだけのdispose／再bindを持つ。commandのstateや選択／移動／履歴を所有せず、Keyboardの別経路は変更しない。

app.jsは3,990→3,986行（4行減、b120651から合計157行減）。新scriptなし。新sketch-tree-input-binding単体fileを構文／unit一覧へ追加。3件でcapture登録と順序・生成／登録時無照会、live状態と許可領域／抑止順、外部listener保持と再bindを確認。構文546ファイル・単体1,528件・関連E2E111件成功（すべてexit 0、E2E1.6分）。sketch-move／unified-uiの全2fileを実行。ログは一時ディレクトリのcad-sketch-move-input-binding-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はclearInteractionForSketchChange内の作図下書きresetを既存DrawOperationLifecycleの所有と照合する。Document reset／通常cancelとは対象と順序が異なるため、単一resetに統一せず限定した入口を検討する。

### Properties表示とCanvas resizeのUI寿命

既存CanvasWorkspaceLayoutへ選択Propertiesの表示操作とtoggle／window resizeのlistener寿命を集約。パネル展開→Properties更新→現在panelの再取得とscroll初期化→hint、context menu解除→現在world中心→既存resizeの順を保持する。bindControls／bindWindowを元の起動位置へ接続し、二重登録防止・自己listenerだけのdispose／再bindを実装。DOM不在時のパネル無変更と、Properties更新／hintを継続する元の範囲を維持する。model・Selection・履歴を別に所有しない。

app.jsは4,001→3,990行（11行減、b120651から合計153行減）。新scriptなし。既存canvas-workspace-layout unitへ3件追加し、更新後panelの参照、中心保持・menu解除後のlive中心、現在classと登録寿命、外部listener保持、DOM不在の通知を確認。構文545ファイル・単体1,525件・関連E2E149件成功（すべてexit 0、E2E2.1分）。blocks／canvas-zoom-input／toolbar-layout／unified-uiの全4fileを実行。ログは一時ディレクトリのcad-workspace-layout-binding-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はSketch移動先選択中にTree外入力を抑止するdocument capture listenerを調べ、Sketch Tree／移動UIの所有者へ寄せる。対象六eventと許可領域、stopImmediatePropagationと登録順を保つ。

### ドラッグ検証用sample図面の所有

sampleModelがGeometryDragTestDriver.createResponsiveFixtureだけから使われることを確認し、既存fixtureのresetへ図面生成を統合。4点・4線・距離二つ／平行二つ／直交一つの拘束、寸法既定値・求解／logからfit160→draw→履歴初期化→serializeまでを一つのテスト準備として所有する。生成・拘束／求解・履歴APIは明示portで受け、独自ルールや状態を持たない。旧生成bodyはindent以外一致。通常appの関数とfixtureからappへ戻るsample生成依存を撤去し、既存公開hook名と結果を維持する。

app.jsは4,019→4,001行（18行減、b120651から合計142行減）。新scriptなし。既存geometry-drag-test-driver unitへ2件追加し、座標・固定状態と参照・拘束対象、効果と履歴の順序、再準備後のID／新Object、求解例外の伝播と後続省略を確認。構文545ファイル・単体1,522件・関連E2E122件成功（すべてexit 0、E2E2.4分）。公開hook利用先のadversarial-authoring-performance／view-visibility／toolbar-layout／unified-uiの全4fileを実行。ログは一時ディレクトリのcad-responsive-drag-fixture-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はPropertiesパネルの表示／toggleとCanvas resizeの残るUI操作・listenerを調べ、既存CanvasWorkspaceLayoutへ責務を寄せる。

### Centerlineの生成接続

BasicDrawingTools.createCenterlineへCenterlineGeometry／CenterlineConstruction／CenterlineCommandの三factoryの接続を集約。同じcommandを公開し、plan許容差、現在scope／Geometry／採番・snap拘束とcommit、preselection／guard／snap／preview／mode・表示の依存を明示する。各既存ownerのbody・stateと開始／確定／取消は変更しない。primitiveやSplineとは独立した入口に留め、巨大な統合stateやbuilderは持たない。

app.jsは4,020→4,019行（1行減、b120651から合計124行減）。行数効果は小さいが、三ownerの対応を組立てmodule側へ寄せた。新scriptなし。既存basic-drawing-tools unitへ実際のCenterline Geometry／Construction／Commandを使う3件を追加し、preselected対象の同一参照・support投影と構築、拒否時の配列長／採番復元と入力保持、既存command取消後の作図先拒否を確認。構文545ファイル・単体1,520件・関連E2E133件成功（すべてexit 0、E2E1.8分）。centerline／command-panel／phase0-characterization／unified-uiの全4fileを実行。ログは一時ディレクトリのcad-centerline-drawing-tools-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は利用先がGeometryDragTestDriver.createResponsiveFixtureだけのsampleModelを調べ、テスト用Geometry・拘束の初期化を既存fixtureへ寄せる。生成値・ID／Object参照・求解／通知／履歴順を維持する。

### Spline下書きと作図commandの組立て

SplineとCenterlineの開始・取消を比較し、まず共有draftを持つSplineの生成接続を既存BasicDrawingTools.createSplineへ集約。SplineDraftの生成をcommand生成位置へ移し、同じdraft／commandを描画・取消・入力へ公開する。投影reset、preview更新、作成Spline選択→mode selectのadapterを内部接続し、後続のSpline編集／blank gestureのresetは遅延callbackで維持。既存draftとcommandの処理本体は変更せず、reset・cancelとrollback、guard・確定・履歴を各ownerへ残す。Centerlineやprimitive toolsと単一の状態機械には統合しない。

app.jsは4,025→4,020行（5行減、b120651から合計123行減）。新scriptなし。既存basic-drawing-tools unitへ実際のSplineDraft／SplineCommandを使う3件を追加し、生成時無照会・開始拒否、点の参照共有・確定時copyと選択→mode→solve／履歴順、取消時の一時点／採番復元を確認。構文545ファイル・単体1,517件・関連E2E133件成功（すべてexit 0、E2E1.8分）。spline／command-panel／phase0-characterization／unified-uiの全4fileを実行。ログは一時ディレクトリのcad-spline-drawing-tools-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はCenterlineのGeometry plan／construction／command生成とpreselection・開始・取消の依存を確認し、既存ownerを保った組立て境界を整理する。

### 基本作図command群の機能組立て

BasicDrawingToolsへLine／Rectangle／Circular／Slotの六つのfactory生成接続と六つのclick入力を集約。GeometryCreation・採番・現在scope・DrawingSnap・SnapConstraints・Selection・preview・checkpointを明示接続し、共通preview callbackとsnap入力adapterを内部で共有する。四つのcommandは同じ参照、Line.clickは元の関数で公開し、残る入力はsnap解決→現在active snap→元commandメソッドの順を保持。各下書き・reset／取消・確定・求解／履歴を統一しない。Circular／Slotの生成を早めるが、既存factoryは生成時にモデルを触らず、後で初期化されるmutation checkpointには遅延callbackで接続する。巨大contextや独自状態は追加しない。

app.jsは4,054→4,025行（29行減、b120651から合計118行減）。新classic scriptのindex／構文／E2E読込順とunit一覧を同期。新単体3件で同じcommand・geometry／Selection／checkpoint参照、入力のsnap解決後の値とreceiver・現在メソッド、共有previewとLine snap入力を確認。構文545ファイル・単体1,514件・loader1件・関連E2E168件成功（すべてexit 0、E2E2.3分）。unified-ui／slot-dimension／phase0-characterization／command-panel／blocksの全5fileを実行。ログは一時ディレクトリのcad-basic-drawing-tools-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はSpline／Centerlineの開始・取消とDrawOperationLifecycleへの接続を比較し、状態所有と依存を整理できる機能単位を選ぶ。異なる操作を単一の巨大builderへ押し込まない。

### Canvasからの式参照入力

appのpickParameterDialogDimensionを既存ExpressionInputController.pickCanvasへ集約。Canvas／座標変換／寸法hit／注記hitの四つのportを加え、現在の入力先・namespace判定と挿入は同じowner内の既存処理を使う。Canvas範囲外での短絡と境界包含、activeOnly:false、寸法hit優先（挿入拒否時も注記へ進まない）、同じeventとworld座標、undefined返値を維持。早く生成するParameterEditorは遅延callbackで後のControllerへ接続する。新しいinput状態・Geometry／hit規則は持たない。

app.jsは4,059→4,054行（5行減、b120651から合計89行減）。新scriptなし。既存expression-input-controller unitへ3件追加し、範囲外の無照会、境界・寸法優先と拒否時短絡、注記fallbackと同じevent／座標／optionsを確認。構文543ファイル・単体1,511件・関連E2E115件成功（すべてexit 0、E2E1.7分）。parameter-dialog-controller／free-text-input-drag／unified-uiの全3fileを実行。ログは一時ディレクトリのcad-expression-canvas-picker-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は作図command群（Line／Rectangle／Slot／Circular等）の生成接続をまとまりとして確認し、既存commandが持つdraft・確定／取消とgeometry／snap／描画の依存を整理できる境界を選ぶ。巨大contextへまとめたり、行数だけの一括移動はしない。

### 保存済みBlock定義のParameter評価scope

ParameterStabilization.createStoredDefinitionへ保存済み定義の評価とscope復帰を集約。appのwithStoredDefinitionAsModel／stabilizeStoredBlockDefinitionを撤去し、Parameter適用とBlock依存伝播は同じstabilize入口を使う。五つの明示依存で現在scopeの同一参照、定義切替後のactive Sketch／描画Sketch照会、finallyでHatch採番最大値を保存してから前scope復帰、結果・例外の透過、入れ子評価の直前scope復帰を保持。新しいscopeスタック・採番・回復規則は追加しない。既存activateEditingScopeのmenu・Solver・cache更新を利用する。

app.jsは4,068→4,059行（9行減、b120651から合計84行減）。新scriptなし。既存parameter-stabilization unitへ3件追加し、生成時無照会、返値／参照、採番最大値と順序、評価例外後の復帰・同一例外伝播、入れ子評価を確認。構文543ファイル・単体1,508件・関連E2E161件成功（すべてexit 0、E2E2.3分）。blocks／parameter-dialog-controller／hatching／dimension-prefix／unified-uiの全5fileを実行。ログは一時ディレクトリのcad-stored-definition-stabilization-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はParameter dialogからCanvas上の寸法／注記をクリックして式へ挿入する入力経路を確認し、ExpressionInputControllerとParameterEditorの境界へ寄せる。

### 投影テスト専用の選択外観変更

appのsetAppearanceForSelectionの利用先を調査し、SketchProjectionTestDriverのテスト操作だけが使用することを確認。既存PropertiesTestDriver.createAppearanceActionへ六つの明示依存で移し、test query guard内で生成して同じsetter portへ接続する。現在の対象／key、patch merge→normalize→field置換、Blockだけcache無効化、Properties→draw→履歴、対象なしfalseを保持。処理bodyは関数名・indent以外一致。製品用commandにテスト操作を混ぜず、通常起動の生成をなくした。

app.jsは4,074→4,068行（6行減、b120651から合計75行減）。新scriptなし。単体3件で生成時無照会・対象なし、live対象／keyとnormalize結果、元値／patchの保持、Block cacheと通知順、normalize例外時無変更を確認。単体fileを構文／unit一覧へ追加。既存互換性driver E2Eに投影リンク維持・外観反映・Undo一段の検証を追加し、単独1件成功。構文543ファイル・単体1,505件・関連E2E126件成功（すべてexit 0、E2E1.7分）。sketch-projection／sketch-projection-compatibility-driver／unified-uiの全3fileを実行。ログは一時ディレクトリのcad-test-appearance-action-{check,unit,focused,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は保存済みBlock定義のParameter安定化で行う編集scope一時切替と復帰、Hatch採番の保存を調べる。

### Block drag開始入口の所有

GeometryDrag.createBlockEntryへBlockの選択・plan生成・開始拒否・hint／表示更新を集約。七つの明示依存で既存plan／GeometryDragへ接続し、同じInstance／pointer／event／plan参照、移動と回転、選択後の拒否、回転lock別通知、成功時だけ解析なしUI更新→drawを保持する。planなしも既存beginへ委譲する。旧開始bodyと名前・indent以外一致。session／Solver／履歴は既存ownerのままで、独自状態や権限規則を追加しない。

app.jsは4,084→4,074行（10行減、b120651から合計69行減）。新scriptなし。既存geometry-drag unitへ3件追加し、同一参照と順序、移動／回転、拒否時の選択保持と通知・描画、null plan委譲を確認。構文542ファイル・単体1,502件・関連E2E146件成功（すべてexit 0、E2E2.1分）。blocks／fixed-command／unified-uiの全3fileを実行。ログは一時ディレクトリのcad-block-drag-entry-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はappに残る直接モデル更新の利用先と責務を調べる。特にsetAppearanceForSelectionはテストfixtureからの利用であり、製品commandへ無理に混ぜずPropertiesTestDriverとの境界を確認する。

### 拘束付き注記dragの補助Solver状態

既存AnnotationDrag.createConstrainedへ一時Geometryとbegin・補助scope・追加変数を集約。appのannotationSolveDrag変数と開始処理を撤去し、Solverと注記dragが同じ所有者を参照する。現在scopeのObject同一性、拡張時の各要素参照・先頭二変数を除くslice、無拘束false／固定・未解決true、planなし／開始拒否時の解除、終了→解析無効化→UI→draw、引出線の実効anchor／表示倍率を保持する。後に初期化されるplan／GeometryDrag／描画／解析への依存は操作時のcallbackとし、生成時には照会しない。既存AnnotationDrag本体は完全一致、拘束付きbeginも依存名置換とindent以外一致。保存配列へ補助Geometryを追加せず、独自resetや例外復元の変更を混ぜない。

app.jsは4,101→4,084行（17行減、b120651から合計59行減）。新scriptなし。既存annotation-drag unitへ4件追加し、補助scopeと変数の参照・live scope、拒否時の無変更、plan／begin拒否の解除、終了順とtext／leader座標反映を確認。構文542ファイル・単体1,499件・関連E2E228件成功（すべてexit 0、E2E3.5分）。annotation-anchors／free-text-input-drag／leader-appearance／annotation-display-size／blocks／unified-uiの全6fileを実行。ログは一時ディレクトリのcad-constrained-annotation-drag-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はBlock drag開始時のSelection・plan／開始拒否・hintと表示更新のまとまりを調べ、既存GeometryDragの入口との役割を揃える。

### Keyboard入力の機能組立て

KeyboardInputへ既存KeyboardInteractionController.createCancellation／createの生成接続、注記ハンドルresetと選択解除の表示adapter、keydown登録寿命を集約。各controllerの本体と取消／受付優先順位は変更せず、mode・pending・拘束・handle・Selectionを操作時に既存ownerから読む。Instance.finishのmethod receiver、現在pointer、native Clipboardと非同期保存を保持。startの二重登録防止、disposeは自己listenerだけを解除し再start可能。keyup／blurはCanvasViewControlsに残す。操作種類が多いため依存数自体は残るが、巨大mutable contextで隠さず明示portで接続する。

app.jsは4,106→4,101行（5行減、b120651から合計42行減）。classic script／構文／unit／E2E読込一覧を同期。新単体4件で生成時無照会、listener所有、live状態による取消優先・reset／表示順、現在mode／pointerでの確定、寸法入力／native Clipboardの優先を確認。構文542ファイル・単体1,495件・loader1件・関連E2E277件成功（すべてexit 0、E2E4.0分）。unified-ui／blocks／spline／hatching／derived-patterns／free-instance／reference-images／command-panel／sketch-move／file-safety／annotation-anchorsの全11fileを実行。ログは一時ディレクトリのcad-keyboard-input-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は拘束付き注記dragの一時stateとSolver scope／追加変数への接続を調べる。開始・拒否・終了・復元とObject同一性を維持して所有者を整理する。

### 編集Toolbar入力の登録寿命

既存ToolbarView.createEditingBindingへUndo／Redo・選択可視性・削除・Annotation開始の五つのclick登録を集約。作図controlとは依存と登録時期を分け、元の生handler／DOM receiver、Annotationメソッドの操作時照会、削除のGeometry mode短絡→remove→成功時だけUI→drawの順を保持する。bindの二重登録を防止し、disposeは自己listenerだけを解除、再bindも可能。履歴・可視性・Selectionの処理本体や取消・復元は既存ownerのまま。

app.jsは4,112→4,106行（6行減、b120651から合計37行減）。新scriptなし。既存toolbar unitへ3件追加し、handler receiver／現在メソッド・モード拒否／削除失敗での表示無変更・成功順序・任意DOMと登録寿命を確認。構文540ファイル・単体1,491件・関連E2E280件成功（すべてexit 0、E2E4.2分）。annotation-anchors／blocks／leader-appearance／phase0-characterization／sketch-tree-visibility／toolbar-layout／unified-annotations／view-visibility／unified-uiの全9fileを実行。ログは一時ディレクトリのcad-toolbar-editing-binding-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はKeyboardの取消優先順位と入力受付の生成接続を調べ、各commandの取消・復元責務を維持しながら組立て境界を整理する。

### Canvas表示設定の状態所有とUI接続

CanvasViewControlsへconstraintStatus／geometryIds／showHiddenElementsの値と表示control／window keyup・blurのlistener寿命を集約。read-only getterのlive stateを描画・照会へ渡し、外部からの直接更新をなくした。既存ConstraintStatusViewのmouse latch／Space保持・hint・再描画の判定は変更せず、KeyboardInteractionControllerのkeydown優先順とtext入力判定も維持。bindWindowとbindControlsを元の位置で接続し、二重登録防止・dispose／再bindは自分のlistenerだけを対象とする。保存や履歴には組み込まない。

app.jsは4,129→4,112行（17行減、b120651から合計31行減）。classic script／構文／unit／E2E読込一覧を同期。新単体4件で既定値とlive read-only state、値更新→毎回再描画、mouse／Space／blur、listener所有と再bind、任意DOM不在を確認。構文540ファイル・単体1,488件・loader1件・関連E2E114件成功（すべてexit 0）。view-visibility／unified-ui全106件（1.5分）、canvas-zoom-inputの表示ケース1件とconstraint-drag-regressionsのnative pointer reversals and undo全7件（計8件、26.4秒）を実行。拘束drag全fileや全E2Eの実行ではない。ログは一時ディレクトリのcad-canvas-view-controls-{check,unit,loader,e2e,pointer-e2e}.log。全体目標は未完了。次は編集Toolbar（Undo／Redo／選択削除・可視性／Annotation開始）の入力と既存操作ownerの境界を調べる。

### 参照画像入力の機能組立て

ReferenceImageInputへ画像準備・配置command・Clipboardの生成接続とfile inputのlistener寿命を集約。画像変換／配置／Clipboard分岐の既存ownerは変更せず、bindClipboardとbindControlsを分けて従来の登録時期を維持する。importFileとclipboardは元のAPIを返し、menu／Canvas／診断の利用先を保つ。input値解除→非同期import、準備後の現在scope・Sketch・倍率と再権限確認を保持する。巨大contextや独自モデル状態を追加しない。Geometry Clipboardとの共有に必要なcopy／paste操作portは明示して残す。

app.jsは4,143→4,129行（14行減）。新scriptのindex／構文／E2E読込順とunit一覧を同期。新単体4件で待機中scope／Sketch／倍率変更、権限変更による無変更、input値解除、Clipboard marker／text入力／cut、二重bind防止とdispose／再bindを確認。構文538ファイル・単体1,484件・loader1件・関連E2E125件が成功（すべてexit 0、関連E2E1.7分）。関連はreference-images／png-export／sketch-move／unified-ui。ログは一時ディレクトリのcad-reference-image-input-{check,unit,loader,e2e}.log。全E2Eはこの単位では未実行。直前のリリースb120651は全E2E583件成功だが、以降のコードの全体検証とは区別する。全体目標は未完了。次はToolbar／表示設定のlistenerと既存UI ownerの境界を調べる。

### 2026-10-16のリリース全体検証

ユーザーのmain／origin反映指示を受け、コードdde227eをdevelopの91d532cへ統合・Push。最新コードで構文536ファイル・単体1,480件・全E2E583件が成功（すべてexit 0、全E2E24.6分）。拘束drag回帰file12.5分を含み、runnerは正常終了。ログは一時ディレクトリのcad-refactor-oct16-final-{check,unit,e2e}.log。検証後はリリース／再開記録だけを変更し、mainを最後に反映してlocal／originのmainとdevelopを同期する。app.jsは4,459→4,143行、合計316行減。数百行のcomposition rootという全体目標は未完了。次回の責務候補と再開手順は方針書section 8を参照。

### Block観測テストAPIの機能組立て

BlockTestDriver.createObservationSupportへ五つの観測factoryの生成接続と公開API対応を集約。16個の明示portを使い、scope／Definition／Solver変数／投影／viewport／hoverは既存ownerから呼出し時に読む。公開名・順序と個別factoryの本体を維持し、独自状態や汎用app contextは追加しない。

app.jsは4,147→4,143行（4行減、07024cbから合計316行減）。構文536ファイル・単体1,480件・関連E2E142件が成功（E2E2.0分）。blocks／unified-uiを実行。新単体3件で生成時無処理、五つのAPI、現在投影／倍率、Solver変数のObject同一性とsession引数、scope／hover更新後の照会を確認。ログは一時ディレクトリのcad-block-observation-test-support-{check,unit,e2e}.log。全体目標は未完了。次は残るBlock fixtureとUIイベント登録・mode／command接続を再評価し、分離効果のある責務を選ぶ。

### Block編集テスト支援の機能組立て

BlockTestDriver.createEditorSupportへ空Block準備、編集状態、配置・入れ子拘束・子Geometry・確定／取消・有効Sketch指定、通常／旧形式再読込、定義更新の11factoryの生成接続と11公開APIを集約。定義数はreadDefinitionsを使って操作時に照会し、確定／取消・再読込後の現在値を保つ。公開名・順序を維持するため、空Block／定義更新の入口とlifecycle群を元の位置で接続する。各既存factoryの本体は完全一致し、生成接続もread port置換とindent以外一致。生成時に状態照会やモデル操作を行わず、通常起動で生成しないtest query guardも保持する。定義編集／Geometry／配置／履歴の状態は既存ownerへ留め、汎用app contextや新しい編集状態は持たない。

app.jsは4,159→4,147行（12行減、07024cbから合計312行減）。新scriptなし。新unit fileを構文／unit一覧へ一回だけ追加。単体3件で11公開APIと生成時無処理、編集状態と確定／取消後のlive定義数・instance照会、配置のreceiver／数値変換、Sketch指定のObject・引数・返値、通常再読込→UI／draw→最新状態の順を確認。構文535ファイル・単体1,477件・関連E2E163件が成功（すべてexit 0、E2E2.2分）。11 APIを使うblocks／phase0-characterization／unified-uiの全3fileを実行。全runnerは正常終了。ログは一時ディレクトリのcad-block-editor-test-support-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はBlockの一般状態・投影／回転／hover等の観測支援の生成接続を調べる。

### Dimension既定fixtureの機能組立て

DimensionTestDriver.createFixtureSupportへ読み取り専用寸法の重複／配置、補助線表示、角度ラベル追従、Sketch表示の5factoryを集約。5公開APIはreadOnly群と角度／Sketch表示の入口で返し、appは元の位置へ接続する。公開名・順序を維持し、全個別factoryの本体は完全一致、生成接続もcurrentScope／rootSketchIdのport置換とindent以外一致する。Sketch表示fixtureのfactory生成は同支援へ移るが、生成時に状態照会・準備を実行しない。準備と検証時のGeometry／寸法／session／描画は既存ownerへ委譲し、独自製品状態や汎用app contextを持たない。これでDimensionの22個の個別factory生成はappからなくなり、fixture／interaction／displayの三つの支援入口へ整理された。

app.jsは4,171→4,159行（12行減、07024cbから合計300行減）。新scriptなし。新unit fileを構文／unit一覧へ一回だけ追加。単体2件で5公開APIと生成時無処理、読み取り専用配置のGeometry／寸法Object・session receiver・操作順、既存入力操作の結果反映を確認。構文534ファイル・単体1,474件・関連E2E232件が成功（すべてexit 0、E2E3.6分）。5 APIを使うannotation-display-size／annotation-anchors／multiple-dimensions／leader-appearance／sketch-tree-visibility／view-visibility／unified-ui／unified-annotationsの全8fileを実行。全runnerは正常終了。ログは一時ディレクトリのcad-dimension-fixture-test-support-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はBlock定義編集・階層操作のfixture／操作支援の生成接続と公開APIを調べる。

### Dimension操作テスト支援の機能組立て

DimensionTestDriver.createInteractionSupportへ位置照会／式編集／Selection、command中drag／click配置／Line-Circle・半径差／復元・操作観測の10factoryと複数寸法用fitを集約。placementとselectionの二群で12 APIを返し、appは元の位置へ展開して公開名・順序を維持する。各個別factoryの本体は変更前と完全一致し、生成接続はcurrentScope／clientPositionのport置換とindent以外一致。fit操作のbodyもViewport→UI→drawの同じ値・順を維持する。製品のGeometry・寸法・求解／復元方針は変更せず、既存model／Selection／pending／drag／Viewportのownerへ委譲する。生成時に状態照会やモデル変更を実行しないことと、通常起動で生成しないtest query guardを保持。巨大なapp contextや独自状態を作らない。

app.jsは4,187→4,171行（16行減、07024cbから合計288行減）。新scriptなし。新unit fileを構文／unit一覧へ一回だけ追加。単体3件で12公開API名・順序と遅延参照、live寸法のObject同一性・式編集返値、SelectionとUI／draw順、対象なしの無処理、pending pointerの複写・drag状態、fit順を確認。構文533ファイル・単体1,472件・関連E2E213件が成功（すべてexit 0、E2E4.0分）。12 APIを使うadversarial-authoring-performance／annotation-display-size／bolt-diameter／blocks／dimension-prefix／free-text-input-drag／multiple-dimensions／slot-dimension／unified-uiの全9fileを実行。全runnerは正常終了。ログは一時ディレクトリのcad-dimension-interaction-test-support-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は残る読み取り専用寸法・補助線・角度ラベル・Sketch表示fixtureの生成接続を調べる。

### Dimension表示テスト支援の機能組立て

DimensionTestDriver.createDisplaySupportへ外観観測・描画計測・半径／端末記号・色・数値精度／文字角度の7factoryの生成接続と8公開APIを集約。編集／配置fixtureは依存と操作責務が異なるため別の既存factoryに残す。現在Documentの寸法／端末既定値を合成するgetterを内部で共有し、appはappearance／casesの二群を元の公開位置で展開して名前・順序を維持する。個別factoryの本体は完全一致し、生成接続もread port置換とindent以外一致。早い場所にあったcase factoryの生成は表示支援の組立て位置へ移るが、生成時に測定・モデル照会を行わず、各APIの呼出し時に評価する。製品ownerの外観／描画計算やSelection・hoverの復元範囲は変更しない。巨大なapp contextや独自製品状態を追加しない。

app.jsは4,207→4,187行（20行減、07024cbから合計272行減）。新scriptなし。新unit fileを構文／unit一覧へ一回だけ追加。単体3件で8 APIの名前・順序と生成時無処理、precision入口、live既定値の合成と倍率、色観測後のSelection／hover／stroke復元と描画失敗時の例外伝播を確認。構文532ファイル・単体1,469件・関連E2E127件が成功（すべてexit 0、E2E1.9分）。8 APIを使うunified-ui／annotation-display-size／leader-appearanceの全3fileを実行し、file URL起動も含む。全runnerは正常終了。ログは一時ディレクトリのcad-dimension-display-test-support-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はDimensionの編集・配置fixtureと操作観測の生成接続・公開対応を調べる。

### AnnotationテストAPIの機能組立て

AnnotationTestDriver.createSupportへ寸法／外観／所有関係の観測、snapshot、drag fixture、hit照会の6factoryとdrag状態照会を集約。共有snapshotをdrag fixtureへ内部で接続し、既存製品ownerからの操作・read portだけを受け取る。7つの公開APIはfixtures／observations／interactionの三群で返し、appは元の位置へ展開することで他featureを含む公開順も維持する。全個別factoryの本体は変更前と完全一致し、生成接続もport置換とindent以外一致。drag状態は元と同じannotationDrag.inspectの操作時照会と返値を保ち、通常起動で支援を生成しないtest query guardも保持する。任意のapp contextや製品状態を新たに所有しない。

app.jsは4,219→4,207行（12行減、07024cbから合計252行減）。新scriptなし。新unit fileを構文／unit一覧へ一回だけ追加。単体2件で三群の7公開名・順序と生成時無処理、live drag／snapshot照会、hitの座標変換、実際のdrag fixture→snapshot接続、元のstyle template不変を確認。構文531ファイル・単体1,466件・関連E2E239件が成功（すべてexit 0、E2E3.6分）。7つのAnnotation APIを参照するannotation-anchors／free-text-input-drag／unified-ui／unified-annotations／leader-appearance／annotation-display-size／phase0-characterization／png-exportの全8fileを実行。全runnerは正常終了。ログは一時ディレクトリのcad-annotation-test-support-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はDimensionのfixtureと表示観測の生成接続・公開API対応を同様に整理できるか検討する。

### Sketch投影テストAPIの機能組立て

SketchProjectionTestDriver.createSupportへ状態観測・通常Geometry・旧形式互換・Block編集／投影・選択／外観／削除・source編集・読込・資格・転送の生成接続と21個の公開API対応を集約。共有readState、選択APIと転送、旧形式target構築の内部リンクをdriver内で接続し、appは従来の型・操作・read portを明示する。全個別factoryの本体は変更前と完全一致し、生成接続bodyもread port置換とindent以外一致。公開名・順序、callbackと現在scope／履歴の参照、test queryで有効なときだけ生成する範囲を保持する。旧形式target constructorは状態を照会しないfactoryなので、支援内部での生成へ移してもモデル操作を増やさない。任意のapp contextや新しい製品状態は持たず、既存command／model／solver操作をfixtureが引き続き利用する。

app.jsは4,281→4,219行（62行減、07024cbから合計240行減）。新scriptなし。新unit fileを構文／unit一覧へ追加。単体2件で21公開名・順序と生成時無処理、live mode／staged／scope／履歴、保存情報の複写、選択・コピー転送・再読込と共有observationの接続を確認。構文530ファイル・単体1,464件・関連E2E178件が成功（すべてexit 0、E2E2.4分）。sketch-projection／blocks／unified-ui／phase0-characterizationを実行し、通常／Block／旧形式互換・コピー・保存とfile URL起動を含む。全runnerは正常終了。ログは一時ディレクトリのcad-sketch-projection-test-support-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。既存fixtureの依存が多い点は残し、巨大な汎用contextで隠さない。次はAnnotationの観測・drag fixture生成と公開APIの対応を整理できるか検討する。

### OffsetテストAPIの機能組立て

installTestHooksに残る単独Offset／UI／方向／chainの9factoryの生成接続と公開名の対応を、既存OffsetTestDriver.createSupportへ集約。個別factoryと既存API名・順序は維持し、通常起動では生成しない既存test query guard内でのみ接続する。35個の既存の型・操作／照会portを明示し、任意のapp fieldやモデル全体へアクセスできるcontextは渡さない。factory生成は状態照会・Geometry編集を実行せず、各APIは従来のdriver関数へ直接接続する。9factoryの接続bodyはcurrentScopeのport置換とindent以外一致し、作図・求解処理やE2E期待値は変更しない。appは公開APIの個別対応を持たず、一つのOffset用APIを元の位置に展開する。

app.jsは4,293→4,281行（12行減、07024cbから合計178行減）。新scriptなし。新unit fileを構文／unit一覧へ追加。単体2件で9入口の名前・順序と生成時無処理、live scope／Selection／pending照会、reloadとUI fixtureの既存処理への接続を確認。構文529ファイル・単体1,462件・unified-uiの全103件が成功（すべてexit 0、E2E1.5分）。同fileにはOffsetの9入口を使う既存ケースとfile URL読込も含むが、全E2Eとは区別する。全runnerは正常終了。ログは一時ディレクトリのcad-offset-test-support-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。35 portは既存fixtureの依存を表す移行上の広さとして残り、行数だけのために汎用contextへまとめない。次はAnnotationやSketch投影等のtest API対応と生成接続を同様に機能単位で整理できるか検討する。

### Documentファイル操作の機能組立て

src/application/document_file.jsにDocumentFileFeatureを追加。DocumentStatusView／DocumentBookmarks／DocumentFileCommandとDocument用controlを生成・接続し、checkpoint→status更新と読込成功時の適用→solve→履歴初期化→saved checkpoint→再表示→fit→draw→修復案内を機能内で調整する。保存先／排他／checkpointは既存DocumentFiles、codecとmodel反映は既存DocumentApplication、ブラウザI/Oと置換／終了保護は既存DocumentFileCommandのまま。状態表示が履歴snapshot、置換とunloadが現在実データを使う違いと、二回のstatus更新も維持する。早いstatus生成位置でfeatureを組むが、command／bookmark／controlのfactoryがI/O・描画・model操作を開始しないことを確認し、後段choiceDialogとDocumentApplicationは遅延callbackで接続。controlのbindと初期化完了後のbeforeunload／startup開始は元の時点に置く。disposeは登録listenerだけを解除し、I/O取消や新たなrollback保証は追加しない。

app.jsは4,316→4,293行（23行減、07024cbから合計166行減）。新scriptとunitをindex／構文／unit一覧／読込期待へ同期し、各pathが一回だけ存在することを確認。実際のfile command／status／session／controlを使う単体4件で履歴表示と実データ保護の区別、読込完了順、失敗時の後続停止、control／beforeunloadの二重登録抑止とdispose／再startを確認。構文528ファイル・単体1,460件・file URL読込1件・関連E2E142件が成功（すべてexit 0）。file-safety／unified-ui／phase0-characterizationの135件（1.8分）とdocument-bookmarksの7件（6.9秒）を実行。全runnerは正常終了。ログは一時ディレクトリのcad-document-file-feature-{check,unit,loader,e2e,links}.log。全E2Eは今回未実行。全体目標は未完了。次はinstallTestHooksに残るfeature別のfixture／observation生成接続と公開APIを調べ、既存driverの責務を変えずにまとまりを移せるか検討する。

### PNG出力の機能組立て

src/application/png_export.jsにPngExportを追加。CanvasExportのcapture、PngFile、PngExportCommandとmode session、開始buttonを生成・接続する。既存の一時描画frameはappが作るCanvasExport rendererに残し、入力とCommandPanelには同じcommand参照を接続。開始前pointer処理→file busy／作図中／pending／拘束command／Block配置modeの短絡順と拒否文言を維持する。DPIから倍率への変換、cache内の10px snap照会、font待機の後に現在の可視画像を準備する時機、描画bitmapの復元・保存・元modeへの復帰は既存ownerと同じ順を保持。Documentファイルcontrolsは既に明確な責務であるため無理にPNGと統合しない。独自Document／Viewport／履歴やアプリ全体のcontextを持たない。

app.jsは4,335→4,316行（19行減、07024cbから合計143行減）。新scriptとunitをindex／構文／unit一覧／読込期待へ同期し、各pathが一回だけ存在することを確認。実際のCanvasExport／PngFile／PngExportCommand／DocumentFilesを使う単体3件で全開始拒否と短絡順、flush後の状態参照、start重複抑止とdispose／再start、snap許容幅、非同期font待機後のlive画像、保存開始時の倍率保持、capture復元・書込完了とmode／pending復帰を確認。構文526ファイル・単体1,456件・file URL読込1件・関連E2E127件が成功（すべてexit 0、関連E2E1.7分）。png-export／file-safety／command-panel／unified-uiを実行。全runnerは正常終了。ログは一時ディレクトリのcad-png-export-feature-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はDocumentファイル操作の生成・終了保護とDocument状態表示との接続を調べる。

### Document既定外観設定の機能組立て

src/application/document_appearance_editor.jsにDocumentAppearanceEditorを追加。Geometry／Dimension／Sharedの三組の既定外観command／Viewを生成・接続し、同じ順でfieldをprepareしてdialogを開く進行をfeatureへまとめる。既定値は限定したread／write、既存編集service・row表示・現在倍率・通知を受け取り、モデルや保存形式、独自外観状態を持たない。六factoryの接続bodyはport置換とindent以外一致。値変更・normalize・履歴・UI／drawの順は既存DocumentDefaultAppearanceCommand、表示と入力の解釈は既存DocumentAppearanceSettingsに残す。元と同じ位置でstartし、click listenerの二重登録抑止・dispose／再startを提供する。

app.jsは4,356→4,335行（21行減、07024cbから合計124行減）。新scriptとunitをindex／構文／unit一覧／読込期待へ同期し、一回だけ含まれることを確認。実際のcommandとViewを使う単体3件で三組の準備→dialog表示順、start重複抑止・listener解除と再start、live既定値／倍率・編集serviceのreceiver、変更と履歴／再表示順、準備失敗時にdialogを開かないことを確認。構文524ファイル・単体1,453件・file URL読込1件・関連E2E142件が成功（すべてexit 0、関連E2E2.1分）。unified-ui／leader-appearance／dimension-prefix／unified-annotationsを実行。全runnerは正常終了。ログは一時ディレクトリのcad-document-appearance-editor-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はDocumentファイル操作とCanvas出力の生成・接続のまとまりを調べ、既存ownerを使った機能組立ての境界を検討する。

### Parameter編集UIの機能組立て

src/application/parameter_editor.jsにParameterEditorを追加。appの複数箇所に分かれていたdraft・式入力表示／挿入・dialog View／Controller・適用結果adapterの生成接続を一つの機能へまとめる。既存ownerの実装と状態は再実装せず、相互参照するcontrollerと適用adapterを内部で接続し、appはモデル適用の遅延callbackと外部操作を提供する。scope選択肢と入力欄に応じたsymbol名の照会もこのfeatureへ集約。2つの照会bodyはread portへの置換とindent以外一致し、現在scope／Block編集中draft／保存定義・言語を操作時に読む。DOM表示・listener／dirty確認は既存View／Controller、モデルへの適用・solve・checkpoint復元は既存ParameterApplicationに残す。

app.jsは4,388→4,356行（32行減、07024cbから合計103行減）。src/applicationは機能単位の生成接続を置く層として導入し、巨大なapp contextや新しいmodel状態は作らない。初期化時はscope・BlockEditor・後段ParameterApplicationへ触れず、元と同じ時点にcontrollerをstartする。新scriptとunitを読込・構文・unit一覧／期待へ同期し、各pathが一回だけ存在することを確認。単体3件で実際のParameterDialogControllerを使い、初期化時の遅延参照、live scopeと語句、start重複抑止・dispose／再start、dialogとCanvasのsymbol名分離、適用成功／失敗の通知順を確認。構文522ファイル・単体1,450件・file URL読込1件・関連E2E128件が成功（すべてexit 0、関連E2E1.8分）。unified-ui／parameter-dialog-controller／unified-annotations／dimension-prefix／command-panelを実行。全runnerは正常終了。ログは一時ディレクトリのcad-parameter-editor-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はDocument既定外観設定のcommand／Viewとdialog開閉の生成接続を、同様に機能単位へまとめられるか検討する。

### Document採番状態の所有

appに残った11個の採番変数をsrc/editing/document_ids.jsのDocumentIdsへ集約。生成・previewの非消費照会・reset・snapshot／restore・編集scope／付随要素の番号予約を同じownerへまとめ、変数setterの横移動にはしない。依存は既存GeometryIds.nextSeqだけ。基本Geometry採番はGeometryIds、読込候補からの純粋な復元計算はDocumentSequencesに残す。Sketchの初期値2、各prefix、操作時の番号消費、Block名のpeek、Hatchの保存予約、previewで消費しないことを維持。clipboardは従来8種類だけのcheckpointを採り、その他の番号を戻さない。freeInstanceSeq／blockElementSeqの既存復元値も保持する。読込時はGeometry予約の後に復元計算値を反映する順を保持。

app.jsは4,419→4,388行（31行減、07024cbから合計71行減）。appから11個のカウンター変数がなくなり、command／test fixtureは限定したallocate／peek portへ接続。既存初期化位置に生成を置き、前段SketchProjectionのID callbackは従来どおり操作時に評価する。新scriptのindex／構文／unit一覧と読込期待を同期し、各pathが1回だけ含まれることを確認。単体4件でprefix・独立したowner・peek／reset、部分復元、番号予約と入力不変、実際のDocumentSequences.recoverとの接続を確認。構文520ファイル・単体1,447件・file URL読込1件・関連E2E239件が成功（すべてexit 0、関連E2E3.1分）。unified-ui／blocks／derived-selection-copy／derived-patterns／sketch-projection／hatching／reference-images／spline／file-safety／phase0-characterizationを実行。全runnerは正常終了。ログは一時ディレクトリのcad-document-ids-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は残存責務を再確認し、Parameterダイアログ・式入力・適用等の機能単位の生成接続をまとめられるか検討する。単なる細かなhelper分割に偏らず、依存の向きと状態所有を優先する。

### Document初期化時のCanvas表示状態

resetModelStateのhover／highlight／pointer／snapと明示Selection fieldのresetを、既存CanvasSelectionInteraction.createDocumentResetへ集約。5依存は既存Selection／hover／highlightとpointer／snap解除portだけで、Documentやcommand sessionを持ち込まない。通常clearとDocument初期化で消す範囲が異なるため独立した入口とし、最初のclearSelectionや共通pending／constraint sessionのreset、採番との位置関係を維持する。hoverの段階更新、highlight→pointer→snap、Selection fieldの順も保持し、元bodyはpointer解除のcapability置換とindent以外一致。clearSnapは後段constのため、生成時は委譲callbackで接続し、実際のresetまで評価しない。

app.jsは4,438→4,419行（19行減、07024cbから合計40行減）。新scriptなし。実際のCanvasSelection／CanvasHoverを使う単体2件で対象field、対象外の基本Geometry／Sketch選択とannotation hover等の保持、反復reset、ownerのreceiverと更新順を確認。構文518ファイル・単体1,443件・関連E2E179件が成功（すべてexit 0、E2E2.4分）。file-safety／unified-ui／blocks／sketch-permissions／sketch-projectionを実行。全runnerは正常終了。ログは一時ディレクトリのcad-document-canvas-reset-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は採番変数とDocumentSequences／GeometryIdsの役割、reset／reserve／restoreの境界を調べ、状態所有を整理する。

### Document初期化時の作図下書き破棄

resetModelStateの連続した16個の作図下書きresetを、既存DrawOperationLifecycle.resetForDocumentへ集約。追加依存なしでLine／Centerline、transient Point／Line completion、Rectangle／Slot／Fillet／Circle／Arc／Spline、投影／派生source、Spline編集、preview pointer、Offsetを従来順に破棄する。通常のexit／cancelはrollback・preview全体・Hatch・UI通知等の範囲が異なるため共用しない。Document内容・cache・採番、共通pending／constraint session、後段Hatch等のresetは元の初期化側に残す。factory生成はresetModelStateの実呼出しより前であり、既存factoryはreset callbackを生成時に実行しないことを確認。

app.jsは4,453→4,438行（15行減、07024cbから合計21行減）。新script／依存なし。単体2件でDocument専用の破棄範囲、previewの他field保持、反復reset、失敗時の後続停止と例外伝播を確認。構文518ファイル・単体1,441件・関連E2E160件が成功（すべてexit 0、E2E2.2分）。file-safety／circular-authoring／spline／hatching／phase0-characterization／unified-uiを実行し、起動・ファイル置換・作図・保存再読込を確認。全runnerは正常終了。E2E後は新method本体のindentだけを修正し、空白除去比較で実行token不変を確認した。ログは一時ディレクトリのcad-document-draft-reset-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はDocument初期化に残るSelection／hoverの明示resetと、既存CanvasSelectionInteractionの所有範囲を確認する。順序や意図的な重複を勝手に統合しない。

### symbol削除の共通guard

guardDimensionSymbolDeletionを既存ParameterApplication.createDeletionGuardへ分離。ParameterNamespaceの依存照会と、現在namespace／言語／hint／logの5依存を明示し、独立した編集前guardとして各削除commandへ接続する。名前空間のdefault引数評価、依存なしの通知省略、依存名の順と区切り、操作時の言語、hint→log順、例外伝播を維持。モデルと削除transaction・履歴は持ち込まない。appではParameterNamespace直後、最初のconsumerより前で初期化し、生成時に照会を実行しない。新scriptなし。

最新develop/main 07024cbからcodex/parameter-edit-guardで再開。週枠使用10%／残量90%を確認し、app.jsは4,459→4,453行（6行減）。既存unitに2件を追加。構文518ファイル・単体1,439件・関連E2E83件が成功（すべてexit 0）。内訳はblocks／parameter-dialog-controller／unified-annotationsの59件、sketch-tree-delete／unified-uiのsymbol・parameter・削除・参照関連23件、一括寸法削除の依存拒否1件。最初のE2E指定に存在しない2つのfile名が含まれたため、実在するSketch削除fileと統合UIを追加実行し、coverageを補った。ログは一時ディレクトリのcad-symbol-deletion-guard-{check,unit,e2e,deletion-e2e,batch-e2e}.log。全runnerは正常終了。全E2Eはこの区切りでは未実行。全体目標は未完了。次はresetModelStateの操作sessionリセット範囲と、既存ownerへの委譲・初期化順を確認し、巨大なcontext移動を避けて共通状態の所有を整理する。

### 2026-10-16のリリース検証

ユーザーのorigin/mainへのマージ指示により、この区切りで新規分離を停止。コード最終accde5dをdevelopへ統合したa83beddで、構文518ファイル・単体1,437件・全E2E583件が成功（すべてexit 0、全E2E24.5分）。拘束ドラッグ回帰全fileは12.5分。ログは一時ディレクトリのcad-oct16-release-{check,unit,e2e}.log。app.jsは再開時4,840→4,459行。検証後はこの記録だけを更新し、develop先行・main最後・main/develop同期の手順でリリースする。全体のcomposition root化は未完了であり、次回は最新developから継続する。

### Hatch／Offsetの診断表示

hatchRegionErrorText／offsetChainErrorTextをsrc/ui/authoring_feedback.jsのAuthoringFeedbackへ分離。依存はapplicationTextだけとし、Geometry判定・model編集・DOM更新は持たない。既存2関数の本体を維持し、未知codeでHatchはreasonを英語fallbackとして使い、Offsetは汎用文言を使う違いと、操作時の言語参照を保持する。appはApplicationSettingsの生成直後、最初のconsumerより前で接続する。

app.jsは4,488→4,459行（29行減、今回の再開から合計381行減）。script読込・構文・unit一覧と読込期待を同期。単体2件で既知code／未知code、言語切替と入力不変を確認。構文518ファイル・単体1,437件・file URL読込1件・関連E2E24件が成功（すべてexit 0、関連E2E1.0分）。ログは一時ディレクトリのcad-authoring-feedback-{check,unit,loader,e2e}.log。全workerとrunnerは終了し、実体確認済みの専用serverだけを終了した。この区切りでは全E2Eは未実行。全体目標は未完了。ユーザーのorigin/mainへのマージ指示により新規分離を止め、develop統合後の全体検証とmainへのリリースを進める。

### 拘束名の表示

localizedConstraintNameを既存ConstraintFeedbackへ集約。既存applicationTextと新たなreadLanguageの2 portで通常名／typeOnly表示を返す。元bodyはlive言語read portの置換以外一致し、具体名を優先する正規表現の順・suffix・未知名と空名fallback・Arc endpoint fixedの特例を保持する。Modelのnameや保存値は変更しない。appは既存Feedback instanceから関数を取得し、Block選択照会／Tree／Properties／Canvasメニューへ接続する。最初のconsumerより前に生成済みであり、getterは呼出し時だけ使う。既存summary等の明示language引数とはreadLanguageを別名にして役割を区別する。

app.jsは4,512→4,488行（24行減、今回の再開から合計352行減）。新script／unit fileなし。既存ConstraintFeedback unitへ2件追加し、prefix優先／suffix・typeOnly／未知名・空名とlive言語／固定端点特例を確認。構文516ファイル・単体1,435件・関連E2E45件が成功（すべてexit 0、E2E1.7分）。unified-ui／blocks／sketch-tree-visibilityからlanguage／constraint／Properties／context／appearance／delete・deletionの関連ケースを抽出。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-constraint-name-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はhatchRegionErrorTextとoffsetChainErrorTextの診断結果→UI文言変換を整理する。Geometry判定・model編集・操作状態を表示側へ持ち込まず、各codeの文言・未知code／reason fallbackとlive言語を維持する。

### Canvas参照入力の照会と操作調整

focusedExpressionInputContext／insertClickedDimensionParameter／insertClickedAnnotationParameterをExpressionInputControllerへ集約。DOM／型、現在namespace・pending／Parameter draft、寸法名補完、error／hint・言語・識別子挿入の12依存を明示する。各式fieldとreadOnly／disabled、modelとdraftのnamespace同一参照、寸法／注記の対象条件、名前の補完とevent抑止・挿入／通知順を維持。特にnamespace不一致時の寸法はerror／hint→prevent／stop、注記はprevent／stop→error／hintの順であり、共通化して並べ替えない。3bodyは型・model／言語read portの置換以外一致し、namespaceをcacheせず操作時に読む。Parameterの補完は既存service、DOM変更はExpressionInputViewへ委譲し、独自model／draft／Selectionを持たない。appは最初のconsumer登録前に生成・接続する。

app.jsは4,560→4,512行（48行減、今回の再開から合計328行減）。新controller／unit fileを追加しindex.html・check-syntax・明示unit一覧・unified-uiのscript期待を同期。unit4件で対象fieldとreadOnly／disabled、現在namespaceの同一性、名前補完→event／挿入順、namespace不一致時の異なる順序、注記の所有とlive言語を確認。構文516ファイル・単体1,433件・先行file URL読込1件・関連E2E35件が成功（すべてexit 0、関連E2E1.1分）。unified-ui／parameter-dialog-controller／unified-annotations／dimension-prefix／annotation-anchorsからexpression／formula／parameter／reference／inline／affix／prefixの関連ケースを抽出。全worker終了後に各専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-expression-reference-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はlocalizedConstraintNameに残る拘束名の言語／typeOnly表示を既存ConstraintFeedbackへ集約できるか確認し、Modelのnameや保存値を変更せず、正規表現の優先順・未知名のfallbackとlive言語を維持する。

### 式入力欄への識別子挿入

insertIdentifierIntoExpressionInputを既存ExpressionInputView.createInsertionへ集約。Event constructorとformatParameterReferenceの2依存だけを接続し、選択範囲置換・equals補完／padding・input通知・blur時のchange補完・focus／caretを担当する。元bodyはEvent constructorの注入名以外一致し、native change済みや切断inputの通知抑止、once listenerと複数挿入時の一回のchange、通知前後のDOM操作順を維持する。Parameter名前空間照会や評価／適用・履歴は持ち込まない。appは起動時に生成し、既存寸法／注記挿入の呼出しへ接続。最初のconsumerより前の初期化とfactory生成時にinputや状態へ触れないことを確認した。

app.jsは4,590→4,560行（30行減、今回の再開から合計280行減）。新scriptなし、ExpressionInputView unit fileを追加して構文・明示unit一覧を同期。unit3件は実際のEventTarget／Eventを用い、選択／padding・equals／fallback caret、input→focus→caret順、native／synthetic changeと切断input、複数挿入後の一回だけの確定を確認。構文514ファイル・単体1,429件・関連E2E28件が成功（すべてexit 0、E2E54.0秒）。unified-ui／parameter-dialog-controller／unified-annotations／dimension-prefixからexpression／formula／parameter／reference／inline／affix／prefixの関連ケースを抽出した。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-expression-insertion-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はfocusedExpressionInputContextとinsertClickedDimensionParameter／insertClickedAnnotationParameterに残るCanvas参照入力の照会・操作調整をcontroller側へ集約できるか確認する。名前空間の同一参照と拒否条件、寸法／注記で異なるイベント抑止と通知順、名前の補完／挿入の所有を維持する。

### トリム操作の進行

executeTrimAtの対象検証→checkpoint→Geometry変更→preview／Selection解除→Parameter安定化／依存結果判定→失敗復元または成功履歴をTrimCommandへ分離。既存TrimEditingとGeometry checkpoint APIを含む18依存を明示し、model状態やsessionは新たに持たない。形状変更はLine／Arc／Circleごとに既存TrimEditingへ委譲する。元bodyはpreview解除・analysis invalidate・閾値のcapability置換以外一致し、structure／投影guard、拒否時のcleanup範囲、現在active Sketchの参照時点、主／依存solve失敗とerrorNorm > 閾値の復元、例外伝播、UI→draw→history順を維持する。editing／checkpointの関数参照は元どおり裸の関数として使う。

app.jsは4,620→4,590行（30行減、今回の再開から合計250行減）。新command／unit fileを追加しindex.html・check-syntax・明示unit一覧・unified-uiのscript期待を同期。unit4件で形状ごとの成功と閾値ちょうどの受理、guard／preview／投影拒否、主／依存solveと誤差超過の復元、想定外例外時の伝播範囲を確認。初回file URL起動でテストfixtureが使うexecuteCircleTrimの参照を誤って外したことを検出し、Line／Circleのfixture用参照を保持して修正した。修正後に構文513ファイル・単体1,426件・先行file URL読込1件・関連E2E150件が成功（すべてexit 0、関連E2E2.6分）。unified-ui／sketch-permissions／sketch-projection／phase0-characterizationを実行。全worker終了後に各専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-trim-command-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はinsertIdentifierIntoExpressionInputに残る式入力欄への識別子挿入とinput／blur-change／focus・caretの処理を既存ExpressionInputViewへ集約する。Parameterの名前解決・適用や入力確定の既存時機は変えない。

### 参照元探索と逆変換の照会

resolveDerivedDragSource／geometryInstanceSourceObjectsを既存InstanceProjection.createDragSourceQueryへ集約。source points・依存参照・GeometryRef解決の3 read portだけを受け取り、inverse chainと参照元ObjectのSetを返す。元2bodyはそのまま一致し、UI／Selection／drag lifecycleを持ち込まない。Setは毎回生成し、同じIDでも異なるObjectを別に扱い、共有Point・Block／派生owner・重複や巡回の探索順と短絡を維持する。inverse関数参照を外側から内側へ収集して裸の関数として呼ぶreceiver、pointer複写、Sketch投影flag、参照切れ／非変換chain／巡回のnull結果を保持。appはGeometryReadModel生成直後に接続し、既存resolve portが操作時のscopeを読む。最初のconsumerより前の初期化と、factory生成時に照会を実行しないことを確認した。

app.jsは4,650→4,620行（30行減、今回の再開から合計220行減）。新script／unit fileなし。既存InstanceProjection unitに3件追加し、同一参照・探索順／再照会・無変更、inverse順・入力pointer不変／captured map、参照不正／巡回時に変換を実行しないことを確認。構文511ファイル・単体1,422件・関連E2E192件が成功（すべてexit 0、E2E2.6分）。derived-patterns／derived-selection-copy／sketch-projection／sketch-permissions／blocks／unified-uiを実行。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-drag-source-query-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はexecuteTrimAtに残る検証→変更→求解→失敗復元／成功履歴の操作調整をcommandへ分離する。実際のGeometry／拘束移管は既存TrimEditingに残し、復元範囲・UI順・閾値や例外伝播を変更しない。

### 派生Geometryのドラッグ開始

84行のbeginDerivedGeometryDragを既存GeometryDrag.createDerivedEntryへ集約。型、編集guard、Selectionと解除、参照元／source points照会、通常session生成、GeometryDrag lifecycleとhint／UI／drawの14依存を明示する。Instance全体と参照元操作の分岐、開始plan、選択更新、拒否通知を担当し、resolveとsession生成／solve／履歴は既存ownerに残す。元84行の本体はguardの注入名以外一致。全体移動のclick metadata、線上の初期比率に追従するlive anchorと開始snapshot、source／rotationのvariableAllowed、Block ownerとarc端点の対象変換、pointerMap／元参照と配置Instance除外を維持する。anchor control／権限拒否、未解決／投影chain／固定source、anchorなしの各終了範囲とUI順も保持。factory生成はquery／lifecycleの初期化後、入力consumer登録前に置き、独自modelやdrag状態を増やさない。

app.jsは4,729→4,650行（79行減、今回の再開から合計190行減）。新script／unit fileなし。既存GeometryDrag unitに6件追加し、実際のPatternInstanceModel.placedと型portで全体／sourceの境界、live座標、制限・拒否、Block／arc端点と変数除外、参照・引数・UI順を確認。構文511ファイル・単体1,419件・関連E2E192件が成功（すべてexit 0、E2E2.7分）。derived-patterns／derived-selection-copy／sketch-projection／sketch-permissions／blocks／unified-uiを実行。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-derived-drag-entry-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はappに残るresolveDerivedDragSourceとgeometryInstanceSourceObjectsの読み取り責務をInstanceProjectionへ集約できるか確認する。逆変換chain／巡回拒否とsource objectの参照・順・短絡を維持し、UI／Selectionやdrag lifecycleを照会側へ持ち込まない。

### Selection解除の調整

作図開始／取消・mode遷移を確認し、それ自体は既存DrawOperationLifecycleの所有であるため再分割しなかった。appに残るclearSelectionの4 owner更新をCanvasSelectionInteraction.createClearingへ集約。Selection→拘束operand→Sketch／Block／派生hover→強調reset→Annotation／Hatch／画像／Spline hoverの二段更新を元のまま維持。拘束command本体、point／line／circle／arc／寸法などの別hover参照、snap、UI・履歴は解除しない。4 APIのみで接続し、独自model／session状態を持たず、全owner生成後の早期接続とhoisted入口を残す。元bodyの一致を確認した。

app.jsは4,739→4,729行（10行減、今回の再開から合計111行減）。新script／unit fileなし。既存CanvasSelectionInteraction unitに2件追加し、実際のConstraintTargetSession／CanvasHoverを使ってcommand本体と別hover参照が残ること、owner receiverと二段hover更新の順を確認。構文511ファイル・単体1,413件・関連E2E181件が成功（すべてexit 0、E2E3.3分）。unified-ui／command-panel／sketch-permissions／derived-selection-copy／blocks／sketch-projectionを実行。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-selection-clearing-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。残る手続きの長さを確認したところbeginDerivedGeometryDragが84行あり、派生Instance全体／参照元のdrag planと開始調整がまとまって残る。次はその所有者と依存を確認して既存drag機能へ集約し、mode／command操作調整・機能ごとの生成接続も続ける。

### CommandPanelの表示先選択とイベント振分け

共通panelの表示先選択とreadState／action／setting／row選択・削除を既存CommandPanel.createRoutingへ分離。modeと注記activeのread port、安定した派生／Hatch／注記panelとPNG commandの6依存で接続する。表示／action／settingはPNG→注記→Hatch／repair→派生の優先順位、row選択／削除は従来どおりPNGを経由しないoptional呼出しとする。5handlerの式は元のまま、selectorは操作時に状態を読む。receiver／引数／戻り値とderivedのその他公開fieldの引継ぎも保持。個別panel・commandはdraftと取消／履歴を引き続き所有し、appは生成接続を行う。panel／PNG instanceは構築後に再代入されないことと、生成時にlive状態を読まないことを確認した。

app.jsは4,742→4,739行（3行減、今回の再開から合計101行減）。新scriptなし、CommandPanel unit fileを追加して構文・明示unit一覧を同期。unit3件で優先順位とlive切替、receiver／結果／引数、row callbackのoptional性を確認。構文511ファイル・単体1,411件・関連E2E62件が成功（すべてexit 0、E2E1.4分）。command-panel／png-export／unified-annotations／hatching／derived-patternsを実行し、状態／設定／行操作と空白double click取消も確認。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-panel-routing-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は作図開始・取消とmode遷移に残る操作調整、機能ごとの生成接続を整理する。

### Sketchのロック更新と名前変更guard

ロック反転とUI／draw／history完了を既存SketchCommand.toggleLockへ、名前変更前の権限guardも既存renameへ集約。appは既存guard・言語の照会とprepareLockToggleの3portを追加接続し、返された操作をTreeへ渡す。prepareはpending取消→拘束command取消→作図mode終了を元の順で実行し、Sketch変更時の全体resetとは統一しない。対象Sketchの取消前取得、Root／不在の拒否、guard拒否時にmodel／promptを読まない順序、locked更新→UI→draw→履歴を維持。SketchHierarchyとSketchContextのRoot判定が取得済みObjectに対して同じこと、元lock bodyとの差がprepare委譲だけであることを確認した。両aliasの最初のconsumerはfactory生成後に登録される。

app.jsは4,751→4,742行（9行減、今回の再開から合計98行減）。新script／unit fileなし。既存SketchCommand unitに2件追加し、Root／不在の無変更と取消準備→反転→表示／履歴の順、名前変更拒否時のmodel／prompt未参照、scope切替と元Sketchの無変更を確認。構文510ファイル・単体1,408件・関連E2E45件が成功（すべてexit 0、E2E1.1分）。sketch-permissions／sketch-edit／sketch-tree-visibility／sketch-tree-deleteを実行し、ロック保存・Undo・名前変更・作図先／表示とTree更新を確認。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-sketch-update-command-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はCommandPanelの表示先選択とイベント振分け、残るmode／command操作調整と機能ごとの生成接続を整理する。

### 表示数値の整形

formatDisplayNumber／formatDimensionLabel／formatMeasuredDimensionLabelと通常1e-6・実測1e-5の許容差をNumberDisplayへ分離。UI／Canvas共通の純粋な表示文字列として状態やDOM／viewport・Documentに依存しない。appは起動冒頭で3関数を取得してProperties／Parameter／Annotation／座標・寸法へ接続する。3bodyと定数は元コードをそのまま維持し、既存の浮動小数補正・小さい値・末尾ゼロ・負のゼロ・非有限数・suffixと引数defaultを保持。モデル計算値、保存形式、寸法外観の固定桁表示は変更しない。

app.jsは4,781→4,751行（30行減、今回の再開から合計89行減）。新module／unit fileを追加しindex.html・check-syntax・明示unit一覧・unified-uiのscript期待を同期。unit3件で丸め境界と微小値、通常／実測の許容差、suffix、桁数制限、有限数変換と負のゼロを確認。構文510ファイル・単体1,406件・先行file URL読込1件・関連E2E50件が成功（すべてexit 0、関連E2E1.1分）。unified-ui／dimension-prefix／parameter-dialog-controller／annotation-display-sizeから寸法・Parameter・数値入力／Properties・注記の関連ケースを抽出。全worker終了後に各専用port8784サーバーだけを確認・終了してrunnerの正常終了を回収。ログはcad-number-display-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はSketch操作に残る更新責務とmode／command操作調整、機能ごとの生成接続を整理する。

### Canvasメニューのコピー可否照会

hasCopyableCanvasSelectionの照会を既存ClipboardPayload.canOfferCopyへ分離し、appは現在model／Selectionを渡す入口だけを持つ。新port／script／unit fileは増やさず、既存factory内のGeometryRefとHatch境界参照照会を使う。model内のObject同一参照、対象型の順と短絡、全選択Hatchの境界GeometryRef選択を維持し、元bodyとの一致を確認。これはメニュー専用の既存判定であり、派生Instanceだけの場合を含むbuildの条件とは統一していない。UIやコピー可否の仕様変更は行わない。

app.jsは4,800→4,781行（19行減、今回の再開から合計59行減）。既存ClipboardPayload unitに2件追加し、現在scopeの同一参照、既存対象型、Hatch外周／穴の境界選択と無変更を確認。構文508ファイル・単体1,403件・関連E2E20件が成功（すべてexit 0、E2E56.3秒）。unified-ui／derived-selection-copy／hatching／reference-imagesからcopy／paste／clipboard／context／cutの関連ケースを抽出し、メニュー、Hatch境界、Geometry／派生Instance／画像のコピー・貼付けを確認。npm経由のWindows引数引用で正規表現のpipeが展開されたため、Playwright CLIを直接呼び出して実行した。全20件とworker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-copy-menu-query-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次は表示数値の整形と、残るmode／command操作調整・機能ごとの生成接続を整理する。

### 重なり順の操作調整

選択候補生成／最前面owner照会／menu状態／順序変更完了をDrawingOrderCommandへ分離。11個の限定した現在model・Selection／通常選択・権限照会とUI／draw／history／hint portで接続する。owner解決・順序補完・並べ替え計算は既存DrawingOrderを利用する。appは現在modelの取得と生成接続を持ち、Document／Block・一時model切替後のscopeを保持しない。元4bodyと一致し、作図先優先→通常選択時だけSketch配列逆順、選択Sketch→作図先fallback、guard→reorder→UI（analysis再計算なし）→draw→history→hint順と結果を維持する。

app.jsは4,827→4,800行（27行減、今回の再開から合計40行減）。構文508ファイル・単体1,401件・関連E2E165件が成功（すべてexit 0、E2E2.9分）。新command／unit fileを追加しindex.html・check-syntax・明示unit一覧・unified-uiのscript期待を同期。先行してfile URLの起動／Helpとscript読込1件も成功。新unit4件でscope／元参照と配列の維持、拒否と未対応操作時の表示／履歴なし、最前面の優先と逆順、Document／Block切替時の現在scopeを確認。drawing-order／unified-ui／sketch-permissions／blocks／derived-selection-copyを実行。全worker終了後に各専用port8784サーバーを確認・終了してrunnerの正常終了を回収。ログはcad-drawing-order-command-{check,unit,loader,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はCanvasメニューのコピー可否照会とClipboard責務の境界、mode／command操作調整と機能の生成接続を整理する。

### 共通hit対象範囲

ordinarySelectionMode／hitSketchAllowed／hitElementAllowedを既存GeometryHitQuery.createScopePolicyへ集約。mode／pending command／constraint commandとSketchの表示・要素表示・所属・作図先・編集可否の8個のread portで接続し、通常選択は表示中の別Sketch／ロック中も検査でき、command中は作図先の編集可能要素へ絞る既存動作を維持する。SelectionやDocument／操作sessionは所有・変更しない。3式は元のbodyと照合し、状態はcallbackで実行時に読む。元のhoisted関数からconstへの変更について、生成時に状態を読まないことと全consumerの登録／呼出し時点を確認。新script／unit fileなし。

app.jsは4,828→4,827行（1行減、今回の再開から合計13行減）。単なるdelegateを追加せず、8個の依存の生成接続へ置換したため行数差は小さい。既存GeometryHitQuery unitへ2件追加し、通常選択／保留command／拘束command／mode／作図先／lockの切替と、非表示・非select・保留command時の短絡順を確認。構文506ファイル・単体1,397件・関連E2E180件が成功（すべてexit 0、E2E3.0分）。sketch-permissions／sketch-projection／blocks／unified-ui／drawing-order／derived-selection-copyを実行。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収。ログはcad-hit-scope-policy-{check,unit,e2e}.log。全E2Eは今回未実行。全体目標は未完了。次はSelectionと重なり順操作の調整、mode／commandの開始と機能ごとの生成接続を整理する。

### Sketch編集のguardと拒否処理

guardSketchEdit／guardSelectionEdit／canCreateInActiveSketch／rejectRootSketchCreationを既存SketchCommand.createEditAccessへ分離。権限規則はSketchContext、Selection／preview／snap状態は既存ownerに残す。11個の限定した照会・通知・解除portで接続し、実行時の作図先、default operation、null／undefinedの扱い、選択所属の重複排除と最初の拒否での短絡、hint→snap→pointer→draw順を保持。appではSketchContext直後に生成し、後で初期化されるclearSnap／drawingPreviewはcallbackで遅延参照する。4関数の本体一致を確認し、既存SketchCommand unitに境界検証4件を追加。新script／unit fileなし。

app.jsは4,840→4,828行（12行減）。構文506ファイル・単体1,395件・関連E2E171件が成功（すべてexit 0、E2E3.3分）。sketch-permissions／sketch-edit／sketch-projection／blocks／unified-uiを実行。初回E2Eで検出したclearSnap初期化前参照を修正し、同じ対象を再実行して成功。全worker終了後に専用port8784サーバーだけを確認・終了しrunnerの正常終了を回収した。ログは一時ディレクトリのcad-sketch-edit-access-{check,unit,e2e}.log。全E2Eはこの単位では未実行。次は共通hit方針と操作調整・機能の生成接続を整理する。

### 前回の停止地点（2026-10-14）

週枠残量59%で停止条件に達したため新規分離を停止。2026-10-14の再開はdevelop 7a1983eを基準とし、63個の区切りのcommitを保持してcodex/interaction-observationで進めた。app.jsは7,734→4,840行（2,894行減）。コード最終commitは7dc83dc、develop統合commitは883e7ef。描画／PNG一時状態、Canvas表示更新のsnapshot、寸法／Annotation／Geometry表示、command対象／Sketch表示方針、Selection照会／identity更新、投影source／legacy fixture、Instance source、メニュー／toolbar／Document設定と入力、固定／拘束操作、テスト支援を責務ごとに整理した。各ownerと依存はimplementation-map.mdと正式なモジュール構成を参照し、区切りは本書とGit履歴に残す。

最新developの883e7efで構文506ファイル・単体1,391件・全E2E583件が成功（すべてexit 0、全E2E25.2分）。長時間のconstraint-drag-regressions全file（12.8分）を含み、過去の部分検証を最終結果として流用していない。ログは一時ディレクトリのcad-refactor-oct14-final-{check,unit,e2e}.log。全runnerの正常終了後、実体を確認した専用port8784サーバーだけを終了した。最終検証後の変更はこの停止記録のみとし、developへCommit／Pushした後、mainを最後に反映して直ちにdevelopをmainへfast-forward・Pushしてlocal／remoteを同期する。統合済み作業branchを削除してruntimeを再生成し、目標を一時停止する。

全体目標は未完了。app.jsを数百行（目安200〜500行）のcomposition rootへ収束させたとは扱わない。未分離の権限guard／hit方針・mode／command開始や操作調整、UI／描画の残る情報取得と、機能ごとの生成／接続・test hookの組立て整理が残る。再開は最新Gitの現物・usage・worktree・origin/main／developの祖先関係を確認し、最新developから新しい作業branchを作る。終了済みcodex/interaction-observationは再使用しない。次の候補はguardSketchEdit／guardSelectionEdit／canCreateInActiveSketch／rejectRootSketchCreationのguard／通知と、ordinarySelectionMode／hitSketchAllowed／hitElementAllowedの照会。SketchContextの権限規則を変えず、拒否時の無変更、default Sketch／operation、短絡／hintとUI順・callback登録とlate constの参照時点を維持する。巨大mutable contextや別の巨大appへの移動、ただの薄いdelegateの再分割は行わない。

### 前回の区切り

selectionItems／selectionSketchIdを既存CanvasSelection.createScopeQueryへ、identity選択更新をCanvasSelectionInteraction.createIdentitySelectionへ分離。照会2port・更新5portに限定し、category順／重複／元参照と先頭itemのSketch→inspection→null、Block→derived owner優先、additive Sketch拒否／ID toggleとnon-additive clear→kind判定→set、UI→draw／結果とidentity無変更を維持する。appは早期callback用hoisted入口と生成接続を持つ。app.jsは4,854→4,840行（14行減、今回の再開から合計2,894行減）。構文506ファイル・単体1,391件・関連E2E199件が成功（すべてexit 0、E2E2.6分）。既存Selection／CanvasSelectionInteraction unitへ3件追加し、一覧順／重複／refとSketch fallback、全kind更新とowner優先／UI順、additive拒否／toggle receiver・unknown-kind時の元clear順を確認。元3body一致と2／5portの初期化順・既存callback登録をaudit。unified-ui／blocks／derived-selection-copy／sketch-permissions／sketch-projection／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-selection-identity-entry-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

選択対象からInstance sourceを構成する照会を既存InstanceProjection.createSourceSelectionへ集約。現在model／選択Geometry・CanvasSelection／Block・派生bundle／Sketch ID・active／refの8照会入口に接続し、選択Geometry→model内Hatch→Block→派生bundleの順、Block local kind explicit／派生Point source explicit、Object同一性のSet重複除去とactive／ref filterを維持する。元model aliasと現在selectionをcall時に読み、新cache／ID重複規則やSelection／session更新を持たず、早期Instance command用hoisted入口を維持。app.jsは4,863→4,854行（9行減、今回の再開から合計2,880行減）。構文506ファイル・単体1,388件・関連E2E204件が成功（すべてexit 0、E2E2.7分）。既存InstanceProjection unitへ2件追加し、収集順／元参照／identity dedup／同ID別object保持とexplicit種別、現在model／selection／activeとref短絡・無変更を確認。元body一致と8portの初期化順・early command登録をaudit。unified-ui／blocks／derived-selection-copy／hatching／sketch-projection／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-instance-source-selection-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

求解後の操作調整を新しいSolveRefreshCommandへ分離。active Sketch／ParameterStabilization・ConstraintAnalysis／hint／UI／draw／Historyと履歴記録の8入口へ接続する。求解→分析→hint→UI(refreshAnalysis:false)→描画→成功かつ現在restoringでない場合だけhistory確定の順、raw result／solved／analysis参照、default Sketch評価、失敗でも表示する流れと各段階の例外伝播／後続省略を維持。新求解／snapshot／回復規則や状態を持たず、モデル回復は既存ownerへ残す。app.jsは4,869→4,863行（6行減、今回の再開から合計2,871行減）。構文506ファイル・単体1,386件・関連E2E191件が成功（すべてexit 0）。新unit3件でdefault／explicit Sketchとresult参照・進行順、失敗／restoring時のhistory条件と描画後の現在値、各段階例外を確認。元body一致と8portの初期化順・早期command登録をaudit。unified-ui／blocks／file-safety／derived-selection-copy／constraint-fixed／phase0-characterizationの184件（2.4分）とconstraint-drag-regressionsのnative pointer reversals and undo限定7件（25.6秒）を実行。後者の全fileや全E2Eは未実行。index.html、構文／unit実行リスト、file URLのscript期待値を同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-solve-refresh-command-{check,unit,e2e,native-e2e}.log。全体目標は未完了。

### 前回の区切り

モデル寸法の既定値適用を既存DocumentState.normalizeDimensionStateへ集約。明示scopeの拘束を既存target解決／DimensionPlacement正規化の2入口で順に処理し、targetなし短絡・constraint／array参照・dimension代入順と失敗時の部分反映／例外伝播を維持。app adapterはcall時の元modelとplacement receiverを維持し、独自配置／Solver規則を持たない。定義以外の呼出／公開がない旧sketchSolveErrorTitle／dependentErrorSummaryを除去し、結果表示は既存ConstraintFeedbackへ残す。app.jsは4,886→4,869行（17行減、今回の再開から合計2,865行減）。構文504ファイル・単体1,383件・関連E2E186件が成功（すべてexit 0、E2E2.5分）。既存DocumentState unitへ2件追加し、順序／constraintとarray参照・targetなし短絡・raw／undefined寸法、失敗時の部分代入／後続省略を確認。元loop一致とadapter receiver・Document適用の登録順、unused helper全呼出関係をaudit。unified-ui／file-safety／blocks／dimension-prefix／multiple-dimensions／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-dimension-state-normalization-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

矩形選択のlineIntersectsRect／segment交差を既存GeometryBoundsへ集約。bbox短絡・endpoint内判定・4辺とのcross-product／onSegmentと1e-9許容値、inclusive境界／near-corner／退化線・bbox gateを元bodyのまま維持し、既存local Bounds関数を使う。segmentsIntersectはprivateとし、新state／依存を増やさずappは静的入口へ接続。全tracked JS／HTML・仕様とtest hookで定義以外の呼出／公開がないprivate selectCreatedSketchProjectionTargetsを除去し、現在のSelection所有は変更しない。app.jsは4,924→4,886行（38行減、今回の再開から合計2,848行減）。構文504ファイル・単体1,381件・関連E2E188件が成功（すべてexit 0、E2E2.5分）。既存DrawingBounds unitへ2件追加し、inside／横縦交差／辺・角接触／共線／退化線／反転／無変更、near-corner許容値とbbox短絡を確認。元2body一致と既存local依存・unused selector呼出関係をaudit。unified-ui／sketch-projection／blocks／derived-selection-copy／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-rectangle-intersection-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

旧投影target生成の呼出元を調査し、現在はcompatibility／source-editing fixtureだけで使われると確認したため、製品編集ownerではなく既存SketchProjectionTestDriver.createLegacyTargetConstructionへ集約。test query有効時だけ5個のGeometryCreation入口へ接続する。Point／Line／Circle／Arc／Splineの座標・target Sketch／point kind・construction／closed・radius／angle、point生成→geometry生成順、独立参照とsource無変更、例外時の既存部分割当を維持し、ID／モデル編集の所有は動かさない。app.jsは4,948→4,924行（24行減、今回の再開から合計2,810行減）。構文504ファイル・単体1,379件・関連E2E188件が成功（すべてexit 0、E2E2.5分）。既存SketchProjectionTestDriver unitへ2件追加し、全種類の作成順／point・geometry参照・Sketch／flags／source無変更、unsupported kind無割当とradius失敗時の伝播／部分割当を確認。元2body一致と5port／全呼出元・test登録時点をaudit。sketch-projection／unified-ui／blocks／derived-selection-copy／phase0-characterizationを実行。新script／unitファイルは追加していない。製品投影commandや保存形式の新しい動作を追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-projection-target-construction-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

投影sourceのcoverageと候補entry変換を既存SketchProjectionQueries.createSourcesへ分離。現在model／active Sketch、Geometry ref・種類・key／同一性、既存投影拘束query／operational／Sketch・参照元／可視性、operand変換の13portへ接続。Instance優先→従来拘束、Point constraintのObject同一性／string ID、他Geometryのkind／source key・target Sketch・operational条件、候補guard順を維持する。currentScope adapterは元model aliasをcall時に読み、既存拘束queryのscope／cacheを変更しない。新cache／重複規則やモデル／session更新を持たず、早期command callback用hoisted入口を維持する。app.jsは4,969→4,948行（21行減、今回の再開から合計2,786行減）。構文504ファイル・単体1,377件・関連E2E204件が成功（すべてexit 0、E2E2.7分）。新source unit4件でInstance優先／現在model・target／null、従来Point identity／IDとkind／operational／target、primitive kind／key、候補metadata／参照元／visibilityとoperand変換を確認。元4body一致と13portの初期化順をauditし、operand helper生成後へ配置。sketch-projection／unified-ui／blocks／derived-selection-copy／hatching／phase0-characterizationを実行。新production scriptはなく、構文／unitリストへ新unitを同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-projection-source-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch関係に応じたconstraintStatusColor／strokeWidth／alpha／描画順を既存GeometryPresentation.createSketchStyleへ分離。solve error／Sketch ID・関係／拘束status／可視性／activeの6照会portに接続する。選択→Hover→solve error→非active→statusの色優先、各関係の線幅／alpha、visible filter→stable inactive／active順と元item参照・入力array無変更を維持。表示色定義もGeometryPresentationへ集約し、寸法が共有する非active色を同モジュールの定義から参照する。Solver／Sketch／Selectionを変更せず、appは既存callback用hoisted入口と接続を持つ。app.jsは4,994→4,969行（25行減、今回の再開から合計2,765行減）。構文503ファイル・単体1,373件・関連E2E180件が成功（すべてexit 0、E2E2.4分）。既存GeometryPresentation unitへ3件追加し、色優先と照会短絡／status fallback、各関係の幅／alphaと最新値、visibility／active変更とstable順／参照／array無変更を確認。元4bodyと色定義の一致・6portの初期化順をaudit。unified-ui／blocks／view-visibility／sketch-permissions／selection-zoom-shadow／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-sketch-display-policy-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

拘束operand／command対象／pending referenceの表示強調照会を既存GeometryPresentation.createCommandTargetsへ分離。panel snapshot／現在mode／Instance・Sketch投影・pattern command、Geometry ref／同一性、現在operand／拘束command／pendingと参照Sketch照会の15portに接続。panel最優先とfalse短絡、Instance／投影／pattern→arc endpoint／operand、command referenceTarget→pendingの優先・kind／Object同一性、reference hover短絡を維持する。状態複製・Selection／session更新・Canvas命令を持たず、appのhoisted入口は先に登録されたpaint callbackの参照時点を保持する。app.jsは5,010→4,994行（16行減、今回の再開から合計2,740行減）。構文503ファイル・単体1,370件・関連E2E188件が成功（すべてexit 0、E2E2.5分）。既存GeometryPresentation unitへ3件追加し、panel優先／false短絡と現在Instance／投影／pattern、operand同一性とarc endpoint優先、reference hover・command／pending優先と各kind・nullを確認。元3body一致と15portの初期化順をaudit。unified-ui／blocks／sketch-projection／derived-selection-copy／constraint-fixed／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-command-target-presentation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvas表示更新の調整とpanel選択対象の表示snapshotを新しいsrc/ui/canvas_refresh.jsのCanvasRefresh.createへ分離。PNG command／pending・mode照会、CommandPanel／DerivedPanel、Annotation入力同期、profiling／Geometry read cache／Canvas描画の10portに接続する。取消→panel→入力→snapshot→profile／cache→描画の順、PNG busy／session／mode短絡とreceiver、代入前の失敗時は旧snapshot保持、描画失敗の既存例外伝播とprofile／cacheのcleanup範囲を維持。commandPanelSelectedItemをprivate状態へ移し、Geometry強調はgetterへ接続。モデル／session／commandは複製しない。app.jsは5,017→5,010行（7行減、今回の再開から合計2,724行減）。構文503ファイル・単体1,367件・関連E2E192件が成功（すべてexit 0、E2E2.7分）。新unit3件で現在panel／入力／snapshot／profiling／cache順、PNG busy／終了判定とmode短絡、snapshot代入前／後の例外範囲・cleanupを検証。元body一致と10portの初期化順をauditし、後に生成されるAnnotation入力／panelはcallbackで参照。unified-ui／png-export／authoring-performance／blocks／unified-annotations／phase0-characterizationを実行。index.html、構文／unit実行リスト、file URLのscript期待値を同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-canvas-refresh-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Block／Instance配置とOffsetのpreview情報取得・描画接続を既存PlacementPreviewRenderer.createLayer／OffsetPreviewRenderer.createLayerへ分離。配置はrenderer／mode・pointer read／Block・Instance command／Block projectionの6port、Offsetはrenderer／mode・pointer read／commandの4portを持つ。Blockのmode→definition→pointer→preview短絡とbundle生成・描画、Instanceのmodeに依存しないpreview、Offsetのmode短絡後の現在plan取得とreceiver・元参照／null／順序を維持する。モデル／session更新を持たず、appは通常描画と生成後の診断APIを直接接続して中継を除去。app.jsは5,022→5,017行（5行減、今回の再開から合計2,717行減）。構文501ファイル・単体1,364件・関連E2E189件が成功（すべてexit 0、E2E2.5分）。既存PlacementPreview／Offset unitへ3件追加し、全guard／projection／painter順・参照、modeに依存しないInstance、Offset plan短絡と現在pointer／null・receiverを確認。元3body一致と6／4portの初期化順・診断登録順をaudit。配置layerはrenderer生成後に置く。unified-ui／blocks／derived-selection-copy／hatching／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-placement-offset-preview-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

作図previewのmode判定と現在command情報取得・描画接続を既存AuthoringPreviewRenderer.createLayerへ分離。renderer／mode・pointer・trimのread入口、Line／Rectangle／Slot／Circular／Spline／Centerlineの既存一時値、Centerline投影／Canvas寸法の12portで接続する。Line→Centerline→Rectangle→Slot→Circle→Arc→ThreePointArc→Splineの判定／描画順、現在値／元参照、support短絡とpointer不在時の投影省略を維持し、TrimはBlock／Instance／Offsetの後の入口へ残す。モデル／session変更を持たない。診断登録はfactory生成後と確認し、新入口へ直接接続して旧preview guard／中継関数を除去。app.jsは5,038→5,022行（16行減、今回の再開から合計2,712行減）。構文501ファイル・単体1,361件・関連E2E153件が成功（すべてexit 0、E2E2.0分）。既存AuthoringPreview unitへ2件追加し、各modeと現在command参照／painter receiver、描画中mode変化の判定順、Centerline support／pointer／投影とCanvas sizeの短絡／順序を確認。全9body一致と12portの初期化順・診断登録順をaudit。unified-ui／spline／slot-dimension／tool-flyouts／hatching／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-authoring-preview-layer-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

直線／角度寸法の描画plan組立てを既存DimensionPresentation.createPainterへ分離。既存Layout／Metrics／Renderer、dimensionLayout入口、外観／現在Sketch／shaft係数の7portに接続する。target／dimensionとlayout短絡、外観既定値と評価順、plan／円弧延長／angle span・外側terminatorとshaft変換／radius下限、rendererへ渡す参照／flags・receiver／呼出順と元の戻り値を維持する。appは生成接続とhoisted入口へ縮小し、不要になった5個のLayout／Metrics関数参照を除去。app.jsは5,052→5,038行（14行減、今回の再開から合計2,696行減）。構文501ファイル・単体1,359件・関連E2E154件が成功（すべてexit 0、E2E2.1分）。既存DimensionPresentation unitへ3件追加し、default Sketch／short circuitと評価順、直線payload／参照／flags、負の角度span・shaft変換／radius下限／inside短絡を確認。元body一致と7portの初期化順をaudit。unified-ui／dimension-prefix／annotation-display-size／multiple-dimensions／slot-dimension／png-export／phase0-characterizationを実行。関数参照整理後も構文／全unitを再実行し、E2Eは整理済みコードで実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-dimension-painter-{check-final,unit-final,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

選択矩形の表示を既存InteractionOverlayRenderer.drawSelectionRectへ分離。appはSelectionRectangle.previewの取得と描画呼出だけを持ち、rendererはpreview不在の短絡・crossing／enclosingの色・現在倍率に応じた線幅／破線・fill→strokeを扱う。既存withCanvasStateを接続し、session／Selection変更・pointer lifecycleへ依存しない。元body一致とwithCanvasStateの初期化位置・preview参照時点をaudit。app.jsは5,064→5,052行（12行減、今回の再開から合計2,682行減）。構文501ファイル・単体1,356件・関連E2E188件が成功（すべてexit 0、E2E2.5分）。既存overlay unitへ1件追加し、preview不在短絡・crossing／enclosingと倍率・描画順／Canvas隔離入口・preview無変更を確認。unified-ui／blocks／sketch-projection／png-export／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-selection-overlay-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Construction線分の表示延長を既存GeometryPresentation.createLineDisplayへ、描画対象のfilter／現在一覧／Sketch順とpainter呼出をGeometryRenderer.createLayerへ分離。表示線分3port、描画対象7portで既存viewport／外観／現在Geometry一覧とrendererへ接続する。短小線・非正／非有限延長量・overhang無効時の元point参照、倍率、explicit外観、空array／null／undefinedとoptions・painter receiver／元の戻り値を維持し、モデル端点は変更しない。renderer生成前のcallback登録に必要なhoisted入口をappへ残す。app.jsは5,088→5,064行（24行減、今回の再開から合計2,670行減）。構文501ファイル・単体1,355件・関連E2E198件が成功（すべてexit 0、E2E2.6分）。既存2unitへ3件追加し、live倍率／延長と無変更・参照、degenerate／非有限短絡、explicit／既定／空itemsと現在一覧・順序／options／receiverを確認。元body一致と3／7portの初期化順をaudit。unified-ui／hatching／selection-zoom-shadow／spline／blocks／png-export／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-geometry-display-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Annotationの実効外観を既存GeometryAppearanceQuery.createAnnotationへ、表示色をAnnotationRenderer.createColorへ、描画対象巡回をcreateLayerへ分離。外観照会2port・色決定5port・巡回5portに限定し、現在Document／Sketch一覧、Block definition／localElement、継承／precision／affix・順序付きBlock override、PNG→選択／inspection→Hover→通常色、可視性短絡と元の対象参照／描画順を維持する。状態複製・保存styleへの代入・求解／履歴を持たない。appのhoisted入口は先に登録されたcallbackの参照時点を維持。app.jsは5,113→5,088行（25行減、今回の再開から合計2,646行減）。構文501ファイル・単体1,352件・関連E2E216件が成功（すべてexit 0、E2E3.1分）。既存2unitへ4件追加し、plain Textの短絡とlive Document／Sketch、投影local参照とoverride／無変更、explicit styleと色優先／PNG短絡、live対象／visibility／描画順と参照を検証。元body一致と全portの初期化順をaudit。unified-ui／unified-annotations／leader-appearance／annotation-display-size／blocks／png-export／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-annotation-presentation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

通常寸法の表示情報取得と矩形選択用boundsを新しいsrc/rendering/dimension_presentation.jsへ分離。createLayerは19portで現在表示scope・可視性／外観／配置／ラベル、Selectionとhover／drag／pending／PNG／statusのread入口と既存rendererへ接続し、createSelectionBoundsは12portで現在配置・Text metricsから回転／複数行／式記号を含むboundsを返す。元body・短絡／順序・target／dimension参照とsave／restore・例外伝播を維持し、採否とSelection変更は既存RectangleSelectionQuery／CanvasSelectionに残す。app.jsは5,131→5,113行（18行減、今回の再開から合計2,621行減）。構文501ファイル・単体1,348件・関連E2E181件が成功（すべてexit 0、E2E2.5分）。新しいunit3件で回転複数行ラベルとshaft bounds、visibility／target／layout短絡とdefault、live scope／interaction／PNGの情報と順序を確認。元body一致と各port初期化順をauditし、後に生成されるdimensionDragはgetterで描画時に読む。unified-ui／dimension-prefix／png-export／blocks／annotation-display-size／phase0-characterizationを実行。index.html、構文／unit実行リスト、file URLのscript期待値を同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-dimension-presentation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法previewの表示情報構成と描画呼出を新しいsrc/rendering/dimension_preview.jsのDimensionPreview.createへ分離。現在pendingのread-only getter、既存配置／式評価／表示形式／角度照会と寸法／fillet描画の13portに接続する。fillet仮半径、距離の配置／入力、axis target copy、angle／interval、invalid／selecting／hidden、元の評価catchと短絡／順序・dimension／target参照を維持。入力確定・求解・履歴・session変更は既存commandに残す。app.jsは5,185→5,131行（54行減、今回の再開から合計2,603行減）。構文499ファイル・単体1,345件・関連E2E171件が成功（すべてexit 0、E2E2.3分）。新しいunit3件で現在pending／fillet失敗短絡、半径anchorと参照、負のinterval／境界／評価失敗、既存dimension同一性／axis copyとdefault／angle／label順を確認。元bodyとの一致と13portの初期化順をaudit。unified-ui／dimension-prefix／blocks／annotation-display-size／phase0-characterizationを実行。index.html、構文／unit実行リスト、file URLのscript読込期待値を同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-dimension-preview-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasのframe準備と描画段階の進行を既存CanvasSurface.createFrameRendererへ分離。bitmap準備→DPR／PNG transform→viewport→共通content→出力／対話stage→stroke reset／restoreの順序とPNG短絡を維持する。10個の限定portに既存surface・現在frame・zoom／描画計測・三つの描画入口を接続し、read cache／入力同期／profilingと各preview内容は従来の所有者へ残す。hoisted drawCanvas入口とcallback参照時点、例外伝播と既存の復元範囲を維持。app.jsは5,202→5,185行（17行減、今回の再開から合計2,549行減）。構文497ファイル・単体1,342件・関連E2E199件が成功（すべてexit 0、E2E2.6分）。既存CanvasSurface unitへ2件追加し、DPR／viewportの最新値、normal／PNG段階とtransform／stroke順、stage失敗時の例外／restore挙動を検証。対話stage本体の一致と10portの初期化順を確認。png-export／unified-ui／hatching／reference-images／blocks／annotation-display-size／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-canvas-frame-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

PNG一時描画frameを既存CanvasExport.createRenderer、復元用previousModeをPngExportCommand.createModeSessionのprivate状態へ移し、appのpngRender／pngPreviousModeを削除。既存region／ratio／worldBoundsの変換とcache内draw、frame解除→bitmap同期→通常draw、mode退避→PNG mode／pending、PNG pendingだけclear→現在modeがPNGなら復元→退避解除を維持する。各renderer／描画はframe getterを照会し、appは直接stateへ代入しない。captureの既存try／finallyと例外伝播、foreign pending／mode・二回終了時の挙動を維持。app.jsは5,210→5,202行（8行減、今回の再開から合計2,532行減）。構文497ファイル・単体1,340件・関連E2E176件が成功（すべてexit 0、E2E2.5分）。既存PNG unitへ2件追加し、実captureとrendererを接続して成功／render・copy・sync失敗時のframe解除／bitmap復元／display順、mode復元／pending receiver・foreign状態保持と退避解除を確認。png-export／unified-ui／hatching／reference-images／unified-annotations／leader-appearance／annotation-display-sizeを実行。新script／unitファイルは追加していない。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-png-owned-state-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Viewport／モデル・履歴・codecや新しい復元規則は追加していない。全体目標は未完了。

### 前回の区切り

Document共通Terminator／Leader既定値の表示／入力を既存DocumentAppearanceSettings.createSharedへ、値反映をDocumentDefaultAppearanceCommand.createSharedへ分離。Terminatorの部分normalize→同じobjectへassign、Leaderの現在値／viewportScale／Document実効外観→既存applyと、反映→共有再表示→履歴→UI→drawを維持する。UIはkey検査・checkbox反転／生文字列・palette対象・両section再表示を持ち、Document変更はcommandへ委譲。app.jsは5,233→5,210行（23行減、今回の再開から合計2,524行減）。構文497ファイル・単体1,338件・関連E2E169件が成功（すべてexit 0、E2E2.3分）。既存unitへ3件追加し、Terminator参照／無関係property保持、Leaderの最新倍率／実効外観と再表示／履歴／UI／draw順、key短絡・checkbox反転／raw値・rows receiver／palette・元の必須field失敗を確認。unified-ui／leader-appearance／unified-annotations／annotation-display-size／dimension-prefix／phase0-characterizationを実行。新script／unitファイルは追加していない。設定clickはGeometry→Dimension→Shared準備→dialog表示の接続へ縮小。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-document-shared-appearance-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Document／外観規則・snapshot／履歴・DOM状態は追加していない。全体目標は未完了。

### 前回の区切り

Document既定寸法外観の表示／入力を既存DocumentAppearanceSettings.createDimensionへ、値反映をDocumentDefaultAppearanceCommand.createDimensionへ分離。現在寸法／Terminator合成・normalize／rows→affix準備→localize→angle表示、key検査・prefix／suffixの生文字列／他値trim・input履歴なし／change履歴ありとangle→UIを維持する。値反映は既存apply（継承なし）→dimensionDefaults→置換→必要な履歴→draw。既定値getter／setterとnormalize adapterはDocument／Appearance所有者へ接続する。app.jsは5,253→5,233行（20行減、今回の再開から合計2,501行減）。構文497ファイル・単体1,335件・関連E2E153件が成功（すべてexit 0、E2E2.1分）。既存unitへ3件追加し、現在の既定値／反映・preview／確定履歴、複数行affixと空白保持・trim・input対象限定／change順、無効keyの値照会省略と表示通知／palette、要素不在を確認。unified-ui／dimension-prefix／annotation-display-size／leader-appearance／view-visibility／phase0-characterizationを実行。新script／unitファイルは追加していない。Terminator／Leaderとdialog準備はappに残り次の単位とする。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-document-dimension-appearance-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自正規化／履歴／Document状態は追加していない。全体目標は未完了。

### 前回の区切り

Documentの通常／Construction Geometry既定外観の表示／入力準備をsrc/ui/document_appearance_settings.jsのDocumentAppearanceSettings.createGeometryへ、値反映をsrc/commands/document_default_appearance_command.jsのDocumentDefaultAppearanceCommand.createGeometryへ分離。UIの現在値照会／normalize・effective合成／rows／localize・key検査／trim／palette対象と、既存apply→normalize（partial:false）→既定値置換→履歴→UI→drawを維持する。Document状態はreadDefault／writeDefaultの限定adapterへ接続し、UIはモデル変更／履歴を持たない。app.jsは5,283→5,253行（30行減、今回の再開から合計2,481行減）。構文497ファイル・単体1,332件・関連E2E200件が成功（すべてexit 0、E2E2.7分）。新単体4件で現在の同一参照／正規化後の置換・更新順、normalize例外時の既存非rollback／通知なし、継承合成／key検査／trim／palette対象／最新既定値と要素不在の短絡を確認。unified-ui／leader-appearance／view-visibility／blocks／hatching／phase0-characterizationを実行。新script二つはindex／構文・単体一覧／読込期待値を同期。寸法／Terminator／Leader・dialog準備はappに残り次の単位とする。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-document-geometry-appearance-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Document／外観型・正規化ルール／snapshot／履歴は追加していない。全体目標は未完了。

### 前回の区切り

作図／派生／Block／Hatch等21個のToolbar入力接続を既存ToolbarView.createBindingへ分離。各既存commandへ同じ引数／生handlerで委譲し、必須／任意要素と任意要素不在のhandler照会短絡、DOM receiverとLifecycleの操作時method照会を保持する。bindingは二重登録防止・登録listener解除／再bindだけを所有し、状態表示createとは独立した依存で生成する。開始／取消／guardと作図状態は既存所有者へ留める。app.jsは5,303→5,283行（20行減、今回の再開から合計2,451行減）。構文494ファイル・単体1,328件・関連E2E215件が成功（すべてexit 0、E2E3.4分）。既存Toolbar unitへ2件追加し、live Lifecycle／raw handler／receiver、登録寿命・二重登録／解除／再bind、任意tool不在でprovider照会しない短絡と必須controlを確認。unified-ui／adversarial-authoring-performance／toolbar-layout／tool-flyouts／hatching／sketch-projection／blocks／phase0-characterizationを実行し、作図性能・各開始入口・tool表示と周辺操作を確認。新script／unitファイルは追加していない。仕様の表示担当はcreateへ限定し、binding担当を追記。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-toolbar-input-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自mode／作図状態・開始／取消／guardルール・モデル／Solver／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Document入出力のUI接続をsrc/ui/document_file_controls.jsのDocumentFileControls.createDocument／createDxfへ分離。Document保存／別名保存／読込・input／linkとDXFの依存／登録寿命を別factoryにし、既存commandの非同期void委譲・input handler／receiver・必須／任意要素、DXFのflush→busy／編集可否短絡→hint／picker、File取得→input解除→同じFile参照でimportの順を保持する。任意input不在でhandler照会も省き、Fileなしのundefinedを維持。各bindingは二重登録防止・登録listener解除／再bindだけを所有する。PNG／Reference Image／Sketchとstartup／beforeunloadは既存経路へ留める。app.jsは5,314→5,303行（11行減、今回の再開から合計2,431行減）。構文494ファイル・単体1,326件・関連E2E156件が成功（すべてexit 0、E2E2.0分）。新単体3件でDocument非同期委譲／元handler／receiver／登録寿命、任意要素／handler照会短絡と必須要素、DXFのlive busy／編集可否／flush／input解除・File／undefinedを確認。unified-ui／file-safety／document-bookmarks／dxf-import／png-export／phase0-characterizationを実行し、native保存／再読込・link・importと周辺操作を確認。新scriptはindex／構文・単体一覧／読込期待値を同期。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-document-file-controls-{check,unit,e2e}.log。全E2Eはこの単位では未実行。ファイルsession・保存形式／互換性・リンク処理・import／モデル／履歴は新設していない。全体目標は未完了。

### 前回の区切り

拘束／固定入力の判断をsrc/commands/constraint_control_command.jsのConstraintControlCommandへ、拘束／menu／Fix buttonのイベント接続を既存ConstraintControlsView.createBindingへ分離。再click取消／Annotationの経路別優先順、Symmetry／距離／通常拘束・固定の分岐と既存pending／command／UI／拘束追加順を維持する。menuは既存button click→details終了、datasetは操作時照会とし、bindingだけが二重登録防止・listener解除／再bindを所有する。状態表示createとは独立した依存で生成。元の三つのhandler本体を維持。app.jsは5,349→5,314行（35行減、今回の再開から合計2,420行減）。構文492ファイル・単体1,323件・関連E2E237件が成功（すべてexit 0、E2E3.3分）。新単体4件で経路別取消／Annotation優先、Symmetry／距離、通常拘束更新順、固定のmode／Selection分岐を確認。既存View unitへ1件追加し、dataset更新・menu経路／閉じ順・未知menu・二重登録／解除／再bindを確認。unified-ui／annotation-anchors／blocks／fixed-command／block-geometry-fixed／sketch-permissions／phase0-characterizationを実行。新scriptはindex／構文・単体一覧／読込期待値を同期。仕様の状態表示担当はcreateへ限定して入力担当を追記。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-constraint-controls-input-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自mode／pending／Selection／拘束・求解／履歴は追加していない。全体目標は未完了。

### 前回の区切り

固定切替のoperand／Selection経路をsrc/commands/fixed_toggle_command.jsのFixedToggleCommand.createOperand／createSelectionへ分離。現在scope・許容誤差・型／参照照合・batch／guardと既存追加／削除・snapshot／restore・依存求解／解析・UI／履歴へ接続し、Instance／端点／batchの優先順と同一参照・enabled／return・失敗復元／成功更新順を維持する。元の二つの本体との一致を依存port置換後に確認。早いConstraintTargetCommand callback登録はappの薄い委譲関数で保持。app.jsは5,429→5,349行（80行減、今回の再開から合計2,385行減）。構文490ファイル・単体1,318件・関連E2E201件が成功（すべてexit 0、E2E2.6分）。新単体5件で現在scope／enabledとoperand return、同一Instance投影の固定・混在時の拒否、端点unfixの既存return／commit失敗復元、主／依存／誤差失敗でのPoint flag／拘束復元と履歴なし、batch解除で無関係拘束／配列参照保持と成功時の履歴順を確認。unified-ui／blocks／fixed-command／block-geometry-fixed／sketch-permissions／sketch-projection／phase0-characterizationを実行。新scriptはindex／構文・単体一覧／読込期待値を同期。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-fixed-toggle-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自モデル／Selection・拘束型／Solver／snapshot形式／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Canvas context menu開始の進行を既存CanvasContextMenu.createEntryへ、候補確定の進行をCanvasContextTarget.createCandidateActionへ分離。menu／modeの短絡→native event抑制→menu終了→pointer更新→command／候補照会→単一対象選択／UI→draw→項目構成／session開始と、拘束command時のhit→operand／通常時の対象置換→UI→drawを維持する。pointerはappのsetterへ接続し、同一参照・原点fallbackと元の二つの本体との一致を確認。早いcallback登録は薄いapp委譲関数で維持。app.jsは5,448→5,429行（19行減、今回の再開から合計2,305行減）。構文488ファイル・単体1,313件・関連E2E178件が成功（最終すべてexit 0、E2E2.3分）。既存unitへ4件追加し、menu不在／mode拒否、単一対象／pointer／UI／menu順、通常／拘束command／重複候補と候補確定時の最新command／operand／Selection分岐を確認。初回E2EはcloseAppMenusの早いconst参照による起動ReferenceErrorを確認して中断（exit 1）。runner終了後に操作時callbackへ修正し、他portの初期化位置を監査、構文／全単体／同じ5ファイルE2Eを再実行して成功。再開手順にもportの参照時点監査を明記。unified-ui／blocks／fixed-command／sketch-permissions／phase0-characterizationを実行。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-context-entry-{check,unit,e2e,check-final,unit-final,e2e-final}.log。全E2Eはこの単位では未実行。独自表示session／Selection／command状態は追加していない。全体目標は未完了。

### 前回の区切り

Canvas context actionの編集guard・既存操作への振分けと操作後の更新をsrc/commands/canvas_context_actions.jsのCanvasContextActionsへ分離。Selection／対象Sketchの編集guard→対象またはSelection／active Sketchの構造guardという順・短絡と、既存command／履歴／clipboard／button・Properties／Block／寸法／Sketch／Hatch／Drawing Order／Spline／fitの入口を維持する。寸法整列成功時のUI→draw→履歴→hint、fit結果別hint→draw・hit／target／pointer／Spline参照・method receiver・void paste／未定義returnと例外伝播を保持し、元の処理本体との一致を確認。menuが早く生成される初期化順はappの薄い委譲関数で維持。app.jsは5,482→5,448行（34行減、今回の再開から合計2,286行減）。構文488ファイル・単体1,309件・関連E2E178件が成功（すべてexit 0、E2E2.3分）。新単体4件で編集guard失敗／構造guard先のfallback、寸法整列成功／失敗時の更新順、非編集actionのguard非依存／receiver／returnとfit結果、hit／Spline／pointer参照を確認。unified-ui／blocks／fixed-command／sketch-permissions／phase0-characterizationを実行し、menu・Fix／Undo・権限／Block／基本操作とfile URL読込を確認した。新scriptはindex／構文・単体一覧／読込期待値を同期。仕様の旧action担当も更新。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-context-actions-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Selection／command／model・履歴／求解規則・menu sessionは追加していない。全体目標は未完了。

### 前回の区切り

Canvas context menu項目構成を既存CanvasContextPresentation.createItemsへ分離。候補ラベルのcreateとは独立したfactory／依存で生成し、既存状態／可否・Undo／Redo button表示とmode getterからcommand／空白／対象別のaction ID・ラベル／shortcut・disabled／danger・group／separatorを構成する。command／空白と編集中fit pointの短絡、Block error・生成可否の短絡と照会順を保持し、元の処理本体との一致をmode getter置換後に確認。action実行・履歴／状態更新・menu session／DOM描画は持たない。app.jsは5,556→5,482行（74行減、今回の再開から合計2,252行減）。構文486ファイル・単体1,305件・関連E2E157件が成功（すべてexit 0、E2E2.1分）。新単体4件でcommandのtarget非依存／projection count更新、空白の権限／button不在／bounds照会順、編集中fit pointのFix／clipboard抑制と最小点数、Block error短絡／回転label更新・Drawing Order groupを確認。unified-ui／blocks／fixed-command／sketch-permissionsを実行し、menu／重複候補・Fix／Undo・権限／Blockとfile URL読込を確認した。既存scriptを拡張し、追加unitは構文／単体一覧へ同期。仕様の旧担当表記も現在のcreate／createItemsへ更新。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-context-menu-items-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvas context targetの選択照会／選択更新・拘束hit構成とFix状態照会をsrc/editing/canvas_context_target.jsのCanvasContextTarget.createSelection／createFixObservationへ分離。既存CanvasSelection・端点照合／計算・clearとbatch／固定拘束／Geometry照会へ四port／六portで接続し、同一参照・既選択集合保持／明示置換・既存hit優先／fallback・batch優先・null／booleanと短絡順を保持する。元の四つの処理本体との一致を確認。候補収集／順位・menu表示は既存所有者、項目構成／action調整はappへ留める。app.jsは5,612→5,556行（56行減、今回の再開から合計2,178行減）。構文485ファイル・単体1,301件・関連E2E157件が成功（すべてexit 0、E2E2.1分）。新単体3件で実際のCanvasSelectionを使い、集合保持／置換・IDが同じ別参照・Arc端点／複数寸法・hit参照／計算fallback・live batch／固定拘束・Fix可否の非破壊観測を確認。unified-ui／blocks／fixed-command／sketch-permissionsを実行し、context menu／重複候補選択・Fix／Undo・権限／Blockとfile URL読込を確認した。新scriptはindex／構文・単体一覧／読込期待値を同期。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-context-target-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Selection／拘束・履歴・DOM／描画・menu表示／action実行は追加していない。全体目標は未完了。

### 前回の区切り

共通Selection ID一覧をCanvasSelectionTestDriver.createIdObservationへ、active履歴／Block編集・Undo／Redo／Construction表示の観測をDocumentTestDriver.createHistoryObservationへ、responsive drag準備をGeometryDragTestDriver.createResponsiveFixtureへ分離。既存所有者の最新状態・ID配列の順とコピー・DOM要素なしのundefined／boolean、sample→fit→draw→履歴reset→保存値取得の順を維持し、元の三つの処理本体との一致を確認。公開APIと各test driverへの共通照会入口を維持する。app.jsは5,635→5,612行（23行減、今回の再開から合計2,122行減）。構文483ファイル・単体1,298件・関連E2E262件が成功（すべてexit 0、13ファイル255件5.2分＋constraint-drag-regressions内のnative pointer／Undo7件25.9秒）。最初のE2Eは共有HTTPサーバー停止によるERR_CONNECTION_REFUSEDで中断（exit 1）し、製品／テストを変更せず専用port 8784で全13ファイルを再実行して成功。専用サーバーは実体を確認して検証後に終了。ログはcad-common-test-observations-{check,unit,e2e,e2e-final,native-e2e}.log。新規テストはなく、既存Geometry／Block編集・Selection・Undo／Redo／履歴・表示とnative pointerの連携を確認した。constraint-drag-regressions全体と全E2Eはこの単位では未実行。独自履歴／Selection・モデル／viewport・Geometry生成／求解規則は追加していない。全体目標は未完了。

### 前回の区切り

Document名／file session状態をDocumentTestDriver.createNameObservation／createFileObservationへ、表示設定をCanvasTestDriver.createViewObservationへ、Sketch可視性をSketchTreeTestDriver.createVisibilityObservationへ、themeをPropertiesTestDriver.createThemeObservationへ分離。既存Document名getter／有効名／保存値・title／handle、viewState／拘束表示状態、Sketch／保存値／effective可視性／Tree button、設定／保存theme・既定Geometry色getter／Canvas色変換・contrastへ役割別に接続する。呼出し時の最新値・objectコピー・null／boolean／fallbackと照会順を保持し、元の五つの本体との一致をgetter置換後に再確認。app.jsは5,667→5,635行（32行減、今回の再開から合計2,099行減）。構文483ファイル・単体1,298件・関連E2E129件が成功（すべてexit 0、E2E14.5分）。全利用箇所のfile-safety／unified-ui／constraint-drag-regressionsを実行。新規テストはなく、既存Document保存／読込・file handle／名前・可視性／テーマ／表示と長時間ドラッグ回帰を確認した。ログはcad-runtime-state-observations-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Document／file session・可視性／表示／theme状態・保存規則／履歴は追加していない。全体目標は未完了。

### 前回の区切り

寸法コマンド中のLine drag・クリック配置・線／円と半径差の準備／状態観測と半径差求解確認を既存DimensionTestDriverの七つの入口へ分離。既存reset／Geometry・寸法生成／Selection／command・fit／UI／draw／座標変換、姿勢変更→snapshot／依存求解→解析→UI→draw、呼出し時のscope／拘束・pending／operands・input／drag・計測／保存へ役割別に接続する。観測側には生成／reset依存を渡さず、固定入力・同一参照・null／fallback・pointerコピーと呼出し順を保持する。元の七つの処理本体との一致を依存port置換後に確認。app.jsは5,816→5,667行（149行減、今回の再開から合計2,067行減）。構文483ファイル・単体1,298件・関連E2E144件が成功（すべてexit 0、E2E1.9分）。全利用箇所のdimension-prefix／blocks／unified-uiを実行。新規テストはなく、既存寸法配置／command drag・線／円と半径差・求解回復と周辺操作を確認した。ログはcad-dimension-command-fixtures-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自寸法／Selection・pending／drag・求解／layout・scope／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Block操作位置照会をBlockTestDriver.createInteractionObservationへ、寸法位置照会・式編集開始・Properties選択／Selection観測をDimensionTestDriver.createPositionObservation／createExpressionAction／createSelectionDriverへ分離。既存Instance／投影・Canvas変換・現在scopeの拘束／target／layout・式編集／Selection・UI→drawへ役割別に接続し、同一参照・null／false・fallbackと呼出し順を保持する。寸法位置照会は別test APIのthis依存を既存CanvasTestDriver.clientPositionの明示した入口へ置換。元の五つの処理本体との一致を依存port置換後に確認。app.jsは5,846→5,816行（30行減、今回の再開から合計1,918行減）。構文483ファイル・単体1,298件・関連E2E213件が成功（すべてexit 0、E2E3.8分）。全利用箇所のblocks／unified-ui／annotation-display-size／adversarial-authoring-performance／bolt-diameter／dimension-prefix／free-text-input-drag／multiple-dimensions／slot-dimensionを実行。新規テストはなく、既存Block操作・寸法位置／式入力／Properties／複数選択と周辺操作を確認した。ログはcad-block-dimension-interaction-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自投影／layout・式編集／Selection・scope／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Block Definition更新・read-only寸法・外部拘束のfixtureを既存BlockTestDriver.createDefinitionUpdateFixture／createReadOnlyDimensionFixture／createExternalConstraintFixtureへ分離。呼出し時のDefinition／scope、既存下書き編集／確定・投影・寸法生成／追加・拘束生成／求解・cache更新へ役割別に接続し、固定入力・同一Definition／投影参照・nullと操作／観測順を保持する。元の三つの処理本体との一致を依存port置換後に確認。app.jsは5,890→5,846行（44行減、今回の再開から合計1,888行減）。構文483ファイル・単体1,298件・関連E2E39件が成功（すべてexit 0、E2E32.0秒）。全利用箇所のblocksを実行。新規テストはなく、既存Definition編集／全Instance投影更新・固有寸法・外部拘束によるInstance移動と周辺操作を確認した。ログはcad-block-definition-fixtures-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自下書き／Definition・投影／寸法／求解・cache／保存規則／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sidebar highlight ID／hover Geometry keyの観測を既存PropertiesTestDriver.createHighlightObservation／createHoverKeyObservationへ分離。現在SelectionのGeometry／端点・中心、既存effective拘束／highlight nodes・selectionHighlight・Canvas dimension Hover、全Geometry／Sidebar Hover判定／keyへ役割別に接続する。重複除外・優先順・null除外／sortと照会順を維持し、元の二つの処理本体との一致を確認。app.jsは5,925→5,890行（35行減、今回の再開から合計1,844行減）。構文483ファイル・単体1,298件・関連E2E142件が成功（すべてexit 0、E2E1.9分）。全利用箇所のblocks／unified-uiを実行。新規テストはなく、既存Block／Sidebar／Canvasの選択・拘束highlight／hoverの連携と周辺操作を確認した。ログはcad-sidebar-highlight-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Selection／highlight・所属／編集先・hover規則は追加していない。全体目標は未完了。

### 前回の区切り

Block状態観測と通常／旧versionの保存再読込を既存BlockTestDriver.createStateObservation／createReload／createLegacyReloadへ分離。既存投影bundle・呼出し時のDocument Definition／scope／Selection／mode・serialize／load・UI→drawへ接続し、配列コピー・boolean／fallback・同一参照と照会順を維持する。旧版は保存値のJSON cloneだけをversion 7相当に加工し、製品migrationは持たない。元の三つの処理本体との一致を依存port置換後に確認。app.jsは6,004→5,925行（79行減、今回の再開から合計1,809行減）。構文483ファイル・単体1,298件・関連E2E142件が成功（すべてexit 0、E2E1.9分）。全利用箇所のblocks／unified-uiを実行。新規テストはなく、既存Block状態／通常保存再読込・旧versionの階層／origin／所属・enabled Sketch／rotation lock・投影と周辺操作を確認した。ログはcad-block-reload-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Document／Definition／cache／保存規則／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Block editor状態の観測、配置／nested拘束／子Sketch Geometry追加／取消／確定／enabled Sketch変更、作成拒否fixtureを既存BlockTestDriverへ役割別に分離。既存editor／session chain・scope、配置／拘束生成／求解・cache／履歴・UI／draw、取消／確定・Sketch変更／Selection検査へ委譲し、操作後の現在状態・保存値と拒否理由を観測する。固定入力・同一Instance／投影参照・数値fallback／nullと更新／照会順を保持し、元の八つの処理本体との一致を依存port置換後に確認。app.jsは6,076→6,004行（72行減、今回の再開から合計1,730行減）。構文483ファイル・単体1,298件・関連E2E60件が成功（すべてexit 0、E2E48.1秒）。全利用箇所のblocks／phase0-characterizationを実行。新規テストはなく、既存editor／nested拘束・子Sketch／確定／取消／enabled Sketch・拒否ケースとvisual回帰を確認した。ログはcad-block-editor-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自下書き／Definition／採番・namespace／履歴・拒否規則は追加していない。全体目標は未完了。

### 前回の区切り

Block作成UI／空fixture・回転lock／投影端点／hoverの観測をBlockTestDriver.createCreationFixture／createEmptyFixture／createRotationObservation／createEndpointObservation／createHoverObservationへ分離。既存reset／Geometry・拘束生成／Selection・fit→UI→draw、現在scope／Definition数・Solver変数／drag session・投影／座標変換・Hoverへ役割別に接続し、固定入力・同一Instance参照・null／boolean・変数filter／sortと呼出し順を維持する。元の五つの処理本体との一致を依存port置換後に確認。app.jsは6,127→6,076行（51行減、今回の再開から合計1,658行減）。構文483ファイル・単体1,298件・関連E2E172件が成功（すべてexit 0、E2E2.3分）。全利用箇所のblocks／choice-dialog／fixed-command／phase0-characterization／unified-uiを実行。新規テストはなく、既存作成／空作成・固定／回転lock・投影操作とscript読込を確認した。classic script・構文一覧・E2E読込期待を同期。ログはcad-block-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Definition／採番／下書き・Solver／lock／hoverルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

親子／SiblingのPoint-Line参照fixture・Sibling参照元移動・参照状態の観測を既存ConstraintTestDriver.createParentPointLineFixture／createSiblingPointLineFixture／createSiblingReferenceMove／createPointLineObservationへ分離。既存reset／Geometry・所属／active切替・fit／UI／draw／client変換、依存求解／解析・cycle判定・signed distance／Sketch照会へ役割別に接続する。固定入力・同一参照・対象なしnullと更新／照会順を維持し、元の四つの処理本体との一致を依存port置換後に確認。app.jsは6,198→6,127行（71行減、今回の再開から合計1,607行減）。構文482ファイル・単体1,298件・関連E2E103件が成功（すべてexit 0、E2E1.4分）。全利用箇所のunified-uiを実行。新規テストはなく、既存親子／Sibling参照・参照元移動と逆参照cycle判定・周辺操作を確認した。ログはcad-point-line-reference-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自点線関係／参照・cycle規則／求解／scope／履歴は追加していない。全体目標は未完了。

### 前回の区切り

循環参照の読込fixtureを既存DocumentTestDriver.createCyclicReferenceFixtureへ、拘束寸法Selectionのfixture／観測と支持状態fixtureを既存ConstraintTestDriver.createDimensionSelectionFixture／createDimensionSelectionObservation／createSupportStatusFixtureへ分離。既存生成／参照mark・serialize／load・解析／UI、Selection／command・fit／draw・求解／status／色へ役割別に接続し、reference error／summaryは明示した既存照会入口を使う。固定入力・同一参照・更新／照会順とbooleanを維持し、元の四つの処理本体との一致を依存port置換後に確認。app.jsは6,256→6,198行（58行減、今回の再開から合計1,536行減）。構文482ファイル・単体1,298件・関連E2E124件が成功（すべてexit 0、unified-ui103件1.4分、phase0-characterization21件15.7秒）。全利用箇所の二ファイルを実行。新規テストはなく、既存cycle読込・寸法Selection解除／command・支持status／色とvisual回帰を確認した。ログはcad-reference-selection-fixtures-{check,unit,e2e,phase0}.log。全E2Eはこの単位では未実行。独自cycle判定／参照・Selection／command／拘束状態／求解／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sibling subtreeの参照fixture／可視性観測を既存SketchTreeTestDriver.createSubtreeReferenceFixture／createSubtreeVisibilityObservationへ、参照元Line移動／依存求解順fixtureを既存ConstraintTestDriver.createReferenceLineMove／createDependencyOrderFixtureへ分離。既存Sketch／Geometry生成・参照有効性・関係label／色／可視性／DOM、参照拘束・依存求解／解析・UI／drawへ役割別に接続する。固定入力・同一参照・所属／active切替と更新／照会順を保持し、元の四つの処理本体との一致を依存port置換後に確認。app.jsは6,352→6,256行（96行減、今回の再開から合計1,478行減）。構文482ファイル・単体1,298件・関連E2E103件が成功（すべてexit 0、E2E1.4分）。全利用箇所のunified-uiを実行。新規テストはなく、既存subtree参照／可視性・参照元の移動／依存求解順と周辺操作を確認した。ログはcad-subtree-reference-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自参照規則／求解順・namespace／scope／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Geometry stroke styleのケースをPropertiesTestDriver.createStrokeStyleCasesへ、construction hover fixture／線描画観測をCanvasRenderTestDriver.createConstructionHoverFixture／createConstructionLineObservationへ分離。既存生成／scope・Definition追加・Hover／drawLines／外観へ接続し、固定入力・同一参照・描画／照会順・null／丸めとCanvas methodのtry／finally復元、元arcへのctxを保った転送を維持する。元の三つの処理本体との一致を依存port置換後に確認。app.jsは6,465→6,352行（113行減、今回の再開から合計1,382行減）。構文482ファイル・単体1,298件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。単体1件で描画／外観例外時のCanvas復元・対象なしnull・arc転送のcontext／引数と表示結果を確認した。新規unit追加でWindowsシェルの起動長制限に当たり全unit起動がexit 1となったため、既存206ファイルの順序と追加1ファイルの明示一覧をtools/run-unit-tests.jsへ保持し、Nodeを直接spawnする起動へ変更して全unitを再実行・成功確認。npm run test:unitの入口は維持する。ログはcad-geometry-stroke-observation-{check,unit,unit-final,e2e}.log。全E2Eはこの単位では未実行。独自線幅／外観・hover／renderer／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sibling可視性fixture・inactive寸法／Block hover fixture・hover identity観測を既存SketchTreeTestDriver.createSiblingVisibilityFixture／createInactiveHoverFixture／createIdentityObservationへ分離。Geometry／寸法／Sketch／Block準備は既存生成・編集へ、Definition追加／採番はapp callbackへ、client位置はCanvasTestDriverへ接続する。固定入力・同一参照・所属／active切替とcache→fit→viewport移動→UI→draw→layout／位置照会、表示／identityのfallbackとnullを保持する。元の三つの処理本体との一致を依存port置換後に確認。app.jsは6,543→6,465行（78行減、今回の再開から合計1,269行減）。構文480ファイル・単体1,297件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存Sibling表示・inactive Geometry／寸法／Blockのidentityと編集先を変えない選択、周辺可視性を確認した。ログはcad-inactive-sketch-hover-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自可視性／編集先・hoverルール／scope／採番／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sketch削除のfixtureと既存削除への実行入口をDocumentTestDriver.createSketchDeletionFixtureへ分離。固定の親子／兄弟Sketch・Geometry／参照付き注記の準備を既存reset／生成へ、削除を既存deleteSketchへ委譲し、現在scopeのSketch ID／active・Geometry／注記数を観測する。固定入力・色・同一Geometry参照・active切替・確認なしの削除引数と照会順を保持し、元の二つの処理本体との一致を依存port置換後に確認。app.jsは6,568→6,543行（25行減、今回の再開から合計1,191行減）。構文480ファイル・単体1,297件・関連E2E124件が成功（すべてexit 0、E2E1.5分）。全利用箇所のphase0-characterization／unified-uiを実行。新規テストはなく、既存子孫cleanup／Geometry・拘束／注記削除とUndo・周辺UIを確認した。ログはcad-sketch-deletion-fixture-{check,unit,e2e}.log。全E2Eはこの単位では未実行。削除／cleanup／namespace／履歴の製品処理は変更していない。全体目標は未完了。

### 前回の区切り

Offset chainのUI準備／状態観測／保存再読込／target編集／再選択を既存OffsetTestDriver.createChainFixture／createChainObservation／createChainReload／createChainTargetEdit／createChainReselectionへ役割別に分離。既存Geometry生成・fit／履歴・Selection／pending・保存／読込・precondition／計測へ接続し、固定入力・同一参照・null／空配列fallbackと元の更新／照会順を保持する。元の五つの処理本体との一致をscope port置換後に確認。app.jsは6,648→6,568行（80行減、今回の再開から合計1,166行減）。構文480ファイル・単体1,297件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存chain選択／target更新／join・結果再選択／保存再読込を確認した。ログはcad-offset-chain-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自chainモデル・Selection／pending・拘束更新／保存互換性／履歴は追加していない。全体目標は未完了。

### 前回の区切り

単独Offsetの生成／保存再読込・UI／方向fixtureと状態観測をOffsetTestDriver.createPrimitiveFixture／createUiFixture／createUiObservation／createDirectionFixtureへ分離。固定Point表示は既存CanvasTestDriver.createFixedPointFixtureへ接続し、公開hookの座標変換参照を既存clientPositionへ置換する。固定入力・同一Geometry／拘束参照、target／expression更新→求解→計測→保存／reload→現在scope照会、UI／方向とPoint表示の呼出し順を保持する。元の五つの処理本体との一致を依存port置換後に確認。app.jsは6,743→6,648行（95行減、今回の再開から合計1,086行減）。構文480ファイル・単体1,297件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存固定Pointの表示・Offset生成／UI／方向／保存再読込とscript読込を確認した。classic script・構文一覧・E2E読込期待を同期。ログはcad-offset-primitive-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Offset計算／拘束・scope／入力状態／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sidebar inspectionを既存PropertiesTestDriver.createInspectionFixtureへ、Root／Block hoverをSketchTreeTestDriver.createRootHoverFixture／createBlockHoverFixtureへ分離。固定Geometry／reference・read-only拘束とSketch／Blockを既存生成・編集へ委譲し、UI→fit→draw→位置／ID観測の順を保持する。Definition追加とInstance採番はappのcallbackに留め、Block位置は既存CanvasTestDriverのclient変換へ接続する。固定入力・同一参照・所属／active切替・cache無効化と各照会順を維持し、元の三つの処理本体との一致を依存port置換後に確認。app.jsは6,865→6,743行（122行減、今回の再開から合計991行減）。構文479ファイル・単体1,297件・関連E2E125件が成功（すべてexit 0、E2E1.7分）。全利用箇所のsketch-tree-visibility／unified-uiを実行。新規テストはなく、既存inspection／Root・子孫Sketch・Block hover／explicit Point表示と周辺可視性・script読込を確認した。classic script・構文一覧・E2E読込期待を同期。ログはcad-sidebar-tree-fixtures-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自scope／採番／定義・Selection／hoverルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Canvas dash isolationの支援をCanvasRenderTestDriverの作図preview準備／Block準備／観測手順の三つに分離。既存command／preview・生成型／Definition追加／scopeとappのmode入口へ役割別に接続し、reset→viewport→preview／Selection reset→mode→setup→dash設定→draw→dash照会と12case順を保持する。組み直した処理が元のcase順／本体と一致することを依存port置換後に確認。app.jsは6,956→6,865行（91行減、今回の再開から合計869行減）。構文478ファイル・単体1,297件・関連E2E103件が成功（すべてexit 0、最終E2E1.5分）。初回E2Eは102件成功／dash1件失敗で、drawSelectionRectの依存受渡し忘れによる未定義参照を修正し、同じunified-ui全体を再実行して成功を確認した。新規テストはなく、既存12種のdash分離とscript読込を確認。classic script・構文一覧・E2E読込期待を同期。ログはcad-canvas-dash-driver-{check,unit,e2e,e2e-final}.log。全E2Eはこの単位では未実行。独自mode／command状態・Block定義／seq・renderer／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sketch寸法の可視性fixtureを既存DimensionTestDriver.createSketchVisibilityFixtureへ分離。二つのSketchの固定寸法準備は既存reset／Geometry・寸法生成へ、active Sketch切替と復元・可視性／描画は既存所有者へ接続する。非表示→label観測→再表示とfilter／返却値の順を維持し、fillText差替えは各描画のtry／finallyで元のmethodへ復元する。元の処理本体との一致を依存port置換後に確認。app.jsは7,002→6,956行（46行減、今回の再開から合計778行減）。構文477ファイル・単体1,297件・関連E2E116件が成功（すべてexit 0、E2E1.6分）。全利用箇所のview-visibility／multiple-dimensions／unified-uiを実行。単体1件を追加し、成功と一回目／二回目の描画例外でCanvas methodの復元と既存復元範囲を確認した。ログはcad-sketch-dimension-visibility-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Sketch／寸法モデル・可視性／描画ルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Canvas fitの全図形fixture／中ボタンfixture・表示範囲観測・fit実行を既存CanvasTestDriver.createAllGeometryFitFixture／createMiddleButtonFitFixture／createFitObservation／createFitOperationへ分離。固定Geometry／Sketch準備は既存reset／生成と現在scopeへ、viewport・fit／可視性／座標変換は既存所有者へ委譲する。固定座標・所属／active Sketch切替と復元、viewport更新順、paddingの数値化／fallback、fit→drawと各照会順を保持し、元の四つの処理本体との一致を依存port置換後に確認。app.jsは7,050→7,002行（48行減、今回の再開から合計732行減）。構文477ファイル・単体1,296件・関連E2E139件が成功（すべてexit 0、E2E1.8分）。全利用箇所のannotation-display-size／canvas-zoom-input／hatching／sketch-permissions／unified-uiを実行。新規テストはなく、既存の全図形fit／中ボタン／visible bounds・倍率・領域／権限と周辺操作を確認した。ログはcad-canvas-fit-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自scope／viewport／fit・可視性ルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Trimの拘束移送・construction境界・直径寸法移送のfixtureをTrimTestDriver.createLineTransferFixture／createConstructionBoundaryFixture／createDiameterTransferFixtureへ分離。固定Geometry／拘束準備は既存reset／生成へ、境界・preview／Trim・拘束移送は既存query／editingへ役割別に委譲する。固定入力とboundaryCountの数値化／下限、呼出し順・同一Geometry／拘束参照・fallbackと返却値を保持する。元の三つの処理本体との一致をscope port置換後に確認。app.jsは7,144→7,050行（94行減、今回の再開から合計684行減）。構文477ファイル・単体1,296件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存の線拘束移送／construction除外／円の直径寸法保持とscript読込を確認した。classic script・構文一覧・E2E読込期待を同期。ログはcad-trim-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自交点／区間計算・拘束移送・モデル／履歴は追加していない。全体目標は未完了。

### 前回の区切り

角度寸法ラベルの追従ケースを既存DimensionTestDriver.createAngleLabelFixtureへ分離。固定Geometryの準備・平行移動／半径変更／8回のlabelドラッグ手順と誤差観測を担当し、既存layout／basis／offset更新／labelからの配置／寸法保存値へ委譲する。旧label座標と破損relative offsetの固定入力、参照を更新するlayoutの呼出し順、保持offset・半径方向の誤差と保存version／legacy座標有無を維持する。元の処理本体との一致を確認。app.jsは7,241→7,144行（97行減、今回の再開から合計590行減）。構文476ファイル・単体1,296件・関連E2E103件が成功（すべてexit 0、E2E1.4分）。全利用箇所のunified-uiを実行。新規テストはなく、既存の角度ラベル追従・旧座標変換・繰り返し配置・保存値と周辺寸法操作を確認した。ログはcad-angle-label-fixture-{check,unit,e2e}.log。全E2Eはこの単位では未実行。製品の角度計算／寸法状態・保存形式／履歴は変更していない。全体目標は未完了。

### 前回の区切り

寸法の引出線表示fixture・表示精度・文字角度のケースを既存DimensionTestDriver.createExtensionVisibilityFixture／createDisplayCases／createTextAngleCasesへ分離。固定矩形の準備は既存reset／Geometry生成へ、表示は既存layout／formatter／JIS角度・offsetへ委譲する。固定入力・計算順とshowExtensionのfalse判定を保持し、Geometry準備のない二つのケースへreset／モデル依存を渡さない。元の三つの処理本体との一致を確認。app.jsは7,313→7,241行（72行減、今回の再開から合計493行減）。構文476ファイル・単体1,296件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存の表示precision・JIS文字角度・Point間／線長の引出線previewと周辺の寸法編集／保存を確認した。ログはcad-dimension-display-cases-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自寸法計算／表示ルール／モデル／履歴は追加していない。全体目標は未完了。

### 前回の区切り

読み取り専用寸法の重複fixture／配置fixtureを既存DimensionTestDriver.createReadOnlyDuplicateFixture／createReadOnlyPlacementFixtureへ分離。既存reset・Geometry／寸法生成・layout／label／保存値へ委譲し、重複寸法数と引出線整列誤差を観測する。配置はconstraintTargetSession→pendingCommandSession→寸法入力開始の順と現在scopeの寸法／入力状態照会を維持する。固定座標・同一target参照・所属Sketch・filter／fallbackと照会順を保持し、元の二つの処理本体との一致をscope port置換後に確認。app.jsは7,354→7,313行（41行減、今回の再開から合計421行減）。構文476ファイル・単体1,296件・関連E2E219件が成功（すべてexit 0、E2E3.4分）。全利用箇所のannotation-display-size／annotation-anchors／leader-appearance／sketch-tree-visibility／unified-annotations／unified-uiを実行。新規テストはなく、既存の重複／read-only・入力・寸法表示／注記・履歴／保存を確認した。ログはcad-readonly-dimension-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自寸法計算／session／入力状態／履歴は追加していない。全体目標は未完了。

### 前回の区切り

注記の寸法・外観・所属／投影の観測を既存AnnotationTestDriver.createDimensionObservation／createAppearanceObservation／createOwnershipObservationへ分離。既存寸法表示・AnnotationRenderer／Appearance・Document／Selectionへ役割別に接続し、layout・保存値・表示metrics・client位置を観測する。外観だけが既存の対象探索→倍率更新→対象なしnull→style→draw→表示／保存照会を持ち、他の観測へ倍率更新／drawを渡さない。コピー／参照・継承rotation・投影のfallbackと照会順を保持し、元の三つの処理本体との一致を依存port置換後に確認。app.jsは7,400→7,354行（46行減、今回の再開から合計380行減）。構文476ファイル・単体1,296件・関連E2E208件が成功（すべてexit 0、E2E3.3分）。全利用箇所のannotation-anchors／annotation-display-size／free-text-input-drag／leader-appearance／unified-annotations／unified-uiを実行。新規テストはなく、既存の注記寸法・倍率・Parameter／外観・Block所属／投影・保存／再読込を確認した。ログはcad-annotation-state-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。注記の製品状態／保存形式／表示ルールは変更していない。全体目標は未完了。

### 前回の区切り

注記のドラッグfixture・snapshot・hit観測をAnnotationTestDriver.createDragFixture／createSnapshot／createHitObservationへ分離。既存reset／Geometry・注記追加／Leader参照／表示Geometry／座標変換／hitへ役割別に接続し、準備後のsnapshot入口を明示する。固定座標／文字列／styleコピー、最後のLeader／Text優先、world／display／viewport座標とコピー・null・照会順を保持する。元の三つの処理本体との一致を依存port置換後に確認。app.jsは7,445→7,400行（45行減、今回の再開から合計334行減）。構文476ファイル・単体1,296件・関連E2E203件が成功（すべてexit 0、E2E3.1分）。全利用箇所のannotation-anchors／leader-appearance／phase0-characterization／png-export／unified-uiを実行。新規テストはなく、既存の注記drag／hit／ハンドル／Undo・外観・PNGとfile URL読込期待で確認した。classic scriptと構文一覧・E2E読込期待を同期。ログはcad-annotation-drag-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自注記モデル／表示・hitルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

拘束診断とBlock投影支援を既存ConstraintTestDriverのcreateStatusObservation／createAnalysisObservation／createBlockObservation／createBlockConstraintInsertionへ分離。既存refresh・Solver解析・scope／投影／commitへ役割別の依存を渡し、所属Sketch・同一参照status照会、誤差閾値／降順／上位12件、summaryコピー、対象なしの理由とliteral true判定、解析→Block状態→保存値の観測順を保持する。Geometryドラッグにも同じstatus観測を渡し、公開hook同士のthis依存を解消。元の四つの処理本体との一致を依存port置換後に確認。app.jsは7,507→7,445行（62行減、今回の再開から合計289行減）。構文475ファイル・単体1,296件・関連E2E239件が成功（すべてexit 0、E2E5.0分）。診断・Block支援の利用9ファイルとunified-uiの計10ファイルを実行し、単体3件でcall-time scope・誤差順位／件数・投影参照・summaryコピーと拒否後の観測順を確認した。ログはcad-constraint-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Solver／拘束状態／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Geometryドラッグのテスト手順と観測を既存GeometryDragTestDriver.createGeometryDriverへ分離。Point／Line／Circle／Arc／Arc端点の開始位置とsnapshot、fractionのfinite判定／clamp、sessionなしの初期状態・対象なしのnull、初期位置基準・計測・結果fallbackと既存sessionの実行順を保持する。拘束状態はapp内の従来本体をreadTestConstraintStatusesとして共有し、inspectConstraints時だけ明示した入口で照会する。元のGeometryドラッグ／拘束状態本体との一致を依存port置換後に確認。app.jsは7,615→7,507行（108行減、今回の再開から合計227行減）。構文475ファイル・単体1,293件・関連E2E162件が成功（すべてexit 0、E2E20.6分）。全利用箇所のadversarial-drag-fixture／blocks／constraint-drag-regressions／geometry-drag-smoothness／unified-uiを同じ実行で正常終了まで追跡し、単体2件で同一Line／Arc端点wrapper・fraction・初期位置基準・snapshot／計測・拘束観測とsessionなしの早期終了を確認した。ログはcad-geometry-drag-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Solver／ドラッグ状態／拘束状態／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Pointドラッグの単発／連続テスト手順と結果観測をGeometryDragTestDriver.createPointDriverへ分離。現在scopeの同一Pointと既存session生成・local solve context・preview更新・最終求解・円弧正規化・所属Sketchの拘束誤差へ明示的に接続し、初期位置からの移動量、preview座標のコピー、計測・失敗結果／例外・対象なしのnullと実行順を保持する。元の二つの処理本体との一致を依存port置換後に確認。app.jsは7,694→7,615行（79行減、今回の再開から合計119行減）。構文475ファイル・単体1,291件・関連E2E149件が成功（すべてexit 0、E2E3.0分）。全利用箇所のblocks／drag-smoothness／unified-uiを実行し、単体3件でsession同一性・call-time scope・preview／final分離・計測・移動基準と早期終了を確認した。classic script読込／構文一覧・単体一覧・file URL読込期待も同期。ログはcad-point-drag-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。製品のSolver／ドラッグ状態／履歴は変更していない。全体目標は未完了。

### 前回の区切り

選択可能な線のclient位置照会を既存CanvasTestDriver.createSelectableLinePositionへ分離。現在scopeの線配列順と0.37／0.63／0.5位置、Point→同一参照Line→寸法のhit短絡、Canvas矩形の包含と画面の重なり判定を保持し、候補なしはnullを返す。元の処理本体との一致を依存port置換後に確認。app.jsは7,709→7,694行（15行減、今回の再開から合計40行減）。構文473ファイル・単体1,288件・関連E2E14件が成功（すべてexit 0、E2E1.8分）。既存利用箇所のadversarial-authoring-performance／adversarial-drag-fixtureを実行し、単体1件でcall-time scope／Canvas矩形・競合hitの同一参照／短絡・画面外／UI重なり／境界包含を確認した。ログはcad-selectable-position-{check,unit,e2e}.log。全E2Eはこの単位では未実行。選択／hitルールや独自モデルは追加していない。全体目標は未完了。

### 前回の区切り

作図状態とsnapラベルのテスト観測を既存CanvasTestDriver.createAuthoringObservation／createSnapObservationへ分離。現在のscope・mode・各session・計測・Selectionを既存所有者から照会し、距離10 CSS pxの境界、候補順・入力数値化、座標／計測値のコピー、preview／選択の参照、serialize→decorateとnull fallbackを保持する。元の二つの処理本体との一致を依存port置換後に確認。app.jsは7,734→7,709行（25行減）。構文473ファイル・単体1,287件・関連E2E211件が成功（すべてexit 0、E2E3.3分）。既存利用箇所の5ファイルを確認し、単体2件を追加して呼出し時のscope／zoomと参照・コピー境界を検証した。ログはcad-authoring-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自モデル／session／snapルールは追加していない。全体目標は未完了。

### 前回の停止地点（2026-10-12）

週枠残量69%を確認したため新規分離を停止。今回の76個の区切りのcommitを保持し、最終コード8e6fc2aをdevelopのcab7c6dへ統合・Pushした。app.jsは11,058→7,630行（合計3,428行減）。構文469ファイル・単体1,261件・全E2E560件が最新統合コードで成功（exit 0、全E2E24.8分）。ログはcad-refactor-oct12-final-{check,unit,e2e}.log。全テスト本体とworker終了後、実体を確認した専用サーバーの終了待ちを解消して同じ実行の正常終了を回収した。この停止記録をCommit／Pushした後、mainを最後に反映してdevelopとローカル・リモートを同期し、統合済み作業branchを削除・runtime再生成して一時停止する。全体目標は未完了。再開手順と次の責務候補はrefactoring-policy-and-resume.md section 8を参照する。

### 最後の分離単位

Hover表示の観測を既存PropertiesTestDriver.createHoverObservationへ分離。既存Geometry一覧／Block投影・外観・Tree強調／Sidebar／Canvas／Block Hoverと表示色／線幅へ接続し、対象なしのnull、検索・Block内Geometryの優先順／短絡、Pointの投影・線端点除外、同一参照照合・constructionと照会順を保持する。独自Geometry／Hover／表示ルールを追加せず、test query時だけ生成して既存API名へ接続。元の処理本体との一致を確認。app.jsは7,652→7,630行（22行減、今回の合計3,428行減）。構文469ファイル・単体1,261件・関連E2E103件成功（exit 0、2.0分）。新規テストはなく、全利用箇所のunified-ui既存E2EでTree／Canvas強調、Point／Block、色／線幅を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-hover-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

hit観測とGeometryのclient位置取得を既存CanvasTestDriver.createHitObservation／createGeometryPositionへ分離。hit側は入力座標を元どおり数値正規化し、Arc端点→Point／Line／Circle／Arc／Splineの既存query結果をID／端点／nullへ変換する。位置側は現在scopeのGeometryからPoint位置・線中点・円右端・円弧の指定端点または従来の角度平均・Splineの0／1／0.5評価位置を取得し、既存client変換へ渡す。Spline evaluateを明示した依存へ、thisによるclient hook参照を既存CanvasTestDriver.clientPositionへ置換する。detail既定値／未存在Geometryのnull・式／順序を維持し、hitルール／幾何計算／scope／viewportを複製しない。test query時だけ生成し、既存API名へ接続。元の二つの処理本体との一致を確認。app.jsは7,683→7,652行（31行減、今回の合計3,406行減）。構文469ファイル・単体1,261件・関連E2E144件成功（exit 0、3.1分）。新規テストはなく、全利用箇所のadversarial-authoring-performance／head-symmetry／phase0-characterization／spline／unified-ui既存E2Eで応答性・円弧／Spline操作・hit観測を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-hit-position-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch移動と表示倍率のテスト観測を既存CanvasSelectionTestDriver.createMoveObservation／CanvasTestDriver.createZoomObservationへ分離。移動の観測は既存command／fields・現在Selection／scopeと拘束serialize／保存値／Block編集状態を照会し、開始中target／所属／描画順を返す。倍率の支援は指定時だけ既存clampでviewportを更新し、現在Document unitsの複製と倍率／format表示を返す。null既定値・数値変換・式・照会順を保持し、移動session／Selection／viewportを別に保持しない。移動側にviewport依存、倍率側にGeometry／Selection／履歴依存を持ち込まず、test query時だけ生成して既存API名へ接続。元の二つの処理本体との一致を確認。app.jsは7,696→7,683行（13行減、今回の合計3,375行減）。構文469ファイル・単体1,261件・関連E2E141件成功（exit 0、2.6分）。新規テストはなく、全利用箇所のsketch-move／canvas-zoom-input／annotation-display-size／phase0-characterization／unified-ui既存E2Eで移動の開始／確定／取消・倍率表示・注記サイズ／保存を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-move-zoom-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Geometry IDのテスト用選択を既存CanvasSelectionTestDriver.createIdSelectionへ分離。現在scopeの九種別の同一Geometry参照を既存Selectionへ設定し、clear→種別順の設定→UI→draw→Block選択query→選択ID照会を保持する。入力既定値、scope配列順、重複IDの扱いとBlockエラー／内部・外部拘束数のfallbackを維持し、独自scope／Selection／選択ルールを追加しない。this経由のhook参照はreadSelectedGeometryへ置換し、test query時だけ生成して既存API名へ接続。元の処理本体との一致を確認。app.jsは7,717→7,696行（21行減、今回の合計3,362行減）。構文469ファイル・単体1,261件・関連E2E263件成功（exit 0、4.1分）。新規テストはなく、全利用箇所14ファイルの既存E2Eで選択を使う編集／Block／投影／外観／表示／Undoを確認。最初のE2EはWindowsパスを検索正規表現として渡したため対象を収集できずexit 1。区切りをスラッシュへ修正し、同じ対象で正常終了を確認した。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-id-selection-{check,unit,e2e,e2e-final}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

拘束入力の状態照会とIntent解決の二つのAPIを既存ConstraintTestDriver.createInputObservation／createIntentResolutionへ分離。前者は現在Selection／ConstraintTargetSession・operandElementとreadSelectedGeometryへ接続し、Instance／arcEndpoint／pair・operand／pending typeを観測する。後者は現在scopeの入力IDを同一Geometryへ結び付け、既存makeConstraintOperand／resolver／serializeConstraintへ委譲。arc-endpointのarc keyとendpoint／parameter、未存在IDの例外、resolutionなしのnullと結果fallbackを維持する。観測にモデル検索／resolver、Intent支援にSelection／session操作を持ち込まず、既存の拘束判断・操作状態を複製しない。test query時だけ生成し、既存API名へ接続。元の二つの処理本体との一致を確認。app.jsは7,738→7,717行（21行減、今回の合計3,341行減）。構文469ファイル・単体1,261件・関連E2E124件成功（exit 0、2.1分）。単体1件を追加し、call-time Geometry同一参照・端点情報、未存在入力のresolver短絡とnull／serialization境界を確認。全利用箇所のphase0-characterization／unified-ui既存E2EでIntentの入力状態非変更・拘束入力と表示回帰を検証。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-constraint-input-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasメニューの重なり選択fixture／円弧端点fixture・状態観測・固定点追加の四つのAPIをCanvasSelectionTestDriverへ分離。createOverlapFixtureは同座標の二線／非表示・inactive線／Block内線を準備し、Definition追加／Instance採番は既存所有者callbackへ委譲する。createEndpointFixtureは線と二円弧の端点選択用Geometryを準備する。固定ID／座標／Sketch切替・Selection、cache無効化・fit→履歴→UI→draw→client照会の順序を維持。createObservationは既存controllerの候補と表示query・現在Hover／Selectionを観測し、Hover優先順／id・parameterName fallback／arcEndpointを保持する。createPointInsertionは現在Canvas矩形／viewportから固定explicit Pointを追加し、UI→draw後のclientを返す。this経由のhook参照を既存CanvasTestDriver.clientPosition／readSelectedGeometryへ置換。観測・Point追加にBlock生成／採番依存を持ち込まず、候補・hit・選択ルールや独自状態を追加しない。test query時だけ生成し、既存API名へ接続。元の四つの処理本体との一致を確認。classic script／構文／E2E読込一覧を同期。app.jsは7,815→7,738行（77行減、今回の合計3,320行減）。構文469ファイル・単体1,260件・関連E2E103件成功（exit 0、2.0分）。新規テストはなく、全利用箇所のunified-ui既存E2Eで候補表示／Hover／選択、固定点除外、円弧端点拘束入力を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-canvas-selection-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Documentのファイル名fixture読込とドラッグ検証用の直接適用をDocumentTestDriver.createImport／createLoadへ分離。importはJSON→File→既存importFileDataをawaitし、完了後のDocument／表示／保存名・titleと経過時間を照会する。直接適用は入力clone→file名overrideで既存load→任意の履歴reset→UI→draw→現在scopeの拘束数を取得。拒否false、async例外伝播、直接適用のload／history／UI／drawを含むcatch範囲と既定値を保持し、形式変換／モデル置換／復元は既存所有者へ委譲する。test query時だけ生成し、既存二つのAPI名へ直接接続。元の二つの処理本体との一致を確認。classic script／構文／unit／E2E読込一覧を同期。app.jsは7,833→7,815行（18行減、今回の合計3,243行減）。構文468ファイル・単体1,260件・全E2E560件成功（exit 0、24.8分）。単体4件を追加してawait後の名前／時間・拒否／例外、cloneと適用後scope、履歴／表示更新を含む失敗境界を確認した。直接適用APIが多数の画面テストで使用されるため全E2Eを一括実行し、前回失敗したDXF保存再読込を含め全件成功。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-document-test-driver-{check,unit,full-e2e}.log。全体目標は未完了。

### 前回の区切り

外観の照会、複数選択Propertiesのfixture／状態照会、固定のfixture／状態照会の五つのAPIをPropertiesTestDriverへ分離。createAppearanceObservationは既存Geometry／Block投影・外観／可視性を使い、種別別検索・Block内Geometry優先順と対象なしのnullを保持する。createFixtureは既存reset／図形生成／Selectionへ委譲し、座標／直接外観・mixedTypesの円、固定用S2／Point・Lineと履歴→UI→drawを維持する。createPropertiesObservation／createFixedObservationは現在Selection／scopeを照会し、既存外観／固定判定・DOM／ボタン／readHistoryへ接続。this経由の履歴hook参照をreadHistoryへ置換し、fixtureの図形生成を観測に持ち込まない。独自モデル／選択状態／外観継承／固定ルールを追加しない。test query時だけ生成し、既存五つのAPI名へ直接接続。明示した所有者参照への置換を除き、元の処理本体との一致を確認。classic script／構文／E2E読込一覧を同期。app.jsは7,886→7,833行（53行減、今回の合計3,225行減）。構文466ファイル・単体1,256件・関連E2E121件成功（exit 0、2.1分）。新規テストはなく、全利用箇所のunified-ui／sketch-projection／view-visibility既存E2Eで複数Properties／固定・解除／Undo、投影外観、表示・非表示を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-properties-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Parameterの準備／フィードバックfixture、状態照会、Block化／寸法名指定削除の五つのAPIをParameterTestDriver.createFixture／createObservation／createInteractionへ分離。fixtureは既存reset／Geometry生成／拘束登録・名前空間補完／安定化へ委譲し、定義追加／Instance採番は既存所有者へのcallbackとする。固定ID／座標／式、参照寸法フラグ、cache無効化→安定化→履歴→UI→drawを保持する。観測は現在scope／Documentを照会し、既存validateの後にParameter値・寸法／Block名前空間・投影長・保存値を返す。操作は既存Selection／Block Selection／定義作成／削除に委譲し、対象なし・拒否と操作後の名前一覧／hintを維持する。観測／操作へGeometry生成／採番／Solver依存を持ち込まず、独自モデル／評価／採番／cacheを追加しない。test query時だけ生成し、既存API名へ直接接続。明示した所有者参照への置換を除き、元の五つの処理本体との一致を確認。classic script／構文／E2E読込一覧を同期。app.jsは8,000→7,886行（114行減、今回の合計3,172行減）。構文465ファイル・単体1,256件・関連E2E114件成功（exit 0、2.1分）。追加テストはなく、五つのAPIの全利用箇所のunified-ui／free-text-input-drag既存E2EでParameter更新・参照寸法削除保護／Block式凍結／フィードバック・注記反映を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-parameter-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法色の観測を既存DimensionTestDriver.createColorObservationへ分離。四つの依存（Selection／Hover／ctx／既存drawDimensions）で、呼出し時の寸法選択・拘束選択・寸法Hoverとstroke参照を保存し、一時解除／差替え→描画→finally復元を所有する。strokeは元ctxと引数で転送し、色の小文字化・初出順の重複排除、同一選択参照、他のHover状態、描画例外の伝播を保持する。通常CanvasRenderProbeへSelection操作を混ぜず、製品描画・独自状態を追加しない。test query時だけ生成し、既存API名へ直接接続。元の処理本体との一致を確認。app.jsは8,021→8,000行（21行減、今回の合計3,058行減）。構文464ファイル・単体1,256件・関連E2E103件成功（exit 0、2.1分）。単体1件を追加し、成功／描画失敗の双方でのcall-time選択／Hover／stroke同一参照の復元、呼出し転送、色の重複排除を確認。全利用箇所のunified-ui既存E2Eも検証。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-dimension-color-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

円弧半径の描画plan、終端記号のfit、矢印先端の観測を既存DimensionTestDriver.createRadiusFixture／createTerminatorFixtureへ分離。円弧fixtureだけがPoint／Arc生成とDimensionPlacementを使い、終端fixtureはDimensionLayout／DimensionMetricsと一時倍率操作へ接続する。両者は呼出し時の既定外観をreaderで照会し、固定ID／座標／半径・入力既定値／数値正規化・演算式／結果形式を維持する。テスト用Geometryはモデル／採番へ登録せず、製品描画の実装・独自viewportを追加しない。矢印は呼出し時の倍率を保存し、成功／例外ともfinallyで復元する。test query時だけappが生成し、既存三つのAPI名へ接続。明示した所有者参照への置換を除き、元の三つの処理本体との一致を確認。app.jsは8,110→8,021行（89行減、今回の合計3,037行減）。構文464ファイル・単体1,255件・関連E2E103件成功（exit 0、1.9分）。単体1件を追加して外観／線幅／矢印点／join計算での例外伝播と呼出し前倍率への復元を確認し、unit／構文一覧を同期した。全利用箇所のunified-ui既存E2Eで円弧補助線／終端配置／矢印先端の実描画計算を検証。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-dimension-render-fixture-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法Appearanceの状態照会と描画寸法の観測をDimensionTestDriver.createAppearanceObservation／createRenderObservationへ分離。状態照会は現在scope／Documentと既存Appearance照会へ、描画観測は既存DimensionPlacement／DimensionLayout／DimensionMetrics・viewport／表示倍率へ接続する。対象なし・angle時のnull、既定寸法の生成条件、clone、Block内のSketch参照、数値式と呼出し順を維持し、独自モデル／描画計算を追加しない。test query時だけ生成し、既存二つのAPI名へ直接接続する。明示した所有者参照への置換を除き、元の二つの処理本体との一致を確認。classic script／構文／E2E読込一覧と責務配置を更新。app.jsは8,155→8,110行（45行減、今回の合計2,948行減）。構文463ファイル・単体1,254件・関連E2E127件成功（exit 0、3.0分）。単体の追加はせず、全利用箇所のannotation-display-size／leader-appearance／unified-ui既存E2Eで外観継承・表示寸法・保存再読込を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-dimension-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Reference Imageの状態照会／data URL読込／Block下書き準備・確定の四つのAPIをReferenceImageTestDriver.createObservation／createImport／createBlockFixtureへ分離。観測・native読込・fixture生成の依存を分け、現在scope／Block編集状態・既存画像operation／Selection／履歴／viewportへ接続する。観測の選択ID→scope／下書き画像serialize→calibration／drag→履歴→viewport、読込のfetch→Blob→File→既存importとawait／既定値／例外、preserveDocument指定と固定Point／Line ID・座標・所属Sketch、確定後の保存値cloneを保持する。this経由の履歴hook参照をreadHistoryへ置換し、独自モデル／operation／viewport／seq／cacheを持たない。元の四つの本体との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,176→8,155行（21行減、今回の合計2,903行減）。構文462ファイル・単体1,254件・関連E2E167件成功（exit 0、3.5分）。新しい単体テストは追加せず、全利用箇所のreference-images／dxf-import／png-export／sketch-moveとunified-ui／blocksの既存E2Eで実利用を検証。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-reference-image-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionの資格fixtureを既存SketchProjectionTestDriver.createEligibilityFixtureへ、投影targetのコピー／貼付け・Block化の観測をcreateTransferへ分離。資格fixtureは現在scope・Geometry生成と既存資格判定へ委譲し、固定ID／座標・Hierarchy・activeSketch切替と照会順を保持する。転送は既存select・ClipboardSessionとcopy／paste・Block Selection／中心／定義作成へ接続し、コピー拒否時のpaste短絡、前後拘束数／Boolean化／現在payload→state、Block検証エラー時の作成中止、Definition／外部投影拘束の集計を維持する。thisによるhook参照をselect／readStateへ置換し、モデル／Selection／Clipboard／Definition／cacheを複製しない。元の三つの本体との一致を確認。app.jsは8,225→8,176行（49行減、今回の合計2,882行減）。構文461ファイル・単体1,254件・関連E2E186件成功（exit 0、3.5分）。転送の拒否／短絡・同一Selection参照・payloadと事後観測の単体2件、祖先／可視性／Root等の資格E2E1件を追加。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-sketch-projection-transfer-driver-{check,unit,e2e}.log。Sketch Projectionテスト支援の実装本体は分離済みで、appには生成／接続と既存API名の対応付けが残る。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionのsource移動／形状・Spline構造変更とchain作成を既存SketchProjectionTestDriver.createSourceEditingへ、保存再読込をcreateReloadへ分離。source編集は現在scope／所属Sketch／拘束を照会して既存Point参照を変更し、target生成・参照metadata／拘束追加・同期と依存求解→UI→draw→stateへ委譲する。chainのupstream target同一参照、S4重複追加の回避、upstreamなしのnull、dependent求解の失敗判定を保持する。reloadは独立した六依存で保存値clone→版数Number変換→既存load→UI→draw→stateを保持し、Geometry生成／Solver依存を持たない。モデル／seq／cacheは複製せず、this経由のhook参照をreadStateへ置換。元の三つの処理本体との一致を確認。app.jsは8,271→8,225行（46行減、今回の合計2,833行減）。構文461ファイル・単体1,252件・関連E2E185件成功（exit 0、3.5分）。source形状／Spline構造の追随とchain参照の保存再読込のE2E2件、reloadのclone／変換・順序・load例外伝播の単体1件を追加した。最初のE2E起動は追加testの重複titleで収集に失敗し、重複分を除いて同じ対象を再実行し成功。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-sketch-projection-source-driver-{check,unit,e2e,final-check,e2e-final}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionのtarget選択／外観変更、最初の投影拘束・source／target Geometry・source Sketch削除の六つのAPIを既存SketchProjectionTestDriver.createGeometryInteractionへ分離。呼出し時の拘束reader・Geometry型・Selectionと既存編集／削除・表示／観測／client変換を明示し、fixture生成・Solver・Clipboard／Block化依存を持たせない。種別別Geometryの参照同一性、選択→UI→draw→state→client、編集／削除後state、対象なしのnull／falseと拒否結果を保持する。thisによるhook参照をprivate selectとreadState／clientPositionへ置換し、モデル／Selection／履歴／cacheは複製しない。元の六つの本体との一致を確認。app.jsは8,311→8,271行（40行減、今回の合計2,787行減）。構文461ファイル・単体1,251件・関連E2E183件成功（exit 0、3.5分）。既存E2Eに六つのhookの直接利用がなかったため、4つの単体境界テストを追加して五Geometry種別の同一参照、live readerと対象なし、操作拒否、削除payload、操作後観測を検証。対象E2Eはsketch-projection／互換fixture／command-panel／unified-ui／blocks／sketch-permissions。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-sketch-projection-geometry-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch ProjectionのBlock下書きfixture／確定、Block投影fixture、Instance移動／削除の五つのAPIを既存SketchProjectionTestDriverのcreateBlockEditorFixture／createBlockProjectionFixture／createBlockProjectionInteractionへ分離。独立した入口により、操作支援に生成型・Definition追加・採番依存を持ち込まない。編集scope切替後の再照会、Definition追加／IDの既存所有者、cache無効化・bundle解決・focus／履歴／表示順、移動の依存求解・削除後state照会、無Instance時のnullを維持する。this経由のhook参照を明示した表示／readStateへ置換し、モデル／seq／cache／履歴は複製しない。元の五つの本体との一致を確認。app.jsは8,352→8,311行（41行減、今回の合計2,747行減）。構文460ファイル・単体1,247件・関連E2E183件成功（exit 0、3.7分）。既存のfixture直接利用テストがなかったため、Block E2Eに下書き確定時のhost Geometry分離とInstance移動／削除時のDefinition保持／無Instance分岐を検証する2件を追加した。対象はsketch-projection／互換fixture／command-panel／unified-ui／blocks／sketch-permissions。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-sketch-projection-block-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionの矩形／共有種別fixtureと旧共有target Pointの再現を既存SketchProjectionTestDriver.createCompatibilityFixtureへ分離。現在scope・Geometry生成・投影target／拘束／metadata／求解・保存／読込・履歴／表示／状態照会を明示し、元の二つの処理本体との一致を確認。通常生成の共有source参照・座標・採番／Construction、旧形式指定時の保存値clone→target Point共有化→不要Point除去→既存load、履歴→UI→draw→readStateの順を保持する。製品migrationには移さず、独自モデル／seq／cacheを持たない。app.jsは8,443→8,352行（91行減、今回の合計2,706行減）。構文460ファイル・単体1,247件成功（exit 0）。既存fixtureの直接利用テストがなかったため、矩形／複数種別の通常生成・旧形式再読込に対する4つのE2Eを追加し、共有source Pointと独立target Point、矩形座標と所属Sketchを検証。関連既存E2E177件（3.5分）と新しい4件（1.6分）がそれぞれ成功（exit 0、計181件）。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、結果を回収した。ログはcad-sketch-projection-compatibility-driver-{check,unit,e2e,final-check,focused}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionの通常Geometry fixtureと投影状態照会をSketchProjectionTestDriver.createGeometryFixture／createObservationへ分離。観測に生成・求解・表示更新依存を持たせず、呼出し時のscope／mode／command件数／投影拘束と既存外観・拘束状態・保存・履歴・DOM readerへ接続する。fixtureの共有Point参照・座標・Construction・activeSketch切替・focus→履歴→UI→draw→client位置照会、観測のGeometry／外観／保存／履歴／階層／DOM順を保持する。独自モデル／seq／cacheを持たず、this経由のhook相互参照を明示した表示・履歴入口へ置換。元の二つの処理本体との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,502→8,443行（59行減、今回の合計2,615行減）。構文459ファイル・単体1,247件・関連E2E177件成功（exit 0、3.9分）。新しい単体テストは追加せず、全利用箇所のsketch-projection／command-panelとunified-ui／blocks／sketch-permissionsの既存E2Eで実利用を検証。テスト本体完了後に当該実行の専用サーバー終了待ちを解消して正常終了を回収した。ログはcad-sketch-projection-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasのtest用focus／world-to-client座標照会をCanvasTestDriverへ、派生Instance作図fixtureを既存DerivedInstanceTestDriver.createCommandFixtureへ分離。viewport／resize／drawと現在Canvas矩形の照会順、数値fallback、fixture座標・Construction・履歴／表示順を保持し、thisによるhook相互参照を明示したfocus／clientPositionへ置換する。モデル・seq・cache・表示状態を複製しない。元の三つの本体との一致と三つの境界テストを確認し、classic script／構文／単体／E2E読込一覧を更新。app.jsは8,525→8,502行（23行減、今回の合計2,556行減）。構文458ファイル・全単体1,247件成功（exit 0）。全E2Eは550件成功・DXF保存再読込の1件失敗（exit 1、24.6分）。既存保存処理ではcheckpoint更新後も保存中の排他が続くため、変更なし表示だけで読込を始めていたテストの待機条件を保存済み表示までに修正。期待するタイトル・Geometry・保存読込の検証は維持する。修正後はDXF／file-safetyを各3回、計45件成功（exit 0、2.9分）。テスト本体完了後のサーバー終了待ちは、当該実行の専用サーバーを確認して終了し結果を回収した。ログはcad-canvas-test-driver-{check,unit,full-e2e,final-check,dxf-recheck,save-recheck}.log。修正後の全E2E一括再実行は未実施であり、全551件が一括成功したとは扱わない。リリース前に最新状態の全E2Eを確認する。全体目標は未完了。

### 前回の区切り

派生Instanceのfixture／状態照会・読込・source／Instance削除の五つのテスト支援APIをDerivedInstanceTestDriverのcreateFixture／createInteractionへ分離。現在scopeと既存投影／削除・ID採番入口へ委譲し、Projection→Mirror→Patternの参照／採番順・Hatch生成・履歴／表示・clone／読込／削除後観測の順を保持する。独自モデル／seq／cacheを持たず、this経由のhook参照はDriver内stateと明示したreadStateへ置換。元の五つの本体との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,567→8,525行（42行減、今回の合計2,533行減）。構文456ファイル・単体1,244件・関連E2E199件成功（exit 0、2.7分）。ログはcad-derived-instance-test-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、利用する全9ファイルとunified-uiの既存E2Eで実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Clipboardの状態照会／通常図形fixture／Block fixtureをClipboardTestDriverの三つの独立した生成入口へ分離。観測は九つの依存だけで動き、生成型・seq・描画依存を持たない。fixtureは既存Geometry／拘束・定義追加・ID採番・ClipboardSession／Selection・履歴／表示へ委譲し、現在scopeの再照会・保存→Geometry→選択→payload→履歴の順と結果を保持する。this経由のhook相互参照をreadState／readSelected／readHistoryへ置換し、共有test選択readerは旧selectedGeometryIdsForTestにも接続。三つの本体と選択readerの元処理との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,634→8,567行（67行減、今回の合計2,491行減）。構文455ファイル・単体1,244件・関連E2E171件成功（exit 0、2.3分）。ログはcad-clipboard-test-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、全利用箇所のsketch-tree-visibility／sketch-tree-delete／unified-uiとblocksの既存E2Eで実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

拘束確定時のSolver結果を一時差替えするテスト支援をConstraintTestDriver.createForcedCommitへ分離。七つの明示した依存で既存fixture生成・commit・現在scope／DOM照会へ接続し、finallyの元Solver関数復元・例外伝播・結果変換・literal true判定・復元後の照会を保持する。元本体との一致と三つの境界テスト（通常／例外の復元と置換scopeの再照会）を確認し、classic script／構文／単体／E2E読込一覧を更新。app.jsは8,658→8,634行（24行減、今回の合計2,424行減）。構文454ファイル・単体1,244件・関連E2E124件成功（exit 0、1.7分）。ログはcad-constraint-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

描画順のfixture／観測／選択／並替えの四つのテスト支援APIをDrawingOrderTestDriverへ分離。createFixtureとcreateInteractionを独立して生成し、操作観測に図形生成・Block定義依存を持ち込まない。現在scope・既存DrawingOrder／Hatch境界／Selection／並替えcommandへ委譲し、fixture座標・ID・外観・一時activeSketch切替・cache／fit／履歴／表示の順を保持する。this経由のhook間参照をDriver内stateと明示した共有test履歴readerへ置換し、既存historyState APIも同じreaderに接続。DrawingOrderは後期script定義のため生成時に注入。四つの本体と共有履歴readerの元処理との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,746→8,658行（88行減、今回の合計2,400行減）。構文452ファイル・単体1,241件・関連E2E157件成功（exit 0、2.3分）。ログはcad-drawing-order-test-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、既存drawing-order／unified-ui／hatching／blocksのE2Eで実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

HatchのネストBlock投影fixture／状態照会とコピー・貼付け／Block化の検証手順を、既存HatchTestDriver.createProjection／createTransferへ分離。独立した生成入口により、転送に投影の型・描画依存を持ち込まない。現在scopeの再照会と元Hatch／境界Lineの参照を保持し、定義追加・projection cache無効化・UI／fit／draw・既存Clipboard／Block操作の順を維持する。元の三つの本体との一致を確認し、既存API名と結果を直接接続。app.jsは8,804→8,746行（58行減、今回の合計2,312行減）。構文451ファイル・単体1,241件・関連E2E163件成功（exit 0、2.4分）。ログはcad-hatch-projection-transfer-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、全利用箇所のhatching／sketch-moveとunified-ui／blocksの既存E2Eで実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Hatchの通常／穴付き領域fixture、状態照会、表示倍率、境界破損／復旧の六つのテスト支援APIをHatchTestDriver（src/testing/hatch_test_driver.js）へ分離。test query時だけ生成し、既存API名／戻り値を直接接続する。現在scope・modeを呼出し時に照会し、モデル／ID／cache／履歴／表示／保存の状態は既存所有者へ委譲する。元の六つの本体との一致、fixture座標・Hatch ID／nextIndex・Construction・scope照会・UI／draw順を確認。classic script／構文／E2Eの読込一覧を更新。app.jsは8,884→8,804行（80行減、今回の合計2,254行減）。構文451ファイル・単体1,241件・利用するE2E全10ファイルの180件成功（exit 0、2.7分）。ログはcad-hatch-test-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、既存E2EでDriverの実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Parameterダイアログの適用後の履歴・結果案内・scope再読込・error表示・UI／drawの進行を既存ParameterDialogController.createApplicationへ分離。ParameterApplicationはモデル適用・安定化・Block伝播・checkpoint回復の所有を維持する。成功callback内の表示例外も既存の復元範囲に含め、成功／失敗の順序・捕捉したsession.key・error変換二回を保持する。元本体との一致と4つの境界テスト（実ParameterApplicationによるcallback例外回復を含む）を確認。app.jsは8,900→8,884行（16行減、今回の合計2,174行減）。構文450ファイル・単体1,241件・関連E2E152件成功（exit 0、2.3分）。E2Eの実対象はparameter-dialog-controller／unified-ui／blocks／sketch-permissionsの4ファイルで、指定したparameter-dialog-draft.spec.jsは存在せず追加対象になっていない。ログはcad-parameter-dialog-application-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法配置中の対象変更候補の照会と強調表示更新を既存ConstraintCommandInput.createRetargetHoverへ分離。pendingとCanvasHoverは既存所有者に保持し、8つの明示した依存でoperandのhit・同一判定・意図解決・参照対象変換を接続する。単独operand・line-length／radius／diameter限定、他hoverの保持、対象外配置の限定解除、更新順序と参照／changed戻り値を維持する。元本体との一致と4つの境界テストを確認。app.jsは8,930→8,900行（30行減、今回の合計2,158行減）。構文449ファイル・単体1,237件・関連E2E181件成功（exit 0、2.6分）。ログはcad-dimension-retarget-hover-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasメニューのcommand取消可否と順次取消をCanvasCommandCancellationへ分離。mode・pending・拘束・作図operationをその時点で照会し、Block配置→pending→拘束→作図取消→tool終了を既存所有者へ委譲する。Blockのpanel保持reset／preview解除／mode／Properties復元／案内、最後の共通案内→UI→draw、無対象時の無変更、query短絡順を維持する。Escの優先取消とは統一しない。状態／rollback／履歴を複製せず、元処理との本体一致と4つの境界テストでlive再照会・順序を確認。classic script・構文・単体・E2E読込一覧を更新。app.jsは8,959→8,930行（29行減、今回の合計2,128行減）。構文448ファイル・単体1,233件・関連E2E205件成功（exit 0、3.0分）。ログはcad-canvas-command-cancellation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasのサイズ調整とPropertiesパネル開閉の表示構成をCanvasWorkspaceLayoutへ分離。bitmap同期・viewport中心保持・Tree幅適用・draw・値入力位置同期を既存所有者へ明示したportで接続する。中心はDOM更新前に取得し、pendingはdraw後に読む。空領域／中心指定なしのviewport維持、必要DOMなしの無変更、現在言語のARIA／titleを保持する。Treeと値入力の後期生成は遅延callbackで接続する。元処理との本体一致と4つの境界テストを確認し、classic script・構文・単体・E2E読込一覧を更新。app.jsは8,984→8,959行（25行減、今回の合計2,099行減）。構文446ファイル・単体1,229件・関連E2E147件成功（exit 0、2.2分）。ログはcad-workspace-layout-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Hatch／Reference Imageの内部領域hitを既存GeometryHitQuery.createRegionsへ集約。現在scope・通常選択mode・可視性・作図先とHatch列／owner順・既存幾何照会を明示する。Hatchのowner描画順と同順位の安定順、画像の配列逆順・回転／scale変換と辺を含むpixel矩形判定、activeOnlyの既定値、画像lockをhitで除外しない動作を保持する。元処理との本体一致と3つの境界テストで参照・順序・資格・変換を確認。app.jsは9,004→8,984行（20行減、今回の合計2,074行減）。構文444ファイル・単体1,225件・関連E2E197件成功（exit 0、2.8分）。ログはcad-region-hit-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法ラベル／寸法線のCanvas hitを既存GeometryHitQuery.createDimensionsへ集約。scope・倍率・mode・Sketch資格／可視性とtarget／dimension・外観／layout／text metrics／式flagを明示し、操作状態や寸法値を更新しない。拘束配列逆順、activeOnly既定値、各照会の順序・回数、回転／複数行／world-sizeラベル、ラベル優先、結果の参照同一性を保持。矩形判定の初期化時static参照は既存script順では未定義となるため、生成時の明示portに修正した。元処理との本体一致と3つの境界テストを確認。app.jsは9,030→9,004行（26行減、今回の合計2,054行減）。構文444ファイル・単体1,222件・関連E2E181件成功（exit 0、2.6分）。ログはcad-dimension-hit-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Block／派生インスタンスの全体hit・bundle hit・派生drag用部分Geometry hitを既存GeometryHitQuery.createInstancesへ集約。現在scope・倍率・投影bundle・可視性／操作資格・Annotation bounds・Hatch照会を明示し、Selection／mode／モデルを変更しない。BlockのGeometry→Annotation→Hatchと派生bundleのHatch優先の差、全体hitの描画順、dragの点→円弧端点→線→円→円弧→Splineと種別内逆順／end優先を保持する。元処理との本体一致と3境界テストで所有者・参照・順序・資格・現在倍率を確認。app.jsは9,101→9,030行（71行減、今回の合計2,028行減）。構文444ファイル・単体1,219件・関連E2E216件成功（exit 0、4.8分、ドラッグ回帰1.8分）。ログはcad-instance-hit-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Reference Imageの可視対象収集とoverlay候補・selected flag・較正点の表示構成を既存ReferenceImageRenderer.createLayerへ集約。resource rendererを受け取りcache／ready／clearとpaintを共有し、現在画像・hover・較正点の照会を明示する。inspection→単一選択→hover、候補拒否後のfallbackなし、active Sketch／inspectionの資格、画像参照と順序、overlayがなくても較正点を描く動作を保持。元処理との本体一致と3つの境界テストで確認。app.jsは9,110→9,101行（9行減、今回の合計1,957行減）。構文444ファイル・単体1,216件・関連E2E141件成功（exit 0、2.1分）。ログはcad-image-layer-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Hatch境界のGeometry収集・除外幅・解決済みloop距離・選択可能な内部点の4照会を既存HatchGeometryQueryへ集約。boundaryGeometryを再利用し、既定線幅と現在倍率を数値照会callbackとして明示する。直接／Block投影の所有者と参照、派生投影のoverlay対象なし、有限線幅の最大値／fallback、閉じる辺・穴を含む距離、厳密な大なりの選択判定を保持する。元処理との本体一致と3つの境界テストで確認。app.jsは9,151→9,110行（41行減、今回の合計1,948行減）。初回関連E2Eは既存drawingOrderStateForTestへの除外幅照会接続漏れで2件失敗し、接続を修正した。修正後に構文444ファイル・単体1,213件・同じ関連E2E179件が成功（exit 0、2.6分）。ログはcad-hatch-boundary-query-{check,unit}.logとcad-hatch-boundary-query-fixed-e2e.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Hatchの表示レイヤーを既存HatchRenderer.createLayerへ集約。解決済み領域paint→型別境界overlay、直接／Block／派生とinspection／operandの選択強調、owner別hover、作成／修復のregionと現在preview、PNG中の強調／preview抑制を担当する。幾何照会・cache・編集状態の更新は持ち込まず、read callbackと描画painterを明示する。HatchCommandは遅延参照し、appのhoisted入口は早期接続用に保持する。元処理との本体一致を、明示した状態読取と型順painter変換を除いて確認。描画順序・参照同一性・選択／hover・非表示Sketch・live preview・export抑制の3境界テストを追加。app.jsは9,176→9,151行（25行減、今回の合計1,907行減）。構文444ファイル・単体1,210件・関連E2E179件成功（exit 0、2.6分）。ログはcad-hatch-layer-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Splineのコピー／貼付け／Block投影テストシナリオをSplineTestDriver.createTransferへ分離。初期化／拘束Driverの依存を増やさず用途別に生成し、採番・定義追加・Workspace照会・Clipboard・Blockの既存入口を明示する。現在scopeは必要な時点で取得し、貼付けや復元前の配列を捕捉しない。テストfixtureのLeader／instanceと操作順序、参照、観測結果は元処理と一致する。機能実装やcache・sequence・rollbackをDriverへ複製しない。app.jsは9,227→9,176行（51行減、今回の合計1,882行減）。構文444ファイル・単体1,207件・関連E2E131件成功（exit 0、1.9分）。コピーされたSpline／LeaderのID、Block定義・投影と保存読込を既存E2Eで確認した。ログはcad-spline-transfer-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。Spline用の五つのテストAPIは機能別の支援モジュールへ移行済み。

### 前回の区切り

Splineの拘束テストシナリオを既存SplineTestDriverへ集約。対象Splineの読取り、幾何評価と型constructor、Geometry生成・拘束登録・求解・直列化を明示し、IDやSolver状態をDriverに所有させない。閉Spline／対象なしの無変更と、PointOnSpline→接線Line→SplineLineTangent→求解→直列化の順序・参照を維持する。元処理との本体一致と、appの変更が接続に限られることを確認した。app.jsは9,246→9,227行（19行減、今回の合計1,831行減）。構文444ファイル・単体1,207件・関連E2E131件成功（exit 0、1.9分）。ログはcad-spline-constraint-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。次は転送シナリオのClipboard／Block操作と採番の境界を確認し、既存Driverへの注入が過大になる場合は用途別の生成入口を検討する。

### 前回の区切り

Splineのブラウザテスト用初期化・状態照会・Hatchキャッシュ確認をSplineTestDriverへ分離。src/testing/はテストの準備と観測を担い、通常の編集や診断計測の所有者と区別する。必要な操作・照会を明示して受け取り、test指定時だけ生成する。既存3 API名、実行順序、Geometryの参照同一性を維持。転送／拘束シナリオは依存を確認するためappに保持する。app.jsは9,290→9,246行（44行減、今回の合計1,812行減）。構文444ファイル・単体1,207件・関連E2E131件成功（exit 0、1.9分）。ログはcad-spline-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

CanvasRenderProbeへCanvasの描画観測を集約した。Geometry IDラベル、拘束端点／Point／Arc端点のマーカー数、指定Pointの外観、寸法ラベルと式マークの7入口を明示したcontext・Geometry照会・描画callbackだけで実行し、model／Selection／DOM／履歴を持ち込まない。contextメソッドを計測中だけ差し替え、例外時を含め元の関数へ復元する。式マークの記録状態もProbe内へ移し、appの可変capture変数を廃止した。既存テストAPI名は各入口への直接接続で維持する。7処理の本体は記録状態の名称と所有先以外元処理と一致し、元メソッドのreceiver／引数／戻り値、例外復元、Object同一性、ネスト終了時の既存clear動作を境界テストで確認した。app.jsは9,402→9,290行（112行減、今回の合計1,768行減）。構文443ファイル・単体1,207件・関連E2E143件成功（exit 0、2.1分）。ログはcad-canvas-probe-{check,unit,e2e}.log。今回の変更では全E2Eを再実行していない。前区切りc5e049dの全E2E551件成功（24.2分）を、今回の変更後の全体検証と扱わない。全体目標は未完了。巨大なテスト用contextを別ファイルへ移さず、残る診断／シナリオAPIを機能単位で整理する。

### 前回の区切り

PendingCommandSessionへ共有の保留操作Objectの保持・読取り・置換・通知なしクリアと取消経路を集約した。appの可変pendingCommandを廃止し、各commandのgetPending／setPendingへSessionのread／replaceを接続する。Objectを複製せずbuffer／pointerの直接更新を保持する。取消ではInstance配置解除→注記／PNG専用command委譲またはOffset選択／pointer解除→pending解除→入力非表示→hint→Toolbar→拘束ボタン→drawの既存順序を維持する。PNG busyの拒否は強制クリアせず、Document初期化／Sketch切替／削除の直接clearを取消と混同しない。app全体の変更はSession接続と取消委譲だけであること、取消本体は明示した依存port以外元処理と一致することを照合した。初期化前の入力表示参照を遅延callbackへ修正し、修正版の起動確認と全検証が成功した。app.jsは9,412→9,402行（10行減、今回の合計1,656行減）。構文441ファイル・単体1,201件・全E2E551件成功（exit 0、24.2分、拘束ドラッグ回帰12.4分）。ログはcad-pending-session-{check,unit}.logとcad-pending-session-full-e2e.log。現在の作業branch全体をこの状態で検証しており、旧checkpointの成功件数を流用していない。全体目標は未完了。残る共有mode、command生成・接続、テスト用APIの機能ごとの境界は今後の対象とする。

### 前回の区切り

既存寸法の編集開始をDimensionValueCommand.startEditへ、線長寸法のダブルクリック入力開始をDimensionPlacementCommand.targetDoubleClickへ集約した。新規ファイルは増やさず、既存commandへ開始入口を揃える。権限拒否の処理済み返却、hit／target検査、読取専用ではpendingを置換しない動作、保存配置／hit配置／既定値の優先順位、式の数値fallback、選択とdrag解除→hint→draw→focusを維持する。ダブルクリックでは単独Lineとhit一致を確認し、配置開始後だけ既定位置から値入力へ進む。2処理の本体は明示した依存adapter以外元処理と一致。app.jsは9,444→9,412行（32行減、今回の合計1,646行減）。構文439ファイル・単体1,195件・関連E2E180件成功（exit 0、2.5分）。ログはcad-dimension-entry-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。選択／drag解除のportと共有pendingの取得・反映、依存の多いcommandの生成・接続はappに残り、今後の状態所有と組立て境界の整理対象とする。

### 前回の区切り

ConstraintControlsViewへ拘束ボタン／メニュー／Fixボタンのactive・ARIAとhint title反映を分離し、ConstraintSelectionQueryへFix一括対象・全対象の固定状態・操作可否の照会を集約した。Geometry mode外の短絡、保留寸法確認→拘束ボタン→メニュー→Fix→hintの順序、メニューがFix更新前の属性を読む既存動作を保持する。appは寸法取消条件と操作を接続し、Viewはmodel・Selectionやpendingを変更しない。元の対象照会・固定判定・可否式・DOM更新順序との一致を確認した。app.jsは9,508→9,444行（64行減、今回の合計1,614行減）。構文439ファイル・単体1,189件成功。関連E2E151件（2.2分）とFix専用4件（4.3秒）が成功（いずれもexit 0、合計155件）。ログはcad-constraint-controls-{check,unit,e2e}.logとcad-constraint-controls-fixed-e2e.log。全E2Eはこの単位では未実行。全体目標は未完了。共有pendingと残る寸法編集／取消入口、command生成・接続の整理は続く。

### 前回の区切り

選択可視性の対象収集と全対象の非表示判定をPropertySelectionへ、変更／履歴／UI更新をSelectionVisibilityCommandへ分離した。Properties対象の優先順位と混同せず、inspection／Root／作図Sketch／Block投影の除外、寸法の同一参照による重複除去、Instanceの明示上書き／実効外観／空bundleの継承判定を保持する。通常対象の一括変更→派生Instance上書き→一回の履歴の順序と既存の中間drawを維持する。3処理の本体は依存先と名称以外元処理と一致。コマンド生成を外観依存の初期化後へ配置し、E2Eで検出した起動時参照エラーを解消した。app.jsは9,548→9,508行（40行減、今回の合計1,550行減）。構文437ファイル・単体1,181件・関連E2E168件成功（exit 0、2.4分）。ログはcad-selection-visibility-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。appは3つのhoisted入口と明示した生成／接続を保持する。

### 前回の区切り

ToolbarViewへToolbarのactive／ARIA／disabledと選択可視性の反映を分離。操作は表示値だけを渡し、可視性と編集可否は既存照会へ委譲する。ボタン反映→履歴→可視性→Flyout→カーソル、DOMがない場合と権限の短絡評価、Flyout後の最新操作状態の読取りを維持する。appは生成／接続とhoisted updateToolbar入口を保持。app.jsは9,590→9,548行（42行減、今回の合計1,510行減）。構文435ファイル・単体1,174件・関連E2E186件成功（exit 0、2.6分）。ログはcad-toolbar-view-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。選択可視性の対象照会／判断／変更、共有pendingとmode、操作commandの組立て整理は残る。

### 前回の区切り

ConstraintSelectionQueryへ現在Selection／対象sessionからの拘束意図と実行／完了可否を集約。対象session→Spline対象変換→通常Selectionの優先、Geometry modeの適用範囲、command中の線長寸法の追加対象待ちを維持する。Selection・対象session・候補・意図照会を明示し、状態更新とUIを持ち込まない。6処理の本体は明示した所有者以外元処理と一致し、不要となったappの候補／subject変換の分解代入も撤去。app.jsは9,627→9,590行（37行減、今回の合計1,468行減）。構文433ファイル・単体1,168件・関連E2E171件成功（exit 0、2.4分）。ログはcad-constraint-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。共有pending・modeと、注入依存の多い操作commandの組立て整理は残る。

### 前回の区切り

ConstraintCommitCommandへ読取寸法の登録、解決済み意図の配置／通常／参照commit振分け、寸法生成後の式設定と確定を集約。重複寸法は復元後に同じcommand内の登録へ進み、appへの戻り依存を撤去した。3処理の本体は元処理と一致し、測定値とdisabled flag、Selection→分析→UI→draw→案内／log→履歴、通常expression／参照省略、意図による既存の追加履歴を維持する。app.jsは9,665→9,627行（38行減、今回の合計1,431行減）。構文431ファイル・単体1,162件・関連E2E171件成功（exit 0、2.4分）。ログはcad-constraint-registration-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。新規moduleは増やさず既存確定所有者へ統合し、生成・配置・現在Selection・共有sessionの接続整理は残る。

### 前回の区切り

未使用のhandleConstraintTargetClickを撤去し、拘束Canvas入力を既存ConstraintCommandInput→ConstraintTargetCommand→ConstraintTargetSessionの経路へ揃えた。Selectionから対象を作る処理はConstraintOperands.fromSelection、解決済み対象のCanvas選択反映はCanvasSelection.applyConstraintTargetsへ集約し、appには現在operand／Selection／pointerを渡す接続を保持。対象順序、円弧端点の重複除外、Spline最近点のfallbackとsampling、参照同一性、解除する選択範囲を維持する。変換本体は明示した入力以外元処理と一致。app.jsは9,822→9,665行（157行減、今回の合計1,393行減）。構文431ファイル・単体1,157件・関連E2E171件成功（exit 0、2.4分）。ログはcad-constraint-selection-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。未使用APIの削除を広げず、既存CanvasSelectionの公開helperとダブルクリック経路は保持する。

### 前回の区切り

ConstraintSolvePreparationへ円弧端点・Offset／OffsetChainの幾何前処理、求解ステップ幅の算定と一時変更／復元を分離。型・幾何照会・半径寸法保護・最小長さ・OffsetChain計画を明示し、UI・Selection・Document配列・履歴を持ち込まない。処理本体は元処理と一致。角度の周回、既存Geometryと点の参照、半径寸法保護、finallyでの数値設定復元を境界テストで確認。app.jsは9,954→9,822行（132行減、今回の合計1,236行減）。構文431ファイル・単体1,154件成功。関連E2E186件成功（exit 0、14.9分、うち拘束ドラッグ回帰12.5分）。ログはcad-solve-preparation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。appの3つのhoisted入口は早期接続用で、snapshot／求解実行／失敗復元は既存commandが所有する。

### 前回の区切り

ConstraintIntentResolverへ通常／参照／対称／Splineの意図解決と下位判定を集約。候補生成はConstraintCandidates、対象変換はConstraintOperandsへ委譲し、対象列を入力として配置／commit意図または拒否理由を返す。Selection・session・pending・モデル配列・UI／履歴を直接変更しない。子孫／複数Sketch／参照対象数／権限／循環／Spline端点の判定順序と参照同一性を保持し、処理本体は元処理と一致。app.jsは10,069→9,954行（115行減、今回の合計1,104行減）。構文429ファイル・単体1,148件・関連E2E171件成功（exit 0、2.4分）。ログはcad-intent-resolver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。現在Selectionの取得adapterと操作の進行、command組立ての依存整理は残る。

### 前回の区切り

DimensionPlacementCommandへ選択／半径・直径／解決済み意図からの配置開始、追加対象による再解決、値入力または読取登録への進行を分離。既存の配置計算・読取判定・対象sessionへ委譲し、開始経路ごとのdraft解除／mode変更と初期pointerの違い、draw後のfocus、retarget後のpending更新順序を維持する。5処理の本体は明示した依存adapter以外元処理と一致。app.jsは10,203→10,069行（134行減、今回の合計989行減）。構文427ファイル・単体1,141件・関連E2E165件成功（exit 0、2.3分）。ログはcad-dimension-placement-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。共有pendingCommandは他種別と分離しておらず、appのget／set adapterが残る。操作依存も多いため、session／入力表示の所有を整理する際に組立て境界を再確認する。

### 前回の区切り

DimensionReadOnlyQueryへ寸法配置候補の読取判定を分離し、ConstraintRedundancyへ候補の一時追加／解析／除去を集約。明示測定→単一Block→owner／参照付与→重複probeの順序と、候補Object・残存拘束の同一性、配列置換と表示診断を更新しない契約を維持する。appは生成／接続とhoisted入口を保持。app.jsは10,210→10,203行（7行減、今回の合計855行減）。行数以上に、一時モデル書込みの所有者とUIを持たない判定境界を揃える単位。構文425ファイル・単体1,135件・関連E2E165件成功（exit 0、2.3分）。ログはcad-readonly-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

DimensionConstraintFactoryへ寸法拘束の種類選択・生成と角度単位／接頭辞の適用を分離。型constructorと平行判定を明示して注入し、Document・UI・操作状態を持ち込まない。平行線拒否の案内とsilent制御は呼出側へ保持し、参照同一性と寸法displayの複製範囲を維持する。対象要素の照会は既存DimensionQueriesへ集約。app.jsは10,252→10,210行（42行減、今回の合計848行減）。構文423ファイル・単体1,130件・関連E2E165件成功（exit 0、2.3分）。ログはcad-dimension-factory-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintCommitCommandへ通常／参照拘束の追加とsnapshot・前処理・求解・Parameter安定化・退化／重複判定・失敗復元・成功後の分析／UI／履歴を分離。参照metadata入口、重複寸法の読取変換、通常拒否undefined／参照拒否false、成功後の性能記録の順序も保持。元処理本体は時計／性能記録port以外一致。app.jsは10,368→10,252行（116行減、今回の合計806行減）。構文421ファイル・単体1,125件・関連E2E166件成功（exit 0、2.4分）。ログはcad-constraint-commit-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。依存は明示したが多く、後続の組立て整理でcheckpoint・Solver・Parameter・UIの境界を再確認する。

### 前回の区切り

ConstraintTargetCommandへ拘束候補clickのAnnotation委譲・固定切替・対象追加・意図の配置／commit振分けを集約。hit／受入／sessionの所有者を接続し、固定後のcommand参照復元と拒否／エラー／未完了の表示順序を維持。処理本体は明示したsession依存以外元処理と一致。app.jsは10,432→10,368行（64行減、今回の合計690行減）。構文419ファイル・単体1,119件・関連E2E166件成功（exit 0、2.3分）。ログはcad-constraint-click-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。依存の増えたcommandは、残るcommit／寸法配置の所有を整理する際に境界と引数数を再確認する。

### 前回の区切り

OperandHitQueryへ拘束候補の通常hit・対称段階の優先・円弧端点・Spline parameterと投影／参照へのfallbackを集約。現在operand列と既知hitを明示し、各providerの評価順序とnullish再照会を維持する。照会本体は明示したoperand引数以外元処理と一致。app.jsは10,463→10,432行（31行減、今回の合計626行減）。構文419ファイル・単体1,113件・関連E2E166件成功（exit 0、2.3分）。ログはcad-constraint-hit-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintTargetCommandへ対象選択の開始・取消・確定要求と線長寸法完了を分離。Annotation委譲・権限・作図準備・同種toggle取消・session開始と選択整理・意図の配置／確定、取消時のUI更新とblurの順序を保持する。共有mode／作図draftの準備とDOM blurはappの限定adapterへ接続。状態・受入・案内の既存所有者を組み合わせ、Canvas hit／clickと実commitはまだ呼出側に残る。app.jsは10,537→10,463行（74行減、今回の合計595行減）。構文419ファイル・単体1,109件・関連E2E166件成功（exit 0、2.3分）。ログはcad-constraint-command-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintTargetSessionへpending拘束commandと順序付きoperand列の状態所有を集約。begin／append／resetと、commandだけ・operandだけの解除を区別し、appの2変数を撤去。入力・UI・描画・Annotation・診断の照会と更新をsessionへ接続し、受入拒否時の無変更と参照同一性を確認した。確定／取消の操作調整や共有modeは呼出側に残る。app.jsは10,541→10,537行（4行減、今回の合計521行減）。行数より状態更新の入口を揃えることを優先した単位。構文417ファイル・単体1,102件・関連E2E166件成功（exit 0、2.4分）。ログはcad-constraint-session-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintOperandsへ拘束候補の受入判断と次operand列の生成を集約。対称の段階／同種／重複／短線拒否、通常種別制限、再選択時の末尾移動と対象数上限を維持し、入力・Geometry・Selection・操作状態を変更しない。appは成功列を反映してSelection同期する。元処理と728ケースで受入可否・拒否文・結果列が一致。app.jsは10,572→10,541行（31行減、今回の合計517行減）。構文415ファイル・単体1,098件・関連E2E134件成功（exit 0、1.9分）。ログはcad-operand-acceptance-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintFeedbackへ拘束の対象選択中／拒否時の案内文を集約。種別・operand列・言語を明示し、汎用案内のlabelだけ遅延評価する。DOM・Document・pending sessionを変更しない。日英と対象段階の360ケースで元の処理と一致。Document初期化／Sketch切替／削除はreset対象と順序が異なるため、この単位では汎用resetへまとめず保持する。app.jsは10,641→10,572行（69行減、今回の合計486行減）。構文415ファイル・単体1,093件・関連E2E128件成功（exit 0、1.8分）。ログはcad-constraint-hints-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

SelectionDeletionCommandへ混在Canvas選択の削除調整を分離。Annotation／Hatch／画像→派生Instance→Block→通常図形の既存順序を維持し、GeometryDeletion・GeometryDeletionCommand・ReferenceImageInteractionへ編集を委譲する。通常図形削除が確定した場合の履歴委譲、owner Sketch求解と種別別履歴、途中ガード拒否時の既存の部分削除を境界テストで確認。元の処理本体はscope取得／表示adapter以外一致。app.jsは10,695→10,641行（54行減、今回の合計417行減）。構文415ファイル・単体1,090件・関連E2E223件成功（exit 0、3.2分）。ログはcad-selection-deletion-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

GeometryDeletionへBlock／派生Instanceの投影依存計画と削除適用を統合。投影ObjectとGeometry keyの参照、Block owner拘束、falsy keyの扱い、古いBlock bundleのsplines省略を維持する。計画は非破壊で、適用は拘束→付随注記→対象Instance配列だけを更新する。依存／Parameterガードとcache・選択・求解・履歴は呼出側が既存順序で調整。app.jsは10,711→10,695行（16行減、今回の合計363行減）。構文413ファイル・単体1,084件・関連E2E219件成功（exit 0、3.1分）。ログはcad-instance-deletion-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

GeometryDeletionCommandへプリミティブ／拘束の削除操作を分離。権限・派生参照・Parameter保護の順序、削除適用→Selection／Spline／hover整理→ownerごとの求解→表示→案内／履歴を維持する。共通操作状態の終了・表示・analysis照会を限定したadapterでappへ接続する。求解不成功でも削除を記録する既存挙動を維持し、deleteElements入口はhoisted wrapperとした。app.jsは10,732→10,711行（21行減、今回の合計347行減）。構文413ファイル・単体1,081件・関連E2E147件成功（exit 0、2.1分）。ログはcad-deletion-command-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

GeometryDeletionへ計画の適用を統合し、plan／applyを明示した編集APIとして整理。削除配列の置換と付随注記の除去は同じ所有者へ、選択整理はCanvasSelectionへ集約。Spline編集解除を選択更新の二段階の間に挟む既存順序と、残存図形／拘束のObject同一性を維持する。app.jsは10,745→10,732行（13行減、今回の合計326行減）。構文411ファイル・単体1,076件・関連E2E147件成功（exit 0、2.1分）。ログはcad-deletion-apply-{check,unit,e2e}.log。モデル適用本体は元の処理と照合済み。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

GeometryDeletionPlanへ、共有端点を保持しながら関連する点／図形／拘束を含める削除対象計算を分離。明示したmodelと候補から実オブジェクトの集合を返し、model・入力・Selectionは変更しない。PointUsageと拘束参照判定を注入する。元の計算本体は改行正規化後に機械照合して一致。権限／参照／Parameter保護、操作終了、削除適用、選択、求解・履歴・表示は呼出側へ保持。app.jsは10,796→10,745行（51行減、今回の合計313行減）。構文411ファイル・単体1,074件・関連E2E147件成功（exit 0、2.1分）。ログはcad-deletion-plan-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardCommandへコピー／切取り／貼付けのガード、実行順序、成功案内と失敗復元の調整を分離。モデル構築、session、checkpoint、Selectionの各所有者へ委譲し、appは現在scope・作成権限・mode・求解／履歴・表示同期との接続を保持する。既存の早期接続のため入口はhoisted wrapperを維持。app.jsは10,844→10,796行（48行減、今回の合計262行減）。構文409ファイル・単体1,070件・関連E2E201件成功（exit 0、2.6分）。ログはcad-clipboard-command-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardGraphへ貼付けるモデルの構築順序を集約。Geometry／Transfer／Parameterの既存所有者を7つの限定した依存で接続し、UI・session・checkpoint・求解・履歴を持ち込まない。生成結果と参照Mapを返し、構築失敗は操作側へ伝える。app.jsは10,889→10,844行（45行減）。構文407ファイル・単体1,064件・関連E2E201件成功（exit 0、2.6分）。ログはcad-clipboard-graph-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardGeometryへ派生InstanceのID予約・生成経路再接続・名前空間参照検査・正規化と追加を集約。生成後の投影参照登録はClipboardTransferに残し、順序を保つ。app.jsは10,901→10,889行（12行減）。構文405ファイル・単体1,062件・関連E2E197件成功（exit 0、2.5分）。ログはcad-clipboard-derived-build-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardGeometryへBlock Instanceの定義確認・生成・配置・ID対応表更新を集約。採番adapter以外の本体は元コードと機械照合して一致。投影cache／再接続と失敗復元は呼出側へ保持。app.jsは10,917→10,901行（16行減）。構文405ファイル・単体1,060件・関連E2E167件成功（exit 0、2.2分）。ログはcad-clipboard-blocks-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardSessionへコピー内容・cut保持・要素数・貼付け位置／回数の状態所有を分離。コピー通知→切取り削除、失敗時のpayload保持、求解前の回数更新を維持。診断hookの代入と消去もsession APIへ接続。app.jsは10,923→10,917行（6行減）。構文405ファイル・単体1,058件・関連E2E171件成功（exit 0、2.2分）。ログはcad-clipboard-session-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

CanvasSelectionへ貼付け後の生成IDと実オブジェクトによる選択復元を集約。種別フィルタと注記／Hatchの選択ID限定、Instance／画像全体選択を維持。呼出側で先に選択関連UIを解除する。app.jsは10,930→10,923行（7行減）。構文403ファイル・単体1,054件・関連E2E171件成功（exit 0、2.2分）。ログはcad-clipboard-selection-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardTransferへ派生Instanceの原点調整・bundle検査・参照Map登録を集約。scope／配列／cacheの所有を持ち込まず、必要な参照照会だけを注入。元の反復順序と上限を機械照合して維持。app.jsは10,952→10,930行（22行減）。構文403ファイル・単体1,052件・関連E2E197件成功（exit 0、2.5分）。ログはcad-clipboard-derived-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ParameterNamespaceへコピー寸法／注記の名前予約と式の付替えを集約。同一名前空間での切取り名保持、衝突回避、別名前空間での現在値化、角度の度換算、読取専用の除外を維持。appはscope選択と拘束復元・追加を調整する。app.jsは10,983→10,952行（31行減）。構文403ファイル・単体1,049件・関連E2E167件成功（exit 0、2.2分）。ログはcad-clipboard-symbols-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardTransferへ注記・塗りつぶし・参照画像の貼付け値変換を統合。serializeした注記・画像だけを移動し、塗りつぶしの参照不足はnullで呼出側へ返す。ID発行・配列追加・UI例外・履歴は操作側に残す。app.jsは10,995→10,983行（12行減）。構文403ファイル・単体1,046件・関連E2E186件成功（exit 0、2.4分）。ログはcad-clipboard-elements-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardPasteCheckpointへ貼付け直前の配列長・採番・modelカウンタの保持と復元を分離。明示したscopeを保持し既存Objectを複製せず、復元対象と順序を維持する。採番変数へのadapterはappに残る。app.jsは11,014→10,995行（19行減）。構文403ファイル・単体1,043件・関連E2E167件成功（exit 0、2.2分）。ログはcad-clipboard-checkpoint-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardGeometryへコピーしたプリミティブの生成・指定Sketchへの追加・IDと参照Mapの構築を分離。GeometryCreationの最小長／円弧正規化を注入し、Selection・履歴・pasteCount・失敗復元を持ち込まない。生成処理本体は元コードと機械照合して一致。app.jsは11,058→11,014行（44行減）。構文401ファイル・単体1,040件・関連E2E167件成功（exit 0、2.2分）。ログはcad-clipboard-geometry-{check,unit,e2e}.log。全E2Eは今回未実行。週枠残量70%未満で停止する最新指示へ方針書を更新。全体目標は未完了。

## 前回の停止地点（2026-10-10）

停止・リリース検証：コード05eecd3をdevelopへ統合し、構文390ファイル・単体992件・全E2E441件成功（exit 0、23.1分）。ログは一時ディレクトリのcad-refactor-oct10-final-{check,unit,e2e}.log。週枠残量5%で新規分離を停止し、記録をCommit／Push後、develop先行・main最後で同期して一時停止する。今回2コミットでapp.jsは10,977→10,834行（143行減）。再開時は方針書section 8を参照。全体目標は未完了。

### 最後の分離単位

ClipboardPayloadへscope・Selectionからの依存要素収集、参照不足の検出、対象内拘束の選別、コピー値生成を分離。生成値／エラーを返しUIとClipboard sessionを書き換えない。app.jsは10,940→10,834行（106行減）。構文390ファイル・単体992件・関連E2E140件成功（exit 0、1.8分）。ログはcad-clipboard-payload-{check,unit,e2e}.log。この分離単位の時点では全体E2E未実行（最終検証は上記）。全体目標は未完了。

### 前回の区切り

最新develop 3fc42beからcodex/clipboard-transferで再開。停止条件は週枠が尽きる前へ更新（最終検証・統合の余裕を残す）。ClipboardTransferへID再帰置換・拘束座標移動・Block投影再接続を分離し、貼付けsessionとデータ変換を分けた。元の3関数と処理本体が一致することを機械照合。app.jsは10,977→10,940行（37行減）。構文389ファイル・単体989件・関連E2E140件成功（exit 0、1.8分）。ログはcad-clipboard-transfer-{check,unit,e2e}.log。この分離単位の時点では全体E2E未実行（最終検証は上記）。全体目標は未完了。

## 前回の停止地点（2026-10-08）

停止・リリース検証：コードa936cc2をdevelopへ統合し、構文387ファイル・単体955件・全E2E413件成功（exit 0、全E2E21.2分）。全E2Eログはcad-refactor-oct8-final-e2e.log。今回の再開15コミットでapp.jsは11,403→10,782行（621行減）。週枠残量49%で新規分離を停止済み。この検証記録を最後にCommitし、develop先行・main最後でPush／同期して目標を一時停止する。再開はrefactoring-policy-and-resume.mdのsection 8に従う。全体目標は未完了。

### 最後の分離単位

ParameterNamespaceへ記号削除時の依存照会を統合。削除対象からの記号抽出・同時削除式の除外・名前空間選択を既存依存解析へ集約し、UIガードを分離。app.jsは10,785行から10,782行へ縮小（3行減）。構文387ファイル・単体955件・関連E2E105件成功（exit 0、1.5分）。追加fixtureの記号参照を既存の引用符付き式へ修正して検証済み。ログはcad-symbol-delete-{check,unit,e2e}.log。週枠残量49%を確認し新規分離を停止。今回の再開全体では11,403行から621行減。全E2Eとdevelop→mainの最終反映・同期はこれから行う。全体目標は未完了。

### 前回の区切り

AnnotationParameterCommandへ注記Parameterの切替・名称・式変更とガード・求解・失敗復元・履歴確定を分離。checkpointとnamespaceの所有は既存moduleへ残す。app.jsは10,801行から10,785行へ縮小（16行減）。構文387ファイル・単体952件・関連E2E105件成功（exit 0、1.4分）。ログはcad-annotation-parameter-{check,unit,e2e}.log。週枠残量51%で継続。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

GeometryAppearanceQueryへ幾何外観継承・Sketch外観・可視性の照会を分離。Document／Sketch／Block／派生投影の優先順と参照を維持し、キャッシュ期間はGeometryReadModelが所有する。app.jsは10,850行から10,801行へ縮小（49行減）。構文386ファイル・単体948件・関連E2E141件成功（exit 0、1.9分）。ログはcad-appearance-query-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

ConstraintFeedbackへ求解案内・拘束状態ラベル・集計文面を分離。結果と件数を明示入力にし、Solver／解析状態／DOMを参照しない。既存の成功・警告・失敗の条件と日英文面を維持。app.jsは10,896行から10,850行へ縮小（46行減）。構文385ファイル・単体945件・関連E2E104件成功（exit 0、1.4分）。ログはcad-feedback-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

ConstraintOperandsへ拘束対象の生成・参照target／subject変換・同一性判定を分離。Sketch関係の照会を注入し、幾何参照・Spline位置・Arc端点を保持。8関数の本体が旧実装と一致することを機械照合。app.jsは10,959行から10,896行へ縮小（63行減、抽出跡の空行整理を含む）。構文384ファイル・単体942件・関連E2E118件成功（exit 0、1.6分）。ログはcad-operands-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

DimensionPlacementへ寸法の既定配置・旧配置補正を統合。対象と配置を引数とし、拘束列挙・書戻しだけappに残す。角度ラベル移行順、axis、offset、既存相対配置の参照同一性を維持。app.jsは10,976行から10,959行へ縮小（17行減）。構文383ファイル・単体939件・関連E2E126件成功（exit 0、1.7分）。ログはcad-dimension-normalize-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

BlockStateへBlock定義・Sketch所属・親子所有・scope配置の正規化を分離。BlockCatalog／SketchContextの限定した照会と補完を注入し、編集コンテナはIDで渡す。旧処理本体との機械照合で依存置換以外の一致を確認。app.jsは11,119行から10,976行へ縮小（143行減）。構文383ファイル・単体936件・関連E2E159件成功（exit 0、2.1分）。ログはcad-block-state-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

DocumentStateへDocument／Block scopeの外観正規化を統合。旧Root外観の引継ぎ先をblockEditingの明示引数にし、編集session依存を除去。補助要素の所属補完と幾何参照保持を維持。app.jsは11,149行から11,119行へ縮小（30行減）。構文382ファイル・単体932件・関連E2E157件成功（exit 0、2.1分）。ログはcad-appearance-state-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

DocumentApplicationへDocumentの適用順と読込補正結果を分離。decode失敗時に既存モデルを消さない順序、Treeの任意保持、参照・最小線長・寸法・ID・外観・Block・描画順の同期を維持。Tree生成前参照による初回E2E起動失敗を遅延adapterで修正後、構文382ファイル・単体929件・関連E2E151件成功（exit 0、2.3分）。app.jsは11,170行から11,149行へ縮小（21行減）。ログはcad-document-apply-{check,unit,e2e}.log。全体E2Eは今回未実行。週枠残量61%で継続。全体目標は未完了。

### 前回の区切り

HistoryRestorationへDocument／Block履歴の復元手順を分離。現在名・補助作図設定・Tree状態の保持、Block定義clone、投影無効化と再求解順を維持。履歴抑止はHistoryControllerが所有する。app.jsは11,187行から11,170行へ縮小（17行減）。構文381ファイル・単体926件・関連E2E151件成功（exit 0、1.8分）。ログはcad-history-restore-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

DimensionPersistenceへ寸法保存データへの変換を分離。角度ラベルの移行順序と保存互換値を維持し、配置adapterを明示。app.jsは11,214行から11,187行へ縮小（27行減）。構文380ファイル・単体923件・関連E2E122件成功（exit 0、1.5分）。ログはcad-dimension-codec-{check,unit,e2e}.log。全体E2Eは今回未実行。GitHub障害は前段af5b2aeのPush時に解消し、未反映分もPush済み。全体目標は未完了。

### 前回の区切り

LineCollapseQueryへ拘束後の線の潰れ判定を分離。対象拘束型・snapshot参照・接続成分内のSketch・閾値は維持し、対象Sketchは明示引数とした。app.jsは11,259行から11,214行へ縮小（45行減、隣接空行整理を含む）。構文379ファイル・単体920件・関連E2E121件成功（exit 0、2.0分）。ログはcad-collapse-query-{check,unit,e2e}.log。全体E2Eは今回未実行。GitHubのInternal Server Errorが継続しており、Push完了はリモートrefで確認すること。全体目標は未完了。

### 前回の区切り

CircleCenterCrossCommandへ円中心十字の開始・検証・作成・求解と失敗復元・成功履歴を分離。geometryとcheckpoint／solverの既存所有者へ明示接続する。app.jsは11,335行から11,259行へ縮小（76行減）。構文378ファイル・単体917件・関連E2E109件成功（exit 0、1.3分）。ログはcad-center-cross-{check,unit,e2e}.log。全体E2Eは今回未実行。GitHubのInternal Server Errorにより前段c8fd85aのPushが未完了だったため、今回のcommitと合わせて再試行する。全体目標は未完了。

### 前回の区切り

CenterlineCommand.startへ事前選択付き開始を統合。開始とdraft入力の所有者を揃え、Root拒否・準備失敗時の対象選択移行を維持。app.jsは11,358行から11,335行へ縮小（23行減）。構文377ファイル・単体914件・関連E2E109件成功（exit 0、1.3分）。ログはcad-centerline-start-{check,unit,e2e}.log。全体E2Eは今回未実行。次は円中心十字の作成・求解失敗復元、共通編集・Document適用、描画・入力組立て。全体目標は未完了。

### 前回の区切り

最新develop 71b139bからcodex/sidebar-lifecycleで再開。SidebarControllerへタブ選択・開閉・ラベル同期と入力接続を分離。DOMを既存の状態所有者として維持し、Document依存を持たない。app.jsは11,403行から11,358行へ縮小（45行減）。構文377ファイル・単体912件・関連E2E104件成功（exit 0、1.2分）。ログはcad-sidebar-{check,unit,e2e}.log。全体E2Eは今回未実行。停止条件は週枠残量50%未満。全体目標は未完了。

### 前回の区切り

最新develop 166169aからcodex/rendering-policyで再開。CanvasThemeColorsへテーマ依存の表示色補正・hex解析・contrast計算を分離し、themeは明示引数にした。永続appearance値は変更しない。app.jsは11,271行から11,232行へ縮小（39行減、隣接空行整理を含む）。構文368ファイル・単体882件・関連E2E103件成功（exit 0、1.2分）。ログはcad-theme-colors-{check,unit,e2e}.log。コードcommit a66067dに対し、全E2E369件も成功（exit 0、19.7分、cad-theme-release-e2e.log）。週枠残量39%を確認し、新規分離を停止。develop・mainへ統合して同期後に一時停止する。全体目標は未完了。

### 前回の区切り

ReferenceImageCommandへ画像準備後の現在scopeへの配置・選択・履歴を分離。既存の準備後のSketch／viewport照会タイミングを維持。app.jsは11,288行から11,252行へ縮小（36行減）。今回の再開全体では12,389行から1,137行減。構文367ファイル・単体876件・全E2E367件成功（exit 0、19.8分）。ログはcad-image-command-{check,unit}.logとcad-refactor-final-e2e.log。週枠残量49%を確認して新規抽出を停止し、develop先行・main最後の統合と同期後に一時停止する。再開方針はrefactoring-policy-and-resume.mdのsection 8を参照。全体目標は未完了。

### 前回の区切り

ReferenceImageImportへ参照画像の形式判定・読取・デコード・縮小を分離。Document非依存のprepare APIとし、Sketchへの配置・選択・履歴はappに残す。app.jsは11,325行から11,288行へ縮小（37行減）。構文366ファイル・単体874件・関連E2E103件成功（exit 0、1.2分）。ログはcad-image-import-{check,unit,e2e}.log。全体E2Eは今回未実行。次は画像配置、Document読込適用、描画調整、入力module組立て、pending session、診断の責務。全体目標は未完了。

### 前回の区切り

DocumentFileCommandへFileReader読込・JSON解析・待機前後のBlock編集確認と内容変更検知を統合。appはapplyLoadedDocumentで図面適用・求解・履歴・checkpoint・表示調整を接続し、診断hookも同じ読込APIを利用する。app.jsは11,361行から11,325行へ縮小（36行減）。構文365ファイル・単体871件・関連E2E149件成功（exit 0、1.7分）。ログはcad-file-import-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量53%。次はDocument読込適用、描画調整、入力module組立て、pending session、診断の責務。全体目標は未完了。

### 前回の区切り

DocumentStatusViewへ履歴に基づくDocument保存状態表示、DocumentFileCommandへ実データによるbeforeunload保護を分離。状態所有はDocumentFiles／履歴に維持し、表示と終了保護の判定対象の違いを保持。app.jsは11,386行から11,361行へ縮小（25行減）。構文365ファイル・単体869件・関連E2E112件成功（exit 0、1.3分）。ログはcad-document-status-{check,unit,e2e}.log。全体E2Eは今回未実行。次はDocument読込適用、描画調整、入力module組立て、pending session、診断の責務。全体目標は未完了。

### 前回の区切り

DocumentFileCommandへ保存／別名保存／native・互換入力の読込進行と置換前確認を分離。DocumentFilesの排他・保存先・checkpoint所有を維持し、Document読込適用・求解・履歴初期化はappのimportFileDataへ接続。保存中編集のsnapshot区別と待機後のBlock編集再確認を維持。app.jsは11,557行から11,386行へ縮小（171行減）。構文364ファイル・単体866件・関連E2E118件成功（exit 0、1.3分）。ログはcad-document-file-command-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量56%。次はDocument表示・読込適用、描画調整、入力module組立て、pending session、診断の責務。全体目標は未完了。

### 前回の区切り

RuntimeVersionViewへHelpの実行コミット情報の検証・状態保持・再描画を分離。起動済みデータをloadで受け取り、言語変更はrenderだけを呼ぶ。HTTP／file起動方式は維持。app.jsは11,594行から11,557行へ縮小（37行減）。構文363ファイル・単体862件・関連E2E102件成功（exit 0、1.2分）。ログはcad-runtime-view-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量57%。次は描画用表示方針、入力module組立て、pending session、Document／診断の責務。全体目標は未完了。

### 前回の区切り

KeyboardInteractionController.createCancellationへEsc取消の優先順位を統合。各commandの状態所有を維持し、一度のEscで一操作だけ処理する。配置確定の拒否時にも後続取消へ進まない。app.jsは11,627行から11,594行へ縮小（33行減）。構文362ファイル・単体859件・関連E2E192件成功（exit 0、2.2分）。ログはcad-keyboard-cancel-{check,unit,e2e}.log。全体E2Eは今回未実行。週枠残量57%。次は入力module組立て、pending session、Document／描画／診断の責務。全体目標は未完了。

### 前回の区切り

CanvasInputBindingへCanvasイベント接続・移動flush境界・終了計測・座標表示を分離し、CanvasNavigationへwheel倍率変更を統合。元eventと処理順、pointer中心のworld座標維持、倍率制限、寸法入力同期を保持。app.jsは11,672行から11,627行へ縮小（45行減）。構文検査・単体858件・関連E2E198件成功（exit 0、2.2分）。ログはcad-canvas-binding-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量61%。次は共通取消優先順位、入力module組立て、残るDocument／描画／診断の責務。全体目標は未完了。

### 前回の区切り

ConstructionCommandへ補助作図設定・選択図形切替・ボタン表示照会を分離。選択ありは属性変更と履歴、選択なしは今後の作図設定の変更として独立させ、Document resetとUndo／Redo時の設定維持も同じ所有者へ接続。app.jsは11,711行から11,672行へ縮小（39行減）。構文検査・単体854件・関連E2E133件成功（exit 0、1.5分）。ログはcad-construction-command-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量63%。次は共通取消優先順位、Canvas入力接続と入力module組立て。全体目標は未完了。

### 前回の区切り

FilletCommand.begin／OffsetCommand.beginへ事前選択付き開始を統合。2線からの半径入力と拒否時の打切り、Offsetの初期化後の選択読取り・単独円／線／円弧の引継ぎを維持。DrawOperationLifecycle.prepareは共通初期化だけを担当し、選択と案内はコマンドに残す。app.jsは11,750行から11,711行へ縮小（39行減）。構文検査・単体850件・関連E2E122件成功（exit 0、1.5分）。ログはcad-special-start-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量66%。次はConstruction切替、共通取消優先順位と入力module組立て。全体目標は未完了。

### 前回の区切り

DrawOperationLifecycle.startへToolbarの基本9モード開始を統合。共通の初期化順と案内を集約し、Slotのcenter arc reset、Trimのpreview／Offset候補／限定hover消去を例外として維持。pending値入力やSelectionを追加で消去しない。app.jsは11,881行から11,750行へ縮小（131行減）。構文検査・単体846件・関連E2E198件成功（exit 0、2.6分）。ログはcad-basic-start-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量67%。次はConstruction切替、Fillet／Offsetの事前選択付き開始、共通取消優先順位と入力module組立て。全体目標は未完了。

### 前回の区切り

DrawOperationLifecycleへ通常終了・連続線終了・作図取消・進行中判定を分離。各draftは既存commandが所有し、通常終了のresetと取消のLine／Spline rollback、mode維持と選択復帰の違いを保持。app.jsは11,939行から11,881行へ縮小（58行減）。構文検査・単体843件成功。初回E2EはHatch生成前の直接参照で起動失敗し中断。resetだけを遅延接続して修正し、構文再検査と同範囲E2E198件が成功（exit 0、2.5分）。ログはcad-draw-lifecycle-{check,unit,e2e,e2e-recheck}.log。全体E2Eは今回未実行。開始時週枠残量71%。次はToolbarのモード開始と共通取消優先順位、入力module組立て。全体目標は未完了。

### 前回の区切り

RectangleSelectionQueryへ投影元の矩形照会を統合し、通常選択と線／bbox／曲線sampleの判定を共有。投影元provider・適格性判定を分け、通常選択のactive制限を混入させず候補順・Geometry参照・crossing／包含を維持。app.jsは11,964行から11,939行へ縮小（25行減）。構文検査・単体839件・関連E2E134件成功（exit 0、1.6分）。ログはcad-projection-rect-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量73%。次は共通モード遷移／取消、投影の適格性・投影済み照会、入力module組立て。全体目標は未完了。

### 前回の区切り

SplineCommandへ作成開始と直前点取消の操作案内を統合。既存pending取消とRoot判定の順、各draft／session／gestureの初期化順を維持し、点の復元はSplineDraftへ委譲する。作成開始・入力・確定の責務が同じコマンドへ収束。app.jsは11,983行から11,964行へ縮小（19行減）。構文検査・単体837件・関連E2E107件成功（exit 0、1.3分）。ログはcad-spline-start-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量74%。次は共通モード遷移／取消、投影の読取り照会と入力module組立て。全体目標は未完了。

### 前回の区切り

SplineEditCommandへ既存Splineの編集sessionと開始／終了／reset、通過点追加・削除・求解失敗時の復元を分離。作成用SplineDraftとは分離を維持し、描画・選択・パネル・削除は同じsessionを照会。Geometry参照、共有点削除条件、注記／拘束復元、ID・履歴順を保持。求解・注記等への明示依存は多く、共通編集サービスの整理時に見直す。app.jsは12,100行から11,983行へ縮小（117行減）。構文検査・単体834件・関連E2E155件成功（exit 0、1.9分）。ログはcad-spline-edit-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量76%。次はSpline作成開始／点取消と共通モード遷移、投影の読取り照会。全体目標は未完了。

### 前回の区切り

SketchProjectionCommandへ投影元draftと開始・切替・範囲追加・パネル除去・確定・取消・resetを分離。Document切替やモード終了からも同じresetへ接続し、appからリストへの直接書込みを除去。幾何候補・既存投影判定は読取りportとして残し、Geometry参照・ID・Instance形式・履歴順を維持。app.jsは12,187行から12,100行へ縮小（87行減）。構文検査・単体830件・関連E2E171件成功（exit 0、2.1分）。ログはcad-projection-command-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量78%。次はSpline編集sessionと共通モード遷移、残る投影の読取り照会。全体目標は未完了。

### 前回の区切り

GeometryInstanceCommand.cancelへFree／Mirror／Patternの取消、BlockPlacementCommand.finishOrCancelへanchor未指定時の取消／指定済み時の0度確定を集約。既存の状態所有者と依存だけで処理し、取消時の履歴非追加、Properties復元、配置拒否時のdraft保持を維持。app.jsは12,211行から12,187行へ縮小（24行減）。構文検査・単体826件・関連E2E160件成功（exit 0、2.0分）。ログはcad-command-cancel-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量79%。次はSketch投影／Spline編集sessionと共通モード遷移の状態所有。全体目標は未完了。

### 前回の区切り

KeyboardInteractionControllerへキーボードの受付優先順位と操作APIへの委譲を分離。メニュー／移動の抑止、保存repeat、文字編集対象、履歴・寸法入力・モード終了の順を保持。取消の共通状態更新とSpline点削除後の通知はappの明示actionとして残す。取消本体は分離前と処理内容が一致することを確認。app.jsは12,285行から12,211行へ縮小（74行減）。構文検査・単体822件・関連E2E198件成功（exit 0、2.4分）。ログはcad-keyboard-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量81%。次は取消操作と共通モード遷移の状態所有を整理する。全体目標は未完了。

### 前回の区切り

ConstraintStatusViewへ拘束状態表示の固定／Space保持状態と表示同期を分離。状態のOR、keyup／blurでの解除、変更時だけの描画とhint、Toolbar／menu同期を維持。Document／Selection／履歴は変更しない。app.jsは12,314行から12,285行へ縮小（29行減）。構文検査・単体818件・関連E2E101件成功（exit 0、1.2分）。ログはcad-status-view-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量82%。次は残るkeyboard終了／取消の操作責務と共通モード遷移。全体目標は未完了。

### 前回の区切り

DimensionInputControllerへ寸法／Offsetの入力欄イベントとbuffer更新を統合。app.jsは要素の接続のみとなり、新しいmoduleや依存の追加なし。入力欄の通常編集とCanvasの数値キー入力の違い、最新pendingの参照、確定・取消の伝播抑止を維持。app.jsは12,335行から12,314行へ縮小（21行減）。構文検査・単体815件・関連E2E130件成功（exit 0、1.5分）。ログはcad-dimension-binding-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量83%。次はキーボードの操作終了／取消と共通状態の所有者を整理する。全体目標は未完了。

### 前回の区切り

週枠残量86%への回復後、最新develop 4cc11d8からcodex/canvas-input-lifecycleで再開。PointerInteractionControllerへdoubleClick／leaveの入力優先順位と終了処理を統合し、CanvasPressQueryへdouble click用のhit照会を集約。Spline編集sessionの変更はapp側の明示actionとして保持。重複抑止、派生図形、寸法・Block・Spline編集の優先順位、drag中のhover保持とflush順を維持。app.jsは12,389行から12,335行へ縮小（54行減）。構文355件・単体813件・関連E2E198件成功（exit 0、2.4分）。ログはcad-activation-{check,unit,e2e}.log。全体E2Eは今回未実行。次はキーボード／寸法数値入力と入力module組立ての責務を整理する。全体目標は未完了、mainへの反映は停止時の最後に行う。

### 前回の停止地点（2026-10-02）

停止・リリース検証の区切り。週枠残量49%で新たな分離を停止。コード4ead051の全E2E327件が成功（exit 0、19.5分、cad-refactor-full-e2e.log）。Fillet 3,744・Offset 10,296・航空機1,872 previewの回帰も成功。構文347件・単体785件は同じコードで成功済み。今回の変更はこの検証・再開記録のみで、app.jsは12,190行のまま。この記録をCommit・Push後、develop→mainの順に反映し両branchを同期して一時停止する。全体リファクタリングは未完了。作業branchは継続用に保持。詳細な再開候補はrefactoring-policy-and-resume.mdの第8節。

### 前回の区切り

CanvasPressQueryへ読取り専用hit snapshotを分離し、PointerInteractionController.downへpointerdown全体の優先順位を集約。listenerはflushと委譲のみ。注記queryはhover非依存を確認してsnapshot構成後にhover更新。Instance受付が必ず消費する重複Sketch投影分岐と常にnullのinactiveHit分岐を除去。app.jsは12,280行から12,190行へ縮小。構文347件・単体785件・関連E2E203件成功（exit 0、4.2分）。ログはcad-pointer-press-{check,unit,e2e}.log。開始時週枠残量58%。次は残るdblclick／pointerleave／キーボード入力と入力module組立て。全体目標と全体E2Eは未完了。

### 前回の区切り

AnnotationCommandInputへ注記配置／選択、ConstraintCommandInputへ寸法drag・距離配置・数値入力中のクリック消費・拘束対象指定を分離。注記配置と選択の間にFillet半径配置を残し、既存の優先順位を保持。app.jsは12,359行から12,280行へ縮小。構文346件・単体780件・関連E2E192件成功（exit 0、2.4分）。ログはcad-target-input-{check,unit,e2e}.log。開始時週枠残量61%。次はhit snapshotとpointerdown全体の順序を整理してPointerInteractionControllerへ収束し、入力moduleの組立てをまとめる。全体目標と全体E2Eは未完了。

### 前回の区切り

InstanceCommandInputへ派生元編集・Sketch投影元選択・Free配置・Mirror／Pattern基準線の入力を分離。投影operandの優先順位、直接hitへのfallback、投影矩形のcapture、非線operand時の拒否、Free配置のsnapを維持。状態は既存Instance commandが所有。app.jsは12,383行から12,359行へ縮小。構文343件・単体774件・関連E2E192件成功（exit 0、2.4分）。ログはcad-instance-input-{check,unit,e2e}.log。開始時週枠残量63%。次は注記／寸法／拘束の受付とhit snapshot、その後入力moduleの組立て整理。全体目標と全体E2Eは未完了。

### 前回の区切り

DrawingCommandInputへ基本作図のclick受付と拒否判定、PointCommandへ点作成の仮入力・snap・選択更新・求解の手順を分離。先行する注記／寸法／拘束等の入力優先度と各command引数、Point以外の既存選択の保持を維持。app.jsは12,455行から12,383行へ縮小。構文341件・単体769件・関連E2E203件成功（exit 0、4.1分）。ログはcad-drawing-input-{check,unit,e2e}.log。開始時週枠残量66%。次はInstance等の受付とhit snapshot。全体目標と全体E2Eは未完了。

### 前回の区切り

BlankCanvasGestureへ空白double clickの候補・重複抑止状態と終了／取消の優先順位を分離。仮Point／Lineの判定、450ms／6px境界、Spline確定優先、候補と抑止の別resetタイミングを維持。操作APIの接続はまだ多く、共通モード遷移整理時に見直す。app.jsは12,578行から12,455行へ縮小。構文338件・単体766件成功。関連E2E203件の初回は202成功／1失敗：既存Spline test hookのhatchFaceAt参照切れを発見し、独立commit 06e2026でhatchGeometryQuery経由へ修正。Spline6件再実行は全件成功、修正後app構文も成功。残る197件は初回成功で、失敗は解消。ログはcad-blank-gesture-{check,unit,e2e,spline-recheck}.log。開始時週枠残量70%。次は通常pointerdownのhit snapshotとcommand受付。全体目標と全体E2Eは未完了。

### 前回の区切り

選択数・drag対象点の照会をCanvasSelectionへ集約し、通常図形のbeginDragと既選択判定をCanvasSelectionInteractionへ統合。appから3つのcallback注入を除去。共有点の参照・重複・順序、選択数の分類、単独／複数選択dragの条件と選択消去順を維持。app.jsは12,656行から12,578行へ縮小。構文336件・単体759件・関連E2E197件成功（exit 0、4.0分）。ログはcad-drag-start-{check,unit,e2e}.log。開始時週枠残量72%。次はpointerdownに残るhit snapshotとcommand受付。全体目標と全体E2Eは未完了。

### 前回の区切り

CanvasSelectionInteractionへ通常pointerdownの選択・drag開始を分離。描画順、点／円弧端点優先、追加選択、投影HatchのBlock選択、Spline複数選択drag、画像dragの更新委譲を維持。選択状態はCanvasSelectionのAPI経由で更新し、DOM captureも明示portとする。旧本体との一致を依存置換を除き確認。app.jsは12,768行から12,656行へ縮小。構文336件・単体754件・関連E2E197件成功（exit 0、4.1分）。ログはcad-selection-interaction-{check,unit,e2e}.log。開始時週枠残量74%。次は選択数／drag対象点照会を既存Selectionへ収束し、beginDragの計画生成とpointerdownのcommand受付・hit snapshotを整理する。全体目標と全体E2Eは未完了。

### 前回の区切り

PointerInteractionControllerへpointer終了処理も集約し、移動・終了の優先順位を同じ所有者で扱う。操作が終了を消費した後の打切り、元のpointer eventの引渡し、未消費時の履歴確定と仮Line始点の抑止を維持。flushと計測はapp側。app.jsは12,784行から12,768行へ縮小。構文334件・単体748件・関連E2E197件が成功（exit 0、4.0分）。ログはcad-pointer-interaction-{check,unit,e2e}.log。週枠残量75%。次はpointerdownのcommand受付と通常選択／drag開始を分析する。一括移動による依存肥大化は避ける。全体目標と全体E2Eは未完了。

### 前回の区切り

PointerMoveControllerへ入力振分けを分離。座標表示・変換・間引き・profile／read cacheはUI側に保持し、controllerは各操作の公開APIと状態照会を受け取る。重なる状態の優先順位、消費／継続、部分hover消去、距離寸法のpending更新を維持。app.jsは12,876行から12,784行へ縮小。振分け本体は明示portへの置換を除いて旧コードとの一致を確認。構文334件・単体746件・関連E2E197件が成功（exit 0）。ログはcad-pointer-move-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。開始時週枠残量79%。

### 前回の区切り

DrawingPreviewへpointer／Trim候補の状態と作図feedback更新を分離。command・モード切替・描画・診断を同じ所有者へ接続し、resetを集約。line／基本図形の後続hover継続、Centerline等の消費、距離寸法の前後関係、Trim参照同一性と既存hover条件を維持。app.jsは12,990行から12,876行へ縮小。構文332件・単体740件・関連E2E197件が成功（exit 0、ドラッグ・画像操作を含む）。ログはcad-drawing-preview-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。開始時週枠残量83%。

### 前回の区切り

Block／Free Instanceの配置previewをPlacementPreviewRendererへ分離し、Geometry描画の重複を統合。投影生成は呼出し側、Hatch／注記は既存rendererへ委譲。描画順・青色・alpha・元styleの無変更・Free Instance点markerを保持。app.jsは13,041行から12,990行へ縮小。構文330件・単体734件・関連E2E192件が成功（exit 0）。ログはcad-placement-preview-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。最新継続指示の週残量50%停止・最後のmainマージを再開方針に反映。開始時残量85%。

### 前回の区切り

snap markerとSketch識別ラベルをInteractionOverlayRendererへ分離。hover優先・選択種別順・可視性／active除外・参照関係文言／色・画面px配置を保持。状態所有者は変更せず、診断も同じ関係照会を利用。app.jsは13,137行から13,041行へ縮小。構文328件・単体731件・関連E2E192件が成功（exit 0）。ログはcad-interaction-overlay-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

Spline／Centerline／TrimのpreviewをAuthoringPreviewRendererへ統合。draftを変更せず、投影済みpointer・支持線・Canvas寸法・Trim候補を引数で受け取る。mode・command・DOMはapp側。app.jsは13,202行から13,137行へ縮小。構文326件・単体727件・関連E2E192件が成功（exit 0）。ログはcad-remaining-preview-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

基本作図とFilletのpreview描画をAuthoringPreviewRendererへ分離。command／Documentは渡さず座標引数・幾何計算portだけを受け取る。途中段階のmarker・最小長・円弧方向・CanvasSurfaceのresetを保持。app.jsは13,322行から13,202行へ縮小。構文326件・単体724件・関連E2E192件が成功（exit 0）。ログはcad-authoring-preview-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

円弧端点／Spline編集ハンドルの表示状態をGeometryPresentationへ、描画をGeometryRendererへ統合。円弧の編集可否・端点対選択・固定強調、Splineのscope同一性・閉曲線・選択色、CanvasSurfaceのresetを保持。新moduleなし。app.jsは13,368行から13,322行へ縮小。構文324件・単体720件・関連E2E192件が成功（exit 0）。ログはcad-handles-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

点の表示条件と中心強調をGeometryPresentationへ、円／影／ID／固定ラベルの描画をGeometryRendererへ統合。新moduleは追加しない。Spline編集点・端点・参照点・投影点・拘束表示の条件と色の優先順位を維持。app.jsは13,419行から13,368行へ縮小。構文324件・単体717件・関連E2E192件が成功。E2Eは直近のsandbox内server終了待ちを避けるため承認済み権限で実行し、server手動停止なしでexit 0。ログはcad-point-render-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

GeometryPresentationへGeometry描画状態・所有Instance選択／hover・色・線幅の5関数を分離。状態は既存所有者から読み、GeometryRenderer・点描画・診断で共有する。5関数の本体はconstruction alphaの明示依存化以外に変更がないことを確認。app.jsは13,456行から13,419行へ縮小。構文324件・単体713件・関連E2E192件が成功。全テスト本体成功後にwebServer終了待ちが残り、今回のserverのPID／親PID／commandを確認して停止。最終192 passedとexit 0を確認。ログはcad-geometry-presentation-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

SelectionHighlightへ拘束の図形role・Propertiesラベル・強調対象の構成を統合し、GeometryReadModelへ現在scopeの通常図形ID検索を統合。appからの逆向きcallbackを減らし、新moduleは追加しない。拘束照会2関数は本体一致を確認。app.jsは13,510行から13,456行へ縮小。構文322件・単体709件が成功。関連E2E192件が成功（cad-highlight-query-{check,unit,e2e}.log）。全テスト本体成功後のwebServer終了待ちが残ったため、今回の実行が生成したserverのPID／親PID／commandを確認して停止し、192 passedの最終出力を確認した。全体目標と全体E2Eは未完了。

### 前回の区切り

SketchTreeControllerへ行hover状態・pointerOver／Out・leave・所属図形の強調判定を統合。新moduleを増やさずCanvasHover／sidebar強調と接続し、SelectionとアクティブSketchは更新しない。3関数はscope取得以外の本体一致を確認。app.jsは13,565行から13,510行へ縮小。構文322件・単体706件が成功。関連E2E192件が成功（Sketchツリー・Canvas強調・選択を含む5ファイル）。ログは一時フォルダのcad-tree-hover-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

PointUsageへ点の使用関係と分類14関数を集約。現在scope・展開Geometry・編集fit point・拘束参照を明示読取りで接続し、Object同一性と分類条件を維持。14関数はscope／session取得以外の本体一致を確認。app.jsは13,606行から13,565行へ縮小。構文321件・単体703件が成功。関連E2E192件が成功（点選択・拘束・Spline／投影を含む5ファイル）。ログは一時フォルダのcad-point-usage-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

所属Sketch表示のhitをGeometryHitQueryへ、注記対象hitをAnnotationAnchorQueryへ統合。新moduleを増やさず、既存の照会所有者へ集約した。2関数はscope／倍率取得以外の本体一致を確認。app.jsは13,698行から13,606行へ縮小。構文319件・単体698件が成功。関連E2E192件が成功（所属Sketch・Annotation・Block投影を含む5ファイル）。ログは一時フォルダのcad-identity-hit-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

OperandHitQueryへ参照SketchとBlock／派生Geometryの拘束対象照会を分離。Geometry読取り・Sketch関係・点分類・operand生成を明示依存とし、逆順と円弧端点の扱いを維持。3関数は倍率getter以外の本体一致を確認。app.jsは13,785行から13,698行へ縮小。構文319件・単体694件が成功。関連E2E192件が成功（Block・派生Instance・参照拘束を含む5ファイル）。ログは一時フォルダのcad-operand-hit-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

PointerHoverへ通常選択・拘束入力のhit優先判断とCanvasHover更新を分離。command種別を引数で受け、描画要否を返す。両経路は引数化・再描画通知以外の本体一致を確認。app.jsは13,883行から13,785行へ縮小。構文317件・単体690件が成功。関連E2E194件が成功（選択・拘束入力・投影・参照画像を含む6ファイル）。ログは一時フォルダのcad-pointer-hover-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

GeometryHitQueryへ通常Geometryのhit照会10関数を集約。現在scope・倍率・編集可否・点分類を明示依存とし、端点優先、描画順、円弧端点のend→start順を維持。右クリック候補とは異なる照会規則を保持し、端点の選択可否predicateだけを共用した。10関数の本体は読取りportへの置換以外の一致を確認。app.jsは13,950行から13,883行へ縮小。構文315件・単体683件が成功。関連E2E192件が成功（選択・作図・拘束入力・投影を含む5ファイル）。ログは一時フォルダのcad-geometry-hit-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

CanvasHoverへ14種類のhover参照と一括更新・clear・退避復元・候補previewを集約。194代入を更新APIへ移行し、独立する28組を一括化。元の代入式と順序の一致を確認した。参照画像を含まないメニュー退避範囲とSketchツリー行hoverの区別を維持。app.jsは14,067行から13,950行へ縮小。構文313件・単体678件が成功。関連E2E197件が成功（通常操作192件・図形ドラッグ3件・参照画像2件）。ログは一時フォルダのcad-canvas-hover-{check,unit,e2e,images}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

CanvasContextQueryへ候補収集・投影集約・順位付け、CanvasContextPresentationへ表示ラベルを分離。scope・倍率・編集中fit pointと各種読取りを明示依存にし、UI／Selection更新を持たない。4関数は読取りportへの置換以外の本体一致を確認。app.jsは14,303行から14,067行へ縮小。構文311件・単体673件が成功。関連E2E192件が成功（右クリック候補・拘束入力・Block／派生Instanceを含む5ファイル）。ログは一時フォルダのcad-context-query-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

CanvasContextMenuへ対象・pointer・候補一覧・hover snapshotの所有と、HTML・位置・focus・イベント・開閉／復元を集約。appは候補を供給し選択／操作通知を既存コマンドへ接続する。start／disposeでイベント寿命を管理。app.jsは14,431行から14,303行へ縮小。構文308件・単体667件が成功。関連E2E192件が成功（右クリック操作・重なり候補・拘束対象選択を含む5ファイル）。ログは一時フォルダのcad-context-menu-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

AnnotationSpatialQueryへ表示範囲・文字領域・通常選択／右クリックhit照会を分離。6関数の計算は倍率getter以外を維持。矩形拡張判定はGeometryBoundsへ統合し、描画とモデル編集は持たない。app.jsは14,545行から14,431行へ縮小。構文306件・単体662件が成功。関連E2E198件が成功（Annotation表示サイズを含む6ファイル）。ログは一時フォルダのcad-annotation-spatial-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

週枠50%の停止条件はユーザー指示で解除済み。最新develop（5116a81）を作業branchへ取り込んだ。AnnotationAnchorQueryへ引出線対象・最近点・GeometryRef再解決を分離し、Selection／現在Sketch／参照解決を明示callbackで接続した。抽出5関数の本体一致を確認。app.jsは14,596行から14,545行へ縮小。構文304件・単体657件が成功。関連E2E198件が成功（Annotation表示サイズ・Parameter・保存再読込を含む6ファイル）。ログは一時フォルダのcad-annotation-anchor-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

## 過去の区切り

AnnotationCommandへテキスト／引出線の作成・対象選択・prompt・確定取消と配置計算を集約。previewを描画データとして返し、appが既存Rendererへ接続する。共通pendingCommandは明示get／setを使用。操作・配置9関数はadapter置換とpreviewデータ化以外の一致を確認。構文302件・単体633件・関連E2E184件が成功。app.jsは14,539行。全体目標と全体E2Eは未完了。 週枠の残りが49%となり、ユーザー指定の50%未満停止条件に達したため、この区切りをCommit・Pushして一時停止する。

HatchCommandへ作成・境界修復の進行とpreview／修復対象を集約。共通mode・pointer・ID採番・UI・履歴は明示adapterで接続し、取消とDocumentリセットはresetを利用。構文300件・単体628件・関連E2E191件が成功。app.jsは14,674行。全体目標と全体E2Eは未完了。

HatchGeometryQueryへprimitive変換・境界fingerprint・境界解決WeakMap・閉領域indexを集約。修復後のforgetとDocumentリセット時のclearでcacheを操作し、appから直接参照を除去。抽出7関数は依存取得方法以外の本体一致を確認。構文298件・単体623件・関連E2E191件が成功。app.jsは14,750行。全体目標と全体E2Eは未完了。

BlockLayoutへ入れ子を含むBlockローカル範囲、表示中心、配置anchorへの平行移動を集約。BlockCatalog・BlockProjection・InstanceProjectionと形状解決を明示依存とし、抽出3関数の本体一致を確認。構文296件・単体619件・関連E2E184件が成功。app.jsは14,817行。全体目標と全体E2Eは未完了。

FirstDimensionScalingへ初回寸法のモデル拡縮を分離し、画面上の範囲取得／復元を既存CanvasViewportへ統合。DimensionValueCommandの初回判定・追加成否・履歴と順序を保持。モデル操作7関数は依存名以外の本体一致を確認。構文294件・単体614件・関連E2E184件が成功。app.jsは14,918行。全体目標と全体E2Eは未完了。

GeometryBoundsへ矩形判定・図形bounds・範囲結合、ReferenceImageGeometryへ画像座標変換、DrawingBoundsへSketch指定・全体・可視対象の範囲集計を分離。計算15関数は依存取得名と空白以外の本体一致を確認。構文292件・単体608件・関連E2E186件が成功。app.jsは15,023行。全体目標と全体E2Eは未完了。

PointerMoveSchedulerへ保留中のpointer入力・frame予約・flush／破棄と診断件数を集約。appは移動処理とpreview計測・Geometry読取りcache・寸法入力同期を接続する。構文288件・単体603件・関連E2E118件（図形ドラッグ／基本操作117件と240入力のframe集約1件）が成功。app.jsは15,176行。全体リファクタリングと全体E2Eは未完了。

旧SketchProjection拘束をSketchProjectionQueries（投影先索引・対応点・影響対象の照会）とSketchProjectionEditing（共有Point分離・source再接続・Spline metadata同期）へ分離。抽出12関数の本体はscope取得の依存名と空白以外の一致を確認。構文286件・既存単体599件・関連E2E184件が成功（ログ: 一時フォルダのcad-release-check.log、cad-release-unit.log、cad-release-e2e.log）。app.jsは15,226行。ユーザーの明示依頼で既存の未リリース分離と合わせてdevelop経由でmainへ反映する。全体リファクタリング・全体E2Eは未完了。次の分離にはまだ着手していない。

寸法式の下書き評価を既存ParameterNamespaceへ統合し、ExpressionInputViewへ強調表示・DOM装飾・input／scrollイベントと再描画を集約。参照名のscope選択はappから明示callbackで接続し、UIには計算とモデル更新を持たせない。構文284件・単体599件・関連E2E185件が成功。app.jsは15,405行。次はSketchProjection拘束の照会・metadata同期・共有点分離の境界を調べる。全体目標は未完了。

ParameterStabilizationへ式評価と参照寸法feedback・目標値の段階的求解を集約。ParameterNamespace、SketchSolving、EditingCheckpointを接続し、ParameterApplicationは操作全体の確定・復元を引き続き担当する。反復上限・補間・半減再試行・finallyによる最終target復帰を維持。構文283件・単体597件・関連E2E185件が成功。app.jsは15,489行。次は寸法式の下書き評価を既存ParameterNamespaceへ集約し、式入力表示の責務を整理する。全体目標は未完了。

ConstraintAnalysisへ解析対象の拡張・通常／Block／Free Instance分類・cacheと遅延評価を集約。appの直接無効化をinvalidate APIへ置換し、UIは分類・summary・安定性を照会する。数値解析の基底成分取得はSolverの共通関数へ移し、GeometryDragEditingも直接利用する。構文281件・単体591件・関連E2E191件が成功。app.jsは15,595行。次はParameterの反復評価と目標遷移求解を整理する。全体目標は未完了。

ConstraintRedundancyへ追加時の個別冗長判定・全Sketchの集計・結果Mapを集約。接続されたLine／Arcの最初の同等接線を維持する例外、前計算の再利用、個別詳細破棄後は次のrefreshで件数を更新する時機を保持した。構文279件・単体584件・関連E2E184件が成功。app.jsは15,800行。次は拘束状態の解析・分類・cacheの所有者を整理する。全体目標は未完了。

ReferenceConstraintStateへ参照の有効性・循環照会と参照エラーMapを集約。現在scopeとSketchContextの所属／参照範囲判定だけに依存し、求解・UIは操作可否、理由、件数をAPIで照会する。読込順の判定と永続enabledの保持を維持し、診断用snapshotから内部Mapを変更できない構成にした。構文277件・単体580件・関連E2E184件が成功。app.jsは15,874行。次は重複拘束の解析と結果状態を整理する。全体目標は未完了。

SketchSolvingへ単一／局所Sketch求解・依存順序に沿う伝播・失敗復元と求解結果状態を集約。状態Mapを非公開にし、削除・モデルresetもAPI経由へ変更した。求解対象はSolveScopeQuery、値復元はEditingCheckpoint、通知・履歴は各操作側へ委譲する。構文275件・単体575件・関連E2E191件が成功。app.jsは15,944行。次は参照拘束の有効性と参照エラー状態の境界を整理する。全体リファクタリングは未完了。

SolveScopeQueryへ拘束連結成分と局所／Sketch全体の変数・拘束・線の照会を集約。現在のworkspaceとGeometryReadModel、所属・有効性の判定を明示依存とし、操作・求解実行・数値状態を持たない。固定Pointでの探索停止、局所Pointだけの表示判定、変数順序とBlock回転ロックを維持した。構文273件・単体568件・関連E2E191件が成功。app.jsは16,102行。次はSketch求解・依存先求解と失敗復元の調整境界を調べる。全体目標は未完了。

GeometryDragEditingへ局所context準備・Line代表target判定・開始前snapshot・図形種別のpreview適用と補正／復元を集約。操作と診断がprepare／preview／finishを共用し、appに残るpreview／finishは計測adapterのみとした。共有のRadius／Diameter寸法照会は既存DimensionQueriesへ統合し、拘束編集の参照を維持。構文271件・単体564件・関連E2E194件が成功。app.jsは16,269行。次は共通の拘束連結成分・局所／Sketch求解対象の照会境界を整理する。全体目標と全体E2Eは未完了。

GeometryDragへドラッグsessionの開始・更新・終了・resetとTX-02の復元／履歴調整を集約。appの共有dragSessionを除去し、入力を操作API、描画を3種の強調対象照会へ接続した。開始計画をコピーして保持し、小移動／クリック、投影拒否、最終求解・Spline・Parameter失敗の復元と通知順序を維持。構文269件・単体556件・関連E2E191件（通常184件と実pointer操作・Undo7件）が成功。app.jsは16,501行。局所context準備と図形種別ごとのpreview適用は明示callbackとして残り、次はその依存を整理する。直前の求解分離は`0ee5b09`で確定済み。全体目標と全体E2Eは未完了。

GeometryDragSolverへ局所／guided求解、全Sketch再試行、大移動の区間分割と終了時補正を集約。前回／保留中の目標、guided対象変数、一時拘束、preview残差は非公開WeakMapでドラッグごとに所有し、appのsessionから除去した。局所／全Sketchの復元範囲、許容差、反復上限のfinally復帰と診断の件数を維持。構文267件・単体548件・関連E2E202件（20.5分）が成功。app.jsは16,594行。次は局所context準備とドラッグ操作の開始・更新・確定／復元の所有者を整理する。全体目標と全体E2Eは未完了。

直前のGeometryDragPlan分離は`dd5399d`で確定済み。その後のBlockハッチ変換追従修正`d0db050`も含め、`0c4bbc1`でdevelop／mainへ反映済み。以下は各区切りの記録であり、現在の再開手順はrefactoring-policy-and-resume.mdを優先する。

通常図形ドラッグの開始状態・移動先・一時拘束生成を`GeometryDragPlan`へ分離。固定／ロック判定、開始時座標、Block回転pivot、半径の開始中心基準を維持し、構文265件・単体539件・関連E2E191件が成功。app.jsは16,989行。次はSolver適用・復元の実行境界を整理する。

DimensionDragへ寸法位置ドラッグのsession・開始表示値・更新・確定・resetを集約。appのsession変数を除去し、描画は対象constraintの照会、入力は操作APIで接続。寸法コマンド中の3px閾値と小移動時のクリック継続、角度と通常寸法の通知差を維持。構文263件・単体534件・Slot寸法／Block／統合UI／保存互換E2E153件が成功。app.jsは17,126行。次は通常図形ドラッグの状態とSolver・復元の境界を調べる。全体目標と全体E2Eは未完了。

RectangleSelectionQueryへ矩形内候補の読取りを分離し、追加／置換と補助選択解除は既存CanvasSelection.applyRectangleへ統合。selectByRectは接続のみになった。Object同一性、表示・所属条件、Arc／Splineサンプル、Block投影境界とgeometryInstances選択の保持を維持。構文261件・単体530件・Block／統合UI／保存互換／SketchProjection E2E162件が成功。app.jsは17,224行。次は寸法ドラッグなど残る入力sessionの開始・更新・確定を整理する。全体目標と全体E2Eは未完了。

SelectionRectangleへ矩形選択session・preview・確定振分け・resetを集約。appのsession変数を除去し、通常／SketchProjectionの経路、追加選択、3px閾値、方向別判定を維持した。描画は座標とcrossingだけを照会し、図形種ごとの選択適用は既存処理へ委譲。構文259件・単体526件・Block／統合UI／保存互換／SketchProjection E2E162件が成功。app.jsは17,309行。次はselectByRectの候補照会と選択適用の境界を整理する。全体目標と全体E2Eは未完了。

AnnotationDragへ注記ドラッグのsession・開始座標・ID再解決・更新・確定・resetを集約。appのsession変数を除去し、入力はactive照会と操作API、診断はinspectの値で接続。Leaderの終点／折れ点／文字位置とFree Textの移動規則、確定時の履歴通知を維持。構文257件・単体522件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,340行。次は選択矩形の開始・更新・確定と選択判定の境界を整理する。全体目標と全体E2Eは未完了。

ReferenceImageInteractionへ画像ドラッグ・2点縮尺校正のsessionと開始・更新・確定・取消・resetを集約。appの2つのsession変数と直接書換えを除去し、入力は操作API、描画は校正点の照会で接続。移動閾値、1点目を維持する回転画像の校正、不正入力の再試行と履歴時機を維持。構文255件・単体519件・参照画像／Block／統合UI／保存互換E2E153件が成功。app.jsは17,391行。次は注記ドラッグと選択矩形など残る入力sessionの所有者を整理する。全体目標と全体E2Eは未完了。

SketchDeletionCommandへ削除範囲・外部参照検査・確認・寸法symbolガード・削除適用と通知順序を集約。scopeは呼出しごとに取得し、cache・解析・UIは所有者へ通知する。旧SketchProjectionConstraintによる子孫保持と親変更を維持し、仕様書に既存例外を明記。構文253件・単体514件・Block／統合UI／保存互換／SketchProjection E2E162件が成功。app.jsは17,485行。次は操作解除に残るドラッグ・選択矩形・画像操作sessionの所有者を調べ、状態と更新処理をまとめる。全体目標と全体E2Eは未完了。

SketchCommandへSketch作成・切替・名前変更・表示切替と命名規則を集約。scopeを操作ごとに取得し、ID採番・入力・操作解除・UI・履歴は明示依存とした。復元後の操作解除には多数の未分離状態が残るため、setterを増やす抽出を避け、解除を利用する操作単位から整理した。構文251件・単体510件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,565行。次は共通操作解除の状態所有者とSketch削除の参照検査・モデル更新を確認する。全体目標と全体E2Eは未完了。

HistoryControllerへDocument／Block履歴の選択・記録・reset・Undo／Redo振分けと復元中状態を集約。appの共有historyRestoring変数を除去し、復元時の再記録抑止・finally通知を共通化した。具体的な復元とDOM・計測は明示adapterとして残る。構文249件・単体506件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,639行。次はDocument読込／Block差替え後の操作解除・求解・表示更新と履歴UIの境界を調べる。全体目標と全体E2Eは未完了。

BlockHistorySnapshotへBlock履歴の復元用コピーとsignature生成を分離。session・DOM・履歴stackへの依存を持たず、定義とclone／拘束codecから生成する。旧signature関数の本体一致、コピーの独立性、参照metadata・採番値と差分判定を検証。構文248件・単体503件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,652行。次はDocument／Block共通の履歴復元中状態と復元・UI通知の所有者を整理する。全体目標と全体E2Eは未完了。

ConstraintRebindingへBlock拘束の複製と保存済み固定座標の移動を統合。BlockDefinitionEditingへcloneForBlockを直接渡し、appの複製実装への逆依存を除去。クリップボードも同じ固定座標移動を利用する。寸法表示位置・参照metadata・復元不能時の拒否を維持。構文247件・単体501件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,697行。次はBlock履歴snapshotの生成・復元とUI通知の境界を整理する。全体目標と全体E2Eは未完了。

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

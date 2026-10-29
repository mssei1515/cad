# Jot2D リファクタリング方針と再開手順

この文書は、会話やクレジットの継続に依存せず作業を再開するための入口である。ユーザーと合意した方針、未完了の範囲、次の判断基準を保持する。変更履歴は[composition-root.md](composition-root.md)、現在の配置は[implementation-map.md](implementation-map.md)、正式な内部設計は[モジュール構成](../../spec/architecture/モジュール構成.md)を参照する。

## 1. 合意した目的

`app.js`を、UI・モデル・操作状態・描画・保存読込を直接実装する巨大なモジュールから、各機能を生成し、依存関係を接続して起動する側へ近づける。最終的には数百行程度（目安200〜500行）を目指す。

ただし、行数を達成するために巨大な別ファイルへ移したり、細かい関数ファイルを大量に作ったりしない。保守・機能追加・テストがしやすい責務境界を優先する。必要な接続が残る場合は理由を説明し、目標達成を装わない。現在の途中成果をもって全体完了とはしない。

ユーザーは長時間の段階的な実装を許可している。「無理に終わらせる必要はない」「今後の開発に過不足なく良い単位で分離する」が最新方針であり、残りクレジットに合わせて設計を急いだり、分離数を固定したりしない。

2026-10-16の目標再開指示に従い、週枠の残量が50%を下回った時点で新たな分離を停止する。残量はusage toolの100−usedPercentとして確認する。検証・Commit・Push・main反映の余裕を確保する。停止時は検証・Commit・Pushを済ませ、developの後にmainへ反映して同期する。全体目標や責務境界を縮小しない。

## 2. 維持するもの

- UI、操作手順、計算結果、モード遷移、取消、Undo／Redoと履歴のまとまり。
- `.jot2d`の保存形式、過去データの移行、IDと投影参照、Blockの親子関係。
- 既存GeometryのObject同一性、参照を張り直す時機、cache無効化、Solver失敗時の復元範囲。
- 現在のテストが保証する挙動。テストを通すために期待値を都合よく変えない。

仕様変更が必要ならAGENTS.mdに従ってユーザーへ確認する。明らかなバグは既存仕様の範囲で修正できる。以前のSolver修正・Offset問題の対応履歴と、今回の純粋な責務分離を混同しない。

## 3. 責務と配置の基準

| 場所 | 主な責務 | 持ち込まないもの |
| --- | --- | --- |
| `src/document/` | Documentの値、外観、階層、順序、定義の照会 | DOM、イベント、操作中の一時状態 |
| `src/geometry/` | 幾何計算、参照、投影と読取り | UI、履歴、操作の開始／終了 |
| `src/constraints/`・`src/solver/` | 拘束の照会・再接続・求解と数値的な再試行方針 | DOM更新、入力イベント、履歴確定 |
| `src/editing/` | 編集scope、Selection、session、snapshot復元、モデル編集 | DOM入力の解釈、Canvas命令 |
| `src/commands/` | 一つのユーザー操作の開始・検証・確定・取消、必要な求解・履歴の調整 | アプリ全体を自由に操作できるcontext |
| `src/ui/` | 表示情報のHTML化、DOM更新、入力解釈、操作への通知 | モデルやsessionへの無断の直接書込み |
| `src/rendering/` | 解決済み情報の描画、Canvas状態の管理 | Document編集、履歴、コマンドの確定 |
| `src/persistence/` | 保存・読込候補の生成、形式検査、互換性、ファイルsession | 編集中モデルの無条件な破壊、UIの直接操作 |
| `src/parameters/` | Parameter名前空間、評価、依存と適用 | 任意のUI／アプリglobal |
| `src/diagnostics/` | 診断・計測と描画の観測 | 通常機能を代わりに所有する実装 |
| `src/testing/` | ブラウザテストの準備・状態照会・シナリオ支援 | 通常機能の所有、アプリ全体の可変context |
| `src/application/` | 機能単位の生成・接続と狭い公開API | 巨大なapp context、モデル編集やDOM表示の再実装 |
| `app.js` | 構築・接続・起動。移行中は未分離の責務も残る | 最終形での機能実装の集中 |

この表は、既存フォルダを生かす基本方針である。新しい上位の機能組立てモジュールが必要なら、実際の依存を見て導入する。最初から固定の階層を押しつけず、`app.js`をそのまま移した別の巨大な組立てモジュールも作らない。

## 4. 分離を採用する判断基準

1. **状態と更新を同じ所有者へ集める。** 変数だけを移してsetterを増やすのでなく、開始・更新・確定・取消・resetを関連する責務でまとめる。
2. **UIからは操作として依頼する。** 値の照会とモデルの変更を区別し、表示コードがDocumentやsessionを直接変更しないようにする。
3. **依存を明示する。** 現在scopeの取得、必要な照会、編集操作、通知などを限定した引数で受け取る。`app`や巨大なcontextを渡さない。静的な型・codec等への依存と、実行時に変わるscopeへの依存を区別する。
4. **既存の所有者を利用する。** 同じ責務なら既存モジュールへ統合する。ファイルを作ること自体を目的にしない。
5. **振る舞いの境界でテストできること。** 状態遷移、拒否時の無変更、求解失敗の復元、参照同一性、保存互換性を検証する。関数の場所や内部名だけを固定するテストは増やさない。
6. **依存が減ったか確認する。** コールバックが過剰になったら、境界の切り方や残る共通状態を再検討する。状態の循環参照を隠すためだけのadapterを恒久設計にしない。

実行順序を保つための一時的なadapterは許容するが、残っている理由と次の分離先を記録する。従来のclassic script／namespace方式は維持しており、現段階ではES Modulesやビルド方式変更を同時に進めない。

## 5. 現在地と残作業

2026-10-29の最新単位ではapp.jsは2,135行、非空白1,684行、root直下471文、条件付きtest hooks351行。可変参照は三つで、最新の検証と次候補はsection 8の再開記録を参照する。全体目標はactive・未完了である。

前回2026-10-24の停止時点（develop e84648b）ではapp.jsは2,208行、非空白1,756行、root493文、条件付きtest hooks362行。rootの可変参照は五つで、最新の監査と再開候補はsection 8の停止地点を参照する。目安200〜500行には未到達である。

前回2026-10-21の再監査基準（develop caf19a0）ではapp.jsは2,924行。非空白2,433行のうち、create系構築・接続1,266行、条件付きtest hooks438行、call一文の関数237行。root構築209文・複文callback30個・root let8個を確認した。旧46dd77dを同条件で再現して比較した。現状owner、初期化順と次の実装単位は[composition root再監査](bootstrap-boundary-audit.md)とsection 8を参照する。全てを単純な移動・削除対象とは扱わない。

Document／Workspace、Geometry read、solver・constraint、command／session、描画、UI、保存読込の各ownerは分離済み。appには依存の構築・接続と操作固有のcallbackが残る。modeはDrawOperationLifecycle、最後の生pointerはPointerInteractionControllerのsessionへ移管した。同期済みmodel別名とSolverの接続・scope切替手順はEditingScopeBindingへ移管した。現在のletは三つの後段接続参照だけ。後段接続は操作stateの重複とは区別する。

残る中心は、既存ownerを用いる機能単位の組立て、残る更新責務とownerの整合、初期化とbind／startの段階、test hooksの公開境界である。modeは複数のcommandとtestから更新されるため、既存Lifecycleの遷移APIと同じsessionで所有する。Document固定参照と現在Block scope参照、取消・reset・復元の違いを維持する。

最後の性能traceは生成ownerのConstraintCommitCommandへ、参照を外す注記コピーの表示値変換は既存ClipboardTransferへ統合済み。共有外観UIの組立てはAppearanceUIへ集約した。PropertiesのController／Viewの結線は既存PropertiesDisplayへ集約した。Canvas context menuの操作結線はCanvasContextInteractionへ集約した。拘束・寸法開始準備はDrawOperationLifecycle、角度間隔寸法開始はDimensionPlacementCommandへ統合した。Geometry削除時の操作終了はGeometryDeletionCommandへ統合した。拘束の共有装飾と保存metadataはConstraintPersistenceへ統合した。Annotation Parameter候補の読取り検証はParameterNamespaceへ統合した。Canvas描画診断groupの五部品の組立ては既存CanvasRenderTestDriverへ集約した。Canvas pressの選択事前処理も同じCanvasSelectionInteractionへ統合した。Canvasの表示座標・navigation・surface等はCanvasDisplayへ二段階で集約した。command panel／PNGと通常pointerの入力振分けは既存CanvasInputBindingへ統合した。五つのcommand inputの組立てはCanvasCommandInputsへ集約した。press／hoverの共通hit queryと注記interaction hitはCanvasHitInteractionへ集約した。最新の構築依存再監査を終え、特殊寸法callbackは既存DimensionValueCommandへ統合した。PointUsageを描画側へ共有して依存を削減した。command targets／Sketch styleも描画側へ共有した。Geometry描画群の組立てはGeometryDisplayへ集約した。通常content／export／interactive描画の接続は既存CanvasDisplay.createRenderingへ集約した。通常矩形選択の適用はCanvasSelectionInteractionへ集約した。Instance参照元の矩形追加はInstanceCommandInputへ集約した。固定拘束の三照会はConstraintReferencesへ集約した。拘束所属付与・モデル挿入はConstraintCommitCommandへ集約した。operandのSketch関係はSketchContextへ集約した。Hatchの既存content／Layerを包むだけの分割は見送る。小関数の移動だけで数百行へ届くとは見積もらない。

各区切りの履歴・検証は[composition-root.md](composition-root.md)、現在の配置は[implementation-map.md](implementation-map.md)へ記録する。順番・file数・task数を固定せず、再監査の結果から次の責務境界を選ぶ。200〜500行の目標、UI・挙動・互換性・状態owner・全体検証を維持し、現在の中間成果で全体完了とはしない。

## 6. 実装・検証・履歴の進め方

- サブエージェントは使わない（ユーザーの明示指示）。
- 2026-10-16の目標再開指示により停止条件は週枠残量50%未満。以前の70%／60%／尽きる前の条件は過去の記録として扱う。停止時の最後のコミットをmainへマージする指示も受領。残量はusage toolで確認し、リリース時はdevelop先行・main最後・両ブランチ同期の手順を守る。
- 開始時にAGENTS.md、Gitのbranch／status、関連仕様・テストを確認する。既存の無関係な変更を混ぜない。
- 責務としてまとまった単位で実装し、差分を確認し、関連仕様を更新して検証・Commit・Pushする。将来の原因調査で区切りを追える履歴を残す。
- 構文は`npm run check`、単体は`npm run test:unit`。関連E2Eを実施し、全体完了前には全体E2Eも確認する。
- `.test.js`の変更は分離した責務の境界検証や読込一覧の更新に必要な範囲とする。テストの整備だけで分離が進んだことにはしない。
- 新module追加時は`index.html`、`tools/check-syntax.js`、必要なら`tools/run-unit-tests.js`の明示的な単体一覧、`tests/e2e/unified-ui.spec.js`の読込順期待を更新する。script順とapp内の初期化順の両方を確認する。factoryへ渡す各portについて、後で初期化されるconst／letの直接捕捉がないか確認し、従来どおり操作時に読む入口はgetter／委譲callbackで接続する。
- E2E実行中にアプリのソースを変更しない。長時間のテストは同じprocess/sessionを追跡し、出力待ちのtimeoutだけで再起動しない。
- 過去の「今回はテストをスキップ」はその時点だけの許可。今後の常時スキップには引き継がない。
- originは`https://github.com/mssei1515/cad`。通常の作業branchとdevelopへのPushは継続許可がある。最新developからcodex/*の作業branchを作成し、現在のbranchはsection 8とGitで確認する。統合・検証・Push後は取り込みを確認して作業branchを整理し、未統合・調査中のbranchは保持する。
- 通常は作業branchで進める。停止時にこの区切りをdevelop／mainへ統合し、mainを最後に反映する。各抽出の途中では自動リリースしない。
- Commit後には`npm run write:runtime-version`を実行する。生成物はGitに含めない。

2026-10-02、コードcommit `4ead051`に対する全E2E327件が成功した（19.5分、exit 0）。構文347件・単体785件も同じコードで成功済み。全体リファクタリングの完成とは区別し、以後コードを変更した場合は変更に応じて再検証する。Offset問題の過去の判断・修正は履歴に残っているため、古い進捗記録の「未回答」だけを根拠に同じ質問や修正をやり直さない。

## 7. 全体の完了条件

責務が複数ファイルになっただけでは完了としない。以下を現物で確認する。

- `app.js`が主に機能の生成・接続・起動を担い、数百行程度という目標に照らして説明できる構成になっている。
- 状態の所有者と更新APIが明確で、元のglobal依存が別ファイルに移っただけではない。
- UI・動作・保存互換性が維持され、既存テストと必要な全体検証が通っている。
- 仕様と実装配置が一致し、未解決の不具合・未検証項目を隠していない。
- 差分確認、Commit、許可された範囲のPush、実行コミット情報更新が済んでいる。

## 8. 再開地点（2026-10-29）

### 最新：寸法ラベルと描画を同じScene依存から生成（2026-10-29、検証完了）

基準develop／origin/developはe3dd458。本単位はcodex/dimension-scene-compositionで実施した。既存DimensionDisplay.createForSceneが、同じ寸法外観owner／SketchContextを使って実DimensionPresentation label API→従来のDimensionDisplay APIを生成し、その実体をfrozen bundleとして返す。NumberDisplayとDimensionQueriesの静的な書式／測定APIも同じmoduleから接続する。元のDimensionDisplay.createと各描画／入力／Traversal／PreviewのAPIは維持し、新しい状態やsetterを持たない。

app.jsは2,139→2,135行（4行減）、非空白1,684行、root直下473→471文・関数120→119個、test hooks351行。対象の二factoryのroot引数15→8。状態を読まないラベル生成だけを早期から既存描画生成位置へ遅らせ、最初のconsumerより前に実labelを直接捕捉した。不要なmeasuredDimensionValue取込とrootのlabel転送関数を除き、root未使用binding 0。TEMP cad-dimension-scene-composition-proof.cjsで全十五portの対応、直接labelの初期化順、他のappと既存DimensionDisplay全体のAST不変、raw DimensionPresentation／NumberDisplay／DimensionQueries／AppearanceQuery四moduleの不変を確認した。label→描画本体の相対生成順は維持し、model・外観・Canvasの読取りは実行時に行う。

dimension-display.test.jsへ二つの境界試験を追加した。実外観query／Placement／Layout／Painterとlabelを使い、生成時の照会なし、現在Sketch・外観のprefix／precision／suffix・色とextension overshootが同じownerへ追従すること、同じPoint参照・Canvas状態の復元、外観例外の伝播と図形／寸法の無変更、解決済み外観を渡す経路を検証した。既存fixtureの生成だけを任意差替え可能にし、既存期待値は変更しない。関連単体21件・全単体2,007件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapも更新し、mapの旧hoisted label説明を直接接続へ修正した。

関連E2E187件が全成功（2.7分、exit 0、runner13712）。既存UI、複数寸法、dimension prefix、Slot寸法、Block、非表示可視性、phase0保存互換性／描画比較、注記表示寸法を実行した。TEMP cad-dimension-scene-composition-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server32980停止とsource二つのhash不変を確認した。今回は関連187件であり、最新コード全体のE2Eとは扱わない。UI・数値書式・寸法／描画計算・保存形式・性能上限／timeout・既存期待値は変更しない。

週枠使用16%／残量84%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。Canvas表示controlsは既に自身の状態とbind段階を持つため、別のfactory一覧へ包み直さず、本単位は同じSketch／外観を共有する寸法生成を選んだ。次も実ownerの共有と純粋な生成／起動の順序を監査し、巨大contextやsetterで初期化循環を隠さない。200〜500行の全体目標は未達であり、現在の中間成果で完了扱いにしない。

### 最新：注記の参照先照会をAnnotation機能から生成（2026-10-29、検証完了）

基準develop／origin/developはeaca5c4。本単位はcodex/annotation-anchor-compositionで実施した。既存AnnotationFeature.createAnchorQueryへSketchContext・GeometryReadServices・PointUsage・Selection・遅延viewportScaleを渡し、実AnnotationAnchorQueryを生成する。Geometry解決・可視性・点利用とSketch関係は同じ実ownerから捕捉し、raw queryへ渡すgeometryは従来の五readerに限定する。生成は従来の早期位置を維持し、まだ存在しないViewport・現在scope・Selectionを照会しない。後段の描画／編集commandへ渡す実queryのmethodと、既存の個別factoryを維持する。

app.jsは2,142→2,139行（3行減）、非空白1,689行、root直下473文・関数120個、test hooks351行。rootの照会生成port12→5。不要になったPointUsageの取込二つも除き、root未使用binding 0を確認した。TEMP cad-annotation-anchor-composition-proof.cjsでroot／localのreadonly ownerとmethodの参照元を辿り、十二portとgeometry五readerの対応、他のapp全体／初期化順と既存AnnotationFeature全体のAST不変、raw AnnotationAnchorQuery・GeometryReadServices・AppearanceQuery三moduleの不変を確認した。新しいAnnotation・Selection・cache・mutable contextを追加しない。

annotation-anchor-query.test.jsへ実AnnotationAnchorQueryとGeometry型を使う二つの境界試験を追加した。生成時の照会なし、操作時の倍率／可視性／PointUsage・active Sketch／参照可能性とSelection、Geometry reader交換、geometryRefと参照同一性、anchorの再解決と元のstartへのfallback、照会例外時の配列と要素の無変更を確認した。既存の期待値は変更しない。関連単体20件・全単体2,005件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapも更新した。

関連E2E268件が全成功（4.3分、exit 0、runner22594）。既存UI、注記、Annotation anchors、leader外観、自由テキスト式／drag、Spline、phase0保存互換性／描画比較、Blockを実行した。TEMP cad-annotation-anchor-composition-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server11456停止とsource二つのhash不変を確認した。今回は関連268件であり、最新コード全体のE2Eとは扱わない。UI・照会順と計算・保存形式・性能上限／timeout・既存期待値は変更しない。

週枠使用15%／残量85%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。引き続き、機能をまたぐ同じownerの重複接続と、appに残す起動順の接続を区別して監査する。通常機能のstateをtestingへ移したり、巨大contextやsetterで初期化循環を隠したりしない。200〜500行の全体目標は未達であり、現在の小さな分離だけで完了扱いにしない。

### 最新：拘束対象とSelectionの接続をSelection機能へ集約（2026-10-29、検証完了）

基準develop／origin/developは2fdfeac。本単位はcodex/constraint-selection-compositionで実施した。CanvasSelectionFeature.createConstraintOperandsが、同じSketchContextで実ConstraintCandidates→ConstraintOperandsを元の順序で生成し、実candidates／operandsとSelection→操作対象・対象session→Selectionの二入口を返す。現在Selectionはfeature内の同じ実体で、外部依存はtargets・pointer・solver・許容誤差の四つに限定した。候補判定と値表現は既存constraints module、対象session・Selection・Pointerの状態は既存ownerに残す。新state・UI／履歴通知・setterを追加しない。

app.jsは2,145→2,142行（3行減）、非空白1,692行、root直下476→473文・関数122→120個、test hooks351行。元の二factoryのroot引数9→4。TEMP cad-constraint-selection-composition-proof.cjsで全生成portの対応、二変換の本体、他のappと従来SelectionFeature全体のAST不変、二つの新しい直接bindingの初期化順、不要になったSketch照会取込二つの削除とroot未使用binding 0、raw candidates／operands／Selection／Pointer四moduleの不変を確認した。ConstraintTargetSessionの早期acceptTarget callbackは従来どおり後段のconstraintOperandValuesを遅延参照する。候補・値のconstは既存callbackで早期捕捉される契約と、新たな変換入口の初期化後の利用を区別して監査した。

canvas-selection-feature.test.jsへ、実Selection／ConstraintTargetSession／Pointer・候補・値を使う二つの境界試験を追加した。生成中のSketch照会やsolver hint読取りなし、選択Point／Arc endpointの参照と重複除外、対象sessionから同じSelectionへの反映、Sketch関係変更と最新PointerによるSpline parameter／endpoint、変換例外時のSelection／対象operand配列不変、UI通知なしを確認した。既存fixtureのSketch読取りだけを任意差替え可能にし、既存期待値は変更しない。関連単体25件・全単体2,003件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapも更新した。

関連E2E248件が全成功（3.8分、exit 0、runner96229）。既存UI、Annotation anchors、対称拘束、Sketch投影、Block、Spline、phase0保存互換性／描画比較、Sketch権限を実行した。TEMP cad-constraint-selection-composition-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server9236停止とsource二つのhash不変を確認した。今回は関連248件であり、最新コード全体のE2Eとは扱わない。UI・状態遷移・保存形式・性能上限／timeout・既存期待値は変更しない。

週枠使用13%／残量87%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。次も拘束・Selection・入力・描画等の共有ownerと構築段階を監査し、domainの値・判定にUIや編集stateを持ち込まない。rootの構築・起動とtest API公開には残作業があり、200〜500行の全体目標を現在の中間成果で達成扱いにしない。

### 最新：Keyboard生成を共有Canvas入力機能へ統合（2026-10-29、検証完了）

基準develop／origin/developはc324732。本単位はcodex/canvas-keyboard-compositionで実施した。既存CanvasCommandInputs.createFeatureのcreateKeyboardから、Pointerと同じmode reader・Geometry Instance・Annotation command／drag・Selection・UI通知を実KeyboardInputへ接続する。Sketch移動・menu・shortcut・text入力判定・固有の確定操作とpending／constraint sessionは後段の明示portに残す。Selection.hasSelectionとInstance参照元command.finishも同じfrozen ownerから捕捉する。生成／startは元の後段のままで、createFeature時にKeyboard生成やstate照会・listener登録を行わない。

app.jsは2,147→2,145行（2行減）、非空白1,695行、root直下476文・関数122個、test hooks351行。Keyboardへのroot引数35→25、共通10portを再利用する。TEMP cad-canvas-keyboard-composition-proof.cjsで全35引数の対応と二method aliasの参照元、他のapp全statement／start順、既存Pointer組立てのAST不変を確認した。KeyboardInput・KeyboardInteractionController・CanvasCommandCancellation三moduleは不変。Escapeは一つずつ優先して取消し、Canvas menuは複数対象を順に取消す既存方針を維持し、両者のcancel実装を共通化しない。新mode・Selection・sessionやmutable contextは追加せず、既存の個別factoryも残す。

canvas-command-inputs.test.jsへ実Annotation／Instance入力・Selection・KeyboardInput／KeyboardInteractionControllerを組み合わせる二つの境界試験を追加した。Pointerで始めた注記handleを同じKeyboardから解除し、同じSelectionも解除できること、同じInstance参照元commandとAnnotationの完了、操作時のpending優先／constraint取消と例外、生成時の照会なし、明示startと重複登録なし、外部listenerを残すdisposeを確認した。取消callbackの引数なしという元の契約も維持する。既存期待値は変更していない。関連単体23件・全単体2,001件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapも更新した。

関連E2E229件が全成功（3.6分、exit 0、runner53671）。既存UI、Sketch移動／編集、Annotation anchors、free Instance、派生pattern、参照画像、command panel、phase0保存互換性／描画比較を実行した。TEMP cad-canvas-keyboard-composition-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server22984停止とsource二つのhash不変を確認した。今回は関連229件であり、最新コード全体のE2Eとは扱わない。UI・入力優先順位・保存形式・性能上限／timeout・既存期待値は変更しない。

週枠使用12%／残量88%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。今回の行数減少は小さいが、入力経路をまたぐ同じownerの重複接続を除いた単位である。次も機能の生成／起動とtest API公開を監査し、巨大contextや汎用setterで循環を隠す変更はしない。200〜500行の全体目標は未達であり、現在の中間成果で完了扱いにしない。

### 最新：入力計測のテストAPIをCanvasTestDriverへ集約（2026-10-29、検証完了）

基準develop／origin/developはd64be0b。本単位はcodex/interaction-profile-test-apiで実施した。既存CanvasTestDriver.createInteractionProfilingへ実ProfilerとPointerMoveSchedulerの二ownerを明示して渡し、計測開始／停止・frame統計reset／取得の四つのブラウザテストAPIをまとめた。appは既存test flag内の最後で生成し、元の公開位置へ展開する。生成はObjectを返すだけで状態を読まない。計測stateと入力queue／coalescingは従来の診断／UI ownerに残し、新session・globalや通常機能の移管を行わない。

app.jsは2,158→2,147行（11行減）、非空白1,697行、root直下476文・関数122個、installTestHooksは362→351行。TEMP cad-interaction-profile-test-api-proof.cjsでowner名とflush aliasを対応させた四method本体のAST不変、test flag・他のapp全体・公開property順、既存CanvasTestDriver全体と生Profiler／Scheduler二moduleの不変を確認した。startのflush→Profiler.start、停止と統計の戻り値、flush例外でstartしない手順を維持する。巨大な公開API Objectをcontext付きで丸ごと移す構成にはしない。

canvas-test-driver.test.jsへ実InteractionProfiler／PointerMoveSchedulerを使う二つの境界試験を追加した。計測開始前の保留入力を新profileへ混ぜないこと、frame id 0の取消、同じqueueのcoalescing／draw統計と最新pointer、停止結果と再停止時null、flush失敗では既存profileを失わず新しい計測を始めないことを確認した。既存の期待値は変更していない。関連単体20件・全単体1,999件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapも更新した。

関連E2E136件が全成功（2.5分、exit 0、runner68648）。四APIの全E2E利用元であるadversarial-authoring-performanceと、既存UI、phase0保存互換性／描画比較を実行した。TEMP cad-interaction-profile-test-api-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server37564停止とsource二つのhash不変を確認した。今回は関連136件であり、最新コード全体のE2Eとは扱わない。UI・保存形式・診断集計・性能上限／timeout・既存期待値は変更しない。

週枠使用11%／残量89%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。今後もtest APIは同じowner／寿命を使う支援role単位で整理し、通常機能のstateやモデル編集の本体をtestingへ移さない。rootの構築・起動の依存も引き続き監査し、200〜500行の未達を転送や公開aliasの整理だけで完了扱いにしない。

### 最新：描画範囲を合わせる操作をCanvasDisplayへ統合（2026-10-29、検証完了）

基準develop／origin/developは7abf6d1。本単位はcodex/canvas-drawing-fitで実施した。既存CanvasDisplay.createが返すcreateDrawingFitへDrawingBoundsとactive Sketch readerを接続し、Sketch／全図形／可視図形の範囲を同じViewportへ合わせる三つの実処理を集約した。境界の計算はDrawingBounds、倍率制限・中心配置はCanvasViewportのままで、旧三関数の本体と引数既定値をそのまま移した。appはDrawingBounds生成後に機能を生成し、早期CanvasNavigationへ渡す可視図形用の入口だけをhoisted委譲として残す。追加のmutable slot・setter・描画／履歴通知を作らない。

app.jsは2,164→2,158行（6行減）、非空白1,708行、root直下476文、root関数124→122個。TEMP cad-canvas-drawing-fit-proof.cjsで三関数全体のAST不変、従来のCanvasDisplay処理と他のapp全statementの不変、Viewport／DrawingBounds／CanvasNavigation三moduleの不変、二つの直接bindingが初期化後にだけ使われることを確認した。新機能の生成では既存frozen APIのmethodを捕捉するだけで、境界・現在Sketch・Canvasサイズを照会しない。

canvas-display.test.jsへ二つの境界試験を追加した。実Viewportで生成時の照会／変更なし、active Sketchと境界の操作時読取り、既定余白96と明示余白、全図形／可視図形の区別、空境界のfalseと無変更、倍率制限と中心座標、fit自体が描画／hintを行わないことを確認した。実CanvasNavigationから同じfitへ遅延接続し、二回目の中ボタン入力でだけfit→hint→drawとなること、照会例外ではViewportを変えず描画しないことも検証した。既存fixtureのfit callbackだけを任意差替え可能にし、期待値は変更しない。関連単体22件・全単体1,997件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapも更新した。

関連E2E194件が全成功（2.8分、exit 0、runner27486）。既存UI、phase0保存互換性／描画比較、Block、file safety、Canvas zoom入力、選択／zoom／shadow、非表示可視性、PNG出力を実行した。TEMP cad-canvas-drawing-fit-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server31876停止とsource二つのhash不変を確認した。今回は関連194件であり、最新コード全体のE2Eとは扱わない。UI・保存形式・可視性・性能上限／timeout・既存期待値は変更しない。

週枠使用10%／残量90%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。境界照会とヒット照会も監査したが、読取りserviceへ編集やViewport変更を持ち込まず、今回の表示範囲操作はCanvas機能の所有とした。次も共有する実ownerと生成段階を基準に構築・起動とtest API公開を整理する。三つのroot nullable参照と必要な遅延委譲を一括setterで隠さず、200〜500行の未達を小さな削減だけで完了扱いにしない。

### 最新：履歴操作を実コントローラーへ直接接続（2026-10-29、検証完了）

基準develop／origin/developは7b48e07。本単位はcodex/history-operation-bindingsで実施した。HistoryController.createFeatureのcaptureDocumentとcontrollerのactive／resetBlock／resetDocument／undo／redoを生成直後かつ全consumerの前に捕捉し、六つのroot転送関数を除いた。同じ実closureを共有し、現在Block履歴の動的な選択、Documentを明示的に初期化する対象、label既定値initial、Undo／Redoの引数非依存、戻り値と例外・通知順は維持する。早期Block構築から渡すcreateBlockEditHistoryとrecordHistory、History生成後のToolbarへ通知するupdateHistoryButtonsは必要なhoisted委譲として残した。

app.jsは2,178→2,164行（14行減）、非空白1,714行、root直下481→476文、root関数130→124個。TEMP cad-history-operation-bindings-proof.cjsで六bindingが不変で全参照が初期化後であること、引数と既定値の一致、実methodのreceiver／arguments非依存、他のapp全statementのASTとHistoryController moduleの不変を確認した。新たな履歴stack・復元flag・scope snapshotやglobalは追加しない。直接接続へ置換する単位であり、初期化順のために必要な委譲を一律に消さない。

関連単体28件・全単体1,995件・構文618ファイルが成功（exit 0）。EditHistory、HistoryRestoration、PresentationFeatureの既存検証を実行した。単なる接続位置を固定する新テストや既存期待値の変更は加えていない。モジュール構成とimplementation-mapへ直接接続と残す早期委譲を記録した。

関連E2E198件が全成功（3.4分、exit 0、runner2536）。既存UI、Block編集、phase0保存互換性／描画比較、file safety、Parameter dialog、Sketch編集／移動、adversarial-authoring-performanceを実行し、高密度図面のUndo／Redoも元の性能上限で成功した。TEMP cad-history-operation-bindings-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server7356停止とapp hash不変を確認した。今回の関連198件は最新コード全体のE2Eとは区別する。UI・保存形式・性能上限／timeout・テスト期待値は変更していない。

週枠使用10%／残量90%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。次も残る機能の構築・起動とtest API公開の境界を監査する。直接接続可能なquery／commandでも初期化順・receiver・引数加工を個別に検証し、stateful ownerを別のmutable contextで隠さない。数百行の全体目標は未達であり、転送整理だけで達成したとは扱わない。

### 最新：外観・描画照会を実ownerから直接接続（2026-10-29、検証完了）

基準develop／origin/developは7e13172。本単位はcodex/appearance-query-bindingsで実施した。GeometryReadServicesのGeometry／Dimension／Annotation外観とGeometryPresentationのcommand targets／Sketch styleが返す十二の実照会を、生成後かつ最初のconsumerより前に捕捉し、同名のroot転送関数を削除した。対象methodはfrozen ownerのclosureでreceiver／arguments objectに依存しない。生成時には照会を実行せず、現在scope・表示設定・cache・mode・Panel選択を操作時に読む構造は維持する。初期化順のために残る遅延委譲へ一律に適用しない。

app.jsは2,185→2,178行（7行減）、非空白1,728行、root直下488→481文、root関数142→130個。TEMP cad-appearance-query-bindings-proof.cjsで十二bindingの不変性と全参照が初期化後であること、他のapp全statementのAST不変、実照会methodにthis／arguments依存がなく元moduleが不変であることを確認した。新しい機能・state・global・context・adapterを追加しない。既存の所有者とconsumerを直結し、不要なhoisted転送の層を除く単位であり、機能そのものを新fileへ分割したとは扱わない。

関連単体59件・全単体1,995件・構文618ファイルが成功（exit 0）。既存の外観、GeometryReadServices、GeometryPresentation、GeometryDisplay、DocumentWorkspaceの検証を実行した。この低影響の接続整理だけを固定する新テストや、既存期待値の変更は加えていない。モジュール構成とimplementation-mapへ直接接続と遅延readerの区別を記録した。

関連E2E212件が全成功（3.2分、exit 0、runner84366）。既存UI、非表示可視性、注記、leader外観、注記表示寸法、phase0保存互換性／描画比較、PNG出力、Hatch、Sketch投影を実行した。非表示Block内部Sketchの中心線を外側で隠す既存回帰も含む。TEMP cad-appearance-query-bindings-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server28096停止とapp hash不変を確認した。今回は関連212件であり、最新コードの全体E2Eとは扱わない。UI・保存形式・性能上限／timeout・テスト期待値は変更していない。

週枠使用9%／残量91%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。残るquery・commandの一文委譲にも直接接続可能なものがあるが、owner生成時機、receiver、引数加工と部分的構築の契約を個別に確認する。200〜500行の全体目標は未達であり、小さな転送整理だけで届くとは扱わない。次も機能単位の構築・起動とtest API公開の境界を監査する。

### 最新：トリム生成を共有作図機能へ統合（2026-10-29、検証完了）

基準develop／origin/developは9fa6827。本単位はcodex/trim-authoring-compositionで実施した。既存BasicDrawingTools.createAuthoringへcreateTrimを追加し、同じ現在scope・Geometry・SketchContext・PointUsage・最小長さ・倍率・preview・UI／履歴通知を実TrimFeatureへ接続する。appに残すのは参照照会、専用checkpoint、hit照会／編集・投影権限、Parameter安定化／許容誤差と分析更新の九依存。primitive作図用のcheckpointとトリム用Geometry checkpointは別のまま、生成位置は従来の後段を保持する。Trimのquery／編集／commandや既存作図の実装は変更せず、新session・mutable context・listenerは追加しない。

app.jsは2,189→2,185行（4行減）、非空白1,735行。対象root引数27→9。TEMP cad-trim-authoring-composition-proof.cjsで全引数の対応、元のapp全体の他statementと構築位置、既存BasicDrawingTools全体のAST、raw Trim四moduleの不変を確認した。倍率は従来と同じviewport.scaleを操作時に読み、scopeも動的な同じWorkspace readerを使う。今回の小さな削減をもって数百行の目標達成とは扱わない。

trim-feature.test.jsのfixtureに任意生成入口を加え、実TrimQuery／TrimEditing／TrimCommandとGeometry・ID・checkpointを使う二つの境界試験を追加した。他の作図constructorだけを非稼働にし、生成時のscope照会なし、倍率／scope交換への追従、拘束参照の引継ぎ、成功時のSelection／preview解除と履歴、失敗時の同じPoint・配列内容・ID復元と履歴なし、primitive用checkpointを誤用しないことを確認した。既存期待値は変更していない。関連単体28件・全単体1,995件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapも更新した。

関連E2E205件が全成功（2.9分、exit 0、runner69494）。既存UI、phase0保存互換性／描画比較、Sketch権限、Block、Hatch、円弧作図、中心線、Splineを実行した。加えてadversarial-authoring-performance全12件が成功（46.7秒、exit 0、runner94100）し、高密度図面のトリム／Fillet／Offsetを含む入力性能を確認した。合計217件は関連検証であり、最新コード全体のE2Eとは区別する。TEMP cad-trim-authoring-composition-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、performance-run.ps1、通常／performanceのe2e-receipt.jsonとlast-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。両receipt exitCode 0／listeners 0、両last-run passed／failedTests空、自己起動server13404／29820停止とsource二つのhash不変を確認した。UI・保存形式・性能上限／timeout・テスト期待値は変えていない。

週枠使用9%／残量91%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。rootに残る実装の大半は一文委譲と構築・接続であり、最大の残る関数は362行のテストAPI組立てである。引き続き機能の起動段階と所有者の境界を監査し、API全体を巨大context付きで別fileへ移すだけの変更は行わない。残る三つのnullable参照の初期化順を維持する。

### 最新：Toolbar表示と入力の共有依存を同じ機能から接続（2026-10-29、検証完了）

基準develop／origin/developは8e415b6。本単位はcodex/toolbar-input-compositionで実施した。既存PresentationFeature.createToolbarからcreateEditingBinding／createDrawingBindingを返し、Toolbar表示と同じDocument・DrawOperationLifecycle・ConstructionCommand・Geometry mode判定・UI通知を既存ToolbarViewの実bindingへ接続する。appは専用操作だけを追加で渡し、編集入力／作図入力の生成とbindは元の別々の位置に残す。新しいsession・listener・可変contextは追加しない。低水準factoryと独立したdisposeも維持する。

app.jsは2,190→2,189行（1行減）、非空白1,739行。対象の延べroot引数21→14。TEMP cad-toolbar-input-composition-proof.cjsで全引数の対応、既存Presentation処理とraw ToolbarView moduleの不変、他のapp全体のASTとbind順の不変を確認した。元の共有ownerの捕捉を再利用し、earlyな生成段階でDOM／操作stateを読まない。行数の削減自体は小さく、数百行へ進めるには残る機能の初期化段階とテストAPIの組立てを引き続き監査する必要がある。

presentation-feature.test.jsへ実ToolbarView／Lifecycle sessionを使う二つの境界試験を追加した。入力生成時の登録なし、別々のbind時機と重複防止、クリックによる同じmodeの表示反映、native handler receiver、共有Construction command、独立したdispose、削除のGeometry mode短絡と成功時だけのUI→描画、失敗時の例外伝播を確認した。既存の期待値は変更していない。関連単体30件・全単体1,993件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapも更新した。

関連E2E232件が全成功（3.3分、exit 0、runner55946）。既存UI、Toolbar layout、phase0保存互換性／描画比較、注記、Sketch投影、Hatch、中心線、円弧作図、Block、Flyout、メニューを実行した。TEMP cad-toolbar-input-composition-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server29324停止とsource二つのhash不変を確認した。今回の関連232件を最新コードの全体E2Eとは扱わない。UI・保存形式・性能上限／timeoutは変更していない。

週枠使用8%／残量92%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を維持する。残る三つのnullable参照は初期化順を保持しており、setterで循環を隠す変更はしない。次は機能単位の起動段階と実行時依存を監査し、既存ownerを包むだけの再分割や巨大contextへ集約する変更は避ける。

### 最新：Sketch移動commandと移動中のTree入力を同じ機能から生成（2026-10-29、検証完了）

基準develop／origin/developは1f99364。本単位はcodex/sketch-move-input-compositionで実施した。既存SketchEditingFeature.createMoveWithInputがcreateMoveで作った実際のcommandと、そのactive状態を読むSketchTreeController.createMoveInputBindingを組み合わせて返す。appは同じ位置でcommandを既存の後段参照へ公開してから入力をbindする。既存createMoveの単独利用と任意のrefresh差替えは残す。移動先選択のdraft／モデル編集／履歴は既存command、listenerは既存bindingが所有し、active値のコピーや新しいmutable stateを加えない。

app.jsは2,190→2,190行（0行変化）。対象生成2→1、延べroot引数8→7。TEMP cad-sketch-move-input-composition-proof.cjsで既存の三factory、raw command／入力module、元の六move portとdocumentの不変、command公開後にbindする順序、root未使用binding 0を確認した。入力factoryは生成中にlistenerやscopeを読まない既存の形を保つ。中間のreadonly command参照は、既存nullable参照への公開をbind前に保つための接続であり、別のcommandやoperation stateではない。line削減ではなく、移動と専用入力の組合せを一つの所有者へ揃える単位とした。

sketch-editing-feature.test.jsへ二つの境界試験を追加。実際の移動commandを使い、生成時の登録なし、六種eventの同じcapture登録、Tree内許容とTree外抑止、確定後の解除と同じPoint参照、scope交換での解除、同じhandlerのdispose、入力bind例外後もcommandが利用できることを確認した。既存fixtureのmove生成だけを任意差替え可能にし、既存期待値は変えていない。関連単体11件・全単体1,991件・構文618ファイルが成功（exit 0）。モジュール構成とimplementation-mapへ責務と初期化順を記録した。

関連E2E237件が全成功（3.3分、exit 0、runner43591）。Sketch移動／編集／権限／Tree可視性／Tree削除／投影、Block、既存UI、phase0保存互換性／描画比較、command panelを実行した。TEMP cad-sketch-move-input-composition-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server17636停止とsource二つのhash不変を確認した。今回は関連237件であり、前回の全体587件成功を現在の全体結果とは扱わない。UI操作・保存形式・性能上限／timeout・既存期待値は変更していない。

Sketchの早期scope接続は未生成menu／移動commandを許容する既存の順序を持つため、三つのroot nullable参照は維持した。これらをsetterで隠すのではなく、機能の生成・更新・終了と同じscopeの依存を引き続き監査する。週枠使用8%／残量92%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を保持する。数百行の達成を装う空白圧縮や単なるfactory一覧の移動は行わない。

### 最新：寸法操作とドラッグfixtureの静的モデル型を実行時portから分離（2026-10-29、検証完了）

基準develop／origin/developは53e727c。本単位はcodex/test-model-type-dependenciesで実施した。テスト支援だけで使うconstructorをappの先頭のbindingへ持ち上げている箇所を監査し、まずDimensionTestDriver.createSupport().createInteractionとGeometryDragTestDriver.createResponsiveFixtureへ明示的なmodelTypesを導入した。appは既存GeometrySolver namespaceを渡し、driverのglobal参照を増やさない。必要な型を入口で一度だけ捕捉し、scope／Selection／solver／draw等は従来の実行時portのままにする。既存の個別constructor引数は優先して利用し、型供給元を省略する既存の部分的構築も維持する。型の供給元へモデルや操作stateを詰めない。

app.jsは2,194→2,190行（4行減）。LineCircleDistanceConstraint／ConcentricRadiusDifferenceConstraint／ParallelConstraint／PerpendicularConstraintの四つのroot取込を除き、二つの呼出しで五つのconstructor引数を二つの型供給元へ置換した。TEMP cad-test-model-type-dependencies-proof.cjsで、二つのdriver module全体が二入口の引数定義以外はAST不変、実行時portと公開hookの対応が不変、必要な五型の対応・root未使用binding 0を確認した。新たな暗黙のGeometrySolver global参照はない。fixture本体・Geometry参照・求解・履歴・保存値は変更していない。

dimension-interaction-test-support.test.jsとgeometry-drag-test-driver.test.jsへ各一件の境界試験を追加。明示的な型供給元と個別注入の双方で同じconstructor実体を使うこと、型を一度だけ捕捉して供給元の後の変更を受けないこと、個別constructorが指定されたら型getterを読まないこと、現在scopeの交換を従来どおり読むことを確認した。既存responsive fixtureの型portだけを任意差替え可能にし、元の期待値を維持した。関連単体14件・全単体1,989件・構文618ファイルが成功（exit 0）。責務と依存はモジュール構成とimplementation-mapへ記録した。

関連E2E146件が全成功（2.6分、exit 0、runner14617）。利用hookを検索し、既存UI、adversarial-authoring-performance、寸法prefix、view visibility、toolbar layoutとphase0保存互換性／描画比較を実行した。TEMP cad-test-model-type-dependencies-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server34736停止とsource三つのhash不変を確認した。今回は関連146件であり、前回の全体587件成功を現在の全体結果とは扱わない。性能上限・timeout・操作期待値を変えていない。

最新appは2,190行、非空白1,740行、root直下488文・関数142個、条件付きtest hooks362行、可変参照三つ。週枠使用7%／残量93%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を保持する。静的な型／codecの依存と実行時scopeを区別しつつ、次も責務と生成段階を監査する。数百行へ寄せるために無関係な型や状態を巨大contextへ束ねず、既存ownerを包み直すだけの変更もしない。

### 最新：注記Parameter入力の評価対象と全Sketch安定化を既存Parameter ownerへ集約（2026-10-29、検証完了）

基準develop／origin/developは2024666。本単位はcodex/annotation-parameter-inputで実施した。appに残っていたannotationOwner付き表示用寸法の評価対象選別をParameterNamespace.evaluateEditingExpressionDraftへ移し、従来名の評価portへ接続する。実寸法は元のconstraint、注記ownerを持つ表示値はnullを既存evaluateDimensionExpressionDraftへ渡す。既存の直接評価API・式エンジン・数値範囲は変更しない。また注記Parameter editorの全Sketch安定化callbackを、既存ParameterApplication.createEditingSupport.stabilizeDocumentへ接続した。共有するのは同じactive Sketchと編集中scopeの非Root全Sketchの安定化だけであり、注記のcheckpoint／復元／履歴はAnnotationParameterCommandに残す。

app.jsは2,197→2,194行（3行減）。TEMP cad-annotation-parameter-input-proof.cjsで評価adapterの本体を識別子の対応付けだけで比較し、既存namespace内26関数、ParameterApplication module、安定化の式の不変を確認した。root未使用binding 0。新しいmutable state・module・global依存・script順変更は加えず、入力ごとの意味判断と重複した安定化式を既存ownerへ配置した。

parameter-namespace.test.jsへ二つの境界試験を追加。注記表示値と実寸法の評価の違い、既存直接API、循環検出、signedAngle optionと明示namespace、所有者判定→現在namespace取得の順、所有者getterの元の例外、未確定式／寸法値／注記本文の不変を確認した。関連単体43件・全単体1,987件・構文618ファイルが成功（exit 0）。仕様のモジュール構成とimplementation-mapへ責務を記録した。

関連E2E332件が全成功（4.8分、exit 0、runner52389）。Parameter dialog、既存UI、注記／anchor、Block、phase0保存互換性／描画比較、自由テキスト式／drag、Sketch権限、ボルト径、free Instance、複数寸法／Slot寸法、派生patternを実行した。TEMP cad-annotation-parameter-input-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server28880停止と製品source二つのhash不変を確認した。今回は関連332件であり、前回の全体587件成功を現在の全体結果とは扱わない。既存期待値・UI操作・保存形式・性能閾値／timeoutは変更していない。

PNGの後段参照も調査したが、現状はPending取消・ファイル／mode制御・Canvas frame／入力・panelが別段階で接続されている。参照だけを移すhostやproviderを加える案は採用せず、今回の製品コードは変更していない。将来はcommandの生成・実行・取消を既存PNG／Canvas ownerの責務と照合してから選ぶ。残るroot参照三つを単なるsetterで隠さない。

最新appは2,194行、非空白1,744行、root直下488文・関数142個、条件付きtest hooks362行、可変参照三つ。週枠使用5%／残量95%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を保持する。次も通常機能の生成／更新／終了と同じscopeの依存を監査し、既存ownerを包み直すだけの変更や空白圧縮では数百行の達成としない。

### 最新：command panelの生成・Canvas更新と入力readerをPresentationへ接続（2026-10-29、検証完了）

基準develop／origin/developは39d1398。本単位はcodex/command-panel-presentationで実施した。PresentationFeature.createCommandPanelsが既存CommandPanel.createFeatureを元の後段で生成し、完成したderivedPanel／commandPanelを保持する。CanvasRefreshへの既定readerと、入力bindingのreadCommandPanelを同じ所有者へ接続し、appにあった二つの可変参照とCanvas更新用の重複readerを除いた。モデルやcommandのdraftをPresentationへ移さず、汎用setterや状態を隠すだけのcontextは追加しない。CommandPanel／CanvasRefresh本体、panel内のroutingと各commandの確定・取消は変更していない。

app.jsは2,199→2,197行（2行減）、rootの可変参照は五つから三つ（pngExportCommand／sketchMoveCommand／sketchContextController）。TEMP cad-command-panel-presentation-proof.cjsで元の23portの受渡し、共有documentの同一性、二つのUI moduleの不変、rootの未使用binding／初期化前直接参照0を確認した。panel生成のroot引数は23→22となり、documentはすでにPresentationへ注入した同じものを使う。行数だけの移動ではなく、生成・描画更新・入力からの読取を同じ表示ownerへ揃える単位である。

presentation-feature.test.jsへ二つの境界試験を追加。生成前にDOM／panelを読まないこと、Canvas更新前後の実体と選択値、panel update→注記入力同期→derived選択→cache描画の順、入力readerが同じcommandPanelを返すこと、生成途中で不完全なpanelを公開しないことと例外伝播を確認した。既存の明示reader差替えも維持する。関連単体14件・全単体1,985件・構文618ファイルが成功（exit 0）。仕様のモジュール構成とimplementation-mapへ責務と後段接続を記録した。

関連E2E259件が全成功（3.9分、exit 0、runner30771）。command panel、既存UI、Hatch、派生pattern／free Instance、PNG、注記／anchor、phase0保存互換性／描画比較を実行した。TEMP cad-command-panel-presentation-{focused,check,unit,e2e}.log、proof.cjs、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server29624停止と製品source二つのhash不変を確認した。今回は関連259件であり、前回の全587件成功を現在の全体結果とは扱わない。既存期待値・UI操作・保存形式・性能上限／timeoutは変更していない。

最新appは2,197行、非空白1,747行、root直下489文・関数143個、条件付きtest hooks362行。週枠使用4%／残量96%、停止条件未到達で全体目標はactive・未完了。main／origin/mainは5800850を保持する。残る三つの後段参照と機能単位の生成・更新・終了、通常入力／描画／test APIの共通依存を監査し、同じscopeのportだけをまとめる。数百行の達成を装うための空白圧縮や既存ownerを包み直すだけの変更は行わない。

### 再開：Hatchの外観とパターン原点の純粋な照会を既存データownerへ移管（2026-10-29、検証完了）

週枠残量97%で再開。最新develop／origin/developはdd83203で、前回release 5800850の後に非表示Block Sketchの補助図形表示修正が加わっていることを確認した。mainはdevelopの祖先、tracked treeはclean、worktreeはC:/dev/cadだけだった。この既存修正を基準にcodex/hatch-display-valuesを作成した。前回のHatch候補から、hatchAppearanceForDisplayとhatchPatternOriginの関数本体を既存HatchDataへそのまま移した。HatchDataはすでにAppearance.normalizeHatchAppearanceへ依存しており、新しいmodule・namespace・runtime port・script順の変更を加えない。appは同じ静的関数を各既存ownerへ注入する。

app.jsは2,208→2,199行（9行減）。二つの純粋な関数とappで不要になったnormalizeHatchAppearance取込を除いた。TEMP cad-hatch-display-values-proof.cjsで移した二関数と既存HatchData四関数のAST不変、rootの未使用binding 0を確認した。保存値の正規化や移行、pattern原点の投影計算を変更していない。原点はtruthyなら同じObject／値を返し、falsy時だけ新しいfallbackを返す。投影のgetterをcacheせず呼出しごとに読み、例外をそのまま伝える。責務配置をモジュール構成とimplementation-mapへ記録した。

document-elements.test.jsへ二つの境界試験を追加。外観getter一度の読取、元の値を変えない正規化と戻り値の独立性、live外観交換、nullish時の既定値、原点の参照同一性と交換、独立したfallback、例外伝播、patternOriginを保存に追加しないことを確認した。関連単体30件・全単体1,983件・構文618ファイルが成功（exit 0）。既存の期待値やUI操作・保存形式を変えていない。

関連E2E219件が全成功（3.0分、exit 0、runner31495）。Hatch、既存UI、phase0保存互換性／描画比較、Block、派生pattern／free Instance、view visibilityを実行し、dd83203の非表示Block補助図形の回帰ケースも含めた。TEMP cad-hatch-display-values-{focused,check,unit,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server28644停止と製品source二つのhash不変を確認した。この単位は関連219件であり、前回10/24の全587件成功を最新コードの全体結果に流用しない。

最新appは2,199行、非空白1,749行、root直下491文・関数143個、条件付きtest hooks362行、可変参照五つ。数百行への全体目標はactive・未完了。週枠使用4%／残量96%、停止条件未到達。main／origin/mainは5800850を保持し、停止／releaseの最後に反映する。次も通常入力・描画・test APIの生成と同じscopeの依存を監査し、機能の開始・更新・終了を所有者へ揃える。既に分離したものを包み直すだけの変更や、循環を隠すsetter・巨大contextを増やす変更は避ける。

### 停止地点：最新全体検証とmainへの最終反映（2026-10-24）

週枠使用51%／残量49%を確認したため、ユーザー指定どおり新規分離を停止した。製品コードの最終commitは4dbdc87、検証対象developはe84648b3c5f914457760388b980c2e29ede7ff3b。前回main df5aef2のapp.js 2,738行から2,208行へ、今回の再開区切りで合計530行減った。停止記録では製品コードを変更せず、app.jsは2,208→2,208行（0行変化）。数百行のcomposition rootという全体目標は未完了であり、一時停止として扱う。

最終の全E2E587件が22.5分で全成功（exit 0、runner42711、2026-10-24 12:24:53 JST終了）。対象を絞らず、性能上限・600000ms timeout・既存期待値を変えずに実行した。同じ製品コードの直前検証では構文618ファイル・全単体1,980件も成功している（cad-tool-navigation-presentation-{check,unit}.log）。関連E2Eだけを全体成功に読み替えず、e84648bの現物で全ケースを確認した。最終E2E中は333個の製品sourceのSHA256とHEADが不変だった。

TEMP cad-refactor-oct24-final-{run.ps1,e2e.log,e2e-receipt.json,last-run.json,source-hashes.json,head.txt,metrics.json,root-audit.json}へ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server29336停止を確認済み。フィレット3,744・Offset10,296・航空機1,872・coupled-lines5,304・水平936・垂直936、合計23,088previewは失敗0。各最大時間は30.4／60.9／193.4／28.8／18.4／121.7ms。前のrun途中でユーザーが電源に接続しており、時間差をコードによる性能改善とは断定しない。既存のUI・計算・Geometry参照・.jot2d保存互換性を維持する。

この停止記録をCommit／Pushし、developへ統合・Pushした後にmainを最後に反映・Pushする。直ちにdevelopへ戻ってmainをff-onlyで取り込みPushし、local／originのmainとdevelop四つのcommitが一致すること、mainがdevelopの祖先であること、tracked working treeがcleanであること、runtime-version.jsが最終commitを示すことを確認して目標をpausedにする。最終release commit IDはGitの現物と完了報告を参照する。統合済みのこの記録branchもlocal／remoteから削除する。新しい製品変更は加えない。

再開時はusage、Git状態、worktree、remote main／developと祖先関係、runtimeを確認し、最新developから新しい作業branchを作成する。終了済みbranchを再使用しない。main反映後の同期を最初に確認し、200〜500行の目安や責務境界を縮小せず継続する。現在のappは2,208行、非空白1,756行、root493文、root関数145個（うち単一callのforwarder138個）、条件付きtest hooks362行。単なる空白圧縮やforwarderの移動で達成を装わない。

残るrootの可変参照はpngExportCommand／sketchMoveCommand／sketchContextController／commandPanel／derivedPanelの五つ。現在scopeと初期化段階が異なるため、getter／setterや巨大mutable contextで隠すのでなく、各機能の開始・更新・終了と組立ての所有を確認する。次の候補としてHatchの外観／pattern原点の純粋な照会を調査したが、停止条件到達で未実装。patternOriginはBlock／派生投影のgetterから計算され、保存項目を増やさず戻り値のObject同一性と照会順を守る必要がある。HatchData／Appearance／HatchGeometryQueryの既存責務を再確認してから決める。通常入力・描画とtest APIの共通依存も、機能単位の公開境界と同じscopeのportだけをまとめる。既に分離したownerを包み直すだけの変更は避ける。

### 最新：メニューとTool展開表示の起動・Toolbar同期をPresentationへ集約（2026-10-24、検証完了）

基準develop／origin/developはcf54e41。本単位はcodex/tool-navigation-presentationで実施した。PresentationFeature.createToolNavigationがApplicationMenusの生成、起動前のclose公開、menu start→ToolFlyouts生成→flyout startの接続順を所有する。ToolFlyoutsのnullable参照とToolbarの既定syncも同じPresentation ownerへ集め、appの可変bindingと同期callbackを除いた。通常のmenu／flyout実装、ツール実行ボタン、表示・操作仕様は変更しない。明示的なsyncFlyouts注入は引き続き利用できる。新しいsetterやscope contextを追加せず、同じUIの参照とその生成・起動・同期をまとめた。

app.jsは2,211→2,208行（3行減）。対象の生成3→2、延べ引数11→5、未使用binding／初期化前直接参照0（TEMP cad-tool-navigation-presentation-audit.cjs）。probeのproof.cjsでツールactivation callback、sync式、menu start→flyout生成→flyout startの順、二つのview moduleの不変を確認した。appのcloseAppMenusは従来と同じ生成段階でstart前に取り出し、Canvas contextへの遅延callbackは維持する。flyout startの例外でも生成済み参照を保持し、起動前のsyncは何もしない既存境界を保つ。navigationはappから元の起動位置で一度だけstartする。

presentation-feature.test.jsへ三つの境界試験を追加した。menu／flyoutへの同じdocumentとwindow、同じclose関数とsync先、activation時の現在DOM再取得とclick receiver・ボタン欠損許容、menu／flyout startの例外順と生成済み参照を確認した。関連単体9件・全単体1,980件・構文618ファイルが成功（exit 0）。仕様のモジュール構成とimplementation-mapへ責務を記録した。

関連E2E145件が全成功（2.0分、exit 0、runner73708）。application menus、toolbar layout、command panel、PNG export、Sketch編集、既存UIとphase0保存互換性／描画比較を実行。TEMP cad-tool-navigation-presentation-{focused,check,unit,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server36588停止と製品source二つのhash不変を確認した。これは関連145件であり、f2c791aの全587件成功と区別する。既存期待値や性能閾値・timeoutは変えていない。

週枠使用50%／残量50%、50%未満という停止条件には未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了で、2,208行を目安200〜500行の達成とは扱わない。次も機能単位の所有・初期化順と同じscopeの依存を監査し、残量50%未満を確認したら新規分離を停止し、最新全体検証・Commit・develop先行／main最後の統合・同期を完了して一時停止する。

### 最新：Parameter適用のcheckpoint・復元とnamespace振分けを既存ownerへ移管（2026-10-24、検証完了）

基準develop／origin/developは38c2b69。本単位はcodex/parameter-editing-applicationで実施した。appに残っていたParameter適用のDocument／Block局所checkpoint、失敗時復元と現在／保存済みnamespaceの安定化振分けをParameterApplication.createEditingSupportへ移した。DocumentではJSON履歴snapshot、Block編集中は値snapshotという既存境界を保ち、復元時のBlock状態とDocument名fallbackはその時点に照会する。Block伝播を作る前にsupportを生成し、伝播生成後のcreateApplicationでpropagateだけを接続する。現在Documentの非Root全Sketchを安定化する入口は伝播と適用で共有する。workspace.currentと編集中scopeの区別、保存済みDefinitionの一時scope切替は維持し、Solver数値計算・UI・保存形式は変更しない。

app.jsは2,215→2,211行（4行減）。対象の生成／接続2→3、rootの明示引数12→20、未使用binding／初期化前直接参照0（TEMP cad-parameter-editing-application-audit.cjs）。この単位は依存数削減ではなく、曖昧だったcallbackの中の退避・復元・namespace選択を所有者へ置き、必要なsnapshot／load／scope等を明示する変更である。新しい可変状態・cache・contextは追加しない。proof.cjsで既存create／createDeletionGuardの不変、四つのcallback本体を読取portと関数名の置換だけで比較した。二重に記述されていた全Sketch安定化も同じ式であることを確認した。

parameter-application.test.jsへ五つの境界試験を追加し、生成時の読取なし、各呼出し時のactive Sketch／scope再取得、Rootだけを除外しlocked Sketchを残すこと、Document／局所復元とcheckpoint同一性、確定通知後の例外・復元時の名前fallback、保存済みnamespaceの伝播順、退避例外がtry外で伝わりdraftを変更しないことを確認した。関連単体17件・全単体1,977件・構文618ファイルが成功（exit 0）。追加のDocument復元試験ではVMのJSON objectのprototype差をデータ不一致としないようJSON内容で比較し、既存期待値や製品処理を変更していない。正式なParameter操作仕様と不一致がないことを確認し、モジュール構成とimplementation-mapへ内部責務を記録した。

関連E2E336件が全成功（5.4分、exit 0、runner13452）。Parameter画面、既存UI、注記／anchor、Block、保存互換性／描画比較、Sketch編集／権限／投影、寸法prefix／複数寸法、ボルト径、自由注記の式／dragとfree Instanceを実行した。TEMP cad-parameter-editing-application-{focused,check,unit,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server33240停止と製品source二つのhash不変を確認した。今回は関連336件であり、f2c791aの全587件成功と区別する。数値上限・timeout・操作期待値を変えていない。

週枠使用50%／残量50%、50%未満という停止条件には未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も通常機能の生成／接続とstateの所有を確認し、残量50%未満を確認したら新規分離を停止して最新全体検証・Commit・develop先行／main最後の統合・同期を済ませ、一時停止する。Parameterの回復範囲を勝手に広げず、残る汎用delegateをmutable provider／connect setterへ移すだけの変更はしない。

### 最新：Sketch Treeのtest fixture・可視性／hover観測を一つの公開APIから生成（2026-10-24、検証完了）

基準develop／origin/developはf2c791a。本単位はcodex/sketch-tree-test-apiで実施した。既存SketchTreeTestDriver.createBrowserApiが階層参照／可視性fixture・状態観測、inactive要素、Root／Block hoverの八つの個別factoryを元と同じ順に生成し、既存名の八つの公開hookを返す。元の各生成の95引数を比較し、同名portの値に食い違いがない41依存を一度だけ受ける。scope・描画・モデル生成を共有し、fixtureや観測の本体と個別APIは保持する。通常のTree表示／編集をtest支援へ移さず、新しい操作state・cache・global依存は追加しない。

app.jsは2,227→2,215行（12行減）、対象生成8→1、test hook内の延べ引数95→41、未使用binding／初期化前直接参照0（TEMP cad-sketch-tree-test-api-audit.cjs）。proof.cjsで既存factory八つのAST、全95portの受渡し、八つのhook対応、公開object全体のproperty順を比較した。全個別factoryは関数定義とObject.freezeしたAPIの返却のみで、生成時に注入portを呼ばないことを静的・動的に確認した。構築をまとめてもモデル／DOM読取の時機は各hook実行時のままとし、通常scopeの代わりになる巨大contextを追加しない。

構文618ファイル・全単体1,972件・関連E2E237件が全成功（exit 0、E2E3.3分、runner62483）。既存hookを使うunified-ui、phase0保存互換性／描画比較、Treeの可視性／削除、Sketch権限／移動／編集／投影、view visibilityとBlockを実行した。処理本体を複写するテストは増やさず、既存の期待値／操作／性能基準を維持した。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と依存を記録した。

TEMP cad-sketch-tree-test-api-{check,unit,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.json、tested-blobs.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server11592停止と製品source二つのhash不変を確認した。この単位は関連237件であり、直前f2c791aの全587件成功（22.4分）と区別する。全体目標はactive・未完了で、数百行へ収束したとは扱わない。

週枠使用49%／残量51%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。次も既存機能のowner、現在scopeと初期化段階を確認して通常入力・描画・test公開の接続を整理する。今回は公開hookの元の並びを保つためappの八つの対応行を残した。単なる圧縮や、順序・異なるscopeを隠すための一括contextへ置換しない。

### 最新：共通UIのHTML文字列変換を状態のない表示moduleへ分離（2026-10-24、全体検証完了）

基準develop／origin/developは37a493b。本単位はcodex/html-text-formattingで実施した。appに残っていたescapeHtmlをsrc/ui/html_text.jsのHtmlTextへ移した。String(value??"")と五つの特殊文字置換の関数本体はそのままにし、nullishと0／false、Unicode・改行、既存entityの二重エスケープ、文字列化の回数／例外を維持する。モデル・DOM・言語・操作状態に依存せず、appは静的APIから受け取った同じ関数をParameter Editor、context表示、Properties、Sketch Tree等へ明示して注入する。既存のclassic script／namespace方式を保ち、NumberDisplay直後の読込と構文・単体のmanifestへ一度ずつ登録した。設定やメッセージに混ぜず、共有UI文字列の責務を明示する。

app.jsは2,230→2,227行（3行減）。TEMP cad-html-text-formatting-proof.cjsで関数本体のAST一致と14値の差分比較、APIの不変性を確認。audit.cjsで未使用bindingは0。本単位は構築引数を減らす変更ではなく、UI変換の所有を分ける変更である。新規単体2件は五文字のエスケープ、nullish／scalar／既存entity／Unicode・実改行、および一度の文字列化と元の例外の伝播を確認する。構文618ファイル・全単体1,972件が成功（exit 0）。正式なモジュール構成とimplementation-mapも更新した。

最新の全E2E587件が22.4分で全成功（exit 0、runner84617、2026-10-24 11:36:53 JST終了）。TEMP cad-html-text-full-{run.ps1,e2e.log,e2e-receipt.json,last-run.json,source-hashes.json,tested-blobs.json,metrics.json}へ証跡を保存。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server42208停止と製品source三つのSHA256不変を確認した。フィレット3,744・Offset10,296・航空機1,872・coupled-lines5,304・水平936・垂直936、合計23,088previewが失敗0。最大時間は順に27.9／40.1／207.5／27.9／21.3／128.9ms。途中でユーザーが電源へ接続したため、過去runとの時間差をコードによる性能改善とは断定しない。数値上限・timeout・既存期待値を変更せず、以前の全体検証07081a6を今回の現物で更新した。

週枠使用49%／残量51%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。新しい分離を停止するのは残量50%未満を確認した時点である。全体目標はactive・未完了で、2,227行は200〜500行の目安に達していない。次も描画・入力・test APIの状態所有と生成段階を監査し、共通依存のある機能単位から進める。描画のhoisted関数をprovider変数とconnect setterへ置換する案や、異なるscopeの操作を巨大contextへ詰める案は、循環を隠すだけになるため採用しない。

### 最新：描画順fixtureと操作観測の公開APIを専用driverへ集約（2026-10-24、検証完了）

基準develop／origin/developは00f4c24。本単位はcodex/drawing-order-test-apiで実施した。既存DrawingOrderTestDriver.createBrowserApiが混在図形fixture→選択／状態／並べ替え観測を元と同じ順に生成し、既存名の四つの公開hookを返す。drawingOrder・現在scope・Hatch照会・serialize・UI通知と描画を一度だけ受け、resetHistoryとreadHistoryは異なる役割として明示したままにする。個別factoryと既存の状態照会時ensureDrawingOrderState、並べ替えcommand、履歴・戻り値／例外・Geometry参照を維持する。appは29個の依存を注入して公開APIへ合成し、hook名とdriverの対応を専用moduleが所有する。新しい状態・cache・ソート規則・global依存は追加しない。

app.jsは2,238→2,230行（8行減）、対象生成2→1、rootのtest hook内の延べ引数35→29、未使用binding／初期化前直接参照0（TEMP cad-drawing-order-test-api-audit.cjs）。共通portが元の各生成で同じ値であることを抽出時に確認した。TEMP cad-drawing-order-test-api-proof.cjsで既存関数本体6個と子constructor二つの全portの不変、公開hook名と並びの一致、モデル／DOM／履歴／描画portを生成時に呼ばないことも確認し、extraction.jsonへport数とhook名を保持した。別々のモデルscopeを一つに束ねるcontextは追加せず、同じ描画順支援の共通依存と公開対応を整理する単位とした。数百行の全体目標は未完了。

同じhelper処理を複写した期待値テストを増やさず、既存の描画順とcommandの関連単体12件、全単体1,970件、構文616ファイルが成功した。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と依存を記録し、既存manifest／script順を維持した。

関連E2E217件（描画順専用ケース・Hatch・既存UI・phase0保存互換性／描画比較・Block・free Instance／派生pattern）が全成功（3.1分、exit 0、runner11295）。TEMP cad-drawing-order-test-api-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server29664停止と製品source二つのhash不変を確認した。今回は関連217件であり、07081a6の全587件成功と区別する。数値上限・timeout・既存期待値は変更していない。

週枠使用46%／残量54%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も残る入力・描画・test公開の依存と生成段階を確認する。単に行を詰めたり、既に役割が分かれた入口を再抽出したりせず、同じ機能のownerと状態の結線を優先する。


### 最新：tooltip文言の準備とSketch追加ボタンの結線を既存UI ownerへ移管（2026-10-24、検証完了）

基準develop／origin/developは07081a6。本単位はcodex/ui-button-initializationで実施した。appに残っていたbutton[aria-label]のdata-tooltip準備をApplicationSettings.prepareButtonTooltipsへ移し、既存のdata-tooltip翻訳と同じ設定UIに配置した。元と同じCommandCursor生成後／言語反映前の位置で呼ぶ。Sketch追加／子Sketch追加のclick登録はSketchTreeView.bindCreationへ移し、同じcreateSketchへsibling／childを渡す。appは元と同じfile／画像control後、Sidebar結線前に呼ぶ。新しいtooltip表示やモデル作成方針・状態／cache・moduleを追加しない。

app.jsは2,241→2,238行（3行減）。TEMP cad-ui-button-initialization-proof.cjsで、tooltip準備loopと二つの登録statementのASTが変更前と同一であることを確認した。audit.cjsでは新しい明示呼出しも含めて未使用binding／初期化前直接参照0。createSketchのconstは1348行で初期化され、bindCreationは1800行で読むため、以前のcallbackから値を渡す入口へ変えても未初期化参照はない。コンストラクタ引数の削減ではなく、DOMの初期化副作用を既存ownerへ配置する単位である。数百行の全体目標は未完了。

application-settings.test.jsとsketch-tree-view.test.jsへ計2境界試験を追加した。現在の文言をそのままコピーすること、DOM順の読取／書込と途中例外、lookup／登録順、createSketchのrelation・receiver・戻り値／例外、任意ボタンの欠損許容を確認した。既存view fixtureのcreation ID照会だけを任意差替え可能にし、既存期待値・UI操作・tooltip文言を変えていない。関連単体10件、全単体1,970件、構文616ファイルが成功。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と段階を記録し、既存manifest／script順を維持した。

関連E2E198件（既存UI／言語切替・phase0保存互換性／描画比較・Sketch編集／移動／権限・Tree可視性／削除・Sketch投影・command panel）が全成功（2.8分、exit 0、runner89664）。TEMP cad-ui-button-initialization-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server38348停止と製品source三つのhash不変を確認した。今回は関連198件であり、直前の07081a6の全587件成功と区別する。数値上限・timeout・既存期待値は変更していない。

コンテキスト操作の固定batch等は複数UIが同じQueryを使っており、その役割別入口を今回は維持した。行数のために異なるownerを一つのcontextへ束ねたり、新たなadapterを重ねたりしない。次も通常入力・描画・test公開の所有と初期化段階を確認する。

週枠使用45%／残量55%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。今回の3行減で全体達成とはせず、責務と依存方向を基準に継続する。


### 最新：位置一致と距離を幾何Kernelへ集約し全体検証を更新（2026-10-24、検証完了）

基準develop／origin/developは17e42e0。本単位はcodex/geometry-position-queryで実施した。appのsamePositionとSolverのhypot2を既存GeometryKernelへ移し、Solverは既存のKernel依存から同じhypot2を取り込んでGeometrySolver.hypot2として再公開する。KernelからSolverへの逆依存や新しい状態・moduleは追加しない。Boolean短絡・既定許容差1e-9・座標評価順・Math.sqrt(x*x+y*y)の演算順とoverflow／underflow・例外を維持し、Math.hypotへの置換は行わない。appは通常作図へ位置判定を注入する側とし、数値方針の変更やUI／保存形式の変更と混ぜない。

app.jsは2,245→2,241行（4行減）、対象の通常作図生成1→1、root直下の延べ引数36→36、未使用binding／初期化前直接参照0（TEMP cad-geometry-position-query-audit.cjs）。TEMP cad-geometry-position-query-proof.cjsでは二つの関数のASTが変更前と同一であること、Solver全sourceの変更がhypot2の移管と取込だけであること、非有限値や小さい値を含む968回の計算結果一致を確認した。純粋な位置／距離の所有を揃える境界であり、引数削減や数百行の全体目標達成とはしない。

geometry-kernel.test.jsへ2試験を追加し、許容差・欠損点の短絡・座標getter／許容差変換の評価順と例外、SolverとKernelが同じ関数を公開すること、legacyなoverflow／underflow・数値変換の回数を確認した。関連単体45件、最終コードの全単体1,968件、構文616ファイルが成功。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と依存方向を記録し、既存manifest／script順を維持した。

最終コードの全E2E587件が全成功（22.8分、exit 0、runner84549、2026-10-24 10:49:29 JST終了）。今回は関連E2Eだけではなく全fileを実行し、CADの対象限定環境変数がないことも確認した。長時間の同じnative handleを終了まで追跡し、観測待ちを理由に再起動していない。TEMP cad-geometry-position-full-{run.ps1,e2e.log,e2e-receipt.json,last-run.json,source-hashes.json,tested-blobs.json,metrics.json}、cad-geometry-position-query-{focused,unit,check}.logへ証跡を保持する。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server8288停止と製品source三つのhash不変を確認した。以前の37cb5d2の全体成功より新しい検証基準は本単位の最終sourceであり、過去の関連238件等とは区別する。

主要拘束ドラッグのpreviewはfillets 3,744／offsets 10,296／aircraft 1,872／coupled-lines 5,304／horizontal 936／vertical 936、計23,088回で失敗0。各最大msは36.9／41.1／307.8／28.3／22.9／130.0。元の上限・timeout・テスト期待値は変更せず、aircraftを含む全ケースを完了した。性能の失敗を隠してmainを保留している状態ではない。全体検証後のfetchでもmainはdf5aef2、develop／origin/developは17e42e0のままで祖先関係が成立している。

検証済みsourceのcanonical Git blobはapp.js=ea38c7f92702f3ca336c9c9158a7b549d37ae1f9、geometry_kernel.js=45d3b112c1d9539aab1a79f3f8eecc3763aa2f67、constraint_solver.js=097ebef7ca3bf76edcd599259f42b603b9677702。Commit／develop統合後はtested-blobs.jsonとHEADの値を比較し、同じ検証済みsourceであることを確認する。

週枠使用44%／残量56%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も通常入力・描画・test公開の共有ownerと段階を確認し、rootの引数表を別fileへ隠すだけの分割はしない。新しい分離後の関連検証と、今回の全体587件の証拠は分けて扱う。


### 最新：派生Instanceのtest fixture・状態と公開hookの組立てを専用driverへ移管（2026-10-24、検証完了）

基準develop／origin/developはd83ad7d。本単位はcodex/derived-instance-test-apiで実施した。既存DerivedInstanceTestDriver.createBrowserApiが配置command用fixture→load／状態／削除観測→派生モデルfixtureを同じ順で生成し、既存名の六つの公開hookを返す。reset・Geometry追加・現在scope・serialize・履歴・UI通知と描画の共通依存を一度だけ受け、モデルfixtureのreadStateはそこで生成した実Interactionのstateへ結線する。個別factoryと処理・戻り値／例外・参照はそのまま維持し、新しいstate／cache・求解基準・グローバル依存は追加しない。appは31個の明示依存を注入して公開APIへ合成する。

app.jsは2,256→2,245行（11行減）、対象生成3→1、rootのtest hook内の延べ引数41→31、未使用binding／初期化前直接参照0（TEMP cad-derived-instance-test-api-audit.cjs）。共通portの元の値が一致することを抽出時に確認した。TEMP cad-derived-instance-test-api-proof.cjsで既存関数本体8個と子constructor三つの全portの不変、公開hook名と並びの一致、モデル／DOM／履歴／描画portを生成時に呼ばないことも確認した。extraction.jsonへhook名とport数を記録した。巨大contextを外へ移すだけにせず、fixture間の状態照会の結線と公開名の対応を機能のdriverへ所有させた。数百行の全体目標は未完了。

既存の役割別入口がある注記・寸法支援はその境界を維持し、同じportを包むだけの新wrapperは追加しなかった。今回は変更しないhelperの期待値複写テストを増やさず、既存の派生Instance関連単体18件、全単体1,966件、構文616ファイルが成功した。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務・依存を記録し、既存のscript／単体manifestを維持した。

関連E2E238件（既存UI・phase0保存互換性／描画比較・派生pattern／free Instance・Sketch投影とlegacy互換driver・Block・Hatch）が全成功（3.4分、exit 0、runner11590）。TEMP cad-derived-instance-test-api-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server33224停止と製品source二つのhash不変を確認した。今回は関連238件であり、全587件の最新基準37cb5d2とは区別する。文言・数値上限・timeout・既存期待値は変更していない。

週枠使用41%／残量59%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も残る通常入力・描画・各機能のtest公開について、同じownerのcapabilityと状態の結線を確認する。既存の役割別入口を再抽出せず、行数のために異なる責務をまとめない。


### 最新：Block回転補正と編集scopeのInstance照会を既存ownerへ配置（2026-10-24、検証完了）

基準develop／origin/developは6027c5b。本単位はcodex/block-layout-and-lookupで実施した。90度刻みのsnappedBlockRotationとprivate定数を既存BlockLayoutへ移し、静的APIと生成済みlayoutから同じ関数を公開する。Number変換、Math.round、moduloの順序を変えず、配置・Boundsを扱う座標計算と同じ場所へ配置した。blockInstanceByIdはBlockEditingQueriesへ移し、BlockEditingFeatureへ明示したreadEditingScopeから現在のblockInstancesを呼出しごとに読む。最初の一致をObjectのまま返し、id厳密比較とnull fallbackを維持する。workspace.currentを使う既存の移動可否等の照会とは別readerを使い、両scopeを混同しない。

同FeatureのcreatePropagationもこのbound readerを既定として共有し、appの従来の読取callbackを一か所へ集めた。個別createPropagationの明示readEditingScope上書きAPIと、個別query生成でのcurrentScope既定も維持する。scope置換、document再結線→Selection解除の順序、旧Instance／Geometry参照、例外と求解は既存の範囲を保つ。生成時にscopeを読まず、新file・操作state／cache・グローバル変数は追加していない。

app.jsは2,265→2,256行（9行減）、対象生成3→3、root直下の延べ引数30→30、未使用binding／初期化前直接参照0（TEMP cad-block-layout-and-lookup-audit.cjs）。回転の計算とモデル検索を一つの便利moduleへ混ぜず、それぞれ既存ownerへ配置した。scope readerは必要な場所へ明示しており、引数総数の削減とはしない。数百行の全体目標は未完了。

block-editing-queries.test.jsとblock-editing-feature.test.jsへ計2境界試験を追加した。生成時の無照会、workspaceとboundに同じIDの別Instanceを置く検索、最初の一致と厳密ID、scope置換、例外とcurrentScope既定を確認した。実codec／rebindingを使うFeature試験では、queryとParameter再構築が現在のboundを共有すること、旧bound／workspaceを変更しないこと、明示したPropagation scopeの上書きがqueryのscopeと独立することを確認した。TEMP cad-block-layout-and-lookup-proof.cjsで回転関数のAST不変、5,012入力の変更前後の結果一致、Number変換例外の伝播を確認した。関連単体26件、全単体1,966件、構文616ファイルが成功。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と依存を記録し、既存manifest／script順を維持した。

関連E2E247件（既存UI・phase0保存互換性／描画比較・Block／固定・Hatch・派生pattern／free Instance・Sketch投影・Parameter dialog・Sketch移動）が全成功（3.6分、exit 0、runner5692）。TEMP cad-block-layout-and-lookup-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server41564停止と製品source四つのhash不変を確認した。今回は関連247件であり、全587件の最新基準37cb5d2とは区別する。既存の文言・数値上限・timeout・期待値は変更していない。

週枠使用40%／残量60%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も残る通常入力・描画と各機能のtest支援の共有ownerを調べ、同じcapabilityを繰り返す接続とappに残す接続を区別する。既存の役割別入口を包むだけの新wrapperや、巨大なapp contextへ移す分割は行わない。


### 最新：作図要素の種類ラベルを既存の表示moduleへ集約（2026-10-24、検証完了）

基準develop／origin/developは7e3fb7e。本単位はcodex/authoring-type-labelsで実施した。Hatchのcross／solid／既定の平行線と、派生Instanceのmirror／pattern／circularPattern／既定のSketch投影の表示ラベル生成を、既存AuthoringFeedbackへ集約した。既存のHatch／Offset診断と同じapplicationTextだけを注入し、Properties・Sketch Tree・context候補が同じ関数を使う。生成時に翻訳を実行せず、各呼出しの現在言語、厳密な型名比較、未知値／null／undefinedのfallbackと翻訳例外を維持する。新file・状態／cache・Document／DOM依存は追加していない。Block回転の計算やmodel検索は表示文言と責務が異なるため、同じmoduleへ混ぜない。

app.jsは2,278→2,265行（13行減）、AuthoringFeedbackの生成1→1、root直下の延べ引数1→1、未使用binding／初期化前直接参照0（TEMP cad-authoring-type-labels-audit.cjs）。二つの処理をDOMやappを起動せず直接検証できる既存表示APIへ配置する単位であり、引数削減とはしない。数百行の全体目標は未完了。

TEMP cad-authoring-type-labels-proof.cjsで二つの関数のASTが変更前と同一であることを確認した。変更前の関数と実module APIを同じtranslatorで実行し、日本語／英語・各種類・未知値・null／undefined・数値・文字列化を拒否するObjectを含む40呼出しで結果と翻訳引数のtraceが一致した。生成時の無照会と翻訳例外の同一性も確認した。低影響の同一処理移管のため恒久的な期待値複写テストは増やさず、関連の既存単体6件、全単体1,964件、構文616ファイルが成功した。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務・依存を記録し、既存script／単体manifestは維持した。

関連E2E230件（既存UI／Properties・phase0保存互換性／描画比較・Hatch・派生pattern／free Instance・Sketch投影・Block）が全成功（3.2分、exit 0、runner28888）。TEMP cad-authoring-type-labels-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server38736停止と製品source二つのhash不変を確認した。今回は関連230件であり、全587件の最新基準37cb5d2とは区別する。文言・数値上限・timeout・既存期待値は変更していない。

週枠使用39%／残量61%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も残る通常入力・描画・model query・test公開の共有依存を調べ、機能のownerと生成段階を基準に整理する。appの行数だけを目的に無関係な責務をまとめたり、巨大contextへ移したりしない。


### 最新：CanvasドラッグのDOM副作用とBlock入口を既存ownerへ接続（2026-10-24、検証完了）

基準develop／origin/developは3d1fd72。本単位はcodex/canvas-drag-compositionで実施した。CanvasInputBinding.createDragPointerへ、表示class追加→capture、capture→表示class追加、表示class解除→releaseの三つの副作用を集約した。CanvasDisplayのworkspaceが同じcanvasで生成して返し、Geometry／寸法と注記が元の開始順序に合う入口を使う。終了時のcatchはreleaseだけに限定し、開始失敗時の途中の表示状態やclass操作例外を無断で変えない。appから六つのDOM callback本体を除去し、同じ本体であることをAST抽出比較した。GeometryDragFeature.createBlockEntryは同じplan.build・実command・Selection・解除／通知を共有し、元の後段位置で実Block入口を生成する。開始可否・session・確定／取消・履歴と求解は各既存commandに残す。新しい操作state・遅延reader／context・fileは追加していない。

app.jsは2,280→2,278行（2行減）、対象生成4→4、root直下の延べ引数81→74、未使用binding／初期化前直接参照0（TEMP cad-canvas-drag-composition-audit.cjs）。行数のために既存の空行や引数行を詰めず、DOM副作用の入力側への移管と、同じdrag ownerからのBlock入口生成を改善点とする。TEMP cad-canvas-drag-composition-proof.cjsで六つのDOM body不変、block-proof.cjsで七つのBlock依存が元のownerと一致することも確認した。数百行の全体目標は未完了。

canvas-input-binding.test.jsへ2境界試験を追加し、生成時にcanvas／classListを読まないこと、実引数とmethod receiver、二つの開始順序、capture失敗時の途中状態、releaseだけの例外抑制とclass解除例外の伝播を確認した。geometry-drag-feature.test.jsへ1境界試験を追加し、後段生成時の無照会、同じInstanceの選択、固定／回転lockによる実plan拒否と既存案内・描画を確認した。既存期待値は変更していない。関連単体30件、最終コードの全単体1,964件、構文616ファイルが成功。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と依存を記録した。

関連E2E310件（既存UI・phase0保存互換性／描画比較・Block／free Instance・複数寸法・Geometry drag／drag smoothness・統合注記／anchor／display size／leader外観・自由text入力drag）が全成功（6.9分、exit 0、runner84508）。TEMP cad-canvas-drag-composition-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server13424停止と製品source四つのhash不変を確認した。今回は関連310件であり、全587件の最新基準37cb5d2とは区別する。数値上限・timeout・既存期待値は変更していない。

寸法／注記のtest支援には既に役割別の生成入口があるため、同じportを包むだけの新wrapperは加えなかった。早期のconstrained Annotation dragはSolveScopeQueryにもscopeを提供するため、その所有を崩して通常drag群へまとめない。次も残るCanvas入力・描画・test公開の共有依存を調べ、機能のownerと生成段階に沿って整理する。

週枠使用38%／残量62%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。今回の2行減を全体達成とはせず、状態ownerと依存方向の改善を継続する。


### 最新：拘束テスト支援の状態照会と編集ケースを公開API単位で集約（2026-10-24、検証完了）

基準develop／origin/developは4841f8b。本単位はcodex/constraint-test-apiで実施した。既存src/testing/constraint_test_driver.jsへcreateModelSupportとcreateEditingCasesを追加した。前者は同じscope・現在Sketch・解析・Block投影と拘束追加から四つのdriverを生成し、状態readerと既存名の四つの公開hookを返す。拘束追加後の解析／状態はその同じ観測を共有する。後者は同じSelection／対象session・model編集・参照／通知から、寸法選択・観測、支持拘束状態、親／兄弟の点線参照・移動・状態の七つのdriverを生成し、既存名の七hookを返す。既存の二つの連続生成位置と順序を維持し、Drag試験へ渡す状態readerも同じ関数である。個別factoryは残し、新しい状態・cache・求解基準・app contextは追加しない。

app.jsは2,296→2,280行（16行減）、対象生成11→2、rootのtest hook内の延べ引数85→50、未使用binding／初期化前直接参照0（TEMP cad-constraint-test-api-audit.cjs）。同じkeyの共有依存が元の各constructorで同じ値であることを抽出時に確認した。TEMP cad-constraint-test-api-proof.cjsでは既存関数本体24個の不変、子constructor11個の全portと元の値の一致、公開hook名と並びの一致をAST比較で確認し、extraction.jsonに入口別の数とhook名を保持した。公開名の対応と生成の所有を既存driverへ移し、巨大contextを外へ隠すだけの分割にしない。通常起動時は従来どおりtest hookを生成しない。数百行の全体目標は未完了。

既存constraint-test-driver.test.jsへ1境界試験を追加し、実driverを組み合わせた拘束追加成功／拒否後の解析・Block状態・serializeの順序と同じmodel、scope／projectionの置換、状態readerの同一関数参照、commit例外時に後続照会へ進まないことを確認した。関連単体9件、最終コードの全単体1,961件、構文616ファイルが成功。製品file／単体fileの新規追加はなく、既存manifestとscript順は維持した。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務・依存を記録した。

関連E2E290件（既存UI・phase0保存互換性／描画比較・寸法・Sketch投影とlegacy互換・派生pattern／free Instance・Block／固定・bolt／thread／symmetry・adversarial authoring性能／drag fixture）が全成功（5.5分、exit 0、runner93884）。TEMP cad-constraint-test-api-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server33528停止と製品source二つのhash不変を確認した。今回の関連290件に長時間のconstraint-drag-regressions全fileは含めず、全587件の最新基準37cb5d2とは区別する。性能上限・timeout・既存期待値は変更していない。

週枠使用37%／残量63%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残る寸法／注記等のtest公開と通常のCanvas／Geometry dragの依存を監査し、機能の共有ownerと初期化段階を基準に整理する。既に分離した拘束driverのraw helperを再抽出せず、APIの組立てと状態所有を優先する。


### 最新：拘束の案内・hover・Canvas入力を同じ編集Featureへ接続（2026-10-24、検証完了）

基準develop／origin/developはa1bbd95。本単位はcodex/constraint-input-compositionで実施した。既存ConstraintEditingへcreateWithFeedbackを追加し、実ConstraintControlsViewのfeedbackを先に生成して同じsession／翻訳／現在のoperands・言語から対象commandと寸法配置を接続する。label／targetHint／invalidTargetHintをappで個別に注入し直さず、生成したtargetHintを通常Canvas入力にも返す。createCommandInputは同じpending／operand解決／型から既存RetargetHoverを生成し、hover更新と後段のConstraintCommandInput.createFeature生成入口を返す。後段は同じ対象session・寸法配置・対象commandを共有し、元と同じGeometryDrag後／DimensionDrag前の位置で生成する。通常クリック入力は引き続きDimensionDrag後に生成する。個別createの直接注入APIとfeedback→選択照会→対象command→寸法配置→hover→後段入力の順序を維持する。新しい操作state・遅延reader・app contextは追加していない。

app.jsは2,304→2,296行（8行減）、対象生成4→3、root直下の延べ引数69→53、未使用binding／初期化前直接参照0（TEMP cad-constraint-input-composition-audit.cjs）。各commandの状態／取消／確定／履歴は既存ownerに残り、appに分散していた同一sessionからの入力組立てを編集Featureへ集める単位である。数百行の全体目標は未完了。

既存constraint-editing.test.jsへ2境界試験を追加し、実ConstraintFeedback／ControlsView・TargetSession・CanvasSelection・CanvasHover・対象command・寸法配置・入力adapterで、分離前の直接結線と新しいFeatureを比較した。現在の言語・operand・ボタンlabelと開始／取消案内、生成時の無照会、hoverの仮寸法非変更、hit例外時のhover／draft保持、拒否時の非変更、正常な仮寸法対象の差替えと同一Geometry／operand参照、distance-value時の非継続を確認し、通知traceも一致した。実寸法配置を通すfixtureにはp1／p2と現在の選択targetを設定し、既存のcontrols更新が仮寸法を取り消す条件も保った。既存の期待値・基準は変更していない。関連単体39件、最終コードの全単体1,960件、構文616ファイルが成功。

関連E2E214件（既存UI・phase0保存互換性／描画比較・複数／prefix／Slot寸法・Sketch投影とlegacy互換driver・派生pattern・Block）が全成功（3.0分、exit 0、runner3277）。TEMP cad-constraint-input-composition-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server22880停止と製品source二つのhash不変を確認した。今回は関連214件であり、全587件の最新基準37cb5d2とは区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務・生成段階を記録した。

週枠使用36%／残量64%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残るCanvas context操作・通常入力・Geometry drag等の共有依存と段階を監査し、状態ownerに沿った組立てを選ぶ。大量のportを別fileへ移すだけの抽出や行数だけの達成はしない。


### 最新：寸法モデル照会と拘束向け測定を既存queryへ集約（2026-10-24、検証完了）

基準develop／origin/developは7334808。本単位はcodex/dimension-model-queriesで実施した。既存src/constraints/dimension_queries.jsへcreateModelQueriesを追加し、現在の結線済みscope・既定active Sketch・拘束所属readerを明示してSketch内の寸法有無と直接半径寸法を照会する。初期化時にはreaderを呼ばず、scopeの置換、配列順／短絡、既定Sketchとscope.activeSketchIdの区別、dimensionのtruthy判定、Radius／Diameterの有効性とprimitiveのObject同一性を保つ。measuredConstraintTargetValueも同moduleへ移し、既定引数の評価時機と通常角の絶対値／間隔角の符号、既存のradian変換式を保持した。元の測定関数本体が同一であることをAST抽出比較で確認した。新しい製品file・状態／cache・求解／UI更新は追加していない。

app.jsは2,315→2,304行（11行減）、新factoryは0→1、rootの明示引数は0→3、未使用binding／初期化前直接参照0（TEMP cad-dimension-model-queries-audit.cjs）。今回は依存の隠蔽を減らして照会の所有を揃える単位であり、引数総数の削減とはしない。単なる移動だけにならないよう、既存の静的寸法照会を内部で再利用し、scope依存のない測定APIとは分けた。数百行の全体目標は未完了。

新規dimension-queries.test.jsの2境界試験では実Geometry型を使い、scope置換／既定Sketchの独立、無効寸法の扱い、短絡とgetter例外、同じIDで別Objectの半径寸法、通常角と間隔角の値、明示target／dimensionと既定引数getterの時機を確認した。最初の追加テストの符号想定は既存angleDegreesの絶対値処理と不一致だったため、製品処理は変えず60度→120度の既存測定を確認するfixtureへ修正した。関連単体11件、全単体1,958件、構文616ファイルが成功。読込済みmodule内の変更のため新製品script登録はなく、追加単体fileを構文／単体の一覧へ登録した。

関連E2E202件（既存UI・phase0保存互換性／描画比較・複数／prefix／Slot寸法・Geometry drag・free Instance・Block）が全成功（4.3分、exit 0、runner52561）。TEMP cad-dimension-model-queries-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server26764停止と製品source二つのhash不変を確認した。今回は関連202件であり全587件ではなく、最新全体基準37cb5d2の成功と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdへ責務と依存を記録した。

週枠使用36%／残量64%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残るCanvas振分け・拘束編集・Geometry drag等の共有依存と初期化段階を監査し、機能の所有を改善する単位を選ぶ。大量のportを別fileへ移すだけの抽出や行数だけの達成はしない。


### 最新：派生Instanceの配置・source・確定後編集を機能単位で接続（2026-10-24、検証完了）

基準develop／origin/developは6606d35。本単位はcodex/derived-instance-featureで実施した。src/application/derived_instance_feature.jsへDerivedInstanceFeatureを追加し、GeometryInstanceCommand→InstanceSourceCommand→DerivedInstanceEditingを同じ現在scope・参照解決・通知／描画／履歴とSelection・modeへ接続する。先行create、直後createSourceCommand、後段createEditingの段階と実command生成順は元の位置を保つ。配置中のProperty変更か確定後の編集かをisPlacingの厳密なObject同一性で振り分けるchangePropertyを同Featureへ移し、appの分岐関数を除去した。個別command factory・状態owner・戻り値／receiver、source固有のguard／投影／削除参照判定・Properties更新、確定後のsnapshot／求解／再結線は維持する。配置commandから後段commitへの既存callbackは同じ形でrootに残し、新しい遅延reader・初期化参照や可変app context／操作stateは追加しない。

app.jsは2,323→2,315行（8行減）、対象生成3→3、root直下の延べ引数78→53、未使用binding／初期化前直接参照0（TEMP cad-derived-instance-feature-audit.cjs）。元の配置入力と、source／確定後編集から共有した依存の値が元の配置入力と一致することもAST比較で確認した。行数だけでなく、同じ配置sessionを使うsource操作と確定後編集の入口を機能として揃える単位とし、数百行の目標達成とはしない。

既存derived-patterns.test.jsへ実PatternInstanceModel／GeometrySolver型／InstanceProjection／配置・source・確定後編集とSelectionを使う2境界試験を追加した。source操作が同じ配置sessionへ委譲されること、生成時のscope無照会、配置draftの同一参照とmodel／履歴の無変更、取消、確定後のmodel参照とsource Geometry維持、求解失敗時の復元と無履歴、同じIDの別Objectを配置中と扱わないこと、配置中の確定失敗後もdraftを保持し取消できることを確認した。既存fixtureは組立て差替え口を追加しただけで、既存期待値・数値上限は変えていない。関連単体25件、最終コードの全単体1,956件、構文615ファイルが成功。

関連E2E257件（既存UI・phase0保存互換性／描画比較・派生pattern／free Instance・Sketch投影・Block／固定・複数寸法・Hatch・Sketch移動・Parameter dialog）が全成功（4.0分、exit 0、runner33607）。TEMP cad-derived-instance-feature-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持する。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server35812の停止、製品source三つのhash不変を確認した。今回は全587件の再実行ではなく、最新全体基準37cb5d2の成功と区別する。新moduleをindex.html／tools/check-syntax.js／unified-uiのscript順期待へ登録し、spec/architecture/モジュール構成.mdとimplementation-map.mdへ配置と責務を記録した。

週枠使用35%／残量65%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も残る機能内の共有owner・初期化段階・test公開契約を確認し、巨大なapp contextや細分file・中継追加で目標を達成したとは扱わない。


### 最新：拘束確定と意図resolverを同じ操作Featureから段階生成（2026-10-24、検証完了）

基準develop／origin/developは2409fbd。ConstraintEditing.createCommitが元の後段位置で実ConstraintCommitCommand.createWithDimensionsを生成し、同じSelection・Sketch guard／active Sketch・target照会・Selection解除・通知を共有する。選択解決は同じSelectionQuery.resolutionへ、寸法配置は同じDimensionPlacementCommand.startDistanceResolutionへreceiverと引数／戻り値を保って接続する。返すcreateIntentResolverは元の次の位置で、同じ候補registry・active Sketch・参照元／子孫／循環判定と翻訳／invalid hintから実ConstraintIntentResolverを生成する。確定のcurrentScope、snapshot／復元、求解／挿入、履歴と計測は従来の独立したportで受ける。新しい操作state・遅延reader／初期化参照や可変app contextは追加しない。個別command／resolver factoryと既存の構築・bind順は維持する。

app.jsは2,326→2,323行（3行減）、対象生成3→3、root直下の延べ引数99→81、未使用binding／初期化前直接参照0（TEMP cad-constraint-commit-composition-audit.cjs）。単純な引数objectの束ねではなく、既存Featureが持つSelectionQuery／DimensionPlacementと共通依存を二つの後段componentへ直接接続する。rootだけにあったconstraintResolutionFromCurrentSelectionを除去した。ほかのhoisted入口は既存の早期callback登録を保つため残す。行数効果は小さいが依存の重複18項目を除いた単位とし、数百行の目標達成とはしない。

既存constraint-editing.test.jsへ2つの境界試験を追加した。実Selection／TargetSession・SelectionQuery／DimensionPlacement・ConstraintCommit／DimensionReadOnlyQuery・IntentResolverとGeometryを、従来の直接生成と新経路で組み立て、通常operand解決と選択確定成功、Solver失敗時のGeometry／拘束配列復元とSelection保持、寸法配置の同じpending／target、子孫参照拒否・編集guardを確認した。従来経路と通知／履歴／pending／計測traceも比較して一致し、構築時無通知を確認した。fixtureは新しい寸法配置経路用に実DimensionPlacementを接続し、既存の期待値・性能上限は変えていない。関連単体41件、最終コードの全単体1,954件と構文614ファイルが成功。

関連E2E300件（既存UI・phase0保存互換性／描画比較・Annotation anchor／注記・複数寸法・Spline・Sketch投影・Block・派生pattern／free Instance）が全成功（4.6分、exit 0、runner29987）。TEMP cad-constraint-commit-composition-{focused,unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonへ証跡を保持する。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server38444の停止と製品source二つのhash不変を確認した。今回は全587件の再実行ではなく、最新全体基準37cb5d2の成功と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdも更新した。

注記の権限・可視性も再確認したが、SketchContext・SketchEditAccess・GeometryAppearanceと異なるscope／役割に分かれており、それらを単一contextへ束ねる案は採用しない。引き続き共通の実ownerを共有できる境界と機能内の組立て・test公開契約を確認する。週枠使用33%／残量67%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。


### 最新：HatchのブラウザテストAPIを既存driverへ集約（2026-10-24、検証完了）

基準develop／origin/developは37cb5d2（構文614・全単体1,952・全587 E2E成功）。HatchTestDriver.createBrowserApiが通常Hatch→Block投影→転送の既存三factoryを同じscope・Hatch query・Selection・表示／保存／通知へ接続し、既存九つのブラウザ公開名との対応を所有する。appはtest query内の同じ位置で一度だけ生成し、返された公開objectを展開する。個別factoryは独立利用を維持し、projectionの型・定義生成／追加とtransferのClipboard／コピー・Block化依存を各入口で明示する。現在scopeは操作ごとに読み、Geometry／境界参照・採番／cache・履歴／UI／draw順や既存の返り値は変えない。新しいmodel／Selection／Clipboard／cache・可変app context・fileは追加しない。

app.jsは2,341→2,326行（15行減）、対象生成3→1、test組立ての延べ引数55→41、root／test組立ての未使用binding／初期化前直接参照0（TEMP cad-hatch-test-api-audit.cjs）。共通依存の重複指定と九つの公開名の対応付けをappからなくした。三つの既存factoryの本体はGit基準とのAST範囲比較で変更なしを確認した。行数効果だけでなく、機能ごとのテスト公開契約をそのdriverへ閉じる単位とし、数百行の目標達成とは扱わない。

テスト実装・期待値は変更していない。最終コードの全単体1,952件、構文614ファイルが成功。公開APIを利用する全九E2E file（drawing-order・Hatch・Sketch移動／編集・Reference Image・Sketch Tree可視性／削除・View visibility・既存UI）とphase0保存互換性／描画比較の計194件が成功（2.9分、exit 0、runner24909）。TEMP cad-hatch-test-api-{unit,check,e2e}.log、run.ps1、e2e-receipt.json、last-run.json、source-hashes.jsonに証跡を保持する。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server36212の停止と製品source二つのhash不変を確認した。今回は全587件の再実行ではなく、最新全体基準37cb5d2の成功と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdも更新した。

先行してAnnotationFeatureも再監査した。表示・空間照会・Anchor／Dimension・Command・Editor・Dragは既に同Featureが組み立て、早期のConstrained Annotation Dragは一般SolveScopeQueryへのscope／追加変数を提供する。これを単に後段Featureへ包み直すと遅延reader／初期化参照が増え、一般求解queryの所有も曖昧になるため、今回はその案を採用していない。今後は既存ownerの共有と初期化段階を確認して境界を選び、生成APIを追加するだけの中継や巨大objectへの引数束ねを増やさない。

週枠使用32%／残量68%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。残る大きな機能組立てとtest公開境界を続けて確認する。


### 最新：Blockの拘束再構築・Parameter伝播の接続を共有ownerへ統合（2026-10-24、全体検証完了）

基準develop／origin/developはc8aae38。本単位はcodex/block-rebinding-compositionで実施した。BlockEditingFeatureが既に保持するDocument・ConstraintRebindingからDefinition再構築と保存済み全Definitionの再構築を生成し、同じ入口をSession rollback／Completionへ接続する。Documentの現在blockDefinitionsを順に再構築して削除拘束数を合計する既存の処理と戻り値を保ち、appから二つの重複callback依存を除いた。createPropagationは同じcatalog・投影無効化・Definition再構築を実BlockParameterPropagationへ接続する。Document側は明示したreadEditingScope→Block投影bundle→再構築→成功時だけSelection解除という元の順序を維持する。workspace.currentと結線済みscope、通常Instanceを含む他処理のbundleを混同せず、安定化の入口・revision／cache順・失敗時の既存復元範囲は元のownerへ残す。新しいmodel／Selection／Solver／履歴や可変app context・fileは追加しない。

app.jsは2,353→2,341行（12行減）、対象生成2→2、root直下の延べ引数27→25、未使用binding／初期化前直接参照0（TEMP cad-block-rebinding-audit.cjs）。三つの再構築関数をrootから除去し、Block機能からroot callbackへ戻って同じrebindingを呼ぶ接続をなくした。行数効果だけでなく、責務の循環と共通依存の重複を減らす単位とし、数百行の目標達成とは扱わない。

既存block-editing-feature.test.jsの再構築spyは削除した個別callbackでなく共有rebinding portへ付け替え、取消時に実Definitionが再構築される期待を維持した。追加2単体は実ConstraintPersistence／Rebinding／BlockParameterPropagation／EditorSessionとGeometry・Selectionを使い、構築時無照会、親階層の再構築／安定化順、workspaceと異なる結線済みscopeの使用、Block投影Pointと元Geometryの同一参照・reference metadata、保存済み全定義の再構築を確認した。参照先欠損／codec例外／親安定化失敗で、Documentの拘束配列やSelectionを保持し、後続のSelection解除・Document安定化へ進まないことも確認した。数値・UI・保存互換性の既存期待は変えていない。関連単体26件、最終コードの全単体1,952件、構文614ファイルが成功した。

製品sourceを固定した全587 E2Eが成功（28.1分、exit 0、runner80037）。ドラッグ回帰fileは14.5分。性能上限・timeout・既存期待値は変更していない。fillets 3,744 preview／最大32.2ms、offsets 10,296／72.4ms、aircraft 1,872／296.7ms、coupled-lines 5,304／49.5ms、horizontal-line 936／33.6ms、vertical-line 936／169.8msで各failures 0。TEMP cad-block-rebinding-{focused,unit,check}.log、cad-block-rebinding-full-{run.ps1,e2e.log,e2e-receipt.json,last-run.json,source-hashes.json}に証跡を保持する。receipt exitCode 0／listeners 0、last-run passed／failedTests空、自己起動server40408の停止、製品source二つのhash不変を確認した。テスト対象のGit blobはapp.js=4a4e33c22b00169aaa888cd325e3e960f49c0143、block_editing_feature.js=82f4ed0b240e0c477d3f548161cb4a16ebab8382。spec/architecture/モジュール構成.mdとimplementation-map.mdも更新した。全体検証後にremoteを再取得し、main／developが検証中に更新されていないことを確認した。

週枠使用31%／残量69%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。最新全体検証は本単位の587件成功であり、古いa8e96f4の全体結果や後続の関連E2Eのみの結果と区別する。全体目標はactive・未完了。読み取り専用AST再監査（TEMP cad-block-rebinding-next-audit.json）ではrootの大きな生成引数はCanvasContextInteraction 58、ConstraintEditing 50、GeometryDragFeature 49、AnnotationFeature 48。次はこれらの既存機能内で共有ownerを再利用できる境界とtest公開APIを検討する。引数を巨大objectへ束ねるだけ・小関数の移動だけで200〜500行へ届くとは見積もらない。


### 最新：履歴buttonとToolbar／Statusの表示接続を既存表示機能へ統合（2026-10-24、検証完了）

基準develop／origin/developは2fbd09c。ToolbarView.createHistoryへapp内の履歴DOM反映を移し、undoBtn→redoBtn照会→現在active履歴→各disabled反映→Document保存状態通知の順と短絡／例外位置を維持する。DOMや履歴はcacheしない。PresentationFeature.createToolbarが同じDOM・ApplicationSettings・Lifecycle／Pending／Constraint session・Constructionをこの表示と共有し、後段のcreateControlsで既存ToolbarView→CommandStatusを生成する。Spline編集とactive履歴・後段Document通知は操作時readerを用いる。Toolbar snapshotの内容／照会順とFlyout後の再読取り、Statusの注記→拘束→mode優先順とbare readMode、Constructionのmethod receiverは維持する。履歴Controller直後の先行生成は無照会・無listenerで、既存UI／Status生成・更新とbindの時機は保つ。モデル／session／履歴のownerは変更せず、個別UI factoryも維持する。新fileや可変app contextは追加しない。

app.jsは2,365→2,353行（12行減）、対象生成2→2、root直下の延べ引数15→13、未使用binding／初期化前直接参照0（TEMP cad-toolbar-presentation-audit.cjs）。履歴buttonのDOM操作と操作snapshot構成・Construction表示adapterがappからなくなった。行数効果だけでなく、表示実装はUI、既存状態の各表示への接続はApplicationに置く境界として扱う。数百行の目標達成とはしない。

既存presentation-feature.test.jsへ追加した2単体は実ToolbarView／CommandStatus／History表示・EditHistory／HistoryController／Lifecycle／Pending／Constraint sessionを使い、構築時のDOM／状態無照会、Document／Block active履歴とUndo／Redo件数の反映、DOM差替え／要素不在、lookup→history→通知順、履歴照会失敗時の無変更・通知失敗後の後続UI停止と例外同一性を確認した。同じmode／pending／拘束によるbuttonとStatus表示、最新言語、Flyout中の操作変更後の最新Cursor入力も確認し、既存期待値は変えていない。関連単体23件、全単体1,950件、構文614ファイルが成功。関連E2E241件（既存UI・phase0保存互換性／描画比較・Toolbar配置・visibility・Block・Sketch移動／権限・派生pattern／free Instance・Hatch）も全成功（3.7分、exit 0、runner10525）。TEMP cad-toolbar-presentation-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server29744の停止と製品source三つのhash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準a8e96f4の成功と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdも更新した。

週枠使用29%／残量71%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残る機能内の接続・状態照会・test公開境界を再確認し、同じownerで閉じられる単位を選ぶ。


### 最新：Canvas選択のブラウザテストAPIを既存driverへ集約（2026-10-24、検証完了）

基準develop／origin/developは1d1ff6b。CanvasSelectionTestDriver.createSupportは既存SelectionとcurrentScope・clear／UI／drawから実ID観測を生成し、その同じreadSelectedGeometryを他driverと公開APIへ共有する。後段のcreateApiは既存Move観測→ID選択→重なり候補fixture→円弧端点fixture→context観測→Point追加を元の順序で生成し、既存七つの公開名への対応をdriver内に所有する。appはtest query内の元の二箇所で生成し、返された公開objectを展開する。現在scope・Selection／Geometry・Hover／viewport・Block定義／採番と履歴／UI／drawは既存ownerの入口を共有し、通常機能の実装・UIや独自状態は変更しない。既存の個別factoryも保持する。test hooksを巨大なapp contextごと別fileへ移す方法は採らない。

app.jsは2,381→2,365行（16行減）、対象生成7→2、root内test組立ての延べ引数58→35、root／test組立ての未使用bindingと初期化前直接参照0（TEMP cad-selection-test-api-audit.cjs）。今回はブラウザテストAPIの契約・共通依存の所有を整理する単位であり、数百行の目標達成とは扱わない。

既存canvas-test-driver.test.jsへ追加した2単体は実Selection／Hover／GeometryCreation／GeometryIds／BlockDefinitionEditingと公開APIを使い、構築時のscope／通知無照会、選択参照とscope切替後の最新Geometry参照、共通ID照会の同一性、context／Move観測、選択ID配列コピー、重なりBlock生成とcache→fit→履歴→UI→draw順、円弧端点fixture、現在viewportでの固定Point挿入、UI例外後のdraw抑制と例外同一性を確認した。既存期待値は変更していない。関連単体10件、全単体1,948件、構文614ファイルが成功。関連16 E2E fileの288件（既存UI・Block／固定・派生pattern／free Instance・centerline・Hatch・phase0保存互換性／描画比較・PNG・Sketch権限／移動／投影・Spline・thread・toolbar・visibility）も全成功（4.4分、exit 0、runner93418）。公開API利用fileのうち長時間のadversarial-drag-fixture／adversarial-authoring-performance／constraint-drag-regressionsの3 fileは今回実行しておらず、最新全体基準a8e96f4の587件成功と区別する。TEMP cad-selection-test-api-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server19840の停止と製品source二つのhash不変を確認した。spec/architecture/モジュール構成.mdとimplementation-map.mdも更新した。

週枠使用28%／残量72%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も公開APIの機能別責務と通常機能の構築依存を確認し、巨大なcontext／細分fileや中継を増やさずに閉じられる単位を選ぶ。


### 最新：Canvasメニューの早期生成と後段の操作接続を機能内へ統合（2026-10-24、検証完了）

基準develop／origin/developはebf5d45。CanvasContextInteraction.createMenuが既存CanvasContextMenuを元の早期位置で生成し、同じDocument・翻訳・CanvasHover・描画・menu element／controllerを保持するcreateInteractionを返す。appは後段の元の位置で実Interactionを生成し、従来どおりcontroller.startを呼ぶ。候補presenterとInteractionは二つの明示的なreaderから操作時だけ参照し、初期化時には照会しない。候補presenterのbare呼出し、Interactionのmethod receiver、Hover各関数の既存receiverと引数／結果・例外伝播を維持する。新しい操作state／listener・可変app contextやファイルは増やさず、Menuのsnapshot／復元とstart／dispose、Target・Entry・Actionsの判断を既存ownerへ残す。個別create APIも維持する。

app.jsは2,389→2,381行（8行減）、対象生成2→2、root直下の延べ引数74→67、未使用binding／初期化前参照0（TEMP cad-context-menu-audit.cjs）。rootの四つの中継関数と不要になった三つのHover別名を除去した。行数効果だけでなく、早期menuと後段interactionへの共通依存の重複接続を減らす単位として扱う。数百行の目標達成とはしない。

既存canvas-context-interaction.test.jsへ追加した2単体は、実CanvasContextMenu／Interaction／Selection／Hoverで、構築中の後段reader無照会、明示start前の無処理と重複start防止、候補previewの無選択変更と元hover参照の復元、候補確定、表示中に変更された最新拘束commandへの元pointer／対象の受渡し、閉じてからのaction実行、disposeの全listener解除を検証する。既存期待値は変更していない。関連単体16件、全単体1,946件、構文614ファイル、関連E2E214件（Block・Spline・Hatch・複数寸法・Sketch権限／移動・phase0保存互換性／描画比較・既存UI）が成功（3.2分、exit 0、runner34170）。TEMP cad-context-menu-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server40692の停止、二つの製品source hash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準a8e96f4の成功と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdも更新した。

週枠使用28%／残量72%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残る機能間接続・初期化段階とtest hooks公開境界を再監査し、同じownerで閉じられる責務を選ぶ。


### 最新：Propertiesの選択・編集・表示を共有ownerで段階構築（2026-10-24、検証完了）

基準develop／origin/developはa8e96f4（構文614・全単体1,942・全587 E2E成功）。本単位はcodex/properties-feature-compositionで実施した。PropertiesDisplay.createFeatureが同じDocument／DOM・currentScope・Selection／readServices／SketchContext／Hatch外観から実PropertySelectionを生成し、createEditing→createViewで同じ選択queryと実編集command／AppearanceUIを既存Controller／Viewへ接続する。共通通知・言語・HTML escapeを一度接続し、段階固有の依存は既存factoryの契約で転送して構築処理や引数宣言を重複実装しない。選択用selectionOperation（Block定義ID等）と表示用getOperation（配置Sketch ID・rotation lock等）、編集currentScopeと外観appearanceScopeの違いを維持する。旧生成順とappearanceUI.start／View render時機を変えず、新state／cache・palette／listenerや可変app contextは追加しない。既存の個別factoryも維持する。

app.jsは2,391→2,389行（2行減）、対象生成3→3、root直下の延べ引数74→55、未使用binding／初期化前参照0（TEMP cad-properties-feature-audit.cjs）。行数効果は小さいが、選択／編集／Viewへ同じ実体を繰り返し指定する接続を減らし、Props内の依存と外部actionの境界を明示する。

追加2単体は実PropertySelection／PropertyEditingFeature／AppearanceUI／PropertiesController／Viewを使い、構築時のDOM／operation無照会、同じSelectionとPointの同一性、previewで無履歴・commitで一回の履歴、選択変更後の別Point編集とlock拒否を確認した。さらに選択用と表示用で内容の異なる二readerを実配置Propertiesの表示とactionへ接続し、定義参照同一性・両readerの操作時読取りとaction結果を維持した。既存テストの期待は変更していない。関連単体19件、全単体1,944件は成功。構文614ファイルと関連E2E205件（Properties・Leader外観・注記・Hatch・派生pattern・画像・複数寸法・phase0保存互換性／描画比較・既存UI）も全成功（3.1分、exit 0、runner91697）。TEMP cad-properties-feature-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server31660の停止と二つの製品source hash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準a8e96f4と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用26%／残量74%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残る機能内構築と機能間接続を再確認し、共通ownerを生かすAPIと初期化段階を整理する。今回の2行減を200〜500行のcomposition root達成とは扱わない。


### 最新：拘束コントロールの表示と後段bindingを機能層へ統合（2026-10-24、全体検証完了）

基準develop／origin/developはcbb0d02。本単位はcodex/constraint-controls-featureで実施した。ConstraintEditing.createControlsが同じSelectionQuery・Target／DimensionPlacement・session／pendingと通知から実ConstraintControlsViewを生成し、返すcreateBindingで後段に実ConstraintControlCommand→既存button bindingを生成する。appから加える依存はdocument・button／menu／Fix・hasSelection・翻訳の六つ。拘束label等は先行生成、Viewは元の位置、ControlCommandとbinding生成／bindはFixedSelection準備後の元の位置を維持する。Pending distanceのannotationAnchor／interval除外、無効target時のcancel messageとDOM反映前の確認順、非Geometry modeでの短絡も同じFeatureへ閉じる。Target／Dimensionへの呼出しは旧root委譲と同じreceiver・引数／戻り値を維持し、操作優先順位は実ControlCommandへ残す。Selection・モード・Pending／listener状態を増やさず、個別factoryも維持する。

app.jsは2,409→2,391行（18行減）、対象生成／接続3→2、root直下引数30→6、未使用binding／初期化前参照0（TEMP cad-constraint-controls-audit.cjs）。不要になったcanApplyConstraint／distanceTargetFromSelection／startConstraintTargetCommandのroot委譲を除去した。三番目は最初の関連E2E中の監査で見つけたため、その実行終了後に除去し、製品sourceを固定して全体検証へ進んだ。

実Selection・TargetSession・SelectionQuery・Target／DimensionPlacementとView／ControlCommand／Bindingを使う追加2単体で、生成／bindまで無照会、bind前の無処理と重複防止・dispose再bind、menu→button、対象選択の開始／取消と表示、Fix、距離配置とpending target同一性、選択後の既存Fixed操作への委譲、distance取消と例外／exempt／Geometry mode短絡を検証した。既存テストの期待は変更していない。関連単体18件成功、最終コードの全単体1,942件と構文614ファイルも成功。

中間コードの関連E2E161件（複数寸法／Slot寸法・command panel・Block geometry fixed・派生pattern・phase0保存互換性／描画比較・既存UI）は全成功（2.4分、exit 0、runner91049）。TEMP cad-constraint-controls-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server14020の停止と中間source hash不変を確認した。

最終コードの全587 E2Eは全成功（27.7分、exit 0、runner51020）。TEMP cad-constraint-controls-full-run.ps1／cad-constraint-controls-full-e2e.log、full-e2e-receipt.jsonのexitCode 0／listeners 0、full-last-run.jsonのpassed／failedTests空、自己起動server35684の停止と二つの製品source hash不変を確認した。長時間のドラッグ検証fileは14.6分で正常終了した。制限時間・性能基準・期待値を変更せず、fillets 3,744 preview／最大30.6ms、offsets 10,296／67.3ms、aircraft 1,872／331.1msもfailures空を確認した。最終製品sourceのGit blobはapp.js b859699cb2aa41ae80fd630ee89e5f349ff067c4、constraint_editing.js f6dd96e3fecfb0f5d157fcc38f3bf57e7badde04。これを最新の全体検証基準とし、旧f6727f7の基準とは区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用26%／残量74%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。今回の生成／接続の整理や全体検証だけで200〜500行のcomposition root達成とは扱わない。次は最新rootの機能内構築と機能間接続を再確認し、狭い機能APIでまとめられる単位を選ぶ。Commit／Push／develop統合後の実際のrefはGitで確認する。


### 最新：Block編集とViewの共有結線（2026-10-24、検証完了）

基準develop／origin/developは7833e02。本単位はcodex/block-view-featureで実施した。BlockEditingFeature.createCommandsがcreateViewを返し、同じBlockEditorSession／Queries・CanvasSelection・実Definition／Completion command、updateBlockUI・履歴を実BlockViewへ結線する。appから追加するのはdocument／escapeHtml／配置開始／localizeの四つ。編集名／一覧／使用数／選択IDは操作時に同じownerを読み、nameのinputとchangeの区別・sessionがある場合だけの履歴、refresh→localize→dialog表示、入力保持、cancel／completeの既存順を維持する。View生成とbindは旧位置、commandのView参照は既存の遅延callbackで、追加session／state・汎用app contextは作らない。

app.jsは2,420→2,409行（11行減）。対象生成1→1、root直下引数16→4、未使用binding／初期化前参照0（TEMP cad-block-view-feature-audit.cjs）。name／使用数等の内部照会と編集操作の個別接続をfeatureへ閉じ、不要なroot query／rename／remove aliasを除去した。

実BlockView・session・query・Definition／Completionを使う追加2単体で、生成時のDOM／model無読取り、定義scopeと使用数・Selectionの共有、escape・編集中name入力保持、inputとchange時のhistory区別、配置のdialog終了→callback、cancelのhost復元と古い入力の無履歴、registry rename・使用中削除拒否・定義削除、実Viewからのcomplete成功と一回のhistoryを確認した。既存のテスト期待は変更していない。関連単体19件、全単体1,940件は成功。構文614ファイルと関連E2E185件（Block・Block geometry fixed・派生pattern・phase0保存互換性／描画比較・既存UI）も全成功（2.7分、exit 0、runner17592）。TEMP cad-block-view-feature-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server25312の停止と二つの製品source hash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準f6727f7と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用24%／残量76%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残存rootの構築と機能間接続を再確認し、既存ownerの公開APIと共有依存を使える単位を選ぶ。11行減を最終の200〜500行達成と扱わず、責務境界を優先して継続する。


### 最新：Sketch編集とTreeの共有依存を機能層へ集約（2026-10-24、検証完了）

基準develop／origin/developは15736d8。本単位はcodex/sketch-tree-featureで実施した。SketchEditingFeature.createTreeで実SketchTreeController.createWithDocumentObjectsを生成し、既存SketchContext・Selection・基本SketchCommand・共通UI／draw・選択解除・編集guardを共有する。Move／Deletionの実owner、object metadata・readServices／Hover／Highlight、外部の編集操作は個別に接続する。TreeのdimensionScope、Viewのbound viewScope、commandのcurrentScopeを区別し、Objects／View／Controller／menuの実APIとmenu後段代入／startの時機を維持する。Treeの操作状態・DOM表示、モデルの更新は既存ownerに残す。新しい可変context・session・UI stateやlistenerは作らない。

app.jsは2,421→2,420行（1行減）。対象生成1→1、root直下引数38→26（nested objectOptionsのmetadataは維持）、未使用binding／初期化前参照0（TEMP cad-sketch-tree-feature-audit.cjs）。不要となったensureSketchState／renameSketch／toggleSketchLockのroot aliasを除去した。行数効果は小さいが、同じ編集ownerからUIの操作を接続して個別の受渡しを減らす変更である。

実Tree／View／Objects／menuと実SketchCommand／Move／Deletionを使う追加2単体で、無model読取りと既存の四DOM照会順、View／dimension／commandの三scopeの区別と同じSelection、行の選択と明示編集の違い、表示切替／lockと削除拒否、同じMove sessionでの移動先選択→確定→一回の履歴、Geometry移動後の削除を確認した。fixtureの外観照会はSketch外観と要素外観を合成する実契約へ補正し、既存テストの期待は変更していない。関連単体36件、全単体1,938件は成功。構文614ファイルと関連E2E212件（Sketch権限／移動・Block・Hatch・派生pattern・phase0保存互換性／描画比較・既存UI）も全成功（3.1分、exit 0、runner47065）。TEMP cad-sketch-tree-feature-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server5376の停止と二つの製品source hash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準f6727f7と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用23%／残量77%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残る機能内部の構築と機能間接続を再確認する。共有ownerの狭いAPIを生かす単位を選び、今回の1行減や部分成果を200〜500行のcomposition root達成と扱わない。


### 最新：PNG書き出しとCanvas基盤の共有結線（2026-10-24、検証完了）

基準develop／origin/developは33215fe。本単位はcodex/canvas-png-compositionで実施した。CanvasDisplay.createWorkspaceが返すcreatePngExportで実PngExportを生成する。同じCanvas／document／browser window・viewport・exportRenderer・Geometry read cache・言語／hint／drawを共有し、追加依存はDocument名・画像準備・Lifecycle／Pending／fileSession／拘束session・snap／pointer flushの八つ。readMode／setModeは同じLifecycle、出力倍率は同じviewportから取得する。実feature APIを返し、commandの後段代入とstartは元の位置を維持する。PNGの範囲・save／mode／busyとframeは各既存ownerが持ち、cache／viewport／renderer・listenerや可変app contextを追加しない。

app.jsは2,424→2,421行（3行減）。対象生成1→1、root直下引数19→8。未使用binding／初期化前参照0（TEMP cad-canvas-png-audit.cjs）。root削減量よりも、同じ描画基盤と機能固有の依存の境界を整理する変更である。

実PngExport／Command／CanvasExport／renderer・PngFileを使う追加2単体で、生成時の無読取り、明示start／disposeと同じfileSessionの拒否、flush例外の短絡、現在viewport倍率とsnap tolerance／cache戻り値、同じLifecycle／Pendingの遷移と取消を確認した。保存はfonts→画像準備→実renderer frame→bitmap copy→blob→書込みの順で、描画例外でもframe・bitmap寸法・viewportを復元し、PNG sessionを維持してerrorを表示する。FixtureのGeometry cache入口は実契約どおりcallbackの戻り値も返すよう補正し、既存テストの期待は変えていない。関連単体22件、全単体1,936件は成功。構文614ファイルと関連E2E141件（PNG書き出し・画像・command panel・phase0保存互換性／描画比較・既存UI）も全成功（2.1分、exit 0、runner90428）。TEMP cad-canvas-png-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server34952の停止と二つの製品source hash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準f6727f7と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用22%／残量78%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残る機能内部の構築と機能間接続を再確認し、同じ所有者のAPI・共有依存を利用してまとめられる単位を選ぶ。3行減を最終の200〜500行の達成と扱わず、責務境界を優先して継続する。


### 最新：DXF読込をDocumentファイル機能へ接続（2026-10-24、検証完了）

基準develop／origin/developは51784c5。本単位はcodex/document-dxf-compositionで実施した。既存DocumentFileFeature.createDxfが実DxfImportCommandを構築し、同じfileSession・serializeModel／変更signature・選択dialog・言語／hint・fit／drawを共有する。appから追加するのはGeometry／IDs・currentScope／activeSketchId・canImport／最小長さと成功時のSelection解除／UI更新／履歴。成功通知順と保存checkpointを変更しない点を維持し、createControlsで同じcommand／許可readerとsessionを実DocumentFileControlsへ接続する。command構築・control生成／bindは既存の位置で行い、Document start／disposeとDXF bindingの寿命を勝手に統合しない。読み込み中の図面／scope／作図先の変更やlockを拒否し、ID／Geometryの挿入・復元・busy解除は元commandが所有する。新file／global state／sessionは追加しない。

app.jsは2,436→2,424行（12行減）。対象生成／接続2→2、root直下の延べ引数20→10。root未使用binding／初期化前参照0（TEMP cad-document-dxf-audit.cjs）。DXF固有の完了callbackをファイル機能内へ閉じ、ボタンのイベント解釈は既存UI moduleに維持する。

追加2単体で実parser／Geometry／IDs／fileSessionと返された実controlを使い、構築時の無実行・bind時機と重複防止／dispose再bind、flush→busy拒否またはpicker、input値の即時clear、Geometry同一性・Sketch／座標／非construction、一回の履歴と通知順、checkpointを更新せずDocumentをdirtyにすることを確認した。shared dialogでの単位選択取消、非同期読取中の図面内容／scope／作図先／許可変更の四ケースは無挿入・ID無消費・履歴なしでbusyを解除する。既存テストの期待は維持した。関連単体19件、全単体1,934件は成功。構文614ファイルと関連E2E178件（DXF読込・Block・Sketch権限・phase0保存互換性／描画比較・既存UI）も全成功（2.6分、exit 0、runner43503）。TEMP cad-document-dxf-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server40948の停止と二つの製品source hash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準f6727f7と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用22%／残量78%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残存rootの機能生成とbind／startの段階を再確認する。関連する責務と共有依存を実ownerへ集める方針を維持し、今回の12行減を200〜500行のcomposition root達成と扱わない。


### 最新：Sketch移動後の更新手順を所有者へ統合（2026-10-24、検証完了）

基準develop／origin/developは8de34b0。本単位はcodex/sketch-move-refreshで実施した。SketchEditingFeature.createMoveが既定のrefreshGeometryを構築し、同じBlock projections・Geometry readerを用いて、Block cache→Geometry cache→Hatch cache→実editing scopeとBlock／派生Instance bundleで拘束再接続→分析無効化→参照有効性更新の順に委譲する。移動planのcurrentScopeと再接続対象のreadEditingScopeを混同せず、後者とbundleは更新時に読み、従来のmethod receiver／bare callbackを維持する。途中例外の捕捉・所属／参照metadata／描画順／元拘束配列の復元は実SketchMove.apply、成功／失敗通知とsession／Selection／履歴は実SketchMoveCommandに維持する。新たな求解・cache巻戻し・stateは追加しない。明示refresh callbackを使う旧createMoveも維持し、この場合は既定の更新依存を読まない。

app.jsは2,443→2,436行（7行減）。対象生成1→1で、root直下の引数は2→6へ増加する。旧refresh callback内でappに閉じていた更新手順を既存Sketch編集ownerへ移管する変更であり、引数削減の成果と取り違えない。root未使用binding／初期化前参照0（TEMP cad-sketch-move-refresh-audit.cjs）。

追加2単体で、実移動commandが所属変更後に更新を始め、各method／bare callbackのreceiverと更新順、操作時のbound scopeと投影bundleを使い、成功時だけ一回の履歴を記録することを確認した。九つの途中段階（Block／Geometry／Hatch cache・bound scope・Block／Instance bundle・再接続・分析・参照）それぞれの例外では後続が停止し、Geometry／元拘束配列の同一性と所属／描画順・Selectionが復元／維持され、移動sessionで再試行できる。関連単体37件、全単体1,932件は成功。構文614ファイル、関連E2E212件（Sketch権限／移動・Block・Hatch・派生pattern・phase0保存互換性／描画比較・既存UI）も全成功（3.1分、exit 0、runner33537）。TEMP cad-sketch-move-refresh-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server26096の停止と二つの製品source hash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準f6727f7と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用21%／残量79%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残存rootの機能生成とbind／startの段階を再確認する。app内に残るoperation手順と機能間接続を区別し、既存ownerが共有する依存を使ってまとめられる単位を選ぶ。今回の7行減を200〜500行のcomposition root達成とは扱わない。


### 最新：Sketch編集の段階的な生成を機能層へ集約（2026-10-24、検証完了）

基準develop／origin/developは9b4aa8e。本単位はcodex/sketch-editing-compositionで実施した。新しいsrc/application/sketch_editing_feature.jsのSketchEditingFeatureが実SketchCommand、実SketchMove query→SketchMoveCommand、実SketchDeletionCommandの生成・共有依存接続を所有する。currentScope・SketchContext・Document IDs・Selection・Geometry read・Block projections・ConstraintReferencesとinteraction reset／選択解除・UI／履歴を共有する。基本commandはcreate、移動は後段createMove、削除はHatch生成後のcreateDeletionで生成し、旧constructor順とTree外入力bindingの時機を維持する。Lock準備とMove準備の取消順は別のcallbackのままで、移動先選択・削除plan・モデル変更・復元・履歴は既存ownerに残す。新feature自身はsessionやcacheを持たず、巨大app contextや新global操作状態は追加しない。

app.jsは2,451→2,443行（8行減）。対象生成4→3、root直下の延べ引数68→32、未使用binding／初期化前参照0（TEMP cad-sketch-editing-audit.cjs）。新fileの有無や行数を目的にせず、同じSketch編集の共有依存と内部構築をまとめた。index.htmlと構文検査・単体一覧・unified-uiの読込期待へ新source／testを明示登録した。

実SketchContext・Selection・ConstraintReferencesと三つの実commandを使う追加2単体で、生成時の無照会、移動前後のGeometry同一性・精度・一回の履歴、active切替時の移動reset、現在scope差替え後のSketch作成／削除、IDsのreceiver、削除拒否・lock拒否とモデル無変更を確認した。移動refresh例外は既存Queryで捕捉して所有と描画順を復元し、sessionを維持してhistoryを記録しない（例外伝播へ変更しない）。既存テストの期待は維持した。関連単体35件、全単体1,930件、構文614ファイルは成功。関連E2E212件（Sketch権限／移動・Block・Hatch・派生pattern・phase0保存互換性／描画比較・既存UI）は全成功（3.1分、exit 0、runner7235）。TEMP cad-sketch-editing-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動server19448の停止と二つの製品source hash不変を確認した。今回は全体587件の再実行ではなく、最新全体基準f6727f7と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用21%／残量79%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次はSketch移動後のprojection／Geometry／Hatch cacheと拘束再接続・分析／参照有効性更新を実行するrefreshSketchMoveGeometryを検討する。新featureが既に共有するreaderとBlock projectionsを使えるが、workspace.currentとeditingScopeBinding.currentの違い、更新順、失敗時の復元との境界を確認してから扱う。小さいcallback移動だけで200〜500行へ届くと見積もらず、段階的な構築・接続の整理を継続する。


### 最新：右クリック候補照会とscene読取りの共有（2026-10-24、検証完了）

基準develop／origin/developはf5908fa。本単位はcodex/context-hit-compositionで実施した。CanvasHitInteraction.createScene().createQueries()が返すcreateContextQueryで既存CanvasContextQueryを生成する。同じcurrentScope・viewport・pointUsage・Sketch可視性・projection／Geometry read・寸法layout・Hatchと実regionsの画像hitを共有し、appから渡す後段依存は編集中SplineのfitPoints readerと注記context hitだけ。候補の受付とrankは既存Query、Selection・編集guard・menu状態は元ownerに残す。通常のmode／pending／編集可否によるhit制限をcontext候補へ持ち込まず、ContextのcurrentScopeと寸法hitのdimensionScopeを区別する。初期化位置と各callbackのreceiver／例外伝播を維持し、モデル／候補／cacheは増やさない。

app.jsは2,462→2,451行（11行減）。対象生成1→1、root直下引数12→2。context専用の点選択predicateと未使用になったpointUsage／Hatch aliasを除去した。未使用binding／初期化前参照0（TEMP cad-context-hit-audit.cjs）。既存Sceneに必要な情報を利用する変更で、引数の袋を別moduleへ移すだけの上位contextは作らない。

追加2単体は、構築時の無照会、可視かつlocked／inactiveの候補受付と通常mode／pendingからの独立、明示点predicateの短絡と端点判定、編集fit point優先、現在scope／倍率／表示判定の反映を実Queryで確認する。さらにDocument寸法と別のdimensionScope、実layoutのreceiver、Block／派生Instance bundleと注記hit／画像の同一参照、例外後の後続projection短絡とモデル無変更を検証した。関連単体21件、全単体1,928件、構文612ファイルは成功。関連E2E245件（Block・Hatch・注記・画像・寸法・派生pattern／copy・Spline・phase0保存互換性／描画比較・UI）は全成功（3.6分、exit 0、runner22140）。追加でSketch権限／移動19件も成功（17.4秒、exit 0、runner86879）。TEMP cad-context-hit-{focused,unit,check,e2e}.logとcad-context-sketch-e2e.log、両receiptのexitCode 0／listeners 0、両last-run passed／failedTests空、自己起動server38268／24640の停止と二つの製品source hash不変を確認した。今回の関連E2E計264件は全体587件の再実行ではなく、最新の全体基準f6727f7と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用20%／残量80%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残存rootの構築と起動の段階を再確認し、複数ownerの共有依存を減らせる機能単位を選ぶ。小さな照会分離だけで200〜500行へ届くと扱わず、現物の依存と責務から進める。


### 最新：Canvas入力とPointerの共有結線（2026-10-24、検証完了）

基準develop／origin/developはbcddba8。本単位はcodex/canvas-pointer-contextで実施した。CanvasCommandInputs.createFeatureが従来の五つの入力をinputsとして返し、bindPointerで既存PointerInteractionController sessionへ結線する。旧createは五つの入力APIだけを返す互換入口として維持する。入力とPointerが共有するmode／pending reader、Selection・Hover・矩形選択・Annotation／Geometry drag・snap解除・描画・TransientAuthoring・viewportを一度受け、dimension dragには同じDimensionDragFeature.commandを使う。press query／activation操作、preview／hit更新・navigation・履歴等は別の明示依存として接続する。session生成とbindの位置、座標関数のpress receiver、入力生成順・処理優先順位・例外時の途中状態を維持し、新state・cache・listenerや汎用app contextは増やさない。

app.jsは2,465→2,462行（3行減）。対象二つの構築／接続のroot直下引数は63→54（nested press／activationの削減は別）。未使用binding／初期化前参照0（TEMP cad-pointer-context-audit.cjs）。削減量を行数目標の達成とは扱わない。実Pointer sessionと実入力adapter／Selection／Hoverを使う追加2単体で、bind時の無照会、同じsession・Selection、live mode／pending、preview・注記配置・double click、query例外の途中状態、drag終了順と履歴抑止・hover解除を確認する。

初回E2EでPointer終了時のTransientAuthoring接続不足が発覚した。createDrawingInputを使うapp側にも同じownerを明示して渡すことで修正した（期待値の緩和なし）。初回ログはTEMP cad-pointer-context-before-fix-e2e.logへ保存した。修正後の関連単体33件、全単体1,926件、構文612ファイルが成功。同じ関連E2E182件（command panel・注記入力／drag・ReferenceImage・寸法drag・派生pattern／選択copy・Spline・phase0保存互換性／描画・既存UI）も全成功（2.8分、exit 0、runner52870）。TEMP cad-pointer-context-{focused,unit,check,e2e}.log、e2e-receipt.jsonのexitCode 0／listeners 0とlast-run passed／failedTests空、自己起動server39444の停止、二つの製品source hash不変を確認した。今回の全E2Eは未実行で、最新全体基準f6727f7の587件成功と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用20%／残量80%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残存する機能間接続と機能内部構築を再確認する。入力まわりの小さな移動だけを続けず、生成・bind／start段階と既存ownerの狭いAPIでまとめられる単位を検討し、200〜500行の目標を維持する。


### 最新：Pointと通常作図入力の所有者への接続（2026-10-24、検証完了）

基準develop／origin/developは6cd037e。本単位はcodex/authoring-canvas-inputで実施した。BasicDrawingTools.createCanvasInputが実PointCommand→DrawingCommandInputを構築し、createAuthoring().createCanvasInputは共有済みGeometry／snap／transient／Selection／求解更新とprimitive input／Splineを接続する。外部依存はmode readerとCenterline／円中心十字／Fillet／Trim／Offsetの六つ。CanvasCommandInputs.createのcreateDrawingInput callbackを、従来のPoint生成位置（Annotation→Constraint→Instanceの後、Selectionの前）で一度だけ呼ぶ。raw依存による旧入口も同じ共通factoryを使い、構築処理を重複させない。既存のmode分岐・Point生成規則・draftやSelection状態は各childに残す。

app.jsは2,466→2,465行（1行減）。五つの作図handler中継bindingを撤去し、Point固有の依存をappから外した。対象構築1→1、root直下引数52→41。ただし新factoryへ六つの引数を渡しているため、容器callbackを除いて展開した末端は52→46であり、11依存減と過大に扱わない。未使用binding／初期化前参照は0（TEMP cad-authoring-input-audit.cjs）。物理行削減より内部構築と機能間接続の境界整理を目的とする。Point／Drawingを先行生成して他adapterの生成順を変えず、new state・model・巨大contextは追加しない。

追加3単体で、実Point／Drawing inputと共有authoring ownerのsnap tolerance／snap Object／新Point／Selection同一性、仮rollback順と失敗時の無生成、Centerline／円中心十字／Fillet／Trimの引数とbare callback、Offset receiver／hit束、未知mode拒否、factory一度の構築位置と返す実API、旧callback未参照とfactory例外後のSelection生成短絡を確認した。既存の互換入力テストと期待は変更しない。関連単体32件、全単体1,924件、構文612ファイルが成功。ログはTEMP cad-authoring-input-{focused,unit,check}.log。

Spline・円弧／Centerline・command panel・派生pattern・注記入力／drag・phase0保存互換性／描画比較・既存UIの関連E2E167件は全成功（2.4分、exit 0、runner9289）。cad-authoring-input-e2e-receipt.jsonのexitCode 0／listeners 0、last-run passed／failedTests空、自己起動port8799の停止、三つの製品source hash不変を確認した。今回の全E2Eは未実行で、最新全体基準f6727f7の587件成功と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。

週枠使用18%／残量82%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次はCanvas入力が共有するpointer bindingの生成段階を検討する。CanvasCommandInputsとPointerが同じmode／pending・Selection／hover・drag ownerを使う点、pressのquery／activationとevent処理の区別、現在のbind位置を確認する。旧createの五つの公開APIを維持し、別の可変app contextや操作状態の複製を作らずに既存ownerへ共有接続する。200〜500行の目標は維持する。

### 最新：空白ジェスチャーの後段生成と作図機能への接続（2026-10-24、検証完了）

基準develop／origin/developはf6727f7（構文612・全単体1,919・全587 E2E成功）。本単位はcodex/blank-gesture-compositionで実施した。BasicDrawingTools.createAuthoring().createBlankGestureが、同じline／Spline／snap／preview／transient／Selectionと通知・取消を既存BlankCanvasGestureへ結線する。外からLifecycle・pending／constraint session・Spline編集・寸法／Offset／Annotation入力・選択UI更新の八owner／入口を受ける。時計は既定performance.now、テストでは明示注入する。認識／優先順位・candidate／抑止stateは既存Gestureが所有し、複製しない。従来の直接create APIを維持する。

app.jsは2,486→2,466行（20行減）、対象構築1→1、明示port29→8、root未使用binding／追加接続の初期化前参照0（TEMP cad-blank-gesture-audit.cjs）。GestureをScene interactionの最初の直接consumer直前で生成し、前段Spline開始用resetBlankCandidateは遅延callbackを維持する。BasicDrawingTools／SplineCommand／Lifecycleのconstructorはresetを実行せず、mode・draft・timerを読まない。後段で実commandが揃うため、早期の27callbackによる接続を減らせた。新しい可変phase containerやglobal操作状態は持たない。

実BlankCanvasGesture／Lifecycleと組立て済みcommand・transientの追加2単体で、生成時にlive getterを評価しないこと、Spline確定→Spline編集→寸法／Offset／注記→pending／拘束取消の優先順位、Spline編集のraw戻り値、Annotation.finishのreceiver、現在Selectionの解除、実line／transient rollback→preview／snap／選択／UIの順と例外時の短絡を確認した。既存の450ms／6px・一回抑止・クリック意味・rollback範囲と、既存期待は変更していない。関連単体51件、全単体1,921件、構文612ファイルが成功。ログはTEMP cad-blank-gesture-{focused,unit,check}.log。

Spline・円弧／Centerline作図・command panel・注記入力／drag・保存互換性／描画比較・既存UIの関連E2E172件は全成功（2.6分、exit 0、runner93043）。cad-blank-gesture-e2e-receipt.jsonのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止、二つの製品source hash不変を確認した。全E2Eは今回未実行で、直前f6727f7の全587件成功と区別する。spec/architecture/モジュール構成.mdとimplementation-map.mdへ設計を記録した。

週枠使用16%／残量84%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次も残存rootの機能間接続と内部構築を区別する。CanvasCommandInputs／Pointer bindingはScene query・Selection・作図と同じownerを使うが、read／mutation・gesture状態とbind時機の境界を確認してから扱う。大量のAPIを別の袋へ移すだけの上位moduleは作らず、200〜500行の目標を今回の20行減で達成扱いにしない。

### 最新：Document保存・読込の内部構築（2026-10-24、全体検証完了）

基準develop／origin/developは2ed4adc。本単位はcodex/document-persistence-contextで実施した。DocumentWorkspace.createReadContext().createPersistenceが、同じDocument／Workspace・Parameter／Sketch／ID・実GeometryReadServicesを使う寸法codec／constraint metadata・保存前Preparation・Snapshot writer・読込codec群を構築し、実child七つを返す。八依存はplacement・PointUsage・bound編集scope／Block session reader・version・Point参照判定・投影共有点分離・Arc正規化。実load適用・reset・採番回復・履歴・ファイルUIは既存ownerに残す。新しい状態・cache・モデル・可変contextやfileは追加しない。

app.jsは2,504→2,486行（18行減）、対象構築6→1、明示port34→8、root未使用binding／追加接続の初期化前参照0（TEMP cad-document-persistence-audit.cjs）。構築をeditingCheckpoint直後へまとめた。各constructorはモデル・scope・UI・履歴を評価せず、早期のBlock編集／Historyへのserialize／decorate／deserializeはhoisted入口を維持する。Workspace.snapshotSource、Preparationのbound編集scope、固定Document catalogの違いを維持する。

追加2単体で、無照会構築、Hatch counterとDocument名、寸法／Parameter属性、geometry参照のround trip、decode時の入力／実Document無変更、Workspace切替／復元に追従するsnapshot、bound scopeだけのPreparation、不正単位の拒否、明示installの同一Object／Arc正規化を確認した。新fixtureはhatchSeqとlabelOffsetUを実schemaへ合わせ、既存期待は変更していない。関連単体36件、全単体1,919件、構文612ファイルが成功。ログはcad-document-persistence-{focused,unit,check}.log。

同じsourceを固定した全587 E2Eが27.5分、exit 0で全成功（native54101、最終観測cell1002も終了）。フィレット3,744 previews／maximumMs 29.2、Offset10,296／67.8、航空機1,872／344.1はいずれもfailures空。既存のtimeout・期待値・case数は変更しない。TEMP cad-document-persistence-e2e.log、-e2e-receipt.json（exitCode 0／listeners 0／owned server37076停止）、-last-run.json（passed／failedTests空）と二つの製品source hash一致を確認した。今回が最新の全体基準であり、17defd0の旧全体基準から更新する。実行中はsourceを変更せず、同じsessionを終了まで追跡した。

spec/architecture/モジュール構成.mdとimplementation-map.mdを更新し、bootstrap-boundary-audit.mdへ同条件の再集計を記録した。非空白2,042→2,024、member create構築154→149、構築部分953→931、hooks440／一文委譲209／root let6は維持。bare createPersistenceは従来分類の「その他」に入る点を明記する。hooks／一文委譲を除く仮定でも1,375非空白行が残るため、200〜500行の目標を小さなadapter削減で達成扱いにしない。

次はBlankCanvasGestureの生成段階を検討する。早期のBasicDrawingToolsへのreset入口はcallbackで、最初の直接捕捉は後段のScene interaction付近にある。constructor・各consumer・receiverと引数／戻り値・例外時の途中状態を確認し、既存operation／pending／Selection／transientの実ownerへ接続する。候補として記録しただけで、まだ実装していない。週枠使用16%／残量84%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。

### 最新：Canvas workspaceの入力生成と共有依存（2026-10-24、検証完了）

基準develop／origin/developは12bff79。本単位はcodex/canvas-workspace-inputで実施した。CanvasDisplay.createWorkspaceがcreateInputBindingを返し、同じcanvas／document・viewport／navigation・保留入力reader／寸法入力同期・menu終了を、既存CommandRoutingとInputBindingへ接続する。外から渡すのはpointer、panel／PNGの現在reader、blank gesture／空白判定、scheduler／commit計測だけ。実Bindingを返し、bindはappの従来位置に維持する。既存createとcreateCommandRouting APIを維持し、状態・cache・listenerやモデルを複製しない。

app.jsは2,508→2,504行（4行減）。対象構築2→1、明示port19→7、root未使用binding／追加接続の初期化前参照0（TEMP cad-workspace-input-audit.cjs）。wheel後の入力同期はresize／layoutと同じisValueInputPendingを使い、既存のdistance-value／offset-value判定を維持する。座標変換・書式・status DOM照会の接続をworkspaceへ集め、通常inputとcommand routingの処理規則は既存ownerに残す。rootに新たな操作状態や巨大contextを作らない。

実viewport／navigation／CommandRouting／InputBindingを使う追加2単体で、生成時の無照会・bind時機、処理済み座標表示・shift転送、wheelのflush→menu終了→zoom→保留入力判定→必要時同期、倍率増加とworld固定点維持、flush例外時の短絡とviewport無変更、panel消費とdouble click一回抑止、PNG左button完了抑止・通常pointer復帰・commit計測を確認した。新fixtureのwheelにはclient座標も与え、NaNによる見かけ上の成功を避けた。既存期待・E2E規則は変更しない。関連単体20件、全単体1,917件、構文612ファイルが成功。

command panel・zoom input・PNG出力・注記入力／drag・参照画像・selection zoom・phase0保存互換性／描画比較・既存UIの関連E2E158件は全成功（2.4分、exit 0、runner82840）。TEMP cad-workspace-input-e2e-receipt.jsonのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止、製品source二つのhash不変を確認した。ログはcad-workspace-input-{focused,unit,check,e2e}.log。spec/architecture/モジュール構成.mdとimplementation-map.mdへ内部設計を記録した。全E2Eは今回未実行で、17defd0の全587件成功および直前12bff79の性能を含む関連265件成功と区別する。

週枠使用14%／残量86%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次はrootの機能組立てと起動段階を引き続き再監査する。通常操作・UI・Document lifecycleを単一の大きなcontextへ移すだけの案は採用せず、同じ実ownerが持つ依存を共有して内部生成と機能間接続を分ける。200〜500行の目標は維持し、今回の4行減だけで大幅な縮小が済んだとは扱わない。

### 最新：共有求解準備と初期化段階の整理（2026-10-24、検証完了）

基準develop／origin/developは64233c5。本単位はcodex/shared-solve-preparationで実施した。ConstraintSolvePreparation.createForSolverが既存の型・幾何helperをcreateへ結線し、同じ実precondition／stepNorm／withStepNormを返す。実行時依存はsolver・直接半径寸法照会・OffsetChain計画・最小長二つに限定する。Offset生成後・DimensionValueCommand生成前に一度構築し、同じAPIを寸法値編集とConstraintCommitCommandへ渡す。createと各commandの個別関数注入を維持し、明示値を優先する。数値計算・幾何前処理・snapshot／rollback・求解条件・UI・保存形式は変更しない。

app.jsは2,516→2,508行（8行減）、対象構築3→3、明示port89→80。root未使用binding／初期化前参照0（TEMP cad-shared-preparation-audit.cjs）。constructorはSolver設定・scope／モデル・依存callbackを読まないため、この純粋な初期構築を前へ移せる。テスト用preconditionは同じ実関数を公開し、二つのhoisted設定wrapperを撤去した。状態やcache・可変contextは追加しない。

追加2単体で、新旧APIの実Arc前処理一致・遅延照会・現在のstep normを使うこと、実DimensionValueCommand→ConstraintCommitCommandの入れ子求解で同じSolver設定を共有し、例外時に各直前値へfinally復元することを確認した。モデルのexpressionが例外前に変わる既存境界も維持する。関連単体53件、全単体1,915件、構文612ファイルが成功。

関連E2E265件は全成功（18.4分、exit 0、runner32809）。拘束dragのfileは14.5分、fillets 3,744 previews／maximumMs 34.8、offsets 10,296／66.8、aircraft 1,872／300.3はいずれもfailures空。既存の600,000ms timeout・期待値は変更していない。寸法・Annotation・Block・Sketch編集・既存UI・phase0保存互換性／描画比較も通過。TEMP cad-shared-preparation-e2e-receipt.jsonのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止、四つの製品source hash不変を確認した。関連ログはcad-shared-preparation-{focused,unit,check,e2e}.log。source固定中に再開資料だけへ実行sessionを記録し、途中出力を成功扱いせず同じsessionを終了まで追跡した。

spec/architecture/モジュール構成.mdとimplementation-map.mdへ設計を記録した。全E2Eは今回未実行で、17defd0の全587件成功と区別する。週枠使用12%／残量88%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残存root構築を再監査し、同じ実ownerで完結する内部構築と機能間接続を分ける。起動／bind／startの生成段階は独立して扱い、単に大量のAPIを大きなcontextへ包む案は採用しない。200〜500行の目標は維持し、少数の引数削減で達成扱いにしない。

### 最新：寸法拘束の生成・候補分類と追加機能の接続（2026-10-24、検証完了）

基準develop／origin/developは79b87b1。本単位はcodex/constraint-dimension-compositionで実施した。Treeの残存照会を全owner付きのcontextで包む案は採用せず、先に同じ寸法生成器を共有する責務を整理した。ConstraintCommitCommand.createWithDimensionsが実DimensionConstraintFactory→CommitCommand→DimensionReadOnlyQueryを構築し、command／readOnlyを返す。候補生成と分類は既存childに残し、追加時の生成エラー通知adapterを同じcommandへ集める。静的拘束型とtargetItemsは既存namespaceから取得し、並行判定・所属付与・冗長probeとcommit依存は明示注入する。既存create APIを維持し、新しい可変context・cache・モデルは追加しない。

app.jsは2,536→2,516行（20行減）。対象構築3→1、明示port46→40。root未使用binding／初期化前参照は0（cad-constraint-dimensions-audit.cjs）。Treeや寸法配置の早期接続は従来のhoisted wrapperを維持し、候補照会は構築後に行う。Factory／Query／Commandのconstructorはモデル・scope・UIを評価しないため、この純粋な内部生成だけを集約する。求解準備と他機能への接続はappに残す。

実factory／query／commandと拘束classを用いる追加2単体で、PointAxisDistanceの型・geometry／placementの同一性、候補の無登録、同じ規則から別candidateを生成して追加すること、参照metadataと冗長probe、現在Sketchの変化、明示readOnly短絡、候補の無通知と追加時のhint→log、通知例外の伝播とモデル無変更を確認した。外側dimension options.silentを生成callbackへ渡さない既存挙動も維持する。既存期待やE2E規則を緩和していない。関連単体36件、全単体1,913件、構文612ファイルが成功。

複数寸法・寸法prefix・slot寸法・Annotation anchor／parameter・Block・Sketch編集・既存UI・phase0保存互換性／描画比較の関連E2E250件が全成功（3.9分、exit 0、runner57423）。cad-constraint-dimensions-e2e-receipt.jsonのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799停止、製品source hashの不変を確認。ログはTEMPのcad-constraint-dimensions-{focused,unit,check,e2e}.log。spec/architecture/モジュール構成.mdとimplementation-map.mdへ設計を記録した。今回の全E2Eは未実行で、17defd0の全587件成功と区別する。

週枠使用11%／残量89%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は残るroot構築を再監査し、実ownerの内部構築と機能間接続を分ける。Treeの拘束・寸法・Hatch読取りは、既存APIの参照を大きな袋に移すだけなら見送る。求解準備はDimensionValueCommandにも共有されるため、commitだけの内部処理と決めつけず、実使用と生成時機を確認する。200〜500行の目標は維持し、小さな引数削減だけで達成扱いにしない。

### 最新：Sketch Treeの行表示と操作の共有接続（2026-10-24、検証完了）

基準develop／origin/developはee3684b。本単位はcodex/sketch-tree-selection-contextで実施した。既存SketchTreeController.createWithDocumentObjectsが実Objects→Document View→Controller／Menuを組み立て、同じSelection・CanvasHover・SelectionHighlight・Geometry read serviceへ接続する。行選択・関連拘束・Sidebar hover関数とgeometry ID照会をappの中継bindingから外した。Objects／Controllerは既存dimensionPresentationScope、Viewはbound editing scope、展開keyは現在Block IDという違いを維持する。新しい状態・cache・可変context・ファイルは追加しない。既存の直接create APIを維持する。

app.jsは2,545→2,536行（9行減）。対象構築2→1、直下引数68→38。ただし新objectOptionsが21項目を持つため、これを隠して依存が30減ったとは扱わない。hoverも展開しgroup containerを除いた末端引数は74→59（15減）。root未使用binding／初期化前参照は0（cad-tree-selection-audit.cjs）。表示固有のobjectOptionsと操作接続を分け、共通scope・設定・escape・gutter・選択とhoverの結線を組立てownerへ集める。Tree側に選択・HTML生成・幾何計算の再実装を持たせない。

実Objects／View／Controller／Menu／Selection／Hover／Highlightを使う追加2単体で、構築時のscope遅延読取り、行選択の同一参照条件、Canvas／Sidebar hoverの更新と解除、共通geometry照会のbare呼出し、関連拘束照会、scope更新後の対象解決、ViewとControllerのscope差、DOM／resize初期化順・menu start／disposeを確認した。既存期待を緩和していない。関連単体33件、全単体1,911件、構文612ファイルが成功。Tree表示・可視性・削除・権限・Sketch編集／移動・Block・menu・既存UI・phase0保存互換性／描画比較の関連E2E220件が全成功（3.2分、exit 0、runner68528）。sourceを固定し、cad-tree-selection-e2e-receipt.jsonのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した。ログはTEMPのcad-tree-selection-{focused,unit,check,e2e}.log。

spec/architecture/モジュール構成.md・implementation-map.mdへ内部設計を記録した。今回の全E2Eは未実行で、17defd0の全587件成功と区別する。週枠使用11%／残量89%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。

次はrootの機能組立てを引き続き再監査する。TreeのobjectOptionsには拘束状態・寸法・Hatchの既存照会依存が残るため、実ownerの狭い読取りAPIで統合できるか確認する。各ownerを丸ごと渡すだけで境界を曖昧にせず、view／current／presentationのscope差と現在値の取得時機を守る。小さな配線削減だけで200〜500行へ到達するとは見積もらない。

### 最新：注記の描画と空間照会の共有（2026-10-24、検証完了）

基準develop／origin/developは133353b。本単位はcodex/annotation-spatial-compositionで実施した。AnnotationDisplay.createSpatialQueriesが同じ実rendererの文字layout・高さ・Leader表示geometryを既存AnnotationSpatialQueryへ接続し、AnnotationFeature.spatialから実APIを公開する。新しい状態・cache・モデル・広いcontextは持たない。従来の直接create APIを維持する。明示選択かつ編集可能というframe操作条件を、hover／inspectionによるframe表示と混同しない。resize可否と倍率・現在Sketch・一覧は遅延読取りを維持する。

app.jsは2,550→2,545行（5行減）、対象構築2→1、明示port61→48。root未使用binding／追加接続の初期化前参照は0（cad-annotation-spatial-audit.cjs）。BlockLayout／DrawingBoundsの早期構築にはhoistしたbounds委譲を渡し、実照会はFeature生成後に行う。空間計算・優先順位は既存SpatialQueryに残し、表示と照会の内部接続だけを表示ownerへ集めた。小さな接続削減だけで数百行へ届くとは見積もらない。

実renderer／SpatialQueryを使う追加2単体で、生成時にreaderを評価しないこと、回転0.7と複数倍率で同じlayout／bounds／hitを使うこと、モデル無変更・Canvas計測のsave／restoreのみで描画命令なし、選択・編集許可・resize・activeOnly・可視性の条件を確認した。関連単体22件・全単体1,909件・構文612ファイル成功。関連E2E278件は4.4分、exit 0（runner53194）、last-run passed／failedTests空、自己起動port8799停止／listeners 0。ログはTEMPのcad-annotation-spatial-{focused,unit,check,e2e}.log、receiptとlast-runも同prefixで保存。最初のE2E起動はPowerShellがNode警告を例外扱いして中断し、実プロセス終了を確認して実行wrapperのみ修正後に完走した。製品source・E2E期待値・timeoutは緩和していない。後続の回転fixture修正は単体だけで、製品sourceはE2E成功時と同一。

spec/architecture/モジュール構成.mdとimplementation-map.mdを更新した。全E2Eは今回未実行で、17defd0の全587件成功と区別する。週枠使用10%／残量90%、停止条件未到達。main／origin/mainはdf5aef2を保持し、停止／releaseの最後に反映する。全体目標はactive・未完了。次は既存ownerの内部構築と機能間接続を分ける。Sketch TreeはObjects／Controllerを広い引数のまま包まず、読取り・操作capabilityとview／current／presentationのscope差を確認して境界を決める。

### 最新：読取り基盤とscope／Solverの接続（2026-10-24、検証完了）

基準develop／origin/developはb339349。直前の幾何読取り接続58cd33cは統合・Push済み（構文612・単体1,905件・関連E2E247件成功）。main／origin/mainはdf5aef2を保持する。本単位はcodex/document-read-scopeで実施した。

DocumentWorkspace.createReadContextは既存の実ReadServicesと、その基盤専用のcreateScopeBindingを返す。ReadServicesは従来位置で生成し、Binding／Solverはlet初期化と周辺query／layout生成の後にある従来位置で生成する。初期scopeを読むBinding constructorを前へ寄せない。後段factoryはSolver constructor・メニュー終了・Sketch移動resetの3portから既存EditingScopeBindingを生成し、同じWorkspace・幾何read cache・Block投影cacheへ接続する。旧createGeometryReadServicesとEditingScopeBinding.createの直接APIを維持する。

app.jsは2,551→2,550行（1行減）、対象構築2→2、明示port11→8。root未使用bindingと追加接続の初期化前参照は0（cad-document-read-scope-audit.cjs）。cacheの解除先の接続を内部へ集める変更であり、新しいcache・current scope・可変phase containerやモデルを追加しない。メニュー終了→移動reset→Workspace.activate→bound scope／Solver更新→read clear→projection invalidateと、失敗時の途中状態を維持する。

実Binding／Solver／ReadServicesとcacheを使う2単体で、遅延Binding生成と実Solver／Workspace共有、同じ定義とrevisionのままgeometryを変えた投影cacheの解除、read cacheの解除、Workspace.restoreが先行した時のbound scope保持、移動reset失敗時の短絡と復帰を確認した。新fixtureは定義Objectの置換による自動cache失効を避け、同じObject内のgeometryを変える条件へ合わせた。既存期待や製品規則を変更していない。関連単体22件・全単体1,907件・構文612ファイルが成功（cad-document-read-scope-{focused,unit,check}.log）。新file／script一覧／UI／保存形式の変更はなく、spec/architecture/モジュール構成.mdとimplementation-map.mdへ内部設計を追記した。

Block／Sketch編集・移動・派生選択copy・Hatch・ブックマーク・menu・既存UI・phase0保存互換性／描画比較の関連E2E208件が全成功（3.1分、exit 0、runner36117、cad-document-read-scope-e2e.log）。sourceを固定し、receiptのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した（cad-document-read-scope-e2e-receipt.json、cad-document-read-scope-last-run.json）。今回の全E2Eは未実行で、直前の全体基準17defd0の587件成功と区別する。週枠使用9%／残量91%、停止条件未到達。mainは停止・release時に最後に反映する方針を維持し、全体目標はactiveで未完了。

次も実owner・依存方向・初期化段階に沿って内部構築と機能間接続を分ける。現在Workspaceとbound scopeの一時的な違いを保ち、広いcontextで隠さない。小さな引数削減だけで数百行へ届くとは見積もらない。

### 最新：Document基盤と幾何読取りの二段階接続（2026-10-24、検証完了）

基準develop／origin/developは17defd0。DocumentWorkspace初期構築f33bb4dの構文612・全単体1,903件・全587 E2E（27.9分）は成功・統合・Push済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/document-geometry-readsで実施した。

DocumentWorkspaceの返却APIへcreateGeometryReadServicesを追加し、同じDocument・workspace.currentと実SketchContextのelementSketchId／sketchById／isRootSketch／activeSketchId、および同じapplicationTextを既存GeometryReadServices.createWithHatchesへ接続する。appに残すのはcurrentSketches・prepareBlocks・showHiddenElements・viewportScale・profileReadの5port。返すのは既存の実ReadServicesで、新しいcache／scope／モデルや可変phase参照は持たない。

固定DocumentのBlock catalog、現在Workspaceの図形、EditingScopeBinding側のcurrentSketchesを区別する。currentSketchesをworkspace.current().sketchesへ統一しない。Core生成時に読取り群を先行生成せず、旧ReadServicesの生成位置で同じ順序とcallbackを渡す。scope bindとcacheのclear／invalidate、Hatch／外観／投影の実装やUI・履歴・保存形式は変えない。

app.jsは2,552→2,551行（1行減）、対象構築1→1、明示port12→5。root未使用bindingと追加接続の初期化前参照は0（cad-document-geometry-reads-audit.cjs）。実componentの2単体で無照会の構築、固定DocのcatalogとliveなWorkspace図形、異なるbound Sketchからの寸法外観、scope変更／再bind、cache寿命と明示clear、prepare失敗の伝播とモデル不変を確認した。関連単体22件・全単体1,905件・構文612ファイルが成功（cad-document-geometry-reads-{focused,unit,check}.log）。新file／script一覧変更はなく、spec/architecture/モジュール構成.mdとimplementation-map.mdへ内部設計を追記した。

Block／Sketch編集・投影／派生pattern・Hatch・選択glow・Tree表示／権限・既存UI・phase0保存互換性／描画比較の関連E2E247件が全成功（3.7分、exit 0、runner73989、cad-document-geometry-reads-e2e.log）。sourceを固定し、receiptのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した（cad-document-geometry-reads-e2e-receipt.json、cad-document-geometry-reads-last-run.json）。今回の全E2Eは未実行で、直前の全体基準17defd0の587件成功と区別する。週枠使用8%／残量92%、停止条件未到達。mainは停止・release時に最後に反映する方針を維持し、全体目標はactiveで未完了。

次も同じ実ownerを使う構築階層と依存方向を確認する。特に現在Workspaceとbound scope、Document固定情報の違いを広いcontextで隠さず、機能間接続と内部構築を区別する。小さな引数削減だけで数百行へ届くとは見積もらない。

### 最新：構築階層の再監査とDocumentWorkspace（2026-10-24、全体検証完了）

基準develop／origin/developは64348ff。直前のSnapshot metadata分離6274ab1は統合・Push済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/document-workspace-compositionで実施した。

組立て階層を再監査し、20fbe41の既報値を同じBabel AST条件で再現した。64348ffは2,555物理行／2,092非空白行、構築1,004・test hooks440・一文call211・その他437、root構築167。DocumentWorkspace追加後は2,552／2,089、構築1,001・hooks440・call211・その他437、root構築161、root関数173・callback271・複文11・後段接続let6。test hooksとcallを全除去する仮定でも1,438非空白行が残る。小関数の移動や公開Objectを巨大contextで包む案では200〜500行に届くとは扱わない。根拠・候補比較・測定条件はbootstrap-boundary-audit.mdの最新節へ記録した。

src/application/document_workspace.jsへDocumentState→EditingWorkspace→ParameterNamespace→SketchContext→GeometryIds→DocumentIds→Reservationの七部品の初期構築を集約した。三依存はapplicationText／constraintGraphNodes／遅延nextHatchIndexだけで、返す七ownerは各既存factoryの実体。Document／scope／照会／採番のstateやreset／restoreは各ownerに残し、UI・Solver実行・履歴・保存sessionを取り込まない。Sketch照会とprivate採番の生成だけを前へ寄せ、七部品の相対順とUI・scope切替・reset／履歴の実行位置を保つ。Hatch getterは元のeditingScopeBinding readerを保持し、workspace.currentへ置換しない。広いapp contextや新しいmodelは追加しない。

app.jsは2,555→2,552行（3行減）、対象構築7→1、明示引数8→3（旧Workspaceの位置引数1も含む）。root未使用bindingと追加接続の初期化前参照は0（cad-document-workspace-audit.cjs）。全体ASTはcad-composition-hierarchy-audit／cad-document-workspace-hierarchy-auditの.cjs／.json／.logで、candidate app blobは3f8dd4e1b460005c3fef4ec19a2f77a2954471eb。

実componentの3単体で初期Document値と独立した複数組、workspace／Document同一性、local scope→復元に追従するSketch／Parameter、同じ採番ownerと遅延Hatch read／途中失敗の順序を確認した。関連47件・全単体1,903件・構文612ファイルが成功（cad-document-workspace-{focused,unit,check}.log）。index.html・tools/check-syntax.js・tools/run-unit-tests.js・unified-ui読込期待を同期し、file URL Help／script読込の先行E2E1件も成功（2.2秒、cad-document-workspace-loader.log）。spec/architecture/モジュール構成.mdとimplementation-map.mdへ内部設計を記録した。

モデルの初期構築全体に触れるため、同じsourceを固定して全587 E2Eを実行し、全件成功した（27.9分、exit 0、runner84270、cad-document-workspace-e2e-full.log）。初期性能12件、adversarial drag、Fillet 3,744 previews／32.2秒、Offset 10,296／2.7分、航空機1,872／8.7分とその後の全UI・保存／復元まで成功。先行loaderと全体検証のreceiptはloaderCode 0／exitCode 0／listeners 0、last-runはpassed／failedTests空で、自己起動port8799の停止も確認した（cad-document-workspace-e2e-receipt.json、cad-document-workspace-last-run.json）。app／新module／index／tools／変更testの固定hashも一致した（cad-document-workspace-source-hashes.json）。旧全体基準74a0d17の587件成功とは区別し、今回のcandidateを最新の全体検証済み基準とする。

週枠は終了時の再確認で使用8%／残量92%、停止条件未到達。mainは停止・release時に最後に反映する方針を維持し、全体目標はactiveで未完了。次も実owner・依存方向・初期化段階を確認して構築階層を育てる。Sketch TreeのObjects／ControllerやParameterのUI／計算／checkpoint、test支援の生成／公開は、まとまった名前だけで多数のportを包まず、各責務とscopeを先に整理する。

### 最新：スナップショット用図形metadataの照会（2026-10-24、検証完了）

基準develop／origin/developは3b9c67c。直前の拘束・寸法codec接続69a1c80は統合・Push済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/snapshot-geometry-metadataで実施した。

GeometryReadServices.createSnapshotMetadataは同じelementSketchIdと実PointUsageへ接続したread-only関数を返す。appのgeometryMetadata内にあったSketch所属とPoint instance／既存kind／primitive利用状況からのfallback分類をこの読取りownerへ移した。Snapshot writerのfield生成、保存形式・codec、Block定義内の独立したlocalGeometryMetadata、履歴や準備順は変えない。現在PointUsage scopeとsnapshotSourceを勝手に統一せず、kindやモデルへ書き戻さない。新しい可変state／cacheやapp contextは追加しない。

app.jsは2,558→2,555行（3行減）。writer生成1→1・writerの明示port7→7に加え、metadata reader生成のpointUsage 1portを接続する。全体の対象Call数1→2／Object port7→8で、単なる引数削減とは扱わず、rootの条件付きデータ照会を所有者へ移す変更である。AST監査でroot未使用bindingと追加接続の初期化前参照は0（cad-snapshot-geometry-metadata-audit.cjs）。

実PointUsage／GeometryReadServices／DocumentSnapshotの2単体で、無照会の構築、Point class判定、truthyなkindと空値fallback、現在scope変更、展開cache無参照、Sketch照会失敗時の短絡、旧callbackとの保存JSON一致とモデル不変、Block内の独立した分類を確認した。Snapshot用fixtureには正式入力で必須のparameters配列を補い、既存期待・製品規則は変更しない。関連単体20件・全単体1,900件・構文610ファイルが成功（cad-snapshot-geometry-metadata-{focused,unit,check}.log）。新file／script一覧・UI変更はなく、spec/architecture/モジュール構成.mdとimplementation-map.mdへ内部設計を追記した。

既存UI・phase0保存互換性／描画比較・Spline・Sketch投影／編集・派生選択copy・ブックマークの関連E2E165件が全成功（2.4分、exit 0、runner18868、cad-snapshot-geometry-metadata-e2e.log）。sourceを固定し、receiptのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した（cad-snapshot-geometry-metadata-e2e-receipt.json、cad-snapshot-geometry-metadata-last-run.json）。今回の全E2Eは未実行で、直前の全体基準は74a0d17の全587件成功。週枠使用4%／残量96%、停止条件未到達。mainは停止・release時に最後に反映する方針を維持し、全体目標はactiveで未完了。

次は残るデータ照会・操作固有callbackと機能構築の依存を再監査し、既存ownerを共有する機能単位の組立て階層を検討する。Snapshot／現在scope／Block定義の意味を保ち、広いcontextでまとめない。小さな引数削減だけで数百行へ届くとは見積もらない。

### 最新：拘束codecと寸法保存の接続（2026-10-24、検証完了）

基準develop／origin/developは123c50f。直前の寸法Preview接続10c48b1は統合・Push済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/constraint-dimension-codecsで実施した。

Documentの保存・読込・履歴全体を一括で包む案は、Document／Blockの復元範囲と初期化段階を隠すため採用しない。今回は既存ConstraintPersistenceへcreateWithDimensionsを追加し、同じDimensionPlacementの角度移行／anchor／保存axisをDimensionPersistenceへ接続し、constraint.dimensionと既存targetFromConstraintを渡す拘束codecを生成する。返すdimensions／codecsは各既存factoryの実APIで、診断も同じ寸法serializerを使う。旧createのdimensionData注入APIとcreateMetadata・Snapshot writer・Loading／Application・履歴の境界は維持する。

app.jsは2,563→2,558行（5行減）。対象のroot構築2→1、明示port5→2。不要になった角度移行・保存axisのroot別名を除き、AST監査でroot未使用bindingと追加接続の初期化前参照は0（cad-constraint-dimension-codecs-audit.cjs）。生成位置と順序を維持し、新しいscope・モデル・保存cacheや可変phase参照は持たない。

実DimensionPlacement／DimensionPersistence／ConstraintPersistenceを使う2単体を追加した。characterization fixtureの25種類以上の拘束で旧接続とJSON文字列一致および復号→再保存の一致、生成時の無照会、同じIDを持つDocument／Blockの明示Map別参照、寸法serializerの共有、anchor失敗の伝播とgeometry不変を確認した。既存期待は変更せず、関連単体17件・全単体1,898件・構文610ファイルが成功（cad-constraint-dimension-codecs-{focused,unit,check}.log）。新file／script一覧変更・UI／保存形式変更はない。spec/architecture/モジュール構成.mdとimplementation-map.mdへ内部設計を追記した。

既存UI・phase0保存互換性／描画比較・Sketch投影／互換driver・派生pattern・ブックマーク・寸法prefix／複数寸法／Slotの関連E2E182件が全成功（2.6分、exit 0、runner74024、cad-constraint-dimension-codecs-e2e.log）。検証中はsourceを固定し、receiptのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した（cad-constraint-dimension-codecs-e2e-receipt.json、cad-constraint-dimension-codecs-last-run.json）。今回の全E2Eは未実行で、直前の全体基準は74a0d17の全587件成功。週枠使用4%／残量96%、停止条件未到達。mainは停止・release時に最後に反映する方針を維持し、全体目標はactiveで未完了。

次も復元scopeと初期化段階を維持しつつ、残る機能構築の依存を再監査する。codecの変換、モデルへの適用、履歴とUIの責務を名前だけでまとめない。小さな引数削減だけで数百行へ届くとは見積もらない。

### 最新：寸法表示とプレビューの共有接続（2026-10-24、検証完了）

基準develop／origin/developはceab869。直前の基本作図プレビュー75ec188は統合・Push済み。main／origin/mainはdf5aef2を保持する。本単位はcodex/dimension-preview-compositionで実施した。

DimensionDisplay.createPreviewは同じDimensionPlacement／Painterと既存NumberDisplay／DimensionQueriesをDimensionPreviewへ接続する。appから渡すのはpending照会・Fillet補助描画・式評価の3portだけで、実Preview APIを返す。Painterは元のreceiverで呼び、現在pendingの再照会・式評価のcatch範囲・既定の配置／axis／角度／書式を維持する。寸法入力・確定・取消・求解・履歴は移管せず、同じ表示機能の依存接続をまとめる。新しいstateや可変phase参照、app contextは追加しない。

app.jsは2,565→2,563行（2行減）。対象のroot構築1→1、明示port13→3。初期化と描画の位置・順序は変えず、不要なrootの円寸法配置関数の別名を除いた。AST監査でroot未使用bindingと追加接続の初期化前参照は0（cad-dimension-preview-audit.cjs）。既存factoryは直接注入APIとして維持し、script一覧・UI・保存形式は変更しない。

実DimensionDisplay／Painter／Previewを使った2単体で、構築時の無照会、現在pending／式の引数、配置／最新外観と倍率、Fillet geometry同一性と失敗短絡、モデル不変を確認した。新fixtureの文字表示と軸の最初の想定は、既存Painterのhidden文字と配置規則を確認して修正した。既存期待・製品の描画規則を変更していない。関連単体11件・全単体1,896件・構文610ファイルが成功（cad-dimension-preview-{focused,unit,check}.log）。spec/architecture/モジュール構成.mdとimplementation-map.mdへ内部設計を追記した。

注記拘束・寸法prefix／複数寸法／Slot・command panel・PNG・既存UI・phase0保存互換性／描画比較の関連E2E202件が全成功（3.2分、exit 0、runner41050、cad-dimension-preview-e2e.log）。sourceを固定し、receiptのexitCode 0／listeners 0、last-runのpassed／failedTests空、自己起動port8799の停止を確認した（cad-dimension-preview-e2e-receipt.json、cad-dimension-preview-last-run.json）。今回の全E2Eは未実行で、直前の全体基準は74a0d17の全587件成功。週枠使用3%／残量97%、停止条件未到達。mainは停止・release時に最後に反映する方針を維持し、全体目標はactiveで未完了。

次は残る機能構築の依存を再監査する。描画と入力・commandが持つ異なる責務を名前だけで包まず、同じownerと現在scopeを共有できる境界を選ぶ。小さな引数削減だけで数百行へ届くとは見積もらない。

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

### 最新の削除機能組立て単位

基準はdevelop c02a9d6。DeletionFeatureがGeometryDeletion→GeometryDeletionCommand→SelectionDeletionCommandを同じ順序で生成し、削除候補の参照key／最初のowner pathによる依存判定と拒否通知を共有する。既存PointUsageの四つの実照会と、同じAnnotationDimensions／Geometry plan・Selection／sessionを渡す。返却はremove／removeSelection／rejectReferencesだけで、同じrejectを既存GeometryInstanceLifecycleへも接続する。削除計画・データ除去・求解・履歴と途中反映は各既存ownerに残す。

Geometry削除のrefreshはToolbar→UI→draw、混在SelectionはUI→drawという違いを保つ。guardや通知失敗を捕捉せず、元の結果・例外と後続短絡を伝播する。対象なしのrejectは通知せず、参照ありは既存ID順／文言でHint→log。注記拘束のremoveとcommand.removeのreceiverを保つ。Geometry／Dimension／Annotation dragは実際には後段で生成されるため、resetを同じ操作時callbackのまま渡す。Workspace current readerと同期済みediting scopeを混同しない。独自のtransaction／全体rollbackや、新model／Selection stateを加えない。

app.jsは2,765→2,738行（27行減）。root構築3→1、明示引数64→47、構築群の群外root binding参照49→47。不要になったisPointUsedBySpline別名を除きroot未使用bindingは0。全単体1,835件・関連単体26件が成功（exit 0）。追加4件で生成順と共有実体・live scope、PointUsage関数／Annotation receiver、command receiverと結果／例外、依存keyとowner判定、空候補・拒否通知順、遅延reset、二つのrefresh順と解析readerを確認した。既存plan／Geometry／Selection削除の単体も全成功。AST診断は一時directoryのcad-deletion-feature-audit.cjs。

新しいclassic scriptと単体fileを追加し、index.html・tools/check-syntax.js・tools/run-unit-tests.js・unified-uiのscript順期待値を同期した。三つの依存scriptの後／appの前に配置する。構文594ファイルが成功。生成直下が三factoryとObject.freezeだけであることをASTで確認した（cad-deletion-feature-loader-audit.cjs）。

旧c02a9d6のappと現在module群の実ブラウザ比較では、Geometry／Blockのコピー／Cutと連続貼付け21状態、各削除→Undo／Redo→再読込10状態、派生のsource／親削除拒否とleaf削除→Undo5状態の計36状態でmodel・clipboard・mode・履歴・選択・HintとAPI204 key順が一致した（savedAtだけ除外）。削除の成否とGeometry／Block件数、参照拒否、leaf削除成功と復元も確認した。診断は一時directoryのcad-deletion-feature-equivalence.cjs／.log。実file URL Help／script読込E2E1件が成功（2.1秒、exit 0）。同じ製品コードの全E2E587件・50ファイルが全成功（24.9分、exit 0）。拘束drag回帰15件も全成功（file全体12.3分）し、以前の保留対象の航空機A2／A3は1,872 preview・失敗0・最大265.8ms、既存600000ms上限に対して7.2分で成功した。性能全12件も成功しpan142ms（175ms未満）、空白矩形202ms（250ms未満）。期待値・制限・timeoutを変更せず、再試行で失敗を置き換えた結果ではない。全runnerのexit 0と専用server停止を確認した。ログは一時directoryのcad-deletion-feature-{focused,check,unit,loader,full}.log。検証対象の製品／test／manifest七fileのSHA256一致を確認し、検証後の変更はこの記録だけとする（cad-deletion-feature-tested-files.json）。

開始時週枠使用49%／残量51%、全体検証開始時は使用50%／残量50%。全体検証中に使用51%／残量49%を確認し、ユーザー指定の停止条件に達したため新たな分離を停止した。進行中の同じ全E2Eを終えて検証済みの区切りを反映する。停止条件の直前のため製品コードを固定し、全E2E587件（一覧50ファイル）を実行する。以前のmain保留理由だった検証gateは今回の全587成功で解消した。c3a213cの全584成功は過去の基準と区別する。停止条件に従って新しい分離は停止し、この記録を含む検証済み区切りをdevelop先行／main最後で反映・Pushする。main Push直後にdevelopをmainへff-only同期してPushし、local／originの両者一致・祖先関係、clean状態とruntime-versionの最終commitを確認して一時停止する。200〜500行の全体目標は未完了。次回は最新refsと本節から、残る通常機能の構築・hoisted委譲・bind／startを再監査し、既存ownerへ閉じられる生成・接続群を選ぶ。巨大な別rootや単なるcontext包装を採らない。


### 最新のClipboard機能組立て単位

基準はdevelop cbc981d。通常構築の再監査から、連続しているClipboardの生成・接続を独立した機能境界として選んだ。新しいsrc/application/clipboard_feature.jsがTransfer→Payload→Session→Geometry→PasteCheckpoint→Graph→Commandの七つを元の順序で生成する。返却は同じ実session／commandとcopyableSelectionPayload／canOfferCopyに限定した。appはscope・共有query／codec・ID・Parameter・UI・求解を明示して渡す。Payload、Geometry複製／転送、Graph追加、保持state、復元と操作の七既存ownerの処理本体は変更しない。

コピー候補の現在Block scope取得→同期済みediting scope取得→namespace付きbuild→error hint→payload返却を機能側へ集めた。Parameter targetのBlock scopeは従来どおり条件と値で別々に読む。現在viewport倍率、Document／Blockの採番と既存checkpoint列、Cut通知→削除、貼付けselect→solve、失敗時の復元→projection無効化→Selection→UI→drawを維持する。拒否Cutのpayload保持と、solve失敗時に貼付け回数／modeを戻さない既存の限定復元を拡張しない。新しいclipboard／model／ID状態、保存形式やUI操作は加えない。

app.jsは2,805→2,765行（40行減）。root構築7→1、明示引数合計60→45、群外root binding参照45→45（種類の削減ではなく共有接続と内部生成の移管）。root未使用bindingは0。全単体1,831件・関連単体17件が成功（exit 0）。追加4件で生成順・同じowner／Geometry／ID／session／checkpoint、生成時無操作、live scopeとnamespace／倍率、serializer順、採番receiver、拒否Cut、guard、成功とappend／solve失敗時のmodel／採番・回数／modeの境界を確認した。AST診断は一時directoryのcad-clipboard-feature-audit.cjs。

新しいclassic scriptと単体fileを追加し、index.html・tools/check-syntax.js・tools/run-unit-tests.js・unified-uiのscript順期待値を同期した。ClipboardFeatureは依存七scriptより後、appより前へ配置する。構文592ファイルが成功し、読込順の調整後は変更したsyntax manifest／E2E fileも単独構文確認した。実file URL Help／script読込E2E1件も成功（2.2秒、exit 0）。生成直下は七factoryとObject.freezeだけであることをASTで確認した（cad-clipboard-feature-loader-audit.cjs）。

旧cbc981dのappと現在module群の実ブラウザ比較では、Geometry／Blockのコピー・Sketch間の連続貼付け・Undo／Redo・保存再読込とCut／貼付け・取消履歴の21状態でmodel・clipboard・mode・履歴・選択・HintとAPI204 key順が一致した（savedAtだけ除外）。貼付け回数、Cutによる元Geometry削除とUndo復元も確認した。診断は一時directoryのcad-clipboard-feature-equivalence.cjs／.log。関連E2E372件が全成功（7.0分、exit 0）。adversarial-authoring-performance／adversarial-drag-fixture／annotation-anchors／blocks／document-bookmarks／derived-selection-copy／file-safety／free-instance／hatching／phase0-characterization／reference-images／sketch-move／sketch-permissions／sketch-projection／sketch-tree-delete／sketch-tree-visibility／spline／unified-uiを実行した。各Geometry・Block／派生／Hatch／Spline／注記／画像のコピー・転送、Cut／貼付けと取消／Undo／Redo、Sketch権限／参照・Document置換／保存再読込と既存UIを確認した。性能全12件を含みpan128ms（175ms未満）、空白矩形199ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-clipboard-feature-{focused,check,unit,loader,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準と区別する。開始時週枠使用48%／残量52%、検証後使用49%／残量51%で停止条件未到達。通常構築全体の200〜500行への収束は未完了であり、今回のClipboard集約だけで完了とはしない。次は残る通常構築を同じ尺度で再監査し、既存ownerの生成・接続を機能として閉じられる群を選ぶ。巨大な別root／可変app contextや、引数を名前付きObjectに包むだけの集約を避ける。停止条件に到達した場合は新しい分離を始めず、最新コードの全体検証・develop先行／main最後の反映と両者同期を行う。


### 最新の寸法テスト支援共有接続単位

基準はdevelop d4f9e9e。既存DimensionTestDriver.createSupportがfixture／interaction／displayで共通の20 capabilityを共有し、各createFixtures／createInteraction／createDisplayへ専用依存14／21／20個を渡す。旧createFixtureSupport／createInteractionSupport／createDisplaySupportの実体を元の生成位置で作り、各操作・観測の処理と返却する公開名／key順を保持する。test条件外では生成しない。通常機能をtest ownerへ移さず、scope／モデル／Selection／session／Canvasの独立コピーや新stateを持たない。

app.jsは2,803→2,805行（2行増）。構築入口3→4と共有段階を増やす費用があり、行数削減とは扱わない。明示引数合計は100→75へ重複25個を除き、異なる入力種類75個は変わらない。個別の責務と生成時機を保ちながら、共通capabilityを一度だけ接続する単位である。全テストAPI127項目／140行／91入力の丸ごとの移動案は引き続き採用しない。

全単体1,827件・関連単体13件が成功（exit 0）。追加2件で三つの段階の生成時無照会、親で共有したlive scope／Selection／viewportと各専用入力の区別、実寸法選択・fitの通知順、同じCanvas rendererと選択／hover／strokeの失敗時復元を確認した。既存fixture／interaction／displayの全テストも維持した。AST診断で元の100引数すべてが同じ式から接続され、既存driverの処理本体が改行形式を除き全文一致することを確認した（一時directoryのcad-dimension-testing-audit.cjs、cad-dimension-testing-ports.json）。新file・script順変更はない。

構文590ファイルが成功（exit 0）。旧d4f9e9eのappと現在module群の実ブラウザ比較では、寸法表示精度／角度・引出線／角度label追従、読取専用寸法、外観／描画metrics／terminator／色、Sketch可視、click配置／Line-Circle／drag、位置／選択／fit／式編集の22状態で返却値・model・mode・履歴・選択とAPI204 key順が一致した。返却model内も含めsavedAtだけを除外し、元の寸法結果を維持した。診断は一時directoryのcad-dimension-testing-equivalence.cjs／.log。関連E2E347件が全成功（6.5分、exit 0）。公開25 APIの全利用先14ファイル（blocks／bolt-diameter／annotation-display-size／annotation-anchors／adversarial-authoring-performance／leader-appearance／free-text-input-drag／dimension-prefix／sketch-tree-visibility／slot-dimension／multiple-dimensions／unified-annotations／view-visibility／unified-ui）とphase0-characterizationを実行した。実行前の一覧で15ファイル347件を確認し、Windows path区切りの指定によって起動検証21件だけ実行された最初のrunとは区別する。寸法の値入力／配置・読取専用・ドラッグ／整列、注記／引出線・精度／外観、Sketch可視とBlock・保存再読込／Undo／Redoを確認した。性能全12件を含みpan142ms（175ms未満）、空白矩形218ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-dimension-testing-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準と区別する。開始時週枠使用46%／残量54%、検証後使用47%／残量53%で停止条件未到達。次は通常機能の構築・bind／startとhoisted委譲を含む全体依存の再監査へ戻る。rootの操作stateは前単位までで既存ownerへ移り、六つのletは後段接続用。test driver内だけの小さい集約を続けても200〜500行に届かないため、共通サービスを共有する通常機能の生成・接続で残る結合を確認する。予備監査ではroot構築の明示引数はCanvasContextInteraction64、CanvasCommandInputs52、GeometryDragFeature49、PropertiesDisplay45、SketchTreeController38、ConstraintCommitCommand38、SketchProjectionFeature36だった（一時directoryのcad-root-construction-candidates.cjs）。いずれも既存の集約済境界なので、さらに一枚で包むだけでなく、同じowner APIの共有とconsumerの必要能力を基準に再検討する。単なる移動、巨大な別root／app context、必要な遅延参照の安易な解消を避ける。全体目標と全体検証は未完了。


### 最新のpointer入力状態所有単位

基準はdevelop 0aad34b。PointerInteractionController.createSessionが最後の生world座標と実down／move／doubleClick／leave／finishを所有する。appの旧lastPointerWorld初期化位置で生成し、既存位置のbindで入力・command・drag／hover依存を接続する。context menuの更新とDocument／Sketch resetの解除、Block配置・Fillet・寸法／拘束・Hatch・keyboard・ラベル描画の読取りを同じ限定APIへ接続した。生の座標参照を保持し、snapやpreview消去を伴うDrawingPreview.pointerとは統一しない。

早期座標利用と後段入力構築だけを二段階で接続し、可変app contextや独立した座標コピーを増やさない。既存createの全入力処理本体は改行形式を除き完全一致する。pressのworld取得→座標保存→hit照会、moveのpan消費→座標保存→各mode処理、右／中buttonのdownとpointerleaveで座標を保持する順序、例外時の途中更新と後続短絡を維持した。生成／bind時に入力・DOM・scopeを照会しない。旧createも保持する。

app.jsは2,803→2,803行（変化0）。独立したlastPointerWorldの7参照・4書込みをownerへ接続し、root letは7→6。残る六つはpngExportCommand／sketchMoveCommand／sketchContextController／commandPanel／derivedPanel／toolFlyoutsの後段接続参照で、rootが所有するmodeとpointerの操作stateはなくなった。全単体1,825件・関連単体37件が成功（exit 0）。追加3件で早期座標の参照共有、bind時無操作、pan優先、pressでの右／中buttonとhit照会前の保存、移動／hit失敗時の座標、pointerleaveでの保持と明示解除を確認した。AST監査と旧入力本体の一致診断は一時directoryのcad-pointer-state-audit.cjs。

構文590ファイルが成功（exit 0）。旧0aad34bのappと現在module群を実ブラウザで比較し、基本作図・取消／終了・Document置換48状態とOffset／Fillet13状態の計61状態でmodel・mode・履歴・選択とAPI204 key順が一致した。後者はpending／Hintも一致し、savedAtだけを除外した。実図形の生成件数とSpline取消／Document置換後の点数も確認した。診断は一時directoryのcad-pointer-state-equivalence.cjs／.logとcad-pointer-offset-fillet-equivalence.cjs／.log。関連E2E302件が全成功（5.8分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／derived-patterns／sketch-permissions／sketch-projection／centerline／spline／command-panel／hatching／file-safety／png-export／sketch-edit／sketch-move／adversarial-authoring-performance／adversarial-drag-fixtureを実行した。pointer／右クリック選択と取消、Block／派生／Hatch配置、寸法・拘束入力、Sketch切替／移動／権限、Document置換・保存再読込・Undo／Redoと既存UIを確認した。性能全12件を含みpan141ms（175ms未満）、空白矩形216ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-pointer-state-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準と区別する。開始時週枠使用45%／残量55%、検証後使用46%／残量54%で停止条件未到達。test API公開表は127項目・140行・91入力だった。丸ごとの移管では巨大な診断contextを作るため見送り、現在のtest条件内の生成・公開を維持する。次は既存driverの責務ごとにfixture／観測／操作の接続と公開名の境界を確認し、少数の共通capabilityで組立てを集約できる部分を選ぶ。構築監査ではConstraintTestDriverは16入口／30行、PropertiesTestDriverは11入口／27行、DimensionTestDriverは3入口／22行、SketchTreeTestDriverは8入口／21行だった（一時directoryのcad-test-driver-assembly-audit.cjs）。まずDimensionのfixture／interaction／displayの共通scope・layout／serialize・Selection／UIを現物で確認し、専用依存を隠さず接続を絞れるか検討する。生成時の副作用とtest条件、公開順・戻り値／例外を維持する。公開API204 keyの順と、通常機能をtest ownerに移さない境界を保つ。200〜500行、通常構築・test hooks・全体検証の目標は未完了。


### 最新のmode／作図Lifecycle状態所有単位

基準はdevelop 7a14e2c。DrawOperationLifecycle.createSessionがmodeと既存開始／準備・取消・終了・各resetの遷移APIを所有する。appの旧mode初期化位置で作り、各command・表示・診断へ同じreadMode／setMode／selectModeを渡す。後段BasicDrawingTools.createLifecycleで生成済みcommand群をbindし、同じsessionを使用する。早期mode利用と後段command構築の循環をこの初期化段階だけで解消する。可変app contextや状態だけの容器、二重のmode／command draftを作らない。

既存DrawOperationLifecycle.createの遷移本体と外部mode portを受ける旧APIは保持する。bind時にscope・command・DOMを照会せず、操作時は同じdraft・reset／rollbackと通知・例外順を利用する。外部commandからの生のmode変更も同じstateへ反映する。開始guard、取消のmode維持／終了のselect、Sketch限定reset、Document破棄とrollbackの違い、途中失敗時に既に変わったmodeを保持する。

app.jsは2,803→2,803行（行数変化0）。rootの独立mode変数を廃止し、元の34参照・17書込みをownerへ接続、rootの可変letは8→7。行数削減ではなく、状態と実際の遷移処理の所有を揃える単位である。全単体1,822件・関連単体34件が成功（exit 0）。追加3件で早期mode／遅延bind、共有commandでの取消と終了、guardと部分失敗時のmode、Sketch／Documentのreset範囲と独立state廃止を確認した。

構文590ファイルが成功（exit 0）。旧7a14e2cのappと現在module群の実ブラウザ比較では基本作図8種と取消／終了・Document置換48状態、Offset／Fillet13状態の計61状態でmodel・mode・履歴・選択とAPI204 key順が一致し、後者はpending／Hintも一致した（savedAtのみ除外）。各図形の生成件数とSpline取消／置換後の点数も確認した。診断は一時directoryのcad-drawing-mode-equivalence.cjs／.logとcad-drawing-mode-offset-fillet-equivalence.cjs／.log。AST監査でroot mode bindingの廃止とlet7個、既存createの遷移本体が改行形式を除き完全一致することを確認した（cad-drawing-mode-audit.cjs）。関連E2E302件が全成功（5.8分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／derived-patterns／sketch-permissions／sketch-projection／centerline／spline／command-panel／hatching／file-safety／png-export／sketch-edit／sketch-move／adversarial-authoring-performance／adversarial-drag-fixtureを実行した。作図／拘束・Block／派生／投影／Hatchと各取消、Sketch切替・権限・移動、PNG出力と保存読込・Document置換・Undo／Redoを確認した。性能全12件を含みpan143ms（175ms未満）、空白矩形216ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-drawing-mode-lifecycle-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準として区別する。開始時週枠使用44%／残量56%、検証後使用45%／残量55%で停止条件未到達。次は残るpointer stateの実利用・入力／描画への所有関係と、test hooksの生成・公開境界を確認する。lastPointerWorldはpress／moveとcontext menuから更新し、Selection／Sketch切替で解除する生のworld座標であり、snapやpreview解除を伴うDrawingPreview.pointerと同一視しない。test APIはtest query条件内だけで組み立てる現在の境界、204 keyの公開順、各既存driverへの委譲を維持し、公開名の組立てとfixture／通常操作の所有を区別して検討する。通常機能をtest ownerに移したり、別の巨大rootへ移すだけの分割を避ける。200〜500行・他の通常構築・全体検証の目標は未完了。


### 最新のOffset／Fillet共有capability接続単位

基準はdevelop d9d04e7。既存BasicDrawingTools.createAuthoringのcreateOffset／createFilletへ、同じGeometry・ID・Selection／preview・snap解除・通知を共有する組立てを集約した。Offsetの同期済み編集scope、Filletの実EditingCheckpoint・pointer reader・stabilize、後段Lifecycle.prepareは個別依存のまま保持する。元の生成位置と実featureを維持し、数値処理・求解・取消／復元・履歴の所有者を変更しない。新file・script順変更、新たな操作state／scopeはない。

app.jsは2,805→2,803行（2行減）。対象構築引数56→28（Offset30→15、Fillet26→13）、異なるroot binding参照41→25、root未使用bindingは0。構文590ファイル・全単体1,819件・関連単体22件が成功（exit 0）。追加2件で共有参照、Offsetの独立したlive scope、Filletの実checkpoint、生成時無操作、遅延Lifecycleとpointerの最新値、元の例外伝播を確認した。

旧d9d04e7のappと現在module群を実ブラウザで比較し、Offsetの開始／入力／完成／undo／redo／取消とFilletの初選択／半径／完成／undo／redo／再読込／取消の13状態でmodel・mode／pending・履歴・選択・Hintとtest API204 key順が一致した（savedAtのみ除外）。実際の生成件数も確認した。診断は一時directoryのcad-offset-fillet-authoring-equivalence.cjs／.log。関連E2E270件が全成功（5.3分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／derived-patterns／sketch-permissions／sketch-projection／centerline／spline／command-panel／hatching／adversarial-authoring-performance／adversarial-drag-fixtureを実行した。Offset／Filletの作図・取消・寸法編集、既存図形・Block／派生／投影と権限、Undo／Redo・保存再読込を確認した。性能全12件を含みpan141ms（175ms未満）、空白矩形216ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-offset-fillet-authoring-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準と区別する。週枠使用44%／残量56%で停止条件未到達。次はmodeの所有とDrawOperationLifecycleの開始・終了／取消・resetの境界を監査する。早期に必要なmodeと後段commandの初期化順を確認し、状態と実際の遷移処理を同じownerへ集められるか検討する。get／set容器だけへの移動、巨大app context、単純な別rootへの移動は採らない。200〜500行、mode・test hooks・他の通常構築の全体目標は未完了。


### 最新の作図owner／Lifecycle接続単位

基準はdevelop ce47479。authoringTools.createLifecycleが、既に生成したprimitive command／Spline draft・snap／preview／projection・transientと共通通知を、既存DrawOperationLifecycleへ接続する。後段の9依存（開始guard・Instance／参照元編集・Centerline／Fillet／Offset／Hatch・mode reader・trim hover解除）だけをappから渡す。親のresetEditing callbackと後段Hatchは操作時に呼び、実ownerのreceiverを維持する。select modeは同じ共有setModeを使い、新たなmode／draft／Lifecycle stateや可変bind容器を作らない。

Lifecycle生成は元の位置のまま、生成時にHatch・編集session・mode等を照会しない。core DrawOperationLifecycle.createと全処理本体は変更せず、開始・準備／終了・取消・Sketch切替・Document置換で異なるreset対象とrollback、現在modeの読取り、UI／履歴の有無、例外時の途中反映を維持する。InstanceやFillet等の開始／確定や求解を親へ移管せず、各command／featureの責務として保持する。

app.jsは2,810→2,805行（5行減）。対象構築引数28→9、異なるroot binding参照30→12、不要になったtransient別名3個を除きroot未使用bindingは0。構文590ファイル・全単体1,817件・関連単体29件が成功（exit 0）。追加2件は実DrawOperationLifecycleと境界用commandで生成時無照会、同じ生成済みdraft／外部ownerのreceiver、Sketch限定reset、Spline取消とresetの違い、transient rollback／clear、modeと通知順、Document破棄の範囲、reset失敗時の選択mode・後続短絡を確認する。既存Lifecycle／実Spline／Centerlineの動作テストも成功。新file・script順変更はない。

旧ce47479のappと現在module群の実ブラウザ比較では、基本作図8種の入力／完成28状態、線・矩形・円・円弧・長穴・Splineの入力途中／Escape取消／終了18状態、Spline作図中のDocument置換前後2状態の計48状態でmodel・mode・履歴・選択とtest API204 key順が一致した（savedAtのみ除外）。Splineの仮点取消と置換後の点数、各図形の生成件数も確認した。診断は一時directoryのcad-authoring-lifecycle-equivalence.cjs／.log。関連E2E282件が全成功（4.7分、exit 0）。unified-ui／phase0-characterization／spline／centerline／blocks／sketch-permissions／sketch-edit／sketch-projection／free-instance／derived-patterns／command-panel／hatching／file-safety／adversarial-authoring-performanceを実行した。作図とSpline／Centerline・Block／派生／Hatchの取消・確定、Sketch切替とlock、Document置換／読込失敗時保持、Undo／Redo・保存再読込と既存画面を確認した。性能全12件を含みpan142ms（175ms未満）、空白矩形217ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-authoring-lifecycle-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功を過去の基準として保持する。開始時週枠使用42%／残量58%で停止条件未到達。次はOffsetFeature／FilletFeatureの構築と現在の作図ownerが共有するGeometry・ID・snap／Selection／preview／通知・Lifecycle準備を確認する。Offsetの同期済み編集scopeと基本作図のWorkspace scope、Filletの独立checkpoint／stabilize、後段Lifecycle.prepareの遅延callbackとcommit／Parameter／UIの時機を同一視しない。数値処理・rollbackを既存featureに残し、共有capabilityで接続を絞れるかを先に検討する。異なる開始／取消を無理に統一せず、全app contextや別の巨大root、modeのget／set容器だけへの移動を避ける。200〜500行、mode・test hooks・他の通常構築の全体目標は未完了。

### 最新の基本作図二段階組立て単位

基準はdevelop ce82291。既存BasicDrawingTools.createAuthoringがDrawingSnap→SplineDraft／SplineCommand→SnapConstraints→Line／Rectangle／Circular／Slot toolsetを生成・接続する。SketchContext・PointUsage・Geometry read、同じGeometry／ID・Selection／preview／checkpointと限定操作を共有し、各子へ必要な元の関数だけを渡す。返すsnap・Spline draft／command・snapConstraints・toolsは同じ実体で、新しい操作state／scope／cacheやGeometryを複製しない。

Centerlineは後段createCenterlineへcommit／parallelTolerance／invalidateの3依存だけを渡し、既存の三部品を元の後段で生成する。共有snap解決は毎回10/scaleを読み、解決後の同じactive snapを使用する。Geometry生成／endpointと交差するSketchProjectionEditing、Offset／求解は独立した既存ownerに残す。Spline編集・checkpointの後段const参照は従来どおりcallbackのまま。実factoryのcreate直下の呼出しがObject.freezeのみで、生成時にscope・モデル・checkpoint・入力／DOMを操作しないことを確認した。reset／取消／復元・履歴を統一せず、旧create／createSpline／createCenterlineも維持する。

app.jsは2,822→2,810行（12行減）。対象構築5→2、明示引数合計93→39（前段36／後段3）、異なるroot binding参照55→41。未参照になったPointUsage別名2個を除きroot未使用bindingは0、app単体構文も再確認した。構文590ファイル・全単体1,815件・関連単体19件が成功（exit 0）。追加2件は境界用factoryで生成順／後段Centerlineの遅延、同じ返却owner・Geometry／ID／Selection／checkpoint関数、最新scaleとsnap解決後の値／receiver、作成Splineの同じ選択参照→select modeを確認する。既存の実Spline／Centerlineのguard・取消・失敗復元と実snap／拘束付与のテストも成功した。新file・script順変更はない。

旧ce82291のappと現在module群の実ブラウザ比較では、線・矩形・円・円弧・3点円弧・長穴・Splineの各クリック途中／完成、Centerlineの開始／初点／完成の28状態でmodel・履歴・選択とtest API204 key順が一致した（savedAtのみ除外）。各図形の生成件数も確認し、両版が何も生成しないだけの一致ではない。診断は一時directoryのcad-basic-authoring-equivalence.cjs／.log。関連E2E268件が全成功（4.5分、exit 0）。unified-ui／phase0-characterization／spline／centerline／blocks／sketch-permissions／sketch-projection／free-instance／derived-patterns／command-panel／hatching／adversarial-authoring-performanceを実行した。各基本作図とsnap／拘束付与、Spline／Centerlineの開始・取消・失敗復元、Block／投影／派生・権限と既存画面・保存再読込を確認した。性能全12件を含みpan141ms（175ms未満）、空白矩形218ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-basic-authoring-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準として保持する。開始時週枠使用41%／残量59%で停止条件未到達。次は同じ作図ownerを終了・reset・取消へ接続するDrawOperationLifecycleの組立てを確認する。親の共通snap／preview／draft／Geometryと、後段のCenterline・Instance／参照元編集・Fillet／Offset／Hatch等を必要な時機で接続し、Lifecycle自身のstart／exit／cancel／Sketch変更／Document置換の異なるreset対象とrollbackを維持する。modeをgetter／setter容器へ移すだけの案、全app context、別の巨大rootは避ける。200〜500行、mode・test hooks・他の通常構築の全体目標は未完了。

### 最新の採番予約／Block重複ID照会単位

基準はdevelop 09d38c6。DocumentIds.createReservationは同じGeometryIds／DocumentIdsと現在Hatch採番readerの3依存で、Geometry→添付要素の予約と、その後の現在Hatch値→Block scope予約を所有する。生成時にscope／counterを照会せず、新しい採番状態やrollbackを持たない。元のallocator receiverとsource、readerの実行時機、undefined返却、各段階の例外と既反映counterを保持する。DocumentSequencesは読込後の純粋な復元計算に残し、予約手順をcodecへ持ち込まない。

duplicateBlockElementIdは複製・採番ではなく重複検査だったため、同じ本体をBlockCatalog.duplicateElementIdへ移管した。対象8 collectionの順と一括展開後のID走査、String(item?.id || "")、最初の重複・空文字列／null、検査しないcollectionを維持する。registry・ID状態やモデルを変更せず、BlockCompletionCommandは既存catalogの照会を既定値として使い、明示checkerとnullをundefined以外で優先する。拒否判断・Hint／drawと確定／履歴はCommandに残す。appからcollection規則とchecker portを除き、予約は既存入口から限定APIへ接続した。

app.jsは2,837→2,822行（15行減）、root未使用bindingは0。構文590ファイル・全単体1,813件・関連単体14件が成功（exit 0）。追加4件は実allocatorの共有／high watermarkとGeometryのみ／Block scopeの予約差、各receiver・添付予約後のHatch読取りと途中失敗、registry無照会・8 collectionの先行展開／変換順・除外対象／空ID、catalog既定checkerと明示関数／null・重複拒否時のsession／未採番を確認する。初回は追加した拒否テストが既存drawを期待に含めず1件失敗した。元のCommandのHint→draw→returnを確認して新テストだけ訂正し、既存期待値と製品の拒否挙動は変えていない。新file・script順変更はない。

旧09d38c6のappと現在module群の実ブラウザ比較では、Document／Blockの変更・Undo／Redo・取消／確定・再読込と再読込後の新規採番の14状態でmodel内ID・履歴・Block editor・選択とボタンが一致した。test API204 key順も一致し、savedAtだけ除外した。診断は一時directoryのcad-id-reservation-equivalence.cjs／.log。関連E2E266件が全成功（4.4分、exit 0）。unified-ui／phase0-characterization／file-safety／blocks／free-instance／derived-patterns／sketch-projection／hatching／derived-selection-copy／command-panel／adversarial-authoring-performanceを実行した。Block／子Block編集と取消／確定、Geometry／Hatch／派生のcopy／paste・Block化、保存済み状態と旧形式移行／再読込、既存画面・Undo／Redoを確認した。性能全12件を含みpan144ms（175ms未満）・空白矩形219ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-id-reservation-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功を過去の基準として保持する。開始時週枠使用40%／残量60%で停止条件未到達。次は小さい単独helperだけを追わず、通常機能の構築境界へ戻る。BasicDrawingTools周辺のGeometry生成／endpoint／DrawingSnap／Spline／SnapConstraints／primitive toolsetと後段Centerlineを確認し、現在scope・同じGeometry／snap／draft・checkpoint／取消を共有する機能組立てとして集約できるか検討する。交差して生成するSketchProjectionEditing／Offset／求解への依存と後段reader、生成時の副作用を現物から確認し、全app contextや別の巨大rootへ移す案は避ける。200〜500行、mode・test hooks・他の通常構築の全体目標は未完了。

### 最新のHint／log表示owner単位

基準はdevelop e5972ab。src/ui/application_feedback.jsへApplicationFeedbackを追加し、DOMのdocument・ApplicationSettings・InteractionProfiler・重複件数readerの4依存でHint／logのDOM出力、Hint計測とSolver結果の表示接続を所有する。既存ConstraintFeedbackを一つ生成し、同じ純粋なformatterをTree／Properties／拘束入力へも返す。文言・判定はConstraintFeedback、翻訳／再翻訳はApplicationSettings、計測はInteractionProfilerのまま。モデル・Solver・履歴や独自のHint／言語／error stateを持ち込まない。

formatter生成をprofiler直後へ早めたが、生成時はDOM・言語・active・重複件数を読まず、後段のConstraintRedundancyは限定readerで遅延参照する。log要素は操作時に取得し、不在ならmessage変換を短絡する。HintはhintSourceのString代入→元messageの翻訳→textContent→error classとし、途中失敗の既反映値と例外を保持する。profile非activeは直接出力、activeは元の非bind workのui phaseと返却値を維持し、Solver結果表示自体はundefinedを返す。appのhoisted三入口は既存操作へ接続する。

app.jsは2,853→2,837行（16行減）、root未使用bindingは0。構文590ファイル・全単体1,809件・関連単体12件が成功（exit 0）。追加4件は実ConstraintFeedbackを使い、生成時無照会、log要素の再取得と不在時無変換、Hintの順序と最新言語、raw profileと返却値、最新重複件数と渡された結果の無変更、翻訳／profile／DOM不在の例外・部分反映を確認した。index.html、構文一覧、単体一覧、unified-uiのscript順期待を同じ位置へ同期し、先行ConstraintFeedback→ApplicationFeedback→appを確認した。既存sourceの役割とロード方式は変えず、起動ごとのqueryも維持する。

旧e5972abのappと現在module群の実ブラウザ比較では、Document／Block編集・Undo／Redo・取消／確定／再読込と日英切替の15状態でHint本文／原文／error class／log、model・履歴・Block editor・選択とボタン、test API204 key順が一致した（savedAtだけ除外）。診断は一時directoryのcad-application-feedback-equivalence.cjs／.log。関連E2E249件が全成功（4.2分、exit 0）。unified-ui／phase0-characterization／file-safety／blocks／command-panel／derived-patterns／sketch-permissions／sketch-projection／unified-annotations／parameter-dialog-controller／adversarial-authoring-performanceを実行した。script読込順・起動とfile URL、日英切替、求解／拘束／権限・Parameterの案内、Block／派生の操作・取消と履歴、既存画面・保存再読込を確認した。性能全12件を含みpan141ms（175ms未満）・空白矩形234ms（250ms未満）。E2E本体／期待値・性能基準は変えず、unified-uiは新script読込期待だけ同期した。runner終了と専用server停止を確認済み。ログは一時directoryのcad-application-feedback-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準として保持する。開始時週枠使用39%／残量61%で停止条件未到達。次はappに残るBlock編集／Geometry複製の採番・ID予約と既存GeometryIds／DocumentSequencesの境界を確認する。reserveBlockEditorSequences／reserveGeometryElementSequences／duplicateBlockElementIdの呼出し元と型分岐、元のscope・ID共有／予約時機を追い、重複する採番状態や新しいID規則を加えず既存ownerへ集められるか検討する。200〜500行、mode・test hooks・通常構築の全体目標は未完了。

### 最新のDocument準備と保存writer単位

基準はdevelop 09ab703。DocumentApplication.createPreparationが6依存（Document固定参照・現在scope／Block session照会・SketchContext・ParameterNamespace・BlockCatalog）から既存BlockStateを構成し、appearance／blocks／prepareを公開する。準備はunits→Sketch→外観→Block→現在scopeと全定義の描画順→Parameterの既存順とし、scopeやBlock編集判定／draft IDを各段階で再取得する。読込後の個別正規化も同じAPIへ接続し、Workspaceと同期済み編集scopeの区間差を統一しない。

DocumentSnapshot.createWriterは7依存でprepare→Workspace snapshotSource→ISO時刻／名前／Hatch採番→既存codecを接続する。生成時はモデル・scope／session・metadata／fieldを照会せず、準備・直列化を実行しない。codecのcreate・保存fieldとversionは維持し、新file／state／snapshot cacheや独自normalizeは加えない。新入口は準備の副作用を明示して受け取り、例外では既反映値を保持して後続を短絡し、次回は準備から再実行する。

app.jsは2,866→2,853行（13行減）、root未使用bindingは0、両構築の後段const直接参照は0。構築引数は従来BlockState／codecの6個から準備6＋writer7の計13個へ増えるが、app本体に暗黙だった準備・保存metadataの依存を二つの責務境界で明示したもので、引数削減とは扱わない。準備手順と保存候補生成はappから除き、既存normalize／codecは各ownerに残した。構文588ファイル・全単体1,805件・関連単体17件が成功（exit 0）。追加4件は生成時無照会、各工程で変わるscopeとBlock編集状態、unitsの新Objectと順序／途中失敗、準備後の保存元とmetadata時機、旧codecとの保存値一致、失敗時の短絡と次回の再実行を確認する。

旧09ab703のappと現在module群の実ブラウザ比較では、Documentの初期／変更／undo／redo、Block開始／変更／undo／redo／取消、確定／確定undo／redoと再読込の13状態でmodel、履歴、Block editor、選択、ボタンとtest API204 key順が一致した（savedAtだけ除外）。診断は一時directoryのcad-document-preparation-equivalence.cjs／.log。関連E2E273件が全成功（4.6分、exit 0）。unified-ui／phase0-characterization／file-safety／blocks／free-instance／derived-patterns／sketch-projection／unified-annotations／hatching／parameter-dialog-controller／adversarial-authoring-performanceを実行した。DocumentとBlock編集中の保存元・旧形式移行／byte-shape、保存済み状態と失敗時保持、Undo／Redo・取消／確定、派生／参照・Hatch／Annotation／Parameter、既存画面と再読込を確認した。性能全12件を含みpan142ms（175ms未満）、空白矩形203ms（250ms未満）。既存期待値・性能基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-document-preparation-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準として保持する。開始時週枠使用38%／残量62%で停止条件未到達。次はappに残るlog／HintのDOM出力と計測、Solver結果の表示接続をUI責務としてまとめる。ConstraintFeedback／AuthoringFeedbackは純粋な文言生成、ApplicationSettingsは翻訳と設定、ToolbarViewはcontrol／command statusとして維持し、Hint／logのDOM寿命・出力を扱う限定ownerが必要か検討する。log要素不在の短絡、hintSource代入→翻訳→error class、profile非active／active時の元workと戻り値、重複件数の操作時取得、例外の途中反映を維持する。通常機能をtest ownerへ移さず、単なるget／set容器や全app contextにしない。200〜500行、mode・test hooks・他の構築の全体目標は未完了。

### 最新のDocument／Block履歴機能組立て単位

基準はdevelop 423dadd。既存HistoryController.createFeatureがDocument履歴→core Controller→BlockHistorySnapshot→HistoryRestorationを生成・接続し、Block履歴は要求ごとに独立生成する。履歴snapshotからsavedAt／documentNameを除く方針とrecord計測も同入口へ集約した。EditHistoryのstack／signature、Block snapshotの複製、RestorationのDocument／Block別復元とControllerの抑止flagは既存ownerのまま。document引数はname／loadのadapterであり、DOMをeditingへ持ち込まない。モデル・scope・履歴・flagやglobalを複製しない。

純粋なfactoryを早期にまとめたが、生成時はDocument直列化・Block session／定義・profile activeを照会せず、capture・復元・通知を実行しない。既存serializer／clone／restore／UIの関数とreadyなownerを渡し、後段constを直接捕捉する新引数は0。Document履歴の同じ実体をTransientAuthoringのdiscardLatest／Document名UIのcurrentSnapshotへ返す。core Controllerのrecordは非計測のまま、featureのrecordだけが最新activeと元の非bind workを使い、profileの戻り値と例外を維持する。Document restoreの成功true、Blockの既存返却値、stack移動後の例外とfinally通知、変更なしでも通知・新記録時だけlog、Document名／補助作図設定の保持を維持する。

app.jsは2,905→2,866行（39行減）。対象factory呼出し5→1、構築引数合計30→16、異なるroot binding参照21→17、root未使用bindingは0。snapshot／Block履歴生成／recordの実装と未参照になった二つの復元委譲をappから除いた。構文588ファイル・全単体1,801件・関連単体15件が成功（exit 0）。追加2件は実EditHistory／BlockHistorySnapshot／Restorationで生成・Block履歴準備時の無照会、同じDocument履歴と独立Block stack、metadataだけの変更の非記録・元serializer結果の維持、undo／redoと現在session切替、復元中の再record抑止、profileのraw receiver／戻り値、capture／load／profile例外時のstack・後続短絡とfinally通知を確認した。旧各createは維持し、新file・読込方式変更はない。

旧423daddのappと現在module群の実ブラウザ比較では、Documentの初期／変更／undo／redo、Block編集開始／変更／undo／redo／取消、確定／確定undo／redoと再読込の13状態でmodel、Document／Block履歴、Block editor、選択とUndo／Redoボタン状態が一致した。test API204 key順も一致し、savedAtだけ除外した。診断は一時directoryのcad-history-feature-equivalence.cjs／.log。関連E2E252件が全成功（4.3分、exit 0）。unified-ui／phase0-characterization／blocks／sketch-edit／sketch-move／command-panel／free-instance／derived-patterns／sketch-projection／sketch-tree-delete／adversarial-authoring-performanceを実行した。Document／Block／子Blockの履歴と取消・確定、仮作図、複数選択・削除、参照／派生と既存画面・保存再読込を確認した。性能全12件を含み、pan141ms（175ms未満）・空白矩形203ms（250ms未満）。さらにfile-safety全11件も成功（9.8秒、exit 0）し、保存済み状態のedit／undo／redo追従、開く前の保存確認、遅いsave／load中の変更検知、無効fileで履歴／保存先を保持、離脱guardを確認した。計263件は関連二実行であり全E2Eではない。既存期待値・性能基準を変更していない。両runner終了と各専用server停止を確認済み。ログは一時directoryのcad-history-feature-{focused,check,unit,related,file-safety}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、最新全E2Eは未実行。c3a213cの全584成功を過去の基準として保持する。開始時週枠使用37%／残量63%で停止条件未到達。次はappに残るDocument準備・直列化の境界を確認する。ensureModelStateはunits→Sketch→外観→Block→現在scopeと全Block定義の描画順→Parameterの順で既存ownerを呼び、serializeModelはWorkspaceのsnapshotSourceを使う。DocumentSnapshotはcodec、DocumentApplicationは読込／置換、DocumentState／Workspaceは値とscopeを所有する現行境界を基準に、モデル準備の所有と保存用metadataの組立てを整理する。現在BlockとDocument固定参照、各normalizeの実行時機・例外と後続短絡を維持し、読取りを装った新たな副作用や独自scope・snapshot cacheを増やさない。200〜500行の全体目標、mode・test hooks・他の構築は未完了。

### 最新の共通コマンドパネル組立て単位

基準はdevelop 520f329。既存CommandPanel.createFeatureがDerived→Hatch→Annotation→routing→DOMの5 factoryを生成・接続する。SketchContextから名称／active／所属の元の関数を取り出し、既存commandと23個の限定依存を各子へ接続する。新file・global／draft／rollbackはない。二つの実panelを返し、appの前段からの遅延照会と同じ位置での構築を維持する。生成時はmode／commandを照会せず、DOMのsection追加と4 listener登録、mode／Annotation外観のactive Sketchの操作時取得を保つ。

Derivedの参照元編集取消はfinish(false)の結果を即returnし、他のDerivedはexit→解析を更新しないUI更新→取消hint→draw、Hatchは同順で追加hintなし、refreshはProperties→draw。共通cancelDrawingは通知手順だけを共有し、commandの取消／復元を再実装しない。途中例外と後続の短絡、旧create／createRouting、PNG／Annotation／Hatchの優先と既存DOM／入力保持を維持する。

app.jsは2,924→2,905行（19行減）。対象factory呼出し5→1、構築Objectの明示property合計32→23、引数内の異なるroot binding参照27→22、root未使用bindingは0。構文588ファイル・全単体1,799件・関連単体21件が成功（exit 0）。追加2件は実adapter／共通DOMで生成時無照会・登録順、同じderivedPanel実体、選択／解除／確定とProperties更新、active Sketch変更時の外観・元draft無変更、PNG優先、取消の分岐・返却値・raw receiver・UI例外時の途中状態を確認する。最初の単体実行は補助関数のrest引数内のuse strictが構文エラーとなり、fixture外側のstrictへ直して成功した。製品コード・既存期待値を変えて成功させたものではない。

旧520f329のappと現在module群の実ブラウザ比較では、投影の未選択／選択／確定、参照元編集／取消、Hatch選択／取消、Annotation開始／取消、PNG開始／取消の11状態でpanel HTMLとfield値、model・選択・履歴が一致した。test API204 keyの順序も一致し、savedAtだけ除外した。初回診断はAnnotation継続中にPNG開始を試み、旧版でも開始拒否されたためcancelボタン待ちでtimeoutした。AnnotationをEscapeで終了してPNG表示を確認する診断手順へ訂正し、初回ログも保持した。製品コード・E2E本体・期待値は変更していない。診断は一時directoryのcad-panel-assembly-equivalence.cjs／.logとequivalence-initial.log。関連E2E246件が全成功（4.3分、exit 0）。unified-ui／phase0-characterization／command-panel／png-export／unified-annotations／hatching／free-instance／derived-patterns／sketch-projection／sketch-permissions／adversarial-authoring-performanceを実行した。panel行の選択・解除・確定／取消、PNGの解像度・描画復元と出力、Annotation入力／外観、Hatch領域、投影・派生／Instance参照元編集、Sketch権限、既存画面・履歴／保存再読込を確認した。性能全12件を含み、pan122ms（175ms未満）・空白矩形199ms（250ms未満）。既存期待値・性能基準を変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-panel-assembly-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fのまま保留、最新全E2Eは未実行。c3a213cの全584成功は過去の基準であり、今回の関連検証とは区別する。開始時週枠使用36%／残量64%で停止条件未到達。次はDocument／Block履歴のcapture・record／restore・通知の構築境界を既存HistoryController／HistoryRestoration／Snapshot／UIの役割と照合する。documentHistoryの早期生成と後段のsnapshot／restoration、Block編集中のactive history、復元中のrecord抑制・finally通知、Document名の保存外／履歴外の扱いとprofile時の戻り値を維持し、DOMをediting ownerへ持ち込まず、単なる全依存contextへの包装を避ける。documentHistoryはTransientAuthoringのdiscard／Name UIのcurrentSnapshotにも使われるため、Controller内部へ隠すだけの案は採らず、同じ実historyを共有する。EditHistoryはsnapshot方針を呼出し側へ委ね、HistoryRestorationはDocumentとBlockで異なる復元を所有する現行契約を基準に、機能の組立てと各ownerの責務を区別して検討する。200〜500行の全体目標、mode・test hooks・他の構築の課題は未完了。

### 最新の構築境界再監査（2026-10-21）

develop caf19a0の現物を再集計し、[再監査](bootstrap-boundary-audit.md)に残存責務・候補の依存と次の実装案を記録した。app.jsは2,924→2,924行（0行差）、今回は文書のみ。旧46dd77dからは164行減、構築216→209文／1,354→1,266非空白行、test hooks478→438行。modeの20代入と二つの操作state＋六つの後段接続は残る。後段const参照117回は全て関数内だが、生成時に呼ばれない証明とは区別する。hooksを全移動しても数百行へ届かず、通常機能の構築境界を引き続き整理する。

次はCommandPanelの表示機能を生成・接続する入口を既存src/ui/command_panel.jsへ集約する案を実装する。Derived→Hatch→Annotation→routing→DOMの5 factoryの順、二つの実panelを返すこと、前段からの遅延照会、mode／styleの操作時取得、DOM／listenerの登録寿命を保つ。SketchContextと既存commandを必要な限定APIへ接続する。Derivedのinstance-sources取消の即return、他のDerived取消とHatch取消のhint差、refreshの順・例外を維持する。独自state／rollbackや巨大なcontextは加えない。共通UIの組立てだけで全体目標へ到達したとは扱わない。mode・test hooks・他の通常構築も未完了として継続する。

旧集計の再現・分類／folder合計、modeと後段参照、実panel sourceと利用箇所を確認した。製品コード差分なしのため製品テストは再実行せず、直前の構文588・単体1,797・関連E2E246成功を同一製品コードの証拠として保持する。全E2Eはc3a213c時点の584成功が過去の基準。mainは5ee5f3fのまま保留。週枠使用36%／残量64%で停止条件未到達。

### 最新の拘束解析の照会owner共有単位

基準はdevelop 5425e7c。ConstraintAnalysis.createWithRedundancyがSketchContextのmembershipQuery・子孫／所属・Root／編集可否と、GeometryReadServicesのInstance／Block bundle・参照元Pointの9関数を共有する。個別引数はundefinedだけ同じ関数で補い、明示関数とnullを優先する。所有者Objectを各子へそのまま横流しせず、従来の限定関数を取り出して渡す。生成時のqueryは追加せず、元の引数とraw receiver、membershipのrefreshごと取得を維持する。

Document／Block modelのcurrentScope、注記dragの補助scopeを使うscopeQuery、readServicesの読取りscopeを別のまま明示し、モデルやqueryを複製・cache／snapshot化しない。通常／重複・Block／派生の計算、profile／許容差とcache・例外境界は変えない。旧各createと個別接続のAPIを維持し、新file・global／stateはない。

対象構築の引数19→12、引数内の異なるroot binding参照20→13。app.jsは2,926→2,924行（2行減）、root未使用bindingは0。構文588ファイル・全単体1,797件・関連単体16件が成功（exit 0）。既存の二組立て方式と共有owner方式で遅延cache・重複state／count・scope切替・前計算再利用・例外時の部分更新を比較し、新規1件で明示membershipの優先／refreshごとの呼出し・raw receiver、明示nullが既存TypeErrorと未更新stateを保つことを確認した。旧5425e7cのappと現在module群の実ブラウザ比較でも、5図面と各再読込後の10状態で分類の反復照会・解析・展開Tree・model・historyが一致した（savedAtのみ除外）。診断は一時directoryのcad-analysis-owners-equivalence.cjs／.log。関連E2E246件が全成功（6.7分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／derived-patterns／sketch-permissions／sketch-projection／parameter-dialog-controller／view-visibility／adversarial-authoring-performance／adversarial-drag-fixture／geometry-drag-smoothnessを実行した。分類・重複／支持状態と参照、Block／派生、Parameter・scope切替、実drag、保存再読込・既存画面を確認した。性能全12件を含み、pan140ms（175ms未満）・空白矩形220ms（250ms未満）。既存期待値・基準と計算処理は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-analysis-owners-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、現行コードの全E2Eは未実行。c3a213cの全E2E584成功と前単位の関連246成功は過去の基準として保持する。開始時週枠使用35%／残量65%で停止条件未到達。分類／重複診断のcanonical接続は12引数の境界として保持し、さらに小さいwrapperを増やすだけの変更は優先しない。次は現行appの通常構築・test hooks・起動とmode接続を再監査する。直近のTree／Properties／解析等の機能境界を基準に、残る構築量・共有依存・後段const参照と生成／bind／startの段階を現物から集計し、よりまとまった分離単位を選ぶ。単なるcallback集合の移動や空行削減で数値を達成せず、200〜500行の全体目標を維持する。

### 最新の拘束分類／重複診断の組立て単位

基準はdevelop aeadad9。ConstraintAnalysis.createWithRedundancyへ既存ConstraintRedundancy→ConstraintAnalysisの生成・接続を集約した。共通currentScope・Solver・scopeQuery・許容差を共有し、Redundancyの変数照会はscopeQueryの同じsketchSolveVariables、分類からの重複refreshも元の同じ関数を渡す。profile hookは包み直さず、生成時にscope・Solver・参照有効性・profileを実行しない。返すanalysis／redundancyは既存各ownerで、分類cacheと重複Map／countを統合・複製しない。旧各createは独立APIのまま残し、新file・state・contextは追加しない。

分類invalidateは重複状態を消さず、候補probe／forgetConstraintとcountの更新時機は既存Redundancyに残す。参照更新→所属照会→分類計算とcache設定→重複refreshの順、各段階の例外とprofile呼出しを維持する。重複refreshで例外が出た場合にも、新しい分類cacheと以前の重複状態が残る元の境界を保ち、一括rollbackを加えない。Rootの不要なrefreshConstraintRedundancy aliasを除去した。

対象構築は2→1、引数合計24→19、引数内の異なるroot binding参照22→20。app.jsは2,929→2,926行（3行減）、root未使用bindingは0。構文588ファイル・全単体1,796件・関連単体15件が成功（exit 0）。追加2件は旧二factoryでの組立てと比較し、生成時無照会、遅延cache／同じ診断owner・count、forget後／invalidate後の診断、事前計算結果の再利用、scope切替、参照／Solver／重複の例外時のcacheと診断の部分更新・後続短絡を確認する。旧aeadad9のappと現在module群の実ブラウザ比較では、支持状態／Sidebar／Block／参照subtree／派生作図の5図面と各再読込後の10状態が一致した。分類の反復refresh・解析値・展開Tree HTML・model・historyを比較し、savedAtだけ除外した。診断は一時directoryのcad-analysis-assembly-equivalence.cjs／.log。関連E2E246件が全成功（6.7分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／derived-patterns／sketch-permissions／sketch-projection／parameter-dialog-controller／view-visibility／adversarial-authoring-performance／adversarial-drag-fixture／geometry-drag-smoothnessを実行した。通常・支持・派生／Blockの分類、参照／重複拘束・追加拒否と回復、Parameter／scope切替、実drag・保存再読込と既存画面を確認した。性能全12件を含み、pan140ms（175ms未満）・空白矩形216ms（250ms未満）。既存期待値／基準や計算処理は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-analysis-assembly-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、現行コードの全E2Eは未実行。c3a213cの全E2E584成功と前単位の関連252成功は過去の基準として保持する。開始時週枠使用33%／残量67%で停止条件未到達。次は分類／重複が使うSketchContext・GeometryReadServicesの既存照会を共有できるか確認する。membershipQueryはrefreshごとの取得、Sketch所属／Root・編集可否とbundle照会は現在のowner・元の引数／receiverを保つ。scopeQueryの注記drag補助scopeと、currentScopeのDocument／Block modelを無断で統一しない。計算規則やcache・許容差を変えず、単なる大きなcallback集合にせず依存を絞る。mode・他の通常構築・test支援も残り、200〜500行の全体目標は未完了。

### 最新のTree View／Controller組立て単位

基準はdevelop 08b030c。SketchTreeController.createWithViewで既存View→Controller→menuの生成と相互callbackを集約した。同じCanvasSelectionから選択Sketch、同じObjectsから対象解決、SketchContextからRoot／active照会、ApplicationSettingsから翻訳、SketchMoveCommandから現在state／activeと元のchoose／commit／cancelを接続する。Controller固有の限定portは既存createWithContextMenuへ渡し、全app context・別の編集stateは作らない。旧View.create／Controller.create／createWithContextMenuも独立APIとして残す。

viewScope＝editingScopeBinding.currentの遅延readerと、ControllerのcurrentScope＝dimensionPresentationScopeを別に渡す。getScopeKeyは同じBlock Editorの現在draft IDに基づくreaderのままとし、Document／Blockの開閉stateを混同しない。View生成時のresize listener6個の登録→幅設定→menu用二つのDOM取得、初回render時の行event設定、appの外部close入口への接続後のmenu.startを元の順に維持する。生成時にはscope／モデル／移動状態を読まず、move.stateのreceiverとControllerへ渡す元methodを保つ。返すview／controller／menuは同じ各ownerで、幅・開閉、選択・hover、移動／menu sessionを複製しない。新file・global／stateはない。

対象構築は2→1、引数合計49→38、引数内の異なるroot binding参照47→42。app.jsは2,940→2,929行（11行減）、root未使用bindingは0。構文588ファイル・全単体1,794件・関連単体38件が成功（exit 0）。追加2件は実View／Controller／menuを使い、生成時のresize／DOM処理順とscope無照会、表示と操作で異なるmodel／scope、同じSelectionの最新値、ControllerとViewの同じ開閉Map、Document／Block key、移動中のstate表示と選択先通知・作図先不変を確認する。旧08b030cのappと現在module群の実ブラウザ比較でも初期／Sidebar／複数／Block／寸法／非表示／lockとメニューの12状態でHTML・model・historyが一致した（savedAtだけ除外）。診断は一時directoryのcad-tree-view-equivalence.cjs／.log。関連E2E252件が全成功（4.3分、exit 0）。unified-ui／phase0-characterization／sketch-edit／sketch-move／sketch-permissions／sketch-tree-delete／sketch-tree-visibility／sketch-projection／blocks／command-panel／view-visibility／adversarial-authoring-performanceを実行した。Treeの選択・hover・編集／menu・開閉、移動の指定／取消、Point固定解除と作図先制限、lock・可視性、Block編集中のscopeと既存画面・履歴／保存再読込を確認した。性能全12件を含み、pan125ms（175ms未満）・空白矩形199ms（250ms未満）。既存期待値や基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-tree-view-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、現行コードの全E2Eは未実行。c3a213cの全E2E584成功と前単位の関連252成功は過去の基準として保持する。開始時週枠使用32%／残量68%で停止条件未到達。Treeの二つの構築境界は既存queryとUI機能として維持し、さらに単なる包装を増やす案は優先しない。次は通常のConstraintRedundancy／ConstraintAnalysisの生成・共有ownerを確認する。前者は重複状態、後者は分類cacheを持ち、scope／Solverと変数照会が重なる。状態／count・初期化／refresh順、scopeQuery・参照有効性と例外、profile hookを保持した組立てにできるかを先に検討する（未実装）。mode・他の通常構築・test支援も残り、200〜500行の全体目標は未完了。

### 最新のTree Point固定解除の編集owner単位

基準はdevelop 77c3f08。TreeのunfixPoint callbackにあった所属照会→constraint guard→Point.fixed=false→solveAndRefresh(label)を既存FixedToggleCommand.createOperandのunfixPointへ集約した。新しいcommand instance・state・global／contextは追加せず、同commandのguard／所属照会を共有し、求解通知だけを既存portとして加えた。Pointは同じObject、拒否時の無変更とundefined、既に解除済みの対象でも求解すること、一引数label・求解結果を返さないこと、lookup／guard例外の無変更と求解例外時の更新済みflagを維持する。新しいrollbackや履歴・対象Sketch指定を加えず、既定active Sketchの求解・解析／UI／履歴は既存SolveRefreshCommandに残す。

operand commandの生成は入力依存が確立した後、Tree生成前へ移した。createOperand本体は関数構築とfreezeだけで、guard／scope／求解を実行しない。ASTで新位置より後のconst直接捕捉が0、最初の利用より前の宣言であることを確認した。Treeは同じraw unfixPoint関数を直接受け取り、後段commandを読む新しい遅延wrapperは残さない。既存toggleGeometryFixedOperandのhoisted接続とSelection commandの生成位置は維持する。

app.jsは2,940→2,940行（0行差）、root未使用bindingは0。固定解除のUI引数内のroot binding参照は3→1で、UI内のPoint flag代入を撤去した。構文588ファイル・全単体1,792件・関連単体25件が成功（exit 0）。訂正後の関連E2E結果は次段に記載する。追加単体2件は現在所属／guard拒否と同一Point更新、求解label・引数数／receiver・戻り値破棄、既に解除済みの再求解と例外時の更新境界を確認する。E2Eへactive ownerでの固定解除・一回のUndo／Redo・保存再読込、非activeでの拒否と案内・モデル／履歴不変、lock時の手動click拒否の3ケースを追加した。既存テストの期待値や性能基準は変更していない。

初回関連E2E252件は251成功・1失敗（4.3分、exit 1）。追加した非activeの固定解除ケースが許可を期待していたが、既存SketchContext.canEditSketchのconstraint操作は作図先限定であり、正式な[所属と編集可否契約](../../spec/contracts/所属と編集可否.md)も既存の固定図形の直接編集制限を維持する。旧77c3f08と現在appの実ブラウザ比較でも非activeの固定flag／モデル・履歴は変わらず、同じ拒否だった。製品コードを変更せず、新規ケースの前提を既存契約に沿う拒否・案内へ訂正した。初回ログはcad-point-unfix-related-initial.logとして保持する。旧版比較には非activeのモデル／履歴不変とactiveのflag解除の明示assertも加え、8状態のTree／Properties HTML・モデル・履歴が一致した（savedAtのみ除外）。診断は一時directoryのcad-point-unfix-equivalence.cjs／.log。訂正後の関連E2E252件が全成功（4.2分、exit 0）。unified-ui／phase0-characterization／sketch-edit／sketch-move／sketch-permissions／sketch-tree-delete／sketch-tree-visibility／sketch-projection／blocks／command-panel／view-visibility／adversarial-authoring-performanceを実行した。追加3ケース、既存固定／拘束・Block、Tree／Canvas操作、権限・移動、既存画面比較・保存再読込を確認した。性能全12件を含み、pan150ms（175ms未満）・空白矩形224ms（250ms未満）。初回結果を隠さず、初回E2E以降の製品コードや既存期待／性能基準を変えず、新規テストの契約上の前提を訂正した再検証として記録する。runner終了と専用server停止を確認済み。ログは一時directoryのcad-point-unfix-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、現行コードの全E2Eは未実行。c3a213cの全E2E584成功と前単位の関連249成功は過去の基準として保持する。開始時週枠使用30%／残量70%で停止条件未到達。次はTree View／Controllerの共有ownerと構築段階を確認する。Point操作の直接APIを維持し、View listener登録、表示scope／Controller scopeの違いと後段menuのstart、選択／hoverの所有を揃えられる機能境界を検討する。単純な関数移動や巨大なcallback集合で数百行へ到達したことにせず、mode・他の通常構築・test支援も含めて200〜500行の目標を維持する。

### 最新のTree Controller／Context menu結線単位

基準はdevelop a11426a。既存SketchTreeController.createWithContextMenuへ、Controller→CanvasContextMenuの生成と相互callback、Root／active／lockからの編集／名前変更項目表示、メニュー確定の通知を集約した。旧Controllerの限定引数はそのまま既存createへ渡し、共有SketchContext／ApplicationSettingsとdocument／window・escapeHtml・Canvas menuのclose通知を接続する。自由に探索できるapp contextは追加しない。従来createは独立APIのまま維持する。

生成時にはSketch用DOM二参照を元の順で取得するだけで、scope／active／lock／言語の照会やlistener登録を行わない。Viewは元の時機で生成し、遅延callbackで同じControllerを参照する。メニュー表示時の行選択→Canvas menuのclose→RootならSketch menuをclose、他は項目表示の順を維持する。名前変更は同じraw関数、編集は同じController.editSketchへ、既存menuが閉じてから通知する。移動中・子rowの抑止、元の例外・途中状態、最新言語／lockとactiveを維持する。appには他の操作から閉じるためのsketchContextController aliasと、その接続後の明示startを残す。menu session／選択・hover stateは元ownerのまま、新file・state・contextを持たない。

対象構築は2→1、引数合計36→32、引数内の異なるroot binding参照39→36。app.jsは2,953→2,940行（13行減）、root未使用bindingは0。構文588ファイル・全単体1,790件・関連単体36件が成功（exit 0）。追加2件は実Controller／CanvasContextMenuを使い、生成時の無照会／無startとDOM取得順、listenerの重複防止／dispose・再start、Root／active／lockの項目と選択、最新言語、閉じてからのraw rename／編集、移動中／子row短絡と例外伝播を確認する。旧a11426aのappと現在module群の実ブラウザ比較で、前単位の7状態にlocked／Root／別Sketch menu・編集後／blur後の5状態を加えた12状態が一致した。Sketch menuのHTML／hidden／aria-label、展開TreeとProperties HTML・model・historyを比較し、savedAtだけ除外した。診断は一時directoryのcad-tree-menu-equivalence.cjs／.log。関連E2E249件が全成功（4.2分、exit 0）。unified-ui／phase0-characterization／sketch-edit／sketch-move／sketch-permissions／sketch-tree-delete／sketch-tree-visibility／sketch-projection／blocks／command-panel／view-visibility／adversarial-authoring-performanceを実行した。Sketch menuを直接使う既存三fileを含め、Root／active／lock、別Sketchの選択・明示編集、移動・削除／可視性、Canvas menuとcommand取消、Block編集中のUI、履歴／保存再読込と既存画面を確認した。性能全12件を含み、pan126ms（175ms未満）・空白矩形219ms（250ms未満）。基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-tree-menu-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、現行コードの全E2Eは未実行。c3a213cの全E2E584成功と前単位の関連286成功は過去の基準として保持する。開始時週枠使用29%／残量71%で停止条件未到達。次はTreeの固定解除callbackと既存FixedToggleCommandの責務を確認する。単なる1行wrapperを別fileへ置くのでなく、guard・モデル更新・求解／履歴と既存の固定切替の違いを先に確認する。View／Controllerの組立て、mode、他の通常構築・test支援も残り、200〜500行の全体目標は未完了。

### 最新のTree行分類／照会owner共有単位

基準はdevelop d7ff210。SketchTreeObjectsへTree category→可視性照会対象kind／元Objectの分類を集約した。行表示時だけisHiddenへ同じ対象arrayを渡し、Point／Line／Circle／Arc／Spline→geometry、instance→geometryInstance、dimension行を既存rowでconstraintへ正規化して元の拘束を照会する。従来のobjectVisibleを優先し、新たにisHiddenを指定しない旧APIの既定表示も維持する。後段生成のPropertySelectionはrootの同じ遅延照会入口から読むため、create時に未初期化ownerへアクセスしない。

GeometryReadServicesのscope図形検索・Instance bundle・Block投影・定義照会、SketchContextの所属／active、ConstraintFeedbackの拘束名、ApplicationSettingsの翻訳／現在言語を共有した。個別引数はundefinedだけ補完し、同じ関数のreceiverをbindし直さず、設定言語は表示時の最新値を読む。dimensionPresentationScopeは明示readerのままとし、Workspace／editingScopeBindingへ置き換えない。新file・state・context・可視性編集は追加していない。

app.jsは2,957→2,953行（4行減）、対象構築の引数38→32、引数内の異なるroot binding参照36→30、root未使用bindingは0。構文588ファイル・全単体1,788件・関連単体26件が成功（exit 0）。追加2件は9種類の可視性行のmarkup・元Objectと対象kind・無変更、最新hidden／lockと設定言語、生成時の無照会、raw readerの引数／receiver、明示objectVisible／翻訳／言語の優先と例外伝播を確認する。旧d7ff210のappと現在module群を使う実ブラウザ比較でも初期／Sidebar／複数選択／Block／寸法／非表示／lockの7状態で、展開TreeとProperties HTML・model・historyが一致した（savedAtだけ除外）。診断は一時directoryのcad-tree-owners-equivalence.cjs／.log。関連E2E286件が全成功（4.7分、exit 0）。unified-ui／phase0-characterization／sketch-tree-visibility／sketch-tree-delete／sketch-permissions／sketch-edit／sketch-move／sketch-projection／blocks／derived-patterns／derived-selection-copy／hatching／view-visibility／adversarial-authoring-performanceを実行した。9種類のTree可視性・削除、他Sketchの選択／lock・移動、Block編集中scopeと投影・派生、既存画面比較、履歴／保存再読込を確認した。性能全12件を含み、pan158ms（175ms未満）・空白矩形216ms（250ms未満）。基準は変更していない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-tree-owners-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留、現行コードの全E2Eは未実行。c3a213cの全E2E584成功と、直前のdrag支援単位の関連181成功は過去の基準として保持する。開始時週枠使用28%／残量72%で停止条件未到達。次はTree ControllerとContext menuの結線・固定解除操作の既存ownerを確認する。View生成時のlistener登録、後段Controller／menuの遅延接続、選択とhover・guardを維持し、大きなcallback集合を別fileへ移すだけの案は採用しない。mode・他の通常構築・test支援の整理も残り、200〜500行の目標は未完了。

### 最新のdrag実行テスト支援組立て単位

基準はdevelop f6caae7。Propertiesに残るBlock操作は既存commandの直接接続であり、さらに単なるwrapperへ包む分離は見送った。Geometry／Point dragの実行テスト入口は同じGeometryDragFeatureのbuild／prepare／preview／finishとSolverを重複して接続していたため、既存GeometryDragTestDriver.createExecutionSupportへ組立てを集約した。同じfeatureとSolver、現在scope・正規化・誤差計算・時計・拘束観測の九つを明示して受け、Geometry→Pointの順に生成する。featureの同じ関数を渡し、誤差計算は元のSolver receiverで呼ぶ。生成時のscope／Solver／drag／時計読取りはない。

guidedPointDragForTest／guidedPointDragPathForTest／geometryDragPathForTestの三つの名前と登録順を同じownerが公開し、appはtest query内で登録する。旧二factoryは維持し、製品のsession・Solver・正規化／測定・履歴・計測処理を変更せず、通常起動からtestingへ依存させない。rootで不要になったprepare／preview／finishの三つのaliasを除去した。新file・state・汎用contextはない。

app.jsは2,964→2,957行（7行減）、対象構築2→1、引数合計23→9、引数内の異なるroot binding参照11→7。root未使用bindingは0。構文588ファイル・全単体1,786件・関連単体8件が成功（exit 0）。追加1件は旧組立てとの三経路の全結果と呼出し順、対象Object／sessionの共有、現在scope切替、対象／sessionなし、preview例外で後続finalを実行しないことを確認する。旧f6caae7のappと現在module群の実ブラウザ比較でもAPI全204名の順序と三経路の結果・model・historyが一致した（保存時刻savedAtと実測elapsedMsだけ除外）。診断は一時directoryのcad-drag-execution-equivalence.cjs／.log。関連E2E181件が全成功（18.4分、exit 0）。変更した三つの公開drag入口を使う既存六file（adversarial-drag-fixture／constraint-drag-regressions／blocks／drag-smoothness／geometry-drag-smoothness／unified-ui）と性能file全12件を実行した。拘束drag回帰fileは12.4分、航空機は7.4分・1,872preview、Offset10,296／Fillet3,744／連成線5,304previewはいずれも失敗0。航空機の最大previewは275.2ms。性能fileのpan137ms（175ms未満）／空白矩形217ms（250ms未満）と区別し、航空機の全previewが250ms未満とは扱わない。基準の変更や成功までの再実行はしていない。runner終了と専用server停止を確認済み。ログは一時directoryのcad-drag-execution-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。

mainは5ee5f3fで保留し、現行コードの全E2Eは未実行、c3a213cの全E2E584成功は過去の基準として保持する。開始時週枠使用26%／残量74%で停止条件未到達。mode・通常機能の構築・残るtest支援の整理と200〜500行の全体目標は未完了。小関数の移動やtest専用部の削減だけで到達できるとは見積もらない。

次はSketch TreeのObjects／View／Controllerの生成と既存owner共有を確認する。appにはcategory→可視性対象kindの分類、Context menuの組立て、Point固定解除の操作も残る。Block表示用dimensionPresentationScopeと編集用editingScopeBinding.currentの違い、View生成時のlistener登録、後段Controller／Context menuへの遅延参照、hover／選択／構造guardを維持する。多数のcallbackを新contextへまとめるだけの案は採用せず、各照会・操作ownerへ寄せられる境界から整理する。この候補は未実装で、開始前に現行コード／仕様／テストを確認する。

### 最新のProperties表示owner共有／Geometry ID変換単位

基準はdevelop cb17f56。PropertiesDisplay.createWithControllerでParameterNamespaceの式入力／寸法式、ConstraintFeedbackの拘束名／badge、ApplicationSettingsの翻訳／localize、BlockPlacementCommandの回転lock／Sketch指定を共有した。従来の個別引数を優先しundefinedだけ同じ関数で補完する。receiverをbindし直さず、式評価・配置state・設定更新の所有は元のownerに残す。選択→編集／AppearanceUI→表示の生成段階、各scope／operation readerとstart時機を維持する。

Properties以外の保存・Tree等にも使われるObject→ID／key変換は表示層へ移さず、既存GeometryObjectsへ集約した。同じGeometryRefと型判定、投影Hatchのslash→@正規化、無効ID=null／key=空文字、例外の伝播を維持する。appの同名入口は同じ純粋関数のaliasになり、初回参照より前に確立する。新file・state・汎用contextはない。不要なconstraintStatusBadgeのroot aliasを削除した。

app.jsは2,973→2,964行（9行減）。対象表示構築の引数49→45、引数内の異なるroot binding参照46→43。Geometry ID／keyは二つの実装をrootから既存のdomain ownerへ移したもので、表示callbackを単に一つのObjectへ包んだ変更とは区別する。

構文588ファイル・全単体1,785件・関連単体16件が成功（exit 0）。追加2件で、共通Geometry ID／型付きkey・投影Hatchの元ID不変・無効対象と例外、共有owner／従来指定の寸法markup・localize・配置lock／Sketch操作とhint／drawの同等性を確認した。旧cb17f56のappと現在のmodule群を使う実ブラウザ比較で、初期／複数選択／bulk編集／Document既定値／Palette使用色と確定後のHTML・model・historyが一致した（savedAtだけ比較対象外）。診断は一時directoryのcad-properties-owner-equivalence.cjs／.log。

関連E2E306件が全成功（5.2分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／sketch-permissions／sketch-projection／unified-annotations／leader-appearance／multiple-dimensions／hatching／parameter-dialog-controller／spline／derived-selection-copy／selection-zoom-shadow／adversarial-authoring-performanceを実行した。Propertiesの式・外観・配置操作、Block／投影・派生・Hatch／Splineの参照、権限・選択／Tree、履歴・保存再読込と既存画面比較を確認した。性能全12件を含み、pan144ms（175ms未満）、空白矩形199ms（250ms未満）。基準を変更せず、runner終了と専用server停止を確認した。ログは一時directoryのcad-properties-owner-{focused,check,unit,related}.log。root未使用bindingは0。この単位をCommit／Pushしdevelopへ統合する。

次はPropertiesに残るBlock操作／寸法確定actionと既存commandの所有境界を調べ、同じownerの限定APIとして接続できるか確認する。callback一覧を移すだけのfactoryや単なる行詰めは行わない。mode・他の通常構築群・test支援も未完了であり、200〜500行の目標を維持する。mainは5ee5f3fで保留、現行コードの全E2Eは未実行、c3a213cの全E2E584成功は過去の基準として保持する。開始時週枠使用26%／残量74%で停止条件には未到達。

### 最新のInstance参照元編集開始単位

appのstartInstanceSourceEditの判定と開始調整を、既存InstanceSourceCommand.startForInstanceへ集約した。placementがfalsyなら従来startへ委譲し、同一Objectのmodel所属とactive Sketch確認・従来sessionを維持する。placementがtruthyなら、所属Sketchと現在activeの比較→構造編集guard→既存GeometryInstanceCommand.startEdit(instance,"sources")という順に元Objectを渡す。未登録の配置draftに新たなmodel所属条件を加えず、guard拒否前の取消／Selection解除／session変更や履歴を追加しない。戻り値・receiver・例外と部分状態も保持する。従来startとfinish等は独立APIとして残す。

InstanceSourceCommandの生成へ、先に生成済みのgeometryInstanceCommandとguardSketchEditの二つの限定依存を追加した。PropertiesControllerへは新しい開始操作だけを渡し、appの条件分岐とstartProjectionSourceEdit aliasを撤去した。従来source候補はInstanceSourceCommand、配置draftはGeometryInstanceCommandが所有し、mode／model／Selection等の新stateはない。生成時のqueryや順序変更はない。app.jsは2,978→2,973行（5行減）、root未使用bindingは0。仕様書と実装mapを更新した。

構文588ファイル・全単体1,783件・関連単体13件が成功（exit 0）。追加2件は従来startの所属確認・session・取消、現在activeとguardの短絡／拒否時のmodel・mode無変更、元Instanceと未登録draftの同一参照、配置actorのreceiver・sources引数・戻り値、例外伝播を確認する。旧7532202の実app関数と新入口を、placement有無×active Sketch×guard結果×model所属×通常／guard例外／start例外の48ケースで比較し、呼出し順・session・結果と例外・providerの部分状態が一致した。診断は一時directoryのcad-instance-source-start-equivalence.cjs／.log。

関連E2E266件が全成功（4.5分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／sketch-permissions／sketch-projection／derived-patterns／command-panel／derived-selection-copy／hatching／adversarial-authoring-performanceを実行した。Propertiesからの参照元指定、配置有無の編集・取消と確定、Mirror／Pattern・投影・派生鎖、Root／Sketch権限、既存画面比較・履歴・保存再読込を確認した。性能file全12件を含み、pan139ms（175ms未満）、空白矩形217ms（250ms未満）だった。全runner終了と専用server停止を確認した。ログは一時directoryのcad-instance-source-start-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。mainは5ee5f3fのまま保留、現在コードの全E2Eは未実行、全体目標は未完了。c3a213cでの全E2E584成功は過去の基準として保持する。開始時の週枠使用24%・残量76%で停止条件未到達。

次はPropertiesDisplay.createWithControllerの表示情報と残るactionについて元のownerを確認する。ParameterNamespaceの式表示・ConstraintFeedbackのラベル／badge・BlockPlacementCommandの設定操作など、既存ownerを固定fieldとして使ってroot callbackを減らせるか検討する。constraintGeometryIdはGeometryRef／GeometryObjectsからの純粋な変換であり、rootに残る理由と配置を確認する。操作開始の条件／guardをUIの単なるaliasへ戻さず、各commandの責務とPropertiesの三段階構築・各scopeを維持する。mode／他の通常構築群／test支援も未完了で、200〜500行の目標は維持する。


### 最新のProperties編集／AppearanceUI組立て単位

PropertiesDisplay.createEditingへPropertyEditingFeature→AppearanceUIの生成と共有APIの接続を集約した。Checkpoint・ParameterStabilization・SketchContext・readServices・ApplicationSettings等の既存ownerと限定callback、計23個の依存から各子へ必要な入口を渡す。Checkpointの元のcaptureValues／restoreValuesを使い、Parameter安定化とLeader外観は元のreceiver・引数で呼ぶ。可視性の照会は同じPropertySelectionへ委譲し、query／編集・復元・commit・Palette stateは既存ownerに残す。

編集のcurrentScopeと、使用色を読むappearanceScopeを明示して別々に渡す。Document既定値は固定Document ownerの最新fieldを使い、同じAppearanceEditing／Controls／PaletteをPropertiesとDocument設定で共有する。編集command群→Controls→Paletteという生成順とappearanceUI.startの時機・Document設定→Palette bind順は維持する。appの早期Annotation callback等が読むappearanceEditing aliasはhelper直後に確立し、内部UI構築では生成済みeditingの同じAPIを直接使う。生成時にDOM／scope／query／通知callbackやstartを呼ばないことを単体と実起動で確認した。新file・汎用context・stateはない。不要になったrootのLeader外観委譲と二つのAPI aliasを除去した。

対象構築は2呼出し→1、canonical引数38→23、引数内の異なるroot binding参照30→22。app.jsは2,984→2,978行（6行減）、root未使用bindingは0。前の共通reader単位の前（aa596a9）と同じ条件でPropertiesの全構築を比較すると、4呼出し・119引数・90 root参照から、3呼出し・78引数・60 root参照になった。これは個別引数の広いconfig移動ではなく、既存のquery／編集ownerと生成段階を使った結線整理である。仕様書と実装mapを更新した。

構文588ファイル・全単体1,781件・関連単体16件が成功（exit 0）。追加1件は実編集／UI部品を使い、生成時の無照会・無bind、求解失敗時のCheckpoint復元と履歴なし、成功時の確定、ParameterStabilizationのreceiver、編集scopeとPalette scopeの分離、同じPaletteの登録順と色確定、Documentの置換済み既定値／現在viewportの表示scaleを確認する。既存の独立factoryの検証も維持した。旧b5aff45との実ブラウザ比較で初期Properties／複数選択／bulk編集／Document既定値／Palette使用色と確定後のHTML・model・historyが一致した（savedAtだけを比較対象外）。診断は一時directoryのcad-properties-editing-equivalence.cjs／.log。

関連E2E293件が全成功（5.0分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／sketch-permissions／sketch-projection／unified-annotations／leader-appearance／multiple-dimensions／hatching／parameter-dialog-controller／spline／adversarial-authoring-performanceを実行した。単独／複数Properties、PaletteとDocument既定値・継承外観、Spline編集、寸法／注記・Block／Instance・Hatch、lock／権限、式とParameter、既存画面比較・履歴・保存再読込を確認した。性能file全12件を含み、pan142ms（175ms未満）、空白矩形215ms（250ms未満）だった。全runner終了と専用server停止を確認した。ログは一時directoryのcad-properties-editing-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。mainは5ee5f3fのまま保留、現在コードの全E2Eは未実行、全体目標は未完了。c3a213cでの全E2E584成功は過去の基準として保持する。開始時の週枠使用23%・残量77%で停止条件未到達。

次はPropertiesDisplay.createWithControllerに残るconstraint表示情報・Parameter式・編集action等の元ownerを確認し、読取りと操作を分けて同じ既存ownerを共有できるか検討する。今回の選択→編集／AppearanceUI→表示という三段階を維持し、各scope／operationとPaletteの共有・startを混同しない。単なるraw callback集合の包装やapp context化を避け、Propertiesの構築境界をさらに狭める。modeの所有・他の通常構築群・test支援も未完了であり、200〜500行の目標は維持する。


### 最新のProperties共通reader構築単位

通常機能のProperties選択queryと表示へ、同じ既存GeometryReadServices／SketchContextを共有した。PropertiesDisplay.createSelectionはCanvasSelection・getOperation・Document・readServices・SketchContext・Hatch外観の六つから、既存PropertySelection.createへ必要な個別依存を渡す。queryの対象優先順位・混在値・参照・可視性／lock等の実装はediting層のPropertySelectionに残し、application層が型・正規化・read ownerとの結線だけを所有する。外観は元のreceiverと引数を維持するadapterを使い、静的namespaceの型／正規化／寸法種別queryも元の値を使う。

GeometryReadServicesの生成結果を名前付きで保持し、直後に従来の各ownerへdestructureする。新規生成・state／cacheのcopyや初期化位置の変更はない。PropertiesDisplay.createWithControllerにもreadServices／SketchContextの任意指定を追加し、従来の個別指定を優先、undefinedのfieldだけを補う。両getOperationの形と読取時機、AppearanceUIのeditingScopeBinding.currentと他のWorkspace current reader、編集action・Controller／PaletteとDOMの生成順は変えない。新file・汎用app contextはなく、rootの不要なnormalizeAnnotationStyle／resolveGeometryAppearance aliasを除去した。

対象二構築のcanonical引数合計81→55、引数内の異なるroot binding参照71→47。app.jsは2,990→2,984行（6行減）。行数差よりも、共有ownerと結線の所有・24個の個別root依存削減を評価する。root未使用bindingは0。仕様書と実装mapを更新した。

構文588ファイル・全単体1,780件・関連単体20件が成功（exit 0）。追加2件は共有reader／従来構成の実markup・混在値・所属表示とモデル無変更、現在operation・lockと編集routeの同等性、生成時の無照会、Geometry／Annotation／Dimension外観のreceiver・引数・例外境界を確認する。fixtureのDOM模擬は既存Viewの所属表示を扱えるよう補完した。旧aa596a9との実ブラウザ比較では、初期／同種複数／異種複数／固定対象／Geometry／BlockのProperties HTMLと保存値が一致した（savedAtだけを比較対象外）。診断は一時directoryのcad-properties-scene-equivalence.cjs／.log。

関連E2E287件が全成功（5.0分、exit 0）。unified-ui／phase0-characterization／blocks／free-instance／sketch-permissions／sketch-projection／unified-annotations／leader-appearance／multiple-dimensions／hatching／parameter-dialog-controller／adversarial-authoring-performanceを実行した。単独／複数Properties、既定値と継承外観、Geometry・寸法・注記・Block／Instance・Hatch、lock／権限、式とParameter、既存画面比較・履歴・保存再読込を確認した。性能file全12件を含み、pan141ms（175ms未満）、空白矩形217ms（250ms未満）だった。全runner終了と専用server停止を確認した。ログは一時directoryのcad-properties-scene-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。mainは5ee5f3fのまま保留、現在コードの全E2Eは未実行、全体目標は未完了。c3a213cの全E2E584成功は過去の基準として保持する。開始時の週枠使用21%・残量79%で停止条件未到達。

次はPropertiesの編集側／AppearanceUIと表示Controllerに残る接続を、既存のcommand・query ownerで整理する。今回共有したreadServices／SketchContextを起点にし、constraint表示情報・Parameter式・編集action等の元ownerを確認する。広い引数をそのまま一つのconfigへ移さず、役割ごとのread／edit能力を明示して、Propertiesの生成・接続をまとまった境界へ近づける。各getOperation／scope・遅延callback・startの違いは維持する。modeの所有・他の通常機能の構築・test支援も未完了で、200〜500行の目標を縮小しない。


### 最新のClipboardテスト支援組立て単位

既存ClipboardTestDriver.createSupportへ観測→Geometry fixture→Block fixtureの生成と三つの公開API名の接続を集約した。ClipboardSession・CanvasSelection・現在scope・履歴、既存GeometryCreation／SketchContextと型namespace等24個の限定依存を受ける。両fixtureのreadStateは同じ観測関数を参照し、session／Selection／モデル／履歴・採番の新たなcopyを持たない。コピー／貼付け本体、commit／rollbackとID発行の時機は既存command／fixtureに残す。従来の個別factoryも維持する。

元factoryは関数宣言と不変APIの生成だけで、同じ位置・生成順で組み立てる。生成時に全callbackとviewport／Selection／ClipboardSessionの読取りを拒否する一時VM診断で無照会を確認し、childの順と両readStateが公開clipboardStateForTestと同じ関数であることも確認した。rootの不要になったPointVerticalConstraint／EqualRadiusConstraint aliasを除去した。対象factory呼出し3→1、引数内の異なるroot binding参照35→21。app.jsは3,004→2,990行（14行減）。新file・汎用context・stateはない。仕様書と実装mapを更新した。

構文588ファイル・全単体1,778件・関連単体29件が成功（exit 0）。関連単体はClipboard command／session／transfer／graph／paste checkpoint。今回は既存fixtureの組立てだけを扱い、同じ実装名を固定するtestは追加していない。型alias削除後のapp個別syntaxも確認した。旧079c1d9と実ブラウザで比較し、公開API全204名の順序、初期Clipboard観測、Geometry／Block fixtureの結果と再観測、Selection・履歴・保存値、BlockからGeometryへの再初期化が一致した（savedAtだけを比較対象外）。診断は一時directoryのcad-clipboard-support-equivalence.cjs／.log。

関連E2E274件が全成功（4.6分、exit 0）。unified-ui／phase0-characterization／derived-selection-copy／blocks／free-instance／sketch-permissions／sketch-projection／unified-annotations／hatching／spline／adversarial-authoring-performanceを実行した。通常Geometry・Block／派生／投影・Hatch／Splineと拘束のコピー／貼付け、Sketch権限、履歴と保存再読込、既存画面比較を確認した。性能file全12件を含み、pan149ms（175ms未満）、空白矩形216ms（250ms未満）だった。全runner終了と専用server停止を確認した。ログは一時directoryのcad-clipboard-support-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。mainは5ee5f3fのまま保留、現在コードの全E2Eは未実行、全体目標は未完了。c3a213cでの全E2E584成功はその時点の基準として保持する。開始時の週枠使用20%・残量80%で停止条件未到達。

次は通常機能のProperties／Appearanceの構築・接続へ戻る。appにはPropertySelection、PropertyEditingFeature、AppearanceUI、PropertiesDisplay.createWithControllerの連続した構築が残る。まず既存SketchContext／GeometryReadServices／外観／Selection等のowner APIを使い、rootの個別callbackを減らせるか確認する。広い引数Objectをそのまま別fileへ包まない。PropertySelection用と表示用のgetOperationは異なるfieldを返し、AppearanceUIのeditingScopeBinding.current readerと他のWorkspace current readerも同一視しない。各ownerの副作用・生成順・遅延callbackを確認してから機能単位の組立てへ進む。test支援の残り、modeの所有とbind／startも未完了であり、200〜500行の目標は維持する。


### 最新のCanvas表示テスト支援組立て単位

CanvasTestDriver.createDisplaySupportへ表示・座標・hit／snap・fit fixtureの11 factoryの生成と既存12個のテストAPI名の接続を集約した。既存viewportとGeometryCreationを共有し、readUnits・現在scope・fit／bounds・hit・snap等の19個の限定依存から各子へ必要な入口だけを渡す。focus／clientPositionは同じ元関数を他driverと公開APIへ共有する。作図sessionを読むAuthoringObservationと表示切替のViewObservationはこの表示支援に混ぜず、従来どおり別に生成する。新file・state・cache・app contextはない。

元の個別factoryは関数宣言とObject.freeze APIの返却のみで、生成時にmodel／DOM／Canvas／viewportを読まないことを確認した。test guard内の最初のfit支援の位置で同じ11支援をまとめて生成し、fixtureやquery・resize／drawは実行しない。Viewportの五つの関数とGeometry生成の二つの関数は元の非bind値を共有する。不要になったrootのcurrentCanvasCenterWorld／formatZoom／screenBoxForBounds aliasも除去した。app内の対象factory呼出し11→1、引数内の異なるroot binding参照29→23。app.jsは3,026→3,004行（22行減）。仕様書と実装mapを更新した。

構文588ファイル・全単体1,778件・関連単体8件が成功（exit 0）。追加2件は実CanvasViewportと共有geometryを使い、生成時の無照会、focus／clientPositionの関数同一性、現在scope差替え・unitsのcopyとviewport更新、描画失敗時の部分state、fit既定値とall／middle／fixed-point fixtureの元の呼出し順を確認する。root alias削除後もappの個別syntaxを確認済み。

旧361d890のappと現在appを同じmodule群で実ブラウザ比較し、テストAPI全204名の集合、初期保存値、zoom／focus／world-client／Geometry位置、all fit／middle fit／固定点の結果と各fixtureの保存値が一致した（savedAtだけを比較対象外とした）。通常起動でテストAPIがないことと両起動の例外なしも確認した。診断は一時directoryのcad-canvas-display-support-equivalence.cjs／.log。公開名・引数・戻り値は維持し、publicAPIは表示familyとして接続する。関連E2E225件が全成功（3.8分、exit 0）。unified-ui／phase0-characterization／free-instance／hatching／sketch-projection／png-export／reference-images／view-visibility／selection-zoom-shadow／annotation-display-size／multiple-dimensions／adversarial-authoring-performanceを実行した。表示倍率・全体／中button fit・座標／実hit・選択表示・画像／注記・投影とInstance・Hatch・権限・履歴・保存再読込を確認した。性能file全12件を含み、pan142ms（175ms未満）、空白矩形216ms（250ms未満）だった。全runner終了と専用server停止を確認した。ログは一時directoryのcad-canvas-display-support-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。前単位c3a213cの全E2E584成功を現在コードの全体成功とは扱わない。mainは5ee5f3fのまま保留し、全体目標は未完了。開始時の週枠使用20%・残量80%で停止条件未到達。

次はtest hooksの残るfamilyの構築と公開境界を確認する。表示支援と同様に、既存owner・現在scope・読取りと操作を共有できる実際のまとまりを選び、104 bindingを渡す単一contextや、細かい委譲factoryの乱立にしない。modeの所有・通常機能の構築群・bind／start段階も未完了のままであり、test支援の整理だけで200〜500行の目標を達成したとは扱わない。


### 最新のCanvas command終了判定単位

command panelの空白判定を、同じpress／参照／Hatch照会を持つ既存CanvasHitInteraction.createInteractionへ集約した。blankCanvasGesture・instanceSourceCommand・hatchCommandの三つの既存ownerを追加指定すると、press／hoverとともにisBlankCommandPanelPointを返す。press snapshot→blankAnnotationHitによるblank判定→投影参照除外→Hatch face除外の順と短絡、元参照、owner receiver、現在mode／source／includeConstructionと例外を維持する。pressやscene queryを再生成せず、新しいhover／model／gesture stateを持たない。追加owner未指定時の従来APIはpress／hoverのまま。

作図tool modeの分類は既存DrawOperationLifecycle.isToolModeへ集約した。内部modeやdraftを持たない純粋なqueryで、進行中の下書き有無を読むactiveとは異なる。appのhoisted wrapperは生成前の早期callbackからも使われるため、Lifecycleインスタンスへ依存させず、現在modeをstatic queryへ渡す。元のapp関数を実行した25種類の値で分類が一致し、未知値の文字列変換も行わない。Canvasの空白判定bindingは生成2,349行目、参照2,380行目で、前方参照なし。rootの未使用bindingは0。app.jsは3,037→3,026行（11行減）。新file／script・汎用app context・state containerはない。仕様と実装mapを更新した。

構文588ファイル・全単体1,776件・関連単体29件が成功（exit 0）。追加4件は生成時の無照会、実press snapshotと注記のblank除外、元のsource点参照・現在投影typeとquery短絡、Hatchの現在optionとreceiver、例外時のhover無変更、初期化前のtool分類とdraft有無の区別を確認する。関連E2E230件が全成功（4.0分、exit 0）。unified-ui／phase0-characterization／command-panel／sketch-projection／free-instance／hatching／spline／circular-authoring／png-export／adversarial-authoring-performance／unified-annotationsを実行した。panelの空白double click取消と通常配置／source指定の継続、Hatch／修復・作図／Splineの終了、PNG出力の取消・retry、権限・履歴・保存再読込を確認した。性能file全12件を含み、pan141ms（175ms未満）、空白矩形203ms（250ms未満）だった。全runner終了と専用server停止を確認した。ログは一時directoryのcad-command-canvas-{focused,check,unit,related}.log。この単位をCommit／Pushしdevelopへ統合する。前単位c3a213cの全E2E584成功を、今回コードの全E2E成功へ読み替えない。mainは5ee5f3fのまま保留し、全体目標は未完了。開始時の週枠使用19%・残量81%で停止条件未到達。

次は構築・接続の中心を扱う。test API公開Objectは現時点で142 property（うちspread12）、参照するbinding104、inline method5だった。単一の104引数のcontextへ移す案は採らず、既存test driverのfamilyごとに共通ownerと構築を集められるか確認する。Canvas／viewportの支援群など、既存owner・生成順・query／操作の契約を持つまとまった単位を選ぶ。rootのmodeそのものの所有とbind／start段階も引き続き未完了であり、小さなquery移管だけで200〜500行へ届いたとは扱わない。


### 最新の旧root接続整理単位

既存ownerへ移管済みで参照のなくなったローカルalias・委譲関数を整理した。ASTのroot binding参照から65個の未使用分割代入と4個の委譲関数を確認し、委譲の撤去後に不要になるannotationColorも除去した。計70 bindingを除去し、rootの未使用bindingは0。Selection・Sketch／Block／Instance・Parameter・Solver照会・snap／rollback・寸法描画・注記／画像・保存読込の機能APIとowner生成は維持する。共有ownerから直接使う経路とtest hooksの公開は残す。新しい責務分離として水増しせず、これまでの移管で残った接続の整理として扱う。

変更前244db06の実ブラウザ起動へ読取り監査を挿入し、31箇所で削除対象65プロパティが全て存在するdata descriptorであり、getterではないことを確認した。追加のannotationColorはAnnotationDisplayのObject.freeze({color,renderer,layer})を確認した。削除した分割代入の右辺は既存owner参照だけで、factory呼出しの削除はない。4委譲は未参照の関数宣言で、呼出しも生成時処理もない。変更前ASTからこの70 bindingだけを除いた結果と変更後ASTが一致した（位置・comment・raw表記metadataを除外）。実ブラウザ起動後も例外がなく、test APIの全204 keyが変更前と同じ順序で一致した。診断は一時directoryのcad-retired-root-{audit,post-audit,ast}.cjsとaudit／post-audit.json。app.jsは3,055→3,037行（18行減）。仕様書と実装mapには現在のroot接続方針を追記した。

構文588ファイル・全単体1,772件・全E2E584件が成功（全runner exit 0、全E2E24.3分）。機能を変えず未参照接続だけを除去したため、実装名を固定する新testは追加しない。性能file全12件を含み、pan142ms（基準175ms未満）、空白矩形233ms（250ms未満）だった。長時間の拘束drag回帰も全成功し、fillet3,744・Offset10,296・航空機円弧1,872 previewを確認した。航空機caseは7.4分、拘束drag file全体は12.5分。省略・filter・timeout／期待値／閾値変更や成功までの再実行はない。全runner終了と専用server停止を確認した。ログは一時directoryのcad-retired-root-{check,unit,e2e}.log。最新全E2E未確認という状態は解消したが、過去の性能ばらつきが根本解消したと断定しない。mainは5ee5f3fのまま保留の合意を維持し、この単位をCommit／Pushしてdevelopへ統合する。全体目標は未完了。終了時の週枠使用19%・残量81%で、50%未満の停止条件には達していない。

次は既存ownerによる構築・接続・起動の境界へ戻る。入力終了判断では、appのisBlankCommandPanelPointがpress snapshot→blank gesture→投影参照除外→Hatch face除外を実装している。既存CanvasHitInteraction.createInteractionは同じpressとscene queryを生成済みで、createSceneはreadMode／hatchesも保持しているため、この既存ownerに判定を集められるか確認する。isDrawToolModeの分類も既存DrawOperationLifecycleの現在mode queryと照合する。いずれも未実装候補であり、例外／短絡・live state・投影／Hatchの配置と空白double click取消を変えない。今回の未使用alias整理だけで数百行の目標へ届いたとは扱わず、残るfactory群・test公開・mode更新のまとまった境界も引き続き検討する。単純な関数移動や汎用contextへの包装、細かいwrapperの追加を避ける。


### 最新のConstraint入力組立て単位

既存ConstraintCommandInput.createFeatureへ寸法継続と通常拘束入力の共通owner接続を集約した。六つの限定依存からdimensionを先に作り、既存DimensionDragFeatureの生成後にcreateInputで通常入力を作る。CanvasCommandInputs内のAnnotation→Constraint→Instance→Point→Drawing→Selectionという生成順を維持する。共有するのは既存session／commandとdragのbegin／selectedLineGroupであり、新たな可変context・state・cache・model・fileはない。Placement／Constraint commandのreceiver、pending.readとdrag関数の非bind呼出し、現在stateの読取り、入力優先順・例外伝播を維持し、従来の個別callback構築も残す。

appの不要になったretarget委譲関数を除去し、DimensionDragFeatureの生成結果を名前で保持した。CanvasCommandInputsへのcanonical構築引数55→52、引数内root参照54→51。app.jsは3,055→3,055行（0行差）。行数を削るための整形は行わず、共有ownerと二段階構築の境界を明示した。ASTで新bindingの生成2,236／2,240行目に対し参照が2,243／2,248／2,358行目以降であり、新たな未使用bindingがないことを確認した。正式仕様と実装mapを更新した。

構文588ファイル・全単体1,772件・関連単体23件が成功（exit 0）。追加3件は二段階生成時の無照会、共通sessionのlive state、retarget優先と値入力、拘束operandと元参照、group選択維持と非group解除、drag関数の非bind、例外伝播、数値入力中のclick消費、実子factoryの生成順とlegacy callback未使用を確認する。

関連E2E183件が全成功（3.4分、exit 0）。unified-ui／phase0-characterization／multiple-dimensions／slot-dimension／dimension-prefix／sketch-permissions／command-panel／unified-annotations／adversarial-authoring-performanceを実行し、性能file全12件、寸法／拘束入力・group drag・式／prefix・read-only・Root／Sketch権限、既存画面比較・履歴・保存再読込を確認した。pan158ms（175ms未満）、空白矩形218ms（250ms未満）だった。過去の線選択157／158msやpan超過の失敗を今回の成功で置き換えず、全性能問題の解消や最新全E2E成功とは扱わない。全runner終了と専用server終了を回収済み。ログは一時directoryのcad-constraint-feature-{focused,check,unit,related}.log。mainは5ee5f3fのまま保留、最新全E2Eは未実行、全体目標は未完了。週枠使用15%・残量85%を確認した。この単位をCommit／Pushしdevelopへ統合する。

次はCanvasの入力構築に残る共有Selection／drag／command ownerと、app全体の構築・起動段階を再確認する。小さなalias置換だけを反復せず、既存owner単位の組立てと操作開始／終了の境界を選ぶ。未使用bindingも実際の参照と公開境界を確認し、不要なroot接続を残さない。main反映には未解決の性能問題と最新全E2Eの確認が残る。


### 最新の寸法入力継続単位

appのDimensionDrag用continueCommandClickとisDimensionConstraintCommandActiveを既存ConstraintCommandInput.createDimensionContinuationへ集約した。六つの限定依存（CanvasHover／canvasPoint／pending session／constraint target session／DimensionPlacementCommand／ConstraintTargetCommand）からisActiveとcontinueClickだけを返す。有効判定はtarget→pendingの短絡を維持し、継続clickはhover解除→座標変換→pending読取り→retargetまたはoperand入力の順を維持する。hitsのundefinedだけを呼出し分岐で新しい空Objectへし、nullは保持する。command ownerのreceiver・戻り値undefined・例外と部分状態も維持する。新たなmode／pending／履歴／modelは持たない。

DimensionDragFeatureには同じ専用commandInput APIを共有し、CanvasCommandInputsには必要なisActive一関数を渡す。従来のFeatureの個別callback指定も維持する。新APIはPlacement／Constraint commandの後・DimensionDragの前（app 2,237行目）で生成し、全参照2,244／2,358行目に前方参照がないことをASTで確認した。新たな未使用bindingなし。app.jsは3,063→3,055行（8行減）、今回再開時3,652行から597行減。新file・script・cacheはなく、正式仕様と実装mapを更新した。

構文588・全単体1,769・関連単体20件が成功（exit 0）。追加4件は生成時の無読取り、predicate短絡とlive state、retarget優先・defaults／null・owner receiver、各例外の境界とhover部分状態、既存drag sessionの継続条件と履歴・参照を検証する。変更前appの実際のarrow／predicate／委譲関数を取り出した一時診断で、pending6種×target3種×hits3種×retarget5種と例外6種の276ケースが新APIと一致した。診断scriptは一時directoryのcad-dimension-continuation-equivalence.cjs。

関連E2E183件は182成功・1失敗（4.1分、exit 1）。unified-ui／phase0-characterization／multiple-dimensions／slot-dimension／dimension-prefix／sketch-permissions／command-panel／unified-annotations／adversarial-authoring-performanceを実行した。失敗はselection/line-pointerdown-up 158ms（150ms未満が基準）。変更前08ec689でも同じ線選択157msの失敗を確認しており、pan調査記録に保持する。寸法入力・drag／line group・角度・read-only寸法・式／prefix・優先入力、Root／Sketch権限、既存画面比較・履歴・保存再読込の関連ケースは成功したが、全検証成功とは扱わない。期待値や性能閾値を変えず、成功するまでの反復も行わない。全runner終了と専用server終了を回収済み。ログは一時directoryのcad-dimension-continuation-{focused,check,unit,related}.log。既存性能問題を明記してこの単位をCommit／Pushしdevelopへ統合する。mainは5ee5f3fのまま保留、最新全E2Eは未実行、全体目標は未完了。

次はDimension／Constraint入力の構築で使うDimensionDragFeature・DimensionPlacementCommand・ConstraintTargetCommandの既存APIを確認する。今回取り除いたrootの状態判定／分岐を別のcallback束で再導入せず、各ownerのquery／操作を使って入力familyの構築境界をさらに狭める。個別aliasの移動や巨大contextへの包装だけを目的としない。

### 最新のInstance入力照会共有単位

CanvasCommandInputsへ既存sceneHitQueriesを共有し、operandsの三つの投影／参照関数を元の値でInstanceCommandInputへ渡す。Hatchは構築時のregions ownerを保持し、呼出し時に同じreceiverへx／y／activeOnly:falseを渡す。共有API未指定時は従来の個別query指定を維持する。生成時のquery／model読取り、scopeやGeometryのcopy、query／command生成し直し、新state／cache／file／scriptはない。

operand側は実使用を確認し、親子factory間で受け渡すだけだったmakeConstraintOperand依存を除去した。必要なoperandElement一関数を明示したままにし、operandValues全体を包む案は採用しない。appの未使用Hatch委譲関数と投影二関数aliasも除去した。app.jsは3,064→3,063行（1行減）、今回再開時3,652行から589行減。canonical構築引数59→55、引数内のroot binding参照58→54、新たな未使用bindingなしをASTで確認した。正式仕様と実装mapを更新した。

構文588・全単体1,765・関連単体25件が成功（exit 0）。追加2件は生成時の無照会、derived→Block優先、参照／Source mode切替、元item参照とlive query値、Hatchのowner・options・座標、例外の同一性と無変更、legacy query未使用を確認する。既存の個別query指定の単体も維持している。関連E2E203件も全成功（3.2分、exit 0）。unified-ui／phase0-characterization／sketch-permissions／sketch-projection／free-instance／hatching／command-panel／adversarial-authoring-performanceを実行し、性能file全12件を含む。panは121msで元の175ms未満の基準内、空白矩形は201msで250ms未満だった。権限・投影／Instanceのsource／参照指定、Hatchのsourceとhit・保存再読込、優先入力と既存画面比較も確認した。以前の性能失敗を消したり、全性能問題の解消や全E2E成功へ読み替えたりしない。全runner終了と専用server終了を回収済み。ログは一時directoryのcad-instance-input-queries-{focused,check,unit,related}.log。mainは5ee5f3fのまま保留、最新全E2Eは未実行、全体目標は未完了。

次はCanvas入力familyの残る構築契約を見直す。個別aliasだけを小さく移し続けず、Dimension／Constraint入力など既存ownerの複数APIを共有できる箇所と、controller／bindingの生成段階を確認し、意味のある機能組立てへ収束させる。55入口をそのまま別の巨大contextへ包まない。

### 最新の基本作図入力API共有単位

CanvasCommandInputsが既存BasicDrawingTools.inputのline／rectangle／slot／circle／arc／threePointArcをbasicDrawingInputとして受け、DrawingCommandInputへ元の関数値を渡す。appに保持していた六つの関数aliasを除去し、同じownerのAPIを一度共有する。共有API未指定時は従来の個別callback portを使い、既存呼出しも維持する。lineのpoint・Shift、他の基本作図のpoint引数、receiverを付けない呼出し、Root拒否・入力消費・例外伝播を維持する。snap／Selection／commandの生成し直しや新たなstate・cache・file・scriptはない。

app.jsは3,066→3,064行（2行減）、今回再開時3,652行から588行減。ASTで構築引数64→59、引数内のroot binding参照63→58、新たな未使用bindingなしを確認した。59はcanonical APIを使うappの引数数であり、互換用の個別portを含むfactory全体の受付数ではない。BasicDrawingToolsの生成位置とCanvasCommandInputsの後段生成位置は維持し、遅延scope／snap読取りを元ownerへ残す。正式仕様と実装mapを更新した。

構文588・全単体1,763・専用単体18件が成功（exit 0）。追加2件は共有API優先、全6modeの元引数／receiver・構築時の無呼出し、子routerの関数保持、Root拒否・未対象mode、互換の個別指定、例外同一性と無変更を確認した。変更前後のfactoryを共通portで構築する一時診断で、DrawingCommandInputへ渡す15項目の値と六つの子factoryの生成順が一致した。

関連E2E200件は199成功・1失敗（4.1分、exit 1）。unified-ui／phase0-characterization／sketch-permissions／sketch-projection／free-instance／command-panel／slot-dimension／file-safety／adversarial-authoring-performanceを実行した。失敗は既存のview/middle-button-pan 188ms（175ms未満が基準）。基本作図、優先入力、Root・Sketch権限、投影／Instance、既存画面比較、履歴・保存再読込の関連ケースは成功したが、全検証成功とは扱わない。性能caseの過去の失敗・変更前比較はpan調査記録と以前の単位に保持する。今回の変更は構築時の関数共有だけで、pan／描画・UI更新の実装と操作時の呼出しは追加していない。性能問題を隠す閾値変更や成功するまでの反復は行わない。全runner終了と専用server終了を回収済み。ログは一時directoryのcad-primitive-input-{focused,check,unit,related}.log。

既存性能問題を明記してこの単位をCommit／Pushしdevelopへ統合する。mainは5ee5f3fのまま保留、最新全E2Eは未実行、全体目標は未完了。

次は同じCanvasCommandInputsでscene query／operand ownerの再利用を検討する。既存sceneHitQueriesのprojection／reference／Hatch照会とconstraintOperandValuesの変換APIを、役割のあるownerとして共有できるか確認する。呼出し時のscope・options・receiverを維持し、単なる汎用app context化や未使用wrapper追加を行わない。

### 最新のpan CPU／描画順照会調査単位（製品変更なし）

pan frameのCPU samplingでSketchの外観正規化とensureの反復を確認し、GeometryPresentation.createSketchStyle.drawOrderBySketchのsort comparatorを調べた。同じObjectのactive照会を一回の呼出し内で共有するMap案を試したが、性能改善を示せず不採用とした。製品にMapや照会契約の変更を追加していない。

08ec689との交互固定3回の診断で、106点×5sortのactive照会は各回1,050→530、sort／Canvas描画は5、通常preview4、Geometry reader21のままだった。Canvas PNG、authoring state、serialized model（savedAtのみ除外）は一致。しかしwallに改善は確認できず、candidateの関連E2E238件は237成功・1失敗（空白矩形252ms、基準250ms未満）。固定3回の既存性能caseは変更前2成功・1失敗（線選択157ms、空白矩形は成功時249ms）、候補3失敗（空白矩形251ms／pan182ms／空白矩形283ms）だった。cacheを追加する複雑さに見合う効果を示せないため撤回した。[調査記録](pan-latency-investigation.md)に全結果と退避先を保持し、成功結果だけを採用しない。

候補の構文588・単体1,763・関連単体40件は成功したが、採用していない。Map実装・追加単体・正式仕様／実装mapを08ec689へ戻し、app／src／tests／spec／index／tools／package／Playwright設定の差分なしを確認した。app.jsは3,066→3,066行（0行差）、確定変更は文書3fileのみ。現在の製品は前単位で構文588・単体1,761・関連E2E233成功を確認したcodeと同じ。今回の文書修正で製品テストの再実行は行わない。

次はCanvasCommandInputsで既存BasicDrawingTools.inputの共有を検討し、rootに列挙する同じownerのcallback依存を狭める。生成順・receiver・既存routerの呼出し契約・互換APIを先に確認し、汎用app contextへ包まない。mainは5ee5f3fのまま保留し、最新全E2Eは未実行、全体目標は未完了。

### 最新のTree hover描画責務とpan調査単位

pan計測中にTreeを離れる経路で、SelectionHighlightの即時描画→Tree pointerOutの描画→空になったleaveの描画が重複していた。[調査記録](pan-latency-investigation.md)に3版比較と呼出しstack・計測方法を記録した。SelectionHighlightは状態所有と既定の即時描画を維持し、redraw:falseとclearの変更有無を使ってTreeControllerが同じイベントの更新後に一度描画する。no-op leaveは描画しない。object exit／leaveの解除範囲、別の寸法hoverの保護、通常frame描画・scope・選択・Document・保存形式を維持する。

app.jsは3,066→3,066行（0行差）。実装は既存SelectionHighlight／SketchTreeController内だけで、rootや新たな可変contextに処理を増やさない。正式仕様と実装mapを更新した。追加単体4件を含む全単体1,761件・構文588ファイル・専用12件が成功（exit 0）。関連E2E233件も全成功（4.7分、exit 0）。unified-ui／phase0-characterization／sketch-permissions／sketch-projection／free-instance／unified-annotations／hatching／reference-images／multiple-dimensions／adversarial-authoring-performanceを実行し、性能file全12件を含む。panは165msで元の175ms未満の基準内。Tree連携・ロック／非表示・既存画面比較・注記／寸法／Hatch／画像・Instance／投影・保存再読込を確認した。全runner終了と専用serverの終了を回収済み。ログはcad-pan-fix-{focused,check,unit,related}.log。

修正後3回ともCanvas描画は7→5、通常preview／drawは4、Geometry reader呼出しは21のまま。操作全体wallには146.5／222.8／161.5msのばらつきがあり、重複描画の是正を全性能問題の解消とは扱わない。別の終了後比較ではmain／分離前／修正後のCanvas PNGとauthoring state、serialized model（savedAtのみ除外）が完全一致した。mainは5ee5f3fのまま保留、最新全E2Eは未実行、全体目標は未完了。

### 最新のscene query共有単位

sceneHitQueries.createInteractionで構築済みのGeometry／region／dimension／instance／operand queryからpress／hoverを接続する。appの接続に列挙するroot binding参照は25→4（canvasHover、sameArcEndpoint、hitBlockRotationHandle、hitAnnotationTarget）となり、sceneHitQueries自体の依存は別に保持する。新たな大contextを渡すのではなく、既に構築したqueryを同じowner内で共有する。後段の接続位置、既存createのreader直接指定API、注記interactionとpress／hoverの優先順、receiver・遅延読取り・例外伝播を維持する。scope policy／query／hoverの生成し直し、新state／cache／fileはない。不要になったhitGeometryInstance／hitDerivedGeometryForDragのroot委譲二関数を除去した。app.jsは3,072→3,066行（6行減）、今回再開時3,652行から586行減。

正式仕様と実装mapを更新した。構文588ファイル・全単体1,757件・専用単体10件が成功（exit 0）。新単体2件は後段生成の無読取り、同じGeometry参照・scope／可視性変更をpress／hover両方へ反映すること、注記anchor／frame優先・投影除外、外部handle／target callbackの更新、例外時のhover維持を確認した。ASTで引数内のroot参照25→4と新たな未使用bindingなしを確認した。scene owner自体を含めた全依存が4個という意味ではない。

関連E2E233件は232成功・1失敗（4.7分、exit 1）。unified-ui／phase0-characterization／sketch-permissions／sketch-projection／free-instance／unified-annotations／hatching／reference-images／multiple-dimensions／adversarial-authoring-performanceを実行した。失敗は同じ性能caseのview/middle-button-pan 178ms（175ms未満が基準）で、選択・削除・Undo／Redoからpanまで進んだ。既存の変更前比較でもpan超過の履歴があり、直前のscene構築単位の現在版でも199／185msが記録されている。ただし今回の不合格を過去の成功で置き換えず、性能同等や原因解決とは扱わない。期待値・閾値・fixtureは変更していない。全runner終了を回収し、専用serverを終了した。ログは一時directoryのcad-shared-scene-{focused,check,unit,related}.log。

週枠残量93%で開始し停止条件には未到達。mainは5ee5f3fのまま保留し、全体目標は未完了。最新全E2Eは未実行。この共有単位は既存性能問題を明記してCommit／Pushしdevelopへ統合する。次は新しい分離を追加する前に、現在コードのpan処理・描画／UI／hit照会の時間と呼出しを計測し、変更前の同じ経路と比較する。成功するまでの再実行や基準緩和で完了とせず、必要な修正があれば既存仕様内で行う。最終main反映前に最新全体検証を行う。

### 最新のscene hit構築単位

監査案に従い、既存CanvasHitInteraction.createSceneへscope policyとregion／dimension／instance／基本Geometry／operand queryの構築を集約した。早期policyと後段createQueriesの二段階を維持し、25個の限定依存から各子へ必要なAPIを接続する。既存SketchContextを名前付きで保持して共有し、GeometryReadModel／PointUsage／外観／寸法／Hatch／Block ownerを再生成しない。判定処理・cache・選択規則は既存GeometryHitQuery／OperandHitQueryへ残す。Workspace currentと寸法scopeの違い、owner receiver、可変長引数・既定options・後段callback・呼出し時のscale／mode／scope取得と例外伝播を維持した。新file・script・state・保存形式変更はない。

app.jsは3,088→3,072行（16行減）、今回再開時3,652行から580行減。新しいowner参照の宣言前利用はなく、依存25個をASTで確認した。未使用になったreferenceSourceSketchIds／dimensionTextDrawingMetrics／dimensionTextWidthとoperandFromReferenceTargetのroot aliasを除去し、新たな未使用bindingがないことを確認した。正式仕様はspec/architecture/モジュール構成.mdと実装mapを更新した。

構文588ファイル・単体1,755件が成功（exit 0）。追加単体4件は生成時遅延、mode／pending／command・権限／可視性／scale・scope差替え、別の寸法scopeとreceiver、inactive options／注記引数、Block／derived operandと元Object参照・例外伝播を確認する。既存query単体と合わせた35件も成功。関連E2E233件は232成功・1失敗（4.8分、exit 1）。unified-ui／phase0-characterization／sketch-permissions／sketch-projection／free-instance／unified-annotations／hatching／reference-images／multiple-dimensions／adversarial-authoring-performanceを実行し、線選択154msが150ms未満の基準を超えた。性能fileは11成功・1失敗であり、全成功とは扱わない。後続の未使用alias除去後にapp構文・全単体1,755件・ASTを再検証した。

変更前e3dece3をGit archiveで一時directoryへ展開し、同じ性能test／fixtureで変更前と現在版を交互に固定3回ずつ実行した。変更前は2成功・1失敗（線選択145／133／151ms）。現在版は1成功・2失敗（pan 199／185／173ms、前2回が175ms未満を超過）。変更前にも今回の線選択超過が再現し、panも既存の失敗履歴がある。ただし小標本から性能同等や原因解決とは判断せず、今回だけが原因とも断定しない。成功するまでの再実行や基準変更は行っていない。初回の比較filterは先頭anchorにより対象0件だったため、filterを修正して実際の6件を測定した。比較終了と全runnerのexitを回収し、専用serverを終了した。ログは一時directoryのcad-scene-{check,unit,focused,related,final-unit}.logとcad-scene-compare-v2-{baseline,current}-{1,2,3}.log。製品test／閾値／fixtureを緩めていない。

mainは5ee5f3fのまま保留し、全体目標は未完了。最新全E2Eは未実行。線選択の変更前再現と既存pan超過を明記して、この責務分離単位をCommit／Pushしdevelopへ統合する。次はscene query ownerをpress／hover側へ共有し、rootの重複したreader接続を狭められるか検討する。既存createの利用契約と優先順・hoisted wrapperを保ち、単に大量の依存をObjectで包むだけにしない。最終main反映前には最新コードで全体検証し、性能問題が残れば原因調査を続ける。

### 最新の構築境界再監査（文書のみ）

develop 46dd77dを基準に構築依存を再集計し、[監査記録](bootstrap-boundary-audit.md)へ比較・次の境界案を記録した。現在はapp.js 3,088行、非空白2,595行、構築1,354行、hooks478行、一文call248行。root構築216文、複文callback33個、root let8個。旧63c886c集計は監査記録に比較基準として保持する。今回のapp.jsは3,088→3,088行（0行差）。hooks／一文callを全て除いても1,869非空白行が残るため、小関数の移動だけでは数百行へ届かない。

次の実装候補は既存CanvasHitInteractionへのscene照会組立ての追加。scope policyを早期、region／dimension／instance／基本hit／operand hitを後段に生成する二段階を維持する。6構築30物理行・62root参照をそのまま大引数factoryにせず、既存canonical ownerと限定callbackを使う25依存案を検討した。これは未実装。Workspace scopeと寸法scopeの違い、receiver・毎回の状態読取り・後段callback・同一ownerと生成順を維持する。TreeとPropertiesは各76／90参照と広く、先に契約整理が必要なため後回しとした。

今回は集計再現・合計・factory bodyのAST・製品source差分なし・Markdown参照を検証する。製品テストは再実行せず、直前の構文588／単体1,751／関連E2E187成功と最新全E2E未実行を区別する。正式仕様・実装の変更はない。週枠残量95%で継続可能。mainは5ee5f3fのまま保留し、最終反映前に最新全体検証を行う。全体目標は未完了。

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

### 最新のAnnotation Parameter候補検証単位

AnnotationCommandのvalidateParameter本体を既存ParameterNamespace.validateNewDimensionParameterへ統合した。appは現在modelを明示して依頼し、名前／式／symbols／read-only値／Engine評価の順・一度のsymbol収集・例外・現在言語errorを同じownerで調整する。ensure・採番・target更新を行う通常評価とは別の読取り入口とし、draft／model無変更と有限の0／負数の許可を維持した。確定時のcommitParameterや履歴は変更しない。新file・state・script・保存形式変更はない。app.jsは3,281→3,270行（11行減）、今回の再開から3,652→3,270行（382行減）。

構文578ファイル・単体1,684件・関連E2E162件（2.4分）が成功（全runner exit 0）。関連はunified-ui／unified-annotations／parameter-dialog-controller／blocksで、file URL起動、Annotation Parameter作成・編集と式／依存、Document／Blockの名前空間、Undo／Redo・保存再読込を確認した。追加単体4件はParameter・可変寸法・注記・read-only定数の実Engine評価、symbol一度収集とdraft／model無変更、明示Document／Blockと最新値・0／負数、重複／prefix／未知参照／循環の失敗順序、非有限結果に対する現在言語のerrorを検証する。既存16件のNamespace評価／rename／Clipboard／削除依存等の期待値も維持した。候補検証は採番・target／評価値更新を行わず、appのmodelを明示する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-annotation-parameter-validation-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 40c41f3（前実装e6973ad）、開始時の週枠残量71%／検証後70%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はinstallTestHooks内のCanvas描画診断groupの構築・公開を分析する。既存CanvasRenderTestDriverのDraftDashCases／BlockDashCases→DashIsolationとConstructionHoverFixture／ConstructionLineObservationの五部品間の結線を、同じtesting ownerで閉じられるか検討する。既存三つのブラウザ公開API（canvasDashIsolationCases、constructionLineHoverDisplayCasesForTest、constructionLineRenderingForTest）の名前・関数契約・同じ描画／モデルowner・scene reset／mode変更順を維持する。test hooksの有効条件と生成時のread／副作用を監査し、通常描画の実装をtestingへ移さず、既存helperの組立てだけを担当させる。read／draw layer等の公開APIを必要な範囲で共有し、app全体や可変contextを渡さず、installTestHooks全体を別の巨大closureへ移さない。

### 最新の拘束保存metadata単位

ConstraintPersistence.createMetadataへ共有decorateとDocumentSnapshot用snapshotDataを統合した。raw codecを変更せず、null／未指定・data同一性・field順、read-only／式fallback、Document／BlockのSketch IDと参照情報の扱いを維持する。metadata ownerは早いBlock機能より前に生成し、raw codecの後段初期化はhoisted serializerの遅延呼出しで保つ。装飾のhoisted入口はBlock履歴・Clipboard・test support向けに残し、Snapshotには同じownerの保存用methodを直接接続する。新file・state・script・保存形式変更はない。app.jsは3,295→3,281行（14行減）、今回の再開から3,652→3,281行（371行減）。

構文578ファイル・単体1,680件・関連E2E177件（2.5分）が成功（全runner exit 0）。関連はunified-ui／file-safety／blocks／derived-patterns／derived-selection-copyで、file URL起動、保存読込・Block履歴／編集、Clipboard・派生参照、円形配列と角度間隔寸法、Undo／Redoを確認した。追加単体4件はdata／拡張Objectの同一性・field順、read-onlyと式fallback、null／未指定、DocumentだけのSketch queryとBlockの元field、遅延生成・raw失敗／数値式例外時の停止と途中効果、実Snapshot／raw codecのDocument・Block別JSONと復元・元拘束無変更を検証する。既存raw codec4件の参照scope・型判定・legacy読込の期待値も維持した。metadata初期化はParameterNamespace／SketchContext後・早いBlock機能前で、raw codecは後段まで読まない。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-constraint-save-metadata-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 1aa49fb（前実装0c0bf86）、開始時と検証後の週枠残量72%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はAnnotationCommand.validateParameterのapp内候補検証を分析する。名前のtrim／式正規化→現在modelのsymbol収集→名前検証→Parameterと可変寸法のdefinitions＋新候補→read-only寸法の定数Map→ParameterEngine評価→有限値検査という読取り処理で、既存ParameterNamespaceが同じsymbol・分類・式変換・Engineを所有する。既存Namespaceへ新規候補の検証を統合できるか確認し、model aliasを明示してDocument／Blockのscopeを保持する。ensure／evaluateParameterNamespace等のモデル更新経路へ一律置換せず、symbol収集回数、read-onlyの値、名前重複／未知参照／循環の例外・現在言語のerror、入力draft／modelの無変更を検証する。commitParameterの適用・評価・履歴は既存の担当に残す。新たな小fileや汎用contextは作らない。

### 最新のGeometry削除の操作終了単位

GeometryDeletionCommandへ削除前の限定された操作終了手順を統合した。appのendInteraction callbackを除去し、後段で生成する三種類のdragは遅延reset callback、既に生成済みのSession／Line／Circular／previewは同じowner、modeは既存setterへ接続する。guardと依存／空plan／symbol検査後・実削除前の位置、clearとcancel／resetの違い、operand／trim保持と非対象draft、途中例外・求解／履歴の順序を維持した。不要になったArc reset aliasも除去した。新file・state・scriptや保存形式変更はない。app.jsは3,307→3,295行（12行減）、今回の再開から3,652→3,295行（357行減）。

構文578ファイル・単体1,676件・関連E2E192件（2.8分）が成功（全runner exit 0）。関連はunified-ui／sketch-permissions／derived-selection-copy／multiple-dimensions／blocks／unified-annotationsで、file URL起動、削除・派生参照拒否・権限・寸法／Block／注記、Undo／Redo・保存再読込を確認した。追加単体3件は実PendingCommandSession／ConstraintTargetSession／DrawingPreviewを使い、成功時のclearとcancel／resetの区別、operand配列とtrimの参照保持、選択mode依頼、四種の拒否時の状態無変更、drag／Arc reset例外時の停止を検証する。既存5件のguard・削除／選択整理／求解・履歴の期待順は維持し、操作終了の内訳を別traceで検証できるfixtureへ更新した。後段dragは初期化時に読まないこと、不要なArc reset aliasの参照が残らないことを確認した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-geometry-deletion-interaction-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop dd8e6e2（前実装1f3d954）、開始時の週枠残量74%／検証後73%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はdecorateSerializedConstraintとDocumentSnapshot.constraintDataの保存用metadata生成を分析する。既存ConstraintPersistence／DocumentSnapshotとの責務を確認し、raw codecのserialize／deserialize契約を変えず、readOnlyDimension・parameterName・expression、DocumentとBlockのsketchId、参照flag／referenceSketchIdの既存条件・null／未指定・field順とdata同一性を保持する。Block編集・履歴、Clipboard、test supportにも同じdecorate入口を渡すため、用途別にscope情報を混ぜない。早いBlock機能への登録はhoisted関数を使い、constraintCodecs生成は後段にあるので、新metadata ownerの生成位置と読取り遅延を監査して未初期化constを直接渡さない。新たな小fileや可変contextを増やさず、既存ownerで役割をまとめられるか検証する。

### 最新の拘束・寸法開始準備単位

拘束・寸法開始前のreset進行を既存DrawOperationLifecycleのprepareConstraintStart／prepareDimensionStartへ、mode別の拘束取消準備をprepareConstraintCancelへ統合した。Pending／Centerline／Slotの先行処理と共通のreset subsetを区別し、mode条件は各reset直前に読み取る。角度間隔寸法の開始は既存DimensionPlacementCommandへ統合し、通常寸法と異なる取消・select・anchor／target・Pending生成の経路を維持した。開始処理の三つの直接mode書込みを既存selectModeポートへ接続し、mode変数やdraft／sessionの新ownerは作らない。新file・script・保存形式変更はない。app.jsは3,331→3,307行（24行減）、今回の再開から3,652→3,307行（345行減）。

構文578ファイル・単体1,673件・関連E2E133件（1.9分）が成功（全runner exit 0）。関連はunified-ui／command-panel／derived-patterns／circular-authoring／multiple-dimensionsで、file URL起動、作図・拘束／寸法への切替、CommandPanel、円形配列の角度間隔寸法の直接操作・符号付き編集、Undo／Redo・保存再読込を確認した。追加単体6件は二種類の開始reset順・取消のmode別の独立した二回のread・reset例外時の停止、角度間隔寸法の拒否順／既存操作保持、実InstanceAngleIntervalConstraintのanchor／現在angleStepとtarget／pointer同一性、取消／target生成の例外時の途中効果と後続無実行を確認する。既存の関連単体21件も維持した。Centerline／Slot／Arcの旧aliasは同じ閉包resetを指し、isPlacingは同じownerのarrow query、既定pointerは同じplacement serviceであることを確認した。最終差分確認で不要になったCenterline／Slotのreset aliasを除去し、app構文・全単体1,673件・同じ関連E2E133件（1.9分）を再確認した（すべてexit 0）。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-dimension-start-lifecycle-{focused,check,unit,related,unit-final,related-final}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 5658e62（前実装d10eda4）、開始時の週枠残量75%／検証後74%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はGeometryDeletionCommand.endInteractionのapp側callbackを分析する。現在はGeometry／Dimension／Annotation drag reset→Pending.clear→拘束commandだけclear（operandは保持）→Line／Circle／Arc reset→preview pointerだけnull→select modeという限定的な操作終了を行う。削除commandのguard／依存参照検査後、実削除前に呼ばれる契約を維持し、GeometryDeletionCommand自身が具体的な操作ownerへ依頼する責務を持てるか検討する。cancel／rollbackやresetForDocument／通常寸法開始へ一律置換せず、Rectangle／Slot／Centerline等の未対象draftやoperands保持、拒否時の無変更、途中例外の停止位置を検証する。新しい汎用reset容器や可変app contextを作らず、既存APIの必要な範囲で接続する。

### 最新のCanvas context interaction単位

CanvasContextInteractionへTarget selection／Fix照会・Items・CandidateAction・Entry・Actionsの生成と結線、およびhover preview通知を集約した。候補Queryとpresenter、既存UI controllerのsessionは独立したまま使う。appは四つの操作入口へ委譲し、六部品間の一時的な参照を保持しない。早いcallback登録とcloseAppMenusの遅延参照、後段生成→controller.start、選択保持／明示置換・拘束振分け・pointer同一性・guard・履歴順は維持する。新しい操作stateや巨大contextを作らず、既存componentの明示portを接続する。外部依存64項目は残り、単一facade化で全体の依存整理を完了したとは扱わない。新classic script／単体testと四つの読込・検証一覧を同期した。app.jsは3,348→3,331行（17行減）、今回の再開から3,652→3,331行（321行減）。

構文578ファイル・単体1,667件・関連E2E169件（2.4分）が成功（全runner exit 0）。関連はunified-ui／blocks／fixed-command／sketch-permissions／drawing-order／multiple-dimensionsで、file URL起動、候補menu・Fix／寸法整列・描画順・権限、Block、Undo／Redo・保存再読込を確認した。追加単体4件は実Target／Items／Entry／Actions／CanvasSelection／CanvasHoverを接続し、単一対象での選択集合保持と最新Fix表示、重複候補のpreview無変更・明示置換・最新拘束commandへの振分け、取消時のquery省略と拘束時の例外・mode短絡、pointer／item同一性・編集guard・寸法整列のUI／draw／履歴順を検証する。生成時のDOM／Fix／Selection読取りがないことも確認する。新script／testの四一覧を同期した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-canvas-context-interaction-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 1f83000（前実装a0cf3be）、開始時の週枠残量76%／検証後75%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は拘束・寸法配置の開始準備を分析する。appのConstraintTargetCommand.prepareStartとDimensionPlacementCommand.prepareStartはmode変更とLine／Rectangle／Fillet／Circle／Arc／previewのresetを行い、前者だけPending取消とCenterline／Slotのresetが先行する。既存DrawOperationLifecycleが同じcommand実体を所有しているため、元の順序・reset範囲・途中例外とread時機を保って開始準備を担当できるか検証する。startInstanceAngleDimensionもappに残り、guard／配置中／circular判定→Pending取消→拘束取消→select mode→anchor／拘束target→pending置換→案内／toolbar／drawという独自経路を持つ。既存DimensionPlacementCommandへ統合できるか合わせて確認し、通常の寸法開始と一律に同じresetへ正規化しない。単なるmode getter／setter容器を新設せず、現在の状態ownerと開始・確定・取消の責務を揃える。

### 最新のProperties Panel組立て単位

既存PropertiesDisplayへcreateWithControllerを追加し、ControllerとViewの生成・編集command／選択照会／共有AppearanceUIの結線を集約した。appはPropertyEditingFeatureの結果を一つのAPIとして渡し、個別geometry／element command・controls／Palette入口・Controllerの中継参照を除去した。PropertySelection／EditingFeature／AppearanceUIの生成位置と既存state、選択の遅延照会、権限・preview／commit・操作の戻り値を維持する。新file・state・汎用contextは追加せず、表示専用create APIも維持する。外部actionとread ownerのportはまだ多く、引数を隠すだけで全体を分離済みとはしない。app.jsは3,354→3,348行（6行減）、今回の再開から3,652→3,348行（304行減）。

構文576ファイル・単体1,663件・関連E2E194件（2.9分）が成功（全runner exit 0）。関連はunified-ui／blocks／free-instance／sketch-permissions／unified-annotationsで、file URL起動、Properties編集・Palette・複数選択、配置状態・Block／Instance／注記・権限、Undo／Redo・保存再読込を確認した。追加単体3件は実Controller／View／PropertySelectionをつなぎ、生成時のDOM／scope遅延、描画後の選択変更と外観preview／commit、geometry結果のchecked／更新、element／multiple編集、owning Sketch lockでinput／change／clickを短絡すること、最新配置状態・構造guard・action戻り値と共有Palette接続を検証する。従来表示APIの3件も維持し、既存fixtureのSketch名readerを実APIに合わせて補完した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverはrunner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-properties-panel-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop a6d51fd（前実装395d892）、開始時の週枠残量77%／検証後76%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はCanvas context menuの機能組立てを分析する。Query・Presentation・Targetの選択／Fix照会／候補確定・Items・Entry・Actionsに散る結線を、既存ownerと外部で必要なopen／execute／candidate選択／表示APIに沿って整理する。早いCanvasContextMenu生成のcallbackは後段のpresenter等を操作時に参照し、test supportにも同じpresenterを渡すため、生成順・初期化時read・startの時機を照合する。候補hoverの復元、選択集合の保持／明示置換、拘束command時の候補振分け、mode／pointerと取消を維持し、新たなmenu sessionや任意commandを操作できるcontextを作らない。既存CanvasContextTargetで閉じられる依存と、applicationの機能組立てに属する依存を区別し、薄いwrapperの積み重ねだけで全体完了としない。

### 最新の共有外観UI組立て単位

PropertiesとDocument設定で共有するAppearanceControls／AppearancePalette、および起動時のDocumentAppearanceEditorの生成・接続をAppearanceUIへ集約した。同じAppearanceEditing・選択照会・外観commandを使い、appは外部portとcontrols／openPalette／startだけを接続する。Document設定の生成時機、設定start→Palette.bind、他の起動処理との順序、Palette session・最新scope／既定値・倍率・履歴／UI／drawの動作を維持する。共有componentや編集stateを再生成せず、移動で不要になったaliasを整理した。新classic scriptと単体testをindex／構文一覧／単体一覧／読込期待へ同期した。app.jsは3,375→3,354行（21行減）、今回の再開から3,652→3,354行（298行減）。

構文576ファイル・単体1,660件・関連E2E195件（2.9分）が成功（最終全runner exit 0）。関連はunified-ui／leader-appearance／blocks／hatching／unified-annotationsで、file URL起動、PropertiesとDocument既定値・Palette、使用中色・継承・複数選択、Block／Hatch／注記、Undo／Redo・保存再読込を確認した。追加単体3件は生成時のDOM／選択照会の遅延、Document設定start→Palette.bindの順、同じcontrolsによる全設定group、PropertiesとDocument設定から同じPaletteへの接続、取消・captured ownerと最新scopeの使用中色、置換された既定値と現在倍率、履歴→UI→drawを検証する。新単体の構文一覧への追加を最終確認し、構文・単体を再実行した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。専用serverを非表示で先に起動し、runner終了後にPID／command lineを照合して終了した。ログは一時ディレクトリのcad-appearance-ui-{focused,check-final,unit-final,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 25f9124（前実装c595f3b）、開始時の週枠残量78%／検証後77%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は残るPropertySelection・PropertyEditingFeature・PropertiesController・PropertiesDisplayの生成と接続を分析する。geometry／appearance／element／multiple編集のapp内利用はControllerと共有AppearanceUIに集中し、appearanceEditingはAnnotationの編集にも公開される。対象・可視性照会は早いappのhoisted入口からも呼ばれるため、生成順と操作時readを維持する。Panelとして共有選択・編集・表示の結線を閉じられるか、既存のread owner／command APIを使って検討する。外部に必要なappearanceEditing・可視性操作・対象照会・表示更新を明確にし、共有AppearanceUIやDocument既定値をPanel内部で再生成しない。巨大contextやController引数の横流しだけなら境界を見直す。

### 最新の注記Clipboard変換単位

ClipboardTransferへdetachedAnnotationの実処理を統合し、appは必要な表示照会と現在倍率を渡して同じ関数をClipboardPayloadへ接続する。元のserialize→layout／metrics→anchorPosition→Leader形状／anchor複製→倍率計算の順を維持する。参照を外す判断とmetadata除去はPayload、貼付け移動・再接続はTransfer、表示位置の解決は既存Renderer／Anchor queryが所有する。新file・state・汎用contextを増やさず、Transfer生成は読取り無処理であることと、全portの初期化済みを確認してPayloadより前へ移した。app.jsは3,386→3,375行（11行減）、今回の再開から3,652→3,375行（277行減）。

構文574ファイル・単体1,657件・関連E2E170件（4.7分）が成功（全runner exit 0）。関連はunified-ui／annotation-anchors／annotation-display-size／derived-selection-copyで、file URL起動、単独注記と参照先を含むコピー、Leader表示形状・倍率、派生参照、Undo／Redo・保存再読込を確認した。追加単体3件はlayout／metrics fallbackと明示anchor、生成時の遅延読取り、現在外観／倍率、解決pointの独立copy、元注記・表示geometryの無変更、実TransferとPayloadの接続による参照保持／除去を確認する。変換本体はserialize呼出先と倍率readerへの置換を除き移動前と一致した。この単位で全E2E・性能fileは未実行。最終main反映前に最新コードで全体検証する。E2E全170件の成功表示後、worker不在とこのrunが起動したserverを確認し、終了待ちの専用server（port8784）だけを終了して同じrunnerのexit 0を回収した。E2Eの再起動・既存テストの期待値変更はしていない。ログは一時ディレクトリのcad-clipboard-annotation-copy-{focused,check,unit,related}.log。

この単位をCommit／Pushしてdevelopへ統合する。基準はdevelop 11c6b16、開始時の週枠残量79%／検証後78%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はPropertiesの機能組立てを分析する。AppearanceControlsとPaletteはPropertiesだけでなくDocumentAppearanceEditorにも共有され、AppearanceEditingも同じ実体を使う。PropertySelection／PropertyEditingFeature／PropertiesDisplay／Controllerとの共用依存と、create・操作時read・bind／startの順序を照合し、重複する接続を同じownerで閉じる。共有部品をProperties専用に再生成せず、現在scopeとDocument既定値・Palette sessionを維持し、外部に必要なAPIだけを公開する。大量callbackの単なる横流しや新しい巨大contextになれば境界を見直す。未使用aliasは実際の利用先を確認して同単位で整理する。

### 最新の拘束確定performance owner単位

前単位はfab4473をdevelopのc99da9aへ統合・Push済み。今回はcodex/constraint-performance-ownerで継続中。週枠使用20%／残量80%で停止条件には達していない。

ConstraintCommitCommandへ最後の性能traceの保持・読取り・解除を集めた。生成と成功後の公開を同じownerで行い、既存observerの同一Object通知と公開位置、失敗／短絡時の以前のtrace保持、Document resetの無通知null化を維持する。appのlastAuthoringPerformanceと生成／観測／resetの三つの中継callbackを除去し、readPerformance／clearPerformanceを直接接続した。新fileや汎用state容器は追加しない。app.jsは3,387→3,386行（1行減）、今回の再開から3,652→3,386行（266行減）。

構文574ファイル・単体1,654件・関連E2E122件（1.7分）・性能file全12件（48.0秒）が成功（全runner exit 0）。関連はunified-ui／command-panel／fixed-command／file-safety／parameter-dialog-controllerで、file URL起動、拘束確定・Fix／Undo、操作取消、Document reset・保存再読込を確認した。パンは150msで元の175ms未満の基準内。追加単体3件は成功後の公開順とobserverの同一Object、command間の独立、拒否・失敗・参照への切替時の旧trace保持、公開前例外時の旧trace保持、無通知の反復clearを確認する。このコードで全E2Eは未実行であり、最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-constraint-performance-owner-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量79%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はClipboardPayload.detachedAnnotationの値変換を既存ClipboardTransferの責務へ統合できるか分析する。現在表示中のanchor／文字layout／Leader geometry・倍率と保存用copyの関係、元Annotationの無変更、参照を持つ項目の扱いを確認する。現在TransferはPayloadより後で生成されるため、必要な読取り依存と生成時の無処理を確認して接続順を整理し、未初期化constを直接渡さない。Materializationやモデル編集と混同せず、新たな小fileや汎用contextを作らない。その後は再監査のProperties／context menu等の意味のある機能組立てへ進む。

### 前単位のcomposition root再監査単位

前単位はb6e825fをdevelopのf37edc6へ統合・Push済み。今回はcodex/bootstrap-boundary-auditで監査した。開始時は週枠使用19%／残量81%。実装・テスト・設定は変更していない。

[bootstrap-boundary-audit.md](bootstrap-boundary-audit.md)へ、app.jsのAST集計、十個のletの役割、残るcallbackの実処理、遅延依存、機能単位の構築と起動段階、数百行へ近づけるための判断、次の具体的な実装単位を記録した。section 5を現在の構成へ更新し、Hatchの薄い分割を見送る判断とmainの検証gateを維持する。app.jsは3,387→3,387行（0行変化）。全体目標は未完了。

監査文書の関連local link 7件、ASTの分類と非空白行の合計、十個のletの読取り／代入先、次のtrace生成／reset／観測の呼出し箇所を確認した。app.jsのSHA-256一致と実装・テスト・設定のGit差分なしを確認した。文書のみの変更のため構文・単体・E2Eは再実行していない。同一実装の直前結果は構文574ファイル・単体1,651件・関連E2E163件成功であり、全E2E成功とは扱わない。この監査記録をCommit／Pushしてdevelopへ統合する。週枠残量80%で継続中、mainは5ee5f3fを維持する。次は再監査で特定したConstraintCommitCommandの性能trace生成・最後の結果・Document reset／test読取りの所有を揃える。全体目標は未完了。

### 前単位のSketch正規化copy単位

前単位は499abbaをdevelopの02f580bへ統合・Push済み。今回はcodex/sketch-normalized-copyで継続した。開始時は週枠使用18%／残量82%で停止条件には達していない。

normalizedSketchCopyの本体をSketchHierarchy.copyWithNormalizedAppearanceへ統合した。Block clone／apply・Session同期・Block履歴が同じ関数を使う。四種の外観は独立して正規化し、その他のfieldはshallow copyで参照を維持する。ID／親／Root名の補正や読込版移行は行わず、null／未指定の継承用空外観、元Sketchの無変更を維持する。新file・state・依存portは増やさず、appは関数の接続だけを保持する。app.jsは3,396→3,387行（9行減）、今回の再開から3,652→3,387行（265行減）。

構文574ファイル・単体1,651件・関連E2E163件（2.3分）が成功（全runner exit 0）。関連はunified-ui／blocks／block-geometry-fixed／derived-selection-copy／sketch-editで、file URL起動、Blockのclone／編集／確定・取消と履歴、Sketch外観・階層、複写回帰、Undo／Redo・保存再読込を確認した。追加単体3件は四種の外観正規化・入力無変更・コピー間の独立性、未知fieldと外観以外の参照の維持、Root／親／IDを修復しないこと、空値と継承を確認する。呼出し監査では直接利用はBlock編集とSession同期、clone経由のBlock履歴であり、当初のClipboard経由という説明を修正した。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-sketch-normalized-copy-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量81%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は現在のapp.js全体の残存責務と依存を再監査する。初期分析から大幅に構成が変わっており、残るstate・実処理・feature組立て・test hooks・起動を現在のownerと照合する。数百行のcomposition rootへ進むため、既存ownerを束ねる意味のある機能境界と初期化段階、循環参照・遅延callbackの理由を具体化してsection 5と再開候補を更新する。巨大context／app本体の移動／空行削除だけで目標を達成した扱いにせず、薄いfileを増やすだけの分割も見送る。監査結果から次の実装単位を選び、現在の中間成果で全体完了としない。

### 前単位の読込codec生成単位

前単位は9976050をdevelopの6a26548へ統合・Push済み。今回はcodex/document-loading-codecsで継続した。開始時は週枠使用17%／残量83%で停止条件には達していない。

DocumentLoading.createWithCodecsへGeometry／Block／Instance読込codecの組立てを統合した。BlockとDocumentの共通の接続・Parameter準備依存を共有し、同じInstance codecの検査・正規化・移行を直接接続してappへの中継依存を除いた。既存のcodec注入APIと通常編集用normalizerのactive Sketch fallback、候補decode→reset→installの順、読込形式と参照同一性を維持する。新file／state／registryは増やさず、不要になった検査用中継関数を削除した。app.jsは3,409→3,396行（13行減）、今回の再開から3,652→3,396行（256行減）。

構文574ファイル・単体1,648件・関連E2E220件（3.1分）が成功（全runner exit 0）。関連はunified-ui／blocks／file-safety／free-instance／sketch-projection／derived-selection-copy／hatching／reference-imagesで、file URL起動、候補拒否、Block／Instance／投影参照・複写、Hatch・画像、Undo／Redoと保存再読込を確認した。追加単体3件は実Block／Geometry／Instance codecと投影ownerによる生成時の遅延、Root／Blockの拘束参照とnamespace独立性、入力無変更、install時の配列／Object同一性と無効化順、同じInstance検査のRoot／Block拒否とDocumentApplicationのreset無実行、共通pattern正規化を確認する。読込では各namespaceの明示Sketch resolverを使い、通常編集時のactive fallbackはappの既存入口に維持する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-document-loading-codecs-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量82%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はappに残るnormalizedSketchCopyを、既存Sketchデータownerへ統合できるか分析する。Block編集とClipboardが共有する四種の外観正規化、未知fieldとObject参照を保つshallow copy、空値の既存規則を維持し、UI・採番・履歴へ依存させない。新たな小fileは追加せず、既存SketchHierarchy／Appearanceの責務との整合と読込時の正規化との違いを確認する。Hatch描画は既存境界で維持し、必要な依存整理が見つかった時点で再検討する。

### 前単位のDocument編集reset単位

前単位は2feab48をdevelopの3d8625cへ統合・Push済み。今回はcodex/document-editing-resetで継続した。開始時は週枠使用16%／残量84%で停止条件には達していない。

DocumentEditingResetへresetModelStateの進行を分離した。DocumentStateの二段階reset、scope復帰と保留pointerの破棄、cache／Selection／draft／session／採番／Block編集のreset、既定値復元後のHatch／Tree／Annotation／画像操作の順を維持する。既存の重複resetも省略せず、例外境界・配列参照・取消／履歴なしの契約を維持する。各ownerを生成後に接続し、初期化前のconstを直接捕捉するgetter集合や汎用app contextを作らない。Hatchのcontent／Layerは既存renderer内に責務がまとまり、包むだけでは効果が小さいため今回は追加分割しない。app.jsは3,433→3,409行（24行減）、今回の再開から3,652→3,409行（243行減）。

構文574ファイル・単体1,645件・関連E2E189件（2.6分）が成功（全runner exit 0）。関連はunified-ui／blocks／file-safety／sketch-move／command-panel／reference-images／phase0-characterizationで、file URL起動、読込候補の拒否時に現在Documentを保持すること、Block／Sketch移動・取消、参照画像、既存画面比較、Undo／Redo・保存再読込を確認した。追加単体3件は実DocumentState／EditingWorkspace／Selection／Geometry・Document IDsによるscope復帰・入力破棄・二段階resetの配列参照と既定値／採番／session、画像操作二回のreset、例外の同一参照・停止位置と後続の無処理、繰返しresetを確認する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-document-editing-reset-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量83%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はDocumentLoading／DocumentApplicationとGeometry・Block・Instance persistenceの生成依存を分析する。decode／候補検証が成功する前に現在Documentをresetしないこと、Tree状態の退避／復元、install先のDocumentと編集scope、line repair・既定寸法・採番復旧・外観／drawing orderの更新順を確認する。codecの互換性責務と編集状態のresetを区別し、共有registry／ID ownerを増やさず、生成を束ねるだけの薄いfileを追加しない。Hatch描画は既存境界で維持し、必要な依存整理が見つかった時点で再検討する。

### 前単位の注記表示生成単位

前単位はd641f39をdevelopのc196916へ統合・Push済み。今回はcodex/annotation-displayで継続した。開始時は週枠使用15%／残量85%で停止条件には達していない。

AnnotationDisplayへColor／Renderer／Layerの生成・接続とframe／resize／Leader終端handleの表示規則を集約した。同じSelection／hover／export／実効外観とCanvasSurfaceを共有し、後段のAnnotation drag／commandはresize可否とpreviewの遅延callbackで参照する。アンカー解決、文字layout・Leader geometry、色の優先順位、保存frameのPNG表示、投影／編集不可・active／anchorのhandle抑制を維持する。Anchor materializationとモデル編集は既存ownerに残す。app.jsは3,437→3,433行（4行減）、今回の再開から3,652→3,433行（219行減）。

構文572ファイル・単体1,642件・関連E2E239件（3.8分）が成功（全runner exit 0）。関連はunified-ui／unified-annotations／annotation-anchors／leader-appearance／free-text-input-drag／annotation-display-size／png-export／phase0-characterizationで、file URL起動、選択／hover／投影／read-onlyの表示、frame／resize／Leader、アンカー追従と解除、既存画面比較、PNG・Undo／Redo・保存再読込を確認した。新単体4件は生成時のread遅延、色とframe／handle条件の共有、PNGでも保存frameは維持すること、elementとhover handleの同一性、遅延resize可否、Leaderのactive／投影／anchor／preview条件、アンカーの最新参照・保存座標無変更、通常表示の可視性とpreviewの違いを実Renderer／外観queryで確認する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-annotation-display-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量84%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はHatchRendererのcontent／Layerの生成・接続を分析する。境界Geometryの解決は既存HatchGeometryQueryに維持し、Geometry描画器の境界stroke、Sketch alpha、通常／Constructionの選択表示、PNG world bounds・alpha、previewの既存順序を確認する。後段のHatch commandとmode／hover／exportは現在の遅延readerで接続し、境界cacheやauthoring stateをもう一組作らない。静的なGeometry型・Painterと実行時の照会を区別し、単なる巨大contextへの移動を避ける。

### 前単位の寸法表示traversal単位

前単位は39d998cをdevelopの378a8b5へ統合・Push済み。今回はcodex/dimension-display-traversalで継続した。開始時は週枠使用14%／残量86%で停止条件には達していない。

DimensionDisplay.createTraversalへ寸法のSelection bounds／Layerの生成・接続を統合した。前段で作成した同じplacement／metrics／layout／Painterを使い、後段のhover／drag／pending／export／statusはread portで操作時に読む。通常寸法とAnnotation表示寸法を含むdimensionPresentationScope、active順のsort、解決済み外観の一回受渡し、label・選択境界、PNG時のflags抑制を維持する。新しいstate・cache・fileは増やさない。app.jsは3,443→3,437行（6行減）、今回の再開から3,652→3,437行（215行減）。

構文570ファイル・単体1,638件・関連E2E169件（2.5分）・性能file全12件（48.9秒）が成功（全runner exit 0）。関連はunified-ui／multiple-dimensions／unified-annotations／phase0-characterization／png-export／annotation-display-sizeで、file URL起動、通常／Annotation寸法、矩形選択、既存画面比較、PNG・寸法移動・保存再読込を確認した。パンは147msで元の175ms未満の基準内。追加単体3件は後段組立て時のread遅延、合成scopeのsortとモデル配列／Object同一性、表示寸法ごと一回の外観解決、最新scope／defaults・文字サイズ／bounds・active／hidden短絡、hover／drag／Selection／inspection／編集／PNG flagsとCanvas保存復元を確認する。fixtureは既存CanvasSelection.set APIを使い、製品の選択規則は変更していない。このコードで全E2Eは未実行であり、最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-dimension-traversal-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量85%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はAnnotationRendererのColor／本体／Layerの生成・接続を分析する。文字layout・Leader geometry・描画は同じownerを共有し、選択／inspection／hover／PNGによる色・frame・handleの表示規則とアンカー解決を維持する。Annotation dragとcommandは後段に生成されるため、resize可否とpreviewは現在の遅延callbackとして接続し、未初期化constを早期に渡さない。Anchor materializationやモデル編集を表示featureへ混ぜず、表示用state・cacheをもう一組作らない。

### 前単位の寸法表示生成単位

前単位は391d78aをdevelopのe298a50へ統合・Push済み。今回はcodex/dimension-displayで継続した。開始時は週枠使用13%／残量87%で停止条件には達していない。

DimensionDisplayへMetrics／Placement／Layout／Renderer／Painterの生成・接続を集約した。入力・drag・hit・Annotation・テスト支援にも同じmetrics／placement／layoutsを公開し、独自の計算やcacheを増やさない。layoutの省略外観fallback、Painterの解決済み外観受渡し、現在scopeの接続線、Canvas theme／式マークprobe、zoomとlabel配置を維持する。Input Controllerと表示traversalは既存の初期化位置に残す。app.jsは3,452→3,443行（9行減）、今回の再開から3,652→3,443行（209行減）。

構文570ファイル・単体1,635件・関連E2E152件（2.2分）・性能file全12件（48.6秒）が成功（全runner exit 0）。関連はunified-ui／multiple-dimensions／dimension-prefix／phase0-characterization／png-export／annotation-display-sizeで、file URL起動、既存画面比較、寸法表示・移動・編集、PNG・表示倍率・保存再読込を確認した。パンは151msで元の175ms未満の基準内。追加単体3件は生成時のCanvas／scope／外観の遅延、現在scopeの接続線とPoint同一性、最新Document既定外観と明示外観の受渡し、モデル無変更、実Painterの直線／角度描画とscope・zoom変更、式マークprobe・theme flags、編集時label非表示とCanvas save／restoreを確認する。このコードで全E2Eは未実行であり、最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-dimension-display-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量86%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は同じDimensionDisplayからDimensionPresentationのSelection bounds／Layerを生成・接続する境界を分析する。寸法labelは先に生成され、Layerは後段のdrag／export／hover／pendingを操作時に読む。初期化順・dimensionPresentationScopeの実体とsort・一回の外観解決・選択境界／描画の同じmetrics／placement／Painterを保ち、別の描画stateや早期読取りを増やさない。入力Controllerの確定処理やモデル編集を表示側へ混ぜない。

### 前単位の寸法drag生成単位

前単位は374ed80をdevelopのd4b6365へ統合・Push済み。今回はcodex/dimension-drag-compositionで継続中。週枠使用13%／残量87%で停止条件には達していない。

DimensionDragFeatureへDimensionLineGroup、選択group照会、角度同期とDimensionDragの生成・接続を集約した。DimensionLineGroup.createSelectionへ現在scope・Sketch権限／可視性・寸法実効外観の照会を分離し、純粋なgroup配置計算とは別factoryにした。dragとcontext整列・入力／menu判定は同じ入口を使い、既存DimensionDragだけがsessionを所有する。既存配置、pointer capture、継続command click、display／label offset、角度参照値、通知と履歴の順を維持する。app.jsは3,468→3,452行（16行減）、今回の再開から3,652→3,452行（200行減）。

構文568ファイル・単体1,632件・関連E2E165件（2.4分）が成功（全runner exit 0）。関連はunified-ui／multiple-dimensions／dimension-prefix／sketch-permissions／blocksで、file URL起動、複数寸法の移動／整列と非平行時の単独操作、角度寸法、権限、Block scope、Undo／Redo・保存再読込を確認した。新単体4件は生成時の遅延、現在scopeへの所属と権限／可視性・実効外観の更新、Object同一性と選択無変更、実配置によるgroup移動／整列とsnapshot・一回の履歴、guard拒否と元のhits／3px閾値、角度同期・参照値維持とresetを確認する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-dimension-drag-feature-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量87%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次は寸法表示のMetrics／Placement／Layout／Renderer／Painterの生成依存を分析する。既存の寸法入力・drag・hit・Annotationと共有する同じ配置／metricsを維持し、描画専用ownerと入力Controllerを区別する。解決済み外観の受渡し、Canvas probe・PNG描画・label配置と単独呼出しのfallbackを保持し、巨大contextや描画間cacheを導入しない。

### 前単位のProperties対象context単位

前単位はc1b89dbをdevelopの17af9feへ統合・Push済み。今回はcodex/property-target-contextで継続中。週枠使用12%／残量88%で停止条件には達していない。

PropertySelection.selectedDisplayTargetへProperties対象のlock／readOnlyと所有Sketch／作図Sketch labelの照会を統合した。元のraw対象APIと優先順位を維持し、複数対象は全ownerでlock判定・先頭ownerのlabelを使う。現在registryの置換、lock／名前／作図Sketch変更は操作時に取得し、選択配列とモデルObjectを変更しない。appの早期callback用hoisted入口は委譲だけを残し、Properties表示・Controller・palette・観測の同じ入口を保つ。新しいファイルやstateは増やさない。app.jsは3,476→3,468行（8行減）、今回の再開から3,652→3,468行（184行減）。

構文566ファイル・単体1,628件・関連E2E175件（2.6分）が成功（全runner exit 0）。関連はunified-ui／sketch-permissions／free-instance／blocksで、Properties表示・編集、ロック／参照表示、配置中対象、file URL起動、Undo／Redo・保存再読込を確認した。追加単体3件は生成時の遅延、registry置換と名前／lock／作図Sketchの最新照会、raw対象・選択配列・モデルの無変更とObject同一性、複数owner判定／先頭label、inspectionのreadOnly維持、Sketch／操作中対象の優先順位と所属不在を確認する。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-property-target-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量88%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はDimensionDragとDimensionLineGroup、角度同期の生成・接続と選択group照会を分析する。現在scopeへの所属、Sketch編集／可視性、寸法の実効外観、parallel groupのsnapshot、drag時とcontext整列時の共通入口を確認する。純粋な配置計算とSelection照会、sessionの所有を区別し、pointer capture／継続command click／historyの順を保ってまとまった責務へ寄せる。巨大contextや新たなdrag stateは作らない。

### 前単位のProperties編集生成単位

前単位は741e4feをdevelopの88017c6へ統合・Push済み。今回はcodex/property-editing-compositionで継続中。週枠使用12%／残量88%で停止条件には達していない。

PropertyEditingFeatureへGeometry／Appearance／Bulk／SelectionVisibility／Elementの編集commandと共有AppearanceEditingの生成・接続を集約した。表示・対象決定・操作stateは移さず、現在scope、guard、snapshot／復元、Parameter安定化、投影metadata同期、anchor具体化、cache無効化と履歴／通知の順序・範囲を維持する。外観変更、複数編集、派生Instanceを含む可視性変更は同じ値変換とcommandを共有し、palette／Document設定にも同じ変換入口を渡す。app.jsは3,495→3,476行（19行減）、今回の再開から3,652→3,476行（176行減）。

構文566ファイル・単体1,625件・関連E2E205件（3.0分）が成功（全runner exit 0）。関連はunified-ui／blocks／free-instance／unified-annotations／dimension-prefix／hatching／reference-imagesで、file URL起動、Properties編集、外観継承、ロック、Undo／Redo、保存再読込を確認した。新単体4件は生成時の無処理、現在scopeでの接線拘束拒否と失敗checkpoint復元、通常／派生対象の可視性変更・guardと一回の履歴、単体／複数／外部設定での同じ値変換、anchor具体化と参照画像previewを確認する。新fixtureの外観fieldは既存の対応項目lineWidthと正規化上限10に合わせた。製品の正規化規則や既存期待値は変更していない。この単位で全E2Eと性能fileは未実行。最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-property-editing-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。週枠残量88%で継続中。mainは5ee5f3fを維持し、全体目標は未完了。次はappに残るProperties対象のロック判定・所有Sketch／作図Sketch labelを分析する。既存PropertySelectionへ読み取り専用の表示対象照会として統合できるか確認し、元のraw対象優先順位とObject参照を維持する。権限guardやモデル編集を照会側へ混ぜず、新たな小ファイルや可変contextを作らない。

### 前単位のProperties表示生成単位

前単位は776d458をdevelopの39068c5へ統合・Push済み。今回はcodex/properties-displayで継続した。週枠使用11%／残量89%で停止条件には達していない。

PropertiesDisplayへPropertyRows／PropertyPresentation／PropertiesContent／PropertiesViewの生成・接続を集約した。PropertySelection、Geometry／Dimension／Annotation外観、Block／Instance投影とGeometryReadModelの同じownerを使う。対象決定とモデル編集は移さず、共有AppearanceControlsはpalette／Document設定にも使うため外で生成する。Controllerの元のinput／change／click関数をそのままViewへ渡し、eventのreceiverを維持する。section開閉とDOM lifecycleは同じPropertiesViewが所有し、Contentからのsection callbackは生成後のrender時に解決する。app.jsは3,516→3,495行（21行減）、今回の再開から3,652→3,495行（157行減）。

構文564ファイル・単体1,621件・関連E2E205件（3.0分）・性能file全12件（47.9秒）が成功（全runner exit 0）。関連はunified-ui／blocks／free-instance／unified-annotations／dimension-prefix／hatching／reference-imagesで、file URL起動、Properties編集、型別表示、継承、参照画像、保存再読込を確認した。パンは135msで元の175ms未満の基準内。新単体3件は生成時のDOM／data遅延、実際のRow／Presentation／Content／Viewとread ownerによる最新外観／scope置換／HTML escape、モデル無変更、Controllerの同じ関数とreceiver、実PropertySelectionの混在値・read-only、section開閉の継続とDOM不在の短絡を確認する。このコードで全E2Eは未実行であり、最終main反映前に最新コードで全体検証する。ログは一時ディレクトリのcad-properties-display-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。mainは5ee5f3fを維持し、全体目標は未完了。次はGeometryPropertyCommand／AppearanceEditing／AppearancePropertyCommand／BulkPropertyCommand／SelectionVisibilityCommand／ElementPropertyCommandの生成・接続を分析する。Properties表示とは分け、Toolbarにも使われる可視性変更、Document設定にも使う値変換、Annotation anchorの具体化、元のsnapshot／復元／Parameter安定化／履歴／通知範囲を保つ。PropertySelectionと既存read owner・editing ownerを共有し、DOM表示・選択状態・編集checkpointをもう一組作らず、巨大contextへ移すだけの変更を避ける。

### 前単位のBlockコマンド生成

前単位はd1c182aをdevelopのbab5b44へ統合・Push済み。今回はcodex/block-command-compositionで継続した。週枠使用10%／残量90%で停止条件には達していない。

BlockEditingFeature.createCommandsへBlockDefinitionCommand／BlockCompletionCommandの生成・接続を集約した。model側で作成したediting／Session／queryを共有し、host捕捉も一つのadapterを使う。choiceDialog準備後にcommandを生成し、後段BlockViewはcallbackで操作時に参照する。確定のhost復帰は同じDefinitionCommand.restoreHostへ接続し、Editor表示の同期を省略しない。既存の開始・取消・検証・確認・確定・求解・履歴と失敗復元は各commandに残し、追加Session／model／確認状態は作らない。appから不要になったrestoreHost／依存循環／参照Instanceのaliasも除いた。app.jsは3,533→3,516行（17行減）、今回の再開から3,652→3,516行（136行減）。

構文562ファイル・単体1,618件・関連E2E199件（2.8分）が成功（全runner exit 0）。関連はblocks／block-geometry-fixed／unified-ui／free-instance／derived-selection-copy／hatching／parameter-dialog-controller。file URL起動、入れ子編集、取消、回転確認、拘束、Parameter、複写、保存再読込を確認した。追加単体3件は生成時の遅延と共通host捕捉、既定名とID owner、同じSessionの開始／取消、確認の多重要求抑制・取消後の再要求・確定前のhost復帰と一回の履歴、拒否時と取消後の古い応答での無変更を確認する。新fixtureは既存の「選択から作成した場合に回転確認」と選択queryの独立した配列という契約に合わせ、製品側の条件や期待値は変更していない。この単位で全E2Eと性能fileは未実行。最終main反映前には最新コードで全体検証する。ログは一時ディレクトリのcad-block-commands-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。mainは5ee5f3fを維持し、全体目標は未完了。次はPropertiesの表示側の生成・接続を分析する。PropertyRows／PropertyPresentation／PropertiesContent／PropertiesViewが共有するread ownerとAppearanceControlsを確認する。AppearanceControlsはDocument外観editorやpaletteにも共有され、Controllerはpaletteを使うため初期化順を先に確認し、表示の組立てにモデル編集commandを混ぜない。section開閉の状態はPropertiesView、対象／共通値の照会はPropertySelection、編集は既存commandに維持し、巨大contextや一律UI更新へ統合しない。

### 前単位のBlock編集生成

前単位はdc45908をdevelopの5fc6a5fへ統合・Push済み。今回はcodex/block-editing-compositionで継続した。週枠使用9%／残量91%で停止条件には達していない。

BlockEditingFeatureへBlockDefinitionEditing／BlockEditorSession／BlockEditingQueriesの生成・接続とhost捕捉／復元adapterを集約した。既存のcatalog・投影・Instance・constraint rebinding・Document ID ownerを共有する。下書き・Session・rollback・queryの所有者は変更せず、同じSessionを各入口から利用する。host捕捉はworkspace.capture→viewport.snapshot、復元はworkspace.restore→既存activateEditingScope→viewport.updateを維持し、model alias／Solverの切替とread cache無効化は従来app入口へ委譲する。viewportは後段生成のためgetterで操作時に読み、生成時のscope／registry／採番／履歴操作は追加しない。app.jsは3,549→3,533行（16行減）、今回の再開から3,652→3,533行（119行減）。

構文562ファイル・単体1,615件・関連E2E199件（2.9分）が成功（全runner exit 0）。関連はblocks／block-geometry-fixed／unified-ui／free-instance／derived-selection-copy／hatching／parameter-dialog-controllerで、file URL起動、入れ子編集、取消、拘束、Parameter、複写、保存再読込を確認した。新単体5件は生成時の遅延と現在registry、入れ子のhost配列・viewport・独立履歴、実Geometry clone／apply／取消でのObject同一性とrevision、stageChildrenのregistry復元と共有query、host捕捉失敗の停止位置を確認する。この単位で全E2Eと性能fileは未実行であり、前単位の結果を最新コードの全件成功として流用しない。最終main反映前には最新コードで全体検証する。ログは一時ディレクトリのcad-block-feature-{check,unit,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。mainは5ee5f3fを維持し、全体目標は未完了。次は同じBlock編集ownerを使うBlockDefinitionCommand／BlockCompletionCommandの生成・接続を分析する。開始・取消・確定の各責務は既存commandに維持し、host捕捉、定義反映、scope復帰、確認dialog、Solver／Parameter安定化、履歴と例外の順を保つ。choiceDialogやBlockViewは後段に生成されるため、生成位置とcallback参照時点を先に確認する。編集stateをもう一組作ったり、callbackを巨大contextへ束ねたり、UI仕様／失敗時の復元範囲を変えたりしない。

### 前単位のGeometry readサービス

前単位はdb8ef55をdevelopの2c89a9cへ統合・Push済み。今回はcodex/geometry-read-servicesで継続した。週枠使用8%／残量92%で停止条件には達していない。

GeometryReadServicesへBlockCatalog／InstanceProjection／BlockProjection／GeometryReadModelとGeometry・Dimension・Annotation Appearance queryの生成・接続を集約した。固定containerから既存ownerのAPIを返し、modelやcacheを複製しない。同期read窓と外観memoはGeometryReadModel、Block投影cacheはBlockProjectionに残す。Geometryのworkspace.current、Dimension／Annotationの従来model aliasを読むcurrentSketches、DocumentのBlock registryを別々の入口として維持する。Hatchの解決とprimitive照会は注入し、空間照会・Annotation描画・選択やcommand状態は取り込まない。生成時のscope／view／profile読取りを追加せず、後段の依存は操作時に解決する。app.jsは3,562→3,549行（13行減）、今回の再開から3,652→3,549行（103行減）。

構文560ファイル・単体1,610件・関連E2E205件（2.9分）・性能file全12件（48.1秒）が成功（全runner exit 0）。関連はunified-ui／blocks／sketch-projection／derived-selection-copy／free-instance／hatchingで、file URL起動、投影参照と継承、Block編集、複写、保存再読込を確認した。パンは166msで元の175ms未満の基準内。新単体5件は生成時の遅延、現在registry、実Block／派生投影のObject・参照同一性と入れ子read窓、外観と別のSketch読取り源、同一IDでのscope／定義置換と無効化、Hatch解決の委譲を確認する。新しいfixtureは既存の先祖Sketch制限・parentSketchId・注記継承の形式に合わせ、製品側の規則は変更していない。このコードで全E2Eは未実行。最終main反映前には最新コードで全体検証する。ログは一時ディレクトリのcad-geometry-services-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。mainは5ee5f3fを維持し、全体目標は未完了。次はBlockDefinitionEditing／BlockEditorSession／BlockEditingQueriesの生成依存を確認する。現在のread owner、Document IDs、constraint rebindingと共有される入口を使い、下書きとSessionの接続をまとまった責務へ寄せる。viewportを含むhost捕捉／復元、activateEditingScopeのread cache無効化、履歴／失敗復元と採番の時機を維持する。共有ConstraintRebindingやモデル切替を無断でBlock専用へ移したり、早期callbackで後段constを直接捕捉したりしない。

### 前単位のUI更新調整

前単位は294a03bをdevelopのc1119cfへ統合・Push済み。今回codex/application-refreshで継続した。週枠使用7%／残量93%で停止条件には達していない。

ApplicationRefreshへ通常UI更新、Geometry選択更新、Sketch／Properties更新のprofile境界を集約した。Annotation resize選択の同期、Parameter名前空間の準備、refreshAnalysis省略指定、Document名／Toolbar／Tree／Block／Properties／Status／拘束button／翻訳／寸法入力とProperties inertの順序を保つ。選択更新は解析やTree全再生成を行わず、Block dialogが開いている場合だけBlock表示を更新する。appのhoisted入口から委譲し、後段で生成するview／AnnotationDrag／dimension inputは操作時に読取り、生成時には実行しない。新たなmodel／cache／sessionや共通resetは作らない。app.jsは3,591→3,562行（29行減）、今回の再開から3,652→3,562行（90行減）。

構文558ファイル・単体1,605件・関連E2E163件（2.3分）・性能file全12件（47.9秒）が成功（すべてexit 0）。関連はunified-ui／blocks／sketch-permissions／parameter-dialog-controller／command-panel／annotation-display-sizeで、file URL起動も確認した。パンは149msで元の175ms未満の基準内。新単体4件は生成時の遅延、現在の名前空間と選択の更新、選択更新の範囲／dialog条件、ui／tree／propertiesのprofile包含、DOM不在と例外時の停止境界を確認する。最新コードで全E2Eは未実行。前単位の失敗履歴とその後の関連検証を区別し、最終main反映前には最新コードで全体検証する。ログは一時ディレクトリのcad-application-refresh-{check,unit,related,performance}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。mainは5ee5f3fを維持し、全体目標は未完了。次はGeometryのread側の生成・接続を分析する。BlockCatalog／InstanceProjection／BlockProjection／GeometryReadModelとGeometry／Dimension／Annotation appearance queryの共有依存を確認し、実際のownerのAPIをまとめる方向で検討する。HatchやAnnotationの空間照会・描画依存まで無条件に一体化せず、currentScopeと従来model aliasを読む時機、read cacheの寿命／無効化、既存Object同一性を維持する。巨大なmutable contextへ移すだけの変更を避ける。

### 前単位の寸法外観受渡し

Geometry dragはb6bae17をdevelopの36e4216へ統合・Push済み。比較用worktreeはarchive済みで、C:/dev/cadのみが作業中。今回codex/pan-draw-queriesで継続した。週枠使用6%／残量94%で停止条件には達していない。

寸法外観の解決と描画への受渡しを整理した。DimensionPresentationのlayer／Selection boundsが解決した外観をラベルと線形／角度painterへ渡す。GeometryAppearanceQueryは表示値の整形をdimensionDisplayStateForAppearanceへ分離し、既存のqueryと解決済み外観の両方から共有する。描画間cacheは作らず、次のdraw、Document／Sketchの外観変更、同一IDの別Objectやscope置換を新しく評価する。従来の単独label／painter／previewの呼出しは外観が渡されなければ従来どおり取得する。描画順・可視性短絡・PNG flags・Canvas状態・precision／affix／公差・保存形式は維持する。app.jsは3,591→3,591行（0行変化）。

構文556ファイル・単体1,601件・関連E2E157件（2.2分）・性能file全12件（48.4秒）・固定3回の性能case（9.9秒）が成功（すべてexit 0）。関連はunified-ui／dimension-prefix／png-export／drawing-order／phase0-characterization／unified-annotationsで、既存画面比較も含む。パンは全性能実行で131ms、固定3回は151／150／135msで元の175ms未満の基準内。基準や期待値は変更していない。最新コードで全E2Eは未実行であり、前単位の583成功・1失敗を全成功へ書き換えない。最終main反映前の最新コードで全体検証する。

変更前のCPU診断は同じ選択／削除／Undo／Redo／ツリー展開／zoom後に3回実施し、normalizeDimensionAppearanceの重複解決を主な負荷として観測した。変更後も描画4回を維持し、合計描画時間は変更前47.6／41.7／39msに対して42.5／35.7／36ms。診断全体の時間にはばらつきがあり、Profiler計測をE2E合格の代用にしない。診断scriptとbefore／afterログは一時ディレクトリのcad-pan-fullstate-profile.cjsとcad-pan-fullstate-{before,after}.log。検証ログはcad-dimension-appearance-{check,unit,performance,pan-repeat,related}.log。全runnerの終了を回収済み。

この単位をCommit／Pushしてdevelopへ統合する。mainは5ee5f3fを維持し、全体目標は未完了。次はapp内のupdateUI／updateGeometrySelectionUIの更新進行を分析し、Annotation選択の同期、Parameter名前空間の準備、解析更新の省略指定、各viewの更新順・Propertiesのinert、profileの種別を保つ所有者へまとめる。DOM表示とmodel編集を混ぜず、巨大contextや一律resetへ統合しない。

### 前単位のGeometry drag

前単位は2b9144fをdevelopの54fbaf1へ統合・Push済み。今回はcodex/geometry-drag-compositionで実装した。週枠使用5%／残量95%で停止条件には達していない。

GeometryDragFeatureへGeometryDragSolver／GeometryDragPlan／GeometryDragEditing／GeometryDragと派生Instance entryの生成・接続、preview／finishのprofile接続を集約した。appはbuild／prepare／preview／finish／beginDerivedとcommand／targetConstraintCountを共有し、Annotation／Block／テスト支援も同じ入口を使う。数値進行のWeakMap、snapshot、入力session、復元／onEnd／historyは既存ownerに残し、計算方法・許容値・保存形式・UIを変更していない。app.jsは3,622→3,591行（31行減）、今回の再開から3,652→3,591行（61行減）。

構文556ファイル・単体1,600件は成功（exit 0）。全E2E584件は583成功・1失敗（25.7分、exit 1）。失敗はmiddle-button-pan 178ms（基準175ms未満）。航空機は全96経路・1,872previewを7.5分で成功（最大276.9ms、失敗0）。フィレット3,744preview・オフセット10,296previewも成功した。全体結果を回収後、変更前54fbaf1の独立worktreeと現在版で同じ性能caseを固定3回ずつ順番に比較し、両版とも2成功・1失敗。変更前panは163／177／162ms、現在版は160／150／183msだった。変更前にも同じ基準超過が存在し、panは変更のないCanvasNavigation／Canvas描画経路を通る。今回の分離だけが原因とは判断できないが、全テスト成功や性能問題解消とは扱わない。期待値・性能基準は変更していない。

ログは一時ディレクトリのcad-drag-feature-{check,unit,full-e2e,baseline-performance,current-performance}.log。全runnerの終了を回収済み。新単体5件は遅延読取りとscope置換、実際のplan〜commandによる座標更新と履歴、失敗復元、権限／投影拒否、派生座標変換、例外時のprofile／onEndを確認する。

変更前でも再現する性能問題を明記して責務分離をCommit／Pushしdevelopへ統合する。mainは5ee5f3fを維持し、全体目標は未完了。比較用managed worktreeは検証完了後archiveする。次はpan描画の重複正規化・照会とDOM更新の負荷を測定し、結果に基づいて責務境界を整理する。成功するまで同じテストを再実行すること、基準緩和、描画省略や動作変更で合格させることは避ける。最終main反映前には最新コードで必要な全体検証を行う。

### 前単位のSketch投影

週枠使用2%／残量98%への回復を確認し、5ee5f3fでlocal／originのmain・developの同期とcleanを確認してcodex/sketch-projection-interactionで再開した。現在の週枠は使用3%／残量97%。全体目標は未完了で、停止条件には達していない。今回の単位は作業branchをCommit／Pushしdevelopへ統合・Pushする。mainは停止条件到達時の最終検証後に反映する。

SketchProjectionFeatureへ投影元query／commandの生成・接続、矩形候補取得、旧投影拘束の形状編集guardを集約した。shared queriesと読込時editingは従来の初期化位置・所有者を維持する。source factoryはcommandと同時に生成するがscope等を読まず、後段のoperand変換と矩形照会は操作時に委譲する。staged sources、重複・coverage判定、確定時の再照会、取消・履歴、Sketch権限の短絡と共有node判定、文言、保存形式は変更しない。巨大contextや新cacheは追加していない。app.jsは3,652→3,622行（30行減）。

構文554ファイル・単体1,595件・関連E2E140件が成功（全runner exit 0、E2E1.7分）。関連はsketch-projection／sketch-projection-compatibility-driver／sketch-permissions／command-panel／unified-uiであり、file URL起動も含む。このコードで全E2Eは未実行。新単体4件は遅延依存とscope置換、source共有と確定のObject同一性、権限短絡／共有node／稼働判定、確定時coverage再確認／取消を確認する。ログは一時ディレクトリのcad-projection-feature-{check,unit,e2e}.log。

前単位終了時の候補はGeometry dragのplan／solver／editing／commandの組立て境界だった。buildDragSession／prepare／preview／finishはAnnotationやテスト支援にも共有され、profile処理とCanvas pointerの開始終了も接続されている。共有先・初期化順・失敗復元と履歴の所有を保ち、別の巨大contextへまとめない。現在のSketch投影query／旧形式修復を再分離するだけの変更も避ける。

### 前回の停止・リリース（2026-10-16）

週枠使用51%／残量49%を確認し、指定の停止条件に達したため新たな分離を停止する。この区切りのmain反映と同期を完了して目標を一時停止し、クレジット回復後に再開する。全体目標は未完了。app.jsは今回の開始3,949→3,652行（297行減）。直近の所属照会と寸法描画の整理は3,652→3,652行（0行変化）であり、数百行のcomposition rootへ収束したとは扱わない。

コード最終commitはaa9e3af、develop統合commitは1be84e3。旧入口・未使用alias、Selection／表示照会、Annotation、拘束確定、Toolbar、Tree hover、Canvas描画、Offset／Fillet／Trimの機能組立てを整理した。さらにSketchContextの正規化と所属照会、ConstraintAnalysisの照会入口、寸法描画内のActive判定の責務を整理した。UI・求解方法・保存形式、テストの期待値・性能基準は変更していない。Solverループの試作は取り下げ済み。現在の責務と依存はimplementation-map.mdと正式なモジュール構成を参照する。

最終コードで構文552ファイル・単体1,591件・全E2E584件が成功（すべてexit 0、全E2E23.7分）。全E2Eはdevelopの1be84e3で一括実行し全件成功を確認した。aa9e3afと1be84e3のファイル内容は同一であり、構文・単体も同じコードの結果。以前の失敗や部分検証だけを最終結果として流用していない。航空機は96経路・1,872previewが7.1分で成功（最大237.2ms、失敗0）、パンは164msで175ms未満の基準内。全runnerの正常終了を回収済み。ログは一時ディレクトリのcad-dimension-draw-{check,unit}.logとcad-dimension-release-final-e2e.log。

最終検証後はこの停止／リリース記録以外の実装変更を行わない。この記録をdevelopへCommit／Pushした後、元の明示的な指示に従いmainを最後に反映・Pushする。直ちにdevelopへ戻りmainへfast-forward・Pushし、local／originのmainとdevelopを同期する。codex/composition-entry-audit、codex/constraint-status-observation、codex/dimension-draw-queriesは取り込みを確認してローカル・リモートとも削除し、runtime-version.jsを再生成する。不合格のままリリースする例外判断は不要になった。

再開時はGitの現物、usage、worktree、origin/main／developと祖先関係を確認し、最新developから新しい作業branchを作成する。終了済みbranchを再使用しない。次の候補はSketch Projectionの生成・接続の境界。appのquery（早期）／command／source照会／editing（後段）は生成位置と共有先が異なる。queriesは他機能から使われ、commandはmodel、editingはworkspace.currentを参照する。初期化順とcallbackの参照時点、共有query／保存・編集からの利用先を先に分析し、単に全部を一つのFeatureへ移さない。すでにBasicDrawingToolsへ分離したCenterlineの再分離、巨大mutable context、別の巨大app、行数だけの薄いdelegate分割を避ける。

### この区切りの調査・検証履歴

以下はリリース前の各時点の記録である。「main保留」「未解決」「回答待ち」等は当時の状態であり、現在の最終結果は上記の一括全件成功を参照する。失敗と切り分けの経緯を調査可能にするため保持する。

local／originのmainとdevelopが4859400で同期・cleanであることを確認し、codex/composition-entry-auditで再開した。今回の16単位で旧入口／未使用alias、Selection／表示照会、Annotation、拘束確定、Toolbar、Tree hover、Canvas描画、Offset／Fillet／Trimの機能組立てを整理した。app.jsは3,949→3,652行（297行減、直近Trimは3,658→3,652で6行減）。全体の数百行への目標は未完了。

TrimはTrimFeatureへquery／editing／commandの組立てを集約し、テストfixtureの接続はTrimTestDriver.createFeatureへ分離した。現在scope／倍率と7／倍率のhit幅、Point／寸法拘束の転送、checkpointと失敗段階の復元、既存hookを維持する。構文552ファイル・単体1,587件・読込E2E1件・関連E2E143件成功（142件1.9分＋性能1件4.5秒）。ログはcad-trim-feature-{check,unit,loader-e2e,e2e,performance-e2e}.log。

#### 最新の寸法描画の修正（codex/dimension-draw-queries）

2fa864bの検証結果を110bd4aとしてdevelopへ保存した後、DimensionPresentation.createLayer.drawで同じconstraintのActive判定を何度も取得する箇所を整理した。ObjectをキーにしたMapをdraw内で作り、sort comparatorと色判定に必要な時だけ取得し共有する。draw終了後は保持しない。元のconstraints配列をそのままin-place sortし、非active→activeの安定順、非表示対象の短絡、PNG時flags、Canvas save／restoreと例外処理は変更しない。Sketch切替・Active変更・同一IDの別Objectは次の描画で新しく評価する。app.jsは3,652→3,652行（0行変化）。

構文552ファイル・単体1,591件・関連E2E129件成功（exit 0）。関連はunified-ui／dimension-prefix／png-export／drawing-order117件1.5分、adversarial-authoring-performance全12件48.1秒。パンは161msで元の175ms未満の基準内に入った。テストの期待値や基準を変更していない。ログはcad-dimension-draw-{check,unit,related-e2e,performance-e2e}.log。全E2Eはこの単位では未実行。作業branchをCommit／Push後developへ統合し、最新コードで全体検証を行う。全体検証が成功した場合は元のmain反映指示に従いmainへ最後に反映する。以前の失敗履歴を消さず、最新結果を区別する。

#### 最新developの全体検証結果（2fa864b）

コード最終d66a231をdevelopの2fa864bへ統合・Push済み。main／origin/mainは4859400のまま。最新developで構文552ファイル・単体1,590件成功（exit 0）。全E2E584件は583成功・1失敗（24.0分、exit 1）。航空機は全96経路・1,872previewを7.2分で成功（最大260ms、失敗0）。以前の航空機timeoutは最新全体実行で再現していない。失敗はadversarial-authoring-performance.spec.jsのmiddle-button-panが176ms（175ms未満が基準）だった1件。

コード・基準を変えず、同じ性能file全12件を一度再確認すると11成功・1失敗（49.5秒、exit 1）。同じmiddle-button-panが181msで失敗した。直前のd66a231で同file全12件が成功したことと混同せず、最新の全体実行と再確認は不合格として記録する。d66a231と2fa864bのapp／src／tests／index／tools／specに差分がないことも確認済み。ここから成功するまで同じテストを繰り返さない。全検証成功やmain反映完了とは扱わない。

ログはcad-release-membership-final-{check,unit,e2e}.logとcad-release-membership-performance-rerun.log。各runnerの終了を回収済み。週枠使用49%／残量51%。app.jsは3,652→3,652行（0行変化）。コードの未コミット変更なし。今回の追加変更はこの検証記録のみ。

短いパンのCPU診断5回は127／90／111／123／113msで、各回4回のpreview描画を観測した。2回目以降の描画合計は約43〜44ms。主なCPU処理は寸法外観の正規化とSketchHierarchy.ensure。元のE2Eの選択／削除／Undo／Redo／Tree展開後とは直前状態が異なるため、この診断の成功をE2Eの合格に代用しない。scriptは一時ディレクトリのcad-pan-cpu-profile.cjs、ログはcad-release-membership-pan-profile.log。

次はDimensionPresentation.createLayer.drawのsort comparatorが同じisActiveSketchConstraintを何度も呼び、その先でSketch全体の正規化を繰り返す箇所を分析する。候補は描画ごとに必要なActive判定を一度取得してsort／色判定で共有し、次のdrawで再評価する方法。まだ実装していない。既存constraints配列へのin-place sort、非active→activeの安定した描画順、非表示の短絡、export時のflags、Canvasのsave／restoreと例外時の挙動を維持し、描画中にSketchが切り替わらない前提も確認する。mainは失敗を残した反映への判断待ちとして保留する。

#### 最新の修正と検証（codex/constraint-status-observation）

所属照会の重複取得整理93124c8に続き、SketchContext.membershipQueryでscopeの正規化と要素ごとの所属読取りを分離した。元のelementSketchIdと共通resolverを使い、直接ID／端点／中心／Spline fitPoint／現在Sketchへのfallbackの優先順を維持する。Queryは現在Sketchのfallbackを同期照会単位で捕捉し、次の解析・状態照会では新しく取得する。ConstraintAnalysisは参照有効性の更新後、ConstraintTestDriverは解析更新後に取得し、appはreadSketchMembershipとして接続する。通常のelementSketchIdの正規化順やSolverの数値計算・保存形式は変更しない。app.jsは3,652→3,652行（0行変化）。

構文552ファイル・単体1,590件・関連E2E168件成功（すべてexit 0）。関連はunified-ui／blocks／head-symmetry144件2.2分、sketch-permissions11件11.2秒、航空機1件9.2分、adversarial-authoring-performance全12件55.2秒。航空機は96経路・1,872preview、最大295.3ms、失敗0で元の600000ms制限内に完了した。短い2経路でもelapsedMs以外の全resultが93124c8と一致。ログはcad-membership-query-{check,unit,related-e2e,permissions-e2e,aircraft-e2e,performance-e2e}.log、cad-analysis-membership-aircraft-sample.log。この単位では全E2E未実行。

Solverの内側ループ整理も試作したが、単独の行列ベンチ改善が約2〜3%に留まり採用しなかった。行列2,012件と独立性判定100件で旧結果と一致したが、Solver sourceは93124c8と同一へ戻した。数値アルゴリズムやテスト基準の変更で合格させていない。

以前の失敗は下記の履歴として保持する。現在は同じ2ケースの成功を最新コードで確認できたため、作業branchをCommit／Pushしてdevelopへ統合し、最新の全体検証へ進む。全検証が成功した場合は不合格のままリリースする例外判断を必要とせず、元の明示的なmain反映指示に従いmainを最後に反映する。全体の数百行への目標は未完了。

#### origin/main反映前の検証で保留（2026-10-16）

ユーザーのorigin/main反映指示により、コード最終commit80771ffをdevelopの77e4e19へ統合しPush済み。main／origin/mainは4859400のまま。作業branch codex/composition-entry-auditは80771ffで保持する。全体目標は未完了であり、mainへのリリースも未完了。

最新develop 77e4e19の構文552ファイル・単体1,587件は成功（exit 0）。全E2E584件は582成功・2失敗（31.2分、exit 1）。失敗はadversarial-authoring-performance.spec.jsの「selection, deletion, undo and redo stay responsive on the complete fixture」がselection/blank-rectangle 266ms（基準250ms未満）、constraint-drag-regressions.spec.jsの「aircraft A2 and A3 respond at multiple locations without freezing or losing constraint status」が600000ms timeout。後者はloadのconstraintStatusesForTestをpage.evaluateしている時点で時間切れとなった。

同じ最新コード・同じ基準で失敗2件を再実行して両方失敗（性能はselection/line-pointerdown-up 150ms、基準150ms未満。航空機は同じtimeout）。cleanな前回main 4859400へ一時checkoutし同じ2件を比較実行すると両方成功（9.9分、航空機9.8分、性能のblank-rectangle 249ms・line-pointerdown-up 147ms）。developへ戻しruntimeを再生成して同じ2件を再比較すると両方失敗（性能189ms、航空機10.0分timeout）。コードやテスト基準はこれらの検証中に変更していない。前回版も上限付近だが、最新側で失敗が続き、今回との差分が原因でないとは確認できていない。全成功や既存不具合と断定してはならない。

ログは一時ディレクトリのcad-origin-main-oct16-final-{check,unit,e2e}.log、cad-origin-main-oct16-failed-rerun.log、cad-origin-main-oct16-baseline-comparison.log、cad-origin-main-oct16-current-comparison.log。各runnerの終了結果を回収済み。検証後の変更はこの記録のみ。

追加の切り分け（週枠使用45%／残量55%）では、製品コードやテストを変更せず一時診断を実行した。選択の同じ既存E2Eを固定3回ずつ比較すると前回mainも3回失敗（line-pointerdown-up 219／222／215ms）、最新developも3回失敗（231／215／249ms、いずれも150ms未満が基準）。したがってこの性能失敗は最新差分だけで発生するものではない。CPU profilerを使う別の短い診断でも両版の主な処理は寸法外観の正規化、描画、拘束解析であり、計測自体の負荷もあるため通常E2Eの代替合格結果とは扱わない。

航空機はA2／A3のfraction 0.2、x方向0.5のslow反転経路（各30preview）を同じhookで比較した。elapsedMsのみを除いた全result（全previewの形状・求解結果・拘束状態と最終形状）がJSONで完全一致し、初期拘束状態も完全一致、両版とも失敗previewは0。短い2経路の一致を全96経路の検証に代用しない。最新側の各dragは9,824／9,909ms、前回版は7,978／7,693msで、今回側が遅い計測も得られた。一方、独立した初期拘束状態照会3回は最新436／340／324ms、前回388／408／367msであり、一つの処理の一律な回帰とは特定できていない。航空機全ケースのtimeout原因は未解決。閾値・コード・テスト期待値を変更していない。app.jsの行数は3,652→3,652（0行変化）。

追加ログはcad-{baseline,current}-selection-repeat.log、cad-{baseline,current}-refactor-profile.log、cad-{baseline,current}-aircraft-sample.log（いずれも一時ディレクトリ）。診断scriptも一時ディレクトリのcad-refactor-profile.cjsとcad-refactor-aircraft-sample.cjsで、repositoryには含めていない。全診断processは終了を回収済み、checkoutは最新developへ戻してruntimeを再生成済み。

追加調査から、codex/constraint-status-observationでConstraintTestDriver.createStatusObservationの現在Sketch取得を解析更新後の一度へ整理した。従来はstatus要素ごとのfilterでactiveSketchIdを呼び、SketchHierarchy.ensureによる全Sketch正規化を繰り返していた。同じ同期照会内では対象Sketchは変わらないため、照会ごとに取得し次の照会では更新し直す。通常UI／Solver／保存処理・全返却status・テストの期待値と10分制限は維持する。app.jsは3,652→3,652行（0行変化）。構文552ファイル・単体1,588件・同じ照会を使う対称拘束／短円弧再読込E2E3件成功（4.2秒、exit 0）。照会更新後のSketch取得、照会間の解析／Sketch交換、返却値の独立性を単体で追加確認した。

同じ航空機2経路は修正前の9,824／9,909msから7,194／6,746msとなり、計測時間を除いた全resultは完全一致した。ただし元の航空機全96経路を再実行すると、今回も600000ms timeout（10.1分、exit 1）。停止時点はgeometryDragPathForTestのpage.evaluate中。この変更はcodex/constraint-status-observationへ保存し、develop／mainへは未統合として保持する。局所的な重複取得整理だけでは全ケースの時間超過を解消できなかった。全成功や原因解決とは扱わない。ログはcad-status-observation-{check,unit,related-e2e,aircraft-e2e}.logとcad-status-observation-aircraft-sample.log。全runner終了を回収済み。前回までの比較結果と失敗記録も保持する。

当時、原因調査のためmainを保留するか、不合格結果を記録して反映するかを質問した。未回答のため、不合格のままmainへ反映する判断は行わない。最新コードの全検証が成功した場合は、元の明示的なmain反映指示に従う。今回のCommit／develop Pushとmain反映の成否を区別する。調査継続時は新たな責務分離を始めず、selection操作の描画／UI時間と航空機の拘束状態照会を現物比較して原因を絞る。閾値を上げるだけの対応や、繰り返し成功するまで実行して失敗を隠す対応をしない。必要な修正はdevelopから作業branchを作成し、既存の区切りの履歴を保持する。mainへリリースできた後はdevelopをmainへfast-forwardして両者をPush・同期し、統合済み作業branchを削除、runtimeを再生成する。

責務分離の次の候補は、状態所有と依存を明示できる機能単位から選ぶ。巨大mutable contextや別の巨大appへの移動、行数だけの薄いdelegate分割を避ける。

### 直前のリリース（4859400）

ユーザーのorigin/mainへの反映指示により、codex/reference-image-featureの20単位をdevelopの1bfffa2へ統合・Pushした。コード最終commitは16090aa。app.jsは4,143→3,949行（194行減）。Reference Image入力、Canvas表示操作、Keyboard入力、基本作図の生成・接続、drag補助状態、Sketch切替reset、拘束適用、端点生成などの責務を既存ownerへ整理した。UI／操作／保存形式の仕様は変更していない。全体の数百行への目標は未完了。

最新developの1bfffa2で構文546ファイル・単体1,542件が成功。全E2E584件を実行し、初回は583件成功・1件失敗（26.0分、exit 1）。失敗はadversarial-authoring-performanceのmiddle-button-panが175ms未満の基準に対して175msだった。コード・基準を変えず同file全12件を再実行し、すべて成功（1.2分、exit 0、当該操作160ms）。したがって全ケースの成功を確認したが、一括実行が初回から全成功だったとは扱わない。ログは一時ディレクトリのcad-origin-main-final-{check,unit,e2e}.logとcad-origin-main-performance-rerun.log。テスト本体／worker終了後に専用port8784サーバーだけの終了待ちが残ったため、親子processとcommandを確認してそのサーバーだけを終了し、各runnerの終了結果を回収した。最終検証後はこの記録以外の実装変更を行っていない。この記録をCommit／Push後、mainを最後に反映・Pushし、developをmainへfast-forward・Pushしてlocal／originの両branchを同期する。統合済み作業branchを削除しruntimeを再生成する。

次回は最新developから新しい作業branchを作成する。終了済みcodex/reference-image-featureは再使用しない。次は分離後に残った未参照の旧入口を監査する。node_modules/playwright/lib/transform/babelBundleのbabelParse(code,filename,false)とtraverseでapp IIFE scopeを調べ、未参照140binding中FunctionDeclaration候補16件を確認済み。変数initializerの副作用と区別し、自動一括削除せず関数／依存を現物で検証する。局所scopeと公開hook／コールバック、動的参照の有無を確認し、現役ownerを再分離するだけの変更を避ける。巨大contextや異なる操作の単一stateへの統合を避ける。

### 直前のリリース（2026-10-16）

ユーザーのmain／origin反映指示により、この区切りをリリースする。07024cbを基準にcodex/parameter-edit-guardで16個の責務単位を整理し、コード最終commitはdde227e、develop統合commitは91d532c。app.jsは4,459→4,143行（316行減）。Parameter削除guard、Document下書き／Canvas reset、採番状態、Parameter／外観／PNG／Documentファイルの機能組立て、Offset・Sketch投影・Annotation・Dimension・Blockのテスト支援生成と公開API対応を整理した。

最新developの91d532cで構文536ファイル・単体1,480件・全E2E583件が成功（すべてexit 0、全E2E24.6分）。拘束drag回帰fileは12.5分。ログは一時ディレクトリのcad-refactor-oct16-final-{check,unit,e2e}.log。全runnerが正常終了し、検証後はこのリリース／再開記録だけを変更した。この記録をCommit／Push後、mainへ最後に反映し、developをmainへfast-forwardして両者をPush・同期する。統合済み作業branchを削除してruntimeを再生成する。

全体の数百行への目標は未完了。次回はGitの現物・usage・worktree・origin/main／developの祖先関係を確認し、最新developから新しい作業branchを作成する。終了済みcodex/parameter-edit-guardは再使用しない。次の候補は残るBlock fixtureとUIイベント登録・mode／command接続。すでに一行のfactory接続をまとめるだけの分割を無理に増やさず、状態の所有・開始／更新／確定／取消の依存を整理できる機能単位を選ぶ。巨大mutable contextや別の巨大appへの移動を避ける。

### 前回の停止地点（2026-10-14）

週枠残量59%で停止条件に達したため新規分離を停止。2026-10-14の再開はdevelop 7a1983eを基準とし、63個の区切りのcommitを保持してcodex/interaction-observationで進めた。app.jsは7,734→4,840行（2,894行減）。コード最終commitは7dc83dc、develop統合commitは883e7ef。描画／PNG一時状態、Canvas表示更新のsnapshot、寸法／Annotation／Geometry表示、command対象／Sketch表示方針、Selection照会／identity更新、投影source／legacy fixture、Instance source、メニュー／toolbar／Document設定と入力、固定／拘束操作、テスト支援を責務ごとに整理した。各ownerと依存はimplementation-map.mdと正式なモジュール構成を参照し、区切りは本書とGit履歴に残す。

最新developの883e7efで構文506ファイル・単体1,391件・全E2E583件が成功（すべてexit 0、全E2E25.2分）。長時間のconstraint-drag-regressions全file（12.8分）を含み、過去の部分検証を最終結果として流用していない。ログは一時ディレクトリのcad-refactor-oct14-final-{check,unit,e2e}.log。全runnerの正常終了後、実体を確認した専用port8784サーバーだけを終了した。最終検証後の変更はこの停止記録のみとし、developへCommit／Pushした後、mainを最後に反映して直ちにdevelopをmainへfast-forward・Pushしてlocal／remoteを同期する。統合済み作業branchを削除してruntimeを再生成し、目標を一時停止する。

全体目標は未完了。app.jsを数百行（目安200〜500行）のcomposition rootへ収束させたとは扱わない。未分離の権限guard／hit方針・mode／command開始や操作調整、UI／描画の残る情報取得と、機能ごとの生成／接続・test hookの組立て整理が残る。再開は最新Gitの現物・usage・worktree・origin/main／developの祖先関係を確認し、最新developから新しい作業branchを作る。終了済みcodex/interaction-observationは再使用しない。次の候補はguardSketchEdit／guardSelectionEdit／canCreateInActiveSketch／rejectRootSketchCreationのguard／通知と、ordinarySelectionMode／hitSketchAllowed／hitElementAllowedの照会。SketchContextの権限規則を変えず、拒否時の無変更、default Sketch／operation、短絡／hintとUI順・callback登録とlate constの参照時点を維持する。巨大mutable contextや別の巨大appへの移動、ただの薄いdelegateの再分割は行わない。

### 前回の停止地点（2026-10-12）

2026-10-11に週枠残量97%で再開し、develop 8e7e7c7からcodex/clipboard-placementを作成した。開始時app.jsは11,058行。現在は7,630行（今回の合計3,428行減）で、全体目標は未完了。週枠残量69%を確認したため新規分離を停止。76個の区切りのcommitを保持し、コード最終commit 8e6fc2aをdevelopのcab7c6dへ統合・Pushして最新全体検証を完了した。この停止記録をCommit／Pushした後、mainへ反映し、直ちにdevelopをmainへfast-forwardして両者をPush・同期する。統合済み作業branchはローカル・リモートとも削除し、runtime再生成後に目標を一時停止する。停止条件と手順はsection 1／6に従う。

Hover表示の観測を既存PropertiesTestDriver.createHoverObservationへ分離。既存Geometry一覧／Block投影・外観・Tree強調／Sidebar／Canvas／Block Hoverと表示色／線幅へ接続し、対象なしのnull、検索・Block内Geometryの優先順／短絡、Pointの投影・線端点除外、同一参照照合・constructionと照会順を保持する。独自Geometry／Hover／表示ルールを追加せず、test query時だけ生成して既存API名へ接続。元の処理本体との一致を確認。app.jsは7,652→7,630行（22行減、今回の合計3,428行減）。構文469ファイル・単体1,261件・関連E2E103件成功（exit 0、2.0分）。新規テストはなく、全利用箇所のunified-ui既存E2EでTree／Canvas強調、Point／Block、色／線幅を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-hover-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

最終検証はdevelopのcab7c6dで構文469ファイル・単体1,261件・全E2E560件が成功（すべてexit 0、全E2E24.8分）。ログは一時ディレクトリのcad-refactor-oct12-final-{check,unit,e2e}.log。全テスト本体とworker終了後に専用サーバーだけの終了待ちが残ったため、processの実体を確認してそのサーバーを終了し、同じ実行の正常終了を回収した。0cf13d4の全E2E560件は以前の区切りの結果であり、今回の最終結果は以降のHover観測まで含む最新コードで再実行したもの。b494ab6時点のDXF保存再読込の失敗も保存完了待機の修正後に成功している。最終検証後は停止記録以外の実装変更を行わない。

Sketch Projectionのテスト支援は用途別に分離済み。Reference Imageの状態／import・Block下書きfixtureも分離済み。寸法Appearanceの状態／描画寸法観測も分離済み。円弧半径の描画plan／終端fit・矢印先端も分離済み。寸法色の描画観測も分離済み。Parameterのfixture／状態照会／編集支援も分離済み。外観／複数Properties／固定のテスト支援も分離済み。Document読込fixtureも分離・全体検証済み。Canvasメニュー選択fixture／候補・Hover観測も分離済み。拘束入力／Intent解決支援も分離済み。Geometry ID選択も分離済み。Sketch移動・表示倍率の観測も分離済み。hit観測／Geometry client位置も分離済み。Hover表示観測も分離済み。再開後の次候補はsnap・作図状態など残るテスト支援と診断、入力・mode変更・command開始の既存所有者の境界。生成／編集／観測の依存を巨大contextへまとめず、共有readTestHistory／readTestSelectedGeometryは用途境界を確認して扱う。独自scope／seq／cacheを追加しない。

既存のSpline／Hatch／描画順／Clipboard／派生Instance／Canvas表示支援・render probe・hit／描画／layout／取消の分離を再細分化するだけの変更は避ける。既存ConstraintIntentResolver／ConstraintSelectionQuery／ConstraintOperands／CanvasSelectionとPendingCommandSession／DrawOperationLifecycleの所有を維持する。旧handleConstraintTargetClickは撤去済み。Document初期化・Sketch切替・削除のreset、EscとCanvasメニュー取消は解除対象と順序が異なるため汎用resetへ統一しない。ParameterApplicationのcheckpoint／回復・安定化・Block伝播と成功callbackの表示例外復元範囲も維持する。reloadSharedVersion19のデータ加工は互換性fixtureに留め、製品migrationへ移さない。

共通mode／DOMへのadapterと、注入依存の多いcommandの生成／接続は残る。状態の所有と開始・更新・確定・取消の入口を揃え、巨大contextを渡した別ファイルへ移すだけにしない。再開時はusage、Git状態、worktree、remote main／developと祖先関係、runtime情報を確認する。終了済みcodex/clipboard-placementは再使用せず、最新developから新しい作業branchを作成して継続する。

### 前回の停止地点（2026-10-10）

週枠残量11%で再開し、残量5%で最終検証・統合の余力を確保するため新規分離を停止。develop 3fc42beを基準にcodex/clipboard-transferで2単位を実装した。ClipboardTransfer（c1dc30c）はID再帰置換・拘束座標移動・Block投影再接続、ClipboardPayload（05eecd3）は依存要素収集・拘束選別・コピー値生成を担当する。app.jsは10,977→10,940→10,834行、合計143行減。全体目標は未完了。

コード05eecd3をdevelopへ統合して最終検証済み。構文390ファイル・単体992件・全E2E441件が成功（exit 0、全E2E23.1分）。ログは一時ディレクトリのcad-refactor-oct10-final-{check,unit,e2e}.log。この停止記録をCommit／Pushし、develop先行・main最後で同期して一時停止する。統合後は作業branchをローカル・リモートとも削除しruntime-version.jsを再生成する。

再開時はusage、Git状態、worktree、remote main／developと祖先関係を確認し、最新developから新しい作業branchを作る。次はClipboard sessionと貼付けtransactionの状態所有を整理する。コピー内容・貼付け回数を単なるgetter/setterとして外へ出すだけでなく、コピー／切取り／貼付け成功・失敗の境界を定める。現在は切取り削除失敗でもコピー内容が残り、貼付け回数はsolveAndRefresh前に更新されcatchで巻き戻らない。診断hookによるpayload代入・クリア・照会も存在する。この既存動作を無断で変えず、保存形式やUIの変更と混ぜない。既に分離したClipboardTransfer／ClipboardPayloadは再抽出しない。最終検証後の新しい実装変更はない。

### 前回の停止地点（2026-10-08）

週枠残量49%を確認したため新規分離を停止。コードの最終commitはa936cc2。今回の再開はdevelop 71b139bを基準とし、15個の責務単位のcommitでapp.jsを11,403行から10,782行へ縮小した（621行減）。数百行のcomposition rootを目指す全体目標は未完了。

今回整理したのは、Sidebar、Centerline開始、円中心十字、拘束後の線の潰れ照会、寸法保存変換、履歴復元、Document適用、外観／Block正規化、寸法配置補正、拘束対象の値変換、求解結果表示、外観／可視性照会、注記Parameter編集、記号削除時の依存照会。責務の配置はimplementation-map.mdとspec/architecture/モジュール構成.mdを参照する。

最終検証は構文387ファイル・単体955件・全E2E413件が成功（exit 0）。全E2Eはdevelop上のa936cc2で21.2分、ログは一時ディレクトリのcad-refactor-oct8-final-e2e.log。今回の最新機能を含む現物を検証しており、以前の369件成功記録を流用していない。この記録をCommit／Pushし、developを先に、mainを最後に反映して両者を同期する停止手順を適用する。

再開時はusage tool、Git状態、worktree、remote main／developと祖先関係を確認し、最新developから新しい作業branchを作成する。旧codex/sidebar-lifecycleは統合完了後に削除する。runtime-version.jsを再生成する。次の候補はClipboardの参照付替え・貼付けtransaction、拘束意図の解決／確定・失敗復元、resetModelStateの操作session所有、描画・入力の組立て、installTestHooksの機能ごとのAPI境界。巨大contextを移すだけにせず、入力／出力と状態所有を先に決める。既に分離したDocumentApplication／BlockState／GeometryAppearanceQueryを再抽出しない。

### 前回の停止記録（2026-10-04）

停止条件を週枠残量50%未満へ変更して再開。現在はC:/dev/cadだけがworktreeで、最新main／developは166169a（Sketchをまたぐ閲覧選択の変更を含む）。これを基準にcodex/rendering-policyを作成した。CanvasThemeColorsへ表示色の純粋な補正計算を分離。開始時app.jsは11,271行、週枠残量42%。分離後は11,232行（39行減）。コードcommitはa66067d。週枠残量39%を確認したため新しい分離を停止し、構文368ファイル・単体882件・全E2E369件（19.7分、exit 0）が成功した。develop・mainへ反映して同期し、一時停止する。次回は最新developから新しい作業branchを作成し、残るDocument適用・描画調整・入力の組立て・診断APIを責務単位で整理する。以前の49%停止記録は前回の区切りとして読む。

### 前回の停止記録

週枠残量49%を確認したため、新しい分離を停止して今回の区切りをリリースする。構文367ファイル・単体876件・全E2E367件（19.8分、exit 0）が成功した。サブエージェントは使用しない。全体目標は未完了であり、数百行へ収束したとは扱わない。次回はGitの現物と最新developを確認し、developから新しい作業branchを作成する。

今回の再開では最新develop 4cc11d8を基準に、Canvas／キーボード入力受付、Esc取消の優先順位、作図開始・取消、Sketch投影draft、Spline編集、Construction切替、実行コミット表示、Documentファイル操作と保存状態表示、参照画像準備・配置を責務単位で整理した。app.jsは12,389行から11,252行へ縮小（1,137行減）。各単位のcommitはGit履歴、検証と行数はcomposition-root.md先頭を参照する。

次回の主な候補は以下。行数のために巨大contextへ移すことは避け、状態の所有者と操作APIを揃えてから選ぶ。

- Documentへの読込適用・求解・履歴・checkpoint・表示調整の進行。FileReaderと置換保護はDocumentFileCommandへ分離済み。
- 描画に渡す情報の構成と共通の表示方針。rendererへDocument更新責務を混ぜない。
- 分離済み入力moduleの生成・接続。各commandが所有するdraftと、appに残るpending sessionやmodeの境界を整理する。
- 共通編集・Document reset／restoreの状態更新。
- 約4,200行のinstallTestHooksと診断API。機能ごとの公開境界を定義し、巨大なclosure依存を別ファイルへ隠さない。

画像準備はReferenceImageImport、配置はReferenceImageCommandが担当する。準備完了時の現在scope・Sketch・viewportを使う既存動作を保持した。DocumentStatusViewは履歴snapshotから状態を表示し、終了・置換保護は実データを照会する。この区別を維持する。

mainは最後に反映し、developとlocal／remoteを同期する。現在のworktreeはC:/dev/cadのみ。統合前には毎回git worktree listで所在を確認する。過去の全E2E327件成功は4ead051時点の証拠であり、今回の検証結果とは区別する。

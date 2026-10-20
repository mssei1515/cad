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

2026-10-08時点、保存読込・描画器・Properties・Sketchツリー・作図command・Instance／Block操作・履歴・ドラッグ・選択・Document適用と正規化を段階的に分離済み。app.jsは10,782行で、入力・操作状態・共通編集・起動接続・診断APIの整理は未完了。最新の検証と再開条件はsection 8を参照する。

各区切りのコミットと検証記録は[composition-root.md](composition-root.md)へ集約する。この文書の「再開地点」は最新の一件に置き換え、過去の未コミット表示や次の候補を積み重ねない。

残る主要な領域は以下。順番や個数は固定しない。

- Block履歴adapter。拘束複製と選択候補照会は分離済み。下書き生成・確定・定義操作・依存照会は分離済みで、残る接続の整理を行う。
- 拘束操作・Selection編集・コピー／削除・Sketch編集の調整。
- ドラッグsession、hover／hit判定、Canvasとキーボードの入力振分け、共通モード遷移。
- Annotation／Reference Image／Hatch等の残る操作状態と編集処理。
- Document操作の進行、履歴adapter、保存読込後のUI・操作状態の同期。
- 描画前の表示情報取得・preview構成など、既存rendererへ渡す情報の整理。
- test hookと診断の公開境界。
- 分離済み機能の組立て方の整理、`app.js`の起動側への収束、全体検証。

「あと何ファイル」や「あと何回」とは見積もらない。まず一つの機能の所有者と依存を揃え、その結果を見て次のまとまりを選ぶ。

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
- originは`https://github.com/mssei1515/cad`。通常の作業branchとdevelopへのPushは継続許可がある。今回の作業branchは`codex/composition-entry-audit`、`codex/constraint-status-observation`、`codex/dimension-draw-queries`。この区切りでdevelopへ統合済みであり、リリース完了時に削除し、再開時は最新developから新しく作成する。
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

## 8. 再開地点（2026-10-20）

### 最新のProperties表示生成単位

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

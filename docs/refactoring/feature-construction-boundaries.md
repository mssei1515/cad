# 機能単位の構築境界の再監査

基準はdevelop `4e80981691158807905f39e4426cd23cbc0f39d6`（2026-11-10）。以下の行番号と数値は、このcommitのsnapshotである。**提案は未実装であり、現在の正式な仕様は変更しない。**

## 残存責務と計測の限界

`node tools/audit-composition-root.js`で、app.jsは1,468行、非空白1,019行、root325文・536束縛。rootの後段可変参照・代入はゼロになった。

| AST分類 | root文数 | 非空白行 |
| --- | ---: | ---: |
| 構築・接続 | 118 | 515 |
| 別名・設定 | 101 | 140 |
| 委譲関数 | 60 | 70 |
| bind呼出し | 16 | 35 |
| startup呼出し | 7 | 7 |
| test hooks | 1 | 202 |
| その他 | 22 | 45 |

分類は構文による。構築・接続にはMath.max等のCallExpressionも含み、118個の独立featureがあるという意味ではない。test hooksの内部生成も、この表では一つのroot文に含まれる。表の非空白合計1,014行とファイル全体との差5行はroot外の構文等である。

即時構文だけの循環はゼロ、遅延参照を含む最大の強連結成分は213文だった。ただし、関数本体内の参照はdeferredSyntaxに分類され、factoryがそのcallbackを同期実行するかまでは証明しない。大きな成分全体を一つのcontextへまとめたり、参照順を自動で変更したりする根拠にしてはならない。

空白除去・小さなdelegateの追加移管だけで200〜500行へ届くとは見積もらない。次は既存featureが複数componentを生成・接続する境界を調べる。最終行数は実装後に測定し、候補の行数を削減予定値として合算しない。

## 三つの候補の比較

root範囲に対する入力は「その範囲外のroot束縛への参照」の重複を除いた数。document・HTMLInputElement等のbrowser globalsは別であり、APIの総引数数ではない。範囲内のcalleeへの参照も入力に含む。

| 候補と範囲 | 非空白行 | root入力 | 外部へ使われる束縛 | 判断 |
| --- | ---: | ---: | --- | --- |
| Canvas pointer構築、app.js:1154–1179 | 22 | 33 | blankCanvasGesture、canvasInputBinding | 次の実装候補。二段階の生成とrootでのbindを保つ |
| Properties panel、app.js:974–992 | 19 | 33 | propertySelection、selectedPropertiesTarget、appearanceEditing、selectionVisibilityCommand、appearanceUI、propertiesView | 現在の段階APIを維持。単一の設定bagへまとめるだけの変更はしない |
| 最終起動、app.js:1461–1467 | 7 | 7 | なし | 現時点ではrootの接続・起動責務として残す |

### Propertiesを先に一括化しない理由

[PropertiesDisplay](../../src/application/properties_display.js)は既にSelection→Editing／Appearance UI→Controller／Viewを所有する。WorkspaceのSelectionとParameter、bound editing scopeのAppearanceという読取りの違いも内部で明示している。

外部の六つの束縛には、Presentation更新、AnnotationのAppearance読取り、可視性操作、Workspace controls、test hooksからの利用がある。三つの生成呼出しを単一factoryに包むだけでは、33個のroot入力やこの六つの出口が減るとは限らない。新しい公開用setterや巨大なcommands bagが必要になる案は採用しない。

### 起動をFileFeatureへ一括化しない理由

[PresentationFeature.createStartup](../../src/application/presentation_feature.js)のinitializeは、UI更新・描画・log、言語／テーマ、runtime version、resize、Canvas surfaceのstartを順に実行する。[DocumentFileFeature.start](../../src/application/document_file.js)はbeforeunloadとstartup documentの読込を開始する。

reset→Presentation→History→file checkpoint→file startをFileFeatureへ移すと、ファイル処理が言語・Canvas起動まで所有することになる。七つの起動呼出しを別ファイルの関数に移すだけの案も目的に合わない。現在のrootが複数featureの起動順を示す構成を維持する。

## 次の実装：Canvas入力の準備と接続

所有先候補は[CanvasInteractionFeature](../../src/application/canvas_interaction_feature.js)のcreateOperationSessions内、既存createEditingInputが返すfeatureである。ここは既に同じLifecycle、Pending、Constraint target、Pointer session、Hover、Selectionと入力componentを結び付けている。

### 現在の順序

1. createEditingInputでAnnotation／Constraint／Instance／通常描画の入力を生成する。
2. authoringTools.createBlankGestureで空白操作を生成し、rootのblankCanvasGestureを初期化する。
3. sceneHitQueries.createInteractionでpress／hover／空白判定を生成する。
4. canvasEditingInput.bindPointerで同じPointer sessionにcontrollerを接続する。
5. CanvasDisplay由来のcreateCanvasInputBindingでcommand panel／PNG routingとnative bindingを生成する。
6. rootのcanvasInputBindingを初期化してからbindする。
7. dimensionInput.bind後、keyboardを生成・startする。

[PointerInteractionController.createSession().bind](../../src/editing/pointer_interaction_controller.js)はcontrollerを生成してsessionへ接続する。一方、[CanvasInputBinding.create](../../src/ui/canvas_input_binding.js)はbind／processMoveを返し、nativeイベント登録は別のbindで行う。この二種類のbindを混同しない。

### 外部利用と公開時点

- blankCanvasGestureは、app.js:358のauthoringのresetBlankCandidate callbackと、app.js:1453のDocument編集resetから使われる。
- canvasInputBindingは、app.js:235のscheduler.readInput callbackから使われる。
- press／pointerHover／isBlankCommandPanelPointは対象範囲内だけで使われる。

空白操作の生成後、queryやpointerの構築中にresetBlankCandidateが呼ばれる可能性も検証する。単一factoryの返却時までrootのblankCanvasGestureを未初期化にすると、従来と異なるTDZが生じ得る。また、native bindingの生成中にイベントbindまで行うと、scheduler.readInputがrootのconst初期化前に呼ばれ得る。

### 提案する二段階API

名称は実装時に確認する。概念は次のとおりで、引数を省略した説明用の例である。

```javascript
const { blankGesture: blankCanvasGesture, createBinding } =
  canvasEditingInput.preparePointerForEditing({
    splineEditing, dimensionValues: dimensionValueCommand,
    annotationInput: annotationInputController,
  });
const canvasInputBinding = createBinding(/* 明示する残りの依存 */);
canvasInputBinding.bind();
dimensionInput.bind();
// keyboardの生成・startは従来位置に残す。
```

前段は実BlankCanvasGestureだけを生成して返す。後段はその同じ実体を使い、Scene interaction→Pointer接続→native binding生成を従来順で行い、未bindの実native bindingを直接返す。rootのconst初期化後にnative bindを行う。

前段は、親が保持済みのauthoring、Lifecycle、Pending、Constraint target、offset、Selection表示更新を使う。後段も保持済みのScene query、Hover、sameArcEndpoint、Instance sourceを使う。残るnavigation・History通知・寸法／式入力・Block入口・query callback、実CanvasDisplay factory、PNG reader、scheduler等は明示入力とする。

実CanvasDisplay factoryは、その場でnative bindingを生成する限定した依存であり、任意factoryの登録・可変contextにはしない。ファイル処理、モデル全体、無関係なcommands、DOMの探索手順を入力featureへ持ち込まない。

### 失敗時に維持する境界

| 失敗点 | 維持する状態 |
| --- | --- |
| 空白操作の生成 | 後段へ進まず、rootの空白操作constは未初期化 |
| Scene interaction生成 | 既に生成・公開された空白操作を取り消さない |
| Pointer controllerの生成・接続 | input = create(...)の成功前は以前のcontrollerを保ち、成功後の後続失敗で自動復元しない |
| native binding生成 | 成功済みのPointer接続を自動で巻き戻さない |
| nativeイベントbind | 新bindingはrootへ返却済み。部分登録や元の例外を隠さない |

## 次単位の検証と採用条件

- 既存createEditingInput／bindPointer／createKeyboardを維持し、raw APIの利用者を巻き込まない。
- 準備・query・pointer・native生成・native bind・dimension bind・keyboard startの相対順を、constructor spyと実sessionの両方で確認する。
- 空白操作・press／hover・Pointer session・native routingのidentityと、元の引数・receiver・返値・例外を新旧比較する。
- 初期化途中のcallback、各構築失敗、native bindの失敗で公開時点と部分更新を比較する。
- Workspaceとbound editing scope、mode／pendingの毎回読取り、pointer flush・PNG／command panelの優先順を維持する。新しいmodel／session／cache／setterを加えない。
- 単体はcanvas-interaction-feature、canvas-command-inputs、canvas-input-binding、pointer-interaction-controller、blank-canvas-gestureを中心に実行する。E2Eは通常描画・空白操作・寸法／式入力・PNG・Hatch／Spline・Block・Undo／Redoを含めて選ぶ。
- APIの明示入力が元の33束縛を別bagへ移すだけになったり、rootの一部が丸ごと別ファイルへ移るだけになったりする場合は実装案を見直す。
- ASTの入出力数は候補選定の材料に限定する。実装後のroot差分、callbackと生成順の証明、機能テスト、app.js行数を別々に記録する。

## この監査単位の検証

製品・テスト・index・検証toolは変更していない。app.jsは**1,468→1,468行（0行変化）**。実装は次単位として残す。

監査toolの既存単体3件が成功した（node --test tests/unit/composition-root-audit.test.js）。監査の再取得、三候補の依存数・出口の再計算、文書リンク、基準commitからの製品・テスト・tool・正式仕様の差分なしも照合済み。TEMP cad-feature-boundary-audit-unit.log／cad-feature-construction-audit-proof.logとgroups JSONに証跡を保持する。直前4e80981の全単体2,342件・全E2E589件成功はそのcommitの証跡であり、今回再実行した結果とは扱わない。

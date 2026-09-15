# app.jsの責務分析

正式な現在の境界は[モジュール構成](../../spec/architecture/モジュール構成.md)。本書は全体の調査結果と、安全な段階的分離の範囲を示す開発資料。

## 全体と集中箇所

分離前の`app.js`は29,297行のIIFEで、次の責務を同じclosureに持つ。

| 責務 | 主な処理・状態 | 結合している相手 |
| --- | --- | --- |
| Document・Sketch | `model`、採番、所属・参照・依存更新、`ensureModelState` | Blockの編集scope、Loader、Solver、履歴 |
| 操作・Selection | `mode`、型別Selection、hover、pending command、作図途中状態、各drag session | Canvas hit test、Toolbar、Properties、編集のrollback |
| Geometry・拘束command | 対象解決、追加、solve、成立判定、失敗時の復元 | Solver、Parameter、Sketch参照、操作状態 |
| Block・派生Instance | Definition／Instance管理、入れ子編集、Projection生成とcache | Documentとlocal履歴、幾何参照、選択・描画 |
| 描画 | viewport、Canvas寸法、寸法配置、Hatch・Annotation・画像、可視性と描画順 | Geometry読出しcache、外観、Selection、拘束解析 |
| DOM・UI | Sketch Tree、Properties、各dialog、localization、theme | 現在のモデル・選択・操作のほぼ全域 |
| 保存・読込 | serialize／load、旧形式移行、picker、書込み、未保存確認 | Document、Constraint codec、名前空間検証、履歴、UI |
| 履歴・計測・検証hook | Document snapshot、Block local snapshot、復元、pointer計測、E2E hook | scopeと操作ごとの確定・復元順 |

とくに`model`、`blockEditSession`、型別Selectionと作図状態、`geometryReadCache`、履歴stackが共通の依存先になっている。UI更新とsolve・履歴記録の呼出し順も暗黙の契約を持つ。巨大なcontextを新moduleに渡すだけではこの結合は解消しない。

## 既存moduleとの役割分担

- `src/geometry/geometry_kernel.js`、`src/geometry/geometry_ref.js`、`src/geometry/spline_geometry.js`、`src/geometry/hatch_region.js`、`src/geometry/offset_chain.js`は幾何計算・参照・領域探索の再利用単位。編集可否やSelectionは所有しない。
- `src/solver/constraint_solver.js`はGeometry／Constraint classと数値solve・解析を持つ。操作の確定／取消、Sketch依存更新は`app.js`側。
- `src/parameters/parameter_engine.js`は式解析と依存評価、`src/persistence/constraint_codec_registry.js`は永続Constraint codec。Document全体の検証・復元は`app.js`側。
- `src/editing/edit_history.js`はstack操作、`src/diagnostics/interaction_profiler.js`は同期計測、`src/ui/choice_dialog.js`は共通dialog。編集scope、snapshot形式、計測対象、確認する時機は呼出し側に残る。

## 分離した範囲と理由

| 境界 | 分離後の所有者 | 安全性と依存整理 |
| --- | --- | --- |
| 外観値・継承 | `src/document/appearance.js` | 既存の規則を値の入出力にする。appは所属とProjectionのlayerを選び、moduleはlayerを解決する。Solver class・DOM・modelを参照せず単体検証できる |
| Sketch内の描画順 | `src/document/drawing_order.js` | Document／Definition、Sketch ID、候補を引数にする。順序補完と4操作が同じ所有者解決を使う。Selectionや履歴をmoduleへ渡さない |
| 保存session | `src/persistence/document_files.js` | 7個の散在した保存状態をsession内部へ集約する。開始・終了・checkpoint更新をAPIに限定し、保存済み内容と履歴／現在の内容の比較を区別する |
| Constraint永続形式 | `src/persistence/constraints.js` | 汎用dispatchから具体的な型とfieldを分離。参照Mapと旧形式変換は読込ごとに渡す |
| Geometry復元 | `src/persistence/geometry.js` | 現Documentへ部分適用しないローカルGeometryとMapを生成。RootとBlockの旧形式の違いは専用入口で維持 |
| Sketch階層 | `src/document/sketch_hierarchy.js` | 同じ階層規則を親子走査・表示行・読込補完で使用。scopeを明示し、操作やConstraint graphを渡さない |
| 補助要素のデータ | `src/document/annotations.js`、`hatches.js`、`reference_images.js` | 正規化・保存field・値検証を各要素の所有者へ集める。既存Objectの同一性を維持し、描画cacheやSelectionと分離 |
| Document snapshot | `src/persistence/document_snapshot.js` | Document／Blockのfield writerを共用。所属とConstraint配置のread adapter、時刻・名前・採番値だけを明示入力にする |

各段階で既存の操作・保存形式を維持し、最後に`app.js`のadapterを接続する。moduleは自分の責務に必要な入力だけを受け取り、`app.js`を参照しない。

## フォルダ構造

```text
index.html / style.css       起動点・固定UI
app.js                      現在の組合せ・編集・UI adapter
src/
  document/
    appearance.js           外観値とlayer解決
    drawing_order.js        Sketch内の順序
    sketch_hierarchy.js     Root補完と階層・参照元・ツリー行
    annotations.js          注記の値と保存field
    hatches.js              Hatchの値・検証・保存field
    reference_images.js     参照画像の値・検証・保存field
  persistence/
    document_files.js       ファイル名・保存session・handle書込み
    constraint_codec_registry.js  型のdispatch
    constraints.js          具体的なConstraint永続形式
    geometry.js             ローカルGeometryの復元
    document_snapshot.js    Document／Blockの保存snapshot
  geometry/                 幾何kernel・参照・Spline・Hatch領域・Offset
  solver/                   Geometry／Constraint classと数値solve
  constraints/              拘束の参照判定・依存Nodeの列挙・寸法の対象と測定
  parameters/               式解析・名前空間の補完と採番・寸法を含む依存評価
  editing/                  履歴stack・Documentと編集scope・Sketch context・Selection
  diagnostics/              処理時間の計測
  ui/                       共通選択dialog・言語／テーマ設定とUI翻訳
tests/
  unit/                     DOMなしの責務別検証
  e2e/                      操作・連携・互換性・Canvas検証
  fixtures/                 共通の図面fixture
spec/architecture/          現在のmodule契約
docs/refactoring/           分析・実装対応・今後の候補
tools/                      server・生成など開発補助
```

分類はファイルの大きさでなく責務に従う。`src/document/`はモデル値の規則、`src/persistence/`は外部保存とsessionの境界とする。既存の計算・補助moduleも同じ分類に揃え、移動は責務分離とは別のcommitにする。新たなbuild／bundle工程を追加せず、通常scriptと明示的な読込順を使う。

## 2026-09-15の継続分析

開始点は`5825453`、`app.js`は28,956行。前回の値・保存sessionの分離後も、永続Constraintの定義、Document／BlockのGeometry復元、Sketch階層の補完と走査は同じclosureに集中している。

今回の境界は次の順に整理する。

1. 永続Constraint：registryのdispatchと具体的な保存仕様を分け、参照Mapと旧形式変換を明示入力にする。寸法の画面配置を確定する処理はappのadapterに残す。
2. Geometry復元：DocumentとBlockのローカルGeometry配列・参照Mapを、現Documentを変更しない復元処理として分離する。旧Point kindや半径の互換処理、エラー文言のscope差を保持する。
3. Sketch階層：Root補完、親子走査、順序と参照元の判定をDocumentの規則へ集める。操作可否、選択、Solver実行はこの境界に含めない。
4. Documentの補助要素と保存snapshot：正規化・保存する値をDOMや編集状態から切り離し、同じ形式を通常DocumentとBlockで再利用する。
5. フォルダ構成：これらの所有者が明確になった後に、既存moduleも責務別の`src/`配下へ揃え、script読込・単体検証・開発tool・仕様書の参照を一緒に更新する。

巨大なcontextやmodel取得callbackで旧closureを再現しない。moduleには対象scopeまたは値と、責務の境界に必要な小さなadapterだけを渡す。移行処理と編集時正規化は適用条件が異なるため、共通化によって旧形式の受理範囲を変えない。

## 残る範囲

`app.js`はまだCanvas renderer、DOM panel、Document Loader、Block・Sketchの操作、Selectionを更新するcommand群とE2E hookを持つ。Documentと編集scopeの所有者は`src/editing/workspace.js`、Selectionの状態と選択規則は`src/editing/selection.js`へ分離した。残りを独立させるには、Projectionの参照解決、操作ごとのsnapshot／確定の境界をさらに整理する必要がある。分離済みmoduleへそれらの状態を流し込まない。

派生InstanceのGeometry読取りviewとscope内の参照解決は`src/geometry/instance_projection.js`へ分離した。Geometryの型・canonical参照・bundleのMap登録は`src/geometry/objects.js`で共通化する。Block Projectionの生成と両者のcache寿命は引き続きappに残り、後続で読出しserviceへまとめる対象とする。

数百行の起動・接続用appへ移行する実現性、代償、段階と進捗は[composition rootへの移行](./composition-root.md)に記録する。

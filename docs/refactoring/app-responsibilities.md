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

- `geometry_kernel.js`、`geometry_ref.js`、`spline_geometry.js`、`hatch_region.js`、`offset_chain.js`は幾何計算・参照・領域探索の再利用単位。編集可否やSelectionは所有しない。
- `constraint_solver.js`はGeometry／Constraint classと数値solve・解析を持つ。操作の確定／取消、Sketch依存更新は`app.js`側。
- `parameter_engine.js`は式解析と依存評価、`constraint_codec_registry.js`は永続Constraint codec。Document全体の検証・復元は`app.js`側。
- `edit_history.js`はstack操作、`interaction_profiler.js`は同期計測、`choice_dialog.js`は共通dialog。編集scope、snapshot形式、計測対象、確認する時機は呼出し側に残る。

## 分離した範囲と理由

| 境界 | 分離後の所有者 | 安全性と依存整理 |
| --- | --- | --- |
| 外観値・継承 | `src/document/appearance.js` | 既存の規則を値の入出力にする。appは所属とProjectionのlayerを選び、moduleはlayerを解決する。Solver class・DOM・modelを参照せず単体検証できる |
| Sketch内の描画順 | `src/document/drawing_order.js` | Document／Definition、Sketch ID、候補を引数にする。順序補完と4操作が同じ所有者解決を使う。Selectionや履歴をmoduleへ渡さない |
| 保存session | `src/persistence/document_files.js` | 7個の散在した保存状態をsession内部へ集約する。開始・終了・checkpoint更新をAPIに限定し、保存済み内容と履歴／現在の内容の比較を区別する |

各段階で既存の操作・保存形式を維持し、最後に`app.js`のadapterを接続する。moduleは自分の責務に必要な入力だけを受け取り、`app.js`を参照しない。

## フォルダ構造

```text
index.html / style.css       起動点・固定UI
app.js                      現在の組合せ・編集・UI adapter
src/
  document/
    appearance.js           外観値とlayer解決
    drawing_order.js        Sketch内の順序
  persistence/
    document_files.js       ファイル名・保存session・handle書込み
tests/
  unit/                     DOMなしの責務別検証
  e2e/                      操作・連携・互換性・Canvas検証
  fixtures/                 共通の図面fixture
spec/architecture/          現在のmodule契約
docs/refactoring/           分析・実装対応・今後の候補
tools/                      server・生成など開発補助
```

分類はファイルの大きさでなく責務に従う。`src/document/`はモデル値の規則、`src/persistence/`は外部保存とsessionの境界とする。既存の計算moduleを一括移動する必要はなく、今回変更しないmoduleのroot配置は維持する。新たなbuild／bundle工程を追加せず、通常scriptと明示的な読込順を使う。

## 残る範囲

`app.js`はまだCanvas renderer、DOM panel、Document Loader、Block・Sketch・Selection、command群とE2E hookを持つ。これらを独立させるには、scopeの取得・変更、Projectionの参照解決、操作ごとのsnapshot／確定の境界をさらに整理する必要がある。今回のmoduleへそれらの状態を流し込まない。次の段階でも、独立した入力・出力を定められる単位から検証を伴って進める。

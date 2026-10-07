# Jot2D リファクタリング方針と再開手順

この文書は、会話やクレジットの継続に依存せず作業を再開するための入口である。ユーザーと合意した方針、未完了の範囲、次の判断基準を保持する。変更履歴は[composition-root.md](composition-root.md)、現在の配置は[implementation-map.md](implementation-map.md)、正式な内部設計は[モジュール構成](../../spec/architecture/モジュール構成.md)を参照する。

## 1. 合意した目的

`app.js`を、UI・モデル・操作状態・描画・保存読込を直接実装する巨大なモジュールから、各機能を生成し、依存関係を接続して起動する側へ近づける。最終的には数百行程度（目安200〜500行）を目指す。

ただし、行数を達成するために巨大な別ファイルへ移したり、細かい関数ファイルを大量に作ったりしない。保守・機能追加・テストがしやすい責務境界を優先する。必要な接続が残る場合は理由を説明し、目標達成を装わない。現在の途中成果をもって全体完了とはしない。

ユーザーは長時間の段階的な実装を許可している。「無理に終わらせる必要はない」「今後の開発に過不足なく良い単位で分離する」が最新方針であり、残りクレジットに合わせて設計を急いだり、分離数を固定したりしない。

最新の目標継続指示に従い、週枠残量50%未満で新たな分離を停止する。停止時は検証・Commit・Pushを済ませ、developの後にmainへ反映して同期する。全体目標や責務境界を縮小しない。

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
| `src/diagnostics/` | 診断・計測。将来、必要に応じてtest hookの境界も整理 | 通常機能を代わりに所有する実装 |
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

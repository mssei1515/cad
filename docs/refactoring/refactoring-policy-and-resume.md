# Jot2D リファクタリング方針と再開手順

この文書は、会話やクレジットの継続に依存せず作業を再開するための入口である。ユーザーと合意した方針、未完了の範囲、次の判断基準を保持する。変更履歴は[composition-root.md](composition-root.md)、現在の配置は[implementation-map.md](implementation-map.md)、正式な内部設計は[モジュール構成](../../spec/architecture/モジュール構成.md)を参照する。

## 1. 合意した目的

`app.js`を、UI・モデル・操作状態・描画・保存読込を直接実装する巨大なモジュールから、各機能を生成し、依存関係を接続して起動する側へ近づける。最終的には数百行程度（目安200〜500行）を目指す。

ただし、行数を達成するために巨大な別ファイルへ移したり、細かい関数ファイルを大量に作ったりしない。保守・機能追加・テストがしやすい責務境界を優先する。必要な接続が残る場合は理由を説明し、目標達成を装わない。現在の途中成果をもって全体完了とはしない。

ユーザーは長時間の段階的な実装を許可している。「無理に終わらせる必要はない」「今後の開発に過不足なく良い単位で分離する」が最新方針であり、残りクレジットに合わせて設計を急いだり、分離数を固定したりしない。

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
| `src/constraints/`・`src/solver/` | 拘束の照会・再接続・求解 | DOMや画面操作の都合 |
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

2026-09-25時点、保存読込の構成要素、描画器、Properties、Sketchツリー、多くの作図command、Instanceの作成・編集、Block配置・構成・UI・編集sessionを分離済み。ただし`app.js`には依然として約1.8万行が残り、全体目標は未達である。

直近で完了した区切り：

- `be80e08`: Block一覧と編集パネルの表示・イベント接続。
- `6c08102`: 親子Blockの編集sessionと復元情報の所有者。
- `a70e9d0`: BlockDefinitionEditingへの複製・座標移動・定義反映の分離。
- `893b14b`: BlockCompletionCommandへの検証・確認待ち・確定処理の分離。
- `32a9bc5`: BlockEditingQueriesと既存BlockCatalogへの照会集約。
- `47c8b07`: 選択からの下書き生成と子定義の仮移動を既存の所有者へ統合。
- BlockDefinitionCommandへ作成・編集開始／取消・定義名変更／削除を集約。最新の確定状況と検証結果は下の「再開地点」を参照する。

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
- 開始時にAGENTS.md、Gitのbranch／status、関連仕様・テストを確認する。既存の無関係な変更を混ぜない。
- 責務としてまとまった単位で実装し、差分を確認し、関連仕様を更新して検証・Commit・Pushする。将来の原因調査で区切りを追える履歴を残す。
- 構文は`npm run check`、単体は`npm run test:unit`。関連E2Eを実施し、全体完了前には全体E2Eも確認する。
- `.test.js`の変更は分離した責務の境界検証や読込一覧の更新に必要な範囲とする。テストの整備だけで分離が進んだことにはしない。
- 新module追加時は`index.html`、`tools/check-syntax.js`、必要なら`package.json`の明示的な単体一覧、`tests/e2e/unified-ui.spec.js`の読込順期待を更新する。script順とapp内の初期化順の両方を確認する。
- E2E実行中にアプリのソースを変更しない。長時間のテストは同じprocess/sessionを追跡し、出力待ちのtimeoutだけで再起動しない。
- 過去の「今回はテストをスキップ」はその時点だけの許可。今後の常時スキップには引き継がない。
- originは`https://github.com/mssei1515/cad`。通常の作業branchとdevelopへのPushは継続許可がある。現在の作業branchは`codex/composition-root-next`。
- 過去のdevelop／mainへのマージ依頼を、新しい変更の自動リリース許可と解釈しない。現在は作業branchで進める。mainへの新たなマージ／Pushは明示指示が必要。
- Commit後には`npm run write:runtime-version`を実行する。生成物はGitに含めない。

全体E2Eは未完了である。過去に航空機図面のドラッグ検証で長時間timeoutがあり、関連する限定E2Eの成功だけで解消済みとも全体成功とも扱わない。Offset問題の過去の判断・修正は履歴に残っているため、古い進捗記録の「未回答」だけを根拠に同じ質問や修正をやり直さない。

## 7. 全体の完了条件

責務が複数ファイルになっただけでは完了としない。以下を現物で確認する。

- `app.js`が主に機能の生成・接続・起動を担い、数百行程度という目標に照らして説明できる構成になっている。
- 状態の所有者と更新APIが明確で、元のglobal依存が別ファイルに移っただけではない。
- UI・動作・保存互換性が維持され、既存テストと必要な全体検証が通っている。
- 仕様と実装配置が一致し、未解決の不具合・未検証項目を隠していない。
- 差分確認、Commit、許可された範囲のPush、実行コミット情報更新が済んでいる。

## 8. 再開地点（2026-09-25）

### 最新の確定区切り

BlockHistorySnapshotへBlock履歴の復元用コピーとsignature生成を分離。session・DOM・履歴stackへの依存を持たず、定義とclone／拘束codecから生成する。旧signature関数の本体一致、コピーの独立性、参照metadata・採番値と差分判定を検証。構文248件・単体503件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,652行。次はDocument／Block共通の履歴復元中状態と復元・UI通知の所有者を整理する。全体目標と全体E2Eは未完了。

直前の拘束複製統合は`d486f1f`で確定済み。実行中のテストはない。以下は直前の記録である。

ConstraintRebindingへBlock拘束の複製と保存済み固定座標の移動を統合。BlockDefinitionEditingへcloneForBlockを直接渡し、appの複製実装への逆依存を除去。クリップボードも同じ固定座標移動を利用する。寸法表示位置・参照metadata・復元不能時の拒否を維持。構文247件・単体501件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,697行。次はBlock履歴snapshotの生成・復元とUI通知の境界を整理する。全体目標と全体E2Eは未完了。

直前のBlockSelectionQuery分離は`bbc64ec`で確定済み。実行中のテストはない。以下は直前の記録である。

BlockSelectionQueryへBlock作成候補の検証と配置中心照会を分離。現在scopeを都度取得し、共有点・注記・ハッチ境界と内部／外部拘束を照会する。2関数の本体一致を確認した。依存の明示で旧未定義constraintLabelForList参照が起動時エラーとなることをE2Eで検出し、既存localizedConstraintNameへ接続して修正。構文247件・単体499件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,726行。次はcloneConstraintForBlockのappへの逆依存とBlock履歴adapterを整理する。全体目標と全体E2Eは未完了。

作業branchは`codex/composition-root-next`。実行中のテストはない。今回の候補照会分離と仕様・読込一覧・単体テストを同じコミットに含める。前の引継ぎに記録した未コミット差分は今回の区切りで解消する。次回はGit状態を確認してから拘束複製の責務を調べる。

以下は直前の確定済み区切りの記録である。

この文書と同じコミットでBlockDefinitionCommandへ作成・編集開始／取消・定義名変更／削除を集約し、BlockViewへ一覧dialog閉鎖と編集classを移した（直前の実装コミットは`47c8b07`）。作業branchは`codex/composition-root-next`。app.jsは17,805行。構文245件・単体494件・Block／統合UI／保存互換E2E151件が成功し、実行中のテストはない。全体E2Eとリファクタリング全体は未完了。

今回の検証コマンド：

```powershell
npm run check
npm run test:unit
npm run test:e2e -- tests/e2e/blocks.spec.js tests/e2e/unified-ui.spec.js tests/e2e/phase0-characterization.spec.js
```

`BlockDefinitionEditing`は定義のclone／translate／apply、`BlockEditorSession`は親子sessionと復元情報、`BlockCompletionCommand`は検証・確認待ち・確定操作を所有する。確認中の重複要求、取消・拒否、別sessionへの遅延回答、内部不正の拒否、選択置換、参照削除、TX-05の配置先エラーを検証した。

`BlockEditingQueries`はscope切替ごとに現在値を照会し、依存判定では編集中draftを優先する。使用数表示は現在scopeだけ、参照Instance取得は編集session／退避host／保存済み定義をObject同一性で集計する。BlockCatalogの所有子孫取得を仮移動と削除で共用した。移動した12照会関数は状態取得先以外の本体一致も確認した。

選択からの下書き生成はBlockDefinitionEditing.fromSelection、空定義はempty、子定義の仮移動はBlockEditorSession.stageChildrenへ統合済み。寸法の数値式固定・独立した名前割当て・ID消費時点と、子孫のregistry差替えから拘束再接続・取消復元の順序を維持した。新規moduleを増やさず、4関数の本体一致も確認した。

BlockDefinitionCommandは開始・取消・名前変更・削除、BlockCompletionCommandは検証・確認待ち・確定を担当する。前者のrestoreHostを後者も利用する。Session／DefinitionEditing／EditingQueries／Catalogを組み合わせ、BlockViewへ表示状態変更を通知する。空編集画面の原点・倍率設定と履歴resetはappの明示adapterとして残る。

次はappに残る`blockSelectionGeometry`と`blockSelectionBoundsCenter`の候補検証・境界中心照会、`cloneConstraintForBlock`とBlock履歴adapterを調べる。Block操作を新しい汎用contextへまとめず、既存の所有者へ適切に統合する。

再開時は次の順で確認する。

1. この文書とAGENTS.mdを読み、`git status --short`・`git branch --show-current`・`git log -5 --oneline`を確認する。記載の件数やHEADより現在のGitとコードを優先する。
2. `composition-root.md`先頭の最新記録と`spec/architecture/モジュール構成.md`を読む。古い経過記録は当時の状態として扱う。
3. 未コミット変更があれば先に内容と所属を確認する。検証中と記録されている場合はprocessの実在を確認し、残っていなければ必要な検証を実行する。
4. 上記の最新区切りが完了していれば、残るBlock候補照会・拘束複製・履歴adapterの依存を調べ、既存の所有者を利用して整理する。
5. 一つのまとまりを実装・検証・Commit・Pushし、この再開地点を更新する。全体目標は途中成果へ縮小しない。

### 再開時に渡す指示の例

> `docs/refactoring/refactoring-policy-and-resume.md`とAGENTS.mdを読み、現在のGit状態を確認してJot2Dのリファクタリングを再開してください。app.jsを組立て・起動中心へ整理する全体目標を維持し、行数や期限より責務と状態所有者の適切な境界を優先してください。サブエージェントは使わず、まとまった単位で検証・コミット・Pushし、再開地点を更新してください。

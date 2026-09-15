# app.jsを起動・接続専用にする継続作業

開始点はdevelopの`457adea`。承認された最終目標は、`app.js`を数百行程度の生成・接続・起動・終了へ整理すること。部分的な抽出や中間のテスト成功をもって、この目標の完了とはしない。

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

- 編集scope分離を実装・検証中。`EditingWorkspace`はDocumentへの参照と現在のscope、scopeの復元用checkpointを所有する。Document名・単位・既定外観・Definition registryはDocument側へ明示した。
- 既存commandの移行用としてapp内の`model` bindingとSolverの対象更新を1か所に残す。これは最終APIではなく、後続の機能分離とともに削除する。
- Selection、command、操作transaction、描画、UI、テストhookの分離は未完了。

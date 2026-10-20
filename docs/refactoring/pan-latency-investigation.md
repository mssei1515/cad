# パン性能超過の調査（2026-10-20）

## 対象と判明した原因

基準はdevelop `cc6bb0d`、比較対象はmain `5ee5f3f`とscene構築分離前`e3dece3`。app.jsは3,066行。この単位でapp.jsは変更せず、3,066→3,066行（0行差）。目標全体は未完了で、main反映は保留する。

`adversarial-authoring-performance.spec.js`のselection／deletion／undo／redo caseは、Treeのgroupを開いた後でCanvasへmouseを移動し、中ボタンでpanする。計測は入力送信から最後の2回のrequestAnimationFrame待機までを含む。175ms未満の基準は変更しない。

pan移動中のPointerInteractionControllerはCanvasNavigation.movePanで短絡し、通常のhover／hit queryを実行しない。しかしpan開始位置へmouseを移す際にTreeを離れるため、Tree hoverの解除処理が同じ計測区間に含まれていた。

3版を同じ操作順で各3回測ると、いずれも処理したpointer moveは4回、Canvas描画は7回だった。Canvas clearRectの呼出しstackを追加観測すると、最初の3回が次の重複だった。

1. SelectionHighlight.clearSidebarHoverが即時描画。
2. SketchTreeController.pointerOutがCanvas hoverを解除して再描画。
3. SketchTreeController.leaveが既に空のhoverを解除して再描画。

残る4回は通常hover移動とpan移動のframe描画だった。ResizeObserver通知はなく、Canvas bitmapは980×768で一定。複製したGeometryやscene queryの再生成が原因ではなかった。InteractionProfilerのpreview内drawは4回しか数えず、preview外のTreeイベントによる3回はPointerMoveSchedulerのcanvasDrawsとclearRect stackで確認できた。profile内のdraw数だけでは全描画回数を評価できない。

## 修正した責務境界

- SelectionHighlightはsidebar hoverと自身が設定したdimension markerを所有する。既定の即時描画APIを維持し、`redraw:false`なら状態だけを更新する。clearは実際に解除した場合true、対象なし／型・参照不一致ならfalseを返す。
- SketchTreeControllerは一つのイベント内でsidebar／Canvas／Sketch hoverを更新した後、一度だけ描画する。pointerOut後のleaveなど、解除対象が既に空なら描画しない。
- object exitとtree leave単独の解除対象の違いを維持する。新しい描画scheduler、frameをまたぐ遅延、cache、model／selection変更は導入しない。

## 診断計測

通常のE2Eと同じfixture、1280×900 viewport、選択→Delete→Undo→Redo→Tree展開→group選択→wheel→panの順で実行。各roundはmain→分離前→現在版の順で、計3roundに固定した。計測用のpage.addInitScriptでCanvas event handlerとrequestAnimationFrameの実行時間を記録し、既存InteractionProfiler／frame statsとCDP Performance metricsも収集した。別の各1回でclearRect stackとResizeObserver通知を記録した。

診断は計測wrapperとCDPの追加があるため、そのwall時間を通常E2Eの合否に代用しない。異なる時点の3回ずつから速度同等や有意差も断定しない。描画回数の変化と呼出し元の特定を主な根拠とする。

| 対象 | 修正前wall ms（3回） | 修正後の比較時wall ms（3回） | Canvas描画回数 |
| --- | --- | --- | --- |
| main 5ee5f3f（変更なし） | 163.9／198.3／186.7 | 182.6／251.3／242.0 | 7→7 |
| 分離前e3dece3（変更なし） | 223.4／219.8／237.0 | 222.8／179.5／187.9 | 7→7 |
| 現在版 | 158.2／191.8／205.5 | 146.5／222.8／161.5 | 7→5 |

現在版の開始位置へのmouse移動は42.5／47.4／58.7msから22.3／35.4／28.9msとなった。通常previewは両方4回、profile内drawも4回、Geometry reader呼出しは21回のまま。重複2描画の除去は確認できたが、修正後にも全体wall 222.8msのsampleがあり、全性能問題の解消とは扱わない。

## 挙動・互換性の比較

同じ手順の終了後、3版のCanvas PNGはbyte単位で一致した（SHA-256 `6b60058e6694e839341e5e67cd9071a2d39842c36c37b07ca1ebf6d21e952f56`）。authoring stateも完全一致。serialized modelは保存時刻savedAtだけを除いてdeep equalityで一致した。他のfield、配列順、計算値は比較から除外していない。このfixtureでの結果であり、全機能の互換性を単独で保証するものではない。

追加単体は実SelectionHighlightとCanvasHoverをControllerへ接続し、最終状態を一度だけ描画すること、no-op leave、別のdimension markerの保護、object exit／leaveの解除範囲を確認する。既存の即時描画とstale hover拒否も維持する。

## 検証と再開

構文588ファイル・全単体1,761件・専用単体12件、関連E2E233件が成功（すべてexit 0、関連4.7分）。既存の性能file全12件も含み、panは165msで175ms未満の元の基準内だった。Tree／Canvas連携・既存画面比較・Sketch権限・Instance／投影・注記／寸法／Hatch／画像・保存再読込も確認した。詳細は[再開手順](refactoring-policy-and-resume.md)。最新全E2Eは未実行。診断sampleのばらつきと過去の失敗を消さず、全性能問題やリリース検証を完了したとは扱わない。閾値・test fixture・既存の期待値は緩めていない。

再現の入口は既存の`tests/e2e/adversarial-authoring-performance.spec.js`と`--grep 'selection, deletion'`。証拠は一時directoryのcad-pan-{probe,drawstack-probe,fix-probe,appearance-probe}.{cjs,json,log}、cad-pan-appearance-{main,before-scene,current}.{png,json}、cad-pan-fix-{focused,check,unit,related}.log。診断用serverは各runner終了後に自己作成したprocessだけを終了する。変更前snapshotはGit archiveで作成し、Git worktreeや共有branchを書き換えていない。

次は、残るpan frame内drawのCPU時間とブラウザの入力待機を分けて調べる。無変更の反復で成功を待ったり、描画内容を省いたりしない。必要な修正を行った場合も、同じmodel／Canvas内容、操作完了時点、生成・取消・例外と保存互換性を検証する。

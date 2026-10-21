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

## 後続のCPU／描画順照会調査（08ec689基準、Map案は不採用）

前節のTree修正後、CDP Profilerを500μs sampling intervalで同じpan区間へ追加し、main／e3dece3／現在版を各3回観測した。正規化・SketchHierarchy.ensure／SketchContext.ensureSketchStateがJSの上位にあり、現在版ではnormalizeDimensionAppearanceがself sample 53.8ms、ensureが33.8msだった。これは3profileのsampling重み合計で、Profiler開始・停止や診断によるoverheadもある。通常E2Eの操作時間や厳密なCPU使用時間へ置き換えず、呼出し元を絞る根拠とした。

ensureへ至る経路にはGeometryPresentation.createSketchStyle.drawOrderBySketchのsort comparatorがあった。isActiveSketchElementはelementSketchIdとactiveSketchIdを経由し、それぞれが正規化を行う。同じ要素が何度も比較されるため、描画順照会が同じObjectの所属を繰り返し読む。

drawOrderBySketch内だけにactiveByItemを置き、比較時に初めて読んだ返値をその呼出し内で共有する候補を試した。既存DimensionPresentationのactiveByConstraintと同じ寿命で、visible filter先行・元Objectのkey・Number比較・stable order・入力非変更・比較のない場合の無読取りを維持した。後述の検証から採用を見送り、製品にはこのMapを追加していない。

直前08ec689をarchiveした版とMap案を交互に3回測った。counting callbackだけを診断用scriptへ挿入し、GeometryPresentationのactive照会を数えた。各回の106点×5回のsortで次の結果となった。

| 対象 | active照会（各3回とも） | sort回数／Canvas描画 | wall ms（3回） |
| --- | ---: | --- | --- |
| 08ec689 | 1,050 | 5／5 | 141.1／222.3／145.7 |
| Map案 | 530 | 5／5 | 132.3／227.5／148.3 |

通常previewは4回、profile内Geometry readerは21回、browser例外は0で両版共通。照会削減は確認できたが、wallは両版ともばらつき、速度改善や全性能問題の解消を断定しない。別のround 1終了後Canvas PNGはbyte単位、authoring stateとserialized model（savedAtのみ除外）はdeep equalityで一致した。PNG hashは前節と同じ。

初回のroute.fetchによる診断はlocal HTTPのECONNRESETで2sample後に中断した。終了を確認してから、routeに各固定版の同じsourceをfilesystemから渡す方式へ変更し、別名v2の6sampleを完走した。初回の部分結果を完走した3回比較へ混ぜていない。製品sourceは両診断間で変更していない。

候補版の構文588・単体1,763・関連単体40件は成功した。関連E2E238件は237成功・1失敗（4.8分、exit 1）。panは通過し、その後のselection/blank-rectangleが252msで250ms未満の基準を超えた。unified-ui／phase0-characterization／sketch-permissions／sketch-projection／free-instance／blocks／drawing-order／png-export／selection-zoom-shadow／adversarial-authoring-performanceを実行した。

同じ既存性能caseを変更前と候補で交互に固定3回ずつ比較すると、08ec689は2成功・1失敗（線選択157ms、成功時の空白矩形はいずれも249ms）、Map案は3失敗（空白矩形251ms、pan182ms、空白矩形283ms）だった。小標本でMapが遅延の原因と断定はしないが、照会削減だけでは性能改善を示せず、cacheを追加する保守上の複雑さに見合う利点を確認できなかった。この案は採用しない。閾値変更や成功するまでの再実行は行っていない。

Map実装・追加単体2件・仕様／実装mapへの追記を撤回し、app／src／tests／spec／index／tools／package／Playwright設定が作業開始時08ec689と完全一致することを確認した。app.jsは3,066→3,066行（0行差）。確定変更は調査文書3fileだけで、現在の正式仕様は変更しない。候補の実装・単体は一時directoryのcad-sketch-order-candidate-{geometry_presentation.js,test.js}へ退避した。

現在の製品codeとtestsは前単位で構文588・単体1,761・関連E2E233成功を確認した08ec689と同じであり、候補版の1,763件や237／238結果を現在の最終codeの結果と混同しない。最新全E2Eは未実行で、mainは保留する。次はrootの構築依存整理へ戻り、CanvasCommandInputsで既存BasicDrawingTools.inputの共有により重複するcallback接続を狭められるか確認する。正常な描画を省いたり、無断でmodel正規化の失効条件を変えたりしない。

証拠は一時directoryのcad-pan-cpu-{main,before-scene,current}-{1,2,3}.json、cad-pan-cpu-summary.{cjs,json}、cad-sketch-order-probe-v2.{cjs,json,log}、cad-sketch-order-v2-{before-order,current}.{png,json}、cad-sketch-order-{focused,check,unit,related}.log、cad-sketch-order-compare-{baseline,current}-{1,2,3}.log。以前の計測fileを上書きせず残し、全runnerの終了と自己作成serverの終了を回収した。

# 表示機能組立てと性能gateの調査（2026-10-23）

## 最新：同じ製品コードで関連検証成功

9f700d5のapp／src／tests／index／tools／specを固定したまま、元の関連E2E18ファイル305件が全成功（5.0分、exit 0）。全12性能caseを含み、線選択は150ms未満、空白矩形217ms（250ms未満）、pan144ms（175ms未満）だった。ログは一時directoryのcad-presentation-verified-related.log。専用port8788の自己起動serverはfinallyで停止し、同じrunnerの終了を回収済み。最新全E2Eは未実行。以前の失敗原因を完全に解明したとは扱わず、以下に失敗・診断を保持する。

ユーザーから正式再検証後に「先ほど電源につなぎました」と報告があった。電源状態の違いは、無変更側の測定値が改善したことと整合する有力な要因である。ただし接続の正確な時刻、各計測時の電源状態とCPU設定を採取していないため、単一原因と断定しない。今後の性能比較では同じ電源条件を保つ。

再確認を開始した根拠は、数値rule候補の追加診断で無変更側も測定値が基準内へ戻ったこと。baselineは旧mainではなく現在の9f700d5で、appearance.jsだけを同じURLから既存source／一時候補へ差し替えてbaseline→candidate→candidate→baselineを固定各2回測定した。全caseで差し替え1回をassertし、1worker／retries 0／同じ13操作／同じ元の制限で測定。診断harness内の性能assertionは省いたため、その4 passedを正式な合格へ代用せず、13個の実測値全てが元の上限内だったことを確認してから正式関連E2Eを一度だけ実行した。

| 版 | 線選択 ms | pan ms | 空白矩形 ms |
| --- | ---: | ---: | ---: |
| 9f700d5-1（無変更） | 103 | 138 | 201 |
| 数値rule候補-1 | 85 | 111 | 168 |
| 数値rule候補-2 | 78 | 141 | 200 |
| 9f700d5-2（無変更） | 103 | 144 | 200 |

4case終了時のmodel（savedAtだけ除外）、authoring state、Selection、Canvas PNGが完全一致。PNGのdata URL文字列のSHA256はd6ce098e19302025a5d278421522e96e168112b87c68ba206b3b85bfdc74ff30。候補に速いsampleがあるが小標本で、無変更側も全操作で基準内だったため、今回の分離に必要な修正としては採用しない。製品にcache・失効規則・追加の正規化経路を導入していない。

証拠はcad-numeric-rules-experiment.cjs／.json／.logと、そのjsonが指す一時directoryの4caseのjson／appearance-candidate.js／config。前節以前の比較とbaselineの版やassertion有無を混同しない。前回から繰り返し合格を待ったのではなく、変動を示す新しい比較結果を踏まえた一回の正式再検証である。根本原因未特定という制限を残し、通常の開発統合へ進む。mainへの反映は最新の全体検証と停止／release区切りまで保留する。

## 前段checkpoint時の状態

基準main／developはdf5aef27a2ce。作業branchはcodex/presentation-feature-assembly。PresentationFeatureの責務と依存は正式なモジュール構成を参照する。app.jsは2,738→2,724行（14行減）。機能比較は一致しているが、性能gateは未通過。mainへの追加反映を保留するユーザー判断を維持する。既存閾値・timeout・fixtureは変更しない。

構文596・全単体1,839・関連単体15・file URL読込1は成功。関連E2Eは18ファイル305件中304成功・1失敗（6.2分、exit 1）。失敗はadversarial-authoring-performance.spec.js:965の空白矩形333ms（250ms未満が基準）。前回releaseの全587成功を今回の合格結果に流用しない。

## 比較方法と結果

元の性能case／fixture／assertionをそのまま一時harnessへ取り出し、baseline→candidate→candidate→baselineの固定4回で比較した。baselineはgit show df5aef2:app.jsを配信し、candidateは作業tree。共通の他moduleは未変更。1worker、retries 0、viewport1280×900、自己起動したport8785のserverで逐次実行した。

最初の二つのharnessはbaselineのrouteが0回だったため、版比較の証拠から除外する。前者はURL matcherの問題を疑って修正したが、決定的な原因は元のbeforeEachによるページ読込みがroute登録より先だったこと。routeを先に登録し、baselineで実際の差し替え1回を必ず確認するharnessへ直した。これにより旧版を測ったことを確認できた固定4回の結果は次の通り。

| 版 | 線選択 ms（基準150未満） | baseline route回数 |
| --- | ---: | ---: |
| baseline-1 | 181 | 1 |
| candidate-1 | 259 | 0 |
| candidate-2 | 249 | 0 |
| baseline-2 | 197 | 1 |

4回とも最初の線選択で失敗（exit 1）。旧版でも不合格になるが、この小標本だけで今回の差分に性能影響がないとは言えない。成功するまでの再試行はしていない。

別の診断では同じ13操作を最後まで観測するため、一時harness内だけで性能assertionを記録に置き換え、CPU Profilerを追加した。baseline／candidate各1回で線選択228／213ms、pan248／227ms、空白矩形406／385msだった。この診断の「2 passed」は性能assertionを省いたharnessの完走であり、正式E2Eの合格ではない。baseline routeは1回を確認済み。whole-caseのCPU自己sampleではnormalizeDimensionAppearanceが331／320msと上位だったが、fixtureの位置照会も含むため、測定対象操作だけのCPU時間とは扱わない。

## 機能比較の訂正と再確認

当初の機能比較も差し替え回数を確認していなかったため、そのまま旧版一致の証拠にしない。三つのscript全てをURL pathname matcherとbaseline route 1回のassertion付きへ直して再実行し、UI／設定等16・作図等48・寸法22の計86状態で一致を確認した。API key204の並び、model・履歴・選択・modeと対象UI、寸法API戻り値を比較し、savedAtのみ除いた。browser例外なし。全てexit 0。これは性能の合格を代替しない。

## 採用しなかった試作

- 寸法hitで候補ごとの外観とラベルを共有する案を試作。追加したlive appearanceの単体を含む33件は成功したが、元の性能caseは線選択172msで失敗。元caseのworker終了後に専用port8786のserver終了待ちが残ったため、その実process32472とコマンドを確認して当該serverだけを終了し、同じ実行のexit 1を回収した。機能を省略したり閾値を変えたりしていない。
- 同試作のCPU診断では線選択3draw／空白矩形6draw。hover→選択開始／確定、矩形移動各frame／確定という実stackを確認した。重複描画と断定して削除しない。Profiler／stack採取が加わる診断時間は正式E2Eへ置き換えない。
- 不変な寸法数値ruleのkey配列を事前作成する案を一時fileだけで比較。正規化4,016ケースが同じで、単体80,000回の3roundは約15%短縮したが、実操作の合格や十分な利点は未確認。製品へ採用しない。

hit sourceとそのunit fileは今回の開始HEADのbytesへ戻し、git diffが空であることを確認した。数値rule案も製品へ書いていない。今回の製品変更はPresentationFeatureの組立てとapp／loader接続だけ。

## 再現・証拠・次の判断

正式な失敗caseはnpx playwright test tests/e2e/adversarial-authoring-performance.spec.js --grep 'selection, deletion'。既存の150／175／250ms制限とsettleAfterPaintの二重requestAnimationFrameを維持する。通常の診断serverはhidden起動・finallyで自己所有processだけを終了する。次はその操作範囲でCPU／wall／frame数を分けて分析し、共有照会または構築境界のどの処理が実測上の費用かを示してから変更する。根拠なくcacheや新たな失効規則、描画省略、試行回数を増やさない。

一時directoryの証拠：cad-presentation-feature-{focused,check,unit,loader,related}.log、cad-presentation-perf-comparison-verified.log（固定4回）、cad-presentation-perf-diagnostic.log（assertion省略診断）、cad-presentation-{ui,authoring,dimension}-equivalence-verified.log（差し替え確認済み86状態）、cpu-{baseline-1,candidate-1}.json、cad-hit-cpu-phases.log／cad-hit-cpu-{line-pointerdown-up,blank-rectangle}.json、cad-dimension-hit-{focused,performance}.log、cad-appearance-numeric-prototype.cjs。最初のcad-presentation-perf-comparison.log／-valid.logは差し替え未実施のため版比較から除外する。実行済みrunnerは全て終了を回収済み。

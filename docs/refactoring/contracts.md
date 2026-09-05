# 共通契約の草案

正式仕様ではない。現行の規則を共通化するための整理案であり、未確定箇所は [判断事項](./decisions.md) に記録する。

## 所属・参照・編集権限

| ID | 現行規則の要約 | 正式仕様の出典 | 共通化するときの注意 |
| --- | --- | --- | --- |
| OWN-01 | 通常Geometryは1つの作図可能Sketchに所属する。通常SketchはワールドXY座標を共有する | [04 §1–3](../../spec/04-スケッチ.md) | 同座標でも別SketchのPointは共有しない |
| OWN-02 | 通常編集はactive Sketchを対象とする | [04 §3](../../spec/04-スケッチ.md) | Treeでのactive化と、拘束コマンドによる先祖参照を通常選択と区別する |
| REF-01 | 通常拘束は同一Sketch内、参照拘束は先祖を固定入力として子孫側を解く | [04 §7–9](../../spec/04-スケッチ.md) | Root・兄弟・子孫への参照禁止、対称拘束の複数参照条件を残す |
| REF-02 | 別Sketchへのスナップは座標だけを利用する | [04 §6](../../spec/04-スケッチ.md) | Point共有や通常拘束の自動追加を伴わない |
| EDIT-01 | 派生Geometryは独立座標を保持しない | [12 §1・5](../../spec/12-スケッチ投影.md) | 同一Sketchのミラー／パターンは逆変換した参照元をdragできる。投影を含むchainは拒否する |
| EDIT-02 | Block外部拘束はInstance配置を解く | [05 §12](../../spec/05-ブロック.md) | Definition内の形状自由度と同一視しない。固定・回転モードを保持する |

「表示可能」「選択可能」「拘束の入力に使用可能」「形状を変更可能」は別の権限として整理する。単一のreadOnlyフラグですべてを説明しない。

## 操作の段階

以下は拘束追加とGeometryドラッグを比較するための枠組み。すべてのコマンドに同じ取消挙動を導入する提案ではない。

| 段階 | 拘束追加 | Geometryドラッグ |
| --- | --- | --- |
| 開始 | 入力対象と所属・参照可否を確認 | 対象・編集可否を判定し、開始状態を保持 |
| 途中 | 必要なoperandや値を収集 | 連結成分のlocal solveを優先し、必要ならSketch全体へfallback |
| 検証 | 一時追加後に拘束を解き、受入れ条件と形状崩壊を確認 | pointer-upで最終solve、形状妥当性、Parameter再評価を確認 |
| 成功 | 成立した拘束を確定 | 最終結果を確定し履歴を記録 |
| 失敗 | 拘束追加をロールバック | 最終検証の失敗では開始前へ復元 |

出典: [03 §3・5・8](../../spec/03-Geometryと拘束.md)、[08 §4](../../spec/08-Parameter.md)。取消操作の詳細は個別コマンドに従う。特にpointercancel、Esc、Sketch切替を同じ「取消」にまとめる前に、実装とテストの追加照合が必要。

## 成功・失敗と復元範囲

| ID | 操作・状況 | 現行の規則 | 出典／確認した実装 |
| --- | --- | --- | --- |
| SOLVE-01 | 拘束追加・編集の受入れ | 反復終了理由だけで拒否せず、有限な総残差・受入れ許容誤差・安定性等で判定する | [03 §5・8](../../spec/03-Geometryと拘束.md)、app.js `resultIsAccepted` |
| TX-01 | Parameterを含む確定操作 | 式エラー、拘束矛盾、非収束では開始前へ戻し、履歴へ追加しない | [08 §4](../../spec/08-Parameter.md)、`stabilizeActiveParameterNamespace`と呼出し側 |
| TX-02 | Geometryドラッグ確定 | 最終solveやParameter再評価で失敗したら開始前へ戻す。実装では依存側失敗も拒否条件 | [03 §3](../../spec/03-Geometryと拘束.md)、`endDrag` |
| TX-03 | 一般の参照元Sketch更新 | 依存Sketchのsolve失敗では参照元を戻さず、依存側をエラーにする | [03 §8](../../spec/03-Geometryと拘束.md)、`solveSketchAndDependents`は結果を呼出し側へ返す |
| TX-04 | Block Parameter適用 | Definition、親Definition、Instance、Documentへの反映を検証し、失敗時は一括復元 | [05 §12](../../spec/05-ブロック.md)、[08 §4](../../spec/08-Parameter.md) |
| TX-05 | Parameter以外のDefinition編集 | 外部拘束が壊れてもDefinition更新は維持し、影響先をエラーにする | [05 §12](../../spec/05-ブロック.md) |

TX-02とTX-03の境界は未確定。低水準solve関数が成功を返しても、依存側の結果は別であり、呼出し側の確定成功を意味しない。すべてを一律に「成功なら保存、失敗なら全復元」と書き換えない。

## ドラッグの計算と応答

| ID | 保持する条件 | 出典 |
| --- | --- | --- |
| DRAG-01 | pointer moveは最新位置を保留し、animation frameごとに最大1回処理する | [07 §10](../../spec/07-UI・操作・履歴.md) |
| DRAG-02 | down、up、cancel、double click、wheelの処理前に保留位置を反映する | [07 §10](../../spec/07-UI・操作・履歴.md) |
| DRAG-03 | preview中はParameter参照寸法feedbackを反復せず、pointer-upで実行する | [03 §3](../../spec/03-Geometryと拘束.md)、[08 §4](../../spec/08-Parameter.md) |
| DRAG-04 | 特定のLine拘束構成でのtarget選択、大移動時の全体solve／経路分割を保持する | [03 §3](../../spec/03-Geometryと拘束.md)、[07 §7](../../spec/07-UI・操作・履歴.md) |

DRAG-04は現行の具体的な解法policy。代替方式が同じ追従性・拘束精度を保証すると確認できるまで削除しない。固定Geometryの不変性、拘束残差、移動の連続性、pointer追従量、所要時間を別々に検証する。

許容誤差は用途を区別する。通常収束 `1e-7`、追加・編集の受入れは概ね `1e-4`、Parameter変化判定は `1e-7 × max(1, |value|)`、反復上限20回が現行の記述。preview固有の許容差と各計算の縮退閾値をこの表の値へ一律に置換しない。

## 履歴・表示状態

| ID | 規則 | 出典 |
| --- | --- | --- |
| HIST-01 | DocumentのGeometry、拘束、Parameter、外観、注記等の変更はUndo/Redo対象 | [07 §11](../../spec/07-UI・操作・履歴.md) |
| HIST-02 | Block Editorはlocal履歴を持ち、完了時にrootへ1 transactionとして記録 | [07 §11](../../spec/07-UI・操作・履歴.md) |
| HIST-03 | Selection、hover、viewport、View State、Tree開閉・幅は履歴対象外 | [02 §12](../../spec/02-データモデルと永続化.md)、[07 §11](../../spec/07-UI・操作・履歴.md) |

状態復元では座標だけでなく参照、式、評価値、採番値を含む操作対象を確認する。UI状態が履歴対象外であることと、操作失敗後に無効なSelectionを残してよいことは別問題であり、後者は各操作経路で確認する。

## 実装分離の候補

確定済みの内部設計ではない。現行の数学kernel、GeometryRef、Constraint codec、Parameter engineを活かし、次の境界を検証する。

- 入力adapter: pointer／キー／UIを操作要求へ変換する。
- 編集操作: 開始状態、検証、確定、復元、履歴の責任を持つ。
- 計算実行: local／全Sketch／依存先／Parameter評価の結果を返す。
- 表示: 確定状態またはpreviewを読み、描画とUI更新を行う。

戻り値やtransactionモデルは、この草案だけを根拠に新設しない。まずTX-02／03の適用範囲と、現在のsnapshot各種が保持する内容を比較する。

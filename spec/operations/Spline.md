# Splineの操作

対象の所属・編集可否は[共通契約](../contracts/所属と編集可否.md)、確定・失敗・履歴は[編集と履歴](../contracts/編集と履歴.md)に従う。以下に操作固有の条件を示す。

## 1. 作成と編集

### 作成

Geometry menuまたはToolbarのSpline commandから開始する。

| 入力 | 条件 | 結果 |
| --- | --- | --- |
| Canvas click | 作成中 | fit pointを追加する |
| Enter | 3点以上 | 開Splineを確定する |
| Canvas空白のdouble click | 3点以上 | 開Splineを確定する。double click位置はfit pointに追加しない |
| 先頭fit pointのclick | 3点以上 | 閉Splineを確定する |
| Backspace | 未確定の点がある | 最後のfit pointを取り消す |
| Esc | 作成中 | 未確定Splineと今回作成したfit pointを破棄する |

Spline確定のdouble clickは、汎用の空白double clickによる作図cancelより優先する。1つのSpline確定を1つのUndo単位とする。

### fit point編集mode

通常modeではSpline本体だけを選択・hoverし、Spline作成のためだけに存在するfit pointや補助polygonを表示しない。Spline本体のdragは全fit pointを同じ量だけ移動する。Propertiesの「フィット点を編集」またはSplineのdouble clickで専用編集modeへ入り、fit point handleと細い補助polygonを表示する。このmodeでは各fit pointをdragでき、Esc、Canvas空白のdouble click、または別対象の選択で編集modeを終了する。

専用編集modeの右clickメニューは次の操作を持つ。

| 対象 | 操作 | 結果 |
| --- | --- | --- |
| Spline本体 | 通過点を追加 | click位置に最も近いcurve上の位置へfit pointを挿入する |
| fit point handle | 通過点を削除 | Splineからそのpointを取り除く。3点未満になる場合は許可しない |

Spline固有の内部pointを削除した場合は不要になったPointも削除するが、他Geometryと共有するPointは残す。追加・削除後にSplineが成立しない場合または拘束を維持できない場合は操作全体を戻し、履歴へ追加しない。成立した追加・削除はそれぞれ1つのUndo単位とする。

### Propertiesと派生Spline

Propertiesの基本情報は種類、ID、定義方式、次数、fit point ID列、開／閉を表示する。開／閉は編集できるが、閉Splineへ変更できない形状や端点接線拘束がある場合は操作全体を拒否する。

同一Sketch内で完結するミラー／直線パターンが生成するSplineは、Canvasドラッグを逆変換して参照元Splineの通過Pointを編集する。スケッチ投影および投影を経由する派生Splineのドラッグは拒否する。

派生側での通過Point追加・削除と開／閉変更は拒否する。constructionとAppearanceはLine、Circle、Arcと同じ解決規則を使用する。

## 2. Selection、Sketch Tree、Annotation

Splineは1つの作図可能Sketchへ所属する。非アクティブSketchでは表示だけを行い、Canvasからhover、選択、dragしない。Sketch TreeではArcの後、Hatchの前にSpline分類を置き、Object rowにはToolbarと同じicon、Spline ID、fit point数、開／閉を表示する。通常の選択、矩形選択、Copy、Cut、Delete、右clickの補助Geometry切替、Leader追加、選択からBlock作成に対応する。

LeaderをSplineへ付ける場合はclick位置に最も近いcurve上の点を開始位置として保存する。fit point変更後は、他の曲線Geometryと同じく保存済み開始位置に最も近い新しいcurve上の点へ開始位置を再投影する。

## 3. 拘束

- `pointOnSpline`: PointをSpline上へ置く。curve parameterを`[0, 1]`のsolver変数として保持し、形状変更に追従させる。
- `splineLineTangent`: 開Splineの始点または終点の接線方向をLine方向へ一致させる。
- `splineSplineTangent`: 2つの開Splineの選択端点どうしで接線方向を一致させる。

端点接線はSpline本体のclick位置から近い始点／終点を決める。閉Splineは端点を持たないため端点接線拘束の対象にしない。端点接線拘束を持つSplineの閉鎖も拒否する。Point-on-Splineと接線拘束は保存、Undo/Redo、Block Projection参照、Propertiesの定義Geometry表示へ含める。

## 4. HatchとGeometry操作

通常SplineはHatchの境界候補になる。開SplineはLine／Circle／Arc／別Splineとの交点で分割したspanとして、閉Splineは交点がなくても完全loopとして面探索へ渡す。Hatch境界には元SplineのGeometryRef、進行方向、curve parameterまたは交点順を保存し、fit point移動へ追従する。

現行のTrim、Offset、FilletはSplineを対象にしない。Splineを含む操作で該当commandを有効化せず、近似Polylineへ変換する暗黙処理も行わない。

## 5. Copy、Block、Projection

SplineのCopy／Pasteでは全fit pointを新しいPoint IDへ複製し、新しい`SP` IDを付与する。同時選択した拘束、Leader、Hatch境界は新しいSpline参照へ書き換える。Splineを含むBlock化でも同じ参照関係をBlock local座標へ移す。

Block Definitionは`splines[]`を保持し、Instance Projectionではfit point、curve、Appearance、construction、拘束参照、Leader、HatchをInstanceの平行移動・回転で変換する。Projection IDは通常のGeometryRef path規則に従い、入れ子Blockでも一意にする。配置先CanvasでProjection Splineを選択した場合は最上位Block Instanceを選択する。

## 6. JSONと互換性

Splineの保存fieldは[保存形式](../data/保存形式.md#3-geometry)、不正データの拒否と旧版配列の補完は[読込と互換性](../data/読込と互換性.md)に従う。History・draft・Clipboardの保持範囲も[保存形式](../data/保存形式.md#12-編集中データとclipboard)を参照する。

補間条件は[Splineの計算規則](../10-スプライン.md#1-形状と補間)、検証は[既存の保証](../10-スプライン.md#8-検証)を参照する。

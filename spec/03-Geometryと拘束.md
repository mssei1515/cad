# Geometry と拘束

## 1. Geometry 要素

| 要素 | 保持する形状 | 主な編集 |
| --- | --- | --- |
| Point | `x`, `y`, `fixed`, `kind` | 移動、固定／解除 |
| Line | 共有 Point `p1`, `p2`, `construction` | 端点・線全体の移動、補助線切替 |
| Circle | 中心 Point、`radiusValue`, `construction` | 中心移動、半径ドラッグ、補助切替 |
| Arc | 中心 Point、半径、開始角、終了角、`construction` | 中心・半径・両端の編集、補助切替 |
| Spline | 3個以上の共有fit Point、`closed`、`construction` | 曲線全体の移動、専用編集modeでfit pointを移動、開閉切替、補助切替 |

すべての Geometry は作図可能な1つの Sketch に所属する。Block Projection は同じ型として選択・描画されるが、Definition と Instance から導出される読み取り専用 Geometry である。

同一の作図可能Sketchに属するPointとLineは混在複数選択して固定／解除できる。選択中に未固定対象があれば未固定Pointへ`fixed: true`、未固定Lineへ`LineFixedConstraint`を一括追加し、全対象が固定済みならすべて解除する。Circle、Arc、Splineなど固定操作非対応Objectが混在する場合は実行しない。複数対象の固定状態変更とSolver検証は1回のtransactionかつ1回のUndo単位とし、拘束矛盾時は全対象を操作前へ戻す。

モデル長の下限は `1e-6` である。Line、Circle、Arc、Spline の作成、読込、拘束追加ではゼロ長または下限近傍への崩壊を防止・補正する。

### 共通数学契約

UI adapterとSolverが共有する副作用のない計算は`geometry_kernel.js`に置く。

- `normalizeAnglePositive`は角度を`[0, 2π)`へ正規化し、Arc sweep判定、trim、hit test等のUI側計算で使う。
- `normalizeAngleSigned`は角度を`(-π, π]`へ正規化し、Solverの角度残差で使う。境界の`-π`は`π`になる。
- `arcEndpointPoint`はArcの中心、公開`radius()`、指定した開始／終了角から端点座標を返し、SolverとUI側計算が同じ実装を使う。
- `arcSweep`は`endAngle - startAngle`を符号付きのまま返す。正のsweepと負のsweepは別方向として扱い、絶対値が`2π`以上なら`angleOnSignedSweep`は全角度を範囲内とする。端点は範囲に含み、sweepが0の場合は開始角と同じ正規化角だけを範囲内とする。
- `unwrapAngleNear`は指定角度と同値な`2π`周期の候補からreferenceに最も近い分岐を返す。ちょうど半周の境界ではJavaScriptの`Math.round`規則を維持する。`shortestAngleFrom`は開始角から終了角への差を`(-π, π]`へ収め、反対方向が同距離となる`-π`境界は`π`側を選ぶ。
- `arcParamOnSweep`は符号付きsweep上の角度を開始0から終了1のparameterへ変換する。範囲外またはsweepの絶対値が`1e-12`未満なら`null`を返し、ちょうど`1e-12`では通常計算する。`angleAtArcParam`は同じ符号付きsweepを線形補間し、`pointAtArcParam`と`arcSamplePoints`はその角度と公開`radius()`から座標を返す。サンプル数`count`は区間数であり、通常は両端を含む`count + 1`点、0なら開始点1点を返す。
- Lineの向きが有効となる下限`MIN_ORIENTATION_LENGTH`は`1e-9`である。`lineHasDirection`は長さがこの値以上の場合にtrueを返す。
- `lineUnit`、`lineNormal`、`lineSupportNormal`、`lineAngle`はUIとSolverが参照するLine方向契約である。長さ`1e-12`未満のLineでは単位方向を`(1, 0)`、法線を`(0, 1)`とする。orientation hintがhorizontal／verticalの場合、支持法線はそれぞれ`(0, 1)`／`(-1, 0)`とする。
- `signedPointLineDistance`はorientation hintを考慮し、hint方向の支持線anchorには両端座標の中点を使う。`signedPointDirectedLineDistance`はhintを無視し、Lineの端点方向から符号を決める。長さ`1e-12`未満ではどちらも0を返す。
- `projectPointToLine`は無限直線へ投影し、Lineの端点範囲には丸めない。`projectPointToSegmentPoint`と`closestPointOnSegment`は投影parameterを`[0, 1]`へ丸め、後者は投影点に加えてparameter `t`を返す。
- `distancePointToSegment`と`distancePointToSegmentPoints`は同じ線分投影契約から距離を計算する。投影・線分距離ではLineの長さの二乗が`1e-12`未満の場合に第1端点へfallbackし、ちょうど`1e-12`の場合は通常の投影を行う。
- `lineIntersection`は2本の無限直線の交点を返し、線分内に収まるかは判定しない。行列式の絶対値が`1e-12`未満の場合は平行または縮退として`null`を返し、ちょうど`1e-12`の場合は交点を計算する。trimの線分範囲と許容差は呼び出し側が判定する。
- `reflectedPointAcrossLine`はLine端点が表す無限直線に対する点の鏡映を返す。orientation hintは参照しない。Line長が`MIN_ORIENTATION_LENGTH`未満の場合は入力点と同じ座標を返し、ちょうど`MIN_ORIENTATION_LENGTH`の場合は鏡映を計算する。この反射境界はUI投影の長さ二乗`1e-12`境界とは用途が異なる。

2種類の角度範囲と2種類の符号付き距離は用途が異なるため統合せず、呼び出し側で明示する。Arcモデルを直接補正する`normalizeArcSweep`とドラッグ中のほぼ一周判定を含む`arcEndpointDragValue`は、pureな数学関数ではなくUIの編集policyとして`app.js`に置く。

### 共通参照契約

GeometryとBlock Projectionの参照は`GeometryRef { kind, path[] }`として扱う。kindは`point`、`line`、`circle`、`arc`、`spline`のいずれかで、pathは1要素以上の文字列配列である。通常GeometryのIDは1要素、Projectionの階層は`@`で区切った複数要素として表す。

Constraintの各Geometry参照fieldは保存形式上は従来どおりbare IDを使う。例えば入れ子Projectionを参照するLine拘束は`"line": "BI1@BI2@L1"`となり、kindを保存文字列へ追加しない。保存時はGeometryの型とIDから共通codecでcanonical IDを生成し、読込時はConstraint fieldが要求するkindとbare IDから共通resolverで実体を引く。

複数kindを許すfieldの解決順は次のとおりである。

- Offsetのsource／offsetはLine、Circle、Arcの順に解決する。
- Concentricのa／bはPoint、Circle、Arcの順に解決する。
- CircleまたはArcを許すprimitive fieldはCircle、Arcの順に解決する。

参照を解決できない場合のConstraint読込エラーと、Constraint型ごとの保存・復元規則は従来どおりである。永続Constraint型のclass、保存type、serialize、deserializeは単一registryで対応付ける。参照列挙、表示名、未登録型のユーザー向け拒否policyは永続codecとは別の責務として保持する。

## 2. 作図コマンド

[正本](operations/作図と形状編集.md#1-作図と形状編集)を参照する。

### 点

[正本](operations/作図と形状編集.md#点)を参照する。

### 連続線

[正本](operations/作図と形状編集.md#連続線)を参照する。

### 中心線

[正本](operations/作図と形状編集.md#中心線)を参照する。

### 矩形

[正本](operations/作図と形状編集.md#矩形)を参照する。

### 長穴

[正本](operations/作図と形状編集.md#長穴)を参照する。

### 円

[正本](operations/作図と形状編集.md#円)を参照する。

### 円弧

[正本](operations/作図と形状編集.md#円弧)を参照する。

### 3点円弧

[正本](operations/作図と形状編集.md#3点円弧)を参照する。

### スプライン

[正本](operations/作図と形状編集.md#スプライン)を参照する。

### スケッチ投影

[正本](operations/作図と形状編集.md#スケッチ投影)を参照する。

### 補助 Geometry

[正本](operations/作図と形状編集.md#補助-geometry)を参照する。

### R面取り

[正本](operations/作図と形状編集.md#r面取り)を参照する。

### トリム

[正本](operations/作図と形状編集.md#トリム)を参照する。

### オフセット

[正本](operations/作図と形状編集.md#オフセット)を参照する。

### ハッチング

[正本](operations/作図と形状編集.md#ハッチング)を参照する。

## 3. 選択と編集

[正本](ui/入力と操作状態.md#3-geometryの選択と編集)を参照する。

### ドラッグ中の計算

ドラッグ中は選択に関係する拘束連結成分だけを優先して local solve し、必要な場合に全 Sketch solve へフォールバックする。

Lineのドラッグは、拘束構成とPointer移動量に応じて次のように扱う。

| 条件 | 処理 |
| --- | --- |
| Line–Circle中心距離寸法だけで拘束された連結成分内のLine本体 | ドラッグ対象Lineの両端をPointer位置へ固定し、残りの変数だけをlocal solveする |
| 上記以外で、フレーム間のPointer移動が大きいLine | 反復上限を拡張した全Sketch solveでPointer位置への一括追従を先に試みる |
| 大移動時の一括追従が収束しない場合 | 1回のpreview内で移動経路を有限個の小区間に分けて順にsolveする |

最初の処理では、Lineの両端は反復計算による追従遅れを生じさせず、Circle中心距離は残りのGeometry移動で維持する。大移動時の経路分割は、非線形拘束があってもPointer位置への追従量を維持するために行う。

### ドラッグの確定と失敗

Pointer-upでの最終検証と失敗時の復元は、[編集の確定と失敗](contracts/編集と履歴.md)のTX-02および「Geometryドラッグの確定」に従う。

## 4. 拘束コマンド

[正本](operations/拘束と寸法.md#1-拘束コマンド)を参照する。

## 5. 拘束追加のルール

[正本](operations/拘束と寸法.md#2-拘束追加のルール)を参照する。

## 6. 拘束寸法と読み取り専用寸法

[正本](operations/拘束と寸法.md#3-拘束寸法と読み取り専用寸法)を参照する。

## 7. 数値表示

[正本](ui/表示とビュー操作.md#5-数値表示)を参照する。

## 8. solve と状態表示

### 収束と受入れ

ソルバーは数値ヤコビアンと減衰付き最小二乗法を使う。通常の収束許容誤差は `1e-7`、拘束追加・編集の受入れ判定は概ね `1e-4` である。`lambda上限` や最大反復で停止しても、総残差が有限かつ受入れ許容誤差以下なら、操作は成立として扱う。

### Parameterを含む確定操作

評価手順、反復上限、収束判定は[Parameter](./08-Parameter.md)の「評価とsolve」に従う。失敗時の復元と履歴は[編集の確定と失敗](contracts/編集と履歴.md)のTX-01に従う。

### 拘束状態の表示

Geometry は解析結果により次の状態で描き分ける。

| 状態 | 意味 |
| --- | --- |
| 完全拘束 | 対象自由度が拘束されている |
| 支持位置拘束 | 固定 Geometry の影響で位置が拘束されている |
| 未拘束 | 1つ以上の自由度が残る |
| 矛盾 | solve 失敗、非有限値、または不安定な拘束がある |

### 参照元変更の影響

依存Sketchのsolve失敗時の扱いは、[編集の確定と失敗](contracts/編集と履歴.md)の操作別の復元範囲に従う。一般の参照更新と、ドラッグ・Parameter適用の操作全体の確定を区別する。

## 9. Geometry の削除

[正本](operations/作図と形状編集.md#2-geometryの削除)を参照する。

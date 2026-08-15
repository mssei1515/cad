# Geometry と拘束

## 1. Geometry 要素

| 要素 | 保持する形状 | 主な編集 |
| --- | --- | --- |
| Point | `x`, `y`, `fixed`, `kind` | 移動、固定／解除 |
| Line | 共有 Point `p1`, `p2`, `construction` | 端点・線全体の移動、補助線切替 |
| Circle | 中心 Point、`radiusValue`, `construction` | 中心移動、半径ドラッグ、補助切替 |
| Arc | 中心 Point、半径、開始角、終了角、`construction` | 中心・半径・両端の編集、補助切替 |

すべての Geometry は作図可能な1つの Sketch に所属する。Block Projection は同じ型として選択・描画されるが、Definition と Instance から導出される読み取り専用 Geometry である。

モデル長の下限は `1e-6` である。Line、Circle、Arc の作成、読込、拘束追加ではゼロ長または下限近傍への崩壊を防止・補正する。

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

GeometryとBlock Projectionの参照は`GeometryRef { kind, path[] }`として扱う。kindは`point`、`line`、`circle`、`arc`のいずれかで、pathは1要素以上の文字列配列である。通常GeometryのIDは1要素、Projectionの階層は`@`で区切った複数要素として表す。

Constraintの各Geometry参照fieldは保存形式上は従来どおりbare IDを使う。例えば入れ子Projectionを参照するLine拘束は`"line": "BI1@BI2@L1"`となり、kindを保存文字列へ追加しない。保存時はGeometryの型とIDから共通codecでcanonical IDを生成し、読込時はConstraint fieldが要求するkindとbare IDから共通resolverで実体を引く。

複数kindを許すfieldの解決順は次のとおりである。

- Offsetのsource／offsetはLine、Circle、Arcの順に解決する。
- Concentricのa／bはPoint、Circle、Arcの順に解決する。
- CircleまたはArcを許すprimitive fieldはCircle、Arcの順に解決する。

参照を解決できない場合のConstraint読込エラーと、Constraint型ごとの保存・復元規則は従来どおりである。Constraint型分岐は参照codecとは別の責務として保持する。

## 2. 作図コマンド

### 点

1クリックで explicit Point を作る。スナップ先があれば同じ座標に配置し、同一 Sketch 内で必要な一致拘束等を追加する。別 Sketch へのスナップは位置だけを利用し、通常拘束を自動追加しない。

### 連続線

クリック列から Line を連続作成する。既存端点へスナップした場合は Point を共有できる。Shift を押したクリックでは前点から水平または垂直に近い方向へ固定し、対応する拘束を追加する。Esc で現在の連続作図を終了する。

### 矩形

対角2点から4本の Line を作り、水平・垂直関係を付ける。幅・高さが下限未満にならないよう補正する。

### 円

中心、円周上の順に2クリックして作る。半径は独立変数である。

### 円弧

中心、開始点、終了点の順に3クリックして作る。向きを持つ開始角・終了角として保存する。

### 補助 Geometry

補助切替は Line、Circle、Arc に適用する。選択中の対象があれば対象の `construction` を切り替え、対象がなければ今後作成する Geometry の既定値を切り替える。

### R面取り

接続する2本の Line と半径から接線 Arc を作る。元 Line の端をトリムし、接線関係と半径寸法を構成する。成立しない半径や Geometry では作成しない。

### トリム

Line、Circle、Arc と他 Geometry の交点からクリック区間を除去する。Line の中間区間を除く場合は分割し、保持側の Point 拘束を新しい Line へ移送する。対象を参照する成立不能な拘束は整理する。

### オフセット

Line、Circle、Arc を選び、側と距離を入力して複製する。元と複製の間に `OffsetConstraint` を置くため、後から寸法として編集できる。

## 3. 選択と編集

- 単一クリック後のドラッグで Point、Line、Circle、Arc、Arc 端点を編集する。
- Shift/Ctrl クリックで加算・解除選択する。
- 左から右の矩形選択は完全包含、右から左は交差選択とする。
- 選択 Geometry はコピー、切り取り、貼り付けできる。
- 貼り付け先は現在のアクティブ Sketch で、繰り返すごとに画面上24px相当ずつずらす。
- コピー範囲内で閉じる拘束を複製する。範囲外への拘束は複製しない。
- Block Instance は、内部で閉じる外部拘束とともにコピーできる。

ドラッグ中は選択に関係する拘束連結成分だけを優先して local solve し、必要な場合に全 Sketch solve へフォールバックする。Pointer-up では最終精度で solve する。

## 4. 拘束コマンド

UIで利用できる組み合わせを次に示す。

| UI | 保存型 | 対象 |
| --- | --- | --- |
| 寸法 | `distance` | Point–Point の実距離、Line 長 |
| 寸法 | `pointAxisDistance` | Point–Point の水平／垂直距離 |
| 寸法 | `pointLineDistance` | Point–Line 距離 |
| 寸法 | `lineLineDistance` | 平行 Line 間距離 |
| 寸法 | `lineAngle` | 2 Line の角度 |
| 寸法 | `radiusDimension` | Circle/Arc 半径 |
| 寸法 | `diameterDimension` | Circle 直径 |
| オフセット | `offsetDimension` | 元とオフセット先の距離 |
| 一致 | `coincident` | 2 Point |
| 一致 | `pointOnLine` | Point–Line |
| 一致 | `pointOnCircle` | Point–Circle/Arc |
| 一致 | `arcEndpointCoincident` | Arc 端–Point |
| 一致 | `arcEndpointArcEndpointCoincident` | 2 Arc 端 |
| 一致 | `arcEndpointOnLine` | Arc 端–Line |
| 一致 | `arcEndpointOnCircle` | Arc 端–Circle/Arc |
| 一致／同一直線 | `collinear` | 2 Line |
| 水平 | `horizontal` | 1 Line |
| 水平 | `pointHorizontal` | 2 Point のY一致 |
| 垂直 | `vertical` | 1 Line |
| 垂直 | `pointVertical` | 2 Point のX一致 |
| 平行 | `parallel` | 2 Line |
| 直交 | `perpendicular` | 2 Line |
| 対称 | `symmetry` | 対称軸 Line、2 Point |
| 対称 | `lineSymmetry` | 対称軸 Line、2 Line |
| 等寸 | `equalLength` | 2 Line |
| 等寸 | `equalRadius` | Circle/Arc 2つ |
| 同心 | `concentric` | Point–Circle/Arc、または Circle/Arc 2つ |
| 接線 | `lineCircleTangent` | Line–Circle/Arc |
| 接線 | `circleCircleTangent` | Circle/Arc 2つ |
| 固定 | Point の `fixed` | 1つ以上の Point |
| 固定 | `lineFixed` | Line の両端位置 |
| 固定 | `arcEndpointFixed` | Arc 端位置。内部的に利用する |

`pointOnLineMidpoint` は保存・solve に対応する内部型だが、現在のツールバーに独立コマンドはない。

## 5. 拘束追加のルール

1. 通常拘束の対象はアクティブ Sketch に属する。
2. 別 Sketch の対象を含む場合は、アクティブ Sketch とその先祖 Sketch の組み合わせだけを参照拘束として許可する。
3. 子孫、兄弟、別ブランチは参照できない。
4. 新しい拘束を一時追加して solve し、総残差が有限かつ受入れ許容誤差以下なら、反復の終了理由にかかわらず成立として扱う。許容誤差を超える、非有限値になる、または不安定になる場合はロールバックする。
5. 既存拘束と重複する寸法は、形状を変えない読み取り専用寸法として追加する。
6. 単一 Block Instance 内の Projection だけを測る寸法も読み取り専用にする。Definition のサイズ変更は Block Editor で行う。
7. 新規拘束によって十分長かった Line が下限近傍へ崩壊する場合は拒否する。

## 6. 拘束寸法と読み取り専用寸法

拘束寸法は solve の目標値であり、値変更によって Geometry を変形する。寸法線の位置、ラベル位置、表示方向は `dimension` に保存する。

読み取り専用寸法は `readOnlyDimension = true`、`enabled = false` とし、実測値を括弧付きで表示する。数値入力は表示しない。

Geometry Mode ではアクティブ Sketch に所属する寸法だけを描画する。

## 7. 数値表示

- 拘束寸法は `1e-6` 以内の浮動小数誤差を簡潔な10進値へ正規化する。
- 読み取り専用寸法と Presentation 注記寸法は実測値のため `1e-5` を使う。
- ゼロではない値をゼロへ丸めない。
- 小数部がゼロなら整数表示し、末尾の不要なゼロを除く。
- 角度ラベルには `°` を付ける。
- 寸法テキストは象限に応じ、上下反転しない JIS 読み方向へ調整する。

コードは長さに `mm` の文字列を付けず、Document に単位メタデータも持たない。既存仕様で mm と記載されていた値は、現状では「モデル単位」と解釈するのが正確である。

## 8. solve と状態表示

ソルバーは数値ヤコビアンと減衰付き最小二乗法を使う。通常の収束許容誤差は `1e-7`、拘束追加・編集の受入れ判定は概ね `1e-4` である。`lambda上限` や最大反復で停止しても、総残差が有限かつ受入れ許容誤差以下なら、操作は成立として扱う。

Geometry は解析結果により次の状態で描き分ける。

| 状態 | 意味 |
| --- | --- |
| 完全拘束 | 対象自由度が拘束されている |
| 支持位置拘束 | 固定 Geometry の影響で位置が拘束されている |
| 未拘束 | 1つ以上の自由度が残る |
| 矛盾 | solve 失敗、非有限値、または不安定な拘束がある |

参照元 Sketch の変更後、依存 Sketch の solve が失敗しても参照元の変更は戻さず、依存側をエラー状態にする。

## 9. Geometry の削除

Geometry の削除時は、共有 Point の利用状況を考慮して不要 Pointを整理し、対象を参照する拘束と拘束寸法を除去する。1回のユーザー操作は1つの履歴単位にする。

Presentation styleとPresentation Elementも同時に除去するのが参照ライフサイクル上の期待仕様だが、通常Documentの直接Geometry削除では現在残存する。Sketch削除、Block Instance削除、Block Definition編集では整理される。この差は既知の不整合である。

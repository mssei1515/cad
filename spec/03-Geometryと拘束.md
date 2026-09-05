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

### 点

1クリックで explicit Point を作る。スナップ先があれば同じ座標に配置し、同一 Sketch 内で必要な一致拘束等を追加する。別 Sketch へのスナップは位置だけを利用し、通常拘束を自動追加しない。

空白位置のdouble clickで点作図commandを終了する。終了判定のためにdouble clickの1回目で一時作成されたPointは、Geometry、履歴およびSelectionから破棄し、後続の拘束・寸法commandの対象に含めない。

### 連続線

クリック列から Line を連続作成する。既存端点へスナップした場合は Point を共有できる。Shift を押したクリックでは前点から水平または垂直に近い方向へ固定し、対応する拘束を追加する。Esc で現在の連続作図を終了する。

### 中心線

Geometry menuまたはToolbarの中心線commandから、同じアクティブSketchにある平行な2本のLine、または2つのPointを基準に補助Lineを作る。対象をあらかじめ2つ選択してからcommandを開始する方法と、command開始後に1つずつ選択する方法を利用できる。基準確定後は中心線の両端点をCanvas上で順にclickし、各click位置を求めた支持直線へ投影して長さを決める。

平行な2本のLineでは、両Lineを無限に延長した支持直線に平行かつ等距離な支持直線へ中心線を置く。2つのPointでは、2点を結ぶ線分の垂直二等分線を中心線の支持直線とする。どちらも中心線の支持位置と方向だけを拘束し、中心線の長さと両端点の支持直線方向位置は拘束しない。このため作成後も各端点を支持直線上で独立して移動できる。端点指定中は既存Geometryへ通常作図と同じスナップを行い、確定した端点へ一致、Point-on-Line、Point-on-CircleまたはPoint-on-Splineの該当拘束を追加する。中心線の支持条件とスナップ拘束が同時に成立しない場合は作成全体をロールバックする。中心線は`construction = true`で作成し、対応する保存型は`parallelLinesCenterline`と`pointPairCenterline`である。

Geometry menuまたはToolbarの円中心十字線commandは、同じアクティブSketchにあるCircleを対象に、各円の上下端を結ぶ垂直な補助Lineと左右端を結ぶ水平な補助Lineを一括作成する。Circleをあらかじめ1つ以上選択してcommandを実行する方法と、command開始後に1つのCircleをclickする方法を利用できる。各LineにはCircle中心PointのPoint-on-Line拘束、水平または垂直拘束、および両端PointのPoint-on-Circle拘束を追加する。事前選択した全Circle分のLineと拘束は1回のUndo/Redoで扱い、いずれかの拘束を成立させられない場合は作成全体をロールバックする。専用の保存型は追加せず、既存の`pointOnLine`、`horizontal`、`vertical`、`pointOnCircle`を使用する。

### 矩形

対角2点から4本の Line を作り、水平・垂直関係を付ける。幅・高さが下限未満にならないよう補正する。

### 長穴

Geometry menuまたはToolbarの長穴commandから、1つ目の半円中心、2つ目の半円中心、幅位置の順に3回clickして作る。2中心を結ぶ線へ幅位置から下ろした垂線距離を半径とし、幅位置を指定した側と反対側に平行なLineを1本ずつ、両端に半円のArcを1本ずつ作る。2中心が同一点になる入力と、幅位置が中心線上になる入力は拒否し、該当段階から再指定できる。

作成結果は専用の複合Geometryではなく、通常のLine 2本、Arc 2本および各定義Pointとして保存する。4つのLine–Arc接続には円弧端点一致と接線関係を、2つのArcには等半径関係を自動追加し、作成後の編集でも閉じた長穴形状を維持する。1・2点目のスナップは各Arc中心へ、3点目のスナップは指定側Lineへ拘束として残す。通常／補助作図の現在値は4本のGeometryすべてへ適用する。入力途中のEscは指定済みの点を破棄し、入力点がない状態のEscは選択modeへ戻る。

### 円

中心、円周上の順に2クリックして作る。半径は独立変数である。

### 円弧

中心、開始点、終了点の順に3クリックして作る。向きを持つ開始角・終了角として保存する。

### 3点円弧

既存の中心指定円弧とは別の「3点円弧」コマンドを使用し、開始点、終了点、円周上の通過点の順に3クリックして作る。3点を通る円の中心と半径を算出し、開始点から終了点までの2つの候補のうち、指定した通過点を含む向き付き円弧を作成する。このため、通過点の位置に応じて半円未満と半円超のどちらも作図できる。3点の重複または同一直線上に近い配置では作成せず、再指定を求める。

開始点と終了点には通常の円弧端点スナップ拘束を適用し、通過点のスナップ先には円の円周指定と同じPoint-on-Circle等の拘束を追加する。3点円弧の確定後に保持するデータモデルは通常のArcと同じ中心Point、半径、開始角、終了角であり、作図方式を示す追加の永続fieldは持たない。Escは確定前の入力点を破棄し、入力点がない状態でのEscは選択modeへ戻る。

### スプライン

ToolbarまたはGeometry menuから開始し、3個以上のfit pointを順にclickして3次Splineを作る。確定・取消・fit point編集の操作は[スプライン](./10-スプライン.md)の「作成と編集」に従う。

### スケッチ投影

表示中の先祖SketchにあるPoint、Line、Circle、Arc、Spline、Block Projectionを参照し、アクティブSketchへ1個の`sketchProjection`派生Instanceとして投影する。clickまたはドラッグ範囲選択で候補を追加し、個別clickで解除する。Enterまたは右clickメニューの「実行」で一括作成、Escで全候補を破棄する。同じ元Geometryの重複を作らない。出力は通常Geometry配列へ追加せず、元のPoint共有関係を保つ読取専用の仮想Geometryとする。詳細は[派生Geometryインスタンス](./12-スケッチ投影.md)を参照する。

### 補助 Geometry

補助切替は Line、Circle、Arc、Spline に適用する。選択中の対象があれば対象の `construction` を切り替え、対象がなければ今後作成する Geometry の既定値を切り替える。

通常GeometryはAppearanceで解決した色、線種、線幅、visibleを使用する。線種は実線、破線、一点鎖線、二点鎖線、点線から選択する。初期の基底線幅は2.0pxであり、各SketchのAppearanceはDocument既定を直接継承して所属Sketch自身の明示fieldだけを上書きする。補助GeometryではDocumentの補助線外観を基底とし、所属Sketch自身の補助線外観だけを適用する。DocumentとSketchのどちらでも一般外観は補助線外観へ継承しない。初期基底は一点鎖線、1px、通常時の不透明度72%とし、その後にGeometryの明示Appearanceを適用する。ダークテーマでは保存したAppearanceを変更せず、Canvas描画時だけ[UI・操作・履歴](./07-UI・操作・履歴.md)のcontrast補正を適用する。補助LineのendpointOverhangがtrueなら両端から画面上12pxずつ延長し、endpointMarkersがtrueなら元の両端へ点を描画する。Geometry自身または所属Block Instanceのhover／選択中も設定したはみ出しを維持する。Constraint Status Viewでも、補助LineはendpointMarkersの設定に従って外観設定由来の端部の点を表示する。通常Lineの端点操作マーカーはCanvasで直接hoverまたは選択した端点だけに表示する。選択とhoverは一時的な強調を優先し、Space押下中は拘束状態色を優先する。

### R面取り

接続する2本の Line を選んだ後、共有端点からマウスポインターまでの距離をR寸法としてプレビューし、次のクリックで接線 Arc を確定する。固定の初期半径や数値入力を作成条件には使用しない。ポインター距離が直線部を残せる最大半径を超える場合は、プレビューと確定値をその最大半径未満へ制限する。元 Line の端をトリムし、接線関係と半径寸法を構成する。接続関係、角度、線長のために成立しない Geometry では作成しない。

### トリム

Line、Circle、Arc と同じアクティブSketch内の通常Geometryとの交点からクリック区間を除去する。補助Line／Circle／Arcとの交点は区間境界に使用しない。補助Geometry自身はトリム対象にでき、通常Geometryとの交点で区間を判定する。Line の中間区間を除く場合は分割し、保持側の Point 拘束を新しい Line へ移送する。直径寸法を持つCircleのトリム結果が1本のArcになる場合は、寸法の値・数式・Parameter名・配置・外観を保ったままそのArcへ直径寸法を移送する。トリム後に複数のArcが残る場合は、移送先を選ばず元の直径寸法を削除する。その他の対象を参照する成立不能な拘束は整理する。

### オフセット

Circleは単独で選び、側と距離を入力して複製する。Line／Arcは1要素の従来操作に加え、コマンド中に1本ずつ順番に追加して1つのチェーンとしてオフセットできる。チェーン選択はCanvas空白clickまたはEnterで確定し、空白clickの場合はその位置をそのまま側と概算距離にも使用する。

チェーンの接続は座標の近さから推測せず、共有Point、`coincident`、`arcEndpointCoincident`、`arcEndpointArcEndpointCoincident`、または既存`offsetChainDimension`の結合で明示された同一Sketch内の端部だけを認める。開チェーンと閉チェーンを扱い、LineとArcを混在できる。角部は隣接するオフセット支持線／支持円を延長またはトリムしてマイター接続する。指定距離によるArc半径の崩壊、接続不能、結果の退化または自己交差がある場合は作成しない。

単一要素には`OffsetConstraint`、2要素以上にはチェーン全体と1つの距離を保持する`OffsetChainConstraint`を置く。チェーン拘束は基準Geometry列、進行方向、結果Geometry列、開閉、側、マイター結合、寸法を代表するsegment indexを保持するため、元Geometryの変形および寸法編集後も全結果を再計算する。作成、距離変更、solveのいずれかが失敗した場合はチェーン全体を操作前へ戻し、1回の作成を1つのUndo単位にする。

### ハッチング

アクティブSketchの通常Line、Circle、Arc、Splineが作る閉領域内をclickして、境界へ関連付いたHatchを作る。外観は平行線、互いに直交するクロス、色塗りつぶしから選択する。補助Geometry、非アクティブSketch、Block Projectionは境界候補に含めない。未分割交差も内部の平面グラフで分割して面を検出し、内側の閉輪郭は穴として除外する。1clickごとに1つのUndo単位で確定し、Escまで連続作成する。詳細な境界追従と無効化は[ハッチング](./09-ハッチング.md)を参照する。

## 3. 選択と編集

- 単一クリック後のドラッグで Point、Line、Circle、Arc、Arc 端点、Spline全体を編集する。Splineのfit pointは専用編集mode中だけ表示・dragする。
- Arc本体のhover／選択では端点ハンドルを表示しない。Arc端点を直接hover、選択、ドラッグしている場合だけ対象端点の操作ハンドルを表示する。
- Shift/Ctrl クリックで加算・解除選択する。
- 左から右の矩形選択は完全包含、右から左は交差選択とする。
- 選択 Geometry はコピー、切り取り、貼り付けできる。
- 貼り付け先は現在のアクティブ Sketch で、繰り返すごとに画面上24px相当ずつずらす。
- コピー範囲内で閉じる拘束を複製する。範囲外への拘束は複製しない。
- Block Instance は、内部で閉じる外部拘束とともにコピーできる。
- 同じParameter名前空間へ寸法をコピーすると新しい`dN`を付与し、同時にコピーした寸法間の参照だけを新しい名前へトークン単位で書き換える。
- 別のParameter名前空間へコピーすると、拘束寸法式をコピー時点の評価値による数値式へ固定して新しい`dN`を付与する。
- HatchのCopy／Cut／PasteとBlock化は参照する全境界Geometryの同時選択を必須とし、不足時は操作全体を拒否する。Pasteでは境界GeometryRefを新IDへ書き換える。
- 派生Instanceの生成Geometryはsnap、拘束、寸法、Hatch、Leaderに使用できる。通常選択はInstance単位、拘束・寸法コマンドでは生成Geometry単位とする。スケッチ投影の生成Geometryは所属する子Sketch内の通常Geometryと通常拘束でき、先祖Sketchの参照元は読取専用の入力として扱う。同一Sketch内で完結するミラー／直線パターンの生成Geometryは、dragを派生変換で逆変換して最終的な参照元Geometryの通常dragとして処理し、参照元の拘束を維持する。スケッチ投影およびスケッチ投影を経由する派生chainは、子Sketchから先祖Sketchを変更しないためdragを拒否する。trim、fillet、通過Point追加・削除などのSpline構造編集、固定、通常／補助作図切替は派生側で拒否する。AppearanceはInstanceの上書きとして編集できる。

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

Pointer-upでの最終検証と失敗時の復元は、[編集の確定と失敗](./13-編集の確定と失敗.md)のTX-02および「Geometryドラッグの確定」に従う。

## 4. 拘束コマンド

UIで利用できる組み合わせを次に示す。

| UI | 保存型 | 対象 |
| --- | --- | --- |
| 寸法 | `distance` | Point–Point の実距離、Line 長 |
| 寸法 | `pointAxisDistance` | Point–Point の水平／垂直距離 |
| 寸法 | `pointLineDistance` | Point–Line 距離 |
| 寸法 | `lineLineDistance` | 平行 Line 間距離 |
| 寸法 | `lineCircleDistance` | Line の無限支持線–Circle 中心距離 |
| 寸法 | `concentricRadiusDifferenceDimension` | 同心の Circle/Arc 2つの半径差と中心一致 |
| 寸法 | `lineAngle` | 2 Line の角度 |
| 寸法 | `radiusDimension` | Circle/Arc 半径 |
| 寸法 | `diameterDimension` | Circle 直径。Circleのトリム結果が1本のArcの場合はそのArcへ移送 |
| オフセット | `offsetDimension` | 元とオフセット先の距離 |
| オフセット | `offsetChainDimension` | 2本以上のLine／Arcチェーンとオフセット先の共通距離・マイター接続 |
| 一致 | `coincident` | 2 Point |
| 一致 | `pointOnLine` | Point–Line |
| 一致 | `pointOnCircle` | Point–Circle/Arc |
| 一致 | `pointOnSpline` | Point–Spline。曲線parameterもsolver変数として保持する |
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
| 対称 | `arcSymmetry` | 対称軸 Line、2 Arc |
| 等寸 | `equalLength` | 2 Line |
| 等寸 | `equalRadius` | Circle/Arc 2つ |
| 同心 | `concentric` | Point–Circle/Arc、または Circle/Arc 2つ |
| 接線 | `lineCircleTangent` | Line–Circle/Arc |
| 接線 | `circleCircleTangent` | Circle/Arc 2つ |
| 接線 | `splineLineTangent` | 開Spline端点–Line。端点接線方向を一致させる |
| 接線 | `splineSplineTangent` | 2つの開Spline端点。端点接線方向を一致させる |
| 中心線 | `parallelLinesCenterline` | 平行な2 Lineの等距離な支持直線と補助Line |
| 中心線 | `pointPairCenterline` | 2 Pointの垂直二等分線と補助Line |
| 固定 | Point の `fixed` | 1つ以上の Point |
| 固定 | `lineFixed` | Line の両端位置 |
| 固定 | `arcEndpointFixed` | Arc 端位置。内部的に利用する |

Lineの中点を候補にするスナップと`pointOnLineMidpoint`拘束は使用しない。中心位置が必要な場合は中心線commandで意図を明示する。

Line–Circleの中心距離寸法は、Line本体とCircle円周をどちらの順でclickしても作成できる。測定対象は有限線分までの最短距離や円周までのすき間ではなく、Lineを両方向へ無限に延長した支持線からCircle中心までの垂直距離である。LineとArcの組み合わせには適用しない。

同心半径差寸法は、中心が一致しているCircle／Arcの円周または円弧を2つclickして作成する。Circle–Circle、Circle–Arc、Arc–Arcの全組み合わせを許可し、入力値は2つの半径の差の絶対値とする。作成時の大小関係を保持したまま半径差を拘束し、同じ拘束の中心X差・中心Y差を0にすることで同心関係も維持する。対象が同心と判定できない場合は作成せず、理由をHintへ表示する。

対称拘束は対象の種類ごとに次の量だけを拘束する。

- Point対称は、2 Pointの中点を対称軸上へ置き、2 Pointを結ぶ方向を対称軸へ直交させる。
- Line対称は、各Lineを両方向へ無限に延長した支持直線どうしを対称軸に対する鏡像にする。拘束するのは支持直線の方向と位置だけであり、Lineの中点、長さ、始点・終点の対応や各端点の支持直線方向位置は拘束しない。一方のLineと対称軸を固定した場合も、もう一方の各端点には支持直線方向の独立した自由度が残り、一端だけを伸縮できる。既存JSONの`lineSymmetry.reversed`は互換的に往復保存するが、端点対応を表す拘束条件としては使用しない。
- Arc対称は、2 Arcの中心位置を対称にし、半径を一致させる。開始角・終了角および端点位置は対称拘束の対象にせず、それぞれ独立して変更できる。

## 5. 拘束追加のルール

1. 通常拘束の対象はアクティブ Sketch に属する。
2. 別 Sketch の対象を含む場合は、アクティブ Sketch とその先祖 Sketch の組み合わせだけを参照拘束として許可する。
3. 子孫、兄弟、別ブランチは参照できない。
4. 新しい拘束を一時追加して solve し、総残差が有限かつ受入れ許容誤差以下なら、反復の終了理由にかかわらず成立として扱う。許容誤差を超える、非有限値になる、または不安定になる場合はロールバックする。
5. 既存拘束と重複する寸法は、形状を変えない読み取り専用寸法として追加する。
6. 単一 Block Instance 内の Projection だけを測る寸法も読み取り専用にする。Definition のサイズ変更は Block Editor で行う。
7. 新規拘束によって十分長かった Line が下限近傍へ崩壊する場合は拒否する。
8. Splineの接線拘束は開Splineの始点または終点だけに作成できる。端点接線拘束を持つSplineを閉Splineへ変更する操作は拒否する。

## 6. 拘束寸法と読み取り専用寸法

拘束寸法は数値または数式を入力とし、評価結果をsolveの目標値`target`へ反映する。値変更によってGeometryを変形する。寸法線の位置、ラベル位置、表示方向は`dimension`に保存する。

読み取り専用寸法は`readOnlyDimension = true`、`enabled = false`とし、Geometryから取得した実測値を括弧付きで表示する。式と数値入力は表示せず、読み取り専用symbolとして他のParameterおよび拘束寸法式から参照できる。

すべての寸法は所属Parameter名前空間で一意な`parameterName`を持つ。新規寸法は名前空間固有のcounterから`d1`、`d2`、…を付与し、ユーザーは有効かつ一意な識別子へ変更できる。名称変更では同じ名前空間にある全数式の該当識別子tokenを一括更新する。非表示または無効な寸法もsymbolとして存在する限り参照できる。

単一Canvasでは表示中の全Sketchに所属するConstraint Dimensionを描画する。非アクティブSketchであることだけを理由に寸法を非表示にしない。

## 7. 数値表示

- 拘束寸法は `1e-6` 以内の浮動小数誤差を簡潔な10進値へ正規化する。
- 読み取り専用寸法は実測値のため `1e-5` を使う。
- ゼロではない値をゼロへ丸めない。
- 小数部がゼロなら整数表示し、末尾の不要なゼロを除く。
- 角度ラベルには `°` を付ける。
- 寸法テキストは象限に応じ、上下反転しない JIS 読み方向へ調整する。

Documentは`units: { length: "mm" }`を持ち、Geometry座標、半径、長さ拘束、距離拘束および参照寸法の長さ値をmmとして保存・計算する。Canvas上の寸法ラベルは従来どおり数値だけを表示し、単位文字列を自動付加しない。角度寸法の値は度とする。

## 8. solve と状態表示

### 収束と受入れ

ソルバーは数値ヤコビアンと減衰付き最小二乗法を使う。通常の収束許容誤差は `1e-7`、拘束追加・編集の受入れ判定は概ね `1e-4` である。`lambda上限` や最大反復で停止しても、総残差が有限かつ受入れ許容誤差以下なら、操作は成立として扱う。

### Parameterを含む確定操作

評価手順、反復上限、収束判定は[Parameter](./08-Parameter.md)の「評価とsolve」に従う。失敗時の復元と履歴は[編集の確定と失敗](./13-編集の確定と失敗.md)のTX-01に従う。

### 拘束状態の表示

Geometry は解析結果により次の状態で描き分ける。

| 状態 | 意味 |
| --- | --- |
| 完全拘束 | 対象自由度が拘束されている |
| 支持位置拘束 | 固定 Geometry の影響で位置が拘束されている |
| 未拘束 | 1つ以上の自由度が残る |
| 矛盾 | solve 失敗、非有限値、または不安定な拘束がある |

### 参照元変更の影響

依存Sketchのsolve失敗時の扱いは、[編集の確定と失敗](./13-編集の確定と失敗.md)の操作別の復元範囲に従う。一般の参照更新と、ドラッグ・Parameter適用の操作全体の確定を区別する。

## 9. Geometry の削除

Geometry の削除時は、共有 Point の利用状況を考慮して不要 Pointを整理し、対象を参照する拘束と拘束寸法を除去する。ただし削除後も残る式が削除対象の寸法symbolを参照する場合は、依存元の名前を表示して操作を拒否する。依存元も同時に削除する操作、または名前空間全体の削除は許可する。1回のユーザー操作は1つの履歴単位にする。

Geometryを削除すると、そのGeometryを参照するConstraintとLeaderも同時に除去する。Splineを削除すると、そのSplineだけで使用されるfit pointも整理する。Hatchの境界Geometryは例外であり、Hatch Objectを残したまま境界エラーの無効状態にする。Sketch削除では所属Hatchも削除する。Sketch削除、Block Instance削除、Block Definition編集でも各Objectの参照ライフサイクルを適用する。

派生Instanceが参照する元Geometry、Block Instance、ミラー軸、パターン方向または上流Instanceの削除は拒否する。依存Instanceを先に削除しなければならず、通常Geometryへ独立化する操作は設けない。

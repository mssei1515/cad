# Cad2：Geometry / Presentation 仕様案

## 1. 基本方針

Cad2 では、図形を定義する情報と、見え方を定義する情報を分離する。

```text
Geometry
Presentation
```

Geometry は、図形の形状、寸法拘束、図形同士の関係、スケッチ階層を定義するための情報である。

Presentation は、作成済みの Geometry をどのように見せるかを定義するための情報である。

Presentation は Geometry を参照できるが、Geometry の形状や拘束状態は変更しない。

## 2. モード名称

Cad2 では、作業目的に応じて次の2つのモードを設ける。

```text
正式名：
Geometry Mode / Presentation Mode

UI表示：
ジオメトリモード / プレゼンテーションモード

内部ID：
geometry / presentation
```

## 3. Geometry Mode

Geometry Mode は、図形そのものを定義するためのモードである。

このモードでは、例として次の情報を扱う。

```text
- 点
- 線
- 円
- 円弧
- 矩形
- R面取り
- トリム
- スケッチ
- 親子スケッチ構造
- 拘束条件
- 拘束寸法
```

Geometry Mode で扱う寸法は、図形の形状を決定するための寸法である。
この寸法は拘束条件として扱われ、ソルバーの対象になる。

## 4. Presentation Mode

Presentation Mode は、図形の見え方を定義するためのモードである。

このモードでは、例として次の情報を扱う。

```text
- 注記寸法
- 注記テキスト
- 引出線
- 矢印
- ラベル
- 図形の表示／非表示
- 線色
- 線種
- 線幅
- 透明度
- 表示用補助線
- 塗りつぶし
- ハッチング
```

Presentation Mode で扱う情報は、図形の成立条件ではなく、図面としての表現を定義するものである。

Presentation Mode で追加・編集した情報は、Geometry の拘束計算には影響しない。

## 5. Presentation Sheet

Cad2 では、Presentation を **Presentation Sheet** として管理する。

Presentation Sheet は、Geometry の見え方を定義するためのシートである。

1つの Cad2 データの中に、複数の Presentation Sheet を定義できる。

```text
Presentation
├─ Sheet A
├─ Sheet B
└─ Sheet C
```

それぞれの Presentation Sheet は、同じ Geometry に対して、異なる見え方を定義できる。

たとえば、次のような使い分けができる。

```text
- 部品単体を見せるシート
- 寸法を多く入れた詳細図シート
- 塗りつぶしや色分けを使った説明用シート
- ブログや資料に使う見栄え重視のシート
- 印刷用に注記を整理したシート
```

この考え方により、Geometry を1つだけ持ちながら、用途に応じた複数の図面表現を作れる。

## 6. スケッチ階層と Presentation Sheet の関係

Cad2 では、スケッチ階層と Presentation Sheet は独立した概念として扱う。

スケッチは、Geometry を整理するための単位である。

```text
Sketch
→ Geometry と Constraint を整理するための階層
```

Presentation Sheet は、Geometry の見え方を整理するための単位である。

```text
Presentation Sheet
→ Geometry の表示方法、注記、スタイル、塗り、ハッチングを整理するためのシート
```

Presentation Sheet は、特定のスケッチには所属しない。
また、Presentation 要素も特定のスケッチには所属しない。

Presentation 要素は、必要に応じて Geometry 要素を参照する。

```text
Presentation 要素
→ スケッチには所属しない
→ Presentation Sheet に所属する
→ 必要に応じて Geometry を参照する
```

## 7. スケッチ表示／非表示との関係

Presentation Sheet は、スケッチの表示／非表示状態とは独立して扱う。

スケッチの表示／非表示が変更された場合でも、Presentation 要素の表示／非表示は自動的には追従しない。

つまり、次のように扱う。

```text
スケッチの表示状態
→ Geometry 側の表示制御

Presentation 要素の表示状態
→ Presentation Sheet 側の表示制御
```

Presentation 要素を表示するかどうかは、Presentation Sheet 側で管理する。

この方針により、スケッチ階層の表示状態と、図面としての表現状態が混ざらない。

## 8. 線色・線種・線幅の扱い

線色、線種、線幅などの見え方は、Geometry ではなく Presentation 側で管理する。

つまり、Geometry の線は、基本的には形状情報のみを持つ。

```text
Geometry の線
→ 始点、終点、拘束関係などを持つ

Presentation 側の線表示
→ 線色、線種、線幅、透明度などを持つ
```

同じ Geometry の線であっても、Presentation Sheet ごとに異なる見え方を設定できる。

たとえば、同じ線に対して次のような表現が可能になる。

```text
Sheet A：黒い実線
Sheet B：薄いグレーの破線
Sheet C：赤い太線
```

この方針により、Geometry は純粋な形状定義として保ち、見え方は Presentation Sheet ごとに自由に定義できる。

## 9. 寸法の分類

Cad2 では、寸法を次の2種類に分類する。

```text
拘束寸法
注記寸法
```

### 9.1 拘束寸法

拘束寸法は、Geometry Mode で扱う寸法である。

拘束寸法は、図形の形状を決めるための寸法であり、拘束条件として扱われる。

```text
- 図形の形状を決定する
- 拘束条件として扱う
- 値を変更すると図形が変化する
- ソルバーの対象になる
```

### 9.2 注記寸法

注記寸法は、Presentation Mode で扱う寸法である。

注記寸法は、図面上に寸法を表示するための要素であり、拘束条件としては扱わない。

```text
- 図面上に寸法値を表示する
- Geometry を参照する
- 値を表示するが、形状は変更しない
- ソルバーの対象にならない
- 配置位置や見え方を調整できる
```

注記寸法は Presentation Sheet に所属する。

同じ Geometry に対して、Presentation Sheet ごとに異なる注記寸法を配置できる。

## 10. Geometry と Presentation の参照関係

Presentation 要素は、必要に応じて Geometry 要素を参照できる。

たとえば、注記寸法は、点、線、円、円弧などを参照して寸法値を表示する。

線色・線種・線幅の設定も、Presentation 側から Geometry 要素を参照して定義する。

ただし、Presentation 要素が Geometry 要素を参照していても、Geometry 要素の形状や拘束状態は変更しない。

```text
Geometry
→ 形状を定義する

Presentation
→ Geometry を参照して、見え方を定義する
```

## 11. モード切り替え時の基本ルール

Geometry Mode では、Geometry の作成・編集・拘束定義を行う。

Presentation Mode では、現在選択されている Presentation Sheet に対して、Presentation 要素の作成・編集を行う。

```text
Geometry Mode
- 図形を作成できる
- 図形を編集できる
- 拘束条件を追加できる
- 拘束寸法を追加できる
- Presentation 要素は原則として編集しない

Presentation Mode
- Presentation Sheet を選択できる
- 注記寸法を追加できる
- 注記テキストを追加できる
- 線色、線種、線幅を設定できる
- 塗りつぶしやハッチングを追加できる
- Geometry を参照・選択できる
- Geometry の形状は原則として変更しない
- 拘束条件は追加しない
```

Presentation Mode でも、対象指定のために Geometry を選択できる。
ただし、その選択は Presentation 要素を作成・編集するためのものであり、Geometry の形状変更を目的としない。

## 12. UI上の考え方

UI上では、現在のモードを明確に表示する。

```text
ジオメトリモード
プレゼンテーションモード
```

Geometry Mode では、図形作成と拘束定義に関するツールを中心に表示する。

Presentation Mode では、Presentation Sheet の選択と、注記寸法、注記、線色、線種、塗りつぶし、ハッチングなどのツールを中心に表示する。

Presentation Mode では、現在編集中の Presentation Sheet が分かるようにする。

## 13. まとめ

Cad2 では、図形定義と見え方定義を分離する。

```text
Geometry
Presentation
```

Geometry は、図形の形状、拘束、スケッチ階層を定義する。
Presentation は、Geometry の見え方、注記、線色、線種、塗りつぶし、ハッチングを定義する。

さらに、Presentation は Presentation Sheet として管理し、1つの Cad2 データ内に複数枚定義できる。

```text
1つの Geometry
複数の Presentation Sheet
```

この方針により、1つの形状データをもとに、用途に応じて複数の見え方を作れる。

また、Presentation 要素はスケッチ階層から独立させる。
Presentation 要素はスケッチには所属せず、Presentation Sheet に所属する。

線色・線種・線幅も Geometry ではなく Presentation 側で管理する。

これにより、Geometry は純粋な形状定義として保ち、Presentation は図面表現のための独立した層として扱える。

## 14. 寸法値の表示精度

入力された拘束寸法値の表示保証精度は、線形寸法では `0.000001 mm`、角度寸法では `0.000001°` とする。

表示時は、元の値から `0.000001` 以内にある最も簡潔な10進値へ正規化し、ソルバー計算や浮動小数点演算で生じた保証精度以下の微小な誤差を表示しない。

例えば `1844.999999` は `1845` と表示する。一方、値そのものが `0.000001` の場合はゼロへ丸めず、そのまま表示する。

読み取り専用寸法と Presentation の注記寸法は、拘束連鎖による累積誤差を表示しないため、実測値から `0.00001 mm` または `0.00001°` 以内にある最も簡潔な10進値へ正規化する。この正規化でも、ゼロではない最小値をゼロへ丸めない。

小数部がゼロになる値は整数として表示し、小数部がある値は末尾の不要なゼロを省略する。

整数表示と末尾ゼロ省略の規則は、Geometry の拘束寸法、読み取り専用寸法、Presentation の注記寸法に共通して適用する。

## 15. ブロックとの関係

ブロック定義とブロックインスタンスはGeometryに属する。定義はローカル座標で形状を保持し、インスタンスの投影形状がスケッチ上のGeometryとして表示される。

Presentation Sheetは、通常Geometryと同じ方法でブロック投影形状を参照できる。要素単位スタイル、注記寸法、引出線の参照キーにはインスタンスIDと定義要素IDを含め、同じ定義の複数インスタンスを別要素として扱う。

ブロック定義の編集で投影要素が削除された場合、その要素を参照するPresentation要素とスタイルは整理する。Presentationからブロック定義やインスタンス変換を変更することはできない。

詳細は [ブロック仕様](./ブロック仕様.md) を参照する。

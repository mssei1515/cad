# Parameter

## 1. 名前空間

Document全体と各Block Definitionは、互いに独立したParameter名前空間を1つずつ持つ。1つの名前空間では、ユーザーParameter、拘束寸法、参照寸法を共通のsymbolとして扱う。Block DefinitionからDocumentまたは別Definitionのsymbolは参照できない。

ユーザーParameterは`{ name, expression }`、寸法はConstraint上の`parameterName`で識別する。拘束寸法は`expression`を持ち、参照寸法はGeometryから測定する読み取り専用入力で式を持たない。非表示または`enabled = false`の寸法も、存在する限り式から参照できる。

## 2. 識別子と採番

- 識別子はASCIIの`[A-Za-z_][A-Za-z0-9_]*`とし、大文字小文字を区別する。
- `d`に数字だけが続く名前は自動寸法名用に予約し、ユーザーParameterには使用できない。
- Parameter、拘束寸法、参照寸法の名前は同じ名前空間内で一意とする。
- 寸法は名前空間ごとの`nextDimensionParameterIndex`から`d1`、`d2`、…を単調増加で付与する。削除した番号は再利用しない。
- 寸法名は予約形式を含む任意の有効な識別子へ変更できる。
- 名称変更は文字列の部分置換を使わず、同じ名前空間内の式を構文token単位で書き換える。

## 3. 式

式は`eval`を使用しない専用parserで処理する。数値、科学表記、ダブルクオーテーションで括った識別子、空白、単項`+`／`-`、二項`+`／`-`／`*`／`/`、括弧を受け付ける。ユーザーParameterと寸法symbolのどちらを参照する場合も`"width"`、`"d1"`のようにダブルクオーテーションで括る必要があり、引用されていない識別子は拒否する。乗除は加減より優先し、同じ優先順位の二項演算子は左結合とする。

未定義名、重複名、予約名違反、自己参照、循環参照、ゼロ除算、非有限値、構文エラーを拒否し、問題のsymbolと理由を通知する。Parameterは単純なscalarであり、単位型検査は行わない。長さ拘束ではmm、角度拘束では度として評価値を解釈する。

## 4. 評価とsolve

確定操作では次を最大20回反復する。

1. 参照寸法をGeometryから測定する。
2. 依存順にユーザーParameterと拘束寸法式を評価する。
3. 拘束寸法の評価値をsolver用`target`へ反映する。
4. 拘束をsolveする。
5. 参照寸法を再測定して収束を確認する。

各参照値の相対変化が`1e-7 × max(1, |value|)`以内でsolverも成功した場合に収束とする。ドラッグ中はこのfeedback反復を行わず、pointer-upで実行する。失敗時の復元と履歴は[編集の確定と失敗](contracts/編集と履歴.md)のTX-01／02に従う。

Block Parameterの適用はDefinition内部を再計算した後、親Definition、全Instance Projection、Document拘束へ順に反映する。失敗時の復元と履歴は[編集の確定と失敗](contracts/編集と履歴.md)のTX-04に従う。

## 5. 編集

File menuのParameter画面ではDocumentまたは各Block Definitionを選択し、ユーザーParameterと寸法symbolを一覧編集する。Block Editor中は編集中Definitionだけを編集できる。変更はstageされ、「適用」で名前空間全体を検証して1回のUndo単位として反映する。未適用の変更がある状態でscopeを切り替える、または画面を閉じる場合は適用／破棄／キャンセルを確認する。

Propertiesでは拘束寸法と参照寸法の名前を変更できる。拘束寸法の数値または式を入力する欄は`値 / 数式`（英語`Value / Expression`）と表示し、参照寸法では同じ項目を読み取り専用で表示する。数値リテラルは`100`のように直接入力し、Parameter参照、演算子、括弧などを含む数式は`="width" / 2`のように先頭へ`=`を付け、参照をダブルクオーテーションで括って入力する。先頭の`=`はUI上の数式識別子であり、内部データモデルとJSONの`expression`には保存しないが、参照を括るダブルクオーテーションは保存する。Canvas寸法入力、Properties、Parameter画面の編集可能な式入力では、ダブルクオーテーションで括られ、かつ同じ名前空間に存在する有効な参照部分をアクセント色で表示する。Canvas上の寸法入力も同じ規則で式を受け付け、無効な入力や`=`のない数式では画面を閉じず理由を表示する。Canvasの寸法ラベルは式やsymbol名を表示せず、prefix／suffixを含む評価後の数値表示を維持する。数値リテラル以外の式で駆動される寸法は、Canvas上の評価値の前にカミナリマークを表示して数式寸法であることを識別する。

Canvas寸法入力、Propertiesの寸法`値 / 数式`、または表示中Canvasと同じ名前空間を編集中のParameter画面で数式入力欄へfocusしている間は、Canvas上の既存寸法をクリックすると、その寸法の`parameterName`をダブルクオーテーションで括り、現在のcaret位置または選択範囲へ挿入する。この操作は通常の寸法selection／dragを開始せず、入力欄のfocusを維持する。入力が数式形式でなければ先頭の`=`も自動付与する。別Block Definitionなど、表示中Canvasと異なる名前空間のParameter画面からはCanvas寸法を参照できない。

Sketch TreeのConstraint分類は拘束寸法と参照寸法の両方を表示し、`d1: 寸法…`の形式でsymbol名を先頭へ置く。参照寸法には読み取り専用表示を付ける。

## 6. 削除・コピー・Block化

削除後も残る式からのsymbol参照は、[削除と参照](contracts/削除と参照.md)のDEL-01に従って検査する。Geometry等の削除に伴って寸法を除去する場合も同じ規則を適用する。

同じ名前空間へ寸法をコピーした場合は新しい`dN`を付与し、同時にコピーした寸法間の参照だけを新名称へ書き換える。別の名前空間へのコピーでは拘束寸法式を現在の評価値による数値式へ変換する。

既存GeometryからBlockを作成する場合も、拘束寸法式を作成時点の評価値へ固定し、Block内で新しい寸法名を付与する。Document Parameterは複製しない。

## 7. 永続化

JSON version 17では、version 10で導入したParameterの意味を維持し、`target`を評価済みcacheとして残して拘束寸法の`expression`を正式な入力値とする。式内のParameterと寸法symbol参照はダブルクオーテーションを含む引用形式で保存する。チェーンオフセット寸法もチェーン全体で1つの寸法symbolと式を持つ。Document、Block Definition、History、Block Editor draft、clipboardへParameter、寸法名、式、採番counterを保存する。

version 16以前の読込では、式にある引用されていない有効な識別子をダブルクオーテーションで括る形式へ自動移行する。既に引用されている参照、数値、科学表記、演算子、括弧は維持する。version 9以前ではさらに名前空間ごとの寸法配列順に`d1`以降を付与し、拘束寸法の既存`target`を現在のUI単位による数値式へ変換する。参照寸法には名前だけを付与する。移行後またはversion 17以降の式や依存関係が不正な場合は読込全体を拒否し、現在のDocumentを維持する。

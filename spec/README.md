# Cad2 仕様書

このディレクトリは Cad2 の現在の正式仕様を記録する。履歴や将来構想ではなく、実装と一致する現行仕様を正とする。

## 文書一覧

1. [全体像](./01-全体像.md)
2. [データモデルと永続化](./02-データモデルと永続化.md)
3. [Geometryと拘束](./03-Geometryと拘束.md)
4. [スケッチ](./04-スケッチ.md)
5. [ブロック](./05-ブロック.md)
6. [表示と注記](./06-表示と注記.md)
7. [UI・操作・履歴](./07-UI・操作・履歴.md)
8. [Parameter](./08-Parameter.md)
9. [ハッチング](./09-ハッチング.md)
10. [実装対応表とテスト](./90-実装対応表とテスト.md)
11. [改善バックログ](./91-改善バックログ.md) — 仕様ではない技術課題

## 用語

| 用語 | 意味 |
| --- | --- |
| Document | 1つの保存対象。Geometry、Constraint、Sketch、Block、Parameter、Appearance、Hatch、Annotationを持つ |
| Geometry | Point、Line、Circle、Arc、およびBlock Projection |
| Constraint | Geometryの成立条件。寸法もConstraintに属する |
| Parameter | 名前と数式を持ち、同じ名前空間の寸法と相互参照できるスカラー値 |
| Appearance | visible、color、lineType、lineWidthと、補助Line用のendpointOverhang／endpointMarkersから成る表示属性 |
| Hatch | 既存Geometryで囲まれた閉領域へ関連付けられ、境界変形へ追従する平行線ハッチ |
| Sketch所属Annotation | Geometryを変更しない引出線または自由テキスト |
| Interaction State | 選択、作図、拘束入力、注記配置など現在の操作状態 |
| View State | Geometry ID、Space押下中の拘束状態表示など一時的な表示状態 |

Cad2には表示用の別モードやSheetは存在しない。作図、拘束、表示属性、注記は同じCanvas上で扱う。

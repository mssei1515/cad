# Jot2D 仕様書

このディレクトリは Jot2D の現在の正式仕様を記録する。履歴や将来構想ではなく、実装と一致する現行仕様を正とする。

仕様整理の検討資料は [仕様整理と段階的リファクタリング](../docs/refactoring/README.md) を参照する。草案・移行候補・未決定事項は正式仕様ではない。

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
10. [スプライン](./10-スプライン.md)
11. [参照画像](./11-参照画像.md)
12. [スケッチ投影](./12-スケッチ投影.md)
13. [編集の確定と失敗](./13-編集の確定と失敗.md)
14. [削除と参照](./14-削除と参照.md)
15. [実装対応表とテスト](./90-実装対応表とテスト.md)
16. [改善バックログ](./91-改善バックログ.md) — 仕様ではない技術課題

## 用語

| 用語 | 意味 |
| --- | --- |
| Document | 1つの保存対象。Geometry、Constraint、Sketch、Block、Parameter、Appearance、Hatch、Annotation、Reference Imageを持つ |
| Geometry | Point、Line、Circle、Arc、Spline、およびBlock Projection |
| Constraint | Geometryの成立条件。寸法もConstraintに属する |
| Parameter | 名前と数式を持ち、同じ名前空間の寸法と相互参照できるスカラー値 |
| Appearance | visible、color、lineType、lineWidthと、補助Line用のendpointOverhang／endpointMarkersから成る表示属性 |
| Hatch | 既存Geometryで囲まれた閉領域へ関連付けられ、境界変形へ追従する線パターンまたは色塗りつぶし |
| Sketch所属Annotation | Geometryを変更しない引出線または自由テキスト |
| Reference Image | Geometry背面で手動トレースに使う、Sketch所属の埋め込み画像 |
| 派生Geometry Instance | 既存Geometryを仮想出力として投影、ミラー、直線パターン複写する機能 |
| Interaction State | 選択、作図、拘束入力、注記配置など現在の操作状態 |
| View State | Geometry ID、Space押下中の拘束状態表示など一時的な表示状態 |

Jot2Dには表示用の別モードやSheetは存在しない。作図、拘束、表示属性、注記は同じCanvas上で扱う。

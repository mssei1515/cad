# Jot2D 仕様書

このディレクトリはJot2Dの現在の正式仕様を記録する。履歴や将来構想ではなく、実装と一致する現行仕様を正とする。

まず[基本概念](./concepts/基本概念.md)で用語とObjectの関係を確認し、変更対象の共通契約・機能別操作を読む。保存や計算に関わる変更では対応する領域も確認し、最後に検証対応を参照する。

## 文書一覧

7領域で案内する。各領域の正本は以下の文書に集約している。

| 領域 | 現在の正式文書・参照先 |
| --- | --- |
| 基本概念 | [製品モデル・用語・状態](./concepts/基本概念.md) |
| 共通契約 | [所属・編集可否](contracts/所属と編集可否.md#1-所属と座標系)、[編集と履歴](contracts/編集と履歴.md)、[削除と参照](contracts/削除と参照.md)、[外観](contracts/外観.md#1-appearanceの継承) |
| 機能別操作 | [作図・形状編集](./operations/作図と形状編集.md)、[拘束・寸法](./operations/拘束と寸法.md)、[Sketch](./operations/Sketch.md)、[Block](./operations/Block.md)、[Parameter](./operations/Parameter.md)、[Hatch](./operations/Hatch.md)、[Spline](./operations/Spline.md)、[参照画像](./operations/参照画像.md)、[派生Instance](./operations/派生Instance.md)、[注記](./operations/注記.md)、[ファイル操作](./operations/ファイル操作.md) |
| UI | [画面構成](./ui/画面構成.md)、[入力と操作状態](./ui/入力と操作状態.md)、[表示とビュー操作](./ui/表示とビュー操作.md) |
| データと互換性 | [保存構造](data/保存形式.md)、[読込・移行](data/読込と互換性.md#1-読込と互換性) |
| 計算契約 | [幾何計算](./calculation/幾何計算.md)、[拘束と依存更新](./calculation/拘束と依存更新.md)、[式評価](./calculation/式評価.md) |
| 検証対応 | [保証対応](verification/保証対応.md)、[検証方法](verification/検証方法.md) |

## 用語

用語の正本は[基本概念の用語と役割](./concepts/基本概念.md#2-用語と役割)。この見出しは従来の参照先を保つために残す。

## 開発資料

[リファクタリングの進め方](../docs/refactoring/README.md)、[実装対応表](../docs/refactoring/implementation-map.md)、[改善バックログ](../docs/refactoring/backlog.md)は開発資料として扱う。草案・改善候補・将来の実装方式は正式仕様ではない。

現在の仕様は上表の正本を使用する。過去の文書はGit履歴で確認できる。

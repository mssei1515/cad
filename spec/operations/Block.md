# Blockの操作

削除・構成変更以外の操作は[Blockの既存仕様](../05-ブロック.md)を参照する。共通の拒否・参照整理条件は[削除と参照](../contracts/削除と参照.md)に従う。

## 1. Blockの構成変更

| 操作 | 参照が失われる対象 | 結果 |
| --- | --- | --- |
| 有効内部Sketchの切替 | 無効化されるProjectionを参照するLeader | 変更を拒否する |
| 有効内部Sketchの切替 | 無効化されるProjectionを参照する外部Constraint・寸法 | 関連拘束を自動解除し通知する。寸法symbolの依存が残る場合はDEL-01に従い拒否する |
| 子Definition編集でProjectionを削除 | 親Definition内の該当Constraint | 拘束を解除して編集を継続する |
| Definition削除 | 所有下の子孫Definition | 親とともに削除する。使用中DefinitionはDEL-04に従い拒否する |

有効内部Sketchがなくなる変更の拒否、Definition編集完了時の参照整理など、構成変更固有の成立条件は[ブロック](../05-ブロック.md)に従う。内部Sketchの無効化はSketch自体の削除とは区別する。

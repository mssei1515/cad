# Sketchの操作

削除・構成変更以外の操作は[Sketchの既存仕様](../04-スケッチ.md)を参照する。共通の拒否・参照整理条件は[削除と参照](../contracts/削除と参照.md)に従う。

## 1. Sketchの削除範囲

Sketch削除は原則として子孫を含むサブツリー削除とする。

1. 削除範囲外の参照を確認する。
2. 削除されるGeometry件数を示してユーザー確認を取る。
3. 削除される寸法symbolへの依存を確認し、成立する場合に所属Objectと、削除Projection等を参照するConstraint・Leaderを整理する。
4. active Sketchが削除範囲に含まれる場合は、削除対象外の親、なければRootをactiveにする。

Block Definition内部のSketchにも同じ削除規則を適用する。

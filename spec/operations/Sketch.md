# Sketchの操作

対象の所属・編集可否は[共通契約](../contracts/所属と編集可否.md)、確定・失敗・履歴は[編集と履歴](../contracts/編集と履歴.md)に従う。以下に操作固有の条件を示す。

## 1. 目的と基本構造

Sketch は Geometry と拘束をまとめる作図・編集・solve 単位である。Document 全体を単一の巨大な拘束系にせず、意味のある階層へ分割する。

新規 Document は次の構造を持つ。

```text
Root Sketch (ROOT)
└─ Sketch-1 (S1)
```

Root Sketch はツリーの基点であり、Geometry や拘束を所属させない。Root をアクティブにすることはできるが、その状態では作図できない。

## 2. 作成、名前、階層

- 「兄弟+」は現在 Sketch と同じ親の下へ新規 Sketch を作る。
- 「子+」は現在 Sketch の子として作る。
- Root 選択中の兄弟・子作成は実質 Root 直下になる。
- Root 直下は `Sketch-n`、子は `<親名>-n` を既定名にする。
- 作成後は新しい Sketch をアクティブにする。
- Root 以外は名前変更できる。

UI には既存 Sketch の親を変更する操作はない。

Sketch Treeの表示・分類・選択・開閉は[画面構成](../ui/画面構成.md#4-sketch-tree)に従う。

## 3. Appearanceと表示状態

Root以外のすべてのSketchは、通常Geometry用のAppearance、補助Geometry用のConstruction Appearance、寸法用のDimension Appearanceを持つ。編集UIは[画面構成](../ui/画面構成.md#2-menu-bar)、値の解決は[外観](../contracts/外観.md)に従う。

- 外観の継承とvisibleの扱いは[表示と注記](../ui/表示とビュー操作.md)に従う。
- 非表示Geometryは通常時の描画、hover、snap、新規参照対象選択から除外する。
- 既存の参照拘束は、参照元Sketchを非表示にしてもsolveを継続する。
- Sketch AppearanceはJSONへ保存する。
- Space押下中はvisibleを無視して拘束状態を表示する。

## 4. Block Definition 内部 Sketch

Block Definition は通常 Document とは独立した内部 Sketch Treeと`annotations[]`、`hatches[]`、`referenceImages[]`を持つ。構造、作図、通常拘束、スケッチ投影、Annotation、Hatch、Reference Image、先祖参照、solve、削除規則は通常 Sketch と同じコード経路を再利用する。内部Reference ImageはDefinition編集用だけに保存し、Instanceへ投影しない。

内部 Sketch ID は Definition のスコープ内で解釈し、通常 Document の同名 ID と要素を共有しない。Block Instance の `enabledSketchIds` は、内部 Sketch のうちどれを Projection として公開するかを指定する。

## 5. Sketchの削除範囲

Sketch削除は原則として子孫を含むサブツリー削除とする。

1. 削除範囲外の参照を確認する。
2. 削除されるGeometry件数を示してユーザー確認を取る。
3. 削除される寸法symbolへの依存を確認し、成立する場合に所属Objectと、削除Projection等を参照するConstraint・Leaderを整理する。
4. active Sketchが削除範囲に含まれる場合は、削除対象外の親、なければRootをactiveにする。

Block Definition内部のSketchにも同じ削除規則を適用する。

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

- 「兄弟+」はアクティブ Sketch と同じ親の下へ新規 Sketch を作る。
- 「子+」はアクティブ Sketch の子として作る。
- Root がactiveの間の兄弟・子作成は実質 Root 直下になる。
- Root 直下は `Sketch-n`、子は `<親名>-n` を既定名にする。
- 作成後は新しい Sketch をアクティブにする。
- Root 以外は名前変更できる。

UI には既存 Sketch の親を変更する操作はない。

Sketch Treeの表示・分類・選択・開閉は[画面構成](../ui/画面構成.md#4-sketch-tree)に従う。

Sketch行のシングルクリックは選択だけを行う。選択行の「編集」button、右クリックメニューの「編集」、ダブルクリック、Alt+Enterはいずれも既存のactive Sketch切替を実行する。右クリックは対象行を選択してmenuを開き、menuを閉じただけではactiveを変えない。編集中のSketchに対する「編集」は無効にする。Rootの作図禁止、scope境界、切替時の操作状態解除は既存規則を維持する。

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

既存のSketchProjectionConstraintで削除対象を参照する子孫Sketchがある場合は、対象Sketchだけを削除し、直下の子を対象の親（なければRoot）へ移す。削除対象への投影拘束は整理する。派生Instanceからの外部参照には通常の削除拒否規則を適用する。

1. 削除範囲外の参照を確認する。
2. 削除されるGeometry件数を示してユーザー確認を取る。
3. 削除される寸法symbolへの依存を確認し、成立する場合に所属Objectと、削除Projection等を参照するConstraint・Leaderを整理する。
4. active Sketchが削除範囲に含まれる場合は、削除対象外の親、なければRootをactiveにする。

Block Definition内部のSketchにも同じ削除規則を適用する。

## 6. 選択図形のスケッチ間移動

アクティブSketchの通常図形、Block Instance全体、塗りつぶし、注記、参照画像を選択し、Canvasの右クリックから「別スケッチへ移動…」を実行する。Sketch Tree上部に対象数、移動先の名前とID、「移動」「取消」を表示する。Sketch行のクリックは移動先指定だけを行い、「移動」で確定する。Escまたは「取消」は元の選択と所属を保持する。

- 移動先は現在のDocument内、または現在編集中の同一Block Definition内の作図可能Sketchに限定する。Root、移動元、参照関係が成立しないSketchは指定不可とし、理由を表示する。非表示Sketchへの移動は可能。
- 移動先指定中はTreeの展開・スクロール・サイズ変更を許可し、通常選択、active切替、表示切替、名前変更、削除、Canvas操作、Properties編集と他の編集ショートカットを受け付けない。
- 派生Instance、Block／派生Projection内部図形、閲覧対象、拘束単独は対象外とする。
- 線端点、円／円弧中心、Spline通過点、および対象内で完結する通常拘束・寸法は一緒に移動する。未選択図形が点や通常拘束を共有する場合は不足IDを示して中止する。自動追加、複製、拘束削除は行わない。
- 塗りつぶしと全境界、引出線と参照先は一緒に選択する。片側だけの移動は不足IDを示して中止する。
- 外部の先祖参照拘束、読み取り専用寸法、派生Instanceの依存は移動後も既存の所属・先祖関係を満たす場合だけ維持する。移動する参照元のSketch情報も更新する。関係が成立しない移動先は拒否する。
- ID、ワールド座標、形状、固定状態、寸法Parameter名・式、個別外観、注記と画像の配置は保持する。個別指定のない外観は移動先Sketchから解決する。
- 移動対象の描画順は相互の順序を保ち、移動先の既存要素より前面へ追加する。移動元の残りの順序も保持する。
- 確定後もactive Sketchと各Sketchの表示状態は変えず、移動対象の選択を解除する。求解で座標を変更しない。失敗時は所属・参照情報・描画順を復元し、履歴を追加しない。成功全体を1回のUndo/Redo単位とする。保存形式の変更はない。

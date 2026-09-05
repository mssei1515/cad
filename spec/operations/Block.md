# Blockの操作

対象の所属・編集可否は[共通契約](../contracts/所属と編集可否.md)、確定・失敗・履歴は[編集と履歴](../contracts/編集と履歴.md)に従う。以下に操作固有の条件を示す。

## 1. 概念

Block は、独立したローカル座標、内部 Sketch Tree、Geometry、Constraint、Annotation、Hatch、編集用Reference Image、Parameter名前空間を持つ再利用可能な定義である。

```text
Block Definition
  再利用するローカル Geometry と内部 Sketch

Block Instance
  Definition の配置・回転・有効内部 Sketch

Block Projection
  Instance からワールド座標へ導出した読み取り専用 Geometry
```

通常 Sketch を Block で置き換えるものではない。Instance は通常 Sketch または親 Block Definition の内部 Sketch に配置される。

## 2. Definition と Instance

Definition は `origin`、内部 Sketch、Geometry、Constraint、Annotation、Hatch、編集用Reference Image、子 Block Instance、Definition固有のParameterと寸法採番counterを持つ。Instance は `definitionId`、配置先 `sketchId`、`x`、`y`、`rotation`、固定、回転ロック、有効内部 Sketch を持つ。

DefinitionのParameter名前空間からDocumentまたは別Definitionのsymbolは参照できない。

座標変換は[Blockの配置とsolve変数](../calculation/拘束と依存更新.md#5-blockの配置とsolve変数)に従う。

新規空 Definition は編集完了時に全有効 Geometry の外接範囲中心をローカル `(0, 0)` へ移す。既存 Definition の編集では原点を再計算しない。

## 3. Projection

Projection は座標を保存せず、Definition、Instance 変換、`enabledSketchIds` から生成する。

- Line、Circle、Arc、Spline と必要な Point を投影する。
- 内部Annotationを座標、Leader形状、文字位置、回転、GeometryRefへInstance変換を合成して投影する。文字もBlockと一緒に回転する。
- 内部Hatchは投影するが、手動トレース用Reference ImageはDefinition編集用に限定してInstanceへ投影しない。
- Projection は表示、スナップ、外部拘束、寸法、同じ配置SketchのLeader参照の対象になる。
- 先祖Sketch上のProjection Geometryはスケッチ投影の元Geometryとして使用できる。Instanceの移動・回転・Definition変更でProjection cacheが再生成された場合も正規GeometryRefで元参照を再結合する。
- Projection の Geometry 自体は通常編集で変形しない。
- 参照 ID は最上位 Instance ID から内部経路を `@` で連結する。
- Definition の `revision`、配置先 Sketch、有効 Sketch 集合をキーに Projection をキャッシュする。

Projection Geometryの外観継承は[外観](../contracts/外観.md)のAPP-03に従う。配置先SketchとDefinition内Sketchの外観を区別し、Instance Overrideを最後に適用する。

Projection AnnotationのIDは`BI1/AN1`、入れ子では`BI1/BI2/AN1`とする。Projection HatchのIDは`BI1/H1`、入れ子では`BI1/BI2/H1`とする。

配置先Canvasで投影Annotationまたは投影Hatchをclickした場合は単体でなく最上位Block Instance全体を選択し、内部Object自体の編集はBlock Editor内だけで行う。Projection AnnotationとHatchはBlock bounds、fit、配置中心、配置preview、hit testへ含める。

Hatchの輪郭、seed、pattern原点、angleへInstance変換を合成し、Block回転とともに平行線・クロスpatternも回転する。色塗りつぶしは同じ変換済み輪郭へ描画する。

参照の値・path・保存と解決は[GeometryRefとConstraint参照](../data/保存形式.md#13-geometryrefとconstraint参照)に従う。

## 4. 選択 Geometry からの作成

ToolbarまたはBlock menuのBlock作成commandを、対象選択がある状態で実行する。

アクティブ Sketch の選択 Geometry、選択 Block Instance、明示選択したAnnotation、選択範囲内で閉じる Constraint を新しい Definition の `Sketch-1` へ移す。Annotationはorigin分をローカル座標へ変換する。完了時、元Objectを同位置の新規 Instance へ置換する。Free Textだけを選択したAnnotation-only Blockも許可する。

選択内容の拘束寸法式は作成時点の評価値による数値式へ固定し、新しいDefinition内で新規`dN`を付与する。Document ParameterはDefinitionへ複製しない。

選択 Geometry から作成したBlockをEditorで「完了」すると、draftの検証後、元Objectを置換する前に回転設定の確認ダイアログを表示する。「回転ロックして作成」（初期フォーカス）は新規Instanceの`rotationLocked = true`、「自由回転で作成」は`false`で作成する。「キャンセル」、×、Escはdraftを保持してEditorへ戻り、作成を確定しない。選択結果は作成と同じUndo/Redo単位に含め、保存・再読込でも保持する。空Definitionの作成完了や既存Definitionの編集完了ではこの確認を表示しない。Definitionの通常配置時の回転設定は従来どおり配置Propertiesで指定する。

次は作成を拒否する。

- 選択 Point を非選択 Geometry と共有している。
- 使用する同一 Definition の Instance が選択外にも残っており、Definition の所有スコープを移せない。
- 選択Leaderの参照GeometryまたはBlock Instanceが選択されていない。
- 非選択Leaderが選択GeometryまたはProjectionを参照している。
- 選択Hatchの境界Geometryがすべて同時選択されていない、または非選択Hatchが選択Geometryを境界として参照している。
- 保持できない Constraint 型が選択内部にある。

選択範囲の内外をまたぐ Constraint と別 Sketch 参照 Constraint は、現在は作成を拒否せず外部 Constraint として扱い、完了時に自動解除する。ユーザーには Block Editor 開始時と完了時に件数を通知する。

元 Geometry、内部 Constraint、新規 Definition、新規 Instance、外部 Constraint 解除は1つの通常 Undo/Redo 単位である。キャンセル時は元状態を維持する。

## 5. 空 Definition の作成

同じBlock作成commandを対象選択がない状態で実行すると、空の Definition を作り、専用 Block Editor を開く。Block作成buttonを別々に設けない。初期名は `Block-n` である。Geometry、Annotation、Hatch、子Block Instanceのいずれも持たない状態では完了できず、Reference Imageだけを持つ状態でもInstanceへ投影する内容がないため完了できない。完了しても通常画面へ Instance を自動配置しない。

## 6. Definition管理画面

Menu BarのBlock menuから、Block Definitions modal windowを開く。windowは現在のscopeで使用できるDefinitionを一覧表示し、配置、編集、名前変更、削除を提供する。配置または編集へ進むとwindowを閉じる。新規作成はこの一覧ではなく、ToolbarまたはBlock menuのBlock作成commandから行う。

## 7. Block Editor

Block Editor はCanvasを太枠で囲まず、通常画面の白とは異なる淡い青色の背景`#f3f7ff`を使って編集中であることを示す。右上の編集overlayも淡い青色、青い境界線、青系の影で統一する。元 Definition から分離したドラフトを編集する。

- 通常の作図、拘束、寸法、スケッチ投影、Annotation、Hatch、Reference Imageの読み込み・移動・縮尺・回転・不透明度・表示・位置ロック・2点縮尺設定、Sketch Tree、Block 操作を再利用する。
- Esc は現在の作図・拘束操作を解除し、Editor 自体を閉じない。
- 完了時に Geometry、内部参照、循環、solve、ID 重複を検証する。
- キャンセルはドラフトとその中で作った一時 Definition を破棄する。
- 通常履歴とは独立した最大80件の Undo/Redo を持つ。

## 8. 入れ子 Block

入れ子 Block は実装済みである。

- Block Editor 内で、そのスコープに属する既存子 Definition を配置できる。
- Editor 内でさらに新しい子 Definition を作れる。
- 既存の選択 Block Instance を新しい親 Definition で包める。
- 子 Definition は `parentDefinitionId` により1つの親 Definition だけに所有される。
- 子 Definition を通常 Document 直下や別の親から直接使用できない。
- 自身または編集中の祖先を参照する配置を拒否する。
- 読込時にも複数親、親不一致、自己参照、循環を拒否する。
- 親作成をキャンセルした場合は、移動した子 Definition の所有権と編集内容を復元する。

同じ Definition を使う最上位 Instance の一部だけを選んで親へ移すと、未選択 Instance が元スコープに残るため拒否する。該当 Definition の Instance をすべて選択する必要がある。

## 9. 配置

配置開始時は全作図可能内部 Sketch を有効にし、ユーザーが個別に切り替えられる。Geometry、Annotationまたは子Blockを持つ Sketch を少なくとも1つ有効にする必要がある。配置中の回転モードと表示内部SketchはPropertiesへ表示し、Propertiesが畳まれていれば一時的に展開する。配置完了またはキャンセル後は開始前のProperties開閉状態へ戻す。

1. 1クリック目で、有効 Geometry の外接範囲中心を置く位置を決める。
2. 2クリック目で回転方向を決める。

表示中心を決める前の Esc はキャンセルする。表示中心を決めた後の Esc は0°で配置を確定する。

新規配置は既定で `rotationLocked = true` であり、90°単位へスナップする。自由回転へ切り替えると `rotation` が外部 solve 変数になる。

## 10. Instance 編集

- 通常選択は Instance 全体を選ぶ。
- ユーザー向けPropertiesではInstanceを単に「ブロック」と表記し、Instance ID、Block Definition名とID、`x`、`y`、角度、回転モード、表示する内部 Sketch を表示する。Appearance区分は`ブロック外観の上書き`／`Block Appearance Override`と表示する。`x`、`y`は他のGeometryの測定値と同様に読み取り専用とする。自由回転中の角度も読み取り専用とし、直交回転ロック中だけ角度を`0°`、`90°`、`180°`、`270°`から選択して変更できる。選択済みInstanceと新規配置中の回転モード、直交角度、表示内部SketchはPropertiesで編集する。
- 通常ホバーでは Instance 全体を強調するが、内部 Projection Geometry のIDラベルは一括表示しない。Constraint の対象選択中に個別の Projection Geometry をホバーした場合は、そのIDラベルを表示する。
- ドラッグは `x`, `y` を変更する。
- 回転ハンドルは外接範囲中心を固定したまま `rotation` と補正 `x`, `y` を変更する。
- `fixed` は `x`, `y`, `rotation` の3自由度を固定する。
- 固定コマンド開始後に内部Geometryを選ぶと、配置先SketchへそのGeometryだけの固定拘束を追加／解除する。Pointは位置、Lineは両端位置、Circleは中心と半径、Arc本体は中心・半径・両端角度、Arc端点はその端点位置を固定する。Instance全体の`fixed`と回転ロック、Definitionは変更しない。自由回転中のPoint固定では、その点を支点とする回転自由度が残る。
- 直交回転ロック中は `rotation` を solve 変数に含めない。
- 自由回転から直交ロックへ戻すと最寄り90°へ合わせ、既存拘束が成立しなければ変更をロールバックする。
- Propertiesから直交角度を変更するときは表示中心を維持して回転し、既存拘束が成立しなければ変更全体をロールバックして履歴へ追加しない。全固定中は角度選択を無効にする。
- 外部拘束でつながる複数 Instance は、ドラッグ時に拘束を保って連動できる。
- `appearanceOverride`はInstance全体へ適用し、そのInstanceが公開するすべてのProjection Geometry、Projection Annotation、Projection Hatchのvisible、color、lineWidthをプロパティ単位で上書きする。

## 11. 有効内部 Sketch

Instance ごとに `enabledSketchIds` を持ち、配置後も変更できる。親子内部 Sketch は独立して有効化でき、Annotationしか持たない内部Sketchも選択肢と件数へ含める。

変更ルールは次のとおり。

- `x`, `y`, `rotation` は変更しない。
- 図形を持つ有効 Sketch が0件になる変更を拒否する。
- Definition 編集で追加した内部 Sketch は既存 Instance へ自動追加しない。
- 無効化されるProjectionへの参照は[Blockの構成変更](Block.md#16-blockの構成変更)に従って扱う。

## 12. Constraint と solve

外部 Constraint の対象選択中は Instance 全体ではなく Projection Geometry を選ぶ。solve変数は[計算契約](../calculation/拘束と依存更新.md#5-blockの配置とsolve変数)に従う。

同一 Instance 内だけで完結する長さ、距離、半径、直径、角度寸法は読み取り専用になる。Definition Geometry のサイズを変えるには Block Editor を使う。

内部Sketchのsolveと依存更新は[計算契約](../calculation/拘束と依存更新.md#5-blockの配置とsolve変数)に従う。

失敗時の復元範囲と履歴は[編集の確定と失敗](../contracts/編集と履歴.md)に従う。Block Parameter適用にはTX-04、Parameter以外のDefinition編集による外部拘束エラーにはTX-05を適用する。

## 13. Definition 編集完了

既存要素は ID とオブジェクト同一性を可能な限り維持してマージする。削除要素については、全 Instance の Projection ID を求め、次を整理する。

- 外部 Constraint と寸法
- 所属SketchのAnnotation
- 親 Definition 内で削除 Projection を参照する内部 Constraint

使用中 Instance の `enabledSketchIds` がすべて無効になる場合は完了を拒否する。

子Definition編集によるProjection削除の扱いは[Blockの構成変更](Block.md#16-blockの構成変更)に従う。参照先を失った内部Constraintが保存データに残る場合の読込は、[データモデルと永続化](../data/読込と互換性.md)のLOAD-03に従う。

## 14. 削除と互換性

- Definition・Instanceの削除可否と参照整理は[削除と参照](../contracts/削除と参照.md)に従う。
- 旧内部SketchとProjection IDの互換性は[読込と互換性](../data/読込と互換性.md#2-field欠落と旧外観の補完)に従う。

## 15. 未実装

- 外部 Block ライブラリ、リンク更新
- Instance の倍率
- 鏡像変換
- 通常 Geometry への分解
- Definition 原点の手動編集

## 16. Blockの構成変更

| 操作 | 参照が失われる対象 | 結果 |
| --- | --- | --- |
| 有効内部Sketchの切替 | 無効化されるProjectionを参照するLeader | 変更を拒否する |
| 有効内部Sketchの切替 | 無効化されるProjectionを参照する外部Constraint・寸法 | 関連拘束を自動解除し通知する。寸法symbolの依存が残る場合はDEL-01に従い拒否する |
| 子Definition編集でProjectionを削除 | 親Definition内の該当Constraint | 拘束を解除して編集を継続する |
| Definition削除 | 所有下の子孫Definition | 親とともに削除する。使用中DefinitionはDEL-04に従い拒否する |

有効内部Sketchがなくなる変更の拒否、Definition編集完了時の参照整理など、構成変更固有の成立条件は[ブロック](Block.md)に従う。内部Sketchの無効化はSketch自体の削除とは区別する。

# Hatchの操作

対象の所属・編集可否は[共通契約](../contracts/所属と編集可否.md)、確定・失敗・履歴は[編集と履歴](../contracts/編集と履歴.md)に従う。以下に操作固有の条件を示す。

## 1. Hatchの表示と重なり順

Hatchのspacingは画面上の概算mmで保持し、`spacing × 96 / 25.4 / viewport.scale`をモデル間隔として描画する。pattern位相はDocumentのワールド原点またはBlockローカル原点を基準にする。

`parallel`は指定角度の1方向、`cross`は指定角度とその90°方向の2組を同じspacingで描画する。`solid`はcolorと0～1のopacityで外周内を塗り、穴はeven-odd規則で除外する。

hover／選択では線色または塗り色を一時強調する。線patternと塗りつぶしは境界まで描画して視覚的な隙間を設けず、その直後にそのHatch自身が参照する境界Geometryだけを同じAppearanceで再描画する。

したがって境界線はHatchより前に置かれていても見えるが、境界でない下位GeometryはHatchに隠れ得る。非アクティブSketchでは表示だけを行い、Canvas hover・selection対象にしない。

無効境界ではpatternも塗りも描画しない。

共通の重なり順はSketchごとに独立して保持し、異なるSketchのObjectを相互に前後移動しない。表示中の非アクティブSketchはDocumentのSketch順で描画し、アクティブSketchをその後に描画する。

Block Instanceと派生Geometry InstanceはInstance全体を1つのObjectとして前後移動し、内部のGeometryとHatchはDefinitionまたは参照元の順序を維持する。通常clickは表示上の最前面Objectを優先する。

ただしHatch境界上では、境界線幅の半分に画面上1pxを加えた帯域をHatchの領域hit対象から除外し、再描画された境界Geometryを選択できるようにする。この帯域はzoomに依存しない選択上の余裕であり、描画上の隙間ではない。

## 2. 基本仕様

ハッチングは、アクティブSketchの通常Line、Circle、Arc、Splineから、pointerで指定した有界な閉領域を自動検出して作成するSketch所属Objectである。Geometryが交点で分割されていなくても交点で区間分割した平面グラフを内部生成し、half-edge探索で面を求める。選択した面に直接含まれる内側の閉輪郭は穴として除外する。

補助Geometry、非アクティブSketch、Block Projectionは境界候補に含めない。Block Definition内のハッチングはBlock Editorで作成する。実際の隙間を自動補完せず、開放境界、境界上のclick、重複区間など面を一意に決められない場合は理由を表示して作成しない。

ToolbarまたはGeometry menuからハッチングを開始し、閉領域内を1clickすると1つのUndo単位で確定する。確定後も同じcommandを継続し、Escで選択modeへ戻る。pointer移動中は候補面の淡色表示と仮ハッチをpreviewする。

## 3. 描画と選択

線patternの位相はDocumentではワールド原点、Block DefinitionではBlockローカル原点を基準に揃える。`spacing`は`96 / 25.4 px/mm`で画面距離へ換算し、viewport scaleで割ってモデル距離を求めるため、zoom倍率によらず画面上の見た目をほぼ一定にする。`parallel`はangle方向の1組を、`cross`はangle方向とangle+90°方向の2組を同じspacingで描く。物理displayの実寸校正は行わない。

ハッチングは、同じSketchのLine、Circle、Arc、Spline、Block Instance、派生Geometry Instanceと共通の`drawingOrder`で描画する。`solid`はcolorとopacityで外周内部を塗り、hole輪郭はeven-odd規則で透明に残す。

平行線、クロス、塗りつぶしのいずれも境界まで描画し、境界から内側を削る視覚的な隙間は設けない。Hatch描画直後に、そのHatch自身が参照する境界Geometryだけを同じAppearanceで再描画するため、境界線は見える状態を保つ。

一方、境界でない下位GeometryはHatchに隠れ得る。選択またはhoverではハッチ線色または塗り色を強調する。

通常clickは共通の重なり順で最前面のObjectを優先する。Hatch自身の境界Geometryを選択できるよう、境界線幅の半分に画面上1pxを加えた帯域はHatch領域のhit対象から除外する。この帯域はzoomに依存しない選択判定だけの余裕であり、描画には適用しない。非アクティブSketchでは表示だけを行い、Canvasからhover、選択、編集しない。

Propertiesは「基本情報」に種類、ID、所属Sketch、境界状態を、`ハッチング外観`／`Hatching Appearance`に編集可能な種類、色、表示を出す。平行線・クロスでは角度、間隔、線幅も表示し、塗りつぶしではそれらを非表示にして0～100%の不透明度を表示する。色は線patternの線色とsolidの塗り色を兼ね、共通Color Paletteを使用する。Sketch TreeではArcの後、Blockの前へ「ハッチング」分類を置き、空分類は表示せず初期状態を折り畳む。Object rowはToolbarと同じSVGを使う。

## 4. 削除、コピー、Block化

境界Geometryの削除と所属Sketchの削除は、[削除と参照](../contracts/削除と参照.md)のDEL-06／07に従う。

ハッチングのCopy、Cut、Pasteおよび選択GeometryからのBlock化では、参照する全境界Geometryを同時選択しなければならない。不足時は対象境界IDを表示して操作全体を中止する。Pasteでは新しいGeometry IDへすべての境界参照と交差相手参照を書き換え、seedへpaste offsetを加える。Block化ではBlockローカル座標へseedを移し、内部Geometry参照を維持する。History、Block Editor draft、local履歴、clipboardはハッチングと採番値を含む。

## 5. Block Projection

Block Definition内ハッチングをProjection bundleへ含める。Projection IDは`BI1/H1`、入れ子では`BI1/BI2/H1`の形式とする。輪郭、seed、pattern原点、angleへInstance変換を合成し、Block回転時はパターン角度も同時に回転する。表示する内部Sketch、入れ子Block、配置preview、bounds、fit、hit test、保存復元へ反映する。

配置先CanvasでProjectionハッチングをclickした場合は最上位Block Instance全体を選択する。Instance Appearance Overrideのvisible、color、lineWidthをProjectionハッチングにも適用する。

## 6. JSON互換性と性能

保存構造は[保存形式](../data/保存形式.md#8-hatch)、旧版の補完と構造検証・境界欠落の扱いは[読込と互換性](../data/読込と互換性.md)に従う。

作成previewの平面グラフはSketchとGeometry状態ごとにcacheし、pointer位置だけが変わる間は再利用する。保存済み境界の解決結果も参照Geometry状態ごとにcacheする。閉じたSketch Tree分類ではObject rowを生成しない。

閉領域の計算・境界追従は[Hatchの計算規則](../calculation/幾何計算.md#4-閉領域)、検証は[既存の保証](../verification/保証対応.md#hatch)を参照する。

## 7. 境界追従と修復

作成後は保存済みの境界Geometryだけから輪郭を再構築する。後から別Geometryを追加しても既存ハッチングを自動分割しない。境界Geometryの座標、半径、角度が変化した場合は、保存した端点、交点順、進行方向から同じ位相を復元して追従する。

境界Geometryの削除、交点順の変化、開放、重複、collapse等で復元できない場合はObjectを削除せず無効状態にする。無効時はCanvasへパターンを描画せず、Sketch Treeへ境界エラーbadge、Propertiesへ理由と「境界を再指定」／`Reselect boundary`を表示する。Propertiesまたは有効ハッチングのCanvas右click menuから再指定commandを開始し、新しい閉領域のclickでIDとAppearanceを維持したまま境界だけを置換する。同じIDと位相がUndo等で復元された場合は自動的に有効へ戻る。

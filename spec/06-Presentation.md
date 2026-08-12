# Presentation

この文書は、現在の実装と、今後 ChatGPT と議論するための基礎仕様案を分けて記載する。

## 1. 目的と境界

Presentation は、作成済み Geometry を変形せず、見え方と図面注記を定義する領域である。

```text
Geometry
  形状、Sketch、Constraint、Block
        ↓ 読み取り参照
Presentation Sheet
  表示スタイル、注記寸法、引出線
```

次は現在も今後も維持する基本原則とする。

1. Presentation 操作を Geometry の solve に渡さない。
2. Presentation から Point 座標、半径、角度、Block 変換、Constraint を変更しない。
3. Presentation Element は Sketch ではなく Sheet に所属する。
4. 同じ Geometry に複数 Sheet から異なる表現を与えられる。
5. Geometry 参照は保存可能な安定 ID を使う。

## 2. 実装済みデータモデル

### Presentation Sheet

```text
presentationSheet
  id
  name
  visibleGeometrySketchIds
  elementStyles
  elements
```

新規 Document には `PS1 / Sheet-1` が1つある。複数 Sheet を作成でき、`activePresentationSheetId` が編集対象を示す。

`visibleGeometrySketchIds` は正規化、保存、読込、Sketch 削除時の整理まで実装されているが、描画・UIから参照されていないため **部分実装** である。

### Geometry style override

`elementStyles` は Geometry の安定キーをプロパティ名にする。

```json
{
  "line:L1": {
    "visible": true,
    "color": "#111827",
    "lineType": "solid",
    "lineWidthPx": 2.2,
    "opacity": 1
  }
}
```

Block Projection は `line:BI1@L1` のようなキーになる。入れ子では内部 Instance の経路も含む。

許可値は次のとおり。

| 項目 | 値 |
| --- | --- |
| `visible` | boolean |
| `color` | `#RRGGBB` |
| `lineType` | `solid`, `dashed`, `dashdot`, `dotted` |
| `lineWidthPx` | 0.5〜10 |
| `opacity` | 0.05〜1 |

既定スタイルは通常 Geometry が黒系実線 2.2px、補助 Geometry が灰色一点鎖線 1.8px である。線幅と破線パターンは画面拡大率に依存しないスクリーンサイズとして描く。

現在の UI は `visible`、`color`、`lineType`、`lineWidthPx` を編集できる。`opacity` は保存・描画に対応するが UI がない。

### Presentation Element

実装済み型は2つである。

```text
annotationDimension
  id, type, visible
  geometryRefs
  target
  dimension
  style

leader
  id, type, visible
  geometryRefs.target
  text
  start, elbow, end
  x, y
  style
```

## 3. Sheet 操作の現行仕様

| 操作 | 状態 | 挙動 |
| --- | --- | --- |
| 選択 | 実装済み | セレクトボックスで active Sheet を変更する |
| 追加 | 実装済み | 空の `Sheet-n` を作り、直ちに active にする |
| 名前変更 | 実装済み | Prompt で名前を変更する |
| 保存・読込 | 実装済み | 全 Sheet と active Sheet ID を JSON に保持する |
| Undo/Redo | 実装済み | Sheet 追加・名前変更・内容編集を通常履歴へ含める |
| 削除 | 未実装 | UI、処理ともにない |
| 複製 | 未実装 | UI、処理ともにない |
| 並べ替え | 未実装 | 配列順を変更する操作がない |

Sheet 切替そのものは履歴を記録しないが、通常履歴スナップショットには `activePresentationSheetId` が含まれる。

## 4. Geometry 表示の現行仕様

Presentation Mode でも、表示中の通常 Geometry と有効な Block Projection を Canvas に描く。

1. `Sketch.visible` で非表示の Geometry は描かない。
2. active Sketch かどうかにかかわらず、表示 Geometry は同じ濃さで扱う。
3. active Sheet の要素 style override を既定スタイルへ重ねる。
4. `visible = false` の線・円・円弧は描画・ヒット対象から除く。
5. 選択・ホバー時は Presentation style より青い選択表現を優先する。

Point は線と異なり通常の Presentation 表現を持たず、選択・ホバー時のハンドルだけを描く。Point の `elementStyles` は作成できるが、色・線種・線幅を視覚化する処理がなく、`visible = false` でも Point のヒット判定から除外されない。これは **部分実装／既知の不整合** である。

## 5. 注記寸法

### 対象

実装済みの測定対象は次のとおり。

| 選択 | `target.kind` | 表示値 |
| --- | --- | --- |
| Point 2つ | `point-point` | 2点間距離 |
| Point + Line | `point-line` | 点と直線の距離 |
| Line 1本 | `line-length` | 線長 |
| ほぼ平行な Line 2本 | `line-line` | 線間距離 |
| 非平行 Line 2本 | `angle` | 角度 |
| Circle 1つ | `diameter` | 直径 |
| Arc 1つ | `radius` | 半径 |

2 Line は方向差5°以内を「ほぼ平行」と判定する。

### 作成と表示

1. 先に Geometry を選択して「注記寸法」を押すか、コマンド開始後に対象を順に選ぶ。
2. Canvas クリックで寸法線位置を確定する。
3. 対象 ID と寸法表示配置を Sheet に保存する。
4. 描画時に対象 Geometry を再解決し、現在の実測値を `1e-5` 許容で表示する。

注記寸法は Constraint ではなく、solve 対象にならない。Geometry が別操作で変形すれば表示値は追従する。寸法線またはラベル周辺をドラッグすると配置だけを変更する。

`style` フィールドは保存されるが、現在の `drawDimension` は固定色・固定線幅を使い、注記寸法 style を参照しない。

Point 2つの寸法では、配置から水平・垂直の見せ方を計算できる一方、作成時の `targetData.dimensionAxis` へその結果を反映していない。再描画時の値は常に実距離になり得るため、軸寸法としての保存は未完成である。

## 6. 引出線

1つの Point、Line、Circle、Arc を対象にできる。

- Point はその座標を開始点にする。
- Line はクリック位置の線分上への射影を開始点にする。
- Circle は中心からクリック方向の円周点を開始点にする。
- Arc はクリック角を円弧範囲へクランプした点を開始点にする。

文字位置をクリックした後、Prompt でテキストを入力する。開始点、折点、終点、文字位置、対象 Geometry キーを保存する。

描画時は対象 Geometry を再解決し、保存開始点に近い Geometry 上の点へ矢印先を追従させる。線の終端側と文字をドラッグすると、折点、終点、文字位置をまとめて移動する。開始点は Geometry 参照により決まり、直接ドラッグしない。

Leader style は色、フォントサイズ、線幅を描画に利用するが、専用 UI はない。

## 7. 選択・編集・履歴

- Geometry のクリックで単一選択、Shift/Ctrl で加算・解除選択する。
- 選択 Geometry へ style override を一括適用できる。
- 注記寸法と引出線はヒット後すぐドラッグする。
- 注記 Element を「選択済み」として保持する状態はない。
- Delete/Backspace と削除ボタンは Geometry Mode 限定であり、注記 Element を直接削除できない。
- 注記ドラッグ、追加、style 変更は Undo/Redo 対象である。
- Esc は実行中の注記作成または Geometry 選択を解除する。

## 8. Geometry 参照とライフサイクル

Annotation Dimension は `target` と同内容の ID を `geometryRefs` にも保持する。Leader は `geometryRefs.target` に `<kind>:<id>` を保持する。

- 通常 Geometry 削除時は、参照する Presentation Element と style を削除する。
- Sketch 削除時も同じ整理を行う。
- Block Instance 削除、Definition 要素削除でも Projection 参照を整理する。
- Block の内部 Sketch 無効化は、参照する注記 Element があれば拒否する。
- style だけが付いた Block Projection は内部 Sketch 無効化後も保持し、再有効化時に復元する。
- 参照解決できない Element は描画時に黙ってスキップする。

## 9. 旧構想のうち未実装の機能

次は以前の仕様案に含まれていたが、現行コードにはない。

- 自由テキスト
- 独立した矢印、ラベル、表示用補助線
- 塗りつぶし、面、領域検出
- ハッチング
- Sheet ごとの Sketch 表示 UI
- Sheet ごとのカメラ、用紙、縮尺、印刷範囲
- 注記 Element の一覧、選択、複製、削除、重なり順
- 注記寸法の公差、単位、接頭記号、桁数設定
- Leader の矢印種類、文字揃え、複数行編集
- SVG/PDF/画像出力

## 10. 基礎仕様のたたき台

以下は **要議論** であり、現行実装の説明ではない。直近の Presentation 設計会話では、この順に決めることを推奨する。

### D1. Sheet 固有の表示対象

推奨: Presentation Mode では `Sketch.visible` と独立した Sheet 固有の表示集合を正とする。Geometry Mode の可視性変更が既存 Sheet を勝手に変えないようにする。

要決定:

- Sheet 新規作成時だけ Geometry の現在可視性をコピーするか。
- Sketch 単位と要素単位の両方を持つか。
- 新規 Geometry を既存 Sheet へ既定表示するか。

### D2. style のカスケード

推奨する最小構成は、`Sheet default -> element override` の2段階とする。Sketch 単位 style は必要性が確認できるまで増やさない。補助 Geometry の既定だけは Sheet default 内の別トークンとして持つ。

要決定:

- Point を出力要素として描くか、参照ハンドルだけにするか。
- 線幅を画面 px、モデル単位、印刷 pt のどれで保存するか。
- 非表示と透明度0を別概念にするか。

### D3. Annotation の共通編集モデル

推奨: 全 Annotation に `selected`, `visible`, `locked`, `zIndex`, `style`, `geometryRefs` の共通操作を与え、選択、複数選択、移動、複製、削除、プロパティ編集を統一する。

最初の型は次に絞る。

1. Annotation Dimension
2. Leader
3. Free Text

塗りとハッチングは面・領域モデルが必要なため別段階にする。

### D4. 参照切れ

推奨: Geometry 削除時に Annotation を黙って削除せず、`orphaned` として保持し、警告表示、再参照、明示削除を可能にする。Undo で Geometry が戻れば自動復旧できる。

要決定:

- 同じ操作内で自動削除する現在の挙動を維持するか。
- Definition 編集で ID が失われた場合の再関連付け方法。

### D5. View と Sheet

推奨: 最初は Sheet ごとに Canvas の中心と倍率を保存し、固定用紙と印刷尺度は後段階にする。

要決定:

- Sheet を無限 Canvas の「ビュー」とするか、用紙サイズを持つ「図面ページ」とするか。
- Geometry Mode から Presentation Mode へ切り替えたときのカメラ引継ぎ。

### D6. 寸法の意味と単位

推奨: Geometry のモデル単位を先に Document 設定として定義し、Annotation Dimension は値を保存せず Geometry から計測する。表示桁、公差、接頭記号、単位表示だけを Annotation 側に持つ。

要決定:

- `mm` 固定か単位切替か。
- 水平／垂直／整列寸法の明示的な型分け。
- 円と円弧の半径・直径選択。

### D7. Sheet ライフサイクル

推奨: 作成、名前変更、複製、並べ替え、削除を一式で提供する。最後の1 Sheet は削除不可とする。

要決定:

- Sheet 複製時に Annotation ID を再採番するか。
- active Sheet 切替を Undo 対象にするか。

### D8. 出力

要決定: Presentation の第一出力をスクリーン表示、PNG、SVG、PDF、印刷のどれとするか。線幅・フォント・用紙・背景・余白の仕様は出力先に依存するため、style 拡張前に優先出力を決める。

## 11. 推奨する Presentation V1 完了条件

1. Sheet ごとに表示 Geometry とカメラを独立保存できる。
2. Geometry の線色、線種、線幅、表示を Sheet ごとに変更できる。
3. Annotation Dimension、Leader、Free Text を選択・編集・複製・削除できる。
4. 水平、垂直、整列、線長、点線間、線間、角度、半径、直径の値が明示型で安定保存される。
5. Geometry 変更後に値とアンカーが追従する。
6. 参照切れ Annotation を検出し、ユーザーが修復または削除できる。
7. 通常 Geometry、Block Projection、入れ子 Projection を同じ参照方式で扱う。
8. Sheet と Annotation の全操作が Undo/Redo、保存・読込、E2E テストで保証される。
9. 優先出力1種類で、画面と同等の style・文字配置を再現できる。

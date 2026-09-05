# 見出し別の移行台帳

現行仕様の見出しを、[移行計画](./migration-plan.md)のファイルIDへ対応付ける。IDの列は予定先であり、移動済みを意味しない。正式仕様は各「現行文書」から読む。

内容整理とファイル移動を別に記録する。M1～M5で移動済みの行には実在する参照先を記載した。移動案内として残した旧見出しも追跡対象に含む。複数IDは本文を分割する予定先を示し、同文の複写先ではない。小見出しのない段落は直前の見出しに含める。移動時は段落の振り分けを照合し、実在する移動先・見出しへのリンクと残範囲を記録する。削除時は集約先または承認された廃止理由を残す。

## 01-全体像

[現行文書](../../spec/01-全体像.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 製品モデル | [基本概念 §1](../../spec/concepts/基本概念.md#1-製品モデル)へ集約。旧参照先を保持 | CON | M1移行済み |
| 2. 主要責務 | [基本概念 §2](../../spec/concepts/基本概念.md#2-用語と役割)へ集約。旧参照先を保持 | CON | M1移行済み |
| 3. 表示の原則 | [表示とビュー操作](../../spec/ui/表示とビュー操作.md)へ参照を集約 | APP・VIEW | M4移行済み |
| 4. UI領域 | [画面構成](../../spec/ui/画面構成.md)へ参照を集約 | UI | M4移行済み |
| 5. 保存互換 | [正本](../../spec/operations/ファイル操作.md)へ集約。互換性は読込文書を参照 | FILE・LOAD | M3移行済み |
| 6. 実装構成 | [実装対応表 §1](./implementation-map.md#1-実装ファイルの責務)へ集約。旧参照先を保持 | IMPL | M1移行済み |

## 02-データモデルと永続化

[現行文書](../../spec/02-データモデルと永続化.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Document JSON | [正本](../../spec/data/保存形式.md#1-document-json)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 2. Appearance | [正本](../../spec/data/保存形式.md#2-appearance)へ集約。互換性は読込文書を参照 | DATA・LOAD | M3移行済み |
| 3. Geometry | [正本](../../spec/data/保存形式.md#3-geometry)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 4. Sketch | [正本](../../spec/data/保存形式.md#4-sketch)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 5. Block | [正本](../../spec/data/保存形式.md#5-block)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 6. Constraint Dimension Appearance | [正本](../../spec/data/保存形式.md#6-constraint-dimension-appearance)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 7. Annotation | [正本](../../spec/data/保存形式.md#7-annotation)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 8. Hatch | [正本](../../spec/data/保存形式.md#8-hatch)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 9. Reference Image | [正本](../../spec/data/保存形式.md#9-reference-image)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 10. ID | [正本](../../spec/data/保存形式.md#10-id)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 11. 読込と互換性 | [正本](../../spec/data/読込と互換性.md#1-読込と互換性)へ集約。互換性は読込文書を参照 | LOAD | M3移行済み |
| 読込結果の分類 | [正本](../../spec/data/読込と互換性.md#読込結果の分類)へ集約。互換性は読込文書を参照 | LOAD | M3移行済み |
| 検証条件 | [正本](../../spec/data/読込と互換性.md#検証条件)へ集約。互換性は読込文書を参照 | LOAD | M3移行済み |
| 旧versionからの移行 | [正本](../../spec/data/読込と互換性.md#旧versionからの移行)へ集約。互換性は読込文書を参照 | LOAD | M3移行済み |
| 描画順の正規化 | [正本](../../spec/data/読込と互換性.md#描画順の正規化)へ集約。互換性は読込文書を参照 | LOAD | M3移行済み |
| Annotation所属の補完 | [正本](../../spec/data/読込と互換性.md#annotation所属の補完)へ集約。互換性は読込文書を参照 | LOAD | M3移行済み |
| 保存往復の保証 | [正本](../../spec/data/読込と互換性.md#保存往復の保証)へ集約。互換性は読込文書を参照 | LOAD | M3移行済み |
| 12. 履歴 | [正本](../../spec/contracts/編集と履歴.md)へ集約。旧見出しは案内として保持 | TX | M2移行済み |

## 03-Geometryと拘束

[現行文書](../../spec/03-Geometryと拘束.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Geometry 要素 | [正本](../../spec/calculation/幾何計算.md#1-geometryと縮退)へ移動。操作・実装配置は関連文書へ分離 | MATH | M5移行済み |
| 共通数学契約 | [正本](../../spec/calculation/幾何計算.md#2-共通数学契約)へ移動。操作・実装配置は関連文書へ分離 | MATH | M5移行済み |
| 共通参照契約 | [正本](../../spec/data/保存形式.md#13-geometryrefとconstraint参照)へ移動。操作・実装配置は関連文書へ分離 | DATA | M5移行済み |
| 2. 作図コマンド | [正本](../../spec/operations/作図と形状編集.md#1-作図と形状編集)へ移動。 | GEO | M4移行済み |
| 点 | [正本](../../spec/operations/作図と形状編集.md#点)へ移動。 | GEO | M4移行済み |
| 連続線 | [正本](../../spec/operations/作図と形状編集.md#連続線)へ移動。 | GEO | M4移行済み |
| 中心線 | [正本](../../spec/operations/作図と形状編集.md#中心線)へ移動。 | GEO | M4移行済み |
| 矩形 | [正本](../../spec/operations/作図と形状編集.md#矩形)へ移動。 | GEO | M4移行済み |
| 長穴 | [正本](../../spec/operations/作図と形状編集.md#長穴)へ移動。 | GEO | M4移行済み |
| 円 | [正本](../../spec/operations/作図と形状編集.md#円)へ移動。 | GEO | M4移行済み |
| 円弧 | [正本](../../spec/operations/作図と形状編集.md#円弧)へ移動。 | GEO | M4移行済み |
| 3点円弧 | [正本](../../spec/operations/作図と形状編集.md#3点円弧)へ移動。 | GEO | M4移行済み |
| スプライン | [正本](../../spec/operations/作図と形状編集.md#スプライン)へ移動。 | GEO | M4移行済み |
| スケッチ投影 | [正本](../../spec/operations/作図と形状編集.md#スケッチ投影)へ移動。 | GEO | M4移行済み |
| 補助 Geometry | [正本](../../spec/operations/作図と形状編集.md#補助-geometry)へ移動。 | GEO | M4移行済み |
| R面取り | [正本](../../spec/operations/作図と形状編集.md#r面取り)へ移動。 | GEO | M4移行済み |
| トリム | [正本](../../spec/operations/作図と形状編集.md#トリム)へ移動。 | GEO | M4移行済み |
| オフセット | [正本](../../spec/operations/作図と形状編集.md#オフセット)へ移動。 | GEO | M4移行済み |
| ハッチング | [正本](../../spec/operations/作図と形状編集.md#ハッチング)へ移動。 | GEO | M4移行済み |
| 3. 選択と編集 | [正本](../../spec/ui/入力と操作状態.md#3-geometryの選択と編集)へ移動。計算の小節はM5で計算契約へ移動済み。 | INPUT | M4移行済み |
| ドラッグ中の計算 | [正本](../../spec/calculation/拘束と依存更新.md#2-ドラッグのpreview計算)へ移動。操作・実装配置は関連文書へ分離 | SOLVE | M5移行済み |
| ドラッグの確定と失敗 | [13](../../spec/13-編集の確定と失敗.md)へ集約・現行章には参照を保持 | TX | 移動予定 |
| 4. 拘束コマンド | [正本](../../spec/operations/拘束と寸法.md#1-拘束コマンド)へ移動。 | CST | M4移行済み |
| 5. 拘束追加のルール | [正本](../../spec/operations/拘束と寸法.md#2-拘束追加のルール)へ移動。 | CST | M4移行済み |
| 6. 拘束寸法と読み取り専用寸法 | [正本](../../spec/operations/拘束と寸法.md#3-拘束寸法と読み取り専用寸法)へ移動。 | CST | M4移行済み |
| 7. 数値表示 | [正本](../../spec/ui/表示とビュー操作.md#5-数値表示)へ移動。 | VIEW | M4移行済み |
| 8. solve と状態表示 | [拘束と依存更新](../../spec/calculation/拘束と依存更新.md)へ集約。旧小見出しは参照案内 | SOLVE | M5移行済み |
| 収束と受入れ | [正本](../../spec/calculation/拘束と依存更新.md#1-収束と受入れ)へ移動。操作・実装配置は関連文書へ分離 | SOLVE | M5移行済み |
| Parameterを含む確定操作 | [式評価](../../spec/calculation/式評価.md#4-評価とsolve)と[編集と履歴](../../spec/contracts/編集と履歴.md)へ参照を集約 | EVAL・TX | M5移行済み |
| 拘束状態の表示 | [正本](../../spec/calculation/拘束と依存更新.md#6-拘束状態)へ移動。操作・実装配置は関連文書へ分離 | SOLVE | M5移行済み |
| 参照元変更の影響 | [正本](../../spec/calculation/拘束と依存更新.md#7-失敗時の扱い)へ移動。操作・実装配置は関連文書へ分離 | SOLVE | M5移行済み |
| 9. Geometry の削除 | [正本](../../spec/operations/作図と形状編集.md#2-geometryの削除)へ移動。 | GEO | M4移行済み |

## 04-スケッチ

[現行文書](../../spec/04-スケッチ.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 目的と基本構造 | [正本](../../spec/operations/Sketch.md#1-目的と基本構造)へ移動。 | SK | M4移行済み |
| 2. 所属と座標系 | [正本](../../spec/contracts/所属と編集可否.md#1-所属と座標系)へ集約。旧見出しは案内として保持 | OWN | M2移行済み |
| 3. アクティブ Sketch | [正本](../../spec/contracts/所属と編集可否.md#2-アクティブsketchと編集対象)へ集約。旧見出しは案内として保持 | OWN | M2移行済み |
| 4. 作成、名前、階層 | [正本](../../spec/operations/Sketch.md#2-作成名前階層)へ移動。Treeの詳細はUIへ集約。 | SK | M4移行済み |
| 5. Appearanceと表示状態 | [正本](../../spec/operations/Sketch.md#3-appearanceと表示状態)へ移動。 | SK | M4移行済み |
| 6. スナップ | [正本](../../spec/contracts/所属と編集可否.md#3-sketchをまたぐスナップ)へ集約。旧見出しは案内として保持 | OWN | M2移行済み |
| 7. 通常拘束 | [正本](../../spec/contracts/所属と編集可否.md#4-通常拘束の範囲)へ集約。旧見出しは案内として保持 | OWN | M2移行済み |
| 8. 参照拘束 | [正本](../../spec/contracts/所属と編集可否.md#5-先祖参照の範囲)へ集約。旧見出しは案内として保持 | OWN | M2移行済み |
| 9. 参照 solve | [正本](../../spec/calculation/拘束と依存更新.md#4-sketchの依存更新)へ移動。操作・実装配置は関連文書へ分離 | SOLVE | M5移行済み |
| 10. Sketch 削除 | [正本](../../spec/operations/Sketch.md#5-sketchの削除範囲)へ集約。旧見出しは案内として保持 | SK・DEL | M2移行済み |
| 11. Block Definition 内部 Sketch | [正本](../../spec/operations/Sketch.md#4-block-definition-内部-sketch)へ移動。 | SK | M4移行済み |

## 05-ブロック

[現行文書](../../spec/05-ブロック.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 概念 | [正本](../../spec/operations/Block.md#1-概念)へ移動。 | BLK | M4移行済み |
| 2. Definition と Instance | [正本](../../spec/operations/Block.md#2-definition-と-instance)へ移動。 | BLK | M4移行済み |
| 3. Projection | [正本](../../spec/operations/Block.md#3-projection)へ移動。 | BLK | M4移行済み |
| 4. 選択 Geometry からの作成 | [正本](../../spec/operations/Block.md#4-選択-geometry-からの作成)へ移動。 | BLK | M4移行済み |
| 5. 空 Definition の作成 | [正本](../../spec/operations/Block.md#5-空-definition-の作成)へ移動。 | BLK | M4移行済み |
| 6. Definition管理画面 | [正本](../../spec/operations/Block.md#6-definition管理画面)へ移動。 | BLK | M4移行済み |
| 7. Block Editor | [正本](../../spec/operations/Block.md#7-block-editor)へ移動。 | BLK | M4移行済み |
| 8. 入れ子 Block | [正本](../../spec/operations/Block.md#8-入れ子-block)へ移動。 | BLK | M4移行済み |
| 9. 配置 | [正本](../../spec/operations/Block.md#9-配置)へ移動。 | BLK | M4移行済み |
| 10. Instance 編集 | [正本](../../spec/operations/Block.md#10-instance-編集)へ移動。 | BLK | M4移行済み |
| 11. 有効内部 Sketch | [正本](../../spec/operations/Block.md#11-有効内部-sketch)へ移動。 | BLK | M4移行済み |
| 12. Constraint と solve | [正本](../../spec/operations/Block.md#12-constraint-と-solve)へ移動。 | BLK | M4移行済み |
| 13. Definition 編集完了 | [正本](../../spec/operations/Block.md#13-definition-編集完了)へ移動。 | BLK | M4移行済み |
| 14. 削除と互換性 | [正本](../../spec/operations/Block.md#14-削除と互換性)へ移動。 | BLK | M4移行済み |
| 15. 未実装 | [正本](../../spec/operations/Block.md#15-未実装)へ移動。 | BLK | M4移行済み |

## 06-表示と注記

[現行文書](../../spec/06-表示と注記.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 単一Canvas | [正本](../../spec/ui/表示とビュー操作.md#2-単一canvas)へ移動。 | VIEW | M4移行済み |
| 1.1 モデル単位と表示倍率 | [正本](../../spec/ui/表示とビュー操作.md#11-モデル単位と表示倍率)へ移動。 | VIEW | M4移行済み |
| 2. Appearanceの継承 | [正本](../../spec/contracts/外観.md)へ集約。旧見出しは案内として保持 | APP | M2移行済み |
| 解決する順序 | [正本](../../spec/contracts/外観.md)へ集約。旧見出しは案内として保持 | APP | M2移行済み |
| 初期値と補助Lineの端部 | [正本](../../spec/contracts/外観.md)へ集約。旧見出しは案内として保持 | APP | M2移行済み |
| テーマと一時的な強調 | [正本](../../spec/contracts/外観.md)へ集約。旧見出しは案内として保持 | APP | M2移行済み |
| 3. visible | [正本](../../spec/contracts/外観.md)へ集約。旧見出しは案内として保持 | APP | M2移行済み |
| 4. Constraint Status View | [正本](../../spec/ui/表示とビュー操作.md#3-constraint-status-view)へ移動。 | VIEW | M4移行済み |
| 5. Constraint Dimension | [正本](../../spec/operations/拘束と寸法.md#4-寸法の表示と配置)へ移動。 | CST | M4移行済み |
| 6. Annotation | [正本](../../spec/operations/注記.md#1-annotation)へ移動。 | ANN | M4移行済み |
| Leader | [正本](../../spec/operations/注記.md#leader)へ移動。 | ANN | M4移行済み |
| Free Text | [正本](../../spec/operations/注記.md#free-text)へ移動。 | ANN | M4移行済み |
| 7. Hatch表示 | [正本](../../spec/operations/Hatch.md#1-hatchの表示と重なり順)へ移動。 | HAT | M4移行済み |
| 8. Reference Image表示 | [正本](../../spec/operations/参照画像.md#1-画像の表示)へ移動。 | IMG | M4移行済み |
| 9. View State | [正本](../../spec/ui/表示とビュー操作.md#4-view-state)へ移動。 | VIEW | M4移行済み |

## 07-UI・操作・履歴

[現行文書](../../spec/07-UI・操作・履歴.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 固定レイアウト | [正本](../../spec/ui/画面構成.md#1-固定レイアウト)へ移動。 | UI | M4移行済み |
| 1.1 配色 | [正本](../../spec/ui/画面構成.md#11-配色)へ移動。 | UI | M4移行済み |
| 2. Menu Bar | [正本](../../spec/ui/画面構成.md#2-menu-bar)へ移動。 | UI | M4移行済み |
| 3. Toolbar | [正本](../../spec/ui/画面構成.md#3-toolbar)へ移動。 | UI | M4移行済み |
| 4. Sketch Tree | [正本](../../spec/ui/画面構成.md#4-sketch-tree)へ移動。 | UI | M4移行済み |
| 5. Properties | [正本](../../spec/ui/画面構成.md#5-properties)へ移動。 | UI | M4移行済み |
| 6. Parameter画面 | [正本](../../spec/operations/Parameter.md#1-parameter画面)へ移動。 | PAR | M4移行済み |
| 7. Selectionと操作状態 | [正本](../../spec/ui/入力と操作状態.md#1-selectionと操作状態)へ移動。 | INPUT | M4移行済み |
| Canvas右クリックメニュー | [正本](../../spec/ui/入力と操作状態.md#canvas右クリックメニュー)へ移動。 | INPUT | M4移行済み |
| 8. Status Bar | [正本](../../spec/ui/画面構成.md#6-status-bar)へ移動。 | UI | M4移行済み |
| 9. Shortcut | [正本](../../spec/ui/入力と操作状態.md#2-shortcut)へ移動。 | INPUT | M4移行済み |
| 10. View操作 | [正本](../../spec/ui/表示とビュー操作.md#1-ビュー操作とpointer処理)へ移動。 | VIEW | M4移行済み |
| 11. History | [正本](../../spec/contracts/編集と履歴.md)へ集約。旧見出しは案内として保持 | TX | M2移行済み |

## 08-Parameter

[現行文書](../../spec/08-Parameter.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 名前空間 | [正本](../../spec/calculation/式評価.md#1-名前空間)へ移動。操作・実装配置は関連文書へ分離 | EVAL | M5移行済み |
| 2. 識別子と採番 | [正本](../../spec/calculation/式評価.md#2-識別子と採番)へ移動。操作・実装配置は関連文書へ分離 | EVAL | M5移行済み |
| 3. 式 | [正本](../../spec/calculation/式評価.md#3-式)へ移動。操作・実装配置は関連文書へ分離 | EVAL | M5移行済み |
| 4. 評価とsolve | [正本](../../spec/calculation/式評価.md#4-評価とsolve)へ移動。操作・実装配置は関連文書へ分離 | EVAL | M5移行済み |
| 5. 編集 | [正本](../../spec/operations/Parameter.md#2-編集)へ移動。 | PAR | M4移行済み |
| 6. 削除・コピー・Block化 | [正本](../../spec/operations/Parameter.md#3-削除コピーblock化)へ移動。 | PAR | M4移行済み |
| 7. 永続化 | [正本](../../spec/operations/Parameter.md#4-永続化)へ移動。 | PAR | M4移行済み |

## 09-ハッチング

[現行文書](../../spec/09-ハッチング.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 基本仕様 | [正本](../../spec/operations/Hatch.md#2-基本仕様)へ移動。 | HAT | M4移行済み |
| 2. データモデル | [正本](../../spec/data/保存形式.md#8-hatch)へ集約。互換性は読込文書を参照 | DATA | M3移行済み |
| 3. 閉領域と境界追従 | [正本](../../spec/calculation/幾何計算.md#4-閉領域)へ移動。操作・実装配置は関連文書へ分離 | MATH | M5移行済み |
| 4. 描画と選択 | [正本](../../spec/operations/Hatch.md#3-描画と選択)へ移動。 | HAT | M4移行済み |
| 5. 削除、コピー、Block化 | [正本](../../spec/operations/Hatch.md#4-削除コピーblock化)へ移動。 | HAT | M4移行済み |
| 6. Block Projection | [正本](../../spec/operations/Hatch.md#5-block-projection)へ移動。 | HAT | M4移行済み |
| 7. JSON互換性と性能 | [正本](../../spec/operations/Hatch.md#6-json互換性と性能)へ移動。 | HAT | M4移行済み |
| 8. 検証 | 未整理・現行内容を保持 | COV | 移動予定 |

## 10-スプライン

[現行文書](../../spec/10-スプライン.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 形状と補間 | [正本](../../spec/calculation/幾何計算.md#3-splineの補間)へ移動。操作・実装配置は関連文書へ分離 | MATH | M5移行済み |
| 2. 作成と編集 | [正本](../../spec/operations/Spline.md#1-作成と編集)へ移動。 | SPL | M4移行済み |
| 作成 | [正本](../../spec/operations/Spline.md#作成)へ移動。 | SPL | M4移行済み |
| fit point編集mode | [正本](../../spec/operations/Spline.md#fit-point編集mode)へ移動。 | SPL | M4移行済み |
| Propertiesと派生Spline | [正本](../../spec/operations/Spline.md#propertiesと派生spline)へ移動。 | SPL | M4移行済み |
| 3. Selection、Sketch Tree、Annotation | [正本](../../spec/operations/Spline.md#2-selectionsketch-treeannotation)へ移動。 | SPL | M4移行済み |
| 4. 拘束 | [正本](../../spec/operations/Spline.md#3-拘束)へ移動。 | SPL | M4移行済み |
| 5. HatchとGeometry操作 | [正本](../../spec/operations/Spline.md#4-hatchとgeometry操作)へ移動。 | SPL | M4移行済み |
| 6. Copy、Block、Projection | [正本](../../spec/operations/Spline.md#5-copyblockprojection)へ移動。 | SPL | M4移行済み |
| 7. JSONと互換性 | [正本](../../spec/operations/Spline.md#6-jsonと互換性)へ移動。 | SPL | M4移行済み |
| 8. 検証 | 未整理・現行内容を保持 | COV | 移動予定 |

## 11-参照画像

[現行文書](../../spec/11-参照画像.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 目的と範囲 | [正本](../../spec/operations/参照画像.md#2-目的と範囲)へ移動。 | IMG | M4移行済み |
| 2. 読み込み | [正本](../../spec/operations/参照画像.md#3-読み込み)へ移動。 | IMG | M4移行済み |
| 3. 表示と操作 | [正本](../../spec/operations/参照画像.md#4-表示と操作)へ移動。 | IMG | M4移行済み |
| 4. 永続化 | [正本](../../spec/operations/参照画像.md#5-永続化)へ移動。 | IMG | M4移行済み |
| 5. テスト | 未整理・現行内容を保持 | COV | 移動予定 |

## 12-スケッチ投影

[現行文書](../../spec/12-スケッチ投影.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 共通モデル | [正本](../../spec/operations/派生Instance.md#1-共通モデル)へ移動。 | DER | M4移行済み |
| 2. 種類 | [正本](../../spec/operations/派生Instance.md#2-種類)へ移動。 | DER | M4移行済み |
| 2.1 スケッチ投影インスタンス | [正本](../../spec/operations/派生Instance.md#21-スケッチ投影インスタンス)へ移動。 | DER | M4移行済み |
| 2.2 ミラーインスタンス | [正本](../../spec/operations/派生Instance.md#22-ミラーインスタンス)へ移動。 | DER | M4移行済み |
| 2.3 直線パターンインスタンス | [正本](../../spec/operations/派生Instance.md#23-直線パターンインスタンス)へ移動。 | DER | M4移行済み |
| 3. 保存形式 | [正本](../../spec/operations/派生Instance.md#3-保存形式)へ移動。 | DER | M4移行済み |
| 4. 表示・外観・Tree | [正本](../../spec/operations/派生Instance.md#4-表示外観tree)へ移動。 | DER | M4移行済み |
| 5. 編集と削除 | [正本](../../spec/operations/派生Instance.md#5-編集と削除)へ移動。 | DER | M4移行済み |

## 13-編集の確定と失敗

[現行文書](../../spec/13-編集の確定と失敗.md)

共通契約の集約先として新設。TX-01～05は現行の操作別差異を維持する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 操作と計算結果の区別 | [正本](../../spec/contracts/編集と履歴.md)へ集約。旧見出しは案内として保持 | TX | M2移行済み |
| 2. 操作別の復元範囲 | [正本](../../spec/contracts/編集と履歴.md)へ集約。旧見出しは案内として保持 | TX | M2移行済み |
| 3. Geometryドラッグの確定 | [正本](../../spec/contracts/編集と履歴.md)へ集約。旧見出しは案内として保持 | TX | M2移行済み |
| 4. 履歴と操作の範囲 | [正本](../../spec/contracts/編集と履歴.md)へ集約。旧見出しは案内として保持 | TX | M2移行済み |

## 14-削除と参照

[現行文書](../../spec/14-削除と参照.md)

操作・削除対象・存続する依存先を区別する共通契約の集約先。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 削除を拒否する参照 | [正本](../../spec/contracts/削除と参照.md)へ集約。旧見出しは案内として保持 | DEL | M2移行済み |
| 2. 削除が成立した場合の参照整理 | [正本](../../spec/contracts/削除と参照.md)へ集約。旧見出しは案内として保持 | DEL | M2移行済み |
| 3. Sketchの削除範囲 | [正本](../../spec/operations/Sketch.md#5-sketchの削除範囲)へ集約。旧見出しは案内として保持 | SK・DEL | M2移行済み |
| 4. Blockの構成変更 | [正本](../../spec/operations/Block.md#16-blockの構成変更)へ集約。旧見出しは案内として保持 | BLK・DEL | M2移行済み |

## 90-実装対応表とテスト

[現行文書](../../spec/90-実装対応表とテスト.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 主要ファイル | [実装対応表 §2](./implementation-map.md#2-領域とテスト)へ集約。旧参照先を保持 | IMPL | M1移行済み |
| 2. 現行仕様のE2E保証 | 未整理・現行内容を保持 | COV | 移動予定 |
| 読込結果とSpline操作 | LOAD-01～05とSpline確定の代表保証を対応表へ整理 | COV | 移動予定 |
| 削除と外観 | DEL・APPの代表ケースとテストの対応を追加 | COV | 移動予定 |
| 所属・編集可否と履歴 | M2の新しい正本と既存E2Eの代表保証を対応付け | COV | 移動予定 |
| ファイル操作と保存形式 | M3の正本と既存E2Eの代表保証を対応付け | COV | 移動予定 |
| 機能別操作とUI | M4の正本と既存suiteを対応付け | COV | 移動予定 |
| 3. 検証コマンド | 未整理・現行内容を保持 | RUN | 移動予定 |
| 4. Visual baseline | 未整理・現行内容を保持 | RUN | 移動予定 |
| 5. 完了判定 | 未整理・現行内容を保持 | RUN | 移動予定 |
| 計算契約 | [正本](../../spec/90-実装対応表とテスト.md#計算契約)に保持 | COV | M5移行済み |

## 91-改善バックログ

[現行文書](../../spec/91-改善バックログ.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| P0 | [改善バックログ](./backlog.md#p0)へ集約。旧参照先を保持 | BACK | M1移行済み |
| app.jsの責務分割 | [改善バックログ](./backlog.md#appjsの責務分割)へ集約。旧参照先を保持 | BACK | M1移行済み |
| Loaderの段階化 | [改善バックログ](./backlog.md#loaderの段階化)へ集約。旧参照先を保持 | BACK | M1移行済み |
| 参照cleanupの集約 | [改善バックログ](./backlog.md#参照cleanupの集約)へ集約。旧参照先を保持 | BACK | M1移行済み |
| P1 | [改善バックログ](./backlog.md#p1)へ集約。旧参照先を保持 | BACK | M1移行済み |
| Renderer policyの共通化 | [改善バックログ](./backlog.md#renderer-policyの共通化)へ集約。旧参照先を保持 | BACK | M1移行済み |
| UI差分更新 | [改善バックログ](./backlog.md#ui差分更新)へ集約。旧参照先を保持 | BACK | M1移行済み |
| Test hook分離 | [改善バックログ](./backlog.md#test-hook分離)へ集約。旧参照先を保持 | BACK | M1移行済み |
| P2 | [改善バックログ](./backlog.md#p2)へ集約。旧参照先を保持 | BACK | M1移行済み |
| 型とschema検証 | [改善バックログ](./backlog.md#型とschema検証)へ集約。旧参照先を保持 | BACK | M1移行済み |
| Accessibility | [改善バックログ](./backlog.md#accessibility)へ集約。旧参照先を保持 | BACK | M1移行済み |

## README

[現行文書](../../spec/README.md)

移行先: 下表のIDを[移行計画](./migration-plan.md)のファイル構成と照合する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 文書一覧 | [7領域の入口](../../spec/README.md#文書一覧)へ集約。旧参照先を保持 | INDEX | M1移行済み |
| 用語 | [基本概念 §2](../../spec/concepts/基本概念.md#2-用語と役割)へ集約。旧参照先を保持 | CON | M1移行済み |
| 開発資料 | [実装対応・改善候補への案内](../../spec/README.md#開発資料)を正式仕様一覧から分離 | INDEX | M1移行済み |

## concepts/基本概念

[現行文書](../../spec/concepts/基本概念.md)

M1で作成した用語と製品モデルの正本。旧01・READMEからの移動元は上表で追跡する。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 製品モデル | 旧01のモデル図を移動。外観の詳細は06へ参照 | CON | M1移行済み |
| 2. 用語と役割 | 旧01の責務とREADME用語を集約。詳細規則を参照 | CON | M1移行済み |
| 3. Documentと操作・表示状態 | 旧01の状態分離を整理。履歴・表示の詳細を参照 | CON | M1移行済み |

## contracts/所属と編集可否

[現行文書](../../spec/contracts/所属と編集可否.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 所属と座標系 | M2で集約。固有操作の残りはM4で整理 | OWN | M2移行済み |
| 2. アクティブSketchと編集対象 | M2で集約。固有操作の残りはM4で整理 | OWN | M2移行済み |
| 3. Sketchをまたぐスナップ | M2で集約。固有操作の残りはM4で整理 | OWN | M2移行済み |
| 4. 通常拘束の範囲 | M2で集約。固有操作の残りはM4で整理 | OWN | M2移行済み |
| 5. 先祖参照の範囲 | M2で集約。固有操作の残りはM4で整理 | OWN | M2移行済み |
| 6. Blockと派生Geometryの編集 | M2で集約。固有操作の残りはM4で整理 | OWN | M2移行済み |

## contracts/編集と履歴

[現行文書](../../spec/contracts/編集と履歴.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 操作と計算結果の区別 | M2で集約。固有操作の残りはM4で整理 | TX | M2移行済み |
| 2. 操作別の復元範囲 | M2で集約。固有操作の残りはM4で整理 | TX | M2移行済み |
| 3. Geometryドラッグの確定 | M2で集約。固有操作の残りはM4で整理 | TX | M2移行済み |
| 4. 履歴と操作の範囲 | M2で集約。固有操作の残りはM4で整理 | TX | M2移行済み |
| 5. 履歴に保持する状態 | M2で集約。固有操作の残りはM4で整理 | TX | M2移行済み |
| 6. 履歴・永続化の対象外 | M2で集約。固有操作の残りはM4で整理 | TX | M2移行済み |

## contracts/削除と参照

[現行文書](../../spec/contracts/削除と参照.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 削除を拒否する参照 | M2で集約。固有操作の残りはM4で整理 | DEL | M2移行済み |
| 2. 削除が成立した場合の参照整理 | M2で集約。固有操作の残りはM4で整理 | DEL | M2移行済み |
| 3. 操作ごとの適用 | M2で集約。固有操作の残りはM4で整理 | DEL | M2移行済み |

## contracts/外観

[現行文書](../../spec/contracts/外観.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Appearanceの継承 | M2で集約。固有操作の残りはM4で整理 | APP | M2移行済み |
| 解決する順序 | M2で集約。固有操作の残りはM4で整理 | APP | M2移行済み |
| 初期値と補助Lineの端部 | M2で集約。固有操作の残りはM4で整理 | APP | M2移行済み |
| テーマと一時的な強調 | M2で集約。固有操作の残りはM4で整理 | APP | M2移行済み |
| 2. visible | M2で集約。固有操作の残りはM4で整理 | APP | M2移行済み |

## data/保存形式

[現行文書](../../spec/data/保存形式.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Document JSON | M3で集約 | DATA | M3移行済み |
| 2. Appearance | M3で集約 | DATA | M3移行済み |
| 3. Geometry | M3で集約 | DATA | M3移行済み |
| 4. Sketch | M3で集約 | DATA | M3移行済み |
| 5. Block | M3で集約 | DATA | M3移行済み |
| 6. Constraint Dimension Appearance | M3で集約 | DATA | M3移行済み |
| 7. Annotation | M3で集約 | DATA | M3移行済み |
| 8. Hatch | M3で集約 | DATA | M3移行済み |
| 9. Reference Image | M3で集約 | DATA | M3移行済み |
| 10. ID | M3で集約 | DATA | M3移行済み |
| 11. 派生Geometry Instance | M3で集約 | DATA | M3移行済み |
| 12. 編集中データとClipboard | M3で集約 | DATA | M3移行済み |
| 13. GeometryRefとConstraint参照 | [正本](../../spec/data/保存形式.md#13-geometryrefとconstraint参照)に保持 | DATA | M5移行済み |

## data/読込と互換性

[現行文書](../../spec/data/読込と互換性.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 読込と互換性 | M3で集約 | LOAD | M3移行済み |
| 読込結果の分類 | M3で集約 | LOAD | M3移行済み |
| 検証条件 | M3で集約 | LOAD | M3移行済み |
| 旧versionからの移行 | M3で集約 | LOAD | M3移行済み |
| 描画順の正規化 | M3で集約 | LOAD | M3移行済み |
| Annotation所属の補完 | M3で集約 | LOAD | M3移行済み |
| 保存往復の保証 | M3で集約 | LOAD | M3移行済み |
| 2. field欠落と旧外観の補完 | M3で集約 | LOAD | M3移行済み |
| 3. 機能別の検証詳細 | M3で集約 | LOAD | M3移行済み |
| Reference Image | M3で集約 | LOAD | M3移行済み |
| Spline | M3で集約 | LOAD | M3移行済み |
| Hatch | M3で集約 | LOAD | M3移行済み |

## operations/ファイル操作

[現行文書](../../spec/operations/ファイル操作.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 開く・保存・保存先 | M3で集約 | FILE | M3移行済み |
| 2. 保存先ハンドルの保持範囲 | M3で集約 | FILE | M3移行済み |
| 3. 操作の入口 | M3で集約 | FILE | M3移行済み |

## operations/作図と形状編集

[現行文書](../../spec/operations/作図と形状編集.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 作図と形状編集 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 点 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 連続線 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 中心線 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 矩形 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 長穴 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 円 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 円弧 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 3点円弧 | M4で操作・UIへ集約 | GEO | M4移行済み |
| スプライン | M4で操作・UIへ集約 | GEO | M4移行済み |
| スケッチ投影 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 補助 Geometry | M4で操作・UIへ集約 | GEO | M4移行済み |
| R面取り | M4で操作・UIへ集約 | GEO | M4移行済み |
| トリム | M4で操作・UIへ集約 | GEO | M4移行済み |
| オフセット | M4で操作・UIへ集約 | GEO | M4移行済み |
| ハッチング | M4で操作・UIへ集約 | GEO | M4移行済み |
| 2. Geometryの削除 | M4で操作・UIへ集約 | GEO | M4移行済み |
| 3. Offsetのチェーン選択 | M4で操作・UIへ集約 | GEO | M4移行済み |

## operations/拘束と寸法

[現行文書](../../spec/operations/拘束と寸法.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 拘束コマンド | M4で操作・UIへ集約 | CST | M4移行済み |
| 2. 拘束追加のルール | M4で操作・UIへ集約 | CST | M4移行済み |
| 3. 拘束寸法と読み取り専用寸法 | M4で操作・UIへ集約 | CST | M4移行済み |
| 4. 寸法の表示と配置 | M4で操作・UIへ集約 | CST | M4移行済み |
| 5. 寸法コマンドの入力 | M4で操作・UIへ集約 | CST | M4移行済み |
| 6. 固定と解除 | [正本](../../spec/operations/拘束と寸法.md#6-固定と解除)に保持 | CST | M5移行済み |

## operations/Sketch

[現行文書](../../spec/operations/Sketch.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 目的と基本構造 | M4で操作・UIへ集約 | SK | M4移行済み |
| 2. 作成、名前、階層 | M4で操作・UIへ集約 | SK | M4移行済み |
| 3. Appearanceと表示状態 | M4で操作・UIへ集約 | SK | M4移行済み |
| 4. Block Definition 内部 Sketch | M4で操作・UIへ集約 | SK | M4移行済み |
| 5. Sketchの削除範囲 | M4で操作・UIへ集約 | SK | M4移行済み |

## operations/Block

[現行文書](../../spec/operations/Block.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 概念 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 2. Definition と Instance | M4で操作・UIへ集約 | BLK | M4移行済み |
| 3. Projection | M4で操作・UIへ集約 | BLK | M4移行済み |
| 4. 選択 Geometry からの作成 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 5. 空 Definition の作成 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 6. Definition管理画面 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 7. Block Editor | M4で操作・UIへ集約 | BLK | M4移行済み |
| 8. 入れ子 Block | M4で操作・UIへ集約 | BLK | M4移行済み |
| 9. 配置 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 10. Instance 編集 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 11. 有効内部 Sketch | M4で操作・UIへ集約 | BLK | M4移行済み |
| 12. Constraint と solve | M4で操作・UIへ集約 | BLK | M4移行済み |
| 13. Definition 編集完了 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 14. 削除と互換性 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 15. 未実装 | M4で操作・UIへ集約 | BLK | M4移行済み |
| 16. Blockの構成変更 | M4で操作・UIへ集約 | BLK | M4移行済み |

## operations/Parameter

[現行文書](../../spec/operations/Parameter.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Parameter画面 | M4で操作・UIへ集約 | PAR | M4移行済み |
| 2. 編集 | M4で操作・UIへ集約 | PAR | M4移行済み |
| 3. 削除・コピー・Block化 | M4で操作・UIへ集約 | PAR | M4移行済み |
| 4. 永続化 | M4で操作・UIへ集約 | PAR | M4移行済み |

## operations/Hatch

[現行文書](../../spec/operations/Hatch.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Hatchの表示と重なり順 | M4で操作・UIへ集約 | HAT | M4移行済み |
| 2. 基本仕様 | M4で操作・UIへ集約 | HAT | M4移行済み |
| 3. 描画と選択 | M4で操作・UIへ集約 | HAT | M4移行済み |
| 4. 削除、コピー、Block化 | M4で操作・UIへ集約 | HAT | M4移行済み |
| 5. Block Projection | M4で操作・UIへ集約 | HAT | M4移行済み |
| 6. JSON互換性と性能 | M4で操作・UIへ集約 | HAT | M4移行済み |
| 7. 境界追従と修復 | M4で操作・UIへ集約 | HAT | M4移行済み |

## operations/Spline

[現行文書](../../spec/operations/Spline.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 作成と編集 | M4で操作・UIへ集約 | SPL | M4移行済み |
| 作成 | M4で操作・UIへ集約 | SPL | M4移行済み |
| fit point編集mode | M4で操作・UIへ集約 | SPL | M4移行済み |
| Propertiesと派生Spline | M4で操作・UIへ集約 | SPL | M4移行済み |
| 2. Selection、Sketch Tree、Annotation | M4で操作・UIへ集約 | SPL | M4移行済み |
| 3. 拘束 | M4で操作・UIへ集約 | SPL | M4移行済み |
| 4. HatchとGeometry操作 | M4で操作・UIへ集約 | SPL | M4移行済み |
| 5. Copy、Block、Projection | M4で操作・UIへ集約 | SPL | M4移行済み |
| 6. JSONと互換性 | M4で操作・UIへ集約 | SPL | M4移行済み |

## operations/参照画像

[現行文書](../../spec/operations/参照画像.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 画像の表示 | M4で操作・UIへ集約 | IMG | M4移行済み |
| 2. 目的と範囲 | M4で操作・UIへ集約 | IMG | M4移行済み |
| 3. 読み込み | M4で操作・UIへ集約 | IMG | M4移行済み |
| 4. 表示と操作 | M4で操作・UIへ集約 | IMG | M4移行済み |
| 5. 永続化 | M4で操作・UIへ集約 | IMG | M4移行済み |

## operations/派生Instance

[現行文書](../../spec/operations/派生Instance.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 共通モデル | M4で操作・UIへ集約 | DER | M4移行済み |
| 2. 種類 | M4で操作・UIへ集約 | DER | M4移行済み |
| 2.1 スケッチ投影インスタンス | M4で操作・UIへ集約 | DER | M4移行済み |
| 2.2 ミラーインスタンス | M4で操作・UIへ集約 | DER | M4移行済み |
| 2.3 直線パターンインスタンス | M4で操作・UIへ集約 | DER | M4移行済み |
| 3. 保存形式 | M4で操作・UIへ集約 | DER | M4移行済み |
| 4. 表示・外観・Tree | M4で操作・UIへ集約 | DER | M4移行済み |
| 5. 編集と削除 | M4で操作・UIへ集約 | DER | M4移行済み |
| 6. 派生Instanceの入力と選択 | M4で操作・UIへ集約 | DER | M4移行済み |

## operations/注記

[現行文書](../../spec/operations/注記.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Annotation | M4で操作・UIへ集約 | ANN | M4移行済み |
| Leader | M4で操作・UIへ集約 | ANN | M4移行済み |
| Free Text | M4で操作・UIへ集約 | ANN | M4移行済み |

## ui/画面構成

[現行文書](../../spec/ui/画面構成.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 固定レイアウト | M4で操作・UIへ集約 | UI | M4移行済み |
| 1.1 配色 | M4で操作・UIへ集約 | UI | M4移行済み |
| 2. Menu Bar | M4で操作・UIへ集約 | UI | M4移行済み |
| 3. Toolbar | M4で操作・UIへ集約 | UI | M4移行済み |
| 4. Sketch Tree | M4で操作・UIへ集約 | UI | M4移行済み |
| 5. Properties | M4で操作・UIへ集約 | UI | M4移行済み |
| 6. Status Bar | M4で操作・UIへ集約 | UI | M4移行済み |

## ui/入力と操作状態

[現行文書](../../spec/ui/入力と操作状態.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Selectionと操作状態 | M4で操作・UIへ集約 | INPUT | M4移行済み |
| Canvas右クリックメニュー | M4で操作・UIへ集約 | INPUT | M4移行済み |
| 2. Shortcut | M4で操作・UIへ集約 | INPUT | M4移行済み |
| 3. Geometryの選択と編集 | M4で操作・UIへ集約 | INPUT | M4移行済み |

## ui/表示とビュー操作

[現行文書](../../spec/ui/表示とビュー操作.md)

計算条件はM5で分離済み。保証対応の集約はM6で続ける。

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. ビュー操作とpointer処理 | M4で操作・UIへ集約 | VIEW | M4移行済み |
| 2. 単一Canvas | M4で操作・UIへ集約 | VIEW | M4移行済み |
| 1.1 モデル単位と表示倍率 | M4で操作・UIへ集約 | VIEW | M4移行済み |
| 3. Constraint Status View | M4で操作・UIへ集約 | VIEW | M4移行済み |
| 4. View State | M4で操作・UIへ集約 | VIEW | M4移行済み |
| 5. 数値表示 | M4で操作・UIへ集約 | VIEW | M4移行済み |

## calculation/幾何計算

[現行文書](../../spec/calculation/幾何計算.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. Geometryと縮退 | [正本](../../spec/calculation/幾何計算.md#1-geometryと縮退)に保持 | MATH | M5移行済み |
| 2. 共通数学契約 | [正本](../../spec/calculation/幾何計算.md#2-共通数学契約)に保持 | MATH | M5移行済み |
| 角度とArc | [正本](../../spec/calculation/幾何計算.md#角度とarc)に保持 | MATH | M5移行済み |
| Lineの方向と符号付き距離 | [正本](../../spec/calculation/幾何計算.md#lineの方向と符号付き距離)に保持 | MATH | M5移行済み |
| 投影と交点と鏡映 | [正本](../../spec/calculation/幾何計算.md#投影と交点と鏡映)に保持 | MATH | M5移行済み |
| 編集policyとの境界 | [正本](../../spec/calculation/幾何計算.md#編集policyとの境界)に保持 | MATH | M5移行済み |
| 3. Splineの補間 | [正本](../../spec/calculation/幾何計算.md#3-splineの補間)に保持 | MATH | M5移行済み |
| 4. 閉領域 | [正本](../../spec/calculation/幾何計算.md#4-閉領域)に保持 | MATH | M5移行済み |
| 5. Offsetチェーン | [正本](../../spec/calculation/幾何計算.md#5-offsetチェーン)に保持 | MATH | M5移行済み |
| 6. 長穴と3点円弧 | [正本](../../spec/calculation/幾何計算.md#6-長穴と3点円弧)に保持 | MATH | M5移行済み |
| 長穴 | [正本](../../spec/calculation/幾何計算.md#長穴)に保持 | MATH | M5移行済み |
| 3点円弧 | [正本](../../spec/calculation/幾何計算.md#3点円弧)に保持 | MATH | M5移行済み |

## calculation/式評価

[現行文書](../../spec/calculation/式評価.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 名前空間 | [正本](../../spec/calculation/式評価.md#1-名前空間)に保持 | EVAL | M5移行済み |
| 2. 識別子と採番 | [正本](../../spec/calculation/式評価.md#2-識別子と採番)に保持 | EVAL | M5移行済み |
| 3. 式 | [正本](../../spec/calculation/式評価.md#3-式)に保持 | EVAL | M5移行済み |
| 4. 評価とsolve | [正本](../../spec/calculation/式評価.md#4-評価とsolve)に保持 | EVAL | M5移行済み |

## calculation/拘束と依存更新

[現行文書](../../spec/calculation/拘束と依存更新.md)

| 現行見出し | 内容の整理状況 | 移行先ID | 再配置 |
| --- | --- | --- | --- |
| 1. 収束と受入れ | [正本](../../spec/calculation/拘束と依存更新.md#1-収束と受入れ)に保持 | SOLVE | M5移行済み |
| 2. ドラッグのpreview計算 | [正本](../../spec/calculation/拘束と依存更新.md#2-ドラッグのpreview計算)に保持 | SOLVE | M5移行済み |
| 3. Lineドラッグのtarget選択 | [正本](../../spec/calculation/拘束と依存更新.md#3-lineドラッグのtarget選択)に保持 | SOLVE | M5移行済み |
| 4. Sketchの依存更新 | [正本](../../spec/calculation/拘束と依存更新.md#4-sketchの依存更新)に保持 | SOLVE | M5移行済み |
| 5. Blockの配置とsolve変数 | [正本](../../spec/calculation/拘束と依存更新.md#5-blockの配置とsolve変数)に保持 | SOLVE | M5移行済み |
| 6. 拘束状態 | [正本](../../spec/calculation/拘束と依存更新.md#6-拘束状態)に保持 | SOLVE | M5移行済み |
| 7. 失敗時の扱い | [正本](../../spec/calculation/拘束と依存更新.md#7-失敗時の扱い)に保持 | SOLVE | M5移行済み |
| 8. 中心線 | [正本](../../spec/calculation/拘束と依存更新.md#8-中心線)に保持 | SOLVE | M5移行済み |
| 9. 対称 | [正本](../../spec/calculation/拘束と依存更新.md#9-対称)に保持 | SOLVE | M5移行済み |
| 10. 距離寸法 | [正本](../../spec/calculation/拘束と依存更新.md#10-距離寸法)に保持 | SOLVE | M5移行済み |
| LineとCircleの中心距離 | [正本](../../spec/calculation/拘束と依存更新.md#lineとcircleの中心距離)に保持 | SOLVE | M5移行済み |
| 同心半径差 | [正本](../../spec/calculation/拘束と依存更新.md#同心半径差)に保持 | SOLVE | M5移行済み |
| Point対称 | [正本](../../spec/calculation/拘束と依存更新.md#point対称)に保持 | SOLVE | M5移行済み |
| Line対称 | [正本](../../spec/calculation/拘束と依存更新.md#line対称)に保持 | SOLVE | M5移行済み |
| Arc対称 | [正本](../../spec/calculation/拘束と依存更新.md#arc対称)に保持 | SOLVE | M5移行済み |

# 実装対応表

現在の実装配置を調べるための開発資料。正式仕様や将来の分割設計ではない。仕様と保証内容は[仕様の入口](../../spec/README.md)および[検証対応](../../spec/verification/保証対応.md)を参照する。

## 1. 実装ファイルの責務

- `index.html`: 固定ワークスペースとコマンドUI
- `style.css`: レイアウトと状態表現
- `app.js`: Document状態、描画、入力、保存、履歴、Block、Appearance、Annotation、Reference Image
- `parameter_engine.js`: Parameter式の字句解析、構文解析、依存評価、識別子検証と名称書換え
- `constraint_solver.js`: GeometryとConstraintのsolver
- `geometry_ref.js`: 直接GeometryとBlock Projectionの参照codec
- `spline_geometry.js`: Splineの補間、評価、微分、最近点、flatten、交点計算
- `hatch_region.js`: 閉領域の交点計算、平面グラフ、面探索、境界復元
- `offset_chain.js`: Line／Arcチェーンの支持曲線オフセット、マイター接続、退化・自己交差検出
- `constraint_codec_registry.js`: Constraint永続化dispatch

## 2. 領域とテスト

| 領域 | 実装 | 主なテスト |
| --- | --- | --- |
| Geometry kernel | `geometry_kernel.js` | `geometry-kernel.test.js` |
| Spline kernel | `spline_geometry.js` | `spline-geometry.test.js`、`spline.spec.js` |
| GeometryRef | `geometry_ref.js` | `geometry-ref.test.js` |
| Constraint codec | `constraint_codec_registry.js` | `constraint-codec-registry.test.js` |
| Parameter式 | `parameter_engine.js` | `parameter-engine.test.js` |
| Hatch region | `hatch_region.js` | `hatch-region.test.js`、`hatching.spec.js` |
| Sketch内描画順 | `app.js` | `drawing-order.spec.js` |
| Reference Image | `app.js`、`index.html` | `reference-images.spec.js` |
| 派生Geometry Instance | `app.js`、`index.html` | `sketch-projection.spec.js` |
| Offset chain | `offset_chain.js` | `offset-chain.test.js`、`geometry-solver.test.js`、`unified-ui.spec.js` |
| Solver | `constraint_solver.js` | `geometry-solver.test.js`、drag E2E |
| Constraint Dimension | `app.js`、`constraint_solver.js` | `geometry-solver.test.js`、`unified-ui.spec.js` |
| Document／Canvas／UI | `app.js`、`index.html`、`style.css` | `unified-ui.spec.js`、`phase0-characterization.spec.js` |
| Block | `app.js` | `blocks.spec.js` |

## 3. 計算と編集policyの現在の配置

- `geometry_kernel.js`: UI adapterとSolverが共有する副作用のない数学関数。角度範囲・符号付き距離・縮退境界は[幾何計算](../../spec/calculation/幾何計算.md)に従う。
- `app.js`: Arcモデルを補正する`normalizeArcSweep`、ほぼ一周判定を含む`arcEndpointDragValue`、dragのtarget選択・preview・確定、Sketch依存更新、Block配置、Parameter feedbackを扱う。
- `constraint_solver.js`: 数値Jacobian、減衰付き最小二乗法、拘束残差・自由度の解析。
- `hatch_region.js`: 副作用のない交点・AABB候補絞り込み・平面グラフ・half-edge面探索・点包含・境界の保存復元。
- `parameter_engine.js`: 式のparserと依存評価。Geometry再測定を伴う確定処理とは分離している。
- `constraint_codec_registry.js`: 永続Constraint型のclass、保存type、serialize、deserializeは単一registryで対応付ける。参照列挙、表示名、未登録型のユーザー向け拒否policyは永続codecとは別の責務として保持する。

この配置は現在の実装対応であり、将来のモジュール構成を拘束する仕様ではない。


## 4. 検証の共通fixture

`tests/e2e/test-fixture.js`はbrowser実行時エラーを共通収集する。拘束選択経路の特定エラー除外があり、保証の制限は[保証対応](../../spec/verification/保証対応.md#4-保証の限界と未確認事項)を参照する。除外の存在と製品の許容挙動は区別する。

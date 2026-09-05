# 実装対応表

現在の実装配置を調べるための開発資料。正式仕様や将来の分割設計ではない。仕様と保証内容は[仕様の入口](../../spec/README.md)および[検証対応](../../spec/90-実装対応表とテスト.md)を参照する。

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

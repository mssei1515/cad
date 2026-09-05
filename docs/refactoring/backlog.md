# 改善バックログ

この文書は製品仕様ではなく、現行仕様を変えずに行える技術改善候補を記録する。候補の記載は実装方式の採用を意味しない。着手時は[移行計画](./migration-plan.md)と[判断事項](./decisions.md)を照合し、仕様変更が必要ならユーザーへ確認する。

## P0

### app.jsの責務分割

Document adapter、Geometry command、Constraint command、Block service、Parameter service、Appearance resolver、Hatch、Annotation、Reference Image、派生Geometry Instance、Canvas renderer、DOM panel、test fixtureを段階的にmoduleへ分ける。分割中もversion 22 schemaと既存GeometryRefを維持する。

### Loaderの段階化

parse、legacy normalization、ID予約、Block graph検証、Constraint hydration、Annotation hydrationを分離し、旧表示専用fieldを破棄する境界を明示する。

### 参照cleanupの集約

Geometry／Sketch／Block削除時のConstraintとLeader cleanupをGeometryRef indexへ集約する。

## P1

### Renderer policyの共通化

Line、Circle、Arc、Spline、Pointで重複しているAppearance、selection、hover、Constraint Status Viewの優先順位を1つのstyle policyへ集約する。

### UI差分更新

Sketch TreeとPropertiesのDOM全再生成をID keyed差分更新へ置き換え、大規模Documentでのselection latencyを安定させる。

### Test hook分離

E2E fixture生成と検査hookをproduction bundleから分離し、`?test=1`時だけ読み込むmoduleにする。

## P2

### 型とschema検証

version 22 JSON、Appearance、Dimension Appearance、Spline、Hatch、Annotation、Reference Image、派生Geometry Instance、描画順、中心線拘束、チェーンオフセット参照に包括的なschema validationを導入し、不正値の補正と拒否条件を明示する。Parameter名前空間の式・依存検証、Annotation所属・Leader参照検証、Reference Imageの構造・所属検証は現行Loaderで先行して実施する。

### Accessibility

Menu、Sketch Tree、Propertiesのkeyboard navigation、focus順、live error通知を整備する。

# app.jsを起動・接続専用にする継続作業

再開時は先に[リファクタリング方針と再開手順](refactoring-policy-and-resume.md)を読む。本書の古い記録は当時の経過であり、現在の課題は先頭の再開地点とGitの現物を優先する。

開始点はdevelopの`457adea`。承認された最終目標は、`app.js`を数百行程度の生成・接続・起動・終了へ整理すること。部分的な抽出や中間のテスト成功をもって、この目標の完了とはしない。

## 現在の再開地点（2026-10-14）

求解後の操作調整を新しいSolveRefreshCommandへ分離。active Sketch／ParameterStabilization・ConstraintAnalysis／hint／UI／draw／Historyと履歴記録の8入口へ接続する。求解→分析→hint→UI(refreshAnalysis:false)→描画→成功かつ現在restoringでない場合だけhistory確定の順、raw result／solved／analysis参照、default Sketch評価、失敗でも表示する流れと各段階の例外伝播／後続省略を維持。新求解／snapshot／回復規則や状態を持たず、モデル回復は既存ownerへ残す。app.jsは4,869→4,863行（6行減、今回の再開から合計2,871行減）。構文506ファイル・単体1,386件・関連E2E191件が成功（すべてexit 0）。新unit3件でdefault／explicit Sketchとresult参照・進行順、失敗／restoring時のhistory条件と描画後の現在値、各段階例外を確認。元body一致と8portの初期化順・早期command登録をaudit。unified-ui／blocks／file-safety／derived-selection-copy／constraint-fixed／phase0-characterizationの184件（2.4分）とconstraint-drag-regressionsのnative pointer reversals and undo限定7件（25.6秒）を実行。後者の全fileや全E2Eは未実行。index.html、構文／unit実行リスト、file URLのscript期待値を同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-solve-refresh-command-{check,unit,e2e,native-e2e}.log。全体目標は未完了。

### 前回の区切り

モデル寸法の既定値適用を既存DocumentState.normalizeDimensionStateへ集約。明示scopeの拘束を既存target解決／DimensionPlacement正規化の2入口で順に処理し、targetなし短絡・constraint／array参照・dimension代入順と失敗時の部分反映／例外伝播を維持。app adapterはcall時の元modelとplacement receiverを維持し、独自配置／Solver規則を持たない。定義以外の呼出／公開がない旧sketchSolveErrorTitle／dependentErrorSummaryを除去し、結果表示は既存ConstraintFeedbackへ残す。app.jsは4,886→4,869行（17行減、今回の再開から合計2,865行減）。構文504ファイル・単体1,383件・関連E2E186件が成功（すべてexit 0、E2E2.5分）。既存DocumentState unitへ2件追加し、順序／constraintとarray参照・targetなし短絡・raw／undefined寸法、失敗時の部分代入／後続省略を確認。元loop一致とadapter receiver・Document適用の登録順、unused helper全呼出関係をaudit。unified-ui／file-safety／blocks／dimension-prefix／multiple-dimensions／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-dimension-state-normalization-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

矩形選択のlineIntersectsRect／segment交差を既存GeometryBoundsへ集約。bbox短絡・endpoint内判定・4辺とのcross-product／onSegmentと1e-9許容値、inclusive境界／near-corner／退化線・bbox gateを元bodyのまま維持し、既存local Bounds関数を使う。segmentsIntersectはprivateとし、新state／依存を増やさずappは静的入口へ接続。全tracked JS／HTML・仕様とtest hookで定義以外の呼出／公開がないprivate selectCreatedSketchProjectionTargetsを除去し、現在のSelection所有は変更しない。app.jsは4,924→4,886行（38行減、今回の再開から合計2,848行減）。構文504ファイル・単体1,381件・関連E2E188件が成功（すべてexit 0、E2E2.5分）。既存DrawingBounds unitへ2件追加し、inside／横縦交差／辺・角接触／共線／退化線／反転／無変更、near-corner許容値とbbox短絡を確認。元2body一致と既存local依存・unused selector呼出関係をaudit。unified-ui／sketch-projection／blocks／derived-selection-copy／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-rectangle-intersection-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

旧投影target生成の呼出元を調査し、現在はcompatibility／source-editing fixtureだけで使われると確認したため、製品編集ownerではなく既存SketchProjectionTestDriver.createLegacyTargetConstructionへ集約。test query有効時だけ5個のGeometryCreation入口へ接続する。Point／Line／Circle／Arc／Splineの座標・target Sketch／point kind・construction／closed・radius／angle、point生成→geometry生成順、独立参照とsource無変更、例外時の既存部分割当を維持し、ID／モデル編集の所有は動かさない。app.jsは4,948→4,924行（24行減、今回の再開から合計2,810行減）。構文504ファイル・単体1,379件・関連E2E188件が成功（すべてexit 0、E2E2.5分）。既存SketchProjectionTestDriver unitへ2件追加し、全種類の作成順／point・geometry参照・Sketch／flags／source無変更、unsupported kind無割当とradius失敗時の伝播／部分割当を確認。元2body一致と5port／全呼出元・test登録時点をaudit。sketch-projection／unified-ui／blocks／derived-selection-copy／phase0-characterizationを実行。新script／unitファイルは追加していない。製品投影commandや保存形式の新しい動作を追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-projection-target-construction-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

投影sourceのcoverageと候補entry変換を既存SketchProjectionQueries.createSourcesへ分離。現在model／active Sketch、Geometry ref・種類・key／同一性、既存投影拘束query／operational／Sketch・参照元／可視性、operand変換の13portへ接続。Instance優先→従来拘束、Point constraintのObject同一性／string ID、他Geometryのkind／source key・target Sketch・operational条件、候補guard順を維持する。currentScope adapterは元model aliasをcall時に読み、既存拘束queryのscope／cacheを変更しない。新cache／重複規則やモデル／session更新を持たず、早期command callback用hoisted入口を維持する。app.jsは4,969→4,948行（21行減、今回の再開から合計2,786行減）。構文504ファイル・単体1,377件・関連E2E204件が成功（すべてexit 0、E2E2.7分）。新source unit4件でInstance優先／現在model・target／null、従来Point identity／IDとkind／operational／target、primitive kind／key、候補metadata／参照元／visibilityとoperand変換を確認。元4body一致と13portの初期化順をauditし、operand helper生成後へ配置。sketch-projection／unified-ui／blocks／derived-selection-copy／hatching／phase0-characterizationを実行。新production scriptはなく、構文／unitリストへ新unitを同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-projection-source-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch関係に応じたconstraintStatusColor／strokeWidth／alpha／描画順を既存GeometryPresentation.createSketchStyleへ分離。solve error／Sketch ID・関係／拘束status／可視性／activeの6照会portに接続する。選択→Hover→solve error→非active→statusの色優先、各関係の線幅／alpha、visible filter→stable inactive／active順と元item参照・入力array無変更を維持。表示色定義もGeometryPresentationへ集約し、寸法が共有する非active色を同モジュールの定義から参照する。Solver／Sketch／Selectionを変更せず、appは既存callback用hoisted入口と接続を持つ。app.jsは4,994→4,969行（25行減、今回の再開から合計2,765行減）。構文503ファイル・単体1,373件・関連E2E180件が成功（すべてexit 0、E2E2.4分）。既存GeometryPresentation unitへ3件追加し、色優先と照会短絡／status fallback、各関係の幅／alphaと最新値、visibility／active変更とstable順／参照／array無変更を確認。元4bodyと色定義の一致・6portの初期化順をaudit。unified-ui／blocks／view-visibility／sketch-permissions／selection-zoom-shadow／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-sketch-display-policy-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

拘束operand／command対象／pending referenceの表示強調照会を既存GeometryPresentation.createCommandTargetsへ分離。panel snapshot／現在mode／Instance・Sketch投影・pattern command、Geometry ref／同一性、現在operand／拘束command／pendingと参照Sketch照会の15portに接続。panel最優先とfalse短絡、Instance／投影／pattern→arc endpoint／operand、command referenceTarget→pendingの優先・kind／Object同一性、reference hover短絡を維持する。状態複製・Selection／session更新・Canvas命令を持たず、appのhoisted入口は先に登録されたpaint callbackの参照時点を保持する。app.jsは5,010→4,994行（16行減、今回の再開から合計2,740行減）。構文503ファイル・単体1,370件・関連E2E188件が成功（すべてexit 0、E2E2.5分）。既存GeometryPresentation unitへ3件追加し、panel優先／false短絡と現在Instance／投影／pattern、operand同一性とarc endpoint優先、reference hover・command／pending優先と各kind・nullを確認。元3body一致と15portの初期化順をaudit。unified-ui／blocks／sketch-projection／derived-selection-copy／constraint-fixed／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-command-target-presentation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvas表示更新の調整とpanel選択対象の表示snapshotを新しいsrc/ui/canvas_refresh.jsのCanvasRefresh.createへ分離。PNG command／pending・mode照会、CommandPanel／DerivedPanel、Annotation入力同期、profiling／Geometry read cache／Canvas描画の10portに接続する。取消→panel→入力→snapshot→profile／cache→描画の順、PNG busy／session／mode短絡とreceiver、代入前の失敗時は旧snapshot保持、描画失敗の既存例外伝播とprofile／cacheのcleanup範囲を維持。commandPanelSelectedItemをprivate状態へ移し、Geometry強調はgetterへ接続。モデル／session／commandは複製しない。app.jsは5,017→5,010行（7行減、今回の再開から合計2,724行減）。構文503ファイル・単体1,367件・関連E2E192件が成功（すべてexit 0、E2E2.7分）。新unit3件で現在panel／入力／snapshot／profiling／cache順、PNG busy／終了判定とmode短絡、snapshot代入前／後の例外範囲・cleanupを検証。元body一致と10portの初期化順をauditし、後に生成されるAnnotation入力／panelはcallbackで参照。unified-ui／png-export／authoring-performance／blocks／unified-annotations／phase0-characterizationを実行。index.html、構文／unit実行リスト、file URLのscript期待値を同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-canvas-refresh-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Block／Instance配置とOffsetのpreview情報取得・描画接続を既存PlacementPreviewRenderer.createLayer／OffsetPreviewRenderer.createLayerへ分離。配置はrenderer／mode・pointer read／Block・Instance command／Block projectionの6port、Offsetはrenderer／mode・pointer read／commandの4portを持つ。Blockのmode→definition→pointer→preview短絡とbundle生成・描画、Instanceのmodeに依存しないpreview、Offsetのmode短絡後の現在plan取得とreceiver・元参照／null／順序を維持する。モデル／session更新を持たず、appは通常描画と生成後の診断APIを直接接続して中継を除去。app.jsは5,022→5,017行（5行減、今回の再開から合計2,717行減）。構文501ファイル・単体1,364件・関連E2E189件が成功（すべてexit 0、E2E2.5分）。既存PlacementPreview／Offset unitへ3件追加し、全guard／projection／painter順・参照、modeに依存しないInstance、Offset plan短絡と現在pointer／null・receiverを確認。元3body一致と6／4portの初期化順・診断登録順をaudit。配置layerはrenderer生成後に置く。unified-ui／blocks／derived-selection-copy／hatching／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-placement-offset-preview-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

作図previewのmode判定と現在command情報取得・描画接続を既存AuthoringPreviewRenderer.createLayerへ分離。renderer／mode・pointer・trimのread入口、Line／Rectangle／Slot／Circular／Spline／Centerlineの既存一時値、Centerline投影／Canvas寸法の12portで接続する。Line→Centerline→Rectangle→Slot→Circle→Arc→ThreePointArc→Splineの判定／描画順、現在値／元参照、support短絡とpointer不在時の投影省略を維持し、TrimはBlock／Instance／Offsetの後の入口へ残す。モデル／session変更を持たない。診断登録はfactory生成後と確認し、新入口へ直接接続して旧preview guard／中継関数を除去。app.jsは5,038→5,022行（16行減、今回の再開から合計2,712行減）。構文501ファイル・単体1,361件・関連E2E153件が成功（すべてexit 0、E2E2.0分）。既存AuthoringPreview unitへ2件追加し、各modeと現在command参照／painter receiver、描画中mode変化の判定順、Centerline support／pointer／投影とCanvas sizeの短絡／順序を確認。全9body一致と12portの初期化順・診断登録順をaudit。unified-ui／spline／slot-dimension／tool-flyouts／hatching／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-authoring-preview-layer-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

直線／角度寸法の描画plan組立てを既存DimensionPresentation.createPainterへ分離。既存Layout／Metrics／Renderer、dimensionLayout入口、外観／現在Sketch／shaft係数の7portに接続する。target／dimensionとlayout短絡、外観既定値と評価順、plan／円弧延長／angle span・外側terminatorとshaft変換／radius下限、rendererへ渡す参照／flags・receiver／呼出順と元の戻り値を維持する。appは生成接続とhoisted入口へ縮小し、不要になった5個のLayout／Metrics関数参照を除去。app.jsは5,052→5,038行（14行減、今回の再開から合計2,696行減）。構文501ファイル・単体1,359件・関連E2E154件が成功（すべてexit 0、E2E2.1分）。既存DimensionPresentation unitへ3件追加し、default Sketch／short circuitと評価順、直線payload／参照／flags、負の角度span・shaft変換／radius下限／inside短絡を確認。元body一致と7portの初期化順をaudit。unified-ui／dimension-prefix／annotation-display-size／multiple-dimensions／slot-dimension／png-export／phase0-characterizationを実行。関数参照整理後も構文／全unitを再実行し、E2Eは整理済みコードで実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-dimension-painter-{check-final,unit-final,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

選択矩形の表示を既存InteractionOverlayRenderer.drawSelectionRectへ分離。appはSelectionRectangle.previewの取得と描画呼出だけを持ち、rendererはpreview不在の短絡・crossing／enclosingの色・現在倍率に応じた線幅／破線・fill→strokeを扱う。既存withCanvasStateを接続し、session／Selection変更・pointer lifecycleへ依存しない。元body一致とwithCanvasStateの初期化位置・preview参照時点をaudit。app.jsは5,064→5,052行（12行減、今回の再開から合計2,682行減）。構文501ファイル・単体1,356件・関連E2E188件が成功（すべてexit 0、E2E2.5分）。既存overlay unitへ1件追加し、preview不在短絡・crossing／enclosingと倍率・描画順／Canvas隔離入口・preview無変更を確認。unified-ui／blocks／sketch-projection／png-export／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-selection-overlay-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Construction線分の表示延長を既存GeometryPresentation.createLineDisplayへ、描画対象のfilter／現在一覧／Sketch順とpainter呼出をGeometryRenderer.createLayerへ分離。表示線分3port、描画対象7portで既存viewport／外観／現在Geometry一覧とrendererへ接続する。短小線・非正／非有限延長量・overhang無効時の元point参照、倍率、explicit外観、空array／null／undefinedとoptions・painter receiver／元の戻り値を維持し、モデル端点は変更しない。renderer生成前のcallback登録に必要なhoisted入口をappへ残す。app.jsは5,088→5,064行（24行減、今回の再開から合計2,670行減）。構文501ファイル・単体1,355件・関連E2E198件が成功（すべてexit 0、E2E2.6分）。既存2unitへ3件追加し、live倍率／延長と無変更・参照、degenerate／非有限短絡、explicit／既定／空itemsと現在一覧・順序／options／receiverを確認。元body一致と3／7portの初期化順をaudit。unified-ui／hatching／selection-zoom-shadow／spline／blocks／png-export／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-geometry-display-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Annotationの実効外観を既存GeometryAppearanceQuery.createAnnotationへ、表示色をAnnotationRenderer.createColorへ、描画対象巡回をcreateLayerへ分離。外観照会2port・色決定5port・巡回5portに限定し、現在Document／Sketch一覧、Block definition／localElement、継承／precision／affix・順序付きBlock override、PNG→選択／inspection→Hover→通常色、可視性短絡と元の対象参照／描画順を維持する。状態複製・保存styleへの代入・求解／履歴を持たない。appのhoisted入口は先に登録されたcallbackの参照時点を維持。app.jsは5,113→5,088行（25行減、今回の再開から合計2,646行減）。構文501ファイル・単体1,352件・関連E2E216件が成功（すべてexit 0、E2E3.1分）。既存2unitへ4件追加し、plain Textの短絡とlive Document／Sketch、投影local参照とoverride／無変更、explicit styleと色優先／PNG短絡、live対象／visibility／描画順と参照を検証。元body一致と全portの初期化順をaudit。unified-ui／unified-annotations／leader-appearance／annotation-display-size／blocks／png-export／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-annotation-presentation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

通常寸法の表示情報取得と矩形選択用boundsを新しいsrc/rendering/dimension_presentation.jsへ分離。createLayerは19portで現在表示scope・可視性／外観／配置／ラベル、Selectionとhover／drag／pending／PNG／statusのread入口と既存rendererへ接続し、createSelectionBoundsは12portで現在配置・Text metricsから回転／複数行／式記号を含むboundsを返す。元body・短絡／順序・target／dimension参照とsave／restore・例外伝播を維持し、採否とSelection変更は既存RectangleSelectionQuery／CanvasSelectionに残す。app.jsは5,131→5,113行（18行減、今回の再開から合計2,621行減）。構文501ファイル・単体1,348件・関連E2E181件が成功（すべてexit 0、E2E2.5分）。新しいunit3件で回転複数行ラベルとshaft bounds、visibility／target／layout短絡とdefault、live scope／interaction／PNGの情報と順序を確認。元body一致と各port初期化順をauditし、後に生成されるdimensionDragはgetterで描画時に読む。unified-ui／dimension-prefix／png-export／blocks／annotation-display-size／phase0-characterizationを実行。index.html、構文／unit実行リスト、file URLのscript期待値を同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-dimension-presentation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法previewの表示情報構成と描画呼出を新しいsrc/rendering/dimension_preview.jsのDimensionPreview.createへ分離。現在pendingのread-only getter、既存配置／式評価／表示形式／角度照会と寸法／fillet描画の13portに接続する。fillet仮半径、距離の配置／入力、axis target copy、angle／interval、invalid／selecting／hidden、元の評価catchと短絡／順序・dimension／target参照を維持。入力確定・求解・履歴・session変更は既存commandに残す。app.jsは5,185→5,131行（54行減、今回の再開から合計2,603行減）。構文499ファイル・単体1,345件・関連E2E171件が成功（すべてexit 0、E2E2.3分）。新しいunit3件で現在pending／fillet失敗短絡、半径anchorと参照、負のinterval／境界／評価失敗、既存dimension同一性／axis copyとdefault／angle／label順を確認。元bodyとの一致と13portの初期化順をaudit。unified-ui／dimension-prefix／blocks／annotation-display-size／phase0-characterizationを実行。index.html、構文／unit実行リスト、file URLのscript読込期待値を同期。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-dimension-preview-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasのframe準備と描画段階の進行を既存CanvasSurface.createFrameRendererへ分離。bitmap準備→DPR／PNG transform→viewport→共通content→出力／対話stage→stroke reset／restoreの順序とPNG短絡を維持する。10個の限定portに既存surface・現在frame・zoom／描画計測・三つの描画入口を接続し、read cache／入力同期／profilingと各preview内容は従来の所有者へ残す。hoisted drawCanvas入口とcallback参照時点、例外伝播と既存の復元範囲を維持。app.jsは5,202→5,185行（17行減、今回の再開から合計2,549行減）。構文497ファイル・単体1,342件・関連E2E199件が成功（すべてexit 0、E2E2.6分）。既存CanvasSurface unitへ2件追加し、DPR／viewportの最新値、normal／PNG段階とtransform／stroke順、stage失敗時の例外／restore挙動を検証。対話stage本体の一致と10portの初期化順を確認。png-export／unified-ui／hatching／reference-images／blocks／annotation-display-size／phase0-characterizationを実行。新script／unitファイルは追加していない。専用port8784サーバーは検証後に実体を確認して終了。ログはcad-canvas-frame-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

PNG一時描画frameを既存CanvasExport.createRenderer、復元用previousModeをPngExportCommand.createModeSessionのprivate状態へ移し、appのpngRender／pngPreviousModeを削除。既存region／ratio／worldBoundsの変換とcache内draw、frame解除→bitmap同期→通常draw、mode退避→PNG mode／pending、PNG pendingだけclear→現在modeがPNGなら復元→退避解除を維持する。各renderer／描画はframe getterを照会し、appは直接stateへ代入しない。captureの既存try／finallyと例外伝播、foreign pending／mode・二回終了時の挙動を維持。app.jsは5,210→5,202行（8行減、今回の再開から合計2,532行減）。構文497ファイル・単体1,340件・関連E2E176件が成功（すべてexit 0、E2E2.5分）。既存PNG unitへ2件追加し、実captureとrendererを接続して成功／render・copy・sync失敗時のframe解除／bitmap復元／display順、mode復元／pending receiver・foreign状態保持と退避解除を確認。png-export／unified-ui／hatching／reference-images／unified-annotations／leader-appearance／annotation-display-sizeを実行。新script／unitファイルは追加していない。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-png-owned-state-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Viewport／モデル・履歴・codecや新しい復元規則は追加していない。全体目標は未完了。

### 前回の区切り

Document共通Terminator／Leader既定値の表示／入力を既存DocumentAppearanceSettings.createSharedへ、値反映をDocumentDefaultAppearanceCommand.createSharedへ分離。Terminatorの部分normalize→同じobjectへassign、Leaderの現在値／viewportScale／Document実効外観→既存applyと、反映→共有再表示→履歴→UI→drawを維持する。UIはkey検査・checkbox反転／生文字列・palette対象・両section再表示を持ち、Document変更はcommandへ委譲。app.jsは5,233→5,210行（23行減、今回の再開から合計2,524行減）。構文497ファイル・単体1,338件・関連E2E169件が成功（すべてexit 0、E2E2.3分）。既存unitへ3件追加し、Terminator参照／無関係property保持、Leaderの最新倍率／実効外観と再表示／履歴／UI／draw順、key短絡・checkbox反転／raw値・rows receiver／palette・元の必須field失敗を確認。unified-ui／leader-appearance／unified-annotations／annotation-display-size／dimension-prefix／phase0-characterizationを実行。新script／unitファイルは追加していない。設定clickはGeometry→Dimension→Shared準備→dialog表示の接続へ縮小。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-document-shared-appearance-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Document／外観規則・snapshot／履歴・DOM状態は追加していない。全体目標は未完了。

### 前回の区切り

Document既定寸法外観の表示／入力を既存DocumentAppearanceSettings.createDimensionへ、値反映をDocumentDefaultAppearanceCommand.createDimensionへ分離。現在寸法／Terminator合成・normalize／rows→affix準備→localize→angle表示、key検査・prefix／suffixの生文字列／他値trim・input履歴なし／change履歴ありとangle→UIを維持する。値反映は既存apply（継承なし）→dimensionDefaults→置換→必要な履歴→draw。既定値getter／setterとnormalize adapterはDocument／Appearance所有者へ接続する。app.jsは5,253→5,233行（20行減、今回の再開から合計2,501行減）。構文497ファイル・単体1,335件・関連E2E153件が成功（すべてexit 0、E2E2.1分）。既存unitへ3件追加し、現在の既定値／反映・preview／確定履歴、複数行affixと空白保持・trim・input対象限定／change順、無効keyの値照会省略と表示通知／palette、要素不在を確認。unified-ui／dimension-prefix／annotation-display-size／leader-appearance／view-visibility／phase0-characterizationを実行。新script／unitファイルは追加していない。Terminator／Leaderとdialog準備はappに残り次の単位とする。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-document-dimension-appearance-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自正規化／履歴／Document状態は追加していない。全体目標は未完了。

### 前回の区切り

Documentの通常／Construction Geometry既定外観の表示／入力準備をsrc/ui/document_appearance_settings.jsのDocumentAppearanceSettings.createGeometryへ、値反映をsrc/commands/document_default_appearance_command.jsのDocumentDefaultAppearanceCommand.createGeometryへ分離。UIの現在値照会／normalize・effective合成／rows／localize・key検査／trim／palette対象と、既存apply→normalize（partial:false）→既定値置換→履歴→UI→drawを維持する。Document状態はreadDefault／writeDefaultの限定adapterへ接続し、UIはモデル変更／履歴を持たない。app.jsは5,283→5,253行（30行減、今回の再開から合計2,481行減）。構文497ファイル・単体1,332件・関連E2E200件が成功（すべてexit 0、E2E2.7分）。新単体4件で現在の同一参照／正規化後の置換・更新順、normalize例外時の既存非rollback／通知なし、継承合成／key検査／trim／palette対象／最新既定値と要素不在の短絡を確認。unified-ui／leader-appearance／view-visibility／blocks／hatching／phase0-characterizationを実行。新script二つはindex／構文・単体一覧／読込期待値を同期。寸法／Terminator／Leader・dialog準備はappに残り次の単位とする。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-document-geometry-appearance-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Document／外観型・正規化ルール／snapshot／履歴は追加していない。全体目標は未完了。

### 前回の区切り

作図／派生／Block／Hatch等21個のToolbar入力接続を既存ToolbarView.createBindingへ分離。各既存commandへ同じ引数／生handlerで委譲し、必須／任意要素と任意要素不在のhandler照会短絡、DOM receiverとLifecycleの操作時method照会を保持する。bindingは二重登録防止・登録listener解除／再bindだけを所有し、状態表示createとは独立した依存で生成する。開始／取消／guardと作図状態は既存所有者へ留める。app.jsは5,303→5,283行（20行減、今回の再開から合計2,451行減）。構文494ファイル・単体1,328件・関連E2E215件が成功（すべてexit 0、E2E3.4分）。既存Toolbar unitへ2件追加し、live Lifecycle／raw handler／receiver、登録寿命・二重登録／解除／再bind、任意tool不在でprovider照会しない短絡と必須controlを確認。unified-ui／adversarial-authoring-performance／toolbar-layout／tool-flyouts／hatching／sketch-projection／blocks／phase0-characterizationを実行し、作図性能・各開始入口・tool表示と周辺操作を確認。新script／unitファイルは追加していない。仕様の表示担当はcreateへ限定し、binding担当を追記。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-toolbar-input-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自mode／作図状態・開始／取消／guardルール・モデル／Solver／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Document入出力のUI接続をsrc/ui/document_file_controls.jsのDocumentFileControls.createDocument／createDxfへ分離。Document保存／別名保存／読込・input／linkとDXFの依存／登録寿命を別factoryにし、既存commandの非同期void委譲・input handler／receiver・必須／任意要素、DXFのflush→busy／編集可否短絡→hint／picker、File取得→input解除→同じFile参照でimportの順を保持する。任意input不在でhandler照会も省き、Fileなしのundefinedを維持。各bindingは二重登録防止・登録listener解除／再bindだけを所有する。PNG／Reference Image／Sketchとstartup／beforeunloadは既存経路へ留める。app.jsは5,314→5,303行（11行減、今回の再開から合計2,431行減）。構文494ファイル・単体1,326件・関連E2E156件が成功（すべてexit 0、E2E2.0分）。新単体3件でDocument非同期委譲／元handler／receiver／登録寿命、任意要素／handler照会短絡と必須要素、DXFのlive busy／編集可否／flush／input解除・File／undefinedを確認。unified-ui／file-safety／document-bookmarks／dxf-import／png-export／phase0-characterizationを実行し、native保存／再読込・link・importと周辺操作を確認。新scriptはindex／構文・単体一覧／読込期待値を同期。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-document-file-controls-{check,unit,e2e}.log。全E2Eはこの単位では未実行。ファイルsession・保存形式／互換性・リンク処理・import／モデル／履歴は新設していない。全体目標は未完了。

### 前回の区切り

拘束／固定入力の判断をsrc/commands/constraint_control_command.jsのConstraintControlCommandへ、拘束／menu／Fix buttonのイベント接続を既存ConstraintControlsView.createBindingへ分離。再click取消／Annotationの経路別優先順、Symmetry／距離／通常拘束・固定の分岐と既存pending／command／UI／拘束追加順を維持する。menuは既存button click→details終了、datasetは操作時照会とし、bindingだけが二重登録防止・listener解除／再bindを所有する。状態表示createとは独立した依存で生成。元の三つのhandler本体を維持。app.jsは5,349→5,314行（35行減、今回の再開から合計2,420行減）。構文492ファイル・単体1,323件・関連E2E237件が成功（すべてexit 0、E2E3.3分）。新単体4件で経路別取消／Annotation優先、Symmetry／距離、通常拘束更新順、固定のmode／Selection分岐を確認。既存View unitへ1件追加し、dataset更新・menu経路／閉じ順・未知menu・二重登録／解除／再bindを確認。unified-ui／annotation-anchors／blocks／fixed-command／block-geometry-fixed／sketch-permissions／phase0-characterizationを実行。新scriptはindex／構文・単体一覧／読込期待値を同期。仕様の状態表示担当はcreateへ限定して入力担当を追記。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-constraint-controls-input-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自mode／pending／Selection／拘束・求解／履歴は追加していない。全体目標は未完了。

### 前回の区切り

固定切替のoperand／Selection経路をsrc/commands/fixed_toggle_command.jsのFixedToggleCommand.createOperand／createSelectionへ分離。現在scope・許容誤差・型／参照照合・batch／guardと既存追加／削除・snapshot／restore・依存求解／解析・UI／履歴へ接続し、Instance／端点／batchの優先順と同一参照・enabled／return・失敗復元／成功更新順を維持する。元の二つの本体との一致を依存port置換後に確認。早いConstraintTargetCommand callback登録はappの薄い委譲関数で保持。app.jsは5,429→5,349行（80行減、今回の再開から合計2,385行減）。構文490ファイル・単体1,318件・関連E2E201件が成功（すべてexit 0、E2E2.6分）。新単体5件で現在scope／enabledとoperand return、同一Instance投影の固定・混在時の拒否、端点unfixの既存return／commit失敗復元、主／依存／誤差失敗でのPoint flag／拘束復元と履歴なし、batch解除で無関係拘束／配列参照保持と成功時の履歴順を確認。unified-ui／blocks／fixed-command／block-geometry-fixed／sketch-permissions／sketch-projection／phase0-characterizationを実行。新scriptはindex／構文・単体一覧／読込期待値を同期。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-fixed-toggle-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自モデル／Selection・拘束型／Solver／snapshot形式／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Canvas context menu開始の進行を既存CanvasContextMenu.createEntryへ、候補確定の進行をCanvasContextTarget.createCandidateActionへ分離。menu／modeの短絡→native event抑制→menu終了→pointer更新→command／候補照会→単一対象選択／UI→draw→項目構成／session開始と、拘束command時のhit→operand／通常時の対象置換→UI→drawを維持する。pointerはappのsetterへ接続し、同一参照・原点fallbackと元の二つの本体との一致を確認。早いcallback登録は薄いapp委譲関数で維持。app.jsは5,448→5,429行（19行減、今回の再開から合計2,305行減）。構文488ファイル・単体1,313件・関連E2E178件が成功（最終すべてexit 0、E2E2.3分）。既存unitへ4件追加し、menu不在／mode拒否、単一対象／pointer／UI／menu順、通常／拘束command／重複候補と候補確定時の最新command／operand／Selection分岐を確認。初回E2EはcloseAppMenusの早いconst参照による起動ReferenceErrorを確認して中断（exit 1）。runner終了後に操作時callbackへ修正し、他portの初期化位置を監査、構文／全単体／同じ5ファイルE2Eを再実行して成功。再開手順にもportの参照時点監査を明記。unified-ui／blocks／fixed-command／sketch-permissions／phase0-characterizationを実行。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-context-entry-{check,unit,e2e,check-final,unit-final,e2e-final}.log。全E2Eはこの単位では未実行。独自表示session／Selection／command状態は追加していない。全体目標は未完了。

### 前回の区切り

Canvas context actionの編集guard・既存操作への振分けと操作後の更新をsrc/commands/canvas_context_actions.jsのCanvasContextActionsへ分離。Selection／対象Sketchの編集guard→対象またはSelection／active Sketchの構造guardという順・短絡と、既存command／履歴／clipboard／button・Properties／Block／寸法／Sketch／Hatch／Drawing Order／Spline／fitの入口を維持する。寸法整列成功時のUI→draw→履歴→hint、fit結果別hint→draw・hit／target／pointer／Spline参照・method receiver・void paste／未定義returnと例外伝播を保持し、元の処理本体との一致を確認。menuが早く生成される初期化順はappの薄い委譲関数で維持。app.jsは5,482→5,448行（34行減、今回の再開から合計2,286行減）。構文488ファイル・単体1,309件・関連E2E178件が成功（すべてexit 0、E2E2.3分）。新単体4件で編集guard失敗／構造guard先のfallback、寸法整列成功／失敗時の更新順、非編集actionのguard非依存／receiver／returnとfit結果、hit／Spline／pointer参照を確認。unified-ui／blocks／fixed-command／sketch-permissions／phase0-characterizationを実行し、menu・Fix／Undo・権限／Block／基本操作とfile URL読込を確認した。新scriptはindex／構文・単体一覧／読込期待値を同期。仕様の旧action担当も更新。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-context-actions-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Selection／command／model・履歴／求解規則・menu sessionは追加していない。全体目標は未完了。

### 前回の区切り

Canvas context menu項目構成を既存CanvasContextPresentation.createItemsへ分離。候補ラベルのcreateとは独立したfactory／依存で生成し、既存状態／可否・Undo／Redo button表示とmode getterからcommand／空白／対象別のaction ID・ラベル／shortcut・disabled／danger・group／separatorを構成する。command／空白と編集中fit pointの短絡、Block error・生成可否の短絡と照会順を保持し、元の処理本体との一致をmode getter置換後に確認。action実行・履歴／状態更新・menu session／DOM描画は持たない。app.jsは5,556→5,482行（74行減、今回の再開から合計2,252行減）。構文486ファイル・単体1,305件・関連E2E157件が成功（すべてexit 0、E2E2.1分）。新単体4件でcommandのtarget非依存／projection count更新、空白の権限／button不在／bounds照会順、編集中fit pointのFix／clipboard抑制と最小点数、Block error短絡／回転label更新・Drawing Order groupを確認。unified-ui／blocks／fixed-command／sketch-permissionsを実行し、menu／重複候補・Fix／Undo・権限／Blockとfile URL読込を確認した。既存scriptを拡張し、追加unitは構文／単体一覧へ同期。仕様の旧担当表記も現在のcreate／createItemsへ更新。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-context-menu-items-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvas context targetの選択照会／選択更新・拘束hit構成とFix状態照会をsrc/editing/canvas_context_target.jsのCanvasContextTarget.createSelection／createFixObservationへ分離。既存CanvasSelection・端点照合／計算・clearとbatch／固定拘束／Geometry照会へ四port／六portで接続し、同一参照・既選択集合保持／明示置換・既存hit優先／fallback・batch優先・null／booleanと短絡順を保持する。元の四つの処理本体との一致を確認。候補収集／順位・menu表示は既存所有者、項目構成／action調整はappへ留める。app.jsは5,612→5,556行（56行減、今回の再開から合計2,178行減）。構文485ファイル・単体1,301件・関連E2E157件が成功（すべてexit 0、E2E2.1分）。新単体3件で実際のCanvasSelectionを使い、集合保持／置換・IDが同じ別参照・Arc端点／複数寸法・hit参照／計算fallback・live batch／固定拘束・Fix可否の非破壊観測を確認。unified-ui／blocks／fixed-command／sketch-permissionsを実行し、context menu／重複候補選択・Fix／Undo・権限／Blockとfile URL読込を確認した。新scriptはindex／構文・単体一覧／読込期待値を同期。専用port8784のサーバーは検証後に実体を確認して終了。ログはcad-context-target-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Selection／拘束・履歴・DOM／描画・menu表示／action実行は追加していない。全体目標は未完了。

### 前回の区切り

共通Selection ID一覧をCanvasSelectionTestDriver.createIdObservationへ、active履歴／Block編集・Undo／Redo／Construction表示の観測をDocumentTestDriver.createHistoryObservationへ、responsive drag準備をGeometryDragTestDriver.createResponsiveFixtureへ分離。既存所有者の最新状態・ID配列の順とコピー・DOM要素なしのundefined／boolean、sample→fit→draw→履歴reset→保存値取得の順を維持し、元の三つの処理本体との一致を確認。公開APIと各test driverへの共通照会入口を維持する。app.jsは5,635→5,612行（23行減、今回の再開から合計2,122行減）。構文483ファイル・単体1,298件・関連E2E262件が成功（すべてexit 0、13ファイル255件5.2分＋constraint-drag-regressions内のnative pointer／Undo7件25.9秒）。最初のE2Eは共有HTTPサーバー停止によるERR_CONNECTION_REFUSEDで中断（exit 1）し、製品／テストを変更せず専用port 8784で全13ファイルを再実行して成功。専用サーバーは実体を確認して検証後に終了。ログはcad-common-test-observations-{check,unit,e2e,e2e-final,native-e2e}.log。新規テストはなく、既存Geometry／Block編集・Selection・Undo／Redo／履歴・表示とnative pointerの連携を確認した。constraint-drag-regressions全体と全E2Eはこの単位では未実行。独自履歴／Selection・モデル／viewport・Geometry生成／求解規則は追加していない。全体目標は未完了。

### 前回の区切り

Document名／file session状態をDocumentTestDriver.createNameObservation／createFileObservationへ、表示設定をCanvasTestDriver.createViewObservationへ、Sketch可視性をSketchTreeTestDriver.createVisibilityObservationへ、themeをPropertiesTestDriver.createThemeObservationへ分離。既存Document名getter／有効名／保存値・title／handle、viewState／拘束表示状態、Sketch／保存値／effective可視性／Tree button、設定／保存theme・既定Geometry色getter／Canvas色変換・contrastへ役割別に接続する。呼出し時の最新値・objectコピー・null／boolean／fallbackと照会順を保持し、元の五つの本体との一致をgetter置換後に再確認。app.jsは5,667→5,635行（32行減、今回の再開から合計2,099行減）。構文483ファイル・単体1,298件・関連E2E129件が成功（すべてexit 0、E2E14.5分）。全利用箇所のfile-safety／unified-ui／constraint-drag-regressionsを実行。新規テストはなく、既存Document保存／読込・file handle／名前・可視性／テーマ／表示と長時間ドラッグ回帰を確認した。ログはcad-runtime-state-observations-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Document／file session・可視性／表示／theme状態・保存規則／履歴は追加していない。全体目標は未完了。

### 前回の区切り

寸法コマンド中のLine drag・クリック配置・線／円と半径差の準備／状態観測と半径差求解確認を既存DimensionTestDriverの七つの入口へ分離。既存reset／Geometry・寸法生成／Selection／command・fit／UI／draw／座標変換、姿勢変更→snapshot／依存求解→解析→UI→draw、呼出し時のscope／拘束・pending／operands・input／drag・計測／保存へ役割別に接続する。観測側には生成／reset依存を渡さず、固定入力・同一参照・null／fallback・pointerコピーと呼出し順を保持する。元の七つの処理本体との一致を依存port置換後に確認。app.jsは5,816→5,667行（149行減、今回の再開から合計2,067行減）。構文483ファイル・単体1,298件・関連E2E144件が成功（すべてexit 0、E2E1.9分）。全利用箇所のdimension-prefix／blocks／unified-uiを実行。新規テストはなく、既存寸法配置／command drag・線／円と半径差・求解回復と周辺操作を確認した。ログはcad-dimension-command-fixtures-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自寸法／Selection・pending／drag・求解／layout・scope／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Block操作位置照会をBlockTestDriver.createInteractionObservationへ、寸法位置照会・式編集開始・Properties選択／Selection観測をDimensionTestDriver.createPositionObservation／createExpressionAction／createSelectionDriverへ分離。既存Instance／投影・Canvas変換・現在scopeの拘束／target／layout・式編集／Selection・UI→drawへ役割別に接続し、同一参照・null／false・fallbackと呼出し順を保持する。寸法位置照会は別test APIのthis依存を既存CanvasTestDriver.clientPositionの明示した入口へ置換。元の五つの処理本体との一致を依存port置換後に確認。app.jsは5,846→5,816行（30行減、今回の再開から合計1,918行減）。構文483ファイル・単体1,298件・関連E2E213件が成功（すべてexit 0、E2E3.8分）。全利用箇所のblocks／unified-ui／annotation-display-size／adversarial-authoring-performance／bolt-diameter／dimension-prefix／free-text-input-drag／multiple-dimensions／slot-dimensionを実行。新規テストはなく、既存Block操作・寸法位置／式入力／Properties／複数選択と周辺操作を確認した。ログはcad-block-dimension-interaction-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自投影／layout・式編集／Selection・scope／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Block Definition更新・read-only寸法・外部拘束のfixtureを既存BlockTestDriver.createDefinitionUpdateFixture／createReadOnlyDimensionFixture／createExternalConstraintFixtureへ分離。呼出し時のDefinition／scope、既存下書き編集／確定・投影・寸法生成／追加・拘束生成／求解・cache更新へ役割別に接続し、固定入力・同一Definition／投影参照・nullと操作／観測順を保持する。元の三つの処理本体との一致を依存port置換後に確認。app.jsは5,890→5,846行（44行減、今回の再開から合計1,888行減）。構文483ファイル・単体1,298件・関連E2E39件が成功（すべてexit 0、E2E32.0秒）。全利用箇所のblocksを実行。新規テストはなく、既存Definition編集／全Instance投影更新・固有寸法・外部拘束によるInstance移動と周辺操作を確認した。ログはcad-block-definition-fixtures-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自下書き／Definition・投影／寸法／求解・cache／保存規則／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sidebar highlight ID／hover Geometry keyの観測を既存PropertiesTestDriver.createHighlightObservation／createHoverKeyObservationへ分離。現在SelectionのGeometry／端点・中心、既存effective拘束／highlight nodes・selectionHighlight・Canvas dimension Hover、全Geometry／Sidebar Hover判定／keyへ役割別に接続する。重複除外・優先順・null除外／sortと照会順を維持し、元の二つの処理本体との一致を確認。app.jsは5,925→5,890行（35行減、今回の再開から合計1,844行減）。構文483ファイル・単体1,298件・関連E2E142件が成功（すべてexit 0、E2E1.9分）。全利用箇所のblocks／unified-uiを実行。新規テストはなく、既存Block／Sidebar／Canvasの選択・拘束highlight／hoverの連携と周辺操作を確認した。ログはcad-sidebar-highlight-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Selection／highlight・所属／編集先・hover規則は追加していない。全体目標は未完了。

### 前回の区切り

Block状態観測と通常／旧versionの保存再読込を既存BlockTestDriver.createStateObservation／createReload／createLegacyReloadへ分離。既存投影bundle・呼出し時のDocument Definition／scope／Selection／mode・serialize／load・UI→drawへ接続し、配列コピー・boolean／fallback・同一参照と照会順を維持する。旧版は保存値のJSON cloneだけをversion 7相当に加工し、製品migrationは持たない。元の三つの処理本体との一致を依存port置換後に確認。app.jsは6,004→5,925行（79行減、今回の再開から合計1,809行減）。構文483ファイル・単体1,298件・関連E2E142件が成功（すべてexit 0、E2E1.9分）。全利用箇所のblocks／unified-uiを実行。新規テストはなく、既存Block状態／通常保存再読込・旧versionの階層／origin／所属・enabled Sketch／rotation lock・投影と周辺操作を確認した。ログはcad-block-reload-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Document／Definition／cache／保存規則／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Block editor状態の観測、配置／nested拘束／子Sketch Geometry追加／取消／確定／enabled Sketch変更、作成拒否fixtureを既存BlockTestDriverへ役割別に分離。既存editor／session chain・scope、配置／拘束生成／求解・cache／履歴・UI／draw、取消／確定・Sketch変更／Selection検査へ委譲し、操作後の現在状態・保存値と拒否理由を観測する。固定入力・同一Instance／投影参照・数値fallback／nullと更新／照会順を保持し、元の八つの処理本体との一致を依存port置換後に確認。app.jsは6,076→6,004行（72行減、今回の再開から合計1,730行減）。構文483ファイル・単体1,298件・関連E2E60件が成功（すべてexit 0、E2E48.1秒）。全利用箇所のblocks／phase0-characterizationを実行。新規テストはなく、既存editor／nested拘束・子Sketch／確定／取消／enabled Sketch・拒否ケースとvisual回帰を確認した。ログはcad-block-editor-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自下書き／Definition／採番・namespace／履歴・拒否規則は追加していない。全体目標は未完了。

### 前回の区切り

Block作成UI／空fixture・回転lock／投影端点／hoverの観測をBlockTestDriver.createCreationFixture／createEmptyFixture／createRotationObservation／createEndpointObservation／createHoverObservationへ分離。既存reset／Geometry・拘束生成／Selection・fit→UI→draw、現在scope／Definition数・Solver変数／drag session・投影／座標変換・Hoverへ役割別に接続し、固定入力・同一Instance参照・null／boolean・変数filter／sortと呼出し順を維持する。元の五つの処理本体との一致を依存port置換後に確認。app.jsは6,127→6,076行（51行減、今回の再開から合計1,658行減）。構文483ファイル・単体1,298件・関連E2E172件が成功（すべてexit 0、E2E2.3分）。全利用箇所のblocks／choice-dialog／fixed-command／phase0-characterization／unified-uiを実行。新規テストはなく、既存作成／空作成・固定／回転lock・投影操作とscript読込を確認した。classic script・構文一覧・E2E読込期待を同期。ログはcad-block-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Definition／採番／下書き・Solver／lock／hoverルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

親子／SiblingのPoint-Line参照fixture・Sibling参照元移動・参照状態の観測を既存ConstraintTestDriver.createParentPointLineFixture／createSiblingPointLineFixture／createSiblingReferenceMove／createPointLineObservationへ分離。既存reset／Geometry・所属／active切替・fit／UI／draw／client変換、依存求解／解析・cycle判定・signed distance／Sketch照会へ役割別に接続する。固定入力・同一参照・対象なしnullと更新／照会順を維持し、元の四つの処理本体との一致を依存port置換後に確認。app.jsは6,198→6,127行（71行減、今回の再開から合計1,607行減）。構文482ファイル・単体1,298件・関連E2E103件が成功（すべてexit 0、E2E1.4分）。全利用箇所のunified-uiを実行。新規テストはなく、既存親子／Sibling参照・参照元移動と逆参照cycle判定・周辺操作を確認した。ログはcad-point-line-reference-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自点線関係／参照・cycle規則／求解／scope／履歴は追加していない。全体目標は未完了。

### 前回の区切り

循環参照の読込fixtureを既存DocumentTestDriver.createCyclicReferenceFixtureへ、拘束寸法Selectionのfixture／観測と支持状態fixtureを既存ConstraintTestDriver.createDimensionSelectionFixture／createDimensionSelectionObservation／createSupportStatusFixtureへ分離。既存生成／参照mark・serialize／load・解析／UI、Selection／command・fit／draw・求解／status／色へ役割別に接続し、reference error／summaryは明示した既存照会入口を使う。固定入力・同一参照・更新／照会順とbooleanを維持し、元の四つの処理本体との一致を依存port置換後に確認。app.jsは6,256→6,198行（58行減、今回の再開から合計1,536行減）。構文482ファイル・単体1,298件・関連E2E124件が成功（すべてexit 0、unified-ui103件1.4分、phase0-characterization21件15.7秒）。全利用箇所の二ファイルを実行。新規テストはなく、既存cycle読込・寸法Selection解除／command・支持status／色とvisual回帰を確認した。ログはcad-reference-selection-fixtures-{check,unit,e2e,phase0}.log。全E2Eはこの単位では未実行。独自cycle判定／参照・Selection／command／拘束状態／求解／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sibling subtreeの参照fixture／可視性観測を既存SketchTreeTestDriver.createSubtreeReferenceFixture／createSubtreeVisibilityObservationへ、参照元Line移動／依存求解順fixtureを既存ConstraintTestDriver.createReferenceLineMove／createDependencyOrderFixtureへ分離。既存Sketch／Geometry生成・参照有効性・関係label／色／可視性／DOM、参照拘束・依存求解／解析・UI／drawへ役割別に接続する。固定入力・同一参照・所属／active切替と更新／照会順を保持し、元の四つの処理本体との一致を依存port置換後に確認。app.jsは6,352→6,256行（96行減、今回の再開から合計1,478行減）。構文482ファイル・単体1,298件・関連E2E103件が成功（すべてexit 0、E2E1.4分）。全利用箇所のunified-uiを実行。新規テストはなく、既存subtree参照／可視性・参照元の移動／依存求解順と周辺操作を確認した。ログはcad-subtree-reference-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自参照規則／求解順・namespace／scope／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Geometry stroke styleのケースをPropertiesTestDriver.createStrokeStyleCasesへ、construction hover fixture／線描画観測をCanvasRenderTestDriver.createConstructionHoverFixture／createConstructionLineObservationへ分離。既存生成／scope・Definition追加・Hover／drawLines／外観へ接続し、固定入力・同一参照・描画／照会順・null／丸めとCanvas methodのtry／finally復元、元arcへのctxを保った転送を維持する。元の三つの処理本体との一致を依存port置換後に確認。app.jsは6,465→6,352行（113行減、今回の再開から合計1,382行減）。構文482ファイル・単体1,298件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。単体1件で描画／外観例外時のCanvas復元・対象なしnull・arc転送のcontext／引数と表示結果を確認した。新規unit追加でWindowsシェルの起動長制限に当たり全unit起動がexit 1となったため、既存206ファイルの順序と追加1ファイルの明示一覧をtools/run-unit-tests.jsへ保持し、Nodeを直接spawnする起動へ変更して全unitを再実行・成功確認。npm run test:unitの入口は維持する。ログはcad-geometry-stroke-observation-{check,unit,unit-final,e2e}.log。全E2Eはこの単位では未実行。独自線幅／外観・hover／renderer／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sibling可視性fixture・inactive寸法／Block hover fixture・hover identity観測を既存SketchTreeTestDriver.createSiblingVisibilityFixture／createInactiveHoverFixture／createIdentityObservationへ分離。Geometry／寸法／Sketch／Block準備は既存生成・編集へ、Definition追加／採番はapp callbackへ、client位置はCanvasTestDriverへ接続する。固定入力・同一参照・所属／active切替とcache→fit→viewport移動→UI→draw→layout／位置照会、表示／identityのfallbackとnullを保持する。元の三つの処理本体との一致を依存port置換後に確認。app.jsは6,543→6,465行（78行減、今回の再開から合計1,269行減）。構文480ファイル・単体1,297件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存Sibling表示・inactive Geometry／寸法／Blockのidentityと編集先を変えない選択、周辺可視性を確認した。ログはcad-inactive-sketch-hover-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自可視性／編集先・hoverルール／scope／採番／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sketch削除のfixtureと既存削除への実行入口をDocumentTestDriver.createSketchDeletionFixtureへ分離。固定の親子／兄弟Sketch・Geometry／参照付き注記の準備を既存reset／生成へ、削除を既存deleteSketchへ委譲し、現在scopeのSketch ID／active・Geometry／注記数を観測する。固定入力・色・同一Geometry参照・active切替・確認なしの削除引数と照会順を保持し、元の二つの処理本体との一致を依存port置換後に確認。app.jsは6,568→6,543行（25行減、今回の再開から合計1,191行減）。構文480ファイル・単体1,297件・関連E2E124件が成功（すべてexit 0、E2E1.5分）。全利用箇所のphase0-characterization／unified-uiを実行。新規テストはなく、既存子孫cleanup／Geometry・拘束／注記削除とUndo・周辺UIを確認した。ログはcad-sketch-deletion-fixture-{check,unit,e2e}.log。全E2Eはこの単位では未実行。削除／cleanup／namespace／履歴の製品処理は変更していない。全体目標は未完了。

### 前回の区切り

Offset chainのUI準備／状態観測／保存再読込／target編集／再選択を既存OffsetTestDriver.createChainFixture／createChainObservation／createChainReload／createChainTargetEdit／createChainReselectionへ役割別に分離。既存Geometry生成・fit／履歴・Selection／pending・保存／読込・precondition／計測へ接続し、固定入力・同一参照・null／空配列fallbackと元の更新／照会順を保持する。元の五つの処理本体との一致をscope port置換後に確認。app.jsは6,648→6,568行（80行減、今回の再開から合計1,166行減）。構文480ファイル・単体1,297件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存chain選択／target更新／join・結果再選択／保存再読込を確認した。ログはcad-offset-chain-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自chainモデル・Selection／pending・拘束更新／保存互換性／履歴は追加していない。全体目標は未完了。

### 前回の区切り

単独Offsetの生成／保存再読込・UI／方向fixtureと状態観測をOffsetTestDriver.createPrimitiveFixture／createUiFixture／createUiObservation／createDirectionFixtureへ分離。固定Point表示は既存CanvasTestDriver.createFixedPointFixtureへ接続し、公開hookの座標変換参照を既存clientPositionへ置換する。固定入力・同一Geometry／拘束参照、target／expression更新→求解→計測→保存／reload→現在scope照会、UI／方向とPoint表示の呼出し順を保持する。元の五つの処理本体との一致を依存port置換後に確認。app.jsは6,743→6,648行（95行減、今回の再開から合計1,086行減）。構文480ファイル・単体1,297件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存固定Pointの表示・Offset生成／UI／方向／保存再読込とscript読込を確認した。classic script・構文一覧・E2E読込期待を同期。ログはcad-offset-primitive-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Offset計算／拘束・scope／入力状態／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sidebar inspectionを既存PropertiesTestDriver.createInspectionFixtureへ、Root／Block hoverをSketchTreeTestDriver.createRootHoverFixture／createBlockHoverFixtureへ分離。固定Geometry／reference・read-only拘束とSketch／Blockを既存生成・編集へ委譲し、UI→fit→draw→位置／ID観測の順を保持する。Definition追加とInstance採番はappのcallbackに留め、Block位置は既存CanvasTestDriverのclient変換へ接続する。固定入力・同一参照・所属／active切替・cache無効化と各照会順を維持し、元の三つの処理本体との一致を依存port置換後に確認。app.jsは6,865→6,743行（122行減、今回の再開から合計991行減）。構文479ファイル・単体1,297件・関連E2E125件が成功（すべてexit 0、E2E1.7分）。全利用箇所のsketch-tree-visibility／unified-uiを実行。新規テストはなく、既存inspection／Root・子孫Sketch・Block hover／explicit Point表示と周辺可視性・script読込を確認した。classic script・構文一覧・E2E読込期待を同期。ログはcad-sidebar-tree-fixtures-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自scope／採番／定義・Selection／hoverルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Canvas dash isolationの支援をCanvasRenderTestDriverの作図preview準備／Block準備／観測手順の三つに分離。既存command／preview・生成型／Definition追加／scopeとappのmode入口へ役割別に接続し、reset→viewport→preview／Selection reset→mode→setup→dash設定→draw→dash照会と12case順を保持する。組み直した処理が元のcase順／本体と一致することを依存port置換後に確認。app.jsは6,956→6,865行（91行減、今回の再開から合計869行減）。構文478ファイル・単体1,297件・関連E2E103件が成功（すべてexit 0、最終E2E1.5分）。初回E2Eは102件成功／dash1件失敗で、drawSelectionRectの依存受渡し忘れによる未定義参照を修正し、同じunified-ui全体を再実行して成功を確認した。新規テストはなく、既存12種のdash分離とscript読込を確認。classic script・構文一覧・E2E読込期待を同期。ログはcad-canvas-dash-driver-{check,unit,e2e,e2e-final}.log。全E2Eはこの単位では未実行。独自mode／command状態・Block定義／seq・renderer／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Sketch寸法の可視性fixtureを既存DimensionTestDriver.createSketchVisibilityFixtureへ分離。二つのSketchの固定寸法準備は既存reset／Geometry・寸法生成へ、active Sketch切替と復元・可視性／描画は既存所有者へ接続する。非表示→label観測→再表示とfilter／返却値の順を維持し、fillText差替えは各描画のtry／finallyで元のmethodへ復元する。元の処理本体との一致を依存port置換後に確認。app.jsは7,002→6,956行（46行減、今回の再開から合計778行減）。構文477ファイル・単体1,297件・関連E2E116件が成功（すべてexit 0、E2E1.6分）。全利用箇所のview-visibility／multiple-dimensions／unified-uiを実行。単体1件を追加し、成功と一回目／二回目の描画例外でCanvas methodの復元と既存復元範囲を確認した。ログはcad-sketch-dimension-visibility-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Sketch／寸法モデル・可視性／描画ルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Canvas fitの全図形fixture／中ボタンfixture・表示範囲観測・fit実行を既存CanvasTestDriver.createAllGeometryFitFixture／createMiddleButtonFitFixture／createFitObservation／createFitOperationへ分離。固定Geometry／Sketch準備は既存reset／生成と現在scopeへ、viewport・fit／可視性／座標変換は既存所有者へ委譲する。固定座標・所属／active Sketch切替と復元、viewport更新順、paddingの数値化／fallback、fit→drawと各照会順を保持し、元の四つの処理本体との一致を依存port置換後に確認。app.jsは7,050→7,002行（48行減、今回の再開から合計732行減）。構文477ファイル・単体1,296件・関連E2E139件が成功（すべてexit 0、E2E1.8分）。全利用箇所のannotation-display-size／canvas-zoom-input／hatching／sketch-permissions／unified-uiを実行。新規テストはなく、既存の全図形fit／中ボタン／visible bounds・倍率・領域／権限と周辺操作を確認した。ログはcad-canvas-fit-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自scope／viewport／fit・可視性ルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Trimの拘束移送・construction境界・直径寸法移送のfixtureをTrimTestDriver.createLineTransferFixture／createConstructionBoundaryFixture／createDiameterTransferFixtureへ分離。固定Geometry／拘束準備は既存reset／生成へ、境界・preview／Trim・拘束移送は既存query／editingへ役割別に委譲する。固定入力とboundaryCountの数値化／下限、呼出し順・同一Geometry／拘束参照・fallbackと返却値を保持する。元の三つの処理本体との一致をscope port置換後に確認。app.jsは7,144→7,050行（94行減、今回の再開から合計684行減）。構文477ファイル・単体1,296件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存の線拘束移送／construction除外／円の直径寸法保持とscript読込を確認した。classic script・構文一覧・E2E読込期待を同期。ログはcad-trim-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自交点／区間計算・拘束移送・モデル／履歴は追加していない。全体目標は未完了。

### 前回の区切り

角度寸法ラベルの追従ケースを既存DimensionTestDriver.createAngleLabelFixtureへ分離。固定Geometryの準備・平行移動／半径変更／8回のlabelドラッグ手順と誤差観測を担当し、既存layout／basis／offset更新／labelからの配置／寸法保存値へ委譲する。旧label座標と破損relative offsetの固定入力、参照を更新するlayoutの呼出し順、保持offset・半径方向の誤差と保存version／legacy座標有無を維持する。元の処理本体との一致を確認。app.jsは7,241→7,144行（97行減、今回の再開から合計590行減）。構文476ファイル・単体1,296件・関連E2E103件が成功（すべてexit 0、E2E1.4分）。全利用箇所のunified-uiを実行。新規テストはなく、既存の角度ラベル追従・旧座標変換・繰り返し配置・保存値と周辺寸法操作を確認した。ログはcad-angle-label-fixture-{check,unit,e2e}.log。全E2Eはこの単位では未実行。製品の角度計算／寸法状態・保存形式／履歴は変更していない。全体目標は未完了。

### 前回の区切り

寸法の引出線表示fixture・表示精度・文字角度のケースを既存DimensionTestDriver.createExtensionVisibilityFixture／createDisplayCases／createTextAngleCasesへ分離。固定矩形の準備は既存reset／Geometry生成へ、表示は既存layout／formatter／JIS角度・offsetへ委譲する。固定入力・計算順とshowExtensionのfalse判定を保持し、Geometry準備のない二つのケースへreset／モデル依存を渡さない。元の三つの処理本体との一致を確認。app.jsは7,313→7,241行（72行減、今回の再開から合計493行減）。構文476ファイル・単体1,296件・関連E2E103件が成功（すべてexit 0、E2E1.3分）。全利用箇所のunified-uiを実行。新規テストはなく、既存の表示precision・JIS文字角度・Point間／線長の引出線previewと周辺の寸法編集／保存を確認した。ログはcad-dimension-display-cases-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自寸法計算／表示ルール／モデル／履歴は追加していない。全体目標は未完了。

### 前回の区切り

読み取り専用寸法の重複fixture／配置fixtureを既存DimensionTestDriver.createReadOnlyDuplicateFixture／createReadOnlyPlacementFixtureへ分離。既存reset・Geometry／寸法生成・layout／label／保存値へ委譲し、重複寸法数と引出線整列誤差を観測する。配置はconstraintTargetSession→pendingCommandSession→寸法入力開始の順と現在scopeの寸法／入力状態照会を維持する。固定座標・同一target参照・所属Sketch・filter／fallbackと照会順を保持し、元の二つの処理本体との一致をscope port置換後に確認。app.jsは7,354→7,313行（41行減、今回の再開から合計421行減）。構文476ファイル・単体1,296件・関連E2E219件が成功（すべてexit 0、E2E3.4分）。全利用箇所のannotation-display-size／annotation-anchors／leader-appearance／sketch-tree-visibility／unified-annotations／unified-uiを実行。新規テストはなく、既存の重複／read-only・入力・寸法表示／注記・履歴／保存を確認した。ログはcad-readonly-dimension-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自寸法計算／session／入力状態／履歴は追加していない。全体目標は未完了。

### 前回の区切り

注記の寸法・外観・所属／投影の観測を既存AnnotationTestDriver.createDimensionObservation／createAppearanceObservation／createOwnershipObservationへ分離。既存寸法表示・AnnotationRenderer／Appearance・Document／Selectionへ役割別に接続し、layout・保存値・表示metrics・client位置を観測する。外観だけが既存の対象探索→倍率更新→対象なしnull→style→draw→表示／保存照会を持ち、他の観測へ倍率更新／drawを渡さない。コピー／参照・継承rotation・投影のfallbackと照会順を保持し、元の三つの処理本体との一致を依存port置換後に確認。app.jsは7,400→7,354行（46行減、今回の再開から合計380行減）。構文476ファイル・単体1,296件・関連E2E208件が成功（すべてexit 0、E2E3.3分）。全利用箇所のannotation-anchors／annotation-display-size／free-text-input-drag／leader-appearance／unified-annotations／unified-uiを実行。新規テストはなく、既存の注記寸法・倍率・Parameter／外観・Block所属／投影・保存／再読込を確認した。ログはcad-annotation-state-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。注記の製品状態／保存形式／表示ルールは変更していない。全体目標は未完了。

### 前回の区切り

注記のドラッグfixture・snapshot・hit観測をAnnotationTestDriver.createDragFixture／createSnapshot／createHitObservationへ分離。既存reset／Geometry・注記追加／Leader参照／表示Geometry／座標変換／hitへ役割別に接続し、準備後のsnapshot入口を明示する。固定座標／文字列／styleコピー、最後のLeader／Text優先、world／display／viewport座標とコピー・null・照会順を保持する。元の三つの処理本体との一致を依存port置換後に確認。app.jsは7,445→7,400行（45行減、今回の再開から合計334行減）。構文476ファイル・単体1,296件・関連E2E203件が成功（すべてexit 0、E2E3.1分）。全利用箇所のannotation-anchors／leader-appearance／phase0-characterization／png-export／unified-uiを実行。新規テストはなく、既存の注記drag／hit／ハンドル／Undo・外観・PNGとfile URL読込期待で確認した。classic scriptと構文一覧・E2E読込期待を同期。ログはcad-annotation-drag-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自注記モデル／表示・hitルール／履歴は追加していない。全体目標は未完了。

### 前回の区切り

拘束診断とBlock投影支援を既存ConstraintTestDriverのcreateStatusObservation／createAnalysisObservation／createBlockObservation／createBlockConstraintInsertionへ分離。既存refresh・Solver解析・scope／投影／commitへ役割別の依存を渡し、所属Sketch・同一参照status照会、誤差閾値／降順／上位12件、summaryコピー、対象なしの理由とliteral true判定、解析→Block状態→保存値の観測順を保持する。Geometryドラッグにも同じstatus観測を渡し、公開hook同士のthis依存を解消。元の四つの処理本体との一致を依存port置換後に確認。app.jsは7,507→7,445行（62行減、今回の再開から合計289行減）。構文475ファイル・単体1,296件・関連E2E239件が成功（すべてexit 0、E2E5.0分）。診断・Block支援の利用9ファイルとunified-uiの計10ファイルを実行し、単体3件でcall-time scope・誤差順位／件数・投影参照・summaryコピーと拒否後の観測順を確認した。ログはcad-constraint-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Solver／拘束状態／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Geometryドラッグのテスト手順と観測を既存GeometryDragTestDriver.createGeometryDriverへ分離。Point／Line／Circle／Arc／Arc端点の開始位置とsnapshot、fractionのfinite判定／clamp、sessionなしの初期状態・対象なしのnull、初期位置基準・計測・結果fallbackと既存sessionの実行順を保持する。拘束状態はapp内の従来本体をreadTestConstraintStatusesとして共有し、inspectConstraints時だけ明示した入口で照会する。元のGeometryドラッグ／拘束状態本体との一致を依存port置換後に確認。app.jsは7,615→7,507行（108行減、今回の再開から合計227行減）。構文475ファイル・単体1,293件・関連E2E162件が成功（すべてexit 0、E2E20.6分）。全利用箇所のadversarial-drag-fixture／blocks／constraint-drag-regressions／geometry-drag-smoothness／unified-uiを同じ実行で正常終了まで追跡し、単体2件で同一Line／Arc端点wrapper・fraction・初期位置基準・snapshot／計測・拘束観測とsessionなしの早期終了を確認した。ログはcad-geometry-drag-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自Solver／ドラッグ状態／拘束状態／履歴は追加していない。全体目標は未完了。

### 前回の区切り

Pointドラッグの単発／連続テスト手順と結果観測をGeometryDragTestDriver.createPointDriverへ分離。現在scopeの同一Pointと既存session生成・local solve context・preview更新・最終求解・円弧正規化・所属Sketchの拘束誤差へ明示的に接続し、初期位置からの移動量、preview座標のコピー、計測・失敗結果／例外・対象なしのnullと実行順を保持する。元の二つの処理本体との一致を依存port置換後に確認。app.jsは7,694→7,615行（79行減、今回の再開から合計119行減）。構文475ファイル・単体1,291件・関連E2E149件が成功（すべてexit 0、E2E3.0分）。全利用箇所のblocks／drag-smoothness／unified-uiを実行し、単体3件でsession同一性・call-time scope・preview／final分離・計測・移動基準と早期終了を確認した。classic script読込／構文一覧・単体一覧・file URL読込期待も同期。ログはcad-point-drag-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。製品のSolver／ドラッグ状態／履歴は変更していない。全体目標は未完了。

### 前回の区切り

選択可能な線のclient位置照会を既存CanvasTestDriver.createSelectableLinePositionへ分離。現在scopeの線配列順と0.37／0.63／0.5位置、Point→同一参照Line→寸法のhit短絡、Canvas矩形の包含と画面の重なり判定を保持し、候補なしはnullを返す。元の処理本体との一致を依存port置換後に確認。app.jsは7,709→7,694行（15行減、今回の再開から合計40行減）。構文473ファイル・単体1,288件・関連E2E14件が成功（すべてexit 0、E2E1.8分）。既存利用箇所のadversarial-authoring-performance／adversarial-drag-fixtureを実行し、単体1件でcall-time scope／Canvas矩形・競合hitの同一参照／短絡・画面外／UI重なり／境界包含を確認した。ログはcad-selectable-position-{check,unit,e2e}.log。全E2Eはこの単位では未実行。選択／hitルールや独自モデルは追加していない。全体目標は未完了。

### 前回の区切り

作図状態とsnapラベルのテスト観測を既存CanvasTestDriver.createAuthoringObservation／createSnapObservationへ分離。現在のscope・mode・各session・計測・Selectionを既存所有者から照会し、距離10 CSS pxの境界、候補順・入力数値化、座標／計測値のコピー、preview／選択の参照、serialize→decorateとnull fallbackを保持する。元の二つの処理本体との一致を依存port置換後に確認。app.jsは7,734→7,709行（25行減）。構文473ファイル・単体1,287件・関連E2E211件が成功（すべてexit 0、E2E3.3分）。既存利用箇所の5ファイルを確認し、単体2件を追加して呼出し時のscope／zoomと参照・コピー境界を検証した。ログはcad-authoring-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。独自モデル／session／snapルールは追加していない。全体目標は未完了。

### 前回の停止地点（2026-10-12）

週枠残量69%を確認したため新規分離を停止。今回の76個の区切りのcommitを保持し、最終コード8e6fc2aをdevelopのcab7c6dへ統合・Pushした。app.jsは11,058→7,630行（合計3,428行減）。構文469ファイル・単体1,261件・全E2E560件が最新統合コードで成功（exit 0、全E2E24.8分）。ログはcad-refactor-oct12-final-{check,unit,e2e}.log。全テスト本体とworker終了後、実体を確認した専用サーバーの終了待ちを解消して同じ実行の正常終了を回収した。この停止記録をCommit／Pushした後、mainを最後に反映してdevelopとローカル・リモートを同期し、統合済み作業branchを削除・runtime再生成して一時停止する。全体目標は未完了。再開手順と次の責務候補はrefactoring-policy-and-resume.md section 8を参照する。

### 最後の分離単位

Hover表示の観測を既存PropertiesTestDriver.createHoverObservationへ分離。既存Geometry一覧／Block投影・外観・Tree強調／Sidebar／Canvas／Block Hoverと表示色／線幅へ接続し、対象なしのnull、検索・Block内Geometryの優先順／短絡、Pointの投影・線端点除外、同一参照照合・constructionと照会順を保持する。独自Geometry／Hover／表示ルールを追加せず、test query時だけ生成して既存API名へ接続。元の処理本体との一致を確認。app.jsは7,652→7,630行（22行減、今回の合計3,428行減）。構文469ファイル・単体1,261件・関連E2E103件成功（exit 0、2.0分）。新規テストはなく、全利用箇所のunified-ui既存E2EでTree／Canvas強調、Point／Block、色／線幅を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-hover-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

hit観測とGeometryのclient位置取得を既存CanvasTestDriver.createHitObservation／createGeometryPositionへ分離。hit側は入力座標を元どおり数値正規化し、Arc端点→Point／Line／Circle／Arc／Splineの既存query結果をID／端点／nullへ変換する。位置側は現在scopeのGeometryからPoint位置・線中点・円右端・円弧の指定端点または従来の角度平均・Splineの0／1／0.5評価位置を取得し、既存client変換へ渡す。Spline evaluateを明示した依存へ、thisによるclient hook参照を既存CanvasTestDriver.clientPositionへ置換する。detail既定値／未存在Geometryのnull・式／順序を維持し、hitルール／幾何計算／scope／viewportを複製しない。test query時だけ生成し、既存API名へ接続。元の二つの処理本体との一致を確認。app.jsは7,683→7,652行（31行減、今回の合計3,406行減）。構文469ファイル・単体1,261件・関連E2E144件成功（exit 0、3.1分）。新規テストはなく、全利用箇所のadversarial-authoring-performance／head-symmetry／phase0-characterization／spline／unified-ui既存E2Eで応答性・円弧／Spline操作・hit観測を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-hit-position-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch移動と表示倍率のテスト観測を既存CanvasSelectionTestDriver.createMoveObservation／CanvasTestDriver.createZoomObservationへ分離。移動の観測は既存command／fields・現在Selection／scopeと拘束serialize／保存値／Block編集状態を照会し、開始中target／所属／描画順を返す。倍率の支援は指定時だけ既存clampでviewportを更新し、現在Document unitsの複製と倍率／format表示を返す。null既定値・数値変換・式・照会順を保持し、移動session／Selection／viewportを別に保持しない。移動側にviewport依存、倍率側にGeometry／Selection／履歴依存を持ち込まず、test query時だけ生成して既存API名へ接続。元の二つの処理本体との一致を確認。app.jsは7,696→7,683行（13行減、今回の合計3,375行減）。構文469ファイル・単体1,261件・関連E2E141件成功（exit 0、2.6分）。新規テストはなく、全利用箇所のsketch-move／canvas-zoom-input／annotation-display-size／phase0-characterization／unified-ui既存E2Eで移動の開始／確定／取消・倍率表示・注記サイズ／保存を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-move-zoom-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Geometry IDのテスト用選択を既存CanvasSelectionTestDriver.createIdSelectionへ分離。現在scopeの九種別の同一Geometry参照を既存Selectionへ設定し、clear→種別順の設定→UI→draw→Block選択query→選択ID照会を保持する。入力既定値、scope配列順、重複IDの扱いとBlockエラー／内部・外部拘束数のfallbackを維持し、独自scope／Selection／選択ルールを追加しない。this経由のhook参照はreadSelectedGeometryへ置換し、test query時だけ生成して既存API名へ接続。元の処理本体との一致を確認。app.jsは7,717→7,696行（21行減、今回の合計3,362行減）。構文469ファイル・単体1,261件・関連E2E263件成功（exit 0、4.1分）。新規テストはなく、全利用箇所14ファイルの既存E2Eで選択を使う編集／Block／投影／外観／表示／Undoを確認。最初のE2EはWindowsパスを検索正規表現として渡したため対象を収集できずexit 1。区切りをスラッシュへ修正し、同じ対象で正常終了を確認した。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-id-selection-{check,unit,e2e,e2e-final}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

拘束入力の状態照会とIntent解決の二つのAPIを既存ConstraintTestDriver.createInputObservation／createIntentResolutionへ分離。前者は現在Selection／ConstraintTargetSession・operandElementとreadSelectedGeometryへ接続し、Instance／arcEndpoint／pair・operand／pending typeを観測する。後者は現在scopeの入力IDを同一Geometryへ結び付け、既存makeConstraintOperand／resolver／serializeConstraintへ委譲。arc-endpointのarc keyとendpoint／parameter、未存在IDの例外、resolutionなしのnullと結果fallbackを維持する。観測にモデル検索／resolver、Intent支援にSelection／session操作を持ち込まず、既存の拘束判断・操作状態を複製しない。test query時だけ生成し、既存API名へ接続。元の二つの処理本体との一致を確認。app.jsは7,738→7,717行（21行減、今回の合計3,341行減）。構文469ファイル・単体1,261件・関連E2E124件成功（exit 0、2.1分）。単体1件を追加し、call-time Geometry同一参照・端点情報、未存在入力のresolver短絡とnull／serialization境界を確認。全利用箇所のphase0-characterization／unified-ui既存E2EでIntentの入力状態非変更・拘束入力と表示回帰を検証。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-constraint-input-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasメニューの重なり選択fixture／円弧端点fixture・状態観測・固定点追加の四つのAPIをCanvasSelectionTestDriverへ分離。createOverlapFixtureは同座標の二線／非表示・inactive線／Block内線を準備し、Definition追加／Instance採番は既存所有者callbackへ委譲する。createEndpointFixtureは線と二円弧の端点選択用Geometryを準備する。固定ID／座標／Sketch切替・Selection、cache無効化・fit→履歴→UI→draw→client照会の順序を維持。createObservationは既存controllerの候補と表示query・現在Hover／Selectionを観測し、Hover優先順／id・parameterName fallback／arcEndpointを保持する。createPointInsertionは現在Canvas矩形／viewportから固定explicit Pointを追加し、UI→draw後のclientを返す。this経由のhook参照を既存CanvasTestDriver.clientPosition／readSelectedGeometryへ置換。観測・Point追加にBlock生成／採番依存を持ち込まず、候補・hit・選択ルールや独自状態を追加しない。test query時だけ生成し、既存API名へ接続。元の四つの処理本体との一致を確認。classic script／構文／E2E読込一覧を同期。app.jsは7,815→7,738行（77行減、今回の合計3,320行減）。構文469ファイル・単体1,260件・関連E2E103件成功（exit 0、2.0分）。新規テストはなく、全利用箇所のunified-ui既存E2Eで候補表示／Hover／選択、固定点除外、円弧端点拘束入力を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-canvas-selection-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Documentのファイル名fixture読込とドラッグ検証用の直接適用をDocumentTestDriver.createImport／createLoadへ分離。importはJSON→File→既存importFileDataをawaitし、完了後のDocument／表示／保存名・titleと経過時間を照会する。直接適用は入力clone→file名overrideで既存load→任意の履歴reset→UI→draw→現在scopeの拘束数を取得。拒否false、async例外伝播、直接適用のload／history／UI／drawを含むcatch範囲と既定値を保持し、形式変換／モデル置換／復元は既存所有者へ委譲する。test query時だけ生成し、既存二つのAPI名へ直接接続。元の二つの処理本体との一致を確認。classic script／構文／unit／E2E読込一覧を同期。app.jsは7,833→7,815行（18行減、今回の合計3,243行減）。構文468ファイル・単体1,260件・全E2E560件成功（exit 0、24.8分）。単体4件を追加してawait後の名前／時間・拒否／例外、cloneと適用後scope、履歴／表示更新を含む失敗境界を確認した。直接適用APIが多数の画面テストで使用されるため全E2Eを一括実行し、前回失敗したDXF保存再読込を含め全件成功。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-document-test-driver-{check,unit,full-e2e}.log。全体目標は未完了。

### 前回の区切り

外観の照会、複数選択Propertiesのfixture／状態照会、固定のfixture／状態照会の五つのAPIをPropertiesTestDriverへ分離。createAppearanceObservationは既存Geometry／Block投影・外観／可視性を使い、種別別検索・Block内Geometry優先順と対象なしのnullを保持する。createFixtureは既存reset／図形生成／Selectionへ委譲し、座標／直接外観・mixedTypesの円、固定用S2／Point・Lineと履歴→UI→drawを維持する。createPropertiesObservation／createFixedObservationは現在Selection／scopeを照会し、既存外観／固定判定・DOM／ボタン／readHistoryへ接続。this経由の履歴hook参照をreadHistoryへ置換し、fixtureの図形生成を観測に持ち込まない。独自モデル／選択状態／外観継承／固定ルールを追加しない。test query時だけ生成し、既存五つのAPI名へ直接接続。明示した所有者参照への置換を除き、元の処理本体との一致を確認。classic script／構文／E2E読込一覧を同期。app.jsは7,886→7,833行（53行減、今回の合計3,225行減）。構文466ファイル・単体1,256件・関連E2E121件成功（exit 0、2.1分）。新規テストはなく、全利用箇所のunified-ui／sketch-projection／view-visibility既存E2Eで複数Properties／固定・解除／Undo、投影外観、表示・非表示を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-properties-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Parameterの準備／フィードバックfixture、状態照会、Block化／寸法名指定削除の五つのAPIをParameterTestDriver.createFixture／createObservation／createInteractionへ分離。fixtureは既存reset／Geometry生成／拘束登録・名前空間補完／安定化へ委譲し、定義追加／Instance採番は既存所有者へのcallbackとする。固定ID／座標／式、参照寸法フラグ、cache無効化→安定化→履歴→UI→drawを保持する。観測は現在scope／Documentを照会し、既存validateの後にParameter値・寸法／Block名前空間・投影長・保存値を返す。操作は既存Selection／Block Selection／定義作成／削除に委譲し、対象なし・拒否と操作後の名前一覧／hintを維持する。観測／操作へGeometry生成／採番／Solver依存を持ち込まず、独自モデル／評価／採番／cacheを追加しない。test query時だけ生成し、既存API名へ直接接続。明示した所有者参照への置換を除き、元の五つの処理本体との一致を確認。classic script／構文／E2E読込一覧を同期。app.jsは8,000→7,886行（114行減、今回の合計3,172行減）。構文465ファイル・単体1,256件・関連E2E114件成功（exit 0、2.1分）。追加テストはなく、五つのAPIの全利用箇所のunified-ui／free-text-input-drag既存E2EでParameter更新・参照寸法削除保護／Block式凍結／フィードバック・注記反映を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-parameter-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法色の観測を既存DimensionTestDriver.createColorObservationへ分離。四つの依存（Selection／Hover／ctx／既存drawDimensions）で、呼出し時の寸法選択・拘束選択・寸法Hoverとstroke参照を保存し、一時解除／差替え→描画→finally復元を所有する。strokeは元ctxと引数で転送し、色の小文字化・初出順の重複排除、同一選択参照、他のHover状態、描画例外の伝播を保持する。通常CanvasRenderProbeへSelection操作を混ぜず、製品描画・独自状態を追加しない。test query時だけ生成し、既存API名へ直接接続。元の処理本体との一致を確認。app.jsは8,021→8,000行（21行減、今回の合計3,058行減）。構文464ファイル・単体1,256件・関連E2E103件成功（exit 0、2.1分）。単体1件を追加し、成功／描画失敗の双方でのcall-time選択／Hover／stroke同一参照の復元、呼出し転送、色の重複排除を確認。全利用箇所のunified-ui既存E2Eも検証。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-dimension-color-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

円弧半径の描画plan、終端記号のfit、矢印先端の観測を既存DimensionTestDriver.createRadiusFixture／createTerminatorFixtureへ分離。円弧fixtureだけがPoint／Arc生成とDimensionPlacementを使い、終端fixtureはDimensionLayout／DimensionMetricsと一時倍率操作へ接続する。両者は呼出し時の既定外観をreaderで照会し、固定ID／座標／半径・入力既定値／数値正規化・演算式／結果形式を維持する。テスト用Geometryはモデル／採番へ登録せず、製品描画の実装・独自viewportを追加しない。矢印は呼出し時の倍率を保存し、成功／例外ともfinallyで復元する。test query時だけappが生成し、既存三つのAPI名へ接続。明示した所有者参照への置換を除き、元の三つの処理本体との一致を確認。app.jsは8,110→8,021行（89行減、今回の合計3,037行減）。構文464ファイル・単体1,255件・関連E2E103件成功（exit 0、1.9分）。単体1件を追加して外観／線幅／矢印点／join計算での例外伝播と呼出し前倍率への復元を確認し、unit／構文一覧を同期した。全利用箇所のunified-ui既存E2Eで円弧補助線／終端配置／矢印先端の実描画計算を検証。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-dimension-render-fixture-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法Appearanceの状態照会と描画寸法の観測をDimensionTestDriver.createAppearanceObservation／createRenderObservationへ分離。状態照会は現在scope／Documentと既存Appearance照会へ、描画観測は既存DimensionPlacement／DimensionLayout／DimensionMetrics・viewport／表示倍率へ接続する。対象なし・angle時のnull、既定寸法の生成条件、clone、Block内のSketch参照、数値式と呼出し順を維持し、独自モデル／描画計算を追加しない。test query時だけ生成し、既存二つのAPI名へ直接接続する。明示した所有者参照への置換を除き、元の二つの処理本体との一致を確認。classic script／構文／E2E読込一覧と責務配置を更新。app.jsは8,155→8,110行（45行減、今回の合計2,948行減）。構文463ファイル・単体1,254件・関連E2E127件成功（exit 0、3.0分）。単体の追加はせず、全利用箇所のannotation-display-size／leader-appearance／unified-ui既存E2Eで外観継承・表示寸法・保存再読込を確認。全テスト本体とworker終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収。ログはcad-dimension-observation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Reference Imageの状態照会／data URL読込／Block下書き準備・確定の四つのAPIをReferenceImageTestDriver.createObservation／createImport／createBlockFixtureへ分離。観測・native読込・fixture生成の依存を分け、現在scope／Block編集状態・既存画像operation／Selection／履歴／viewportへ接続する。観測の選択ID→scope／下書き画像serialize→calibration／drag→履歴→viewport、読込のfetch→Blob→File→既存importとawait／既定値／例外、preserveDocument指定と固定Point／Line ID・座標・所属Sketch、確定後の保存値cloneを保持する。this経由の履歴hook参照をreadHistoryへ置換し、独自モデル／operation／viewport／seq／cacheを持たない。元の四つの本体との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,176→8,155行（21行減、今回の合計2,903行減）。構文462ファイル・単体1,254件・関連E2E167件成功（exit 0、3.5分）。新しい単体テストは追加せず、全利用箇所のreference-images／dxf-import／png-export／sketch-moveとunified-ui／blocksの既存E2Eで実利用を検証。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-reference-image-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionの資格fixtureを既存SketchProjectionTestDriver.createEligibilityFixtureへ、投影targetのコピー／貼付け・Block化の観測をcreateTransferへ分離。資格fixtureは現在scope・Geometry生成と既存資格判定へ委譲し、固定ID／座標・Hierarchy・activeSketch切替と照会順を保持する。転送は既存select・ClipboardSessionとcopy／paste・Block Selection／中心／定義作成へ接続し、コピー拒否時のpaste短絡、前後拘束数／Boolean化／現在payload→state、Block検証エラー時の作成中止、Definition／外部投影拘束の集計を維持する。thisによるhook参照をselect／readStateへ置換し、モデル／Selection／Clipboard／Definition／cacheを複製しない。元の三つの本体との一致を確認。app.jsは8,225→8,176行（49行減、今回の合計2,882行減）。構文461ファイル・単体1,254件・関連E2E186件成功（exit 0、3.5分）。転送の拒否／短絡・同一Selection参照・payloadと事後観測の単体2件、祖先／可視性／Root等の資格E2E1件を追加。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-sketch-projection-transfer-driver-{check,unit,e2e}.log。Sketch Projectionテスト支援の実装本体は分離済みで、appには生成／接続と既存API名の対応付けが残る。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionのsource移動／形状・Spline構造変更とchain作成を既存SketchProjectionTestDriver.createSourceEditingへ、保存再読込をcreateReloadへ分離。source編集は現在scope／所属Sketch／拘束を照会して既存Point参照を変更し、target生成・参照metadata／拘束追加・同期と依存求解→UI→draw→stateへ委譲する。chainのupstream target同一参照、S4重複追加の回避、upstreamなしのnull、dependent求解の失敗判定を保持する。reloadは独立した六依存で保存値clone→版数Number変換→既存load→UI→draw→stateを保持し、Geometry生成／Solver依存を持たない。モデル／seq／cacheは複製せず、this経由のhook参照をreadStateへ置換。元の三つの処理本体との一致を確認。app.jsは8,271→8,225行（46行減、今回の合計2,833行減）。構文461ファイル・単体1,252件・関連E2E185件成功（exit 0、3.5分）。source形状／Spline構造の追随とchain参照の保存再読込のE2E2件、reloadのclone／変換・順序・load例外伝播の単体1件を追加した。最初のE2E起動は追加testの重複titleで収集に失敗し、重複分を除いて同じ対象を再実行し成功。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-sketch-projection-source-driver-{check,unit,e2e,final-check,e2e-final}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionのtarget選択／外観変更、最初の投影拘束・source／target Geometry・source Sketch削除の六つのAPIを既存SketchProjectionTestDriver.createGeometryInteractionへ分離。呼出し時の拘束reader・Geometry型・Selectionと既存編集／削除・表示／観測／client変換を明示し、fixture生成・Solver・Clipboard／Block化依存を持たせない。種別別Geometryの参照同一性、選択→UI→draw→state→client、編集／削除後state、対象なしのnull／falseと拒否結果を保持する。thisによるhook参照をprivate selectとreadState／clientPositionへ置換し、モデル／Selection／履歴／cacheは複製しない。元の六つの本体との一致を確認。app.jsは8,311→8,271行（40行減、今回の合計2,787行減）。構文461ファイル・単体1,251件・関連E2E183件成功（exit 0、3.5分）。既存E2Eに六つのhookの直接利用がなかったため、4つの単体境界テストを追加して五Geometry種別の同一参照、live readerと対象なし、操作拒否、削除payload、操作後観測を検証。対象E2Eはsketch-projection／互換fixture／command-panel／unified-ui／blocks／sketch-permissions。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-sketch-projection-geometry-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch ProjectionのBlock下書きfixture／確定、Block投影fixture、Instance移動／削除の五つのAPIを既存SketchProjectionTestDriverのcreateBlockEditorFixture／createBlockProjectionFixture／createBlockProjectionInteractionへ分離。独立した入口により、操作支援に生成型・Definition追加・採番依存を持ち込まない。編集scope切替後の再照会、Definition追加／IDの既存所有者、cache無効化・bundle解決・focus／履歴／表示順、移動の依存求解・削除後state照会、無Instance時のnullを維持する。this経由のhook参照を明示した表示／readStateへ置換し、モデル／seq／cache／履歴は複製しない。元の五つの本体との一致を確認。app.jsは8,352→8,311行（41行減、今回の合計2,747行減）。構文460ファイル・単体1,247件・関連E2E183件成功（exit 0、3.7分）。既存のfixture直接利用テストがなかったため、Block E2Eに下書き確定時のhost Geometry分離とInstance移動／削除時のDefinition保持／無Instance分岐を検証する2件を追加した。対象はsketch-projection／互換fixture／command-panel／unified-ui／blocks／sketch-permissions。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、正常終了を回収した。ログはcad-sketch-projection-block-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionの矩形／共有種別fixtureと旧共有target Pointの再現を既存SketchProjectionTestDriver.createCompatibilityFixtureへ分離。現在scope・Geometry生成・投影target／拘束／metadata／求解・保存／読込・履歴／表示／状態照会を明示し、元の二つの処理本体との一致を確認。通常生成の共有source参照・座標・採番／Construction、旧形式指定時の保存値clone→target Point共有化→不要Point除去→既存load、履歴→UI→draw→readStateの順を保持する。製品migrationには移さず、独自モデル／seq／cacheを持たない。app.jsは8,443→8,352行（91行減、今回の合計2,706行減）。構文460ファイル・単体1,247件成功（exit 0）。既存fixtureの直接利用テストがなかったため、矩形／複数種別の通常生成・旧形式再読込に対する4つのE2Eを追加し、共有source Pointと独立target Point、矩形座標と所属Sketchを検証。関連既存E2E177件（3.5分）と新しい4件（1.6分）がそれぞれ成功（exit 0、計181件）。テスト本体終了後の専用サーバー終了待ちは当該processを確認して終了し、結果を回収した。ログはcad-sketch-projection-compatibility-driver-{check,unit,e2e,final-check,focused}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Sketch Projectionの通常Geometry fixtureと投影状態照会をSketchProjectionTestDriver.createGeometryFixture／createObservationへ分離。観測に生成・求解・表示更新依存を持たせず、呼出し時のscope／mode／command件数／投影拘束と既存外観・拘束状態・保存・履歴・DOM readerへ接続する。fixtureの共有Point参照・座標・Construction・activeSketch切替・focus→履歴→UI→draw→client位置照会、観測のGeometry／外観／保存／履歴／階層／DOM順を保持する。独自モデル／seq／cacheを持たず、this経由のhook相互参照を明示した表示・履歴入口へ置換。元の二つの処理本体との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,502→8,443行（59行減、今回の合計2,615行減）。構文459ファイル・単体1,247件・関連E2E177件成功（exit 0、3.9分）。新しい単体テストは追加せず、全利用箇所のsketch-projection／command-panelとunified-ui／blocks／sketch-permissionsの既存E2Eで実利用を検証。テスト本体完了後に当該実行の専用サーバー終了待ちを解消して正常終了を回収した。ログはcad-sketch-projection-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasのtest用focus／world-to-client座標照会をCanvasTestDriverへ、派生Instance作図fixtureを既存DerivedInstanceTestDriver.createCommandFixtureへ分離。viewport／resize／drawと現在Canvas矩形の照会順、数値fallback、fixture座標・Construction・履歴／表示順を保持し、thisによるhook相互参照を明示したfocus／clientPositionへ置換する。モデル・seq・cache・表示状態を複製しない。元の三つの本体との一致と三つの境界テストを確認し、classic script／構文／単体／E2E読込一覧を更新。app.jsは8,525→8,502行（23行減、今回の合計2,556行減）。構文458ファイル・全単体1,247件成功（exit 0）。全E2Eは550件成功・DXF保存再読込の1件失敗（exit 1、24.6分）。既存保存処理ではcheckpoint更新後も保存中の排他が続くため、変更なし表示だけで読込を始めていたテストの待機条件を保存済み表示までに修正。期待するタイトル・Geometry・保存読込の検証は維持する。修正後はDXF／file-safetyを各3回、計45件成功（exit 0、2.9分）。テスト本体完了後のサーバー終了待ちは、当該実行の専用サーバーを確認して終了し結果を回収した。ログはcad-canvas-test-driver-{check,unit,full-e2e,final-check,dxf-recheck,save-recheck}.log。修正後の全E2E一括再実行は未実施であり、全551件が一括成功したとは扱わない。リリース前に最新状態の全E2Eを確認する。全体目標は未完了。

### 前回の区切り

派生Instanceのfixture／状態照会・読込・source／Instance削除の五つのテスト支援APIをDerivedInstanceTestDriverのcreateFixture／createInteractionへ分離。現在scopeと既存投影／削除・ID採番入口へ委譲し、Projection→Mirror→Patternの参照／採番順・Hatch生成・履歴／表示・clone／読込／削除後観測の順を保持する。独自モデル／seq／cacheを持たず、this経由のhook参照はDriver内stateと明示したreadStateへ置換。元の五つの本体との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,567→8,525行（42行減、今回の合計2,533行減）。構文456ファイル・単体1,244件・関連E2E199件成功（exit 0、2.7分）。ログはcad-derived-instance-test-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、利用する全9ファイルとunified-uiの既存E2Eで実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Clipboardの状態照会／通常図形fixture／Block fixtureをClipboardTestDriverの三つの独立した生成入口へ分離。観測は九つの依存だけで動き、生成型・seq・描画依存を持たない。fixtureは既存Geometry／拘束・定義追加・ID採番・ClipboardSession／Selection・履歴／表示へ委譲し、現在scopeの再照会・保存→Geometry→選択→payload→履歴の順と結果を保持する。this経由のhook相互参照をreadState／readSelected／readHistoryへ置換し、共有test選択readerは旧selectedGeometryIdsForTestにも接続。三つの本体と選択readerの元処理との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,634→8,567行（67行減、今回の合計2,491行減）。構文455ファイル・単体1,244件・関連E2E171件成功（exit 0、2.3分）。ログはcad-clipboard-test-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、全利用箇所のsketch-tree-visibility／sketch-tree-delete／unified-uiとblocksの既存E2Eで実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

拘束確定時のSolver結果を一時差替えするテスト支援をConstraintTestDriver.createForcedCommitへ分離。七つの明示した依存で既存fixture生成・commit・現在scope／DOM照会へ接続し、finallyの元Solver関数復元・例外伝播・結果変換・literal true判定・復元後の照会を保持する。元本体との一致と三つの境界テスト（通常／例外の復元と置換scopeの再照会）を確認し、classic script／構文／単体／E2E読込一覧を更新。app.jsは8,658→8,634行（24行減、今回の合計2,424行減）。構文454ファイル・単体1,244件・関連E2E124件成功（exit 0、1.7分）。ログはcad-constraint-test-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

描画順のfixture／観測／選択／並替えの四つのテスト支援APIをDrawingOrderTestDriverへ分離。createFixtureとcreateInteractionを独立して生成し、操作観測に図形生成・Block定義依存を持ち込まない。現在scope・既存DrawingOrder／Hatch境界／Selection／並替えcommandへ委譲し、fixture座標・ID・外観・一時activeSketch切替・cache／fit／履歴／表示の順を保持する。this経由のhook間参照をDriver内stateと明示した共有test履歴readerへ置換し、既存historyState APIも同じreaderに接続。DrawingOrderは後期script定義のため生成時に注入。四つの本体と共有履歴readerの元処理との一致を確認し、classic script／構文／E2E読込一覧を更新。app.jsは8,746→8,658行（88行減、今回の合計2,400行減）。構文452ファイル・単体1,241件・関連E2E157件成功（exit 0、2.3分）。ログはcad-drawing-order-test-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、既存drawing-order／unified-ui／hatching／blocksのE2Eで実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

HatchのネストBlock投影fixture／状態照会とコピー・貼付け／Block化の検証手順を、既存HatchTestDriver.createProjection／createTransferへ分離。独立した生成入口により、転送に投影の型・描画依存を持ち込まない。現在scopeの再照会と元Hatch／境界Lineの参照を保持し、定義追加・projection cache無効化・UI／fit／draw・既存Clipboard／Block操作の順を維持する。元の三つの本体との一致を確認し、既存API名と結果を直接接続。app.jsは8,804→8,746行（58行減、今回の合計2,312行減）。構文451ファイル・単体1,241件・関連E2E163件成功（exit 0、2.4分）。ログはcad-hatch-projection-transfer-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、全利用箇所のhatching／sketch-moveとunified-ui／blocksの既存E2Eで実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Hatchの通常／穴付き領域fixture、状態照会、表示倍率、境界破損／復旧の六つのテスト支援APIをHatchTestDriver（src/testing/hatch_test_driver.js）へ分離。test query時だけ生成し、既存API名／戻り値を直接接続する。現在scope・modeを呼出し時に照会し、モデル／ID／cache／履歴／表示／保存の状態は既存所有者へ委譲する。元の六つの本体との一致、fixture座標・Hatch ID／nextIndex・Construction・scope照会・UI／draw順を確認。classic script／構文／E2Eの読込一覧を更新。app.jsは8,884→8,804行（80行減、今回の合計2,254行減）。構文451ファイル・単体1,241件・利用するE2E全10ファイルの180件成功（exit 0、2.7分）。ログはcad-hatch-test-driver-{check,unit,e2e}.log。新しい単体テストは追加せず、既存E2EでDriverの実利用を検証。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Parameterダイアログの適用後の履歴・結果案内・scope再読込・error表示・UI／drawの進行を既存ParameterDialogController.createApplicationへ分離。ParameterApplicationはモデル適用・安定化・Block伝播・checkpoint回復の所有を維持する。成功callback内の表示例外も既存の復元範囲に含め、成功／失敗の順序・捕捉したsession.key・error変換二回を保持する。元本体との一致と4つの境界テスト（実ParameterApplicationによるcallback例外回復を含む）を確認。app.jsは8,900→8,884行（16行減、今回の合計2,174行減）。構文450ファイル・単体1,241件・関連E2E152件成功（exit 0、2.3分）。E2Eの実対象はparameter-dialog-controller／unified-ui／blocks／sketch-permissionsの4ファイルで、指定したparameter-dialog-draft.spec.jsは存在せず追加対象になっていない。ログはcad-parameter-dialog-application-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法配置中の対象変更候補の照会と強調表示更新を既存ConstraintCommandInput.createRetargetHoverへ分離。pendingとCanvasHoverは既存所有者に保持し、8つの明示した依存でoperandのhit・同一判定・意図解決・参照対象変換を接続する。単独operand・line-length／radius／diameter限定、他hoverの保持、対象外配置の限定解除、更新順序と参照／changed戻り値を維持する。元本体との一致と4つの境界テストを確認。app.jsは8,930→8,900行（30行減、今回の合計2,158行減）。構文449ファイル・単体1,237件・関連E2E181件成功（exit 0、2.6分）。ログはcad-dimension-retarget-hover-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasメニューのcommand取消可否と順次取消をCanvasCommandCancellationへ分離。mode・pending・拘束・作図operationをその時点で照会し、Block配置→pending→拘束→作図取消→tool終了を既存所有者へ委譲する。Blockのpanel保持reset／preview解除／mode／Properties復元／案内、最後の共通案内→UI→draw、無対象時の無変更、query短絡順を維持する。Escの優先取消とは統一しない。状態／rollback／履歴を複製せず、元処理との本体一致と4つの境界テストでlive再照会・順序を確認。classic script・構文・単体・E2E読込一覧を更新。app.jsは8,959→8,930行（29行減、今回の合計2,128行減）。構文448ファイル・単体1,233件・関連E2E205件成功（exit 0、3.0分）。ログはcad-canvas-command-cancellation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Canvasのサイズ調整とPropertiesパネル開閉の表示構成をCanvasWorkspaceLayoutへ分離。bitmap同期・viewport中心保持・Tree幅適用・draw・値入力位置同期を既存所有者へ明示したportで接続する。中心はDOM更新前に取得し、pendingはdraw後に読む。空領域／中心指定なしのviewport維持、必要DOMなしの無変更、現在言語のARIA／titleを保持する。Treeと値入力の後期生成は遅延callbackで接続する。元処理との本体一致と4つの境界テストを確認し、classic script・構文・単体・E2E読込一覧を更新。app.jsは8,984→8,959行（25行減、今回の合計2,099行減）。構文446ファイル・単体1,229件・関連E2E147件成功（exit 0、2.2分）。ログはcad-workspace-layout-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Hatch／Reference Imageの内部領域hitを既存GeometryHitQuery.createRegionsへ集約。現在scope・通常選択mode・可視性・作図先とHatch列／owner順・既存幾何照会を明示する。Hatchのowner描画順と同順位の安定順、画像の配列逆順・回転／scale変換と辺を含むpixel矩形判定、activeOnlyの既定値、画像lockをhitで除外しない動作を保持する。元処理との本体一致と3つの境界テストで参照・順序・資格・変換を確認。app.jsは9,004→8,984行（20行減、今回の合計2,074行減）。構文444ファイル・単体1,225件・関連E2E197件成功（exit 0、2.8分）。ログはcad-region-hit-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

寸法ラベル／寸法線のCanvas hitを既存GeometryHitQuery.createDimensionsへ集約。scope・倍率・mode・Sketch資格／可視性とtarget／dimension・外観／layout／text metrics／式flagを明示し、操作状態や寸法値を更新しない。拘束配列逆順、activeOnly既定値、各照会の順序・回数、回転／複数行／world-sizeラベル、ラベル優先、結果の参照同一性を保持。矩形判定の初期化時static参照は既存script順では未定義となるため、生成時の明示portに修正した。元処理との本体一致と3つの境界テストを確認。app.jsは9,030→9,004行（26行減、今回の合計2,054行減）。構文444ファイル・単体1,222件・関連E2E181件成功（exit 0、2.6分）。ログはcad-dimension-hit-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Block／派生インスタンスの全体hit・bundle hit・派生drag用部分Geometry hitを既存GeometryHitQuery.createInstancesへ集約。現在scope・倍率・投影bundle・可視性／操作資格・Annotation bounds・Hatch照会を明示し、Selection／mode／モデルを変更しない。BlockのGeometry→Annotation→Hatchと派生bundleのHatch優先の差、全体hitの描画順、dragの点→円弧端点→線→円→円弧→Splineと種別内逆順／end優先を保持する。元処理との本体一致と3境界テストで所有者・参照・順序・資格・現在倍率を確認。app.jsは9,101→9,030行（71行減、今回の合計2,028行減）。構文444ファイル・単体1,219件・関連E2E216件成功（exit 0、4.8分、ドラッグ回帰1.8分）。ログはcad-instance-hit-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Reference Imageの可視対象収集とoverlay候補・selected flag・較正点の表示構成を既存ReferenceImageRenderer.createLayerへ集約。resource rendererを受け取りcache／ready／clearとpaintを共有し、現在画像・hover・較正点の照会を明示する。inspection→単一選択→hover、候補拒否後のfallbackなし、active Sketch／inspectionの資格、画像参照と順序、overlayがなくても較正点を描く動作を保持。元処理との本体一致と3つの境界テストで確認。app.jsは9,110→9,101行（9行減、今回の合計1,957行減）。構文444ファイル・単体1,216件・関連E2E141件成功（exit 0、2.1分）。ログはcad-image-layer-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Hatch境界のGeometry収集・除外幅・解決済みloop距離・選択可能な内部点の4照会を既存HatchGeometryQueryへ集約。boundaryGeometryを再利用し、既定線幅と現在倍率を数値照会callbackとして明示する。直接／Block投影の所有者と参照、派生投影のoverlay対象なし、有限線幅の最大値／fallback、閉じる辺・穴を含む距離、厳密な大なりの選択判定を保持する。元処理との本体一致と3つの境界テストで確認。app.jsは9,151→9,110行（41行減、今回の合計1,948行減）。初回関連E2Eは既存drawingOrderStateForTestへの除外幅照会接続漏れで2件失敗し、接続を修正した。修正後に構文444ファイル・単体1,213件・同じ関連E2E179件が成功（exit 0、2.6分）。ログはcad-hatch-boundary-query-{check,unit}.logとcad-hatch-boundary-query-fixed-e2e.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Hatchの表示レイヤーを既存HatchRenderer.createLayerへ集約。解決済み領域paint→型別境界overlay、直接／Block／派生とinspection／operandの選択強調、owner別hover、作成／修復のregionと現在preview、PNG中の強調／preview抑制を担当する。幾何照会・cache・編集状態の更新は持ち込まず、read callbackと描画painterを明示する。HatchCommandは遅延参照し、appのhoisted入口は早期接続用に保持する。元処理との本体一致を、明示した状態読取と型順painter変換を除いて確認。描画順序・参照同一性・選択／hover・非表示Sketch・live preview・export抑制の3境界テストを追加。app.jsは9,176→9,151行（25行減、今回の合計1,907行減）。構文444ファイル・単体1,210件・関連E2E179件成功（exit 0、2.6分）。ログはcad-hatch-layer-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

Splineのコピー／貼付け／Block投影テストシナリオをSplineTestDriver.createTransferへ分離。初期化／拘束Driverの依存を増やさず用途別に生成し、採番・定義追加・Workspace照会・Clipboard・Blockの既存入口を明示する。現在scopeは必要な時点で取得し、貼付けや復元前の配列を捕捉しない。テストfixtureのLeader／instanceと操作順序、参照、観測結果は元処理と一致する。機能実装やcache・sequence・rollbackをDriverへ複製しない。app.jsは9,227→9,176行（51行減、今回の合計1,882行減）。構文444ファイル・単体1,207件・関連E2E131件成功（exit 0、1.9分）。コピーされたSpline／LeaderのID、Block定義・投影と保存読込を既存E2Eで確認した。ログはcad-spline-transfer-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。Spline用の五つのテストAPIは機能別の支援モジュールへ移行済み。

### 前回の区切り

Splineの拘束テストシナリオを既存SplineTestDriverへ集約。対象Splineの読取り、幾何評価と型constructor、Geometry生成・拘束登録・求解・直列化を明示し、IDやSolver状態をDriverに所有させない。閉Spline／対象なしの無変更と、PointOnSpline→接線Line→SplineLineTangent→求解→直列化の順序・参照を維持する。元処理との本体一致と、appの変更が接続に限られることを確認した。app.jsは9,246→9,227行（19行減、今回の合計1,831行減）。構文444ファイル・単体1,207件・関連E2E131件成功（exit 0、1.9分）。ログはcad-spline-constraint-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。次は転送シナリオのClipboard／Block操作と採番の境界を確認し、既存Driverへの注入が過大になる場合は用途別の生成入口を検討する。

### 前回の区切り

Splineのブラウザテスト用初期化・状態照会・Hatchキャッシュ確認をSplineTestDriverへ分離。src/testing/はテストの準備と観測を担い、通常の編集や診断計測の所有者と区別する。必要な操作・照会を明示して受け取り、test指定時だけ生成する。既存3 API名、実行順序、Geometryの参照同一性を維持。転送／拘束シナリオは依存を確認するためappに保持する。app.jsは9,290→9,246行（44行減、今回の合計1,812行減）。構文444ファイル・単体1,207件・関連E2E131件成功（exit 0、1.9分）。ログはcad-spline-driver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

CanvasRenderProbeへCanvasの描画観測を集約した。Geometry IDラベル、拘束端点／Point／Arc端点のマーカー数、指定Pointの外観、寸法ラベルと式マークの7入口を明示したcontext・Geometry照会・描画callbackだけで実行し、model／Selection／DOM／履歴を持ち込まない。contextメソッドを計測中だけ差し替え、例外時を含め元の関数へ復元する。式マークの記録状態もProbe内へ移し、appの可変capture変数を廃止した。既存テストAPI名は各入口への直接接続で維持する。7処理の本体は記録状態の名称と所有先以外元処理と一致し、元メソッドのreceiver／引数／戻り値、例外復元、Object同一性、ネスト終了時の既存clear動作を境界テストで確認した。app.jsは9,402→9,290行（112行減、今回の合計1,768行減）。構文443ファイル・単体1,207件・関連E2E143件成功（exit 0、2.1分）。ログはcad-canvas-probe-{check,unit,e2e}.log。今回の変更では全E2Eを再実行していない。前区切りc5e049dの全E2E551件成功（24.2分）を、今回の変更後の全体検証と扱わない。全体目標は未完了。巨大なテスト用contextを別ファイルへ移さず、残る診断／シナリオAPIを機能単位で整理する。

### 前回の区切り

PendingCommandSessionへ共有の保留操作Objectの保持・読取り・置換・通知なしクリアと取消経路を集約した。appの可変pendingCommandを廃止し、各commandのgetPending／setPendingへSessionのread／replaceを接続する。Objectを複製せずbuffer／pointerの直接更新を保持する。取消ではInstance配置解除→注記／PNG専用command委譲またはOffset選択／pointer解除→pending解除→入力非表示→hint→Toolbar→拘束ボタン→drawの既存順序を維持する。PNG busyの拒否は強制クリアせず、Document初期化／Sketch切替／削除の直接clearを取消と混同しない。app全体の変更はSession接続と取消委譲だけであること、取消本体は明示した依存port以外元処理と一致することを照合した。初期化前の入力表示参照を遅延callbackへ修正し、修正版の起動確認と全検証が成功した。app.jsは9,412→9,402行（10行減、今回の合計1,656行減）。構文441ファイル・単体1,201件・全E2E551件成功（exit 0、24.2分、拘束ドラッグ回帰12.4分）。ログはcad-pending-session-{check,unit}.logとcad-pending-session-full-e2e.log。現在の作業branch全体をこの状態で検証しており、旧checkpointの成功件数を流用していない。全体目標は未完了。残る共有mode、command生成・接続、テスト用APIの機能ごとの境界は今後の対象とする。

### 前回の区切り

既存寸法の編集開始をDimensionValueCommand.startEditへ、線長寸法のダブルクリック入力開始をDimensionPlacementCommand.targetDoubleClickへ集約した。新規ファイルは増やさず、既存commandへ開始入口を揃える。権限拒否の処理済み返却、hit／target検査、読取専用ではpendingを置換しない動作、保存配置／hit配置／既定値の優先順位、式の数値fallback、選択とdrag解除→hint→draw→focusを維持する。ダブルクリックでは単独Lineとhit一致を確認し、配置開始後だけ既定位置から値入力へ進む。2処理の本体は明示した依存adapter以外元処理と一致。app.jsは9,444→9,412行（32行減、今回の合計1,646行減）。構文439ファイル・単体1,195件・関連E2E180件成功（exit 0、2.5分）。ログはcad-dimension-entry-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。選択／drag解除のportと共有pendingの取得・反映、依存の多いcommandの生成・接続はappに残り、今後の状態所有と組立て境界の整理対象とする。

### 前回の区切り

ConstraintControlsViewへ拘束ボタン／メニュー／Fixボタンのactive・ARIAとhint title反映を分離し、ConstraintSelectionQueryへFix一括対象・全対象の固定状態・操作可否の照会を集約した。Geometry mode外の短絡、保留寸法確認→拘束ボタン→メニュー→Fix→hintの順序、メニューがFix更新前の属性を読む既存動作を保持する。appは寸法取消条件と操作を接続し、Viewはmodel・Selectionやpendingを変更しない。元の対象照会・固定判定・可否式・DOM更新順序との一致を確認した。app.jsは9,508→9,444行（64行減、今回の合計1,614行減）。構文439ファイル・単体1,189件成功。関連E2E151件（2.2分）とFix専用4件（4.3秒）が成功（いずれもexit 0、合計155件）。ログはcad-constraint-controls-{check,unit,e2e}.logとcad-constraint-controls-fixed-e2e.log。全E2Eはこの単位では未実行。全体目標は未完了。共有pendingと残る寸法編集／取消入口、command生成・接続の整理は続く。

### 前回の区切り

選択可視性の対象収集と全対象の非表示判定をPropertySelectionへ、変更／履歴／UI更新をSelectionVisibilityCommandへ分離した。Properties対象の優先順位と混同せず、inspection／Root／作図Sketch／Block投影の除外、寸法の同一参照による重複除去、Instanceの明示上書き／実効外観／空bundleの継承判定を保持する。通常対象の一括変更→派生Instance上書き→一回の履歴の順序と既存の中間drawを維持する。3処理の本体は依存先と名称以外元処理と一致。コマンド生成を外観依存の初期化後へ配置し、E2Eで検出した起動時参照エラーを解消した。app.jsは9,548→9,508行（40行減、今回の合計1,550行減）。構文437ファイル・単体1,181件・関連E2E168件成功（exit 0、2.4分）。ログはcad-selection-visibility-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。appは3つのhoisted入口と明示した生成／接続を保持する。

### 前回の区切り

ToolbarViewへToolbarのactive／ARIA／disabledと選択可視性の反映を分離。操作は表示値だけを渡し、可視性と編集可否は既存照会へ委譲する。ボタン反映→履歴→可視性→Flyout→カーソル、DOMがない場合と権限の短絡評価、Flyout後の最新操作状態の読取りを維持する。appは生成／接続とhoisted updateToolbar入口を保持。app.jsは9,590→9,548行（42行減、今回の合計1,510行減）。構文435ファイル・単体1,174件・関連E2E186件成功（exit 0、2.6分）。ログはcad-toolbar-view-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。選択可視性の対象照会／判断／変更、共有pendingとmode、操作commandの組立て整理は残る。

### 前回の区切り

ConstraintSelectionQueryへ現在Selection／対象sessionからの拘束意図と実行／完了可否を集約。対象session→Spline対象変換→通常Selectionの優先、Geometry modeの適用範囲、command中の線長寸法の追加対象待ちを維持する。Selection・対象session・候補・意図照会を明示し、状態更新とUIを持ち込まない。6処理の本体は明示した所有者以外元処理と一致し、不要となったappの候補／subject変換の分解代入も撤去。app.jsは9,627→9,590行（37行減、今回の合計1,468行減）。構文433ファイル・単体1,168件・関連E2E171件成功（exit 0、2.4分）。ログはcad-constraint-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。共有pending・modeと、注入依存の多い操作commandの組立て整理は残る。

### 前回の区切り

ConstraintCommitCommandへ読取寸法の登録、解決済み意図の配置／通常／参照commit振分け、寸法生成後の式設定と確定を集約。重複寸法は復元後に同じcommand内の登録へ進み、appへの戻り依存を撤去した。3処理の本体は元処理と一致し、測定値とdisabled flag、Selection→分析→UI→draw→案内／log→履歴、通常expression／参照省略、意図による既存の追加履歴を維持する。app.jsは9,665→9,627行（38行減、今回の合計1,431行減）。構文431ファイル・単体1,162件・関連E2E171件成功（exit 0、2.4分）。ログはcad-constraint-registration-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。新規moduleは増やさず既存確定所有者へ統合し、生成・配置・現在Selection・共有sessionの接続整理は残る。

### 前回の区切り

未使用のhandleConstraintTargetClickを撤去し、拘束Canvas入力を既存ConstraintCommandInput→ConstraintTargetCommand→ConstraintTargetSessionの経路へ揃えた。Selectionから対象を作る処理はConstraintOperands.fromSelection、解決済み対象のCanvas選択反映はCanvasSelection.applyConstraintTargetsへ集約し、appには現在operand／Selection／pointerを渡す接続を保持。対象順序、円弧端点の重複除外、Spline最近点のfallbackとsampling、参照同一性、解除する選択範囲を維持する。変換本体は明示した入力以外元処理と一致。app.jsは9,822→9,665行（157行減、今回の合計1,393行減）。構文431ファイル・単体1,157件・関連E2E171件成功（exit 0、2.4分）。ログはcad-constraint-selection-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。未使用APIの削除を広げず、既存CanvasSelectionの公開helperとダブルクリック経路は保持する。

### 前回の区切り

ConstraintSolvePreparationへ円弧端点・Offset／OffsetChainの幾何前処理、求解ステップ幅の算定と一時変更／復元を分離。型・幾何照会・半径寸法保護・最小長さ・OffsetChain計画を明示し、UI・Selection・Document配列・履歴を持ち込まない。処理本体は元処理と一致。角度の周回、既存Geometryと点の参照、半径寸法保護、finallyでの数値設定復元を境界テストで確認。app.jsは9,954→9,822行（132行減、今回の合計1,236行減）。構文431ファイル・単体1,154件成功。関連E2E186件成功（exit 0、14.9分、うち拘束ドラッグ回帰12.5分）。ログはcad-solve-preparation-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。appの3つのhoisted入口は早期接続用で、snapshot／求解実行／失敗復元は既存commandが所有する。

### 前回の区切り

ConstraintIntentResolverへ通常／参照／対称／Splineの意図解決と下位判定を集約。候補生成はConstraintCandidates、対象変換はConstraintOperandsへ委譲し、対象列を入力として配置／commit意図または拒否理由を返す。Selection・session・pending・モデル配列・UI／履歴を直接変更しない。子孫／複数Sketch／参照対象数／権限／循環／Spline端点の判定順序と参照同一性を保持し、処理本体は元処理と一致。app.jsは10,069→9,954行（115行減、今回の合計1,104行減）。構文429ファイル・単体1,148件・関連E2E171件成功（exit 0、2.4分）。ログはcad-intent-resolver-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。現在Selectionの取得adapterと操作の進行、command組立ての依存整理は残る。

### 前回の区切り

DimensionPlacementCommandへ選択／半径・直径／解決済み意図からの配置開始、追加対象による再解決、値入力または読取登録への進行を分離。既存の配置計算・読取判定・対象sessionへ委譲し、開始経路ごとのdraft解除／mode変更と初期pointerの違い、draw後のfocus、retarget後のpending更新順序を維持する。5処理の本体は明示した依存adapter以外元処理と一致。app.jsは10,203→10,069行（134行減、今回の合計989行減）。構文427ファイル・単体1,141件・関連E2E165件成功（exit 0、2.3分）。ログはcad-dimension-placement-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。共有pendingCommandは他種別と分離しておらず、appのget／set adapterが残る。操作依存も多いため、session／入力表示の所有を整理する際に組立て境界を再確認する。

### 前回の区切り

DimensionReadOnlyQueryへ寸法配置候補の読取判定を分離し、ConstraintRedundancyへ候補の一時追加／解析／除去を集約。明示測定→単一Block→owner／参照付与→重複probeの順序と、候補Object・残存拘束の同一性、配列置換と表示診断を更新しない契約を維持する。appは生成／接続とhoisted入口を保持。app.jsは10,210→10,203行（7行減、今回の合計855行減）。行数以上に、一時モデル書込みの所有者とUIを持たない判定境界を揃える単位。構文425ファイル・単体1,135件・関連E2E165件成功（exit 0、2.3分）。ログはcad-readonly-query-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

DimensionConstraintFactoryへ寸法拘束の種類選択・生成と角度単位／接頭辞の適用を分離。型constructorと平行判定を明示して注入し、Document・UI・操作状態を持ち込まない。平行線拒否の案内とsilent制御は呼出側へ保持し、参照同一性と寸法displayの複製範囲を維持する。対象要素の照会は既存DimensionQueriesへ集約。app.jsは10,252→10,210行（42行減、今回の合計848行減）。構文423ファイル・単体1,130件・関連E2E165件成功（exit 0、2.3分）。ログはcad-dimension-factory-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintCommitCommandへ通常／参照拘束の追加とsnapshot・前処理・求解・Parameter安定化・退化／重複判定・失敗復元・成功後の分析／UI／履歴を分離。参照metadata入口、重複寸法の読取変換、通常拒否undefined／参照拒否false、成功後の性能記録の順序も保持。元処理本体は時計／性能記録port以外一致。app.jsは10,368→10,252行（116行減、今回の合計806行減）。構文421ファイル・単体1,125件・関連E2E166件成功（exit 0、2.4分）。ログはcad-constraint-commit-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。依存は明示したが多く、後続の組立て整理でcheckpoint・Solver・Parameter・UIの境界を再確認する。

### 前回の区切り

ConstraintTargetCommandへ拘束候補clickのAnnotation委譲・固定切替・対象追加・意図の配置／commit振分けを集約。hit／受入／sessionの所有者を接続し、固定後のcommand参照復元と拒否／エラー／未完了の表示順序を維持。処理本体は明示したsession依存以外元処理と一致。app.jsは10,432→10,368行（64行減、今回の合計690行減）。構文419ファイル・単体1,119件・関連E2E166件成功（exit 0、2.3分）。ログはcad-constraint-click-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。依存の増えたcommandは、残るcommit／寸法配置の所有を整理する際に境界と引数数を再確認する。

### 前回の区切り

OperandHitQueryへ拘束候補の通常hit・対称段階の優先・円弧端点・Spline parameterと投影／参照へのfallbackを集約。現在operand列と既知hitを明示し、各providerの評価順序とnullish再照会を維持する。照会本体は明示したoperand引数以外元処理と一致。app.jsは10,463→10,432行（31行減、今回の合計626行減）。構文419ファイル・単体1,113件・関連E2E166件成功（exit 0、2.3分）。ログはcad-constraint-hit-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintTargetCommandへ対象選択の開始・取消・確定要求と線長寸法完了を分離。Annotation委譲・権限・作図準備・同種toggle取消・session開始と選択整理・意図の配置／確定、取消時のUI更新とblurの順序を保持する。共有mode／作図draftの準備とDOM blurはappの限定adapterへ接続。状態・受入・案内の既存所有者を組み合わせ、Canvas hit／clickと実commitはまだ呼出側に残る。app.jsは10,537→10,463行（74行減、今回の合計595行減）。構文419ファイル・単体1,109件・関連E2E166件成功（exit 0、2.3分）。ログはcad-constraint-command-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintTargetSessionへpending拘束commandと順序付きoperand列の状態所有を集約。begin／append／resetと、commandだけ・operandだけの解除を区別し、appの2変数を撤去。入力・UI・描画・Annotation・診断の照会と更新をsessionへ接続し、受入拒否時の無変更と参照同一性を確認した。確定／取消の操作調整や共有modeは呼出側に残る。app.jsは10,541→10,537行（4行減、今回の合計521行減）。行数より状態更新の入口を揃えることを優先した単位。構文417ファイル・単体1,102件・関連E2E166件成功（exit 0、2.4分）。ログはcad-constraint-session-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintOperandsへ拘束候補の受入判断と次operand列の生成を集約。対称の段階／同種／重複／短線拒否、通常種別制限、再選択時の末尾移動と対象数上限を維持し、入力・Geometry・Selection・操作状態を変更しない。appは成功列を反映してSelection同期する。元処理と728ケースで受入可否・拒否文・結果列が一致。app.jsは10,572→10,541行（31行減、今回の合計517行減）。構文415ファイル・単体1,098件・関連E2E134件成功（exit 0、1.9分）。ログはcad-operand-acceptance-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ConstraintFeedbackへ拘束の対象選択中／拒否時の案内文を集約。種別・operand列・言語を明示し、汎用案内のlabelだけ遅延評価する。DOM・Document・pending sessionを変更しない。日英と対象段階の360ケースで元の処理と一致。Document初期化／Sketch切替／削除はreset対象と順序が異なるため、この単位では汎用resetへまとめず保持する。app.jsは10,641→10,572行（69行減、今回の合計486行減）。構文415ファイル・単体1,093件・関連E2E128件成功（exit 0、1.8分）。ログはcad-constraint-hints-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

SelectionDeletionCommandへ混在Canvas選択の削除調整を分離。Annotation／Hatch／画像→派生Instance→Block→通常図形の既存順序を維持し、GeometryDeletion・GeometryDeletionCommand・ReferenceImageInteractionへ編集を委譲する。通常図形削除が確定した場合の履歴委譲、owner Sketch求解と種別別履歴、途中ガード拒否時の既存の部分削除を境界テストで確認。元の処理本体はscope取得／表示adapter以外一致。app.jsは10,695→10,641行（54行減、今回の合計417行減）。構文415ファイル・単体1,090件・関連E2E223件成功（exit 0、3.2分）。ログはcad-selection-deletion-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

GeometryDeletionへBlock／派生Instanceの投影依存計画と削除適用を統合。投影ObjectとGeometry keyの参照、Block owner拘束、falsy keyの扱い、古いBlock bundleのsplines省略を維持する。計画は非破壊で、適用は拘束→付随注記→対象Instance配列だけを更新する。依存／Parameterガードとcache・選択・求解・履歴は呼出側が既存順序で調整。app.jsは10,711→10,695行（16行減、今回の合計363行減）。構文413ファイル・単体1,084件・関連E2E219件成功（exit 0、3.1分）。ログはcad-instance-deletion-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

GeometryDeletionCommandへプリミティブ／拘束の削除操作を分離。権限・派生参照・Parameter保護の順序、削除適用→Selection／Spline／hover整理→ownerごとの求解→表示→案内／履歴を維持する。共通操作状態の終了・表示・analysis照会を限定したadapterでappへ接続する。求解不成功でも削除を記録する既存挙動を維持し、deleteElements入口はhoisted wrapperとした。app.jsは10,732→10,711行（21行減、今回の合計347行減）。構文413ファイル・単体1,081件・関連E2E147件成功（exit 0、2.1分）。ログはcad-deletion-command-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

GeometryDeletionへ計画の適用を統合し、plan／applyを明示した編集APIとして整理。削除配列の置換と付随注記の除去は同じ所有者へ、選択整理はCanvasSelectionへ集約。Spline編集解除を選択更新の二段階の間に挟む既存順序と、残存図形／拘束のObject同一性を維持する。app.jsは10,745→10,732行（13行減、今回の合計326行減）。構文411ファイル・単体1,076件・関連E2E147件成功（exit 0、2.1分）。ログはcad-deletion-apply-{check,unit,e2e}.log。モデル適用本体は元の処理と照合済み。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

GeometryDeletionPlanへ、共有端点を保持しながら関連する点／図形／拘束を含める削除対象計算を分離。明示したmodelと候補から実オブジェクトの集合を返し、model・入力・Selectionは変更しない。PointUsageと拘束参照判定を注入する。元の計算本体は改行正規化後に機械照合して一致。権限／参照／Parameter保護、操作終了、削除適用、選択、求解・履歴・表示は呼出側へ保持。app.jsは10,796→10,745行（51行減、今回の合計313行減）。構文411ファイル・単体1,074件・関連E2E147件成功（exit 0、2.1分）。ログはcad-deletion-plan-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardCommandへコピー／切取り／貼付けのガード、実行順序、成功案内と失敗復元の調整を分離。モデル構築、session、checkpoint、Selectionの各所有者へ委譲し、appは現在scope・作成権限・mode・求解／履歴・表示同期との接続を保持する。既存の早期接続のため入口はhoisted wrapperを維持。app.jsは10,844→10,796行（48行減、今回の合計262行減）。構文409ファイル・単体1,070件・関連E2E201件成功（exit 0、2.6分）。ログはcad-clipboard-command-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardGraphへ貼付けるモデルの構築順序を集約。Geometry／Transfer／Parameterの既存所有者を7つの限定した依存で接続し、UI・session・checkpoint・求解・履歴を持ち込まない。生成結果と参照Mapを返し、構築失敗は操作側へ伝える。app.jsは10,889→10,844行（45行減）。構文407ファイル・単体1,064件・関連E2E201件成功（exit 0、2.6分）。ログはcad-clipboard-graph-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardGeometryへ派生InstanceのID予約・生成経路再接続・名前空間参照検査・正規化と追加を集約。生成後の投影参照登録はClipboardTransferに残し、順序を保つ。app.jsは10,901→10,889行（12行減）。構文405ファイル・単体1,062件・関連E2E197件成功（exit 0、2.5分）。ログはcad-clipboard-derived-build-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardGeometryへBlock Instanceの定義確認・生成・配置・ID対応表更新を集約。採番adapter以外の本体は元コードと機械照合して一致。投影cache／再接続と失敗復元は呼出側へ保持。app.jsは10,917→10,901行（16行減）。構文405ファイル・単体1,060件・関連E2E167件成功（exit 0、2.2分）。ログはcad-clipboard-blocks-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardSessionへコピー内容・cut保持・要素数・貼付け位置／回数の状態所有を分離。コピー通知→切取り削除、失敗時のpayload保持、求解前の回数更新を維持。診断hookの代入と消去もsession APIへ接続。app.jsは10,923→10,917行（6行減）。構文405ファイル・単体1,058件・関連E2E171件成功（exit 0、2.2分）。ログはcad-clipboard-session-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

CanvasSelectionへ貼付け後の生成IDと実オブジェクトによる選択復元を集約。種別フィルタと注記／Hatchの選択ID限定、Instance／画像全体選択を維持。呼出側で先に選択関連UIを解除する。app.jsは10,930→10,923行（7行減）。構文403ファイル・単体1,054件・関連E2E171件成功（exit 0、2.2分）。ログはcad-clipboard-selection-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardTransferへ派生Instanceの原点調整・bundle検査・参照Map登録を集約。scope／配列／cacheの所有を持ち込まず、必要な参照照会だけを注入。元の反復順序と上限を機械照合して維持。app.jsは10,952→10,930行（22行減）。構文403ファイル・単体1,052件・関連E2E197件成功（exit 0、2.5分）。ログはcad-clipboard-derived-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ParameterNamespaceへコピー寸法／注記の名前予約と式の付替えを集約。同一名前空間での切取り名保持、衝突回避、別名前空間での現在値化、角度の度換算、読取専用の除外を維持。appはscope選択と拘束復元・追加を調整する。app.jsは10,983→10,952行（31行減）。構文403ファイル・単体1,049件・関連E2E167件成功（exit 0、2.2分）。ログはcad-clipboard-symbols-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardTransferへ注記・塗りつぶし・参照画像の貼付け値変換を統合。serializeした注記・画像だけを移動し、塗りつぶしの参照不足はnullで呼出側へ返す。ID発行・配列追加・UI例外・履歴は操作側に残す。app.jsは10,995→10,983行（12行減）。構文403ファイル・単体1,046件・関連E2E186件成功（exit 0、2.4分）。ログはcad-clipboard-elements-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardPasteCheckpointへ貼付け直前の配列長・採番・modelカウンタの保持と復元を分離。明示したscopeを保持し既存Objectを複製せず、復元対象と順序を維持する。採番変数へのadapterはappに残る。app.jsは11,014→10,995行（19行減）。構文403ファイル・単体1,043件・関連E2E167件成功（exit 0、2.2分）。ログはcad-clipboard-checkpoint-{check,unit,e2e}.log。全E2Eはこの単位では未実行。全体目標は未完了。

### 前回の区切り

ClipboardGeometryへコピーしたプリミティブの生成・指定Sketchへの追加・IDと参照Mapの構築を分離。GeometryCreationの最小長／円弧正規化を注入し、Selection・履歴・pasteCount・失敗復元を持ち込まない。生成処理本体は元コードと機械照合して一致。app.jsは11,058→11,014行（44行減）。構文401ファイル・単体1,040件・関連E2E167件成功（exit 0、2.2分）。ログはcad-clipboard-geometry-{check,unit,e2e}.log。全E2Eは今回未実行。週枠残量70%未満で停止する最新指示へ方針書を更新。全体目標は未完了。

## 前回の停止地点（2026-10-10）

停止・リリース検証：コード05eecd3をdevelopへ統合し、構文390ファイル・単体992件・全E2E441件成功（exit 0、23.1分）。ログは一時ディレクトリのcad-refactor-oct10-final-{check,unit,e2e}.log。週枠残量5%で新規分離を停止し、記録をCommit／Push後、develop先行・main最後で同期して一時停止する。今回2コミットでapp.jsは10,977→10,834行（143行減）。再開時は方針書section 8を参照。全体目標は未完了。

### 最後の分離単位

ClipboardPayloadへscope・Selectionからの依存要素収集、参照不足の検出、対象内拘束の選別、コピー値生成を分離。生成値／エラーを返しUIとClipboard sessionを書き換えない。app.jsは10,940→10,834行（106行減）。構文390ファイル・単体992件・関連E2E140件成功（exit 0、1.8分）。ログはcad-clipboard-payload-{check,unit,e2e}.log。この分離単位の時点では全体E2E未実行（最終検証は上記）。全体目標は未完了。

### 前回の区切り

最新develop 3fc42beからcodex/clipboard-transferで再開。停止条件は週枠が尽きる前へ更新（最終検証・統合の余裕を残す）。ClipboardTransferへID再帰置換・拘束座標移動・Block投影再接続を分離し、貼付けsessionとデータ変換を分けた。元の3関数と処理本体が一致することを機械照合。app.jsは10,977→10,940行（37行減）。構文389ファイル・単体989件・関連E2E140件成功（exit 0、1.8分）。ログはcad-clipboard-transfer-{check,unit,e2e}.log。この分離単位の時点では全体E2E未実行（最終検証は上記）。全体目標は未完了。

## 前回の停止地点（2026-10-08）

停止・リリース検証：コードa936cc2をdevelopへ統合し、構文387ファイル・単体955件・全E2E413件成功（exit 0、全E2E21.2分）。全E2Eログはcad-refactor-oct8-final-e2e.log。今回の再開15コミットでapp.jsは11,403→10,782行（621行減）。週枠残量49%で新規分離を停止済み。この検証記録を最後にCommitし、develop先行・main最後でPush／同期して目標を一時停止する。再開はrefactoring-policy-and-resume.mdのsection 8に従う。全体目標は未完了。

### 最後の分離単位

ParameterNamespaceへ記号削除時の依存照会を統合。削除対象からの記号抽出・同時削除式の除外・名前空間選択を既存依存解析へ集約し、UIガードを分離。app.jsは10,785行から10,782行へ縮小（3行減）。構文387ファイル・単体955件・関連E2E105件成功（exit 0、1.5分）。追加fixtureの記号参照を既存の引用符付き式へ修正して検証済み。ログはcad-symbol-delete-{check,unit,e2e}.log。週枠残量49%を確認し新規分離を停止。今回の再開全体では11,403行から621行減。全E2Eとdevelop→mainの最終反映・同期はこれから行う。全体目標は未完了。

### 前回の区切り

AnnotationParameterCommandへ注記Parameterの切替・名称・式変更とガード・求解・失敗復元・履歴確定を分離。checkpointとnamespaceの所有は既存moduleへ残す。app.jsは10,801行から10,785行へ縮小（16行減）。構文387ファイル・単体952件・関連E2E105件成功（exit 0、1.4分）。ログはcad-annotation-parameter-{check,unit,e2e}.log。週枠残量51%で継続。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

GeometryAppearanceQueryへ幾何外観継承・Sketch外観・可視性の照会を分離。Document／Sketch／Block／派生投影の優先順と参照を維持し、キャッシュ期間はGeometryReadModelが所有する。app.jsは10,850行から10,801行へ縮小（49行減）。構文386ファイル・単体948件・関連E2E141件成功（exit 0、1.9分）。ログはcad-appearance-query-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

ConstraintFeedbackへ求解案内・拘束状態ラベル・集計文面を分離。結果と件数を明示入力にし、Solver／解析状態／DOMを参照しない。既存の成功・警告・失敗の条件と日英文面を維持。app.jsは10,896行から10,850行へ縮小（46行減）。構文385ファイル・単体945件・関連E2E104件成功（exit 0、1.4分）。ログはcad-feedback-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

ConstraintOperandsへ拘束対象の生成・参照target／subject変換・同一性判定を分離。Sketch関係の照会を注入し、幾何参照・Spline位置・Arc端点を保持。8関数の本体が旧実装と一致することを機械照合。app.jsは10,959行から10,896行へ縮小（63行減、抽出跡の空行整理を含む）。構文384ファイル・単体942件・関連E2E118件成功（exit 0、1.6分）。ログはcad-operands-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

DimensionPlacementへ寸法の既定配置・旧配置補正を統合。対象と配置を引数とし、拘束列挙・書戻しだけappに残す。角度ラベル移行順、axis、offset、既存相対配置の参照同一性を維持。app.jsは10,976行から10,959行へ縮小（17行減）。構文383ファイル・単体939件・関連E2E126件成功（exit 0、1.7分）。ログはcad-dimension-normalize-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

BlockStateへBlock定義・Sketch所属・親子所有・scope配置の正規化を分離。BlockCatalog／SketchContextの限定した照会と補完を注入し、編集コンテナはIDで渡す。旧処理本体との機械照合で依存置換以外の一致を確認。app.jsは11,119行から10,976行へ縮小（143行減）。構文383ファイル・単体936件・関連E2E159件成功（exit 0、2.1分）。ログはcad-block-state-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

DocumentStateへDocument／Block scopeの外観正規化を統合。旧Root外観の引継ぎ先をblockEditingの明示引数にし、編集session依存を除去。補助要素の所属補完と幾何参照保持を維持。app.jsは11,149行から11,119行へ縮小（30行減）。構文382ファイル・単体932件・関連E2E157件成功（exit 0、2.1分）。ログはcad-appearance-state-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

DocumentApplicationへDocumentの適用順と読込補正結果を分離。decode失敗時に既存モデルを消さない順序、Treeの任意保持、参照・最小線長・寸法・ID・外観・Block・描画順の同期を維持。Tree生成前参照による初回E2E起動失敗を遅延adapterで修正後、構文382ファイル・単体929件・関連E2E151件成功（exit 0、2.3分）。app.jsは11,170行から11,149行へ縮小（21行減）。ログはcad-document-apply-{check,unit,e2e}.log。全体E2Eは今回未実行。週枠残量61%で継続。全体目標は未完了。

### 前回の区切り

HistoryRestorationへDocument／Block履歴の復元手順を分離。現在名・補助作図設定・Tree状態の保持、Block定義clone、投影無効化と再求解順を維持。履歴抑止はHistoryControllerが所有する。app.jsは11,187行から11,170行へ縮小（17行減）。構文381ファイル・単体926件・関連E2E151件成功（exit 0、1.8分）。ログはcad-history-restore-{check,unit,e2e}.log。全体E2Eは今回未実行。全体目標は未完了。

### 前回の区切り

DimensionPersistenceへ寸法保存データへの変換を分離。角度ラベルの移行順序と保存互換値を維持し、配置adapterを明示。app.jsは11,214行から11,187行へ縮小（27行減）。構文380ファイル・単体923件・関連E2E122件成功（exit 0、1.5分）。ログはcad-dimension-codec-{check,unit,e2e}.log。全体E2Eは今回未実行。GitHub障害は前段af5b2aeのPush時に解消し、未反映分もPush済み。全体目標は未完了。

### 前回の区切り

LineCollapseQueryへ拘束後の線の潰れ判定を分離。対象拘束型・snapshot参照・接続成分内のSketch・閾値は維持し、対象Sketchは明示引数とした。app.jsは11,259行から11,214行へ縮小（45行減、隣接空行整理を含む）。構文379ファイル・単体920件・関連E2E121件成功（exit 0、2.0分）。ログはcad-collapse-query-{check,unit,e2e}.log。全体E2Eは今回未実行。GitHubのInternal Server Errorが継続しており、Push完了はリモートrefで確認すること。全体目標は未完了。

### 前回の区切り

CircleCenterCrossCommandへ円中心十字の開始・検証・作成・求解と失敗復元・成功履歴を分離。geometryとcheckpoint／solverの既存所有者へ明示接続する。app.jsは11,335行から11,259行へ縮小（76行減）。構文378ファイル・単体917件・関連E2E109件成功（exit 0、1.3分）。ログはcad-center-cross-{check,unit,e2e}.log。全体E2Eは今回未実行。GitHubのInternal Server Errorにより前段c8fd85aのPushが未完了だったため、今回のcommitと合わせて再試行する。全体目標は未完了。

### 前回の区切り

CenterlineCommand.startへ事前選択付き開始を統合。開始とdraft入力の所有者を揃え、Root拒否・準備失敗時の対象選択移行を維持。app.jsは11,358行から11,335行へ縮小（23行減）。構文377ファイル・単体914件・関連E2E109件成功（exit 0、1.3分）。ログはcad-centerline-start-{check,unit,e2e}.log。全体E2Eは今回未実行。次は円中心十字の作成・求解失敗復元、共通編集・Document適用、描画・入力組立て。全体目標は未完了。

### 前回の区切り

最新develop 71b139bからcodex/sidebar-lifecycleで再開。SidebarControllerへタブ選択・開閉・ラベル同期と入力接続を分離。DOMを既存の状態所有者として維持し、Document依存を持たない。app.jsは11,403行から11,358行へ縮小（45行減）。構文377ファイル・単体912件・関連E2E104件成功（exit 0、1.2分）。ログはcad-sidebar-{check,unit,e2e}.log。全体E2Eは今回未実行。停止条件は週枠残量50%未満。全体目標は未完了。

### 前回の区切り

最新develop 166169aからcodex/rendering-policyで再開。CanvasThemeColorsへテーマ依存の表示色補正・hex解析・contrast計算を分離し、themeは明示引数にした。永続appearance値は変更しない。app.jsは11,271行から11,232行へ縮小（39行減、隣接空行整理を含む）。構文368ファイル・単体882件・関連E2E103件成功（exit 0、1.2分）。ログはcad-theme-colors-{check,unit,e2e}.log。コードcommit a66067dに対し、全E2E369件も成功（exit 0、19.7分、cad-theme-release-e2e.log）。週枠残量39%を確認し、新規分離を停止。develop・mainへ統合して同期後に一時停止する。全体目標は未完了。

### 前回の区切り

ReferenceImageCommandへ画像準備後の現在scopeへの配置・選択・履歴を分離。既存の準備後のSketch／viewport照会タイミングを維持。app.jsは11,288行から11,252行へ縮小（36行減）。今回の再開全体では12,389行から1,137行減。構文367ファイル・単体876件・全E2E367件成功（exit 0、19.8分）。ログはcad-image-command-{check,unit}.logとcad-refactor-final-e2e.log。週枠残量49%を確認して新規抽出を停止し、develop先行・main最後の統合と同期後に一時停止する。再開方針はrefactoring-policy-and-resume.mdのsection 8を参照。全体目標は未完了。

### 前回の区切り

ReferenceImageImportへ参照画像の形式判定・読取・デコード・縮小を分離。Document非依存のprepare APIとし、Sketchへの配置・選択・履歴はappに残す。app.jsは11,325行から11,288行へ縮小（37行減）。構文366ファイル・単体874件・関連E2E103件成功（exit 0、1.2分）。ログはcad-image-import-{check,unit,e2e}.log。全体E2Eは今回未実行。次は画像配置、Document読込適用、描画調整、入力module組立て、pending session、診断の責務。全体目標は未完了。

### 前回の区切り

DocumentFileCommandへFileReader読込・JSON解析・待機前後のBlock編集確認と内容変更検知を統合。appはapplyLoadedDocumentで図面適用・求解・履歴・checkpoint・表示調整を接続し、診断hookも同じ読込APIを利用する。app.jsは11,361行から11,325行へ縮小（36行減）。構文365ファイル・単体871件・関連E2E149件成功（exit 0、1.7分）。ログはcad-file-import-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量53%。次はDocument読込適用、描画調整、入力module組立て、pending session、診断の責務。全体目標は未完了。

### 前回の区切り

DocumentStatusViewへ履歴に基づくDocument保存状態表示、DocumentFileCommandへ実データによるbeforeunload保護を分離。状態所有はDocumentFiles／履歴に維持し、表示と終了保護の判定対象の違いを保持。app.jsは11,386行から11,361行へ縮小（25行減）。構文365ファイル・単体869件・関連E2E112件成功（exit 0、1.3分）。ログはcad-document-status-{check,unit,e2e}.log。全体E2Eは今回未実行。次はDocument読込適用、描画調整、入力module組立て、pending session、診断の責務。全体目標は未完了。

### 前回の区切り

DocumentFileCommandへ保存／別名保存／native・互換入力の読込進行と置換前確認を分離。DocumentFilesの排他・保存先・checkpoint所有を維持し、Document読込適用・求解・履歴初期化はappのimportFileDataへ接続。保存中編集のsnapshot区別と待機後のBlock編集再確認を維持。app.jsは11,557行から11,386行へ縮小（171行減）。構文364ファイル・単体866件・関連E2E118件成功（exit 0、1.3分）。ログはcad-document-file-command-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量56%。次はDocument表示・読込適用、描画調整、入力module組立て、pending session、診断の責務。全体目標は未完了。

### 前回の区切り

RuntimeVersionViewへHelpの実行コミット情報の検証・状態保持・再描画を分離。起動済みデータをloadで受け取り、言語変更はrenderだけを呼ぶ。HTTP／file起動方式は維持。app.jsは11,594行から11,557行へ縮小（37行減）。構文363ファイル・単体862件・関連E2E102件成功（exit 0、1.2分）。ログはcad-runtime-view-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量57%。次は描画用表示方針、入力module組立て、pending session、Document／診断の責務。全体目標は未完了。

### 前回の区切り

KeyboardInteractionController.createCancellationへEsc取消の優先順位を統合。各commandの状態所有を維持し、一度のEscで一操作だけ処理する。配置確定の拒否時にも後続取消へ進まない。app.jsは11,627行から11,594行へ縮小（33行減）。構文362ファイル・単体859件・関連E2E192件成功（exit 0、2.2分）。ログはcad-keyboard-cancel-{check,unit,e2e}.log。全体E2Eは今回未実行。週枠残量57%。次は入力module組立て、pending session、Document／描画／診断の責務。全体目標は未完了。

### 前回の区切り

CanvasInputBindingへCanvasイベント接続・移動flush境界・終了計測・座標表示を分離し、CanvasNavigationへwheel倍率変更を統合。元eventと処理順、pointer中心のworld座標維持、倍率制限、寸法入力同期を保持。app.jsは11,672行から11,627行へ縮小（45行減）。構文検査・単体858件・関連E2E198件成功（exit 0、2.2分）。ログはcad-canvas-binding-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量61%。次は共通取消優先順位、入力module組立て、残るDocument／描画／診断の責務。全体目標は未完了。

### 前回の区切り

ConstructionCommandへ補助作図設定・選択図形切替・ボタン表示照会を分離。選択ありは属性変更と履歴、選択なしは今後の作図設定の変更として独立させ、Document resetとUndo／Redo時の設定維持も同じ所有者へ接続。app.jsは11,711行から11,672行へ縮小（39行減）。構文検査・単体854件・関連E2E133件成功（exit 0、1.5分）。ログはcad-construction-command-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量63%。次は共通取消優先順位、Canvas入力接続と入力module組立て。全体目標は未完了。

### 前回の区切り

FilletCommand.begin／OffsetCommand.beginへ事前選択付き開始を統合。2線からの半径入力と拒否時の打切り、Offsetの初期化後の選択読取り・単独円／線／円弧の引継ぎを維持。DrawOperationLifecycle.prepareは共通初期化だけを担当し、選択と案内はコマンドに残す。app.jsは11,750行から11,711行へ縮小（39行減）。構文検査・単体850件・関連E2E122件成功（exit 0、1.5分）。ログはcad-special-start-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量66%。次はConstruction切替、共通取消優先順位と入力module組立て。全体目標は未完了。

### 前回の区切り

DrawOperationLifecycle.startへToolbarの基本9モード開始を統合。共通の初期化順と案内を集約し、Slotのcenter arc reset、Trimのpreview／Offset候補／限定hover消去を例外として維持。pending値入力やSelectionを追加で消去しない。app.jsは11,881行から11,750行へ縮小（131行減）。構文検査・単体846件・関連E2E198件成功（exit 0、2.6分）。ログはcad-basic-start-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量67%。次はConstruction切替、Fillet／Offsetの事前選択付き開始、共通取消優先順位と入力module組立て。全体目標は未完了。

### 前回の区切り

DrawOperationLifecycleへ通常終了・連続線終了・作図取消・進行中判定を分離。各draftは既存commandが所有し、通常終了のresetと取消のLine／Spline rollback、mode維持と選択復帰の違いを保持。app.jsは11,939行から11,881行へ縮小（58行減）。構文検査・単体843件成功。初回E2EはHatch生成前の直接参照で起動失敗し中断。resetだけを遅延接続して修正し、構文再検査と同範囲E2E198件が成功（exit 0、2.5分）。ログはcad-draw-lifecycle-{check,unit,e2e,e2e-recheck}.log。全体E2Eは今回未実行。開始時週枠残量71%。次はToolbarのモード開始と共通取消優先順位、入力module組立て。全体目標は未完了。

### 前回の区切り

RectangleSelectionQueryへ投影元の矩形照会を統合し、通常選択と線／bbox／曲線sampleの判定を共有。投影元provider・適格性判定を分け、通常選択のactive制限を混入させず候補順・Geometry参照・crossing／包含を維持。app.jsは11,964行から11,939行へ縮小（25行減）。構文検査・単体839件・関連E2E134件成功（exit 0、1.6分）。ログはcad-projection-rect-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量73%。次は共通モード遷移／取消、投影の適格性・投影済み照会、入力module組立て。全体目標は未完了。

### 前回の区切り

SplineCommandへ作成開始と直前点取消の操作案内を統合。既存pending取消とRoot判定の順、各draft／session／gestureの初期化順を維持し、点の復元はSplineDraftへ委譲する。作成開始・入力・確定の責務が同じコマンドへ収束。app.jsは11,983行から11,964行へ縮小（19行減）。構文検査・単体837件・関連E2E107件成功（exit 0、1.3分）。ログはcad-spline-start-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量74%。次は共通モード遷移／取消、投影の読取り照会と入力module組立て。全体目標は未完了。

### 前回の区切り

SplineEditCommandへ既存Splineの編集sessionと開始／終了／reset、通過点追加・削除・求解失敗時の復元を分離。作成用SplineDraftとは分離を維持し、描画・選択・パネル・削除は同じsessionを照会。Geometry参照、共有点削除条件、注記／拘束復元、ID・履歴順を保持。求解・注記等への明示依存は多く、共通編集サービスの整理時に見直す。app.jsは12,100行から11,983行へ縮小（117行減）。構文検査・単体834件・関連E2E155件成功（exit 0、1.9分）。ログはcad-spline-edit-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量76%。次はSpline作成開始／点取消と共通モード遷移、投影の読取り照会。全体目標は未完了。

### 前回の区切り

SketchProjectionCommandへ投影元draftと開始・切替・範囲追加・パネル除去・確定・取消・resetを分離。Document切替やモード終了からも同じresetへ接続し、appからリストへの直接書込みを除去。幾何候補・既存投影判定は読取りportとして残し、Geometry参照・ID・Instance形式・履歴順を維持。app.jsは12,187行から12,100行へ縮小（87行減）。構文検査・単体830件・関連E2E171件成功（exit 0、2.1分）。ログはcad-projection-command-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量78%。次はSpline編集sessionと共通モード遷移、残る投影の読取り照会。全体目標は未完了。

### 前回の区切り

GeometryInstanceCommand.cancelへFree／Mirror／Patternの取消、BlockPlacementCommand.finishOrCancelへanchor未指定時の取消／指定済み時の0度確定を集約。既存の状態所有者と依存だけで処理し、取消時の履歴非追加、Properties復元、配置拒否時のdraft保持を維持。app.jsは12,211行から12,187行へ縮小（24行減）。構文検査・単体826件・関連E2E160件成功（exit 0、2.0分）。ログはcad-command-cancel-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量79%。次はSketch投影／Spline編集sessionと共通モード遷移の状態所有。全体目標は未完了。

### 前回の区切り

KeyboardInteractionControllerへキーボードの受付優先順位と操作APIへの委譲を分離。メニュー／移動の抑止、保存repeat、文字編集対象、履歴・寸法入力・モード終了の順を保持。取消の共通状態更新とSpline点削除後の通知はappの明示actionとして残す。取消本体は分離前と処理内容が一致することを確認。app.jsは12,285行から12,211行へ縮小（74行減）。構文検査・単体822件・関連E2E198件成功（exit 0、2.4分）。ログはcad-keyboard-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量81%。次は取消操作と共通モード遷移の状態所有を整理する。全体目標は未完了。

### 前回の区切り

ConstraintStatusViewへ拘束状態表示の固定／Space保持状態と表示同期を分離。状態のOR、keyup／blurでの解除、変更時だけの描画とhint、Toolbar／menu同期を維持。Document／Selection／履歴は変更しない。app.jsは12,314行から12,285行へ縮小（29行減）。構文検査・単体818件・関連E2E101件成功（exit 0、1.2分）。ログはcad-status-view-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量82%。次は残るkeyboard終了／取消の操作責務と共通モード遷移。全体目標は未完了。

### 前回の区切り

DimensionInputControllerへ寸法／Offsetの入力欄イベントとbuffer更新を統合。app.jsは要素の接続のみとなり、新しいmoduleや依存の追加なし。入力欄の通常編集とCanvasの数値キー入力の違い、最新pendingの参照、確定・取消の伝播抑止を維持。app.jsは12,335行から12,314行へ縮小（21行減）。構文検査・単体815件・関連E2E130件成功（exit 0、1.5分）。ログはcad-dimension-binding-{check,unit,e2e}.log。全体E2Eは今回未実行。開始時週枠残量83%。次はキーボードの操作終了／取消と共通状態の所有者を整理する。全体目標は未完了。

### 前回の区切り

週枠残量86%への回復後、最新develop 4cc11d8からcodex/canvas-input-lifecycleで再開。PointerInteractionControllerへdoubleClick／leaveの入力優先順位と終了処理を統合し、CanvasPressQueryへdouble click用のhit照会を集約。Spline編集sessionの変更はapp側の明示actionとして保持。重複抑止、派生図形、寸法・Block・Spline編集の優先順位、drag中のhover保持とflush順を維持。app.jsは12,389行から12,335行へ縮小（54行減）。構文355件・単体813件・関連E2E198件成功（exit 0、2.4分）。ログはcad-activation-{check,unit,e2e}.log。全体E2Eは今回未実行。次はキーボード／寸法数値入力と入力module組立ての責務を整理する。全体目標は未完了、mainへの反映は停止時の最後に行う。

### 前回の停止地点（2026-10-02）

停止・リリース検証の区切り。週枠残量49%で新たな分離を停止。コード4ead051の全E2E327件が成功（exit 0、19.5分、cad-refactor-full-e2e.log）。Fillet 3,744・Offset 10,296・航空機1,872 previewの回帰も成功。構文347件・単体785件は同じコードで成功済み。今回の変更はこの検証・再開記録のみで、app.jsは12,190行のまま。この記録をCommit・Push後、develop→mainの順に反映し両branchを同期して一時停止する。全体リファクタリングは未完了。作業branchは継続用に保持。詳細な再開候補はrefactoring-policy-and-resume.mdの第8節。

### 前回の区切り

CanvasPressQueryへ読取り専用hit snapshotを分離し、PointerInteractionController.downへpointerdown全体の優先順位を集約。listenerはflushと委譲のみ。注記queryはhover非依存を確認してsnapshot構成後にhover更新。Instance受付が必ず消費する重複Sketch投影分岐と常にnullのinactiveHit分岐を除去。app.jsは12,280行から12,190行へ縮小。構文347件・単体785件・関連E2E203件成功（exit 0、4.2分）。ログはcad-pointer-press-{check,unit,e2e}.log。開始時週枠残量58%。次は残るdblclick／pointerleave／キーボード入力と入力module組立て。全体目標と全体E2Eは未完了。

### 前回の区切り

AnnotationCommandInputへ注記配置／選択、ConstraintCommandInputへ寸法drag・距離配置・数値入力中のクリック消費・拘束対象指定を分離。注記配置と選択の間にFillet半径配置を残し、既存の優先順位を保持。app.jsは12,359行から12,280行へ縮小。構文346件・単体780件・関連E2E192件成功（exit 0、2.4分）。ログはcad-target-input-{check,unit,e2e}.log。開始時週枠残量61%。次はhit snapshotとpointerdown全体の順序を整理してPointerInteractionControllerへ収束し、入力moduleの組立てをまとめる。全体目標と全体E2Eは未完了。

### 前回の区切り

InstanceCommandInputへ派生元編集・Sketch投影元選択・Free配置・Mirror／Pattern基準線の入力を分離。投影operandの優先順位、直接hitへのfallback、投影矩形のcapture、非線operand時の拒否、Free配置のsnapを維持。状態は既存Instance commandが所有。app.jsは12,383行から12,359行へ縮小。構文343件・単体774件・関連E2E192件成功（exit 0、2.4分）。ログはcad-instance-input-{check,unit,e2e}.log。開始時週枠残量63%。次は注記／寸法／拘束の受付とhit snapshot、その後入力moduleの組立て整理。全体目標と全体E2Eは未完了。

### 前回の区切り

DrawingCommandInputへ基本作図のclick受付と拒否判定、PointCommandへ点作成の仮入力・snap・選択更新・求解の手順を分離。先行する注記／寸法／拘束等の入力優先度と各command引数、Point以外の既存選択の保持を維持。app.jsは12,455行から12,383行へ縮小。構文341件・単体769件・関連E2E203件成功（exit 0、4.1分）。ログはcad-drawing-input-{check,unit,e2e}.log。開始時週枠残量66%。次はInstance等の受付とhit snapshot。全体目標と全体E2Eは未完了。

### 前回の区切り

BlankCanvasGestureへ空白double clickの候補・重複抑止状態と終了／取消の優先順位を分離。仮Point／Lineの判定、450ms／6px境界、Spline確定優先、候補と抑止の別resetタイミングを維持。操作APIの接続はまだ多く、共通モード遷移整理時に見直す。app.jsは12,578行から12,455行へ縮小。構文338件・単体766件成功。関連E2E203件の初回は202成功／1失敗：既存Spline test hookのhatchFaceAt参照切れを発見し、独立commit 06e2026でhatchGeometryQuery経由へ修正。Spline6件再実行は全件成功、修正後app構文も成功。残る197件は初回成功で、失敗は解消。ログはcad-blank-gesture-{check,unit,e2e,spline-recheck}.log。開始時週枠残量70%。次は通常pointerdownのhit snapshotとcommand受付。全体目標と全体E2Eは未完了。

### 前回の区切り

選択数・drag対象点の照会をCanvasSelectionへ集約し、通常図形のbeginDragと既選択判定をCanvasSelectionInteractionへ統合。appから3つのcallback注入を除去。共有点の参照・重複・順序、選択数の分類、単独／複数選択dragの条件と選択消去順を維持。app.jsは12,656行から12,578行へ縮小。構文336件・単体759件・関連E2E197件成功（exit 0、4.0分）。ログはcad-drag-start-{check,unit,e2e}.log。開始時週枠残量72%。次はpointerdownに残るhit snapshotとcommand受付。全体目標と全体E2Eは未完了。

### 前回の区切り

CanvasSelectionInteractionへ通常pointerdownの選択・drag開始を分離。描画順、点／円弧端点優先、追加選択、投影HatchのBlock選択、Spline複数選択drag、画像dragの更新委譲を維持。選択状態はCanvasSelectionのAPI経由で更新し、DOM captureも明示portとする。旧本体との一致を依存置換を除き確認。app.jsは12,768行から12,656行へ縮小。構文336件・単体754件・関連E2E197件成功（exit 0、4.1分）。ログはcad-selection-interaction-{check,unit,e2e}.log。開始時週枠残量74%。次は選択数／drag対象点照会を既存Selectionへ収束し、beginDragの計画生成とpointerdownのcommand受付・hit snapshotを整理する。全体目標と全体E2Eは未完了。

### 前回の区切り

PointerInteractionControllerへpointer終了処理も集約し、移動・終了の優先順位を同じ所有者で扱う。操作が終了を消費した後の打切り、元のpointer eventの引渡し、未消費時の履歴確定と仮Line始点の抑止を維持。flushと計測はapp側。app.jsは12,784行から12,768行へ縮小。構文334件・単体748件・関連E2E197件が成功（exit 0、4.0分）。ログはcad-pointer-interaction-{check,unit,e2e}.log。週枠残量75%。次はpointerdownのcommand受付と通常選択／drag開始を分析する。一括移動による依存肥大化は避ける。全体目標と全体E2Eは未完了。

### 前回の区切り

PointerMoveControllerへ入力振分けを分離。座標表示・変換・間引き・profile／read cacheはUI側に保持し、controllerは各操作の公開APIと状態照会を受け取る。重なる状態の優先順位、消費／継続、部分hover消去、距離寸法のpending更新を維持。app.jsは12,876行から12,784行へ縮小。振分け本体は明示portへの置換を除いて旧コードとの一致を確認。構文334件・単体746件・関連E2E197件が成功（exit 0）。ログはcad-pointer-move-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。開始時週枠残量79%。

### 前回の区切り

DrawingPreviewへpointer／Trim候補の状態と作図feedback更新を分離。command・モード切替・描画・診断を同じ所有者へ接続し、resetを集約。line／基本図形の後続hover継続、Centerline等の消費、距離寸法の前後関係、Trim参照同一性と既存hover条件を維持。app.jsは12,990行から12,876行へ縮小。構文332件・単体740件・関連E2E197件が成功（exit 0、ドラッグ・画像操作を含む）。ログはcad-drawing-preview-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。開始時週枠残量83%。

### 前回の区切り

Block／Free Instanceの配置previewをPlacementPreviewRendererへ分離し、Geometry描画の重複を統合。投影生成は呼出し側、Hatch／注記は既存rendererへ委譲。描画順・青色・alpha・元styleの無変更・Free Instance点markerを保持。app.jsは13,041行から12,990行へ縮小。構文330件・単体734件・関連E2E192件が成功（exit 0）。ログはcad-placement-preview-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。最新継続指示の週残量50%停止・最後のmainマージを再開方針に反映。開始時残量85%。

### 前回の区切り

snap markerとSketch識別ラベルをInteractionOverlayRendererへ分離。hover優先・選択種別順・可視性／active除外・参照関係文言／色・画面px配置を保持。状態所有者は変更せず、診断も同じ関係照会を利用。app.jsは13,137行から13,041行へ縮小。構文328件・単体731件・関連E2E192件が成功（exit 0）。ログはcad-interaction-overlay-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

Spline／Centerline／TrimのpreviewをAuthoringPreviewRendererへ統合。draftを変更せず、投影済みpointer・支持線・Canvas寸法・Trim候補を引数で受け取る。mode・command・DOMはapp側。app.jsは13,202行から13,137行へ縮小。構文326件・単体727件・関連E2E192件が成功（exit 0）。ログはcad-remaining-preview-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

基本作図とFilletのpreview描画をAuthoringPreviewRendererへ分離。command／Documentは渡さず座標引数・幾何計算portだけを受け取る。途中段階のmarker・最小長・円弧方向・CanvasSurfaceのresetを保持。app.jsは13,322行から13,202行へ縮小。構文326件・単体724件・関連E2E192件が成功（exit 0）。ログはcad-authoring-preview-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

円弧端点／Spline編集ハンドルの表示状態をGeometryPresentationへ、描画をGeometryRendererへ統合。円弧の編集可否・端点対選択・固定強調、Splineのscope同一性・閉曲線・選択色、CanvasSurfaceのresetを保持。新moduleなし。app.jsは13,368行から13,322行へ縮小。構文324件・単体720件・関連E2E192件が成功（exit 0）。ログはcad-handles-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

点の表示条件と中心強調をGeometryPresentationへ、円／影／ID／固定ラベルの描画をGeometryRendererへ統合。新moduleは追加しない。Spline編集点・端点・参照点・投影点・拘束表示の条件と色の優先順位を維持。app.jsは13,419行から13,368行へ縮小。構文324件・単体717件・関連E2E192件が成功。E2Eは直近のsandbox内server終了待ちを避けるため承認済み権限で実行し、server手動停止なしでexit 0。ログはcad-point-render-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

GeometryPresentationへGeometry描画状態・所有Instance選択／hover・色・線幅の5関数を分離。状態は既存所有者から読み、GeometryRenderer・点描画・診断で共有する。5関数の本体はconstruction alphaの明示依存化以外に変更がないことを確認。app.jsは13,456行から13,419行へ縮小。構文324件・単体713件・関連E2E192件が成功。全テスト本体成功後にwebServer終了待ちが残り、今回のserverのPID／親PID／commandを確認して停止。最終192 passedとexit 0を確認。ログはcad-geometry-presentation-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 前回の区切り

SelectionHighlightへ拘束の図形role・Propertiesラベル・強調対象の構成を統合し、GeometryReadModelへ現在scopeの通常図形ID検索を統合。appからの逆向きcallbackを減らし、新moduleは追加しない。拘束照会2関数は本体一致を確認。app.jsは13,510行から13,456行へ縮小。構文322件・単体709件が成功。関連E2E192件が成功（cad-highlight-query-{check,unit,e2e}.log）。全テスト本体成功後のwebServer終了待ちが残ったため、今回の実行が生成したserverのPID／親PID／commandを確認して停止し、192 passedの最終出力を確認した。全体目標と全体E2Eは未完了。

### 前回の区切り

SketchTreeControllerへ行hover状態・pointerOver／Out・leave・所属図形の強調判定を統合。新moduleを増やさずCanvasHover／sidebar強調と接続し、SelectionとアクティブSketchは更新しない。3関数はscope取得以外の本体一致を確認。app.jsは13,565行から13,510行へ縮小。構文322件・単体706件が成功。関連E2E192件が成功（Sketchツリー・Canvas強調・選択を含む5ファイル）。ログは一時フォルダのcad-tree-hover-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

PointUsageへ点の使用関係と分類14関数を集約。現在scope・展開Geometry・編集fit point・拘束参照を明示読取りで接続し、Object同一性と分類条件を維持。14関数はscope／session取得以外の本体一致を確認。app.jsは13,606行から13,565行へ縮小。構文321件・単体703件が成功。関連E2E192件が成功（点選択・拘束・Spline／投影を含む5ファイル）。ログは一時フォルダのcad-point-usage-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

所属Sketch表示のhitをGeometryHitQueryへ、注記対象hitをAnnotationAnchorQueryへ統合。新moduleを増やさず、既存の照会所有者へ集約した。2関数はscope／倍率取得以外の本体一致を確認。app.jsは13,698行から13,606行へ縮小。構文319件・単体698件が成功。関連E2E192件が成功（所属Sketch・Annotation・Block投影を含む5ファイル）。ログは一時フォルダのcad-identity-hit-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

OperandHitQueryへ参照SketchとBlock／派生Geometryの拘束対象照会を分離。Geometry読取り・Sketch関係・点分類・operand生成を明示依存とし、逆順と円弧端点の扱いを維持。3関数は倍率getter以外の本体一致を確認。app.jsは13,785行から13,698行へ縮小。構文319件・単体694件が成功。関連E2E192件が成功（Block・派生Instance・参照拘束を含む5ファイル）。ログは一時フォルダのcad-operand-hit-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

PointerHoverへ通常選択・拘束入力のhit優先判断とCanvasHover更新を分離。command種別を引数で受け、描画要否を返す。両経路は引数化・再描画通知以外の本体一致を確認。app.jsは13,883行から13,785行へ縮小。構文317件・単体690件が成功。関連E2E194件が成功（選択・拘束入力・投影・参照画像を含む6ファイル）。ログは一時フォルダのcad-pointer-hover-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

GeometryHitQueryへ通常Geometryのhit照会10関数を集約。現在scope・倍率・編集可否・点分類を明示依存とし、端点優先、描画順、円弧端点のend→start順を維持。右クリック候補とは異なる照会規則を保持し、端点の選択可否predicateだけを共用した。10関数の本体は読取りportへの置換以外の一致を確認。app.jsは13,950行から13,883行へ縮小。構文315件・単体683件が成功。関連E2E192件が成功（選択・作図・拘束入力・投影を含む5ファイル）。ログは一時フォルダのcad-geometry-hit-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

CanvasHoverへ14種類のhover参照と一括更新・clear・退避復元・候補previewを集約。194代入を更新APIへ移行し、独立する28組を一括化。元の代入式と順序の一致を確認した。参照画像を含まないメニュー退避範囲とSketchツリー行hoverの区別を維持。app.jsは14,067行から13,950行へ縮小。構文313件・単体678件が成功。関連E2E197件が成功（通常操作192件・図形ドラッグ3件・参照画像2件）。ログは一時フォルダのcad-canvas-hover-{check,unit,e2e,images}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

CanvasContextQueryへ候補収集・投影集約・順位付け、CanvasContextPresentationへ表示ラベルを分離。scope・倍率・編集中fit pointと各種読取りを明示依存にし、UI／Selection更新を持たない。4関数は読取りportへの置換以外の本体一致を確認。app.jsは14,303行から14,067行へ縮小。構文311件・単体673件が成功。関連E2E192件が成功（右クリック候補・拘束入力・Block／派生Instanceを含む5ファイル）。ログは一時フォルダのcad-context-query-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

CanvasContextMenuへ対象・pointer・候補一覧・hover snapshotの所有と、HTML・位置・focus・イベント・開閉／復元を集約。appは候補を供給し選択／操作通知を既存コマンドへ接続する。start／disposeでイベント寿命を管理。app.jsは14,431行から14,303行へ縮小。構文308件・単体667件が成功。関連E2E192件が成功（右クリック操作・重なり候補・拘束対象選択を含む5ファイル）。ログは一時フォルダのcad-context-menu-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

AnnotationSpatialQueryへ表示範囲・文字領域・通常選択／右クリックhit照会を分離。6関数の計算は倍率getter以外を維持。矩形拡張判定はGeometryBoundsへ統合し、描画とモデル編集は持たない。app.jsは14,545行から14,431行へ縮小。構文306件・単体662件が成功。関連E2E198件が成功（Annotation表示サイズを含む6ファイル）。ログは一時フォルダのcad-annotation-spatial-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

### 直前の区切り

週枠50%の停止条件はユーザー指示で解除済み。最新develop（5116a81）を作業branchへ取り込んだ。AnnotationAnchorQueryへ引出線対象・最近点・GeometryRef再解決を分離し、Selection／現在Sketch／参照解決を明示callbackで接続した。抽出5関数の本体一致を確認。app.jsは14,596行から14,545行へ縮小。構文304件・単体657件が成功。関連E2E198件が成功（Annotation表示サイズ・Parameter・保存再読込を含む6ファイル）。ログは一時フォルダのcad-annotation-anchor-{check,unit,e2e}.log。全体目標と全体E2Eは未完了。

## 過去の区切り

AnnotationCommandへテキスト／引出線の作成・対象選択・prompt・確定取消と配置計算を集約。previewを描画データとして返し、appが既存Rendererへ接続する。共通pendingCommandは明示get／setを使用。操作・配置9関数はadapter置換とpreviewデータ化以外の一致を確認。構文302件・単体633件・関連E2E184件が成功。app.jsは14,539行。全体目標と全体E2Eは未完了。 週枠の残りが49%となり、ユーザー指定の50%未満停止条件に達したため、この区切りをCommit・Pushして一時停止する。

HatchCommandへ作成・境界修復の進行とpreview／修復対象を集約。共通mode・pointer・ID採番・UI・履歴は明示adapterで接続し、取消とDocumentリセットはresetを利用。構文300件・単体628件・関連E2E191件が成功。app.jsは14,674行。全体目標と全体E2Eは未完了。

HatchGeometryQueryへprimitive変換・境界fingerprint・境界解決WeakMap・閉領域indexを集約。修復後のforgetとDocumentリセット時のclearでcacheを操作し、appから直接参照を除去。抽出7関数は依存取得方法以外の本体一致を確認。構文298件・単体623件・関連E2E191件が成功。app.jsは14,750行。全体目標と全体E2Eは未完了。

BlockLayoutへ入れ子を含むBlockローカル範囲、表示中心、配置anchorへの平行移動を集約。BlockCatalog・BlockProjection・InstanceProjectionと形状解決を明示依存とし、抽出3関数の本体一致を確認。構文296件・単体619件・関連E2E184件が成功。app.jsは14,817行。全体目標と全体E2Eは未完了。

FirstDimensionScalingへ初回寸法のモデル拡縮を分離し、画面上の範囲取得／復元を既存CanvasViewportへ統合。DimensionValueCommandの初回判定・追加成否・履歴と順序を保持。モデル操作7関数は依存名以外の本体一致を確認。構文294件・単体614件・関連E2E184件が成功。app.jsは14,918行。全体目標と全体E2Eは未完了。

GeometryBoundsへ矩形判定・図形bounds・範囲結合、ReferenceImageGeometryへ画像座標変換、DrawingBoundsへSketch指定・全体・可視対象の範囲集計を分離。計算15関数は依存取得名と空白以外の本体一致を確認。構文292件・単体608件・関連E2E186件が成功。app.jsは15,023行。全体目標と全体E2Eは未完了。

PointerMoveSchedulerへ保留中のpointer入力・frame予約・flush／破棄と診断件数を集約。appは移動処理とpreview計測・Geometry読取りcache・寸法入力同期を接続する。構文288件・単体603件・関連E2E118件（図形ドラッグ／基本操作117件と240入力のframe集約1件）が成功。app.jsは15,176行。全体リファクタリングと全体E2Eは未完了。

旧SketchProjection拘束をSketchProjectionQueries（投影先索引・対応点・影響対象の照会）とSketchProjectionEditing（共有Point分離・source再接続・Spline metadata同期）へ分離。抽出12関数の本体はscope取得の依存名と空白以外の一致を確認。構文286件・既存単体599件・関連E2E184件が成功（ログ: 一時フォルダのcad-release-check.log、cad-release-unit.log、cad-release-e2e.log）。app.jsは15,226行。ユーザーの明示依頼で既存の未リリース分離と合わせてdevelop経由でmainへ反映する。全体リファクタリング・全体E2Eは未完了。次の分離にはまだ着手していない。

寸法式の下書き評価を既存ParameterNamespaceへ統合し、ExpressionInputViewへ強調表示・DOM装飾・input／scrollイベントと再描画を集約。参照名のscope選択はappから明示callbackで接続し、UIには計算とモデル更新を持たせない。構文284件・単体599件・関連E2E185件が成功。app.jsは15,405行。次はSketchProjection拘束の照会・metadata同期・共有点分離の境界を調べる。全体目標は未完了。

ParameterStabilizationへ式評価と参照寸法feedback・目標値の段階的求解を集約。ParameterNamespace、SketchSolving、EditingCheckpointを接続し、ParameterApplicationは操作全体の確定・復元を引き続き担当する。反復上限・補間・半減再試行・finallyによる最終target復帰を維持。構文283件・単体597件・関連E2E185件が成功。app.jsは15,489行。次は寸法式の下書き評価を既存ParameterNamespaceへ集約し、式入力表示の責務を整理する。全体目標は未完了。

ConstraintAnalysisへ解析対象の拡張・通常／Block／Free Instance分類・cacheと遅延評価を集約。appの直接無効化をinvalidate APIへ置換し、UIは分類・summary・安定性を照会する。数値解析の基底成分取得はSolverの共通関数へ移し、GeometryDragEditingも直接利用する。構文281件・単体591件・関連E2E191件が成功。app.jsは15,595行。次はParameterの反復評価と目標遷移求解を整理する。全体目標は未完了。

ConstraintRedundancyへ追加時の個別冗長判定・全Sketchの集計・結果Mapを集約。接続されたLine／Arcの最初の同等接線を維持する例外、前計算の再利用、個別詳細破棄後は次のrefreshで件数を更新する時機を保持した。構文279件・単体584件・関連E2E184件が成功。app.jsは15,800行。次は拘束状態の解析・分類・cacheの所有者を整理する。全体目標は未完了。

ReferenceConstraintStateへ参照の有効性・循環照会と参照エラーMapを集約。現在scopeとSketchContextの所属／参照範囲判定だけに依存し、求解・UIは操作可否、理由、件数をAPIで照会する。読込順の判定と永続enabledの保持を維持し、診断用snapshotから内部Mapを変更できない構成にした。構文277件・単体580件・関連E2E184件が成功。app.jsは15,874行。次は重複拘束の解析と結果状態を整理する。全体目標は未完了。

SketchSolvingへ単一／局所Sketch求解・依存順序に沿う伝播・失敗復元と求解結果状態を集約。状態Mapを非公開にし、削除・モデルresetもAPI経由へ変更した。求解対象はSolveScopeQuery、値復元はEditingCheckpoint、通知・履歴は各操作側へ委譲する。構文275件・単体575件・関連E2E191件が成功。app.jsは15,944行。次は参照拘束の有効性と参照エラー状態の境界を整理する。全体リファクタリングは未完了。

SolveScopeQueryへ拘束連結成分と局所／Sketch全体の変数・拘束・線の照会を集約。現在のworkspaceとGeometryReadModel、所属・有効性の判定を明示依存とし、操作・求解実行・数値状態を持たない。固定Pointでの探索停止、局所Pointだけの表示判定、変数順序とBlock回転ロックを維持した。構文273件・単体568件・関連E2E191件が成功。app.jsは16,102行。次はSketch求解・依存先求解と失敗復元の調整境界を調べる。全体目標は未完了。

GeometryDragEditingへ局所context準備・Line代表target判定・開始前snapshot・図形種別のpreview適用と補正／復元を集約。操作と診断がprepare／preview／finishを共用し、appに残るpreview／finishは計測adapterのみとした。共有のRadius／Diameter寸法照会は既存DimensionQueriesへ統合し、拘束編集の参照を維持。構文271件・単体564件・関連E2E194件が成功。app.jsは16,269行。次は共通の拘束連結成分・局所／Sketch求解対象の照会境界を整理する。全体目標と全体E2Eは未完了。

GeometryDragへドラッグsessionの開始・更新・終了・resetとTX-02の復元／履歴調整を集約。appの共有dragSessionを除去し、入力を操作API、描画を3種の強調対象照会へ接続した。開始計画をコピーして保持し、小移動／クリック、投影拒否、最終求解・Spline・Parameter失敗の復元と通知順序を維持。構文269件・単体556件・関連E2E191件（通常184件と実pointer操作・Undo7件）が成功。app.jsは16,501行。局所context準備と図形種別ごとのpreview適用は明示callbackとして残り、次はその依存を整理する。直前の求解分離は`0ee5b09`で確定済み。全体目標と全体E2Eは未完了。

GeometryDragSolverへ局所／guided求解、全Sketch再試行、大移動の区間分割と終了時補正を集約。前回／保留中の目標、guided対象変数、一時拘束、preview残差は非公開WeakMapでドラッグごとに所有し、appのsessionから除去した。局所／全Sketchの復元範囲、許容差、反復上限のfinally復帰と診断の件数を維持。構文267件・単体548件・関連E2E202件（20.5分）が成功。app.jsは16,594行。次は局所context準備とドラッグ操作の開始・更新・確定／復元の所有者を整理する。全体目標と全体E2Eは未完了。

直前のGeometryDragPlan分離は`dd5399d`で確定済み。その後のBlockハッチ変換追従修正`d0db050`も含め、`0c4bbc1`でdevelop／mainへ反映済み。以下は各区切りの記録であり、現在の再開手順はrefactoring-policy-and-resume.mdを優先する。

通常図形ドラッグの開始状態・移動先・一時拘束生成を`GeometryDragPlan`へ分離。固定／ロック判定、開始時座標、Block回転pivot、半径の開始中心基準を維持し、構文265件・単体539件・関連E2E191件が成功。app.jsは16,989行。次はSolver適用・復元の実行境界を整理する。

DimensionDragへ寸法位置ドラッグのsession・開始表示値・更新・確定・resetを集約。appのsession変数を除去し、描画は対象constraintの照会、入力は操作APIで接続。寸法コマンド中の3px閾値と小移動時のクリック継続、角度と通常寸法の通知差を維持。構文263件・単体534件・Slot寸法／Block／統合UI／保存互換E2E153件が成功。app.jsは17,126行。次は通常図形ドラッグの状態とSolver・復元の境界を調べる。全体目標と全体E2Eは未完了。

RectangleSelectionQueryへ矩形内候補の読取りを分離し、追加／置換と補助選択解除は既存CanvasSelection.applyRectangleへ統合。selectByRectは接続のみになった。Object同一性、表示・所属条件、Arc／Splineサンプル、Block投影境界とgeometryInstances選択の保持を維持。構文261件・単体530件・Block／統合UI／保存互換／SketchProjection E2E162件が成功。app.jsは17,224行。次は寸法ドラッグなど残る入力sessionの開始・更新・確定を整理する。全体目標と全体E2Eは未完了。

SelectionRectangleへ矩形選択session・preview・確定振分け・resetを集約。appのsession変数を除去し、通常／SketchProjectionの経路、追加選択、3px閾値、方向別判定を維持した。描画は座標とcrossingだけを照会し、図形種ごとの選択適用は既存処理へ委譲。構文259件・単体526件・Block／統合UI／保存互換／SketchProjection E2E162件が成功。app.jsは17,309行。次はselectByRectの候補照会と選択適用の境界を整理する。全体目標と全体E2Eは未完了。

AnnotationDragへ注記ドラッグのsession・開始座標・ID再解決・更新・確定・resetを集約。appのsession変数を除去し、入力はactive照会と操作API、診断はinspectの値で接続。Leaderの終点／折れ点／文字位置とFree Textの移動規則、確定時の履歴通知を維持。構文257件・単体522件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,340行。次は選択矩形の開始・更新・確定と選択判定の境界を整理する。全体目標と全体E2Eは未完了。

ReferenceImageInteractionへ画像ドラッグ・2点縮尺校正のsessionと開始・更新・確定・取消・resetを集約。appの2つのsession変数と直接書換えを除去し、入力は操作API、描画は校正点の照会で接続。移動閾値、1点目を維持する回転画像の校正、不正入力の再試行と履歴時機を維持。構文255件・単体519件・参照画像／Block／統合UI／保存互換E2E153件が成功。app.jsは17,391行。次は注記ドラッグと選択矩形など残る入力sessionの所有者を整理する。全体目標と全体E2Eは未完了。

SketchDeletionCommandへ削除範囲・外部参照検査・確認・寸法symbolガード・削除適用と通知順序を集約。scopeは呼出しごとに取得し、cache・解析・UIは所有者へ通知する。旧SketchProjectionConstraintによる子孫保持と親変更を維持し、仕様書に既存例外を明記。構文253件・単体514件・Block／統合UI／保存互換／SketchProjection E2E162件が成功。app.jsは17,485行。次は操作解除に残るドラッグ・選択矩形・画像操作sessionの所有者を調べ、状態と更新処理をまとめる。全体目標と全体E2Eは未完了。

SketchCommandへSketch作成・切替・名前変更・表示切替と命名規則を集約。scopeを操作ごとに取得し、ID採番・入力・操作解除・UI・履歴は明示依存とした。復元後の操作解除には多数の未分離状態が残るため、setterを増やす抽出を避け、解除を利用する操作単位から整理した。構文251件・単体510件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,565行。次は共通操作解除の状態所有者とSketch削除の参照検査・モデル更新を確認する。全体目標と全体E2Eは未完了。

HistoryControllerへDocument／Block履歴の選択・記録・reset・Undo／Redo振分けと復元中状態を集約。appの共有historyRestoring変数を除去し、復元時の再記録抑止・finally通知を共通化した。具体的な復元とDOM・計測は明示adapterとして残る。構文249件・単体506件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,639行。次はDocument読込／Block差替え後の操作解除・求解・表示更新と履歴UIの境界を調べる。全体目標と全体E2Eは未完了。

BlockHistorySnapshotへBlock履歴の復元用コピーとsignature生成を分離。session・DOM・履歴stackへの依存を持たず、定義とclone／拘束codecから生成する。旧signature関数の本体一致、コピーの独立性、参照metadata・採番値と差分判定を検証。構文248件・単体503件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,652行。次はDocument／Block共通の履歴復元中状態と復元・UI通知の所有者を整理する。全体目標と全体E2Eは未完了。

ConstraintRebindingへBlock拘束の複製と保存済み固定座標の移動を統合。BlockDefinitionEditingへcloneForBlockを直接渡し、appの複製実装への逆依存を除去。クリップボードも同じ固定座標移動を利用する。寸法表示位置・参照metadata・復元不能時の拒否を維持。構文247件・単体501件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,697行。次はBlock履歴snapshotの生成・復元とUI通知の境界を整理する。全体目標と全体E2Eは未完了。

BlockSelectionQueryへBlock作成候補の検証と配置中心照会を分離。現在scopeを都度取得し、共有点・注記・ハッチ境界と内部／外部拘束を照会する。2関数の本体一致を確認した。依存の明示で旧未定義constraintLabelForList参照が起動時エラーとなることをE2Eで検出し、既存localizedConstraintNameへ接続して修正。構文247件・単体499件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,726行。次はcloneConstraintForBlockのappへの逆依存とBlock履歴adapterを整理する。全体目標と全体E2Eは未完了。

BlockDefinitionCommandへ作成・編集開始／取消・定義名変更／削除と親host復帰の調整を集約。Session／DefinitionEditing／EditingQueries／Catalogへ委譲し、BlockViewが一覧dialog閉鎖と編集classを担当する。空編集viewportの調整と履歴resetはappの明示adapterとして残る。構文245件・単体494件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,805行。次はBlock候補の選択検証と境界中心の照会、拘束複製と残るBlock履歴adapterを整理する。全体目標と全体E2Eは未完了。

選択からのBlock下書き生成と空定義生成を既存BlockDefinitionEditingへ、所有子孫の仮移動と復元記録生成を既存BlockEditorSession.stageChildrenへ統合。新しいmoduleは追加していない。座標変換・寸法式の数値固定と採番時点、全registry差替え後の拘束再接続を維持。4関数の本体比較、構文243件・単体487件・Block／統合UI／保存互換E2E151件が成功。app.jsは17,917行。次はBlock作成・編集開始／取消・定義操作の進行と、選択からのBlock候補照会を整理する。全体目標と全体E2Eは未完了。

BlockEditingQueriesへ編集範囲・利用可否・参照Instance・draftを優先する依存循環と移動可否を集約。保存済み所有子孫とSketch表示行は既存BlockCatalogへ統合し、仮移動と削除の子孫探索を共用した。呼出し元のないnestedBlockPlacementErrorは除去。12照会関数の本体比較、構文243件・単体483件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,032行。次は選択からのBlock下書き生成・仮移動と作成開始、編集開始／取消・定義削除を既存の所有者へ接続して整理する。全体目標と全体E2Eは未完了。

Block編集の下書き検証・回転確認待ち・定義反映・参照整理・配置先求解・履歴をBlockCompletionCommandへ集約。待機状態も所有し、同じsessionへの回答だけ適用する。親scope復帰後にモデルを取得し、内部拒否とTX-05の配置先エラーを区別する。構文241件・単体477件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,164行。次は残るBlock定義の階層／依存照会、選択からの作成開始、編集開始・取消・削除の依存を整理する。全体目標と全体E2Eは未完了。

Block定義のclone／cloneInstance／translate／applyをBlockDefinitionEditingへ集約（`a70e9d0`）。Geometry同一性と拘束map接続、固定位置・寸法・補助要素の移動を維持し、session・DOM・履歴から独立。4関数の本体比較、構文239件・単体471件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,297行。次はvalidateBlockDraftとcompleteBlockDefinitionEditの依存を調べ、検証と確定commandを整理する。ユーザーの再開準備依頼により、全体方針・残作業・検証とGit運用・再開指示をrefactoring-policy-and-resume.mdに記録した。全体目標と全体E2Eは未完了。

BlockEditorSessionへsession連鎖、draft同期とUndo差替え、親scope復帰、一時定義／復元記録の引継ぎ・取消・削除時整理を集約した。appのsession変数と管理情報への直接書込みを除去し、名称変更も所有者へ委譲。確定処理とUIはcurrentの参照とAPIで接続する。構文237件・単体468件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,539行。次はBlock draftの検証・定義反映と確定commandを整理し、session所有者とは責務を分ける。全体目標と全体E2Eは未完了。

Block一覧と編集パネルのDOM表示・イベント接続をBlockViewへ分離。編集名は表示用コピー、モデル変更と履歴は明示した操作コールバックへ委譲し、focus中の入力保持とdialog更新順序を維持した。構文235件・単体463件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,673行。次はBlock編集sessionの開始・確定・取消とhost復元を一体で整理する。全体目標と全体E2Eは未完了。

Blockの有効Sketch変更と影響検査をBlockConfigurationCommandへ分離。投影差分から拘束／注記参照を確認し、拒否時の無変更、許可時の関連拘束と選択解除、cache・履歴・更新の順序を保持した。hover解除はappの所有者へのコールバック。構文233件・単体461件・Block／統合UI／保存互換E2E151件が成功。app.jsは18,719行。次はBlock UIの内容生成・イベント接続、またはドラッグsessionの所有者を整理する。全体目標と全体E2Eは未完了。

Free Instanceの回転／反転とBlockの回転ロック／直交角度変更をInstanceTransformCommandへ分離した。Freeは共有元と指定InstanceをSolver変数から除外し、Blockは表示中心を保持する。各経路の局所／従属解、復元、解析・UI更新、履歴の違いを維持し、PropertiesとBlock UIが共用する。構文231件・単体458件・Block固定／Block／Free Instance／統合UI／保存互換E2E181件が成功。app.jsは18,761行。次はBlock構成変更の影響照会と確定処理、または残るドラッグsessionの所有者を整理する。全体目標と全体E2Eは未完了。

Free／Mirror／Patternの作成をGeometryInstanceCommandへ分離し、参照元候補と配置途中Instanceの所有者を集約。開始・配置・軸／方向確定・previewを同じcommandに接続し、Propertiesはpending、変換編集はisPlacing、取消は各破棄APIを使用する。Freeの確定時採番とPattern入力取消時の候補維持を保持した。構文229件・単体454件・Free Instance／統合UI／保存互換E2E136件が成功。app.jsは18,861行。次はFree Instanceの変換編集と共有元を動かさないSolver transaction、および残る描画／ドラッグsessionの所有者を整理する。全体目標と全体E2Eは未完了。

派生Instanceの参照元編集をInstanceSourceCommandへ分離。対象／候補状態、追加検証、確定時の参照順序とlegacy ID維持、削除保護、関連拘束・注記整理、履歴を同じ所有者にまとめた。Propertiesはcurrentの候補配列コピー、Canvas強調はincludesRef、モード終了／resetはAPIで接続する。構文227件・単体451件・Free Instance／Sketch投影／統合UI／保存互換E2E147件が成功。app.jsは18,944行。次はFree Instance配置とMirror／Pattern作成で共有する候補sourcesの所有者を整理する。全体目標と全体E2Eは未完了。

Block配置の5状態（定義・中心・有効Sketch・回転ロック・パネル復元記録）と開始／クリック／確定をBlockPlacementCommandへ分離した。previewも同じ所有者から予定Instanceを返す。Properties・通常取消・Documentリセット・test hookはAPIで接続し、直接状態書込みを除去した。構文225件・単体448件・Block／統合UI／保存互換E2E151件が成功。app.jsは19,014行。次はFree Instanceの配置・参照元編集sessionの所有者を整理する。mode／共通pointerと採番はapp側に残る移行用コールバック。全体目標と全体E2Eは未完了。

Propertiesの対象別HTML構成をPropertiesContent、現在scope／操作／選択からの表示情報取得をPropertyPresentationへ分離。配置中Instance、参照元編集中候補、Sketch外観、寸法評価値を照会側で解決し、ContentはDocument／操作sessionを直接参照しない。appはRows／Content／Controller／Viewと編集commandの接続を担当する。構文223件・単体445件・画像／Free Instance／Spline／統合UI／保存互換E2E144件が成功。app.jsは19,093行。次は共有の表示設定照会と、Block／Free Instanceの配置・編集sessionの所有者を整理する。全体目標と全体E2Eは未完了。

Propertiesのinput/change/clickをPropertiesControllerへ集約。参照画像・注記・派生Instanceの基本値適用はElementPropertyCommandへ分離し、Controllerはモデルやsessionを直接変更せず、既存commandと明示した操作コールバックを呼ぶ。Viewへ3イベントを接続した。構文220件・単体442件・画像／Free Instance／Spline／統合UI／保存互換E2E144件が成功。app.jsは19,208行。次はPropertiesの対象別内容構成と照会依存を整理する。Block配置・Spline編集sessionの所有者はまだappに残り、Controllerからは専用コールバック経由で接続する。全体目標と全体E2Eは未完了。

Properties外観の適用先・プレビュー／確定をAppearancePropertyCommandへ集約。色パレットもowner解決を共用する。UIは入力検証と値変換、AppearanceEditingは正規化適用、commandはcache・履歴・更新を担当し、寸法prefix／suffixの入力欄を再生成しない規則を保持した。構文217件・単体437件・統合UI／保存互換E2E114件が成功。app.jsは19,404行。次は残るPropertiesの入力振分けと参照画像／注記／派生Instance編集、対象別内容構成の照会依存を整理する。全体目標と全体E2Eは未完了。

Propertiesの補助作図切替とSpline開閉をGeometryPropertyCommandへ分離した。投影保護・曲線成立・Solver／従属解の確認と復元・履歴はcommand、入力欄の差戻しと通知・DOM／描画更新はappの接続処理が担当する。構文215件・単体434件・Spline／統合UI／保存互換E2E120件が成功。app.jsは19,474行。次はPropertiesの外観入力プレビュー／確定と対象別内容構成の依存を整理する。全体目標と全体E2Eは未完了。

寸法Propertiesの名前／式確定を既存DimensionValueCommand.commitPropertyへ、名前検証・参照式書換え・採番予約を既存ParameterNamespace.renameDimensionへ統合した。snapshot復元とSolver成功判定、履歴・通知の順序を維持し、Canvas入力pendingを操作しない。新規モジュールは増やしていない。構文213件・単体431件・統合UI／保存互換E2E114件が成功。app.jsは19,504行。次はProperties内の図形構造編集（construction／Spline開閉）の確定処理と、対象別内容構成の照会依存を整理する。全体目標と全体E2Eは未完了。

Propertiesの図形・寸法・拘束・Block・注記・複数選択の表示行をPropertyRowsへ、DOM更新・装飾・開閉状態・イベント接続をPropertiesViewへ分離した。内容生成はHTMLを返し、ViewがDOMへ反映する。構文213件・単体428件・統合UI／保存互換E2E114件が成功。app.jsは19,540行。次は対象別の内容構成の照会依存と、Properties入力の編集transactionを整理する。ユーザーの最新方針に従い、行数や残り利用枠に合わせて分割を急がず、今後の開発に適した責務の粒度を優先する。全体目標と全体E2Eは未完了。

Propertiesの対象／共通値照会を`PropertySelection`、外観の正規化適用を`AppearanceEditing`、一括変更の調整を`BulkPropertyCommand`へ分離。表示・パレット・一括編集が同じ対応項目とmixed値を使う。構文210件・単体426件・統合UI／保存互換E2E114件が成功。app.jsは19,775行。次はProperties表示行の生成と編集入力transactionを整理する。全体目標と全体E2Eは未完了。

Properties／Document設定の外観入力欄を`AppearanceControls`、色選択sessionと対象別適用・イベント接続を`AppearancePalette`へ分離。appからパレットsessionと使用中色収集・HTML生成を除去した。構文206件・単体423件・統合UI／保存互換E2E114件が成功。app.jsは19,914行。次はPropertiesの選択対象／表示モデルと入力編集transactionを整理する。全体目標と全体E2Eは未完了。

共有サイドバーhoverと選択／拘束の表示参照を`SelectionHighlight`へ集約。ツリーの選択class更新をViewと表示対象解決へ分離し、呼出し元とDOM生成の存在しない旧一覧用イベント／選択処理を除去した。構文203件・単体420件・統合UI／保存互換E2E114件が成功。app.jsは20,188行。次はPropertiesの表示と編集コマンド、Canvasの広範なhover状態の境界を整理する。全体目標と全体E2Eは未完了。

Sketchツリーの表示索引・図形行・拘束集計を`SketchTreeObjects`、クリック選択・展開・編集操作の振分けを`SketchTreeController`へ分離。Viewへ表示情報と操作を接続し、図形名のescape、拘束の元配列index、別Sketch選択時の追加選択解除を維持した。構文201件・単体417件・統合UI／保存互換E2E114件が成功。app.jsは20,406行。次はCanvasと共有する選択／hoverの所有者を整理し、Propertiesやツリーから直接参照する操作状態を減らす。全体目標と全体E2Eは未完了。

Sketchツリーの階層／カテゴリ描画・開閉状態・リサイズ操作を`SketchTreeView`へ集約。Document読込はcapture／restore APIで開閉状態を保存し、内部Mapへ直接書き込まない。構文198件・単体414件・統合UI／保存互換E2E114件が成功。app.jsは20,615行。次は図形行と拘束集計の表示モデル、ツリー操作からSelection／Document編集への接続をまとめる。全体目標と全体E2Eは未完了。

OffsetのクリックとEnter確定を既存`OffsetCommand`へ統合。プレビュー計算と入力待ちtargetの同期もcommandが担当し、`OffsetPreviewRenderer`は解決済みデータの描画だけを行う。構文196件・単体412件・統合UI／保存互換E2E114件が成功。app.jsは20,779行。残る大きな責務はBlock編集、Sketchツリー、Properties、Selection編集、拘束操作、ドラッグ／Canvasイベント、Document操作調整、test hook。次は機能単位の統合を優先し、細かな関数抽出だけを繰り返さない。全体目標と全体E2Eは未完了。

Offsetの距離・draft計算を`OffsetGeometry`、Geometry／拘束生成と失敗時復元を`OffsetConstruction`、入力開始・検証・確定を`OffsetCommand`へ分離。Geometry計算はDocument非依存、生成は現在の編集対象と採番を明示し、入力は選択状態と生成処理へ接続する。構文195件・単体410件・統合UI／保存互換E2E114件が成功。app.jsは20,896行。次は残ったOffsetクリック／hover／Enterイベントとプレビュー描画をcommand／rendererへ接続し、作図モード全体の開始・取消を整理する。全体目標と全体E2Eは未完了。

Offsetの対象・向き付きチェーン・選択確定を`OffsetSelection`へ集約。接続判定も同じ所有者に移し、クリック／Enter／モード切替／取消／test hookからの3変数への直接書込みを除去した。構文191件・単体407件・統合UI／保存互換E2E114件が成功。app.jsは21,162行。次はOffsetの距離測定・draft・入力開始・生成／失敗時復元を既存選択状態と接続し、機能全体のcommand境界を整理する。全体目標と全体E2Eは未完了。

寸法入力ControllerへCanvasキーによるbuffer編集と入力中表示更新を統合。Enterの入力開始／確定とEscape取消は明示したコールバックへ委譲し、モデル更新とは分離する。構文189件・単体404件・統合UI／保存互換E2E114件が成功。app.jsは21,278行。次はOffsetの選択状態（source、chain entries、選択確定フラグ）をまとめて所有させ、選択開始・追加・確定・取消とプレビュー／生成への接続を機能単位で整理する。現在の3変数はクリック・hover・Enter・モード切替・test hookに分散しており、単純な関数移動では解消しない。全体目標と全体E2Eは未完了。

寸法値・式の確定を`DimensionValueCommand`へ分離。既存寸法の更新失敗時のsnapshot復元と入力継続、成功時の履歴記録、初回寸法の拡縮と画面上の大きさの復元を同じ確定処理で調整する。構文189件・単体402件・統合UI／保存互換E2E114件が成功。app.jsは21,330行。次は入力待ちコマンドの開始・キーボード更新・取消を整理する。全体目標と全体E2Eは未完了。

寸法入力のlayout・所有Sketchの表示設定・入力検証とview同期を`DimensionInputController`へ分離。pendingCommandは読取りだけとし、距離の式評価とOffsetの数値判定、表示後の検証順序を維持した。構文187件・単体398件・統合UI E2E93件が成功。app.jsは21,374行。次は入力待ちコマンドの更新／確定／取消の所有者を整理する。全体目標と全体E2Eは未完了。

寸法入力欄のDOM操作を`DimensionInputView`へ分離。位置・角度・文字サイズ・幅・非表示・invalid表示・focus予約を担当し、寸法layoutと数式評価は呼出し側へ残す。表示後に検証結果を反映する順序と、focus予約後に取消された場合の非表示判定を維持した。構文185件・単体394件・統合UI E2E93件が成功。app.jsは21,410行。次は入力待ちコマンドの更新／取消と表示用値の生成を整理する。全体目標と全体E2Eは未完了。

入力待ちコマンドと描画モードからカーソルを表示する処理を`CommandCursor`へ分離。コマンド状態への直接依存を除き、種類とモードだけを値で渡す。SVG cacheと表示元の状態もviewが所有する。構文183件・単体391件・統合UI E2E93件が成功。app.jsは21,426行。次は入力待ち状態の表示依存（寸法入力欄）と取消・モード遷移の境界を整理する。全体目標と全体E2Eは未完了。

フィレットの最初の線と、半径配置から生成・拘束安定化・失敗時復元・履歴記録までを`FilletCommand`へ分離。pendingCommandは既存取消規則を維持する移行用get／setで接続する。構文181件・単体388件・統合UI／保存互換E2E114件・フィレットドラッグ回帰1件（3,744 previews）が成功。app.jsは21,495行。次は共通の入力待ち状態と作図モード遷移の境界を整理する。全体目標と全体E2Eは未完了。

連続線作図の開始Point、直交・最小距離補正と確定を`LineCommand`へ分離し、TransientAuthoringの復元記録へ接続した。開始点の直接書込みをreset／clickへ置き換え、プレビューも同じ直交補正を使用する。構文179件・単体383件・統合UI／保存互換E2E114件が成功。app.jsは21,583行。次は作図モード開始／終了の共通調整と、残る操作固有の状態を整理する。全体目標と全体E2Eは未完了。

矩形の開始Pointと二回クリック確定を`RectangleCommand`へ分離。各モード切替・取消はresetへ委譲し、プレビューは読出し専用の開始点を参照する。最小辺長、対角点snapの解除、四辺の水平／垂直拘束と確定後の更新順を維持した。構文177件・単体379件・統合UI／保存互換E2E114件が成功。app.jsは21,657行。次はLine作図の状態と確定処理を既存TransientAuthoringへ接続して分離する。全体目標と全体E2Eは未完了。

点・線作図の3個の復元記録を`TransientAuthoring`へ分離し、モデルと採番の復元・一時点判定・Selection整理・直前履歴破棄を同じ所有者へまとめた。appから復元記録への直接書込みを除き、作成Point／Lineの通知APIへ変更。構文175件・単体376件・統合UI／保存互換E2E114件が成功。app.jsは21,693行。次はモード遷移と各作図commandの開始／取消の接続を整理する。全体目標と全体E2Eは未完了。

スプラインのクリック判定・開閉曲線確定・ダブルクリック確定を`SplineCommand`へ分離。SplineDraft、Geometry生成、スナップ、選択・解析・履歴・表示更新を明示して接続した。appの初期化順序でGeometry生成とスナップが先行するよう調整。構文173件・単体372件・Spline／統合UI／保存互換E2E120件が成功。app.jsは21,803行。次は作図開始時のモード切替と他コマンド取消の責務を整理する。全体目標と全体E2Eは未完了。

スプライン作成中の通過点・Point rollback・最後のクリック情報を`SplineDraft`へ分離。開始、記録破棄、取消、Backspace、ダブルクリックの追加点除去を所有させ、appから3個の状態変数を除いた。既存Point保護と単点削除時に採番を戻さない規則を維持。構文171件・単体368件・Spline／統合UI／保存互換E2E120件が成功。app.jsは21,844行。次はスプライン確定・モード切替と残る作図操作の責務を整理する。全体目標と全体E2Eは未完了。

中ボタンのパン操作と全体表示用クリック履歴を`CanvasNavigation`へ分離した。開始・移動・終了・リセットを同じ所有者へまとめ、appはイベントの振分けを担当する。既存の計算順序、450ms／12pxの境界、Documentリセット時の状態破棄を維持。構文169件・単体364件・統合UI／保存互換のE2E114件が成功。app.jsは21,885行。次は残る描画操作のsession・取消処理を責務単位で整理する。全体目標と全体E2Eは未完了。

Document生成・内容消去・既定Sketchと表示設定の復元を`DocumentState`へ分離。編集scopeをDocumentへ戻し、内容消去→操作取消／cache破棄／採番リセット→既定値復元の順序を維持した。構文167件・単体360件が成功。関連E2E162件中161件が成功し、file URLテストの固定読込一覧へ新規3moduleを追加した後、残り1件も再実行成功。app.jsは21,930行。次は操作状態の所有者を分離し、resetModelStateの操作取消を各所有者へ委譲する。全体目標と全体E2Eは未完了。

続いてDocument読込の候補生成とモデル反映を`DocumentLoading`へ分離した。読込codec間の接続・版別検査・移行はdecode、リセット後のデータ反映はinstallが担当し、Sketchツリー復元・履歴・修復通知はapp側に残した。配列参照・拘束参照とcache無効化／円弧正規化の順序を保持。構文165件・単体357件・保存互換／Block／ファイル安全性／派生Instance／Sketch投影のE2E102件が成功。app.jsは21,980行。次はDocumentリセットと編集操作状態のリセットの境界を整理する。全体目標と全体E2Eは未完了。

継続指示により再開。`codex/composition-root-next`で読込後の採番復元を`DocumentSequences`へ分離した。入力を変更せず、Documentと全Definitionから予約対象と次番号を返す。Windowsのコマンド長制限に達した構文チェックは、対象161件を維持して新規2件を追加し、`tools/check-syntax.js`へ移した。構文163件・単体352件・Block／保存互換のE2E58件が成功。app.jsは22,056行で、数百行化の目標は未完了。次は読込候補の最終反映とUI復元の境界を整理する。

前回以降のSolver修正47494f0は取り込み済み。全体E2Eと航空機ドラッグの再検証はこの段階では実施しておらず、最終検証に残る。以下は一時停止時点の記録。

## 前回の一時停止地点（2026-09-21）

再開用ブランチは`codex/composition-root-next`。developの投影SketchのみのBlock配置修正（a995427）も統合した。検証は構文チェック・単体346件・Offset全10,296プレビューまで成功。全体E2Eは航空機A2/A3ドラッグで10分のタイムアウトが発生し、その後ユーザーのクレジット節約の指示により停止した。全313件の成功は未確認で、再開時にはこのタイムアウトの調査と全体検証が必要。今回はユーザー承認により残りのテストを省略してコミット・developへの統合を行う。

リファクタリング全体はユーザーの依頼で一時停止中。最後に完了した段階はDocumentGeometryPersistenceの分離で、次の着手箇所は読込結果の最終反映と採番予約の整理である。app.jsの数百行化は未完了。

Offset特異姿勢の確認は解決済み。ユーザー承認に従い局所Jacobianの判定を維持し、既知の特異姿勢でP12=完全拘束・L5=支持位置拘束を明示的に期待する回帰テストへ修正した。全体自由度7、残差、ほかの要素と前後のsampleの表示検証は維持する。以下の進捗記録にある「Offset確認未完了」は、その段階での履歴である。

## 数百行にする実現性と代償

設計上は実現可能。起動時にDocument／workspace、編集service、操作controller、読出しquery、Canvas renderer、DOM view、入力routerを生成し、必要な相手だけを接続する構成なら、app自体に各機能の実装を置く必要はない。目標は200〜500行程度だが、空行や宣言を詰めて達成する数値ではない。

現在の難所はファイル数ではなく、Block編集時の対象切替、操作ごとに異なるrollback、UI更新から実行されるモデル補完・解析、Projection/cacheを介した描画と編集の結合にある。テストhookだけを外へ出しても、これらの結合は残る。

| 代償・リスク | 対応 |
| --- | --- |
| 処理を追う際のファイル間移動が増える | 責務単位のfolderと公開APIを使い、現在の所有者をarchitecture specに記録する |
| 移行中は旧操作との接続codeが一時的に増える | 移行用bindingを明記し、機能側が新APIへ移った段階で削除する |
| 過剰な抽象化で引数・callbackが増える | 無関係なserviceを束ねたcontextや共通event busを導入しない。直接の呼出しと必要なportだけを接続する |
| 確定・取消・依存更新の順序が変わる | 操作別のrollback規則を保持し、取消・確定・Undo・保存再読込の組合せで検証する |
| read viewや通知の追加でdragが遅くなる | Geometryの同一性と同期pipelineを保ち、frameごとのDocument複製や全面通知を避け、既存性能テストを維持する |
| 大きな移行では原因の追跡が難しくなる | 分離単位で検証し、独立したcommitを残す。別の巨大なApplicationへ移す中間完了にはしない |

既存の`src/document/`、`src/editing/`、`src/geometry/`、`src/persistence/`、`src/ui/`を基礎にする。操作と描画が独立する段階で`src/commands/`と`src/rendering/`を追加し、test専用のfixture／検査APIは`tests/`側へ整理する。空の階層を先に増やさず、実際の所有者が成立した時点で配置する。

## 完了条件

- app.jsは概ね200〜500行で、機能の状態・計算・描画・DOMイベント本体を持たない。
- Document、編集scope、Selection、実行中操作、履歴、描画cacheの所有者が明示されている。
- 別名の巨大なApplication／contextへ旧closureを移していない。module間の循環依存がなく、必要なscopeと限定したAPIを渡す。
- UI、操作別のrollback、Blockのlocal履歴、保存version 22と旧形式互換、file／HTTP起動を維持する。
- 全体検証を通し、段階ごとのcommitと結果を残してdevelopへ統合・Pushする。

## 移行の順序

1. Document本体と現在の編集scopeを分離する。Block編集・Undo復元・保存済みDefinitionのParameter評価でDocumentの配列を差し替える経路を廃止する。
2. 操作の確定・取消・履歴を操作別の規則と共通の実行機構に分ける。Selectionと実行中コマンドの状態をそれぞれの所有者へ集める。
3. 点・線などの作図から機能ごとの操作APIへ移行し、Constraint・Parameter・Sketch・Block・派生Instanceの操作を続ける。巨大な共通contextを導入せず、移行済みの旧経路を削除する。
4. Geometry読出し・Projection・cacheの境界を整理し、Canvas描画、UI表示データ、DOM panel、入力振分けを分離する。表示更新に含まれるモデル補完・解析は操作側へ移す。
5. テストfixtureと検査hookを機能APIに接続して分離する。app.jsを接続だけにし、移行用bindingを削除する。

モジュール単位の入力・出力と現行仕様を確認してから移す。表示と操作の仕様判断が新たに必要になった場合は、既存仕様と照合して扱う。操作順序を変える汎用event bus、毎frameのモデル全複製、保存形式変更、UI framework導入はこの移行に含めない。

## 進捗

- `0f120cc`: 編集scopeを分離。`EditingWorkspace`はDocumentへの参照と現在のscope、scopeの復元用checkpointを所有する。Document名・単位・既定外観・Definition registryはDocument側へ明示した。単体139件、関連E2E169件、追加した同一Instance IDの取消・確定・再読込E2E1件が成功した。
- scope checkpointにGeometryInstanceを含め、Blockから戻るときにDocumentの派生Instanceを失う経路を解消した。DocumentとBlockの両方に`FI1`を置く回帰テストで区別を確認する。
- Selectionの状態と選択規則を`src/editing/selection.js`へ分離。15個の独立変数を廃止し、19個の選択・対象読出し関数を所有者へ移した。操作の入力列とhoverは別の責務として残す。`npm run test:all`は構文検査、単体144件、E2E304件が成功（E2E 19.4分、skip・expected failureなし）。
- 既存commandの移行用としてapp内の`model` bindingとSolverの対象更新を1か所に残す。これは最終APIではなく、後続の機能分離とともに削除する。
- 言語・テーマ設定とUI翻訳を`src/ui/application_settings.js`へ分離。設定state、storage境界、設定dialogのevent登録・解除を同じ所有者に集める。appは表示更新・再描画・version表示のportを接続する。構文検査、単体148件、関連E2E117件が成功した。
- 拘束参照の判定と依存Nodeの列挙を`src/constraints/references.js`へ分離。参照解決のread portだけを渡し、Document／Blockの対象scopeとProjection cacheをquery内へ隠して取り込まない。構文検査、単体152件、関連E2E200件、反転drag・実PointerとUndoの回帰8件が成功した。
- Sketchの所属・階層・参照関係を扱う28関数を`src/editing/sketch_context.js`へ分離。workspaceの現在scopeと拘束Nodeのread portを使い、appの`model` bindingから切り離す。表示可否・View State・作図モードの条件は含めない。初回browser検証で見つかった読込順を修正し、HTMLと同じ順でmoduleを初期化する検証を追加。修正後は構文検査、単体157件、高密度操作を含む関連E2E212件が成功した。
- Documentと各Blockの履歴stackを`EditHistory.create()`のinstanceへ集約。appのUndo／Redo配列とBlock sessionの履歴配列を廃止し、履歴のAPIを使う。構文検査、単体160件、関連E2E170件が成功した。復元中の記録抑止とsnapshot復元・UI更新のpolicyは引き続き操作側の整理対象とする。
- command、操作transaction、描画、UI、テストhookの分離は未完了。Selectionを更新する機能別の操作も引き続きappから移す。
- 寸法の対象・幾何測定を`src/constraints/dimension_queries.js`、名前空間の補完・寸法採番・式評価・読込検証を`src/parameters/namespace.js`へ分離。28関数の本体を保ち、既定の評価対象をworkspaceの現在scopeから取得する。構文検査、単体166件、関連E2E170件が成功。app.jsは26,550行となったが、数百行の最終目標は未達。
- 派生Instanceの幾何生成とscope内の依存解決を`src/geometry/instance_projection.js`へ分離し、共通のGeometry型・参照・Map登録を`src/geometry/objects.js`へ集約。元Geometryへのgetter、共有点、順逆変換、従来のcacheを維持する。構文検査、単体172件、性能・Block・Hatch・保存を含む関連E2E212件が成功。app.jsは26,341行。Block投影とcacheの所有者を整理してから描画側の分離へ進む。
- 寸法の型判定を保存moduleから`DimensionQueries`へ移し、Parameter評価から保存への依存を解消。Parameter単体検証は保存・UIを読み込まずに実行する。構文検査、単体172件、Parameterとfile起動のE2E7件が成功。app.jsは26,340行。
- BlockのGeometry・Annotation・Hatch投影と永続cacheを`src/geometry/block_projection.js`へ移し、Definition検索・有効Sketch判定を`src/document/block_catalog.js`へ分離。入れ子と読込専用resolver、部分・全cache無効化を維持する。構文検査、単体178件、性能を含む関連E2E212件が成功。app.jsは26,033行。

- Geometryの展開読出しと同期read cacheを`src/geometry/read_model.js`へ分離。workspace、Block／派生Instanceの投影、Hatchの有無、計測portを接続し、cache寿命と外観memoを所有者へ集約した。構文検査・単体184件が成功。関連E2E213件のうち212件が成功し、残る1件は分離前にも再現した旧Offset仕様前提の生成図面が原因だった。生成図面を修正し、作図・拘束復元・性能・ドラッグ関連14件は期待拘束数修正後の再実行を含め成功した。

- 拘束候補の分類・寸法対象・通常／参照／対称拘束の生成15関数を`src/constraints/candidates.js`へ分離。入力operandと限定したSketch・向き補正portを使い、Selectionと確定transactionを持たない。関数本体の比較でport置換以外の処理維持を確認。構文検査、単体190件、作図性能・Spline・保存互換を含む関連E2E131件が成功。app.jsは25,636行で、操作・描画・UI・テストhookの分離は引き続き未完了。

- `src/rendering/viewport.js`へ表示原点・倍率と座標変換／fit／表示範囲の計算を集約。appとテストhookの直接代入を更新APIへ、Block編集の退避を独立snapshotへ置換した。構文検査・単体193件と追加した表示範囲の単体1件、Block・保存・UI関連E2E149件が成功。Canvas描画本体と入力状態は次の分離対象として残る。

- 寸法文字幅・矢印形状の計算14関数と2種のcacheを`src/rendering/dimension_metrics.js`へ集約。Canvas contextとviewportだけを接続し、寸法配置・編集状態とは分ける。移動した関数本体の一致を確認し、構文検査・単体197件・寸法表示と作図性能を含むE2E104件が成功。

- 線・円・円弧・Splineの描画を`src/rendering/geometry_renderer.js`へ分離。選択やhover変数をrendererに渡さず、表示状態のadapterをapp側にまとめた。制御した表示状態2,048通りのCanvas命令を分離前と比較し一致を確認。構文検査・単体200件・Block／Spline／表示／性能を含むE2E146件が成功。可視性・表示順・表示状態のadapterは後続の分離対象として残る。

- `src/rendering/drawing_stack.js`へ描画順の組み立て・通常図形の高速経路・同種batchの描画を分離。Documentの順序規則は`DrawingOrder`に残し、scope／Geometry読出し／可視性／painterを接続する。構文検査・単体203件と追加したHatch可視性の単体1件、描画順・Hatch・Block・性能のE2E57件が成功。

- 描画分離の全体検証は構文・単体204件が成功、E2Eは304件成功／Offset連鎖1件失敗（19.1分）。同じ端点操作は分離前の`a5784b1`でも再現し、全体自由度7のまま特異姿勢でP12の局所微小変位が閾値以下になることを取得図面で確認した。判定仕様とテスト期待の整合は別途確認中。
- 参照画像のcacheと描画を`ReferenceImageRenderer`へ分離。可視性・選択・較正sessionの判断は呼出し側に残す。module読込と新規単体2件、参照画像のE2E2件が成功。

- 注記の文字・引出線・終端記号とworld文字寸法を`AnnotationRenderer`へ分離。Canvas状態・表示色・参照点解決を限定したportで接続し、previewの明示startと確定済み参照点を区別する。構文検査、単体209件、characterization／UIのE2E113件が成功。Offset特異姿勢の確認は未回答のため、関連判定と期待値は未変更。

- `CanvasSurface`へbitmap寸法・DPR・ResizeObserver・stroke状態保護・線種dashを集約。表示原点／倍率はViewport、resize後のUI同期は呼出し側へ分け、appの描画metricsとobserver変数を廃止した。構文検査、単体212件、Canvas／Hatch／参照画像を含むE2E101件が成功。

- Hatchのclip・pattern線・solid塗りを`HatchRenderer`へ分離し、解決済み輪郭のboundsを`HatchRegionEngine`に集約した。DocumentやSelectionをrendererへ渡さず、境界Geometryの再描画順も維持する。移動した4関数の本体比較、構文検査、単体216件、Hatch／Block／重なり順／UIのE2E137件が成功。

- `DimensionRenderer`へ直線／角度寸法のCanvas命令、ラベル、編集枠、終端記号、数式マークを分離。外観・配置・延長線計画は呼出し側で準備し、rendererへのSketch／Constraint依存を避けた。準備済み入力768通りのCanvas命令・style・数式マークを分離前と比較して一致。構文検査、単体220件、UI／characterization／作図性能のE2E125件が成功。寸法配置と操作controllerの分離は未完了。

- 寸法anchor・相対配置・ラベル位置を`DimensionPlacement`、補助線・hit範囲・描画計画を`DimensionLayout`へ分離。前者はDocument参照なし、後者は現在scopeの線一覧をread portで受け取る。角度ラベル補完の更新も明示して維持した。31関数の本体比較、構文検査、読込順修正後の単体228件、Block／UI／characterization／作図性能のE2E161件が成功。app.jsは24,153行で、操作・UI・テストhook等の分離は引き続き未完了。

- 長穴を`SlotCommand`と`SlotConstruction`に分離し、中心2点の操作状態をappから廃止した。入力再指定・Esc・生成前checkpoint・入力消去からsolve失敗復元までの既存順序を維持する。構文検査、単体233件、長穴のUndo／Redo・取消・保存再読込を追加した関連E2E162件が成功。高密度図面の長穴確定は233ms（基準350ms）。共通のGeometry追加とsnapshot／solveは移行用portとしてappに残り、他の操作と合わせて後続で分離する。

- 円・中心指定円弧・3点円弧の入力状態5個を`CircularCommands`へ、中心取得・図形生成・snap適用と3点円弧の生成不能時のPoint／採番復元を`CircularConstruction`へ分離。中心Pointを即時作る方式と座標入力だけ保持する方式、reset範囲、solve結果の扱いを維持した。構文検査、単体240件、各作図のUndo／Redo・保存再読込を追加した関連E2E165件が成功。高密度図面の円・円弧確定は117ms（基準350ms）。

- Geometry採番5種を`GeometryIds`へ、通常Geometry追加と最小形状補正8関数を`GeometryCreation`へ分離。scope切替後の参照、生成不能時の採番消費、操作ごとの部分復元を維持し、円弧constructionもcheckpoint APIへ接続した。8関数の本体比較、構文検査、単体246件、Spline／Block／コピー／保存互換／UI／作図性能のE2E176件が成功。高密度図面の作図clickは最大198ms（基準350ms）。全体目標は未完了で、Offset特異姿勢の判定仕様も確認中。

- 編集中の値・Geometry構造のsnapshot／復元4関数を`EditingCheckpoint`へ分離。実体参照、操作別の復元範囲、投影cacheと拘束解析の無効化順序を維持し、保存用snapshot・Undo stack・scope切替とは責務を分けた。4関数の本体比較、構文検査、単体252件、Block／Free Instance／Spline／ドラッグ／UI／作図性能のE2E208件が成功。全体目標とOffset特異姿勢の確認は引き続き未完了。

- トリム交点・削除区間・候補選択の18関数を`TrimQuery`へ分離。現在scopeと対象判定・最小長を明示し、Canvasの7px hit許容幅はapp側でworld距離へ変換する。Geometryを変更せず、交点sourceの実体参照と既存の符号付き円弧・循環区間・補助図形規則を維持した。18関数の本体比較、構文検査、単体259件、トリム拘束移送を含むUI／保存互換／作図性能のE2E126件が成功。図形の更新と拘束整理を含む操作側の分離は引き続き進める。

- トリムの図形変更・拘束整理／移送14関数を`TrimEditing`へ分離。GeometryCreation、ConstraintReferences、TrimQueryを接続し、UI・solve・履歴から独立させた。最小形状補正2関数もGeometryCreationへ集約した。16関数の本体比較、構文検査、単体266件、トリム・Block・Spline・保存互換・作図性能を含むE2E168件が成功。確定判定とUI／履歴の順序はapp側の操作処理に残り、全体のcomposition root化は未完了。

- R面取りを読出し計画の`FilletGeometry`と変更処理の`FilletConstruction`へ分離。共有Point判定、最大半径制限、3点・1円弧・7拘束の追加、方向hint同期の順序を維持した。7関数の本体比較、構文検査、単体271件、R面取り操作・性能を含むE2E126件が成功。半径入力のsessionと確定／取消の調整は操作側に残り、引き続き分離する。

- 中心線の対象列・支持線・端点・snap入力状態を`CenterlineCommand`へ、幾何計算を`CenterlineGeometry`、追加と部分rollbackを`CenterlineConstruction`へ分離。状態の直接参照を読出しAPIへ接続し、失敗時に入力を残す再指定と確定後の消去順を維持した。幾何4関数の本体比較、構文検査、単体276件、既存E2E167件と追加したUndo／Redo・端点入力取消のE2E1件が成功。全体目標とOffset特異姿勢の仕様確認は引き続き未完了。

- スナップ候補・優先度選択・現在状態を`DrawingSnap`へ、解決済みsnapからの拘束生成を`SnapConstraints`へ分離。円周への共通投影はGeometryKernelへ集約した。appのactiveSnap変数を廃止し、許容幅は画面10pxからworld距離へ変換して渡す。12関数の本体比較、構文検査、単体283件、点／線／円弧／長穴／中心線／Spline／Block／参照Sketch／保存互換／作図性能のE2E188件が成功。汎用拘束追加の循環・冗長判定と入力router／UIの分離は引き続き未完了。

- メニューバーの開閉・ホバーtimer・focus・Escとイベント登録を`ApplicationMenus`へ分離。ツールIDの実行はappからcallbackで接続し、start重複抑止とdispose時のtimer／listener解除を追加した。既存の16ms切替とイベント順序を維持し、構文検査、単体283件、独立DOMの終了／再起動を含むUIのE2E94件が成功。アプリ全体の起動・終了と入力routerの集約は引き続き未完了。

- Parameterダイアログのsessionと編集・名前確定・依存削除・追加・評価・dirty判定を`ParameterDialogDraft`へ分離。appのsession変数と行への直接書込みを廃止し、読出し専用の行snapshotと更新APIへ接続した。モデルへの適用・solve・復元順序は維持する。既存5関数の本体比較、構文検査、単体289件、Document／BlockのParameter編集・UI・保存互換のE2E150件が成功。DOM表示と適用処理の分離、全体目標、Offset特異姿勢の確認は未完了。

- Parameterダイアログの入力行・寸法出所・エラーのDOM表示を`ParameterDialogView`へ分離。下書きsnapshotと評価結果を明示的に渡し、モデル変更と評価はViewに持たせない。構文検査、単体289件、関連E2E150件が成功。入力イベント・適用処理の分離、数百行への縮小、Offset特異姿勢の確認は未完了。

- Parameterダイアログの入力イベント・開閉・scope切替・未適用変更の確認を`ParameterDialogController`へ分離。下書きとViewを接続し、適用とCanvas上の寸法取得はcallbackに限定した。start重複抑止とdispose／再start、適用失敗時の切替／終了拒否を独立DOMで検証。構文検査、単体289件、関連E2E151件が成功。モデル適用・復元の分離と全体目標は未完了。

- Parameterの下書き反映・拘束解決結果判定・保存Definition伝播・失敗時復元の順序を`ParameterApplication`へ分離。appは編集scope別のsnapshotとSolver・履歴・表示を接続する。従来の例外境界と参照寸法式の保持を維持し、単体298件、関連E2E151件、構文検査が成功。親Block伝播・モデル読込・入力routerなどの分離と、全体目標／Offset特異姿勢の確認は未完了。

- Block Parameterの親階層／Documentへの伝播順序を`BlockParameterPropagation`へ分離。revision更新・投影cache無効化・失敗時中断を維持し、rollbackはParameterApplicationへ委譲する。構文検査、単体305件、関連E2E150件が成功。拘束再構築・モデル読込・入力routerなどの分離と全体目標／Offset特異姿勢の確認は未完了。

- 投影Geometry更新後の拘束実体参照再構築を`ConstraintRebinding`へ分離。Definitionでは復元不能の拘束を除去し、Documentでは失敗として元配列を保持する既存ポリシーを維持した。構文検査、単体310件、Block／同期インスタンス／保存互換／UIのE2E172件が成功。モデル読込・入力routerなどの分離と全体目標／Offset特異姿勢の確認は未完了。

- 読込候補Blockの所有関係復元と配置循環検査を`BlockOwnershipPersistence`へ分離。旧形式の親推定と明示parentDefinitionIdの整合性検査を維持し、現在のDocumentへの反映とは分けた。構文検査、単体319件、Block／保存互換／UIのE2E150件が成功。loaderの残り、入力routerなどの分離と全体目標／Offset特異姿勢の確認は未完了。

- 保存Block一覧からの読込候補生成を`BlockDefinitionPersistence`へ分離。既存のSketch／Geometry／要素codecを組み合わせ、版別検査と後段の親・Instance・拘束接続用metadataを所有する。処理本体の比較、構文検査、単体327件、Block／ハッチ／参照画像／保存互換／UIのE2E159件が成功。loader後段・入力routerの分離と全体目標／Offset特異姿勢の確認は未完了。

- 派生Instanceの参照／配置正規化・保存形式検査・v19／v20投影移行を`GeometryInstancePersistence`へ分離。現在Sketch補完はapp側wrapperへ残し、保存形式処理から編集状態への依存を除いた。4関数の本体比較、構文検査、単体332件、同期Instance／Sketch投影／Block／保存互換／UIのE2E183件が成功。loaderの接続・反映と全体目標／Offset特異姿勢の確認は未完了。

- 読込候補内のInstance接続とDocument直下のBlock Instance復元を`BlockInstancePersistence`へ分離。読込候補専用resolverと、内外で異なる表示Sketch補完を維持する。3区間の本体比較、構文検査、単体336件、Block／同期Instance／保存互換／UIのE2E172件が成功。拘束接続・読込最終反映と全体目標／Offset特異姿勢の確認は未完了。

- 読込Blockの投影map・注記所属・拘束接続・修復数・後処理順序を`BlockConnectionsPersistence`へ分離。旧版補完と現行版の拒否条件を維持し、現在Documentへの反映から切り離した。処理本体比較、構文検査、単体342件、Block／同期Instance／Sketch投影／保存互換／UIのE2E183件が成功。Document側候補生成・最終反映と全体目標／Offset特異姿勢の確認は未完了。

- DocumentのGeometry・付随要素・拘束・Parameterと不要endpoint処理を`DocumentGeometryPersistence`へ分離。現在のモデルをリセットする前に検証済み候補を返し、最終反映との境界を明示した。処理本体比較、構文検査、単体345件、Block／同期Instance／Sketch投影／ハッチ／参照画像／保存互換／UIのE2E192件が成功。最終反映と全体目標／Offset特異姿勢の確認は未完了。

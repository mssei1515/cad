/* Present geometry authoring labels and diagnostics as text; no model, command or DOM updates. */
(() => {
  "use strict";
  function create({ applicationText }) {
    function hatchRegionErrorText(result) {
      const messages = {
        "invalid-point": ["位置が正しくありません", "Invalid point"],
        "point-on-boundary": ["境界線から離れた領域内をクリックしてください", "Click inside the region, away from its boundary"],
        "open-region": ["クリック位置に閉領域がありません", "No closed region was found at the clicked point"],
        "overlapping-boundary": ["境界に重複する図形があるため判定できません", "The boundary contains overlapping geometry"],
        "missing-boundary": ["境界図形が見つかりません", "Boundary geometry is missing"],
        "changed-topology": ["境界の接続関係が変化しています", "The boundary topology has changed"],
        "open-boundary": ["境界が閉じていません", "The boundary is no longer closed"],
        "collapsed-boundary": ["境界領域がつぶれています", "The boundary has collapsed"],
        "invalid-boundary": ["境界データが正しくありません", "The fill boundary data is invalid"],
      };
      const pair = messages[result?.code];
      return pair ? applicationText(pair[0], pair[1]) : applicationText("閉領域を判定できません", result?.reason || "Could not detect a closed region");
    }

    function offsetChainErrorText(result) {
      const messages = {
        "empty-chain": ["オフセットするチェーンがありません", "There is no chain to offset"],
        "invalid-distance": ["オフセット距離が正しくありません", "The offset distance is invalid"],
        "invalid-segment": ["チェーンに無効な図形があります", "The chain contains invalid geometry"],
        "collapsed-radius": ["指定距離では円弧の半径が成立しません", "An arc radius collapses at this offset distance"],
        "missing-miter": ["角部をマイター接続できません", "A chain corner cannot be joined with a miter"],
        "collapsed-segment": ["指定距離ではチェーンの一部が退化します", "Part of the chain collapses at this offset distance"],
        "self-intersection": ["指定距離ではオフセット結果が自己交差します", "The offset result self-intersects at this distance"],
      };
      const pair = messages[result?.code];
      return pair ? applicationText(pair[0], pair[1]) : applicationText("チェーンをオフセットできません", "The chain cannot be offset");
    }
    function hatchPatternTypeLabel(patternType) {
      if (patternType === "cross") return applicationText("クロス", "Cross");
      if (patternType === "solid") return applicationText("塗りつぶし", "Solid fill");
      return applicationText("平行線", "Parallel");
    }

    function geometryInstanceTypeLabel(type) {
      if (type === "mirror") return applicationText("ミラー", "Mirror");
      if (type === "pattern") return applicationText("直線パターン", "Linear Pattern");
      if (type === "circularPattern") return applicationText("円形パターン", "Circular Pattern");
      return applicationText("スケッチ投影", "Sketch Projection");
    }

    return Object.freeze({ hatchRegionErrorText, offsetChainErrorText, hatchPatternTypeLabel, geometryInstanceTypeLabel });
  }
  window.AuthoringFeedback = Object.freeze({ create });
})();

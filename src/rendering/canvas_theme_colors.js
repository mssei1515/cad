/* Display-only color adaptation; persisted appearance values remain unchanged. */
(() => {
  "use strict";
  function canvasColorChannels(value) {
    const match = String(value || "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return null;
    const hex = match[1].length === 3 ? [...match[1]].map((part) => part.repeat(2)).join("") : match[1];
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  }

  function canvasColorLuminance(channels) {
    const linear = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }

  function canvasColorContrast(first, second) {
    const light = Math.max(canvasColorLuminance(first), canvasColorLuminance(second));
    const dark = Math.min(canvasColorLuminance(first), canvasColorLuminance(second));
    return (light + 0.05) / (dark + 0.05);
  }

  function canvasThemeColor(value, theme) {
    if (theme !== "dark") return value;
    const channels = canvasColorChannels(value);
    if (!channels) return value;
    const background = [15, 23, 42];
    if (canvasColorContrast(channels, background) >= 4.5) return value;
    for (let mix = 0.08; mix <= 1.001; mix += 0.08) {
      const adjusted = channels.map((channel) => Math.round(channel + (255 - channel) * Math.min(1, mix)));
      if (canvasColorContrast(adjusted, background) < 4.5) continue;
      return `#${adjusted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
    }
    return "#ffffff";
  }
  window.CanvasThemeColors = Object.freeze({ color: canvasThemeColor, channels: canvasColorChannels, contrast: canvasColorContrast });
})();

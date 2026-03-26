(function createPotionRendererModule(globalScope, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.DiveGamePotionRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  "use strict";

  const POTION_COLORS = {
    glowInner: "rgba(176, 244, 255, 0.78)",
    glowMid: "rgba(91, 209, 255, 0.34)",
    glowOuter: "rgba(25, 126, 180, 0)",
    cupFill: "rgba(214, 245, 255, 0.24)",
    cupStroke: "rgba(190, 233, 247, 0.82)",
    rimStroke: "rgba(234, 250, 255, 0.9)",
    rimFill: "rgba(231, 248, 255, 0.18)",
    slushBase: "#6ed8ff",
    slushShade: "#3ebfe8",
    slushHighlight: "rgba(237, 252, 255, 0.82)",
    toppingBase: "#ff7fb7",
    toppingShade: "#f25598",
    toppingHighlight: "rgba(255, 216, 234, 0.92)",
  };

  function drawCupGlow(ctx, cx, cy, radius) {
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius);
    glow.addColorStop(0, POTION_COLORS.glowInner);
    glow.addColorStop(0.58, POTION_COLORS.glowMid);
    glow.addColorStop(1, POTION_COLORS.glowOuter);

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCupBody(ctx, x, y, w, h) {
    ctx.fillStyle = POTION_COLORS.cupFill;
    ctx.strokeStyle = POTION_COLORS.cupStroke;
    ctx.lineWidth = Math.max(1.4, w * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.14, y + h * 0.23);
    ctx.lineTo(x + w * 0.86, y + h * 0.23);
    ctx.lineTo(x + w * 0.76, y + h * 0.9);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.98, x + w * 0.24, y + h * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 컵 윗부분 림을 따로 그려 작은 크기에서도 투명 컵으로 읽히게 한다.
    ctx.fillStyle = POTION_COLORS.rimFill;
    ctx.strokeStyle = POTION_COLORS.rimStroke;
    ctx.lineWidth = Math.max(1.6, w * 0.06);
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.23, w * 0.38, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawSlush(ctx, x, y, w, h) {
    ctx.fillStyle = POTION_COLORS.slushShade;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.34, y + h * 0.52, w * 0.18, h * 0.16, -0.28, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.52, y + h * 0.48, w * 0.2, h * 0.18, 0.08, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.66, y + h * 0.56, w * 0.18, h * 0.15, 0.26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = POTION_COLORS.slushBase;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.3, y + h * 0.48, w * 0.18, h * 0.15, -0.3, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.5, y + h * 0.42, w * 0.24, h * 0.2, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.68, y + h * 0.5, w * 0.18, h * 0.15, 0.22, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.5, y + h * 0.64, w * 0.24, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = POTION_COLORS.slushHighlight;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.43, y + h * 0.39, w * 0.08, h * 0.05, -0.2, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.6, y + h * 0.47, w * 0.07, h * 0.045, 0.18, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.42, y + h * 0.58, w * 0.06, h * 0.04, -0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTopping(ctx, x, y, w, h) {
    ctx.fillStyle = POTION_COLORS.toppingBase;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.26, y + h * 0.2);
    ctx.quadraticCurveTo(x + w * 0.34, y + h * 0.1, x + w * 0.44, y + h * 0.13);
    ctx.quadraticCurveTo(x + w * 0.54, y + h * 0.06, x + w * 0.66, y + h * 0.12);
    ctx.quadraticCurveTo(x + w * 0.76, y + h * 0.1, x + w * 0.81, y + h * 0.18);
    ctx.quadraticCurveTo(x + w * 0.74, y + h * 0.26, x + w * 0.63, y + h * 0.27);
    ctx.quadraticCurveTo(x + w * 0.54, y + h * 0.31, x + w * 0.44, y + h * 0.28);
    ctx.quadraticCurveTo(x + w * 0.33, y + h * 0.31, x + w * 0.25, y + h * 0.25);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = POTION_COLORS.toppingShade;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.57, y + h * 0.18, w * 0.12, h * 0.05, -0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = POTION_COLORS.toppingHighlight;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.42, y + h * 0.16, w * 0.1, h * 0.035, -0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  function createPotionRenderer() {
    return function drawPotion(ctx, x, y, w, h) {
      const cx = x + w * 0.5;
      const cy = y + h * 0.5;
      const glowRadius = Math.max(w, h) * 0.82;

      drawCupGlow(ctx, cx, cy, glowRadius);
      drawSlush(ctx, x, y, w, h);
      drawCupBody(ctx, x, y, w, h);
      drawTopping(ctx, x, y, w, h);
    };
  }

  return {
    POTION_COLORS,
    createPotionRenderer,
  };
});

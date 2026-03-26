const test = require("node:test");
const assert = require("node:assert/strict");

const { createPotionRenderer } = require("../js/potion-renderer.js");

function createGradientRecorder() {
  return {
    stops: [],
    addColorStop(offset, color) {
      this.stops.push({ offset, color });
    },
  };
}

function createMockContext() {
  const operations = [];
  let fillStyle = null;
  let strokeStyle = null;
  let lineWidth = 0;

  const context = {
    operations,
    beginPath() {
      operations.push({ type: "beginPath" });
    },
    moveTo(x, y) {
      operations.push({ type: "moveTo", x, y });
    },
    lineTo(x, y) {
      operations.push({ type: "lineTo", x, y });
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      operations.push({ type: "quadraticCurveTo", cpx, cpy, x, y });
    },
    arc(x, y, radius, startAngle, endAngle) {
      operations.push({ type: "arc", x, y, radius, startAngle, endAngle });
    },
    ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle) {
      operations.push({
        type: "ellipse",
        x,
        y,
        radiusX,
        radiusY,
        rotation,
        startAngle,
        endAngle,
      });
    },
    closePath() {
      operations.push({ type: "closePath" });
    },
    fill() {
      operations.push({ type: "fill", fillStyle });
    },
    stroke() {
      operations.push({ type: "stroke", strokeStyle, lineWidth });
    },
    fillRect(x, y, width, height) {
      operations.push({ type: "fillRect", x, y, width, height, fillStyle });
    },
    createRadialGradient() {
      const gradient = createGradientRecorder();
      operations.push({ type: "createRadialGradient", gradient });
      return gradient;
    },
    save() {
      operations.push({ type: "save" });
    },
    restore() {
      operations.push({ type: "restore" });
    },
  };

  Object.defineProperty(context, "fillStyle", {
    get() {
      return fillStyle;
    },
    set(value) {
      fillStyle = value;
      operations.push({ type: "setFillStyle", value });
    },
  });

  Object.defineProperty(context, "strokeStyle", {
    get() {
      return strokeStyle;
    },
    set(value) {
      strokeStyle = value;
      operations.push({ type: "setStrokeStyle", value });
    },
  });

  Object.defineProperty(context, "lineWidth", {
    get() {
      return lineWidth;
    },
    set(value) {
      lineWidth = value;
      operations.push({ type: "setLineWidth", value });
    },
  });

  return context;
}

test("포션 렌더러는 파란 슬러시 컵과 핑크 토핑을 그린다", () => {
  const ctx = createMockContext();
  const renderPotion = createPotionRenderer();

  renderPotion(ctx, 10, 20, 48, 60);

  const gradientCall = ctx.operations.find((operation) => operation.type === "createRadialGradient");
  assert.ok(gradientCall, "포션 후광 그래디언트를 생성해야 합니다.");
  assert.deepEqual(gradientCall.gradient.stops, [
    { offset: 0, color: "rgba(176, 244, 255, 0.78)" },
    { offset: 0.58, color: "rgba(91, 209, 255, 0.34)" },
    { offset: 1, color: "rgba(25, 126, 180, 0)" },
  ]);

  const fillStyles = ctx.operations
    .filter((operation) => operation.type === "setFillStyle")
    .map((operation) => operation.value)
    .filter((value) => typeof value === "string");

  assert.ok(fillStyles.includes("rgba(214, 245, 255, 0.24)"), "투명 컵 내부 채움이 필요합니다.");
  assert.ok(fillStyles.includes("#6ed8ff"), "파란 슬러시 메인 컬러가 필요합니다.");
  assert.ok(fillStyles.includes("#ff7fb7"), "핑크 토핑 컬러가 필요합니다.");
});

test("포션 렌더러는 컵 림과 슬러시 입체감을 위한 충분한 도형을 사용한다", () => {
  const ctx = createMockContext();
  const renderPotion = createPotionRenderer();

  renderPotion(ctx, 0, 0, 52, 68);

  const strokeStyles = ctx.operations
    .filter((operation) => operation.type === "setStrokeStyle")
    .map((operation) => operation.value);
  const ellipseCount = ctx.operations.filter((operation) => operation.type === "ellipse").length;
  const arcCount = ctx.operations.filter((operation) => operation.type === "arc").length;

  assert.ok(
    strokeStyles.includes("rgba(234, 250, 255, 0.9)"),
    "투명 컵 상단 림 스트로크가 필요합니다."
  );
  assert.ok(ellipseCount >= 4, "슬러시와 컵 림을 표현하는 ellipse가 충분해야 합니다.");
  assert.ok(arcCount >= 1, "후광 원형 레이어가 필요합니다.");
});

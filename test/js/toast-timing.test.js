const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_TOAST_DURATION_MS,
  TOP_RANK_TOAST_DURATION_MS,
  replaceToastTimer,
  resolveToastDuration,
} = require("../../js/toast-timing");

test("토스트 지속시간 옵션이 없으면 기본값 2200ms를 사용한다", () => {
  assert.equal(resolveToastDuration(), DEFAULT_TOAST_DURATION_MS);
  assert.equal(resolveToastDuration({}), DEFAULT_TOAST_DURATION_MS);
});

test("1등 토스트에는 5000ms 지속시간을 명시적으로 적용할 수 있다", () => {
  assert.equal(resolveToastDuration({ durationMs: TOP_RANK_TOAST_DURATION_MS }), 5000);
});

test("새 토스트를 띄울 때 이전 hide 타이머를 정리하고 새 타이머로 교체한다", () => {
  const calls = [];
  const timerApi = {
    clearTimeout(timerId) {
      calls.push(["clear", timerId]);
    },
    setTimeout(callback, durationMs) {
      calls.push(["set", durationMs, typeof callback]);
      return 99;
    },
  };

  const nextTimerId = replaceToastTimer({
    previousTimerId: 41,
    options: { durationMs: 4800 },
    timerApi,
    onHide() {},
  });

  assert.equal(nextTimerId, 99);
  assert.deepEqual(calls, [
    ["clear", 41],
    ["set", 4800, "function"],
  ]);
});

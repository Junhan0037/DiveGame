(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.DiveGameResultActionGuard = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const RESULT_ACTION_GUARD_MS = 250;

  // 게임 오버 직후 합성 클릭이 결과 화면 버튼으로 새는 구간을 짧게 차단한다.
  function createResultActionUnlockAt(nowMs) {
    return Number(nowMs) + RESULT_ACTION_GUARD_MS;
  }

  function shouldBlockResultAction(unlockAt, nowMs) {
    if (!Number.isFinite(Number(unlockAt)) || Number(unlockAt) <= 0) {
      return false;
    }

    return Number(nowMs) < Number(unlockAt);
  }

  return {
    RESULT_ACTION_GUARD_MS,
    createResultActionUnlockAt,
    shouldBlockResultAction,
  };
});

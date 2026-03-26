(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.DiveGameToastTiming = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const DEFAULT_TOAST_DURATION_MS = 2200;
  const TOP_RANK_TOAST_DURATION_MS = 5000;

  function resolveToastDuration(options = {}) {
    const durationMs = Number(options?.durationMs);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return DEFAULT_TOAST_DURATION_MS;
    }

    return durationMs;
  }

  // 새 토스트를 띄울 때 이전 hide 타이머를 정리해 잔여 타이머를 남기지 않는다.
  function replaceToastTimer({ previousTimerId = 0, options, timerApi = globalThis, onHide }) {
    if (previousTimerId) {
      timerApi.clearTimeout(previousTimerId);
    }

    return timerApi.setTimeout(onHide, resolveToastDuration(options));
  }

  return {
    DEFAULT_TOAST_DURATION_MS,
    TOP_RANK_TOAST_DURATION_MS,
    replaceToastTimer,
    resolveToastDuration,
  };
});

(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.DiveGameScoreSync = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const EXPO_CLOSED_CODE = "EXPO_CLOSED";
  const EXPO_CLOSED_STATUS_MESSAGE = "운영 시간 외에는 랭킹 저장이 불가합니다.";

  // 서버 응답 메타데이터를 Error에 보존해 UI에서 원인을 분기한다.
  function createScoreRequestError(status, payload) {
    const error = new Error(payload?.message || "score request failed");
    error.name = "ScoreRequestError";
    error.status = status;
    error.code = payload?.code || "SCORE_REQUEST_FAILED";
    error.payload = payload || null;
    return error;
  }

  function isExpoClosedError(error) {
    return error?.code === EXPO_CLOSED_CODE;
  }

  return {
    EXPO_CLOSED_CODE,
    EXPO_CLOSED_STATUS_MESSAGE,
    createScoreRequestError,
    isExpoClosedError,
  };
});

(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.DiveGameLeaderboardNotice = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const TOP_RANK_STAFF_TOAST_MESSAGE = "1등입니다. 현장 스태프에게 직접 인증해 주세요.";
  const SCORE_MATCH_TOLERANCE = 0.05;

  // 결과 화면 하이라이트와 동일한 기준으로 같은 기록인지 판정한다.
  function isSameScoreEntry(entry, lastScore) {
    if (!entry || !lastScore) {
      return false;
    }

    return (
      entry.name === lastScore.name &&
      Math.abs(Number(entry.depth) - Number(lastScore.depth)) < SCORE_MATCH_TOLERANCE
    );
  }

  function isCurrentPlayerTopRank(entries, lastScore) {
    return isSameScoreEntry(entries?.[0], lastScore);
  }

  return {
    TOP_RANK_STAFF_TOAST_MESSAGE,
    isCurrentPlayerTopRank,
    isSameScoreEntry,
  };
});

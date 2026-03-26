const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TOP_RANK_STAFF_TOAST_MESSAGE,
  isCurrentPlayerTopRank,
} = require("../../js/leaderboard-notice");

test("현재 플레이어 기록이 랭킹 1위와 일치하면 현장 인증 안내 대상이 된다", () => {
  const entries = [
    { name: "김다이버", depth: 12.04 },
    { name: "홍길동", depth: 11.8 },
  ];
  const lastScore = { name: "김다이버", depth: 12.0 };

  assert.equal(isCurrentPlayerTopRank(entries, lastScore), true);
});

test("현재 플레이어 기록이 1위가 아니면 현장 인증 안내 대상이 아니다", () => {
  const entries = [
    { name: "홍길동", depth: 12.5 },
    { name: "김다이버", depth: 12.0 },
  ];
  const lastScore = { name: "김다이버", depth: 12.0 };

  assert.equal(isCurrentPlayerTopRank(entries, lastScore), false);
});

test("랭킹 1위와 이름이 다르면 현장 인증 안내 대상이 아니다", () => {
  const entries = [{ name: "홍길동", depth: 12.0 }];
  const lastScore = { name: "김다이버", depth: 12.0 };

  assert.equal(isCurrentPlayerTopRank(entries, lastScore), false);
});

test("현장 인증 안내 토스트 문구는 운영 문구로 고정한다", () => {
  assert.equal(TOP_RANK_STAFF_TOAST_MESSAGE, "1등입니다. 현장 스태프에게 직접 인증해 주세요.");
});

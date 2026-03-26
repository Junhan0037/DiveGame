const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EXPO_CLOSED_CODE,
  EXPO_TIMEZONE,
  createExpoClosedResponseBody,
  isScoreSubmissionOpenAt,
} = require("../../netlify/functions/score-policy");

test("한국시간 오전 9시 39분에는 저장이 차단된다", () => {
  const blockedTime = new Date("2026-03-26T00:39:00.000Z");

  assert.equal(isScoreSubmissionOpenAt(blockedTime), false);
});

test("한국시간 오전 9시 40분에는 저장이 허용된다", () => {
  const openTime = new Date("2026-03-26T00:40:00.000Z");

  assert.equal(isScoreSubmissionOpenAt(openTime), true);
});

test("한국시간 오후 6시 30분에는 저장이 허용된다", () => {
  const openTime = new Date("2026-03-26T09:30:00.000Z");

  assert.equal(isScoreSubmissionOpenAt(openTime), true);
});

test("한국시간 오후 6시 31분에는 저장이 차단된다", () => {
  const blockedTime = new Date("2026-03-26T09:31:00.000Z");

  assert.equal(isScoreSubmissionOpenAt(blockedTime), false);
});

test("이름이 정확히 test면 운영 시간 외에도 저장이 허용된다", () => {
  const blockedTime = new Date("2026-03-26T00:39:00.000Z");

  assert.equal(isScoreSubmissionOpenAt(blockedTime, "test"), true);
});

test("이름 앞뒤 공백을 제거한 뒤 test면 운영 시간 외에도 저장이 허용된다", () => {
  const blockedTime = new Date("2026-03-26T00:39:00.000Z");

  assert.equal(isScoreSubmissionOpenAt(blockedTime, " test "), true);
});

test("대소문자가 다른 Test는 테스트 계정으로 인정되지 않는다", () => {
  const blockedTime = new Date("2026-03-26T00:39:00.000Z");

  assert.equal(isScoreSubmissionOpenAt(blockedTime, "Test"), false);
});

test("운영 시간 외 응답 본문은 전용 오류 코드를 포함한다", () => {
  const payload = createExpoClosedResponseBody();

  assert.deepEqual(payload, {
    ok: false,
    code: EXPO_CLOSED_CODE,
    message: "랭킹 저장은 오전 9시 40분부터 오후 6시 30분까지 가능합니다.",
    allowedHours: "09:40-18:30",
    timezone: EXPO_TIMEZONE,
  });
});

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EXPO_CLOSED_CODE,
  EXPO_CLOSED_STATUS_MESSAGE,
  createScoreRequestError,
  isExpoClosedError,
} = require("../../js/score-sync");

test("점수 저장 실패 응답은 상태 코드와 서버 메시지를 유지한 Error로 변환된다", () => {
  const error = createScoreRequestError(403, {
    code: EXPO_CLOSED_CODE,
    message: "운영 시간 외에는 저장할 수 없습니다.",
  });

  assert.equal(error.name, "ScoreRequestError");
  assert.equal(error.status, 403);
  assert.equal(error.code, EXPO_CLOSED_CODE);
  assert.equal(error.message, "운영 시간 외에는 저장할 수 없습니다.");
});

test("박람회 운영 시간 외 오류는 전용 코드로 식별된다", () => {
  const error = createScoreRequestError(403, {
    code: EXPO_CLOSED_CODE,
    message: "운영 시간 외에는 저장할 수 없습니다.",
  });

  assert.equal(isExpoClosedError(error), true);
});

test("일반 네트워크/서버 오류는 운영 시간 외 오류로 분류되지 않는다", () => {
  const error = createScoreRequestError(500, {
    code: "DB_ERROR",
    message: "DB error",
  });

  assert.equal(isExpoClosedError(error), false);
});

test("운영 시간 외 결과 화면 상태 문구는 고정된 문구를 사용한다", () => {
  assert.equal(EXPO_CLOSED_STATUS_MESSAGE, "운영 시간 외에는 랭킹 저장이 불가합니다.");
});

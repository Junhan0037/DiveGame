const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RESULT_ACTION_GUARD_MS,
  createResultActionUnlockAt,
  shouldBlockResultAction,
} = require("../../js/result-action-guard");

test("게임 오버 직후에는 결과 화면 액션을 잠시 차단한다", () => {
  const unlockAt = createResultActionUnlockAt(1000);

  assert.equal(unlockAt, 1000 + RESULT_ACTION_GUARD_MS);
  assert.equal(shouldBlockResultAction(unlockAt, 1000), true);
  assert.equal(shouldBlockResultAction(unlockAt, unlockAt - 1), true);
});

test("가드 시간이 지나면 결과 화면 액션 차단을 해제한다", () => {
  const unlockAt = createResultActionUnlockAt(1000);

  assert.equal(shouldBlockResultAction(unlockAt, unlockAt), false);
  assert.equal(shouldBlockResultAction(unlockAt, unlockAt + 1), false);
});

test("가드 시각이 없으면 결과 화면 액션을 차단하지 않는다", () => {
  assert.equal(shouldBlockResultAction(0, 1000), false);
});

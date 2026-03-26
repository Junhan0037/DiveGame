const test = require("node:test");
const assert = require("node:assert/strict");

const realDate = Date;

function installMockDate(isoString) {
  const fixedDate = new realDate(isoString);

  global.Date = class extends realDate {
    constructor(...args) {
      if (args.length > 0) {
        return new realDate(...args);
      }
      return new realDate(fixedDate);
    }

    static now() {
      return fixedDate.getTime();
    }

    static parse(value) {
      return realDate.parse(value);
    }

    static UTC(...args) {
      return realDate.UTC(...args);
    }
  };
}

async function runHandler(body) {
  const { handler } = require("../../netlify/functions/score");
  return await handler({
    httpMethod: "POST",
    body: JSON.stringify(body),
  });
}

test("운영 시간 외 일반 계정은 EXPO_CLOSED로 차단된다", async (t) => {
  installMockDate("2026-03-26T00:39:00.000Z");
  delete process.env.DATABASE_URL;
  t.after(() => {
    global.Date = realDate;
    delete process.env.DATABASE_URL;
  });

  const response = await runHandler({
    name: "player",
    phone: "010-1234-5678",
    depth: 12.3,
    character: "prini",
  });

  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 403);
  assert.equal(payload.code, "EXPO_CLOSED");
});

test("운영 시간 외 test 계정은 저장 흐름으로 계속 진행한다", async (t) => {
  installMockDate("2026-03-26T00:39:00.000Z");
  delete process.env.DATABASE_URL;
  t.after(() => {
    global.Date = realDate;
    delete process.env.DATABASE_URL;
  });

  const response = await runHandler({
    name: "test",
    phone: "010-1234-5678",
    depth: 12.3,
    character: "prini",
  });

  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 500);
  assert.equal(payload.message, "DATABASE_URL missing");
});

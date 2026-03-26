const EXPO_CLOSED_CODE = "EXPO_CLOSED";
const EXPO_TIMEZONE = "Asia/Seoul";
const EXPO_ALLOWED_HOURS = "09:40-18:30";
const EXPO_OPEN_MINUTES = 9 * 60 + 40;
const EXPO_CLOSE_MINUTES = 18 * 60 + 30;

const seoulTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EXPO_TIMEZONE,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
});

// 한국시간 기준 시/분을 뽑아 저장 허용 여부 판정에 사용한다.
function getSeoulMinutes(date = new Date()) {
  const parts = seoulTimeFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);

  return hour * 60 + minute;
}

// 운영 인력 테스트용 이름은 시간 제한 없이 허용한다.
function isTestAccountName(name) {
  return (name || "").trim() === "test";
}

// 박람회 운영 시간 내에만 랭킹 저장을 허용한다.
function isScoreSubmissionOpenAt(date = new Date(), name = "") {
  if (isTestAccountName(name)) {
    return true;
  }

  const minutes = getSeoulMinutes(date);
  return minutes >= EXPO_OPEN_MINUTES && minutes <= EXPO_CLOSE_MINUTES;
}

function createExpoClosedResponseBody() {
  return {
    ok: false,
    code: EXPO_CLOSED_CODE,
    message: "랭킹 저장은 오전 9시 40분부터 오후 6시 30분까지 가능합니다.",
    allowedHours: EXPO_ALLOWED_HOURS,
    timezone: EXPO_TIMEZONE,
  };
}

module.exports = {
  EXPO_ALLOWED_HOURS,
  EXPO_CLOSED_CODE,
  EXPO_TIMEZONE,
  createExpoClosedResponseBody,
  isTestAccountName,
  isScoreSubmissionOpenAt,
};

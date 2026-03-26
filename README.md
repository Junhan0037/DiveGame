# DiveGame

박람회 현장에서 QR 코드 또는 URL로 바로 접속해 플레이할 수 있는 모바일 웹 기반 다이빙 게임입니다.
정적 사이트로 배포되며, 플레이 결과는 Netlify Functions를 통해 PostgreSQL에 저장하고 통합 랭킹으로 조회합니다.

## 프로젝트 개요

- 모바일 세로 화면 중심으로 설계된 프리다이빙 테마 아케이드 게임입니다.
- 사용자는 이름과 연락처를 입력하고 개인정보 수집에 동의한 뒤 캐릭터를 선택해 플레이합니다.
- 게임 결과는 서버에 저장되며, 결과 화면에서 랭킹 TOP 10을 바로 확인할 수 있습니다.
- 네트워크가 불안정한 환경을 고려해 점수 임시 저장 및 재전송 큐를 지원합니다.

## 현장 및 게임 화면

### 박람회 현장 사용 모습

현장에서 방문객이 실제로 게임을 체험하고, 운영 부스와 굿즈가 함께 노출되는 상황입니다.

<table>
  <tr>
    <td align="center"><strong>1. 운영 부스 전경</strong></td>
    <td align="center"><strong>2. 현장 굿즈/소품</strong></td>
    <td align="center"><strong>3. 이벤트 안내 보드</strong></td>
    <td align="center"><strong>4. 현장 플레이 모습</strong></td>
  </tr>
  <tr>
    <td align="center"><img src="img/img_1.jpeg" alt="박람회 운영 부스 전경" width="220"></td>
    <td align="center"><img src="img/img_6.jpeg" alt="박람회 현장 굿즈와 소품" width="220"></td>
    <td align="center"><img src="img/img_7.jpeg" alt="박람회 이벤트 안내 보드" width="220"></td>
    <td align="center"><img src="img/img_8.jpeg" alt="박람회 현장 방문객 플레이 모습" width="220"></td>
  </tr>
</table>

### 게임 화면 예시

아래 순서대로 시작 화면, 캐릭터 선택 화면, 게임 플레이 화면, 결과 화면을 한 줄에서 확인할 수 있습니다.

<table>
  <tr>
    <td align="center"><strong>1. 시작 화면</strong></td>
    <td align="center"><strong>2. 캐릭터 선택 화면</strong></td>
    <td align="center"><strong>3. 게임 플레이 화면</strong></td>
    <td align="center"><strong>4. 결과 화면</strong></td>
  </tr>
  <tr>
    <td align="center"><img src="img/img_2.png" alt="게임 시작 화면" width="220"></td>
    <td align="center"><img src="img/img_3.png" alt="캐릭터 선택 화면" width="220"></td>
    <td align="center"><img src="img/img_4.png" alt="게임 플레이 화면" width="220"></td>
    <td align="center"><img src="img/img_5.png" alt="게임 결과 화면" width="220"></td>
  </tr>
</table>

## 핵심 기능

- 입력 화면
  - 이름, 연락처, 개인정보 수집 동의 입력
  - 모바일 키보드에 맞춘 연락처 입력 최적화
- 캐릭터 선택
  - `프린이`
  - `고고다이버`
- 게임 플레이
  - 좌우 터치 버튼 또는 화면 탭으로 이동
  - 데스크톱에서는 방향키 입력 지원
  - 현재 수심은 좌측 상단, 목숨은 우측 상단 HUD에 표시
  - 시작 시 목숨 2개로 시작하고, 장애물 충돌 시 1개 감소
  - 목숨이 줄어들면 `목숨 -1` 피드백을 즉시 표시
  - 보라색 포션이 `5m`, `10m`, `15m`, `20m`, `30m`에서 등장하며 획득 시 목숨 1개 증가
  - `10m`는 합격 기준이지만, 도달 즉시 게임이 끝나지 않도록 유지
  - `고고다이버`는 `5m`를 넘기면 난이도가 빠르게 상승
  - `30m` 이후 전체 난이도가 급격히 증가해 장시간 플레이를 억제
- 결과 및 랭킹
  - 게임 종료 후 최종 수심 표시
  - 서버 기반 통합 랭킹 TOP 10 조회
  - 저장 실패 시 로컬 큐에 적재 후 재전송 시도
  - 랭킹 저장은 한국시간 기준 매일 `09:40`부터 `18:30`까지만 허용
  - 이름이 정확히 `test`인 테스트 계정은 운영 시간과 무관하게 저장/랭킹 확인 가능

## 기술 스택

- Frontend: `HTML`, `CSS`, `Vanilla JavaScript`
- Backend: `Netlify Functions`
- Database: `PostgreSQL`
- Runtime: `Node.js 18.x`
- Deployment: `Netlify`

## 프로젝트 구조

```text
.
├── index.html                  # 화면 구조 및 접근성 마크업
├── css/style.css               # 전체 UI 스타일
├── js/app.js                   # 게임 로직, 화면 전환, API 연동
├── netlify/functions/
│   ├── score.js                # 점수 저장 API
│   └── leaderboard.js          # 랭킹 조회 API
├── _redirects                  # 사용자 경로 -> Netlify Functions 라우팅
└── project.md                  # PRD 및 구현 기준 문서
```

## 게임 흐름

1. 시작 화면에서 이름과 연락처를 입력하고 동의 여부를 체크합니다.
2. `프린이` 또는 `고고다이버`를 선택합니다.
3. 다이빙을 시작해 장애물을 피하면서 더 깊은 수심을 기록합니다.
4. 게임 종료 시 점수를 서버에 저장하고 통합 랭킹을 조회합니다.
5. 네트워크 오류가 발생하면 로컬 큐에 저장한 뒤 재전송을 시도합니다.

## API 개요

### `POST /score`

플레이 결과를 PostgreSQL `dive_scores` 테이블에 저장합니다.
랭킹 저장은 한국시간 기준 매일 `09:40`부터 `18:30`까지만 허용되며, 운영 시간 외에는 `403 EXPO_CLOSED`를 반환합니다.
단, 이름이 정확히 `test`인 테스트 계정은 운영 시간과 무관하게 정상 저장됩니다.

요청 예시:

```json
{
  "name": "홍길동",
  "phone": "010-1234-5678",
  "depth": 12.4,
  "character": "prini"
}
```

응답 예시:

```json
{
  "ok": true,
  "id": 101,
  "created_at": "2026-03-26T03:00:00.000Z"
}
```

운영 시간 외 응답 예시:

```json
{
  "ok": false,
  "code": "EXPO_CLOSED",
  "message": "랭킹 저장은 오전 9시 40분부터 오후 6시 30분까지 가능합니다.",
  "allowedHours": "09:40-18:30",
  "timezone": "Asia/Seoul"
}
```

### `GET /leaderboard?limit=10`

수심 내림차순, 동점 시 저장 시간 오름차순 기준으로 랭킹을 조회합니다.

응답 예시:

```json
{
  "ok": true,
  "data": [
    {
      "name": "홍길동",
      "depth": 18.2,
      "character": "gogodiver",
      "created_at": "2026-03-26T03:00:00.000Z"
    }
  ]
}
```

## 환경 변수

다음 환경 변수는 Netlify 또는 로컬 실행 환경에서 설정해야 합니다.

- `DATABASE_URL`: PostgreSQL 접속 문자열
- `ALLOWED_ORIGIN`: CORS 허용 도메인
- `PGSSLMODE`: PostgreSQL SSL 옵션 (`disable` 가능)

## 로컬 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 두고 필요한 값을 설정합니다.

```env
DATABASE_URL=postgres://username:password@host:5432/dbname
ALLOWED_ORIGIN=http://localhost:8888
PGSSLMODE=disable
```

### 3. Netlify 개발 서버 실행

Netlify Functions까지 함께 확인하려면 Netlify Dev로 실행하는 방식을 권장합니다.

```bash
npx netlify dev
```

기본적으로 다음 경로를 사용할 수 있습니다.

- 앱: `http://localhost:8888`
- 점수 저장 API: `http://localhost:8888/score`
- 랭킹 조회 API: `http://localhost:8888/leaderboard`

## 운영 및 데이터 정책

- 랭킹은 서버 DB 기준으로 통합 관리됩니다.
- 연락처는 기록 저장 용도로만 사용하며 랭킹 화면에는 표시하지 않습니다.
- 행사 종료 후 개인정보를 삭제하는 운영 정책을 전제로 합니다.

## 참고 문서

- PRD: `project.md`
- 개발 규칙: `AGENTS.md`

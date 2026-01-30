(() => {
  "use strict";

  // DOM element cache for fast access
  const DOM = {
    screens: {
      intro: document.getElementById("screen-intro"),
      character: document.getElementById("screen-character"),
      game: document.getElementById("screen-game"),
      result: document.getElementById("screen-result"),
    },
    form: document.getElementById("player-form"),
    nameInput: document.getElementById("player-name"),
    phoneInput: document.getElementById("player-phone"),
    consentInput: document.getElementById("player-consent"),
    btnStart: document.getElementById("btn-start"),
    btnToIntro: document.getElementById("btn-to-intro"),
    btnToGame: document.getElementById("btn-to-game"),
    characterCards: document.querySelectorAll(".card"),
    hudDepth: document.getElementById("hud-depth"),
    hudCharacter: document.getElementById("hud-character"),
    canvas: document.getElementById("game-canvas"),
    btnLeft: document.getElementById("btn-left"),
    btnRight: document.getElementById("btn-right"),
    finalDepth: document.getElementById("final-depth"),
    leaderboardList: document.getElementById("leaderboard-list"),
    leaderboardStatus: document.getElementById("leaderboard-status"),
    btnRetry: document.getElementById("btn-retry"),
    btnHome: document.getElementById("btn-home"),
    toast: document.getElementById("toast"),
  };

  // App-wide configuration values
  const CONFIG = {
    api: {
      score: "/score",
      leaderboard: "/leaderboard",
    },
    canvas: {
      baseWidth: 360,
      baseHeight: 640,
    },
    gameplay: {
      // 수심 진행 속도(미터/초) - 전체 속도 상향
      longfinDepthRate: 10.0,
      shortfinDepthRate: 5.0,
      // 수심 1m당 화면 이동 픽셀 비율
      pixelsPerMeter: 28,
      playerSpeed: 240,
      spawnMin: 0.65,
      spawnMax: 1.1,
      // 캐릭터 시작/목표 위치(화면 비율)
      startScreenRatio: 0.18,
      targetScreenRatio: 0.35,
      maxQueue: 20,
    },
  };

  // Mutable state shared across screens
  const state = {
    player: {
      name: "",
      phone: "",
    },
    character: null,
    depth: 0,
    lastScore: null,
    queueSending: false,
    // 캐릭터 방향(1: 오른쪽, -1: 왼쪽)
    facing: 1,
    // 캐릭터 이동 여부
    moving: false,
  };

  // Input flags for continuous movement
  const input = {
    left: false,
    right: false,
  };

  // Return safe numeric range for physics values
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // Provide a short-lived toast message for feedback
  function showToast(message) {
    if (!message) {
      return;
    }
    DOM.toast.textContent = message;
    DOM.toast.classList.add("is-visible");
    window.setTimeout(() => DOM.toast.classList.remove("is-visible"), 2200);
  }

  // Switch visible screen by id
  function setActiveScreen(screenId) {
    Object.entries(DOM.screens).forEach(([key, section]) => {
      section.classList.toggle("is-active", key === screenId);
    });
    // 캐릭터 선택 화면 노출 시 미리보기 캔버스 동기화
    if (screenId === "character") {
      // 화면 전환 직후 레이아웃이 확정된 뒤 미리보기 애니메이션 시작
      window.requestAnimationFrame(() => {
        renderCharacterPreviews(0);
        startCharacterPreviewAnimation();
      });
    } else {
      // 캐릭터 화면이 아니면 미리보기 애니메이션 중단
      stopCharacterPreviewAnimation();
    }
  }

  // Clean and bound user name input
  function sanitizeName(name) {
    return (name || "").trim().slice(0, 20);
  }

  // Normalize phone input to digits + hyphen only
  function normalizePhone(phone) {
    return (phone || "").trim().replace(/[^0-9-]/g, "");
  }

  // Validate player form inputs before moving to next step
  function validatePlayerInput(name, phone, consentChecked) {
    if (!name) {
      showToast("이름을 입력해 주세요.");
      return false;
    }
    if (!phone) {
      showToast("연락처를 입력해 주세요.");
      return false;
    }
    if (!/^[0-9-]+$/.test(phone)) {
      showToast("연락처는 숫자와 하이픈만 입력 가능합니다.");
      return false;
    }
    if (!consentChecked) {
      showToast("개인정보 수집에 동의해 주세요.");
      return false;
    }
    return true;
  }

  // Format depth value for UI display
  function formatDepth(depth) {
    return `${depth.toFixed(1)}m`;
  }

  // Convert character id to readable label
  function getCharacterLabel(character) {
    return character === "longfin" ? "롱핀" : "숏핀";
  }

  // Random helper for obstacle spawning
  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  // 화면 크기에 따라 버블 개수 산출
  function getBubbleCount(size) {
    const density = Math.round((size.width * size.height) / 12000);
    return clamp(density, 14, 32);
  }

  // 버블 오브젝트 생성(바닷속 느낌)
  function createBubble(size) {
    const radius = randomInRange(size.width * 0.006, size.width * 0.02);
    return {
      x: randomInRange(0, size.width),
      y: randomInRange(0, size.height),
      radius,
      speed: randomInRange(size.height * 0.03, size.height * 0.08),
      drift: randomInRange(-size.width * 0.02, size.width * 0.02),
      alpha: randomInRange(0.15, 0.35),
    };
  }

  // 버블 초기화
  function initBubbles(size) {
    const count = getBubbleCount(size);
    const bubbles = [];
    for (let i = 0; i < count; i += 1) {
      bubbles.push(createBubble(size));
    }
    return bubbles;
  }

  // 버블 위치 업데이트(위로 상승)
  function updateBubbles(bubbles, size, delta) {
    bubbles.forEach((bubble) => {
      bubble.y -= bubble.speed * delta;
      bubble.x += bubble.drift * delta;

      if (bubble.x < -bubble.radius) {
        bubble.x = size.width + bubble.radius;
      }
      if (bubble.x > size.width + bubble.radius) {
        bubble.x = -bubble.radius;
      }

      if (bubble.y + bubble.radius < -20) {
        const reset = createBubble(size);
        bubble.x = reset.x;
        bubble.y = size.height + randomInRange(20, size.height * 0.3);
        bubble.radius = reset.radius;
        bubble.speed = reset.speed;
        bubble.drift = reset.drift;
        bubble.alpha = reset.alpha;
      }
    });
  }

  // 선형 보간 유틸리티
  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  // 수심에 따라 장애물 스폰 간격을 줄여 난이도 상승
  function getSpawnInterval(depth) {
    const normalizedDepth = clamp(depth / 200, 0, 1);
    const minInterval = lerp(CONFIG.gameplay.spawnMin, CONFIG.gameplay.spawnMin * 0.5, normalizedDepth);
    const maxInterval = lerp(CONFIG.gameplay.spawnMax, CONFIG.gameplay.spawnMax * 0.6, normalizedDepth);
    const safeMin = Math.min(minInterval, maxInterval);
    const safeMax = Math.max(minInterval, maxInterval);
    return randomInRange(safeMin, safeMax);
  }

  // 바다 장애물 타입 목록
  const OBSTACLE_TYPES = ["rock", "coral", "seaweed", "jellyfish"];

  // 장애물 타입을 무작위로 선택
  function pickObstacleType() {
    return OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  }

  // 장애물 타입별 기본 크기 계산
  function getObstacleSize(type, size) {
    const base = size.width;
    let width = base * 0.16;
    let height = base * 0.14;

    if (type === "rock") {
      width = base * 0.18;
      height = base * 0.12;
    }

    if (type === "coral") {
      width = base * 0.16;
      height = base * 0.2;
    }

    if (type === "seaweed") {
      width = base * 0.14;
      height = base * 0.28;
    }

    if (type === "jellyfish") {
      width = base * 0.16;
      height = base * 0.2;
    }

    const scale = randomInRange(0.85, 1.15);
    return { width: width * scale, height: height * scale };
  }

  // Load pending queue from localStorage
  function loadQueue() {
    try {
      const raw = window.localStorage.getItem("diveGame.pendingQueue");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  // Persist pending queue to localStorage
  function saveQueue(queue) {
    const bounded = queue.slice(-CONFIG.gameplay.maxQueue);
    window.localStorage.setItem("diveGame.pendingQueue", JSON.stringify(bounded));
  }

  // Send a score payload to the server API
  async function sendScore(record) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(CONFIG.api.score, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("score request failed");
      }

      return await response.json();
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  // Enqueue a score and attempt to flush immediately
  async function enqueueScore(record) {
    const queue = loadQueue();
    queue.push(record);
    saveQueue(queue);
    return await flushQueue();
  }

  // Flush pending scores sequentially to preserve order
  async function flushQueue() {
    if (state.queueSending) {
      return false;
    }

    state.queueSending = true;
    const queue = loadQueue();
    const remaining = [];

    for (const record of queue) {
      try {
        await sendScore(record);
      } catch (error) {
        remaining.push(record);
        break;
      }
    }

    saveQueue(remaining);
    state.queueSending = false;
    return remaining.length === 0;
  }

  // Fetch leaderboard from server
  async function fetchLeaderboard(limit = 10) {
    const response = await fetch(`${CONFIG.api.leaderboard}?limit=${limit}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      throw new Error("leaderboard request failed");
    }

    return await response.json();
  }

  // Render leaderboard entries to the UI
  function renderLeaderboard(entries) {
    DOM.leaderboardList.innerHTML = "";

    if (!entries || entries.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "아직 기록이 없습니다.";
      DOM.leaderboardList.appendChild(emptyItem);
      return;
    }

    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("span");
      const name = document.createElement("span");
      const depth = document.createElement("span");

      rank.className = "rank";
      rank.textContent = `${index + 1}`;
      name.textContent = entry.name;
      depth.textContent = `${Number(entry.depth).toFixed(1)}m`;

      item.appendChild(rank);
      item.appendChild(name);
      item.appendChild(depth);

      // Highlight current player if name + depth matches
      if (
        state.lastScore &&
        entry.name === state.lastScore.name &&
        Math.abs(Number(entry.depth) - state.lastScore.depth) < 0.05
      ) {
        item.classList.add("is-highlight");
      }

      DOM.leaderboardList.appendChild(item);
    });
  }

  // Resize canvas to match CSS size and device pixel ratio
  function resizeCanvas(game) {
    const rect = DOM.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    DOM.canvas.width = rect.width * dpr;
    DOM.canvas.height = rect.height * dpr;
    game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    game.size.width = rect.width;
    game.size.height = rect.height;

    // 플레이어/카메라 기준값 재계산
    game.player.width = game.size.width * 0.11;
    game.player.height = game.player.width * 1.5;
    game.player.x = clamp(game.player.x, 0, game.size.width - game.player.width);
    game.startScreenY = game.size.height * CONFIG.gameplay.startScreenRatio;
    game.targetScreenY = game.size.height * CONFIG.gameplay.targetScreenRatio;
    // 리사이즈에 맞춰 버블을 다시 구성
    game.bubbles = initBubbles(game.size);

    // 리사이즈 시 현재 위치를 화면 좌표로 동기화
    if (game.running) {
      const screenY = game.player.worldY - game.cameraY;
      if (screenY >= game.targetScreenY) {
        game.cameraY = game.player.worldY - game.targetScreenY;
        game.player.y = game.targetScreenY;
      } else {
        game.player.y = screenY;
      }
    } else {
      game.player.worldY = game.startScreenY;
      game.player.y = game.startScreenY;
    }
  }

  // Draw background layers for underwater feeling
  function drawBackground(ctx, size, bubbles) {
    // 밝고 푸른 바다 톤으로 배경 그라디언트 조정
    const gradient = ctx.createLinearGradient(0, 0, 0, size.height);
    gradient.addColorStop(0, "#0f3f73");
    gradient.addColorStop(0.45, "#1f78b5");
    gradient.addColorStop(1, "#3cc1d8");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size.width, size.height);

    // 바닷속 기포(버블) 렌더링
    bubbles.forEach((bubble) => {
      ctx.fillStyle = `rgba(235, 250, 255, ${bubble.alpha})`;
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 다이버 캐릭터(롱핀/숏핀)를 데이브 더 다이버 감성의 스타일로 렌더링(하강 방향)
  function drawPlayer(ctx, player, character, facing, moving, time) {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;

    // 데이브 더 다이버 느낌의 컬러 팔레트(블루 슈트 + 옐로 마스크 + 오렌지 핀)
    const suitBase = "#1d3f7a";
    const suitShade = "#112a52";
    const suitHighlight = "#2f6fd6";
    const maskFrame = "#ffd45a";
    const maskShade = "#f0b83a";
    const skinTone = "#f3c9a3";
    const beard = "#3b2b25";
    const visor = "#7fd9ff";
    const visorHighlight = "rgba(255, 255, 255, 0.55)";
    const tankMain = "#ffcc4d";
    const tankShade = "#e2a93a";
    const strap = "#1a1a1a";
    const glove = "#1a1a1a";
    const boot = "#121820";
    const hair = "#2a1d18";
    const finMain = character === "longfin" ? "#f06d2f" : "#e24d3a";
    const finShade = character === "longfin" ? "#c4511f" : "#c13a2c";
    const outline = "rgba(6, 12, 20, 0.65)";
    const hose = "#e14a33";

    // 좌우 이동 방향에 따라 캐릭터를 좌우 반전하고 대각 하강 포즈를 만들기 위한 회전 적용
    ctx.save();
    const pivotX = x + w * 0.5;
    const pivotY = y + h * 0.58;
    // 이동/정지 상태에 따라 기울기를 다르게 하여 방향성을 강화
    const tiltMoving = 0.24;
    const tiltIdle = 0.14;
    const tiltWave = Math.sin(time * 4.5) * 0.02;
    const tiltBase = moving ? tiltMoving : tiltIdle;
    // 좌/우 전환 시 각도가 반대로 보이지 않도록 부호를 보정
    const tilt = -(tiltBase + tiltWave);
    ctx.translate(pivotX, pivotY);
    // 좌우 반전은 회전 결과를 뒤집기 위해 먼저 적용
    ctx.scale(facing, 1);
    ctx.rotate(tilt);
    ctx.translate(-pivotX, -pivotY);
    const drawX = x;

    // === 하강 방향(아래)으로 바라보는 잠수부 ===
    const lineWidth = Math.max(1, w * 0.05);
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 애니메이션 파라미터(핀/팔/다리 수영 동작)
    const finSwing = Math.sin(time * 9) * h * 0.02;
    const swimPhase = time * 8.2;
    const swimIntensity = moving ? 1 : 0.45;
    const armSwing = Math.cos(swimPhase) * h * 0.04 * swimIntensity;
    const armReach = Math.sin(swimPhase) * w * 0.07 * swimIntensity;
    const armOut = Math.abs(armSwing) * 0.6;
    const legKick = Math.sin(swimPhase) * h * 0.06 * swimIntensity;
    const legSpread = Math.cos(swimPhase) * w * 0.03 * swimIntensity;
    const legOut = Math.abs(legKick) * 0.25;

    // 헤드라이트 연출은 제거(요청 사항)

    // 핀 길이로 롱핀/숏핀 구분 (상단 배치)
    // 롱핀/숏핀 길이 차이를 확실히 구분
    const finHeight = character === "longfin" ? h * 0.32 : h * 0.1;
    const finY = y + h * 0.02 + finSwing + legKick * 0.25;
    const finWidth = w * 0.22;
    const leftFinX = drawX + w * 0.14 - legSpread * 0.4;
    const rightFinX = drawX + w * 0.64 + legSpread * 0.4;

    // 데이브 특유의 통통한 핀 형태를 폴리곤으로 표현
    ctx.fillStyle = finMain;
    ctx.beginPath();
    ctx.moveTo(leftFinX, finY);
    ctx.lineTo(leftFinX + finWidth, finY);
    ctx.lineTo(leftFinX + finWidth * 0.82, finY + finHeight);
    ctx.lineTo(leftFinX + finWidth * 0.18, finY + finHeight);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rightFinX, finY);
    ctx.lineTo(rightFinX + finWidth, finY);
    ctx.lineTo(rightFinX + finWidth * 0.82, finY + finHeight);
    ctx.lineTo(rightFinX + finWidth * 0.18, finY + finHeight);
    ctx.closePath();
    ctx.fill();
    // 핀 스트랩/톤 분리로 입체감 강조
    ctx.fillStyle = finShade;
    ctx.fillRect(leftFinX + finWidth * 0.2, finY + finHeight * 0.18, finWidth * 0.6, finHeight * 0.12);
    ctx.fillRect(rightFinX + finWidth * 0.2, finY + finHeight * 0.18, finWidth * 0.6, finHeight * 0.12);

    // 다리(핀과 몸통 연결) - 킥 모션을 위해 상/하 분할
    ctx.fillStyle = suitShade;
    const leftLegX = drawX + w * 0.24 - legSpread - legOut;
    const rightLegX = drawX + w * 0.6 + legSpread + legOut;
    const legY = y + h * 0.22 + finSwing * 0.4;
    const legW = w * 0.16;
    const thighH = h * 0.11;
    const calfH = h * 0.1;
    // 허벅지
    ctx.fillRect(leftLegX, legY, legW, thighH);
    ctx.fillRect(rightLegX, legY, legW, thighH);
    // 종아리(좌우 교차 킥)
    ctx.fillRect(leftLegX, legY + thighH + legKick, legW, calfH);
    ctx.fillRect(rightLegX, legY + thighH - legKick, legW, calfH);

    // 부츠/발끝 강조 - 킥 방향에 따라 위치 오프셋
    ctx.fillStyle = boot;
    ctx.fillRect(leftLegX, legY - h * 0.02 + legKick, legW, h * 0.04);
    ctx.fillRect(rightLegX, legY - h * 0.02 - legKick, legW, h * 0.04);

    // 산소 탱크(등) - 데이브의 옐로 톤 포인트
    ctx.fillStyle = tankMain;
    ctx.fillRect(drawX + w * 0.34, y + h * 0.26, w * 0.3, h * 0.28);
    ctx.fillStyle = tankShade;
    ctx.fillRect(drawX + w * 0.34, y + h * 0.26, w * 0.09, h * 0.28);
    // 탱크 스트랩
    ctx.fillStyle = strap;
    ctx.fillRect(drawX + w * 0.34, y + h * 0.44, w * 0.3, h * 0.04);

    // 몸통(통통한 블루 슈트)
    const torsoX = drawX + w * 0.2;
    const torsoY = y + h * 0.33;
    const torsoW = w * 0.6;
    const torsoH = h * 0.34;
    ctx.fillStyle = suitBase;
    ctx.fillRect(torsoX, torsoY, torsoW, torsoH);
    // 슈트 하이라이트 라인
    ctx.fillStyle = suitHighlight;
    ctx.fillRect(torsoX + torsoW * 0.2, torsoY + torsoH * 0.28, torsoW * 0.6, torsoH * 0.08);

    // 팔(양측) - 상완/하완 분리로 수영 스트로크 표현
    ctx.fillStyle = suitShade;
    const leftArmX = drawX + w * 0.1 + armReach - armOut;
    const rightArmX = drawX + w * 0.76 - armReach + armOut;
    const armY = y + h * 0.4;
    const armW = w * 0.14;
    const upperArmH = h * 0.11;
    const lowerArmH = h * 0.1;
    // 상완
    ctx.fillRect(leftArmX, armY + armSwing, armW, upperArmH);
    ctx.fillRect(rightArmX, armY - armSwing, armW, upperArmH);
    // 하완(좌우 교차 스트로크)
    ctx.fillRect(leftArmX, armY + upperArmH + armSwing * 0.6, armW, lowerArmH);
    ctx.fillRect(rightArmX, armY + upperArmH - armSwing * 0.6, armW, lowerArmH);
    // 장갑 디테일
    ctx.fillStyle = glove;
    ctx.fillRect(leftArmX, armY + upperArmH + lowerArmH + armSwing * 0.4, armW, h * 0.05);
    ctx.fillRect(rightArmX, armY + upperArmH + lowerArmH - armSwing * 0.4, armW, h * 0.05);

    // 마스크 스트랩(얼굴 뒤로 감기는 라인)
    ctx.fillStyle = strap;
    ctx.fillRect(drawX + w * 0.24, y + h * 0.71, w * 0.52, h * 0.03);

    // 얼굴(데이브 특유의 피부 톤과 턱수염)
    const faceCX = drawX + w * 0.5;
    const faceCY = y + h * 0.79;
    // 데이브 느낌의 헤어 실루엣
    ctx.fillStyle = hair;
    ctx.fillRect(faceCX - w * 0.22, faceCY - h * 0.18, w * 0.44, h * 0.06);
    ctx.fillStyle = skinTone;
    ctx.beginPath();
    ctx.ellipse(faceCX, faceCY, w * 0.2, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = beard;
    ctx.beginPath();
    ctx.ellipse(faceCX, faceCY + h * 0.05, w * 0.2, h * 0.08, 0, 0, Math.PI);
    ctx.fill();
    // 턱수염 위 콧수염 포인트
    ctx.fillRect(faceCX - w * 0.12, faceCY + h * 0.01, w * 0.24, h * 0.03);

    // 마스크 프레임 + 바이저
    const maskX = drawX + w * 0.29;
    const maskY = y + h * 0.69;
    const maskW = w * 0.42;
    const maskH = h * 0.13;
    ctx.fillStyle = maskFrame;
    ctx.fillRect(maskX, maskY, maskW, maskH);
    ctx.fillStyle = maskShade;
    ctx.fillRect(maskX, maskY + maskH * 0.75, maskW, maskH * 0.25);
    ctx.fillStyle = visor;
    ctx.fillRect(maskX + maskW * 0.08, maskY + maskH * 0.12, maskW * 0.84, maskH * 0.6);
    ctx.fillStyle = visorHighlight;
    ctx.fillRect(maskX + maskW * 0.12, maskY + maskH * 0.18, maskW * 0.2, maskH * 0.2);

    // 레귤레이터 + 호스(마스크에서 탱크로 연결되는 포인트)
    ctx.fillStyle = hose;
    ctx.fillRect(drawX + w * 0.47, y + h * 0.82, w * 0.06, h * 0.03);
    ctx.strokeStyle = hose;
    ctx.lineWidth = Math.max(1, lineWidth * 0.8);
    ctx.beginPath();
    ctx.moveTo(drawX + w * 0.5, y + h * 0.83);
    ctx.lineTo(drawX + w * 0.66, y + h * 0.62);
    ctx.stroke();

    // 외곽선은 기본 라인 두께로 복원해 선명도 유지
    ctx.lineWidth = lineWidth;
    // 캐릭터 외곽선으로 선명도 강화
    ctx.strokeStyle = outline;
    ctx.strokeRect(torsoX, torsoY, torsoW, torsoH);
    ctx.strokeRect(maskX, maskY, maskW, maskH);
    ctx.restore();
  }

  // 캐릭터 선택 카드에 표시할 미리보기 렌더링
  function renderCharacterPreviews(time = 0) {
    DOM.characterCards.forEach((card) => {
      const canvas = card.querySelector(".card-canvas");
      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      // 디바이스 픽셀 비율에 맞춰 선명한 미리보기 캔버스 구성
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 카드 전용 바다 배경으로 분위기 강화
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(12, 46, 78, 0.9)");
      gradient.addColorStop(1, "rgba(35, 120, 170, 0.85)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 미리보기용 플레이어 사이즈/위치 정의
      const playerWidth = width * 0.52;
      const playerHeight = playerWidth * 1.5;
      // 숨쉬기 느낌의 미세 상하 움직임
      const bob = Math.sin(time * 2.4) * height * 0.03;
      const player = {
        x: (width - playerWidth) * 0.5,
        y: (height - playerHeight) * 0.38 + bob,
        width: playerWidth,
        height: playerHeight,
      };

      const character = card.dataset.character || "longfin";
      const facing = character === "shortfin" ? -1 : 1;
      drawPlayer(ctx, player, character, facing, true, time);
    });
  }

  // 캐릭터 선택 미리보기 애니메이션 상태 관리
  let previewAnimationId = 0;
  let previewTimeCache = 0;

  // 캐릭터 화면 활성 여부 확인
  function isCharacterScreenActive() {
    return DOM.screens.character.classList.contains("is-active");
  }

  // 캐릭터 미리보기 애니메이션 시작
  function startCharacterPreviewAnimation() {
    if (previewAnimationId) {
      cancelAnimationFrame(previewAnimationId);
    }
    const startTime = performance.now();

    const animate = (now) => {
      if (!isCharacterScreenActive()) {
        previewAnimationId = 0;
        return;
      }
      previewTimeCache = (now - startTime) / 1000;
      renderCharacterPreviews(previewTimeCache);
      previewAnimationId = requestAnimationFrame(animate);
    };

    previewAnimationId = requestAnimationFrame(animate);
  }

  // 캐릭터 미리보기 애니메이션 중단
  function stopCharacterPreviewAnimation() {
    if (!previewAnimationId) {
      return;
    }
    cancelAnimationFrame(previewAnimationId);
    previewAnimationId = 0;
  }

  // 바위 장애물 렌더링
  function drawRock(ctx, x, y, w, h) {
    ctx.fillStyle = "#5f6d78";
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w * 0.08, y + h * 0.5);
    ctx.lineTo(x + w * 0.35, y + h * 0.08);
    ctx.lineTo(x + w * 0.7, y + h * 0.18);
    ctx.lineTo(x + w * 0.95, y + h * 0.6);
    ctx.lineTo(x + w * 0.78, y + h);
    ctx.closePath();
    ctx.fill();

    // 하이라이트로 입체감 표현
    ctx.fillStyle = "#788792";
    ctx.fillRect(x + w * 0.28, y + h * 0.45, w * 0.18, h * 0.12);
  }

  // 산호 장애물 렌더링
  function drawCoral(ctx, x, y, w, h) {
    ctx.fillStyle = "#e4572e";
    ctx.fillRect(x + w * 0.42, y + h * 0.25, w * 0.16, h * 0.75);
    ctx.fillRect(x + w * 0.18, y + h * 0.45, w * 0.16, h * 0.55);
    ctx.fillRect(x + w * 0.66, y + h * 0.4, w * 0.16, h * 0.6);
    ctx.fillRect(x + w * 0.12, y + h * 0.32, w * 0.2, h * 0.18);
    ctx.fillRect(x + w * 0.68, y + h * 0.28, w * 0.2, h * 0.18);
  }

  // 해초 장애물 렌더링
  function drawSeaweed(ctx, x, y, w, h) {
    ctx.fillStyle = "#2fa37a";
    const stalkWidth = w * 0.12;

    for (let i = 0; i < 3; i += 1) {
      const offsetX = x + w * 0.25 + i * stalkWidth * 1.6;
      ctx.fillRect(offsetX, y + h * 0.18, stalkWidth, h * 0.82);
      ctx.fillRect(offsetX - stalkWidth * 0.2, y + h * 0.05, stalkWidth * 0.8, h * 0.2);
    }
  }

  // 해파리 장애물 렌더링
  function drawJellyfish(ctx, x, y, w, h) {
    ctx.fillStyle = "#d56aa0";
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.45, w * 0.4, Math.PI, 0);
    ctx.lineTo(x + w * 0.9, y + h * 0.6);
    ctx.lineTo(x + w * 0.1, y + h * 0.6);
    ctx.closePath();
    ctx.fill();

    // 촉수 표현
    ctx.strokeStyle = "#c45890";
    ctx.lineWidth = Math.max(1, w * 0.05);
    ctx.lineCap = "round";

    for (let i = 0; i < 4; i += 1) {
      const tx = x + w * 0.22 + i * w * 0.18;
      ctx.beginPath();
      ctx.moveTo(tx, y + h * 0.6);
      ctx.lineTo(tx, y + h * 0.95);
      ctx.stroke();
    }
  }

  // 월드 좌표를 화면 좌표로 변환해 장애물 렌더링
  function drawObstacles(ctx, obstacles, cameraY, size) {
    obstacles.forEach((obstacle) => {
      const screenY = obstacle.worldY - cameraY;

      if (screenY > size.height + 80 || screenY + obstacle.height < -80) {
        return;
      }

      if (obstacle.type === "rock") {
        drawRock(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }

      if (obstacle.type === "coral") {
        drawCoral(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }

      if (obstacle.type === "seaweed") {
        drawSeaweed(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }

      if (obstacle.type === "jellyfish") {
        drawJellyfish(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }
    });
  }

  // Axis-aligned bounding box collision detection
  function rectsIntersect(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // 여유 간격을 포함한 사각형 겹침 판정
  function rectsIntersectWithMargin(a, b, margin) {
    return (
      a.x < b.x + b.width + margin &&
      a.x + a.width + margin > b.x &&
      a.y < b.y + b.height + margin &&
      a.y + a.height + margin > b.y
    );
  }

  // 플레이어 충돌 박스를 실제 스프라이트보다 작게 설정
  function getPlayerHitbox(player) {
    const marginX = player.width * 0.22;
    const marginY = player.height * 0.2;
    return {
      x: player.x + marginX * 0.5,
      y: player.y + marginY * 0.4,
      width: player.width - marginX,
      height: player.height - marginY,
    };
  }

  // 장애물 타입별로 축소된 충돌 박스 생성
  function getObstacleHitbox(obstacle, screenY) {
    const shrinkMap = {
      rock: 0.18,
      coral: 0.2,
      seaweed: 0.28,
      jellyfish: 0.22,
    };
    const shrink = shrinkMap[obstacle.type] ?? 0.2;
    const marginX = obstacle.width * shrink;
    const marginY = obstacle.height * shrink;

    return {
      x: obstacle.x + marginX * 0.5,
      y: screenY + marginY * 0.5,
      width: obstacle.width - marginX,
      height: obstacle.height - marginY,
    };
  }

  // Core game object with update/render loop
  const game = {
    ctx: DOM.canvas.getContext("2d"),
    size: {
      width: CONFIG.canvas.baseWidth,
      height: CONFIG.canvas.baseHeight,
    },
    player: {
      x: 0,
      y: CONFIG.canvas.baseHeight * CONFIG.gameplay.startScreenRatio,
      worldY: CONFIG.canvas.baseHeight * CONFIG.gameplay.startScreenRatio,
      width: 36,
      height: 54,
    },
    obstacles: [],
    bubbles: [],
    running: false,
    lastFrame: 0,
    depth: 0,
    time: 0,
    // 카메라/스크롤 상태
    cameraY: 0,
    startScreenY: CONFIG.canvas.baseHeight * CONFIG.gameplay.startScreenRatio,
    targetScreenY: CONFIG.canvas.baseHeight * CONFIG.gameplay.targetScreenRatio,
    descentSpeed: 0,
    depthRate: CONFIG.gameplay.shortfinDepthRate,
    spawnTimer: 0,
    spawnInterval: CONFIG.gameplay.spawnMin,

    // Start a new game session
    start(character) {
      this.running = true;
      this.obstacles = [];
      // 게임 시작 시 버블 배경 초기화
      this.bubbles = initBubbles(this.size);
      this.depth = 0;
      this.time = 0;
      this.lastFrame = performance.now();
      this.spawnTimer = 0;
      this.spawnInterval = getSpawnInterval(this.depth);
      // 캐릭터 선택에 따른 하강/수심 속도 적용
      this.depthRate = character === "longfin" ? CONFIG.gameplay.longfinDepthRate : CONFIG.gameplay.shortfinDepthRate;
      this.descentSpeed = this.depthRate * CONFIG.gameplay.pixelsPerMeter;

      // 카메라 및 플레이어 위치 초기화
      this.cameraY = 0;
      this.startScreenY = this.size.height * CONFIG.gameplay.startScreenRatio;
      this.targetScreenY = this.size.height * CONFIG.gameplay.targetScreenRatio;
      this.player.x = this.size.width * 0.5 - this.player.width * 0.5;
      this.player.worldY = this.startScreenY;
      this.player.y = this.startScreenY;
      state.facing = 1;
      state.moving = false;

      this.loop();
    },

    // Stop the game loop without clearing UI
    stop() {
      this.running = false;
    },

    // Spawn a new obstacle at random x position
    spawnObstacle() {
      // 캐릭터 하강 방향(아래) 기준으로 화면 하단에 생성
      const type = pickObstacleType();
      const size = getObstacleSize(type, this.size);
      const margin = Math.max(8, this.size.width * 0.04);
      let placed = false;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const x = randomInRange(12, this.size.width - size.width - 12);
        const worldY = this.player.worldY + this.size.height + randomInRange(this.size.height * 0.2, this.size.height * 0.6);
        const candidate = { x, y: worldY, width: size.width, height: size.height };

        const hasOverlap = this.obstacles.some((obstacle) =>
          rectsIntersectWithMargin(
            candidate,
            { x: obstacle.x, y: obstacle.worldY, width: obstacle.width, height: obstacle.height },
            margin
          )
        );

        if (!hasOverlap) {
          this.obstacles.push({
            type,
            x,
            worldY,
            width: size.width,
            height: size.height,
          });
          placed = true;
          break;
        }
      }

      if (!placed) {
        // 겹침 방지를 위해 이번 스폰을 스킵
        return;
      }
    },

    // Update positions, depth, and collision per frame
    update(delta) {
      // 수심 수치 증가
      this.depth += this.depthRate * delta;
      // 애니메이션 시간 누적
      this.time += delta;

      // 좌/우 이동 처리
      const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (direction !== 0) {
        // 마지막 이동 방향을 기억해 캐릭터 방향을 고정
        state.facing = direction > 0 ? 1 : -1;
      }
      state.moving = direction !== 0;
      this.player.x += direction * CONFIG.gameplay.playerSpeed * delta;
      this.player.x = clamp(this.player.x, 0, this.size.width - this.player.width);

      // 배경 버블 이동 업데이트
      updateBubbles(this.bubbles, this.size, delta);

      // 캐릭터 자동 하강 + 중간 지점 고정
      this.player.worldY += this.descentSpeed * delta;
      const screenY = this.player.worldY - this.cameraY;

      if (screenY >= this.targetScreenY) {
        // 목표 지점 이후에는 카메라를 이동시켜 캐릭터를 고정
        this.cameraY = this.player.worldY - this.targetScreenY;
        this.player.y = this.targetScreenY;
      } else {
        this.player.y = screenY;
      }

      // 장애물 스폰 타이밍 관리
      this.spawnTimer += delta;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        // 수심이 깊어질수록 스폰 간격을 줄여 난이도 상승
        this.spawnInterval = getSpawnInterval(this.depth);
        this.spawnObstacle();
      }

      // 화면 상단을 지나간 장애물 정리
      this.obstacles = this.obstacles.filter(
        (obstacle) => obstacle.worldY - this.cameraY + obstacle.height > -80
      );

      for (const obstacle of this.obstacles) {
        const obstacleScreenY = obstacle.worldY - this.cameraY;

        if (obstacleScreenY > this.size.height + 80 || obstacleScreenY + obstacle.height < -80) {
          continue;
        }

        // 실제 보이는 형태에 맞춘 축소 충돌 박스 적용
        const playerHitbox = getPlayerHitbox(this.player);
        const obstacleHitbox = getObstacleHitbox(obstacle, obstacleScreenY);

        if (rectsIntersect(playerHitbox, obstacleHitbox)) {
          this.running = false;
          handleGameOver(this.depth);
          break;
        }
      }
    },

    // Render background, player, and obstacles
    render() {
      drawBackground(this.ctx, this.size, this.bubbles);
      drawObstacles(this.ctx, this.obstacles, this.cameraY, this.size);
      drawPlayer(this.ctx, this.player, state.character, state.facing, state.moving, this.time);
    },

    // Main loop driven by requestAnimationFrame
    loop() {
      if (!this.running) {
        return;
      }

      const now = performance.now();
      const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
      this.lastFrame = now;

      this.update(delta);
      this.render();

      DOM.hudDepth.textContent = formatDepth(this.depth);
      requestAnimationFrame(this.loop.bind(this));
    },
  };

  // Bind keyboard and touch controls for movement
  function bindControls() {
    // Toggle directional input flags
    const activate = (direction, value) => {
      if (direction === "left") {
        input.left = value;
      }
      if (direction === "right") {
        input.right = value;
      }
    };

    // Keyboard controls
    window.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        activate("left", true);
      }
      if (event.key === "ArrowRight") {
        activate("right", true);
      }
    });

    window.addEventListener("keyup", (event) => {
      if (event.key === "ArrowLeft") {
        activate("left", false);
      }
      if (event.key === "ArrowRight") {
        activate("right", false);
      }
    });

    // Touch button controls
    // Bind pointer events for a control button
    const bindButton = (button, direction) => {
      // Activate movement while pointer is held
      const onDown = (event) => {
        event.preventDefault();
        activate(direction, true);
      };
      // Release movement on pointer end
      const onUp = () => activate(direction, false);

      button.addEventListener("pointerdown", onDown);
      button.addEventListener("pointerup", onUp);
      button.addEventListener("pointerleave", onUp);
      button.addEventListener("pointercancel", onUp);
    };

    bindButton(DOM.btnLeft, "left");
    bindButton(DOM.btnRight, "right");
  }

  // Handle game over UI and server sync
  async function handleGameOver(depth) {
    state.depth = depth;
    state.lastScore = {
      name: state.player.name,
      depth: Number(depth.toFixed(2)),
    };

    setActiveScreen("result");
    DOM.finalDepth.textContent = formatDepth(depth);

    DOM.leaderboardStatus.textContent = "저장 중...";

    // Save score to server with fallback queue
    const record = {
      name: state.player.name,
      phone: state.player.phone,
      depth: Number(depth.toFixed(2)),
      character: state.character,
    };

    try {
      const stored = await enqueueScore(record);
      if (!stored) {
        DOM.leaderboardStatus.textContent = "저장 대기 중...";
        showToast("네트워크 불안정: 관계자에게 직접 보여주세요.");
      } else {
        DOM.leaderboardStatus.textContent = "랭킹 불러오는 중...";
      }
    } catch (error) {
      // 저장 오류 발생 시 현장 안내 메시지 표시
      DOM.leaderboardStatus.textContent = "기록 저장 오류: 관계자에게 직접 보여주세요.";
      showToast("네트워크 불안정: 관계자에게 직접 보여주세요.");
    }

    // Load leaderboard from server
    try {
      const result = await fetchLeaderboard(10);
      renderLeaderboard(result.data || []);
      DOM.leaderboardStatus.textContent = "업데이트 완료";
    } catch (error) {
      DOM.leaderboardStatus.textContent = "랭킹 불러오기 실패";
      renderLeaderboard([]);
    }
  }

  // Start a new game session from UI state
  function startGame() {
    DOM.hudCharacter.textContent = getCharacterLabel(state.character);
    DOM.hudDepth.textContent = formatDepth(0);
    setActiveScreen("game");
    resizeCanvas(game);
    game.start(state.character);
  }

    // Reset inputs and return to intro screen
  function resetToIntro() {
    DOM.form.reset();
    state.player = { name: "", phone: "" };
    state.character = null;
    state.facing = 1;
    state.moving = false;
    DOM.btnToGame.disabled = true;
    // Reset character selection UI state
    DOM.characterCards.forEach((card) => {
      card.classList.remove("is-selected");
      card.setAttribute("aria-pressed", "false");
    });
    setActiveScreen("intro");
  }

  // Setup event handlers for form and screen transitions
  function bindUI() {
    DOM.form.addEventListener("submit", (event) => {
      event.preventDefault();

      const name = sanitizeName(DOM.nameInput.value);
      const phone = normalizePhone(DOM.phoneInput.value);
      const consent = DOM.consentInput.checked;

      if (!validatePlayerInput(name, phone, consent)) {
        return;
      }

      state.player.name = name;
      state.player.phone = phone;

      setActiveScreen("character");
    });

    DOM.characterCards.forEach((card) => {
      card.addEventListener("click", () => {
        // Update selection UI and aria-pressed state
        DOM.characterCards.forEach((item) => {
          item.classList.remove("is-selected");
          item.setAttribute("aria-pressed", "false");
        });
        card.classList.add("is-selected");
        card.setAttribute("aria-pressed", "true");
        state.character = card.dataset.character;
        DOM.btnToGame.disabled = false;
      });
    });

    DOM.btnToIntro.addEventListener("click", () => {
      setActiveScreen("intro");
    });

    DOM.btnToGame.addEventListener("click", () => {
      if (!state.character) {
        showToast("캐릭터를 선택해 주세요.");
        return;
      }
      startGame();
    });

    DOM.btnRetry.addEventListener("click", () => {
      setActiveScreen("character");
    });

    DOM.btnHome.addEventListener("click", () => {
      resetToIntro();
    });

    window.addEventListener("resize", () => {
      resizeCanvas(game);
      // 캐릭터 화면이 활성화된 경우 미리보기 리사이즈 반영
      if (isCharacterScreenActive()) {
        renderCharacterPreviews(previewTimeCache);
      }
    });
  }

  // Initialize app after DOM is ready
  function init() {
    bindUI();
    bindControls();
    flushQueue();
    setActiveScreen("intro");
  }

  document.addEventListener("DOMContentLoaded", init);
})();

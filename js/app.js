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

  // 다이버 캐릭터(롱핀/숏핀)를 고해상도 디테일로 렌더링(하강 방향)
  function drawPlayer(ctx, player, character, facing, moving, time) {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;

    const suitDark = "#0f2d44";
    const suitLight = "#1f4f6a";
    const accent = "#1e6f78";
    const helmet = "#2b4965";
    const tank = "#0b1b2b";
    const visor = "#8fe7ff";
    const visorHighlight = "rgba(255, 255, 255, 0.45)";
    const glove = "#24475f";
    const boot = "#143449";
    const finDark = character === "longfin" ? "#c58f2c" : "#4fb3c7";
    const outline = "rgba(7, 18, 28, 0.6)";
    const finColor = character === "longfin" ? "#f2c14e" : "#6fd0e8";
    const belt = "#3a5b70";

    // 좌우 이동 방향에 따라 캐릭터를 좌우 반전
    ctx.save();
    let drawX = x;
    if (facing === -1) {
      // 중심 기준으로 좌우 반전
      ctx.translate(x + w * 0.5, 0);
      ctx.scale(-1, 1);
      drawX = -w * 0.5;
    }

    // === 하강 방향(아래)으로 바라보는 잠수부 ===
    const lineWidth = Math.max(1, w * 0.05);
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 애니메이션 파라미터(손/핀 가벼운 흔들림)
    const finSwing = Math.sin(time * 9) * h * 0.02;
    const armSwing = Math.sin(time * 6) * h * 0.012;

    // 진행 방향을 명확하게 보여주는 라이트 콘
    const beamStrength = moving ? 0.22 : 0.14;
    ctx.fillStyle = `rgba(160, 230, 255, ${beamStrength})`;
    ctx.beginPath();
    ctx.moveTo(drawX + w * 0.7, y + h * 0.78);
    ctx.lineTo(drawX + w * 1.6, y + h * 0.62);
    ctx.lineTo(drawX + w * 1.6, y + h * 0.94);
    ctx.closePath();
    ctx.fill();

    // 핀 길이로 롱핀/숏핀 구분 (상단 배치)
    const finHeight = character === "longfin" ? h * 0.22 : h * 0.14;
    const finY = y + h * 0.02 + finSwing;
    ctx.fillStyle = finColor;
    ctx.fillRect(drawX + w * 0.18, finY, w * 0.2, finHeight);
    ctx.fillRect(drawX + w * 0.62, finY, w * 0.2, finHeight);
    // 핀 스트랩 디테일
    ctx.fillStyle = "#0f2d44";
    ctx.fillRect(drawX + w * 0.2, finY + finHeight * 0.52, w * 0.16, finHeight * 0.12);
    ctx.fillRect(drawX + w * 0.64, finY + finHeight * 0.52, w * 0.16, finHeight * 0.12);
    // 핀 패턴(롱핀은 줄무늬, 숏핀은 끝단 강조)
    ctx.fillStyle = finDark;
    if (character === "longfin") {
      ctx.fillRect(drawX + w * 0.2, finY + finHeight * 0.18, w * 0.16, finHeight * 0.08);
      ctx.fillRect(drawX + w * 0.64, finY + finHeight * 0.18, w * 0.16, finHeight * 0.08);
      ctx.fillRect(drawX + w * 0.2, finY + finHeight * 0.72, w * 0.16, finHeight * 0.08);
      ctx.fillRect(drawX + w * 0.64, finY + finHeight * 0.72, w * 0.16, finHeight * 0.08);
    } else {
      ctx.fillRect(drawX + w * 0.18, finY + finHeight * 0.86, w * 0.2, finHeight * 0.12);
      ctx.fillRect(drawX + w * 0.62, finY + finHeight * 0.86, w * 0.2, finHeight * 0.12);
    }

    // 다리(핀과 몸통 연결)
    ctx.fillStyle = suitDark;
    ctx.fillRect(drawX + w * 0.24, y + h * 0.22 + finSwing * 0.4, w * 0.16, h * 0.18);
    ctx.fillRect(drawX + w * 0.6, y + h * 0.22 + finSwing * 0.4, w * 0.16, h * 0.18);

    // 몸통
    ctx.fillStyle = suitDark;
    ctx.fillRect(drawX + w * 0.28, y + h * 0.36, w * 0.44, h * 0.28);

    // 팔(양측)
    ctx.fillStyle = suitLight;
    ctx.fillRect(drawX + w * 0.18, y + h * 0.4 + armSwing, w * 0.1, h * 0.18);
    ctx.fillRect(drawX + w * 0.72, y + h * 0.4 - armSwing, w * 0.1, h * 0.18);
    // 장갑 디테일
    ctx.fillStyle = glove;
    ctx.fillRect(drawX + w * 0.18, y + h * 0.55 + armSwing, w * 0.1, h * 0.06);
    ctx.fillRect(drawX + w * 0.72, y + h * 0.55 - armSwing, w * 0.1, h * 0.06);

    // 손목 컴퓨터(방향 식별 포인트)
    ctx.fillStyle = "#67d9ff";
    ctx.fillRect(drawX + w * 0.74, y + h * 0.48 - armSwing * 0.2, w * 0.06, h * 0.06);

    // 산소 탱크(등)
    ctx.fillStyle = tank;
    ctx.fillRect(drawX + w * 0.38, y + h * 0.28, w * 0.24, h * 0.32);
    ctx.fillRect(drawX + w * 0.42, y + h * 0.26, w * 0.16, h * 0.06);

    // 벨트/스트랩
    ctx.fillStyle = belt;
    ctx.fillRect(drawX + w * 0.28, y + h * 0.52, w * 0.44, h * 0.05);
    // 추가 스트랩
    ctx.fillRect(drawX + w * 0.34, y + h * 0.4, w * 0.32, h * 0.04);

    // 헬멧(하단에 배치되어 아래를 바라보는 느낌)
    ctx.fillStyle = helmet;
    ctx.fillRect(drawX + w * 0.3, y + h * 0.66, w * 0.4, h * 0.22);

    // 바이저(유리)
    ctx.fillStyle = visor;
    ctx.fillRect(drawX + w * 0.38, y + h * 0.72, w * 0.24, h * 0.12);
    // 바이저 하이라이트
    ctx.fillStyle = visorHighlight;
    ctx.fillRect(drawX + w * 0.4, y + h * 0.74, w * 0.08, h * 0.05);

    // 레귤레이터 포인트
    ctx.fillStyle = accent;
    ctx.fillRect(drawX + w * 0.44, y + h * 0.85, w * 0.12, h * 0.05);
    // 호스 디테일(방향 강조)
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(drawX + w * 0.5, y + h * 0.88);
    ctx.lineTo(drawX + w * 0.72, y + h * 0.7);
    ctx.stroke();

    // 부츠/발끝 강조
    ctx.fillStyle = boot;
    ctx.fillRect(drawX + w * 0.24, y + h * 0.2, w * 0.16, h * 0.04);
    ctx.fillRect(drawX + w * 0.6, y + h * 0.2, w * 0.16, h * 0.04);

    // 슈트 하이라이트 라인
    ctx.fillStyle = accent;
    ctx.fillRect(drawX + w * 0.32, y + h * 0.44, w * 0.36, h * 0.04);

    // 캐릭터 외곽선으로 선명도 강화
    ctx.strokeStyle = outline;
    ctx.strokeRect(drawX + w * 0.28, y + h * 0.36, w * 0.44, h * 0.52);
    ctx.restore();
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

    window.addEventListener("resize", () => resizeCanvas(game));
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

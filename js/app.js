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
    hudLives: document.getElementById("hud-lives"),
    hudCharacter: document.getElementById("hud-character"),
    lifeLossIndicator: document.getElementById("life-loss-indicator"),
    canvas: document.getElementById("game-canvas"),
    gameStartOverlay: document.getElementById("game-start-overlay"),
    btnGameStart: document.getElementById("btn-game-start"),
    btnLeft: document.getElementById("btn-left"),
    btnRight: document.getElementById("btn-right"),
    // 터치 컨트롤 컨테이너(시작 전 비활성 처리용)
    touchControls: document.querySelector(".touch-controls"),
    finalDepth: document.getElementById("final-depth"),
    resultMessage: document.getElementById("result-message"),
    resultHeadline: document.getElementById("result-headline"),
    resultSubline: document.getElementById("result-subline"),
    resultFooter: document.getElementById("result-footer"),
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
      // 목표 수심(미터) - 합격 판단 및 난이도 보정 기준
      targetDepth: 10,
      // 수심 수치와 화면 하강 속도 변환 비율
      pixelsPerMeter: 420,
      // 난이도 상승 가중치(전역 공통)
      difficultyDepthWeight: 0.75,
      difficultyTimeWeight: 0.25,
      // 캐릭터 시작/목표 위치(화면 비율)
      startScreenRatio: 0.18,
      targetScreenRatio: 0.35,
      maxQueue: 20,
      // 목숨 시스템 기본값
      maxLives: 2,
      // 충돌 직후 연속 차감 방지 무적 시간(초)
      hitInvincibilitySeconds: 0.8,
      // 포션 고정 등장 수심(총 5개)
      potionMilestones: [5, 10, 15, 20, 30],
      // 목숨 감소 안내 표시 시간(ms)
      lifeLossIndicatorMs: 900,
      // 캐릭터별 난이도 프리셋(롱핀=프린이, 숏핀=고고다이버)
      characterSettings: {
        longfin: {
          label: "프린이",
          // DB 저장용 영문 키
          storageKey: "prini",
          // 초보라 조작이 어려운 설정: 더 빠른 하강 + 빽빽한 장애물
          // 오래 버티도록 수심 상승은 느리게, 대신 장애물은 매우 촘촘하게
          depthRate: 0.5,
          playerSpeed: 170,
          spawnMin: 0.22,
          spawnMax: 0.4,
          difficultyDepthScale: 25,
          difficultyTimeScale: 6,
        },
        shortfin: {
          label: "고고다이버",
          // DB 저장용 영문 키
          storageKey: "gogodiver",
          // 20초에 10m 도달(10 / 20 = 0.5) + 매우 쉬운 난이도
          depthRate: 10 / 20,
          playerSpeed: 300,
          spawnMin: 1.6,
          spawnMax: 2.4,
          difficultyDepthScale: 200,
          difficultyTimeScale: 40,
        },
      },
      // 고고다이버가 5m를 넘기면 즉시 난이도 급상승
      gogodiverBoost: {
        depthThreshold: 5,
        // 5m 이후 난이도를 더 공격적으로 올리도록 계수 추가 강화
        spawnMinMultiplier: 0.2,
        spawnMaxMultiplier: 0.25,
        // 깊이/시간 스케일을 더 낮춰 장애물 밀도를 빠르게 끌어올림
        depthScaleMultiplier: 0.24,
        timeScaleMultiplier: 0.32,
      },
      // 30m 이후 전체 난이도 급상승(루즈함 방지)
      depthSpike: {
        depthThreshold: 30,
        spawnMinMultiplier: 0.3,
        spawnMaxMultiplier: 0.35,
        depthScaleMultiplier: 0.4,
        timeScaleMultiplier: 0.5,
      },
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
    // 목숨 감소 알림 타이머(중복 노출 제어)
    lifeLossTimerId: 0,
  };

  // Input flags for continuous movement
  const input = {
    left: false,
    right: false,
  };

  // 캔버스 캐릭터에 사용할 이미지 에셋
  const ASSETS = {
    // 회사 로고(고고다이버 전용 데칼)
    logo: (() => {
      const img = new Image();
      img.src = "img/logo.png";
      img.decoding = "async";
      return img;
    })(),
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
    // 입력/캐릭터 화면에서는 배경을 다크 모드로 전환
    const isDarkScreen = screenId === "intro" || screenId === "character" || screenId === "result";
    document.body.classList.toggle("body-dark", isDarkScreen);
    // 게임 화면이 아니면 시작 오버레이를 숨김 처리
    if (screenId !== "game") {
      DOM.gameStartOverlay.classList.remove("is-visible");
      DOM.touchControls?.classList.remove("is-disabled");
      // 게임 화면 이탈 시 피격 알림 잔상 제거
      hideLifeLossIndicator();
    }
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

  // Normalize phone input and format to 000-0000-0000 pattern
  function normalizePhone(phone) {
    const digits = (phone || "").replace(/[^0-9]/g, "").slice(0, 11);
    if (digits.length <= 3) {
      return digits;
    }
    if (digits.length <= 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
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

  // HUD 목숨 텍스트 포맷(아이콘 + 숫자)
  function formatLives(lives) {
    return `❤ x${Math.max(0, lives)}`;
  }

  // 우측 상단 목숨 HUD를 현재 상태로 갱신
  function updateHudLives(lives) {
    if (!DOM.hudLives) {
      return;
    }
    DOM.hudLives.textContent = formatLives(lives);
  }

  // 피격 알림을 즉시 숨기고 타이머를 정리
  function hideLifeLossIndicator() {
    if (state.lifeLossTimerId) {
      window.clearTimeout(state.lifeLossTimerId);
      state.lifeLossTimerId = 0;
    }
    DOM.lifeLossIndicator?.classList.remove("is-visible", "is-gain");
  }

  // 목숨 변화 알림을 상단 오버레이로 잠깐 표시(감소/회복 공용)
  function showLifeIndicator(message, isGain = false) {
    if (!DOM.lifeLossIndicator) {
      return;
    }
    hideLifeLossIndicator();
    DOM.lifeLossIndicator.textContent = message;
    DOM.lifeLossIndicator.classList.toggle("is-gain", isGain);
    DOM.lifeLossIndicator.classList.add("is-visible");
    state.lifeLossTimerId = window.setTimeout(() => {
      DOM.lifeLossIndicator.classList.remove("is-visible", "is-gain");
      state.lifeLossTimerId = 0;
    }, CONFIG.gameplay.lifeLossIndicatorMs);
  }

  // Convert character id to readable label
  function getCharacterLabel(character) {
    // 데이터 키(롱핀/숏핀)를 신규 캐릭터 명칭으로 매핑
    return getCharacterPreset(character).label;
  }

  // DB 저장용 캐릭터 키 매핑
  function getCharacterStorageKey(character) {
    return getCharacterPreset(character).storageKey;
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

  // 수심과 경과 시간을 함께 반영해 난이도를 더 빠르게 상승
  function getSpawnInterval(depth, time, preset) {
    // 고고다이버는 5m 초과 시 난이도 보정 적용
    const tunedPreset = applyGogodiverBoost(depth, preset);
    // 30m 이후에는 모든 캐릭터 난이도를 추가로 급상승
    const spikedPreset = applyDepthSpike(depth, tunedPreset);
    // 캐릭터 난이도 프리셋에 맞춰 스폰 속도 계산
    const depthFactor = Math.pow(clamp(depth / spikedPreset.difficultyDepthScale, 0, 1), 0.7);
    const timeFactor = Math.pow(clamp(time / spikedPreset.difficultyTimeScale, 0, 1), 0.7);
    const difficulty =
      depthFactor * CONFIG.gameplay.difficultyDepthWeight +
      timeFactor * CONFIG.gameplay.difficultyTimeWeight;
    const normalizedDifficulty = clamp(difficulty, 0, 1);
    const minInterval = lerp(spikedPreset.spawnMin, spikedPreset.spawnMin * 0.5, normalizedDifficulty);
    const maxInterval = lerp(spikedPreset.spawnMax, spikedPreset.spawnMax * 0.6, normalizedDifficulty);
    const safeMin = Math.min(minInterval, maxInterval);
    const safeMax = Math.max(minInterval, maxInterval);
    return randomInRange(safeMin, safeMax);
  }

  // 캐릭터 키를 난이도 프리셋으로 매핑
  function getCharacterPreset(character) {
    return CONFIG.gameplay.characterSettings[character] || CONFIG.gameplay.characterSettings.shortfin;
  }

  // 고고다이버 5m 이후 난이도 급상승 보정
  function applyGogodiverBoost(depth, preset) {
    const boost = CONFIG.gameplay.gogodiverBoost;
    if (preset.storageKey !== "gogodiver" || depth < boost.depthThreshold) {
      return preset;
    }
    return {
      ...preset,
      spawnMin: preset.spawnMin * boost.spawnMinMultiplier,
      spawnMax: preset.spawnMax * boost.spawnMaxMultiplier,
      difficultyDepthScale: preset.difficultyDepthScale * boost.depthScaleMultiplier,
      difficultyTimeScale: preset.difficultyTimeScale * boost.timeScaleMultiplier,
    };
  }

  // 30m 이후 전체 난이도 급상승(긴 플레이 방지)
  function applyDepthSpike(depth, preset) {
    const spike = CONFIG.gameplay.depthSpike;
    if (depth < spike.depthThreshold) {
      return preset;
    }
    return {
      ...preset,
      spawnMin: preset.spawnMin * spike.spawnMinMultiplier,
      spawnMax: preset.spawnMax * spike.spawnMaxMultiplier,
      difficultyDepthScale: preset.difficultyDepthScale * spike.depthScaleMultiplier,
      difficultyTimeScale: preset.difficultyTimeScale * spike.timeScaleMultiplier,
    };
  }

  // 바다 장애물 타입 목록
  const OBSTACLE_TYPES = ["rock", "coral", "jellyfish", "shark", "ray", "urchin", "eel"];

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

    if (type === "jellyfish") {
      width = base * 0.16;
      height = base * 0.2;
    }

    if (type === "shark") {
      width = base * 0.32;
      height = base * 0.16;
    }

    if (type === "ray") {
      width = base * 0.3;
      height = base * 0.18;
    }

    if (type === "urchin") {
      width = base * 0.18;
      height = base * 0.18;
    }

    if (type === "eel") {
      width = base * 0.32;
      height = base * 0.12;
    }

    if (type === "potion") {
      // 포션은 눈에 잘 띄도록 폭 대비 세로 비율을 조금 더 크게 설정
      width = base * 0.16;
      height = base * 0.21;
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
      // 빈 랭킹일 때는 전체 영역을 차지하도록 전용 클래스 부여
      emptyItem.className = "leaderboard-empty";
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

  // 다이버 캐릭터(롱핀/숏핀)를 하강 포즈로 렌더링
  function drawPlayer(ctx, player, character, facing, moving, time) {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;

    const isPrini = character === "longfin";
    const isGogodiver = character === "shortfin";

    // 캐릭터별 컬러/무드 분리(프린이=입문형, 고고다이버=모던 프리다이버)
    const palette = isGogodiver
      ? {
          suitBase: "#0f2a3a",
          suitShade: "#091d29",
          suitHighlight: "#1f465f",
          suitAccent: "#29d4d9",
          maskFrame: "#152531",
          maskShade: "#0f1b24",
          skinTone: "#f3c9a3",
          beard: "#2e201a",
          visor: "#9feeff",
          visorHighlight: "rgba(255, 255, 255, 0.5)",
          tankMain: "#738693",
          tankShade: "#546470",
          strap: "#0b1218",
          glove: "#0b1218",
          boot: "#0d1922",
          hair: "#2a1d18",
          finMain: "#2fc6ff",
          finShade: "#1488b8",
          outline: "rgba(6, 12, 20, 0.7)",
          hose: "#7a8f9f",
        }
      : {
          suitBase: "#2b3a45",
          suitShade: "#1f2931",
          suitHighlight: "#3c4b57",
          suitAccent: "#5a6770",
          maskFrame: "#c9b48f",
          maskShade: "#a98f6b",
          skinTone: "#e7c2a1",
          beard: "#3b2b25",
          visor: "#9fd2e8",
          visorHighlight: "rgba(255, 255, 255, 0.35)",
          tankMain: "#c6a46b",
          tankShade: "#9a7a3f",
          strap: "#2a2a2a",
          glove: "#1c1c1c",
          boot: "#151b21",
          hair: "#3a2c28",
          finMain: "#b05a3b",
          finShade: "#7d3f2a",
          outline: "rgba(6, 12, 20, 0.5)",
          hose: "#b1432f",
        };

    const {
      suitBase,
      suitShade,
      suitHighlight,
      suitAccent,
      maskFrame,
      maskShade,
      skinTone,
      beard,
      visor,
      visorHighlight,
      tankMain,
      tankShade,
      strap,
      glove,
      boot,
      hair,
      finMain,
      finShade,
      outline,
      hose,
    } = palette;

    // 프린이의 어설픈 자세/흔들림 표현
    const clumsyWobble = isPrini ? Math.sin(time * 6.2) * w * 0.02 : 0;
    const postureShift = isPrini ? h * 0.02 : -h * 0.01;

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
    const swimIntensity = (moving ? 1 : 0.45) * (isPrini ? 0.85 : 1.05);
    const armSwing = Math.cos(swimPhase) * h * 0.04 * swimIntensity;
    const armReach = Math.sin(swimPhase) * w * 0.07 * swimIntensity;
    const armOut = Math.abs(armSwing) * 0.6;
    const legKick = Math.sin(swimPhase) * h * 0.06 * swimIntensity;
    const legSpread = Math.cos(swimPhase) * w * 0.03 * swimIntensity;
    const legOut = Math.abs(legKick) * 0.25;

    // 헤드라이트 연출은 제거(요청 사항)

    // 고고다이버는 롱핀 실루엣으로 프리다이버 인상을 강화
    const finHeight = isPrini ? h * 0.16 : h * 0.34;
    const finWidth = w * (isPrini ? 0.18 : 0.2);
    const finY = y + h * 0.02 + finSwing + legKick * 0.25 + (isPrini ? h * 0.015 : -h * 0.01);
    const finSpread = legSpread * (isPrini ? 0.5 : 0.72);
    const leftFinX = drawX + w * 0.14 - finSpread * 0.4 + clumsyWobble * 0.2;
    const rightFinX = drawX + w * 0.64 + finSpread * 0.4 - clumsyWobble * 0.2;

    // 핀 타입별 형태 차이(프린이: 짧고 넓음, 고고다이버: 길고 뾰족함)
    const leftFinHeight = isPrini ? finHeight * 0.7 : finHeight;
    const rightFinHeight = finHeight;
    const finTipRatio = isPrini ? 0.82 : 0.9;
    const finRootRatio = isPrini ? 0.18 : 0.1;
    ctx.fillStyle = isPrini ? finShade : finMain;
    ctx.beginPath();
    ctx.moveTo(leftFinX, finY);
    ctx.lineTo(leftFinX + finWidth, finY);
    ctx.lineTo(leftFinX + finWidth * finTipRatio, finY + leftFinHeight);
    ctx.lineTo(leftFinX + finWidth * finRootRatio, finY + leftFinHeight);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = finMain;
    ctx.beginPath();
    ctx.moveTo(rightFinX, finY);
    ctx.lineTo(rightFinX + finWidth, finY);
    ctx.lineTo(rightFinX + finWidth * finTipRatio, finY + rightFinHeight);
    ctx.lineTo(rightFinX + finWidth * finRootRatio, finY + rightFinHeight);
    ctx.closePath();
    ctx.fill();
    // 핀 스트랩/톤 분리로 입체감 강조
    ctx.fillStyle = finShade;
    ctx.fillRect(leftFinX + finWidth * 0.2, finY + leftFinHeight * 0.18, finWidth * 0.6, leftFinHeight * 0.12);
    ctx.fillRect(rightFinX + finWidth * 0.2, finY + rightFinHeight * 0.18, finWidth * 0.6, rightFinHeight * 0.12);
    // 프린이 핀 보강 패치로 허술함 강조
    if (isPrini) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      ctx.fillRect(leftFinX + finWidth * 0.12, finY + leftFinHeight * 0.55, finWidth * 0.2, leftFinHeight * 0.18);
    }

    // 다리(핀과 몸통 연결) - 킥 모션을 위해 상/하 분할
    ctx.fillStyle = suitShade;
    const leftLegX = drawX + w * 0.24 - legSpread - legOut + clumsyWobble * 0.2;
    const rightLegX = drawX + w * 0.6 + legSpread + legOut - clumsyWobble * 0.2;
    const legY = y + h * 0.22 + finSwing * 0.4 + postureShift;
    const legW = w * (isPrini ? 0.16 : 0.13);
    const thighH = h * (isPrini ? 0.11 : 0.12);
    const calfH = h * (isPrini ? 0.1 : 0.12);
    // 허벅지
    ctx.fillRect(leftLegX, legY, legW, thighH);
    ctx.fillRect(rightLegX, legY, legW, thighH);
    // 종아리(좌우 교차 킥)
    ctx.fillRect(leftLegX, legY + thighH + legKick, legW, calfH);
    ctx.fillRect(rightLegX, legY + thighH - legKick, legW, calfH);

    // 프리다이버 발끝은 최소 디테일로 처리해 가볍게 표현
    ctx.fillStyle = boot;
    if (isPrini) {
      ctx.fillRect(leftLegX, legY - h * 0.02 + legKick, legW, h * 0.04);
      ctx.fillRect(rightLegX, legY - h * 0.02 - legKick, legW, h * 0.04);
    } else {
      ctx.fillRect(leftLegX, legY - h * 0.01 + legKick, legW, h * 0.022);
      ctx.fillRect(rightLegX, legY - h * 0.01 - legKick, legW, h * 0.022);
    }

    // 몸통(고고다이버는 슬림한 프리다이버 웻수트 비율)
    const torsoW = w * (isPrini ? 0.56 : 0.54);
    const torsoH = h * (isPrini ? 0.3 : 0.38);
    const torsoX = drawX + w * 0.5 - torsoW * 0.5 + clumsyWobble * 0.25;
    const torsoY = y + h * 0.33 + postureShift;

    // 프린이는 기존 스쿠버형 탱크를 유지, 고고다이버는 탱크를 제거
    let tankAnchorX = torsoX + torsoW * 0.8;
    let tankAnchorY = torsoY + torsoH * 0.2;
    if (isPrini) {
      const tankW = w * 0.24;
      const tankH = h * 0.22;
      const tankX = drawX + w * 0.5 - tankW * 0.5 + clumsyWobble * 0.15;
      const tankY = y + h * 0.26 + postureShift;
      ctx.fillStyle = tankMain;
      ctx.fillRect(tankX, tankY, tankW, tankH);
      ctx.fillStyle = tankShade;
      ctx.fillRect(tankX, tankY, tankW * 0.28, tankH);
      ctx.fillStyle = strap;
      ctx.fillRect(tankX, tankY + tankH * 0.66, tankW, tankH * 0.12);
      tankAnchorX = tankX + tankW * 0.8;
      tankAnchorY = tankY + tankH * 0.25;
    }

    ctx.fillStyle = suitBase;
    ctx.fillRect(torsoX, torsoY, torsoW, torsoH);
    // 슈트 하이라이트 라인
    ctx.fillStyle = suitHighlight;
    ctx.fillRect(torsoX + torsoW * 0.2, torsoY + torsoH * 0.28, torsoW * 0.6, torsoH * 0.08);
    // 고고다이버 전용 액센트 라인
    if (isGogodiver) {
      ctx.fillStyle = suitAccent;
      ctx.fillRect(torsoX + torsoW * 0.18, torsoY + torsoH * 0.62, torsoW * 0.64, torsoH * 0.06);
      // 프리다이버 상징 요소: 가벼운 웨이트 벨트와 웨이트 팩
      ctx.fillStyle = strap;
      ctx.fillRect(torsoX + torsoW * 0.12, torsoY + torsoH * 0.52, torsoW * 0.76, torsoH * 0.08);
      ctx.fillStyle = "rgba(220, 228, 235, 0.62)";
      ctx.fillRect(torsoX + torsoW * 0.22, torsoY + torsoH * 0.535, torsoW * 0.14, torsoH * 0.055);
      ctx.fillRect(torsoX + torsoW * 0.64, torsoY + torsoH * 0.535, torsoW * 0.14, torsoH * 0.055);
    }
    // 고고다이버 로고 데칼(가슴 중앙)
    if (isGogodiver && ASSETS.logo.complete && ASSETS.logo.naturalWidth > 0) {
      // 기존 부착 방식은 유지하고, 프리다이버 체형에 맞춰 위치만 미세 보정
      const logoSize = torsoW * 0.36;
      const logoX = torsoX + torsoW * 0.5 - logoSize * 0.5;
      const logoY = torsoY + torsoH * 0.16;
      ctx.drawImage(ASSETS.logo, logoX, logoY, logoSize, logoSize);
    }

    // 팔(양측) - 상완/하완 분리로 수영 스트로크 표현
    ctx.fillStyle = suitShade;
    const leftArmX = drawX + w * 0.1 + armReach - armOut + clumsyWobble * 0.2;
    const rightArmX = drawX + w * 0.76 - armReach + armOut - clumsyWobble * 0.2;
    const armY = torsoY + torsoH * 0.18;
    const armW = w * (isPrini ? 0.12 : 0.11);
    const upperArmH = h * (isPrini ? 0.1 : 0.1);
    const lowerArmH = h * (isPrini ? 0.09 : 0.095);
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

    // 마스크 프레임 + 바이저(좌표는 스트랩/레귤레이터에 공유)
    const maskW = w * (isPrini ? 0.38 : 0.36);
    const maskH = h * (isPrini ? 0.1 : 0.1);
    const maskX = drawX + w * 0.5 - maskW * 0.5 + (isPrini ? w * 0.02 : 0);
    const maskY = y + h * (isPrini ? 0.71 : 0.695) + postureShift;

    // 마스크 스트랩(얼굴 뒤로 감기는 라인)
    ctx.fillStyle = strap;
    ctx.fillRect(maskX - w * 0.05, maskY + maskH * 0.6, maskW + w * 0.1, isPrini ? h * 0.03 : h * 0.022);

    // 얼굴(데이브 특유의 피부 톤과 턱수염)
    const faceCX = drawX + w * 0.5 + clumsyWobble * 0.15;
    const faceCY = y + h * 0.79 + postureShift;
    // 고고다이버는 짧은 헤어 실루엣으로 마스크 인상을 강조
    const hairW = isPrini ? w * 0.44 : w * 0.34;
    const hairH = isPrini ? h * 0.06 : h * 0.045;
    ctx.fillStyle = hair;
    ctx.fillRect(faceCX - hairW * 0.5, faceCY - h * 0.18, hairW, hairH);
    ctx.fillStyle = skinTone;
    ctx.beginPath();
    ctx.ellipse(faceCX, faceCY, w * 0.2, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isPrini) {
      ctx.fillStyle = beard;
      ctx.beginPath();
      ctx.ellipse(faceCX, faceCY + h * 0.05, w * 0.2, h * 0.08, 0, 0, Math.PI);
      ctx.fill();
      // 턱수염 위 콧수염 포인트
      ctx.fillRect(faceCX - w * 0.12, faceCY + h * 0.01, w * 0.24, h * 0.03);
    }

    // 마스크 프레임 + 바이저
    ctx.fillStyle = maskFrame;
    ctx.fillRect(maskX, maskY, maskW, maskH);
    ctx.fillStyle = maskShade;
    ctx.fillRect(maskX, maskY + maskH * 0.75, maskW, maskH * 0.25);
    ctx.fillStyle = visor;
    ctx.fillRect(maskX + maskW * 0.08, maskY + maskH * 0.12, maskW * 0.84, maskH * 0.6);
    ctx.fillStyle = visorHighlight;
    ctx.fillRect(maskX + maskW * 0.12, maskY + maskH * 0.18, maskW * 0.2, maskH * 0.2);

    if (isPrini) {
      // 프린이는 레귤레이터 + 호스로 기존 실루엣 유지
      const regulatorX = maskX + maskW * 0.5 - w * 0.03;
      const regulatorY = maskY + maskH * 0.82;
      ctx.fillStyle = hose;
      ctx.fillRect(regulatorX, regulatorY, w * 0.06, h * 0.03);
      ctx.strokeStyle = hose;
      ctx.lineWidth = Math.max(1, lineWidth * 0.8);
      ctx.beginPath();
      ctx.moveTo(regulatorX + w * 0.03, regulatorY + h * 0.01);
      ctx.lineTo(tankAnchorX, tankAnchorY);
      ctx.stroke();
    } else {
      // 고고다이버는 노즈클립 라인으로 프리다이버 장비 느낌만 최소 반영
      const clipW = w * 0.1;
      const clipH = h * 0.026;
      const clipX = faceCX - clipW * 0.5;
      const clipY = faceCY - h * 0.02;
      ctx.fillStyle = suitAccent;
      ctx.fillRect(clipX, clipY, clipW, clipH);
      ctx.strokeStyle = suitAccent;
      ctx.lineWidth = Math.max(1, lineWidth * 0.6);
      ctx.beginPath();
      ctx.moveTo(clipX + clipW * 0.5, clipY + clipH);
      ctx.lineTo(torsoX + torsoW * 0.5, torsoY + torsoH * 0.4);
      ctx.stroke();
    }

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

  // 상어 장애물 렌더링
  function drawShark(ctx, x, y, w, h) {
    // 몸통
    ctx.fillStyle = "#6f8aa3";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y + h * 0.6);
    ctx.quadraticCurveTo(x + w * 0.35, y + h * 0.2, x + w * 0.72, y + h * 0.35);
    ctx.quadraticCurveTo(x + w * 0.92, y + h * 0.45, x + w * 0.95, y + h * 0.6);
    ctx.quadraticCurveTo(x + w * 0.92, y + h * 0.75, x + w * 0.68, y + h * 0.78);
    ctx.quadraticCurveTo(x + w * 0.35, y + h * 0.9, x + w * 0.1, y + h * 0.6);
    ctx.closePath();
    ctx.fill();

    // 등지느러미
    ctx.fillStyle = "#5b6f84";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.4, y + h * 0.25);
    ctx.lineTo(x + w * 0.5, y + h * 0.02);
    ctx.lineTo(x + w * 0.6, y + h * 0.3);
    ctx.closePath();
    ctx.fill();

    // 꼬리 지느러미
    ctx.beginPath();
    ctx.moveTo(x + w * 0.06, y + h * 0.5);
    ctx.lineTo(x - w * 0.02, y + h * 0.3);
    ctx.lineTo(x + w * 0.08, y + h * 0.35);
    ctx.lineTo(x + w * 0.1, y + h * 0.5);
    ctx.lineTo(x + w * 0.08, y + h * 0.65);
    ctx.lineTo(x - w * 0.02, y + h * 0.7);
    ctx.closePath();
    ctx.fill();

    // 배 부분 하이라이트
    ctx.fillStyle = "#b7c6d4";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.6, y + h * 0.62, w * 0.18, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // 눈
    ctx.fillStyle = "#1a1f26";
    ctx.beginPath();
    ctx.arc(x + w * 0.78, y + h * 0.5, w * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  // 가오리 장애물 렌더링
  function drawRay(ctx, x, y, w, h) {
    ctx.fillStyle = "#5a728c";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.15);
    ctx.quadraticCurveTo(x + w * 0.05, y + h * 0.45, x + w * 0.2, y + h * 0.75);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.6, x + w * 0.8, y + h * 0.75);
    ctx.quadraticCurveTo(x + w * 0.95, y + h * 0.45, x + w * 0.5, y + h * 0.15);
    ctx.closePath();
    ctx.fill();

    // 꼬리
    ctx.strokeStyle = "#43586d";
    ctx.lineWidth = Math.max(1, w * 0.03);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.65);
    ctx.lineTo(x + w * 0.52, y + h * 0.98);
    ctx.stroke();
  }

  // 성게 장애물 렌더링
  function drawUrchin(ctx, x, y, w, h) {
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    const radius = Math.min(w, h) * 0.32;
    ctx.strokeStyle = "#3a3f3d";
    ctx.lineWidth = Math.max(1, w * 0.06);

    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * radius * 1.55, cy + Math.sin(angle) * radius * 1.55);
      ctx.stroke();
    }

    ctx.fillStyle = "#2d3230";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 곰치 장애물 렌더링
  function drawEel(ctx, x, y, w, h) {
    ctx.strokeStyle = "#5b7a4f";
    ctx.lineWidth = Math.max(2, h * 0.35);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y + h * 0.6);
    ctx.quadraticCurveTo(x + w * 0.4, y + h * 0.2, x + w * 0.7, y + h * 0.6);
    ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.8, x + w * 0.95, y + h * 0.5);
    ctx.stroke();

    // 눈
    ctx.fillStyle = "#1a1f26";
    ctx.beginPath();
    ctx.arc(x + w * 0.18, y + h * 0.52, h * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // 보라색 회복 포션 렌더링(후광 포함)
  function drawPotion(ctx, x, y, w, h) {
    const cx = x + w * 0.5;
    const cy = y + h * 0.56;
    const glowRadius = Math.max(w, h) * 0.72;

    // 뒤쪽 글로우로 시인성 확보
    const glow = ctx.createRadialGradient(cx, cy, glowRadius * 0.18, cx, cy, glowRadius);
    glow.addColorStop(0, "rgba(237, 178, 255, 0.72)");
    glow.addColorStop(0.55, "rgba(169, 78, 255, 0.32)");
    glow.addColorStop(1, "rgba(130, 45, 214, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 병 본체
    ctx.fillStyle = "#7d3ed1";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.34);
    ctx.lineTo(x + w * 0.8, y + h * 0.34);
    ctx.lineTo(x + w * 0.72, y + h * 0.9);
    ctx.lineTo(x + w * 0.28, y + h * 0.9);
    ctx.closePath();
    ctx.fill();

    // 병 목 부분/마개
    ctx.fillStyle = "#a073f2";
    ctx.fillRect(x + w * 0.38, y + h * 0.2, w * 0.24, h * 0.14);
    ctx.fillStyle = "#e8d6ff";
    ctx.fillRect(x + w * 0.34, y + h * 0.12, w * 0.32, h * 0.08);

    // 액체 하이라이트
    ctx.fillStyle = "rgba(236, 217, 255, 0.7)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.42, y + h * 0.58, w * 0.1, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
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

      if (obstacle.type === "jellyfish") {
        drawJellyfish(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }

      if (obstacle.type === "shark") {
        drawShark(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }

      if (obstacle.type === "ray") {
        drawRay(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }

      if (obstacle.type === "urchin") {
        drawUrchin(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }

      if (obstacle.type === "eel") {
        drawEel(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
      }

      if (obstacle.type === "potion") {
        drawPotion(ctx, obstacle.x, screenY, obstacle.width, obstacle.height);
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
      jellyfish: 0.22,
      shark: 0.2,
      ray: 0.2,
      urchin: 0.15,
      eel: 0.25,
      potion: 0.22,
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
    // 기본값은 고고다이버 프리셋으로 초기화
    depthRate: CONFIG.gameplay.characterSettings.shortfin.depthRate,
    spawnTimer: 0,
    spawnInterval: CONFIG.gameplay.characterSettings.shortfin.spawnMin,
    playerSpeed: CONFIG.gameplay.characterSettings.shortfin.playerSpeed,
    difficultyPreset: CONFIG.gameplay.characterSettings.shortfin,
    // 목숨/피격 상태
    lives: CONFIG.gameplay.maxLives,
    // 포션 수심 마일스톤 인덱스(최대 5개)
    potionMilestoneIndex: 0,
    invincibleUntilTime: 0,
    hitFlashUntilTime: 0,

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
      // 목숨 시스템 초기화(새 게임은 항상 2 목숨)
      this.lives = CONFIG.gameplay.maxLives;
      this.potionMilestoneIndex = 0;
      this.invincibleUntilTime = 0;
      this.hitFlashUntilTime = 0;
      // 캐릭터 난이도 프리셋 적용
      this.difficultyPreset = getCharacterPreset(character);
      this.spawnInterval = getSpawnInterval(this.depth, this.time, this.difficultyPreset);
      this.depthRate = this.difficultyPreset.depthRate;
      this.playerSpeed = this.difficultyPreset.playerSpeed;
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
      hideLifeLossIndicator();
      DOM.hudDepth.textContent = formatDepth(0);
      updateHudLives(this.lives);

      this.loop();
    },

    // Stop the game loop without clearing UI
    stop() {
      this.running = false;
    },

    // Spawn a new obstacle at random x position
    spawnObstacle(forcedType = null) {
      // 캐릭터 하강 방향(아래) 기준으로 화면 하단에 생성
      // 강제 타입이 없으면 기존 위험 장애물만 선택
      const type = forcedType || pickObstacleType();
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
        return false;
      }
      return true;
    },

    // Update positions, depth, and collision per frame
    update(delta) {
      // 수심 수치 증가
      this.depth += this.depthRate * delta;
      // 애니메이션 시간 누적
      this.time += delta;

      // 지정 수심(5/10/15/20/30m) 도달 시 포션을 1개씩만 생성
      while (this.potionMilestoneIndex < CONFIG.gameplay.potionMilestones.length) {
        const threshold = CONFIG.gameplay.potionMilestones[this.potionMilestoneIndex];
        if (this.depth < threshold) {
          break;
        }
        const spawned = this.spawnObstacle("potion");
        if (!spawned) {
          // 겹침 등으로 실패하면 다음 프레임에 같은 마일스톤 재시도
          break;
        }
        this.potionMilestoneIndex += 1;
      }

      // 좌/우 이동 처리
      const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (direction !== 0) {
        // 마지막 이동 방향을 기억해 캐릭터 방향을 고정
        state.facing = direction > 0 ? 1 : -1;
      }
      state.moving = direction !== 0;
      this.player.x += direction * this.playerSpeed * delta;
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
        this.spawnInterval = getSpawnInterval(this.depth, this.time, this.difficultyPreset);
        this.spawnObstacle();
      }

      // 화면 상단을 지나간 장애물 정리
      this.obstacles = this.obstacles.filter(
        (obstacle) => obstacle.worldY - this.cameraY + obstacle.height > -80
      );

      for (let index = 0; index < this.obstacles.length; index += 1) {
        const obstacle = this.obstacles[index];
        const obstacleScreenY = obstacle.worldY - this.cameraY;

        if (obstacleScreenY > this.size.height + 80 || obstacleScreenY + obstacle.height < -80) {
          continue;
        }

        // 실제 보이는 형태에 맞춘 축소 충돌 박스 적용
        const playerHitbox = getPlayerHitbox(this.player);
        const obstacleHitbox = getObstacleHitbox(obstacle, obstacleScreenY);

        if (rectsIntersect(playerHitbox, obstacleHitbox)) {
          if (obstacle.type === "potion") {
            // 포션 획득 시 목숨을 1 회복(상한 제한 없음)
            this.lives += 1;
            updateHudLives(this.lives);
            showLifeIndicator("목숨 +1", true);
            // 같은 포션을 재획득하지 않도록 즉시 제거
            this.obstacles.splice(index, 1);
            break;
          }

          // 무적 시간에는 같은 프레임/연속 충돌 차감을 방지
          if (this.time < this.invincibleUntilTime) {
            continue;
          }

          // 충돌 시 목숨 1 감소 + 피격 상태(무적/깜빡임) 시작
          this.lives = Math.max(0, this.lives - 1);
          this.invincibleUntilTime = this.time + CONFIG.gameplay.hitInvincibilitySeconds;
          this.hitFlashUntilTime = this.invincibleUntilTime;
          updateHudLives(this.lives);
          showLifeIndicator("목숨 -1");

          if (this.lives <= 0) {
            this.running = false;
            handleGameOver(this.depth);
          }
          // 한 프레임에는 한 번의 피격만 처리
          break;
        }
      }
    },

    // Render background, player, and obstacles
    render() {
      drawBackground(this.ctx, this.size, this.bubbles);
      drawObstacles(this.ctx, this.obstacles, this.cameraY, this.size);
      // 피격 직후에는 캐릭터를 깜빡여 무적 상태를 직관적으로 전달
      const isHitFlashing = this.time < this.hitFlashUntilTime;
      const blinkVisible = !isHitFlashing || Math.floor(this.time * 14) % 2 === 0;
      if (blinkVisible) {
        drawPlayer(this.ctx, this.player, state.character, state.facing, state.moving, this.time);
      }
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

      // 매 프레임 수심 HUD를 최신 값으로 동기화
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
    // 합격/탈락 메시지 갱신
    const isSuccess = depth >= CONFIG.gameplay.targetDepth - 0.01;
    DOM.resultMessage.classList.toggle("is-success", isSuccess);
    DOM.resultMessage.classList.toggle("is-fail", !isSuccess);
    DOM.resultHeadline.textContent = isSuccess ? "축하합니다!" : "초급 시험 탈락!";
    // 강조 문구는 스팬으로 감싸 스타일 적용
    DOM.resultSubline.innerHTML = isSuccess
      ? "프리다이빙 초급 기준인 <span class=\"result-highlight\">수심 10M에 합격</span>하셨습니다."
      : "<span class=\"result-highlight\">무제한 무료 코칭반</span>을 이용하여 꾸준히 연습하세요.";
    // 합격 시에만 하단 문구 표시
    DOM.resultFooter.textContent = isSuccess ? "다음 스테이지는 실제 잠수풀에서!" : "";

    DOM.leaderboardStatus.textContent = "저장 중...";

    // Save score to server with fallback queue
    const record = {
      name: state.player.name,
      phone: state.player.phone,
      depth: Number(depth.toFixed(2)),
      // 서버에는 영문 키로 저장
      character: getCharacterStorageKey(state.character),
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
    if (DOM.hudCharacter) {
      // 레거시 HUD가 있을 경우만 캐릭터 라벨 갱신
      DOM.hudCharacter.textContent = getCharacterLabel(state.character);
    }
    // 게임 진입 시 HUD는 기본값(수심 0, 목숨 2)으로 선반영
    DOM.hudDepth.textContent = formatDepth(0);
    updateHudLives(CONFIG.gameplay.maxLives);
    hideLifeLossIndicator();
    setActiveScreen("game");
    resizeCanvas(game);
    // 게임 화면 진입 시에는 시작 오버레이를 노출하고 대기
    DOM.gameStartOverlay.classList.add("is-visible");
    // 시작 전에는 터치 컨트롤 비활성화
    DOM.touchControls?.classList.add("is-disabled");
  }

  // 실제 게임 루프를 시작하는 핸들러
  function beginGamePlay() {
    if (!state.character) {
      showToast("캐릭터를 선택해 주세요.");
      return;
    }
    DOM.gameStartOverlay.classList.remove("is-visible");
    DOM.touchControls?.classList.remove("is-disabled");
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
    // 연락처 입력 중 하이픈을 자동 삽입해 000-0000-0000 형식 유지
    DOM.phoneInput.addEventListener("input", () => {
      DOM.phoneInput.value = normalizePhone(DOM.phoneInput.value);
    });

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

    DOM.btnGameStart.addEventListener("click", () => {
      // START 버튼을 눌러야 게임이 시작됨
      beginGamePlay();
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

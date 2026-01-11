(() => {
  const VERSION = "v0.4.0";
  const STORAGE_PREFIX = "textrpg-lucas";
  const LEGACY_PREFIX = "textrpg-omega";
  const SAVE_KEY = `${STORAGE_PREFIX}-save`;
  const RUNS_KEY = `${STORAGE_PREFIX}-runs`;
  const CODEX_KEY = `${STORAGE_PREFIX}-codex`;
  const AUDIO_MUTE_KEY = `${STORAGE_PREFIX}-audio-muted`;
  const DEFAULT_NODE_ID = "GUILD_ARRIVAL";
  const DEFAULT_PLAYER_NAME = "당신";
  const TRAVEL_STEPS_MIN = 4;
  const TRAVEL_STEPS_MAX = 7;
  const QUEST_STEPS_MIN = 1;
  const QUEST_STEPS_MAX = 3;
  const MAIN_QUESTS_MIN = 1;
  const MAIN_QUESTS_MAX = 2;
  const SIDE_QUESTS_MIN = 3;
  const SIDE_QUESTS_MAX = 6;
  const MAIN_QUEST_PREP_MIN = 1;
  const MAIN_QUEST_PREP_MAX = 3;
  const QUEST_REFRESH_COST = 30;
  const RARITY_WEIGHTS = {
    common: 0.8,
    uncommon: 0.15,
    rare: 0.045,
    epic: 0.005
  };
  const INTRO_START_SELECTOR = "[data-intro-start]";
  const AMBIENT_BGM_FILE = "Intro_BGM_Fog_Over_the_Faerie_Vale.mp3";
  const BATTLE_BGM_FILE = "Battle_BGM_Shadowfront_Reckoning.mp3";
  const BGM_FADE_MS = 320;
  const BASE_HP = 40;
  const CON_HP_MULTIPLIER = 2;
  const MAIN_SCRIPT = document.getElementById("appMain");
  const scriptSrc = MAIN_SCRIPT?.src || window.location.href;
  const BASE_URL = new URL("./", scriptSrc);
  const STAT_KEYS = ["STR", "CON", "WIS", "INT", "DEX", "LUK"];
  const STAT_LABELS = {
    STR: "힘",
    CON: "체력",
    WIS: "지혜",
    INT: "지능",
    DEX: "민첩",
    LUK: "행운"
  };
  const STAT_BASE_VALUE = 1;
  const STAT_POINT_POOL = 15;
  const STAT_MAX_VALUE = 8;
  const INTRO_STORAGE_KEY = `${STORAGE_PREFIX}-intro-seen`;
  const INTRO_SKIP_ENABLED = false;

  const ITEM_ICONS = {
    consumable: "🧪",
    tool: "🧰",
    artifact: "🔮",
    weapon: "⚔️",
    armor: "🛡️",
    accessory: "📿"
  };

  window.__ENGINE = VERSION;
  window.__LAST_BOOT_ERROR = null;

  function recordBootError(error) {
    if (!error) return;
    if (error instanceof Error) {
      const stack = error.stack ?? "";
      window.__LAST_BOOT_ERROR = stack
        ? `${error.name}: ${error.message}\n${stack}`
        : `${error.name}: ${error.message}`;
      return;
    }
    if (typeof error === "string") {
      window.__LAST_BOOT_ERROR = error;
      return;
    }
    if (typeof error === "object") {
      const message = error.message ?? JSON.stringify(error);
      window.__LAST_BOOT_ERROR = String(message);
      return;
    }
    window.__LAST_BOOT_ERROR = String(error);
  }

  window.addEventListener("error", (event) => {
    recordBootError(event?.error ?? event?.message ?? "알 수 없는 오류");
  });

  window.addEventListener("unhandledrejection", (event) => {
    recordBootError(event?.reason ?? "처리되지 않은 Promise 거부");
  });

  const audioState = {
    ambient: null,
    battle: null,
    volume: 0.85,
    muted: false,
    started: false,
    current: "ambient"
  };

  const elements = {
    introOverlay: document.getElementById("introOverlay"),
    introNotice: document.getElementById("intro-audio-notice"),
    introAudioButton: document.getElementById("btn-intro-audio"),
    nameModal: document.getElementById("nameModal"),
    nameInput: document.getElementById("nameInput"),
    nameConfirm: document.getElementById("btn-name-confirm"),
    nameCancel: document.getElementById("btn-name-cancel"),
    buildModal: document.getElementById("buildModal"),
    buildBack: document.getElementById("btn-build-back"),
    buildRandomSummary: document.getElementById("random-build-summary"),
    mainCenter: document.getElementById("main-center"),
    exploreCard: document.getElementById("explore-card"),
    sceneTitle: document.getElementById("scene-title"),
    sceneText: document.getElementById("scene-text"),
    diceValue: document.getElementById("dice-value"),
    diceLabel: document.getElementById("dice-label"),
    resumeCombat: document.getElementById("resume-combat"),
    choiceList: document.getElementById("choice-list"),
    guildBoard: document.getElementById("guild-board"),
    logPanel: document.getElementById("log-panel"),
    logToggle: document.getElementById("log-toggle"),
    log: document.getElementById("log"),
    logSummary: document.getElementById("log-summary"),
    hudHp: document.getElementById("hud-hp"),
    hudMp: document.getElementById("hud-mp"),
    hudGold: document.getElementById("hud-gold"),
    playerName: document.getElementById("player-name"),
    hudProfile: document.getElementById("hud-profile"),
    hudStats: document.getElementById("hud-stats"),
    statStr: document.getElementById("hud-stat-str"),
    statWis: document.getElementById("hud-stat-wis"),
    statInt: document.getElementById("hud-stat-int"),
    statDex: document.getElementById("hud-stat-dex"),
    statLuk: document.getElementById("hud-stat-luk"),
    statCon: document.getElementById("hud-stat-con"),
    saveButton: document.getElementById("btn-save"),
    actionDock: document.getElementById("action-dock"),
    versionLabel: document.getElementById("version-label"),
    resetButton: document.getElementById("btn-reset"),
    emergencyResetButton: document.getElementById("btn-emergency-reset"),
    dataError: document.getElementById("data-error"),
    dataErrorList: document.getElementById("data-error-list"),
    retryLoadButton: document.getElementById("btn-retry-load"),
    hardResetButton: document.getElementById("btn-hard-reset"),
    combatScene: document.getElementById("combat-scene"),
    combatPlayerHp: document.getElementById("combat-player-hp"),
    combatEnemyName: document.getElementById("combat-enemy-name"),
    combatEnemyHp: document.getElementById("combat-enemy-hp"),
    combatSituation: document.getElementById("combat-situation"),
    combatRecover: document.getElementById("combat-recover"),
    combatRecoverButton: document.getElementById("btn-combat-recover"),
    combatDicePanel: document.getElementById("combat-dice-panel"),
    combatDiceValue: document.getElementById("combat-dice-value"),
    combatDiceLabel: document.getElementById("combat-dice-label"),
    combatDiceBadge: document.getElementById("combat-dice-badge"),
    combatDock: document.getElementById("combat-dock"),
    combatLog: document.getElementById("combat-log"),
    combatPlayerName: document.getElementById("combat-player-name"),
    statusSheet: document.getElementById("status-sheet"),
    statusClose: document.getElementById("btn-close-status"),
    statsGrid: document.getElementById("stats-grid"),
    progressTrust: document.getElementById("progress-trust"),
    progressInsight: document.getElementById("progress-insight"),
    statusList: document.getElementById("status-list"),
    inventoryGrid: document.getElementById("inventory-grid"),
    inventorySheetGrid: document.getElementById("inventory-sheet-grid"),
    inventoryEmpty: document.getElementById("inventory-empty"),
    skillsList: document.getElementById("skills-list"),
    skillsEmpty: document.getElementById("skills-empty"),
    equipmentSlots: document.getElementById("equipment-slots"),
    equipmentList: document.getElementById("equipment-list"),
    equipmentSheetSlots: document.getElementById("equipment-sheet-slots"),
    equipmentSheetList: document.getElementById("equipment-sheet-list"),
    codexNodes: document.getElementById("codex-nodes"),
    codexEnemies: document.getElementById("codex-enemies"),
    codexEndings: document.getElementById("codex-endings"),
    codexNodeEmpty: document.getElementById("codex-node-empty"),
    codexEnemyEmpty: document.getElementById("codex-enemy-empty"),
    codexEndingEmpty: document.getElementById("codex-ending-empty"),
    rankingList: document.getElementById("ranking-list"),
    rankingEmpty: document.getElementById("ranking-empty"),
    sheetBackdrop: document.getElementById("sheet-backdrop"),
    audioButton: document.getElementById("btn-audio"),
    tooltip: document.getElementById("tooltip"),
    tooltipContent: document.getElementById("tooltip-content"),
    toast: document.getElementById("save-toast"),
    comingSoonModal: document.getElementById("coming-soon-modal"),
    comingSoonClose: document.getElementById("btn-close-coming"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    mainQuestModal: document.getElementById("main-quest-modal"),
    mainQuestTitle: document.getElementById("main-quest-title"),
    mainQuestDesc: document.getElementById("main-quest-desc"),
    mainQuestPrepare: document.getElementById("btn-main-quest-prepare"),
    mainQuestChallenge: document.getElementById("btn-main-quest-challenge"),
    mainQuestCancel: document.getElementById("btn-main-quest-cancel")
  };

  if (elements.versionLabel) {
    elements.versionLabel.textContent = VERSION;
  }

  const state = {
    data: null,
    maps: null,
    player: null,
    nodeId: DEFAULT_NODE_ID,
    phase: "node",
    prologueId: null,
    travelEventId: null,
    travelCount: 0,
    travelTarget: 0,
    travelHistory: [],
    travelRecent: [],
    travelFlags: {
      hasForcedCombat: false,
      hasForcedItem: false,
      hasForcedStatUp: false,
      travelStepIndex: 0,
      targetTravelSteps: 0
    },
    questCount: 0,
    questTarget: 0,
    runSeed: null,
    dayIndex: 1,
    guildBoard: null,
    acceptedMainQuestId: null,
    mainQuestState: "idle",
    mainQuestPrepRemaining: 0,
    chainProgress: {},
    activeQuest: null,
    combatContext: null,
    activeShopId: null,
    inCombat: false,
    combat: null,
    log: [],
    lastSummary: "최근 요약: -",
    runs: [],
    codex: { nodes: [], enemies: [], endings: [] },
    runRecorded: false
  };

  const uiState = {
    pendingNamePrompt: false,
    pendingName: null,
    pendingRandomStats: null
  };

  function updateAudioButton() {
    const isActive = !audioState.muted;
    const label = isActive ? "배경음악 끄기" : "배경음악 켜기";
    const icon = isActive ? "🔊" : "🔇";
    [elements.audioButton, elements.introAudioButton].forEach((button) => {
      if (!button) return;
      button.textContent = icon;
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute("aria-label", label);
    });
  }

  function setAudioMuted(muted) {
    audioState.muted = muted;
    try {
      localStorage.setItem(AUDIO_MUTE_KEY, muted ? "1" : "0");
    } catch (error) {
      recordBootError(error);
    }
    [audioState.ambient, audioState.battle].forEach((audio) => {
      if (audio) audio.muted = muted;
    });
    updateAudioButton();
  }

  function getBgmUrl(fileName) {
    return new URL(`sounds/${fileName}`, BASE_URL).toString();
  }

  function ensureAmbientAudio() {
    if (audioState.ambient) return audioState.ambient;
    const audio = new Audio(getBgmUrl(AMBIENT_BGM_FILE));
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = audioState.volume;
    audio.muted = audioState.muted;
    audioState.ambient = audio;
    return audio;
  }

  function ensureBattleAudio() {
    if (audioState.battle) return audioState.battle;
    const audio = new Audio(getBgmUrl(BATTLE_BGM_FILE));
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.muted = audioState.muted;
    audioState.battle = audio;
    return audio;
  }

  function fadeAudio(audio, from, to, duration, onComplete) {
    if (!audio) return;
    const startTime = performance.now();
    const delta = to - from;
    audio.volume = Math.max(0, Math.min(1, from));
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const value = from + delta * progress;
      audio.volume = Math.max(0, Math.min(1, value));
      if (progress < 1) {
        requestAnimationFrame(step);
      } else if (onComplete) {
        onComplete();
      }
    };
    requestAnimationFrame(step);
  }

  function ensureBgmTrack(key) {
    return key === "battle" ? ensureBattleAudio() : ensureAmbientAudio();
  }

  function switchBgm(target, immediate = false) {
    const next = ensureBgmTrack(target);
    const prev = audioState.current === "battle" ? audioState.battle : audioState.ambient;
    audioState.current = target;
    if (!next) return;
    if (audioState.muted || !audioState.started) {
      next.muted = audioState.muted;
      return;
    }
    if (prev === next) {
      if (next.paused) {
        next.play().catch(() => {});
      }
      next.volume = audioState.volume;
      return;
    }
    next.muted = false;
    next.volume = 0;
    next.play().catch(() => {});
    if (immediate) {
      if (prev) {
        prev.volume = 0;
        prev.pause();
      }
      next.volume = audioState.volume;
      return;
    }
    if (prev) {
      const from = Number.isFinite(prev.volume) ? prev.volume : audioState.volume;
      fadeAudio(prev, from, 0, BGM_FADE_MS, () => prev.pause());
    }
    fadeAudio(next, 0, audioState.volume, BGM_FADE_MS);
  }

  function loadAudioPreference() {
    try {
      audioState.muted = localStorage.getItem(AUDIO_MUTE_KEY) === "1";
    } catch (error) {
      recordBootError(error);
    }
    updateAudioButton();
  }

  async function activateAudioFromGesture(onFailure) {
    if (audioState.started) {
      updateAudioButton();
      return true;
    }
    const target = state.inCombat ? "battle" : "ambient";
    const audio = ensureBgmTrack(target);
    if (!audio) return false;
    if (audioState.muted) {
      updateAudioButton();
      return true;
    }
    try {
      await audio.play();
      audioState.started = true;
      switchBgm(target, true);
      updateAudioButton();
      return true;
    } catch (error) {
      if (onFailure) onFailure(error);
      return false;
    }
  }

  function setupIntroOverlay() {
    const intro = elements.introOverlay;
    if (!intro) return;
    if (INTRO_SKIP_ENABLED) {
      const seen = localStorage.getItem(INTRO_STORAGE_KEY) === "1";
      if (seen) {
        intro.remove();
        return;
      }
    }

    let dismissed = false;
    const dismissIntro = () => {
      if (dismissed) return;
      dismissed = true;
      if (INTRO_SKIP_ENABLED) {
        try {
          localStorage.setItem(INTRO_STORAGE_KEY, "1");
        } catch (error) {
          recordBootError(error);
        }
      }
      intro.classList.add("intro--hide");
      const removeIntro = () => intro.remove();
      intro.addEventListener("transitionend", removeIntro, { once: true });
      window.setTimeout(removeIntro, 900);
      if (uiState.pendingNamePrompt) {
        window.setTimeout(() => openNameModal(), 360);
      }
    };

    const maxAttempts = 3;
    let attempts = 0;
    let handling = false;

    const showAudioNotice = (message) => {
      if (!elements.introNotice) return;
      elements.introNotice.textContent = message;
      elements.introNotice.hidden = !message;
    };

    const attemptStart = async (dismissOnSuccess = true) => {
      if (handling || dismissed) return false;
      handling = true;
      attempts += 1;
      const success = await activateAudioFromGesture(() => {
        showAudioNotice("🔇 사운드가 차단되었습니다. 화면을 한 번 더 터치해 주세요.");
      });
      handling = false;
      if (success) {
        if (dismissOnSuccess) {
          dismissIntro();
        }
        return true;
      }
      if (attempts >= maxAttempts) {
        showAudioNotice("🔇 사운드가 계속 차단됩니다. 브라우저 설정을 확인해 주세요.");
        return false;
      }
      showAudioNotice("🔇 사운드가 차단되었습니다. 화면을 한 번 더 터치해 주세요.");
      return false;
    };

    const attemptAutoplay = () => {
      if (audioState.muted) {
        updateAudioButton();
        return;
      }
      const audio = ensureAmbientAudio();
      if (!audio) return;
      audio
        .play()
        .then(() => {
          audioState.started = true;
          switchBgm("ambient", true);
          updateAudioButton();
        })
        .catch(() => {});
    };

    const registerOneShot = () => {
      ["pointerdown", "touchend", "click"].forEach((eventName) => {
        intro.addEventListener(
          eventName,
          async (event) => {
            if (event.target.closest(".intro__audio-toggle")) return;
            if (!event.target.closest(INTRO_START_SELECTOR)) return;
            const started = await attemptStart(true);
            if (!started && attempts < maxAttempts) {
              registerOneShot();
            }
          },
          { once: true, passive: true }
        );
      });
    };

    attemptAutoplay();
    registerOneShot();

    intro.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const started = await attemptStart(true);
        if (!started && attempts < maxAttempts) {
          registerOneShot();
        }
      }
    });

    if (elements.introAudioButton) {
      ["pointerdown", "touchstart"].forEach((eventName) => {
        elements.introAudioButton.addEventListener(eventName, (event) => {
          event.stopPropagation();
          event.preventDefault();
        });
      });
      elements.introAudioButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (audioState.muted) {
          setAudioMuted(false);
          if (audioState.started) {
            switchBgm("ambient", true);
            return;
          }
        } else if (audioState.started) {
          setAudioMuted(true);
          return;
        }
        const started = await attemptStart(false);
        if (!started && attempts < maxAttempts) {
          registerOneShot();
        }
      });
      updateAudioButton();
    }

  }

  function calculateMaxHp(stats) {
    const con = Number(stats?.CON ?? 0);
    return BASE_HP + con * CON_HP_MULTIPLIER;
  }

  function ensureRunSeed() {
    if (Number.isFinite(Number(state.runSeed))) return;
    state.runSeed = Math.floor(Math.random() * 1000000000);
  }

  function defaultPlayer() {
    const stats = {
      STR: STAT_BASE_VALUE,
      DEX: STAT_BASE_VALUE,
      INT: STAT_BASE_VALUE,
      WIS: STAT_BASE_VALUE,
      LUK: STAT_BASE_VALUE,
      CHA: STAT_BASE_VALUE,
      CON: STAT_BASE_VALUE
    };
    const maxHp = calculateMaxHp(stats);
    return {
      name: DEFAULT_PLAYER_NAME,
      hp: maxHp,
      maxHp,
      mp: 8,
      maxMp: 8,
      gold: 20,
      stats,
      counters: { trust: 0, insight: 0 },
      inventory: [],
      equipmentInventory: [],
      equipmentSlots: { weapon: null, armor: null, accessory: null },
      build: "BALANCE"
    };
  }

  function normalizePlayer(playerData) {
    const fallback = defaultPlayer();
    const safe = playerData && typeof playerData === "object" ? playerData : {};
    const safeName = typeof safe.name === "string" ? safe.name.trim() : "";
    const player = {
      ...fallback,
      ...safe,
      name: safeName || fallback.name,
      mp: Number.isFinite(Number(safe.mp)) ? Number(safe.mp) : fallback.mp,
      maxMp: Number.isFinite(Number(safe.maxMp)) ? Number(safe.maxMp) : fallback.maxMp,
      stats: { ...fallback.stats, ...(safe.stats ?? {}) },
      counters: { ...fallback.counters, ...(safe.counters ?? {}) },
      inventory: Array.isArray(safe.inventory) ? safe.inventory : [],
      equipmentInventory: Array.isArray(safe.equipmentInventory) ? safe.equipmentInventory : [],
      equipmentSlots: { ...fallback.equipmentSlots, ...(safe.equipmentSlots ?? {}) },
      build: typeof safe.build === "string" ? safe.build : fallback.build
    };
    return player;
  }

  function migrateStorageKey(oldKey, newKey) {
    if (localStorage.getItem(newKey)) return;
    const legacyValue = localStorage.getItem(oldKey);
    if (legacyValue == null) return;
    try {
      localStorage.setItem(newKey, legacyValue);
    } catch (error) {
      recordBootError(error);
    }
  }

  function migrateLegacyStorage() {
    migrateStorageKey(`${LEGACY_PREFIX}-save`, SAVE_KEY);
    migrateStorageKey(`${LEGACY_PREFIX}-runs`, RUNS_KEY);
    migrateStorageKey(`${LEGACY_PREFIX}-codex`, CODEX_KEY);
  }

  function loadRuns() {
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      recordBootError(error);
      return [];
    }
  }

  function saveRuns() {
    try {
      localStorage.setItem(RUNS_KEY, JSON.stringify(state.runs));
    } catch (error) {
      recordBootError(error);
    }
  }

  function loadCodex() {
    const raw = localStorage.getItem(CODEX_KEY);
    if (!raw) return { nodes: [], enemies: [], endings: [] };
    try {
      const data = JSON.parse(raw);
      return {
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        enemies: Array.isArray(data.enemies) ? data.enemies : [],
        endings: Array.isArray(data.endings) ? data.endings : []
      };
    } catch (error) {
      recordBootError(error);
      return { nodes: [], enemies: [], endings: [] };
    }
  }

  function saveCodex() {
    try {
      localStorage.setItem(CODEX_KEY, JSON.stringify(state.codex));
    } catch (error) {
      recordBootError(error);
    }
  }

  function serializeState() {
    return {
      version: VERSION,
      nodeId: state.nodeId,
      player: state.player,
      phase: state.phase,
      prologueId: state.prologueId,
      travelEventId: state.travelEventId,
      travelCount: state.travelCount,
      travelTarget: state.travelTarget,
      travelHistory: state.travelHistory,
      travelRecent: state.travelRecent,
      travelFlags: state.travelFlags,
      questCount: state.questCount,
      questTarget: state.questTarget,
      runSeed: state.runSeed,
      dayIndex: state.dayIndex,
      guildBoard: state.guildBoard,
      acceptedMainQuestId: state.acceptedMainQuestId,
      mainQuestState: state.mainQuestState,
      mainQuestPrepRemaining: state.mainQuestPrepRemaining,
      chainProgress: state.chainProgress,
      activeQuest: state.activeQuest,
      combatContext: state.combatContext,
      activeShopId: state.activeShopId,
      inCombat: state.inCombat,
      combat: state.combat,
      log: state.log,
      lastSummary: state.lastSummary
    };
  }

  function saveState() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serializeState()));
      setToast("저장 완료");
    } catch (error) {
      recordBootError(error);
    }
  }

  function loadState() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      recordBootError(error);
      return null;
    }
  }

  function clearTextRpgStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith(STORAGE_PREFIX) || key.startsWith(LEGACY_PREFIX))
      ) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
  }

  function handleResetParam() {
    const url = new URL(window.location.href);
    if (url.searchParams.get("reset") === "1") {
      clearTextRpgStorage();
      url.searchParams.delete("reset");
      window.history.replaceState(null, "", url.toString());
    }
  }

  function setToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    setTimeout(() => elements.toast?.classList.remove("is-visible"), 1400);
  }

  function setView(mode) {
    const isCombat = mode === "combat";
    if (elements.exploreCard) elements.exploreCard.hidden = isCombat;
    if (elements.combatScene) elements.combatScene.hidden = !isCombat;
    if (elements.dataError) elements.dataError.hidden = mode !== "fatal";
    if (elements.resumeCombat) elements.resumeCombat.hidden = true;
  }

  function setLogExpanded(expanded) {
    if (!elements.logPanel || !elements.logToggle) return;
    elements.logPanel.classList.toggle("is-expanded", expanded);
    elements.logToggle.textContent = expanded ? "접기" : "펼치기";
    elements.logToggle.setAttribute("aria-expanded", String(expanded));
  }

  function renderLoading() {
    setView("loading");
    if (elements.sceneTitle) elements.sceneTitle.textContent = "준비 중...";
    if (elements.sceneText) elements.sceneText.textContent = "데이터를 불러오는 중입니다.";
    clearChoices();
  }

  function renderFatal(failures, error) {
    setView("fatal");
    if (elements.sceneTitle) elements.sceneTitle.textContent = "데이터 로드 실패";
    if (elements.sceneText) elements.sceneText.textContent = "데이터를 불러올 수 없습니다.";
    const details = [];
    failures.forEach((failure) => {
      details.push(
        `- ${failure.name}: ${failure.url}\n  status=${failure.status ?? "-"}\n  message=${failure.message}`
      );
    });
    if (error || window.__LAST_BOOT_ERROR) {
      details.push(`\n[오류]\n${error ?? window.__LAST_BOOT_ERROR}`);
    }
    if (elements.dataErrorList) {
      elements.dataErrorList.textContent = details.join("\n");
    }
    clearCombatState();
  }

  function renderLog() {
    if (!elements.log) return;
    elements.log.innerHTML = "";
    state.log.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "log__entry";
      row.textContent = entry;
      elements.log.appendChild(row);
    });
    if (elements.logSummary) {
      elements.logSummary.textContent = state.lastSummary;
    }
  }

  function setCombatBar(el, cur, max, color) {
    if (!el) return;
    const safeMax = Math.max(1, Number(max) || 1);
    const safeCur = Math.max(0, Math.min(safeMax, Number(cur) || 0));
    const pct = Math.round((safeCur / safeMax) * 100);
    el.textContent = `${safeCur}/${safeMax}`;
    el.style.setProperty("--fill", `${pct}%`);
    if (color) el.style.setProperty("--bar-color", color);
  }

  function renderCombatLog() {
    if (!elements.combatLog) return;
    elements.combatLog.innerHTML = "";
    const tail = state.log.slice(-10);
    tail.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "log__entry";
      row.textContent = entry;
      elements.combatLog.appendChild(row);
    });
    elements.combatLog.scrollTop = elements.combatLog.scrollHeight;
  }

  function addLog(entry) {
    state.log.push(entry);
    if (state.log.length > 40) {
      state.log.shift();
    }
    state.lastSummary = `최근 요약: ${entry}`;
    renderLog();
    if (state.inCombat) renderCombatLog();
  }

  function updateHud() {
    const effectiveStats = getEffectiveStats();
    if (elements.hudHp) {
      const hpValue = elements.hudHp.querySelector(".hud-pill__value");
      if (hpValue) {
        hpValue.textContent = `${state.player.hp}/${state.player.maxHp}`;
      }
    }
    if (elements.hudMp) {
      const mpValue = elements.hudMp.querySelector(".hud-pill__value");
      if (mpValue) {
        mpValue.textContent = `${state.player.mp}/${state.player.maxMp}`;
      }
    }
    if (elements.hudGold) {
      const goldValue = elements.hudGold.querySelector(".hud-pill__value");
      if (goldValue) {
        goldValue.textContent = String(state.player.gold ?? 0);
      }
    }
    if (elements.playerName) {
      elements.playerName.textContent = state.player.name ?? DEFAULT_PLAYER_NAME;
    }
    if (elements.combatPlayerName) {
      elements.combatPlayerName.textContent = state.player.name ?? DEFAULT_PLAYER_NAME;
    }
    if (elements.statStr) elements.statStr.textContent = String(effectiveStats.STR ?? 0);
    if (elements.statWis) elements.statWis.textContent = String(effectiveStats.WIS ?? 0);
    if (elements.statInt) elements.statInt.textContent = String(effectiveStats.INT ?? 0);
    if (elements.statDex) elements.statDex.textContent = String(effectiveStats.DEX ?? 0);
    if (elements.statLuk) elements.statLuk.textContent = String(effectiveStats.LUK ?? 0);
    if (elements.statCon) elements.statCon.textContent = String(effectiveStats.CON ?? 0);
    renderStatusSheet();
  }

  function clearChoices() {
    if (elements.choiceList) elements.choiceList.innerHTML = "";
  }

  function addChoiceButton(label, onClick) {
    if (!elements.choiceList) return;
    const button = document.createElement("button");
    button.className = "btn btn--choice";
    button.textContent = label;
    button.addEventListener("click", onClick);
    elements.choiceList.appendChild(button);
  }

  function setScene(title, text) {
    if (elements.sceneTitle) elements.sceneTitle.textContent = title ?? "";
    if (elements.sceneText) elements.sceneText.textContent = text ?? "";
    if (elements.diceValue) elements.diceValue.textContent = "--";
    if (elements.diceLabel) elements.diceLabel.textContent = "주사위 대기";
    if (elements.guildBoard) elements.guildBoard.hidden = true;
  }

  function getRandomItem(list) {
    if (!list.length) return null;
    const index = Math.floor(Math.random() * list.length);
    return list[index];
  }

  function normalizeBackgroundParts(raw) {
    return {
      origins: Array.isArray(raw?.origins) ? raw.origins : [],
      catalysts: Array.isArray(raw?.catalysts) ? raw.catalysts : [],
      templates: Array.isArray(raw?.templates) ? raw.templates : []
    };
  }

  function createBackgroundForPlayer() {
    const parts = state.data?.backgroundParts;
    if (!parts) return null;
    const name = state.player?.name ?? DEFAULT_PLAYER_NAME;
    const origin = getRandomItem(parts.origins) ?? "알 수 없는 뿌리에서 자라났다";
    const catalyst = getRandomItem(parts.catalysts) ?? "작은 계기를 얻었다";
    const template =
      getRandomItem(parts.templates) ??
      "{name}. 당신은 {origin}.\n어느 날 {catalyst}\n그래서 당신은 모험가 길드를 향했다.";
    const text = String(template)
      .replace(/\{name\}/g, name)
      .replace(/\{origin\}/g, origin)
      .replace(/\{catalyst\}/g, catalyst);
    return { origin, catalyst, text };
  }

  function ensurePlayerBackground() {
    if (state.player?.background?.text) return state.player.background;
    const background = createBackgroundForPlayer();
    if (background) {
      state.player.background = background;
      saveState();
    }
    return background;
  }

  function getCurrentPrologue() {
    const prologues = state.data?.prologues ?? [];
    if (state.prologueId) {
      return prologues.find((prologue) => prologue.id === state.prologueId) ?? null;
    }
    const selected = getRandomItem(prologues);
    if (selected) {
      state.prologueId = selected.id;
      saveState();
    }
    return selected;
  }

  function ensureTravelFlags() {
    if (!state.travelFlags || typeof state.travelFlags !== "object") {
      state.travelFlags = createTravelFlags(state.travelTarget, state.travelCount);
    }
    state.travelFlags.travelStepIndex = state.travelCount;
    state.travelFlags.targetTravelSteps = state.travelTarget;
  }

  function getMissingTravelTypes() {
    ensureTravelFlags();
    const missing = [];
    if (!state.travelFlags.hasForcedCombat) missing.push("combat");
    if (!state.travelFlags.hasForcedItem) missing.push("item");
    if (!state.travelFlags.hasForcedStatUp) missing.push("stat_up");
    return missing;
  }

  function selectTravelEventByType(events, type, recentIds) {
    if (!type) return null;
    const typed = events.filter((event) => event.type === type);
    if (!typed.length) return null;
    const filtered = typed.filter((event) => !recentIds.includes(event.id));
    return getRandomItem(filtered.length ? filtered : typed);
  }

  function getCurrentTravelEvent() {
    const travelEvents = state.data?.travelEvents ?? [];
    if (state.travelEventId) {
      return travelEvents.find((event) => event.id === state.travelEventId) ?? null;
    }
    const recentIds = Array.isArray(state.travelRecent) ? state.travelRecent : [];
    const remainingSteps = Math.max(0, state.travelTarget - state.travelCount);
    const missingTypes = getMissingTravelTypes();
    let selected = null;
    if (missingTypes.length && remainingSteps <= missingTypes.length) {
      const forcedType = getRandomItem(missingTypes);
      selected = selectTravelEventByType(travelEvents, forcedType, recentIds);
    }
    if (!selected) {
      const filtered = travelEvents.filter((event) => !recentIds.includes(event.id));
      const pool = filtered.length ? filtered : travelEvents;
      selected = getRandomItem(pool);
    }
    if (selected) {
      state.travelEventId = selected.id;
      saveState();
    }
    return selected;
  }

  function advanceTravel() {
    if (state.travelCount >= state.travelTarget) {
      state.phase = "node";
      state.nodeId = "GUILD_ARRIVAL";
      renderNode(state.nodeId);
      return;
    }
    renderTravelEvent();
  }

  function getTravelRewardItem() {
    const items = Array.isArray(state.data?.items) ? state.data.items : [];
    const consumables = items.filter((item) => item.type === "consumable");
    const pool = consumables.length ? consumables : items;
    return getRandomItem(pool);
  }

  function applyTravelEventTypeEffects(travelEvent) {
    ensureTravelFlags();
    const result = { item: null, statKey: null };
    if (!travelEvent?.type) return result;
    if (travelEvent.type === "combat") {
      state.travelFlags.hasForcedCombat = true;
      return result;
    }
    if (travelEvent.type === "item") {
      state.travelFlags.hasForcedItem = true;
      const item = getTravelRewardItem();
      if (item) {
        addItemToInventory(item.id);
        result.item = item;
      }
    }
    if (travelEvent.type === "stat_up") {
      state.travelFlags.hasForcedStatUp = true;
      const statKey = getRandomItem(STAT_KEYS);
      if (statKey) {
        increaseStat(statKey, 1);
        result.statKey = statKey;
      }
    }
    return result;
  }

  function finalizeTravelEvent(travelEvent, option = null) {
    const outcomeText = option?.outcomeText ?? travelEvent?.outcomeText ?? "";
    if (option?.impact) {
      applyImpact(option.impact);
    }
    const { item, statKey } = applyTravelEventTypeEffects(travelEvent);
    if (outcomeText) {
      addLog(outcomeText);
    }
    if (item) {
      addLog(`아이템 획득: ${item.name ?? item.id}`);
    }
    if (statKey) {
      const label = STAT_LABELS[statKey] ?? statKey;
      addLog(`${label}이 1 상승했다.`);
    }
    updateHud();
    state.travelCount += 1;
    ensureTravelFlags();
    if (travelEvent?.id && !state.travelHistory.includes(travelEvent.id)) {
      state.travelHistory.push(travelEvent.id);
    }
    if (travelEvent?.id) {
      state.travelRecent.push(travelEvent.id);
      if (state.travelRecent.length > 3) {
        state.travelRecent = state.travelRecent.slice(-3);
      }
    }
    state.travelEventId = null;
    if (option?.startCombat) {
      startCombat(option.startCombat);
      saveState();
      return;
    }
    advanceTravel();
    saveState();
  }

  function renderBackground() {
    state.phase = "background";
    setView("explore");
    const background = ensurePlayerBackground();
    const text =
      background?.text ??
      `${state.player?.name ?? DEFAULT_PLAYER_NAME}. 당신의 기록을 불러올 수 없습니다.\n잠시 후 다시 시도해 주세요.`;
    setScene("모험가 등록서", text);
    clearChoices();
    addChoiceButton("길드로 향한다", () => {
      state.phase = "prologue";
      state.prologueId = null;
      renderPrologue();
      saveState();
    });
    addLog("모험가 등록서를 작성했다.");
    updateHud();
    saveState();
  }

  function renderPrologue() {
    state.phase = "prologue";
    setView("explore");
    const prologue = getCurrentPrologue();
    if (!prologue) {
      setScene("프롤로그", "여정을 시작할 이유를 찾지 못했다.");
      clearChoices();
      addChoiceButton("여정을 시작한다", () => {
        state.phase = "travel";
        state.travelEventId = null;
        renderTravelEvent();
        saveState();
      });
      addLog("프롤로그를 건너뛰고 여정을 시작했다.");
      updateHud();
      saveState();
      return;
    }

    setScene(prologue.title ?? "프롤로그", prologue.text ?? "");
    clearChoices();
    addChoiceButton("여정을 시작한다", () => {
      state.phase = "travel";
      state.travelEventId = null;
      renderTravelEvent();
      saveState();
    });
    addLog(prologue.title ?? "프롤로그");
    updateHud();
    saveState();
  }

  function renderTravelEvent() {
    state.phase = "travel";
    setView("explore");
    const travelEvent = getCurrentTravelEvent();
    if (!travelEvent) {
      setScene("여정", "길이 잠시 끊겼다. 숨을 고르고 다시 걷는다.");
      clearChoices();
      addChoiceButton("계속 걷는다", () => {
        state.travelCount += 1;
        ensureTravelFlags();
        state.travelEventId = null;
        advanceTravel();
        saveState();
      });
      addLog("여정이 잠시 멈췄다.");
      updateHud();
      saveState();
      return;
    }

    setScene(travelEvent.title ?? "여정", travelEvent.text ?? "");
    clearChoices();
    const options = Array.isArray(travelEvent.options) ? travelEvent.options : [];
    if (!options.length) {
      addChoiceButton("계속 걷는다", () => {
        finalizeTravelEvent(travelEvent);
      });
    } else {
      options.forEach((option) => {
        const label = option.text ?? "선택";
        addChoiceButton(label, () => {
          finalizeTravelEvent(travelEvent, option);
        });
      });
    }
    addLog(`여정: ${travelEvent.title ?? "이벤트"}`);
    updateHud();
    saveState();
  }

  function renderCurrent() {
    if (state.phase === "guild") {
      renderGuildBoard();
      return;
    }
    if (state.phase === "quest") {
      if (state.activeQuest) {
        startSideQuest(state.activeQuest.id);
        return;
      }
      renderGuildBoard();
      return;
    }
    if (state.phase === "shop") {
      const shop = (state.data?.shops ?? []).find((entry) => entry.id === state.activeShopId);
      if (shop) {
        renderShop(shop);
        return;
      }
    }
    if (state.inCombat) {
      renderCombat();
      return;
    }
    if (state.phase === "background") {
      renderBackground();
      return;
    }
    if (state.phase === "prologue") {
      renderPrologue();
      return;
    }
    if (state.phase === "travel") {
      renderTravelEvent();
      return;
    }
    renderNode(state.nodeId || DEFAULT_NODE_ID);
  }

  function normalizeNodes(raw) {
    const list = Array.isArray(raw) ? raw : raw?.nodes ?? [];
    return list
      .map((node) => {
        const id = node.node_id ?? node.id ?? node.nodeId;
        if (!id) return null;
        const choices = Array.isArray(node.choices) ? node.choices : [];
        return {
          ...node,
          id,
          title: node.title ?? node.name ?? id,
          situation: node.situation ?? node.text ?? "",
          choices: choices.map((choice) => ({
            ...choice,
            next: choice.next_node ?? choice.next ?? null,
            ending: choice.ending_id ?? choice.endingId ?? null,
            startCombat: choice.start_combat ?? choice.startCombat ?? null,
            impact: choice.impact ?? choice.effects ?? choice.delta ?? null,
            questComplete: choice.quest_complete ?? choice.questComplete ?? false
          }))
        };
      })
      .filter(Boolean);
  }

  function normalizePrologues(raw) {
    const list = Array.isArray(raw) ? raw : raw?.prologues ?? [];
    return list
      .map((prologue) => {
        const id = prologue.id ?? prologue.prologue_id ?? prologue.prologueId;
        if (!id) return null;
        return {
          ...prologue,
          id,
          title: prologue.title ?? "프롤로그",
          text: prologue.text ?? prologue.situation ?? ""
        };
      })
      .filter(Boolean);
  }

  function normalizeTravelEvents(raw) {
    const list = Array.isArray(raw) ? raw : raw?.events ?? raw?.travel ?? [];
    return list
      .map((event) => {
        const id = event.id ?? event.event_id ?? event.eventId;
        if (!id) return null;
        const options = Array.isArray(event.options) ? event.options : [];
        return {
          ...event,
          id,
          title: event.title ?? "여정",
          text: event.text ?? event.situation ?? "",
          outcomeText: event.outcomeText ?? event.outcome_text ?? event.outcome ?? "",
          options: options.map((option) => ({
            ...option,
            impact: option.impact ?? option.effects ?? option.delta ?? null,
            startCombat: option.start_combat ?? option.startCombat ?? null,
            outcomeText: option.outcomeText ?? option.outcome_text ?? option.outcome ?? ""
          }))
        };
      })
      .filter(Boolean);
  }

  function normalizeEnemies(raw) {
    const list = Array.isArray(raw) ? raw : raw?.enemies ?? [];
    return list
      .map((enemy) => {
        const id = enemy.enemy_id ?? enemy.enemyId ?? enemy.id;
        if (!id) return null;
        const dmgSource = enemy["피해량"] ?? {};
        return {
          ...enemy,
          id,
          name: enemy.name ?? enemy["이름"] ?? "적",
          hp: Number(enemy.hp ?? enemy["체력"] ?? 10),
          ac: Number(enemy.ac ?? enemy.armorClass ?? enemy["AC"] ?? 10),
          attack: Number(enemy.attack ?? enemy["공격"] ?? 0),
          dmgMin: Number(enemy.damageMin ?? dmgSource["최소"] ?? 1),
          dmgMax: Number(enemy.damageMax ?? dmgSource["최대"] ?? 2),
          statusAttack: enemy.status_attack ?? enemy.statusAttack ?? null
        };
      })
      .filter(Boolean);
  }

  function normalizeEndings(raw) {
    const list = Array.isArray(raw) ? raw : raw?.endings ?? [];
    return list
      .map((ending) => {
        const id = ending.ending_id ?? ending.endingId ?? ending.id;
        if (!id) return null;
        return {
          ...ending,
          id,
          text: ending.text ?? ending.description ?? ""
        };
      })
      .filter(Boolean);
  }

  function createMaps(data) {
    const nodesMap = new Map();
    data.nodes.forEach((node) => nodesMap.set(node.id, node));
    const enemiesMap = new Map();
    data.enemies.forEach((enemy) => enemiesMap.set(enemy.id, enemy));
    const endingsMap = new Map();
    data.endings.forEach((ending) => endingsMap.set(ending.id, ending));
    const equipmentMap = new Map();
    (data.equipment ?? []).forEach((item) => equipmentMap.set(item.id, item));
    return { nodesMap, enemiesMap, endingsMap, equipmentMap };
  }

  function createTravelFlags(targetSteps, stepIndex = 0) {
    return {
      hasForcedCombat: false,
      hasForcedItem: false,
      hasForcedStatUp: false,
      travelStepIndex: stepIndex,
      targetTravelSteps: targetSteps
    };
  }

  function newGameState(playerName = DEFAULT_PLAYER_NAME, buildType = "BALANCE", buildStats = null) {
    state.player = normalizePlayer({
      name: playerName,
      background: null,
      stats: buildStats ?? createBaseStats(),
      inventory: [],
      build: buildType
    });
    ensureRunSeed();
    state.dayIndex = 1;
    state.guildBoard = null;
    state.acceptedMainQuestId = null;
    state.mainQuestState = "idle";
    state.mainQuestPrepRemaining = 0;
    state.chainProgress = {};
    state.activeQuest = null;
    state.combatContext = null;
    state.activeShopId = null;
    recalcDerivedStats();
    state.player.hp = state.player.maxHp;
    state.nodeId = "GUILD_ARRIVAL";
    state.phase = "background";
    state.prologueId = null;
    state.travelEventId = null;
    state.travelCount = 0;
    state.travelTarget = randomBetween(TRAVEL_STEPS_MIN, TRAVEL_STEPS_MAX);
    state.travelHistory = [];
    state.travelRecent = [];
    state.travelFlags = createTravelFlags(state.travelTarget, state.travelCount);
    state.questCount = 0;
    state.questTarget = randomBetween(QUEST_STEPS_MIN, QUEST_STEPS_MAX);
    state.inCombat = false;
    state.combat = null;
    state.log = [];
    state.lastSummary = "최근 요약: -";
    state.runRecorded = false;
  }

  function openNameModal() {
    if (!elements.nameModal || !elements.nameInput) return;
    elements.nameModal.hidden = false;
    const currentName = state.player?.name ?? DEFAULT_PLAYER_NAME;
    elements.nameInput.value = currentName === DEFAULT_PLAYER_NAME ? "" : currentName;
    window.setTimeout(() => {
      elements.nameInput?.focus();
      elements.nameInput?.select();
    }, 0);
  }

  function closeNameModal() {
    if (!elements.nameModal) return;
    elements.nameModal.hidden = true;
  }

  function openBuildModal() {
    if (!elements.buildModal) return;
    uiState.pendingRandomStats = generateRandomBuildStats();
    if (elements.buildRandomSummary) {
      elements.buildRandomSummary.textContent = formatStatsSummary(uiState.pendingRandomStats);
    }
    elements.buildModal.hidden = false;
  }

  function closeBuildModal() {
    if (!elements.buildModal) return;
    elements.buildModal.hidden = true;
  }

  function normalizePlayerName(raw) {
    const trimmed = String(raw ?? "").trim();
    return trimmed.length ? trimmed : DEFAULT_PLAYER_NAME;
  }

  function createBaseStats() {
    return {
      STR: STAT_BASE_VALUE,
      DEX: STAT_BASE_VALUE,
      INT: STAT_BASE_VALUE,
      WIS: STAT_BASE_VALUE,
      LUK: STAT_BASE_VALUE,
      CON: STAT_BASE_VALUE,
      CHA: STAT_BASE_VALUE
    };
  }

  function buildStatsFromPreset(additional) {
    const stats = createBaseStats();
    Object.entries(additional ?? {}).forEach(([key, value]) => {
      stats[key] = Math.max(STAT_BASE_VALUE, stats[key] + Number(value ?? 0));
    });
    return stats;
  }

  function generateRandomBuildStats() {
    const stats = createBaseStats();
    let points = STAT_POINT_POOL;
    while (points > 0) {
      const key = getRandomItem(STAT_KEYS);
      if (!key) break;
      if (stats[key] < STAT_MAX_VALUE) {
        stats[key] += 1;
        points -= 1;
      }
    }
    return stats;
  }

  function getBuildPreset(buildType) {
    const presets = {
      STR: { STR: 6, CON: 4, DEX: 2, WIS: 1, INT: 1, LUK: 1 },
      DEX: { DEX: 6, LUK: 3, CON: 3, STR: 2, WIS: 1, INT: 0 },
      INT: { INT: 6, WIS: 4, LUK: 2, CON: 2, DEX: 1, STR: 0 },
      BALANCE: { STR: 3, DEX: 3, INT: 3, WIS: 3, CON: 2, LUK: 1 }
    };
    if (buildType === "RANDOM") return null;
    return presets[buildType] ?? presets.BALANCE;
  }

  function formatStatsSummary(stats) {
    if (!stats) return "";
    return STAT_KEYS.map((key) => `${key}${stats[key] ?? 0}`).join(" ");
  }

  function applyNewJourney(playerName, buildType = "BALANCE", buildStats = null) {
    uiState.pendingNamePrompt = false;
    const normalizedName = normalizePlayerName(playerName);
    const preset = getBuildPreset(buildType);
    const finalStats =
      buildStats ??
      (buildType === "RANDOM" ? generateRandomBuildStats() : buildStatsFromPreset(preset));
    newGameState(normalizedName, buildType, finalStats);
    state.player.background = createBackgroundForPlayer();
    state.phase = "background";
    saveState();
    renderCurrent();
  }

  function promptNewJourney() {
    uiState.pendingNamePrompt = true;
    openNameModal();
  }

  function applyImpact(impact) {
    if (!impact || typeof impact !== "object") return;
    const hpDelta = Number(impact.hp ?? 0);
    const mpDelta = Number(impact.mp ?? 0);
    const goldDelta = Number(impact.gold ?? 0);
    const trustDelta = Number(impact.trust ?? 0);
    const insightDelta = Number(impact.insight ?? 0);
    if (Number.isFinite(hpDelta)) {
      state.player.hp = Math.max(0, Math.min(state.player.maxHp, state.player.hp + hpDelta));
    }
    if (Number.isFinite(mpDelta)) {
      state.player.mp = Math.max(0, Math.min(state.player.maxMp, state.player.mp + mpDelta));
    }
    if (Number.isFinite(goldDelta)) {
      state.player.gold = Number(state.player.gold ?? 0) + goldDelta;
    }
    if (Number.isFinite(trustDelta)) {
      state.player.counters.trust = Number(state.player.counters.trust ?? 0) + trustDelta;
    }
    if (Number.isFinite(insightDelta)) {
      state.player.counters.insight = Number(state.player.counters.insight ?? 0) + insightDelta;
    }
    recalcDerivedStats();
    updateHud();
  }

  function addItemToInventory(itemId) {
    if (!itemId) return;
    if (!Array.isArray(state.player.inventory)) {
      state.player.inventory = [];
    }
    state.player.inventory.push(itemId);
  }

  function increaseStat(statKey, amount = 1) {
    if (!statKey) return;
    if (!state.player.stats) state.player.stats = {};
    const current = Number(state.player.stats[statKey] ?? 0);
    state.player.stats[statKey] = current + amount;
    recalcDerivedStats();
  }

  function addEquipmentToInventory(equipmentId) {
    if (!equipmentId) return;
    if (!Array.isArray(state.player.equipmentInventory)) {
      state.player.equipmentInventory = [];
    }
    state.player.equipmentInventory.push(equipmentId);
  }

  function getInventoryItems() {
    const inventory = Array.isArray(state.player?.inventory) ? state.player.inventory : [];
    const items = Array.isArray(state.data?.items) ? state.data.items : [];
    const itemsMap = new Map(items.map((item) => [item.id, item]));
    return inventory.map((id) => itemsMap.get(id) ?? { id, name: id, type: "item" });
  }

  function getEquipmentItems() {
    const inventory = Array.isArray(state.player?.equipmentInventory)
      ? state.player.equipmentInventory
      : [];
    const equipment = Array.isArray(state.data?.equipment) ? state.data.equipment : [];
    const equipmentMap = new Map(equipment.map((item) => [item.id, item]));
    return inventory.map((id) => equipmentMap.get(id) ?? { id, name: id, slot: "unknown" });
  }

  function getEquippedItems() {
    const slots = state.player?.equipmentSlots ?? {};
    const equipment = Array.isArray(state.data?.equipment) ? state.data.equipment : [];
    const equipmentMap = new Map(equipment.map((item) => [item.id, item]));
    return Object.entries(slots).map(([slot, id]) => ({
      slot,
      item: id ? equipmentMap.get(id) ?? { id, name: id, slot } : null
    }));
  }

  function getEquipmentMods() {
    const equipped = getEquippedItems();
    const mods = {};
    equipped.forEach(({ item }) => {
      if (!item || !item.mods) return;
      Object.entries(item.mods).forEach(([key, value]) => {
        mods[key] = Number(mods[key] ?? 0) + Number(value ?? 0);
      });
    });
    return mods;
  }

  function getEffectiveStats() {
    const base = state.player?.stats ?? {};
    const mods = getEquipmentMods();
    const result = { ...base };
    STAT_KEYS.forEach((key) => {
      result[key] = Number(base[key] ?? 0) + Number(mods[key] ?? 0);
    });
    return result;
  }

  function recalcDerivedStats() {
    const effectiveStats = getEffectiveStats();
    const recalculatedMaxHp = calculateMaxHp(effectiveStats);
    state.player.maxHp = recalculatedMaxHp;
    state.player.hp = Math.min(state.player.hp, recalculatedMaxHp);
  }

  function formatMods(mods) {
    if (!mods) return "보정 없음";
    const entries = Object.entries(mods)
      .filter(([, value]) => Number(value ?? 0) != 0)
      .map(([key, value]) => `${key} ${Number(value) > 0 ? "+" : ""}${value}`);
    return entries.length ? entries.join(" / ") : "보정 없음";
  }

  function equipItem(equipmentId) {
    if (!equipmentId) return;
    const equipmentMap = state.maps?.equipmentMap;
    const item = equipmentMap?.get(equipmentId);
    if (!item) return;
    const slot = item.slot ?? "weapon";
    const slots = state.player.equipmentSlots ?? {};
    const prev = slots[slot];
    if (prev) {
      addEquipmentToInventory(prev);
    }
    slots[slot] = equipmentId;
    state.player.equipmentSlots = slots;
    state.player.equipmentInventory = (state.player.equipmentInventory ?? []).filter(
      (id) => id !== equipmentId
    );
    recalcDerivedStats();
    updateHud();
    renderStatusSheet();
    renderInventorySheet();
    saveState();
  }

  function unequipItem(slot) {
    if (!slot) return;
    const slots = state.player.equipmentSlots ?? {};
    const equippedId = slots[slot];
    if (!equippedId) return;
    addEquipmentToInventory(equippedId);
    slots[slot] = null;
    state.player.equipmentSlots = slots;
    recalcDerivedStats();
    updateHud();
    renderStatusSheet();
    renderInventorySheet();
    saveState();
  }

  function meetsRequirements(requirements) {
    if (!requirements || typeof requirements !== "object") return true;
    const minHp = Number(requirements.min_hp);
    const maxHp = Number(requirements.max_hp);
    const minGold = Number(requirements.min_gold);
    const maxGold = Number(requirements.max_gold);
    const minTrust = Number(requirements.min_trust);
    const maxTrust = Number(requirements.max_trust);
    const minInsight = Number(requirements.min_insight);
    const maxInsight = Number(requirements.max_insight);
    if (Number.isFinite(minHp) && state.player.hp < minHp) return false;
    if (Number.isFinite(maxHp) && state.player.hp > maxHp) return false;
    if (Number.isFinite(minGold) && state.player.gold < minGold) return false;
    if (Number.isFinite(maxGold) && state.player.gold > maxGold) return false;
    if (Number.isFinite(minTrust) && state.player.counters.trust < minTrust) return false;
    if (Number.isFinite(maxTrust) && state.player.counters.trust > maxTrust) return false;
    if (Number.isFinite(minInsight) && state.player.counters.insight < minInsight) return false;
    if (Number.isFinite(maxInsight) && state.player.counters.insight > maxInsight) return false;
    return true;
  }

  function addCodexEntry(type, id) {
    if (!id || !state.codex[type]) return;
    if (!state.codex[type].includes(id)) {
      state.codex[type].push(id);
      saveCodex();
      renderCodexSheet();
    }
  }

  function renderInventoryGrid(target, items) {
    if (!target) return;
    target.innerHTML = "";
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "inventory-item";
      const typeIcon = ITEM_ICONS[item.type] ?? "🎲";
      card.innerHTML = `
        <span class="inventory-item__icon" aria-hidden="true">${typeIcon}</span>
        <span class="inventory-item__name">${item.name ?? "이름 없음"}</span>
        <span class="inventory-item__badge">${item.type ?? "item"}</span>
      `;
      card.title = item.description ?? "";
      target.appendChild(card);
    });
  }

  function renderEquipmentPanel(slotTarget, listTarget) {
    if (slotTarget) {
      slotTarget.innerHTML = "";
      const equipped = getEquippedItems();
      equipped.forEach(({ slot, item }) => {
        const row = document.createElement("div");
        row.className = "equipment-slot";
        const label = item?.name ?? "비어 있음";
        row.innerHTML = `
          <div class="equipment-slot__meta">
            <strong>${slot.toUpperCase()}</strong>
            <span>${label}</span>
          </div>
        `;
        const action = document.createElement("button");
        action.className = "btn btn--ghost btn--tiny";
        action.textContent = item ? "해제" : "해제";
        action.disabled = !item;
        action.addEventListener("click", () => {
          if (!item) return;
          unequipItem(slot);
        });
        row.appendChild(action);
        slotTarget.appendChild(row);
      });
    }
    if (listTarget) {
      listTarget.innerHTML = "";
      const equipmentItems = getEquipmentItems();
      if (!equipmentItems.length) {
        const empty = document.createElement("div");
        empty.className = "sheet__notice";
        empty.textContent = "보유 장비가 없습니다.";
        listTarget.appendChild(empty);
        return;
      }
      equipmentItems.forEach((item) => {
        const card = document.createElement("div");
        card.className = "equipment-item";
        const rarity = item.rarity ?? "common";
        card.innerHTML = `
          <div class="equipment-item__header">
            <strong>${item.name ?? "이름 없음"}</strong>
            <span class="rarity-chip rarity-chip--${rarity}">${rarity}</span>
          </div>
          <div class="equipment-item__meta">${item.slot ?? "-"}</div>
          <div class="equipment-item__mods">${formatMods(item.mods)}</div>
        `;
        const button = document.createElement("button");
        button.className = "btn btn--small";
        button.textContent = "장착";
        button.addEventListener("click", () => {
          equipItem(item.id);
        });
        card.appendChild(button);
        listTarget.appendChild(card);
      });
    }
  }

  function renderStatusSheet() {
    if (elements.statsGrid) {
      elements.statsGrid.innerHTML = "";
      const effectiveStats = getEffectiveStats();
      const mods = getEquipmentMods();
      STAT_KEYS.forEach((key) => {
        const value = effectiveStats[key] ?? 0;
        const bonus = Number(mods[key] ?? 0);
        const row = document.createElement("div");
        row.className = "stat-card";
        const bonusLabel = bonus ? ` (+${bonus})` : "";
        row.innerHTML = `<span>${key}</span><strong>${value}${bonusLabel}</strong>`;
        elements.statsGrid.appendChild(row);
      });
    }
    if (elements.progressTrust) {
      elements.progressTrust.textContent = String(state.player.counters?.trust ?? 0);
    }
    if (elements.progressInsight) {
      elements.progressInsight.textContent = String(state.player.counters?.insight ?? 0);
    }
    if (elements.statusList) {
      elements.statusList.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "status-pill";
      empty.textContent = "이상 없음";
      elements.statusList.appendChild(empty);
    }
    const items = getInventoryItems();
    renderEquipmentPanel(elements.equipmentSlots, elements.equipmentList);
    renderInventoryGrid(elements.inventoryGrid, items);
  }

  function renderInventorySheet() {
    const items = getInventoryItems();
    const equipmentItems = getEquipmentItems();
    if (elements.inventoryEmpty) {
      elements.inventoryEmpty.hidden = items.length > 0 || equipmentItems.length > 0;
    }
    renderEquipmentPanel(elements.equipmentSheetSlots, elements.equipmentSheetList);
    renderInventoryGrid(elements.inventorySheetGrid, items);
  }

  function renderSkillsSheet() {
    if (elements.skillsList) {
      elements.skillsList.innerHTML = "";
    }
    if (elements.skillsEmpty) {
      elements.skillsEmpty.hidden = false;
    }
  }

  function renderCodexSection(listEl, emptyEl, ids, labelGetter) {
    if (!listEl || !emptyEl) return;
    listEl.innerHTML = "";
    ids.forEach((id) => {
      const item = document.createElement("li");
      item.textContent = labelGetter(id);
      listEl.appendChild(item);
    });
    emptyEl.hidden = ids.length > 0;
  }

  function renderCodexSheet() {
    const nodes = state.codex.nodes ?? [];
    const enemies = state.codex.enemies ?? [];
    const endings = state.codex.endings ?? [];
    renderCodexSection(elements.codexNodes, elements.codexNodeEmpty, nodes, (id) => {
      return state.maps?.nodesMap?.get(id)?.title ?? id;
    });
    renderCodexSection(elements.codexEnemies, elements.codexEnemyEmpty, enemies, (id) => {
      return state.maps?.enemiesMap?.get(id)?.name ?? id;
    });
    renderCodexSection(elements.codexEndings, elements.codexEndingEmpty, endings, (id) => {
      return state.maps?.endingsMap?.get(id)?.id ?? id;
    });
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `${date.toLocaleDateString("ko-KR")} ${date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }

  function renderRankingSheet() {
    if (!elements.rankingList || !elements.rankingEmpty) return;
    elements.rankingList.innerHTML = "";
    if (!state.runs.length) {
      elements.rankingEmpty.hidden = false;
      return;
    }
    elements.rankingEmpty.hidden = true;
    state.runs.forEach((run, index) => {
      const row = document.createElement("div");
      row.className = "sheet__list-item";
      const clearedLabel = run.cleared ? "클리어" : "중도 종료";
      row.innerHTML = `
        <strong>#${index + 1} ${run.name ?? DEFAULT_PLAYER_NAME}</strong>
        <div>엔딩: ${run.endingId ?? "-"}</div>
        <div>${clearedLabel} · 골드 ${run.maxGold ?? 0} · 평판 ${run.reputation ?? 0} · 부상 ${
        run.injury ?? 0
      }</div>
        <div>${formatDate(run.endedAt)}</div>
      `;
      elements.rankingList.appendChild(row);
    });
  }

  function recordRun(endingId, cleared) {
    if (state.runRecorded) return;
    const entry = {
      name: state.player.name ?? DEFAULT_PLAYER_NAME,
      cleared: Boolean(cleared),
      maxGold: state.player.gold ?? 0,
      reputation: state.player.counters?.trust ?? 0,
      injury: Math.max(0, (state.player.maxHp ?? 0) - (state.player.hp ?? 0)),
      endedAt: new Date().toISOString(),
      endingId: endingId ?? "-"
    };
    state.runs.unshift(entry);
    state.runs = state.runs.slice(0, 50);
    state.runRecorded = true;
    saveRuns();
    renderRankingSheet();
  }

  function renderEnding(endingId) {
    const ending = state.maps.endingsMap.get(endingId);
    setView("explore");
    if (elements.sceneTitle) elements.sceneTitle.textContent = "엔딩";
    if (elements.sceneText) {
      elements.sceneText.textContent = ending?.text || "엔딩을 찾을 수 없습니다.";
    }
    clearChoices();
    addCodexEntry("endings", endingId);
    recordRun(endingId, true);
    addChoiceButton("새 여정", () => {
      promptNewJourney();
    });
  }

  function renderNode(nodeId) {
    const node = state.maps.nodesMap.get(nodeId);
    if (!node) {
      if (nodeId !== DEFAULT_NODE_ID && state.maps.nodesMap.has(DEFAULT_NODE_ID)) {
        state.nodeId = DEFAULT_NODE_ID;
        renderNode(DEFAULT_NODE_ID);
        return;
      }
      renderFatal(
        [{ name: "nodes", url: "-", status: "-", message: `NODE '${nodeId}' 없음` }],
        "노드 데이터를 찾을 수 없습니다."
      );
      return;
    }
    if (node.id === "HUB_GUILD") {
      state.phase = "guild";
      renderGuildBoard();
      return;
    }
    state.phase = "node";
    state.nodeId = node.id;
    setView("explore");
    setScene(node.title ?? "", node.situation ?? "");
    clearChoices();
    let renderedChoices = 0;
    let choices = node.choices ?? [];
    if (node.id === "RETURN_SETTLE") {
      choices = [];
      if (state.questCount >= state.questTarget) {
        choices.push({
          text: "오늘의 마감 (엔딩 체크)",
          next: "END_CHECK"
        });
      } else {
        choices.push({
          text: `추가 의뢰 확인 (${state.questCount}/${state.questTarget})`,
          next: "HUB_GUILD"
        });
      }
    }
    if (node.id === "HUB_GUILD" && state.questCount >= state.questTarget) {
      choices = [
        {
          text: "오늘의 마감 (엔딩 체크)",
          next: "END_CHECK"
        }
      ];
    }

    choices.forEach((choice) => {
      if (!meetsRequirements(choice.requirements)) return;
      const label = choice.text ?? choice.label ?? "선택";
      renderedChoices += 1;
      addChoiceButton(label, () => {
        applyImpact(choice.impact);
        if (choice.questComplete) {
          state.questCount += 1;
          addLog(`의뢰 ${state.questCount}/${state.questTarget} 완료`);
        }
        if (choice.startCombat) {
          startCombat(choice.startCombat);
          return;
        }
        if (choice.ending) {
          renderEnding(choice.ending);
          return;
        }
        if (choice.next) {
          renderNode(choice.next);
          saveState();
          return;
        }
        renderNode(state.nodeId);
      });
    });
    if (!renderedChoices) {
      addChoiceButton("길드로 돌아간다", () => {
        state.nodeId = DEFAULT_NODE_ID;
        saveState();
        renderNode(state.nodeId);
      });
    }
    addLog(node.title ?? "탐험 진행");
    addCodexEntry("nodes", node.id);
    updateHud();
    saveState();
  }

  function getPlayerAttackBonus() {
    return Number(getEffectiveStats().STR ?? 0);
  }

  function clearCombatState() {
    state.inCombat = false;
    state.combat = null;
    state.combatContext = null;
    switchBgm("ambient");
  }

  function startCombat(enemyId) {
    const enemy = state.maps.enemiesMap.get(enemyId);
    if (!enemy) {
      clearCombatState();
      addLog("전투 데이터를 복원할 수 없어 탐험으로 복귀합니다.");
      renderCurrent();
      return;
    }
    state.inCombat = true;
    state.combat = {
      enemyId: enemy.id,
      enemyHp: enemy.hp,
      enemyMaxHp: enemy.hp
    };
    switchBgm("battle");
    addCodexEntry("enemies", enemy.id);
    renderCombat();
    saveState();
  }

  function renderCombat() {
    const enemy = state.maps.enemiesMap.get(state.combat?.enemyId);
    if (!enemy) {
      clearCombatState();
      renderCurrent();
      return;
    }
    if (state.combat) {
      const enemyMaxHp = Number(state.combat.enemyMaxHp);
      if (!Number.isFinite(enemyMaxHp) || enemyMaxHp <= 0) {
        state.combat.enemyMaxHp = enemy.hp;
      }
      if (!Number.isFinite(Number(state.combat.enemyHp))) {
        state.combat.enemyHp = enemy.hp;
      }
    }
    setView("combat");
    if (elements.combatEnemyName) elements.combatEnemyName.textContent = enemy.name;
    setCombatBar(
      elements.combatPlayerHp,
      state.player.hp,
      state.player.maxHp,
      "rgba(93, 222, 255, 0.85)"
    );
    setCombatBar(
      elements.combatEnemyHp,
      state.combat.enemyHp,
      state.combat.enemyMaxHp,
      "rgba(255, 104, 143, 0.85)"
    );
    if (elements.combatSituation) {
      elements.combatSituation.textContent = "전투가 시작됐다.";
    }
    if (elements.combatDiceValue) elements.combatDiceValue.textContent = "--";
    if (elements.combatDiceLabel) elements.combatDiceLabel.textContent = "전투 판정";
    if (elements.combatDiceBadge) elements.combatDiceBadge.textContent = "-";
    if (elements.combatRecover) elements.combatRecover.hidden = true;
    if (elements.combatDicePanel) elements.combatDicePanel.hidden = false;
    renderCombatLog();
    updateHud();
    if (elements.combatDock) {
      elements.combatDock.innerHTML = "";
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = "전투 판정";
      btn.addEventListener("click", resolveCombatTurn);
      elements.combatDock.appendChild(btn);
    }
  }

  function resolveCombatTurn() {
    const enemy = state.maps.enemiesMap.get(state.combat?.enemyId);
    if (!enemy) {
      clearCombatState();
      renderCurrent();
      return;
    }
    const roll = Math.floor(Math.random() * 20) + 1;
    const attackBonus = getPlayerAttackBonus();
    const total = roll + attackBonus;
    if (elements.combatDiceValue) elements.combatDiceValue.textContent = String(roll);
    if (elements.combatDiceLabel) {
      elements.combatDiceLabel.textContent = `판정: ${total} (보너스 ${attackBonus})`;
    }
    if (total >= enemy.ac) {
      const damage = Math.max(1, Math.floor(Math.random() * 4) + 1 + attackBonus);
      state.combat.enemyHp = Math.max(0, state.combat.enemyHp - damage);
      addLog(`${enemy.name}에게 ${damage} 피해!`);
    } else {
      addLog("공격이 빗나갔다.");
    }

    if (state.combat.enemyHp <= 0) {
      addLog(`${enemy.name} 처치!`);
      const context = state.combatContext;
      clearCombatState();
      if (context) {
        handleQuestCombatVictory(context);
        return;
      }
      addLog("탐험으로 복귀합니다.");
      renderCurrent();
      return;
    }

    const enemyDamage = enemy.attack + randomBetween(enemy.dmgMin, enemy.dmgMax);
    state.player.hp = Math.max(0, state.player.hp - enemyDamage);
    addLog(`${enemy.name}의 반격! ${enemyDamage} 피해.`);

    if (state.player.hp <= 0) {
      addLog("당신은 쓰러졌다...");
      clearCombatState();
      recordRun("DEFEAT", false);
      setView("explore");
      if (elements.sceneTitle) elements.sceneTitle.textContent = "전투 패배";
      if (elements.sceneText) {
        elements.sceneText.textContent = "전투에서 패배했습니다. 새 여정을 시작하거나 탐험으로 복귀하세요.";
      }
      clearChoices();
      addChoiceButton("새 여정", () => {
        promptNewJourney();
      });
      const returnLabel = state.phase === "travel" ? "여정으로 복귀" : "탐험으로 복귀";
      addChoiceButton(returnLabel, () => {
        state.player.hp = Math.max(1, state.player.hp);
        renderCurrent();
      });
      updateHud();
      saveState();
      return;
    }

    setCombatBar(
      elements.combatPlayerHp,
      state.player.hp,
      state.player.maxHp,
      "rgba(93, 222, 255, 0.85)"
    );
    setCombatBar(
      elements.combatEnemyHp,
      state.combat.enemyHp,
      state.combat.enemyMaxHp,
      "rgba(255, 104, 143, 0.85)"
    );
    updateHud();
    saveState();
  }

  function randomBetween(min, max) {
    const low = Number.isFinite(min) ? min : 1;
    const high = Number.isFinite(max) ? max : low;
    return Math.floor(Math.random() * (high - low + 1)) + low;
  }

  function hashSeed(input) {
    const str = String(input);
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeededRandom(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickRandom(rng, list) {
    if (!list || !list.length) return null;
    const index = Math.floor(rng() * list.length);
    return list[index];
  }

  function rollRarity(rng, bonus = 0) {
    const weights = { ...RARITY_WEIGHTS };
    if (bonus > 0) {
      weights.common = Math.max(0.6, weights.common - bonus);
      weights.rare = weights.rare + bonus * 0.6;
      weights.epic = weights.epic + bonus * 0.4;
    }
    const roll = rng();
    let acc = 0;
    const entries = Object.entries(weights);
    for (const [rarity, weight] of entries) {
      acc += weight;
      if (roll <= acc) return rarity;
    }
    return "common";
  }

  function normalizeTemplateValue(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.name ?? value.title ?? "";
  }

  function estimateQuestDifficulty(rarity, enemyId) {
    if (rarity === "epic") return "매우 어려움";
    if (rarity === "rare") return "어려움";
    if (rarity === "uncommon") return "보통";
    if (enemyId) return "보통";
    return "쉬움";
  }

  function calculatePlayerPower() {
    const stats = getEffectiveStats();
    return STAT_KEYS.reduce((sum, key) => sum + Number(stats[key] ?? 0), 0);
  }

  function getRewardTable(rarity) {
    return state.data?.questTemplates?.reward_tables?.[rarity] ?? {};
  }

  function getEquipmentTable(tableId) {
    return state.data?.questTemplates?.equipment_tables?.[tableId] ?? [];
  }

  function rollReward(rarity, rng) {
    const table = getRewardTable(rarity);
    const reward = { gold: 0, items: [], equipment: [], statUp: null, shopVisit: false };
    const goldRange = table.gold ?? [6, 18];
    reward.gold = randomBetween(goldRange[0], goldRange[1]);
    const items = table.items ?? [];
    const equipment = table.equipment ?? [];
    if (items.length && rng() < 0.6) {
      const itemId = pickRandom(rng, items);
      if (itemId) reward.items.push(itemId);
    }
    if (equipment.length && rng() < 0.25) {
      const equipmentId = pickRandom(rng, equipment);
      if (equipmentId) reward.equipment.push(equipmentId);
    }
    if (rng() < 0.18) {
      reward.statUp = { type: "ANY", amount: 1 };
    }
    if (rng() < 0.15) {
      reward.shopVisit = true;
    }
    if ((rarity === "rare" || rarity === "epic") && !reward.statUp && !reward.equipment.length) {
      reward.statUp = { type: "ANY", amount: 1 };
    }
    return reward;
  }

  function applyReward(reward) {
    if (!reward) return;
    if (Number.isFinite(Number(reward.gold))) {
      state.player.gold = Number(state.player.gold ?? 0) + Number(reward.gold ?? 0);
    }
    (reward.items ?? []).forEach((itemId) => addItemToInventory(itemId));
    (reward.equipment ?? []).forEach((equipmentId) => addEquipmentToInventory(equipmentId));
    if (reward.statUp) {
      const statType = reward.statUp.type ?? "ANY";
      const amount = Number(reward.statUp.amount ?? 1);
      const key =
        statType === "ANY" ? pickRandom(Math.random, STAT_KEYS) ?? "STR" : statType;
      increaseStat(key, amount);
    }
    recalcDerivedStats();
  }

  function formatRewardPreview(reward) {
    if (!reward) return "-";
    const parts = [];
    if (reward.gold) parts.push(`🪙${reward.gold}`);
    if (reward.items?.length) parts.push("🎁아이템");
    if (reward.equipment?.length) parts.push("🧰장비");
    if (reward.equipment_drop_table) parts.push("🧰장비");
    if (reward.statUp || reward.stat_up) parts.push("⬆️스탯");
    if (reward.shopVisit) parts.push("🏪상점");
    return parts.join(" · ");
  }

  function buildQuestOutcome(quest) {
    const location = normalizeTemplateValue(quest.location);
    const objective = normalizeTemplateValue(quest.objective);
    const complication = normalizeTemplateValue(quest.complication);
    const npc = normalizeTemplateValue(quest.npc);
    const lines = [];
    lines.push(`${location}에서 ${objective}를 마쳤다.`);
    if (npc) lines.push(`${npc}의 조언 덕분에 임무가 순조로웠다.`);
    if (complication) lines.push(`${complication} 속에서도 끝까지 버텼다.`);
    lines.push(`보상 정리가 끝났다.`);
    return lines.slice(0, 4);
  }

  function generateSideQuest(seed, index, forced = {}) {
    const templates = state.data?.questTemplates ?? {};
    const rng = createSeededRandom(seed + index);
    const location = pickRandom(rng, templates.locations ?? []);
    const objective = pickRandom(rng, templates.objectives ?? []);
    const enemy = pickRandom(rng, templates.enemies ?? []);
    const npc = pickRandom(rng, templates.npc_archetypes ?? []);
    const complication = pickRandom(rng, templates.complications ?? []);
    const rarity = forced.rarity ?? rollRarity(rng);
    const reward = forced.reward ?? rollReward(rarity, rng);
    const typePool = ["event", "explore", "combat"];
    const type = forced.type ?? pickRandom(rng, typePool);
    const enemyId = type === "combat" ? (enemy?.id ?? enemy) : null;
    return {
      id: `SQ_${seed}_${index}`,
      title: `${normalizeTemplateValue(location)}의 ${normalizeTemplateValue(objective)}`,
      summary: `${normalizeTemplateValue(objective)}을(를) 수행하라.`,
      location,
      objective,
      npc,
      complication,
      rarity,
      type,
      enemyId,
      reward,
      difficulty: estimateQuestDifficulty(rarity, enemyId),
      outcomeText: buildQuestOutcome({ location, objective, npc, complication })
    };
  }

  function buildChainQuest(chain, stageIndex) {
    const stage = chain.stages[stageIndex];
    const reward = stage.rewards ?? {};
    return {
      id: `${chain.chain_id}_${stageIndex + 1}`,
      title: stage.title,
      summary: stage.summary ?? stage.objective ?? "",
      type: stage.type ?? "event",
      enemyId: stage.enemy_id ?? null,
      rarity: stage.rarity ?? "uncommon",
      reward,
      difficulty: stage.difficulty ?? "보통",
      chainId: chain.chain_id,
      chainStageIndex: stageIndex,
      outcomeText: stage.outcome ?? buildQuestOutcome(stage)
    };
  }

  function generateGuildBoard(seed, dayIndex, refreshIndex) {
    const rng = createSeededRandom(hashSeed(`${seed}-${dayIndex}-${refreshIndex}`));
    const mainQuests = Array.isArray(state.data?.mainQuests) ? state.data.mainQuests : [];
    const mainCount = randomBetween(MAIN_QUESTS_MIN, MAIN_QUESTS_MAX);
    const shuffledMain = [...mainQuests].sort(() => rng() - 0.5);
    const pickedMain = shuffledMain.slice(0, mainCount);
    const sideCount = randomBetween(SIDE_QUESTS_MIN, SIDE_QUESTS_MAX);
    const sideQuests = [];
    for (let i = 0; i < sideCount; i += 1) {
      sideQuests.push(generateSideQuest(seed + dayIndex * 1000, i));
    }
    const chains = state.data?.questTemplates?.chains ?? [];
    const chainProgress = state.chainProgress ?? {};
    chains.forEach((chain) => {
      const stageIndex = Number(chainProgress[chain.chain_id] ?? 0);
      if (stageIndex > 0 && stageIndex < chain.stages.length) {
        sideQuests.unshift(buildChainQuest(chain, stageIndex));
        return;
      }
      if (stageIndex === 0 && rng() < 0.25) {
        sideQuests.unshift(buildChainQuest(chain, stageIndex));
      }
    });
    ensureGuaranteedRewards(sideQuests, seed + dayIndex * 12);
    return {
      dayIndex,
      refreshIndex,
      refreshUsed: 0,
      mainQuests: pickedMain,
      sideQuests
    };
  }

  function ensureGuaranteedRewards(sideQuests, seed) {
    const rng = createSeededRandom(seed);
    const hasItem = sideQuests.some((quest) => quest.reward?.items?.length);
    const hasStat = sideQuests.some((quest) => quest.reward?.statUp);
    const hasCombat = sideQuests.some((quest) => quest.type === "combat");
    if (!hasItem && sideQuests.length) {
      sideQuests[0].reward.items = [pickRandom(rng, getRewardTable("common").items ?? [])].filter(
        Boolean
      );
    }
    if (!hasStat && sideQuests.length) {
      sideQuests[sideQuests.length - 1].reward.statUp = { type: "ANY", amount: 1 };
    }
    if (!hasCombat && sideQuests.length) {
      const fallbackEnemy = pickRandom(rng, state.data?.questTemplates?.enemies ?? []);
      sideQuests[0].type = "combat";
      sideQuests[0].enemyId = fallbackEnemy?.id ?? fallbackEnemy ?? null;
      sideQuests[0].difficulty = estimateQuestDifficulty(sideQuests[0].rarity, sideQuests[0].enemyId);
    }
  }

  function ensureGuildBoard() {
    ensureRunSeed();
    if (!state.guildBoard || state.guildBoard.dayIndex !== state.dayIndex) {
      state.guildBoard = generateGuildBoard(state.runSeed, state.dayIndex, 0);
    }
    return state.guildBoard;
  }

  function refreshGuildBoard() {
    const board = ensureGuildBoard();
    if (board.refreshUsed < 1) {
      board.refreshUsed += 1;
    } else {
      if (state.player.gold < QUEST_REFRESH_COST) {
        addLog("새로고침에 필요한 골드가 부족합니다.");
        setToast("골드 부족");
        return;
      }
      state.player.gold -= QUEST_REFRESH_COST;
    }
    board.refreshIndex += 1;
    const refreshed = generateGuildBoard(state.runSeed, state.dayIndex, board.refreshIndex);
    refreshed.refreshUsed = board.refreshUsed;
    state.guildBoard = refreshed;
    saveState();
    renderGuildBoard();
  }

  function renderGuildBoard() {
    const board = ensureGuildBoard();
    state.phase = "guild";
    state.nodeId = "HUB_GUILD";
    setView("explore");
    setScene("길드 게시판", `오늘(${state.dayIndex}일차) 의뢰를 확인하세요.`);
    clearChoices();
    if (!elements.guildBoard) return;
    elements.guildBoard.hidden = false;
    elements.guildBoard.innerHTML = "";
    const header = document.createElement("div");
    header.className = "guild-board__header";
    header.innerHTML = `
      <div>
        <strong>오늘의 게시판</strong>
        <p>플레이어 파워: ${calculatePlayerPower()}</p>
      </div>
      <div class="guild-board__actions">
        <button class="btn btn--ghost btn--small" type="button">새로고침</button>
      </div>
    `;
    header.querySelector("button").addEventListener("click", refreshGuildBoard);
    elements.guildBoard.appendChild(header);

    const mainSection = document.createElement("section");
    mainSection.className = "guild-section";
    mainSection.innerHTML = `<h3 class="guild-section__title">오늘의 메인 퀘스트</h3>`;
    const mainGrid = document.createElement("div");
    mainGrid.className = "quest-grid";
    (board.mainQuests ?? []).forEach((quest) => {
      const card = document.createElement("article");
      card.className = "quest-card quest-card--main";
      card.innerHTML = `
        <div class="quest-card__header">
          <strong>${quest.title}</strong>
          <span class="quest-card__tag">보스</span>
        </div>
        <p class="quest-card__summary">${quest.intro ?? ""}</p>
        <div class="quest-card__meta">추천 파워 ${quest.recommended_power}</div>
        <div class="quest-card__reward">${formatRewardPreview(quest.rewards)}</div>
      `;
      const actions = document.createElement("div");
      actions.className = "quest-card__actions";
      const acceptButton = document.createElement("button");
      acceptButton.className = "btn btn--small";
      acceptButton.textContent =
        state.acceptedMainQuestId === quest.id ? "준비 중" : "수락/도전";
      acceptButton.addEventListener("click", () => {
        openMainQuestModal(quest);
      });
      actions.appendChild(acceptButton);
      card.appendChild(actions);
      mainGrid.appendChild(card);
    });
    mainSection.appendChild(mainGrid);
    elements.guildBoard.appendChild(mainSection);

    const statusSection = document.createElement("section");
    statusSection.className = "guild-section";
    const statusTitle = document.createElement("h3");
    statusTitle.className = "guild-section__title";
    statusTitle.textContent = "메인 퀘스트 준비";
    statusSection.appendChild(statusTitle);
    const statusText = document.createElement("p");
    if (state.mainQuestState === "prep") {
      statusText.textContent = `준비 단계: 남은 서브퀘 ${state.mainQuestPrepRemaining}개`;
    } else if (state.mainQuestState === "boss") {
      statusText.textContent = "보스전이 진행 중이다.";
    } else if (state.mainQuestState === "cleared") {
      statusText.textContent = "메인 퀘스트를 해결했다. 다음 날 게시판을 열 수 있다.";
    } else {
      statusText.textContent = "메인 퀘스트를 수락하면 준비 단계가 시작된다.";
    }
    statusSection.appendChild(statusText);
    if (state.mainQuestState === "prep" && state.acceptedMainQuestId) {
      const bossButton = document.createElement("button");
      bossButton.className = "btn btn--ghost btn--small";
      bossButton.textContent = "보스전 진입";
      bossButton.disabled = state.mainQuestPrepRemaining > 0;
      bossButton.addEventListener("click", () => {
        const quest = board.mainQuests.find((entry) => entry.id === state.acceptedMainQuestId);
        if (quest) openMainQuestModal(quest, true);
      });
      statusSection.appendChild(bossButton);
    }
    if (state.mainQuestState === "cleared") {
      const nextDayButton = document.createElement("button");
      nextDayButton.className = "btn btn--ghost btn--small";
      nextDayButton.textContent = "다음 날 게시판 열기";
      nextDayButton.addEventListener("click", () => {
        state.dayIndex += 1;
        state.mainQuestState = "idle";
        state.acceptedMainQuestId = null;
        state.mainQuestPrepRemaining = 0;
        state.guildBoard = null;
        saveState();
        renderGuildBoard();
      });
      statusSection.appendChild(nextDayButton);
    }
    elements.guildBoard.appendChild(statusSection);

    const sideSection = document.createElement("section");
    sideSection.className = "guild-section";
    sideSection.innerHTML = `<h3 class="guild-section__title">서브 퀘스트</h3>`;
    const sideGrid = document.createElement("div");
    sideGrid.className = "quest-grid";
    (board.sideQuests ?? []).forEach((quest) => {
      const card = document.createElement("article");
      card.className = "quest-card";
      card.innerHTML = `
        <div class="quest-card__header">
          <strong>${quest.title}</strong>
          <span class="quest-card__tag">${quest.rarity}</span>
        </div>
        <p class="quest-card__summary">${quest.summary}</p>
        <div class="quest-card__meta">난이도 ${quest.difficulty}</div>
        <div class="quest-card__reward">${formatRewardPreview(quest.reward)}</div>
      `;
      const actions = document.createElement("div");
      actions.className = "quest-card__actions";
      const startButton = document.createElement("button");
      startButton.className = "btn btn--small";
      startButton.textContent = "수행";
      startButton.disabled = state.mainQuestState === "prep" && state.mainQuestPrepRemaining <= 0;
      startButton.addEventListener("click", () => {
        startSideQuest(quest.id);
      });
      actions.appendChild(startButton);
      card.appendChild(actions);
      sideGrid.appendChild(card);
    });
    sideSection.appendChild(sideGrid);
    elements.guildBoard.appendChild(sideSection);

    const shopSection = document.createElement("section");
    shopSection.className = "guild-section";
    shopSection.innerHTML = `<h3 class="guild-section__title">길드 상점</h3>`;
    const shopButton = document.createElement("button");
    shopButton.className = "btn btn--ghost btn--small";
    shopButton.textContent = "상점 방문";
    shopButton.addEventListener("click", () => {
      openShop("guild_shop");
    });
    shopSection.appendChild(shopButton);
    elements.guildBoard.appendChild(shopSection);

    const endingButton = document.createElement("button");
    endingButton.className = "btn btn--ghost btn--small";
    endingButton.textContent = "오늘 마감 (엔딩 체크)";
    endingButton.addEventListener("click", () => renderNode("END_CHECK"));
    elements.guildBoard.appendChild(endingButton);
  }

  function openMainQuestModal(quest, forceChallenge = false) {
    if (!elements.mainQuestModal || !elements.modalBackdrop) return;
    elements.mainQuestTitle.textContent = quest.title;
    elements.mainQuestDesc.textContent =
      `${quest.intro ?? ""}\n추천 파워 ${quest.recommended_power}\n보상: ${formatRewardPreview(
        quest.rewards
      )}\n정말 도전할까요? 지금 도전하면 되돌아오기 어렵습니다.`;
    elements.mainQuestModal.hidden = false;
    elements.modalBackdrop.hidden = false;
    elements.mainQuestPrepare.onclick = () => {
      acceptMainQuest(quest);
      closeMainQuestModal();
    };
    elements.mainQuestChallenge.onclick = () => {
      startMainQuestCombat(quest);
      closeMainQuestModal();
    };
    if (forceChallenge) {
      elements.mainQuestPrepare.disabled = true;
    } else {
      elements.mainQuestPrepare.disabled = false;
    }
    elements.mainQuestCancel.onclick = () => closeMainQuestModal();
  }

  function closeMainQuestModal() {
    if (elements.mainQuestModal) elements.mainQuestModal.hidden = true;
    if (elements.modalBackdrop) elements.modalBackdrop.hidden = true;
  }

  function acceptMainQuest(quest) {
    state.acceptedMainQuestId = quest.id;
    state.mainQuestState = "prep";
    state.mainQuestPrepRemaining = randomBetween(MAIN_QUEST_PREP_MIN, MAIN_QUEST_PREP_MAX);
    saveState();
    renderGuildBoard();
  }

  function startMainQuestCombat(quest) {
    state.acceptedMainQuestId = quest.id;
    state.mainQuestState = "boss";
    state.combatContext = { type: "main", questId: quest.id };
    startCombat(quest.boss_enemy_id);
  }

  function startSideQuest(questId) {
    const board = ensureGuildBoard();
    const quest = board.sideQuests.find((entry) => entry.id === questId);
    if (!quest) return;
    state.activeQuest = quest;
    state.phase = "quest";
    setView("explore");
    setScene(quest.title, quest.summary);
    clearChoices();
    addChoiceButton("수행", () => resolveSideQuest(quest));
    addChoiceButton("취소", () => {
      state.activeQuest = null;
      renderGuildBoard();
    });
  }

  function resolveSideQuest(quest) {
    if (quest.type === "combat" && quest.enemyId) {
      state.combatContext = { type: "side", questId: quest.id };
      startCombat(quest.enemyId);
      return;
    }
    completeSideQuest(quest);
  }

  function completeSideQuest(quest) {
    applyReward(quest.reward);
    if (quest.chainId) {
      const nextIndex = Number(quest.chainStageIndex ?? 0) + 1;
      state.chainProgress[quest.chainId] = nextIndex;
      const chain = (state.data?.questTemplates?.chains ?? []).find(
        (entry) => entry.chain_id === quest.chainId
      );
      if (chain && nextIndex >= chain.stages.length) {
        grantChainCompletionReward(chain);
      }
    }
    if (state.mainQuestState === "prep") {
      state.mainQuestPrepRemaining = Math.max(0, state.mainQuestPrepRemaining - 1);
    }
    const board = ensureGuildBoard();
    board.sideQuests = (board.sideQuests ?? []).filter((entry) => entry.id !== quest.id);
    state.activeQuest = null;
    showQuestOutcome(quest);
  }

  function showQuestOutcome(quest) {
    const lines = quest.outcomeText ?? buildQuestOutcome(quest);
    setView("explore");
    setScene(quest.title, lines.join("\n"));
    clearChoices();
    if (quest.reward?.shopVisit) {
      addChoiceButton("상점 방문", () => openShop("guild_shop"));
    }
    addChoiceButton("길드로 돌아간다", () => {
      renderGuildBoard();
    });
    saveState();
    updateHud();
  }

  function handleQuestCombatVictory(context) {
    state.combatContext = null;
    if (context.type === "side") {
      const board = ensureGuildBoard();
      const quest = board.sideQuests.find((entry) => entry.id === context.questId);
      if (quest) {
        completeSideQuest(quest);
        return;
      }
    }
    if (context.type === "main") {
      const board = ensureGuildBoard();
      const quest = board.mainQuests.find((entry) => entry.id === context.questId);
      if (quest) {
        resolveMainQuestRewards(quest);
        return;
      }
    }
    renderGuildBoard();
  }

  function resolveMainQuestRewards(quest) {
    const reward = quest.rewards ?? {};
    const rewardPayload = {
      gold: reward.gold ?? 0,
      items: [],
      equipment: [],
      statUp: reward.stat_up ?? null,
      shopVisit: false
    };
    if (reward.equipment_drop_table) {
      const table = getEquipmentTable(reward.equipment_drop_table);
      const pick = pickRandom(Math.random, table);
      if (pick) rewardPayload.equipment.push(pick);
    }
    applyReward(rewardPayload);
    state.mainQuestState = "cleared";
    state.acceptedMainQuestId = null;
    showQuestOutcome({
      title: quest.title,
      outcomeText: ["보스전이 끝났다.", "길드가 성과를 인정하며 보상을 전달했다."],
      reward: rewardPayload
    });
  }

  function grantChainCompletionReward(chain) {
    const rewardTable = getRewardTable("rare");
    const rewardPayload = {
      gold: randomBetween(20, 40),
      items: [],
      equipment: [],
      statUp: { type: "ANY", amount: 1 },
      shopVisit: false
    };
    if (rewardTable.equipment?.length) {
      const equipmentId = pickRandom(Math.random, rewardTable.equipment);
      if (equipmentId) rewardPayload.equipment.push(equipmentId);
    }
    applyReward(rewardPayload);
    addLog(`${chain.name ?? "연계 퀘스트"} 완료 보상을 획득했다.`);
  }

  function openShop(shopId) {
    const shop = (state.data?.shops ?? []).find((entry) => entry.id === shopId);
    if (!shop) return;
    state.activeShopId = shopId;
    state.phase = "shop";
    renderShop(shop);
  }

  function renderShop(shop) {
    setView("explore");
    setScene(shop.name ?? "상점", shop.description ?? "구매할 물품을 고르세요.");
    clearChoices();
    if (!elements.guildBoard) return;
    elements.guildBoard.hidden = false;
    elements.guildBoard.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "shop-grid";
    const items = shop.inventory ?? [];
    const itemsMap = new Map((state.data?.items ?? []).map((item) => [item.id, item]));
    const equipmentMap = state.maps?.equipmentMap ?? new Map();
    items.forEach((entry) => {
      const card = document.createElement("div");
      card.className = "shop-card";
      const data = entry.type === "equipment" ? equipmentMap.get(entry.id) : itemsMap.get(entry.id);
      const name = data?.name ?? entry.id;
      card.innerHTML = `
        <strong>${name}</strong>
        <span class="shop-card__price">🪙${entry.price}</span>
        <p>${data?.description ?? ""}</p>
      `;
      const button = document.createElement("button");
      button.className = "btn btn--small";
      button.textContent = "구매";
      button.addEventListener("click", () => {
        if (state.player.gold < entry.price) {
          setToast("골드 부족");
          return;
        }
        state.player.gold -= entry.price;
        if (entry.type === "equipment") {
          addEquipmentToInventory(entry.id);
        } else {
          addItemToInventory(entry.id);
        }
        updateHud();
        renderInventorySheet();
        saveState();
      });
      card.appendChild(button);
      grid.appendChild(card);
    });
    elements.guildBoard.appendChild(grid);
    addChoiceButton("길드로 돌아간다", () => {
      state.phase = "guild";
      renderGuildBoard();
    });
  }

  function restoreState() {
    const saved = loadState();
    if (!saved) {
      newGameState();
      uiState.pendingNamePrompt = true;
      return false;
    }
    state.player = normalizePlayer(saved.player);
    state.nodeId = saved.nodeId ?? DEFAULT_NODE_ID;
    if (state.maps?.nodesMap && !state.maps.nodesMap.has(state.nodeId)) {
      state.nodeId = DEFAULT_NODE_ID;
    }
    const phase = saved.phase;
    state.phase = ["background", "prologue", "travel", "node"].includes(phase) ? phase : "node";
    state.prologueId = saved.prologueId ?? null;
    state.travelEventId = saved.travelEventId ?? null;
    state.travelCount = Number(saved.travelCount ?? 0);
    state.travelTarget = Number(saved.travelTarget ?? randomBetween(TRAVEL_STEPS_MIN, TRAVEL_STEPS_MAX));
    state.travelHistory = Array.isArray(saved.travelHistory) ? saved.travelHistory : [];
    state.travelRecent = Array.isArray(saved.travelRecent) ? saved.travelRecent : [];
    state.travelFlags =
      saved.travelFlags && typeof saved.travelFlags === "object"
        ? {
            hasForcedCombat: Boolean(saved.travelFlags.hasForcedCombat),
            hasForcedItem: Boolean(saved.travelFlags.hasForcedItem),
            hasForcedStatUp: Boolean(saved.travelFlags.hasForcedStatUp),
            travelStepIndex: Number(saved.travelFlags.travelStepIndex ?? state.travelCount),
            targetTravelSteps: Number(saved.travelFlags.targetTravelSteps ?? state.travelTarget)
          }
        : createTravelFlags(state.travelTarget, state.travelCount);
    state.questCount = Number(saved.questCount ?? 0);
    state.questTarget = Number(saved.questTarget ?? randomBetween(QUEST_STEPS_MIN, QUEST_STEPS_MAX));
    state.runSeed = Number.isFinite(Number(saved.runSeed)) ? Number(saved.runSeed) : null;
    state.dayIndex = Number(saved.dayIndex ?? 1);
    state.guildBoard = saved.guildBoard ?? null;
    state.acceptedMainQuestId = saved.acceptedMainQuestId ?? null;
    state.mainQuestState = saved.mainQuestState ?? "idle";
    state.mainQuestPrepRemaining = Number(saved.mainQuestPrepRemaining ?? 0);
    state.chainProgress = saved.chainProgress ?? {};
    state.activeQuest = saved.activeQuest ?? null;
    state.combatContext = saved.combatContext ?? null;
    state.activeShopId = saved.activeShopId ?? null;
    state.log = Array.isArray(saved.log) ? saved.log : [];
    state.lastSummary = saved.lastSummary ?? "최근 요약: -";
    state.inCombat = Boolean(saved.inCombat);
    state.combat = saved.combat ?? null;
    state.runRecorded = false;
    if (!state.player.background) {
      state.player.background = createBackgroundForPlayer();
    }
    if (state.inCombat) {
      switchBgm("battle");
    } else {
      switchBgm("ambient");
    }
    return true;
  }

  function ensureCombatRestored() {
    if (!state.inCombat) return;
    const enemyId = state.combat?.enemyId;
    if (!enemyId || !state.maps.enemiesMap.has(enemyId)) {
      addLog("전투 데이터를 복원할 수 없어 탐험으로 복귀합니다.");
      clearCombatState();
      state.nodeId = DEFAULT_NODE_ID;
      saveState();
    }
  }

  function openSheet(target) {
    if (!target) return;
    target.hidden = false;
    if (elements.sheetBackdrop) elements.sheetBackdrop.hidden = false;
  }

  function closeSheets() {
    document.querySelectorAll(".sheet").forEach((sheet) => {
      sheet.hidden = true;
    });
    if (elements.sheetBackdrop) elements.sheetBackdrop.hidden = true;
  }

  function openComingSoon() {
    if (!elements.comingSoonModal || !elements.modalBackdrop) return;
    elements.comingSoonModal.hidden = false;
    elements.modalBackdrop.hidden = false;
  }

  function closeComingSoon() {
    if (elements.comingSoonModal) elements.comingSoonModal.hidden = true;
    if (elements.modalBackdrop) elements.modalBackdrop.hidden = true;
  }

  function setActiveTab(tabName) {
    const tabs = elements.statusSheet?.querySelectorAll(".sheet__tab") ?? [];
    const panels = elements.statusSheet?.querySelectorAll(".sheet__panel") ?? [];
    tabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.tab === tabName);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === tabName);
    });
  }

  function openStatusSheet(tabName = "stats") {
    if (!elements.statusSheet) return;
    setActiveTab(tabName);
    openSheet(elements.statusSheet);
  }

  function showTooltip(target) {
    if (!elements.tooltip || !elements.tooltipContent || !target) return;
    const text = target.dataset.tooltip;
    if (!text) return;
    elements.tooltipContent.textContent = text;
    elements.tooltip.hidden = false;
    requestAnimationFrame(() => {
      if (!elements.tooltip) return;
      const rect = target.getBoundingClientRect();
      const tooltipRect = elements.tooltip.getBoundingClientRect();
      const top = Math.max(8, rect.top - tooltipRect.height - 8);
      const left = Math.min(window.innerWidth - tooltipRect.width - 8, rect.left);
      elements.tooltip.style.top = `${top}px`;
      elements.tooltip.style.left = `${left}px`;
    });
  }

  function hideTooltip() {
    if (!elements.tooltip) return;
    elements.tooltip.hidden = true;
  }

  function wireEvents() {
    if (elements.saveButton) {
      elements.saveButton.addEventListener("click", () => saveState());
    }
    if (elements.resetButton) {
      elements.resetButton.addEventListener("click", () => {
        promptNewJourney();
      });
    }
    if (elements.emergencyResetButton) {
      elements.emergencyResetButton.addEventListener("click", () => {
        clearTextRpgStorage();
        window.location.reload();
      });
    }
    if (elements.retryLoadButton) {
      elements.retryLoadButton.addEventListener("click", () => window.location.reload());
    }
    if (elements.hardResetButton) {
      elements.hardResetButton.addEventListener("click", () => {
        clearTextRpgStorage();
        window.location.reload();
      });
    }
    if (elements.logToggle) {
      elements.logToggle.addEventListener("click", () => {
        const expanded = elements.logPanel?.classList.contains("is-expanded");
        setLogExpanded(!expanded);
      });
    }
    if (elements.hudProfile) {
      elements.hudProfile.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        openStatusSheet("stats");
      });
    }
    if (elements.hudStats) {
      elements.hudStats.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        openStatusSheet("stats");
      });
    }
    document.querySelectorAll(".stat-chip").forEach((chip) => {
      let pressTimer = null;
      const tooltipText = chip.dataset.tooltip || chip.getAttribute("aria-label");
      chip.addEventListener("pointerdown", () => {
        pressTimer = window.setTimeout(() => {
          if (tooltipText) setToast(tooltipText);
        }, 450);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
        chip.addEventListener(eventName, () => {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        });
      });
    });
    document.querySelectorAll(".dock-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const sheetId = button.dataset.sheet;
        const openType = button.dataset.open;
        if (openType === "status") {
          openStatusSheet(button.dataset.tab || "stats");
        } else if (openType === "coming") {
          openComingSoon();
        } else if (sheetId) {
          openSheet(document.getElementById(sheetId));
        }
        const toastMessage = button.dataset.toast || button.dataset.tooltip;
        if (toastMessage) setToast(toastMessage);
        renderInventorySheet();
        renderSkillsSheet();
        renderCodexSheet();
        renderRankingSheet();
      });
    });
    if (elements.statusClose) {
      elements.statusClose.addEventListener("click", () => closeSheets());
    }
    document.querySelectorAll("[data-close-sheet]").forEach((button) => {
      button.addEventListener("click", () => closeSheets());
    });
    if (elements.sheetBackdrop) {
      elements.sheetBackdrop.addEventListener("click", () => closeSheets());
    }
    if (elements.modalBackdrop) {
      elements.modalBackdrop.addEventListener("click", () => {
        closeComingSoon();
        closeMainQuestModal();
      });
    }
    if (elements.comingSoonClose) {
      elements.comingSoonClose.addEventListener("click", () => closeComingSoon());
    }
    document.querySelectorAll(".sheet__tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        setActiveTab(tab.dataset.tab);
      });
    });
    if (elements.combatRecoverButton) {
      elements.combatRecoverButton.addEventListener("click", () => {
        clearCombatState();
        saveState();
        renderCurrent();
      });
    }
    if (elements.combatDicePanel) {
      elements.combatDicePanel.addEventListener("click", () => {
        if (state.inCombat) {
          resolveCombatTurn();
        }
      });
    }
    document.querySelectorAll("[data-tooltip]").forEach((target) => {
      target.addEventListener("mouseenter", () => showTooltip(target));
      target.addEventListener("mouseleave", hideTooltip);
      target.addEventListener("focus", () => showTooltip(target));
      target.addEventListener("blur", hideTooltip);
    });
    if (elements.audioButton) {
      elements.audioButton.addEventListener("click", async () => {
        if (audioState.muted) {
          setAudioMuted(false);
          if (audioState.started) {
            switchBgm(state.inCombat ? "battle" : "ambient", true);
            return;
          }
        } else if (audioState.started) {
          setAudioMuted(true);
          return;
        }
        await activateAudioFromGesture();
      });
      updateAudioButton();
    }
    if (elements.nameConfirm) {
      elements.nameConfirm.addEventListener("click", () => {
        const name = elements.nameInput?.value ?? "";
        closeNameModal();
        uiState.pendingName = normalizePlayerName(name);
        openBuildModal();
      });
    }
    if (elements.nameCancel) {
      elements.nameCancel.addEventListener("click", () => {
        closeNameModal();
        uiState.pendingName = DEFAULT_PLAYER_NAME;
        openBuildModal();
      });
    }
    if (elements.nameInput) {
      elements.nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const name = elements.nameInput?.value ?? "";
          closeNameModal();
          uiState.pendingName = normalizePlayerName(name);
          openBuildModal();
        }
      });
    }
    document.querySelectorAll("[data-build-select]").forEach((button) => {
      button.addEventListener("click", () => {
        const buildType = button.dataset.buildSelect ?? "BALANCE";
        const finalName = uiState.pendingName ?? DEFAULT_PLAYER_NAME;
        const stats =
          buildType === "RANDOM" ? uiState.pendingRandomStats : buildStatsFromPreset(getBuildPreset(buildType));
        closeBuildModal();
        applyNewJourney(finalName, buildType, stats);
        uiState.pendingName = null;
        uiState.pendingRandomStats = null;
      });
    });
    if (elements.buildBack) {
      elements.buildBack.addEventListener("click", () => {
        closeBuildModal();
        openNameModal();
      });
    }
    window.addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("resize", hideTooltip);
  }

  function loadJson(name) {
    const url = new URL(`data/${name}.json`, BASE_URL);
    url.searchParams.set("v", String(Date.now()));
    return fetch(url.toString(), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return { name, url: url.toString(), data };
      })
      .catch((error) => {
        throw {
          name,
          url: url.toString(),
          status: error?.message?.startsWith("HTTP") ? error.message : "-",
          message: error?.message ?? String(error)
        };
      });
  }

  function boot() {
    handleResetParam();
    migrateLegacyStorage();
    loadAudioPreference();
    state.runs = loadRuns();
    state.codex = loadCodex();
    renderLoading();
    wireEvents();
    setupIntroOverlay();

    Promise.allSettled([
      loadJson("nodes"),
      loadJson("events"),
      loadJson("items"),
      loadJson("equipment"),
      loadJson("quest_templates"),
      loadJson("main_quests"),
      loadJson("shops"),
      loadJson("enemies"),
      loadJson("endings"),
      loadJson("prologues"),
      loadJson("travel_events"),
      loadJson("background_parts")
    ])
      .then((results) => {
        const failures = [];
        const data = {};
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            data[result.value.name] = result.value.data;
          } else {
            failures.push(result.reason);
          }
        });

        if (failures.length) {
          renderFatal(failures, "데이터 로드 실패");
          return;
        }

        state.data = {
          nodes: normalizeNodes(data.nodes),
          enemies: normalizeEnemies(data.enemies),
          endings: normalizeEndings(data.endings),
          events: data.events ?? [],
          items: data.items ?? [],
          equipment: data.equipment ?? [],
          questTemplates: data.quest_templates ?? {},
          mainQuests: data.main_quests ?? [],
          shops: data.shops ?? [],
          prologues: normalizePrologues(data.prologues),
          travelEvents: normalizeTravelEvents(data.travel_events),
          backgroundParts: normalizeBackgroundParts(data.background_parts)
        };
        state.maps = createMaps(state.data);

        restoreState();
        ensureCombatRestored();
        updateHud();
        renderLog();
        renderInventorySheet();
        renderSkillsSheet();
        renderCodexSheet();
        renderRankingSheet();

        renderCurrent();
        if (
          uiState.pendingNamePrompt &&
          (!elements.introOverlay || !document.body.contains(elements.introOverlay))
        ) {
          openNameModal();
        }
      })
      .catch((error) => {
        recordBootError(error);
        renderFatal(
          [{ name: "boot", url: window.location.href, status: "-", message: String(error) }],
          String(error)
        );
      });
  }

  boot();
})();

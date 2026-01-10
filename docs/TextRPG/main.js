(() => {
  const VERSION = "v0.3.6";
  const STORAGE_PREFIX = "textrpg-lucas";
  const LEGACY_PREFIX = "textrpg-omega";
  const SAVE_KEY = `${STORAGE_PREFIX}-save`;
  const RUNS_KEY = `${STORAGE_PREFIX}-runs`;
  const CODEX_KEY = `${STORAGE_PREFIX}-codex`;
  const AUDIO_MUTE_KEY = `${STORAGE_PREFIX}-audio-muted`;
  const DEFAULT_NODE_ID = "GUILD_ARRIVAL";
  const DEFAULT_PLAYER_NAME = "당신";
  const TRAVEL_STEPS_MIN = 3;
  const TRAVEL_STEPS_MAX = 6;
  const QUEST_STEPS_MIN = 1;
  const QUEST_STEPS_MAX = 3;
  const INTRO_START_SELECTOR = "[data-intro-start]";
  const MAIN_SCRIPT = document.getElementById("appMain");
  const scriptSrc = MAIN_SCRIPT?.src || window.location.href;
  const BASE_URL = new URL("./", scriptSrc);
  const STAT_KEYS = ["STR", "WIS", "INT", "DEX", "LUK"];
  const INTRO_STORAGE_KEY = `${STORAGE_PREFIX}-intro-seen`;
  const INTRO_SKIP_ENABLED = false;

  const ITEM_ICONS = {
    consumable: "🧪",
    tool: "🧰",
    artifact: "🔮",
    weapon: "⚔️",
    armor: "🛡️"
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
    context: null,
    master: null,
    padOscillators: [],
    noiseSource: null,
    chordTimer: null,
    baseGain: 0.085,
    muted: false,
    started: false
  };

  const elements = {
    introOverlay: document.getElementById("introOverlay"),
    introNotice: document.getElementById("intro-audio-notice"),
    introAudioButton: document.getElementById("btn-intro-audio"),
    nameModal: document.getElementById("nameModal"),
    nameInput: document.getElementById("nameInput"),
    nameConfirm: document.getElementById("btn-name-confirm"),
    nameCancel: document.getElementById("btn-name-cancel"),
    mainCenter: document.getElementById("main-center"),
    exploreCard: document.getElementById("explore-card"),
    sceneTitle: document.getElementById("scene-title"),
    sceneText: document.getElementById("scene-text"),
    diceValue: document.getElementById("dice-value"),
    diceLabel: document.getElementById("dice-label"),
    resumeCombat: document.getElementById("resume-combat"),
    choiceList: document.getElementById("choice-list"),
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
    modalBackdrop: document.getElementById("modal-backdrop")
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
    questCount: 0,
    questTarget: 0,
    inCombat: false,
    combat: null,
    log: [],
    lastSummary: "최근 요약: -",
    runs: [],
    codex: { nodes: [], enemies: [], endings: [] },
    runRecorded: false
  };

  const uiState = {
    pendingNamePrompt: false
  };

  function updateAudioButton() {
    const isActive = audioState.started && !audioState.muted;
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
    if (audioState.master && audioState.context) {
      const target = muted ? 0 : audioState.baseGain;
      audioState.master.gain.setTargetAtTime(target, audioState.context.currentTime, 0.6);
    }
    updateAudioButton();
  }

  function createNoiseBuffer(context) {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    return buffer;
  }

  function ensureAudioContext() {
    if (audioState.context) return audioState.context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    const context = new AudioContextClass();
    audioState.context = context;
    return context;
  }

  function startAmbientBGM(context) {
    if (!context) return;
    if (audioState.started) {
      if (context.state === "suspended") {
        context.resume();
      }
      updateAudioButton();
      return;
    }

    const master = context.createGain();
    master.gain.value = audioState.baseGain;
    master.connect(context.destination);

    const padFilter = context.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 520;
    padFilter.Q.value = 0.7;

    const padGain = context.createGain();
    padGain.gain.value = 0.85;
    padGain.connect(padFilter);
    padFilter.connect(master);

    const chords = [
      [110, 165, 220],
      [98, 147, 196],
      [123.47, 185, 246.94],
      [130.81, 196, 261.63]
    ];
    const oscTypes = ["sine", "triangle", "sine"];
    const detunes = [-7, 4, 8];

    chords[0].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = oscTypes[index % oscTypes.length];
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detunes[index % detunes.length];
      oscillator.connect(padGain);
      oscillator.start();
      audioState.padOscillators.push(oscillator);
    });

    const noise = context.createBufferSource();
    noise.buffer = createNoiseBuffer(context);
    noise.loop = true;
    const noiseBand = context.createBiquadFilter();
    noiseBand.type = "bandpass";
    noiseBand.frequency.value = 580;
    noiseBand.Q.value = 0.65;
    const noiseLow = context.createBiquadFilter();
    noiseLow.type = "lowpass";
    noiseLow.frequency.value = 1400;
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0.02;
    noise.connect(noiseBand);
    noiseBand.connect(noiseLow);
    noiseLow.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();

    let chordIndex = 0;
    const applyChord = (index) => {
      const chord = chords[index];
      audioState.padOscillators.forEach((oscillator, oscIndex) => {
        const base = chord[oscIndex % chord.length];
        oscillator.frequency.setTargetAtTime(base, context.currentTime, 3.4);
      });
    };
    applyChord(chordIndex);
    audioState.chordTimer = window.setInterval(() => {
      chordIndex = (chordIndex + 1) % chords.length;
      applyChord(chordIndex);
    }, 12000);

    audioState.master = master;
    audioState.noiseSource = noise;
    audioState.started = true;
    updateAudioButton();
    setAudioMuted(audioState.muted);
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
    const context = ensureAudioContext();
    if (!context) return false;
    try {
      await context.resume();
    } catch (error) {
      if (onFailure) onFailure(error);
      return false;
    }
    setAudioMuted(false);
    startAmbientBGM(context);
    return true;
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
        if (audioState.started) {
          setAudioMuted(!audioState.muted);
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

  function defaultPlayer() {
    return {
      name: DEFAULT_PLAYER_NAME,
      hp: 42,
      maxHp: 42,
      mp: 8,
      maxMp: 8,
      gold: 20,
      stats: { STR: 2, DEX: 2, INT: 1, WIS: 1, LUK: 1, CHA: 1, CON: 1 },
      counters: { trust: 0, insight: 0 }
    };
  }

  function normalizePlayer(playerData) {
    const fallback = defaultPlayer();
    const safe = playerData && typeof playerData === "object" ? playerData : {};
    const safeName = typeof safe.name === "string" ? safe.name.trim() : "";
    return {
      ...fallback,
      ...safe,
      name: safeName || fallback.name,
      mp: Number.isFinite(Number(safe.mp)) ? Number(safe.mp) : fallback.mp,
      maxMp: Number.isFinite(Number(safe.maxMp)) ? Number(safe.maxMp) : fallback.maxMp,
      stats: { ...fallback.stats, ...(safe.stats ?? {}) },
      counters: { ...fallback.counters, ...(safe.counters ?? {}) }
    };
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
      questCount: state.questCount,
      questTarget: state.questTarget,
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
    if (elements.statStr) elements.statStr.textContent = String(state.player.stats?.STR ?? 0);
    if (elements.statWis) elements.statWis.textContent = String(state.player.stats?.WIS ?? 0);
    if (elements.statInt) elements.statInt.textContent = String(state.player.stats?.INT ?? 0);
    if (elements.statDex) elements.statDex.textContent = String(state.player.stats?.DEX ?? 0);
    if (elements.statLuk) elements.statLuk.textContent = String(state.player.stats?.LUK ?? 0);
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
  }

  function getRandomItem(list) {
    if (!list.length) return null;
    const index = Math.floor(Math.random() * list.length);
    return list[index];
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

  function getCurrentTravelEvent() {
    const travelEvents = state.data?.travelEvents ?? [];
    if (state.travelEventId) {
      return travelEvents.find((event) => event.id === state.travelEventId) ?? null;
    }
    const remaining = travelEvents.filter((event) => !state.travelHistory.includes(event.id));
    const pool = remaining.length ? remaining : travelEvents;
    const selected = getRandomItem(pool);
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
        state.travelCount += 1;
        if (travelEvent.id && !state.travelHistory.includes(travelEvent.id)) {
          state.travelHistory.push(travelEvent.id);
        }
        state.travelEventId = null;
        advanceTravel();
        saveState();
      });
    } else {
      options.forEach((option) => {
        const label = option.text ?? "선택";
        addChoiceButton(label, () => {
          applyImpact(option.impact);
          if (option.outcomeText) {
            addLog(option.outcomeText);
          }
          state.travelCount += 1;
          if (travelEvent.id && !state.travelHistory.includes(travelEvent.id)) {
            state.travelHistory.push(travelEvent.id);
          }
          state.travelEventId = null;
          if (option.startCombat) {
            startCombat(option.startCombat);
            saveState();
            return;
          }
          advanceTravel();
          saveState();
        });
      });
    }
    addLog(`여정: ${travelEvent.title ?? "이벤트"}`);
    updateHud();
    saveState();
  }

  function renderCurrent() {
    if (state.inCombat) {
      renderCombat();
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
    return { nodesMap, enemiesMap, endingsMap };
  }

  function newGameState(playerName = DEFAULT_PLAYER_NAME) {
    state.player = normalizePlayer({ name: playerName });
    state.nodeId = "GUILD_ARRIVAL";
    state.phase = "prologue";
    state.prologueId = null;
    state.travelEventId = null;
    state.travelCount = 0;
    state.travelTarget = randomBetween(TRAVEL_STEPS_MIN, TRAVEL_STEPS_MAX);
    state.travelHistory = [];
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

  function normalizePlayerName(raw) {
    const trimmed = String(raw ?? "").trim();
    return trimmed.length ? trimmed : DEFAULT_PLAYER_NAME;
  }

  function applyNewJourney(playerName) {
    uiState.pendingNamePrompt = false;
    newGameState(normalizePlayerName(playerName));
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
    updateHud();
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

  function renderStatusSheet() {
    if (elements.statsGrid) {
      elements.statsGrid.innerHTML = "";
      STAT_KEYS.forEach((key) => {
        const value = state.player.stats?.[key] ?? 0;
        const row = document.createElement("div");
        row.className = "stat-card";
        row.innerHTML = `<span>${key}</span><strong>${value}</strong>`;
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
    const items = Array.isArray(state.data?.items) ? state.data.items : [];
    renderInventoryGrid(elements.inventoryGrid, items);
  }

  function renderInventorySheet() {
    const items = Array.isArray(state.data?.items) ? state.data.items : [];
    if (elements.inventoryEmpty) {
      elements.inventoryEmpty.hidden = items.length > 0;
    }
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
    return Number(state.player.stats?.STR ?? 0);
  }

  function clearCombatState() {
    state.inCombat = false;
    state.combat = null;
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
      addLog(`${enemy.name} 처치! 탐험으로 복귀합니다.`);
      clearCombatState();
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
    state.phase = ["prologue", "travel", "node"].includes(phase) ? phase : "node";
    state.prologueId = saved.prologueId ?? null;
    state.travelEventId = saved.travelEventId ?? null;
    state.travelCount = Number(saved.travelCount ?? 0);
    state.travelTarget = Number(saved.travelTarget ?? randomBetween(TRAVEL_STEPS_MIN, TRAVEL_STEPS_MAX));
    state.travelHistory = Array.isArray(saved.travelHistory) ? saved.travelHistory : [];
    state.questCount = Number(saved.questCount ?? 0);
    state.questTarget = Number(saved.questTarget ?? randomBetween(QUEST_STEPS_MIN, QUEST_STEPS_MAX));
    state.log = Array.isArray(saved.log) ? saved.log : [];
    state.lastSummary = saved.lastSummary ?? "최근 요약: -";
    state.inCombat = Boolean(saved.inCombat);
    state.combat = saved.combat ?? null;
    state.runRecorded = false;
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
      elements.modalBackdrop.addEventListener("click", () => closeComingSoon());
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
        if (!audioState.started) {
          await activateAudioFromGesture();
          return;
        }
        setAudioMuted(!audioState.muted);
      });
      updateAudioButton();
    }
    if (elements.nameConfirm) {
      elements.nameConfirm.addEventListener("click", () => {
        const name = elements.nameInput?.value ?? "";
        closeNameModal();
        applyNewJourney(name);
      });
    }
    if (elements.nameCancel) {
      elements.nameCancel.addEventListener("click", () => {
        closeNameModal();
        applyNewJourney(DEFAULT_PLAYER_NAME);
      });
    }
    if (elements.nameInput) {
      elements.nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const name = elements.nameInput?.value ?? "";
          closeNameModal();
          applyNewJourney(name);
        }
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
      loadJson("enemies"),
      loadJson("endings"),
      loadJson("prologues"),
      loadJson("travel_events")
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
          prologues: normalizePrologues(data.prologues),
          travelEvents: normalizeTravelEvents(data.travel_events)
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

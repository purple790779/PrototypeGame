(() => {
  const VERSION = "v0.2.8";
  const SAVE_KEY = "textrpg-omega-save";
  const STORAGE_PREFIX = "textrpg";
  const MAIN_SCRIPT = document.getElementById("appMain");
  const scriptSrc = MAIN_SCRIPT?.src || window.location.href;
  const BASE_URL = new URL("./", scriptSrc);

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

  const elements = {
    main: document.querySelector("main.main"),
    sceneTitle: document.getElementById("scene-title"),
    sceneText: document.getElementById("scene-text"),
    diceValue: document.getElementById("dice-value"),
    diceLabel: document.getElementById("dice-label"),
    resumeCombat: document.getElementById("resume-combat"),
    log: document.getElementById("log"),
    logSummary: document.getElementById("log-summary"),
    hudHp: document.getElementById("hud-hp"),
    hudGold: document.getElementById("hud-gold"),
    saveButton: document.getElementById("btn-save"),
    actionDock: document.getElementById("action-dock"),
    dockMain: document.getElementById("dock-main"),
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
    combatDock: document.getElementById("combat-dock")
  };

  if (elements.versionLabel) {
    elements.versionLabel.textContent = VERSION;
  }

  const headerTitle = document.querySelector(".app__header h1");
  if (headerTitle) {
    const badge = document.createElement("span");
    badge.className = "engine-badge";
    badge.textContent = `[ENGINE ${VERSION}]`;
    badge.style.marginLeft = "8px";
    badge.style.fontSize = "0.7em";
    badge.style.fontWeight = "700";
    badge.style.color = "#ffd36a";
    headerTitle.appendChild(badge);
  }

  const state = {
    data: null,
    maps: null,
    player: null,
    nodeId: "NODE_PROLOGUE",
    inCombat: false,
    combat: null,
    log: [],
    lastSummary: "최근 요약: -"
  };

  function defaultPlayer() {
    return {
      hp: 42,
      maxHp: 42,
      gold: 20,
      stats: { STR: 2, DEX: 2, INT: 1, LUK: 1, CHA: 1, CON: 1 },
      counters: { trust: 0, insight: 0 }
    };
  }

  function normalizePlayer(playerData) {
    const fallback = defaultPlayer();
    const safe = playerData && typeof playerData === "object" ? playerData : {};
    return {
      ...fallback,
      ...safe,
      stats: { ...fallback.stats, ...(safe.stats ?? {}) },
      counters: { ...fallback.counters, ...(safe.counters ?? {}) }
    };
  }

  function serializeState() {
    return {
      version: VERSION,
      nodeId: state.nodeId,
      player: state.player,
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
      if (key && key.startsWith(STORAGE_PREFIX)) {
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
    const toast = document.getElementById("save-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    setTimeout(() => toast.classList.remove("is-visible"), 1400);
  }

  function setView(mode) {
    const isCombat = mode === "combat";
    if (elements.main) elements.main.hidden = isCombat;
    if (elements.combatScene) elements.combatScene.hidden = !isCombat;
    if (elements.actionDock) elements.actionDock.hidden = mode !== "explore";
    if (elements.dataError) elements.dataError.hidden = mode !== "fatal";
    if (elements.resumeCombat) elements.resumeCombat.hidden = true;
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
      row.className = "log-entry";
      row.textContent = entry;
      elements.log.appendChild(row);
    });
    if (elements.logSummary) {
      elements.logSummary.textContent = state.lastSummary;
    }
  }

  function addLog(entry) {
    state.log.push(entry);
    if (state.log.length > 40) {
      state.log.shift();
    }
    state.lastSummary = `최근 요약: ${entry}`;
    renderLog();
  }

  function updateHud() {
    if (elements.hudHp) {
      const hpValue = elements.hudHp.querySelector(".stat-pill__value");
      if (hpValue) {
        hpValue.textContent = `${state.player.hp}/${state.player.maxHp}`;
      }
    }
    if (elements.hudGold) {
      const goldValue = elements.hudGold.querySelector(".stat-pill__value");
      if (goldValue) {
        goldValue.textContent = String(state.player.gold ?? 0);
      }
    }
  }

  function clearChoices() {
    if (elements.dockMain) elements.dockMain.innerHTML = "";
  }

  function addChoiceButton(label, onClick) {
    if (!elements.dockMain) return;
    const button = document.createElement("button");
    button.className = "btn";
    button.textContent = label;
    button.addEventListener("click", onClick);
    elements.dockMain.appendChild(button);
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
            impact: choice.impact ?? choice.effects ?? choice.delta ?? null
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

  function newGameState() {
    state.player = normalizePlayer(null);
    state.nodeId = "NODE_PROLOGUE";
    state.inCombat = false;
    state.combat = null;
    state.log = [];
    state.lastSummary = "최근 요약: -";
  }

  function applyImpact(impact) {
    if (!impact || typeof impact !== "object") return;
    const hpDelta = Number(impact.hp ?? 0);
    const goldDelta = Number(impact.gold ?? 0);
    const trustDelta = Number(impact.trust ?? 0);
    const insightDelta = Number(impact.insight ?? 0);
    if (Number.isFinite(hpDelta)) {
      state.player.hp = Math.max(0, Math.min(state.player.maxHp, state.player.hp + hpDelta));
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

  function renderEnding(endingId) {
    const ending = state.maps.endingsMap.get(endingId);
    setView("explore");
    if (elements.sceneTitle) elements.sceneTitle.textContent = "엔딩";
    if (elements.sceneText) {
      elements.sceneText.textContent = ending?.text || "엔딩을 찾을 수 없습니다.";
    }
    clearChoices();
    addChoiceButton("새 여정", () => {
      newGameState();
      saveState();
      renderNode(state.nodeId);
    });
  }

  function renderNode(nodeId) {
    const node = state.maps.nodesMap.get(nodeId);
    if (!node) {
      renderFatal(
        [{ name: "nodes", url: "-", status: "-", message: `NODE '${nodeId}' 없음` }],
        "노드 데이터를 찾을 수 없습니다."
      );
      return;
    }
    state.nodeId = node.id;
    setView("explore");
    if (elements.sceneTitle) elements.sceneTitle.textContent = node.title ?? "";
    if (elements.sceneText) elements.sceneText.textContent = node.situation ?? "";
    if (elements.diceValue) elements.diceValue.textContent = "--";
    if (elements.diceLabel) elements.diceLabel.textContent = "주사위 대기";
    clearChoices();
    node.choices.forEach((choice) => {
      const label = choice.text ?? choice.label ?? "선택";
      addChoiceButton(label, () => {
        applyImpact(choice.impact);
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
    if (!node.choices.length) {
      addChoiceButton("새 여정", () => {
        newGameState();
        saveState();
        renderNode(state.nodeId);
      });
    }
    addLog(node.title ?? "탐험 진행");
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
      renderNode(state.nodeId);
      return;
    }
    state.inCombat = true;
    state.combat = {
      enemyId: enemy.id,
      enemyHp: enemy.hp,
      enemyMaxHp: enemy.hp
    };
    renderCombat();
    saveState();
  }

  function renderCombat() {
    const enemy = state.maps.enemiesMap.get(state.combat?.enemyId);
    if (!enemy) {
      clearCombatState();
      renderNode(state.nodeId);
      return;
    }
    setView("combat");
    if (elements.combatEnemyName) elements.combatEnemyName.textContent = enemy.name;
    if (elements.combatEnemyHp) {
      elements.combatEnemyHp.textContent = `${state.combat.enemyHp}/${state.combat.enemyMaxHp}`;
    }
    if (elements.combatPlayerHp) {
      elements.combatPlayerHp.textContent = `${state.player.hp}/${state.player.maxHp}`;
    }
    if (elements.combatSituation) {
      elements.combatSituation.textContent = "전투가 시작됐다.";
    }
    if (elements.combatDiceValue) elements.combatDiceValue.textContent = "--";
    if (elements.combatDiceLabel) elements.combatDiceLabel.textContent = "전투 판정";
    if (elements.combatDiceBadge) elements.combatDiceBadge.textContent = "-";
    if (elements.combatRecover) elements.combatRecover.hidden = true;
    if (elements.combatDicePanel) elements.combatDicePanel.hidden = false;
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
      renderNode(state.nodeId);
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
      renderNode(state.nodeId);
      return;
    }

    const enemyDamage = enemy.attack + randomBetween(enemy.dmgMin, enemy.dmgMax);
    state.player.hp = Math.max(0, state.player.hp - enemyDamage);
    addLog(`${enemy.name}의 반격! ${enemyDamage} 피해.`);

    if (state.player.hp <= 0) {
      addLog("당신은 쓰러졌다...");
      clearCombatState();
      setView("explore");
      if (elements.sceneTitle) elements.sceneTitle.textContent = "전투 패배";
      if (elements.sceneText) {
        elements.sceneText.textContent = "전투에서 패배했습니다. 새 여정을 시작하거나 탐험으로 복귀하세요.";
      }
      clearChoices();
      addChoiceButton("새 여정", () => {
        newGameState();
        saveState();
        renderNode(state.nodeId);
      });
      addChoiceButton("탐험으로 복귀", () => {
        state.player.hp = Math.max(1, state.player.hp);
        renderNode(state.nodeId);
      });
      updateHud();
      saveState();
      return;
    }

    if (elements.combatEnemyHp) {
      elements.combatEnemyHp.textContent = `${state.combat.enemyHp}/${state.combat.enemyMaxHp}`;
    }
    if (elements.combatPlayerHp) {
      elements.combatPlayerHp.textContent = `${state.player.hp}/${state.player.maxHp}`;
    }
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
      return;
    }
    state.player = normalizePlayer(saved.player);
    state.nodeId = saved.nodeId ?? "NODE_PROLOGUE";
    state.log = Array.isArray(saved.log) ? saved.log : [];
    state.lastSummary = saved.lastSummary ?? "최근 요약: -";
    state.inCombat = Boolean(saved.inCombat);
    state.combat = saved.combat ?? null;
  }

  function ensureCombatRestored() {
    if (!state.inCombat) return;
    const enemyId = state.combat?.enemyId;
    if (!enemyId || !state.maps.enemiesMap.has(enemyId)) {
      addLog("전투 데이터를 복원할 수 없어 탐험으로 복귀합니다.");
      clearCombatState();
      saveState();
    }
  }

  function wireEvents() {
    if (elements.saveButton) {
      elements.saveButton.addEventListener("click", () => saveState());
    }
    if (elements.resetButton) {
      elements.resetButton.addEventListener("click", () => {
        newGameState();
        saveState();
        renderNode(state.nodeId);
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
    if (elements.combatRecoverButton) {
      elements.combatRecoverButton.addEventListener("click", () => {
        clearCombatState();
        saveState();
        renderNode(state.nodeId || "NODE_PROLOGUE");
      });
    }
    if (elements.combatDicePanel) {
      elements.combatDicePanel.addEventListener("click", () => {
        if (state.inCombat) {
          resolveCombatTurn();
        }
      });
    }
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
    renderLoading();
    wireEvents();

    Promise.allSettled([
      loadJson("nodes"),
      loadJson("events"),
      loadJson("items"),
      loadJson("enemies"),
      loadJson("endings")
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
          items: data.items ?? []
        };
        state.maps = createMaps(state.data);

        restoreState();
        ensureCombatRestored();
        updateHud();
        renderLog();

        if (state.inCombat) {
          renderCombat();
        } else {
          renderNode(state.nodeId || "NODE_PROLOGUE");
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

const VERSION = "v0.1.1";
const SAVE_KEY = "textrpg-omega-save";

const state = {
  data: null,
  player: null,
  nodeId: "NODE_PROLOGUE",
  inCombat: false,
  enemy: null,
  typing: false,
  log: [],
  isBusy: false,
  diceTimer: null
};

const elements = {
  sceneTitle: document.getElementById("scene-title"),
  sceneText: document.getElementById("scene-text"),
  choices: document.getElementById("choices"),
  log: document.getElementById("log"),
  diceValue: document.getElementById("dice-value"),
  diceLabel: document.getElementById("dice-label"),
  hudHp: document.getElementById("hud-hp"),
  hudGold: document.getElementById("hud-gold"),
  hudTrust: document.getElementById("hud-trust"),
  hudInsight: document.getElementById("hud-insight"),
  hudStr: document.getElementById("hud-str"),
  hudDex: document.getElementById("hud-dex"),
  hudInt: document.getElementById("hud-int"),
  hudLuk: document.getElementById("hud-luk"),
  hudStatus: document.getElementById("hud-status"),
  hudInventory: document.getElementById("hud-inventory"),
  saveButton: document.getElementById("btn-save"),
  saveStatus: document.getElementById("save-status"),
  saveToast: document.getElementById("save-toast"),
  versionLabel: document.getElementById("version-label"),
  toggleTyping: document.getElementById("toggle-typing"),
  resetButton: document.getElementById("btn-reset")
};

const statusCatalog = {
  bleed: { label: "출혈", damage: 2 },
  poison: { label: "중독", damage: 3 }
};

let saveDebounceId = null;
let toastTimerId = null;
let statusTimerId = null;

function defaultPlayer() {
  return {
    hp: 42,
    maxHp: 42,
    stats: { STR: 2, DEX: 2, INT: 1, LUK: 1, CHA: 1, CON: 1 },
    gold: 20,
    inventory: ["potion_small"],
    flags: [],
    counters: { trust: 0, insight: 0 },
    status: []
  };
}

function logEntry(text) {
  state.log.unshift({ text, time: new Date().toLocaleTimeString("ko-KR") });
  state.log = state.log.slice(0, 40);
  renderLog();
}

function renderLog() {
  elements.log.innerHTML = "";
  state.log.forEach((entry) => {
    const line = document.createElement("div");
    line.className = "log__entry";
    line.innerHTML = `<strong>[${entry.time}]</strong> ${entry.text}`;
    elements.log.appendChild(line);
  });
}

function updateHud() {
  if (!state.player) return;
  const { player } = state;
  elements.hudHp.textContent = `HP ${player.hp}/${player.maxHp}`;
  elements.hudGold.textContent = `골드 ${player.gold}`;
  elements.hudTrust.textContent = `신뢰 ${player.counters.trust}`;
  elements.hudInsight.textContent = `단서 ${player.counters.insight}`;
  elements.hudStr.textContent = `STR ${player.stats.STR}`;
  elements.hudDex.textContent = `DEX ${player.stats.DEX}`;
  elements.hudInt.textContent = `INT ${player.stats.INT}`;
  elements.hudLuk.textContent = `LUK ${player.stats.LUK}`;
  const statusText = player.status.length
    ? player.status.map((s) => `${statusCatalog[s.id]?.label ?? s.id}(${s.turns})`).join(", ")
    : "정상";
  elements.hudStatus.textContent = `상태: ${statusText}`;
  const inventoryNames = player.inventory
    .map((id) => state.data?.items?.find((item) => item.id === id)?.name)
    .filter(Boolean);
  elements.hudInventory.textContent = inventoryNames.length ? `보유: ${inventoryNames.join(", ")}` : "보유: -";
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

function showToast(message, tone = "success") {
  if (!elements.saveToast) return;
  elements.saveToast.textContent = message;
  elements.saveToast.classList.add("is-visible");
  elements.saveToast.classList.toggle("is-error", tone === "error");
  if (toastTimerId) {
    clearTimeout(toastTimerId);
  }
  toastTimerId = setTimeout(() => {
    elements.saveToast.classList.remove("is-visible");
  }, 1600);
}

function setScene(title, text) {
  elements.sceneTitle.textContent = title;
  if (!state.typing) {
    elements.sceneText.textContent = text;
    return;
  }
  elements.sceneText.textContent = "";
  let index = 0;
  const interval = setInterval(() => {
    elements.sceneText.textContent += text[index];
    index += 1;
    if (index >= text.length) {
      clearInterval(interval);
    }
  }, 18);
}

function renderChoices(choiceList) {
  elements.choices.innerHTML = "";
  choiceList.forEach((choice) => {
    const button = document.createElement("button");
    button.className = `choice-btn${choice.danger ? " choice-btn--danger" : ""}`;
    button.textContent = choice.text;
    button.disabled = state.isBusy;
    button.addEventListener("click", async () => {
      if (state.isBusy) return;
      state.isBusy = true;
      setChoicesDisabled(true);
      try {
        await Promise.resolve(choice.onSelect());
      } finally {
        state.isBusy = false;
        setChoicesDisabled(false);
      }
    });
    elements.choices.appendChild(button);
  });
}

function animateDice(finalValue, label = "주사위") {
  elements.diceLabel.textContent = label;
  return new Promise((resolve) => {
    let count = 0;
    if (state.diceTimer) {
      clearInterval(state.diceTimer);
    }
    const timer = setInterval(() => {
      elements.diceValue.textContent = Math.floor(Math.random() * 20) + 1;
      count += 1;
      if (count > 8) {
        clearInterval(timer);
        state.diceTimer = null;
        elements.diceValue.textContent = finalValue;
        resolve();
      }
    }, 60);
    state.diceTimer = timer;
  });
}

async function rollD20(modifier, label) {
  const roll = Math.floor(Math.random() * 20) + 1;
  await animateDice(roll, label);
  const total = roll + modifier;
  return { roll, total, modifier };
}

function getWeaponBonus() {
  const weaponItems = state.player.inventory
    .map((id) => state.data.items.find((item) => item.id === id))
    .filter((item) => item && item.type === "weapon");
  if (!weaponItems.length) {
    return { toHit: 0, damage: 1 };
  }
  const best = weaponItems.sort((a, b) => (b.bonus?.damage ?? 0) - (a.bonus?.damage ?? 0))[0];
  return { toHit: best.bonus?.to_hit ?? 0, damage: best.bonus?.damage ?? 1 };
}

function getAcBonus() {
  const amulets = state.player.inventory
    .map((id) => state.data.items.find((item) => item.id === id))
    .filter((item) => item && item.effect?.ac_bonus);
  return amulets.reduce((sum, item) => sum + item.effect.ac_bonus, 0);
}

function applyEffects(effects = []) {
  effects.forEach((effect) => {
    if (effect.hp) {
      state.player.hp = Math.min(state.player.maxHp, Math.max(0, state.player.hp + effect.hp));
    }
    if (effect.gold) {
      state.player.gold = Math.max(0, state.player.gold + effect.gold);
    }
    if (effect.item) {
      state.player.inventory.push(effect.item);
      const name = state.data.items.find((item) => item.id === effect.item)?.name ?? effect.item;
      logEntry(`${name}을(를) 획득했다.`);
    }
    if (effect.flag_add) {
      if (!state.player.flags.includes(effect.flag_add)) {
        state.player.flags.push(effect.flag_add);
      }
    }
    if (effect.trust) {
      state.player.counters.trust += effect.trust;
    }
    if (effect.insight) {
      state.player.counters.insight += effect.insight;
    }
    if (effect.status_add) {
      state.player.status.push({ id: effect.status_add, turns: effect.turns ?? 2 });
    }
    if (effect.status_remove) {
      state.player.status = state.player.status.filter((s) => !effect.status_remove.includes(s.id));
    }
    if (effect.next_node) {
      state.nodeId = effect.next_node;
    }
    if (effect.start_combat) {
      startCombat(effect.start_combat);
    }
  });
  updateHud();
}

function requirementsMet(requirements = {}) {
  if (requirements.min_trust && state.player.counters.trust < requirements.min_trust) {
    return false;
  }
  if (requirements.min_insight && state.player.counters.insight < requirements.min_insight) {
    return false;
  }
  if (requirements.items) {
    const hasAll = requirements.items.every((id) => state.player.inventory.includes(id));
    if (!hasAll) return false;
  }
  return true;
}

function eventConditionMet(condition = {}) {
  if (condition.min_trust && state.player.counters.trust < condition.min_trust) {
    return false;
  }
  if (condition.min_insight && state.player.counters.insight < condition.min_insight) {
    return false;
  }
  if (condition.flags_include) {
    const hasFlags = condition.flags_include.every((flag) => state.player.flags.includes(flag));
    if (!hasFlags) return false;
  }
  if (condition.flags_exclude) {
    const blocked = condition.flags_exclude.some((flag) => state.player.flags.includes(flag));
    if (blocked) return false;
  }
  if (condition.items_include) {
    const hasItems = condition.items_include.every((id) => state.player.inventory.includes(id));
    if (!hasItems) return false;
  }
  return true;
}

async function runEvent(eventId) {
  const event = state.data.events.find((item) => item.id === eventId);
  if (!event) return;
  setScene(event.title, "잠시 긴장이 감돈다...");
  logEntry(`이벤트: ${event.title}`);

  if (event.check.type === "combat") {
    await animateDice("⚔️", "전투" );
    startCombat(event.check.enemy);
    return;
  }

  if (event.check.type === "none") {
    const result = event.results.success;
    setScene(event.title, result.text);
    logEntry(result.text);
    applyEffects(result.effects);
    saveGame();
    renderNode();
    return;
  }

  const stat = event.check.stat;
  const modifier = state.player.stats[stat] ?? 0;
  const roll = await rollD20(modifier, `${stat} 판정`);
  const isCritSuccess = roll.roll === 20;
  const isCritFail = roll.roll === 1;
  let resultKey = roll.total >= event.check.dc ? "success" : "fail";
  if (isCritSuccess && event.results.crit_success) resultKey = "crit_success";
  if (isCritFail && event.results.crit_fail) resultKey = "crit_fail";

  const result = event.results[resultKey];
  setScene(event.title, `${result.text} (굴림 ${roll.roll} + ${roll.modifier} = ${roll.total})`);
  logEntry(result.text);
  applyEffects(result.effects);
  saveGame();
  renderNode();
}

function renderNode() {
  if (state.inCombat) return;
  const node = state.data.nodes.find((item) => item.node_id === state.nodeId);
  if (!node) return;
  setScene(node.title, node.situation);

  const choices = [];
  if (node.event_pool && node.event_pool.length) {
    choices.push({
      text: "주변을 탐색한다",
      onSelect: async () => {
        const pool = node.event_pool.filter((eventId) => {
          const event = state.data.events.find((item) => item.id === eventId);
          return event && eventConditionMet(event.condition);
        });
        const eventId = pool.length ? pool[Math.floor(Math.random() * pool.length)] : node.event_pool[0];
        await runEvent(eventId);
      }
    });
  }

  node.choices.forEach((choice) => {
    const locked = choice.requirements && !requirementsMet(choice.requirements);
    choices.push({
      text: locked ? `${choice.text} (조건 미충족)` : choice.text,
      danger: locked,
      onSelect: async () => {
        if (locked) {
          logEntry("조건이 충족되지 않았다.");
          return;
        }
        if (choice.impact) {
          applyEffects([choice.impact]);
        }
        if (choice.start_combat) {
          startCombat(choice.start_combat, choice.next_node);
          return;
        }
        if (choice.ending_id) {
          showEnding(choice.ending_id);
          return;
        }
        if (choice.next_node) {
          state.nodeId = choice.next_node;
        }
        saveGame({ silent: true });
        renderNode();
      }
    });
  });

  renderChoices(choices);
  updateHud();
}

function applyStatus(target, label) {
  if (!target.status.length) return 0;
  let total = 0;
  target.status = target.status
    .map((status) => {
      const damage = statusCatalog[status.id]?.damage ?? 0;
      total += damage;
      return { ...status, turns: status.turns - 1 };
    })
    .filter((status) => status.turns > 0);
  if (total > 0) {
    target.hp = Math.max(0, target.hp - total);
    logEntry(`${label}이(가) 상태 이상 피해 ${total}을(를) 받았다.`);
  }
  return total;
}

function startCombat(enemyId, nextNode = null) {
  const enemyTemplate = state.data.enemies.find((item) => item.id === enemyId);
  if (!enemyTemplate) return;
  state.inCombat = true;
  state.enemy = {
    ...enemyTemplate,
    status: [],
    nextNode
  };
  setScene(`전투 - ${enemyTemplate.name}`, `${enemyTemplate.name}과(와) 마주쳤다.`);
  logEntry(`${enemyTemplate.name} 전투 시작.`);
  renderCombatChoices();
  updateHud();
}

function renderCombatChoices() {
  const choices = [
    { text: "공격한다", onSelect: () => combatPlayerAttack() },
    { text: "방어 자세", onSelect: () => combatDefend() }
  ];
  if (state.player.inventory.some((id) => state.data.items.find((item) => item.id === id && item.type === "consumable"))) {
    choices.push({ text: "아이템 사용", onSelect: () => combatUseItem() });
  }
  choices.push({ text: "도주 시도", onSelect: () => combatEscape() });
  renderChoices(choices);
}

async function combatPlayerAttack() {
  if (!state.inCombat) return;
  applyStatus(state.player, "당신");
  if (state.player.hp <= 0) {
    handleDefeat();
    return;
  }
  const weapon = getWeaponBonus();
  const attackBonus = state.player.stats.STR + weapon.toHit;
  const roll = await rollD20(attackBonus, "명중 판정");
  const isCrit = roll.roll === 20;
  const isCritFail = roll.roll === 1;
  if (isCritFail) {
    logEntry("공격이 크게 빗나갔다!");
  } else if (isCrit || roll.total >= state.enemy.ac) {
    const baseDamage = weapon.damage + state.player.stats.STR;
    const damage = isCrit ? baseDamage * 2 : baseDamage;
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    logEntry(`공격 성공! ${damage}의 피해를 주었다.`);
  } else {
    logEntry("공격이 빗나갔다.");
  }
  if (state.enemy.hp <= 0) {
    handleVictory();
    return;
  }
  await enemyTurn();
}

async function combatDefend() {
  if (!state.inCombat) return;
  logEntry("방어 자세를 취했다. 다음 공격에 대비한다.");
  applyStatus(state.player, "당신");
  await enemyTurn(true);
}

function combatUseItem() {
  const consumables = state.player.inventory
    .map((id) => state.data.items.find((item) => item.id === id))
    .filter((item) => item && item.type === "consumable");
  const choices = consumables.map((item) => ({
    text: `${item.name} 사용`,
    onSelect: () => {
      applyItem(item);
      renderCombatChoices();
    }
  }));
  choices.push({ text: "취소", onSelect: () => renderCombatChoices() });
  renderChoices(choices);
}

function applyItem(item) {
  const effect = item.effect ?? {};
  if (effect.hp) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + effect.hp);
    logEntry(`${item.name}을 사용해 HP를 회복했다.`);
  }
  if (effect.status_remove) {
    state.player.status = state.player.status.filter((status) => !effect.status_remove.includes(status.id));
    logEntry(`${item.name}으로 상태 이상을 해제했다.`);
  }
  if (effect.insight) {
    state.player.counters.insight += effect.insight;
  }
  if (effect.trust) {
    state.player.counters.trust += effect.trust;
  }
  state.player.inventory = state.player.inventory.filter((id) => id !== item.id);
  updateHud();
  saveGame({ silent: true });
}

async function combatEscape() {
  const smokeBomb = state.player.inventory.includes("smoke_bomb");
  const bonus = smokeBomb ? 3 : 0;
  const roll = await rollD20(state.player.stats.DEX + bonus, "도주 판정");
  if (roll.roll === 20 || roll.total >= 14) {
    logEntry("도주에 성공했다!");
    state.inCombat = false;
    if (smokeBomb) {
      state.player.inventory = state.player.inventory.filter((id) => id !== "smoke_bomb");
    }
    renderNode();
    saveGame({ silent: true });
    return;
  }
  logEntry("도주에 실패했다.");
  await enemyTurn();
}

async function enemyTurn(defending = false) {
  const enemy = state.enemy;
  applyStatus(enemy, enemy.name);
  if (enemy.hp <= 0) {
    handleVictory();
    return;
  }
  const playerAc = 10 + state.player.stats.DEX + getAcBonus() + (defending ? 2 : 0);
  const roll = await rollD20(enemy.attack, "적 명중 판정");
  const isCrit = roll.roll === 20;
  const isCritFail = roll.roll === 1;
  if (isCritFail) {
    logEntry(`${enemy.name}의 공격이 빗나갔다.`);
  } else if (isCrit || roll.total >= playerAc) {
    const baseDamage =
      Math.floor(Math.random() * (enemy.damage.max - enemy.damage.min + 1)) + enemy.damage.min;
    const damage = isCrit ? baseDamage + 4 : baseDamage;
    state.player.hp = Math.max(0, state.player.hp - damage);
    logEntry(`${enemy.name}의 공격! ${damage}의 피해를 입었다.`);
    if (enemy.status_attack && Math.random() < enemy.status_attack.chance) {
      state.player.status.push({ id: enemy.status_attack.id, turns: enemy.status_attack.turns });
      logEntry(`${enemy.name}의 공격으로 ${statusCatalog[enemy.status_attack.id]?.label ?? "상태 이상"} 발생!`);
    }
  } else {
    logEntry(`${enemy.name}의 공격을 피했다.`);
  }

  updateHud();
  if (state.player.hp <= 0) {
    handleDefeat();
    return;
  }
  renderCombatChoices();
  saveGame({ silent: true });
}

function handleVictory() {
  const enemy = state.enemy;
  logEntry(`${enemy.name}을(를) 쓰러뜨렸다.`);
  state.player.gold += 10;
  state.player.counters.trust += 1;
  if (Math.random() < 0.4) {
    state.player.inventory.push("potion_small");
    logEntry("전리품으로 물약을 얻었다.");
  }
  state.inCombat = false;
  if (enemy.nextNode) {
    state.nodeId = enemy.nextNode;
  }
  updateHud();
  saveGame({ silent: true });
  renderNode();
}

function handleDefeat() {
  state.inCombat = false;
  const ending = state.data.endings.find((item) => item.id === "ENDING_DEFEAT");
  showEnding(ending?.id ?? "ENDING_DEFEAT");
}

function showEnding(endingId) {
  const ending = state.data.endings.find((item) => item.id === endingId);
  if (!ending) return;
  setScene(ending.title, ending.text);
  logEntry(`엔딩: ${ending.summary}`);
  renderChoices([
    {
      text: "새 여정 시작",
      onSelect: () => {
        resetGame();
      }
    }
  ]);
}

function saveGame({ silent = true } = {}) {
  const saveData = {
    version: VERSION,
    nodeId: state.nodeId,
    player: state.player,
    log: state.log
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    if (!silent) {
      setSaveStatus("저장 완료");
      showToast("저장 완료");
    }
    return true;
  } catch (error) {
    console.error("Failed to save game", error);
    if (!silent) {
      setSaveStatus("저장 실패");
      showToast("저장 실패(저장공간/권한 확인)", "error");
    }
    return false;
  }
}

function saveGameWithFeedback() {
  setSaveStatus("저장 중...");
  saveGame({ silent: false });
  if (statusTimerId) {
    clearTimeout(statusTimerId);
  }
  statusTimerId = setTimeout(() => {
    setSaveStatus("");
  }, 1800);
}

function parseSaveData(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (error) {
    console.error("Failed to parse save data", error);
    return null;
  }
}

function normalizePlayer(playerData) {
  const fallback = defaultPlayer();
  const safe = playerData && typeof playerData === "object" ? playerData : {};
  return {
    ...fallback,
    ...safe,
    stats: { ...fallback.stats, ...(safe.stats ?? {}) },
    counters: { ...fallback.counters, ...(safe.counters ?? {}) },
    inventory: Array.isArray(safe.inventory) ? safe.inventory : fallback.inventory,
    flags: Array.isArray(safe.flags) ? safe.flags : fallback.flags,
    status: Array.isArray(safe.status) ? safe.status : fallback.status
  };
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    resetGame(false);
    return;
  }
  const data = parseSaveData(raw);
  if (!data) {
    showToast("세이브를 읽지 못해 새 여정으로 시작합니다.", "error");
    resetGame(false);
    return;
  }
  if (data.version !== VERSION) {
    const reset = window.confirm(
      `세이브 버전(${data.version})과 현재 버전(${VERSION})이 다릅니다. 초기화하시겠습니까?`
    );
    if (reset) {
      resetGame(false);
      return;
    }
  }
  state.player = normalizePlayer(data.player);
  state.nodeId = data.nodeId ?? "NODE_PROLOGUE";
  state.log = Array.isArray(data.log) ? data.log : [];
  updateHud();
  renderLog();
  renderNode();
}

function resetGame(render = true) {
  localStorage.removeItem(SAVE_KEY);
  state.player = defaultPlayer();
  state.nodeId = "NODE_PROLOGUE";
  state.log = [];
  logEntry("새로운 여정이 시작되었다.");
  resetTransientUI();
  saveGame({ silent: true });
  if (render) {
    renderNode();
  }
}

async function loadData() {
  const [events, items, enemies, nodes, endings] = await Promise.all([
    fetch("data/events.json").then((res) => res.json()),
    fetch("data/items.json").then((res) => res.json()),
    fetch("data/enemies.json").then((res) => res.json()),
    fetch("data/nodes.json").then((res) => res.json()),
    fetch("data/endings.json").then((res) => res.json())
  ]);
  state.data = { events, items, enemies, nodes, endings };
}

function setChoicesDisabled(isDisabled) {
  elements.choices.querySelectorAll("button").forEach((button) => {
    button.disabled = isDisabled;
  });
}

function resetTransientUI() {
  state.isBusy = false;
  if (state.diceTimer) {
    clearInterval(state.diceTimer);
    state.diceTimer = null;
  }
  elements.diceValue.textContent = "--";
  elements.diceLabel.textContent = "주사위 대기";
  setChoicesDisabled(false);
}

function scheduleSave() {
  if (saveDebounceId) return;
  saveDebounceId = setTimeout(() => {
    saveDebounceId = null;
    saveGame({ silent: true });
  }, 120);
}

function handleVisibilityChange() {
  if (document.visibilityState === "hidden") {
    saveGame({ silent: true });
  }
}

function handlePageShow(event) {
  if (event.persisted) {
    loadGame();
    resetTransientUI();
    showToast("복귀 완료", "success");
  }
}

function setupEventListeners() {
  elements.toggleTyping.addEventListener("change", (event) => {
    state.typing = event.target.checked;
  });
  elements.resetButton.addEventListener("click", () => resetGame());
  elements.saveButton.addEventListener("click", () => saveGameWithFeedback());
  window.addEventListener("pageshow", handlePageShow);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", scheduleSave);
}

function init() {
  if (window.__TEXTRPG_INIT_DONE) return;
  window.__TEXTRPG_INIT_DONE = true;
  if (elements.versionLabel) {
    elements.versionLabel.textContent = VERSION;
  }
  setupEventListeners();

  loadData()
    .then(() => {
      loadGame();
    })
    .catch(() => {
      setScene("오류", "데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
      showToast("데이터를 불러오지 못했습니다.", "error");
    });
}

init();

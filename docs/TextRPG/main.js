const VERSION = "v0.1.2";
const AUTOSAVE_KEY = "textrpg-omega-save";
const SLOT_KEYS = ["textrpg_slot_1", "textrpg_slot_2", "textrpg_slot_3"];
const MAX_LOG_ENTRIES = 60;

const state = {
  data: null,
  player: null,
  nodeId: "NODE_PROLOGUE",
  inCombat: false,
  enemy: null,
  typing: false,
  log: [],
  isBusy: false,
  diceTimer: null,
  lastSavedAt: null,
  autoScroll: true,
  lastSummary: "최근 요약: -",
  defeatStreak: 0
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
  autosaveStatus: document.getElementById("autosave-status"),
  slotSelect: document.getElementById("slot-select"),
  slotSaveButton: document.getElementById("btn-slot-save"),
  slotLoadButton: document.getElementById("btn-slot-load"),
  exportButton: document.getElementById("btn-export"),
  importButton: document.getElementById("btn-import"),
  importText: document.getElementById("import-text"),
  importFile: document.getElementById("import-file"),
  toggleAutoscroll: document.getElementById("toggle-autoscroll"),
  logSummary: document.getElementById("log-summary"),
  logScrollBottom: document.getElementById("log-scroll-bottom"),
  combatPanel: document.getElementById("combat-panel"),
  combatEnemyName: document.getElementById("combat-enemy-name"),
  combatEnemyStats: document.getElementById("combat-enemy-stats"),
  combatEnemyStatus: document.getElementById("combat-enemy-status"),
  combatPlayerStats: document.getElementById("combat-player-stats"),
  combatPlayerStatus: document.getElementById("combat-player-status"),
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
    inventory: ["potion_small", "potion_small", "bandage"],
    flags: [],
    counters: { trust: 0, insight: 0 },
    status: []
  };
}

function logEntry(text, options = {}) {
  state.log.push({
    text,
    time: new Date().toLocaleTimeString("ko-KR"),
    highlight: options.highlight ?? false,
    tone: options.tone ?? null,
    badge: options.badge ?? null
  });
  if (state.log.length > MAX_LOG_ENTRIES) {
    state.log = state.log.slice(-MAX_LOG_ENTRIES);
  }
  renderLog();
  if (state.autoScroll) {
    scrollLogToBottom();
  }
}

function renderLog() {
  elements.log.innerHTML = "";
  state.log.forEach((entry) => {
    const line = document.createElement("div");
    const toneClass = entry.tone ? ` log__entry--${entry.tone}` : "";
    line.className = `log__entry${entry.highlight ? " log__entry--highlight" : ""}${toneClass}`;
    const badge = entry.badge ? `<span class="log__badge">${entry.badge}</span>` : "";
    line.innerHTML = `<strong>[${entry.time}]</strong> ${entry.text}${badge}`;
    elements.log.appendChild(line);
  });
  updateLogScrollButton();
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
  updateCombatPanel();
}

function formatStatusList(statusList = []) {
  if (!statusList.length) return "-";
  return statusList
    .map((status) => `${statusCatalog[status.id]?.label ?? status.id}(${status.turns})`)
    .join(", ");
}

function updateCombatPanel() {
  if (!elements.combatPanel) return;
  elements.combatPanel.hidden = !state.inCombat;
  if (!state.inCombat || !state.enemy || !state.player) return;
  const enemy = state.enemy;
  const playerAc = 10 + state.player.stats.DEX + getAcBonus();
  elements.combatEnemyName.textContent = enemy.name;
  elements.combatEnemyStats.textContent = `HP ${enemy.hp}/${enemy.maxHp} · AC ${enemy.ac}`;
  elements.combatEnemyStatus.textContent = `상태: ${formatStatusList(enemy.status)}`;
  elements.combatPlayerStats.textContent = `HP ${state.player.hp}/${state.player.maxHp} · AC ${playerAc}`;
  elements.combatPlayerStatus.textContent = `상태: ${formatStatusList(state.player.status)}`;
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

function setAutosaveStatus(timestamp) {
  if (!elements.autosaveStatus) return;
  if (!timestamp) {
    elements.autosaveStatus.textContent = "자동저장: -";
    return;
  }
  const time = new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
  elements.autosaveStatus.textContent = `자동저장: ${time}`;
}

function setLogSummary(summary) {
  state.lastSummary = summary;
  if (elements.logSummary) {
    elements.logSummary.textContent = `최근 요약: ${summary}`;
  }
}

function scrollLogToBottom() {
  if (!elements.log) return;
  elements.log.scrollTop = elements.log.scrollHeight;
  updateLogScrollButton();
}

function updateLogScrollButton() {
  if (!elements.log || !elements.logScrollBottom) return;
  const nearBottom =
    elements.log.scrollHeight - elements.log.scrollTop - elements.log.clientHeight < 20;
  elements.logScrollBottom.classList.toggle("is-visible", !nearBottom);
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
  elements.diceValue.classList.remove("dice--crit", "dice--fail", "dice--hit");
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

function setDiceTone(tone) {
  elements.diceValue.classList.remove("dice--crit", "dice--fail", "dice--hit");
  if (!tone) return;
  elements.diceValue.classList.add(`dice--${tone}`);
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
      logEntry(`${name}을(를) 획득했다.`, { highlight: true, badge: "획득" });
    }
    if (effect.flag_add) {
      if (!state.player.flags.includes(effect.flag_add)) {
        state.player.flags.push(effect.flag_add);
        logEntry("중요한 변화가 감지되었다.", { highlight: true });
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
      logEntry(
        `${statusCatalog[effect.status_add]?.label ?? "상태 이상"}이(가) 부여되었다.`,
        { highlight: true, badge: "상태" }
      );
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

function isCrisisState() {
  if (!state.player) return false;
  const hpRatio = state.player.maxHp ? state.player.hp / state.player.maxHp : 1;
  return hpRatio <= 0.25 || state.defeatStreak >= 2;
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
    setLogSummary(`이벤트: ${event.title} - ${result.text}`);
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
  const outcomeLabel =
    resultKey === "crit_success"
      ? "대성공"
      : resultKey === "crit_fail"
        ? "대실패"
        : resultKey === "success"
          ? "성공"
          : "실패";
  setScene(event.title, `${result.text} (굴림 ${roll.roll} + ${roll.modifier} = ${roll.total})`);
  logEntry(result.text, {
    highlight: resultKey === "crit_success" || resultKey === "crit_fail",
    tone: resultKey === "crit_fail" ? "fail" : resultKey === "crit_success" ? "crit" : null,
    badge: outcomeLabel
  });
  setLogSummary(`${event.title} 판정 ${outcomeLabel}: ${result.text}`);
  setDiceTone(resultKey === "crit_success" ? "crit" : resultKey === "crit_fail" ? "fail" : "hit");
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

  if (isCrisisState()) {
    choices.push({
      text: "휴식하며 정비한다",
      danger: false,
      onSelect: () => {
        const heal = Math.ceil(state.player.maxHp * 0.3);
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
        state.player.status = [];
        state.defeatStreak = 0;
        logEntry("위기에서 벗어나기 위해 잠시 숨을 고르며 정비했다.", { highlight: true });
        setLogSummary("위기 회복: 휴식으로 체력을 보강했다.");
        saveGame({ silent: true });
        renderNode();
      }
    });
  }

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
    maxHp: enemyTemplate.hp,
    status: [],
    nextNode
  };
  setScene(`전투 - ${enemyTemplate.name}`, `${enemyTemplate.name}과(와) 마주쳤다.`);
  logEntry(`${enemyTemplate.name} 전투 시작.`, { highlight: true, badge: "전투" });
  setLogSummary(`${enemyTemplate.name}과(와) 전투에 돌입했다.`);
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
  if (isCrisisState()) {
    choices.push({ text: "긴급 후퇴", onSelect: () => combatEmergencyRetreat() });
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
    logEntry("공격이 크게 빗나갔다!", { highlight: true, tone: "fail", badge: "대실패" });
    setLogSummary("당신의 공격이 크게 빗나갔다.");
    setDiceTone("fail");
  } else if (isCrit || roll.total >= state.enemy.ac) {
    const baseDamage = weapon.damage + state.player.stats.STR;
    const damage = isCrit ? baseDamage * 2 : baseDamage;
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    logEntry(`공격 성공! ${damage}의 피해를 주었다.`, {
      highlight: isCrit,
      tone: isCrit ? "crit" : null,
      badge: isCrit ? "치명타" : "명중"
    });
    setLogSummary(`당신이 ${state.enemy.name}에게 ${damage}의 피해를 입혔다.`);
    setDiceTone(isCrit ? "crit" : "hit");
  } else {
    logEntry("공격이 빗나갔다.", { badge: "빗나감" });
    setLogSummary("당신의 공격이 빗나갔다.");
    setDiceTone("fail");
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
  setLogSummary("방어 자세로 전환했다.");
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
    logEntry(`${item.name}을 사용해 HP를 회복했다.`, { highlight: true, badge: "회복" });
    setLogSummary(`${item.name}으로 체력을 회복했다.`);
  }
  if (effect.status_remove) {
    state.player.status = state.player.status.filter((status) => !effect.status_remove.includes(status.id));
    logEntry(`${item.name}으로 상태 이상을 해제했다.`, { highlight: true, badge: "정화" });
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
    logEntry("도주에 성공했다!", { highlight: true, badge: "성공" });
    setLogSummary("도주에 성공해 전투를 종료했다.");
    setDiceTone("hit");
    state.inCombat = false;
    if (smokeBomb) {
      state.player.inventory = state.player.inventory.filter((id) => id !== "smoke_bomb");
    }
    renderNode();
    saveGame({ silent: true });
    return;
  }
  logEntry("도주에 실패했다.", { badge: "실패" });
  setLogSummary("도주에 실패해 전투가 이어졌다.");
  setDiceTone("fail");
  await enemyTurn();
}

function combatEmergencyRetreat() {
  if (!state.inCombat) return;
  logEntry("긴급 후퇴를 감행해 전투에서 이탈했다.", { highlight: true, badge: "후퇴" });
  setLogSummary("위기 상황에서 전투를 중단했다.");
  state.inCombat = false;
  state.enemy = null;
  state.player.gold = Math.max(0, state.player.gold - 5);
  updateHud();
  saveGame({ silent: true });
  renderNode();
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
    logEntry(`${enemy.name}의 공격이 빗나갔다.`, { badge: "빗나감" });
    setLogSummary(`${enemy.name}의 공격이 빗나갔다.`);
    setDiceTone("fail");
  } else if (isCrit || roll.total >= playerAc) {
    const baseDamage =
      Math.floor(Math.random() * (enemy.damage.max - enemy.damage.min + 1)) + enemy.damage.min;
    const damage = isCrit ? baseDamage + 4 : baseDamage;
    state.player.hp = Math.max(0, state.player.hp - damage);
    logEntry(`${enemy.name}의 공격! ${damage}의 피해를 입었다.`, {
      highlight: isCrit,
      tone: isCrit ? "fail" : null,
      badge: isCrit ? "치명타" : "명중"
    });
    setLogSummary(`${enemy.name}에게 ${damage}의 피해를 받았다.`);
    setDiceTone(isCrit ? "crit" : "hit");
    if (enemy.status_attack && Math.random() < enemy.status_attack.chance) {
      state.player.status.push({ id: enemy.status_attack.id, turns: enemy.status_attack.turns });
      logEntry(
        `${enemy.name}의 공격으로 ${statusCatalog[enemy.status_attack.id]?.label ?? "상태 이상"} 발생!`,
        { highlight: true, badge: "상태" }
      );
    }
  } else {
    logEntry(`${enemy.name}의 공격을 피했다.`, { badge: "회피" });
    setLogSummary(`${enemy.name}의 공격을 피했다.`);
    setDiceTone("fail");
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
  logEntry(`${enemy.name}을(를) 쓰러뜨렸다.`, { highlight: true, badge: "승리" });
  setLogSummary(`${enemy.name}을(를) 쓰러뜨리고 전투를 마쳤다.`);
  state.player.gold += 10;
  state.player.counters.trust += 1;
  if (Math.random() < 0.4) {
    state.player.inventory.push("potion_small");
    logEntry("전리품으로 물약을 얻었다.", { highlight: true, badge: "획득" });
  }
  state.defeatStreak = 0;
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
  state.defeatStreak += 1;
  setLogSummary("전투에서 패배했다. 새 여정을 선택할 수 있다.");
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

function createSavePayload() {
  return {
    version: VERSION,
    nodeId: state.nodeId,
    player: state.player,
    log: state.log,
    defeatStreak: state.defeatStreak,
    savedAt: new Date().toISOString()
  };
}

function cloneData(data) {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

function saveGame({ silent = true } = {}) {
  const saveData = createSavePayload();
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(saveData));
    state.lastSavedAt = saveData.savedAt;
    setAutosaveStatus(state.lastSavedAt);
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

function getSelectedSlotKey() {
  const slot = elements.slotSelect?.value ?? "1";
  return SLOT_KEYS[Number(slot) - 1] ?? SLOT_KEYS[0];
}

function saveSlot() {
  const key = getSelectedSlotKey();
  const payload = cloneData(createSavePayload());
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    showToast(`슬롯 저장 완료 (${key.replace("textrpg_slot_", "Slot ")})`);
  } catch (error) {
    console.error("Failed to save slot", error);
    showToast("슬롯 저장 실패", "error");
  }
}

function loadSlot() {
  const key = getSelectedSlotKey();
  const raw = localStorage.getItem(key);
  if (!raw) {
    showToast("슬롯에 저장된 데이터가 없습니다.", "error");
    return;
  }
  const data = parseSaveData(raw);
  if (!data || !isValidSaveData(data)) {
    showToast("슬롯 데이터를 읽지 못했습니다.", "error");
    return;
  }
  const ok = window.confirm("현재 진행이 덮어쓰기 됩니다. 불러오시겠습니까?");
  if (!ok) return;
  if (data.version !== VERSION) {
    const proceed = window.confirm(
      `슬롯 버전(${data.version})이 현재 버전(${VERSION})과 다릅니다. 불러오시겠습니까?`
    );
    if (!proceed) return;
  }
  applySaveData(data, { announce: true });
  saveGame({ silent: true });
}

async function exportSave() {
  const payload = cloneData(createSavePayload());
  const json = JSON.stringify(payload, null, 2);
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(json);
      showToast("클립보드에 세이브를 복사했습니다.");
    } catch (error) {
      console.warn("Clipboard copy failed", error);
    }
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `textrpg_save_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("세이브를 내보냈습니다.");
}

function importSave(rawText) {
  const data = parseSaveData(rawText);
  if (!data || !isValidSaveData(data)) {
    showToast("가져오기 실패: JSON 형식을 확인하세요.", "error");
    return;
  }
  if (data.version !== VERSION) {
    const proceed = window.confirm(
      `가져온 버전(${data.version})이 현재 버전(${VERSION})과 다릅니다. 불러오시겠습니까?`
    );
    if (!proceed) return;
  }
  const ok = window.confirm("가져온 세이브를 적용할까요? 현재 진행이 덮어쓰기 됩니다.");
  if (!ok) return;
  applySaveData(data, { announce: true });
  saveGame({ silent: true });
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

function isValidSaveData(data) {
  if (!data || typeof data !== "object") return false;
  if (!data.player || !data.nodeId) return false;
  return true;
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

function applySaveData(data, { announce = false } = {}) {
  state.player = normalizePlayer(data.player);
  state.nodeId = data.nodeId ?? "NODE_PROLOGUE";
  state.log = Array.isArray(data.log) ? data.log : [];
  state.defeatStreak = Number.isFinite(data.defeatStreak) ? data.defeatStreak : 0;
  state.lastSavedAt = data.savedAt ?? null;
  state.inCombat = false;
  state.enemy = null;
  if (announce) {
    setLogSummary("불러오기 완료. 최근 기록을 확인하세요.");
  } else {
    setLogSummary("최근 기록을 확인하세요.");
  }
  resetTransientUI();
  updateHud();
  renderLog();
  renderNode();
  setAutosaveStatus(state.lastSavedAt);
  if (announce) {
    showToast("불러오기 완료");
  }
}

function loadGame() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    resetGame(false);
    return;
  }
  const data = parseSaveData(raw);
  if (!data || !isValidSaveData(data)) {
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
  applySaveData(data);
}

function resetGame(render = true) {
  localStorage.removeItem(AUTOSAVE_KEY);
  state.player = defaultPlayer();
  state.nodeId = "NODE_PROLOGUE";
  state.log = [];
  state.defeatStreak = 0;
  logEntry("새로운 여정이 시작되었다.");
  setLogSummary("새로운 여정이 시작되었다.");
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
  elements.diceValue.classList.remove("dice--crit", "dice--fail", "dice--hit");
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
  elements.slotSaveButton?.addEventListener("click", () => saveSlot());
  elements.slotLoadButton?.addEventListener("click", () => loadSlot());
  elements.exportButton?.addEventListener("click", () => exportSave());
  elements.importButton?.addEventListener("click", () => {
    if (!elements.importText) return;
    const raw = elements.importText.value.trim();
    if (!raw) {
      showToast("가져올 내용을 입력하세요.", "error");
      return;
    }
    importSave(raw);
  });
  elements.importFile?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (elements.importText) {
        elements.importText.value = reader.result?.toString() ?? "";
      }
      showToast("파일을 불러왔습니다. 가져오기를 눌러 적용하세요.");
    };
    reader.readAsText(file);
  });
  elements.toggleAutoscroll?.addEventListener("change", (event) => {
    state.autoScroll = event.target.checked;
    if (state.autoScroll) {
      scrollLogToBottom();
    }
  });
  elements.log?.addEventListener("scroll", () => {
    updateLogScrollButton();
  });
  elements.logScrollBottom?.addEventListener("click", () => {
    scrollLogToBottom();
  });
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
  setLogSummary("준비 중...");
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

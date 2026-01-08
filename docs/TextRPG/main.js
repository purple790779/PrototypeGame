const VERSION = "v0.2.1";
const AUTOSAVE_KEY = "textrpg-omega-save";
const SLOT_KEYS = ["textrpg_slot_1", "textrpg_slot_2", "textrpg_slot_3"];
const MAX_LOG_ENTRIES = 60;
const MAX_COMBAT_LOG = 6;

const state = {
  data: null,
  player: null,
  nodeId: "NODE_PROLOGUE",
  inCombat: false,
  enemy: null,
  pendingCombat: null,
  typing: false,
  log: [],
  combatLog: [],
  isBusy: false,
  diceTimer: null,
  lastSavedAt: null,
  autoScroll: true,
  lastSummary: "최근 요약: -",
  defeatStreak: 0,
  currentChoices: []
};

const elements = {
  sceneTitle: document.getElementById("scene-title"),
  sceneText: document.getElementById("scene-text"),
  diceValue: document.getElementById("dice-value"),
  diceLabel: document.getElementById("dice-label"),
  combatDiceValue: document.getElementById("combat-dice-value"),
  combatDiceLabel: document.getElementById("combat-dice-label"),
  combatDiceBadge: document.getElementById("combat-dice-badge"),
  resumeCombat: document.getElementById("resume-combat"),
  resumeCombatButton: document.getElementById("btn-resume-combat"),
  log: document.getElementById("log"),
  logSummary: document.getElementById("log-summary"),
  logScrollBottom: document.getElementById("log-scroll-bottom"),
  hudHp: document.getElementById("hud-hp"),
  hudMp: document.getElementById("hud-mp"),
  hudGold: document.getElementById("hud-gold"),
  saveButton: document.getElementById("btn-save"),
  autosaveStatus: document.getElementById("autosave-status"),
  statusButton: document.getElementById("btn-status"),
  statusSheet: document.getElementById("status-sheet"),
  closeStatus: document.getElementById("btn-close-status"),
  sheetBackdrop: document.getElementById("sheet-backdrop"),
  statsGrid: document.getElementById("stats-grid"),
  progressTrust: document.getElementById("progress-trust"),
  progressInsight: document.getElementById("progress-insight"),
  statusList: document.getElementById("status-list"),
  inventoryGrid: document.getElementById("inventory-grid"),
  toggleTyping: document.getElementById("toggle-typing"),
  toggleAutoscroll: document.getElementById("toggle-autoscroll"),
  slotSelect: document.getElementById("slot-select"),
  slotSaveButton: document.getElementById("btn-slot-save"),
  slotLoadButton: document.getElementById("btn-slot-load"),
  actionDock: document.getElementById("action-dock"),
  dockMain: document.getElementById("dock-main"),
  dockMore: document.getElementById("dock-more"),
  actionSheet: document.getElementById("action-sheet"),
  actionSheetList: document.getElementById("action-sheet-list"),
  closeActions: document.getElementById("btn-close-actions"),
  itemSheet: document.getElementById("item-sheet"),
  itemSheetTitle: document.getElementById("item-sheet-title"),
  itemSheetGrid: document.getElementById("item-sheet-grid"),
  closeItems: document.getElementById("btn-close-items"),
  tooltip: document.getElementById("tooltip"),
  tooltipContent: document.getElementById("tooltip-content"),
  tooltipActions: document.getElementById("tooltip-actions"),
  combatScene: document.getElementById("combat-scene"),
  combatPlayerName: document.getElementById("combat-player-name"),
  combatPlayerHp: document.getElementById("combat-player-hp"),
  combatEnemyName: document.getElementById("combat-enemy-name"),
  combatEnemyHp: document.getElementById("combat-enemy-hp"),
  combatPlayerStatus: document.getElementById("combat-player-status"),
  combatEnemyStatus: document.getElementById("combat-enemy-status"),
  combatSituation: document.getElementById("combat-situation"),
  combatAdvantage: document.getElementById("combat-advantage"),
  combatAdvantageLabel: document.getElementById("combat-advantage-label"),
  combatMeter: document.getElementById("combat-meter"),
  combatDicePanel: document.getElementById("combat-dice-panel"),
  combatLog: document.getElementById("combat-log"),
  combatDock: document.getElementById("combat-dock"),
  saveToast: document.getElementById("save-toast"),
  versionLabel: document.getElementById("version-label"),
  resetButton: document.getElementById("btn-reset"),
  emergencyResetButton: document.getElementById("btn-emergency-reset")
};

const statusCatalog = {
  bleed: { label: "출혈", damage: 2, icon: "🩸" },
  poison: { label: "중독", damage: 3, icon: "☠️" }
};

const itemIconMap = {
  potion_small: "🧪",
  potion_medium: "🧪",
  antidote: "🧪",
  bandage: "🩹",
  smoke_bomb: "💨",
  rune_shard: "🪨",
  ether_map: "🗺️",
  iron_sword: "⚔️",
  scout_dagger: "🗡️",
  ward_amulet: "🛡️"
};

let saveDebounceId = null;
let toastTimerId = null;

function defaultPlayer() {
  return {
    hp: 42,
    maxHp: 42,
    mp: null,
    maxMp: null,
    stats: { STR: 2, DEX: 2, INT: 1, LUK: 1, CHA: 1, CON: 1 },
    gold: 20,
    inventory: ["potion_small", "potion_small", "bandage"],
    flags: [],
    counters: { trust: 0, insight: 0 },
    status: []
  };
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

function clearTextRpgStorage() {
  const keys = Object.keys(localStorage).filter((key) => key.startsWith("textrpg"));
  keys.forEach((key) => localStorage.removeItem(key));
}

function isCombatSnapshotValid(enemyData) {
  if (!enemyData || typeof enemyData !== "object") return false;
  const enemyId = enemyData.id ?? enemyData.enemyId;
  if (!enemyId) return false;
  const template = state.data?.enemies?.find((item) => item.id === enemyId);
  if (!template) return false;
  const hp = Number(enemyData.hp);
  const maxHp = Number(enemyData.maxHp);
  const ac = Number(enemyData.ac);
  const attack = Number(enemyData.attack);
  const damageMin = Number(enemyData.damage?.min);
  const damageMax = Number(enemyData.damage?.max);
  return (
    Number.isFinite(hp) &&
    Number.isFinite(maxHp) &&
    Number.isFinite(ac) &&
    Number.isFinite(attack) &&
    Number.isFinite(damageMin) &&
    Number.isFinite(damageMax)
  );
}

function recoverFromInvalidCombat({ announce = true } = {}) {
  state.inCombat = false;
  state.enemy = null;
  state.pendingCombat = null;
  state.isBusy = false;
  setChoicesDisabled(false);
  resetTransientUI();
  if (announce) {
    const message = "저장 데이터가 이전 버전과 달라 전투를 종료하고 탐험으로 복귀했습니다.";
    logEntry(message, { highlight: true, badge: "복구" });
    setLogSummary(message);
    showToast("전투 상태를 복구했습니다.", "success");
  }
  if (state.player) {
    saveGame({ silent: true });
  }
}

function validateStateAfterLoad() {
  if (state.inCombat && !isCombatSnapshotValid(state.enemy)) {
    recoverFromInvalidCombat();
    return true;
  }
  if (state.pendingCombat && !isCombatSnapshotValid(state.pendingCombat)) {
    recoverFromInvalidCombat();
    return true;
  }
  return false;
}

function logEntry(text, options = {}) {
  const entry = {
    text,
    time: new Date().toLocaleTimeString("ko-KR"),
    highlight: options.highlight ?? false,
    tone: options.tone ?? null,
    badge: options.badge ?? null
  };
  state.log.push(entry);
  if (state.log.length > MAX_LOG_ENTRIES) {
    state.log = state.log.slice(-MAX_LOG_ENTRIES);
  }
  if (state.inCombat) {
    state.combatLog.push(entry);
    if (state.combatLog.length > MAX_COMBAT_LOG) {
      state.combatLog = state.combatLog.slice(-MAX_COMBAT_LOG);
    }
    renderCombatLog();
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

function renderCombatLog() {
  if (!elements.combatLog) return;
  elements.combatLog.innerHTML = "";
  state.combatLog.forEach((entry) => {
    const line = document.createElement("div");
    line.textContent = `[${entry.time}] ${entry.text}`;
    elements.combatLog.appendChild(line);
  });
}

function setLogSummary(summary) {
  state.lastSummary = summary;
  if (elements.logSummary) {
    elements.logSummary.textContent = `최근 요약: ${summary}`;
  }
}

function getItemById(id) {
  return state.data?.items?.find((item) => item.id === id) ?? null;
}

function getItemIcon(item) {
  if (!item) return "❓";
  return item.icon ?? itemIconMap[item.id] ?? iconByType(item.type);
}

function iconByType(type) {
  if (type === "weapon") return "⚔️";
  if (type === "artifact") return "📜";
  if (type === "tool") return "🧰";
  return "🧪";
}

function getItemUseKind(item) {
  if (!item?.effect) return null;
  if (item.effect.hp) return "heal";
  if (item.effect.status_remove) return "cure";
  if (item.effect.buff) return "buff";
  return null;
}

function updateHud() {
  if (!state.player) return;
  const { player } = state;
  elements.hudHp.querySelector(".stat-pill__value").textContent = `${player.hp}/${player.maxHp}`;
  elements.hudGold.querySelector(".stat-pill__value").textContent = `${player.gold}`;
  if (player.maxMp && player.mp !== null) {
    elements.hudMp.hidden = false;
    elements.hudMp.querySelector(".stat-pill__value").textContent = `${player.mp}/${player.maxMp}`;
  } else {
    elements.hudMp.hidden = true;
  }
  renderStatusSheet();
  renderCombatScene();
}

function renderStatusSheet() {
  if (!state.player) return;
  const { player } = state;
  const stats = ["STR", "DEX", "INT", "LUK", "CHA", "CON"]
    .filter((stat) => Number.isFinite(player.stats[stat]))
    .map((stat) => ({ label: stat, value: player.stats[stat] }));
  elements.statsGrid.innerHTML = "";
  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<span>${stat.label}</span><strong>${stat.value}</strong>`;
    elements.statsGrid.appendChild(card);
  });
  elements.progressTrust.textContent = player.counters.trust;
  elements.progressInsight.textContent = player.counters.insight;
  renderStatusList(player.status, elements.statusList);
  renderInventoryGrid(elements.inventoryGrid, player.inventory, { context: "explore" });
}

function renderStatusList(statusList, container) {
  container.innerHTML = "";
  if (!statusList.length) {
    const empty = document.createElement("div");
    empty.className = "status-pill";
    empty.textContent = "현재 상태 이상이 없습니다.";
    container.appendChild(empty);
    return;
  }
  statusList.forEach((status) => {
    const meta = statusCatalog[status.id] ?? { label: status.id, icon: "✨" };
    const pill = document.createElement("div");
    pill.className = "status-pill";
    pill.innerHTML = `<span>${meta.icon}</span><span>${meta.label}</span><strong>${status.turns}턴</strong>`;
    container.appendChild(pill);
  });
}

function renderInventoryGrid(container, inventoryIds, { context } = {}) {
  container.innerHTML = "";
  if (!inventoryIds.length) {
    const empty = document.createElement("div");
    empty.className = "status-pill";
    empty.textContent = "비어 있음";
    container.appendChild(empty);
    return;
  }
  inventoryIds.forEach((id) => {
    const item = getItemById(id);
    if (!item) return;
    const useKind = getItemUseKind(item);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "inventory-item";
    card.innerHTML = `
      <span class="inventory-item__icon" aria-hidden="true">${getItemIcon(item)}</span>
      <span class="inventory-item__name">${item.name}</span>
      <span class="inventory-item__badge">${useKind ? "사용" : item.type}</span>
    `;
    card.setAttribute("aria-label", item.name);
    card.addEventListener("click", (event) => {
      const actions = [];
      if (useKind) {
        actions.push({
          label: context === "combat" ? "전투 사용" : "사용",
          onClick: async () => {
            hideTooltip();
            await useItem(item, { context });
          }
        });
      }
      actions.push({ label: "닫기", onClick: () => hideTooltip() });
      showTooltip(event.currentTarget, `${item.description ?? "설명 없음"}`, actions);
    });
    container.appendChild(card);
  });
}

function showTooltip(target, content, actions) {
  elements.tooltipContent.textContent = content;
  elements.tooltipActions.innerHTML = "";
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      void action.onClick();
    });
    elements.tooltipActions.appendChild(button);
  });
  elements.tooltip.hidden = false;
  positionTooltip(target);
  elements.tooltip.focus?.();
}

function positionTooltip(target) {
  const rect = target.getBoundingClientRect();
  const tooltipRect = elements.tooltip.getBoundingClientRect();
  let top = rect.top - tooltipRect.height - 12;
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  if (top < 8) {
    top = rect.bottom + 12;
  }
  if (left < 8) {
    left = 8;
  }
  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  if (top + tooltipRect.height > window.innerHeight - 8) {
    top = window.innerHeight - tooltipRect.height - 8;
  }
  elements.tooltip.style.top = `${top}px`;
  elements.tooltip.style.left = `${left}px`;
}

function hideTooltip() {
  elements.tooltip.hidden = true;
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

function getDiceElements() {
  if (state.inCombat) {
    return { value: elements.combatDiceValue, label: elements.combatDiceLabel };
  }
  return { value: elements.diceValue, label: elements.diceLabel };
}

function animateDice(finalValue, label = "주사위") {
  const { value, label: labelEl } = getDiceElements();
  labelEl.textContent = label;
  value.classList.remove("dice--crit", "dice--fail", "dice--hit");
  return new Promise((resolve) => {
    let count = 0;
    if (state.diceTimer) {
      clearInterval(state.diceTimer);
    }
    const timer = setInterval(() => {
      value.textContent = Math.floor(Math.random() * 20) + 1;
      count += 1;
      if (count > 8) {
        clearInterval(timer);
        state.diceTimer = null;
        value.textContent = finalValue;
        resolve();
      }
    }, 60);
    state.diceTimer = timer;
  });
}

function setDiceTone(tone, badge = "-") {
  const { value } = getDiceElements();
  value.classList.remove("dice--crit", "dice--fail", "dice--hit");
  if (tone) {
    value.classList.add(`dice--${tone}`);
  }
  if (elements.combatDiceBadge) {
    elements.combatDiceBadge.textContent = badge;
  }
}

async function rollD20(modifier, label) {
  const roll = Math.floor(Math.random() * 20) + 1;
  await animateDice(roll, label);
  const total = roll + modifier;
  return { roll, total, modifier };
}

function updateLogScrollButton() {
  if (!elements.log || !elements.logScrollBottom) return;
  const nearBottom =
    elements.log.scrollHeight - elements.log.scrollTop - elements.log.clientHeight < 20;
  elements.logScrollBottom.classList.toggle("is-visible", !nearBottom);
}

function scrollLogToBottom() {
  if (!elements.log) return;
  elements.log.scrollTop = elements.log.scrollHeight;
  updateLogScrollButton();
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

function setChoicesDisabled(isDisabled) {
  const buttons = document.querySelectorAll("button");
  buttons.forEach((button) => {
    if (button.closest(".dock") || button.closest(".combat-dock")) {
      button.disabled = isDisabled;
    }
  });
}

function renderActionDock(choiceList) {
  state.currentChoices = choiceList;
  elements.dockMain.innerHTML = "";
  const maxPrimary = 4;
  const primary = choiceList.slice(0, maxPrimary);
  const overflow = choiceList.slice(maxPrimary);
  primary.forEach((choice) => {
    const button = document.createElement("button");
    button.textContent = choice.text;
    button.disabled = state.isBusy;
    if (choice.danger) {
      button.style.color = "var(--danger)";
    }
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
    elements.dockMain.appendChild(button);
  });
  if (overflow.length) {
    elements.dockMore.hidden = false;
    elements.dockMore.onclick = () => openActionSheet(overflow);
  } else {
    elements.dockMore.hidden = true;
  }
}

function openActionSheet(choiceList) {
  elements.actionSheetList.innerHTML = "";
  choiceList.forEach((choice) => {
    const button = document.createElement("button");
    button.textContent = choice.text;
    button.disabled = state.isBusy;
    button.addEventListener("click", async () => {
      closeSheet(elements.actionSheet);
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
    elements.actionSheetList.appendChild(button);
  });
  openSheet(elements.actionSheet);
}

function renderCombatDock() {
  if (!elements.combatDock) return;
  elements.combatDock.innerHTML = "";
  if (!state.inCombat || !state.player || !isCombatSnapshotValid(state.enemy)) {
    const button = document.createElement("button");
    button.textContent = "탐험으로 복귀";
    button.addEventListener("click", () => {
      recoverFromInvalidCombat();
      renderNode();
      renderCombatScene();
    });
    elements.combatDock.appendChild(button);
    return;
  }
  const buttons = [
    { label: "공격", action: () => combatPlayerAttack() },
    { label: "방어", action: () => combatDefend() },
    { label: "아이템", action: () => openItemSheet("combat") },
    { label: "후퇴", action: () => combatEscape() }
  ];
  buttons.forEach((btn) => {
    const button = document.createElement("button");
    button.textContent = btn.label;
    button.disabled = state.isBusy;
    button.addEventListener("click", async () => {
      if (state.isBusy) return;
      state.isBusy = true;
      setChoicesDisabled(true);
      try {
        await Promise.resolve(btn.action());
      } finally {
        state.isBusy = false;
        setChoicesDisabled(false);
      }
    });
    elements.combatDock.appendChild(button);
  });
}

function openItemSheet(context) {
  const inventoryIds = state.player.inventory;
  elements.itemSheetTitle.textContent = context === "combat" ? "전투 아이템" : "아이템";
  renderInventoryGrid(elements.itemSheetGrid, inventoryIds, { context });
  openSheet(elements.itemSheet);
}

function openSheet(sheet) {
  sheet.hidden = false;
  elements.sheetBackdrop.hidden = false;
}

function closeSheet(sheet) {
  sheet.hidden = true;
  if (
    elements.statusSheet.hidden &&
    elements.actionSheet.hidden &&
    elements.itemSheet.hidden
  ) {
    elements.sheetBackdrop.hidden = true;
  }
}

function getWeaponBonus() {
  const weaponItems = state.player.inventory
    .map((id) => getItemById(id))
    .filter((item) => item && item.type === "weapon");
  if (!weaponItems.length) {
    return { toHit: 0, damage: 1 };
  }
  const best = weaponItems.sort((a, b) => (b.bonus?.damage ?? 0) - (a.bonus?.damage ?? 0))[0];
  return { toHit: best.bonus?.to_hit ?? 0, damage: best.bonus?.damage ?? 1 };
}

function getAcBonus() {
  const amulets = state.player.inventory
    .map((id) => getItemById(id))
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
      const name = getItemById(effect.item)?.name ?? effect.item;
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
    await animateDice("⚔️", "전투");
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
  setDiceTone(resultKey === "crit_success" ? "crit" : resultKey === "crit_fail" ? "fail" : "hit", outcomeLabel);
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

  renderActionDock(choices);
  updateHud();
  renderResumeCombat();
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
  state.pendingCombat = null;
  state.combatLog = [];
  setScene(`전투 - ${enemyTemplate.name}`, `${enemyTemplate.name}과(와) 마주쳤다.`);
  logEntry(`${enemyTemplate.name} 전투 시작.`, { highlight: true, badge: "전투" });
  setLogSummary(`${enemyTemplate.name}과(와) 전투에 돌입했다.`);
  renderCombatScene();
  renderCombatDock();
  updateHud();
}

function resumeCombat() {
  if (!state.pendingCombat) return;
  if (!isCombatSnapshotValid(state.pendingCombat)) {
    recoverFromInvalidCombat();
    renderNode();
    renderResumeCombat();
    return;
  }
  state.inCombat = true;
  state.enemy = state.pendingCombat;
  state.pendingCombat = null;
  state.combatLog = [];
  setScene(`전투 - ${state.enemy.name}`, "전투를 재개한다.");
  logEntry(`${state.enemy.name} 전투를 재개했다.`, { highlight: true, badge: "전투" });
  renderCombatScene();
  renderCombatDock();
  updateHud();
  renderResumeCombat();
}

function renderResumeCombat() {
  if (!elements.resumeCombat) return;
  elements.resumeCombat.hidden = !state.pendingCombat;
}

function calcAdvantage() {
  if (!state.enemy || !state.player) return 50;
  const weapon = getWeaponBonus();
  const playerDpr = (weapon.damage + state.player.stats.STR) * 0.6;
  const enemyAvg = (state.enemy.damage.min + state.enemy.damage.max) / 2;
  const enemyDpr = enemyAvg * 0.55;
  const hpRatio = state.player.hp / state.player.maxHp;
  const enemyHpRatio = state.enemy.hp / state.enemy.maxHp;
  const raw = (playerDpr / Math.max(1, enemyDpr)) * 50 + (hpRatio - enemyHpRatio) * 50;
  return Math.max(0, Math.min(100, Math.round(raw + 50)));
}

function renderCombatScene() {
  if (!elements.combatScene) return;
  elements.combatScene.hidden = !state.inCombat;
  if (!state.inCombat) return;
  const isValidCombat = Boolean(state.player) && isCombatSnapshotValid(state.enemy);
  if (elements.combatDicePanel) {
    elements.combatDicePanel.hidden = !isValidCombat;
  }
  if (elements.combatMeter) {
    elements.combatMeter.hidden = !isValidCombat;
  }
  if (!isValidCombat) {
    elements.combatPlayerName.textContent = "모험가";
    elements.combatEnemyName.textContent = "-";
    elements.combatPlayerHp.style.width = "0%";
    elements.combatEnemyHp.style.width = "0%";
    elements.combatPlayerStatus.textContent = "상태 없음";
    elements.combatEnemyStatus.textContent = "상태 없음";
    elements.combatSituation.textContent = "전투 데이터를 불러올 수 없습니다.";
    elements.combatAdvantage.style.width = "0%";
    elements.combatAdvantageLabel.textContent = "-";
    if (elements.combatLog) {
      elements.combatLog.innerHTML = "";
    }
    renderCombatDock();
    return;
  }
  const enemy = state.enemy;
  const player = state.player;
  elements.combatPlayerName.textContent = "모험가";
  elements.combatEnemyName.textContent = enemy.name;
  const playerRatio = (player.hp / player.maxHp) * 100;
  const enemyRatio = (enemy.hp / enemy.maxHp) * 100;
  elements.combatPlayerHp.style.width = `${playerRatio}%`;
  elements.combatEnemyHp.style.width = `${enemyRatio}%`;
  elements.combatPlayerStatus.innerHTML = renderStatusIcons(player.status);
  elements.combatEnemyStatus.innerHTML = renderStatusIcons(enemy.status);
  elements.combatSituation.textContent = `${enemy.name}과 치열하게 맞서고 있다.`;
  const advantage = calcAdvantage();
  elements.combatAdvantage.style.width = `${advantage}%`;
  elements.combatAdvantageLabel.textContent = `${advantage}%`;
  renderCombatLog();
}

function renderStatusIcons(statuses = []) {
  if (!statuses.length) return "상태 없음";
  return statuses
    .map((status) => {
      const meta = statusCatalog[status.id] ?? { label: status.id, icon: "✨" };
      return `<span>${meta.icon}${meta.label}(${status.turns})</span>`;
    })
    .join(" ");
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
    setDiceTone("fail", "대실패");
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
    setDiceTone(isCrit ? "crit" : "hit", isCrit ? "치명타" : "명중");
  } else {
    logEntry("공격이 빗나갔다.", { badge: "빗나감" });
    setLogSummary("당신의 공격이 빗나갔다.");
    setDiceTone("fail", "빗나감");
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

async function useItem(item, { context }) {
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
  if (effect.buff) {
    state.player.status.push({ id: effect.buff.id ?? "buff", turns: effect.buff.turns ?? 2 });
    logEntry(`${item.name}으로 잠시 힘이 솟는다.`, { highlight: true, badge: "강화" });
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
  if (context === "combat") {
    state.isBusy = true;
    setChoicesDisabled(true);
    await enemyTurn();
    state.isBusy = false;
    setChoicesDisabled(false);
  }
}

async function combatEscape() {
  const smokeBomb = state.player.inventory.includes("smoke_bomb");
  const bonus = smokeBomb ? 3 : 0;
  const roll = await rollD20(state.player.stats.DEX + bonus, "후퇴 판정");
  if (roll.roll === 20 || roll.total >= 14) {
    logEntry("후퇴에 성공했다!", { highlight: true, badge: "성공" });
    setLogSummary("후퇴에 성공해 전투를 종료했다.");
    setDiceTone("hit", "후퇴" );
    state.inCombat = false;
    if (smokeBomb) {
      state.player.inventory = state.player.inventory.filter((id) => id !== "smoke_bomb");
    }
    state.player.gold = Math.max(0, state.player.gold - 3);
    renderCombatScene();
    renderNode();
    saveGame({ silent: true });
    return;
  }
  logEntry("후퇴에 실패했다.", { badge: "실패" });
  setLogSummary("후퇴에 실패해 전투가 이어졌다.");
  setDiceTone("fail", "실패");
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
    logEntry(`${enemy.name}의 공격이 빗나갔다.`, { badge: "빗나감" });
    setLogSummary(`${enemy.name}의 공격이 빗나갔다.`);
    setDiceTone("fail", "빗나감");
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
    setDiceTone(isCrit ? "crit" : "hit", isCrit ? "치명타" : "명중");
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
    setDiceTone("fail", "회피");
  }

  updateHud();
  if (state.player.hp <= 0) {
    handleDefeat();
    return;
  }
  renderCombatDock();
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
  renderActionDock([
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
    inCombat: state.inCombat,
    enemy: state.enemy,
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
      showToast("저장 완료");
    }
    return true;
  } catch (error) {
    console.error("Failed to save game", error);
    if (!silent) {
      showToast("저장 실패(저장공간/권한 확인)", "error");
    }
    return false;
  }
}

function saveGameWithFeedback() {
  saveGame({ silent: false });
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

function applySaveData(data, { announce = false } = {}) {
  state.player = normalizePlayer(data.player);
  state.nodeId = data.nodeId ?? "NODE_PROLOGUE";
  state.log = Array.isArray(data.log) ? data.log : [];
  state.defeatStreak = Number.isFinite(data.defeatStreak) ? data.defeatStreak : 0;
  state.lastSavedAt = data.savedAt ?? null;
  state.inCombat = false;
  state.enemy = null;
  state.pendingCombat = data.inCombat && data.enemy ? data.enemy : null;
  if (announce) {
    setLogSummary("불러오기 완료. 최근 기록을 확인하세요.");
  } else {
    setLogSummary("최근 기록을 확인하세요.");
  }
  validateStateAfterLoad();
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

function resetGame(render = true, { clearStorage = false } = {}) {
  if (clearStorage) {
    clearTextRpgStorage();
  } else {
    localStorage.removeItem(AUTOSAVE_KEY);
  }
  state.player = defaultPlayer();
  state.nodeId = "NODE_PROLOGUE";
  state.log = [];
  state.defeatStreak = 0;
  state.inCombat = false;
  state.enemy = null;
  state.pendingCombat = null;
  logEntry("새로운 여정이 시작되었다.");
  setLogSummary("새로운 여정이 시작되었다.");
  resetTransientUI();
  saveGame({ silent: true });
  if (render) {
    renderNode();
  }
}

function runEmergencyReset({ confirm = true } = {}) {
  if (confirm) {
    const ok = window.confirm("모든 저장 데이터를 삭제하고 새 여정을 시작할까요?");
    if (!ok) return;
  }
  resetGame(true, { clearStorage: true });
  showToast("긴급 초기화 완료", "success");
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

function resetTransientUI() {
  state.isBusy = false;
  if (state.diceTimer) {
    clearInterval(state.diceTimer);
    state.diceTimer = null;
  }
  elements.diceValue.textContent = "--";
  elements.diceLabel.textContent = "주사위 대기";
  elements.combatDiceValue.textContent = "--";
  elements.combatDiceLabel.textContent = "전투 판정";
  elements.combatDiceBadge.textContent = "-";
  elements.diceValue.classList.remove("dice--crit", "dice--fail", "dice--hit");
  elements.combatDiceValue.classList.remove("dice--crit", "dice--fail", "dice--hit");
  hideTooltip();
  closeSheet(elements.statusSheet);
  closeSheet(elements.actionSheet);
  closeSheet(elements.itemSheet);
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

function handleTabSwitch(event) {
  const tab = event.target.closest(".sheet__tab");
  if (!tab) return;
  const key = tab.dataset.tab;
  document.querySelectorAll(".sheet__tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === key);
  });
  document.querySelectorAll(".sheet__panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === key);
  });
}

function setupEventListeners() {
  elements.toggleTyping.addEventListener("change", (event) => {
    state.typing = event.target.checked;
  });
  elements.toggleAutoscroll?.addEventListener("change", (event) => {
    state.autoScroll = event.target.checked;
    if (state.autoScroll) {
      scrollLogToBottom();
    }
  });
  elements.resetButton.addEventListener("click", () => resetGame());
  elements.emergencyResetButton?.addEventListener("click", () => runEmergencyReset());
  elements.saveButton.addEventListener("click", () => saveGameWithFeedback());
  elements.slotSaveButton?.addEventListener("click", () => saveSlot());
  elements.slotLoadButton?.addEventListener("click", () => loadSlot());
  elements.statusButton?.addEventListener("click", () => openSheet(elements.statusSheet));
  elements.closeStatus?.addEventListener("click", () => closeSheet(elements.statusSheet));
  elements.closeActions?.addEventListener("click", () => closeSheet(elements.actionSheet));
  elements.closeItems?.addEventListener("click", () => closeSheet(elements.itemSheet));
  elements.sheetBackdrop?.addEventListener("click", () => {
    closeSheet(elements.statusSheet);
    closeSheet(elements.actionSheet);
    closeSheet(elements.itemSheet);
  });
  elements.statusSheet?.addEventListener("click", handleTabSwitch);
  elements.itemSheet?.addEventListener("click", handleTabSwitch);
  elements.log?.addEventListener("scroll", () => {
    updateLogScrollButton();
  });
  elements.logScrollBottom?.addEventListener("click", () => {
    scrollLogToBottom();
  });
  elements.resumeCombatButton?.addEventListener("click", () => {
    resumeCombat();
  });
  document.addEventListener("click", (event) => {
    if (elements.tooltip.hidden) return;
    if (event.target.closest(".tooltip") || event.target.closest(".inventory-item")) return;
    hideTooltip();
  });
  window.addEventListener("pageshow", handlePageShow);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", scheduleSave);
}

function init() {
  if (window.__TEXTRPG_INIT_DONE) return;
  window.__TEXTRPG_INIT_DONE = true;
  const resetParam = new URLSearchParams(window.location.search).get("reset");
  const shouldReset = resetParam === "1" || resetParam === "true";
  if (elements.versionLabel) {
    elements.versionLabel.textContent = VERSION;
  }
  setLogSummary("준비 중...");
  setupEventListeners();

  loadData()
    .then(() => {
      if (shouldReset) {
        runEmergencyReset({ confirm: false });
        return;
      }
      loadGame();
    })
    .catch(() => {
      setScene("오류", "데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.");
      showToast("데이터를 불러오지 못했습니다.", "error");
    });
}

init();

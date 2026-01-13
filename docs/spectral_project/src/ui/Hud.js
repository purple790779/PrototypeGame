const DEFAULT_DEBUG = 'loading...';

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const buildFormationRow = (formation) => {
  const row = document.createElement('div');
  row.className = 'formation-card';
  row.innerHTML = `
    <div>
      <div class="formation-name">${formation.name}</div>
      <div class="formation-meta">${formation.alive}/${formation.initial} 병력</div>
    </div>
    <div class="formation-status">${formation.status || 'READY'}</div>
  `;
  return row;
};

export function initHud({ onToggleBattle } = {}) {
  const allyList = document.getElementById('ally-formations');
  const enemyList = document.getElementById('enemy-formations');
  const startBtn = document.getElementById('start-btn');
  const debugEl = document.getElementById('debug');

  const allyHpFill = document.getElementById('ally-hp-fill');
  const enemyHpFill = document.getElementById('enemy-hp-fill');
  const allyHpPercent = document.getElementById('ally-hp-percent');
  const enemyHpPercent = document.getElementById('enemy-hp-percent');
  const allyHpCount = document.getElementById('ally-hp-count');
  const enemyHpCount = document.getElementById('enemy-hp-count');
  const allyHpStatus = document.getElementById('ally-hp-status');
  const enemyHpStatus = document.getElementById('enemy-hp-status');

  if (!allyList || !enemyList) {
    throw new Error('HUD 부대 리스트를 찾지 못했습니다.');
  }
  if (!startBtn) {
    throw new Error('#start-btn을 찾지 못했습니다.');
  }
  if (debugEl && !debugEl.textContent) {
    debugEl.textContent = DEFAULT_DEBUG;
  }

  startBtn.addEventListener('click', () => {
    if (onToggleBattle) onToggleBattle();
  });

  const setDebug = (text) => {
    if (debugEl) debugEl.textContent = text;
  };

  const setBattleButton = (isRunning) => {
    startBtn.textContent = isRunning ? '일시정지 (Pause)' : '전투 시작 (Battle Start)';
  };

  const updateFormationList = (container, formations) => {
    container.innerHTML = '';
    formations.forEach((formation) => {
      container.appendChild(buildFormationRow(formation));
    });
  };

  const updateHpPanel = (data, elements) => {
    const percent = clampPercent(data.percent);
    elements.fill.style.width = `${percent}%`;
    elements.percent.textContent = `${percent}%`;
    elements.count.textContent = `${data.alive}/${data.initial}`;
    elements.status.textContent = percent === 0 ? 'DOWN' : 'ENGAGED';
  };

  const updateStats = (stats) => {
    if (!stats) return;

    updateFormationList(allyList, stats.ally.formations);
    updateFormationList(enemyList, stats.enemy.formations);

    updateHpPanel(stats.ally, {
      fill: allyHpFill,
      percent: allyHpPercent,
      count: allyHpCount,
      status: allyHpStatus,
    });

    updateHpPanel(stats.enemy, {
      fill: enemyHpFill,
      percent: enemyHpPercent,
      count: enemyHpCount,
      status: enemyHpStatus,
    });
  };

  return { setDebug, setBattleButton, updateStats };
}

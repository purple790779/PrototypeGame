const LEFT_BOXES = [
  { id: 'commander', side: 'left', label: '지휘관' },
  { id: 'unit-group-1', side: 'left', label: '부대 1' },
  { id: 'unit-group-2', side: 'left', label: '부대 2' },
];

const RIGHT_BOXES = [
  { id: 'enemy-commander', side: 'right', label: '적 지휘관' },
  { id: 'enemy-unit-group-1', side: 'right', label: '적 부대 1' },
  { id: 'enemy-unit-group-2', side: 'right', label: '적 부대 2' },
];

const DEFAULT_DEBUG = 'loading...';

export function initHud({ onToggleBattle, onSelectBox } = {}) {
  const leftStack = document.getElementById('left-stack');
  const rightStack = document.getElementById('right-stack');
  const startBtn = document.getElementById('start-btn');
  const debugEl = document.getElementById('debug');

  if (!leftStack || !rightStack) {
    throw new Error('HUD 패널을 찾지 못했습니다.');
  }
  if (!startBtn) {
    throw new Error('#start-btn을 찾지 못했습니다.');
  }
  if (debugEl && !debugEl.textContent) {
    debugEl.textContent = DEFAULT_DEBUG;
  }

  const buildCard = (data) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-card';
    button.dataset.id = data.id;
    button.dataset.side = data.side;
    button.textContent = data.label;
    button.addEventListener('click', () => {
      const selected = button.classList.toggle('is-selected');
      if (onSelectBox) {
        onSelectBox({ ...data, selected });
      }
    });
    return button;
  };

  LEFT_BOXES.forEach((data) => leftStack.appendChild(buildCard(data)));
  RIGHT_BOXES.forEach((data) => rightStack.appendChild(buildCard(data)));

  startBtn.addEventListener('click', () => {
    if (onToggleBattle) onToggleBattle();
  });

  const setDebug = (text) => {
    if (debugEl) debugEl.textContent = text;
  };

  const setBattleButton = (isRunning) => {
    startBtn.textContent = isRunning ? '일시정지 (Pause)' : '전투 시작 (Battle Start)';
  };

  return { setDebug, setBattleButton };
}

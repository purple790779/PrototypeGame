const startButton = document.querySelector('[data-action="start"]');
const pauseButton = document.querySelector('[data-action="pause"]');
const eventButton = document.querySelector('[data-action="event"]');
const logContainer = document.querySelector('#status-log');

const metrics = {
  morale: document.querySelector('[data-metric="morale"]'),
  defense: document.querySelector('[data-metric="defense"]'),
  food: document.querySelector('[data-metric="food"]'),
  population: document.querySelector('[data-metric="population"]'),
};

const state = {
  running: false,
  lastFrame: 0,
  morale: 60,
  defense: 40,
  food: 120,
  population: 42,
  tick: 0,
  lastLogAt: 0,
  config: null,
};

const log = (message) => {
  const line = document.createElement('p');
  line.textContent = message;
  logContainer.prepend(line);
  if (logContainer.childElementCount > 8) {
    logContainer.removeChild(logContainer.lastChild);
  }
};

const syncMetrics = () => {
  metrics.morale.textContent = `${Math.round(state.morale)}%`;
  metrics.defense.textContent = `${Math.round(state.defense)}%`;
  metrics.food.textContent = `${Math.round(state.food)} 단위`;
  metrics.population.textContent = `${Math.round(state.population)} 명`;
};

const applyTick = (deltaSeconds) => {
  state.tick += deltaSeconds;
  state.food += state.config.foodGain * deltaSeconds;
  state.population += state.config.populationGain * deltaSeconds;
  state.morale += state.config.moraleGain * deltaSeconds;
  state.defense += state.config.defenseGain * deltaSeconds;

  state.food = Math.min(Math.max(state.food, 0), 200);
  state.population = Math.min(Math.max(state.population, 0), 150);
  state.morale = Math.min(Math.max(state.morale, 0), 100);
  state.defense = Math.min(Math.max(state.defense, 0), 100);
};

const loop = (timestamp) => {
  if (!state.running) {
    return;
  }
  if (!state.lastFrame) {
    state.lastFrame = timestamp;
  }
  const deltaSeconds = (timestamp - state.lastFrame) / 1000;
  state.lastFrame = timestamp;

  applyTick(deltaSeconds);
  syncMetrics();

  const elapsedSeconds = Math.floor(state.tick);
  if (elapsedSeconds !== 0 && elapsedSeconds % 6 === 0 && elapsedSeconds !== state.lastLogAt) {
    state.lastLogAt = elapsedSeconds;
    log(`⏱️ ${elapsedSeconds}초 경과: 마을이 안정적으로 성장 중입니다.`);
  }

  requestAnimationFrame(loop);
};

const startSimulation = () => {
  if (state.running) return;
  state.running = true;
  state.lastFrame = 0;
  log('▶️ 시뮬레이션이 시작되었습니다.');
  startButton.disabled = true;
  pauseButton.disabled = false;
  requestAnimationFrame(loop);
};

const pauseSimulation = () => {
  if (!state.running) return;
  state.running = false;
  startButton.disabled = false;
  pauseButton.disabled = true;
  log('⏸️ 시뮬레이션이 일시정지되었습니다.');
};

const triggerEvent = () => {
  state.morale = Math.min(state.morale + 5, 100);
  state.defense = Math.min(state.defense + 7, 100);
  state.food = Math.max(state.food - 10, 0);
  log('🛡️ 성벽을 보강해 사기가 상승했습니다.');
  syncMetrics();
};

const init = async () => {
  try {
    const response = await fetch('./data/config.json');
    if (!response.ok) {
      throw new Error('config load failed');
    }
    state.config = await response.json();
  } catch (error) {
    state.config = {
      foodGain: 0.6,
      populationGain: 0.15,
      moraleGain: 0.08,
      defenseGain: 0.05,
    };
    log('⚠️ 설정 파일을 불러오지 못해 기본값으로 시작합니다.');
  }

  syncMetrics();
  log('준비 완료: 시작 버튼을 눌러 Castle_Simul을 실행하세요.');
};

startButton.addEventListener('click', startSimulation);
pauseButton.addEventListener('click', pauseSimulation);
eventButton.addEventListener('click', triggerEvent);

init();

import { SceneSetup } from './core/SceneSetup.js';
import { RenderSystem } from './core/RenderSystem.js';
import { initHud } from './ui/Hud.js';

const debugEl = document.getElementById('debug');
const fallbackSetDebug = (msg) => {
  if (debugEl) debugEl.textContent = msg;
};

try {
  const container = document.getElementById('app');
  if (!container) throw new Error('#app 컨테이너를 찾지 못했습니다.');

  const status = {
    system: 'main.js loaded ✅\nscene init...',
    selection: '',
  };
  const formatDebug = () => [status.system, status.selection].filter(Boolean).join('\n');
  let setDebug = fallbackSetDebug;

  setDebug(formatDebug());

  const sceneSetup = new SceneSetup(container);
  const renderSystem = new RenderSystem(sceneSetup.scene, sceneSetup.camera, sceneSetup.renderer);

  const hud = initHud({
    onToggleBattle: () => {
      if (renderSystem.isBattleOver()) {
        renderSystem.resetBattle();
        renderSystem.startBattle();
        hud.setBattleButton('running');
        hud.setBanner('');
        return;
      }
      if (renderSystem.running) {
        renderSystem.pauseBattle();
        hud.setBattleButton('paused');
        return;
      }
      renderSystem.startBattle();
      hud.setBattleButton('running');
      hud.setBanner('');
    },
  });

  setDebug = hud.setDebug;
  status.system = 'scene ready ✅\nrender loop...';
  setDebug(formatDebug());

  let hudTimer = 0;
  let lastBattleStatus = renderSystem.getBattleState().status;
  hud.setBattleButton('idle');

  // requestAnimationFrame 루프
  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    renderSystem.update(delta);

    const battleState = renderSystem.getBattleState();
    if (battleState.status !== lastBattleStatus) {
      if (battleState.status === 'ended') {
        const message = battleState.winner === 'ally'
          ? '아군 승리! 전투 종료'
          : battleState.winner === 'enemy'
            ? '적군 승리! 전투 종료'
            : '무승부! 전투 종료';
        hud.setBanner(message);
        hud.setBattleButton('ended');
      } else if (battleState.status === 'running') {
        hud.setBattleButton('running');
      } else {
        hud.setBattleButton('idle');
      }
      lastBattleStatus = battleState.status;
    }

    hudTimer += delta;
    if (hudTimer >= 0.1) {
      hud.updateStats(renderSystem.getStats());
      hudTimer = 0;
    }
  }
  hud.updateStats(renderSystem.getStats());
  requestAnimationFrame(animate);
} catch (e) {
  console.error(e);
  fallbackSetDebug(`ERROR ❌\n${e?.message || e}`);
}

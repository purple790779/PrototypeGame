import { SceneSetup } from './core/SceneSetup.js';
import { RenderSystem } from './core/RenderSystem.js';

const debugEl = document.getElementById('debug');
function setDebug(msg) {
  if (debugEl) debugEl.textContent = msg;
}

try {
  const container = document.getElementById('app');
  if (!container) throw new Error('#app 컨테이너를 찾지 못했습니다.');

  setDebug('main.js loaded ✅\nscene init...');

  const sceneSetup = new SceneSetup(container);
  const renderSystem = new RenderSystem(sceneSetup.scene, sceneSetup.camera, sceneSetup.renderer);

  setDebug('scene ready ✅\nrender loop...');

  // requestAnimationFrame 루프
  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    renderSystem.update(delta);
  }
  requestAnimationFrame(animate);

  const startBtn = document.getElementById('start-btn');
  if (!startBtn) throw new Error('#start-btn을 찾지 못했습니다.');

  startBtn.addEventListener('click', () => {
    if (renderSystem.running) {
      renderSystem.pauseBattle();
      startBtn.textContent = '전투 시작 (Battle Start)';
    } else {
      renderSystem.startBattle();
      startBtn.textContent = '일시정지 (Pause)';
    }
  });
} catch (e) {
  console.error(e);
  setDebug(`ERROR ❌\n${e?.message || e}`);
}

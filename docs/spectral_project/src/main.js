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
      if (renderSystem.running) {
        renderSystem.pauseBattle();
        hud.setBattleButton(false);
      } else {
        renderSystem.startBattle();
        hud.setBattleButton(true);
      }
    },
  });

  setDebug = hud.setDebug;
  status.system = 'scene ready ✅\nrender loop...';
  setDebug(formatDebug());

  let hudTimer = 0;

  // requestAnimationFrame 루프
  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    renderSystem.update(delta);

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

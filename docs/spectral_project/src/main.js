import * as THREE from 'three';
import { SceneSetup } from './core/SceneSetup.js';
import { RenderSystem } from './core/RenderSystem.js';

const container = document.getElementById('app');

const sceneSetup = new SceneSetup(container);
const renderSystem = new RenderSystem(sceneSetup.scene, sceneSetup.camera, sceneSetup.renderer);

const clock = new THREE.Clock();
const startBtn = document.getElementById('start-btn');

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  renderSystem.update(delta);
}
animate();

startBtn.addEventListener('click', () => {
  if (renderSystem.running) {
    renderSystem.pauseBattle();
    startBtn.textContent = '전투 시작 (Battle Start)';
  } else {
    renderSystem.startBattle();
    startBtn.textContent = '일시정지 (Pause)';
  }
});

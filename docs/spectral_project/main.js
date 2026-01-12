import * as THREE from 'three';
import { SceneSetup } from './SceneSetup.js';
import { RenderSystem } from './RenderSystem.js';

const container = document.getElementById('app');
const sceneSetup = new SceneSetup(container);
const renderSystem = new RenderSystem(sceneSetup.scene, sceneSetup.camera, sceneSetup.renderer);
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    renderSystem.update(delta);
}
animate();

document.getElementById('start-btn').addEventListener('click', () => {
    console.log("전투 시작!");
});

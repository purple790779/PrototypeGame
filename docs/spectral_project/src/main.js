import * as THREE from 'three';
import { SceneSetup } from './core/SceneSetup.js';
import { RenderSystem } from './systems/RenderSystem.js';

// 1. 초기화
const container = document.getElementById('app');
const sceneSetup = new SceneSetup(container);

// 2. 시스템 등록 (전투 시스템은 나중에 추가)
const renderSystem = new RenderSystem(sceneSetup.scene, sceneSetup.camera, sceneSetup.renderer);

// 3. 게임 루프
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    // 렌더링 시스템 업데이트
    renderSystem.update(delta);
}

// 시작
animate();

// UI 이벤트
document.getElementById('start-btn').addEventListener('click', () => {
    console.log("전투 개시! (시스템 로직 연결 필요)");
});

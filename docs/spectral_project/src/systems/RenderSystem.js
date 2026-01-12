import * as THREE from 'three';

export class RenderSystem {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // 병사 생성 시작
        this.initInstancedMeshes();
    }

    initInstancedMeshes() {
        // 1. 병사 모양 (박스)
        const geometry = new THREE.BoxGeometry(1, 2, 1); 
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        // 2. 2000명을 한 번에 그릴 준비
        this.mesh = new THREE.InstancedMesh(geometry, material, 2000);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.mesh);

        // 3. 병사 배치 (여기가 중요!)
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        let index = 0;

        // --- 아군 (파란색) 100명 배치 ---
        for (let i = 0; i < 100; i++) {
            const x = -50 + (i % 10) * 3; // 가로 간격 벌리기
            const z = -20 + Math.floor(i / 10) * 3; // 세로 간격 벌리기
            
            dummy.position.set(x, 1, z);
            dummy.updateMatrix();
            
            this.mesh.setMatrixAt(index, dummy.matrix);
            this.mesh.setColorAt(index, color.setHex(0x0000ff)); // 파란색 직접 지정
            index++;
        }

        // --- 적군 (빨간색) 100명 배치 ---
        for (let i = 0; i < 100; i++) {
            const x = 50 - (i % 10) * 3;
            const z = -20 + Math.floor(i / 10) * 3;
            
            dummy.position.set(x, 1, z);
            dummy.updateMatrix();
            
            this.mesh.setMatrixAt(index, dummy.matrix);
            this.mesh.setColorAt(index, color.setHex(0xff0000)); // 빨간색 직접 지정
            index++;
        }
        
        // 4. 업데이트 알림 (이게 없으면 화면에 안 나옵니다)
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
    }

    update(delta) {
        // 화면 그리기
        this.renderer.render(this.scene, this.camera);
    }
}

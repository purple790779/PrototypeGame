import * as THREE from 'three';

export class RenderSystem {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.initInstancedMeshes();
    }

    initInstancedMeshes() {
        // 병사 모델 (일단 박스로 표현)
        const geometry = new THREE.BoxGeometry(1, 2, 1); 
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        // 2000명까지 수용 가능한 메쉬 생성
        this.mesh = new THREE.InstancedMesh(geometry, material, 2000);
        this.scene.add(this.mesh);

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        let index = 0;

        // 아군 (파란색) 100명 배치
        for (let i = 0; i < 100; i++) {
            dummy.position.set(-50 + (i%10)*2, 1, -20 + Math.floor(i/10)*2);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(index, dummy.matrix);
            this.mesh.setColorAt(index, color.setHex(0x0000ff)); // Blue
            index++;
        }

        // 적군 (빨간색) 100명 배치
        for (let i = 0; i < 100; i++) {
            dummy.position.set(50 - (i%10)*2, 1, -20 + Math.floor(i/10)*2);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(index, dummy.matrix);
            this.mesh.setColorAt(index, color.setHex(0xff0000)); // Red
            index++;
        }
        
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
    }

    update(delta) {
        this.renderer.render(this.scene, this.camera);
    }
}

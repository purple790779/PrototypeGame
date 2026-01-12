import * as THREE from 'three';

export class RenderSystem {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.initInstancedMeshes();
    }

    initInstancedMeshes() {
        const geometry = new THREE.BoxGeometry(1, 2, 1); 
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        this.mesh = new THREE.InstancedMesh(geometry, material, 2000);
        this.scene.add(this.mesh);

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        let index = 0;

        for (let i = 0; i < 100; i++) {
            const x = -50 + (i % 10) * 3;
            const z = -20 + Math.floor(i / 10) * 3;
            dummy.position.set(x, 1, z);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(index, dummy.matrix);
            this.mesh.setColorAt(index, color.setHex(0x0000ff));
            index++;
        }

        for (let i = 0; i < 100; i++) {
            const x = 50 - (i % 10) * 3;
            const z = -20 + Math.floor(i / 10) * 3;
            dummy.position.set(x, 1, z);
            dummy.updateMatrix();
            this.mesh.setMatrixAt(index, dummy.matrix);
            this.mesh.setColorAt(index, color.setHex(0xff0000));
            index++;
        }
        
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
    }

    update(delta) {
        this.renderer.render(this.scene, this.camera);
    }
}
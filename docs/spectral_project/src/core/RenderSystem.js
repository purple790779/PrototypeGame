import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class RenderSystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.running = false;
    this.unitCount = 200;

    this.pos = new Float32Array(this.unitCount * 3);
    this.side = new Uint8Array(this.unitCount);
    this.speed = new Float32Array(this.unitCount);

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();

    this.initInstancedMeshes();
  }

  startBattle() { this.running = true; }
  pauseBattle() { this.running = false; }

  initInstancedMeshes() {
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true });

    this.mesh = new THREE.InstancedMesh(geometry, material, this.unitCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);

    let index = 0;

    for (let i = 0; i < 100; i++) {
      const x = -50 + (i % 10) * 3;
      const z = -20 + Math.floor(i / 10) * 3;

      this.pos[index * 3 + 0] = x;
      this.pos[index * 3 + 1] = 1;
      this.pos[index * 3 + 2] = z;

      this.side[index] = 0;
      this.speed[index] = 8 + (i % 3);

      this._dummy.position.set(x, 1, z);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this._dummy.matrix);
      this.mesh.setColorAt(index, this._color.setHex(0x2d6bff));
      index++;
    }

    for (let i = 0; i < 100; i++) {
      const x = 50 - (i % 10) * 3;
      const z = -20 + Math.floor(i / 10) * 3;

      this.pos[index * 3 + 0] = x;
      this.pos[index * 3 + 1] = 1;
      this.pos[index * 3 + 2] = z;

      this.side[index] = 1;
      this.speed[index] = 8 + (i % 3);

      this._dummy.position.set(x, 1, z);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this._dummy.matrix);
      this.mesh.setColorAt(index, this._color.setHex(0xff3b3b));
      index++;
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(delta) {
    if (this.running) {
      const targetX = 0;
      const stopDist = 1.5;

      for (let i = 0; i < this.unitCount; i++) {
        const base = i * 3;
        let x = this.pos[base + 0];
        const y = this.pos[base + 1];
        const z = this.pos[base + 2];

        const dir = (this.side[i] === 0) ? 1 : -1;

        if (Math.abs(x - targetX) > stopDist) {
          x += dir * this.speed[i] * delta;
          this.pos[base + 0] = x;
        }

        this._dummy.position.set(x, y, z);
        this._dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this._dummy.matrix);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class RenderSystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.running = false;

    // 양쪽 100씩
    this.blueCount = 100;
    this.redCount = 100;
    this.unitCount = this.blueCount + this.redCount;

    // 전체 유닛 공용 포지션 (x,y,z)
    this.pos = new Float32Array(this.unitCount * 3);
    this.side = new Uint8Array(this.unitCount);      // 0=blue, 1=red
    this.sideIndex = new Uint16Array(this.unitCount); // 해당 side mesh에서의 인덱스
    this.speed = new Float32Array(this.unitCount);

    this._dummy = new THREE.Object3D();

    this.initInstancedMeshes();
  }

  startBattle() { this.running = true; }
  pauseBattle() { this.running = false; }

  initInstancedMeshes() {
    const geometry = new THREE.BoxGeometry(1, 2, 1);

    // ✅ 인스턴스 색 문제를 피하기 위해 mesh를 2개로 분리
    const blueMat = new THREE.MeshStandardMaterial({
      color: 0x2d6bff,
      roughness: 0.95,
      metalness: 0.0,
    });
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xff3b3b,
      roughness: 0.95,
      metalness: 0.0,
    });

    this.blueMesh = new THREE.InstancedMesh(geometry, blueMat, this.blueCount);
    this.redMesh = new THREE.InstancedMesh(geometry, redMat, this.redCount);

    this.blueMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.redMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.blueMesh.castShadow = true;
    this.redMesh.castShadow = true;

    // 병사 자체도 받는 그림자(조금 더 입체감)
    this.blueMesh.receiveShadow = true;
    this.redMesh.receiveShadow = true;

    this.scene.add(this.blueMesh);
    this.scene.add(this.redMesh);

    // ===== 초기 배치 =====
    let global = 0;

    // Blue (왼쪽)
    for (let i = 0; i < this.blueCount; i++) {
      const x = -70 + (i % 10) * 3;
      const z = -30 + Math.floor(i / 10) * 3;

      this.pos[global * 3 + 0] = x;
      this.pos[global * 3 + 1] = 1;
      this.pos[global * 3 + 2] = z;

      this.side[global] = 0;
      this.sideIndex[global] = i;
      this.speed[global] = 10 + (i % 3);

      this._dummy.position.set(x, 1, z);
      this._dummy.updateMatrix();
      this.blueMesh.setMatrixAt(i, this._dummy.matrix);

      global++;
    }

    // Red (오른쪽)
    for (let i = 0; i < this.redCount; i++) {
      const x = 70 - (i % 10) * 3;
      const z = -30 + Math.floor(i / 10) * 3;

      this.pos[global * 3 + 0] = x;
      this.pos[global * 3 + 1] = 1;
      this.pos[global * 3 + 2] = z;

      this.side[global] = 1;
      this.sideIndex[global] = i;
      this.speed[global] = 10 + (i % 3);

      this._dummy.position.set(x, 1, z);
      this._dummy.updateMatrix();
      this.redMesh.setMatrixAt(i, this._dummy.matrix);

      global++;
    }

    this.blueMesh.instanceMatrix.needsUpdate = true;
    this.redMesh.instanceMatrix.needsUpdate = true;
  }

  update(delta) {
    if (this.running) {
      const targetX = 0;
      const stopDist = 1.8;

      let blueDirty = false;
      let redDirty = false;

      for (let g = 0; g < this.unitCount; g++) {
        const base = g * 3;
        let x = this.pos[base + 0];
        const y = this.pos[base + 1];
        const z = this.pos[base + 2];

        const isBlue = this.side[g] === 0;
        const dir = isBlue ? 1 : -1;

        if (Math.abs(x - targetX) > stopDist) {
          x += dir * this.speed[g] * delta;
          this.pos[base + 0] = x;
        }

        this._dummy.position.set(x, y, z);
        this._dummy.updateMatrix();

        const local = this.sideIndex[g];
        if (isBlue) {
          this.blueMesh.setMatrixAt(local, this._dummy.matrix);
          blueDirty = true;
        } else {
          this.redMesh.setMatrixAt(local, this._dummy.matrix);
          redDirty = true;
        }
      }

      if (blueDirty) this.blueMesh.instanceMatrix.needsUpdate = true;
      if (redDirty) this.redMesh.instanceMatrix.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

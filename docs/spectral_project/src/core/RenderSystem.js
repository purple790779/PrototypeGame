import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pickRandomFormation = (formations) => {
  const aliveFormations = formations.filter((formation) => formation.aliveCount > 0);
  if (aliveFormations.length === 0) return null;
  const index = Math.floor(Math.random() * aliveFormations.length);
  return aliveFormations[index];
};

export class RenderSystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.running = false;
    this._casualtyTimer = 0;

    this._dummy = new THREE.Object3D();

    this.allyFormations = [
      { name: '청색 1기동대', initialCount: 36, aliveCount: 36, offsetZ: -26 },
      { name: '청색 2돌격대', initialCount: 32, aliveCount: 32, offsetZ: -8 },
      { name: '청색 3지원대', initialCount: 32, aliveCount: 32, offsetZ: 10 },
    ];
    this.enemyFormations = [
      { name: '적색 1선봉대', initialCount: 34, aliveCount: 34, offsetZ: -26 },
      { name: '적색 2정예대', initialCount: 33, aliveCount: 33, offsetZ: -8 },
      { name: '적색 3기병대', initialCount: 33, aliveCount: 33, offsetZ: 10 },
    ];

    this.initInstancedMeshes();
  }

  startBattle() { this.running = true; }
  pauseBattle() { this.running = false; }

  initInstancedMeshes() {
    const geometry = new THREE.BoxGeometry(1, 2, 1);

    const allyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d6bff,
      roughness: 0.95,
      metalness: 0.0,
    });
    const enemyMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3b3b,
      roughness: 0.95,
      metalness: 0.0,
    });

    const buildFormationMesh = (formation, material) => {
      const mesh = new THREE.InstancedMesh(geometry, material, formation.initialCount);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      formation.mesh = mesh;
    };

    this.allyFormations.forEach((formation) => buildFormationMesh(formation, allyMaterial));
    this.enemyFormations.forEach((formation) => buildFormationMesh(formation, enemyMaterial));

    const allFormations = [...this.allyFormations, ...this.enemyFormations];
    const unitCount = allFormations.reduce((sum, formation) => sum + formation.initialCount, 0);

    this.unitCount = unitCount;
    this.pos = new Float32Array(unitCount * 3);
    this.side = new Uint8Array(unitCount);
    this.sideIndex = new Uint16Array(unitCount);
    this.speed = new Float32Array(unitCount);
    this.meshByUnit = new Array(unitCount);

    let global = 0;
    const placeFormation = (formation, isAlly) => {
      const baseX = isAlly ? -70 : 70;
      const dir = isAlly ? 1 : -1;
      const mesh = formation.mesh;

      for (let i = 0; i < formation.initialCount; i++) {
        const x = baseX + dir * (i % 10) * 3;
        const z = formation.offsetZ + Math.floor(i / 10) * 3;

        this.pos[global * 3 + 0] = x;
        this.pos[global * 3 + 1] = 1;
        this.pos[global * 3 + 2] = z;

        this.side[global] = isAlly ? 0 : 1;
        this.sideIndex[global] = i;
        this.speed[global] = 10 + (i % 3);
        this.meshByUnit[global] = mesh;

        this._dummy.position.set(x, 1, z);
        this._dummy.updateMatrix();
        mesh.setMatrixAt(i, this._dummy.matrix);

        global += 1;
      }

      mesh.instanceMatrix.needsUpdate = true;
    };

    this.allyFormations.forEach((formation) => placeFormation(formation, true));
    this.enemyFormations.forEach((formation) => placeFormation(formation, false));
  }

  applyDemoCasualties() {
    const allyFormation = pickRandomFormation(this.allyFormations);
    const enemyFormation = pickRandomFormation(this.enemyFormations);
    const allyLoss = Math.floor(Math.random() * 3) + 1;
    const enemyLoss = Math.floor(Math.random() * 3) + 1;

    if (allyFormation) {
      allyFormation.aliveCount = clamp(allyFormation.aliveCount - allyLoss, 0, allyFormation.initialCount);
    }
    if (enemyFormation) {
      enemyFormation.aliveCount = clamp(enemyFormation.aliveCount - enemyLoss, 0, enemyFormation.initialCount);
    }
  }

  getStats() {
    const summarize = (formations) => {
      const alive = formations.reduce((sum, formation) => sum + formation.aliveCount, 0);
      const initial = formations.reduce((sum, formation) => sum + formation.initialCount, 0);
      const percent = initial > 0 ? Math.round((alive / initial) * 100) : 0;
      const formationStats = formations.map((formation) => ({
        name: formation.name,
        alive: formation.aliveCount,
        initial: formation.initialCount,
        status: formation.aliveCount === 0 ? 'DOWN' : 'ENGAGED',
      }));

      return {
        alive,
        initial,
        percent,
        formations: formationStats,
      };
    };

    return {
      ally: summarize(this.allyFormations),
      enemy: summarize(this.enemyFormations),
    };
  }

  update(delta) {
    if (this.running) {
      this._casualtyTimer += delta;
      if (this._casualtyTimer >= 1) {
        this._casualtyTimer = 0;
        this.applyDemoCasualties();
      }

      const targetX = 0;
      const stopDist = 1.8;

      const meshDirty = new Map();

      for (let g = 0; g < this.unitCount; g++) {
        const base = g * 3;
        let x = this.pos[base + 0];
        const y = this.pos[base + 1];
        const z = this.pos[base + 2];

        const isAlly = this.side[g] === 0;
        const dir = isAlly ? 1 : -1;

        if (Math.abs(x - targetX) > stopDist) {
          x += dir * this.speed[g] * delta;
          this.pos[base + 0] = x;
        }

        this._dummy.position.set(x, y, z);
        this._dummy.updateMatrix();

        const mesh = this.meshByUnit[g];
        mesh.setMatrixAt(this.sideIndex[g], this._dummy.matrix);
        meshDirty.set(mesh, true);
      }

      meshDirty.forEach((_, mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
      });
    }

    this.renderer.render(this.scene, this.camera);
  }
}

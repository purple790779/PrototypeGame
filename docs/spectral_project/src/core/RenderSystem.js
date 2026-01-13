import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const pickLoss = () => Math.floor(Math.random() * 3) + 1;

export class RenderSystem {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.board = {
      width: 320,
      height: 160,
      skew: 80,
    };

    this.running = false;
    this.battleState = { status: 'idle', winner: null };
    this._casualtyTimer = 0;

    this.formationRows = 8;
    this.formationCols = 8;
    this.formationSpacing = 2.6;
    this.engageThreshold = 14;
    this.casualtyInterval = 0.5;

    this._dummy = new THREE.Object3D();

    this._initCommanders();
    this._initFormations();
  }

  startBattle() {
    this.running = true;
    this.battleState = { status: 'running', winner: null };
  }

  pauseBattle() {
    this.running = false;
    if (this.battleState.status !== 'ended') {
      this.battleState = { status: 'paused', winner: null };
    }
  }

  resetBattle() {
    this.running = false;
    this._casualtyTimer = 0;
    this.battleState = { status: 'idle', winner: null };

    [...this.allyFormations, ...this.enemyFormations].forEach((formation) => {
      formation.aliveCount = formation.initialCount;
      formation.origin = { ...formation.startOrigin };
      formation.engaged = false;
      this._updateFormationMesh(formation, true);
    });
  }

  isBattleOver() {
    return this.battleState.status === 'ended';
  }

  getBattleState() {
    return { ...this.battleState };
  }

  _initCommanders() {
    const halfW = this.board.width * 0.5;
    const margin = 20;
    const allyCommander = new THREE.Mesh(
      new THREE.BoxGeometry(4, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0x2d6bff, roughness: 0.6, metalness: 0.1 })
    );
    allyCommander.position.set(-halfW + margin, 3, 0);
    allyCommander.castShadow = true;
    allyCommander.receiveShadow = true;

    const enemyCommander = new THREE.Mesh(
      new THREE.BoxGeometry(4, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0xff3b3b, roughness: 0.6, metalness: 0.1 })
    );
    enemyCommander.position.set(halfW - margin, 3, 0);
    enemyCommander.castShadow = true;
    enemyCommander.receiveShadow = true;

    this.scene.add(allyCommander, enemyCommander);
    this.commanders = { ally: allyCommander, enemy: enemyCommander };
  }

  _initFormations() {
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

    const halfW = this.board.width * 0.5;
    const allyBaseX = -halfW + 60;
    const enemyBaseX = halfW - 60;
    const zOffsets = [-30, 0, 30];

    const buildFormation = ({ id, name, team, originX, originZ }) => {
      const rows = this.formationRows;
      const cols = this.formationCols;
      const initialCount = rows * cols;
      const spacing = this.formationSpacing;
      const mesh = new THREE.InstancedMesh(
        geometry,
        team === 'ally' ? allyMaterial : enemyMaterial,
        initialCount
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const gridOffsets = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          gridOffsets.push({
            x: (c - (cols - 1) / 2) * spacing,
            z: (r - (rows - 1) / 2) * spacing,
          });
        }
      }

      return {
        id,
        name,
        team,
        rows,
        cols,
        spacing,
        initialCount,
        aliveCount: initialCount,
        origin: { x: originX, z: originZ },
        startOrigin: { x: originX, z: originZ },
        targetX: team === 'ally' ? -18 : 18,
        speed: 14,
        engaged: false,
        mesh,
        gridOffsets,
      };
    };

    this.allyFormations = [
      buildFormation({ id: 'A1', name: '청색 1기동대', team: 'ally', originX: allyBaseX, originZ: zOffsets[0] }),
      buildFormation({ id: 'A2', name: '청색 2돌격대', team: 'ally', originX: allyBaseX, originZ: zOffsets[1] }),
      buildFormation({ id: 'A3', name: '청색 3지원대', team: 'ally', originX: allyBaseX, originZ: zOffsets[2] }),
    ];

    this.enemyFormations = [
      buildFormation({ id: 'E1', name: '적색 1선봉대', team: 'enemy', originX: enemyBaseX, originZ: zOffsets[0] }),
      buildFormation({ id: 'E2', name: '적색 2정예대', team: 'enemy', originX: enemyBaseX, originZ: zOffsets[1] }),
      buildFormation({ id: 'E3', name: '적색 3기병대', team: 'enemy', originX: enemyBaseX, originZ: zOffsets[2] }),
    ];

    [...this.allyFormations, ...this.enemyFormations].forEach((formation) => {
      this._updateFormationMesh(formation, true);
    });
  }

  _updateFormationMesh(formation, force) {
    const mesh = formation.mesh;
    mesh.count = formation.aliveCount;

    if (!force && formation.aliveCount === 0) {
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    const max = formation.aliveCount;
    for (let i = 0; i < max; i += 1) {
      const offset = formation.gridOffsets[i];
      const x = formation.origin.x + offset.x;
      const z = formation.origin.z + offset.z;
      this._dummy.position.set(x, 1, z);
      this._dummy.updateMatrix();
      mesh.setMatrixAt(i, this._dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }

  _updateEngagements() {
    this.allyFormations.forEach((formation) => {
      formation.engaged = false;
    });
    this.enemyFormations.forEach((formation) => {
      formation.engaged = false;
    });

    this.allyFormations.forEach((ally) => {
      if (ally.aliveCount === 0) return;
      let closest = null;
      let closestDist = Infinity;
      this.enemyFormations.forEach((enemy) => {
        if (enemy.aliveCount === 0) return;
        const dx = ally.origin.x - enemy.origin.x;
        const dz = ally.origin.z - enemy.origin.z;
        const distance = Math.abs(dx) + Math.abs(dz);
        if (distance < closestDist) {
          closestDist = distance;
          closest = enemy;
        }
      });

      if (!closest) return;
      const withinX = Math.abs(ally.origin.x - closest.origin.x) < this.engageThreshold;
      const withinZ = Math.abs(ally.origin.z - closest.origin.z) < this.engageThreshold;
      if (withinX && withinZ) {
        ally.engaged = true;
        closest.engaged = true;
      }
    });
  }

  _applyCasualties() {
    const engagedFormations = [...this.allyFormations, ...this.enemyFormations].filter(
      (formation) => formation.engaged && formation.aliveCount > 0
    );

    engagedFormations.forEach((formation) => {
      const loss = pickLoss();
      formation.aliveCount = clamp(formation.aliveCount - loss, 0, formation.initialCount);
      this._updateFormationMesh(formation, true);
    });
  }

  _updateFormationMovement(delta) {
    const updateFormation = (formation) => {
      if (formation.engaged || formation.aliveCount === 0) return;
      const distance = formation.targetX - formation.origin.x;
      if (Math.abs(distance) < 0.5) return;
      const step = Math.sign(distance) * formation.speed * delta;
      if (Math.abs(step) > Math.abs(distance)) {
        formation.origin.x = formation.targetX;
      } else {
        formation.origin.x += step;
      }
      this._updateFormationMesh(formation, false);
    };

    this.allyFormations.forEach(updateFormation);
    this.enemyFormations.forEach(updateFormation);
  }

  _checkBattleEnd() {
    const allyAlive = this.allyFormations.reduce((sum, formation) => sum + formation.aliveCount, 0);
    const enemyAlive = this.enemyFormations.reduce((sum, formation) => sum + formation.aliveCount, 0);

    if (allyAlive === 0 || enemyAlive === 0) {
      this.running = false;
      let winner = 'draw';
      if (allyAlive > 0 && enemyAlive === 0) winner = 'ally';
      if (enemyAlive > 0 && allyAlive === 0) winner = 'enemy';
      this.battleState = { status: 'ended', winner };
    }
  }

  getStats() {
    const summarize = (formations) => {
      const alive = formations.reduce((sum, formation) => sum + formation.aliveCount, 0);
      const initial = formations.reduce((sum, formation) => sum + formation.initialCount, 0);
      const percent = initial > 0 ? Math.round((alive / initial) * 100) : 0;
      const formationStats = formations.map((formation) => {
        let status = 'READY';
        if (formation.aliveCount === 0) {
          status = 'DOWN';
        } else if (formation.engaged) {
          status = 'ENGAGED';
        } else if (this.running) {
          status = 'ADVANCE';
        }
        return {
          name: formation.name,
          alive: formation.aliveCount,
          initial: formation.initialCount,
          status,
        };
      });

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
      this._updateEngagements();
      this._updateFormationMovement(delta);

      if (this._casualtyTimer >= this.casualtyInterval) {
        this._casualtyTimer = 0;
        this._applyCasualties();
      }

      this._checkBattleEnd();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

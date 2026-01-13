import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const UNIT_TYPES = {
  infantry: {
    label: '보병',
    maxHp: 20,
    atkMin: 2,
    atkMax: 5,
    def: 1,
    range: 1.8,
    atkInterval: 0.6,
    moveSpeed: 12,
  },
  archer: {
    label: '궁병',
    maxHp: 14,
    atkMin: 2,
    atkMax: 4,
    def: 0,
    range: 18,
    atkInterval: 1.2,
    moveSpeed: 10,
  },
  spearman: {
    label: '창병',
    maxHp: 22,
    atkMin: 2,
    atkMax: 4,
    def: 2,
    range: 2.2,
    atkInterval: 0.8,
    moveSpeed: 11,
  },
};

const STANCES = {
  dense: {
    label: '밀집',
    spacing: 2.2,
    defBonus: 0,
    moveSpeedMul: 1.0,
  },
  phalanx: {
    label: '방진',
    spacing: 2.8,
    defBonus: 1,
    moveSpeedMul: 0.9,
  },
};

const COMMANDER_STATS = {
  maxHp: 200,
  atkMin: 12,
  atkMax: 18,
  def: 6,
  range: 2.5,
  atkInterval: 0.9,
};

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

    this.formationRows = 12;
    this.formationCols = 12;
    this.separationMargin = 8;
    this.engageBuffer = 2.0;

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
    this.battleState = { status: 'idle', winner: null };

    this._resetCommander(this.commanders.ally, -1);
    this._resetCommander(this.commanders.enemy, 1);

    [...this.allyFormations, ...this.enemyFormations].forEach((formation) => {
      this._resetFormation(formation);
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
    const commanderGeo = new THREE.BoxGeometry(4, 8, 4);

    const buildCommander = (team, color, x) => {
      const mesh = new THREE.Mesh(
        commanderGeo,
        new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15 })
      );
      mesh.position.set(x, 4, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      return {
        team,
        mesh,
        stats: {
          maxHp: COMMANDER_STATS.maxHp,
          hp: COMMANDER_STATS.maxHp,
          atk: randomRange(COMMANDER_STATS.atkMin, COMMANDER_STATS.atkMax),
          def: COMMANDER_STATS.def,
          range: COMMANDER_STATS.range,
          atkInterval: COMMANDER_STATS.atkInterval,
          cooldown: 0,
        },
      };
    };

    const allyCommander = buildCommander('ally', 0xffd65c, -halfW + margin);
    const enemyCommander = buildCommander('enemy', 0x8b1c2e, halfW - margin);

    this.commanders = { ally: allyCommander, enemy: enemyCommander };
  }

  _resetCommander(commander, direction) {
    commander.stats.hp = commander.stats.maxHp;
    commander.stats.atk = randomRange(COMMANDER_STATS.atkMin, COMMANDER_STATS.atkMax);
    commander.stats.cooldown = 0;
    commander.mesh.position.z = 0;
    commander.mesh.position.x = direction * (this.board.width * 0.5 - 20);
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
    const allyBaseX = -halfW + 70;
    const enemyBaseX = halfW - 70;
    const zOffsets = [-36, 0, 36];

    const buildFormation = ({ id, name, team, type, stance, originX, originZ }) => {
      const rows = this.formationRows;
      const cols = this.formationCols;
      const typeData = UNIT_TYPES[type];
      const stanceData = STANCES[stance];
      const initialCount = rows * cols;
      const spacing = stanceData.spacing;
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

      const formation = {
        id,
        name,
        team,
        type,
        stance,
        typeData,
        stanceData,
        rows,
        cols,
        spacing,
        initialCount,
        aliveCount: initialCount,
        origin: { x: originX, z: originZ },
        startOrigin: { x: originX, z: originZ },
        targetX: team === 'ally' ? -24 : 24,
        targetZ: originZ,
        engaged: false,
        targetEnemy: null,
        mesh,
        gridOffsets,
      };

      this._createFormationStats(formation);

      return formation;
    };

    this.allyFormations = [
      buildFormation({
        id: 'A1',
        name: '청색 1보병대',
        team: 'ally',
        type: 'infantry',
        stance: 'dense',
        originX: allyBaseX,
        originZ: zOffsets[0],
      }),
      buildFormation({
        id: 'A2',
        name: '청색 2궁병대',
        team: 'ally',
        type: 'archer',
        stance: 'dense',
        originX: allyBaseX,
        originZ: zOffsets[1],
      }),
      buildFormation({
        id: 'A3',
        name: '청색 3창병대',
        team: 'ally',
        type: 'spearman',
        stance: 'phalanx',
        originX: allyBaseX,
        originZ: zOffsets[2],
      }),
    ];

    this.enemyFormations = [
      buildFormation({
        id: 'E1',
        name: '적색 1보병대',
        team: 'enemy',
        type: 'infantry',
        stance: 'dense',
        originX: enemyBaseX,
        originZ: zOffsets[0],
      }),
      buildFormation({
        id: 'E2',
        name: '적색 2궁병대',
        team: 'enemy',
        type: 'archer',
        stance: 'dense',
        originX: enemyBaseX,
        originZ: zOffsets[1],
      }),
      buildFormation({
        id: 'E3',
        name: '적색 3창병대',
        team: 'enemy',
        type: 'spearman',
        stance: 'phalanx',
        originX: enemyBaseX,
        originZ: zOffsets[2],
      }),
    ];

    [...this.allyFormations, ...this.enemyFormations].forEach((formation) => {
      this._updateFormationMesh(formation, true);
    });
  }

  _createFormationStats(formation) {
    const count = formation.initialCount;
    formation.maxHp = new Float32Array(count);
    formation.hp = new Float32Array(count);
    formation.atk = new Float32Array(count);
    formation.def = new Float32Array(count);
    formation.cooldown = new Float32Array(count);
    formation.aliveMask = new Uint8Array(count);
    formation.activeIndices = new Uint16Array(count);

    for (let i = 0; i < count; i += 1) {
      formation.maxHp[i] = formation.typeData.maxHp;
      formation.hp[i] = formation.typeData.maxHp;
      formation.atk[i] = randomRange(formation.typeData.atkMin, formation.typeData.atkMax);
      formation.def[i] = formation.typeData.def;
      formation.cooldown[i] = 0;
      formation.aliveMask[i] = 1;
      formation.activeIndices[i] = i;
    }

    formation.aliveCount = count;
    formation.totalMaxHp = count * formation.typeData.maxHp;
    formation.range = formation.typeData.range;
    formation.atkInterval = formation.typeData.atkInterval;
    formation.moveSpeed = formation.typeData.moveSpeed * formation.stanceData.moveSpeedMul;
    formation.radius = 0.6 * Math.sqrt(formation.rows * formation.cols) * formation.spacing;
  }

  _resetFormation(formation) {
    formation.origin = { ...formation.startOrigin };
    formation.targetZ = formation.startOrigin.z;
    formation.engaged = false;
    formation.targetEnemy = null;
    this._createFormationStats(formation);
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
    const allFormations = [...this.allyFormations, ...this.enemyFormations];
    allFormations.forEach((formation) => {
      formation.engaged = false;
      formation.targetEnemy = null;
    });

    const findClosest = (formation, enemies) => {
      let closest = null;
      let closestDist = Infinity;
      enemies.forEach((enemy) => {
        if (enemy.aliveCount === 0) return;
        const dx = formation.origin.x - enemy.origin.x;
        const dz = formation.origin.z - enemy.origin.z;
        const distance = Math.hypot(dx, dz);
        if (distance < closestDist) {
          closestDist = distance;
          closest = enemy;
        }
      });
      return { closest, closestDist };
    };

    this.allyFormations.forEach((formation) => {
      if (formation.aliveCount === 0) return;
      const { closest, closestDist } = findClosest(formation, this.enemyFormations);
      if (!closest) return;
      if (closestDist <= formation.range + this.engageBuffer) {
        formation.engaged = true;
        formation.targetEnemy = closest;
      }
    });

    this.enemyFormations.forEach((formation) => {
      if (formation.aliveCount === 0) return;
      const { closest, closestDist } = findClosest(formation, this.allyFormations);
      if (!closest) return;
      if (closestDist <= formation.range + this.engageBuffer) {
        formation.engaged = true;
        formation.targetEnemy = closest;
      }
    });
  }

  _applyFormationSeparation() {
    const applySeparation = (formations) => {
      const count = formations.length;
      for (let i = 0; i < count; i += 1) {
        for (let j = i + 1; j < count; j += 1) {
          const a = formations[i];
          const b = formations[j];
          if (a.aliveCount === 0 || b.aliveCount === 0) continue;
          const dx = b.origin.x - a.origin.x;
          const dz = b.origin.z - a.origin.z;
          const dist = Math.hypot(dx, dz);
          const minDist = a.radius + b.radius + this.separationMargin;
          if (dist < minDist) {
            const push = (minDist - dist) * 0.5;
            const dirX = dist === 0 ? 1 : dx / dist;
            const dirZ = dist === 0 ? 0 : dz / dist;
            a.origin.x -= dirX * push;
            a.origin.z -= dirZ * push;
            b.origin.x += dirX * push;
            b.origin.z += dirZ * push;
            this._clampToBoard(a.origin);
            this._clampToBoard(b.origin);
          }
        }
      }
    };

    for (let iteration = 0; iteration < 2; iteration += 1) {
      applySeparation(this.allyFormations);
      applySeparation(this.enemyFormations);
    }

    [...this.allyFormations, ...this.enemyFormations].forEach((formation) => {
      this._updateFormationMesh(formation, false);
    });
  }

  _clampToBoard(origin) {
    const halfW = this.board.width * 0.5 - 10;
    const halfH = this.board.height * 0.5 - 10;
    origin.x = clamp(origin.x, -halfW, halfW);
    origin.z = clamp(origin.z, -halfH, halfH);
  }

  _updateFormationMovement(delta) {
    const updateFormation = (formation) => {
      if (formation.engaged || formation.aliveCount === 0) return;
      const dx = formation.targetX - formation.origin.x;
      const dz = formation.targetZ - formation.origin.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.4) return;
      const step = formation.moveSpeed * delta;
      if (step >= distance) {
        formation.origin.x = formation.targetX;
        formation.origin.z = formation.targetZ;
      } else {
        formation.origin.x += (dx / distance) * step;
        formation.origin.z += (dz / distance) * step;
      }
      this._updateFormationMesh(formation, false);
    };

    this.allyFormations.forEach(updateFormation);
    this.enemyFormations.forEach(updateFormation);
  }

  _applyDamageToUnit(formation, listIndex, damage) {
    const unitIndex = formation.activeIndices[listIndex];
    formation.hp[unitIndex] -= damage;
    if (formation.hp[unitIndex] > 0) return false;

    formation.hp[unitIndex] = 0;
    formation.aliveMask[unitIndex] = 0;
    formation.aliveCount -= 1;
    const lastIndex = formation.activeIndices[formation.aliveCount];
    formation.activeIndices[listIndex] = lastIndex;
    formation.activeIndices[formation.aliveCount] = unitIndex;
    return true;
  }

  _updateCombat(delta) {
    const formations = [...this.allyFormations, ...this.enemyFormations];
    formations.forEach((formation) => {
      if (formation.aliveCount === 0 || !formation.targetEnemy) return;
      const enemyFormation = formation.targetEnemy;
      if (enemyFormation.aliveCount === 0) return;

      const dx = formation.origin.x - enemyFormation.origin.x;
      const dz = formation.origin.z - enemyFormation.origin.z;
      const distance = Math.hypot(dx, dz);
      if (distance > formation.range + this.engageBuffer) return;

      const enemyCommander = formation.team === 'ally' ? this.commanders.enemy : this.commanders.ally;
      const commanderPos = enemyCommander.mesh.position;
      const commanderDistance = Math.hypot(
        formation.origin.x - commanderPos.x,
        formation.origin.z - commanderPos.z
      );
      const canHitCommander = enemyCommander.stats.hp > 0
        && commanderDistance <= formation.range + 1.5;

      for (let i = 0; i < formation.aliveCount; i += 1) {
        const unitIndex = formation.activeIndices[i];
        formation.cooldown[unitIndex] = Math.max(0, formation.cooldown[unitIndex] - delta);
        if (formation.cooldown[unitIndex] > 0) continue;

        const attackerAtk = formation.atk[unitIndex];
        let targetDied = false;

        if (canHitCommander && Math.random() < 0.12) {
          const damage = Math.max(1, attackerAtk - enemyCommander.stats.def);
          enemyCommander.stats.hp = Math.max(0, enemyCommander.stats.hp - damage);
        } else if (enemyFormation.aliveCount > 0) {
          const targetIndex = Math.floor(Math.random() * enemyFormation.aliveCount);
          const targetUnitIndex = enemyFormation.activeIndices[targetIndex];
          const targetDef = enemyFormation.def[targetUnitIndex] + enemyFormation.stanceData.defBonus;
          const damage = Math.max(1, attackerAtk - targetDef);
          targetDied = this._applyDamageToUnit(enemyFormation, targetIndex, damage);
        } else {
          formation.cooldown[unitIndex] = formation.atkInterval;
          continue;
        }

        formation.cooldown[unitIndex] = formation.atkInterval;

        if (targetDied) {
          this._updateFormationMesh(enemyFormation, true);
        }
      }
    });
  }

  _updateCommanderCombat(delta) {
    const commanderEntries = [this.commanders.ally, this.commanders.enemy];
    commanderEntries.forEach((commander) => {
      if (commander.stats.hp <= 0) return;
      commander.stats.cooldown = Math.max(0, commander.stats.cooldown - delta);
      if (commander.stats.cooldown > 0) return;

      const enemies = commander.team === 'ally' ? this.enemyFormations : this.allyFormations;
      let closest = null;
      let closestDist = Infinity;
      enemies.forEach((enemy) => {
        if (enemy.aliveCount === 0) return;
        const dx = commander.mesh.position.x - enemy.origin.x;
        const dz = commander.mesh.position.z - enemy.origin.z;
        const distance = Math.hypot(dx, dz);
        if (distance < closestDist) {
          closestDist = distance;
          closest = enemy;
        }
      });

      if (!closest || closestDist > commander.stats.range + 1.5) return;

      const targetIndex = Math.floor(Math.random() * closest.aliveCount);
      const targetUnitIndex = closest.activeIndices[targetIndex];
      const targetDef = closest.def[targetUnitIndex] + closest.stanceData.defBonus;
      const damage = Math.max(1, commander.stats.atk - targetDef);
      const died = this._applyDamageToUnit(closest, targetIndex, damage);
      commander.stats.cooldown = commander.stats.atkInterval;

      if (died) {
        this._updateFormationMesh(closest, true);
      }
    });
  }

  _checkBattleEnd() {
    const allyAlive = this.allyFormations.reduce((sum, formation) => sum + formation.aliveCount, 0);
    const enemyAlive = this.enemyFormations.reduce((sum, formation) => sum + formation.aliveCount, 0);
    const allyCommanderHp = this.commanders.ally.stats.hp;
    const enemyCommanderHp = this.commanders.enemy.stats.hp;

    if (allyAlive === 0 || enemyAlive === 0 || allyCommanderHp <= 0 || enemyCommanderHp <= 0) {
      this.running = false;
      let winner = 'draw';
      if ((allyAlive > 0 || allyCommanderHp > 0) && (enemyAlive === 0 || enemyCommanderHp <= 0)) {
        winner = 'ally';
      } else if ((enemyAlive > 0 || enemyCommanderHp > 0) && (allyAlive === 0 || allyCommanderHp <= 0)) {
        winner = 'enemy';
      }
      this.battleState = { status: 'ended', winner };
    }
  }

  _sumFormationHp(formation) {
    let total = 0;
    for (let i = 0; i < formation.aliveCount; i += 1) {
      const unitIndex = formation.activeIndices[i];
      total += formation.hp[unitIndex];
    }
    return total;
  }

  getStats() {
    const summarize = (formations, commander) => {
      let aliveUnits = 0;
      let totalUnits = 0;
      let currentHp = commander.stats.hp;
      let maxHp = commander.stats.maxHp;

      const formationStats = formations.map((formation) => {
        const alive = formation.aliveCount;
        aliveUnits += alive;
        totalUnits += formation.initialCount;
        currentHp += this._sumFormationHp(formation);
        maxHp += formation.totalMaxHp;

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
          alive,
          initial: formation.initialCount,
          status,
          typeLabel: formation.typeData.label,
          stanceLabel: formation.stanceData.label,
        };
      });

      const percent = maxHp > 0 ? Math.round((currentHp / maxHp) * 100) : 0;

      return {
        aliveUnits,
        totalUnits,
        percent,
        commander: {
          hp: commander.stats.hp,
          maxHp: commander.stats.maxHp,
          percent: commander.stats.maxHp > 0
            ? Math.round((commander.stats.hp / commander.stats.maxHp) * 100)
            : 0,
        },
        formations: formationStats,
      };
    };

    return {
      ally: summarize(this.allyFormations, this.commanders.ally),
      enemy: summarize(this.enemyFormations, this.commanders.enemy),
    };
  }

  update(delta) {
    if (this.running) {
      this._updateEngagements();
      this._applyFormationSeparation();
      this._updateFormationMovement(delta);
      this._updateCombat(delta);
      this._updateCommanderCombat(delta);
      this._checkBattleEnd();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

import { makeFormationPositions } from "./formations.js";

const rand = (a,b)=> a + Math.random()*(b-a);

export class BattleSim {
  constructor(){
    this.state = "deploy"; // deploy | running | paused | ended
    this.time = 0;
    this.speedMul = 1;

    this.blue = this.#makeSide("blue");
    this.red  = this.#makeSide("red");

    this.particles = [];
    this.resultText = "";
  }

  #makeSide(side){
    const companies = [];
    const n = 6; // 중대 수(샘플)
    for (let i=0;i<n;i++){
      companies.push(this.#makeCompany(side, i));
    }
    return {
      side,
      commander: {
        name: side === "blue" ? "청룡" : "적호",
        cmd: side === "blue" ? 80 : 78,
        tac: side === "blue" ? 70 : 74,
        mor: side === "blue" ? 75 : 72,
        // 지휘관은 전장에 "아이콘만" 고정 (전투 불참)
        u: side === "blue" ? 0.16 : 0.84,
        v: 0.12,
      },
      formation: "line",
      companies,
    };
  }

  #makeCompany(side, idx){
    const base = 26 + Math.floor(Math.random()*10); // 병력 수
    return {
      id: `${side}-${idx}`,
      side,
      name: `중대 ${idx+1}`,
      u: side === "blue" ? 0.18 : 0.82,
      v: 0.35 + idx*0.06,
      u0: 0, v0: 0,
      soldiers: base,
      soldiers0: base,
      alive: true,
      speed: rand(0.035, 0.050), // u/v 공간에서의 이동 속도
      radius: rand(0.018, 0.024),
      // 시각용: 내부 병사 오프셋
      offsets: Array.from({length: base}, ()=>({
        ou: rand(-1,1),
        ov: rand(-1,1),
        wob: rand(0, Math.PI*2),
      })),
      selected: false,
    };
  }

  applyFormations(){
    const bPos = makeFormationPositions(this.blue.formation, "blue", this.blue.companies.length);
    const rPos = makeFormationPositions(this.red.formation, "red", this.red.companies.length);

    this.blue.companies.forEach((c,i)=>{
      c.u = c.u0 = bPos[i].u;
      c.v = c.v0 = bPos[i].v;
      c.selected = false;
    });
    this.red.companies.forEach((c,i)=>{
      c.u = c.u0 = rPos[i].u;
      c.v = c.v0 = rPos[i].v;
      c.selected = false;
    });

    this.resultText = "";
  }

  startBattle(){
    if (this.state === "ended") this.reset();
    this.state = "running";
    this.resultText = "";
  }

  pauseToggle(){
    if (this.state === "running") notice(this, "paused");
    else if (this.state === "paused") notice(this, "running");
  }

  setSpeed(mul){ this.speedMul = mul; }

  reset(){
    // 완전 리셋
    this.time = 0;
    this.state = "deploy";
    this.particles.length = 0;
    this.resultText = "";
    this.blue = this.#makeSide("blue");
    this.red  = this.#makeSide("red");
    this.applyFormations();
  }

  update(dt){
    if (this.state !== "running") return;

    const step = dt * this.speedMul;
    this.time += step;

    // 회사(중대) 이동 + 교전
    const blues = this.blue.companies.filter(c=>c.alive);
    const reds  = this.red.companies.filter(c=>c.alive);

    if (blues.length === 0 || reds.length === 0){
      this.state = "ended";
      this.resultText = blues.length ? "청군 승리!" : "적군 승리!";
      return;
    }

    // 상호 교전
    for (const c of [...blues, ...reds]){
      const enemies = c.side === "blue" ? reds : blues;
      const target = nearestCompany(c, enemies);
      if (!target) continue;

      const du = target.u - c.u;
      const dv = target.v - c.v;
      const dist = Math.hypot(du, dv);

      const engage = 0.040; // 접촉 거리
      if (dist > engage){
        // 전진
        const nx = du / (dist || 1);
        const ny = dv / (dist || 1);
        c.u += nx * c.speed * step;
        c.v += ny * c.speed * step;

        // 약간의 진형 유지(중앙 쪽으로 살짝 당김)
        const sideCenter = c.side === "blue" ? 0.28 : 0.72;
        c.u += (sideCenter - c.u) * 0.010 * step;
      } else {
        // 교전: 서로 병력 감소 (병력 수에 비례한 딜)
        const atk = 1.2 + (c.soldiers / c.soldiers0) * 1.6;
        const def = 0.9 + (target.soldiers / target.soldiers0) * 1.4;

        const dmgToTarget = (atk / 2.6) * step * rand(0.7, 1.3);
        const dmgToSelf   = (def / 3.0) * step * rand(0.7, 1.2);

        target.soldiers -= dmgToTarget;
        c.soldiers      -= dmgToSelf;

        spawnHit(this, (c.u+target.u)/2, (c.v+target.v)/2, c.side);

        if (target.soldiers <= 0 && target.alive){
          target.alive = false;
          target.soldiers = 0;
          spawnBurst(this, target.u, target.v, c.side);
        }
        if (c.soldiers <= 0 && c.alive){
          c.alive = false;
          c.soldiers = 0;
          spawnBurst(this, c.u, c.v, target.side);
        }
      }

      // 경계 클램프(전장 밖으로 나가지 않게)
      c.u = Math.max(0.06, Math.min(0.94, c.u));
      c.v = Math.max(0.08, Math.min(0.92, c.v));
    }

    // 파티클 업데이트
    for (let i=this.particles.length-1; i>=0; i--){
      const p = this.particles[i];
      p.t += step;
      p.u += p.vu * step;
      p.v += p.vv * step;
      if (p.t > p.life) this.particles.splice(i,1);
    }
  }
}

function notice(sim, next){
  sim.state = next;
}

function nearestCompany(me, arr){
  let best = null;
  let bestD = Infinity;
  for (const e of arr){
    const d = (me.u-e.u)*(me.u-e.u) + (me.v-e.v)*(me.v-e.v);
    if (d < bestD){
      bestD = d; best = e;
    }
  }
  return best;
}

function spawnHit(sim, u, v, side){
  // 작은 스파크
  if (Math.random() > 0.25) return;
  sim.particles.push({
    kind: "hit",
    u, v,
    vu: rand(-0.04, 0.04),
    vv: rand(-0.04, 0.04),
    t: 0,
    life: rand(0.18, 0.35),
    side,
  });
}

function spawnBurst(sim, u, v, side){
  for (let i=0;i<10;i++){
    sim.particles.push({
      kind: "burst",
      u, v,
      vu: rand(-0.08, 0.08),
      vv: rand(-0.08, 0.08),
      t: 0,
      life: rand(0.25, 0.55),
      side,
    });
  }
}

import { BattleSim } from "./sim.js";
import { makeFieldGeometry, drawScene, screenToUV, uvToXY } from "./render.js";

const canvas = document.getElementById("battleCanvas");
const ctx = canvas.getContext("2d");

const statusPill = document.getElementById("statusPill");
const timeText = document.getElementById("timeText");
const resultText = document.getElementById("resultText");

const blueFormation = document.getElementById("blueFormation");
const redFormation  = document.getElementById("redFormation");
const applyFormationBtn = document.getElementById("applyFormationBtn");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");

const speedBtns = Array.from(document.querySelectorAll("[data-speed]"));

const sim = new BattleSim();
sim.applyFormations();

let geo = null;
let last = performance.now();

// 드래그 배치용
let drag = {
  active: false,
  company: null,
};

function resize(){
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  geo = makeFieldGeometry(rect.width, rect.height);
}
window.addEventListener("resize", resize, { passive: true });
resize();

applyFormationBtn.addEventListener("click", ()=>{
  if (sim.state === "running") return;
  sim.blue.formation = blueFormation.value;
  sim.red.formation  = redFormation.value;
  sim.applyFormations();
});

startBtn.addEventListener("click", ()=>{
  sim.startBattle();
});

pauseBtn.addEventListener("click", ()=>{
  if (sim.state === "deploy") return;
  sim.pauseToggle();
});

speedBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const s = Number(btn.dataset.speed || "1");
    sim.setSpeed(s);
  });
});

// 포인터 입력(배치 단계에서 청군 중대 드래그 이동)
canvas.addEventListener("pointerdown", (e)=>{
  if (sim.state !== "deploy") return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const hit = pickCompany(sim.blue.companies, x, y);
  if (!hit) return;

  // 선택
  sim.blue.companies.forEach(c=>c.selected = false);
  hit.selected = true;

  drag.active = true;
  drag.company = hit;

  canvas.setPointerCapture(e.pointerId);
}, { passive: true });

canvas.addEventListener("pointermove", (e)=>{
  if (!drag.active || !drag.company) return;
  if (sim.state !== "deploy") return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const uv = screenToUV(geo, x, y);

  // 청군은 좌측 절반(u <= 0.48)만 이동 가능
  drag.company.u = Math.max(0.08, Math.min(0.48, uv.u));
  drag.company.v = Math.max(0.10, Math.min(0.90, uv.v));
}, { passive: true });

canvas.addEventListener("pointerup", ()=>{
  drag.active = false;
  drag.company = null;
}, { passive: true });

function pickCompany(companies, x, y){
  let best = null;
  let bestD = Infinity;

  for (const c of companies){
    if (!c.alive) continue;
    const p = uvToXY(geo, c.u, c.v);
    const d = (p.x-x)*(p.x-x) + (p.y-y)*(p.y-y);
    if (d < bestD && d < 28*28){
      bestD = d;
      best = c;
    }
  }
  return best;
}

function formatTime(sec){
  const s = Math.floor(sec);
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${mm}:${ss}`;
}

function tick(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // paused 처리
  if (sim.state === "paused"){
    // 시간은 고정, 렌더만
  } else {
    sim.update(dt);
  }

  // UI
  statusPill.textContent =
    sim.state === "deploy" ? "배치 단계" :
    sim.state === "running" ? `전투 중 (x${sim.speedMul})` :
    sim.state === "paused" ? "일시정지" :
    "전투 종료";

  timeText.textContent = formatTime(sim.time);
  resultText.textContent = sim.resultText || "";

  // 렌더
  const rect = canvas.getBoundingClientRect();
  drawScene(ctx, sim, geo, rect.width, rect.height);

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

const lerp = (a,b,t)=> a + (b-a)*t;

export function makeFieldGeometry(w, h){
  // 화면에 전장을 "사다리꼴"로 배치 (원근감)
  const pad = Math.max(18, Math.min(w,h)*0.03);

  const topW = w * 0.62;
  const botW = w * 0.88;
  const topY = pad + h*0.10;
  const botY = h - pad - h*0.10;

  const cx = w * 0.5;

  const topLeft  = { x: cx - topW/2, y: topY };
  const topRight = { x: cx + topW/2, y: topY };
  const botLeft  = { x: cx - botW/2, y: botY };
  const botRight = { x: cx + botW/2, y: botY };

  return { topLeft, topRight, botLeft, botRight };
}

export function uvToXY(geo, u, v){
  // 사다리꼴 내부 bilinear 매핑
  const ax = lerp(geo.topLeft.x, geo.topRight.x, u);
  const ay = lerp(geo.topLeft.y, geo.topRight.y, u);
  const bx = lerp(geo.botLeft.x, geo.botRight.x, u);
  const by = lerp(geo.botLeft.y, geo.botRight.y, u);
  return { x: lerp(ax, bx, v), y: lerp(ay, by, v) };
}

export function screenToUV(geo, x, y){
  // 역변환(수치 근사): 드래그 배치용
  let u = 0.5, v = 0.6;

  for (let it=0; it<10; it++){
    const p = uvToXY(geo, u, v);
    const ex = x - p.x;
    const ey = y - p.y;

    // 수치 미분(작은 변화량)
    const du = 0.0025;
    const dv = 0.0025;
    const pu = uvToXY(geo, Math.min(1,u+du), v);
    const pv = uvToXY(geo, u, Math.min(1,v+dv));

    const dxdu = (pu.x - p.x) / du;
    const dydu = (pu.y - p.y) / du;
    const dxdv = (pv.x - p.x) / dv;
    const dydv = (pv.y - p.y) / dv;

    // 2x2 역행렬로 (u,v) 업데이트
    const det = dxdu*dydv - dydu*dxdv;
    if (Math.abs(det) < 1e-6) break;

    const iu = ( ex*dydv - ey*dxdv) / det;
    const iv = (-ex*dydu + ey*dxdu) / det;

    u += iu * 0.8;
    v += iv * 0.8;

    u = Math.max(0, Math.min(1, u));
    v = Math.max(0, Math.min(1, v));
  }

  return { u, v };
}

export function drawScene(ctx, sim, geo, w, h){
  ctx.clearRect(0,0,w,h);

  // 배경 안개/그림자
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillRect(0,0,w,h);

  // 전장 바닥
  drawBattlefield(ctx, geo);

  // 지형 오브젝트 (성벽/마을/숲/강)
  drawTerrain(ctx, geo);

  // 중앙 분할선(좌/우 진영 경계)
  drawMidLine(ctx, geo);

  // 지휘관(고정)
  drawCommander(ctx, geo, sim.blue.commander, "blue");
  drawCommander(ctx, geo, sim.red.commander, "red");

  // 부대(중대)
  for (const c of sim.blue.companies) drawCompany(ctx, geo, c, sim.state);
  for (const c of sim.red.companies)  drawCompany(ctx, geo, c, sim.state);

  // 파티클
  drawParticles(ctx, geo, sim.particles);

  // 상태 텍스트(전투 종료)
  if (sim.state === "ended" && sim.resultText){
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, h*0.40, w, h*0.20);
    ctx.font = `900 ${Math.floor(h*0.06)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(sim.resultText, w*0.5, h*0.52);
    ctx.restore();
  }
}

function drawBattlefield(ctx, geo){
  const { topLeft, topRight, botLeft, botRight } = geo;

  // 바닥
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(botRight.x, botRight.y);
  ctx.lineTo(botLeft.x, botLeft.y);
  ctx.closePath();

  // 잔디 느낌의 간단 그라디언트
  const grd = ctx.createLinearGradient(0, topLeft.y, 0, botLeft.y);
  grd.addColorStop(0, "rgba(40,68,50,0.92)");
  grd.addColorStop(1, "rgba(22,40,30,0.96)");
  ctx.fillStyle = grd;
  ctx.fill();

  // 테두리
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.stroke();

  // 바닥 라인 (원근감 줄무늬)
  for (let i=1;i<=8;i++){
    const v = i/9;
    const a = uvToXY(geo, 0.02, v);
    const b = uvToXY(geo, 0.98, v);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.stroke();
  }

  ctx.restore();
}

function drawMidLine(ctx, geo){
  ctx.save();
  const a = uvToXY(geo, 0.5, 0.02);
  const b = uvToXY(geo, 0.5, 0.98);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.setLineDash([8, 10]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(217,178,95,0.20)";
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTerrain(ctx, geo){
  ctx.save();

  // 강(중앙을 가로지르는 곡선)
  ctx.beginPath();
  const p1 = uvToXY(geo, 0.10, 0.48);
  const p2 = uvToXY(geo, 0.35, 0.54);
  const p3 = uvToXY(geo, 0.65, 0.50);
  const p4 = uvToXY(geo, 0.90, 0.56);
  ctx.moveTo(p1.x, p1.y);
  ctx.bezierCurveTo(p2.x, p2.y, p3.x, p3.y, p4.x, p4.y);
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(80,160,255,0.18)";
  ctx.stroke();

  // 성벽(위쪽 중앙에 짧게)
  const w1 = uvToXY(geo, 0.42, 0.20);
  const w2 = uvToXY(geo, 0.58, 0.20);
  ctx.beginPath();
  ctx.moveTo(w1.x, w1.y);
  ctx.lineTo(w2.x, w2.y);
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(180,180,180,0.18)";
  ctx.stroke();

  // 마을(중앙 아래)
  for (let i=0;i<4;i++){
    const u = 0.46 + i*0.03;
    const v = 0.68 + (i%2)*0.02;
    const p = uvToXY(geo, u, v);
    drawHouse(ctx, p.x, p.y, 18 - i*2);
  }

  // 숲(좌/우)
  for (let i=0;i<10;i++){
    const pL = uvToXY(geo, 0.18 + Math.random()*0.10, 0.30 + Math.random()*0.45);
    const pR = uvToXY(geo, 0.72 + Math.random()*0.10, 0.30 + Math.random()*0.45);
    drawTree(ctx, pL.x, pL.y, 10 + Math.random()*8);
    drawTree(ctx, pR.x, pR.y, 10 + Math.random()*8);
  }

  ctx.restore();
}

function drawHouse(ctx, x, y, s){
  ctx.save();
  ctx.translate(x,y);
  ctx.fillStyle = "rgba(240,220,160,0.16)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;

  // 몸체
  ctx.beginPath();
  ctx.roundRect(-s*0.5, -s*0.25, s, s*0.6, 4);
  ctx.fill();
  ctx.stroke();

  // 지붕
  ctx.beginPath();
  ctx.moveTo(-s*0.55, -s*0.25);
  ctx.lineTo(0, -s*0.65);
  ctx.lineTo(s*0.55, -s*0.25);
  ctx.closePath();
  ctx.fillStyle = "rgba(200,120,80,0.18)";
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawTree(ctx, x, y, r){
  ctx.save();
  ctx.translate(x,y);
  ctx.beginPath();
  ctx.arc(0,0,r,0,Math.PI*2);
  ctx.fillStyle = "rgba(40,120,70,0.18)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.stroke();
  ctx.restore();
}

function drawCommander(ctx, geo, commander, side){
  const p = uvToXY(geo, commander.u, commander.v);
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.beginPath();
  ctx.roundRect(-16,-16,32,32,10);
  ctx.fillStyle = side === "blue" ? "rgba(58,160,255,0.22)" : "rgba(255,75,75,0.20)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.stroke();

  ctx.font = "900 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText("지휘", 0, 4);

  ctx.restore();
}

function drawCompany(ctx, geo, c, state){
  if (!c.alive) return;

  const p = uvToXY(geo, c.u, c.v);
  const size = 10 + Math.sqrt(c.soldiers) * 0.35;

  // 중대 외곽 링(선택 표시)
  ctx.save();
  ctx.translate(p.x, p.y);

  const isBlue = c.side === "blue";
  const main = isBlue ? "rgba(58,160,255,0.85)" : "rgba(255,75,75,0.85)";

  // 링
  ctx.beginPath();
  ctx.arc(0,0, size*0.70, 0, Math.PI*2);
  ctx.strokeStyle = c.selected && state === "deploy"
    ? "rgba(217,178,95,0.80)"
    : "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 병사 점들
  const n = Math.max(6, Math.min(34, Math.floor(c.soldiers)));
  for (let i=0;i<n;i++){
    const off = c.offsets[i % c.offsets.length];
    const wob = off.wob + (performance.now()/1000) * 1.8;
    const ru = off.ou * c.radius * 0.9 + Math.cos(wob)*c.radius*0.12;
    const rv = off.ov * c.radius * 0.9 + Math.sin(wob)*c.radius*0.12;

    const pp = uvToXY(geo, c.u + ru, c.v + rv);
    ctx.beginPath();
    ctx.arc(pp.x - p.x, pp.y - p.y, 2.1, 0, Math.PI*2);
    ctx.fillStyle = main;
    ctx.fill();
  }

  // 라벨(병력 수)
  ctx.font = "900 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${Math.max(0, Math.floor(c.soldiers))}`, 0, -size*0.95);

  ctx.restore();
}

function drawParticles(ctx, geo, particles){
  ctx.save();
  for (const p of particles){
    const pos = uvToXY(geo, p.u, p.v);
    const t = p.t / p.life;
    const alpha = Math.max(0, 1 - t);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.kind==="burst" ? 3.0 : 2.0, 0, Math.PI*2);
    ctx.fillStyle = p.side === "blue"
      ? `rgba(58,160,255,${0.35*alpha})`
      : `rgba(255,75,75,${0.35*alpha})`;
    ctx.fill();
  }
  ctx.restore();
}

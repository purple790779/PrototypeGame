// 각 "중대(Company)"의 초기 배치 좌표를 생성 (u,v) : 0..1, 전장은 사다리꼴로 렌더됨
// blue는 u가 낮은 쪽(좌측), red는 u가 높은 쪽(우측)

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

export function makeFormationPositions(type, side, count){
  const isBlue = side === "blue";

  // 각 진형의 기준 영역(좌/우 반쪽)
  const uMin = isBlue ? 0.10 : 0.55;
  const uMax = isBlue ? 0.45 : 0.90;
  const uMid = (uMin + uMax) * 0.5;

  const vMin = 0.18;
  const vMax = 0.82;
  const vMid = 0.60;

  const pts = [];

  if (type === "line"){
    // 횡대: 가로로 넓게 1열
    for (let i=0;i<count;i++){
      const t = count === 1 ? 0.5 : i/(count-1);
      const u = uMin + (uMax-uMin) * (0.15 + 0.70*t);
      const v = vMid + (t-0.5)*0.06;
      pts.push({ u: clamp01(u), v: clamp01(v) });
    }
  } else if (type === "column"){
    // 종대: 세로 1열
    for (let i=0;i<count;i++){
      const t = count === 1 ? 0.5 : i/(count-1);
      const u = uMid + (isBlue ? -0.02 : 0.02);
      const v = vMin + (vMax-vMin) * (0.15 + 0.70*t);
      pts.push({ u: clamp01(u), v: clamp01(v) });
    }
  } else if (type === "wedge"){
    // 쐐기: 앞에 1, 뒤로 2, 뒤로 2...
    const rows = [];
    let remaining = count;
    let r = 0;
    while (remaining > 0){
      const n = Math.min(1 + r, remaining); // 1,2,3... (가파르게 늘면 너무 넓음)
      rows.push(n);
      remaining -= n;
      r++;
    }
    let rowIndex = 0;
    for (const n of rows){
      for (let i=0;i<n;i++){
        const t = n === 1 ? 0.5 : i/(n-1);
        const spread = 0.12 + 0.08*rowIndex;
        const u = uMid + (t-0.5)*spread;
        const v = 0.45 + rowIndex*0.07;
        pts.push({ u: clamp01(u), v: clamp01(v) });
        if (pts.length >= count) break;
      }
      rowIndex++;
      if (pts.length >= count) break;
    }
    // side에 따라 조금 당김
    for (const p of pts) p.u += isBlue ? -0.03 : 0.03;
  } else if (type === "echelon"){
    // 사선: 대각선으로 배치 (우상향/좌상향 느낌)
    for (let i=0;i<count;i++){
      const t = count === 1 ? 0.5 : i/(count-1);
      const u = (isBlue ? (uMax - (uMax-uMin)*t) : (uMin + (uMax-uMin)*t));
      const v = vMin + (vMax-vMin) * (0.25 + 0.55*t);
      pts.push({ u: clamp01(u), v: clamp01(v) });
    }
  } else if (type === "square"){
    // 방진: 2x2(또는 3x2 등) 그리드
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    for (let i=0;i<count;i++){
      const cx = i % cols;
      const cy = Math.floor(i / cols);
      const u = uMin + (uMax-uMin) * (0.25 + 0.50*(cols===1?0.5:cx/(cols-1)));
      const v = vMin + (vMax-vMin) * (0.45 + 0.20*(rows===1?0.5:cy/(rows-1)));
      pts.push({ u: clamp01(u), v: clamp01(v) });
    }
  } else {
    // fallback
    for (let i=0;i<count;i++){
      pts.push({ u: uMid, v: vMid + (i-(count-1)/2)*0.06 });
    }
  }

  // 적군은 살짝 우측, 청군은 살짝 좌측으로 보정
  for (const p of pts){
    p.u = clamp01(p.u + (isBlue ? -0.01 : 0.01));
  }
  return pts;
}

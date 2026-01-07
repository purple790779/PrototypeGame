// Castle + Town Management Sim (MVP)
// Pure client-side, no dependencies. Save/Load via localStorage.
'use strict';

/** ---------- Game Data ---------- */
const JOBS = [
  {
    id: 'farmer',
    name: '농부',
    desc: '식량 생산. 봄·여름·가을에 효율이 좋고, 겨울엔 효율이 떨어집니다.',
  },
  {
    id: 'woodcutter',
    name: '목수/벌목꾼',
    desc: '목재 생산. 건설에 필수.',
  },
  {
    id: 'builder',
    name: '건설 인력',
    desc: '건설 효율을 올립니다(즉시 건설로 단순화).',
  },
  {
    id: 'guard',
    name: '경비병',
    desc: '치안/약탈 방어를 강화합니다. 급여(유지비)가 듭니다.',
  },
];

const BUILDINGS = [
  {
    id: 'house',
    name: '주거지',
    desc: '수용 인구 +5. 행복 소폭 증가.',
    cost: { wood: 20, stone: 5, gold: 10 },
    upkeep: { gold: 0 },
    effect: (s) => { s.housing += 5; s.happiness = clamp(s.happiness + 1, 0, 100); }
  },
  {
    id: 'farm',
    name: '농장',
    desc: '식량 생산 보너스(농부 효율 +12%).',
    cost: { wood: 15, stone: 10, gold: 15 },
    upkeep: { gold: 0 },
    effect: (s) => { s.farmBonus += 0.12; }
  },
  {
    id: 'granary',
    name: '저장고',
    desc: '저장 용량 +120. 부패 감소(단순화: 저장고 보너스만).',
    cost: { wood: 25, stone: 15, gold: 20 },
    upkeep: { gold: 0 },
    effect: (s) => { s.storageCap += 120; }
  },
  {
    id: 'wall',
    name: '성벽',
    desc: '치안/방어 +6. 약탈 피해 감소.',
    cost: { wood: 10, stone: 40, gold: 25 },
    upkeep: { gold: 0 },
    effect: (s) => { s.security = clamp(s.security + 6, 0, 100); s.raidMitigation = clamp(s.raidMitigation + 0.08, 0, 0.75); }
  },
  {
    id: 'tavern',
    name: '선술집',
    desc: '행복 +4. (유지비: 금 -1/일)',
    cost: { wood: 30, stone: 10, gold: 35 },
    upkeep: { gold: 1 },
    effect: (s) => { s.happiness = clamp(s.happiness + 4, 0, 100); }
  },
  {
    id: 'clinic',
    name: '의무소',
    desc: '질병 이벤트 피해 감소. (유지비: 금 -1/일)',
    cost: { wood: 20, stone: 20, gold: 40 },
    upkeep: { gold: 1 },
    effect: (s) => { s.diseaseMitigation = clamp(s.diseaseMitigation + 0.15, 0, 0.7); }
  },
];

const SEASONS = [
  { id: 'spring', name: '봄', farmMult: 1.05 },
  { id: 'summer', name: '여름', farmMult: 1.15 },
  { id: 'autumn', name: '가을', farmMult: 1.00 },
  { id: 'winter', name: '겨울', farmMult: 0.55 },
];

const EVENTS = [
  {
    id: 'raid',
    title: '약탈자 습격!',
    body: '외곽 마을에 약탈자 무리가 접근했습니다. 어떻게 대응할까요?',
    weight: (s) => 0.6 + (40 - s.security) / 80, // 치안 낮을수록 가중
    choices: (s) => [
      {
        label: '민병대 소집(금 지출)',
        apply: () => {
          const cost = 25;
          s.gold -= cost;
          const loss = Math.floor((18 + randInt(0, 14)) * (1 - s.raidMitigation) * (1 - s.security/200));
          s.food = Math.max(0, s.food - loss);
          s.security = clamp(s.security + 2, 0, 100);
          s.legitimacy = clamp(s.legitimacy + 1, 0, 100);
          log(`약탈 대응: 금 -${cost}, 식량 -${loss}, 치안 +2, 정통성 +1`);
        },
      },
      {
        label: '식량을 바치고 넘긴다',
        apply: () => {
          const give = Math.min(s.food, 25 + randInt(0, 20));
          s.food -= give;
          s.happiness = clamp(s.happiness - 3, 0, 100);
          s.legitimacy = clamp(s.legitimacy - 2, 0, 100);
          log(`약탈자에게 식량 ${give}를 바쳤다. 행복 -3, 정통성 -2`);
        },
      },
      {
        label: '버틴다(치안/경비 의존)',
        apply: () => {
          const defense = s.security + s.jobs.guard * 2;
          if (defense >= 60 + randInt(0, 20)) {
            s.legitimacy = clamp(s.legitimacy + 2, 0, 100);
            s.happiness = clamp(s.happiness + 1, 0, 100);
            log('방어 성공! 정통성 +2, 행복 +1');
          } else {
            const loss = Math.floor((28 + randInt(0, 25)) * (1 - s.raidMitigation));
            s.food = Math.max(0, s.food - loss);
            s.wood = Math.max(0, s.wood - Math.floor(loss * 0.4));
            s.security = clamp(s.security - 3, 0, 100);
            s.happiness = clamp(s.happiness - 4, 0, 100);
            log(`방어 실패… 식량 -${loss}, 목재 -${Math.floor(loss*0.4)}, 치안 -3, 행복 -4`);
          }
        },
      },
    ],
  },
  {
    id: 'drought',
    title: '가뭄 징조',
    body: '비가 적어 수확량이 줄어들 수 있습니다. 선제 조치를 취할까요?',
    weight: (s) => 0.45,
    choices: (s) => [
      {
        label: '관개/우물 보수(목재·돌)',
        apply: () => {
          if (s.wood < 15 || s.stone < 10) {
            log('자원이 부족해 제대로 보수하지 못했다…');
            s.happiness = clamp(s.happiness - 2, 0, 100);
            return;
          }
          s.wood -= 15; s.stone -= 10;
          s.temp.farmBuffDays = 10;
          s.temp.farmBuffMult = 1.12;
          s.legitimacy = clamp(s.legitimacy + 1, 0, 100);
          log('관개 보수 완료: 10일간 농업 +12%, 정통성 +1');
        }
      },
      {
        label: '곡물 비축(금으로 구매)',
        apply: () => {
          const buy = 30;
          const cost = 28;
          s.gold -= cost;
          s.food = Math.min(s.storageCap, s.food + buy);
          log(`시장 구매: 금 -${cost}, 식량 +${buy}`);
        }
      },
      {
        label: '아무 것도 하지 않는다',
        apply: () => {
          s.temp.farmDebuffDays = 7;
          s.temp.farmDebuffMult = 0.86;
          log('가뭄 대비를 하지 않았다: 7일간 농업 -14%');
        }
      }
    ]
  },
  {
    id: 'caravan',
    title: '상단 방문',
    body: '상단이 도착했습니다. 자원을 거래할 수 있습니다.',
    weight: (s) => 0.55,
    choices: (s) => [
      {
        label: '식량 판매(+금)',
        apply: () => {
          const sell = Math.min(s.food, 35);
          const gain = Math.floor(sell * 1.2);
          s.food -= sell; s.gold += gain;
          log(`식량 판매: 식량 -${sell}, 금 +${gain}`);
        }
      },
      {
        label: '목재 판매(+금)',
        apply: () => {
          const sell = Math.min(s.wood, 25);
          const gain = Math.floor(sell * 1.5);
          s.wood -= sell; s.gold += gain;
          log(`목재 판매: 목재 -${sell}, 금 +${gain}`);
        }
      },
      {
        label: '식량 구매(-금)',
        apply: () => {
          const buy = 40;
          const cost = 35;
          s.gold -= cost; s.food = Math.min(s.storageCap, s.food + buy);
          log(`식량 구매: 금 -${cost}, 식량 +${buy}`);
        }
      },
    ]
  },
  {
    id: 'disease',
    title: '전염병 확산',
    body: '열병이 퍼지고 있습니다. 대처에 따라 사망/불만이 달라집니다.',
    weight: (s) => 0.35 + (50 - s.happiness) / 120,
    choices: (s) => [
      {
        label: '격리·치료(금 지출)',
        apply: () => {
          const cost = 30;
          s.gold -= cost;
          const base = 2 + randInt(0, 4);
          const deaths = Math.max(0, Math.floor(base * (1 - s.diseaseMitigation)));
          applyDeaths(deaths);
          s.legitimacy = clamp(s.legitimacy + 1, 0, 100);
          log(`대응 성공: 금 -${cost}, 사망 ${deaths}, 정통성 +1`);
        }
      },
      {
        label: '기도/축제(행복↑, 하지만 위험)',
        apply: () => {
          s.happiness = clamp(s.happiness + 3, 0, 100);
          const base = 3 + randInt(0, 6);
          const deaths = Math.max(0, Math.floor(base * (1 - s.diseaseMitigation * 0.6)));
          applyDeaths(deaths);
          s.legitimacy = clamp(s.legitimacy - 1, 0, 100);
          log(`혼합 결과: 행복 +3, 사망 ${deaths}, 정통성 -1`);
        }
      },
      {
        label: '방치한다',
        apply: () => {
          const base = 4 + randInt(0, 8);
          const deaths = Math.max(0, Math.floor(base * (1 - s.diseaseMitigation * 0.2)));
          applyDeaths(deaths);
          s.happiness = clamp(s.happiness - 4, 0, 100);
          s.legitimacy = clamp(s.legitimacy - 2, 0, 100);
          log(`방치: 사망 ${deaths}, 행복 -4, 정통성 -2`);
        }
      },
    ]
  },
];

/** ---------- State ---------- */
let state = newGame();

function newGame() {
  return {
    day: 1,
    seasonIndex: 0,
    population: 32,
    housing: 40,
    happiness: 62,
    security: 50,
    legitimacy: 55,

    // Resources
    food: 120,
    wood: 50,
    stone: 30,
    gold: 80,

    storageCap: 220,

    // Buildings (counts)
    buildings: Object.fromEntries(BUILDINGS.map(b => [b.id, 0])),

    // Production modifiers
    farmBonus: 0.0,
    raidMitigation: 0.0,
    diseaseMitigation: 0.0,

    // Jobs
    jobs: {
      farmer: 10,
      woodcutter: 6,
      builder: 2,
      guard: 2,
    },

    // Tax (weekly)
    taxRate: 10,

    // Temporary buffs/debuffs
    temp: {
      farmBuffDays: 0,
      farmBuffMult: 1.0,
      farmDebuffDays: 0,
      farmDebuffMult: 1.0,
    },

    // Log
    log: ['게임 시작! (하루 진행을 눌러 시작)'],
  };
}

/** ---------- Utilities ---------- */
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand() { return Math.random(); }
function randInt(min, max) { return Math.floor(min + rand() * (max - min + 1)); }
function fmt(n) { return (Math.round(n * 100) / 100).toString(); }
function season() { return SEASONS[state.seasonIndex]; }
function workforce() { return Math.floor(state.population * 0.62); }

function log(msg) {
  state.log.push(`[Day ${state.day}] ${msg}`);
  if (state.log.length > 200) state.log.shift();
  render();
}

function applyDeaths(deaths) {
  if (deaths <= 0) return;
  state.population = Math.max(0, state.population - deaths);
  // Keep job counts within workforce
  normalizeJobsToWorkforce();
}

function normalizeJobsToWorkforce() {
  const w = workforce();
  const sum = Object.values(state.jobs).reduce((a,b)=>a+b,0);
  if (sum <= w) return;
  // reduce builder first, then guards, then woodcutters, then farmers
  const order = ['builder','guard','woodcutter','farmer'];
  let over = sum - w;
  for (const id of order) {
    const cut = Math.min(state.jobs[id], over);
    state.jobs[id] -= cut;
    over -= cut;
    if (over <= 0) break;
  }
}

/** ---------- Simulation ---------- */
function tickDay() {
  // 1) Season progression (every 30 days)
  if (state.day > 1 && (state.day - 1) % 30 === 0) {
    state.seasonIndex = (state.seasonIndex + 1) % SEASONS.length;
    log(`계절 변화: ${season().name}`);
  }

  // 2) Pay upkeep
  const upkeepGold = BUILDINGS.reduce((acc, b) => acc + (b.upkeep?.gold || 0) * (state.buildings[b.id] || 0), 0)
    + state.jobs.guard * 0.6; // guards daily wage
  if (upkeepGold > 0) state.gold -= upkeepGold;

  // 3) Production
  const w = workforce();
  const sumJobs = Object.values(state.jobs).reduce((a,b)=>a+b,0);
  if (sumJobs > w) normalizeJobsToWorkforce();

  const s = season();
  const farmMult = s.farmMult * (1 + state.farmBonus);

  const buffMult = (state.temp.farmBuffDays > 0 ? state.temp.farmBuffMult : 1.0);
  const debuffMult = (state.temp.farmDebuffDays > 0 ? state.temp.farmDebuffMult : 1.0);

  const farmerFood = state.jobs.farmer * 2.2 * farmMult * buffMult * debuffMult;
  const woodGain = state.jobs.woodcutter * 1.6;
  const stoneGain = state.jobs.builder * 0.25; // builders also quarry a little (simplified)

  // Storage cap only for food in MVP
  state.food = Math.min(state.storageCap, state.food + farmerFood);
  state.wood = Math.max(0, state.wood + woodGain);
  state.stone = Math.max(0, state.stone + stoneGain);

  // 4) Consumption
  const consume = state.population * 1.05;
  state.food -= consume;

  // 5) Effects of shortage / surplus
  if (state.food < 0) {
    const deficit = Math.abs(state.food);
    state.food = 0;
    // starvation: happiness, security, legitimacy suffer; possible deaths
    state.happiness = clamp(state.happiness - (2 + deficit / 20), 0, 100);
    state.security = clamp(state.security - 1, 0, 100);
    state.legitimacy = clamp(state.legitimacy - 1.5, 0, 100);
    const deaths = rand() < clamp(deficit / 120, 0.05, 0.35) ? randInt(1, 2) : 0;
    applyDeaths(deaths);
    if (deaths > 0) log(`기근 발생: 식량 부족(${fmt(deficit)}). 사망 ${deaths}.`);
    else log(`기근 경고: 식량 부족(${fmt(deficit)}).`);
  } else {
    // stable food improves happiness a bit
    state.happiness = clamp(state.happiness + 0.4, 0, 100);
  }

  // 6) Tax & legitimacy pressure (daily), tax income weekly
  const dailyTaxPressure = state.taxRate / 30; // 0~1
  state.happiness = clamp(state.happiness - dailyTaxPressure * 0.9, 0, 100);
  state.legitimacy = clamp(state.legitimacy - dailyTaxPressure * 0.35, 0, 100);

  if (state.day % 7 === 0) {
    const income = Math.floor(state.population * (state.taxRate * 0.55));
    state.gold += income;
    log(`세금 징수(주간): 금 +${income} (세율 ${state.taxRate}%)`);
  }

  // 7) Crime drift (simplified): low happiness -> security down, guards help
  const guardHelp = state.jobs.guard * 0.35;
  const happinessPenalty = (55 - state.happiness) * 0.08; // if happiness below 55
  const secDelta = guardHelp - Math.max(0, happinessPenalty);
  state.security = clamp(state.security + secDelta, 0, 100);

  // 8) Migration (if housing available + good conditions)
  if (state.population < state.housing) {
    const attract = (state.happiness + state.security + state.legitimacy) / 3;
    if (rand() < clamp((attract - 55) / 200, 0, 0.12)) {
      state.population += 1;
      log('이주민 1명이 정착했습니다.');
    }
  } else {
    // overcrowding hurts happiness
    state.happiness = clamp(state.happiness - 0.8, 0, 100);
  }

  // 9) Decay temp buffs/debuffs
  if (state.temp.farmBuffDays > 0) state.temp.farmBuffDays -= 1;
  if (state.temp.farmDebuffDays > 0) state.temp.farmDebuffDays -= 1;

  // 10) Random event
  maybeTriggerEvent();

  // 11) End of day
  state.day += 1;
  render();
}

function maybeTriggerEvent() {
  // base chance increases a bit if things are unstable
  const instability = (50 - state.security) * 0.01 + (50 - state.happiness) * 0.008;
  const chance = clamp(0.12 + instability, 0.08, 0.30);

  // Don't trigger too often; roughly every ~5-10 days
  if (rand() > chance) return;

  // Weighted pick
  const weights = EVENTS.map(e => Math.max(0.01, e.weight(state)));
  const total = weights.reduce((a,b)=>a+b,0);
  let r = rand() * total;
  let picked = EVENTS[0];
  for (let i=0;i<EVENTS.length;i++) {
    r -= weights[i];
    if (r <= 0) { picked = EVENTS[i]; break; }
  }
  openEventModal(picked);
}

/** ---------- Building ---------- */
function canPay(cost) {
  return (state.wood >= (cost.wood||0)) &&
         (state.stone >= (cost.stone||0)) &&
         (state.gold >= (cost.gold||0)) &&
         (state.food >= (cost.food||0));
}

function pay(cost) {
  state.wood -= (cost.wood||0);
  state.stone -= (cost.stone||0);
  state.gold -= (cost.gold||0);
  state.food -= (cost.food||0);
}

function build(buildingId) {
  const b = BUILDINGS.find(x => x.id === buildingId);
  if (!b) return;
  if (!canPay(b.cost)) {
    log(`건설 실패: 자원이 부족합니다 (${b.name})`);
    return;
  }
  pay(b.cost);
  state.buildings[b.id] = (state.buildings[b.id] || 0) + 1;
  // apply effect immediately
  b.effect?.(state);
  log(`건설 완료: ${b.name} (+1)`);
  render();
}

/** ---------- UI Rendering ---------- */
const elStats = document.getElementById('stats');
const elHints = document.getElementById('hints');
const elJobs = document.getElementById('jobs');
const elBuildings = document.getElementById('buildings');
const elLog = document.getElementById('log');

const btnTick = document.getElementById('btnTick');
const btnAuto = document.getElementById('btnAuto');
const btnSave = document.getElementById('btnSave');
const btnLoad = document.getElementById('btnLoad');
const btnReset = document.getElementById('btnReset');

const taxRateInput = document.getElementById('taxRate');
const taxLabel = document.getElementById('taxLabel');

let autoTimer = null;

btnTick.addEventListener('click', () => tickDay());
btnAuto.addEventListener('click', () => toggleAuto());
btnSave.addEventListener('click', () => saveGame());
btnLoad.addEventListener('click', () => loadGame());
btnReset.addEventListener('click', () => resetGame());

taxRateInput.addEventListener('input', () => {
  state.taxRate = parseInt(taxRateInput.value, 10);
  taxLabel.textContent = `${state.taxRate}%`;
  render();
});

function toggleAuto() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    btnAuto.textContent = '자동 진행: OFF';
  } else {
    autoTimer = setInterval(() => tickDay(), 650);
    btnAuto.textContent = '자동 진행: ON';
  }
}

function badge(text) {
  const span = document.createElement('span');
  span.className = 'pill';
  span.textContent = text;
  return span;
}

function kv(key, value, sub=null) {
  const div = document.createElement('div');
  div.className = 'kv';
  const k = document.createElement('div');
  k.className = 'k';
  k.textContent = key;
  const v = document.createElement('div');
  v.className = 'v';
  v.textContent = value;
  div.appendChild(k); div.appendChild(v);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'sub';
    s.textContent = sub;
    div.appendChild(s);
  }
  return div;
}

function renderStats() {
  elStats.innerHTML = '';

  const w = workforce();
  const jobsSum = Object.values(state.jobs).reduce((a,b)=>a+b,0);
  const idle = Math.max(0, w - jobsSum);

  const foodDays = state.population > 0 ? (state.food / (state.population * 1.05)) : 0;

  elStats.appendChild(kv('Day / 계절', `Day ${state.day} · ${season().name}`, `30일마다 계절 변화`));
  elStats.appendChild(kv('인구 / 수용', `${state.population} / ${state.housing}`, state.population > state.housing ? '과밀: 행복 감소' : ''));
  elStats.appendChild(kv('노동력', `${w} (배치 ${jobsSum}, 유휴 ${idle})`, jobsSum > w ? '초과 배치: 자동으로 조정됨' : ''));

  elStats.appendChild(kv('식량', `${Math.floor(state.food)} / ${state.storageCap}`, `잔여 ${fmt(foodDays)}일`));
  elStats.appendChild(kv('목재 / 돌', `${Math.floor(state.wood)} / ${Math.floor(state.stone)}`, '건설·방어 핵심 자원'));
  elStats.appendChild(kv('금고', `${Math.floor(state.gold)}`, `주간 세금: Day ${state.day % 7 === 0 ? '오늘' : (7 - (state.day % 7)) + '일 후'}`));

  elStats.appendChild(kv('행복', `${Math.floor(state.happiness)}/100`, state.happiness < 45 ? '불만 증가: 치안 하락/이벤트 가중' : ''));
  elStats.appendChild(kv('치안', `${Math.floor(state.security)}/100`, state.security < 40 ? '약탈 위험 증가' : ''));
  elStats.appendChild(kv('정통성', `${Math.floor(state.legitimacy)}/100`, state.legitimacy < 40 ? '세금 저항/동요 위험' : ''));
}

function renderHints() {
  const tips = [];
  if (state.food < 40) tips.push('식량이 부족합니다: 농부를 늘리거나 상단 이벤트에서 구매하세요.');
  if (state.wood < 20) tips.push('목재가 부족합니다: 목수/벌목꾼을 늘려 건설 병목을 해소하세요.');
  if (state.security < 42) tips.push('치안이 낮습니다: 경비병을 늘리거나 성벽을 건설하세요.');
  if (state.taxRate > 18) tips.push('세율이 높습니다: 금은 늘지만 행복/정통성 압박이 큽니다.');
  if (state.population > state.housing) tips.push('과밀 상태입니다: 주거지를 건설해 수용 인구를 늘리세요.');
  if (state.gold < 0) tips.push('금고가 음수입니다: 유지비(선술집/의무소/경비병)를 줄이거나 세금을 조정하세요.');

  elHints.textContent = tips.length ? tips.map(t => `• ${t}`).join('\n') : '• 현재는 안정적입니다. (확장: 저장고/농장/성벽 순으로 고려)';
}

function renderJobs() {
  elJobs.innerHTML = '';
  const w = workforce();

  for (const j of JOBS) {
    const wrap = document.createElement('div');
    wrap.className = 'job-item';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = j.name;

    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = j.desc;

    const row = document.createElement('div');
    row.className = 'row2';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(w);
    input.value = String(state.jobs[j.id] || 0);

    const badgeEl = document.createElement('span');
    badgeEl.className = 'badge';
    badgeEl.textContent = `현재 ${state.jobs[j.id] || 0}`;

    input.addEventListener('change', () => {
      const v = clamp(parseInt(input.value || '0', 10), 0, 999);
      state.jobs[j.id] = v;
      normalizeJobsToWorkforce();
      render();
    });

    row.appendChild(input);
    row.appendChild(badgeEl);

    wrap.appendChild(name);
    wrap.appendChild(desc);
    wrap.appendChild(row);

    elJobs.appendChild(wrap);
  }

  taxRateInput.value = String(state.taxRate);
  taxLabel.textContent = `${state.taxRate}%`;
}

function renderBuildings() {
  elBuildings.innerHTML = '';

  for (const b of BUILDINGS) {
    const wrap = document.createElement('div');
    wrap.className = 'build-item';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = b.name;

    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = b.desc;

    const cost = document.createElement('div');
    cost.className = 'cost';
    for (const [k,v] of Object.entries(b.cost)) {
      cost.appendChild(badge(`${k}:${v}`));
    }
    if (b.upkeep?.gold) cost.appendChild(badge(`유지비 gold:${b.upkeep.gold}/일`));

    const actions = document.createElement('div');
    actions.className = 'actions';

    const btn = document.createElement('button');
    btn.textContent = '건설';
    btn.addEventListener('click', () => build(b.id));
    if (!canPay(b.cost)) btn.disabled = true;

    const count = document.createElement('div');
    count.className = 'count';
    count.textContent = `보유: ${state.buildings[b.id] || 0}`;

    actions.appendChild(btn);
    actions.appendChild(count);

    wrap.appendChild(name);
    wrap.appendChild(desc);
    wrap.appendChild(cost);
    wrap.appendChild(actions);

    elBuildings.appendChild(wrap);
  }
}

function renderLog() {
  elLog.textContent = state.log.slice(-120).join('\n');
  elLog.scrollTop = elLog.scrollHeight;
}

function render() {
  renderStats();
  renderHints();
  renderJobs();
  renderBuildings();
  renderLog();
}

/** ---------- Modal Events ---------- */
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalChoices = document.getElementById('modalChoices');

function openEventModal(ev) {
  // pause auto for decision clarity
  if (autoTimer) toggleAuto();

  modalTitle.textContent = ev.title;
  modalBody.textContent = ev.body;
  modalChoices.innerHTML = '';

  const choices = ev.choices(state);
  for (const c of choices) {
    const b = document.createElement('button');
    b.textContent = c.label;
    b.addEventListener('click', () => {
      closeModal();
      c.apply();
      render();
    });
    modalChoices.appendChild(b);
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

/** ---------- Save/Load ---------- */
const SAVE_KEY = 'castle_town_mvp_save_v1';

function saveGame() {
  const data = JSON.stringify(state);
  localStorage.setItem(SAVE_KEY, data);
  log('저장 완료 (localStorage).');
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { log('저장 데이터가 없습니다.'); return; }
  try {
    const obj = JSON.parse(raw);
    state = obj;
    // Ensure schema compatibility
    state.buildings ||= {};
    for (const b of BUILDINGS) state.buildings[b.id] ||= 0;
    state.jobs ||= { farmer:0, woodcutter:0, builder:0, guard:0 };
    for (const j of JOBS) state.jobs[j.id] ||= 0;
    state.temp ||= { farmBuffDays:0, farmBuffMult:1, farmDebuffDays:0, farmDebuffMult:1 };
    normalizeJobsToWorkforce();
    log('불러오기 완료.');
  } catch {
    log('불러오기 실패: 저장 데이터가 손상되었습니다.');
  }
  render();
}

function resetGame() {
  if (autoTimer) toggleAuto();
  state = newGame();
  render();
}

/** ---------- Init ---------- */
render();

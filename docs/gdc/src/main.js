import { VERSION, STORAGE_PREFIX } from './version.js';
import { loadSavedData, saveMeta, saveSavedData, getMetaUpgrades, getSettings, setSettings, resetMetaUpgrades, getMetaSpent, resetMetaSpent } from './storage.js';
import { $ } from './dom.js';
import { createUiLocker } from './uiLocker.js';
import { bindModal } from './modals.js';
import { bindSettingsUI } from './settings.js';
import { createDevTools } from './devTools.js';
import { createMetaUpgradesUi } from './metaUpgradesUi.js';
import { createFx } from './fx.js';
import { bindAudioUnlock, playSfx } from './audio.js';

const boot = () => {
        const statusEl = document.getElementById('debug-save-status');
        if (statusEl) statusEl.innerText = 'Loaded';
        const canvas = $('gameCanvas');
        const container = $('game-container');
        const ctx = canvas.getContext('2d');
        const versionToggle = $('version-toggle');
        const devPanel = $('dev-panel-overlay');
        const devBackdrop = $('dev-panel-backdrop');
        const devSheet = devPanel?.querySelector('.dev-sheet');
        const testConfigOverlay = $('test-config-overlay');
        const testConfigBackdrop = $('test-config-backdrop');
        const testConfigClose = $('test-config-close');
        const testWeaponSelect = $('test-weapon-select');
        const testApplyButton = $('test-apply-btn');
        const devGodButton = $('dev-god-btn');
        const devTestButton = $('dev-test-btn');
        const devTestOffButton = $('dev-test-off-btn');
        const optShakeEl = $('opt-shake');
        const optDmgTextEl = $('opt-dmgtext');
        const optSfxEl = $('opt-sfx');
        const retryBtn = document.getElementById('btn-retry');
        const testOffButton = $('test-off-btn');

        let gameState = 'LOBBY';
        let width, height;
        let lastTime = 0;
        let difficulty = 'NORMAL';
        let currentStage = 1;
        let isGodMode = false;
        let isTestStage = false;
        let orientationOverlayDismissed = false;
        let savedData = { clearData: { 'NORMAL': [1], 'HARD': [] }, resources: { fragments: 0, cores: 0 } };
        let tempResources = { fragments: 0, cores: 0 };
        const { settings, sync: syncSettingsUi } = bindSettingsUI({
            optShakeEl,
            optDmgTextEl,
            optSfxEl,
            getSettings,
            setSettings
        });
        const fx = createFx();
        const lastSfxTime = {
            cannon: 0,
            missile: 0,
            laser: 0,
            gravity: 0,
            barrier: 0,
            droplet: 0
        };

        let player = null;
        let enemies = [];
        let bullets = [];
        let enemyBullets = [];
        let particles = [];
        let drops = []; 
        let texts = [];
        let missiles = [];
        let gravityOrbs = [];
        let electroBarriers = [];
        let gameInfo = { wave: 1, hp: 100, maxHp: 100, spawnTimer: 0, level: 1, exp: 0, nextExp: 100, timeLeft: 90 };
        let metaUpgrades = getMetaUpgrades();
        let activeSpecialWeapons = new Set();
        const uiLocker = createUiLocker(container);
        let devTools = null;
        let devPanelModal = null;
        let testConfigModal = null;
        let metaUpgradesUi = null;

        if (retryBtn) {
            retryBtn.addEventListener('click', () => prepareGame(isTestStage));
        }

        const STAGE_COUNT = 50;
        const STAGE_NAMES = ["NEON GRID", "VOID SECTOR", "CRYSTAL CORE"];
        const TEST_MODE_ENABLED_KEY = `${STORAGE_PREFIX}:testModeEnabled`;
        const TEST_WEAPON_KEY = `${STORAGE_PREFIX}:testWeaponKey`;

        const getSpecialWeaponLabel = (key) => SPECIAL_WEAPON_LABELS[key] || key;

        const SKILL_POOL = [
            { id: 'atk', name: 'WEAPON DAMAGE', desc: '공격력 +25%', icon: '⚔️', type: 'stat', effect: () => { player.atk *= 1.25; } },
            { id: 'spd', name: 'FIRE RATE', desc: '공격 속도 +15%', icon: '🚀', type: 'stat', effect: () => { player.fireRate *= 0.85; } },
            { id: 'range', name: 'RADAR RANGE', desc: '인식 범위 +20%', icon: '📡', type: 'stat', effect: () => { player.range *= 1.2; } },
            { id: 'turn', name: 'TURRET MOTOR', desc: '회전 속도 +30%', icon: '⚙️', type: 'stat', effect: () => { player.turnSpeed *= 1.3; } },
            { id: 'multi', name: 'MULTI BARREL', desc: '투사체 개수 +1', icon: '💠', type: 'stat', effect: () => { player.multishot++; } },
            { id: 'hp', name: 'SHIELD REPAIR', desc: '최대 체력 +30 & 회복', icon: '❤️', type: 'stat', effect: () => { gameInfo.maxHp += 30; gameInfo.hp = gameInfo.maxHp; } },

            { id: 'unlock_missile', name: 'INSTALL MISSILE', desc: '미사일 포드 장착', icon: '🚀', type: 'unlock', weapon: 'missile', effect: () => { enableSpecialWeapon('missile'); } },
            { id: 'unlock_laser', name: 'INSTALL LASER', desc: '궤도 레이저 장착', icon: '🛰️', type: 'unlock', weapon: 'laser', effect: () => { enableSpecialWeapon('laser'); } },
            { id: 'unlock_gravity', name: 'INSTALL GRAVITY', desc: '중력포 장착', icon: '🌌', type: 'unlock', weapon: 'gravity', effect: () => { enableSpecialWeapon('gravity'); } },
            { id: 'unlock_droplet', name: 'INSTALL DROPLET', desc: '물방울 프로브 장착', icon: '💧', type: 'unlock', weapon: 'droplet', effect: () => { enableSpecialWeapon('droplet'); } },
            { id: 'unlock_barrier', name: 'INSTALL BARRIER', desc: '전자기 장벽 장착', icon: '⚡', type: 'unlock', weapon: 'barrier', effect: () => { enableSpecialWeapon('barrier'); } },

            { id: 'up_missile', name: 'MISSILE RELOAD', desc: '미사일 쿨다운 -20%', icon: '🚀', type: 'upgrade', weapon: 'missile', effect: () => { player.missileInterval *= 0.8; } },
            { id: 'up_laser', name: 'LASER RECHARGE', desc: '레이저 쿨다운 -20%', icon: '🛰️', type: 'upgrade', weapon: 'laser', effect: () => { player.laserInterval *= 0.8; } },
            { id: 'up_gravity', name: 'GRAVITY RECHARGE', desc: '중력포 쿨다운 -10%', icon: '🌌', type: 'upgrade', weapon: 'gravity', effect: () => { player.gravityInterval *= 0.9; } },
            { id: 'up_droplet', name: 'DROPLET CHARGE', desc: '물방울 충전 -10%', icon: '💧', type: 'upgrade', weapon: 'droplet', effect: () => { player.droplet.maxCooldown *= 0.9; } },
            { id: 'up_barrier', name: 'BARRIER RECHARGE', desc: '장벽 쿨다운 -15%', icon: '⚡', type: 'upgrade', weapon: 'barrier', effect: () => { player.barrierInterval *= 0.85; } }
        ];

        const SPECIAL_WEAPON_LABELS = {
            missile: '🚀 Missile Pod',
            laser: '🛰️ Orbital Laser',
            gravity: '🌌 Gravity Cannon',
            droplet: '💧 Droplet Probe',
            barrier: '⚡ Electro Barrier'
        };

        function init() {
            const versionLabel = document.getElementById('version-text');
            if (versionLabel) {
                versionLabel.innerText = VERSION;
            }
            document.title = `지오메트리 캐논 - ${VERSION}`;
            document.body.dataset.storagePrefix = STORAGE_PREFIX;
            bindAudioUnlock();
            saveMeta({ version: VERSION, updatedAt: Date.now() });
            loadGameData();
            metaUpgrades = getMetaUpgrades();
            resize();
            window.addEventListener('resize', resize);
            devPanelModal = bindModal({
                overlayEl: devPanel,
                backdropEl: devBackdrop,
                uiLocker,
                onOpen: () => {
                    versionToggle?.setAttribute('aria-expanded', 'true');
                },
                onClose: () => {
                    versionToggle?.setAttribute('aria-expanded', 'false');
                }
            });
            testConfigModal = bindModal({
                overlayEl: testConfigOverlay,
                closeBtnEl: testConfigClose,
                backdropEl: testConfigBackdrop,
                uiLocker
            });
            if (devSheet) {
                devSheet.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
            }
            devTools = createDevTools({
                storagePrefix: STORAGE_PREFIX,
                versionEl: versionToggle,
                uiLocker,
                onGodMode: activateGodMode,
                onOpenTestConfig: openTestConfig,
                onToggleDevPanel: toggleDevPanel,
                devTestOffButton,
                testOffButton,
                setTestModeState,
                setTestModeIndicator,
                closeTestConfig,
                closeDevPanel: () => devPanelModal?.close?.()
            });
            if (devGodButton) {
                devGodButton.addEventListener('click', activateGodMode);
            } else {
                console.warn('[DEV] GOD MODE 버튼을 찾을 수 없습니다.');
            }
            if (devTestButton) {
                devTestButton.addEventListener('click', openTestConfig);
            } else {
                console.warn('[DEV] TEST STAGE 버튼을 찾을 수 없습니다.');
            }
            if (testApplyButton) {
                testApplyButton.addEventListener('click', applyTestConfig);
            }
            setTestModeIndicator(getTestModeState().enabled);
            metaUpgradesUi = createMetaUpgradesUi({
                overlay: document.getElementById('meta-upgrade-overlay'),
                listEl: document.getElementById('meta-upgrade-list'),
                fragmentsEl: document.getElementById('meta-upgrade-fragments'),
                coresEl: document.getElementById('meta-upgrade-cores'),
                closeButton: document.getElementById('meta-upgrade-close'),
                backdrop: document.getElementById('meta-upgrade-backdrop'),
                uiLocker,
                getSavedData: () => savedData,
                saveGameData,
                onMetaUpgradesChange: (upgrades) => {
                    metaUpgrades = upgrades;
                }
            });
            setupOverlayActions();
            bindMetaResetButton();
            syncSettingsUi();
            updateLobbyUI();
            requestAnimationFrame(loop);
        }

        // --- Helper Functions ---
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const playWeaponSfx = (name, cooldownMs = 80, volume = 1) => {
            if (!settings?.sfx) return;
            const now = performance.now();
            if (now - (lastSfxTime[name] || 0) < cooldownMs) return;
            lastSfxTime[name] = now;
            playSfx(name, volume, settings.sfx);
        };
        function isOnScreen(x, y, pad = 24) {
            return x >= -pad && x <= width + pad && y >= -pad && y <= height + pad;
        }
        function isTargetableEnemy(enemy) {
            return !!enemy && !enemy.dead && isOnScreen(enemy.x, enemy.y, 24);
        }

        function getStageConfig(stage, difficultyLevel) {
            const isHard = difficultyLevel === 'HARD';
            const s = Math.max(1, stage);

            const duration = 90;

            let spawnInterval = 0.88 - s * 0.010;
            spawnInterval = Math.max(0.33, spawnInterval);

            let maxOnField = 24 + Math.floor(s * 1.2);
            maxOnField = Math.min(85, maxOnField);

            let hpMul = 0.95 + s * 0.055;
            let speedMul = 0.98 + s * 0.012;

            let eliteChance = 0.07 + s * 0.002;
            eliteChance = Math.min(0.20, eliteChance);

            let runnerChance = 0.18 + s * 0.004;
            runnerChance = Math.min(0.40, runnerChance);

            let tankChance = 0.08 + s * 0.0025;
            tankChance = Math.min(0.22, tankChance);

            let siegeChance = s < 5 ? 0.00 : (0.03 + (s - 5) * 0.003);
            siegeChance = Math.min(0.16, siegeChance);

            if (isHard) {
                spawnInterval = Math.max(0.28, spawnInterval * 0.85);
                maxOnField = Math.min(100, maxOnField + 10);
                hpMul *= 1.15;
                speedMul *= 1.06;
                eliteChance = Math.min(0.28, eliteChance + 0.05);

                runnerChance = Math.min(0.48, runnerChance + 0.06);
                tankChance = Math.min(0.26, tankChance + 0.04);
                siegeChance = Math.min(0.22, Math.max(0.03, siegeChance + 0.05));
            }

            return {
                duration,
                spawnInterval,
                maxOnField,
                hpMul,
                speedMul,
                eliteChance,
                runnerChance,
                tankChance,
                siegeChance
            };
        }

        function getSpecialWeaponKeys() {
            const keys = new Set();
            SKILL_POOL.forEach((skill) => {
                if (skill.type === 'unlock' && skill.weapon) {
                    keys.add(skill.weapon);
                }
            });
            const ordered = Object.keys(SPECIAL_WEAPON_LABELS).filter((key) => keys.has(key));
            keys.forEach((key) => {
                if (!ordered.includes(key)) ordered.push(key);
            });
            return ordered;
        }

        function getTestModeState() {
            return {
                enabled: localStorage.getItem(TEST_MODE_ENABLED_KEY) === '1',
                weaponKey: localStorage.getItem(TEST_WEAPON_KEY) || ''
            };
        }

        function setTestModeState(enabled, weaponKey) {
            localStorage.setItem(TEST_MODE_ENABLED_KEY, enabled ? '1' : '0');
            if (enabled && weaponKey) {
                localStorage.setItem(TEST_WEAPON_KEY, weaponKey);
            } else {
                localStorage.removeItem(TEST_WEAPON_KEY);
            }
        }

        function setTestModeIndicator(enabled) {
            const indicator = document.getElementById('test-mode-indicator');
            if (indicator) {
                indicator.classList.toggle('hidden', !enabled);
            }
        }

        function populateTestWeaponSelect() {
            if (!testWeaponSelect) return 0;
            const keys = getSpecialWeaponKeys();
            testWeaponSelect.innerHTML = '';
            keys.forEach((key) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = getSpecialWeaponLabel(key);
                testWeaponSelect.appendChild(option);
            });
            const saved = getTestModeState().weaponKey || '';
            if (saved && keys.includes(saved)) {
                testWeaponSelect.value = saved;
            } else if (keys.length > 0) {
                testWeaponSelect.value = keys[0];
            }
            return keys.length;
        }

        function toggleDevPanel() {
            if (!devPanelModal) return;
            if (devPanelModal.isHidden()) {
                devPanelModal.open();
            } else {
                devPanelModal.close();
            }
        }

        function applyTestConfig() {
            if (!testWeaponSelect) return;
            const weaponKey = testWeaponSelect.value;
            if (!weaponKey) {
                alert('특수 무기를 선택하세요.');
                return;
            }
            setTestModeState(true, weaponKey);
            setTestModeIndicator(true);
            closeTestConfig();
            devPanelModal?.close?.();
            alert('적용됨. START를 눌러 전투에서 확인하세요.');
        }

        function enableSpecialWeapon(weaponKey) {
            if (!player?.activeWeapons || !weaponKey) return;
            player.activeWeapons[weaponKey] = true;
            activeSpecialWeapons.add(weaponKey);
        }

        function syncActiveSpecialWeapons() {
            activeSpecialWeapons = new Set();
            if (!player?.activeWeapons) return;
            Object.entries(player.activeWeapons).forEach(([key, isActive]) => {
                if (isActive) activeSpecialWeapons.add(key);
            });
        }

        function getValidSkills() {
            return SKILL_POOL.filter(skill => {
                if (skill.type === 'stat') return true;
                if (skill.type === 'unlock') return !activeSpecialWeapons.has(skill.weapon);
                if (skill.type === 'upgrade') return !skill.weapon || activeSpecialWeapons.has(skill.weapon);
                return true;
            });
        }

        function buildSkillChoices(choiceCount, contextLabel) {
            const validSkills = getValidSkills();
            const choices = validSkills.sort(() => 0.5 - Math.random()).slice(0, Math.min(choiceCount, validSkills.length));
            const globalSkills = SKILL_POOL.filter(skill => skill.type === 'stat');
            const seen = new Set(choices.map(skill => skill.id));

            if (choices.length < choiceCount) {
                const filler = globalSkills.filter(skill => !seen.has(skill.id));
                filler.sort(() => 0.5 - Math.random()).forEach((skill) => {
                    if (choices.length >= choiceCount) return;
                    choices.push(skill);
                    seen.add(skill.id);
                });
            }

            if (choices.length < choiceCount) {
                const fallbackPool = globalSkills.length ? globalSkills : (validSkills.length ? validSkills : SKILL_POOL);
                while (choices.length < choiceCount && fallbackPool.length > 0) {
                    choices.push(fallbackPool[Math.floor(Math.random() * fallbackPool.length)]);
                }
            }

            if (devTools?.enabled) {
                console.log(`[DEV] ${contextLabel}`, {
                    activeSpecialWeapons: Array.from(activeSpecialWeapons),
                    choices: choices.map((skill) => skill.id)
                });
            }

            return choices;
        }

        function updateLobbyUI() {
            const color = difficulty === 'NORMAL' ? '#00ffff' : '#ff3366';
            document.getElementById('stage-num').innerText = `STAGE ${currentStage.toString().padStart(2,'0')}`;
            document.getElementById('stage-num').style.color = color;

            document.getElementById('stage-name').innerText = STAGE_NAMES[(currentStage-1)%STAGE_NAMES.length];

            const isCleared = savedData.clearData[difficulty].includes(currentStage);
            const isPlayable = (currentStage === 1) || savedData.clearData[difficulty].includes(currentStage - 1);

            const statusText = document.getElementById('status-text');
            const statusDot = document.getElementById('status-dot');
            const startBtn = document.getElementById('start-btn');

            if (isCleared) {
                statusText.innerText = "CLEARED";
                statusText.style.color = color;
                statusDot.style.backgroundColor = color;
                statusDot.style.boxShadow = `0 0 8px ${color}`;

                startBtn.disabled = false;
                startBtn.classList.remove('opacity-40', 'pointer-events-none');
                startBtn.innerText = "START";
            } else if (isPlayable) {
                statusText.innerText = "READY";
                statusText.style.color = "#9afcff";
                statusDot.style.backgroundColor = "#00ffff";
                statusDot.style.boxShadow = `0 0 8px #00ffff`;

                startBtn.disabled = false;
                startBtn.classList.remove('opacity-40', 'pointer-events-none');
                startBtn.innerText = "START";
            } else {
                statusText.innerText = "LOCKED";
                statusText.style.color = "#555";
                statusDot.style.backgroundColor = "#333";
                statusDot.style.boxShadow = "none";

                startBtn.disabled = true;
                startBtn.classList.add('opacity-40', 'pointer-events-none');
                startBtn.innerText = "LOCKED";
            }

            document.getElementById('lobby-fragments').innerText = savedData.resources.fragments;
            document.getElementById('lobby-cores').innerText = savedData.resources.cores;
        }

        function updateIngameResources() {
            document.getElementById('ingame-fragments').innerText = tempResources.fragments;
            document.getElementById('ingame-cores').innerText = tempResources.cores;
        }

        function updateIngameUI() {
            const hpPct = Math.max(0, (gameInfo.hp/gameInfo.maxHp)*100); 
            document.getElementById('hp-bar').style.width = `${hpPct}%`; 
            document.getElementById('hp-text').innerText = `${Math.ceil(gameInfo.hp)}/${gameInfo.maxHp}`;
            document.getElementById('level-text').innerText = gameInfo.level; 
            const expPct = Math.floor((gameInfo.exp / gameInfo.nextExp) * 100); 
            document.getElementById('exp-bar').style.width = `${expPct}%`; 
            document.getElementById('exp-text').innerText = `${expPct}%`;
            document.getElementById('ingame-stage').innerText = currentStage;
            updateIngameResources();
        }

        function registerEnemyHit(enemy, damage, options = {}) {
            if (!enemy) return;
            const hitTime = options.hitTime ?? 0.1;
            enemy.hitTimer = Math.max(enemy.hitTimer || 0, hitTime);
            if (settings.dmgText) {
                const value = Math.max(1, Math.floor(damage));
                fx.damageText.spawn(enemy.x, enemy.y - 6, value);
            }
            if (options.burst !== false) {
                const burst = options.burst || {};
                fx.particles.spawnBurst(
                    enemy.x,
                    enemy.y,
                    burst.count ?? 5,
                    burst.speed ?? 70,
                    burst.life ?? 0.4,
                    burst.sizeRange ?? [1, 2.4],
                    burst.color ?? 'rgba(200,255,255,0.9)'
                );
            }
        }

        function registerEnemyDeath(enemy, options = {}) {
            if (!enemy) return;
            const burst = options.burst || {};
            fx.particles.spawnBurst(
                enemy.x,
                enemy.y,
                burst.count ?? 12,
                burst.speed ?? 120,
                burst.life ?? 0.6,
                burst.sizeRange ?? [1.6, 3.4],
                burst.color ?? 'rgba(200,255,255,0.95)'
            );
        }

        function updateOrientationOverlay() {
            const overlay = document.getElementById('rotate-overlay');
            if (!overlay) return;
            const shortSide = Math.min(window.innerWidth, window.innerHeight);
            if (shortSide >= 600) {
                overlay.classList.add('hidden');
                return;
            }
            const isLandscape = window.innerWidth > window.innerHeight;
            if (!isLandscape) {
                orientationOverlayDismissed = false;
                overlay.classList.add('hidden');
                return;
            }
            overlay.classList.toggle('hidden', orientationOverlayDismissed);
        }

        function resize() {
            const dpr = window.devicePixelRatio || 1;

            // 모바일 주소창/툴바 변화 대응
            container.style.height = `${window.innerHeight}px`;

            const displayWidth = container.clientWidth;
            const displayHeight = container.clientHeight;

            canvas.width = Math.floor(displayWidth * dpr);
            canvas.height = Math.floor(displayHeight * dpr);

            width = displayWidth;
            height = displayHeight;

            // 스케일 누적 방지
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            // 로비/준비 상태에서 플레이어를 중앙 정렬 (존재할 때만)
            if (player && (gameState === 'LOBBY' || gameState === 'READY')) {
                player.x = width / 2;
                player.y = height / 2;
            }

            updateOrientationOverlay();
        }

        function drawGrid() {
            if (!ctx) return;
            ctx.strokeStyle = '#222'; 
            ctx.lineWidth = 1;
            for(let x=0; x<width; x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke(); }
            for(let y=0; y<height; y+=50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke(); }
        }

        function resetGameData() {
            enemies = []; bullets = []; enemyBullets = []; particles = []; drops = []; texts = []; 
            missiles = []; gravityOrbs = []; electroBarriers = [];
            tempResources = { fragments: 0, cores: 0 };
            fx.reset();
        }

        function applyTestModeToPlayer(playerData) {
            const testState = getTestModeState();
            if (!testState.enabled) {
                setTestModeIndicator(false);
                return;
            }
            const validKeys = getSpecialWeaponKeys();
            if (!testState.weaponKey || !validKeys.includes(testState.weaponKey)) {
                setTestModeState(false, '');
                setTestModeIndicator(false);
                alert('TEST MODE 설정이 유효하지 않아 해제되었습니다.');
                return;
            }
            const activeWeapons = { missile: false, laser: false, gravity: false, droplet: false, barrier: false };
            if (Object.prototype.hasOwnProperty.call(activeWeapons, testState.weaponKey)) {
                activeWeapons[testState.weaponKey] = true;
                playerData.activeWeapons = activeWeapons;
                syncActiveSpecialWeapons();
            }
            setTestModeIndicator(true);
        }

        // --- Logic ---
        function prepareGame(testMode) {
            isTestStage = testMode;
            if (!isTestStage && currentStage > 1) {
                const prevStageCleared = savedData.clearData[difficulty].includes(currentStage - 1);
                if (!prevStageCleared) { alert("🚫 이전 스테이지를 먼저 클리어해주세요!"); return; }
            }

            gameState = 'READY';
            devPanelModal?.close?.();
            testConfigModal?.close?.();
            metaUpgradesUi?.close?.();
            ['lobby-ui', 'clear-overlay', 'gameover-popup', 'quit-overlay', 'test-config-overlay'].forEach(id => document.getElementById(id).classList.add('hidden'));
            document.getElementById('ingame-ui').classList.remove('hidden');
            
            resetGameData();
            updateIngameResources();

            let stageTime = getStageConfig(currentStage, difficulty).duration;
            if (isGodMode) stageTime = 10;
            if (isTestStage) stageTime = 300;

            gameInfo = { wave: 1, hp: 100, maxHp: 100, spawnTimer: 0, level: 1, exp: 0, nextExp: 150, timeLeft: stageTime, startChoices: 3, rerolls: 0, pickupMultiplier: 1 };
            
            player = { 
                x: width/2, y: height/2, rotation: 0, 
                atk: 4, fireRate: 0.4, lastShot: 0, multishot: 1, bulletSpeed: 600, bulletSize: 2, 
                range: Math.min(width, height) * 0.35, turnSpeed: Math.PI, visible: true,
                
                target: null,

                activeWeapons: { missile: false, laser: false, gravity: false, droplet: false, barrier: false },

                missileTimer: 0, missileInterval: 3.0, missileDmg: 15,
                laserTimer: 0, laserInterval: 3.0, laserDmg: 8, laserOrbitRot: 0, laserDuration: 0.2, laserActive: false, laserTargetPos: null,
                gravityTimer: 0, gravityInterval: 8.0,
                barrierTimer: 0, barrierInterval: 6.0,
                droplet: { active: true, state: 'ORBIT', x: 0, y: 0, rot: 0, orbitAngle: 0, chainCount: 0, maxChains: 5, target: null, waitTimer: 0, aimDuration: 1.0, cooldown: 0, maxCooldown: 5.0, hitList: [], velocity: {x:0, y:0}, dmg: 50, speed: 1200, oobTimer: 0 }
            };

            activeSpecialWeapons = new Set();
            applyMetaUpgrades();
            applyTestModeToPlayer(player);
            syncActiveSpecialWeapons();
            
            updateIngameUI();

            if (!isTestStage) {
                showSkillSelection(() => startBattleSequence());
            } else {
                startBattleSequence();
            }
        }

        function startBattleSequence() {
            const msgBox = document.getElementById('center-msg-overlay');
            const msgText = document.getElementById('center-msg-text');
            if (isTestStage) { msgText.innerText = "WEAPON TEST MODE"; msgText.style.color = "#ffaa00"; } 
            else { msgText.innerText = "적이 몰려옵니다 !!!"; msgText.style.color = "#ffffff"; }
            msgText.className = "text-4xl md:text-6xl font-black italic text-center glow-text tracking-tighter msg-pop leading-tight";
            msgBox.classList.remove('hidden');
            
            const min = Math.floor(gameInfo.timeLeft / 60);
            const sec = Math.floor(gameInfo.timeLeft % 60);
            document.getElementById('timer-text').innerText = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.00`;

            setTimeout(() => { msgBox.classList.add('hidden'); startGame(); }, 1500);
        }

        function showSkillSelection(callback) {
            gameState = 'UPGRADE';
            const overlay = document.getElementById('upgrade-overlay');
            const container = document.getElementById('card-container');
            const title = document.querySelector('#upgrade-overlay h2');
            if(title) title.innerText = "STARTING PERK";
            
            container.innerHTML = '';
            
            const choiceCount = gameInfo.startChoices || 3;
            const choices = buildSkillChoices(choiceCount, 'STARTING PERK');
            
            choices.forEach(skill => {
                const card = document.createElement('div');
                let borderClass = 'border-cyan-500/30 hover:border-cyan-400';
                if(skill.type === 'unlock') borderClass = 'border-yellow-500/50 hover:border-yellow-400';

                card.className = `skill-card rounded-xl p-6 flex flex-col items-center gap-3 bg-black/80 border ${borderClass} transition-all cursor-pointer`;
                card.innerHTML = `<div class="text-4xl mb-2">${skill.icon}</div><div class="text-cyan-400 font-bold text-lg tracking-wider">${skill.name}</div><div class="text-gray-400 text-xs text-center">${skill.desc}</div>`;
                card.onclick = () => {
                    skill.effect(); 
                    overlay.classList.add('hidden'); 
                    if (callback) callback();
                    else {
                        gameState = 'PLAYING';
                        createParticles(player.x, player.y, '#00ffff', 30);
                        updateIngameUI();
                    }
                };
                container.appendChild(card);
            });
            overlay.classList.remove('hidden');
        }

        function startGame() {
            gameState = 'PLAYING';
            const cfg = getStageConfig(currentStage, difficulty);
            spawnEnemy(cfg);
        }

        function loop(timestamp) {
            if (!lastTime) lastTime = timestamp; // 첫 프레임 안정화
            let dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            // 백그라운드 복귀/렉 대비 dt 클램프
            dt = Math.min(dt, 0.05);
            fx.update(dt);

            try {
                ctx.fillStyle = '#050505';
                ctx.fillRect(0, 0, width, height);
                const shakeOffset = settings.shake ? fx.shake.getOffset() : { x: 0, y: 0 };
                ctx.save();
                ctx.translate(shakeOffset.x, shakeOffset.y);
                drawGrid();

                if (gameState === 'PLAYING') {
                    updateGame(dt);
                    drawGame();
                } else if (['UPGRADE', 'CLEAR', 'PAUSED', 'GAMEOVER', 'READY'].includes(gameState)) {
                    drawGame();
                }
                ctx.restore();
                fx.vignette.drawOverlay(ctx, width, height);
            } catch (e) {
                console.error("Game Loop Error:", e);
                gameState = 'PAUSED';
            }

            requestAnimationFrame(loop);
        }

        function updateGame(dt) {
            if (!player) return; 

            gameInfo.timeLeft -= dt;
            if (gameInfo.timeLeft <= 0) gameInfo.timeLeft = 0;
            const min = Math.floor(gameInfo.timeLeft / 60);
            const sec = Math.floor(gameInfo.timeLeft % 60);
            const ms = Math.floor((gameInfo.timeLeft % 1) * 100);
            document.getElementById('timer-text').innerText = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}`;

            if (gameInfo.timeLeft <= 0 && enemies.length === 0) { stageClear(); return; }

            const cfg = getStageConfig(currentStage, difficulty);
            const stageElapsed = isTestStage ? 0 : Math.max(0, cfg.duration - gameInfo.timeLeft);
            const t = stageElapsed % 18;
            const rush = t < 6;
            const spawnMul = rush ? 0.75 : 1.0;
            let spawnRate = isTestStage ? 0.4 : cfg.spawnInterval * spawnMul;
            if (gameInfo.timeLeft > 3) {
                gameInfo.spawnTimer += dt;
                if (gameInfo.spawnTimer > spawnRate) {
                    if (enemies.length < cfg.maxOnField) {
                        spawnEnemy(cfg);
                    }
                    if (Math.random() < 0.12 && enemies.length <= cfg.maxOnField - 2) {
                        spawnEnemy(cfg);
                    }
                    gameInfo.spawnTimer = 0;
                }
            }

            if (player.visible) {
                if (player.activeWeapons.laser) {
                    player.laserOrbitRot += 2.0 * dt; player.laserTimer += dt;
                    if (player.laserActive) { player.laserTimer += dt; if (player.laserTimer > player.laserDuration) { player.laserActive = false; player.laserTimer = 0; } } 
                    else { if (player.laserTimer >= player.laserInterval) fireLaser(); }
                }
                if (player.activeWeapons.missile) { player.missileTimer += dt; if (player.missileTimer >= player.missileInterval) { fireMissile(); player.missileTimer = 0; } }
                if (player.activeWeapons.gravity) { player.gravityTimer += dt; if (player.gravityTimer >= player.gravityInterval) { fireGravity(); player.gravityTimer = 0; } }
                if (player.activeWeapons.droplet) updateDroplet(dt);
                if (player.activeWeapons.barrier) { player.barrierTimer += dt; if (player.barrierTimer >= player.barrierInterval) { fireBarrier(); player.barrierTimer = 0; } }
            }

            // Electro Barrier
            for (let i = electroBarriers.length - 1; i >= 0; i--) {
                const b = electroBarriers[i]; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
                const dx = Math.cos(b.rot + Math.PI/2) * b.width/2; const dy = Math.sin(b.rot + Math.PI/2) * b.width/2;
                const p1 = { x: b.x + dx, y: b.y + dy }; const p2 = { x: b.x - dx, y: b.y - dy };
                enemies.forEach(e => {
                    const dist = pointToLineDistance(e.x, e.y, p1.x, p1.y, p2.x, p2.y);
                    if (dist < e.size + 10) {
                        if (e.stunTimer <= 0) {
                            e.hp -= 2;
                            e.stunTimer = 1.0;
                            registerEnemyHit(e, 2, { hitTime: 0.08, burst: { count: 3, speed: 50, life: 0.3, sizeRange: [1, 2], color: 'rgba(210,255,255,0.9)' } });
                            if (e.hp <= 0) { registerEnemyDeath(e); createExplosion(e.x, e.y, e.color); spawnDrop(e.x, e.y, e.rank, e.rewardMul); gainExp(10); e.dead = true; }
                        }
                    }
                });
                if (b.life <= 0) electroBarriers.splice(i, 1);
            }
            // Gravity
            for (let i = gravityOrbs.length - 1; i >= 0; i--) {
                const g = gravityOrbs[i];
                if (g.state === 'move') { g.x += g.vx * dt; g.y += g.vy * dt; g.traveled += Math.hypot(g.vx * dt, g.vy * dt); if (g.traveled >= g.maxDist) g.state = 'hold'; } 
                else if (g.state === 'hold') { g.life -= dt; if (g.life <= 0) g.state = 'collapse'; } 
                else if (g.state === 'collapse') {
                    g.scale -= 2.0 * dt;
                    if (g.scale <= 0) {
                        createExplosion(g.x, g.y, '#8800ff', 20);
                        enemies.forEach(e => {
                            if (Math.hypot(g.x - e.x, g.y - e.y) < g.pullRange) {
                                e.hp -= 80;
                                texts.push({ x: e.x, y: e.y - 15, text: "CRUSH!", life: 1.0, color: '#8800ff' });
                                registerEnemyHit(e, 80, { hitTime: 0.12, burst: { count: 6, speed: 90, life: 0.45, sizeRange: [1.2, 2.6], color: 'rgba(200,240,255,0.9)' } });
                                if (e.hp <= 0) { registerEnemyDeath(e, { burst: { count: 16, speed: 140, life: 0.7 } }); createExplosion(e.x, e.y, e.color); spawnDrop(e.x, e.y, e.rank, e.rewardMul); gainExp(50); e.dead = true; }
                            }
                        });
                        gravityOrbs.splice(i, 1); continue;
                    }
                }
                if (g.state !== 'collapse') {
                    enemies.forEach(e => {
                        const dist = Math.hypot(g.x - e.x, g.y - e.y);
                        if (dist < g.pullRange) {
                            const angle = Math.atan2(g.y - e.y, g.x - e.x); e.x += Math.cos(angle) * g.pullForce * dt; e.y += Math.sin(angle) * g.pullForce * dt; e.hp -= g.dotDmg * dt;
                            if (Math.random() < 0.1) texts.push({ x: e.x, y: e.y - 10, text: "1", life: 0.3, color: '#aa55ff' });
                            if (e.hp <= 0 && !e.dead) { registerEnemyDeath(e); createExplosion(e.x, e.y, e.color); spawnDrop(e.x, e.y, e.rank, e.rewardMul); gainExp(10); e.dead = true; }
                        }
                    });
                }
            }
            for(let i=enemies.length-1; i>=0; i--) { if(enemies[i].dead) enemies.splice(i, 1); }
            // Drops
            for (let i = drops.length - 1; i >= 0; i--) {
                const d = drops[i];
                if (d.state === 'wait') { d.life -= dt; if (d.life <= 0) d.state = 'absorb'; } 
                else if (d.state === 'absorb') {
                    d.x += (player.x - d.x) * 5 * dt; d.y += (player.y - d.y) * 5 * dt;
                    if (Math.hypot(player.x - d.x, player.y - d.y) < 20) {
                        const multiplier = gameInfo.pickupMultiplier || 1;
                        if (d.type === 'fragment') tempResources.fragments += Math.round(d.val * multiplier);
                        else if (d.type === 'core') tempResources.cores += Math.round(d.val * multiplier);
                        createParticles(player.x, player.y, d.type === 'fragment' ? '#00ffff' : '#ffaa00', 5); drops.splice(i, 1); updateIngameResources();
                    }
                }
            }
            for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.y -= 20 * dt; t.life -= dt; if (t.life <= 0) texts.splice(i, 1); }

            let closest = null; let minDist = Infinity;
            enemies.forEach(e => {
                if (!isTargetableEnemy(e)) return;
                const d = Math.hypot(e.x - player.x, e.y - player.y);
                if (d <= player.range && d < minDist) { minDist = d; closest = e; }
            });

            if (closest && player.visible) {
                const targetAngle = Math.atan2(closest.y - player.y, closest.x - player.x);
                let diff = targetAngle - player.rotation;
                while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
                const maxRotate = player.turnSpeed * dt;
                if (Math.abs(diff) < maxRotate) player.rotation = targetAngle; else player.rotation += Math.sign(diff) * maxRotate;
                let currentDiff = targetAngle - player.rotation; while (currentDiff > Math.PI) currentDiff -= Math.PI * 2; while (currentDiff < -Math.PI) currentDiff += Math.PI * 2;
                if (Math.abs(currentDiff) < 0.05 && Date.now() - player.lastShot > player.fireRate * 1000) { shoot(); player.lastShot = Date.now(); }
            } else if (player.visible) { player.rotation += 0.5 * dt; }

            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                if (e.stunTimer > 0) {
                    e.stunTimer -= dt;
                    if (Math.random() < 0.2) createParticles(e.x, e.y, '#ffff00', 1);
                } else {
                    if (e.hitTimer > 0) e.hitTimer -= dt;
                    const angle = Math.atan2(player.y - e.y, player.x - e.x);
                    const dist = Math.hypot(player.x - e.x, player.y - e.y);
                    if (e.type === 'siege' && dist <= e.nearRange) {
                        e.x += Math.cos(angle) * e.speed * 0.25 * dt;
                        e.y += Math.sin(angle) * e.speed * 0.25 * dt;
                        e.shootCd -= dt;
                        if (e.shootCd <= 0) {
                            spawnEnemyBullet(e, player);
                            e.shootCd = e.shootInterval;
                        }
                    } else {
                        e.x += Math.cos(angle) * e.speed * dt;
                        e.y += Math.sin(angle) * e.speed * dt;
                    }
                }
                const contactRadius = e.size + 6;
                if (player.visible && Math.hypot(player.x - e.x, player.y - e.y) < contactRadius) {
                    gameInfo.hp -= e.contactDamage ?? 10;
                    createParticles(e.x, e.y, '#ff0000', 10);
                    if (settings.shake) fx.shake.start(8, 0.22);
                    fx.vignette.trigger(1, 0.3);
                    enemies.splice(i, 1);
                    updateIngameUI();
                    if (gameInfo.hp <= 0) gameOver();
                }
            }
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const b = enemyBullets[i];
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                b.life -= dt;
                if (!isOnScreen(b.x, b.y, 80) || b.life <= 0) {
                    enemyBullets.splice(i, 1);
                    continue;
                }
                const playerRadius = 10;
                if (player.visible && Math.hypot(b.x - player.x, b.y - player.y) < (b.r + playerRadius)) {
                    gameInfo.hp -= b.dmg;
                    createParticles(b.x, b.y, '#ff8855', 6);
                    if (settings.shake) fx.shake.start(3, 0.15);
                    fx.vignette.trigger(0.6, 0.2);
                    enemyBullets.splice(i, 1);
                    updateIngameUI();
                    if (gameInfo.hp <= 0) gameOver();
                }
            }
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i]; b.x += Math.cos(b.rot) * b.speed * dt; b.y += Math.sin(b.rot) * b.speed * dt;
                if(b.x < 0 || b.x > width || b.y < 0 || b.y > height) { bullets.splice(i, 1); continue; }
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const e = enemies[j];
                    if (Math.hypot(b.x - e.x, b.y - e.y) < (e.size + b.size)) {
                        e.hp -= player.atk;
                        registerEnemyHit(e, player.atk, { hitTime: 0.1, burst: { count: 5, speed: 80, life: 0.4, sizeRange: [1, 2.2] } });
                        bullets.splice(i, 1);
                        if (e.hp <= 0) { registerEnemyDeath(e, { burst: { count: 14, speed: 140, life: 0.7 } }); createExplosion(e.x, e.y, e.color); spawnDrop(e.x, e.y, e.rank, e.rewardMul); gainExp(20); e.dead = true; }
                        break;
                    }
                }
            }
            for (let i = missiles.length - 1; i >= 0; i--) {
                const m = missiles[i];
                if (!m.target || !enemies.includes(m.target) || !isTargetableEnemy(m.target)) {
                    let newTarget = null; let maxHp = -1;
                    enemies.forEach(e => {
                        if (!isTargetableEnemy(e)) return;
                        if (e.hp > maxHp) { maxHp = e.hp; newTarget = e; }
                    });
                    m.target = newTarget;
                }
                if (m.target) { const targetAngle = Math.atan2(m.target.y - m.y, m.target.x - m.x); let diff = targetAngle - m.rot; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2; m.rot += Math.sign(diff) * Math.min(Math.abs(diff), 3.0 * dt); }
                m.x += Math.cos(m.rot) * m.speed * dt; m.y += Math.sin(m.rot) * m.speed * dt; m.life -= dt; m.trailTimer -= dt;
                if (m.trailTimer <= 0) { particles.push({x: m.x, y: m.y, vx: 0, vy: 0, life: 0.5, color: '#ffaa00', size: 2}); m.trailTimer = 0.05; }
                if (m.target && Math.hypot(m.x - m.target.x, m.y - m.target.y) < (m.target.size + 5)) {
                    m.target.hp -= player.missileDmg;
                    registerEnemyHit(m.target, player.missileDmg, { hitTime: 0.16, burst: { count: 6, speed: 90, life: 0.45, sizeRange: [1.2, 2.6] } });
                    texts.push({ x: m.target.x, y: m.target.y - 15, text: "BOOM!", life: 0.8, color: '#ffaa00' });
                    createExplosion(m.x, m.y, '#ffaa00', 5);
                    if (m.target.hp <= 0) { registerEnemyDeath(m.target, { burst: { count: 16, speed: 150, life: 0.7 } }); createExplosion(m.target.x, m.target.y, m.target.color); spawnDrop(m.target.x, m.target.y, m.target.rank, m.target.rewardMul); gainExp(40); m.target.dead = true; }
                    missiles.splice(i, 1); continue;
                }
                if (m.life <= 1) missiles.splice(i, 1);
            }
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * (p.type === 'shockwave' ? 3 : 2);
                if (p.type === 'shockwave') p.size += 50 * dt; if(p.life <= 0) particles.splice(i, 1);
            }
        }

        // --- Drawing ---
        function drawGame() {
            if (!player) return;
            const color = difficulty === 'NORMAL' ? '#00ffff' : '#ff3366';
            
            if (player.visible) {
                ctx.save();
                ctx.beginPath(); ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 1.5; 
                ctx.arc(player.x, player.y, player.range, 0, Math.PI * 2); ctx.stroke();
                
                // [NEW] Gravity Orb Indicator (Always visible if equipped)
                if (player.activeWeapons.gravity) {
                    const ready = player.gravityTimer >= player.gravityInterval;
                    ctx.beginPath(); ctx.arc(player.x, player.y, 6, 0, Math.PI*2);
                    ctx.fillStyle = ready ? '#aa00ff' : '#440066'; 
                    ctx.shadowBlur = ready ? 15 : 0; ctx.shadowColor = '#aa00ff';
                    ctx.fill();
                }

                const orbitR = 30;
                const satX = player.x + Math.cos(player.laserOrbitRot) * orbitR;
                const satY = player.y + Math.sin(player.laserOrbitRot) * orbitR;
                if (player.activeWeapons.laser) {
                    ctx.save(); ctx.translate(satX, satY); ctx.rotate(player.laserOrbitRot + Math.PI/2);
                    ctx.fillStyle = '#333'; ctx.fillRect(-5, -5, 10, 10); ctx.fillStyle = '#ff00ff'; ctx.fillRect(-8, -2, 3, 4); ctx.fillRect(5, -2, 3, 4); ctx.restore();
                }
                ctx.restore();

                if (player.activeWeapons.laser && player.laserActive && player.laserTargetPos) {
                    const lSatX = player.x + Math.cos(player.laserOrbitRot) * orbitR;
                    const lSatY = player.y + Math.sin(player.laserOrbitRot) * orbitR;
                    ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff'; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(lSatX, lSatY); ctx.lineTo(player.laserTargetPos.ex, player.laserTargetPos.ey); ctx.strokeStyle = 'rgba(255, 0, 255, 0.2)'; ctx.lineWidth = 15; ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(lSatX, lSatY); ctx.lineTo(player.laserTargetPos.ex, player.laserTargetPos.ey); ctx.strokeStyle = '#ff66ff'; ctx.lineWidth = 4; ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(lSatX, lSatY); ctx.lineTo(player.laserTargetPos.ex, player.laserTargetPos.ey); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
                }
            }

            drops.forEach(d => {
                ctx.save(); ctx.translate(d.x, d.y);
                if (d.type === 'fragment') { ctx.fillStyle = '#00ffff'; ctx.shadowBlur = 5; ctx.shadowColor = '#00ffff'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 3); ctx.lineTo(-3, 3); ctx.fill(); } 
                else { ctx.fillStyle = '#ffaa00'; ctx.shadowBlur = 5; ctx.shadowColor = '#ffaa00'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill(); }
                ctx.restore();
            });

            gravityOrbs.forEach(g => {
                ctx.save(); ctx.translate(g.x, g.y); ctx.scale(g.scale, g.scale);
                if (g.state !== 'collapse') { ctx.beginPath(); ctx.arc(0, 0, g.pullRange, 0, Math.PI*2); ctx.fillStyle = 'rgba(130, 0, 255, 0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(130, 0, 255, 0.3)'; ctx.lineWidth = 1; ctx.stroke(); }
                const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.1;
                ctx.beginPath(); ctx.arc(0, 0, 10 * pulse, 0, Math.PI*2); ctx.fillStyle = '#220044'; ctx.fill(); ctx.strokeStyle = '#8800ff'; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 15; ctx.shadowColor = '#8800ff'; ctx.stroke(); ctx.restore();
                if (g.state !== 'collapse') {
                    enemies.forEach(e => { if (Math.hypot(g.x - e.x, g.y - e.y) < g.pullRange) { ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(e.x, e.y); ctx.strokeStyle = 'rgba(136, 0, 255, 0.4)'; ctx.lineWidth = 1; ctx.stroke(); } });
                }
            });

            const d = player.droplet;
            if (player.visible && d.active && player.activeWeapons.droplet) {
                ctx.save(); ctx.translate(d.x, d.y);
                if (d.state === 'ORBIT') ctx.rotate(d.orbitAngle + Math.PI/2); else ctx.rotate(Math.atan2(d.velocity.y, d.velocity.x) + Math.PI/2);
                ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff'; ctx.fillStyle = '#e0ffff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI, true); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
                if (d.state === 'AIMING' && d.target) {
                    ctx.restore(); ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(300, 0); ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'; ctx.setLineDash([2, 4]); ctx.stroke();
                    ctx.restore(); ctx.save(); 
                }
                ctx.restore();
            }

            electroBarriers.forEach(b => {
                ctx.save();
                const dx = Math.cos(b.rot + Math.PI/2) * b.width/2; const dy = Math.sin(b.rot + Math.PI/2) * b.width/2;
                const p1 = { x: b.x + dx, y: b.y + dy }; const p2 = { x: b.x - dx, y: b.y - dy };
                ctx.fillStyle = '#333'; ctx.shadowBlur = 5; ctx.shadowColor = '#ffff00';
                ctx.beginPath(); ctx.arc(p1.x, p1.y, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(p2.x, p2.y, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
                const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
                const jitter = (Math.random() - 0.5) * 10;
                ctx.lineTo(midX + jitter, midY + jitter); ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.stroke();
                ctx.restore();
            });

            enemies.forEach(e => {
                if (e.stunTimer > 0) { ctx.fillStyle = '#ffff00'; ctx.shadowColor = '#ffff00'; } 
                else { ctx.fillStyle = (e.hitTimer > 0) ? '#ffffff' : e.color; ctx.shadowColor = e.color; }
                ctx.shadowBlur = 5; ctx.beginPath();
                if (e.rank >= 2) { ctx.rect(e.x - e.size/2, e.y - e.size/2, e.size, e.size); ctx.strokeRect(e.x - e.size/2 - 2, e.y - e.size/2 - 2, e.size + 4, e.size + 4); } 
                else if (e.type === 'runner') { ctx.moveTo(e.x + Math.cos(0) * e.size, e.y + Math.sin(0) * e.size); ctx.lineTo(e.x + Math.cos(2.1) * e.size, e.y + Math.sin(2.1) * e.size); ctx.lineTo(e.x + Math.cos(4.2) * e.size, e.y + Math.sin(4.2) * e.size); } 
                else { ctx.rect(e.x - e.size/2, e.y - e.size/2, e.size, e.size); }
                ctx.fill(); ctx.stroke();
                if (e.hp < e.maxHp) {
                    const hpPct = e.hp / e.maxHp; const barW = 20;
                    ctx.fillStyle = '#555'; ctx.fillRect(e.x - barW/2, e.y - e.size - 8, barW, 3);
                    ctx.fillStyle = (hpPct > 0.5) ? '#00ff00' : (hpPct > 0.2 ? '#ffff00' : '#ff0000');
                    ctx.fillRect(e.x - barW/2, e.y - e.size - 8, barW * hpPct, 3);
                }
            });
            ctx.shadowBlur = 0;

            ctx.fillStyle = color;
            bullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI*2); ctx.fill(); });
            ctx.fillStyle = 'rgba(255, 120, 80, 0.9)';
            enemyBullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });

            missiles.forEach(m => {
                ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot); ctx.fillStyle = '#ffaa00';
                ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, 3); ctx.lineTo(-3, -3); ctx.fill(); ctx.restore();
            });

            ctx.font = 'bold 12px Pretendard'; ctx.textAlign = 'center';
            texts.forEach(t => { ctx.fillStyle = `rgba(${t.color === '#00ff00' ? '0,255,0' : (t.color === '#ff00ff' ? '255,0,255' : (t.color === '#ffaa00' ? '255,170,0' : '255,255,255'))}, ${t.life * 2})`; ctx.fillText(t.text, t.x, t.y); });

            particles.forEach(p => {
                ctx.globalAlpha = p.life;
                if (p.type === 'shockwave') { ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.stroke(); } 
                else { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size || 2, p.size || 2); }
            });
            ctx.globalAlpha = 1;

            fx.particles.draw(ctx);

            if (player.visible) {
                ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.rotation); ctx.shadowBlur = 15; ctx.shadowColor = color; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(20, 0); ctx.stroke(); ctx.fillStyle = '#333'; ctx.fillRect(0, -18, 10, 6); ctx.fillRect(0, 12, 10, 6); ctx.fillStyle = '#ffaa00'; if (player.missileTimer >= player.missileInterval) { ctx.fillRect(2, -16, 6, 2); ctx.fillRect(2, 14, 6, 2); } if (player.activeWeapons.gravity && player.gravityTimer >= player.gravityInterval) { ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fillStyle = '#8800ff'; ctx.fill(); } ctx.restore(); ctx.shadowBlur = 0;
            }

            fx.damageText.draw(ctx);
        }
        
        // --- Helper & Management ---
        function activateGodMode() {
            isGodMode = true;
            const totalStages = Number.isFinite(STAGE_COUNT) ? STAGE_COUNT : STAGE_NAMES.length;
            const allStages = Array.from({ length: totalStages }, (_, i) => i + 1);
            const normalSet = new Set(savedData.clearData.NORMAL || []);
            const hardSet = new Set(savedData.clearData.HARD || []);
            allStages.forEach((stage) => {
                normalSet.add(stage);
                hardSet.add(stage);
            });
            savedData.clearData.NORMAL = Array.from(normalSet).sort((a, b) => a - b);
            savedData.clearData.HARD = Array.from(hardSet).sort((a, b) => a - b);
            savedData.resources.fragments = Math.max(savedData.resources.fragments || 0, 100000);
            savedData.resources.cores = Math.max(savedData.resources.cores || 0, 100000);
            const ok = saveSavedData(savedData);
            document.getElementById('debug-save-status').innerText = ok ? "Saved OK" : "Save Failed";
            updateLobbyUI();
            alert('[GOD MODE enabled]\n- All stages unlocked\n- Fragments/Cores >= 100000');
        }
        function saveGameData() {
            const ok = saveSavedData(savedData);
            document.getElementById('debug-save-status').innerText = ok ? "Saved OK" : "Save Failed";
            updateLobbyUI();
        }
        function loadGameData() {
            const { data, migratedFrom } = loadSavedData();
            if (data) {
                savedData = data;
                if (!savedData.resources) savedData.resources = { fragments: 0, cores: 0 };
                if (!savedData.clearData) savedData.clearData = { 'NORMAL': [1], 'HARD': [] };
                document.getElementById('debug-save-status').innerText = migratedFrom ? `Migrated (${migratedFrom})` : "Loaded";
            } else {
                document.getElementById('debug-save-status').innerText = "New Game";
            }
        }
        function setDifficulty(diff) { difficulty = diff; document.getElementById('diff-normal').classList.toggle('active', diff === 'NORMAL'); document.getElementById('diff-hard').classList.toggle('active', diff === 'HARD'); updateLobbyUI(); }
        function changeStage(dir) { currentStage += dir; if(currentStage < 1) currentStage = STAGE_COUNT; if(currentStage > STAGE_COUNT) currentStage = 1; updateLobbyUI(); }
        function gameOver() { if (gameState === 'GAMEOVER') return; gameState = 'GAMEOVER'; createExplosion(player.x, player.y, '#00ffff', 50); player.visible = false; if (!isTestStage) { savedData.resources.fragments += tempResources.fragments; savedData.resources.cores += tempResources.cores; saveGameData(); } setTimeout(() => { document.getElementById('gameover-popup').classList.remove('hidden'); }, 1500); }
        function stageClear() { gameState = 'CLEAR'; if (!isTestStage) { savedData.resources.fragments += tempResources.fragments; savedData.resources.cores += tempResources.cores; if(!savedData.clearData[difficulty].includes(currentStage)) { savedData.clearData[difficulty].push(currentStage); } saveGameData(); } document.getElementById('clear-overlay').classList.remove('hidden'); }
        function quitGame() { returnToLobby(); }
        function showQuitPopup() { gameState = 'PAUSED'; document.getElementById('quit-overlay').classList.remove('hidden'); }
        function cancelQuit() { gameState = 'PLAYING'; document.getElementById('quit-overlay').classList.add('hidden'); }
        function nextStage() { currentStage++; if(currentStage > STAGE_COUNT) currentStage = 1; prepareGame(isTestStage); }
        function openTestConfig() {
            const optionCount = populateTestWeaponSelect();
            if (!optionCount) {
                alert('특수 무기 목록을 찾을 수 없습니다.');
                return;
            }
            devPanelModal?.close?.();
            testConfigModal?.open?.();
        }

        function closeTestConfig() {
            testConfigModal?.close?.();
        }

        function openMetaUpgradeModal() {
            metaUpgradesUi?.open?.();
        }

        function returnToLobby() {
            gameState = 'LOBBY';
            document.getElementById('ingame-ui').classList.add('hidden');
            document.getElementById('lobby-ui').classList.remove('hidden');
            metaUpgradesUi?.close?.();
            ['clear-overlay', 'gameover-popup', 'quit-overlay', 'test-config-overlay', 'upgrade-overlay'].forEach(id => document.getElementById(id).classList.add('hidden'));
            devPanelModal?.close?.();
            testConfigModal?.close?.();
            saveGameData(); 
            updateLobbyUI();
            syncSettingsUi();
        }

        function setupOverlayActions() {
            const rotateContinue = document.getElementById('rotate-continue');
            const upgrButton = document.getElementById('btn-upgr');
            if (rotateContinue) {
                rotateContinue.addEventListener('click', () => {
                    orientationOverlayDismissed = true;
                    updateOrientationOverlay();
                });
            }
            if (upgrButton) {
                upgrButton.addEventListener('click', () => metaUpgradesUi?.open?.());
            } else {
                console.warn('[UPGR] 버튼을 찾을 수 없습니다.');
            }
        }

        function bindMetaResetButton() {
            const resetButton = document.getElementById('btn-reset-meta');
            if (!resetButton) return;
            resetButton.addEventListener('click', () => {
                if (!confirm('메타 업그레이드를 리셋할까요? (자원은 환불됩니다)')) return;
                if (!confirm('정말 리셋할까요? 되돌릴 수 없습니다.')) return;
                const savedData = getSavedData?.() || {};
                if (!savedData.resources) {
                    savedData.resources = { fragments: 0, cores: 0 };
                }
                const spent = getMetaSpent();
                savedData.resources.fragments += spent?.fragments || 0;
                savedData.resources.cores += spent?.cores || 0;
                const ok = resetMetaUpgrades();
                const spentResetOk = resetMetaSpent();
                if (!ok || !spentResetOk) {
                    alert('리셋에 실패했습니다. 다시 시도해 주세요.');
                    return;
                }
                saveGameData?.();
                metaUpgradesUi?.syncMetaUpgrades?.();
                metaUpgrades = getMetaUpgrades();
                metaUpgradesUi?.renderMetaUpgradeList?.();
                updateLobbyUI();
                alert(`환불 완료: 파편 +${spent?.fragments || 0}, 코어 +${spent?.cores || 0}`);
            });
        }

        function applyMetaUpgrades() {
            metaUpgrades = getMetaUpgrades();
            const meta = metaUpgrades;
            if (!meta || !player || !gameInfo) return;
            if (meta.atk) player.atk *= (1 + 0.02 * meta.atk);
            if (meta.fireRate) player.fireRate /= (1 + 0.02 * meta.fireRate);
            if (meta.range) player.range *= (1 + 0.02 * meta.range);
            if (meta.maxHp) {
                gameInfo.maxHp *= (1 + 0.03 * meta.maxHp);
                gameInfo.hp = gameInfo.maxHp;
            }
            gameInfo.pickupMultiplier = 1 + 0.02 * (meta.pickup || 0);
            gameInfo.startChoices = Math.min(5, 3 + (meta.startChoices || 0));
            if (meta.startLevel) {
                gameInfo.level = 1 + meta.startLevel;
                gameInfo.exp = 0;
                gameInfo.nextExp = Math.floor(150 * Math.pow(1.35, gameInfo.level - 1));
            }
            gameInfo.rerolls = meta.rerolls || 0;
        }

        // --- Restored Missing Functions ---
        function gainExp(amount) {
            gameInfo.exp += amount;
            if (gameInfo.exp >= gameInfo.nextExp) {
                gameInfo.level++;
                gameInfo.exp = 0;
                gameInfo.nextExp = Math.floor(150 * Math.pow(1.35, gameInfo.level - 1));
                showLevelUpUI();
            }
            updateIngameUI();
        }

        function showLevelUpUI() {
            gameState = 'UPGRADE';
            const overlay = document.getElementById('upgrade-overlay');
            const container = document.getElementById('card-container');
            const title = document.querySelector('#upgrade-overlay h2');
            const sub = document.querySelector('#upgrade-overlay p');
            
            if(title) title.innerText = "LEVEL UP!";
            if(sub) sub.innerText = "SELECT UPGRADE MODULE";
            
            container.innerHTML = '';
            // [FIX] Valid Skill Selector using SKILL_POOL
            const choices = buildSkillChoices(3, 'LEVEL UP');
            
            choices.forEach(skill => {
                const card = document.createElement('div');
                let borderClass = 'border-cyan-500/30 hover:border-cyan-400';
                if(skill.type === 'unlock') borderClass = 'border-yellow-500/50 hover:border-yellow-400';

                card.className = `skill-card rounded-xl p-6 flex flex-col items-center gap-3 bg-black/80 border ${borderClass} transition-all cursor-pointer`;
                card.innerHTML = `<div class="text-4xl mb-2">${skill.icon}</div><div class="text-cyan-400 font-bold text-lg tracking-wider">${skill.name}</div><div class="text-gray-400 text-xs text-center">${skill.desc}</div>`;
                card.onclick = () => {
                    skill.effect(); 
                    overlay.classList.add('hidden'); 
                    gameState = 'PLAYING';
                    createParticles(player.x, player.y, '#00ffff', 30);
                    updateIngameUI();
                };
                container.appendChild(card);
            });
            overlay.classList.remove('hidden');
        }

        function spawnEnemyBullet(enemy, target) {
            const ang = Math.atan2(target.y - enemy.y, target.x - enemy.x);
            if (enemyBullets.length >= 140) {
                enemyBullets.splice(0, enemyBullets.length - 139);
            }
            enemyBullets.push({
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(ang) * enemy.bulletSpeed,
                vy: Math.sin(ang) * enemy.bulletSpeed,
                life: enemy.bulletLife,
                dmg: enemy.bulletDmg,
                r: enemy.bulletR
            });
        }

        function spawnEnemy(cfg) {
            if (!cfg) {
                cfg = getStageConfig(currentStage, difficulty);
            }
            const isVertical = Math.random() < 0.7; const buffer = 50;
            let x, y;
            if (isVertical) { x = Math.random() * width; y = (Math.random() < 0.5) ? -buffer : height + buffer; } 
            else { y = Math.random() * height; x = (Math.random() < 0.5) ? -buffer : width + buffer; }
            const roll = Math.random();
            let rank = 1;
            let type = 'normal';
            let size = 8;
            let hp = 12;
            let speed = 34;
            let contactDamage = 8;
            let color = '#ffffff';
            let rewardMul = 1;

            if (roll < cfg.siegeChance) {
                type = 'siege';
                size = 9;
                hp = 18;
                speed = 28;
                contactDamage = 9;
                color = '#ff8855';
            } else if (roll < cfg.siegeChance + cfg.tankChance) {
                type = 'tank';
                size = 11;
                hp = 36;
                speed = 22;
                contactDamage = 12;
                color = '#66aaff';
            } else if (roll < cfg.siegeChance + cfg.tankChance + cfg.runnerChance) {
                type = 'runner';
                size = 6;
                hp = 8;
                speed = 78;
                contactDamage = 7;
                color = '#ff3366';
            }

            hp *= cfg.hpMul;
            speed *= cfg.speedMul;

            if (Math.random() < cfg.eliteChance) {
                rank = 2;
                hp *= 2.2;
                size *= 1.25;
                speed *= 0.92;
                rewardMul = 1.2;
                color = '#ffaa00';
            }

            const enemy = {
                x: x,
                y: y,
                speed: speed,
                size: size,
                type: type,
                rank: rank,
                color: color,
                hp: hp,
                maxHp: hp,
                contactDamage: contactDamage,
                rewardMul: rewardMul,
                hitTimer: 0,
                stunTimer: 0
            };

            if (type === 'siege') {
                enemy.nearRange = 160;
                enemy.shootCd = 0;
                enemy.shootInterval = difficulty === 'HARD' ? 1.10 : 1.35;
                enemy.bulletSpeed = 250;
                enemy.bulletDmg = difficulty === 'HARD' ? 9 : 7;
                enemy.bulletLife = 2.6;
                enemy.bulletR = 2.4;
            }

            enemies.push(enemy);
        }
        function shoot() {
            const spread = 0.1;
            for(let i=0; i<player.multishot; i++) {
                const angleOffset = (player.multishot > 1) ? (i - (player.multishot-1)/2) * spread : 0;
                bullets.push({ x: player.x, y: player.y, rot: player.rotation + angleOffset, speed: player.bulletSpeed, size: player.bulletSize });
            }
            playWeaponSfx('cannon', 50, 0.9);
        }
        function createParticles(x, y, color, count) {
            for(let i=0; i<count; i++) { const a = Math.random() * Math.PI * 2; const s = Math.random() * 30 + 10; particles.push({x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1, color}); }
        }
        function fireMissile() {
            let target = null; let maxHp = -1;
            enemies.forEach(e => {
                if (!isTargetableEnemy(e)) return;
                if (e.hp > maxHp) { maxHp = e.hp; target = e; }
            });
            if (target) {
                const offset = 15;
                const spawnPoints = [{ x: player.x + Math.cos(player.rotation - Math.PI/2) * offset, y: player.y + Math.sin(player.rotation - Math.PI/2) * offset }, { x: player.x + Math.cos(player.rotation + Math.PI/2) * offset, y: player.y + Math.sin(player.rotation + Math.PI/2) * offset }];
                spawnPoints.forEach(p => { missiles.push({ x: p.x, y: p.y, rot: player.rotation, speed: 300, target: target, life: 3.0, trailTimer: 0 }); });
                playWeaponSfx('missile', 140, 0.9);
            }
        }
        function fireLaser() {
            let closest = null; let minDist = Infinity;
            enemies.forEach(e => {
                if (!isTargetableEnemy(e)) return;
                const d = Math.hypot(e.x - player.x, e.y - player.y);
                if (d < minDist) { minDist = d; closest = e; }
            });
            if (closest) {
                player.laserActive = true; player.laserTimer = 0; 
                const orbitR = 30; const lx = player.x + Math.cos(player.laserOrbitRot) * orbitR; const ly = player.y + Math.sin(player.laserOrbitRot) * orbitR;
                const angle = Math.atan2(closest.y - ly, closest.x - lx); const laserLen = Math.max(width, height) * 1.5;
                const ex = lx + Math.cos(angle) * laserLen; const ey = ly + Math.sin(angle) * laserLen;
                player.laserTargetPos = { sx: lx, sy: ly, ex: ex, ey: ey };
                enemies.forEach(e => {
                    const dist = pointToLineDistance(e.x, e.y, lx, ly, ex, ey);
                    if (dist < e.size + 5) {
                        e.hp -= player.laserDmg;
                        registerEnemyHit(e, player.laserDmg, { hitTime: 0.12, burst: { count: 4, speed: 80, life: 0.4, sizeRange: [1, 2.2], color: 'rgba(230,210,255,0.9)' } });
                        texts.push({ x: e.x, y: e.y - 15, text: "LASER!", life: 0.8, color: '#ff00ff' });
                        createParticles(e.x, e.y, '#ff00ff', 3);
                        if (e.hp <= 0) { registerEnemyDeath(e, { burst: { count: 14, speed: 140, life: 0.7 } }); createExplosion(e.x, e.y, e.color); spawnDrop(e.x, e.y, e.rank, e.rewardMul); gainExp(25); e.dead = true; }
                    }
                });
                for(let i=enemies.length-1; i>=0; i--) { if(enemies[i].dead) enemies.splice(i, 1); }
                playWeaponSfx('laser', 160, 0.9);
            }
        }
        function fireGravity() {
            let target = null; let maxHp = -1;
            enemies.forEach(e => {
                if (!isTargetableEnemy(e)) return;
                if (e.hp > maxHp) { maxHp = e.hp; target = e; }
            });
            const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.random() * Math.PI * 2;
            gravityOrbs.push({ x: player.x, y: player.y, vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40, life: 2.0, state: 'move', maxDist: 300, traveled: 0, pullRange: 50, pullForce: 50, dotDmg: 10, scale: 1.0 });
            playWeaponSfx('gravity', 220, 0.9);
        }
        function fireBarrier() {
            const speed = 150; const width = 120; 
            electroBarriers.push({ x: player.x, y: player.y, vx: Math.cos(player.rotation) * speed, vy: Math.sin(player.rotation) * speed, rot: player.rotation, width: width, life: 3.0 });
            playWeaponSfx('barrier', 180, 0.85);
        }
        function updateDroplet(dt) { 
            const d = player.droplet;
            if (d.target && !isTargetableEnemy(d.target)) {
                d.target = null;
                if (d.state !== 'ORBIT') {
                    d.state = 'RETURNING';
                    d.oobTimer = 0;
                }
            }
            if (d.state === 'ORBIT') {
                d.oobTimer = 0;
                d.orbitAngle += dt;
                d.x = player.x + Math.cos(d.orbitAngle) * 35;
                d.y = player.y + Math.sin(d.orbitAngle) * 35;
                if (d.cooldown > 0) d.cooldown -= dt;
                else {
                    let closest = null; let minDist = 300;
                    enemies.forEach(e => {
                        if (!isTargetableEnemy(e)) return;
                        const dist = Math.hypot(e.x - player.x, e.y - player.y);
                        if (dist < minDist) { minDist = dist; closest = e; }
                    });
                    if (closest) {
                        d.target = closest; d.state = 'ATTACK'; d.chainCount = 1; d.hitList = [];
                        d.oobTimer = 0;
                        const angle = Math.atan2(closest.y - d.y, closest.x - d.x);
                        d.velocity.x = Math.cos(angle) * d.speed; d.velocity.y = Math.sin(angle) * d.speed;
                        playWeaponSfx('droplet', 140, 0.85);
                    }
                }
            } else if (d.state === 'ATTACK') {
                if (!d.target || !isTargetableEnemy(d.target) || !isOnScreen(d.x, d.y, 60)) {
                    d.state = 'RETURNING';
                    d.target = null;
                    d.oobTimer = 0;
                } else {
                d.x += d.velocity.x * dt; d.y += d.velocity.y * dt;
                particles.push({x: d.x, y: d.y, vx: 0, vy: 0, life: 0.3, color: '#00ffff', size: 3});
                enemies.forEach(e => {
                    if (!d.hitList.includes(e) && Math.hypot(d.x - e.x, d.y - e.y) < 15) {
                        d.hitList.push(e);
                        const dmg = (e === d.target) ? d.dmg : (d.dmg * 0.5);
                        e.hp -= dmg;
                        registerEnemyHit(e, dmg, { hitTime: 0.12, burst: { count: 4, speed: 80, life: 0.4, sizeRange: [1, 2.2], color: 'rgba(200,255,255,0.9)' } });
                        texts.push({ x: e.x, y: e.y - 15, text: "PIERCE", life: 0.5, color: '#00ffff' });
                        createExplosion(e.x, e.y, '#00ffff', 3);
                        if (e.hp <= 0) { registerEnemyDeath(e, { burst: { count: 14, speed: 140, life: 0.7 } }); createExplosion(e.x, e.y, e.color); spawnDrop(e.x, e.y, e.rank, e.rewardMul); gainExp(30); e.dead = true; }
                        if (e === d.target) { d.state = 'OVERSHOOT'; d.waitTimer = 0.15; }
                    }
                });
                }
            } else if (d.state === 'OVERSHOOT') {
                if (!isOnScreen(d.x, d.y, 60) || (d.target && !isTargetableEnemy(d.target))) {
                    d.state = 'RETURNING';
                    d.target = null;
                    d.oobTimer = 0;
                } else {
                d.x += d.velocity.x * dt; d.y += d.velocity.y * dt; d.waitTimer -= dt;
                if (d.waitTimer <= 0) { d.state = 'STOPPED'; d.waitTimer = 0; }
                }
            } else if (d.state === 'STOPPED') {
                const chainRange = 220;
                let nextTarget = null; let minDist = chainRange;
                enemies.forEach(e => {
                    if (!isTargetableEnemy(e)) return;
                    if (d.hitList.includes(e)) return;
                    const dist = Math.hypot(d.x - e.x, d.y - e.y);
                    if (dist < minDist) {
                        minDist = dist;
                        nextTarget = e;
                    }
                });
                if (nextTarget && d.chainCount < d.maxChains) {
                    d.target = nextTarget;
                    d.state = 'AIMING';
                    d.waitTimer = 0;
                    d.oobTimer = 0;
                } else {
                    d.state = 'RETURNING';
                    d.target = null;
                    d.oobTimer = 0;
                }
            } else if (d.state === 'AIMING') {
                if (!d.target || !isTargetableEnemy(d.target)) {
                    d.state = 'RETURNING';
                    d.target = null;
                    d.oobTimer = 0;
                } else {
                    d.waitTimer += dt; d.rot = Math.atan2(d.target.y - d.y, d.target.x - d.x);
                    if (d.waitTimer >= d.aimDuration) {
                        d.state = 'ATTACK';
                        d.chainCount++;
                        d.hitList = [];
                        d.oobTimer = 0;
                        d.velocity.x = Math.cos(d.rot) * d.speed; d.velocity.y = Math.sin(d.rot) * d.speed;
                    }
                }
            } else if (d.state === 'RETURNING') {
                const angle = Math.atan2(player.y - d.y, player.x - d.x);
                d.x += Math.cos(angle) * d.speed * dt; d.y += Math.sin(angle) * d.speed * dt;
                d.x = clamp(d.x, 0, width);
                d.y = clamp(d.y, 0, height);
                if (!isOnScreen(d.x, d.y, 60)) {
                    d.oobTimer += dt;
                } else {
                    d.oobTimer = 0;
                }
                if (d.oobTimer > 0.35) {
                    d.x = player.x;
                    d.y = player.y;
                    d.state = 'ORBIT';
                    d.cooldown = d.maxCooldown;
                    d.oobTimer = 0;
                } else if (Math.hypot(player.x - d.x, player.y - d.y) < 20) {
                    d.state = 'ORBIT';
                    d.cooldown = d.maxCooldown;
                    d.oobTimer = 0;
                }
            }
            d.x = clamp(d.x, 0, width);
            d.y = clamp(d.y, 0, height);
        }
        function pointToLineDistance(px, py, x1, y1, x2, y2) { const A = px - x1; const B = py - y1; const C = x2 - x1; const D = y2 - y1; const dot = A * C + B * D; const len_sq = C * C + D * D; let param = -1; if (len_sq != 0) param = dot / len_sq; let xx, yy; if (param < 0) { xx = x1; yy = y1; } else if (param > 1) { xx = x2; yy = y2; } else { xx = x1 + param * C; yy = y1 + param * D; } const dx = px - xx; const dy = py - yy; return Math.sqrt(dx * dx + dy * dy); }
        function spawnDrop(x, y, rank, rewardMul = 1) {
            if (difficulty === 'NORMAL') {
                const baseVal = Math.floor(Math.random() * 6) + 5;
                const val = Math.floor(baseVal * (1 + currentStage * 0.1) * rewardMul);
                drops.push({ x, y, type: 'fragment', val, life: 1.0, state: 'wait' });
            } else {
                if (rank >= 2 || Math.random() < 0.05) {
                    const baseVal = (rank >= 2) ? Math.floor(Math.random() * 3) + 2 : 1;
                    const val = Math.max(1, Math.floor(baseVal * rewardMul));
                    drops.push({ x, y, type: 'core', val, life: 1.0, state: 'wait' });
                }
            }
        }
        function createExplosion(x, y, color, count=8) { createParticles(x, y, color, count); particles.push({ x, y, vx: 0, vy: 0, life: 1, color: color, type: 'shockwave', size: 10 }); }

        window.activateGodMode = activateGodMode;
        window.openTestConfig = openTestConfig;
        window.openMetaUpgradeModal = openMetaUpgradeModal;
        window.setDifficulty = setDifficulty;
        window.changeStage = changeStage;
        window.prepareGame = prepareGame;
        window.showQuitPopup = showQuitPopup;
        window.quitGame = quitGame;
        window.cancelQuit = cancelQuit;
        window.nextStage = nextStage;
        window.returnToLobby = returnToLobby;

        try {
            init();
        } catch (error) {
            if (statusEl) statusEl.innerText = 'ERROR';
            console.error('[init] Failed to initialize', error);
        }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

import { getMetaUpgrades, setMetaUpgrades } from './storage.js';
import { bindModal } from './modals.js';

export const META_UPGRADES = [
    { key: 'atk', name: 'WEAPON POWER', desc: '공격력 +2%/lv', max: 20, base: 50, growth: 1.22, currency: 'fragments' },
    { key: 'fireRate', name: 'FIRE RATE', desc: '공격 속도 +2%/lv', max: 15, base: 60, growth: 1.22, currency: 'fragments' },
    { key: 'range', name: 'RADAR RANGE', desc: '인식 범위 +2%/lv', max: 10, base: 40, growth: 1.22, currency: 'fragments' },
    { key: 'maxHp', name: 'SHIELD CAPACITY', desc: '최대 체력 +3%/lv', max: 10, base: 70, growth: 1.22, currency: 'fragments' },
    { key: 'pickup', name: 'RESOURCE PICKUP', desc: '획득량 +2%/lv', max: 10, base: 80, growth: 1.22, currency: 'fragments' },
    { key: 'startLevel', name: 'START LEVEL', desc: '시작 레벨 +1/lv', max: 3, base: 2, growth: 1.35, currency: 'cores' },
    { key: 'startChoices', name: 'START CHOICES', desc: '시작 선택지 +1/lv', max: 2, base: 3, growth: 1.35, currency: 'cores' },
    { key: 'rerolls', name: 'REROLL', desc: '리롤 +1/lv', max: 3, base: 2, growth: 1.35, currency: 'cores' },
];

export function createMetaUpgradesUi({
    overlay,
    listEl,
    fragmentsEl,
    coresEl,
    closeButton,
    backdrop,
    uiLocker,
    getSavedData,
    saveGameData,
    onMetaUpgradesChange
}) {
    let metaUpgrades = getMetaUpgrades();

    const updateResources = () => {
        const savedData = getSavedData?.();
        if (fragmentsEl) fragmentsEl.innerText = savedData?.resources?.fragments ?? 0;
        if (coresEl) coresEl.innerText = savedData?.resources?.cores ?? 0;
    };

    const renderMetaUpgradeList = () => {
        if (!listEl) return;
        const savedData = getSavedData?.();
        updateResources();
        listEl.innerHTML = '';
        META_UPGRADES.forEach((meta) => {
            const level = metaUpgrades[meta.key] || 0;
            const isMax = level >= meta.max;
            const cost = Math.round(meta.base * Math.pow(meta.growth, level));
            const hasResource = meta.currency === 'fragments'
                ? (savedData?.resources?.fragments ?? 0) >= cost
                : (savedData?.resources?.cores ?? 0) >= cost;

            const item = document.createElement('div');
            item.className = 'meta-upgrade-item';
            item.innerHTML = `
                <div>
                    <h4>${meta.name} <span class="text-xs text-cyan-200">LV ${level}/${meta.max}</span></h4>
                    <p>${meta.desc}</p>
                    <p>${meta.currency === 'fragments' ? '◆' : '⬢'} ${isMax ? 'MAX' : cost}</p>
                </div>
            `;

            const button = document.createElement('button');
            button.className = 'meta-upgrade-buy';
            button.type = 'button';
            button.disabled = isMax || !hasResource;
            button.innerText = isMax ? 'MAX' : 'BUY';
            button.addEventListener('click', () => tryBuyMetaUpgrade(meta.key));
            item.appendChild(button);
            listEl.appendChild(item);
        });
    };

    const modal = bindModal({
        overlayEl: overlay,
        closeBtnEl: closeButton,
        backdropEl: backdrop,
        uiLocker,
        onOpen: () => {
            metaUpgrades = getMetaUpgrades();
            onMetaUpgradesChange?.(metaUpgrades);
            renderMetaUpgradeList();
        }
    });

    const tryBuyMetaUpgrade = (key) => {
        const meta = META_UPGRADES.find(item => item.key === key);
        if (!meta) return;
        const currentLevel = metaUpgrades[key] || 0;
        if (currentLevel >= meta.max) return;
        const cost = Math.round(meta.base * Math.pow(meta.growth, currentLevel));
        const savedData = getSavedData?.();
        if (!savedData?.resources) return;
        if (meta.currency === 'fragments') {
            if (savedData.resources.fragments < cost) return;
            savedData.resources.fragments -= cost;
        } else {
            if (savedData.resources.cores < cost) return;
            savedData.resources.cores -= cost;
        }
        metaUpgrades[key] = currentLevel + 1;
        setMetaUpgrades(metaUpgrades);
        onMetaUpgradesChange?.(metaUpgrades);
        saveGameData?.();
        renderMetaUpgradeList();
    };

    return {
        open: modal.open,
        close: modal.close,
        renderMetaUpgradeList,
        tryBuyMetaUpgrade
    };
}

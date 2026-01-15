export function createDevTools({
    storagePrefix,
    versionToggle,
    devPanel,
    devBackdrop,
    devSheet,
    devGodButton,
    devTestButton,
    testConfigOverlay,
    testConfigBackdrop,
    testConfigClose,
    testWeaponSelect,
    testApplyButton,
    uiLocker,
    getSpecialWeaponKeys,
    getSpecialWeaponLabel,
    getTestModeState,
    setTestModeState,
    setTestModeIndicator,
    onActivateGodMode
}) {
    const DEV_FLAG_KEY = `${storagePrefix}:dev`;
    const params = new URLSearchParams(location.search);
    const devToolsEnabled = params.get('dev') === '1' || localStorage.getItem(DEV_FLAG_KEY) === '1';
    let devTapCount = 0;
    let devTapTimer = null;

    const resetDevTap = () => {
        devTapCount = 0;
        if (devTapTimer) {
            clearTimeout(devTapTimer);
            devTapTimer = null;
        }
    };

    const openDevPanel = () => {
        if (!devToolsEnabled || !devPanel) return;
        if (!devPanel.classList.contains('hidden')) return;
        devPanel.classList.remove('hidden');
        versionToggle?.setAttribute('aria-expanded', 'true');
        uiLocker?.lock?.();
    };

    const closeDevPanel = () => {
        if (!devPanel) return;
        if (devPanel.classList.contains('hidden')) return;
        devPanel.classList.add('hidden');
        versionToggle?.setAttribute('aria-expanded', 'false');
        uiLocker?.unlock?.();
    };

    const populateTestWeaponSelect = () => {
        if (!testWeaponSelect) return 0;
        const keys = getSpecialWeaponKeys?.() ?? [];
        testWeaponSelect.innerHTML = '';
        keys.forEach((key) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = getSpecialWeaponLabel?.(key) ?? key;
            testWeaponSelect.appendChild(option);
        });
        const saved = getTestModeState?.().weaponKey || '';
        if (saved && keys.includes(saved)) {
            testWeaponSelect.value = saved;
        } else if (keys.length > 0) {
            testWeaponSelect.value = keys[0];
        }
        return keys.length;
    };

    const openTestConfig = () => {
        if (!testConfigOverlay) return;
        if (!testConfigOverlay.classList.contains('hidden')) return;
        const optionCount = populateTestWeaponSelect();
        if (!optionCount) {
            alert('특수 무기 목록을 찾을 수 없습니다.');
            return;
        }
        closeDevPanel();
        testConfigOverlay.classList.remove('hidden');
        uiLocker?.lock?.();
    };

    const closeTestConfig = () => {
        if (!testConfigOverlay) return;
        if (testConfigOverlay.classList.contains('hidden')) return;
        testConfigOverlay.classList.add('hidden');
        uiLocker?.unlock?.();
    };

    const applyTestConfig = () => {
        if (!testWeaponSelect) return;
        const weaponKey = testWeaponSelect.value;
        if (!weaponKey) {
            alert('특수 무기를 선택하세요.');
            return;
        }
        setTestModeState?.(true, weaponKey);
        closeTestConfig();
        closeDevPanel();
        alert('적용됨. START를 눌러 전투에서 확인하세요.');
    };

    if (!devToolsEnabled && devPanel) {
        devPanel.classList.add('hidden');
        versionToggle?.setAttribute('aria-expanded', 'false');
    }

    if (versionToggle) {
        if (versionToggle.getAttribute('aria-expanded') === null) {
            versionToggle.setAttribute('aria-expanded', String(!devPanel?.classList.contains('hidden')));
        }

        versionToggle.addEventListener('click', () => {
            if (devTapCount === 0) {
                devTapTimer = setTimeout(resetDevTap, 1500);
            }
            devTapCount += 1;
            if (devTapCount >= 5) {
                if (!devToolsEnabled) {
                    localStorage.setItem(DEV_FLAG_KEY, '1');
                    alert('DEV MODE enabled. Reloading...');
                    location.reload();
                    return;
                }
                if (devPanel?.classList.contains('hidden')) {
                    openDevPanel();
                } else if (devPanel) {
                    closeDevPanel();
                }
                resetDevTap();
            }
        });
    }

    if (devBackdrop) {
        devBackdrop.addEventListener('click', () => {
            closeDevPanel();
            resetDevTap();
        });
    }

    if (devSheet) {
        devSheet.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    if (devGodButton) {
        devGodButton.addEventListener('click', () => {
            onActivateGodMode?.();
        });
    } else {
        console.warn('[DEV] GOD MODE 버튼을 찾을 수 없습니다.');
    }

    if (devTestButton) {
        devTestButton.addEventListener('click', openTestConfig);
    } else {
        console.warn('[DEV] TEST STAGE 버튼을 찾을 수 없습니다.');
    }

    if (testConfigBackdrop) {
        testConfigBackdrop.addEventListener('click', closeTestConfig);
    }

    if (testConfigClose) {
        testConfigClose.addEventListener('click', closeTestConfig);
    }

    if (testApplyButton) {
        testApplyButton.addEventListener('click', applyTestConfig);
    }

    return {
        enabled: devToolsEnabled,
        openDevPanel,
        closeDevPanel,
        openTestConfig,
        closeTestConfig,
        applyTestConfig
    };
}

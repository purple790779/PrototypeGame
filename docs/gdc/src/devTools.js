export function createDevTools({
    storagePrefix,
    versionEl,
    uiLocker,
    onGodMode,
    onOpenTestConfig,
    onToggleDevPanel,
    devTestOffButton,
    testOffButton,
    setTestModeState,
    setTestModeIndicator,
    closeTestConfig,
    closeDevPanel
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

    const handleVersionTap = () => {
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
            onToggleDevPanel?.();
            resetDevTap();
        }
    };

    if (versionEl) {
        if (versionEl.getAttribute('aria-expanded') === null) {
            versionEl.setAttribute('aria-expanded', 'false');
        }
        versionEl.addEventListener('click', handleVersionTap);
    }

    const disableTestMode = () => {
        setTestModeState?.(false, '');
        setTestModeIndicator?.(false);
        closeTestConfig?.();
        closeDevPanel?.();
        alert('TEST MODE 해제됨.');
    };

    if (testOffButton) {
        testOffButton.addEventListener('click', disableTestMode);
    }

    if (devTestOffButton) {
        devTestOffButton.addEventListener('click', disableTestMode);
    }

    return {
        enabled: devToolsEnabled,
        resetDevTap,
        handleVersionTap,
        uiLocker,
        onGodMode,
        onOpenTestConfig
    };
}

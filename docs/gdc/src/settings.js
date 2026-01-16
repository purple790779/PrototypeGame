export function bindSettingsUI({
    optShakeEl,
    optDmgTextEl,
    getSettings,
    setSettings,
    onChange
}) {
    const settings = getSettings?.() ?? {};

    const sync = () => {
        if (optShakeEl) optShakeEl.checked = !!settings.shake;
        if (optDmgTextEl) optDmgTextEl.checked = !!settings.dmgText;
    };

    const updateSetting = (key, value) => {
        settings[key] = value;
        setSettings?.(settings);
        onChange?.(settings);
    };

    if (optShakeEl) {
        optShakeEl.addEventListener('change', (event) => {
            updateSetting('shake', !!event.target.checked);
        });
    }

    if (optDmgTextEl) {
        optDmgTextEl.addEventListener('change', (event) => {
            updateSetting('dmgText', !!event.target.checked);
        });
    }

    sync();
    onChange?.(settings);

    return { settings, sync };
}

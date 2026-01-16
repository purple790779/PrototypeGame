export function createUiLocker(containerEl) {
    let depth = 0;

    const apply = () => {
        const locked = depth > 0;
        if (containerEl) {
            containerEl.classList.toggle('ui-locked', locked);
        }
        const lobby = document.getElementById('lobby-ui');
        if (lobby) lobby.style.pointerEvents = locked ? 'none' : '';
        const ingame = document.getElementById('ingame-ui');
        if (ingame) ingame.style.pointerEvents = locked ? 'none' : '';
    };

    return {
        lock() {
            depth += 1;
            apply();
        },
        unlock() {
            depth = Math.max(0, depth - 1);
            apply();
        },
        forceUnlock() {
            depth = 0;
            apply();
        },
        isLocked() {
            return depth > 0;
        }
    };
}

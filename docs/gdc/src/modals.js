export function createUiLocker(containerEl) {
    let openCount = 0;

    const syncState = () => {
        const locked = openCount > 0;
        if (containerEl) {
            containerEl.classList.toggle('ui-locked', locked);
        }
        document.body.classList.toggle('modal-open', locked);
    };

    return {
        lock() {
            openCount += 1;
            syncState();
        },
        unlock() {
            openCount = Math.max(0, openCount - 1);
            syncState();
        },
        get openCount() {
            return openCount;
        }
    };
}

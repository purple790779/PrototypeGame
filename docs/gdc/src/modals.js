export function bindModal({
    overlayEl,
    closeBtnEl,
    backdropEl,
    uiLocker,
    onOpen,
    onClose
}) {
    const isHidden = () => {
        if (!overlayEl) return true;
        return overlayEl.hidden || overlayEl.classList.contains('hidden');
    };

    const open = () => {
        if (!overlayEl || !isHidden()) return;
        overlayEl.hidden = false;
        overlayEl.classList.remove('hidden');
        uiLocker?.lock?.();
        onOpen?.();
    };

    const close = () => {
        if (!overlayEl || isHidden()) return;
        overlayEl.hidden = true;
        overlayEl.classList.add('hidden');
        uiLocker?.unlock?.();
        onClose?.();
    };

    if (closeBtnEl) {
        closeBtnEl.addEventListener('click', close);
    }
    if (backdropEl) {
        backdropEl.addEventListener('click', close);
    }

    return { open, close, isHidden };
}

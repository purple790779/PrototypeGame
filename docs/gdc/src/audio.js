let audioContext = null;

const getAudioContext = () => {
    if (audioContext) return audioContext;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
    return audioContext;
};

export function bindAudioUnlock() {
    const unlock = () => {
        const ctx = getAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
    };

    document.addEventListener('pointerdown', unlock, { passive: true, once: true });
    document.addEventListener('touchstart', unlock, { passive: true, once: true });
    document.addEventListener('keydown', unlock, { once: true });
}

const applyEnvelope = (gain, startTime, duration, volume) => {
    const peak = Math.min(0.12, Math.max(0.02, volume * 0.08));
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
};

const scheduleTone = (ctx, frequency, duration, options = {}) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (options.slideTo) {
        osc.frequency.exponentialRampToValueAtTime(options.slideTo, ctx.currentTime + duration);
    }
    applyEnvelope(gain, ctx.currentTime, duration, options.volume ?? 1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
};

export function playSfx(name, volume = 1, enabled = true) {
    if (!enabled) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    switch (name) {
        case 'cannon':
            scheduleTone(ctx, 900, 0.04, { type: 'square', volume });
            break;
        case 'missile':
            scheduleTone(ctx, 220, 0.06, { type: 'sawtooth', volume: volume * 0.9 });
            scheduleTone(ctx, 320, 0.05, { type: 'sine', volume: volume * 0.7 });
            break;
        case 'laser':
            scheduleTone(ctx, 1200, 0.05, { type: 'triangle', volume });
            break;
        case 'gravity':
            scheduleTone(ctx, 200, 0.08, { type: 'sine', slideTo: 160, volume: volume * 0.9 });
            break;
        case 'barrier':
            scheduleTone(ctx, 600, 0.05, { type: 'square', volume: volume * 0.8 });
            break;
        case 'droplet':
            scheduleTone(ctx, 750, 0.05, { type: 'triangle', volume });
            break;
        default:
            break;
    }
}

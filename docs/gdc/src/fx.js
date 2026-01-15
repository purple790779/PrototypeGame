class ParticlePool {
  constructor(size = 220) {
    this.size = size;
    this.pool = Array.from({ length: size }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      ttl: 0,
      size: 0,
      alpha: 1,
      color: 'rgba(200,255,255,0.9)'
    }));
    this.cursor = 0;
    this.activeCount = 0;
  }

  reset() {
    this.pool.forEach((p) => {
      p.active = false;
    });
    this.activeCount = 0;
    this.cursor = 0;
  }

  spawnBurst(x, y, count = 6, baseSpeed = 80, life = 0.45, sizeRange = [1, 2.5], color = 'rgba(200,255,255,0.9)') {
    let burstCount = count;
    if (this.activeCount > 150) {
      burstCount = Math.max(2, Math.floor(count * 0.5));
    }
    for (let i = 0; i < burstCount; i += 1) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.size;
      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (0.5 + Math.random() * 0.9);
      const ttl = life * (0.8 + Math.random() * 0.4);
      const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = ttl;
      p.ttl = ttl;
      p.size = size;
      p.alpha = 0.9;
      p.color = color;
    }
  }

  update(dt) {
    let active = 0;
    this.pool.forEach((p) => {
      if (!p.active) return;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        return;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      active += 1;
    });
    this.activeCount = active;
  }

  draw(ctx) {
    this.pool.forEach((p) => {
      if (!p.active) return;
      const t = Math.max(0, p.life / p.ttl);
      ctx.globalAlpha = t * p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

class DamageTextPool {
  constructor(size = 70) {
    this.size = size;
    this.pool = Array.from({ length: size }, () => ({
      active: false,
      x: 0,
      y: 0,
      value: 0,
      life: 0,
      ttl: 0,
      vy: 0,
      alpha: 1
    }));
    this.cursor = 0;
  }

  reset() {
    this.pool.forEach((t) => {
      t.active = false;
    });
    this.cursor = 0;
  }

  spawn(x, y, value) {
    const t = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.size;
    t.active = true;
    t.x = x;
    t.y = y;
    t.value = value;
    t.ttl = 0.6;
    t.life = 0.6;
    t.vy = -24;
    t.alpha = 0.9;
  }

  update(dt) {
    this.pool.forEach((t) => {
      if (!t.active) return;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        return;
      }
      t.y += t.vy * dt;
    });
  }

  draw(ctx) {
    ctx.save();
    ctx.font = 'bold 12px Pretendard';
    ctx.textAlign = 'center';
    this.pool.forEach((t) => {
      if (!t.active) return;
      const alpha = Math.max(0, (t.life / t.ttl) * t.alpha);
      ctx.fillStyle = `rgba(210, 250, 255, ${alpha})`;
      ctx.fillText(String(t.value), t.x, t.y);
    });
    ctx.restore();
  }
}

class ScreenShake {
  constructor() {
    this.time = 0;
    this.duration = 0;
    this.magnitude = 0;
  }

  reset() {
    this.time = 0;
    this.duration = 0;
    this.magnitude = 0;
  }

  start(magnitude = 8, duration = 0.2) {
    this.magnitude = Math.max(this.magnitude, magnitude);
    this.duration = Math.max(this.duration, duration);
    this.time = Math.max(this.time, duration);
  }

  update(dt) {
    if (this.time <= 0) return;
    this.time -= dt;
    if (this.time < 0) this.time = 0;
  }

  getOffset() {
    if (this.time <= 0 || this.duration <= 0) return { x: 0, y: 0 };
    const t = this.time / this.duration;
    const mag = this.magnitude * t;
    return {
      x: (Math.random() * 2 - 1) * mag,
      y: (Math.random() * 2 - 1) * mag
    };
  }
}

class VignetteHit {
  constructor() {
    this.time = 0;
    this.duration = 0;
    this.strength = 1;
  }

  reset() {
    this.time = 0;
    this.duration = 0;
    this.strength = 1;
  }

  trigger(strength = 1, duration = 0.3) {
    this.strength = strength;
    this.duration = duration;
    this.time = duration;
  }

  update(dt) {
    if (this.time <= 0) return;
    this.time -= dt;
    if (this.time < 0) this.time = 0;
  }

  drawOverlay(ctx, width, height) {
    if (this.time <= 0) return;
    const t = Math.max(0, this.time / this.duration);
    const alpha = 0.35 * t * this.strength;
    const gradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.2,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.65
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.65, `rgba(120, 0, 0, ${alpha * 0.4})`);
    gradient.addColorStop(1, `rgba(180, 0, 0, ${alpha})`);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export const createFx = () => {
  const particles = new ParticlePool(240);
  const damageText = new DamageTextPool(70);
  const shake = new ScreenShake();
  const vignette = new VignetteHit();

  return {
    particles,
    damageText,
    shake,
    vignette,
    update(dt) {
      particles.update(dt);
      damageText.update(dt);
      shake.update(dt);
      vignette.update(dt);
    },
    reset() {
      particles.reset();
      damageText.reset();
      shake.reset();
      vignette.reset();
    }
  };
};

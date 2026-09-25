// SCRAPCORE: BREAKLANDS — Effects (Milestone 5)
// Pooled lightweight particles: sparks, flashes, explosion rings, debris.
// Hard-capped (plan §75) — the pool recycles the oldest when full.

const Effects = {
  MAX: 260,
  pool: [],
  numbers: [],   // floating damage numbers (small array, short-lived)
  words: [],     // comic impact words: CLANK! RIP! CRACK! (plan §69)
  // Settings toggles (M16). Defaults keep everything on for headless tests.
  showDamageNumbers: true,
  showComicWords: true,
  densityScale: 1,
  liteMode: false,
  flashReduction: false,

  // ---- HIT-STOP / SLOW MOTION (plan §74) ---------------------------------
  // A few frames of frozen or slowed time on a heavy impact is the cheapest
  // way to make a hit feel like it landed. Driven from the main loop, which
  // scales dt by timeScale() — so gameplay, particles and audio timing all
  // slow together and nothing desynchronises.
  _stopT: 0,
  _stopScale: 0,

  // A stop may not be requested again for this long. Without it, hit-stops
  // CHAIN: measured at 6-9 heavy hits a second the game ran at 64-76% speed
  // for as long as the fight lasted, and since movement runs on game time the
  // player just felt slower and slower. Punctuation, not a permanent tax.
  STOP_GAP: 0.30,
  // Requests at least this long are deaths and always get through.
  LONG_STOP: 0.30,
  _stopCool: 0,

  hitStop(dur, scale) {
    const sc = scale === undefined ? 0.05 : scale;
    // Small stops are rate-limited; a boss death is not.
    if (dur < this.LONG_STOP && this._stopCool > 0) return;
    // The heavier request wins: a stream of small pings must never cut short
    // the long slow-motion of a boss death.
    if (dur >= this._stopT) {
      this._stopT = dur;
      this._stopScale = sc;
      this._stopCool = Math.max(this._stopCool, this.STOP_GAP);
    }
  },

  // Called with REAL delta time; returns the multiplier for game time.
  timeScale(realDt) {
    if (this._stopCool > 0) this._stopCool = Math.max(0, this._stopCool - realDt);
    if (this._stopT > 0) {
      this._stopT = Math.max(0, this._stopT - realDt);
      return this._stopScale;
    }
    return 1;
  },

  clearHitStop() { this._stopT = 0; this._stopScale = 0; this._stopCool = 0; },

  init() {
    this.clearHitStop();
    this.pool = [];
    for (let i = 0; i < this.MAX; i++) {
      this.pool.push({ active: false });
    }
    this._next = 0;
    this.numbers = [];
    this.words = [];
  },

  comicWord(text, x, y, color, size) {
    if (!this.showComicWords) return;
    if (this.words.length > 5) this.words.shift();
    this.words.push({ text, x, y, t: 0, rot: (Math.random() - 0.5) * 0.25,
      color: color || '#ffd23f', size: size || 74 });
  },

  _spawn(props) {
    // Ring-buffer allocation: oldest slot is recycled if all are active.
    const p = this.pool[this._next];
    this._next = (this._next + 1) % this.MAX;
    Object.assign(p, { active: true, t: 0 }, props);
    return p;
  },

  spark(x, y, baseAngle, count, color, speed) {
    // VFX density / LITE mode: fewer particles, identical gameplay (§4.4).
    count = Math.max(1, Math.round(count * (this.densityScale || 1)));
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (Math.random() - 0.5) * 2.2;
      const s = (speed || 500) * (0.4 + Math.random() * 0.8);
      this._spawn({
        kind: 'spark', x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.18 + Math.random() * 0.22,
        size: 5 + Math.random() * 6,
        color: color || '#ffd23f',
      });
    }
  },

  muzzleFlash(x, y, angle, big) {
    this._spawn({
      kind: 'flash', x, y, angle,
      life: big ? 0.09 : 0.06,
      size: big ? 70 : 40,
      color: big ? '#ff7a1a' : '#ffd23f',
    });
  },

  ring(x, y, maxR, color) {
    this._spawn({ kind: 'ring', x, y, life: 0.32, maxR, color: color || '#ff7a1a' });
  },

  // Arc Gun chain lightning (M12): jittered segmented bolt, very short-lived.
  bolt(x, y, x2, y2, color) {
    this._spawn({ kind: 'bolt', x, y, x2, y2, life: 0.16, color: color || '#22d9ff' });
    this.spark(x2, y2, 0, 4, color || '#22d9ff', 420);
  },

  explosion(x, y, r) {
    if (this.liteMode) r *= 0.85;      // shorter-lived, smaller burst in LITE
    if (typeof Audio_ !== 'undefined') Audio_.play('explosion', { pitch: 220 / Math.max(60, r) });
    this.ring(x, y, r, '#ff7a1a');
    this.ring(x, y, r * 0.55, '#ffd23f');
    this.spark(x, y, 0, 14, '#ff7a1a', 700);
    this.spark(x, y, 0, 8, '#ffd23f', 450);
  },

  damageNumber(x, y, amount) {
    if (!this.showDamageNumbers) return;
    if (this.numbers.length > 24) this.numbers.shift();
    this.numbers.push({ x: x + (Math.random() - 0.5) * 30, y, t: 0, amount: Math.round(amount) });
  },

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.t += dt;
      if (p.t >= p.life) { p.active = false; continue; }
      if (p.kind === 'spark') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= (1 - 4 * dt);
        p.vy *= (1 - 4 * dt);
      }
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.t += dt;
      n.y -= 90 * dt;
      if (n.t > 0.7) this.numbers.splice(i, 1);
    }
    for (let i = this.words.length - 1; i >= 0; i--) {
      const w = this.words[i];
      w.t += dt;
      if (w.t > 0.7) this.words.splice(i, 1);
    }
  },

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const k = 1 - p.t / p.life;
      if (p.kind === 'spark') {
        ctx.globalAlpha = k;
        R.circle(p.x, p.y, p.size * k, p.color);
      } else if (p.kind === 'flash') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = k;
        // Chunky comic star-flash: two overlapping triangles
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 0.35);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 0.16);
        ctx.lineTo(p.size * 0.6, 0);
        ctx.lineTo(0, p.size * 0.16);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'bolt') {
        // Jittered lightning between two points
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 7 * k + 2;
        const segs = 6;
        const dx = (p.x2 - p.x) / segs, dy = (p.y2 - p.y) / segs;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        for (let i = 1; i < segs; i++) {
          ctx.lineTo(p.x + dx * i + (Math.random() - 0.5) * 44,
                     p.y + dy * i + (Math.random() - 0.5) * 44);
        }
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else if (p.kind === 'ring') {
        const r = p.maxR * (p.t / p.life);
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 10 * k + 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Comic impact words: pop in, hold, fade — never linger (plan §69)
    for (const w of this.words) {
      const popIn = Math.min(w.t / 0.1, 1);
      const scale = 0.5 + popIn * 0.5 + Math.max(0, 0.12 - w.t) * 2.2;
      const fade = w.t > 0.45 ? 1 - (w.t - 0.45) / 0.25 : 1;
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.rot);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.max(0, fade);
      R.text(w.text, 0, 0, w.size || 74, w.color || '#ffd23f');
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Damage numbers (toggleable in Settings later, plan §11)
    for (const n of this.numbers) {
      const k = 1 - n.t / 0.7;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      R.text(String(n.amount), n.x, n.y, 40, '#ffffff');
      ctx.globalAlpha = 1;
    }
  },
};

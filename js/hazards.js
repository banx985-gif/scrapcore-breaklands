// SCRAPCORE: BREAKLANDS — Hazards (Milestone 11)
// Explosive Canister (plan §43): shootable, short armed-fuse warning, then a
// blast that damages player, enemies AND their components. Canisters chain.

class Canister {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 44;
    this.maxHp = 20;
    this.hp = this.maxHp;
    this.alive = true;
    this.fuse = -1;        // >= 0 means armed and counting down
    this.flash = 0;
    this.BLAST = 430;      // was 270 — too small to be worth shooting
    this.DMG = 30;
  }

  hit(dmg, hx, hy) {
    if (!this.alive || this.fuse >= 0) return;
    this.hp -= dmg;
    this.flash = 0.1;
    Effects.spark(hx, hy, 0, 3, '#ff7a1a', 380);
    if (this.hp <= 0) {
      this.fuse = 0.45;    // clear warning before the boom (plan §43)
    }
  }

  update(dt, player, enemies, canisters) {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) return;
    if (this.fuse >= 0) {
      this.fuse -= dt;
      if (Math.random() < dt * 30) {
        Effects.spark(this.x, this.y - 30, -Math.PI / 2, 1, '#ffd23f', 260);
      }
      if (this.fuse <= 0) this.explode(player, enemies, canisters);
    }
  }

  explode(player, enemies, canisters) {
    this.alive = false;
    Effects.explosion(this.x, this.y, this.BLAST * 0.85);
    Effects.comicWord('BOOM!', this.x, this.y - 90);
    Camera.shake(8, 0.25);

    const blastMachine = (m) => {
      if (!m.alive) return;
      const d = Math.hypot(m.x - this.x, m.y - this.y);
      if (d > this.BLAST + m.radius + 170) return;
      if (m.sockets) {
        const hit = Machine.resolveHit(m, this.x, this.y, this.BLAST);
        if (hit) Machine.applyDamage(m, hit, this.DMG, m.x, m.y, false, null, 'blast');
      } else if (d < this.BLAST + m.radius) {
        m.hit(this.DMG, m.x, m.y);
      }
    };
    blastMachine(player);
    for (const e of enemies) blastMachine(e);

    // Chain reaction: nearby canisters arm with a short stagger.
    for (const c of canisters) {
      if (c === this || !c.alive || c.fuse >= 0) continue;
      if (Math.hypot(c.x - this.x, c.y - this.y) < this.BLAST + c.radius) {
        c.hp = 0;
        c.fuse = 0.12 + Math.random() * 0.2;
      }
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    const armed = this.fuse >= 0;
    const blink = armed && Math.sin(performance.now() / 55) > 0;

    R.circle(this.x + 6, this.y + 8, this.radius, 'rgba(0,0,0,0.4)');
    // Real art when idle; the drawn version takes over while armed so the
    // white blink warning still reads.
    const art = !(this.flash > 0 || blink) && typeof Assets !== 'undefined' &&
      // Sized off the collision radius, not by eye. A canister you can walk
      // into before it reacts reads as a bug in the physics rather than the
      // art. 2.7 drew it a third wider than it is solid.
      Assets.sprite(ctx, 'prop_canister', this.x, this.y,
        this.radius * 2, this.radius * 2, 0);
    if (art) return;
    R.circle(this.x, this.y, this.radius,
      this.flash > 0 || blink ? '#ffffff' : CONFIG.COLOR.orange,
      CONFIG.COLOR.ink, 8);
    // Hazard stripe band
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius - 6, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = blink ? '#ff3b3b' : CONFIG.COLOR.ink;
    for (let i = -3; i <= 3; i++) {
      ctx.save();
      ctx.translate(this.x + i * 22, this.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -60, 14, 120);
      ctx.restore();
    }
    ctx.restore();
    R.circle(this.x, this.y, 12, blink ? '#ff3b3b' : '#ffd23f', CONFIG.COLOR.ink, 5);
  }
}

// ---------------------------------------------------------------------------
// CRUSHER PLATE (plan §43): a floor area flashes, then a giant press slams
// down for heavy damage. It does not care who is standing there — player,
// enemies and their components all take it. Learning to bait machines onto a
// plate is the Scrap Yard's signature trick.
class CrusherPlate {
  constructor(x, y, w, h, phase = 0) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.IDLE = 2.6;      // resting
    this.WARN = 1.05;     // telegraph — long enough to walk out of
    this.DOWN = 0.55;     // slammed, plate sitting on the floor
    this.DMG = 34;
    // Staggered phase so a row of presses ripples instead of firing as one.
    this.t = (phase % 1) * (this.IDLE + this.WARN + this.DOWN);
    this.state = 'idle';
    this.slamFlash = 0;
    this.alive = true;
  }

  get cycle() { return this.IDLE + this.WARN + this.DOWN; }

  contains(m) {
    const r = m.radius || 0;
    return m.x > this.x - r * 0.5 && m.x < this.x + this.w + r * 0.5 &&
           m.y > this.y - r * 0.5 && m.y < this.y + this.h + r * 0.5;
  }

  update(dt, player, enemies) {
    this.slamFlash = Math.max(0, this.slamFlash - dt);
    const prev = this.state;
    this.t = (this.t + dt) % this.cycle;
    if (this.t < this.IDLE) this.state = 'idle';
    else if (this.t < this.IDLE + this.WARN) this.state = 'warn';
    else this.state = 'down';

    if (prev !== 'down' && this.state === 'down') this._slam(player, enemies);
  }

  _slam(player, enemies) {
    this.slamFlash = 0.25;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    Effects.explosion(cx, cy, Math.min(this.w, this.h) * 0.7);
    Camera.shake(9, 0.28);

    const hitMachine = (m) => {
      if (!m || !m.alive || !this.contains(m)) return;
      if (m.sockets) {
        // Route through resolveHit so plates can shear COMPONENTS off, not
        // just chew the Core — same rule as canisters.
        const hit = Machine.resolveHit(m, m.x, m.y, Math.min(this.w, this.h) / 2);
        if (hit) Machine.applyDamage(m, hit, this.DMG, m.x, m.y);
        else m.takeCoreDamage(this.DMG, m.x, m.y);
      } else {
        m.hit(this.DMG, m.x, m.y);
      }
      Effects.comicWord('WHAM!', m.x, m.y - 110);
    };
    hitMachine(player);
    for (const e of enemies) hitMachine(e);
  }

  draw(ctx) {
    const warn = this.state === 'warn';
    const down = this.state === 'down';
    const idle = !warn && !down;
    // MOVEMENT is the differentiator. The Scrap Yard floor texture has static
    // orange hazard stripes baked into it, so a static striped plate would read
    // as decoration. These chevrons SCROLL, the border pulses, and the palette
    // is red/white rather than the floor's orange.
    const t = performance.now() / 1000;
    const scroll = (t * 90) % 96;
    const pulse = 0.5 + 0.5 * Math.sin(t * (warn ? 14 : 3));

    // Supplied plate art if we have it; the animated warning layers on top so
    // the STATE is still readable even though the pad itself is static.
    const art = typeof Assets !== 'undefined' && !down &&
      Assets.sprite(ctx, 'hazard_plate',
        this.x + this.w / 2, this.y + this.h / 2, this.w, this.h, 0);
    if (art) {
      if (warn) {
        ctx.save();
        ctx.globalAlpha = 0.30 + pulse * 0.42;
        R.rect(this.x, this.y, this.w, this.h, '#ff3b3b');
        ctx.restore();
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.w, this.h);
    ctx.clip();
    if (art) { ctx.restore(); }
    else {

    // Base wash
    ctx.fillStyle = down ? '#140c16'
      : (warn ? 'rgba(255,59,59,' + (0.30 + pulse * 0.34).toFixed(3) + ')'
              : 'rgba(255,59,59,0.13)');
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // Scrolling chevrons — red/white, never orange
    ctx.fillStyle = warn ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.30)';
    for (let i = -3; i < this.w / 48 + 3; i++) {
      ctx.save();
      ctx.translate(this.x + i * 48 + scroll, this.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -100, 18, this.h + 240);
      ctx.restore();
    }
    ctx.restore();
    }

    // Heavy double border: black outer, red inner that thickens as it winds up
    R.rect(this.x - 4, this.y - 4, this.w + 8, this.h + 8, null, CONFIG.COLOR.ink, 12);
    R.rect(this.x, this.y, this.w, this.h, null,
      warn ? '#ff3b3b' : 'rgba(255,59,59,0.65)', warn ? 10 + pulse * 8 : 7);

    // Corner brackets: an unmistakable "kill box" read even at a glance
    ctx.save();
    ctx.strokeStyle = warn ? '#ffffff' : '#ff3b3b';
    ctx.lineWidth = warn ? 12 : 8;
    ctx.lineCap = 'square';
    const L = Math.min(this.w, this.h) * 0.26;
    for (const [cx, cy, sx, sy] of [
      [this.x, this.y, 1, 1], [this.x + this.w, this.y, -1, 1],
      [this.x, this.y + this.h, 1, -1], [this.x + this.w, this.y + this.h, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * L, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * L);
      ctx.stroke();
    }
    ctx.restore();

    if (down) {
      // The press itself, sitting in the hole
      const inset = 12;
      const slab = this.slamFlash <= 0 && typeof Assets !== 'undefined' &&
        Assets.sprite(ctx, 'prop_pressSlab', this.x + this.w / 2,
          this.y + this.h / 2, this.w, this.h, 0);
      if (!slab) {
        R.roundRect(this.x + inset, this.y + inset,
          this.w - inset * 2, this.h - inset * 2, 16,
          this.slamFlash > 0 ? '#ffffff' : '#39435f', CONFIG.COLOR.ink, 10);
        R.roundRect(this.x + inset + 26, this.y + inset + 26,
          this.w - inset * 2 - 52, this.h - inset * 2 - 52, 12, '#232b44');
      }
    } else if (warn) {
      // Shadow closing in, plus a countdown ring that visibly runs out
      const k = (this.t - this.IDLE) / this.WARN;
      const pad = (1 - k) * Math.min(this.w, this.h) * 0.4;
      ctx.save();
      ctx.globalAlpha = 0.3 + k * 0.4;
      R.roundRect(this.x + pad, this.y + pad,
        this.w - pad * 2, this.h - pad * 2, 16, '#000000');
      ctx.restore();

      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const rr = Math.min(this.w, this.h) * 0.34;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + (1 - k) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (idle) {
      // Resting: a dim warning glyph so the box is learnable before it fires
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      ctx.save();
      ctx.globalAlpha = 0.5;
      R.text('!', cx, cy + 12, Math.min(this.w, this.h) * 0.4, '#ff3b3b');
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// HEAT VENT (plan §45): a Foundry floor grate that flashes, then erupts. It
// damages anything standing on it AND dumps Heat straight into the player's
// Core — the one hazard that can push you into an overheat lockout, which is
// exactly the pressure the Foundry is supposed to apply.
class HeatVent {
  constructor(x, y, r = 150, phase = 0) {
    this.x = x; this.y = y; this.r = r;
    this.IDLE = 3.0;             // (tune)
    // Master §26B (Furnace Mile row): "0.8s warning -> 16 damage +25 Heat".
    // The ZERO port shipped 0.9/22/38; §26B is the game's own EXACT
    // STARTING VALUES table, so the §26B row wins everywhere the vent fires.
    this.WARN = 0.8;
    this.FIRE = 0.7;             // (tune)
    this.DMG = 16;
    this.HEAT = 25;              // added to the player's Heat bar
    this.t = (phase % 1) * (this.IDLE + this.WARN + this.FIRE);
    this.state = 'idle';
    this.fired = false;
    this.alive = true;
  }

  get cycle() { return this.IDLE + this.WARN + this.FIRE; }

  covers(m) {
    return Math.hypot(m.x - this.x, m.y - this.y) < this.r + (m.radius || 0) * 0.5;
  }

  update(dt, player, enemies) {
    const prev = this.state;
    this.t = (this.t + dt) % this.cycle;
    if (this.t < this.IDLE) this.state = 'idle';
    else if (this.t < this.IDLE + this.WARN) this.state = 'warn';
    else this.state = 'fire';

    if (prev !== 'fire' && this.state === 'fire') {
      this.fired = true;
      this._erupt(player, enemies);
    }
    if (this.state !== 'fire') this.fired = false;

    if (this.state === 'fire' && Math.random() < dt * 26) {
      Effects.spark(this.x + (Math.random() - 0.5) * this.r,
        this.y + (Math.random() - 0.5) * this.r,
        -Math.PI / 2, 2, '#ff7a1a', 420);
    }
  }

  _erupt(player, enemies) {
    Effects.explosion(this.x, this.y, this.r * 0.9);
    Effects.ring(this.x, this.y, this.r, '#ff7a1a');
    Camera.shake(6, 0.22);

    const burn = (m, isPlayer) => {
      if (!m || !m.alive || !this.covers(m)) return;
      if (m.sockets) {
        const hit = Machine.resolveHit(m, m.x, m.y, this.r * 0.6);
        if (hit) Machine.applyDamage(m, hit, this.DMG, m.x, m.y);
        else m.takeCoreDamage(this.DMG, m.x, m.y);
      } else {
        m.hit(this.DMG, m.x, m.y);
      }
      // The signature effect: it cooks your Heat bar, not just your HP.
      if (isPlayer && m.heat !== undefined) {
        m.heat = Math.min(m.heatCap, m.heat + this.HEAT);
        Effects.comicWord('HOT!', m.x, m.y - 130, '#ff7a1a');
      }
    };
    burn(player, true);
    for (const e of enemies) burn(e, false);
  }

  draw(ctx) {
    const warn = this.state === 'warn';
    const fire = this.state === 'fire';
    const t = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * (warn ? 15 : 2.5));

    // The Foundry floor texture has glowing orange grates baked into it, so an
    // orange grate hazard would read as scenery. This one is separated by a
    // DARK COLLAR, a red/white palette while arming, and a countdown ring —
    // none of which the floor does.
    R.circle(this.x, this.y, this.r + 26, 'rgba(8,6,14,0.78)');
    R.circle(this.x, this.y, this.r + 26, null, CONFIG.COLOR.ink, 10);

    const ventArt = !fire && typeof Assets !== 'undefined' &&
      Assets.sprite(ctx, 'prop_heatVent', this.x, this.y, this.r * 2.2, this.r * 2.2, 0);
    if (!ventArt)
    R.circle(this.x, this.y, this.r,
      fire ? '#ffffff'
           : (warn ? 'rgba(255,59,59,' + (0.35 + pulse * 0.4).toFixed(2) + ')'
                   : 'rgba(255,59,59,0.14)'),
      warn ? '#ff3b3b' : 'rgba(255,59,59,0.7)', warn ? 9 + pulse * 7 : 6);

    // Grate bars
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = warn ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 9;
    for (let i = -3; i <= 3; i++) {
      const off = i * (this.r * 0.3);
      ctx.beginPath();
      ctx.moveTo(this.x - this.r, this.y + off);
      ctx.lineTo(this.x + this.r, this.y + off);
      ctx.stroke();
    }
    ctx.restore();

    if (warn) {
      // Countdown ring: unmistakably a timer, not decoration
      const k = (this.t - this.IDLE) / this.WARN;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 0.72, -Math.PI / 2,
        -Math.PI / 2 + (1 - k) * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // Rising tell
      if (Math.random() < 0.5) {
        Effects.spark(this.x + (Math.random() - 0.5) * this.r * 1.2,
          this.y + this.r * 0.4, -Math.PI / 2, 1, '#ff3b3b', 260);
      }
    } else if (fire) {
      const k = (this.t - this.IDLE - this.WARN) / this.FIRE;
      const a = 1 - k;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      R.circle(this.x, this.y, this.r * (0.6 + k * 0.9), '#ffd23f');
      R.circle(this.x, this.y, this.r * (0.35 + k * 0.6), '#ffffff');
      ctx.restore();
    } else {
      // Resting: a dim heat glyph so the grate is learnable before it fires
      ctx.save();
      ctx.globalAlpha = 0.45;
      R.text('\u2191', this.x, this.y + 10, this.r * 0.8, '#ff3b3b');
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// MOVING PISTON (plan §45): a clearly telegraphed timing hazard that slides
// along a fixed lane. It shoves machines rather than deleting them — the point
// is to disrupt positioning while you are trying to line up a joint shot.
class Piston {
  constructor(x, y, w, h, axis = 'x', travel = 600, speed = 320, phase = 0) {
    this.x0 = x; this.y0 = y;
    this.w = w; this.h = h;
    this.axis = axis;
    this.travel = travel;
    this.speed = speed;
    this.t = (phase % 1) * (travel * 2 / speed);
    this.DMG = 14;
    this.hitCd = 0;
    this.alive = true;
    this.x = x; this.y = y;
  }

  update(dt, player, enemies) {
    const period = this.travel * 2 / this.speed;
    this.t = (this.t + dt) % period;
    const k = this.t / period;
    // Triangle wave: out, then back.
    const along = k < 0.5 ? (k * 2) : (2 - k * 2);
    if (this.axis === 'x') { this.x = this.x0 + along * this.travel; this.y = this.y0; }
    else { this.x = this.x0; this.y = this.y0 + along * this.travel; }

    this.hitCd = Math.max(0, this.hitCd - dt);
    const shove = (m) => {
      if (!m || !m.alive) return;
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const nx = Math.max(this.x, Math.min(m.x, this.x + this.w));
      const ny = Math.max(this.y, Math.min(m.y, this.y + this.h));
      const d = Math.hypot(m.x - nx, m.y - ny);
      if (d > (m.radius || 40)) return;
      const dx = m.x - cx, dy = m.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const push = 900 * (m.knockbackMul !== undefined ? m.knockbackMul : (m.recoilMul || 1));
      m.vx += dx / len * push;
      m.vy += dy / len * push;
      if (this.hitCd <= 0) {
        if (m.sockets) {
          const hit = Machine.resolveHit(m, m.x, m.y, 40);
          if (hit) Machine.applyDamage(m, hit, this.DMG, m.x, m.y);
          else m.takeCoreDamage(this.DMG, m.x, m.y);
        } else {
          m.hit(this.DMG, m.x, m.y);
        }
        Effects.spark(m.x, m.y, Math.atan2(dy, dx), 5, '#ffd23f', 420);
      }
    };
    shove(player);
    for (const e of enemies) shove(e);
    if (this.hitCd <= 0) this.hitCd = 0.5;
  }

  draw(ctx) {
    // Lane markings so the sweep is predictable. NOT a filled rectangle: that
    // reads as a hard-edged box sitting on the floor. Two edge rails plus
    // chevrons pointing the way it travels say the same thing without a box.
    ctx.save();
    const horiz = this.axis === 'x';
    const lx = this.x0, ly = this.y0;
    const lw = horiz ? this.travel + this.w : this.w;
    const lh = horiz ? this.h : this.travel + this.h;
    const rail = 5;
    ctx.globalAlpha = 0.45;
    if (horiz) {
      R.rect(lx, ly, lw, rail, CONFIG.COLOR.orange);
      R.rect(lx, ly + lh - rail, lw, rail, CONFIG.COLOR.orange);
    } else {
      R.rect(lx, ly, rail, lh, CONFIG.COLOR.orange);
      R.rect(lx + lw - rail, ly, rail, lh, CONFIG.COLOR.orange);
    }
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = CONFIG.COLOR.orange;
    ctx.lineWidth = 4;
    const span = horiz ? lw : lh;
    for (let d = 45; d < span; d += 90) {
      ctx.beginPath();
      if (horiz) {
        const mx = lx + d, my = ly + lh / 2;
        ctx.moveTo(mx - 14, my - 16); ctx.lineTo(mx + 6, my); ctx.lineTo(mx - 14, my + 16);
      } else {
        const mx = lx + lw / 2, my = ly + d;
        ctx.moveTo(mx - 16, my - 14); ctx.lineTo(mx, my + 6); ctx.lineTo(mx + 16, my - 14);
      }
      ctx.stroke();
    }
    ctx.restore();

    const pistonArt = typeof Assets !== 'undefined' && Assets.has('prop_piston');
    if (pistonArt) {
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      ctx.save();
      ctx.globalAlpha = 0.4;
      R.circle(cx + 6, cy + 10, Math.min(this.w, this.h) * 0.5, 'rgba(0,0,0,1)');
      ctx.restore();
      // Face the head ALONG its travel. The capture is a ram seen down its own
      // long axis, so a vertical piston needs a quarter turn; drawn with no
      // rotation it slid sideways like a door.
      const ang = this.axis === 'x' ? 0 : Math.PI / 2;
      const long = Math.max(this.w, this.h), short = Math.min(this.w, this.h);
      if (Assets.sprite(ctx, 'prop_piston', cx, cy,
                        long * 1.15, short * 1.15, ang)) {
        return;
      }
    }
    R.roundRect(this.x + 8, this.y + 10, this.w, this.h, 12, 'rgba(0,0,0,0.5)');
    R.roundRect(this.x, this.y, this.w, this.h, 12, '#5f708f', CONFIG.COLOR.ink, 9);
    // Hazard stripes on the face
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.w, this.h);
    ctx.clip();
    ctx.fillStyle = CONFIG.COLOR.yellow;
    for (let i = -2; i < this.w / 40 + 2; i++) {
      ctx.save();
      ctx.translate(this.x + i * 40, this.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8, -60, 16, this.h + 160);
      ctx.restore();
    }
    ctx.restore();
    R.roundRect(this.x, this.y, this.w, this.h, 12, null, CONFIG.COLOR.ink, 9);
  }
}

// ---------------------------------------------------------------------------
// LASER GATE (plan §47): a Coreworks emitter draws a thin sighting line, holds
// it, then fires a beam across the arena. Unlike the Foundry's area hazards it
// cuts a LINE, so it punishes standing still in the open rather than standing
// in a particular spot.
class LaserGate {
  constructor(x, y, angle, length = 1600, phase = 0) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.length = length;
    this.IDLE = 3.4;             // (tune)
    // Master §26B (Proving Ground row): "0.75s line warning -> 18 damage".
    // The ZERO port shipped 1.1/30; §26B's EXACT STARTING VALUES win.
    this.WARN = 0.75;
    this.FIRE = 0.45;            // (tune)
    this.DMG = 18;
    this.WIDTH = 34;
    this.t = (phase % 1) * (this.IDLE + this.WARN + this.FIRE);
    this.state = 'idle';
    this.alive = true;
  }

  get cycle() { return this.IDLE + this.WARN + this.FIRE; }

  _endpoint() {
    return { x: this.x + Math.cos(this.angle) * this.length,
             y: this.y + Math.sin(this.angle) * this.length };
  }

  // Distance from a machine to the beam segment.
  _distTo(m) {
    const e = this._endpoint();
    const vx = e.x - this.x, vy = e.y - this.y;
    const wx = m.x - this.x, wy = m.y - this.y;
    const len2 = vx * vx + vy * vy || 1;
    let t = (wx * vx + wy * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(m.x - (this.x + vx * t), m.y - (this.y + vy * t));
  }

  update(dt, player, enemies) {
    const prev = this.state;
    this.t = (this.t + dt) % this.cycle;
    if (this.t < this.IDLE) this.state = 'idle';
    else if (this.t < this.IDLE + this.WARN) this.state = 'warn';
    else this.state = 'fire';
    if (prev !== 'fire' && this.state === 'fire') this._fire(player, enemies);
  }

  _fire(player, enemies) {
    const e = this._endpoint();
    Effects.spark(this.x, this.y, this.angle, 10, '#ff3b3b', 900);
    Effects.explosion((this.x + e.x) / 2, (this.y + e.y) / 2, 60);
    Camera.shake(5, 0.18);

    const cut = (m) => {
      if (!m || !m.alive) return;
      if (this._distTo(m) > this.WIDTH + (m.radius || 40) * 0.6) return;
      if (m.sockets) {
        const hit = Machine.resolveHit(m, m.x, m.y, 60);
        if (hit) Machine.applyDamage(m, hit, this.DMG, m.x, m.y);
        else m.takeCoreDamage(this.DMG, m.x, m.y);
      } else {
        m.hit(this.DMG, m.x, m.y);
      }
    };
    cut(player);
    for (const en of enemies) cut(en);
  }

  draw(ctx) {
    const e = this._endpoint();
    const warn = this.state === 'warn';
    const fire = this.state === 'fire';

    // Emitter housing, always visible
    if (!(typeof Assets !== 'undefined' &&
        Assets.sprite(ctx, 'prop_laserEmitter', this.x, this.y, 108, 108, this.angle)))
    R.circle(this.x, this.y, 40, '#1d2540', CONFIG.COLOR.ink, 8);
    R.circle(this.x, this.y, 18, fire ? '#ffffff' : '#ff3b3b', CONFIG.COLOR.ink, 5);

    ctx.save();
    if (warn) {
      // Thin sighting line that thickens as it charges
      const k = (this.t - this.IDLE) / this.WARN;
      // Red, not cyan: the Coreworks floor is full of glowing cyan conduits,
      // so a cyan sighting line would read as scenery.
      ctx.strokeStyle = 'rgba(255,59,59,' + (0.45 + k * 0.5).toFixed(2) + ')';
      ctx.lineWidth = 3 + k * 10;
      ctx.setLineDash([26, 18]);
      ctx.lineDashOffset = -performance.now() / 14;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    } else if (fire) {
      const k = 1 - (this.t - this.IDLE - this.WARN) / this.FIRE;
      ctx.globalAlpha = Math.max(0, k);
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = this.WIDTH * 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = this.WIDTH * 0.8;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// ENERGY PULSE (plan §47): a circular wave from Coreworks machinery. Low
// damage, high disruption — it shoves machines AND loose salvage, so it can
// snatch the part you were reaching for and hand it to someone else. That is
// the point: in Zone 3 the battlefield itself competes with you.
class EnergyPulse {
  constructor(x, y, maxR = 900, phase = 0) {
    this.x = x; this.y = y;
    this.maxR = maxR;
    this.IDLE = 4.2;
    this.WARN = 0.8;
    this.EXPAND = 1.1;
    this.DMG = 8;
    this.PUSH = 1250;
    this.t = (phase % 1) * (this.IDLE + this.WARN + this.EXPAND);
    this.state = 'idle';
    this.r = 0;
    this.hitOnce = new Set();
    this.alive = true;
  }

  get cycle() { return this.IDLE + this.WARN + this.EXPAND; }

  update(dt, player, enemies) {
    const prev = this.state;
    this.t = (this.t + dt) % this.cycle;
    if (this.t < this.IDLE) this.state = 'idle';
    else if (this.t < this.IDLE + this.WARN) this.state = 'warn';
    else this.state = 'expand';

    if (prev !== 'expand' && this.state === 'expand') {
      this.hitOnce = new Set();
      Effects.ring(this.x, this.y, 120, '#9b5cff');
      Camera.shake(4, 0.2);
    }

    if (this.state === 'expand') {
      const k = (this.t - this.IDLE - this.WARN) / this.EXPAND;
      const prevR = this.r;
      this.r = k * this.maxR;
      this._sweep(prevR, this.r, player, enemies);
    } else {
      this.r = 0;
    }
  }

  _sweep(r0, r1, player, enemies) {
    const shove = (m, key) => {
      if (!m || m.alive === false) return;
      const d = Math.hypot(m.x - this.x, m.y - this.y);
      if (d < r0 - 60 || d > r1 + 60) return;
      if (this.hitOnce.has(key)) return;
      this.hitOnce.add(key);
      const nx = (m.x - this.x) / (d || 1), ny = (m.y - this.y) / (d || 1);
      const push = this.PUSH * (m.knockbackMul !== undefined ? m.knockbackMul
      : (m.recoilMul !== undefined ? m.recoilMul : 1));
      m.vx += nx * push;
      m.vy += ny * push;
      if (m.sockets) {
        const hit = Machine.resolveHit(m, m.x, m.y, 50);
        if (hit) Machine.applyDamage(m, hit, this.DMG, m.x, m.y);
        else if (m.takeCoreDamage) m.takeCoreDamage(this.DMG, m.x, m.y);
      }
    };
    shove(player, 'player');
    for (let i = 0; i < enemies.length; i++) shove(enemies[i], 'e' + i);
    // Loose salvage gets swept too — this is the disruptive bit.
    if (typeof LooseParts !== 'undefined') {
      LooseParts.items.forEach((it, i) => {
        const d = Math.hypot(it.x - this.x, it.y - this.y);
        if (d < r0 - 60 || d > r1 + 60) return;
        if (this.hitOnce.has('l' + i)) return;
        this.hitOnce.add('l' + i);
        const nx = (it.x - this.x) / (d || 1), ny = (it.y - this.y) / (d || 1);
        it.vx += nx * this.PUSH * 0.75;
        it.vy += ny * this.PUSH * 0.75;
      });
    }
  }

  draw(ctx) {
    const warn = this.state === 'warn';
    // Emitter
    if (!(typeof Assets !== 'undefined' &&
        Assets.sprite(ctx, 'prop_pulseEmitter', this.x, this.y, 140, 140, 0)))
    R.circle(this.x, this.y, 56, '#241a3e', CONFIG.COLOR.ink, 8);
    R.circle(this.x, this.y, 26,
      warn ? '#ffffff' : CONFIG.COLOR.violet, CONFIG.COLOR.ink, 5);

    if (warn) {
      const k = (this.t - this.IDLE) / this.WARN;
      ctx.save();
      ctx.globalAlpha = 0.25 + k * 0.45;
      ctx.strokeStyle = CONFIG.COLOR.violet;
      ctx.lineWidth = 8;
      ctx.setLineDash([30, 24]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.maxR * (0.35 + k * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.state === 'expand') {
      const k = this.r / this.maxR;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = CONFIG.COLOR.violet;
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// WEAPON CRATE — a guaranteed weapon on every map, but you have to open it.
//
// Salvage is otherwise entirely dependent on what you manage to shear off, so a
// bad first fight could leave a player with nothing new to bolt on for a whole
// zone. The crate arrives after the first wave (game.js) so it is a reward for
// surviving the opener rather than a free gift at spawn.
class WeaponCrate {
  // kind 'weapon' drops a part; kind 'power' drops power cells. Boss arenas
  // field no ordinary machines, so a heavy rig would otherwise starve for the
  // whole fight with no way to top up.
  constructor(x, y, partId, kind) {
    this.kind = kind === 'power' ? 'power' : 'weapon';
    this.x = x; this.y = y;
    this.radius = 46;
    this.maxHp = 30;
    this.hp = this.maxHp;
    this.alive = true;
    this.flash = 0;
    this.bob = Math.random() * Math.PI * 2;
    this.partId = partId;
    this.isCrate = true;
  }

  // Same shape as Canister.hit so it can sit in the same projectile target list.
  hit(dmg, hx, hy) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.1;
    Effects.spark(hx, hy, 0, 3, CONFIG.COLOR.yellow, 360);
    if (this.hp <= 0) this._open();
  }

  takeCoreDamage(dmg, hx, hy) { this.hit(dmg, hx, hy); }

  _open() {
    this.alive = false;
    Effects.explosion(this.x, this.y, 90);
    if (typeof Camera !== 'undefined') Camera.shake(5, 0.16);
    if (typeof Audio_ !== 'undefined') Audio_.play('connectorBreak');

    if (this.kind === 'power') {
      Effects.comicWord('POWER!', this.x, this.y - 70, CONFIG.COLOR.yellow, 80);
      if (typeof Pickups !== 'undefined') {
        for (let i = 0; i < 4; i++) Pickups.spawn(this.x, this.y, 'power');
      }
      return;
    }
    Effects.comicWord('CRACKED!', this.x, this.y - 70, CONFIG.COLOR.yellow);
    // The part lands as ordinary salvage: it still has to be magneted on.
    LooseParts.spawn(this.partId, 1, this.x, this.y,
      (Math.random() - 0.5) * 260, (Math.random() - 0.5) * 260);
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.bob += dt * 2.2;
  }

  draw(ctx) {
    if (!this.alive) return;
    const b = Math.sin(this.bob) * 5;
    const pulse = 0.5 + Math.sin(this.bob * 1.6) * 0.5;
    const artKey = this.kind === 'power' ? 'crate_power' : 'crate_weapon';
    const hasArt = typeof Assets !== 'undefined' && Assets.has(artKey);
    ctx.globalAlpha = 0.16 + pulse * 0.14;
    R.circle(this.x, this.y + b, this.radius * 2.1, CONFIG.COLOR.yellow);
    ctx.globalAlpha = 0.22 + pulse * 0.18;
    R.circle(this.x, this.y + b, this.radius * 1.45, CONFIG.COLOR.yellow);
    ctx.globalAlpha = 1;
    R.circle(this.x + 4, this.y + b + 10, this.radius, 'rgba(0,0,0,0.4)');
    if (hasArt && this.flash <= 0) {
      const img = Assets.get(artKey);
      const long = Math.max(img.width, img.height) || 1;
      const sc = (this.radius * 2.6) / long;
      if (Assets.sprite(ctx, artKey, this.x, this.y + b,
                        img.width * sc, img.height * sc, 0)) {
        const frac = Math.max(0, this.hp / this.maxHp);
        if (frac < 1) {
          R.rect(this.x - 40, this.y + b + this.radius + 10, 80 * frac, 8,
            CONFIG.COLOR.lime);
        }
        return;
      }
    }
    const body = this.flash > 0 ? '#ffffff'
      : (this.kind === 'power' ? '#243a5e' : '#6b5a22');
    R.roundRect(this.x - this.radius, this.y + b - this.radius,
      this.radius * 2, this.radius * 2, 10, body, CONFIG.COLOR.ink, 6);
    // hazard stripes so it reads as "cargo", plus a weapon glyph
    R.rect(this.x - this.radius + 8, this.y + b - 10, this.radius * 2 - 16, 20,
      this.kind === 'power' ? CONFIG.COLOR.cyan : CONFIG.COLOR.yellow);
    R.text(this.kind === 'power' ? '\u26A1' : '!', this.x, this.y + b - 26, 34,
      CONFIG.COLOR.ink);
    // damage state
    const frac = Math.max(0, this.hp / this.maxHp);
    if (frac < 1) {
      R.rect(this.x - 40, this.y + b + this.radius + 10, 80 * frac, 8,
        CONFIG.COLOR.lime);
    }
  }
}

// ---------------------------------------------------------------------------
// CONVEYOR (M19, Master §26B — Assembly Row): "moves machines/parts 160 u/s
// in marked direction". A control field, not a damage source — §26B is
// explicit that only hazards DESCRIBED as damaging hurt anything. It moves
// the player, enemies AND loose salvage, so the floor itself is a tactic:
// fight up-belt and your spent salvage drifts away from you.
// PLAYTEST 3, ITEM 1b. IT IS A BOOST, NOT AN OBSTACLE.
//
// Aaron read it as a thing to go round, which it was: a slow additive nudge
// you were on for half a second. The test the design sets is exact — "a player
// who sees a belt across the yard should think 'I'll take that', not 'I'll go
// round that'." Four things make that true, and all four are here:
//
//   LENGTH   comes from the generator (item 1a): a run between two buildings,
//            three times what the scatter pass used to make.
//   SPEED    x2.2 while you ride it with the arrows, not a small addition.
//   STEERING stays yours. The belt ADDS to your velocity; it never takes the
//            machine off you. Being trapped on a belt is infuriating.
//   DIRECTION matters. Against the arrows you crawl at 35%.
//
// And it has to READ as fast — speed lines, a rising whine, a small camera
// pull-back — or a boost feels like nothing at all.
class Conveyor {
  static SPEED = 160;               // §26B locked figure: the BELT's own speed
  // What riding it does to the machine on it. Applied to the player only: a
  // patrol dragged along at 2.2x would be a bug you cannot read, and the belt
  // is a tool the player steers onto, not a fairground ride for everyone.
  static RIDE_MUL = 2.2;
  static AGAINST_MUL = 0.35;        // ride it the wrong way and you crawl
  static DEADBAND = 40;             // below this you are not driving, you are on it
  static RIDE_EASE = 6;             // how fast the ride reads in and out

  constructor(x, y, w, h, dx = 1, dy = 0) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    const l = Math.hypot(dx, dy) || 1;
    this.dx = dx / l; this.dy = dy / l;
    this.t = Math.random() * 10;
    this.ride = 0;          // 0..1, how much the player is riding WITH it
    this._px = 0; this._py = 0;      // where they are, for the speed lines
  }

  contains(m) {
    const r = m.radius || 0;
    return m.x > this.x - r && m.x < this.x + this.w + r &&
           m.y > this.y - r && m.y < this.y + this.h + r;
  }

  update(dt, player, enemies) {
    this.t += dt;
    const push = Conveyor.SPEED * dt;
    // Everything that is NOT the player keeps the old behaviour exactly: the
    // belt carries it at the belt's speed. That is what makes the Assembly Row
    // a tactic — fight up-belt and your spent salvage drifts away from you.
    const carry = (m) => {
      if (!m || m.alive === false) return;
      if (!this.contains(m)) return;
      m.x += this.dx * push;
      m.y += this.dy * push;
    };
    for (const e of enemies) carry(e);
    if (typeof LooseParts !== 'undefined') {
      for (const it of LooseParts.items) {
        if (it.x > this.x && it.x < this.x + this.w &&
            it.y > this.y && it.y < this.y + this.h) {
          it.x += this.dx * push;
          it.y += this.dy * push;
        }
      }
    }

    // ---- THE PLAYER RIDES IT --------------------------------------------
    let want = 0;
    if (player && player.alive !== false && this.contains(player)) {
      // How fast they are ALREADY going along the belt, under their own
      // control. This is the number that decides what the belt does, and it
      // is why steering never leaves them: the belt reacts to the driving.
      const along = player.vx * this.dx + player.vy * this.dy;
      const ref = player.maxSpeed || Conveyor.SPEED;
      let give;
      if (along > Conveyor.DEADBAND) {
        // WITH THE ARROWS. Top up to RIDE_MUL of their own top speed.
        give = ref * (Conveyor.RIDE_MUL - 1);
        want = 1;
      } else if (along < -Conveyor.DEADBAND) {
        // AGAINST THEM. The belt fights: what is left is a crawl, and it is
        // still forward, because a belt that reverses you is a trap.
        give = ref * (1 - Conveyor.AGAINST_MUL);
      } else {
        // STANDING ON IT, or crossing it sideways. It just carries you at its
        // own speed — a bump, not a snap-to, which is what item 1b asks for.
        give = Conveyor.SPEED;
      }
      player.x += this.dx * give * dt;
      player.y += this.dy * give * dt;
      this._px = player.x; this._py = player.y;
    }

    // Ease so the effects come up and fall away rather than snapping on.
    const k = 1 - Math.exp(-Conveyor.RIDE_EASE * dt);
    this.ride += (want - this.ride) * k;
    if (this.ride < 0.004) this.ride = 0;

    if (this.ride > 0.25) {
      // IT HAS TO READ AS FAST. A small camera pull-back, set every frame and
      // decaying on its own, so nothing has to remember to switch it off.
      if (typeof Camera !== 'undefined') {
        Camera.boostPull = Math.max(Camera.boostPull || 0, this.ride);
      }
      // A rising mechanical whine, faked out of one-shots on a timer the same
      // way the cold open fakes its belt loop.
      this._whine = (this._whine || 0) - dt;
      if (this._whine <= 0 && typeof Audio_ !== 'undefined') {
        this._whine = 0.16;
        Audio_.play('beltRide',
          { pitch: 0.85 + this.ride * 0.5, gain: 0.4 + this.ride * 0.6 });
      }
    }
  }

  draw(ctx) {
    ctx.save();
    // Aaron's belt segments, tiled down the line; flat fill as the fallback.
    const seg = Math.min(this.w, this.h);
    let art = typeof Assets !== 'undefined' && Assets.has &&
      Assets.has('prop_conveyor');
    if (art) {
      const along = Math.max(this.w, this.h);
      const horiz = this.w >= this.h;
      for (let a = 0; a < along; a += seg) {
        const sw = Math.min(seg, along - a);
        Assets.sprite(ctx, 'prop_conveyor',
          horiz ? this.x + a + sw / 2 : this.x + this.w / 2,
          horiz ? this.y + this.h / 2 : this.y + a + sw / 2,
          seg, seg, horiz ? 0 : Math.PI / 2);
      }
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 8;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
    } else {
      ctx.fillStyle = 'rgba(30,40,52,0.85)';
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 8;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeRect(this.x, this.y, this.w, this.h);
    }
    // Rolling chevrons: the animation IS the direction telegraph.
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.w, this.h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(46,143,122,0.75)';
    ctx.lineWidth = 10;
    const along = Math.abs(this.dx) > Math.abs(this.dy) ? this.w : this.h;
    const lanes = Math.abs(this.dx) > Math.abs(this.dy) ? this.h : this.w;
    const step = 130;
    const off = (this.t * Conveyor.SPEED) % step;
    for (let s = -step; s < along + step; s += step) {
      const p = s + off;
      ctx.beginPath();
      if (Math.abs(this.dx) > Math.abs(this.dy)) {
        const px = this.dx > 0 ? this.x + p : this.x + this.w - p;
        const tip = this.dx > 0 ? 44 : -44;
        ctx.moveTo(px - tip, this.y + lanes * 0.2);
        ctx.lineTo(px, this.y + lanes * 0.5);
        ctx.lineTo(px - tip, this.y + lanes * 0.8);
      } else {
        const py = this.dy > 0 ? this.y + p : this.y + this.h - p;
        const tip = this.dy > 0 ? 44 : -44;
        ctx.moveTo(this.x + lanes * 0.2, py - tip);
        ctx.lineTo(this.x + lanes * 0.5, py);
        ctx.lineTo(this.x + lanes * 0.8, py - tip);
      }
      ctx.stroke();
    }

    // SPEED LINES. Drawn inside the belt's own clip, along its axis, scrolling
    // several times faster than the chevrons — the chevrons say which way, the
    // streaks say how fast. They only exist while somebody is riding, so an
    // idle belt stays quiet scenery.
    if (this.ride > 0.02) {
      const horiz = Math.abs(this.dx) > Math.abs(this.dy);
      const along = horiz ? this.w : this.h;
      const lanes = horiz ? this.h : this.w;
      const base = horiz ? this.x : this.y;
      const cross = horiz ? this.y : this.x;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.10 + this.ride * 0.42) + ')';
      ctx.lineWidth = 3;
      const len = 150 + this.ride * 320;
      const step = 210;
      const off = (this.t * Conveyor.SPEED * 5.5) % step;
      for (let s = -step; s < along + step; s += step) {
        for (let l = 0; l < 4; l++) {
          const cq = cross + lanes * (0.18 + l * 0.215);
          const p = s + off + l * 47;
          const fwd = (horiz ? this.dx : this.dy) > 0;
          const a0 = base + (fwd ? p : along - p);
          const a1 = a0 + (fwd ? -len : len);
          ctx.beginPath();
          if (horiz) { ctx.moveTo(a0, cq); ctx.lineTo(a1, cq); }
          else { ctx.moveTo(cq, a0); ctx.lineTo(cq, a1); }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// ARC PYLON (Maps 3+, Master §26B — Voltworks): "0.7s flash -> 18 damage
// +15 Heat within 180 radius". A fixed discharge tower on a cycle; §26B is
// explicit that hazards damage enemies too, so a pylon is COVER that bites —
// bait a machine into the ring and let the building fight for you.
// ---------------------------------------------------------------------------
// MOVING FREIGHT (RAIL SPINE). The one genuinely new hazard class in the whole
// content library, and the reason Rail Spine was promoted out of the expansion
// set: content/README calls it "the best idea in the content library and the
// most expensive", and says that if scope ever bites, cut the district rather
// than simplify the hazard — because THE HAZARD IS THE DISTRICT.
//
// A train runs its line, end to end, forever. Three things it does, and they
// are three different answers to the same object:
//
//   RIDE IT      hook the coupling with the magnet as a car goes by, moving
//                with it, and HOLD THE BAR (js/railhitch.js; content/
//                CONTENT_RAIL_HITCH.md, 22 Sept 2026). You are carried at
//                line speed for as long as you can hold it. It is the
//                conveyor's lesson (PLAYTEST 3 item 1b) at four times the
//                scale: the belt taught the player that machinery can be
//                transport, and this is what that lesson was for. Standing
//                on a flatbed no longer carries you for free: at 2.25x base
//                speed a free ride would have carried a full haul home and
//                deleted the banking loop; the hitch offers to carry it IF
//                you can hold it.
//   IT CRUSHES   the LEADING FACE only. Being hitched is transport; being in
//                front of it is a mistake you get one warning about, and the
//                warning is that you can see and hear it coming for a very
//                long time.
//   IT IS COVER  a train between you and a shooter is a wall, and it is a
//                wall that moves — so cover in this district is a thing with
//                a timetable rather than a thing with a position.
// The horn's reach, from the speed: a static initialiser cannot read the
// class's own earlier statics by name before the class exists, so the sum is
// a function.
function MovingFreight_warn() {
  return Math.round(((typeof JACKRIG_BASE_SPEED !== 'undefined') ? JACKRIG_BASE_SPEED : 640) * 2.25 * 4.2);
}

class MovingFreight {
  // A train is a LINE and a POSITION along it, not a box with a velocity:
  // wrapping a position is exact forever, while integrating a velocity drifts,
  // and a district whose cover has drifted out of alignment with its own rails
  // after ten minutes is worse than one with no trains.
  //
  // THE LINE SPEED IS THE RIDE SPEED -- DECIDED, 22 Sept 2026. "A little
  // more than double": 2.25x the Jackrig base (640), 1,440 u/s. Base is 640
  // and the machine on the bare frame does 576, so a ride is 2.25-2.5x what
  // the player can drive early; the fastest build in the game is 1,654
  // steady, so a train is faster than almost anything a player can drive but
  // not faster than the best late build -- worth catching all game without
  // making the map feel small. WORLD_SCALE.md carries the figure as a ride
  // along the rails, not a change to any district's size. Tune by eye.
  static RIDE_MUL = 2.25;
  static SPEED = ((typeof JACKRIG_BASE_SPEED !== 'undefined') ? JACKRIG_BASE_SPEED : 640) * 2.25;
  static CAR_L = 900;               // one flatbed
  static CAR_W = 300;
  static CRUSH = 46;                // what the leading face does
  static CRUSH_R = 200;             // and how far in front of it that reaches

  // ---- AND THE ONLY WARNING THAT IS ACTUALLY LONG ENOUGH -----------------
  //
  // CRUSH_R is 200 units at line speed. That is a fraction of a second, which
  // is not a warning, it is a verdict — and it was the open question this
  // whole hazard was left sitting on: "is the freight's crush fair without
  // sound?"
  //
  // No. THE SOUND IS THE WARNING. The horn fires four seconds out, for
  // exactly the machine that is about to be run over, and once that exists
  // the crush is allowed to be lethal because standing on the line with a
  // horn in your ears is a decision you made. DERIVED from the speed, so the
  // 2.25x line kept its 4.2 seconds rather than shrinking to 1.8.
  static WARN_R = MovingFreight_warn();  // 4.2 seconds at line speed
  static WARN_W = 260;              // half the band the horn cares about
  static PASS_R = 1400;             // near enough for a pass-by to register
  static RUMBLE_EVERY = 0.34;       // retriggered, like the belt

  constructor(x, y, len, cars, dir, phase, sidingId, sidingX) {
    // WHERE THIS TRAIN GOES. Optional, and only line 3 has one today —
    // LEDGER wants to know where anything ends up and nothing ever comes back.
    // A freight with no siding is scenery you can ride; a freight with one is
    // somewhere you can be taken.
    this.sidingId = sidingId || null;
    this.sidingX = sidingX === undefined ? null : sidingX;
    this.len = len || 12000;        // how long the line is
    this.x0 = x;                    // where the line STARTS
    this.x = x;
    this.y = y;
    // THE DRAW BAND CULLS ON A RECT, NOT ON A RADIUS. It reads
    // `e.x, e.y, e.w, e.h` as a top-left box, so an entity that describes
    // itself with a centre and a radius is culled as a 600-unit square
    // wherever its centre happens to be. A train is 195,000 units long, so
    // that meant rails at the buffers and NOTHING anywhere else along the
    // line — which is exactly what the first two Rail Spine screenshots
    // showed, and what a radius fix did not change.
    //
    // Declared both ways: `w`/`h` for the band, `radius` for everything that
    // asks how big a thing is.
    this.w = this.len;
    this.h = MovingFreight.CAR_W;
    this.radius = this.len / 2;
    this.cars = Math.max(1, cars || 4);
    this.dir = dir === undefined ? 1 : (dir < 0 ? -1 : 1);
    this.axis = 'x';                // Rail Spine runs east-west, always
    this.t = (phase || 0) * this.len;
    this._acc = new Map();
    // WHO IS HITCHED TO IT. Set by RailHitch.tryHook, cleared by release;
    // the only machine this train carries.
    this.rider = null;
  }

  // The train's head, along the line, wrapped. `+ this.len` before the modulo
  // because a negative direction makes `t` negative and JS's % keeps the sign.
  get head() {
    const total = this.len + this.cars * MovingFreight.CAR_L;
    const p = ((this.t % total) + total) % total;
    return this.x0 + (this.dir > 0 ? p : this.len - p);
  }

  // The rectangle the whole train occupies right now.
  bounds() {
    const l = this.cars * MovingFreight.CAR_L;
    const h = this.head;
    return {
      x: this.dir > 0 ? h - l : h,
      y: this.y - MovingFreight.CAR_W / 2,
      w: l, h: MovingFreight.CAR_W,
    };
  }

  onboard(m) {
    if (!m) return false;
    const b = this.bounds();
    return m.x > b.x && m.x < b.x + b.w && m.y > b.y && m.y < b.y + b.h;
  }

  update(dt, player) {
    this.t += MovingFreight.SPEED * dt;
    this._sound(dt, player);        // BEFORE any early return: a rider hears
                                    // the thing they are standing on
    if (!player || player.alive === false) return;
    const b = this.bounds();

    // HITCHED: carried. RailHitch pins the position (never the velocity,
    // exactly like the conveyor -- the machine is never taken off the
    // player, D154); what the train does here is write the record.
    if (this.rider === player) {
      // RIDE IT DOWN. The record is written by the TRAIN, at the moment it
      // carries you past the place — not by the mission watching the player's
      // coordinates, because the guarantee is "you rode it there" and a
      // player who walked to the same spot has not done that.
      if (this.sidingId && this.sidingX !== null &&
          this.dir * (player.x - this.sidingX) >= 0 &&
          typeof Progress !== 'undefined') {
        Progress.rode = Progress.rode || {};
        if (!Progress.rode[this.sidingId]) {
          Progress.rode[this.sidingId] = true;
          if (typeof Progress.save === 'function') Progress.save();
          if (typeof Effects !== 'undefined') {
            Effects.comicWord('THE END OF THE LINE', player.x, player.y - 220,
              CONFIG.COLOR.yellow, 54);
          }
        }
      }
      return;                       // you cannot be crushed by the thing
    }                               // you are hitched to

    // IN FRONT: the leading face. Only the face — the sides are a wall you
    // scrape along and the back is somewhere you can chase it from.
    const face = this.dir > 0 ? b.x + b.w : b.x;
    const ahead = (player.x - face) * this.dir;
    if (ahead > 0 && ahead < MovingFreight.CRUSH_R &&
        Math.abs(player.y - this.y) < MovingFreight.CAR_W / 2 + 40) {
      const now = this._acc.get(player) || 0;
      if (now <= 0) {
        this._acc.set(player, 0.6);
        // THE REAL PLAYER HAS takeCoreDamage, NOT damage. `player.damage`
        // was only ever a suite stub's method, so the lethal collision the
        // district note promised had never touched a real machine: found
        // while the hitch's fall damage was being wired (22 Sept 2026).
        if (player.takeCoreDamage) {
          player.takeCoreDamage(MovingFreight.CRUSH, player.x, player.y, false, 'hazard');
        } else if (player.damage) {
          player.damage(MovingFreight.CRUSH);
        }
        if (typeof Camera !== 'undefined') Camera.shake(22, 0.5);
      } else {
        this._acc.set(player, now - dt);
      }
    }
  }

  // ---- WHAT A TRAIN SOUNDS LIKE ------------------------------------------
  //
  // Three sounds, and each one is a different sentence:
  //   RUMBLE  "there is a train on this line"      — atmosphere, always on
  //   HORN    "it is coming at YOU"                — the fairness fix
  //   PASS    "that was close"                     — mass, after the fact
  //
  // All three go through `Audio_.playAt`, which is the general world-position
  // falloff rather than anything the train owns: CONTENT_AUDIO calls placed
  // diegetic sound the best value-per-effort audio in the game, and the pour
  // spouts and the unanswered phone want the same mechanism.
  _sound(dt, player) {
    const A = (typeof Audio_ !== 'undefined') ? Audio_ : null;
    if (!A || !A.playAt) return;

    const b = this.bounds();
    const face = this.dir > 0 ? b.x + b.w : b.x;
    // Sourced at the LEADING FACE, not the middle of the line. A train you
    // can hear is a train whose position you can hear, and the position that
    // matters is the end that arrives first.
    const sx = face, sy = this.y;

    this._rt = (this._rt || 0) - dt;
    if (this._rt <= 0) {
      this._rt = MovingFreight.RUMBLE_EVERY;
      A.playAt('railRumble', sx, sy);
    }

    if (!player || player.alive === false) { this._honked = false; return; }

    // THE HORN. On the line, in FRONT of the face, and inside the warning
    // window — which is to say, the exact set of machines that are going to
    // be hit unless something changes. Once per approach: a horn that repeats
    // every frame stops being information.
    const ahead = (player.x - face) * this.dir;
    const off = Math.abs(player.y - this.y);
    const near = ahead > 0 && ahead < MovingFreight.WARN_R &&
                 off < MovingFreight.WARN_W;
    if (near) {
      if (!this._honked) {
        this._honked = true;
        A.playAt('railHorn', sx, sy);
      }
    } else if (ahead <= -400 || ahead > MovingFreight.WARN_R * 1.2 ||
               off > MovingFreight.WARN_W * 1.6) {
      // Rearmed with a margin on every exit, so a machine sitting exactly on
      // the edge of the window does not sound the horn once a frame.
      this._honked = false;
    }

    // THE PASS. Sourced at the player's own x, because that is the point of
    // closest approach and the whole sound is about proximity.
    const alongside = ahead < 0 &&
                      ahead > -this.cars * MovingFreight.CAR_L &&
                      off < MovingFreight.PASS_R;
    if (alongside) {
      if (!this._passing) { this._passing = true; A.playAt('railPass', player.x, this.y); }
    } else if (ahead >= 0 || off > MovingFreight.PASS_R * 1.2) {
      this._passing = false;
    }
  }

  draw(ctx) {
    const b = this.bounds();
    // THE RAIL, first and always: the line exists whether or not the train is
    // on this part of it, and seeing where the rail goes is how you know
    // where the train will be.
    ctx.strokeStyle = 'rgba(120,126,140,0.55)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(this.x0, this.y - 70);
    ctx.lineTo(this.x0 + this.len, this.y - 70);
    ctx.moveTo(this.x0, this.y + 70);
    ctx.lineTo(this.x0 + this.len, this.y + 70);
    ctx.stroke();
    // Sleepers, so the rail reads as rail rather than as two lines.
    ctx.strokeStyle = 'rgba(70,66,58,0.5)';
    ctx.lineWidth = 22;
    for (let s = 0; s < this.len; s += 320) {
      ctx.beginPath();
      ctx.moveTo(this.x0 + s, this.y - 84);
      ctx.lineTo(this.x0 + s, this.y + 84);
      ctx.stroke();
    }

    // THE TRAIN. One box per car, so the couplings read and so a flatbed is
    // visibly a thing with a top you could be standing on.
    for (let i = 0; i < this.cars; i++) {
      const cx = b.x + i * MovingFreight.CAR_L;
      Props.standing(ctx, {
        x: cx + MovingFreight.CAR_L / 2, y: this.y,
        w: MovingFreight.CAR_L - 40, d: MovingFreight.CAR_W,
        height: 1.5, colour: i % 2 ? '#3a3026' : '#2a3038',
      });
    }
    // THE FACE THAT KILLS, marked. Hazard stripes, on the ground, which is
    // exactly the flat-drawing the spec allows: this is paint, not an object.
    const face = this.dir > 0 ? b.x + b.w : b.x;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = CONFIG.COLOR.orange;
    ctx.lineWidth = 10;
    for (let i = 0; i < 5; i++) {
      const px = face + this.dir * (i * 40);
      ctx.beginPath();
      ctx.moveTo(px, this.y - MovingFreight.CAR_W / 2);
      ctx.lineTo(px + this.dir * 26, this.y + MovingFreight.CAR_W / 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class ArcPylon {
  static WARN = 0.7;                // §26B locked
  static DAMAGE = 18;               // §26B locked
  static HEAT = 15;                 // §26B locked
  static RADIUS = 180;              // §26B locked
  static CYCLE = 4.5;               // idle time between flashes (tune)

  constructor(x, y, phase = 0) {
    this.x = x; this.y = y;
    this.t = phase * (ArcPylon.CYCLE + ArcPylon.WARN);
    this.state = 'idle';
  }

  update(dt, player, enemies) {
    this.t += dt;
    if (this.state === 'idle' && this.t >= ArcPylon.CYCLE) {
      this.state = 'warn';
      this.t = 0;
    } else if (this.state === 'warn' && this.t >= ArcPylon.WARN) {
      this.state = 'idle';
      this.t = 0;
      this._discharge(player, enemies);
    }
  }

  _discharge(player, enemies) {
    Effects.ring(this.x, this.y, ArcPylon.RADIUS, '#ffd23f');
    Camera.shake(4, 0.15);
    const zap = (m) => {
      if (!m || m.alive === false) return;
      const d = Math.hypot(m.x - this.x, m.y - this.y);
      if (d > ArcPylon.RADIUS + (m.radius || 0)) return;
      Effects.bolt(this.x, this.y, m.x, m.y, '#ffd23f');
      if (m.takeCoreDamage) {
        m.takeCoreDamage(ArcPylon.DAMAGE, m.x, m.y, false, 'hazard');
      } else if (m.hit) m.hit(ArcPylon.DAMAGE, m.x, m.y);
      if (m.isPlayer && typeof Machine !== 'undefined') {
        Machine.addHeat(m, ArcPylon.HEAT);
      }
    };
    zap(player);
    for (const e of enemies) zap(e);   // §26B: hazards damage enemies too
  }

  draw(ctx) {
    const warn = this.state === 'warn';
    const blink = warn && Math.sin(performance.now() / 45) > 0;
    if (warn) {
      const k = this.t / ArcPylon.WARN;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ArcPylon.RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,210,63,' + (0.06 + 0.14 * k) + ')';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,63,0.85)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    // The tower: Aaron's pylon model; the coil-stack vector is the fallback.
    if (!(typeof Assets !== 'undefined' &&
        Assets.sprite(ctx, 'prop_arcPylon', this.x, this.y, 160, 160, 0))) {
      ctx.fillStyle = '#1a2436';
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 56, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = blink ? '#fff3c4' : '#3a4a68';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 30 + i * 9, 0.4, Math.PI - 0.4);
        ctx.stroke();
      }
    }
    ctx.fillStyle = blink ? '#ffffff' : '#ffd23f';
    ctx.beginPath();
    ctx.arc(this.x, this.y - 8, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// POLARITY FIELD (Maps 3+, Master §26B — Voltworks): "3s push/pull zone at
// 120 u/s; no direct damage". It alternates: three seconds shoving everything
// out, three pulling everything in — machines, loose salvage, the lot. A
// control field: it never hurts anyone, it just decides where the fight is.
class PolarityField {
  static SPEED = 120;               // §26B locked
  static PHASE = 3;                 // §26B locked: 3s per polarity

  constructor(x, y, r, phase = 0) {
    this.x = x; this.y = y; this.r = r;
    this.t = phase * PolarityField.PHASE * 2;
  }

  // pull is +1 (inward) or -1 (outward) for the current 3s window.
  get pull() {
    return Math.floor(this.t / PolarityField.PHASE) % 2 === 0 ? -1 : 1;
  }

  update(dt, player, enemies) {
    this.t += dt;
    const dirIn = this.pull;
    const move = (m) => {
      if (!m || m.alive === false) return;
      const dx = this.x - m.x, dy = this.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d > this.r + (m.radius || 0) || d < 1) return;
      m.x += (dx / d) * dirIn * PolarityField.SPEED * dt;
      m.y += (dy / d) * dirIn * PolarityField.SPEED * dt;
    };
    move(player);
    for (const e of enemies) move(e);
    if (typeof LooseParts !== 'undefined') {
      for (const it of LooseParts.items) move(it);
    }
  }

  draw(ctx) {
    const inward = this.pull === 1;
    const col = inward ? '#9b5cff' : '#22d9ff';
    if (typeof Assets !== 'undefined') {
      Assets.sprite(ctx, 'prop_polarityField', this.x, this.y, 150, 150, 0);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = inward ? 'rgba(155,92,255,0.06)' : 'rgba(34,217,255,0.06)';
    ctx.fill();
    ctx.setLineDash([18, 14]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.setLineDash([]);
    // Drifting chevrons show the CURRENT direction — the read is instant.
    const k = (performance.now() / 1000 * PolarityField.SPEED) % 90;
    for (let i = 0; i < 3; i++) {
      const rr = inward ? this.r - ((k + i * 90) % (this.r * 0.8))
                        : this.r * 0.2 + ((k + i * 90) % (this.r * 0.8));
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(24, rr), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// CARGO SWEEP (Map 4+, Master §26B — Freight Spine): "moving freight block,
// 25 collision damage + strong knockback". A crate the size of a machine
// shuttling its lane end to end, forever. It hits BOTH sides (§26B), so the
// lanes are weapons for whoever times them better.
class CargoSweep {
  static DAMAGE = 25;               // §26B locked
  static KNOCK = 1400;              // "strong knockback" (tune)
  static SPEED = 420;               // traverse speed (tune)

  // axis 'x' or 'y'; travels from (x,y) along axis for `travel`, bouncing.
  constructor(x, y, w, h, axis, travel, phase = 0) {
    this.x0 = x; this.y0 = y; this.w = w; this.h = h;
    this.axis = axis; this.travel = travel;
    this.t = phase * (travel / CargoSweep.SPEED) * 2;
    this._hitCd = new Map();
  }

  get offset() {
    const period = (this.travel / CargoSweep.SPEED) * 2;
    const k = (this.t % period) / period;              // 0..1
    const tri = k < 0.5 ? k * 2 : 2 - k * 2;           // bounce
    return tri * this.travel;
  }

  get x() { return this.axis === 'x' ? this.x0 + this.offset : this.x0; }
  get y() { return this.axis === 'y' ? this.y0 + this.offset : this.y0; }

  get dir() {   // current travel direction, for the knockback
    const period = (this.travel / CargoSweep.SPEED) * 2;
    const k = (this.t % period) / period;
    return k < 0.5 ? 1 : -1;
  }

  update(dt, player, enemies) {
    this.t += dt;
    const hit = (m) => {
      if (!m || m.alive === false) return;
      const r = m.radius || 0;
      if (m.x + r < this.x || m.x - r > this.x + this.w ||
          m.y + r < this.y || m.y - r > this.y + this.h) return;
      const last = this._hitCd.get(m) || -9;
      if (this.t - last < 0.8) return;
      this._hitCd.set(m, this.t);
      const kx = this.axis === 'x' ? this.dir : 0;
      const ky = this.axis === 'y' ? this.dir : 0;
      if (m.takeCoreDamage) {
        m.takeCoreDamage(CargoSweep.DAMAGE, m.x, m.y, false, 'hazard');
      } else if (m.hit) m.hit(CargoSweep.DAMAGE, m.x, m.y);
      const kbm = m.knockbackMul !== undefined ? m.knockbackMul : 1;
      m.vx = (m.vx || 0) + kx * CargoSweep.KNOCK * kbm;
      m.vy = (m.vy || 0) + ky * CargoSweep.KNOCK * kbm;
      Effects.comicWord('FREIGHT!', m.x, m.y - (m.radius || 60) - 60,
        '#ff7a1a', 52);
      Camera.shake(6, 0.2);
    };
    hit(player);
    for (const e of enemies) hit(e);   // §26B: hazards damage enemies too
  }

  draw(ctx) {
    const x = this.x, y = this.y;
    const art = typeof Assets !== 'undefined' && Assets.sprite(ctx,
      'prop_freight', x + this.w / 2, y + this.h / 2,
      Math.max(this.w, this.h), Math.max(this.w, this.h),
      this.axis === 'y' ? Math.PI / 2 : 0);
    if (!art) {
      ctx.fillStyle = '#3a2f1a';
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 10;
      ctx.fillRect(x, y, this.w, this.h);
      ctx.strokeRect(x, y, this.w, this.h);
      // crate ribs
      ctx.strokeStyle = '#5c4a28';
      ctx.lineWidth = 6;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        if (this.axis === 'x') {
          ctx.moveTo(x + (this.w / 3) * i, y + 10);
          ctx.lineTo(x + (this.w / 3) * i, y + this.h - 10);
        } else {
          ctx.moveTo(x + 10, y + (this.h / 3) * i);
          ctx.lineTo(x + this.w - 10, y + (this.h / 3) * i);
        }
        ctx.stroke();
      }
    }
    // hazard chevrons along the leading edge — the telegraph outlives the art
    ctx.fillStyle = '#ffd23f';
    const lead = this.axis === 'x'
      ? (this.dir > 0 ? x + this.w - 26 : x)
      : (this.dir > 0 ? y + this.h - 26 : y);
    if (this.axis === 'x') ctx.fillRect(lead, y + 8, 26, this.h - 16);
    else ctx.fillRect(x + 8, lead, this.w - 16, 26);
  }
}

// ---------------------------------------------------------------------------
// FREIGHT BARRIER (Map 4+, Master §26B — Freight Spine): "opens/closes on a
// 5s cycle; collision itself does no damage". While closed it is a REAL wall
// in the obstacles list — machines and shots both stop at it; open, it is
// two posts and a gap. The §26B distinction: it controls, it never hurts.
class FreightBarrier {
  static CYCLE = 5;                 // §26B locked: 5s open, 5s closed

  constructor(x, y, w, h, phase, obstacles) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.t = phase * FreightBarrier.CYCLE * 2;
    this._obstacles = obstacles;
    this._wall = { type: 'wall', x, y, w, h };
    this._inList = false;
    this._sync();
  }

  get closed() {
    return Math.floor(this.t / FreightBarrier.CYCLE) % 2 === 1;
  }

  _sync() {
    if (!this._obstacles) return;
    const want = this.closed;
    if (want && !this._inList) {
      this._obstacles.push(this._wall);
      this._inList = true;
    } else if (!want && this._inList) {
      const i = this._obstacles.indexOf(this._wall);
      if (i >= 0) this._obstacles.splice(i, 1);
      this._inList = false;
    }
  }

  update(dt, player, enemies) {
    const was = this.closed;
    this.t += dt;
    if (this.closed !== was) {
      this._sync();
      if (typeof Effects !== 'undefined') {
        Effects.spark(this.x + this.w / 2, this.y + this.h / 2, 0, 6,
          '#8fa3c8', 300);
      }
      // Closing on top of a machine SHOVES it clear — no damage (§26B).
      if (this.closed) {
        const shove = (m) => {
          if (!m || m.alive === false) return;
          const r = m.radius || 0;
          if (m.x + r < this.x || m.x - r > this.x + this.w ||
              m.y + r < this.y || m.y - r > this.y + this.h) return;
          const leftD = m.x - this.x, rightD = this.x + this.w - m.x;
          const topD = m.y - this.y, botD = this.y + this.h - m.y;
          const min = Math.min(leftD, rightD, topD, botD);
          if (min === leftD) m.x = this.x - r - 4;
          else if (min === rightD) m.x = this.x + this.w + r + 4;
          else if (min === topD) m.y = this.y - r - 4;
          else m.y = this.y + this.h + r + 4;
        };
        shove(player);
        for (const e of enemies) shove(e);
      }
    }
  }

  draw(ctx) {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const horiz = this.w >= this.h;
    // end posts always stand
    ctx.fillStyle = '#2a3348';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 8;
    const post = 56;
    if (horiz) {
      ctx.fillRect(this.x - post, this.y - 8, post, this.h + 16);
      ctx.fillRect(this.x + this.w, this.y - 8, post, this.h + 16);
      ctx.strokeRect(this.x - post, this.y - 8, post, this.h + 16);
      ctx.strokeRect(this.x + this.w, this.y - 8, post, this.h + 16);
    } else {
      ctx.fillRect(this.x - 8, this.y - post, this.w + 16, post);
      ctx.fillRect(this.x - 8, this.y + this.h, this.w + 16, post);
      ctx.strokeRect(this.x - 8, this.y - post, this.w + 16, post);
      ctx.strokeRect(this.x - 8, this.y + this.h, this.w + 16, post);
    }
    if (this.closed) {
      const seg = Math.min(this.w, this.h);
      const horiz2 = this.w >= this.h;
      const along = Math.max(this.w, this.h);
      let art = typeof Assets !== 'undefined' && Assets.has &&
        Assets.has('prop_barricade');
      if (art) {
        for (let a = 0; a < along; a += seg) {
          const sw = Math.min(seg, along - a);
          Assets.sprite(ctx, 'prop_barricade',
            horiz2 ? this.x + a + sw / 2 : this.x + this.w / 2,
            horiz2 ? this.y + this.h / 2 : this.y + a + sw / 2,
            seg, seg, horiz2 ? 0 : Math.PI / 2);
        }
      } else {
        ctx.fillStyle = '#46536e';
        ctx.fillRect(this.x, this.y, this.w, this.h);
      }
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 8;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      if (horiz) {
        for (let sx = this.x + 30; sx < this.x + this.w - 10; sx += 70) {
          ctx.moveTo(sx, this.y + 8);
          ctx.lineTo(sx + 34, this.y + this.h - 8);
        }
      } else {
        for (let sy = this.y + 30; sy < this.y + this.h - 10; sy += 70) {
          ctx.moveTo(this.x + 8, sy);
          ctx.lineTo(this.x + this.w - 8, sy + 34);
        }
      }
      ctx.stroke();
    } else {
      // open: a dashed ghost of where it will slam back
      ctx.save();
      ctx.setLineDash([16, 16]);
      ctx.strokeStyle = 'rgba(143,163,200,0.4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
      ctx.restore();
      // countdown glow as the slam approaches
      const into = this.t % FreightBarrier.CYCLE;
      if (into > FreightBarrier.CYCLE - 1.2) {
        const k = (into - (FreightBarrier.CYCLE - 1.2)) / 1.2;
        ctx.fillStyle = 'rgba(255,210,63,' + (0.08 + 0.12 * k) + ')';
        ctx.fillRect(this.x, this.y, this.w, this.h);
      }
    }
    void cx; void cy;
  }
}

// ---------------------------------------------------------------------------
// ARTILLERY MARKER (Map 5+, Master §26B — War Depot): "1.1s warning ->
// 30 splash damage radius 160". Crown artillery shells a marked region of
// the floor on a cycle; half the strikes are AIMED at whoever is standing
// in the fire zone, half land where the range officer felt like it — so
// standing still is wrong and running blind is also wrong.
class ArtilleryMarker {
  static WARN = 1.1;                // §26B locked
  static DAMAGE = 30;               // §26B locked
  static RADIUS = 160;              // §26B locked
  static CYCLE = 5.5;               // seconds between strikes (tune)

  // Shells land inside the rect (x,y,w,h).
  constructor(x, y, w, h, phase = 0) {
    this.zx = x; this.zy = y; this.zw = w; this.zh = h;
    this.t = phase * ArtilleryMarker.CYCLE;
    this.mark = null;               // { x, y, t } while a shell is inbound
  }

  update(dt, player, enemies) {
    this.t += dt;
    if (this.mark) {
      this.mark.t += dt;
      if (this.mark.t >= ArtilleryMarker.WARN) {
        this._impact(this.mark, player, enemies);
        this.mark = null;
        this.t = 0;
      }
      return;
    }
    if (this.t < ArtilleryMarker.CYCLE) return;
    // Aim: at the player if they are in the fire zone (half the time), else
    // anywhere in the zone. The AIMED half is what makes it a hazard rather
    // than scenery. (tune)
    const inZone = player && player.alive &&
      player.x > this.zx && player.x < this.zx + this.zw &&
      player.y > this.zy && player.y < this.zy + this.zh;
    let tx, ty;
    if (inZone && Math.random() < 0.5) {
      tx = player.x + (player.vx || 0) * 0.4;
      ty = player.y + (player.vy || 0) * 0.4;
    } else {
      tx = this.zx + Math.random() * this.zw;
      ty = this.zy + Math.random() * this.zh;
    }
    this.mark = { x: tx, y: ty, t: 0 };
    if (typeof Audio_ !== 'undefined') Audio_.play('bossWarn', { gain: 0.2 });
  }

  _impact(mk, player, enemies) {
    Effects.explosion(mk.x, mk.y, ArtilleryMarker.RADIUS);
    Camera.shake(8, 0.25);
    const blast = (m) => {
      if (!m || m.alive === false) return;
      const d = Math.hypot(m.x - mk.x, m.y - mk.y);
      if (d > ArtilleryMarker.RADIUS + (m.radius || 0)) return;
      if (m.lastCause !== undefined) m.lastCause = 'hazard';
      if (m.sockets && typeof Machine !== 'undefined') {
        const hit = Machine.resolveHit(m, mk.x, mk.y, ArtilleryMarker.RADIUS) ||
          { kind: 'core' };
        // 'blast': a shell is a hazard to HARD HAT and an explosion to the
        // TANK, and applyDamage carries the word to both (D343).
        Machine.applyDamage(m, hit, ArtilleryMarker.DAMAGE, m.x, m.y, false, null, 'blast');
      } else if (m.takeCoreDamage) {
        m.takeCoreDamage(ArtilleryMarker.DAMAGE, m.x, m.y, false, 'hazard');
      } else if (m.hit) m.hit(ArtilleryMarker.DAMAGE, m.x, m.y);
    };
    blast(player);
    for (const e of enemies) blast(e);   // §26B: hazards damage enemies too
  }

  draw(ctx) {
    if (!this.mark) return;
    const k = this.mark.t / ArtilleryMarker.WARN;
    if (typeof Assets !== 'undefined') {
      Assets.sprite(ctx, 'prop_artyMarker',
        this.mark.x, this.mark.y, 130, 130, 0);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.mark.x, this.mark.y, ArtilleryMarker.RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,59,90,' + (0.08 + 0.16 * k) + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,59,90,0.9)';
    ctx.lineWidth = 5;
    ctx.stroke();
    // the shrinking ring: the §26B warning, readable at a glance
    ctx.beginPath();
    ctx.arc(this.mark.x, this.mark.y, ArtilleryMarker.RADIUS * (1 - k), 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.mark.x - 26, this.mark.y);
    ctx.lineTo(this.mark.x + 26, this.mark.y);
    ctx.moveTo(this.mark.x, this.mark.y - 26);
    ctx.lineTo(this.mark.x, this.mark.y + 26);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// MINE BELT (Map 5+, Master §26B — War Depot): "map mines deal 22 damage
// radius 150; can hurt enemies". REAL Mines-system mines with a 'map' owner
// — anyone triggers them, the blast already hits both sides — reseeded
// slowly, so a cleared path through the belt STAYS cleared long enough to
// use, then closes again.
const MAP_MINE = { mineDamage: 22, mineSplash: 150 };   // §26B locked

class MineBelt {
  static RESEED = 9;                // seconds per replacement mine (tune)

  constructor(x, y, w, h, count) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.count = count;
    this.mine = [];                 // our items inside Mines.items
    this.t = 0;
    for (let i = 0; i < count; i++) this._seed();
  }

  _seed() {
    if (typeof Mines === 'undefined') return;
    const mx = this.x + 60 + Math.random() * (this.w - 120);
    const my = this.y + 60 + Math.random() * (this.h - 120);
    Mines.spawn(mx, my, MAP_MINE, 'map');
    this.mine.push(Mines.items[Mines.items.length - 1]);
  }

  update(dt) {
    this.mine = this.mine.filter(m => Mines.items.includes(m));
    this.t += dt;
    if (this.t >= MineBelt.RESEED && this.mine.length < this.count) {
      this.t = 0;
      this._seed();
    }
  }

  draw(ctx) {
    // the belt itself: hatched ground so the DANGER STRIP reads before the
    // individual mines do
    ctx.save();
    ctx.strokeStyle = 'rgba(255,122,26,0.5)';
    ctx.lineWidth = 5;
    ctx.setLineDash([26, 18]);
    ctx.strokeRect(this.x, this.y, this.w, this.h);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(255,122,26,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let sx = this.x - this.h; sx < this.x + this.w; sx += 110) {
      ctx.moveTo(Math.max(this.x, sx), sx < this.x ? this.y + (this.x - sx) : this.y);
      ctx.lineTo(Math.min(this.x + this.w, sx + this.h),
        sx + this.h > this.x + this.w ? this.y + (this.x + this.w - sx) : this.y + this.h);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// COLLAPSE ZONE (Map 6+, Master §26B — Deep Cut): "1.2s warning -> 28 damage
// and temporary debris obstacle". The ceiling comes down somewhere in its
// region on a cycle; the §26B twist is the AFTERMATH — the rockfall stays as
// a real pillar for a while, so the room's shape keeps changing under you.
// ---------------------------------------------------------------------------
// ROUGH GROUND. The one terrain type that costs you nothing but time.
//
// It exists because RUGGED TREADS did not work. CONTENT_MODULES: "Ignores
// rough ground, rubble and debris slowdown. -15% top speed. Slower everywhere,
// faster where it's bad. REAL TRADE." — and there was no bad ground anywhere
// in the game, so the module was -15% and nothing else: a pickup that made
// your machine strictly worse. Wiring only the penalty half of a trade is
// worse than leaving it unwired, because the player cannot tell which half is
// missing.
//
// Deliberately the most boring hazard in the file, and that is the point of it:
//
//   IT DOES NO DAMAGE. Terrain in the open world is not allowed to hurt you
//   (the whole active-hazard purge was about that) and a slow patch that also
//   bit would just be a mine field with extra steps.
//   IT IS NOT SOLID. You drive across it. Nothing to route around, nothing to
//   shoot, no cycle to learn — it is a cost you pay or a cost you fit a part to
//   stop paying.
//   IT SLOWS ENEMIES TOO. §26B, and it is what makes it tactical rather than a
//   tax: a patrol chasing you across broken ground is a patrol you can lose.
//
// Slowing goes through the SAME `_fieldSlowT` / `_slowFieldT` fields LockZone
// uses, so there is one slow in the game rather than two that can disagree.
class RoughGround {
  static SLOW = 0.70;               // -30% while you are on it
  static HOLD = 0.15;               // the same refresh window every slow uses

  constructor(x, y, w, h) {
    this.x = x; this.y = y;
    this.w = w || 1400;
    this.h = h || 900;
    this.radius = Math.max(this.w, this.h) / 2;
    this._seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  }

  inside(m) {
    return m && m.x > this.x && m.x < this.x + this.w &&
           m.y > this.y && m.y < this.y + this.h;
  }

  update(dt, player, enemies) {
    // THE MODULE'S HALF OF THE TRADE. Asked per machine rather than cached,
    // because the treads can be shot off while you are standing on the patch
    // and the ground should notice.
    if (this.inside(player) && player.alive !== false &&
        !(typeof Modules !== 'undefined' &&
          Modules.has(player, 'ignoresRough'))) {
      player._fieldSlowT = RoughGround.HOLD;
      player._fieldSlowMul = RoughGround.SLOW;
    }
    for (const e of (enemies || [])) {
      if (e.alive === false || !this.inside(e)) continue;
      // BREAKS TERRAIN (the BORER) and AMPHIBIOUS (the LURK): rough ground
      // is nothing to either. The half of `breaksTerrain` that breaks a
      // pillar waits on the Digs, and Enemies.applyTraits says so.
      if (e.traits && (e.traits.breaksTerrain || e.traits.amphibious)) continue;
      e._slowFieldT = RoughGround.HOLD;
      e._slowFieldMul = RoughGround.SLOW;
    }
  }

  draw(ctx) {
    // Drawn as ground, under everything, because it IS the ground.
    //
    // THE FIRST VERSION FAILED A SCREENSHOT. It was a translucent grey fill
    // with a dashed rectangle round it, and on the Yard's dirt that read as a
    // DEBUG BOX rather than as terrain — you could see a rectangle and could
    // not see any ground. A hazard whose whole job is "decide to drive round
    // it" has to be legible from across the frame before anything names it,
    // so: an opaque bed, real rubble with light on top of it, cracks, and a
    // ragged edge made of overlapping stones instead of a stroked box.
    ctx.save();
    let r = this._seed;
    const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);

    // THE BED IS NOT A RECTANGLE ANY MORE.
    //
    // WORLD_FEEL's second argument is that A RECTANGLE IS A ROOM, and the
    // Sprawl's rough patch is 2400 by 1100 with the player's arrival point
    // INSIDE it -- so the first thing anybody sees on entering the district
    // CONTENT_WORLD calls its emotional centre was a hard-edged brown carpet.
    // (screenshots/the_sprawl.png, before this.)
    //
    // The ragged edge below was already trying: stones of 10 to 28 units
    // spilling over the boundary. Against a 2400-unit side at the shipped zoom
    // they are two pixels of fringe on a crisp straight line, and the line
    // wins. So the BED wanders instead -- twenty-eight points round the
    // perimeter, each pushed OUT by up to 7% of the short side, seeded from
    // the patch's own position so it is the same shape every time you come
    // back.
    //
    // OUT AND NEVER IN, ON PURPOSE. `inside()` is still the rectangle, because
    // it is a slow field and the cheap test is the right one for something
    // checked per machine per frame. Pushing the silhouette outward means
    // everything that slows you LOOKS rough, and a little rough-looking ground
    // does not slow you. The other way round -- clean ground that slows you --
    // is the one a player would call a bug.
    const bump = Math.min(this.w, this.h) * 0.07;
    const ring = [];
    const N = 28;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * 2 * (this.w + this.h);
      let px, py, nx, ny;
      if (t < this.w) { px = this.x + t; py = this.y; nx = 0; ny = -1; }
      else if (t < this.w + this.h) {
        px = this.x + this.w; py = this.y + (t - this.w); nx = 1; ny = 0;
      } else if (t < 2 * this.w + this.h) {
        px = this.x + this.w - (t - this.w - this.h); py = this.y + this.h;
        nx = 0; ny = 1;
      } else {
        px = this.x; py = this.y + this.h - (t - 2 * this.w - this.h);
        nx = -1; ny = 0;
      }
      const d = rnd() * bump;
      // A slide ALONG the edge as well as out from it, so the corners stop
      // being corners.
      const sl = (rnd() - 0.5) * bump * 1.4;
      ring.push([px + nx * d - ny * sl, py + ny * d + nx * sl]);
    }
    ctx.fillStyle = '#2e2b26';
    ctx.beginPath();
    ctx.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) ctx.lineTo(ring[i][0], ring[i][1]);
    ctx.closePath();
    ctx.fill();

    // CRACKS, drawn first so the stones sit on top of them.
    ctx.strokeStyle = 'rgba(20,18,16,0.85)';
    ctx.lineWidth = 6;
    const nc = 4 + Math.round(this.w / 700);
    for (let i = 0; i < nc; i++) {
      let cx = this.x + rnd() * this.w, cy = this.y + rnd() * this.h;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) {
        cx += (rnd() - 0.5) * 320;
        cy += (rnd() - 0.5) * 240;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // RUBBLE: a dark stone with a lit top, which is how every other solid
    // thing in this game says "I stand up off the floor".
    // Over the whole wandering bed, not just the rectangle inside it: a lobe
    // of bare fill colour reading as a painted shape is the fault this is
    // fixing, at a smaller size.
    const n = Math.max(20, Math.round(this.w * this.h / 14000));
    for (let i = 0; i < n; i++) {
      const px = this.x - bump + rnd() * (this.w + bump * 2);
      const py = this.y - bump + rnd() * (this.h + bump * 2);
      const rr = 9 + rnd() * 20;
      ctx.fillStyle = '#211f1b';
      ctx.beginPath();
      ctx.arc(px, py + 5, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rnd() < 0.35 ? '#6e6759' : '#514b41';
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.fill();
    }

    // A RAGGED EDGE. Stones spilling over the boundary, so the patch stops
    // being a rectangle at the only place a rectangle would show.
    const per = 2 * (this.w + this.h);
    const ne = Math.max(18, Math.round(per / 130));
    for (let i = 0; i < ne; i++) {
      const t = rnd() * per;
      let px, py;
      if (t < this.w) { px = this.x + t; py = this.y; }
      else if (t < this.w + this.h) { px = this.x + this.w; py = this.y + (t - this.w); }
      else if (t < 2 * this.w + this.h) { px = this.x + this.w - (t - this.w - this.h); py = this.y + this.h; }
      else { px = this.x; py = this.y + this.h - (t - 2 * this.w - this.h); }
      const rr = 10 + rnd() * 18;
      ctx.fillStyle = '#2e2b26';
      ctx.beginPath();
      ctx.arc(px + (rnd() - 0.5) * 40, py + (rnd() - 0.5) * 40, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// ARENA TERRAIN — THE THREE THINGS THE OTHER FIVE LAIRS ARE ABOUT
//
// draft_lairs.js opens with the rule the whole block hangs off:
//
//   "EVERY BOSS'S SOLUTION LIVES IN ITS ARENA. The Crucible fight is only
//    about radiators because the floor is molten and the cold lanes close;
//    Boremaw is only about benches because the pit floor is soft. Ship a boss
//    into a flat box and its whole design evaporates."
//
// Most of what the five arenas ask for already exists and is reused: pillars,
// benches, plinths and server rows are OBSTACLES (and `type: 'pillar'` already
// blocks line of sight, which is the entire Bailiff fight); laser gates, arc
// pylons, pulse emitters, collapses and shield lines are registered hazards;
// soft pit floor is `rough`. Three things did not exist, and each one is the
// thing its fight is actually about.
// ---------------------------------------------------------------------------

// SHALLOW WATER (THE SUMPWORKS, BASIN THREE). The Stitcher's arena is water
// you wade and walkways you do not, and the fight is the choice between the
// short way and the fast way. Slows on purpose rather than damaging: this is
// a positioning question, and water that hurt would just be lava.
class ShallowWater {
  static SLOW = 0.85;               // gentler than rough ground - you can wade
  static HOLD = 0.15;

  constructor(x, y, w, h) {
    this.x = x; this.y = y;
    this.w = w || 1600; this.h = h || 1200;
    this.radius = Math.max(this.w, this.h) / 2;
    this.t = 0;
  }

  inside(m) {
    return m && m.x > this.x && m.x < this.x + this.w &&
           m.y > this.y && m.y < this.y + this.h;
  }

  update(dt, player, enemies) {
    this.t += dt;
    // Rugged treads read here too. Bad ground is bad ground, and a module
    // that ignores rubble ignoring a puddle is the same promise kept twice.
    if (this.inside(player) && player.alive !== false &&
        !(typeof Modules !== 'undefined' &&
          Modules.has(player, 'ignoresRough'))) {
      player._fieldSlowT = ShallowWater.HOLD;
      player._fieldSlowMul = ShallowWater.SLOW;
    }
    for (const e of (enemies || [])) {
      if (e.alive === false || !this.inside(e)) continue;
      // AMPHIBIOUS (the LURK): it wades. Water is where it fights from.
      if (e.traits && e.traits.amphibious) continue;
      e._slowFieldT = ShallowWater.HOLD;
      e._slowFieldMul = ShallowWater.SLOW;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(26,54,66,0.82)';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    // Two slow bands crawling across it, so still water reads as water and
    // not as a blue rectangle painted on the floor.
    ctx.strokeStyle = 'rgba(120,190,210,0.20)';
    ctx.lineWidth = 10;
    for (let i = 0; i < 5; i++) {
      const yy = this.y + ((i * 260 + this.t * 26) % this.h);
      ctx.beginPath();
      ctx.moveTo(this.x, yy);
      ctx.lineTo(this.x + this.w, yy + 22);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,210,230,0.45)';
    ctx.lineWidth = 5;
    ctx.strokeRect(this.x, this.y, this.w, this.h);
    ctx.restore();
  }
}

// OPEN EDGE (THE STACKS, ROOF PLANT). The Kingmaker's arena is a roof, and
// the draft is emphatic about the one decision that makes a rooftop boss fun
// instead of infuriating:
//
//   "You can be knocked off - costing health and a climb, NOT a death."
//
// So this NEVER kills. It takes a quarter of your health, puts you back at
// the stairhead, and costs you twelve seconds of the fight. Losing a boss
// fight to a physics nudge is the single most hated thing a game can do, and
// the arena is only allowed to have edges because it does not do that.
class OpenEdge {
  static DAMAGE_FRAC = 0.25;
  static SECONDS = 12;              // what the climb costs you

  constructor(x, y, w, h, backX, backY) {
    this.x = x; this.y = y;
    this.w = w || 1200; this.h = h || 400;
    this.radius = Math.max(this.w, this.h) / 2;
    // Where the stair comes back up. Authored, not derived: a respawn point a
    // machine cannot be standing on is worth more than a clever one.
    this.backX = backX === undefined ? x + this.w / 2 : backX;
    this.backY = backY === undefined ? y - 900 : backY;
  }

  over(m) {
    return m && m.x > this.x && m.x < this.x + this.w &&
           m.y > this.y && m.y < this.y + this.h;
  }

  update(dt, player) {
    if (!this.over(player) || player.alive === false) return;
    // NEVER A KILL. Floored at 1 hp, deliberately, so a fall at low health is
    // the worst thing that can happen and not the last.
    const hp = player.hp !== undefined ? player.hp : null;
    if (hp !== null) {
      const max = player.maxHp || hp;
      player.hp = Math.max(1, hp - max * OpenEdge.DAMAGE_FRAC);
    }
    player.x = this.backX;
    player.y = this.backY;
    player.vx = 0; player.vy = 0;
    player._fellAt = OpenEdge.SECONDS;
    if (typeof Camera !== 'undefined') {
      Camera.shake(20, 0.5);
      if (Camera.snapTo) Camera.snapTo(player.x, player.y);
    }
    if (typeof Effects !== 'undefined') {
      Effects.comicWord('LONG WAY DOWN', player.x, player.y - 200,
        CONFIG.COLOR.orange, 58);
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('scrapped');
  }

  draw(ctx) {
    ctx.save();
    // Nothing beyond it. The edge is a hatched warning strip and then dark,
    // because a player has to be able to see where the roof stops from across
    // the deck and before anything tells them.
    ctx.fillStyle = '#07080d';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 7;
    const edgeY = this.y < 0 ? this.y + this.h : this.y;
    ctx.beginPath();
    ctx.moveTo(this.x, edgeY);
    ctx.lineTo(this.x + this.w, edgeY);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,210,63,0.5)';
    for (let x = this.x; x < this.x + this.w; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, edgeY);
      ctx.lineTo(x + 46, edgeY + (this.y < 0 ? -46 : 46));
      ctx.stroke();
    }
    ctx.restore();
  }
}

// A PRODUCTION PYLON. ONE mechanism for two different arenas, because they
// are the same idea seen twice:
//
//   THE BAILIFF   summons MARSHALs from the colonnade, every 25s, max 4.
//   THE DISPATCHER has no weapons at all. Four pylons send the ENTIRE roster
//                 you have ever fought, in ascending order of quality, until
//                 you break them. "There was never anyone to fight."
//
// Standing rule 6: a second summoner would have been a second system. This is
// one entry with a build list and a cadence, and the Dispatcher's version is
// the same object with a longer list.
class ProductionPylon {
  static R = 150;
  static HP = 220;

  constructor(x, y, builds, everySec, maxAlive) {
    this.x = x; this.y = y;
    this.radius = ProductionPylon.R;
    this.w = ProductionPylon.R * 2; this.h = ProductionPylon.R * 2;
    // A list, not a single id: the Dispatcher's whole line is that it sends
    // WORSE things first and better things later, and that is a list in order.
    this.builds = (builds && builds.length) ? builds.slice() : ['marshal'];
    this.every = everySec || 25;
    this.maxAlive = maxAlive || 4;
    this.hp = ProductionPylon.HP;
    this.maxHp = ProductionPylon.HP;
    this.alive = true;
    this.sent = 0;
    this.t = this.every * 0.5;      // half a cycle, so the first one is a beat
    this._mine = [];
  }

  // Shot like anything else. A pylon you cannot break is a timer, and a timer
  // is not a fight.
  hit(dmg) {
    if (!this.alive) return;
    this.hp -= dmg;
    if (this.hp > 0) return;
    this.alive = false;
    if (typeof Effects !== 'undefined') {
      Effects.explosion(this.x, this.y, 260);
      Effects.comicWord('ONE FEWER LINE', this.x, this.y - 200,
        CONFIG.COLOR.cyan, 54);
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('shieldBreak');
  }

  aliveCount() {
    let n = 0;
    for (const m of this._mine) if (m && m.alive) n++;
    return n;
  }

  update(dt) {
    if (!this.alive) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.every;
    if (this.aliveCount() >= this.maxAlive) return;
    // ASCENDING. The list is authored worst-first and consumed in order, so
    // the arena escalates on its own and the player can feel it doing so.
    const id = this.builds[Math.min(this.sent, this.builds.length - 1)];
    const m = ProductionPylon.send(id, this.x, this.y);
    if (m) { this._mine.push(m); this.sent++; }
  }

  // The one place a pylon reaches into the world. Static so a test can drive
  // it without a live Population, and so there is exactly one route in.
  static send(buildId, x, y) {
    if (typeof Population === 'undefined' || !Population.spawnBuild) return null;
    return Population.spawnBuild(buildId, x, y);
  }

  draw(ctx) {
    ctx.save();
    const r = ProductionPylon.R;
    ctx.fillStyle = this.alive ? '#2a3550' : '#1a1d24';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (this.alive) {
      // A charge ring, so the next one arriving is something you can see
      // coming and choose to shoot the pylon instead.
      const k = 1 - Math.max(0, this.t) / this.every;
      ctx.strokeStyle = CONFIG.COLOR.magenta;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.72, -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.fillStyle = CONFIG.COLOR.magenta;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#3a4054';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(this.x - r * 0.5, this.y - r * 0.5);
      ctx.lineTo(this.x + r * 0.5, this.y + r * 0.5);
      ctx.moveTo(this.x + r * 0.5, this.y - r * 0.5);
      ctx.lineTo(this.x - r * 0.5, this.y + r * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class CollapseZone {
  static WARN = 1.2;                // §26B locked
  static DAMAGE = 28;               // §26B locked
  static RADIUS = 150;              // rubble footprint (tune)
  static DEBRIS_TTL = 10;           // seconds the rockfall stands (tune)
  static CYCLE = 7;                 // seconds between falls (tune)

  constructor(x, y, w, h, phase, obstacles) {
    this.zx = x; this.zy = y; this.zw = w; this.zh = h;
    this.t = phase * CollapseZone.CYCLE;
    this.mark = null;
    this._obstacles = obstacles;
    this._debris = [];              // { o, ttl }
  }

  update(dt, player, enemies) {
    // standing debris crumbles away
    for (let i = this._debris.length - 1; i >= 0; i--) {
      const d = this._debris[i];
      d.ttl -= dt;
      if (d.ttl > 0) continue;
      const k = this._obstacles.indexOf(d.o);
      if (k >= 0) this._obstacles.splice(k, 1);
      this._debris.splice(i, 1);
      Effects.spark(d.o.x, d.o.y, -Math.PI / 2, 5, '#8fa3c8', 260);
    }

    this.t += dt;
    if (this.mark) {
      this.mark.t += dt;
      if (this.mark.t >= CollapseZone.WARN) {
        this._fall(this.mark, player, enemies);
        this.mark = null;
        this.t = 0;
      }
      return;
    }
    if (this.t < CollapseZone.CYCLE) return;
    // Half the falls chase whoever is under this stretch of ceiling. (tune)
    const inZone = player && player.alive &&
      player.x > this.zx && player.x < this.zx + this.zw &&
      player.y > this.zy && player.y < this.zy + this.zh;
    this.mark = {
      x: inZone && Math.random() < 0.5
        ? player.x : this.zx + 120 + Math.random() * (this.zw - 240),
      y: inZone && Math.random() < 0.5
        ? player.y : this.zy + 120 + Math.random() * (this.zh - 240),
      t: 0,
    };
  }

  _fall(mk, player, enemies) {
    Effects.explosion(mk.x, mk.y, CollapseZone.RADIUS);
    Camera.shake(9, 0.3);
    const crush = (m) => {
      if (!m || m.alive === false) return;
      const d = Math.hypot(m.x - mk.x, m.y - mk.y);
      if (d > CollapseZone.RADIUS + (m.radius || 0)) return;
      if (m.lastCause !== undefined) m.lastCause = 'hazard';
      if (m.takeCoreDamage) {
        m.takeCoreDamage(CollapseZone.DAMAGE, m.x, m.y, false, 'hazard');
      } else if (m.hit) m.hit(CollapseZone.DAMAGE, m.x, m.y);
      // shoved out from under the rockfall
      const push = d || 1;
      m.x += (m.x - mk.x) / push * 60;
      m.y += (m.y - mk.y) / push * 60;
    };
    crush(player);
    for (const e of enemies) crush(e);   // §26B: hazards damage enemies too
    // §26B: "temporary debris obstacle" — a REAL pillar, in the live list.
    const o = { type: 'pillar', x: mk.x, y: mk.y, r: 70, style: 'debris' };
    this._obstacles.push(o);
    this._debris.push({ o, ttl: CollapseZone.DEBRIS_TTL });
  }

  draw(ctx) {
    // standing rubble
    for (const d of this._debris) {
      ctx.fillStyle = '#3a3630';
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(d.o.x, d.o.y, d.o.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#57534a';
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + d.o.x * 0.01;
        ctx.beginPath();
        ctx.arc(d.o.x + Math.cos(a) * 26, d.o.y + Math.sin(a) * 24,
          16 - i * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (!this.mark) return;
    const k = this.mark.t / CollapseZone.WARN;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.mark.x, this.mark.y, CollapseZone.RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(208,138,30,' + (0.08 + 0.16 * k) + ')';
    ctx.fill();
    ctx.strokeStyle = 'rgba(208,138,30,0.9)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.mark.x, this.mark.y, CollapseZone.RADIUS * (1 - k), 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();
    // falling dust
    if (Math.random() < 0.5) {
      Effects.spark(this.mark.x + (Math.random() - 0.5) * 200,
        this.mark.y + (Math.random() - 0.5) * 200, Math.PI / 2, 1, '#8a7a5c', 160);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// DRILL RAIL (Map 6+, Master §26B — Deep Cut): "moving drill-head lane,
// 32 damage + high Connector damage". A mining head shuttling a fixed rail:
// the body hit costs 32, and if a mounted part is in the teeth its CONNECTOR
// takes the bite instead — the Deep Cut chews joints, exactly like its
// Warden.
class DrillRail {
  static DAMAGE = 32;               // §26B locked
  static CONN_MUL = 1.5;            // "high Connector damage" (tune)
  static SPEED = 460;               // head speed along the rail (tune)

  constructor(x, y, axis, travel, phase = 0) {
    this.x0 = x; this.y0 = y;
    this.axis = axis; this.travel = travel;
    this.r = 62;                    // drill-head radius
    this.t = phase * (travel / DrillRail.SPEED) * 2;
    this._hitCd = new Map();
    this.spin = 0;
  }

  get offset() {
    const period = (this.travel / DrillRail.SPEED) * 2;
    const k = (this.t % period) / period;
    return (k < 0.5 ? k * 2 : 2 - k * 2) * this.travel;
  }
  get hx() { return this.axis === 'x' ? this.x0 + this.offset : this.x0; }
  get hy() { return this.axis === 'y' ? this.y0 + this.offset : this.y0; }

  update(dt, player, enemies) {
    this.t += dt;
    this.spin += dt * 26;
    const bite = (m) => {
      if (!m || m.alive === false) return;
      const d = Math.hypot(m.x - this.hx, m.y - this.hy);
      if (d > this.r + (m.radius || 0) + 30) return;
      const last = this._hitCd.get(m) || -9;
      if (this.t - last < 0.8) return;
      this._hitCd.set(m, this.t);
      // A mounted part in the teeth? Its JOINT takes the §26B bite.
      let chewed = false;
      if (m.sockets && typeof Machine !== 'undefined') {
        let best = null, bd = 1e9;
        for (const s of m.sockets) {
          if (!s.comp) continue;
          const p = Machine.socketPos(m, s);
          const dd = Math.hypot(p.x - this.hx, p.y - this.hy);
          if (dd < bd) { bd = dd; best = s; }
        }
        if (best && bd < this.r + 70) {
          best.comp.connectorHp -= DrillRail.DAMAGE * DrillRail.CONN_MUL;
          Effects.comicWord('CHEWED!', m.x, m.y - (m.radius || 60) - 60,
            '#d08a1e', 54);
          if (best.comp.connectorHp <= 0) Machine.breakConnector(m, best);
          chewed = true;
        }
      }
      if (!chewed) {
        if (m.lastCause !== undefined) m.lastCause = 'hazard';
        if (m.takeCoreDamage) {
          m.takeCoreDamage(DrillRail.DAMAGE, m.x, m.y, false, 'hazard');
        } else if (m.hit) m.hit(DrillRail.DAMAGE, m.x, m.y);
      }
      const push = Math.hypot(m.x - this.hx, m.y - this.hy) || 1;
      m.vx = (m.vx || 0) + (m.x - this.hx) / push * 700;
      m.vy = (m.vy || 0) + (m.y - this.hy) / push * 700;
      Camera.shake(5, 0.15);
    };
    bite(player);
    for (const e of enemies) bite(e);   // §26B: hazards damage enemies too
  }

  draw(ctx) {
    // the rail itself
    ctx.save();
    ctx.strokeStyle = '#2a2622';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(this.x0, this.y0);
    ctx.lineTo(this.axis === 'x' ? this.x0 + this.travel : this.x0,
               this.axis === 'y' ? this.y0 + this.travel : this.y0);
    ctx.stroke();
    ctx.strokeStyle = '#4a4438';
    ctx.lineWidth = 8;
    ctx.setLineDash([30, 26]);
    ctx.beginPath();
    ctx.moveTo(this.x0, this.y0);
    ctx.lineTo(this.axis === 'x' ? this.x0 + this.travel : this.x0,
               this.axis === 'y' ? this.y0 + this.travel : this.y0);
    ctx.stroke();
    ctx.setLineDash([]);
    // the head: Aaron's drill, still spinning; the tri-bit cone as fallback
    if (typeof Assets !== 'undefined' &&
        Assets.sprite(ctx, 'prop_drillHead', this.hx, this.hy,
          this.r * 2.4, this.r * 2.4, this.spin * 0.5)) {
      ctx.restore();
      return;
    }
    ctx.translate(this.hx, this.hy);
    ctx.fillStyle = '#6e4d20';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.rotate(this.spin);
    ctx.fillStyle = '#d08a1e';
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.moveTo(this.r * 0.2, 0);
      ctx.lineTo(this.r * 0.95, -this.r * 0.3);
      ctx.lineTo(this.r * 0.95, this.r * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// MOLTEN LANE (Map 7+, Master §26B — Furnace Mile): "10 DPS +8 Heat/s while
// occupied". A river of the stuff the mile is named for. No warning and no
// cycle — it is always lava — so the read is the glow, and the counter-play
// is simply not standing in it. Burns BOTH sides; damage lands in chunks
// through the saw path so the numbers stay readable.
class MoltenLane {
  static DPS = 10;                  // §26B locked
  static HEAT_PS = 8;               // §26B locked

  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.t = Math.random() * 10;
    this._acc = new Map();          // per-machine damage accumulator
  }

  contains(m) {
    const r = (m.radius || 0) * 0.5;   // waded in, not just touching the edge
    return m.x + r > this.x && m.x - r < this.x + this.w &&
           m.y + r > this.y && m.y - r < this.y + this.h;
  }

  update(dt, player, enemies) {
    this.t += dt;
    // BLOCK 14. A LANE THAT HAS GONE COLD. Set by BossPhases when a heat vent
    // comes off the Crucible: the vent was cooking this lane, so with the vent
    // gone the lane is a floor again. It still DRAWS, dark and setting, because
    // the arena changing is the point and a lane that vanished would read as a
    // bug rather than as a safe approach opening.
    if (this.cold) return;
    const burn = (m) => {
      if (!m || m.alive === false || !this.contains(m)) return;
      // HEAT RESIST: the Ironworks' own machines wade the pour.
      let acc = (this._acc.get(m) || 0) + MoltenLane.DPS * dt * (1 - (m.heatResist || 0));
      if (acc >= 4) {
        if (m.lastCause !== undefined) m.lastCause = 'hazard';
        if (m.takeCoreDamage) m.takeCoreDamage(acc, m.x, m.y, true, 'hazard');
        else if (m.hit) m.hit(acc, m.x, m.y, true);
        acc = 0;
      }
      this._acc.set(m, acc);
      if (m.isPlayer && typeof Machine !== 'undefined') {
        Machine.addHeat(m, MoltenLane.HEAT_PS * dt);
      }
      if (Math.random() < dt * 8) {
        Effects.spark(m.x, m.y + (m.radius || 40) * 0.4,
          -Math.PI / 2, 1, '#ff7a1a', 200);
      }
    };
    burn(player);
    for (const e of enemies) burn(e);   // §26B: hazards damage enemies too
  }

  draw(ctx) {
    ctx.save();
    // A COLD LANE: the same shape, set and grey, so you can see where the heat
    // used to be and know it is walkable now.
    if (this.cold) {
      ctx.fillStyle = '#2b2723';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeStyle = '#4a423a';
      ctx.lineWidth = 6;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
      ctx.restore();
      return;
    }
    // the melt: layered hot bands that slowly crawl
    // Aaron's pour spout feeds the lane from its head end (the short edge).
    if (typeof Assets !== 'undefined') {
      const horiz = this.w >= this.h;
      Assets.sprite(ctx, 'prop_pourSpout',
        horiz ? this.x : this.x + this.w / 2,
        horiz ? this.y + this.h / 2 : this.y,
        200, 200, horiz ? Math.PI / 2 : 0);
    }
    const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
    grad.addColorStop(0, '#7a2408');
    grad.addColorStop(0.5, '#b0400e');
    grad.addColorStop(1, '#7a2408');
    ctx.fillStyle = grad;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 8;
    ctx.strokeRect(this.x, this.y, this.w, this.h);
    // drifting hot cells
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.w, this.h);
    ctx.clip();
    const drift = (this.t * 30);
    for (let i = 0; i < Math.max(3, (this.w * this.h) / 120000); i++) {
      const px = this.x + ((i * 397 + drift) % this.w);
      const py = this.y + ((i * 251 + drift * 0.6) % this.h);
      const glow = 0.5 + 0.5 * Math.sin(this.t * 3 + i * 1.7);
      ctx.fillStyle = 'rgba(255,' + Math.floor(120 + glow * 90) + ',30,' +
        (0.35 + glow * 0.3) + ')';
      ctx.beginPath();
      ctx.arc(px, py, 26 + glow * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// PROTOTYPE PULSE (Map 8+, Master §26B — Proving Ground): "1.0s warning ->
// one random powered module forced offline for 1.0s; no damage". The test
// facility stress-tests whatever drives across its pads — through the SAME
// _forcedOffT pipe the Capacitor, Dynamo and Bailiff use, so recalcPower
// sees it without a new mechanism. It tests BOTH sides: force an enemy
// Reactor offline and its guns go dark for the second.
class PrototypePulse {
  static WARN = 1.0;                // §26B locked
  static OFF_TIME = 1.0;            // §26B locked
  static RADIUS = 260;              // pad size (tune)
  static CYCLE = 6;                 // seconds between tests (tune)

  constructor(x, y, phase = 0) {
    this.x = x; this.y = y;
    this.t = phase * PrototypePulse.CYCLE;
    this.warnT = -1;                // >= 0 while the warning runs
  }

  update(dt, player, enemies) {
    if (this.warnT >= 0) {
      this.warnT += dt;
      if (this.warnT >= PrototypePulse.WARN) {
        this.warnT = -1;
        this.t = 0;
        this._pulse(player, enemies);
      }
      return;
    }
    this.t += dt;
    if (this.t >= PrototypePulse.CYCLE) this.warnT = 0;
  }

  _pulse(player, enemies) {
    Effects.ring(this.x, this.y, PrototypePulse.RADIUS, '#22d9ff');
    const test = (m) => {
      if (!m || m.alive === false || !m.sockets) return;
      if (Math.hypot(m.x - this.x, m.y - this.y) >
          PrototypePulse.RADIUS + (m.radius || 0)) return;
      const powered = m.sockets.filter(s => s.comp && s.comp.online &&
        typeof Machine !== 'undefined' &&
        Machine.powerCostOf(m, s.comp) > 0);
      if (!powered.length) return;
      const pick = powered[Math.floor(Math.random() * powered.length)];
      pick.comp._forcedOffT = PrototypePulse.OFF_TIME;
      Machine.recalcPower(m);
      const p = Machine.socketPos(m, pick);
      Effects.bolt(this.x, this.y, p.x, p.y, '#22d9ff');
      Effects.comicWord('TEST!', p.x, p.y - 70, '#22d9ff', 48);
    };
    test(player);
    for (const e of enemies) test(e);   // the facility tests everything
  }

  draw(ctx) {
    ctx.save();
    // the pad: an inlaid test circle, always visible
    ctx.beginPath();
    ctx.arc(this.x, this.y, PrototypePulse.RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34,217,255,0.35)';
    ctx.lineWidth = 4;
    ctx.setLineDash([22, 16]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (this.warnT >= 0) {
      const k = this.warnT / PrototypePulse.WARN;
      ctx.fillStyle = 'rgba(34,217,255,' + (0.05 + 0.12 * k) + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x, this.y, PrototypePulse.RADIUS * (1 - k), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(34,217,255,0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // centre emitter
    ctx.fillStyle = this.warnT >= 0 ? '#7febff' : '#1a3a4a';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 26, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// SECURITY BEAM (Map 9+, Master §26B — Crown Gate): "0.8s warning -> 20
// damage". Crown's own security lines: they cross doorways and lanes on a
// cycle, and they do not care whose machine is in the doorway. Its own §26B
// row — NOT the Proving Ground's Test Laser (0.75/18) — so its own class.
class SecurityBeam {
  static WARN = 0.8;                // §26B locked
  static DAMAGE = 20;               // §26B locked
  static IDLE = 3.2;                // between firings (tune)
  static FIRE = 0.4;                // beam-on time (tune)
  static WIDTH = 30;                // half-width (tune)

  constructor(x, y, angle, length, phase = 0) {
    this.x = x; this.y = y; this.angle = angle; this.length = length;
    this.t = phase * this.cycle;
    this._hit = new Set();
  }

  get cycle() { return SecurityBeam.IDLE + SecurityBeam.WARN + SecurityBeam.FIRE; }
  get state() {
    const k = this.t % this.cycle;
    if (k < SecurityBeam.IDLE) return 'idle';
    if (k < SecurityBeam.IDLE + SecurityBeam.WARN) return 'warn';
    return 'fire';
  }

  _onLine(m) {
    const ax = Math.cos(this.angle), ay = Math.sin(this.angle);
    const bx = m.x - this.x, by = m.y - this.y;
    const along = bx * ax + by * ay;
    if (along < 0 || along > this.length) return false;
    return Math.abs(-bx * ay + by * ax) < SecurityBeam.WIDTH + (m.radius || 0);
  }

  update(dt, player, enemies) {
    const wasFire = this.state === 'fire';
    this.t += dt;
    if (this.state !== 'fire') {
      if (wasFire) this._hit.clear();     // rearm for the next firing
      return;
    }
    const zap = (m) => {
      if (!m || m.alive === false || this._hit.has(m)) return;
      if (!this._onLine(m)) return;
      this._hit.add(m);                   // once per firing per machine
      if (m.lastCause !== undefined) m.lastCause = 'hazard';
      if (m.takeCoreDamage) {
        m.takeCoreDamage(SecurityBeam.DAMAGE, m.x, m.y, false, 'hazard');
      } else if (m.hit) m.hit(SecurityBeam.DAMAGE, m.x, m.y);
      Effects.spark(m.x, m.y, this.angle + Math.PI / 2, 4, '#ff3b5a', 380);
    };
    zap(player);
    for (const e of enemies) zap(e);      // §26B: hazards damage enemies too
  }

  _drawEmitters(ctx) {
    // Aaron's shield-line gear at both ends; the vector post is the fallback.
    for (const t of [0, 1]) {
      const px = this.x + Math.cos(this.angle) * this.length * t;
      const py = this.y + Math.sin(this.angle) * this.length * t;
      if (typeof Assets !== 'undefined' &&
          Assets.sprite(ctx, 'prop_shieldLine', px, py, 120, 120,
            this.angle + (t ? Math.PI : 0))) continue;
      ctx.fillStyle = '#2a3348';
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(px, py, 26, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  draw(ctx) {
    const st = this.state;
    if (st === 'idle') {
      // emitters only — the line is a threat you remember, not see
      this._drawEmitters(ctx);
      return;
    }
    this._drawEmitters(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (st === 'warn') {
      const k = (this.t % this.cycle - SecurityBeam.IDLE) / SecurityBeam.WARN;
      ctx.fillStyle = 'rgba(255,59,90,' + (0.10 + 0.18 * k) + ')';
      ctx.fillRect(0, -SecurityBeam.WIDTH, this.length, SecurityBeam.WIDTH * 2);
      ctx.setLineDash([20, 14]);
      ctx.strokeStyle = 'rgba(255,59,90,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(this.length, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = 'rgba(255,59,90,0.85)';
      ctx.fillRect(0, -SecurityBeam.WIDTH * 0.5, this.length, SecurityBeam.WIDTH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -4, this.length, 8);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// LOCK ZONE (Map 9+, Master §26B — Crown Gate): "2.5s field, movement -25%;
// no direct damage". Crown security cycling a compliance field over its
// chokepoints: while it holds, everything inside — the player through the
// player slow pipe, machines through the enemy one — moves at 75%. Getting
// caught in one under fire is the punishment; it never draws blood itself.
class LockZone {
  static FIELD = 2.5;               // §26B locked: field duration
  static SLOW = 0.75;               // §26B locked: movement -25%
  static IDLE = 4;                  // between fields (tune)

  constructor(x, y, r, phase = 0) {
    this.x = x; this.y = y; this.r = r;
    this.t = phase * (LockZone.IDLE + LockZone.FIELD);
  }

  get active() {
    return (this.t % (LockZone.IDLE + LockZone.FIELD)) >= LockZone.IDLE;
  }

  update(dt, player, enemies) {
    this.t += dt;
    if (!this.active) return;
    const grip = (m, isPlayer) => {
      if (!m || m.alive === false) return;
      if (Math.hypot(m.x - this.x, m.y - this.y) > this.r + (m.radius || 0)) return;
      if (isPlayer) {
        m._fieldSlowT = 0.15;
        m._fieldSlowMul = LockZone.SLOW;
      } else {
        m._slowFieldT = 0.15;
        m._slowFieldMul = LockZone.SLOW;
      }
    };
    grip(player, true);
    for (const e of enemies) grip(e, false);
  }

  draw(ctx) {
    if (typeof Assets !== 'undefined') {
      Assets.sprite(ctx, 'prop_lockdownGear', this.x, this.y, 140, 140, 0);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    if (this.active) {
      ctx.fillStyle = 'rgba(64,120,255,0.10)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(64,120,255,0.85)';
      ctx.lineWidth = 5;
      ctx.stroke();
      // rotating clamp arcs — the read is "held"
      const a = performance.now() / 400;
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 7;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r * 0.82, a + i * 2.1, a + i * 2.1 + 0.9);
        ctx.stroke();
      }
    } else {
      ctx.setLineDash([16, 18]);
      ctx.strokeStyle = 'rgba(64,120,255,0.30)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// PURGE PULSE (Map 10, Master §26B — Crown Forge): "1.0s warning -> 24
// damage +15 Heat in marked sector". The Forge cleans itself: a wedge of
// the floor is marked, then purged. A SECTOR, not a circle — the §26B
// distinction that makes it dodgeable sideways.
class PurgePulse {
  static WARN = 1.0;                // §26B locked
  static DAMAGE = 24;               // §26B locked
  static HEAT = 15;                 // §26B locked
  static RADIUS = 900;              // sector reach (tune)
  static ARC = 1.1;                 // sector width, radians (tune)
  static CYCLE = 6.5;               // between purges (tune)

  constructor(x, y, phase = 0) {
    this.x = x; this.y = y;
    this.t = phase * PurgePulse.CYCLE;
    this.mark = null;               // { angle, t }
  }

  _inSector(m, angle) {
    const d = Math.hypot(m.x - this.x, m.y - this.y);
    if (d > PurgePulse.RADIUS + (m.radius || 0) || d < 40) return false;
    let a = Math.atan2(m.y - this.y, m.x - this.x) - angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return Math.abs(a) < PurgePulse.ARC / 2;
  }

  update(dt, player, enemies) {
    if (this.mark) {
      this.mark.t += dt;
      if (this.mark.t >= PurgePulse.WARN) {
        this._purge(this.mark.angle, player, enemies);
        this.mark = null;
        this.t = 0;
      }
      return;
    }
    this.t += dt;
    if (this.t < PurgePulse.CYCLE) return;
    // Half the purges sweep toward whoever is on the floor. (tune)
    let angle = Math.random() * Math.PI * 2;
    if (player && player.alive && Math.random() < 0.5 &&
        Math.hypot(player.x - this.x, player.y - this.y) < PurgePulse.RADIUS) {
      angle = Math.atan2(player.y - this.y, player.x - this.x);
    }
    this.mark = { angle, t: 0 };
    if (typeof Audio_ !== 'undefined') Audio_.play('bossWarn', { gain: 0.25 });
  }

  _purge(angle, player, enemies) {
    Camera.shake(9, 0.3);
    Effects.ring(this.x, this.y, PurgePulse.RADIUS * 0.5, '#ffd23f');
    const purge = (m) => {
      if (!m || m.alive === false || !this._inSector(m, angle)) return;
      if (m.lastCause !== undefined) m.lastCause = 'hazard';
      if (m.takeCoreDamage) {
        m.takeCoreDamage(PurgePulse.DAMAGE, m.x, m.y, false, 'hazard');
      } else if (m.hit) m.hit(PurgePulse.DAMAGE, m.x, m.y);
      if (m.isPlayer && typeof Machine !== 'undefined') {
        Machine.addHeat(m, PurgePulse.HEAT);
      }
      Effects.spark(m.x, m.y, angle, 5, '#ffd23f', 420);
    };
    purge(player);
    for (const e of enemies) purge(e);   // §26B: hazards damage enemies too
  }

  draw(ctx) {
    if (!this.mark) return;
    const k = this.mark.t / PurgePulse.WARN;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.mark.angle);
    ctx.fillStyle = 'rgba(255,210,63,' + (0.08 + 0.16 * k) + ')';
    ctx.strokeStyle = 'rgba(255,210,63,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, PurgePulse.RADIUS, -PurgePulse.ARC / 2, PurgePulse.ARC / 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // the closing edge — the §26B warning, sweeping shut
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, PurgePulse.RADIUS * (1 - k * 0.9),
      -PurgePulse.ARC / 2, PurgePulse.ARC / 2);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// ASSEMBLY RAIL (Map 10, Master §26B — Crown Forge): "moving machinery
// sweep, 25 collision damage". The Forge's own production line, still
// running mid-battle. Its own §26B row — gentler shove than the Freight
// Spine's cargo (which is DEFINED by its strong knockback), same 25.
class AssemblyRail {
  static DAMAGE = 25;               // §26B locked
  static KNOCK = 700;               // a shove, not a launch (tune)
  static SPEED = 380;               // sweep speed (tune)

  constructor(x, y, w, h, axis, travel, phase = 0) {
    this.x0 = x; this.y0 = y; this.w = w; this.h = h;
    this.axis = axis; this.travel = travel;
    this.t = phase * (travel / AssemblyRail.SPEED) * 2;
    this._hitCd = new Map();
  }

  get offset() {
    const period = (this.travel / AssemblyRail.SPEED) * 2;
    const k = (this.t % period) / period;
    return (k < 0.5 ? k * 2 : 2 - k * 2) * this.travel;
  }
  get x() { return this.axis === 'x' ? this.x0 + this.offset : this.x0; }
  get y() { return this.axis === 'y' ? this.y0 + this.offset : this.y0; }
  get dir() {
    const period = (this.travel / AssemblyRail.SPEED) * 2;
    return ((this.t % period) / period) < 0.5 ? 1 : -1;
  }

  update(dt, player, enemies) {
    this.t += dt;
    const sweep = (m) => {
      if (!m || m.alive === false) return;
      const r = m.radius || 0;
      if (m.x + r < this.x || m.x - r > this.x + this.w ||
          m.y + r < this.y || m.y - r > this.y + this.h) return;
      const last = this._hitCd.get(m) || -9;
      if (this.t - last < 0.8) return;
      this._hitCd.set(m, this.t);
      if (m.lastCause !== undefined) m.lastCause = 'hazard';
      if (m.takeCoreDamage) {
        m.takeCoreDamage(AssemblyRail.DAMAGE, m.x, m.y, false, 'hazard');
      } else if (m.hit) m.hit(AssemblyRail.DAMAGE, m.x, m.y);
      const kx = this.axis === 'x' ? this.dir : 0;
      const ky = this.axis === 'y' ? this.dir : 0;
      const kbm = m.knockbackMul !== undefined ? m.knockbackMul : 1;
      m.vx = (m.vx || 0) + kx * AssemblyRail.KNOCK * kbm;
      m.vy = (m.vy || 0) + ky * AssemblyRail.KNOCK * kbm;
      Camera.shake(5, 0.15);
    };
    sweep(player);
    for (const e of enemies) sweep(e);   // §26B: hazards damage enemies too
  }

  draw(ctx) {
    const x = this.x, y = this.y;
    const art = typeof Assets !== 'undefined' && Assets.sprite(ctx,
      'prop_asmRail', x + this.w / 2, y + this.h / 2,
      Math.max(this.w, this.h), Math.max(this.w, this.h),
      this.axis === 'y' ? Math.PI / 2 : 0);
    if (art) {
      // the gold lead edge stays ON TOP — the telegraph outlives the art
      ctx.fillStyle = '#ffd23f';
      const lead2 = this.axis === 'x'
        ? (this.dir > 0 ? x + this.w - 22 : x)
        : (this.dir > 0 ? y + this.h - 22 : y);
      if (this.axis === 'x') ctx.fillRect(lead2, y + 6, 22, this.h - 12);
      else ctx.fillRect(x + 6, lead2, this.w - 12, 22);
      return;
    }
    // crown-gold machinery block with piston detailing
    ctx.fillStyle = '#4a3d14';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 10;
    ctx.fillRect(x, y, this.w, this.h);
    ctx.strokeRect(x, y, this.w, this.h);
    ctx.fillStyle = '#ffd23f';
    const lead = this.axis === 'x'
      ? (this.dir > 0 ? x + this.w - 22 : x)
      : (this.dir > 0 ? y + this.h - 22 : y);
    if (this.axis === 'x') ctx.fillRect(lead, y + 6, 22, this.h - 12);
    else ctx.fillRect(x + 6, lead, this.w - 12, 22);
    ctx.strokeStyle = '#8a6d1a';
    ctx.lineWidth = 5;
    const cx = x + this.w / 2, cy = y + this.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(this.w, this.h) * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(this.w, this.h) * 0.14, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// FORGE SINGULARITY (Map 10, Master §26B — Crown Forge): "3s pull field at
// 160 u/s; loose salvage pull x2; no direct damage". The Forge's heart
// breathing in. It never hurts anyone directly — it just delivers you to
// the things that will.
class ForgeSingularity {
  static FIELD = 3;                 // §26B locked
  static PULL = 160;                // §26B locked
  static SALVAGE_MUL = 2;           // §26B locked
  static IDLE = 5;                  // between breaths (tune)

  constructor(x, y, r, phase = 0) {
    this.x = x; this.y = y; this.r = r;
    this.t = phase * (ForgeSingularity.IDLE + ForgeSingularity.FIELD);
  }

  get active() {
    return (this.t % (ForgeSingularity.IDLE + ForgeSingularity.FIELD)) >=
      ForgeSingularity.IDLE;
  }

  update(dt, player, enemies) {
    this.t += dt;
    if (!this.active) return;
    const inhale = (m, mul) => {
      if (!m || m.alive === false) return;
      const dx = this.x - m.x, dy = this.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d > this.r || d < 60) return;
      m.x += (dx / d) * ForgeSingularity.PULL * mul * dt;
      m.y += (dy / d) * ForgeSingularity.PULL * mul * dt;
    };
    inhale(player, 1);
    for (const e of enemies) inhale(e, 1);
    if (typeof LooseParts !== 'undefined') {
      for (const it of LooseParts.items) {
        inhale(it, ForgeSingularity.SALVAGE_MUL);   // §26B: salvage x2
      }
    }
    if (typeof Effects !== 'undefined' && Math.random() < dt * 20) {
      const a = Math.random() * Math.PI * 2;
      const rr = this.r * (0.4 + Math.random() * 0.6);
      Effects.spark(this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr,
        a + Math.PI, 1, '#9b5cff', 460);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    if (this.active) {
      const k = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      ctx.fillStyle = 'rgba(155,92,255,' + (0.05 + 0.06 * k) + ')';
      ctx.fill();
      ctx.strokeStyle = 'rgba(155,92,255,0.8)';
      ctx.lineWidth = 5;
      ctx.stroke();
      // collapsing rings — the read is INWARD
      const drift = (performance.now() / 1000 * ForgeSingularity.PULL) % 120;
      for (let i = 0; i < 3; i++) {
        const rr = this.r - ((drift + i * 120) % (this.r * 0.85));
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(40, rr), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.setLineDash([14, 20]);
      ctx.strokeStyle = 'rgba(155,92,255,0.30)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // the eye
    ctx.fillStyle = this.active ? '#c9a4ff' : '#2a1d4a';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 34, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

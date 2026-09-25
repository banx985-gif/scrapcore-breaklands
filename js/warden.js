// SCRAPCORE: BREAKLANDS — WARDEN 1: RECLAIMER (Milestone 1)
// Master v3.2 §26 / §26A.
//
// The Warden is the shape every Campaign map is built around, so M1 builds it
// as a BEHAVIOUR PROTOTYPE rather than a boss with a health bar: it is fought
// on Screen 3, it RETREATS at a threshold instead of dying, it is chased on
// Screen 4, and it is fought properly on Screen 6. If that shape is not more
// interesting than a ZERO zone, the whole ten-map plan is wrong and M1 is
// where we find out — not Map 9.
//
// It wears ordinary components on ordinary sockets, exactly like the Crusher,
// so every rule the player already knows still applies: shoot a connector and
// the Warden permanently loses that weapon and the player can bolt it on.
//
// Art is placeholder. The real Reclaimer is ART v1.3 §8 / Priority A.

// WARDEN_PHASE and WardenBase live in wardens.js (loaded before this file).
// The Reclaimer keeps its own class — M1 proved this exact fight, and
// test_m1 asserts against ReclaimerWarden by name — but the lifecycle it
// proved (retreat at 72%, the damage model, the escape run) is now the
// shared base every Warden inherits.

class ReclaimerWarden extends WardenBase {
  // phase FIRST  = Screen 3. Limited moveset, retreats at the threshold.
  // phase FINAL  = Screen 6. Complete moveset, scarred, fights to the death.
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'RECLAIMER', tuningKey: 'reclaimer', radius: 132, moveSpeed: 240 },
      x, y, phase, startHpFrac);

    // Cooldowns — Master §26A starting values (base ticks the cd map).
    this.cd.sweep = 3.0;             // first sweep lands early, then 7s
    this.cd.throw = 2.0;
    this.cd.charge = 4.0;
    this.cd.claw = 6.0;
    this.cd.rebuild = 10.0;

    this.sweepT = 0;                 // >0 while the magnet field is live
    this.clawT = 0;
    this.clawTarget = null;

    // A salvage machine: magnet hardware, armour, and something to hit with.
    Machine.initSockets(this, 8);
    Machine.attach(this, 'magnetAmplifier', 0);
    Machine.attach(this, 'armourPlate', 2);
    Machine.attach(this, 'heavyArmour', 6);
    Machine.attach(this, 'machineGun', 1);
    Machine.attach(this, 'saw', 7);
    if (phase === WARDEN_PHASE.FINAL) {
      // Scarred, and it has bolted on whatever it collected while it ran.
      Machine.attach(this, 'scattergun', 3);
      Machine.attach(this, 'armourPlate', 5);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  // ---- behaviour (base owns the frame plumbing) ----------------------------
  _brain(dt, player, arena, obstacles, c) {
    const { d, ux, uy, speed, final } = c;

    // MAGNET SWEEP runs as a field on top of whatever else it is doing.
    if (this.sweepT > 0) this._tickSweep(dt, player);

    switch (this.state) {
      case 'stalk': {
        const want = 560;
        const radial = (d - want) / want;
        this._steer(dt, ux * radial * 1.4 + (-uy) * 0.75,
                        uy * radial * 1.4 + ux * 0.75, speed * 0.9);
        this.firingNow = d < 1000;
        // Pick an action the moment one is off cooldown.
        if (this.cd.sweep <= 0 && d < 560) { this._enter('sweepWind'); break; }
        if (this.cd.charge <= 0 && d > 380) { this._enter('chargeWind'); break; }
        if (this.cd.throw <= 0) { this._throwScrap(player); this.cd.throw = 4.5; }
        if (final && this.cd.claw <= 0 && d < 260) { this._enter('claw'); break; }
        if (final && this.cd.rebuild <= 0) { this._salvageRebuild(); }
        break;
      }

      // ---- MAGNET SWEEP: 0.85s telegraph, then a 2.0s field, radius 520 ----
      case 'sweepWind': {
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        if (this.stateT > 0.85) {
          this.sweepT = 2.0;
          this.cd.sweep = 7.0;
          Effects.ring(this.x, this.y, WARDEN_TUNING.reclaimer.sweepRadius, '#22d9ff');
          Camera.shake(6, 0.25);
          if (typeof Audio_ !== 'undefined') Audio_.play('bossWarn', { gain: 0.3 });
          this._enter('stalk');
        }
        break;
      }

      // ---- COMPACT CHARGE: 0.7s line telegraph, then 700 u/s -------------
      case 'chargeWind': {
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        this.chargeX = ux; this.chargeY = uy;
        if (this.stateT > 0.7) {
          this._enter('charge');
          Effects.comicWord('COMPACT!', this.x, this.y - this.radius - 80, '#ff7a1a');
          Camera.shake(5, 0.2);
        }
        break;
      }
      case 'charge': {
        const k = 1 - Math.exp(-8 * dt);
        const cs = WARDEN_TUNING.reclaimer.chargeSpeed;
        this.vx += (this.chargeX * cs - this.vx) * k;
        this.vy += (this.chargeY * cs - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.firingNow = false;
        if (this.hitCd <= 0 && d < this.radius + player.radius + 16 && player.alive) {
          this.hitCd = 0.8;
          player.takeCoreDamage(WARDEN_TUNING.reclaimer.chargeDamage,
            player.x, player.y);
          const kb = 1200 * (player.knockbackMul !== undefined ? player.knockbackMul : (player.recoilMul || 1));
          player.vx += ux * kb; player.vy += uy * kb;
          Effects.comicWord('CRUNCH!', player.x, player.y - 130);
          Camera.shake(10, 0.28);
        }
        if (this.stateT > 1.1) { this.cd.charge = 6.0; this._enter('recover'); }
        break;
      }

      // ---- STRIP CLAW (final only): 1.0s channel on a live connector ------
      case 'claw': {
        this._steer(dt, ux * 0.4, uy * 0.4, speed * 0.35);
        this.firingNow = false;
        if (this.stateT === 0 || !this.clawTarget) {
          this.clawTarget = this._weakestConnector(player);
        }
        if (d > 320 || !this.clawTarget) { this.cd.claw = 4.0; this._enter('stalk'); break; }
        this.clawT = this.stateT;
        if (this.stateT > 1.0) {
          const s = this.clawTarget;
          if (s && s.comp) {
            s.comp.connectorHp -= WARDEN_TUNING.reclaimer.clawConnectorDamage;
            Effects.spark(player.x, player.y, 0, 10, '#ff3fa4', 320);
            Effects.comicWord('STRIP!', player.x, player.y - 150, CONFIG.COLOR.magenta);
            if (s.comp.connectorHp <= 0) Machine.breakConnector(player, s);
          }
          this.clawTarget = null;
          this.cd.claw = 8.0;
          this._enter('recover');
        }
        break;
      }

      default: {   // recover — the punish window
        const brake = Math.exp(-4.5 * dt);
        this.vx *= brake; this.vy *= brake;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.firingNow = false;
        if (Math.random() < dt * 12) {
          Effects.spark(this.x + (Math.random() - 0.5) * this.radius,
            this.y + (Math.random() - 0.5) * this.radius,
            -Math.PI / 2, 1, '#8fa3c8', 200);
        }
        if (this.stateT > 1.4) this._enter('stalk');
        break;
      }
    }

  }

  // Master §26A: pulls the player at 220 u/s and loose salvage at 700 u/s.
  _tickSweep(dt, player) {
    this.sweepT -= dt;
    const R_ = WARDEN_TUNING.reclaimer.sweepRadius;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < R_ && player.alive) {
      player.x -= (dx / d) * WARDEN_TUNING.reclaimer.sweepPullPlayer * dt;
      player.y -= (dy / d) * WARDEN_TUNING.reclaimer.sweepPullPlayer * dt;
    }
    for (const it of (LooseParts.items || [])) {
      const lx = this.x - it.x, ly = this.y - it.y;
      const ld = Math.hypot(lx, ly) || 1;
      if (ld > R_) continue;
      it.x += (lx / ld) * WARDEN_TUNING.reclaimer.sweepPullSalvage * dt;
      it.y += (ly / ld) * WARDEN_TUNING.reclaimer.sweepPullSalvage * dt;
    }
    if (Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2;
      Effects.spark(this.x + Math.cos(a) * R_ * 0.9,
        this.y + Math.sin(a) * R_ * 0.9, a + Math.PI, 1, '#22d9ff', 420);
    }
  }

  // Master §26A: launches the nearest loose part at 850 u/s for 20 damage.
  // It picks real salvage up off the floor and throws it, so the floor state
  // genuinely matters — clearing salvage denies it ammunition.
  _throwScrap(player) {
    const near = LooseParts.nearest ? LooseParts.nearest(this.x, this.y, 900) : null;
    if (!near) return;
    const dx = player.x - this.x, dy = player.y - this.y;
    const angle = Math.atan2(dy, dx);
    LooseParts.remove(near);
    // Projectiles are spawned FROM A PART, so the shell borrows the Cannon's
    // shape and the multiplier is derived from the §26A damage figure. Derived,
    // not hard-coded, so retuning the Cannon cannot silently retune the Warden.
    const base = PARTS.cannon.damage * 0.75;          // enemy shots are x0.75
    const mul = WARDEN_TUNING.reclaimer.throwDamage / base;
    Projectiles.spawn(this.x, this.y, angle, PARTS.cannon, 'enemy', mul);
    Effects.comicWord('SCRAP THROW!', this.x, this.y - this.radius - 60,
      CONFIG.COLOR.steel, 52);
  }

  // Master §26A: pulls a legal loose module and bolts it on at max 50% HP.
  _salvageRebuild() {
    this.cd.rebuild = 12.0;
    const free = this.sockets.find(s => !s.comp);
    if (!free) return;
    const near = LooseParts.nearest ? LooseParts.nearest(this.x, this.y, 1200) : null;
    if (!near) return;
    LooseParts.remove(near);
    const idx = Machine.attach(this, near.part.id, free.id);
    if (idx >= 0) {
      const s = Machine.getSocket(this, idx);
      if (s && s.comp) s.comp.hp = s.comp.maxHp * 0.5;
      Effects.comicWord('REBUILD!', this.x, this.y - this.radius - 60, '#a8e832', 52);
    }
  }

  _weakestConnector(player) {
    let best = null;
    for (const s of player.sockets) {
      if (!s.comp) continue;
      if (!best || s.comp.connectorHp < best.comp.connectorHp) best = s;
    }
    return best;
  }

  // ---- draw (placeholder art: ART v1.3 §8 owns the real Reclaimer) --------
  draw(ctx) {
    if (!this.alive && !this.retreating) return;
    const wind = this.state === 'sweepWind' || this.state === 'chargeWind';
    const blink = wind && Math.sin(performance.now() / 50) > 0;
    const a = Math.atan2(this.aimY, this.aimX);

    // Live magnet field, drawn in the world so it reads as a real hazard.
    if (this.sweepT > 0) {
      const R_ = WARDEN_TUNING.reclaimer.sweepRadius;
      const pulse = 0.5 + 0.5 * Math.sin(this.coilT * 10);
      R.circle(this.x, this.y, R_, 'rgba(34,217,255,0.10)');
      R.circle(this.x, this.y, R_ * (0.55 + 0.45 * pulse), null, '#22d9ff', 5);
    }
    if (this.state === 'chargeWind') {
      const len = 1300;
      R.rect(this.x, this.y - 12, len, 24, 'rgba(255,122,26,0.25)');
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.chargeY || this.aimY, this.chargeX || this.aimX));
      ctx.fillStyle = 'rgba(255,122,26,0.28)';
      ctx.fillRect(0, -26, len, 52);
      ctx.restore();
    }

    R.circle(this.x, this.y, this.radius + 26, 'rgba(34,217,255,0.14)');
    R.circle(this.x + 12, this.y + 16, this.radius, 'rgba(0,0,0,0.5)');

    // Magnet claw arms — the silhouette cue. They close during a charge.
    const gape = this.state === 'charge' ? 0.10
      : (wind ? 0.62 + Math.sin(this.stateT * 16) * 0.07 : 0.40);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * gape);
      ctx.fillStyle = this.flash > 0 || blink ? '#ffffff' : '#1d5f7a';
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(this.radius * 0.2, side * 22);
      ctx.lineTo(this.radius * 1.42, side * 52);
      ctx.lineTo(this.radius * 1.55, side * 10);
      ctx.lineTo(this.radius * 0.24, side * 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // coil banding
      ctx.fillStyle = this.sweepT > 0 ? '#22d9ff' : '#0f3b4d';
      for (let i = 0; i < 3; i++) {
        const t = this.radius * (0.55 + i * 0.3);
        ctx.fillRect(t, side * 12, 22, side * 26);
      }
      ctx.restore();
    }
    ctx.restore();

    const body = this.flash > 0 || blink ? '#ffffff' : '#123c4d';
    R.circle(this.x, this.y, this.radius, body, CONFIG.COLOR.ink, 12);
    R.circle(this.x, this.y, this.radius * 0.66, this.flash > 0 ? '#ffffff' : '#1d5f7a',
      CONFIG.COLOR.ink, 8);
    // Core coil: brightens with the magnet, so the tell is on the body too.
    const coil = this.sweepT > 0
      ? '#7febff'
      : (0.5 + 0.5 * Math.sin(this.coilT * 3) > 0.5 ? '#22d9ff' : '#1897b8');
    R.circle(this.x, this.y, this.radius * 0.28, coil, CONFIG.COLOR.ink, 6);

    if (this.state === 'claw' && this.clawTarget) {
      const p = Machine._xpPlayer;
      if (p) Effects.bolt(this.x, this.y, p.x, p.y, CONFIG.COLOR.magenta);
    }

    Machine.draw(ctx, this);
  }
}

Wardens.register('RECLAIMER', ReclaimerWarden);

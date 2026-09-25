// SCRAPCORE: BREAKLANDS — FINAL BOSS: FOREMAN (Milestone 19, plan §48)
// Foreman is the signature fight because it plays the ENTIRE GAME back at you:
// it magnets loose parts off the floor, bolts them on, replaces what you shoot
// off, and will steal the component you were reaching for. It is the final
// exam for the whole salvage system rather than a bespoke scripted set piece.
//
// Its size comes from ordinary parts mounted around a modest Core (plan §48),
// so no giant unique art is required and everything on it is stealable.

class ForemanBoss {
  constructor(x, y) {
    this.isBoss = true;
    this.bossName = 'FOREMAN';
    this.aiType = 'boss';
    this.coreKey = 'foreman';

    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = 118;
    this.maxHp = ForemanBoss.MAX_HP;
    this.hp = this.maxHp;
    this.alive = true;
    this.flash = 0;
    this.aimX = 0; this.aimY = 1;
    this.sinceDamage = 999;
    this.moveSpeed = 285;
    this.braceMul = 0.35;
    this.extraSpread = 0.05;

    this.phase = 1;
    this.state = 'fight';
    this.stateT = 0;
    this.firingNow = false;

    // Rival salvager state (plan §48)
    this.salvageTarget = null;
    this.salvageT = 0;
    this.magnetRange = 1100;
    this.grabDist = 300;
    this.pullTime = 0.9;
    this.salvageCd = 2.5;

    this.ring = 0;              // phase-change flourish

    // Plan §48 starting loadout, declared as data on the class so the boss
    // intro's scan readout can report what it ACTUALLY carries rather than a
    // second copy of the list that silently rots when this one changes.
    Machine.initSockets(this, 8);
    for (const [id, socket] of ForemanBoss.LOADOUT) Machine.attach(this, id, socket);
  }

  // ---- shared damage model -------------------------------------------------
  takeCoreDamage(dmg, hx, hy, isSaw) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.09;
    this.sinceDamage = 0;
    if (isSaw) {
      this._sawAcc = (this._sawAcc || 0) + dmg;
      if (this._sawAcc >= 12) {
        Effects.damageNumber(hx, hy - this.radius * 0.5, this._sawAcc);
        this._sawAcc = 0;
      }
    } else {
      Effects.damageNumber(hx, hy - this.radius * 0.5, dmg);
      Effects.spark(hx, hy, Math.atan2(hy - this.y, hx - this.x), 4, '#ffd23f');
    }
    this._checkPhase();
    if (this.hp <= 0) this._die();
  }

  hit(dmg, hx, hy, isSaw) { this.takeCoreDamage(dmg, hx, hy, isSaw); }

  // Phases are not transformations — the machine changes by SALVAGING harder
  // (plan §48: "no giant cutscene transformation is required").
  _checkPhase() {
    const frac = this.hp / this.maxHp;
    if (this.phase === 1 && frac <= 0.65) {
      this.phase = 2;
      this.magnetRange = 1500;
      this.pullTime = 0.65;
      this.salvageCd = 1.4;
      this.moveSpeed = 315;
      this._announce('RETURN ALL STOLEN COMPONENTS');
    } else if (this.phase === 2 && frac <= 0.30) {
      this.phase = 3;
      this.magnetRange = 1900;
      this.pullTime = 0.45;
      this.salvageCd = 0.7;
      this.moveSpeed = 350;
      this._announce('YOU WERE BUILT TO RECOVER THE LINE');
    }
  }

  _announce(text) {
    Effects.comicWord(text, this.x, this.y - this.radius - 110, CONFIG.COLOR.cyan);
    Effects.ring(this.x, this.y, 260, CONFIG.COLOR.cyan);
    Camera.shake(9, 0.35);
    this.ring = 0.8;
  }

  _die() {
    this.alive = false;
    for (const s of this.sockets) {
      if (!s.comp) continue;
      const p = Machine.socketPos(this, s);
      LooseParts.spawn(s.comp.part.id, s.comp.hp / s.comp.maxHp,
        p.x, p.y, Math.cos(s.angle) * 500, Math.sin(s.angle) * 500);
    }
    Machine.clearAll(this);
    Effects.hitStop(0.7, 0.25);     // the final kill gets the longest hold
    Effects.explosion(this.x, this.y, 420);
    Effects.ring(this.x, this.y, 380, CONFIG.COLOR.cyan);
    Effects.comicWord('FOREMAN OFFLINE', this.x, this.y - 200, CONFIG.COLOR.cyan);
    Camera.shake(18, 0.8);
    if (typeof buzz === 'function') buzz([80, 60, 140]);
  }

  // ---- the rival salvager behaviour ---------------------------------------
  _wantsParts() {
    return this.sockets.some(s => !s.comp) &&
      this.moduleCount < (this.maxModules || Machine.MAX_MODULES);
  }

  _updateSalvage(dt, player) {
    this.salvageCdT = Math.max(0, (this.salvageCdT || 0) - dt);

    // Drop a target that was taken, vanished, or drifted out of range.
    if (this.salvageTarget &&
        (!LooseParts.items.includes(this.salvageTarget) ||
         Math.hypot(this.salvageTarget.x - this.x, this.salvageTarget.y - this.y)
           > this.magnetRange * 1.25)) {
      this.salvageTarget = null;
      this.salvageT = 0;
    }

    if (!this.salvageTarget && this._wantsParts() && this.salvageCdT <= 0) {
      // Deliberately contest the player: from phase 2 it prefers the part the
      // PLAYER is closest to, and from phase 3 it prefers the best weapon.
      let best = null, bestScore = -Infinity;
      for (const it of LooseParts.items) {
        const d = Math.hypot(it.x - this.x, it.y - this.y);
        if (d > this.magnetRange) continue;
        let score = -d;
        if (this.phase >= 2) {
          const dp = Math.hypot(it.x - player.x, it.y - player.y);
          score += Math.max(0, 1400 - dp) * 0.8;       // snatch it first
        }
        if (this.phase >= 3 && it.part.category === 'weapon') {
          score += 700 + (it.part.damage || it.part.dps || 0) * 8;
        }
        if (score > bestScore) { bestScore = score; best = it; }
      }
      this.salvageTarget = best;
      this.salvageT = 0;
    }

    if (!this.salvageTarget) return false;

    const it = this.salvageTarget;
    const gx = it.x - this.x, gy = it.y - this.y;
    const gd = Math.hypot(gx, gy) || 1;
    if (gd > this.grabDist) {
      // Move toward it while still fighting
      return { mx: gx / gd, my: gy / gd, pulling: false };
    }

    this.salvageT += dt;
    const pull = 1 - Math.exp(-6 * dt);
    it.x += (this.x - it.x) * pull;
    it.y += (this.y - it.y) * pull;
    it.vx *= 0.55; it.vy *= 0.55;

    if (this.salvageT >= this.pullTime) {
      const sock = Machine.attach(this, it.part.id, null);
      if (sock >= 0) {
        const s = Machine.getSocket(this, sock);
        s.comp.hp = s.comp.maxHp * it.hpFrac;
        LooseParts.remove(it);
        const p = Machine.socketPos(this, s);
        Effects.spark(p.x, p.y, Math.random() * Math.PI * 2, 12, CONFIG.COLOR.cyan, 500);
        Effects.comicWord('RECLAIMED!', this.x, this.y - this.radius - 80,
          CONFIG.COLOR.cyan);
        if (typeof buzz === 'function') buzz(18);
      }
      this.salvageTarget = null;
      this.salvageT = 0;
      this.salvageCdT = this.salvageCd;
    }
    return { mx: 0, my: 0, pulling: true };
  }

  update(dt, player, arena, obstacles) {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) return;
    this.sinceDamage += dt;
    this.stateT += dt;
    this.ring = Math.max(0, this.ring - dt);

    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    this.aimX = ux; this.aimY = uy;

    const speed = this.moveSpeed * (this.speedMul || 1);
    const salvage = this._updateSalvage(dt, player);

    if (salvage && !salvage.pulling) {
      // Racing the player to a part — it will happily eat shots to get there.
      this._steer(dt, salvage.mx, salvage.my, speed * 1.15);
      this.firingNow = d < 900;
    } else if (salvage && salvage.pulling) {
      this._steer(dt, 0, 0, 0);
      this.firingNow = d < 900;
    } else {
      // Standard fight: hold weapon range and keep its shield toward the player.
      const want = this.phase >= 3 ? 480 : 660;
      const radial = (d - want) / want;
      const orbit = this.phase >= 2 ? 0.9 : 0.6;
      this._steer(dt, ux * radial * 1.4 + (-uy) * orbit,
                      uy * radial * 1.4 + ux * orbit, speed);
      this.firingNow = d < 1150;
    }

    collideCircleWorld(this, arena, obstacles);
    Machine.update(dt, this, [player], this.firingNow, 'enemy');
  }

  _steer(dt, mx, my, sp) {
    const ml = Math.hypot(mx, my);
    const k = 1 - Math.exp(-5 * dt);
    const tx = ml < 0.0001 ? 0 : mx / ml * sp;
    const ty = ml < 0.0001 ? 0 : my / ml * sp;
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    if (!this.alive) return;

    // Magnet beam to whatever it is stealing — the player must SEE the theft.
    if (this.salvageTarget) {
      ctx.save();
      ctx.strokeStyle = 'rgba(34,217,255,0.9)';
      ctx.lineWidth = 9;
      ctx.setLineDash([22, 16]);
      ctx.lineDashOffset = -performance.now() / 18;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.salvageTarget.x, this.salvageTarget.y);
      ctx.stroke();
      ctx.restore();
      R.circle(this.salvageTarget.x, this.salvageTarget.y, 46, null,
        CONFIG.COLOR.cyan, 6);
    }

    if (this.ring > 0) {
      ctx.save();
      ctx.globalAlpha = this.ring;
      R.circle(this.x, this.y, this.radius + 60 + (0.8 - this.ring) * 200, null,
        CONFIG.COLOR.cyan, 10);
      ctx.restore();
    }

    R.circle(this.x, this.y, this.radius + 26, 'rgba(34,217,255,0.13)');
    R.circle(this.x + 12, this.y + 16, this.radius, 'rgba(0,0,0,0.5)');

    const body = this.flash > 0 ? '#ffffff' : '#1f2c4d';
    // NOTE: `a` (the aim angle) is declared further down for the eye, so the
    // sprite computes its own rather than using it before initialisation.
    const art = this.flash <= 0 && typeof Assets !== 'undefined' &&
      Assets.sprite(ctx, 'boss_foreman', this.x, this.y,
        this.radius * 2.5, this.radius * 2.5,
        Math.atan2(this.aimY, this.aimX));
    if (!art) {
      R.circle(this.x, this.y, this.radius, body, CONFIG.COLOR.ink, 12);
      R.circle(this.x, this.y, this.radius * 0.68, this.flash > 0 ? '#ffffff' : '#2c3f6e',
        CONFIG.COLOR.ink, 8);
    } else {
      R.circle(this.x, this.y, this.radius * 0.68, 'rgba(0,0,0,0)', '#2c3f6e', 6);
    }

    // Authority eye: it looks where it is aiming
    const a = Math.atan2(this.aimY, this.aimX);
    const ex = this.x + Math.cos(a) * this.radius * 0.28;
    const ey = this.y + Math.sin(a) * this.radius * 0.28;
    R.circle(this.x, this.y, this.radius * 0.4, '#0d1526', CONFIG.COLOR.ink, 6);
    R.circle(ex, ey, this.radius * 0.19, CONFIG.COLOR.cyan, CONFIG.COLOR.ink, 5);

    // Phase pips so escalation is legible
    for (let i = 0; i < 3; i++) {
      const pa = -Math.PI / 2 + (i - 1) * 0.36;
      R.circle(this.x + Math.cos(pa) * this.radius * 0.82,
        this.y + Math.sin(pa) * this.radius * 0.82, 11,
        i < this.phase ? CONFIG.COLOR.cyan : '#0d1526', CONFIG.COLOR.ink, 4);
    }

    Machine.draw(ctx, this);
  }
}

// Declared stats. The boss intro's scan card reads these, so they exist in
// exactly one place: change the fight and the transmission changes with it.
ForemanBoss.MAX_HP = 1500;
ForemanBoss.LOADOUT = [
  ['armourPlate', 0],
  ['directionalShield', 1],
  ['cannon', 2],
  ['smallReactor', 4],
  ['targetingModule', 5],
  ['rocketPod', 6],
];

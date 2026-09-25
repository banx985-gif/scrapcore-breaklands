// SCRAPCORE: BREAKLANDS — BOSS 2: FURNACE (Milestone 18, plan §46)
// The lesson this boss teaches: REMOVING SUPPORT BEATS RAW DAMAGE.
//
// Furnace runs a real Heat bar. Its Big Reactor and Heat Sink are what let it
// pour flame indefinitely. Shear those off and its own weapons cook it — it
// overheats, vents, and sits helpless while you take it apart. A player who
// only shoots the Core will have a much longer, hotter fight.

class FurnaceBoss {
  constructor(x, y) {
    this.isBoss = true;
    this.bossName = 'FURNACE';
    this.aiType = 'boss';
    this.coreKey = 'furnace';

    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = 120;
    this.maxHp = 1050;
    this.hp = this.maxHp;
    this.alive = true;
    this.flash = 0;
    this.aimX = 0; this.aimY = 1;
    this.sinceDamage = 999;
    this.moveSpeed = 265;
    this.braceMul = 0.4;
    this.extraSpread = 0.05;

    // Its own Heat economy (bosses are the one place enemies use Heat).
    this.heat = 0;
    this.baseHeatCap = 100;
    this.heatCap = 100;
    this.baseCooling = 6;          // pitiful without support parts
    this.overheated = false;
    this.overheatT = 0;
    this.overheatCount = 0;

    this.state = 'stalk';
    this.stateT = 0;
    this.firingNow = false;
    this.ventCd = 5;
    this.chargeX = 0; this.chargeY = 1;
    this.glow = 0;

    // Plan §46 loadout: 2 Flamethrowers, Heavy Armour, Big Reactor, Heat Sink,
    // Thruster. Every one of them is stealable.
    Machine.initSockets(this, 8);
    Machine.attach(this, 'flamethrower', 1);
    Machine.attach(this, 'flamethrower', 7);
    Machine.attach(this, 'heavyArmour', 0);
    Machine.attach(this, 'bigReactor', 4);
    Machine.attach(this, 'heatSink', 3);
    Machine.attach(this, 'thruster', 5);
  }

  // ---- shared damage model -------------------------------------------------
  takeCoreDamage(dmg, hx, hy, isSaw) {
    if (!this.alive) return;
    // Wide open while venting — the reward for stripping its cooling.
    this.hp -= dmg * (this.overheated ? 1.6 : 1);
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
    if (this.hp <= 0) this._die();
  }

  hit(dmg, hx, hy, isSaw) { this.takeCoreDamage(dmg, hx, hy, isSaw); }

  _die() {
    this.alive = false;
    for (const s of this.sockets) {
      if (!s.comp) continue;
      const p = Machine.socketPos(this, s);
      LooseParts.spawn(s.comp.part.id, s.comp.hp / s.comp.maxHp,
        p.x, p.y, Math.cos(s.angle) * 480, Math.sin(s.angle) * 480);
    }
    Machine.clearAll(this);
    Effects.hitStop(0.5, 0.3);
    Effects.explosion(this.x, this.y, 360);
    Effects.ring(this.x, this.y, 320, '#ff7a1a');
    Effects.comicWord('MELTDOWN!', this.x, this.y - 190, '#ff7a1a');
    Camera.shake(16, 0.6);
    if (typeof buzz === 'function') buzz([70, 60, 130]);
  }

  // ---- its Heat economy ----------------------------------------------------
  _cooling() {
    let c = this.baseCooling;
    let cap = this.baseHeatCap;
    for (const s of this.sockets) {
      if (!s.comp) continue;
      const p = s.comp.part;
      if (p.coolingBonus) c += p.coolingBonus;
      // The Heat Sink raises the ceiling AND vents actively.
      if (p.heatCapBonus) { cap += p.heatCapBonus; c += 18; }
      // The Big Reactor drives its coolant pumps.
      if (p.powerBonus) c += 30;
    }
    this.heatCap = cap;
    return c;
  }

  _updateHeat(dt) {
    const cooling = this._cooling();
    if (!this.overheated && this.heat >= this.heatCap - 0.01) {
      this.overheated = true;
      this.overheatCount++;
      this.overheatT = 4.5;
      this.firingNow = false;
      Effects.comicWord('OVERHEAT!', this.x, this.y - this.radius - 90, '#ff3b3b');
      Effects.ring(this.x, this.y, 200, '#ff3b3b');
      Camera.shake(8, 0.3);
    }
    if (this.overheated) {
      this.overheatT -= dt;
      this.heat = Math.max(0, this.heat - 34 * dt);
      if (Math.random() < dt * 22) {
        Effects.spark(this.x + (Math.random() - 0.5) * this.radius * 1.4,
          this.y + (Math.random() - 0.5) * this.radius * 1.4,
          -Math.PI / 2, 1, '#8fa3c8', 220);
      }
      if (this.overheatT <= 0) {
        this.overheated = false;
        Effects.comicWord('ONLINE!', this.x, this.y - this.radius - 90);
      }
    } else {
      // NO scripted heat gain: its Flamethrowers already push heat through the
      // shared Machine code (they charge any entity that has a .heat field).
      // Adding more here double-billed it and made the meltdown a timer rather
      // than something the player caused. Cooling is balanced against the real
      // burner output instead. Measured: it burns ~65% of the time and its two
      // Flamethrowers push ~60/sec while lit, so supported cooling of 56/sec
      // keeps it riding the bar without tipping. Stripped of both support
      // parts it cools at 8/sec and melts down within seconds.
      this.heat = Math.max(0, this.heat - cooling * dt);
    }
  }

  // ---- behaviour -----------------------------------------------------------
  update(dt, player, arena, obstacles, vents) {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) return;
    this.sinceDamage += dt;
    this.stateT += dt;
    this.ventCd -= dt;
    this.glow = this.heat / Math.max(1, this.heatCap);

    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    this.aimX = ux; this.aimY = uy;

    const speed = this.moveSpeed * (this.speedMul || 1);
    const burners = this.sockets.filter(s => s.comp && s.comp.part.flame).length;

    if (this.overheated) {
      // Helpless. This is the window the fight is really about.
      const brake = Math.exp(-3.5 * dt);
      this.vx *= brake; this.vy *= brake;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.firingNow = false;
      collideCircleWorld(this, arena, obstacles);
      this._updateHeat(dt);
      Machine.update(dt, this, [player], false, 'enemy');
      return;
    }

    switch (this.state) {
      case 'stalk': {
        // Close to flame range and burn. Flame reach is short, so this reads
        // as relentless pressure rather than sniping.
        const want = burners ? 260 : 520;
        const radial = (d - want) / want;
        this._steer(dt, ux * radial * 1.5 + (-uy) * 0.8,
                        uy * radial * 1.5 + ux * 0.8, speed);
        this.firingNow = burners > 0 && d < 460;
        if (this.stateT > 4.2) this._enter('charge');
        else if (this.ventCd <= 0) this._enter('vent');
        break;
      }
      case 'vent': {
        // Slams the floor and forces every Heat Vent in the arena to erupt.
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        if (this.stateT === 0) { /* set on enter */ }
        if (this.stateT > 0.7) {
          this.ventCd = 8 + Math.random() * 3;
          Effects.comicWord('THERMAL PURGE', this.x, this.y - this.radius - 90,
            '#ff7a1a');
          Camera.shake(9, 0.35);
          for (const v of (vents || [])) {
            // Jump each vent to just before its eruption.
            v.t = v.IDLE + v.WARN * 0.35;
          }
          this._enter('stalk');
        }
        break;
      }
      case 'charge': {
        if (this.stateT < 0.7) {
          this._steer(dt, 0, 0, 0);
          this.chargeX = ux; this.chargeY = uy;
          this.firingNow = false;
        } else {
          const k = 1 - Math.exp(-7 * dt);
          this.vx += (this.chargeX * speed * 3.1 - this.vx) * k;
          this.vy += (this.chargeY * speed * 3.1 - this.vy) * k;
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.firingNow = burners > 0;
          if (d < this.radius + player.radius + 14 && player.alive) {
            player.takeCoreDamage(13, player.x, player.y);
            const kb = 900 * (player.knockbackMul !== undefined ? player.knockbackMul : (player.recoilMul || 1));
            player.vx += ux * kb; player.vy += uy * kb;
            this._enter('stalk');
          }
          if (this.stateT > 1.9) this._enter('stalk');
        }
        break;
      }
      default: this._enter('stalk');
    }

    collideCircleWorld(this, arena, obstacles);
    this._updateHeat(dt);
    Machine.update(dt, this, [player], this.firingNow, 'enemy');
  }

  _enter(state) { this.state = state; this.stateT = 0; }

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
    const winding = this.state === 'charge' && this.stateT < 0.7;
    const blink = winding && Math.sin(performance.now() / 50) > 0;

    // Heat glow: the machine visibly runs hotter as its bar fills, so a player
    // who has stripped its cooling can SEE the overheat coming.
    const g = this.overheated ? 1 : this.glow;
    R.circle(this.x, this.y, this.radius + 26 + g * 26,
      'rgba(255,122,26,' + (0.10 + g * 0.30).toFixed(3) + ')');
    R.circle(this.x + 12, this.y + 16, this.radius, 'rgba(0,0,0,0.5)');

    const body = this.flash > 0 || blink ? '#ffffff' : '#4a2130';
    const art = this.flash <= 0 && !blink && typeof Assets !== 'undefined' &&
      Assets.sprite(ctx, 'boss_furnace', this.x, this.y,
        this.radius * 2.5, this.radius * 2.5, 0);
    if (!art) R.circle(this.x, this.y, this.radius, body, CONFIG.COLOR.ink, 12);

    // Molten centre — colour is the HEAT readout, so it is never removed.
    const molten = this.overheated ? '#ffffff'
      : (g > 0.7 ? '#ffd23f' : (g > 0.4 ? '#ff7a1a' : '#c2432a'));
    const coreR = art ? 0.34 : 0.6;
    R.circle(this.x, this.y, this.radius * coreR, molten, CONFIG.COLOR.ink, 8);
    R.circle(this.x, this.y, this.radius * coreR * 0.5 * (1 + g * 0.25), '#ffffff',
      CONFIG.COLOR.ink, 5);

    // Vent slots around the shell
    ctx.save();
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 9;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(a) * this.radius * 0.68,
                 this.y + Math.sin(a) * this.radius * 0.68);
      ctx.lineTo(this.x + Math.cos(a) * this.radius * 0.96,
                 this.y + Math.sin(a) * this.radius * 0.96);
      ctx.stroke();
    }
    ctx.restore();

    Machine.draw(ctx, this);
  }
}

// SCRAPCORE: BREAKLANDS — BOSS 1: CRUSHER (Milestone 15, plan §44)
// A big unique Core wearing ORDINARY components. Every rule the player learned
// still applies: shoot a connector and a Saw falls off; magnet it and the boss
// has permanently lost that weapon while you have gained it. The intended
// lesson is to strip the machine, not just burn the Core down.

class CrusherBoss {
  constructor(x, y) {
    this.isBoss = true;
    this.bossName = 'CRUSHER';
    this.aiType = 'boss';
    this.coreKey = 'crusher';

    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = 128;
    this.maxHp = 900;
    this.hp = this.maxHp;
    this.alive = true;
    this.flash = 0;
    this.aimX = 0; this.aimY = 1;
    this.sinceDamage = 999;
    this.moveSpeed = 250;
    this.braceMul = 0.35;        // heavy frame: shrugs off its own recoil
    this.extraSpread = 0.06;

    // Attack loop state
    this.state = 'stalk';
    this.stateT = 0;
    this.ramX = 0; this.ramY = 1;
    this.ramHitCd = 0;
    this.firingNow = false;
    this.jawT = 0;               // clamp animation
    this.deathT = 0;

    // Plan §44 starting loadout: 2 Saws, 2 Armour, Cannon, Thruster.
    Machine.initSockets(this, 8);
    Machine.attach(this, 'saw', 7);
    Machine.attach(this, 'saw', 1);
    Machine.attach(this, 'armourPlate', 0);
    Machine.attach(this, 'heavyArmour', 6);
    Machine.attach(this, 'cannon', 2);
    Machine.attach(this, 'thruster', 4);
  }

  // ---- same damage model as everything else --------------------------------
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
    if (this.hp <= 0) this._die();
  }

  hit(dmg, hx, hy, isSaw) { this.takeCoreDamage(dmg, hx, hy, isSaw); }

  _die() {
    this.alive = false;
    // Everything still bolted on becomes salvage — the player can walk away
    // wearing the boss's own weapons.
    for (const s of this.sockets) {
      if (!s.comp) continue;
      const p = Machine.socketPos(this, s);
      LooseParts.spawn(s.comp.part.id, s.comp.hp / s.comp.maxHp,
        p.x, p.y, Math.cos(s.angle) * 460, Math.sin(s.angle) * 460);
    }
    Machine.clearAll(this);
    Effects.hitStop(0.5, 0.3);      // boss-death slow motion (plan §74)
    Effects.explosion(this.x, this.y, 340);
    Effects.comicWord('SCRAP!', this.x, this.y - 190);
    Camera.shake(16, 0.6);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([70, 60, 120]);
  }

  // ---- behaviour loop (plan §44): ram -> saw chase -> cannon -> recover -----
  update(dt, player, arena, obstacles) {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) { this.deathT += dt; return; }
    this.sinceDamage += dt;
    this.stateT += dt;
    this.ramHitCd = Math.max(0, this.ramHitCd - dt);
    this.jawT += dt;

    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    this.aimX = ux; this.aimY = uy;

    // Losing the Thruster genuinely slows it down; losing Saws makes the
    // chase phase harmless. Stripping the machine changes the fight.
    const speed = this.moveSpeed * (this.speedMul || 1);
    const hasSaw = this.sockets.some(s => s.comp && s.comp.part.bladeRadius);

    switch (this.state) {
      case 'stalk': {
        // Keep mid distance and shell the player with the Cannon.
        const want = 620;
        const radial = (d - want) / want;
        this._steer(dt, ux * radial * 1.4 + (-uy) * 0.7,
                        uy * radial * 1.4 + ux * 0.7, speed * 0.85);
        this.firingNow = d < 1100;
        if (this.stateT > 3.4) this._enter(d < 900 ? 'windup' : 'chase');
        break;
      }
      case 'chase': {
        // Saw chase — bear down and grind. Pointless if the Saws are gone.
        this._steer(dt, ux, uy, speed * (hasSaw ? 1.05 : 0.8));
        this.firingNow = false;
        if (this.stateT > 2.6 || d < this.radius + player.radius + 40) {
          this._enter('windup');
        }
        break;
      }
      case 'windup': {
        // Telegraph: plant, flash, lock the charge direction.
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        this.ramX = ux; this.ramY = uy;
        if (this.stateT === 0) { /* set on enter */ }
        if (this.stateT > 0.85) {
          this._enter('ram');
          Effects.comicWord('RAM!', this.x, this.y - this.radius - 80, '#ff3b3b');
          Camera.shake(5, 0.2);
        }
        break;
      }
      case 'ram': {
        const k = 1 - Math.exp(-8 * dt);
        this.vx += (this.ramX * speed * 3.4 - this.vx) * k;
        this.vy += (this.ramY * speed * 3.4 - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.firingNow = false;
        if (this.ramHitCd <= 0 && d < this.radius + player.radius + 16 && player.alive) {
          this.ramHitCd = 0.8;
          player.takeCoreDamage(16, player.x, player.y);
          const kb = 1150 * (player.knockbackMul !== undefined ? player.knockbackMul : (player.recoilMul || 1));
          player.vx += ux * kb; player.vy += uy * kb;
          Effects.comicWord('WHAM!', player.x, player.y - 130);
          Camera.shake(10, 0.28);
        }
        if (this.stateT > 1.15) this._enter('recover');
        break;
      }
      default: {   // 'recover' — the punish window
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
        if (this.stateT > 1.5) this._enter('stalk');
        break;
      }
    }

    collideCircleWorld(this, arena, obstacles);
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
    const winding = this.state === 'windup';
    const blink = winding && Math.sin(performance.now() / 50) > 0;

    R.circle(this.x, this.y, this.radius + 26, 'rgba(255,59,90,0.16)');
    R.circle(this.x + 12, this.y + 16, this.radius, 'rgba(0,0,0,0.5)');

    // Clamp jaws: they gape during windup, snap shut on the ram. This is the
    // ram TELEGRAPH, so it has to animate — hence body and jaw being separate
    // sprites rather than one baked model.
    const gape = winding ? 0.5 + Math.sin(this.stateT * 18) * 0.06
                         : (this.state === 'ram' ? 0.06 : 0.28);
    const a = Math.atan2(this.aimY, this.aimX);
    const jawArt = typeof Assets !== 'undefined' && Assets.has('boss_crusherJaw');

    if (jawArt) {
      // Hinge each jaw at the body edge and swing it open around that point.
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(a + side * gape);
        ctx.translate(this.radius * 0.72, 0);
        ctx.scale(1, side);            // mirror the second jaw
        Assets.sprite(ctx, 'boss_crusherJaw', 0, this.radius * 0.34,
          this.radius * 1.5, this.radius * 1.5, -Math.PI / 2);
        ctx.restore();
      }
    } else {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * gape);
      ctx.fillStyle = this.flash > 0 || blink ? '#ffffff' : '#7a2233';
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(this.radius * 0.15, side * 18);
      ctx.lineTo(this.radius * 1.5, side * 40);
      ctx.lineTo(this.radius * 1.62, side * 8);
      ctx.lineTo(this.radius * 0.2, side * 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = CONFIG.COLOR.ink;
      for (let i = 0; i < 4; i++) {
        const t = this.radius * (0.5 + i * 0.26);
        ctx.beginPath();
        ctx.moveTo(t, side * 30);
        ctx.lineTo(t + 26, side * 30);
        ctx.lineTo(t + 13, side * 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    }

    const body = this.flash > 0 || blink ? '#ffffff' : '#5c2333';
    const art = this.flash <= 0 && !blink && typeof Assets !== 'undefined' &&
      Assets.sprite(ctx, 'boss_crusher', this.x, this.y,
        this.radius * 2.4, this.radius * 2.4, a);
    if (!art) {
      R.circle(this.x, this.y, this.radius, body, CONFIG.COLOR.ink, 12);
      R.circle(this.x, this.y, this.radius * 0.62, this.flash > 0 ? '#ffffff' : '#93303f',
        CONFIG.COLOR.ink, 8);
      R.circle(this.x, this.y, this.radius * 0.26, '#ff5c7a', CONFIG.COLOR.ink, 6);
    } else {
      R.circle(this.x, this.y, this.radius * 0.62, 'rgba(0,0,0,0)', '#93303f', 6);
      R.circle(this.x, this.y, this.radius * 0.16, '#ff5c7a', CONFIG.COLOR.ink, 5);
    }

    Machine.draw(ctx, this);
  }
}

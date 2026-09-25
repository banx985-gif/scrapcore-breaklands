// SCRAPCORE: BREAKLANDS — THE WARDEN ROSTER (Master v3.2 §26 / §26A)
//
// WardenBase carries the lifecycle the M1 Reclaimer PROVED: fought on
// Screen 3 with a limited moveset, retreats at 72% Core HP remaining, fought
// complete and scarred on Screen 6. ReclaimerWarden (warden.js, loaded after
// this file) now extends this base; the other nine live here.
//
// Every balance figure comes from WARDEN_TUNING (campaign.js) — the §26A
// starting values, in the one place M45 will look for them. Nothing numeric
// is hard-coded in a move.
//
// Each Warden wears ordinary components on ordinary sockets, exactly like
// every other machine: shoot a connector and the Warden permanently loses
// that weapon and the player can bolt it on. That rule is the game.
//
// Art is placeholder silhouette work. The real Wardens are ART v1.3 §8.

const WARDEN_PHASE = { FIRST: 'first', FINAL: 'final' };

// Registry: campaign map data names its Warden ('RECLAIMER'); this owns the
// name -> class mapping so adding a map never adds a spawn branch.
const Wardens = {
  _reg: {},
  register(name, cls) { this._reg[name] = cls; },
  create(name, x, y, phase, startHpFrac) {
    const Cls = this._reg[name];
    if (!Cls) throw new Error('Unknown Warden: ' + name);
    return new Cls(x, y, phase, startHpFrac);
  },
  // Map order (§25): the campaign's own sequence, not registration order.
  ORDER: ['RECLAIMER', 'STITCHER', 'DYNAMO', 'ROADBLOCK', 'WARMAKER',
    'BOREMAW', 'CRUCIBLE', 'PATCHWORK', 'BAILIFF', 'KINGMAKER'],
  list() {
    const known = Object.keys(this._reg);
    return this.ORDER.filter(n => known.includes(n))
      .concat(known.filter(n => !this.ORDER.includes(n)));
  },
};

class WardenBase {
  // spec: { name, tuningKey, radius, moveSpeed }
  // phase FIRST = Screen 3 subset, retreats. FINAL = complete, to the death.
  constructor(spec, x, y, phase, startHpFrac = 1) {
    this.isBoss = true;
    this.isWarden = true;
    this.bossName = spec.name;
    this.aiType = 'boss';
    this.coreKey = 'crusher';        // XP/kill-credit bucket
    this.tun = WARDEN_TUNING[spec.tuningKey];

    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = spec.radius;

    // Master §26A: base final-fight Core HP. Screen 3 draws from the SAME pool.
    this.maxHp = this.tun.coreHp;
    this.hp = this.maxHp * startHpFrac;
    this.alive = true;
    this.flash = 0;
    this.aimX = 0; this.aimY = 1;
    this.sinceDamage = 999;
    this.moveSpeed = spec.moveSpeed;
    this.braceMul = 0.4;
    this.extraSpread = 0.05;

    this.phase = phase;
    this.retreatAt = this.tun.retreatAt;   // §26A column: 72% REMAINING
    this.retreating = false;
    this.gone = false;
    this.retreatT = 0;
    this.escapeX = 0; this.escapeY = 0;

    this.state = 'stalk';
    this.stateT = 0;
    this.chargeX = 0; this.chargeY = 1;
    this.hitCd = 0;
    this.firingNow = false;
    this.deathT = 0;
    this.coilT = 0;

    this.cd = {};            // per-move cooldowns; base ticks every key
    this.zones = [];         // telegraphed ground/area effects (below)
    this.barriers = [];      // temporary wall obstacles this Warden deployed
    this.pendingAdds = [];   // spawned machines; the game state drains this
    this._cdMul = 1;         // Blackout Field / Smelt Field tick cooldowns faster
  }

  get retreatHp() { return this.maxHp * this.retreatAt; }

  // ---- damage: identical model to every other machine ---------------------
  takeCoreDamage(dmg, hx, hy, isSaw) {
    if (!this.alive || this.retreating || this.untargetable) return;
    dmg = this._damageIn(dmg, hx, hy);     // hook: Guard Face and friends
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
      Effects.spark(hx, hy, Math.atan2(hy - this.y, hx - this.x), 4, '#22d9ff');
    }
    // THE M1 BEAT. On Screen 3 it does not die — it breaks off and runs.
    if (this.phase === WARDEN_PHASE.FIRST && this.hp <= this.retreatHp) {
      this._beginRetreat();
      return;
    }
    if (this.hp <= 0) this._die();
  }

  hit(dmg, hx, hy, isSaw) { this.takeCoreDamage(dmg, hx, hy, isSaw); }

  _damageIn(dmg) { return dmg; }           // subclass hook (Roadblock guard)

  _beginRetreat() {
    if (this.retreating) return;
    this.retreating = true;
    // CORE CHARGE (M12): driving a Warden to its threshold is +10 (§20).
    if (typeof Mods !== 'undefined' && Machine._xpPlayer) {
      Mods.event(Machine._xpPlayer, 'retreat');
    }
    this.retreatT = 0;
    this.hp = Math.max(1, this.retreatHp);
    this.firingNow = false;
    this._clearBarriers();
    this.zones.length = 0;
    Effects.ring(this.x, this.y, 620, '#22d9ff');
    Effects.explosion(this.x, this.y, 260);
    Effects.comicWord('WARDEN RETREATING!', this.x, this.y - 220,
      CONFIG.COLOR.cyan, 78);
    Camera.shake(14, 0.5);
    if (typeof Audio_ !== 'undefined') Audio_.play('bossWarn');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 50, 90]);
    }
  }

  _die() {
    this.alive = false;
    this._clearBarriers();
    this.zones.length = 0;
    // Master §17: a Warden is worth 10 Mastery credits.
    if (typeof Mastery !== 'undefined' && this._lastHitBy) {
      Mastery.award(this._lastHitBy, 'warden');
    }
    // §30 LAST SPARK unlocks on "beat a Warden below 10% Core HP" — measured
    // at the kill, on the machine that did it.
    const p = Machine._xpPlayer;
    for (const s of this.sockets) {
      if (!s.comp) continue;
      const p = Machine.socketPos(this, s);
      LooseParts.spawn(s.comp.part.id, s.comp.hp / s.comp.maxHp,
        p.x, p.y, Math.cos(s.angle) * 460, Math.sin(s.angle) * 460);
    }
    Machine.clearAll(this);
    // M17 (§22): a beaten Warden drops its signature Prototype — recover it
    // and carry it across the clear boundary to keep it forever.
    if (typeof Proto !== 'undefined') Proto.dropFromWarden(this);
    Effects.hitStop(0.5, 0.3);
    Effects.explosion(this.x, this.y, 360);
    Effects.comicWord('WARDEN DOWN!', this.x, this.y - 200, CONFIG.COLOR.lime);
    Camera.shake(18, 0.7);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([70, 60, 140]);
  }

  // ---- frame plumbing ------------------------------------------------------
  update(dt, player, arena, obstacles) {
    this.flash = Math.max(0, this.flash - dt);
    this.coilT += dt;
    if (!this.alive) { this.deathT += dt; return; }
    this._obstacles = obstacles;
    if (this.retreating) { this._updateRetreat(dt, arena, obstacles); return; }

    this.sinceDamage += dt;
    this.stateT += dt;
    this.hitCd = Math.max(0, this.hitCd - dt);
    const cdt = dt / (this._cdMul || 1);
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - cdt);

    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    if (!this._aimLocked) { this.aimX = ux; this.aimY = uy; }
    const speed = this.moveSpeed * (this.speedMul || 1);
    const final = this.phase === WARDEN_PHASE.FINAL;

    this._tickZones(dt, player);
    this._tickBarriers(dt, obstacles);
    this._brain(dt, player, arena, obstacles,
      { d, ux, uy, speed, final });

    if (!this.untargetable) collideCircleWorld(this, arena, obstacles);
    Machine.update(dt, this, [player], this.firingNow, 'enemy');
  }

  _brain() {}                              // subclass owns the state machine

  // Generic stalk: hold a ring around the player, guns live inside range.
  _stalk(dt, ctx2, want, orbit = 0.75) {
    const { d, ux, uy, speed } = ctx2;
    const radial = (d - want) / want;
    this._steer(dt, ux * radial * 1.4 + (-uy) * orbit,
                    uy * radial * 1.4 + ux * orbit, speed * 0.9);
    this.firingNow = d < 1000;
  }

  // Generic recover: the punish window after a big move.
  _recover(dt, t = 1.4) {
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
    if (this.stateT > t) this._enter('stalk');
  }

  // Breaks off and runs for the nearest arena edge, untouchable on the way out.
  _updateRetreat(dt, arena, obstacles) {
    this.retreatT += dt;
    if (this.retreatT < 0.6) {
      this.vx *= Math.exp(-6 * dt);
      this.vy *= Math.exp(-6 * dt);
    } else {
      if (!this.escapeX && !this.escapeY) {
        const left = this.x - arena.x, right = arena.x + arena.w - this.x;
        const top = this.y - arena.y, bot = arena.y + arena.h - this.y;
        const m = Math.min(left, right, top, bot);
        this.escapeX = m === left ? -1 : (m === right ? 1 : 0);
        this.escapeY = m === top ? -1 : (m === bot ? 1 : 0);
      }
      const sp = 900;
      this.vx += (this.escapeX * sp - this.vx) * (1 - Math.exp(-5 * dt));
      this.vy += (this.escapeY * sp - this.vy) * (1 - Math.exp(-5 * dt));
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.random() < dt * 20) {
      Effects.spark(this.x, this.y, Math.random() * Math.PI * 2, 2, '#ff7a1a', 260);
    }
    const pad = 400;
    if (this.x < arena.x - pad || this.x > arena.x + arena.w + pad ||
        this.y < arena.y - pad || this.y > arena.y + arena.h + pad ||
        this.retreatT > 6) {
      this.gone = true;
      this.alive = false;
    }
  }

  _enter(state) { this.state = state; this.stateT = 0; }

  _steer(dt, mx, my, sp) {
    // LOCKDOWN PROJECTOR (§22): Wardens slow only -10%, but they DO slow.
    if (this._slowFieldT > 0) {
      this._slowFieldT -= dt;
      sp *= (this._slowFieldMul || 1);
    }
    const ml = Math.hypot(mx, my);
    const k = 1 - Math.exp(-5 * dt);
    const tx = ml < 0.0001 ? 0 : mx / ml * sp;
    const ty = ml < 0.0001 ? 0 : my / ml * sp;
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  // ---- SPAWN_POOLS: telegraphed area effects -------------------------------------
  // Two kinds. IMPULSE (live=0): warn timer runs, then it fires once — damage,
  // heat, knockback — and dies. FIELD (live>0): after the warn it stays for
  // `live` seconds; while the player is inside, dps/heatPs/slowMul apply.
  // DPS is dealt in >=4 chunks through the saw path so the damage numbers stay
  // readable and one tick can't farm the post-hit grace.
  _zone(z) {
    this.zones.push(Object.assign({
      t: 0, warn: 1, live: 0, r: 120, shape: 'circle',
      dmg: 0, heat: 0, kb: 0, dps: 0, heatPs: 0, slowMul: 0,
      acc: 0, color: '#ff7a1a',
    }, z));
    return this.zones[this.zones.length - 1];
  }

  _inZone(z, ent) {
    if (z.shape === 'beam') {
      // segment from (x,y) along angle for len, half-width thick
      const bx = ent.x - z.x, by = ent.y - z.y;
      const ax = Math.cos(z.angle), ay = Math.sin(z.angle);
      const along = bx * ax + by * ay;
      if (along < 0 || along > z.len) return false;
      const off = Math.abs(-bx * ay + by * ax);
      return off < (z.thick || 60) + ent.radius;
    }
    return Math.hypot(ent.x - z.x, ent.y - z.y) < z.r + ent.radius;
  }

  _tickZones(dt, player) {
    for (const z of this.zones) {
      z.t += dt;
      if (z.tick) z.tick(z, dt, player);   // moving zones (PILEUP) steer here
      if (z.t < z.warn) continue;
      if (z.live <= 0) {
        if (!z.fired) {
          z.fired = true; z.dead = true;
          this._zoneFire(z, player);
        }
        continue;
      }
      if (z.t - z.warn > z.live) { z.dead = true; continue; }
      if (!player.alive || !this._inZone(z, player)) continue;
      if (z.dps) {
        z.acc += z.dps * dt;
        if (z.acc >= 4) { player.takeCoreDamage(z.acc, player.x, player.y, true); z.acc = 0; }
      }
      if (z.heatPs) Machine.addHeat(player, z.heatPs * dt);
      if (z.slowMul) { player._fieldSlowT = 0.15; player._fieldSlowMul = z.slowMul; }
      if (z.contactDmg && (!z._hitCd || z._hitCd <= 0)) {
        z._hitCd = 0.8;
        player.takeCoreDamage(z.contactDmg, player.x, player.y);
        if (z.kb) {
          const d = Math.hypot(player.x - z.x, player.y - z.y) || 1;
          const kbm = player.knockbackMul !== undefined ? player.knockbackMul : 1;
          player.vx += (player.x - z.x) / d * z.kb * kbm;
          player.vy += (player.y - z.y) / d * z.kb * kbm;
        }
      }
      if (z._hitCd > 0) z._hitCd -= dt;
    }
    this.zones = this.zones.filter(z => !z.dead);
  }

  _zoneFire(z, player) {
    Effects.explosion(z.x + (z.shape === 'beam' ? Math.cos(z.angle) * z.len / 2 : 0),
      z.y + (z.shape === 'beam' ? Math.sin(z.angle) * z.len / 2 : 0),
      z.shape === 'beam' ? 120 : z.r);
    Camera.shake(6, 0.2);
    if (z.debris && this._obstacles) {
      const o = { type: 'pillar', x: z.x, y: z.y, r: 70, _wardenTtl: 10 };
      this._obstacles.push(o);
      this.barriers.push(o);
    }
    if (!player.alive || !this._inZone(z, player)) return;
    if (z.dmg) player.takeCoreDamage(z.dmg, player.x, player.y);
    if (z.heat) Machine.addHeat(player, z.heat);
    if (z.kb) {
      const d = Math.hypot(player.x - z.x, player.y - z.y) || 1;
      const kbm = player.knockbackMul !== undefined ? player.knockbackMul : 1;
      player.vx += (player.x - z.x) / d * z.kb * kbm;
      player.vy += (player.y - z.y) / d * z.kb * kbm;
    }
    if (z.onHit) z.onHit(player);
  }

  // ---- BARRIERS: temporary wall/pillar obstacles ---------------------------
  _dropBarrier(obstacles, o, ttl) {
    o._wardenTtl = ttl;
    obstacles.push(o);
    this.barriers.push(o);
    Effects.ring(o.type === 'pillar' ? o.x : o.x + o.w / 2,
      o.type === 'pillar' ? o.y : o.y + o.h / 2, 140, '#8fa3c8');
  }

  _tickBarriers(dt, obstacles) {
    for (const o of this.barriers) o._wardenTtl -= dt;
    for (let i = this.barriers.length - 1; i >= 0; i--) {
      const o = this.barriers[i];
      if (o._wardenTtl > 0) continue;
      const idx = obstacles.indexOf(o);
      if (idx >= 0) obstacles.splice(idx, 1);
      this.barriers.splice(i, 1);
      Effects.spark(o.x + (o.w || 0) / 2, o.y + (o.h || 0) / 2, 0, 6, '#8fa3c8', 300);
    }
  }

  _clearBarriers() {
    if (!this._obstacles) { this.barriers.length = 0; return; }
    for (const o of this.barriers) {
      const idx = this._obstacles.indexOf(o);
      if (idx >= 0) this._obstacles.splice(idx, 1);
    }
    this.barriers.length = 0;
  }

  // ---- ADDS ----------------------------------------------------------------
  _spawnAdd(x, y, loadout, aiType, coreKey) {
    const e = new Enemy(x, y, loadout, aiType, coreKey);
    e._wardenAdd = this;
    this.pendingAdds.push(e);
    Effects.ring(x, y, 160, '#ff3fa4');
    return e;
  }

  _aliveAdds(enemiesHint) {
    // Counts through pendingAdds' spawned refs; the game state keeps them in
    // its enemies list but the Warden only needs its own.
    this._adds = (this._adds || []).filter(e => e.alive);
    return this._adds.length;
  }

  // ---- shared draw helpers -------------------------------------------------
  _drawZones(ctx) {
    for (const z of this.zones) {
      const warned = z.t < z.warn;
      const a = warned ? 0.10 + 0.18 * (z.t / z.warn) : 0.22;
      ctx.save();
      if (z.shape === 'beam') {
        ctx.translate(z.x, z.y);
        ctx.rotate(z.angle);
        ctx.fillStyle = this._rgba(z.color, warned ? a : 0.30);
        ctx.fillRect(0, -(z.thick || 60), z.len, (z.thick || 60) * 2);
        if (warned) {
          ctx.strokeStyle = this._rgba(z.color, 0.8);
          ctx.lineWidth = 4;
          ctx.strokeRect(0, -(z.thick || 60), z.len, (z.thick || 60) * 2);
        }
      } else {
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
        ctx.fillStyle = this._rgba(z.color, a);
        ctx.fill();
        ctx.lineWidth = warned ? 5 : 3;
        ctx.strokeStyle = this._rgba(z.color, warned ? 0.9 : 0.5);
        ctx.stroke();
        if (warned) {   // shrinking timer ring — the read is "get out NOW"
          ctx.beginPath();
          ctx.arc(z.x, z.y, z.r * (1 - z.t / z.warn), 0, Math.PI * 2);
          ctx.strokeStyle = this._rgba(z.color, 0.9);
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  _rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' +
      (n & 255) + ',' + a + ')';
  }

  // Placeholder body: silhouette circle + subclass feature. Real art: §8.
  _drawBodyBase(ctx, bodyCol, innerCol, glowCol) {
    R.circle(this.x, this.y, this.radius + 26, glowCol);
    R.circle(this.x + 12, this.y + 16, this.radius, 'rgba(0,0,0,0.5)');
    const body = this.flash > 0 ? '#ffffff' : bodyCol;
    R.circle(this.x, this.y, this.radius, body, CONFIG.COLOR.ink, 12);
    R.circle(this.x, this.y, this.radius * 0.66,
      this.flash > 0 ? '#ffffff' : innerCol, CONFIG.COLOR.ink, 8);
  }

  draw(ctx) {
    if (!this.alive && !this.retreating) return;
    this._drawZones(ctx);
    this._drawBody(ctx);
    Machine.draw(ctx, this);
  }

  _drawBody(ctx) {
    this._drawBodyBase(ctx, '#123c4d', '#1d5f7a', 'rgba(34,217,255,0.14)');
  }
}

// ===========================================================================
// WARDEN 2 — STITCHER (Assembly Row). §26: fabricates delaying machines.
// Screen 3: Fabricate, Stitch Hook, Repair Beam.
// Final: + Branch Rebuild (once), Production Surge.
class StitcherWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'STITCHER', tuningKey: 'stitcher', radius: 120, moveSpeed: 250 },
      x, y, phase, startHpFrac);
    this.cd.fab = 2.0; this.cd.hook = 4.0; this.cd.repair = 8.0; this.cd.surge = 10.0;
    this._adds = [];
    this._rebuildUsed = false;
    this._surgeT = 0;
    this._repairTarget = null;

    Machine.initSockets(this, 8);
    Machine.attach(this, 'repairArm', 0);      // the emitting arm (§26A)
    Machine.attach(this, 'machineGun', 2);
    Machine.attach(this, 'armourPlate', 4);
    Machine.attach(this, 'splitter', 6);
    this._blueprint = this.sockets.filter(s => s.comp)
      .map(s => ({ id: s.id, part: s.comp.part.id }));
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'scattergun', 5);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    // Production Surge buff window ticking down
    if (this._surgeT > 0) {
      this._surgeT -= dt;
      this.speedMul = t.surgeSpeedMul;
      if (this._surgeT <= 0) this.speedMul = 1;
    }
    switch (this.state) {
      case 'stalk': {
        this._stalk(dt, c, 620);
        if (this.cd.fab <= 0 && this._aliveAdds() < t.fabricateMax) {
          this._enter('fabricate'); break;
        }
        if (this.cd.hook <= 0 && c.d < t.hookRange) { this._stitchHook(player); }
        if (this.cd.repair <= 0 && this._weakestOwn() &&
            this.sockets.some(s => s.comp && s.comp.part.id === 'repairArm')) {
          this._enter('repair'); break;
        }
        if (c.final && !this._rebuildUsed && this._lostSocket()) {
          this._branchRebuild();
        }
        if (c.final && this.cd.surge <= 0 && this._surgeT <= 0) {
          this._productionSurge();
        }
        break;
      }

      // ---- FABRICATE: 1.4s stationary build, then one Light machine -------
      case 'fabricate': {
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        if (Math.random() < dt * 18) {
          Effects.spark(this.x + (Math.random() - 0.5) * 200,
            this.y + (Math.random() - 0.5) * 200, -Math.PI / 2, 1, '#a8e832', 260);
        }
        if (this.stateT > t.fabricateTime) {
          const a = Math.random() * Math.PI * 2;
          const e = this._spawnAdd(this.x + Math.cos(a) * (this.radius + 90),
            this.y + Math.sin(a) * (this.radius + 90),
            [['machineGun', 0]], 'strafer', 'light');
          this._adds.push(e);
          // §26A PRODUCTION SURGE: fabricated-add cooldown halved.
          this.cd.fab = this._surgeT > 0 ? t.fabricateCd / 2 : t.fabricateCd;
          Effects.comicWord('FABRICATE!', this.x, this.y - this.radius - 70, '#a8e832');
          this._enter('recover');
        }
        break;
      }

      // ---- REPAIR BEAM: 3s channel, 8 HP/s on its weakest module ----------
      case 'repair': {
        this._steer(dt, -c.ux * 0.4, -c.uy * 0.4, c.speed * 0.3);
        this.firingNow = false;
        const arm = this.sockets.find(s => s.comp && s.comp.part.id === 'repairArm');
        const target = this._weakestOwn();
        // §26A: interrupt by breaking the emitting arm.
        if (!arm || !target) { this.cd.repair = 4.0; this._enter('stalk'); break; }
        target.comp.hp = Math.min(target.comp.maxHp,
          target.comp.hp + t.repairRate * dt);
        if (Math.random() < dt * 10) {
          const ap = Machine.socketPos(this, arm);
          const tp = Machine.socketPos(this, target);
          Effects.bolt(ap.x, ap.y, tp.x, tp.y, '#a8e832');
        }
        if (this.stateT > t.repairChannel) {
          this.cd.repair = t.repairCd;
          this._enter('stalk');
        }
        break;
      }

      default: this._recover(dt, 1.0); break;
    }
  }

  // §26A STITCH HOOK: grabs a loose part — or the player, for 16 + a strong
  // pull. The floor state matters both ways with this one on the field.
  _stitchHook(player) {
    const t = this.tun;
    this.cd.hook = t.hookCd;
    const d = Math.hypot(player.x - this.x, player.y - this.y);
    Effects.bolt(this.x, this.y, player.x, player.y, '#ffd23f');
    if (d < t.hookRange && player.alive) {
      player.takeCoreDamage(t.hookDamage, player.x, player.y);
      const ux = (this.x - player.x) / (d || 1), uy = (this.y - player.y) / (d || 1);
      const kbm = player.knockbackMul !== undefined ? player.knockbackMul : 1;
      player.vx += ux * t.hookPull * kbm;
      player.vy += uy * t.hookPull * kbm;
      Effects.comicWord('HOOKED!', player.x, player.y - 140, CONFIG.COLOR.yellow);
    } else {
      const near = LooseParts.nearest ? LooseParts.nearest(this.x, this.y, 900) : null;
      if (near) { near.x = this.x; near.y = this.y; }
    }
  }

  _weakestOwn() {
    let best = null;
    for (const s of this.sockets) {
      if (!s.comp || s.comp.hp >= s.comp.maxHp) continue;
      if (!best || s.comp.hp / s.comp.maxHp < best.comp.hp / best.comp.maxHp) best = s;
    }
    return best;
  }

  _lostSocket() {
    return this._blueprint.find(b => {
      const s = this.sockets.find(x => x.id === b.id);
      return s && !s.comp;
    });
  }

  // §26A BRANCH REBUILD: once per final fight, a lost branch returns at 35%.
  _branchRebuild() {
    const lost = this._lostSocket();
    if (!lost) return;
    this._rebuildUsed = true;
    const idx = Machine.attach(this, lost.part, lost.id);
    if (idx >= 0) {
      const s = Machine.getSocket(this, idx);
      if (s && s.comp) s.comp.hp = s.comp.maxHp * this.tun.rebuildFrac;
      Effects.comicWord('REBUILD!', this.x, this.y - this.radius - 70, '#a8e832', 64);
      Effects.ring(this.x, this.y, 300, '#a8e832');
    }
  }

  _productionSurge() {
    const t = this.tun;
    this.cd.surge = t.surgeCd;
    this._surgeT = t.surgeTime;
    Effects.comicWord('PRODUCTION SURGE!', this.x, this.y - this.radius - 90,
      '#a8e832', 70);
    Effects.ring(this.x, this.y, 420, '#a8e832');
  }

  _drawBody(ctx) {
    // Fabricator: green industrial, crossed weld-arms silhouette.
    if (this.state === 'fabricate' || this.state === 'repair') {
      const blink = Math.sin(performance.now() / 60) > 0;
      if (blink) R.circle(this.x, this.y, this.radius + 40, 'rgba(168,232,50,0.12)');
    }
    this._drawBodyBase(ctx, '#2b4416', '#48701f', 'rgba(168,232,50,0.14)');
    const a = Math.atan2(this.aimY, this.aimX);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    ctx.strokeStyle = this._surgeT > 0 ? '#d8ff7a' : '#a8e832';
    ctx.lineWidth = 12;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(this.radius * 0.3, side * this.radius * 0.5);
      ctx.lineTo(this.radius * 1.25, side * this.radius * 0.85);
      ctx.lineTo(this.radius * 1.45, side * this.radius * 0.35);
      ctx.stroke();
    }
    ctx.restore();
    R.circle(this.x, this.y, this.radius * 0.26,
      this._surgeT > 0 ? '#d8ff7a' : '#7ab52a', CONFIG.COLOR.ink, 6);
  }
}

// ===========================================================================
// WARDEN 3 — DYNAMO (Voltworks). §26: overload/blackout.
// Screen 3: Arc Chain, Overload Pulse, Pylon Burst.
// Final: + Grid Dash, Blackout Field (once per phase).
class DynamoWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'DYNAMO', tuningKey: 'dynamo', radius: 110, moveSpeed: 300 },
      x, y, phase, startHpFrac);
    this.cd.arc = 2.0; this.cd.pulse = 5.0; this.cd.pylon = 6.0; this.cd.dash = 7.0;
    this._blackoutUsed = false;
    this.blackoutT = 0;                 // drawn by our draw as a light-kill
    this._pylons = [];                  // {o, t} energized pillar obstacles
    this._dashPlan = null;

    Machine.initSockets(this, 8);
    Machine.attach(this, 'arcGun', 0);
    Machine.attach(this, 'capacitor', 2);
    Machine.attach(this, 'armourPlate', 4);
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'arcGun', 6);
      Machine.attach(this, 'armourPlate', 5);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    if (this.blackoutT > 0) {
      this.blackoutT -= dt;
      this._cdMul = t.blackoutCdMul;    // §26A: attack cooldowns -15%
      if (this.blackoutT <= 0) this._cdMul = 1;
    }
    for (const p of this._pylons) p.t -= dt;
    this._pylons = this._pylons.filter(p => p.t > 0);
    this._tickPylons(dt, player);

    switch (this.state) {
      case 'stalk': {
        this._stalk(dt, c, 520, 1.0);   // fast lateral — an electric skater
        if (this.cd.arc <= 0 && c.d < t.arcRange) { this._arcChain(player); }
        if (this.cd.pulse <= 0 && c.d < t.pulseRadius * 0.9) {
          this._enter('pulseWind'); break;
        }
        if (this.cd.pylon <= 0) { this._pylonBurst(obstacles); }
        if (c.final && this.cd.dash <= 0) { this._planGridDash(player); break; }
        if (c.final && !this._blackoutUsed && this.hp < this.maxHp * 0.6) {
          this._blackout();
        }
        break;
      }

      // ---- OVERLOAD PULSE: 0.9s telegraph, radius 420 on itself -----------
      case 'pulseWind': {
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        if (this.stateT > t.pulseWarn) {
          this.cd.pulse = t.pulseCd;
          Effects.ring(this.x, this.y, t.pulseRadius, '#ffd23f');
          Camera.shake(8, 0.3);
          const d = Math.hypot(player.x - this.x, player.y - this.y);
          if (d < t.pulseRadius + player.radius && player.alive) {
            Machine.addHeat(player, t.pulseHeat);
            this._disableHighestPower(player, t.pulseDisable);
            Effects.comicWord('OVERLOAD!', player.x, player.y - 150, CONFIG.COLOR.yellow, 66);
          }
          this._enter('recover');
        }
        break;
      }

      // ---- GRID DASH (final): 3 rapid 320-unit dashes through marked lanes
      case 'gridDash': {
        const plan = this._dashPlan;
        if (!plan) { this._enter('stalk'); break; }
        this.firingNow = false;
        if (plan.wait > 0) {            // lanes telegraphed, riding the pause
          plan.wait -= dt;
          this._steer(dt, 0, 0, 0);
          break;
        }
        const leg = plan.legs[plan.i];
        if (!leg) { this.cd.dash = t.dashCd; this._dashPlan = null; this._enter('recover'); break; }
        const sp = 1500;
        this.x += Math.cos(leg.a) * sp * dt;
        this.y += Math.sin(leg.a) * sp * dt;
        leg.left -= sp * dt;
        if (Math.random() < dt * 30) {
          Effects.spark(this.x, this.y, leg.a + Math.PI, 2, '#ffd23f', 420);
        }
        if (this.hitCd <= 0 && player.alive &&
            Math.hypot(player.x - this.x, player.y - this.y) < this.radius + player.radius + 10) {
          this.hitCd = 0.5;
          player.takeCoreDamage(t.dashDamage, player.x, player.y);
          Effects.comicWord('ZAP!', player.x, player.y - 130, CONFIG.COLOR.yellow);
        }
        if (leg.left <= 0) plan.i++;
        break;
      }

      default: this._recover(dt, 1.1); break;
    }
  }

  // §26A ARC CHAIN: 14, jumping through up to 3 player modules at 65% each.
  _arcChain(player) {
    const t = this.tun;
    this.cd.arc = t.arcCd;
    const comps = player.sockets.filter(s => s.comp);
    let dmg = t.arcDamage;
    let from = { x: this.x, y: this.y };
    Effects.comicWord('ARC CHAIN!', this.x, this.y - this.radius - 60, CONFIG.COLOR.yellow, 52);
    if (!comps.length) {          // bare core: the whole arc lands on the hull
      Effects.bolt(from.x, from.y, player.x, player.y, '#ffd23f');
      player.takeCoreDamage(dmg, player.x, player.y);
      return;
    }
    const hitList = comps.sort(() => Math.random() - 0.5).slice(0, t.arcJumps);
    for (const s of hitList) {
      const p = Machine.socketPos(player, s);
      Effects.bolt(from.x, from.y, p.x, p.y, '#ffd23f');
      s.comp.hp -= dmg;
      Effects.damageNumber(p.x, p.y - 40, dmg);
      if (s.comp.hp <= 0) Machine.destroyComponent(player, s);
      from = p;
      dmg = Math.round(dmg * t.arcFalloff * 10) / 10;   // §26A: 65% per jump
    }
  }

  // §26A OVERLOAD PULSE: "disables highest-Power online module for 2.5s".
  // _forcedOffT is the ONE offline pipe (Capacitor blackout uses it too), so
  // recalcPower sees it without a new mechanism.
  _disableHighestPower(player, secs) {
    let best = null;
    for (const s of player.sockets) {
      const cmp = s.comp;
      if (!cmp || !cmp.online) continue;
      const cost = Machine.powerCostOf(player, cmp);
      if (cost <= 0) continue;
      if (!best || cost > Machine.powerCostOf(player, best.comp)) best = s;
    }
    if (!best) return;
    best.comp._forcedOffT = secs;
    Machine.recalcPower(player);
    const p = Machine.socketPos(player, best);
    Effects.comicWord('OFFLINE!', p.x, p.y - 70, CONFIG.COLOR.red, 56);
  }

  // §26A PYLON BURST: energizes 2 arena pylons for 3s; contact 16 + 10 Heat.
  // An arena with no pillars gets temporary pylons dropped at the flanks —
  // the move always means something.
  _pylonBurst(obstacles) {
    const t = this.tun;
    this.cd.pylon = t.pylonCd;
    const pillars = obstacles.filter(o => o.type === 'pillar')
      .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) -
                      Math.hypot(b.x - this.x, b.y - this.y))
      .slice(0, t.pylonCount);
    while (pillars.length < t.pylonCount) {
      const a = Math.random() * Math.PI * 2;
      const o = { type: 'pillar', x: this.x + Math.cos(a) * 420,
        y: this.y + Math.sin(a) * 420, r: 44 };
      this._dropBarrier(obstacles, o, t.pylonTime + 0.5);
      pillars.push(o);
    }
    for (const o of pillars) this._pylons.push({ o, t: t.pylonTime, hitCd: 0 });
    Effects.comicWord('PYLON BURST!', this.x, this.y - this.radius - 60, CONFIG.COLOR.yellow, 52);
  }

  _tickPylons(dt, player) {
    const t = this.tun;
    for (const p of this._pylons) {
      p.hitCd = Math.max(0, p.hitCd - dt);
      if (Math.random() < dt * 12) {
        Effects.bolt(this.x, this.y, p.o.x, p.o.y, '#ffd23f');
      }
      if (p.hitCd <= 0 && player.alive &&
          Math.hypot(player.x - p.o.x, player.y - p.o.y) < p.o.r + player.radius + 24) {
        p.hitCd = 0.8;
        player.takeCoreDamage(t.pylonDamage, player.x, player.y);
        Machine.addHeat(player, t.pylonHeat);
      }
    }
  }

  _planGridDash(player) {
    const t = this.tun;
    const legs = [];
    let a = Math.atan2(player.y - this.y, player.x - this.x);
    let px = this.x, py = this.y;
    for (let i = 0; i < t.dashCount; i++) {
      legs.push({ a, left: t.dashLen });
      // telegraph each lane as a beam zone with no damage of its own —
      // the dash body is the hazard, the lane is the warning.
      this._zone({ shape: 'beam', x: px, y: py, angle: a, len: t.dashLen,
        thick: 50, warn: 0.5, live: 0.9, color: '#ffd23f' });
      px += Math.cos(a) * t.dashLen; py += Math.sin(a) * t.dashLen;
      a += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.6);
    }
    this._dashPlan = { legs, i: 0, wait: 0.5 };
    this._enter('gridDash');
  }

  // §26A BLACKOUT FIELD: 5s reduced light, its weak-point arcs stay bright.
  _blackout() {
    this._blackoutUsed = true;
    this.blackoutT = this.tun.blackoutTime;
    Effects.comicWord('BLACKOUT!', this.x, this.y - this.radius - 90, '#9b5cff', 74);
    Effects.ring(this.x, this.y, 800, '#9b5cff');
    Camera.shake(10, 0.4);
  }

  _drawBody(ctx) {
    // Blackout: kill the lights, keep the arcs. Drawn before the body so the
    // Warden itself stays visible — §26A: "weak-point arcs remain bright".
    if (this.blackoutT > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.62)';
      ctx.fillRect(this.x - 4000, this.y - 4000, 8000, 8000);
      ctx.restore();
    }
    const wind = this.state === 'pulseWind';
    if (wind) {
      const k = this.stateT / this.tun.pulseWarn;
      R.circle(this.x, this.y, this.tun.pulseRadius, 'rgba(255,210,63,' + (0.06 + 0.10 * k) + ')',
        '#ffd23f', 4);
    }
    this._drawBodyBase(ctx, '#4d3a10', '#7a5c16', 'rgba(255,210,63,0.16)');
    // Tesla ring: rotating coil knobs.
    for (let i = 0; i < 4; i++) {
      const a = this.coilT * 2.4 + i * Math.PI / 2;
      R.circle(this.x + Math.cos(a) * this.radius * 0.95,
        this.y + Math.sin(a) * this.radius * 0.95, 16,
        this.blackoutT > 0 ? '#ffe98a' : '#ffd23f', CONFIG.COLOR.ink, 5);
    }
    R.circle(this.x, this.y, this.radius * 0.26, '#ffd23f', CONFIG.COLOR.ink, 6);
  }
}

// ===========================================================================
// WARDEN 4 — ROADBLOCK (Freight Spine). §26: armoured charge, blast doors.
// Screen 3: Ram Line, Guard Face, Barrier Drop.
// Final: + Chain Ram, Pileup.
class RoadblockWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'ROADBLOCK', tuningKey: 'roadblock', radius: 150, moveSpeed: 200 },
      x, y, phase, startHpFrac);
    this.cd.ram = 3.0; this.cd.guard = 5.0; this.cd.barrier = 7.0;
    this.cd.chain = 8.0; this.cd.pileup = 6.0;
    this._guardT = 0;
    this._guardX = 1; this._guardY = 0;
    this._chainLeft = 0;

    Machine.initSockets(this, 8);
    Machine.attach(this, 'heavyArmour', 0);
    Machine.attach(this, 'armourPlate', 2);
    Machine.attach(this, 'machineGun', 4);
    Machine.attach(this, 'heavyArmour', 6);
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'cannon', 5);
      Machine.attach(this, 'armourPlate', 3);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  // §26A GUARD FACE: frontal damage -60% while the shield is up.
  _damageIn(dmg, hx, hy) {
    if (this._guardT > 0 && hx !== undefined) {
      const ux = hx - this.x, uy = hy - this.y;
      const l = Math.hypot(ux, uy) || 1;
      const dot = (ux / l) * this._guardX + (uy / l) * this._guardY;
      if (dot > 0.3) {
        Effects.spark(hx, hy, Math.atan2(uy, ux), 3, '#8fa3c8', 320);
        return dmg * (1 - this.tun.guardReduce);
      }
    }
    return dmg;
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    if (this._guardT > 0) {
      this._guardT -= dt;
      // §26A: turn speed reduced — the guard face lags the player hard.
      const want = Math.atan2(player.y - this.y, player.x - this.x);
      const cur = Math.atan2(this._guardY, this._guardX);
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turned = cur + Math.max(-0.9 * dt, Math.min(0.9 * dt, diff));
      this._guardX = Math.cos(turned); this._guardY = Math.sin(turned);
    }
    switch (this.state) {
      case 'stalk': {
        this._stalk(dt, c, 480, 0.5);
        if (c.final && this.cd.chain <= 0 && c.d > 360) {
          this._chainLeft = t.chainCount;
          this._enter('ramWind'); break;
        }
        if (this.cd.ram <= 0 && c.d > 340) { this._chainLeft = 1; this._enter('ramWind'); break; }
        if (this.cd.guard <= 0 && c.d < 520 && this._guardT <= 0) {
          this._guardT = t.guardTime;
          this.cd.guard = t.guardCd;
          this._guardX = c.ux; this._guardY = c.uy;
          Effects.comicWord('GUARD!', this.x, this.y - this.radius - 60, '#8fa3c8', 56);
        }
        if (this.cd.barrier <= 0) { this._barrierDrop(player, obstacles); }
        if (c.final && this.cd.pileup <= 0) { this._pileup(arena); }
        break;
      }

      // ---- RAM LINE: 0.75s lane telegraph, then 780 u/s -------------------
      case 'ramWind': {
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        this.chargeX = c.ux; this.chargeY = c.uy;
        const rewarn = this._chainLeft < t.chainCount && this._chainLeft < 3;
        const warn = rewarn ? t.chainRewarn : t.ramWarn;   // §26A CHAIN RAM
        if (this.stateT > warn) {
          this._enter('ram');
          Effects.comicWord('RAM!', this.x, this.y - this.radius - 70, '#ff7a1a');
          Camera.shake(5, 0.2);
        }
        break;
      }
      case 'ram': {
        const k = 1 - Math.exp(-8 * dt);
        this.vx += (this.chargeX * t.ramSpeed - this.vx) * k;
        this.vy += (this.chargeY * t.ramSpeed - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.firingNow = false;
        if (this.hitCd <= 0 && c.d < this.radius + player.radius + 16 && player.alive) {
          this.hitCd = 0.8;
          player.takeCoreDamage(t.ramDamage, player.x, player.y);
          const kbm = player.knockbackMul !== undefined ? player.knockbackMul : 1;
          player.vx += c.ux * 1300 * kbm; player.vy += c.uy * 1300 * kbm;
          Effects.comicWord('SLAM!', player.x, player.y - 130);
          Camera.shake(11, 0.3);
        }
        if (this.stateT > 1.0) {
          this._chainLeft--;
          if (this._chainLeft > 0) { this._enter('ramWind'); }
          else {
            // one ram = the standard move; a chain = the final-phase one
            if (this.phase === WARDEN_PHASE.FINAL && this.cd.chain <= 0) this.cd.chain = t.chainCd;
            this.cd.ram = t.ramCd;
            this._enter('recover');
          }
        }
        break;
      }

      default: this._recover(dt, 1.5); break;
    }
  }

  // §26A BARRIER DROP: 2 temporary freight barriers for 8s.
  _barrierDrop(player, obstacles) {
    const t = this.tun;
    this.cd.barrier = t.barrierCd;
    const a = Math.atan2(player.y - this.y, player.x - this.x);
    for (let i = 0; i < t.barrierCount; i++) {
      const side = i === 0 ? 1 : -1;
      const bx = player.x + Math.cos(a + side * 1.25) * 330;
      const by = player.y + Math.sin(a + side * 1.25) * 330;
      const horiz = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
      this._dropBarrier(obstacles, {
        type: 'wall',
        x: bx - (horiz ? 40 : 150), y: by - (horiz ? 150 : 40),
        w: horiz ? 80 : 300, h: horiz ? 300 : 80,
      }, t.barrierTime);
    }
    Effects.comicWord('BARRIER!', this.x, this.y - this.radius - 60, '#8fa3c8', 52);
  }

  // §26A PILEUP: two moving cargo blocks across crossing lanes. Implemented
  // as moving contact zones: 25 damage + strong knockback, 0.8s per-player
  // hit throttle, gone when their run crosses the arena.
  _pileup(arena) {
    const t = this.tun;
    this.cd.pileup = t.pileupCd;
    const speed = 620;
    const zh = this._zone({
      shape: 'beam', x: arena.x - 100, y: this.y, angle: 0,
      len: 260, thick: 90, warn: 0.9, live: (arena.w + 400) / speed,
      contactDmg: t.pileupDamage, kb: 1200, color: '#ff7a1a',
      tick: (z, dt2) => { if (z.t > z.warn) z.x += speed * dt2; },
    });
    const zv = this._zone({
      shape: 'beam', x: this.x, y: arena.y - 100, angle: Math.PI / 2,
      len: 260, thick: 90, warn: 0.9, live: (arena.h + 400) / speed,
      contactDmg: t.pileupDamage, kb: 1200, color: '#ff7a1a',
      tick: (z, dt2) => { if (z.t > z.warn) z.y += speed * dt2; },
    });
    void zh; void zv;
    Effects.comicWord('PILEUP!', this.x, this.y - this.radius - 80, '#ff7a1a', 66);
  }

  _drawBody(ctx) {
    if (this.state === 'ramWind') {
      const len = 1300;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.chargeY, this.chargeX));
      ctx.fillStyle = 'rgba(255,122,26,0.28)';
      ctx.fillRect(0, -30, len, 60);
      ctx.restore();
    }
    this._drawBodyBase(ctx, '#4a2c10', '#7a4416', 'rgba(255,122,26,0.15)');
    // The plough face — the silhouette IS the move.
    const gx = this._guardT > 0 ? this._guardX : this.aimX;
    const gy = this._guardT > 0 ? this._guardY : this.aimY;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(gy, gx));
    ctx.fillStyle = this._guardT > 0 ? '#c8d6f0' : '#8fa3c8';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.55, -this.radius * 0.95);
    ctx.lineTo(this.radius * 1.35, -this.radius * 0.35);
    ctx.lineTo(this.radius * 1.35, this.radius * 0.35);
    ctx.lineTo(this.radius * 0.55, this.radius * 0.95);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    R.circle(this.x, this.y, this.radius * 0.26, '#ff7a1a', CONFIG.COLOR.ink, 6);
  }
}

// ===========================================================================
// WARDEN 5 — WARMAKER (War Depot). §26: suppression barrage, blast doors.
// Screen 3: Artillery Mark, Siege Shot, Mine Salvo.
// Final: + Fortress Lock, Suppression Fan.
class WarmakerWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'WARMAKER', tuningKey: 'warmaker', radius: 140, moveSpeed: 190 },
      x, y, phase, startHpFrac);
    this.cd.mark = 3.0; this.cd.siege = 2.5; this.cd.mine = 6.0;
    this.cd.lock = 9.0; this.cd.fan = 7.0;
    this._lockT = 0;
    this._siegeA = 0;
    this._fanBase = 0;

    Machine.initSockets(this, 8);
    Machine.attach(this, 'rocketPod', 0);
    Machine.attach(this, 'armourPlate', 2);
    Machine.attach(this, 'heavyArmour', 4);
    Machine.attach(this, 'machineGun', 6);
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'cannon', 1);
      Machine.attach(this, 'armourPlate', 5);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    if (this._lockT > 0) {
      this._lockT -= dt;
      this.speedMul = t.lockMoveMul;      // §26A: movement -60%
      if (this._lockT <= 0) this.speedMul = 1;
    }
    switch (this.state) {
      case 'stalk': {
        this._stalk(dt, c, 780, 0.55);    // artillery keeps its distance
        if (this.cd.mark <= 0) { this._artilleryMark(player); }
        if (this.cd.siege <= 0 && c.d > 420) { this._enter('siegeAim'); break; }
        if (this.cd.mine <= 0 && c.d < 700) { this._mineSalvo(player); }
        if (c.final && this.cd.lock <= 0 && this.hp < this.maxHp * 0.7 &&
            this._lockT <= 0) {
          this._fortressLock(obstacles, c);
        }
        if (c.final && this.cd.fan <= 0) { this._enter('fan'); break; }
        break;
      }

      // ---- SIEGE SHOT: 0.8s locked aim line, then the big shell -----------
      case 'siegeAim': {
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        if (this.stateT < t.siegeWarn * 0.5) {
          this._siegeA = Math.atan2(player.y - this.y, player.x - this.x);
        }                                   // the line locks halfway through
        if (this.stateT > t.siegeWarn) {
          this.cd.siege = t.siegeCd;
          this._siegeFire(player);
          this._enter('recover');
        }
        break;
      }

      // ---- SUPPRESSION FAN (final): 3 sweeping lanes over 4s, gaps remain -
      case 'fan': {
        this._steer(dt, 0, 0, 0);
        if (this.stateT === dt) this._fanBase = Math.atan2(player.y - this.y, player.x - this.x);
        this.firingNow = false;
        this._fanT = (this._fanT || 0) - dt;
        if (this._fanT <= 0) {
          this._fanT = 0.12;
          const sweep = Math.sin(this.stateT * 1.6) * 0.6;   // ±35° over the 4s
          for (let i = 0; i < t.fanLanes; i++) {
            const a = this._fanBase + (i - (t.fanLanes - 1) / 2) * 0.75 + sweep;
            const p = Projectiles.spawn(this.x + Math.cos(a) * this.radius,
              this.y + Math.sin(a) * this.radius, a, PARTS.machineGun, 'enemy', 1.2);
            void p;
          }
        }
        if (this.stateT > t.fanTime) { this.cd.fan = t.fanCd; this._enter('recover'); }
        break;
      }

      default: this._recover(dt, 1.3); break;
    }
  }

  // §26A ARTILLERY MARK: 3 circles, 1.1s warning, 30 splash each, radius 165.
  _artilleryMark(player) {
    const t = this.tun;
    this.cd.mark = t.markCd;
    for (let i = 0; i < t.markCount; i++) {
      const lead = 0.35 * i;
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : 120 + Math.random() * 160;
      this._zone({
        x: player.x + player.vx * lead + Math.cos(a) * r,
        y: player.y + player.vy * lead + Math.sin(a) * r,
        r: t.markRadius, warn: t.markWarn, dmg: t.markDamage, kb: 700,
        color: '#ff3b5a',
      });
    }
    Effects.comicWord('MARKED!', this.x, this.y - this.radius - 60, '#ff3b5a', 52);
  }

  // §26A SIEGE SHOT: 55 direct + 18 splash. Hitscan down the locked line —
  // the counter-play is the aim line, not the shell's flight.
  _siegeFire(player) {
    const t = this.tun;
    const ax = Math.cos(this._siegeA), ay = Math.sin(this._siegeA);
    Effects.explosion(this.x + ax * this.radius, this.y + ay * this.radius, 120);
    Camera.shake(12, 0.35);
    const bx = player.x - this.x, by = player.y - this.y;
    const along = bx * ax + by * ay;
    const off = Math.abs(-bx * ay + by * ax);
    let ix = this.x + ax * 1600, iy = this.y + ay * 1600;
    if (along > 0 && off < player.radius + 40 && player.alive) {
      player.takeCoreDamage(t.siegeDamage, player.x, player.y);
      ix = player.x; iy = player.y;
      Effects.comicWord('SIEGE!', player.x, player.y - 150, '#ff3b5a', 70);
    }
    // splash lands where the shell stopped
    this._zone({ x: ix, y: iy, r: t.siegeSplashR, warn: 0.01,
      dmg: t.siegeSplash, color: '#ff3b5a' });
    Effects.bolt(this.x, this.y, ix, iy, '#ffd23f');
  }

  // §26A MINE SALVO: 4 mines in a fan. Real Mine Layer mines — the part's
  // own machinery, so mine behaviour can never fork between systems.
  _mineSalvo(player) {
    const t = this.tun;
    this.cd.mine = t.mineCd;
    const base = Math.atan2(player.y - this.y, player.x - this.x);
    for (let i = 0; i < t.mineCount; i++) {
      const a = base + (i - (t.mineCount - 1) / 2) * 0.42;
      // Real Mines-system mines — the part's own machinery, so arming, radius
      // and damage can never fork between the boss and the player's layer.
      Mines.spawn(this.x + Math.cos(a) * (this.radius + 220),
        this.y + Math.sin(a) * (this.radius + 220), PARTS.mineLayer, 'enemy');
    }
    Effects.comicWord('MINES!', this.x, this.y - this.radius - 60, '#ff7a1a', 52);
  }

  // §26A FORTRESS LOCK: 5s front barrier, movement -60%, recoil -80%.
  _fortressLock(obstacles, c) {
    const t = this.tun;
    this.cd.lock = t.lockCd;
    this._lockT = t.lockTime;
    this.braceMul = 0.08;                 // recoil -80% of its normal brace
    setTimeout(() => { this.braceMul = 0.4; }, t.lockTime * 1000);
    const horiz = Math.abs(c.ux) > Math.abs(c.uy);
    this._dropBarrier(obstacles, {
      type: 'wall',
      x: this.x + c.ux * (this.radius + 90) - (horiz ? 45 : 210),
      y: this.y + c.uy * (this.radius + 90) - (horiz ? 210 : 45),
      w: horiz ? 90 : 420, h: horiz ? 420 : 90,
    }, t.lockTime);
    Effects.comicWord('FORTRESS!', this.x, this.y - this.radius - 80, '#8fa3c8', 66);
  }

  _drawBody(ctx) {
    if (this.state === 'siegeAim') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this._siegeA);
      const lock = this.stateT > this.tun.siegeWarn * 0.5;
      ctx.fillStyle = lock ? 'rgba(255,59,90,0.4)' : 'rgba(255,59,90,0.18)';
      ctx.fillRect(0, lock ? -14 : -26, 1600, lock ? 28 : 52);
      ctx.restore();
    }
    this._drawBodyBase(ctx, '#31401a', '#4c6326', 'rgba(168,232,50,0.13)');
    // Twin artillery tubes over the shoulder.
    const a = Math.atan2(this.aimY, this.aimX);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    ctx.fillStyle = this._lockT > 0 ? '#c8d6f0' : '#5c7a2e';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 8;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.rect(-this.radius * 0.2, side * this.radius * 0.45 - 20, this.radius * 1.5, 40);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    R.circle(this.x, this.y, this.radius * 0.26, '#a8e832', CONFIG.COLOR.ink, 6);
  }
}

// ===========================================================================
// WARDEN 6 — BOREMAW (Deep Cut). §26: drills new routes, collapses.
// Screen 3: Drill Charge, Harpoon Drag, Rock Spray.
// Final: + Burrow Shift, Cave-In.
class BoremawWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'BOREMAW', tuningKey: 'boremaw', radius: 145, moveSpeed: 230 },
      x, y, phase, startHpFrac);
    this.cd.drill = 3.0; this.cd.drag = 5.0; this.cd.spray = 2.0;
    this.cd.burrow = 7.0; this.cd.cave = 6.0;
    this._burrowTo = null;

    Machine.initSockets(this, 8);
    Machine.attach(this, 'drill', 0);
    Machine.attach(this, 'heavyArmour', 2);
    Machine.attach(this, 'armourPlate', 6);
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'harpoon', 4);
      Machine.attach(this, 'heavyArmour', 5);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    switch (this.state) {
      case 'stalk': {
        this._stalk(dt, c, 430, 0.6);
        if (this.cd.drill <= 0 && c.d > 300) { this._enter('drillWind'); break; }
        if (this.cd.drag <= 0 && c.d < 800 && c.d > 260) { this._harpoonDrag(player); }
        if (this.cd.spray <= 0 && c.d < 560) { this._rockSpray(player); }
        if (c.final && this.cd.burrow <= 0 && c.d > 500) {
          this._enter('burrow'); break;
        }
        if (c.final && this.cd.cave <= 0) { this._caveIn(player); }
        break;
      }

      // ---- DRILL CHARGE: 0.8s telegraph, 650 u/s, connector damage x1.5 ---
      case 'drillWind': {
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        this.chargeX = c.ux; this.chargeY = c.uy;
        if (this.stateT > t.drillWarn) {
          this._enter('drillCharge');
          Effects.comicWord('BORE!', this.x, this.y - this.radius - 70, '#d08a1e');
        }
        break;
      }
      case 'drillCharge': {
        const k = 1 - Math.exp(-8 * dt);
        this.vx += (this.chargeX * t.drillSpeed - this.vx) * k;
        this.vy += (this.chargeY * t.drillSpeed - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.firingNow = false;
        if (this.hitCd <= 0 && c.d < this.radius + player.radius + 20 && player.alive) {
          this.hitCd = 0.8;
          // §26A: 32 damage, Connector damage x1.5 — the bite goes for the
          // joint if a mounted part is in the teeth, else the hull takes it.
          const s = this._nearestComp(player);
          if (s && Math.hypot(Machine.socketPos(player, s).x - this.x,
              Machine.socketPos(player, s).y - this.y) < this.radius + 90) {
            s.comp.connectorHp -= t.drillDamage * t.drillConnMul;
            Effects.comicWord('CHEWED!', player.x, player.y - 140, '#d08a1e');
            if (s.comp.connectorHp <= 0) Machine.breakConnector(player, s);
          } else {
            player.takeCoreDamage(t.drillDamage, player.x, player.y);
          }
          const kbm = player.knockbackMul !== undefined ? player.knockbackMul : 1;
          player.vx += c.ux * 1100 * kbm; player.vy += c.uy * 1100 * kbm;
          Camera.shake(10, 0.3);
        }
        if (this.stateT > 1.1) { this.cd.drill = t.drillCd; this._enter('recover'); }
        break;
      }

      // ---- BURROW SHIFT (final): untargetable 1.2s, emerges at a mark -----
      case 'burrow': {
        this.firingNow = false;
        if (!this._burrowTo) {
          this.untargetable = true;
          // §26A: emerges at a marked EDGE.
          const edge = Math.floor(Math.random() * 4);
          const m = 260;
          this._burrowTo = {
            x: edge === 0 ? arena.x + m : edge === 1 ? arena.x + arena.w - m
              : arena.x + m + Math.random() * (arena.w - m * 2),
            y: edge < 2 ? arena.y + m + Math.random() * (arena.h - m * 2)
              : edge === 2 ? arena.y + m : arena.y + arena.h - m,
          };
          this._zone({ x: this._burrowTo.x, y: this._burrowTo.y, r: 160,
            warn: t.burrowTime, dmg: t.burrowDamage, kb: 900, color: '#d08a1e' });
          Effects.explosion(this.x, this.y, 200);
        }
        if (this.stateT > t.burrowTime) {
          this.x = this._burrowTo.x; this.y = this._burrowTo.y;
          this.vx = this.vy = 0;
          this._burrowTo = null;
          this.untargetable = false;
          this.cd.burrow = t.burrowCd;
          Effects.explosion(this.x, this.y, 260);
          Camera.shake(9, 0.3);
          this._enter('recover');
        }
        break;
      }

      default: this._recover(dt, 1.2); break;
    }
  }

  // §26A HARPOON DRAG: the REAL harpoon round — M14's tether machinery, with
  // the §26A boss figures written onto the spawned shot. Dash breaks the
  // tether (machine.js honours that for the player side).
  _harpoonDrag(player) {
    const t = this.tun;
    this.cd.drag = t.dragCd;
    const a = Math.atan2(player.y - this.y, player.x - this.x);
    const p = Projectiles.spawn(this.x + Math.cos(a) * this.radius,
      this.y + Math.sin(a) * this.radius, a, PARTS.harpoon, 'enemy', 1);
    p.damage = t.dragDamage;          // §26A: 12
    p.tether = t.dragTime;            // §26A: pulls for 1.5s
    p.tetherEnt = this;
    Effects.comicWord('DRAG!', this.x, this.y - this.radius - 60, '#ffd23f', 52);
  }

  // §26A ROCK SPRAY: 7-fragment cone, 7 damage each.
  _rockSpray(player) {
    const t = this.tun;
    this.cd.spray = t.sprayCd;
    const base = Math.atan2(player.y - this.y, player.x - this.x);
    for (let i = 0; i < t.sprayCount; i++) {
      const a = base + (i - (t.sprayCount - 1) / 2) * 0.16;
      const p = Projectiles.spawn(this.x + Math.cos(a) * this.radius,
        this.y + Math.sin(a) * this.radius, a, PARTS.scattergun, 'enemy', 1);
      p.damage = t.sprayDamage;
    }
  }

  // §26A CAVE-IN: 3 collapsing zones, 1.2s warning, 28 — and the debris stays.
  _caveIn(player) {
    const t = this.tun;
    this.cd.cave = t.caveCd;
    for (let i = 0; i < t.caveCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : 150 + Math.random() * 220;
      this._zone({ x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r,
        r: 150, warn: t.caveWarn, dmg: t.caveDamage, debris: true,
        color: '#d08a1e' });
    }
    Effects.comicWord('CAVE-IN!', this.x, this.y - this.radius - 70, '#d08a1e', 62);
    Camera.shake(7, 0.5);
  }

  _nearestComp(player) {
    let best = null, bd = 1e9;
    for (const s of player.sockets) {
      if (!s.comp) continue;
      const p = Machine.socketPos(player, s);
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  _drawBody(ctx) {
    if (this.untargetable) {     // underground: just the moving spoil
      R.circle(this.x, this.y, this.radius * 0.7, 'rgba(208,138,30,0.18)');
      for (let i = 0; i < 3; i++) {
        const a = this.coilT * 6 + i * 2.1;
        R.circle(this.x + Math.cos(a) * 60, this.y + Math.sin(a) * 60, 20,
          'rgba(74,52,24,0.5)');
      }
      return;
    }
    if (this.state === 'drillWind') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.chargeY, this.chargeX));
      ctx.fillStyle = 'rgba(208,138,30,0.26)';
      ctx.fillRect(0, -28, 1300, 56);
      ctx.restore();
    }
    this._drawBodyBase(ctx, '#4a3418', '#6e4d20', 'rgba(208,138,30,0.16)');
    // The maw: a spinning tri-cone drill nose.
    const a = Math.atan2(this.aimY, this.aimX);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    ctx.fillStyle = '#d08a1e';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.4, -this.radius * 0.8);
    ctx.lineTo(this.radius * 1.7, 0);
    ctx.lineTo(this.radius * 0.4, this.radius * 0.8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a5c14';
    const spin = this.coilT * (this.state === 'drillCharge' ? 30 : 8);
    for (let i = 0; i < 3; i++) {
      const off = ((spin + i * 0.9) % 2.7) / 2.7;
      const x0 = this.radius * (0.5 + off * 1.0);
      const h = this.radius * 0.7 * (1 - off * 0.8);
      ctx.fillRect(x0, -h / 2, 16, h);
    }
    ctx.restore();
    R.circle(this.x, this.y, this.radius * 0.26, '#d08a1e', CONFIG.COLOR.ink, 6);
  }
}

// ===========================================================================
// WARDEN 7 — CRUCIBLE (Furnace Mile). §26: heat, smelt, pour.
// Screen 3: Flame Sweep, Heat Pulse, Vent Burst.
// Final: + Molten Pour, Smelt Field.
class CrucibleWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'CRUCIBLE', tuningKey: 'crucible', radius: 150, moveSpeed: 180 },
      x, y, phase, startHpFrac);
    this.cd.sweep = 4.0; this.cd.pulse = 5.0; this.cd.vent = 3.0;
    this.cd.pour = 7.0; this.cd.smelt = 9.0;
    this._sweepA = 0;
    this._sweepDir = 1;
    this._smeltT = 0;

    Machine.initSockets(this, 8);
    Machine.attach(this, 'flamethrower', 0);
    Machine.attach(this, 'heavyArmour', 2);
    Machine.attach(this, 'armourPlate', 4);
    Machine.attach(this, 'radiator', 6);
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'flamethrower', 5);
      Machine.attach(this, 'heavyArmour', 3);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    if (this._smeltT > 0) {
      this._smeltT -= dt;
      this._cdMul = 1 / t.smeltRateMul;   // §26A: attack rate +15%
      // §26A: player cooling -60% inside the aura — refreshed while it runs.
      if (player.alive) {
        player._coolCutT = Math.max(player._coolCutT || 0, 0.2);
        player._coolCutMul = t.smeltCoolMul;
      }
      if (this._smeltT <= 0) this._cdMul = 1;
    }
    switch (this.state) {
      case 'stalk': {
        this._stalk(dt, c, 420, 0.5);     // a furnace walks at you
        if (this.cd.sweep <= 0 && c.d < t.sweepRange + 120) {
          this._sweepA = Math.atan2(player.y - this.y, player.x - this.x) - 1.2;
          this._sweepDir = Math.random() < 0.5 ? 1 : -1;
          this._enter('flameSweep'); break;
        }
        if (this.cd.pulse <= 0 && c.d < t.pulseRadius * 0.85) { this._heatPulse(player); }
        if (this.cd.vent <= 0 && c.d < 640) { this._ventBurst(); }
        if (c.final && this.cd.pour <= 0) { this._moltenPour(player, arena); }
        if (c.final && this.cd.smelt <= 0 && this._smeltT <= 0) { this._smeltField(); }
        break;
      }

      // ---- FLAME SWEEP: a 3.5s rotating arc of fire -----------------------
      case 'flameSweep': {
        this._steer(dt, c.ux * 0.3, c.uy * 0.3, c.speed * 0.4);
        this.firingNow = false;
        this._sweepA += this._sweepDir * dt * 1.1;
        // The arc IS a beam zone recreated each frame — cheap, and the zone
        // pipe owns the damage arithmetic (chunked DPS + heat).
        this._sweepZone = this._sweepZone && !this._sweepZone.dead ? this._sweepZone
          : this._zone({ shape: 'beam', x: this.x, y: this.y, angle: this._sweepA,
              len: t.sweepRange, thick: 70, warn: 0, live: 0.2,
              dps: t.sweepDps, heatPs: t.sweepHeatPs, color: '#ff7a1a' });
        this._sweepZone.x = this.x; this._sweepZone.y = this.y;
        this._sweepZone.angle = this._sweepA;
        this._sweepZone.t = Math.min(this._sweepZone.t, 0.1);   // keep it alive
        if (Math.random() < dt * 30) {
          const rr = 120 + Math.random() * (t.sweepRange - 120);
          Effects.spark(this.x + Math.cos(this._sweepA) * rr,
            this.y + Math.sin(this._sweepA) * rr, this._sweepA, 2, '#ff7a1a', 300);
        }
        if (this.stateT > t.sweepTime) {
          if (this._sweepZone) this._sweepZone.dead = true;
          this._sweepZone = null;
          this.cd.sweep = t.sweepCd;
          this._enter('recover');
        }
        break;
      }

      default: this._recover(dt, 1.2); break;
    }
  }

  // §26A HEAT PULSE: radius 500, +25 Heat, 10 damage.
  _heatPulse(player) {
    const t = this.tun;
    this.cd.pulse = t.pulseCd;
    this._zone({ x: this.x, y: this.y, r: t.pulseRadius, warn: t.pulseWarn,
      dmg: t.pulseDamage, heat: t.pulseHeat, color: '#ff3b5a',
      tick: (z) => { z.x = this.x; z.y = this.y; } });
    Effects.comicWord('HEAT PULSE!', this.x, this.y - this.radius - 60, '#ff3b5a', 56);
  }

  // §26A VENT BURST: 6 radial jets, 14 damage + 15 Heat.
  _ventBurst() {
    const t = this.tun;
    this.cd.vent = t.ventCd;
    const off = Math.random() * Math.PI * 2;
    for (let i = 0; i < t.ventJets; i++) {
      const a = off + (i / t.ventJets) * Math.PI * 2;
      this._zone({ shape: 'beam', x: this.x, y: this.y, angle: a, len: 520,
        thick: 46, warn: t.ventWarn, dmg: t.ventDamage, heat: t.ventHeat,
        color: '#ff7a1a',
        tick: (z) => { if (z.t < z.warn) { z.x = this.x; z.y = this.y; } } });
    }
    Effects.comicWord('VENT!', this.x, this.y - this.radius - 60, '#ff7a1a', 52);
  }

  // §26A MOLTEN POUR: 2 molten lanes for 5s — 10 DPS + 8 Heat/s.
  _moltenPour(player, arena) {
    const t = this.tun;
    this.cd.pour = t.pourCd;
    for (let i = 0; i < t.pourLanes; i++) {
      const horiz = Math.random() < 0.5;
      const y = player.y + (Math.random() - 0.5) * 500;
      const x = player.x + (Math.random() - 0.5) * 500;
      this._zone({
        shape: 'beam',
        x: horiz ? arena.x : x, y: horiz ? y : arena.y,
        angle: horiz ? 0 : Math.PI / 2,
        len: horiz ? arena.w : arena.h, thick: 80,
        warn: 0.9, live: t.pourTime,
        dps: t.pourDps, heatPs: t.pourHeatPs, color: '#ff5c1a',
      });
    }
    Effects.comicWord('MOLTEN POUR!', this.x, this.y - this.radius - 80, '#ff5c1a', 66);
  }

  // §26A SMELT FIELD: 4s aura — player cooling -60%, Crucible +15% rate.
  _smeltField() {
    const t = this.tun;
    this.cd.smelt = t.smeltCd;
    this._smeltT = t.smeltTime;
    Effects.comicWord('SMELT FIELD!', this.x, this.y - this.radius - 90, '#ff3b5a', 70);
    Effects.ring(this.x, this.y, 700, '#ff3b5a');
  }

  _drawBody(ctx) {
    if (this._smeltT > 0) {
      R.circle(this.x, this.y, 700, 'rgba(255,59,90,0.07)', '#ff3b5a', 3);
    }
    this._drawBodyBase(ctx, '#4d1a10', '#7a2a16', 'rgba(255,92,26,0.18)');
    // Furnace grate: glowing slats that brighten with the fight.
    const glow = 0.6 + 0.4 * Math.sin(this.coilT * 5);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.aimY, this.aimX));
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = 'rgba(255,' + Math.floor(90 + glow * 120) + ',26,' +
        (0.5 + glow * 0.5) + ')';
      ctx.fillRect(this.radius * 0.15, i * 26 - 8, this.radius * 0.85, 16);
    }
    ctx.restore();
    R.circle(this.x, this.y, this.radius * 0.26,
      glow > 0.8 ? '#ffd23f' : '#ff5c1a', CONFIG.COLOR.ink, 6);
  }
}

// ===========================================================================
// WARDEN 8 — PATCHWORK (Proving Ground). §26: copies, adapts, mutates.
// Screen 3: Scan Copy, Salvage Swap, Test Burst.
// Final: + Adapt Stance, Mutate Rebuild (once, at 35%).
class PatchworkWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'PATCHWORK', tuningKey: 'patchwork', radius: 135, moveSpeed: 260 },
      x, y, phase, startHpFrac);
    this.cd.scan = 4.0; this.cd.swap = 6.0; this.cd.test = 3.0; this.cd.stance = 6.0;
    this._copy = null;              // { socketId, t } — the borrowed weapon
    this._mutated = false;
    this._stance = null;            // 'RUSH' | 'KITE' | 'GUARD'
    this._stanceT = 0;

    Machine.initSockets(this, 8);
    Machine.attach(this, 'machineGun', 0);
    Machine.attach(this, 'armourPlate', 2);
    Machine.attach(this, 'repairArm', 4);
    Machine.attach(this, 'armourPlate', 6);
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'scattergun', 5);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    // Copy expiry: the borrowed weapon evaporates, socket freed.
    if (this._copy) {
      this._copy.t -= dt;
      const s = this.sockets.find(x => x.id === this._copy.socketId);
      if (!s || !s.comp) this._copy = null;
      else if (this._copy.t <= 0) {
        Machine.detachSilent(this, s.id);
        Effects.spark(this.x, this.y, 0, 8, '#9b5cff', 320);
        this._copy = null;
      }
    }
    if (this._stanceT > 0) {
      this._stanceT -= dt;
      if (this._stanceT <= 0) { this._stance = null; this.speedMul = 1; }
    }
    // §26A MUTATE REBUILD: once, at 35% — eject the two most damaged
    // modules and bolt on two arena-cache parts at 60%.
    if (c.final && !this._mutated && this.hp <= this.maxHp * t.mutateAt) {
      this._mutateRebuild();
    }
    switch (this.state) {
      case 'stalk': {
        const want = this._stance === 'RUSH' ? 200
          : this._stance === 'KITE' ? 820 : 520;
        this._stalk(dt, c, want, this._stance === 'KITE' ? 1.1 : 0.75);
        if (this.cd.scan <= 0 && !this._copy && this._playerBestWeapon(player)) {
          this._enter('scan'); break;
        }
        if (this.cd.swap <= 0) { this._salvageSwap(); }
        if (this.cd.test <= 0) { this._testBurst(player); }
        if (c.final && this.cd.stance <= 0 && !this._stance) {
          this._adaptStance(player, c);
        }
        break;
      }

      // ---- SCAN COPY: 1.0s scan, then it carries YOUR best weapon ---------
      case 'scan': {
        this._steer(dt, -c.ux * 0.3, -c.uy * 0.3, c.speed * 0.4);
        this.firingNow = false;
        if (Math.random() < dt * 14) Effects.bolt(this.x, this.y, player.x, player.y, '#9b5cff');
        if (this.stateT > t.scanTime) {
          this.cd.scan = t.scanCd;
          const bestPart = this._playerBestWeapon(player);
          const free = this.sockets.find(s => !s.comp);
          if (bestPart && free) {
            // G1-equivalent output: a plain attach IS Grade 1.
            const idx = Machine.attach(this, bestPart.id, free.id);
            if (idx >= 0) {
              this._copy = { socketId: free.id, t: t.copyTime };
              Effects.comicWord('COPIED: ' + bestPart.name + '!',
                this.x, this.y - this.radius - 80, '#9b5cff', 62);
            }
          }
          this._enter('recover');
        }
        break;
      }

      default: this._recover(dt, 1.0); break;
    }
  }

  // Player's highest-damage standard weapon family — damage counted where it
  // lives (test_balance's lesson: mine, fragments, wave — not just the shell).
  _playerBestWeapon(player) {
    let best = null, bestDps = 0;
    for (const s of player.sockets) {
      if (!s.comp || s.comp.part.category !== 'weapon') continue;
      const p = s.comp.part;
      let dps = 0;
      if (p.dps) dps = p.dps;
      else if (p.flak) dps = (p.fragments || 0) * (p.fragDamage || 0) * (p.fireRate || 1);
      else if (p.wave) dps = (p.damage || 20) / 2;
      else if (p.mine) dps = (p.damage || 0) * 0.8;
      else dps = ((p.damage || 0) + (p.splashDamage || 0)) * (p.fireRate || 1) *
        (p.burst || 1);
      if (dps > bestDps) { bestDps = dps; best = p; }
    }
    return best;
  }

  // §26A SALVAGE SWAP: nearest legal loose part replaces its most damaged
  // module. The floor is its spare-parts bin.
  _salvageSwap() {
    const t = this.tun;
    this.cd.swap = t.swapCd;
    const near = LooseParts.nearest ? LooseParts.nearest(this.x, this.y, 1100) : null;
    if (!near) return;
    let worst = null;
    for (const s of this.sockets) {
      if (!s.comp) continue;
      if (this._copy && s.id === this._copy.socketId) continue;
      if (!worst || s.comp.hp / s.comp.maxHp < worst.comp.hp / worst.comp.maxHp) worst = s;
    }
    if (!worst || worst.comp.hp / worst.comp.maxHp > 0.75) return;   // nothing worth swapping
    LooseParts.remove(near);
    Machine.detachSilent(this, worst.id);
    const idx = Machine.attach(this, near.part.id, worst.id);
    if (idx >= 0) {
      Effects.comicWord('SWAP!', this.x, this.y - this.radius - 60, '#9b5cff', 54);
    }
  }

  // §26A TEST BURST: three Proving Ground hazard pulses, readable telegraphs.
  _testBurst(player) {
    const t = this.tun;
    this.cd.test = t.testCd;
    for (let i = 0; i < t.testCount; i++) {
      const kind = Math.floor(Math.random() * 3);
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : 140 + Math.random() * 200;
      const zx = player.x + Math.cos(a) * r, zy = player.y + Math.sin(a) * r;
      if (kind === 0) {          // Test Laser: a line, 18
        this._zone({ shape: 'beam', x: zx - Math.cos(a) * 700, y: zy - Math.sin(a) * 700,
          angle: a, len: 1400, thick: 40, warn: 0.75, dmg: 18, color: '#9b5cff' });
      } else if (kind === 1) {   // Arc pulse: a circle, 16 + a little heat
        this._zone({ x: zx, y: zy, r: 200, warn: 0.9, dmg: 16, heat: 8,
          color: '#9b5cff' });
      } else {                   // Prototype Pulse: forces a module offline 1s
        this._zone({ x: zx, y: zy, r: 220, warn: 1.0, dmg: 0, color: '#22d9ff',
          onHit: (pl) => {
            const on = pl.sockets.filter(s => s.comp && s.comp.online &&
              Machine.powerCostOf(pl, s.comp) > 0);
            if (!on.length) return;
            const pick = on[Math.floor(Math.random() * on.length)];
            pick.comp._forcedOffT = 1.0;
            Machine.recalcPower(pl);
          } });
      }
    }
    Effects.comicWord('TEST BURST!', this.x, this.y - this.radius - 60, '#9b5cff', 54);
  }

  // §26A ADAPT STANCE: RUSH / KITE / GUARD, from range and weapon mix.
  _adaptStance(player, c) {
    const t = this.tun;
    this.cd.stance = t.stanceCd;
    this._stanceT = t.stanceTime;
    const melee = player.sockets.some(s => s.comp &&
      s.comp.part.dps !== undefined && !s.comp.part.beam);
    const longR = player.sockets.some(s => s.comp &&
      (s.comp.part.id === 'railgun' || s.comp.part.id === 'beamLaser' ||
       s.comp.part.id === 'mortar'));
    this._stance = melee ? 'KITE' : (longR && c.d > 600 ? 'RUSH' : 'GUARD');
    this.speedMul = this._stance === 'RUSH' ? 1.2 : 1;
    Effects.comicWord(this._stance + '!', this.x, this.y - this.radius - 80,
      '#9b5cff', 64);
  }

  _mutateRebuild() {
    const t = this.tun;
    this._mutated = true;
    const damaged = this.sockets.filter(s => s.comp)
      .sort((a, b) => a.comp.hp / a.comp.maxHp - b.comp.hp / b.comp.maxHp)
      .slice(0, 2);
    const cache = ['scattergun', 'armourPlate'];   // the arena cache (tune)
    let i = 0;
    for (const s of damaged) {
      const pos = Machine.socketPos(this, s);
      LooseParts.spawn(s.comp.part.id, Math.max(0.1, s.comp.hp / s.comp.maxHp),
        pos.x, pos.y, Math.cos(s.angle) * 380, Math.sin(s.angle) * 380);
      Machine.detachSilent(this, s.id);
      const idx = Machine.attach(this, cache[i++ % cache.length], s.id);
      if (idx >= 0) {
        const ns = Machine.getSocket(this, idx);
        if (ns && ns.comp) ns.comp.hp = ns.comp.maxHp * t.mutateHp;
      }
    }
    Effects.comicWord('MUTATE!', this.x, this.y - this.radius - 90, '#9b5cff', 74);
    Effects.ring(this.x, this.y, 420, '#9b5cff');
    Camera.shake(9, 0.4);
  }

  _drawBody(ctx) {
    this._drawBodyBase(ctx, '#33204d', '#4d3173', 'rgba(155,92,255,0.16)');
    // Patch plates: mismatched hull squares — it is built from everyone else.
    const cols = ['#6b2a3f', '#2b4416', '#4a3418', '#1d5f7a'];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.coilT * 0.3);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cols[i];
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 5;
      const a = i * Math.PI / 2 + 0.4;
      const px = Math.cos(a) * this.radius * 0.62;
      const py = Math.sin(a) * this.radius * 0.62;
      ctx.fillRect(px - 22, py - 22, 44, 44);
      ctx.strokeRect(px - 22, py - 22, 44, 44);
    }
    ctx.restore();
    R.circle(this.x, this.y, this.radius * 0.26,
      this._stance ? '#d8b4ff' : '#9b5cff', CONFIG.COLOR.ink, 6);
  }
}

// ===========================================================================
// WARDEN 9 — BAILIFF (Crown Gate). §26: lockdown, seizure, enforcement.
// Screen 3: Lockdown Field, Seizure Pulse, Shield Line.
// Final: + Laser Grid, Enforcement Call.
class BailiffWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'BAILIFF', tuningKey: 'bailiff', radius: 155, moveSpeed: 210 },
      x, y, phase, startHpFrac);
    this.cd.lock = 3.0; this.cd.seize = 5.0; this.cd.wall = 6.0;
    this.cd.grid = 7.0; this.cd.call = 9.0;
    this._adds = [];

    Machine.initSockets(this, 8);
    Machine.attach(this, 'directionalShield', 0);
    Machine.attach(this, 'machineGun', 2);
    Machine.attach(this, 'heavyArmour', 4);
    Machine.attach(this, 'machineGun', 6);
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'cannon', 5);
      Machine.attach(this, 'armourPlate', 3);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    switch (this.state) {
      case 'stalk': {
        this._stalk(dt, c, 560, 0.6);
        if (this.cd.lock <= 0 && c.d < 900) { this._lockdown(player); }
        if (this.cd.seize <= 0 && c.d < 800) { this._seizurePulse(player); }
        if (this.cd.wall <= 0 && c.d < 640) { this._shieldLine(obstacles, c); }
        if (c.final && this.cd.grid <= 0) { this._laserGrid(player); }
        if (c.final && this.cd.call <= 0 &&
            this._aliveAdds() < t.callMax) { this._enforcementCall(); }
        break;
      }
      default: this._recover(dt, 1.1); break;
    }
  }

  // §26A LOCKDOWN FIELD: radius 400 for 2.5s, movement -30% inside.
  _lockdown(player) {
    const t = this.tun;
    this.cd.lock = t.lockCd;
    this._zone({ x: player.x, y: player.y, r: t.lockRadius, warn: 0.5,
      live: t.lockTime, slowMul: t.lockSlowMul, color: '#22d9ff' });
    Effects.comicWord('LOCKDOWN!', this.x, this.y - this.radius - 60, '#22d9ff', 58);
  }

  // §26A SEIZURE PULSE: one online, powered, NON-EMERGENCY module off for 3s.
  _seizurePulse(player) {
    const t = this.tun;
    this.cd.seize = t.seizeCd;
    const candidates = player.sockets.filter(s => s.comp && s.comp.online &&
      Machine.powerCostOf(player, s.comp) > 0 &&
      s.comp.part.id !== 'emergencyVent');   // §26A: non-emergency
    if (!candidates.length) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    pick.comp._forcedOffT = t.seizeTime;
    Machine.recalcPower(player);
    const p = Machine.socketPos(player, pick);
    Effects.bolt(this.x, this.y, p.x, p.y, '#ffd23f');
    Effects.comicWord('SEIZED!', p.x, p.y - 80, CONFIG.COLOR.red, 60);
  }

  // §26A SHIELD LINE: a frontal barrier wall for 4s.
  _shieldLine(obstacles, c) {
    const t = this.tun;
    this.cd.wall = t.wallCd;
    const horiz = Math.abs(c.ux) > Math.abs(c.uy);
    this._dropBarrier(obstacles, {
      type: 'wall',
      x: this.x + c.ux * (this.radius + 110) - (horiz ? 40 : 260),
      y: this.y + c.uy * (this.radius + 110) - (horiz ? 260 : 40),
      w: horiz ? 80 : 520, h: horiz ? 520 : 80,
    }, t.wallTime);
    Effects.comicWord('SHIELD LINE!', this.x, this.y - this.radius - 60, '#8fa3c8', 54);
  }

  // §26A LASER GRID: 3 telegraphed crossing security beams, 20 each.
  _laserGrid(player) {
    const t = this.tun;
    this.cd.grid = t.gridCd;
    for (let i = 0; i < t.gridBeams; i++) {
      const a = (i / t.gridBeams) * Math.PI + Math.random() * 0.4;
      this._zone({ shape: 'beam',
        x: player.x - Math.cos(a) * 900, y: player.y - Math.sin(a) * 900,
        angle: a, len: 1800, thick: 34, warn: t.gridWarn, dmg: t.gridDamage,
        color: '#ff3b5a' });
    }
    Effects.comicWord('LASER GRID!', this.x, this.y - this.radius - 70, '#ff3b5a', 60);
  }

  // §26A ENFORCEMENT CALL: 2 security adds, hard max 2.
  _enforcementCall() {
    const t = this.tun;
    this.cd.call = t.callCd;
    const room = t.callMax - this._aliveAdds();
    for (let i = 0; i < Math.min(t.callCount, room); i++) {
      const a = Math.random() * Math.PI * 2;
      const e = this._spawnAdd(this.x + Math.cos(a) * (this.radius + 120),
        this.y + Math.sin(a) * (this.radius + 120),
        [['machineGun', 0], ['armourPlate', 2]], 'strafer', 'medium');
      this._adds.push(e);
    }
    Effects.comicWord('ENFORCEMENT!', this.x, this.y - this.radius - 80, '#ffd23f', 62);
  }

  _drawBody(ctx) {
    this._drawBodyBase(ctx, '#1a2b4d', '#28417a', 'rgba(64,120,255,0.16)');
    // The badge: a heavy chevron plate.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.aimY, this.aimX) + Math.PI / 2);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 7;
    for (let i = 0; i < 2; i++) {
      const o = i * 34;
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.45, -this.radius * 0.15 + o);
      ctx.lineTo(0, -this.radius * 0.5 + o);
      ctx.lineTo(this.radius * 0.45, -this.radius * 0.15 + o);
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
    }
    ctx.restore();
    R.circle(this.x, this.y, this.radius * 0.26, '#4078ff', CONFIG.COLOR.ink, 6);
  }
}

// ===========================================================================
// WARDEN 10 — KINGMAKER (Crown Forge). §26: design, correction, disassembly.
// Screen 3: Design Salvo, Correction Mark, Salvage Claim.
// Final: + Disassembly Rip, Rebuild, Singularity.
class KingmakerWarden extends WardenBase {
  constructor(x, y, phase = WARDEN_PHASE.FIRST, startHpFrac = 1) {
    super({ name: 'KINGMAKER', tuningKey: 'kingmaker', radius: 165, moveSpeed: 240 },
      x, y, phase, startHpFrac);
    this.cd.salvo = 2.5; this.cd.mark = 5.0; this.cd.claim = 6.0;
    this.cd.rip = 8.0; this.cd.sing = 10.0;
    this._markTarget = null;
    this._ripTarget = null;
    this._singT = 0;

    // §27: "boss builds up to 18 modules" on Map 10 — the Kingmaker IS the
    // map-10 boss build. Twelve sockets; the complete machine mounts ten.
    Machine.initSockets(this, 12);
    Machine.attach(this, 'railgun', 0);
    Machine.attach(this, 'cannon', 2);
    Machine.attach(this, 'rocketPod', 4);
    Machine.attach(this, 'heavyArmour', 6);
    if (phase === WARDEN_PHASE.FINAL) {
      Machine.attach(this, 'magnetAmplifier', 5);
      Machine.attach(this, 'heavyArmour', 3);
      // The shell it built for the REMATCH — everything Crown knows (§25
      // "hardest fight Crown can build"). Slots 8-11 are the crown plating.
      Machine.attach(this, 'pointDefence', 8);
      Machine.attach(this, 'reactiveArmour', 9);
      Machine.attach(this, 'heavyArmour', 10);
      Machine.attach(this, 'machineGun', 11);
      for (const s of this.sockets) {
        if (s.comp) s.comp.hp = s.comp.maxHp * (0.55 + Math.random() * 0.35);
      }
    }
  }

  _brain(dt, player, arena, obstacles, c) {
    const t = this.tun;
    if (this._singT > 0) this._tickSingularity(dt, player, arena);
    switch (this.state) {
      case 'stalk': {
        this._stalk(dt, c, 620, 0.7);
        this.firingNow = false;           // it fires by DESIGN, not by trigger
        if (this.cd.salvo <= 0) { this._designSalvo(player, c); }
        if (this.cd.mark <= 0 && c.d < 900) { this._enter('markWind'); break; }
        if (this.cd.claim <= 0) { this._salvageClaim(); }
        if (c.final && this.cd.rip <= 0 && this._findRipTarget(player)) {
          this._enter('rip'); break;
        }
        if (c.final && this.cd.sing <= 0 && this._singT <= 0 &&
            this.hp < this.maxHp * 0.5) {          // final phase (tune)
          this._enter('singWind'); break;
        }
        break;
      }

      // ---- CORRECTION MARK: 1.0s on the weakest connector, then armed -----
      case 'markWind': {
        this._steer(dt, 0, 0, 0);
        if (this.stateT === dt || !this._markTarget) {
          this._markTarget = this._weakestConnector(player);
        }
        if (!this._markTarget || !this._markTarget.comp) {
          this.cd.mark = 3.0; this._enter('stalk'); break;
        }
        const p = Machine.socketPos(player, this._markTarget);
        if (Math.random() < dt * 12) Effects.bolt(this.x, this.y, p.x, p.y, '#ffd23f');
        if (this.stateT > t.markWarn) {
          // machine.js consumes this at the ONE connector-damage site:
          // the next hit on this connector lands at x1.4 (§26A).
          this._markTarget.comp._correctionArmed = true;
          Effects.comicWord('CORRECTION!', p.x, p.y - 90, '#ffd23f', 58);
          this._markTarget = null;
          this.cd.mark = t.markCd;
          this._enter('stalk');
        }
        break;
      }

      // ---- DISASSEMBLY RIP (final): magnet channel on a critical joint ----
      case 'rip': {
        this._steer(dt, c.ux * 0.3, c.uy * 0.3, c.speed * 0.3);
        this.firingNow = false;
        const s = this._ripTarget;
        // §26A: interruptible — displaced, target gone, or joint no longer
        // critical, and the channel is wasted.
        if (!s || !s.comp || c.d > 700 ||
            s.comp.connectorHp / s.comp.maxConnectorHp >= t.ripBelow) {
          this._ripTarget = null; this.cd.rip = 4.0; this._enter('stalk'); break;
        }
        const p = Machine.socketPos(player, s);
        if (Math.random() < dt * 16) Effects.bolt(this.x, this.y, p.x, p.y, '#ff3fa4');
        if (this.stateT > t.ripChannel) {
          // Rips the module INTACT — and REBUILD bolts it straight on.
          const partId = s.comp.part.id;
          const frac = s.comp.hp / s.comp.maxHp;
          Machine.detachSilent(player, s.id);
          Machine.recalcPower(player);
          const free = this.sockets.find(x => !x.comp);
          if (free) {
            const idx = Machine.attach(this, partId, free.id);
            if (idx >= 0) {
              const ns = Machine.getSocket(this, idx);
              if (ns && ns.comp) ns.comp.hp = ns.comp.maxHp * Math.max(0.2, frac);
            }
            Effects.comicWord('DISASSEMBLED!', p.x, p.y - 100, '#ff3fa4', 70);
          } else {
            LooseParts.spawn(partId, frac, this.x, this.y, 0, 0);
          }
          Camera.shake(10, 0.4);
          this._ripTarget = null;
          this.cd.rip = t.ripCd;
          this._enter('recover');
        }
        break;
      }

      // ---- SINGULARITY (final phase): 1.2s centre telegraph, 4s pull ------
      case 'singWind': {
        this._steer(dt, 0, 0, 0);
        this.firingNow = false;
        if (this.stateT > t.singWarn) {
          this.cd.sing = t.singCd;
          this._singT = t.singTime;
          Effects.comicWord('SINGULARITY!', this.x, this.y - this.radius - 100,
            '#9b5cff', 80);
          Effects.ring(this.x, this.y, 900, '#9b5cff');
          Camera.shake(12, 0.5);
          this._enter('stalk');
        }
        break;
      }

      default: this._recover(dt, 1.2); break;
    }
  }

  // §26A DESIGN SALVO: optimized Rail/Cannon/Rocket patterns by range —
  // fired from its REAL mounted parts, so shooting one off removes that
  // pattern from the fight. The player can disarm the design.
  _designSalvo(player, c) {
    const t = this.tun;
    this.cd.salvo = t.salvoCd;
    const has = id => this.sockets.find(s => s.comp && s.comp.part.id === id);
    const a = Math.atan2(player.y - this.y, player.x - this.x);
    let used = null;
    if (c.d > 750 && has('railgun')) {
      used = 'railgun';
      const p = Projectiles.spawn(this.x + Math.cos(a) * this.radius,
        this.y + Math.sin(a) * this.radius, a, PARTS.railgun, 'enemy', 1);
      void p;
    } else if (c.d > 380 && has('cannon')) {
      used = 'cannon';
      for (const off of [-0.09, 0.09]) {
        Projectiles.spawn(this.x + Math.cos(a) * this.radius,
          this.y + Math.sin(a) * this.radius, a + off, PARTS.cannon, 'enemy', 1);
      }
    } else if (has('rocketPod')) {
      used = 'rocketPod';
      for (let i = 0; i < 3; i++) {
        Projectiles.spawn(this.x + Math.cos(a) * this.radius,
          this.y + Math.sin(a) * this.radius,
          a + (i - 1) * 0.35, PARTS.rocketPod, 'enemy', 1);
      }
    }
    if (used) Effects.comicWord('DESIGN!', this.x, this.y - this.radius - 60,
      '#ffd23f', 50);
  }

  _weakestConnector(player) {
    let best = null;
    for (const s of player.sockets) {
      if (!s.comp) continue;
      if (!best || s.comp.connectorHp < best.comp.connectorHp) best = s;
    }
    return best;
  }

  // §26A: only a connector already below 25%.
  _findRipTarget(player) {
    for (const s of player.sockets) {
      if (s.comp && s.comp.connectorHp / s.comp.maxConnectorHp < this.tun.ripBelow) {
        this._ripTarget = s;
        return s;
      }
    }
    return null;
  }

  // §26A SALVAGE CLAIM: pulls and attaches a legal loose module at 70%.
  _salvageClaim() {
    const t = this.tun;
    this.cd.claim = t.claimCd;
    const free = this.sockets.find(s => !s.comp);
    if (!free) return;
    const near = LooseParts.nearest ? LooseParts.nearest(this.x, this.y, 1300) : null;
    if (!near) return;
    LooseParts.remove(near);
    const idx = Machine.attach(this, near.part.id, free.id);
    if (idx >= 0) {
      const s = Machine.getSocket(this, idx);
      if (s && s.comp) s.comp.hp = s.comp.maxHp * t.claimHp;
      Effects.comicWord('CLAIMED!', this.x, this.y - this.radius - 60, '#ffd23f', 54);
    }
  }

  // §26A SINGULARITY: player pulled 180 u/s, salvage x3, shots bend inward.
  _tickSingularity(dt, player, arena) {
    const t = this.tun;
    this._singT -= dt;
    const cx = this.x, cy = this.y;
    if (player.alive) {
      const d = Math.hypot(player.x - cx, player.y - cy) || 1;
      player.x -= (player.x - cx) / d * t.singPull * dt;
      player.y -= (player.y - cy) / d * t.singPull * dt;
    }
    for (const it of (LooseParts.items || [])) {
      const d = Math.hypot(it.x - cx, it.y - cy) || 1;
      it.x -= (it.x - cx) / d * t.singPull * t.singSalvageMul * dt;
      it.y -= (it.y - cy) / d * t.singPull * t.singSalvageMul * dt;
    }
    // hostile AND friendly projectiles bend toward the centre (§26A)
    for (const p of Projectiles.pool) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - cx, p.y - cy) || 1;
      const bend = 900 * dt;
      p.vx -= (p.x - cx) / d * bend;
      p.vy -= (p.y - cy) / d * bend;
    }
    if (Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2;
      const rr = 300 + Math.random() * 500;
      Effects.spark(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr,
        a + Math.PI, 1, '#9b5cff', 520);
    }
  }

  _drawBody(ctx) {
    if (this.state === 'singWind' || this._singT > 0) {
      const k = this._singT > 0 ? 0.5 + 0.5 * Math.sin(this.coilT * 8) : 0.8;
      R.circle(this.x, this.y, 900, 'rgba(155,92,255,' + (0.05 + 0.05 * k) + ')',
        '#9b5cff', 4);
    }
    this._drawBodyBase(ctx, '#3d3210', '#66531a', 'rgba(255,210,63,0.18)');
    // The crown. It is the KINGMAKER.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.coilT * 0.5);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 7;
    const pts = 5;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const rr = i % 2 === 0 ? this.radius * 0.95 : this.radius * 0.62;
      const a = (i / (pts * 2)) * Math.PI * 2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    R.circle(this.x, this.y, this.radius * 0.30, '#fff3c4', CONFIG.COLOR.ink, 8);
  }
}

// ---------------------------------------------------------------------------
// The roster. RECLAIMER registers itself from warden.js (loaded after this).
Wardens.register('STITCHER', StitcherWarden);
Wardens.register('DYNAMO', DynamoWarden);
Wardens.register('ROADBLOCK', RoadblockWarden);
Wardens.register('WARMAKER', WarmakerWarden);
Wardens.register('BOREMAW', BoremawWarden);
Wardens.register('CRUCIBLE', CrucibleWarden);
Wardens.register('PATCHWORK', PatchworkWarden);
Wardens.register('BAILIFF', BailiffWarden);
Wardens.register('KINGMAKER', KingmakerWarden);

// SCRAPCORE: BREAKLANDS — Enemy (Milestone 13: all six AI brains, plan §39)
// An enemy is never a hand-designed monster. It is always:
//     Enemy Core + AI Brain + Socket Count + Component Loadout   (plan §38)
// It uses the exact same Machine/socket/connector code as the player, so any
// part on any enemy can be shot off, ripped free, stolen and used.

// Shared circle-vs-world collision (same rules as the player Core).
function collideCircleWorld(ent, arena, obstacles) {
  const r = ent.radius;
  if (ent.x < arena.x + r) { ent.x = arena.x + r; ent.vx = Math.max(0, ent.vx); }
  if (ent.x > arena.x + arena.w - r) { ent.x = arena.x + arena.w - r; ent.vx = Math.min(0, ent.vx); }
  if (ent.y < arena.y + r) { ent.y = arena.y + r; ent.vy = Math.max(0, ent.vy); }
  if (ent.y > arena.y + arena.h - r) { ent.y = arena.y + arena.h - r; ent.vy = Math.min(0, ent.vy); }

  for (const o of obstacles) {
    if (o.type === 'pillar') {
      const dx = ent.x - o.x, dy = ent.y - o.y;
      const d = Math.hypot(dx, dy), min = r + o.r;
      if (d < min && d > 0.0001) {
        ent.x += dx / d * (min - d);
        ent.y += dy / d * (min - d);
      }
    } else if (o.w && o.h) {
      // Machines walk into buildings too. Same widening as the player's.
      const cx = Math.min(Math.max(ent.x, o.x), o.x + o.w);
      const cy = Math.min(Math.max(ent.y, o.y), o.y + o.h);
      const dx = ent.x - cx, dy = ent.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < r) {
        if (d > 0.0001) {
          ent.x += dx / d * (r - d);
          ent.y += dy / d * (r - d);
        } else {
          ent.y = o.y - r;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ENEMY CORES (plan §71.3 — three normal Core arts + the little swarm shell).
// Socket count is part of the Core, so bigger Cores carry bigger machines.
// Device-play tuning: encounters were over too fast and too punishing at the
// same time. The answer is MORE machines that each die quicker — a busier
// fight that gives you time to level, rip parts and actually use them.
// HP is down ~25%; costs are unchanged, so a bigger budget buys more bodies.
// The SIX Core families — Master v3.2 §27, LOCKED baselines. Speed is the
// §27 "vs Jackal" percentage applied to STANDARD_PACE: the proven Standard
// speed from M1/M13. The RELATIVE column is the Master's; the absolute feel
// stays what shipped. power/loadCap/modCap/hardCeiling are the §27 table —
// modCap is the normal build size, hardCeiling is the never-exceed wall, and
// a late-map profile may raise a HEAVY family toward its ceiling; Light and
// Swarm always use their own band (§27 module cap rule, locked).
const STANDARD_PACE = 330;
const ENEMY_CORES = {
  swarm:    { key: 'swarm',    hp: 30,  radius: 34, speed: STANDARD_PACE * 1.25,
              sockets: 3, power: 6,  loadCap: 8,  modCap: 2, hardCeiling: 3,
              body: '#5e1030', inner: '#ff3fa4', glow: 'rgba(255,63,164,0.16)', cost: 2 },
  light:    { key: 'light',    hp: 55,  radius: 52, speed: STANDARD_PACE * 1.15,
              sockets: 6, power: 10, loadCap: 14, modCap: 4, hardCeiling: 6,
              body: '#3a2668', inner: '#9b5cff', glow: 'rgba(155,92,255,0.16)', cost: 4 },
  standard: { key: 'standard', hp: 85,  radius: 66, speed: STANDARD_PACE * 1.00,
              sockets: 9, power: 16, loadCap: 22, modCap: 6, hardCeiling: 9,
              body: '#6b2a3f', inner: '#a83a52', glow: 'rgba(255,59,90,0.15)', cost: 7 },
  heavy:    { key: 'heavy',    hp: 130, radius: 84, speed: STANDARD_PACE * 0.82,
              sockets: 12, power: 24, loadCap: 32, modCap: 8, hardCeiling: 12,
              body: '#4a3418', inner: '#d08a1e', glow: 'rgba(208,138,30,0.17)', cost: 12 },
  carrier:  { key: 'carrier',  hp: 90,  radius: 74, speed: STANDARD_PACE * 0.90,
              sockets: 12, power: 22, loadCap: 28, modCap: 8, hardCeiling: 12,
              body: '#1d4a44', inner: '#2e8f7a', glow: 'rgba(46,143,122,0.16)', cost: 10 },
  siege:    { key: 'siege',    hp: 120, radius: 80, speed: STANDARD_PACE * 0.72,
              sockets: 12, power: 28, loadCap: 36, modCap: 8, hardCeiling: 12,
              body: '#3d3210', inner: '#8a6d1a', glow: 'rgba(208,168,30,0.16)', cost: 11 },
};
// The pre-§27 name for Standard, kept so every existing zone plan, AI table
// and save keeps working. Same object — not a copy.
ENEMY_CORES.medium = ENEMY_CORES.standard;

// Effective engagement range of a weapon part. Drives how each brain wants to
// sit relative to the player — this is what stops a flamethrower machine from
// politely orbiting 600px away and never touching anyone.
function weaponRange(part) {
  if (!part) return 0;
  if (part.beam) return part.range || 900;
  if (part.dps && part.bladeRadius) return 100;          // saw: melee
  if (part.mine) return 300;                             // drop it on them
  if (part.flame) return (part.projSpeed * part.projLife) * 0.85;  // ~200
  if (part.projSpeed && part.projLife) {
    return Math.min(part.projSpeed * part.projLife * 0.62, 1200);
  }
  return 0;
}

class Enemy {
  // The SUPPORT's repair, hull hp a second, and the CHARGE's blast.
  static REPAIR_RATE = 14;
  static DETONATE_R = 260;
  static DETONATE_DMG = 38;

  // opts.modCap: a late-map profile may raise the module cap toward the
  // family's HARD CEILING (§27) — never past it, clamped here.
  constructor(x, y, loadout, aiType = 'strafer', coreKey = null, opts = null) {
    this.aiType = aiType;
    const core = ENEMY_CORES[coreKey] ||
      ENEMY_CORES[aiType === 'swarmer' ? 'swarm' : 'medium'];
    this.core = core;
    this.coreKey = core.key;

    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = core.radius;
    // Difficulty makes machines TOUGHER or SOFTER, which is what an easier
    // tier should change: same fight, fewer shots to finish it.
    this.maxHp = core.hp * Enemy.hpMul();
    this.hp = this.maxHp;
    this.moveSpeed = core.speed;
    this.alive = true;
    this.flash = 0;
    this.aimX = 1; this.aimY = 0;
    this.sinceDamage = 999;          // lets enemy Repair Arms work (M12)
    this.lastCause = null;
    this.diedStripped = false;
    this.hadParts = false;          // set once its loadout is fitted

    // Brain state
    this.ramCd = 0;
    this.weaveT = Math.random() * 6;
    this.orbitDir = Math.random() < 0.5 ? 1 : -1;
    this.orbitT = 2 + Math.random() * 2;
    this.burstClock = Math.random() * 2.1;   // desynced bursts per enemy
    this.firingNow = false;
    this.extraSpread = 0.12;                 // enemies are less accurate
    // Turrets swing slowly; so does a sniper, which is what makes flanking
    // one the answer the roster promises ("break line of sight, flank").
    this.turnRate = aiType === 'turret' ? 2.0 : (aiType === 'sniper' ? 1.6 : 99);
    // Turrets are braced: they barely feel their own weapon recoil, so a
    // cannon turret stays planted instead of sliding out of position.
    this.braceMul = aiType === 'turret' ? 0.2 : 1;
    this.rangeT = 0;

    // Salvager (plan §39.5) state
    this.salvageTarget = null;
    this.salvageT = 0;

    // §27: enemies live under the SAME Power and Load laws as the player.
    // ent.power switches recalcPower's §11 machinery on — over-budget parts
    // brown out, Reactors raise the grid, and destroying a Reactor takes its
    // weapons offline through the one pipe that already knows how.
    this.power = core.power;
    this.loadCap = core.loadCap;

    // A BOSS IS BIGGER THAN ITS CORE. Bosses are described in three rings and
    // the heaviest enemy core has EIGHT sockets — so the Crucible's outer ring
    // of four heat vents and its mid ring filled the machine and the INNER
    // RING WAS SILENTLY DROPPED. Which meant the built boss carried no
    // radiators at all, and the radiator phase — 'the discoverable solution',
    // the entire idea of the fight — could never fire.
    //
    // `Enemies.build` counts what the layers ask for and says so here.
    const bossFrame = (opts && opts.sockets) ? opts.sockets : 0;
    Machine.initSockets(this, bossFrame || core.sockets);
    // ...and the caps have to move with the ring, or the sockets exist and
    // `Machine.attach` refuses to fill them. It refuses on THREE counts —
    // socket, module cap and Load — and the first version of this fixed only
    // the first, so the Crucible still came out with no radiators. A bigger
    // frame is a bigger machine in all three senses or it is not one.
    if (bossFrame) {
      this.loadCap = Math.max(this.loadCap, bossFrame * 12);
      this.power = Math.max(this.power, bossFrame * 4);
    }
    // AFTER initSockets — it writes the global default into maxModules, and
    // the family cap must win. (The suite caught this the day it was born:
    // set before, clobbered silently, every cap test red.)
    this.maxModules = bossFrame
      ? bossFrame
      : Math.min((opts && opts.modCap) ? opts.modCap : core.modCap,
                 core.hardCeiling !== undefined ? core.hardCeiling : 99);
    for (const [id, sock, standsFor] of (loadout || [])) {
      const valid = (typeof sock === 'number' && this.sockets.some(s => s.id === sock && !s.comp));
      // `attach` returns the socket id it used, or -1. A substituted boss part
      // remembers what it was ASKED to be, so the phase system can put the
      // question the content asked to the machine that got built.
      const at = Machine.attach(this, id, valid ? sock : null);
      if (standsFor && standsFor !== id && at !== -1) {
        const k = this.sockets.find(q => q.id === at);
        if (k && k.comp) k.comp.standsFor = standsFor;
      }
    }
    // A machine that never carried anything cannot be "stripped" (SURGICAL).
    this.hadParts = this.sockets.some(s => !!s.comp);
    this._computeRanges();
    this.preferredRange = this.wantRange;
  }

  // Rebuilt whenever the machine changes: where this brain wants to fight.
  _computeRanges() {
    let shortest = Infinity, longest = 0, hasWeapon = false;
    for (const s of this.sockets) {
      if (!s.comp || !s.comp.online) continue;
      const r = weaponRange(s.comp.part);
      if (r > 0) {
        hasWeapon = true;
        if (r < shortest) shortest = r;
        if (r > longest) longest = r;
      } else if (s.comp.part.dps && s.comp.part.bladeRadius) {
        hasWeapon = true;
        shortest = Math.min(shortest, 100);
        longest = Math.max(longest, 100);
      }
    }
    if (!hasWeapon) { shortest = 120; longest = 120; }    // unarmed: shove in
    this.fireRange = Math.max(longest * 1.05, 220);
    // Sit just inside the range of the SHORTEST-ranged weapon it carries.
    this.wantRange = Math.min(Math.max(shortest * 0.78, 150), 820);
  }

  // The Load and Power this machine was carrying when it died. Counted off the
  // sockets it still had — a machine you stripped first pays less for the kill
  // because you already took the value off it, which is the whole shape of the
  // game's economy and falls out of measuring rather than being a rule.
  killWeight() {
    let w = 0;
    for (const s of (this.sockets || [])) {
      if (!s.comp || !s.comp.part) continue;
      w += (s.comp.part.loadCost || 0) + (s.comp.part.powerCost || 0);
    }
    return w;
  }

  takeCoreDamage(dmg, hx, hy, isSaw, cause) {
    if (!this.alive) return;
    // THE DISPATCHER. "Four pylons build and send the entire enemy roster in
    // ASCENDING order of quality until you break them ... breaking all four
    // leaves silence and a walk to a core that does nothing to stop you."
    // While a pylon stands, the core reroutes: the fight is the pylons.
    if (this.bossId === 'dispatcher' && typeof Lairs !== 'undefined' &&
        Lairs.pylonsLive && Lairs.pylonsLive() > 0) {
      this.flash = 0.05;
      if (typeof Effects !== 'undefined' && Math.random() < 0.3) {
        Effects.comicWord('REROUTED', this.x, this.y - this.radius - 60, '#8fa3c8', 40);
      }
      return;
    }
    this.lastCause = cause || (isSaw ? 'saw' : this.lastCause);
    // FORTIFIED Elite (§27): a 60-point frontal barrier that does not
    // regenerate once broken. Front = the way the machine is aiming.
    if (this.frontBarrier > 0 && hx !== undefined) {
      const ux = hx - this.x, uy = hy - this.y;
      const l = Math.hypot(ux, uy) || 1;
      if ((ux / l) * this.aimX + (uy / l) * this.aimY > 0.2) {
        const soak = Math.min(this.frontBarrier, dmg);
        this.frontBarrier -= soak;
        dmg -= soak;
        Effects.spark(hx, hy, Math.atan2(uy, ux), 3, '#8fa3c8', 320);
        if (this.frontBarrier <= 0) {
          Effects.comicWord('BARRIER DOWN!', this.x, this.y - this.radius - 60,
            '#8fa3c8', 52);
        }
        if (dmg <= 0) { this.flash = 0.05; return; }
      }
    }
    this.hp -= dmg;
    this.flash = 0.1;
    this.sinceDamage = 0;
    if (isSaw) {
      this._sawAcc = (this._sawAcc || 0) + dmg;
      if (this._sawAcc >= 10) {
        Effects.damageNumber(hx, hy - this.radius, this._sawAcc);
        this._sawAcc = 0;
      }
    } else {
      Effects.damageNumber(hx, hy - this.radius * 0.6, dmg);
      Effects.spark(hx, hy, Math.atan2(hy - this.y, hx - this.x), 4, '#ffd23f');
    }
    if (this.hp <= 0) this._die();
  }

  hit(dmg, hx, hy, isSaw) { this.takeCoreDamage(dmg, hx, hy, isSaw); }

  _die() {
    this.alive = false;
    // VOLATILE Elite (§27): the Core cooks off — 0.6s, 28 damage across 190,
    // and it hurts BOTH sides, so a volatile kill inside a pack pays double.
    if (this.volatile && typeof Projectiles !== 'undefined') {
      Projectiles.scheduleBlast(0.6, this.x, this.y, 28, 190, 'enemy', null);
      Projectiles.scheduleBlast(0.6, this.x, this.y, 28, 190, 'player', null);
      Effects.comicWord('VOLATILE!', this.x, this.y - this.radius - 60,
        '#ff7a1a', 58);
    }
    // M2 / Master §17: final-blow credit, by weapon FAMILY. An environmental
    // kill credits nothing, which is why this is guarded on _lastHitBy rather
    // than firing on every death.
    if (typeof Mastery !== 'undefined' && this._lastHitBy) {
      Mastery.award(this._lastHitBy, this.isElite ? 'elite' : 'normal');
    }
    // CORE CHARGE (M12): kills feed the meter; drone/auto kills also feed
    // the HIVE unlock counter; kills inside 2s of a Dash feed BACKBLAST's.
    if (typeof Mods !== 'undefined' && Machine._xpPlayer) {
      const pl = Machine._xpPlayer;
      Mods.event(pl, this.isElite ? 'eliteKill' : 'kill');
      if (this._lastHitBy === 'droneBay') Mods.note('autoKill');
      if (pl.dashCdMax && pl.dashCd > pl.dashCdMax - 2) Mods.note('dashKill');
    }
    // SURGICAL: every part shot off BEFORE the Core died.
    this.diedStripped = this.sockets.every(s => !s.comp) && this.hadParts === true;
    if (typeof Unlocks !== 'undefined') {
      Unlocks.event('enemyKilled', {
        elite: !!this.isElite, placed: !!this.placed,
        // WHAT IT WAS, so the payout can be about the machine rather than a
        // flat number. CONTENT_ECONOMY bands kills by size — 8-15 for a small
        // patrol machine, 50-80 for a large one — and every kill in the game
        // paid exactly 5. Measured the same way Salvage.valueOf measures a
        // part, because Load and Power ARE the value and a second scale would
        // eventually disagree with the first.
        boss: !!this.bossId,
        weight: this.killWeight(),
        stripped: this.diedStripped,
        bySaw: this.lastCause === 'saw',
        byHazard: this.lastCause === 'hazard' || this.lastCause === 'mine',
        cause: this.lastCause || null,
      });
    }
    // Surviving parts scatter as salvage or stay bolted to the HULK (§18,
    // and BLOCK 6.4). LooseParts.ON_KILL of them drop loose exactly as
    // before — field looting is untouched and stays completely viable — and
    // the rest, which used
    // to simply explode, now stay on the wreck for anyone willing to drag it
    // home. That is what makes towing pay MORE than looting without ever
    // making it required.
    const kept = [];
    for (const s of this.sockets) {
      if (!s.comp) continue;
      if (s.comp.part.noSalvage) continue;      // neither loose nor on the hulk
      const p = Machine.socketPos(this, s);
      // LOOSE, OR STILL BOLTED ON FOR THE TOW. The one place in the game
      // that rolls for this; the number lives on LooseParts, which is the
      // module that owns the things it makes, and says there why.
      if (Math.random() < LooseParts.ON_KILL) {
        LooseParts.spawn(s.comp.part.id, s.comp.hp / s.comp.maxHp,
          p.x, p.y, Math.cos(s.angle) * 520, Math.sin(s.angle) * 520);
      } else {
        kept.push({ partId: s.comp.part.id, gradeId: 'G2' });
        Effects.spark(p.x, p.y, s.angle, 2, '#8fa3c8', 260);
      }
    }
    if (kept.length && typeof Tow !== 'undefined') Tow.fromMachine(this, kept);
    Machine.clearAll(this);
    // Repair cell, chance scaled by how hurt the player is (see pickups.js).
    if (typeof Pickups !== 'undefined') {
      Pickups.maybeDrop(this.x, this.y, Machine._xpPlayer);
    }
    Effects.explosion(this.x, this.y, this.radius * 2.6);
    Camera.shake(this.coreKey === 'heavy' ? 6 : 4, 0.15);
  }

  // Accelerate toward a desired direction (shared by every brain).
  _steer(dt, mx, my, speedMul = 1) {
    // LOCKDOWN PROJECTOR (§22) and future slow fields: refreshed by the
    // field each frame, decays here — leaving the field IS the escape.
    if (this._slowFieldT > 0) {
      this._slowFieldT -= dt;
      // AMPHIBIOUS and BREAKS TERRAIN: water, rough ground and the like do
      // not slow it. The field still refreshes the window; it is ignored.
      if (!this.terrainImmune) speedMul *= (this._slowFieldMul || 1);
    }
    // THE AMBUSH BURST: two seconds at 1.6x from the moment it sees you.
    if (this._ambushT > 0) { this._ambushT -= dt; speedMul *= 1.6; }
    // Elite speed (§27 OVERCLOCKED +5% / HUNTER +15%) lives in its own
    // field: recalcStats rebuilds speedMul from parts, and a bonus written
    // there would vanish with the first re-power.
    speedMul *= (this.eliteSpeedMul || 1);
    // LEGS GONE (BossPhases 'cannotTurn'). Its own field for exactly the same
    // reason the elite bonus has one: recalcStats rebuilds speedMul from the
    // parts still bolted on, and a phase written there would be undone by the
    // next re-power — which is a boss healing a phase change you earned.
    if (this._crippled) speedMul *= BossPhases.CRIPPLED_SPEED;
    // STAGGERED (the spine's cannon step 2). It stops, briefly. Its own field
    // and its own decay, so a stagger cannot be undone by a recalc — the same
    // rule the elite bonus and the crippling phase follow.
    if (this._staggerT > 0) { this._staggerT -= dt; speedMul = 0; }
    // GRIPPED (the spine's saw step 3): a blade in contact slows it to a
    // crawl for as long as the blade stays in. Same shape as the stagger.
    if (this._sawGripT > 0) { this._sawGripT -= dt; speedMul *= 0.35; }
    const ml = Math.hypot(mx, my);
    const sp = this.moveSpeed * speedMul * (this.speedMul || 1);
    const k = 1 - Math.exp(-6 * dt);
    if (ml < 0.0001) {
      this.vx += (0 - this.vx) * k;
      this.vy += (0 - this.vy) * k;
    } else {
      this.vx += (mx / ml * sp - this.vx) * k;
      this.vy += (my / ml * sp - this.vy) * k;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  // BLOCK 2: `brainTarget` is what the AI steers at and shoots at, which is
  // NOT always the player. A machine patrolling its own ground is handed a
  // waypoint; a machine returning home is handed its post. `player` stays the
  // player throughout, because separation and contact range are physical and
  // must hold whether the machine has noticed you or not — a patrol you walk
  // into still has to push you out of it.
  //
  // A passive target sets firingNow false after the brain runs, so the brains
  // themselves needed no changes at all.
  update(dt, player, arena, obstacles, brainTarget) {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) return;
    this.sinceDamage += dt;

    // BLOCK 14. A boss's phase changes tick here, on the machine itself,
    // because they are things happening TO this machine and nowhere else.
    if (this.bossId && typeof BossPhases !== 'undefined') {
      BossPhases.tick(dt, this);
      // SHUTDOWN is the discoverable solution's payoff: cooling gone means
      // the machine cooks itself and stops. It does not think, move or fire —
      // it stands there and you take it apart at leisure. That is a WINDOW,
      // not a damage bonus, which is what makes working it out feel like
      // solving the fight rather than optimising it.
      if (this.shutdown) {
        this.vx *= Math.max(0, 1 - dt * 6);
        this.vy *= Math.max(0, 1 - dt * 6);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.flash = Math.max(this.flash, 0.05);
        return;
      }
    }
    // Validated, not just defaulted. The fifth argument USED to be `vents`
    // (which Enemy never declared and so silently ignored), and a stale
    // caller handing over an array made `tgt` truthy, `tgt.x` undefined and
    // every steering number NaN — a machine that stood still forever with no
    // error anywhere. tests/test_m18.js caught exactly that.
    const tgt = (brainTarget && typeof brainTarget.x === 'number')
      ? brainTarget : player;

    // Loadout changes (parts shot off, parts salvaged) move the goalposts.
    this.rangeT -= dt;
    if (this.rangeT <= 0) { this.rangeT = 0.4; this._computeRanges(); }

    const dx = tgt.x - this.x, dy = tgt.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;

    // Aim: instant for most brains, rate-limited for turrets so they can be
    // flanked — that is the whole point of a slow, heavily armed machine.
    if (this.turnRate >= 99) {
      this.aimX = ux; this.aimY = uy;
    } else {
      const cur = Math.atan2(this.aimY, this.aimX);
      const want = Math.atan2(uy, ux);
      let diff = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const step = Math.max(-this.turnRate * dt, Math.min(this.turnRate * dt, diff));
      this.aimX = Math.cos(cur + step);
      this.aimY = Math.sin(cur + step);
    }

    // SHUT DOWN. It stands where it is.
    if (this.halted) { this.vx = 0; this.vy = 0; this.firingNow = false; return; }
    // FORMATION (the MARSHAL's `line`). A pack member steers for a point
    // abreast of its place in the line, perpendicular to the approach, so a
    // pack arrives as a rank rather than a queue. The brain sees a shifted
    // target; nothing in the brain has to know about packs.
    let bt = tgt, bd = d, bux = ux, buy = uy;
    const TR = this.traits || {};
    if (TR.formation === 'line' && this._formN > 1 && tgt === player) {
      const off = (this._formIdx - (this._formN - 1) / 2) * 220;
      bt = { x: tgt.x + (-uy) * off, y: tgt.y + ux * off, alive: tgt.alive,
             passive: tgt.passive, radius: tgt.radius, moduleCount: tgt.moduleCount };
      // The brain's bearing is to the SHIFTED point, or a brain that steers
      // on the bearing rather than on target.x would ignore the line.
      const bx = bt.x - this.x, by = bt.y - this.y;
      bd = Math.hypot(bx, by) || 1;
      bux = bx / bd; buy = by / bd;
    }
    // DETONATES ON CONTACT (the CHARGE). In reach: the telegraph starts --
    // it stops, flashes, and after telegraphSeconds it goes, taking the
    // player with it if they are still inside the blast. The telegraph is
    // the whole fairness of it: a full carry one-shot with no warning would
    // be the punishment without the lesson.
    if (TR.detonatesOnContact && !this._detT && player.alive !== false &&
        d < this._contactRange(player) + 120) {
      this._detT = this.telegraphSeconds;
      this.flash = 0.2;
      if (typeof Effects !== 'undefined') {
        Effects.comicWord('!!!', this.x, this.y - this.radius - 70, CONFIG.COLOR.red, 60);
      }
    }
    if (this._detT) {
      this._detT -= dt;
      this.flash = Math.max(this.flash, 0.06);
      this.vx *= Math.exp(-8 * dt); this.vy *= Math.exp(-8 * dt);
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this._detT <= 0) { this._detT = 0; this._detonate(player); }
      return;
    }

    switch (this.immobile ? 'fixed' : this.aiType) {
      case 'fixed':    this._brainFixed(dt, bt, bd, bux, buy); break;
      case 'rusher':   this._brainRusher(dt, bt, bd, bux, buy); break;
      case 'kiter':    this._brainKiter(dt, bt, bd, bux, buy); break;
      case 'sniper':   this._brainSniper(dt, bt, bd, bux, buy); break;
      case 'zoner':    this._brainZoner(dt, bt, bd, bux, buy); break;
      case 'support':  this._brainSupport(dt, bt, bd, bux, buy); break;
      case 'turret':   this._brainTurret(dt, bt, bd, bux, buy); break;
      case 'salvager': this._brainSalvager(dt, bt, bd, bux, buy); break;
      case 'swarmer':  this._brainSwarmer(dt, bt, bd, bux, buy); break;
      case 'guard':    this._brainGuard(dt, bt, bd, bux, buy); break;
      case 'flanker':  this._brainFlanker(dt, bt, bd, bux, buy); break;
      case 'artillery': this._brainArtillery(dt, bt, bd, bux, buy); break;
      case 'builder':  this._brainBuilder(dt, bt, bd, bux, buy); break;
      default:         this._brainStrafer(dt, bt, bd, bux, buy); break;
    }
    // CHAINS TO ALLIES (the GALVANIC): its arc chains between everything,
    // INCLUDING ITS FRIENDS. Every frame it is firing, any ally standing
    // within its chain range of the player takes a crackle of it -- the
    // reason to fight a GALVANIC among its own pack rather than alone.
    if (TR.chainsToAllies && this.firingNow && player.alive !== false) {
      this._chainT = (this._chainT || 0) - dt;
      if (this._chainT <= 0) {
        this._chainT = 0.5;
        let dmg = 0;
        for (const s of this.sockets) {
          if (s.comp && s.comp.online && s.comp.part.chain) dmg = Math.max(dmg, s.comp.part.damage || 0);
        }
        for (const o of (Enemy._flock || [])) {
          if (o === this || !o.alive || !o.sockets) continue;
          if (Math.hypot(o.x - player.x, o.y - player.y) > 520) continue;
          // The hull, straight: lightning through the frame, not a shot at
          // a joint.
          Machine.applyDamage(o, { kind: 'core' }, dmg * 0.5, o.x, o.y, false, 'arcGun');
          if (typeof Effects !== 'undefined') Effects.bolt(player.x, player.y, o.x, o.y, '#22d9ff');
        }
      }
    }

    // A machine that has not noticed you does not shoot. Checked after the
    // brain rather than before, so a brain can still line itself up on a
    // waypoint - it simply has nothing to fire at.
    if (tgt.passive) this.firingNow = false;

    // Separation is against the PLAYER, always. A patrol you drive into still
    // has to push you out of it.
    this._separate(dt, player);
    collideCircleWorld(this, arena, obstacles);
    Machine.update(dt, this, [player], this.firingNow, 'enemy');
  }

  // Push out of the player and out of each other. Without this, rushers and
  // swarmers park INSIDE your machine: you cannot see them, cannot aim at
  // their joints, and cannot walk away. Overlap is pushed out firmly but
  // smoothly, so it reads as machines jostling rather than a hard wall.
  // How close a machine can get to the player: the Core plus the rig of parts
  // bolted around it. Ramming happens AT this range — an enemy hits your
  // armour, it does not climb inside your machine.
  _contactRange(player) {
    const rig = player.moduleCount ? 88 : 16;
    return this.radius + player.radius + rig;
  }

  _separate(dt, player) {
    // Clear the whole RIG, not just the Core. Parts sit ~110 units out on
    // their sockets, so a Core-radius check still let machines park underneath
    // the player's own weapons — which is exactly what "they get underneath
    // you and there's nothing you can do" describes.
    const minD = this._contactRange(player) - 6;
    const dx = this.x - player.x, dy = this.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < minD && d > 0.0001) {
      const push = (minD - d) * Math.min(1, dt * 14);
      this.x += dx / d * push;
      this.y += dy / d * push;
      // Kill inward velocity so it does not simply shove straight back in.
      const inward = (this.vx * -dx + this.vy * -dy) / d;
      if (inward > 0) {
        this.vx += dx / d * inward;
        this.vy += dy / d * inward;
      }
    }
    // Enemies also spread out from each other, so a pack cannot stack into
    // one unreadable blob on top of you.
    const list = Enemy._flock;
    if (!list) return;
    for (const o of list) {
      if (o === this || !o.alive) continue;
      const ox = this.x - o.x, oy = this.y - o.y;
      const od = Math.hypot(ox, oy);
      const want = this.radius + o.radius + 6;
      if (od < want && od > 0.0001) {
        const p = (want - od) * Math.min(1, dt * 8) * 0.5;
        this.x += ox / od * p;
        this.y += oy / od * p;
      }
    }
  }

  // --- §39.1 RUSHER: close the distance, ram on contact -------------------
  _brainRusher(dt, player, d, ux, uy) {
    this.weaveT += dt;
    this.backoffT = Math.max(0, (this.backoffT || 0) - dt);
    const wob = Math.sin(this.weaveT * 3.2) * 0.35;
    if (this.backoffT > 0) {
      // Peel away after a hit, then come back around. Gives the player a
      // window to shoot, dash or reposition instead of being pinned.
      this._steer(dt, -ux + (-uy) * 0.8, -uy + ux * 0.8, 0.85);
    } else {
      this._steer(dt, ux + (-uy) * wob, uy + ux * wob);
    }

    this.ramCd = Math.max(0, this.ramCd - dt);
    if (this.ramCd <= 0 && d < this._contactRange(player) + 16 && player.alive) {
      this.ramCd = 1.1 * (this.ramCdMul || 1);   // HUNTER: -20% (§27)
      this._ram(player, ux, uy, 5, 720, 460);
      this.backoffT = 0.7;      // disengage so it cannot grind you down
    }
    // Rushers with guns still shoot on the way in.
    this.burstClock = (this.burstClock + dt) % 2.1;
    this.firingNow = player.alive && d < this.fireRange && this.burstClock < 0.8;
  }

  // --- §39.2 STRAFER: orbit at range, burst fire ---------------------------
  // --- §27 GUARD: bodyblock — stand between the player and its ward -------
  // The ward is the nearest OTHER machine (a Guard protects the pack); with
  // no pack left it holds its ground and trades. The read is a machine that
  // will not chase you but will not let you through either.
  _brainGuard(dt, player, d, ux, uy) {
    this._wardT = (this._wardT || 0) - dt;
    if (this._wardT <= 0 || (this._ward && !this._ward.alive)) {
      this._wardT = 1.2;
      let best = null, bd = 1e9;
      for (const o of (Enemy._flock || [])) {
        if (o === this || !o.alive || o.aiType === 'guard') continue;
        const dd = Math.hypot(o.x - this.x, o.y - this.y);
        if (dd < bd) { bd = dd; best = o; }
      }
      this._ward = best;
    }
    if (this._ward) {
      // The post: 62% of the way from the ward toward the player.
      const wx = this._ward.x + (player.x - this._ward.x) * 0.62;
      const wy = this._ward.y + (player.y - this._ward.y) * 0.62;
      const gx = wx - this.x, gy = wy - this.y;
      const gd = Math.hypot(gx, gy) || 1;
      this._steer(dt, gx / gd, gy / gd, Math.min(1, gd / 180));
    } else {
      // No pack: hold, face, and fire. A slow drift keeps its front to you.
      const radial = (d - Math.max(this.wantRange * 0.8, 340)) /
        Math.max(this.wantRange, 340);
      this._steer(dt, ux * radial, uy * radial, 0.5);
    }
    this.burstClock = (this.burstClock + dt) % 2.3;
    this.firingNow = player.alive && d < this.fireRange && this.burstClock < 0.7;
  }

  // --- FIXED: it does not move. `immobile` on the roster (LADLE, CITE, HOIST,
  // the ARM family). It aims, it fires, and it stays exactly where the post
  // put it, whatever the brain it would otherwise have run.
  _brainFixed(dt, player, d, ux, uy) {
    this.vx = 0; this.vy = 0;
    const err = Math.abs(this.aimX * ux + this.aimY * uy);
    this.burstClock = (this.burstClock + dt) % 2.6;
    this.firingNow = player.alive && d < this.fireRange && err > 0.86 &&
      this.burstClock < 1.5;
  }

  // --- SNIPER: long range, slow, high damage, stays back --------------------
  // "break line of sight, flank." It holds at the far end of its own range,
  // backs off when you close, and only fires when it has stopped and is
  // pointed at you -- with a slow turn, so coming round its side works.
  _brainSniper(dt, player, d, ux, uy) {
    // The band it holds is INSIDE its range: far is 92% of fireRange, so a
    // braced sniper can always fire. (The first version braced at 1.15x far
    // and sat 50 units outside its own reach, aimed and silent, forever.)
    const far = this.fireRange * 0.92;
    const near = Math.max(far * 0.7, 400);
    if (d < near) {
      this._steer(dt, -ux, -uy, 0.9);                    // back off
    } else if (d > far) {
      this._steer(dt, ux, uy, 0.6);                      // creep into range
    } else {
      const brake = Math.exp(-9 * dt);                   // braced
      this.vx *= brake; this.vy *= brake;
      this.x += this.vx * dt; this.y += this.vy * dt;
    }
    const still = Math.hypot(this.vx, this.vy) < 40;
    this._braced = still;                                // read by the suite
    const err = Math.abs(this.aimX * ux + this.aimY * uy);
    this.burstClock = (this.burstClock + dt) % 3.0;
    this.firingNow = player.alive && d < this.fireRange && d > near * 0.8 &&
      still && err > 0.95 && this.burstClock < 0.5;
  }

  // --- ZONER: area denial -- mines, fields, walls of fire -------------------
  // "patience, or the right resistance." It keeps its ground near its post,
  // holds you at range, and every few seconds lays a mine on the line
  // between you and it, so the approach fills up the longer you take.
  _brainZoner(dt, player, d, ux, uy) {
    const want = Math.max(this.wantRange, 520);
    if (d < want * 0.7) this._steer(dt, -ux, -uy, 0.8);
    else if (d > want * 1.4) this._steer(dt, ux, uy, 0.7);
    else this._steer(dt, -uy * this.orbitDir, ux * this.orbitDir, 0.45);
    this._zoneT = (this._zoneT || 0) - dt;
    if (this._zoneT <= 0 && player.alive && d < Math.max(this.fireRange * 1.3, want * 1.6) &&
        typeof Mines !== 'undefined' && typeof PARTS !== 'undefined' && PARTS.mineLayer) {
      this._zoneT = 2.6;
      const k = 0.45 + Math.random() * 0.25;
      Mines.spawn(this.x + ux * d * k, this.y + uy * d * k, PARTS.mineLayer, 'enemy', 1.4);
      this._zoned = (this._zoned || 0) + 1;
    }
    this.burstClock = (this.burstClock + dt) % 2.4;
    this.firingNow = player.alive && d < this.fireRange && this.burstClock < 0.9;
  }

  // --- SUPPORT: repairs and shields others, doesn't fight well -------------
  // "KILL IT FIRST." It stays behind the nearest ally, between that ally and
  // away from you, and mends the most damaged module on any ally in reach at
  // a steady rate. Alone, it backs off and shoots badly.
  _brainSupport(dt, player, d, ux, uy) {
    this._wardT = (this._wardT || 0) - dt;
    if (this._wardT <= 0 || (this._ward && !this._ward.alive)) {
      this._wardT = 1.0;
      let best = null, bd = 2400;
      for (const o of (Enemy._flock || [])) {
        if (o === this || !o.alive || o.aiType === 'support') continue;
        const dd = Math.hypot(o.x - this.x, o.y - this.y);
        if (dd < bd) { bd = dd; best = o; }
      }
      this._ward = best;
    }
    if (this._ward) {
      // Behind the ward: on the far side of it from the player.
      const ax = this._ward.x - player.x, ay = this._ward.y - player.y;
      const al = Math.hypot(ax, ay) || 1;
      const gx = this._ward.x + (ax / al) * 260 - this.x;
      const gy = this._ward.y + (ay / al) * 260 - this.y;
      const gd = Math.hypot(gx, gy) || 1;
      this._steer(dt, gx / gd, gy / gd, Math.min(1, gd / 160));
    } else {
      this._steer(dt, -ux, -uy, 0.7);
    }
    // THE REPAIR. The most damaged module on any ally within reach, mended at
    // REPAIR_RATE a second, one at a time. Hull, never connectors: a joint
    // you loosened stays loose.
    this._repT = (this._repT || 0) - dt;
    if (this._repT <= 0) {
      this._repT = 0.25;
      let worst = null, wf = 0.999, who = null;
      for (const o of (Enemy._flock || [])) {
        if (o === this || !o.alive || !o.sockets) continue;
        if (Math.hypot(o.x - this.x, o.y - this.y) > 900) continue;
        for (const s of o.sockets) {
          const c = s.comp;
          if (!c || !c.maxHp) continue;
          const f = c.hp / c.maxHp;
          if (f < wf) { wf = f; worst = c; who = o; }
        }
      }
      if (worst) {
        worst.hp = Math.min(worst.maxHp, worst.hp + Enemy.REPAIR_RATE * 0.25);
        this._repaired = (this._repaired || 0) + Enemy.REPAIR_RATE * 0.25;
        if (typeof Effects !== 'undefined') Effects.bolt(this.x, this.y, who.x, who.y, '#a8e832');
      }
    }
    this.burstClock = (this.burstClock + dt) % 3.0;
    this.firingNow = player.alive && d < this.fireRange * 0.8 && !this._ward &&
      this.burstClock < 0.6;
  }

  // THE CHARGE GOES. Blast the player if they are inside it, then die the
  // way any machine dies, so the drops and the kill accounting are the
  // ordinary ones.
  _detonate(player) {
    if (!this.alive) return;
    const R = Enemy.DETONATE_R;
    if (typeof Effects !== 'undefined') {
      Effects.explosion(this.x, this.y, R);
      Effects.comicWord('BOOM!', this.x, this.y - 80, CONFIG.COLOR.red, 60);
    }
    if (player && player.alive !== false &&
        Math.hypot(player.x - this.x, player.y - this.y) < R + (player.radius || 0)) {
      if (player.sockets && typeof Machine !== 'undefined') {
        const hit = Machine.resolveHit(player, this.x, this.y, R) || { kind: 'core' };
        Machine.applyDamage(player, hit, Enemy.DETONATE_DMG, player.x, player.y, false, 'charge');
      } else if (player.hit) player.hit(Enemy.DETONATE_DMG, player.x, player.y);
    }
    this._detonated = true;
    this.lastCause = 'detonated';
    this._die();
  }

  // --- §27 FLANKER: come in from behind your guns --------------------------
  // It steers for the point BEHIND the player's aim, then closes. Facing it
  // down works — turn, and it swings wide again.
  _brainFlanker(dt, player, d, ux, uy) {
    const behindA = Math.atan2(player.aimY || 0, player.aimX || 1) + Math.PI;
    const off = 0.55 * this.orbitDir;
    const tx = player.x + Math.cos(behindA + off) * Math.max(300, this.wantRange * 0.7);
    const ty = player.y + Math.sin(behindA + off) * Math.max(300, this.wantRange * 0.7);
    const gx = tx - this.x, gy = ty - this.y;
    const gd = Math.hypot(gx, gy) || 1;
    // In the player's face? Swing wide. At the blind spot? Close and fire.
    const facing = (player.aimX || 0) * -ux + (player.aimY || 0) * -uy;
    if (facing > 0.55 && d < 700) {
      this.orbitT -= dt;
      if (this.orbitT <= 0) { this.orbitT = 2 + Math.random() * 2; this.orbitDir *= -1; }
      this._steer(dt, (-uy) * this.orbitDir * 1.2 - ux * 0.2,
                      ux * this.orbitDir * 1.2 - uy * 0.2, 1.15);
    } else {
      this._steer(dt, gx / gd, gy / gd, 1.1);
    }
    this.burstClock = (this.burstClock + dt) % 1.9;
    this.firingNow = player.alive && d < this.fireRange &&
      (facing < 0.3 || d < 300) && this.burstClock < 0.7;
  }

  // --- §27 ARTILLERY: park far out, stop, volley, relocate -----------------
  // The stop is the tell and the window: a moving artillery piece never
  // fires, so closing on it between volleys is the whole counter-play.
  _brainArtillery(dt, player, d, ux, uy) {
    this._artT = (this._artT || 0) - dt;
    const want = Math.max(this.wantRange, 820);
    if (this._artMode === 'volley') {
      this._steer(dt, 0, 0, 0);
      this.firingNow = player.alive && d < this.fireRange * 1.1;
      if (this._artT <= 0) { this._artMode = 'move'; this._artT = 1.4 + Math.random(); }
    } else {
      const radial = (d - want) / want;
      this._steer(dt, ux * radial * 1.4 + (-uy) * 0.5 * this.orbitDir,
                      uy * radial * 1.4 + ux * 0.5 * this.orbitDir, 0.8);
      this.firingNow = false;
      if (this._artT <= 0 && Math.abs(d - want) < want * 0.35) {
        this._artMode = 'volley';
        this._artT = 1.6 + Math.random() * 0.8;
      }
    }
    if (d < want * 0.45) {          // overrun: scramble backwards, no shot
      this._steer(dt, -ux, -uy, 1.05);
      this.firingNow = false;
      this._artMode = 'move';
    }
  }

  // --- §27 BUILDER: hangs back and makes the fight bigger ------------------
  // Fabricates a Swarm machine every few seconds (hard max 2 of its own
  // alive), through the same pendingAdds lane the Stitcher uses. Kill the
  // Builder first or drown in its product — that is the whole brain.
  _brainBuilder(dt, player, d, ux, uy) {
    this._built = (this._built || []).filter(e => e.alive);
    this._buildT = (this._buildT ?? 3.0) - dt;
    // Kite at long range while the shop runs.
    const want = Math.max(this.wantRange, 760);
    const radial = (d - want) / want;
    this._steer(dt, ux * radial * 1.3 + (-uy) * 0.4 * this.orbitDir,
                    uy * radial * 1.3 + ux * 0.4 * this.orbitDir, 0.85);
    if (this._buildT <= 0 && this._built.length < 2) {
      this._buildT = 8;
      const a = Math.random() * Math.PI * 2;
      const add = new Enemy(this.x + Math.cos(a) * (this.radius + 70),
        this.y + Math.sin(a) * (this.radius + 70),
        [['machineGun', 0]], 'swarmer', 'swarm');
      this.pendingAdds = this.pendingAdds || [];
      this.pendingAdds.push(add);
      this._built.push(add);
      Effects.ring(this.x, this.y, 150, '#2e8f7a');
      Effects.comicWord('FABRICATE!', this.x, this.y - this.radius - 60,
        '#2e8f7a', 48);
    }
    this.burstClock = (this.burstClock + dt) % 2.6;
    this.firingNow = player.alive && d < this.fireRange && this.burstClock < 0.4;
  }

  _brainStrafer(dt, player, d, ux, uy) {
    this.orbitT -= dt;
    if (this.orbitT <= 0) {
      this.orbitT = 2 + Math.random() * 2.5;
      if (Math.random() < 0.6) this.orbitDir *= -1;
    }
    const radial = (d - this.wantRange) / this.wantRange;
    this._steer(dt,
      ux * radial * 1.5 + (-uy) * this.orbitDir,
      uy * radial * 1.5 + ux * this.orbitDir);

    this.burstClock = (this.burstClock + dt) % 2.1;
    this.firingNow = player.alive && d < this.fireRange && this.burstClock < 0.62;
  }

  // --- §39.3 KITER: hold preferred distance, back away if crowded ---------
  _brainKiter(dt, player, d, ux, uy) {
    const want = Math.max(this.wantRange, 420);
    const near = want * 0.78, far = want * 1.3;
    if (d < near) {
      // Retreat — and drift sideways so it does not just reverse into a wall.
      this._steer(dt, -ux + (-uy) * 0.5 * this.orbitDir,
                      -uy + ux * 0.5 * this.orbitDir, 1.12);
    } else if (d > far) {
      this._steer(dt, ux, uy, 0.85);
    } else {
      this.orbitT -= dt;
      if (this.orbitT <= 0) { this.orbitT = 1.6 + Math.random() * 2; this.orbitDir *= -1; }
      this._steer(dt, -uy * this.orbitDir, ux * this.orbitDir, 0.7);
    }
    // Kiters fire in longer, steadier bursts because they stay safe.
    this.burstClock = (this.burstClock + dt) % 2.0;
    this.firingNow = player.alive && d < this.fireRange && this.burstClock < 1.1;
  }

  // --- §39.4 TURRET: barely moves, turns slowly, heavily armed ------------
  _brainTurret(dt, player, d, ux, uy) {
    // A slow shuffle only — enough to unstick itself and creep into range.
    if (d > this.fireRange * 0.95) {
      this._steer(dt, ux, uy, 0.22);
    } else {
      // BRACED: a turret must not shove itself around with its own recoil
      // (a cannon turret was sliding backwards out of its firing position).
      // Heavy damping keeps it planted while still allowing knockback nudges.
      const brake = Math.exp(-9 * dt);
      this.vx *= brake;
      this.vy *= brake;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    // Only fires when actually pointed at the player.
    const err = Math.abs(this.aimX * ux + this.aimY * uy);
    this.burstClock = (this.burstClock + dt) % 2.6;
    this.firingNow = player.alive && d < this.fireRange &&
      err > 0.86 && this.burstClock < 1.5;
  }

  // --- §39.5 SALVAGER: competes with the player for battlefield salvage ---
  _brainSalvager(dt, player, d, ux, uy) {
    if (this.hunter) { this._brainStrafer(dt, player, d, ux, uy); return; }
    const range = 900 * (this.magnetRangeMul || 1);
    const hasRoom = this.sockets.some(s => !s.comp) &&
      this.moduleCount < (this.maxModules || Machine.MAX_MODULES);

    // Drop a target that vanished, got taken, or drifted out of reach.
    if (this.salvageTarget &&
        (!LooseParts.items.includes(this.salvageTarget) || !hasRoom ||
         Math.hypot(this.salvageTarget.x - this.x, this.salvageTarget.y - this.y) > range * 1.3)) {
      this.salvageTarget = null;
      this.salvageT = 0;
    }

    if (!this.salvageTarget && hasRoom) {
      let best = null, bestD = range;
      for (const it of LooseParts.items) {
        const dd = Math.hypot(it.x - this.x, it.y - this.y);
        if (dd < bestD) { bestD = dd; best = it; }
      }
      this.salvageTarget = best;
      this.salvageT = 0;
    }

    if (this.salvageTarget) {
      const it = this.salvageTarget;
      const gx = it.x - this.x, gy = it.y - this.y;
      const gd = Math.hypot(gx, gy) || 1;
      const grabDist = 260 * (this.magnetRangeMul || 1);

      if (gd > grabDist) {
        this._steer(dt, gx / gd, gy / gd, 1.05);          // go get it
        this.salvageT = 0;
      } else {
        // Reel it in, then bolt it on. Same rules the player plays by.
        this._steer(dt, gx / gd * 0.25, gy / gd * 0.25, 0.4);
        this.salvageT += dt * (this.ripSpeedMul || 1);
        const pull = 1 - Math.exp(-5 * dt);
        it.x += (this.x - it.x) * pull;
        it.y += (this.y - it.y) * pull;
        it.vx *= 0.6; it.vy *= 0.6;
        if (this.salvageT >= 0.75) {
          const sock = Machine.attach(this, it.part.id, null);
          if (sock >= 0) {
            this.hadParts = true;
            const s = Machine.getSocket(this, sock);
            s.comp.hp = s.comp.maxHp * it.hpFrac;
            LooseParts.remove(it);
            const p = Machine.socketPos(this, s);
            Effects.spark(p.x, p.y, Math.random() * Math.PI * 2, 10, '#ff5c7a', 420);
            Effects.comicWord('CLANK!', this.x, this.y - this.radius - 70, '#ff5c7a');
            this._computeRanges();
          }
          this.salvageTarget = null;
          this.salvageT = 0;
        }
      }
      // It still shoots while looting, just less.
      this.burstClock = (this.burstClock + dt) % 2.6;
      this.firingNow = player.alive && d < this.fireRange && this.burstClock < 0.45;
      return;
    }

    // Nothing worth grabbing: fight like a strafer.
    this._brainStrafer(dt, player, d, ux, uy);
  }

  // --- §39.6 SWARMER: small, fast, erratic, dangerous in numbers ----------
  _brainSwarmer(dt, player, d, ux, uy) {
    this.weaveT += dt;
    this.backoffT = Math.max(0, (this.backoffT || 0) - dt);
    const wob = Math.sin(this.weaveT * 5.5) * 0.6;
    if (this.backoffT > 0) this._steer(dt, -ux, -uy, 0.9);
    else this._steer(dt, ux + (-uy) * wob, uy + ux * wob, 1);

    this.ramCd = Math.max(0, this.ramCd - dt);
    if (this.ramCd <= 0 && d < this._contactRange(player) + 14 && player.alive) {
      this.ramCd = 0.85 * (this.ramCdMul || 1);   // HUNTER: -20% (§27)
      this._ram(player, ux, uy, 3, 380, 620);
      this.backoffT = 0.5;
    }
    this.burstClock = (this.burstClock + dt) % 1.6;
    this.firingNow = player.alive && d < this.fireRange && this.burstClock < 0.5;
  }

  _ram(player, ux, uy, dmg, kb, selfKb) {
    player.takeCoreDamage(dmg, player.x, player.y);
    // Heavy Treads and the Gyro Stabiliser resist EXTERNAL impulse, which is
    // a different number from the shove your own guns give you.
    const k = kb * (player.knockbackMul !== undefined ? player.knockbackMul : (player.recoilMul || 1));
    player.vx += ux * k; player.vy += uy * k;
    this.vx -= ux * selfKb; this.vy -= uy * selfKb;
    if (Math.random() < 0.4) Effects.comicWord('WHAM!', player.x, player.y - 120);
    Effects.spark(player.x - ux * player.radius, player.y - uy * player.radius,
      Math.atan2(-uy, -ux), 6, '#ffd23f', 520);
  }

  draw(ctx) {
    if (!this.alive) return;

    // Salvager magnet beam — shows the player they are being outbid.
    if (this.salvageTarget && this.salvageT > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,92,122,0.85)';
      ctx.lineWidth = 7;
      ctx.setLineDash([18, 14]);
      ctx.lineDashOffset = -performance.now() / 22;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.salvageTarget.x, this.salvageTarget.y);
      ctx.stroke();
      ctx.restore();
    }

    // Hostile glow, tinted by Core CLASS so the hue reads before the size does.
    R.circle(this.x, this.y, this.radius + 16, this.core.glow);
    R.circle(this.x + 8, this.y + 10, this.radius, 'rgba(0,0,0,0.45)');
    const body = this.flash > 0 ? '#ffffff' : this.core.body;
    const inner = this.flash > 0 ? '#ffffff' : this.core.inner;
    const KEY = { swarm: 'core_enemySwarm', light: 'core_enemyLight',
                  medium: 'core_enemyMedium', heavy: 'core_enemyHeavy',
                  carrier: 'core_enemyCarrier', siege: 'core_enemySiege' };
    const eCoreKey = KEY[this.coreKey] || 'core_enemyMedium';
    const coreArt = this.flash <= 0 && typeof Assets !== 'undefined' &&
      Assets.sprite(ctx, eCoreKey, this.x, this.y,
        this.radius * 2.5, this.radius * 2.5,
        (typeof Sprites44 !== 'undefined')
          ? Sprites44.bodyAngleFor(eCoreKey, this) : 0);
    if (!coreArt) {
      R.circle(this.x, this.y, this.radius, body, CONFIG.COLOR.ink, 9);
      R.circle(this.x, this.y, this.radius * 0.55, inner, CONFIG.COLOR.ink, 6);
      R.circle(this.x, this.y, this.radius * 0.22, inner, CONFIG.COLOR.ink, 5);
    } else {
      // A ring in the class colour, over the art. (The old code drew the two
      // inner discs here unconditionally — the `if` guarded only one line —
      // which covered the middle of every sprite.)
      R.circle(this.x, this.y, this.radius * 0.98, 'rgba(0,0,0,0)', inner, 7);
    }

    // Brain tell: a small readable marker so players learn the six behaviours.
    this._drawBrainMark(ctx);

    Machine.draw(ctx, this);

    // HP bar
    const w = Math.max(90, this.radius * 2.1), h = 14;
    const bx = this.x - w / 2, by = this.y - this.radius - 44;
    R.roundRect(bx - 4, by - 4, w + 8, h + 8, 8, CONFIG.COLOR.ink);
    R.rect(bx, by, w * Math.max(0, this.hp / this.maxHp), h, '#ff5c7a');
  }

  _drawBrainMark(ctx) {
    const r = this.radius * 0.22;
    const c = CONFIG.COLOR.ink;
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const a = Math.atan2(this.aimY, this.aimX);
    ctx.translate(this.x, this.y);
    switch (this.aiType) {
      case 'rusher': {   // forward arrow
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-r * 1.1, -r * 0.9); ctx.lineTo(r * 1.2, 0);
        ctx.lineTo(-r * 1.1, r * 0.9);
        ctx.stroke();
        break;
      }
      case 'kiter': {    // back-step chevrons
        ctx.rotate(a);
        for (const off of [-r * 0.5, r * 0.7]) {
          ctx.beginPath();
          ctx.moveTo(off + r * 0.6, -r); ctx.lineTo(off - r * 0.3, 0);
          ctx.lineTo(off + r * 0.6, r);
          ctx.stroke();
        }
        break;
      }
      case 'turret': {   // crosshair box
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.beginPath();
        ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 1.6, 0);
        ctx.moveTo(0, -r * 1.6); ctx.lineTo(0, r * 1.6);
        ctx.stroke();
        break;
      }
      case 'salvager': { // magnet horseshoe
        ctx.beginPath();
        ctx.arc(0, r * 0.2, r, Math.PI, 0);
        ctx.moveTo(-r, r * 0.2); ctx.lineTo(-r, r * 1.1);
        ctx.moveTo(r, r * 0.2); ctx.lineTo(r, r * 1.1);
        ctx.stroke();
        break;
      }
      case 'swarmer': {  // tiny dot cluster
        ctx.fillStyle = c;
        for (const [ox, oy] of [[-r * 0.7, 0], [r * 0.7, 0], [0, -r * 0.8]]) {
          ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'guard': {    // shield bracket
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.9);
        ctx.lineTo(0, -r * 1.2);
        ctx.lineTo(r * 0.7, -r * 0.9);
        ctx.stroke();
        break;
      }
      case 'flanker': {  // double side-arrows
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sgn * r * 0.9, -r * 0.5);
          ctx.lineTo(sgn * r * 1.25, 0);
          ctx.lineTo(sgn * r * 0.9, r * 0.5);
          ctx.stroke();
        }
        break;
      }
      case 'artillery': { // range ticks
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          ctx.moveTo(0, -r * (1.05 + i * 0.18));
          ctx.lineTo(0, -r * (1.12 + i * 0.18));
        }
        ctx.stroke();
        break;
      }
      case 'builder': {  // wrench angle
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, -r * 0.9);
        ctx.lineTo(-r * 0.5, -r * 0.5);
        ctx.moveTo(-r * 1.05, -r * 0.55);
        ctx.lineTo(-r * 0.55, -r * 1.05);
        ctx.stroke();
        break;
      }
      default: {         // strafer: orbit ring
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.15, 0.6, 0.6 + Math.PI * 1.5);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();

    // ELITE marker (§27): a rotating halo in the modifier's colour plus the
    // FORTIFIED barrier arc while it still holds. One glance = one modifier.
    if (this.isElite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(performance.now() / 700);
      ctx.strokeStyle = this.eliteColor || '#ffd23f';
      ctx.lineWidth = 5;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      if (this.frontBarrier > 0) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.aimY, this.aimX));
        ctx.strokeStyle = '#8fa3c8';
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.4 + 0.6 * Math.min(1, this.frontBarrier / 60);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 30, -1.0, 1.0);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

// Read once per spawn rather than cached, so changing difficulty between runs
// takes effect without any bookkeeping. Guarded: enemies must remain
// constructible in tests that never load Profile.
Enemy.hpMul = function () {
  if (typeof Profile === 'undefined' || !Profile.difficultyData) return 1;
  const h = Profile.difficultyData.hp;
  return (typeof h === 'number' && h > 0) ? h : 1;
};

// SCRAPCORE: BREAKLANDS — WARDEN PROTOTYPES (Milestone 17, Master v3.2 §22)
//
// Ten pieces of signature Warden hardware. They are ordinary components in
// every mechanical sense — attached to sockets, damaged, ripped, shielded by
// the same rules as everything else — with three special properties from §22:
//   * NOT G6 and NO Grade scaling (applyGradeToComponent refuses them);
//   * one permanent Rack copy each, recovered from the Warden that carried it;
//   * a player equip cap of 1 (PROTOTYPE SYNC raises the POWERED cap to 2;
//     Pure modes suppress the Schematic, so Pure stays 1).
//
// Every §22 table figure (Power/Load/HP/Conn HP and the locked effects) is
// implemented as written. Figures §22 does not give are marked (tune).
// Effects ride EXISTING pipes wherever one exists: magnet multipliers,
// heatCapBonus/coolingBonus/powerBonus, the outputMul chain, the melee
// grinder, the Mines/Projectiles systems — checked where APPLIED, not where
// set, because that is the recurring hole.

const PROTO_LIST = [
  'reclaimerMagnet', 'stitcherArm', 'dynamoCoil', 'roadblockRam',
  'siegeCannon', 'boremawDrill', 'crucibleCore', 'patchworkNode',
  'lockdownProjector', 'crownSingularity',
];

// Which Warden drops which Prototype (§22 Source column).
const PROTO_SOURCE = {
  RECLAIMER: 'reclaimerMagnet', STITCHER: 'stitcherArm', DYNAMO: 'dynamoCoil',
  ROADBLOCK: 'roadblockRam', WARMAKER: 'siegeCannon', BOREMAW: 'boremawDrill',
  CRUCIBLE: 'crucibleCore', PATCHWORK: 'patchworkNode',
  BAILIFF: 'lockdownProjector', KINGMAKER: 'crownSingularity',
};

Object.assign(PARTS, {
  // §22: Magnet range x1.55; pull x1.80; live-rip speed x1.60; RIP-ready
  // connector rip time -50%. The first three are the existing magnet stat
  // pipes; the last is ripTimeMul, honoured at the ONE rip accumulator.
  reclaimerMagnet: {
    id: 'reclaimerMagnet', name: 'RECLAIMER MAGNET', category: 'utility',
    prototype: true,
    powerCost: 4, loadCost: 3, hp: 65, connectorHp: 42, bodyRadius: 40,
    magnetRangeMul: 1.55, magnetPullMul: 1.80, ripSpeedMul: 1.60,
    ripTimeMul: 0.5,
    color: '#22d9ff',
  },

  // §22: after 3s calm, weakest attached module +7 HP/s AND its connector
  // +3 HP/s. Once per map the FIRST destroyed standard module is rebuilt at
  // 25% after 12s calm, if a legal socket is free. Rides the Repair Arm
  // machinery (same idle rule, same target choice).
  stitcherArm: {
    id: 'stitcherArm', name: 'STITCHER ARM', category: 'defence',
    prototype: true,
    powerCost: 4, loadCost: 4, hp: 60, connectorHp: 40, bodyRadius: 38,
    repairRate: 7, connRepairRate: 3, idleDelay: 3,
    rebuildDelay: 12, rebuildFrac: 0.25,
    color: '#a8e832',
  },

  // §22: +10 Power; Heat cap -10 while online. Both are existing stat
  // fields; recalcStats only reads ONLINE parts, so "while online" is free.
  dynamoCoil: {
    id: 'dynamoCoil', name: 'DYNAMO COIL', category: 'power',
    emissive: true,   // AARON, 7 Sep: a reactor glows, so it is never painted
    prototype: true,
    powerCost: 0, loadCost: 3, hp: 45, connectorHp: 34, bodyRadius: 34,
    powerBonus: 10, heatCapBonus: -10,
    color: '#ffd23f',
  },

  // §22: front ram damage +150%; knockback +80%; Dash impact +50%.
  // The BASE ram/dash-impact mechanic does not exist yet — it is the same
  // open question Aaron holds for the TRACK RAM Core Mod. Data is here and
  // LOCKED; the multipliers switch on when the base mechanic lands.
  roadblockRam: {
    id: 'roadblockRam', name: 'ROADBLOCK RAM', category: 'movement',
    prototype: true, engineNoop: true,
    powerCost: 2, loadCost: 5, hp: 110, connectorHp: 55, bodyRadius: 46,
    ramDamageMul: 2.5, ramKnockMul: 1.8, dashImpactMul: 1.5,
    color: '#ff7a1a',
  },

  // §22: 75 damage x0.45/s; Heat 26/shot; splash 220/25; recoil 1200.
  // Uses Cannon Mastery (masteryAs — handling, expertise and kill credit
  // all flow to the cannon track). Flight figures modelled on the Cannon (tune).
  siegeCannon: {
    id: 'siegeCannon', name: 'SIEGE CANNON', category: 'weapon',
    prototype: true, masteryAs: 'cannon',
    powerCost: 5, loadCost: 6, hp: 85, connectorHp: 48, bodyRadius: 48,
    damage: 75, fireRate: 0.45, heatPerShot: 26, recoil: 1200,
    splash: 220, splashDamage: 25,
    projSpeed: 950, projRadius: 26, projLife: 1.8, spread: 0.012,
    barrel: 72,
    color: '#ff3b5a',
  },

  // §22: 95 DPS; Heat 6/s; Connector damage x1.75; movement -20% while
  // engaged. The melee grinder family (same dispatch as Saw and Drill);
  // uses Drill Mastery.
  boremawDrill: {
    id: 'boremawDrill', name: 'BOREMAW DRILL', category: 'weapon',
    prototype: true, masteryAs: 'drill',
    powerCost: 4, loadCost: 5, hp: 90, connectorHp: 50, bodyRadius: 44,
    dps: 95, bladeRadius: 46, reach: 60, connMul: 1.75,
    heatPerSecond: 6, recoil: 0,
    engagedSlowMul: 0.8,
    barrel: 60,
    color: '#d08a1e',
  },

  // §22: +35 Heat cap; +6 cooling/s; Beam/Flame/Plasma weapon output +10%.
  crucibleCore: {
    id: 'crucibleCore', name: 'CRUCIBLE CORE', category: 'power',
    emissive: true,   // AARON, 7 Sep: a reactor glows, so it is never painted
    prototype: true,
    powerCost: 3, loadCost: 4, hp: 70, connectorHp: 44, bodyRadius: 38,
    heatCapBonus: 35, coolingBonus: 6, hotOutputMul: 1.10,
    color: '#ff5c1a',
  },

  // §22: field-salvaged non-Prototype parts attached after map start gain
  // +15% primary output and +15% max HP; max 4 at once, newest replaces
  // oldest. The magnet attach flow tags comps; Proto.update keeps the set.
  patchworkNode: {
    id: 'patchworkNode', name: 'PATCHWORK NODE', category: 'utility',
    prototype: true,
    powerCost: 4, loadCost: 3, hp: 55, connectorHp: 38, bodyRadius: 36,
    nodeMax: 4, nodeOutMul: 1.15, nodeHpMul: 1.15,
    color: '#9b5cff',
  },

  // §22: every 10s, a 1.5s field radius 350 — normal enemies movement -35%,
  // hostile projectile speed -25%, Wardens -10%.
  lockdownProjector: {
    id: 'lockdownProjector', name: 'LOCKDOWN PROJECTOR', category: 'defence',
    prototype: true,
    powerCost: 4, loadCost: 4, hp: 65, connectorHp: 42, bodyRadius: 40,
    fieldEvery: 10, fieldDur: 1.5, fieldRadius: 350,
    slowNormal: 0.65, slowWarden: 0.90, shotSlow: 0.75,
    color: '#4078ff',
  },

  // §22: whenever the Jackrig activates its Special, a 3s gravity field:
  // loose salvage pull x3; normal enemies pulled inward 20%; hostile
  // projectiles curve inward; Warden pull limited to 10%.
  crownSingularity: {
    id: 'crownSingularity', name: 'CROWN SINGULARITY', category: 'utility',
    prototype: true,
    powerCost: 5, loadCost: 5, hp: 75, connectorHp: 46, bodyRadius: 42,
    gravDur: 3, gravSalvageMul: 3, gravEnemy: 0.20, gravWarden: 0.10,
    color: '#fff3c4',
  },
});

// ---------------------------------------------------------------------------
const Proto = {
  BASE_PULL: 160,          // gravity-field base pull, u/s (tune)

  // Per-map state (Stitcher Arm's once-per-map rebuild). Nothing clears it
  // since the Campaign went: Block 1 decides what "once per map" means in
  // an open world, and calls resetMap() from there.
  // "Once per map" has no map to be once per since the Campaign went;
  // nothing in the game calls resetMap and the flag stays as it is. It
  // stays because test_m17 resets the Stitcher Arm with it (D351).
  mapState: { stitcherRebuilt: false },
  resetMap() { this.mapState = { stitcherRebuilt: false }; },

  isProto(partId) { return !!(PARTS[partId] && PARTS[partId].prototype); },

  // ---- equip cap (§22) ----------------------------------------------------
  // Player cap 1. Wardens use their own signature hardware, so only the
  // player is capped.
  equipCap(ent) {
    return ent.isPlayer ? 1 : 99;
  },

  attachAllowed(ent, partId) {
    if (!this.isProto(partId)) return true;
    if (!ent.isPlayer) return true;
    const mounted = ent.sockets.filter(s => s.comp && s.comp.part.prototype).length;
    return mounted < this.equipCap(ent);
  },

  // ---- ownership and recovery (§22) --------------------------------------
  owned(id) {
    return typeof Progress !== 'undefined' &&
      (Progress.protoOwned || []).includes(id);
  },

  own(id) {
    if (typeof Progress === 'undefined' || !PARTS[id]) return false;
    Progress.protoOwned = Progress.protoOwned || [];
    if (Progress.protoOwned.includes(id)) return false;
    Progress.protoOwned.push(id);
    return true;
  },

  // A FINAL-phase Warden died: its signature hardware hits the floor as a
  // real loose part — recover it and carry it out to keep it. §22: Crown
  // Singularity is ALSO auto-awarded on first Kingmaker victory, so the
  // ending can never strand the final Prototype.
  dropFromWarden(warden) {
    const id = PROTO_SOURCE[warden.bossName];
    if (!id) return;
    if (warden.bossName === 'KINGMAKER' && this.own('crownSingularity')) {
      if (typeof Effects !== 'undefined') {
        Effects.comicWord('CROWN SINGULARITY EARNED!', warden.x,
          warden.y - 320, '#fff3c4', 70);
      }
    }
    const a = Math.random() * Math.PI * 2;
    LooseParts.spawn(id, 1, warden.x, warden.y,
      Math.cos(a) * 260, Math.sin(a) * 260);
    if (typeof Effects !== 'undefined') {
      Effects.comicWord('PROTOTYPE!', warden.x, warden.y - 260,
        PARTS[id].color, 78);
      Effects.ring(warden.x, warden.y, 340, PARTS[id].color);
    }
  },

  // Crossing a clear boundary with the hardware banks it (§22 recovery).
  bank(player) {
    if (!player || !player.sockets) return;
    for (const s of player.sockets) {
      if (!s.comp || !s.comp.part.prototype) continue;
      if (this.own(s.comp.part.id) && typeof Effects !== 'undefined') {
        Effects.comicWord(s.comp.part.name + ' BANKED!', player.x,
          player.y - 260, s.comp.part.color, 66);
      }
    }
  },

  // ---- the live effects ---------------------------------------------------
  // Called from Machine.update for the player, every frame, with the live
  // target list — the one place all three field prototypes tick.
  update(dt, ent, targets) {
    if (!ent.isPlayer || !ent.sockets) return;
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c || !c.online) continue;
      if (c.part.id === 'lockdownProjector') this._tickLockdown(dt, ent, c, targets);
    }
    this._tickNode(ent);
    if (ent._gravT > 0) this._tickGravity(dt, ent, targets);
  },

  // LOCKDOWN PROJECTOR (§22): a 1.5s suppression field every 10 seconds.
  _tickLockdown(dt, ent, c, targets) {
    const p = c.part;
    c._lockT = (c._lockT === undefined ? 2.0 : c._lockT) - dt;   // first early
    if (c._lockT <= 0) {
      c._lockT = p.fieldEvery;
      c._lockFieldT = p.fieldDur;
      if (typeof Effects !== 'undefined') {
        Effects.ring(ent.x, ent.y, p.fieldRadius, p.color);
        Effects.comicWord('LOCKDOWN!', ent.x, ent.y - 200, p.color, 60);
      }
    }
    if (!(c._lockFieldT > 0)) return;
    c._lockFieldT -= dt;
    // The live field needs to be SEEN — sparks trace its edge while it holds.
    if (typeof Effects !== 'undefined' && Math.random() < dt * 40) {
      const a = Math.random() * Math.PI * 2;
      Effects.spark(ent.x + Math.cos(a) * p.fieldRadius,
        ent.y + Math.sin(a) * p.fieldRadius, a + Math.PI / 2, 1, p.color, 260);
    }
    for (const e of (targets || [])) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - ent.x, e.y - ent.y) > p.fieldRadius + (e.radius || 0)) continue;
      e._slowFieldT = 0.15;
      e._slowFieldMul = e.isWarden ? p.slowWarden : p.slowNormal;
    }
    // Hostile shots inside the field lose speed toward the §22 -25% floor.
    for (const pr of Projectiles.pool) {
      if (!pr.active || pr.owner !== 'enemy') continue;
      if (Math.hypot(pr.x - ent.x, pr.y - ent.y) > p.fieldRadius) continue;
      const v = Math.hypot(pr.vx, pr.vy);
      const floor = (pr.spd || v) * p.shotSlow;
      if (v > floor) {
        const k = Math.max(floor / v, Math.exp(-6 * dt));
        pr.vx *= k; pr.vy *= k;
      }
    }
  },

  // PATCHWORK NODE (§22): the newest 4 field-salvaged standard parts carry
  // +15% output and +15% max HP while a Node is attached and online. The
  // magnet attach flow marks `comp.fieldAttached`; this keeps the set.
  _tickNode(ent) {
    const node = ent.sockets.find(s => s.comp && s.comp.online &&
      s.comp.part.id === 'patchworkNode');
    const tagged = [];
    for (const s of ent.sockets) {
      const c = s.comp;
      if (c && c.fieldAttached && !c.part.prototype) tagged.push(c);
    }
    tagged.sort((a, b) => (b.order || 0) - (a.order || 0));   // newest first
    // §22: max 4 simultaneously, newest replaces oldest — and no Node online
    // means no boosts at all.
    const keep = node ? tagged.slice(0, PARTS.patchworkNode.nodeMax) : [];
    for (const c of tagged) {
      const should = keep.includes(c);
      if (should && !c._nodeBoost) {
        c._nodeBoost = true;
        c.maxHp = Math.round(c.maxHp * PARTS.patchworkNode.nodeHpMul);
        c.hp = Math.min(c.maxHp, Math.round(c.hp * PARTS.patchworkNode.nodeHpMul));
      } else if (!should && c._nodeBoost) {
        c._nodeBoost = false;
        c.maxHp = Math.round(c.maxHp / PARTS.patchworkNode.nodeHpMul);
        c.hp = Math.min(c.hp, c.maxHp);
      }
    }
  },

  // CROWN SINGULARITY (§22): armed by Special activation (Mods.activate
  // calls onSpecial); a 3s gravity field around the player.
  onSpecial(ent) {
    const has = ent.sockets && ent.sockets.some(s => s.comp && s.comp.online &&
      s.comp.part.id === 'crownSingularity');
    if (!has) return;
    ent._gravT = PARTS.crownSingularity.gravDur;
    if (typeof Effects !== 'undefined') {
      Effects.ring(ent.x, ent.y, 600, PARTS.crownSingularity.color);
      Effects.comicWord('SINGULARITY!', ent.x, ent.y - 260,
        PARTS.crownSingularity.color, 72);
    }
  },

  _tickGravity(dt, ent, targets) {
    const p = PARTS.crownSingularity;
    ent._gravT -= dt;
    const pull = this.BASE_PULL;
    for (const it of (LooseParts.items || [])) {
      const d = Math.hypot(it.x - ent.x, it.y - ent.y) || 1;
      it.x -= (it.x - ent.x) / d * pull * p.gravSalvageMul * dt;
      it.y -= (it.y - ent.y) / d * pull * p.gravSalvageMul * dt;
    }
    for (const e of (targets || [])) {
      if (!e.alive) continue;
      const frac = e.isWarden ? p.gravWarden : p.gravEnemy;   // §22: 10% cap
      const d = Math.hypot(e.x - ent.x, e.y - ent.y) || 1;
      e.x -= (e.x - ent.x) / d * pull * frac * dt * 5;
      e.y -= (e.y - ent.y) / d * pull * frac * dt * 5;
    }
    for (const pr of Projectiles.pool) {
      if (!pr.active || pr.owner !== 'enemy') continue;
      const d = Math.hypot(pr.x - ent.x, pr.y - ent.y) || 1;
      const bend = 700 * dt;
      pr.vx -= (pr.x - ent.x) / d * bend;
      pr.vy -= (pr.y - ent.y) / d * bend;
    }
    if (typeof Effects !== 'undefined' && Math.random() < dt * 24) {
      const a = Math.random() * Math.PI * 2;
      const rr = 260 + Math.random() * 380;
      Effects.spark(ent.x + Math.cos(a) * rr, ent.y + Math.sin(a) * rr,
        a + Math.PI, 1, p.color, 480);
    }
  },
};

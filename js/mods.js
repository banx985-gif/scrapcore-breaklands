// SCRAPCORE: BREAKLANDS — Core Mods, Jackrig Tuning, Core Charge and the six
// Specials (Milestone 12). Master v3.2 §18 (Core Mods), §19 (Tuning),
// §20 (Core Charge / Specials).
//
//
// THE HEAVY TAG (Master §21 note, LOCKED): a weapon is Heavy if
// `weapon && Load >= 4 && !melee`, DERIVED at runtime, never a list — six
// systems read it and a Load retune must move all six at once.
//
// Magnitudes the Master states are implemented verbatim. Where it names an
// effect without a number ("stronger", "major", "much lower") the number
// here is a FIRST PASS marked (tune) — Aaron's to move.

const CORE_MODS = {
  // ---- JACKAL -------------------------------------------------------------
  quickClamp: { id: 'quickClamp', rig: 'jackal', name: 'QUICK CLAMP',
    text: 'Rip time -20%; attach pull +20%', default: true,
    ripSpeedMul: 1.25, magnetPullMul: 1.2 },   // -20% time = x1.25 speed
  fieldWelder: { id: 'fieldWelder', rig: 'jackal', name: 'FIELD WELDER',
    text: 'After a cleared fight, repairs the most damaged module by 20%',
    unlock: { text: 'Attach 100 salvage parts', counter: 'attachSalvage', need: 100 },
    clearRepairFrac: 0.20 },
  cleanSalvage: { id: 'cleanSalvage', rig: 'jackal', name: 'CLEAN SALVAGE',
    text: 'Magnet range +10%; detached parts keep +20% more HP',
    unlock: { text: 'Rip 150 intact parts', counter: 'intactRip', need: 150 },
    magnetRangeMul: 1.10, salvageHpMul: 1.20 },

  // ---- VIPER --------------------------------------------------------------
  slipstream: { id: 'slipstream', rig: 'viper', name: 'SLIPSTREAM',
    text: 'Dash cooldown -15%', default: true, dashCdMul: 0.85 },
  hotRod: { id: 'hotRod', rig: 'viper', name: 'HOT ROD',
    text: 'Above 60 Heat: movement +12%',
    unlock: { text: 'Finish 3 fights above 60 Heat', counter: 'hotFights', need: 3,
              wired: false },
    hotSpeedMul: 1.12, hotThreshold: 60 },
  backblast: { id: 'backblast', rig: 'viper', name: 'BACKBLAST',
    text: 'Heavy recoil: movement +20% for 0.6s; next shot in the window +10%',
    unlock: { text: '50 kills within 2s of a Dash', counter: 'dashKill', need: 50 },
    windowT: 0.6, windowSpeedMul: 1.20, windowDmgMul: 1.10, kickAt: 300 },

  // ---- IRONCLAD -----------------------------------------------------------
  bastionPlating: { id: 'bastionPlating', rig: 'ironclad', name: 'BASTION PLATING',
    text: 'Defence-part HP +20%', default: true, defenceHpMul: 1.20 },
  grounded: { id: 'grounded', rig: 'ironclad', name: 'GROUNDED',
    text: 'Recoil and knockback -50%',
    unlock: { text: 'Beat Warmaker with 4+ Defence/Structure modules',
              counter: 'warmakerTank', need: 1, wired: false },
    recoilMul: 0.5, knockbackMul: 0.5 },
  fortressGrid: { id: 'fortressGrid', rig: 'ironclad', name: 'FORTRESS GRID',
    text: '+2 Power, +4 Load, movement -5%',
    unlock: { text: 'Sustain 24+ Power in use for 90s', counter: 'powered90',
              need: 90, wired: false },
    powerBonus: 2, loadCapAdd: 4, speedMul: 0.95 },

  // ---- MAMMOTH ------------------------------------------------------------
  loadBearer: { id: 'loadBearer', rig: 'mammoth', name: 'LOAD BEARER',
    text: '+8 Load', default: true, loadCapAdd: 8 },
  heavyMount: { id: 'heavyMount', rig: 'mammoth', name: 'HEAVY MOUNT',
    text: 'Heavy weapons: Heat -15%, recoil -30%',
    unlock: { text: '25,000 Heavy-weapon damage', counter: 'heavyDamage', need: 25000 },
    heavyHeatMul: 0.85, heavyKickMul: 0.70 },
  trackRam: { id: 'trackRam', rig: 'mammoth', name: 'TRACK RAM',
    text: 'Ram damage +75%; Dash collision +25%',
    unlock: { text: '50 ram or Dash kills', counter: 'ramKill', need: 50, wired: false },
    // engineNoop: the player deals no collision damage in this engine yet.
    // The mod equips and records itself; the day ramming exists it wakes up.
    engineNoop: 'player collision damage does not exist yet' },

  // ---- MANTIS -------------------------------------------------------------
  bladeDance: { id: 'bladeDance', rig: 'mantis', name: 'BLADE DANCE',
    text: 'Melee damage +15% while moving', default: true,
    movingMeleeMul: 1.15 },
  sidewinder: { id: 'sidewinder', rig: 'mantis', name: 'SIDEWINDER',
    text: 'Dash cooldown -10%; Dash can curve during its first moments',
    unlock: { text: '100 moving melee kills', counter: 'meleeMoveKill', need: 100,
              wired: false },
    dashCdMul: 0.90, dashCurve: true },
  webClamp: { id: 'webClamp', rig: 'mantis', name: 'WEB CLAMP',
    text: 'Melee and Structure connector HP +20%',
    unlock: { text: '50 close-range rips', counter: 'closeRip', need: 50 },
    clampConnMul: 1.20 },   // grapple range +15% waits for the Grapple Winch

  // ---- HIVE ---------------------------------------------------------------
  autoLogic: { id: 'autoLogic', rig: 'hive', name: 'AUTO LOGIC',
    text: 'Drone and auto-weapon fire rate +10%', default: true,
    autoRateMul: 1.10 },
  droneSwarm: { id: 'droneSwarm', rig: 'hive', name: 'DRONE SWARM',
    text: '+1 drone',
    unlock: { text: '200 drone/auto kills', counter: 'autoKill', need: 200 },
    extraDrones: 1 },
  powerBus: { id: 'powerBus', rig: 'hive', name: 'POWER BUS',
    text: 'Utility parts cost 1 less Power (minimum 1)',
    unlock: { text: 'Clear a screen with 5 Utility/Power modules',
              counter: 'utilScreen', need: 1, wired: false },
    utilityPowerCut: 1 },
};

// §19 — five ranks per rig, 10/20/35/55/80 = 200 SCRAP, Powered-only.
const TUNING_COSTS = [10, 20, 35, 55, 80];
const TUNING = {
  jackal:   { name: 'SALVAGE CORE',      perRank: { magnetRange: 0.04, ripSpeed: 0.03 },
    finals: [
      { id: 'vacuum',     name: 'VACUUM',      text: 'Salvage Surge radius +35%' },
      { id: 'fieldMedic', name: 'FIELD MEDIC', text: 'Attaching restores 12% part HP and 3% Core HP' }] },
  viper:    { name: 'ENGINE TUNE',       perRank: { speed: 0.02, recoilConvert: 0.03 },
    finals: [
      { id: 'afterburner', name: 'AFTERBURNER', text: 'REDLINE Dash recharge near-instant' },
      { id: 'gunslinger',  name: 'GUNSLINGER',  text: 'REDLINE fires faster still (tune)' }] },
  ironclad: { name: 'FORTRESS REACTOR',  perRank: { shieldRegen: 0.04, slowResist: 0.02 },
    finals: [
      { id: 'immortalWall', name: 'IMMORTAL WALL', text: 'Fortress stronger and longer (tune)' },
      { id: 'returnFire',   name: 'RETURN FIRE',   text: 'Fortress grants weapon bonus (tune)' }] },
  mammoth:  { name: 'SIEGE CALIBRATION', perRank: { heavyDamage: 0.03, heavyRecoil: 0.03 },
    finals: [
      { id: 'bigGuns',        name: 'BIG GUNS',        text: 'Bombardment hits harder, wider (tune)' },
      { id: 'endlessBarrage', name: 'ENDLESS BARRAGE', text: 'Bombardment runs far cooler (tune)' }] },
  mantis:   { name: 'PREDATOR DRIVE',    perRank: { meleeDamage: 0.03, speed: 0.02 },
    finals: [
      { id: 'ripper', name: 'RIPPER', text: 'Predator: major connector/rip bonus (tune)' },
      { id: 'hunter', name: 'HUNTER', text: 'Kills extend Predator more strongly' }] },
  hive:     { name: 'SWARM LOGIC',       perRank: { autoRate: 0.04, acquisition: 0.03 },
    finals: [
      { id: 'horde',    name: 'HORDE',    text: 'More temporary drones (tune)' },
      { id: 'surgical', name: 'SURGICAL', text: 'Drones hunt exposed connectors' }] },
};

// §20 — the six Specials. Base numbers are LOCKED; finals modify them.
const SPECIALS = {
  jackal:   { id: 'salvageSurge', name: 'SALVAGE SURGE', dur: 6.0,
    magnetRangeMul: 2.20, magnetPullMul: 2.50, ripSpeedMul: 2.50,
    attachHealFrac: 0.15 },
  viper:    { id: 'redline', name: 'REDLINE', dur: 5.0,
    speedMul: 1.35, dashCd: 0.45, rateMul: 1.20, convertMul: 1.75,
    knockbackMul: 0.75 },
  ironclad: { id: 'fortress', name: 'FORTRESS MODE', dur: 5.0,
    speedMul: 0.55, coreDamageMul: 0.40, connInMul: 0.65,
    shieldRegenMul: 4.0, shieldDelayMul: 0.35, recoilMul: 0.10,
    knockbackMul: 0.10 },
  mammoth:  { id: 'bombardment', name: 'BOMBARDMENT', dur: 6.0,
    heavyDmgMul: 1.25, heavySplashMul: 1.20, heavyHeatMul: 0.40,
    heavyKickMul: 0.20, heavyRateMul: 1.10 },
  mantis:   { id: 'predator', name: 'PREDATOR', dur: 6.0,
    speedMul: 1.25, meleeDmgMul: 1.35, connOutMul: 1.50, ripSpeedMul: 1.30,
    killExt: 0.35, eliteExt: 0.75, extCap: 3.0 },
  hive:     { id: 'swarmProtocol', name: 'SWARM PROTOCOL', dur: 7.0,
    tempDrones: 3, autoRateMul: 1.30, droneRespawn: 1.0,
    preferConnectors: true },
};

// §20 charge generation, locked.
const CHARGE = {
  cap: 100, perDamage: 1 / 30, damageRateCap: 6,   // charge/sec from damage (tune)
  connector: 4, kill: 3, eliteKill: 6, rip: 8, wardenRip: 15, retreat: 10,
};

const Mods = {
  equipped: {},        // rigId -> modId (absent = the rig's default)
  unlocked: {},        // modId -> true (defaults are always unlocked)
  ranks: {},           // rigId -> 0..5
  finals: {},          // rigId -> final id or null
  counters: {},        // unlock progress

  reset() { this.equipped = {}; this.unlocked = {}; this.ranks = {}; this.finals = {}; this.counters = {}; },

  modsFor(rig) { return Object.values(CORE_MODS).filter(m => m.rig === rig); },
  defaultFor(rig) { return this.modsFor(rig).find(m => m.default); },

  isUnlocked(id) {
    const m = CORE_MODS[id];
    return !!m && (m.default || !!this.unlocked[id]);
  },

  equip(rig, id) {
    const m = CORE_MODS[id];
    if (!m || m.rig !== rig || !this.isUnlocked(id)) return false;
    this.equipped[rig] = id;
    return true;
  },

  // The equipped Core Mod — base identity, so NO Powered gate (§18).
  mod(ent) {
    if (!ent || !ent.isPlayer || !ent.jackrigId) return null;
    const id = this.equipped[ent.jackrigId];
    const m = id && this.isUnlocked(id) ? CORE_MODS[id] : null;
    return m || this.defaultFor(ent.jackrigId) || null;
  },

  // ---- Tuning (§19) — Powered only ---------------------------------------
  rankOf(rig) { return this.ranks[rig] || 0; },
  rankCost(rig) {
    const r = this.rankOf(rig);
    return r >= 5 ? null : TUNING_COSTS[r];
  },
  buyRank(rig) {
    const cost = this.rankCost(rig);
    if (cost === null || !TUNING[rig]) return false;
    if (typeof Forge === 'undefined' || Forge.scrap < cost) return false;
    Forge.scrap -= cost;
    this.ranks[rig] = this.rankOf(rig) + 1;
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    return true;
  },
  setFinal(rig, finalId) {
    const t = TUNING[rig];
    if (!t || this.rankOf(rig) < 5) return false;
    if (!t.finals.some(f => f.id === finalId)) return false;
    this.finals[rig] = finalId;               // free to switch at the Yard (§19)
    return true;
  },
  tune(ent, key) {   // rank * per
    if (!ent || !ent.isPlayer || !ent.jackrigId) return 0;
    const t = TUNING[ent.jackrigId];
    if (!t || t.perRank[key] === undefined) return 0;
    return this.rankOf(ent.jackrigId) * t.perRank[key];
  },
  final(ent) {       // the chosen specialization, rank 5 only
    if (!ent || !ent.isPlayer || !ent.jackrigId) return null;
    if (this.rankOf(ent.jackrigId) < 5) return null;
    return this.finals[ent.jackrigId] || null;
  },

  // ---- THE HEAVY TAG (§21 note, locked rule — never a list) ---------------
  isHeavy(part) {
    if (!part || part.category !== 'weapon') return false;
    const melee = part.dps !== undefined && !part.beam;   // Saw now, Drill later
    return (part.loadCost || 0) >= 4 && !melee;
  },

  // ---- the special that is live on this machine ---------------------------
  sp(ent, id) {
    if (!ent || !ent.special) return null;
    if (id && ent.special.id !== id) return null;
    return SPECIALS[ent.jackrigId] && SPECIALS[ent.jackrigId].id === ent.special.id
      ? SPECIALS[ent.jackrigId] : null;
  },

  // ======================= STAT LAYER ======================================
  // Called at the END of Machine.recalcStats (after Forge). Core Mods and
  // the live Special multiply here; Tuning adds inside, self-gated.
  applyStats(ent) {
    if (!ent || !ent.isPlayer) return;
    const m = this.mod(ent);
    if (m) {
      if (m.ripSpeedMul) ent.ripSpeedMul *= m.ripSpeedMul;
      if (m.magnetPullMul) ent.magnetPullMul *= m.magnetPullMul;
      if (m.magnetRangeMul) ent.magnetRangeMul *= m.magnetRangeMul;
      if (m.dashCdMul) ent.dashCdMul *= m.dashCdMul;
      if (m.recoilMul) ent.recoilMul *= m.recoilMul;
      if (m.knockbackMul) ent.knockbackMul *= m.knockbackMul;
      if (m.speedMul) ent.speedMul *= m.speedMul;
    }
    ent.magnetRangeMul *= 1 + this.tune(ent, 'magnetRange');
    ent.ripSpeedMul *= 1 + this.tune(ent, 'ripSpeed');
    ent.speedMul *= 1 + this.tune(ent, 'speed');

    const s = this.sp(ent);
    if (s) {
      if (s.speedMul) ent.speedMul *= s.speedMul;
      if (s.knockbackMul) ent.knockbackMul *= s.knockbackMul;
      if (s.recoilMul) ent.recoilMul *= s.recoilMul;
      if (s.magnetPullMul) ent.magnetPullMul *= s.magnetPullMul;
      if (s.ripSpeedMul) ent.ripSpeedMul *= s.ripSpeedMul;
      if (s.magnetRangeMul) {
        let r = s.magnetRangeMul;
        if (this.final(ent) === 'vacuum') r *= 1.35;
        ent.magnetRangeMul *= r;
      }
      if (s.coreDamageMul) {
        ent.coreDamageMul = (ent.coreDamageMul || 1) *
          (this.final(ent) === 'immortalWall' ? 0.30 : s.coreDamageMul);
      }
    }
  },

  // Per-frame movement factor for the heat/window effects that cannot live in
  // a recalc (they change every frame).
  dynamicSpeedMul(ent) {
    let f = 1;
    const m = this.mod(ent);
    if (m && m.hotSpeedMul && ent.heat > m.hotThreshold) f *= m.hotSpeedMul;
    if (m && m.windowSpeedMul && ent._backblastT > 0) f *= m.windowSpeedMul;
    return f;
  },

  // Weapon damage, per shot. `moving` matters to Mantis only.
  damageMul(ent, part) {
    if (!ent || !ent.isPlayer) return 1;
    let f = 1;
    const heavy = this.isHeavy(part);
    const melee = part && part.dps !== undefined && !part.beam;
    if (heavy) {
      f *= 1 + this.tune(ent, 'heavyDamage');
      const s = this.sp(ent, 'bombardment');
      if (s) f *= this.final(ent) === 'bigGuns' ? 1.40 : s.heavyDmgMul;
    }
    if (melee) {
      f *= 1 + this.tune(ent, 'meleeDamage');
      const m = this.mod(ent);
      const moving = (ent.vx * ent.vx + ent.vy * ent.vy) > 100 * 100;
      if (m && m.movingMeleeMul && moving) f *= m.movingMeleeMul;
      const s = this.sp(ent, 'predator');
      if (s) f *= s.meleeDmgMul;
    }
    const m2 = this.mod(ent);
    if (m2 && m2.windowDmgMul && ent._backblastShot) {
      f *= m2.windowDmgMul;
      ent._backblastShot = false;               // one shot, then it is spent
    }
    if (this.sp(ent, 'fortress') && this.final(ent) === 'returnFire') f *= 1.15;
    return f;
  },

  rateMul(ent, part) {
    if (!ent || !ent.isPlayer) return 1;
    let f = 1;
    const sR = this.sp(ent, 'redline');
    if (sR) f *= this.final(ent) === 'gunslinger' ? sR.rateMul * 1.15 : sR.rateMul;
    if (this.isHeavy(part)) {
      const sB = this.sp(ent, 'bombardment');
      if (sB) f *= sB.heavyRateMul;
    }
    if (this.sp(ent, 'fortress') && this.final(ent) === 'returnFire') f *= 1.10;
    return f;
  },

  heatMul(ent, part) {
    if (!ent || !ent.isPlayer || !this.isHeavy(part)) return 1;
    let f = 1;
    const m = this.mod(ent);
    if (m && m.heavyHeatMul) f *= m.heavyHeatMul;
    const s = this.sp(ent, 'bombardment');
    if (s) f *= this.final(ent) === 'endlessBarrage' ? 0.15 : s.heavyHeatMul;
    return f;
  },

  kickMul(ent, part) {
    if (!ent || !ent.isPlayer) return 1;
    let f = 1;
    if (this.isHeavy(part)) {
      f *= 1 - this.tune(ent, 'heavyRecoil');
      const m = this.mod(ent);
      if (m && m.heavyKickMul) f *= m.heavyKickMul;
      const s = this.sp(ent, 'bombardment');
      if (s) f *= s.heavyKickMul;
    }
    return f;
  },

  // Viper: the fraction of recoil that becomes FORWARD motion.
  recoilConvert(ent) {
    if (!ent || !ent.isPlayer) return 0;
    let c = this.tune(ent, 'recoilConvert');
    const s = this.sp(ent, 'redline');
    if (s) c *= s.convertMul;
    return Math.min(0.9, c);
  },

  shieldRegenMul(ent) {
    if (!ent || !ent.isPlayer) return 1;
    let f = 1 + this.tune(ent, 'shieldRegen');
    const s = this.sp(ent, 'fortress');
    if (s) f *= s.shieldRegenMul;
    return f;
  },
  shieldDelayMul(ent) {
    const s = this.sp(ent, 'fortress');
    return s ? s.shieldDelayMul : 1;
  },

  loadCapAdd(ent) {
    const m = this.mod(ent);
    return (m && m.loadCapAdd) || 0;
  },
  powerBonus(ent) {
    const m = this.mod(ent);
    return (m && m.powerBonus) || 0;
  },
  utilityPowerCut(ent) {
    const m = this.mod(ent);
    return (m && m.utilityPowerCut) || 0;
  },

  autoRateMul(ent) {
    if (!ent || !ent.isPlayer) return 1;
    let f = 1 + this.tune(ent, 'autoRate');
    const m = this.mod(ent);
    if (m && m.autoRateMul) f *= m.autoRateMul;
    const s = this.sp(ent, 'swarmProtocol');
    if (s) f *= s.autoRateMul;
    return f;
  },
  extraDrones(ent) {
    let n = 0;
    const m = this.mod(ent);
    if (m && m.extraDrones) n += m.extraDrones;
    const s = this.sp(ent, 'swarmProtocol');
    if (s) n += this.final(ent) === 'horde' ? 5 : s.tempDrones;
    return n;
  },
  droneRespawn(ent, base) {
    const s = this.sp(ent, 'swarmProtocol');
    return s ? s.droneRespawn : base;
  },
  dronesPreferConnectors(ent) {
    if (this.sp(ent, 'swarmProtocol')) return true;
    return this.final(ent) === 'surgical';
  },

  // Connector damage the PLAYER deals (Predator) and receives (Fortress).
  connOutMul(ent) {
    const s = this.sp(ent, 'predator');
    if (!s) return 1;
    return this.final(ent) === 'ripper' ? 2.0 : s.connOutMul;
  },
  connInMul(ent) {
    const s = this.sp(ent, 'fortress');
    return s ? s.connInMul : 1;
  },
  // Damage resistance while crawling (Ironclad tuning): below 30% max speed.
  slowResistMul(ent) {
    const t = this.tune(ent, 'slowResist');
    if (!t) return 1;
    const spd = Math.hypot(ent.vx || 0, ent.vy || 0);
    const max = ent.maxSpeed || 1;
    return spd < max * 0.30 ? 1 - t : 1;
  },

  // Attach-time hooks: plating HP, welds and heals.
  onAttach(ent, comp) {
    if (!ent || !ent.isPlayer || !comp) return;
    const m = this.mod(ent);
    if (m && m.defenceHpMul && comp.part.category === 'defence') {
      comp.maxHp *= m.defenceHpMul;
      comp.hp *= m.defenceHpMul;
    }
    if (m && m.clampConnMul) {
      const melee = comp.part.dps !== undefined && !comp.part.beam;
      if (melee || comp.part.category === 'structure') {
        comp.maxConnectorHp *= m.clampConnMul;
        comp.connectorHp *= m.clampConnMul;
      }
    }
    const s = this.sp(ent, 'salvageSurge');
    if (s) comp.hp = Math.min(comp.maxHp, comp.hp + comp.maxHp * s.attachHealFrac);
    if (this.final(ent) === 'fieldMedic') {
      comp.hp = Math.min(comp.maxHp, comp.hp + comp.maxHp * 0.12);
      if (ent.maxHp) ent.hp = Math.min(ent.maxHp, ent.hp + ent.maxHp * 0.03);
    }
  },

  // Field Welder: the cleared-fight repair (§18).
  onFightCleared(ent) {
    const m = this.mod(ent);
    if (!m || !m.clearRepairFrac || !ent.sockets) return;
    let worst = null, f = 1;
    for (const s of ent.sockets) {
      if (!s.comp) continue;
      const frac = s.comp.hp / s.comp.maxHp;
      if (frac < f) { f = frac; worst = s.comp; }
    }
    if (worst && f < 1) {
      worst.hp = Math.min(worst.maxHp, worst.hp + worst.maxHp * m.clearRepairFrac);
      if (typeof Effects !== 'undefined' && Machine._xpPlayer) {
        Effects.comicWord('FIELD WELD', ent.x, ent.y - 200, CONFIG.COLOR.lime, 52);
      }
    }
  },

  // Clean Salvage: parts the player shears off land healthier.
  salvageHpMul() {
    const p = typeof Machine !== 'undefined' && Machine._xpPlayer;
    const m = p && this.mod(p);
    return (m && m.salvageHpMul) || 1;
  },

  // Backblast: called with every kick the player's own guns give.
  noteKick(ent, kick) {
    const m = this.mod(ent);
    if (m && m.windowT && kick >= m.kickAt) {
      ent._backblastT = m.windowT;
      ent._backblastShot = true;
    }
  },

  // ======================= CORE CHARGE (§20) ===============================
  charge(ent) { return (ent && ent.charge) || 0; },
  ready(ent) { return this.charge(ent) >= CHARGE.cap && !ent.special; },

  addCharge(ent, n) {
    if (!ent || !ent.isPlayer || ent.special) return;   // no banking mid-special
    ent.charge = Math.min(CHARGE.cap, (ent.charge || 0) + n);
    if (ent.charge >= CHARGE.cap && !ent._readySaid) {
      ent._readySaid = true;
      if (typeof Effects !== 'undefined') {
        Effects.comicWord('SPECIAL READY', ent.x, ent.y - 240, CONFIG.COLOR.cyan, 72);
      }
      if (typeof Audio_ !== 'undefined') Audio_.play('rankUp');
    }
  },

  // Damage-sourced charge is rate-capped (§20 "rate-capped").
  addChargeDamage(ent, dmg) {
    if (!ent || !ent.isPlayer) return;
    ent._chargeBank = Math.min(CHARGE.damageRateCap,
      (ent._chargeBank || 0) + dmg * CHARGE.perDamage);
  },

  event(ent, kind) {
    let n = CHARGE[kind];
    if (n) this.addCharge(ent, n);
    // Predator: kills stretch the Special while it runs.
    const s = this.sp(ent, 'predator');
    if (s && (kind === 'kill' || kind === 'eliteKill') && ent.special) {
      const ext = kind === 'kill' ? s.killExt : s.eliteExt;
      const mul = this.final(ent) === 'hunter' ? 2 : 1;
      const cap = s.extCap * mul;
      const used = ent.special.extUsed || 0;
      const add = Math.min(ext * mul, cap - used);
      if (add > 0) { ent.special.t += add; ent.special.extUsed = used + add; }
    }
  },

  activate(ent) {
    if (!this.ready(ent)) return false;
    const s = SPECIALS[ent.jackrigId];
    if (!s) return false;
    ent.charge = 0;
    ent._readySaid = false;
    ent.special = { id: s.id, t: s.dur, extUsed: 0 };
    // CROWN SINGULARITY (§22): every Special activation also opens the
    // 3s gravity field while the Prototype is mounted and online.
    if (typeof Proto !== 'undefined') Proto.onSpecial(ent);
    if (s.id === 'fortress' && this.final(ent) === 'immortalWall') ent.special.t += 2;
    if (typeof Machine !== 'undefined') Machine.recalcStats(ent);
    if (typeof Effects !== 'undefined') {
      Effects.comicWord(s.name + '!', ent.x, ent.y - 240, CONFIG.COLOR.cyan, 84);
      Effects.ring(ent.x, ent.y, 220, CONFIG.COLOR.cyan);
    }
    if (typeof Camera !== 'undefined') Camera.shake(6, 0.25);
    if (typeof Audio_ !== 'undefined') Audio_.play('victory', { gain: 0.5 });
    return true;
  },

  update(dt, ent) {
    if (!ent || !ent.isPlayer) return;
    // drain the rate-capped damage bank into the meter
    if (ent._chargeBank > 0) {
      const drip = Math.min(ent._chargeBank, CHARGE.damageRateCap * dt);
      ent._chargeBank -= drip;
      this.addCharge(ent, drip);
    }
    if (ent._backblastT > 0) ent._backblastT -= dt;
    if (ent.special) {
      ent.special.t -= dt;
      if (ent.special.t <= 0) {
        ent.special = null;
        if (typeof Machine !== 'undefined') Machine.recalcStats(ent);
        if (typeof Effects !== 'undefined') {
          Effects.comicWord('SPECIAL SPENT', ent.x, ent.y - 200, CONFIG.COLOR.steel, 48);
        }
      }
    }
  },

  // ---- unlock counters ----------------------------------------------------
  note(key, n = 1) {
    this.counters[key] = (this.counters[key] || 0) + n;
    for (const m of Object.values(CORE_MODS)) {
      if (!m.unlock || m.unlock.counter !== key) continue;
      if (this.unlocked[m.id] || this.counters[key] < m.unlock.need) continue;
      this.unlocked[m.id] = true;
      if (typeof Effects !== 'undefined' && typeof Machine !== 'undefined'
          && Machine._xpPlayer) {
        const p = Machine._xpPlayer;
        Effects.comicWord('CORE MOD: ' + m.name, p.x, p.y - 280,
          CONFIG.COLOR.yellow, 56);
      }
    }
  },

  snapshot() {
    return {
      equipped: Object.assign({}, this.equipped),
      unlocked: Object.assign({}, this.unlocked),
      ranks: Object.assign({}, this.ranks),
      finals: Object.assign({}, this.finals),
      counters: Object.assign({}, this.counters),
    };
  },

  restore(d) {
    this.reset();
    if (!d) return false;
    for (const k of ['unlocked', 'counters']) {
      if (d[k]) this[k] = Object.assign({}, d[k]);
    }
    for (const rig of Object.keys(d.ranks || {})) {
      if (TUNING[rig]) this.ranks[rig] = Math.min(5, Math.max(0, Math.round(d.ranks[rig])));
    }
    for (const rig of Object.keys(d.finals || {})) {
      const t = TUNING[rig];
      if (t && t.finals.some(f => f.id === d.finals[rig])) this.finals[rig] = d.finals[rig];
    }
    for (const rig of Object.keys(d.equipped || {})) {
      const m = CORE_MODS[d.equipped[rig]];
      if (m && m.rig === rig && this.isUnlocked(m.id)) this.equipped[rig] = m.id;
    }
    return true;
  },
};

// SCRAPCORE: BREAKLANDS — SCRAP and the Core Forge (Milestone 2 slice)
// Master v3.2 §14.
//
// SCRAP is the ONLY permanent spendable currency. It is never sold, never
// bought, never converted from anything else. One currency, one sink, no
// second economy to balance against itself.
//
// M2 built the bank and ONE track; M7/M8 added Power Grid, Heat Bank and
// Cooling Loop; M11 (25 Aug) implements the remaining six, so all ten §14
// tracks are now real and buyable. Where each effect lands:
//   coreIntegrity  applyTo -> maxHp            powerGrid   applyTo -> power
//   heatBank       applyTo -> heatCap          coolingLoop applyTo -> cooling
//   driveMotors    applyStats -> speedMul      corePlating applyStats -> coreDamageMul
//   magnetArray    applyStats -> magnet muls   dashCapacitor applyStats -> dashCdMul
//   weaponOutput   Machine.outputMul reads damageMul() directly
//   fireControl    Machine._rate reads rateMul() directly
// The applyStats four multiply into fields recalcStats REBUILDS from scratch
// every call; the two read-directly ones live on fields that persist between
// recalcs, where a *= would compound itself — that is why they differ.

// Master §14 cost curves.
const FORGE_COST_10 = [3, 5, 7, 10, 14, 19, 25, 32, 40, 50];   // total 205
const FORGE_COST_5  = [8, 14, 22, 34, 50];                     // total 128

const FORGE_TRACKS = {
  coreIntegrity: { id: 'coreIntegrity', name: 'CORE INTEGRITY', levels: 10,
    per: 0.03, unit: '% Core HP', costs: FORGE_COST_10, implemented: true },
  driveMotors:   { id: 'driveMotors',   name: 'DRIVE MOTORS',   levels: 10,
    per: 0.02, unit: '% movement', costs: FORGE_COST_10, implemented: true },
  weaponOutput:  { id: 'weaponOutput',  name: 'WEAPON OUTPUT',  levels: 10,
    per: 0.02, unit: '% weapon damage', costs: FORGE_COST_10, implemented: true },
  fireControl:   { id: 'fireControl',   name: 'FIRE CONTROL',   levels: 10,
    per: 0.015, unit: '% activation rate', costs: FORGE_COST_10, implemented: true },
  corePlating:   { id: 'corePlating',   name: 'CORE PLATING',   levels: 10,
    per: -0.015, unit: '% incoming Core damage', costs: FORGE_COST_10, implemented: true },
  powerGrid:     { id: 'powerGrid',     name: 'POWER GRID',     levels: 10,
    per: 2, unit: ' Power', costs: FORGE_COST_10, implemented: true },
  heatBank:      { id: 'heatBank',      name: 'HEAT BANK',      levels: 5,
    per: 5, unit: ' Heat cap', costs: FORGE_COST_5, implemented: true },
  coolingLoop:   { id: 'coolingLoop',   name: 'COOLING LOOP',   levels: 10,
    per: 0.02, unit: '% cooling', costs: FORGE_COST_10, implemented: true },
  magnetArray:   { id: 'magnetArray',   name: 'MAGNET ARRAY',   levels: 10,
    per: 0.02, unit: '% Magnet range/pull', costs: FORGE_COST_10, implemented: true },
  dashCapacitor: { id: 'dashCapacitor', name: 'DASH CAPACITOR', levels: 10,
    per: -0.02, unit: '% Dash cooldown', costs: FORGE_COST_10, implemented: true },
};

const FORGE_TRACK_LIST = Object.keys(FORGE_TRACKS);

const Forge = {
  scrap: 0,
  levels: {},                // trackId -> level bought

  reset() { this.scrap = 0; this.levels = {}; },

  // v3.2 note: Power Grid is +2/level (not +4) and the Wreckjack Frame supplies
  // 32, so the maximum permanent Power is 52. The cost curve is untouched, so
  // the Forge maximum is still 1,973 SCRAP.
  maxCost() {
    return FORGE_TRACK_LIST.reduce(
      (a, id) => a + FORGE_TRACKS[id].costs.reduce((x, y) => x + y, 0), 0);
  },

  levelOf(id) { return this.levels[id] || 0; },
  isMaxed(id) { return this.levelOf(id) >= FORGE_TRACKS[id].levels; },

  // TRADE CARD is applied HERE and not at the two buy() sites, for the same
  // reason MARKET SENSE is applied in bank(): the price the screen quotes and
  // the price the player is charged are then the same number by construction.
  // Rounded up, so a discount can never make something free.
  costOf(id) {
    const t = FORGE_TRACKS[id];
    if (!t || this.isMaxed(id)) return null;
    return this.price(t.costs[this.levelOf(id)]);
  },

  price(n) {
    if (!(n > 0) || typeof Skills === 'undefined') return n;
    return Math.max(1, Math.ceil(n * Skills.mul('priceMul')));
  },

  canBuy(id) {
    const t = FORGE_TRACKS[id];
    if (!t || !t.implemented || this.isMaxed(id)) return false;
    return this.scrap >= this.costOf(id);
  },

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.scrap -= this.costOf(id);
    this.levels[id] = this.levelOf(id) + 1;
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    return true;
  },

  bank(amount) {
    if (!(amount > 0)) return 0;
    // MARKET SENSE: "scrap from EVERY source", which is why it is applied at
    // the one writer rather than at each of the six things that pay out.
    if (typeof Skills !== 'undefined') amount *= Skills.mul('scrapMul');
    this.scrap += Math.round(amount);
    return Math.round(amount);
  },

  // ---- effects -----------------------------------------------------------
  coreHpMul() {
    return 1 + this.levelOf('coreIntegrity') * FORGE_TRACKS.coreIntegrity.per;
  },

  // Applied by Frames.apply through Progress, so a Forge purchase shows up on
  // the machine the moment it is bought rather than on the next run.
  // Master §11: the Power Grid track is +2 per level, ten levels, +20 total.
  // Permanent Power is Frame base + this + the Jackrig modifier, and that
  // chain tops out at 52 before Reactors and Field Power — see the comment on
  // maxCost() for why 52 and not 80.
  powerBonus() {
    return this.levelOf('powerGrid') * FORGE_TRACKS.powerGrid.per;
  },

  // M8: the two heat tracks. Flat cap points and a cooling multiplier, both
  // reading the same self-suppressing POWERED gate as everything else.
  heatCapBonus() {
    return this.levelOf('heatBank') * FORGE_TRACKS.heatBank.per;
  },

  coolingMul() {
    return 1 + this.levelOf('coolingLoop') * FORGE_TRACKS.coolingLoop.per;
  },

  // ---- the six M11 tracks (Master §14 table, no retuning) ----------------
  speedMul() {
    return 1 + this.levelOf('driveMotors') * FORGE_TRACKS.driveMotors.per;
  },

  damageMul() {          // WEAPON OUTPUT — read by Machine.outputMul
    return 1 + this.levelOf('weaponOutput') * FORGE_TRACKS.weaponOutput.per;
  },

  rateMul() {            // FIRE CONTROL — read by Machine._rate
    return 1 + this.levelOf('fireControl') * FORGE_TRACKS.fireControl.per;
  },

  coreDamageMul() {      // CORE PLATING — per is negative, so this shrinks
    return 1 + this.levelOf('corePlating') * FORGE_TRACKS.corePlating.per;
  },

  magnetMul() {          // MAGNET ARRAY — one track, range AND pull (§14)
    return 1 + this.levelOf('magnetArray') * FORGE_TRACKS.magnetArray.per;
  },

  dashCdMul() {          // DASH CAPACITOR — negative per, shorter cooldown
    return 1 + this.levelOf('dashCapacitor') * FORGE_TRACKS.dashCapacitor.per;
  },

  // Called by Machine.recalcStats AFTER the parts, Rank and Levels layers,
  // player only. Every field touched here is rebuilt from scratch each
  // recalc, so multiplying cannot compound across frames. The Rank firmware
  // CORE PLATING (x0.85) and this track deliberately STACK — one is bought
  // with SCRAP, the other earned in-run, and §14 says nothing about either
  // excluding the other.
  applyStats(ent) {
    if (!ent || !ent.isPlayer) return;
    ent.speedMul *= this.speedMul();
    ent.coreDamageMul = (ent.coreDamageMul || 1) * this.coreDamageMul();
    ent.magnetRangeMul *= this.magnetMul();
    ent.magnetPullMul *= this.magnetMul();
    ent.dashCdMul *= this.dashCdMul();
  },

  applyTo(player) {
    if (!player || player.baseMaxHp === undefined) return;
    const frac = player.maxHp ? player.hp / player.maxHp : 1;
    player.maxHp = Math.round(player.baseMaxHp * this.coreHpMul());
    player.hp = Math.max(1, Math.min(player.maxHp, Math.round(player.maxHp * frac)));

    // Heat Bank raises the cap; Cooling Loop multiplies the frame's cooling.
    // Both from the frame-supplied base, so they never compound on refit.
    if (player.baseHeatCap !== undefined) {
      player.heatCap = Math.round(player.baseHeatCap + this.heatCapBonus());
      if (player.heat > player.heatCap) player.heat = player.heatCap;
    }
    if (player.baseCooling !== undefined) {
      player.cooling = player.baseCooling * this.coolingMul();
    }

    // Permanent Power. `basePower` is what the Frame + Jackrig supplied, kept
    // separate so buying a Forge level does not compound on the last one.
    if (player.basePower !== undefined) {
      player.power = player.basePower + this.powerBonus();
      if (typeof Machine !== 'undefined') Machine.recalcPower(player);
    }
  },

  snapshot() { return { scrap: this.scrap, levels: Object.assign({}, this.levels) }; },

  restore(d) {
    this.reset();
    if (!d) return false;
    this.scrap = Math.max(0, Math.round(d.scrap || 0));
    for (const id of FORGE_TRACK_LIST) {
      const v = d.levels ? d.levels[id] : 0;
      if (typeof v === 'number' && v > 0) {
        this.levels[id] = Math.min(Math.round(v), FORGE_TRACKS[id].levels);
      }
    }
    return true;
  },
};

// ===========================================================================
// THE WEAPON LAB (Aaron, 25 Aug) — per-weapon SCRAP upgrades.
//
// The Core Forge upgrades the MACHINE; this upgrades one weapon family at a
// time, permanently, out of the same SCRAP bank. Four tracks per weapon:
//
//   POWER      +3%/level damage            (x1.15 at max)
//   ACCURACY   -6%/level spread            (x0.70 at max)
//   CYCLE      -4%/level time between shots (x0.80 at max)
//   COOLING    -4%/level Heat generated     (x0.80 at max)
//   EFFICIENCY -1 grid Power draw per level (flat, min draw 1)
//
// EFFICIENCY is different on purpose. Power costs are tiny integers (2-5),
// so a percentage would buy levels that visibly change nothing on half the
// catalogue — the dead-purchase disease. Instead every level is a flat
// "-1 Power draw", and the number of BUYABLE levels derives per weapon:
// min(2, base cost - 1), so a level can never be bought that does nothing
// and no weapon can be discounted below 1 or by more than 2. It is also the
// EXPENSIVE track, because grid Power is the resource the whole §11 design
// rations.
//
// NEW DESIGN, NOT MASTER-LOCKED: the Master's own numbers are untouched —
// these multiply on top, the way Mastery and the Core Forge already do.
// Levels, per-level sizes and the cost curve are first-pass numbers for
// Aaron to judge on screen and retune freely.
//
// It lives in this file rather than its own, deliberately: a new js file
// must be added to BOTH script lists (HANDOVER trap #2), and the Weapon Lab
// is the same domain as the Forge — SCRAP in, permanent multipliers out.
// ===========================================================================

const WEAPON_LAB_COST = [4, 6, 9, 13, 18];          // 50 SCRAP per track
const WEAPON_LAB_TRACKS = {
  power:    { id: 'power',    name: 'POWER',    per:  0.03, levels: 5,
              what: 'damage' },
  accuracy: { id: 'accuracy', name: 'ACCURACY', per: -0.06, levels: 5,
              what: 'spread' },
  cycle:    { id: 'cycle',    name: 'CYCLE',    per: -0.04, levels: 5,
              what: 'time between shots' },
  cooling:  { id: 'cooling',  name: 'COOLING',  per: -0.04, levels: 5,
              what: 'Heat generated' },
  efficiency: { id: 'efficiency', name: 'EFFICIENCY', flat: -1, levels: 2,
              what: 'Power draw', costs: [15, 35] },
};
const WEAPON_LAB_TRACK_LIST = Object.keys(WEAPON_LAB_TRACKS);

const WeaponLab = {
  // weaponId -> { power: n, accuracy: n, cycle: n, cooling: n }
  levels: {},

  reset() { this.levels = {}; },

  // The weapons the Lab will take: real catalogue weapons only. Derived from
  // PART_LIST like everything else, so the eight M14 weapons join by existing.
  weapons() {
    return PART_LIST.filter(id =>
      PARTS[id].category === 'weapon' && id !== 'emergencyBlaster');
  },

  levelOf(wid, tid) {
    return (this.levels[wid] && this.levels[wid][tid]) || 0;
  },

  // How many levels this weapon can actually buy on this track. Only
  // EFFICIENCY varies: a weapon's draw can never go below 1 or drop by more
  // than 2, so a 2-Power Machine Gun gets one level and a 0-Power part none.
  maxLevels(wid, tid) {
    const t = WEAPON_LAB_TRACKS[tid];
    if (tid !== 'efficiency') return t.levels;
    return Math.max(0, Math.min(t.levels, (PARTS[wid].powerCost || 0) - 1));
  },

  isMaxed(wid, tid) {
    return this.levelOf(wid, tid) >= this.maxLevels(wid, tid);
  },

  // Through Forge.price for the same reason: TRADE CARD is "repairs, upgrades,
  // RESTORATIONS" — every scrap sink, not the one that happened to be edited.
  costOf(wid, tid) {
    if (this.isMaxed(wid, tid)) return null;
    const costs = WEAPON_LAB_TRACKS[tid].costs || WEAPON_LAB_COST;
    return Forge.price(costs[this.levelOf(wid, tid)]);
  },

  canBuy(wid, tid) {
    if (!WEAPON_LAB_TRACKS[tid] || !this.weapons().includes(wid)) return false;
    if (this.isMaxed(wid, tid)) return false;
    return Forge.scrap >= this.costOf(wid, tid);
  },

  // Spends from the ONE SCRAP bank — §14: one currency, however many sinks.
  buy(wid, tid) {
    if (!this.canBuy(wid, tid)) return false;
    Forge.scrap -= this.costOf(wid, tid);
    if (!this.levels[wid]) this.levels[wid] = {};
    this.levels[wid][tid] = this.levelOf(wid, tid) + 1;
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    return true;
  },

  spentOn(wid) {
    let s = 0;
    for (const tid of WEAPON_LAB_TRACK_LIST) {
      const costs = WEAPON_LAB_TRACKS[tid].costs || WEAPON_LAB_COST;
      s += costs.slice(0, this.levelOf(wid, tid)).reduce((a, b) => a + b, 0);
    }
    return s;
  },

  // ---- the multipliers, read by Machine (player weapons only there) ------
  _mul(wid, tid) {
    return 1 + this.levelOf(wid, tid) * WEAPON_LAB_TRACKS[tid].per;
  },
  damageMul(wid)   { return this._mul(wid, 'power'); },
  spreadMul(wid)   { return this._mul(wid, 'accuracy'); },
  cooldownMul(wid) { return this._mul(wid, 'cycle'); },
  heatMul(wid)     { return this._mul(wid, 'cooling'); },

  // EFFICIENCY: whole Power points off the weapon's grid draw. Read by
  // Machine.powerCostOf; maxLevels already guarantees the result stays >= 1.
  powerDrawCut(wid) {
    return this.levelOf(wid, 'efficiency');
  },

  snapshot() {
    const out = {};
    for (const wid of Object.keys(this.levels)) {
      out[wid] = Object.assign({}, this.levels[wid]);
    }
    return { levels: out };
  },

  restore(d) {
    this.reset();
    if (!d || !d.levels) return false;
    for (const wid of Object.keys(d.levels)) {
      if (!PARTS[wid]) continue;                    // unknown weapon: drop it
      for (const tid of WEAPON_LAB_TRACK_LIST) {
        const v = d.levels[wid][tid];
        if (typeof v === 'number' && v > 0) {
          if (!this.levels[wid]) this.levels[wid] = {};
          this.levels[wid][tid] =
            Math.min(Math.round(v), this.maxLevels(wid, tid));
        }
      }
    }
    return true;
  },
};


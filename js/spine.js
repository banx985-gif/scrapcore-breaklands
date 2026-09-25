// SCRAPCORE: BREAKLANDS — BLOCK 10: THE PERMANENT WEAPON SPINE
//
// ---------------------------------------------------------------------------
// WHAT THIS IS
//
// A permanent weapon is a FLOOR, not a way to play: it gets you home alive,
// slowly, with nothing to show for it. The spine is the one thing that raises
// that floor, and CONTENT_ECONOMY is precise about what it costs:
//
//   spine 1     400 scrap  + 1 upgrade part
//   spine 2     900        + 2
//   spine 3   1,800        + 3
//   capstone  3,000        + 4, and all three spine steps first
//
// Ten upgrade parts to finish one weapon, and forty-six exist in the whole
// shippable game. So a player finishes with FOUR fully upgraded weapons and
// change, out of fifty-four, and every one of them is a thing they chose.
//
// UPGRADE PARTS ARE FOUND, NEVER BOUGHT, NEVER DROPPED BY PATROLS, NEVER
// FARMABLE. That is what makes them the throttle on power rather than another
// thing to grind — and it is why the second currency exists at all, because
// scrap alone would mean an afternoon of killing pickers buys everything.
//
// ---------------------------------------------------------------------------
// THE SHAPE, AND WHY
//
// The spine is per CLASS and shared by its variants; the capstone is per
// VARIANT. Eighteen spines and fifty-four capstones rather than fifty-four
// separate paths — the same felt personality for a third of the balance
// surface, and a class stays coherent across its variants.
//
// So `Spine.step('machineGun')` is how far the whole MACHINE GUN class has been
// taken, and every machine gun variant you own fires with it. The capstone is
// bought against one variant and belongs to that one only.
//
// ---------------------------------------------------------------------------
// AND THE RULE THE DATA FILE ALREADY SHOUTS ABOUT
//
// NO SPINE MAY PROMISE CONNECTOR DAMAGE. `permanents.js` says it at length and
// the validator refuses the file if one ever does. An upgrade path that walks a
// permanent back toward part-stripping undoes the floor one purchase at a time.
// Stagger, heat, reach and raw damage are all fair. This file reads the spine
// and applies it, and there is deliberately no branch here that could touch a
// joint even if somebody wrote one into the prose.
'use strict';

const SPINE_B = {
  // CONTENT_ECONOMY part 2, "spending". Read here rather than typed at the
  // call sites so a pass over prices is one edit.
  SCRAP: [400, 900, 1800],
  PARTS: [1, 2, 3],
  CAP_SCRAP: 3000,
  CAP_PARTS: 4,
  STEPS: 3,
};

// ---------------------------------------------------------------------------
// WHAT A BOUGHT STEP DOES.
//
// The spine data is PROSE — "+15% fire rate", "spread halves while stationary"
// — because it was written to be read by a person before it was written to be
// read by a machine. This is the machine half, and it is deliberately a
// SEPARATE table rather than a rewrite of the prose: the prose is what the
// garage screen shows the player, and the two must not drift into one another.
//
// Keyed by class, one entry per step, in the same order. A class with no entry
// here is REPORTED by `Spine.unwired()` — the honest-report pattern this
// project uses everywhere — so the gap between what the tree promises and what
// the code delivers is a number rather than a surprise.
//
// `mul` fields multiply a part field. `flag` fields are read by the system
// that owns the behaviour. Nothing here writes a connector field, and
// tests/test_spine.js refuses the file if one ever does.
const SPINE_FX = {
  machineGun: [
    { mul: { fireRate: 1.15 } },
    { flag: 'steadySpread' },                  // spread halves while stationary
    { flag: 'tracer' },                        // every 10th round, x2 hull
  ],
  cannon: [
    { mul: { splash: 1.20 } },
    { flag: 'stagger' },
    { flag: 'cluster' },
  ],
  arcGun: [
    { add: { chains: 1 } },
    { mul: { chainRange: 1.30 } },
    { flag: 'chainReturn' },
  ],
  scattergun: [
    { add: { pellets: 2 } },
    { mul: { recoil: 0.5 } },
    { flag: 'stagger' },
  ],
  burstRifle: [
    { add: { burst: 1 } },
    { flag: 'lastRoundDouble' },
    { flag: 'burstHeatRefund' },
  ],
  railgun: [
    { mul: { damage: 1.20 } },
    { flag: 'pierce' },
    { flag: 'chargeHold' },
  ],
  flamethrower: [
    { mul: { range: 1.25 } },
    { flag: 'lingering' },
    { flag: 'fuelBurn' },
  ],
  beamLaser: [
    { mul: { dps: 1.20 } },
    { flag: 'beamRamp' },
    { flag: 'beamSplit' },
  ],
  rocketPod: [
    { mul: { turnRate: 1.40 } },
    { flag: 'reacquire' },
    { flag: 'volleyBonus' },
  ],
  saw: [
    { mul: { dps: 1.25 } },
    { flag: 'sawGrip' },
    { flag: 'sawSpin' },
  ],

  // ---- THE OTHER EIGHT ---------------------------------------------------
  // Written last, and worth noting why they were left until they could be
  // written properly: every one of these classes' first step is a NUMBER, and
  // a number lands the day it is written because the output pipe multiplies
  // it. The second and third steps are behaviours, and a behaviour with no
  // system is a flag — so each is named honestly here and counted by
  // `unreadFlags()` until something reads it.
  //
  // FOUR OF THEM SHARE A THEME the tree noticed and the code had not: the
  // mine layer, the disc launcher, the shockwave cannon and the harpoon all
  // end up DRAGGING LOOSE PARTS toward you. That is one flag, not four —
  // `pullsLoose` — because it is one behaviour, and writing it four times is
  // how four slightly different behaviours get built by accident.
  plasmaRepeater: [
    { mul: { splash: 1.25 } },
    { flag: 'scorch' },
    { flag: 'ventBurst' },
  ],
  mortar: [
    { add: { range: 150 } },
    { flag: 'impactMarker' },
    { flag: 'stagger' },
  ],
  flakCannon: [
    { add: { fragments: 2 } },
    { flag: 'ricochet' },
    { flag: 'autoDetonate' },
  ],
  drill: [
    { mul: { dps: 1.25 } },
    { flag: 'stagger' },
    { flag: 'drillBite' },
  ],
  harpoon: [
    { mul: { tetherSecs: 1.5 } },
    { flag: 'tetherMark' },
    { flag: 'pullsLoose' },
  ],
  mineLayer: [
    { add: { mineLife: 8 } },
    { flag: 'instantArm' },
    { flag: 'pullsLoose' },
  ],
  discLauncher: [
    { add: { ricochets: 2 } },
    { flag: 'bounceRamp' },
    { flag: 'pullsLoose' },
  ],
  shockwaveCannon: [
    { add: { waveRange: 80 } },
    { flag: 'pullsLoose' },
    { flag: 'wavePops' },
  ],
};

const Spine = {
  // ---- WHAT IS BOUGHT ----------------------------------------------------
  // On Progress, because losing it would make a player stop playing — and
  // because the whole point of the second currency is that it is scarce and
  // permanent.
  _s() {
    if (typeof Progress === 'undefined') return {};
    Progress.spine = Progress.spine || {};
    return Progress.spine;
  },
  _c() {
    if (typeof Progress === 'undefined') return {};
    Progress.capstones = Progress.capstones || {};
    return Progress.capstones;
  },

  // How far the CLASS has been taken. 0 to 3.
  step(classId) { return Math.min(SPINE_B.STEPS, this._s()[classId] || 0); },
  maxed(classId) { return this.step(classId) >= SPINE_B.STEPS; },

  // Whether one VARIANT has its capstone.
  hasCapstone(variantId) { return !!this._c()[variantId]; },

  // The class a variant belongs to, asked of the variant table rather than
  // parsed out of the id — `mg_rasp` is a machineGun because its entry says
  // so, and an id is a name, not a fact.
  classOf(variantId) {
    const v = (typeof WEAPON_VARIANTS !== 'undefined')
      ? WEAPON_VARIANTS[variantId] : null;
    return v ? v.base : null;
  },

  // ---- WHAT IT COSTS -----------------------------------------------------
  costOf(classId) {
    const n = this.step(classId);
    if (n >= SPINE_B.STEPS) return null;
    return { scrap: SPINE_B.SCRAP[n], parts: SPINE_B.PARTS[n], step: n + 1 };
  },
  capstoneCost() {
    return { scrap: SPINE_B.CAP_SCRAP, parts: SPINE_B.CAP_PARTS };
  },

  // ---- WHY NOT ------------------------------------------------------------
  // In GarageCalc.refusal's shape, and for the same reason: the screen and the
  // system must never disagree about which wall the player hit, and "you
  // cannot afford it" and "you have not finished the spine" are different
  // sentences.
  refusal(classId) {
    if (!classId || (typeof WEAPON_SPINES !== 'undefined' &&
        !WEAPON_SPINES[classId])) return 'NOT A WEAPON CLASS';
    if (this.maxed(classId)) return 'SPINE COMPLETE';
    const c = this.costOf(classId);
    if (this.parts() < c.parts) return 'NEEDS ' + c.parts + ' UPGRADE PARTS';
    if (typeof Forge !== 'undefined' && Forge.scrap < c.scrap) {
      return 'NEEDS ' + c.scrap + ' SCRAP';
    }
    return null;
  },

  capstoneRefusal(variantId) {
    const v = (typeof WEAPON_VARIANTS !== 'undefined')
      ? WEAPON_VARIANTS[variantId] : null;
    if (!v) return 'NOT A WEAPON';
    if (!v.capstone) return 'NO CAPSTONE';
    if (typeof Permanents !== 'undefined' && !Permanents.owns(variantId)) {
      return 'NOT FOUND YET';
    }
    if (this.hasCapstone(variantId)) return 'ALREADY BOUGHT';
    // "ALL THREE SPINE STEPS FIRST." The capstone is what a finished class
    // earns, not a shortcut past it.
    if (!this.maxed(v.base)) return 'FINISH THE ' + v.base.toUpperCase() + ' SPINE';
    const c = this.capstoneCost();
    if (this.parts() < c.parts) return 'NEEDS ' + c.parts + ' UPGRADE PARTS';
    if (typeof Forge !== 'undefined' && Forge.scrap < c.scrap) {
      return 'NEEDS ' + c.scrap + ' SCRAP';
    }
    return null;
  },

  // ---- THE SECOND CURRENCY -----------------------------------------------
  parts() {
    return (typeof Progress !== 'undefined' && Progress.upgradeParts) || 0;
  },
  // ONE WRITER, and it is deliberately not called `bank`: upgrade parts are
  // found, never earned at a rate, and a function that looked like the scrap
  // banker would invite somebody to pay them out for a kill.
  found(n) {
    if (!(n > 0) || typeof Progress === 'undefined') return 0;
    Progress.upgradeParts = (Progress.upgradeParts || 0) + n;
    if (typeof Progress.save === 'function') Progress.save();
    return Progress.upgradeParts;
  },
  _spend(n, scrap) {
    Progress.upgradeParts = Math.max(0, (Progress.upgradeParts || 0) - n);
    if (typeof Forge !== 'undefined') Forge.scrap -= scrap;
  },

  // ---- BUYING -------------------------------------------------------------
  buy(classId) {
    if (this.refusal(classId)) return false;
    const c = this.costOf(classId);
    this._spend(c.parts, c.scrap);
    this._s()[classId] = c.step;
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    return true;
  },

  buyCapstone(variantId) {
    if (this.capstoneRefusal(variantId)) return false;
    const c = this.capstoneCost();
    this._spend(c.parts, c.scrap);
    this._c()[variantId] = true;
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    return true;
  },

  // ---- THE ONE READER -----------------------------------------------------
  // Same three verbs as Skills and Modules, for the same reason. Everything
  // that wants to know what a permanent has been upgraded to asks here, and
  // nothing else walks the tables.
  //
  // `variantId` rather than a class, because the capstone belongs to the
  // variant and the caller always has the part in its hand.
  mul(variantId, field) {
    const cls = this.classOf(variantId);
    if (!cls) return 1;
    let n = 1;
    const fx = SPINE_FX[cls] || [];
    for (let i = 0; i < this.step(cls); i++) {
      const m = fx[i] && fx[i].mul;
      if (m && m[field] !== undefined) n *= m[field];
    }
    return n;
  },

  sum(variantId, field) {
    const cls = this.classOf(variantId);
    if (!cls) return 0;
    let n = 0;
    const fx = SPINE_FX[cls] || [];
    for (let i = 0; i < this.step(cls); i++) {
      const a = fx[i] && fx[i].add;
      if (a && a[field] !== undefined) n += a[field];
    }
    return n;
  },

  has(variantId, flag) {
    const cls = this.classOf(variantId);
    if (!cls) return false;
    const fx = SPINE_FX[cls] || [];
    for (let i = 0; i < this.step(cls); i++) {
      if (fx[i] && fx[i].flag === flag) return true;
    }
    return false;
  },

  // IS THIS FLAG LIVE ON THIS SHOT. The three conditions every reader was
  // repeating -- the player's own machine, a permanent, and the class's
  // spine bought far enough -- in one place, so a flag can never be read
  // for an enemy's gun or a stolen part by a reader that forgot one of them.
  live(ent, partId, flag) {
    if (!ent || !ent.isPlayer || !partId) return false;
    const P = (typeof PARTS !== 'undefined') ? PARTS[partId] : null;
    if (!P || !P.permanent) return false;
    return this.has(partId, flag);
  },

  // THE ADD, LIVE ON THIS SHOT (D352). Five classes' first step is an
  // `add` -- ARC GUN +1 chain, SCATTERGUN +2 pellets, BURST RIFLE +1 round,
  // MORTAR +150 range, FLAK CANNON +2 fragments -- and `sum` above read
  // them for a caller that never came: unwire --boot could stub it and no
  // suite noticed, because nothing had ever added the number to anything.
  // A step a player pays parts and scrap for and gets nothing from is the
  // worst thing this project knows how to build (the honest report below
  // says so), and these five were it. Same three conditions as `live`.
  add(ent, partId, field) {
    if (!ent || !ent.isPlayer || !partId) return 0;
    const P = (typeof PARTS !== 'undefined') ? PARTS[partId] : null;
    if (!P || !P.permanent) return 0;
    return this.sum(partId, field);
  },

  // ---- THE HONEST REPORT --------------------------------------------------
  // Eighteen classes have a spine written as prose. This says which of them
  // have a machine-readable effect behind that prose, and which are still only
  // a sentence — because a step a player pays 1,800 scrap and three of
  // forty-six upgrade parts for, which then does nothing, is the worst thing
  // this project knows how to build.
  unwired() {
    const out = [];
    if (typeof WEAPON_SPINES === 'undefined') return out;
    for (const cls of Object.keys(WEAPON_SPINES)) {
      if (!SPINE_FX[cls]) { out.push(cls); continue; }
      for (let i = 0; i < WEAPON_SPINES[cls].length; i++) {
        if (!SPINE_FX[cls][i]) out.push(cls + ' step ' + (i + 1));
      }
    }
    return out;
  },

  // And which FLAGS nothing reads. A `mul` lands the moment it is written
  // because the output pipe multiplies it; a flag is a promise to a system
  // that may not exist. Passed in by the suite, which greps for them — a list
  // kept here would go stale the first time somebody wired one.
  unreadFlags(readFlags) {
    const all = {};
    for (const cls of Object.keys(SPINE_FX)) {
      for (const s of SPINE_FX[cls]) if (s.flag) all[s.flag] = cls;
    }
    return Object.keys(all).filter(f => !readFlags[f]);
  },

  reset() {
    if (typeof Progress === 'undefined') return;
    Progress.spine = {};
    Progress.capstones = {};
  },
};

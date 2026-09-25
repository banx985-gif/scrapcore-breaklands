// SCRAPCORE: BREAKLANDS — BLOCK 9: CHARACTER LEVEL AND SKILLS
//
// Forty levels, four branches, no respec.
//
// ---------------------------------------------------------------------------
// THE SHAPE, AND WHY IT IS THAT SHAPE
//
// 48 points across a tree that costs about 159. You cannot have it all, you
// cannot take it back, and the tier gates are POINTS SPENT IN THAT BRANCH
// rather than levels — so going deep in one branch is a commitment measured
// in the things you did not take.
//
//   tier 1   costs 1, needs 0 spent in the branch
//   tier 2   costs 2, needs 4
//   tier 3   costs 3, needs 10
//   deep     costs 6, needs 16
//
// A deep pick is a quarter of everything you will ever have. Two of them is
// half your character, and the draft's own arithmetic note says so: "48 points
// = two deep picks."
//
// ---------------------------------------------------------------------------
// AND THE RULE THIS FILE IS ACTUALLY ABOUT
//
//   "WIRE EVERY EFFECT KEY TO SOMETHING REAL. A NODE THAT DOES NOTHING IS
//    WORSE THAN NO NODE."
//
// Worse, because a node that does nothing is a point the player spent, cannot
// take back, and will never find out was wasted. This project has been bitten
// by exactly that shape three times — five boss phase effects writing dead
// fields, six modules with no reader, forty-seven radio lines nothing fired —
// and every time the fix was the same: ONE reader, and an honest report of
// what is still not wired.
//
// So: `Skills.mul` / `.sum` / `.has` are the reader, `Skills.unread()` is the
// report, and it names not just WHICH key has no reader but WHAT SYSTEM it is
// waiting for. A number you can read is a debt; a silence is a lie.
const Skills = {
  // ---- WHAT IS SPENT ------------------------------------------------------
  // On Progress, because losing it would make a player stop playing.
  _ranks() {
    if (typeof Progress === 'undefined') return {};
    Progress.skills = Progress.skills || {};
    return Progress.skills;
  },

  rank(id) { return this._ranks()[id] || 0; },

  maxRank(id) {
    const S = (typeof SKILLS !== 'undefined') ? SKILLS[id] : null;
    return S ? (S.ranks || []).length : 0;
  },

  // Points spent, total and per branch. Derived from the ranks rather than
  // counted alongside them: a parallel tally is a second record of one fact,
  // and this project has been bitten by that twice.
  spent(branch) {
    let n = 0;
    for (const id of Object.keys(this._ranks())) {
      const S = (typeof SKILLS !== 'undefined') ? SKILLS[id] : null;
      if (!S) continue;                       // "must tolerate unknown node ids"
      if (branch && S.branch !== branch) continue;
      n += this.rank(id) * this.cost(id);
    }
    return n;
  },

  cost(id) {
    const S = (typeof SKILLS !== 'undefined') ? SKILLS[id] : null;
    if (!S) return 0;
    const T = (typeof SKILL_TIERS !== 'undefined') ? SKILL_TIERS[S.tier] : null;
    return T ? T.cost : 1;
  },

  available() {
    return (typeof Levels !== 'undefined' ? Levels.points() : 0) - this.spent();
  },

  // ---- CAN THIS BE TAKEN? -------------------------------------------------
  // Four questions, and the order matters only in what it tells the screen:
  // "you cannot afford it" and "you have not gone deep enough" are different
  // sentences and the player needs the right one.
  why(id) {
    const S = (typeof SKILLS !== 'undefined') ? SKILLS[id] : null;
    if (!S) return 'no such skill';
    if (this.rank(id) >= this.maxRank(id)) return 'maxed';
    const T = (typeof SKILL_TIERS !== 'undefined') ? SKILL_TIERS[S.tier] : null;
    if (T && this.spent(S.branch) < T.need) {
      return 'needs ' + T.need + ' in ' + S.branch;
    }
    if (this.available() < this.cost(id)) return 'not enough points';
    return null;
  },

  can(id) { return this.why(id) === null; },

  // TAKE IT. There is no matching `unspend`: NO RESPEC is a design decision
  // and the absence of the function is how it is enforced - a respec you can
  // reach by any route at all is a respec.
  take(id) {
    if (!this.can(id)) return false;
    this._ranks()[id] = this.rank(id) + 1;
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    return true;
  },

  // ---- THE ONE READER -----------------------------------------------------
  // The same three verbs `Modules` uses, for the same reason: wiring fifty
  // effect keys one at a time would mean fifty copies of the same walk.
  //
  // A skill's effect for its CURRENT rank - `ranks` is one entry per rank and
  // each entry is the value AT that rank, not an increment, so retuning a
  // curve never has to re-derive what a rank means.
  effect(id) {
    const S = (typeof SKILLS !== 'undefined') ? SKILLS[id] : null;
    const r = this.rank(id);
    if (!S || r <= 0) return null;
    return (S.ranks || [])[Math.min(r, (S.ranks || []).length) - 1] || null;
  },

  each(fn) {
    if (typeof SKILLS === 'undefined') return;
    for (const id of Object.keys(SKILLS)) {
      const e = this.effect(id);
      if (e) fn(e, id);
    }
  },

  // MULTIPLICATIVE. Two skills that both scale a thing compound, which is the
  // right answer: you spent points on both.
  mul(key) {
    let n = 1;
    this.each((e) => { if (e[key] !== undefined) n *= e[key]; });
    return n;
  },

  sum(key) {
    let n = 0;
    this.each((e) => { if (typeof e[key] === 'number') n += e[key]; });
    return n;
  },

  has(key) {
    let yes = false;
    this.each((e) => { if (e[key]) yes = true; });
    return yes;
  },

  // The fourth verb, for effects whose value is a WORD rather than a number.
  // CONNECTOR READ is 'locked' at rank 1 and 'all' at rank 2, and `has` would
  // flatten that to true — the reader would then have to count ranks itself,
  // which is the tree's job and not the HUD's. Last writer wins, which for a
  // single node is its current rank.
  pick(key) {
    let v = null;
    this.each((e) => { if (e[key] !== undefined) v = e[key]; });
    return v;
  },

  // ---- THE HONEST REPORT --------------------------------------------------
  // Every effect key the tree writes, and whether anything in the codebase
  // reads it. `unread()` is the report; WAITING_ON is what a key with no
  // reader is waiting FOR.
  //
  // EMPTY, and that is the point. Every key the tree writes now has a reader.
  //
  // Twenty-nine sat here across three runs, and the note beside each one was a
  // guess about what it was waiting for. Working through them, most of the
  // guesses were wrong: `swSecs/swSpeed/swResist` said "shockwave knockback"
  // and are SECOND WIND, which needed nothing that did not exist; the five
  // drone keys said "drones (Block 11)" and the drone flight has been flying
  // since M12, orbiting, being shot down and respawning. Two really were
  // blocked — `gadgetSlots` and `gadgetsFreePower` — and the thing they were
  // blocked on turned out to be sixty lines (see `Gadgets` below).
  //
  // KEEP THIS TABLE. A key with no reader must land here with what it waits
  // for, because "not wired" and "cannot be wired yet" are different debts and
  // only one of them is anybody's fault. But a note in it is a claim, and the
  // lesson of clearing it is that the claims go stale faster than the code.
  WAITING_ON: {},

  keys() {
    const out = {};
    if (typeof SKILLS === 'undefined') return out;
    for (const id of Object.keys(SKILLS)) {
      for (const r of (SKILLS[id].ranks || [])) {
        for (const k of Object.keys(r)) (out[k] || (out[k] = [])).push(id);
      }
    }
    return out;
  },

  // Which keys have a reader. Passed in by the suite, which greps js/ for
  // them - a hand-kept list here would go stale the first time somebody wired
  // one, which is the whole failure mode this report exists to avoid.
  unread(readKeys) {
    const all = this.keys();
    return Object.keys(all).filter(k => !readKeys[k]);
  },
};

// ---------------------------------------------------------------------------
// LEVELS. Deliberately tiny: the curve is data, the points are arithmetic, and
// the only thing with an opinion is what a level is FOR.
//
//   "XP to reach level N = 100 * N^1.35"
//   "1 point/level + 1 bonus every 5th = 48 points"
//
// Nothing about a level is a stat. You do not get tougher for levelling; you
// get a point, and the point is a decision. That is why this file is short.
const Levels = {
  _p() {
    if (typeof Progress === 'undefined') return { xp: 0 };
    if (Progress.xp === undefined) Progress.xp = 0;
    return Progress;
  },

  xp() { return this._p().xp || 0; },

  // Total XP needed to REACH level n (n >= 1). Level 1 is free.
  // WHAT ONE LEVEL COSTS. `100 * n^1.35` is CONTENT_ECONOMY Part 4's
  // "XP for this level" column, to within a few points at every row it lists:
  // 255 against 257 at level 2, 14,547 against 14,600 at level 40.
  xpForLevel(n) {
    if (n <= 1) return 0;
    const C = (typeof SKILL_CURVE !== 'undefined') ? SKILL_CURVE
      : { xpBase: 100, xpPower: 1.35 };
    return Math.round(C.xpBase * Math.pow(n, C.xpPower));
  },

  // AND WHAT IT COSTS TO GET THERE, which is the other column and is the one
  // `level()` needs.
  //
  // This returned the PER-LEVEL number and `level()` compared a running total
  // against it, so reaching level 40 took 14,547 XP where the design asks for
  // 251,000. THE WHOLE CURVE WAS 17.5 TIMES TOO FAST — two columns of a table,
  // one of them read as the other, and nothing could see it because the
  // formula was right and its meaning was wrong.
  //
  // Summed rather than given a closed form, so it stays the sum of the column
  // beside it and cannot drift from it.
  xpFor(n) {
    if (n <= 1) return 0;
    this._cum = this._cum || {};
    if (this._cum[n] !== undefined) return this._cum[n];
    let t = 0;
    for (let k = 2; k <= n; k++) t += this.xpForLevel(k);
    this._cum[n] = t;
    return t;
  },

  // THE CEILING THIS BUILD ACTUALLY HAS.
  //
  // 40 is the design's ceiling and 25 is the shipped one, because every
  // one-off award in the six shipping districts adds up to level 25 and the
  // last fifteen levels belong to the expansion set.
  //
  // Derived from how many districts the build HOLDS rather than from a flag,
  // so it lifts on its own the day a seventh is added and there is nothing to
  // remember. `expanded()` is separate so the screen can say which world it is
  // in without repeating the arithmetic.
  expanded() {
    const C = (typeof SKILL_CURVE !== 'undefined') ? SKILL_CURVE : null;
    if (!C || C.shipDistricts === undefined) return true;
    if (typeof DISTRICT_LIST === 'undefined') return false;
    // THE ENDGAME IS NOT AN EXPANSION DISTRICT. Central Dispatch is small,
    // final, and adds six fragments and one boss to the XP in the world;
    // the cap exists because 91,520 XP of one-offs is level 25 and a bar
    // that cannot fill reads as the end of the game. Lifting it for a
    // district that does not bring the XP would ship exactly that bar.
    // The Grows, the Digs, the Sumpworks, the Stacks lift it.
    const n = DISTRICT_LIST.filter(id =>
      !(typeof DISTRICTS !== 'undefined' && DISTRICTS[id] && DISTRICTS[id].endgame)).length;
    return n > C.shipDistricts;
  },

  max() {
    const C = (typeof SKILL_CURVE !== 'undefined') ? SKILL_CURVE : null;
    if (!C) return 40;
    if (C.shipCap === undefined) return C.maxLevel;
    return this.expanded() ? C.maxLevel : C.shipCap;
  },

  // AND THE ONE THE DESIGN IS BUILT AGAINST, for anything that needs to say
  // "25 of 40" rather than "25 of 25". A cap the player cannot see the far
  // side of reads as the end of the game.
  designMax() {
    return (typeof SKILL_CURVE !== 'undefined') ? SKILL_CURVE.maxLevel : 40;
  },

  level() {
    const xp = this.xp();
    let n = 1;
    while (n < this.max() && xp >= this.xpFor(n + 1)) n++;
    return n;
  },

  // 1 per level after the first, plus 1 every fifth level. Forty levels is
  // 39 + 8 = 47... which is why the draft says 48: level 1 carries one, so
  // you have a decision to make the moment you have any levels at all.
  points() {
    const C = (typeof SKILL_CURVE !== 'undefined') ? SKILL_CURVE
      : { bonusEvery: 5 };
    const l = this.level();
    return l + Math.floor(l / (C.bonusEvery || 5));
  },

  // The one writer. Returns how many levels were gained, so the caller can
  // say so out loud without asking twice.
  addXp(n) {
    if (!(n > 0)) return 0;
    const was = this.level();
    const p = this._p();
    p.xp = (p.xp || 0) + n;
    const now = this.level();
    if (now > was) {
      if (typeof Effects !== 'undefined' && typeof Game !== 'undefined' &&
          Game.states && Game.states.GAME && Game.states.GAME.player) {
        const pl = Game.states.GAME.player;
        Effects.comicWord('LEVEL ' + now, pl.x, pl.y - 220,
          CONFIG.COLOR.lime, 70);
      }
      if (typeof Audio_ !== 'undefined') Audio_.play('levelUp');
    }
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    return now - was;
  },

  reset() { if (typeof Progress !== 'undefined') Progress.xp = 0; },
};

// ---------------------------------------------------------------------------
// SUSTAINED FIRE — the damage ramp that resets when you switch.
//
// It cannot live in Machine.outputMul with the other output multipliers,
// because that pipe has no idea WHAT it is hitting and the whole character of
// this skill is that it does. So it lives here, next to the tree it belongs
// to, and Machine.applyDamage — the one funnel every hit in the game goes
// through — asks it one question.
//
// Time, not hits: two rounds landing in the same frame advance the ramp by
// nothing, which is what stops a shotgun from being a ramp cannon.
// ---------------------------------------------------------------------------
const Sustain = {
  RESET_AFTER: 0.8,        // stop firing for this long and the ramp is gone

  _tgt: null,
  _t: 0,
  _last: -1,

  // A seam, so a test can drive the clock instead of sleeping. Nothing in the
  // game ever passes an argument.
  now(t) {
    if (t !== undefined) return t;
    return (typeof performance !== 'undefined' ? performance.now() : Date.now())
      / 1000;
  },

  mul(target, t) {
    if (typeof Skills === 'undefined') return 1;
    const per = Skills.sum('rampPerSec');
    if (!per) return 1;
    const now = this.now(t);
    if (target !== this._tgt || this._last < 0 ||
        now - this._last > this.RESET_AFTER) {
      this._tgt = target;
      this._t = 0;
    } else {
      this._t += now - this._last;
    }
    this._last = now;
    return 1 + Math.min(Skills.sum('rampCap'), this._t * per);
  },

  reset() { this._tgt = null; this._t = 0; this._last = -1; },
};

// ---------------------------------------------------------------------------
// SECOND WIND — "dropping below 25% health gives a brief speed and resistance
// burst." 90s cooldown.
//
// EDGE-TRIGGERED ON THE CROSSING, not on the state. A skill that fired
// whenever you were under a quarter would be a permanent buff for anybody
// playing badly, which is the opposite of what a second wind is.
// ---------------------------------------------------------------------------
const SecondWind = {
  AT: 0.25,
  COOLDOWN: 90,

  update(dt, player) {
    if (!player || typeof Skills === 'undefined') return;
    const secs = Skills.sum('swSecs');
    player._swT = Math.max(0, (player._swT || 0) - dt);
    player._swCd = Math.max(0, (player._swCd || 0) - dt);
    if (!secs || !player.maxHp) { player._swLow = false; return; }
    const low = player.alive && player.hp > 0 &&
                player.hp <= player.maxHp * this.AT;
    if (low && !player._swLow && player._swCd <= 0) {
      player._swT = secs;
      player._swCd = this.COOLDOWN;
      if (typeof Effects !== 'undefined') {
        Effects.ring(player.x, player.y, player.radius + 90, CONFIG.COLOR.lime);
        Effects.comicWord('SECOND WIND!', player.x, player.y - 190,
          CONFIG.COLOR.lime, 64);
      }
      if (typeof Audio_ !== 'undefined') Audio_.play('heatReady');
    }
    player._swLow = low;
  },

  running(player) { return !!player && (player._swT || 0) > 0; },
  speedMul(player) {
    return this.running(player) ? Skills.mul('swSpeed') : 1;
  },
  damageMul(player) {
    return this.running(player) ? Skills.mul('swResist') : 1;
  },
};

// ---------------------------------------------------------------------------
// GADGET SLOTS — the two keys that really were blocked, and the sixty lines
// that unblocked them.
//
// `Progress.gadgets[id]` (the RANK you own) already existed and is what every
// barrier gate and mission requirement asks. What did not exist is the other
// half: which of the ones you own are FITTED right now, how many you can fit,
// and what that costs in power.
//
// Owning is permanent and is about the map. Fitting is a loadout decision and
// is about the fight. Keeping them separate is what stops a traversal gadget
// you found in the Ironworks from ever being something you can lose.
// ---------------------------------------------------------------------------
const GADGET_B = { BASE_SLOTS: 1, MAX_SLOTS: 4 };

const Gadgets = {
  // GADGET BAY (+1/+2) and PARALLEL BUS (+1), capped at 4 by the data file's
  // own note. The base is 1, so the tree can only ever double it.
  slots() {
    let n = GADGET_B.BASE_SLOTS;
    if (typeof Skills !== 'undefined') n += Skills.sum('gadgetSlots');
    return Math.min(GADGET_B.MAX_SLOTS, n);
  },

  owns(id, rank) {
    if (typeof Progress === 'undefined') return false;
    return (Progress.gadgets[id] || 0) >= (rank || 1);
  },

  _fitted() {
    if (typeof Progress === 'undefined') return [];
    if (!Array.isArray(Progress.gadgetsFitted)) Progress.gadgetsFitted = [];
    return Progress.gadgetsFitted;
  },

  fitted() { return this._fitted().slice(); },
  isFitted(id) { return this._fitted().indexOf(id) >= 0; },

  // Why NOT, in the same shape GarageCalc.refusal answers in: the screen and
  // the system must never disagree about which wall you hit.
  refusal(id) {
    if (typeof GADGETS === 'undefined' || !GADGETS[id]) return 'NOT A GADGET';
    if (!this.owns(id)) return 'NOT FOUND YET';
    if (this.isFitted(id)) return 'ALREADY FITTED';
    if (this._fitted().length >= this.slots()) return 'NO SLOT';
    return null;
  },

  fit(id) {
    if (this.refusal(id)) return false;
    this._fitted().push(id);
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    return true;
  },

  remove(id) {
    const f = this._fitted();
    const i = f.indexOf(id);
    if (i < 0) return false;
    f.splice(i, 1);
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    return true;
  },

  // PARALLEL BUS, the Machines deep pick: "gadgets cost no power". Read at the
  // one place the draw is totalled, so nothing has to know the skill exists.
  powerDraw() {
    if (typeof Skills !== 'undefined' && Skills.has('gadgetsFreePower')) return 0;
    if (typeof GADGETS === 'undefined') return 0;
    let n = 0;
    for (const id of this._fitted()) n += (GADGETS[id] || {}).power || 0;
    return n;
  },

  // A slot lost (respec is impossible, but MAX_SLOTS and the data can change)
  // must not leave a machine drawing power for a gadget it cannot fit.
  trim() {
    const f = this._fitted();
    if (f.length > this.slots()) f.length = this.slots();
    return f.length;
  },

  reset() {
    if (typeof Progress !== 'undefined') Progress.gadgetsFitted = [];
  },
};

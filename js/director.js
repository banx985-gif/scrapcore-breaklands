// SCRAPCORE: BREAKLANDS — Encounter Director (Milestone 13, plan §40)
// Every encounter gets a difficulty BUDGET. The director spends it on Cores,
// AI brains, socket counts and components drawn from that zone's pool. The
// player never sees the budget — they just see the machines get nastier.
//
// Nothing here is hand-authored per encounter: change the tables, change the
// whole game's pacing.

// SPAWN POOLS. Block 0 kept this as `ZONES`, keyed 1/2/3 by the run's three
// zones, and DECISIONS.md D9 flagged the name as the thing most likely to
// mislead: it was never run structure, it is the Director's composition data.
// Block 2 re-keys it by NAME and a district names the pool it draws from, so
// adding a district is adding a pool rather than editing a number here.
const SPAWN_POOLS = {
  // ---------------- THE YARDS — outer salvage ground (plan §43) --------
  yard: {
    name: 'SCRAP YARD',
    tier: 0,
    // Zones lengthened to 7/7/8 so there is time to steal and actually USE a
    // weapon before the boss. Budgets re-derived to stay MONOTONIC across the
    // whole run: zone 1 now finishes at 30+6*10=90, so zone 2 must open above
    // that (the same trap that once made difficulty DIP between zones).
    budget: (i) => 30 + i * 10,           // 30 -> 90 across 7 encounters
    modules: [1, 3],                      // per normal enemy (plan §43)
    aiWeights: { rusher: 3, strafer: 4, kiter: 1.2, turret: 1, swarmer: 1.6, salvager: 0.3 },
    weapons: [
      ['machineGun', 4], ['scattergun', 3], ['cannon', 2], ['saw', 3],
      ['mineLayer', 1],
    ],
    support: [
      ['armourPlate', 4], ['smallReactor', 2], ['radiator', 1],
      ['thruster', 2], ['targetingModule', 1], ['dashBooster', 1],
    ],
  },

  // ---------------- THE FOUNDRY — heat and heavy plant (plan §45) ------
  foundry: {
    name: 'FOUNDRY',
    tier: 1,
    budget: (i) => 96 + i * 12,   // 96 -> 168; opens above zone 1's finish (90)
    modules: [2, 4],
    aiWeights: { rusher: 2.5, strafer: 3, kiter: 2, turret: 1.6, swarmer: 2, salvager: 1 },
    weapons: [
      ['machineGun', 3], ['scattergun', 3], ['cannon', 3], ['saw', 2],
      ['flamethrower', 3], ['rocketPod', 2], ['arcGun', 2], ['mineLayer', 1],
    ],
    support: [
      ['armourPlate', 3], ['heavyArmour', 2], ['directionalShield', 2.5],
      ['smallReactor', 2], ['bigReactor', 1.5], ['radiator', 1],
      ['heatSink', 0.8], ['thruster', 2], ['heavyTreads', 1.5],
      ['targetingModule', 1.5], ['dashBooster', 1],
    ],
  },

  // ---------------- THE COREWORKS — the deep plant (plan §47) ----------
  coreworks: {
    name: 'COREWORKS',
    tier: 2,
    budget: (i) => 176 + i * 14,  // 176 -> 274; opens above zone 2's finish (168)
    modules: [3, 6],
    aiWeights: { rusher: 2, strafer: 3, kiter: 2, turret: 1.6, swarmer: 2, salvager: 2.6 },
    weapons: [
      ['machineGun', 2], ['scattergun', 2], ['cannon', 2.5], ['saw', 2],
      ['flamethrower', 2], ['rocketPod', 2.5], ['arcGun', 2.5],
      ['railgun', 2], ['beamLaser', 2.5], ['mineLayer', 1.5],
    ],
    support: [
      ['armourPlate', 2], ['heavyArmour', 2.5], ['directionalShield', 3],
      ['repairArm', 1.5], ['smallReactor', 1.5], ['bigReactor', 2],
      ['radiator', 0.8], ['heatSink', 0.8], ['thruster', 2],
      ['heavyTreads', 1.5], ['targetingModule', 2], ['magnetAmplifier', 1.2],
      ['splitter', 1], ['dashBooster', 1.2],
    ],
  },
};

// Which Cores each brain is allowed to sit on (plan §38: Core + brain + parts).
const AI_CORES = {
  rusher:   [['medium', 3], ['heavy', 1.4], ['light', 1]],
  strafer:  [['light', 2], ['medium', 3]],
  kiter:    [['light', 3], ['medium', 2]],
  turret:   [['heavy', 3], ['medium', 2]],
  salvager: [['medium', 3], ['light', 1]],
  swarmer:  [['swarm', 1]],
  // The four roles that borrowed a brain until they had their own: what
  // the Director builds one on when a pool asks for it by brain.
  sniper:   [['medium', 3], ['light', 1]],
  zoner:    [['medium', 3], ['heavy', 1]],
  support:  [['heavy', 2], ['medium', 2]],
  guard:    [['heavy', 3], ['medium', 1]],
};

// A charging machine needs something worth charging WITH. Rushers always take
// their first weapon from this short-range set (plan §39.1).
const RUSHER_WEAPONS = [['saw', 5], ['scattergun', 2], ['flamethrower', 2]];

// What the brain costs on top of its Core — heavy brains are worth more.
const AI_COST = {
  rusher: 1, strafer: 1, kiter: 2, turret: 3, salvager: 3, swarmer: 0,
  sniper: 3, zoner: 3, support: 3, guard: 3,
};

const Director = {
  // ---- SEEDED BUILDS (Block 2) -------------------------------------------
  // Every choice below used Math.random directly, which meant a spawn post
  // produced a DIFFERENT machine every time its chunk reloaded. Seeding the
  // brain alone was not enough: driving away and back rerolled the loadout,
  // so "that yard has a HUNTER with a railgun" was never a true sentence and
  // the district could not be learned.
  //
  // One injectable source instead. Default is Math.random and nothing else
  // changes; Population wraps a build in withSeed() so the same post rebuilds
  // the same machine forever, without storing any of it.
  _rnd: Math.random,
  rnd() { return this._rnd(); },

  // Run `fn` with a deterministic stream derived from `seed`.
  withSeed(seed, fn) {
    let h = 2166136261;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const prev = this._rnd;
    this._rnd = () => {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { return fn(); } finally { this._rnd = prev; }
  },

  MAX_ALIVE: 12,          // hard cap (plan §40/§75)
  MAX_MODULES_ENEMY: 6,   // hard cap (plan §75)

  // Locked parts must never appear on an enemy (plan §53). Falls back to the
  // raw pool if a filter would empty it, so the director can always build.
  _allowed(pool) {
    if (typeof Profile === 'undefined' || !Profile.unlockedParts) return pool;
    const open = pool.filter(w => Profile.partUnlocked(w[0]));
    return open.length ? open : pool;
  },

  _pick(weighted) {
    let total = 0;
    for (const w of weighted) total += w[1];
    let r = this.rnd() * total;
    for (const w of weighted) { r -= w[1]; if (r <= 0) return w[0]; }
    return weighted[weighted.length - 1][0];
  },

  _pickAi(pool) {
    return this._pick(Object.entries(SPAWN_POOLS[pool].aiWeights));
  },

  // The same weighted pick, but from a supplied 0..1 roll instead of
  // Math.random. Block 2's spawn posts need to produce the SAME machine
  // every time their chunk reloads, and a post that rerolled its brain on
  // every visit would make the district unlearnable.
  pickAiSeeded(pool, roll) {
    const weighted = Object.entries(SPAWN_POOLS[pool].aiWeights);
    let total = 0;
    for (const w of weighted) total += w[1];
    let r = roll * total;
    for (const w of weighted) { r -= w[1]; if (r <= 0) return w[0]; }
    return weighted[weighted.length - 1][0];
  },

  // Build ONE machine spec: {aiType, coreKey, loadout, cost}
  buildMachine(pool, aiType = null, budget = Infinity) {
    const Z = SPAWN_POOLS[pool];
    // AI_CORES holds the six brains the Director can BUILD for. Enemy knows
    // ten — guard, flanker, artillery and builder are M18 family brains that
    // SpawnGen drives — so a caller naming one of those, or a typo, used to
    // reach _pick(undefined) and throw 'weighted is not iterable' three
    // frames later with nothing pointing at the caller.
    //
    // It falls back to the pool rather than throwing, because a district
    // data file with one bad brain should still be playable. What catches
    // the typo is tests/test_block2.js, which asserts every aiType named in
    // district data is one this can actually build.
    const ai = (aiType && AI_CORES[aiType]) ? aiType : this._pickAi(pool);
    const coreKey = this._pick(AI_CORES[ai]);
    const core = ENEMY_CORES[coreKey];

    let cost = core.cost + (AI_COST[ai] || 0);
    const loadout = [];

    // How many modules this machine wants — capped by its Core's sockets,
    // the perf cap, and whatever budget is left.
    const [lo, hi] = Z.modules;
    let want = lo + Math.floor(this.rnd() * (hi - lo + 1));
    if (ai === 'swarmer') want = this.rnd() < 0.55 ? 1 : 0;   // plan §39.6
    if (ai === 'turret') want += 1;                              // "more heavily armed"
    want = Math.min(want, core.sockets, this.MAX_MODULES_ENEMY);

    const usedSockets = [];
    const freeSocket = () => {
      const open = [];
      for (let i = 0; i < core.sockets; i++) if (!usedSockets.includes(i)) open.push(i);
      if (!open.length) return null;
      const s = open[Math.floor(this.rnd() * open.length)];
      usedSockets.push(s);
      return s;
    };

    for (let i = 0; i < want; i++) {
      // First module is always a weapon so nothing spawns toothless.
      const isWeapon = i === 0 || this.rnd() < 0.55;
      let pool = this._allowed(isWeapon ? Z.weapons : Z.support);
      if (isWeapon && i === 0 && ai === 'rusher') {
        // Only offer short-range options this zone actually stocks.
        const inZone = this._allowed(
          RUSHER_WEAPONS.filter(w => Z.weapons.some(z => z[0] === w[0])));
        if (inZone.length) pool = inZone;
      }
      const id = this._pick(pool);
      const partCost = 2 + (PARTS[id].powerCost || 0) * 0.6;
      if (cost + partCost > budget && loadout.length > 0) break;
      const sock = freeSocket();
      if (sock === null) break;
      loadout.push([id, sock]);
      cost += partCost;
    }

    return { aiType: ai, coreKey, loadout, cost: Math.round(cost) };
  },

  // The smallest number of machines an encounter may field. Budget alone was
  // producing openers of one or two machines (measured: 32% of zone 1's first
  // fight came in at <=2), and that is the fight every run and every RETRY
  // starts with — so it set the tone for the whole game. A floor costs nothing
  // in the late game, where the budget already buys more than this.
  minMachines(pool, index) {
    // Deliberately NOT difficulty-scaled. An easier tier makes machines softer
    // (DIFFICULTIES[].hp), never thinner on the ground — the fighting is the
    // fun, so EASY should be the same brawl with weaker opponents.
    return Math.min(3 + SPAWN_POOLS[pool].tier + Math.floor(index / 2), 8);
  },

  // How many waves an encounter is served in. The arena only resets between
  // ENCOUNTERS, so this is three pushes of enemies over the same ground.
  WAVES: 3,

  // Build one WAVE of an encounter. The encounter's budget is split across the
  // waves, so three waves add up to roughly what one used to field — the fight
  // is longer, not three times heavier.
  buildWave(pool, index, difficultyMul = 1, wave = 0) {
    // Later waves are the bigger ones: the fight should build.
    const share = [0.28, 0.34, 0.38][Math.min(wave, 2)];
    return this.buildEncounter(pool, index, difficultyMul, share);
  },

  // Build a whole encounter's worth of specs for a zone + encounter index.
  // `share` (0-1) takes a fraction of it, used by the wave split.
  buildEncounter(pool, index, difficultyMul = 1, share = 1) {
    const Z = SPAWN_POOLS[pool];
    let budget = Z.budget(index) * difficultyMul * share;
    const specs = [];
    let guard = 0;

    while (budget > 5 && specs.length < this.MAX_ALIVE && guard++ < 60) {
      const m = this.buildMachine(pool, null, budget);
      if (m.cost > budget && specs.length > 0) break;
      specs.push(m);
      budget -= m.cost;

      // Swarmers travel in packs — one alone is not pressure (plan §39.6).
      if (m.aiType === 'swarmer') {
        const pack = 1 + Math.floor(this.rnd() * 2);
        for (let i = 0; i < pack && specs.length < this.MAX_ALIVE; i++) {
          const s = this.buildMachine(pool, 'swarmer', budget);
          specs.push(s);
          budget -= s.cost;
        }
      }
    }

    // Top up to the floor with the CHEAPEST machines we can build, so the
    // shortfall arrives as extra bodies to shoot parts off rather than as one
    // more heavyweight. Deliberately allowed to overspend the budget: an empty
    // arena is a worse failure than a slightly generous one.
    // The floor scales with the share too, or a third of the budget would still
    // be forced to field a full encounter's worth of bodies.
    const floor = Math.min(
      Math.max(2, Math.round(this.minMachines(pool, index) * share)),
      this.MAX_ALIVE);
    let topUp = 0;
    while (specs.length < floor && topUp++ < 20) {
      specs.push(this.buildMachine(pool, null, 1));
    }

    // Once the 12-alive cap is reached, leftover budget used to be DISCARDED —
    // so late zone 3 stopped escalating and OVERDRIVE stopped being harder
    // than HARD (a real failure, caught by test_balance). Spend the remainder
    // on QUALITY instead: bolt extra modules onto the machines already here.
    // Count is a performance invariant; firepower is not.
    if (budget > 5 && specs.length >= this.MAX_ALIVE) {
      budget = this._upgradeSpecs(pool, specs, budget);
    }

    if (!specs.length) specs.push(this.buildMachine(pool, 'strafer', 99));
    return specs;
  },

  // Add modules to existing specs, respecting each machine's socket count and the
  // per-enemy module cap. Returns whatever budget could not be spent.
  _upgradeSpecs(pool, specs, budget) {
    const Z = SPAWN_POOLS[pool];
    let guard = 0;
    while (budget > 5 && guard++ < 80) {
      const open = specs.filter(m => {
        const core = ENEMY_CORES[m.coreKey];
        return m.loadout.length < Math.min(core.sockets, this.MAX_MODULES_ENEMY);
      });
      if (!open.length) break;
      const m = open[Math.floor(this.rnd() * open.length)];
      const core = ENEMY_CORES[m.coreKey];
      const used = m.loadout.map(e => e[1]);
      const free = [];
      for (let i = 0; i < core.sockets; i++) if (!used.includes(i)) free.push(i);
      if (!free.length) break;
      const pool = this._allowed(this.rnd() < 0.6 ? Z.weapons : Z.support);
      const id = this._pick(pool);
      const partCost = 2 + (PARTS[id].powerCost || 0) * 0.6;
      if (partCost > budget) break;
      m.loadout.push([id, free[Math.floor(this.rnd() * free.length)]]);
      m.cost = Math.round(m.cost + partCost);
      budget -= partCost;
    }
    return budget;
  },

  // Turn specs into live enemies, placed away from the player and each other.
  spawn(specs, arena, obstacles, player, existing = []) {
    const out = [];
    const alive = existing.filter(e => e.alive).length;
    for (const spec of specs) {
      if (alive + out.length >= this.MAX_ALIVE) break;
      const p = this._findSpawnPoint(arena, obstacles, player, [...existing, ...out]);
      const e = new Enemy(p.x, p.y, spec.loadout, spec.aiType, spec.coreKey,
        spec.opts || null);
      // §27 profile extras: Grade the mounted parts, then the Elite modifier
      // (order matters — REINFORCED multiplies the GRADED durability).
      if (spec.grade && typeof applyGradeToComponent !== 'undefined') {
        for (const s of e.sockets) {
          if (s.comp) applyGradeToComponent(s.comp, spec.grade);
        }
      }
      if (spec.elite && typeof Elites !== 'undefined') {
        Elites.make(e, spec.elite);
      }
      // §29 late-Scrapstorm rule: wave 30's heavies carry TWO Elite mods.
      if (spec.elite2 && typeof Elites !== 'undefined') {
        Elites.make(e, spec.elite2);
      }
      out.push(e);
    }
    return out;
  },

  _findSpawnPoint(arena, obstacles, player, others) {
    let best = null, bestScore = -Infinity;
    for (let tries = 0; tries < 90; tries++) {
      const x = arena.x + 240 + this.rnd() * (arena.w - 480);
      const y = arena.y + 240 + this.rnd() * (arena.h - 480);

      let blocked = false;
      for (const o of obstacles) {
        if (o.type === 'pillar') {
          if (Math.hypot(x - o.x, y - o.y) < o.r + 140) { blocked = true; break; }
        } else if (x > o.x - 140 && x < o.x + o.w + 140 &&
                   y > o.y - 140 && y < o.y + o.h + 140) { blocked = true; break; }
      }
      if (blocked) continue;

      const dPlayer = Math.hypot(x - player.x, y - player.y);
      if (dPlayer < 900) continue;
      let dOther = 9999;
      for (const e of others) dOther = Math.min(dOther, Math.hypot(x - e.x, y - e.y));

      // Aim for a BAND, not the far corner. On the enlarged arenas, simply
      // maximising distance parked enemies 2000+ away and turned every
      // encounter into a walk. Roughly a screen and a half is the sweet spot.
      const IDEAL = 1250;
      const score = -Math.abs(dPlayer - IDEAL) + Math.min(dOther, 420) * 1.2;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
      // Stop early only for a genuinely good spot: close to the ideal band AND
      // not stacked on another machine. (Breaking on spread alone used to
      // accept the first far-flung candidate on the big arenas.)
      if (Math.abs(dPlayer - IDEAL) < 220 && dOther > 380) break;
    }
    return best || {
      x: arena.x + arena.w * 0.5,
      y: arena.y + 260,
    };
  },
};

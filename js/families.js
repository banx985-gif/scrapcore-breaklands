// SCRAPCORE: BREAKLANDS — M18: MAP PROFILES, ELITES, SPAWN GENERATOR
// Master v3.2 §27. The family baselines live in ENEMY_CORES (enemy.js);
// this file is the DATA the director consumes — the ten-map progression
// table, the six exact Elite modifiers, and a spawn generator whose every
// build is LEGAL under the family's own Power/Load/module law.
//
// The two locked rules that make the table solvable (§27, v3.2):
//  * "Power budget" is Power SPENT, not Power available — late-map builds
//    must mount Reactors to afford their loadouts, and those Reactors
//    consume module slots that count against the cap.
//  * The per-map module band applies to that map's PRIMARY HEAVY families
//    only. Light and Swarm always use their own band — an eleven-module
//    Swarm unit is not a Swarm unit.

// ---------------------------------------------------------------------------
// The §27 Campaign enemy progression table, row for row. `weapons`/`support`
// spell out each map's "Hardware identity" column as part ids. Grade bands
// are the authored column; the mid-map unlocks ("G2 unlocks on Reclaimer
// clear") are campaign STATE and arrive with M19-M20 — the full band is
// listed here and the director may gate it.
const MAP_PROFILES = {
  1: { families: ['light', 'standard'], modules: [2, 4], power: [6, 10],
    grades: ['G1', 'G2'], brains: ['rusher', 'strafer', 'salvager'],
    weapons: ['machineGun', 'scattergun'],
    support: ['armourPlate', 'magnetAmplifier'] },
  2: { families: ['light', 'standard', 'carrier'], modules: [3, 5], power: [8, 12],
    grades: ['G1', 'G2'], brains: ['rusher', 'strafer', 'guard', 'builder'],
    weapons: ['machineGun', 'scattergun'],
    support: ['armourPlate', 'repairArm', 'droneBay', 'splitter'] },
  3: { families: ['standard', 'carrier'], modules: [4, 6], power: [10, 16],
    grades: ['G2', 'G3'], brains: ['strafer', 'kiter', 'turret', 'builder'],
    weapons: ['arcGun', 'beamLaser', 'machineGun'],
    support: ['smallReactor', 'capacitor', 'armourPlate'] },
  4: { families: ['standard', 'heavy'], modules: [4, 7], power: [12, 18],
    grades: ['G2', 'G3'], brains: ['rusher', 'flanker', 'guard'],
    weapons: ['saw', 'scattergun', 'cannon'],
    support: ['heavyArmour', 'thruster', 'dashBooster', 'heavyTreads'] },
  5: { families: ['standard', 'heavy', 'siege'], modules: [5, 8], power: [14, 22],
    grades: ['G2', 'G3'], brains: ['artillery', 'turret', 'guard', 'flanker'],
    weapons: ['cannon', 'rocketPod', 'mineLayer'],
    support: ['pointDefence', 'heavyArmour', 'smallReactor'] },
  6: { families: ['heavy', 'siege'], modules: [6, 9], power: [18, 26],
    grades: ['G3', 'G4'], brains: ['rusher', 'kiter', 'artillery', 'guard'],
    weapons: ['drill', 'harpoon', 'cannon'],
    support: ['bigReactor', 'heavyArmour', 'armourPlate'] },
  7: { families: ['standard', 'heavy', 'siege'], modules: [6, 10], power: [20, 30],
    grades: ['G3', 'G4'], brains: ['rusher', 'turret', 'artillery', 'guard'],
    weapons: ['flamethrower', 'plasmaRepeater', 'beamLaser'],
    support: ['radiator', 'heatSink', 'coolantPump', 'smallReactor', 'bigReactor'] },
  8: { families: ['swarm', 'light', 'standard', 'heavy', 'carrier', 'siege'],
    modules: [7, 11], power: [24, 34],
    grades: ['G3', 'G4'],
    brains: ['rusher', 'strafer', 'kiter', 'turret', 'salvager', 'swarmer',
      'guard', 'flanker', 'artillery', 'builder'],
    weapons: ['machineGun', 'scattergun', 'cannon', 'rocketPod', 'arcGun',
      'beamLaser', 'saw', 'flamethrower'],
    support: ['armourPlate', 'heavyArmour', 'repairArm', 'smallReactor',
      'bigReactor', 'pointDefence'] },
  9: { families: ['heavy', 'carrier', 'siege'], modules: [8, 12], power: [28, 40],
    grades: ['G4', 'G5'],
    brains: ['rusher', 'strafer', 'kiter', 'turret', 'salvager', 'swarmer',
      'guard', 'flanker', 'artillery', 'builder'],
    weapons: ['railgun', 'cannon', 'beamLaser', 'rocketPod'],
    support: ['directionalShield', 'barrierProjector', 'pointDefence',
      'reflectorPlate', 'bigReactor', 'smallReactor'] },
  10: { families: ['swarm', 'light', 'standard', 'heavy', 'carrier', 'siege'],
    modules: [8, 12], power: [32, 45],
    grades: ['G4', 'G5'],
    brains: ['rusher', 'strafer', 'kiter', 'turret', 'salvager', 'swarmer',
      'guard', 'flanker', 'artillery', 'builder'],
    weapons: ['railgun', 'cannon', 'rocketPod', 'beamLaser', 'plasmaRepeater',
      'flamethrower', 'drill', 'harpoon'],
    support: ['heavyArmour', 'directionalShield', 'pointDefence',
      'reactiveArmour', 'bigReactor', 'smallReactor', 'capacitor'] },
};

// ---------------------------------------------------------------------------
// ELITE MODIFIERS — the exact §27 starting effects. One modifier per Elite
// unless a late Scrapstorm/NG+ rule explicitly allows two.
//
// Speed bonuses live in `eliteSpeedMul`, NOT `speedMul` — recalcStats
// rebuilds speedMul from parts on every re-power, and an elite bonus written
// there would silently vanish the first time a part came off. The steering
// pipe reads eliteSpeedMul directly (checked where APPLIED).
const ELITES = {
  reinforced: {
    name: 'REINFORCED', color: '#8fa3c8',
    apply(e) {                       // Core +20%; module and connector +35%
      e.maxHp = Math.round(e.maxHp * 1.20);
      e.hp = e.maxHp;
      for (const s of e.sockets) {
        if (!s.comp) continue;
        s.comp.maxHp = Math.round(s.comp.maxHp * 1.35);
        s.comp.hp = s.comp.maxHp;
        s.comp.maxConnectorHp = Math.round(s.comp.maxConnectorHp * 1.35);
        s.comp.connectorHp = s.comp.maxConnectorHp;
      }
    },
  },
  overclocked: {
    name: 'OVERCLOCKED', color: '#22d9ff',
    apply(e) {                       // rate +20%; movement +5%
      e.fireRateMul = 1.20;          // read by Machine._rate for any ent
      e.eliteSpeedMul = 1.05;
      // §27 also grants cooling +25% — enemies carry no Heat pipe yet, so
      // there is nothing for it to apply to. Documented, not faked.
    },
  },
  volatile: {
    name: 'VOLATILE', color: '#ff7a1a',
    apply(e) { e.volatile = true; }, // 0.6s fuse, 28/190, both sides — _die()
  },
  hunter: {
    name: 'HUNTER', color: '#ff3b5a',
    apply(e) {                       // move +15%; charge cd -20%; hunts YOU
      e.eliteSpeedMul = 1.15;
      e.ramCdMul = 0.8;
      e.hunter = true;               // a hunter Salvager stops shopping
    },
  },
  reclaimer: {
    name: 'RECLAIMER', color: '#ff3fa4',
    apply(e) {                       // magnet +35%, rip +35% — the salvager
      e.magnetRangeMul = 1.35;       // brain already reads both fields
      e.ripSpeedMul = 1.35;
    },
  },
  fortified: {
    name: 'FORTIFIED', color: '#ffd23f',
    apply(e) {                       // Defence parts +35% HP + 60-pt barrier
      for (const s of e.sockets) {
        if (!s.comp || s.comp.part.category !== 'defence') continue;
        s.comp.maxHp = Math.round(s.comp.maxHp * 1.35);
        s.comp.hp = s.comp.maxHp;
      }
      e.frontBarrier = 60;           // absorbed in takeCoreDamage, front only
    },
  },
};

const ELITE_LIST = Object.keys(ELITES);

const Elites = {
  make(e, kind) {
    const mod = ELITES[kind];
    if (!mod || e.isElite) return e;   // one modifier per Elite (§27)
    e.isElite = true;
    e.eliteKind = kind;
    e.eliteColor = mod.color;
    mod.apply(e);
    return e;
  },
  pick() { return ELITE_LIST[Math.floor(Math.random() * ELITE_LIST.length)]; },
};

// ---------------------------------------------------------------------------
// SPAWN GENERATOR — a legal §27 build for any family on any map.
const SpawnGen = {
  _pick(list) { return list[Math.floor(Math.random() * list.length)]; },

  // The §27 module band for THIS family on THIS map.
  band(mapNo, family) {
    const P = MAP_PROFILES[mapNo];
    const core = ENEMY_CORES[family];
    // Light and Swarm always use their own band (§27, locked).
    if (family === 'light' || family === 'swarm') return [1, core.modCap];
    const hi = Math.min(P.modules[1], core.hardCeiling, core.sockets);
    const lo = Math.min(Math.max(1, P.modules[0]), hi);
    return [lo, hi];
  },

  // Build one spec: { aiType, coreKey, loadout, opts, grade, cost }.
  // Guarantees, checked by test_m18 for every family on every map:
  //   modules <= min(band hi, hard ceiling); Load <= family loadCap;
  //   Power SPENT <= base Power + mounted Reactor bonus.
  build(mapNo, family = null, brain = null) {
    const P = MAP_PROFILES[mapNo];
    if (!P) throw new Error('No profile for map ' + mapNo);
    family = family || this._pick(P.families);
    brain = brain || this._pick(P.brains);
    // A swarm machine is a swarmer and a swarmer is a swarm machine.
    if (family === 'swarm') brain = 'swarmer';
    else if (brain === 'swarmer') brain = 'strafer';

    const core = ENEMY_CORES[family];
    let [lo, hi] = this.band(mapNo, family);
    const wantMods = lo + Math.floor(Math.random() * (hi - lo + 1));
    const budget = P.power[0] + Math.random() * (P.power[1] - P.power[0]);

    const loadout = [];
    const used = [];
    let spent = 0, load = 0, capacity = core.power;
    const freeSocket = () => {
      const open = [];
      for (let i = 0; i < core.sockets; i++) if (!used.includes(i)) open.push(i);
      if (!open.length) return null;
      const s = open[Math.floor(Math.random() * open.length)];
      used.push(s);
      return s;
    };
    const mount = (id) => {
      const p = PARTS[id];
      if (!p) return false;
      if (loadout.length >= hi) return false;
      if (load + (p.loadCost || 0) > core.loadCap) return false;
      const cost = p.powerCost || 0;
      if (cost > 0 && spent + cost > capacity) return false;
      const sock = freeSocket();
      if (sock === null) return false;
      loadout.push([id, sock]);
      load += p.loadCost || 0;
      spent += cost;
      if (p.powerBonus) capacity += p.powerBonus;   // Reactors raise the grid
      return true;
    };

    const reactors = P.support.filter(id => PARTS[id] && PARTS[id].powerBonus);
    let guard = 0;
    while (loadout.length < wantMods && guard++ < 40) {
      const wantWeapon = loadout.length === 0 || Math.random() < 0.55;
      const id = this._pick(wantWeapon ? P.weapons : P.support);
      if (mount(id)) continue;
      // Could not afford it: §27 says the build mounts a Reactor — which
      // costs a slot — or it goes without. No illegal build, ever.
      if ((PARTS[id].powerCost || 0) > 0 && reactors.length &&
          spent + (PARTS[id].powerCost || 0) > capacity) {
        if (mount(this._pick(reactors))) mount(id);
      }
      if (spent >= budget) break;
    }
    if (!loadout.length) mount(P.weapons[0]);   // nothing spawns toothless

    const gradePool = P.grades;
    return {
      aiType: brain, coreKey: family, loadout,
      opts: { modCap: hi },
      grade: this._pick(gradePool),
      cost: core.cost + loadout.reduce((a, [id]) =>
        a + 2 + (PARTS[id].powerCost || 0) * 0.6, 0),
    };
  },

  // A whole wave from the map profile: `count` machines, optionally with the
  // §26C Elite allocation ("at least one Elite from Map 3 onward").
  wave(mapNo, count, withElite = mapNo >= 3) {
    const specs = [];
    for (let i = 0; i < count; i++) specs.push(this.build(mapNo));
    if (withElite && specs.length) {
      specs[Math.floor(Math.random() * specs.length)].elite = Elites.pick();
    }
    return specs;
  },
};

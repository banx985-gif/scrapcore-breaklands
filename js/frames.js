// SCRAPCORE: BREAKLANDS — Jackrigs and Frame stages (Milestone 2)
// Master v3.2 §8 (Jackrig identities) and §9 (physical frame development).
//
// M2 proves ONE step of this: the machine physically grows from Bare to Patch
// and the player can feel it. The full six-Jackrig / five-stage system is M5 —
// but the DATA is the locked §8/§9 table, so it goes in whole. Half a table is
// how two documents start disagreeing.
//
// Frame stats are PERCENTAGES OF THE COMPLETE FRAME. A Bare Jackal is 70% of
// Jackal's Core HP, not 70% of some other number. That is what makes the Bare
// Frame feel like a machine that is not finished yet.

const JACKRIGS = {
  jackal:   { id: 'jackal',   name: 'JACKAL',   coreHp: 105, speed: 1.00,
              dashCd: 2.8, loadCap: 32, powerMod:  0,
              identity: 'balanced salvage' },
  viper:    { id: 'viper',    name: 'VIPER',    coreHp:  85, speed: 1.18,
              dashCd: 2.2, loadCap: 26, powerMod: -1,
              identity: 'speed / recoil' },
  ironclad: { id: 'ironclad', name: 'IRONCLAD', coreHp: 145, speed: 0.82,
              dashCd: 3.4, loadCap: 40, powerMod: +1,
              identity: 'defence' },
  mammoth:  { id: 'mammoth',  name: 'MAMMOTH',  coreHp: 125, speed: 0.88,
              dashCd: 3.0, loadCap: 44, powerMod: +2,
              identity: 'heavy weapons' },
  mantis:   { id: 'mantis',   name: 'MANTIS',   coreHp:  95, speed: 1.10,
              dashCd: 2.5, loadCap: 30, powerMod:  0,
              identity: 'melee' },
  hive:     { id: 'hive',     name: 'HIVE',     coreHp:  90, speed: 0.92,
              dashCd: 3.0, loadCap: 34, powerMod: +3,
              identity: 'drones / automation' },
};

// Complete-frame baseline (Master §8): Heat cap 100, cooling 10/sec.
const JACKRIG_BASE_HEAT = 100;
const JACKRIG_BASE_COOLING = 10;
const JACKRIG_BASE_SPEED = 640;   // ZERO's tuned base movement, in units/sec

// Master §9. Frame upgrades are STORY-EARNED Yard technology, never purchased.
//
// Q6 (BREAKLANDS_ANSWERS, 20 Sept 2026): A FRAME STAGE IS EARNED BY REACHING
// A NEW DISTRICT. `unlock` said "Boss 2 / 4 / 6 / 8" -- WRECKJACK's Wardens,
// which BREAKLANDS does not have -- so for thirteen runs the only caller of
// Progress.advanceFrame was a DEV button. The Yard is the start; the second,
// third, fourth and fifth district a player reaches are the other four
// stages. Progress.growFrame is the rule; `unlock` is what the Yard says.
const FRAME_STAGES = [
  { id: 'bare',      name: 'BARE FRAME',      unlock: 'The Yard',
    roots: 4, moduleCap: 4,  hp: 0.70, speed: 0.90, heat: 0.75, cooling: 0.80,
    load: 0.65, magnet: 0.85, basePower: 8,  branching: false },
  { id: 'patch',     name: 'PATCH FRAME',     unlock: 'Reach a 2nd district',
    roots: 5, moduleCap: 6,  hp: 0.78, speed: 0.93, heat: 0.82, cooling: 0.85,
    load: 0.75, magnet: 0.90, basePower: 12, branching: true },
  { id: 'combat',    name: 'COMBAT FRAME',    unlock: 'Reach a 3rd district',
    roots: 6, moduleCap: 8,  hp: 0.86, speed: 0.96, heat: 0.90, cooling: 0.90,
    load: 0.85, magnet: 0.95, basePower: 18, branching: true },
  { id: 'war',       name: 'WAR FRAME',       unlock: 'Reach a 4th district',
    roots: 7, moduleCap: 12, hp: 0.94, speed: 0.98, heat: 0.95, cooling: 0.95,
    load: 0.95, magnet: 1.00, basePower: 26, branching: true },
  { id: 'wreckjack', name: 'WRECKJACK FRAME', unlock: 'Reach a 5th district',
    roots: 8, moduleCap: 16, hp: 1.00, speed: 1.00, heat: 1.00, cooling: 1.00,
    load: 1.00, magnet: 1.00, basePower: 32, branching: true },
];

const FRAME_IDS = FRAME_STAGES.map(f => f.id);

const JACKRIG_LIST = ['jackal', 'viper', 'ironclad', 'mammoth', 'mantis', 'hive'];

// THE MACHINE'S ART LIVES UNDER `machine_`. The six Jackrigs are the socket
// frame the player is always in; the sixteen models Aaron delivered on 15 Sept
// are the VEHICLES that frame attaches to, and js/rigs.js already owns ids like
// `mammoth` for them. Two things, one word: so the machine's sprite sets and
// its Yard thumbnails carry this prefix (machine_mammoth_bare,
// machine_mammoth) and a vehicle rendered as `mammoth` can never overwrite
// them. tools/pack_assets.py and tests/test_assets.js READ this constant.
const MACHINE_SET_PREFIX = 'machine_';

// Master §8 keyed each chassis to the Warden whose death finished it
// (WARDEN_UNLOCKS). BREAKLANDS has no Wardens, and for thirteen runs the
// Yard's plates promised one. Q4 (20 Sept 2026): the five machines a save
// does not start as are WRECKS in the world -- towed home and restored, the
// find-and-recover ladder. The table is gone; `MachineWrecks` in rigs.js and
// the `machines:` layer in districts.js are the rule now.

// ---------------------------------------------------------------------------
// ART STAGE — which MODEL a Frame stage is drawn with.
//
// Five Frame stages x six Jackrigs would be thirty models. Aaron's call (20 Aug)
// is TWO per Jackrig — the starting machine and the finished one — so twelve
// models cover the whole game. The middle stages borrow the nearer of the two.
//
// The split is at BRANCHING, not at the arithmetic middle, because that is where
// the machine stops being a core with things bolted round it and starts being a
// structure:
//
//   BARE, PATCH        -> the 'bare' model      (4-5 sockets, no or first branch)
//   COMBAT, WAR, WRECKJACK -> the 'wreckjack' model (6-8 sockets, wide branching)
//
// §2 is "you do not start as WRECKJACK, you become one", so the two models that
// have to land are the first and the last. This is where that becomes concrete.
const FRAME_ART_STAGE = {
  bare: 'bare',
  patch: 'bare',
  combat: 'wreckjack',
  war: 'wreckjack',
  wreckjack: 'wreckjack',
};

const Frames = {
  get(id) { return FRAME_STAGES.find(f => f.id === id) || FRAME_STAGES[0]; },

  // The sprite set for a machine, e.g. machine_jackal_bare / machine_jackal_wreckjack.
  // Falls back to the bare model rather than to nothing, so a Jackrig whose
  // finished model has not been made yet still draws as SOMETHING.
  artSet(jackrigId, frameId) {
    const rig = (JACKRIGS[jackrigId] ? jackrigId : 'jackal');
    return MACHINE_SET_PREFIX + rig + '_' + (FRAME_ART_STAGE[frameId] || 'bare');
  },
  index(id) { return Math.max(0, FRAME_IDS.indexOf(id)); },
  next(id) { return FRAME_STAGES[Math.min(this.index(id) + 1, FRAME_STAGES.length - 1)]; },
  isLast(id) { return this.index(id) === FRAME_STAGES.length - 1; },

  // Fit a live PlayerCore to a Jackrig + Frame stage. Called when a Campaign
  // machine is built and again the moment a Frame is earned, so the upgrade is
  // something the player watches happen rather than reads about later.
  apply(player, jackrigId, frameId, opts = {}) {
    const J = JACKRIGS[jackrigId] || JACKRIGS.jackal;
    const F = this.get(frameId);
    const hpFrac = opts.keepHpFraction && player.maxHp
      ? Math.min(1, player.hp / player.maxHp) : null;

    player.jackrigId = J.id;
    player.frameId = F.id;

    // Core HP, speed, heat, cooling, load, magnet — all § 9 percentages of the
    // §8 complete-frame figure.
    player.baseMaxHp = Math.round(J.coreHp * F.hp);
    player.maxHp = player.baseMaxHp;
    player.hp = hpFrac === null ? player.maxHp
      : Math.max(1, Math.round(player.maxHp * hpFrac));

    player.baseMaxSpeed = JACKRIG_BASE_SPEED * J.speed * F.speed;
    player.maxSpeed = player.baseMaxSpeed;
    player.baseDashCd = J.dashCd;
    player.dashCdMax = player.baseDashCd;

    player.baseHeatCap = Math.round(JACKRIG_BASE_HEAT * F.heat);
    player.heatCap = player.baseHeatCap;
    if (player.heat > player.heatCap) player.heat = player.heatCap;
    // baseCooling is the frame's own figure; Forge's Cooling Loop multiplies
    // it in applyTo, same never-compound pattern as basePower.
    player.baseCooling = JACKRIG_BASE_COOLING * F.cooling;
    player.cooling = player.baseCooling;

    player.loadCap = Math.round(J.loadCap * F.load);
    player.frameMagnetMul = F.magnet;

    // Master §9: apply the Jackrig Power modifier AFTER Frame Base Power.
    // basePower is the PERMANENT floor from hardware alone; Forge's Power Grid
    // track adds on top of it in Forge.applyTo, and Field Power/Reactors add
    // on top of that in Machine.recalcPower. Keeping them separate is what
    // stops a Forge purchase compounding every time a Frame is refitted.
    player.basePower = F.basePower + J.powerMod;
    player.power = player.basePower +
      (typeof Forge !== 'undefined' && Forge.powerBonus ? Forge.powerBonus() : 0);
    player.branchingAllowed = F.branching;

    this.fitSockets(player, F.roots);
    player.maxModules = F.moduleCap;
    Machine.recalcPower(player);
    return F;
  },

  // Grow or shrink the root ring to the Frame's socket count WITHOUT throwing
  // away what is bolted on. Rebuilding the sockets outright would silently
  // delete the player's machine every time a Frame changed.
  fitSockets(player, roots) {
    // Permanent slots are not roots and are never grown or dropped here.
    const current = player.sockets
      .filter(s => s.parentId === undefined && !s.permanent);
    if (current.length < roots) {
      for (let i = current.length; i < roots; i++) Machine.addRootSocket(player);
      return;
    }
    if (current.length > roots) {
      // Shrinking only happens in dev/test. Drop the highest EMPTY sockets
      // first so nothing equipped is ever lost without being seen.
      const spare = current.filter(s => !s.comp).sort((a, b) => b.id - a.id);
      let over = current.length - roots;
      while (over > 0 && spare.length) {
        const s = spare.shift();
        player.sockets.splice(player.sockets.indexOf(s), 1);
        over--;
      }
      Machine._respaceRoots(player);
    }
  },
};

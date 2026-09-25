// SCRAPCORE: BREAKLANDS — RIGS, CORES AND DOCKING (Block 7)
//
// Done when you drive a Mammoth to a mine, leave it outside, and go in as the
// core.
//
// YOUR CORE DOCKS INTO THE RIG, AND THE CORE SUPPLIES THE POWER. Without a
// core docked a rig is dead metal: it does not move and it does not fire. That
// one sentence is the whole architecture, and it is why `Rigs.dock` recomputes
// the machine from BOTH rather than swapping one set of stats for another.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A NEW FILE AND NOT AN EDIT TO frames.js
//
// `JACKRIGS` is WRECKJACK's six chassis and the Frame progression that goes
// with them. It still runs the machine's socket count, heat and Load, and
// nothing here touches it. What Block 7 adds is a layer ABOVE it: a core is
// the thing you are, a rig is a thing you get into, and the pair produce the
// machine. Editing JACKRIGS to mean both would have made the starting Jackal
// simultaneously a chassis and a vehicle you can leave parked outside a mine.
//
// ---------------------------------------------------------------------------
// DATA FOR ALL NINE RIGS AND FIVE CORES; BEHAVIOUR FOR THREE.
//
// MAMMOTH SMASH, CHEETAH SPRINT+VAULT and TANK BLAST RESIST, because between
// them they cover passive-while-driving, terrain destruction, one passive and
// one button on the same rig, damage-type immunity, and all three size classes.
// The other six are a content pass once the pattern holds.

const CORES = {
  clip: {
    id: 'clip', name: 'CLIP', hp: 1.00, speed: 1.00, power: 1.00, slots: 2,
    found: 'you start as this',
    why: 'the maintenance unit marked as scrap. Good at everything, and the ' +
         'one the story is about.',
  },
  spindle: {
    id: 'spindle', name: 'SPINDLE', hp: 0.72, speed: 1.30, power: 0.80, slots: 2,
    found: 'early district, no fight',
    why: 'fast enough to outrun most things. Dies to two mistakes.',
  },
  anvil: {
    id: 'anvil', name: 'ANVIL', hp: 1.45, speed: 0.80, power: 1.00, slots: 2,
    found: 'first lair boss',
    why: 'soaks damage, turns like a barge.',
  },
  dynamo: {
    id: 'dynamo', name: 'DYNAMO', hp: 1.00, speed: 0.82, power: 1.60, slots: 1,
    found: 'city, behind a gadget gate',
    why: 'a walking reactor. Runs a stolen-parts build twice as big as anyone ' +
         'else, and lives or dies on parts that can be shot off it.',
  },
  splice: {
    id: 'splice', name: 'SPLICE', hp: 0.75, speed: 1.00, power: 1.00, slots: 3,
    found: 'late, hardest gated pocket',
    // The Build Bible caps a core at 2. Three is a DELIBERATE late-game
    // exception and CONTENT_RIGS says to flag it if it reads wrong.
    exception: 'three slots on a core breaks the 0-2 rule on purpose',
    why: 'the endgame answer for anyone who hates losing gear.',
  },
};
const CORE_LIST = Object.keys(CORES);

// ---------------------------------------------------------------------------
// `size` drives the permanent slot cap (Block 4) and nothing else needs a
// second table. `ability` names a behaviour below, or is null for a rig whose
// behaviour is a content pass.
const RIGS = {
  // `opens` is BARRIER TYPE IDS and is the live rule — Barriers._rigOpens
  // reads it, and a type id in here that BARRIER_TYPES does not have is a
  // promise the game cannot keep. Five such ids were sitting in these lists
  // (shelf, verticalscrap, furnacefloor, coolantsump, lowwall); they are gate
  // shapes the content pass named and the barrier table never got, so they
  // live in `opensPlanned` until they are real. Moving them was not a
  // deletion: the day one is written, it moves back across.
  mammoth: {
    id: 'mammoth', name: 'MAMMOTH', size: 'large', slots: 4,
    hp: 1.60, speed: 0.72, turn: 0.55, towMul: 0.85, sockets: 8,
    ability: 'smash', abilityName: 'SMASH THROUGH',
    opens: ['wall', 'rockfall', 'barricade'],
    found: 'wreck in the second district, behind a fight you will lose the first time',
    why: 'the key to a third of the map, and the first time a build feels oversized',
  },
  cheetah: {
    id: 'cheetah', name: 'CHEETAH', size: 'small', slots: 2,
    hp: 0.70, speed: 1.45, turn: 1.30, towMul: 1.45, sockets: 4,
    ability: 'sprint', abilityName: 'SPRINT AND VAULT',
    opens: ['ledge', 'gap'], opensPlanned: ['shelf'],
    found: 'restored from a wreck in the wasteland, deep in a hazard field',
    why: 'the map is big; this is what makes crossing it not a chore',
  },
  tank: {
    id: 'tank', name: 'TANK', size: 'medium', slots: 3,
    hp: 1.35, speed: 0.92, turn: 0.85, towMul: 1.00, sockets: 6,
    ability: 'blastproof', abilityName: 'BLAST RESISTANT',
    opens: ['minefield'],
    found: 'district garage reward - claim the garage, restore the wreck parked in it',
    why: 'several districts are laced with mined ground that is off-limits until this',
  },
  // ---- the content pass. Data now so Block 8 can lay gates against them. --
  crab: {
    id: 'crab', name: 'CRAB', size: 'medium', slots: 3,
    hp: 1.15, speed: 0.78, turn: 0.90, towMul: 1.10, sockets: 6,
    ability: null, abilityName: 'CLIMB AND GRIP',
    opens: ['cliff'], opensPlanned: ['verticalscrap'],
    found: 'roaming boss drop',
    why: 'turns the vertical dimension on',
  },
  hauler: {
    id: 'hauler', name: 'HAULER', size: 'large', slots: 4,
    hp: 1.30, speed: 0.85, turn: 0.70, towMul: 0.60, sockets: 7, towCapacity: 2,
    ability: null, abilityName: 'DOUBLE TOW',
    opens: [],
    found: 'mission reward, mid-game',
    why: 'the economy rig - the difference between three trips and one',
  },
  kiln: {
    id: 'kiln', name: 'KILN', size: 'medium', slots: 3,
    hp: 1.10, speed: 0.95, turn: 0.90, towMul: 1.05, sockets: 6,
    ability: null, abilityName: 'HEAT PURGE',
    opens: ['molten'], opensPlanned: ['furnacefloor'],
    found: 'the furnace district lair boss',
    why: 'opens the foundry, and a free heat dump changes how you build',
  },
  diver: {
    id: 'diver', name: 'DIVER', size: 'small', slots: 2,
    hp: 0.85, speed: 0.80, turn: 1.00, towMul: 1.30, sockets: 4,
    ability: null, abilityName: 'SUBMERGE',
    opens: ['flooded'], opensPlanned: ['coolantsump'],
    found: 'a wreck at the bottom of a drained sump',
    why: 'a traversal tool with a gun taped on',
  },
  gantry: {
    id: 'gantry', name: 'GANTRY', size: 'large', slots: 3,
    hp: 1.40, speed: 0.70, turn: 0.60, towMul: 0.95, sockets: 7,
    ability: null, abilityName: 'DEPLOY',
    opens: [],
    found: 'late, a break-in into a sealed depot',
    why: 'the anti-attrition rig - push one district further before turning back',
  },
  shrike: {
    id: 'shrike', name: 'SHRIKE', size: 'small', slots: 2,
    hp: 0.65, speed: 1.25, turn: 1.35, towMul: 1.60, sockets: 4,
    ability: null, abilityName: 'HOVER',
    opens: ['gap', 'rubble', 'belt', 'minefield', 'ledge'],
    opensPlanned: ['lowwall'],
    found: 'the last roaming boss',
    why: 'the endgame answer that makes you re-read the whole map',
  },
};
const RIG_LIST = Object.keys(RIGS);

// 7.6 / B.6. Places a rig physically cannot go. The doorway is too small and
// the player must SEE that rather than hit an invisible wall.
const RIG_REFUSES = ['city', 'mine', 'lair', 'duct', 'interior'];

const RIG = {
  SPRINT_MUL: 1.55,        // Cheetah, sustained overland
  SPRINT_HEAT: 0,          // free: it is traversal, not a combat button
  VAULT_DIST: 620,
  VAULT_COOLDOWN: 1.6,
  SMASH_SPEED: 0.55,       // fraction of max speed needed to break through
  BLAST_MUL: 0.15,         // what an explosion does to a Tank
  RESTORE_SCRAP: 900,      // the fallback, for a caller with no rig in hand
  // BY SIZE, which is what CONTENT_ECONOMY asks for: "1,500 to 4,000 by
  // size. Mammoth is 4,000." A large rig is the key to a third of the map
  // and should cost more than one spine step, which 900 did not.
  RESTORE_BY_SIZE: { small: 1500, medium: 2500, large: 4000 },
};

// ---------------------------------------------------------------------------
const Rigs = {
  // ---- what you own ------------------------------------------------------
  owned() {
    Progress.rigsOwned = Progress.rigsOwned || {};
    return RIG_LIST.filter(id => Progress.rigsOwned[id]);
  },
  owns(id) {
    return !!(Progress.rigsOwned && Progress.rigsOwned[id]);
  },
  grant(id) {
    if (!RIGS[id]) return false;
    Progress.rigsOwned = Progress.rigsOwned || {};
    if (Progress.rigsOwned[id]) return false;
    Progress.rigsOwned[id] = true;
    // "Look at you. Own transport." Fired HERE, at the one write that makes a
    // rig yours -- a restore at a garage, a chassis parked and paid for, a
    // mission's KILN -- and nowhere else. It sat in Wrecks.restore, which
    // GameState._enterDistrict calls on EVERY district entry, so the line
    // was spent on a new save's first frame in the Yard, with no rig in
    // sight, and never heard again. Found by unwire --boot: Wrecks.restore
    // could be stubbed and nothing noticed, because nothing had ever
    // asserted what it fired.
    if (typeof Radio !== 'undefined') Radio.fire('first_rig_restored');
    return true;
  },

  coreId() { return (Progress.coreId && CORES[Progress.coreId]) ? Progress.coreId : 'clip'; },
  core() { return CORES[this.coreId()]; },

  // The rig you are currently INSIDE, or null when you are walking as a core.
  dockedId() {
    const id = Progress.dockedRig;
    return (id && RIGS[id] && this.owns(id)) ? id : null;
  },
  docked() { const id = this.dockedId(); return id ? RIGS[id] : null; },

  // 7.1 The vehicle whose permanent slots apply: the rig if you are in one,
  // else the core. ONE function, so Block 4's slot code never has to know
  // which case it is in.
  vehicleId() { return this.dockedId() || ('core:' + this.coreId()); },

  sizeOf(vehicleId) {
    if (RIGS[vehicleId]) return RIGS[vehicleId].size;
    return 'core';
  },
  slotCapOf(vehicleId) {
    if (RIGS[vehicleId]) return RIGS[vehicleId].slots;
    const cid = String(vehicleId || '').replace(/^core:/, '');
    return (CORES[cid] || CORES.clip).slots;
  },

  // ---- 7.3 DOCKING -------------------------------------------------------
  // Docking and undocking happen at a garage, or anywhere the rig is parked.
  // Leaving a rig parked and continuing as the core is a FIRST-CLASS action,
  // not an edge case - the design depends on it happening constantly.
  dock(player, rigId) {
    if (!RIGS[rigId] || !this.owns(rigId)) return false;
    Progress.dockedRig = rigId;
    this.applyTo(player);
    return true;
  },

  undock(player, x, y, districtId) {
    const id = this.dockedId();
    if (!id) return false;
    // The rig stays WHERE YOU LEFT IT. Parked position is saved, because
    // walking out of a mine and finding your Mammoth gone would be the single
    // worst thing this system could do.
    Progress.parked = Progress.parked || {};
    Progress.parked[id] = {
      x: x !== undefined ? x : (player ? player.x : 0),
      y: y !== undefined ? y : (player ? player.y : 0),
      district: districtId || (typeof World !== 'undefined' && World.district
        ? World.district.id : null),
    };
    Progress.dockedRig = null;
    this.applyTo(player);
    return true;
  },

  parkedAt(rigId) {
    return (Progress.parked && Progress.parked[rigId]) || null;
  },

  // Is the rig close enough to climb back into?
  canDockHere(player, rigId) {
    const p = this.parkedAt(rigId);
    if (!p || !player) return false;
    if (typeof World !== 'undefined' && World.district &&
        p.district && p.district !== World.district.id) return false;
    return Math.hypot(player.x - p.x, player.y - p.y) < 420;
  },

  // ---- the machine -------------------------------------------------------
  // CORE + RIG, never one or the other. The core supplies power and the rig
  // supplies mass, so a Mammoth driven by a SPINDLE is genuinely different
  // from the same Mammoth driven by an ANVIL.
  applyTo(player) {
    if (!player) return null;
    const c = this.core();
    const r = this.docked();

    player.coreId = c.id;
    player.rigId = r ? r.id : null;
    player.vehicleId = this.vehicleId();

    // baseMaxHp / baseMaxSpeed / basePower were set by Frames.apply from the
    // Jackrig and Frame. Rigs multiply them rather than replacing them, so the
    // Frame progression keeps meaning something.
    const hp = (player.frameBaseHp || player.baseMaxHp || 100);
    const sp = (player.frameBaseSpeed || player.baseMaxSpeed || 640);
    const pw = (player.framePower !== undefined ? player.framePower
                : (player.basePower || 8));
    player.frameBaseHp = hp;
    player.frameBaseSpeed = sp;
    player.framePower = pw;

    const hpMul = c.hp * (r ? r.hp : 1);
    const spMul = c.speed * (r ? r.speed : 1);
    const frac = player.maxHp ? Math.min(1, player.hp / player.maxHp) : 1;
    player.baseMaxHp = Math.round(hp * hpMul);
    player.maxHp = player.baseMaxHp;
    player.hp = Math.max(1, Math.round(player.maxHp * frac));
    player.baseMaxSpeed = sp * spMul;
    player.maxSpeed = player.baseMaxSpeed;
    player.basePower = Math.round(pw * c.power);
    player.turnMul = (r ? r.turn : 1);
    player.towCapacity = (r && r.towCapacity) ? r.towCapacity : 1;
    player.rigTowMul = (r ? r.towMul : 1);

    if (typeof Machine !== 'undefined') {
      Machine.recalcPower(player);
      Machine.recalcStats(player);
    }
    if (typeof Permanents !== 'undefined') {
      Permanents.applyTo(player, this.vehicleId());
    }
    return player;
  },

  // ---- 7.4 THE THREE ABILITIES ------------------------------------------
  // Passive ones are asked for by the systems that care; the button ones come
  // through the ONE shared action input (7.5), which Block 6 already bound.
  abilityOf(player) {
    // THE MACHINE IT WAS HANDED, not the global docked rig. These functions
    // all take a `player` and the first version ignored it, reading
    // Progress.dockedRig instead - so asking about one machine gave you the
    // answer for whichever one happened to be docked last. Harmless with
    // exactly one player and wrong the moment there is anything else, which
    // test_block7 demonstrated by docking two machines in one run.
    if (player && player.rigId !== undefined) {
      return player.rigId ? (RIGS[player.rigId] || {}).ability || null : null;
    }
    const r = this.docked();
    return r ? r.ability : null;
  },

  // CHEETAH SPRINT: sustained overland speed. Passive, and deliberately free -
  // it is traversal, not a combat button, and charging heat for driving would
  // make the rig that exists to make the map crossable annoying to cross with.
  speedMul(player) {
    if (this.abilityOf(player) !== 'sprint') return 1;
    // Only out in the open: sprinting is what the rig is for, and it should
    // not turn every fight into a chase.
    // Through the out-of-combat pace (Population.think's calmK), which slews
    // both ways, so the sprint is a gear change rather than a jolt. Not
    // `if (inCombat) return 1`: that line sat above the ramp in the first
    // version and took the whole sprint away the frame a patrol noticed
    // you -- tools/pacecheck.py measured it in Chrome as a 36% step.
    const calm = (player && player.calmK !== undefined) ? player.calmK
      : ((player && player.inCombat) ? 0 : 1);
    return 1 + (RIG.SPRINT_MUL - 1) * calm;
  },

  // MAMMOTH SMASH: passive while driving. A wall stops being a wall if you hit
  // it hard enough. Terrain destruction, asked at the point of collision.
  smashes(player, kind) {
    if (this.abilityOf(player) !== 'smash') return false;
    if (!RIGS.mammoth.opens.includes(kind)) return false;
    const sp = Math.hypot(player.vx || 0, player.vy || 0);
    return sp >= (player.maxSpeed || 640) * RIG.SMASH_SPEED;
  },

  // TANK BLAST RESIST: a damage-TYPE immunity, which is a different shape from
  // the other two and is why it is one of the three built now.
  damageMul(player, damageType) {
    if (this.abilityOf(player) !== 'blastproof') return 1;
    return (damageType === 'blast' || damageType === 'mine' ||
            damageType === 'splash') ? RIG.BLAST_MUL : 1;
  },

  // CHEETAH VAULT: the button half, on the shared action input. One rig with
  // one passive AND one button is what proves the input design.
  ability(player) {
    const a = this.abilityOf(player);
    if (a !== 'sprint') return false;          // only the Cheetah has a button
    if ((player._vaultCd || 0) > 0) return false;
    player._vaultCd = RIG.VAULT_COOLDOWN;
    const len = Math.hypot(player.aimX || 1, player.aimY || 0) || 1;
    player.x += (player.aimX / len) * RIG.VAULT_DIST;
    player.y += (player.aimY / len) * RIG.VAULT_DIST;
    player._vaulting = 0.35;
    if (typeof Effects !== 'undefined') {
      Effects.comicWord('VAULT!', player.x, player.y - 150, CONFIG.COLOR.cyan, 70);
    }
    return true;
  },

  tick(dt, player) {
    if (!player) return;
    player._vaultCd = Math.max(0, (player._vaultCd || 0) - dt);
    player._vaulting = Math.max(0, (player._vaulting || 0) - dt);
  },

  // ---- 7.6 RIGS ARE OPEN WORLD ONLY -------------------------------------
  // Cities, mines and lairs refuse rigs. The refusal has to SAY something the
  // player can act on - "TOO BIG" is not enough, they should see the doorway
  // is too small - so the reason names the rig and the place.
  refusesRig(placeKind) { return RIG_REFUSES.includes(placeKind); },

  entryRefusal(player, placeKind) {
    if (!this.refusesRig(placeKind)) return null;
    const r = this.docked();
    if (!r) return null;                       // on foot as a core: welcome in
    return r.name + ' WILL NOT FIT — LEAVE IT HERE AND GO IN AS ' +
      this.core().name;
  },

  // ---- 7.2 RESTORING -----------------------------------------------------
  // A towed chassis becomes an owned rig at a garage, for scrap plus the found
  // parts. It arrives with NEAR-ZERO SLOTS and you build it up: a rig found
  // late is not a shortcut past the slot economy.
  // WHAT A CHASSIS COSTS TO PUT BACK TOGETHER.
  //
  // CONTENT_ECONOMY Part 2: "Restore a rig chassis — 1,500 to 4,000 — BY SIZE.
  // Mammoth is 4,000." This was one flat number, 900, for every rig in the
  // game: less than a single spine step, for the machine §4.2 calls "the key
  // to a third of the map". Towing a Mammoth home is meant to be an expedition
  // you might lose, and it was ending in a bill you could pay from one good
  // afternoon.
  //
  // Takes an id, and falls back to the flat number for a caller that has none
  // — which the garage screen did, in two places, and now does not.
  restoreCost(rigId) {
    const r = rigId && RIGS[rigId];
    if (!r) return RIG.RESTORE_SCRAP;
    return RIG.RESTORE_BY_SIZE[r.size] || RIG.RESTORE_SCRAP;
  },

  // Forge has bank() and a purchase path keyed to Forge track ids, neither of
  // which fits a one-off debit. Stated here rather than reaching into
  // Forge.scrap from two places, so there is one function that knows a
  // restore is paid for and can refuse when it is not affordable.
  _pay(cost) {
    if (typeof Forge === 'undefined') return true;
    if (Forge.scrap < cost) return false;
    Forge.scrap -= cost;
    return true;
  },

  // (Rigs.restore(hulk) -- restoring straight off the tow line -- had no
  // caller in the game: a chassis dragged to a garage is PARKED by
  // Garages._onArrive and restored from the VEHICLE tab through
  // Chassis.restore, which is the only door. Found by the boot sim's count
  // (D334) and gone, with its canRestore.)
};

// ---------------------------------------------------------------------------
// Where a towed chassis WAITS at a garage until you can afford to restore it.
// Kept separate from Tow so that dragging one home and paying for it are two
// decisions rather than one, and so an unaffordable chassis is never lost.
const Chassis = {
  park(hulk, garage) {
    if (!hulk || !hulk.chassis) return null;
    // A chassis of a rig you already own is not parked: restoring it would
    // charge the full price and grant nothing (Rigs.grant refuses a rig you
    // have). The rule lived in the deleted Rigs.canRestore and came here
    // with it (D334).
    if (Rigs.owns(hulk.chassis)) return null;
    Progress.parkedChassis = Progress.parkedChassis || [];
    if (Progress.parkedChassis.some(c => c.rigId === hulk.chassis)) return null;
    Progress.parkedChassis.push({
      rigId: hulk.chassis,
      garage: garage ? garage.id : null,
    });
    hulk.alive = false;
    if (typeof World !== 'undefined') World.release(hulk);
    return hulk.chassis;
  },

  parked() { return (Progress.parkedChassis || []).slice(); },

  // Restoring from the parked list, which is what the garage screen offers.
  restore(rigId) {
    const list = Progress.parkedChassis || [];
    const i = list.findIndex(c => c.rigId === rigId);
    if (i < 0) return null;
    if (!Rigs._pay(Rigs.restoreCost(rigId))) return null;
    Rigs.grant(rigId);
    list.splice(i, 1);
    return RIGS[rigId];
  },
};

// ---------------------------------------------------------------------------
// THE MACHINES ARE FOUND AS WRECKS (Q4, BREAKLANDS_ANSWERS, 20 Sept 2026).
//
// The middle layer. A player is always one of the six machines in `JACKRIGS`
// (frames.js), each with its own stats there and its own SPECIAL and mods in
// mods.js; a new save owns the JACKAL. The other five sat behind Yard plates
// that said LOCKED -- BEAT <WARDEN>, and BREAKLANDS has no Wardens, so no
// player could ever reach a second machine. Aaron's answer: each one is a
// wreck somewhere in the world. Drive to it, tow it home, restore it.
//
// Two rules from the answer. Machines come EARLIER than the rigs -- the
// first is in the Yard, so a player is choosing between machines well before
// the first big vehicle docks. And the route is deliberately different from
// the other two ladders: frames advance on districts reached (Q6), rigs
// come from wrecks behind fights, missions and boss drops, and machines are
// the find-and-recover ladder with no fight gating it.
//
// Same shape as Chassis above, on purpose: a wreck dragged to a garage is
// PARKED there (Garages._onArrive), and paid for from the garage's VEHICLE
// tab; an unaffordable one is never lost. Restoring calls Progress.unlockRig,
// the one write that makes a machine yours, and the Yard's plate selects it.
//
// THE PRICE IS A LADDER, NOT ONE FIGURE (BREAKLANDS_ANSWERS round 2, 22 Sept
// 2026). 600 flat was too cheap -- Aaron: "this is supposed to be a big
// game. not finish quickly." The five machines cost, IN THE ORDER THE PLAYER
// RESTORES THEM, 1,000 / 2,000 / 3,500 / 5,000 / 7,000. The rung is the
// COUNT ALREADY RESTORED, never which machine it is: a player who finds the
// fifth wreck early pays first-machine money for it, so the ladder paces the
// whole game instead of gating on where you wandered. At the measured
// 73 scrap/min that is ~15 minutes of banking for the first and over an hour
// and a half for the last before the scrap-rate levers (skills, ASSAY,
// HAULER) stack on top.
//
// The count is DERIVED from the machines owned beyond the one every save
// starts with, rather than kept as a second counter: two records of the same
// fact are one record and one bug, and an older save needs no migration.
const MACHINE_RESTORE_LADDER = [1000, 2000, 3500, 5000, 7000];

const MachineWrecks = {
  // How many machines this save has restored so far: everything in
  // `unlockedRigs` that is not the JACKAL a new save wakes as.
  restoredCount() {
    if (typeof Progress === 'undefined' || !Progress.unlockedRigs) return 0;
    return Progress.unlockedRigs.filter(id => id !== 'jackal' && JACKRIGS[id]).length;
  },

  // What the NEXT restore costs. Past the top of the ladder (there are five
  // machines to find and five rungs, so only a dev unlock gets there) the
  // top rung holds rather than the price falling off the end to undefined.
  cost() {
    const n = Math.min(this.restoredCount(), MACHINE_RESTORE_LADDER.length - 1);
    return MACHINE_RESTORE_LADDER[n];
  },

  park(hulk, garage) {
    if (!hulk || !hulk.machine || !JACKRIGS[hulk.machine]) return null;
    // A wreck of a machine you already own is not parked: restoring it
    // would charge the price and grant nothing (unlockRig refuses).
    if (Progress.rigUnlocked(hulk.machine)) return null;
    Progress.parkedMachines = Progress.parkedMachines || [];
    if (Progress.parkedMachines.some(m => m.machineId === hulk.machine)) return null;
    Progress.parkedMachines.push({ machineId: hulk.machine, garage: garage ? garage.id : null });
    hulk.alive = false;
    if (typeof World !== 'undefined') World.release(hulk);
    return hulk.machine;
  },

  parked() { return (Progress.parkedMachines || []).slice(); },
  parkedAt(machineId) {
    const m = (Progress.parkedMachines || []).find(x => x.machineId === machineId);
    return m ? (m.garage || null) : null;
  },

  restore(machineId) {
    const list = Progress.parkedMachines || [];
    const i = list.findIndex(m => m.machineId === machineId);
    if (i < 0) return null;
    if (!Rigs._pay(this.cost())) return null;
    Progress.unlockRig(machineId);
    list.splice(i, 1);
    return JACKRIGS[machineId];
  },

  // WHERE A MACHINE'S WRECK LIES, read off the district data so the Yard
  // plate can say it and there is one source for it. Null for the machine
  // you start as, or one no district places.
  wreckDistrict(machineId) {
    if (typeof DISTRICT_LIST === 'undefined') return null;
    for (const did of DISTRICT_LIST) {
      const d = DISTRICTS[did];
      const spec = d && d._spec && d._spec.machines;
      if (!spec) continue;
      for (const k of Object.keys(spec)) {
        if (spec[k].some(row => row[2] === machineId)) return d;
      }
    }
    return null;
  },

  // THE PLATE'S LINE for a machine you do not own yet. Says what to do,
  // which is the refusal-is-the-prompt rule: where the wreck is, or where
  // it is parked and what it costs.
  lockedText(machineId) {
    const J = JACKRIGS[machineId];
    const name = J ? J.name : String(machineId).toUpperCase();
    const at = this.parkedAt(machineId);
    if (at) {
      const g = (typeof Garages !== 'undefined' && Garages.networkList)
        ? Garages.networkList().find(q => q.id === at) : null;
      return 'LOCKED — ' + name + ' WRECK PARKED AT ' + (g ? g.name : 'A GARAGE') +
        '. RESTORE IT THERE FOR ' + this.cost() + ' SCRAP';
    }
    const d = this.wreckDistrict(machineId);
    return 'LOCKED — ITS WRECK IS IN ' + (d ? d.name : 'THE WORLD') + '. TOW IT HOME';
  },
};

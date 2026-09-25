// SCRAPCORE: BREAKLANDS — THE ENEMY ROSTER (content/draft_enemies.js, absorbed)
//
// "AN ENEMY IS A BUILD, NOT A CLASS. Every machine in this game is a body with
//  sockets, modules on connectors, a reactor and legs — the same as the
//  player. So adding an enemy must be one entry in this file and nothing else."
//
// And the half that makes it matter:
//
// "THE ROSTER IS ALSO THE LOOT TABLE. What you put on a machine is what the
//  player can take off it, so an enemy must NEVER carry a part the player
//  can't use."
//
// ---------------------------------------------------------------------------
// WHY THIS FILE IS A TRANSLATION AND NOT A COPY
//
// The draft was authored against its own vocabulary, and the README says to
// bend it to whatever the engine already uses rather than the other way round.
// Three things needed bending, and one of them was worth keeping:
//
//   1. CORES. The draft says lightEnemyCore / mediumEnemyCore / heavyEnemyCore
//      / swarmEnemyCore / fixedEnemyCore. `ENEMY_CORES` in enemy.js has had
//      light / standard / heavy / swarm / carrier / siege since WRECKJACK, and
//      they carry tuned HP, radius, socket counts and module caps. Mapped, not
//      renamed: the tuning is the valuable part.
//
//   2. BRAINS. The draft says BASIC / AGGRESSIVE / KITE / SNIPER / ARTY /
//      ZONER / SUPPORT / SWARM / GUARD. `AI_CORES` has six buildable brains.
//      Mapped onto those, and where the draft asks for a brain that does not
//      exist yet the mapping says so out loud rather than silently picking one
//      — `Enemies.unbuiltBrains()` lists them, and Block 14 is where they land.
//
//   3. MOUNT POSITION, and this one is kept exactly. The draft is emphatic:
//
//        "WHERE YOU MOUNT THINGS IS A DESIGN DECISION. Connectors sit inboard,
//         behind the module, so a machine with everything mounted front is a
//         machine you must get behind. That's the game."
//
//      `Machine.initSockets` builds an evenly spaced ring starting at -90°
//      (straight up = the way the machine faces), so front / side / rear map
//      onto ring indices exactly, for any socket count. The intent survives
//      the translation, which is the only reason the translation is worth
//      doing rather than flattening every build to "put it anywhere".

const ENEMY_BUILDS = {

  // =====================================================================
  // THE YARD — tutorial ground. No alert here, ever.
  // =====================================================================

  // 2:00 — the connector lesson. Dies in three seconds. Drops nothing.
  picker: {
    name: 'PICKER', family: 'SORTER', size: 'small',
    core: 'lightEnemyCore', ai: 'BASIC',
    sockets: [
      { at: 'front', part: 'emergencyBlaster' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['yard'], drops: 'patrol',
  },

  // 5:00 — the flanking lesson. ARMOUR IN FRONT OF THE GUN.
  // No dialogue during this fight. Let them work it out.
  stacker: {
    name: 'STACKER', family: 'HAULER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'BASIC',
    sockets: [
      { at: 'front',      part: 'machineGun' },
      { at: 'front-left', part: 'armourPlate' },
      { at: 'rear',       part: 'smallReactor' },
    ],
    districts: ['yard'], drops: 'patrol',
  },

  // 11:00 — the rip lesson. Closes to melee, so its connector gets damaged
  // whether the player means it to or not.
  grabber: {
    name: 'GRABBER', family: 'SORTER', size: 'small',
    core: 'lightEnemyCore', ai: 'AGGRESSIVE',
    sockets: [
      { at: 'front', part: 'saw' },
      { at: 'rear',  part: 'smallReactor' },
      { at: 'rear',  part: 'thruster' },
    ],
    districts: ['yard'], drops: 'patrol',
  },

  // 13:00 — the restraint lesson. Not beatable at hour one and it must LOOK it.
  foremans_hand: {
    name: "THE FOREMAN'S HAND", family: 'GUARDIAN', size: 'medium',
    core: 'heavyEnemyCore', ai: 'GUARD', elite: true,
    sockets: [
      { at: 'front',       part: 'directionalShield' },
      { at: 'front-left',  part: 'machineGun' },
      { at: 'front-right', part: 'machineGun' },
      { at: 'left',        part: 'armourPlate' },
      { at: 'right',       part: 'armourPlate' },
      { at: 'centre',      part: 'bigReactor' },
    ],
    districts: ['yard'], drops: 'elite',
  },

  // =====================================================================
  // IRONWORKS — heat, armour, slow. Flamethrowers are a bad idea here.
  // =====================================================================

  pourer: {
    name: 'POURER', family: 'HAULER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'ZONER',
    sockets: [
      { at: 'front', part: 'flamethrower' },
      { at: 'top',   part: 'heatSink' },
      { at: 'left',  part: 'armourPlate' },
      { at: 'right', part: 'armourPlate' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['ironworks'], drops: 'patrol',
    heatResist: 0.6,
  },

  // Recoil shoves it backwards. That's readable and exploitable.
  tapper: {
    name: 'TAPPER', family: 'WALKER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'KITE',
    sockets: [
      { at: 'front', part: 'cannon' },
      { at: 'top',   part: 'radiator' },
      { at: 'rear',  part: 'thruster' },
      { at: 'rear',  part: 'thruster' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['ironworks'], drops: 'patrol',
  },

  // Front is impenetrable. Reactor is mounted REAR. That's the whole fight.
  slagjaw: {
    name: 'SLAGJAW', family: 'GUARDIAN', size: 'large',
    core: 'heavyEnemyCore', ai: 'AGGRESSIVE',
    sockets: [
      { at: 'front',  part: 'drill' },
      { at: 'front',  part: 'heavyArmour' },
      { at: 'left',   part: 'reactiveArmour' },
      { at: 'right',  part: 'reactiveArmour' },
      { at: 'rear',   part: 'bigReactor' },
      { at: 'top',    part: 'coolantPump' },
    ],
    districts: ['ironworks', 'sprawl'], drops: 'patrol',
    heatResist: 0.7,
  },

  cinder: {
    name: 'CINDER', family: 'DRONE', size: 'small',
    core: 'swarmEnemyCore', ai: 'SWARM', packSize: 5,
    sockets: [
      { at: 'front', part: 'plasmaRepeater' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['ironworks'], drops: 'patrol',
  },

  // Doesn't move. Arcs shells over everything. Kill it or leave.
  ladle: {
    name: 'LADLE', family: 'ARM', size: 'fixed',
    core: 'fixedEnemyCore', ai: 'ARTY', immobile: true,
    sockets: [
      { at: 'top',  part: 'mortar' },
      { at: 'base', part: 'armourPlate' },
      { at: 'base', part: 'bigReactor' },
    ],
    districts: ['ironworks', 'digs'], drops: 'patrol',
  },

  the_press: {
    name: 'THE PRESS', family: 'RIG', size: 'large',
    core: 'heavyEnemyCore', ai: 'GUARD', elite: true,
    sockets: [
      { at: 'front',  part: 'crusherPress' },
      { at: 'front',  part: 'heavyArmour' },
      { at: 'left',   part: 'heavyArmour' },
      { at: 'right',  part: 'heavyArmour' },
      { at: 'top',    part: 'shockwaveCannon' },
      { at: 'rear',   part: 'bigReactor' },
      { at: 'rear',   part: 'bigReactor' },
      { at: 'top',    part: 'radiator' },
      { at: 'top',    part: 'radiator' },
    ],
    districts: ['ironworks'], drops: 'elite',
  },

  // =====================================================================
  // THE GROWS — fast, light, numerous. (Expansion district.)
  // =====================================================================

  pollen: {
    name: 'POLLEN', family: 'DRONE', size: 'small',
    core: 'swarmEnemyCore', ai: 'SWARM', packSize: 8,
    sockets: [
      { at: 'front', part: 'machineGun' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['grows'], drops: 'patrol',
  },

  // Two saws, no ranged option at all. Kiting is free — teach that here.
  tiller: {
    name: 'TILLER', family: 'WALKER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'AGGRESSIVE',
    sockets: [
      { at: 'front', part: 'saw' },
      { at: 'left',  part: 'saw' },
      { at: 'rear',  part: 'smallReactor' },
      { at: 'rear',  part: 'thruster' },
    ],
    districts: ['grows'], drops: 'patrol',
  },

  // Drops mines behind it while it runs. Chasing it is how you learn not to.
  sprayer: {
    name: 'SPRAYER', family: 'RUNNER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'KITE',
    sockets: [
      { at: 'rear',  part: 'mineLayer' },
      { at: 'front', part: 'machineGun' },
      { at: 'rear',  part: 'thruster' },
      { at: 'rear',  part: 'thruster' },
      { at: 'centre',part: 'smallReactor' },
    ],
    districts: ['grows'], drops: 'patrol',
  },

  stalk: {
    name: 'STALK', family: 'WALKER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'SNIPER',
    sockets: [
      { at: 'top',   part: 'railgun' },
      { at: 'front', part: 'targetingModule' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['grows', 'sprawl', 'digs', 'barrens'], drops: 'patrol',
  },

  // Spawns POLLEN endlessly and repairs everything nearby. KILL IT FIRST.
  hive: {
    name: 'HIVE', family: 'HAULER', size: 'large',
    core: 'heavyEnemyCore', ai: 'SUPPORT',
    sockets: [
      { at: 'top',   part: 'droneBay' },
      { at: 'top',   part: 'droneBay' },
      { at: 'front', part: 'repairArm' },
      { at: 'left',  part: 'armourPlate' },
      { at: 'right', part: 'armourPlate' },
      { at: 'rear',  part: 'bigReactor' },
    ],
    districts: ['grows'], drops: 'patrol',
    neverWith: ['summons'],       // two "kill it first" supports in one fight is unfair
  },

  reaper_spur: {
    name: 'REAPER SPUR', family: 'RIG', size: 'large',
    core: 'heavyEnemyCore', ai: 'AGGRESSIVE', elite: true,
    sockets: [
      { at: 'front', part: 'forkBeam', children: [
        { part: 'saw' }, { part: 'saw' },
      ]},
      { at: 'front', part: 'saw' },
      { at: 'front', part: 'heavyArmour' },
      { at: 'rear',  part: 'bigReactor' },
      { at: 'under', part: 'heavyTreads' },
    ],
    districts: ['grows'], drops: 'elite',
  },

  // =====================================================================
  // NEON CUT — precise, ranged, coordinated. Core only.
  // =====================================================================

  // Advances in a line with others. Flanking in narrow streets is the puzzle.
  marshal: {
    name: 'MARSHAL', family: 'GUARDIAN', size: 'medium',
    core: 'mediumEnemyCore', ai: 'GUARD',
    sockets: [
      { at: 'front',       part: 'directionalShield' },
      { at: 'front-left',  part: 'burstRifle' },
      { at: 'front-right', part: 'burstRifle' },
      { at: 'left',        part: 'armourPlate' },
      { at: 'right',       part: 'armourPlate' },
      { at: 'rear',        part: 'smallReactor' },
    ],
    districts: ['neoncut', 'stacks'], drops: 'patrol',
    formation: 'line',
  },

  // Hitscan, so COVER matters, not dodging.
  watch: {
    name: 'WATCH', family: 'DRONE', size: 'small',
    core: 'lightEnemyCore', ai: 'KITE',
    sockets: [
      { at: 'front', part: 'beamLaser' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['neoncut', 'stacks'], drops: 'patrol',
  },

  // Wall-mounted. Marks you for everything else in the district.
  cite: {
    name: 'CITE', family: 'ARM', size: 'fixed',
    core: 'fixedEnemyCore', ai: 'SNIPER', immobile: true, mount: 'wall',
    sockets: [
      { at: 'top',  part: 'railgun' },
      { at: 'top',  part: 'scanner' },
      { at: 'base', part: 'armourPlate' },
    ],
    districts: ['neoncut', 'stacks'], drops: 'patrol',
    marksTarget: true,
  },

  // Cuts streets off BEHIND you. Turns a fight into a route problem.
  curfew: {
    name: 'CURFEW', family: 'RUNNER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'ZONER',
    sockets: [
      { at: 'front', part: 'laserEmitter' },
      { at: 'top',   part: 'arcGun' },
      { at: 'rear',  part: 'thruster' },
      { at: 'rear',  part: 'thruster' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['neoncut'], drops: 'patrol',
  },

  // Shields the squad AND shoots down your projectiles. The reason the Drill exists.
  summons: {
    name: 'SUMMONS', family: 'HAULER', size: 'large',
    core: 'heavyEnemyCore', ai: 'SUPPORT',
    sockets: [
      { at: 'top',   part: 'barrierProjector' },
      { at: 'left',  part: 'repairArm' },
      { at: 'right', part: 'repairArm' },
      { at: 'front', part: 'pointDefence' },
      { at: 'rear',  part: 'bigReactor' },
    ],
    districts: ['neoncut', 'stacks'], drops: 'patrol',
    neverWith: ['hive'],
  },

  // A wall with lasers. You will not out-damage it. You go around it.
  bailiffs_clerk: {
    name: "THE BAILIFF'S CLERK", family: 'GUARDIAN', size: 'large',
    core: 'heavyEnemyCore', ai: 'GUARD', elite: true,
    sockets: [
      { at: 'front-left',  part: 'directionalShield' },
      { at: 'front-right', part: 'directionalShield' },
      { at: 'front-left',  part: 'beamLaser' },
      { at: 'front-right', part: 'beamLaser' },
      { at: 'front',       part: 'pointDefence' },
      { at: 'left',        part: 'heavyArmour' },
      { at: 'rear',        part: 'bigReactor' },
      { at: 'rear',        part: 'bigReactor' },
    ],
    districts: ['neoncut'], drops: 'elite',
  },

  // =====================================================================
  // THE DIGS — heavy, terrain-breaking. (Expansion district.)
  // =====================================================================

  borer: {
    name: 'BORER', family: 'HAULER', size: 'large',
    core: 'heavyEnemyCore', ai: 'AGGRESSIVE',
    sockets: [
      { at: 'front', part: 'drill' },
      { at: 'front', part: 'heavyArmour' },
      { at: 'rear',  part: 'armourPlate' },
      { at: 'rear',  part: 'bigReactor' },
      { at: 'under', part: 'heavyTreads' },
    ],
    districts: ['digs'], drops: 'patrol',
    breaksTerrain: true,
  },

  spoil: {
    name: 'SPOIL', family: 'HAULER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'AGGRESSIVE',
    sockets: [
      { at: 'front', part: 'scattergun' },
      { at: 'left',  part: 'armourPlate' },
      { at: 'right', part: 'armourPlate' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['digs', 'barrens'], drops: 'patrol',
  },

  hoist: {
    name: 'HOIST', family: 'ARM', size: 'fixed',
    core: 'fixedEnemyCore', ai: 'ARTY', immobile: true,
    sockets: [
      { at: 'top',  part: 'mortar' },
      { at: 'base', part: 'heavyArmour' },
      { at: 'base', part: 'bigReactor' },
    ],
    districts: ['digs'], drops: 'patrol',
  },

  // Suicide runner. The reason pointDefence is worth a socket.
  // WATCH THE TELEGRAPH — a contact detonation that one-shots a full carry
  // is unfair in a game where losing your carry is the punishment.
  charge: {
    name: 'CHARGE', family: 'RUNNER', size: 'small',
    core: 'lightEnemyCore', ai: 'AGGRESSIVE', packSize: 4,
    sockets: [
      { at: 'body', part: 'explosiveCanister' },
      { at: 'rear', part: 'thruster' },
      { at: 'rear', part: 'thruster' },
      { at: 'rear', part: 'smallReactor' },
    ],
    districts: ['digs', 'sprawl', 'barrens'], drops: 'patrol',
    detonatesOnContact: true, telegraphSeconds: 1.2,
  },

  // =====================================================================
  // SUMPWORKS — ambush, electrical. (Expansion district.)
  // =====================================================================

  lurk: {
    name: 'LURK', family: 'WALKER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'AGGRESSIVE', amphibious: true,
    sockets: [
      { at: 'front', part: 'harpoon' },
      { at: 'front', part: 'saw' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['sumpworks'], drops: 'patrol',
    ambush: true,
  },

  // Chains lightning between everything, INCLUDING ITS FRIENDS.
  galvanic: {
    name: 'GALVANIC', family: 'GUARDIAN', size: 'medium',
    core: 'mediumEnemyCore', ai: 'ZONER',
    sockets: [
      { at: 'top',   part: 'arcGun' },
      { at: 'top',   part: 'polarityEmitter' },
      { at: 'left',  part: 'armourPlate' },
      { at: 'right', part: 'armourPlate' },
      { at: 'rear',  part: 'bigReactor' },
    ],
    districts: ['sumpworks'], drops: 'patrol',
    chainsToAllies: true,
  },

  bloom: {
    name: 'BLOOM', family: 'DRONE', size: 'small',
    core: 'swarmEnemyCore', ai: 'SWARM', packSize: 6,
    sockets: [
      { at: 'front', part: 'plasmaRepeater' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['sumpworks'], drops: 'patrol',
  },

  // =====================================================================
  // THE SPRAWL — patrol, curfew, scale. One elite, and nothing else
  // dangerous. That contrast IS the district.
  // =====================================================================

  // Runs the streets on a route. Calls others when it sees you.
  sweep: {
    name: 'SWEEP', family: 'RUNNER', size: 'medium',
    core: 'mediumEnemyCore', ai: 'KITE',
    sockets: [
      { at: 'front', part: 'burstRifle' },
      { at: 'top',   part: 'scanner' },
      { at: 'rear',  part: 'thruster' },
      { at: 'rear',  part: 'thruster' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['sprawl'], drops: 'patrol',
    callsForHelp: true, routes: 'streets',
  },

  // Kicks doors in for a house-to-house search that ended centuries ago.
  knock: {
    name: 'KNOCK', family: 'GUARDIAN', size: 'medium',
    core: 'mediumEnemyCore', ai: 'GUARD',
    sockets: [
      { at: 'front', part: 'shockwaveCannon' },
      { at: 'front', part: 'armourPlate' },
      { at: 'left',  part: 'armourPlate' },
      { at: 'right', part: 'armourPlate' },
      { at: 'rear',  part: 'smallReactor' },
    ],
    districts: ['sprawl'], drops: 'patrol',
  },

  // Parked in a residential street. The only dangerous thing in The Sprawl.
  block_warden: {
    name: 'BLOCK WARDEN', family: 'RIG', size: 'large',
    core: 'heavyEnemyCore', ai: 'GUARD', elite: true,
    sockets: [
      { at: 'front',       part: 'heavyArmour' },
      { at: 'left',        part: 'heavyArmour' },
      { at: 'right',       part: 'heavyArmour' },
      { at: 'rear',        part: 'heavyArmour' },
      { at: 'top',         part: 'flakCannon' },
      { at: 'front-left',  part: 'machineGun' },
      { at: 'front-right', part: 'machineGun' },
      { at: 'front',       part: 'pointDefence' },
      { at: 'rear',        part: 'bigReactor' },
      { at: 'rear',        part: 'bigReactor' },
    ],
    districts: ['sprawl'], drops: 'elite',
  },
};

// ---------------------------------------------------------------------------
// FIVE PARTS THE DRAFT NAMES THAT DO NOT EXIST, and why each is substituted
// rather than dropped.
//
// They are all WORLD HAZARDS — a crusher press, a laser gate, a canister, a
// polarity field — written as if they were mountable modules. That breaks the
// roster's own first rule:
//
//   "THE ROSTER IS ALSO THE LOOT TABLE. An enemy must NEVER carry a part the
//    player can't use. There is no such thing as an enemy-only part."
//
// Dropping them silently would leave five machines under-built and looking
// like the roster was fine, so each maps to the real part that carries the
// same intent, and `Enemies.substitutions()` reports the list so the content
// pass can decide whether to make any of them real parts instead.
const ENEMY_PART_SUBS = {
  crusherPress: 'drill',            // heavy melee that closes and grinds
  laserEmitter: 'beamLaser',        // the real beam weapon
  polarityEmitter: 'barrierProjector',  // a field that pushes you around
  explosiveCanister: 'mineLayer',   // a machine that leaves explosives
  scanner: 'targetingModule',       // the support machine's `it marks you`
};

const ENEMY_CORE_MAP = {
  lightEnemyCore: 'light',
  mediumEnemyCore: 'standard',
  heavyEnemyCore: 'heavy',
  swarmEnemyCore: 'swarm',
  // A machine that does not move. `siege` is the slowest, toughest core with
  // the most sockets, which is what a fixed emplacement wants.
  fixedEnemyCore: 'siege',
  carrierEnemyCore: 'carrier',
};

// The draft's nine roles onto the six brains that exist. Where two roles share
// a brain the difference lives in the BUILD, which is the whole premise: a
// SNIPER and a KITE are both `kiter` with very different guns on them.
const ENEMY_AI_MAP = {
  BASIC: 'strafer',
  AGGRESSIVE: 'rusher',
  KITE: 'kiter',
  SNIPER: 'sniper',        // long range, slow, stays back, holds still to fire
  ARTY: 'turret',
  ZONER: 'zoner',          // area denial: holds ground, lays mines between you
  SUPPORT: 'support',      // repairs the pack from behind it; KILL IT FIRST
  SWARM: 'swarmer',
  GUARD: 'guard',          // wards the nearest ally, holds the line between
};

// Roles the draft asks for that have no brain of their own. Empty now: the
// four that borrowed (SNIPER borrowed the kiter, ZONER and GUARD the turret,
// SUPPORT the salvager) have brains in enemy.js, and
// tests/test_brains.js drives each one against the borrowed one and asks
// what differs. Kept as a list rather than deleted so the next role added
// to the draft has somewhere honest to be counted.
const ENEMY_AI_UNBUILT = [];

// ---------------------------------------------------------------------------
// WHICH MACHINES A DISTRICT PUTS OUT, and at which alert stage.
//
// RENAMED from the draft's `SPAWN_POOLS`, because that name already means
// something else: director.js has carried WRECKJACK's zone BUDGET tables
// under it since the fork. Two constants with one name is not a thing this
// codebase gets to have — see D101 and the three bugs before it.
//
// The shape is a gift, though: `base` / `quality` / `elites` lines up exactly
// with Block 2's alert ladder. CLEAR and DENSITY draw from `base`; QUALITY
// starts drawing from `quality` as well; DISPATCH adds the elites. Until now
// the QUALITY stage only bought the Director a bigger budget, so 'better
// machines' meant 'the same machines with more bolted on'. Now it means the
// district's own harder roster, which is what the stage was always for.
const ENEMY_POOLS = {
  yard: {
    base:    [['picker', 5], ['stacker', 3], ['grabber', 2]],
    quality: [],                             // no alert in The Yard
    elites:  ['foremans_hand'],
    packSize: [1, 3],
  },
  // RAIL SPINE. A works roster - the network maintains its own lines, so what
  // patrols them is what patrols the Ironworks. No elite of its own: the
  // district's danger is the timetable, not the machines.
  railspine: {
    base:    [['pourer', 2], ['tapper', 3], ['spoil', 3]],
    quality: [['slagjaw', 1]],
    elites:  ['the_press'],
    packSize: [2, 4],
  },
  ironworks: {
    base:    [['pourer', 3], ['tapper', 3], ['cinder', 4], ['spoil', 1]],
    quality: [['slagjaw', 2], ['ladle', 1]],
    elites:  ['the_press'],
    packSize: [2, 4],
  },
  sprawl: {
    base:    [['sweep', 4], ['knock', 3], ['charge', 1]],
    quality: [['stalk', 2], ['slagjaw', 1]],
    elites:  ['block_warden'],
    packSize: [2, 4],
  },
  // CENTRAL DISPATCH. "The network's own guard: the best-built machines in
  // the game. Not more numerous -- BETTER." The city's roster with the
  // quality list folded into the base: there is no alert here to buy it.
  dispatch: {
    base:    [['marshal', 4], ['cite', 2], ['watch', 3], ['summons', 1]],
    quality: [['bailiffs_clerk', 1]],
    elites:  ['bailiffs_clerk'],
    packSize: [2, 4],
  },
  neoncut: {
    base:    [['marshal', 4], ['watch', 4], ['curfew', 2]],
    quality: [['cite', 2], ['summons', 1]],
    elites:  ['bailiffs_clerk'],
    packSize: [2, 4],
  },
  barrens: {
    base:    [['spoil', 3], ['stalk', 2], ['charge', 1]],
    quality: [['knock', 2]],
    elites:  [],
    packSize: [1, 3],
  },

  // Expansion districts
  grows: {
    base:    [['pollen', 5], ['tiller', 3], ['sprayer', 2]],
    quality: [['stalk', 2], ['hive', 1]],
    elites:  ['reaper_spur'],
    packSize: [3, 6],
  },
  digs: {
    base:    [['spoil', 3], ['borer', 2], ['charge', 2]],
    quality: [['hoist', 2], ['slagjaw', 1]],
    elites:  [],
    packSize: [2, 4],
  },
  sumpworks: {
    base:    [['bloom', 4], ['lurk', 3], ['galvanic', 2]],
    quality: [['stalk', 1]],
    elites:  [],
    packSize: [2, 5],
  },
};

// ---------------------------------------------------------------------------
const Enemies = {
  // ---- the ring ---------------------------------------------------------
  // Machine.initSockets spaces sockets evenly from -90 degrees, so index 0 is
  // dead ahead. front/side/rear are therefore fractions of the way round, and
  // this works for a 3-socket swarm body and a 12-socket siege body alike.
  socketFor(where, count, used) {
    const n = Math.max(1, count);
    // Index 0 is dead ahead and the ring runs clockwise, so every compass
    // position the draft uses is a fraction of the way round.
    //
    // `top`, `base`, `under`, `centre` and `body` are NOT on the ring:
    // this game is drawn top-down and a machine has no vertical axis to
    // mount on. They take the next free socket, and they are listed here
    // rather than falling through the default so it is obvious that the
    // authoring intent (a radiator on the roof) has no equivalent and is
    // being flattened on purpose.
    const want = {
      front: 0,
      'front-right': Math.round(n * 0.125),
      right: Math.round(n * 0.25),
      side: Math.round(n * 0.25),
      rear: Math.round(n * 0.5),
      left: Math.round(n * 0.75),
      side2: Math.round(n * 0.75),
      'front-left': Math.round(n * 0.875),
      // no vertical axis in a top-down projection:
      top: Math.round(n * 0.5),
      base: Math.round(n * 0.5),
      under: Math.round(n * 0.5),
      centre: Math.round(n * 0.5),
      body: Math.round(n * 0.5),
    };
    let i = want[where] === undefined ? 0 : want[where];
    // A second thing mounted `front` goes to the next free socket ROUND from
    // the front, so a machine authored with two front guns still reads as a
    // machine you have to get behind.
    for (let step = 0; step < n; step++) {
      const k = (i + step) % n;
      if (used.indexOf(k) < 0) return k;
    }
    return -1;
  },

  // ---- one entry becomes a machine --------------------------------------
  // Returns exactly what `new Enemy(x, y, loadout, aiType, coreKey)` wants,
  // so nothing downstream has to know this file exists.
  build(id) {
    const b = ENEMY_BUILDS[id];
    if (!b) return null;
    const coreKey = ENEMY_CORE_MAP[b.core] || 'standard';
    const core = (typeof ENEMY_CORES !== 'undefined') ? ENEMY_CORES[coreKey] : null;
    // A BOSS GETS AS MANY SOCKETS AS ITS RINGS ASK FOR. Everything else gets
    // its core's, unchanged: this is the one place a machine is allowed to be
    // bigger than its core, and only because a boss is described as rings
    // rather than as a loadout.
    const count = b.boss
      ? Math.max(core ? core.sockets : 6, (b.sockets || []).length)
      : (core ? core.sockets : 6);
    const used = [];
    const loadout = [];
    const dropped = [];
    for (const s of (b.sockets || [])) {
      const partId = ENEMY_PART_SUBS[s.part] || s.part;
      if (typeof PARTS !== 'undefined' && !PARTS[partId]) continue;
      const idx = this.socketFor(s.at, count, used);
      // NOT SILENTLY. A part the machine had no room for is a part the
      // content asked for and did not get, and that is how the Crucible lost
      // its radiators without anything saying so.
      if (idx < 0) { dropped.push(partId); continue; }
      used.push(idx);
      // Third element: what the boss layer CALLED this, which is not always
      // what it turned into. Ignored by every ordinary build (where it is
      // the same string) and load-bearing for a boss.
      loadout.push([partId, idx, s.standsFor || s.part]);
    }
    // THE BEHAVIOURS, carried with the build. Every field in BEHAVIOUR_FIELDS
    // that this machine declares rides along as `traits`, and
    // Enemies.applyTraits puts them on the machine at the spawn seam, so a
    // sentence in the roster becomes a field a brain can read.
    const traits = {};
    for (const f of this.BEHAVIOUR_FIELDS) if (b[f] !== undefined) traits[f] = b[f];
    return {
      id, name: b.name, coreKey, loadout, traits,
      aiType: ENEMY_AI_MAP[b.ai] || 'strafer',
      role: b.ai,
      family: b.family,
      districts: b.districts || [],
      drops: b.drops || 'patrol',
      // BLOCK 14: passed through so the machine knows it is a boss. Without
      // it the phase system has nothing to key on and a boss is a big enemy.
      bossId: b.bossId || null,
      // How many sockets the machine needs, and what did not fit.
      sockets: count,
      dropped,
    };
  },

  list() { return Object.keys(ENEMY_BUILDS); },

  // PUT THE ROSTER'S SENTENCES ON THE MACHINE. Called at every spawn seam
  // that builds from the roster (Population's three, and spawnBuild), so a
  // trait cannot be present on a patrol and missing on a placed machine.
  //
  //   immobile / mount        it never steers; a wall mount snaps to a wall
  //   heatResist              flame and molten damage scaled down (applyDamage)
  //   amphibious              wades water and rough unslowed
  //   breaksTerrain           rough and molten do not slow it (the "breaks
  //                           pillars" half waits on the Digs, and says so)
  //   the rest                read by the brains and by Population.think
  applyTraits(e, built) {
    if (!e || !built) return e;
    const t = built.traits || {};
    e.traits = t;
    if (t.immobile || t.mount) e.immobile = true;
    if (t.heatResist) e.heatResist = t.heatResist;
    if (t.amphibious || t.breaksTerrain) e.terrainImmune = true;
    if (t.detonatesOnContact) {
      e.detonates = true;
      e.telegraphSeconds = t.telegraphSeconds || 1.0;
    }
    return e;
  },

  pool(districtId) { return ENEMY_POOLS[districtId] || null; },
  hasPool(districtId) { return !!ENEMY_POOLS[districtId]; },

  // Which machine a post puts out, given the district and the alert stage.
  // SEEDED, not random: Block 2's whole point is that a post produces the
  // same machine every visit, so 'that yard has a SLAGJAW in it' can be a
  // true sentence a player learns.
  pick(districtId, stageTier, roll) {
    const p = this.pool(districtId);
    if (!p) return null;
    // QUALITY (tier 1) and above mix the harder roster in; below that the
    // district only ever shows you its ordinary machines.
    const rows = (stageTier >= 1 && p.quality && p.quality.length)
      ? p.base.concat(p.quality) : p.base;
    if (!rows || !rows.length) return null;
    let total = 0;
    for (const r of rows) total += r[1];
    let k = ((roll === undefined ? Math.random() : roll) % 1) * total;
    for (const r of rows) { k -= r[1]; if (k <= 0) return r[0]; }
    return rows[rows.length - 1][0];
  },

  pickElite(districtId, roll) {
    const p = this.pool(districtId);
    if (!p || !p.elites || !p.elites.length) return null;
    const i = Math.floor(((roll === undefined ? Math.random() : roll) % 1) *
      p.elites.length);
    return p.elites[Math.min(i, p.elites.length - 1)];
  },

  inDistrict(districtId) {
    return this.list().filter(id =>
      (ENEMY_BUILDS[id].districts || []).indexOf(districtId) >= 0);
  },

  // ---- the two rules the roster has to hold ------------------------------
  // "An enemy must never carry a part the player can't use." Checked here
  // rather than only in a test, so a bad row is answerable at runtime too.
  illegalParts() {
    const bad = [];
    for (const id of this.list()) {
      for (const s of (ENEMY_BUILDS[id].sockets || [])) {
        if (typeof PARTS === 'undefined') continue;
        const partId = ENEMY_PART_SUBS[s.part] || s.part;
        if (!PARTS[partId]) bad.push(id + ': "' + s.part + '" is not a part');
        else if (PARTS[partId].permanent) {
          bad.push(id + ': "' + s.part + '" is a permanent, which is player-only');
        }
      }
    }
    return bad;
  },

  // What had to be substituted to hold that rule, so it is answerable rather
  // than buried in a comment.
  substitutions() {
    const out = [];
    for (const id of this.list()) {
      for (const s of (ENEMY_BUILDS[id].sockets || [])) {
        if (ENEMY_PART_SUBS[s.part]) {
          out.push(id + ': ' + s.part + ' -> ' + ENEMY_PART_SUBS[s.part]);
        }
      }
    }
    return out;
  },

  unbuiltBrains() {
    const out = {};
    for (const id of this.list()) {
      const role = ENEMY_BUILDS[id].ai;
      if (ENEMY_AI_UNBUILT.indexOf(role) >= 0) {
        (out[role] = out[role] || []).push(id);
      }
    }
    return out;
  },

  // AND THE OTHER KIND OF UNBUILT, which `unbuiltBrains` cannot see.
  //
  // A machine can have a brain that exists and still carry a promise that
  // nothing reads. `ambush: true` on the LURK, `callsForHelp` on the
  // GALVANIC, `chainsToAllies` on the BLOOM, `detonatesOnContact` on the
  // CINDER — every one of them is a sentence about how that machine fights,
  // written in the roster, and no line of code has ever named any of them.
  //
  // Counted here for the same reason `Spine.unreadFlags` counts its
  // twenty-five: a promise nobody can see the size of is a promise that grows.
  // `sources` is the game's own text, handed in by the caller so this file
  // does no I/O — the same shape `GadgetRun.unreadRankFields` uses.
  //
  // The FIELDS list is written out rather than derived, because "which of a
  // machine's fields is a behaviour and which is a stat" is a judgement, and
  // deriving it would quietly drop the next one somebody adds.
  BEHAVIOUR_FIELDS: ['ambush', 'callsForHelp', 'chainsToAllies',
    'detonatesOnContact', 'telegraphSeconds', 'marksTarget', 'breaksTerrain',
    'amphibious', 'formation', 'neverWith', 'heatResist', 'immobile',
    'children', 'mount', 'packSize'],

  unbuiltBehaviours(sources) {
    if (!sources) return [];
    const out = [];
    for (const id of this.list()) {
      const b = ENEMY_BUILDS[id];
      for (const f of this.BEHAVIOUR_FIELDS) {
        if (b[f] === undefined) continue;
        const re = new RegExp('\\.' + f + '\\b|[\'"]' + f + '[\'"]');
        if (!re.test(sources)) out.push(id + ': ' + f);
      }
    }
    return out;
  },
};

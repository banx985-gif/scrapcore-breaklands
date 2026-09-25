// SCRAPCORE: BREAKLANDS — Part data (Milestone 12: COMPLETE 24-part library)
// Data-driven component format (plan §77). All 24 gameplay parts now exist.
// Balance lives HERE as data, not in code.
//
// Stat modifier keys read by Machine.recalcStats (only while ONLINE):
//   speedAdd        additive movement speed (+0.12 = +12%)
//   dashPowerMul    dash impulse multiplier
//   dashCdMul       dash cooldown multiplier
//   recoilMul       recoil/knockback taken multiplier (lower = resist)
//   magnetRangeMul / magnetPullMul / ripSpeedMul   Magnet upgrades
//   spreadMul       weapon spread multiplier (lower = tighter)
//   heatCapBonus    raises max Heat
// Behaviour flags: pellets, pierce, homing, flame, beam, chain, mine,
//   shieldValue, repairRate, childSockets, powerBonus, coolingBonus.

const PARTS = {
  // ======================= WEAPONS — 10 (plan §33) =======================
  machineGun: {
    id: 'machineGun', name: 'MACHINE GUN', category: 'weapon',
    loadCost: 2,
    powerCost: 2, damage: 6, fireRate: 9,
    projSpeed: 1600, projRadius: 9, projLife: 1.1, spread: 0.045,
    heatPerShot: 1.6, recoil: 30, splash: 0,
    color: '#22d9ff', hp: 45, connectorHp: 30, bodyRadius: 34, barrel: 44,
  },

  scattergun: {
    id: 'scattergun', name: 'SCATTERGUN', category: 'weapon',
    loadCost: 3,
    powerCost: 3, damage: 5, pellets: 6, fireRate: 1.5,
    projSpeed: 1250, projRadius: 8, projLife: 0.42, spread: 0.21,
    heatPerShot: 7, recoil: 300, splash: 0,
    color: '#ff3fa4', hp: 50, connectorHp: 32, bodyRadius: 36, barrel: 40,
  },

  cannon: {
    id: 'cannon', name: 'CANNON', category: 'weapon',
    loadCost: 4,
    powerCost: 4, damage: 34, fireRate: 1.1,
    projSpeed: 1000, projRadius: 20, projLife: 1.6, spread: 0.01,
    heatPerShot: 14, recoil: 620, splash: 140, splashDamage: 14,
    color: '#ff7a1a', hp: 65, connectorHp: 40, bodyRadius: 42, barrel: 58,
  },

  railgun: {
    id: 'railgun', name: 'RAILGUN', category: 'weapon',
    loadCost: 5,
    powerCost: 5, damage: 55, fireRate: 0.55,
    projSpeed: 2600, projRadius: 12, projLife: 0.9, spread: 0.002,
    heatPerShot: 22, recoil: 950, splash: 0, pierce: 4,
    color: '#9b5cff', hp: 60, connectorHp: 40, bodyRadius: 40, barrel: 78,
  },

  rocketPod: {
    id: 'rocketPod', name: 'ROCKET POD', category: 'weapon',
    loadCost: 4,
    powerCost: 4, damage: 20, fireRate: 1.4,
    projSpeed: 620, projRadius: 13, projLife: 2.6, spread: 0.35,
    heatPerShot: 9, recoil: 120, splash: 150, splashDamage: 12,
    homing: 2.8,               // turn rate (rad/s) toward nearest target
    color: '#ffd23f', hp: 55, connectorHp: 36, bodyRadius: 40, barrel: 30,
  },

  flamethrower: {
    id: 'flamethrower', name: 'FLAMETHROWER', category: 'weapon',
    loadCost: 3,
    powerCost: 3, damage: 3.2, fireRate: 16,
    projSpeed: 780, projRadius: 14, projLife: 0.52, spread: 0.26,
    heatPerShot: 1.6,          // ~26 heat/sec sustained — VERY hot (plan §33)
    recoil: 15, splash: 0, flame: true,
    color: '#ff7a1a', hp: 55, connectorHp: 34, bodyRadius: 36, barrel: 42,
  },

  beamLaser: {
    id: 'beamLaser', name: 'BEAM LASER', category: 'weapon',
    loadCost: 3,
    powerCost: 4, beam: true, dps: 30, range: 1100,
    heatPerSecond: 9, recoil: 0,
    color: '#ff3b3b', hp: 50, connectorHp: 34, bodyRadius: 36, barrel: 46,
  },

  arcGun: {
    id: 'arcGun', name: 'ARC GUN', category: 'weapon',
    loadCost: 3,
    powerCost: 3, damage: 12, fireRate: 3.2,
    projSpeed: 1500, projRadius: 10, projLife: 0.8, spread: 0.03,
    heatPerShot: 3.2, recoil: 40, splash: 0,
    chain: 2, chainRange: 400, chainFrac: 0.6,   // jumps to 2 nearby enemies
    color: '#22d9ff', hp: 48, connectorHp: 32, bodyRadius: 36, barrel: 40,
  },

  saw: {
    id: 'saw', name: 'SAW', category: 'weapon',
    loadCost: 3,
    powerCost: 2, dps: 60, bladeRadius: 58, reach: 46,
    heatPerSecond: 4, recoil: 0,
    color: '#a8e832', hp: 55, connectorHp: 34, bodyRadius: 36,
  },

  mineLayer: {
    id: 'mineLayer', name: 'MINE LAYER', category: 'weapon',
    loadCost: 3,
    powerCost: 3, fireRate: 0.9, mine: true,
    mineDamage: 26, mineSplash: 210,
    heatPerShot: 4, recoil: 0, damage: 0,
    color: '#ffd23f', hp: 55, connectorHp: 34, bodyRadius: 38,
  },

  // =============== THE M14 EIGHT — Master §21, locked rows ===============
  // Weapons 11-18. Colours follow WEAPON_COLOUR.md: what is ABOUT TO HAPPEN
  // to you, not which gun fired — bullets azure, shells orange, contact
  // yellow/steel, placed lime, shock magenta.

  burstRifle: {
    id: 'burstRifle', name: 'BURST RIFLE', category: 'weapon',
    loadCost: 2,
    // 10 dmg x 3-round burst x 2.2 bursts/s. fireRate is BURSTS per second;
    // the burst mechanic in machine.js spaces the three rounds.
    powerCost: 3, damage: 10, fireRate: 2.2,
    burst: 3, burstGap: 0.055,
    projSpeed: 1750, projRadius: 8, projLife: 1.0, spread: 0.02,
    heatPerShot: 2.2,          // per ROUND (Master: 2.2/round)
    recoil: 60, splash: 0,
    color: '#22d9ff', hp: 50, connectorHp: 34, bodyRadius: 34, barrel: 46,
  },

  flakCannon: {
    id: 'flakCannon', name: 'FLAK CANNON', category: 'weapon',
    loadCost: 3,
    // The SHELL does no direct damage: it detonates near a machine (or at end
    // of flight) into 8 fragments of 8. "Effective radius 150" is the burst.
    powerCost: 3, damage: 0, fireRate: 0.9,
    projSpeed: 900, projRadius: 14, projLife: 1.1, spread: 0.03,
    flak: true, fragments: 8, fragDamage: 8, proxRadius: 150,
    heatPerShot: 12, recoil: 420, splash: 0,
    color: '#ff7a1a', hp: 60, connectorHp: 38, bodyRadius: 38, barrel: 52,
  },

  mortar: {
    id: 'mortar', name: 'MORTAR', category: 'weapon',
    loadCost: 4,
    // Targeted arc: the shell flies OVER everything and lands where the
    // machine is aiming, capped at arcRange. 40 direct + 18 splash over 190.
    powerCost: 4, damage: 40, fireRate: 0.7,
    arc: true, arcRange: 900, arcTime: 1.0,   // arcRange/arcTime are (tune)
    projSpeed: 900, projRadius: 16, projLife: 3.0, spread: 0.02,
    heatPerShot: 16, recoil: 520, splash: 190, splashDamage: 18,
    color: '#ff7a1a', hp: 60, connectorHp: 38, bodyRadius: 38, barrel: 56,
  },

  harpoon: {
    id: 'harpoon', name: 'HARPOON', category: 'weapon',
    loadCost: 2,
    // 14 dmg x 1.0/s; a landed hit TETHERS for 1.8s — enemies and loose
    // parts get hauled toward the machine that fired it.
    powerCost: 2, damage: 14, fireRate: 1.0,
    projSpeed: 1200, projRadius: 10, projLife: 1.2, spread: 0.008,
    tether: 1.8, tetherPull: 900,             // pull accel (tune)
    heatPerShot: 5, recoil: 180, splash: 0,
    color: '#ffd23f', hp: 55, connectorHp: 36, bodyRadius: 36, barrel: 50,
  },

  shockwaveCannon: {
    id: 'shockwaveCannon', name: 'SHOCKWAVE CANNON', category: 'weapon',
    loadCost: 4,
    // No projectile at all: a 360-degree wave from the machine, range 360,
    // 24 dmg, HIGH knockback. Fired on the trigger like any gun.
    powerCost: 4, damage: 24, fireRate: 0.75,
    wave: true, waveRange: 360, waveKnock: 1400,
    heatPerShot: 15, recoil: 0, splash: 0,
    color: '#ff3fa4', hp: 70, connectorHp: 42, bodyRadius: 42, barrel: 56,
  },

  drill: {
    id: 'drill', name: 'DRILL', category: 'weapon',
    loadCost: 4,
    // Melee like the Saw, but a spike, not a disc: 70 DPS at reach 55,
    // biting CONNECTORS half again harder — the joint-cracker.
    powerCost: 3, dps: 70, bladeRadius: 40, reach: 55,
    connMul: 1.5,
    heatPerSecond: 5, recoil: 0,
    color: '#ffd23f', hp: 70, connectorHp: 42, bodyRadius: 42, barrel: 55,
  },

  discLauncher: {
    id: 'discLauncher', name: 'DISC LAUNCHER', category: 'weapon',
    loadCost: 2,
    // 18 dmg x 1.8/s; the disc RICOCHETS off walls and obstacles twice.
    powerCost: 3, damage: 18, fireRate: 1.8,
    projSpeed: 1300, projRadius: 11, projLife: 2.2, spread: 0.015,
    ricochet: 2,
    heatPerShot: 5, recoil: 140, splash: 0,
    color: '#a8e832', hp: 50, connectorHp: 34, bodyRadius: 34, barrel: 46,
  },

  plasmaRepeater: {
    id: 'plasmaRepeater', name: 'PLASMA REPEATER', category: 'weapon',
    loadCost: 3,
    powerCost: 4, damage: 9, fireRate: 8,
    projSpeed: 1450, projRadius: 10, projLife: 1.0, spread: 0.04,
    heatPerShot: 2.2, recoil: 45, splash: 45, splashDamage: 4,
    color: '#22d9ff', hp: 55, connectorHp: 36, bodyRadius: 36, barrel: 52,
  },

  // ======================= DEFENCE — 4 (plan §34) ========================
  armourPlate: {
    id: 'armourPlate', name: 'ARMOUR PLATE', category: 'defence',
    loadCost: 3,
    powerCost: 0, hp: 110, connectorHp: 48, bodyRadius: 46,
    color: '#8fa3c8',
    // Aaron's model is authored ALREADY broadside (29 Aug fix: with the old
    // +90 it stood out of the socket like a gun barrel — seen in play).
    artAngle: 0,
  },

  heavyArmour: {
    id: 'heavyArmour', name: 'HEAVY ARMOUR', category: 'defence',
    loadCost: 6,
    powerCost: 0, hp: 200, connectorHp: 60, bodyRadius: 56,
    speedAdd: -0.06,           // slight speed penalty (plan §34)
    color: '#5f708f',
    // Same 29 Aug fix as the Armour Plate: the model is authored broadside.
    artAngle: 0,
  },

  directionalShield: {
    id: 'directionalShield', name: 'DIRECTIONAL SHIELD', category: 'defence',
    loadCost: 3,
    powerCost: 3, hp: 45, connectorHp: 34, bodyRadius: 32,
    shieldValue: 65, shieldRegen: 22, shieldRegenDelay: 2.2,
    shieldArcHalf: 0.62,       // half-width of the protected arc (radians)
    color: '#22d9ff',
  },

  repairArm: {
    id: 'repairArm', name: 'REPAIR ARM', category: 'defence',
    loadCost: 3,
    powerCost: 4, hp: 45, connectorHp: 32, bodyRadius: 34,
    repairRate: 6,             // hp/sec to the most damaged component
    coreRepairRate: 1.2,       // hp/sec to the Core when all parts healthy
    idleDelay: 3,              // seconds without damage before repairing
    color: '#a8e832',
  },

  // Master Defence table. A plate that fires back at the moment it is hit:
  // one charged absorb every 5s, so it rewards taking the hit on the right
  // side rather than being flat extra HP.
  reactiveArmour: {
    id: 'reactiveArmour', name: 'REACTIVE ARMOUR', category: 'defence',
    loadCost: 4,
    powerCost: 1, hp: 130, connectorHp: 50, bodyRadius: 50,
    reactiveCd: 5, reactiveReduce: 0.55,
    color: '#ff7a1a',
    artAngle: Math.PI / 2,     // broadside, like the other plates
  },

  reflectorPlate: {
    id: 'reflectorPlate', name: 'REFLECTOR PLATE', category: 'defence',
    loadCost: 3,
    powerCost: 2, hp: 90, connectorHp: 44, bodyRadius: 44,
    // Front impacts only, non-explosive shots only. The reflected shot
    // changes sides — it becomes YOUR bullet, at 60% of its damage.
    reflectChance: 0.30, reflectDamage: 0.60, reflectCd: 0.18,
    color: '#9b5cff',
    artAngle: Math.PI / 2,
  },

  pointDefence: {
    id: 'pointDefence', name: 'POINT DEFENCE', category: 'defence',
    loadCost: 2,
    powerCost: 2, hp: 45, connectorHp: 32, bodyRadius: 32,
    pdRange: 320, pdRate: 4, pdHeat: 0.8,
    color: '#ffd23f',
  },

  barrierProjector: {
    id: 'barrierProjector', name: 'BARRIER PROJECTOR', category: 'defence',
    loadCost: 4,
    powerCost: 4, hp: 55, connectorHp: 36, bodyRadius: 36,
    // The Directional Shield's whole-circle cousin: no arc to aim, but it
    // costs 4 Power and there is only one pool for every direction.
    barrierValue: 100, barrierRegen: 16, barrierRegenDelay: 3.0,
    color: '#22d9ff',
  },

  // =================== POWER / COOLING — 8 (plan §35) ====================
  smallReactor: {
    id: 'smallReactor', name: 'SMALL REACTOR', category: 'power',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 2,
    powerCost: 0, powerBonus: 4,
    hp: 35, connectorHp: 30, bodyRadius: 34,
    explodeRadius: 150, explodeDamage: 14,
    color: '#ffd23f',
  },

  bigReactor: {
    id: 'bigReactor', name: 'BIG REACTOR', category: 'power',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 5,
    powerCost: 0, powerBonus: 8,   // Master Parts table: Big +8
    hp: 70, connectorHp: 42, bodyRadius: 44,
    explodeRadius: 210, explodeDamage: 22,
    speedAdd: -0.05,           // slight speed penalty (plan §35)
    color: '#ff7a1a',
  },

  radiator: {
    id: 'radiator', name: 'RADIATOR', category: 'power',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 2,
    powerCost: 1, coolingBonus: 5,
    hp: 50, connectorHp: 34, bodyRadius: 36,
    color: '#22d9ff',
  },

  heatSink: {
    id: 'heatSink', name: 'HEAT SINK', category: 'power',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 3,
    powerCost: 0, heatCapBonus: 30,    // max Heat 100 -> 130 (plan §35)
    hp: 60, connectorHp: 36, bodyRadius: 38,
    color: '#ff7a1a',
  },

  capacitor: {
    id: 'capacitor', name: 'CAPACITOR', category: 'power',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 1,
    powerCost: 0, powerBonus: 3,
    // The cheap Power that punishes a hot build: every overheat drops it
    // off the grid for 4 seconds, taking 3 Power with it.
    offlineOnOverheat: 4,
    hp: 30, connectorHp: 28, bodyRadius: 28,
    color: '#ffd23f',
  },

  overcharger: {
    id: 'overcharger', name: 'OVERCHARGER', category: 'power',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 2,
    powerCost: 2,
    weaponRateMul: 1.12, weaponDamageMul: 1.05, weaponHeatMul: 1.18,
    hp: 40, connectorHp: 30, bodyRadius: 30,
    color: '#ff3fa4',
  },

  coolantPump: {
    id: 'coolantPump', name: 'COOLANT PUMP', category: 'power',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 2,
    powerCost: 2, coolingBonus: 4, weaponHeatMul: 0.94,
    hp: 45, connectorHp: 32, bodyRadius: 32,
    color: '#22d9ff',
  },

  emergencyVent: {
    id: 'emergencyVent', name: 'EMERGENCY VENT', category: 'power',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 2,
    powerCost: 1, coolingBonus: 1,
    // Does nothing at all until you overheat, then dumps 30 Heat at once.
    ventHeat: 30, ventCd: 12,
    hp: 45, connectorHp: 32, bodyRadius: 32,
    color: '#8fa3c8',
  },

  // ======================= UTILITY — 6 (plan §36) ========================
  targetingModule: {
    id: 'targetingModule', name: 'TARGETING MODULE', category: 'utility',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 1,
    powerCost: 2, spreadMul: 0.45,     // much tighter weapon spread
    hp: 40, connectorHp: 30, bodyRadius: 30,
    color: '#ff3fa4',
  },

  magnetAmplifier: {
    id: 'magnetAmplifier', name: 'MAGNET AMPLIFIER', category: 'utility',
    loadCost: 2,
    powerCost: 2,
    magnetRangeMul: 1.35, magnetPullMul: 1.45, ripSpeedMul: 1.5,
    hp: 40, connectorHp: 30, bodyRadius: 30,
    color: '#9b5cff',
  },

  gyroStabiliser: {
    id: 'gyroStabiliser', name: 'GYRO STABILISER', category: 'utility',
    loadCost: 2,
    // Two DIFFERENT numbers on purpose: recoilMul is the shove your own guns
    // give you, knockbackMul is everything the world does to you. Heavy
    // Treads flatten both; the Gyro is better at the first than the second.
    powerCost: 1, recoilMul: 0.55, knockbackMul: 0.80,
    hp: 50, connectorHp: 34, bodyRadius: 34,
    color: '#8fa3c8',
  },

  salvageCompressor: {
    id: 'salvageCompressor', name: 'SALVAGE COMPRESSOR', category: 'utility',
    loadCost: 2,
    powerCost: 2, magnetPullMul: 1.20,
    // Field salvage bolts on 10 percentage points healthier than it landed.
    salvageConditionAdd: 0.10,
    hp: 45, connectorHp: 32, bodyRadius: 32,
    color: '#a8e832',
  },

  droneBay: {
    id: 'droneBay', name: 'DRONE BAY', category: 'utility',
    loadCost: 3,
    powerCost: 3,
    drones: 2, droneDamage: 5, droneRate: 3, droneRange: 650,
    droneHp: 20, droneRespawn: 8,
    hp: 50, connectorHp: 34, bodyRadius: 34,
    color: '#9b5cff',
  },

  autoTurretController: {
    id: 'autoTurretController', name: 'AUTO-TURRET CONTROLLER', category: 'utility',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 2,
    // Claims ONE ranged weapon and runs it itself — that weapon stops
    // answering your trigger, which is the trade.
    powerCost: 2, autoTurret: true, turretRate: 0.90,
    hp: 40, connectorHp: 30, bodyRadius: 30,
    color: '#ff3fa4',
  },

  // ====================== STRUCTURE — 6 (Master §Structure) ==============
  // The parts that turn one mount into several. Child socket counts and
  // angles are the LOCKED table — the game attaches a cannon to child 2
  // whether the model drew a socket there or not, so these numbers are
  // gameplay, not art.
  splitter: {
    id: 'splitter', name: 'SPLITTER', category: 'structure',
    loadCost: 1,
    powerCost: 1, childSockets: 2, childAngles: [-35, 35],
    hp: 45, connectorHp: 36, bodyRadius: 30,
    color: '#ffd23f',
  },

  straightBeam: {
    id: 'straightBeam', name: 'STRAIGHT BEAM', category: 'structure',
    loadCost: 1,
    powerCost: 0, childSockets: 1, childAngles: [0],
    // §Structure: "extends mount 100 units" — the whole point of the part is
    // REACH, not positions. The toughest of the family.
    mountExtend: 100,
    hp: 70, connectorHp: 45, bodyRadius: 40,
    color: '#8fa3c8',
  },

  forkBeam: {
    id: 'forkBeam', name: 'FORK BEAM', category: 'structure',
    loadCost: 2,
    powerCost: 0, childSockets: 2, childAngles: [-30, 30],
    hp: 65, connectorHp: 42, bodyRadius: 36,
    color: '#ffd23f',
  },

  crossHub: {
    id: 'crossHub', name: 'CROSS HUB', category: 'structure',
    loadCost: 3,
    powerCost: 0, childSockets: 3, childAngles: [-45, 0, 45],
    hp: 80, connectorHp: 48, bodyRadius: 44,
    color: '#8fa3c8',
  },

  rotaryJoint: {
    id: 'rotaryJoint', name: 'ROTARY JOINT', category: 'structure',
    loadCost: 2,
    powerCost: 1, childSockets: 1, childAngles: [0],
    // §Structure: the child subassembly may rotate ±90° toward aim at 180°/s.
    // Degrees here, converted where used — the table is written in degrees
    // and a table that needs a calculator to compare drifts.
    rotarySwing: 90, rotaryRate: 180,
    hp: 55, connectorHp: 38, bodyRadius: 32,
    color: '#22d9ff',
  },

  sacrificialCoupler: {
    id: 'sacrificialCoupler', name: 'SACRIFICIAL COUPLER', category: 'structure',
    loadCost: 1,
    powerCost: 0, childSockets: 1, childAngles: [0],
    // §Structure: when the connector breaks, the child ejects INTACT and its
    // body HP is clamped to at least 25% max. The weakest joint on the
    // machine, on purpose — the deliberate weak link.
    ejectChildIntact: 0.25,
    hp: 35, connectorHp: 20, bodyRadius: 26,
    color: '#ff3b3b',
  },

  // ====================== MOVEMENT — 3 (plan §37) ========================
  thruster: {
    id: 'thruster', name: 'THRUSTER', category: 'movement',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 2,
    powerCost: 2, speedAdd: 0.12,
    hp: 40, connectorHp: 30, bodyRadius: 32,
    color: '#22d9ff',
  },

  dashBooster: {
    id: 'dashBooster', name: 'DASH BOOSTER', category: 'movement',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 2,
    powerCost: 2, dashPowerMul: 1.28, dashCdMul: 0.82,
    hp: 40, connectorHp: 30, bodyRadius: 32,
    color: '#a8e832',
  },

  heavyTreads: {
    id: 'heavyTreads', name: 'HEAVY TREADS', category: 'movement',
    loadCost: 4,
    powerCost: 1, recoilMul: 0.35, knockbackMul: 0.35, speedAdd: -0.05,
    loadCapAdd: 8,     // v3.2: effective Load cap +8 — the mule part
    hp: 60, connectorHp: 40, bodyRadius: 38,
    color: '#8fa3c8',
  },

  // ---- THE OPEN WORLD'S OWN MODULES (Block 15, CONTENT_MODULES Part 3) ----
  //
  // Six parts that only make sense because the world got big. The content
  // library named exactly these as "the open world's actual gaps"; the five
  // districts have been promising four of them in their `finds` manifests
  // since Phase C, and every one of those promises pointed at a part that did
  // not exist. Found by placing the finds and asking whether the crate could
  // deliver what it advertised.
  //
  // Numbers are CONTENT_MODULES' own, unchanged. Behaviour beyond the stat
  // lines is flagged per part: a module whose effect nothing reads yet is
  // marked so, rather than shipping quietly as a dead pickup.
  longRangeTank: {
    id: 'longRangeTank', name: 'FUEL CELL', category: 'move',
    loadCost: 2, powerCost: 0,
    // +25% out of combat only. Nothing reads `outOfCombatSpeed` yet — Block 10
    // owns the combat-state flag — so this is a stat line waiting for a reader.
    outOfCombatSpeed: 0.25,
    hp: 70, connectorHp: 30, bodyRadius: 32,
    color: '#22d9ff',
  },

  ruggedTreads: {
    id: 'ruggedTreads', name: 'RUGGED TREADS', category: 'move',
    loadCost: 4, powerCost: 1,
    speedMul: 0.85,                 // -15% top speed, everywhere
    ignoresRough: true,             // and nothing slows it on bad ground
    hp: 120, connectorHp: 44, bodyRadius: 40,
    color: '#8fa3c8',
  },

  tolerantMounts: {
    id: 'tolerantMounts', name: 'TOLERANT MOUNTS', category: 'move',
    loadCost: 2, powerCost: 1,
    towPenaltyMul: 0.5,             // halves the handling penalty from towing
    hp: 60, connectorHp: 40, bodyRadius: 30,
    color: '#ffd23f',
  },

  cargoRack: {
    id: 'cargoRack', name: 'CARGO RACK', category: 'utility',
    loadCost: 3, powerCost: 0,
    // THE GREED PART. It directly increases what you lose when you die, which
    // is the banking loop working rather than a downside.
    carryBonus: 4,
    hp: 90, connectorHp: 40, bodyRadius: 36,
    color: '#a8e832',
  },

  assayModule: {
    id: 'assayModule', name: 'ASSAY MODULE', category: 'utility',
    emissive: true,   // AARON, 7 Sep: it glows, so it is never painted
    loadCost: 1, powerCost: 2,
    showsWreckValue: true,          // turns towing from a guess into a decision
    hp: 45, connectorHp: 30, bodyRadius: 28,
    color: '#22d9ff',
  },

  signalMask: {
    id: 'signalMask', name: 'SIGNAL MASK', category: 'utility',
    loadCost: 1, powerCost: 2,
    // Deliberately overlaps the JAMMER gadget's rank 1: alert pressure can be
    // bought off with a socket instead of a gadget slot.
    alertRateMul: 0.6,
    hp: 45, connectorHp: 28, bodyRadius: 28,
    color: '#ff3fa4',
  },

  // Built into every Core (plan §16): weak, cannot be destroyed, guarantees
  // the player can always fight. NOT one of the 24 salvage parts.
  //
  // AND THE PICKER'S FRONT GUN. The roster socketed it on the 2:00 machine --
  // the connector lesson, "dies in three seconds, drops nothing" -- and as a
  // socketed part it had no hp, no connectorHp and no barrel: its joint
  // took NaN damage and could never break (the one joint in front of the
  // player on the one machine placed to teach SHOOT THE JOINT), the magnet
  // could rip it at any time (NaN is not above the threshold), its shots
  // left a muzzle at NaN and hit nothing, and when the machine died the
  // part dropped as salvage at NaN health. Found by tests/test_reach.js,
  // standing a PICKER in front of the magnet (D332). It has a body now, the
  // weakest joint in the game, and `noSalvage`: what comes off it is gone.
  emergencyBlaster: {
    id: 'emergencyBlaster', name: 'EMERGENCY BLASTER', category: 'weapon',
    damage: 3, fireRate: 5,
    projSpeed: 1400, projRadius: 7, projLife: 0.9, spread: 0.03,
    heatPerShot: 0.5, recoil: 0, splash: 0,
    hp: 20, connectorHp: 14, bodyRadius: 22, barrel: 30,
    noSalvage: true,
    color: '#ffd23f',
  },
};

// Ordered list of the real gameplay parts (catalogue order, plan §32–37).
// 41 of the Master's 52. Nothing may hard-code the count: tests derive it
// from PART_LIST.length.
const PART_LIST = [
  'machineGun', 'scattergun', 'cannon', 'railgun', 'rocketPod',
  'flamethrower', 'beamLaser', 'arcGun', 'saw', 'mineLayer',
  'burstRifle', 'flakCannon', 'mortar', 'harpoon',
  'shockwaveCannon', 'drill', 'discLauncher', 'plasmaRepeater',
  'armourPlate', 'heavyArmour', 'directionalShield', 'repairArm',
  'reactiveArmour', 'reflectorPlate', 'pointDefence', 'barrierProjector',
  'smallReactor', 'bigReactor', 'radiator', 'heatSink',
  'capacitor', 'overcharger', 'coolantPump', 'emergencyVent',
  'targetingModule', 'magnetAmplifier',
  'gyroStabiliser', 'salvageCompressor', 'droneBay', 'autoTurretController',
  'splitter',
  'straightBeam', 'forkBeam', 'crossHub', 'rotaryJoint', 'sacrificialCoupler',
  'thruster', 'dashBooster', 'heavyTreads',
  // Block 15: the open world's own six (CONTENT_MODULES Part 3).
  'longRangeTank', 'ruggedTreads', 'tolerantMounts',
  'cargoRack', 'assayModule', 'signalMask',
];

// ---------------------------------------------------------------------------
// WHAT IS ACTUALLY BOLTED ON
//
// Six of the open world's modules shipped as stat lines with no reader —
// `carryBonus`, `towPenaltyMul`, `showsWreckValue`, `alertRateMul`,
// `outOfCombatSpeed`, `ignoresRough` — and each one of those is a pickup that
// does nothing. Wiring them one at a time means six copies of the same socket
// walk, which is how a codebase ends up with two systems that disagree about
// whether a part is fitted.
//
// So: ONE reader, and every module effect in the game is a field name handed
// to it. Standing rule 6 — a new module is a data entry, and its reader is a
// line at the system that cares.
//
// It asks the SOCKETS, never a cached total, for the same reason every
// completion check in this project asks the record that owns the fact: a part
// can be shot off mid-fight, and a cached bonus survives the part that earned
// it.
const Modules = {
  // The machine to read. Callers pass one; the ones that cannot (a HUD deep
  // in a draw call) get the player, so nobody threads an entity through four
  // layers to ask a question about the player's own machine.
  _of(ent) {
    if (ent) return ent;
    if (typeof Game !== 'undefined' && Game.states && Game.states.GAME) {
      return Game.states.GAME.player || null;
    }
    return null;
  },

  each(ent, fn) {
    const m = this._of(ent);
    if (!m || !m.sockets) return;
    for (const s of m.sockets) {
      if (s.comp && s.comp.part) fn(s.comp.part);
    }
  },

  // ADDITIVE: carry slots, and anything else where two of a part is twice.
  sum(ent, field) {
    let n = 0;
    this.each(ent, p => { if (p[field]) n += p[field]; });
    return n;
  },

  // MULTIPLICATIVE: penalties and rates. Two mounts at ×0.5 make ×0.25, which
  // is the right answer — you spent two sockets on it.
  mul(ent, field) {
    let n = 1;
    this.each(ent, p => { if (p[field] !== undefined) n *= p[field]; });
    return n;
  },

  // A CAPABILITY: fitted at all, or not. Never counted — a second assay
  // module does not show you the value twice.
  has(ent, field) {
    let yes = false;
    this.each(ent, p => { if (p[field]) yes = true; });
    return yes;
  },

  // The honest report, same shape as BossPhases.unwired(): every behaviour
  // field the part library declares that nothing in the codebase reads. A
  // module whose effect has no reader is a pickup that lies.
  FIELDS: ['carryBonus', 'towPenaltyMul', 'showsWreckValue', 'alertRateMul',
           'outOfCombatSpeed', 'ignoresRough', 'speedMul'],
};

// SCRAPCORE: BREAKLANDS — THE SKILL TREE (content/draft_skills.js, absorbed)
//
// 40 levels, 1 point/level + 1 bonus every 5th = 48 points. Four branches,
// three tiers and one deep pick each. Tier gates are POINTS SPENT IN THAT
// BRANCH. Skills apply across every vehicle. No respec.
//
// DATA ONLY, on purpose: spending a point, gating a tier and applying an
// `effect` key to a machine is BLOCK 9, which has not been built.
// content/README.md's rule holds — nothing here is a system. The effect keys
// are the contract Block 9 wires against; tests/test_contentdata.js holds
// the arithmetic this file states about itself.
//
// THE ARITHMETIC CORRECTION (found by validating the draft, 1 Sep): the
// content doc claimed 18 points per branch and 72 for the tree. With
// multi-rank nodes the real cost is ~40 per branch, ~159 for everything.
// The design intent holds without changing a number:
//   * a branch's deep pick costs 16 spent + 6 = 22 points minimum
//   * 48 earned points = deep picks in TWO branches (44) with 4 spare
//   * buying the whole tree is impossible, which is what makes a build a build
// "Finish about two branches" reads as "bottom out two deep picks".

// THE CAP IS 25 IN THE GAME THAT SHIPS, AND 40 IN THE ONE THAT DOESN'T YET.
//
// Every one-off award in the shippable six adds up to 91,520 XP, which is
// LEVEL 25. That was reported last run as a shortfall and it is not one:
// Aaron's call is that the last fifteen levels belong to the expansion
// districts, and a ladder whose top is unreachable is a ladder that reads as
// broken every time a player looks at it.
//
// `shipCap` is what `Levels.max()` returns while the world holds only the
// shipping districts. It LIFTS ITSELF: the day a seventh district is added to
// DISTRICT_LIST the ceiling becomes `maxLevel` with no flag to remember and no
// second place to change. A cap somebody has to switch on is a cap that ships
// switched off.
//
// THE XP CURVE IS UNTOUCHED, deliberately. Levels 26-40 cost exactly what they
// always cost; they are simply not yet earnable. Compressing the curve to fit
// six districts would have to be un-compressed later, and every number derived
// from it — every one-off award, every kill payout — would move twice.
const SKILL_CURVE = { maxLevel: 40, shipCap: 25, shipDistricts: 6,
                      xpBase: 100, xpPower: 1.35, bonusEvery: 5 };
const SKILL_TIERS = { t1: { cost: 1, need: 0 }, t2: { cost: 2, need: 4 },
                      t3: { cost: 3, need: 10 }, deep: { cost: 6, need: 16 } };
const SKILL_BRANCHES = ['salvage', 'combat', 'survival', 'machines'];

const SKILLS = {
  // ======================= SALVAGE =======================================
  magnet_reach:   { branch: 'salvage', tier: 't1', name: 'MAGNET REACH',
    desc: 'Magnet grab range', ranks: [{ magnetRangeMul: 1.15 }, { magnetRangeMul: 1.30 }, { magnetRangeMul: 1.45 }] },
  quick_hands:    { branch: 'salvage', tier: 't1', name: 'QUICK HANDS',
    desc: 'Rip speed — less time exposed with a part half-torn',
    ranks: [{ ripSpeedMul: 1.20 }, { ripSpeedMul: 1.40 }, { ripSpeedMul: 1.60 }] },
  scrap_eye:      { branch: 'salvage', tier: 't1', name: 'SCRAP EYE',
    desc: 'Loose parts and scrap glint through props',
    // EVERY RANK RESTATES WHAT THE RANK BELOW IT GAVE. `ranks` is the value
    // AT that rank, not an increment (see Skills.effect), so a flag a later
    // rank forgets to repeat is a flag the player LOSES by buying an upgrade.
    // Four nodes had that shape and nobody had noticed, because nothing had
    // ever taken a second rank and then asked what it could still do.
    ranks: [{ lootGlintRange: 15, throughLowCover: true },
            { lootGlintRange: 30, throughLowCover: true,
              throughAnything: true, rareGlint: true }] },
  heavy_lift:     { branch: 'salvage', tier: 't2', name: 'HEAVY LIFT',
    desc: 'Tow handling penalty reduced',
    ranks: [{ towPenaltyMul: 0.85 }, { towPenaltyMul: 0.70 }, { towPenaltyMul: 0.55 }] },
  stripper:       { branch: 'salvage', tier: 't2', name: 'STRIPPER',
    desc: 'Stripping a towed wreck yields more',
    ranks: [{ stripYieldMul: 1.25 }, { stripYieldMul: 1.50 }] },
  market_sense:   { branch: 'salvage', tier: 't2', name: 'MARKET SENSE',
    desc: 'Scrap from every source',
    ranks: [{ scrapMul: 1.15 }, { scrapMul: 1.30 }] },
  connector_read: { branch: 'salvage', tier: 't3', name: 'CONNECTOR READ',
    desc: 'Connector health shows as a readout',
    ranks: [{ connReadout: 'locked' }, { connReadout: 'all' }] },
  salvage_right:  { branch: 'salvage', tier: 't3', name: 'SALVAGE RIGHT',
    desc: 'Destroyed modules still drop scrap',
    ranks: [{ destroyScrapFrac: 0.30 }, { destroyScrapFrac: 0.60, intactChance: 0.10 }] },
  clean_pull:     { branch: 'salvage', tier: 'deep', name: 'CLEAN PULL',
    desc: 'Rip a part without breaking the connector first. Walk up to anything and take it.',
    ranks: [{ ripUndamaged: true }] },
  // NOTE: the most powerful pick in the tree. Watch it in Block 18 — if it
  // trivialises the back half, gate it behind a boss instead of points.

  // ======================= COMBAT ========================================
  cool_head:      { branch: 'combat', tier: 't1', name: 'COOL HEAD',
    desc: 'Permanent weapons take longer to overheat',
    ranks: [{ permHeatCapMul: 1.15 }, { permHeatCapMul: 1.30 }, { permHeatCapMul: 1.45 }] },
  reload_drill:   { branch: 'combat', tier: 't1', name: 'RELOAD DRILL',
    desc: 'Reload speed on all weapons',
    ranks: [{ reloadMul: 1.12 }, { reloadMul: 1.24 }, { reloadMul: 1.36 }] },
  joint_shot:     { branch: 'combat', tier: 't1', name: 'JOINT SHOT',
    desc: 'Damage to connectors (STOLEN weapons only — permanents are capped by rule 2)',
    ranks: [{ connDamageMul: 1.20 }, { connDamageMul: 1.40 }] },
  fast_swap:      { branch: 'combat', tier: 't2', name: 'FAST SWAP',
    desc: 'Weapon group swap speed',
    ranks: [{ swapMul: 1.35 }, { swapMul: 1.70 }] },
  vent_cycle:     { branch: 'combat', tier: 't2', name: 'VENT CYCLE',
    desc: 'Heat sheds faster after a cut-out',
    ranks: [{ cooldownMul: 0.80 }, { cooldownMul: 0.65 }, { cooldownMul: 0.50 }] },
  steady_mount:   { branch: 'combat', tier: 't2', name: 'STEADY MOUNT',
    desc: 'Recoil shove reduced — big guns on light frames',
    ranks: [{ recoilMul: 0.75 }, { recoilMul: 0.50 }] },
  weak_point:     { branch: 'combat', tier: 't3', name: 'WEAK POINT',
    desc: 'Reactors, legs and beams take extra damage',
    ranks: [{ critModuleMul: 1.25 }, { critModuleMul: 1.50 }] },
  sustained_fire: { branch: 'combat', tier: 't3', name: 'SUSTAINED FIRE',
    desc: 'Holding one target builds a damage ramp',
    ranks: [{ rampPerSec: 0.02, rampCap: 0.20 }, { rampPerSec: 0.03, rampCap: 0.36 }] },
  overburn:       { branch: 'combat', tier: 'deep', name: 'OVERBURN',
    desc: 'Overheated permanents keep firing at half rate; sustained overburn damages the MOUNT (garage repair, never the weapon)',
    ranks: [{ overburn: true, overRateMul: 0.5 }] },

  // ======================= SURVIVAL ======================================
  reinforced_core:{ branch: 'survival', tier: 't1', name: 'REINFORCED CORE',
    desc: 'Core health', ranks: [{ hpMul: 1.15 }, { hpMul: 1.30 }, { hpMul: 1.45 }] },
  field_repair:   { branch: 'survival', tier: 't1', name: 'FIELD REPAIR',
    desc: 'Out-of-combat regen rate',
    ranks: [{ regenMul: 1.30 }, { regenMul: 1.60 }, { regenMul: 1.90 }] },
  plating:        { branch: 'survival', tier: 't1', name: 'PLATING',
    desc: 'Flat damage resistance on the core',
    ranks: [{ coreDamageMul: 0.92 }, { coreDamageMul: 0.84 }] },
  hazard_sense:   { branch: 'survival', tier: 't2', name: 'HAZARD SENSE',
    desc: 'Environmental damage resistance',
    ranks: [{ hazardDamageMul: 0.75 }, { hazardDamageMul: 0.50 }] },
  mount_bracing:  { branch: 'survival', tier: 't2', name: 'MOUNT BRACING',
    desc: 'Your bolted-on parts are harder to shoot off',
    ranks: [{ ownConnHpMul: 1.20 }, { ownConnHpMul: 1.40 }, { ownConnHpMul: 1.60 }] },
  second_wind:    { branch: 'survival', tier: 't2', name: 'SECOND WIND',
    desc: 'Below 25% health: brief speed and resistance burst (90s cooldown)',
    ranks: [{ swSecs: 2.0, swSpeed: 1.20, swResist: 0.80 },
            { swSecs: 3.5, swSpeed: 1.30, swResist: 0.65 }] },
  wreck_memory:   { branch: 'survival', tier: 't3', name: 'WRECK MEMORY',
    desc: 'Your death wreck holds on longer',
    ranks: [{ wreckMapAnywhere: true },
            { wreckMapAnywhere: true, wreckExtraDeath: 1 }] },
  hard_shutdown:  { branch: 'survival', tier: 't3', name: 'HARD SHUTDOWN',
    desc: 'Heat shutdowns are shorter, and you keep steering',
    ranks: [{ shutdownMul: 0.65 }, { shutdownMul: 0.40, steerThrough: true }] },
  black_box:      { branch: 'survival', tier: 'deep', name: 'BLACK BOX',
    desc: 'Your death wreck can NEVER be destroyed by a second death. Unbanked gear is never permanently lost — but you still walk back for it.',
    ranks: [{ wreckIndestructible: true }] },

  // ======================= MACHINES ======================================
  gadget_bay:     { branch: 'machines', tier: 't1', name: 'GADGET BAY',
    desc: 'Gadget slots', ranks: [{ gadgetSlots: 1 }, { gadgetSlots: 2 }] },
  drone_frame:    { branch: 'machines', tier: 't1', name: 'DRONE FRAME',
    desc: 'Drone health and damage',
    ranks: [{ droneMul: 1.20 }, { droneMul: 1.40 }, { droneMul: 1.60 }] },
  trade_card:     { branch: 'machines', tier: 't1', name: 'TRADE CARD',
    desc: 'Garage prices', ranks: [{ priceMul: 0.90 }, { priceMul: 0.80 }] },
  power_tap:      { branch: 'machines', tier: 't2', name: 'POWER TAP',
    desc: 'Reactor output on every vehicle',
    // NOTE from CONTENT_MODULES part 5: if +30% makes everything affordable
    // by mid-game, nerf THIS, not the parts.
    ranks: [{ powerMul: 1.10 }, { powerMul: 1.20 }, { powerMul: 1.30 }] },
  drone_logic:    { branch: 'machines', tier: 't2', name: 'DRONE LOGIC',
    desc: 'Drones act smarter',
    ranks: [{ droneFlank: true, droneRetreat: true },
            { droneFlank: true, droneRetreat: true,
              droneTargetsConnectors: true, droneFreeRevive: true }] },
  quick_dock:     { branch: 'machines', tier: 't2', name: 'QUICK DOCK',
    desc: 'Dock/undock and preset swap speed',
    ranks: [{ dockMul: 1.5 }, { dockMul: 2.0 }] },
  field_workshop: { branch: 'machines', tier: 't3', name: 'FIELD WORKSHOP',
    desc: 'Limited garage functions in the field',
    ranks: [{ fieldPresets: true },
            { fieldPresets: true, fieldFitCarried: true }] },
  load_bearing:   { branch: 'machines', tier: 't3', name: 'LOAD BEARING',
    desc: 'Weight penalty on turning and acceleration',
    ranks: [{ weightPenaltyMul: 0.80 }, { weightPenaltyMul: 0.60 }] },
  parallel_bus:   { branch: 'machines', tier: 'deep', name: 'PARALLEL BUS',
    desc: '+1 gadget slot, and gadgets and drones draw NO power at all.',
    ranks: [{ gadgetSlots: 1, gadgetsFreePower: true }] },
};

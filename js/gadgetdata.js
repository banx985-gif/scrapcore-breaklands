// SCRAPCORE: BREAKLANDS — GADGETS AND DRONES (content/draft_gadgets.js, absorbed)
//
// Gadgets sit in gadget slots (base 1, +2 GADGET BAY, +1 PARALLEL BUS, max 4)
// and COST POWER unless PARALLEL BUS. `gate: true` marks a traversal gadget
// the map depends on.
//
// DATA ONLY: granting a gadget, ticking a decoy and drawing a drone is
// BLOCK 11. What already exists is the READER — `Progress.gadgets[id] >= n`
// is how every barrier gate and mission gear requirement asks — so the ids
// here are bent to that vocabulary, which the gates and missions already
// speak:
//
//   draft `drillRig`  -> `drill`   (BARRIER_TYPES rubble/reinforced/shaft:
//                                   'drill:1..3'; mission gear 'drill_*')
//   draft `hoverPack` -> `hover`   (the matrix's HOVER PACK 1; note the
//                                   `belt` barrier currently resolves 'hover'
//                                   as the SHRIKE's rig ability — Block 11
//                                   reconciles which one a live belt wants)
//
// Everything else already matched (grapple, cutter, seal, scanner, jammer...).
// tests/test_contentdata.js proves every 'gadget:x' reward and every gate
// opener resolves into this table at the rank it names.

const GADGETS = {
  // ---- UTILITY -----------------------------------------------------------
  scanner: { name: 'SCANNER', power: 2, found: 'ironworks garage claim',
    ranks: [
      { lootReveal: 400, pulse: 4 },
      { lootReveal: 600, connReadout: true },
      { lootReveal: 900, minimapCaches: true },
    ]},
  repairUnit: { name: 'REPAIR UNIT', power: 3, found: 'first lair entry',
    ranks: [
      { rate: 6,  delay: 3 },
      { rate: 10, delay: 2, connectors: true },
      { rate: 5,  inCombat: true },     // half rate, works under fire
    ]},
  decoy: { name: 'DECOY', power: 2, found: 'barrens placed machine',
    // The gadget that makes ripping viable against a group. Findable EARLY.
    ranks: [
      { secs: 6,  drawsBasic: true },
      { secs: 10, drawsElites: true, detonate: 40 },
      { secs: 14, firesBack: true },
    ]},
  towWinch: { name: 'TOW WINCH', power: 1, found: 'first tow (given)',
    ranks: [
      { towSpeedPenaltyMul: 0.8 },
      { hookRangeMul: 2, instantHook: true },
      { towNoSnag: true },              // rank 3 removes the most annoying thing about towing
    ]},
  jammer: { name: 'JAMMER', power: 3, found: 'sprawl depot (behind cutter door)',
    // The counter-play to alert. If alert feels punishing before this exists,
    // move THIS earlier — never soften alert.
    ranks: [
      { alertFreeze: true, secs: 20, cd: 60 },
      { alertDrain: true },
      { roamersLoseYou: true },
    ]},
  salvageBeacon: { name: 'SALVAGE BEACON', power: 2, found: 'late NPC chain',
    // Deliberately late and lossy. Towing must stay the better option.
    ranks: [
      { marks: 1, valueFrac: 0.60 },
      { marks: 3, valueFrac: 0.60 },
      { marks: 5, valueFrac: 0.80 },
    ]},

  // ---- TRAVERSAL — gate: true means the map depends on it ----------------
  drill: { name: 'DRILL RIG', power: 2, gate: true,
    found: 'story, end of The Digs',
    ranks: [
      { opens: ['rubble', 'softRock'], permanentTunnels: true },
      { opens: ['reinforcedWall'], speedMul: 2 },
      { opens: ['mineShaftDown'] },     // hard gate to mine interiors
    ]},
  grapple: { name: 'GRAPPLE', power: 2, gate: true,
    found: 'neoncut, first crab-only climb',
    // Anchor points are VISIBLE world objects — you always see where a
    // grapple is possible.
    ranks: [
      { range: 600,  upOnly: true },
      { range: 1000, anyDirection: true, pullsObjects: true },
      { chainWithoutGround: true },
    ]},
  hover: { name: 'HOVER PACK', power: 4, gate: true,
    found: 'late, sealed depot',
    ranks: [
      { secs: 1.5, cd: 5 },
      { secs: 3.0, cd: 4 },
      { secs: 5.0, noFallDamage: true },
    ]},
  seal: { name: 'SEAL', power: 1, gate: true,
    found: 'sumpworks lair',
    ranks: [
      { underwaterSecs: 20 },
      { underwaterSecs: Infinity, gasImmune: true },
      { fightSubmerged: true },        // before this, weapons disabled underwater
    ]},
  cutter: { name: 'CUTTER', power: 2, gate: true,
    found: 'neoncut arcade (placed machine)',
    // Every district should have at least one Cutter door visible from hour one.
    ranks: [
      { opens: ['shutter'],  secsPerDoor: 6 },
      { opens: ['bulkhead'], secsPerDoor: 3 },
      { opens: ['vaultDoor'], weapon: { dps: 40, reach: 40 } },
    ]},
};
const GADGET_LIST = Object.keys(GADGETS);

// ---- DRONES — one active at a time; the second slot is a mission reward ---
const DRONES = {
  wasp:       { name: 'WASP', power: 2, found: 'yard placed machine',
    behaviour: 'circles you, fires a light MG at your target' },
  tick:       { name: 'TICK', power: 2, found: 'early mission',
    behaviour: 'ignores enemies; collects loose parts and scrap and brings them to you' },
  hornet_dr:  { name: 'HORNET', power: 3, found: 'second lair boss',
    behaviour: 'engages independently, prefers connectors' },
  shieldMite: { name: 'SHIELD MITE', power: 3, found: 'neoncut gated pocket',
    behaviour: 'sits between you and the nearest threat, soaks, dies often' },
  spotter:    { name: 'SPOTTER', power: 2, found: 'mission chain',
    behaviour: 'marks enemies: +15% damage taken, connectors shown' },
  breaker_dr: { name: 'BREAKER', power: 4, found: 'late roaming boss',
    behaviour: 'heavy melee drone, attacks connectors, slow and loud' },
};

const DRONE_RULES = {
  activeAtOnce: 1,
  secondSlotFrom: 'spotter mission chain reward',
  freeRebuildAt: 'garage',            // anywhere with DRONE LOGIC rank 2
};

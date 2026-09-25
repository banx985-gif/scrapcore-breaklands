// SCRAPCORE: BREAKLANDS — PERMANENT WEAPONS AND SLOTS (Block 4)
//
// Done when you can lose every stolen part in a fight and still shoot your way
// home. That is the whole reason permanents exist: Block 3 made losing your
// carry hurt, and a machine stripped to a bare core with no gun is not a
// setback, it is a walk.
//
// FROM content/CONTENT_WEAPONS.md, and the differences are the design:
//
//   * NO POWER. `powerCost` is ignored for a permanent. It always fires.
//   * HEAT IS THE ONLY BRAKE. It contributes to the machine's heat budget like
//     anything else, and overheating cuts it out like anything else. Every
//     variant below is balanced on heat per second, not on power.
//   * NEVER SHOT OFF, LOST OR DESTROYED. A connector on a permanent takes no
//     damage. There is nothing to shear.
//   * IT LIVES IN A SLOT, not an open socket, and slots are EARNED.
//
// ---------------------------------------------------------------------------
// THE DATA SHAPE IS BUILT FOR ALL 54. THE BEHAVIOUR IS BUILT FOR NINE.
//
// Per the build bible's parked decision: MACHINE GUN, CANNON and ARC GUN, three
// variants each. The plainest weapon proves fitting and slots; the cannon
// proves behaviour upgrades (splash, recoil, cluster); the arc gun proves
// chaining, which is the weirdest code path in the system.
//
// The remaining 45 are a CONTENT PASS, not a refactor: add a row to
// WEAPON_VARIANTS and it exists. Nothing below is hard-coded to the nine.
// tests/test_block4.js asserts every row's `base` is a real class in parts.js
// and that its stat overrides name real fields, so a content pass that fat-
// fingers a stat fails a test rather than shipping a gun that does nothing.

// ---------------------------------------------------------------------------
// A PERMANENT IS A FLOOR, NOT A CRUTCH. Four rules, and every number below
// exists to serve one of them:
//
//   1. A permanent alone kills basic patrols, but takes ~3x as long as a
//      modest stolen build. It is the slow way home, never the good way.
//   2. A PERMANENT MUST NOT RELIABLY BREAK CONNECTORS. This is the important
//      one. If you can farm parts with it, it stops being a floor and becomes
//      the game — why bolt anything on if the free gun strips machines?
//      Limping home with kills and no loot is the INTENDED feeling.
//   3. A permanent loses to an elite. Meeting one with only your permanent
//      means run.
//   4. Heat forces a stop-and-cool between fights. Never a continuous walk.
//
// Block 3's tension is the CARRY NUMBER, not the risk of dying on the way
// back. Losing twenty parts is the sting; always limping home is fine and
// correct, so none of this is trying to make the return trip survivable.
const PERM = {
  // Slots by vehicle size (4.2). The core is a person in a machine, not a rig,
  // so it carries least; a large rig is a weapons platform.
  SLOTS_BY_SIZE: { core: 2, small: 2, medium: 3, large: 4 },
  MAX_SLOTS: 4,

  // ---- THE CONNECTOR MULTIPLIER, and it is tuning. ----
  //
  // RULE 2 LIVED HERE AND IT IS GONE (D366, Aaron's ruling). It had two
  // halves: this multiplier, and a FLOOR — a permanent could never take a
  // connector below 0.34 of max however long you held the trigger, which was
  // said to make farming impossible by construction rather than by balance.
  //
  // THE FLOOR NEVER RAN. It was keyed off PARTS[srcId].permanent, and a
  // permanent's rounds carry their BASE class as srcId — machineGun, not
  // perm_machineGun — because that is what Mastery credit needs. So the test
  // was false for every shot a permanent has ever fired and the wall was
  // skipped. Twenty seconds of held trigger shears a PICKER joint, and has
  // for the whole project.
  //
  // It is dropped rather than fixed. Shooting parts off machines is the verb
  // this game is about; the Yard teaches SHOOT THE JOINT at 2:00; and the only
  // gun a new save has is a permanent. A rule that makes the tutorial
  // impossible is the wrong rule, and the build has shipped fine without it.
  //
  //   CONN_MUL   what a permanent's shot does to a joint. ASSIGNED, never
  //              multiplied, so no perk, firmware or Core Mod can stack past
  //              it. A permanent is deliberately WORSE at joints than the
  //              plainest stolen gun — slow, not barred. That is all this is
  //              now: a speed limit, which the deleted comment correctly said
  //              a multiplier alone could only ever be. It was right about the
  //              mechanism and wrong about wanting the wall.
  CONN_MUL: 0.15,

  // Where OVERBURN's mount wear stops, and this is NOT the floor coming back
  // under another name. BLOCK 4.1 says a permanent is never shot off, lost or
  // destroyed; OVERBURN wearing your own mount to nothing would lose you the
  // gun. Nothing but Machine._tickOverburn reads it.
  MOUNT_WEAR_FLOOR: 0.34,

  // ---- RULE 4: heat is the only brake, so it has to actually brake. ----
  //
  // A permanent runs HOT. It has no power grid regulating it — that is what
  // 4.1 bought — so it is the thing that cooks the machine.
  HEAT_MUL: 1.6,

  // And it is the LAST thing to come back. The machine's own overheat vents
  // fast (42/sec down to 45) and clears in under a second, which is a
  // stutter, not a stop. A permanent stays dead until the machine is
  // properly cool, so a permanent-only walk home is fight, stop, cool,
  // fight — roughly four seconds of nothing between bursts, which is the
  // difference between rule 4 and a continuous walk.
  RESUME_AT: 0.25,          // fraction of heat cap

  // How a slot is earned. Never bought - every one of these is a place you
  // went or a thing you beat. The `source` is what unlocks it, and the id is
  // what persists.
  SLOT_SOURCES: [
    { id: 'slot_start',      need: null,                        why: 'the machine you start with' },
    { id: 'slot_pressWarden', need: 'killed:iw_pressWarden',    why: 'the Press Warden' },
    { id: 'slot_haulBoss',   need: 'killed:iw_haulBoss',        why: 'the Haul Boss' },
    { id: 'slot_eastGate',   need: 'garage:iw_eastGate',        why: 'claiming the East Gate' },
  ],
};

// ---------------------------------------------------------------------------
// THE CATALOGUE. 18 classes x 3 variants. `base` is the class id in parts.js,
// which is where the model, the sprite set and the working behaviour already
// live - nothing here invents a class, it varies one.
//
// `stats` overrides fields on the base part. `heatPerShot` is the balancing
// lever for every one of them, because heat is the only brake a permanent has.
//
// THERE IS NO BEHAVIOUR DISPATCH TABLE, and that is the finding of this block.
// The first draft had one. Then every behaviour the nine needed turned out to
// be a field the engine already read — `flak` for the cluster shell, `chain`
// for the arc, `connMul` for the shredder — and the only genuinely new one,
// `jam`, is eleven lines that reuse the gate overheating already goes through.
// So a variant is DATA. Adding the other 45 is typing, and typing is the
// thing this shape was chosen to make possible.
const WEAPON_VARIANTS = {
  // ---- THE STARTER -------------------------------------------------------
  // The plain class, with no overrides at all: the WEAKEST form of the gun.
  //
  // It used to be the HORNET, which was wrong twice over. Variants are earned
  // from bosses and lairs, so starting with one gives away the reward before
  // the player has done anything for it; and the HORNET's whole character is
  // rate of fire, which is the last thing a floor should have. What you start
  // with should be the thing you are happy to replace.
  perm_machineGun: {
    base: 'machineGun', name: 'MACHINE GUN', character: 'the gun bolted to your frame',
    plain: true, stats: {},
    capstone: null,
  },

  // ---- BULLETS: the plainest weapon. Proves fitting and slots. -----------
  mg_hornet: {
    base: 'machineGun', name: 'HORNET', character: 'rate of fire',
    stats: { damage: 4, fireRate: 14, spread: 0.06, heatPerShot: 1.15 },
    capstone: 'every 5th second of sustained fire, spread drops to zero',
  },
  mg_longshot: {
    base: 'machineGun', name: 'LONGSHOT', character: 'range and precision',
    stats: { damage: 8, fireRate: 6, spread: 0.012, projSpeed: 2100,
             projLife: 1.8, heatPerShot: 2.4 },
    capstone: 'damage rises with distance travelled, up to +50%',
  },
  mg_rasp: {
    base: 'machineGun', name: 'RASP', character: 'sustained fire, runs hot',
    // This was 'armour shredder' with connMul 2.2, back when a permanent could
    // bite joints. RULE 2 killed that: a permanent that shears connectors is a
    // part farm, and a part farm stops being a floor and becomes the game. So
    // the RASP chews HULLS instead — the highest sustained damage of the three,
    // paid for in heat, which under rule 4 is the realest cost there is.
    // 2.2, not 2.6. content/validate_variants.js holds every variant to
    // within 0.55x-1.45x of its class's heat per second, and the RASP was
    // at 1.63x — I pushed it there by hand when rule 2 took its connector
    // bite away and I reached for heat to pay for the extra damage. But
    // +17% damage for +63% heat is not `runs hot`, it is unusable, and it
    // was out of family with all 54 of its siblings. 1.375x for +17%
    // damage is a trade someone might actually take.
    stats: { damage: 7, fireRate: 9, heatPerShot: 2.2 },
    capstone: 'the longer you hold the trigger, the less heat per round',
  },

  // ---- SHELLS: splash, recoil, cluster. Proves behaviour upgrades. -------
  cn_breaker: {
    base: 'cannon', name: 'BREAKER', character: 'one hard shot, no splash',
    // Also lost its connMul to rule 2. It is still the precise cannon — all
    // of the damage in one place instead of spread over a splash — which
    // against a heavy core is exactly what you want.
    stats: { damage: 52, splash: 0, splashDamage: 0, fireRate: 1.0,
             heatPerShot: 15, recoil: 700 },
    capstone: 'a shot that kills reloads instantly',
  },
  cn_spray: {
    base: 'cannon', name: 'SPRAY', character: 'cluster shell',
    // BEHAVIOUR: `flak` is the existing M14 burst — the shell breaks into
    // radial fragments on impact or proximity. A cluster shell IS a flak
    // shell, so this is data, not a second code path.
    stats: { damage: 20, splash: 110, splashDamage: 10, fireRate: 1.2,
             heatPerShot: 13, flak: true, fragments: 6, fragDamage: 8,
             proxRadius: 150 },
    capstone: 'the fragments seek the nearest machine',
  },
  cn_siege: {
    base: 'cannon', name: 'SIEGE', character: 'slow, enormous',
    stats: { damage: 70, splash: 220, splashDamage: 30, fireRate: 0.55,
             projSpeed: 800, recoil: 900, heatPerShot: 26 },
    capstone: 'the recoil becomes a dash you can steer',
  },

  // ---- SHOCK: chaining, the weirdest code path in the system. ------------
  arc_cascade: {
    base: 'arcGun', name: 'CASCADE', character: 'chains far and often',
    stats: { damage: 9, fireRate: 3.2, heatPerShot: 3.2,
             chain: 4, chainFrac: 0.7, chainRange: 550 },
    capstone: 'a chain that finds nothing new jumps back for half again',
  },
  arc_spike: {
    base: 'arcGun', name: 'SPIKE', character: 'one hard jolt',
    // Barely chains at all. The whole shot goes into the first thing it meets.
    stats: { damage: 32, fireRate: 1.6, heatPerShot: 6.5,
             chain: 1, chainFrac: 0.35, chainRange: 300 },
    capstone: 'a jolt that kills chains again from the corpse',
  },
  arc_drain: {
    base: 'arcGun', name: 'DRAIN', character: 'shuts things down',
    // BEHAVIOUR: `jam` silences a machine's weapons for N seconds, through
    // the SAME gate that overheating uses. Rides the chain, so it silences
    // everything it reaches, which is what makes it worth carrying.
    stats: { damage: 10, fireRate: 3.0, heatPerShot: 3.5,
             chain: 2, chainFrac: 0.6, chainRange: 450, jam: 1.6 },
    capstone: 'a jammed machine takes +30% from everything',
  },

  // ==========================================================================
  // THE OTHER 45. The content pass Block 4 was built to make possible.
  //
  // From content/draft_permanents_45.js, which is content/CONTENT_WEAPONS.md's
  // numbers EXCEPT where rule 2 forced a redesign: that doc predates D79/D81
  // and eight of its variants promised connector damage. Every one of those
  // was rebuilt around hull damage, stagger, heat, reach or raw output.
  //
  // NOT ONE ROW BELOW TOUCHES connMul, and content/validate_variants.js
  // refuses the file if one ever does — which is the whole reason rule 2 is
  // structural rather than a thing everyone has to remember.
  //
  // Fifteen classes x 3. Block 4 built nine by hand and claimed the remaining
  // forty-five would be typing rather than a refactor. This is that claim
  // being cashed: no engine change was needed for any of them.
  // ==========================================================================

  // ---- SCATTERGUN --------------------------------------------------------
  sg_maw: {
    base: 'scattergun', name: 'MAW', character: 'close-range brawler',
    stats: { damage: 7, pellets: 8, fireRate: 1.2, spread: 0.30,
             recoil: 420, heatPerShot: 9 },
    capstone: 'point-blank, every pellet that hits staggers',
  },
  sg_choke: {
    base: 'scattergun', name: 'CHOKE', character: 'tightened, mid-range',
    stats: { damage: 5, pellets: 6, fireRate: 1.7, spread: 0.10,
             projLife: 0.75, heatPerShot: 6 },
    capstone: 'no spread at all on the first shot after 1.5s of not firing',
  },
  sg_slug: {
    base: 'scattergun', name: 'SLUG', character: 'one heavy round',
    stats: { damage: 38, pellets: 1, fireRate: 1.3, spread: 0.02,
             recoil: 700, heatPerShot: 9 },
    capstone: 'the slug pierces one machine and keeps going',
  },

  // ---- BURST RIFLE -------------------------------------------------------
  br_triplet: {
    base: 'burstRifle', name: 'TRIPLET', character: 'the reliable one',
    stats: { damage: 11, fireRate: 2.4, burstGap: 0.05, heatPerShot: 2.1 },
    capstone: 'bursts fired while strafing gain +15% damage',
  },
  br_volley: {
    base: 'burstRifle', name: 'VOLLEY', character: 'more rounds, looser',
    stats: { damage: 8, fireRate: 1.6, burst: 5, burstGap: 0.04,
             spread: 0.035, heatPerShot: 1.9 },
    capstone: 'rounds after the third in a burst gain +10% each, cumulative',
  },
  br_punch: {
    base: 'burstRifle', name: 'PUNCH', character: 'two heavy rounds',
    stats: { damage: 22, fireRate: 1.5, burst: 2, burstGap: 0.09,
             spread: 0.008, heatPerShot: 4.5 },
    capstone: 'a burst that kills refunds its full heat',
  },

  // ---- PLASMA REPEATER ---------------------------------------------------
  pr_spitter: {
    base: 'plasmaRepeater', name: 'SPITTER', character: 'rate, tiny splash',
    stats: { damage: 7, fireRate: 11, splash: 35, splashDamage: 3,
             heatPerShot: 1.6 },
    capstone: 'every 5th shot is a free shot — no heat',
  },
  pr_glob: {
    base: 'plasmaRepeater', name: 'GLOB', character: 'slow, fat splash',
    stats: { damage: 14, fireRate: 4, splash: 90, splashDamage: 10,
             projSpeed: 1000, heatPerShot: 4.2 },
    capstone: 'the splash shoves loose parts toward you',
  },
  pr_scald: {
    base: 'plasmaRepeater', name: 'SCALD', character: 'leaves burning ground',
    stats: { damage: 8, fireRate: 7, splash: 40, splashDamage: 3,
             heatPerShot: 2.6, flame: true },
    capstone: 'burn patches merge and last twice as long',
  },

  // ---- ROCKET POD --------------------------------------------------------
  rp_swarm: {
    base: 'rocketPod', name: 'SWARM', character: 'many small',
    stats: { damage: 9, fireRate: 4, splash: 90, splashDamage: 5,
             homing: 3.6, projSpeed: 520, heatPerShot: 3.4 },
    capstone: 'fires a full 8-rocket salvo on a cycle instead of a stream',
  },
  rp_hammer: {
    base: 'rocketPod', name: 'HAMMER', character: 'one big',
    stats: { damage: 52, fireRate: 0.7, splash: 220, splashDamage: 26,
             homing: 1.8, projSpeed: 700, heatPerShot: 19 },
    capstone: 'a direct hit staggers anything short of a boss',
  },
  rp_hunter: {
    base: 'rocketPod', name: 'HUNTER', character: 'hard lock',
    stats: { damage: 22, fireRate: 1.2, splash: 130, splashDamage: 10,
             homing: 6.0, heatPerShot: 11 },
    capstone: 'locked targets take +15% from EVERYTHING you fire',
  },

  // ---- MORTAR ------------------------------------------------------------
  mt_rain: {
    base: 'mortar', name: 'RAIN', character: 'three small shells',
    // BEHAVIOUR NOTE: multi-shell reuses `burst` — three arcs per trigger.
    stats: { damage: 16, fireRate: 0.6, splash: 120, splashDamage: 8,
             burst: 3, burstGap: 0.12, spread: 0.12, heatPerShot: 5.7 },
    capstone: 'shell count rises to five',
  },
  mt_spike: {
    base: 'mortar', name: 'SPIKE', character: 'one precise shell',
    stats: { damage: 62, fireRate: 0.6, splash: 110, splashDamage: 12,
             arcTime: 0.7, spread: 0.005, heatPerShot: 19 },
    capstone: 'arc time drops to near-instant',
  },
  mt_seeder: {
    base: 'mortar', name: 'SEEDER', character: 'leaves mines where it lands',
    // BEHAVIOUR: `mine` on an arcing shell — the impact scatters armed mines.
    stats: { damage: 24, fireRate: 0.7, splash: 140, splashDamage: 10,
             mine: true, mineDamage: 18, mineSplash: 140, heatPerShot: 15 },
    capstone: 'its mines arm instantly',
  },

  // ---- FLAK CANNON -------------------------------------------------------
  fk_curtain: {
    base: 'flakCannon', name: 'CURTAIN', character: 'wide and thin',
    stats: { fragments: 14, fragDamage: 5, proxRadius: 220, fireRate: 0.8,
             heatPerShot: 13 },
    capstone: 'the burst lingers as a damaging cloud',
  },
  fk_lance: {
    base: 'flakCannon', name: 'LANCE', character: 'narrow and hard',
    stats: { fragments: 5, fragDamage: 16, proxRadius: 90, fireRate: 1.0,
             projSpeed: 1200, heatPerShot: 11 },
    capstone: 'all five fragments on one machine combine into a stagger',
  },
  fk_shrike: {
    base: 'flakCannon', name: 'SHRIKE', character: 'anti-projectile',
    // BEHAVIOUR NOTE: the burst clearing enemy projectiles reuses whatever
    // pointDefence uses to cull them. Flag for Block 10 if that isn't shared.
    stats: { fragments: 8, fragDamage: 7, proxRadius: 160, fireRate: 0.9,
             heatPerShot: 12 },
    capstone: 'projectiles it destroys feed extra fragments into the next shot',
  },

  // ---- FLAMETHROWER ------------------------------------------------------
  fl_bellows: {
    base: 'flamethrower', name: 'BELLOWS', character: 'wide short cone',
    stats: { damage: 4.0, fireRate: 16, spread: 0.40, projLife: 0.38,
             heatPerShot: 1.8 },
    capstone: 'the cone shoves loose parts and light machines back',
  },
  fl_lance: {
    base: 'flamethrower', name: 'LANCE', character: 'narrow long jet',
    stats: { damage: 3.0, fireRate: 18, spread: 0.12, projLife: 0.75,
             heatPerShot: 1.4 },
    capstone: 'the jet burns through armour plate as if it were hull',
  },
  fl_slowburn: {
    base: 'flamethrower', name: 'SLOWBURN', character: 'cool-running',
    // The one deliberately cool permanent in the game: rule 4 still holds
    // because its damage is a trickle — the heat saved is paid in time.
    stats: { damage: 2.4, fireRate: 16, heatPerShot: 0.95 },
    capstone: 'its burn never expires while the target stays in the cone',
  },

  // ---- BEAM LASER --------------------------------------------------------
  bl_hairline: {
    base: 'beamLaser', name: 'HAIRLINE', character: 'thin, long, exact',
    // Was 'x1.6 to connectors'. Rule 2 killed that; its identity is now pure
    // reach — the longest weapon in the game.
    stats: { dps: 26, range: 1600, heatPerSecond: 8 },
    capstone: 'no damage falloff, and it pierces one obstacle',
  },
  bl_ramp: {
    base: 'beamLaser', name: 'RAMP', character: 'builds on one target',
    // BEHAVIOUR NOTE: ramping dps needs a small hold-time multiplier on the
    // beam path. One field, one clamp — flag for Block 10 if it's not free.
    stats: { dps: 18, range: 1100, heatPerSecond: 10 },
    capstone: 'the ramp holds for a moment after you break contact',
  },
  bl_splitter: {
    base: 'beamLaser', name: 'SPLITTER', character: 'hits two at once',
    // BEHAVIOUR: reuses `chain` — a beam that chains once is a split beam.
    stats: { dps: 20, range: 900, heatPerSecond: 11,
             chain: 1, chainFrac: 1.0, chainRange: 500 },
    capstone: 'splits to a third target',
  },

  // ---- RAILGUN -----------------------------------------------------------
  rg_spike: {
    base: 'railgun', name: 'SPIKE', character: 'one target, all of it',
    // Was 'x1.8 to connectors'. Now simply the hardest single hit a
    // permanent can make, and pierce 1 so none of it is wasted past the
    // first machine.
    stats: { damage: 92, fireRate: 0.45, pierce: 1, heatPerShot: 26 },
    capstone: 'a killing shot vents 20 heat instead of adding it',
  },
  rg_line: {
    base: 'railgun', name: 'LINE', character: 'pierces everything',
    stats: { damage: 44, fireRate: 0.6, pierce: 99, heatPerShot: 20 },
    capstone: 'no damage falloff along the line',
  },
  rg_charge: {
    base: 'railgun', name: 'CHARGE', character: 'hold to load',
    // BEHAVIOUR NOTE: hold-to-charge needs a charge gate on the fire path.
    // The M14 burst code already separates trigger from release — reuse it.
    stats: { damage: 30, fireRate: 0.5, heatPerShot: 24 },   // full-charge cost; a tap charges — and heats — less
    capstone: 'a full-charge shot staggers, and its recoil is halved',
  },

  // ---- SAW ---------------------------------------------------------------
  sw_ripper: {
    base: 'saw', name: 'RIPPER', character: 'fast and shallow',
    stats: { dps: 78, reach: 40, heatPerSecond: 5.5 },
    capstone: 'kills reset its heat to zero',
  },
  sw_reach: {
    base: 'saw', name: 'REACH', character: 'long arm',
    stats: { dps: 52, reach: 78, bladeRadius: 48, heatPerSecond: 4 },
    capstone: 'the blade extends on a boom while the trigger is held',
  },
  sw_flywheel: {
    base: 'saw', name: 'FLYWHEEL', character: 'slow to spin, monstrous once going',
    // Was GRINDER, 'x2.2 to connectors'. Rule 2 rebuild: a momentum saw —
    // its dps is the highest of the three but only after sustained contact,
    // which under rule 4 is the most expensive thing there is.
    stats: { dps: 88, reach: 42, heatPerSecond: 5.6 },
    capstone: 'the wheel keeps spinning through a cut-out and back',
  },

  // ---- DRILL -------------------------------------------------------------
  dr_pinion: {
    base: 'drill', name: 'PINION', character: 'pins what it bites',
    // Was AUGER, 'x2.4 to connectors'. Rule 2 rebuild: it holds machines
    // still — stagger is fair per D81, and a drill that pins a RUNNER is
    // worth a slot on its own.
    stats: { dps: 62, reach: 50, heatPerSecond: 5 },
    capstone: 'sustained contact pins even medium machines in place',
  },
  dr_core: {
    base: 'drill', name: 'CORE', character: 'ignores armour',
    stats: { dps: 76, reach: 46, heatPerSecond: 6 },
    capstone: 'damage passes through to the module behind the one you touch',
  },
  dr_bore: {
    base: 'drill', name: 'BORE', character: 'long spike, full commit',
    // Terrain-breaking moved to the DRILL RIG gadget (see CONTENT_GADGETS
    // open question 2) — a permanent that opens the map would gate Block 8
    // behind a weapon drop. This is now the reach drill.
    stats: { dps: 58, reach: 70, heatPerSecond: 5 },
    capstone: 'chews through destructible rubble and barricade props',
  },

  // ---- HARPOON -----------------------------------------------------------
  hp_winch: {
    base: 'harpoon', name: 'WINCH', character: 'hauls hard',
    stats: { damage: 10, fireRate: 0.8, tether: 3.0, tetherPull: 1500,
             heatPerShot: 6 },
    capstone: 'drags SMALL wrecks behind you without a tow hook',
  },
  hp_barb: {
    base: 'harpoon', name: 'BARB', character: 'hurts going in',
    // Was 'breaks a connector it lands on'. Rule 2 rebuild: the damage
    // harpoon — twice the hit, half the hold.
    stats: { damage: 30, fireRate: 1.0, tether: 1.0, heatPerShot: 6 },
    capstone: 'a tethered kill reloads it instantly and refunds the heat',
  },
  hp_grapnel: {
    base: 'harpoon', name: 'GRAPNEL', character: 'pulls YOU',
    // BEHAVIOUR NOTE: anchoring to terrain inverts the tether — pull the
    // firer instead of the target. Same forces, opposite sign.
    stats: { damage: 12, fireRate: 1.2, tether: 1.4, tetherPull: 1100,
             heatPerShot: 4 },
    capstone: 'landing an anchor gives a burst of speed on arrival',
  },

  // ---- MINE LAYER --------------------------------------------------------
  ml_scatter: {
    base: 'mineLayer', name: 'SCATTER', character: 'many weak',
    stats: { mineDamage: 12, mineSplash: 140, fireRate: 0.7, burst: 3,
             burstGap: 0.1, heatPerShot: 2.4 },   // per mine, and it drops three
    capstone: 'mines that survive long enough split into two',
  },
  ml_heavy: {
    base: 'mineLayer', name: 'HEAVY', character: 'one nasty',
    stats: { mineDamage: 58, mineSplash: 280, fireRate: 0.5, heatPerShot: 8 },
    // Was 'breaks every connector in radius'. Rule 2 rebuild:
    capstone: 'the blast staggers everything it touches',
  },
  ml_snare: {
    base: 'mineLayer', name: 'SNARE', character: 'slows what it catches',
    stats: { mineDamage: 10, mineSplash: 180, fireRate: 0.9, heatPerShot: 4 },
    capstone: 'snared machines are slowed longer and further',
  },

  // ---- DISC LAUNCHER -----------------------------------------------------
  dc_carom: {
    base: 'discLauncher', name: 'CAROM', character: 'bounces forever',
    stats: { damage: 12, fireRate: 1.8, ricochet: 6, projLife: 4.0,
             heatPerShot: 5 },
    capstone: 'discs never expire until they run out of bounces',
  },
  dc_cleaver: {
    base: 'discLauncher', name: 'CLEAVER', character: 'one heavy disc',
    stats: { damage: 40, fireRate: 1.0, ricochet: 1, heatPerShot: 9 },
    capstone: 'a disc that kills keeps flying at full damage',
  },
  dc_orbit: {
    base: 'discLauncher', name: 'ORBIT', character: 'comes back to you',
    // BEHAVIOUR NOTE: the return leg is a homing target of `owner` after the
    // outbound life expires — reuses `homing`, aimed home.
    stats: { damage: 20, fireRate: 1.4, projLife: 1.6, homing: 5.0,
             heatPerShot: 6.5 },
    capstone: 'catching the returning disc refunds its heat',
  },

  // ---- SHOCKWAVE CANNON --------------------------------------------------
  sh_push: {
    base: 'shockwaveCannon', name: 'PUSH', character: 'crowd control',
    stats: { damage: 14, waveRange: 460, waveKnock: 2200, fireRate: 0.9,
             heatPerShot: 13 },
    capstone: 'machines thrown into walls or each other take impact damage',
  },
  sh_crush: {
    base: 'shockwaveCannon', name: 'CRUSH', character: 'damage, no throw',
    stats: { damage: 46, waveRange: 300, waveKnock: 400, fireRate: 0.6,
             heatPerShot: 19 },
    capstone: 'holding the trigger focuses the wave into a forward cone',
  },
  sh_slam: {
    base: 'shockwaveCannon', name: 'SLAM', character: 'point-blank payoff',
    // Was SNAP, 'x2.5 to connectors'. Rule 2 rebuild: damage scales with how
    // close the target is when the wave hits — the brawler's shockwave.
    stats: { damage: 24, waveRange: 340, waveKnock: 900, fireRate: 0.7,
             heatPerShot: 16 },
    capstone: 'at point-blank the wave hits twice',
  },
};

const WEAPON_VARIANT_LIST = Object.keys(WEAPON_VARIANTS);

// The 3-step spine is per CLASS and shared by its variants; the capstone is per
// variant. 18 spines + 54 capstones rather than 54 separate paths - same felt
// personality, a third of the balance surface, and a class stays coherent
// across its variants. Block 10 spends these; Block 4 only has to store them.
// NOTE FOR BLOCK 10: NO SPINE MAY PROMISE CONNECTOR DAMAGE. The first draft
// of these had a tracer doing x3 to connectors, cannon hits shearing joints,
// and arc chains preferring connectors over hulls — all written before rule 2
// said a permanent must never be the thing that farms you parts. An upgrade
// path that walks a permanent back toward part-stripping undoes the floor one
// purchase at a time. Stagger, heat, reach and raw damage are all fair.
const WEAPON_SPINES = {
  machineGun: ['+15% fire rate', 'spread halves while stationary',
               'every 10th round is a tracer doing x2 HULL damage'],
  cannon: ['+20% splash radius', 'a direct hit staggers the machine',
           'gains a cluster shell'],
  arcGun: ['+1 chain', 'chains reach 30% further',
           'a chain returning to a machine already hit does double'],

  // The other fifteen, one per remaining class. Same rule as above: not one
  // of them promises connector damage, and the validator refuses the file if
  // one ever does.
  scattergun:      ['+2 pellets (SLUG: +30% damage)', 'the recoil shove is halved',
                    'point-blank hits stagger'],
  burstRifle:      ['+1 round per burst', 'the last round of a burst does x2 HULL damage',
                    'a full burst on one target refunds a quarter of its heat'],
  plasmaRepeater:  ['+25% splash radius', 'splash scorches the ground briefly',
                    'overheating vents a plasma burst around you'],
  rocketPod:       ['+40% turn rate', 'rockets that miss loiter and re-acquire',
                    'a full volley on one machine adds a bonus detonation'],
  mortar:          ['+150 arc range', 'your own impact marker shows before landing',
                    'shells stagger on a direct hit'],
  flakCannon:      ['+2 fragments', 'fragments ricochet once',
                    'the shell detonates at the ideal range automatically'],
  flamethrower:    ['-15% heat', 'burning machines are easier to see and track',
                    'leaves burning ground where the cone lands'],
  beamLaser:       ['+25% range', 'the beam continues through a kill to the next machine',
                    'holding one target for 2s staggers it'],
  railgun:         ['+2 pierce (SPIKE: +25% damage)', 'the shot leaves a brief damaging rail',
                    'pierces one wall or obstacle'],
  saw:             ['+20% reach', 'the blade deflects projectiles it touches',
                    'contact slows the target'],
  drill:           ['+25% HULL damage', 'sustained contact staggers',
                    'bites faster the longer it stays on one module'],
  harpoon:         ['+50% tether duration', 'tethered machines take +20% from everything',
                    'the tether drags loose parts on the ground toward you'],
  mineLayer:       ['+8s mine lifetime', 'mines arm instantly',
                    'detonations pull loose parts toward you'],
  discLauncher:    ['+2 ricochets', 'each bounce adds +15% damage, cumulative',
                    'discs drag loose parts they pass'],
  shockwaveCannon: ['+80 range', 'the wave throws loose parts TOWARD you',
                    'the wave destroys enemy projectiles it passes through'],
};

const SPINE_COST = [
  { parts: 1, scrap: 400 },
  { parts: 2, scrap: 900 },
  { parts: 3, scrap: 1800 },
];
const CAPSTONE_COST = { parts: 4, scrap: 3000 };

// ---------------------------------------------------------------------------
const Permanents = {
  // Build the PART a variant becomes: the base class with its overrides
  // applied. Cached, because this is read on every shot.
  //
  // `permanent: true` is the flag every other system keys off - it is what
  // makes powerCostOf return 0 and connector damage a no-op, and it lives on
  // the part rather than on the socket so a permanent stays permanent wherever
  // it is looked at.
  _cache: {},
  part(variantId) {
    if (this._cache[variantId]) return this._cache[variantId];
    const v = WEAPON_VARIANTS[variantId];
    if (!v) return null;
    const base = PARTS[v.base];
    if (!base) return null;
    const p = Object.assign({}, base, v.stats || {}, {
      id: variantId,
      name: v.plain ? base.name : base.name + ' — ' + v.name,
      permanent: true,
      variantOf: v.base,
      // Weapon skill is per CLASS, so a variant reports its class for Mastery
      // and for the skill counter. Kill with any machine gun and every machine
      // gun improves.
      masteryAs: v.base,
      capstone: v.capstone || null,
    });
    this._cache[variantId] = p;
    return p;
  },

  isVariant(id) { return !!WEAPON_VARIANTS[id]; },
  classOf(id) {
    const v = WEAPON_VARIANTS[id];
    return v ? v.base : id;
  },
  // The EARNED variants of a class. The plain starter is not one of them:
  // it is the class itself, and nothing is earned by having it.
  variantsOf(baseId) {
    return WEAPON_VARIANT_LIST.filter(k =>
      WEAPON_VARIANTS[k].base === baseId && !WEAPON_VARIANTS[k].plain);
  },
  isPlain(id) { return !!(WEAPON_VARIANTS[id] && WEAPON_VARIANTS[id].plain); },

  // Register every variant into PARTS so the rest of the game - Machine,
  // Projectiles, the draw path, Mastery - treats one exactly like any other
  // part. There is no second weapon pipeline, which is the point.
  register() {
    for (const id of WEAPON_VARIANT_LIST) {
      const p = this.part(id);
      if (p && !PARTS[id]) PARTS[id] = p;
    }
  },

  // ---- 4.2 SLOTS ---------------------------------------------------------
  // Per VEHICLE, capped by size. A rig found late starts near zero and you
  // build it up, so the slots are keyed by vehicle id, not by the player.
  // BLOCK 7 moved this. A vehicle is now a RIG you are docked into or the
  // CORE you are walking as, and Rigs is the one place that knows which.
  // The Jackrig fallback stays for the starting machine, which is a chassis
  // rather than either.
  sizeOf(vehicleId) {
    if (typeof Rigs !== 'undefined' && typeof RIGS !== 'undefined' &&
        (RIGS[vehicleId] || String(vehicleId || '').indexOf('core:') === 0)) {
      return Rigs.sizeOf(vehicleId);
    }
    const j = (typeof JACKRIGS !== 'undefined') ? JACKRIGS[vehicleId] : null;
    if (!j) return 'core';
    if (j.loadCap >= 40) return 'large';
    if (j.loadCap >= 32) return 'medium';
    return 'small';
  },

  // How many a vehicle COULD have, and how many are actually earned.
  slotCap(vehicleId) {
    // A rig states its own cap (CONTENT_RIGS gives each one a number and
    // they are not all the same within a size — the Gantry gives up a slot
    // for its deploy gear). Fall back to the size table for anything else.
    if (typeof RIGS !== 'undefined' && RIGS[vehicleId]) return RIGS[vehicleId].slots;
    if (typeof Rigs !== 'undefined' &&
        String(vehicleId || '').indexOf('core:') === 0) {
      return Rigs.slotCapOf(vehicleId);
    }
    return PERM.SLOTS_BY_SIZE[this.sizeOf(vehicleId)] || 1;
  },
  earnedSources() {
    const out = [];
    for (const s of PERM.SLOT_SOURCES) {
      if (!s.need) { out.push(s); continue; }
      const [kind, id] = s.need.split(':');
      if (kind === 'killed' && typeof World !== 'undefined' && World.wasKilled(id)) {
        out.push(s);
      } else if (kind === 'garage' && typeof Garages !== 'undefined' &&
                 Garages.owned(id)) {
        out.push(s);
      }
    }
    return out;
  },
  // AND THE SLOTS THE WORLD HANDED OVER.
  //
  // `SLOT_SOURCES` is the fixed list: the machine you start with, and three
  // Ironworks landmarks. It is not the only route and never was — a mission
  // pays `reward: { slot: { vehicle: 'core' } }`, a barrier's cache holds one,
  // and four bosses drop one. All three of those write `Progress.foundSlots`,
  // and until now NOTHING READ IT.
  //
  // That is the mission-reward fault one level deeper: last run's fix paid the
  // reward into a field, and the field had no consumer, so the mission said
  // A SLOT and the garage still offered the same number of them. It survived
  // because `drive.js` asserted `foundSlots > 0` — which proves a counter went
  // up, not that a player got a slot.
  //
  // Capped by the vehicle, not by the count: earning a fourth slot does not
  // put four guns on a core. That is §6.3's "slots are per vehicle" as the
  // build already models it — one earned total, spent against whatever you are
  // driving.
  foundSlots() {
    return (typeof Progress !== 'undefined' && Progress.foundSlots)
      ? Math.max(0, Math.floor(Progress.foundSlots)) : 0;
  },
  slotCount(vehicleId) {
    return Math.min(this.slotCap(vehicleId),
                    this.earnedSources().length + this.foundSlots());
  },

  // ---- fitting -----------------------------------------------------------
  // What is fitted, per vehicle: Progress.permanents[vehicleId] = [variantId,...]
  fitted(vehicleId) {
    const all = (typeof Progress !== 'undefined' && Progress.permanents) || {};
    const list = (all[vehicleId] || []).slice(0, this.slotCount(vehicleId));
    return list;
  },

  // You MAY fit two of the same class. Player's choice, not a bug - so there
  // is deliberately no uniqueness check here.
  fit(vehicleId, slotIndex, variantId) {
    if (slotIndex < 0 || slotIndex >= this.slotCount(vehicleId)) return false;
    if (variantId !== null && !WEAPON_VARIANTS[variantId]) return false;
    if (variantId !== null && !this.owns(variantId)) return false;
    Progress.permanents = Progress.permanents || {};
    const list = (Progress.permanents[vehicleId] || []).slice();
    while (list.length < this.slotCount(vehicleId)) list.push(null);
    list[slotIndex] = variantId;
    Progress.permanents[vehicleId] = list;
    return true;
  },

  // What the player has FOUND. Permanents come from bosses, lairs, places and
  // story - never from a shop - so this is a found-list, not a purchase list.
  owns(variantId) {
    const o = (typeof Progress !== 'undefined' && Progress.permanentsOwned) || {};
    return !!o[variantId];
  },
  grant(variantId) {
    if (!WEAPON_VARIANTS[variantId]) return false;
    Progress.permanentsOwned = Progress.permanentsOwned || {};
    if (Progress.permanentsOwned[variantId]) return false;
    Progress.permanentsOwned[variantId] = true;
    if (typeof Progress !== 'undefined') Progress.save();
    return true;
  },
  ownedList() {
    const o = (typeof Progress !== 'undefined' && Progress.permanentsOwned) || {};
    return WEAPON_VARIANT_LIST.filter(k => o[k]);
  },

  // ---- putting them on the machine ---------------------------------------
  // Permanent sockets are ordinary sockets carrying a component whose part is
  // flagged permanent. Everything downstream - firing, heat, drawing, the
  // depth sort - works unchanged. What differs is enforced at three places
  // and no more: power cost, connector damage, and clearAll.
  applyTo(ent, vehicleId) {
    if (!ent || !ent.sockets) return 0;
    this.stripFrom(ent);
    const list = this.fitted(vehicleId || ent.jackrigId || 'jackal');
    let n = 0;
    for (const variantId of list) {
      if (!variantId) continue;
      const part = this.part(variantId);
      if (!part) continue;
      const id = ent._nextSocketId++;
      // Their own ring, outside the module sockets, so a permanent never
      // competes with stolen hardware for a mount.
      const angle = -Math.PI / 2 + (n / PERM.MAX_SLOTS) * Math.PI * 2 +
        (ent.rotRadians || 0);
      const s = { id, angle, angleTarget: angle, comp: null, permanent: true };
      ent.sockets.push(s);
      s.comp = new Component(variantId);
      s.comp.permanent = true;
      s.comp.online = true;
      n++;
    }
    if (n && typeof Machine !== 'undefined') {
      Machine.recalcPower(ent);
      Machine.recalcStats(ent);
    }
    return n;
  },

  stripFrom(ent) {
    if (!ent || !ent.sockets) return;
    ent.sockets = ent.sockets.filter(s => !s.permanent);
  },

  // Everything permanent currently on a machine.
  on(ent) {
    if (!ent || !ent.sockets) return [];
    return ent.sockets.filter(s => s.permanent && s.comp).map(s => s.comp);
  },
};

// ---------------------------------------------------------------------------
// 4.5 WEAPON CLASS SKILL — the counter, now. Block 10 builds what reads it.
//
// Costs almost nothing today and saves a save-format migration later, which is
// the entire reason it is here before anything uses it. Kills feed it; nothing
// spends it.
// CONTENT_ECONOMY Part 5, as data. Balance is data (rule 7), and a pass over
// these four numbers should be one edit rather than four call sites.
const SKILL_B = {
  BASE: 8,            // "kills to reach rank R = 8 * R^1.6"
  POWER: 1.6,
  MAX_RANK: 10,       // "soft cap at 10" — kills past it count and give nothing
  PER_RANK: {
    damage: 0.015,    // +1.5% a rank, +15% at ten
    fireRate: 0.02,   // "reload speed +2%"
    spread: -0.02,    // "accuracy (spread) -2%"
    heat: -0.015,     // "heat generated -1.5%"
  },
};

const WeaponSkill = {
  add(partId, n) {
    if (!partId) return 0;
    const cls = Permanents.classOf(partId);
    if (!PARTS[cls] || PARTS[cls].category !== 'weapon') return 0;
    Progress.weaponSkill = Progress.weaponSkill || {};
    Progress.weaponSkill[cls] = (Progress.weaponSkill[cls] || 0) + (n || 1);
    return Progress.weaponSkill[cls];
  },
  of(partId) {
    const cls = Permanents.classOf(partId);
    const w = (typeof Progress !== 'undefined' && Progress.weaponSkill) || {};
    return w[cls] || 0;
  },
  all() {
    return Object.assign({}, (typeof Progress !== 'undefined' &&
      Progress.weaponSkill) || {});
  },

  // =========================================================================
  // AND WHAT THE COUNTER IS FOR.
  //
  // "Costs almost nothing today and saves a save-format migration later" was
  // written above when this was three functions and a number. Block 10 came
  // and went and built the SPINE, which is the thing you BUY; §7's weapon
  // skill is the thing you EARN, and it is a different system that happens to
  // live next door:
  //
  //     "Weapon skill is per class, and it rises by using it. Kill with
  //      machine guns and EVERY machine gun improves — stolen and permanent
  //      alike. Nothing to spend."
  //
  // Every kill has been feeding this counter since Block 4 and NOTHING HAS
  // EVER READ IT. One of the game's four headline systems, running, invisible.
  //
  // CONTENT_ECONOMY Part 5 gives the curve and the four numbers, and they are
  // deliberately small: "about a 40% effective improvement at rank 10.
  // Meaningful, felt, and not so large that a rank-0 weapon is unusable."
  // =========================================================================

  // "kills to reach rank R = 8 * R^1.6", and the CUMULATIVE total to have
  // reached it. The document prints both columns and its own per-rank figures
  // drift from the formula by up to 15% at rank 10 (275 written, 318
  // computed); the formula is what it states as the rule, so the formula is
  // what this uses, and the cumulative is its running sum rather than a second
  // number that could disagree with it.
  killsFor(rank) {
    if (rank <= 0) return 0;
    let t = 0;
    for (let k = 1; k <= rank; k++) t += Math.round(SKILL_B.BASE * Math.pow(k, SKILL_B.POWER));
    return t;
  },

  rank(partId) {
    const n = this.of(partId);
    let r = 0;
    while (r < SKILL_B.MAX_RANK && n >= this.killsFor(r + 1)) r++;
    return r;
  },

  // Kills past rank 10 "still count and still show, but give nothing", so the
  // rank is capped and the counter is not.
  //
  // Four fields, four lines, and the sign of each is the one the document
  // gives: damage and fireRate go UP with rank, spread and heat go DOWN.
  mul(partId, field) {
    const r = this.rank(partId);
    if (!r) return 1;
    const per = SKILL_B.PER_RANK[field];
    if (per === undefined) return 1;
    return 1 + per * r;
  },
};

// ---------------------------------------------------------------------------
// THE FITTING SCREEN USED TO LIVE HERE (Block 4.4). Block 5 absorbed it into
// js/garagescreen.js as the PERMANENTS tab, and this file kept only the data
// and the rules — which is where they belonged all along.
//
// Deleted rather than left compiled: an orphaned screen is not the same as an
// orphaned SYSTEM. The Wardens stay because Block 14 will route to them; a
// second screen doing a job this codebase now does properly somewhere else
// would only ever be a thing to keep in sync.

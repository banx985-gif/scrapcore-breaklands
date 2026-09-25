// SCRAPCORE: BREAKLANDS — THE TEN BOSSES (content/draft_bosses.js, absorbed)
//
// A BOSS IS NOT A HEALTH BAR. It is a machine you take apart: no separate HP
// pool, it dies when its core dies, and every phase EMERGES from what you
// have destroyed. Every module on a boss is rippable MID-FIGHT.
//
// DATA ONLY: siting a lair, walking a roamer's route and wiring `onBreak` is
// BLOCK 14. What already exists is the thirteen boss-class machines — so
// `reuse` is bent to the Wardens registry's OWN names (uppercase), and
// `Wardens.create(BOSSES[id].reuse, ...)` works the day Block 14 asks.
// The districts name their boss too; tests/test_contentdata.js holds the two
// files in agreement so they cannot drift.
//
// Roamers: disengage when badly hurt, damage PERSISTS between encounters
// (save field roamerDamage{}), and they can be hunted down.
//
// The five-question checklist every boss must pass (Block 14 review):
// 1 rippable mid-fight? 2 breaking changes behaviour visibly within 1s?
// 3 discoverable solution? 4 requires flanking? 5 reward used in 10 hours?

const BOSSES = {
  // ======================= LAIRS =========================================
  crucible: {
    name: 'THE CRUCIBLE', kind: 'lair', district: 'ironworks', reuse: 'CRUCIBLE',
    layers: {
      outer: [{ part: 'heatVent', count: 4, on: 'beams' }],
      mid:   [{ part: 'flamethrower', count: 2 }, { part: 'mortar', mount: 'rotating' }],
      inner: [{ part: 'bigReactor', count: 2 }, { part: 'radiator', count: 3 },
              { part: 'heavyArmour', over: 'core' }],
    },
    onBreak: {
      heatVent:     'its cooked lane goes cold — a safe approach opens',
      flamethrower: 'both gone: stops zoning, starts chasing',
      radiator:     'it starts overheating ITSELF — 4s self-shutdowns. The discoverable solution.',
    },
    arena: 'molten channels, four cold lanes, lanes close as vents fire',
    drops: { prototype: 'crucibleCore', rigAbility: 'kiln', slot: 'core', colourSet: 'foundry' },
    lesson: 'attack the support systems, not the guns',
  },

  boremaw: {
    name: 'BOREMAW', kind: 'lair', district: 'digs', reuse: 'BOREMAW', expansion: true,
    layers: {
      outer: [{ part: 'drill', count: 2, on: 'arms' }],
      mid:   [{ part: 'shockwaveCannon' }, { part: 'heavyArmour', count: 4 }],
      inner: [{ part: 'bigReactor' }, { shield: 'opensWhenSurfaced' }],
    },
    onBreak: {
      drill:           'that arm gone: can only submerge in one direction',
      shockwaveCannon: 'surfacing stops throwing you into walls',
      heavyArmour:     'all gone: stays down longer, HEALING — a real cost for over-committing',
    },
    arena: 'soft ground it burrows, hard benches it cannot. Fight from the benches.',
    drops: { prototype: 'boremawDrill', slot: 'rig', weapon: 'dr_bore' },
    lesson: 'terrain is a weapon',
  },

  bailiff: {
    name: 'THE BAILIFF', kind: 'lair', district: 'neoncut', reuse: 'BAILIFF',
    layers: {
      outer: [{ part: 'directionalShield', count: 2, on: 'rotatingRing', facesYou: true }],
      mid:   [{ part: 'beamLaser', count: 2 }, { part: 'railgun' }, { part: 'pointDefence' }],
      inner: [{ part: 'bigReactor' }, { part: 'barrierProjector' }],
    },
    onBreak: {
      directionalShield: 'ring rotates slower; a permanent gap opens',
      pointDefence:      'your projectiles land again',
      barrierProjector:  'its summoned MARSHALs stop being shielded',
    },
    arena: 'a plaza with pillars — break line of sight, come from behind',
    drops: { prototype: 'lockdownProjector', slot: 'core', gadgetRank: ['cutter', 2] },
    lesson: 'the whole game, restated. Flank or lose.',
  },

  kingmaker: {
    name: 'THE KINGMAKER', kind: 'lair', district: 'stacks', reuse: 'KINGMAKER', expansion: true,
    layers: {
      outer: [{ part: 'splitter', count: 2, carrying: 3 }],   // cut a branch, three fall
      mid:   [{ part: 'cannon' }, { part: 'flakCannon' }, { part: 'arcGun' },
              { part: 'repairArm', count: 2 }],
      inner: [{ part: 'bigReactor', count: 3 }, { part: 'heavyArmour', count: 4 }],
    },
    onBreak: {
      splitter:   'EVERYTHING past the beam falls at once — the branches lesson, used against it',
      repairArm:  'stops rebuilding what you broke',
      bigReactor: 'two gone: half its weapons go dark',
    },
    arena: 'a rooftop with edges. Falling costs health and a climb, not a death.',
    drops: { prototype: 'crownSingularity', slot: 'rig', colour: 'kingmakerGold' },
    lesson: 'branches are fragility. Yours too.',
  },

  stitcher: {
    name: 'THE STITCHER', kind: 'lair', district: 'sumpworks', reuse: 'STITCHER', expansion: true,
    layers: {
      outer: [{ part: 'repairArm', count: 4, on: 'booms' }],
      mid:   [{ part: 'harpoon', count: 2, drags: 'wrecks' }],
      inner: [{ part: 'bigReactor' }, { part: 'barrierProjector' }],
    },
    onBreak: {
      repairArm: 'rebuilds slower; ALL four gone: it stops entirely and is trivial',
      harpoon:   'stops collecting corpses',
    },
    arena: 'flooded, littered with the wrecks you made on the way in — its ammunition',
    drops: { prototype: 'stitcherArm', chassis: 'diver', gadgetRank: ['seal', 3] },
    lesson: 'destroy the support before the threat',
  },

  dispatcher: {
    name: 'THE DISPATCHER', kind: 'final', district: 'dispatch', reuse: 'RECLAIMER',
    // IT HAS NO WEAPONS. It allocates. Pylons build and send every enemy in
    // the game in ascending quality until broken. Resist every instinct to
    // give it a laser — if the finale sags, add MORE PRODUCTION.
    layers: {
      outer: [],
      mid:   [{ pylon: 'dispatch', count: 4, builds: 'ascendingRoster' }],
      inner: [{ core: 'allocation', defenceless: true }],
    },
    onBreak: {
      pylon: 'one fewer production line; all four: SILENCE, and a walk to a core that does nothing to stop you',
    },
    arena: 'clean, white, lit, intact — the only unbroken place in the world',
    drops: { ending: true },
    lesson: 'there was never anyone to fight',
  },

  // ======================= ROAMERS =======================================
  reaper: {
    name: 'THE REAPER', kind: 'roamer', district: 'grows', reuse: 'WARMAKER', expansion: true,
    // Not hostile until damaged — it's doing its job and you're in the way.
    // The whole theme in one machine.
    hostileOnlyIfDamaged: true,
    threat: 'a wall of rotating blades, charges in straight lines',
    onBreak: { blades: 'cannot charge', treads: 'cannot turn', bigReactor: 'blades stop' },
    disengage: 'returns to its row and keeps harvesting — find it again by following the rows',
    drops: { prototype: 'reaperBlade', chassisLocation: 'cheetah' },
  },
  roadblock: {
    name: 'ROADBLOCK', kind: 'roamer', district: 'sprawl', reuse: 'ROADBLOCK',
    threat: 'blocks streets, herds you into ambushes it has set',
    onBreak: { barricadePlates: 'routes open', shockwaveCannon: 'stops kicking you back in' },
    disengage: 'withdraws to a junction and rebuilds its plates',
    drops: { prototype: 'roadblockRam', slot: 'rig' },
  },
  engine: {
    name: 'THE ENGINE', kind: 'roamer', district: 'railspine', reuse: 'DYNAMO', expansion: true,
    threat: 'rail-bound and faster than you — and there is rail everywhere',
    onBreak: { arcPylons: 'stops chaining', wheelsets: 'slows', reactor: 'stops' },
    disengage: 'runs to a depot and repairs',
    drops: { prototype: 'dynamoCoil', chassis: 'hauler' },
  },
  patchwork: {
    name: 'PATCHWORK', kind: 'roamer', district: 'barrens', reuse: 'PATCHWORK',
    // THE HOOK THAT MUST SURVIVE TO SHIP: if it kills you, the parts you lost
    // appear ON IT next time. Needs the death system to record what was lost
    // (SAVE_FORMAT: wreckMarker contents feed wearsPlayerLosses).
    threat: 'built from everything it has killed — different loadout every meeting',
    wearsPlayerLosses: true,
    everyPartRippable: true,
    // IT HAD NO PHASES AT ALL. The one boss a player meets over and over —
    // the roamer that comes to you, wearing what it took — was the only one of
    // the ten with an empty onBreak, so every meeting was the same fight with
    // a different loadout. These three are what PATCHWORK is: legs, the thing
    // that keeps it together, and the stolen skin.
    onBreak: {
      heavyTreads: 'cannot come round — get behind it and stay there',
      repairArm: 'stops patching itself; what it stole starts falling off',
      armourPlate: 'all gone: the skin it took off you is off it',
    },
    disengage: 'wanders off to scavenge, comes back with new parts',
    drops: { prototype: 'patchworkNode', chassisLocation: 'shrike', colour: 'patchworkMixed' },
  },
};
const BOSS_LIST = Object.keys(BOSSES);

// Alert stage 3 dispatch table — a boss ARRIVES (from a direction, audibly,
// ~15s — long enough to run for a garage), never spawns in front of you.
const BOSS_DISPATCH = {
  grows: 'reaper', sprawl: 'roadblock', railspine: 'engine', default: 'patchwork',
};

// A layer part that is not a player part is a SUBSTITUTION, exactly like the
// enemy roster's five (`ENEMY_PART_SUBS`) — recorded so the content pass can
// decide whether it should become a real module instead.
const BOSS_PART_SUBS = {
  heatVent: 'radiator',     // a world hazard mounted on beams; the nearest
                            // real module is the cooling it exists to do
  // ---- THE FOUR ROAMERS' OWN VOCABULARY ---------------------------------
  // A roamer is described by what it DOES, not by a socket list, so its parts
  // are named in prose in `onBreak` and none of them are player parts. Each
  // maps to the nearest module that behaves the same way, which is the same
  // argument `heatVent -> radiator` makes.
  blades:          'saw',          // a wall of rotating blades IS a saw ring
  treads:          'heavyTreads',
  wheelsets:       'heavyTreads',  // rail-bound, but it is still what rolls
  barricadePlates: 'heavyArmour',  // the plates it closes streets with
  arcPylons:       'railgun',      // the chaining is not built; the reach is
  reactor:         'bigReactor',
};

// ---------------------------------------------------------------------------
// WHAT A ROAMER IS MADE OF.
//
// The six lair bosses are described in three rings. The four roamers are not:
// their data says what they DO and lists what comes off them, which is the
// right way round for a machine you meet in the open — but it left them with
// no socket list, so `boss_patchwork` built a machine with nothing on it and
// alert stage 3 had nothing to send.
//
// Built from THEIR OWN `onBreak` KEYS. Those are exactly the parts the content
// says you can break off, so a roamer is made of the things it is described by
// and nothing has been invented here. Ring assignment follows the same rule
// the lairs use: what you reach first is outer.
const ROAMER_LAYERS = {
  reaper: {
    outer: [{ part: 'blades', count: 2 }, { part: 'treads', count: 2 }],
    mid:   [{ part: 'heavyArmour', count: 2 }],
    inner: [{ part: 'bigReactor', count: 2 }],
  },
  roadblock: {
    outer: [{ part: 'barricadePlates', count: 4 }],
    mid:   [{ part: 'shockwaveCannon', count: 2 }],
    inner: [{ part: 'bigReactor' }, { part: 'heavyArmour' }],
  },
  engine: {
    outer: [{ part: 'arcPylons', count: 2 }, { part: 'wheelsets', count: 2 }],
    mid:   [{ part: 'heavyArmour', count: 2 }],
    inner: [{ part: 'reactor', count: 2 }],
  },
  // PATCHWORK IS THE EXCEPTION AND IT IS SUPPOSED TO BE.
  //
  //   "built from everything it has killed - different loadout every meeting"
  //   `wearsPlayerLosses: true`
  //
  // Its real loadout is YOUR LOST PARTS, which needs the death system to hand
  // over what the wreck marker held (SAVE_FORMAT). Until that exists it wears
  // a scavenger's mixed bag - deliberately mismatched, because that is the
  // read even when the parts are not yours yet - and `Bosses.unbuilt()`
  // reports the hook as outstanding rather than letting it look finished.
  patchwork: {
    outer: [{ part: 'armourPlate', count: 2 }, { part: 'saw' },
            { part: 'machineGun' }],
    mid:   [{ part: 'cannon' }, { part: 'heavyTreads' },
            { part: 'repairArm' }],
    inner: [{ part: 'bigReactor' }, { part: 'heavyArmour' }],
  },
};

const Bosses = {
  get(id) { return BOSSES[id]; },
  list() { return BOSS_LIST.slice(); },

  // Every part a boss layer asks for. `pylon:`/`core:`/`shield:` rows are
  // structure notes, not modules, and are not parts by design.
  layerParts(id) {
    const out = [];
    const L = BOSSES[id].layers || {};
    for (const ring of Object.keys(L)) {
      for (const row of L[ring]) if (row.part) out.push(row.part);
    }
    return out;
  },

  // The honest report, same shape as Enemies.substitutions(): which layer
  // parts are not real player parts, and what stands in. Anything here that
  // is ALSO missing from BOSS_PART_SUBS is a typo, and the test fails on it.
  substitutions() {
    const out = {};
    for (const id of BOSS_LIST) {
      for (const p of this.layerParts(id)) {
        if (typeof PARTS !== 'undefined' && PARTS[p]) continue;
        out[p] = BOSS_PART_SUBS[p] || null;
      }
    }
    return out;
  },

  // =========================================================================
  // WHAT A BOSS HANDS OVER — and until now, nothing at all.
  //
  // Every one of the ten wrote a `drops` record. `.drops` was read in exactly
  // one place in the whole of js/, in enemies.js, about a completely different
  // thing (the tier tag on a patrol). Ten bosses, thirty-one payouts, no
  // reader — the mission-reward hole again, in the other half of the game, and
  // this one takes in the CUTTER 2 that two shipping missions require and the
  // KILN whose chassis a third one points at.
  //
  // It hid from tools/payouts.js Part 1 for a reason worth writing down: that
  // sweep asks whether a NAME is read anywhere, and `drops` is. Part 2 asks
  // whether the name is read BY THE THING THAT SHOULD PAY IT, which is the
  // only version of the question that finds this.
  //
  // Written HERE, beside the table, for the same reason `MissionRun.pay` sits
  // beside the missions: the payer and the promise should be readable in one
  // sitting. Every branch writes through the record that already exists.
  // =========================================================================
  paid(id) {
    const p = (typeof Progress !== 'undefined' && Progress.bossesPaid) || {};
    return !!p[id];
  },

  payDrops(id) {
    const b = BOSSES[id];
    if (!b || !b.drops) return null;
    if (typeof Progress === 'undefined') return null;
    // ONCE. A roamer you beat, let go, and beat again is one trophy, and a
    // save reloaded on top of a dead boss must not pay a second time.
    Progress.bossesPaid = Progress.bossesPaid || {};
    if (Progress.bossesPaid[id]) return null;
    Progress.bossesPaid[id] = true;

    // NO XP HERE. A boss dies through the ordinary `enemyKilled` event like
    // everything else — `enemy.js` sets `boss: !!this.bossId` on it, which is
    // the same flag `killScrap` has used for its 900 since Block 3 — so
    // `Salvage.killXp` already pays the 3,000. Paying it here as well would
    // hand it over twice, and the second one would be invisible.
    const d = b.drops, got = [];
    const nameOf = (pid) => (typeof PARTS !== 'undefined' && PARTS[pid])
      ? PARTS[pid].name : String(pid).toUpperCase();

    // THE PROTOTYPE. Through Proto.own, which is the one writer of
    // `Progress.protoOwned` and the record every prototype rule already reads.
    // A prototype naming a part that does not exist is NOT granted and IS
    // reported — two of them do (REAPER's blade, BOREMAW's bore variant), both
    // in districts that do not ship, and a silent grant of nothing is how that
    // stays invisible until somebody ships the district.
    if (d.prototype) {
      if (typeof PARTS !== 'undefined' && PARTS[d.prototype] &&
          typeof Proto !== 'undefined' && Proto.own) {
        if (Proto.own(d.prototype)) got.push(nameOf(d.prototype));
      }
    }
    // A PERMANENT WEAPON. `weapon:` is the variant id, the same key
    // `MissionRun.pay` calls `permanentWeapon`.
    if (d.weapon && typeof Permanents !== 'undefined' && Permanents.grant) {
      if (Permanents.grant(d.weapon)) got.push(nameOf(d.weapon));
    }
    // A SLOT. Into `Progress.foundSlots`, which `Permanents.slotCount` now
    // reads. `'core'` and `'rig'` say which vehicle the design had in mind;
    // the build spends one earned slot against whatever you are driving, and
    // caps it by that vehicle's size, so the word is kept for the record and
    // does not change what happens.
    if (d.slot) {
      Progress.foundSlots = (Progress.foundSlots || 0) + 1;
      got.push('A SLOT');
    }
    // A RIG. `chassis` hands one over, `chassisLocation` says where one is,
    // and `rigAbility` is the ability that makes one worth having — and since
    // a rig's ability is not separately lockable in this build, all three land
    // on Rigs.grant, which owns `Progress.rigsOwned`. That is the same
    // decision MissionRun.pay already made for its two spellings.
    for (const rig of [d.chassis, d.chassisLocation, d.rigAbility]) {
      if (!rig || typeof Rigs === 'undefined' || !Rigs.grant) continue;
      if (Rigs.grant(rig)) {
        got.push((typeof RIGS !== 'undefined' && RIGS[rig])
          ? RIGS[rig].name : String(rig).toUpperCase());
      }
    }
    // A GADGET RANK, ['cutter', 2]. Into Progress.gadgets, which every barrier
    // gate reads. THE BAILIFF IS THE ONLY SOURCE OF CUTTER 2 IN THE GAME and
    // two shipping missions require it, so this line is a gate, not a bonus.
    if (Array.isArray(d.gadgetRank)) {
      const [g, rank] = [d.gadgetRank[0], d.gadgetRank[1] || 1];
      Progress.gadgets = Progress.gadgets || {};
      if ((Progress.gadgets[g] || 0) < rank) {
        Progress.gadgets[g] = rank;
        got.push(String(g).toUpperCase() + ' ' + rank);
      }
    }
    // PAINT. A whole set, or one trophy colour out of the PROTOTYPE set.
    if (d.colourSet) {
      Progress.paintOwned = Progress.paintOwned || {};
      Progress.paintOwned['colourset:' + d.colourSet] = true;
      got.push(String(d.colourSet).toUpperCase());
    }
    if (d.colour) {
      Progress.paintOwned = Progress.paintOwned || {};
      Progress.paintOwned['colour:' + d.colour] = true;
      got.push(String(d.colour).toUpperCase());
    }
    // AND THE ENDING. One boss, one flag, and the story layer reads it.
    if (d.ending) {
      Progress.endingReached = true;
      got.push('THE ENDING');
    }
    if (typeof Progress.save === 'function') Progress.save();
    return got;
  },

  // The honest report, same shape as the other unbuilt lists: which drops name
  // a part that does not exist, and so would be granted to nobody.
  unpayableDrops() {
    const out = {};
    for (const id of BOSS_LIST) {
      const d = (BOSSES[id] || {}).drops || {};
      for (const key of ['prototype', 'weapon']) {
        const pid = d[key];
        if (!pid) continue;
        if (typeof PARTS !== 'undefined' && PARTS[pid]) continue;
        out[id] = (out[id] || []).concat(key + ':' + pid);
      }
    }
    return out;
  },
};

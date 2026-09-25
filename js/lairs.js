// SCRAPCORE: BREAKLANDS — BLOCK 14: LAIRS
//
// "One sealed lair the player can walk into and commit."
//
// ---------------------------------------------------------------------------
// A LAIR IS AN INTERIOR DISTRICT.
//
// That is the whole design decision and everything else follows from it. The
// alternative was a bespoke arena mode, and it would have meant a second
// renderer, a second streaming path, a second population system and a second
// way for entities to exist — four systems that already work, rebuilt worse.
//
// Instead a lair is a district with `interior: true`: three chunks square,
// hand-authored, entered through a door that stands in the world like a
// district gate, and streamed, drawn, populated and collided by the same code
// as everywhere else. `DistrictGen.make` takes it without knowing it is a
// lair.
//
// AND IT IS WHERE THE HAZARDS LIVE NOW. The open world has none (D191-D195):
// everything that moves or fires is in here, hand-placed, because a press in
// a press shop is a press shop and a press in a field is confetti. The
// Crucible's floor IS the fight — molten ground with four cold lanes through
// it — and that is exactly the kind of thing that was never legible while the
// same hazards were scattered across every chunk of every district.
//
// ---------------------------------------------------------------------------
// SEALED MEANS SEALED.
//
// draft_lairs.js says `escapeIfLost: 'none — sealed'` for every one of the six.
// You go in on purpose, the door shuts, and the only ways out are winning and
// dying. The door back is spawned only when the boss is dead, which means the
// commitment is real and not a prompt asking whether you are sure.

// The six lairs, from content/draft_lairs.js. All six arenas are built.
//
// ARENA FIRST, BOSS SECOND — the draft's own instruction, and the reason each
// of these entries is mostly terrain:
//
//   "EVERY BOSS'S SOLUTION LIVES IN ITS ARENA. Ship a boss into a flat box and
//    its whole design evaporates."
//
// So the order of work per lair was: read what the fight is supposed to teach,
// build the ground that teaches it, and only then stand the machine in the
// middle of it. Where a draft feature has no system behind it, the arena still
// says what it is FOR and `Lairs.unbuiltFeatures()` reports the gap, because a
// room that looks like a puzzle and is not one is worse than an honest box.
//
// FOUR OF THE SIX STAND IN DISTRICTS THAT DO NOT SHIP YET. Their mouths are
// authored at their drafted positions and simply never get placed, because
// game.js only places a mouth for `L.district === World.district.id`. They are
// dormant, not broken, and `Lairs.unreachable()` counts them.
const LAIRS = {
  crucible: {
    id: 'crucible',
    terrain: ['furnace'], pool: 'foundry',
    name: 'HALL ONE',
    boss: 'crucible',
    district: 'ironworks',
    at: [4, 4],                    // where its mouth stands in the world
    cols: 3, rows: 3,              // big enough to run, small enough to corner
    approach: 'a pour aisle, glowing at the far end. The furnace is LOUD ' +
              'before you see it.',
    teaches: 'attack the support systems, not the guns',

    // THE FIGHT IS THE FLOOR. Molten ground covering most of it with four
    // COLD LANES through — each lane is the approach a heat vent cooks. The
    // lanes are laid out radially from the middle because the boss stands in
    // the middle, and the whole arena is therefore a question about which way
    // you come at it from.
    //
    // Hand-placed, in chunk-local coordinates, because a lair is Layer 1 all
    // the way down: nothing in here is scattered from a seed.
    hazards: {
      // The molten floor, as four broad bands with gaps between them. Molten
      // ground is TERRAIN — it is the ground, and it is the one hazard class
      // that was always allowed to be underfoot.
      '1,0': { lanes: [[200, 900, 2600, 700]] },
      '0,1': { lanes: [[600, 200, 700, 2600]] },
      '2,1': { lanes: [[1700, 200, 700, 2600]] },
      '1,2': { lanes: [[200, 1400, 2600, 700]] },
      // The pour spouts the draft names, on the middle chunk with the boss.
      // These are ACTIVE hazards and this is where an active hazard belongs.
      '1,1': {
        vents: [[700, 700, 190, 0], [2300, 2300, 190, 0.5]],
        plates: [[1300, 400, 460, 460, 0.25], [1300, 2200, 460, 460, 0.75]],
      },
    },

    // THE BOSS, standing in the middle. Placed exactly like any other placed
    // machine, because it IS one: a machine you take apart.
    bossAt: { chunk: '1,1', x: 1536, y: 1536 },
  },

  // =======================================================================
  // THE BAILIFF — CIVIC PLAZA, NEON CUT. The only one of the five that is
  // reachable today, because Neon Cut is one of the shipping six.
  //
  // "PILLARS ARE THE FIGHT. The shield ring always faces you, so the only way
  //  in is to break line of sight and come from behind. The arena is pillars
  //  and nothing else — this is the game's flanking lesson at boss scale, and
  //  it must be almost pure."
  //
  // TWO CHUNKS. The smallest lair in the game, on purpose: you cannot kite a
  // thing that always faces you, so the arena refuses to let you try.
  //
  // The pillars are OBSTACLES, not a new class, because `type: 'pillar'` has
  // blocked line of sight in Population._lineOfSight since Block 2. The whole
  // Bailiff fight was already in the engine and nothing had ever asked for it.
  bailiff: {
    id: 'bailiff',
    terrain: ['alleys'], pool: 'coreworks',
    name: 'CIVIC PLAZA',
    boss: 'bailiff',
    district: 'neoncut',
    at: [4, 20],
    cols: 2, rows: 2,
    approach: 'a colonnade, wet, lit magenta. It is already facing the door.',
    teaches: 'the whole game, restated. Flank or lose.',

    // EIGHT PILLARS IN A RING, AND THE BOSS IN THE MIDDLE OF IT.
    //
    // The first pass put the ring round the geometric centre of the room and
    // the boss at the centre of a chunk, which are not the same point in a
    // two-by-two: the Bailiff ended up standing OUTSIDE its own colonnade and
    // the whole flanking lesson evaporated. A screenshot found it. The ring
    // and the boss are now both built off one authored centre.
    //
    //   centre (3272, 3272)   radius 1150   eight pillars, 45 degrees apart
    //
    // Radius chosen so the gaps are wider than a machine and narrower than a
    // firing line: you can always get through, and never straight through.
    obstacles: {
      '1,1': [['pillar', 1350, 200, 210], ['pillar', 1013, 1013, 210],
              ['pillar', 200, 1350, 210],
              // The fountain: low, round, outside the ring. One thing that is
              // not a column, so the room reads as a plaza and not as a test
              // chamber.
              ['pillar', 200, 2128, 150]],
      '0,1': [['pillar', 2459, 1013, 210], ['pillar', 2122, 200, 210]],
      '0,0': [['pillar', 2459, 2459, 210]],
      '1,0': [['pillar', 200, 2122, 210], ['pillar', 1013, 2459, 210]],
    },
    hazards: {
      // Two laser gates BETWEEN pillars, east and west, so the flat lane
      // round the ring costs you something and the flank has to be chosen
      // rather than found.
      '0,1': { lasers: [[2700, 200, 1.5708, 1100, 0.0]] },
      '1,1': { lasers: [[778, 200, 1.5708, 1100, 0.5]] },
      // AND THE COLONNADE. One pylon, because the Bailiff summons MARSHALs
      // and the draft is specific: every 25s, at most four, from the
      // colonnade. Break the pylon and the reinforcements stop, which is the
      // same lesson its own barrier projector teaches.
      '0,0': { pylons: [[1200, 1200, ['marshal'], 25, 4]] },
    },
    bossAt: { chunk: '1,1', x: 200, y: 200 },
  },

  // =======================================================================
  // BOREMAW — THE SINK, THE DIGS. Dormant: The Digs does not ship yet.
  //
  // "SOFT vs HARD is the whole fight. Boremaw burrows soft ground and cannot
  //  surface through the benches. Fighting from the benches is the answer and
  //  the arena must make that obvious without a prompt."
  //
  // The soft floor is ROUGH GROUND — it slows you, which is the readable
  // consequence of standing on ground a thing can come up through, and the
  // benches are the parts that do not. The burrow behaviour itself is not
  // built (there is no submerging AI), and `unbuiltFeatures()` says so: the
  // arena teaches the right lesson today and gets its teeth when the AI lands.
  boremaw: {
    id: 'boremaw',
    terrain: ['collapse'], pool: 'yard',
    name: 'THE SINK',
    boss: 'boremaw',
    district: 'digs',
    at: [10, 8],
    cols: 4, rows: 4,
    approach: 'a haul road spiralling down. You hear it moving UNDER you.',
    teaches: 'terrain is a weapon',
    needs: { district: 'digs', feature: 'a burrowing AI - the boss surfaces ' +
             'and submerges, and no brain does that yet' },

    hazards: {
      // SOFT GROUND, most of the pit. Big patches, because the point is that
      // the safe ground is the exception.
      '1,1': { rough: [[200, 200, 2600, 2600]] },
      '2,1': { rough: [[200, 200, 2600, 2600]] },
      '1,2': { rough: [[200, 200, 2600, 2600]] },
      '2,2': { rough: [[200, 200, 2600, 2600]],
               // Collapses, triggered by the boss surfacing in the draft;
               // on a cycle until that exists.
               collapses: [[300, 300, 2400, 2400, 0.3]] },
      '0,2': { rough: [[600, 200, 2400, 2600]] },
      '3,1': { rough: [[200, 200, 2400, 2600]] },
    },
    // THE BENCHES. Hard ground it cannot come through, connected by ramps,
    // and the answer to the fight. Ore pillars for cover between them.
    obstacles: {
      '0,1': [['pillar', 1200, 1536, 320], ['pillar', 2100, 900, 260]],
      '3,2': [['pillar', 1400, 1536, 320], ['pillar', 800, 2200, 260]],
      '2,0': [['pillar', 1536, 1900, 320], ['pillar', 900, 1200, 260]],
      '1,3': [['pillar', 1536, 900, 320]],
    },
    bossAt: { chunk: '2,2', x: 1536, y: 1536 },
  },

  // =======================================================================
  // THE KINGMAKER — ROOF PLANT, TOWER ONE, THE STACKS. Dormant.
  //
  // "EDGES. You can be knocked off — costing health and a climb, NOT a death.
  //  That single decision is what makes a rooftop boss fun instead of
  //  infuriating."
  //
  // The whole arena is that sentence. `OpenEdge` never kills: a quarter of
  // your health, back at the stairhead, twelve seconds of the fight gone.
  kingmaker: {
    id: 'kingmaker',
    terrain: ['presses'], pool: 'coreworks',
    name: 'ROOF PLANT, TOWER ONE',
    boss: 'kingmaker',
    district: 'stacks',
    at: [4, 4],
    cols: 2, rows: 2,
    approach: 'a service stair, then open sky and wind. It is the tallest ' +
              'thing up here.',
    teaches: 'branches are fragility - yours too',
    needs: { district: 'stacks' },

    hazards: {
      // THE PERIMETER. Four edges, all of them putting you back at the
      // stairhead in the south-west chunk, which is where you came in.
      '0,0': { edges: [[0, 0, 3072, 340, 1536, 5400],
                       [0, 0, 340, 3072, 1536, 5400]] },
      '1,0': { edges: [[0, 0, 3072, 340, -1536, 5400],
                       [2732, 0, 340, 3072, -1536, 5400]] },
      '0,1': { edges: [[0, 2732, 3072, 340, 1536, 2400],
                       [0, 0, 340, 3072, 1536, 2400]] },
      '1,1': { edges: [[0, 2732, 3072, 340, -1536, 2400],
                       [2732, 0, 340, 3072, -1536, 2400]],
               // Pulse emitters on the plant housings, as the draft asks.
               pulses: [[900, 900, 520, 0.0], [2200, 2200, 520, 0.5]] },
    },
    // Plant housings for cover, and two aerial masts.
    obstacles: {
      '0,0': [['pillar', 1800, 1800, 280]],
      '1,0': [['pillar', 1100, 1900, 280], ['pillar', 2000, 800, 200]],
      '0,1': [['pillar', 1900, 1000, 280]],
      '1,1': [['pillar', 1100, 1100, 280]],
    },
    bossAt: { chunk: '1,0', x: 1536, y: 1900 },
  },

  // =======================================================================
  // THE STITCHER — BASIN THREE, THE SUMPWORKS. Dormant.
  //
  // "THE ARENA IS LITTERED WITH THE WRECKS YOU MADE ON THE WAY IN. The
  //  Stitcher rebuilds them."
  //
  // That hook needs the district to hand the lair a list of what the player
  // killed getting here, and the draft calls it "the single best idea in the
  // lair set". It is not built and is reported. What IS built is the ground
  // the idea sits on: water that slows and walkways that do not, so the fast
  // route and the short route are different routes.
  stitcher: {
    id: 'stitcher',
    terrain: ['collapse'], pool: 'foundry',
    name: 'BASIN THREE',
    boss: 'stitcher',
    district: 'sumpworks',
    at: [6, 24],
    cols: 3, rows: 3,
    approach: 'a flooded gantry. Something large is moving wreckage below you.',
    teaches: 'destroy the support before the threat',
    needs: { district: 'sumpworks',
             feature: 'seedsFromApproach - the lair is meant to be littered ' +
                      'with the wrecks you made getting to it' },

    hazards: {
      '0,0': { water: [[200, 200, 2800, 2800]] },
      '1,0': { water: [[0, 200, 3072, 2800]] },
      '2,0': { water: [[0, 200, 2800, 2800]] },
      '0,1': { water: [[200, 0, 2800, 3072]],
               arcs: [[1400, 1536, 0.0]] },
      '1,1': { water: [[0, 0, 3072, 1100]],
               arcs: [[700, 500, 0.33], [2400, 500, 0.66]] },
      '2,1': { water: [[0, 0, 2800, 3072]] },
      '0,2': { water: [[200, 0, 2800, 2800]] },
      '1,2': { water: [[0, 0, 3072, 2800]] },
      '2,2': { water: [[0, 0, 2800, 2800]] },
    },
    // The walkways: dry ground you can stand on, laid as a cross through the
    // basin so there is always a dry route and it is never the direct one.
    obstacles: {
      '1,1': [['pillar', 700, 2200, 260], ['pillar', 2400, 2200, 260]],
      '0,1': [['pillar', 2600, 1536, 240]],
      '2,1': [['pillar', 500, 1536, 240]],
    },
    bossAt: { chunk: '1,1', x: 1536, y: 2000 },
  },

  // =======================================================================
  // THE DISPATCHER — ALLOCATION FLOOR, CENTRAL DISPATCH. Dormant.
  //
  // "NO WEAPONS ON THE BOSS. Four pylons build and send the entire enemy
  //  roster in ASCENDING order of quality until you break them. The arena is
  //  clean, white, lit and intact — and that is the horror."
  //
  // The last room in the game, and the only fight in it that is not a fight:
  // `teaches: 'there was never anyone to fight'`. The four pylons are real,
  // they escalate, and breaking all four leaves silence and a walk.
  dispatcher: {
    id: 'dispatcher',
    terrain: ['testyard'], pool: 'coreworks',
    name: 'ALLOCATION FLOOR',
    boss: 'dispatcher',
    district: 'dispatch',
    at: [4, 4],
    cols: 3, rows: 3,
    approach: 'a corridor of screens showing every district you have ' +
              'crossed. Live.',
    teaches: 'there was never anyone to fight',
    needs: { district: 'dispatch' },

    hazards: {
      // FOUR PYLONS, one per corner, each sending worse-to-better. Twelve
      // seconds rather than twenty-five: four lines running at once is the
      // point, and the Bailiff's single pylon is the slow version.
      '0,0': { pylons: [[2200, 2200, ['picker', 'stacker', 'marshal'], 12, 3]],
               fields: [[2200, 2200, 460, 0.0]] },
      '2,0': { pylons: [[900, 2200, ['picker', 'grabber', 'marshal'], 12, 3]],
               fields: [[900, 2200, 460, 0.25]] },
      '0,2': { pylons: [[2200, 900, ['stacker', 'sweep', 'knock'], 12, 3]],
               fields: [[2200, 900, 460, 0.5]] },
      '2,2': { pylons: [[900, 900, ['stacker', 'knock', 'stalk'], 12, 3]],
               fields: [[900, 900, 460, 0.75]] },
    },
    // Server rows. Indestructible cover, in ranks, because the room is a
    // working office and the horror is that it still works.
    obstacles: {
      '1,0': [['pillar', 800, 1400, 240], ['pillar', 2300, 1400, 240]],
      '0,1': [['pillar', 1400, 800, 240], ['pillar', 1400, 2300, 240]],
      '2,1': [['pillar', 1700, 800, 240], ['pillar', 1700, 2300, 240]],
      '1,2': [['pillar', 800, 1700, 240], ['pillar', 2300, 1700, 240]],
    },
    bossAt: { chunk: '1,1', x: 1536, y: 1536 },
  },
};

// LAIRS_TODO is gone. It listed five rooms that did not exist; all six now do,
// and what is left is a different and smaller shape of debt — four of them
// stand in districts that have not shipped, and two want a system nobody has
// written. Both are reported by `Lairs.unreachable()` and
// `Lairs.unbuiltFeatures()` rather than by a hand-maintained list that could
// drift away from the truth.

const Lairs = {
  // Built lazily and cached: a lair is a district and districts are objects
  // the runtime holds by reference, so building one twice would give the
  // player two different rooms with the same name.
  _built: {},

  district(id) {
    if (this._built[id]) return this._built[id];
    const L = LAIRS[id];
    if (!L || typeof DistrictGen === 'undefined') return null;

    const spec = {
      id: 'lair_' + id,
      name: L.name,
      // AND WHOSE GROUND IT IS. `Outdoors.palette` looks its district up in
      // DISTRICT_LOOKS by id, and there is no entry for 'lair_crucible' --
      // so every boss hall in the game fell through to the legacy
      // hand-written Ironworks table and came out as flat brown. The
      // Crucible's whole fight is "the floor is molten and the cold lanes
      // close" and its hall had the FLATTEST ground in BREAKLANDS, which is
      // the same fault the Ironworks itself had, one room further in.
      //
      // A lair is INSIDE its district and should read as inside it, so it
      // wears that district's look. One field, read in one place.
      lookId: L.district,
      cols: L.cols, rows: L.rows,
      spawn: { cx: Math.floor(L.cols / 2), cy: L.rows - 1, x: 1536, y: 2700 },
      // The Ironworks' own pool. Named from SPAWN_POOLS, not from the
      // district id - they are different vocabularies and using one for the
      // other is a crash the moment anything tries to spawn.
      spawnPool: L.pool || 'foundry',
      density: 0,                    // NOTHING is generated in here. Layer 1 only.
      // THE FLOOR THE ARENA IS MADE OF. A lair that inherits a default looks
      // like the district outside it, which is exactly wrong for a room you
      // committed to walk into.
      terrain: L.terrain || ['furnace'],
      props: [],
      hazards: [],
      // SEALED. No exits at all until the boss is dead, at which point the
      // way out is spawned by hand. This is the commitment.
      exits: [],
      interior: true,
      sealed: true,
      // A ROOM HAS WALLS, NOT A COASTLINE.
      //
      // `World.inDistrict` bites chunks out of a district's edge to give it an
      // uneven silhouette, which is exactly right for a place you drive across
      // and exactly wrong for a hall you walked into. It only ever bites the
      // outer two rings — and a lair is two or three chunks square, so EVERY
      // chunk of one is an edge chunk.
      //
      // THE CRUCIBLE HAS BEEN LOSING CORNERS OF ITS OWN BOSS HALL since the
      // day it shipped: a third of its edge chunks were rolled out of the
      // district at random, and the Bailiff's two-by-two plaza lost the
      // quarter with the boss standing in it. Found by a screenshot with a
      // missing pillar ring in it, because no assertion in the tree asks
      // whether a room is all there.
      rectangular: true,
      lairOf: id,
      garages: [],
      placed: {},
      barriers: {},
      chassis: {},
      story: {},
      findsAt: {},
      shortcuts: [],
      elites: [],
      finds: [],
      layout: { kind: 'open' },
    };
    // The boss, as a placed machine row: [x, y, id, build, reward, permanent].
    spec.placed[L.bossAt.chunk] = [[L.bossAt.x, L.bossAt.y,
      'boss_' + id, 'boss_' + id, null, null]];

    const d = DistrictGen.make(spec);
    // HAND-PLACED HAZARDS, layered over whatever the (zero-density) generator
    // returns. Wrapping chunkData rather than editing DistrictGen keeps the
    // authoring pipeline ignorant of lairs, which is the point of it.
    const base = d.chunkData;
    d.chunkData = (cx, cy) => {
      const out = base(cx, cy);
      const key = cx + ',' + cy;
      const rows = (L.hazards || {})[key];
      if (rows) for (const k of Object.keys(rows)) out[k] = rows[k];
      // AND THE HAND-PLACED OBSTACLES. Rows are [type, x, y, r], and a
      // 'pillar' is the one the Bailiff fight is made of: Population's line
      // of sight has treated `type: 'pillar'` as opaque since Block 2, so
      // eight columns in a ring IS the flanking lesson and needed no new
      // system at all. Appended rather than assigned - a lair generates
      // nothing at density 0, but a rule that only works because the list
      // happens to be empty is a rule waiting to be wrong.
      const obs = (L.obstacles || {})[key];
      if (obs) {
        out.obstacles = out.obstacles || [];
        for (const o of obs) {
          out.obstacles.push({ type: o[0], x: o[1], y: o[2], r: o[3],
                               style: 0, lair: true });
        }
      }
      return out;
    };
    this._built[id] = d;
    return d;
  },

  // Is this boss dead? One record, the same one a placed machine's death has
  // always been written into, so nothing here keeps a second tally.
  beaten(id) {
    return !!(typeof World !== 'undefined' && World.wasKilled &&
              World.wasKilled('boss_' + id));
  },

  // How many production pylons still stand in the room. The DISPATCHER's
  // core reads it: while it is above zero the core cannot be hurt.
  pylonsLive() {
    if (typeof World === 'undefined' || typeof ProductionPylon === 'undefined') return 0;
    let n = 0;
    for (const e of (World.entities || [])) if (e instanceof ProductionPylon && e.alive) n++;
    return n;
  },

  // ---- THE BOSS AS A BUILDABLE MACHINE ------------------------------------
  // BOSSES[id].layers describes the machine in rings — outer, mid, inner —
  // and the roster already knows how to build a machine from a socket list.
  // So this converts one into the other and registers it, rather than
  // introducing a second way for a machine to exist.
  //
  // A layer part that is not a real player part is SUBSTITUTED through
  // BOSS_PART_SUBS, which already existed and already had `heatVent` in it.
  // Nothing is silently dropped: a part with no substitution is skipped and
  // `Lairs.unbuilt()` reports it.
  registerBuilds() {
    if (typeof BOSSES === 'undefined' || typeof ENEMY_BUILDS === 'undefined') {
      return 0;
    }
    let n = 0;
    // ALL TEN, not the six with rooms. A roamer is the same object as a lair
    // boss - a machine described in three rings that you take apart - and the
    // only difference is that it comes to you. Building only the ones with
    // lairs meant `boss_patchwork` did not exist, so alert stage 3 had nothing
    // to send and TALLY's third mission could never be finished.
    for (const id of Object.keys(BOSSES)) {
      const B = BOSSES[id];
      if (!B) continue;
      const key = 'boss_' + id;
      if (ENEMY_BUILDS[key]) continue;
      const sockets = [];
      const RING_AT = { outer: 'front', mid: 'side', inner: 'rear' };
      // A roamer's data does not always carry layers - the four of them are
      // described by what they DO more than by what is bolted on. An empty
      // ring list is a machine with a core and nothing else, which is a
      // legitimate machine, and `Lairs.unbuilt()` already reports a boss that
      // came out with no parts.
      // A roamer's layers live in ROAMER_LAYERS, built from its own onBreak
      // keys, because its data describes what it does rather than what is
      // bolted on. Same shape, same builder, one lookup.
      const layers = B.layers ||
        ((typeof ROAMER_LAYERS !== 'undefined' && ROAMER_LAYERS[id]) || {});
      for (const ring of ['outer', 'mid', 'inner']) {
        for (const row of (layers[ring] || [])) {
          if (!row.part) continue;              // structure notes are not parts
          let p = row.part;
          if (typeof PARTS === 'undefined' || !PARTS[p]) {
            p = (typeof BOSS_PART_SUBS !== 'undefined') ? BOSS_PART_SUBS[p] : null;
          }
          if (!p || !PARTS[p]) continue;
          for (let i = 0; i < (row.count || 1); i++) {
            // WHAT IT STANDS FOR, carried alongside what it IS.
            //
            // The Crucible's HEAT VENTS are substituted to `radiator`, because
            // a heat vent is a world hazard and the nearest real module is the
            // cooling it does. Which meant the built boss mounted radiators
            // where its vents should be, and `BossPhases` — keyed on the part
            // id — could NEVER fire the heat-vent phase, and would not fire
            // the radiator phase until the vents were off too. Two distinct
            // things had become one object, silently, and every data assertion
            // about the Crucible passed.
            sockets.push({ at: RING_AT[ring], part: p, standsFor: row.part });
          }
        }
      }
      ENEMY_BUILDS[key] = {
        name: B.name, family: 'BOSS', size: 'large',
        // The heaviest core and the AI that holds ground: a lair boss does not
        // chase you out of its own hall. Both names are checked against the
        // roster's own lists by test_lairs, because a core or a brain that
        // does not exist builds a machine that does nothing.
        core: 'heavyEnemyCore',
        // A LAIR BOSS HOLDS GROUND; A ROAMER COMES TO YOU. That is the only
        // behavioural difference between the two kinds, and it is one word.
        // ARTY is the turret brain. It was ZONER, which mapped to the turret
        // until the ZONER got a brain of its own (D329) -- a lair boss that
        // kited and laid mines would have been a different fight to the one
        // the rooms were built for, so the boss keeps the brain it had.
        ai: B.kind === 'roamer' ? 'AGGRESSIVE' : 'ARTY',
        // THE DISPATCHER DOES NOT MOVE. It allocates. `immobile` is the
        // roster's own word for it, read by the same brain dispatch.
        immobile: B.kind === 'final' ? true : undefined,
        sockets,
        // A roamer belongs to the district it walks, not to a room.
        districts: [B.kind === 'roamer' ? B.district : 'lair_' + id],
        drops: 'boss',
        boss: true, bossId: id,
      };
      n++;
    }
    return n;
  },

  // ---- THE TWO REPORTS THAT REPLACED LAIRS_TODO --------------------------
  //
  // A hand-kept list of what is missing drifts away from the truth the first
  // time somebody builds one of the things on it. These are derived.

  // WHICH LAIRS CAN THE PLAYER ACTUALLY GET TO? A lair's mouth is placed by
  // game.js only in its own district, so a lair in a district that does not
  // ship is dormant: authored, correct, and unreachable. Asked of DISTRICTS,
  // which is the record that owns the fact.
  unreachable() {
    const out = {};
    for (const id of Object.keys(LAIRS)) {
      const did = LAIRS[id].district;
      const ships = (typeof DISTRICTS !== 'undefined') && !!DISTRICTS[did];
      if (!ships) out[id] = did;
    }
    return out;
  },

  reachable() {
    const un = this.unreachable();
    return Object.keys(LAIRS).filter(id => !un[id]);
  },

  // AND WHICH ARENAS ARE PROMISING SOMETHING NOTHING DELIVERS. Two of the six
  // want a system that does not exist - Boremaw wants a brain that burrows,
  // the Stitcher wants the district to hand its lair the wrecks you made on
  // the way in. Both arenas are built and both teach the right lesson today;
  // this is what says they are not finished.
  unbuiltFeatures() {
    const out = {};
    for (const id of Object.keys(LAIRS)) {
      const n = LAIRS[id].needs;
      if (n && n.feature) out[id] = n.feature;
    }
    return out;
  },

  // What a lair's boss could not be given, and why. The honest report.
  unbuilt() {
    const out = {};
    if (typeof BOSSES === 'undefined') return out;
    for (const id of Object.keys(LAIRS)) {
      const B = BOSSES[LAIRS[id].boss];
      if (!B) continue;
      for (const ring of Object.keys(B.layers || {})) {
        for (const row of B.layers[ring]) {
          if (!row.part) continue;
          if (typeof PARTS !== 'undefined' && PARTS[row.part]) continue;
          const sub = (typeof BOSS_PART_SUBS !== 'undefined')
            ? BOSS_PART_SUBS[row.part] : null;
          out[row.part] = sub || null;
        }
      }
    }
    return out;
  },
};

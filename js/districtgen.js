// SCRAPCORE: BREAKLANDS — THE DISTRICT AUTHORING PIPELINE (Phase C.1)
//
// "Eleven districts hand-written as data files is weeks of typing and
//  unmaintainable afterward. Before authoring any district, build a two-layer
//  format." — BLOCKS_8_15.md
//
// And WORLD_SCALE makes it not optional but mandatory: at the sizes that doc
// calls for, the world is roughly 43,200 chunks. Nobody is ever going to hand
// author 43,200 chunks. This file is the reason that number is fine.
//
// ---------------------------------------------------------------------------
// LAYER 1 — HAND-PLACED. Everything that matters, placed by a person, by exact
// coordinate. Garages, boss lairs, barriers and gated pockets, placed machines
// and what they drop, derelict rig chassis, shortcuts, story fragments,
// entrances and exits.
//
// LAYER 2 — GENERATED. Everything that is texture, scattered from a
// per-district palette with a FIXED SEED. Ground, filler props, patrol spawn
// nodes, ambient hazards at a stated density.
//
// SAME SEED, SAME DISTRICT, EVERY TIME. Nothing generated is ever stored: it
// is recomputed from (district id, chunk, index) on every load, which is both
// why it costs no save space and why it can never drift between sessions.
//
// A district file is then a page of palette and rules plus a list of
// hand-placed things — an afternoon, not a week, and re-tunable by changing
// three numbers.

const DGEN = {
  // Filler density, per chunk, before the district's own multiplier.
  PROPS_PER_CHUNK: 7,
  PATROLS_PER_CHUNK: 1.15,
  // ITEM 2, THIRD ATTEMPT. THE OPEN WORLD HAS NO ACTIVE HAZARDS AT ALL.
  //
  // Aaron, twice. First: "I'm confused why obstacles from WRECKJACK are just
  // randomly in the world. Save them for lairs and places that make sense."
  // Then, after the site rule shipped: still wrong.
  //
  // It was. Attaching hazards to structures READS as a rule and BEHAVES as
  // scattering, because a district is made of structures — seven props a
  // chunk, a fifth of the tall ones promoted to "sites", a press beside every
  // third building. Two attempts failed the same way for the same reason:
  // both were density rules dressed as placement rules.
  //
  // So this one is a PLACE rule, and it is not tunable:
  //
  //   OPEN WORLD   terrain only. Mined ground, molten lanes, flooding,
  //                collapsing floor. Things that ARE the ground.
  //   INTERIORS    everything that moves or fires — lair arenas, and the
  //                inside of any building you enter.
  //
  // HAZARDS_PER_SITE, HAZARD_SITE_R and HAZARDS_PER_CHUNK_MAX are DELETED
  // rather than set to zero, because a zero is a number somebody turns back
  // up and a missing constant is a conversation.
  //
  // Terrain is sparse even so: scenery you drive around, not a minefield.
  HAZARDS_PER_CHUNK_TERRAIN: 0.5,

  // Belts are the one thing left in the open, and a belt is NOT a hazard: it
  // does no damage (hazards.js has said so since the port) and PLAYTEST 3
  // asked for it as a RIDE the player steers onto, which is traversal. Set
  // this false and the open world has nothing but terrain and props.
  OPEN_WORLD_BELTS: true,

  // Still used, but only to decide what a BELT may anchor to: something a
  // person could walk into, and not every shopfront.
  SITE_HEIGHT: 4.0,
  SITE_CHANCE: 0.22,

  // A hand-placed thing owns the ground around it. Generated filler keeps
  // clear, or a boss lair ends up with a scrap heap standing in the doorway.
  CLEAR_R: 900,

  // ---- PLAYTEST 3, ITEM 1a. A CONVEYOR NEEDS TWO ENDS. -------------------
  //
  // Aaron found a belt tucked behind a housing block. It passed item 2's rule
  // on a technicality — it was near a structure — and made no sense, because
  // a conveyor exists to MOVE MATERIAL FROM SOMEWHERE TO SOMEWHERE. A belt
  // with one end is a belt from a wall to a field.
  //
  // So a span hazard is not scattered in a ring around one anchor like a press
  // or a pylon. It is placed BETWEEN TWO, and if the generator cannot find two
  // that face each other it does not place one at all. No orphan belts.
  BELT_ALIGN: 300,        // how far off-axis the far anchor may sit
  BELT_RUN: [1550, 2800], // and how long the run between them may be
  // Three times the old 420-900. PLAYTEST_3: "a belt you're on for half a
  // second is a bump; one you're on for three seconds is a ride."
  // 3x the old 420 minimum, measured AFTER both ends are inset. A belt
  // shorter than this is not placed at all - it would be the bump the
  // playtest complained about, with extra machinery behind it.
  BELT_MIN_W: 1260,
  BELT_WIDTH: [190, 280], // across the belt, not along it
  BELT_INSET: 0.6,        // fraction of an anchor's radius the belt stops short
  BELTS_PER_CHUNK_MAX: 2,
  // How often a chunk WITH SOMEWHERE TO ANCHOR gets a belt, before the
  // district's density multiplier. A belt is meant to be a thing you spot and
  // steer onto, not paving.
  BELT_CHANCE: 0.45,
};

// TERRAIN HAZARDS stay in the open, because they ARE the ground: molten
// lanes, collapsing floor, mined earth, flooding. Item 2 is explicit that
// these stay — "they're terrain, and they're barriers with openers".
//
// Everything NOT in this set is an ACTIVE hazard: something a machine
// built, that moves or fires, and that has no business in an empty field.
const TERRAIN_HAZARDS = ['lanes', 'collapses', 'minebelts', 'singularities',
                         'rough'];

// SPAN HAZARDS run BETWEEN two anchors instead of sitting beside one. There is
// exactly one today — the conveyor — and it is a set rather than an `if` so
// that the day a pipe run, a cable tray or Rail Spine's freight line wants the
// same treatment, it is one string here and nothing else (rule 6).
const SPAN_HAZARDS = ['belts'];

// ---------------------------------------------------------------------------
// HOW MANY OF A THING GO IN ONE CHUNK, when the rate is a fraction.
//
// `Math.round(rate * density)` was the answer everywhere, and it DELETES any
// rate under a half. The numbers it was deleting:
//
//   ASH BARRENS   density 0.34. Terrain 0.5 x 0.34 = 0.17 -> ZERO, forever.
//                 Patrols 1.15 x 0.34 = 0.39 -> ZERO, forever. A district
//                 whose whole identity is ground and distance had no ground
//                 features and no patrols anywhere in it.
//   THE YARD      density 0.75 -> no terrain either.
//   THE SPRAWL    density 0.55 -> no terrain either.
//
// Nobody saw it because a rate of "0.5 per chunk" reads like a scatter and the
// only districts anyone had driven were the two dense enough to round up. The
// fraction is a CHANCE, spent per chunk off the same seeded hash, so the world
// stays exact and repeatable and a sparse district is sparse rather than empty.
function dgenCount(rate, h, salt) {
  if (rate <= 0) return 0;
  const whole = Math.floor(rate);
  return whole + (h(salt) < (rate - whole) ? 1 : 0);
}

// The same FNV-1a everything else in this codebase seeds with. Keyed by
// district id as well as position, so two districts never generate the same
// chunk, and stable forever.
function dgenHash(id, cx, cy, salt) {
  let h = 2166136261;
  const str = id + '|' + cx + '|' + cy + '|' + (salt || 0);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000000) / 1000000;
}

const DistrictGen = {
  // Build a district object satisfying the interface World already expects:
  // id, name, cols, rows, spawn, garages, spawnPool, chunkData(cx, cy).
  //
  // Nothing in World, Population, Garages or the map screen changes. That is
  // the point: this is an AUTHORING format, not a new runtime.
  make(spec) {
    const d = {
      id: spec.id,
      name: spec.name,
      cols: spec.cols,
      rows: spec.rows,
      floorKey: spec.floorKey || null,
      spawn: spec.spawn,
      garages: spec.garages || [],
      spawnPool: spec.spawnPool || 'yard',
      // Everything below is authoring data the runtime never reads directly.
      palette: spec.palette || {},
      says: spec.says || '',
      look: spec.look || '',
      hazardMix: spec.hazards || [],
      propMix: spec.props || [],
      // WHAT SHAPE THIS PLACE IS. The drafts have carried this since they were
      // written and nothing read it, which is most of why five districts felt
      // like one. See the layout switch in generate().
      layout: spec.layout || { kind: 'cluster' },
      // `|| 1` HERE WAS A BUG. A lair sets density 0 on purpose - nothing
      // in an interior is scattered from a seed - and `||` turned that 0
      // into a 1, so the first room built came out with twenty-six props
      // and a patrol route through the boss fight. A numeric field with a
      // meaningful zero can never be defaulted with `||`.
      density: spec.density === undefined ? 1 : spec.density,
      placed: spec.placed || {},
      barriers: spec.barriers || {},
      chassis: spec.chassis || {},
      // Q4 (20 Sept 2026): the five MACHINES a player does not start as,
      // each a wreck somewhere in the world. Rows are [x, y, machineId].
      machines: spec.machines || {},
      wrecks: spec.wrecks || {},     // Block 13: named RECOVERY wrecks
      story: spec.story || {},
      elites: spec.elites || [],
      // The MANIFEST of what this district holds — a flat list of specs,
      // which is what the content docs and the suites check against.
      finds: spec.finds || [],
      // And WHERE each one stands, keyed by chunk exactly like `story` and
      // `barriers`. Separate because they answer different questions: the
      // manifest is "what is in this place", the layer is "and here it is".
      findsAt: spec.findsAt || {},
      // FOUND MONEY (content/CONTENT_STASHES.md). Stashes and vaults, in the
      // finds vocabulary ('stash', 'vault:<barrier type>') and keyed by chunk
      // like findsAt, but their own layer: they are not on the district's
      // manifest of what it promises, and a reader of one list should not
      // have to know which rows are money.
      stashes: spec.stashes || {},
      // PHASE B.5: routes that open once and stay open. Not chunk-keyed like
      // the other hand-placed layers - a shortcut spans two chunks by
      // definition, so it belongs to the district rather than to either end.
      shortcuts: spec.shortcuts || [],
      boss: spec.boss || null,
      gateIn: spec.gateIn || null,
      // PHASE C: cities, mines and lairs are core only — the exit gate is
      // where the split is enforced, so the runtime object carries the flag.
      coreOnly: !!spec.coreOnly,
      exits: spec.exits || [],
      rectangular: !!spec.rectangular,
      // WHOSE GROUND THIS WEARS, when it is not its own. Set by Lairs.district
      // so a boss hall reads as being inside the district it is inside; null
      // everywhere else, and Outdoors.palette falls back to `id`.
      lookId: spec.lookId || null,
      // THE ENDGAME. One district is allowed to be small and to hand you its
      // garage: "you do not come here to explore." The suites that hold
      // every other district to a drive-time size read this rather than
      // carrying a list of exceptions.
      endgame: !!spec.endgame,
      _spec: spec,
    };

    // ---- THE ONE FUNCTION THE RUNTIME CALLS ------------------------------
    d.chunkData = (cx, cy) => this.chunkData(d, cx, cy);

    // What KIND of ground a chunk is. The map screen colours by this and the
    // debug overlay names it. The hand-authored district answered from a
    // typed grid; a generated one answers from the same seed as everything
    // else, so a 56x56 district has a legible map without anybody drawing
    // 3,136 letters.
    //
    // Terrain runs in BANDS rather than per-chunk noise, because a map where
    // every chunk is a different colour is confetti, not a map — so the
    // hash is taken at a coarser grid and chunks near each other agree.
    d.terrain = spec.terrain || ['open'];
    d.templateAt = (cx, cy) => {
      const B = 3;                       // band size, in chunks
      const h = dgenHash(d.id, Math.floor(cx / B), Math.floor(cy / B), 77);
      return d.terrain[Math.floor(h * d.terrain.length) % d.terrain.length];
    };
    return d;
  },

  // A PLACED MACHINE'S NAME, off its row: the id is the row's third field,
  // the build the fourth, and the build's name is what the player has been
  // shooting at. One lookup for the held garage (Garages.guardName, D351)
  // and the guarded machine wreck (Tow.guardName), so the two lines that say
  // KILL THE <X> cannot disagree about who X is.
  placedBuildName(d, id) {
    const placed = (d && d._spec && d._spec.placed) || {};
    for (const k of Object.keys(placed)) {
      for (const row of placed[k]) {
        if (row[2] !== id) continue;
        const b = (typeof ENEMY_BUILDS !== 'undefined') ? ENEMY_BUILDS[row[3]] : null;
        return (b && b.name) ? String(b.name).toUpperCase() : String(row[3]).toUpperCase();
      }
    }
    return String(id).toUpperCase();
  },

  // Layer 1 merged onto Layer 2, in that order, so a hand-placed thing always
  // wins and a generated thing can never overwrite one.
  chunkData(d, cx, cy) {
    const key = cx + ',' + cy;
    const out = this.generate(d, cx, cy);

    // ---- LAYER 1: everything a person put there ---------------------------
    if (d.placed[key]) out.placed = d.placed[key];
    if (d.barriers[key]) {
      out.barriers = d.barriers[key].map(b => [b[0], b[1], b[2],
        { id: b[3], reward: b[4] }]);
    }
    if (d.chassis[key]) out.chassis = d.chassis[key];
    if (d.machines[key]) out.machines = d.machines[key];
    if (d.wrecks[key]) out.wrecks = d.wrecks[key];
    if (d.story[key]) out.story = d.story[key];
    // PHASE C.3. The finds a person placed. Rows are [x, y, spec, id] and the
    // spec is the district's OWN vocabulary — 'gadget:jammer:1' — so a find is
    // one data entry in the language `finds:` already spoke.
    if (d.findsAt[key]) out.finds = d.findsAt[key];
    // Stashes and vaults ride the same `finds` row into the registry: one
    // ctor, one draw slot, one taken record.
    if (d.stashes[key]) out.finds = (out.finds || []).concat(d.stashes[key]);
    return out;
  },

  // ---- LAYER 2: TEXTURE, from the palette and the seed -------------------
  // Deterministic in (district id, chunk, index), so the same district
  // generates the same world every time without storing a byte of it.
  generate(d, cx, cy) {
    const out = { obstacles: [], patrols: [] };
    const C = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
    const h = (salt) => dgenHash(d.id, cx, cy, salt);

    // Where a person has already put something. Generated filler keeps clear
    // of it, or a boss lair ends up with a scrap heap in the doorway.
    const claimed = [];
    const key = cx + ',' + cy;
    for (const row of (d.placed[key] || [])) claimed.push({ x: row[0], y: row[1] });
    for (const row of (d.barriers[key] || [])) claimed.push({ x: row[0], y: row[1] });
    // And the finds, so a stash is never generated INSIDE a shed. The crate
    // finds were never on this list; a lockbox is smaller than a crate and
    // easier to bury by accident, so all of them join it.
    for (const row of (d.findsAt[key] || [])) claimed.push({ x: row[0], y: row[1] });
    for (const row of (d.stashes[key] || [])) claimed.push({ x: row[0], y: row[1] });
    for (const g of d.garages) {
      if (g.cx === cx && g.cy === cy) claimed.push({ x: g.x, y: g.y });
    }
    const clear = (x, y) => {
      for (const c of claimed) {
        if (Math.hypot(x - c.x, y - c.y) < DGEN.CLEAR_R) return false;
      }
      return true;
    };

    // ---- LAYOUT: WHERE THINGS GO IS PART OF WHAT A PLACE IS --------------
    //
    // "The player has been driving in circles" — and this is why. Every
    // district generated the same way: a few cluster seeds per chunk with
    // props gathered around them. The Sprawl is meant to be KILOMETRES OF
    // HOUSING and Neon Cut a CITY YOU WALK, and both came out as buildings
    // scattered on dirt, because the only thing that differed between them
    // was the palette and the prop names.
    //
    // The drafts have said what each place is shaped like all along —
    // `layout: { kind: 'grid', blockSize: [1400, 2200] }` for the Sprawl,
    // `'open'` for the Barrens — and nothing read it. Now something does.
    //
    //   GRID    blocks with STREETS between them. Props sit inside a block
    //           and never in the road, which is what makes a city a city:
    //           you drive down a street, not through a field of buildings.
    //   OPEN    far fewer, far apart, no clustering at all. The Barrens is
    //           connective ground and its emptiness is the content.
    //   CLUSTER the old behaviour, and still the right one for a yard or a
    //           works: heaps and sheds gather around where the work was.
    const lay = d.layout || { kind: 'cluster' };
    const nProps = dgenCount(DGEN.PROPS_PER_CHUNK * d.density *
      (lay.kind === 'open' ? 0.45 : 1), h, 1099);
    for (let i = 0; i < nProps; i++) {
      let x, y;
      if (lay.kind === 'grid') {
        // A street grid. The block size comes from the district, so the
        // Sprawl's long housing blocks and Neon Cut's tight ones are the
        // same code and different data.
        const bw = (lay.blockSize && lay.blockSize[0]) || 1400;
        const bh = (lay.blockSize && lay.blockSize[1]) || 2200;
        const road = lay.roadWidth || 340;
        const cols = Math.max(1, Math.round(C / (bw + road)));
        const rows = Math.max(1, Math.round(C / (bh + road)));
        const bx = Math.floor(h(100 + i) * cols);
        const by = Math.floor(h(150 + i) * rows);
        const cw = C / cols, ch = C / rows;
        // INSIDE the block, never in the street: the inset is half the road
        // width plus the jitter, so nothing can wander into the carriageway.
        const j = (lay.jitter === undefined ? 0.15 : lay.jitter);
        const ix = road / 2 + 140, iy = road / 2 + 140;
        x = bx * cw + ix + h(200 + i) * Math.max(60, cw - ix * 2);
        y = by * ch + iy + h(250 + i) * Math.max(60, ch - iy * 2);
        x += (h(300 + i) - 0.5) * cw * j;
        y += (h(350 + i) - 0.5) * ch * j;
      } else if (lay.kind === 'lines') {
        // RAIL SPINE. Everything aligns to the lines, because the lines are
        // what the place is: a district you read by looking along it. Props
        // sit BESIDE a line, never on it, or the trains would spend their
        // lives driving through container stacks.
        const spacing = lay.lineSpacing || 900;
        const n = Math.max(1, lay.lineCount || 9);
        const li = Math.floor(h(100 + i) * n);
        const lyy = (li + 0.5) * (C / n);
        const side = h(150 + i) > 0.5 ? 1 : -1;
        x = 200 + h(200 + i) * (C - 400);
        y = lyy + side * (200 + h(250 + i) * (spacing * 0.28));
      } else if (lay.kind === 'open') {
        // No clusters. Evenly-spread-but-jittered, far apart, because a
        // cluster in open ground reads as a settlement and there are none.
        x = 300 + h(100 + i) * (C - 600);
        y = 300 + h(150 + i) * (C - 600);
      } else {
        // Cluster: a few seeds per chunk, props gathered near one of them.
        const seed = Math.floor(h(100 + i) * 3);
        const sx = h(200 + seed) * C, sy = h(300 + seed) * C;
        x = sx + (h(400 + i) - 0.5) * 900;
        y = sy + (h(500 + i) - 0.5) * 900;
      }
      x = Math.max(120, Math.min(C - 120, x));
      y = Math.max(120, Math.min(C - 120, y));
      if (!clear(x, y)) continue;
      // A NAMED PROP from the district's own palette, not a generic pillar.
      // Every one carries a HEIGHT, and height is what lets it be drawn with
      // a front face, a top face and a cast shadow instead of as a floor
      // panel — which is what `wall` props were doing, in WRECKJACK's crate
      // art, and is why The Sprawl's housing blocks read as warehouse crates.
      const kind = d.propMix.length
        ? d.propMix[Math.floor(h(600 + i) * d.propMix.length) % d.propMix.length]
        : 'crate';
      if (typeof PROPS !== 'undefined' && PROPS[kind]) {
        const fw = Props.footprint(kind);
        const fd = fw * 0.6;
        // Kept inside the chunk: World offsets every row by the chunk origin,
        // so anything out of range lands in the WRONG CHUNK.
        const px = Math.max(fw, Math.min(C - fw, x));
        const py = Math.max(fw, Math.min(C - fw, y));
        const solid = Props.collides(kind);
        // `legs` means only the supports collide - a gantry you drive under.
        const cw = solid === 'legs' ? fw * 0.30 : fw;
        const cd = solid === 'legs' ? fd * 0.30 : fd;
        const o = {
          type: 'prop', kind,
          cx: px, cy: py,                  // CENTRE, for the draw
          r: fw * 0.5,
          seed: Math.floor(h(800 + i) * 1000),
          height: PROPS[kind].height,
        };
        // The AABB, in the same x/y/w/h convention a `wall` uses, so every
        // collision path that already handles a wall handles this. Omitted
        // entirely when the prop does not collide, which is how a puddle, a
        // washing line and a cable bundle stay walk-through.
        if (solid) {
          o.x = px - cw / 2; o.y = py - cd / 2; o.w = cw; o.h = cd;
        } else {
          o.x = px; o.y = py;
        }
        out.obstacles.push(o);
      } else {
        out.obstacles.push({ type: 'pillar', x, y,
          r: 70 + h(700 + i) * 90, style: Math.floor(h(800 + i) * 3) });
      }
    }

    // PATROL SPAWN NODES. Density is a district property (WORLD_SCALE wants
    // the open range sparse and the districts dense), and the Ash Barrens sets
    // it low on purpose: empty stretches are not a bug, and a continent needs
    // quiet ground or the busy ground means nothing.
    const nPat = dgenCount(DGEN.PATROLS_PER_CHUNK * d.density, h, 1399);
    for (let i = 0; i < nPat; i++) {
      const x = 300 + h(1100 + i) * (C - 600);
      const y = 300 + h(1200 + i) * (C - 600);
      if (!clear(x, y)) continue;
      out.patrols.push([x, y, 700 + h(1300 + i) * 900]);
    }

    // ---- HAZARDS. ITEM 2: NOT CONFETTI. --------------------------------
    //
    // TERRAIN first, and it is the only thing allowed in open ground: molten
    // lanes, collapsing floor, mined earth. It is the ground, not machinery.
    const terrain = d.hazardMix.filter(z => TERRAIN_HAZARDS.indexOf(z.key) >= 0);
    const spans = d.hazardMix.filter(z => SPAN_HAZARDS.indexOf(z.key) >= 0);
    // Everything else a district declares is an ACTIVE hazard, and the open
    // world no longer reads that list at all: Lairs and Interiors do. The
    // district data is unchanged — it just answers a different question now.

    const nTer = dgenCount(DGEN.HAZARDS_PER_CHUNK_TERRAIN * d.density, h, 1499);
    for (let i = 0; i < nTer && terrain.length; i++) {
      const pick = terrain[Math.floor(h(1400 + i) * terrain.length) % terrain.length];
      const x = 300 + h(1500 + i) * (C - 600);
      const y = 300 + h(1600 + i) * (C - 600);
      if (!clear(x, y)) continue;
      const rows = out[pick.key] || (out[pick.key] = []);
      rows.push(this._hazardRow(pick, x, y, h, i));
    }

    // ---- ACTIVE HAZARDS ARE NOT IN THE OPEN WORLD. AT ALL. -------------
    //
    // THIRD ATTEMPT, and the first two failed the same way. Attempt one
    // scattered them and Aaron called it confetti. Attempt two attached them
    // to structures, which sounded right and was not: STRUCTURES ARE
    // EVERYWHERE. A district generates seven props a chunk, a fifth of the
    // tall ones become "sites", and the result is a press beside every third
    // building - which is scattering with a justification.
    //
    // The rule now is a place rule, not a density rule, and it is not tunable:
    //
    //   OPEN WORLD  terrain only. Mined ground, molten lanes, flooding,
    //               collapsing floor. Things that ARE the ground.
    //   INTERIORS   everything that moves or fires. Lair rooms, built by
    //               js/lairs.js, and the insides of buildings you enter.
    //
    // There is no site pass any more and no per-chunk ceiling, because there
    // is nothing left to count. A district's `hazards:` list may still name
    // presses and pylons - that entry is now read by the LAIR and INTERIOR
    // builders and ignored out here, which is why the data did not change.
    //
    // BELTS ARE THE ONE EXCEPTION AND THEY ARE NOT A HAZARD. A conveyor does
    // no damage - hazards.js has said so since it was ported - and PLAYTEST 3
    // asked for it as a RIDE the player steers onto, which is traversal. It
    // stays, anchored building-to-building as item 1a required. If that is
    // wrong, `DGEN.OPEN_WORLD_BELTS = false` removes them in one line and
    // nothing else has to change.
    if (DGEN.OPEN_WORLD_BELTS && spans.length) {
      const sites = [];
      for (const row of (d.placed[key] || [])) {
        sites.push({ x: row[0], y: row[1], r: 200, height: 0 });
      }
      for (const row of (d.barriers[key] || [])) {
        sites.push({ x: row[0], y: row[1], r: 200, height: 0 });
      }
      for (const g of d.garages) {
        if (g.cx === cx && g.cy === cy) {
          sites.push({ x: g.x, y: g.y, r: 320, height: 6 });
        }
      }
      // NOT EVERY BUILDING. "A press lives in a press shop" - not in every
      // shopfront. Only some structures are working sites, chosen by the same
      // seed as everything else so a given building is a press shop forever.
      let bi = 0;
      for (const o of out.obstacles) {
        if (o.type !== 'prop' || o.height < DGEN.SITE_HEIGHT) continue;
        if (h(2500 + bi++) > DGEN.SITE_CHANCE) continue;
        sites.push({ x: o.cx, y: o.cy, r: o.r || 200, height: o.height,
                     structure: true });
      }

      // A belt runs between two anchors or it is not placed (item 1a).
      out._belts = this._spans(spans, sites, out, h, d, clear);
      out._hazardSites = sites.length;
    }
    out._activeHazards = 0;      // by construction, and the suites check it
    return out;
  },

  // ---- PLAYTEST 3, ITEM 1a: A CONVEYOR IS ANCHORED AT BOTH ENDS ----------
  //
  // "A conveyor exists to MOVE MATERIAL FROM SOMEWHERE TO SOMEWHERE. It needs
  //  two ends that mean something." Loading dock to silo. Pit face to crusher
  //  house. Furnace to pour line. Yard belt to sorting shed.
  //
  // So this does not scatter. It looks for two anchors that FACE EACH OTHER —
  // roughly on one axis, the right distance apart — and runs the belt from one
  // face to the other. If it cannot find a pair, it returns zero and the chunk
  // gets no belt. That is the whole rule: no orphan belts.
  //
  // Deterministic without touching the hash for the pairing itself: the site
  // list is built in a fixed order from fixed data, and the pair chosen is
  // always the LONGEST qualifying run from the first free anchor. The hash is
  // used only for the belt's width, which is texture.
  _spans(spans, sites, out, h, d, clear) {
    if (!sites.length) return 0;            // nothing built here: no belt
    const C = WORLD.CHUNK;
    const used = {};
    let placed = 0;
    // Density is decided BEFORE anything is looked for, so a chunk that
    // happens to hold two aligned buildings does not automatically grow a
    // belt. Belts are meant to be spotted and steered onto, not paved.
    if (h(3000) >= DGEN.BELT_CHANCE * (d.density || 1)) return 0;

    for (let i = 0; i < sites.length && placed < DGEN.BELTS_PER_CHUNK_MAX; i++) {
      if (used[i]) continue;
      const A = sites[i];
      let bj = -1, bRun = 0, bHoriz = false;
      for (let j = 0; j < sites.length; j++) {
        if (j === i || used[j]) continue;
        const B = sites[j];
        const dx = B.x - A.x, dy = B.y - A.y;
        const horiz = Math.abs(dx) >= Math.abs(dy);
        const along = horiz ? Math.abs(dx) : Math.abs(dy);
        const off = horiz ? Math.abs(dy) : Math.abs(dx);
        // OFF-AXIS is the rule that stops a belt being drawn diagonally
        // between two things that merely happen to be near each other. A belt
        // is straight, so the two ends have to line up.
        if (off > DGEN.BELT_ALIGN) continue;
        if (along < DGEN.BELT_RUN[0] || along > DGEN.BELT_RUN[1]) continue;
        if (along > bRun) { bRun = along; bj = j; bHoriz = horiz; }
      }
      if (bj < 0) continue;                 // nothing faces this one: no belt
      const B = sites[bj];

      // From FACE to FACE, not centre to centre: a belt runs out of a building
      // mouth, it does not run through the building.
      const pick = spans[Math.floor(h(3100 + i) * spans.length) % spans.length];
      const wArg = (pick.args && pick.args.h) || DGEN.BELT_WIDTH;
      const width = Array.isArray(wArg)
        ? wArg[0] + h(3200 + i) * (wArg[1] - wArg[0]) : wArg;

      const lowFirst = bHoriz ? A.x <= B.x : A.y <= B.y;
      const lo = lowFirst ? A : B, hi = lowFirst ? B : A;
      let p0 = (bHoriz ? lo.x : lo.y) + lo.r * DGEN.BELT_INSET;
      let p1 = (bHoriz ? hi.x : hi.y) - hi.r * DGEN.BELT_INSET;
      // Inside the chunk: World offsets every row by the chunk origin, so a
      // row that runs past the edge lands in the WRONG CHUNK.
      p0 = Math.max(160, p0);
      p1 = Math.min(C - 160, p1);
      if (p1 - p0 < DGEN.BELT_MIN_W) continue;   // what is left is a bump

      // Material runs TOWARD the works: the taller anchor is the furnace, the
      // silo, the crusher house. A tie runs from the first anchor to the
      // second, which is arbitrary but fixed.
      const toHi = (hi.height || 0) >= (lo.height || 0);
      const cross = (bHoriz ? (A.y + B.y) / 2 : (A.x + B.x) / 2) - width / 2;
      const crossClamped = Math.max(120, Math.min(C - 120 - width, cross));

      const row = bHoriz
        ? [p0, crossClamped, p1 - p0, width, toHi ? 1 : -1, 0]
        : [crossClamped, p0, width, p1 - p0, 0, toHi ? 1 : -1];
      const rows = out[pick.key] || (out[pick.key] = []);
      rows.push(row);
      used[i] = true; used[bj] = true;
      placed++;
    }

    // NOTHING FACED ANYTHING. Two existing structures lining up on an axis at
    // the right distance turns out to be rare — one chunk in five hundred,
    // measured — so a rule that only used found pairs would delete conveyors
    // from the game rather than fix them.
    //
    // The right answer is the one PLAYTEST_3's own table describes: a belt runs
    // from a loading dock TO A SILO, from a yard belt TO A SORTING SHED. If the
    // generator wants a belt, it builds the far end. Both ends are then real
    // structures — one that was already there and one this pass put there on
    // purpose — which is the rule, honoured rather than dodged.
    if (!placed) placed += this._buildSpan(spans, sites, out, h, d, clear);
    return placed;
  },

  // Anchor A is a structure that already exists. B is a terminal building this
  // pass places at the far end of the run, from the district's own prop
  // palette, so the belt has somewhere to deliver to.
  _buildSpan(spans, sites, out, h, d, clear) {
    const C = WORLD.CHUNK;
    // The tallest available anchor: a belt runs out of the biggest thing here.
    let A = sites[0];
    for (const s of sites) if ((s.height || 0) > (A.height || 0)) A = s;

    // A terminal worth delivering to: tall enough to count as a site itself,
    // and solid, so the belt visibly ends AT a building.
    const kinds = (d.propMix || []).filter(k =>
      typeof PROPS !== 'undefined' && PROPS[k] &&
      PROPS[k].height >= DGEN.SITE_HEIGHT && Props.collides(k));
    if (!kinds.length) return 0;
    const kind = kinds[Math.floor(h(3300) * kinds.length) % kinds.length];
    const fw = Props.footprint(kind);
    const fd = fw * 0.6;

    const run = DGEN.BELT_RUN[0] +
      h(3400) * (DGEN.BELT_RUN[1] - DGEN.BELT_RUN[0]);
    // Four ways out of the anchor, tried in a seeded order so the same chunk
    // always answers the same way. The first that fits in the chunk and does
    // not land on a hand-placed thing wins; if none do, there is no belt.
    const start = Math.floor(h(3500) * 4);
    for (let t = 0; t < 4; t++) {
      const dir = (start + t) % 4;
      const horiz = dir < 2;
      const sign = (dir % 2) ? -1 : 1;
      const bx = A.x + (horiz ? sign * run : 0);
      const by = A.y + (horiz ? 0 : sign * run);
      if (bx < fw || by < fw || bx > C - fw || by > C - fw) continue;
      if (clear && !clear(bx, by)) continue;

      const cw = fw, cd = fd;
      out.obstacles.push({
        type: 'prop', kind, cx: bx, cy: by, r: fw * 0.5,
        seed: Math.floor(h(3600) * 1000), height: PROPS[kind].height,
        x: bx - cw / 2, y: by - cd / 2, w: cw, h: cd,
        _beltEnd: true,               // for the debug overlay and the suite
      });

      const pick = spans[Math.floor(h(3700) * spans.length) % spans.length];
      const wArg = (pick.args && pick.args.h) || DGEN.BELT_WIDTH;
      const width = Array.isArray(wArg)
        ? wArg[0] + h(3800) * (wArg[1] - wArg[0]) : wArg;

      const B = { x: bx, y: by, r: fw * 0.5, height: PROPS[kind].height };
      const lowFirst = horiz ? A.x <= B.x : A.y <= B.y;
      const lo = lowFirst ? A : B, hi = lowFirst ? B : A;
      let p0 = (horiz ? lo.x : lo.y) + lo.r * DGEN.BELT_INSET;
      let p1 = (horiz ? hi.x : hi.y) - hi.r * DGEN.BELT_INSET;
      p0 = Math.max(160, p0);
      p1 = Math.min(C - 160, p1);
      if (p1 - p0 < DGEN.BELT_MIN_W) continue;

      // TOWARD the terminal: the shed is what the belt feeds.
      const toHi = lowFirst;
      const cross = (horiz ? A.y : A.x) - width / 2;
      const crossClamped = Math.max(120, Math.min(C - 120 - width, cross));
      const rows = out[pick.key] || (out[pick.key] = []);
      rows.push(horiz
        ? [p0, crossClamped, p1 - p0, width, toHi ? 1 : -1, 0]
        : [crossClamped, p0, width, p1 - p0, 0, toHi ? 1 : -1]);
      return 1;
    }
    return 0;
  },

  // A hazard row in the shape its registry entry declares. The registry is the
  // single source of truth for argument order, so this asks it rather than
  // keeping a second table that would drift the first time one changed.
  _hazardRow(pick, x, y, h, i) {
    const row = [x, y];
    const spec = (typeof Hazards !== 'undefined') ? Hazards.spec(pick.key) : null;
    const args = (spec && spec.args) || ['x', 'y'];
    for (let a = 2; a < args.length; a++) {
      const name = args[a];
      if (pick.args && pick.args[name] !== undefined) {
        const v = pick.args[name];
        row.push(Array.isArray(v)
          ? v[0] + h(1700 + i * 7 + a) * (v[1] - v[0])
          : v);
      } else {
        row.push(undefined);          // the registry fills in its default
      }
    }
    return row;
  },

  // ---- the honest counts, for the report --------------------------------
  // C.1's whole claim is that a district is mostly generated and the parts
  // that matter are hand-placed. This measures it rather than asserting it.
  census(d, sampleCols, sampleRows) {
    let placed = 0, generated = 0;
    const cols = sampleCols || Math.min(d.cols, 8);
    const rows = sampleRows || Math.min(d.rows, 8);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const data = d.chunkData(cx, cy);
        placed += (data.placed || []).length + (data.barriers || []).length;
        generated += (data.obstacles || []).length + (data.patrols || []).length;
        for (const k of Object.keys(data)) {
          if (k === 'obstacles' || k === 'patrols' || k === 'placed' ||
              k === 'barriers' || k === 'chassis' || k === 'story' ||
              k === 'wrecks' || k === 'machines') continue;
          if (Array.isArray(data[k])) generated += data[k].length;
        }
      }
    }
    return { placed, generated, chunks: cols * rows };
  },
};

// SCRAPCORE: BREAKLANDS — HAZARD REGISTRY (Block 1)
//
// WRECKJACK kept every hazard in its own flat array: `plates`, `vents`,
// `pistons`, `lasers`, `pulses`, `belts`, `arcs`, `fields`, `sweeps`, `gates`,
// `arty`, `minebelts`, `collapses`, `rails`, `lanes`, `testpads`, `beams`,
// `locks`, `purges`, `asmrails`, `singularities`, `canisters`, `crates` —
// twenty-three of them. Adding a hazard meant editing Arenas.build, the update
// loop, the draw loop and the depth-sort band: four places, and forgetting one
// produced a hazard that spawned and did nothing, or updated and never drew.
//
// That does not survive an open world, where hazards arrive and leave with the
// chunk that owns them.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: adding a hazard type is ONE registry
// entry. If it takes edits anywhere else, this file is not finished.
//
// A spec is data about a class, not a wrapper around it. The hazard classes in
// hazards.js are untouched — same constructors, same update signatures, same
// draw calls, same behaviour. This only records how to build one, when to tick
// it and when to draw it.
//
//   layoutKey   the array name in layout/chunk data ('plates'). Omit for a
//               type that is only ever spawned at runtime, like a crate.
//   ctor        the class
//   args        positional constructor arguments, IN ORDER, by name. Chunk data
//               rows are arrays, so this is what names them.
//   defaults    per-arg fallback when a row is short. EVERY constructor
//               argument that has no safe JS default of its own must have one
//               here. This is not decoration: a district that declares a
//               hazard with `args: {}` produces a row with holes in it, the
//               constructor stores `undefined`, and the object draws with NaN
//               geometry. A molten lane doing that took the whole frame down
//               with `createLinearGradient: non-finite` — silently, because
//               headless suites never draw. The sizes below are lifted from
//               the hand-authored arenas, which are the only place anyone has
//               ever chosen them on purpose.
//   needs       extra trailing constructor arguments taken from the build
//               context rather than the data row ('obstacles')
//   update      how it ticks: 'world' (dt, player, enemies), 'dt' (dt alone),
//               'canister' (dt, player, enemies, siblings — canisters chain),
//               or 'none'
//   updateOrder tick order. Preserved EXACTLY from WRECKJACK's update loop:
//               hazards that move the world tick before hazards that read it.
//   draw        'flat' draws in the pre-band floor pass, 'band' joins the
//               depth-sorted world band (it stands up off the floor), 'none'
//   drawOrder   order within the flat pass. Also preserved exactly — this is
//               the painter's order and it is load-bearing: belts are the
//               floor, plates go under everything, beams over everything.
//   tags        what OTHER systems need to find this type by. A projectile
//               needs the shootable hazards; an enemy brain needs the ones
//               it should steer around. Those systems ask the registry for a
//               tag rather than naming a hazard, so a new hazard joins them
//               by listing a tag — which is the one-entry rule again.

const HAZARD_TYPES = {};
const HAZARD_LIST = [];        // registration order, for stable iteration

const Hazards = {
  register(type, spec) {
    if (HAZARD_TYPES[type]) throw new Error('hazard type already registered: ' + type);
    const s = Object.assign({
      type,
      layoutKey: type,
      args: [],
      defaults: {},
      needs: [],
      tags: [],
      update: 'world',
      updateOrder: 100,
      draw: 'flat',
      drawOrder: 100,
    }, spec);
    if (!s.ctor) throw new Error('hazard type ' + type + ' has no ctor');
    HAZARD_TYPES[type] = s;
    HAZARD_LIST.push(type);
    return s;
  },

  spec(type) { return HAZARD_TYPES[type]; },
  types() { return HAZARD_LIST.slice(); },

  // Types that read their rows out of layout/chunk data, in registration order.
  dataTypes() { return HAZARD_LIST.filter(t => !!HAZARD_TYPES[t].layoutKey); },

  // Build one hazard from a data row. `row` is the positional array the chunk
  // file carries; `ctx` supplies whatever `needs` asks for.
  //
  // Every entity is stamped with its type and its owning chunk here, at the one
  // place hazards are made, so nothing downstream has to remember to do it.
  // `chunk` null means world-owned and never unloaded.
  make(type, row, ctx, chunk) {
    const s = HAZARD_TYPES[type];
    if (!s) throw new Error('unknown hazard type: ' + type);
    const a = [];
    for (let i = 0; i < s.args.length; i++) {
      const name = s.args[i];
      const v = row[i];
      a.push(v === undefined ? s.defaults[name] : v);
    }
    for (const n of s.needs) a.push(ctx ? ctx[n] : undefined);
    const e = new s.ctor(...a);
    e._type = type;
    e._chunk = chunk === undefined ? null : chunk;
    return e;
  },

  // Every hazard a layout/chunk declares, as one flat list. The caller keeps
  // that list; nothing here holds state.
  fromData(data, ctx, chunk) {
    const out = [];
    for (const type of this.dataTypes()) {
      const rows = data[HAZARD_TYPES[type].layoutKey];
      if (!rows || !rows.length) continue;
      for (const row of rows) out.push(this.make(type, row, ctx, chunk));
    }
    return out;
  },

  // ---- the two hot loops --------------------------------------------------
  // Both take ONE entity list and dispatch by type. The order indices are
  // rebuilt by orderIndex() only when the list changes (a chunk loads or
  // unloads), never per frame.

  // Sort keys, resolved once per type rather than per entity per frame.
  _key(kind) {
    const m = {};
    for (const t of HAZARD_LIST) m[t] = HAZARD_TYPES[t][kind];
    return m;
  },

  // Return a copy of `entities` in tick order, and one in flat-draw order.
  // Anything whose draw is 'band' is left out of the draw index — the depth
  // sort owns those.
  orderIndex(entities) {
    const uk = this._key('updateOrder');
    const dk = this._key('drawOrder');
    const upd = entities.filter(e => HAZARD_TYPES[e._type].update !== 'none');
    const drw = entities.filter(e => HAZARD_TYPES[e._type].draw === 'flat');
    const band = entities.filter(e => HAZARD_TYPES[e._type].draw === 'band');
    // Tag buckets, so the systems that want 'everything shootable' do not
    // rebuild that list sixty times a second.
    const tags = {};
    for (const t of HAZARD_LIST) {
      for (const tag of HAZARD_TYPES[t].tags) if (!tags[tag]) tags[tag] = [];
    }
    for (const e of entities) {
      for (const tag of HAZARD_TYPES[e._type].tags) tags[tag].push(e);
    }
    // Stable within a type: two hazards of the same type keep spawn order,
    // which matters for canisters chaining and for identical overlapping art.
    upd.sort((a, b) => uk[a._type] - uk[b._type]);
    drw.sort((a, b) => dk[a._type] - dk[b._type]);
    return { update: upd, draw: drw, band, tags };
  },

  // `list` is an orderIndex().update array.
  updateAll(list, dt, player, enemies) {
    for (const e of list) {
      switch (HAZARD_TYPES[e._type].update) {
        case 'dt': e.update(dt); break;
        case 'canister': e.update(dt, player, enemies, list); break;
        default: e.update(dt, player, enemies); break;
      }
    }
  },

  // `list` is an orderIndex().draw array. Culling is the caller's: it has the
  // camera and knows whether a given hazard is worth a bounds test.
  drawAll(list, ctx) {
    for (const e of list) e.draw(ctx);
  },
};

// ===========================================================================
// THE REGISTRY. Order values are WRECKJACK's own loops, transcribed. They are
// spread by 10 so a new hazard can slot between two existing ones without
// renumbering the file.
// ===========================================================================

// --- things that stand up off the floor: depth-sorted with the machines ---
Hazards.register('canisters', {
  ctor: Canister, args: ['x', 'y'],
  update: 'canister', updateOrder: 10, draw: 'band',
  // Shot by both sides: a canister chain is a weapon either way round.
  tags: ['shootable'],
});

// BLOCK 13. An ESCORTEE - the thing an escort mission is about. World-owned
// in practice (Escorts.begin does the owning) because a thing you are walking
// across a district must not evaporate when its chunk unloads; registered
// here so it draws and sorts like every other object that stands up.
Hazards.register('escortees', {
  ctor: Escortee, layoutKey: 'escortees',
  args: ['x', 'y', 'id', 'toX', 'toY'],
  update: 'world', updateOrder: 36, draw: 'band', drawOrder: 28,
});

// BLOCK 11. A DECOY. Never authored into a district — you throw it — but it
// is registered here for the same reason the Escortee is: this is the list the
// draw band and the update pass are built from, and an entity that is not in it
// does not draw, however alive it is. The first version pushed one into
// World.entities by hand and it was invisible, which is this registry's whole
// reason for existing said back at me.
//
// `layoutKey: null` because no chunk holds one. `update: 'world'` because it
// burns down whether or not you are looking at it.
Hazards.register('decoys', {
  ctor: Decoy, layoutKey: 'decoys',
  args: ['x', 'y', 'rank'],
  update: 'world', updateOrder: 37, draw: 'band', drawOrder: 29,
});

// BLOCK 13. A named wreck a RECOVERY mission is about. Rows are
// [x, y, id, label, parts, scrap] — the parts list is the strip payout, so
// what the mission is worth is authored beside where it stands.
Hazards.register('wrecks', {
  ctor: WreckHulk, layoutKey: 'wrecks',
  args: ['x', 'y', 'id', 'label', 'parts', 'scrap'],
  defaults: { label: 'WRECK', parts: [], scrap: 180 },
  update: 'none', draw: 'band', drawOrder: 26,
});

// BLOCK 6/7. A derelict rig chassis, placed by district data. Tow it home and
// Block 7 restores it into a vehicle you own.
Hazards.register('chassis', {
  ctor: ChassisHulk, layoutKey: 'chassis', args: ['x', 'y', 'rigId'],
  update: 'none', updateOrder: 24, draw: 'band', drawOrder: 24,
  tags: [],
});

// Q4 (20 Sept 2026). A MACHINE wreck, placed by district data: one of the
// five machines a player does not start as. Tow it home and restore it.
// The row's optional fourth column names the PLACED machine that guards it
// (BREAKLANDS_ANSWERS round 2): a wreck under a guard cannot be hooked until
// the guard is dead.
Hazards.register('machines', {
  ctor: MachineHulk, layoutKey: 'machines', args: ['x', 'y', 'machineId', 'guard'],
  update: 'none', updateOrder: 24, draw: 'band', drawOrder: 24,
  tags: [],
});

// BLOCK 8. A barrier: a locked door you can SEE the key for. Placed by
// district data, so it has a layoutKey.
Hazards.register('barriers', {
  ctor: Barrier, layoutKey: 'barriers', args: ['x', 'y', 'typeId', 'opts'],
  update: 'none', updateOrder: 26, draw: 'band', drawOrder: 26,
  tags: [],
});

// PLAYTEST 2 ITEM 6. A story fragment: a readable plate the district data
// places (`story` layer, emitted per chunk by districtgen since Phase C and
// consumed by nothing until now). The registry is the chunk-owned-object
// mechanism — Barrier set the precedent — so a fragment arrives and leaves
// with the chunk that owns it, and the FOUND record lives in the save.
Hazards.register('story', {
  ctor: Fragment, layoutKey: 'story', args: ['x', 'y', 'fragId'],
  update: 'none', updateOrder: 27, draw: 'band', drawOrder: 27,
  tags: [],
});

// PHASE C.3. A FIND: the crate a district's `finds` manifest was promising and
// never placing. Same mechanism as the fragment above — one registry entry, a
// chunk-owned object, the depth sort owns its draw, and the taken record lives
// in the save.
Hazards.register('finds', {
  ctor: Find, layoutKey: 'finds', args: ['x', 'y', 'spec', 'id'],
  update: 'none', updateOrder: 28, draw: 'band', drawOrder: 28,
  tags: [],
});

// PHASE C. A district exit. Spawned world-owned at district entry (never by
// chunk data — an exit is infrastructure and exists whether or not its chunk
// is loaded), so no layoutKey.
// BLOCK 14. A LAIR MOUTH. World-owned like a gate: it is a door in the world
// and exists whether or not its chunk is loaded.
Hazards.register('lairDoors', {
  ctor: LairDoor, layoutKey: null, args: ['x', 'y', 'lairId'],
  update: 'none', updateOrder: 28, draw: 'band', drawOrder: 28,
  tags: [],
});

// BLOCK 13. AN NPC. World-owned like a garage and an exit: a person who has
// stood in one place for four hundred years does not come and go with a chunk.
Hazards.register('npcs', {
  ctor: NPC, layoutKey: null, args: ['x', 'y', 'id'],
  update: 'none', updateOrder: 28, draw: 'band', drawOrder: 28,
  tags: [],
});

// A GARAGE IS A BUILDING. World-owned like an exit and for the same reason:
// the place you bank is infrastructure and exists whether or not its chunk is
// loaded. `layoutKey: null` because it is never in chunk data - the district's
// garage list is the source and Game._enterDistrict spawns them.
Hazards.register('garageBuildings', {
  ctor: GarageBuilding, layoutKey: null, args: ['x', 'y', 'id'],
  update: 'none', updateOrder: 28, draw: 'band', drawOrder: 28,
  tags: [],
});

Hazards.register('exits', {
  ctor: DistrictExit, layoutKey: null, args: ['x', 'y', 'to'],
  update: 'none', updateOrder: 28, draw: 'band', drawOrder: 28,
  tags: [],
});

// BLOCK 6. A hulk is what a dead machine leaves behind: tow it home and
// strip it. Spawned by gameplay, never by chunk data, so no layoutKey.
// `update: 'none'` on purpose — a hulk does not think, it is DRAGGED, and
// Tow.update does the dragging, so an untouched one costs nothing.
Hazards.register('hulks', {
  ctor: Hulk, layoutKey: null, args: ['x', 'y'],
  update: 'none', updateOrder: 25, draw: 'band', drawOrder: 25,
  tags: [],
});

// Crates are spawned by gameplay, never by data, so no layoutKey.
Hazards.register('crates', {
  ctor: WeaponCrate, layoutKey: null, args: ['x', 'y'],
  update: 'dt', updateOrder: 20, draw: 'band',
  // Only the player can crack one open — enemies do not shoot the loot.
  tags: ['playerShootable'],
});

Hazards.register('pistons', {
  ctor: Piston,
  args: ['x', 'y', 'w', 'h', 'axis', 'travel', 'speed', 'phase'],
  defaults: { phase: 0 },
  updateOrder: 210, draw: 'band',
});

// --- the floor and everything on it, in painter's order ------------------
Hazards.register('belts', {
  ctor: Conveyor, args: ['x', 'y', 'w', 'h', 'dx', 'dy'],
  updateOrder: 30, drawOrder: 10,          // belts are the floor
});

// RAIL SPINE. The one genuinely new hazard class in the content library. It
// draws in the BAND rather than flat: a train is a solid thing you stand on,
// hide behind and get run over by, and all three of those need it to sort
// against machines like everything else that stands up.
Hazards.register('freight', {
  ctor: MovingFreight,
  args: ['x', 'y', 'len', 'cars', 'dir', 'phase', 'sidingId', 'sidingX'],
  defaults: { len: 12000, cars: 4, dir: 1, phase: 0,
              sidingId: null, sidingX: null },
  update: 'world', updateOrder: 35, draw: 'band', drawOrder: 29,
  tags: [],
});

Hazards.register('arcs', {
  ctor: ArcPylon, args: ['x', 'y', 'phase'], defaults: { phase: 0 },
  updateOrder: 40, drawOrder: 30,          // pylons stand on it
});

Hazards.register('fields', {
  ctor: PolarityField, args: ['x', 'y', 'r', 'phase'], defaults: { phase: 0 },
  updateOrder: 50, drawOrder: 20,          // fields over the floor
});

Hazards.register('sweeps', {
  ctor: CargoSweep,
  args: ['x', 'y', 'w', 'h', 'axis', 'travel', 'phase'], defaults: { phase: 0 },
  updateOrder: 60, drawOrder: 150,         // freight over everything
});

Hazards.register('gates', {
  ctor: FreightBarrier, args: ['x', 'y', 'w', 'h', 'phase'],
  defaults: { w: 1240, h: 90, phase: 0 }, needs: ['obstacles'],
  updateOrder: 70, drawOrder: 140,         // gates in the world
});

Hazards.register('arty', {
  ctor: ArtilleryMarker, args: ['x', 'y', 'w', 'h', 'phase'],
  defaults: { w: 2200, h: 1400, phase: 0 },
  updateOrder: 80, drawOrder: 160,         // strike marks over all
});

Hazards.register('minebelts', {
  ctor: MineBelt, args: ['x', 'y', 'w', 'h', 'count'],
  update: 'dt', updateOrder: 90, drawOrder: 110,   // danger strips first
});

// ROUGH GROUND. Terrain, so it is allowed in the open world; harmless, so it
// is allowed to be everywhere. Drawn at 38 — under the molten lanes, because
// the melt is the floor and this is only the floor being broken.
Hazards.register('rough', {
  ctor: RoughGround, args: ['x', 'y', 'w', 'h'],
  defaults: { w: 1400, h: 900 },
  updateOrder: 118, drawOrder: 38,
});

// ---- ARENA TERRAIN (BLOCK 14, the other five lairs) ----------------------
// Water you wade, an edge you fall off, and a thing that builds machines.
// Everything else the five arenas ask for is an obstacle or an existing
// hazard - which is the point of having had a registry for fourteen blocks.
Hazards.register('water', {
  ctor: ShallowWater, args: ['x', 'y', 'w', 'h'],
  defaults: { w: 1600, h: 1200 },
  updateOrder: 119, drawOrder: 39,         // under the melt, over rough ground
});

Hazards.register('edges', {
  ctor: OpenEdge, args: ['x', 'y', 'w', 'h', 'backX', 'backY'],
  defaults: { w: 1200, h: 400, backX: undefined, backY: undefined },
  updateOrder: 121, drawOrder: 41,
});

Hazards.register('pylons', {
  ctor: ProductionPylon, args: ['x', 'y', 'builds', 'every', 'maxAlive'],
  defaults: { builds: null, every: 25, maxAlive: 4 },
  update: 'dt', updateOrder: 122, draw: 'band', drawOrder: 27,
});

Hazards.register('collapses', {
  ctor: CollapseZone, args: ['x', 'y', 'w', 'h', 'phase'],
  // W AND H WERE MISSING and it never showed, because the only districts that
  // declare `collapses` are the three with density under 1 — and until the
  // per-chunk fraction was spent as a chance rather than rounded away, those
  // districts generated NONE of them. One bug was hiding the other. Sizes
  // lifted from the hand-authored arenas, like every other default here.
  defaults: { w: 2400, h: 1100, phase: 0 }, needs: ['obstacles'],
  updateOrder: 100, drawOrder: 130,        // rubble + falling marks
});

Hazards.register('rails', {
  ctor: DrillRail, args: ['x', 'y', 'axis', 'travel', 'phase'],
  defaults: { phase: 0 },
  updateOrder: 110, drawOrder: 120,        // rails on the floor
});

Hazards.register('lanes', {
  ctor: MoltenLane, args: ['x', 'y', 'w', 'h'],
  defaults: { w: 1500, h: 300 },
  updateOrder: 120, drawOrder: 40,         // the melt IS the floor
});

Hazards.register('testpads', {
  ctor: PrototypePulse, args: ['x', 'y', 'phase'], defaults: { phase: 0 },
  updateOrder: 130, drawOrder: 50,         // pads inlaid on it
});

Hazards.register('beams', {
  ctor: SecurityBeam, args: ['x', 'y', 'angle', 'length', 'phase'],
  defaults: { phase: 0 },
  updateOrder: 140, drawOrder: 100,        // beams over everything
});

Hazards.register('locks', {
  ctor: LockZone, args: ['x', 'y', 'r', 'phase'], defaults: { phase: 0 },
  updateOrder: 150, drawOrder: 60,         // fields over the floor
});

Hazards.register('purges', {
  ctor: PurgePulse, args: ['x', 'y', 'phase'], defaults: { phase: 0 },
  updateOrder: 160, drawOrder: 80,         // sector marks over floor
});

Hazards.register('asmrails', {
  ctor: AssemblyRail,
  args: ['x', 'y', 'w', 'h', 'axis', 'travel', 'phase'], defaults: { phase: 0 },
  updateOrder: 170, drawOrder: 90,         // machinery over the floor
});

Hazards.register('singularities', {
  ctor: ForgeSingularity, args: ['x', 'y', 'r', 'phase'], defaults: { phase: 0 },
  updateOrder: 180, drawOrder: 70,         // the Forge's eye
});

Hazards.register('plates', {
  ctor: CrusherPlate, args: ['x', 'y', 'w', 'h', 'phase'],
  defaults: { w: 420, h: 420, phase: 0 },
  updateOrder: 190, drawOrder: 170,        // floor hazards under all
});

Hazards.register('vents', {
  ctor: HeatVent, args: ['x', 'y', 'r', 'phase'], defaults: { r: 165, phase: 0 },
  updateOrder: 200, drawOrder: 180,
  // Enemy brains steer around these.
  tags: ['avoidHeat'],
});

Hazards.register('lasers', {
  ctor: LaserGate, args: ['x', 'y', 'angle', 'length', 'phase'],
  defaults: { angle: 0, length: 2400, phase: 0 },
  updateOrder: 220, drawOrder: 200,        // beams over everything
});

Hazards.register('pulses', {
  ctor: EnergyPulse, args: ['x', 'y', 'maxR', 'phase'], defaults: { phase: 0 },
  updateOrder: 230, drawOrder: 190,
});

// SCRAPCORE: BREAKLANDS — WORLD AND CHUNK STREAMING (Block 1)
//
// A district is a grid of fixed-size square chunks. Chunks near the player are
// live; chunks far from the player are gone, and so is everything they own.
//
// ---------------------------------------------------------------------------
// THE OWNERSHIP RULE. This is the one that matters.
//
//   Entities owned by a chunk are DESTROYED when it unloads.
//   The player, and anything attached to or carried by the player,
//   is NEVER chunk-owned.
//
// Block 6 adds towing. A towed wreck crossing a boundary while its origin chunk
// unloads is the likeliest source of hard bugs in this project: the tow line
// keeps a reference the unload does not know about, the wreck is dropped from
// the entity list but still drawn, or still drawn but no longer updated, and it
// only reproduces when you drive the right way across the right line.
//
// So ownership is not a convention here, it is a field. Every entity carries
// `_chunk`. `null` means world-owned and permanent. Unload only ever removes
// entities whose `_chunk` matches the key being unloaded, and `adopt()` is the
// one way to move something out of a chunk's ownership and into the player's.
// ---------------------------------------------------------------------------
//
// HYSTERESIS. Load radius is smaller than unload radius on purpose. With one
// radius, driving back and forth across a boundary loads and unloads the same
// chunk every few seconds — the thrash costs a frame each time and shows up as
// a stutter exactly where the player is most likely to be looking.
//
// BUDGETED LOADING. Building a chunk's hazards is the expensive part, so a
// frame does at most CHUNK_BUDGET of them and the rest waits. Driving fast into
// unexplored ground therefore costs a few quiet frames rather than one long
// one. The queue is ordered nearest-first so the ground you are about to touch
// is built before the ground you can merely see.

const WORLD = {
  CHUNK: 3072,          // world units per side. ~1.5 screens at zoom 1.
  LOAD_R: 1,            // load within this many chunks (Chebyshev): 3x3 live
  UNLOAD_R: 2,          // unload beyond this: 5x5 kept, so a boundary is quiet
  CHUNK_BUDGET: 1,      // chunks built per frame, at most
  MAX_MACHINES: 24,     // hard cap on simultaneously active machines (§5)
};

const World = {
  district: null,
  bounds: { x: 0, y: 0, w: 0, h: 0 },

  loaded: {},           // key -> { key, cx, cy, rect, entities, obstacles }
  _queue: [],           // keys waiting to be built, nearest-first

  // WORLD-OWNED entities: adopted out of a chunk, or never in one. This list
  // is the other half of the ownership rule and the reason adopt() actually
  // means something. Without it _reflow() rebuilds `entities` from the live
  // chunks alone and quietly drops everything that was adopted — which is
  // precisely the towed-wreck bug, arriving one reflow later than expected
  // and therefore even harder to see. tests/test_block1.js §10 caught it.
  owned: [],

  entities: [],         // THE one entity list: live chunks + owned
  obstacles: [],        // flattened collision, rebuilt with the entity list

  // Counters the debug overlay reads. Kept here rather than computed on demand
  // so the overlay costs nothing when it is switched off.
  stats: { built: 0, dropped: 0, lastBuildMs: 0 },

  // MAP OUTLINES. A compact obstacle silhouette per chunk, cached when the
  // chunk is FIRST built and kept forever after — one small array of numbers,
  // not the chunk. The map has to stay useful all game: Block 8 depends on
  // remembering a wall from hour two and coming back with the Mammoth, and a
  // map that only draws where you are standing cannot do that job.
  //
  // Cost is bounded by the district, not by play: 64 chunks x ~8 obstacles x
  // 4 numbers is a few kilobytes for the whole Ironworks, and it never grows
  // again however long the session runs.
  outlines: {},

  // EXPLORED GROUND and PLACED KILLS both live on Progress — see _store
  // below. A chunk counts as explored once the player has STOOD in it, not
  // once it has been loaded: driving past a corner and seeing the edge of a
  // yard is not exploring it, and a map that fills itself in from the load
  // radius stops being a record of where you have been.
  //
  // `_fallback` is the store when there is no Progress at all, which is only
  // ever a bare unit test.
  _fallback: {},

  key(cx, cy) { return cx + ',' + cy; },
  chunkAt(x, y) {
    return { cx: Math.floor(x / WORLD.CHUNK), cy: Math.floor(y / WORLD.CHUNK) };
  },
  rectOf(cx, cy) {
    return { x: cx * WORLD.CHUNK, y: cy * WORLD.CHUNK,
             w: WORLD.CHUNK, h: WORLD.CHUNK };
  },
  // PHASE A, ITEM 5: THE BOUNDARY IS NOT A RECTANGLE.
  //
  // `Districts must have an uneven silhouette — bites taken out, lobes
  // pushed out, a coastline rather than a fence.` The chunk grid underneath
  // stays square; WHICH chunks are in the district does not have to be.
  //
  // Deterministic from the district id and the cell, so the coastline is the
  // same every visit and nothing has to be stored. Only EDGE chunks are ever
  // bitten out — taking a bite from the middle would make a hole, and a hole
  // in the middle of a district is a bug, not a coastline.
  inDistrict(cx, cy) {
    const d = this.district;
    if (!d) return false;
    if (cx < 0 || cy < 0 || cx >= d.cols || cy >= d.rows) return false;
    // A NaN INDEX PASSES EVERY COMPARISON ABOVE. A single NaN position -- a
    // tool that passed the player object where it meant player.x -- loaded
    // chunks keyed 'NaN,0', 'NaN,1', 'NaN,2': real generated chunks with
    // every entity at x = NaN, never unloaded because nothing is ever near
    // them, and found by the belt shot as the largest conveyor in the world.
    // A chunk that does not exist cannot be in the district.
    if (cx !== cx || cy !== cy) return false;
    if (d.rectangular) return true;          // opt-out, for tests and for
                                             // a district that wants an edge
    const edge = Math.min(cx, cy, d.cols - 1 - cx, d.rows - 1 - cy);
    if (edge > 1) return true;               // interior: always in
    const h = this._coastHash(d.id || 'x', cx, cy);
    // The very edge is bitten out often, one ring in rarely, so the
    // silhouette wanders by a chunk or two without ever becoming lace.
    return h > (edge === 0 ? 0.34 : 0.08);
  },

  _coastHash(id, cx, cy) {
    let h = 2166136261;
    const str = id + ':' + cx + ',' + cy;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
  },

  // ---- lifecycle ----------------------------------------------------------
  enter(district) {
    this.unloadAll();
    this.district = district;
    this.bounds = {
      x: 0, y: 0,
      w: district.cols * WORLD.CHUNK,
      h: district.rows * WORLD.CHUNK,
    };
    this.stats = { built: 0, dropped: 0, lastBuildMs: 0 };
    this.outlines = {};
    // NO XP HERE, and the reason is worth writing down. `World.enter` is a
    // STATE function: the loader calls it, the tools call it, and
    // `test_saveroundtrip.js` calls it while rebuilding a fresh world in order
    // to then load a save over the top. Awarding XP here made it a WRITER —
    // `Levels.addXp` ends in `Progress.save()` — so re-entering the Ironworks
    // during a reload overwrote the file with the empty save it was about to
    // read. Forty-three fields came back blank and every one of them was mine.
    //
    // The award lives in `GameState.enter`, which is the player arriving
    // somewhere rather than the world being built.
    // `killed` and `explored` deliberately SURVIVE re-entering a district:
    // they are the record of what the player did, not chunk state.
    return this.bounds;
  },

  // ONE STORE, ON PROGRESS. Not two.
  //
  // The first version kept a World copy AND wrote through to Progress, and
  // the write-through was guarded by `if (already explored) return` — so on
  // a second session the World copy said yes, the guard fired, and the SAVE
  // never learned about the chunk. Two copies, silently diverging, which is
  // exactly the failure the round-trip test exists to catch. It caught it.
  //
  // So World keeps no copy of either record. `Progress` is the store,
  // these are the door, and there is nothing to fall out of step with.
  _store(name) {
    if (typeof Progress === 'undefined') return (this._fallback || {});
    Progress[name] = Progress[name] || {};
    return Progress[name];
  },

  // WHAT YOU HAVE SEEN IS PER DISTRICT. `key` is a bare 'cx,cy', so an
  // explored store keyed on it alone said chunk (5,5) of the Sprawl was
  // explored because you had once stood in chunk (5,5) of the Yard - and both
  // the map screen's coverage figure and PLAYTEST 3's "a barrier names its
  // opener once you have SEEN it" read straight off that. Found when the
  // barrier openers started leaking across a border.
  //
  // The district id goes in the key. Old saves simply stop matching, which
  // costs a player their map fog and nothing else - strictly better than a
  // map that lies about where they have been.
  // `did` names a district OTHER than the one you are standing in. Only one
  // thing asks for that — a mission whose reward is knowledge of somewhere
  // else — and it goes through the same key-shaper so a chunk marked from a
  // distance and a chunk marked by driving into it are the same record.
  _exKey(cx, cy, did) {
    return (did || (this.district && this.district.id) || '?') + '|' +
           this.key(cx, cy);
  },

  markExplored(cx, cy, did) {
    if (!did && !this.inDistrict(cx, cy)) return false;
    const store = this._store('explored');
    const k = this._exKey(cx, cy, did);
    if (store[k]) return false;
    store[k] = true;
    return true;
  },
  isExplored(cx, cy, did) {
    return !!this._store('explored')[this._exKey(cx, cy, did)];
  },

  // Has the player ever been in this district at all? Used by the world map
  // to say which places are a memory and which are a rumour. Derived from the
  // explored store rather than kept as a second flag, because two records of
  // the same fact are one record and one bug.
  districtVisited(id) {
    const store = this._store('explored');
    const pre = id + '|';
    for (const k of Object.keys(store)) if (k.indexOf(pre) === 0) return true;
    return false;
  },
  // Same store, same reason: what the player killed for good is a save
  // fact, and World is rebuilt on every district entry.
  markKilled(id) {
    const store = this._store('killedPlaced');
    if (store[id]) return false;
    store[id] = true;
    if (typeof Progress !== 'undefined') Progress.save();
    return true;
  },
  wasKilled(id) { return !!this._store('killedPlaced')[id]; },
  killedCount() { return Object.keys(this._store('killedPlaced')).length; },
  // COUNTED PER DISTRICT, for the same reason. The map screen's
  // "N / total CHUNKS EXPLORED" was summing every district you had ever been
  // in against the size of the one you were standing in, so a well-travelled
  // save could report more than 100%.
  exploredCount() {
    const pre = ((this.district && this.district.id) || '?') + '|';
    let n = 0;
    for (const k of Object.keys(this._store('explored'))) {
      if (k.indexOf(pre) === 0) n++;
    }
    return n;
  },

  unloadAll() {
    for (const k of Object.keys(this.loaded)) this._drop(k);
    this.loaded = {};
    this._queue = [];
    this.owned = [];
    this.entities = [];
    this.obstacles = [];
  },

  // The spawn point for a fresh arrival: the district names one, in chunk
  // coordinates plus a local offset, so it is data rather than a magic number.
  spawnPoint() {
    const s = (this.district && this.district.spawn) || { cx: 0, cy: 0, x: 0, y: 0 };
    return { x: s.cx * WORLD.CHUNK + s.x, y: s.cy * WORLD.CHUNK + s.y };
  },

  // ---- streaming ----------------------------------------------------------
  // Called every frame with the player's world position. Cheap when nothing has
  // changed: the common case is one Chebyshev pass over (2*UNLOAD_R+1)^2 keys.
  update(px, py, budget) {
    if (!this.district) return false;
    const here = this.chunkAt(px, py);
    let changed = false;
    this.markExplored(here.cx, here.cy);

    // 1. Queue anything inside the load radius that is not live or waiting.
    for (let dy = -WORLD.LOAD_R; dy <= WORLD.LOAD_R; dy++) {
      for (let dx = -WORLD.LOAD_R; dx <= WORLD.LOAD_R; dx++) {
        const cx = here.cx + dx, cy = here.cy + dy;
        if (!this.inDistrict(cx, cy)) continue;
        const k = this.key(cx, cy);
        if (this.loaded[k] || this._queue.includes(k)) continue;
        this._queue.push(k);
      }
    }

    // Nearest first: the ground under the player matters more than the ground
    // at the corner of the view.
    if (this._queue.length > 1) {
      this._queue.sort((a, b) => this._dist2(a, px, py) - this._dist2(b, px, py));
    }

    // 2. Build within budget.
    const n = budget === undefined ? WORLD.CHUNK_BUDGET : budget;
    for (let i = 0; i < n && this._queue.length; i++) {
      this._build(this._queue.shift());
      changed = true;
    }

    // 3. Unload beyond the LARGER radius.
    for (const k of Object.keys(this.loaded)) {
      const c = this.loaded[k];
      if (Math.max(Math.abs(c.cx - here.cx), Math.abs(c.cy - here.cy)) > WORLD.UNLOAD_R) {
        this._drop(k);
        changed = true;
      }
    }

    if (changed) this._reflow();
    return changed;
  },

  _dist2(k, px, py) {
    const c = k.split(',');
    const r = this.rectOf(+c[0], +c[1]);
    const dx = (r.x + r.w / 2) - px;
    const dy = (r.y + r.h / 2) - py;
    return dx * dx + dy * dy;
  },

  _build(k) {
    if (this.loaded[k]) return;
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
    const c = k.split(',');
    const cx = +c[0], cy = +c[1];
    const rect = this.rectOf(cx, cy);
    const data = this.district.chunkData(cx, cy);

    // Chunk data is authored in CHUNK-LOCAL coordinates so a template can be
    // dropped anywhere in the grid. Offsetting here, once, is what makes that
    // true — nothing downstream ever sees a local coordinate.
    const local = this._offset(data, rect.x, rect.y);
    const obstacles = (local.obstacles || []).map(o => Object.assign({}, o));
    const entities = Hazards.fromData(local, { obstacles }, k);

    this.loaded[k] = { key: k, cx, cy, rect, entities, obstacles };
    this._cacheOutline(k, obstacles);
    // Block 2: a chunk brings its spawn posts with it. The POSTS belong to
    // the chunk; the machines they put out do not (see population.js).
    if (typeof Population !== 'undefined') Population.onChunkLoad(this.loaded[k]);
    this.stats.built++;
    this.stats.lastBuildMs =
      ((typeof performance !== 'undefined') ? performance.now() : 0) - t0;
  },

  // A chunk's obstacles as flat numbers the map can draw without the chunk:
  // [kind, x, y, a, b] where kind 0 is a pillar (a = radius) and 1 is a rect
  // (a = w, b = h). Built once, on the chunk's first build, and never again.
  _cacheOutline(k, obstacles) {
    if (this.outlines[k]) return;
    const out = [];
    for (const o of obstacles) {
      if (o.type === 'pillar') out.push(0, o.x, o.y, o.r || 100, 0);
      else out.push(1, o.x, o.y, o.w || 100, o.h || 100);
    }
    this.outlines[k] = out;
  },

  // Every chunk's outline, whether or not it is currently loaded. A chunk the
  // player has never reached has none — the map shows its ground type from the
  // district data and nothing else, which is the honest thing to show.
  outlineOf(cx, cy) { return this.outlines[this.key(cx, cy)] || null; },
  outlineCount() { return Object.keys(this.outlines).length; },

  // Shift every coordinate in a chunk's data into world space. Hazard rows are
  // positional arrays whose first two entries are always x and y — that is a
  // registry guarantee (`args` starts ['x','y'] for every type), not a hope.
  _offset(data, ox, oy) {
    const out = { obstacles: [] };
    for (const o of (data.obstacles || [])) {
      // A prop carries a CENTRE as well as its AABB, and both have to move
      // with the chunk or the thing you can see and the thing you bump into
      // end up in different places.
      const m = Object.assign({}, o, { x: o.x + ox, y: o.y + oy });
      if (o.cx !== undefined) { m.cx = o.cx + ox; m.cy = o.cy + oy; }
      out.obstacles.push(m);
    }
    for (const type of Hazards.dataTypes()) {
      const key = Hazards.spec(type).layoutKey;
      const rows = data[key];
      if (!rows || !rows.length) continue;
      out[key] = rows.map(r => {
        const c = r.slice();
        c[0] = r[0] + ox;
        c[1] = r[1] + oy;
        return c;
      });
    }
    return out;
  },

  // THE UNLOAD. Everything the chunk owns goes, and nothing else does.
  //
  // Entities are dropped by REFERENCE from the chunk's own list rather than by
  // filtering the world list on `_chunk`, so an entity that has been adopted
  // away (a towed wreck) is already gone from here and cannot be taken.
  _drop(k) {
    const c = this.loaded[k];
    if (!c) return;
    if (typeof Population !== 'undefined') Population.onChunkUnload(k);
    for (const e of c.entities) {
      // Give a hazard a chance to release anything it is holding. Optional:
      // most have nothing to let go of.
      if (typeof e.dispose === 'function') e.dispose();
      e._chunk = null;
      e._dead = true;
    }
    this.stats.dropped += c.entities.length;
    c.entities.length = 0;
    c.obstacles.length = 0;
    delete this.loaded[k];
  },

  // Rebuild the flattened world lists. Only on load/unload, never per frame.
  // World-owned entities go in LAST and unconditionally: they belong to no
  // chunk, so no unload can take them and no reflow may forget them.
  _reflow() {
    const ents = [];
    const obs = [];
    for (const k of Object.keys(this.loaded)) {
      const c = this.loaded[k];
      for (const e of c.entities) ents.push(e);
      for (const o of c.obstacles) obs.push(o);
    }
    for (const e of this.owned) {
      if (e._dead) continue;
      ents.push(e);
      // A WORLD-OWNED ENTITY MAY BE SOLID. Chunk obstacles come from chunk
      // data; an owned entity had no way to be collided with at all, which
      // was fine while everything owned was a gate or a hulk and stopped
      // being fine the moment a garage became a building you drive into.
      // Asking for `walls()` keeps it one mechanism rather than a special
      // case for garages.
      if (typeof e.walls === 'function') for (const w of e.walls()) obs.push(w);
    }
    this.entities = ents;
    this.obstacles = obs;
  },

  // ---- ownership ----------------------------------------------------------
  // Move an entity out of its chunk and into the world's permanent keeping.
  // The ONE way something survives its origin chunk unloading, and the hook
  // Block 6's tow line will use the moment it picks a wreck up.
  adopt(e) {
    if (!e || e._chunk === null) return false;
    const c = this.loaded[e._chunk];
    if (c) {
      const i = c.entities.indexOf(e);
      if (i >= 0) c.entities.splice(i, 1);
    }
    e._chunk = null;
    if (this.owned.indexOf(e) < 0) this.owned.push(e);
    this._reflow();
    return true;
  },

  // Put a world-owned entity into the world without it ever having belonged
  // to a chunk — a weapon crate dropped by gameplay, and later a wreck the
  // player builds. Same list, same guarantee.
  own(e) {
    if (!e) return null;
    e._chunk = null;
    if (this.owned.indexOf(e) < 0) this.owned.push(e);
    this._reflow();
    return e;
  },

  // Release a world-owned entity for good (it died, or was consumed).
  release(e) {
    const i = this.owned.indexOf(e);
    if (i < 0) return false;
    this.owned.splice(i, 1);
    this._reflow();
    return true;
  },

  // ---- queries the rest of the game asks ---------------------------------
  loadedCount() { return Object.keys(this.loaded).length; },
  queuedCount() { return this._queue.length; },

  // Is a rect worth updating or drawing? `view` is Camera.worldView().
  visible(view, x, y, w, h, pad) {
    const p = pad || 0;
    return x + (w || 0) >= view.x - p && x <= view.x + view.w + p &&
           y + (h || 0) >= view.y - p && y <= view.y + view.h + p;
  },

  // Chunk rects overlapping the view, for the debug overlay's boundary draw.
  visibleChunks(view) {
    const out = [];
    for (const k of Object.keys(this.loaded)) {
      const c = this.loaded[k];
      if (this.visible(view, c.rect.x, c.rect.y, c.rect.w, c.rect.h, WORLD.CHUNK)) {
        out.push(c);
      }
    }
    return out;
  },
};

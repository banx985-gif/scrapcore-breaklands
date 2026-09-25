// SCRAPCORE: BREAKLANDS — MINIMAP AND MAP SCREEN (Block 1)
//
// Two views of the same district, both drawn entirely with Canvas primitives.
// No art is required for either and none is planned: a map that needs a texture
// cannot be laid out before the district art exists, which is the property this
// codebase is built around (standing rule 5).
//
// CONTROLLER FIRST, not controller-also. The map screen is opened, panned,
// zoomed and closed from a pad with no pointer anywhere near it, and standing
// rule 8 says that gets checked per block rather than at the end. The pan is on
// the left stick, the zoom on the shoulders or the right stick's Y, and B or
// the map button closes. tests/test_boot_cut.js drives all of it through
// Controls with no pointer events at all.

const MAP = {
  // How much of the district a minimap shows, as a radius in chunks. Two is
  // enough to see the chunk you are heading into without the minimap becoming
  // a second map screen.
  MINI_R: 2,
  MINI_SIZE: 300,        // logical px, square
  PAN_SPEED: 2600,       // world units per second at zoom 1
  ZOOM_MIN: 0.35,
  ZOOM_MAX: 3.2,
  ZOOM_RATE: 1.9,        // multiplier per second while held

  // ---- PLAYTEST 3, ITEM 3: THREE LEVELS, per WORLD_SCALE -----------------
  //
  //   WORLD     district shapes, the roads between them, garages, where you
  //             are. NO chunk detail — at continent scale a chunk grid is
  //             noise, and the question this level answers is "which place".
  //   DISTRICT  the chunk grid, terrain, barriers and WHAT OPENS THEM,
  //             shortcuts, markers. The level you plan a trip on.
  //   LOCAL     full obstacle detail, and only for chunks you have actually
  //             visited — the cached outlines, which is the honest limit.
  //
  // They are not three screens. They are one screen that draws different
  // things at different zooms, with the thresholds expressed as multiples of
  // "the whole district fits" so they mean the same thing in a 20x20 district
  // and a 64x16 one.
  LEVEL_DISTRICT: 0.55,  // below this multiple of fit-zoom you are at WORLD
  LEVEL_LOCAL: 2.2,      // above this you are at LOCAL
  LEVELS: ['WORLD', 'DISTRICT', 'LOCAL'],
  // How far apart districts sit on the world view, as a multiple of the
  // bigger one's size. Enough gap that the road between them is visible as a
  // journey rather than as a seam.
  WORLD_GAP: 0.45,
};

// Chunk template -> minimap ink. Districts read at a glance because the ground
// types are coloured, not because anyone drew a map.
const MAP_INK = {
  open:     '#1d2540',
  alleys:   '#2a3352',
  presses:  '#3a3050',
  furnace:  '#4a2a22',
  haul:     '#233f4a',
  testyard: '#2d3f2a',
  collapse: '#42302a',
};

// PLAYTEST 3, ITEM 3. THE REAL MINIMAP.
//
// "Both are stubs and the world has outgrown them." The stub drew five chunk
// squares and a wedge: it told you which chunk you were in, which stopped
// being useful the moment a chunk became a third of a kilometre across and
// had buildings in it.
//
// What it owes the player, from the action list:
//   nearby terrain, buildings as blocks, roads as lines
//   player position and FACING (a wedge, not a dot)
//   hostiles as red pips, elites as bigger red pips
//   the nearest garage direction and distance, ALWAYS — even off the edge
//   the death wreck, if there is one
//   rotate-with-facing or north-up, as a setting
//
// It is drawn WORLD-SPACE UNDER A TRANSFORM rather than by converting every
// point by hand: one translate/rotate/scale at the top, and then buildings,
// roads, machines and markers are all drawn at their real coordinates. That is
// what makes the rotate setting a two-line change instead of a second renderer,
// and it is why nothing in here has to know which mode it is in.
const Minimap = {
  // Line widths and pip radii are in SCREEN pixels and divided by the scale at
  // the point of use, so they stay the same size however far the map zooms.
  PIP: 4.5,
  ELITE_PIP: 7,

  mode() {
    return (typeof Settings !== 'undefined') ? Settings.get('minimapMode') : 'NORTH UP';
  },

  // The rotation that puts the player's facing at the top of the map. Zero in
  // north-up mode, which is the whole of the difference between the two.
  rotation(p) {
    if (this.mode() !== 'ROTATE') return 0;
    return -Math.atan2(p.aimY, p.aimX) - Math.PI / 2;
  },

  draw(ctx, state, rect) {
    if (!state || !state.player || !World.district) return;
    const d = World.district;
    const p = state.player;
    const here = World.chunkAt(p.x, p.y);
    const span = MAP.MINI_R * 2 + 1;
    const cell = rect.w / span;
    const scale = rect.w / (span * WORLD.CHUNK);
    const mx = rect.x + rect.w / 2, my = rect.y + rect.h / 2;
    const rot = this.rotation(p);
    // In ROTATE mode the square is spun, so its corners sweep further than its
    // edges; draw a chunk wider so no corner is ever empty.
    const reach = MAP.MINI_R + (rot ? 1 : 0);

    R.roundRect(rect.x - 6, rect.y - 6, rect.w + 12, rect.h + 12, 10,
      'rgba(0,0,0,0.55)', CONFIG.COLOR.ink, 4);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.translate(mx, my);
    if (rot) ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.translate(-p.x, -p.y);
    // From here down every coordinate is a WORLD coordinate.
    const S = 1 / scale;                      // screen px, in world units

    // ---- 1. GROUND, one fill per chunk in reach --------------------------
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const cx = here.cx + dx, cy = here.cy + dy;
        const wx = cx * WORLD.CHUNK, wy = cy * WORLD.CHUNK;
        if (!World.inDistrict(cx, cy)) {
          // Outside the district reads as nothing at all, so an edge is
          // obvious before you drive into it.
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(wx, wy, WORLD.CHUNK, WORLD.CHUNK);
          continue;
        }
        const seen = World.isExplored(cx, cy);
        ctx.fillStyle = seen ? (MAP_INK[d.templateAt(cx, cy)] || MAP_INK.open)
                             : 'rgba(255,255,255,0.06)';
        ctx.fillRect(wx, wy, WORLD.CHUNK, WORLD.CHUNK);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2 * S;
        ctx.strokeRect(wx, wy, WORLD.CHUNK, WORLD.CHUNK);
      }
    }

    // ---- 2. ROADS AS LINES ----------------------------------------------
    // The same routes Outdoors draws in the world, at map weight. A road on
    // the minimap is what turns "somewhere north" into "up the road".
    if (typeof Outdoors !== 'undefined' && Outdoors.routes && state.arena) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const r of Outdoors.routes(d, state.arena)) {
        ctx.strokeStyle = r.rail ? 'rgba(120,130,150,0.45)'
                                 : 'rgba(150,150,155,0.40)';
        ctx.lineWidth = Math.max(r.w * 0.5, 5 * S);
        ctx.beginPath();
        r.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
    }

    // ---- 3. BUILDINGS AS BLOCKS -----------------------------------------
    // From the CACHED outlines, not from the live chunks, so a building you
    // have driven past stays on the map after its chunk unloads — which is
    // most of what makes a minimap worth glancing at.
    ctx.fillStyle = 'rgba(143,163,200,0.55)';
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const ol = World.outlineOf(here.cx + dx, here.cy + dy);
        if (!ol) continue;
        for (let i = 0; i < ol.length; i += 5) {
          if (ol[i] === 0) {
            ctx.beginPath();
            ctx.arc(ol[i + 1], ol[i + 2], Math.max(ol[i + 3], 2 * S), 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(ol[i + 1], ol[i + 2],
              Math.max(ol[i + 3], 3 * S), Math.max(ol[i + 4], 3 * S));
          }
        }
      }
    }

    // ---- 4. HOSTILES ----------------------------------------------------
    // Red, because red is hostile and nothing else in this game is allowed to
    // be. An elite gets a bigger pip and a ring: "visually distinct at a
    // glance" is a Phase C rule and it holds on the map as well as in the
    // world.
    for (const e of (state.enemies || [])) {
      if (!e || e.alive === false) continue;
      const big = !!e.isElite;
      ctx.fillStyle = CONFIG.COLOR.red;
      ctx.beginPath();
      ctx.arc(e.x, e.y, (big ? this.ELITE_PIP : this.PIP) * S, 0, Math.PI * 2);
      ctx.fill();
      if (big) {
        ctx.strokeStyle = CONFIG.COLOR.yellow;
        ctx.lineWidth = 2 * S;
        ctx.beginPath();
        ctx.arc(e.x, e.y, (this.ELITE_PIP + 3) * S, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ---- 4b. CACHES, with a rank-3 SCANNER fitted --------------------------
    // `minimapCaches`: every untaken FIND in the live chunks shows as a
    // yellow diamond. The scanner's whole job is knowing where salvage is;
    // its last rank puts that on the map rather than in the world only.
    if (typeof GadgetRun !== 'undefined' && typeof Gadgets !== 'undefined' &&
        Gadgets.isFitted('scanner') && (GadgetRun.rankOf('scanner') || {}).minimapCaches &&
        typeof Find !== 'undefined') {
      ctx.fillStyle = CONFIG.COLOR.yellow;
      for (const e of (state.entities || [])) {
        if (!(e instanceof Find) || e.taken) continue;
        const r = 6 * S;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - r); ctx.lineTo(e.x + r, e.y);
        ctx.lineTo(e.x, e.y + r); ctx.lineTo(e.x - r, e.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ---- 5. THE WRECK ---------------------------------------------------
    if (typeof Wrecks !== 'undefined' && Wrecks.current &&
        Wrecks.current.district === d.id) {
      ctx.strokeStyle = CONFIG.COLOR.red;
      ctx.lineWidth = 3 * S;
      const r = 8 * S;
      ctx.beginPath();
      ctx.moveTo(Wrecks.current.x - r, Wrecks.current.y - r);
      ctx.lineTo(Wrecks.current.x + r, Wrecks.current.y + r);
      ctx.moveTo(Wrecks.current.x + r, Wrecks.current.y - r);
      ctx.lineTo(Wrecks.current.x - r, Wrecks.current.y + r);
      ctx.stroke();
    }

    // ---- 6. GARAGES on the map, if they happen to be in view -------------
    if (typeof Garages !== 'undefined') {
      for (const g of Garages.list) {
        const own = Garages.owned(g.id);
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = own ? CONFIG.COLOR.cyan : 'rgba(0,0,0,0.6)';
        ctx.strokeStyle = own ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel;
        ctx.lineWidth = 2 * S;
        const s2 = 7 * S;
        ctx.fillRect(-s2, -s2, s2 * 2, s2 * 2);
        ctx.strokeRect(-s2, -s2, s2 * 2, s2 * 2);
        ctx.restore();
      }
    }
    ctx.restore();

    // ---- 7. THE PLAYER, in screen space ---------------------------------
    // Always dead centre, and always a WEDGE: a dot cannot tell you which way
    // you are pointing, and on a map this size that is the only question.
    // In ROTATE mode the wedge points up because everything else turned; in
    // NORTH UP it points wherever the machine does.
    const a = Math.atan2(p.aimY, p.aimX) + rot;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(mx + Math.cos(a) * 16, my + Math.sin(a) * 16);
    ctx.lineTo(mx + Math.cos(a + 2.5) * 10, my + Math.sin(a + 2.5) * 10);
    ctx.lineTo(mx + Math.cos(a - 2.5) * 10, my + Math.sin(a - 2.5) * 10);
    ctx.closePath();
    ctx.fillStyle = CONFIG.COLOR.lime;
    ctx.fill();
    ctx.restore();
    R.circle(mx, my, 5, CONFIG.COLOR.white);

    // ---- 8. THE NEAREST GARAGE, ALWAYS ----------------------------------
    // "even off the edge". Drawn in screen space so it can be clamped to the
    // border, with the distance written underneath — the same rule the wreck
    // marker taught the map screen in Block 3, and the same rule the compass
    // strip runs on: a marker you can only see once you are near it is not a
    // marker.
    const home = (typeof Compass !== 'undefined') ? Compass.homeward(state) : null;
    if (home) {
      const rel = { x: (home.g.x - p.x) * scale, y: (home.g.y - p.y) * scale };
      if (rot) {
        const c = Math.cos(rot), s3 = Math.sin(rot);
        const nx = rel.x * c - rel.y * s3, ny = rel.x * s3 + rel.y * c;
        rel.x = nx; rel.y = ny;
      }
      // The readout lives INSIDE the map's bottom edge, on its own band. Under
      // it is where the SPECIAL button lives, and a distance sitting on a
      // button is a distance nobody reads.
      const bandH = 22;
      const gx = Math.max(rect.x + 12, Math.min(rect.x + rect.w - 12, mx + rel.x));
      const gy = Math.max(rect.y + 12,
        Math.min(rect.y + rect.h - bandH - 12, my + rel.y));
      R.rect(rect.x, rect.y + rect.h - bandH, rect.w, bandH, 'rgba(4,6,14,0.80)');
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = CONFIG.COLOR.cyan;
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 3;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
      R.smallText(
        home.g.name + '  ' +
        (typeof Compass !== 'undefined' ? Compass.metres(home.d)
                                        : Math.round(home.d / 10) + 'm'),
        rect.x + rect.w / 2, rect.y + rect.h - bandH + 3, 17,
        CONFIG.COLOR.cyan, 'center');
    }
  },
};

// ===========================================================================
// THE WORLD LAYOUT — derived, not authored.
//
// Nothing in this codebase records where a district SITS relative to another
// one: districts know their size and their gates, and that is all. Rather than
// invent an eleventh data file that would immediately drift from the gates, the
// world view derives the layout FROM the gates.
//
// A gate at chunk (2, 3) of a 20-wide district is on that district's WEST edge,
// so whatever is through it lies to the west. Walk the graph from the Yard,
// place each neighbour in the direction its own gate implies, and the shape
// that falls out is the shape the gates actually describe. Add a district, add
// a gate, and the world map grows with no edit here — which is standing rule 7
// (a district is data) holding all the way out to the continent.
// ===========================================================================
const WorldLayout = {
  _cache: null,

  // Which edge a gate sits on, as a unit vector. The stronger of the two
  // distances-to-an-edge wins, so a gate in a corner picks the edge it is
  // most obviously on.
  _dirOf(d, ex) {
    const fx = (ex.cx + 0.5) / d.cols, fy = (ex.cy + 0.5) / d.rows;
    const west = fx, east = 1 - fx, north = fy, south = 1 - fy;
    const m = Math.min(west, east, north, south);
    if (m === west) return { x: -1, y: 0 };
    if (m === east) return { x: 1, y: 0 };
    if (m === north) return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  },

  // Does this rectangle touch any already placed? A margin, because two
  // districts that merely share an edge still read as one shape.
  _hits(r, placed) {
    const m = Math.max(r.w, r.h) * MAP.WORLD_GAP * 0.5;
    for (const id of Object.keys(placed)) {
      const o = placed[id];
      if (Math.abs(r.x - o.x) < (r.w + o.w) / 2 + m &&
          Math.abs(r.y - o.y) < (r.h + o.h) / 2 + m) return true;
    }
    return false;
  },

  // { id: {x, y, w, h} } in an arbitrary shared unit — chunks, as it happens,
  // which keeps the district rectangles honestly proportioned to each other.
  build() {
    if (this._cache) return this._cache;
    const out = {};
    if (typeof DISTRICTS === 'undefined' || typeof DISTRICT_LIST === 'undefined') {
      return (this._cache = out);
    }
    const root = DISTRICT_LIST[0];
    const q = [root];
    out[root] = { x: 0, y: 0, w: DISTRICTS[root].cols, h: DISTRICTS[root].rows };
    const seen = { [root]: true };
    while (q.length) {
      const id = q.shift();
      const d = DISTRICTS[id];
      const at = out[id];
      for (const ex of ((d._spec && d._spec.exits) || d.exits || [])) {
        const to = DISTRICTS[ex.to];
        if (!to || seen[ex.to]) continue;
        const dir = this._dirOf(d, ex);
        const w = to.cols, h = to.rows;
        // Placed edge to edge with a gap, and CENTRED on the gate, so the road
        // between them leaves one district where its gate is and arrives at
        // the other where its gate is.
        const gapX = (at.w + w) / 2 * MAP.WORLD_GAP;
        const gapY = (at.h + h) / 2 * MAP.WORLD_GAP;
        let step = 0;
        const spot = { w, h, x: 0, y: 0 };
        // PUSH IT OUT UNTIL IT FITS. Two gates on different districts can
        // point the same way — Neon Cut is west of the Sprawl and the
        // Ironworks is west of the Yard — and a layout derived from gates
        // alone will happily stack them. The first world shot had
        // "THE IRONWORKON CUT" written across two overlapping rectangles.
        //
        // A derived layout cannot be perfect; it can be legible. Slide the
        // newcomer further along its own direction until it clears everything
        // already placed, which keeps the gate's meaning (it is still that
        // way) and costs only distance.
        do {
          spot.x = at.x + dir.x * ((at.w + w) / 2 + gapX + step);
          spot.y = at.y + dir.y * ((at.h + h) / 2 + gapY + step);
          step += Math.max(w, h) * 0.35;
        } while (step < Math.max(w, h) * 40 && this._hits(spot, out));
        out[ex.to] = spot;
        seen[ex.to] = true;
        q.push(ex.to);
      }
    }
    // A district nothing reaches still exists and must not vanish off the
    // world map: park it in a row below rather than at the origin, on top of
    // the Yard.
    let stray = 0;
    for (const id of DISTRICT_LIST) {
      if (out[id]) continue;
      const d = DISTRICTS[id];
      out[id] = { x: stray * (d.cols * 1.5), y: 200, w: d.cols, h: d.rows };
      stray++;
    }
    return (this._cache = out);
  },

  // The gate-to-gate links, for drawing the roads between districts.
  links() {
    const lay = this.build();
    const out = [];
    if (typeof DISTRICT_LIST === 'undefined') return out;
    const done = {};
    for (const id of DISTRICT_LIST) {
      const d = DISTRICTS[id];
      for (const ex of ((d._spec && d._spec.exits) || d.exits || [])) {
        if (!lay[id] || !lay[ex.to]) continue;
        const k = [id, ex.to].sort().join('>');
        if (done[k]) continue;
        done[k] = true;
        out.push({ from: id, to: ex.to, a: lay[id], b: lay[ex.to] });
      }
    }
    return out;
  },
};

// ===========================================================================
// THE MAP SCREEN
// ===========================================================================
class MapState {
  enter() {
    const p = Game.states.GAME && Game.states.GAME.player;
    // Open centred on the player, at a zoom that fits the district. Opening a
    // map somewhere other than where you are standing is how a map screen
    // gets closed again immediately.
    this.cx = p ? p.x : World.bounds.w / 2;
    this.cy = p ? p.y : World.bounds.h / 2;
    this.zoom = this._fitZoom() * 1.6;
    this.build();
  }

  onResize() { this.build(); }

  _fitZoom() {
    const s = Display.safe;
    const w = Math.max(1, World.bounds.w), h = Math.max(1, World.bounds.h);
    return Math.min((s.right - s.left - 240) / w, (s.bottom - s.top - 260) / h);
  }

  // The zoom at which the WHOLE CONTINENT fits. The world level is useless if
  // you cannot zoom out far enough to see it, and ZOOM_MIN alone could not:
  // it is a multiple of the district's fit, and the continent is roughly ten
  // districts across. So the zoom FLOOR is whichever of the two is further
  // out, and the WORLD level always has somewhere to go.
  _worldFitZoom() {
    const lay = WorldLayout.build();
    const here = World.district && lay[World.district.id];
    if (!here) return this._fitZoom() * MAP.ZOOM_MIN;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of Object.keys(lay)) {
      const a = lay[id];
      x0 = Math.min(x0, a.x - a.w / 2); x1 = Math.max(x1, a.x + a.w / 2);
      y0 = Math.min(y0, a.y - a.h / 2); y1 = Math.max(y1, a.y + a.h / 2);
    }
    const s = Display.safe;
    const w = Math.max(1, (x1 - x0) * WORLD.CHUNK);
    const h = Math.max(1, (y1 - y0) * WORLD.CHUNK);
    return Math.min((s.right - s.left - 240) / w, (s.bottom - s.top - 300) / h);
  }

  // The zoom floor, and the thing FIT steps between: out to the continent,
  // then back to the district, so one button walks the levels.
  _zoomFloor() {
    return Math.min(MAP.ZOOM_MIN * this._fitZoom(), this._worldFitZoom());
  }

  build() {
    const s = Display.safe;
    this.buttons = new UIButtons();

    // FAST TRAVEL (3.4). One button per OWNED garage, down the left, because
    // the map is where you decide where to be. A garage you have not earned
    // is not listed at all — a greyed-out destination invites a tap that
    // does nothing, and the map already shows you where it is.
    //
    // Blocked while towing, and the button SAYS SO rather than going quiet:
    // arriving somewhere without the wreck you were dragging is exactly the
    // silent loss this block exists to prevent.
    // THE WHOLE NETWORK, not just this district's yards. `ownedList` reads the
    // live per-district list, so the destinations offered here were only ever
    // places you were already standing — fast travel that cannot leave the
    // district is a shortcut across a field.
    const owned = (typeof Garages !== 'undefined') ? Garages.networkList() : [];
    owned.forEach((g, i) => {
      const blocked = !Garages.canFastTravel(g);
      // A yard in another district says which, because "GO" and "GO A LONG
      // WAY" are different decisions and the player is entitled to know which
      // one the button is.
      const label = g.away ? (g.name + '  → ' + this._districtName(g.district))
                           : g.name;
      this.buttons.add(label, s.left + 40, s.top + 190 + i * 104, 360, 88,
        () => {
          const why = Garages.fastTravelReason(g);
          if (why) { this.toast = why; this.toastT = 3; return; }
          const gs = Game.states.GAME;
          const p = gs && gs.player;
          if (!p) return;
          const r = Garages.fastTravelTo(g, p);
          if (!r) return;
          if (r.away && gs._enterDistrict && typeof DISTRICTS !== 'undefined') {
            // The SAME entry path a district exit uses, so arriving by freight
            // and arriving on foot cannot differ in what gets streamed, saved
            // or announced.
            gs._enterDistrict(DISTRICTS[r.district], { x: r.x, y: r.y });
          }
          this._centre();
          Game.switch('GAME');
        },
        { size: g.away ? 24 : 28, color: blocked ? '#3a4468' : CONFIG.COLOR.cyan,
          textColor: blocked ? '#8fa3c8' : CONFIG.COLOR.ink });
    });

    this.buttons.add('CLOSE', s.right - 260, s.bottom - 130, 220, 96,
      () => Game.switch('GAME'), { size: 34, color: CONFIG.COLOR.lime,
        textColor: CONFIG.COLOR.ink });
    this.buttons.add('CENTRE', s.right - 520, s.bottom - 130, 230, 96,
      () => this._centre(), { size: 30, color: '#232b44', textColor: '#fff' });
    // FIT WALKS THE LEVELS. One button, two stops: the district you are in,
    // and the whole continent. It is the pointer's version of the shoulder
    // buttons, and it means neither input has to hunt for a zoom that happens
    // to land on the level you wanted.
    this.buttons.add('FIT', s.left + 40, s.bottom - 130, 180, 96,
      () => {
        if (this.level() === 'WORLD') { this.zoom = this._fitZoom(); this._centre(); }
        else { this.zoom = this._worldFitZoom(); this._centreWorld(); }
      }, { size: 30, color: '#232b44', textColor: '#fff' });
  }

  _centre() {
    const p = Game.states.GAME && Game.states.GAME.player;
    if (p) { this.cx = p.x; this.cy = p.y; }
  }

  // Centre on the CONTINENT, not on the player. Fitting the world while still
  // centred on the machine put half the districts off the side of the screen -
  // a fit that does not frame what it fits is not a fit.
  _centreWorld() {
    const lay = WorldLayout.build();
    const here = World.district && lay[World.district.id];
    if (!here) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of Object.keys(lay)) {
      const a = lay[id];
      x0 = Math.min(x0, a.x - a.w / 2); x1 = Math.max(x1, a.x + a.w / 2);
      y0 = Math.min(y0, a.y - a.h / 2); y1 = Math.max(y1, a.y + a.h / 2);
    }
    // The layout is anchored so the district you are in sits where it really
    // is, so the same offset converts the continent's centre into world units.
    this.cx = (-here.x + (x0 + x1) / 2) * WORLD.CHUNK;
    this.cy = (-here.y + (y0 + y1) / 2) * WORLD.CHUNK;
  }

  // WHICH OF THE THREE LEVELS THE ZOOM IS AT. Expressed as a multiple of the
  // zoom at which the whole district fits, so the thresholds mean the same
  // thing in a 20x20 district and in Rail Spine's 64x16.
  level() {
    const fit = this._fitZoom() || 1;
    const k = this.zoom / fit;
    if (k < MAP.LEVEL_DISTRICT) return 'WORLD';
    if (k > MAP.LEVEL_LOCAL) return 'LOCAL';
    return 'DISTRICT';
  }

  // PLACE A WAYPOINT where the view is centred. "A waypoint puts a pip on the
  // compass strip. This is the thing that makes a 20-minute world navigable."
  //
  // At the centre of the view rather than under a cursor, because the pan IS
  // the cursor on a pad: you already moved the map to look at the thing.
  _districtName(did) {
    const d = (typeof DISTRICTS !== 'undefined') ? DISTRICTS[did] : null;
    return (d && d.name) || String(did || '').toUpperCase();
  }

  placeWaypoint() {
    if (typeof Waypoint === 'undefined' || !World.district) return;
    if (this.level() === 'WORLD') {
      // A waypoint on the world view would name a district, not a place in
      // one, and the compass cannot point across a gate. Say so rather than
      // dropping a pip that silently means nothing.
      this.toast = 'ZOOM IN TO PLACE A WAYPOINT'; this.toastT = 3;
      return;
    }
    const set = Waypoint.set(this.cx, this.cy, World.district.id);
    this.toast = set ? 'WAYPOINT SET' : 'WAYPOINT CLEARED';
    this.toastT = 2;
  }

  update(dt) {
    // Buttons first: a pad walks the fast-travel list and CLOSE / CENTRE /
    // FIT the same way it walks any other screen in the game.
    if (typeof UINav !== 'undefined') UINav.update(this.buttons);
    this.toastT = Math.max(0, (this.toastT || 0) - dt);

    // PAN on the move stick. Scaled by zoom so a pan feels the same speed on
    // screen however far out you are.
    const m = Controls.move;
    if (m.mag > 0.08) {
      this.cx += (m.dx * MAP.PAN_SPEED * dt) / this.zoom * 0.5;
      this.cy += (m.dy * MAP.PAN_SPEED * dt) / this.zoom * 0.5;
    }

    // ZOOM on the aim stick's Y, so a single stick can do it on a pad with no
    // usable shoulders. Up is in, which matches every map anyone has used.
    const a = Controls.aim;
    if (a && Math.abs(a.dy) > 0.35 && a.mag > 0.35) {
      this.zoom *= Math.pow(MAP.ZOOM_RATE, -a.dy * dt);
    }
    // Rotate buttons double as zoom on a pad: they are free on this screen and
    // a shoulder is where a player reaches for zoom first.
    if (Controls.rotateL.pressed) this.zoom /= Math.pow(MAP.ZOOM_RATE, dt);
    if (Controls.rotateR.pressed) this.zoom *= Math.pow(MAP.ZOOM_RATE, dt);
    this.zoom = Math.max(this._zoomFloor(),
      Math.min(MAP.ZOOM_MAX * this._fitZoom(), this.zoom));

    // ACTION places a waypoint, DASH closes — A and B, the way this game
    // binds them everywhere else. Item 3 asks for exactly this pair.
    if (Controls.action && Controls.action.justPressed) this.placeWaypoint();
    // Dash closes, the way B does everywhere else in this game.
    if (Controls.dash.justPressed) { Game.switch('GAME'); return; }

    // Keep the view over the district, with a chunk of slack so the edge is
    // reachable rather than pinned exactly at the boundary.
    const pad = WORLD.CHUNK;
    this.cx = Math.max(-pad, Math.min(World.bounds.w + pad, this.cx));
    this.cy = Math.max(-pad, Math.min(World.bounds.h + pad, this.cy));
  }

  pointerDown(id, x, y) {
    if (this.buttons.hit(x, y)) return;
    this._drag = { id, x, y };
  }

  pointerMove(id, x, y) {
    if (!this._drag || this._drag.id !== id) return;
    this.cx -= (x - this._drag.x) / this.zoom;
    this.cy -= (y - this._drag.y) / this.zoom;
    this._drag.x = x; this._drag.y = y;
  }

  pointerUp(id) { if (this._drag && this._drag.id === id) this._drag = null; }

  render() {
    const ctx = R.ctx;
    R.clear(CONFIG.COLOR.bg);
    const s = Display.safe;
    const midX = (s.left + s.right) / 2;
    const midY = (s.top + s.bottom) / 2;
    const d = World.district;
    if (!d) return;

    const toX = (wx) => midX + (wx - this.cx) * this.zoom;
    const toY = (wy) => midY + (wy - this.cy) * this.zoom;
    const cell = WORLD.CHUNK * this.zoom;
    const level = this.level();

    // ---- WORLD: the continent, and nothing about chunks ------------------
    // "District shapes, roads between them, garages, where you are. No chunk
    // detail." At this scale a chunk grid is noise, and the question is not
    // "where in the Yard" but "which place".
    if (level === 'WORLD') {
      this._renderWorld(ctx, s, midX, midY, toX, toY);
    } else {
      // The district, chunk by chunk. Explored ground wears its template
      // colour; unexplored ground is a flat hint, so the shape of what you
      // have covered is legible from across the room.
      for (let cy = 0; cy < d.rows; cy++) {
        for (let cx = 0; cx < d.cols; cx++) {
          const x = toX(cx * WORLD.CHUNK), y = toY(cy * WORLD.CHUNK);
          if (x + cell < s.left || x > s.right ||
              y + cell < s.top || y > s.bottom) continue;
          const seen = World.isExplored(cx, cy);
          R.rect(x, y, cell - 2, cell - 2,
            seen ? (MAP_INK[d.templateAt(cx, cy)] || MAP_INK.open)
                 : 'rgba(255,255,255,0.05)');
          if (World.loaded[World.key(cx, cy)]) {
            R.roundRect(x, y, cell - 2, cell - 2, 4, null, 'rgba(34,217,255,0.35)', 3);
          }
        }
      }
    }

    // ---- LOCAL: full obstacle detail, only where you have actually been --
    // Drawn from the cached per-chunk outlines, not from the live chunks: a
    // map that only shows the ground you are standing on cannot do the job
    // Block 8 asks of it — remembering a wall from hour two and coming back
    // for it with the Mammoth. And it is held to LOCAL because at district
    // zoom every building is a sub-pixel smear that only makes the ground
    // look dirty.
    if (level === 'LOCAL') {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = CONFIG.COLOR.steel;
      for (let cy = 0; cy < d.rows; cy++) {
        for (let cx = 0; cx < d.cols; cx++) {
          const ox = toX(cx * WORLD.CHUNK), oy = toY(cy * WORLD.CHUNK);
          if (ox + cell < s.left || ox > s.right ||
              oy + cell < s.top || oy > s.bottom) continue;
          const ol = World.outlineOf(cx, cy);
          if (!ol) continue;
          for (let i = 0; i < ol.length; i += 5) {
            const x = toX(ol[i + 1]), y = toY(ol[i + 2]);
            if (ol[i] === 0) {
              ctx.beginPath();
              ctx.arc(x, y, Math.max(1.5, ol[i + 3] * this.zoom), 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillRect(x, y, Math.max(1.5, ol[i + 3] * this.zoom),
                Math.max(1.5, ol[i + 4] * this.zoom));
            }
          }
        }
      }
      ctx.restore();
    }

    // ---- DISTRICT and LOCAL: shortcuts, then barriers --------------------
    // Shortcuts first so a barrier that opens one draws on top of its own line.
    if (level !== 'WORLD') this._renderShortcuts(ctx, s, d, toX, toY);
    if (level !== 'WORLD') this._renderBarriers(ctx, s, d, toX, toY, level);

    // GARAGES. Owned ones are a filled diamond, held ones an outline, so the
    // map answers 'where can I bank this' at a glance.
    if (typeof Garages !== 'undefined' && level !== 'WORLD') {
      for (const g of Garages.list) {
        const gx = toX(g.x), gy = toY(g.y);
        if (gx < s.left - 40 || gx > s.right + 40 ||
            gy < s.top - 40 || gy > s.bottom + 40) continue;
        const own = Garages.owned(g.id);
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = own ? CONFIG.COLOR.cyan : 'rgba(0,0,0,0.5)';
        ctx.strokeStyle = own ? CONFIG.COLOR.ink : CONFIG.COLOR.steel;
        ctx.lineWidth = 4;
        ctx.fillRect(-11, -11, 22, 22);
        ctx.strokeRect(-11, -11, 22, 22);
        ctx.restore();
        // CLEAR OF THE PLAYER PIP, not just clear of its own diamond. The
        // name sat 26px above a 22px diamond, which is fine until you are
        // STANDING at the garage — and standing at the garage is exactly when
        // you are most likely to be looking at the map. The player ring then
        // covered the name of the place you were in.
        R.smallText(g.name, gx, gy - 46, 20,
          own ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel, 'center');
      }
    }

    // THE WRECK MARKER. 3.3 says it must be findable on the map at ANY range,
    // so it is drawn even when it is off the edge of the view: clamped to the
    // border with an arrow, because a marker you can only see once you are
    // already near it is not a marker.
    if (typeof Wrecks !== 'undefined' && Wrecks.current &&
        Wrecks.current.district === d.id) {
      const wx = toX(Wrecks.current.x), wy = toY(Wrecks.current.y);
      const cx2 = Math.max(s.left + 30, Math.min(s.right - 30, wx));
      const cy2 = Math.max(s.top + 30, Math.min(s.bottom - 30, wy));
      const off = (cx2 !== wx || cy2 !== wy);
      R.circle(cx2, cy2, 13, CONFIG.COLOR.red, CONFIG.COLOR.ink, 4);
      R.smallText(off ? 'WRECK \u2192' : 'YOUR WRECK', cx2, cy2 - 28, 22,
        CONFIG.COLOR.red, 'center');
    }

    // THE WAYPOINT the player placed, and the crosshair showing where the
    // next one would go. The crosshair matters: on a pad the pan IS the
    // cursor, and without a mark at the centre "A places a waypoint" does not
    // say WHERE.
    if (level !== 'WORLD') {
      R.circle(midX, midY, 22, null, 'rgba(255,255,255,0.30)', 2);
      R.rect(midX - 30, midY - 1, 60, 2, 'rgba(255,255,255,0.30)');
      R.rect(midX - 1, midY - 30, 2, 60, 'rgba(255,255,255,0.30)');
    }
    if (typeof Waypoint !== 'undefined' && Waypoint.active(d.id)) {
      const wx = toX(Waypoint.x), wy = toY(Waypoint.y);
      R.circle(wx, wy, 14, null, CONFIG.COLOR.white, 4);
      R.circle(wx, wy, 5, CONFIG.COLOR.white);
      R.smallText('WAYPOINT', wx, wy + 20, 20, CONFIG.COLOR.white, 'center');
    }

    // The player, and the view they are looking at.
    const p = Game.states.GAME && Game.states.GAME.player;
    if (p) {
      const px = toX(p.x), py = toY(p.y);
      const a = Math.atan2(p.aimY, p.aimX);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a) * 26, py + Math.sin(a) * 26);
      ctx.lineTo(px + Math.cos(a + 2.5) * 16, py + Math.sin(a + 2.5) * 16);
      ctx.lineTo(px + Math.cos(a - 2.5) * 16, py + Math.sin(a - 2.5) * 16);
      ctx.closePath();
      ctx.fillStyle = CONFIG.COLOR.lime;
      ctx.fill();
      ctx.restore();
      R.circle(px, py, 8, CONFIG.COLOR.white, CONFIG.COLOR.ink, 3);
    }

    // Chrome.
    //
    // ON A BACKING, for the same reason the hint row below is: the map is
    // drawn edge to edge and the header sits ON it, so anything the district
    // holds near its top edge draws THROUGH the title. In the Yard that was a
    // barrier marker's "?" hanging under THE YARD with no barrier attached to
    // it — a question mark floating in the sky, which reads as a bug because
    // it looks exactly like one.
    {
      const g = ctx.createLinearGradient(0, s.top, 0, s.top + 170);
      g.addColorStop(0, 'rgba(8,10,20,0.94)');
      g.addColorStop(0.72, 'rgba(8,10,20,0.86)');
      g.addColorStop(1, 'rgba(8,10,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.left, s.top, s.right - s.left, 170);
    }
    R.text(d.name, midX, s.top + 70, 64, CONFIG.COLOR.yellow);
    const explored = World.exploredCount();
    const total = d.cols * d.rows;
    R.smallText(explored + ' / ' + total + ' CHUNKS EXPLORED  •  ' +
      Math.round(explored / total * 100) + '%',
      midX, s.top + 130, 30, CONFIG.COLOR.steel);

    // WHICH LEVEL YOU ARE ON, and the two either side of it. A zoom that
    // silently changes what is drawn is a zoom the player thinks is broken;
    // naming the three makes the change a feature rather than a glitch.
    const lx = s.left + 40;
    // LAID OUT BY WIDTH, NOT ON A FIXED PITCH. The three were spaced 120px
    // apart, and DISTRICT — eight characters, and 26pt because it is the one
    // that is selected — is about 130 wide. So the label that says where you
    // are printed straight through the label beside it, and only when it was
    // the selected one, which is most of the time. Found in a still.
    let lxi = lx;
    MAP.LEVELS.forEach((L) => {
      const on = L === level;
      const size = on ? 26 : 22;
      R.smallText(L, lxi, s.top + 76, size,
        on ? CONFIG.COLOR.yellow : '#4a5470');
      // Arial Black caps run about 0.62 of the point size per character. The
      // renderer has no measure helper that does not need a live context, and
      // this only has to be right enough to keep three words apart.
      lxi += L.length * size * 0.62 + 34;
    });

    // THE CONTROL HINTS, LEGIBLE AND ON THE SCREEN. They were drawn in
    // CONFIG.COLOR.grid — the colour the floor grid is drawn in — which on the
    // map's dark ground is very nearly the ground, and the line ran past the
    // right edge and lost DASH CLOSES entirely. A hint row you cannot read is
    // a hint row that is not there, and this screen's whole claim is that it
    // works with the mouse unplugged.
    // TWO LINES, ON A BACKING. One line at 24pt ran off the right edge and
    // lost DASH CLOSES — the one hint a player stuck on this screen needs
    // most — and the rest of it sat on top of the district's own barrier
    // labels. Both faults were invisible headless and obvious in a still.
    {
      const rows = ['STICK PAN  •  AIM UP/DOWN OR SHOULDERS ZOOM',
                    'ACTION SETS A WAYPOINT  •  DASH CLOSES'];
      const hy = s.bottom - 196;
      R.rect(midX - 460, hy - 8, 920, 74, 'rgba(11,14,26,0.86)');
      rows.forEach((t, i) => {
        R.smallText(t, midX, hy + i * 32, 22, CONFIG.COLOR.steel, 'center');
      });
    }
    if (this.toastT > 0 && this.toast) {
      R.text(this.toast, midX, s.bottom - 220, 32, CONFIG.COLOR.orange);
    }
    this.buttons.draw();
  }

  // ---- WORLD LEVEL --------------------------------------------------------
  // The continent, laid out from the gates (see WorldLayout). Districts are
  // rectangles proportional to their real size, the gates between them are
  // roads, and the one you are standing in is lit.
  _renderWorld(ctx, s, midX, midY, toX, toY) {
    const lay = WorldLayout.build();
    const here = World.district.id;
    // The world layout is in CHUNKS; the view is in world units. One chunk is
    // WORLD.CHUNK units, so the two agree by multiplying — which also means
    // the world view and the district view share a zoom and a pan, and going
    // between them is continuous rather than a cut.
    const U = WORLD.CHUNK;
    const hereAt = lay[here];
    if (!hereAt) return;
    // Anchor the layout so the district you are in sits where it really is.
    const ox = -hereAt.x * U, oy = -hereAt.y * U;

    // THE ROADS BETWEEN THEM, first, so districts draw on top of their ends.
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(143,163,200,0.45)';
    ctx.lineWidth = Math.max(3, 220 * this.zoom);
    for (const l of WorldLayout.links()) {
      ctx.beginPath();
      ctx.moveTo(toX(ox + l.a.x * U), toY(oy + l.a.y * U));
      ctx.lineTo(toX(ox + l.b.x * U), toY(oy + l.b.y * U));
      ctx.stroke();
    }
    ctx.restore();

    for (const id of DISTRICT_LIST) {
      const a = lay[id];
      if (!a) continue;
      const dd = DISTRICTS[id];
      const w = a.w * U * this.zoom, h = a.h * U * this.zoom;
      const x = toX(ox + (a.x - a.w / 2) * U);
      const y = toY(oy + (a.y - a.h / 2) * U);
      if (x + w < s.left || x > s.right || y + h < s.top || y > s.bottom) continue;
      const home = id === here;
      // Somewhere you have been wears its ground colour; somewhere you have
      // not is an outline. The map is a record of where you have got to.
      const been = home || World.districtVisited(id);
      R.rect(x, y, w, h, been ? MAP_INK.open : 'rgba(255,255,255,0.04)');
      R.roundRect(x, y, w, h, 6, null,
        home ? CONFIG.COLOR.lime : CONFIG.COLOR.steel, home ? 5 : 3);
      R.smallText(dd.name, x + w / 2, y + h / 2 - 12,
        Math.max(16, Math.min(30, w * 0.09)),
        home ? CONFIG.COLOR.lime : CONFIG.COLOR.steel, 'center');

      // GARAGES at world level are a count, not pips: at this scale a pip is
      // a smudge, and what you want to know is whether a place has a bank.
      if (typeof Garages !== 'undefined' && home) {
        const owned = Garages.ownedList().length;
        R.smallText(owned + ' GARAGE' + (owned === 1 ? '' : 'S'),
          x + w / 2, y + h / 2 + 14, 18, CONFIG.COLOR.cyan, 'center');
      }
    }

    // WHERE YOU ARE, inside the district you are in — the one piece of
    // sub-district detail this level keeps, because "which place" is only
    // half the question.
    const p = Game.states.GAME && Game.states.GAME.player;
    if (p) R.circle(toX(p.x), toY(p.y), 7, CONFIG.COLOR.lime, CONFIG.COLOR.ink, 3);
  }

  // ---- SHORTCUTS ----------------------------------------------------------
  //
  // B.5: "A shortcut opened once stays open forever and is saved. Cutter
  // doors, drilled tunnels, dropped ladders, opened shutters. THIS IS WHAT
  // MAKES THE MAP FEEL LIKE IT'S BECOMING YOURS. Mark them on the map screen."
  //
  // The system has existed since Block 8 — `Barriers.tryOpen` writes
  // `Progress.shortcuts` and the flag survives a save — and the last half of
  // that sentence had never been done. A route that opens and is never drawn
  // is a route the player has to remember, which is the opposite of the point.
  //
  // Three states, and the middle one is the one that does the work:
  //   OPEN      a solid lime line. Yours now.
  //   KNOWN     dashed, and NAMED with what would open it — but only once you
  //             have seen the barrier, which is the same rule the barrier
  //             markers run on. A map that lists routes you have never met is
  //             a walkthrough.
  //   UNSEEN    nothing at all.
  _renderShortcuts(ctx, s, d, toX, toY) {
    const list = (d._spec && d._spec.shortcuts) || d.shortcuts || [];
    if (!list.length) return;
    const C = WORLD.CHUNK;
    for (const sc of list) {
      const ax = toX(sc.from[0] * C + C / 2), ay = toY(sc.from[1] * C + C / 2);
      const bx = toX(sc.to[0] * C + C / 2), by = toY(sc.to[1] * C + C / 2);
      if (Math.max(ax, bx) < s.left || Math.min(ax, bx) > s.right ||
          Math.max(ay, by) < s.top || Math.min(ay, by) > s.bottom) continue;

      const open = !!(typeof Progress !== 'undefined' && Progress.shortcuts &&
                      Progress.shortcuts[sc.opensWith]);
      // SEEN means the chunk the opening barrier stands in has been explored.
      const seen = World.isExplored(sc.from[0], sc.from[1]);
      if (!open && !seen) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = open ? 6 : 4;
      ctx.strokeStyle = open ? CONFIG.COLOR.lime : 'rgba(143,163,200,0.55)';
      if (!open) ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
      // Both ends get a ring, so a shortcut reads as a ROUTE rather than as a
      // stray line across the district.
      for (const [px, py] of [[ax, ay], [bx, by]]) {
        R.circle(px, py, open ? 8 : 6, null,
          open ? CONFIG.COLOR.lime : 'rgba(143,163,200,0.55)', 3);
      }
      ctx.restore();

      // The label sits a third of the way in from the FAR end, not at the
      // midpoint: the near end is where the opening barrier stands, and its
      // own marker is already labelled there. At the midpoint the two strings
      // printed over each other - "SHORTCUT - CHEETAH VAULT" across
      // "GAP - CHEETAH VAULT" - which is only visible in a picture.
      const mid = { x: bx + (ax - bx) * 0.33, y: by + (ay - by) * 0.33 };
      if (open) {
        R.smallText('SHORTCUT', mid.x, mid.y - 22, 19, CONFIG.COLOR.lime, 'center');
      } else {
        // NAMED, not just dashed. "There is a way through here and this is
        // what would open it" is a plan; a dashed line on its own is a tease.
        const t = (typeof BARRIER_TYPES !== 'undefined')
          ? this._barrierTypeOf(d, sc.opensWith) : null;
        R.smallText(t ? ('SHORTCUT — ' + t.by) : 'SHORTCUT',
          mid.x, mid.y - 22, 18, CONFIG.COLOR.steel, 'center');
      }
    }
  }

  // The barrier type behind an id, so a shortcut can name its own opener
  // without a second table that would drift from the first.
  _barrierTypeOf(d, id) {
    const rows = (d._spec && d._spec.barriers) || d.barriers || {};
    for (const key of Object.keys(rows)) {
      for (const row of rows[key]) {
        if (row[3] === id) return BARRIER_TYPES[row[2]] || null;
      }
    }
    return null;
  }

  // ---- BARRIERS, AND WHAT OPENS THEM --------------------------------------
  // "Barriers show their opener once you've seen them: SMASHABLE — MAMMOTH."
  //
  // SEEN means the chunk it stands in has been explored. That is the honest
  // reading — you cannot have walked up to a barrier in a chunk you have
  // never entered — and it costs no new save field, which matters because
  // SAVE_FORMAT was frozen before Block 15 made it a migration.
  //
  // An OPENED one is drawn as a shortcut instead: B.5 says a shortcut opened
  // once stays open forever, and "this is what makes the map feel like it is
  // becoming yours" only lands if the map shows it.
  _renderBarriers(ctx, s, d, toX, toY, level) {
    if (typeof BARRIER_TYPES === 'undefined') return;
    const rows = (d._spec && d._spec.barriers) || d.barriers || {};
    for (const key of Object.keys(rows)) {
      const bits = key.split(',');
      const cx = +bits[0], cy = +bits[1];
      for (const row of rows[key]) {
        const wx = cx * WORLD.CHUNK + row[0];
        const wy = cy * WORLD.CHUNK + row[1];
        const x = toX(wx), y = toY(wy);
        if (x < s.left - 60 || x > s.right + 60 ||
            y < s.top - 60 || y > s.bottom + 60) continue;
        const t = BARRIER_TYPES[row[2]];
        if (!t) continue;
        const id = row[3];
        const open = !!(typeof Progress !== 'undefined' && Progress.shortcuts &&
                        id && Progress.shortcuts[id]);
        const seen = World.isExplored(cx, cy);

        if (open) {
          // A way through. Green, because it is yours now.
          R.circle(x, y, 9, CONFIG.COLOR.lime, CONFIG.COLOR.ink, 3);
          if (level === 'LOCAL') {
            R.smallText('OPEN', x, y + 14, 18, CONFIG.COLOR.lime, 'center');
          }
          continue;
        }
        R.rect(x - 9, y - 9, 18, 18, seen ? CONFIG.COLOR.orange : '#3a4468');
        R.roundRect(x - 9, y - 9, 18, 18, 3, null, CONFIG.COLOR.ink, 3);
        // THE OPENER, NAMED — but only once you have seen the thing. A map
        // that lists the openers of barriers you have never met is a
        // walkthrough, and B.2's whole point is that you read the barrier.
        if (seen) {
          R.smallText(t.name + ' — ' + t.by, x, y + 14,
            level === 'LOCAL' ? 20 : 17, CONFIG.COLOR.orange, 'center');
        } else {
          R.smallText('?', x, y + 14, 18, '#4a5470', 'center');
        }
      }
    }
  }
}

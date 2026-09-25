// SCRAPCORE: BREAKLANDS — STANDING OBJECTS AT 44° (DRAWING_AT_44.md)
//
// "Three objects have now been drawn and all three had the same fault: the
//  barrier read as a floor panel, the ground patches read as a floor, the
//  horizon silhouettes read as a ceiling. Every one of them was drawn on the
//  ground plane and nothing else."
//
// This file is that spec, once, so the fourth object does not have the same
// fault. Everything that is not literally paint on the ground draws through
// `Props.standing()` and gets all four parts.
//
// ---------------------------------------------------------------------------
// THE ONE FACT EVERYTHING FOLLOWS FROM
//
//   Ground depth is squashed. Height is not.
//
// `Camera.begin()` applies the 44° pitch as a single Y scale on the ground
// plane (~0.72). So 100 world units going AWAY from you draw 72 pixels up the
// screen, and 100 units of HEIGHT draw 100. Height is drawn 1.4x larger than
// the equivalent ground distance, and that difference is the only thing that
// tells a player something is standing up.
//
// Inside the world transform everything is already being squashed, so to put
// `h` pixels of height on screen we draw `h / groundScale` world units up.
// That division IS the 1.4x, and leaving it out is exactly what made the
// collapsed wall read as a rug.
//
// ---------------------------------------------------------------------------
// THE THREE-TONE RULE
//
//   top     lightest   it faces the sky
//   front   mid        it faces the camera, lit obliquely
//   shadow  darkest    and darker than the ground it falls on
//
// "If a player can't tell the top from the front at a glance, the object is
//  flat." So `Props.tones()` derives all three from one base colour rather
//  than letting each caller pick, because ten objects with the same slightly
//  wrong values read as a place and ten individually-tuned ones read as a
//  collage.

// ---------------------------------------------------------------------------
// THE PALETTE (content/draft_props.js, absorbed).
//
// EVERY PROP DECLARES ITS HEIGHT, and that is not decoration: the front
// face, the top face and the cast shadow are all derived from it. `A prop
// with no height cannot be drawn correctly — it will read as a floor panel,
// which is what happened to the first two passes of the collapsed wall.`
//
// Height is in PLAYER UNITS. The player core is 1.
const PROPS = {

  // ======================= UNIVERSAL =====================================
  crate:          { height: 0.9,  collide: true,  variants: 3 },
  oildrum:        { height: 1.0,  collide: true,  variants: 2 },
  container:      { height: 1.4,  collide: true,  variants: 4, tint: 'body' },
  containerstack: { height: 4.2,  collide: true,  variants: 3, tint: 'body' },
  scrappile:      { height: 1.0,  collide: true,  variants: 6 },
  debrispillar:   { height: 3.2,  collide: true,  variants: 3 },
  rubble:         { height: 0.35, collide: false, variants: 5 },
  pipe_run:       { height: 0.8,  collide: true,  variants: 3 },
  cablebundle:    { height: 0.25, collide: false, variants: 4 },

  // ======================= THE YARD ======================================
  gantry:         { height: 6.0,  collide: 'legs', variants: 2 },
  crane:          { height: 22.0, collide: 'legs', variants: 2 },
  sortingbelt:    { height: 1.1,  collide: true,  variants: 3 },
  scrapmount:     { height: 14.0, collide: true,  variants: 4 },
  canteen:        { height: 5.5,  collide: true,  variants: 1 },
  neonsign:       { height: 4.0,  collide: false, variants: 3, emissive: true },

  // ======================= IRONWORKS =====================================
  pourspout:      { height: 7.0,  collide: true,  variants: 2, emissive: true },
  ladlecar:       { height: 3.0,  collide: true,  variants: 2 },
  slagheap:       { height: 5.0,  collide: true,  variants: 4 },
  coolingtower:   { height: 46.0, collide: true,  variants: 2 },
  furnacedoor:    { height: 8.0,  collide: true,  variants: 1, emissive: true },
  ingotrack:      { height: 2.2,  collide: true,  variants: 3 },
  shiftoffice:    { height: 6.0,  collide: true,  variants: 1 },
  stack:          { height: 95.0, collide: true,  variants: 3 },

  // ======================= THE SPRAWL ====================================
  // The most important prop set in the game. A washing line does more work
  // than any boss. Every one of these says "someone lived here".
  housingblock:   { height: 19.0, collide: true,  variants: 6 },
  housingruin:    { height: 12.0, collide: true,  variants: 4 },
  washingline:    { height: 2.6,  collide: false, variants: 3 },
  playgroundframe:{ height: 2.4,  collide: true,  variants: 2 },
  busshelter:     { height: 2.8,  collide: true,  variants: 2 },
  abandonedcar:   { height: 1.2,  collide: true,  variants: 6 },
  bus:            { height: 3.2,  collide: true,  variants: 2 },
  school:         { height: 7.0,  collide: true,  variants: 1 },
  shopfront:      { height: 5.0,  collide: true,  variants: 5 },
  streetlight:    { height: 6.0,  collide: false, variants: 2, emissive: true },
  factorywall:    { height: 11.0, collide: true,  variants: 2 },
  fencerun:       { height: 1.8,  collide: true,  variants: 3 },
  trolleyline:    { height: 1.0,  collide: true,  variants: 1 },

  // ======================= CENTRAL DISPATCH ==============================
  // The draft's five, less the aircon (a ceiling prop in a game with no
  // ceiling). Clean, tall, cold: a server rack is a filing cabinet the size
  // of a bus, a screen wall is the only emissive thing in the building and
  // it is WHITE, and a dispatch desk is a desk. No art yet -- the draft says
  // the art pass must be budgeted, not improvised -- so these draw as the
  // procedural boxes everything draws as until it has a sprite.
  serverrack:     { height: 4.4,  collide: true,  variants: 3 },
  screenwall:     { height: 7.0,  collide: true,  variants: 2, emissive: true },
  dispatchdesk:   { height: 1.3,  collide: true,  variants: 2 },
  signage:        { height: 3.0,  collide: false, variants: 3, emissive: true },

  // ======================= NEON CUT ======================================
  // World neon is MAGENTA, AMBER and WHITE only. Never green, cyan or red —
  // those are faction colours and must never be confusable.
  holoboard:      { height: 9.0,  collide: false, variants: 4, emissive: true },
  neonstrip:      { height: 0.4,  collide: false, variants: 6, emissive: true },
  hangingsign:    { height: 5.5,  collide: false, variants: 5, emissive: true },
  vendingmachine: { height: 2.0,  collide: true,  variants: 3, emissive: true },
  tramstop:       { height: 3.4,  collide: true,  variants: 2, emissive: true },
  citytower:      { height: 34.0, collide: true,  variants: 6 },
  overpass:       { height: 8.0,  collide: true,  variants: 3 },
  overpass_fallen:{ height: 4.5,  collide: true,  variants: 3 },
  addrone:        { height: 0.0,  collide: false, variants: 2, flying: 6.0 },
  puddle:         { height: 0.0,  collide: false, variants: 6, reflective: true },

  // ======================= THE ASH BARRENS ===============================
  roadsign:       { height: 3.2,  collide: false, variants: 4 },
  outpostshack:   { height: 3.6,  collide: true,  variants: 3 },
  wreckpile:      { height: 2.4,  collide: true,  variants: 5 },
  dustdrift:      { height: 0.5,  collide: false, variants: 4 },
  pylon:          { height: 26.0, collide: 'legs', variants: 2 },

  // ======================= BARRIERS ======================================
  // These are not decoration. The player must see WHY they can't pass and
  // guess WHAT would open it. All four parts of DRAWING_AT_44 apply, hard.
  //
  // A barrier is 3-4x the player's height. Anything shorter reads as
  // something you could drive over, which makes not being able to drive over
  // it feel like a bug rather than a rule.
  brk_cracked_wall: {
    height: 3.5, collide: true, variants: 3,
    opener: 'mammoth_smash',
    cues: ['fissure_branching', 'bulge', 'rubble_at_base'],
  },
  brk_climb_face: {
    height: 4.0, collide: true, variants: 3,
    opener: 'crab_climb',
    cues: ['handholds', 'exposed_rebar', 'scrap_ramp'],
  },
  brk_mined_ground: {
    height: 0.3, collide: false, variants: 2,
    opener: 'tank_blast',
    cues: ['mine_casings', 'warning_paint', 'old_craters'],
    note: 'the ONE barrier allowed to be flat, because mined ground is flat. It must be loud in colour instead.',
  },
  brk_cutter_door: {
    height: 3.8, collide: true, variants: 3,
    opener: 'cutter_1',
    cues: ['seam', 'lock', 'hinge'],
  },
  brk_duct_mouth: {
    height: 1.6, collide: true, variants: 2,
    opener: 'core_only',
    cues: ['visibly_core_sized', 'rig_scrape_marks'],
    note: 'the player must SEE their rig will not fit.',
  },
  brk_rubble_wall: {
    height: 3.0, collide: true, variants: 4,
    opener: 'drill_1',
    cues: ['loose_fill', 'collapse_spill', 'soft_face'],
  },
  brk_molten_lane: {
    height: 0.0, collide: false, variants: 3,
    opener: 'kiln_purge', emissive: true,
    cues: ['glow', 'heat_shimmer', 'scorched_edges'],
  },
  brk_flood: {
    height: 0.0, collide: false, variants: 4,
    opener: 'seal_1',
    cues: ['depth_gradient', 'submerged_rooftops', 'debris_line'],
  },
};
const PROP_LIST = Object.keys(PROPS);

const PROP_UNIT = 92;          // world units per 1 player-height

const Props = {
  // ITEM 1b. How far an occluding building fades, and how fast.
  //
  // ~35% body, ink outline kept at FULL strength: the standard top-down
  // solution, and the outline is what stops a faded building reading as a
  // hole in the world. It still has a silhouette, so it is still obviously
  // a thing you cannot drive through.
  FADE_TO: 0.35,
  FADE_TIME: 0.15,

  // ONE light direction for the whole world. Down and to the right, so
  // shadows fall away from the object instead of hiding under it.
  // "Consistency matters far more than accuracy."
  LIGHT: { dx: 0.52, dy: 0.40 },
  SHADOW_ALPHA: 0.42,

  // How much world-Y a given height costs, accounting for the ground squash.
  rise(height) {
    const s = (typeof Iso !== 'undefined' && Iso.groundScale) ? Iso.groundScale : 1;
    return (height * PROP_UNIT) / Math.max(0.2, s);
  },

  // Three values from one colour. `k` > 1 lightens, < 1 darkens.
  _shade(hex, k) {
    const n = parseInt(String(hex).slice(1), 16);
    const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * k)));
    const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * k)));
    const b = Math.max(0, Math.min(255, Math.round((n & 255) * k)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },
  tones(base) {
    return {
      top: this._shade(base, 1.34),
      front: this._shade(base, 0.86),
      side: this._shade(base, 0.62),
      ink: '#0b0e1a',
    };
  },

  // ---- THE FOUR PARTS ----------------------------------------------------
  // o = { x, y, w, d, height, colour, ink, round }
  //   x, y     centre of the FOOTPRINT, on the ground
  //   w, d     footprint width and depth, in world units
  //   height   in player heights (1 = the player core)
  standing(ctx, o) {
    const w = o.w, d = o.d === undefined ? o.w * 0.62 : o.d;
    // `fade` 0 = solid, 1 = fully faded. Applied to the FILLS only; the
    // strokes below run at full alpha, which is the whole trick.
    const fade = o.fade || 0;
    const bodyA = 1 - fade * (1 - Props.FADE_TO);
    const up = this.rise(o.height || 1);
    const t = this.tones(o.colour || '#2c2f36');
    const L = this.LIGHT;

    // 1. THE CAST SHADOW. On the ground, offset in the light direction,
    //    squashed with the ground because it IS the ground. The cheapest
    //    height cue in existence, and an object without one floats.
    ctx.globalAlpha = bodyA;
    ctx.fillStyle = 'rgba(0,0,0,' + this.SHADOW_ALPHA + ')';
    ctx.beginPath();
    ctx.ellipse(o.x + L.dx * o.height * PROP_UNIT * 0.5,
                o.y + L.dy * o.height * PROP_UNIT * 0.5,
                w * 0.56, d * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    const x0 = o.x - w / 2, x1 = o.x + w / 2;
    const near = o.y + d / 2, far = o.y - d / 2;

    // 2. THE TOP FACE. The footprint lifted by the height. Lightest, because
    //    it faces the sky. Drawn FIRST so the front face overlaps it.
    ctx.fillStyle = t.top;
    ctx.strokeStyle = t.ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x0, far - up);
    ctx.lineTo(x1, far - up);
    ctx.lineTo(x1, near - up);
    ctx.lineTo(x0, near - up);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // 3. THE FRONT FACE — the one that is always missing. Vertical, UNSQUASHED,
    //    rising from the footprint's near edge. This is the surface that says
    //    "you cannot drive through me".
    ctx.fillStyle = t.front;
    ctx.beginPath();
    ctx.moveTo(x0, near);
    ctx.lineTo(x1, near);
    ctx.lineTo(x1, near - up);
    ctx.lineTo(x0, near - up);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // A darker side cheek on the shadowed edge. Not in the spec's four, but it
    // is one line and it stops a wide object reading as a flat card.
    if (w > 120) {
      ctx.fillStyle = t.side;
      ctx.beginPath();
      ctx.moveTo(x0, near);
      ctx.lineTo(x0, near - up);
      ctx.lineTo(x0 + w * 0.10, far - up);
      ctx.lineTo(x0 + w * 0.10, far);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    ctx.globalAlpha = 1;
    // THE OUTLINE, at full strength, after everything else. A faded
    // building keeps its silhouette or it reads as a hole in the world.
    if (fade > 0.01) {
      ctx.strokeStyle = t.ink;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x0, near);
      ctx.lineTo(x0, near - up);
      ctx.lineTo(x0, far - up);
      ctx.lineTo(x1, far - up);
      ctx.lineTo(x1, near - up);
      ctx.lineTo(x1, near);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0, near - up); ctx.lineTo(x1, near - up);
      ctx.stroke();
    }
    return { x0, x1, near, far, up, tones: t, fade };
  },

  // ---- ONE PROP, FROM THE PALETTE ---------------------------------------
  // Everything a prop needs comes from its palette row, so placing one is a
  // name and a position and nothing else.
  spec(kind) { return PROPS[kind] || PROPS.crate; },
  height(kind) { return this.spec(kind).height; },
  // Returns the RAW value: true, false, or 'legs'. It used to coerce to a
  // boolean, which quietly threw away the only case that matters - `legs`
  // means only the supports collide, and a gantry you cannot drive under
  // is just a wall with a silly shape.
  collides(kind) {
    const c = this.spec(kind).collide;
    return c === false ? false : c;
  },

  // Footprint width for a prop, derived from its height so a smokestack is
  // not the same size on the ground as a crate. Tall things are narrow;
  // buildings are wide. One curve rather than a second table to keep in step.
  footprint(kind) {
    const h = this.height(kind);
    if (h <= 0.5) return 140;
    if (h <= 1.5) return 150;
    if (h <= 4) return 230;
    if (h <= 8) return 420;
    if (h <= 25) return 620;
    if (h <= 60) return 380;          // towers and silos: tall and narrow
    return 300;                       // smokestacks: taller and narrower
  },

  // ---- THE NEON, WHICH IS THE DISTRICT'S AND NOT THIS FILE'S -------------
  //
  // It used to be this, in two places:
  //
  //     ['#ff3fa4', '#ffb020', '#ffffff'][Math.floor(seed) % 3]     // signs
  //     k > 0.96 ? white : 'rgba(255,176,32,0.50)'                  // windows
  //
  // An even three-way split for signs and a hardcoded amber for windows, in
  // every district. Windows outnumber signs by two orders of magnitude, so the
  // measured world came out 99% AMBER and 0% MAGENTA and six districts looked
  // like one. The colour belongs to the place, so it comes from the place.
  //
  // Returns null when this particular prop is one of the dead ones -- which is
  // how "sparse and failing" is said without deleting the streetlights. A dead
  // streetlight has to BE there for the working one to mean anything.
  // A hex colour at an alpha. The windows are translucent so the building
  // behind them still reads, and a hex string cannot carry that.
  rgba(hex, a) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3
      ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' +
           (n & 255) + ',' + a + ')';
  },

  // WHICH COLOUR, from the district's weighted mix. No lit/dead decision here:
  // that is `neonPick`'s job for signs, and the windows have their own density
  // in `neon.windows`. Keeping them separate matters -- the first version ran
  // windows through the `lit` gate as well, so in the Sprawl (lit 0.30) SEVEN
  // IN TEN lit windows came back null and fell through to a hardcoded amber
  // fallback. The district Aaron made white-led measured 86% amber, and the
  // cause was a fallback colour, not the palette.
  neonHue(neon, seed, salt) {
    if (!neon || !neon.mix || !neon.mix.length) return null;
    let total = 0;
    for (const m of neon.mix) total += m[1];
    if (total <= 0) return null;
    const b = (Math.abs(seed * 40503 + (salt || 0) * 97) % 977) / 977;
    let t = b * total;
    for (const m of neon.mix) { t -= m[1]; if (t < 0) return m[0]; }
    return neon.mix[neon.mix.length - 1][0];
  },

  // IS THIS ONE LIT AT ALL, and if so what colour. Signs only. Returning null
  // is how "sparse and failing" is said without deleting the streetlights: a
  // dead streetlight has to BE there for the working one to mean anything.
  neonPick(neon, seed, salt) {
    if (!neon || !neon.mix || !neon.mix.length) return null;
    // A draw independent of the colour draw, so the dimmest districts are not
    // also the least varied.
    const a = (Math.abs(seed * 2654435761) % 1000) / 1000;
    // SHUT IT DOWN: "the lights in Neon Cut go out." Every sign, every window.
    if (typeof Story !== 'undefined' && Story.shutDown && Story.shutDown()) return null;
    if (a >= (neon.lit === undefined ? 1 : neon.lit)) return null;
    return this.neonHue(neon, seed, salt);
  },

  drawProp(ctx, kind, x, y, seed, colour, fade, neon) {
    const sp = this.spec(kind);
    const w = this.footprint(kind);
    // FLAT THINGS ARE ALLOWED TO BE FLAT, and only these: ground marks,
    // puddles, cables, road paint. Everything else stands up.
    if (!sp.height) {
      ctx.fillStyle = sp.reflective ? 'rgba(60,90,110,0.30)' : 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.5, w * 0.28, seed % 3, 0, Math.PI * 2);
      ctx.fill();
      return null;
    }
    const box = this.standing(ctx, {
      x, y, w, d: w * 0.6, height: sp.height,
      colour: colour || '#2c2f36', fade: fade || 0,
    });
    // Detail follows the body: a faded building should not keep crisp
    // windows over the machine you are trying to see.
    ctx.globalAlpha = 1 - (fade || 0) * (1 - Props.FADE_TO);
    // A BUILDING GETS A FACE. WORLD_FEEL item 8: buildings are things you see
    // the OUTSIDE of, with rooflines and doors that mean something. A grey
    // slab with a top face is a step up from a crate sprite and still not a
    // building.
    if (sp.height >= 4) this._face(ctx, box, seed, sp, neon);

    // Nothing in this world is maintained, so everything streaks. Tall
    // things get more of it, because the run is longer.
    this.streaks(ctx, box, seed, sp.height > 8 ? 6 : 3);
    if (sp.height >= 5) this.cracks(ctx, box, seed, 1);
    // EMISSIVE IS NEVER PAINTABLE — the faction read lives in the glow, and
    // world neon is magenta, amber and white only. Never the faction three.
    if (sp.emissive) {
      // A SIGN MAY BE A DIFFERENT COLOUR FROM A WINDOW, and in the Sprawl it
      // has to be. Aaron's line names two things -- "white and cold sodium,
      // sparse and failing. Dead streetlights, ONE WORKING SIGN" -- and with
      // one mix they fought: the district lights one window in a frame, that
      // single sample decides the measured colour, and a white-led district
      // came out 100% amber because the one window happened to draw sodium.
      // Windows are the cold white; the sign is the sodium.
      const lit = this.neonPick(
        (neon && neon.signMix) ? { mix: neon.signMix, lit: neon.lit } : neon,
        seed, 1);
      if (lit) {
        ctx.fillStyle = lit;
        ctx.globalAlpha = (neon && neon.alpha) || 0.85;
        ctx.fillRect(box.x0 + w * 0.14, box.near - box.up * 0.86,
                     w * 0.72, Math.max(8, box.up * 0.12));
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
    return box;
  },

  // Windows and a door, on the FRONT FACE - the surface the player is
  // actually looking at. Windows are mostly dark because nobody is home; the
  // few that are lit are the cyberpunk in one detail ("the power is still on
  // and nobody is home"), and they use world neon only - amber and white,
  // never a faction colour.
  _face(ctx, box, seed, sp, neon) {
    const rnd = (i) => {
      const x = Math.sin((seed + 11) * 45.164 + i * 91.3) * 8121.77;
      return x - Math.floor(x);
    };
    const w = box.x1 - box.x0;
    const rows = Math.max(1, Math.min(7, Math.round(sp.height / 3.4)));
    const cols = Math.max(2, Math.min(6, Math.round(w / 90)));
    const mx = w * 0.12, my = box.up * 0.10;
    const cw = (w - mx * 2) / cols, ch = (box.up - my * 2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = rnd(r * 13 + c * 7);
        const wx = box.x0 + mx + c * cw + cw * 0.18;
        const wy = box.near - box.up + my + r * ch + ch * 0.18;
        const ww = cw * 0.64, wh = ch * 0.56;
        if (k < 0.12) continue;                  // a window that fell out
        // Lit, dark, or broken. Mostly dark: half the letters are dead, and
        // HOW mostly is the district's call. `windows` is the fraction lit,
        // so the Sprawl gets one working window a block and the Neon Cut gets
        // a lit tower, from the same code and different data.
        const frac = (neon && neon.windows !== undefined) ? neon.windows : 0.10;
        if (k > 1 - frac && sp.height >= 5) {
          // NOT `c`: that is the column loop variable two lines up, and
          // `const c = ... + c` is a temporal dead zone error that node
          // --check cannot see. The same class of bug cost twenty minutes
          // in D302 and it is the reason the boot sim now DRAWS a district
          // rather than only asserting about one.
          // neonHue, NOT neonPick: `neon.windows` above has already decided
          // that this window is lit, and running it through the sign's `lit`
          // gate as well was throwing most of them onto the fallback.
          // And the fallback is the district's own first colour, never a
          // hardcoded amber -- a fallback that is somebody's actual palette
          // entry cannot silently become the world's colour.
          const hex = this.neonHue(neon, seed * 31 + r * 7 + c, 2) ||
                      ((neon && neon.mix && neon.mix[0][0]) || '#ffb020');
          // A LIT WINDOW IS A LIGHT SOURCE, so it is nearly opaque. At the
          // 0.6 multiplier this used to carry, a WHITE window came out as
          // mid-grey over a dark building - which is why the Sprawl, made
          // white-led, still measured 85% amber: its whites were not reading
          // as light at all, and only the sodium survived to be counted.
          ctx.fillStyle = this.rgba(hex,
            Math.min(0.95, ((neon && neon.alpha) || 0.85) + 0.15));
        } else {
          ctx.fillStyle = 'rgba(6,8,12,0.72)';
        }
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
    // A ROOFLINE: a parapet lip along the top edge, so the building ends in
    // something rather than just stopping.
    ctx.fillStyle = this.tones(sp._c || '#3a3d44').top;
    ctx.fillRect(box.x0, box.near - box.up - 7, w, 12);

    // A DOOR, at ground level on the front face, for anything you could
    // plausibly walk into. "Doors are visible and mean something - that's
    // where interiors are, and interiors are core-only."
    if (sp.height >= 5) {
      const dw = Math.min(70, w * 0.16), dh = Math.min(box.up * 0.30, 90);
      const dx = box.x0 + w * (0.3 + rnd(99) * 0.4);
      ctx.fillStyle = 'rgba(4,6,10,0.88)';
      ctx.fillRect(dx, box.near - dh, dw, dh);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 3;
      ctx.strokeRect(dx, box.near - dh, dw, dh);
    }
  },

  // ---- DAMAGE, WHICH HAS RULES TOO ---------------------------------------
  // "Cracks branch. They don't repeat. One main fissure, two or three branches
  //  off it, no two the same, never evenly spaced." Evenly spaced marks read
  //  as decoration or as directional arrows, which is what the first two
  //  barrier passes looked like.
  //
  // "Damage follows structure. Cracks start at corners, at joins, at the base."
  cracks(ctx, box, seed, n) {
    const rnd = (i) => {
      const x = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineCap = 'round';
    const count = n || 2;
    for (let c = 0; c < count; c++) {
      // START AT A CORNER OR THE BASE, never in the middle of a panel.
      const fromLeft = rnd(c * 9) > 0.5;
      let px = fromLeft ? box.x0 : box.x1;
      let py = box.near - (rnd(c * 9 + 1) > 0.5 ? 0 : box.up);
      const toward = fromLeft ? 1 : -1;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      const steps = 3 + Math.floor(rnd(c * 9 + 2) * 3);
      const pts = [];
      for (let s = 0; s < steps; s++) {
        px += toward * (30 + rnd(c * 9 + 3 + s) * 70);
        py += (rnd(c * 9 + 20 + s) - 0.62) * box.up * 0.42;
        py = Math.max(box.near - box.up, Math.min(box.near, py));
        pts.push([px, py]);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      // TWO OR THREE BRANCHES, off the main fissure, none the same.
      const branches = 2 + Math.floor(rnd(c * 9 + 7) * 2);
      ctx.lineWidth = 3;
      for (let b = 0; b < branches && b < pts.length; b++) {
        const from = pts[Math.floor(rnd(c * 9 + 40 + b) * pts.length)];
        if (!from) continue;
        ctx.beginPath();
        ctx.moveTo(from[0], from[1]);
        ctx.lineTo(from[0] + toward * (14 + rnd(c * 9 + 50 + b) * 46),
                   from[1] + (rnd(c * 9 + 60 + b) - 0.5) * box.up * 0.5);
        ctx.stroke();
      }
    }
  },

  // "Collapse leaves material. A collapsed thing has its own rubble at its
  //  foot, in its own colour. This sells the collapse AND anchors the object
  //  to the ground."
  rubbleAtFoot(ctx, box, colour, seed, n) {
    const rnd = (i) => {
      const x = Math.sin((seed + 3) * 91.7 + i * 37.1) * 24634.6345;
      return x - Math.floor(x);
    };
    const t = this.tones(colour || '#2c2f36');
    for (let i = 0; i < (n || 9); i++) {
      const rx = box.x0 + rnd(i) * (box.x1 - box.x0);
      const ry = box.near + rnd(i + 40) * 34;
      const rr = 10 + rnd(i + 80) * 20;
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.beginPath();
      ctx.ellipse(rx + 6, ry + 5, rr, rr * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i % 3 === 0 ? t.top : t.front;
      ctx.strokeStyle = t.ink; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  },

  // "Rust and stain run downward from wherever water sat."
  streaks(ctx, box, seed, n) {
    const rnd = (i) => {
      const x = Math.sin((seed + 7) * 55.3 + i * 19.7) * 12345.678;
      return x - Math.floor(x);
    };
    ctx.strokeStyle = 'rgba(90,52,26,0.35)';
    for (let i = 0; i < (n || 5); i++) {
      const sx = box.x0 + rnd(i) * (box.x1 - box.x0);
      const top = box.near - box.up * (0.55 + rnd(i + 10) * 0.4);
      ctx.lineWidth = 4 + rnd(i + 20) * 7;
      ctx.beginPath();
      ctx.moveTo(sx, top);
      ctx.lineTo(sx + (rnd(i + 30) - 0.5) * 10, top + box.up * (0.25 + rnd(i + 40) * 0.5));
      ctx.stroke();
    }
  },
};

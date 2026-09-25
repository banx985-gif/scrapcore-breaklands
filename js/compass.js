// SCRAPCORE: BREAKLANDS — THE COMPASS STRIP (Playtest 3, item 2)
//
// Aaron, towing a hulk across the Yard: "when I'm towing I have no idea where
// to tow it."
//
// He is describing a world that got big without getting navigable. Block 6
// built the tow; Block 3 built the garage you tow TO; nothing on screen ever
// joined the two. The tow readout said what you were dragging and what it cost
// you, and never once said which way home was.
//
// WHY A STRIP AND NOT A FLOATING ARROW. An arrow in the middle of the screen
// competes with the thing you are aiming at, and it can only point at one
// thing. A strip along the top is read the way a car compass is read — a
// glance, no focus pulled — and it holds every pip at once, in the order they
// actually lie around you. PLAYTEST_3_ACTIONS is explicit about this and it is
// also just the right answer.
//
// THE ONE RULE THIS FILE ENFORCES: a pip is never dropped for being far away.
// Anything the strip knows about is drawn, clamped to the end with a chevron
// if it is behind you. A marker you can only see once you are nearly there is
// not a marker (the map screen learned this in Block 3 for the wreck; this is
// the same lesson at HUD scale).
//
// It is HEADING-RELATIVE, always, with no north-up option. A strip IS a
// heading-relative instrument — a north-up strip is a ruler with letters on
// it. The rotate-vs-north-up argument PLAYTEST_3 asks to settle with a setting
// belongs to the MINIMAP, which is a map, and that setting lives there.

const COMPASS = {
  // The scale reads top-down: ticks, then the cardinal they belong to, then
  // the pips hanging under it, then how far each one is.
  //
  // EVERY Y BELOW IS A TOP EDGE, not a baseline — R.smallText sets
  // textBaseline 'top'. Two rounds of this file's layout were written as
  // baseline arithmetic and lost their bottom row off the clip rect both
  // times, which is exactly the class of fault a headless suite cannot see
  // and a screenshot shows in one glance. The sums are asserted in
  // test_compass §9 so the third round stays fixed.
  H: 72,                     // strip height, logical px
  TICK_Y: 3,                 // the tick scale starts here
  TICK_MAJOR: 8, TICK_MINOR: 4,
  CARD_Y: 12,  CARD_SIZE: 14,   // N/E/S/W, under the ticks
  GLYPH_Y: 41, GLYPH_R: 10,     // pip icons, CENTRED (these are primitives)
  LABEL_Y: 52, LABEL_SIZE: 17,  // and how far away each one is
  MAX_W: 1100,               // and its width, if the screen has room
  // Clear of the alert bar on the left and the HOME/DBG/pause cluster on the
  // right, both measured from where those things ACTUALLY are in game.js.
  // AND THIS IS THE PRICE OF TWO CONSTANTS AGREEING BY HAND. 368 was the left
  // edge of the HOME button; moving the top-right row left to get the pause
  // button off the DBG button (D318) put HOME at s.right-474, and the compass
  // strip immediately ran under it -- visible in screenshots/tow_in_progress
  // .png before this. The row is now pause(94)+DBG(170)+HOME(170) plus two
  // 12-pixel gaps, which is 474 from the right edge, and the strip clears it.
  LEFT_CLEAR: 400,
  RIGHT_CLEAR: 474,
  SIDE_PAD: 30,
  FOV: Math.PI * (220 / 180),   // total angle the strip spans: +/-110 degrees
  PIP_MIN_GAP: 72,           // horizontal px before two pips are considered stacked
  // How far in from the end a pip that is BEHIND you parks. Not zero: the pip
  // carries a centred distance label under it, and a label hanging off the end
  // of the strip is the one thing on this instrument you cannot read.
  CLAMP_INSET: 38,
  UNITS_PER_M: 10,           // the game world unit, as used by the carry HUD
};

// A player-placed destination. One at a time, on purpose: a compass with five
// waypoints on it is a compass with none. Set from the map screen (A), cleared
// by placing it on itself or by arriving.
const Waypoint = {
  x: null, y: null, district: null,

  set(x, y, districtId) {
    // Placing a waypoint within a chunk of the one you have clears it, so the
    // same button both sets and unsets and nothing needs a second binding.
    if (this.active(districtId) &&
        Math.hypot(x - this.x, y - this.y) < 600) { this.clear(); return false; }
    this.x = x; this.y = y; this.district = districtId;
    return true;
  },

  clear() { this.x = null; this.y = null; this.district = null; },

  active(districtId) {
    if (this.x === null) return false;
    if (districtId !== undefined && this.district !== districtId) return false;
    return true;
  },

  // Arriving is the third way it goes away. Called from the game update so a
  // waypoint never outlives its usefulness and becomes clutter.
  tick(player, districtId) {
    if (!this.active(districtId) || !player) return;
    if (Math.hypot(player.x - this.x, player.y - this.y) < 400) this.clear();
  },
};

const Compass = {
  // ---- WHAT IT KNOWS ABOUT ------------------------------------------------
  // Every pip is {x, y, label, ink, kind, pulse}. Distance is computed once,
  // here, so nothing downstream measures anything twice.
  //
  // Sources are asked for by capability, never by name, so a system that does
  // not exist yet (missions have no runtime target — Block 13) simply
  // contributes nothing rather than needing a guard at the draw site.
  pips(state) {
    const out = [];
    const p = state && state.player;
    if (!p) return out;
    const did = (typeof World !== 'undefined' && World.district)
      ? World.district.id : null;

    // GARAGES. Owned ones are where the parts become yours; a held one is
    // still worth knowing about because claiming it is the errand.
    if (typeof Garages !== 'undefined') {
      for (const g of Garages.list) {
        const own = Garages.owned(g.id);
        out.push({ x: g.x, y: g.y, kind: 'garage', owned: own,
          label: g.name, ink: own ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel });
      }
    }

    // THE DEATH WRECK. Everything you had not banked is standing there.
    if (typeof Wrecks !== 'undefined' && Wrecks.current &&
        Wrecks.current.district === did) {
      out.push({ x: Wrecks.current.x, y: Wrecks.current.y, kind: 'wreck',
        label: 'YOUR WRECK', ink: CONFIG.COLOR.red });
    }

    // THE ACTIVE MISSION TARGET. Missions are still data (Block 13 owns the
    // runtime), so this asks for a target and takes nothing if there is none.
    // When Block 13 lands, the pip appears with no edit here.
    if (typeof Missions !== 'undefined' && Missions.activeTarget) {
      const t = Missions.activeTarget();
      if (t && t.x !== undefined && (t.district === undefined || t.district === did)) {
        out.push({ x: t.x, y: t.y, kind: 'mission',
          label: t.label || 'OBJECTIVE', ink: CONFIG.COLOR.yellow });
      }
    }

    // THE DISTRICT EXITS. World-owned, a handful of them, so this is a scan
    // of five entries and not of the entity list.
    if (typeof DistrictExit !== 'undefined' && typeof World !== 'undefined') {
      for (const e of World.owned) {
        if (!(e instanceof DistrictExit)) continue;
        const to = (typeof DISTRICTS !== 'undefined' && DISTRICTS[e.to])
          ? DISTRICTS[e.to].name : 'EXIT';
        out.push({ x: e.x, y: e.y, kind: 'exit', label: to, ink: '#ffb020' });
      }
    }

    // THE WAYPOINT. Last, so it draws over everything: the player asked for
    // this one and it outranks anything the game volunteered.
    if (Waypoint.active(did)) {
      out.push({ x: Waypoint.x, y: Waypoint.y, kind: 'waypoint',
        label: 'WAYPOINT', ink: CONFIG.COLOR.white });
    }

    for (const q of out) q.d = Math.hypot(q.x - p.x, q.y - p.y);

    // WHILE TOWING, THE NEAREST OWNED GARAGE PULSES. That is the whole reason
    // this file exists, so it is not left to the player to work out which of
    // three cyan diamonds is the one they want.
    if (typeof Tow !== 'undefined' && Tow.towing && Tow.towing()) {
      let best = null;
      for (const q of out) {
        if (q.kind !== 'garage' || !q.owned) continue;
        if (!best || q.d < best.d) best = q;
      }
      if (best) { best.pulse = true; best.ink = CONFIG.COLOR.lime; }
    }
    return out;
  },

  // The nearest owned garage, as the tow readout wants it. Separate from
  // pips() because the readout needs it whether or not the strip is drawn.
  homeward(state) {
    const p = state && state.player;
    if (!p || typeof Garages === 'undefined') return null;
    let best = null, bd = Infinity;
    for (const g of Garages.list) {
      if (!Garages.owned(g.id)) continue;
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < bd) { bd = d; best = g; }
    }
    return best ? { g: best, d: bd } : null;
  },

  // ---- WHEN IT IS ON ------------------------------------------------------
  // "It appears whenever it is useful": towing, carrying unbanked parts, a
  // wreck out there, or a waypoint the player placed. Not always — a HUD
  // element that is always on is furniture, and the player stops reading it.
  visible(state) {
    if (!state || !state.player) return false;
    if (typeof Tow !== 'undefined' && Tow.towing && Tow.towing()) return true;
    if (typeof Salvage !== 'undefined' && Salvage.unbankedCount() > 0) return true;
    const did = (typeof World !== 'undefined' && World.district)
      ? World.district.id : null;
    if (typeof Wrecks !== 'undefined' && Wrecks.current &&
        Wrecks.current.district === did) return true;
    if (Waypoint.active(did)) return true;
    return false;
  },

  // ---- THE MATHS ----------------------------------------------------------
  // Relative bearing, wrapped to [-PI, PI]. The heading is the machine facing —
  // the same aim vector the minimap wedge and the sprite set use, so the strip
  // and the machine on screen never disagree about which way is forward.
  heading(p) { return Math.atan2(p.aimY, p.aimX); },

  rel(p, x, y) {
    let r = Math.atan2(y - p.y, x - p.x) - this.heading(p);
    while (r > Math.PI) r -= Math.PI * 2;
    while (r < -Math.PI) r += Math.PI * 2;
    return r;
  },

  // Metres, grouped, because "2400m" and "2,400m" are read at different
  // speeds and only one of them is read at a glance.
  metres(units) {
    const m = Math.round(units / COMPASS.UNITS_PER_M);
    return m.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'm';
  },

  // The eight-point arrow for a relative bearing, for the tow readout — which
  // is a line of text and cannot draw a chevron.
  arrow(rel) {
    const A = ['↑', '↗', '→', '↘',
               '↓', '↙', '←', '↖'];
    // rel is measured from FORWARD, and forward is up on this instrument.
    const i = Math.round(rel / (Math.PI / 4)) & 7;
    return A[(i + 8) % 8];
  },

  rect(state) {
    const s = Display.safe;
    // Between the alert bar on the left and the pause button on the right,
    // and never wider than MAX_W however wide the screen gets.
    // THE RIGHT CLEARANCE IS READ FROM THE HOME BUTTON when the state is
    // handed in: HOME sits beside pause in a player build and one slot left
    // of DBG in a dev build, and a constant that agreed with one of those
    // by hand is the fault D318 already paid for. RIGHT_CLEAR is the
    // fallback for a caller with no state, and equals the dev layout.
    let rightClear = COMPASS.RIGHT_CLEAR;
    const items = state && state.buttons && state.buttons.items;
    if (items) {
      for (const b of items) {
        if (b.label === 'HOME') rightClear = Math.max(40, s.right - b.x);
      }
    }
    const lo = s.left + COMPASS.LEFT_CLEAR + COMPASS.SIDE_PAD;
    const hi = s.right - rightClear - COMPASS.SIDE_PAD;
    const avail = Math.max(320, hi - lo);
    const w = Math.min(COMPASS.MAX_W, avail);
    return { x: lo + (avail - w) / 2, y: s.top + 18, w, h: COMPASS.H };
  },

  // ---- DRAWING ------------------------------------------------------------
  draw(ctx, state) {
    if (!this.visible(state)) return;
    const p = state.player;
    const r = this.rect(state);
    const half = COMPASS.FOV / 2;
    const toX = (rel) => r.x + r.w / 2 + (rel / half) * (r.w / 2);

    R.roundRect(r.x, r.y, r.w, r.h, 8, 'rgba(4,6,14,0.62)', CONFIG.COLOR.ink, 3);

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();

    // CARDINALS AND TICKS. They are what makes the strip read as a compass
    // rather than as a bar with dots on it: turning the machine slides the
    // whole scale, and that motion is the feedback that the thing is live.
    // World -y is north, matching the map screen orientation.
    const ha = this.heading(p);
    for (let deg = 0; deg < 360; deg += 15) {
      const abs = (deg - 90) * Math.PI / 180;      // 0 deg = north = world -y
      let rel = abs - ha;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      if (Math.abs(rel) > half) continue;
      const x = toX(rel);
      const major = deg % 90 === 0;
      R.rect(x - 1, r.y + COMPASS.TICK_Y, 2,
        major ? COMPASS.TICK_MAJOR : COMPASS.TICK_MINOR,
        major ? 'rgba(143,163,200,0.85)' : 'rgba(143,163,200,0.35)');
      if (major) {
        R.smallText('NESW'[deg / 90], x, r.y + COMPASS.CARD_Y, COMPASS.CARD_SIZE,
          'rgba(143,163,200,0.8)', 'center');
      }
    }

    // PIPS, nearest last so the near one wins any overlap fight. Everything is
    // drawn: a pip behind you clamps to the end of the strip and grows a
    // chevron, because "which way is home" has to be answerable from anywhere.
    const pips = this.pips(state).sort((a, b) => b.d - a.d);
    const taken = [];
    for (const q of pips) {
      const rel = this.rel(p, q.x, q.y);
      const clamped = Math.abs(rel) > half;
      const x = clamped
        ? (rel > 0 ? r.x + r.w - COMPASS.CLAMP_INSET : r.x + COMPASS.CLAMP_INSET)
        : toX(rel);
      // Stacked pips: the nearer one is what you want, and it is drawn later,
      // so an earlier pip within a pip width simply loses its label.
      let crowded = false;
      for (const t of taken) if (Math.abs(t - x) < COMPASS.PIP_MIN_GAP) crowded = true;
      taken.push(x);

      const cy = r.y + COMPASS.GLYPH_Y;
      const pulse = q.pulse
        ? 0.65 + 0.35 * Math.sin(performance.now() / 160) : 1;
      ctx.globalAlpha = pulse;
      this._glyph(ctx, q.kind, x, cy, q.ink, q.owned);
      ctx.globalAlpha = 1;

      if (clamped) {
        // The chevron says "keep turning", and which way.
        ctx.strokeStyle = q.ink;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const s2 = rel > 0 ? 1 : -1;
        ctx.moveTo(x + s2 * 3 - s2 * 8, cy - 8);
        ctx.lineTo(x + s2 * 3, cy);
        ctx.lineTo(x + s2 * 3 - s2 * 8, cy + 8);
        ctx.stroke();
      }
      if (!crowded) {
        R.smallText(this.metres(q.d), x, r.y + COMPASS.LABEL_Y,
          COMPASS.LABEL_SIZE, q.ink, 'center');
      }
    }
    ctx.restore();
  },

  // One glyph per kind, all primitives. A compass that needed art could not be
  // drawn before the art existed, and standing rule 5 is not negotiable.
  _glyph(ctx, kind, x, y, ink, owned) {
    if (kind === 'garage') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = owned ? ink : 'rgba(0,0,0,0.6)';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    } else if (kind === 'wreck') {
      R.circle(x, y, 8, ink, CONFIG.COLOR.ink, 3);
      R.rect(x - 1, y - 12, 2, 6, ink);
    } else if (kind === 'exit') {
      // Two chevrons: the same amber chevrons that are painted on the ground
      // at a district gate, so the pip and the place look like each other.
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 7, y - 7 + i * 6);
        ctx.lineTo(x, y - 1 + i * 6);
        ctx.lineTo(x + 7, y - 7 + i * 6);
        ctx.stroke();
      }
    } else if (kind === 'mission') {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(8, 0); ctx.lineTo(0, 9); ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      // Waypoint: a hollow ring with a dot, the shape every map in the world
      // uses for "here, because I said so".
      R.circle(x, y, 9, null, ink, 3);
      R.circle(x, y, 3, ink);
    }
  },
};

// SCRAPCORE: BREAKLANDS — BLOCK 12: THE PAINT SHOP
//
// Cosmetic only, and the reason it is SAFE to be cosmetic is one rule:
//
//   "EMISSIVE PARTS ARE NEVER PAINTABLE. The faction read lives in the GLOW,
//    not the paint — which is what makes the paint shop safe."
//
// Every other game that lets a player recolour their machine has to fight
// them over legibility, because the player will eventually paint themselves
// the colour of the thing that kills them. This one does not have to, because
// the thing that says WHOSE a machine is was never the paint: green and cyan
// are yours, red is hostile, and both of those live in emissive parts that the
// shop cannot touch. A player can paint their machine hostile red and it will
// still read as theirs at a glance.
//
// ---------------------------------------------------------------------------
// FOUR SLOTS, AND WHAT THEY MEAN
//
//   BODY   the big panels. The colour you see from across a district.
//   TRIM   edges, stripes, the bits that catch light.
//   METAL  bare mechanism: struts, joints, barrels.
//   DARK   shadow, recess, the inside of things.
//
// Four is the number because three is not enough to make two machines look
// different and five is a colour-picker. `PAINT_SLOTS` is the authority.
//
// ---------------------------------------------------------------------------
// AND THE ACCESSIBILITY RULE, HERE RATHER THAN IN BLOCK 18
//
// CONTENT_AUDIO's accessibility note asks for SHAPE cues, not a filter:
//
//   "Hostile machines get an angular silhouette cue, player parts a rounded
//    one."
//
// It belongs with the paint shop and not with polish, because a player who
// cannot separate the factions by colour is exactly the player who is about
// to repaint their machine — and shipping the shop first would mean shipping
// the problem first. A colourblind filter recolours the whole screen and
// makes the world's own palette a lie; a shape does not.
const PAINT_B = {
  MAX_DECALS_MACHINE: 4,
  MAX_DECALS_WEAPON: 1,
  // The shape cue's size, as a fraction of the thing it marks.
  CUE_R: 0.34,
};

const Paint = {
  // ---- WHAT IS OWNED ------------------------------------------------------
  // Through `Progress.paintOwned`, which is the record `Finds.take` has been
  // writing into since Phase C.3 - so a colour set found in the world is
  // already unlocked and this file adds no second store.
  ownedKey(kind, id) { return kind + ':' + id; },

  owns(kind, id) {
    if (typeof Progress === 'undefined') return false;
    Progress.paintOwned = Progress.paintOwned || {};
    return !!Progress.paintOwned[this.ownedKey(kind, id)];
  },

  // A SET IS UNLOCKED BY THE THING ITS DATA NAMES, asked of the record that
  // owns that fact - never of a copy. `start` is always on; everything else
  // is a mission, a boss, a garage count or a find, and each of those has a
  // record already.
  setUnlocked(setId) {
    const S = (typeof COLOUR_SETS !== 'undefined') ? COLOUR_SETS[setId] : null;
    if (!S) return false;
    const u = S.unlock || 'start';
    if (u === 'start') return true;
    if (this.owns('colourset', setId)) return true;       // found in the world
    const [kind, what] = u.split(':');
    if (kind === 'mission') {
      return !!(typeof Missions !== 'undefined' && Missions.isDone(what));
    }
    if (kind === 'boss') {
      return !!(typeof World !== 'undefined' && World.wasKilled &&
                World.wasKilled('boss_' + what));
    }
    if (kind === 'garage') {
      const n = (typeof Garages !== 'undefined' && Garages.ownedCount)
        ? Garages.ownedCount() : 0;
      return n >= (parseInt(what, 10) || 1);
    }
    if (kind === 'enter') {
      return !!(typeof Progress !== 'undefined' && Progress.explored &&
                Object.keys(Progress.explored).some(k => k.indexOf(what) === 0));
    }
    // PROTOTYPE is not unlocked as a SET and never will be — its seven colours
    // are seven trophies with seven different owners. The set is "available"
    // the moment any one of them is, and `colourUnlocked` decides them one at
    // a time. Returning false here locked all seven out of the shop forever,
    // which quietly cancelled `randomiseExcludes: ['prototype']` — the rule
    // that trophies stay earned had nothing left to protect.
    if (kind === 'per-boss') {
      const cs = (COLOUR_SETS[setId] || {}).colours || {};
      return Object.keys(cs).some(cid => this.colourUnlocked(setId, cid));
    }
    return false;
  },

  // ONE COLOUR. Every set except PROTOTYPE unlocks whole, so this only ever
  // has an opinion about the trophies: the colour a boss drops is yours the
  // moment that boss is dead. Through `paintOwned`, written by Bosses.payDrops
  // — the same record a found set writes into, so there is no second store.
  colourUnlocked(setId, colourId) {
    const S = (typeof COLOUR_SETS !== 'undefined') ? COLOUR_SETS[setId] : null;
    if (!S || !(S.colours || {})[colourId]) return false;
    if ((S.unlock || 'start') !== 'per-boss') return this.setUnlocked(setId);
    return this.owns('colour', colourId);
  },

  decalUnlocked(id) {
    const D = (typeof DECALS !== 'undefined') ? DECALS[id] : null;
    if (!D) return false;
    const u = D.unlock || 'start';
    if (u === 'start') return true;
    if (this.owns('decal', id)) return true;
    if (u.indexOf('mission:') === 0) {
      return !!(typeof Missions !== 'undefined' &&
                Missions.isDone(u.slice(8)));
    }
    // `found:...` and `story...` are granted by taking the thing, which
    // writes paintOwned - so reaching here means it has not been found.
    return false;
  },

  // Every colour the player may actually choose right now, as
  // `{ set, id, hex }`. One list, so the screen never has to know how an
  // unlock works.
  available() {
    const out = [];
    if (typeof COLOUR_SETS === 'undefined') return out;
    for (const sid of Object.keys(COLOUR_SETS)) {
      if (!this.setUnlocked(sid)) continue;
      const cs = COLOUR_SETS[sid].colours || {};
      for (const cid of Object.keys(cs)) {
        if (cs[cid] === 'special') continue;    // PATCHWORK: not a colour
        // Per colour, not just per set — PROTOTYPE's seven arrive one boss at
        // a time and offering all seven the moment one lands would give away
        // six kills nobody has made.
        if (!this.colourUnlocked(sid, cid)) continue;
        out.push({ set: sid, id: cid, hex: cs[cid] });
      }
    }
    return out;
  },

  // ---- WHAT IS ON A THING -------------------------------------------------
  // Kept per vehicle and per weapon on Progress, because SAVE_FORMAT asks for
  // `paint{}` per vehicle and per weapon and a second store would be a second
  // thing to migrate.
  _all() {
    if (typeof Progress === 'undefined') return {};
    Progress.paint = Progress.paint || {};
    return Progress.paint;
  },

  // `who` is a vehicle id or a weapon id. One namespace on purpose: a weapon
  // and a rig are both things you paint, and giving them two tables would
  // mean two of everything below.
  of(who) {
    const all = this._all();
    if (!all[who]) all[who] = { slots: {}, decals: [] };
    return all[who];
  },

  // The colour on one slot, or null for "as found" - which is not a colour,
  // it is the absence of one, and the drawing code is what decides what an
  // unpainted panel looks like.
  slot(who, slotId) {
    if (PAINT_SLOTS.indexOf(slotId) < 0) return null;
    const v = this.of(who).slots[slotId];
    return v === undefined ? null : v;
  },

  // PAINT IT. Refuses a colour that is not unlocked, and refuses a slot that
  // does not exist - a shop that silently accepts a colour the player does
  // not own is a shop that will eventually show them one.
  setSlot(who, slotId, hex) {
    if (PAINT_SLOTS.indexOf(slotId) < 0) return false;
    if (hex === null) { delete this.of(who).slots[slotId]; return true; }
    if (!this.available().some(c => c.hex === hex)) return false;
    this.of(who).slots[slotId] = hex;
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    return true;
  },

  // "perSlotReset: true" - as found, per slot. Resetting one panel without
  // losing the other three is the difference between a paint shop and a
  // preset picker.
  reset(who, slotId) {
    if (slotId) return this.setSlot(who, slotId, null);
    this.of(who).slots = {};
    return true;
  },

  // ---- DECALS -------------------------------------------------------------
  decals(who) { return this.of(who).decals.slice(); },

  maxDecals(who) {
    // A weapon takes one. Anything else is a machine and takes four.
    const isWeapon = typeof PARTS !== 'undefined' && PARTS[who] &&
                     PARTS[who].category === 'weapon';
    // FROM PAINT_RULES, which is where the content library writes it. These
    // two numbers were also sitting in PAINT_B, agreeing by luck: two sources
    // of truth for the same rule, and a balance pass that moved the data one
    // would have moved nothing. Rule 7 — balance is data.
    const R = (typeof PAINT_RULES !== 'undefined') ? PAINT_RULES : {};
    return isWeapon
      ? (R.maxDecalsPerWeapon !== undefined ? R.maxDecalsPerWeapon : PAINT_B.MAX_DECALS_WEAPON)
      : (R.maxDecalsPerMachine !== undefined ? R.maxDecalsPerMachine : PAINT_B.MAX_DECALS_MACHINE);
  },

  addDecal(who, id, opts) {
    if (!this.decalUnlocked(id)) return false;
    const d = this.of(who).decals;
    if (d.length >= this.maxDecals(who)) return false;
    // "unique: true" - the HAND is the only decal a person made. One place,
    // never repeated, never sold, and never worn twice.
    const D = (typeof DECALS !== 'undefined') ? DECALS[id] : null;
    if (D && D.unique && d.some(x => x.id === id)) return false;
    const o = opts || {};
    d.push({ id: id, x: o.x || 0, y: o.y || 0,
             scale: o.scale === undefined ? 1 : o.scale,
             rot: o.rot || 0, colour: o.colour || null });
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    return true;
  },

  removeDecal(who, i) {
    const d = this.of(who).decals;
    if (i < 0 || i >= d.length) return false;
    d.splice(i, 1);
    return true;
  },

  // ---- PRESETS ------------------------------------------------------------
  // "Named colourways, apply to any machine." Colours only - a preset that
  // carried decals would move the HAND, and the whole point of the HAND is
  // that it is one thing in one place.
  presets() {
    if (typeof Progress === 'undefined') return [];
    Progress.colourPresets = Progress.colourPresets || [];
    return Progress.colourPresets;
  },

  savePreset(name, who) {
    if (!name) return false;
    const list = this.presets();
    const slots = Object.assign({}, this.of(who).slots);
    const at = list.findIndex(p => p.name === name);
    if (at >= 0) list[at] = { name: name, slots: slots };
    else list.push({ name: name, slots: slots });
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    return true;
  },

  applyPreset(name, who) {
    const p = this.presets().find(x => x.name === name);
    if (!p) return false;
    this.of(who).slots = {};
    // Through setSlot, so a preset saved before a colour was locked again -
    // or carried from another save - cannot put a colour on you that you do
    // not own.
    for (const s of Object.keys(p.slots)) this.setSlot(who, s, p.slots[s]);
    return true;
  },

  // ---- RANDOMISE ----------------------------------------------------------
  // "randomiseExcludes: ['prototype']" - trophies stay earned. Rolling a boss
  // colour you never beat would make the one set that means something mean
  // nothing.
  randomise(who) {
    const pool = this.available().filter(
      c => (PAINT_RULES.randomiseExcludes || []).indexOf(c.set) < 0);
    if (!pool.length) return false;
    for (const s of PAINT_SLOTS) {
      this.setSlot(who, s, pool[Math.floor(Math.random() * pool.length)].hex);
    }
    return true;
  },

  // ---- AND THE ONE THING IT MAY NOT TOUCH ---------------------------------
  // An emissive part's colour comes from the part, never from the paint. This
  // is the function that says so, and it is asked at the draw rather than
  // enforced at the shop: a rule enforced only at the point of purchase is a
  // rule that a preset, a save migration or a randomise can walk around.
  paintable(part) {
    if (!part) return true;
    // FROM PAINT_RULES, for the same reason maxDecals now is: the rule is
    // written in the content library as `emissivePaintable: false`, and a
    // hardcoded `!part.emissive` here is a second copy of it that a change to
    // the first would not reach. If the library ever says yes, this says yes.
    const R = (typeof PAINT_RULES !== 'undefined') ? PAINT_RULES : {};
    if (R.emissivePaintable) return true;
    return !part.emissive;
  },

  // What colour a part should actually draw in, for one slot. The ONE
  // question the renderer asks, so there is one place that knows the rule.
  colourFor(who, part, slotId, fallback) {
    if (!this.paintable(part)) return fallback;      // the glow is not yours
    const c = this.slot(who, slotId);
    return c === null ? fallback : c;
  },
};

// ===========================================================================
// WHAT A DECAL LOOKS LIKE (D373, question 10)
//
// `DECALS` in js/paintdata.js has described twenty-four marks since Block 12.
// `Paint.addDecal` has been able to put one on a machine for just as long.
// NOTHING HAS EVER DRAWN ONE. The catalogue, the unlock rules, the four-per-
// machine limit and the HAND's `unique` flag were all real and all invisible —
// the same shape of hole as the paint shop itself, which had rules and no
// screen until Block 12's tab, and `Paint.colourFor`, which was written as a
// renderer hook and called by nothing for three blocks.
//
// CANVAS PRIMITIVES ONLY (standing rule 5). A decal is not a sprite and must
// not become one: there are twenty-four of them, they are stamped on a moving
// machine at a dozen sizes, and a pack of twenty-four small images is a pack
// somebody has to keep in step with the catalogue. Drawn code is drawn from
// the same data that lists them, so a decal added to `DECALS` gets a mark.
//
// THEY READ ON ANY PAINT. Every mark draws with an ink underlay and a light
// fill, because the machine underneath can be any of sixty colours and a mark
// that vanishes on FOUNDRY BLACK is not a mark. That is why `colour` on a
// worn decal tints the FILL and never the outline.
//
// AND THEY ARE NOT A FACTION READ. Decals are cosmetic like paint, and the
// same rule protects them: nothing here draws in hostile red, and a decal is
// drawn UNDER the reactor ring so it can never compete with the one
// affordance that must always win.
const DecalArt = {
  // The default mark colour: bone, which reads against both the dark half and
  // the bright half of every set in the catalogue.
  FILL: '#e8e4d8',
  INK: '#0b0e1a',

  // ---- the primitives every mark is built from --------------------------
  // `r` is the mark's radius. Everything below is expressed as a fraction of
  // it, so one decal drawn at 14 px on a machine and at 40 px in the shop is
  // the same mark rather than two.
  _bar(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
  },
  _ring(ctx, r, lw, col) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  },
  _poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
      else ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  },
  _stroke(ctx, pts, col, lw) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
      else ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();
  },
  // Stencil glyphs, drawn as text because a numeral IS text and hand-drawing
  // digits out of bars would be worse at every size. The font is the game's
  // own, so a decal and a HUD readout are the same typeface.
  _glyph(ctx, s, r, fill) {
    ctx.font = '900 ' + (r * 1.5).toFixed(0) + 'px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.INK;
    ctx.fillText(s, r * 0.08, r * 0.08);
    ctx.fillStyle = fill;
    ctx.fillText(s, 0, 0);
  },

  // ---- THE MARKS ---------------------------------------------------------
  // One entry per id in DECALS. Each draws in a space centred on 0,0 with the
  // mark's radius `r`, already rotated and scaled by draw() below.
  MARKS: {
    // --- NUMBERS: free from the start. "Everyone wants a number." ---------
    numerals(ctx, r, f, D) { D._glyph(ctx, '44', r, f); },
    tallyMarks(ctx, r, f, D) {
      for (let i = 0; i < 4; i++) {
        const x = -r * 0.62 + i * r * 0.41;
        D._stroke(ctx, [[x, -r * 0.62], [x, r * 0.62]], D.INK, r * 0.26);
        D._stroke(ctx, [[x, -r * 0.62], [x, r * 0.62]], f, r * 0.14);
      }
      // the fifth, struck through — which is what makes it a TALLY
      D._stroke(ctx, [[-r * 0.8, r * 0.5], [r * 0.7, -r * 0.5]], D.INK, r * 0.26);
      D._stroke(ctx, [[-r * 0.8, r * 0.5], [r * 0.7, -r * 0.5]], f, r * 0.14);
    },

    // --- INDUSTRIAL: Ironworks and The Digs -------------------------------
    hazardStripes(ctx, r, f, D) {
      ctx.save();
      ctx.beginPath(); ctx.rect(-r, -r * 0.6, r * 2, r * 1.2); ctx.clip();
      ctx.fillStyle = D.INK; ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
      ctx.fillStyle = f;
      for (let i = -3; i < 4; i++) {
        D._poly(ctx, [[i * r * 0.5, -r * 0.6], [i * r * 0.5 + r * 0.26, -r * 0.6],
                      [i * r * 0.5 + r * 0.66, r * 0.6], [i * r * 0.5 + r * 0.4, r * 0.6]], f);
      }
      ctx.restore();
      ctx.strokeStyle = D.INK; ctx.lineWidth = r * 0.12;
      ctx.strokeRect(-r, -r * 0.6, r * 2, r * 1.2);
    },
    highVoltage(ctx, r, f, D) {
      // the bolt, in a triangle: the one industrial mark everybody reads
      D._poly(ctx, [[0, -r], [r * 0.92, r * 0.72], [-r * 0.92, r * 0.72]],
              D.INK, f, r * 0.16);
      D._poly(ctx, [[r * 0.16, -r * 0.5], [-r * 0.3, r * 0.06],
                    [-r * 0.02, r * 0.06], [-r * 0.18, r * 0.5],
                    [r * 0.3, -r * 0.1], [r * 0.0, -r * 0.1]], f);
    },
    loadRating(ctx, r, f, D) {
      // a weight box with a figure in it
      D._poly(ctx, [[-r * 0.9, -r * 0.8], [r * 0.9, -r * 0.8],
                    [r * 0.9, r * 0.8], [-r * 0.9, r * 0.8]], D.INK, f, r * 0.14);
      D._glyph(ctx, 'T', r * 0.8, f);
    },
    inspection(ctx, r, f, D) {
      // a stamped circle with a tick: passed
      D._ring(ctx, r * 0.86, r * 0.3, D.INK);
      D._ring(ctx, r * 0.86, r * 0.16, f);
      D._stroke(ctx, [[-r * 0.42, 0], [-r * 0.1, r * 0.38], [r * 0.48, -r * 0.42]],
                D.INK, r * 0.3);
      D._stroke(ctx, [[-r * 0.42, 0], [-r * 0.1, r * 0.38], [r * 0.48, -r * 0.42]],
                f, r * 0.17);
    },
    weldSeam(ctx, r, f, D) {
      // a bead of weld: overlapping lozenges along a line
      for (let i = -2; i <= 2; i++) {
        const x = i * r * 0.42;
        D._poly(ctx, [[x - r * 0.28, 0], [x, -r * 0.34], [x + r * 0.28, 0],
                      [x, r * 0.34]], D.INK);
        D._poly(ctx, [[x - r * 0.2, 0], [x, -r * 0.24], [x + r * 0.2, 0],
                      [x, r * 0.24]], f);
      }
    },
    liftingPoint(ctx, r, f, D) {
      // a hook eye over a cross: where the crane takes it
      D._ring(ctx, r * 0.4, r * 0.32, D.INK);
      D._ring(ctx, r * 0.4, r * 0.17, f);
      D._stroke(ctx, [[0, r * 0.4], [0, r * 0.95]], D.INK, r * 0.3);
      D._stroke(ctx, [[0, r * 0.4], [0, r * 0.95]], f, r * 0.16);
      D._stroke(ctx, [[-r * 0.6, r * 0.95], [r * 0.6, r * 0.95]], D.INK, r * 0.3);
      D._stroke(ctx, [[-r * 0.6, r * 0.95], [r * 0.6, r * 0.95]], f, r * 0.16);
    },

    // --- CIVIC: BOLT mission 2 and The Sprawl -----------------------------
    transitRoundel(ctx, r, f, D) {
      D._ring(ctx, r * 0.78, r * 0.36, D.INK);
      D._ring(ctx, r * 0.78, r * 0.2, f);
      D._bar(ctx, 0, 0, r * 2, r * 0.44, D.INK);
      D._bar(ctx, 0, 0, r * 2, r * 0.28, f);
    },
    streetSign(ctx, r, f, D) {
      D._poly(ctx, [[-r, -r * 0.42], [r, -r * 0.42], [r, r * 0.42], [-r, r * 0.42]],
              D.INK, f, r * 0.14);
      for (let i = -1; i <= 1; i++) D._bar(ctx, i * r * 0.44, 0, r * 0.2, r * 0.42, f);
    },
    postalMark(ctx, r, f, D) {
      // a franking ring with bars through it
      D._ring(ctx, r * 0.9, r * 0.26, D.INK);
      D._ring(ctx, r * 0.9, r * 0.14, f);
      for (let i = -1; i <= 1; i++) {
        D._stroke(ctx, [[-r * 0.62, i * r * 0.32], [r * 0.62, i * r * 0.32]], f, r * 0.13);
      }
    },
    schoolCrest(ctx, r, f, D) {
      D._poly(ctx, [[0, -r], [r * 0.82, -r * 0.5], [r * 0.62, r * 0.9],
                    [0, r], [-r * 0.62, r * 0.9], [-r * 0.82, -r * 0.5]],
              D.INK, f, r * 0.14);
      D._glyph(ctx, 'S', r * 0.72, f);
    },
    fireService(ctx, r, f, D) {
      // a helmet crest over a bar
      D._poly(ctx, [[0, -r * 0.9], [r * 0.9, r * 0.2], [-r * 0.9, r * 0.2]],
              D.INK, f, r * 0.14);
      D._bar(ctx, 0, r * 0.62, r * 1.7, r * 0.42, D.INK);
      D._bar(ctx, 0, r * 0.62, r * 1.5, r * 0.26, f);
    },
    municipalSeal(ctx, r, f, D) {
      // a cogged seal: the civic stamp
      ctx.save();
      for (let i = 0; i < 10; i++) {
        ctx.rotate(Math.PI * 2 / 10);
        D._bar(ctx, 0, -r * 0.9, r * 0.24, r * 0.3, D.INK);
      }
      ctx.restore();
      D._ring(ctx, r * 0.72, r * 0.34, D.INK);
      D._ring(ctx, r * 0.72, r * 0.19, f);
      D._ring(ctx, r * 0.3, r * 0.16, f);
    },

    // --- COMMERCIAL: Neon Cut ---------------------------------------------
    neonGlyph(ctx, r, f, D) {
      // a shopfront squiggle — the Cut's own alphabet, meaning nothing
      D._stroke(ctx, [[-r * 0.8, r * 0.7], [-r * 0.3, -r * 0.8], [r * 0.1, r * 0.3],
                      [r * 0.5, -r * 0.8], [r * 0.85, r * 0.7]], D.INK, r * 0.4);
      D._stroke(ctx, [[-r * 0.8, r * 0.7], [-r * 0.3, -r * 0.8], [r * 0.1, r * 0.3],
                      [r * 0.5, -r * 0.8], [r * 0.85, r * 0.7]], f, r * 0.22);
    },
    adBlock(ctx, r, f, D) {
      D._poly(ctx, [[-r, -r * 0.7], [r, -r * 0.7], [r, r * 0.7], [-r, r * 0.7]],
              D.INK, f, r * 0.14);
      for (let i = 0; i < 3; i++) {
        D._bar(ctx, -r * 0.12, -r * 0.34 + i * r * 0.34, r * 1.4 - i * r * 0.36,
               r * 0.16, f);
      }
    },
    barcode(ctx, r, f, D) {
      ctx.fillStyle = D.INK;
      ctx.fillRect(-r, -r * 0.7, r * 2, r * 1.4);
      const w = [0.10, 0.05, 0.14, 0.05, 0.08, 0.16, 0.05, 0.11];
      let x = -r * 0.9;
      ctx.fillStyle = f;
      for (let i = 0; i < w.length; i++) {
        if (i % 2 === 0) ctx.fillRect(x, -r * 0.58, r * w[i] * 2, r * 1.16);
        x += r * w[i] * 2.2;
      }
    },
    vendingLogo(ctx, r, f, D) {
      // a cup: the most disposable object in the game's world
      D._poly(ctx, [[-r * 0.6, -r * 0.7], [r * 0.6, -r * 0.7],
                    [r * 0.38, r * 0.85], [-r * 0.38, r * 0.85]],
              D.INK, f, r * 0.14);
      D._bar(ctx, 0, -r * 0.5, r * 1.06, r * 0.2, f);
    },
    brandMark(ctx, r, f, D) {
      // a swoosh in a box: a brand nobody remembers
      D._poly(ctx, [[-r, -r * 0.8], [r, -r * 0.8], [r, r * 0.8], [-r, r * 0.8]], D.INK);
      D._stroke(ctx, [[-r * 0.7, r * 0.35], [-r * 0.1, -r * 0.4], [r * 0.75, -r * 0.1]],
                f, r * 0.26);
    },
    saleStarburst(ctx, r, f, D) {
      const pts = [];
      for (let i = 0; i < 20; i++) {
        const a = i * Math.PI / 10;
        const rr = (i % 2 === 0) ? r : r * 0.58;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      D._poly(ctx, pts, D.INK);
      const inner = pts.map(p => [p[0] * 0.82, p[1] * 0.82]);
      D._poly(ctx, inner, f);
    },

    // --- NETWORK: the machines' own markings ------------------------------
    assetTag(ctx, r, f, D) {
      // a riveted plate with a number on it
      D._poly(ctx, [[-r, -r * 0.6], [r, -r * 0.6], [r, r * 0.6], [-r, r * 0.6]],
              D.INK, f, r * 0.14);
      D._glyph(ctx, '7', r * 0.62, f);
      for (const sx of [-1, 1]) D._bar(ctx, sx * r * 0.8, 0, r * 0.16, r * 0.16, f);
    },
    classStamp(ctx, r, f, D) {
      // a class letter inside a lozenge
      D._poly(ctx, [[0, -r], [r, 0], [0, r], [-r, 0]], D.INK, f, r * 0.14);
      D._glyph(ctx, 'C', r * 0.72, f);
    },
    workOrderGlyph(ctx, r, f, D) {
      // a clipboard tick-box grid: a job, filed
      D._poly(ctx, [[-r * 0.85, -r], [r * 0.85, -r], [r * 0.85, r], [-r * 0.85, r]],
              D.INK, f, r * 0.14);
      for (let i = 0; i < 3; i++) {
        D._bar(ctx, -r * 0.42, -r * 0.5 + i * r * 0.5, r * 0.3, r * 0.3, f);
        D._bar(ctx, r * 0.22, -r * 0.5 + i * r * 0.5, r * 0.7, r * 0.14, f);
      }
    },

    // THE MARK THAT GOT CLIP RECLASSIFIED.
    //
    // This is the one the whole question named: "the SCRAP MARK the player
    // finds on the belt has to be wearable at the end of it." It is a
    // condemnation stamp — the mark an inspector sprays on a machine that is
    // going to the furnace — so it is drawn as exactly that: a hard slash
    // through a ring, sprayed rather than stencilled, and deliberately the
    // least tidy mark in the catalogue.
    //
    // The player wears the thing that said they were rubbish. Nothing else in
    // the list is drawn crooked; this one is, by 0.14 radians, and it does not
    // straighten up.
    scrapMark(ctx, r, f, D) {
      ctx.save();
      ctx.rotate(0.14);
      D._ring(ctx, r * 0.84, r * 0.4, D.INK);
      D._ring(ctx, r * 0.84, r * 0.24, f);
      // the slash: through the ring, past both edges, the way a spray line is
      D._stroke(ctx, [[-r * 1.05, r * 0.85], [r * 1.05, -r * 0.85]], D.INK, r * 0.46);
      D._stroke(ctx, [[-r * 1.05, r * 0.85], [r * 1.05, -r * 0.85]], f, r * 0.28);
      // the overspray, which is what makes it sprayed and not printed
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = f;
      for (const d of [[-0.9, 0.95], [0.95, -0.92], [-0.55, 1.0], [0.72, -1.02]]) {
        ctx.beginPath();
        ctx.arc(r * d[0], r * d[1], r * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },

    // --- PERSONAL ---------------------------------------------------------
    // "The ONLY decal a person made. One place. Never repeated, never sold."
    // So it is the only mark here that is not geometry: a handprint, drawn
    // with the palm and four fingers, at a slight angle, because a hand
    // pressed on a hull is not square to anything.
    hand(ctx, r, f, D) {
      ctx.save();
      ctx.rotate(-0.22);
      const palm = () => {
        ctx.beginPath();
        ctx.ellipse(0, r * 0.34, r * 0.56, r * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
      };
      const fingers = (len) => {
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + (i - 1.5) * 0.42;
          ctx.save();
          ctx.translate(Math.cos(a) * r * 0.36, r * 0.2 + Math.sin(a) * r * 0.36);
          ctx.rotate(a + Math.PI / 2);
          ctx.beginPath();
          ctx.ellipse(0, -r * len * 0.5, r * 0.15, r * len * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // the thumb
        ctx.save();
        ctx.translate(-r * 0.48, r * 0.42);
        ctx.rotate(-0.9);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.15, r * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      ctx.fillStyle = D.INK; ctx.save(); ctx.scale(1.18, 1.18); palm(); fingers(0.82); ctx.restore();
      ctx.fillStyle = f; palm(); fingers(0.78);
      ctx.restore();
    },
    spare(ctx, r, f, D) {
      // a blank plate — "spare" is exactly what it says, and a mark that
      // pretended otherwise would be inventing content.
      D._poly(ctx, [[-r * 0.85, -r * 0.7], [r * 0.85, -r * 0.7],
                    [r * 0.85, r * 0.7], [-r * 0.85, r * 0.7]], D.INK, f, r * 0.16);
    },
  },

  // Is there a mark for this id? Asked by the shop, so an id in DECALS with
  // no mark here is shown as missing rather than drawn as nothing.
  has(id) { return typeof this.MARKS[id] === 'function'; },

  // DRAW ONE. `d` is a worn decal — { id, x, y, scale, rot, colour } — the
  // record Paint.addDecal writes, so the shop and the machine draw the same
  // thing from the same place.
  draw(ctx, d, cx, cy, r) {
    if (!d) return false;
    const m = this.MARKS[d.id];
    if (!m) return false;
    ctx.save();
    ctx.translate(cx + (d.x || 0), cy + (d.y || 0));
    ctx.rotate(d.rot || 0);
    ctx.lineJoin = 'round';
    m(ctx, r * (d.scale === undefined ? 1 : d.scale), d.colour || this.FILL, this);
    ctx.restore();
    return true;
  },

  // WHERE THE FOUR GO ON A MACHINE.
  //
  // `maxDecalsPerMachine` is 4 and the shop does not offer placement — a
  // drag-and-rotate editor on a touch pad is a different job and a worse one.
  // Four stations round the hull instead, so four marks read as four marks
  // and never sit on top of each other. Index in the worn list picks the
  // station, which makes the order you applied them the order they sit in.
  // Pushed out to the hull rather than sat on the middle of it: the reactor
  // ring and its halo own the centre (radius 25, halo 40 in player.js) and a
  // mark drawn under them is a mark nobody sees. Measured off the first
  // screenshot, which is the only thing that could have shown it.
  STATIONS: [
    [-0.54, -0.50], [0.54, -0.50], [-0.54, 0.54], [0.54, 0.54],
  ],

  // Stamp everything worn on `who` onto a machine at cx,cy with body radius R.
  //
  // UNDER THE REACTOR RING, drawn by the caller after this: the ring is "the
  // load-bearing visual affordance in the ENTIRE GAME" and a cosmetic mark
  // does not get to compete with it.
  drawWorn(ctx, who, cx, cy, R_) {
    if (typeof Paint === 'undefined' || !who) return 0;
    const worn = Paint.decals(who);
    if (!worn.length) return 0;
    let n = 0;
    for (let i = 0; i < worn.length; i++) {
      const st = this.STATIONS[i % this.STATIONS.length];
      const d = worn[i];
      if (this.draw(ctx, { id: d.id, colour: d.colour,
                           x: st[0] * R_ + (d.x || 0),
                           y: st[1] * R_ + (d.y || 0),
                           rot: d.rot || 0,
                           scale: (d.scale === undefined ? 1 : d.scale) },
                    cx, cy, R_ * 0.24)) n++;
    }
    return n;
  },

  // The name a player sees. 'scrapMark' reads as SCRAP MARK, for the same
  // reason a colour does: the ids are keys and a player never sees a key.
  name(id) {
    return String(id).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toUpperCase();
  },
};

// ---------------------------------------------------------------------------
// THE SHAPE CUE
//
// CONTENT_AUDIO, accessibility: "hostile machines get an ANGULAR silhouette
// cue, player parts a ROUNDED one." Not a filter.
//
// A colourblind filter recolours the whole screen, which makes the world's own
// palette - rust, ash, neon - into a lie, and the world's palette is most of
// what this game looks like. A shape costs one polygon and lies about nothing.
//
// It is drawn as a small mark at the machine's own centre, under everything
// else, so it never competes with the connector highlight - which is the one
// affordance that must always win.
const ShapeCue = {
  // Off by default and remembered in Settings, not in the save: "a player who
  // deletes a save must not lose their control bindings", and this is the
  // same kind of thing.
  on() {
    return !!(typeof Settings !== 'undefined' && Settings.get &&
              Settings.get('shapeCues'));
  },

  // THREE SHAPES, and they are chosen to be distinguishable at a glance and
  // in silhouette - which is what "not a filter" means:
  //
  //   YOURS      a circle. No corners at all.
  //   HOSTILE    a triangle. Angular, and it points.
  //   NEUTRAL    a square. Neither, and it is the one you can ignore.
  kindOf(ent) {
    if (!ent) return null;
    if (ent.isPlayer) return 'player';
    if (ent.escortId !== undefined || ent.npcId !== undefined) return 'neutral';
    return 'hostile';
  },

  draw(ctx, ent) {
    if (!this.on() || !ent || ent.alive === false) return;
    const kind = this.kindOf(ent);
    if (!kind) return;
    const r = (ent.radius || 40) * PAINT_B.CUE_R;
    const col = kind === 'player' ? CONFIG.COLOR.cyan
      : (kind === 'hostile' ? CONFIG.COLOR.red : CONFIG.COLOR.yellow);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (kind === 'player') {
      ctx.arc(ent.x, ent.y, r, 0, Math.PI * 2);
    } else if (kind === 'hostile') {
      // Pointing the way it faces, so it doubles as a facing read - which is
      // the thing a colourblind player loses most of with a flat silhouette.
      const a = ent.angle || 0;
      for (let i = 0; i < 3; i++) {
        const t = a + i * (Math.PI * 2 / 3);
        const x = ent.x + Math.cos(t) * r, y = ent.y + Math.sin(t) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      ctx.rect(ent.x - r, ent.y - r, r * 2, r * 2);
    }
    ctx.stroke();
    ctx.restore();
  },
};

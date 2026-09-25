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

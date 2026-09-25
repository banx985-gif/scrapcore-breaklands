// SCRAPCORE: BREAKLANDS — TRAVERSAL AND MAP GATING (Block 8 / Phase B)
//
// Done when you remember a wall from hour two, come back with the Mammoth, and
// get through.
//
// ---------------------------------------------------------------------------
// B.2 IS THE HARD PART, AND IT IS A DRAWING PROBLEM
//
//   "The player must be able to see why they can't pass, and guess what would
//    open it. A barrier the player reads as 'broken game' instead of 'locked
//    door' is a bug."
//
// So every barrier type below carries a `look` that the draw switches on, and
// the look is DESIGNED to name its opener without a tooltip:
//
//   a smashable wall is cracked, bulging, already half-failed
//   a climbable face has handholds and exposed rebar
//   mined ground has visible casings and old warning paint
//   a cutter door has a seam and a lock, not just "closed"
//   a duct is visibly CORE-SIZED, so you can see your rig will not fit
//
// The rule this file is built to hold: a barrier is never invisible, never
// arbitrary, and never silent about what it wants.
//
// ---------------------------------------------------------------------------
// B.5 A SHORTCUT OPENED ONCE STAYS OPEN FOREVER
//
// That is what makes the map feel like it is becoming yours, so `opened` lives
// in the save, keyed by a permanent id, exactly like a placed machine's death.

const BARRIER = {
  NEAR_R: 620,             // how close before it tells you what it wants
  OPEN_R: 330,             // how close to actually go through

  // HEIGHT, in player heights, per DRAWING_AT_44.md. Three to four times
  // the player: `anything shorter reads as something you could drive over,
  // which makes not being able to drive over it feel like a bug rather than
  // a rule.`
  //
  // The flat ones are flat ON PURPOSE and are the only barriers allowed to
  // be — mined ground, molten ground, flood and a gap are all things you
  // walk onto rather than into, and the spec's list of things allowed to be
  // flat is exactly `ground patches, road surfaces, painted lines, hazard
  // stripes on the ground`.
  HEIGHT: {
    cracked: 3.4, handholds: 4.0, rubble: 3.2, door: 3.6,
    ledge: 3.0, anchor: 4.2, duct: 3.0, belt: 1.2,
    mines: 0, molten: 0, water: 0, gap: 0, shaft: 0,
  },
};

// ---------------------------------------------------------------------------
// THE MATRIX, AS DATA (standing rules 6 and 7). Adding a barrier type is one
// entry; adding a barrier to a district is one row of district data.
//
// `opener` is a rig ability id or a gadget rank string. `also` is the late
// second opener where the design has one - four of them, all the Shrike, which
// is deliberately the rig that retroactively re-opens the map.
const BARRIER_TYPES = {
  // ---- RIG ABILITIES: outdoor, large-scale --------------------------------
  wall: {
    id: 'wall', name: 'COLLAPSED WALL', opener: 'smash', by: 'MAMMOTH SMASH',
    look: 'cracked', side: 'rig',
    tell: 'it is already half-failed - something heavy would finish it',
  },
  rockfall: {
    id: 'rockfall', name: 'ROCK FALL', opener: 'smash', by: 'MAMMOTH SMASH',
    look: 'cracked', side: 'rig',
    tell: 'loose boulders, not bedrock',
  },
  barricade: {
    id: 'barricade', name: 'BARRICADE', opener: 'smash', by: 'MAMMOTH SMASH',
    look: 'cracked', side: 'rig',
    tell: 'welded scrap, bowed outward where something already tried',
  },
  cliff: {
    id: 'cliff', name: 'CLIFF FACE', opener: 'climb', by: 'CRAB CLIMB',
    look: 'handholds', side: 'rig',
    tell: 'exposed rebar and a stacked scrap ramp going most of the way up',
  },
  molten: {
    id: 'molten', name: 'MOLTEN GROUND', opener: 'heatpurge', by: 'KILN HEAT PURGE',
    look: 'molten', side: 'rig',
    tell: 'the ground is glowing and the air above it shimmers',
  },
  flooded: {
    id: 'flooded', name: 'FLOODED GROUND', opener: 'submerge', by: 'DIVER SUBMERGE',
    look: 'water', side: 'rig', alsoCore: 'seal:1',
    tell: 'you can see the tops of things under it',
  },
  ledge: {
    id: 'ledge', name: 'HIGH SHELF', opener: 'vault', by: 'CHEETAH VAULT',
    look: 'ledge', side: 'rig', also: 'hover',
    tell: 'a lip you could clear with a run-up',
  },
  gap: {
    id: 'gap', name: 'GAP', opener: 'vault', by: 'CHEETAH VAULT',
    look: 'gap', side: 'rig', also: 'hover',
    tell: 'the ground simply stops and starts again',
  },
  minefield: {
    id: 'minefield', name: 'OLD MINEFIELD', opener: 'blastproof',
    by: 'TANK BLAST RESIST', look: 'mines', side: 'rig', also: 'hover',
    tell: 'casings sitting proud of the dirt, and old warning paint',
  },

  // ---- CORE GADGETS: interior, precise ------------------------------------
  rubble: {
    id: 'rubble', name: 'RUBBLE WALL', opener: 'drill:1', by: 'DRILL RIG 1',
    look: 'rubble', side: 'core',
    tell: 'packed loose - it would drill',
  },
  reinforced: {
    id: 'reinforced', name: 'REINFORCED WALL', opener: 'drill:2', by: 'DRILL RIG 2',
    look: 'rubble', side: 'core',
    tell: 'rebar through it; a bigger drill',
  },
  shaft: {
    id: 'shaft', name: 'MINE SHAFT', opener: 'drill:3', by: 'DRILL RIG 3',
    look: 'shaft', side: 'core',
    tell: 'it goes down, and nothing you have goes down',
  },
  // NOT 'ledge'. A grapple barrier is read by its ANCHOR POINT, which is
  // what tells the player a hook would work; the Cheetah's shelf is read by
  // its lip, which is what tells them a run-up would. They used to share a
  // look and therefore told the player nothing.
  rooftop: {
    id: 'rooftop', name: 'HIGH LEDGE', opener: 'grapple:1', by: 'GRAPPLE 1',
    look: 'anchor', side: 'core',
    tell: 'an anchor point at the top, and nothing to climb',
  },
  chain: {
    id: 'chain', name: 'VERTICAL CHAIN', opener: 'grapple:3', by: 'GRAPPLE 3',
    look: 'anchor', side: 'core',
    tell: 'a long way up, in one go',
  },
  belt: {
    id: 'belt', name: 'LIVE BELT', opener: 'hover', by: 'HOVER PACK 1',
    look: 'belt', side: 'core',
    tell: 'it is moving, and it does not stop',
  },
  shutter: {
    id: 'shutter', name: 'SHUTTER', opener: 'cutter:1', by: 'CUTTER 1',
    look: 'door', side: 'core',
    tell: 'a seam and a lock, not a wall',
  },
  bulkhead: {
    id: 'bulkhead', name: 'BULKHEAD', opener: 'cutter:2', by: 'CUTTER 2',
    look: 'door', side: 'core',
    tell: 'thicker, and the seam is welded',
  },
  vault: {
    id: 'vault', name: 'VAULT DOOR', opener: 'cutter:3', by: 'CUTTER 3',
    look: 'door', side: 'core',
    tell: 'whatever is behind this was worth locking properly',
  },

  // ---- CORE ONLY, and no rig ever opens it --------------------------------
  // "That's the rig/core split doing its job." Not a gate you unlock - a place
  // your vehicle physically does not fit, which the player must SEE.
  duct: {
    id: 'duct', name: 'SERVICE DUCT', opener: null, by: 'GO IN ON FOOT',
    look: 'duct', side: 'coreonly',
    tell: 'it is core-sized. Your rig can see it will not fit.',
  },
};
const BARRIER_LIST = Object.keys(BARRIER_TYPES);

// ---------------------------------------------------------------------------
// One barrier standing in the world. Canvas primitives only (rule 5) and the
// shape IS the explanation.
class Barrier {
  constructor(x, y, typeId, opts) {
    const o = opts || {};
    this.x = x; this.y = y;
    this.typeId = typeId;
    this.type = BARRIER_TYPES[typeId] || BARRIER_TYPES.wall;
    this.w = o.w || 620;
    this.h = o.h || 300;
    this.radius = Math.max(this.w, this.h) / 2;
    this.alive = true;
    // A PERMANENT id: a shortcut opened once stays open forever (B.5), and a
    // flag keyed on an array index would reopen every barrier the first time
    // anybody reordered a district file.
    this.id = o.id || null;
    this.shortcut = o.shortcut !== false;
    this.leadsTo = o.leadsTo || null;
    // WHAT IS THROUGH IT. Every one of the twenty-six placed barriers carries
    // one of these in its district row, and until now the constructor threw it
    // away: districtgen packed `{ id, reward }` and this read only the id. So
    // the Ironworks rockfall promised a permanent weapon in the data and gave
    // the player nothing but passage, and there was no error and nothing to
    // notice — the field simply went nowhere.
    this.reward = o.reward || null;
  }

  get opened() { return Barriers.isOpen(this.id); }

  update() {}

  draw(ctx) {
    if (this.opened) { this._drawOpen(ctx); return; }
    const t = this.type;
    const look = t.look;
    const h = BARRIER.HEIGHT[look] === undefined ? 3.4 : BARRIER.HEIGHT[look];

    // FLAT ON PURPOSE. Mined ground, molten ground, flood, a gap and a shaft
    // are things on the ground, and DRAWING_AT_44's list of what is allowed to
    // be flat is exactly that. Everything else stands up and gets all four
    // parts.
    if (h === 0) { this._drawGroundBarrier(ctx, look); return; }

    const box = Props.standing(ctx, {
      x: this.x, y: this.y, w: this.w, d: this.h * 0.5,
      height: h, colour: this._colour(look),
    });

    // What makes each one READABLE (B.2). Drawn ON the front face, which is
    // the surface the player is actually looking at - the previous version put
    // its cracks on the ground plane, which is why it read as a rug.
    const seed = (this.id || look).length * 7 + this.x * 0.01;
    if (look === 'cracked') {
      // ALREADY HALF-FAILED, and the rules for damage: cracks branch, start at
      // corners and the base, and the collapse leaves its own rubble.
      Props.cracks(ctx, box, seed, 2);
      Props.streaks(ctx, box, seed, 4);
      Props.rubbleAtFoot(ctx, box, this._colour(look), seed, 10);
    } else if (look === 'handholds') {
      Props.streaks(ctx, box, seed, 6);
      ctx.strokeStyle = '#6b5a2a'; ctx.lineWidth = 7;   // exposed rebar
      for (let i = 0; i < 8; i++) {
        const hx = box.x0 + 30 + ((i * 97) % Math.max(1, box.x1 - box.x0 - 60));
        const hy = box.near - box.up * (0.15 + ((i * 37) % 70) / 100);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 30, hy - 10); ctx.stroke();
      }
    } else if (look === 'door') {
      ctx.strokeStyle = '#14161c'; ctx.lineWidth = 9;   // THE SEAM
      ctx.beginPath();
      ctx.moveTo(this.x, box.near); ctx.lineTo(this.x, box.near - box.up);
      ctx.stroke();
      ctx.fillStyle = CONFIG.COLOR.yellow;              // AND THE LOCK
      ctx.beginPath();
      ctx.arc(this.x, box.near - box.up * 0.5, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b0e1a';
      ctx.beginPath();
      ctx.arc(this.x, box.near - box.up * 0.5, 10, 0, Math.PI * 2);
      ctx.fill();
      Props.streaks(ctx, box, seed, 3);
    } else if (look === 'anchor') {
      // Sheer and featureless, with a HOOK POINT at the top and nothing below.
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 4;
      for (let i = 1; i < 5; i++) {
        const yy = box.near - box.up * (i / 5);
        ctx.beginPath(); ctx.moveTo(box.x0, yy); ctx.lineTo(box.x1, yy); ctx.stroke();
      }
      ctx.strokeStyle = CONFIG.COLOR.yellow; ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(this.x, box.near - box.up, 24, Math.PI, Math.PI * 2);
      ctx.stroke();
    } else if (look === 'duct') {
      // VISIBLY CORE-SIZED. The opening is a fraction of the face, so a player
      // in a rig can SEE it will not fit - which is the whole of 7.6 in one
      // shape, and it only works because the face exists to cut it out of.
      ctx.fillStyle = '#05070c';
      const dw = 130, dh = box.up * 0.42;
      ctx.fillRect(this.x - dw / 2, box.near - dh, dw, dh);
      ctx.strokeStyle = '#4a4e57'; ctx.lineWidth = 6;
      ctx.strokeRect(this.x - dw / 2, box.near - dh, dw, dh);
      Props.streaks(ctx, box, seed, 3);
    } else if (look === 'rubble') {
      Props.rubbleAtFoot(ctx, box, this._colour(look), seed, 14);
      Props.cracks(ctx, box, seed, 1);
    } else if (look === 'ledge') {
      // The lip, lit from above, which is what says `you could clear this with
      // a run-up` rather than `this is a wall`.
      ctx.fillStyle = Props.tones(this._colour(look)).top;
      ctx.fillRect(box.x0, box.near - box.up - 6, box.x1 - box.x0, 22);
      Props.streaks(ctx, box, seed, 3);
    }

    R.smallText(t.name, this.x, this.y - box.up - this.h * 0.5 - 30, 22,
      t.side === 'coreonly' ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel, 'center');
  }

  _colour(look) {
    if (look === 'door') return '#2e3138';
    if (look === 'handholds') return '#2b2d33';
    if (look === 'anchor') return '#2b2e34';
    if (look === 'duct') return '#26282e';
    return '#2c2f36';
  }

  // The ones allowed to be flat. No front face, no top face, because they are
  // ground - but they still get their own colour and their own tell.
  _drawGroundBarrier(ctx, look) {
    const w = this.w, h = this.h;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (look === 'mines') {
      ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = 12;
      ctx.setLineDash([46, 34]);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.setLineDash([]);
      for (let i = 0; i < 14; i++) {
        const mx = -w / 2 + ((i * 97) % w), my = -h / 2 + ((i * 61) % h);
        // Even a mine casing sits proud of the dirt, so it gets a shadow.
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(mx + 6, my + 5, 17, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a3226';
        ctx.beginPath(); ctx.arc(mx, my, 17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a2a2a';
        ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
      }
    } else if (look === 'molten') {
      ctx.fillStyle = '#2a1a12'; ctx.fillRect(-w / 2, -h / 2, w, h);
      for (let i = 0; i < 10; i++) {
        const gx = -w / 2 + ((i * 83) % w), gy = -h / 2 + ((i * 47) % h);
        ctx.fillStyle = i % 3 === 0 ? '#ff7a1a' : '#c4441a';
        ctx.beginPath(); ctx.ellipse(gx, gy, 60, 26, i, 0, Math.PI * 2); ctx.fill();
      }
    } else if (look === 'water') {
      ctx.fillStyle = '#12303a'; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(120,200,220,0.30)'; ctx.lineWidth = 5;
      for (let i = 0; i < 6; i++) {
        const yy = -h / 2 + (i * h) / 6;
        ctx.beginPath(); ctx.moveTo(-w / 2, yy); ctx.lineTo(w / 2, yy + 14); ctx.stroke();
      }
      ctx.fillStyle = '#1d3b44';
      for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + 60 + i * (w / 4), -20, 54, 40);
    } else {
      // gap, shaft: the ground simply stops. Darkness with a lit near lip, so
      // the edge reads as an edge rather than as a painted rectangle.
      ctx.fillStyle = '#05070c'; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#3a3d44'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.stroke();
      ctx.strokeStyle = '#4d525c';
      ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.stroke();
    }
    ctx.restore();
    R.smallText(this.type.name, this.x, this.y - this.h / 2 - 26, 22,
      this.type.side === 'coreonly' ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel, 'center');
  }

  _drawOpen(ctx) {
    // An opened shortcut still LOOKS like what it was. The player should be
    // able to recognise the wall they smashed a week ago.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#22252b';
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w * 0.18, this.h);
    ctx.fillRect(this.w / 2 - this.w * 0.18, -this.h / 2, this.w * 0.18, this.h);
    ctx.globalAlpha = 1;
    ctx.restore();
    R.smallText('OPEN', this.x, this.y - this.h / 2 - 26, 20,
      CONFIG.COLOR.lime, 'center');
  }
}

// ---------------------------------------------------------------------------
// PLAYTEST 2 ITEM 6 — A STORY FRAGMENT IS A READABLE OBJECT IN THE WORLD.
//
// The district data has emitted `out.story` per chunk since Phase C and
// NOTHING consumed it: 66 fragments placed in the world and none of them
// standing in it. This is the thing that stands. The registry builds one per
// data row exactly the way it builds a Barrier (hazardreg.js), the depth sort
// owns its draw, and the ACTION button reads it (game.js).
//
// It lives in this file for the same reason Barrier does: the class must
// exist before hazardreg.js registers it, and this is the file every harness
// already loads at that point. A Fragment is the second readable thing the
// ACTION button serves; they are one family.
//
// The FOUND state lives on Progress.story.fragments and is only ever written
// through Story.find (js/story.js). The object itself is stateless about it —
// two Fragments of the same id agree forever because neither holds the flag.
const FRAG = {
  READ_R: 200,             // how close before ACTION reads it
  W: 130,                  // a plate, not a building
  HEIGHT: 1.4,             // just above player height: findable, not looming
};

class Fragment {
  constructor(x, y, fragId) {
    this.x = x; this.y = y;
    this.fragId = fragId;
    this.radius = 70;
    this.alive = true;
  }

  get found() {
    return typeof Story !== 'undefined' && Story.found(this.fragId);
  }

  update() {}

  draw(ctx) {
    const found = this.found;
    // Through Props.standing so it obeys DRAWING_AT_44: shadow, top face,
    // front face, ink — a terminal standing on the ground, not a rug.
    const box = Props.standing(ctx, {
      x: this.x, y: this.y, w: FRAG.W, d: FRAG.W * 0.45,
      height: FRAG.HEIGHT, colour: found ? '#23262d' : '#2e3138',
    });
    // The screen face. Amber is world neon (never the faction three), and it
    // is LIT only while unread — a read terminal goes dark, which is how a
    // district you have swept reads as swept at a glance.
    const sw = FRAG.W * 0.62, sh = box.up * 0.46;
    const sx = this.x - sw / 2, sy = box.near - box.up * 0.82;
    ctx.fillStyle = found ? '#0d1014' : '#171208';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = '#14161c'; ctx.lineWidth = 5;
    ctx.strokeRect(sx, sy, sw, sh);
    if (!found) {
      ctx.fillStyle = 'rgba(255,176,32,0.85)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(sx + 10, sy + 8 + i * (sh - 14) / 4,
          sw - 20 - (i * 37 % 40), 4);
      }
      R.smallText('RECORD', this.x, this.y - box.up - this.radius * 0.5 - 8,
        20, '#ffb020', 'center');
    } else {
      R.smallText('LOGGED', this.x, this.y - box.up - this.radius * 0.5 - 8,
        18, CONFIG.COLOR.steel, 'center');
    }
  }
}

// ---------------------------------------------------------------------------
// PHASE C.3 — A FIND IS A THING YOU DRIVE TO AND TAKE.
//
// Every district already listed what it contains — `finds: ['rig:mammoth',
// 'permanent:cn_breaker', ...]` — and NOTHING READ IT. Five districts declared
// eighteen permanent weapons, gadget ranks, modules, cores, colour sets and
// decals between them, and not one of them existed anywhere in the world. C.3
// asks for "Finds — permanent weapons, slots, gadget ranks, colours, decals",
// and a list is not a find; a list is a receipt for something that never
// happened.
//
// This is the object that stands where the data says, in the same family as
// the Barrier and the Fragment: one registry entry, one data row, the depth
// sort owns its draw and the ACTION button reads it.
//
// AND IT CLOSES THE GADGET HOLE. HANDOVER: "Gadgets grant nothing —
// Progress.gadgets is read by every gate and exit and written by nobody."
// Every barrier and every district gate already asks Progress.gadgets what
// rank you hold; this is the thing that writes it. Until now the whole gadget
// half of the traversal matrix was locked behind a door with no key anywhere
// in the world.
const FIND = {
  TAKE_R: 220,             // how close before ACTION takes it
  W: 150,                  // a crate on a pallet, wider than a RECORD plate
  HEIGHT: 1.1,             // lower than a terminal: you look DOWN into it
};

// What each kind of find is called on screen, and what colour it wears. Colour
// is information here: world neon is magenta, amber and white only, so a find
// is AMBER like the RECORD terminals, and the KIND is carried by the word.
const FIND_KINDS = {
  permanent: { label: 'PERMANENT WEAPON' },
  module:    { label: 'MODULE' },
  gadget:    { label: 'GADGET' },
  core:      { label: 'CORE' },
  rig:       { label: 'RIG' },
  slot:      { label: 'SLOT' },
  // BLOCK 10's second currency. FOUND ONLY — never bought, never dropped by a
  // patrol, never farmable — which is what makes it the throttle on power
  // rather than another thing to grind.
  upgrade:   { label: 'UPGRADE PART' },
  colourset: { label: 'COLOUR SET' },
  decal:     { label: 'DECAL' },
  decalset:  { label: 'DECAL SET' },
  // BLOCK 13. A mission item and nothing else: no stats, no socket, no value.
  // It exists so that "bring me the thing" is a real errand with a real object
  // at the end of it rather than a flag that flips when you enter a chunk.
  relic:     { label: 'SALVAGE' },
  // FOUND MONEY (content/CONTENT_STASHES.md, 22 Sept 2026). Kills pay for
  // fighting, missions for following orders, banking for the loop; a STASH
  // pays for going the wrong way on purpose. Small, common, no lock. A
  // VAULT is the rare, large one, and it is SEALED: its `what` is a barrier
  // type from the ability/barrier matrix (wall, cliff, molten, shutter...),
  // and it opens for exactly what that barrier opens for. No new barrier
  // types -- the vaults are what is waiting when the rigs re-open the map.
  stash:     { label: 'STASH' },
  vault:     { label: 'VAULT' },
};

// ---------------------------------------------------------------------------
// STASHES AND VAULTS -- the numbers, as data (rule 7).
//
// The value is ROLLED PER STASH, from a hash of its permanent id, so the same
// stash is worth the same scrap on every save and the placement suite can add
// the whole district up. Weighted low: 80-250 with most of them nearer 80,
// so a district's eight come to ~1,200 -- real money early, pocket change by
// the Barrens, which is the right shape.
//
// THE VAULT VALUE IS DECIDED: option 2 of the doc. Ten vaults at 800-2,500
// plus forty stashes would have bought every machine on the ladder (18,500)
// from found money alone, so the vault keeps its count and cuts its scrap to
// 400-1,200, and its real prize is the UPGRADE PART -- the one currency with
// no other source (`found and missions only`), which is what makes a vault
// worth crossing a district for without shortcutting the ladder.
const STASH = {
  MIN: 80, MAX: 250,
  VAULT_MIN: 400, VAULT_MAX: 1200,
  VAULT_PARTS: 1,
  // THE TELL. A stash glints -- the SCRAP EYE pip, world colour (yellow,
  // never green or cyan: those are the player, and a stash is not the
  // player's). Without the skill the tell is still there, just shorter-
  // ranged; with it the skill's range applies, which is what makes SCRAP
  // EYE worth taking.
  GLINT_R: 700,
  W: 96,                  // a lockbox, smaller than a find crate (150)
  VAULT_W: 300,           // a door, wider than the crate and taller
  VAULT_HEIGHT: 2.6,
};

// FNV-1a over the id, to a 0..1 float. Local so a stash's worth never
// depends on which other file happened to load first.
function stashHash(str, salt) {
  let h = 2166136261;
  const s = String(str) + ':' + (salt || 0);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 100000) / 100000;
}

const Stashes = {
  // 80-250, weighted low (the square of the roll), in fives.
  value(id) {
    const h = stashHash(id, 1);
    const v = STASH.MIN + h * h * (STASH.MAX - STASH.MIN);
    return Math.round(v / 5) * 5;
  },
  // 400-1,200, flat, in fifties.
  vaultValue(id) {
    const h = stashHash(id, 2);
    const v = STASH.VAULT_MIN + h * (STASH.VAULT_MAX - STASH.VAULT_MIN);
    return Math.round(v / 50) * 50;
  },
  // How far the glint reaches right now: the base tell, or SCRAP EYE's own
  // range (and the SCANNER's) when either is longer. The larger wins rather
  // than the two stacking, the same rule the loose-part pip holds.
  glintRange(player) {
    let r = STASH.GLINT_R;
    if (typeof Skills !== 'undefined' && typeof LooseParts !== 'undefined') {
      r = Math.max(r, Skills.sum('lootGlintRange') * LooseParts.GLINT_M);
    }
    if (player && player._scanT > 0) r = Math.max(r, player._scanR || 0);
    return r;
  },
  // Drawn AFTER the world band, on top of the scenery: a mark a pillar can
  // hide is not a mark that tells you a pillar is hiding something. Only the
  // untaken ones, only inside the range, and never in green, cyan or red.
  drawGlints(ctx, player) {
    if (!player || typeof Game === 'undefined' || !Game.states || !Game.states.GAME) return;
    const list = Game.states.GAME.entities || [];
    const r = this.glintRange(player);
    const t = ((typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now()) / 1000;
    for (const e of list) {
      if (!(e instanceof Find) || e.taken) continue;
      if (e.kind !== 'stash' && e.kind !== 'vault') continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d > r) continue;
      const a = 0.5 + Math.sin(t * 6 + e.x * 0.01) * 0.25;
      ctx.globalAlpha = a;
      // A vault glints STEEL, a stash YELLOW: both world colours, and the
      // difference says which from across the street.
      R.circle(e.x, e.y - (e.kind === 'vault' ? 190 : 92), e.kind === 'vault' ? 9 : 7,
        e.kind === 'vault' ? CONFIG.COLOR.steel : CONFIG.COLOR.yellow);
      ctx.globalAlpha = 1;
    }
  },
};

class Find {
  // `spec` is the district's own string — 'gadget:jammer:1', 'permanent:mg_rasp',
  // 'colourset:rust' — so a find is ONE data entry in the same vocabulary the
  // district's `finds` manifest already used, and nothing needed a new grammar.
  constructor(x, y, spec, id) {
    this.x = x; this.y = y;
    this.spec = spec || '';
    const bits = this.spec.split(':');
    this.kind = bits[0] || 'module';
    this.what = bits[1] || '';
    this.rank = bits[2] ? parseInt(bits[2], 10) : 1;
    // A PERMANENT id. Taken once, taken forever — the same rule a shortcut
    // lives by, and for the same reason: a flag keyed on an array index
    // reopens every find the first time anybody reorders a district file.
    this.id = id || (this.kind + '_' + this.what);
    this.radius = 74;
    this.alive = true;
  }

  get taken() {
    return !!(typeof Progress !== 'undefined' && Progress.finds &&
              Progress.finds[this.id]);
  }

  label() {
    const k = FIND_KINDS[this.kind];
    return k ? k.label : 'SALVAGE';
  }

  // The human name of the thing inside, asked of whichever table owns it. A
  // find that says 'RASP' is worth driving to; one that says 'mg_rasp' is a
  // debug string that shipped.
  name() {
    const w = this.what;
    if (this.kind === 'permanent' && typeof PARTS !== 'undefined' && PARTS[w]) {
      return PARTS[w].name || w;
    }
    if (this.kind === 'module' && typeof PARTS !== 'undefined' && PARTS[w]) {
      return PARTS[w].name || w;
    }
    if (this.kind === 'gadget' && typeof GADGETS !== 'undefined' && GADGETS[w]) {
      return (GADGETS[w].name || w) + ' ' + this.rank;
    }
    if (this.kind === 'rig' && typeof RIGS !== 'undefined' && RIGS[w]) {
      return RIGS[w].name || w;
    }
    // A stash says what it is, not what it is worth: the number is the
    // reward for opening it. A vault says both halves of its prize.
    if (this.kind === 'stash') return 'FOUND SCRAP';
    if (this.kind === 'vault') return 'SCRAP AND AN UPGRADE PART';
    // camelCase reads as one shouted word once it is upper-cased, and every
    // relic is named that way: 'grid19Arm' was coming out as GRID19ARM.
    return String(w).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toUpperCase();
  }

  // A VAULT'S SEAL: the barrier type it is shut behind, off the matrix. Null
  // for everything that is not a vault.
  get seal() {
    if (this.kind !== 'vault' || typeof BARRIER_TYPES === 'undefined') return null;
    return BARRIER_TYPES[this.what] || null;
  }

  // What this find is worth in scrap, or 0 for the kinds that are not money.
  get scrapValue() {
    if (this.kind === 'stash') return Stashes.value(this.id);
    if (this.kind === 'vault') return Stashes.vaultValue(this.id);
    return 0;
  }

  update() {}

  draw(ctx) {
    if (this.kind === 'stash') { this._drawStash(ctx); return; }
    if (this.kind === 'vault') { this._drawVault(ctx); return; }
    const taken = this.taken;
    const box = Props.standing(ctx, {
      x: this.x, y: this.y, w: FIND.W, d: FIND.W * 0.55,
      height: FIND.HEIGHT, colour: taken ? '#22252b' : '#2b2f37',
    });
    // The lid. Lit amber while it still holds something, dark once emptied —
    // so a district you have swept reads as swept from across the ground, the
    // same way a read RECORD does.
    const lw = FIND.W * 0.66, lh = box.up * 0.5;
    const lx = this.x - lw / 2, ly = box.near - box.up * 0.86;
    ctx.fillStyle = taken ? '#0d1014' : '#1d1408';
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = '#14161c'; ctx.lineWidth = 5;
    ctx.strokeRect(lx, ly, lw, lh);
    if (!taken) {
      // A cross-brace, so it reads as a crate rather than a screen.
      ctx.strokeStyle = 'rgba(255,176,32,0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(lx + 8, ly + 6); ctx.lineTo(lx + lw - 8, ly + lh - 6);
      ctx.moveTo(lx + lw - 8, ly + 6); ctx.lineTo(lx + 8, ly + lh - 6);
      ctx.stroke();
      R.smallText(this.label(), this.x,
        this.y - box.up - this.radius * 0.5 - 8, 19, '#ffb020', 'center');
    } else {
      R.smallText('EMPTY', this.x, this.y - box.up - this.radius * 0.5 - 8,
        18, CONFIG.COLOR.steel, 'center');
    }
  }

  // A STASH: a lockbox somebody hid and did not come back for. Low -- you
  // look down into it -- and small, because it is a reward for noticing.
  // The lid is lit yellow (world colour) while it still holds something.
  _drawStash(ctx) {
    const taken = this.taken;
    const box = Props.standing(ctx, {
      x: this.x, y: this.y, w: STASH.W, d: STASH.W * 0.6,
      height: 0.7, colour: taken ? '#20232a' : '#2f2a22',
    });
    const lw = STASH.W * 0.7, lh = Math.max(8, box.up * 0.5);
    const lx = this.x - lw / 2, ly = box.near - box.up * 0.9;
    ctx.fillStyle = taken ? '#0d1014' : '#3a2e10';
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = taken ? '#14161c' : CONFIG.COLOR.yellow;
    ctx.lineWidth = 4;
    ctx.strokeRect(lx, ly, lw, lh);
    if (!taken) {
      // A hasp, so it reads as a box that shuts rather than a plate.
      ctx.fillStyle = CONFIG.COLOR.yellow;
      ctx.fillRect(this.x - 8, ly - 4, 16, lh + 8);
      R.smallText('STASH', this.x, this.y - box.up - this.radius * 0.5 - 4,
        18, CONFIG.COLOR.yellow, 'center');
    } else {
      R.smallText('LOOTED', this.x, this.y - box.up - this.radius * 0.5 - 4,
        16, CONFIG.COLOR.steel, 'center');
    }
  }

  // A VAULT: a closed industrial door with its opener WRITTEN ON IT -- the
  // same read the barrier props need, and the reason a player can guess
  // what opens it from across the street. Drawn like the matrix's `door`
  // look (a seam, a lock) so a vault and a shutter are visibly one family.
  _drawVault(ctx) {
    const taken = this.taken;
    const seal = this.seal;
    const box = Props.standing(ctx, {
      x: this.x, y: this.y, w: STASH.VAULT_W, d: STASH.VAULT_W * 0.4,
      height: STASH.VAULT_HEIGHT, colour: taken ? '#23262d' : '#2e3138',
    });
    ctx.strokeStyle = '#14161c'; ctx.lineWidth = 9;                 // THE SEAM
    ctx.beginPath();
    ctx.moveTo(this.x, box.near); ctx.lineTo(this.x, box.near - box.up);
    ctx.stroke();
    ctx.fillStyle = taken ? '#3a3d44' : CONFIG.COLOR.yellow;        // THE LOCK
    ctx.beginPath();
    ctx.arc(this.x, box.near - box.up * 0.55, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0e1a';
    ctx.beginPath();
    ctx.arc(this.x, box.near - box.up * 0.55, 9, 0, Math.PI * 2);
    ctx.fill();
    // THE OPENER, ON THE DOOR. Stencilled across the top of the face in the
    // steel the barrier prompts use, so it is information and not neon.
    if (seal) {
      R.smallText(seal.by, this.x, box.near - box.up * 0.86, 20,
        taken ? '#3a3d44' : CONFIG.COLOR.steel, 'center');
    }
    const top = this.y - box.up - this.radius * 0.5 - 30;
    if (!taken) {
      R.smallText('VAULT' + (seal ? ' — ' + seal.name : ''), this.x, top, 22,
        CONFIG.COLOR.yellow, 'center');
    } else {
      R.smallText('VAULT — OPEN', this.x, top, 20, CONFIG.COLOR.steel, 'center');
    }
  }
}

// The one writer. Everything that grants a find goes through here, so there is
// exactly one place that knows how a district's `finds` vocabulary maps onto
// the records the rest of the game already reads — and none of those records
// gained a second writer.
const Finds = {
  TAKE_R: FIND.TAKE_R,

  taken(id) {
    return !!(typeof Progress !== 'undefined' && Progress.finds &&
              Progress.finds[id]);
  },

  // The find ACTION would take: nearest untaken Find in the live entity list.
  // Scans the same way Story.nearest does and for the same reason — the list
  // is per-chunk and short.
  nearest(player) {
    if (typeof World === 'undefined' || !player) return null;
    const st = (typeof Game !== 'undefined' && Game.states && Game.states.GAME)
      ? Game.states.GAME : null;
    const list = (st && st.entities) || [];
    let best = null, bd = FIND.TAKE_R;
    for (const e of list) {
      if (!(e instanceof Find) || e.taken) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  // WHY A VAULT WILL NOT OPEN FOR THIS MACHINE, or null. The seal is a
  // barrier type and the answer is Barriers.canOpen's -- the one predicate
  // the walls, the HUD prompt and the suites already ask -- so a vault
  // sealed behind molten ground opens for exactly the rig that crosses
  // molten ground, and for nothing else. Never "locked": always the thing
  // that would open it, because the player has to be able to guess.
  refusal(find, player) {
    if (!find || find.kind !== 'vault') return null;
    const seal = find.seal;
    if (!seal || typeof Barriers === 'undefined') return null;
    const stand = { type: seal, typeId: seal.id };
    if (Barriers.canOpen(player, stand)) return null;
    if (seal.side === 'coreonly') return 'VAULT — ' + seal.name + '. GO IN ON FOOT.';
    return 'VAULT — NEEDS ' + seal.by;
  },

  // TAKE IT. Returns the words to put on screen, or null if it did nothing.
  //
  // Each branch writes through the record that already exists and is already
  // read by something: Permanents.grant, Progress.gadgets (which every gate
  // reads), Progress.rigsOwned, Progress.partsSeen. Nothing here invents a
  // second source of truth for anything.
  take(find, player) {
    if (!find || find.taken) return null;
    // A SEALED VAULT does nothing. The refusal is the prompt (drawHUD), so
    // the press is not the place to say it again.
    if (this.refusal(find, player)) return null;
    let got = null;
    const w = find.what;
    switch (find.kind) {
      case 'permanent':
        if (typeof Permanents !== 'undefined' && Permanents.grant(w)) {
          got = find.name();
        }
        break;
      case 'gadget': {
        // THE HOLE THIS CLOSES. Every barrier opener and every district gate
        // asks Progress.gadgets for a rank; this is what puts one there.
        Progress.gadgets = Progress.gadgets || {};
        if ((Progress.gadgets[w] || 0) < find.rank) {
          Progress.gadgets[w] = find.rank;
          got = find.name();
        }
        break;
      }
      case 'rig':
        if (typeof Progress !== 'undefined' && Progress.unlockRig) {
          Progress.rigsOwned = Progress.rigsOwned || {};
          if (!Progress.rigsOwned[w]) { Progress.rigsOwned[w] = true; got = find.name(); }
        }
        break;
      case 'core':
        Progress.coresOwned = Progress.coresOwned || {};
        if (!Progress.coresOwned[w]) { Progress.coresOwned[w] = true; got = find.name(); }
        break;
      case 'module':
        // A module is a PART you now own and can fit. `partsSeen` is the
        // record the garage screen already reads to decide what to offer.
        Progress.partsSeen = Progress.partsSeen || {};
        if (!Progress.partsSeen[w]) { Progress.partsSeen[w] = true; got = find.name(); }
        break;
      case 'slot':
        Progress.foundSlots = (Progress.foundSlots || 0) + 1;
        if (typeof Radio !== 'undefined') Radio.fire('first_permanent_slot');
        got = 'A SLOT';
        break;
      case 'upgrade': {
        // Through Spine.found, the one writer, so nothing else can ever pay
        // them out at a rate.
        const many = find.rank || 1;
        if (typeof Spine !== 'undefined') Spine.found(many);
        got = many + ' UPGRADE PART' + (many === 1 ? '' : 'S');
        break;
      }
      // A RELIC IS THE ERRAND ITSELF. Four are placed in the districts and
      // NONE of them had a case here, so every mission item in the game fell
      // through to `default`, came back with nothing, and said ALREADY HELD
      // to a player picking it up for the first time. The record that matters
      // is `Progress.finds`, written below for every kind — a relic has no
      // second record because it is not worth anything; it is worth SOMEONE.
      case 'relic':
        got = find.name();
        break;
      // FOUND MONEY. Through Forge.bank, the one writer every source of scrap
      // already goes through, so MARKET SENSE counts it the way it counts a
      // kill. A vault adds its upgrade part through Spine.found, the one
      // writer for those, for the same reason.
      case 'stash': {
        const v = find.scrapValue;
        const paid = (typeof Forge !== 'undefined') ? Forge.bank(v) : v;
        got = paid + ' SCRAP';
        break;
      }
      case 'vault': {
        const v = find.scrapValue;
        const paid = (typeof Forge !== 'undefined') ? Forge.bank(v) : v;
        const many = STASH.VAULT_PARTS;
        if (typeof Spine !== 'undefined') Spine.found(many);
        got = paid + ' SCRAP + ' + many + ' UPGRADE PART' + (many === 1 ? '' : 'S');
        break;
      }
      case 'colourset':
      case 'decalset':
      case 'decal':
        Progress.paintOwned = Progress.paintOwned || {};
        if (!Progress.paintOwned[find.kind + ':' + w]) {
          Progress.paintOwned[find.kind + ':' + w] = true;
          got = find.name();
        }
        break;
      default:
        break;
    }
    // Marked taken even when the payload was already held — otherwise a find
    // you have emptied stands there lit forever, promising something it will
    // never give again.
    Progress.finds = Progress.finds || {};
    Progress.finds[find.id] = true;
    if (typeof Progress.save === 'function') Progress.save();
    if (typeof Audio_ !== 'undefined') Audio_.play(got ? 'unlock' : 'pickup');
    return got ? (find.label() + ': ' + got) : 'ALREADY HELD';
  },
};

// ---------------------------------------------------------------------------
// BLOCK 14 — THE MOUTH OF A LAIR.
//
// The class lives HERE and its data lives in js/lairs.js, for the reason the
// Barrier and the Fragment do: hazardreg.js registers it, hazardreg.js loads
// early, and a class registered before it is declared is not a class. Every
// harness in the tree already loads this file at that point.
const LAIR_B = {
  DOOR_R: 300,             // how close to the mouth before ACTION takes you in
  W: 620,                  // the mouth itself
  HEIGHT: 4.4,
};

// ---------------------------------------------------------------------------
// THE MOUTH. Stands in the world; ACTION takes you in and the door shuts.
//
// Not auto-travel on contact, unlike a district gate. A district gate is a
// road and driving down a road should not need permission; a lair is a
// decision you cannot take back, and the button IS the commitment.
class LairDoor {
  constructor(x, y, lairId) {
    this.x = x; this.y = y;
    this.lairId = lairId;
    this.radius = LAIR_B.W / 2;
    // AND w/h FOR THE DRAW BAND, which culls on a rect rather than a radius.
    // Caught by test_block1's new sum the first time it ran: a mouth 620 wide
    // described only by a radius is culled as a 600-unit square, which is
    // very nearly right and would have been wrong at the edges forever.
    this.w = LAIR_B.W; this.h = 240;
    this.alive = true;
  }

  get def() { return LAIRS[this.lairId]; }
  get beaten() { return Lairs.beaten(this.lairId); }

  update() {}

  draw(ctx) {
    const done = this.beaten;
    const lit = done ? CONFIG.COLOR.steel : '#ff7a1a';
    const hw = LAIR_B.W / 2;
    // A mouth in a wall: two heavy posts and a dark opening between them, and
    // the opening GLOWS, because what is through it is a furnace.
    const l = Props.standing(ctx, {
      x: this.x - hw, y: this.y, w: 150, d: 120,
      height: LAIR_B.HEIGHT, colour: '#24262b',
    });
    Props.standing(ctx, {
      x: this.x + hw, y: this.y, w: 150, d: 120,
      height: LAIR_B.HEIGHT, colour: '#24262b',
    });
    const oh = l.up * 0.78;
    ctx.fillStyle = done ? '#0b0e12' : '#20100a';
    ctx.fillRect(this.x - hw, l.near - oh, LAIR_B.W, oh);
    if (!done) {
      // The glow out of the mouth. This is the only orange light in a
      // district full of orange light that is coming at you from indoors.
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = lit;
      ctx.beginPath();
      ctx.ellipse(this.x, l.near + 30, LAIR_B.W * 0.9, 130, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = lit; ctx.lineWidth = 8;
    ctx.strokeRect(this.x - hw, l.near - oh, LAIR_B.W, oh);
    const d = this.def;
    R.text(done ? 'CLEARED' : (d ? d.name : 'LAIR'),
      this.x, this.y - l.up - 40, 46, lit);
    if (!done) {
      R.smallText('SEALED ONCE YOU ARE IN', this.x, this.y - l.up - 14, 20,
        CONFIG.COLOR.steel, 'center');
    }
  }
}

const LairDoors = {
  // The door ACTION would take, if any.
  nearest(player) {
    if (!player || typeof World === 'undefined') return null;
    let best = null, bd = LAIR_B.DOOR_R;
    for (const e of World.owned) {
      if (!(e instanceof LairDoor)) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
};

// ---------------------------------------------------------------------------
// BLOCK 13 — AN NPC IS A MACHINE THAT STAYS STILL AND TALKS.
//
// Nine of them have existed as data since the content library landed, with
// full dialogue, and nothing has ever put one in the world. The complaint is
// exact: there is nothing to do out here but shoot patrols.
//
// An NPC is the same shape as everything else that matters and stands up: a
// registry entry, a data row, the depth sort owns its draw, ACTION reads it.
// It is deliberately NOT a machine you can fight — no hp, no parts, nothing
// to strip. It is a fixture, and the fact that you cannot take anything off
// it is most of what makes it a person rather than a target.
const NPC_B = {
  TALK_R: 300,             // how close before ACTION talks to it
  W: 210,
  HEIGHT: 2.4,             // waist-high on a rig: you look DOWN at it
};

// ---------------------------------------------------------------------------
// AN ESCORTEE — the thing you are protecting.
//
// ESCORT is the last of the five mission types, and CONTENT_MISSIONS is blunt
// about why it was left until last:
//
//   "the HARDEST TO MAKE FUN. Keep them short and keep the escorted thing
//    tough."
//
// Three rules, and every one of them is a rule about what NOT to build:
//
//   SLOW ENOUGH TO BE A BURDEN. If it keeps up with you it is not an escort,
//   it is a follower, and the mission is a walk with a friend. It moves at a
//   little over half your speed, so getting ahead is the natural mistake and
//   coming back is the job.
//
//   FRAGILE ENOUGH TO MATTER. If it cannot die the mission cannot be failed
//   and there is nothing to protect. It has real health, it takes real damage,
//   and machines shoot at it in preference to you when it is closer.
//
//   FAILURE IS LOSING IT, NEVER A TIMER. There is no clock anywhere in this
//   class. The drafts carry a `tuning.seconds` and it is a PACING note - how
//   long the run should take - not a fail condition. A timer turns protecting
//   something into rushing it, which is the opposite mission.
//
// And the rule that follows from the third: IT ONLY MOVES WHILE YOU ARE NEAR.
// An escortee that walks on alone while you deal with something behind you is
// a timer wearing a costume - it puts you under time pressure and calls it
// AI. This one stops and waits, so every metre it covers is a metre you chose
// to be beside it for, and losing it is always your position and never your
// pace.
const ESCORT_B = {
  SPEED: 210,              // ~55% of a bare machine. A burden, on purpose.
  LEASH: 1500,             // past this it stops and waits for you
  ARRIVE: 420,             // how close to the destination counts as there
  HP: 420,                 // tough, per the design note - not a paper doll
  // ...and TOUGHER still when the mission says so. TALLY's harvester is the
  // one that carries `escorteeTough`, and the note beside it is explicit
  // that the fight is a swarm you hold off rather than a health bar you
  // nurse.
  TOUGH_MUL: 1.75,
  RADIUS: 96,
  TURN: 2.4,
};

class Escortee {
  constructor(x, y, id, toX, toY) {
    this.x = x; this.y = y;
    this.escortId = id;
    this.toX = toX === undefined ? x : toX;
    this.toY = toY === undefined ? y : toY;
    this.radius = ESCORT_B.RADIUS;
    this.w = ESCORT_B.RADIUS * 2; this.h = ESCORT_B.RADIUS * 2;
    this.alive = true;
    // PER-MISSION TUNING. `MISSIONS[id].tuning` writes `{ seconds, 
    // escorteeTough }` and NOTHING READ IT: every escort in the game had the
    // same 420 health however the mission described it, and TALLY's harvester
    // -- the one the note calls TOUGH, because you are guarding it from
    // swarms rather than babysitting a paper doll -- was the same paper doll
    // as everything else. Balance is data (rule 7).
    const tune = (typeof MISSIONS !== 'undefined' && MISSIONS[id] &&
                  MISSIONS[id].tuning) || {};
    this.hp = ESCORT_B.HP * (tune.escorteeTough ? ESCORT_B.TOUGH_MUL : 1);
    this.maxHp = this.hp;
    // And how long it has, when the mission gives it a clock. Zero means no
    // clock, which is what every escort had before this line.
    this.seconds = tune.seconds || 0;
    this.left = this.seconds;
    this.angle = Math.atan2(this.toY - y, this.toX - x);
    this.arrived = false;
    this.waiting = true;
    this.flash = 0;
    this._t = 0;
  }

  // Shot like anything else. THIS IS THE MISSION: an escortee that cannot be
  // hurt is scenery, and protecting scenery is not a job.
  hit(dmg) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.12;
    if (typeof Effects !== 'undefined') {
      Effects.spark(this.x, this.y, Math.random() * Math.PI * 2, 3,
        CONFIG.COLOR.yellow, 200);
    }
    if (this.hp > 0) return;
    this.alive = false;
    if (typeof Effects !== 'undefined') {
      Effects.explosion(this.x, this.y, 240);
      Effects.comicWord('LOST IT', this.x, this.y - 200, CONFIG.COLOR.red, 66);
    }
    if (typeof Camera !== 'undefined') Camera.shake(16, 0.4);
    if (typeof Audio_ !== 'undefined') Audio_.play('scrapped');
  }

  // Everything that shoots at a machine calls one of these two. Both land on
  // the same place, so nothing has to know an escortee is a special case.
  takeCoreDamage(dmg) { this.hit(dmg); }

  distanceLeft() { return Math.hypot(this.toX - this.x, this.toY - this.y); }

  update(dt, player) {
    this.flash = Math.max(0, this.flash - dt);
    if (!this.alive || this.arrived) return;
    this._t += dt;

    // THE CLOCK, WHEN THE MISSION GIVES IT ONE. TALLY's harvester has 170
    // seconds and had none: `tuning.seconds` was written and read by nothing,
    // so the one escort in the game that is supposed to be a race was a
    // stroll. Running out is a FAILURE, not a death — the escortee stops
    // being escorted, the record is never written, and §16's rule holds that
    // failing an escort is not a state you are stuck in, it is a thing you go
    // and do again.
    if (this.seconds > 0) {
      this.left = Math.max(0, this.left - dt);
      if (this.left <= 0) {
        this.alive = false;
        this.timedOut = true;
        if (typeof Effects !== 'undefined') {
          Effects.comicWord('TOO SLOW', this.x, this.y - 200,
            CONFIG.COLOR.red, 66);
        }
        return;
      }
    }

    if (this.distanceLeft() < ESCORT_B.ARRIVE) {
      this.arrived = true;
      if (typeof Effects !== 'undefined') {
        Effects.comicWord('DELIVERED', this.x, this.y - 200,
          CONFIG.COLOR.lime, 66);
      }
      if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
      return;
    }

    // IT WAITS FOR YOU. The whole difference between an escort and a timer.
    const near = player && player.alive !== false &&
                 Math.hypot(player.x - this.x, player.y - this.y) < ESCORT_B.LEASH;
    this.waiting = !near;
    if (!near) return;

    const a = Math.atan2(this.toY - this.y, this.toX - this.x);
    // Turns rather than snapping, because a thing that pivots on the spot
    // reads as a cursor and this has to read as a machine with mass.
    let d = a - this.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.angle += Math.max(-ESCORT_B.TURN * dt,
      Math.min(ESCORT_B.TURN * dt, d));
    this.x += Math.cos(this.angle) * ESCORT_B.SPEED * dt;
    this.y += Math.sin(this.angle) * ESCORT_B.SPEED * dt;
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    // GREEN, because the faction read is not negotiable: green and cyan are
    // yours, red is hostile. An escortee is yours to lose.
    const body = this.flash > 0 ? '#ffffff' : '#7fbf4a';
    ctx.translate(this.x, this.y);
    if (typeof Outdoors !== 'undefined' && Outdoors.shadow) {
      Outdoors.shadow(ctx, 0, this.radius * 0.42, this.radius * 0.95, 0.42);
    }
    ctx.rotate(this.angle);
    const r = this.radius;
    ctx.fillStyle = body;
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 8;
    // A hauler shape: a long flat body with a cab at the front, so it reads as
    // something carrying a load rather than as another fighting machine.
    ctx.beginPath();
    ctx.roundRect(-r, -r * 0.62, r * 2, r * 1.24, 14);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2c3a22';
    ctx.fillRect(r * 0.18, -r * 0.44, r * 0.6, r * 0.88);
    ctx.strokeRect(r * 0.18, -r * 0.44, r * 0.6, r * 0.88);
    ctx.restore();

    // ITS HEALTH, ALWAYS. The player has to be able to see it losing without
    // looking away from the fight, or "protect this" is a rule they find out
    // about afterwards.
    // WELL CLEAR OF IT. The first shot put the bar 46 units above the body,
    // which at a normal zoom sits it on top of whatever is standing behind -
    // and in that shot it was the player, so the one readout the mission is
    // about was drawn through a machine.
    const w = 170, hy = this.y - this.radius - 132;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.x - w / 2, hy, w, 16);
    ctx.fillStyle = this.hp / this.maxHp > 0.35
      ? CONFIG.COLOR.lime : CONFIG.COLOR.orange;
    ctx.fillRect(this.x - w / 2, hy,
      w * Math.max(0, this.hp / this.maxHp), 16);
    ctx.strokeStyle = CONFIG.COLOR.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x - w / 2, hy, w, 16);
    ctx.restore();
    if (typeof R !== 'undefined') {
      R.smallText(this.waiting ? 'WAITING' : 'ESCORT',
        this.x, hy - 20, 20,
        this.waiting ? CONFIG.COLOR.yellow : CONFIG.COLOR.lime, 'center');
    }
  }
}

class NPC {
  constructor(x, y, id) {
    this.x = x; this.y = y;
    this.npcId = id;
    this.radius = 92;
    this.alive = true;
  }

  get def() {
    return (typeof NPCS !== 'undefined') ? NPCS[this.npcId] : null;
  }

  // What it would say if you pressed ACTION right now — the mission runtime
  // decides, so the world object holds no state about the conversation.
  get badge() {
    return (typeof Missions !== 'undefined') ? Missions.badgeFor(this.npcId) : null;
  }

  update() {}

  draw(ctx) {
    const d = this.def;
    const b = this.badge;
    // Amber like every other thing in this world you WALK UP TO rather than
    // shoot: the RECORD terminals, the find crates, the district gates. Red
    // is hostile and green is you, and an NPC is neither.
    const lit = '#ffb020';
    const box = Props.standing(ctx, {
      x: this.x, y: this.y, w: NPC_B.W, d: NPC_B.W * 0.7,
      height: NPC_B.HEIGHT, colour: '#2b2e36',
    });
    // A lit eye band. It is awake, it has been awake for four hundred years,
    // and that is the whole character of every one of them.
    const ew = NPC_B.W * 0.5, eh = Math.max(6, box.up * 0.14);
    ctx.fillStyle = lit;
    ctx.fillRect(this.x - ew / 2, box.near - box.up * 0.72, ew, eh);
    ctx.strokeStyle = CONFIG.COLOR.ink; ctx.lineWidth = 4;
    ctx.strokeRect(this.x - ew / 2, box.near - box.up * 0.72, ew, eh);

    const top = this.y - box.up - this.radius * 0.5 - 8;
    R.smallText(d ? d.name : 'UNIT', this.x, top, 22, lit, 'center');
    // THE BADGE IS THE POINT. A world with nine people in it and no way to
    // tell which of them wants something is a world with nine props in it.
    if (b) {
      R.text(b.mark, this.x, top - 30, 40, b.ink);
    }
  }
}

// ---------------------------------------------------------------------------
// A GARAGE IS A BUILDING.
//
// Until now it was a COORDINATE. Nothing drew it, nothing stood there, and
// banking happened because you crossed an invisible circle — so the single
// most important place in the game was a menu that opened itself when you
// drove over an empty patch of ground. Every other thing that matters in this
// world stands up and can be seen: barriers, fragments, finds, district gates.
// The garage was the exception and it was the wrong exception.
//
// What it is now:
//   A BIG SOLID SHED you cannot drive through, wider than anything generated.
//   A DOOR on one face — a lit opening, and the ONLY way in. Banking happens
//     at the door, not within a radius of the centre.
//   A SIGN on the roof, lit, drawn at a size that survives being far away,
//     so "there is a garage over there" is answerable by looking.
//   A LAMP over the door, because the one thing you look for at distance in a
//     dark world is the lit thing.
//
// Owned garages are lit green. A garage you have not claimed is lit AMBER and
// its sign says HELD — you can see it is a garage, you can see it is not
// yours, and neither fact needs a prompt.
const GARAGE_B = {
  W: 900,                  // the shed itself, in world units
  D: 620,
  // 3.6 player heights - the same band DRAWING_AT_44 gives a barrier, which is
  // the height at which a thing reads as impassable rather than drive-over-able.
  // 5.2 was tried first: it put the roof sign above the top of the screen
  // whenever you were close enough to use the door, and occluded half a chunk.
  HEIGHT: 3.6,
  DOOR_W: 300,             // the opening on the south face
  DOOR_R: 220,             // how close to the DOOR before you are inside
  SIGN_H: 92,              // the roof sign, drawn big on purpose
};

class GarageBuilding {
  constructor(x, y, id) {
    this.x = x; this.y = y;
    this.gid = id;
    // The AABB every collision path already understands (the same convention
    // a wall and a solid prop use), MINUS the doorway, which is cut out of
    // the south face by `doorGap` below.
    this.w = GARAGE_B.W; this.h = GARAGE_B.D;
    this.radius = Math.max(this.w, this.h) / 2;
    this.height = GARAGE_B.HEIGHT;
    this.alive = true;
  }

  // The door's centre, in world space. On the SOUTH face — the side the
  // camera looks at — so you always drive in through the front of the
  // building rather than clipping the back of it.
  get doorX() { return this.x; }
  get doorY() { return this.y + GARAGE_B.D / 2; }

  get owned() {
    return !!(typeof Garages !== 'undefined' && Garages.owned(this.gid));
  }

  get name() {
    const g = (typeof Garages !== 'undefined')
      ? Garages.list.find(q => q.id === this.gid) : null;
    return g ? g.name : 'GARAGE';
  }

  // THE SOLID PARTS. Two boxes, not one, with the doorway between them — so
  // the shed is genuinely solid and the door is genuinely a gap, using the
  // same AABBs everything else in the world collides against. A single box
  // with a "door" drawn on it would be a picture of a door.
  walls() {
    const hw = GARAGE_B.W / 2, hd = GARAGE_B.D / 2, dh = GARAGE_B.DOOR_W / 2;
    const x0 = this.x - hw, y0 = this.y - hd;
    const t = 90;                          // wall thickness
    return [
      { x: x0, y: y0, w: GARAGE_B.W, h: t },                     // north
      { x: x0, y: y0, w: t, h: GARAGE_B.D },                     // west
      { x: this.x + hw - t, y: y0, w: t, h: GARAGE_B.D },        // east
      // South, in two pieces with the doorway between them.
      { x: x0, y: this.y + hd - t, w: hw - dh, h: t },
      { x: this.x + dh, y: this.y + hd - t, w: hw - dh, h: t },
    ];
  }

  update() {}

  draw(ctx) {
    const own = this.owned;
    const lit = own ? CONFIG.COLOR.lime : '#ffb020';
    const hw = GARAGE_B.W / 2, hd = GARAGE_B.D / 2;

    // The shed, through Props.standing so it obeys DRAWING_AT_44 — shadow,
    // top face, front face, ink — like every other thing that stands up.
    const box = Props.standing(ctx, {
      x: this.x, y: this.y, w: GARAGE_B.W, d: GARAGE_B.D,
      height: GARAGE_B.HEIGHT, colour: own ? '#2a3330' : '#32302a',
    });

    // THE DOOR: a dark opening in the front face with a lit frame. Drawn
    // after the shed so it reads as cut INTO it.
    const dw = GARAGE_B.DOOR_W, dh2 = box.up * 0.62;
    const dx = this.x - dw / 2, dy = box.near - dh2;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(dx, dy, dw, dh2);
    ctx.strokeStyle = lit;
    ctx.lineWidth = 8;
    ctx.strokeRect(dx, dy, dw, dh2);
    // The lamp over it. The one thing you look for at distance in a dark
    // world is the lit thing, so this is deliberately the brightest object
    // the district generates.
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.ellipse(this.x, box.near + 40, dw * 1.5, 150, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    R.rect(this.x - 46, dy - 26, 92, 20, lit);

    // THE SIGN on the roof, big. This is the "visible at distance" half of
    // the brief: it is drawn at a fixed world size well above the shed, so a
    // garage announces itself from across a chunk without a HUD marker.
    // ON the roof, not floating above it. The first version put it 200 units
    // clear of the shed and it left the frame the moment you drove up to the
    // door — a sign you can only read from far away is half a sign.
    const sy = this.y - box.up - GARAGE_B.SIGN_H * 0.55;
    R.roundRect(this.x - GARAGE_B.W * 0.42, sy, GARAGE_B.W * 0.84,
      GARAGE_B.SIGN_H, 10, 'rgba(6,8,14,0.92)', lit, 7);
    R.text(own ? 'GARAGE' : 'HELD', this.x, sy + GARAGE_B.SIGN_H * 0.40,
      54, lit);
    R.smallText(this.name, this.x, sy + GARAGE_B.SIGN_H * 0.60, 26,
      CONFIG.COLOR.steel, 'center');

    // Bay markings on the apron, so the ground in front reads as a forecourt
    // rather than as more dirt.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,63,0.22)';
    ctx.lineWidth = 8;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(this.x + i * 150, this.y + hd + 40);
      ctx.lineTo(this.x + i * 150, this.y + hd + 300);
      ctx.stroke();
    }
    ctx.restore();
    void hw;
  }
}

// ---------------------------------------------------------------------------
// PHASE C — A DISTRICT EXIT IS A PLACE YOU DRIVE THROUGH.
//
// Until this existed the five districts were built, tagged and UNREACHABLE:
// the only call to _enterDistrict was hard-wired to the Yard, so four
// districts' worth of content had no door. C.1's Layer 1 names "district
// entrances and exits" as hand-placed data; this is the object that stands
// where the data says.
//
// An exit is INFRASTRUCTURE, not scenery: it is world-owned (World.own), so
// it exists whether or not its chunk is loaded, exactly like the player's
// tow. Driving onto it travels; being refused tells you WHY in the same
// register a barrier does (B.2: never "blocked", always the thing that would
// open it).
const EXIT = {
  NEAR_R: 620,             // how close before it names where it goes
  GO_R: 210,               // driving onto it travels
  ARRIVE_STEP: 760,        // arrive this far inside the far gate, facing in
  W: 520,
};

class DistrictExit {
  constructor(x, y, to) {
    this.x = x; this.y = y;
    this.to = to;
    this.radius = EXIT.W / 2;
    this.alive = true;
  }

  get targetName() {
    return (typeof DISTRICTS !== 'undefined' && DISTRICTS[this.to])
      ? DISTRICTS[this.to].name : String(this.to).toUpperCase();
  }

  update() {}

  draw(ctx) {
    // Two posts and a beam — a freight gate on the road out. The plate is
    // amber (world neon), because the network built it and still powers it.
    const hw = EXIT.W / 2;
    const l = Props.standing(ctx, {
      x: this.x - hw, y: this.y, w: 90, d: 70, height: 2.6, colour: '#2c2f36',
    });
    Props.standing(ctx, {
      x: this.x + hw, y: this.y, w: 90, d: 70, height: 2.6, colour: '#2c2f36',
    });
    ctx.fillStyle = '#23262d';
    ctx.fillRect(this.x - hw, this.y - l.up - 26, EXIT.W, 26);
    ctx.strokeStyle = '#0b0e1a'; ctx.lineWidth = 5;
    ctx.strokeRect(this.x - hw, this.y - l.up - 26, EXIT.W, 26);
    // Chevrons on the ground, pointing through.
    ctx.strokeStyle = 'rgba(255,176,32,0.35)'; ctx.lineWidth = 10;
    for (let i = 0; i < 3; i++) {
      const yy = this.y + 60 + i * 70;
      ctx.beginPath();
      ctx.moveTo(this.x - 70, yy + 34);
      ctx.lineTo(this.x, yy);
      ctx.lineTo(this.x + 70, yy + 34);
      ctx.stroke();
    }
    R.smallText(this.targetName, this.x, this.y - l.up - 58, 24,
      '#ffb020', 'center');
  }
}

// ---------------------------------------------------------------------------
const Barriers = {
  // B.5. Opened once, open forever, in the save.
  isOpen(id) {
    if (!id) return false;
    return !!(typeof Progress !== 'undefined' && Progress.shortcuts &&
              Progress.shortcuts[id]);
  },
  open(id) {
    if (!id) return false;
    Progress.shortcuts = Progress.shortcuts || {};
    if (Progress.shortcuts[id]) return false;
    Progress.shortcuts[id] = true;
    if (typeof Progress !== 'undefined') Progress.save();
    return true;
  },
  openedList() { return Object.keys((Progress && Progress.shortcuts) || {}); },

  // ---- B.1: can this machine, right now, get through this? --------------
  // ONE function. The HUD prompt, the collision and the tests all ask it, so
  // "the door opened but I still cannot walk through" cannot happen.
  canOpen(player, barrier) {
    const t = (barrier && barrier.type) || null;
    if (!t) return false;
    // CORE ONLY. No rig opens these, ever - that is the split doing its job.
    if (t.side === 'coreonly') {
      return typeof Rigs === 'undefined' || !Rigs.dockedId();
    }
    // THE RIG YOU ARE IN OPENS WHAT ITS OWN ENTRY SAYS IT OPENS.
    //
    // This used to compare the barrier's `opener` word against the rig's
    // ABILITY id, with two hand-written aliases to paper over the places they
    // did not match. Four rigs then opened nothing at all: the Crab, the Kiln,
    // the Diver and the Shrike each carry `ability: null` — they have no
    // button, only a capability — so CLIFF FACE, MOLTEN GROUND, FLOODED
    // GROUND and every HOVER alternative could be seen, could be read, and
    // could never be opened by anybody.
    //
    // `RIGS[id].opens` is a list of BARRIER TYPE IDS and has been correct
    // since the content pass. Reading it makes the rig's own entry the single
    // statement of what it gets you through, deletes the alias table, and is
    // why a rig with no button can still be a key.
    if (this._rigOpens(player, barrier.typeId || (t && t.id))) return true;
    if (t.opener && this._hasOpener(player, t.opener)) return true;
    if (t.also && this._hasOpener(player, t.also)) return true;
    if (t.alsoCore && this._hasOpener(player, t.alsoCore)) return true;
    return false;
  },

  _rigOpens(player, typeId) {
    if (!typeId || typeof Rigs === 'undefined' || typeof RIGS === 'undefined') {
      return false;
    }
    const id = (player && player.rigId !== undefined)
      ? player.rigId : Rigs.dockedId();
    const r = id ? RIGS[id] : null;
    return !!(r && (r.opens || []).indexOf(typeId) >= 0);
  },

  _hasOpener(player, opener) {
    if (!opener) return false;
    // A STORY GATE. `story:final` is the door into Central Dispatch, and
    // Story owns what it takes.
    if (opener === 'story:final') {
      return typeof Story !== 'undefined' && Story.finalOpen && Story.finalOpen();
    }
    if (opener.indexOf(':') >= 0) {
      // A GADGET RANK. Block 11 owns gadgets; until then the save is the
      // source of truth and this reads it, so gates laid out now work the day
      // gadgets land without any of this changing.
      const bits = opener.split(':');
      const have = (typeof Progress !== 'undefined' && Progress.gadgets &&
                    Progress.gadgets[bits[0]]) || 0;
      return have >= Number(bits[1]);
    }
    // A RIG ABILITY, kept for the three rigs whose capability IS their button.
    // `_rigOpens` above is the general answer; this is the older, narrower one
    // and it stays because a barrier type that names an ability rather than
    // being named by a rig is still a legitimate way to write a gate.
    if (typeof Rigs === 'undefined') return false;
    return Rigs.abilityOf(player) === opener;
  },

  // What to TELL the player when they cannot pass. Never "blocked" - always
  // the thing that would open it, because B.2 says they must be able to guess.
  refusal(player, barrier) {
    const t = barrier && barrier.type;
    if (!t) return null;
    if (this.canOpen(player, barrier)) return null;
    if (t.side === 'coreonly') {
      return t.name + ' — TOO SMALL FOR A RIG. LEAVE IT AND GO IN ON FOOT.';
    }
    return t.name + ' — NEEDS ' + t.by;
  },

  // Going through. Only a SHORTCUT is remembered; a one-off barrier opens for
  // as long as you are standing there and closes behind you.
  tryOpen(player, barrier) {
    if (!barrier || !this.canOpen(player, barrier)) return false;
    // "FIRST TIME OPENING A BARRIER TYPE — 600 XP." Per TYPE, not per barrier:
    // the payment is for working out what a cracked wall wants, and the second
    // cracked wall is not a discovery. Paid on every barrier, shortcut or not,
    // because a one-off door you smashed still taught you the same thing.
    if (barrier.typeId && typeof Progress !== 'undefined' &&
        typeof Levels !== 'undefined' && Levels.addXp) {
      Progress.barrierKinds = Progress.barrierKinds || {};
      if (!Progress.barrierKinds[barrier.typeId]) {
        Progress.barrierKinds[barrier.typeId] = true;
        Levels.addXp((typeof GARAGE !== 'undefined') ? GARAGE.XP_BARRIER_KIND : 600);
      }
    }
    if (barrier.shortcut && barrier.id) {
      const first = this.open(barrier.id);
      if (first && typeof Effects !== 'undefined') {
        Effects.comicWord('SHORTCUT OPEN!', barrier.x, barrier.y - 120,
          CONFIG.COLOR.lime, 74);
      }
      if (first) this.claim(barrier);
    }
    return true;
  },

  // ---- WHAT WAS BEHIND IT ------------------------------------------------
  // The reward is written in the district's OWN vocabulary — 'gadget:jammer',
  // 'permanent:cn_spray', 'rig:crab' — which is the same grammar a Find uses.
  // So it is granted by BUILDING A FIND and taking it, rather than by a second
  // switch that speaks the same language slightly differently. One vocabulary,
  // one granter; the day a new kind is added, both routes learn it at once.
  //
  // Three of the words are descriptions rather than grants: `shortcut` (the
  // barrier IS the shortcut), `exit` (it leads somewhere) and `wreck` (there
  // is one on the far side). Those are the author saying what is through the
  // door, and the door opening is the whole of it.
  DESCRIPTIVE: ['shortcut', 'exit', 'wreck', 'story', 'mission', 'map'],

  claim(barrier) {
    const spec = barrier && barrier.reward;
    if (!spec || typeof Finds === 'undefined') return null;
    const kind = String(spec).split(':')[0];
    if (this.DESCRIPTIVE.indexOf(kind) >= 0) return null;
    // A stable id so a shortcut you have already opened cannot be re-claimed
    // by walking back through it.
    const f = new Find(barrier.x, barrier.y, spec,
      'barrier:' + (barrier.id || spec));
    const got = Finds.take(f);
    if (got && typeof Effects !== 'undefined') {
      // WELL CLEAR OF 'SHORTCUT OPEN!'. Both fire on the same frame and the
      // first version drew them 70px apart at 74 and 62 point, so the two
      // things the player most needs to read at that moment were printed on
      // top of each other. Found in the screenshot, which is the only place it
      // could have been found.
      Effects.comicWord(f.name(), barrier.x, barrier.y - 320,
        CONFIG.COLOR.yellow, 58);
    }
    return got;
  },

  // Everything in reach, for the HUD prompt.
  nearest(player) {
    if (typeof World === 'undefined') return null;
    let best = null, bd = BARRIER.NEAR_R;
    for (const e of World.entities) {
      if (!(e instanceof Barrier) || e.opened) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  // ---- B.6: COUNT IT HONESTLY -------------------------------------------
  // The Build Bible parks a worry that too much gated content ends up
  // core-only, which would make rigs a traversal key rather than a thing you
  // love. This is the count, computed from the data rather than asserted, so
  // the report cannot quote a number that stopped being true.
  split() {
    let rig = 0, core = 0, coreOnly = 0;
    for (const id of BARRIER_LIST) {
      const t = BARRIER_TYPES[id];
      if (t.side === 'rig') rig++;
      else if (t.side === 'coreonly') coreOnly++;
      else core++;
    }
    return { rig, core, coreOnly, total: BARRIER_LIST.length };
  },
};

// ---------------------------------------------------------------------------
// THE DECOY
//
// "The gadget that makes ripping viable against a group. Findable EARLY."
//
// That sentence is the design. A rip takes real seconds and cannot be hurried —
// you stand still with the magnet on a joint while the machine is alive — so
// against three of them it is not a thing you can choose to do. The decoy is
// what makes it one: throw it, they shoot IT, and the seconds you needed exist.
//
// It draws by RANK, which is what makes the ranks worth having: basic patrol
// machines at rank 1, elites at rank 2 (and it detonates), and at rank 3 it
// shoots back — so a late decoy is a small ally and an early one is a rock the
// room throws itself at.
//
// A WORLD ENTITY, not a flag on the player, because that is what lets
// Population.brainTarget treat it as a place to go: the same route an escortee
// takes, and for the same reason — the machine has to be able to want something
// that is not you.
const DECOY_B = {
  THROW: 520,          // how far in front of you it lands
  R: 42,
  DRAW_R: 2600,        // how far it pulls a machine off you
};

class Decoy {
  constructor(x, y, rank) {
    this.x = x; this.y = y;
    this.radius = DECOY_B.R;
    // The band a machine sorts against, and the reason it needs w/h: the draw
    // band culls on a RECT, never a radius (D-block 1's lesson).
    this.w = DECOY_B.R * 2; this.h = DECOY_B.R * 2;
    this.alive = true;
    this.t = (rank && rank.secs) || 6;
    this.rank = rank || {};
    this.hp = 40;
    this.isDecoy = true;
    this.spin = 0;
    // THE REGISTRY KEY, set in the constructor rather than at the throw site.
    // `Hazards.orderIndex` sorts on `_type` and looks it up in HAZARD_TYPES,
    // so a decoy that called itself 'decoy' while the registry called it
    // 'decoys' was an entity the index could not classify — alive, in the
    // list, and never drawn. One letter.
    this._type = 'decoys';
  }

  // WHO IT PULLS. `drawsBasic` at rank 1, `drawsElites` from rank 2 — read off
  // the rank data rather than a number here, so retuning the gadget is one edit
  // in gadgetdata.js.
  draws(e) {
    if (!e || !e.alive) return false;
    if (e.bossId) return false;                    // a boss is not fooled
    if (e.isElite && !this.rank.drawsElites) return false;
    return !!(this.rank.drawsBasic || this.rank.drawsElites);
  }

  update(dt, player, enemies) {
    this.t -= dt;
    this.spin += dt * 3;
    // RANK 3: IT FIRES BACK. Twice a second, at the nearest machine it is
    // drawing, through the ordinary projectile pool as the player's round --
    // a decoy that shoots is the difference between a distraction and a
    // second gun on the field for fourteen seconds.
    if (this.rank.firesBack && this.alive && enemies && typeof Projectiles !== 'undefined' &&
        typeof PARTS !== 'undefined') {
      this._fireT = (this._fireT || 0) - dt;
      if (this._fireT <= 0) {
        let best = null, bd = 900;
        for (const e of enemies) {
          if (!this.draws(e)) continue;
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          this._fireT = 0.5;
          const a = Math.atan2(best.y - this.y, best.x - this.x);
          Projectiles.spawn(this.x + Math.cos(a) * (this.radius + 10),
            this.y + Math.sin(a) * (this.radius + 10), a, PARTS.machineGun, 'player', 0.6);
          if (typeof Effects !== 'undefined') Effects.muzzleFlash(this.x, this.y, a, false);
        }
      }
    }
    if (this.t <= 0 || this.hp <= 0) {
      this.alive = false;
      // RANK 2 DETONATES when it goes. The seconds it bought you end with a
      // bang rather than with it quietly not being there.
      if (this.rank.detonate && typeof Effects !== 'undefined') {
        Effects.explosion(this.x, this.y, 180);
      }
      if (typeof World !== 'undefined' && World.release) World.release(this);
    }
  }

  hit(dmg) { this.hp -= dmg; }

  draw(ctx) {
    if (typeof R === 'undefined') return;
    // CYAN. It is YOURS, and the faction rule is not negotiable for a thing
    // standing in the middle of a fight: green/cyan is the player, red is
    // hostile, and a decoy that read as hostile would be the worst possible
    // outcome for an object whose whole job is to be shot at.
    const a = 0.5 + Math.sin(this.spin * 3) * 0.3;
    ctx.globalAlpha = a * 0.5;
    R.circle(this.x, this.y, DECOY_B.R * 2.2, CONFIG.COLOR.cyan);
    ctx.globalAlpha = 1;
    R.circle(this.x, this.y, DECOY_B.R, CONFIG.COLOR.cyan, CONFIG.COLOR.ink, 5);
    R.circle(this.x, this.y, DECOY_B.R * 0.45, CONFIG.COLOR.white);
    R.smallText(Math.ceil(this.t) + 's', this.x, this.y - DECOY_B.R - 30, 20,
      CONFIG.COLOR.cyan, 'center');
  }
}

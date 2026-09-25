// SCRAPCORE: BREAKLANDS — TOWING (Block 6)
//
// Done when you choose between towing something big and travelling light.
//
// A dead machine leaves a HULK. Hook it, drag it home, strip it at a garage.
// The drive is the point: the tow line is physical, the weight is a real
// handling penalty, and fast travel is refused for as long as you are hooked
// up. Towing always pays the actual distance.
//
// ---------------------------------------------------------------------------
// 6.2 — THE RULE THAT MATTERS MOST, AND THIS FILE IS ITS EXAM
//
//   Entities owned by a chunk are destroyed when the chunk unloads. The
//   player, and anything attached to or carried by the player, is NEVER
//   chunk-owned.
//
// A towed hulk crossing a chunk boundary while its origin chunk unloads is the
// single most likely source of hard bugs in this project. The moment a hulk is
// hooked it is handed to `World.adopt()`, which pulls it out of its chunk's
// entity list and into `World.owned` — the list Block 1 added precisely so
// that `_reflow()` could not quietly forget it.
//
// `tests/test_block6.js` drives the real thing: hook a hulk at the far edge of
// a chunk, drive until that chunk unloads, keep driving for several more, then
// arrive and strip it. The hulk must be intact and IDENTICAL.
//
// ---------------------------------------------------------------------------
// 6.4 — TOWING IS THE GREEDY OPTION, NEVER THE REQUIRED ONE
//
// Enemies already scatter 60% of their surviving parts as loose salvage and
// explode the other 40%. Towing does not take the loose drop away; it collects
// the parts that would otherwise have been DESTROYED, plus the machine's scrap
// value. So field looting stays completely viable and towing is strictly
// better for anyone willing to pay the drive — which is exactly the shape 6.3
// and 6.4 ask for between them.

const TOW = {
  HOOK_R: 340,            // how close you have to get to hook on
  LINE_REST: 230,         // the line's happy length
  LINE_MAX: 430,          // past this it is taut and pulls hard
  STIFF: 14,              // spring constant along the line
  DAMP: 3.2,              // how quickly the hulk stops swinging
  SWING: 0.55,            // how much sideways momentum it keeps in a corner

  // Handling. A big chassis is a real commitment, not a small tax (6.1).
  DRAG_PER_WEIGHT: 0.020,
  MIN_SPEED_MUL: 0.34,
  TURN_PER_WEIGHT: 0.014,
  MIN_TURN_MUL: 0.40,

  // How far the ASSAY MODULE looks. Deliberately much further than HOOK_R
  // (which is arm's length): the module exists so you can decide WHICH wreck
  // to drive to, and a survey that only reaches the thing you are already
  // standing next to is not a survey.
  ASSAY_R: 2400,

  // What a hulk is worth. Towing pays MORE than field looting because it
  // recovers what the explosion would have taken.
  SCRAP_PER_LOAD: 9,
  SCRAP_PER_POWER: 7,
  CHASSIS_SCRAP: 260,

  // How heavy a hulk is, from what is actually on it, so a stripped wreck is
  // genuinely easier to drag than a loaded one.
  WEIGHT_PER_PART: 4,
  WEIGHT_BASE: 6,
  CHASSIS_WEIGHT: 34,
  // A MACHINE WRECK (Q4) is the middle layer -- bigger than a hulk, smaller
  // than a rig -- and it comes earlier than any rig, so it must be towable
  // by the machine a new save has.
  MACHINE_WEIGHT: 20,
};

// ---------------------------------------------------------------------------
// A hulk. Canvas primitives only (standing rule 5) — a bent chassis, a couple
// of ribs and whatever is still bolted to it.
class Hulk {
  constructor(x, y, opts) {
    const o = opts || {};
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = o.radius || (o.chassis ? 78 : 56);
    this.alive = true;
    this.hooked = false;
    this.parts = (o.parts || []).map(p => ({ partId: p.partId, gradeId: p.gradeId }));
    this.scrap = o.scrap || 0;
    // A derelict RIG CHASSIS is the thing Block 7 restores into a vehicle you
    // own. Block 6's job is only to recognise one and let you drag it home.
    this.chassis = o.chassis || null;
    // A MACHINE WRECK (Q4, 20 Sept 2026): one of the five machines a player
    // does not start as, dead in the world. Towed home and restored like a
    // chassis; never stripped.
    this.machine = o.machine || null;
    this.label = o.label || (this.chassis ? 'RIG CHASSIS'
      : (this.machine ? ((JACKRIGS[this.machine] || {}).name || 'MACHINE') + ' WRECK' : 'HULK'));
    this.tint = o.tint || ((this.chassis || this.machine) ? '#ffd23f' : '#8fa3c8');
    this.weight = o.weight !== undefined ? o.weight
      : TOW.WEIGHT_BASE + this.parts.length * TOW.WEIGHT_PER_PART +
        (this.chassis ? TOW.CHASSIS_WEIGHT : 0) +
        (this.machine ? TOW.MACHINE_WEIGHT : 0);
    this.angle = o.angle !== undefined ? o.angle : Math.random() * Math.PI * 2;
    this._seed = (Math.random() * 1000) | 0;
  }

  // Hulks do not think. They are dragged, and Tow.update does the dragging —
  // so the registry gives them 'none' and they cost nothing when nobody is
  // hooked to them.
  update() {}

  draw(ctx) {
    // A CHASSIS WITH ART IS DRAWN AS THE VEHICLE IT WILL BE (D340), dead on
    // the ground: the rig's own set at the rig's own size, no paint, and
    // the RIG CHASSIS label still over it. A rig with no set yet draws the
    // bent-plate hulk below, as every hulk did before.
    // AND A MACHINE WRECK IS DRAWN AS THE MACHINE IT WILL BE: its own bare
    // set (machine_viper_bare), dead on the ground, its name over it.
    const artKey = this.chassis
      || (this.machine && typeof Frames !== 'undefined' ? Frames.artSet(this.machine, 'bare') : null);
    if (artKey && typeof Sprites44 !== 'undefined' && Sprites44.has(artKey)
        && typeof Assets !== 'undefined') {
      const vw = Sprites44.worldSize(artKey);
      R.circle(this.x + 8, this.y + 10, this.radius, 'rgba(0,0,0,0.34)');
      if (Assets.sprite(ctx, artKey, this.x, this.y, vw, vw, this.angle)) {
        // Over the ART, not the hitbox: the hulk's radius is 78 and the
        // vehicle stands taller than that.
        R.smallText(this.chassis ? 'RIG CHASSIS' : this.label, this.x, this.y - vw * 0.5 - 22, 22,
          CONFIG.COLOR.yellow, 'center');
        return;
      }
    }
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const r = this.radius;

    // Shadow first, so it reads as sitting ON the ground rather than floating.
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(6, 10, r * 1.02, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    // The bent chassis.
    ctx.fillStyle = this.chassis ? '#3a3320' : '#242b40';
    ctx.strokeStyle = '#0b0e1a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.52);
    ctx.lineTo(r * 0.72, -r * 0.66);
    ctx.lineTo(r, r * 0.14);
    ctx.lineTo(r * 0.30, r * 0.66);
    ctx.lineTo(-r * 0.80, r * 0.50);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Ribs, so it reads as a machine rather than a rock.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 4;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.36, -r * 0.55);
      ctx.lineTo(i * r * 0.36, r * 0.55);
      ctx.stroke();
    }

    // What is still bolted to it, as stubs around the edge — the reason to
    // want it. A hulk with four stubs is visibly worth more than a bare one.
    const n = Math.min(this.parts.length, 6);
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const px = Math.cos(a) * r * 0.78, py = Math.sin(a) * r * 0.62;
      const col = (PARTS[this.parts[i].partId] || {}).color || '#8fa3c8';
      ctx.fillStyle = col;
      ctx.strokeStyle = '#0b0e1a'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // A chassis says so. It is the thing worth a five minute drive.
    ctx.restore();
    if (this.chassis || this.machine) {
      R.smallText(this.chassis ? 'RIG CHASSIS' : this.label, this.x, this.y - this.radius - 22, 22,
        CONFIG.COLOR.yellow, 'center');
    }
  }
}

// A MACHINE WRECK, placed by district data (Q4, BREAKLANDS_ANSWERS 20 Sept
// 2026): "Each machine is found in the world as a wreck. Drive to it, tow it
// home, restore it." The find-and-recover ladder -- the game's own verb,
// with no fight gating it -- and it comes EARLIER than the rigs: the first
// one is in the Yard. A district places one with
// `machines: { '15,4': [[1536, 1536, 'viper']] }`.
//
// MOST OF THEM ARE GUARDED. ONE IS NOT (BREAKLANDS_ANSWERS round 2, 22 Sept
// 2026). Aaron: "most should be. the odd 1 could be lying with nothing
// around it." A machine wreck is a real prize, so taking one costs
// something: the row's fourth column names a PLACED machine (the district's
// `placed` layer, a permanent id) and the wreck refuses the hook until that
// machine is dead -- World.wasKilled, the same record a held garage reads.
// The VIPER in the Yard is deliberately bare: it is the first machine a
// player meets, the opening does not gate on a fight, and it is the find
// that pays off exploring rather than fighting. Not a mistake, and not to
// be "fixed" by a later pass that notices the odd one out.
class MachineHulk extends Hulk {
  constructor(x, y, machineId, guard) {
    super(x, y, { machine: machineId, parts: [], scrap: 0, radius: 70 });
    this.guard = guard || null;
  }
}

// A DERELICT RIG CHASSIS, placed by district data. The thing Block 7 restores
// into a vehicle you own, and the reason the tow loop exists at all: dragging
// one home is meant to be a genuine expedition with a real chance of losing
// it. WORLD_SCALE puts them deliberately far from any garage.
//
// A thin subclass rather than a flag on a row, so the registry can name it
// and a district places one with `chassis: { '50,7': [['cheetah']] }`.
class ChassisHulk extends Hulk {
  constructor(x, y, rigId) {
    super(x, y, { chassis: rigId, parts: [], scrap: TOW.CHASSIS_SCRAP });
  }
}

// ---------------------------------------------------------------------------
// A NAMED WRECK. The same object as any hulk, plus an id the world remembers.
//
// Block 13 wrote three RECOVERY missions that say "tow it back whole" and
// there was nothing in the world with a name for them to be about, so those
// missions were never offered. A wreck with an id is what a `wreck` target is:
// a specific dead machine, in a specific place, that you drag home.
//
// It is worth MORE than a generated hulk on purpose. A named wreck is a
// mission's worth of driving with the handling penalty on, and the payout has
// to be visible at the moment you decide to hook it — which, since the assay
// module landed, it is.
class WreckHulk extends Hulk {
  constructor(x, y, id, label, parts, scrap) {
    super(x, y, {
      parts: parts || [],
      scrap: scrap || 180,
      label: label || 'WRECK',
      tint: '#ffd23f',
    });
    this.wreckId = id;
  }
}

// ---------------------------------------------------------------------------
const Tow = {
  hooked: null,           // the Hulk currently on the line
  line: 0,                // current line length, for the draw
  _msg: '', _msgT: 0,

  reset() { this.hooked = null; this.line = 0; },

  // How many hulks may be on the line at once. One, unless you are in the
  // Hauler (Block 7) or have the skill (Block 10) — both of which set this
  // flag rather than reaching in here.
  capacity(player) {
    if (player && player.towCapacity) return player.towCapacity;
    return 1;
  },

  towing() { return !!this.hooked; },

  // ---- what a dead machine leaves ---------------------------------------
  // Called from Enemy._die with the parts the explosion WOULD have taken.
  // Nothing is created for a machine that was already stripped bare: a hulk
  // with nothing on it is a chore, not a reward.
  fromMachine(ent, keptParts) {
    if (!keptParts || !keptParts.length) return null;
    let scrap = 0;
    for (const p of keptParts) {
      const part = PARTS[p.partId];
      if (!part) continue;
      scrap += (part.loadCost || 0) * TOW.SCRAP_PER_LOAD +
               (part.powerCost || 0) * TOW.SCRAP_PER_POWER;
    }
    const h = new Hulk(ent.x, ent.y, { parts: keptParts, scrap });
    return this.place(h);
  },

  // Put a hulk into the world. It belongs to the CHUNK it lands in until
  // somebody hooks it — so an untouched hulk in a district you left is gone,
  // exactly like every other bit of world furniture.
  place(h) {
    if (typeof World === 'undefined') return h;
    h._type = 'hulks';
    const cc = World.chunkAt(h.x, h.y);
    const c = World.loaded[World.key(cc.cx, cc.cy)];
    if (c) {
      h._chunk = c.key;
      c.entities.push(h);
      World._reflow();
    } else {
      // Nothing loaded there to own it, so the world keeps it. Better than
      // dropping it on the floor of a chunk that does not exist.
      World.own(h);
    }
    return h;
  },

  // ---- hooking -----------------------------------------------------------
  nearest(player) {
    if (typeof World === 'undefined') return null;
    // TOW WINCH rank 2: `hookRangeMul` -- the line reaches twice as far.
    const winch = (typeof GadgetRun !== 'undefined' && GadgetRun.winch) ? GadgetRun.winch() : {};
    let best = null, bd = TOW.HOOK_R * (winch.hookRangeMul || 1);
    for (const e of World.entities) {
      if (!(e instanceof Hulk) || !e.alive || e.hooked) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  // ---- the guard on a machine wreck ---------------------------------------
  // The placed machine still standing over this wreck, or null when there is
  // none or it is dead. One predicate, asked by the hook, the HUD prompt and
  // the suites, so "it said GUARDED but let me hook it" cannot happen.
  guardOf(h) {
    if (!h || !h.guard) return null;
    if (typeof World !== 'undefined' && World.wasKilled && World.wasKilled(h.guard)) return null;
    return h.guard;
  },
  // Its NAME, off the district's own placed row, the way a held garage names
  // its guard (D351): what the player has been shooting at, not an id.
  guardName(h) {
    const g = this.guardOf(h);
    if (!g) return null;
    const d = (typeof World !== 'undefined') ? World.district : null;
    return (typeof DistrictGen !== 'undefined' && DistrictGen.placedBuildName)
      ? DistrictGen.placedBuildName(d, g) : String(g).toUpperCase();
  },

  hook(player) {
    if (this.hooked) return this.unhook();
    const h = this.nearest(player);
    if (!h) { this._say('NOTHING IN REACH'); return null; }
    if (this.capacity(player) < 1) { this._say('THIS RIG CANNOT TOW'); return null; }
    // A GUARDED MACHINE WRECK refuses the hook while its guard stands. The
    // refusal is the prompt: it names what to kill.
    if (this.guardOf(h)) { this._say('GUARDED — KILL THE ' + this.guardName(h)); return null; }

    // 6.2. THE LINE OF CODE THE WHOLE BLOCK IS ABOUT.
    //
    // The moment it is on the line it stops belonging to the chunk it was
    // found in. Everything else here is physics; this is the guarantee.
    World.adopt(h);
    h.hooked = true;
    this.hooked = h;
    this.line = Math.hypot(h.x - player.x, h.y - player.y);
    // TOW WINCH rank 2: `instantHook` -- the winch takes up the slack the
    // moment the line is on, so a hulk hooked at the far end of a doubled
    // reach starts at the line's rest length rather than being dragged
    // across the gap over the next second.
    const winch = (typeof GadgetRun !== 'undefined' && GadgetRun.winch) ? GadgetRun.winch() : {};
    if (winch.instantHook && this.line > TOW.LINE_REST) {
      const k = (this.line - TOW.LINE_REST) / this.line;
      h.x += (player.x - h.x) * k;
      h.y += (player.y - h.y) * k;
      this.line = TOW.LINE_REST;
    }
    if (typeof Garages !== 'undefined') Garages.towing = true;
    this._say('HOOKED — ' + h.label);
    if (typeof Audio_ !== 'undefined') Audio_.play('connectorBreak');
    return h;
  },

  unhook() {
    const h = this.hooked;
    if (!h) return null;
    h.hooked = false;
    this.hooked = null;
    if (typeof Garages !== 'undefined') Garages.towing = false;
    // It stays WORLD-OWNED after being dropped. Handing it back to whatever
    // chunk it happens to be standing in would mean unhooking next to a
    // boundary could delete a hulk you had dragged for three minutes.
    this._say('DROPPED — ' + h.label);
    return h;
  },

  // ---- the drive ---------------------------------------------------------
  // The line is physical: it swings, it catches, and it pulls you off line in
  // corners (6.1). Modelled as a spring that only PULLS — a tow line cannot
  // push, and pretending it can is what makes a towed thing feel like a
  // balloon instead of a weight.
  update(dt, player) {
    this._msgT = Math.max(0, this._msgT - dt);
    const h = this.hooked;
    if (!h || !player) return;

    let dx = player.x - h.x, dy = player.y - h.y;
    let d = Math.hypot(dx, dy) || 0.0001;
    this.line = d;
    const ux = dx / d, uy = dy / d;

    // Spring, one-directional.
    const stretch = d - TOW.LINE_REST;
    if (stretch > 0) {
      const pull = Math.min(stretch, TOW.LINE_MAX) * TOW.STIFF;
      h.vx += ux * pull * dt;
      h.vy += uy * pull * dt;

      // And the equal and opposite half, which is what makes towing FELT
      // rather than read off a stat line: a taut line drags the player back.
      // TOW WINCH rank 3: `towNoSnag` -- the winch pays the line out and
      // takes it in, so a taut line never yanks the machine. The hulk still
      // has its weight in the speed penalty; what goes is the snag.
      const winch = (typeof GadgetRun !== 'undefined' && GadgetRun.winch) ? GadgetRun.winch() : {};
      const backMul = winch.towNoSnag ? 0 : Math.max(0, (d - TOW.LINE_REST) / TOW.LINE_MAX);
      const back = backMul * h.weight * 2.6;
      player.vx -= ux * back * dt;
      player.vy -= uy * back * dt;
    }

    // Damping, and a little swing kept so corners feel like corners.
    h.vx -= h.vx * TOW.DAMP * dt * (1 - TOW.SWING);
    h.vy -= h.vy * TOW.DAMP * dt * (1 - TOW.SWING);
    h.x += h.vx * dt;
    h.y += h.vy * dt;

    // Hard limit: the line does not stretch past LINE_MAX, ever. Without this
    // a fast enough player outruns the spring and the hulk trails a hundred
    // metres behind, which reads as a bug rather than as weight.
    dx = player.x - h.x; dy = player.y - h.y;
    d = Math.hypot(dx, dy) || 0.0001;
    if (d > TOW.LINE_MAX) {
      const k = (d - TOW.LINE_MAX) / d;
      h.x += dx * k;
      h.y += dy * k;
    }
    h.angle = Math.atan2(player.y - h.y, player.x - h.x) + Math.PI / 2;

    // 6.2 again, defensively. If anything ever hands a towed hulk back to a
    // chunk, take it straight back. Cheap, and the alternative is losing a
    // haul to a bug that only shows up at a boundary.
    if (h._chunk !== null && typeof World !== 'undefined') World.adopt(h);
  },

  // What towing costs you. Applied by the player's own speed calculation, so
  // there is one place that knows and the HUD cannot disagree with the feel.
  //
  // TOLERANT MOUNTS halve the PENALTY, not the multiplier. Those are very
  // different sums and only one of them is the part described: at ×0.5,
  // "halve the multiplier" on a 60% speed tow gives 30% — the module would
  // make towing WORSE. Halving the penalty turns a 40-point loss into 20,
  // which is what "halves the handling penalty from towing" means.
  //
  // Applied to the floor as well, or a heavy enough hulk pins you at
  // MIN_SPEED_MUL and the module you spent a socket on does nothing at
  // exactly the weight you bought it for.
  _eased(raw, floor, ent) {
    // HEAVY LIFT stacks with TOLERANT MOUNTS, and the draft says so out loud:
    // "stacks with the Salvage skill HEAVY LIFT". Two things that halve a
    // penalty give you a quarter of it, which is what spending on both is for.
    // ...and the TOW WINCH, which is the third. A gadget, a module and a skill
    // all answering the same question is the shape this game is built on: you
    // can get at a problem three ways and doing all three is a real build.
    const winch = (typeof GadgetRun !== 'undefined' && typeof Gadgets !== 'undefined'
      && Gadgets.isFitted('towWinch'))
      ? ((GadgetRun.rankOf('towWinch') || {}).towSpeedPenaltyMul || 1) : 1;
    const k = Modules.mul(ent, 'towPenaltyMul') *
      (typeof Skills !== 'undefined' ? Skills.mul('towPenaltyMul') : 1) * winch;
    if (k >= 1) return Math.max(floor, raw);
    return Math.max(1 - (1 - floor) * k, 1 - (1 - raw) * k);
  },
  speedMul(player) {
    if (!this.hooked) return 1;
    return this._eased(1 - this.hooked.weight * TOW.DRAG_PER_WEIGHT,
                       TOW.MIN_SPEED_MUL, player);
  },
  turnMul(player) {
    if (!this.hooked) return 1;
    return this._eased(1 - this.hooked.weight * TOW.TURN_PER_WEIGHT,
                       TOW.MIN_TURN_MUL, player);
  },

  // ---- THE ASSAY MODULE ---------------------------------------------------
  // "Shows the strip value of a wreck before you hook it, and marks the best
  // wreck in range on the HUD. Turns towing from a guess into a decision."
  //
  // The guess it replaces is real: a hulk's label says HULK and its parts
  // count is visible at arm's length, but the SCRAP is invisible until you
  // have dragged it to a garage — so towing was a coin flip you paid for with
  // three minutes of reduced speed.

  // What stripping this actually hands you. Asked of the hulk, which is the
  // record that owns it, so the readout and `strip()` cannot disagree.
  value(h) {
    if (!h) return null;
    return { parts: h.parts.length, scrap: h.scrap || 0,
             chassis: h.chassis || null, machine: h.machine || null };
  },

  // A single number for RANKING only, never shown. A chassis is a vehicle
  // rather than a pile, so it is ordered ahead of every hulk by a separate
  // key instead of by an invented multiplier that would eventually be beaten
  // by a big enough scrap pile.
  _rank(h) {
    const v = this.value(h);
    return [(v.chassis || v.machine) ? 1 : 0, v.scrap + v.parts * TOW.SCRAP_PER_LOAD];
  },

  // Is the module fitted? Nothing else in this file asks — every readout goes
  // through here, so turning the module off turns all of it off at once.
  assaying(player) { return Modules.has(player, 'showsWreckValue'); },

  // The best hulk within survey range, or null. Null when the module is not
  // fitted, which is the whole point: without it you get an unmarked field of
  // identical-looking wrecks.
  best(player) {
    if (!player || !this.assaying(player) || typeof World === 'undefined') {
      return null;
    }
    let top = null, tk = null;
    for (const e of World.entities) {
      if (!(e instanceof Hulk) || !e.alive || e.hooked) continue;
      if (Math.hypot(e.x - player.x, e.y - player.y) > TOW.ASSAY_R) continue;
      const k = this._rank(e);
      if (!tk || k[0] > tk[0] || (k[0] === tk[0] && k[1] > tk[1])) {
        top = e; tk = k;
      }
    }
    return top;
  },

  // How a value reads. One place, because the hook prompt, the tow readout
  // and the world marker must all say the same thing about the same wreck.
  valueText(h) {
    const v = this.value(h);
    if (!v) return '';
    return v.parts + ' PARTS, ' + v.scrap + ' SCRAP' +
           (v.chassis ? ' — CHASSIS' : (v.machine ? ' — A MACHINE' : ''));
  },

  // The marker, in WORLD space, over the best wreck in range. Drawn with the
  // tow line for the same reason: it belongs to the ground, not to the HUD,
  // so it points at a place you can drive to rather than at an edge of the
  // screen.
  drawAssay(ctx, player) {
    const h = this.best(player);
    if (!h || h === this.hooked) return;
    const c = (h.chassis || h.machine) ? CONFIG.COLOR.yellow : '#a8e832';
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = c;
    ctx.lineWidth = 4;
    const y = h.y - h.radius - 40;
    // A caret, pointing down at it. Small, because the information is the
    // text and the shape is only there to say WHICH wreck the text is about.
    ctx.beginPath();
    ctx.moveTo(h.x - 22, y - 22);
    ctx.lineTo(h.x, y);
    ctx.lineTo(h.x + 22, y - 22);
    ctx.stroke();
    ctx.restore();
    if (typeof R !== 'undefined') {
      R.smallText(this.valueText(h), h.x, y - 66, 22, c, 'center');
    }
  },

  // ---- at the garage (6.3) ----------------------------------------------
  // STRIP IT: parts and scrap. This is the payoff for the drive.
  strip(h) {
    if (!h) return null;
    const got = { parts: 0, scrap: h.scrap || 0, chassis: h.chassis || null };
    for (const p of h.parts) {
      // STRAIGHT INTO THE RACK, not into the carry.
      //
      // This offered each part into `Rack.pending` and counted it as taken
      // whether the offer succeeded or not — and `offer` refuses once the
      // carry is full. So the one trip the whole block exists for, made the
      // way a player actually makes it (loot until you are full, THEN find
      // the wreck worth towing), silently threw the wreck away and printed
      // "STRIPPED - 3 PARTS" while it did.
      //
      // A towed wreck is not carried salvage. You dragged it to a garage;
      // arriving IS the banking, and the carry limit is a rule about what
      // fits on your machine, not about what fits on a tow line.
      if (typeof Rack !== 'undefined') {
        if (!Rack.add(p.partId, p.gradeId || 'G2') && typeof Salvage !== 'undefined') {
          // The Rack already holds two better copies: §15's rule is that it
          // becomes scrap rather than cluttering, which is the same thing
          // banking does with one.
          got.scrap += Salvage.valueOf(p.partId, p.gradeId || 'G2');
        }
      }
      got.parts++;
    }
    // STRIPPER: "stripping a towed wreck yields more". At the strip, which
    // is the only place a tow pays out.
    if (typeof Skills !== 'undefined') {
      got.scrap = Math.round(got.scrap * Skills.mul('stripYieldMul'));
    }
    if (typeof Forge !== 'undefined' && got.scrap) Forge.bank(got.scrap);
    // A NAMED WRECK IS REMEMBERED. Written HERE, at the moment the strip
    // actually happens, rather than by the mission watching for you to arrive
    // somewhere: the guarantee a RECOVERY mission makes is "you got it home
    // and took it apart", and this is the line where that becomes true.
    if (h.wreckId && typeof Progress !== 'undefined') {
      Progress.towed = Progress.towed || {};
      Progress.towed[h.wreckId] = true;
    }
    h.alive = false;
    if (typeof World !== 'undefined') World.release(h);
    if (this.hooked === h) {
      this.hooked = null;
      if (typeof Garages !== 'undefined') Garages.towing = false;
    }
    return got;
  },

  // Block 7 does the restoring. Block 6's job is to RECOGNISE a chassis and
  // offer the option rather than silently stripping something that was worth
  // a vehicle.
  isChassis(h) { return !!(h && h.chassis); },
  // Q4: and a MACHINE wreck, which is restored the same way and never
  // stripped -- melting one down would destroy the second-best thing in
  // the game to find.
  isMachineWreck(h) { return !!(h && h.machine); },

  _say(m) { this._msg = m; this._msgT = 2.6; },

  // ---- draw --------------------------------------------------------------
  drawLine(ctx, player) {
    const h = this.hooked;
    if (!h || !player) return;
    const taut = this.line > TOW.LINE_MAX * 0.92;
    ctx.save();
    ctx.strokeStyle = taut ? CONFIG.COLOR.orange : '#6b7a9c';
    ctx.lineWidth = taut ? 9 : 7;
    ctx.lineCap = 'round';
    // A slack line sags. One quadratic, and it is the difference between a
    // rope and a laser beam.
    const sag = Math.max(0, (TOW.LINE_MAX - this.line) / TOW.LINE_MAX) * 46;
    const mx = (player.x + h.x) / 2, my = (player.y + h.y) / 2 + sag;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.quadraticCurveTo(mx, my, player.x, player.y);
    ctx.stroke();
    ctx.restore();
  },
};

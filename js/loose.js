// SCRAPCORE: BREAKLANDS — Loose parts (Milestone 7)
// A connector break turns a component into a physical salvage object lying
// in the arena. Capped at 12 (plan §23) — oldest converts to debris.
// The Magnet (Milestone 8) will pull these onto the player.

const LooseParts = {
  MAX: 12,

  // ---- WHAT A DEAD MACHINE LEAVES ON THE FLOOR (D369) --------------------
  //
  // When an ordinary patrol machine dies, each part still bolted to it either
  // FALLS as salvage you can drive over and pick up, or STAYS on the hulk for
  // you to hitch and tow home. That split is the whole loose-versus-tow
  // decision — the thing that decides whether a kill is worth a trip — and
  // for the life of the project it was a bare `Math.random() < 0.6` sitting
  // in the middle of `Enemy._die` with no name, no home beside the numbers it
  // belongs with, and no test. It is a real economy lever and it is now
  // findable by anyone looking for one.
  //
  // NAMED HERE, VALUE UNCHANGED at the 0.6 the literal held. D369 is a naming
  // pass; tuning it is a later pass and needs its own measurement, because
  // the split feeds the carry and the tow at the same time and pulling it
  // one way fills one while it empties the other.
  //
  // WHAT IT DELIBERATELY DOES NOT COVER. The bosses (CRUSHER, FOREMAN,
  // FURNACE), the Wardens and the player's own death drop EVERYTHING loose
  // with no roll at all — crusher.js says why in its own words: "the player
  // can walk away wearing the boss's own weapons." Those are five copies of
  // an UNCONDITIONAL drop loop, not five copies of this roll. Pointing them
  // at this number would hand a later tuning pass the power to quietly change
  // every boss death in the game, so they are left alone on purpose.
  // tests/test_block3.js holds both halves of that.
  ON_KILL: 0.6,

  // Salvage on the floor uses the illustrated 3/4 art (see draw below). This
  // is the one place illustrated art appears in the WORLD rather than a menu,
  // so it is a single switch: flip to false and every loose part reverts to
  // its code-drawn shape with no other change.
  USE_ART: true,
  ART_SIZE: 96,
  items: [],

  init() { this.items = []; },

  // M2: salvage carries a GRADE (Master §15). Field hardware defaults to G1;
  // anything better is authored, so a good drop is a real event.
  spawn(partId, hpFrac, x, y, vx, vy, gradeId) {
    // THE ONE GATE. A part marked noSalvage (the core's own blaster, on a
    // PICKER) is never a thing on the floor, whichever of the twelve places
    // that shear, rip, crush or scatter a part asked. Null, so a magnet that
    // ripped it holds nothing.
    if (PARTS[partId] && PARTS[partId].noSalvage) return null;
    if (this.items.length >= this.MAX) {
      const old = this.items.shift();               // oldest becomes debris
      Effects.explosion(old.x, old.y, 60);
    }
    const item = {
      part: PARTS[partId],
      gradeId: (typeof GRADES !== 'undefined' && GRADES[gradeId]) ? gradeId : 'G1',
      hpFrac: Math.min(Math.max(hpFrac, 0.12), 1),  // retains damage state
      x, y, vx, vy,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 7,
      age: 0,
      bob: Math.random() * Math.PI * 2,
    };
    this.items.push(item);
    return item;
  },

  update(dt, arena, obstacles) {
    const f = Math.exp(-3.5 * dt);   // quick settle (plan M8 spec)
    for (const it of this.items) {
      it.age += dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.vx *= f; it.vy *= f;
      it.rot += it.rotV * dt;
      it.rotV *= f;

      const r = 40;
      if (it.x < arena.x + r) { it.x = arena.x + r; it.vx = Math.abs(it.vx) * 0.4; }
      if (it.x > arena.x + arena.w - r) { it.x = arena.x + arena.w - r; it.vx = -Math.abs(it.vx) * 0.4; }
      if (it.y < arena.y + r) { it.y = arena.y + r; it.vy = Math.abs(it.vy) * 0.4; }
      if (it.y > arena.y + arena.h - r) { it.y = arena.y + arena.h - r; it.vy = -Math.abs(it.vy) * 0.4; }

      for (const o of obstacles) {
        if (o.type === 'pillar') {
          const dx = it.x - o.x, dy = it.y - o.y;
          const d = Math.hypot(dx, dy), min = r + o.r;
          if (d < min && d > 0.001) {
            it.x += dx / d * (min - d);
            it.y += dy / d * (min - d);
          }
        } else {
          const cx = Math.min(Math.max(it.x, o.x), o.x + o.w);
          const cy = Math.min(Math.max(it.y, o.y), o.y + o.h);
          const dx = it.x - cx, dy = it.y - cy;
          const d = Math.hypot(dx, dy);
          if (d < r && d > 0.001) {
            it.x += dx / d * (r - d);
            it.y += dy / d * (r - d);
          }
        }
      }
    }
  },

  nearest(x, y, range) {
    let best = null, bestD = range;
    for (const it of this.items) {
      const d = Math.hypot(it.x - x, it.y - y);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  },

  remove(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  },

  draw(ctx) {
    for (const it of this.items) {
      const bobY = Math.sin(it.bob + it.age * 3) * 3;

      // GLOW. The floors are busy (scrap, grates, glowing conduits) and a part
      // lying among them was easy to walk straight past. A soft filled halo
      // reads at a glance where a thin ring did not — and it is tinted by the
      // part's own colour, so a weapon is distinguishable from armour before
      // you are close enough to see the shape.
      const pulse = 0.35 + Math.sin(it.age * 4) * 0.15;
      const tint = (it.part && it.part.color) || CONFIG.COLOR.cyan;
      ctx.globalAlpha = 0.16 + pulse * 0.16;
      R.circle(it.x, it.y + bobY, 78, tint);
      ctx.globalAlpha = 0.22 + pulse * 0.2;
      R.circle(it.x, it.y + bobY, 56, tint);

      // Salvage highlight ring — neutral (no hostile glow once detached)
      ctx.globalAlpha = pulse;
      ctx.setLineDash([12, 10]);
      R.circle(it.x, it.y + bobY, 52, null, CONFIG.COLOR.cyan, 4);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      drawLoosePartSprite(ctx, it.part, it.x, it.y + bobY, it.rot);
    }
    this._glint(ctx);
  },

  // ---- SCRAP EYE ----------------------------------------------------------
  // "Loose parts and scrap glint THROUGH PROPS at range. R1: 15m, through low
  // cover. R2: 30m, through anything, and rare parts glint brighter."
  //
  // Drawn AFTER the parts and after everything the world drew, which is the
  // whole point: the glint is the one mark in the game allowed to sit on top
  // of the scenery, because a mark that a pillar can hide is not a mark that
  // tells you a pillar is hiding something.
  //
  // A pip, not a highlight on the part itself — the connector highlight owns
  // "the thing you are meant to grab" and two competing rings in the same
  // colour would be worse than neither (see js/paint.js on shape cues).
  GLINT_M: 44,               // world units in a metre, for the doc's "15m/30m"

  // The same column test the occlusion fade uses (Game._updateOcclusion), for
  // the same reason: two different answers to "is this behind that building"
  // would eventually disagree on screen, and the player would be the one to
  // find out.
  _behindBuilding(it) {
    const G = (typeof Game !== 'undefined' && Game.states && Game.states.GAME)
      ? Game.states.GAME : null;
    if (!G || !G.obstacles || typeof Props === 'undefined') return false;
    for (const o of G.obstacles) {
      if (o.type !== 'prop' || !(o.height >= 1)) continue;
      if (o.cy <= it.y) continue;                    // not in front of it
      const w = Props.footprint(o.kind);
      if (Math.abs(it.x - o.cx) > w * 0.5) continue;
      if (it.y > o.cy + w * 0.3 - Props.rise(o.height)) return true;
    }
    return false;
  },

  // Everything that is not a building: pillars, barricades, crates, rubble.
  // A part lying against one of these is what "low cover" means, and seeing
  // through it is what rank 1 buys.
  _behindLowCover(it) {
    const G = (typeof Game !== 'undefined' && Game.states && Game.states.GAME)
      ? Game.states.GAME : null;
    if (!G || !G.obstacles) return false;
    for (const o of G.obstacles) {
      if (o.type === 'prop') continue;
      const r = o.r || 0;
      if (r > 0) {
        if (Math.hypot(it.x - o.x, it.y - o.y) < r + 30) return true;
      } else if (o.w) {
        if (it.x > o.x - 30 && it.x < o.x + o.w + 30 &&
            it.y > o.y - 30 && it.y < o.y + o.h + 30) return true;
      }
    }
    return false;
  },

  _glint(ctx) {
    if (typeof Skills === 'undefined') return;
    // TWO SOURCES, ONE PIP. SCRAP EYE is a skill and the SCANNER is a gadget,
    // and they answer the same question — how far can you see salvage. The
    // LARGER wins rather than the two stacking: a player who has both should
    // get the better of them, not a range nobody tuned.
    const skillR = Skills.sum('lootGlintRange') * this.GLINT_M;
    const p0 = (typeof Game !== 'undefined' && Game.states && Game.states.GAME)
      ? Game.states.GAME.player : null;
    const scanR = (p0 && p0._scanT > 0) ? (p0._scanR || 0) : 0;
    const r = Math.max(skillR, scanR);
    if (!r) return;
    const p = p0;
    if (!p) return;
    const bright = Skills.has('rareGlint');
    // R1 is "through LOW cover", R2 "through anything". The difference is a
    // BUILDING: a crate or a barricade never hid the pip in the first place
    // (it is drawn last, above the world), so the only thing rank 2 can buy
    // is seeing through the one kind of cover that is genuinely opaque.
    const anything = Skills.has('throughAnything');
    const lowOk = anything || Skills.has('throughLowCover');
    for (const it of this.items) {
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d > r) continue;
      if (!anything && this._behindBuilding(it)) continue;
      if (!lowOk && this._behindLowCover(it)) continue;
      // Rare parts glint brighter, and "rare" is the GRADE — the one axis the
      // game already ranks salvage on, so nothing new has to be decided.
      const g = (typeof GRADES !== 'undefined' && GRADES[it.gradeId]) || null;
      const rare = bright && g && (g.n || 1) >= 3;
      const a = 0.5 + Math.sin(it.age * 6) * 0.2;
      ctx.globalAlpha = rare ? Math.min(1, a * 1.6) : a;
      const col = rare ? CONFIG.COLOR.yellow : CONFIG.COLOR.cyan;
      R.circle(it.x, it.y - 78, rare ? 9 : 6, col);
      ctx.globalAlpha = 1;
    }
  },
};

// Simplified free-floating sprite for a detached part.
function drawLoosePartSprite(ctx, part, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  R.circle(4, 6, 34, 'rgba(0,0,0,0.35)');

  // Illustrated art if we have it: a part on the floor is a thing you are
  // about to pick up, and the 3/4 illustration makes it identifiable at a
  // glance in a way the code-drawn blob never did. Set USE_ART false to fall
  // straight back to the shapes below if it reads wrong against the machines.
  if (LooseParts.USE_ART && typeof Assets !== 'undefined') {
    const key = 'art_' + part.id;
    if (Assets.has(key)) {
      const img = Assets.get(key);
      // Fit the longest side, so a wide railgun and a square plate both land
      // inside the salvage ring instead of one of them swamping it.
      const long = Math.max(img.width, img.height) || 1;
      const s = LooseParts.ART_SIZE / long;
      if (Assets.sprite(ctx, key, 0, 0, img.width * s, img.height * s, 0)) {
        ctx.restore();
        return;
      }
    }
  }

  if (part.category === 'utility') {
    // Chip module
    R.roundRect(-26, -26, 52, 52, 8, '#20263e', CONFIG.COLOR.ink, 6);
    if (part.id === 'splitter') {
      R.circle(0, 0, 12, part.color, CONFIG.COLOR.ink, 4);
      ctx.strokeStyle = part.color; ctx.lineWidth = 6;
      for (const off of [-0.5, 0.5]) {
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(off) * 24, Math.sin(off) * 24); ctx.stroke();
      }
    } else {
      R.circle(0, 0, 11, null, part.color, 5);
      R.circle(0, 0, 4, part.color);
    }
    ctx.restore();
    return;
  }
  if (part.category === 'movement') {
    R.roundRect(-24, -20, 48, 40, 8, '#20263e', CONFIG.COLOR.ink, 6);
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.moveTo(18, -14); ctx.lineTo(38, 0); ctx.lineTo(18, 14);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = CONFIG.COLOR.ink; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    return;
  }
  if (part.id === 'directionalShield') {
    R.roundRect(-24, -20, 48, 40, 8, '#123a4e', CONFIG.COLOR.ink, 6);
    ctx.strokeStyle = part.color; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 0, 34, -0.7, 0.7); ctx.stroke();
    ctx.restore();
    return;
  }
  if (part.id === 'repairArm') {
    R.roundRect(-24, -22, 48, 44, 8, '#1f4a1f', CONFIG.COLOR.ink, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4, -15, 8, 30);
    ctx.fillRect(-15, -4, 30, 8);
    ctx.restore();
    return;
  }
  if (part.id === 'mineLayer') {
    R.roundRect(-26, -24, 52, 48, 8, '#6b6420', CONFIG.COLOR.ink, 6);
    R.roundRect(-15, -13, 30, 26, 5, part.color, CONFIG.COLOR.ink, 4);
    ctx.restore();
    return;
  }
  if (part.id === 'rocketPod') {
    R.roundRect(-26, -26, 52, 52, 8, '#7a6a1c', CONFIG.COLOR.ink, 6);
    for (let i = 0; i < 3; i++) {
      R.circle(12, -14 + i * 14, 5, '#ff3b3b', CONFIG.COLOR.ink, 3);
    }
    ctx.restore();
    return;
  }
  if (part.id === 'saw') {
    R.circle(0, 0, 34, part.color, CONFIG.COLOR.ink, 6);
    ctx.fillStyle = CONFIG.COLOR.ink;
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.fillRect(30, -6, 12, 12);
      ctx.restore();
    }
    R.circle(0, 0, 11, CONFIG.COLOR.steel, CONFIG.COLOR.ink, 4);
  } else if (part.category === 'power') {
    if (part.id === 'radiator' || part.id === 'heatSink') {
      R.roundRect(-24, -28, 48, 56, 8,
        part.id === 'radiator' ? '#155a6e' : '#5e2a12', CONFIG.COLOR.ink, 6);
      ctx.strokeStyle = part.color;
      ctx.lineWidth = 5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 12, -20);
        ctx.lineTo(i * 12, 20);
        ctx.stroke();
      }
    } else {
      R.circle(0, 0, 30, '#5a4a12', CONFIG.COLOR.ink, 6);
      R.circle(0, 0, 18, part.color, CONFIG.COLOR.ink, 4);
    }
  } else if (part.category === 'defence') {
    R.roundRect(-12, -38, 28, 76, 9, part.color, CONFIG.COLOR.ink, 7);
    R.roundRect(1, -27, 13, 54, 6, '#5f708f', CONFIG.COLOR.ink, 4);
  } else {
    const big = part.id === 'cannon';
    R.roundRect(-26, -22, 52, 44, 8, part.color, CONFIG.COLOR.ink, 6);
    R.roundRect(18, big ? -10 : -7, big ? 46 : 36, big ? 20 : 14, 5,
      CONFIG.COLOR.steel, CONFIG.COLOR.ink, 5);
    R.circle(-6, 0, big ? 9 : 7, '#ffffff', CONFIG.COLOR.ink, 3);
  }
  ctx.restore();
}

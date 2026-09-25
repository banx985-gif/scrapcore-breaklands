// SCRAPCORE: BREAKLANDS — Front end (Milestone 16, plan §7–12)
// One MenuState drives four bottom tabs (HOME / GARAGE / PARTS / RECORDS) plus
// a Settings screen and the Run Setup overlay. Everything is drawn with Canvas
// primitives — no menu art assets required (plan §71.9).

const UI = {
  // Shared layout constants so every tab lines up.
  TAB_H: 118,
  MAX_CONTENT_W: 1860,

  // THE layout rule: never anchor to the raw safe edges. On a 20:9 phone the
  // visible logical view is ~2860 wide, so edge-anchored UI sprawls to the
  // extremes and long text runs off the screen. Everything is laid out inside
  // this centred box instead, which is the safe area clamped to a sane width.
  content() {
    const s = Display.safe;
    const w = Math.min(s.right - s.left, UI.MAX_CONTENT_W);
    const cx = (s.left + s.right) / 2;
    return {
      left: cx - w / 2,
      right: cx + w / 2,
      cx,
      w,
      top: s.top,
      bottom: s.bottom,
    };
  },

  headerY: () => Display.safe.top + 58,
  bodyTop: () => Display.safe.top + 110,
  bodyBottom: () => Display.safe.bottom - UI.TAB_H - 10,

  // Fit a sprite inside a box without ever exceeding it, and return the rect
  // so callers can position things beneath it.
  fitSprite(key, cx, top, maxW, maxH) {
    const img = (typeof Assets !== 'undefined') && Assets.get(key);
    if (!img) return null;
    const ar = img.width / img.height;
    let w = maxW, h = w / ar;
    if (h > maxH) { h = maxH; w = h * ar; }
    Assets.sprite(R.ctx, key, cx, top + h / 2, w, h, 0);
    return { w, h, top, bottom: top + h };
  },

  panel(x, y, w, h, accent) {
    R.roundRect(x + 7, y + 8, w, h, 18, 'rgba(0,0,0,0.55)');
    R.roundRect(x, y, w, h, 18, '#141a2e', accent || CONFIG.COLOR.ink, 6);
  },

  // A machine preview: Core plus whatever is bolted on, drawn from real
  // gameplay sprites so the menus never need their own art.
  // Draw a sprite scaled to FIT a box (never cropped, never stretched),
  // top-aligned so text below it can flow from a known baseline. The art is
  // wildly different shapes — a railgun is 2:1, an armour plate is square —
  // so fitting the longest side is what keeps a grid of tiles looking even.
  // Returns false when the art is missing, so callers can fall back.
  fitInto(ctx, key, cx, top, maxW, maxH) {
    if (typeof Assets === 'undefined' || !Assets.has(key)) return false;
    const img = Assets.get(key);
    if (!img || !img.width || !img.height) return false;
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s, h = img.height * s;
    return Assets.sprite(ctx, key, cx, top + h / 2, w, h, 0);
  },

  corePreview(ctx, cx, cy, chassisId, scale) {
    const C = CHASSIS[chassisId] || CHASSIS.scrapper;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    R.circle(8, 10, 62, 'rgba(0,0,0,0.45)');
    // Illustrated Core if present, code-drawn rings if not. The socket ring
    // hint below is drawn EITHER WAY — it is information, not decoration.
    const artKey = 'art_core_' + (CHASSIS[chassisId] ? chassisId : 'scrapper');
    const drewArt = typeof Assets !== 'undefined' &&
      Assets.sprite(ctx, artKey, 0, 0, 168, 168, 0);
    if (!drewArt) {
      R.circle(0, 0, 62, '#2b3a63', CONFIG.COLOR.ink, 9);
      R.circle(0, 0, 40, '#3d5490', CONFIG.COLOR.ink, 6);
      R.circle(0, 0, 18, C.color, CONFIG.COLOR.ink, 5);
    }
    // Socket ring hint
    ctx.strokeStyle = 'rgba(143,163,200,0.5)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i / 8 * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 108, Math.sin(a) * 108, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  // PLAYTEST 2, ITEM 4. THE MACHINE IS THE MENU ART.
  //
  // corePreview above draws a Core: two rings and a socket hint. It is a
  // diagram of a chassis, and it was the biggest thing on the title screen.
  // The player's machine - the thing they spent an hour bolting together,
  // in their paint, with their guns hanging off it - was nowhere on the
  // screen that exists to make them want to play.
  //
  // So HOME draws the REAL machine, through the same two calls the world
  // uses: PlayerCore.draw for the body and paint, Machine.draw for every
  // part on every socket. If the world is live that IS the live machine.
  // If it is not, one is built from the profile and cached, and thrown away
  // the moment any of the choices that shape it change.
  //
  // Falls back to corePreview when a machine cannot be built at all, so a
  // fresh save with nothing in it still has something on the screen.
  _preview: null,
  _previewKey: null,

  previewMachine() {
    if (typeof Game !== 'undefined' && Game.player && Game.player.sockets) {
      return Game.player;
    }
    if (typeof PlayerCore === 'undefined' || typeof Machine === 'undefined') return null;
    // Everything that changes what the machine LOOKS like, and nothing that
    // does not - so idling on HOME does not rebuild it every frame, and
    // picking a new palette does.
    const key = [Profile.chassis, Profile.starter, Profile.palette,
      (typeof Progress !== 'undefined' && Progress.jackrigId) || '',
      (typeof Progress !== 'undefined' && Progress.frameId) || '',
      (typeof Rack !== 'undefined' && JSON.stringify(Rack.copies)) || ''].join('|');
    if (this._preview && this._previewKey === key) return this._preview;
    let ent = null;
    try {
      ent = new PlayerCore(0, 0, Profile.chassis);
      ent.jackrigId = (typeof Progress !== 'undefined' && Progress.jackrigId) || 'jackal';
      ent.frameId = (typeof Progress !== 'undefined' && Progress.frameId) || 'bare';
      // Progress.buildMachine is the ONE place that answers "what is my
      // machine": Frame stats, permanents bolted on, the saved template
      // rebuilt from the Rack, Forge on top. The menu asks that question
      // rather than answering it a second way, so the preview cannot show a
      // machine the player would not actually walk out with.
      if (typeof Progress !== 'undefined' && Progress.buildMachine) {
        Progress.buildMachine(ent);
      } else if (Profile.starter) {
        Machine.attach(ent, Profile.starter, 0);
      }
      Machine.recalcStats(ent);
      ent.aimX = 0; ent.aimY = -1;   // facing away, so the guns read as a rack
      ent._chunk = null;             // THE OWNERSHIP RULE: never chunk-owned
    } catch (e) { ent = null; }
    this._preview = ent;
    this._previewKey = key;
    return ent;
  },

  machinePreview(ctx, cx, cy, scale) {
    const ent = this.previewMachine();
    if (!ent) { this.corePreview(ctx, cx, cy, Profile.chassis, scale); return false; }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    // The machine is drawn at ITS position, so a live player standing at
    // (40000, 12000) would draw forty thousand units off screen. Bring the
    // origin to it rather than moving the machine, which would be writing
    // to the live entity from a menu.
    ctx.translate(-ent.x, -ent.y);
    // A ground shadow under it, so it stands on the horizon rather than
    // floating in front of it.
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ent.x, ent.y + ent.radius * 1.0, ent.radius * 1.55,
      ent.radius * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    try {
      ent.draw(ctx);
      Machine.draw(ctx, ent);
    } catch (e) { /* a menu must never take the game down */ }
    ctx.restore();
    return true;
  },
};

// How each palette is earned, shown when a locked one is tapped.
// How each palette is earned. Three of the four said 'win a run' and could
// never be earned again; only the challenge one still describes something
// that happens. Rather than invent conditions Block 9 has not designed yet,
// the unearnable three say so plainly — a locked button with an honest
// 'not yet' beats one with a lie on it.
const PALETTE_HOW = {
  coolant: 'NOT YET EARNABLE — BLOCK 9',
  ember: 'NOT YET EARNABLE — BLOCK 9',
  circuit: 'NOT YET EARNABLE — BLOCK 9',
  hazard: 'COMPLETE 9 CHALLENGES',
};

// PLAYTEST 2, ITEM 4. THE MENU BACKDROP.
//
// Aaron on the front end: "meh". It is WRECKJACK's layout with buttons
// removed, and the tell is the background - `drawFloorGrid()`, a flat blue
// lattice, which is an ARENA FLOOR seen from above. The same instinct that
// made the world read as "inside a massive rectangular building" put a room
// floor behind the title screen.
//
// So the menu looks at the horizon instead: the district's own far
// silhouettes and haze band, the exact code Phase A wrote for looking out of
// a district, drawn in screen space with a slow drift and dust across it.
// The menu and the world now agree about what this place looks like, and the
// player sees where they are going before they press the button.
//
// It reuses Outdoors rather than restating it, so a district whose palette is
// retuned retunes its menu too, for free.
const MenuBackdrop = {
  DUST: 120,
  t: 0,
  _dust: null,

  // WHICH district. The one you are standing in if the world is live, and
  // otherwise the one ENTER would take you to - never a hardcoded name, so
  // the backdrop cannot drift away from the button beside it.
  district() {
    if (typeof Game !== 'undefined' && Game.district) return Game.district;
    if (typeof Progress !== 'undefined' && Progress.lastDistrictId &&
        typeof DISTRICTS !== 'undefined' && DISTRICTS[Progress.lastDistrictId]) {
      return DISTRICTS[Progress.lastDistrictId];
    }
    // THE YARD, because that is what _enterDistrict defaults to on a fresh
    // save. This said ironworks for one commit and the button captioned
    // itself THE IRONWORKS while dropping the player in THE YARD - a lie by
    // one word, caught writing the handover.
    return (typeof DISTRICTS !== 'undefined' && DISTRICTS.yard) || null;
  },

  update(dt) { this.t += dt; },

  _seedDust(w, h) {
    this._dust = [];
    // Deterministic, so the backdrop is the same every time the menu opens
    // and cannot flicker between frames that rebuild it.
    let n = 0x811c9dc5;
    const rnd = () => {
      n = Math.imul(n ^ (n >>> 15), 0x2545f491) >>> 0;
      return n / 4294967296;
    };
    for (let i = 0; i < this.DUST; i++) {
      this._dust.push({
        x: rnd() * w, y: rnd() * h,
        r: 1 + rnd() * 3.2,
        sp: 14 + rnd() * 70,          // px/sec, drifting right
        bob: rnd() * Math.PI * 2,
        a: 0.05 + rnd() * 0.16,
      });
    }
  },

  draw(ctx) {
    const v = Display.viewRect ? Display.viewRect() : { x: 0, y: 0, w: 1920, h: 1080 };
    const d = this.district();
    const P = (typeof Outdoors !== 'undefined' && Outdoors.palette)
      ? Outdoors.palette(d) : null;
    if (!P) { if (typeof drawFloorGrid === 'function') drawFloorGrid(); return; }

    const horizon = v.y + v.h * 0.52;

    // SKY. Up from the haze band's warm top into the district's ambient
    // dark, so the light reads as coming from ground level - a lit horizon
    // under a dead sky, which is what a ruined continent looks like.
    const band = P.hazeBand || { from: P.base, to: P.far };
    // A SILHOUETTE NEEDS SOMETHING TO BE A SILHOUETTE AGAINST. The first
    // pass ran the sky's light all the way to 45% of its height, which put
    // the far towers - drawn in the district's own mid-tone far colours -
    // against a background of almost exactly their own value. They were
    // there and you could not see them.
    //
    // So the glow is squeezed down onto the horizon and the sky above it
    // goes dark fast. The towers now stand where the light is.
    const sky = ctx.createLinearGradient(0, horizon, 0, v.y - 20);
    sky.addColorStop(0, band.to || P.far);
    sky.addColorStop(0.16, P.ambient || '#20242e');
    sky.addColorStop(0.55, CONFIG.COLOR.bg);
    sky.addColorStop(1, '#05070f');
    ctx.fillStyle = sky;
    ctx.fillRect(v.x, v.y, v.w, horizon - v.y + 2);

    // The glow itself: a wide, low bloom sitting ON the horizon. This is the
    // light the towers are cut out of, and it is why the skyline reads as a
    // place with something burning in it rather than a pattern.
    const glow = ctx.createRadialGradient(
      v.x + v.w * 0.34, horizon, 0, v.x + v.w * 0.34, horizon, v.w * 0.62);
    glow.addColorStop(0, (band.to || P.far));
    glow.addColorStop(0.55, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = glow;
    ctx.fillRect(v.x, v.y, v.w, horizon - v.y + 2);
    ctx.restore();

    // THE FAR SILHOUETTES. Outdoors.drawParallax works in whatever units it
    // is handed, so screen space is a legal world - the arena's top edge IS
    // the horizon line, and the drift is a slow pan along it.
    // The first screenshot had ONE enormous grey rectangle across the top
    // left corner, because drawParallax was handed the screen as its world:
    // a 620-unit smokestack drew 620 PIXELS tall and 3400 units of spacing
    // put the next one off screen. They are supposed to be a skyline miles
    // away, and a skyline miles away is small and repeats.
    //
    // So the backdrop hands it a real world - WORLD_W units wide - and
    // scales that world down onto the screen. Same code, same shapes, seen
    // from the distance they were authored for.
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, v.y, v.w, horizon - v.y);
    ctx.clip();
    const WORLD_W = 24000;
    const k = v.w / WORLD_W;
    const pan = this.t * 120;                 // world units/sec, so ~14px/sec
    ctx.translate(v.x, horizon);
    ctx.scale(k, k);
    const view = { x: pan, y: -horizon / k, w: WORLD_W, h: (horizon - v.y) / k };
    const arena = { x: pan - WORLD_W, y: 0, w: WORLD_W * 3, h: 4000 };
    ctx.translate(-pan, 0);
    Outdoors.drawParallax(ctx, view, d, arena);
    ctx.restore();

    // A 'source-atop' darkening pass sat here for one screenshot and it
    // took the horizon glow with it: source-atop repaints every pixel
    // already drawn inside the clip, and the glow is one of them. The sky
    // went flat and the towers went pale.
    //
    // Nothing replaces it. Outdoors draws the far structures LIGHTER than
    // the sky on purpose - they are catching the same horizon light the
    // glow comes from - and with the sky darkened above they read on their
    // own, and a darker sky is all that was needed.
    //
    // A second drawParallax call sat here briefly to 'build up' the towers.
    // It did nothing: every fill in that pass is opaque, so the second one
    // painted identical shapes over identical pixels. Removed rather than
    // left in looking like it earns its frame time.

    // GROUND, receding to the horizon. Dark at the bottom where you stand,
    // lifting into the haze - the reverse of the sky, meeting it at the line.
    const gr = ctx.createLinearGradient(0, v.y + v.h, 0, horizon);
    gr.addColorStop(0, CONFIG.COLOR.bg);
    gr.addColorStop(0.7, P.base);
    gr.addColorStop(1, band.to || P.far);
    ctx.fillStyle = gr;
    ctx.fillRect(v.x, horizon, v.w, v.h - (horizon - v.y));

    // The haze that sits ON the line, so neither edge is a hard seam.
    const hz = ctx.createLinearGradient(0, horizon - 160, 0, horizon + 220);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(0.45, P.haze || 'rgba(40,40,44,0.5)');
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(v.x, horizon - 160, v.w, 380);

    // DUST. The thing a still image cannot fake: it is what says the air out
    // there is full of what used to be buildings.
    if (!this._dust) this._seedDust(v.w, v.h);
    ctx.save();
    for (const m of this._dust) {
      const x = v.x + ((m.x + this.t * m.sp) % v.w);
      const y = v.y + m.y + Math.sin(this.t * 0.6 + m.bob) * 14;
      ctx.globalAlpha = m.a;
      ctx.fillStyle = '#c8bda8';
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // VIGNETTE, so text on top always has something to sit against no matter
    // which district's palette is behind it.
    const vg = ctx.createLinearGradient(0, v.y, 0, v.y + v.h);
    vg.addColorStop(0, 'rgba(11,14,26,0.62)');
    vg.addColorStop(0.42, 'rgba(11,14,26,0.10)');
    vg.addColorStop(1, 'rgba(11,14,26,0.78)');
    ctx.fillStyle = vg;
    ctx.fillRect(v.x, v.y, v.w, v.h);
  },
};

class MenuState {
  enter() {
    this.tab = this.tab || 'HOME';
    this.settingsTab = 'CONTROLS';
    this.screen = 'TABS';        // TABS | SETTINGS
    this.partFilter = 'ALL';
    this.selectedPart = null;
    this.recordsTab = 'CHALLENGES';
    this.toast = null;
    this.toastT = 0;
    this.confirmWipe = false;
    this.build();
  }
  onResize() { this.build(); }

  _toast(msg) { this.toast = msg; this.toastT = 1.6; }

  // -----------------------------------------------------------------------
  build() {
    this.buttons = new UIButtons();
    if (this.screen === 'SETTINGS') {
      return this.keyPanel ? this.buildKeyPanel() : this.buildSettings();
    }
    this.buildTabs();
    if (this.tab === 'HOME') this.buildHome();
    else if (this.tab === 'GARAGE') this.buildGarage();
    else if (this.tab === 'PARTS') this.buildParts();
    else this.buildRecords();
  }

  buildTabs() {
    const s = Display.safe;
    const c = UI.content();
    const names = ['HOME', 'GARAGE', 'PARTS', 'RECORDS'];
    const w = (c.w - 40) / names.length - 14;
    // ITEM 4: NAVIGATION IS NOT AN ACTION. Four bolted yellow plates along
    // the bottom edge shouted exactly as loud as ENTER THE BREAKLANDS, and
    // one of them was always lit. They are quiet panels now, and the active
    // one is marked by its TEXT rather than by a slab of yellow — which is
    // also how it reads correctly to somebody who cannot separate the two
    // colours.
    names.forEach((n, i) => {
      const on = this.tab === n;
      this.buttons.add(n, c.left + 20 + i * (w + 14), s.bottom - UI.TAB_H + 6,
        w, UI.TAB_H - 22, () => { this.tab = n; this.selectedPart = null; this.confirmWipe = false; this.build(); },
        { size: 30, quiet: true,
          color: on ? 'rgba(34,42,68,0.92)' : 'rgba(16,20,36,0.72)',
          textColor: on ? CONFIG.COLOR.yellow : '#7f8cab' });
    });
    // Settings gear, top-right (NOT a bottom tab — plan §7). Quiet too: it
    // is a door you open twice a year.
    this.buttons.add('SETTINGS', c.right - 200, s.top + 16, 184, 62, () => {
      this.screen = 'SETTINGS';
      this.confirmWipe = false;
      this.build();
    }, { size: 24, quiet: true, color: 'rgba(16,20,36,0.72)', textColor: '#7f8cab' });
    this.gearAt = { x: c.right - 116, y: s.top + 53 };
  }

  // ---- HOME (plan §7, reworked by PLAYTEST 2 item 4) -------------------
  //
  // The old HOME was WRECKJACK's layout with buttons removed: a logo, a Core
  // diagram, four lines of right-aligned text and three equally loud green
  // plates stacked down the right edge. Aaron said "meh" and he was being
  // generous - nothing on it told him where he was, how long he had played,
  // what he was carrying, or what his machine looked like.
  //
  // One pass, four changes:
  //   the machine is the art, large, in his paint;
  //   ONE primary plate, bottom-right, and it enters the world;
  //   THE YARD and THE GARAGE go quiet beneath it;
  //   a status block says where, how long, and what is at stake.
  //
  // The wordmark stays a placeholder until Aaron's logo art lands
  // (ART_LIST item 1) - inventing one now would only have to be thrown away.
  buildHome() {
    const c = UI.content();
    const bw = Math.min(560, c.w * 0.34);
    const bx = c.right - bw - 24;
    const bottom = UI.bodyBottom();

    // THE ONE PRIMARY BUTTON. Bottom-right, twice the height of anything
    // else on the screen, and the only saturated plate on it.
    const d = MenuBackdrop.district();
    this.buttons.add('ENTER THE BREAKLANDS', bx, bottom - 190, bw, 172,
      () => Game.switch(Profile.introSeen ? 'GAME' : 'INTRO'),
      { size: 42, color: CONFIG.COLOR.lime, role: 'enter',
        sub: (d && d.name) ? d.name.toUpperCase() : '' });

    // QUIET. Both of these are places you go BETWEEN runs; neither is the
    // reason the screen exists, and neither should look like it is.
    this.buttons.add('THE GARAGE', bx, bottom - 292, bw / 2 - 8, 84,
      () => Game.switch('GARAGE'),
      { size: 26, color: 'rgba(20,26,46,0.72)', textColor: CONFIG.COLOR.cyan,
        quiet: true });
    this.buttons.add('THE YARD', bx + bw / 2 + 8, bottom - 292, bw / 2 - 8, 84,
      () => Game.switch('YARD'),
      { size: 26, color: 'rgba(20,26,46,0.72)', textColor: '#c7d2e8',
        quiet: true });

    // START OVER (D349). Top-right under SETTINGS -- the door you open
    // twice a year, beside the other one -- and the quietest thing on the
    // screen. TWO taps: the first turns the plate into the question and
    // puts YES beside it, the second deletes. Anything else -- a tab,
    // SETTINGS, a rebuild -- puts it back. Aaron has not picked where this
    // lives; the title screen is the default because it is the one screen
    // every player sees, and it is a two-line move if he wants it inside
    // SETTINGS. (It stood bottom-left first and the confirm plates sat on
    // the machine's name; the shot said so.)
    const s = Display.safe;
    const sx = c.right - 200, sy = s.top + 92;
    if (!this.confirmWipe) {
      this.buttons.add('START OVER', sx, sy, 184, 62, () => {
        this.confirmWipe = true;
        this._toast('THIS DELETES YOUR SAVE. TAP AGAIN TO START OVER');
        this.build();
      }, { size: 22, color: 'rgba(16,20,36,0.72)', textColor: '#7f8cab', quiet: true });
    } else {
      this.buttons.add('KEEP IT', sx, sy, 184, 62, () => {
        this.confirmWipe = false;
        this._toast('KEPT');
        this.build();
      }, { size: 22, color: 'rgba(16,20,36,0.72)', textColor: CONFIG.COLOR.cyan, quiet: true });
      this.buttons.add('YES — DELETE THE SAVE', sx - 372, sy, 360, 62, () => {
        const ok = Save.startOver();
        this.confirmWipe = false;
        this.tab = 'HOME';
        this._toast(ok ? 'SAVE DELETED — YOU START AGAIN AT THE YARD'
                       : 'COULD NOT DELETE — STORAGE IS BLOCKED. THE GAME IS RESET FOR NOW');
        this.build();
      }, { size: 22, color: CONFIG.COLOR.red, textColor: '#ffffff' });
    }
  }

  // What HOME says about the state of the save. Every number here is read
  // live from the system that owns it - none of it is stored twice.
  homeStatus() {
    const rows = [];
    const d = MenuBackdrop.district();
    rows.push(['DISTRICT', (d && d.name) || 'UNKNOWN']);

    const secs = (Profile.stats && Profile.stats.playTime) || 0;
    const hrs = Math.floor(secs / 3600), mins = Math.floor(secs / 60) % 60;
    rows.push(['PLAYTIME', hrs > 0 ? hrs + 'h ' + mins + 'm' : mins + 'm']);

    // THE CARRY NUMBER. Block 3's whole tension is this figure: parts you
    // have picked up and not yet banked, which a death drops on the ground.
    // It belongs on the screen you look at before deciding to go back out.
    const carry = (typeof Rack !== 'undefined' && Rack.pending) ? Rack.pending.length : 0;
    rows.push(['CARRYING', carry === 0 ? 'NOTHING' :
      carry + ' PART' + (carry === 1 ? '' : 'S') + ' UNBANKED']);

    rows.push(['SCRAP', String((typeof Forge !== 'undefined' && Forge.scrap) || 0)]);
    rows.push(['PARTS SEEN',
      Profile.discovered.length + ' / ' + PART_LIST.length]);
    return rows;
  }

  drawHome() {
    const c = UI.content();
    // Logo: TOP-ALIGNED and fitted. It was centred on a y smaller than half
    // its own height, which clipped it off the top of the screen.
    const logoBox = UI.fitSprite('logo', c.cx, c.top + 16,
      Math.min(640, c.w * 0.44), 250);
    if (!logoBox) {
      R.text('SCRAPCORE', c.left + 40, c.top + 92, 78, CONFIG.COLOR.yellow, 'left');
      R.text('BREAKLANDS', c.left + 40, c.top + 156, 52, '#c7d2e8', 'left');
    }

    // THE MACHINE. Left of centre, large, standing on the horizon. It is
    // drawn at the scale the screen can afford rather than a fixed one, so
    // a 1280x720 window shows the same machine smaller and not a cropped
    // half of one.
    const mx = c.left + c.w * 0.30;
    const my = UI.bodyTop() + (UI.bodyBottom() - UI.bodyTop()) * 0.54;
    // It is the ART. The first pass drew it at the size the old Core diagram
    // had been, which left the left half of the screen empty around a small
    // machine - the exact "meh" the pass exists to answer.
    const scale = Math.min(2.1, c.w / 1150, (UI.bodyBottom() - UI.bodyTop()) / 520);
    UI.machinePreview(R.ctx, mx, my, scale);

    // Its name under it, because the machine is now the largest thing on the
    // screen and an unlabelled portrait is a puzzle.
    const ch = Profile.chassisData;
    R.text(ch.name, mx, my + 168 * scale, 46, ch.color, 'center');
    // Frames.get().name already ends in FRAME, so appending it read
    // "BARE FRAME FRAME" on the very first screenshot.
    const fr = (typeof Progress !== 'undefined' && Progress.frame &&
      Progress.frame.name) || 'BARE FRAME';
    R.smallText(fr.toUpperCase(), mx, my + 168 * scale + 34, 24,
      CONFIG.COLOR.steel, 'center');

    // THE STATUS BLOCK. A quiet panel, right column, above the buttons.
    const rows = this.homeStatus();
    const pw = Math.min(560, c.w * 0.34);
    const px = c.right - pw - 24;
    const ph = 34 + rows.length * 40;
    const py = UI.bodyBottom() - 292 - 34 - ph;
    R.roundRect(px, py, pw, ph, 12, 'rgba(11,14,26,0.62)',
      'rgba(143,163,200,0.22)', 3);
    rows.forEach((r, i) => {
      const y = py + 42 + i * 40;
      R.smallText(r[0], px + 22, y, 22, CONFIG.COLOR.steel);
      R.smallText(r[1], px + pw - 22, y, 24,
        r[0] === 'CARRYING' && r[1] !== 'NOTHING' ? CONFIG.COLOR.orange : '#ffffff',
        'right');
    });
  }

  // ---- GARAGE (plan §8) --------------------------------------------------
  buildGarage() {
    const c = UI.content();

    // FOUR ROWS, SIZED TO THE SPACE. Chassis, starter weapon, difficulty and
    // palette. Difficulty arrived when the RUN SETUP overlay went, made five
    // rows' worth of fixed offsets out of four rows' worth of screen, and
    // pushed the palette row under the tab bar at 1280x720 —
    // tests/test_layout.js caught it across five screen shapes.
    //
    // So the rows are derived, not typed. The gap shrinks before the buttons
    // do, because a cramped row still reads and a clipped one does not.
    const top = UI.bodyTop() + 330;
    const fit = Math.min(1, (UI.bodyBottom() - top - 40) / 700);
    const rowGap = Math.round(175 * fit);
    const bh = Math.round(96 * fit);
    const y = top;
    const cw = 300, gap = 22;
    CHASSIS_LIST.forEach((id, i) => {
      const C = CHASSIS[id];
      const owned = Profile.hasChassis(id);
      this.buttons.add(C.name, c.right - 990 + i * (cw + gap), y, cw, bh, () => {
        if (Profile.selectChassis(id)) this.build();
        else this._toast(C.unlock ? 'LOCKED \u2014 ' + C.unlock.toUpperCase() : 'LOCKED');
      }, { size: 34, color: !owned ? '#232b44' : (Profile.chassis === id ? C.color : '#3a4468'),
           textColor: !owned ? '#8fa3c8' : (Profile.chassis === id ? CONFIG.COLOR.ink : '#ffffff') });
    });

    const wy = y + rowGap;
    const ww = 240;
    STARTER_WEAPONS.forEach((id, i) => {
      const p = PARTS[id];
      const owned = Profile.hasPart(id);
      this.buttons.add(p.name.split(' ')[0], c.right - 990 + i * (ww + 16), wy, ww, bh, () => {
        if (Profile.selectStarter(id)) this.build();
        else this._toast('LOCKED \u2014 DISCOVER IT IN A RUN');
      }, { size: 28, color: !owned ? '#232b44' : (Profile.starter === id ? p.color : '#3a4468'),
           textColor: !owned ? '#8fa3c8' : (Profile.starter === id ? CONFIG.COLOR.ink : '#ffffff') });
    });

    // DIFFICULTY. It used to live in the RUN SETUP overlay, which was the
    // last thing you touched before starting a run. There are no runs, and
    // difficulty is still real — Profile.difficultyData.mul feeds the
    // Director's spawn budget — so it belongs here, with the other standing
    // choices you make once and live with.
    const dy = wy + rowGap;
    const dw2 = 240;
    DIFFICULTY_LIST.forEach((id, i) => {
      const Dif = DIFFICULTIES[id];
      const owned = Profile.hasDifficulty(id);
      this.buttons.add(Dif.name, c.right - 990 + i * (dw2 + 16), dy, dw2, bh, () => {
        if (Profile.selectDifficulty(id)) this.build();
        else this._toast('LOCKED — ' +
          (id === 'hard' ? 'CLEAR NORMAL FIRST' : 'CLEAR HARD FIRST'));
      }, { size: 26,
           color: !owned ? '#232b44' : (Profile.difficulty === id ? Dif.color : '#3a4468'),
           textColor: !owned ? '#8fa3c8'
             : (Profile.difficulty === id ? CONFIG.COLOR.ink : '#ffffff') });
    });

    // Palettes (plan §56) — cosmetic, and the row explains how each is earned
    // rather than showing a mystery locked button.
    const py = dy + rowGap;
    const pcount = PALETTE_LIST.length;
    const pgap = 14;
    const pw = Math.max(120, Math.min(200, (c.w - 40 - pgap * (pcount - 1)) / pcount));
    const px0 = c.cx - (pcount * pw + (pcount - 1) * pgap) / 2;
    PALETTE_LIST.forEach((id, i) => {
      const P = PALETTES[id];
      const owned = Profile.hasPalette(id);
      this.buttons.add(P.name, px0 + i * (pw + pgap), py, pw, Math.round(bh * 0.8), () => {
        if (Profile.selectPalette(id)) this.build();
        else this._toast('LOCKED \u2014 ' + (PALETTE_HOW[id] || 'KEEP PLAYING'));
      }, { size: 22, color: !owned ? '#232b44' : (Profile.palette === id ? P.body : '#3a4468'),
           textColor: !owned ? '#8fa3c8' : (Profile.palette === id ? CONFIG.COLOR.ink : '#ffffff') });
    });
  }

  drawGarage() {
    const c = UI.content();
    // Row labels derive from the same numbers buildGarage uses, so they
    // cannot drift away from the buttons they name.
    const top = UI.bodyTop() + 330;
    const fit = Math.min(1, (UI.bodyBottom() - top - 40) / 700);
    const rowGap = Math.round(175 * fit);
    R.text('GARAGE', c.cx, UI.headerY(), 62, CONFIG.COLOR.yellow);
    UI.corePreview(R.ctx, c.left + 380, 560, Profile.chassis, 1.15);

    const C = Profile.chassisData;
    const x = c.right - 990;
    let y = UI.bodyTop() + 60;
    R.text(C.name, x + 150, y, 52, C.color, 'center');
    y += 56;
    const rows = [['HP', C.hp], ['POWER', C.power],
                  ['SPEED', Math.round(C.speed / 6.4) + '%'],
                  ['DASH', C.dashCd.toFixed(1) + 's']];
    for (const [k, v] of rows) {
      R.smallText(k, x, y, 28, CONFIG.COLOR.steel);
      R.smallText(String(v), x + 220, y, 28, '#ffffff');
      y += 40;
    }
    R.smallText(C.blurb, x, y + 10, 24, CONFIG.COLOR.steel);
    R.smallText('CHASSIS', x, top - 26, 26, CONFIG.COLOR.steel);
    R.smallText('STARTER WEAPON', x, top + rowGap - 26, 26, CONFIG.COLOR.steel);
    R.smallText('DIFFICULTY', x, top + rowGap * 2 - 26, 26, CONFIG.COLOR.steel);
    R.smallText('PALETTE', c.cx, top + rowGap * 3 - 26, 24, CONFIG.COLOR.steel, 'center');
    // Lock hints — the padlock art if we have it, the word if not.
    CHASSIS_LIST.forEach((id, i) => {
      if (Profile.hasChassis(id)) return;
      const lx = x + i * 322 + 150, ly = top + Math.round(120 * fit);
      const drew = typeof Assets !== 'undefined' &&
        Assets.sprite(R.ctx, 'icon_lock', lx, ly, 52, 52, 0);
      if (!drew) R.smallText('LOCKED', lx - 50, ly, 22, CONFIG.COLOR.red);
    });
  }

  // ---- PARTS catalogue (plan §9) -----------------------------------------
  buildParts() {
    const c = UI.content();
    const cats = ['ALL', 'WEAPONS', 'DEFENCE', 'POWER', 'UTILITY', 'STRUCTURE', 'MOVEMENT'];
    const fw = 250;
    cats.forEach((cat, i) => {
      this.buttons.add(cat, c.left + 20 + i * (fw + 10), UI.bodyTop(), fw, 70, () => {
        this.partFilter = cat;
        this.selectedPart = null;
        this.build();
      }, { size: 26, color: this.partFilter === cat ? CONFIG.COLOR.cyan : '#232b44',
           textColor: this.partFilter === cat ? CONFIG.COLOR.ink : '#ffffff' });
    });

    const ids = this.filteredParts();
    // THE GRID SIZES ITSELF TO THE CATALOGUE. It used to be a fixed 190x120
    // tile, which fitted 29 parts in four rows and then ran straight through
    // the tab bar when the catalogue grew to 41. Nothing may hard-code how
    // many parts there are — not the tests, and not the screen that shows
    // them. 190x120 is now a MAXIMUM: the tiles shrink to fit and never
    // leave the body area, whatever PART_LIST.length becomes.
    const gx = 12;
    const gridTop = UI.bodyTop() + 96;
    const availW = c.w - 40;
    const availH = Math.max(120, UI.bodyBottom() - gridTop);
    let cols = 8;
    let rows = Math.max(1, Math.ceil(ids.length / cols));
    // Wider before smaller: on a wide screen an extra column beats squashing
    // every tile, so grow the columns while the tiles would otherwise shrink.
    while ((availH - (rows - 1) * gx) / rows < 96 && cols < 12) {
      cols++;
      rows = Math.max(1, Math.ceil(ids.length / cols));
    }
    const cw = Math.min(190, (availW - (cols - 1) * gx) / cols);
    const ch = Math.min(120, (availH - (rows - 1) * gx) / rows);
    ids.forEach((id, i) => {
      const p = PARTS[id];
      const known = Profile.hasPart(id);
      const cx = c.left + 20 + (i % cols) * (cw + gx);
      const cy = UI.bodyTop() + 96 + Math.floor(i / cols) * (ch + gx);
      // A DISCOVERED tile carries no plate label: the art overlay (drawn
      // AFTER the plates — see render) puts the sprite on the plate and the
      // name along the bottom edge. The plate label used to hold the name,
      // and the art was painted BEFORE the plates, which meant the catalogue
      // art had never actually been visible — found by screenshotting the
      // tab, the standing lesson yet again.
      this.buttons.add(known ? '' : '???', cx, cy, cw, ch, () => {
        this.selectedPart = known ? id : null;
        if (!known) this._toast('NOT YET DISCOVERED');
        this.build();
      }, { size: 22, color: known ? (this.selectedPart === id ? p.color : '#2a3454') : '#1b2138',
           textColor: known ? '#ffffff' : '#5f708f' });
      const tile = this.buttons.items[this.buttons.items.length - 1];
      if (tile) {
        tile.partId = id;
        if (known) tile.partName = p.name.split(' ')[0];
      }
    });
  }

  filteredParts() {
    const map = { WEAPONS: 'weapon', DEFENCE: 'defence', POWER: 'power',
                  UTILITY: 'utility', STRUCTURE: 'structure', MOVEMENT: 'movement' };
    if (this.partFilter === 'ALL') return PART_LIST;
    const want = map[this.partFilter];
    return PART_LIST.filter(id => PARTS[id].category === want);
  }

  drawParts() {
    R.text('PARTS  ' + Profile.discovered.length + ' / ' + PART_LIST.length,
      UI.content().cx,
      UI.headerY(), 54, CONFIG.COLOR.yellow);
    // Padlock over every ??? tile so locked content reads instantly.
    if (typeof Assets !== 'undefined' && Assets.has('icon_lock')) {
      for (const b of this.buttons.items) {
        if (b.label !== '???') continue;
        Assets.sprite(R.ctx, 'icon_lock', b.x + b.w / 2, b.y + b.h / 2 + 18, 46, 46, 0);
      }
    }
    if (!this.selectedPart) return;
    const p = PARTS[this.selectedPart];
    const s = Display.safe;
    const w = 700, h = 250, x = 960 - w / 2, y = UI.bodyBottom() - h;
    UI.panel(x, y, w, h, p.color);
    // Art sits on the right of the panel; the text column is unchanged, so a
    // missing image just leaves empty panel rather than shifting the layout.
    UI.fitInto(R.ctx, 'art_' + this.selectedPart, x + w - 130, y + 30, 200, 190);
    R.text(p.name, x + w / 2, y + 50, 40, p.color);
    R.smallText(p.category.toUpperCase(), x + 30, y + 96, 24, CONFIG.COLOR.steel);
    const bits = [];
    bits.push('POWER ' + (p.powerCost || 0));
    bits.push('HP ' + p.hp);
    bits.push('JOINT ' + p.connectorHp);
    if (p.damage) bits.push('DMG ' + p.damage);
    if (p.dps) bits.push('DPS ' + p.dps);
    if (p.heatPerShot) bits.push('HEAT ' + p.heatPerShot);
    if (p.powerBonus) bits.push('+' + p.powerBonus + ' PWR');
    if (p.coolingBonus) bits.push('+' + p.coolingBonus + ' COOL');
    R.smallText(bits.join('   '), x + 30, y + 140, 26, '#ffffff');
    R.smallText('Discovered', x + 30, y + 196, 24, CONFIG.COLOR.lime);
  }

  // ---- RECORDS (plan §10) ------------------------------------------------
  buildRecords() {
    const c = UI.content();
    // ITEM 6: the RECORDS screen is the journal until Block 16 says
    // otherwise — a separate Journal screen doing half the job is the
    // mistake Block 5 already fixed once.
    ['CHALLENGES', 'QUESTIONS', 'STATS'].forEach((n, i) => {
      this.buttons.add(n, c.left + 20 + i * 330, UI.bodyTop(), 320, 72, () => {
        this.recordsTab = n;
        this.build();
      }, { size: 28, color: this.recordsTab === n ? CONFIG.COLOR.cyan : '#232b44',
           textColor: this.recordsTab === n ? CONFIG.COLOR.ink : '#ffffff' });
    });
  }

  drawRecords() {
    const c = UI.content();
    R.text('RECORDS', c.cx, UI.headerY(), 54, CONFIG.COLOR.yellow);
    let y = UI.bodyTop() + 110;
    if (this.recordsTab === 'CHALLENGES') {
      R.smallText(Profile.challengesComplete() + ' / ' + CHALLENGES.length +
        ' COMPLETE', c.right - 420, UI.bodyTop() + 46, 28, CONFIG.COLOR.lime);
      const colW = c.w / 2 - 20;
      CHALLENGES.forEach((ch, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = c.left + 30 + col * colW;
        const yy = y + row * 62;
        const done = Profile.challengeDone(ch.id);
        const tick = done && typeof Assets !== 'undefined' &&
          Assets.sprite(R.ctx, 'icon_check', x + 12, yy - 6, 34, 34, 0);
        R.smallText((done && !tick ? '\u2713 ' : (done ? '   ' : '\u2022 ')) + ch.name,
          x + (done ? 22 : 0), yy, 26, done ? CONFIG.COLOR.lime : '#ffffff');
        R.smallText(ch.desc, x + 20, yy + 26, 19, CONFIG.COLOR.steel);
        if (ch.goal > 1) {
          R.smallText((Profile.challenges[ch.id] || 0) + '/' + ch.goal,
            x + colW - 90, yy, 22, CONFIG.COLOR.cyan);
        }
      });
    } else if (this.recordsTab === 'QUESTIONS') {
      this.drawQuestions();
    } else {
      const st = Profile.stats;
      // Five rows came off in the Block 0 audit because nothing can move them
      // any more: Victories and Bosses Defeated needed a run to win and a boss
      // to fight, Best Core Level was Core Levels, Parts Destroyed needed the
      // `moduleDestroyed` event, and Total Runs counted a thing that no longer
      // happens. A stat frozen at zero forever reads as a broken save.
      const rows = [
        ['Deaths', st.deaths],
        ['Machines Destroyed', st.enemiesDestroyed],
        ['Parts Ripped Intact', st.partsRipped], ['Parts Attached', st.partsAttached],
        ['Parts Lost', st.partsLost],
        ['Overheats', st.overheats], ['Dashes', st.dashes],
        ['Parts Discovered', Profile.discovered.length + ' / ' + PART_LIST.length],
        ['Play Time', Math.floor((st.playTime || 0) / 60) + 'm'],
      ];
      rows.forEach(([k, v], i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = c.left + 60 + col * (c.w / 2 - 20);
        R.smallText(k, x, y + row * 58, 28, CONFIG.COLOR.steel);
        R.smallText(String(v || 0), x + 560, y + row * 58, 28, '#ffffff');
      });
    }
  }

  // ---- QUESTIONS (Playtest 2 item 6) -------------------------------------
  // The three mysteries, one column each: the question, where it is posed, a
  // found/total bar, then every fragment that answers it. A FOUND fragment
  // shows its kind and its first line; an unfound one is a dim slot naming
  // only the district — collecting reads as progress without spoiling the
  // text, and an expansion district's name IS the hook.
  drawQuestions() {
    if (typeof QUESTIONS === 'undefined' || typeof Story === 'undefined') {
      return;
    }
    const c = UI.content();
    // Six of the eleven districts do not ship in the five; their fragments
    // still count toward each question, so the slots name them honestly.
    const PLACE = {
      grows: 'THE GROWS', digs: 'THE DIGS', sumpworks: 'SUMPWORKS',
      railspine: 'RAIL SPINE', stacks: 'THE STACKS', dispatch: 'CENTRAL DISPATCH',
    };
    const KIND = {
      human: { ch: 'H', color: CONFIG.COLOR.yellow },
      work: { ch: 'W', color: CONFIG.COLOR.orange },
      system: { ch: 'S', color: CONFIG.COLOR.cyan },
    };
    const colW = (c.w - 40 - 2 * 28) / 3;
    QUESTIONS.forEach((q, qi) => {
      const x = c.left + 20 + qi * (colW + 28);
      let y = UI.bodyTop() + 104;
      R.text(q.title, x + colW / 2, y, R.fitText(q.title, 28, colW - 16),
        CONFIG.COLOR.yellow);
      y += 36;
      R.smallText(q.posed, x + colW / 2, y, R.fitText(q.posed, 19, colW - 16),
        CONFIG.COLOR.steel, 'center');
      y += 34;
      const p = Story.progress(q.id);
      const bw = colW - 120;
      R.rect(x, y - 8, bw, 14, 'rgba(0,0,0,0.55)');
      if (p.total > 0 && p.found > 0) {
        R.rect(x, y - 8, bw * (p.found / p.total), 14, CONFIG.COLOR.lime);
      }
      R.roundRect(x, y - 8, bw, 14, 3, null, CONFIG.COLOR.ink, 3);
      R.smallText(p.found + ' / ' + p.total, x + colW, y, 22,
        p.found > 0 ? CONFIG.COLOR.lime : CONFIG.COLOR.steel, 'right');
      y += 30;
      // The unresolved question says so where its answer would go — the tab
      // must not point at a district that will not ship for a year.
      const footer = q.answerable === false ? 30 : 6;
      const ids = Story.byQuestion(q.id);
      const avail = UI.bodyBottom() - y - footer;
      const rowH = Math.max(15, Math.min(32, avail / Math.max(1, ids.length)));
      ids.forEach((id) => {
        const f = FRAGMENTS[id];
        if (Story.found(id)) {
          const k = KIND[f.kind] || KIND.system;
          R.roundRect(x, y - rowH * 0.32, rowH * 0.7, rowH * 0.7, 4,
            'rgba(0,0,0,0.5)', k.color, 2);
          R.smallText(k.ch, x + rowH * 0.35, y + rowH * 0.04,
            Math.min(16, rowH * 0.5), k.color, 'center');
          const line = f.text.split('\n')[0];
          R.smallText(line, x + rowH * 0.9 + 8, y,
            R.fitText(line, Math.min(19, rowH - 5), colW - rowH - 12),
            '#e8ddc8');
        } else {
          const place = (typeof DISTRICTS !== 'undefined' && DISTRICTS[f.district])
            ? DISTRICTS[f.district].name : (PLACE[f.district] || f.district.toUpperCase());
          R.smallText('•  ' + place, x + 6, y,
            Math.min(17, rowH - 4), '#4a5570');
        }
        y += rowH;
      });
      if (q.answerable === false) {
        R.smallText(q.answer, x + colW / 2, UI.bodyBottom() - 10,
          R.fitText(q.answer, 20, colW - 10), CONFIG.COLOR.orange, 'center');
      }
    });
  }

  // ---- SETTINGS (plan §11) -----------------------------------------------
  buildSettings() {
    const s = Display.safe;
    const c = UI.content();
    SETTINGS_TABS.forEach((t, i) => {
      this.buttons.add(t, c.left + 20 + i * 300, UI.bodyTop(), 290, 72, () => {
        this.settingsTab = t;
        this.build();
      }, { size: 26, color: this.settingsTab === t ? CONFIG.COLOR.cyan : '#232b44',
           textColor: this.settingsTab === t ? CONFIG.COLOR.ink : '#ffffff' });
    });

    const keys = Object.keys(SETTINGS_DEFS).filter(k => SETTINGS_DEFS[k].tab === this.settingsTab);
    keys.forEach((k, i) => {
      const y = UI.bodyTop() + 110 + i * 92;
      this.buttons.add(Settings.display(k), c.left + 860, y, 260, 76, () => {
        Settings.cycle(k, 1);
        if (SETTINGS_DEFS[k].pending) this._toast('NOT WIRED UP YET \u2014 LANDS LATER');
        this.build();
      }, { size: 28, color: SETTINGS_DEFS[k].pending ? '#3a4468' : CONFIG.COLOR.violet,
           textColor: '#ffffff' });
    });

    // Keyboard rebinding lives on the CONTROLS tab. Shown on every device —
    // a Bluetooth keyboard on a tablet is a real case — but it costs one
    // button and nothing else if you never touch it.
    if (this.settingsTab === 'CONTROLS' && typeof Keys !== 'undefined') {
      const ky = UI.bodyTop() + 110 + keys.length * 92;
      this.buttons.add('KEYBOARD & MOUSE', c.left + 60, ky, 460, 76, () => {
        this.keyPanel = true;
        this.rebinding = null;
        this.build();
      }, { size: 26, color: CONFIG.COLOR.cyan, textColor: CONFIG.COLOR.ink });
    }

    this.buttons.add('RESTORE DEFAULTS', c.left + 20, s.bottom - 110, 420, 84, () => {
      Settings.reset();
      this._toast('DEFAULTS RESTORED');
      this.build();
    }, { size: 26, color: '#232b44', textColor: '#ffffff' });
    // Credits had no entry point at all since M20 — reachable in code only.
    this.buttons.add('CREDITS', c.left + 470, s.bottom - 110, 300, 84, () => {
      Game.switch('CREDITS');
    }, { size: 26, color: '#232b44', textColor: '#ffffff' });
    this.buttons.add('BACK', c.right - 300, s.bottom - 110, 280, 84, () => {
      this.screen = 'TABS';
      this.build();
    }, { size: 34, color: CONFIG.COLOR.yellow });
  }

  buildKeyPanel() {
    const s = Display.safe;
    const c = UI.content();
    const cols = 2;
    const bw = Math.min(520, (c.w - 120) / cols - 30);
    Keys.ACTION_LIST.forEach((a, i) => {
      const x = c.left + 40 + (i % cols) * (bw + 40);
      const y = UI.bodyTop() + 74 + Math.floor(i / cols) * 72;
      const codes = Keys.bindings[a] || [];
      const label = this.rebinding === a ? 'PRESS A KEY...' : (codes[0] || '—');
      this.buttons.add(label, x + bw - 250, y, 250, 58, () => {
        this.rebinding = a;
        // Capture the next key press, whatever it is.
        Keys._capture = (code) => {
          Keys._capture = null;
          if (code !== 'Escape') Keys.rebind(a, code);
          this.rebinding = null;
          this.build();
        };
        this.build();
      }, { size: 22, color: this.rebinding === a ? CONFIG.COLOR.yellow : '#2a3454',
           textColor: this.rebinding === a ? CONFIG.COLOR.ink : '#ffffff' });
    });
    this.buttons.add('RESET KEYS', c.left + 20, s.bottom - 110, 360, 84, () => {
      Keys.reset();
      this._toast('KEYS RESET');
      this.build();
    }, { size: 26, color: '#232b44', textColor: '#ffffff' });
    this.buttons.add('BACK', c.right - 300, s.bottom - 110, 280, 84, () => {
      Keys._capture = null;
      this.keyPanel = false;
      this.rebinding = null;
      this.build();
    }, { size: 34, color: CONFIG.COLOR.yellow });
  }

  drawKeyPanel() {
    const c = UI.content();
    R.text('KEYBOARD & MOUSE', c.cx, UI.headerY(), 48, CONFIG.COLOR.yellow);
    R.smallText('Move with the left hand, aim with the right — or aim with the mouse. '
      + 'Tap a binding, then press the key you want.',
      c.cx, UI.bodyTop() + 20, 24, CONFIG.COLOR.steel, 'center');
    const cols = 2;
    const bw = Math.min(520, (c.w - 120) / cols - 30);
    Keys.ACTION_LIST.forEach((a, i) => {
      const x = c.left + 40 + (i % cols) * (bw + 40);
      const y = UI.bodyTop() + 74 + Math.floor(i / cols) * 72;
      R.smallText(Keys.ACTION_NAME[a] || a, x + 10, y + 20, 26, '#ffffff');
    });
  }

  drawSettings() {
    const c = UI.content();
    R.text('SETTINGS', c.cx, UI.headerY(), 54, CONFIG.COLOR.yellow);
    const keys = Object.keys(SETTINGS_DEFS).filter(k => SETTINGS_DEFS[k].tab === this.settingsTab);
    keys.forEach((k, i) => {
      const d = SETTINGS_DEFS[k];
      const y = UI.bodyTop() + 110 + i * 92;
      R.smallText(d.name, c.left + 60, y + 40, 30, d.pending ? CONFIG.COLOR.steel : '#ffffff');
      if (d.pending) R.smallText('(pending)', c.left + 640, y + 40, 22, CONFIG.COLOR.orange);
    });
  }

  // -----------------------------------------------------------------------
  update(dt) {
    // Pad and keyboard walk every tab screen — Aaron hit HOME stranded on a
    // real controller right after the rank cards got the same fix.
    if (typeof UINav !== 'undefined') UINav.update(this.buttons);
    MenuBackdrop.update(dt);
    if (this.toastT > 0) this.toastT = Math.max(0, this.toastT - dt);
    // The machine preview is rebuilt from the profile, so a choice made on
    // the GARAGE tab has to reach the portrait on HOME. Keying the cache on
    // what the machine is made of does that without a single notification.
  }

  pointerDown(id, x, y) { this.buttons.hit(x, y); }

  render() {
    R.clear(CONFIG.COLOR.bg);
    // ITEM 4: the horizon, not an arena floor. See MenuBackdrop.
    MenuBackdrop.draw(R.ctx);
    if (this.screen === 'SETTINGS') {
      if (this.keyPanel) this.drawKeyPanel(); else this.drawSettings();
    }
    else if (this.tab === 'HOME') this.drawHome();
    else if (this.tab === 'GARAGE') this.drawGarage();
    else if (this.tab === 'PARTS') this.drawParts();
    else this.drawRecords();
    this.buttons.draw();
    // The catalogue art goes ON TOP of the tile plates. It used to be drawn
    // in drawParts, BEFORE buttons.draw() — so the plates painted straight
    // over it and no tile art had ever reached the screen.
    if (this.tab === 'PARTS' && this.screen !== 'SETTINGS' &&
        typeof Assets !== 'undefined') {
      for (const b of this.buttons.items) {
        if (!b.partId || !Profile.hasPart(b.partId)) continue;
        UI.fitInto(R.ctx, 'art_' + b.partId, b.x + b.w / 2, b.y + 6,
          b.w - 24, b.h - 34);
        if (b.partName) {
          R.text(b.partName, b.x + b.w / 2, b.y + b.h - 14,
            Math.min(20, b.h * 0.2), '#ffffff');
        }
      }
    }
    if (this.toastT > 0 && this.toast) {
      // On HOME the line above the tab bar runs under ENTER THE BREAKLANDS
      // and across the machine's name (the START OVER shot, D349), so
      // HOME's toast sits at the top of the body, between the wordmark and
      // the status block, where nothing else is drawn.
      const homeToast = this.screen !== 'SETTINGS' && this.tab === 'HOME';
      R.text(this.toast, UI.content().cx,
        homeToast ? UI.bodyTop() + 120 : Display.safe.bottom - UI.TAB_H - 40,
        homeToast ? 30 : 34, CONFIG.COLOR.orange);
    }
  }
}

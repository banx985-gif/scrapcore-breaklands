// SCRAPCORE: BREAKLANDS — the 44-degree presentation (Milestone 3)
// Master v3.2 §5.
//
// THE RULE THAT MAKES THIS SAFE: the simulation stays 2D X/Y. Nothing here
// changes how anything moves, collides, aims or is hit. This is a PRESENTATION
// layer — world coordinates go in, screen coordinates come out — which is why
// converting the game to 44 degrees cannot silently change the game.
//
// Everything below reads `render_manifest.json`. The manifest is the contract
// between the 3D export pipeline and the runtime, and after certification it is
// FROZEN: changing it invalidates every sprite in the library. So the runtime
// never invents a value it could have read, and never derives the manifest from
// the scene.

const Iso = {
  manifest: null,
  loaded: false,

  // Fallback ONLY so the module is usable before the manifest is fetched
  // (tests, tools, the first frame of a cold boot). Any real build overwrites
  // all of this from the file. It is not a second source of truth.
  DEFAULTS: {
    // -1, not 0. A stand-in must never accidentally MATCH a real stamp: if it
    // did, art would load against a camera nobody committed to. -1 matches
    // nothing, so the failure is loud.
    renderVersion: -1,
    cameraPitch: 44,
    yawAngles: [0, 45, 90, 135, 180, 225, 270, 315],
    heightLayers: {
      floor: 0, floorHazard: 1, lowProp: 2, looseParts: 3, machineLower: 4,
      body: 5, tallProp: 6, effects: 7, ui: 8,
    },
  },

  init(manifest) {
    // Prefer the generated manifest whenever it is on the page, even if the
    // caller passed nothing. Since the freeze, DEFAULTS carries a
    // renderVersion that deliberately does NOT match the library, so falling
    // back to it silently refuses every sprite set. Better to find the real
    // contract than to run on a stand-in that cannot load any art.
    if (!manifest && typeof RENDER_MANIFEST !== 'undefined') manifest = RENDER_MANIFEST;
    this.manifest = manifest || this.DEFAULTS;
    this.loaded = !!manifest;
    const p = this.manifest.cameraPitch;
    this.pitchDeg = p;
    this.pitchRad = p * Math.PI / 180;
    // A ground plane seen at 44 degrees above horizontal is foreshortened by
    // cos(pitch). That single number is the whole projection.
    this.groundScale = Math.cos(this.pitchRad);
    this.yaw = (this.manifest.yawAngles || this.DEFAULTS.yawAngles).slice();
    this.dirCount = this.yaw.length;
    this.layers = this.manifest.heightLayers || this.DEFAULTS.heightLayers;
    return this;
  },

  get renderVersion() { return this.manifest ? this.manifest.renderVersion : 0; },

  // Is the 44-degree art switched on? The conversion is happening one draw
  // call at a time and the camera is not frozen yet, so this exists to turn
  // the whole presentation off in one place and get the old top-down build
  // back — for comparing them side by side, and for shipping if the art turns
  // out to need another pass. It is NOT a gameplay switch: the simulation is
  // identical either way, which is the entire reason §5 is presentation-only.
  use44: true,

  // ---- the ground plane ----------------------------------------------------
  // Separate from use44 on purpose. The sprites are photographed at 44 degrees
  // whatever this is set to; THIS is the second half — squashing the FLOOR by
  // cos(pitch) so the ground recedes instead of lying flat.
  //
  // It is done as a canvas transform inside Camera.begin(), which means every
  // world draw call in the game is foreshortened without being touched: the
  // floor, the arena walls, hazard footprints, connector struts, socket
  // spacing, projectile paths, health bars. Anything that is genuinely lying on
  // the ground gets it for free and correctly — a circular blast radius really
  // should read as an ellipse at this angle.
  //
  // The exceptions are SPRITES and TEXT, which stand up out of the floor and
  // must not be squashed. Those un-squash themselves — see Camera.yScale.
  //
  // THE SIMULATION IS UNTOUCHED. Nothing here changes a world coordinate; it
  // only changes where a world coordinate is painted. That is what makes this
  // reversible, and it is the whole reason §5 is written as presentation-only.
  // TRUE, and no longer a setting. Aaron compared 44 DEG against a FLAT build
  // in motion on 20 Aug and chose this one; the manifest was frozen on it and
  // the toggle that made the comparison possible came out with the rest of the
  // M3 scaffolding. Changing this now disagrees with a frozen camera.
  groundProject: true,

  // ---- projection ---------------------------------------------------------
  // World (x, y) is the FLOOR position. `z` is height above the floor, which is
  // what lets a tall prop occlude correctly without leaving its footprint.
  projectX(x) { return x; },
  projectY(y, z) { return y * this.groundScale - (z || 0); },

  project(x, y, z) { return { x: x, y: this.projectY(y, z) }; },

  // Screen back to floor. Needed by anything that reads a touch position as a
  // world position — targeting, debug picking, placement tools.
  unprojectY(sy, z) { return (sy + (z || 0)) / this.groundScale; },
  unproject(sx, sy, z) { return { x: sx, y: this.unprojectY(sy, z) }; },

  // ---- controls (Master §5 / Milestone 3: "push up = move up the screen") --
  // The stick is read in SCREEN space and converted to world. Because only Y is
  // foreshortened, pushing the stick straight up has to travel further in world
  // Y than the raw input suggests, or diagonal movement drifts.
  screenToWorldDir(dx, dy) {
    const wx = dx, wy = dy / this.groundScale;
    const m = Math.hypot(wx, wy);
    if (m < 1e-6) return { x: 0, y: 0 };
    return { x: wx / m, y: wy / m };
  },

  // ---- eight-direction sprite selection -----------------------------------
  // Master §5: body facing snaps to the nearest of eight yaw angles and HOLDS
  // the last heading while stationary; weapons aim independently but pick their
  // own eight-direction art. Projectiles are never quantised.
  dirIndex(angleRad) {
    const step = (Math.PI * 2) / this.dirCount;
    let a = angleRad % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return Math.round(a / step) % this.dirCount;
  },

  dirFromVector(dx, dy) { return this.dirIndex(Math.atan2(dy, dx)); },

  dirYaw(i) { return this.yaw[((i % this.dirCount) + this.dirCount) % this.dirCount]; },

  // The sprite name for a set + direction, built from the manifest's naming
  // convention so the runtime and the exporter cannot disagree.
  spriteName(setId, dirIdx) {
    const conv = (this.manifest && this.manifest.namingConvention)
      || '{set}_d{dir}';
    return conv.replace('{set}', setId)
      .replace('{dir}', String(dirIdx).padStart(1, '0'));
  },

  // ---- depth ---------------------------------------------------------------
  // Y/depth sorting with explicit height layers (Master §5). Sorting on the
  // FLOOR position, not the drawn position, is what keeps a tall prop from
  // jittering in and out of order as it is drawn taller.
  sortKey(ent) {
    const layer = (ent.heightLayer !== undefined)
      ? ent.heightLayer : this.layers.body;
    return layer * 1e6 + ent.y;
  },

  depthSort(list) {
    return list.slice().sort((a, b) => this.sortKey(a) - this.sortKey(b));
  },

  // ---- the world band ------------------------------------------------------
  // sortKey() above is LAYER-dominant, and that is right for deciding which
  // BAND a thing belongs to: floor decals are always under machines, effects
  // and UI are always over them, and no amount of standing further down the
  // screen should change that.
  //
  // Inside a band it is the other way round. Everything here is standing on the
  // same floor, so what decides the overlap is how far down the screen it is:
  // further down means nearer the camera, so it draws last and covers what is
  // behind it. The height layer only breaks ties between two things at the same
  // Y — a tall pillar and a machine level with it, where the pillar should win.
  //
  // This is what makes 44-degree art read as a scene rather than a pile of
  // stickers, and it is the reason a machine can walk BEHIND a pillar.
  worldKey(ent) {
    const layer = (ent.heightLayer !== undefined)
      ? ent.heightLayer : this.layers.body;
    return (ent.y || 0) * 16 + layer;
  },

  // Sorts IN PLACE — this runs once per frame over every visible object, so it
  // does not allocate a copy.
  sortWorld(list) {
    return list.sort((a, b) => this.worldKey(a) - this.worldKey(b));
  },

  // ---- certification support ----------------------------------------------
  // A sprite set may only be loaded if it was exported by the SAME manifest
  // version the build expects. Master v3.2 §5 / Milestones §3.2: the build
  // refuses to load sprite sets whose renderVersion does not match, so a stale
  // sprite can never quietly appear beside a fresh one.
  accepts(spriteSetMeta) {
    if (!spriteSetMeta) return false;
    return spriteSetMeta.renderVersion === this.renderVersion;
  },

  // Is the camera locked? M3 freezes this ONLY once certification passes on
  // real art. Until then the manifest is explicitly provisional and the game
  // says so rather than pretending.
  get frozen() { return !!(this.manifest && this.manifest.frozen); },
};

// Boot from the committed contract when it is present. manifestdata.js is
// generated from render_manifest.json by tools/render_44.py --emit-js, because
// the game runs from file:// and cannot fetch JSON.
Iso.init(typeof RENDER_MANIFEST !== 'undefined' ? RENDER_MANIFEST : null);

// ---------------------------------------------------------------------------
// The loader that enforces the contract. Milestones v3.2 §3.2: "the build
// refuses to load sprite sets whose renderVersion does not match". Refusing
// loudly is the entire point — a stale sprite sitting quietly beside a fresh
// one is exactly the bug the manifest exists to prevent.
const Sprites44 = {
  sets: {},
  rejected: [],

  register(meta) {
    if (!meta || !meta.set) return false;
    if (!Iso.accepts(meta)) {
      this.rejected.push({
        set: meta.set,
        got: meta ? meta.renderVersion : undefined,
        want: Iso.renderVersion,
      });
      return false;
    }
    this.sets[meta.set] = meta;
    return true;
  },

  has(setId) { return !!this.sets[setId]; },

  // The frame for a set at a facing. Returns null rather than guessing, so a
  // missing direction shows up as missing art instead of a wrong-facing sprite.
  frame(setId, dirIdx) {
    const m = this.sets[setId];
    if (!m) return null;
    const i = ((dirIdx % Iso.dirCount) + Iso.dirCount) % Iso.dirCount;
    return (m.frames || []).find(f => f.dir === i) || null;
  },

  frameFor(setId, angleRad) { return this.frame(setId, Iso.dirIndex(angleRad)); },

  // World units per sprite pixel for a set. The exporter draws the model to
  // fill `canvas * fill` pixels and the model's world span is `reach * 2` —
  // the SAME reach the hitbox uses — so this conversion is what keeps the art
  // and the collision agreeing. A set without the numbers falls back to 1:1
  // rather than guessing a scale.
  worldPerPx(setId) {
    const m = this.sets[setId];
    if (!m || !m.reach || !m.canvas) return 1;
    return (m.reach * 2) / (m.canvas * (m.fill || 0.9));
  },

  // The width, IN WORLD UNITS, that a set was modelled to occupy — what
  // drawSized must be asked for to draw it at true scale.
  //
  // This is NOT the same question as "how big is this entity's hitbox". A
  // Wreckjack-stage Jackal is modelled at reach 105 while the player's
  // collision radius stays 62, because the collision is the BODY and the model
  // is the whole machine including its socket ring. Asking for the hitbox size
  // draws the Core at two thirds scale, and every module bolted around it then
  // reads as oversized — which is how it looks, so it sends you hunting in the
  // wrong place entirely.
  worldSize(setId) {
    const m = this.sets[setId];
    if (!m || !m.reach) return 0;
    return (m.reach * 2) / (m.fill || 0.9);
  },

  // Draw a set at a facing. Returns FALSE when the set or the frame is not
  // available, so every caller keeps the drawing it already had — art can land
  // one set at a time without ever blocking the build.
  //
  // The sprite is NOT rotated. That is the whole point of eight-direction art:
  // the machine was photographed turned, so turning the picture would tip it
  // over. `scale` is an optional multiplier for effects that already stretch or
  // pulse a part.
  draw(ctx, setId, angleRad, cx, cy, scale) {
    if (typeof Assets === 'undefined') return false;
    const fr = this.frameFor(setId, angleRad);
    if (!fr) return false;
    const img = Assets.get('d44_' + fr.file.replace(/\.[^.]+$/, ''));
    if (!img) return false;
    const wpp = this.worldPerPx(setId) * (scale || 1);
    const w = fr.w * wpp, h = fr.h * wpp;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    return true;
  },

  // The asset key a caller used, mapped to a 44-degree set id. ZERO's own keys
  // already match the set ids for cores, bosses and props; only the parts carry
  // a `part_` prefix that the exporter does not use.
  // Master v3.2 §5: "body facing snaps to the nearest of eight and HOLDS the
  // last heading while stationary". Held, not reset — a machine that snapped
  // back to a default facing every time it stopped would twitch constantly.
  // Weapons aim independently and pick their own art, which is why this is
  // separate from the aim angle.
  bodyAngle(ent) {
    const sp = Math.hypot(ent.vx || 0, ent.vy || 0);
    if (sp > 24) ent._bodyA = Math.atan2(ent.vy, ent.vx);
    else if (ent._bodyA === undefined) {
      ent._bodyA = (ent.aimX !== undefined) ? Math.atan2(ent.aimY, ent.aimX) : 0;
    }
    return ent._bodyA;
  },

  // The angle to hand Assets.sprite for a body. ZERO's single top-down core
  // sprites are drawn straight up and rotating one would spin the whole
  // machine on the spot, so the heading is only supplied when there is real
  // eight-direction art to select with it. Zero otherwise — the old build,
  // unchanged.
  bodyAngleFor(key, ent) {
    return (this.setForKey(key) && typeof Iso !== 'undefined' && Iso.use44)
      ? this.bodyAngle(ent) : 0;
  },

  setForKey(key) {
    if (!key) return null;
    if (this.sets[key]) return key;
    const bare = key.replace(/^part_/, '');
    return this.sets[bare] ? bare : null;
  },

  // Draw at the size the CALLER asked for. Every existing call site passes the
  // width it wants the sprite's square canvas to occupy, and the exporter
  // records what that canvas was, so scaling by (asked / canvas) reproduces the
  // caller's intent exactly — sprites do not suddenly change size when the
  // 44-degree art switches on. Frames are trimmed, so width and height are
  // scaled together off the untrimmed canvas rather than stretched to fit.
  drawSized(ctx, key, angleRad, cx, cy, askedW, hostile, paintHex) {
    const setId = this.setForKey(key);
    if (!setId) return false;
    const fr = this.frameFor(setId, angleRad);
    if (!fr) return false;
    let img = (typeof Assets !== 'undefined')
      ? Assets.get('d44_' + fr.file.replace(/\.[^.]+$/, '')) : null;
    if (!img) return false;
    // A part carried by an ENEMY is reddened, so one model serves both sides.
    // See js/tint.js. Cached per image, so this is a lookup and the draw below
    // stays a plain blit.
    if (hostile && typeof Tint !== 'undefined') img = Tint.hostile(img);
    // AND PAINT (Block 12), on the same channel and for the same reason:
    // recolour once, cache it, and leave the draw a plain blit. Paint only
    // ever reaches the player's own parts, so this and the line above can
    // never both fire.
    if (paintHex && !hostile && typeof Tint !== 'undefined') img = Tint.paint(img, paintHex);
    const canvas = this.sets[setId].canvas || fr.w;
    const k = (askedW || canvas) / canvas;
    const w = fr.w * k, h = fr.h * k;

    // Same reason as Assets.sprite: the machine stands up out of the floor, so
    // it must not carry the ground's foreshortening.
    const ys = (typeof Camera !== 'undefined') ? Camera.yScale : 1;
    if (ys === 1) {
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      return true;
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 1 / ys);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  },

  reset() {
    this.sets = {}; this.rejected = [];
    // Drop cached hostile tints with the art they were made from — a
    // re-registered set must not keep handing out a tint of the image it
    // replaced.
    if (typeof Tint !== 'undefined') Tint.reset();
  },
};

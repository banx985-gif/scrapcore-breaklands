// SCRAPCORE: BREAKLANDS — Camera (Milestone 4, Block 1 dead zone)
// Smoothly follows the player in WORLD coordinates and maps world -> logical
// screen space. Zoom is driven by attached-part count (plan §70).
//
// BLOCK 1: the camera was already world-space, so the open world needed two
// changes and no rewrite — clamp to the WORLD bounds rather than one arena,
// and a DEAD ZONE so small movements do not drag the view.

const Camera = {
  x: 0, y: 0,          // world position the view is centred on
  zoom: 1,
  _targetZoom: 1,
  // PLAYTEST 3 item 1b. A SMALL PULL-BACK AT SPEED, so a boost reads as one.
  // Whatever is boosting raises this every frame it is boosting; it decays on
  // its own, so nothing has to remember to switch it off — which is the bug
  // a 'camera mode' flag would have shipped the first time a belt unloaded
  // with the player still on it.
  boostPull: 0,
  BOOST_PULL: 0.12,      // how much wider the view gets at a full ride
  BOOST_DECAY: 2.4,      // and how fast it comes back when the ride stops
  _shakeAmp: 0, _shakeT: 0, _shakeDur: 1,

  // Tiny controlled screen shake for heavy feedback moments (plan §74).
  shakeScale: 1,        // Settings: DISPLAY > Screen Shake

  // ---- DEAD ZONE (Block 1) ------------------------------------------------
  // A rectangle around screen centre inside which the player can move without
  // moving the camera. Driving a big machine around a world of rooms reads as
  // seasick when every twitch drags the whole view; a dead zone lets the
  // player weave inside a room and only pans when they actually travel.
  //
  // Expressed as a FRACTION of the visible world extent, not in world units,
  // so it stays the same size on screen at every zoom level and on every
  // screen shape. One value tunes it; 0 disables the dead zone entirely.
  DEAD_ZONE: 0.14,      // 14% of the half-extent, so ~28% of the view

  // Where the camera is TRYING to be. Held separately from x/y because the
  // dead zone decides the target and the smoothing then chases it: folding
  // them together makes the camera creep out of the dead zone by a fraction
  // of the smoothing every frame.
  _tx: 0, _ty: 0,

  shake(amp, dur) {
    amp *= this.shakeScale;
    if (amp <= 0) return;
    this._shakeAmp = Math.max(this._shakeAmp, amp);
    this._shakeT = Math.max(this._shakeT, dur);
    this._shakeDur = dur;
  },

  snapTo(x, y) { this.x = this._tx = x; this.y = this._ty = y; },

  // Plan §70: zoom out as the machine grows. Extended for the 12-module cap
  // (10 roots at Core Level 20, plus a Splitter's two children).
  // PHASE A, STEP 1. The open world is framed WIDER than an arena was.
  //
  // These numbers came from WRECKJACK, where the whole level was one room and
  // framing tight was correct. Out here it is the cheapest single thing that
  // says 'inside': a close camera puts a wall or a prop at the edge of the
  // screen at all times and never lets the player see distance.
  //
  // Applied as a multiplier on the existing curve rather than by rewriting it,
  // so the "zoom out as the machine grows" behaviour is untouched and one
  // constant moves the whole framing.
  OPEN_WORLD: 0.62,

  zoomForModuleCount(n) {
    const k = this.OPEN_WORLD;
    if (n <= 4) return 1 * k;
    if (n <= 8) return 0.88 * k;
    if (n <= 10) return 0.78 * k;
    return 0.72 * k;
  },

  update(dt, targetX, targetY, moduleCount, bounds) {
    this._targetZoom = this.zoomForModuleCount(moduleCount || 0) *
      (1 - this.BOOST_PULL * (this.boostPull || 0));
    this.boostPull = Math.max(0, (this.boostPull || 0) - dt * this.BOOST_DECAY);

    // DEAD ZONE. The target only moves far enough to bring the player back
    // to the edge of the box, so inside it the target does not move at all.
    const half = this._halfExtent();
    const dzx = half.w * this.DEAD_ZONE;
    const dzy = half.h * this.DEAD_ZONE;
    const dx = targetX - this._tx;
    const dy = targetY - this._ty;
    if (dx > dzx) this._tx = targetX - dzx;
    else if (dx < -dzx) this._tx = targetX + dzx;
    if (dy > dzy) this._ty = targetY - dzy;
    else if (dy < -dzy) this._ty = targetY + dzy;

    // Exponential smoothing — identical feel at 30 and 60 FPS.
    const kPos = 1 - Math.exp(-6 * dt);
    const kZoom = 1 - Math.exp(-3 * dt);
    this.x += (this._tx - this.x) * kPos;
    this.y += (this._ty - this.y) * kPos;
    this.zoom += (this._targetZoom - this.zoom) * kZoom;

    this._shakeT = Math.max(0, this._shakeT - dt);
    if (this._shakeT === 0) this._shakeAmp = 0;

    if (bounds) this._clampToWorld(bounds);
  },

  // Half of the visible WORLD extent at the current zoom. With the ground
  // foreshortened, a screen pixel covers MORE world Y than it used to — a
  // squashed floor fits more of itself on screen — so the vertical half-extent
  // grows by 1/cos(pitch). Getting this wrong shows up as the camera clamping
  // early and leaving a strip of background above the arena wall.
  _halfExtent() {
    const s = (typeof Iso !== 'undefined' && Iso.groundProject)
      ? Iso.groundScale : 1;
    return {
      w: (Display.viewW / 2) / this.zoom,
      h: (Display.viewH / 2) / this.zoom / s,
    };
  },

  // Keep the view inside the WORLD bounds rect. Block 1 renamed this from
  // _clampToArena: the rect is now the district, not one room, but it was
  // already an arbitrary rect so nothing else had to change.
  //
  // The clamp corrects x/y AND the target, so a camera pinned against a world
  // edge does not accumulate an off-screen target it then has to unwind
  // before it will follow the player back inward.
  // PHASE A. THE CAMERA MAY SEE PAST THE EDGE.
  //
  // It used to clamp so that the view NEVER contained anything outside the
  // district, which meant the player could not see the world beyond the
  // boundary at all - so the terrain edge, the dust haze and the far
  // silhouettes were all invisible by construction, however well they were
  // drawn. The wall came down and the camera was still behaving like it was
  // in a room.
  //
  // Letting the view overhang is what turns the edge from `the level stops
  // here` into `you cannot see any further`, which is the entire point of
  // WORLD_FEEL items 1 and 5.
  OVERHANG: 0.42,          // fraction of the half-extent the view may spill

  _clampToWorld(a) {
    const half = this._halfExtent();
    const halfW = half.w * (1 - this.OVERHANG);
    const halfH = half.h * (1 - this.OVERHANG);

    if (a.w <= halfW * 2) this.x = a.x + a.w / 2;
    else this.x = Math.min(Math.max(this.x, a.x + halfW), a.x + a.w - halfW);

    if (a.h <= halfH * 2) this.y = a.y + a.h / 2;
    else this.y = Math.min(Math.max(this.y, a.y + halfH), a.y + a.h - halfH);

    this._tx = Math.min(Math.max(this._tx, this.x - halfW), this.x + halfW);
    this._ty = Math.min(Math.max(this._ty, this.y - halfH), this.y + halfH);
  },

  // How much the ground is squashed RIGHT NOW. 1 outside the world pass, so
  // anything drawn in UI space is unaffected. Sprites and text read this to
  // un-squash themselves — they stand up out of the floor, so the
  // foreshortening that is correct for the ground is wrong for them.
  yScale: 1,

  // Wrap world-space drawing: applies camera on top of the logical transform.
  begin(ctx) {
    ctx.save();
    ctx.translate(CONFIG.LOGICAL_W / 2, CONFIG.LOGICAL_H / 2);
    ctx.scale(this.zoom, this.zoom);

    // THE 44-DEGREE GROUND PLANE (Master v3.2 §5). A floor seen at this pitch
    // is foreshortened by cos(pitch), and that single scale is the whole
    // projection. Applying it HERE — once, in the camera — is what converts
    // every world draw call in the game without editing any of them.
    const s = (typeof Iso !== 'undefined' && Iso.groundProject)
      ? Iso.groundScale : 1;
    this.yScale = s;
    if (s !== 1) ctx.scale(1, s);

    const k = this._shakeDur > 0 ? this._shakeT / this._shakeDur : 0;
    const sx = (Math.random() * 2 - 1) * this._shakeAmp * k;
    const sy = (Math.random() * 2 - 1) * this._shakeAmp * k;
    ctx.translate(-this.x + sx, -this.y + sy);
  },

  end(ctx) { this.yScale = 1; ctx.restore(); },

  // Visible world rectangle (for culling / grid drawing).
  // Logical SCREEN point -> WORLD point. Anything that reads a cursor or a tap
  // as a place in the world has to come through here, because with the ground
  // pitched a screen pixel no longer covers one world unit of Y. Aiming with a
  // mouse was quietly wrong until this existed: the crosshair sat where the
  // pointer was but the shot went somewhere else.
  toWorld(sx, sy) {
    const s = (typeof Iso !== 'undefined' && Iso.groundProject)
      ? Iso.groundScale : 1;
    const z = this.zoom || 1;
    return {
      x: this.x + (sx - CONFIG.LOGICAL_W / 2) / z,
      y: this.y + (sy - CONFIG.LOGICAL_H / 2) / z / s,
    };
  },

  worldView() {
    const half = this._halfExtent();
    return { x: this.x - half.w, y: this.y - half.h,
             w: half.w * 2, h: half.h * 2 };
  },
};

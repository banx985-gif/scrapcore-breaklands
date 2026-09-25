// SCRAPCORE: BREAKLANDS — Main entry (Milestone 1)
// Boots Display, Input, Game; runs the requestAnimationFrame loop with
// clamped delta time and separate update/render calls.

const Main = {
  // §7: frame time, not just FPS. FPS is an average and hides the one long
  // frame a chunk build costs; the peak is what a stutter actually is.
  frameMs: 0,
  peakMs: 0,
  _peakT: 0,
  fps: 0,
  // ---- Performance (Milestone 22, plan §4.4) ----------------------------
  // LITE mode targets 30 FPS with thinner effects on cheaper phones. AUTO
  // watches real frame times and switches itself, because most players will
  // never open the Display settings.
  liteMode: false,
  targetFps: 60,
  autoPerf: true,
  _frameAcc: 0,
  _frameSamples: 0,
  _slowFrames: 0,
  _autoChecked: 0,
  _nextFrameAt: 0,
  _lastT: 0,
  _fpsAcc: 0,
  _fpsFrames: 0,

  start() {
    const canvas = document.getElementById('game-canvas');
    Display.init(canvas);
    R.init(Display.ctx);
    DebugKeys.init();
    Keys.init();
    if (typeof Pads !== 'undefined') Pads.init();
    // Temporary M3 test hotkeys. Removed when the camera is frozen.

    PointerHub.init(canvas, {
      down: (id, x, y) => Game.pointerDown(id, x, y),
      move: (id, x, y) => Game.pointerMove(id, x, y),
      up:   (id)       => Game.pointerUp(id),
    });

    // Art loads in the background: the game draws its own shapes until the
    // textures arrive, so nothing waits on a loading screen.
    Assets.init();

    Game.init();

    this._lastT = performance.now();
    requestAnimationFrame((t) => this._tick(t));
  },

  // Watch real frame times and drop to LITE if the device cannot hold up.
  // Only ever downgrades: flapping between modes mid-fight would be worse
  // than either mode.
  _autoPerfSample(dt) {
    if (!this.autoPerf || this.liteMode) return;
    if (dt > 0.001) {
      this._frameAcc += dt;
      this._frameSamples++;
      if (dt > 0.028) this._slowFrames++;      // slower than ~36 FPS
    }
    if (this._frameAcc < 4) return;            // judge on 4 seconds of play
    const slowFrac = this._slowFrames / Math.max(1, this._frameSamples);
    this._frameAcc = 0; this._frameSamples = 0; this._slowFrames = 0;
    this._autoChecked++;
    if (slowFrac > 0.35 && this._autoChecked >= 2) {
      this.liteMode = true;
      this.targetFps = 30;
      if (typeof Effects !== 'undefined') Effects.densityScale = 0.5;
      if (typeof Settings !== 'undefined') Settings.values.performance = 'LITE';
      // AND DROP THE PIXELS, which is the only one of these that moves the
      // number this sampler is reacting to. Measured: the draw is 98% of the
      // frame and 1.796 ms per megapixel, so halving particles on a machine
      // that is missing 36 fps was rearranging deck furniture. Skipped if the
      // player has chosen a fixed scale - a downgrade they did not ask for is
      // one thing, overriding a choice they DID make is another.
      if (typeof Display !== 'undefined' && Display.canvas && !Display.userScale) {
        Display.liteMode = true;
        Display.resize();
      }
    }
  },

  _tick(t) {
    // Frame limiter: in LITE we render at 30, which on a struggling phone is
    // far better than an unstable 40-something. Cheap early-out, no work done.
    if (this.targetFps && this.targetFps < 60) {
      const minGap = 1000 / this.targetFps - 1.5;   // small tolerance
      if (t < this._nextFrameAt) {
        requestAnimationFrame((n) => this._tick(n));
        return;
      }
      this._nextFrameAt = t + minGap;
    }

    let dt = (t - this._lastT) / 1000;
    this._lastT = t;
    this._autoPerfSample(dt);
    if (dt > CONFIG.MAX_DT) dt = CONFIG.MAX_DT;   // hitch clamp
    if (dt < 0) dt = 0;

    // FPS (updated twice a second)
    this._fpsAcc += dt;
    this._fpsFrames++;
    if (this._fpsAcc >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAcc;
      this._fpsAcc = 0;
      this._fpsFrames = 0;
    }

    // Hit-stop / slow motion: scale GAME time, never the real clock, so the
    // frame pacing and the FPS counter stay honest.
    const scale = (typeof Effects !== 'undefined' && Effects.timeScale)
      ? Effects.timeScale(dt) : 1;

    // §7 FRAME TIME. Measured around update+render only, not the whole rAF
    // interval, so it reports the work THIS game does rather than how long
    // the browser chose to wait. The peak decays over a few seconds: a
    // number that only ever climbs stops meaning anything after a minute.
    const w0 = performance.now();
    Game.update(dt * scale);

    Display.beginFrame();
    Game.render();
    this.frameMs = performance.now() - w0;
    if (this.frameMs > this.peakMs) { this.peakMs = this.frameMs; this._peakT = 0; }
    else {
      this._peakT += dt;
      if (this._peakT > 3) { this.peakMs = this.frameMs; this._peakT = 0; }
    }
    // Drawn LAST, over every state, so the readout is visible from the menus
    // as well as mid-fight.

    requestAnimationFrame((tt) => this._tick(tt));
  },
};

window.addEventListener('load', () => Main.start());

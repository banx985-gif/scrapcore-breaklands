// SCRAPCORE: BREAKLANDS — Settings (Milestone 16, plan §11)
// Only settings that ACTUALLY DO SOMETHING are listed. Anything the engine
// cannot honour yet (aim assist, audio volumes before M21) is marked pending so
// it is obvious what still needs wiring rather than shipping dead switches.

const SETTINGS_DEFS = {
  // ---- CONTROLS ----
  joystickSize:   { tab: 'CONTROLS', name: 'Joystick Size',   type: 'range', min: 80, max: 130, step: 10, def: 100, unit: '%' },
  buttonSize:     { tab: 'CONTROLS', name: 'Button Size',     type: 'range', min: 80, max: 130, step: 10, def: 100, unit: '%' },
  controlOpacity: { tab: 'CONTROLS', name: 'Control Opacity', type: 'range', min: 30, max: 100, step: 10, def: 100, unit: '%' },
  leftHanded:     { tab: 'CONTROLS', name: 'Left-handed Layout', type: 'toggle', def: false },
  haptics:        { tab: 'CONTROLS', name: 'Haptics',         type: 'toggle', def: true },
  aimAssist:      { tab: 'CONTROLS', name: 'Aim Assist',      type: 'toggle', def: true },

  // ---- DISPLAY ----
  performance:    { tab: 'DISPLAY', name: 'Performance', type: 'choice', options: ['AUTO', 'STANDARD', 'LITE'], def: 'AUTO' },
  // BLOCK 18. The Performance setting above adjusts particle density and the
  // frame target; the draw was then measured, and effects are a fraction of a
  // millisecond while FILL RATE is two thirds of it. This is the setting that
  // moves the number that matters. AUTO caps the backing store at
  // CONFIG.MAX_PIXELS - which is derived from the measurement, in config.js -
  // and the fixed choices are the player's to make, including on a 4K screen
  // with a real GPU where FULL is the right answer.
  renderScale:    { tab: 'DISPLAY', name: 'Render Scale', type: 'choice', options: ['AUTO', 'FULL', '85%', '70%', '50%'], def: 'AUTO' },
  screenShake:    { tab: 'DISPLAY', name: 'Screen Shake', type: 'range', min: 0, max: 100, step: 25, def: 100, unit: '%' },
  damageNumbers:  { tab: 'DISPLAY', name: 'Damage Numbers', type: 'toggle', def: true },
  comicWords:     { tab: 'DISPLAY', name: 'Comic Impact Words', type: 'toggle', def: true },
  vfxDensity:     { tab: 'DISPLAY', name: 'VFX Density', type: 'choice', options: ['LOW', 'NORMAL'], def: 'NORMAL' },
  // PLAYTEST 3 item 3: "rotates with facing OR stays north-up — a setting,
  // because people are religious about this." They are, and both camps are
  // right about their own heads, so it is a switch and not a decision.
  //
  // NORTH UP is the default because the compass strip (item 2) is already
  // heading-relative: with a rotating minimap as well, nothing on screen would
  // hold still, and a map whose north wanders is no longer a thing you can
  // remember a wall from hour two on.
  minimapMode:    { tab: 'DISPLAY', name: 'Minimap', type: 'choice', options: ['NORTH UP', 'ROTATE'], def: 'NORTH UP' },
  // CONTENT_AUDIO accessibility: "hostile machines get an ANGULAR
  // silhouette cue, player parts a ROUNDED one." NOT A FILTER - a
  // colourblind filter recolours the whole screen, which makes the world's
  // own palette of rust, ash and neon into a lie, and that palette is most
  // of what this game looks like. A shape costs one polygon and lies about
  // nothing. Shipped WITH the paint shop rather than in Block 18, because
  // the player who cannot separate the factions by colour is exactly the
  // player about to repaint their machine.
  shapeCues:      { tab: 'DISPLAY', name: 'Shape Cues (colourblind)', type: 'toggle', def: false },
  // M3, temporary and deliberately visible. The 44-degree camera is NOT frozen
  // yet, so both presentations ship side by side until Aaron picks one:
  //   FLAT   — the ground is not foreshortened (the build as it was)
  //   44 DEG — the floor recedes by cos(44), which is the real camera
  // ---- AUDIO (engine lands in M21) ----
  masterVolume:   { tab: 'AUDIO', name: 'Master Volume', type: 'range', min: 0, max: 100, step: 10, def: 80, unit: '%' },
  musicVolume:    { tab: 'AUDIO', name: 'Music Volume',  type: 'range', min: 0, max: 100, step: 10, def: 70, unit: '%' },
  sfxVolume:      { tab: 'AUDIO', name: 'SFX Volume',    type: 'range', min: 0, max: 100, step: 10, def: 90, unit: '%' },

  // ---- ACCESSIBILITY ----
  flashReduction: { tab: 'ACCESS', name: 'Flash Reduction', type: 'toggle', def: false },
  highContrast:   { tab: 'ACCESS', name: 'High Contrast Enemies', type: 'toggle', def: false },
  largeHud:       { tab: 'ACCESS', name: 'Large HUD', type: 'toggle', def: false },
};

const SETTINGS_TABS = ['CONTROLS', 'DISPLAY', 'AUDIO', 'ACCESS'];

const Settings = {
  values: {},

  // Fill in defaults WITHOUT touching other systems. Called at load time,
  // when the systems this pushes into may not exist yet.
  loadDefaults() {
    this.values = {};
    for (const k of Object.keys(SETTINGS_DEFS)) this.values[k] = SETTINGS_DEFS[k].def;
  },

  reset() {
    this.loadDefaults();
    this.apply();
  },

  get(k) {
    return this.values[k] !== undefined ? this.values[k] : SETTINGS_DEFS[k].def;
  },

  set(k, v) {
    this.values[k] = v;
    this.apply();
  },

  // Step a setting to its next value (every control is tap-to-cycle on mobile).
  cycle(k, dir = 1) {
    const d = SETTINGS_DEFS[k];
    if (!d) return;
    if (d.type === 'toggle') {
      this.values[k] = !this.get(k);
    } else if (d.type === 'choice') {
      const i = d.options.indexOf(this.get(k));
      this.values[k] = d.options[(i + dir + d.options.length) % d.options.length];
    } else {
      let v = this.get(k) + d.step * dir;
      if (v > d.max) v = d.min;
      if (v < d.min) v = d.max;
      this.values[k] = v;
    }
    this.apply();
  },

  display(k) {
    const d = SETTINGS_DEFS[k];
    const v = this.get(k);
    // Aim assist is not offered on the hardest tier: say so, rather than
    // showing a switch that silently does nothing.
    if (k === 'aimAssist' && typeof AimAssist !== 'undefined' &&
        !AimAssist.available()) return 'N/A ON OVERDRIVE';
    if (d.type === 'toggle') return v ? 'ON' : 'OFF';
    if (d.type === 'choice') return v;
    return v + (d.unit || '');
  },

  // Push values into the systems that read them.
  apply() {
    if (typeof CONFIG !== 'undefined') {
      const js = this.get('joystickSize') / 100;
      const bs = this.get('buttonSize') / 100;
      CONFIG.STICK.baseRadius = Math.round(130 * js);
      CONFIG.STICK.knobRadius = Math.round(52 * js);
      CONFIG.STICK.maxRadius = Math.round(120 * js);
      CONFIG.BUTTON.radius = Math.round(78 * bs);
      CONFIG.BUTTON.magnetRadius = Math.round(94 * bs);
      CONFIG.BUTTON.rotateRadius = Math.round(62 * bs);
      CONFIG.CONTROL_ALPHA = this.get('controlOpacity') / 100;
    }
    if (typeof Controls !== 'undefined' && Controls.layout) {
      Controls.dash.r = CONFIG.BUTTON.radius;
      Controls.magnet.r = CONFIG.BUTTON.magnetRadius;
      Controls.rotateL.r = CONFIG.BUTTON.rotateRadius;
      Controls.rotateR.r = CONFIG.BUTTON.rotateRadius;
      Controls.leftHanded = this.get('leftHanded');
      Controls.layout();
    }
    if (typeof Display !== 'undefined' && Display.resize) {
      const rs = this.get('renderScale');
      // 0 means AUTO: let the pixel cap decide. FULL means the device's own
      // ratio with no cap at all, which is why it is 1 and not "no cap" - the
      // cap is skipped by userScale being set at all.
      Display.userScale = rs === 'AUTO' ? 0
        : rs === 'FULL' ? 1 : parseInt(rs, 10) / 100;
      // Only if the canvas actually exists. apply() runs from Game.init and
      // from the menu; on a headless suite there is no canvas and resize()
      // would throw on a null.
      if (Display.canvas) Display.resize();
    }
    if (typeof Camera !== 'undefined') Camera.shakeScale = this.get('screenShake') / 100;
    if (typeof Effects !== 'undefined') {
      Effects.showDamageNumbers = this.get('damageNumbers');
      Effects.showComicWords = this.get('comicWords');
      Effects.densityScale = this.get('vfxDensity') === 'LOW' ? 0.5 : 1;
      Effects.flashReduction = this.get('flashReduction');
    }
    if (typeof Audio_ !== 'undefined' && Audio_.applyVolumes) Audio_.applyVolumes();
    if (typeof Main !== 'undefined') {
      const p = this.get('performance');
      Main.autoPerf = p === 'AUTO';
      if (p !== 'AUTO') {
        Main.liteMode = p === 'LITE';
        Main.targetFps = p === 'LITE' ? 30 : 60;
      }
      // LITE halves particle density on top of the VFX setting (plan §4.4).
      if (typeof Effects !== 'undefined') {
        const base = this.get('vfxDensity') === 'LOW' ? 0.5 : 1;
        Effects.densityScale = Main.liteMode ? base * 0.5 : base;
        Effects.liteMode = !!Main.liteMode;
      }
      // LITE lowers the pixel ceiling too, and it is settled AFTER the render
      // scale block above, so the resize is repeated here rather than left to
      // the next window event. Halving particles was never going to rescue a
      // frame that is 98% draw.
      if (typeof Display !== 'undefined' && Display.canvas) {
        const wasLite = Display.liteMode;
        Display.liteMode = !!Main.liteMode;
        if (wasLite !== Display.liteMode) Display.resize();
      }
    }
  },

  hapticsOn() { return this.get('haptics'); },
};

// A single guarded entry point so no system has to remember the setting check.
function buzz(pattern) {
  if (typeof Settings !== 'undefined' && !Settings.hapticsOn()) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

// Defaults only at load: apply() reaches into Effects/Camera/Controls, which
// are declared in later scripts and would still be in their temporal dead zone
// (a `typeof` guard does NOT save you from a TDZ const). Game.init() calls
// Settings.apply() once everything exists.
Settings.loadDefaults();

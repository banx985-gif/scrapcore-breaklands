// SCRAPCORE: BREAKLANDS — Keyboard + mouse (desktop / Steam build)
//
// The game is built for touch and that does not change. This layer WRITES INTO
// THE SAME `Controls` fields the thumb sticks write into, so nothing
// downstream — player, machine, magnet, game states — knows or cares which
// device is driving. Touch always wins while a finger is down.
//
// TWO WAYS TO AIM, and both are always live:
//
//   * the MOUSE, because that is what a twin-stick player expects on a desktop;
//   * the AIM KEYS (arrows by default), because a laptop without a mouse still
//     has to be playable, and because some players simply prefer it.
//
// A held aim key wins over the mouse for as long as it is held. Move is the
// left hand, aim is the right — the standard twin-stick keyboard layout.
const Keys = {
  // action -> array of accepted key codes (KeyboardEvent.code, so layout
  // independent — a French AZERTY keyboard should not need rebinding to move).
  DEFAULTS: {
    // MOVE on the left hand, AIM on the right — the standard twin-stick
    // keyboard layout. The arrows used to be a second set of MOVE keys; they
    // are the aim stick now, which is what makes the game playable on a laptop
    // with no mouse.
    up:      ['KeyW'],
    down:    ['KeyS'],
    left:    ['KeyA'],
    right:   ['KeyD'],
    aimUp:    ['ArrowUp'],
    aimDown:  ['ArrowDown'],
    aimLeft:  ['ArrowLeft'],
    aimRight: ['ArrowRight'],
    fire:    ['Mouse0', 'Space'],
    dash:    ['ShiftLeft', 'ShiftRight'],
    magnet:  ['Mouse2', 'KeyF'],
    special: ['KeyC', 'KeyV'],
    action: ['KeyE', 'KeyF'],      // Block 6/7: hook a tow, or the rig ability
    rotateL: ['KeyQ'],
    rotateR: ['KeyE', 'KeyR'],
    pause:   ['Escape', 'KeyP'],
  },
  ACTION_LIST: ['up', 'down', 'left', 'right',
                'aimUp', 'aimDown', 'aimLeft', 'aimRight',
                'fire', 'dash', 'magnet', 'special', 'action',
                'rotateL', 'rotateR', 'pause'],
  ACTION_NAME: {
    up: 'Move Up', down: 'Move Down', left: 'Move Left', right: 'Move Right',
    aimUp: 'Aim Up', aimDown: 'Aim Down', aimLeft: 'Aim Left',
    aimRight: 'Aim Right',
    fire: 'Fire', dash: 'Dash', magnet: 'Magnet', special: 'Special',
    action: 'Hook / Rig Ability',
    rotateL: 'Rotate Left', rotateR: 'Rotate Right', rotate: 'Rotate Rig',
    pause: 'Pause',
  },

  // The four aim keys, as a set — used by the aim code and by the tests that
  // check aim and movement cannot be driven by the same key.
  AIM_ACTIONS: ['aimUp', 'aimDown', 'aimLeft', 'aimRight'],

  bindings: null,
  held: {},          // code -> true
  mouse: { x: 960, y: 540, inside: false },
  active: false,     // has the player touched a key/mouse this session?
  _justPressed: {},  // action -> true for one frame
  _wasDown: {},

  init() {
    if (!this.bindings) this.bindings = this.defaults();
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (this._capture) { this._capture(e.code); e.preventDefault(); return; }
      this.held[e.code] = true;
      this.active = true;
      if (typeof Controls !== 'undefined' && Controls.setDevice) Controls.setDevice('kbm');
      // Space and arrows scroll the page in a browser build.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => { this.held[e.code] = false; });
    window.addEventListener('blur', () => { this.held = {}; });
    window.addEventListener('mousemove', (e) => {
      this.mouse.inside = true;
      if (typeof Display !== 'undefined' && Display.toLogical) {
        const p = Display.toLogical(e.clientX, e.clientY);
        this.mouse.x = p.x; this.mouse.y = p.y;
      }
    });
    window.addEventListener('mousedown', (e) => {
      if (this._capture) { this._capture('Mouse' + e.button); return; }
      this.held['Mouse' + e.button] = true; this.active = true;
      if (typeof Controls !== 'undefined' && Controls.setDevice) Controls.setDevice('kbm');
    });
    window.addEventListener('mouseup', (e) => { this.held['Mouse' + e.button] = false; });
    window.addEventListener('contextmenu', (e) => {
      // right-click is the Magnet by default; a context menu mid-fight is not
      if (this.isBound('magnet', 'Mouse2')) e.preventDefault();
    });
  },

  defaults() {
    const out = {};
    for (const a of this.ACTION_LIST) out[a] = this.DEFAULTS[a].slice();
    return out;
  },

  isBound(action, code) {
    return !!(this.bindings && this.bindings[action] &&
              this.bindings[action].indexOf(code) >= 0);
  },

  down(action) {
    const codes = (this.bindings && this.bindings[action]) || [];
    for (const c of codes) if (this.held[c]) return true;
    return false;
  },

  // Rebind: replaces the FIRST binding for an action and strips that code from
  // any other action, so a key can never drive two things at once.
  rebind(action, code) {
    if (!this.bindings[action] || !code) return false;
    for (const a of this.ACTION_LIST) {
      if (a === action) continue;
      this.bindings[a] = this.bindings[a].filter(c => c !== code);
      if (!this.bindings[a].length) this.bindings[a] = [];
    }
    this.bindings[action] = [code].concat(
      this.bindings[action].filter(c => c !== code).slice(0, 1));
    if (typeof Profile !== 'undefined') Profile.bindings = this.bindings;
    if (typeof Save !== 'undefined' && Save.save) Save.save();
    return true;
  },

  reset() {
    this.bindings = this.defaults();
    if (typeof Profile !== 'undefined') Profile.bindings = this.bindings;
    if (typeof Save !== 'undefined' && Save.save) Save.save();
  },

  // Called from Controls each frame, BEFORE gameplay reads the sticks.
  // Returns true if the keyboard/mouse supplied input this frame.
  apply(controls, player) {
    if (!this.bindings) this.bindings = this.defaults();
    let used = false;

    // --- movement: only if no finger owns the move stick ---
    if (controls.move.pointerId === null) {
      let x = 0, y = 0;
      if (this.down('left')) x -= 1;
      if (this.down('right')) x += 1;
      if (this.down('up')) y -= 1;
      if (this.down('down')) y += 1;
      if (x || y) {
        const l = Math.hypot(x, y) || 1;
        controls.move.dx = x / l; controls.move.dy = y / l; controls.move.mag = 1;
        used = true;
      } else if (this.active && !controls.move.active) {
        controls.move.mag = 0;
      }
    }

    // --- aim: KEYS FIRST, then the mouse ---
    // A held aim key beats the mouse, because a player using the arrows is
    // deliberately aiming and the mouse is probably sitting still somewhere
    // irrelevant. Releasing them hands aim straight back to the mouse.
    //
    // Holding an aim key also FIRES, which is what the aim stick does on touch
    // and what every twin-stick player expects. The separate Fire binding is
    // still there for firing along the mouse, or along the last held heading.
    let aimKeyed = false;
    if (controls.aim.pointerId === null) {
      let ax = 0, ay = 0;
      if (this.down('aimLeft')) ax -= 1;
      if (this.down('aimRight')) ax += 1;
      if (this.down('aimUp')) ay -= 1;
      if (this.down('aimDown')) ay += 1;
      if (ax || ay) {
        // Read in SCREEN space and converted to world, so pushing the aim keys
        // up points up the SCREEN even with the ground pitched (Master §5).
        const d = (typeof Iso !== 'undefined' && Iso.screenToWorldDir)
          ? Iso.screenToWorldDir(ax, ay) : { x: ax, y: ay };
        const l = Math.hypot(d.x, d.y) || 1;
        controls.aim.dx = d.x / l;
        controls.aim.dy = d.y / l;
        controls.aim.mag = 1;          // aiming with the keys fires
        aimKeyed = true;
        used = true;
      }
    }

    // --- aim: toward the mouse, in WORLD space ---
    if (!aimKeyed && controls.aim.pointerId === null && this.mouse.inside && player &&
        typeof Camera !== 'undefined') {
      // Through Camera.toWorld, not by hand: with the ground pitched a screen
      // pixel covers more world Y than it used to, so the old arithmetic aimed
      // short of the cursor.
      const w = Camera.toWorld ? Camera.toWorld(this.mouse.x, this.mouse.y)
        : { x: Camera.x + (this.mouse.x - 960) / (Camera.zoom || 1),
            y: Camera.y + (this.mouse.y - 540) / (Camera.zoom || 1) };
      const dx = w.x - player.x, dy = w.y - player.y;
      const l = Math.hypot(dx, dy);
      if (l > 1) {
        controls.aim.dx = dx / l; controls.aim.dy = dy / l;
        controls.aim.mag = this.down('fire') ? 1 : 0.001;  // aim without firing
        used = true;
      }
    }
    if (aimKeyed || this.down('fire')) { controls.keyFiring = true; used = true; }
    else controls.keyFiring = false;

    // --- buttons ---
    for (const a of ['dash', 'magnet', 'special', 'action', 'rotateL', 'rotateR']) {
      const isDown = this.down(a);
      this._justPressed[a] = isDown && !this._wasDown[a];
      this._wasDown[a] = isDown;
      if (isDown) used = true;
      const btn = controls[a];
      if (!btn) continue;
      if (isDown) { btn.pressed = true; if (this._justPressed[a]) btn.justPressed = true; }
      else if (btn.pointerId === undefined || btn.pointerId === null) {
        if (!btn.touchHeld) btn.pressed = false;
      }
    }
    return used;
  },
};

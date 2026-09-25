// SCRAPCORE: BREAKLANDS — Gamepad (Milestone 4)
//
// Same rule as the keyboard layer, because it is the rule that makes M4 work:
// this file WRITES INTO THE SAME `Controls` fields the thumb sticks write
// into. Nothing downstream — player, machine, magnet, game states — knows or
// cares which device is driving. Touch always wins while a finger is down,
// exactly as it does over the keyboard.
//
// STANDARD MAPPING ONLY. The Gamepad API's 'standard' layout covers Xbox,
// PlayStation and most generics; a pad that does not report it gets the same
// indices anyway, which is the least-wrong guess available. Per-button
// remapping is a Steam-build nicety that can arrive with M30 polish — the
// KEYBOARD bindings are what M4 requires to be remappable, and they are.
//
//   left stick   move
//   right stick  aim — pushing it past the fire threshold FIRES, which is
//                what the touch aim stick does and what twin-stick means
//   RT (7)       fire along the current aim (aim with the stick, hold RT)
//   LT (6)       MAGNET hold
//   A  (0)       DASH
//   LB (4)       TURN left
//   RB (5)       TURN right
//   Start (9)    pause
//
// POLLED, not event-driven, because that is how the Gamepad API works: the
// browser fires connect/disconnect events, but stick and button STATE only
// changes when you read getGamepads() again. Pads.apply() is called at the
// top of GameState.update, right beside Keys.apply — the same input-order
// lesson test_keyboard pins: gather input BEFORE anything reads justPressed.

const Pads = {
  DEADZONE: 0.22,       // sticks: below this the axis reads as centred
  FIRE_MAG: 0.5,        // right stick past this = firing (same as touch)
  TRIGGER: 0.35,        // triggers report 0..1; past this they are "held"

  connected: false,     // any pad seen since the last poll
  _wasDown: {},         // action -> held last frame (for justPressed edges)

  init() {
    // The events only maintain `connected` for the prompt switcher — state is
    // read fresh every frame regardless.
    window.addEventListener('gamepadconnected', () => { this.connected = true; });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = this._first() !== null;
      // A pad yanked mid-hold must not leave DASH pressed forever.
      if (!this.connected) this._releaseHeld();
    });
  },

  // The first pad that is actually reporting. getGamepads can contain nulls
  // and "ghost" entries with no buttons; skip those rather than reading them.
  _first() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    let pads;
    try { pads = navigator.getGamepads(); } catch (e) { return null; }
    for (const p of pads || []) {
      if (p && p.connected && p.buttons && p.buttons.length) return p;
    }
    return null;
  },

  _axis(v) {
    const a = Math.abs(v) < this.DEADZONE ? 0
      : (v - Math.sign(v) * this.DEADZONE) / (1 - this.DEADZONE);
    return Math.max(-1, Math.min(1, a));
  },

  _releaseHeld() {
    for (const a of ['dash', 'magnet', 'rotateL', 'rotateR']) {
      const btn = Controls[a];
      if (btn && btn.pointerId === null && !btn.touchHeld) btn.pressed = false;
      this._wasDown[a] = false;
    }
    if (Controls.padFiring) Controls.padFiring = false;
  },

  /**
   * Read the pad and write it into Controls. Called every frame at the top of
   * update, beside Keys.apply. Returns true if the pad did anything, so the
   * prompt switcher knows the player is on a controller.
   */
  apply(controls, player) {
    const p = this._first();
    if (!p) { if (this.connected) { this.connected = false; this._releaseHeld(); } return false; }
    this.connected = true;
    let used = false;

    // --- movement: only if no finger owns the move stick ---
    const mx = this._axis(p.axes[0] || 0);
    const my = this._axis(p.axes[1] || 0);
    if (controls.move.pointerId === null && (mx || my)) {
      const l = Math.hypot(mx, my);
      const m = Math.min(l, 1);
      controls.move.dx = mx / (l || 1);
      controls.move.dy = my / (l || 1);
      controls.move.mag = m;
      used = true;
    }

    // --- aim: right stick, in SCREEN space like the touch stick and the aim
    // keys, so pushing up aims up the screen with the ground pitched (§5) ---
    const ax = this._axis(p.axes[2] || 0);
    const ay = this._axis(p.axes[3] || 0);
    const trigger = (i) => {
      const b = p.buttons[i];
      return b ? (b.pressed || b.value > this.TRIGGER) : false;
    };
    let aiming = false;
    if (controls.aim.pointerId === null && (ax || ay)) {
      const d = (typeof Iso !== 'undefined' && Iso.screenToWorldDir)
        ? Iso.screenToWorldDir(ax, ay) : { x: ax, y: ay };
      const l = Math.hypot(d.x, d.y) || 1;
      const m = Math.min(Math.hypot(ax, ay), 1);
      controls.aim.dx = d.x / l;
      controls.aim.dy = d.y / l;
      // Past the threshold the stick fires, exactly like touch. Below it the
      // player is steering their aim without shooting — RT covers that.
      controls.aim.mag = m > this.FIRE_MAG ? 1 : 0.001;
      aiming = true;
      used = true;
    }
    const rt = trigger(7);
    if ((aiming && Math.hypot(ax, ay) > this.FIRE_MAG) || rt) {
      controls.padFiring = true; used = true;
    } else {
      controls.padFiring = false;
    }

    // --- buttons, through the same edge logic the keyboard uses ---
    // THE PAD, AGAINST CONTENT_CONTROLS_HUD PART 2.
    //
    // A and B were the wrong way round, and ACTION was on Y. The doc's table
    // is unambiguous — A is CONTEXT (hook a wreck, enter a garage, talk, pick
    // up, interact) and B is DASH — and A is where every player's thumb rests.
    // The most-used verb in the game was two buttons away from it and dash was
    // under it, which is the opposite of the intended shape: you would enter a
    // garage by reaching, and dash by resting.
    //
    // Kept from the old mapping: LB/RB stay ROTATE. The doc gives them to
    // gadgets 1 and 2, and gadget buttons do not exist yet — trading a verb
    // the game has for one it does not would be honouring a table over a
    // player. Noted in DECISIONS, and it is the one row of the table this
    // build knowingly diverges from.
    const DOWN = {
      action: p.buttons[0] && p.buttons[0].pressed,     // A — context
      dash: p.buttons[1] && p.buttons[1].pressed,       // B — dash
      special: p.buttons[2] && p.buttons[2].pressed,    // X — rig ability
      magnet: trigger(6),                               // LT — the signature verb
      rotateL: p.buttons[4] && p.buttons[4].pressed,    // LB
      rotateR: p.buttons[5] && p.buttons[5].pressed,    // RB
    };
    for (const a of ['dash', 'magnet', 'special', 'action', 'rotateL', 'rotateR']) {
      const isDown = !!DOWN[a];
      const just = isDown && !this._wasDown[a];
      this._wasDown[a] = isDown;
      if (isDown) used = true;
      const btn = controls[a];
      if (!btn) continue;
      if (isDown) { btn.pressed = true; if (just) btn.justPressed = true; }
      else if (btn.pointerId === null && !btn.touchHeld) {
        // Only release what nothing else is holding — a finger on MAGNET must
        // survive the pad letting go, and vice versa.
        if (!(typeof Keys !== 'undefined' && Keys.down && Keys.down(a))) btn.pressed = false;
      }
    }

    // --- BACK OPENS THE MAP ------------------------------------------------
    // "In a world twenty minutes wide, the map is not a menu - it's a tool used
    // constantly, and it must never be two presses deep." It was two presses
    // deep: pause, then MAP. Back had no binding at all.
    const backDown = p.buttons[8] && p.buttons[8].pressed;
    if (backDown && !this._wasDown.back) { this.mapPressed = true; used = true; }
    this._wasDown.back = backDown;

    // --- D-PAD DOWN DROPS THE TOW -----------------------------------------
    // "and nothing else, because dropping a tow by accident in a fight is the
    // worst thing that can happen to a salvage run. It gets a dedicated
    // direction on a control the thumb has to leave the stick to reach."
    const dropDown = p.buttons[13] && p.buttons[13].pressed;
    if (dropDown && !this._wasDown.drop) { this.dropPressed = true; used = true; }
    this._wasDown.drop = dropDown;

    // --- pause: an edge, handed to Game the same way Escape is ---
    const startDown = p.buttons[9] && p.buttons[9].pressed;
    if (startDown && !this._wasDown.pause) {
      this.pausePressed = true;         // consumed by GameState.update
      used = true;
    }
    this._wasDown.pause = startDown;

    return used;
  },
};

// ---------------------------------------------------------------------------
// UINav — drives a UIButtons overlay from the pad and the keyboard.
//
// Found on a real controller, first session: the rank-up cards and the pause
// menu appeared and the pad could do nothing — every overlay was
// pointer-only. This walks the focus with the d-pad, the left stick or the
// arrow keys, and confirms with A, Enter or Space. It reads devices directly
// (not through Controls) because it runs in states where gameplay input is
// deliberately frozen.
const UINav = {
  _was: {},

  update(buttons) {
    if (!buttons || !buttons.items || !buttons.items.length) return false;

    const p = (typeof Pads !== 'undefined') ? Pads._first() : null;
    const key = (c) => typeof Keys !== 'undefined' && Keys.held && !!Keys.held[c];
    const btn = (i) => !!(p && p.buttons[i] && p.buttons[i].pressed);
    const ax = p ? (p.axes[0] || 0) : 0;
    const ay = p ? (p.axes[1] || 0) : 0;

    const now = {
      left:  btn(14) || ax < -0.5 || key('ArrowLeft'),
      right: btn(15) || ax >  0.5 || key('ArrowRight'),
      up:    btn(12) || ay < -0.5 || key('ArrowUp'),
      down:  btn(13) || ay >  0.5 || key('ArrowDown'),
      ok:    btn(0) || key('Enter') || key('NumpadEnter') || key('Space'),
    };
    let used = false;
    const edge = (k) => { const e = now[k] && !this._was[k]; return e; };

    if (edge('left'))  { buttons.moveFocus(-1, 0); used = true; }
    if (edge('right')) { buttons.moveFocus(1, 0);  used = true; }
    if (edge('up'))    { buttons.moveFocus(0, -1); used = true; }
    if (edge('down'))  { buttons.moveFocus(0, 1);  used = true; }
    if (edge('ok') && buttons.focus >= 0) { buttons.activateFocus(); used = true; }

    this._was = now;
    if (used && typeof Controls !== 'undefined' && Controls.setDevice && p) {
      // Only claim 'pad' when a pad actually did it — arrows are kbm.
      if (btn(0) || btn(12) || btn(13) || btn(14) || btn(15)
          || Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5) Controls.setDevice('pad');
    }
    return used;
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = Pads;
if (typeof module !== 'undefined' && module.exports) module.exports.UINav = UINav;

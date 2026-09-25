// SCRAPCORE: BREAKLANDS — Input (Milestone 3)
// Two layers:
//   PointerHub  — raw multi-touch via Pointer Events, per-pointer IDs,
//                 converts to logical coords, forwards to the Game.
//   Controls    — virtual twin sticks + Dash/Magnet buttons. Each control
//                 is claimed by exactly one pointer ID; losing one finger
//                 never disturbs another.

const PointerHub = {
  init(canvas, handlers) {
    this.handlers = handlers; // { down(id,x,y), move(id,x,y), up(id) }

    const down = (e) => {
      e.preventDefault();
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      // PROMPT SWITCHING (M4): a real finger flips the game back to touch
      // prompts. A mouse click does not — the mouse belongs to keyboard+mouse.
      if (e.pointerType === 'touch') Controls.setDevice('touch');
      const p = Display.toLogical(e.clientX, e.clientY);
      this.handlers.down(e.pointerId, p.x, p.y);
    };
    const move = (e) => {
      e.preventDefault();
      const p = Display.toLogical(e.clientX, e.clientY);
      this.handlers.move(e.pointerId, p.x, p.y);
    };
    const up = (e) => {
      e.preventDefault();
      this.handlers.up(e.pointerId);
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },
};

// ---------------------------------------------------------------------------

function makeStick() {
  return {
    pointerId: null,   // owning pointer, or null
    originX: 0, originY: 0,  // where the base sits (floating: touch point)
    dx: 0, dy: 0,      // normalized direction (unit vector) after dead zone
    mag: 0,            // 0..1 strength after dead zone
    rawX: 0, rawY: 0,  // knob offset from origin, clamped (for drawing)
    active: false,
  };
}

const Controls = {
  move: makeStick(),
  aim: makeStick(),

  // ---- which device is driving (M4 prompt switching) --------------------
  // 'touch' | 'kbm' | 'pad'. The LAST device that produced input owns the
  // prompts: the touch overlay is only drawn for touch, and the pad hides the
  // mouse cursor. Every layer reports through setDevice, so the rule lives in
  // exactly one place.
  device: 'touch',
  setDevice(d) {
    if (this.device === d) return;
    this.device = d;
    // The cursor belongs to the mouse. On a pad it is clutter sitting in the
    // middle of the fight; on touch it does not exist. Restored the moment
    // the mouse moves again, because that sets 'kbm' right back.
    if (typeof document !== 'undefined') {
      const cv = document.getElementById && document.getElementById('game-canvas');
      if (cv && cv.style) cv.style.cursor = (d === 'pad') ? 'none' : '';
    }
  },
  dash:   { pointerId: null, pressed: false, justPressed: false, x: 0, y: 0, r: CONFIG.BUTTON.radius },
  magnet: { pointerId: null, pressed: false, justPressed: false, x: 0, y: 0, r: CONFIG.BUTTON.magnetRadius },
  rotateL: { pointerId: null, pressed: false, justPressed: false, x: 0, y: 0, r: CONFIG.BUTTON.rotateRadius },
  rotateR: { pointerId: null, pressed: false, justPressed: false, x: 0, y: 0, r: CONFIG.BUTTON.rotateRadius },
  // SPECIAL (M12): fires the Core Charge Special. Same touch-button shape as
  // DASH so every routing/edge rule already applies to it.
  special: { pointerId: null, pressed: false, justPressed: false, x: 0, y: 0, r: CONFIG.BUTTON.radius },
  // BLOCK 6/7. ONE shared, context-sensitive action: hook or unhook a tow,
  // else the current rig's ability. Bound once, here, so every rig added
  // later inherits it without touching input.
  action: { pointerId: null, pressed: false, justPressed: false, x: 0, y: 0, r: CONFIG.BUTTON.radius },

  // Home (resting) positions for fixed mode / idle hints — set by layout()
  moveHome: { x: 0, y: 0 },
  aimHome:  { x: 0, y: 0 },

  // Recompute control anchor positions from the current safe rect.
  layout() {
    const s = Display.safe;
    const ST = CONFIG.STICK, BT = CONFIG.BUTTON;
    // Each stick rests in the MIDDLE of its own half. Derived from the safe
    // rect rather than a fixed corner offset, so it stays centred on a narrow
    // 16:9 screen and a very wide 21:9 one alike.
    const halfW = (s.right - s.left) / 2;
    this.moveHome.x = s.left + halfW / 2;
    this.moveHome.y = s.bottom - ST.homeOffsetY;
    this.aimHome.x = s.right - halfW / 2;
    this.aimHome.y = s.bottom - ST.homeOffsetY;
    // DASH and MAGNET on the RIGHT (aim thumb), ROTATE pair on the LEFT.
    this.dash.x = s.right - BT.dashX;
    this.dash.y = s.bottom - BT.dashY;
    this.magnet.x = s.right - BT.magnetX;
    this.magnet.y = s.bottom - BT.magnetY;
    // SPECIAL sits above DASH on the aim thumb's arc.
    this.special.x = s.right - BT.dashX - 30;
    this.special.y = s.bottom - BT.dashY - 170;
    this.action.x = s.right - BT.dashX - 190;
    this.action.y = s.bottom - BT.dashY - 60;
    // TURN sits directly ABOVE the resting move stick, centred on it. Derived
    // from moveHome rather than from a corner, because the stick rests at the
    // middle of its half and that moves with the screen width.
    this.rotateL.x = this.moveHome.x - BT.rotateSpread / 2;
    this.rotateR.x = this.moveHome.x + BT.rotateSpread / 2;
    this.rotateL.y = s.bottom - BT.rotateAboveY;
    this.rotateR.y = this.rotateL.y;
  },

  // ---- pointer routing (called by Game when gameplay is active) ----

  // Returns true if the touch was consumed by a control.
  claim(id, x, y) {
    // Buttons win over sticks.
    if (this._hitButton(this.dash, id, x, y)) return true;
    if (this._hitButton(this.magnet, id, x, y)) return true;
    if (this._hitButton(this.special, id, x, y)) return true;
    if (this._hitButton(this.action, id, x, y)) return true;
    if (this._hitButton(this.rotateL, id, x, y)) return true;
    if (this._hitButton(this.rotateR, id, x, y)) return true;

    const leftSide = x < CONFIG.LOGICAL_W / 2;
    const stick = leftSide ? this.move : this.aim;
    if (stick.pointerId !== null) return false; // region's stick already owned

    const floating = leftSide ? CONFIG.STICK.floatingLeft : CONFIG.STICK.floatingRight;
    const home = leftSide ? this.moveHome : this.aimHome;

    if (floating) {
      stick.originX = x; stick.originY = y;
    } else {
      // Fixed mode: must touch near the base to grab it.
      const d = Math.hypot(x - home.x, y - home.y);
      if (d > CONFIG.STICK.baseRadius * 1.6) return false;
      stick.originX = home.x; stick.originY = home.y;
    }
    stick.pointerId = id;
    stick.active = true;
    this._updateStick(stick, x, y);
    return true;
  },

  moved(id, x, y) {
    if (this.move.pointerId === id) this._updateStick(this.move, x, y);
    else if (this.aim.pointerId === id) this._updateStick(this.aim, x, y);
  },

  released(id) {
    if (this.move.pointerId === id) this._resetStick(this.move);
    if (this.aim.pointerId === id) this._resetStick(this.aim);
    if (this.dash.pointerId === id) { this.dash.pointerId = null; this.dash.pressed = false; }
    if (this.magnet.pointerId === id) { this.magnet.pointerId = null; this.magnet.pressed = false; }
    if (this.special.pointerId === id) { this.special.pointerId = null; this.special.pressed = false; }
    if (this.action.pointerId === id) { this.action.pointerId = null; this.action.pressed = false; }
    if (this.rotateL.pointerId === id) { this.rotateL.pointerId = null; this.rotateL.pressed = false; }
    if (this.rotateR.pointerId === id) { this.rotateR.pointerId = null; this.rotateR.pressed = false; }
  },

  releaseAll() {
    this._resetStick(this.move);
    this._resetStick(this.aim);
    this.dash.pointerId = null; this.dash.pressed = false;
    this.magnet.pointerId = null; this.magnet.pressed = false;
    this.special.pointerId = null; this.special.pressed = false;
    this.action.pointerId = null; this.action.pressed = false;
    this.rotateL.pointerId = null; this.rotateL.pressed = false;
    this.rotateR.pointerId = null; this.rotateR.pressed = false;
  },

  // Call once per frame AFTER the game consumed justPressed flags.
  endFrame() {
    this.dash.justPressed = false;
    this.magnet.justPressed = false;
    this.action.justPressed = false;
    this.special.justPressed = false;   // was missing — a stale true made
    this.rotateL.justPressed = false;   // SPECIAL misfire or read as dead
    this.rotateR.justPressed = false;
  },

  get firing() {
    // A finger on the aim stick is the old rule, untouched: touching it fires.
    if (this.aim.pointerId !== null) return this.aim.mag > 0;
    // Keyboard and pad share a gate: aim can be held below the fire threshold
    // (mouse aiming, or steering the right stick gently) without shooting,
    // and the explicit fire inputs override it.
    const kb = typeof Keys !== 'undefined' && Keys.active && this.keyFiring !== undefined;
    const pad = typeof Pads !== 'undefined' && Pads.connected;
    if (kb || pad) {
      return this.aim.mag > 0.5 || this.keyFiring === true || this.padFiring === true;
    }
    return this.aim.mag > 0;
  },

  // ---- internals ----

  _hitButton(btn, id, x, y) {
    if (btn.pointerId !== null) return false;
    if (Math.hypot(x - btn.x, y - btn.y) > btn.r * 1.25) return false; // fat finger margin
    btn.pointerId = id;
    btn.pressed = true;
    btn.justPressed = true;
    return true;
  },

  _updateStick(st, x, y) {
    const R = CONFIG.STICK.maxRadius;
    let ox = x - st.originX, oy = y - st.originY;
    let len = Math.hypot(ox, oy);
    if (len > R) {
      const pull = 1 - R / len;
      st.originX += ox * pull;          // drag the base along behind the thumb
      st.originY += oy * pull;
      ox = ox / len * R; oy = oy / len * R;
      len = R;
    }
    st.rawX = ox; st.rawY = oy;

    const dead = CONFIG.STICK.deadZone;
    const frac = Math.min(len / R, 1);
    if (frac <= dead) {
      st.dx = 0; st.dy = 0; st.mag = 0;
      return;
    }
    st.mag = (frac - dead) / (1 - dead);
    st.dx = ox / (len || 1);
    st.dy = oy / (len || 1);
  },

  _resetStick(st) {
    st.pointerId = null;
    st.active = false;
    st.dx = 0; st.dy = 0; st.mag = 0; st.rawX = 0; st.rawY = 0;
  },
};

// ---------------------------------------------------------------------------
// Desktop debug fallback: WASD to move, mouse handled by Pointer Events.
const DebugKeys = {
  x: 0, y: 0,
  init() {
    const map = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0] };
    const held = {};
    const recompute = () => {
      let x = 0, y = 0;
      for (const k in held) if (held[k] && map[k]) { x += map[k][0]; y += map[k][1]; }
      const len = Math.hypot(x, y) || 1;
      this.x = x / len * (x || y ? 1 : 0);
      this.y = y / len * (x || y ? 1 : 0);
    };
    window.addEventListener('keydown', (e) => { held[e.key.toLowerCase()] = true; recompute(); });
    window.addEventListener('keyup', (e) => { held[e.key.toLowerCase()] = false; recompute(); });
  },
};

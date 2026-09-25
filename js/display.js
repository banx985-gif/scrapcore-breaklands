// SCRAPCORE: BREAKLANDS — Display (Milestone 2)
// Owns: canvas sizing, devicePixelRatio, logical<->screen mapping,
// safe-area insets, orientation state, resize handling.
//
// Mapping rule: fit-min scale. The full 1920x1080 logical frame is always
// visible; wider/taller screens see EXTRA logical space (viewW/viewH grow).
// Nothing is ever stretched — circles stay circular on every aspect ratio.

// Packaging helpers (Milestone 24). Browsers only allow fullscreen and an
// orientation lock from a user gesture, so these are called from the first
// touch rather than at load.
const Fullscreen = {
  tried: false,

  request() {
    if (this.tried) return;
    this.tried = true;
    try {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen ||
        el.mozRequestFullScreen || el.msRequestFullscreen;
      if (fn) {
        const p = fn.call(el, { navigationUI: 'hide' });
        if (p && p.then) p.then(() => this.lock()).catch(() => {});
        else this.lock();
      } else {
        this.lock();
      }
    } catch (e) { /* fullscreen is a nicety, never a requirement */ }
  },

  lock() {
    try {
      const so = screen && screen.orientation;
      if (so && so.lock) so.lock('landscape').catch(() => {});
    } catch (e) { /* unsupported on iOS Safari — the rotate overlay covers it */ }
  },
};

const Display = {
  canvas: null,
  ctx: null,

  cssW: 0, cssH: 0,      // canvas size in CSS pixels
  dpr: 1,
  scale: 1,               // CSS px per logical unit
  viewW: CONFIG.LOGICAL_W, // visible logical width  (>= 1920 on wide screens)
  viewH: CONFIG.LOGICAL_H, // visible logical height (>= 1080 on tall screens)
  originX: 0, originY: 0,  // logical coord of the screen's top-left corner

  // Safe rect in LOGICAL units (already inset by device cutouts/nav bars)
  safe: { left: 0, top: 0, right: CONFIG.LOGICAL_W, bottom: CONFIG.LOGICAL_H },

  isPortrait: false,
  // 1 until a cap bites. Read by the debug overlay and by Settings, which is
  // the only thing that writes userScale (0 = AUTO, else a fixed fraction).
  renderScale: 1,
  userScale: 0,
  liteMode: false,
  _probe: null,
  _listeners: [],

  // The ceiling in force. LITE is a harder cap rather than a different
  // mechanism, so there is one number to reason about and not two systems.
  pixelCap() {
    return this.liteMode ? CONFIG.MAX_PIXELS_LITE : CONFIG.MAX_PIXELS;
  },

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._probe = document.getElementById('safe-area-probe');

    const onChange = () => this.resize();
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onChange);
    }
    this.resize();
  },

  onResize(fn) { this._listeners.push(fn); },

  resize() {
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.isPortrait = this.cssH > this.cssW;

    // RENDER SCALE, AND WHY IT IS A PIXEL COUNT AND NOT A RATIO.
    // beginFrame's transform is dpr * scale and toLogical uses only scale, so
    // lowering dpr below the device's own is a pure render scale: every
    // logical coordinate, every hit test and every layout is untouched, and
    // the canvas is stretched back to its CSS box by the browser. That makes
    // this the whole of the change.
    //
    // The reasoning behind MAX_PIXELS, with the measurements, is in config.js.
    // Short version: the draw is fill rate, so the thing to cap is pixels.
    this.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.DPR_CAP);
    const want = this.cssW * this.cssH * this.dpr * this.dpr;
    const cap = this.pixelCap();
    // AUTO only. An explicit choice is the player's, including a bad one:
    // somebody with a 4K screen and a real GPU is entitled to all of it.
    this.renderScale = (cap > 0 && want > cap) ? Math.sqrt(cap / want) : 1;
    if (this.userScale > 0) this.renderScale = this.userScale;
    this.dpr *= this.renderScale;
    // At least one pixel each way. A zero-width canvas throws on getContext
    // operations rather than drawing nothing, and a window can be dragged to
    // nothing on Windows.
    this.canvas.width = Math.max(1, Math.round(this.cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.cssH * this.dpr));

    // Fit-min: entire logical frame always fits; extra space extends the view.
    this.scale = Math.min(this.cssW / CONFIG.LOGICAL_W, this.cssH / CONFIG.LOGICAL_H);
    if (this.scale <= 0 || !isFinite(this.scale)) this.scale = 1;

    this.viewW = this.cssW / this.scale;
    this.viewH = this.cssH / this.scale;

    // Keep the logical centre (960, 540) at the screen centre.
    this.originX = CONFIG.LOGICAL_W / 2 - this.viewW / 2;
    this.originY = CONFIG.LOGICAL_H / 2 - this.viewH / 2;

    this._readSafeArea();
    for (const fn of this._listeners) fn();
  },

  _readSafeArea() {
    let t = 0, r = 0, b = 0, l = 0;
    if (this._probe) {
      const cs = getComputedStyle(this._probe);
      t = parseFloat(cs.paddingTop) || 0;
      r = parseFloat(cs.paddingRight) || 0;
      b = parseFloat(cs.paddingBottom) || 0;
      l = parseFloat(cs.paddingLeft) || 0;
    }
    // Convert CSS px insets -> logical units, anchored to the visible view.
    this.safe.left   = this.originX + l / this.scale;
    this.safe.top    = this.originY + t / this.scale;
    this.safe.right  = this.originX + this.viewW - r / this.scale;
    this.safe.bottom = this.originY + this.viewH - b / this.scale;
  },

  // Screen (CSS px, e.g. pointer event clientX/Y) -> logical coords
  toLogical(px, py) {
    return {
      x: this.originX + px / this.scale,
      y: this.originY + py / this.scale,
    };
  },

  // Apply the logical transform for this frame's rendering.
  beginFrame() {
    const s = this.dpr * this.scale;
    this.ctx.setTransform(s, 0, 0, s, -this.originX * s, -this.originY * s);
  },

  // Visible logical rectangle (can be larger than 1920x1080).
  viewRect() {
    return { x: this.originX, y: this.originY, w: this.viewW, h: this.viewH };
  },
};

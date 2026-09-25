// SCRAPCORE: BREAKLANDS — Renderer helpers (Milestone 1)
// Small drawing utilities in the game's comic style: bold fills,
// thick black outlines, chunky text. All coords are logical units.

const R = {
  ctx: null,
  init(ctx) { this.ctx = ctx; },

  clear(color) {
    const v = Display.viewRect();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(v.x - 4, v.y - 4, v.w + 8, v.h + 8);
  },

  circle(x, y, r, fill, stroke, lw) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 6; c.stroke(); }
  },

  rect(x, y, w, h, fill, stroke, lw) {
    const c = this.ctx;
    if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 6; c.strokeRect(x, y, w, h); }
  },

  roundRect(x, y, w, h, rad, fill, stroke, lw) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 6; c.stroke(); }
  },

  // Chunky comic text: black offset shadow + fill.
  // The largest size at or below `size` at which `str` fits in `maxW`, for
  // the font text() actually draws in. Never grows the text, only shrinks it,
  // so a short label looks exactly as it did before.
  fitText(str, size, maxW) {
    if (!str || !(maxW > 0)) return size;
    const c = this.ctx;
    const prev = c.font;
    c.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    const w = c.measureText(str).width;
    c.font = prev;
    if (w <= maxW) return size;
    return Math.max(11, Math.floor(size * maxW / w));
  },

  text(str, x, y, size, color, align, shadow) {
    const c = this.ctx;
    // Text drawn in WORLD space — floating damage numbers, "NO POWER", boss
    // barks — would be squashed flat by the ground projection. Text faces the
    // camera; it does not lie on the floor. Camera.yScale is 1 outside the
    // world pass, so every HUD and menu string is untouched by this.
    const ys = (typeof Camera !== 'undefined') ? Camera.yScale : 1;
    const squashed = ys !== 1;
    if (squashed) { c.save(); c.translate(x, y); c.scale(1, 1 / ys); x = 0; y = 0; }

    c.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    c.textAlign = align || 'center';
    c.textBaseline = 'middle';
    if (shadow !== false) {
      c.fillStyle = CONFIG.COLOR.ink;
      c.fillText(str, x + size * 0.06, y + size * 0.06);
    }
    c.fillStyle = color;
    c.fillText(str, x, y);

    if (squashed) c.restore();
  },

  // Break a string into lines that fit maxW, measured in the SAME font
  // text() will draw it in — guessing by character count overflows the moment
  // a string has wide glyphs. Returns an array of lines; a single word longer
  // than maxW is left alone rather than chopped mid-word.
  wrapText(str, maxW, size, mono) {
    const c = this.ctx;
    c.font = mono ? `${size}px monospace`
                  : `900 ${size}px "Arial Black", Arial, sans-serif`;
    const words = String(str).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const trial = line ? line + ' ' + w : w;
      if (line && c.measureText(trial).width > maxW) { lines.push(line); line = w; }
      else line = trial;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  },

  // A mechanical plate instead of a plain rounded rectangle: corners are CUT
  // (chamfered) like a bolted-on panel, with bolt heads in the corners and a
  // notch cut into the top and bottom edges. Colour is passed straight
  // through, so every existing button keeps its palette.
  mechPlate(x, y, w, h, fill, stroke, lw, opts) {
    const c = this.ctx;
    const o = opts || {};
    const cut = Math.max(8, Math.min(26, Math.min(w, h) * 0.18));
    const notch = (w > 260 && h > 100) ? Math.min(w * 0.12, 38) : 0;
    const dip = Math.min(9, h * 0.07);
    c.beginPath();
    c.moveTo(x + cut, y);
    c.lineTo(x + w / 2 - notch, y);
    c.lineTo(x + w / 2 - notch * 0.55, y + dip);
    c.lineTo(x + w / 2 + notch * 0.55, y + dip);
    c.lineTo(x + w / 2 + notch, y);
    c.lineTo(x + w - cut, y);
    c.lineTo(x + w, y + cut);
    c.lineTo(x + w, y + h - cut);
    c.lineTo(x + w - cut, y + h);
    c.lineTo(x + w / 2 + notch, y + h);
    c.lineTo(x + w / 2 + notch * 0.55, y + h - dip);
    c.lineTo(x + w / 2 - notch * 0.55, y + h - dip);
    c.lineTo(x + w / 2 - notch, y + h);
    c.lineTo(x + cut, y + h);
    c.lineTo(x, y + h - cut);
    c.lineTo(x, y + cut);
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 6; c.stroke(); }
    if (o.bolts !== false && Math.min(w, h) > 54) {
      const bx = cut * 0.92, r = Math.max(3, Math.min(6, cut * 0.26));
      c.fillStyle = o.bolt || 'rgba(0,0,0,0.5)';
      for (const [px, py] of [[x + bx, y + bx], [x + w - bx, y + bx],
                              [x + bx, y + h - bx], [x + w - bx, y + h - bx]]) {
        c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
      }
    }
  },

  // `shadow` is opt-in, unlike R.text's: a small monospace string with an
  // ink offset under it is for the few HUD lines that sit on the WORLD and
  // must read on any floor -- "CARRYING NOTHING" was 1.88:1 on Central
  // Dispatch's white ground (D338). Panel strings stay as they were.
  smallText(str, x, y, size, color, align, shadow) {
    const c = this.ctx;
    c.font = `${size}px monospace`;
    c.textAlign = align || 'left';
    c.textBaseline = 'top';
    if (shadow === true) {
      c.fillStyle = CONFIG.COLOR.ink;
      const o = Math.max(1.5, size * 0.08);
      c.fillText(str, x + o, y + o);
    }
    c.fillStyle = color;
    c.fillText(str, x, y);
  },
};

// ---------------------------------------------------------------------------
// Simple tappable UI button list used by menu-style states.
class UIButtons {
  constructor() { this.items = []; this.focus = -1; }

  add(label, x, y, w, h, cb, opts = {}) {
    this.items.push({ label, x, y, w, h, cb, color: opts.color || CONFIG.COLOR.yellow,
      textColor: opts.textColor || CONFIG.COLOR.ink, size: opts.size || 44, pressed: false,
      // PLAYTEST 2, ITEM 4. A QUIET BUTTON.
      //
      // Every button in this game is a bolted steel plate with a hard ink
      // drop-shadow, which is right for a screen where everything is a
      // choice and wrong for a screen with ONE. Aaron's note on the menu
      // was "meh", and a wall of equally loud plates is most of why: if
      // eight things shout, nothing is the primary action.
      //
      // A quiet button is a flat panel with a hairline edge. It is still
      // obviously pressable, it just stops competing with the one plate
      // that matters. Nothing else about it changes, so pad focus, hit
      // testing and the press offset all behave identically.
      quiet: !!opts.quiet,
      sub: opts.sub || null,
      // WHAT THE BUTTON IS FOR, as opposed to what it currently says.
      //
      // Three suites went red on item 4's menu pass for one reason: they
      // found the way into the world by matching the string
      // 'ENTER THE IRONWORKS'. That is copy. Renaming the button to name
      // the district you would actually resume into broke every one of
      // them, and not one of the guarantees they exist to defend had
      // changed. A role is the handle that survives a copy edit.
      role: opts.role || null });
  }

  clear() { this.items = []; this.focus = -1; }

  // ---- pad / keyboard navigation (M4 follow-up) --------------------------
  // Found on a real controller: Start opened the pause menu and the rank
  // cards came up, and the pad could do nothing but stare at them — every
  // overlay was pointer-only. The cursor starts HIDDEN (-1) so touch and
  // mouse players never see a phantom highlight; the first nav input reveals
  // it on the first button.
  moveFocus(dx, dy) {
    if (!this.items.length) return;
    if (this.focus < 0 || !this.items[this.focus]) { this.focus = 0; return; }
    const cur = this.items[this.focus];
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    let best = -1, bestScore = Infinity;
    this.items.forEach((b, i) => {
      if (i === this.focus) return;
      const bx = b.x + b.w / 2 - cx, by = b.y + b.h / 2 - cy;
      const along = bx * dx + by * dy;          // progress in the asked direction
      if (along <= 1) return;                   // behind or beside us
      const off = Math.abs(bx * dy) + Math.abs(by * dx);  // sideways drift
      const score = along + off * 2;            // prefer straight-ahead
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { this.focus = best; return; }
    // Nothing that way: WRAP to the far end, so a row of cards cycles.
    let far = -1, farD = -Infinity;
    this.items.forEach((b, i) => {
      const d = -((b.x + b.w / 2) * dx + (b.y + b.h / 2) * dy);
      if (d > farD) { farD = d; far = i; }
    });
    if (far >= 0) this.focus = far;
  }

  activateFocus() {
    const b = this.items[this.focus];
    if (!b) return false;
    b.pressed = true;
    setTimeout(() => { b.pressed = false; }, 120);
    if (typeof Audio_ !== 'undefined') Audio_.play('uiTap');
    b.cb();
    return true;
  }

  // Returns true if a button consumed the touch.
  hit(x, y) {
    for (const b of this.items) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        b.pressed = true;
        setTimeout(() => { b.pressed = false; }, 120);
        if (typeof Audio_ !== 'undefined') Audio_.play('uiTap');
        b.cb();
        return true;
      }
    }
    return false;
  }

  draw() {
    for (const b of this.items) {
      const off = b.pressed ? 4 : 0;
      if (b.quiet) {
        R.roundRect(b.x + off, b.y + off, b.w, b.h, 10, b.color,
          'rgba(143,163,200,0.30)', 3);
      } else {
        // ink drop-shadow block, then the plate itself
        R.mechPlate(b.x + 8, b.y + 8, b.w, b.h, 'rgba(0,0,0,0.9)', null, 0, { bolts: false });
        R.mechPlate(b.x + off, b.y + off, b.w, b.h, b.color, CONFIG.COLOR.ink, 7);
      }
      const ty = b.sub ? b.y + off + b.h / 2 - 9 : b.y + off + b.h / 2 + 3;
      // THE LABEL FITS THE PLATE. `ENTER THE BREAKLANDS` at 42px is wider
      // than the 560px button item 4 put it on, and it hung off both ends -
      // which is exactly the failure mode a longer district name or a
      // narrower window reintroduces at any time. Measuring and shrinking
      // costs one measureText per button per frame and makes the whole class
      // of bug impossible, rather than making this one string smaller.
      R.text(b.label, b.x + off + b.w / 2, ty,
        R.fitText(b.label, b.size, b.w - 34), b.textColor);
      if (b.sub) {
        const ss = Math.max(16, Math.round(b.size * 0.42));
        R.text(b.sub, b.x + off + b.w / 2, b.y + off + b.h / 2 + 26,
          R.fitText(b.sub, ss, b.w - 34), b.textColor);
      }
    }
    // The pad/keyboard cursor, drawn OVER the plate so it survives any colour.
    const f = this.items[this.focus];
    if (f) {
      const ctx = R.ctx;
      ctx.save();
      ctx.strokeStyle = CONFIG.COLOR.cyan;
      ctx.lineWidth = 6;
      ctx.strokeRect(f.x - 10, f.y - 10, f.w + 20, f.h + 20);
      ctx.restore();
    }
  }
}

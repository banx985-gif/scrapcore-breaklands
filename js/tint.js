// SCRAPCORE: BREAKLANDS — HOSTILE TINT
//
// Aaron's idea, and a better one than painting a second set of models: one
// part model serves both sides, and the game reddens it when an ENEMY is
// carrying it.
//
// Why it matters. Master §2 gives the player green, cyan and yellow; hostiles
// are red. But a Machine Gun is a Machine Gun — the same part drops off an
// enemy, gets recovered, and ends up on your own machine. Painting a hostile
// version of every part would double the art forever and it would still be
// wrong the moment a part changed hands. Tinting at draw time is always
// correct, costs no art, and means a bolted-on part reads hostile from the
// first frame it appears.
//
// The Core is untouched by this. The Core already carries the faction — enemy
// Cores are modelled red — so tinting it would only flatten art that is
// already saying the right thing.
//
// HOW, AND WHY IT IS CACHED
//
// Tinting is done ONCE per image, into an offscreen canvas, the first time
// that image is drawn hostile. Doing it per frame would mean a composite pass
// for every module on every enemy: §39's worst case is 12 enemies carrying 4
// modules each, so 48 composites a frame, on a phone. Cached, the cost is a
// handful of small canvases and the draw is a plain blit — the same cost as
// the untinted sprite.
//
// The recipe is two passes on purpose:
//
//   1. MULTIPLY a deep red. Multiply cannot lighten, so the black ink outline
//      and the dark panel folds stay exactly where they were. This is what
//      keeps the Borderlands look intact instead of washing it flat.
//   2. SOURCE-ATOP a lighter red at low alpha, to lift the result out of pure
//      maroon and keep bare steel reading as metal rather than as a silhouette.
//
// Neither pass touches alpha, so the sprite's shape, its recorded frame size
// and its footprint are all unchanged. This is presentation only.

const Tint = {
  // Deepen first, then warm. Tuned by rendering enemies and looking at them
  // against all three Rust Yard floors, which is the only test that counts.
  MULTIPLY: '#c8202a',
  MULTIPLY_ALPHA: 0.78,
  WARM: '#ff5a3c',
  WARM_ALPHA: 0.22,

  _cache: new Map(),

  // Cleared when the art reloads, so a re-registered sprite set cannot keep
  // handing out a tint made from the image it replaced.
  reset() { this._cache.clear(); this._paintCache.clear(); },

  /**
   * The hostile version of an image. Returns the ORIGINAL unchanged if a
   * canvas cannot be made, so a failure here can never blank a sprite — the
   * enemy just draws in its normal colours, which is a cosmetic loss and not
   * a missing machine.
   */
  hostile(img) {
    if (!img) return img;
    const hit = this._cache.get(img);
    if (hit) return hit;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return img;                 // not decoded yet — try again next frame

    let cv;
    try {
      cv = (typeof document !== 'undefined' && document.createElement)
        ? document.createElement('canvas') : null;
      if (!cv) return img;
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      if (!c) return img;

      c.drawImage(img, 0, 0);

      // 1. Deepen. Multiply never lightens, so the ink survives.
      c.globalCompositeOperation = 'multiply';
      c.globalAlpha = this.MULTIPLY_ALPHA;
      c.fillStyle = this.MULTIPLY;
      c.fillRect(0, 0, w, h);

      // 1b. PUT THE TRANSPARENCY BACK.
      //
      // 'multiply' is a blend mode, not a mask: where the destination is
      // transparent there is nothing to darken, so the fill simply lands as
      // opaque red. Filling the whole rect therefore paints a solid red
      // rectangle around the sprite. That shipped for about a minute and it
      // looked like a red box following every enemy around.
      //
      // 'destination-in' keeps the canvas only where the ORIGINAL image had
      // alpha, which restores the exact silhouette. source-atop below is safe
      // on its own; this pass is what makes the multiply safe.
      c.globalCompositeOperation = 'destination-in';
      c.globalAlpha = 1;
      c.drawImage(img, 0, 0);

      // 2. Warm, INSIDE the silhouette only. source-atop respects the alpha
      //    already on the canvas, so nothing bleeds into the transparent
      //    surround and the trimmed frame stays trimmed.
      c.globalCompositeOperation = 'source-atop';
      c.globalAlpha = this.WARM_ALPHA;
      c.fillStyle = this.WARM;
      c.fillRect(0, 0, w, h);

      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    } catch (e) {
      return img;
    }

    this._cache.set(img, cv);
    return cv;
  },

  // =========================================================================
  // AND THE SAME TRICK FOR PAINT (Block 12)
  //
  // The paint shop existed as data, rules, unlocks, presets and a randomiser,
  // and NOTHING IN THE GAME EVER CALLED ANY OF IT. `Paint.*` was named by no
  // file but its own; `Progress.paint` was saved, loaded, and read by nobody.
  // 64 colours and 32 decals, green at PASS 124, and invisible.
  //
  // What makes it visible is this: the hostile tint is already the right
  // machinery — recolour once, cache, blit — so paint is the same three passes
  // with the player's colour instead of red, and a cache keyed by colour as
  // well as by image.
  //
  // IT WAS A MULTIPLY, AND A MULTIPLY CANNOT BE MADE SAFE.
  //
  // The reasoning was that multiply can only darken, so the black ink outline
  // survives. True, and it is also why the paint had to change: A MULTIPLY OF
  // TWO SATURATED WARM COLOURS LANDS IN RED. Candy magenta over an orange
  // cannon gave (255, 56, 19) — hue 9 — which is exactly where the HOSTILE
  // tint puts an enemy's cannon. The player could paint themselves the enemy
  // colour, and red is hostile is the oldest rule in this project.
  //
  // MEASURED BEFORE IT WAS CHANGED, because "it looked red" is not a reason to
  // rewrite a blend:
  //
  //   27 of 63 paint colours moved at least one part into the hostile hue band
  //   lightening them enough to stop it turned CANDY MAGENTA into baby pink
  //   dropping PAINT_ALPHA far enough (0.12) made the paint invisible
  //   moving the two part colours that drive it never got below 6
  //
  // No value of anything fixed it, because the fault was the operation.
  //
  // 'color' IS THE ONE THAT WORKS. It is a standard canvas blend: keep the
  // backdrop's LUMINANCE, take the source's HUE AND CHROMA. So:
  //
  //   the black ink outline has luminance 0 and stays black — the property the
  //     multiply was chosen for, kept exactly rather than approximately
  //   the panel folds keep their light and shade
  //   THE PAINTED PART COMES OUT THE COLOUR YOU PICKED, always, whatever the
  //     part underneath was — which is what a paint job IS
  //
  // And because the output hue IS the paint's hue, "no paint may read red"
  // becomes a rule about the PALETTE, checkable in the data, which is where
  // Aaron asked for it. tools/paintcheck.js is that check.
  //
  // It is also MORE visible than the multiply was: mean RGB shift 136 against
  // 112. The paint reads better and cannot lie about which side you are on.
  //
  // No alpha. At anything less than 1 the result blends back toward the part's
  // own hue, and every intermediate hue between the paint and the part is back
  // on the table — including the red ones between magenta and orange.
  _paintCache: new Map(),

  paint(img, hex) {
    if (!img || !hex) return img;
    let byColour = this._paintCache.get(img);
    if (byColour) {
      const hit = byColour.get(hex);
      if (hit) return hit;
    }
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return img;
    let cv;
    try {
      cv = (typeof document !== 'undefined' && document.createElement)
        ? document.createElement('canvas') : null;
      if (!cv) return img;
      cv.width = w; cv.height = h;
      const c = cv.getContext('2d');
      if (!c) return img;
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = 'color';
      c.globalAlpha = 1;
      c.fillStyle = hex;
      c.fillRect(0, 0, w, h);
      // The same alpha restore the hostile pass needs, and for the same
      // reason: a blend mode is not a mask, and without this every painted
      // part gets a solid rectangle around it.
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = 'source-over';
    } catch (e) {
      return img;
    }
    if (!byColour) { byColour = new Map(); this._paintCache.set(img, byColour); }
    byColour.set(hex, cv);
    return cv;
  },
};

if (typeof module !== 'undefined' && module.exports) module.exports = Tint;

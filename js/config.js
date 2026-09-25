// SCRAPCORE: BREAKLANDS — global configuration (Milestones 1–3)
// All gameplay/UI layout uses ONE logical coordinate system: 1920 x 1080.
// The Display module maps it onto any real landscape screen without distortion.

// M0: the design contract this build implements. Bump ONLY when the master
// plan version changes, so a build can never silently claim conformance to a
// document it predates.
const DESIGN_VERSION = 'BREAKLANDS_v1';

// M0: save namespace root. Every persisted key derives from this, so a
// BREAKLANDS save can never collide with a WRECKJACK or SCRAPCORE: ZERO
// save on a device that has more than one of them installed.
const GAME_ID = 'scrapcore-breaklands';

const CONFIG = {
  DESIGN_VERSION,
  GAME_ID,
  LOGICAL_W: 1920,
  LOGICAL_H: 1080,

  // A DEV BUILD, AND NOTHING ELSE IS. Plan §88: "no debug menus left
  // exposed." The DBG button and the Yard's DEV button shipped in every
  // screenshot for nineteen blocks because nothing decided whether a build
  // was a dev build. This does: true only when index.html is opened with
  // `?dev` in the URL, which a player's build never is. Every block that
  // reads it is fenced between DEV-ONLY-BEGIN / DEV-ONLY-END and
  // tools/build_standalone.py DELETES those blocks from the shipped file,
  // so the shipping build does not contain the code, let alone the button.
  DEV: (typeof location !== 'undefined' && location &&
        typeof location.search === 'string' &&
        /[?&]dev(=|&|$)/.test(location.search)),

  // Cap devicePixelRatio for performance on high-density phones.
  DPR_CAP: 2,

  // ---- THE PIXEL CEILING (Block 18, "target hardware, including the weakest
  // machine you'll support") ----
  //
  // DPR_CAP alone is the wrong lever, and measurement says so. The draw was
  // timed at five resolutions in a real browser and the line through them is
  // almost exact:
  //
  //     0.89 Mpx (Steam Deck, 1280x800)    3.119 ms
  //     0.91 Mpx (1366x768)                3.001 ms
  //     1.87 Mpx (1080p)                   4.714 ms
  //     3.42 Mpx (1440p)                   8.212 ms
  //     7.89 Mpx (4K)                     15.540 ms
  //
  //     draw = 1.54 ms + 1.796 ms per megapixel      (largest error 0.53 ms)
  //
  // SO THE DRAW IS FILL RATE. Two thirds of it at 1080p, and nearly all of the
  // difference between machines. The Performance setting, which was the only
  // thing offered, halves particle density and targets 30 fps - and effects
  // measured at a fraction of a millisecond, so it was adjusting the wrong
  // number entirely.
  //
  // AND THE WORST CASE IS NOT A 4K MONITOR, IT IS A LAPTOP. A high-DPI
  // notebook at 1920 CSS pixels with devicePixelRatio 2 asks for a 3840x2160
  // backing store: 8.3 Mpx, MORE than the 4K desktop, on far weaker hardware.
  // DPR_CAP: 2 permits it, because a cap on the RATIO is not a cap on the
  // pixels. This is a cap on the pixels.
  //
  // 3.3 Mpx is where the measured line crosses 7.5 ms, just inside the 8 ms
  // target, on a SOFTWARE RASTERISER with no GPU at all - so it is a floor
  // under the worst machine rather than a guess about a typical one. Native
  // at 1080p and at 1440p; only above that does anything get resampled, and
  // then to about 1440p rather than to something soft.
  MAX_PIXELS: 3300000,
  MAX_PIXELS_LITE: 1600000,   // ~1700x940: 4.4 ms on the same line

  // Frame time clamp (seconds) so a hitch never produces a giant delta.
  MAX_DT: 0.05,

  // Virtual stick tuning (logical units)
  STICK: {
    deadZone: 0.16,      // fraction of maxRadius before input registers
    maxRadius: 120,      // knob travel from origin
    baseRadius: 130,     // drawn base circle
    knobRadius: 52,
    floatingLeft: true,  // left stick spawns where you touch (in its region)
    floatingRight: true, // right stick too
    // Default resting positions (used for fixed mode + idle hint rings),
    // expressed as offsets from the SAFE rect corners.
    // The resting stick sits in the MIDDLE of its half of the screen (device
    // request), so homeOffsetX is gone — input.js derives x from the safe
    // rect. Only the height from the bottom is a constant.
    homeOffsetY: 330,
  },

  // Action buttons (logical units)
  BUTTON: {
    radius: 78,
    magnetRadius: 94,    // the magnet is held down and aimed with, so it gets
                         // a bigger target than the tap buttons
    // Offsets from safe rect corners.
    // Buttons sit ALONGSIDE the sticks in the bottom corners, not stacked
    // above them: ROTATE at the top of a column was out of thumb reach, and a
    // column of buttons eats the half of the screen the stick wants to live in.
    // Pulled further off the edges (device request): at 150/190 the button
    // EDGE sat 72px from the side, which on a curved screen is in the bend.
    // Now 132 from the side and 157 from the bottom.
    dashX: 210,  dashY: 530,     // right side, ABOVE magnet
    magnetX: 210, magnetY: 295,  // bottom-RIGHT, nearest the resting thumb
    // ROTATE is two buttons on the LEFT, SIDE BY SIDE: anticlockwise and
    // clockwise. One of them therefore sits INWARD, toward the resting move
    // stick, which is the trap that bit the old single ROTATE twice. This
    // position was solved by measurement, not placed by eye: the inner button
    // clears the resting stick by 115 on the narrowest half (16:9), keeps 148
    // from the screen edge, and the pair is 170 apart against a 155 minimum.
    // tests/test_transition.js checks all three across five screen widths.
    rotateAboveY: 700,   // height from the bottom; the stick rests at 330, so
                         // this clears its 130 base by 178, and the HUD level
                         // button above it by 135
    rotateSpread: 176,   // between the two centres (needs > 155)
    rotateRadius: 62,
  },

  // Candy-comic palette (from the game plan's visual direction)
  COLOR: {
    bg:        '#0b0e1a',
    floor:     '#141a2e',
    grid:      '#1d2540',
    ink:       '#000000',
    white:     '#ffffff',
    cyan:      '#22d9ff',
    magenta:   '#ff3fa4',
    lime:      '#a8e832',
    orange:    '#ff7a1a',
    yellow:    '#ffd23f',
    violet:    '#9b5cff',
    red:       '#ff3b3b',
    steel:     '#8fa3c8',
  },
};

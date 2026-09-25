// SCRAPCORE: BREAKLANDS — MAKING THE WORLD READ AS OUTDOORS (Phase A)
//
// Player feedback, 31 Aug: "I was expecting it to feel like you're out in a
// world, not in a massive rectangle building."
//
// He is right and the cause is structural, not artistic. The district was
// built out of WRECKJACK's arena vocabulary: an arena floor tile, a wall at
// every boundary, props on a grid, one flat rectangle. AN ARENA IS A ROOM BY
// DEFINITION, so making it eight times bigger made it a bigger room.
//
// ---------------------------------------------------------------------------
// WHAT THE FIRST SCREENSHOT SETTLED
//
// `tools/shot.py` rendered the district before any of this was written, and
// the diagnosis stopped being a matter of opinion: the ground was a RIVETED
// STEEL DECK PLATE with hazard stripes painted on it. Not "reads a bit like a
// room" — a factory floor, tiled to the horizon.
//
// The second screenshot settled something else. WORLD_FEEL puts "zoom out"
// first as the cheapest quarter of the fix, so it was done first — and it made
// the problem WORSE, because all a wider frame does with a repeating interior
// floor is show you more of it. Zoom is worth keeping (a close camera never
// lets the player see distance) but on its own it is not a fix. THE GROUND IS
// THE FIX.
//
// ---------------------------------------------------------------------------
// EVERYTHING HERE IS CANVAS PRIMITIVES (standing rule 5)
//
// No sprite is required by any of it, and none is planned as a prerequisite.
// Art replaces primitives later, one file at a time, as it always has. That is
// the property that lets the world be BUILT now and PAINTED later, and Phase A
// is precisely the moment it would have been easiest to break.

const OUTDOORS = {
  // Ground variation measured in CHUNKS, not tiles. A patch smaller than the
  // screen reads as a pattern; a patch bigger than the screen reads as ground.
  PATCH: 3072,

  SCATTER_PER_PATCH: 90,     // small marks, irregular, cheap
  DETAIL_R: 5200,            // scatter only near the player; it is fine detail

  // The edge. Terrain that reads as CONTINUING, not a surface you can drive
  // along. Soft-blocked before the visual edge so the player turns back at
  // terrain rather than at an invisible wall in front of visible ground.
  EDGE_BAND: 5200,
  HAZE_FROM: 0.15,

  // One light direction for the whole world. Nothing reads as outdoors like a
  // long shadow all going the same way.
  SUN: { dx: 0.42, dy: 0.60, alpha: 0.30, len: 1.15 },

  // Far silhouettes. Two layers at different scroll rates: the strongest
  // open-world cue in WORLD_FEEL's list, and very nearly free.
  // Two layers. The nearer one stands ON the boundary so it is visible the
  // moment you approach an edge; the far one sits behind and above it and
  // scrolls slower, which is what sells the depth.
  PARALLAX: [
    { factor: 0.955, base: 60, step: 3400, h: 620 },
    { factor: 0.890, base: 520, step: 5600, h: 980 },
  ],
};


// ---------------------------------------------------------------------------
// THE LOOK OF EACH DISTRICT (content/draft_district_*.js, absorbed).
//
// The drafts brought three things the first palettes did not have:
//
//   1. TONAL BANDS with a weight AND a scale, so a district's ground varies at
//      more than one frequency. Nothing near-black: PHASE_A_REVIEW is blunt
//      that a single dark value is what an interior floor looks like, which is
//      exactly what my first pass produced.
//
//   2. LOW-CONTRAST SCATTER, with an opacity range per kind. "Detail must
//      never out-contrast the terrain it sits on." My first scatter pass used
//      flat opaque colours and read as litter rather than as ground.
//
//   3. THE HAZE BAND, and this one is a fix DRAWING_AT_44 asked for by name.
//      It scored the horizon silhouettes as reading like A CEILING, "for want
//      of a light band behind them" - and the drafts say why in one line:
//
//        "The haze band is drawn FIRST and is LIGHTER than the ground.
//         Silhouettes go on top of it. Dark shapes on a dark background read
//         as a ceiling."
//
//      So the band is a gradient from the district's own ground tone up to
//      something much lighter, and the silhouettes are dark shapes ON it.
// ---------------------------------------------------------------------------
// THE NEON, PER DISTRICT (AARON, 7 September).
//
// Measured before it was changed: the world was **99% amber and 0% magenta**,
// across all six districts, which made six places look like one. The cause was
// not the palette table -- it was that NOTHING READ ONE. Every emissive prop
// in the game picked from the same hardcoded three:
//
//     const neon = ['#ff3fa4', '#ffb020', '#ffffff'][Math.floor(seed) % 3];
//
// and every lit window was hardcoded amber or white. Windows outnumber signs
// by two orders of magnitude, so the windows WERE the world's colour and no
// district had any say in it.
//
// So neon is data now, and it drives BOTH the signs and the windows, because
// the windows are where the pixels are. Aaron's calls, verbatim:
//
//   NEON CUT     magenta-led, with white second. The cyberpunk screenshot.
//   IRONWORKS    amber, almost entirely. Furnace light.
//   THE SPRAWL   white and cold sodium, sparse and failing. Dead streetlights,
//                one working sign.
//   THE YARD     amber, low and dim, almost none of it.
//   ASH BARRENS  as close to zero as the district can bear. The absence is
//                the point.
//
// RAIL SPINE IS NOT ON AARON'S LIST and gets one anyway, because it had no
// LOOK entry at all and was silently wearing the Ironworks' old hand-written
// palette -- which is why it measured as the flattest, darkest district in the
// game with its median luminance sitting ON its 5th percentile. CONTENT_WORLD
// gives it "container colours as the only brightness, signal lamps", so it is
// amber, sparse, and at a density that is nobody else's. FLAGGED FOR A HUMAN.
//
// `mix`     weighted picks. MAGENTA, AMBER and WHITE ONLY -- never green,
//           never cyan, never red. tools/legibility.py checks the pixels and
//           tests/test_neon.js checks this table, so neither can drift.
// `lit`     the fraction of emissive props that are lit AT ALL. This is how
//           "almost none of it" and "sparse and failing" are said in data
//           rather than by deleting props: a dead streetlight is still a
//           streetlight, and the Sprawl is meant to be full of them.
// `windows` the fraction of a building's windows that are lit.
// `alpha`   how hard it burns.
const DISTRICT_LOOKS = {
  yard: {
    lightDir: 135, ambient: '#20242e', weather: 'dust',
    ground: [
      { tone: '#2a2e36', weight: 5, scale: 8 },
      { tone: '#343830', weight: 3, scale: 5 },
      { tone: '#3d3a30', weight: 2, scale: 3 },
    ],
    scatter: [
      { kind: 'rut', density: 0.7, size: [40, 400], opacity: [0.04, 0.12] },
      { kind: 'stain', density: 0.4, size: [80, 900], opacity: [0.03, 0.09] },
      { kind: 'pebble', density: 1.2, size: [8, 40], opacity: [0.06, 0.15] },
      { kind: 'swarf', density: 0.5, size: [12, 60], opacity: [0.05, 0.14] },
    ],
    haze: { from: '#2a2e36', to: '#585f6e', height: 260 },
    far: ['#3a3f4b', '#2f343f'],
    // AMBER, LOW AND DIM, ALMOST NONE OF IT. One dead neon sign reading a
    // company name is what CONTENT_WORLD gives the Yard, and one is the
    // number: a quarter of the signs light, and weakly.
    tone: { count: 6, alpha: 0.42 },
    // AMBER, AND ONLY AMBER. The one-in-ten white read as 34% of the Yard's
    // neon once it was measured, for the same area reason as the Sprawl's
    // signs. "One dead neon sign reading a company name" is not a mixed
    // palette, it is one colour that is nearly out.
    neon: { mix: [['#ffb020', 1]],
            lit: 0.22, windows: 0.07, alpha: 0.55 },
  },
  ironworks: {
    // A FURNACE THAT HAS BEEN RUNNING FOR FOUR HUNDRED YEARS.
    //
    // The Ironworks came out of the neon pass as the FLATTEST district in the
    // game -- a contrast band of 19.7 against the Neon Cut's 58 -- in the one
    // district CONTENT_WORLD describes entirely in terms of light: "black and
    // orange, glowing pour spouts, heat shimmer, ash fall", "everything is
    // heat", "the furnace never went out". A shippable district whose whole
    // identity is molten metal cannot be the place with the least range in it.
    //
    // Fixed the way the Sprawl was fixed and for the same reason: LIGHT AND
    // TONE, not more objects. Nothing was added to the prop mix and nothing
    // was added to the scatter. The bands were pulled apart top and bottom,
    // and the tonal layer underneath got the district's own molten palette
    // with hard edges on it.
    //
    // BLACK AND ORANGE, and the black comes first. A furnace is only bright
    // because of what is around it, so the ground reads darker than it did --
    // #1c1a1c against the old #2b2a2c -- and the light is what was added.
    lightDir: 135, ambient: '#241c18', weather: 'ash',
    ground: [
      { tone: '#1c1a1c', weight: 5, scale: 9 },   // black, and the base
      { tone: '#2e2520', weight: 3, scale: 6 },   // ash over warm slag
      { tone: '#3f3327', weight: 2, scale: 4 },
      { tone: '#141719', weight: 2, scale: 12 },  // cold shadow, the far bays
      { tone: '#4a3a26', weight: 2, scale: 7 },   // hardpan under the pour
    ],
    scatter: [
      { kind: 'rut', density: 0.6, size: [40, 380], opacity: [0.05, 0.13] },
      { kind: 'stain', density: 0.6, size: [90, 800], opacity: [0.04, 0.11] },
      { kind: 'pebble', density: 1.0, size: [8, 38], opacity: [0.06, 0.16] },
      { kind: 'swarf', density: 0.8, size: [12, 70], opacity: [0.06, 0.16] },
    ],
    haze: { from: '#2b2a2c', to: '#6b5344', height: 300 },
    far: ['#4a4038', '#38302c'],
    // FURNACE LIGHT, ON THE GROUND, WITH A RIM ON IT.
    //
    // The brightest highlights and the deepest shadows in the game, both in
    // one district, because that is what molten metal in a dark shed looks
    // like. Seven soft blotches of the district's own greys moved the number
    // by four; this is the district's own FIRE, at the sizes fire comes in.
    //
    // Read top to bottom it is a pour cooling: the dark under the plant, ash,
    // the old mid, crust that has gone black-red, crust still red, the lane
    // itself, and the spout -- which is the brightest thing on any ground in
    // BREAKLANDS and covers about one per cent of it. Each gets its own alpha
    // because "deepest" and "brightest" are values, not opacities, and its own
    // size because shade is wide and a spout is small. `edge: 'hard'` gives
    // every one of them a rim: molten metal has a shoreline.
    //
    // STILL WITHIN THE RULE. Amber and white are two of the world's three
    // permitted neon colours; there is no green, no cyan and no red here --
    // #c8451a is hue 19 and #7a2c0c is hue 20, both amber, both checked by
    // tools/legibility.py's faction bands every run.
    tone: {
      count: 64, alpha: 0.50,
      mix: [
        // THE SHADE. Wide, soft, and the deepest black on any ground in
        // BREAKLANDS -- a furnace is only bright because of what surrounds it.
        { tone: '#080709', weight: 7, alpha: 0.92, size: [0.14, 0.40] },
        { tone: '#12100f', weight: 5, alpha: 0.80, size: [0.11, 0.32] },
        { tone: '#241c18', weight: 4, alpha: 0.62, size: [0.13, 0.34] },
        { tone: '#3a2f26', weight: 4, alpha: 0.50, size: [0.13, 0.36] },
        // THE FIRE, AS POURS RATHER THAN AS ORANGE SHAPES.
        //
        // Each entry is one molten pool drawn as four concentric hard-edged
        // rings: black-red crust at the shoreline, crust still red, the lane,
        // and a white-hot core. That core is the brightest thing on any ground
        // in BREAKLANDS and it is about one per cent of the Ironworks' -- it is
        // bright because everything within a hundred units of it is the
        // darkest black on any ground in BREAKLANDS, which is the whole
        // argument for doing this with light instead of with props.
        //
        // Sized at what molten metal is the size of: 45 to 400 world units
        // across, which is a puddle you step over up to a pool you drive
        // around. Nothing was added to the prop mix and nothing to the scatter.
        { tone: '#5a2109', weight: 9, alpha: 0.94, size: [0.054, 0.156],
          edge: 'hard', stack: ['#a8380f', '#e2601c', '#ffb355'] },
        { tone: '#4a1c08', weight: 6, alpha: 0.90, size: [0.036, 0.090],
          edge: 'hard', stack: ['#c8451a', '#ff8a2a', '#ffd08c'] },
        { tone: '#3a1706', weight: 4, alpha: 0.88, size: [0.022, 0.055],
          edge: 'hard', stack: ['#b83c12', '#ff7a1e'] },
      ],
    },
    // WINDOWS RAISED FROM 0.20. At 0.20 a frame lit ONE window on the big
    // shift office and the district read cool grey with a spark in it, which
    // is not "furnace light". The Ironworks is the district where everything
    // is heat and the pour never stopped; it should be the most lit place in
    // the game by a distance, and that distance is what tells it from the
    // Yard, which is the other amber district.
    neon: { mix: [['#ffb020', 14], ['#ffffff', 1]],
            lit: 1.00, windows: 0.38, alpha: 0.95 },
  },
  sprawl: {
    // AARON'S DECISION B: THE SPRAWL WAS THE FLATTEST PLACE IN THE GAME.
    // A contrast band of 14.0 against the Neon Cut's 33.5, in the district
    // CONTENT_WORLD calls the emotional centre. Four tones between luminance
    // 45 and 60 is four shades of the same thing, and at driving speed that
    // is one shade.
    //
    // "The range comes from LIGHT and TONE, not from more objects." So no
    // prop was added: the bands were pulled APART, top and bottom. Deep shade
    // in the shadow of the housing blocks, pale hardpan where the light gets
    // through, and the old middle kept as the middle so the district still
    // reads as the same place rather than as a different one.
    lightDir: 135, ambient: '#26232a', weather: 'none',
    ground: [
      { tone: '#2e2b2e', weight: 4, scale: 10 },   // the old base, unmoved
      { tone: '#1b191f', weight: 3, scale: 6 },    // deep shade between blocks
      { tone: '#38332c', weight: 3, scale: 7 },
      { tone: '#575046', weight: 2, scale: 4 },    // pale hardpan, sun on it
      { tone: '#121116', weight: 2, scale: 9 },    // the dark under things
      { tone: '#33382e', weight: 2, scale: 5 },
    ],
    scatter: [
      { kind: 'rut', density: 0.5, size: [50, 420], opacity: [0.04, 0.11] },
      { kind: 'stain', density: 0.5, size: [90, 900], opacity: [0.03, 0.10] },
      { kind: 'pebble', density: 0.9, size: [8, 36], opacity: [0.05, 0.14] },
      { kind: 'swarf', density: 0.3, size: [10, 50], opacity: [0.04, 0.12] },
    ],
    // PALE SKY IN THE GAPS. The haze band is drawn FIRST and lighter than the
    // ground, with the silhouettes on top of it; raising its top end is what
    // puts light between the housing blocks instead of more housing blocks.
    haze: { from: '#2e2b2e', to: '#9a94a4', height: 330 },
    far: ['#5a5464', '#403c4a'],
    // WHITE AND COLD SODIUM, SPARSE AND FAILING. Most of the streetlights
    // are dead and one sign still works, which is why `lit` is 0.30 rather
    // than the props being deleted -- the dead ones have to be THERE for the
    // working one to mean anything. The warm tone is sodium vapour, kept
    // second to the white so the district reads cold.
    // TUNED DOWN FROM NINE AT 0.72, WHICH MEASURED 42.7 AND OVERSHOT.
    // Aaron asked for "at least 25 without making it busy", and 42.7 put the
    // Sprawl level with the Neon Cut -- which is the wrong ORDER as much as
    // the wrong number. CONTENT_WORLD gives the Neon Cut "the darkest
    // district, and the brightest" and the Sprawl "the most human district,
    // and the saddest": the sad one should not be the most dramatic thing in
    // the game. Seven at 0.55 clears the bar and leaves the city on top.
    tone: { count: 7, alpha: 0.55 },
    // WHITE 8 TO SODIUM 2, AND WINDOWS RAISED FROM 0.05.
    // At 0.05 the whole district lit exactly ONE window in a frame, which is
    // faithful to "one working sign" and useless as an identity: a single
    // sample cannot express a mix, and the district measured 100% of whichever
    // colour that one window drew. A handful of cold windows across a frame is
    // still sparse -- `lit: 0.30` keeps most of the streetlights dead, which
    // is where the failing reads from -- and it lets the white be seen.
    // WINDOWS COLD WHITE, SIGN WARM SODIUM. See the note in Props.drawProp:
    // with one mix the district lit a single window per frame and whichever
    // colour that one drew became its whole identity. `windows` at 0.13 so a
    // frame usually shows two or three -- still the sparsest lit district
    // after the Barrens and the Yard -- and `lit: 0.30` keeps seven
    // streetlights in ten dead, which is where the failing reads from.
    // AND THE SIGNS ARE WHITE-LED TOO. A sign strip is w*0.72 wide and a
    // window is a few pixels, so with a sodium-led signMix the district
    // measured 71% amber even though every window was white: sign AREA beat
    // window COUNT. Aaron's word order is the ratio -- "white AND cold
    // sodium" -- so white leads both and the sodium is the one that has not
    // gone cold yet.
    // FOUR TO ONE, MEASURED. At 2:1 the frame lit two sodium signs against one
    // white window -- 598 amber pixels to 238 -- because a sign strip is
    // enormous next to a window and two of them settle the district. Sodium
    // is the accent Aaron names second, so it appears at the rate of an
    // accent: about one lit sign in five.
    neon: { mix: [['#ffffff', 1]],
            signMix: [['#ffffff', 4], ['#ffc266', 1]],
            lit: 0.30, windows: 0.13, alpha: 0.78 },
  },
  neoncut: {
    lightDir: 135, ambient: '#161a24', weather: 'rain',
    ground: [
      { tone: '#1a1d26', weight: 5, scale: 6 },
      { tone: '#22252e', weight: 3, scale: 4 },
      { tone: '#2b2730', weight: 2, scale: 3 },
      { tone: '#141821', weight: 2, scale: 8 },
    ],
    scatter: [
      { kind: 'stain', density: 0.7, size: [70, 600], opacity: [0.04, 0.12] },
      { kind: 'pebble', density: 0.5, size: [8, 26], opacity: [0.05, 0.12] },
      { kind: 'rut', density: 0.3, size: [40, 300], opacity: [0.03, 0.09] },
      { kind: 'swarf', density: 0.4, size: [10, 44], opacity: [0.05, 0.13] },
    ],
    haze: { from: '#1a1d26', to: '#4a4258', height: 340 },   // lilac city glow
    far: ['#3b3548', '#2a2636'],
    // MAGENTA-LED, WHITE SECOND. THE SCREENSHOT THAT SELLS THE GAME.
    // CONTENT_WORLD: "the darkest district, and the brightest." The ground is
    // already the darkest of the six; this is the other half of that sentence.
    // Windows at 0.30 because a lit tower is the whole silhouette.
    tone: { count: 6, alpha: 0.45 },
    neon: { mix: [['#ff3fa4', 7], ['#ffffff', 3], ['#ffb020', 2]],
            lit: 1.00, windows: 0.30, alpha: 0.95 },
  },
  barrens: {
    lightDir: 135, ambient: '#2c2c30', weather: 'dust',
    ground: [
      { tone: '#33333a', weight: 5, scale: 16 },
      { tone: '#3b3833', weight: 4, scale: 12 },
      { tone: '#434038', weight: 2, scale: 9 },
      { tone: '#2d2f34', weight: 3, scale: 20 },
    ],
    scatter: [
      { kind: 'rut', density: 0.4, size: [60, 500], opacity: [0.03, 0.10] },
      { kind: 'stain', density: 0.3, size: [100, 1100], opacity: [0.03, 0.08] },
      { kind: 'pebble', density: 1.1, size: [8, 44], opacity: [0.05, 0.14] },
      { kind: 'swarf', density: 0.2, size: [10, 40], opacity: [0.04, 0.10] },
    ],
    haze: { from: '#33333a', to: '#8c8a92', height: 420 },   // pale, and tall
    far: ['#5c5a64', '#46454e'],
    // AS CLOSE TO ZERO AS THE DISTRICT CAN BEAR. The absence is the point,
    // and `lit: 0` says it exactly: the Barrens' prop mix carries no emissive
    // kind anyway, so this is belt and braces against anyone adding one.
    // FEW AND FAINT. The Barrens is meant to read as empty and smooth;
    // its contrast already comes from the pale haze, not the ground.
    tone: { count: 3, alpha: 0.28 },
    neon: { mix: [['#ffb020', 1]], lit: 0.00, windows: 0.00, alpha: 0.4 },
  },
  // THE RAIL SPINE, WHICH HAD NO LOOK AND WAS WEARING THE IRONWORKS'.
  // `DISTRICT_LOOKS` had five entries for six shipping districts, so
  // `palette()` fell through to the hand-written GROUND_PALETTES.ironworks --
  // an older, darker table -- and the Rail Spine measured as the flattest
  // place in the game with its median luminance ON its 5th percentile. Nothing
  // reported it because nothing was looking. CONTENT_WORLD: "endless linear
  // geometry, container colours as the only brightness, signal lamps."
  // THE CRUCIBLE'S HALL: THE HEART OF THE FURNACE.
  //
  // D319 found every boss hall falling through to the legacy table and gave
  // a lair its district's look (`lookId`), so the hall wore the Ironworks'
  // ground -- measured 71.4 in a still, which is not flat. But it was the
  // Ironworks VERBATIM: the room you walked into the furnace to reach looked
  // like the road outside it, and the fight is "the floor is molten and the
  // cold lanes close" (bossdata). The molten lanes are hazards in the four
  // outer chunks; the middle chunk, where the boss stands and the camera
  // sits, was plain Ironworks ground with the Ironworks' random pours on it.
  //
  // So the hall gets its own look, and it is the Ironworks' pushed both ways
  // -- as the Ironworks was the Yard's pushed both ways. Deeper shade (there
  // is no sky in here; the only light is the metal), more of the floor
  // molten, the pours larger and their cores whiter. Nothing added to the
  // prop mix; there is no prop mix. Light and tone, hard-edged.
  //
  // Measured, hall against the district outside it, world-only stills:
  // see D327 in DECISIONS.md for the numbers this was tuned against.
  lair_crucible: {
    lightDir: 135, ambient: '#1c120e', weather: 'ash',
    ground: [
      { tone: '#120f10', weight: 6, scale: 9 },   // black; a floor under a roof
      { tone: '#241a16', weight: 3, scale: 6 },
      { tone: '#0c0d10', weight: 3, scale: 12 },  // the cold shadow, deeper
      { tone: '#3a2a1c', weight: 2, scale: 5 },   // hardpan cooked orange-brown
    ],
    scatter: [
      { kind: 'stain', density: 0.7, size: [90, 900], opacity: [0.05, 0.13] },
      { kind: 'pebble', density: 0.8, size: [8, 34], opacity: [0.06, 0.16] },
      { kind: 'swarf', density: 1.0, size: [12, 80], opacity: [0.07, 0.18] },
    ],
    haze: { from: '#1a1416', to: '#4a3028', height: 200 },
    far: ['#3a2c26', '#2a201c'],
    tone: {
      count: 72, alpha: 0.55,
      mix: [
        { tone: '#050405', weight: 9, alpha: 0.95, size: [0.16, 0.44] },
        { tone: '#0e0b0b', weight: 6, alpha: 0.85, size: [0.12, 0.34] },
        { tone: '#1e1512', weight: 4, alpha: 0.60, size: [0.13, 0.30] },
        // THE POURS: the Ironworks' sizes, a shade larger, and a whiter
        // core -- this is where they come from. Not more of them: the
        // first tuning doubled their size and the hall read as a lava
        // field, 122 at the 95th percentile, which is the toy CONTENT_WORLD
        // warns about.
        { tone: '#5a2109', weight: 9, alpha: 0.95, size: [0.058, 0.170],
          edge: 'hard', stack: ['#a8380f', '#e2601c', '#ffb355', '#ffe6c0'] },
        { tone: '#4a1c08', weight: 6, alpha: 0.92, size: [0.038, 0.096],
          edge: 'hard', stack: ['#c8451a', '#ff8a2a', '#ffd08c'] },
        { tone: '#3a1706', weight: 5, alpha: 0.90, size: [0.022, 0.058],
          edge: 'hard', stack: ['#b83c12', '#ff7a1e'] },
      ],
    },
    neon: { mix: [['#ffb020', 14], ['#ffffff', 1]],
            lit: 1.00, windows: 0.38, alpha: 0.95 },
  },
  // CENTRAL DISPATCH. "White, cyan-white, sterile -- the one district that
  // isn't filthy, and that's the horror." The draft is explicit that this
  // is the ONLY light ambient in the game and that the ground is EVEN: the
  // bands sit within a dozen points of each other on purpose, which is the
  // opposite of every other district's rule and is the point. The
  // contrast comes from the racks and the screen walls standing on it, not
  // from the floor. No sky: the haze is a lit ceiling line.
  //
  // WHITE IS WORLD NEON. The bible allows magenta, amber and white; the
  // screen walls are white, and legibility.py counts white above 170 as a
  // light. A district this pale will read as mostly "white / world", which
  // is exactly what it is.
  dispatch: {
    lightDir: 90, ambient: '#e8ecf0', weather: 'none',
    ground: [
      { tone: '#e4e8ec', weight: 6, scale: 6 },    // clean floor
      { tone: '#d8dee6', weight: 3, scale: 4 },    // walkway inlay
      { tone: '#eef2f6', weight: 2, scale: 8 },    // lit panel
      { tone: '#cfd6de', weight: 1, scale: 10 },   // the one shadowed run
    ],
    scatter: [
      { kind: 'stain', density: 0.15, size: [200, 1600], opacity: [0.03, 0.06] },
      { kind: 'rut', density: 0.2, size: [60, 300], opacity: [0.03, 0.06] },
    ],
    haze: { from: '#e4e8ec', to: '#ffffff', height: 200 },
    far: ['#f4f6f8', '#e0e4e8'],
    // Almost none. It is EVEN.
    tone: { count: 3, alpha: 0.18 },
    neon: { mix: [['#ffffff', 1]], lit: 0.40, windows: 0.30, alpha: 0.9 },
    // Polished floor, not asphalt: a corridor a shade darker than the halls.
    road: { ink: '#cdd4dc', worn: '#d8dee6' },
    // The one ground the HUD's steel cannot be read on. game.js draws a
    // plate behind the readouts here, measured by tools/hudcheck.py.
    brightGround: true,
  },
  railspine: {
    lightDir: 135, ambient: '#232529', weather: 'none',
    ground: [
      { tone: '#2a2c31', weight: 5, scale: 14 },
      { tone: '#343029', weight: 3, scale: 8 },
      { tone: '#3d3f45', weight: 2, scale: 5 },
      { tone: '#1e2024', weight: 3, scale: 18 },
    ],
    scatter: [
      { kind: 'rut', density: 0.8, size: [60, 620], opacity: [0.05, 0.14] },
      { kind: 'stain', density: 0.4, size: [80, 700], opacity: [0.03, 0.10] },
      { kind: 'pebble', density: 1.0, size: [8, 34], opacity: [0.06, 0.15] },
      { kind: 'swarf', density: 0.7, size: [12, 66], opacity: [0.06, 0.16] },
    ],
    haze: { from: '#2a2c31', to: '#767c88', height: 320 },
    far: ['#4d525c', '#3a3e46'],
    // SIGNAL LAMPS. Amber, and at a density that is nobody else's: sparser
    // than the Ironworks' furnace, denser than the Yard's one dead sign.
    tone: { count: 7, alpha: 0.52 },
    neon: { mix: [['#ffb020', 7], ['#ffffff', 4]],
            lit: 0.45, windows: 0.09, alpha: 0.80 },
  },
};

// A district's LOOK, as data (standing rule 7). Adding a district's palette is
// one entry; nothing here is district-specific code.
const GROUND_PALETTES = {
  // THE IRONWORKS. Black and orange, ash fall, heat. Dark and filthy, because
  // CONTENT_WORLD is explicit: ground is dark and filthy and neon is the only
  // bright thing. A bright world with neon in it reads as a toy.
  // The values are close together on purpose - dark and filthy - but NOT as
  // close as the first pass had them. The first render came out as a void:
  // the room was gone and nothing had replaced it, because six greys within
  // three points of each other read as one flat grey at driving speed. Ground
  // has to be dark AND legible, and legible means the patches differ enough to
  // see the edge between them.
  ironworks: {
    // NEUTRAL, not mauve. The first contrast pass pushed the values apart
    // and the whole district came out lilac, because every patch carried
    // more blue than red. Ash, wet concrete, rust and oil — the four things
    // CONTENT_WORLD actually names — are all neutral-to-warm.
    base: '#1c1e21',
    patches: [
      { ink: '#26282a', name: 'ash flat' },
      { ink: '#33261d', name: 'rust stain' },
      { ink: '#191c20', name: 'wet hardpan' },
      { ink: '#2e2a21', name: 'slag gravel' },
      { ink: '#121417', name: 'oil' },
      { ink: '#212619', name: 'scrub' },
      { ink: '#2a2724', name: 'clinker' },
    ],
    scatter: ['#0e1013', '#3d2e1e', '#4a3722', '#2b2e33', '#1a2015'],
    // Cliff and rubble at the boundary, and the haze the district fades into.
    edgeRock: '#212327',
    edgeRockLit: '#34383d',
    haze: '#0d0f12',
    // Far silhouettes: what you can see and cannot reach yet.
    // Far silhouettes are LIGHTER than the ground, not darker: they are at
    // distance, seen through haze, and haze lifts a value toward the sky it
    // is scattering. Drawn darker they read as holes in the floor.
    far: '#333a45',
    farNear: '#2a3039',
  },

  // ---- THE LAIR FLOORS (BLOCK 14) ----------------------------------------
  // A lair's district id is `lair_<boss>`, which has no DISTRICT_LOOKS entry,
  // so all six were falling back to the Ironworks and every hall in the game
  // was going to be the same colour as the furnace. The floor is most of what
  // says WHERE you are in a room with no horizon, so each gets its own.
  //
  // `edgeRock`, `haze` and `far` are never read indoors — game.js skips the
  // routes, the scatter and the edges for an interior — but they are filled
  // in anyway rather than left undefined, because the next thing to read a
  // palette should not have to know which half of it is live.
  lair_crucible: {
    base: '#1a1210',
    patches: [
      { ink: '#241612' }, { ink: '#2e1a10' }, { ink: '#160f0d' },
      { ink: '#33200f' }, { ink: '#120b09' }, { ink: '#291a14' },
    ],
    scatter: ['#0d0806', '#4a2a12', '#5a3418', '#2a1a12', '#1a1008'],
    edgeRock: '#241a16', edgeRockLit: '#3a2a20', haze: '#100a08',
    far: '#3a2a22', farNear: '#2c1f19',
  },
  // CIVIC PLAZA: wet, reflective, lit magenta. Cold where the furnace is hot.
  lair_bailiff: {
    base: '#15171f',
    patches: [
      { ink: '#1b1e28' }, { ink: '#22202c' }, { ink: '#101219' },
      { ink: '#1e2430' }, { ink: '#0d0f15' }, { ink: '#252230' },
    ],
    scatter: ['#0a0c12', '#2e2440', '#3a2c4e', '#1c2230', '#12151d'],
    edgeRock: '#1e2029', edgeRockLit: '#2e3140', haze: '#0a0b10',
    far: '#2f3346', farNear: '#242737',
  },
  // THE SINK: raw dug ground, ore and dust.
  lair_boremaw: {
    base: '#1d1a15',
    patches: [
      { ink: '#26221a' }, { ink: '#2f2415' }, { ink: '#181510' },
      { ink: '#332a1b' }, { ink: '#12100c' }, { ink: '#282520' },
    ],
    scatter: ['#0e0c08', '#463618', '#544120', '#2a2620', '#191610'],
    edgeRock: '#262219', edgeRockLit: '#3c3728', haze: '#0f0d0a',
    far: '#3a352a', farNear: '#2b2820',
  },
  // ROOF PLANT: concrete deck under open sky. The lightest floor in the game,
  // because everything else about the Stacks fight is a long way down.
  lair_kingmaker: {
    base: '#23262c',
    patches: [
      { ink: '#2b2f36' }, { ink: '#33373f' }, { ink: '#1e2127' },
      { ink: '#2e3239' }, { ink: '#191c21' }, { ink: '#282c33' },
    ],
    scatter: ['#14161a', '#3e444e', '#4a515c', '#22262c', '#1a1d22'],
    edgeRock: '#2a2e35', edgeRockLit: '#414751', haze: '#0e1014',
    far: '#3d434f', farNear: '#30353f',
  },
  // BASIN THREE: drowned, green-black, algae on everything.
  lair_stitcher: {
    base: '#111a1c',
    patches: [
      { ink: '#172225' }, { ink: '#1b2a26' }, { ink: '#0d1416' },
      { ink: '#1e2e2c' }, { ink: '#0a1012' }, { ink: '#182220' },
    ],
    scatter: ['#070d0e', '#254038', '#2e4d42', '#16232a', '#0e1618'],
    edgeRock: '#1a2326', edgeRockLit: '#2a373a', haze: '#070c0e',
    far: '#2c3a3e', farNear: '#212c30',
  },
  // ALLOCATION FLOOR: clean, white, lit and intact. THAT IS THE HORROR.
  // The only pale floor in the game, and it is the last room in it.
  lair_dispatcher: {
    base: '#3a3d44',
    patches: [
      { ink: '#43464e' }, { ink: '#4b4f57' }, { ink: '#35383f' },
      { ink: '#464a52' }, { ink: '#303339' }, { ink: '#3f434a' },
    ],
    scatter: ['#282b31', '#565b66', '#616773', '#3a3e46', '#2e3138'],
    edgeRock: '#43464e', edgeRockLit: '#5b606b', haze: '#1a1c21',
    far: '#565c69', farNear: '#484d58',
  },
};

// FNV-1a, the same hash the rest of this codebase seeds with. Deterministic:
// the same district generates the same ground every visit, forever, without
// storing any of it.
function groundHash(a, b, salt) {
  let h = 2166136261;
  const s = (a * 73856093) ^ (b * 19349663) ^ ((salt || 0) * 83492791);
  for (let i = 0; i < 4; i++) {
    h ^= (s >>> (i * 8)) & 255;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// A weighted tone list expanded into the flat array the blotch loop picks
// from, the same shape and for the same reason as `patches`: the weights are
// the data, and expanding them here is what stops them being documentation.
//
// Entry: { tone, weight, alpha?, size: [lo, hi]?, edge: 'hard'?, stack? },
// where the sizes are fractions of a patch and `stack` is the tones drawn
// concentrically inside it, outermost first.
function expandTones(mix) {
  const out = [];
  for (const e of mix) {
    const n = Math.max(1, e.weight | 0);
    const sz = e.size || [];
    for (let i = 0; i < n; i++) {
      out.push({ ink: e.tone, alpha: e.alpha, lo: sz[0], hi: sz[1],
                 hard: e.edge === 'hard', stack: e.stack || null });
    }
  }
  return out;
}

const Outdoors = {
  // Built from the district's LOOK block when it has one, so the five
  // shipping districts are visually distinct without five copies of this
  // code. Falls back to the hand-written palettes for anything else.
  palette(district) {
    // A LAIR WEARS ITS DISTRICT'S LOOK. `lookId` is set by Lairs.district from
    // the room's own `district` field, so the Crucible's hall is Ironworks
    // ground rather than the legacy fall-through table -- see the note there.
    // Anything without one is unaffected.
    // A ROOM WITH A LOOK OF ITS OWN WEARS IT; a room without one wears its
    // district's. The Crucible's hall has one now (lair_crucible above);
    // the other five halls still wear their districts'.
    const own = district && district.id && DISTRICT_LOOKS[district.id];
    const id = (district && ((own && district.id) || district.lookId || district.id)) || 'ironworks';
    const L = DISTRICT_LOOKS[id];
    if (!L) return GROUND_PALETTES[id] || GROUND_PALETTES.ironworks;
    if (this._paletteCache && this._paletteCacheId === id) return this._paletteCache;
    // Weighted bands expanded into the flat list drawGround wants, so the
    // weights actually mean something rather than being documentation.
    const patches = [];
    for (const b of L.ground) {
      for (let i = 0; i < Math.max(1, b.weight); i++) {
        patches.push({ ink: b.tone, name: b.tone, scale: b.scale });
      }
    }
    const p = {
      base: L.ground[0].tone,
      patches,
      scatterSpec: L.scatter,
      scatter: L.scatter.map(s => s.kind),
      haze: L.haze.from,
      hazeBand: L.haze,
      edgeRock: L.far[1],
      edgeRockLit: L.far[0],
      far: L.far[0],
      farNear: L.far[1],
      ambient: L.ambient,
      // AARON'S DECISION A. Read by Props, for the signs AND the windows.
      // A district without one gets the Ironworks' amber rather than a
      // crash, and rather than the old hardcoded three-way split.
      neon: L.neon || { mix: [['#ffb020', 1]], lit: 0.5, windows: 0.10,
                        alpha: 0.85 },
      toneCount: L.tone ? L.tone.count : 5,
      toneAlpha: L.tone ? L.tone.alpha : 0.45,
      // A road surface of the look's own, and whether the ground is bright
      // enough that the world HUD needs a plate behind it (game.js reads it).
      road: L.road || null,
      brightGround: !!L.brightGround,
      // THE TONE LAYER'S OWN PALETTE, WHEN A DISTRICT WANTS ONE.
      //
      // Without this the blotches can only draw from `ground`, which is also
      // the list `_patchQuad` picks a WHOLE CELL from -- and a cell is wider
      // than the screen. So the only way to put a bright tone in the tonal
      // layer was to put it in the patch list, where one roll in n would paint
      // the entire visible world that colour. Molten orange is exactly the
      // tone that cannot survive that: the Ironworks needs the brightest
      // highlights in the game on a few per cent of its ground, and never on
      // all of it.
      //
      // Entries carry their own alpha and size because "the deepest shadow and
      // the brightest highlight" is a statement about specific values, not
      // about one district-wide opacity: a molten spout wants to be nearly
      // opaque and small, and the shade under a gantry wants to be nearly
      // opaque and large. One number for both is one of them wrong.
      toneMix: L.tone && L.tone.mix ? expandTones(L.tone.mix) : null,
      toneEdge: L.tone ? L.tone.edge : null,
    };
    this._paletteCache = p;
    this._paletteCacheId = id;
    return p;
  },

  // ---- 3. GROUND, NOT FLOOR ---------------------------------------------
  // Large-scale variation measured in chunks, with the tile grid deliberately
  // broken: each patch is offset and its corners are pulled around, so no
  // repeat is visible at driving speed. This replaces an arena floor tile
  // outright rather than tinting it, because the tile IS the tell.
  // ==========================================================================
  // THE GROUND, DRAWN ONCE PER CHUNK AND KEPT
  //
  // PERFORMANCE_BUDGET Part 5's first prediction, and the measurement agreed
  // with it for a reason the prediction did not name. At the shipped zoom
  // (0.45 to 0.62) the view is about 4,300 world units across and PATCH is
  // 3,072 — the same as CHUNK — so the ground loop draws about SIXTEEN QUADS a
  // frame. Sixteen paths cannot cost a millisecond by being sixteen calls.
  //
  // Measured by ablation, with the pipeline flushed each frame so the number is
  // about work rather than about when the buffer emptied:
  //
  //     ground, base fillRect      0.754 ms      one fill of the whole view
  //     ground, the patch quads    0.409 ms
  //     scatter                    1.125 ms      ~810 items, 1-5 primitives each
  //     (noise floor)              0.215 ms
  //
  // So it is FILL RATE and PRIMITIVE COUNT, not call count, and both are the
  // same work every frame for a thing that never changes. Which is exactly the
  // case a cache is for.
  //
  // ONE TILE PER CHUNK CELL. PATCH and CHUNK are both 3,072, so a ground cell
  // IS a chunk and the cache lines up with the streaming that already exists.
  // Each tile bakes:
  //
  //   * the base colour, so there is no full-view fill left in the frame;
  //   * its own patch quad AND its eight neighbours', because jitter pushes a
  //     quad's corners up to a third of a patch outside its own cell — the
  //     canvas clips the overhang, which is precisely what is wanted;
  //   * the scatter for the same 3x3, for the same reason.
  //
  // Drawn under the camera as one `drawImage` per visible cell: four or six a
  // frame, one fill, no paths.
  //
  // AND THE SCATTER STOPS BEING A RADIUS. It was drawn within DETAIL_R of the
  // PLAYER, which meant fine detail faded in and out around a moving circle.
  // Baked per chunk it is simply there, everywhere, for less than it cost near
  // the player alone.
  CACHE: true,              // A/B switch for tools/drawtime.py, and a kill
  TILE_PX: 768,             // 3,072 world units per tile: 4 units per pixel
  TILE_MAX: 12,             // ~28 MB, LRU. The view holds six at the widest.
  _tiles: null,
  _tileOrder: null,

  resetTiles() { this._tiles = new Map(); this._tileOrder = []; },

  // The one place that knows a tile can fail. No canvas, no cache, and the
  // live path draws instead — the same promise sprites make.
  // `budget` is how many tiles this frame is still allowed to BUILD. A tile
  // that is already cached costs nothing and never consults it.
  _tile(cx, cy, district, budget) {
    if (!this._tiles) this.resetTiles();
    const key = (district && district.id ? district.id : '?') + '|' + cx + ',' + cy;
    const hit = this._tiles.get(key);
    if (hit !== undefined) return hit;
    if (budget && budget.left <= 0) return null;   // not this frame
    if (budget) budget.left--;

    const S = OUTDOORS.PATCH, N = this.TILE_PX;
    let cv = null;
    try {
      cv = (typeof document !== 'undefined' && document.createElement)
        ? document.createElement('canvas') : null;
      if (cv) {
        cv.width = N; cv.height = N;
        const c = cv.getContext('2d');
        if (!c) cv = null;
        else {
          const P = this.palette(district);
          c.save();
          // World -> tile. After this the bake code is ordinary world-space
          // drawing and reads exactly like the live version it replaced.
          c.scale(N / S, N / S);
          c.translate(-cx * S, -cy * S);
          c.fillStyle = P.base;
          c.fillRect(cx * S, cy * S, S, S);
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              this._patchQuad(c, cx + dx, cy + dy, P);
            }
          }
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              this._toneBlotches(c, cx + dx, cy + dy, P);
            }
          }
          // THE ROADS, BAKED IN TOO.
          //
          // A district's route network is generated from its id and never
          // changes, and it lies flat ON the ground with nothing able to pass
          // behind it -- which is the whole test for whether a thing can be
          // baked. It was being stroked in full, every frame, at 0.338 ms.
          //
          // Between the patches and the scatter, because that is the order
          // the live path draws them in and the scatter belongs on top of a
          // road as much as on top of dirt.
          //
          // NOT IN A LAIR. An interior has no roads -- Neon Cut's street plan
          // was drawing across the Bailiff's plaza until the live path learned
          // that, and a tile that bakes them would put it back.
          if (!(district && district._spec && district._spec.interior)) {
            const A = { x: 0, y: 0,
                        w: (district.cols || 0) * OUTDOORS.PATCH,
                        h: (district.rows || 0) * OUTDOORS.PATCH };
            this.drawRoutes(c, { x: cx * S, y: cy * S, w: S, h: S }, district, A, true);
          }
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              this._scatterCell(c, cx + dx, cy + dy, P);
            }
          }
          c.restore();
        }
      }
    } catch (e) { cv = null; }

    this._tiles.set(key, cv);
    this._tileOrder.push(key);
    while (this._tileOrder.length > this.TILE_MAX) {
      this._tiles.delete(this._tileOrder.shift());
    }
    return cv;
  },

  // ---- TONE BELOW THE PATCH, WHICH IS WHY THE GROUND WAS FLAT ------------
  //
  // AARON'S DECISION B asked for the Sprawl's contrast band to go from 14 to
  // 25 "from LIGHT and TONE, not from more objects", and the first attempt --
  // widening its tonal bands from four values to six, spanning luminance 17 to
  // 81 instead of 45 to 60 -- moved the measurement by EXACTLY NOTHING. Not
  // approximately: the p5, p50 and p95 came back byte-identical.
  //
  // The reason is structural and it applies to every district. `OUTDOORS.PATCH`
  // is 3,072 and one patch is ONE tone, picked per cell. At the shipped zoom
  // the camera sees 1920 / 0.62 = about 3,100 world units across. So the view
  // is one patch wide, THE WHOLE SCREEN IS A SINGLE TONE, and a tonal band
  // list creates contrast between PLACES rather than inside a frame. Six
  // values or sixty, a still screenshot gets one of them.
  //
  // (`scale`, which every band has carried since the drafts were absorbed, was
  // written into the patch objects and never read by anything. It was meant to
  // be exactly this and never got built.)
  //
  // So: a finer layer of the district's own tones, blotched under the scatter
  // at partial alpha. Not more objects -- the same palette at a smaller size,
  // soft enough to read as ground rather than as shapes. It is baked into the
  // chunk tile with everything else, so it costs nothing per frame; that is
  // only affordable because D303 put the ground in a cache first.
  _toneBlotches(ctx, cx, cy, P) {
    const n = P.toneCount || 0;
    const pal = (P.toneMix && P.toneMix.length) ? P.toneMix : P.patches;
    if (!n || !pal.length) return;
    const S = OUTDOORS.PATCH;
    const a0 = P.toneAlpha === undefined ? 0.5 : P.toneAlpha;
    // HARD EDGES ARE A TONE'S PROPERTY, NOT A DISTRICT'S.
    //
    // The first attempt made it a district-wide switch and the render said no
    // in one glance: the Ironworks' SHADE came out as hard-edged black
    // hexagons four hundred pixels across, which is not shade, it is a shape.
    // Soft is right for shade and weather -- an ellipse at that size reads as
    // a tone and a straight edge reads as a painted marking. Hard is right for
    // molten metal, which has a rim and a shoreline, and only at the size
    // molten metal comes in.
    //
    // Both live in the same district, which is exactly what "the brightest
    // highlights AND the deepest shadows" asks for, so the flag went where the
    // difference actually is.
    const dfltHard = P.toneEdge === 'hard';
    for (let i = 0; i < n; i++) {
      const hx = groundHash(cx, cy, 40 + i * 4);
      const hy = groundHash(cx, cy, 41 + i * 4);
      const hk = groundHash(cx, cy, 42 + i * 4);
      const hs = groundHash(cx, cy, 43 + i * 4);
      const p = pal[Math.floor(hk * pal.length) % pal.length];
      // An entry with its own alpha means a value somebody measured, so it is
      // used as one: jittered by a tenth so a field of them is not uniform,
      // not scaled down by up to 40% the way an unspecified one is.
      ctx.globalAlpha = (p.alpha === undefined)
        ? a0 * (0.6 + hs * 0.4)
        : Math.min(1, p.alpha * (0.92 + hs * 0.16));
      ctx.fillStyle = p.ink;
      const lo = (p.lo === undefined) ? 0.14 : p.lo;
      const hi = (p.hi === undefined) ? 0.40 : p.hi;
      const rx = S * (lo + hs * (hi - lo));
      const ry = S * (lo + hx * (hi - lo)) * 0.78;
      const X = cx * S + hx * S, Y = cy * S + hy * S;
      const rot = hk * 3.14;
      const hard = (p.hard === undefined) ? dfltHard : p.hard;
      // A STACK IS ONE POUR, NOT FOUR BLOBS.
      //
      // Four hot tones scattered independently drew four flat orange polygons
      // in unrelated places, and a flat orange polygon is a shape rather than
      // a light. Molten metal is a gradient with a rim on it: black crust at
      // the shoreline, red inside that, the lane, and a white-hot core -- and
      // it is the NESTING that reads as heat, because the eye takes concentric
      // brightness as one thing glowing rather than as several things lying
      // about. Same centre, same rotation, same corner jitter, shrinking
      // radius: one pour, drawn in four fills, baked once.
      const inks = p.stack ? [p.ink].concat(p.stack) : [p.ink];
      const shrink = [1, 0.66, 0.40, 0.18, 0.08];
      for (let s2 = 0; s2 < inks.length; s2++) {
        const k2 = shrink[Math.min(s2, shrink.length - 1)];
        ctx.fillStyle = inks[s2];
        ctx.beginPath();
        if (hard) {
          // Six corners at jittered radii, so the shape is angular and never
          // twice the same -- a spill, not a stamp.
          const co = Math.cos(rot), si = Math.sin(rot);
          for (let k = 0; k < 6; k++) {
            const th = k * (Math.PI / 3);
            const j = 0.62 + groundHash(cx * 7 + i, cy * 11 + k, 60) * 0.76;
            const ux = Math.cos(th) * rx * k2 * j, uy = Math.sin(th) * ry * k2 * j;
            const px = X + ux * co - uy * si, py = Y + ux * si + uy * co;
            if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        } else {
          // Wide and soft. An ellipse rather than a quad because a straight
          // edge at this size reads as a painted marking, which is a thing and
          // not a tone.
          ctx.ellipse(X, Y, rx * k2, ry * k2, rot, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  // ONE PATCH QUAD, the same shape the live path drew, lifted out so the bake
  // and the fallback cannot drift apart.
  _patchQuad(ctx, cx, cy, P) {
    const S = OUTDOORS.PATCH;
    const r = groundHash(cx, cy, 1);
    const p = P.patches[Math.floor(r * P.patches.length) % P.patches.length];
    // Corners pushed around by up to a third of a patch, so the seams are
    // never straight and never line up with the chunk grid underneath.
    const j = (i) => (groundHash(cx, cy, 10 + i) - 0.5) * S * 0.62;
    const X = cx * S, Y = cy * S;
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.moveTo(X + j(0), Y + j(1));
    ctx.lineTo(X + S + j(2), Y + j(3));
    ctx.lineTo(X + S + j(4), Y + S + j(5));
    ctx.lineTo(X + j(6), Y + S + j(7));
    ctx.closePath();
    ctx.fill();
  },

  // ONE CELL OF SCATTER: ruts, scorch, puddles, pebbles, weed. Cheap
  // primitives, irregular, and they do an enormous amount of work -- they are
  // what stops the large patches reading as flat colour fields.
  //
  // Lifted out of drawScatter so the BAKE and the live fallback are the same
  // code. Two copies of a generator that must agree pixel for pixel is a
  // promise nobody can keep.
  //
  // The per-item view cull that used to be here is gone: a baked tile is
  // clipped by the edge of its own canvas, which is the same answer for less.
  _scatterCell(ctx, cx, cy, P) {
    const S = OUTDOORS.PATCH;
    const n = OUTDOORS.SCATTER_PER_PATCH;
    for (let i = 0; i < n; i++) {
      const ax = cx * S + groundHash(cx, cy, 100 + i) * S;
      const ay = cy * S + groundHash(cx, cy, 200 + i) * S;
      const k = groundHash(cx, cy, 300 + i);
      // LOW CONTRAST, per kind. "Detail must never out-contrast the
      // terrain it sits on" - the first pass used flat opaque colours
      // and the ground read as litter rather than as ground.
      if (P.scatterSpec) {
        const sp = P.scatterSpec[Math.floor(k * P.scatterSpec.length) %
                                 P.scatterSpec.length];
        const a = sp.opacity[0] +
          groundHash(cx, cy, 900 + i) * (sp.opacity[1] - sp.opacity[0]);
        ctx.fillStyle = (k > 0.5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') +
          a.toFixed(3) + ')';
      } else {
        ctx.fillStyle =
          P.scatter[Math.floor(k * P.scatter.length) % P.scatter.length];
      }
      if (k < 0.34) {
        // tyre rut / drag mark
        const w = 120 + k * 900, h = 12 + k * 26;
        const rot = groundHash(cx, cy, 400 + i) * Math.PI;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot);
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      } else if (k < 0.62) {
        // scorch / puddle
        const rr = 40 + k * 150;
        ctx.beginPath();
        ctx.ellipse(ax, ay, rr, rr * 0.55, k * 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // pebbles and grit, in a loose cluster
        for (let g = 0; g < 5; g++) {
          const gx = ax + (groundHash(cx, cy, 500 + i * 7 + g) - 0.5) * 220;
          const gy = ay + (groundHash(cx, cy, 600 + i * 7 + g) - 0.5) * 160;
          const gr = 5 + groundHash(cx, cy, 700 + i * 7 + g) * 13;
          ctx.beginPath();
          ctx.arc(gx, gy, gr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },

  drawGround(ctx, view, district) {
    const S = OUTDOORS.PATCH;
    const x0 = Math.floor(view.x / S) - 1, x1 = Math.ceil((view.x + view.w) / S) + 1;
    const y0 = Math.floor(view.y / S) - 1, y1 = Math.ceil((view.y + view.h) / S) + 1;

    const N = this.TILE_PX;
    if (this.CACHE) {
      // ONE BLIT PER VISIBLE CELL, AND ONLY THE VISIBLE ONES.
      //
      // The live path walks x0-1 to x1+1 because a jittered quad reaches up
      // to a third of a patch outside its own cell, so the neighbours have to
      // be drawn for the edges of the view to be covered. A TILE has that
      // overhang baked into it already, so the padding is pure waste — and it
      // was not free waste: it took the working set from nine cells to twenty
      // against a twelve-tile cache, so every frame evicted tiles it was
      // about to need and rebuilt them. The cache measured NINE TIMES SLOWER
      // than no cache, which is what a thrashing cache always measures as.
      const cx0 = Math.floor(view.x / S), cx1 = Math.floor((view.x + view.w) / S);
      const cy0 = Math.floor(view.y / S), cy1 = Math.floor((view.y + view.h) / S);
      // AT MOST ONE NEW TILE A FRAME. A tile costs about 1.7 ms to bake and
      // six are wanted the moment a district opens, which is a 10 ms hole in
      // one frame -- a dropped frame every five seconds of driving, because
      // 3,072 units at 640 u/s is 4.8 seconds a chunk. One per frame is 1.7 ms
      // on six frames and nothing afterwards.
      const budget = { left: 1 };
      let missed = false;
      // WHAT THE GROUND IN THIS FRAME ACTUALLY WAS.
      //
      // Every district screenshot this project ever took was of the FALLBACK
      // ground, and nothing could have said so: a baked tile and the stopgap
      // that stands in for it draw the same district in the same colours, and
      // only one of them has tone, scatter and roads in it. The difference is
      // invisible to anything that does not count it, which is why it survived
      // seventeen blocks of screenshots.
      //
      // So the draw counts it. Two integers a frame, written where the
      // decision is actually made rather than inferred afterwards by a tool
      // doing camera maths. `tools/shot.py` refuses to save a picture whose
      // `fallback` is above zero.
      this.lastGround = { cells: 0, baked: 0, fallback: 0 };
      const G = this.lastGround;
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          G.cells++;
          const t = this._tile(cx, cy, district, budget);
          if (!t) { missed = true; G.fallback++; continue; }
          G.baked++;
          // ONLY THE VISIBLE PART OF EACH TILE.
          //
          // Blitting whole tiles cost MORE than drawing the ground live, and
          // the reason is fill rate rather than anything clever: the view is
          // about 4,300 by 3,300 world units and a cell is 3,072, so six cells
          // cover four times the ground the screen shows. Four times the fill,
          // through a bilinear upscale, against a live path that fills the
          // view twice with flat colour. The cache lost, and deserved to.
          //
          // The nine-argument drawImage takes a source rectangle, so each tile
          // contributes exactly the pixels the view can see and the total blit
          // area IS the view. One times fill, once, for the whole ground.
          const wx0 = Math.max(cx * S, view.x), wx1 = Math.min(cx * S + S, view.x + view.w);
          const wy0 = Math.max(cy * S, view.y), wy1 = Math.min(cy * S + S, view.y + view.h);
          if (wx1 <= wx0 || wy1 <= wy0) continue;
          const k = N / S;
          // SMOOTHING OFF FOR THE GROUND. A tile is 4 world units per pixel
          // and is upscaled about 2.5x, and a bilinear upscale is four taps
          // and a blend PER SCREEN PIXEL. On ground -- dirt, scorch, grit --
          // the filtering buys nothing you can see and costs the whole win.
          const sm = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(t,
            (wx0 - cx * S) * k, (wy0 - cy * S) * k,
            (wx1 - wx0) * k, (wy1 - wy0) * k,
            wx0, wy0, wx1 - wx0, wy1 - wy0);
          ctx.imageSmoothingEnabled = sm;
        }
      }
      if (!missed) return;
      // A CHEAP STOPGAP FOR A CELL WHOSE TILE IS NOT BAKED YET.
      //
      // The first version redrew the full three-by-three neighbourhood --
      // patches AND scatter -- for every missed cell, which is what the BAKE
      // does. Six missed cells meant 4,860 scatter items every frame until
      // the cache filled, and the browser stopped responding entirely: the
      // measurement harness reported only 'the game never became ready',
      // which is true and says nothing. A fallback that costs more than the
      // thing it stands in for is not a fallback.
      //
      // So it is the base colour and this cell's own quad, and nothing else.
      // One or two frames of slightly plainer ground while a tile bakes is
      // not something anybody will see; a frozen game is.
      const P2 = this.palette(district);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const k2 = (district && district.id ? district.id : '?') + '|' + cx + ',' + cy;
          if (this._tiles.get(k2)) continue;
          ctx.fillStyle = P2.base;
          ctx.fillRect(cx * S, cy * S, S, S);
          this._patchQuad(ctx, cx, cy, P2);
        }
      }
      return;
    }

    // THE LIVE PATH IS NOT THE FALLBACK. With the cache off every cell is
    // drawn in full, so this frame's ground is complete -- it just costs what
    // the cache exists to avoid. Recorded so a reader of `lastGround` never
    // sees a stale count from a cached frame.
    const P = this.palette(district);
    this.lastGround = { cells: (x1 - x0 + 1) * (y1 - y0 + 1),
                        baked: (x1 - x0 + 1) * (y1 - y0 + 1), fallback: 0,
                        live: true };
    ctx.fillStyle = P.base;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) this._patchQuad(ctx, cx, cy, P);
    }
  },

  // Fine detail. BAKED INTO THE CHUNK TILE when the cache is on, which is why
  // this is empty in the ordinary case rather than gone: turning the cache off
  // has to give back the same picture, or the A/B measurement is comparing two
  // different games.
  drawScatter(ctx, view, district, px, py) {
    if (this.CACHE) return;
    const P = this.palette(district);
    const S = OUTDOORS.PATCH;
    const R = OUTDOORS.DETAIL_R;
    const x0 = Math.floor((px - R) / S), x1 = Math.floor((px + R) / S);
    const y0 = Math.floor((py - R) / S), y1 = Math.floor((py + R) / S);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) this._scatterCell(ctx, cx, cy, P);
    }
  },

  // ---- 7. ROADS AND RAIL -------------------------------------------------
  // A path implies a world beyond the path. Every route here starts and ends
  // OUTSIDE the district on purpose: a road with two ends inside it is a
  // decoration, and a road that leaves is a promise.
  //
  // Generated from the district id, so a district's road network is fixed
  // forever without anybody drawing one, and hand-placed routes can be added
  // later as data without changing any of this.
  routes(district, arena) {
    const id = (district && district.id) || 'x';
    if (this._routeCache && this._routeCacheId === id) return this._routeCache;
    const out = [];

    // A GRID DISTRICT'S ROADS ARE ITS STREETS.
    //
    // Three wandering routes across a city is a country lane through a housing
    // estate. The Sprawl and Neon Cut place their buildings on a block grid
    // (districtgen's layout switch); this draws the gaps between those blocks
    // as actual road surface, using the SAME block size, so the streets you
    // see are the streets the buildings were laid out along rather than a
    // second, disagreeing set of lines.
    //
    // It also feeds the minimap, which draws routes — so a city reads as a
    // street plan there too, which is most of what makes one navigable.
    const lay = district && district.layout;
    if (lay && lay.kind === 'grid' && arena) {
      const bw = (lay.blockSize && lay.blockSize[0]) || 1400;
      const bh = (lay.blockSize && lay.blockSize[1]) || 2200;
      const road = lay.roadWidth || 340;
      const C = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
      const cols = Math.max(1, Math.round(C / (bw + road)));
      const rows = Math.max(1, Math.round(C / (bh + road)));
      const stepX = C / cols, stepY = C / rows;
      // Streets run the whole width and height of the district, because a
      // street that stops at a chunk boundary is a seam.
      for (let x = 0; x <= arena.w + 1; x += stepX) {
        out.push({ pts: [{ x: arena.x + x, y: arena.y - 400 },
                         { x: arena.x + x, y: arena.y + arena.h + 400 }],
                   w: road, rail: false, street: true });
      }
      for (let y = 0; y <= arena.h + 1; y += stepY) {
        out.push({ pts: [{ x: arena.x - 400, y: arena.y + y },
                         { x: arena.x + arena.w + 400, y: arena.y + y }],
                   w: road, rail: false, street: true });
      }
      this._routeCache = out;
      this._routeCacheId = id;
      return out;
    }

    const n = 3;
    for (let i = 0; i < n; i++) {
      const vert = groundHash(i, 0, 41) > 0.5;
      const t0 = 0.18 + groundHash(i, 1, 42) * 0.64;
      const t1 = 0.18 + groundHash(i, 2, 43) * 0.64;
      const w = 150 + groundHash(i, 3, 44) * 210;
      const rail = groundHash(i, 4, 45) > 0.62;
      const pts = [];
      const STEPS = 7;
      for (let s = 0; s <= STEPS; s++) {
        const u = s / STEPS;
        const t = t0 + (t1 - t0) * u;
        // A wobble, so a road is not a ruler line across the map.
        const wob = (groundHash(i, s, 46) - 0.5) * 0.08;
        const along = -0.12 + u * 1.24;      // starts and ends OUTSIDE
        if (vert) {
          pts.push({ x: arena.x + arena.w * (t + wob), y: arena.y + arena.h * along });
        } else {
          pts.push({ x: arena.x + arena.w * along, y: arena.y + arena.h * (t + wob) });
        }
      }
      out.push({ pts, w, rail });
    }
    this._routeCache = out;
    this._routeCacheId = id;
    return out;
  },

  // `baking` is the tile builder calling in. Everything else is the live
  // per-frame path, which does nothing once the roads are in the tiles.
  drawRoutes(ctx, view, district, arena, baking) {
    if (!arena) return;
    if (this.CACHE && !baking) return;
    const P = this.palette(district);
    for (const r of this.routes(district, arena)) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // The look may own its road surface: Central Dispatch's streets are
      // polished floor, not asphalt. Everywhere else, asphalt.
      const road = P.road || { ink: '#2b2c2e', worn: '#34353a' };
      ctx.strokeStyle = r.rail ? '#20232a' : road.ink;
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.moveTo(r.pts[0].x, r.pts[0].y);
      for (let i = 1; i < r.pts.length; i++) ctx.lineTo(r.pts[i].x, r.pts[i].y);
      ctx.stroke();
      // Worn centre, or sleepers.
      if (r.rail) {
        ctx.strokeStyle = '#3a3a3d';
        ctx.lineWidth = 14;
        for (const off of [-r.w * 0.22, r.w * 0.22]) {
          ctx.beginPath();
          for (let i = 0; i < r.pts.length; i++) {
            const p = r.pts[i];
            if (i === 0) ctx.moveTo(p.x + off, p.y);
            else ctx.lineTo(p.x + off, p.y);
          }
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = road.worn;
        ctx.lineWidth = r.w * 0.42;
        ctx.beginPath();
        ctx.moveTo(r.pts[0].x, r.pts[0].y);
        for (let i = 1; i < r.pts.length; i++) ctx.lineTo(r.pts[i].x, r.pts[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  // ---- 4. FAR SILHOUETTES ------------------------------------------------
  // Things you can see and cannot reach yet. Flat, never collidable, scrolling
  // slower than the world. Drawn inside the world transform by shifting the
  // coordinate toward the view centre, which is parallax without needing a
  // second transform or a screen-space pass.
  // Drawn CLIPPED TO OUTSIDE THE DISTRICT by drawEdges, never over the
  // playable ground. The first version drew them across the middle of the
  // map, which put smokestacks on top of the floor you are fighting on —
  // they are things you can SEE and cannot REACH, so they live in the only
  // part of the world that is exactly that.
  drawParallax(ctx, view, district, arena) {
    const P = this.palette(district);
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    for (let L = OUTDOORS.PARALLAX.length - 1; L >= 0; L--) {
      const layer = OUTDOORS.PARALLAX[L];
      ctx.fillStyle = L === 1 ? P.far : (P.farNear || P.far);
      const step = layer.step;
      // They stand ON the district boundary and rise away from it, so the
      // further out you look the more of the world there turns out to be.
      const bandY = arena ? arena.y - layer.base : view.y + view.h * 0.06;
      const i0 = Math.floor((view.x - step) / step), i1 = Math.ceil((view.x + view.w + step) / step);
      for (let i = i0; i <= i1; i++) {
        const wx = i * step;
        // parallax: pull the position toward the view centre
        const sx = cx + (wx - cx) * layer.factor;
        const h = layer.h * (0.55 + groundHash(i, L, 3) * 0.9);
        const w = step * (0.24 + groundHash(i, L, 4) * 0.5);
        const kind = groundHash(i, L, 5);
        ctx.beginPath();
        if (kind < 0.3) {
          // smokestack
          const sw = w * 0.16;
          ctx.rect(sx - sw / 2, bandY - h, sw, h);
        } else if (kind < 0.6) {
          // scrap mountain
          ctx.moveTo(sx - w / 2, bandY);
          ctx.lineTo(sx - w * 0.18, bandY - h * 0.86);
          ctx.lineTo(sx + w * 0.10, bandY - h * 0.62);
          ctx.lineTo(sx + w / 2, bandY);
        } else {
          // block: a refinery, or the next district's skyline
          const bw = w * 0.7, bh = h * 0.6;
          ctx.rect(sx - bw / 2, bandY - bh, bw, bh);
          ctx.rect(sx - bw * 0.1, bandY - bh * 1.5, bw * 0.22, bh * 0.5);
        }
        ctx.fill();
      }
    }
  },

  // ---- 2. THE EDGE, WHICH IS MOST OF THE PROBLEM -------------------------
  // A wall you can see and drive along says ROOM, and nothing else you do
  // overcomes it. The world still needs bounds; the player must never see the
  // edge as a BUILT SURFACE.
  //
  // So: cliff and rubble falling away from you, then haze that thickens with
  // distance so the far edge fades rather than stops.
  drawEdges(ctx, arena, view, district) {
    const P = this.palette(district);
    // Everything from here on is OUTSIDE the district, so it is clipped to
    // outside it. That single clip is what lets the far silhouettes exist
    // at all without painting over the ground the player is standing on.
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x - 100, view.y - 100, view.w + 200, view.h + 200);
    ctx.rect(arena.x + arena.w, arena.y, -arena.w, arena.h);   // reverse: a hole
    ctx.clip('evenodd');
    const B = OUTDOORS.EDGE_BAND;
    const a = arena;

    // The ground outside the district: broken rock, drawn as irregular slabs
    // stepping away. Only the part of it in view.
    const bands = [
      { x: a.x - B, y: a.y - B, w: a.w + B * 2, h: B },              // north
      { x: a.x - B, y: a.y + a.h, w: a.w + B * 2, h: B },            // south
      { x: a.x - B, y: a.y, w: B, h: a.h },                          // west
      { x: a.x + a.w, y: a.y, w: B, h: a.h },                        // east
    ];
    for (const b of bands) {
      if (b.x > view.x + view.w || b.x + b.w < view.x) continue;
      if (b.y > view.y + view.h || b.y + b.h < view.y) continue;
      ctx.fillStyle = P.haze;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Rubble slabs, deterministic, getting sparser further out.
      const S = 520;
      const gx0 = Math.floor(Math.max(b.x, view.x - S) / S);
      const gx1 = Math.ceil(Math.min(b.x + b.w, view.x + view.w + S) / S);
      const gy0 = Math.floor(Math.max(b.y, view.y - S) / S);
      const gy1 = Math.ceil(Math.min(b.y + b.h, view.y + view.h + S) / S);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const wx = gx * S, wy = gy * S;
          if (wx < b.x || wx > b.x + b.w || wy < b.y || wy > b.y + b.h) continue;
          // How far outside the district this is, 0 at the edge, 1 at the end.
          const d = Math.max(
            (a.x - wx) / B, (wx - (a.x + a.w)) / B,
            (a.y - wy) / B, (wy - (a.y + a.h)) / B, 0);
          const r = groundHash(gx, gy, 7);
          if (r < d * 0.85) continue;             // thins out with distance
          const w = S * (0.5 + groundHash(gx, gy, 8) * 0.8);
          const h = S * (0.34 + groundHash(gx, gy, 9) * 0.7);
          const jx = (groundHash(gx, gy, 11) - 0.5) * S * 0.7;
          const jy = (groundHash(gx, gy, 12) - 0.5) * S * 0.7;
          ctx.fillStyle = r > 0.72 ? P.edgeRockLit : P.edgeRock;
          ctx.beginPath();
          ctx.moveTo(wx + jx, wy + jy);
          ctx.lineTo(wx + jx + w, wy + jy + h * 0.22);
          ctx.lineTo(wx + jx + w * 0.82, wy + jy + h);
          ctx.lineTo(wx + jx - w * 0.1, wy + jy + h * 0.8);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // THE HAZE BAND, and it goes FIRST and LIGHTER than the ground.
    //
    // DRAWING_AT_44 scored the horizon silhouettes as reading like a
    // CEILING, "for want of a light band behind them", and the district
    // drafts say why in one line: dark shapes on a dark background read as
    // a ceiling. So the sky-ward edge of the world is a gradient UP from
    // the district's own ground tone to something much lighter, and the
    // silhouettes are dark shapes standing ON it.
    if (P.hazeBand) {
      const H = P.hazeBand.height * 12;      // world units, not screen px
      const top = arena.y - H;
      const g2 = ctx.createLinearGradient(0, arena.y, 0, top);
      g2.addColorStop(0, P.hazeBand.from);
      g2.addColorStop(1, P.hazeBand.to);
      ctx.fillStyle = g2;
      ctx.fillRect(arena.x - OUTDOORS.EDGE_BAND, top,
        arena.w + OUTDOORS.EDGE_BAND * 2, H);
    }

    // THE FAR SILHOUETTES, standing beyond the boundary and ON the band.
    // Inside the clip, so they can never appear over the playable ground.
    this.drawParallax(ctx, view, district, arena);

    // DUST HAZE. Four gradients, one per side, thickening outward, so the
    // district does not END so much as fade. This is the piece that turns
    // "the level stops here" into "you cannot see any further".
    const H = B * 0.75;
    const g = (x0, y0, x1, y1) => {
      const grd = ctx.createLinearGradient(x0, y0, x1, y1);
      grd.addColorStop(0, 'rgba(11,14,26,0)');
      grd.addColorStop(OUTDOORS.HAZE_FROM, 'rgba(11,14,26,0.35)');
      grd.addColorStop(1, P.haze);
      return grd;
    };
    ctx.fillStyle = g(a.x, a.y + 200, a.x, a.y - H);
    ctx.fillRect(a.x - H, a.y - H, a.w + H * 2, H + 200);
    ctx.fillStyle = g(a.x, a.y + a.h - 200, a.x, a.y + a.h + H);
    ctx.fillRect(a.x - H, a.y + a.h - 200, a.w + H * 2, H + 200);
    ctx.fillStyle = g(a.x + 200, a.y, a.x - H, a.y);
    ctx.fillRect(a.x - H, a.y - H, H + 200, a.h + H * 2);
    ctx.fillStyle = g(a.x + a.w - 200, a.y, a.x + a.w + H, a.y);
    ctx.fillRect(a.x + a.w - 200, a.y - H, H + 200, a.h + H * 2);
    ctx.restore();
  },

  // ---- 6. DIRECTIONAL SHADOWS -------------------------------------------
  // One light direction across everything. Offered as a helper rather than
  // baked into each draw, so a prop opts in with two lines and nothing is
  // blocked on it.
  shadow(ctx, x, y, r, squash) {
    const S = OUTDOORS.SUN;
    ctx.fillStyle = 'rgba(0,0,0,' + S.alpha + ')';
    ctx.beginPath();
    ctx.ellipse(x + r * S.dx * S.len, y + r * S.dy * S.len,
      r * 1.05, r * (squash === undefined ? 0.55 : squash), 0, 0, Math.PI * 2);
    ctx.fill();
  },
};

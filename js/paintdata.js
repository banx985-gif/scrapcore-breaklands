// SCRAPCORE: BREAKLANDS — THE PAINT SHOP'S CATALOGUE (content/draft_paint.js, absorbed)
//
// Four slots per machine and weapon: BODY, TRIM, METAL, DARK.
// EMISSIVE IS NEVER PAINTABLE — the faction read lives in the glow, which is
// what makes the paint shop safe. Weapon muzzle/projectile colour is fixed by
// class and variants never change it.
//
// DATA ONLY: the paint screen, applying a colour to a machine and the unlock
// pipeline are BLOCK 12. tests/test_contentdata.js proves the catalogue is
// well-formed against what exists — every colour parses, every unlock string
// resolves to a real mission, boss, district or garage count — so the day
// Block 12 lands there is nothing to fix first.

const PAINT_SLOTS = ['body', 'trim', 'metal', 'dark'];

const COLOUR_SETS = {
  works: { name: 'WORKS', unlock: 'start',
    colours: {
      worksGrey:    '#6b7280', primerOxide:'#8b602e', oxide:      '#7a6032',
      safetyYellow: '#d9a520', plantGreen: '#3f6b4a', gunmetal:'#3d4552',
      bone:         '#d6d2c4', pitch:      '#1a1d26',
    }},
  candy: { name: 'CANDY', unlock: 'garage:2',
    colours: {
      candyCyan:   '#22d9ff', candyMagenta:'#ff3fa4', candyLime:  '#a8e832',
      candyOrange: '#ff7a1a', candyYellow: '#ffd23f', candyViolet:'#9b5cff',
    }},
  rust: { name: 'RUST', unlock: 'mission:tally_2',
    colours: {
      deepRust: '#6e4924', bloom: '#a4853c', sunBleach: '#c4b49a',
      tar:      '#241f1c', salt:  '#b8bdb5', ash:       '#8a8681',
    }},
  neon: { name: 'NEON', unlock: 'mission:merit_1',
    colours: {
      signMagenta: '#ff2d8f', signAmber: '#ffa519', signWhite: '#f4f7ff',
      deepPlum:    '#3d1c4a', wetBlack:  '#0f1117', hotPink:   '#ff5fb2',
    }},
  foundry: { name: 'FOUNDRY', unlock: 'boss:crucible',
    colours: {
      molten: '#ff9e1f', slag: '#4a3f38', scale:        '#7d6a55',
      ember:  '#c46817', furnaceBlack: '#17130f', pourWhite: '#ffe9c4',
    }},
  civic: { name: 'CIVIC', unlock: 'mission:bolt_2',
    colours: {
      busGreen: '#2f6b4f', kerbWhite: '#e8e6df', civicPlum: '#a82578',
      schoolBlue: '#2f5f9e', doorCream: '#e3d3a8', slate: '#4b5560',
    }},
  growth: { name: 'GROWTH', unlock: 'mission:comb_3', expansion: true,
    colours: {
      algae: '#4a7a3a', fungal: '#b4a05e', polyWhite: '#dfe6df',
      rot:   '#5c4a2e', lampAmber: '#ffbe4d', silage:  '#6f7a3a',
    }},
  deep: { name: 'DEEP', unlock: 'boss:stitcher', expansion: true,
    colours: {
      coolant: '#1fb8a8', sump: '#16323a', seamOchre: '#8a742d',
      dust:    '#b98d63', flood:'#2a4a58', shaftBlack: '#0c1013',
    }},
  dispatch: { name: 'DISPATCH', unlock: 'enter:dispatch', expansion: true,
    colours: {
      dispatchWhite: '#f7fbff', terminalGrey: '#c3cad4', coldCyan: '#7fd4e8',
      floorPale:     '#e4e8ec', signalBlack:  '#0a0c10', labelBlue:'#4a7fbf',
    }},
  prototype: { name: 'PROTOTYPE', unlock: 'per-boss', noRandomise: true,
    colours: {
      crucibleOrange: '#ff6a00', boremawRust: '#b87f2a', bailiffBlue: '#3a6ee8',
      kingmakerGold:  '#e8b23a', stitcherTeal:'#2ab8a8', reaperGreen: '#5a9e3a',
      roadblockGrey:  '#7a8088', patchworkMixed: 'special',   // mismatched panels, deliberately ugly
    }},
};

const DECALS = {
  // NUMBERS — free from the start. Everyone wants a number on their machine.
  numerals:     { group: 'numbers', styles: ['stencil', 'plate', 'handPainted'], unlock: 'start' },
  tallyMarks:   { group: 'numbers', unlock: 'start' },
  // INDUSTRIAL — found in Ironworks and The Digs
  hazardStripes:{ group: 'industrial', unlock: 'found:ironworks' },
  highVoltage:  { group: 'industrial', unlock: 'found:ironworks' },
  loadRating:   { group: 'industrial', unlock: 'found:ironworks' },
  inspection:   { group: 'industrial', unlock: 'found:digs' },
  weldSeam:     { group: 'industrial', unlock: 'found:digs' },
  liftingPoint: { group: 'industrial', unlock: 'found:ironworks' },
  // CIVIC — BOLT mission 2 + found in The Sprawl
  transitRoundel:{ group: 'civic', unlock: 'mission:bolt_2' },
  streetSign:   { group: 'civic', unlock: 'found:sprawl' },
  postalMark:   { group: 'civic', unlock: 'found:sprawl' },
  schoolCrest:  { group: 'civic', unlock: 'found:sprawl' },
  fireService:  { group: 'civic', unlock: 'found:sprawl' },
  municipalSeal:{ group: 'civic', unlock: 'mission:bolt_2' },
  // COMMERCIAL — found in Neon Cut
  neonGlyph:    { group: 'commercial', unlock: 'found:neoncut' },
  adBlock:      { group: 'commercial', unlock: 'found:neoncut' },
  barcode:      { group: 'commercial', unlock: 'found:neoncut' },
  vendingLogo:  { group: 'commercial', unlock: 'found:neoncut' },
  brandMark:    { group: 'commercial', unlock: 'found:neoncut' },
  saleStarburst:{ group: 'commercial', unlock: 'found:neoncut' },
  // NETWORK — the machines' own markings
  assetTag:     { group: 'network', unlock: 'story' },
  classStamp:   { group: 'network', unlock: 'story' },
  workOrderGlyph:{ group: 'network', unlock: 'story' },
  scrapMark:    { group: 'network', unlock: 'story:first10min',
    note: 'the mark that got CLIP reclassified. Wearable, or painted over. If still worn at Central Dispatch, Mags gets ONE line.' },
  // PERSONAL
  hand:         { group: 'personal', unlock: 'found:sprawl_school', unique: true,
    note: 'the ONLY decal a person made. One place. Never repeated, never sold.' },
  spare:        { group: 'personal', unlock: 'found' },
};

const PAINT_RULES = {
  maxDecalsPerMachine: 4,
  maxDecalsPerWeapon: 1,
  emissivePaintable: false,
  randomiseExcludes: ['prototype'],
  perSlotReset: true,             // "as found" per slot
  presets: true,                  // named colourways, apply to any machine
};

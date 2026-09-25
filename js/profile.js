// SCRAPCORE: BREAKLANDS — Profile & Chassis (Milestone 16)
// Everything that lives OUTSIDE a run: which chassis and starter weapon are
// selected, what has been unlocked or discovered, lifetime stats and challenge
// progress. Held in memory for now; Milestone 17 serialises this exact shape
// to local storage, so keep it plain-data and versioned.

// --- Chassis (plan §8) -----------------------------------------------------
const CHASSIS = {
  scrapper: {
    id: 'scrapper', name: 'SCRAPPER', color: '#22d9ff',
    hp: 100, power: 14, speed: 640, dashCd: 2.8, recoilTaken: 1,
    blurb: 'Balanced. The maintenance unit you woke up as.',
    unlock: null,
  },
  runner: {
    id: 'runner', name: 'RUNNER', color: '#a8e832',
    hp: 80, power: 14, speed: 736, dashCd: 2.3, recoilTaken: 1,
    blurb: 'Fast and aggressive. Less Core to hide behind.',
    unlock: 'Defeat Crusher',
  },
  tank: {
    id: 'tank', name: 'TANK', color: '#ff7a1a',
    hp: 130, power: 16, speed: 544, dashCd: 3.2, recoilTaken: 0.8,
    blurb: 'Slow and sturdy. Built for heavy loadouts.',
    unlock: 'Defeat Furnace',
  },
};
const CHASSIS_LIST = ['scrapper', 'runner', 'tank'];

// Only these four may be taken into a run as the starting weapon (plan §8).
const STARTER_WEAPONS = ['machineGun', 'scattergun', 'saw', 'arcGun'];

// `mul` scales the encounter budget (how much the director spends), `dmg`
// scales damage dealt TO the player. EASY is available from the start —
// nobody should have to earn the right to enjoy the game.
const DIFFICULTIES = {
  easy:      { id: 'easy',      name: 'EASY',      mul: 0.95, dmg: 0.45, hp: 0.55, cell: 1,    score: 0.7,  color: '#22d9ff', alwaysOpen: true },
  normal:    { id: 'normal',    name: 'NORMAL',    mul: 1,    dmg: 0.85, hp: 1,    cell: 0.85, score: 1,    color: '#a8e832', alwaysOpen: true },
  hard:      { id: 'hard',      name: 'HARD',      mul: 1.2,  dmg: 1.2,  hp: 1.15, cell: 0.7,  score: 1.35, color: '#ff7a1a' },
  overdrive: { id: 'overdrive', name: 'OVERDRIVE', mul: 1.35, dmg: 1.35, hp: 1.3,  cell: 0.55, score: 1.8,  color: '#ff3b3b' },
};
const DIFFICULTY_LIST = ['easy', 'normal', 'hard', 'overdrive'];

// --- Palettes (plan §56) — cosmetic, player Core only ---------------------
const PALETTES = {
  original: { id: 'original', name: 'SCRAPYARD',  body: '#ff7a1a', glow: '#ffd23f', alwaysOpen: true },
  coolant:  { id: 'coolant',  name: 'COOLANT',    body: '#22d9ff', glow: '#a8e832' },
  ember:    { id: 'ember',    name: 'EMBER',      body: '#ff3b3b', glow: '#ffd23f' },
  circuit:  { id: 'circuit',  name: 'CIRCUIT',    body: '#9b5cff', glow: '#22d9ff' },
  hazard:   { id: 'hazard',   name: 'HAZARD',     body: '#ffd23f', glow: '#ffffff' },
};
const PALETTE_LIST = ['original', 'coolant', 'ember', 'circuit', 'hazard'];

// --- Challenges (plan §55) — the 18 permanent goals ------------------------
// CHALLENGES.
//
// Seven of the original eighteen came out in the Block 0 audit, because the
// events that completed them no longer fire and a challenge you cannot
// complete is worse than no challenge at all — it reads as a bug in the save.
//
//   SCRAP KING / MELTDOWN / THE FIRST NODE   needed `bossDefeated`. The three
//     bosses are compiled and orphaned; nothing spawns them until Block 14.
//   HARDWIRED / ZERO FAULTS                  needed `victory`. There is no run
//     to win.
//   UNTOUCHABLE / BARE CORE                  needed `encounterClear`. There are
//     no encounters to clear.
//
// They are DELETED rather than hidden, so this list stays a true statement of
// what the game asks of you. Block 9 owns progression and can bring the ideas
// back against whatever it builds — a district cleared, a lair beaten.
//
// RECLAIMER and HOT SWAP kept their goals but not their wording: their
// counters were reset per encounter and now never reset, so they are lifetime
// counts and the text says so.
const CHALLENGES = [
  { id: 'handsOff',    name: 'HANDS OFF',      desc: 'Kill 10 machines with hazards.', goal: 10 },
  { id: 'tooHot',      name: 'TOO HOT',        desc: 'Stay above 80 Heat for 10 seconds.', goal: 1 },
  { id: 'scrapFort',   name: 'SCRAP FORTRESS', desc: 'Fill every root socket.', goal: 1 },
  { id: 'minefield',   name: 'MINEFIELD',      desc: 'Kill three machines with one mine chain.', goal: 1 },
  { id: 'surgical',    name: 'SURGICAL',       desc: 'Strip every part from a machine before killing it.', goal: 1 },
  { id: 'overkill',    name: 'OVERKILL',       desc: 'Fire four weapons at once.', goal: 1 },
  { id: 'reclaimer',   name: 'RECLAIMER',      desc: 'Rip three parts from living machines.', goal: 1 },
  { id: 'hotSwap',     name: 'HOT SWAP',       desc: 'Replace four parts on the move.', goal: 1 },
  { id: 'sawblade',    name: 'SAWBLADE',       desc: 'Kill 20 machines with the Saw.', goal: 20 },
  { id: 'powerHungry', name: 'POWER HUNGRY',   desc: 'Reach 20 Power capacity.', goal: 1 },
  // Goal tracks the catalogue as it grows (24 ZERO parts, +5 Structure at
  // M6, more with later maps) — a challenge that completed at 24 while 29
  // existed would be lying.
  { id: 'fullCat',     name: 'FULL CATALOGUE', desc: 'Discover the whole catalogue.', goal: PART_LIST.length },
];

// Parts available from first install (plan §52).
const STARTING_PARTS = [
  'machineGun', 'scattergun', 'cannon', 'saw', 'mineLayer', 'armourPlate',
  'smallReactor', 'radiator', 'targetingModule', 'magnetAmplifier',
  'thruster', 'dashBooster',
];

const Profile = {
  VERSION: 1,

  chassis: 'scrapper',
  starter: 'machineGun',
  difficulty: 'normal',
  palette: 'original',

  unlockedChassis: ['scrapper'],
  unlockedDifficulties: ['easy', 'normal'],
  unlockedParts: [],         // parts that may APPEAR in a run at all (§53)
  discovered: [],            // parts the player has actually seen (catalogue)
  challenges: {},            // id -> progress number
  stats: {},

  // Flow flags (M20): shown-once experiences.
  tutorialDone: false,
  introSeen: false,
  endingSeen: false,

  STAT_KEYS: ['runs', 'victories', 'deaths', 'enemiesDestroyed', 'partsDestroyed',
              'partsRipped', 'partsAttached', 'partsLost', 'bossesDefeated',
              'overheats', 'dashes', 'playTime', 'bestLevel', 'fastestVictory'],

  reset() {
    this.chassis = 'scrapper';
    this.starter = 'machineGun';
    this.difficulty = 'normal';
    this.palette = 'original';
    this.unlockedPalettes = PALETTE_LIST.filter(id => PALETTES[id].alwaysOpen);
    this.unlockedChassis = ['scrapper'];
    this.unlockedDifficulties = ['easy', 'normal'];
    this.unlockedParts = STARTING_PARTS.slice();
    this.discovered = STARTING_PARTS.slice();
    this.challenges = {};
    for (const c of CHALLENGES) this.challenges[c.id] = 0;
    this.stats = {};
    for (const k of this.STAT_KEYS) this.stats[k] = 0;
    this.tutorialDone = false;
    this.introSeen = false;
    this.endingSeen = false;
  },

  // --- unlocks -------------------------------------------------------------
  hasChassis(id) { return this.unlockedChassis.indexOf(id) >= 0; },
  hasDifficulty(id) { return this.unlockedDifficulties.indexOf(id) >= 0; },
  hasPart(id) { return this.discovered.indexOf(id) >= 0; },
  partUnlocked(id) { return this.unlockedParts.indexOf(id) >= 0; },
  hasPalette(id) { return this.unlockedPalettes.indexOf(id) >= 0; },

  // Refuses locked content and returns false, so the UI can explain why.
  selectPalette(id) {
    if (!PALETTES[id] || !this.hasPalette(id)) return false;
    this.palette = id;
    return true;
  },

  unlockPalette(id) {
    if (PALETTES[id] && !this.hasPalette(id)) {
      this.unlockedPalettes.push(id);
      return true;
    }
    return false;
  },

  // The colours the player's Core is actually drawn in.
  get paletteData() { return PALETTES[this.palette] || PALETTES.original; },

  // Unlocking a part both admits it to the game and reveals it in the
  // catalogue — you are told what you earned.
  unlockPart(id) {
    if (PART_LIST.indexOf(id) < 0 || this.partUnlocked(id)) return false;
    this.unlockedParts.push(id);
    this.discover(id);
    return true;
  },

  unlockChassis(id) {
    if (CHASSIS[id] && !this.hasChassis(id)) {
      this.unlockedChassis.push(id);
      return true;
    }
    return false;
  },

  unlockDifficulty(id) {
    if (DIFFICULTIES[id] && !this.hasDifficulty(id)) {
      this.unlockedDifficulties.push(id);
      return true;
    }
    return false;
  },

  // Called whenever a part is seen on the battlefield or bolted on.
  discover(id) {
    if (!PARTS[id] || PART_LIST.indexOf(id) < 0 || this.hasPart(id)) return false;
    this.discovered.push(id);
    this.setChallenge('fullCat', this.discovered.length);
    return true;
  },

  // --- stats / challenges --------------------------------------------------
  bump(key, n = 1) {
    if (this.stats[key] === undefined) this.stats[key] = 0;
    this.stats[key] += n;
  },

  best(key, value) {
    if (!this.stats[key] || value > this.stats[key]) this.stats[key] = value;
  },

  fastest(key, value) {
    if (!this.stats[key] || value < this.stats[key]) this.stats[key] = value;
  },

  addChallenge(id, n = 1) {
    if (this.challenges[id] === undefined) this.challenges[id] = 0;
    const c = CHALLENGES.find(k => k.id === id);
    if (!c || this.challenges[id] >= c.goal) return false;
    this.challenges[id] += n;
    const done = this.challenges[id] >= c.goal;
    if (done) this._maybeChallengePalette();
    return done;                            // true on the completing hit
  },

  challengesDone() {
    return CHALLENGES.filter(c => (this.challenges[c.id] || 0) >= c.goal).length;
  },

  _maybeChallengePalette() {
    if (this.challengesDone() >= 9) this.unlockPalette('hazard');
  },

  setChallenge(id, value) {
    const c = CHALLENGES.find(k => k.id === id);
    if (!c) return false;
    const was = this.challenges[id] || 0;
    if (value <= was) return false;
    this.challenges[id] = Math.min(value, c.goal);
    const done = was < c.goal && this.challenges[id] >= c.goal;
    if (done) this._maybeChallengePalette();
    return done;
  },

  challengeDone(id) {
    const c = CHALLENGES.find(k => k.id === id);
    return !!c && (this.challenges[id] || 0) >= c.goal;
  },

  challengesComplete() {
    return CHALLENGES.filter(c => this.challengeDone(c.id)).length;
  },

  // --- selection helpers ---------------------------------------------------
  selectChassis(id) {
    if (!this.hasChassis(id)) return false;
    this.chassis = id;
    return true;
  },

  selectStarter(id) {
    if (STARTER_WEAPONS.indexOf(id) < 0 || !this.hasPart(id)) return false;
    this.starter = id;
    return true;
  },

  selectDifficulty(id) {
    if (!this.hasDifficulty(id)) return false;
    this.difficulty = id;
    return true;
  },

  get chassisData() { return CHASSIS[this.chassis]; },
  get difficultyData() { return DIFFICULTIES[this.difficulty]; },
};

Profile.reset();

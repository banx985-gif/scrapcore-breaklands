// SCRAPCORE: BREAKLANDS — Grades and the Yard Rack (Milestone 2)
// Master v3.2 §15.
//
// This is the collection system, and it is deliberately NOT random loot: a
// part has a Grade and nothing else. No affixes, no rolls, no duplicates to
// compare. You either own a better copy of a thing or you do not.
//
// The loop M2 exists to prove:
//   1. find a better-Grade part in a map and bolt it on
//   2. cross a screen boundary alive  -> RECOVERY SCAN banks it permanently
//   3. die later                      -> the banked copy is still yours
//   4. start again measurably stronger
//
// Step 2 is the whole design. A part you are merely CARRYING is not yours yet.

const GRADES = {
  G1: { id: 'G1', n: 1, name: 'SCRAP',    colour: '#8fa3c8', symbol: 'I',
        output: 1.00, durability: 1.00 },
  G2: { id: 'G2', n: 2, name: 'TUNED',    colour: '#a8e832', symbol: 'II',
        output: 1.08, durability: 1.10 },
  G3: { id: 'G3', n: 3, name: 'MIL-SPEC', colour: '#22d9ff', symbol: 'III',
        output: 1.18, durability: 1.20 },
  G4: { id: 'G4', n: 4, name: 'WARDEN',   colour: '#9b5cff', symbol: 'IV',
        output: 1.30, durability: 1.35 },
  G5: { id: 'G5', n: 5, name: 'CROWN',    colour: '#ffd23f', symbol: 'V',
        output: 1.45, durability: 1.50 },
};

const GRADE_ORDER = ['G1', 'G2', 'G3', 'G4', 'G5'];

// Master §15: Grade must be readable WITHOUT colour alone, so every Grade
// carries a Roman numeral as well as a colour. Colour-blind players and a
// phone in sunlight are the same problem.
function gradeLabel(id) {
  const g = GRADES[id] || GRADES.G1;
  return g.symbol + ' ' + g.name;
}

const Rack = {
  MAX_COPIES: 2,            // Master §15: two permanent copies per type

  copies: {},               // partId -> ['G1','G2'] , best first
  pending: [],              // recovered this screen, not yet banked
  access: 'G1',             // highest Grade the Campaign has unlocked

  reset() {
    this.copies = {};
    this.pending = [];
    this.access = 'G1';
  },

  // Master §9 new-save starting machine: one G1 Armour Plate, a permanent
  // Rack copy. The G1 Machine Gun that sat beside it is gone (Q8, 20 Sept
  // 2026): the permanent MACHINE GUN on the machine's own ring is the one
  // gun a new save starts with, and a Rack copy is a second gun one garage
  // visit away whether or not the loadout bolts it on.
  startingRack() {
    this.reset();
    this.copies.armourPlate = ['G1'];
  },

  accessN() { return GRADES[this.access].n; },
  setAccess(id) { if (GRADES[id]) this.access = id; },

  owned(partId) { return (this.copies[partId] || []).slice(); },
  ownsAny(partId) { return (this.copies[partId] || []).length > 0; },

  best(partId) {
    const list = this.copies[partId];
    if (!list || !list.length) return null;
    return list.reduce((a, b) => (GRADES[b].n > GRADES[a].n ? b : a));
  },

  bestN(partId) {
    const b = this.best(partId);
    return b ? GRADES[b].n : 0;
  },

  outputMul(partId) {
    const b = this.best(partId);
    return b ? GRADES[b].output : 1;
  },

  // Would banking this Grade actually improve the Rack? Used to decide whether
  // a pickup is worth telling the player about.
  isImprovement(partId, gradeId) {
    if (!GRADES[gradeId]) return false;
    const list = this.copies[partId] || [];
    if (list.length < this.MAX_COPIES) return true;
    return GRADES[gradeId].n > Math.min(...list.map(g => GRADES[g].n));
  },

  // ---- RECOVERY SCAN (Master §15) ----------------------------------------
  // Physically recover the part, then cross a screen boundary. If you die
  // first, the unbanked recovery is lost — which is what makes carrying
  // something valuable across a screen a decision rather than a formality.
  // ---- THE CARRY LIMIT (CONTENT_ECONOMY Part 6) --------------------------
  //
  // "The unbanked haul. THIS IS THE TENSION THE WHOLE LOOP RESTS ON."
  //
  // It did not exist. `pending.push` was uncapped, so you could carry the
  // entire district home and there was never a moment where the next part
  // cost you a drive. Every downstream system was built assuming this: the
  // unbanked HUD readout, the wreck you leave on death, the greed the design
  // keeps talking about — and `cargoRack`'s +4, which was promising a bonus
  // to a number that was not being enforced anywhere.
  //
  // Base 12, and modules add. SKILLS MUST NEVER RAISE IT — the design is
  // explicit and the reason is good: if they did, the tension would decay
  // exactly as the player got good enough to earn big hauls. The only way to
  // carry more is to spend a socket on it.
  //
  // IT WAS 8 UNTIL D368, AND 8 WAS BANKING TOO OFTEN. CONTENT_ECONOMY Part 9
  // wants 8–15 minutes between banking runs; the opening, measured through a
  // booted game, ran at 7.2 — under the floor. The carry filled before the
  // trip out was worth making, which is the exact failure Part 9 names: "much
  // shorter → garages are too close, or the carry limit is too low."
  //
  // THE FIX IS TO CARRY MORE, NOT LESS. The gap is how long the carry takes
  // to fill, so the only way to lengthen it without moving a garage or
  // touching a price is to raise the cap. 12 is a half again on 8, and the
  // sim puts the gap at 10.8 — mid-band, with room either side. It also
  // leaves `cargoRack`'s +4 worth a socket: 12 with none fitted, 16 with one.
  // The measurement is in DECISIONS D368.
  BASE_CARRY: 12,

  // Through the ONE socket reader (js/parts.js). It walked its own sockets
  // here first and that was fine while it was the only module effect wired;
  // it stopped being fine the moment there were six, because six copies of a
  // socket walk is six places that can disagree about whether a part is on.
  carryLimit(ent) {
    return this.BASE_CARRY + Modules.sum(ent, 'carryBonus');
  },

  carryFull(ent) { return this.pending.length >= this.carryLimit(ent); },

  offer(partId, gradeId) {
    if (!PARTS[partId] || !GRADES[gradeId]) return false;
    if (this.pending.some(p => p.partId === partId && p.gradeId === gradeId)) return false;
    // FULL MEANS FULL. Refused rather than silently dropping the oldest: a
    // haul that quietly rewrites itself is a haul the player cannot reason
    // about, and "I have to go and bank" is the decision this limit exists
    // to force.
    if (this.carryFull()) return false;
    this.pending.push({ partId, gradeId });
    return true;
  },

  clearPending() { this.pending = []; },

  // Called when a screen is cleared / crossed. Returns what was banked so the
  // game can say so out loud.
  bankPending() {
    const banked = [];
    for (const p of this.pending) {
      if (this.add(p.partId, p.gradeId)) banked.push(p);
    }
    this.pending = [];
    return banked;
  },

  // Master §15: max two copies, each storing a Grade. A third copy replaces
  // the worst one only if it beats it; anything that does not improve the Rack
  // converts to SCRAP instead of cluttering it.
  add(partId, gradeId) {
    if (!GRADES[gradeId]) return false;
    const list = this.copies[partId] || (this.copies[partId] = []);
    if (list.length < this.MAX_COPIES) {
      list.push(gradeId);
      list.sort((a, b) => GRADES[b].n - GRADES[a].n);
      return true;
    }
    let worstIdx = 0;
    for (let i = 1; i < list.length; i++) {
      if (GRADES[list[i]].n < GRADES[list[worstIdx]].n) worstIdx = i;
    }
    if (GRADES[gradeId].n > GRADES[list[worstIdx]].n) {
      list[worstIdx] = gradeId;
      list.sort((a, b) => GRADES[b].n - GRADES[a].n);
      return true;
    }
    return false;          // non-improving: the caller converts it to SCRAP
  },

  typesOwned() { return Object.keys(this.copies).filter(k => this.copies[k].length); },

  snapshot() {
    const out = {};
    for (const k of Object.keys(this.copies)) out[k] = this.copies[k].slice();
    // THE UNBANKED HAUL, and SAVE_FORMAT names it as one of the three fields
    // most likely to be forgotten:
    //
    //   "carrying[] - unbanked parts MUST survive a quit. If they don't,
    //    QUITTING BECOMES A WAY TO AVOID THE DEATH PENALTY - or worse, an
    //    accidental way to suffer it."
    //
    // It was forgotten. Every banked copy was saved and the haul in your
    // hands was not, so quitting on a full rack was a free bank and quitting
    // on a good run was a silent death.
    return {
      copies: out, access: this.access,
      pending: this.pending.map(x => ({ partId: x.partId, gradeId: x.gradeId })),
    };
  },

  restore(d) {
    this.reset();
    if (!d) return false;
    // Unknown parts and grades are dropped rather than restored broken - the
    // same rule the banked copies below use, for the same reason.
    for (const x of (d.pending || [])) {
      if (!x || !PARTS[x.partId] || !GRADES[x.gradeId]) continue;
      if (this.pending.length >= this.carryLimit()) break;
      this.pending.push({ partId: x.partId, gradeId: x.gradeId });
    }
    for (const k of Object.keys(d.copies || {})) {
      if (!PARTS[k]) continue;                       // unknown part: ignored
      const list = (d.copies[k] || []).filter(g => !!GRADES[g]).slice(0, this.MAX_COPIES);
      if (list.length) this.copies[k] = list;
    }
    if (GRADES[d.access]) this.access = d.access;
    return true;
  },
};

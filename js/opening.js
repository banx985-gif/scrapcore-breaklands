// SCRAPCORE: BREAKLANDS — THE FIRST TWENTY MINUTES
//
// content/CONTENT_OPENING.md opens by calling itself "the hardest twenty
// minutes in the project, and nothing covered them." It is still the part
// every player sees and the part most likely to decide whether they see any
// of the rest.
//
// ---------------------------------------------------------------------------
// THE PROBLEM IT SOLVES
//
// The game asks a player to understand five things no other game has taught
// them, and FOUR OF THEM ARE THE GAME:
//
//   1. Shooting a CONNECTOR is different from shooting a MODULE
//   2. Connectors are INBOARD, so you have to FLANK
//   3. You can RIP a part off a machine that is still fighting
//   4. What you carry ISN'T YOURS until you reach a garage
//   5. Your machine is something you BUILD, not something you upgrade
//
// "Teach them in the wrong order and the player concludes it's a twin-stick
//  shooter with inventory, plays it that way, and never finds the actual
//  game."
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE IS, AND WHAT IT IS NOT
//
// It is NOT a tutorial system. The document is explicit and the rules are
// non-negotiable:
//
//   * No pop-ups explaining verbs. Every lesson is taught by a situation the
//     player solves themselves.
//   * Never teach two things at once.
//   * Nothing is gated behind understanding. A player who misses a lesson
//     still progresses; the world teaches them again later.
//   * The player is never told they did something clever.
//   * Mags comments. Mags never instructs.
//
// So what this owns is the ORDER, and the handful of first-district
// exceptions that make the order land:
//
//   THE LEDGER      which lessons have been delivered, and when. Not shown to
//                   the player - it is what decides whether the yard keeps
//                   offering a lesson that has not landed.
//   THE REPEAT      "the player kills the second PICKER without noticing the
//                   connector. FINE - A THIRD ARRIVES. The yard should keep
//                   offering the lesson until it lands."
//   THE HIGHLIGHT   "the connector highlight is the load-bearing visual
//                   affordance in the entire game. IN THE FIRST DISTRICT IT
//                   SHOULD BE BRIGHTER THAN IT WILL EVER BE AGAIN, and fade
//                   to normal after the first few kills."
//   THE QUIET YARD  "the yard never raises alert." One district in the game
//                   is deliberately simple and it must stay that way.
//   THE ONE SCREEN  the build screen opens ONCE, automatically, at the first
//                   bank - which is how lessons 4 and 5 arrive together.
//
// Everything else the document asks for is already in the world: the picker,
// the pair of stackers with armour in front of their connectors, the grabber
// with the saw, HOB, the loader to tow, the elite, the wall. This is the
// thread that runs through them.

// ---------------------------------------------------------------------------
// THE BEATS, in the document's own order and with its own timings. Data, so
// the order is a thing you can read and a thing a test can check rather than
// an emergent property of where machines happen to be standing.
//
// `at` is the minute mark. `teaches` is null for a beat that deliberately
// teaches no verb - and there are four of them, which is the point: more than
// a third of the opening is spent NOT teaching, because a lesson every ninety
// seconds is a tutorial and this is not one.
const OPENING_BEATS = [
  { id: 'belt', at: 0, place: 'yard',
    what: 'you wake up already being taken somewhere',
    teaches: null, lesson: 'what you are. No verbs yet.',
    needs: 'coldOpen' },
  { id: 'driving', at: 0.5, place: 'yard',
    what: 'ninety seconds of empty ground and a working, empty world',
    teaches: null, lesson: 'movement, and that this place is working and empty',
    needs: null },
  { id: 'firstMachine', at: 2, place: 'yard',
    what: 'a PICKER. Kill it and its gun dies with it. A second walks up.',
    teaches: 'connector', lesson: 'shoot the connector, not the module',
    needs: 'yard_first' },
  { id: 'bolt', at: 3.5, place: 'yard',
    what: 'the magnet, a loose part, an empty socket',
    teaches: 'fit', lesson: 'parts are yours to take and to wear',
    needs: null },
  { id: 'stacker', at: 5, place: 'yard',
    what: 'armour mounted IN FRONT of the connector. No hint, no prompt.',
    teaches: 'flank', lesson: 'connectors are inboard. You have to flank.',
    needs: 'yard_pair_a', silent: true },
  { id: 'hob', at: 7, place: 'yard',
    what: 'the first person, the first mission, and a wreck worth hooking',
    // NOT one of the five. It teaches something real, and the document lists
    // it as a lesson - but the five are the five, and a sixth in the same
    // field would quietly widen the claim the whole file is making.
    teaches: null, also: 'tow',
    lesson: 'towing exists, it is slow, things are worth dragging home',
    needs: 'hob' },
  { id: 'bank', at: 9, place: 'yard',
    what: 'the garage. It banks with a flourish and the build screen opens once.',
    teaches: 'bank', lesson: 'carried is not owned, and you build this thing yourself',
    needs: 'garage' },
  { id: 'rip', at: 11, place: 'yard',
    what: 'a GRABBER with a saw, and a connector that rattles below 25%',
    teaches: 'rip', lesson: 'you can take a part off a machine that is still fighting',
    needs: 'yard_saw' },
  { id: 'elite', at: 13, place: 'yard',
    what: "THE FOREMAN'S HAND. Deep crimson, six modules, one glowing. Not yet.",
    teaches: null, lesson: 'the world is fixed, not scaled. Some things are for later.',
    needs: 'yard_elite' },
  { id: 'wall', at: 15, place: 'yard',
    what: 'a collapsed rack. Nothing you own touches it. No prompt says what would.',
    teaches: null, lesson: 'the map is bigger than you, and it will open',
    needs: 'yard_rack_wall' },
  { id: 'driveOut', at: 17, place: 'yard',
    what: 'the exit to Ironworks, and a horizon with a furnace on it',
    teaches: null, lesson: 'the world is enormous and it is still working',
    needs: 'exit' },
];

// THE FIVE LESSONS, and the order they must arrive in. Separate from the beat
// list because the ORDER is the claim the document makes and the beats are
// only where it happens - if somebody moves a machine, this is the thing that
// still says what the opening is for.
const OPENING_LESSONS = ['connector', 'fit', 'flank', 'bank', 'rip'];

const Opening = {
  // ---- THE LEDGER --------------------------------------------------------
  // Which lessons have landed. Kept on Progress so it survives a save, and
  // NEVER SHOWN TO THE PLAYER: it exists to decide whether the yard keeps
  // offering something, not to give anybody a checklist.
  _led() {
    if (typeof Progress === 'undefined') return {};
    Progress.taught = Progress.taught || {};
    return Progress.taught;
  },

  taught(id) { return !!this._led()[id]; },

  // Called from wherever the lesson actually lands - never from a timer, and
  // never from a place that only knows the player COULD have learned it.
  learn(id) {
    if (OPENING_LESSONS.indexOf(id) < 0) return false;
    if (this.taught(id)) return false;
    this._led()[id] = true;
    if (typeof Progress !== 'undefined' && typeof Progress.save === 'function') {
      Progress.save();
    }
    return true;
  },

  // How far through the five. Used by the highlight below and by nothing
  // else: it is a fade, not a score.
  learned() {
    let n = 0;
    for (const l of OPENING_LESSONS) if (this.taught(l)) n++;
    return n;
  },

  // ---- THE HIGHLIGHT -----------------------------------------------------
  // "The connector highlight is THE LOAD-BEARING VISUAL AFFORDANCE IN THE
  //  ENTIRE GAME. In the first district it should be brighter than it will
  //  ever be again, and fade to normal after the first few kills."
  //
  // Returns a multiplier on the connector strut's weight and glow. It fades
  // on LESSONS LANDED rather than on a timer or a kill count, because what it
  // is compensating for is not knowing yet - and a player who has understood
  // in ninety seconds should not be shouted at for another ten minutes.
  HIGHLIGHT_MAX: 2.1,
  highlightMul() {
    if (typeof World === 'undefined' || !World.district) return 1;
    if (World.district.id !== 'yard') return 1;      // the first district only
    const k = Math.min(1, this.learned() / 3);        // the first three
    return 1 + (this.HIGHLIGHT_MAX - 1) * (1 - k);
  },

  // ---- THE YARD RAISES NO ALERT ------------------------------------------
  // "The Yard has one garage, one NPC, one elite, one wall and NO ALERT. It
  //  is the only district in the game that is deliberately simple, and it
  //  must stay that way however tempting it is to fill."
  //
  // Asked by Alert.add, which is the one writer - so this is one condition in
  // one place and not a flag every alert source has to remember.
  alertAllowed() {
    if (typeof World === 'undefined' || !World.district) return true;
    return World.district.id !== 'yard';
  },

  // ---- THE YARD KEEPS OFFERING THE LESSON --------------------------------
  // "The player kills the second PICKER without noticing the connector.
  //  FINE - A THIRD ARRIVES. The yard should keep offering the lesson until
  //  it lands."
  //
  // The one thing in this file that puts a machine in the world, and it does
  // it through Population.spawnBuild like everything else. It stops the
  // moment the lesson lands, which is why the ledger exists.
  REPEAT_EVERY: 26,        // seconds between offers
  REPEAT_R: 1500,          // how far out one walks up from
  REPEAT_MAX: 4,           // ...and how many times it will try

  _repT: 0,
  _repN: 0,

  // The repeat offer's clock, reset "for a new run". Nothing in the game
  // calls it -- there is no run to begin in an open world -- and three
  // suites reset the offer with it, so it stays as a fixture and sits on
  // the boot sim's unreached list by name (D351).
  resetRun() { this._repT = 0; this._repN = 0; },

  // Ticked every frame. Silent and does nothing at all outside the Yard, or
  // once the connector lesson has landed - which for most players is inside
  // the first three minutes and after that this file is dead weight, exactly
  // as it should be.
  update(dt, player) {
    if (typeof World === 'undefined' || !World.district) return;
    if (World.district.id !== 'yard') return;
    if (this.taught('connector') || this._repN >= this.REPEAT_MAX) return;
    // Only once the first one is gone: a second PICKER while the first is
    // still alive is not a second chance, it is a fight.
    if (typeof World.wasKilled !== 'function' ||
        !World.wasKilled('yard_first')) return;
    if (typeof Population === 'undefined' || !Population.spawnBuild) return;
    for (const m of Population.machines) {
      if (m.alive && m.openingPicker) return;      // one at a time
    }
    this._repT -= dt;
    if (this._repT > 0) return;
    this._repT = this.REPEAT_EVERY;
    const a = Math.random() * Math.PI * 2;
    const e = Population.spawnBuild('picker',
      player.x + Math.cos(a) * this.REPEAT_R,
      player.y + Math.sin(a) * this.REPEAT_R);
    if (e) { e.openingPicker = true; this._repN++; }
  },

  // ---- THE HONEST REPORT -------------------------------------------------
  // Every beat the document describes, and whether the thing it needs is
  // actually in the world. A beat whose machine nobody placed is twenty
  // minutes with a hole in it, and the hole is invisible until somebody
  // plays it.
  unplaced() {
    const out = [];
    for (const b of OPENING_BEATS) {
      if (!b.needs) continue;
      if (!this.placed(b.needs)) out.push(b.id + ' needs ' + b.needs);
    }
    return out;
  },

  placed(what) {
    const d = (typeof DISTRICTS !== 'undefined') ? DISTRICTS.yard : null;
    if (!d || !d._spec) return false;
    const sp = d._spec;
    if (what === 'coldOpen') {
      return typeof OPENING !== 'undefined' && !!OPENING.beats &&
             OPENING.beats.length > 0;
    }
    if (what === 'garage') return (sp.garages || []).length > 0;
    if (what === 'exit') return (sp.exits || []).length > 0;
    if (what === 'hob') {
      return !!(typeof NPCS !== 'undefined' && NPCS.hob && NPCS.hob.at &&
                NPCS.hob.district === 'yard');
    }
    // ...otherwise it is an id in one of the placement tables.
    for (const [rows, i] of [[sp.placed, 2], [sp.barriers, 3],
                             [sp.wrecks, 2], [sp.findsAt, 3]]) {
      for (const k of Object.keys(rows || {})) {
        for (const row of rows[k]) if (row[i] === what) return true;
      }
    }
    return false;
  },

  // THE FIVE-MINUTE TEST, as data. "By 5:00 they have: driven, killed
  // something, shot a part off a machine and bolted it onto themselves, and
  // started circling a target because the front doesn't work. If any of those
  // four is missing at the five-minute mark, THE OPENING IS IN THE WRONG
  // ORDER."
  firstFive() { return OPENING_BEATS.filter(b => b.at <= 5); },
};

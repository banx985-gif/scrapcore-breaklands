// SCRAPCORE: BREAKLANDS — Tutorial, story and end-of-run flow (Milestone 20)
// Plan §57 (tutorial inside the first real run), §59 (story delivery as short
// text cards — no voice, no cutscenes), §60 (ending), §61 (death), §62/§63
// (results). Everything here is Canvas text over reused game art.

// ---------------------------------------------------------------------------
// TUTORIAL (plan §57): no separate tutorial level. Prompts appear during the
// first real run and advance when the player actually does the thing.
const Tutorial = {
  STEPS: [
    { id: 'move',   text: 'MOVE',            hint: 'left thumb' },
    { id: 'aim',    text: 'AIM & FIRE',      hint: 'right thumb' },
    { id: 'joint',  text: 'SHOOT THE JOINT', hint: 'the small link between a part and its core' },
    { id: 'magnet', text: 'HOLD MAGNET',     hint: 'pull the loose part in' },
    { id: 'attach', text: 'ATTACH IT',       hint: 'release to bolt it on' },
  ],

  active: false,
  step: 0,
  t: 0,
  doneT: 0,

  start() {
    this.active = !Profile.tutorialDone;
    this.step = 0;
    this.t = 0;
    this.doneT = 0;
  },

  get current() { return this.active ? this.STEPS[this.step] : null; },

  // Gameplay reports what happened; the tutorial only advances on the real
  // action, so nobody can skip ahead by waiting.
  did(what) {
    if (!this.active) return;
    const cur = this.STEPS[this.step];
    if (!cur || cur.id !== what) return;
    this.step++;
    this.doneT = 0.9;
    if (this.step >= this.STEPS.length) this.finish();
  },

  finish() {
    this.active = false;
    Profile.tutorialDone = true;
    if (typeof Save !== 'undefined') Save.save();
  },

  update(dt) {
    if (this.doneT > 0) this.doneT = Math.max(0, this.doneT - dt);
    if (this.active) this.t += dt;
  },

  draw() {
    if (this.doneT > 0) {
      R.text('\u2713', 960, 250, 90, CONFIG.COLOR.lime);
    }
    const cur = this.current;
    if (!cur) return;
    const s = Display.safe;
    const y = s.top + 210;
    const pulse = 0.75 + 0.25 * Math.sin(this.t * 4);
    R.roundRect(960 - 380, y - 46, 760, 108, 18, 'rgba(5,6,14,0.82)',
      CONFIG.COLOR.yellow, 6);
    R.ctx.globalAlpha = pulse;
    R.text(cur.text, 960, y, 54, CONFIG.COLOR.yellow);
    R.ctx.globalAlpha = 1;
    // Six pixels higher than it was: at y + 40 a 24-point line's descenders
    // sat on the panel's yellow border, and the hint measured 2.9:1 against
    // the yellow under its last five pixels.
    R.smallText(cur.hint, 960 - 180, y + 32, 24, CONFIG.COLOR.steel);
  },
};

// ---------------------------------------------------------------------------
// PLAYTEST 2 ITEM 6 — THE FOUND RECORD.
//
// The one owner of "which fragments has this save found". The record itself
// is `Progress.story.fragments = { id: true }`, saved and restored with the
// rest of Progress (validated against FRAGMENTS at the door, the way
// lastDistrictId is validated against DISTRICTS) — but it is only ever
// WRITTEN here, through find(). The QUESTIONS tab, the world object and the
// tests all read through this, so there is exactly one answer to "have I
// found that".
//
// storydata.js stays data (content/README.md's rule); this is the system.
// ---------------------------------------------------------------------------
// MAGS ON THE RADIO
//
// 47 lines have been written since the content library landed and NOTHING HAS
// EVER READ THEM. The pool is the only voice in the game — CLIP never speaks —
// so an unwired radio is a game with no one in it.
//
// THE RULES, from draft_story.js, and every one of them is a constraint on
// this file rather than on the writer:
//
//   "Mags comments. She never instructs. She never says 'press X'."
//   "Radio never ducks combat. If a line lands mid-fight, the fight wins and
//    the line queues."
//
// That second one is the whole design of this object. The obvious build plays
// a line the moment its event fires, which means the best writing in the game
// arrives underneath a boss and nobody reads a word of it. So: events fire
// whenever they like, lines go in a QUEUE, and the queue drains only when you
// are not in a fight.
//
// `player.inCombat` is the flag D241 built, which is the same one the Cheetah's
// sprint and the FUEL CELL read. One answer to "am I in a fight", used by
// everything that needs to know.
const Radio = {
  QUEUE_MAX: 3,             // past this the oldest is dropped, not stacked
  HOLD: 5.4,                // seconds a line stays up
  GAP: 1.1,                 // and the beat between two of them
  NO_REPEAT: 6,             // ambient lines: how many others before one returns

  line: null,               // { text, event } currently on screen
  t: 0,
  _q: [],
  _recent: [],              // ids of the last few ambient lines played

  // ---- THE QUIET ---------------------------------------------------------
  // Ten AMBIENT lines and one LONG ABSENCE line, and neither is an event that
  // anything can fire: they are what MAGS says when nothing is happening.
  //
  // Which is the point of them. The world is a continent with deliberate empty
  // stretches in it (WORLD_SCALE: "a continent needs quiet ground or the busy
  // ground means nothing"), and a long quiet drive with nobody in it is the
  // one place this game can feel like a screensaver. She is what stops that.
  //
  // The timer only runs when you are NOT in a fight, so a long fight does not
  // buy you an ambient line the second it ends, and it resets whenever she
  // says anything at all - including a line somebody else fired.
  AMBIENT_EVERY: 95,        // seconds of quiet before she says something
  ABSENCE_AFTER: 420,       // and how long before she notices it has been a while
  _quiet: 0,
  _sinceLine: 0,

  reset() {
    this.line = null; this.t = 0; this._q = []; this._recent = [];
    this._quiet = 0; this._sinceLine = 0;
  },

  _heard() {
    if (typeof Progress === 'undefined') return {};
    Progress.radioHeard = Progress.radioHeard || {};
    return Progress.radioHeard;
  },

  // A line's identity. The pool has no ids of its own - it is authored prose -
  // so one is derived from the event and the position, which is stable as long
  // as nobody reorders the file and harmless if they do.
  _id(entry, i) { return entry.event + ':' + i; },

  // WHICH LINE, for an event. `once` lines are spent; everything else is
  // weighted, and an ambient line that played recently steps aside so the
  // pool feels deeper than it is.
  pick(event) {
    if (typeof RADIO === 'undefined') return null;
    const heard = this._heard();
    const opts = [];
    for (let i = 0; i < RADIO.length; i++) {
      const e = RADIO[i];
      if (e.event !== event) continue;
      const id = this._id(e, i);
      if (e.once && heard[id]) continue;
      if (this._recent.indexOf(id) >= 0) continue;
      for (let w = 0; w < Math.max(1, e.weight || 1); w++) opts.push({ e, id });
    }
    if (!opts.length) return null;
    return opts[Math.floor(Math.random() * opts.length)];
  },

  // FIRE. Called from wherever the thing actually happens - never from a
  // timer that guesses. Returns true if a line was queued, which is what a
  // caller needs to know and all it needs to know.
  //
  // The record is written HERE, at the moment the line is chosen, not when it
  // reaches the screen: a first kill is a first kill whether or not you were
  // in a fight when the queue got to it, and a `once` line that could re-fire
  // because the player died before hearing it would be a first time twice.
  fire(event) {
    // "Mags stops too, and she knew that when you asked her."
    if (typeof Story !== 'undefined' && Story.shutDown && Story.shutDown()) return false;
    const got = this.pick(event);
    if (!got) return false;
    if (got.e.once) this._heard()[got.id] = true;
    else {
      this._recent.push(got.id);
      while (this._recent.length > this.NO_REPEAT) this._recent.shift();
    }
    this._q.push({ text: got.e.text, event: event, id: got.id });
    // NEWEST WINS. A backlog means several things happened at once, and the
    // oldest of them is the least likely to still be what the player is
    // looking at.
    //
    // EXCEPT A SCENE. This used to `shift()` blindly, so an ambient line
    // fired while the reclassification scene sat in the queue threw away the
    // start of it -- the line where she says there is no good moment. Same
    // rule as `sequence`: drop chatter, never a scene.
    this._trim();
    return true;
  },

  // Convenience for the one event shape that is generated rather than named:
  // arriving somewhere. Silent for a district with no line rather than
  // inventing one.
  enter(districtId) { return this.fire('enter_' + districtId); },

  // A SCENE IS NOT A LINE, and it cannot go through `fire`.
  //
  // `pick` chooses ONE entry at random out of the pool, and `QUEUE_MAX` throws
  // away all but the newest three — so `SCENE_RECLASSIFICATION`, which is four
  // consecutive lines in which MAGS tells you she is the one who reclassified
  // you, would have arrived as its last three lines in a random order if it had
  // ever arrived at all.
  //
  // So a scene queues WHOLE, IN ORDER, and is exempt from the trim. Safe,
  // because a scene fires once and Scenes is what enforces that; the trim
  // exists for events that can pile up, and a thing that happens once cannot.
  //
  // It still waits for the fight to end, like everything else on this queue.
  // The best writing in the game arriving underneath a boss is the failure
  // this whole object was built around, and a scene is the writing it was
  // most about.
  sequence(lines, id) {
    if (!Array.isArray(lines) || !lines.length) return false;
    for (let i = 0; i < lines.length; i++) {
      this._q.push({ text: lines[i], event: 'scene', id: id + ':' + i, scene: true });
    }
    // Trim only the non-scene entries, oldest first, so a backlog of ambient
    // chatter cannot eat a scene and a scene cannot eat itself.
    this._trim();
    return true;
  },

  // Oldest first, chatter only. A scene is never trimmed, which is safe
  // because Scenes fires each one once and a thing that happens once cannot
  // pile up.
  _trim() {
    while (this._q.length > this.QUEUE_MAX) {
      const i = this._q.findIndex(q => !q.scene);
      if (i < 0) break;
      this._q.splice(i, 1);
    }
  },

  // THE FIGHT WINS. Nothing comes off the queue while you are in one, and a
  // line already on screen when a fight starts is cut short rather than left
  // sitting over the top of it.
  update(dt, player) {
    const fighting = !!(player && player.inCombat);

    // THE QUIET, measured before anything else so a line that plays this
    // frame resets it rather than being counted as more silence.
    if (fighting) {
      this._quiet = 0;
    } else if (!this.line && !this._q.length) {
      this._quiet += dt;
      this._sinceLine += dt;
      if (this._sinceLine >= this.ABSENCE_AFTER && this.fire('long_absence')) {
        this._sinceLine = 0; this._quiet = 0;
      } else if (this._quiet >= this.AMBIENT_EVERY && this.fire('ambient')) {
        this._quiet = 0;
      }
    }

    if (this.line) {
      this.t -= fighting ? dt * 6 : dt;
      if (this.t <= 0) { this.line = null; this.t = this.GAP; }
      return;
    }
    if (this.t > 0) { this.t -= dt; return; }
    if (fighting || !this._q.length) return;
    this.line = this._q.shift();
    this.t = this.HOLD;
    this._quiet = 0;
    this._sinceLine = 0;
  },

  // The honest report: every event the pool writes for, and whether anything
  // in the codebase ever fires it. A line nobody can trigger is a line nobody
  // will ever hear.
  events() {
    const out = {};
    if (typeof RADIO === 'undefined') return out;
    for (const e of RADIO) out[e.event] = (out[e.event] || 0) + 1;
    return out;
  },

  draw(ctx) {
    if (!this.line || typeof R === 'undefined') return;
    const s = Display.safe;
    // TOP OF THE SCREEN, on its own. Every other message in this game lives
    // at the bottom - prompts, tow readout, fragments - and Mags is not a
    // prompt. Putting her anywhere near them would make her look like one.
    // BELOW the top-left HUD block, not level with it. The first shot had
    // her strip overlapping the unbanked-parts bar and the district name -
    // two things the player reads constantly - which is the cost of putting
    // anything at the top of a screen that already has something there.
    // AND SHE YIELDS TO THE TUTORIAL, WHICH WAS DELETING HER.
    //
    // Tutorial.draw puts a 760x108 panel at 960-380, s.top+164 and is called
    // AFTER Radio.draw -- the comment above says she is drawn last so nothing
    // paints over her, and something did, completely. Both had independently
    // picked "top of the screen, on its own, at about 210", which is what
    // happens when two files each choose a y out of Display.safe.
    //
    // The tutorial wins the lane: it is five steps in one session and it is an
    // instruction, and MAGS is ambient for the whole game. She moves down to
    // clear its box by 24 pixels while it is up, and takes the lane back the
    // moment it is finished. Measured by tools/hudcheck.py.
    let y = s.top + 214;
    if (typeof Tutorial !== 'undefined' && Tutorial.current) y = s.top + 330;
    // AND SHE LEAVES THE LEFT COLUMN ALONE. At 1180 her box begins exactly
    // where the alert bar ends, and the bar's own warning line used to run
    // past it -- she is drawn last and paints over whatever is under her, so
    // an overlap here is not a shared corner, it is a deleted warning.
    // 1120 puts a 30-pixel gutter between them at 1920 wide, and the clamp
    // below already handles anything narrower.
    const w = Math.min(1120, (s.right - s.left) - 200);
    const cx = (s.left + s.right) / 2;
    // A fade at both ends, so she does not blink in and out.
    const k = Math.min(1, Math.min(this.t, this.HOLD - this.t) / 0.45);
    ctx.save();
    ctx.globalAlpha = Math.max(0, k);
    R.roundRect(cx - w / 2, y - 34, w, 68, 10, 'rgba(8,10,18,0.82)',
      CONFIG.COLOR.magenta, 3);
    R.smallText('MAGS', cx - w / 2 + 22, y - 14, 18, CONFIG.COLOR.magenta);
    R.smallText(this.line.text, cx, y + 6,
      R.fitText(this.line.text, 24, w - 60), '#e8ddc8', 'center');
    ctx.restore();
  },
};

const Story = {
  // THE STORY GATE into CENTRAL DISPATCH (`gateIn: 'story:final'`). The
  // reclassification scene -- MAGS telling you she is the one who filed you
  // as scrap, which is the story's hinge -- and both shipping lairs beaten.
  // Part 3's map puts the Stacks between the city and the floor; the Stacks
  // do not ship, so this is the gate.
  finalOpen() {
    const sc = typeof Scenes !== 'undefined' && Scenes.played('mags_reclassification');
    const L = typeof Lairs !== 'undefined';
    return !!(sc && L && Lairs.beaten('crucible') && Lairs.beaten('bailiff'));
  },
  // What is missing, in the order it would be done. Never "locked".
  finalRefusal() {
    if (typeof Scenes !== 'undefined' && !Scenes.played('mags_reclassification')) {
      return 'MAGS HAS SOMETHING TO TELL YOU FIRST';
    }
    if (typeof Lairs !== 'undefined' && !Lairs.beaten('crucible')) return 'THE CRUCIBLE FIRST';
    if (typeof Lairs !== 'undefined' && !Lairs.beaten('bailiff')) return 'THE BAILIFF FIRST';
    return null;
  },
  // SHUT IT DOWN, and everything stops. Read by the radio (Mags stops too),
  // by Population (the harvesters halt) and by the neon (the lights go out).
  shutDown() {
    return !!(typeof Progress !== 'undefined' && Progress.ending === 'shutdown');
  },
  // The live record. Created on first touch so a pre-item-6 save gains it
  // the moment anything asks.
  record() {
    if (typeof Progress === 'undefined') return {};
    Progress.story = Progress.story || {};
    if (!Progress.story.fragments) Progress.story.fragments = {};
    return Progress.story.fragments;
  },

  found(id) { return !!this.record()[id]; },

  // Reading a fragment in the world. First find fills the record and saves;
  // a reread returns false and writes nothing, so callers can tell the
  // difference without a second flag.
  find(id) {
    if (typeof FRAGMENTS === 'undefined' || !FRAGMENTS[id]) return false;
    const rec = this.record();
    if (rec[id]) return false;
    rec[id] = true;
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    return true;
  },

  byQuestion(q) {
    if (typeof FRAGMENTS === 'undefined') return [];
    return Object.keys(FRAGMENTS).filter(id => FRAGMENTS[id].question === q);
  },

  progress(q) {
    const ids = this.byQuestion(q);
    let n = 0;
    for (const id of ids) if (this.found(id)) n++;
    return { found: n, total: ids.length };
  },

  // The fragment the ACTION button would read: nearest Fragment in the live
  // world within reading range. Same shape as Barriers.nearest, and the same
  // list — a fragment is chunk-owned, so an unloaded one is simply not here.
  nearest(player) {
    if (typeof World === 'undefined' || typeof Fragment === 'undefined') return null;
    let best = null, bd = FRAG.READ_R;
    for (const e of World.entities) {
      if (!(e instanceof Fragment)) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
};

// ---------------------------------------------------------------------------
// INTRO CARDS — Master v3.2 §7.
//
// M0 removed SCRAPCORE: ZERO's story text (the Line, the node count, Z-0).
// None of it survives; WRECKJACK is a separate game in the same franchise with
// its own story (Master §0).
//
// What is here is the LOCKED §7 opening, used verbatim, so the intro state
// machine has real data to drive rather than placeholder strings. Cutscene
// PRODUCTION is M43 and the campaign meta engine is M20 — neither is being
// pre-empted. The seizure notice and the Mags/CLIP exchange are already locked
// design, so using them costs nothing and keeps Standing Rule 6 (no placeholder
// systems) honest.
// PLAYTEST 2, ITEM 5 - THE OPENING.
//
// What was here was six text cards: Crown Forge's seizure notice, Yard 13's
// six unfinished Jackrigs, and Mags and CLIP doing a bit about how many of
// them actually move. That is WRECKJACK's premise, read off a black screen
// before anything has happened, in a game that no longer has Yard 13 in it.
//
// It is replaced by the cold open CONTENT_OPENING.md already specified: forty
// seconds on a sorting belt, in engine, drawn with primitives, teaching the
// one thing the whole first hour rests on - "the first thing the game teaches
// is that you are cargo". See OPENING and OpeningScene in js/cutscene.js.
//
// INTRO_CARDS is kept, and it is not a leftover. A player who has watched the
// opening once should not have to watch it again to find out what it said, so
// the Story Archive replays it as text, and the beats that CARRY text are
// where that text comes from - one source, so the archive cannot drift away
// from the scene.
const INTRO_CARDS = OPENING.beats
  .filter(b => b.text || b.line || b.log)
  .map(b => ({
    text: b.text || (b.speaker ? b.speaker + ': "' + b.line + '"' : '> ' + b.log),
    sub: '',
    warn: false,
  }));

class IntroState {
  enter() {
    this.buttons = new UIButtons();
    this.buttons.add('SKIP', Display.safe.right - 220, Display.safe.bottom - 118,
      200, 76, () => this._done(),
      { size: 26, quiet: true, color: 'rgba(16,20,36,0.8)', textColor: '#8fa3c8' });
    // Cutscene owns the beats and OpeningScene owns the belt; this state only
    // owns the fact that watching it to the end starts the game.
    Cutscene.playSequence(OPENING, OpeningScene, () => this._done());
    this._ended = false;
  }
  onResize() {
    // NOT enter(): rotating the phone would restart the opening from black.
    // Only the button needs replacing.
    this.buttons = new UIButtons();
    this.buttons.add('SKIP', Display.safe.right - 220, Display.safe.bottom - 118,
      200, 76, () => this._done(),
      { size: 26, quiet: true, color: 'rgba(16,20,36,0.8)', textColor: '#8fa3c8' });
  }

  _done() {
    // Guarded, because both the sequence finishing and the SKIP button call
    // this - and the sequence's own callback fires from inside skip().
    if (this._ended) return;
    this._ended = true;
    if (Cutscene.playing) Cutscene.skip();
    Profile.introSeen = true;
    // M20 Archive flag: the Story Archive (M39) replays what has been SEEN,
    // and seen is recorded here, at the moment of seeing.
    if (typeof Progress !== 'undefined') {
      Progress.story = Progress.story || {};
      Progress.story.introSeen = true;
      Progress.save();
    }
    if (typeof Save !== 'undefined') Save.save();
    Game.switch('GAME');
  }

  update(dt) {
    if (typeof UINav !== 'undefined') UINav.update(this.buttons);
    Cutscene.update(dt);
    // A sequence that has run out has already called _done through its own
    // callback; this is the belt-and-braces for a state entered some other
    // way, and costs nothing.
    if (!Cutscene.playing) this._done();
  }

  pointerDown(id, x, y) {
    if (this.buttons.hit(x, y)) return;
    // A TAP IS ONE BEAT, NOT THE WHOLE SCENE. Skipping is a button, and it is
    // labelled - a player tapping to hurry a beat along should not lose the
    // opening for it, and a player who wants out has an unmissable way out.
    Cutscene.nextBeat();
  }

  render() {
    R.clear('#04050c');
    Cutscene.draw(R.ctx);
    this.buttons.draw();
  }
}

// ---------------------------------------------------------------------------
// THERE IS NO RESULTS SCREEN. WRECKJACK's score card (scoreRun, ResultsState,
// RUN AGAIN) sat here for the whole of BREAKLANDS and nothing could reach it:
// Block 3.3 replaced dying with waking at your last garage -- "not a results
// screen, not a run over: there is no run" -- and the one tap that still got
// there was cut in D326. The class, the scoring and the run summary that fed
// them are gone rather than fenced: a screen a player cannot reach is not a
// feature, it is 130 lines the boot sim could stub without noticing.

// ---------------------------------------------------------------------------
// THE ENDING (CONTENT_STORY Part 5). Three cards on the way onto the
// allocation floor, then the choice, then MAGS, then the result -- and then
// the save CONTINUES. "Three endings. All valid. None correct. No ending is
// scored, ranked or unlocked in sequence. Whichever you pick, the save
// continues and you can go back out."
//
// The five WRECKJACK cards that were here (KINGMAKER OFFLINE, PARK OUTSIDE,
// FRESH SALVAGE) were the fork's ending, pinned by a suite and reachable by
// nothing; the day the DISPATCHER became reachable they would have played
// after it. The words are BREAKLANDS' now, and the words are ENDINGS' own.
const ENDING_SHOTS = [
  { text: 'THE ALLOCATION FLOOR.', kind: 'screens', hold: 3.4,
    sub: 'A WALL OF SCREENS. EVERY DISTRICT YOU HAVE CROSSED, LIVE.' },
  { text: 'THE DISPATCHER IS NOT A MIND.', kind: 'field', hold: 4.0,
    sub: 'A SCHEDULER WITH A REQUIREMENT FIELD THAT HAS READ THE SAME VALUE FOR FOUR HUNDRED YEARS.' },
  { text: 'MAGS: "WELL. HERE WE ARE."', kind: 'mags', hold: 3.2,
    sub: 'THREE THINGS YOU CAN DO. NONE OF THEM IS THE RIGHT ONE.' },
];
const ENDING_LIST = ['shutdown', 'desk', 'walk'];

class EndingState {
  enter() {
    this.i = 0;
    this.t = 0;
    this.phase = 'cards';            // cards -> choose -> mags -> result
    this.choice = null;
    this.line = 0;
    this.build();
  }
  onResize() { this.build(); }

  build() {
    const s = Display.safe;
    this.buttons = new UIButtons();
    if (this.phase === 'cards') {
      this.buttons.add('SKIP', s.right - 220, s.bottom - 110, 200, 80,
        () => { this.phase = 'choose'; this.t = 0; this.build(); },
        { size: 28, color: '#232b44', textColor: '#fff' });
    } else if (this.phase === 'choose') {
      // THE THREE, side by side, in the order the story doc gives them. No
      // ordering by merit: there is none.
      const w = 500, gap = 40, x0 = 960 - (w * 3 + gap * 2) / 2;
      ENDING_LIST.forEach((id, i) => {
        this.buttons.add(ENDINGS[id].title, x0 + i * (w + gap), 620, w, 130,
          () => this._choose(id), { size: 40, color: CONFIG.COLOR.yellow });
      });
    } else if (this.phase === 'mags') {
      this.buttons.add('NEXT', s.right - 220, s.bottom - 110, 200, 80,
        () => this._advance(), { size: 28, color: '#232b44', textColor: '#fff' });
    } else {
      this.buttons.add('BACK TO THE YARD', 960 - 260, s.bottom - 150, 520, 100,
        () => this._done(), { size: 34, color: CONFIG.COLOR.lime, textColor: CONFIG.COLOR.ink });
    }
  }

  _choose(id) {
    if (!ENDINGS[id]) return;
    this.choice = id;
    this.line = 0;
    this.t = 0;
    // WRITTEN THE MOMENT IT IS CHOSEN, not when the screen is dismissed: a
    // choice is a thing that happened.
    if (typeof Progress !== 'undefined') {
      Progress.ending = id;
      if (Progress.save) Progress.save();
    }
    this.phase = 'mags';
    this.build();
  }

  _advance() {
    const E = ENDINGS[this.choice];
    this.t = 0;
    if (this.line < E.mags.length - 1) { this.line++; return; }
    this.phase = 'result';
    this.build();
  }

  // THE SAVE CONTINUES. Back to the Yard, on foot, in whatever world the
  // choice left behind.
  _done() {
    Profile.endingSeen = true;
    if (typeof Save !== 'undefined') Save.save();
    if (typeof Progress !== 'undefined') {
      Progress.lastDistrictId = 'yard';
      if (Progress.save) Progress.save();
    }
    Game.switch('GAME');
  }

  update(dt) {
    if (typeof UINav !== 'undefined') UINav.update(this.buttons);
    this.t += dt;
    if (this.phase === 'cards') {
      const shot = ENDING_SHOTS[this.i];
      if (shot && this.t > shot.hold) {
        this.t = 0;
        this.i++;
        if (this.i >= ENDING_SHOTS.length) { this.phase = 'choose'; this.build(); }
      }
    }
  }

  pointerDown(id, x, y) {
    if (this.buttons.hit(x, y)) return;
    if (this.phase === 'cards') {
      this.t = 0;
      this.i++;
      if (this.i >= ENDING_SHOTS.length) { this.phase = 'choose'; this.build(); }
    } else if (this.phase === 'mags') {
      this._advance();
    }
  }

  // The allocation floor as a backdrop for every phase: white, lit, even.
  // The one bright screen in the game, because the one bright place.
  _floor(ctx, k) {
    R.rect(0, 0, 1920, 1080, '#e4e8ec');
    for (let i = 0; i < 12; i++) {
      const on = (i * 7) % 3 !== 0;
      R.rect(120 + i * 140, 120, 110, 260, on ? '#f6f8fa' : '#c8d0d8', '#b8c0c8', 4);
      if (on) {
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 2 + i);
        R.rect(140 + i * 140, 150, 70, 8, CONFIG.COLOR.white);
        ctx.globalAlpha = 1;
      }
    }
    R.rect(0, 420, 1920, 6, '#c8d0d8');
  }

  render() {
    const ctx = R.ctx;
    R.clear(CONFIG.COLOR.ink);
    const k = Math.min(this.t / 0.8, 1);
    this._floor(ctx, k);
    if (this.phase === 'cards') {
      const shot = ENDING_SHOTS[Math.min(this.i, ENDING_SHOTS.length - 1)];
      if (shot.kind === 'field') {
        // The requirement field, and its one value.
        R.roundRect(560, 470, 800, 120, 8, '#ffffff', '#b8c0c8', 4);
        R.smallText('REQUIREMENT', 600, 496, 22, '#8a94a0');
        R.smallText('SCRAP', 600, 530, 40, CONFIG.COLOR.ink);
      } else if (shot.kind === 'mags') {
        R.circle(960, 520, 46, CONFIG.COLOR.magenta, CONFIG.COLOR.ink, 6);
      }
      ctx.globalAlpha = Math.min(1, k * 1.4);
      R.text(shot.text, 960, 860, 56, CONFIG.COLOR.ink, 'center', false);
      if (shot.sub) R.smallText(shot.sub, 960, 906, 24, '#3a4450', 'center');
      ctx.globalAlpha = 1;
    } else if (this.phase === 'choose') {
      R.text('THE QUEUE IS YOURS.', 960, 500, 64, CONFIG.COLOR.ink, 'center', false);
      R.smallText('THREE ENDINGS. ALL VALID. NONE CORRECT.', 960, 550, 26, '#3a4450', 'center');
    } else if (this.phase === 'mags') {
      const E = ENDINGS[this.choice];
      // Her colour, but INK-DARK: the radio's magenta is 2.6:1 on the white
      // floor, and this is the one screen in the game where she speaks on
      // white. tools/hudcheck.py, the first time it measured the last screen.
      R.smallText('MAGS', 960, 480, 26, '#a8186a', 'center');
      R.text('"' + E.mags[this.line] + '"', 960, 560,
        R.fitText('"' + E.mags[this.line] + '"', 40, 1500), CONFIG.COLOR.ink, 'center', false);
    } else {
      // THE RESULT, over the world it leaves behind: the skyline painting,
      // when the art has loaded, is every factory to the horizon -- still
      // running, or cooling, or yours.
      const E = ENDINGS[this.choice];
      const drew = typeof Assets !== 'undefined' &&
        Assets.sprite(ctx, 'ending_skyline', 960, 540, 1920, 1080, 0);
      if (drew) R.rect(0, 420, 1920, 300, 'rgba(228,232,236,0.88)');
      R.text(E.title, 960, 480, 56, CONFIG.COLOR.ink, 'center', false);
      R.smallText(E.result, 960, 560, R.fitText(E.result, 24, 1500), '#3a4450', 'center');
    }
    this.buttons.draw();
  }
}

// ---------------------------------------------------------------------------
// CREDITS (plan §88 store-ready basics). Reachable from Settings later.
class CreditsState {
  enter() {
    this.buttons = new UIButtons();
    this.buttons.add('BACK', 960 - 160, Display.safe.bottom - 140, 320, 100,
      () => Game.switch('HOME'), { size: 36, color: CONFIG.COLOR.yellow });
  }
  onResize() { this.enter(); }
  update() { if (typeof UINav !== 'undefined') UINav.update(this.buttons); }
  pointerDown(id, x, y) { this.buttons.hit(x, y); }
  render() {
    R.clear(CONFIG.COLOR.bg);
    drawFloorGrid();
    R.text('SCRAPCORE: BREAKLANDS', 960, 150, 76, CONFIG.COLOR.yellow);

    // Studio logo, top-aligned so the credit lines flow from underneath it
    // whatever size the art is. Falls back to the studio name as text.
    let y = 230;
    if (typeof UI !== 'undefined' && UI.fitInto &&
        UI.fitInto(R.ctx, 'logo_studio', 960, y, 300, 210)) {
      y += 226;
    } else {
      R.text('BANX GAMEX', 960, y + 40, 54, CONFIG.COLOR.cyan);
      y += 110;
    }

    const lines = [
      ['A BANX GAMEX GAME', CONFIG.COLOR.cyan],
      ['', null],
      ['DESIGN, CODE AND ART', CONFIG.COLOR.steel],
      ['Aaron  \u2014  Banx Gamex', '#ffffff'],
      ['', null],
      ['BUILT WITH', CONFIG.COLOR.steel],
      ['HTML, CSS and Canvas. No engine, no servers, no ads.', '#ffffff'],
      ['Every sound synthesised in WebAudio.', '#ffffff'],
      ['', null],
      ['WRECK THEM. JACK THE HARDWARE. BUILD THE MONSTER.', CONFIG.COLOR.yellow],
    ];
    lines.forEach((l) => {
      if (l[0]) R.text(l[0], 960, y, l[1] === CONFIG.COLOR.steel ? 26 : 30, l[1]);
      y += l[0] ? 42 : 20;
    });
    this.buttons.draw();
  }
}

// ---------------------------------------------------------------------------
// THE SCENES, AND THE ONE THAT IS THE WHOLE POINT OF THE STORY
//
// `RADIO` is a pool of one-liners and it has been wired since Block 16.
// `SCENE_RECLASSIFICATION` is not a one-liner: it is four consecutive lines in
// which MAGS tells you she is the one who reclassified you, and a callback
// three hours later in which she notices you never said anything about it.
//
// Section 20 of the bible is that scene:
//
//     "MAGS — the voice at the yard. SHE IS A NODE OF THE SAME NETWORK YOU
//      ARE DISMANTLING, and she is the one who reclassified CLIP, in a batch
//      correction centuries ago, without looking at any of them individually."
//
// It was written, saved in the data, checked by test_story.js, and NOTHING IN
// THE GAME HAS EVER READ IT. Neither had `CLIP_LOG_BEATS` — CLIP never speaks,
// so its four maintenance-log lines are the only thing in the game that is
// CLIP's own voice, and they were gated on an `after:` field nobody read.
//
// A scene is not a radio line and cannot go through `fire`: `pick` chooses ONE
// entry at random and `QUEUE_MAX` throws away all but the newest three, so a
// four-line scene played through the pool would arrive as its last three lines
// in a random order. So scenes queue whole, in order, and are exempt from the
// trim — which is safe because a scene only ever fires once.
const Scenes = {
  // LAZY, like every other cross-file reference in this project. As a
  // constant it evaluated at load time and threw in three suites that load
  // story.js without storydata.js -- a module that cannot be loaded on its
  // own is a module that will eventually not load at all.
  all() {
    return (typeof SCENE_RECLASSIFICATION !== 'undefined')
      ? [SCENE_RECLASSIFICATION] : [];
  },

  _seen() {
    if (typeof Progress === 'undefined') return {};
    Progress.scenesPlayed = Progress.scenesPlayed || {};
    return Progress.scenesPlayed;
  },
  // `!== undefined`, NOT truthiness. The value is the play-second the scene
  // fired at, because the callback measures from it -- and on a fresh save
  // that number is ZERO. `!!0` is false, so the first scene any player ever
  // sees was recorded as unplayed and fired again on the very next frame,
  // forever. Found by driving it; every assertion about the queue passed
  // while this was wrong, because the lines really were being queued.
  played(id) { return this._seen()[id] !== undefined; },

  // WHEN. Each trigger is `kind:value`, in the same grammar the barriers and
  // the paint sets already use, so adding a scene is one data entry.
  //
  //   garages_owned:4   you have claimed four
  //   hours_after:3     three hours of PLAY since the scene it hangs off
  //
  // Read off the records that already exist. `Profile.stats.playTime` is fed
  // by GameState.update and is the only clock in this game that measures play
  // rather than wall time — which is the difference between "three hours in"
  // and "you left it running overnight".
  ready(trigger, sinceKey) {
    if (!trigger) return false;
    const [kind, value] = String(trigger).split(':');
    if (kind === 'garages_owned') {
      const n = (typeof Garages !== 'undefined' && Garages.ownedCount)
        ? Garages.ownedCount() : 0;
      return n >= (parseInt(value, 10) || 1);
    }
    if (kind === 'hours_after') {
      const at = this._seen()[sinceKey];
      if (typeof at !== 'number') return false;
      return this.playSeconds() - at >= (parseFloat(value) || 0) * 3600;
    }
    return false;
  },

  playSeconds() {
    return (typeof Profile !== 'undefined' && Profile.stats &&
            Profile.stats.playTime) || 0;
  },

  // Called every frame from GameState.update, beside the radio it feeds.
  // Cheap: two scenes, one string split each.
  update() {
    for (const s of this.all()) {
      if (!this.played(s.id) && this.ready(s.trigger)) this.play(s);
      // THE CALLBACK. "Much later. Once. One line." It hangs off its parent,
      // so it cannot arrive before the thing it is a reply to.
      const cb = s.callback;
      if (cb && this.played(s.id) && !this.played(s.id + ':cb') &&
          this.ready(cb.trigger, s.id)) {
        this._seen()[s.id + ':cb'] = this.playSeconds();
        if (typeof Radio !== 'undefined') Radio.sequence(cb.lines, s.id + ':cb');
      }
    }
  },

  play(s) {
    if (!s || this.played(s.id)) return false;
    // The MOMENT it fires is recorded, not the moment it finishes: the
    // callback measures from when she said it, and a player who drove into a
    // fight halfway through still heard her start.
    this._seen()[s.id] = this.playSeconds();
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    if (typeof Radio !== 'undefined') Radio.sequence(s.lines, s.id);
    return true;
  },

  // AND CLIP'S OWN VOICE. Four maintenance-log lines, each gated on something
  // having happened, and `after:` was read by nothing. CLIP never speaks —
  // §20 — so these are not dialogue: they are the log it files, and they are
  // the only place the player sees what CLIP made of any of it.
  //
  // `after` is the same grammar again: `fragment:<id>` for a fragment found,
  // and a bare event id for anything the game already records.
  logsReady() {
    if (typeof CLIP_LOG_BEATS === 'undefined') return [];
    return CLIP_LOG_BEATS.filter(b => !this.played(b.id) && this._afterDone(b.after));
  },

  _afterDone(after) {
    if (!after) return true;
    const [kind, value] = String(after).split(':');
    if (kind === 'fragment') {
      return !!(typeof Story !== 'undefined' && Story.found && Story.found(value));
    }
    if (after === 'first_rig_restored') {
      return !!(typeof Rigs !== 'undefined' && Rigs.owned && Rigs.owned().length > 0);
    }
    if (after === 'mags_reclassification') return this.played('mags_reclassification');
    // A named fragment without the prefix — the data uses both spellings.
    return !!(typeof Story !== 'undefined' && Story.found && Story.found(after));
  },

  // Fired one at a time, so four unlocking at once do not arrive as a wall.
  updateLogs() {
    const ready = this.logsReady();
    if (!ready.length) return false;
    const b = ready[0];
    this._seen()[b.id] = this.playSeconds();
    if (typeof Radio !== 'undefined') Radio.sequence([b.text], b.id);
    return true;
  },

  // The honest report, the same shape as every other one in this project:
  // which scenes and logs the data writes, and whether anything can reach them.
  unplayed() {
    const out = [];
    for (const s of this.all()) if (!this.played(s.id)) out.push(s.id);
    if (typeof CLIP_LOG_BEATS !== 'undefined') {
      for (const b of CLIP_LOG_BEATS) if (!this.played(b.id)) out.push(b.id);
    }
    return out;
  },
};

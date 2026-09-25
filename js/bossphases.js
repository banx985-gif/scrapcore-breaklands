// SCRAPCORE: BREAKLANDS — BLOCK 14: BOSS PHASE CHANGES
//
// "Attack the support systems, not the guns." — BOSSES.crucible.lesson
//
// The Crucible is a machine you take apart, and until now that was ALL it was:
// you shot bits off and the bits stopped working, which is what happens to
// every machine in the game. `BOSSES[*].onBreak` has described something much
// better since the content library landed —
//
//   heatVent      'its cooked lane goes cold — a safe approach opens'
//   flamethrower  'both gone: stops zoning, starts chasing'
//   radiator      'it starts overheating ITSELF — 4s self-shutdowns.
//                  The discoverable solution.'
//
// — and none of it was connected. That third line is the whole fight: the
// arena is about heat, the boss is cooled by radiators, and NOTHING TELLS YOU.
// You work it out because the room has been talking about heat since you
// walked in. A boss that only loses guns as you strip it is a stripping job;
// a boss that changes what it is doing because of WHICH part you took is a
// conversation.
//
// ---------------------------------------------------------------------------
// WHY THE EFFECTS ARE KEYED ON THE PART, NOT ON THE BOSS
//
// Standing rule 6: adding a hazard, enemy, rig or district is ONE data entry.
// The same has to hold here or ten bosses means ten phase systems.
//
// `onBreak` is the DESIGNER'S TEXT and stays exactly as written — it is
// content, `test_contentdata` reads it, and it is the thing a writer edits.
// What a break DOES lives here, keyed by the part that was broken, because
// the reason breaking a radiator overheats a machine is that the radiator was
// cooling it — which is true of any machine with radiators on it, not just
// this one. Ten bosses share one vocabulary and a new boss gets its phases
// free the moment its layers name a part already in this table.
//
// A trigger with no entry here does nothing and is REPORTED
// (`BossPhases.unwired()`), so the gap between what the content promises and
// what the code delivers is a number rather than a surprise.

const BOSS_PHASE_FX = {
  // ---- THE DISCOVERABLE ONE ----------------------------------------------
  // Cooling gone means the machine cooks itself. Not damage — a SHUTDOWN, so
  // the reward is a window in which the boss stands there and you take it
  // apart at leisure. That is what makes it a solution rather than a DPS
  // bonus: it changes what you are allowed to do, not how fast you do it.
  radiator: {
    id: 'overheat', all: true,          // ALL of them, or it is still cooled
    says: 'IT IS COOKING ITSELF',
    apply(ent) {
      ent.selfOverheat = { every: 9, forSec: 4, t: 4 };
    },
  },

  // ---- THE STOLEN SKIN ---------------------------------------------------
  // PATCHWORK wears what it took off you. Strip the plating and what is
  // underneath is the machine it was before it started killing people — which
  // is the whole of its character delivered as a phase rather than as a line
  // of prose in the data file.
  //
  // What it DOES is drop the worn parts on the floor. Not a stat change: the
  // parts it stole become salvage lying in the Barrens, which is the only
  // ending that makes taking them back a thing the player can do.
  armourPlate: {
    id: 'shedSkin', all: true,
    says: 'IT IS SHEDDING WHAT IT TOOK',
    apply(ent) {
      if (!ent.worn || !ent.worn.length) return;
      for (const w of ent.worn) {
        if (typeof LooseParts === 'undefined') break;
        LooseParts.spawn(w.partId, 1,
          ent.x + (Math.random() - 0.5) * 260,
          ent.y + (Math.random() - 0.5) * 260,
          (Math.random() - 0.5) * 260, (Math.random() - 0.5) * 260,
          w.gradeId);
      }
      ent.worn = [];
    },
  },

  // ---- THE ONE YOU CAN WALK AROUND --------------------------------------
  // "Cannot turn." Three bosses say it — THE REAPER, THE ENGINE and PATCHWORK
  // — and it lived in the self-evident list for a run on the strength of "the
  // treads were the thing that turned". They were not: an Enemy's `turnRate`
  // is set once in its constructor and nothing had ever written to it again,
  // so shooting the legs off any of the three changed nothing at all.
  //
  // It is worth being a real phase because of what it does to the FIGHT: a
  // machine that cannot come round is a machine you can stand behind, and
  // standing behind things is what this game's whole combat is about. The
  // reward for taking the legs is permission to use the flank you already
  // learned in the Yard.
  //
  // A number, not a flag: Enemy._steer already clamps its facing to
  // `turnRate` radians per second, and 99 is its way of saying "instant". So
  // this is one assignment into a field the movement code already reads every
  // frame, which is the same shape as every other effect in this table.
  heavyTreads: {
    id: 'cannotTurn', all: true,        // one set still on it is still legs
    says: 'IT CANNOT COME ROUND',
    apply(ent) {
      ent.turnRate = BossPhases.CRIPPLED_TURN;
      // A machine dragging itself round is also slower. Multiplied into the
      // stat the parts already feed, so a later recalcStats does not silently
      // undo the phase.
      ent._crippled = true;
    },
  },

  // ---- THE ONE THAT OPENS THE FLOOR --------------------------------------
  // Each vent cooks one lane. Break one and its lane goes cold for good, so
  // a safe approach opens — the arena itself is what changes, which is why
  // the Crucible's floor was worth designing.
  //
  // A DIRECT EFFECT, not a flag: it puts a molten lane OUT. The first version
  // incremented `ent.lanesOpen` and NOTHING IN THE CODEBASE READ IT, so the
  // phase fired, the orange word appeared, and the floor was exactly as lethal
  // as it had been a frame earlier. See BOSS_PHASE_LIVE.
  heatVent: {
    id: 'lane', all: false,             // EACH one, not all
    says: 'A LANE GOES COLD',
    writes: ['lanesOpen'],
    apply(ent) {
      ent.lanesOpen = (ent.lanesOpen || 0) + 1;
      BossPhases.coolOneLane(ent);
    },
  },

  // ---- THE ONE THAT CHANGES ITS MIND -------------------------------------
  // A zoner that cannot zone has to come to you. This is a real cost, not a
  // reward: the fight gets closer and faster, and a player who strips the
  // flamethrowers first has made the arena more dangerous, not less.
  flamethrower: {
    id: 'chase', all: true,
    says: 'IT STOPS ZONING AND STARTS CHASING',
    writes: ['aiType', 'speedMul'],
    apply(ent) {
      ent.aiType = 'AGGRESSIVE';
      // `speedMul`, not a `chaseMul` of its own: enemy.js multiplies its move
      // speed by exactly this field and by nothing else, and a second name for
      // one idea is a field that gets forgotten.
      ent.speedMul = (ent.speedMul || 1) * 1.35;
    },
  },

  // ---- AND THE REST OF THE TEN'S VOCABULARY ------------------------------
  // Written now because they are one entry each and because a boss whose
  // phases are half-wired is worse than one with none: you cannot tell which
  // half you are fighting.
  // BOREMAW's drill used to have an entry here. It set `burrowAxes`, which
  // nothing read, for a boss that is not built, describing a submerge that is
  // not a system. Removed rather than kept: `unwired()` now reports it, which
  // is a number, and a number is better than a lie with a comment on it.
  shockwaveCannon: {
    id: 'nothrow', all: true,
    says: 'IT CANNOT THROW YOU ANY MORE',
    writes: ['noKnockback'],
    apply(ent) { ent.noKnockback = true; },
  },
  heavyArmour: {
    id: 'turtle', all: true,
    says: 'IT IS HIDING AND HEALING',
    writes: ['retreatHeal'],
    apply(ent) { ent.retreatHeal = { rate: 6, forSec: 5 }; },
  },
  bigReactor: {
    id: 'browndown', all: true,
    says: 'THE GRID IS FAILING',
    // The content line is "half its weapons go dark". Half OUTPUT rather than
    // half the guns: a machine that loses specific weapons mid-fight is one
    // the player cannot read, and `weaponDamageMul` is applied to every shot
    // already. Named because it IS a divergence from the text, and the next
    // person should find it argued rather than discover it.
    writes: ['weaponDamageMul'],
    apply(ent) { ent.weaponDamageMul = (ent.weaponDamageMul || 1) * 0.5; },
  },
};

// ---------------------------------------------------------------------------
// WHAT READS WHAT.
//
// Not documentation. This table exists because FIVE OF THE FIRST SEVEN EFFECTS
// WROTE FIELDS NOTHING READ:
//
//     chaseMul   noKnockback   lanesOpen   burrowAxes   powerBrownout
//
// The phase fired, the orange word went up over the boss, the assertion that
// the flag had been set passed - and the machine did exactly what it had been
// doing the frame before. Which is this project's oldest fault in a new hat: a
// suite is green while the game is broken whenever the check looked at the
// bookkeeping instead of the behaviour.
//
// Every field an effect writes is named here with what reads it, and
// `test_lairs` proves each one by MEASURING THE MACHINE - speed, damage,
// shutdown, the floor - never by reading the flag back out.
const BOSS_PHASE_LIVE = {
  shutdown:        'js/enemy.js - it stops thinking, moving and firing',
  speedMul:        'js/enemy.js - multiplied into moveSpeed every frame',
  aiType:          'js/enemy.js - which brain runs',
  retreatHeal:     'js/bossphases.js - BossPhases.tick heals it',
  noKnockback:     'js/machine.js - _waveHit zeroes the shove',
  weaponDamageMul: 'js/machine.js - every shot is scaled by it',
  lanesOpen:       'js/bossphases.js - coolOneLane puts a molten lane out',
};

// ---------------------------------------------------------------------------
// AND THE OTHER HALF OF BEING HONEST: the `onBreak` lines that need NO code.
//
// Most of what the content library promises when a part comes off is what
// happens BECAUSE THE PART CAME OFF. Break the repair arm and it stops
// repairing, because the repair arm was the thing repairing. Those are not
// phase changes, and giving them entries above would be building a second
// system to announce what the first one already does.
//
// Listed rather than assumed, so `unwired()` reports only the promises that
// have genuinely nothing behind them.
// TWO CLAIMS CAME OUT OF THIS TABLE, having sat in it as "self-evident" and
// not been. `treads: it was the thing that turned` describes a consequence the
// game does not model: an Enemy's `turnRate` is set once in its constructor and
// nothing has ever touched it, so shooting the legs off THE REAPER, THE ENGINE
// and PATCHWORK changed exactly nothing about how they turned. The other,
// `blades: it was the thing that charged`, is still here, because there is no
// charge behaviour to take away — that one really is waiting on a system, and
// `unwired()` is where a promise waiting on a system belongs, not here.
const PART_IS_THE_EFFECT = {
  directionalShield: 'the shield IS the ring; losing one is the gap',
  pointDefence:      'it was the thing shooting your projectiles down',
  barrierProjector:  'it was the thing shielding the MARSHALs',
  splitter:          'Machine.detach already drops everything past a splitter',
  repairArm:         'it was the thing rebuilding',
  harpoon:           'it was the thing collecting corpses',
  pylon:             'a pylon is a production line; four gone is four gone',
  blades:            'it was the thing that charged',
  barricadePlates:   'the plates ARE the routes it was closing',
  arcPylons:         'they were the thing chaining',
  wheelsets:         'they were the thing rolling',
  reactor:           'no power, no machine - the game already models that',
};

const BossPhases = {
  // Radians per second once the legs are gone. 0.9 is a full turn in about
  // seven seconds — slow enough that walking round it works, fast enough that
  // it is not a statue. An Enemy's default is 99, which is its way of saying
  // "faces you instantly".
  CRIPPLED_TURN: 0.9,
  CRIPPLED_SPEED: 0.55,

  // ---- what the runtime remembers ----------------------------------------
  // Nothing. A boss's phase state lives on the boss, because the boss is the
  // thing that has it and a parallel table keyed by id is a second record of
  // one fact — which this project has been bitten by twice.

  // Is this entity a boss with phases to fire?
  defOf(ent) {
    if (!ent || !ent.bossId || typeof BOSSES === 'undefined') return null;
    return BOSSES[ent.bossId] || null;
  },

  // A part came off a machine. THE ONE ENTRY POINT, called from
  // Machine.detach — the single place in the codebase where a part leaves a
  // machine, which is why the hook is there and not at the two call sites
  // above it that would each have to remember.
  // What a content part id RESOLVES to in the effect table. The Reaper's
  // `treads` and the Crucible's `heatVent` are content words for parts the
  // game calls something else, and BOSS_PART_SUBS already holds that mapping
  // for the BUILDER. Asking it here too is what stops an effect from being
  // keyed to a word the machine never uses — which is exactly how the heat
  // vent phase came to be unfireable.
  fxFor(partId) {
    if (!partId) return null;
    if (BOSS_PHASE_FX[partId]) return BOSS_PHASE_FX[partId];
    const sub = (typeof BOSS_PART_SUBS !== 'undefined')
      ? BOSS_PART_SUBS[partId] : null;
    return (sub && BOSS_PHASE_FX[sub]) || null;
  },

  onPartLost(ent, partId) {
    const B = this.defOf(ent);
    if (!B || !partId) return null;
    const fx = this.fxFor(partId);
    if (!fx) return null;

    ent.phasesFired = ent.phasesFired || {};
    if (ent.phasesFired[fx.id] && fx.all) return null;

    // "ALL of them" means exactly that: a machine with two radiators is still
    // cooled while one is bolted on. Counted off the machine's OWN sockets,
    // so it cannot disagree with what is actually attached.
    if (fx.all && this.stillFitted(ent, partId) > 0) return null;

    ent.phasesFired[fx.id] = (ent.phasesFired[fx.id] || 0) + 1;
    fx.apply(ent);
    return fx;
  },

  // How many of a part are still on the machine. Asked of the sockets rather
  // than tracked, for the same reason every completion check in this project
  // asks the record that owns the fact.
  stillFitted(ent, partId) {
    let n = 0;
    for (const s of (ent.sockets || [])) {
      if (!s.comp || !s.comp.part) continue;
      // ASKED THE SAME WAY THE HOOK ASKS IT. A boss's heat vents are
      // radiators wearing a label; counting by part id alone would say the
      // vents are still fitted when what is fitted is cooling.
      if ((s.comp.standsFor || s.comp.part.id) === partId) n++;
    }
    return n;
  },

  // ---- the per-frame consequences ----------------------------------------
  // Only the effects that need time. Everything else is a flag another system
  // already reads, which is the point of choosing these particular effects:
  // they hang off fields that exist.
  tick(dt, ent) {
    if (!ent || ent.alive === false) return;

    // SELF-OVERHEAT: the discoverable solution. A cycle of running hot and
    // then shutting down, and the shutdown is the window.
    const o = ent.selfOverheat;
    if (o) {
      o.t -= dt;
      if (o.t <= 0) {
        ent.shutdown = !ent.shutdown;
        o.t = ent.shutdown ? o.forSec : o.every;
        if (ent.shutdown && typeof Effects !== 'undefined') {
          Effects.comicWord('SHUTDOWN', ent.x, ent.y - 220,
            CONFIG.COLOR.cyan, 70);
        }
      }
    }

    // RETREAT AND HEAL: a real cost for stripping the armour off early.
    const h = ent.retreatHeal;
    if (h && ent.hp !== undefined && ent.maxHp !== undefined) {
      ent.hp = Math.min(ent.maxHp, ent.hp + h.rate * dt);
    }
  },

  // ---- the honest report --------------------------------------------------
  // Every onBreak line the content library writes, and whether anything in
  // this file answers it. A promise with no code behind it is a lie the
  // player finds by testing it.
  unwired() {
    const out = {};
    if (typeof BOSSES === 'undefined') return out;
    for (const id of Object.keys(BOSSES)) {
      for (const part of Object.keys(BOSSES[id].onBreak || {})) {
        if (this.fxFor(part)) continue;
        if (PART_IS_THE_EFFECT[part]) continue;
        (out[part] || (out[part] = [])).push(id);
      }
    }
    return out;
  },

  // The report that would have caught the five dead flags: every field an
  // effect writes, and whether anything is on record as reading it.
  unread() {
    const out = [];
    for (const part of Object.keys(BOSS_PHASE_FX)) {
      for (const f of (BOSS_PHASE_FX[part].writes || [])) {
        if (!BOSS_PHASE_LIVE[f]) out.push(part + '.' + f);
      }
    }
    return out;
  },

  // The parts whose loss needs no code, and why. Public so the report can say
  // "thirteen of these are already true" instead of "thirteen are missing".
  selfEvident() { return PART_IS_THE_EFFECT; },

  // PUT A LANE OUT. The heat vent's effect, done TO THE WORLD rather than
  // written to a flag: find the molten lanes the boss is standing among and
  // switch the nearest live one off for good.
  coolOneLane(ent) {
    if (typeof World === 'undefined' || !ent) return null;
    let best = null, bd = Infinity;
    for (const e of (World.entities || [])) {
      if (!e || e._type !== 'lanes' || e.cold) continue;
      const d = Math.hypot((e.x || 0) - ent.x, (e.y || 0) - ent.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return null;
    best.cold = true;               // MoltenLane reads this and stops burning
    return best;
  },

  // And the other direction: an effect for a part no boss ever loses is dead
  // code pretending to be content.
  unused() {
    const used = {};
    if (typeof BOSSES !== 'undefined') {
      for (const id of Object.keys(BOSSES)) {
        for (const part of Object.keys(BOSSES[id].onBreak || {})) used[part] = 1;
      }
    }
    return Object.keys(BOSS_PHASE_FX).filter(p => !used[p]);
  },
};

// ---------------------------------------------------------------------------
// WHAT THE ROAMER TOOK OFF YOU
//
// `wearsPlayerLosses: true` has sat in PATCHWORK's data since the content pass
// with nothing reading it, and it is the best hook in the boss set: the machine
// that killed you is wearing your parts the next time you see it. Not a stat, a
// STORY — you recognise your own cannon on it, and taking it back is the whole
// errand.
//
// It is a small system because the pieces were already there. Machine.attach
// bolts a part on. The unbanked haul at the moment of death is a list of exactly
// the right shape. BossPhases already fires a phase when armour comes off. All
// that was missing was somewhere to put the list between the two.
//
//   ONE WRITER   Roamers.recordLoss, from the death path
//   ONE READER   Roamers.dress, from the one place a roamer is built
//
// And it is kept SEPARATE from the wreck marker on purpose. Recovering your own
// gear clears the wreck; it must not un-steal what PATCHWORK took, because then
// the hook would only ever fire for a player who was already having a bad day.
const Roamers = {
  MAX_WORN: 4,

  _p() {
    if (typeof Progress === 'undefined') return {};
    Progress.roamerWears = Progress.roamerWears || {};
    return Progress.roamerWears;
  },

  // Which roamer, if any, is standing close enough to have been the one that
  // did it. `wearsPlayerLosses` is the gate: only a machine whose data says it
  // scavenges takes anything, so THE REAPER killing you costs you nothing
  // extra and PATCHWORK killing you costs you the fight you have next time.
  killer(player) {
    if (typeof BOSSES === 'undefined' || typeof Population === 'undefined') {
      return null;
    }
    let best = null, bd = 2400;
    for (const m of (Population.machines || [])) {
      if (!m || !m.alive || !m.bossId) continue;
      if (!(BOSSES[m.bossId] || {}).wearsPlayerLosses) continue;
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  },

  recordLoss(player, carried) {
    if (!player || !carried || !carried.length) return null;
    const m = this.killer(player);
    if (!m) return null;
    const list = (this._p()[m.bossId] || []).slice();
    for (const c of carried) {
      if (list.length >= this.MAX_WORN) break;
      if (!c || !c.partId) continue;
      list.push({ partId: c.partId, gradeId: c.gradeId || 'G1' });
    }
    this._p()[m.bossId] = list;
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    // It puts them on THERE AND THEN, so the machine standing over you is
    // already wearing them before the screen fades.
    this.dress(m, m.bossId);
    return list;
  },

  worn(bossId) { return (this._p()[bossId] || []).slice(); },

  // Bolt them on, through Machine.attach like anything else. `ent.worn` is what
  // the shed-skin phase drops on the floor, so the parts you lost are the parts
  // that come back — not a re-roll of the same grades.
  //
  // THEY REPLACE, THEY DO NOT ADD. PATCHWORK comes out of the builder with
  // every socket filled, so the first version simply found no room and dressed
  // it in nothing — the hook was wired, ran, and did nothing, which is the
  // exact failure this project keeps catching. And replacing is what the data
  // says anyway: "built from everything it has killed, DIFFERENT LOADOUT EVERY
  // MEETING". A machine that only ever grew would end up wearing four players'
  // worth of guns and be a different design problem.
  //
  // Its own parts come off first and are simply gone. It is not carrying them;
  // it swapped.
  dress(ent, bossId) {
    if (!ent || typeof Machine === 'undefined') return 0;
    const list = this.worn(bossId);
    if (!list.length) return 0;
    ent.worn = [];
    let n = 0;
    for (const w of list) {
      if (typeof PARTS === 'undefined' || !PARTS[w.partId]) continue;
      let id = Machine.attach(ent, w.partId);
      if (id === -1) {
        // Take one of ITS parts off to make room. The outermost first, so the
        // machine keeps its core and its reactor and changes its face.
        const victim = this._spare(ent);
        if (victim === null) break;
        Machine.detach(ent, victim);
        id = Machine.attach(ent, w.partId);
        if (id === -1) break;
      }
      ent.worn.push(w);
      n++;
    }
    if (n) {
      Machine.recalcPower(ent);
      Machine.recalcStats(ent);
    }
    return n;
  },

  // A socket whose part it can afford to lose: never the reactor (no power, no
  // machine) and never something already worn.
  _spare(ent) {
    const wornIds = (ent.worn || []).map(w => w.partId);
    for (const s of (ent.sockets || [])) {
      if (!s.comp || !s.comp.part) continue;
      if (s.comp.part.category === 'power') continue;
      if (wornIds.indexOf(s.comp.part.id) >= 0) continue;
      return s.id;
    }
    return null;
  },

  reset() { if (typeof Progress !== 'undefined') Progress.roamerWears = {}; },
};

// SCRAPCORE: BREAKLANDS — BLOCK 13: THE MISSION RUNTIME
//
// Nine people and twenty-seven missions have existed as data since the content
// library landed — with full dialogue — and nothing has ever given one, tracked
// one or paid one out. The complaint is exact: there is nothing to do out here
// but shoot patrols.
//
// SEPARATE FILE FROM missions.js ON PURPOSE. That file is five hundred lines of
// content and this is the machine that reads it; keeping them apart means a
// writer can edit every line of dialogue without opening a system file, which
// is the whole reason the content library is a library.
//
// ---------------------------------------------------------------------------
// THE SHAPE
//
// A mission is offered by an NPC you drive to, accepted with the same ACTION
// button that reads a fragment and takes a find, tracked against a target the
// compass already knows how to point at, and paid out when you come back.
//
// EVERY PIECE OF THAT HANGS OFF A RECORD THAT ALREADY EXISTED:
//
//   Progress.finds       a RECOVERY mission's find
//   World.wasKilled      a HUNT mission's machine
//   Progress.shortcuts   a mission that opens a way through
//   Population.machines  a CLEAR mission's ring
//   Progress.gadgets     what a gadget-rank reward writes
//   Forge.scrap          what a scrap reward pays into
//
// Nothing here invents a second source of truth. That is why the runtime is
// short: the world already recorded everything a mission needs to ask about,
// and what was missing was the asking.
//
// WHAT IS REFUSED RATHER THAN FAKED: `multi`, `wreck`, `bossDamage`, `escort`
// and `rideFreight` targets. Their systems are Blocks 14 and 16 and Rail Spine.
// A mission with one of those is NEVER OFFERED, so the player is never handed
// something that cannot be finished, and `Missions.unbuiltKinds()` prints the
// list so the debt is countable rather than discovered.

const MISSION_STATE = { OFFERED: 'offered', ACTIVE: 'active', DONE: 'done' };

// The target kinds the runtime can actually watch.
const MISSION_KINDS_BUILT = ['find', 'machine', 'barrier', 'clearArea',
  // BLOCK 13, second pass. Three more, each of which needed a world record
  // AND something in the world to be about — a watcher on its own would have
  // made these missions offerable and still impossible, which is exactly what
  // `buildable` exists to stop.
  'multi', 'wreck', 'rideFreight', 'escort',
  // ...and bossDamage, now that a roamer actually goes out and the world
  // remembers the worst it has been driven to.
  'bossDamage'];

// ALL FIVE MISSION TYPES ARE BUILT. `escort` was the last, and it needed the
// thing the note used to say it needed: a friendly that MOVES, follows a
// route, can be killed, and fails the job when it is. See `Escortee` in
// js/barriers.js and `Escorts` above.
//
// The three drafted escort runs are all in districts that have not shipped
// (the Grows, the Sumpworks, the Digs), so the SYSTEM is reachable and the
// MISSIONS are dormant with their districts - the same shape as four of the
// six lairs.
// (bossDamage was here. Alert stage 3 sends the roamer BOSS_DISPATCH names,
//  and Progress.roamerDamage remembers the worst it has been driven to, so
//  "wound PATCHWORK and bring TALLY the reading" is now a thing you can do.)


// ---------------------------------------------------------------------------
// THE ESCORT RUN
//
// Small on purpose. The escortee owns its own movement and its own health;
// this owns WHEN there is one, WHERE it starts, and what happens when it
// arrives or dies. Three facts, and no clock among them.
//
// A FAILED RUN LEAVES NO RECORD. `Progress.escorted` only ever gains a
// delivery: losing the thing puts the mission back to where it was, so an
// escort is something you go and do again rather than a state you are stuck
// in. That is also why there is no `escortFailed` map anywhere - a record of
// failure would be a punishment, and the punishment is already that you have
// to walk it again.
const Escorts = {
  live: null,               // the run in progress, or null

  reset() { this.live = null; },

  running(id) { return !!(this.live && this.live.id === id && this.live.ent); },

  // Where a run starts and where it goes. The START is the NPC who asked -
  // you pick the thing up from the person who wants it moved, which needs no
  // second table of coordinates and cannot drift from the person.
  routeFor(missionId) {
    const m = (typeof MISSIONS !== 'undefined') ? MISSIONS[missionId] : null;
    if (!m || !m.target || m.target.kind !== 'escort') return null;
    const C = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
    const from = Missions.npcPos(m.npc);
    const to = m.target.to;
    if (!from || !to) return null;
    return {
      id: m.target.id,
      fromX: from.x, fromY: from.y + 260,   // beside them, not inside them
      toX: to[0] * C + C / 2, toY: to[1] * C + C / 2,
    };
  },

  // START ONE. Called when an escort mission is given, and again when the
  // player comes back to a mission whose escortee they lost - both are the
  // same thing from here, which is what makes failure retryable for free.
  begin(missionId) {
    const r = this.routeFor(missionId);
    if (!r) return null;
    if (typeof Hazards === 'undefined' || typeof World === 'undefined') return null;
    this.end();
    const e = Hazards.make('escortees',
      [r.fromX, r.fromY, r.id, r.toX, r.toY], null, null);
    if (!e) return null;
    e._type = 'escortees';
    World.own(e);
    this.live = { id: r.id, mission: missionId, ent: e };
    return e;
  },

  end() {
    if (this.live && this.live.ent && typeof World !== 'undefined') {
      World.release(this.live.ent);
    }
    this.live = null;
  },

  // Ticked every frame. The escortee moves itself; this only notices the two
  // things that end a run.
  update(dt, player) {
    const L = this.live;
    if (!L || !L.ent) return;
    if (L.ent.arrived) {
      if (typeof Progress !== 'undefined') {
        Progress.escorted = Progress.escorted || {};
        Progress.escorted[L.id] = true;
        if (typeof Progress.save === 'function') Progress.save();
      }
      this.end();
      return;
    }
    if (!L.ent.alive) {
      // NO RECORD. Nothing is written; the mission is simply not done, and
      // walking back to whoever asked starts it again.
      if (typeof Radio !== 'undefined') Radio.fire('wreck_lost');
      this.end();
    }
  },

  // Where the compass points during a run: at the THING, not at where it is
  // going. Your job is to be next to it, and a pip on the destination would
  // be telling you to go on ahead - which is the one thing that loses it.
  pip() {
    const L = this.live;
    return (L && L.ent && L.ent.alive) ? { x: L.ent.x, y: L.ent.y } : null;
  },
};

const Missions = {
  // ---- what the save holds ------------------------------------------------
  _store() {
    if (typeof Progress === 'undefined') return {};
    Progress.missions = Progress.missions || {};
    return Progress.missions;
  },

  stateOf(id) { return this._store()[id] || null; },
  isDone(id) { return this.stateOf(id) === MISSION_STATE.DONE; },
  isActive(id) { return this.stateOf(id) === MISSION_STATE.ACTIVE; },

  activeList() {
    const s = this._store();
    return Object.keys(s).filter(k => s[k] === MISSION_STATE.ACTIVE);
  },

  // Can this mission be RUN at all with the systems that exist? A mission the
  // runtime cannot watch is never offered, because giving the player a task
  // that can never complete is worse than having no task at all.
  buildable(id) {
    const m = MISSIONS[id];
    if (!m || !m.target) return false;
    return MISSION_KINDS_BUILT.indexOf(m.target.kind) >= 0;
  },

  unbuiltKinds() {
    const out = {};
    for (const id of Object.keys(MISSIONS)) {
      const k = MISSIONS[id].target && MISSIONS[id].target.kind;
      if (k && MISSION_KINDS_BUILT.indexOf(k) < 0) out[k] = (out[k] || 0) + 1;
    }
    return out;
  },

  // IS THIS ONE THING DONE? Asked of every record that can own an id, because
  // a `multi` is a mixed bag by design and each of these is already the single
  // writer for its own kind of doneness.
  _idDone(id) {
    if (typeof Progress === 'undefined') return false;
    if (Progress.finds && Progress.finds[id]) return true;
    if (Progress.shortcuts && Progress.shortcuts[id]) return true;
    if (Progress.towed && Progress.towed[id]) return true;
    if (typeof World !== 'undefined' && World.wasKilled && World.wasKilled(id)) {
      return true;
    }
    return false;
  },

  // Requirements: earlier steps in the chain, and anything the data names.
  available(id) {
    const m = MISSIONS[id];
    if (!m || this.stateOf(id)) return false;
    if (!this.buildable(id)) return false;
    const r = m.requires || {};
    for (const need of (r.missions || [])) if (!this.isDone(need)) return false;
    // AND THE GEAR IT NEEDS. Five shipping missions name one — HOB's tow
    // winch, VANE's Mammoth, MERIT's grapple and cutter, LEDGER's cutter —
    // and `available()` read `r.missions` and nothing else, so all five could
    // be accepted by somebody who could not possibly finish them. Being handed
    // "tow it back whole" with no winch is not a difficulty curve, it is a
    // dead end that looks like a bug.
    for (const need of (r.gear || [])) if (!this.hasGear(need)) return false;
    return true;
  },

  // WHAT `gear:` MEANS, and it means three different things in the data:
  //   'towWinch'   a gadget, rank 1        -> Progress.gadgets
  //   'grapple_1'  a gadget at a rank      -> Progress.gadgets
  //   'mammoth'    a rig you own           -> Progress.rigsOwned
  // Written as one function so a mission author can name the thing and not the
  // table it lives in — engineering rule 6, applied to a requirement.
  // AN NPC CAN BE GATED TOO. DRAIN is a pump-station controller at the bottom
  // of a drowned plant and writes `requires: { gadget: 'seal_1' }` — you must
  // be able to breathe down there before you can meet them. Nothing read it,
  // and DRAIN's district does not ship, so today this changes nothing and the
  // day The Sumpworks lands it changes everything. Cheaper to be true now than
  // to remember later.
  npcPresent(npcId) {
    const n = (typeof NPCS !== 'undefined') ? NPCS[npcId] : null;
    if (!n) return false;
    const r = n.requires || {};
    if (r.gadget && !this.hasGear(r.gadget)) return false;
    for (const g of (r.gear || [])) if (!this.hasGear(g)) return false;
    for (const mid of (r.missions || [])) if (!this.isDone(mid)) return false;
    return true;
  },

  hasGear(need) {
    if (!need) return true;
    const s = String(need);
    const m = s.match(/^(.+)_(\d+)$/);
    const id = m ? m[1] : s;
    const rank = m ? Number(m[2]) : 1;
    if (typeof RIGS !== 'undefined' && RIGS[id]) {
      return !!(typeof Rigs !== 'undefined' && Rigs.owns && Rigs.owns(id));
    }
    const owned = (typeof Progress !== 'undefined' && Progress.gadgets)
      ? (Progress.gadgets[id] || 0) : 0;
    return owned >= rank;
  },

  // THE NEXT THING THIS PERSON WANTS. One at a time per NPC, in chain order,
  // because a machine that hands you three jobs at once is a quest board and
  // this game does not have one.
  // A RUN YOU LOST STARTS AGAIN when you come back and talk to whoever asked.
  // No penalty, no second mission state, no record of the failure - the
  // punishment for losing an escortee is that you have to walk it again, and
  // that is enough punishment for anybody.
  resumeEscort(npcId) {
    for (const id of this.activeList()) {
      const m = MISSIONS[id];
      if (!m || m.npc !== npcId) continue;
      if (!m.target || m.target.kind !== 'escort') continue;
      if (this.complete(id)) continue;
      if (typeof Escorts !== 'undefined' && !Escorts.running(m.target.id)) {
        return Escorts.begin(id);
      }
    }
    return null;
  },

  nextFor(npcId) {
    const ids = Object.keys(MISSIONS)
      .filter(k => MISSIONS[k].npc === npcId)
      .sort((a, b) => (MISSIONS[a].step || 0) - (MISSIONS[b].step || 0));
    for (const id of ids) if (this.isActive(id)) return id;
    for (const id of ids) if (this.available(id)) return id;
    return null;
  },

  // What to draw over an NPC's head. This is the whole of "which of these nine
  // wants something", and without it they are nine props.
  badgeFor(npcId) {
    const id = this.nextFor(npcId);
    if (!id) return null;
    if (this.isActive(id)) {
      return this.complete(id)
        ? { mark: '!', ink: CONFIG.COLOR.lime, id }         // done — come back
        : { mark: '·', ink: CONFIG.COLOR.steel, id };  // in progress
    }
    return { mark: '?', ink: '#ffb020', id };               // something to offer
  },

  // ---- giving and finishing ----------------------------------------------
  give(id) {
    if (!this.available(id)) return false;
    this._store()[id] = MISSION_STATE.ACTIVE;
    // AN ESCORT IS A THING, so accepting one puts the thing in the world.
    // Here rather than in a watcher: a run that started because a flag went
    // true a frame later would begin without the player watching, and the
    // first thing they would know about it is a health bar going down.
    if (typeof Escorts !== 'undefined' && MISSIONS[id] && MISSIONS[id].target &&
        MISSIONS[id].target.kind === 'escort') {
      Escorts.begin(id);
    }
    if (typeof Progress !== 'undefined' && typeof Progress.save === 'function') {
      Progress.save();
    }
    return true;
  },

  // IS THE TARGET SATISFIED? Asked of the record that already owns the fact,
  // never of a counter this file keeps — a second tally is a second thing to
  // get wrong, and it is always the one that is wrong.
  // ---- DELIVERY -----------------------------------------------------------
  //
  // `deliver: { kind, id }` sat in nine missions, read by nothing. Seven of
  // the nine say `npc:<the same NPC you turn it in to>`, and those were kept
  // by accident of the design: you cannot be paid without standing in front of
  // that machine, so the promise was true without anybody reading it. TWO say
  // a garage, and one of those — COMB's third, target `find` — completed the
  // instant you picked the thing up, five minutes and one district away from
  // anywhere you were asked to take it.
  //
  // A delivery you never had to make is not a shorter mission. It is the drive
  // home deleted, and the drive home is the loop.
  delivered(id) {
    if (typeof Progress !== 'undefined' && Progress.delivered &&
        Progress.delivered[id]) return true;
    // A TOWED WRECK IS DELIVERED BY HAVING BEEN TOWED. `Progress.towed` is
    // written by `Tow.strip`, and `Tow.strip` is called from exactly one place
    // in the game — `Garages._onArrive`. A stripped wreck is therefore a wreck
    // that reached a garage, and asking for a second record would be asking
    // for the same fact twice.
    //
    // This is here because the suite said so. `test_missions.js` hooks the
    // loader, strips it, and asserts the job is finished; that went red, and
    // the check turned out to be right about the game and my gate wrong about
    // the record. The rule is to prove the check before the code.
    const m = MISSIONS[id];
    if (m && m.target && m.target.kind === 'wreck') return this._targetDone(m);
    return false;
  },

  // Called by Garages._onArrive. Anything active, asking for a garage, and
  // otherwise finished is delivered by being here.
  deliverHere(garageId) {
    if (typeof Progress === 'undefined') return 0;
    Progress.delivered = Progress.delivered || {};
    let n = 0;
    for (const id of Object.keys(MISSIONS)) {
      const m = MISSIONS[id];
      const d = m && m.deliver;
      if (!d || d.kind !== 'garage') continue;
      if (!this.isActive(id) || Progress.delivered[id]) continue;
      if (!d.any && d.id && d.id !== garageId) continue;
      if (!this._targetDone(m)) continue;
      Progress.delivered[id] = true;
      n++;
    }
    return n;
  },

  complete(id) {
    const m = MISSIONS[id];
    if (!m || !m.target) return false;
    // THE OBJECTIVE, THEN THE DELIVERY. An `npc` delivery is already enforced
    // by where the turn-in happens; a `garage` one needs the record above.
    if (!this._targetDone(m)) return false;
    if (m.deliver && m.deliver.kind === 'garage' && !this.delivered(id)) return false;
    return true;
  },

  _targetDone(m) {
    if (!m || !m.target) return false;
    const t = m.target;

    if (t.kind === 'find') {
      return !!(typeof Progress !== 'undefined' && Progress.finds &&
                Progress.finds[t.id]);
    }
    // MULTI: a set of things, each of which is DONE by whichever record owns
    // it. Deliberately not given a sub-kind in the data — MERIT wants three
    // drones off three rooftops and TALLY wants three machines off no roster,
    // and asking "is this id resolved" of every record is both shorter and
    // more useful than making the writer say which kind each id is.
    if (t.kind === 'multi') {
      const ids = t.ids || [];
      return ids.length > 0 && ids.every(id => this._idDone(id));
    }
    // WRECK: you towed the named thing home and stripped it. Written by
    // Tow.strip, which is the line where that actually becomes true.
    if (t.kind === 'wreck') {
      return !!(typeof Progress !== 'undefined' && Progress.towed &&
                Progress.towed[t.id]);
    }
    // BOSS DAMAGE: you drove a roamer below a threshold and it stayed there.
    // Read off the one-way record, so it does not matter whether you finished
    // it, lost it, or watched it wander off - what TALLY wants is a reading.
    if (t.kind === 'bossDamage') {
      if (typeof Progress === 'undefined' || !Progress.roamerDamage) return false;
      const f = Progress.roamerDamage[t.id];
      return f !== undefined && f <= (t.threshold === undefined ? 0.5 : t.threshold);
    }
    // ESCORT: the thing arrived. Written by the run when the escortee reaches
    // its destination - and a run that ended the other way wrote nothing, so
    // losing it leaves the mission exactly where it was.
    if (t.kind === 'escort') {
      return !!(typeof Progress !== 'undefined' && Progress.escorted &&
                Progress.escorted[t.id]);
    }
    // RIDE FREIGHT: you were ON a train when it reached the place. Written by
    // the train, so walking there does not count.
    if (t.kind === 'rideFreight') {
      return !!(typeof Progress !== 'undefined' && Progress.rode &&
                Progress.rode[t.to]);
    }
    if (t.kind === 'machine') {
      return !!(typeof World !== 'undefined' && World.wasKilled &&
                World.wasKilled(t.id));
    }
    if (t.kind === 'barrier') {
      return !!(typeof Progress !== 'undefined' && Progress.shortcuts &&
                Progress.shortcuts[t.id]);
    }
    if (t.kind === 'clearArea') {
      if (!t.at) return false;
      const C = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
      const ax = t.at[0] * C + C / 2, ay = t.at[1] * C + C / 2;
      const r = t.radius || 4000;
      // YOU HAVE TO HAVE BEEN THERE. Without this an area you never visited
      // counts as cleared, because nothing has spawned in it — which would
      // hand the player a completed mission for staying at home.
      if (typeof World === 'undefined' || !World.isExplored ||
          !World.isExplored(Math.floor(ax / C), Math.floor(ay / C))) return false;
      if (typeof Population === 'undefined') return false;
      for (const e of Population.machines) {
        if (e.alive === false) continue;
        if (Math.hypot(e.x - ax, e.y - ay) < r) return false;
      }
      return true;
    }
    return false;
  },

  // Handed in. Rewards are paid through the writers that already exist.
  // TWO JOBS, TWO FUNCTIONS. `turnIn` is the GATE — are you on it, is it
  // finished — and `pay` is what you get. They were one function, which meant
  // the only way to check that a reward lands was to satisfy an objective
  // first, and so nobody ever checked and eleven of thirteen kinds paid
  // nothing.
  turnIn(id) {
    if (!this.isActive(id) || !this.complete(id)) return null;
    this._store()[id] = MISSION_STATE.DONE;
    const words = this.pay(MISSIONS[id]);
    if (typeof Progress !== 'undefined' && typeof Progress.save === 'function') {
      Progress.save();
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    return words;
  },

  pay(m) {
    if (!m) return null;
    const got = [];
    const r = m.reward || {};

    // EVERY KIND THE TABLE WRITES. This paid three of thirteen — and one of
    // the three (`permanent`) is a key no mission has ever used, so the real
    // count was two: scrap and module.
    //
    // Everything else was written in the data, read by the tests that check
    // the data, and never handed to a player: three permanent weapons, two
    // gadget grants, five vehicles, four paint sets, two slots, the upgrade
    // parts, the map knowledge and the one XP payout. The mission said DONE
    // and gave you nothing.
    //
    // It is worse than a quiet nothing, because tests/test_gates.js builds
    // the map's reachability graph out of `reward.gadget` and
    // `reward.chassisLocation` — so the cold-start walk was proving a route
    // through rewards the player never actually receives. The walk was right
    // about the design and wrong about the build.
    //
    // Every branch below writes through the record that already exists and is
    // already read by something. Nothing here invents a second source of truth.
    if (r.scrap) {
      // THROUGH Forge.bank, not `Forge.scrap +=`. bank() is the one writer and
      // it is where MARKET SENSE is applied, so paying around it meant the one
      // skill that says "scrap from EVERY source" was not true of missions.
      if (typeof Forge !== 'undefined') Forge.bank(r.scrap);
      got.push(r.scrap + ' SCRAP');
    }
    // XP. A mission may name its own; if it does not, it gets the band
    // CONTENT_ECONOMY gives every mission step. Only ONE of the twenty-seven
    // names one, so before this line twenty-six missions paid an XP figure
    // that exists in the economy document and nowhere else.
    let xp = r.xp || 0;
    if (!xp && typeof GARAGE !== 'undefined' && GARAGE.XP_MISSION_STEP) {
      const T = GARAGE.XP_MISSION_STEP;
      xp = T[Math.max(0, Math.min(T.length - 1, (m.step || 1) - 1))];
    }
    if (xp && typeof Levels !== 'undefined') {
      Levels.addXp(xp);
      got.push(xp + ' XP');
    }
    if (r.module && typeof Progress !== 'undefined') {
      Progress.partsSeen = Progress.partsSeen || {};
      Progress.partsSeen[r.module] = true;
      got.push((typeof PARTS !== 'undefined' && PARTS[r.module])
        ? PARTS[r.module].name : String(r.module).toUpperCase());
    }
    // `permanentWeapon` is what the table writes; `permanent` is what this
    // read. One word apart, three weapons never handed over.
    const perm = r.permanentWeapon || r.permanent;
    if (perm && typeof Permanents !== 'undefined') {
      Permanents.grant(perm);
      got.push((typeof PARTS !== 'undefined' && PARTS[perm])
        ? PARTS[perm].name : String(perm).toUpperCase());
    }
    // Two spellings, both live: `gadgetRank: ['seal', 2]` and
    // `gadget: { id: 'grapple', rank: 2 }`. Both go to Progress.gadgets,
    // which every barrier gate and every gear requirement already reads.
    const grants = [];
    if (Array.isArray(r.gadgetRank)) {
      grants.push([r.gadgetRank[0], r.gadgetRank[1] || 1]);
    }
    if (r.gadget && r.gadget.id) grants.push([r.gadget.id, r.gadget.rank || 1]);
    if (typeof r.gadget === 'string') grants.push([r.gadget, 1]);
    for (const [g, rank] of grants) {
      if (typeof Progress === 'undefined') break;
      Progress.gadgets = Progress.gadgets || {};
      if ((Progress.gadgets[g] || 0) < rank) Progress.gadgets[g] = rank;
      got.push(String(g).toUpperCase() + ' ' + rank);
    }
    // A VEHICLE. `chassis` hands one over, `chassisLocation` tells you where
    // one is — and since nothing places a chassis in the world at a location a
    // mission names, both unlock it. When a chassis is really parked out there
    // the second branch becomes a waypoint instead, and this is the one line
    // that changes.
    // THROUGH Rigs.grant, which owns `Progress.rigsOwned` — the record every
    // barrier's _rigOpens, the garage's vehicle list and the fast-travel
    // network already read. `Progress.unlockRig` is a DIFFERENT table: it is
    // the six WRECKJACK Jackrigs, and handing a mission's KILN to it would
    // have been refused silently because RIGS[kiln] is not JACKRIGS[kiln].
    // Two tables named the same thing, one word apart, and the first version
    // of this fix used the wrong one.
    const rig = r.chassis || r.chassisLocation;
    if (rig && typeof Rigs !== 'undefined' && Rigs.grant) {
      Rigs.grant(rig);
      got.push((typeof RIGS !== 'undefined' && RIGS[rig])
        ? RIGS[rig].name : String(rig).toUpperCase());
    }
    // PAINT is free and always was; a set is a thing you OWN.
    for (const [kind, id] of [['colourset', r.colourSet], ['decalset', r.decalSet]]) {
      if (!id || typeof Progress === 'undefined') continue;
      Progress.paintOwned = Progress.paintOwned || {};
      Progress.paintOwned[kind + ':' + id] = true;
      got.push(String(id).toUpperCase());
    }
    if (r.slot && typeof Progress !== 'undefined') {
      Progress.foundSlots = (Progress.foundSlots || 0) + 1;
      got.push('A SLOT');
    }
    // UPGRADE PARTS: one of CONTENT_ECONOMY's five currencies, "the throttle
    // on power", found and given by missions ONLY. It had no counter at all.
    if (r.upgradeParts && typeof Progress !== 'undefined') {
      Progress.upgradeParts = (Progress.upgradeParts || 0) + r.upgradeParts;
      got.push(r.upgradeParts + ' UPGRADE PARTS');
    }
    // MAP KNOWLEDGE, spent as EXPLORED CHUNKS — which is the record the map
    // already reads to decide whether a barrier has been "seen" and may show
    // its opener. No new save field, and it lands as the thing it promises.
    if (r.mapKnowledge && typeof World !== 'undefined' && World.markExplored) {
      got.push(this._reveal(r.mapKnowledge));
    }
    return got.length ? got.join('  +  ') : 'DONE';
  },

  // What `mapKnowledge` actually reveals: the chunks the thing it names stands
  // in, marked EXPLORED. The map already treats an explored chunk as one whose
  // barriers you have seen, so "reveals: barriers" arrives as exactly that
  // without a second record to keep in step.
  _reveal(k) {
    if (typeof DISTRICTS === 'undefined') return 'THE MAP';
    const ids = k.district ? [k.district] : Object.keys(DISTRICTS);
    let n = 0;
    for (const did of ids) {
      const sp = DISTRICTS[did] && DISTRICTS[did]._spec;
      if (!sp) continue;
      const rows = k.reveals === 'chassis' ? (sp.chassis || {}) : (sp.barriers || {});
      for (const key of Object.keys(rows)) {
        const bits = key.split(',');
        World.markExplored(Number(bits[0]), Number(bits[1]), did);
        n++;
      }
    }
    return n + ' PLACES ON THE MAP';
  },

  // ---- THE COMPASS PIP ----------------------------------------------------
  // `Compass.pips` has asked for this BY CAPABILITY since the strip was built,
  // and taken nothing because the function did not exist. It exists now, and
  // the pip appears with no edit to compass.js — which is exactly what asking
  // by capability rather than by name was for.
  activeTarget() {
    const did = (typeof World !== 'undefined' && World.district)
      ? World.district.id : null;
    for (const id of this.activeList()) {
      const m = MISSIONS[id];
      if (!m || !m.target) continue;
      const n = m.npc && NPCS[m.npc];
      if (n && n.district !== did) continue;
      // FINISHED? Point at the person who wants it back, not at the empty
      // place you have already cleared.
      if (this.complete(id) && n) {
        const p = this.npcPos(m.npc);
        if (p) return { x: p.x, y: p.y, label: n.name, district: did };
      }
      const p = this.targetPos(m.target, did);
      if (p) return { x: p.x, y: p.y, label: m.title || 'OBJECTIVE', district: did };
    }
    return null;
  },

  npcPos(npcId) {
    const n = NPCS[npcId];
    if (!n || !n.at) return null;
    const C = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
    return { x: n.at[0] * C + C / 2, y: n.at[1] * C + C / 2 };
  },

  // WHERE the objective is, in world units. Found by asking the district data
  // where the thing actually stands — never a second table of coordinates,
  // which would drift the first time anybody moved one.
  targetPos(t, did) {
    const C = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
    if (t.kind === 'clearArea' && t.at) {
      return { x: t.at[0] * C + C / 2, y: t.at[1] * C + C / 2 };
    }
    const d = (typeof DISTRICTS !== 'undefined') ? DISTRICTS[did] : null;
    if (!d || !d._spec) return null;
    const scan = (rows, idIndex, wanted) => {
      for (const k of Object.keys(rows || {})) {
        for (const row of rows[k]) {
          if (row[idIndex] !== wanted) continue;
          const b = k.split(',');
          return { x: +b[0] * C + row[0], y: +b[1] * C + row[1] };
        }
      }
      return null;
    };
    if (t.kind === 'find') return scan(d._spec.findsAt, 3, t.id);
    if (t.kind === 'machine') return scan(d._spec.placed, 2, t.id);
    if (t.kind === 'barrier') return scan(d._spec.barriers, 3, t.id);
    if (t.kind === 'wreck') return scan(d._spec.wrecks, 2, t.id);

    // MULTI points at the NEXT ONE YOU STILL NEED, not at the first in the
    // list. Three drones on three rooftops is three separate drives, and a
    // compass that keeps pointing at the one you already have is a compass
    // that has stopped being about the job.
    if (t.kind === 'multi') {
      for (const id of (t.ids || [])) {
        if (this._idDone(id)) continue;
        const p = scan(d._spec.findsAt, 3, id) ||
                  scan(d._spec.placed, 2, id) ||
                  scan(d._spec.barriers, 3, id) ||
                  scan(d._spec.wrecks, 2, id);
        if (p) return p;
      }
      // All done: the last one, so the pip still has somewhere to be while
      // the mission is on its way back to whoever asked for it.
      const last = (t.ids || [])[(t.ids || []).length - 1];
      return last ? (scan(d._spec.findsAt, 3, last) ||
                     scan(d._spec.placed, 2, last) ||
                     scan(d._spec.barriers, 3, last)) : null;
    }

    // RIDE FREIGHT points at THE SIDING — the place the train is going, which
    // is what LEDGER is asking about. Asked of the line table, so the pip and
    // the train cannot disagree about where the end of the line is.
    // A roamer has no fixed position by definition. The pip points at the
    // district's own middle: "it is out there, in here" is the true answer,
    // and a pip that followed a boss around would be a tracker nobody earned.
    if (t.kind === 'bossDamage') {
      if (!d.cols || !d.rows) return null;
      return { x: d.cols * C / 2, y: d.rows * C / 2 };
    }
    // AN ESCORT POINTS AT THE THING, not at where it is going: your job is
    // to be next to it. Before the run starts, at the person who wants it
    // moved, because that is where you go to begin.
    if (t.kind === 'escort') {
      if (typeof Escorts !== 'undefined') {
        const p = Escorts.pip();
        if (p) return p;
      }
      const C2 = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
      return t.to ? { x: t.to[0] * C2 + C2 / 2, y: t.to[1] * C2 + C2 / 2 } : null;
    }
    if (t.kind === 'rideFreight') {
      if (typeof RAILSPINE_LINES === 'undefined' || !d.rows) return null;
      for (const L of RAILSPINE_LINES) {
        if (L.to !== t.to || L.toCx === undefined) continue;
        return { x: L.toCx * C + C / 2,
                 y: (L.line + 0.5) * (d.rows * C / 9) };
      }
      return null;
    }
    return null;
  },

  // ---- the NPC in reach ---------------------------------------------------
  nearest(player) {
    if (!player || typeof NPC === 'undefined') return null;
    const st = (typeof Game !== 'undefined' && Game.states && Game.states.GAME)
      ? Game.states.GAME : null;
    const list = (st && st.entities) || [];
    let best = null, bd = NPC_B.TALK_R;
    for (const e of list) {
      if (!(e instanceof NPC)) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  // TALK. One button, and what it does depends only on where the chain is —
  // there is no dialogue tree, no menu and nothing to choose, because none of
  // these nine is asking you a question.
  talk(npc) {
    const def = NPCS[npc.npcId];
    if (!def) return null;
    const id = this.nextFor(npc.npcId);
    if (!id) {
      return { name: def.name, kind: 'idle', lines: def.idle || ['...'] };
    }
    const m = MISSIONS[id];
    if (this.isActive(id)) {
      if (this.complete(id)) {
        const paid = this.turnIn(id);
        return { name: def.name, kind: 'done', reward: paid,
                 lines: (m.lines && m.lines.done) || def.done || ['Done.'] };
      }
      // A RUN YOU LOST STARTS AGAIN HERE. resumeEscort says so above it and
      // had no caller (D342): a lost escortee left the job active, this
      // branch repeated the brief, and nothing ever put a new one in the
      // world. Asked first, so an escort with nobody on the road is the
      // one case where talking again is the job being given again.
      if (this.resumeEscort(npc.npcId)) {
        return { name: def.name, kind: 'given', title: m.title,
                 lines: (m.lines && m.lines.give) || def.meet || [m.brief] };
      }
      return { name: def.name, kind: 'progress', title: m.title,
               lines: [m.brief || m.title] };
    }
    this.give(id);
    return { name: def.name, kind: 'given', title: m.title,
             lines: (m.lines && m.lines.give) || def.meet || [m.brief] };
  },
};

// SCRAPCORE: BREAKLANDS — WORLD POPULATION AND ALERT (Block 2)
//
// WRECKJACK spawned a wave into a closed room and the fight WAS the room. An
// open world has no rooms, so machines belong to the GROUND instead of to an
// encounter, and the player has to be able to walk away from them.
//
// TWO KINDS OF MACHINE, and the difference is the whole loot design:
//
//   PATROLS   belong to a post. They respawn forever, so nowhere is ever empty
//             and combat never runs dry. They pay scrap, XP, weapon skill and
//             parts you can carry home. They NEVER pay the rare stuff.
//
//   PLACED    are authored in the district file with a permanent id. Killed
//             once, dead forever, and the flag is in the save. Each gives its
//             good gear ONCE.
//
// Between them: you can always find a fight, and you can never grind your way
// to everything. That is the rule those two halves exist to make true.
//
// ---------------------------------------------------------------------------
// ALERT. Rises with kills and destruction, decays over time, and CLEARS
// COMPLETELY at a garage. Three stages, in this order, because the order is the
// design:
//
//   1. DENSITY  — more patrols, same quality.
//   2. QUALITY  — better machines in the mix.
//   3. DISPATCH — a roaming boss comes for you.
//
// Density first is what makes alert readable: the player sees "more of them"
// before they meet "worse of them", so pushing on is a decision made with
// information rather than a surprise. Reordering it would make stage 1 feel
// like a difficulty spike out of nowhere.
//
// Block 14 supplies the roaming boss. Stage 3 currently dispatches a MARKED
// ELITE PACK and records that a roamer would have been sent, so the escalation
// is real and felt now and the boss drops into a hook that already exists.
//
// content/CONTENT_GADGETS.md makes the JAMMER the designed counter-play, and it
// is a mid-game find. Alert is NOT softened to compensate for that. What alert
// has instead, from the first minute, is free counter-play that costs nothing:
// break line of sight, or drive away. Alert decays on its own once nothing has
// seen you, and faster the further you get from where you were last seen. The
// Jammer later upgrades that from "retreat and wait" to "keep pushing", which
// is a choice rather than the only answer. Alert.suppressed / .suppressing are
// the two flags it will set; nothing sets them yet.

const POP = {
  // THE ROSTER'S SENTENCES, AS NUMBERS. An ambush machine notices you at
  // this fraction of sight; a caller wakes everything within CALL_R and adds
  // CALL_ALERT to the ladder; a marker wakes everything within MARK_R.
  AMBUSH_SIGHT: 0.35,
  CALL_R: 4200,
  CALL_ALERT: 1.0,
  MARK_R: 9000,
  // ---- patrols (2.1) -----------------------------------------------------
  RESPAWN_MIN: 50,        // seconds before a dead patrol post refills
  RESPAWN_MAX: 95,
  WAYPOINT_HIT: 260,      // close enough to a waypoint to take the next

  // ---- awareness (2.3) ---------------------------------------------------
  SIGHT: 1250,            // how far a machine notices the player
  SIGHT_ALERT: 850,       // added at maximum alert: a hunted district sees more
  HEAR_FIRING: 1900,      // firing is louder than driving
  LOSE_AFTER: 4.0,        // seconds out of sight before it gives up
  LEASH: 2800,            // how far a patrol chases from its post
  LEASH_GUARD: 1100,      // a placed machine guards its site and will not be pulled off

  // ---- streaming, same hysteresis shape as chunks ------------------------
  SPAWN_R: 2600,          // never appears closer than this to the player
  SPAWN_MAX_R: 5200,      // and never further, or it is culled before it acts
  CULL_R: 7200,           // beyond this from the player, a machine retires

  // ---- alert (2.4) -------------------------------------------------------
  ALERT_MAX: 3,           // one per stage
  ALERT_PER_KILL: 0.28,
  ALERT_PER_STRIP: 0.05,  // destruction, not just kills
  ALERT_PER_SEEN: 0.10,   // per second, per machine actively engaging
  CALM_AFTER: 6,          // seconds unseen before it starts falling
  // How long a hit keeps you "in a fight" after the last one. Shorter than
  // CALM_AFTER on purpose: this gates a speed bonus, and a bonus that takes
  // six seconds to come back after a scrape is a bonus you never feel.
  COMBAT_FOR: 3,
  COMBAT_LINGER: 2,       // seconds after the last machine engaging you stops
  CALM_RAMP: 1.5,         // how long the out-of-combat pace takes to arrive
  CALM_DROP: 0.5,         // and how long a fight starting takes to take it away
  // BLOCK 14. When a roamer breaks off, and how far it gets before it is
  // gone. In POP with the rest of the tuning, because these are numbers a
  // playtest will move and balance is data.
  DISENGAGE_AT: 0.25,     // health fraction it will not fight below
  DISENGAGE_R: 5200,      // how far it withdraws before it is out of it
  ALERT_DECAY: 0.045,     // per second when calm but still nearby
  ALERT_DECAY_FAR: 0.20,  // per second once well clear of the last contact
  FAR_ENOUGH: 4200,       // distance from last contact that counts as clear

  // The three stages, as data. `cap` is how many machines the district will
  // hold; `elite` is the seeded elite chance; `tier` shifts the role pool
  // toward tougher machines (stage 2); `dispatch` sends a pack (stage 3).
  STAGES: [
    { at: 0, name: 'CLEAR',    ink: '#8fa3c8', cap: 7,  elite: 0.10, tier: 0, dispatch: false },
    { at: 1, name: 'DENSITY',  ink: '#ffd23f', cap: 12, elite: 0.10, tier: 0, dispatch: false },
    { at: 2, name: 'QUALITY',  ink: '#ff7a1a', cap: 15, elite: 0.22, tier: 1, dispatch: false },
    { at: 3, name: 'DISPATCH', ink: '#ff3b3b', cap: 18, elite: 0.34, tier: 2, dispatch: true },
  ],

  DISPATCH_PACK: 3,       // marked elites sent at stage 3
  DISPATCH_COOLDOWN: 45,  // seconds between dispatches
};

// ---------------------------------------------------------------------------
// DETERMINISTIC SEEDING.
//
// A post must look the same every time you come back to it. If a spawner rolled
// its elite fresh each time its chunk reloaded, driving away and back would
// reroll the district, the map would stop meaning anything, and "that yard has
// a HUNTER in it" would never be a true sentence. Standing rule: the world
// never secretly scales, and it never secretly reshuffles either.
//
// So every choice a post makes is derived from its own id. Same post, same
// machine, forever, without storing a thing.
function popHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
function popHash2(str, salt) { return popHash(str + '|' + salt); }

// ---------------------------------------------------------------------------
const Alert = {
  level: 0,
  seenT: 99,              // seconds since anything last had eyes on the player
  lastSeenX: 0,
  lastSeenY: 0,
  peak: 0,
  dispatchT: 0,           // cooldown on stage-3 packs
  dispatches: 0,          // how many have been sent, for the report and the log

  // Set by the JAMMER gadget in Block 11. Two flags rather than one so rank 1
  // (stops rising) and rank 2 (actively falls) are both expressible without
  // this file needing to know what a gadget is.
  suppressed: false,
  suppressing: false,

  reset() {
    this.level = 0;
    this.seenT = 99;
    this.peak = 0;
    this.dispatchT = 0;
    this.dispatches = 0;
    this.suppressed = false;
    this.suppressing = false;
  },

  // A garage clears the district outright (3.1). The one hard reset.
  //
  // "INSTANTLY AND COMPLETELY", and the second word is the one that was
  // missing: this used to zero the LEVEL and leave everything the level had
  // sent still driving at you. A player who reached a garage at stage 3 saw
  // CLEAR on the bar with a boss and three marked elites in the mirror, which
  // is worse than not clearing it at all — the readout was lying.
  //
  // So the things the ladder SENT stand down too. Not deleted: retired the
  // same way a roamer that breaks off is retired, so a dispatched pack simply
  // stops existing and the roamer keeps its damage and remembers where it
  // went. Reaching a garage is the counter-play to an alert; it should feel
  // like one.
  clearAtGarage() {
    this.level = 0;
    this.seenT = 99;
    this.dispatchT = 0;
    if (typeof Population !== 'undefined') Population.standDown();
  },

  stage() {
    let s = POP.STAGES[0];
    for (const row of POP.STAGES) if (this.level >= row.at) s = row;
    return s;
  },
  stageIndex() { return POP.STAGES.indexOf(this.stage()); },

  sighted(x, y) { this.seenT = 0; this.lastSeenX = x; this.lastSeenY = y; },

  add(n) {
    if (this.suppressed || this.suppressing) return;
    // THE FIRST TWENTY MINUTES. "The Yard has one garage, one NPC, one elite,
    // one wall and NO ALERT." One district in the game is deliberately simple
    // and it must stay that way however tempting it is to fill - so the rule
    // lives at the ONE writer rather than as a flag every alert source has to
    // remember not to forget.
    if (typeof Opening !== 'undefined' && !Opening.alertAllowed()) return;
    // SIGNAL MASK: "alert rises 40% slower while fitted". Applied at the ONE
    // writer, so every source of alert — kills, sightings, dispatches — is
    // covered by one line and a new source cannot forget about the module.
    if (typeof Modules !== 'undefined') n *= Modules.mul(null, 'alertRateMul');
    this.level = Math.min(POP.ALERT_MAX, this.level + n);
    if (this.level > this.peak) this.peak = this.level;
  },

  update(dt, player) {
    this.seenT += dt;
    this.dispatchT = Math.max(0, this.dispatchT - dt);
    if (this.suppressing) {
      this.level = Math.max(0, this.level - POP.ALERT_DECAY_FAR * dt);
      return;
    }
    if (this.seenT < POP.CALM_AFTER) return;

    // THE FREE COUNTER-PLAY. Distance from where you were last seen decides
    // how fast it falls, so driving away is always an answer and a better one
    // the further you commit to it.
    const d = Math.hypot(player.x - this.lastSeenX, player.y - this.lastSeenY);
    const far = Math.min(1, d / POP.FAR_ENOUGH);
    const rate = POP.ALERT_DECAY + (POP.ALERT_DECAY_FAR - POP.ALERT_DECAY) * far;
    this.level = Math.max(0, this.level - rate * dt);
  },
};

// ---------------------------------------------------------------------------
const Population = {
  spawners: {},           // id -> spawner post
  machines: [],           // every live machine in the world
  stats: { spawned: 0, retired: 0, killed: 0, placedKilled: 0 },

  reset() {
    this.spawners = {};
    this.machines = [];
    this.stats = { spawned: 0, retired: 0, killed: 0, placedKilled: 0 };
    Alert.reset();
  },

  // ---- posts come and go with chunks; MACHINES DO NOT --------------------
  // STANDING RULE 4, and this is where it gets its workout. A post is
  // bookkeeping and belongs to its chunk. A live machine is world-owned, so one
  // chasing you across a boundary cannot be deleted mid-chase by an unload.
  // What retires a machine is DISTANCE, explicitly, in cull() — never a chunk
  // going away.
  onChunkLoad(chunk) {
    const data = World.district.chunkData(chunk.cx, chunk.cy);
    const ox = chunk.rect.x, oy = chunk.rect.y;

    (data.patrols || []).forEach((row, i) => {
      const id = chunk.key + ':p' + i;
      if (this.spawners[id]) return;
      this.spawners[id] = this._post(id, 'patrol', chunk.key,
        ox + row[0], oy + row[1], row[2] || 900);
    });

    // A placed machine's id is PERMANENT and comes from the data, not from its
    // index: renumbering the array must not resurrect something you killed.
    //
    // AND IT IS THE ONLY ID IT HAS. This used to be 'placed:' + row[2] while
    // Garages, the district data and the permanent-slot sources all named the
    // same machine as row[2] alone, so a kill was recorded under a key nobody
    // ever asked about: in a browser, killing the Press Warden would never
    // have opened the West Yard. Every suite was green, because the tests
    // wrote the key themselves on both sides of the comparison.
    //
    // The prefix bought nothing — patrol posts are keyed '<cx>,<cy>:p<i>' and
    // cannot collide with a hand-written machine id — so it is gone, and with
    // it the whole class of bug. One name for one machine.
    (data.placed || []).forEach((row) => {
      const id = row[2];
      if (this.spawners[id]) return;
      const s = this._post(id, 'placed', chunk.key, ox + row[0], oy + row[1], 0);
      s.aiType = row[3] || null;
      s.reward = row[4] || null;      // the good gear, given once
      s.permanent = row[5] || null;   // Block 4: the permanent weapon, once
      this.spawners[id] = s;
    });
  },

  onChunkUnload(key) {
    for (const id of Object.keys(this.spawners)) {
      if (this.spawners[id].chunk === key) delete this.spawners[id];
    }
  },

  _post(id, kind, chunk, x, y, radius) {
    return { id, kind, chunk, x, y, radius,
             live: null, cooldown: 0, aiType: null, reward: null,
             permanent: null };
  },

  // ---- the per-frame job -------------------------------------------------
  update(dt, player) {
    if (!World.district) return;
    // SHUT IT DOWN: "the harvesters halt mid-row." Nothing more is put out,
    // and what is out stops -- it stands where it is and does not shoot.
    if (typeof Story !== 'undefined' && Story.shutDown && Story.shutDown()) {
      for (const m of this.machines) {
        if (!m.alive) continue;
        m.wState = 'GUARD'; m.immobile = true; m.firingNow = false; m.halted = true;
      }
      return;
    }
    Alert.update(dt, player);
    const stage = Alert.stage();

    for (const id of Object.keys(this.spawners)) {
      const s = this.spawners[id];
      if (s.cooldown > 0) s.cooldown -= dt;

      if (s.live && !s.live.alive && !s.live.retired) {
        // Its machine was KILLED (not retired). A placed machine is done
        // forever and the world remembers; a patrol post refills.
        this._onKill(s);
      } else if (s.live && s.live.retired) {
        s.live = null;
        s.cooldown = Math.max(s.cooldown, 4);
      }

      if (!s.live) this._tryFill(s, player, stage);
    }

    for (const m of this.machines) {
      if (!m.roamer) continue;
      // A ROAMER THAT DIED. It has no spawner slot — it was dispatched, not
      // placed — so `_onKill` never sees it, and `cull` drops it from this
      // list at the end of this very frame. This is the one frame in which
      // "the player killed a roaming boss" is a fact anything can read.
      //
      // `retired` is the difference between beaten and sent home: standDown()
      // and cull() both set `alive = false` on a roamer that is leaving, and
      // paying out for those would hand the player a trophy for reaching a
      // garage.
      if (!m.alive && !m.retired) { this._onBossKilled(m.bossId, m); continue; }
      this._rememberRoamer(m);
      this._maybeDisengage(dt, m, player);
    }
    this._checkRoamerFound(player);

    this._dispatch(dt, player, stage);
    this.cull(player);
    this.think(dt, player);
  },

  // EVERYTHING THE ALERT SENT, TOLD TO GO HOME. Called by Alert.clearAtGarage
  // and by nothing else, because reaching a garage is the only thing in the
  // game that is supposed to undo an escalation.
  //
  // A dispatched machine is retired outright — it was never part of the world,
  // it was sent. A ROAMER is turned around instead of deleted, so it goes
  // through the same leaving path everything else does and arrives at the same
  // records: its damage kept, its position remembered, findable again.
  standDown() {
    let n = 0;
    for (const m of this.machines) {
      if (!m || !m.alive) continue;
      if (m.roamer) {
        if (m.leaving) continue;
        m.leaving = true;
        m.wState = 'RETURN';
        this._rememberRoamer(m);
        this.rememberAway(m);
        m.alive = false;
        m.retired = true;
        n++;
      } else if (m.dispatched) {
        m.alive = false;
        m.retired = true;
        this.stats.retired++;
        n++;
      }
    }
    return n;
  },

  // ONE DOOR FOR A DEAD BOSS, and both ways in go through it: a lair boss is
  // a PLACED machine and arrives via _onKill; a roamer has no spawner at all
  // and arrives from the per-frame walk. Bosses.payDrops is idempotent, so a
  // boss that somehow reached both doors is still paid once.
  _onBossKilled(bossId, ent) {
    if (!bossId || typeof Bosses === 'undefined' || !Bosses.payDrops) return;
    const got = Bosses.payDrops(bossId);
    if (!got || !got.length) return;
    // WHERE IT DIED, like every other reward in this game. A popup in the
    // middle of the screen is the one thing 2.2 decided against.
    if (typeof Effects !== 'undefined' && ent) {
      Effects.comicWord(got.join('  ·  '), ent.x, ent.y - 240,
                        CONFIG.COLOR.yellow, 54);
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
  },

  _onKill(s) {
    this.stats.killed++;
    if (s.kind === 'placed') {
      World.markKilled(s.id);
      this.stats.placedKilled++;
      // A LAIR BOSS IS A PLACED MACHINE. Its drops are the four shipping
      // bosses' whole reward, including the only CUTTER 2 in the game.
      if (s.live && s.live.bossId) this._onBossKilled(s.live.bossId, s.live);
      // 2.2: its good gear, once. Dropped where it died so it has to be
      // magneted up like anything else - a reward you walk to, not a popup.
      if (s.reward && s.live) {
        LooseParts.spawn(s.reward, 1, s.live.x, s.live.y, 0, 0, 'G3');
      }
      // 4.2: and its permanent, once. This is what 'earned, never bought'
      // means in code — there is no other route by which one is granted.
      if (s.permanent && typeof Permanents !== 'undefined') {
        if (Permanents.grant(s.permanent)) {
          const p = Permanents.part(s.permanent);
          if (p && typeof Effects !== 'undefined' && s.live) {
            Effects.comicWord(p.name + ' RECOVERED', s.live.x, s.live.y - 200,
              CONFIG.COLOR.yellow, 62);
          }
        }
      }
    } else {
      s.cooldown = POP.RESPAWN_MIN +
        popHash2(s.id, 'cd') * (POP.RESPAWN_MAX - POP.RESPAWN_MIN);
    }
    // Destruction raises alert whoever did it.
    Alert.add(POP.ALERT_PER_KILL);
    // "That's one off the roster. Nobody's updating the roster."
    if (typeof Radio !== 'undefined') Radio.fire('first_kill');
    s.live = null;
  },

  _tryFill(s, player, stage) {
    if (s.cooldown > 0) return;
    if (s.kind === 'placed' && World.wasKilled(s.id)) return;
    // THE CAP IS FOR PATROLS. A placed machine is a hand-authored lesson
    // at a fixed spot -- the Yard's PICKER, a district's guard -- and a cap
    // that a pack of CINDERS could fill was a cap that could silently
    // delete the lesson. Placed posts are finite and seeded; they spawn.
    if (s.kind !== 'placed' && this.aliveCount() >= stage.cap) return;
    this._spawnFor = player;

    // Never appear in view, and never so far away that the machine is culled
    // again before it has done anything. Same hysteresis shape as chunks.
    //
    // EXCEPT INSIDE A LAIR (Block 14). "Never appear in view" is right for a
    // world you drive through and exactly wrong for a room you walked into on
    // purpose: a boss that refuses to exist until you back away from it is a
    // boss that is not in its own hall. The room is three chunks square, so
    // there is nowhere to stand that is far enough away, and the first build
    // of the Crucible came out EMPTY for precisely this reason.
    const interior = !!(World.district && World.district._spec &&
                        World.district._spec.interior);
    if (!interior) {
      const d = Math.hypot(s.x - player.x, s.y - player.y);
      if (d < POP.SPAWN_R || d > POP.SPAWN_MAX_R) return;
    }

    const e = this.spawn(s, stage);
    if (e) s.live = e;
  },

  // Build the machine a post holds. Every choice is seeded off the post's id.
  spawn(s, stage) {
    const pool = (World.district && World.district.spawnPool) || 'yard';
    const dmul = (Profile.difficultyData && Profile.difficultyData.mul) || 1;
    // STAGE 2, QUALITY: alert buys a bigger budget, which the Director spends
    // on better cores and more modules. Same pool, better machines.
    const budget = SPAWN_POOLS[pool].budget(0) * dmul * (1 + stage.tier * 0.35);

    // THE DISTRICT'S OWN ROSTER, when it has one. A hand-authored machine
    // beats a Director-assembled one every time: it is a designed build with
    // its modules mounted where the fight wants them (front armour on a
    // STACKER, the reactor at the BACK of a SLAGJAW), and the Director can
    // only ever produce a plausible pile of parts.
    //
    // Seeded off the post exactly like everything else here, so the machine
    // at a given yard is the same machine every visit.
    const districtId = (World.district && World.district.id) || null;
    if (s.kind !== 'placed' && typeof Enemies !== 'undefined' &&
        Enemies.hasPool(districtId)) {
      // NEVER WITH. The HIVE says `neverWith: ['summons']` -- two "kill it
      // first" supports in one fight is unfair -- so a pick whose roster
      // entry names a machine already alive nearby, or is named by one, is
      // rerolled; three tries, then the post spawns the Director's build
      // rather than the pair the roster forbids.
      let pickId = null;
      for (let tries = 0; tries < 3; tries++) {
        const cand = Enemies.pick(districtId, stage.tier,
          popHash2(s.id, 'roster' + (tries ? tries : '')));
        if (cand && this._neverWithNearby(cand, s)) continue;
        pickId = cand;
        break;
      }
      const built = pickId ? Enemies.build(pickId) : null;
      if (built && built.loadout.length) {
        const e2 = new Enemy(s.x, s.y, built.loadout, built.aiType,
          built.coreKey, { grade: stage.tier >= 1 ? 'G3' : 'G2',
                           sockets: built.sockets });
        e2.rosterId = built.id;
        Enemies.applyTraits(e2, built);
        // BLOCK 14: a boss carries its own id, which is what tells
        // Machine.detach that losing a part should change the fight.
        if (built.bossId) e2.bossId = built.bossId;
        this._finishSpawn(e2, s, stage);
        this._spawnPack(e2, built, s, stage);
        return e2;
      }
    }

    // PHASE C: a placed row's fourth column may name a ROSTER BUILD
    // ('picker', 'marshal', 'foremans_hand') rather than a bare brain. The
    // patrol path above already prefers a hand-authored build over a
    // Director-assembled one, for the same reason: a designed machine has
    // its modules mounted where the fight wants them. The placed path never
    // learned that (Block 2 predates the roster) — the district drafts place
    // machines by build id, so now it speaks both.
    if (s.kind === 'placed' && s.aiType &&
        typeof ENEMY_BUILDS !== 'undefined' && ENEMY_BUILDS[s.aiType]) {
      const built = Enemies.build(s.aiType);
      // A BOSS MAY HAVE NO PARTS. The DISPATCHER "has no weapons. It
      // allocates." -- a core and nothing else, which the loadout gate
      // below refused as an empty build, so the last boss in the game never
      // stood on its own floor. A boss build is placed whatever it carries.
      if (built && (built.loadout.length || built.bossId)) {
        const e2 = new Enemy(s.x, s.y, built.loadout, built.aiType,
          built.coreKey, { grade: stage.tier >= 1 ? 'G3' : 'G2',
                           sockets: built.sockets });
        e2.rosterId = built.id;
        Enemies.applyTraits(e2, built);
        // BLOCK 14: a boss carries its own id, which is what tells
        // Machine.detach that losing a part should change the fight.
        if (built.bossId) e2.bossId = built.bossId;
        this._finishSpawn(e2, s, stage);
        this._spawnPack(e2, built, s, stage);
        return e2;
      }
    }

    const ai = s.aiType || Director.pickAiSeeded(pool, popHash2(s.id, 'ai'));
    // SEEDED OFF THE POST. Not just the brain — the whole build, loadout
    // and all. A post that rerolled its gear on every visit would mean the
    // district could never be learned, and 'that yard has a HUNTER with a
    // railgun' would never be a true sentence.
    const spec = Director.withSeed(s.id, () =>
      Director.buildMachine(pool, ai, budget));
    if (!spec) return null;

    const e = new Enemy(s.x, s.y, spec.loadout, spec.aiType, spec.coreKey,
      { grade: spec.grade });
    return this._finishSpawn(e, s, stage);
  },

  // Everything a freshly built machine needs whatever built it. Factored out
  // so the district's hand-authored roster and the Director's assembled builds
  // go through EXACTLY the same finishing - ownership, routing and the seeded
  // elite roll - rather than one of them quietly skipping a step.
  _finishSpawn(e, s, stage) {
    this._adoptWorldOwned(e, s.id);
    e.homeX = s.x;
    e.homeY = s.y;
    e.patrolR = s.radius;
    e.placed = s.kind === 'placed';
    e.wState = e.placed ? 'GUARD' : 'PATROL';
    this._route(e);

    // 2.5 SEEDED ELITES. Rolled from the post's id, so a post that holds a
    // HUNTER holds it every time you come back. Alert raises the CHANCE for
    // posts that have not spawned yet; it never rerolls one already out.
    const roll = popHash2(s.id, 'elite');
    if (stage && roll < stage.elite) this._makeElite(e, popHash2(s.id, 'ek'));

    // WALL-MOUNTED. The CITE is `mount: 'wall'`: it sits against the nearest
    // structure within reach of its post, on the face nearest the post, so
    // it reads as bolted to a building rather than parked in the street.
    if (e.traits && e.traits.mount === 'wall' && typeof World !== 'undefined') {
      let best = null, bd = 900;
      for (const o of (World.obstacles || [])) {
        const ox = o.type === 'pillar' ? o.x : (o.x + (o.w || 0) / 2);
        const oy = o.type === 'pillar' ? o.y : (o.y + (o.h || 0) / 2);
        const d = Math.hypot(ox - e.x, oy - e.y);
        if (d < bd) { bd = d; best = { x: ox, y: oy, r: o.type === 'pillar' ? o.r : Math.max(o.w || 0, o.h || 0) / 2 }; }
      }
      if (best) {
        const dx = e.x - best.x, dy = e.y - best.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x = best.x + (dx / d) * (best.r + e.radius + 10);
        e.y = best.y + (dy / d) * (best.r + e.radius + 10);
        e.homeX = e.x; e.homeY = e.y;
        e.mounted = true;
      }
    }

    this.machines.push(e);
    this.stats.spawned++;
    return e;
  },

  // A PACK. A roster build with `packSize` -- CINDER 5, POLLEN 8, CHARGE 4,
  // BLOOM 6 -- is one post putting out the whole pack, spread around the
  // leader, each finished the same way and each knowing its place in the
  // line so a `formation` can use it. Capped like every other spawn.
  _spawnPack(leader, built, s, stage) {
    const n = built.traits && built.traits.packSize;
    if (!n || n < 2 || typeof Enemy === 'undefined') return;
    leader._pack = leader.spawner; leader._formIdx = 0; leader._formN = n;
    const pl = this._spawnFor;
    for (let i = 1; i < n; i++) {
      if (stage && this.aliveCount() >= stage.cap) break;
      const a = (i / n) * Math.PI * 2;
      const r = 220 + (i % 2) * 120;
      let mx = s.x + Math.cos(a) * r, my = s.y + Math.sin(a) * r;
      // NEVER IN VIEW, same as the leader: a member that would land inside
      // the spawn radius is put on the far side of the post instead.
      if (pl && Math.hypot(mx - pl.x, my - pl.y) < POP.SPAWN_R) {
        mx = s.x - Math.cos(a) * r; my = s.y - Math.sin(a) * r;
        if (Math.hypot(mx - pl.x, my - pl.y) < POP.SPAWN_R) continue;
      }
      const m = new Enemy(mx, my,
        built.loadout, built.aiType, built.coreKey,
        { grade: stage && stage.tier >= 1 ? 'G3' : 'G2', sockets: built.sockets });
      m.rosterId = built.id;
      Enemies.applyTraits(m, built);
      this._adoptWorldOwned(m, s.id + ':pack' + i);
      m.homeX = s.x; m.homeY = s.y; m.patrolR = s.radius;
      m.placed = s.kind === 'placed';
      m.wState = m.placed ? 'GUARD' : 'PATROL';
      m._pack = leader.spawner; m._formIdx = i; m._formN = n;
      this._route(m);
      this.machines.push(m);
      this.stats.spawned++;
    }
  },

  // Is a machine this build must never share the field with already alive
  // near the post -- in either direction of the promise.
  _neverWithNearby(buildId, s) {
    if (typeof ENEMY_BUILDS === 'undefined') return false;
    const b = ENEMY_BUILDS[buildId];
    const R = 9000;
    for (const m of this.machines) {
      if (!m.alive || !m.rosterId) continue;
      if (Math.hypot(m.x - s.x, m.y - s.y) > R) continue;
      const other = ENEMY_BUILDS[m.rosterId];
      if ((b && b.neverWith && b.neverWith.indexOf(m.rosterId) >= 0) ||
          (other && other.neverWith && other.neverWith.indexOf(buildId) >= 0)) return true;
    }
    return false;
  },

  // STANDING RULE 4: world-owned, never chunk-owned.
  _adoptWorldOwned(e, spawnerId) {
    e._chunk = null;
    e.spawner = spawnerId;
    e.retired = false;
  },

  // An elite must READ as an elite before it is in range to hurt you. The halo
  // enemy.js already draws is the badge; this is the silhouette. Bigger, and
  // carrying more, so the decision to avoid it can be made at a glance and at
  // distance - a player should never be surprised by an elite.
  _makeElite(e, roll) {
    // "That one's had work done." Fired where an elite is MADE, so it is
    // the first one that exists rather than the first one you looked at.
    if (typeof Radio !== 'undefined') Radio.fire('first_elite_seen');
    // THE DISTRICT'S OWN ELITE KINDS (D351). Every district names the
    // kinds its elites come in -- the Sprawl reinforced and overclocked, the
    // Barrens hunters only -- and the list was carried by districtgen and
    // read by nobody: every elite everywhere rolled from the whole table.
    // The district's list first; the whole table where it names none.
    const own = (typeof World !== 'undefined' && World.district && World.district.elites) || [];
    const kinds = own.filter(k => ELITES[k]);
    const from = kinds.length ? kinds : ELITE_LIST;
    const kind = from[Math.min(from.length - 1, Math.floor(roll * from.length))];
    Elites.make(e, kind);
    e.radius = Math.round(e.radius * 1.22);
    e.eliteMark = true;
    return e;
  },

  // A patrol route around the post. Seeded, so a machine walks the same beat
  // every time, which is what makes a route learnable and therefore avoidable.
  _route(e) {
    const n = 3 + Math.floor(popHash2(e.spawner, 'n') * 3);
    e.route = [];
    for (let i = 0; i < n; i++) {
      const a = popHash2(e.spawner, 'a' + i) * Math.PI * 2;
      const r = e.patrolR * (0.45 + popHash2(e.spawner, 'r' + i) * 0.55);
      e.route.push({ x: e.homeX + Math.cos(a) * r, y: e.homeY + Math.sin(a) * r });
    }
    e.routeAt = 0;
  },

  // ---- STAGE 3: DISPATCH -------------------------------------------------
  // A ROAMING BOSS ARRIVES. `BOSS_DISPATCH` has named which one per district
  // since the boss data landed, and nothing read it: stage 3 logged that a
  // roamer WOULD have gone out and sent an elite pack instead. It goes out now.
  //
  // ONE AT A TIME. A second dispatch while the first roamer is still alive
  // sends the pack, because two bosses at once is not escalation, it is a
  // pile-up - and the pack was always the right answer for the second wave.
  _dispatch(dt, player, stage) {
    if (!stage.dispatch || Alert.dispatchT > 0) return;
    Alert.dispatchT = POP.DISPATCH_COOLDOWN;
    Alert.dispatches++;
    this.roamerWanted = (this.roamerWanted || 0) + 1;

    if (this._sendRoamer(player, stage)) return;

    const pool = (World.district && World.district.spawnPool) || 'yard';
    const dmul = (Profile.difficultyData && Profile.difficultyData.mul) || 1;
    const budget = SPAWN_POOLS[pool].budget(0) * dmul * 1.7;
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < POP.DISPATCH_PACK; i++) {
      if (this.aliveCount() >= stage.cap) break;
      const a = a0 + (i / POP.DISPATCH_PACK) * Math.PI * 2;
      const r = POP.SPAWN_R + 400;
      // AND THE FIRST ONE SENT IS THE POOL'S OWN NAMED ELITE (D351).
      // enemies.js: "DISPATCH adds the elites ... the district's own harder
      // roster, which is what the stage was always for." ENEMY_POOLS names
      // one per district (THE PRESS, the BLOCK WARDEN, the BAILIFF'S CLERK)
      // and Enemies.pickElite read that list for a caller that never came:
      // every dispatch was three pool builds with a badge. The first of the
      // pack is the named build now, through the roster's own spawnBuild
      // (which adopts, routes and lists it); the other two are the pack as
      // before.
      if (i === 0 && typeof Enemies !== 'undefined' && Enemies.pickElite) {
        const named = Enemies.pickElite(World.district && World.district.id,
          popHash2('dispatch' + Alert.dispatches, 'named'));
        const ne = (named && typeof ENEMY_BUILDS !== 'undefined' && ENEMY_BUILDS[named])
          ? this.spawnBuild(named, player.x + Math.cos(a) * r, player.y + Math.sin(a) * r) : null;
        if (ne) {
          ne.summoned = false;
          ne.dispatched = true;
          ne.patrolR = 700;
          this._makeElite(ne, popHash2('dispatch' + Alert.dispatches, 'k' + i));
          continue;
        }
      }
      // A real BRAIN from the pool, not an elite name — 'hunter' is an ELITE
      // KIND (families.js), and handing it to buildMachine looks up
      // AI_CORES['hunter'], gets undefined, and throws inside the weighted
      // pick. What marks a dispatched machine is the elite treatment below.
      const spec = Director.buildMachine(pool, null, budget);
      if (!spec) break;
      const e = new Enemy(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r,
        spec.loadout, spec.aiType, spec.coreKey, { grade: spec.grade });
      this._adoptWorldOwned(e, 'dispatch:' + Alert.dispatches + ':' + i);
      e.homeX = e.x; e.homeY = e.y; e.patrolR = 700;
      e.wState = 'ENGAGE';          // they are here for you and they know it
      e.dispatched = true;
      this._makeElite(e, popHash2('dispatch' + Alert.dispatches, 'k' + i));
      this._route(e);
      this.machines.push(e);
      this.stats.spawned++;
    }
  },

  // ---- THE ROAMER ---------------------------------------------------------
  //
  // "A boss ARRIVES (from a direction, audibly, ~15s - long enough to run for
  // a garage), never spawns in front of you." So it is put down at the far
  // edge of the streaming radius, on a bearing, and drives in.
  //
  // AND IT STAYS HURT. draft_bosses: "Roamers disengage when badly hurt and
  // damage PERSISTS between encounters (save field roamerDamage{}), and they
  // can be hunted down." That is what makes a roamer a running argument rather
  // than a random event, and it is the whole of TALLY's third mission.
  roamerFor(districtId) {
    if (typeof BOSS_DISPATCH === 'undefined') return null;
    return BOSS_DISPATCH[districtId] || BOSS_DISPATCH.default || null;
  },

  roamerAlive(bossId) {
    for (const m of this.machines) {
      if (m.alive && m.bossId === bossId) return true;
    }
    return false;
  },

  _sendRoamer(player, stage) {
    if (!World.district) return false;
    const bid = this.roamerFor(World.district.id);
    if (!bid || typeof BOSSES === 'undefined' || !BOSSES[bid]) return false;
    // A ROAMER THAT BROKE OFF IS NOT SENT AGAIN. It is out there, hurt, in a
    // chunk the world remembers - and dispatching a fresh copy would be the
    // game handing back the fight the player chose to let go.
    if (this.roamerAway(bid)) return false;
    // A LAIR BOSS IS NOT A ROAMER. It is sitting in its hall waiting, and
    // dispatching a copy of it into the open world would make the room
    // pointless.
    if (BOSSES[bid].kind !== 'roamer') return false;
    if (this.roamerAlive(bid)) return false;
    // DEAD IS DEAD. The one record every other permanent kill uses.
    if (World.wasKilled && World.wasKilled('boss_' + bid)) return false;
    if (typeof Lairs !== 'undefined' && Lairs.registerBuilds) {
      Lairs.registerBuilds();
    }

    const a = Math.random() * Math.PI * 2;
    const r = POP.SPAWN_R + 400;
    return !!this.sendRoamerAt(bid,
      { x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r },
      player);
  },

  // THE ONE PLACE A ROAMER IS BUILT, whether the alert sent it or you went
  // and found it. Two paths building the same machine two ways is how one of
  // them ends up not carrying its damage.
  sendRoamerAt(bid, at, announceTo) {
    if (typeof Lairs !== 'undefined' && Lairs.registerBuilds) {
      Lairs.registerBuilds();
    }
    const e = this.spawnBuild('boss_' + bid, at.x, at.y);
    if (!e) return null;

    e.bossId = bid;
    e.roamer = true;
    e.leaving = false;
    e.patrolR = 4000;               // it hunts; it does not hold a post
    // IT ARRIVES CARRYING WHAT YOU DID TO IT LAST TIME.
    const frac = (typeof Progress !== 'undefined' && Progress.roamerDamage)
      ? Progress.roamerDamage[bid] : undefined;
    if (frac !== undefined && frac < 1 && e.maxHp) {
      e.hp = Math.max(1, e.maxHp * frac);
    }
    // ...AND WEARING WHAT IT TOOK OFF YOU.
    if (typeof Roamers !== 'undefined') Roamers.dress(e, bid);
    const who = announceTo || e;
    if (typeof Effects !== 'undefined' && typeof BOSSES !== 'undefined') {
      Effects.comicWord(BOSSES[bid].name + ' IS COMING',
        who.x, who.y - 300, CONFIG.COLOR.red, 66);
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('bossWarn');
    return e;
  },

  // ---- IT BREAKS OFF, AND IT REMEMBERS RUNNING ---------------------------
  //
  // draft_bosses: "Roamers DISENGAGE WHEN BADLY HURT and stay hurt", and each
  // of the four says where it goes - the Reaper "returns to its row and keeps
  // harvesting, find it again by following the rows"; PATCHWORK "wanders off
  // to scavenge, comes back with new parts".
  //
  // Which is a very different thing from despawning, and the difference is
  // the whole feature: A BOSS THAT DISENGAGED IS SOMEWHERE. It is on the map,
  // it is still hurt, and going after it is a decision you get to make. A
  // boss that vanished is a fight the game took away from you.
  //
  // So breaking off writes THREE things: the damage (already one-way), the
  // chunk it withdrew to, and the fact that it is away. The first is what
  // makes hunting it worth doing; the second is what makes it findable; the
  // third is what stops the alert ladder sending it straight back.
  disengaging(e) {
    return !!(e && e.roamer && e.alive && e.maxHp &&
              e.hp / e.maxHp <= POP.DISENGAGE_AT);
  },

  // ONE PLACE. Called from the same per-frame walk that remembers the damage,
  // because "how hurt is it" and "will it stay" are the same question asked
  // one frame apart.
  _maybeDisengage(dt, e, player) {
    if (!e.roamer || !e.alive) return;
    if (!e.leaving && this.disengaging(e)) {
      e.leaving = true;
      // IT TURNS AND GOES. Away from you, so breaking off reads as a
      // decision the machine made rather than as a pause in the fight.
      const a = Math.atan2(e.y - player.y, e.x - player.x);
      e.leaveX = e.x + Math.cos(a) * POP.DISENGAGE_R * 1.4;
      e.leaveY = e.y + Math.sin(a) * POP.DISENGAGE_R * 1.4;
      e.wState = 'RETURN';
      e.homeX = e.leaveX; e.homeY = e.leaveY;
      if (typeof Radio !== 'undefined') Radio.fire('boss_disengaged');
      if (typeof Effects !== 'undefined' && typeof BOSSES !== 'undefined') {
        Effects.comicWord(BOSSES[e.bossId].name + ' IS BREAKING OFF',
          e.x, e.y - 260, CONFIG.COLOR.orange, 58);
      }
      if (typeof Audio_ !== 'undefined') Audio_.play('bossWarn');
    }
    if (!e.leaving) return;
    // GONE, once it is far enough away. Recorded where it went, so it can be
    // found again, and taken out of the world rather than left driving.
    if (Math.hypot(player.x - e.x, player.y - e.y) < POP.DISENGAGE_R) return;
    // THE DAMAGE, AT THE MOMENT IT MATTERS. The per-frame walk records it too,
    // but leaving is the one instant where "how hurt was it" has to be true -
    // relying on another function having run this frame is how a roamer comes
    // back at full health after a fight nobody can prove happened.
    this._rememberRoamer(e);
    this.rememberAway(e);
    e.alive = false;
    e.retired = true;              // NOT a kill: `retired` is what says so
  },

  // Where it went. Chunk-grained on purpose: the map should say "it is over
  // there", not put a cursor on it, because hunting a thing you can already
  // see is not hunting.
  rememberAway(e) {
    if (typeof Progress === 'undefined' || !e.bossId) return;
    const C = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
    Progress.roamerAt = Progress.roamerAt || {};
    Progress.roamerAt[e.bossId] = {
      cx: Math.floor(e.x / C), cy: Math.floor(e.y / C),
      district: (World.district && World.district.id) || null,
      away: true,
    };
    if (typeof Progress.save === 'function') Progress.save();
  },

  // Is it out there, hurt, waiting to be found? What the map asks.
  roamerAway(bossId) {
    const r = (typeof Progress !== 'undefined' && Progress.roamerAt)
      ? Progress.roamerAt[bossId] : null;
    return (r && r.away) ? r : null;
  },

  // AND YOU CAN GO AND FIND IT. Driving into the chunk it withdrew to brings
  // it back - still hurt, because `roamerDamage` was written on the way out.
  // This is the payoff for the whole feature and it is four lines: without it
  // a disengage is a despawn with better manners.
  _checkRoamerFound(player) {
    if (typeof Progress === 'undefined' || !Progress.roamerAt) return null;
    if (!World.district) return null;
    const C = (typeof WORLD !== 'undefined') ? WORLD.CHUNK : 3072;
    const pcx = Math.floor(player.x / C), pcy = Math.floor(player.y / C);
    for (const bid of Object.keys(Progress.roamerAt)) {
      const r = Progress.roamerAt[bid];
      if (!r.away || r.district !== World.district.id) continue;
      if (Math.abs(r.cx - pcx) > 1 || Math.abs(r.cy - pcy) > 1) continue;
      if (this.roamerAlive(bid)) continue;
      const e = this.sendRoamerAt(bid, player);
      if (e) { r.away = false; return e; }
    }
    return null;
  },

  // Called every frame for every live roamer: remember the worst it has been.
  // Written HERE rather than when it disengages, because a roamer that is
  // killed, or that you drive away from, or that unloads with the chunk, has
  // still been hurt - and the record has to survive all three.
  _rememberRoamer(e) {
    if (!e || !e.roamer || !e.bossId || !e.maxHp) return;
    if (typeof Progress === 'undefined') return;
    Progress.roamerDamage = Progress.roamerDamage || {};
    const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
    const was = Progress.roamerDamage[e.bossId];
    if (was === undefined || f < was) Progress.roamerDamage[e.bossId] = f;
  },

  // ---- SOMETHING BUILT A MACHINE AND SENT IT AT YOU -----------------------
  //
  // BLOCK 14. A production pylon's one route into the world, and the only new
  // way for a machine to exist that this block adds. Deliberately narrow: it
  // takes a roster build id and a place, and does exactly what the dispatch
  // path already does - build, own, engage - so a summoned machine is the
  // same kind of thing as every other machine in the game and dies the same
  // way.
  //
  // WORLD-OWNED, not chunk-owned, because a machine summoned into a boss hall
  // must not evaporate when you drive to the other end of the hall.
  spawnBuild(buildId, x, y) {
    if (typeof Enemies === 'undefined' || typeof Enemy === 'undefined') {
      return null;
    }
    const built = Enemies.build(buildId);
    if (!built || !built.loadout || (!built.loadout.length && !built.bossId)) return null;
    const e = new Enemy(x, y, built.loadout, built.aiType, built.coreKey,
      { sockets: built.sockets });
    e.rosterId = built.id;
    Enemies.applyTraits(e, built);
    if (built.bossId) e.bossId = built.bossId;
    this._summonN = (this._summonN || 0) + 1;
    this._adoptWorldOwned(e, 'summon:' + buildId + ':' + this._summonN);
    e.homeX = x; e.homeY = y; e.patrolR = 900;
    e.wState = 'ENGAGE';            // it was made for you and it knows it
    e.summoned = true;
    this._route(e);
    this.machines.push(e);
    this.stats.spawned++;
    return e;
  },

  // The SWEEP's call, once per engagement: everything within earshot of it
  // engages, and the alert hears the shout.
  _callHelp(caller, player) {
    let n = 0;
    for (const m of this.machines) {
      if (!m.alive || m === caller || m.wState === 'ENGAGE') continue;
      if (Math.hypot(m.x - caller.x, m.y - caller.y) > POP.CALL_R) continue;
      m.wState = 'ENGAGE';
      m.wAlertFlash = 0.9;
      m.wLostT = 0;
      n++;
    }
    if (typeof Alert !== 'undefined') Alert.add(POP.CALL_ALERT);
    if (n && typeof Effects !== 'undefined') {
      Effects.comicWord('CONTACT!', caller.x, caller.y - caller.radius - 90, CONFIG.COLOR.red, 44);
    }
    caller._called = (caller._called || 0) + 1;
    return n;
  },

  // The CITE's mark, every frame it can see you.
  _markTarget(marker, player) {
    if (typeof Alert !== 'undefined') Alert.sighted(player.x, player.y);
    for (const m of this.machines) {
      if (!m.alive || m === marker) continue;
      if (m.wState === 'ENGAGE') { m.wLostT = 0; continue; }
      if (Math.hypot(m.x - player.x, m.y - player.y) > POP.MARK_R) continue;
      m.wState = 'ENGAGE';
      m.wAlertFlash = 0.9;
      m.wLostT = 0;
    }
    marker._marking = true;
  },

  // THE JAMMER'S RANK 3: every roamer on the field loses you. The same
  // retirement a roamer takes when it breaks off on its own -- it keeps its
  // damage, remembers where it was -- so nothing is lost and nothing is a
  // second path. Returns how many went.
  disengageRoamers(why) {
    let n = 0;
    for (const m of this.machines) {
      if (!m.roamer || !m.alive || m.retired) continue;
      // Exactly what _maybeDisengage does once a roamer is far enough away:
      // the damage remembered, the place remembered, out of the world.
      this._rememberRoamer(m);
      this.rememberAway(m);
      m.alive = false;
      m.retired = true;              // NOT a kill
      m.leaving = true;
      n++;
    }
    return n;
  },

  // ---- AI IN WORLD SPACE (2.3) -------------------------------------------
  // WRECKJACK's brains assume the player is the target and always engage, which
  // in an open world means every machine in the district beelining at you from
  // two chunks away. This is the layer above that: a machine decides whether it
  // has noticed you at all, and only then does the brain run.
  think(dt, player) {
    const sight = POP.SIGHT + POP.SIGHT_ALERT * (Alert.level / POP.ALERT_MAX);
    let anySees = false;
    let anyEngaged = false;

    for (const e of this.machines) {
      if (!e.alive) continue;
      const d = Math.hypot(player.x - e.x, player.y - e.y);

      // Firing is louder than driving. Nothing else models sound yet, and this
      // one line is most of what "they heard that" needs to feel true.
      let notice = Controls.firing ? Math.max(sight, POP.HEAR_FIRING) : sight;
      // AMBUSH (the LURK). It does not notice you at sight range; it waits
      // until you are nearly on it, then goes -- and goes FAST for two
      // seconds, which is the ambush. A machine already engaged keeps its
      // ordinary senses, or breaking off would be trivially easy.
      const T = e.traits || {};
      if (T.ambush && e.wState !== 'ENGAGE') notice *= POP.AMBUSH_SIGHT;
      const sees = d < notice && this._lineOfSight(e, player);

      if (sees) {
        e.wLostT = 0;
        if (e.wState !== 'ENGAGE') {
          e.wState = 'ENGAGE';
          e.wAlertFlash = 0.9;          // the "!" over its head
          if (T.ambush) e._ambushT = 2.0;
          // CALLS FOR HELP (the SWEEP). The moment it sees you, everything
          // within earshot engages too, and the district hears about it.
          if (T.callsForHelp) this._callHelp(e, player);
        }
        // MARKS THE TARGET (the CITE). While it can see you, nothing in the
        // district that is already on you loses you, and everything within
        // twice sight is told where you are. It is a wall-mounted spotter;
        // the whole point of it is that hiding from it is the job.
        if (T.marksTarget) this._markTarget(e, player);
        anySees = true;
      } else if (e.wState === 'ENGAGE') {
        e.wLostT = (e.wLostT || 0) + dt;
        const home = Math.hypot(e.x - e.homeX, e.y - e.homeY);
        const leash = e.placed ? POP.LEASH_GUARD : POP.LEASH;
        // Give up on time, or on the leash. Outrunning something has to work.
        if (e.wLostT > POP.LOSE_AFTER || home > leash) {
          e.wState = 'RETURN';
          e.wLostT = 0;
        }
      } else if (e.wState === 'RETURN') {
        if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < POP.WAYPOINT_HIT) {
          e.wState = e.placed ? 'GUARD' : 'PATROL';
        }
      }

      e.wAlertFlash = Math.max(0, (e.wAlertFlash || 0) - dt);
      if (e.wState === 'ENGAGE') {
        Alert.add(POP.ALERT_PER_SEEN * dt);
        anyEngaged = true;
      }
      this._unstick(dt, e);
    }

    if (anySees) Alert.sighted(player.x, player.y);

    // ---- ARE YOU IN A FIGHT? ---------------------------------------------
    //
    // `player.inCombat` was READ in two places and SET IN NONE. The Cheetah's
    // sprint says in a comment that it "should not turn every fight into a
    // chase" and then does exactly that, forever, because the flag it checks
    // has never once been true. FUEL CELL wants the same question, so the
    // answer is written here, once.
    //
    // In combat is: something is ENGAGING you, or you were hit recently.
    // ENGAGE is the game's OWN word for a machine that has noticed you and is
    // coming — asked of the machines rather than invented, so the flag and the
    // "!" over their heads can never disagree. Being merely SEEN is not
    // enough: a patrol clocking you across a yard is how this world works, and
    // a speed bonus that dies to it would be a dead pickup again.
    //
    // The hit half is what covers the case ENGAGE cannot: a mine, a hazard, or
    // something shooting from cover it never left.
    //
    // AND IT LINGERS. `anyEngaged` is a per-frame fact, and a machine that
    // retires at the cull radius the frame before its replacement engages
    // makes it false for exactly one frame. Everything that reads the flag
    // is a multiplier -- the CHEETAH's sprint, the move modules -- so that
    // frame doubled the top speed (1,654 -> 3,204 u/s in the Barrens, every
    // eleven seconds, one frame each) and shoved the machine with it. Found
    // by test_milestones' streaming check reading the top speed. A fight is
    // over COMBAT_LINGER seconds after the last machine stops engaging, not
    // the frame it does; the flag cannot flicker, and the bonus arrives as a
    // change of pace rather than a jolt.
    player._engagedT = anyEngaged ? 0
      : (player._engagedT === undefined ? POP.COMBAT_LINGER : player._engagedT + dt);
    const wasInCombat = !!player.inCombat;
    player.inCombat = player._engagedT < POP.COMBAT_LINGER ||
      (player.sinceDamage !== undefined && player.sinceDamage < POP.COMBAT_FOR);
    // A FIGHT CLEARED is an event (D351). FIELD WELDER -- "after a cleared
    // fight, repairs the most damaged module by 20%" -- was written as
    // Mods.onFightCleared and nothing ever said a fight had cleared. This is
    // the one place the flag turns off, so this is where it is said.
    if (wasInCombat && !player.inCombat && typeof Mods !== 'undefined' && Mods.onFightCleared) {
      Mods.onFightCleared(player);
    }
    // HOW FAR OUT OF THE FIGHT YOU ARE, 0..1. The two things that read
    // "out of combat" as a speed -- the CHEETAH's sprint and the move
    // modules -- together nearly double the top speed, and a flag hands that
    // over in one frame, both ways: the first version ramped the pace IN
    // over CALM_RAMP and still dropped it in one frame when a patrol
    // noticed you, which tools/pacecheck.py measured in Chrome as a 48% step
    // -- a brake slammed by the game. It slews both ways now: up over
    // CALM_RAMP, down over the shorter CALM_DROP, so a fight starting still
    // bites first and a fight ending is a change of gear.
    const want = player.inCombat ? 0 : 1;
    const have = player.calmK === undefined ? want : player.calmK;
    const rate = dt / (want > have ? POP.CALM_RAMP : POP.CALM_DROP);
    player.calmK = have + Math.max(-rate, Math.min(rate, want - have));
  },

  // 2.3: "it does not need to be clever - it needs to not get stuck on a crate
  // forever." A machine that has been asked to move and has not moved for a
  // second is against something. Rather than pathfind, it picks a side and
  // slides along the obstacle for a moment. Two attempts, alternating
  // direction, then it gives up and goes home rather than vibrating.
  _unstick(dt, e) {
    const moving = Math.hypot(e.vx, e.vy);
    const wants = e.wState !== 'GUARD';
    if (!wants) { e._stuckT = 0; return; }

    if (moving > 40) {
      e._stuckT = 0;
      e._slideT = Math.max(0, (e._slideT || 0) - dt);
      return;
    }
    e._stuckT = (e._stuckT || 0) + dt;
    if (e._stuckT < 1.0) return;

    // Pinned. Slide perpendicular to whatever it was trying to do.
    e._stuckT = 0;
    e._slides = (e._slides || 0) + 1;
    if (e._slides > 3) {
      // Three tries and it still cannot get there: it cannot reach you. Go
      // home. This is the "find another way or give up" half of 2.3.
      e._slides = 0;
      e.wState = e.placed ? 'GUARD' : 'RETURN';
      return;
    }
    const side = (e._slides % 2) ? 1 : -1;
    const a = Math.atan2(e.aimY, e.aimX) + side * Math.PI / 2;
    e.vx += Math.cos(a) * 260;
    e.vy += Math.sin(a) * 260;
    e._slideT = 0.5;
  },

  // Cheap line of sight: walls and pillars block, nothing else does. Enough
  // that hiding behind a wrecked wall works, which is what makes breaking
  // contact a real answer to alert.
  _lineOfSight(e, player) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const steps = Math.min(12, Math.max(3, Math.floor(d / 260)));
    for (const o of World.obstacles) {
      if (o.type === 'pillar') {
        const t = Math.max(0, Math.min(1,
          ((o.x - e.x) * dx + (o.y - e.y) * dy) / (d * d)));
        const px = e.x + dx * t, py = e.y + dy * t;
        if (Math.hypot(o.x - px, o.y - py) < (o.r || 100)) return false;
      } else {
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const px = e.x + dx * t, py = e.y + dy * t;
          if (px > o.x && px < o.x + (o.w || 0) &&
              py > o.y && py < o.y + (o.h || 0)) return false;
        }
      }
    }
    return true;
  },

  // AN INERT TARGET. It has to answer EVERY property a brain reads off the
  // player, not just x and y: a rusher that reaches its waypoint calls
  // takeCoreDamage on it, and a half-shaped target crashes the frame. The
  // list is exactly what the brains touch — see the grep in
  // tests/test_block2.js, which pins it so a new brain reading a new field
  // fails a test rather than a playthrough.
  _inert(x, y) {
    const t = this._inertObj || (this._inertObj = {
      radius: 0, alive: true, moduleCount: 0,
      vx: 0, vy: 0, aimX: 1, aimY: 0,
      recoilMul: 1, knockbackMul: 1,
      takeCoreDamage() {},
      // The CHARGE's blast asks a target for its sockets and its hit();
      // a waypoint has neither and answers both.
      sockets: null, hit() {},
      passive: true,
    });
    t.x = x; t.y = y;
    return t;
  },

  // What the brain should steer at this frame, and whether it may shoot.
  // Returned rather than set, so Enemy keeps owning its own state.
  brainTarget(e, player) {
    if (e.wState === 'ENGAGE') {
      // AN ESCORTEE IS A TARGET, and it has to be or there is nothing to
      // protect. A machine already coming for you switches to it when it is
      // the NEARER thing - which makes standing between them the whole job,
      // and means the player can always take the pressure off by putting
      // themselves in the way.
      // A DECOY IS A TARGET, and it is the FIRST one asked about — that is the
      // whole gadget. A machine already coming for you goes and shoots the
      // decoy instead, which is what buys the seconds a rip needs. Asked
      // before the escortee because a decoy is a thing you threw ON PURPOSE
      // one second ago, and an escortee is a thing you are walking with.
      if (typeof Decoys !== 'undefined') {
        const dec = Decoys.nearestFor(e);
        if (dec) return dec;
      }
      const esc = (typeof Escorts !== 'undefined') ? Escorts.live : null;
      if (esc && esc.ent && esc.ent.alive) {
        const de = Math.hypot(esc.ent.x - e.x, esc.ent.y - e.y);
        const dp = Math.hypot(player.x - e.x, player.y - e.y);
        if (de < dp) return esc.ent;
      }
      return null;                                  // the real player
    }
    if (e.wState === 'RETURN' || e.wState === 'GUARD') {
      return this._inert(e.homeX, e.homeY);
    }
    if (!e.route || !e.route.length) this._route(e);
    const wp = e.route[e.routeAt % e.route.length];
    if (Math.hypot(e.x - wp.x, e.y - wp.y) < POP.WAYPOINT_HIT) {
      e.routeAt = (e.routeAt + 1) % e.route.length;
    }
    return this._inert(wp.x, wp.y);
  },

  // ---- retirement --------------------------------------------------------
  // The ONE place a live machine leaves the world, and it is DISTANCE that does
  // it, never an unload. A retiring machine frees its post to refill later, so
  // the district stays populated without the count climbing. `retired` is what
  // tells _onKill this was not a kill: retiring a placed machine must never
  // mark it dead.
  cull(player) {
    const keep = [];
    for (const e of this.machines) {
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      if (e.alive && d > POP.CULL_R) {
        e.alive = false;
        e.retired = true;
        this.stats.retired++;
        const s = this.spawners[e.spawner];
        if (s && s.live === e) { s.live = null; s.cooldown = 4; }
        continue;
      }
      if (!e.alive) continue;
      keep.push(e);
    }
    this.machines = keep;
  },

  aliveCount() {
    let n = 0;
    for (const e of this.machines) if (e.alive) n++;
    return n;
  },
  patrolCount() {
    let n = 0;
    for (const e of this.machines) if (e.alive && !e.placed) n++;
    return n;
  },
  eliteCount() {
    let n = 0;
    for (const e of this.machines) if (e.alive && e.isElite) n++;
    return n;
  },
};

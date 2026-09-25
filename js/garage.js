// SCRAPCORE: BREAKLANDS — GARAGES, BANKING, DEATH AND SALVAGE VALUE (Block 3)
//
// This is the loop the whole game is built around:
//
//   drive out -> fight -> steal parts -> get to a garage -> keep what you carried
//
// A part you bolt on out in the world WORKS IMMEDIATELY and is NOT YOURS until
// you reach a garage. That single sentence is the game. Everything in this file
// exists to make it true and to make it FELT:
//
//   * the HUD carries an unbanked number at all times, because without it there
//     is no decision, only a surprise when you die;
//   * a garage banks everything and clears the district's alert, so arriving is
//     a release rather than a menu;
//   * death costs you the unbanked and leaves it in a wreck you can go and get,
//     so losing hurts without ruining you;
//   * dying again before you recover it and it is gone, so the recovery run is
//     a real decision and not a formality.
//
// The Rack already had `pending` — parts recovered but not banked — from
// WRECKJACK's screen-crossing rule. Block 3 keeps that shape and changes what
// banks it: a garage rather than a screen boundary.

const GARAGE = {
  // A GARAGE IS A BUILDING NOW, so these are distances to its DOOR, not to a
  // circle drawn on empty ground. DOOR_R is generous - you are aiming a
  // machine at an opening, not parking it - but it is small enough that you
  // have to actually be at the front of the shed.
  ENTER_R: 320,           // kept: the map and the compass still ask for it
  DOOR_R: 260,            // how close to the DOOR before you are inside
  CLAIM_R: 420,           // and to be told you could claim it
  WRECK_R: 260,           // and to recover your own wreck

  // What a stolen part is worth, out of what already exists in PARTS. There is
  // no `value` field and there should not be one: a part's worth is what it
  // costs you to run it, so Load and Power ARE the value, and the Grade
  // multiplies it. One formula, one place, so an economy pass is one edit.
  SCRAP_BASE: 6,
  SCRAP_PER_LOAD: 3,
  SCRAP_PER_POWER: 4,

  // Kills pay. Stripping a part off a living machine pays more than killing it
  // for one, because that is the verb the game is about.
  // A kill's floor, and what the machine ON TOP of it is worth.
  //
  // THE PER-WEIGHT RATE WAS PULLED 2.5 -> 1.6 AT D367, and this is question 11
  // answered. It is the drop rate: what a machine drops for being killed, per
  // point of Load+Power standing on it. The floor is untouched.
  //
  // WHY. These were tuned against CONTENT_ECONOMY Part 2 when a kill took
  // 3.7-5.8 seconds. D355 gave the permanent gun the aim stick and a kill fell
  // to 1.2-1.7 seconds, so the SAME payout per kill became four times the
  // payout per minute and nobody re-ran the sim for eleven days. The opening
  // was running at 95.4 scrap/min against a 50-80 band. At 1.6 it runs at
  // 73.1 — inside the band, and on the 73 that MACHINE_RESTORE_LADDER and the
  // stash and vault values were all sized against, so nothing downstream moves.
  //
  // The bands in Part 2 moved with it and the document says so: small still
  // lands 8-15, medium 15-24 against a written 20-35, large 34-53 against a
  // written 50-80. Part 9's rule is "never by changing what things cost" and
  // nothing here is a cost; the alternative levers (garage distance, the carry
  // limit, upgrade prices) were all ruled out or are still open questions.
  // See content/econ_sim.js, which reads these.
  SCRAP_KILL: 5,
  SCRAP_KILL_PER_WEIGHT: 1.6,
  SCRAP_ELITE_MUL: 3.2,
  SCRAP_KILL_PLACED: 40,
  SCRAP_KILL_BOSS: 900,

  // XP, straight off CONTENT_ECONOMY Part 4's earning table. Balance is data
  // (rule 7), and these are the numbers the document already chose.
  XP_SMALL: 12,
  XP_MEDIUM: 30,
  XP_LARGE: 70,
  XP_ELITE: 300,
  XP_ELITE_FIRST: 900,
  XP_PLACED: 120,
  XP_BOSS: 3000,
  // "Mission step — 400 to 1,200 XP." The band, spread across the three steps
  // of a chain, because a chain's third job is its hardest. ONE mission of
  // twenty-seven writes an `xp` key, so without this the other twenty-six pay
  // the number the document gives them and the player receives nothing.
  XP_MISSION_STEP: [400, 700, 1200],
  XP_DISTRICT: 1500,          // first entry
  XP_BARRIER_KIND: 600,       // first time a barrier TYPE is opened
  XP_GARAGE: 2000,            // claiming one
  // The weight bands killScrap's 5 + 2.5w already implies.
  XP_W_MEDIUM: 6,
  XP_W_LARGE: 18,
  SCRAP_STRIP: 3,
};

const Salvage = {
  // The scrap a part is worth at a Grade.
  valueOf(partId, gradeId) {
    const p = PARTS[partId];
    if (!p) return 0;
    const g = (typeof GRADES !== 'undefined' && GRADES[gradeId]) || null;
    const base = GARAGE.SCRAP_BASE +
      (p.loadCost || 0) * GARAGE.SCRAP_PER_LOAD +
      (p.powerCost || 0) * GARAGE.SCRAP_PER_POWER;
    return Math.round(base * (g ? g.output : 1));
  },

  // WHAT A KILL PAYS.
  //
  // CONTENT_ECONOMY part 2 bands kills by SIZE — 8-15 for a small patrol
  // machine, 20-35 medium, 50-80 large, 150-250 for an elite — and every kill
  // in the game paid a flat 5, elites 18. The bands were not a tuning target
  // that had been missed; the size term did not exist.
  //
  // Measured the same way a PART is measured, because Load and Power are
  // already this game's statement of what a thing is worth and a second scale
  // would eventually disagree with the first. A machine's kill value is its
  // build, at the same per-Load and per-Power rates, plus the base.
  //
  // AND A MACHINE YOU STRIPPED FIRST PAYS LESS, because the weight is counted
  // off the sockets it still had. That is not a rule anybody wrote: it falls
  // out of measuring what was there, and it is the right answer — you already
  // took the value off it, and the game is about taking things off machines.
  killScrap(d) {
    const w = (d && d.weight) || 0;
    if (d && d.boss) return GARAGE.SCRAP_KILL_BOSS + w * GARAGE.SCRAP_PER_LOAD;
    let n = GARAGE.SCRAP_KILL + Math.round(w * GARAGE.SCRAP_KILL_PER_WEIGHT);
    if (d && d.elite) n = Math.round(n * GARAGE.SCRAP_ELITE_MUL);
    if (d && d.placed) n += GARAGE.SCRAP_KILL_PLACED;
    return n;
  },

  // AND WHAT THE SAME KILL IS WORTH IN XP.
  //
  // CONTENT_ECONOMY Part 4 lists nine XP sources. ONE OF THEM WAS WIRED —
  // `reward.xp` on a mission — and exactly one mission of twenty-seven writes
  // that key. So the only XP in the game was 800, a player who did everything
  // reached LEVEL 4, and the forty-level tree with its 48 points and four
  // branches had four of them to spend. Block 9 was 96% unreachable and every
  // suite covering it was green, because a skill tree that is never opened is
  // a skill tree with no bugs.
  //
  // Written here, beside `killScrap`, because it is the same question about
  // the same machine and two functions in two files would eventually disagree
  // about what a large one is. The weight bands are the ones killScrap already
  // implies: 5 + 2.5w lands 8-15 scrap below w=6 and 50-80 above w=18, which
  // is the doc's own small / medium / large split.
  killXp(d) {
    if (!d) return 0;
    if (d.boss) return GARAGE.XP_BOSS;
    if (d.elite) {
      return this._firstOf('elite') ? GARAGE.XP_ELITE_FIRST : GARAGE.XP_ELITE;
    }
    if (d.placed) return GARAGE.XP_PLACED;
    const w = d.weight || 0;
    if (w >= GARAGE.XP_W_LARGE) return GARAGE.XP_LARGE;
    if (w >= GARAGE.XP_W_MEDIUM) return GARAGE.XP_MEDIUM;
    return GARAGE.XP_SMALL;
  },

  // "Elite kill 300 (FIRST KILL 900)". One-way, in the save, like every other
  // first in this game — a first time you can have twice is not a first time.
  _firstOf(what) {
    if (typeof Progress === 'undefined') return false;
    Progress.xpFirsts = Progress.xpFirsts || {};
    if (Progress.xpFirsts[what]) return false;
    Progress.xpFirsts[what] = true;
    return true;
  },

  // THE NUMBER ON THE HUD. Everything recovered and not yet banked.
  //
  // Read off Rack.pending, which is already the list of things you are carrying
  // and have not kept — so there is one source of truth for "unbanked" and the
  // HUD cannot drift from what banking actually banks.
  unbankedValue() {
    let v = 0;
    for (const p of Rack.pending) v += this.valueOf(p.partId, p.gradeId);
    return v;
  },
  unbankedCount() { return Rack.pending.length; },
};

// ---------------------------------------------------------------------------
const Garages = {
  district: null,
  list: [],               // live garages for the district, world coords
  nearest: null,          // {g, d} recomputed each frame for the HUD
  inside: null,           // the garage the player is standing in, or null
  _wasInside: null,

  // Set by the tow system in Block 6. Fast travel is blocked while towing:
  // arriving somewhere without the thing you were dragging is exactly the kind
  // of quiet loss this block exists to prevent.
  towing: false,

  enter(district) {
    this.district = district;
    this.list = (district.garages || []).map(g => Object.assign({}, g, {
      x: g.cx * WORLD.CHUNK + g.x,
      y: g.cy * WORLD.CHUNK + g.y,
    }));
    this.nearest = null;
    this.inside = null;
    this._wasInside = null;
  },

  // ---- ownership, persisted ---------------------------------------------
  owned(id) {
    return !!(typeof Progress !== 'undefined' && Progress.garages &&
      Progress.garages[id]);
  },
  ownedCount() {
    return (typeof Progress !== 'undefined' && Progress.garages)
      ? Object.keys(Progress.garages).length : 0;
  },
  ownedList() { return this.list.filter(g => this.owned(g.id)); },

  // ---- THE NETWORK ------------------------------------------------------
  // `list` is rebuilt on every district entry and holds only THIS district's
  // garages, so `ownedList` could only ever offer a ride to somewhere you were
  // already standing. Fast travel that cannot leave the district is a shortcut
  // across a field.
  //
  // `Progress.garages` has recorded ownership across the whole world since
  // Block 3, and every district's spec carries its garages, so the network was
  // always there to be read — it just had nobody asking. This walks the
  // districts rather than the live list, and tags each stop with where it is.
  //
  // "THE FREIGHT NETWORK": the lore's automated industrial line is what these
  // yards are ON, and it is why a garage you have claimed is a place you can
  // get back to from anywhere. It also means fast travel needs no new object
  // in the world — the network IS the set of garages you own.
  networkList() {
    const out = [];
    if (typeof DISTRICTS === 'undefined') return this.ownedList();
    for (const did of Object.keys(DISTRICTS)) {
      const d = DISTRICTS[did];
      for (const g of (d.garages || [])) {
        if (!this.owned(g.id)) continue;
        // WORLD COORDINATES, converted the same way `enter` converts them.
        // A district spec stores a garage as a chunk plus an offset inside it,
        // and reading those raw would have sent a fast traveller to a point a
        // few hundred units from the top-left corner of the world.
        out.push(Object.assign({}, g, {
          x: g.cx * WORLD.CHUNK + g.x,
          y: g.cy * WORLD.CHUNK + g.y,
          district: did,
          away: !(typeof World !== 'undefined' && World.district &&
                  World.district.id === did),
        }));
      }
    }
    return out;
  },

  // WHERE THE DOOR IS. One function, so the building that draws the opening
  // and the check that decides you walked through it read the same number.
  // South face, because that is the side the camera looks at: you drive in
  // through the front rather than clipping the back.
  doorOf(g) {
    const d = (typeof GARAGE_B !== 'undefined') ? GARAGE_B.D / 2 : 310;
    return { x: g.x, y: g.y + d };
  },

  // EARNED, NEVER WALKED INTO. A garage names the placed machine holding it;
  // until that machine is dead the door does not open. "Fight for it, find it,
  // or complete something" — this is the first of those, and the other two hang
  // off the same `claimable` hook when Block 8 has missions to hang there.
  claimable(g) {
    if (this.owned(g.id)) return false;
    if (!g.guard) return true;                     // found, not fought for
    return World.wasKilled(g.guard);
  },
  blockedBy(g) {
    return (!this.owned(g.id) && g.guard && !World.wasKilled(g.guard))
      ? g.guard : null;
  },
  // The guard's NAME, off the district's own placed rows: the guard id is a
  // placed machine's permanent id, its build is the row's fourth field, and
  // the build's name is what the player has been shooting at.
  guardName(g) {
    const guard = this.blockedBy(g);
    if (!guard) return 'THE GUARD';
    const d = (typeof World !== 'undefined') ? World.district : null;
    return DistrictGen.placedBuildName(d, guard);
  },

  claim(g) {
    if (!this.claimable(g)) return false;
    Progress.garages = Progress.garages || {};
    Progress.garages[g.id] = true;
    // "Claiming a garage — 2,000 XP." The biggest single award in the earning
    // table, because it is the biggest single thing a player does. Inside the
    // ownership write, so it can only ever happen once per garage.
    if (typeof Levels !== 'undefined' && Levels.addXp) {
      Levels.addXp(GARAGE.XP_GARAGE);
    }
    if (typeof Radio !== 'undefined') Radio.fire('first_garage_claimed');
    // 3.6: grade access comes from garages owned. This is the caller
    // HANDOVER.md said Rack.setAccess had lost.
    this.applyGradeAccess();
    return true;
  },

  // Grade access by garages owned. Owning the district's workshops is what
  // lets you keep better hardware, which ties the loot ceiling to the thing
  // the player actually does rather than to a map counter that no longer
  // exists.
  applyGradeAccess() {
    if (typeof Rack === 'undefined') return;
    const n = this.ownedCount();
    const g = n >= 6 ? 'G5' : n >= 4 ? 'G4' : n >= 2 ? 'G3' : n >= 1 ? 'G2' : 'G1';
    Rack.setAccess(g);
  },

  // ---- the per-frame job -------------------------------------------------
  update(dt, player, state) {
    if (!this.list.length || !player) return;

    // NEAREST is measured to the BUILDING, because that is the thing you
    // drive toward and the thing the compass and the map point at.
    let best = null, bestD = Infinity;
    for (const g of this.list) {
      const d = Math.hypot(player.x - g.x, player.y - g.y);
      if (d < bestD) { bestD = d; best = g; }
    }
    this.nearest = best ? { g: best, d: bestD } : null;

    // BUT YOU ENTER THROUGH THE DOOR. Measured to the doorway, not to the
    // centre of the shed — the shed is solid, so its centre is somewhere you
    // physically cannot be, and a radius around it would let you bank by
    // scraping along the back wall. The door is on the south face; `doorOf`
    // is the one place that knows where, so the building and the trigger can
    // never disagree about it.
    const door = best ? this.doorOf(best) : null;
    const dd = door ? Math.hypot(player.x - door.x, player.y - door.y) : Infinity;
    const at = (best && dd < GARAGE.DOOR_R) ? best : null;
    this.inside = at;
    this.doorDist = dd;

    // ARRIVING is the event, not standing there. Everything below fires once
    // on the frame you cross the threshold.
    if (at && at !== this._wasInside) this._onArrive(at, player, state);
    if (!at) this._wasInside = null;
  },

  _onArrive(g, player, state) {
    this._wasInside = g;
    const first = !this.owned(g.id);

    if (first) {
      if (!this.claimable(g)) {
        // NAME THE MACHINE (D351). This said KILL THE WARDEN, and BREAKLANDS
        // has no Wardens: a garage is held by a PLACED machine with a name,
        // and `blockedBy` was written to say which and never asked.
        this.message = 'HELD — KILL THE ' + this.guardName(g);
        this.messageT = 3;
        this._wasInside = null;      // not entered; try again after the fight
        return;
      }
      this.claim(g);
      this.message = g.name + ' CLAIMED';
      this.messageT = 4;
    }

    // BLOCK 6.3. Anything you dragged in gets stripped BEFORE the bank, so
    // the same arrival that banks your carry also banks the tow. Stripping
    // after it left the parts sitting in the carry until the NEXT garage
    // visit, which is a silent loss of exactly the kind Block 3 exists to
    // prevent. Parts to the Rack,
    // scrap to the Forge. This is the payoff for the drive, and it is why
    // towing pays more than field looting — the hulk is carrying the parts
    // the explosion would otherwise have taken.
    //
    // A RIG CHASSIS is recognised and NOT stripped: Block 7 restores it into
    // a vehicle you own, and silently melting one down for scrap would
    // destroy the best thing in the game to find.
    if (typeof Tow !== 'undefined' && Tow.hooked) {
      const h = Tow.hooked;
      // A MACHINE WRECK (Q4) is parked the same way a chassis is, and never
      // stripped: it is the second-best thing in the game to find.
      if (Tow.isMachineWreck && Tow.isMachineWreck(h)) {
        Tow.unhook();
        const parkedM = (typeof MachineWrecks !== 'undefined') ? MachineWrecks.park(h, g) : null;
        this.message = parkedM ? h.label + ' PARKED — RESTORE IT HERE'
                               : 'YOU HAVE ONE OF THESE — ' + h.label + ' LEFT OUTSIDE';
        this.messageT = 4;
      } else if (Tow.isChassis(h)) {
        Tow.unhook();
        const parked = (typeof Chassis !== 'undefined') ? Chassis.park(h, g) : null;
        // Said AFTER the park, because the park can refuse: a chassis of a
        // rig you already own stays on the ground, and the message that
        // used to be written first would have promised a restore that was
        // never going to be offered.
        this.message = parked ? h.label + ' PARKED — RESTORE IT HERE'
                              : 'YOU HAVE ONE OF THESE — ' + h.label + ' LEFT OUTSIDE';
        this.messageT = 4;
      } else {
        const got = Tow.strip(h);
        if (got) {
          this.message = 'STRIPPED — ' + got.parts + ' PARTS, ' +
            got.scrap + ' SCRAP';
          this.messageT = 4;
        }
      }
    }

    const banked = this.bank();
    if (banked.count) {
      this.message = 'BANKED ' + banked.count + ' PART' +
        (banked.count > 1 ? 'S' : '') + '  ' + '—' + '  ' + banked.scrap + ' SCRAP';
      this.messageT = 4;
    }

    // AND ANYTHING A MISSION ASKED YOU TO BRING HERE. Nine missions write a
    // `deliver` record and nothing had ever read one: seven of them say "back
    // to me", which the turn-in conversation already enforces by standing the
    // NPC where the reward is paid, and two say a GARAGE. This is the line
    // that makes the second kind true, and it is here rather than in
    // MissionRun because arriving is a thing that happens to a garage.
    if (typeof Missions !== 'undefined' && Missions.deliverHere) {
      Missions.deliverHere(g.id);
    }

    // Claiming or entering clears the district (2.4). A garage is safety.
    if (typeof Alert !== 'undefined') Alert.clearAtGarage();


    // 3.5: save on garage entry.
    if (typeof Progress !== 'undefined') Progress.save();
  },

  // ---- 3.2 BANKING -------------------------------------------------------
  // Everything carried becomes permanently yours. `Rack.bankPending` already
  // does the Rack half; this adds the scrap and reports what happened, because
  // banking silently is the same as not banking at all.
  bank() {
    const value = Salvage.unbankedValue();
    const list = Rack.pending.slice();
    const kept = Rack.bankPending();
    // Anything that did not improve the Rack converts to scrap rather than
    // vanishing - the same §15 rule the Recovery Cache used.
    let scrap = 0;
    for (const p of list) {
      scrap += kept.some(k => k.partId === p.partId && k.gradeId === p.gradeId)
        ? 0 : Salvage.valueOf(p.partId, p.gradeId);
    }
    if (typeof Forge !== 'undefined' && scrap > 0) Forge.bank(scrap);
    // "Banked. That's yours now, whatever happens next."
    if (typeof Radio !== 'undefined') Radio.fire('first_bank');
    // LESSONS 4 AND 5 ARRIVE TOGETHER, which is why the build screen opens
    // once here: carried is not owned, and the thing you are carrying it on
    // is something you built.
    if (typeof Opening !== 'undefined') Opening.learn('bank');
    return { count: list.length, kept: kept.length, scrap: scrap, value };
  },

  // ---- 3.4 FAST TRAVEL ---------------------------------------------------
  canFastTravel(g) {
    if (!g || !this.owned(g.id)) return false;
    // BLOCK 6.1: NO EXCEPTIONS. Towing always pays the real distance, which
    // is the entire reason the tow trip is worth designing. Asked of Tow
    // directly as well as the flag, so nothing can leave the flag stale and
    // hand the player a free ride home with a chassis on the line.
    if (this.towing) return false;
    if (typeof Tow !== 'undefined' && Tow.towing()) return false;
    return true;
  },
  fastTravelReason(g) {
    if (!g) return 'NO DESTINATION';
    if (!this.owned(g.id)) return 'NOT YOURS YET';
    // Asked of Tow as well as the flag, exactly as canFastTravel does — the
    // reason the player is shown and the rule that stops them must come from
    // the same two questions or one of them will eventually lie.
    if (this.towing || (typeof Tow !== 'undefined' && Tow.towing())) {
      return 'CANNOT FAST TRAVEL WHILE TOWING';
    }
    return null;
  },
  // Returns 'here' or 'away', so the caller knows whether it has to change
  // districts — and returns FALSE, as before, when it refuses. Three answers,
  // because "it worked and you are somewhere else" is genuinely different from
  // "it worked".
  fastTravelTo(g, player) {
    if (!this.canFastTravel(g)) return false;
    if (g.district && typeof World !== 'undefined' && World.district &&
        g.district !== World.district.id) {
      // The caller owns district entry; this only says where to arrive.
      return { away: true, district: g.district, x: g.x, y: g.y };
    }
    player.x = g.x;
    player.y = g.y;
    player.vx = 0; player.vy = 0;
    if (typeof Camera !== 'undefined') Camera.snapTo(g.x, g.y);
    this._wasInside = null;             // arriving still counts as arriving
    return { away: false, district: g.district || null, x: g.x, y: g.y };
  },

  // Where death sends you. Your last garage, or the district spawn if you have
  // not earned one yet - a player must never wake somewhere they cannot leave.
  respawnPoint() {
    const owned = this.ownedList();
    if (!owned.length) return World.spawnPoint();
    let best = owned[0], bestD = Infinity;
    const last = (typeof Progress !== 'undefined' && Progress.lastGarage) || null;
    for (const g of owned) if (g.id === last) return { x: g.x, y: g.y };
    return { x: best.x, y: best.y };
  },

  tick(dt) { this.messageT = Math.max(0, (this.messageT || 0) - dt); },
};

// ---------------------------------------------------------------------------
// 3.3 THE WRECK.
//
// Die and the unbanked gear stays where you fell. Go and get it. Die again
// before you do and it is gone — which is what stops the recovery run being a
// formality and makes the second drive out a decision of its own.
//
// ONE wreck at a time, deliberately. A field of wrecks would turn a bad night
// into a chore list, and the design wants the loss to sting once rather than
// accumulate.
const Wrecks = {
  current: null,          // { x, y, district, parts: [{partId, gradeId}], scrap }

  reset() { this.current = null; },

  // Called on death, with what was being carried.
  drop(x, y, districtId, parts, scrap) {
    // Dying with a wreck already out loses the old one. Stated here rather
    // than left implicit, because it is the rule that gives the recovery run
    // its urgency.
    // BLACK BOX: the marker survives one extra death instead of being
    // replaced. Counted on the wreck itself, which is where SAVE_FORMAT asks
    // for it: "how many deaths it has survived".
    if (this.current && typeof Skills !== 'undefined') {
      const extra = Skills.sum('wreckExtraDeath');
      const s = (this.current.survived || 0);
      if (s < extra) {
        this.current.survived = s + 1;
        this._persist();
        return this.current;           // the OLD wreck stands; this one does not
      }
    }
    this.current = {
      x, y, district: districtId,
      parts: parts.map(p => ({ partId: p.partId, gradeId: p.gradeId })),
      scrap: scrap || 0,
      survived: 0,
      // STRONGBOX: nothing in the world can destroy the marker.
      indestructible: (typeof Skills !== 'undefined') &&
                      Skills.has('wreckIndestructible'),
      // FLIGHT RECORDER: it shows on the map from any district.
      mapAnywhere: (typeof Skills !== 'undefined') &&
                   Skills.has('wreckMapAnywhere'),
    };
    this._persist();
    return this.current;
  },

  // ONLY TWO THINGS CLEAR A WRECK: recovering it, or dying again.
  //
  // Reaching a garage deliberately does NOT. The first draft cleared it on
  // arrival, on the reasoning that banking retires the debt — and since you
  // WAKE at a garage after dying, that cleared the wreck one frame after it
  // was made and the recovery run could never happen at all. The whole point
  // of 3.3 deleted itself, silently, in the name of tidiness.
  //
  // The spec says what takes it: die again before you get there. Nothing else.

  // Drive over it and it is yours again — straight back into the unbanked
  // carry, because recovering it is not the same as banking it.
  tryRecover(player, districtId) {
    const w = this.current;
    if (!w || w.district !== districtId) return null;
    if (Math.hypot(player.x - w.x, player.y - w.y) > GARAGE.WRECK_R) return null;
    for (const p of w.parts) Rack.offer(p.partId, p.gradeId);
    if (typeof Forge !== 'undefined' && w.scrap) Forge.bank(w.scrap);
    this.current = null;
    this._persist();
    return w;
  },

  _persist() {
    if (typeof Progress === 'undefined') return;
    Progress.wreck = this.current
      ? JSON.parse(JSON.stringify(this.current)) : null;
    Progress.save();
  },

  restore() {
    this.current = (typeof Progress !== 'undefined' && Progress.wreck)
      ? JSON.parse(JSON.stringify(Progress.wreck)) : null;
  },
};

// ---------------------------------------------------------------------------
// FIELD WORKSHOP — "limited garage functions out in the world."
//
//   R1  swap between saved loadout presets anywhere
//   R2  fit stolen parts you are carrying but have not banked
//
// And QUICK DOCK, "+50% / +100% speed", which is what makes those two a
// decision rather than a free button: field work TAKES TIME AND HOLDS YOU
// STILL. In the garage it is instant, because the garage is safe and a wait
// there is only a wait. Out here the clock is the whole cost — you are
// stationary, unarmed and visible for three and a half seconds, and QUICK
// DOCK is what buys that down.
//
// This is also the only reader `dockMul` could honestly have: docking at a
// garage screen is a menu press, and making a menu press slower to sell a
// skill that makes it faster again would be a toll, not a trade.
// ---------------------------------------------------------------------------
const FIELD_B = { SWAP: 3.5, DOCK: 2.5, FIT: 2.0 };

const FieldWork = {
  // The one place the duration is decided, so the HUD's countdown and the
  // timer that actually blocks you can never disagree.
  seconds(base) {
    const k = (typeof Skills !== 'undefined') ? Skills.mul('dockMul') : 1;
    return base / (k || 1);
  },

  canPresets() {
    return typeof Skills !== 'undefined' && Skills.has('fieldPresets');
  },
  canFitCarried() {
    return typeof Skills !== 'undefined' && Skills.has('fieldFitCarried');
  },

  // WHY NOT, in GarageCalc.refusal's shape. Same reason: the prompt and the
  // system must never disagree about which wall you hit.
  refusal(player, what) {
    if (!player || !player.alive) return 'NOT NOW';
    if (what === 'preset' && !this.canPresets()) return 'NO FIELD WORKSHOP';
    if (what === 'fit' && !this.canFitCarried()) return 'NO FIELD WORKSHOP';
    if (player.inCombat) return 'IN COMBAT';
    if (this.running(player)) return 'ALREADY WORKING';
    if (typeof Tow !== 'undefined' && Tow.towing && Tow.towing()) return 'TOWING';
    if (what === 'preset' && !(Progress.presets || []).length) return 'NO PRESETS';
    if (what === 'fit' && !(typeof Rack !== 'undefined' &&
        (Rack.pending || []).length)) return 'NOTHING CARRIED';
    return null;
  },

  running(player) { return !!player && (player._fieldT || 0) > 0; },
  left(player) { return player ? Math.max(0, player._fieldT || 0) : 0; },

  begin(player, what) {
    if (this.refusal(player, what)) return false;
    const base = what === 'fit' ? FIELD_B.FIT
      : (what === 'dock' ? FIELD_B.DOCK : FIELD_B.SWAP);
    player._fieldT = this.seconds(base);
    player._fieldWhat = what;
    return true;
  },

  cancel(player) {
    if (!player) return;
    player._fieldT = 0;
    player._fieldWhat = null;
  },

  // TAKING A HIT CANCELS IT. Standing still to change your build in the open
  // has to be interruptible or it is not a risk, it is a ritual.
  update(dt, player) {
    if (!this.running(player)) return;
    if (!player.alive || player.inCombat) { this.cancel(player); return; }
    player._fieldT -= dt;
    if (player._fieldT > 0) return;
    const what = player._fieldWhat;
    this.cancel(player);
    this._finish(player, what);
  },

  _finish(player, what) {
    if (what === 'preset') {
      const list = Progress.presets || [];
      if (!list.length) return;
      Progress.fieldPresetIdx = ((Progress.fieldPresetIdx || 0) + 1) % list.length;
      const r = Presets.load(player, list[Progress.fieldPresetIdx]);
      if (typeof Alert !== 'undefined' && typeof Effects !== 'undefined') {
        Effects.comicWord(list[Progress.fieldPresetIdx].name,
          player.x, player.y - 200, CONFIG.COLOR.cyan, 56);
      }
      return r;
    }
    if (what === 'fit') {
      // "Fit stolen parts you're carrying but haven't banked." The haul, not
      // the Rack — banking is still the only way to KEEP anything, and this
      // does not touch that. It only lets you use it before you get home.
      const carried = (typeof Rack !== 'undefined' && Rack.pending)
        ? Rack.pending.slice() : [];
      let n = 0;
      for (const p of carried) {
        const free = player.sockets.find(k => !k.comp && !k.permanent);
        if (!free) break;
        if (Machine.attach(player, p.partId || p.id, free.id) !== -1) n++;
      }
      if (n) {
        Machine.recalcPower(player);
        Machine.recalcStats(player);
        if (typeof Effects !== 'undefined') {
          Effects.comicWord('FITTED ' + n, player.x, player.y - 200,
            CONFIG.COLOR.lime, 56);
        }
      }
      return n;
    }
    return null;
  },
};

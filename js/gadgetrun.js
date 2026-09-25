// SCRAPCORE: BREAKLANDS — BLOCK 11: FIRING A GADGET
//
// ---------------------------------------------------------------------------
// WHAT WAS ALREADY HERE, AND WHAT WAS NOT
//
// `Progress.gadgets[id]` — the RANK you own — has existed since Block 8 and is
// what every barrier gate and every mission gear requirement reads. `Gadgets`
// (in skills.js) added the other half of OWNERSHIP: slots, fitting, refusals,
// a power draw off the same budget the modules spend from, and a save field.
//
// **Nothing fired one.** You could find a DECOY, fit it, pay power for it, and
// there was no button and no effect. That is the last thing standing between
// Block 11 and done, and it is the half the player actually touches.
//
// ---------------------------------------------------------------------------
// THE SHAPE
//
// A gadget is a HELD THING WITH A COOLDOWN, not a passive. That is what makes
// a slot a decision rather than a stat: two slots and four gadgets means
// choosing which two problems you are equipped for today, and a passive would
// make that choice invisible.
//
// Three of the five active gadgets have a system already waiting for them,
// which is why they are the three that are wired:
//
//   JAMMER      Alert.suppressed / .suppressing have existed and been read by
//               Alert.update since Block 2, set by nobody
//   SCANNER     LooseParts._glint already draws a pip over salvage in range;
//               it asked Skills and nothing else
//   REPAIR UNIT PlayerCore._updateRegen already trickles out of combat
//
// The other two — DECOY and SALVAGE BEACON — want a world entity, and they are
// REPORTED by `GadgetRun.unwired()` rather than half-built. A gadget you can
// fit, that costs power, and that does nothing when you press the button is
// the exact failure this project has spent three runs finding.
'use strict';

const GADGET_RUN_B = {
  // How far the SALVAGE BEACON reaches. Generously more than the tow hook's
  // grab radius, because the point of it is not having to drive to each one.
  BEACON_R: 2600,
  // A gadget you can spam is a gadget the fight is about. The data carries
  // `cd` where it matters; this is the floor for one that does not.
  MIN_CD: 8,
};

const GadgetRun = {
  // ---- WHAT IS RUNNING ---------------------------------------------------
  // On the PLAYER, not here. A timer in a module is a second record of a fact
  // the entity owns, and this project has been bitten by that twice.
  _st(player) {
    if (!player) return {};
    player._gadgets = player._gadgets || {};
    return player._gadgets;
  },

  cooldown(player, id) { return Math.max(0, (this._st(player)[id] || 0)); },
  running(player, id) {
    const s = this._st(player);
    return (s['_on_' + id] || 0) > 0;
  },

  // The rank's data for a gadget you own, or null. Asked of Progress, which is
  // the record every gate already reads, so a gadget cannot be at one rank for
  // a barrier and another for its own effect.
  rankOf(id) {
    if (typeof Progress === 'undefined' || typeof GADGETS === 'undefined') return null;
    const n = Progress.gadgets[id] || 0;
    if (!n || !GADGETS[id]) return null;
    // CUMULATIVE. A gadget's ranks are written as what each rank ADDS --
    // the jammer's rank 2 is `{ alertDrain: true }` and nothing else -- so
    // the entry for the rank you hold is folded over the ones below it.
    // Read as the bare entry, a rank-2 jammer had no `secs` and no `cd`:
    // it started, never timed out, and the alert was frozen for the rest
    // of the session. (Skills restate every rank; gadgets do not, and the
    // reader has to know which it is reading.)
    const ranks = GADGETS[id].ranks;
    const out = {};
    for (let i = 0; i < Math.min(n, ranks.length); i++) Object.assign(out, ranks[i] || {});
    return out;
  },

  // ---- WHY NOT ------------------------------------------------------------
  // GarageCalc.refusal's shape again: the prompt and the rule come from one
  // place, so they cannot say different things.
  refusal(player, id) {
    if (typeof Gadgets === 'undefined') return 'NO GADGETS';
    if (!Gadgets.isFitted(id)) return 'NOT FITTED';
    if (!this.rankOf(id)) return 'NOT FOUND YET';
    if (this.cooldown(player, id) > 0) {
      return Math.ceil(this.cooldown(player, id)) + 's';
    }
    if (this.running(player, id)) return 'ALREADY RUNNING';
    if (!this.FX[id]) return 'NOTHING BEHIND IT YET';
    return null;
  },

  // ---- USING ONE ----------------------------------------------------------
  use(player, id) {
    if (this.refusal(player, id)) return false;
    const r = this.rankOf(id);
    const st = this._st(player);
    const fx = this.FX[id];
    st[id] = r.cd || GADGET_RUN_B.MIN_CD;
    if (r.secs) st['_on_' + id] = r.secs;
    fx.start(player, r);
    if (typeof Effects !== 'undefined') {
      Effects.comicWord((GADGETS[id].name || id), player.x, player.y - 200,
        CONFIG.COLOR.cyan, 52);
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    return true;
  },

  // The slot a button press means. Fitted order IS the slot order, because a
  // second table of "which gadget is in slot 1" would drift from the list the
  // garage screen shows.
  inSlot(n) {
    if (typeof Gadgets === 'undefined') return null;
    return Gadgets.fitted()[n] || null;
  },
  useSlot(player, n) {
    const id = this.inSlot(n);
    return id ? this.use(player, id) : false;
  },

  // ---- PER FRAME ----------------------------------------------------------
  update(dt, player) {
    if (!player) return;
    const st = this._st(player);
    for (const k of Object.keys(st)) {
      if (k.indexOf('_on_') === 0) {
        const id = k.slice(4);
        st[k] = Math.max(0, st[k] - dt);
        if (st[k] <= 0 && this.FX[id] && this.FX[id].stop) {
          this.FX[id].stop(player);
        }
      } else {
        st[k] = Math.max(0, st[k] - dt);
      }
    }
    // The passives, every frame, for the gadgets whose whole character is that
    // they are on. A gadget that is on is still costing you a slot and its
    // power, which is what keeps it a decision.
    for (const id of (typeof Gadgets !== 'undefined' ? Gadgets.fitted() : [])) {
      const fx = this.FX[id];
      if (fx && fx.tick) fx.tick(dt, player, this.rankOf(id));
    }
  },

  // ---- WHAT EACH ONE DOES -------------------------------------------------
  // One entry per gadget with something real behind it. A gadget with no entry
  // is refused with NOTHING BEHIND IT YET rather than firing and doing nothing,
  // and `unwired()` counts it — the honest-report pattern, again, because the
  // alternative is a player paying power for silence.
  FX: {
    // THE JAMMER. `Alert.suppressed` (stops rising) and `.suppressing`
    // (actively falls) have been declared and READ BY Alert.update since Block
    // 2, and set by nobody. Two flags rather than one so rank 1 and rank 2 are
    // both expressible without population.js needing to know what a gadget is
    // — which is exactly what that comment said it was for.
    jammer: {
      start(player, r) {
        if (typeof Alert === 'undefined') return;
        // `alertFall` IS NOT A FIELD. The data says `alertDrain`, and has since
        // the gadget was written — one word apart, so rank 2's "alert actively
        // FALLS while it runs" has never once happened. The same fault as
        // `permanent` against `permanentWeapon` in the mission rewards, in a
        // different file, found by the same sweep.
        //
        // And rank 1's `alertFreeze` is the field that says the alert stops
        // rising -- read, rather than assumed by every rank.
        if (r.alertFreeze) Alert.suppressed = true;
        if (r.alertDrain) Alert.suppressing = true;
        // RANK 3: ROAMERS LOSE YOU. A dispatched boss on the field breaks
        // off the moment the jammer runs, through the same path it takes
        // when the alert clears -- it is retired and remembers its damage.
        if (r.roamersLoseYou && typeof Population !== 'undefined' &&
            Population.disengageRoamers) {
          const n = Population.disengageRoamers('jammed');
          if (n && typeof Effects !== 'undefined') {
            Effects.comicWord('LOST YOU', player.x, player.y - 250, CONFIG.COLOR.cyan, 48);
          }
        }
      },
      stop() {
        if (typeof Alert === 'undefined') return;
        Alert.suppressed = false;
        Alert.suppressing = false;
      },
    },

    // THE SCANNER. Salvage glints through cover at range — the same pip
    // LooseParts._glint already draws for SCRAP EYE, which is why this needs
    // no drawing of its own: the glint asks for a range and gets the larger of
    // the skill's and the gadget's.
    scanner: {
      start(player, r) {
        player._scanT = r.pulse || 4;
        player._scanR = r.lootReveal || 400;
      },
      tick(dt, player) {
        if (player._scanT > 0) player._scanT = Math.max(0, player._scanT - dt);
      },
    },

    // THE REPAIR UNIT. `PlayerCore._updateRegen` already trickles out of
    // combat; this raises the rate and shortens the wait, and rank 3 is the
    // one that works UNDER FIRE — which is the whole reason it is a gadget
    // and not a module.
    repairUnit: {
      tick(dt, player, r) {
        if (!r || !player.maxHp) return;
        if (player.inCombat && !r.inCombat) return;
        if (player.sinceDamage < (r.delay || 3)) return;
        if (player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + (r.rate || 0) * dt);
        }
        // RANK 2: CONNECTORS TOO. The joints on your own parts knit back at
        // the same rate -- the thing that decides whether a part stays on
        // you in the next fight, and the one repair no module offers.
        if (r.connectors && player.sockets) {
          for (const s of player.sockets) {
            const c = s.comp;
            if (!c || c.permanent || !c.maxConnectorHp) continue;
            if (c.connectorHp < c.maxConnectorHp) {
              c.connectorHp = Math.min(c.maxConnectorHp, c.connectorHp + (r.rate || 0) * dt);
            }
          }
        }
      },
    },

    // THE TOW WINCH is a PASSIVE, and that is why it has no `start`: it does
    // not fire, it changes what towing costs. Tow._eased reads it alongside
    // TOLERANT MOUNTS and HEAVY LIFT, so a module, a skill and a gadget all
    // answer the same question and doing all three is a real build.
    // Tow._eased reads `towSpeedPenaltyMul`; Tow.nearest reads
    // `hookRangeMul`; Tow.hook reads `instantHook`; Tow.update reads
    // `towNoSnag`. All four through `GadgetRun.winch()` below.
    towWinch: {
      tick() { /* passive: read by Tow at the four places it applies */ },
    },

    // THE SALVAGE BEACON — the last gadget in the game that did nothing.
    //
    // `GadgetRun.unwired()` has printed exactly one name for four runs, and
    // this is it: a gadget a player can find, fit, and pay two power for, that
    // answered the button with silence. The data has always said what it is —
    // `marks` and `valueFrac`, with the note "Deliberately late and lossy.
    // Towing must stay the better option" — so this is the note, built.
    //
    // CALL IT IN. Every hulk within range is picked up where it lies and paid
    // out at a FRACTION of what it is worth: 60% at ranks 1 and 2, 80% at
    // rank 3. `marks` is how many go at once — one, then three, then five.
    //
    // WHY IT IS WORSE THAN TOWING, which is the whole design constraint:
    //   * you get SCRAP, never the PARTS. Tow.strip puts every part into the
    //     Rack; the beacon melts them at Salvage.valueOf and takes a cut. The
    //     Rack is where builds come from, so a player who beacons everything
    //     never builds anything.
    //   * a CHASSIS is refused outright. A vehicle is not a pile, Tow._rank
    //     already orders it ahead of every hulk, and the one thing worth
    //     driving home should not be the thing you can phone in.
    //   * the STRIPPER skill does not apply. It pays at the strip, and this
    //     is not a strip.
    //
    // So it is what a late gadget should be: it buys TIME on a field of
    // wrecks you would otherwise have to make five trips for, and it costs
    // you the parts and a fifth of the scrap to do it.
    salvageBeacon: {
      start(player, r) {
        if (typeof World === 'undefined' || typeof Tow === 'undefined') return;
        if (!r) return;
        const R = (r.range || GADGET_RUN_B.BEACON_R);
        const want = Math.max(1, r.marks || 1);
        const frac = r.valueFrac || 0.6;
        // Nearest first, so a player standing between two piles gets the one
        // they are looking at rather than an arbitrary one.
        const near = [];
        for (const e of World.entities) {
          if (!(e instanceof Hulk) || !e.alive || e.hooked) continue;
          if (e.chassis || e.machine) continue;    // drive it home yourself
          const d = Math.hypot(e.x - player.x, e.y - player.y);
          if (d <= R) near.push([d, e]);
        }
        near.sort((a, b) => a[0] - b[0]);
        let paid = 0, took = 0;
        for (const [, h] of near.slice(0, want)) {
          let v = h.scrap || 0;
          for (const q of (h.parts || [])) {
            // THE PARTS ARE MELTED, not banked. Salvage.valueOf is the same
            // number the Rack would have refused a third copy for, which
            // keeps the beacon and the garage agreeing about what a part is
            // worth.
            if (typeof Salvage !== 'undefined') {
              v += Salvage.valueOf(q.partId, q.gradeId || 'G2');
            }
          }
          const pay = Math.round(v * frac);
          if (typeof Forge !== 'undefined' && pay) Forge.bank(pay);
          paid += pay;
          took++;
          // A NAMED WRECK IS STILL RECOVERED. A RECOVERY mission's promise is
          // that the thing came back and was broken up, and it was — just not
          // by hand. Same field Tow.strip writes, so the two cannot disagree.
          if (h.wreckId && typeof Progress !== 'undefined') {
            Progress.towed = Progress.towed || {};
            Progress.towed[h.wreckId] = true;
          }
          h.alive = false;
        }
        player._beaconTook = took;
        player._beaconPaid = paid;
        if (took && typeof Effects !== 'undefined' && Effects.comicWord) {
          Effects.comicWord(player.x, player.y - 60,
                            took + ' CALLED IN', CONFIG.COLOR.yellow);
        }
      },
    },

    // THE DECOY. "The gadget that makes ripping viable against a group.
    // Findable EARLY." A thing you throw that machines go and shoot instead
    // of you, so a rip — which takes real seconds and cannot be hurried — is
    // something you can do with three of them in the room.
    decoy: {
      start(player, r) {
        if (typeof World === 'undefined' || typeof Decoy === 'undefined') return;
        const a = Math.atan2(player.aimY || 0, player.aimX || 1);
        const d = new Decoy(player.x + Math.cos(a) * DECOY_B.THROW,
                            player.y + Math.sin(a) * DECOY_B.THROW, r);
        // WORLD-OWNED, so it survives the chunk it was thrown in unloading,
        // and ADOPTED, because World.entities is what the frame walks. It is
        // registered in hazardreg as  for the rest: the draw band and
        // the update pass are built from that registry, and an entity outside
        // it is alive and invisible - which is exactly what happened the
        // first time this pushed straight into the list.
        World.own(d);
        if (World.entities.indexOf(d) < 0) World.entities.push(d);
      },
    },
  },

  // ---- THE HONEST REPORT --------------------------------------------------
  // Every gadget the data describes, and whether pressing the button does
  // anything. A gadget you can find, fit and pay power for, which then does
  // nothing, is worse than one that is not in the game.
  unwired() {
    if (typeof GADGETS === 'undefined') return [];
    return Object.keys(GADGETS).filter(id => !GADGETS[id].gate && !this.FX[id]);
  },

  // AND THE OTHER HALF OF THE SAME QUESTION: a gadget can be wired and still
  // have RANKS that do nothing.
  //
  // `unwired()` counts gadgets with no effect at all, and it has read "one
  // left" for two runs. It cannot see that the SCANNER's rank 3, the REPAIR
  // UNIT's rank 2, the DECOY's rank 3, the TOW WINCH's ranks 2 and 3 and the
  // JAMMER's rank 3 are fields nobody reads — a player finds a second rank,
  // the screen says 2, and nothing changes.
  //
  // Read as TEXT, against the whole of js/, because the question is exactly
  // "does any line of game code name this" and a parsed object cannot answer
  // it. `readBy` is supplied by the caller (the suite hands it the sources) so
  // this file does no I/O.
  //
  // The same reasoning as Spine.unreadFlags: the promise is counted, out loud,
  // so "one gadget left" cannot be mistaken for "one thing left".
  // A GATE GADGET'S RANK IS A NUMBER, NOT A BEHAVIOUR. `Barriers._hasOpener`
  // asks whether `Progress.gadgets.grapple >= 2`; the words beside it —
  // `anyDirection`, `pullsObjects` — are the design note that says WHY rank 2
  // opens what it opens. So they are separated rather than counted, because a
  // list that calls sixteen art briefs a defect is a list nobody reads twice.
  unreadRankFields(sources) {
    if (typeof GADGETS === 'undefined' || !sources) return { active: [], gate: [] };
    const out = { active: [], gate: [] };
    for (const id of Object.keys(GADGETS)) {
      const ranks = GADGETS[id].ranks || [];
      const bucket = GADGETS[id].gate ? out.gate : out.active;
      ranks.forEach((r, i) => {
        for (const f of Object.keys(r)) {
          const re = new RegExp('\\.' + f + '\\b|[\'"]' + f + '[\'"]');
          if (!re.test(sources)) bucket.push(id + ' rank ' + (i + 1) + ': ' + f);
        }
      });
    }
    return out;
  },

  // THE TOW WINCH'S RANK, or an empty object when it is not fitted -- so
  // Tow can read a field without four copies of the fitted-and-owned test.
  winch() {
    if (typeof Gadgets === 'undefined' || !Gadgets.isFitted('towWinch')) return {};
    return this.rankOf('towWinch') || {};
  },

  // The traversal five are deliberately NOT in FX: they are keys, not buttons.
  // A DRILL RIG does not fire — it is the reason a rubble wall opens, and
  // Barriers._hasOpener has read it since Block 8. Listed so `unwired()`
  // cannot be read as "five more things to build".
  gates() {
    if (typeof GADGETS === 'undefined') return [];
    return Object.keys(GADGETS).filter(id => GADGETS[id].gate);
  },
};

// The live decoys, so brainTarget can ask one question rather than walking the
// world list. One reader, one writer, the way everything else in this project
// that needs a live list works.
const Decoys = {
  nearestFor(e) {
    if (typeof World === 'undefined' || !e) return null;
    let best = null, bd = DECOY_B.DRAW_R;
    for (const q of World.entities) {
      if (!q || !q.isDecoy || !q.alive || !q.draws(e)) continue;
      const d = Math.hypot(q.x - e.x, q.y - e.y);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  },
};

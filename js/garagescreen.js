// SCRAPCORE: BREAKLANDS — THE GARAGE SCREEN (Block 5)
//
// Done when you can plan a build, save it, and take it out WITHOUT TOUCHING A
// MOUSE. That last clause is the hard half and it is the reason this file is
// laid out the way it is.
//
// This is the screen the player spends more time in than any other, so it is
// drawn in the game — same renderer, same 1920x1080 logical space, same UI
// module as every other screen. No DOM overlays anywhere (5.1).
//
// IT ABSORBS BLOCK 4's FITTING SCREEN. `FitState` is gone: two screens doing
// the same job is how a player learns not to trust either. Permanents are a
// tab here now.
//
// ---------------------------------------------------------------------------
// WHY A SCHEMATIC AND NOT THE WORLD VIEW
//
// The machine is drawn here as a flat schematic built from Canvas primitives,
// not by borrowing the world draw. Three reasons, and the third is the real
// one:
//
//   1. The world draw needs Camera and Iso set up for a frame that is not
//      happening.
//   2. A 44-degree projection makes it genuinely hard to tell which socket is
//      "up", and this screen is about picking sockets.
//   3. Standing rule 5. A schematic drawn from primitives is sprite-optional
//      by construction and can never be blocked on art.

const GARAGE_UI = {
  // VEHICLE is Block 7's route in and Block 5.2's 'vehicle select' at the
  // same time: switch between the core and any rig you own, and restore a
  // chassis you dragged home.
  // GADGETS is a tab because a system a player cannot reach is a system that
  // is not in the game. Slots, fitting and a power draw all existed and there
  // was nowhere to do any of it — which is the same fault this run has spent
  // its whole length digging out of other people's code, and it would have
  // been mine.
  // PAINT is a tab for the same reason GADGETS is one, and it is the third
  // time this project has found the same fault: Block 12 built 64 colours, 32
  // decals, ten sets, every unlock rule, presets, a randomiser and a rule
  // that emissive parts stay unpainted -- and NOTHING IN THE GAME EVER CALLED
  // ANY OF IT. The Paint module was named by no file but its own, and
  // Progress.paint was written into every save and read by nobody.
  // test_paint.js was green at
  // PASS 124 the whole time, because a suite that reads the data sees the
  // data. A system a player cannot reach is not in the game.
  // SKILLS is a tab for the third time this project has learned the same
  // lesson. Block 9 built forty levels, four branches and fifty effect keys
  // the machine really reads, and `Skills.take` -- the only function that
  // spends a point -- was called by NOTHING. XP was wired last run, so
  // without this the player earns levels they can watch and cannot spend,
  // which is worse than the silence before it.
  TABS: ['MACHINE', 'PERMANENTS', 'SKILLS', 'GADGETS', 'PAINT',
         'VEHICLE', 'PRESETS'],

  // The schematic ring. Root sockets sit on it; children hang further out.
  RING: 130,
  CHILD_STEP: 78,
  SOCKET_R: 34,
  // Permanents get their OWN outer ring. Block 4 made 'a slot is not a
  // module socket' true in code; this is the line that makes it true on
  // screen. The first draft drew them at the module radius and they simply
  // vanished underneath it.
  PERM_RING: 232,

  // The palette grid. Eight across is what fits beside the slot column at
  // 1920 wide with a set label above each row.
  PAINT_COLS: 8,
  PAINT_SW: 62,

  // Storage list
  ROW_H: 62,
  ROWS: 11,

  // How much of the stick has to point at a socket for it to count as "that
  // way". Below this the stick is ambiguous and nothing moves, which is much
  // better than jumping somewhere surprising.
  DIR_MIN: 0.34,
  REPEAT: 0.19,

  FILTERS: ['ALL', 'WEAPON', 'DEFENCE', 'MOBILITY', 'UTILITY', 'STRUCTURE'],
  SORTS: ['NEW', 'NAME', 'POWER', 'WEIGHT'],
};

// ---------------------------------------------------------------------------
// The numbers the player is deciding with. Computed from the LIVE machine, so
// what the screen says and what the machine does cannot disagree — 5.2 says
// the cost must be visible WHILE deciding, and a readout derived from a second
// copy of the rules is a readout that will eventually lie.
// What the garage says for each wall GarageCalc.refusal names. One table,
// so a new wall gets its sentence here and nowhere else.
const GARAGE_REFUSAL_TEXT = {
  LOAD: 'TOO HEAVY - OVER 130% LOAD',
  MODULES: 'NO MODULE SLOTS LEFT',
  STRUCTURE_ON_ROOT: 'STRUCTURE MOUNTS ON A ROOT ONLY',
  NO_BRANCHING: 'THIS FRAME DOES NOT BRANCH',
  PROTOTYPE_CAP: 'ONLY ONE PROTOTYPE AT A TIME',
  SOCKET: 'THAT SOCKET IS TAKEN',
  'NOT A PART': 'WILL NOT FIT',
};

const GarageCalc = {
  // Heat: seconds until this build overheats with everything firing. This is
  // the single most useful number on the screen and the game has never shown
  // it. Mirrors Machine.addHeat's multipliers, including the Block 4 permanent
  // multiplier, because a permanent is usually the hottest thing on the rig.
  heatPerSecond(ent) {
    let h = 0;
    for (const s of ent.sockets) {
      if (!s.comp || !s.comp.online) continue;
      const p = s.comp.part;
      let rate = 0;
      if (p.heatPerSecond) rate = p.heatPerSecond;
      else if (p.heatPerShot && p.fireRate) rate = p.heatPerShot * p.fireRate;
      if (!rate) continue;
      rate *= (ent.weaponHeatMul || 1);
      if (p.permanent && typeof PERM !== 'undefined') rate *= PERM.HEAT_MUL;
      h += rate;
    }
    return h;
  },

  coolingPerSecond(ent) {
    let c = ent.cooling || 0;
    for (const s of ent.sockets) {
      if (s.comp && s.comp.online && s.comp.part.coolingBonus) {
        c += s.comp.part.coolingBonus;
      }
    }
    return c * (ent.coolingMul || 1);
  },

  // Infinity means it never overheats, which is a real and desirable answer.
  secondsToOverheat(ent) {
    const net = this.heatPerSecond(ent) - this.coolingPerSecond(ent);
    if (net <= 0.001) return Infinity;
    return (ent.heatCap || 100) / net;
  },

  // Weight, as NUMBERS not a bar (5.2). The player wants to know what it costs
  // them, and "80% move speed" is a cost; a three-quarters-full bar is not.
  loadBand(ent) {
    const frac = ent.loadFrac || 0;
    let band = Machine.LOAD_BANDS[0];
    for (const b of Machine.LOAD_BANDS) { band = b; if (frac <= b.upTo) break; }
    return band;
  },

  // 5.4 RECOIL IS PHYSICAL — SHOW IT.
  //
  // Machine does `ent.vx -= cos(aim) * kick`, so a weapon shoves you OPPOSITE
  // the way it points. Opposite mounts therefore cancel and a rear mount
  // pushes you forward, which is one of the best things in the design and has
  // been completely invisible until now.
  recoilVector(ent) {
    let rx = 0, ry = 0, total = 0;
    for (const s of ent.sockets) {
      if (!s.comp || !s.comp.online) continue;
      const p = s.comp.part;
      if (!p.recoil || !p.fireRate) continue;
      const kick = p.recoil * p.fireRate * (ent.recoilMul || 1);
      const a = s.angleTarget !== undefined ? s.angleTarget : s.angle;
      rx -= Math.cos(a) * kick;
      ry -= Math.sin(a) * kick;
      total += kick;
    }
    return { x: rx, y: ry, mag: Math.hypot(rx, ry), total };
  },

  // WHICH WALL a part hits, or null if it would fit. One place, so the
  // toast, a future tooltip and the tests all get the same answer.
  refusal(ent, partId, socket) {
    if (!PARTS[partId]) return 'NOT A PART';
    // THAT SOCKET IS TAKEN. `Machine.attach` refuses on this first and this
    // function did not check it at all - so pointing at an occupied socket
    // came back "it fits", the screen said so, and the attach then failed.
    // The one thing this function exists to prevent is the screen and the
    // machine disagreeing.
    if (socket && socket.comp) return 'SOCKET';
    if (!Machine.loadAllows(ent, partId)) return 'LOAD';
    if (ent.moduleCount >= (ent.maxModules === undefined ? 99 : ent.maxModules)) {
      return 'MODULES';
    }
    if (PARTS[partId].childSockets && socket && socket.parentId !== undefined) {
      return 'STRUCTURE_ON_ROOT';
    }
    if (PARTS[partId].childSockets && ent.branchingAllowed === false) {
      return 'NO_BRANCHING';
    }
    if (typeof Proto !== 'undefined' && !Proto.attachAllowed(ent, partId)) {
      return 'PROTOTYPE_CAP';
    }
    // NOWHERE TO PUT IT - and LAST, not first, which is a deliberate
    // departure from `Machine.attach`'s order. A machine that is both full
    // and over its Load wall should be told about the WALL: "you are over
    // weight" is something the player can act on, and "that socket is taken"
    // is something they can already see.
    if (!socket && !ent.sockets.some(k => !k.comp)) return 'SOCKET';
    return null;
  },

  // Which parts are switched off, and why. 5.2: show exactly what switches off.
  offline(ent) {
    return ent.sockets.filter(s => s.comp && !s.comp.online).map(s => s.comp);
  },
};

// ---------------------------------------------------------------------------
class GarageState {
  enter() {
    this.tab = this.tab || 'MACHINE';
    this.pane = 0;                 // 0 = machine, 1 = storage
    this.sockIdx = 0;
    this.listIdx = 0;
    this.listTop = 0;
    this.filter = 0;
    this.sort = 0;
    this.slot = 0;                 // permanents tab
    this.presetIdx = 0;
    this.toast = ''; this.toastT = 0;
    this._rep = 0;
    this._prevStick = 0;

    // A REAL machine, built by the real builder, so what you plan is what you
    // drive. Reusing the live GAME player would mean edits applied mid-drive;
    // building a throwaway would mean the screen edits something that is not
    // your machine. So: edit the live player if there is one, else build one.
    const gs = Game.states.GAME;
    if (gs && gs.player) this.player = gs.player;
    else {
      this.player = new PlayerCore(0, 0, 'scrapper');
      this.player.isPlayer = true;
      Progress.buildMachine(this.player);
    }
    this._refresh();
    this.build();
  }

  exit() {
    if (typeof Progress !== 'undefined') Progress.save();
  }

  onResize() { this.build(); }

  _toast(t) { this.toast = t; this.toastT = 2.8; }

  _refresh() {
    Machine.recalcPower(this.player);
    Machine.recalcStats(this.player);
  }

  // ---- what the panes contain -------------------------------------------
  // Sockets in a stable, spatial order. Roots first by angle, then children,
  // so the list index and the picture agree.
  sockets() {
    return this.player.sockets.filter(s => !s.permanent);
  }

  storage() {
    const cat = GARAGE_UI.FILTERS[this.filter];
    let ids = Rack.typesOwned().filter(id => PARTS[id]);
    if (cat !== 'ALL') {
      ids = ids.filter(id => (PARTS[id].category || '').toUpperCase() === cat);
    }
    const sort = GARAGE_UI.SORTS[this.sort];
    ids.sort((a, b) => {
      if (sort === 'NAME') return PARTS[a].name.localeCompare(PARTS[b].name);
      if (sort === 'POWER') return (PARTS[b].powerCost || 0) - (PARTS[a].powerCost || 0);
      if (sort === 'WEIGHT') return (PARTS[b].loadCost || 0) - (PARTS[a].loadCost || 0);
      // NEW: things you have not fitted yet float to the top, because a
      // hundred parts in one flat list is unusable and the new one is what
      // you came in to look at.
      const an = this._isNew(a) ? 0 : 1, bn = this._isNew(b) ? 0 : 1;
      return an - bn || PARTS[a].name.localeCompare(PARTS[b].name);
    });
    return ids;
  }

  _isNew(partId) {
    const seen = (Progress.partsSeen || {});
    return !seen[partId];
  }

  // ---- input -------------------------------------------------------------
  // CONTROLLER FIRST (5.3). Everything below is reachable with a stick and
  // three buttons, and the on-screen hint line always names them.
  update(dt) {
    if (typeof UINav !== 'undefined') UINav.update(this.buttons);
    this.toastT = Math.max(0, this.toastT - dt);
    this._rep = Math.max(0, this._rep - dt);

    const m = Controls.move;
    const stick = m.mag > 0.5;
    const fresh = stick && this._rep <= 0;
    if (!stick) this._rep = 0;

    // Shoulders cycle tabs on every pane, so a player who is lost can always
    // get somewhere by pressing them.
    if (Controls.rotateL.justPressed) this._cycleTab(-1);
    if (Controls.rotateR.justPressed) this._cycleTab(1);

    if (this.tab === 'MACHINE') this._updateMachine(fresh, m);
    else if (this.tab === 'PERMANENTS') this._updatePermanents(fresh, m);
    else if (this.tab === 'GADGETS') this._updateGadgets(fresh, m);
    else if (this.tab === 'SKILLS') this._updateSkills(fresh, m);
    else if (this.tab === 'PAINT') this._updatePaint(fresh, m);
    else if (this.tab === 'VEHICLE') this._updateVehicle(fresh, m);
    else this._updatePresets(fresh, m);

    if (Controls.dash.justPressed) {
      if (this.pane === 1) { this.pane = 0; }
      else Game.switch('HOME');
    }
    this._prevStick = m.mag;
  }

  _cycleTab(d) {
    const i = GARAGE_UI.TABS.indexOf(this.tab);
    this.tab = GARAGE_UI.TABS[(i + d + GARAGE_UI.TABS.length) % GARAGE_UI.TABS.length];
    this.pane = 0;
    this.build();
  }

  _updateMachine(fresh, m) {
    if (this.pane === 0) {
      // SPATIAL socket selection (5.3): pushing right selects the socket to
      // the RIGHT, not the next index. A list-index walk around a ring of
      // sockets is the thing that makes a garage screen feel like a
      // spreadsheet.
      if (fresh) {
        const moved = this._stepSocket(m.dx, m.dy);
        if (moved) this._rep = GARAGE_UI.REPEAT;
        else if (m.dx > 0.6) { this.pane = 1; this._rep = GARAGE_UI.REPEAT; }
      }
      if (Controls.magnet.justPressed) {
        const s = this.sockets()[this.sockIdx];
        if (s && s.comp) {
          // Confirming a FILLED socket takes the part off. It goes back to
          // storage because the Rack owns it permanently - this screen never
          // destroys anything.
          const id = s.comp.part.id;
          Machine.detachSilent(this.player, s.id);
          Machine._recount(this.player);
          this._refresh();
          this._toast('REMOVED ' + PARTS[id].name);
        } else {
          this.pane = 1;
          this._toast('PICK A PART');
        }
      }
    } else {
      if (fresh) {
        if (m.dx < -0.6) { this.pane = 0; this._rep = GARAGE_UI.REPEAT; }
        else if (Math.abs(m.dy) > Math.abs(m.dx)) {
          const list = this.storage();
          if (list.length) {
            this.listIdx = (this.listIdx + (m.dy > 0 ? 1 : -1) + list.length) % list.length;
            this._scroll();
          }
          this._rep = GARAGE_UI.REPEAT;
        }
      }
      if (Controls.magnet.justPressed) this._place();
      if (Controls.special && Controls.special.justPressed) {
        this.sort = (this.sort + 1) % GARAGE_UI.SORTS.length;
        this._toast('SORT: ' + GARAGE_UI.SORTS[this.sort]);
      }
    }
  }

  _scroll() {
    const n = GARAGE_UI.ROWS;
    if (this.listIdx < this.listTop) this.listTop = this.listIdx;
    if (this.listIdx >= this.listTop + n) this.listTop = this.listIdx - n + 1;
  }

  _place() {
    const list = this.storage();
    if (!list.length) { this._toast('STORAGE IS EMPTY'); return; }
    const partId = list[Math.min(this.listIdx, list.length - 1)];
    const socks = this.sockets();
    const s = socks[this.sockIdx];
    if (!s) { this._toast('NO SOCKET SELECTED'); return; }
    if (s.comp) {
      Machine.detachSilent(this.player, s.id);
      Machine._recount(this.player);
    }
    const r = Machine.attach(this.player, partId, s.id);
    if (r === -1) {
      // The refusal has to say WHICH wall you hit, or the player learns
      // nothing. FIVE walls, and they are not interchangeable: each is a
      // different thing to go and do something about. GarageCalc.refusal
      // is the ladder -- it was written so the screen and the machine could
      // not disagree, and then this branch grew its own copy of it and the
      // function had no caller at all (unwire, D339). The screen asks it now.
      this._toast(GARAGE_REFUSAL_TEXT[GarageCalc.refusal(this.player, partId, s)] || 'WILL NOT FIT');
      return;
    }
    Progress.partsSeen = Progress.partsSeen || {};
    Progress.partsSeen[partId] = true;
    this._refresh();
    this.pane = 0;
    this._toast('FITTED ' + PARTS[partId].name);
  }

  // Pick the socket most in the direction pushed. Scored by how well the
  // direction matches first and distance second, so a far socket dead ahead
  // beats a near one off to the side.
  _stepSocket(dx, dy) {
    const socks = this.sockets();
    if (socks.length < 2) return false;
    const pos = socks.map(s => this._schemPos(s));
    const from = pos[this.sockIdx] || pos[0];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < socks.length; i++) {
      if (i === this.sockIdx) continue;
      const vx = pos[i].x - from.x, vy = pos[i].y - from.y;
      const d = Math.hypot(vx, vy);
      if (d < 1) continue;
      const dot = (vx / d) * ux + (vy / d) * uy;
      if (dot < GARAGE_UI.DIR_MIN) continue;
      const score = dot * 1000 - d;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) return false;
    this.sockIdx = best;
    return true;
  }

  // Where a socket sits in the SCHEMATIC. One function, used by both the draw
  // and the spatial navigation, so what you see and what the stick does can
  // never drift apart.
  _schemPos(s) {
    const c = this._centre();
    if (s.permanent) {
      const a = (s.angleTarget !== undefined ? s.angleTarget : s.angle) || 0;
      return { x: c.x + Math.cos(a) * GARAGE_UI.PERM_RING,
               y: c.y + Math.sin(a) * GARAGE_UI.PERM_RING };
    }
    let depth = 0, cur = s;
    while (cur && cur.parentId !== undefined) {
      depth++;
      cur = Machine.getSocket(this.player, cur.parentId);
      if (depth > 6) break;
    }
    const a = (s.angleTarget !== undefined ? s.angleTarget : s.angle) || 0;
    const r = GARAGE_UI.RING + depth * GARAGE_UI.CHILD_STEP;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  }

  _centre() {
    const s = Display.safe;
    return { x: s.left + (s.right - s.left) * 0.30, y: s.top + 430 };
  }

  // ---- permanents (absorbed from Block 4's FitState) ---------------------
  _updatePermanents(fresh, m) {
    const slots = Math.max(1, Permanents.slotCount(this._vehicle()));
    const owned = Permanents.ownedList();
    if (fresh) {
      if (Math.abs(m.dy) > Math.abs(m.dx)) {
        const d = m.dy > 0 ? 1 : -1;
        if (this.pane === 0) this.slot = (this.slot + d + slots) % slots;
        else if (owned.length) this.listIdx = (this.listIdx + d + owned.length) % owned.length;
      } else this.pane = m.dx > 0 ? 1 : 0;
      this._rep = GARAGE_UI.REPEAT;
    }
    if (Controls.magnet.justPressed) {
      if (this.pane === 0) { this.pane = 1; return; }
      if (!owned.length) { this._toast('NOTHING FOUND YET'); return; }
      const id = owned[Math.min(this.listIdx, owned.length - 1)];
      const fitted = Permanents.fitted(this._vehicle());
      const next = fitted[this.slot] === id ? null : id;
      if (Permanents.fit(this._vehicle(), this.slot, next)) {
        Progress.save();
        Permanents.applyTo(this.player, this._vehicle());
        this._refresh();
        this._toast(next ? 'FITTED ' + Permanents.part(next).name : 'SLOT CLEARED');
      }
    }
    // THE SPINE, BOUGHT WHERE THE WEAPON IS. Block 10 built the ladder and
    // there was no rung to press: a player could hold ten upgrade parts and
    // four thousand scrap and have nowhere to spend either.
    //
    // On SPECIAL rather than MAGNET, because MAGNET is fit-and-remove on this
    // tab and a mis-tap that spent 1,800 scrap would be unforgivable — and the
    // refusal is TOASTED rather than silent, so the wall you hit is named.
    if (Controls.special && Controls.special.justPressed &&
        typeof Spine !== 'undefined') {
      const id = this.pane === 1 && owned.length
        ? owned[Math.min(this.listIdx, owned.length - 1)]
        : Permanents.fitted(this._vehicle())[this.slot];
      if (!id) { this._toast('PICK A WEAPON FIRST'); return; }
      const cls = Spine.classOf(id);
      // The CAPSTONE once the spine is finished — it is the same button
      // because it is the same ladder, and the refusal says which rung.
      const why = Spine.maxed(cls) ? Spine.capstoneRefusal(id)
                                   : Spine.refusal(cls);
      if (why) { this._toast(why); return; }
      const bought = Spine.maxed(cls) ? Spine.buyCapstone(id) : Spine.buy(cls);
      if (bought) {
        this._refresh();
        this._toast(Spine.maxed(cls) && Spine.hasCapstone(id)
          ? 'CAPSTONE — ' + String(WEAPON_VARIANTS[id].capstone).toUpperCase()
          : (String(cls).toUpperCase() + ' SPINE ' + Spine.step(cls)));
      }
    }
  }

  // ---- THE GADGET BAY -----------------------------------------------------
  // Left pane the slots you have, right pane the gadgets you have FOUND.
  // Exactly the shape of the permanents tab next door, because they are the
  // same decision — which of the things I own am I carrying today — and a
  // player who has learned one screen should not have to learn a second.
  _updateGadgets(fresh, m) {
    if (typeof Gadgets === 'undefined') return;
    const slots = Math.max(1, Gadgets.slots());
    const owned = Object.keys(Progress.gadgets || {})
      .filter(g => typeof GADGETS !== 'undefined' && GADGETS[g]).sort();
    if (fresh) {
      if (Math.abs(m.dy) > Math.abs(m.dx)) {
        const d = m.dy > 0 ? 1 : -1;
        if (this.pane === 0) this.slot = (this.slot + d + slots) % slots;
        else if (owned.length) {
          this.listIdx = (this.listIdx + d + owned.length) % owned.length;
        }
      } else this.pane = m.dx > 0 ? 1 : 0;
      this._rep = GARAGE_UI.REPEAT;
    }
    if (Controls.magnet.justPressed) {
      if (this.pane === 0) {
        // MAGNET on a filled slot takes it out — the only way back off.
        const cur = Gadgets.fitted()[this.slot];
        if (cur) { Gadgets.remove(cur); this._refresh(); this._toast('REMOVED'); }
        else this.pane = 1;
        return;
      }
      if (!owned.length) { this._toast('NOTHING FOUND YET'); return; }
      const id = owned[Math.min(this.listIdx, owned.length - 1)];
      const why = Gadgets.refusal(id);
      if (why) { this._toast(why); return; }
      Gadgets.fit(id);
      // A GADGET COSTS POWER, and the readout under this screen has to move
      // the moment it does — otherwise the cost is a sentence in a file.
      Machine.recalcPower(this.player);
      this._refresh();
      this._toast('FITTED ' + (GADGETS[id].name || id));
    }
  }

  // BLOCK 7: the vehicle whose permanent slots apply is the RIG you are
  // docked into, or the CORE you are walking as. Rigs is the one place that
  // knows which, so this asks rather than guessing.
  _vehicle() {
    if (typeof Rigs !== 'undefined') return Rigs.vehicleId();
    return this.player.jackrigId || Progress.jackrigId || 'jackal';
  }

  // ---- VEHICLE (Block 7.3, and Block 5.2's vehicle select) -------------
  // Rows: ON FOOT, then every rig you own, then every chassis parked here
  // waiting to be paid for.
  _vehicleRows() {
    const rows = [{ kind: 'core', id: Rigs.coreId(), name: 'ON FOOT — ' +
      Rigs.core().name }];
    for (const id of Rigs.owned()) {
      rows.push({ kind: 'rig', id, name: RIGS[id].name });
    }
    for (const c of Chassis.parked()) {
      rows.push({ kind: 'chassis', id: c.rigId,
        name: RIGS[c.rigId].name + ' CHASSIS — RESTORE' });
    }
    // Q4: and every MACHINE wreck parked, waiting to be paid for.
    if (typeof MachineWrecks !== 'undefined') {
      for (const m of MachineWrecks.parked()) {
        rows.push({ kind: 'machine', id: m.machineId,
          name: JACKRIGS[m.machineId].name + ' WRECK — RESTORE' });
      }
    }
    return rows;
  }

  _updateVehicle(fresh, m) {
    const rows = this._vehicleRows();
    if (fresh && Math.abs(m.dy) > Math.abs(m.dx)) {
      this.vehIdx = ((this.vehIdx || 0) + (m.dy > 0 ? 1 : -1) + rows.length) %
        rows.length;
      this._rep = GARAGE_UI.REPEAT;
    }
    if (Controls.magnet.justPressed) {
      const row = rows[Math.min(this.vehIdx || 0, rows.length - 1)];
      if (!row) return;
      if (row.kind === 'core') {
        // Getting OUT is a first-class action, not an edge case.
        Rigs.undock(this.player, this.player.x, this.player.y);
        this._toast('ON FOOT — ' + Rigs.core().name);
      } else if (row.kind === 'rig') {
        Rigs.dock(this.player, row.id);
        this._toast('DOCKED — ' + RIGS[row.id].name);
      } else if (row.kind === 'machine') {
        // A restored MACHINE is yours; the Yard's plate is where you get
        // into it, and the toast says so rather than leaving a player to
        // wonder where it went.
        const gotM = MachineWrecks.restore(row.id);
        this._toast(gotM ? 'RESTORED — ' + gotM.name + '. SELECT IT AT THE YARD'
          : 'NEED ' + MachineWrecks.cost() + ' SCRAP');
      } else {
        const got = Chassis.restore(row.id);
        this._toast(got ? 'RESTORED — ' + got.name
          : 'NEED ' + Rigs.restoreCost(row.id) + ' SCRAP');
      }
      this._refresh();
      Progress.save();
    }
  }

  _drawVehicle() {
    const s = Display.safe;
    const x = s.left + 60, y0 = this._paneTop() + 20, w = 980, rh = 88;
    const rows = this._vehicleRows();
    R.smallText('VEHICLE', x, y0 - 16, 24, CONFIG.COLOR.yellow);
    R.smallText('YOUR CORE DOCKS INTO THE RIG AND SUPPLIES ITS POWER. ' +
      'CITIES, MINES AND LAIRS REFUSE RIGS.', x, y0 - 44, 19, CONFIG.COLOR.grid);
    rows.forEach((row, i) => {
      const y = y0 + i * (rh + 10);
      if (y > s.bottom - 360) return;
      const on = i === (this.vehIdx || 0);
      const here = row.kind === 'rig' && Rigs.dockedId() === row.id;
      const onFoot = row.kind === 'core' && !Rigs.dockedId();
      R.ctx.fillStyle = on ? '#2c3a66' : '#1a2138';
      R.ctx.fillRect(x, y, w, rh);
      R.ctx.strokeStyle = on ? CONFIG.COLOR.yellow
        : ((here || onFoot) ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel);
      R.ctx.lineWidth = on ? 5 : 3;
      R.ctx.strokeRect(x, y, w, rh);
      R.smallText(row.name + ((here || onFoot) ? '   \u2022 CURRENT' : ''),
        x + 16, y + 34, 26,
        (row.kind === 'chassis' || row.kind === 'machine') ? CONFIG.COLOR.orange
          : ((here || onFoot) ? CONFIG.COLOR.cyan : CONFIG.COLOR.white));
      if (row.kind === 'rig') {
        const r = RIGS[row.id];
        R.smallText(r.size.toUpperCase() + '   ' + r.slots + ' SLOTS   ' +
          r.abilityName + '   —   ' + r.why, x + 16, y + 64, 18,
          CONFIG.COLOR.steel);
      } else if (row.kind === 'core') {
        const c = Rigs.core();
        R.smallText(c.slots + ' SLOTS   —   ' + c.why, x + 16, y + 64, 18,
          CONFIG.COLOR.steel);
      } else if (row.kind === 'machine') {
        const J = JACKRIGS[row.id];
        // THE LADDER, SAID: the price climbs with each machine restored, so
        // the row says which rung this one is on rather than leaving the
        // player to notice the number changed since last time.
        R.smallText('COSTS ' + MachineWrecks.cost() + ' SCRAP  (MACHINE ' +
          (MachineWrecks.restoredCount() + 1) + ' OF ' + (JACKRIG_LIST.length - 1) +
          ' — THE PRICE CLIMBS)   —   A MACHINE OF YOUR OWN: ' +
          J.identity.toUpperCase(), x + 16, y + 64, 18, CONFIG.COLOR.steel);
      } else {
        R.smallText('COSTS ' + Rigs.restoreCost(row.id) + ' SCRAP   —   ' +
          'IT ARRIVES WITH ONE SLOT AND YOU BUILD IT UP',
          x + 16, y + 64, 18, CONFIG.COLOR.steel);
      }
    });
  }

  // ---- presets -----------------------------------------------------------
  // 5.2: name them, save them, load them. This is what makes FIELD WORKSHOP
  // worth buying in Block 10, so the storage shape matters more than the UI.
  _presets() {
    Progress.presets = Progress.presets || [];
    return Progress.presets;
  }

  _updatePresets(fresh, m) {
    const list = this._presets();
    const n = list.length + 1;                 // +1 = the SAVE CURRENT row
    if (fresh && Math.abs(m.dy) > Math.abs(m.dx)) {
      this.presetIdx = (this.presetIdx + (m.dy > 0 ? 1 : -1) + n) % n;
      this._rep = GARAGE_UI.REPEAT;
    }
    if (Controls.magnet.justPressed) {
      if (this.presetIdx >= list.length) {
        // The cursor needs no adjusting: SAVE CURRENT is always the LAST row,
        // at index list.length, and saving appends - so the new build lands
        // at exactly the index the cursor is already on. An earlier version
        // set it explicitly and prove_block4 showed the line did nothing.
        const saved = Presets.capture(this.player, 'BUILD ' + (list.length + 1));
        this._toast(saved ? 'SAVED ' + saved.name : 'NOTHING TO SAVE');
      } else {
        const r = Presets.load(this.player, list[this.presetIdx]);
        this._refresh();
        this._toast(r.placed + ' PARTS FITTED' +
          (r.missing ? ', ' + r.missing + ' NOT IN STORAGE' : ''));
      }
      Progress.save();
    }
    if (Controls.special && Controls.special.justPressed && this.presetIdx < list.length) {
      const p = list.splice(this.presetIdx, 1)[0];
      this._toast('DELETED ' + p.name);
      Progress.save();
    }
  }

  // ---- buttons (pointer users get the same actions) ---------------------
  build() {
    const s = Display.safe;
    this.buttons = new UIButtons();
    // THE TABS FIT THE SCREEN, however many there are. This was a fixed 250
    // pitch and a fixed 236 width, which was right for five tabs and wrong
    // the moment PAINT made six -- and at seven the GARAGE wordmark on the
    // right was overprinted down to 'AGE'. A row that only fits by luck fits
    // until somebody adds one more.
    //
    // The wordmark needs about 300px on the right, so the tabs get what is
    // left and share it. R.fitText inside the button handles the label.
    const tabRoom = (s.right - s.left) - 40 - 320;
    const tabPitch = Math.min(250, tabRoom / GARAGE_UI.TABS.length);
    const tabW = tabPitch - 14;
    GARAGE_UI.TABS.forEach((t, i) => {
      this.buttons.add(t, s.left + 40 + i * tabPitch, s.top + 24, tabW, 74,
        () => { this.tab = t; this.pane = 0; this.build(); },
        { size: 26, color: this.tab === t ? CONFIG.COLOR.yellow : '#232b44',
          textColor: this.tab === t ? CONFIG.COLOR.ink : '#ffffff' });
    });
    this.buttons.add('TAKE IT OUT', s.right - 330, s.bottom - 120, 290, 88,
      () => Game.switch('GAME'),
      { size: 30, color: CONFIG.COLOR.lime, textColor: CONFIG.COLOR.ink });
    this.buttons.add('BACK', s.right - 330, s.bottom - 222, 290, 84,
      () => Game.switch('HOME'),
      { size: 28, color: '#3a4468', textColor: '#ffffff' });
  }

  pointerDown(id, x, y) { this.buttons.hit(x, y); }
  pointerMove() {}
  pointerUp() {}

  // ---- draw --------------------------------------------------------------
  render() {
    R.clear(CONFIG.COLOR.bg);
    const s = Display.safe;
    // TOP RIGHT, not centred. Centred put it at x=960 in a tab row that runs
    // from 40 to 1026 - so the title was drawn UNDERNEATH its own tabs and
    // all the player ever saw of it was the final E sticking out past
    // PRESETS. A screenshot found it; nothing else could have.
    R.text('GARAGE', s.right - 40, s.top + 62, 46, CONFIG.COLOR.yellow, 'right');

    if (this.tab === 'MACHINE') { this._drawMachine(); this._drawStorage(); }
    else if (this.tab === 'PERMANENTS') this._drawPermanents();
    else if (this.tab === 'GADGETS') this._drawGadgets();
    else if (this.tab === 'SKILLS') this._drawSkills();
    else if (this.tab === 'PAINT') this._drawPaint();
    else if (this.tab === 'VEHICLE') this._drawVehicle();
    else this._drawPresets();

    this._drawReadout();

    if (this.toastT > 0) {
      R.text(this.toast, (s.left + s.right) / 2, s.bottom - 176, 30,
        CONFIG.COLOR.orange);
    }
    R.smallText(this._hint(), (s.left + s.right) / 2, s.bottom - 132, 22,
      CONFIG.COLOR.grid, 'center');
    this.buttons.draw();
  }

  _hint() {
    if (this.tab === 'VEHICLE') {
      return 'STICK MOVES  \u2022  MAGNET DOCKS, LEAVES OR RESTORES  \u2022  ' +
             'SHOULDERS CHANGE TAB  \u2022  DASH LEAVES';
    }
    if (this.tab === 'PRESETS') {
      return 'STICK MOVES  •  MAGNET SAVES OR LOADS  •  SPECIAL DELETES  •  ' +
             'SHOULDERS CHANGE TAB  •  DASH LEAVES';
    }
    if (this.tab === 'PERMANENTS') {
      return 'STICK MOVES  •  MAGNET FITS  •  SPECIAL BUYS THE NEXT SPINE ' +
             'STEP  •  SHOULDERS CHANGE TAB  •  DASH LEAVES';
    }
    if (this.tab === 'GADGETS') {
      return 'STICK MOVES  •  MAGNET FITS OR REMOVES  •  ' +
             'SHOULDERS CHANGE TAB  •  DASH LEAVES';
    }
    if (this.tab === 'SKILLS') {
      return 'STICK MOVES  •  MAGNET BUYS A RANK  •  ' +
             'SHOULDERS CHANGE TAB  •  DASH LEAVES';
    }
    if (this.tab === 'PAINT') {
      return 'MAGNET PAINTS OR RESETS  •  SPECIAL ROLLS  •  ' +
             'SHOULDERS CHANGE TAB  •  DASH LEAVES';
    }
    return this.pane === 0
      ? 'STICK PICKS A SOCKET  •  MAGNET REMOVES  •  RIGHT GOES TO STORAGE  ' +
        '•  SHOULDERS CHANGE TAB'
      : 'STICK PICKS A PART  •  MAGNET FITS IT  •  SPECIAL SORTS  ' +
        '•  LEFT GOES BACK  •  DASH LEAVES';
  }

  _drawMachine() {
    const ctx = R.ctx;
    const c = this._centre();
    const socks = this.sockets();

    // The core.
    R.circle(c.x, c.y, 78, '#1a2138', CONFIG.COLOR.steel, 5);
    R.smallText((Progress.jackrig && Progress.jackrig.name) || 'CORE',
      c.x, c.y + 6, 24, CONFIG.COLOR.cyan, 'center');
    // The frame's name, inside the core disc — which is `#1a2138`, and grid is
    // `#1d2540`. 1.05 to 1. The name of the thing you are driving, printed on
    // the picture of it, in a colour indistinguishable from the disc it is on.
    R.smallText((Progress.frame && Progress.frame.name) || '', c.x, c.y + 34, 18,
      CONFIG.COLOR.steel, 'center');

    // Permanent slots draw on their own outer ring so the player can SEE that
    // they are not module sockets - the thing Block 4 made true in code and
    // nothing on screen has ever said.
    for (const s of this.player.sockets) {
      if (!s.permanent || !s.comp) continue;
      const p = this._schemPos(s);
      R.ctx.strokeStyle = '#3a2a5c';
      R.ctx.lineWidth = 3;
      R.ctx.setLineDash([10, 8]);
      R.ctx.beginPath();
      R.ctx.moveTo(c.x, c.y); R.ctx.lineTo(p.x, p.y); R.ctx.stroke();
      R.ctx.setLineDash([]);
      R.circle(p.x, p.y, GARAGE_UI.SOCKET_R, '#2a2140', '#9b5cff', 5);
      // FITTED, NOT CHOPPED. `.slice(0, 7)` turned MACHINE GUN into MACHIN --
      // a truncation that reads as a rendering fault rather than as a short
      // name, and one that cannot tell a MACHINE GUN from a MACHINE anything.
      // R.fitText shrinks to the circle instead, with its own 11pt floor.
      {
        const w = s.comp.part.name.split(' ')[0];
        R.smallText(w, p.x, p.y + 4,
          R.fitText(w, 17, GARAGE_UI.SOCKET_R * 1.8), '#c39cff', 'center');
      }
      R.smallText('BOLTED ON', p.x, p.y + 24, 14, '#7a5cb8', 'center');
    }

    socks.forEach((s, i) => {
      const p = this._schemPos(s);
      const on = this.pane === 0 && i === this.sockIdx;
      // The spoke, so branches read as hanging off their parent rather than
      // floating at a coincidental angle.
      const parent = s.parentId !== undefined
        ? Machine.getSocket(this.player, s.parentId) : null;
      const from = parent ? this._schemPos(parent) : c;
      ctx.strokeStyle = on ? CONFIG.COLOR.yellow : '#2a3352';
      ctx.lineWidth = on ? 5 : 3;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(p.x, p.y); ctx.stroke();

      const comp = s.comp;
      const fill = comp ? (comp.online ? '#1a2138' : '#3a1a1a') : '#141a2c';
      const ink = comp ? comp.part.color : '#3f4a70';
      R.circle(p.x, p.y, GARAGE_UI.SOCKET_R, fill, on ? CONFIG.COLOR.yellow : ink,
        on ? 6 : 4);
      if (comp) {
        const w = comp.part.name.split(' ')[0];
        R.smallText(w, p.x, p.y + 6,
          R.fitText(w, 18, GARAGE_UI.SOCKET_R * 1.8),
          comp.online ? comp.part.color : CONFIG.COLOR.red, 'center');
        if (!comp.online) {
          R.smallText('OFF', p.x, p.y + 26, 15, CONFIG.COLOR.red, 'center');
        }
      } else {
        R.smallText('+', p.x, p.y + 9, 30, '#3f4a70', 'center');
      }
    });

    // 5.4 THE RECOIL VECTOR. Drawn from the core, pointing the way the machine
    // gets shoved when everything fires at once. Opposite mounts cancel and
    // the arrow shrinks to nothing, which is the thing to notice.
    const rv = GarageCalc.recoilVector(this.player);
    if (rv.total > 0) {
      const scale = Math.min(150, rv.mag / Math.max(1, rv.total) * 150);
      const len = rv.mag > 0.001 ? scale : 0;
      const ux = rv.mag > 0.001 ? rv.x / rv.mag : 0;
      const uy = rv.mag > 0.001 ? rv.y / rv.mag : 0;
      if (len > 4) {
        ctx.strokeStyle = CONFIG.COLOR.magenta;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + ux * len, c.y + uy * len);
        ctx.stroke();
        R.circle(c.x + ux * len, c.y + uy * len, 11, CONFIG.COLOR.magenta,
          CONFIG.COLOR.ink, 3);
      }
      const balance = 1 - rv.mag / rv.total;
      // Sits just above the readout panel, derived from it, so the two can
      // never overlap at a screen size nobody tested.
      R.smallText('NET RECOIL  ' + (rv.mag).toFixed(0) +
        '   (' + (balance * 100).toFixed(0) + '% CANCELLED)',
        c.x, this._readoutRect().y - 22, 21,
        balance > 0.8 ? CONFIG.COLOR.lime : CONFIG.COLOR.magenta, 'center');
    }
  }

  _paneTop() { return Display.safe.top + 130; }

  _drawStorage() {
    const s = Display.safe;
    const x = s.left + (s.right - s.left) * 0.55;
    const w = (s.right - s.left) * 0.42;
    const y0 = this._paneTop();
    const list = this.storage();

    R.smallText('STORAGE  —  ' + GARAGE_UI.FILTERS[this.filter] +
      '  •  BY ' + GARAGE_UI.SORTS[this.sort] + '  (' + list.length + ')',
      x, y0 - 14, 24,
      this.pane === 1 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);

    if (!list.length) {
      R.smallText('NOTHING BANKED. BRING SOMETHING HOME.', x, y0 + 50, 24,
        CONFIG.COLOR.steel);
      return;
    }
    for (let i = 0; i < GARAGE_UI.ROWS; i++) {
      const idx = this.listTop + i;
      if (idx >= list.length) break;
      const id = list[idx];
      const p = PARTS[id];
      const y = y0 + 12 + i * GARAGE_UI.ROW_H;
      const on = this.pane === 1 && idx === this.listIdx;
      R.ctx.fillStyle = on ? '#2c3a66' : '#161d31';
      R.ctx.fillRect(x, y, w, GARAGE_UI.ROW_H - 8);
      if (on) {
        R.ctx.strokeStyle = CONFIG.COLOR.yellow; R.ctx.lineWidth = 4;
        R.ctx.strokeRect(x, y, w, GARAGE_UI.ROW_H - 8);
      }
      const grade = Rack.best(id);
      R.smallText(p.name, x + 14, y + 25, 24, p.color);
      R.smallText('PWR ' + (p.powerCost || 0) + '   WT ' + (p.loadCost || 0) +
        '   ' + (grade || '') + (this._isNew(id) ? '   • NEW' : ''),
        x + 14, y + 47, 18,
        this._isNew(id) ? CONFIG.COLOR.lime : CONFIG.COLOR.steel);
    }
  }

  // The live cost of what you are about to do (5.2). Always on screen, in
  // every tab, because the decision is always about these three numbers.
  _readoutRect() {
    const s = Display.safe;
    return { x: s.left + 40, y: s.bottom - 340,
             w: (s.right - s.left) * 0.46, h: 172 };
  }

  _drawReadout() {
    const p = this.player;
    const rr = this._readoutRect();
    const x = rr.x, y = rr.y, w = rr.w;
    R.ctx.fillStyle = '#11162a';
    R.ctx.fillRect(x, y, w, 172);
    R.ctx.strokeStyle = '#232b44'; R.ctx.lineWidth = 3;
    R.ctx.strokeRect(x, y, w, 172);

    const used = p.powerUsed || 0, cap = p.powerCap || p.power || 0;
    const over = (p.powerDemand || 0) - cap;
    R.smallText('POWER', x + 16, y + 30, 22, CONFIG.COLOR.steel);
    R.smallText(used + ' / ' + cap + (over > 0 ? '   SHORT BY ' + over : ''),
      x + 150, y + 30, 24, over > 0 ? CONFIG.COLOR.red : CONFIG.COLOR.cyan);
    const off = GarageCalc.offline(p);
    if (off.length) {
      R.smallText('OFF: ' + off.map(c => c.part.name.split(' ')[0]).join(', '),
        x + 150, y + 52, 17, CONFIG.COLOR.red);
    }

    const secs = GarageCalc.secondsToOverheat(p);
    R.smallText('HEAT', x + 16, y + 88, 22, CONFIG.COLOR.steel);
    R.smallText(secs === Infinity ? 'NEVER OVERHEATS'
      : secs.toFixed(1) + 's OF FIRE BEFORE OVERHEAT',
      x + 150, y + 88, 24,
      secs === Infinity ? CONFIG.COLOR.lime
        : secs < 3 ? CONFIG.COLOR.red : CONFIG.COLOR.yellow);

    const band = GarageCalc.loadBand(p);
    R.smallText('WEIGHT', x + 16, y + 140, 22, CONFIG.COLOR.steel);
    R.smallText((p.loadUsed || 0) + ' / ' + (p.loadCapEff || p.loadCap || 0) +
      '   MOVE ' + Math.round(band.move * 100) + '%' +
      '   DASH ' + Math.round(band.dash * 100) + '%' +
      (band.label ? '   ' + band.label : ''),
      x + 150, y + 140, 24,
      band.label ? CONFIG.COLOR.orange : CONFIG.COLOR.lime);
  }

// ---- PAINT (Block 12) ---------------------------------------------------
  //
  // Two panes, the same shape as GADGETS next door, because they are the same
  // decision: pick a place on the left, pick a thing on the right. A player
  // who has learned one of these screens should not have to learn a third.
  //
  // LEFT   the four slots — BODY, TRIM, METAL, DARK — with what is on each.
  // RIGHT  every colour you actually own, grouped by set.
  //
  // MAGNET on a filled slot resets it to AS FOUND, which is not the same as
  // painting it a dark colour and is the whole of `perSlotReset: true`.
  // SPECIAL randomises, through Paint.randomise, which excludes the trophy set
  // so a roll can never hand you a boss colour you have not earned.
  _paintSlots() {
    return (typeof PAINT_SLOTS !== 'undefined')
      ? PAINT_SLOTS : ['body', 'trim', 'metal', 'dark'];
  }

  _paintPalette() {
    if (typeof Paint === 'undefined') return [];
    return Paint.available();
  }

  // THE PALETTE, GROUPED THE WAY IT READS.
  //
  // A flat list of 64 swatches walked by index is a paint chart. The sets are
  // the units a player thinks in — WORKS is the one you start with, FOUNDRY is
  // the Crucible, PROTOTYPE is the trophies — so UP AND DOWN CHANGE SET and
  // left and right walk the colours inside one. Left off the first colour is
  // the way back to the slots, which is the same gesture the MACHINE tab uses
  // to get out of storage.
  _paintSets() {
    const pal = this._paintPalette();
    const out = [];
    for (const c of pal) {
      const last = out[out.length - 1];
      if (last && last.id === c.set) last.colours.push(c);
      else out.push({ id: c.set, colours: [c] });
    }
    return out;
  }

  _updatePaint(fresh, m) {
    if (typeof Paint === 'undefined') return;
    const slots = this._paintSlots();
    const sets = this._paintSets();
    if (this.slot >= slots.length) this.slot = 0;
    if (this.paintSet === undefined) this.paintSet = 0;
    if (sets.length) this.paintSet = Math.min(this.paintSet, sets.length - 1);
    const inSet = sets.length ? sets[this.paintSet].colours : [];
    if (this.listIdx >= inSet.length) this.listIdx = 0;

    if (fresh) {
      if (Math.abs(m.dy) > Math.abs(m.dx)) {
        const d = m.dy > 0 ? 1 : -1;
        if (this.pane === 0) {
          this.slot = (this.slot + d + slots.length) % slots.length;
        } else if (sets.length) {
          this.paintSet = (this.paintSet + d + sets.length) % sets.length;
          this.listIdx = Math.min(this.listIdx, sets[this.paintSet].colours.length - 1);
        }
      } else if (Math.abs(m.dx) > 0.6) {
        if (this.pane === 0) { if (m.dx > 0) this.pane = 1; }
        else if (m.dx < 0 && this.listIdx === 0) this.pane = 0;
        else if (inSet.length) {
          this.listIdx = Math.max(0, Math.min(inSet.length - 1,
            this.listIdx + (m.dx > 0 ? 1 : -1)));
        }
      }
      this._rep = GARAGE_UI.REPEAT;
    }

    if (Controls.magnet.justPressed) {
      const who = this._vehicle();
      const sid = slots[this.slot];
      if (this.pane === 0) {
        // MAGNET on a painted slot puts it back to AS FOUND. That is
        // `perSlotReset: true`, and it is not the same as painting it a dark
        // colour: an unpainted panel is whatever the part is, and the drawing
        // code decides what that looks like.
        if (Paint.slot(who, sid) !== null) {
          Paint.reset(who, sid);
          this._toast(sid.toUpperCase() + ' — AS FOUND');
        } else {
          this.pane = 1;
          this._toast('PICK A COLOUR');
        }
        return;
      }
      if (!inSet.length) {
        this._toast('NO COLOURS YET. THEY ARE FOUND, NEVER BOUGHT.');
        return;
      }
      const c = inSet[Math.min(this.listIdx, inSet.length - 1)];
      if (Paint.setSlot(who, sid, c.hex)) {
        this._toast(sid.toUpperCase() + ' — ' + this._colourName(c));
      } else {
        this._toast('THAT COLOUR IS NOT YOURS');
      }
    }
    if (Controls.special && Controls.special.justPressed) {
      if (Paint.randomise(this._vehicle())) this._toast('ROLLED');
      else this._toast('NOT ENOUGH COLOURS TO ROLL');
    }
  }

  // 'candyMagenta' reads as CANDY MAGENTA. The ids are camelCase because they
  // are keys, and a player should never see a key.
  _colourName(c) {
    return String(c.id).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toUpperCase();
  }

  _drawPaint() {
    const s = Display.safe;
    const ctx = R.ctx;
    const who = this._vehicle();
    const slots = this._paintSlots();
    const sets = this._paintSets();
    // R.smallText's baseline is TOP, so a heading placed a comfortable-looking
    // 16px above a box renders INSIDE it. Every heading here sits a full line
    // clear, and the two-line header runs TITLE ON TOP: the first draft put
    // the caveat above the title and the screen read as a warning with a name
    // under it.
    const lx = s.left + 60, ly = this._paneTop() + 70, lw = 470, rh = 88;

    R.smallText('PAINT  —  ' + this._vehicleName(),
      lx, ly - 70, 24, this.pane === 0 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    // WHAT THE PLAYER ACTUALLY HAS. This said EMISSIVE PARTS ARE NEVER
    // PAINTED, which is section 18's rule and is a promise this build does
    // not keep: NO part in the game is flagged emissive, so Paint.paintable
    // has never had anything to enforce. A screen stating a protection that
    // does not exist is worse than one saying nothing.
    //
    // What IS true, and checked by tools/paintcheck.js over every colour in
    // every set: the paint takes the part's brightness and gives it your
    // hue, and no colour in the palette can put you in enemy red.
    // AND THE EMISSIVE RULE IS TRUE AGAIN. The screen said this once and it
    // was a promise the build did not keep -- no part carried the flag -- so
    // it was replaced with the guarantee that WAS true. Aaron named what
    // glows on 7 September and fifteen parts carry it now, so the screen can
    // say the whole thing.
    R.smallText('COSMETIC ONLY  —  THE GLOW IS NEVER PAINTED, AND NO PAINT READS RED',
      lx, ly - 40, 20, CONFIG.COLOR.grid);

    slots.forEach((sid, i) => {
      const y = ly + i * (rh + 12);
      const on = this.pane === 0 && i === this.slot;
      ctx.fillStyle = on ? '#2c3a66' : '#1a2138';
      ctx.fillRect(lx, y, lw, rh);
      ctx.strokeStyle = on ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel;
      ctx.lineWidth = on ? 5 : 3;
      ctx.strokeRect(lx, y, lw, rh);
      const hex = Paint.slot(who, sid);
      // THE SWATCH IS THE READOUT. A hex string is not a colour to anybody.
      ctx.fillStyle = hex || '#232b44';
      ctx.fillRect(lx + 14, y + 16, 56, rh - 32);
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 4;
      ctx.strokeRect(lx + 14, y + 16, 56, rh - 32);
      R.smallText(sid.toUpperCase(), lx + 90, y + 18, 26,
        hex ? CONFIG.COLOR.cyan : '#5a6890');
      // NOT CONFIG.COLOR.grid. It is #1d2540 and the box under it is #1a2138:
      // three points of luminance apart, which is not a dim label, it is an
      // invisible one. The GADGETS tab next door had been printing its power
      // figures into the same void since Block 11 and nobody could have known
      // from a test, because the text IS drawn and the code IS correct.
      R.smallText(hex ? this._hexName(hex) : 'AS FOUND', lx + 90, y + 52, 20,
        hex ? CONFIG.COLOR.steel : '#5a6890');
    });

    // ---- the palette ------------------------------------------------------
    const rx = s.left + (s.right - s.left) * 0.55;
    const total = sets.reduce((a, b) => a + b.colours.length, 0);
    R.smallText('COLOURS YOU OWN  —  ' + total,
      rx, ly - 70, 24, this.pane === 1 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    if (!total) {
      R.smallText('NONE YET. SETS ARE FOUND, EARNED OR GIVEN.',
        rx, ly - 40, 20, CONFIG.COLOR.steel);
      return;
    }
    R.smallText('UP AND DOWN CHANGE SET', rx, ly - 40, 20, CONFIG.COLOR.grid);

    // ONE y, WALKED. The first version tracked a row index and advanced it
    // both for the set label and for the wrap, so every set left a band of
    // empty screen under it and the palette ran off the bottom with twenty
    // colours in it. A layout that counts rows cannot see that; a still can.
    const sw = GARAGE_UI.PAINT_SW, cols = GARAGE_UI.PAINT_COLS;
    let y = ly;
    for (let si = 0; si < sets.length; si++) {
      const set = sets[si];
      const onSet = this.pane === 1 && si === this.paintSet;
      if (y > s.bottom - 260) break;
      R.smallText(((COLOUR_SETS[set.id] || {}).name || set.id).toUpperCase(),
        rx, y, 19, onSet ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
      y += 26;
      set.colours.forEach((c, ci) => {
        const col = ci % cols, row = Math.floor(ci / cols);
        const x = rx + col * (sw + 10);
        const sy = y + row * (sw + 10);
        if (sy > s.bottom - 230) return;
        const on = onSet && ci === this.listIdx;
        ctx.fillStyle = c.hex;
        ctx.fillRect(x, sy, sw, sw);
        ctx.strokeStyle = on ? CONFIG.COLOR.yellow : CONFIG.COLOR.ink;
        ctx.lineWidth = on ? 6 : 3;
        ctx.strokeRect(x, sy, sw, sw);
      });
      y += Math.ceil(set.colours.length / cols) * (sw + 10) + 18;
    }

    const cur = sets[this.paintSet] &&
      sets[this.paintSet].colours[Math.min(this.listIdx,
        sets[this.paintSet].colours.length - 1)];
    if (cur) {
      R.smallText(this._colourName(cur) + '  —  ' +
        ((COLOUR_SETS[cur.id] || {}).name || cur.set).toUpperCase(),
        rx, s.bottom - 210, 24, CONFIG.COLOR.cyan);
    }
  }

  // The name of a colour, found by its hex, so the slot list can say
  // CANDY CYAN rather than #22d9ff.
  _hexName(hex) {
    if (typeof COLOUR_SETS === 'undefined') return hex;
    for (const sid of Object.keys(COLOUR_SETS)) {
      const cs = COLOUR_SETS[sid].colours || {};
      for (const cid of Object.keys(cs)) {
        if (cs[cid] === hex) return this._colourName({ id: cid });
      }
    }
    return hex;
  }

  _vehicleName() {
    if (typeof Rigs === 'undefined') return 'YOUR MACHINE';
    const id = Rigs.dockedId();
    if (id && typeof RIGS !== 'undefined' && RIGS[id]) return RIGS[id].name;
    return Rigs.core ? Rigs.core().name : 'CORE';
  }


  // ---- SKILLS (Block 9) ---------------------------------------------------
  //
  // The THIRD time this project has found a whole block with no way in.
  // Block 10's spine and Block 11's gadget bay had no screen; Block 12's paint
  // shop had no screen; and Block 9 built forty levels, four branches, fifty
  // effect keys that the machine really reads, and `Skills.take` — the only
  // function that spends a point — was called by NOTHING.
  //
  // XP was wired last run. So without this tab the player now earns levels
  // they can watch tick up and cannot spend, which is worse than the silence
  // before it.
  //
  // LEFT the four branches with what is spent in each. RIGHT the nodes of the
  // selected branch, in tier order, with the gate written out. Same two-pane
  // shape as GADGETS and PAINT, because it is the same decision again.
  _branchRows() {
    if (typeof SKILL_BRANCHES === 'undefined') return [];
    return SKILL_BRANCHES.map(b => ({ id: b, spent: Skills.spent(b) }));
  }

  // The nodes of one branch, tier order, with a header row before each tier so
  // the GATE is on screen next to the thing it gates. A gate the player has to
  // infer from a refusal is a gate they meet by being refused.
  _branchNodes(branch) {
    if (typeof SKILLS === 'undefined') return [];
    const order = ['t1', 't2', 't3', 'deep'];
    const out = [];
    for (const t of order) {
      const ids = Object.keys(SKILLS).filter(
        k => SKILLS[k].branch === branch && SKILLS[k].tier === t);
      if (!ids.length) continue;
      const T = SKILL_TIERS[t];
      out.push({ header: true, tier: t, need: T.need, cost: T.cost });
      for (const id of ids) out.push({ id });
    }
    return out;
  }

  _updateSkills(fresh, m) {
    if (typeof Skills === 'undefined') return;
    const rows = this._branchRows();
    if (!rows.length) return;
    if (this.skillBranch === undefined) this.skillBranch = 0;
    this.skillBranch = Math.min(this.skillBranch, rows.length - 1);
    const nodes = this._branchNodes(rows[this.skillBranch].id)
      .filter(n => !n.header);
    if (this.listIdx >= nodes.length) this.listIdx = 0;

    if (fresh) {
      if (Math.abs(m.dy) > Math.abs(m.dx)) {
        const d = m.dy > 0 ? 1 : -1;
        if (this.pane === 0) {
          this.skillBranch = (this.skillBranch + d + rows.length) % rows.length;
          this.listIdx = 0;
        } else if (nodes.length) {
          this.listIdx = (this.listIdx + d + nodes.length) % nodes.length;
        }
      } else if (Math.abs(m.dx) > 0.6) {
        this.pane = m.dx > 0 ? 1 : 0;
      }
      this._rep = GARAGE_UI.REPEAT;
    }

    if (Controls.magnet.justPressed) {
      if (this.pane === 0) { this.pane = 1; this._toast('PICK A SKILL'); return; }
      if (!nodes.length) return;
      const id = nodes[Math.min(this.listIdx, nodes.length - 1)].id;
      // THE REFUSAL COMES FROM Skills.why, so the prompt and the rule are one
      // sentence. "You cannot afford it" and "you have not gone deep enough"
      // are different problems and the player needs the right one.
      const why = Skills.why(id);
      if (why) { this._toast(why.toUpperCase()); return; }
      Skills.take(id);
      // The tree changes the MACHINE, so the machine is rebuilt and the three
      // readouts under this screen move the moment a point is spent. A skill
      // that only takes effect next time you drive out is a skill the player
      // cannot feel themselves buy.
      Machine.recalcPower(this.player);
      Machine.recalcStats(this.player);
      this._refresh();
      this._toast(SKILLS[id].name + '  ' + Skills.rank(id) + '/' +
                  Skills.maxRank(id));
    }
  }

  _drawSkills() {
    const s = Display.safe;
    const ctx = R.ctx;
    const rows = this._branchRows();
    const lx = s.left + 60, ly = this._paneTop() + 70, lw = 430, rh = 78;

    // R.smallText's baseline is TOP, so every heading sits a full line clear.
    const lvl = Levels.level(), cap = Levels.max();
    R.smallText('LEVEL ' + lvl + ' OF ' + cap + '   —   ' + Skills.available() +
      ' POINTS UNSPENT', lx, ly - 70, 24,
      Skills.available() > 0 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    // WHY THE CAP IS 25, said on the screen where a player would otherwise
    // think the bar had stopped working. A ceiling with no explanation reads
    // as the end of the game.
    R.smallText(Levels.expanded()
      ? 'NO RESPEC. EVERY POINT IS A CHOICE.'
      : 'CAP ' + cap + ' UNTIL THE EXPANSION DISTRICTS. NO RESPEC.',
      lx, ly - 40, 20, CONFIG.COLOR.grid);

    rows.forEach((r, i) => {
      const y = ly + i * (rh + 10);
      const on = i === this.skillBranch;
      ctx.fillStyle = on ? (this.pane === 0 ? '#2c3a66' : '#222c4e') : '#1a2138';
      ctx.fillRect(lx, y, lw, rh);
      ctx.strokeStyle = on ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel;
      ctx.lineWidth = on ? 5 : 3;
      ctx.strokeRect(lx, y, lw, rh);
      R.smallText(r.id.toUpperCase(), lx + 16, y + 16, 26,
        r.spent > 0 ? CONFIG.COLOR.cyan : '#5a6890');
      // SPENT, AND THE NEXT GATE. The number on its own is a score; the number
      // beside what it opens is a decision.
      const nextGate = [SKILL_TIERS.t2.need, SKILL_TIERS.t3.need,
                        SKILL_TIERS.deep.need].find(n => r.spent < n);
      R.smallText(r.spent + ' SPENT' +
        (nextGate === undefined ? '   ALL TIERS OPEN'
                                : '   NEXT TIER AT ' + nextGate),
        lx + 16, y + 48, 19, CONFIG.COLOR.steel);
    });

    // ---- the nodes --------------------------------------------------------
    // 0.48 AND NOT 0.44. The POWER/HEAT/WEIGHT readout under this screen is
    // 880 wide from the left margin, so a column starting at 0.44 runs its
    // last two rows underneath it -- SALVAGE RIGHT read as 'GE RIGHT' in the
    // first still. Nine nodes and four tier headers have to fit between the
    // heading and the hint row, so the rows are sized to that rather than to
    // what looked comfortable.
    const rx = s.left + (s.right - s.left) * 0.48;
    const branch = rows[this.skillBranch].id;
    R.smallText(branch.toUpperCase(), rx, ly - 70, 24,
      this.pane === 1 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    R.smallText('MAGNET BUYS A RANK', rx, ly - 40, 20, CONFIG.COLOR.grid);

    const all = this._branchNodes(branch);
    let y = ly, idx = 0;
    for (const row of all) {
      if (y > s.bottom - 190) break;
      if (row.header) {
        const open = Skills.spent(branch) >= row.need;
        R.smallText(
          (row.tier === 'deep' ? 'DEEP PICK' : row.tier.toUpperCase()) +
          '   ' + row.cost + 'pt A RANK' +
          (row.need ? '   NEEDS ' + row.need + ' IN ' + branch.toUpperCase() : ''),
          rx, y, 19, open ? CONFIG.COLOR.lime : CONFIG.COLOR.orange);
        y += 24;
        continue;
      }
      const id = row.id, S = SKILLS[id];
      const on = this.pane === 1 && idx === this.listIdx;
      const rank = Skills.rank(id), maxR = Skills.maxRank(id);
      const h = 58;
      ctx.fillStyle = on ? '#2c3a66' : '#1a2138';
      ctx.fillRect(rx, y, 760, h);
      ctx.strokeStyle = on ? CONFIG.COLOR.yellow
        : (rank > 0 ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel);
      ctx.lineWidth = on ? 5 : 3;
      ctx.strokeRect(rx, y, 760, h);
      R.smallText(S.name, rx + 14, y + 10, 24,
        rank > 0 ? CONFIG.COLOR.cyan : '#8fa3c8');
      // CLIPPED TO THE ROW. CLEAN PULL's description is eighty characters --
      // it is the deep pick and it has the most to say -- and it ran out of
      // its own box, through the rank readout and under the BACK button. A
      // clip is exact where a character budget is a guess that goes wrong the
      // first time somebody writes a longer sentence.
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx + 8, y, 760 - 130, h);
      ctx.clip();
      R.smallText(S.desc || '', rx + 14, y + 34, 18, CONFIG.COLOR.steel);
      ctx.restore();
      // THE RANK, AND WHY NOT. Never a bare "locked": the refusal names the
      // thing that would fix it, which is B.2's rule for barriers and is the
      // same rule here.
      const why = Skills.why(id);
      R.smallText(rank + '/' + maxR, rx + 760 - 14, y + 10, 24,
        rank >= maxR ? CONFIG.COLOR.lime : CONFIG.COLOR.yellow, 'right');
      R.smallText(why ? why.toUpperCase() : Skills.cost(id) + 'pt',
        rx + 760 - 14, y + 38, 18,
        why ? (why === 'maxed' ? CONFIG.COLOR.lime : CONFIG.COLOR.orange)
            : CONFIG.COLOR.lime, 'right');
      y += h + 6;
      idx++;
    }
  }

  _drawGadgets() {
    const s = Display.safe;
    const slots = Math.max(1, Gadgets.slots());
    // TWO HEADER LINES, so the panes start LOWER than the permanents tab's
    // one. The first version reused +20 and the power line sat on top of the
    // slot heading, which sat on top of the first slot — three pieces of text
    // in the same forty pixels. Found in a still, which is where every
    // overlap on this project has been found.
    const lx = s.left + 60, ly = this._paneTop() + 62, lw = 470, rh = 92;
    // R.smallText's baseline is TOP, so a 24pt line placed 16px above a box
    // renders 8px INSIDE it. That is why every heading on this screen sits a
    // full line-height clear rather than a comfortable-looking gap.
    R.smallText('GADGET BAY  —  ' + Gadgets.fitted().length + ' OF ' + slots,
      lx, ly - 34, 24,
      this.pane === 0 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    // THE COST, ON THE SCREEN WHERE IT IS PAID. A gadget draws off the same
    // budget the modules spend from, and a player who only finds that out by
    // watching a weapon go dark has been ambushed by their own build.
    R.smallText('THEY COST POWER — ' + Gadgets.powerDraw() + ' DRAWN',
      lx, ly - 62, 20, Gadgets.powerDraw() > 0 ? CONFIG.COLOR.orange
                                               : CONFIG.COLOR.grid);
    const fitted = Gadgets.fitted();
    for (let i = 0; i < slots; i++) {
      const y = ly + i * (rh + 12);
      const on = this.pane === 0 && i === this.slot;
      R.ctx.fillStyle = on ? '#2c3a66' : '#1a2138';
      R.ctx.fillRect(lx, y, lw, rh);
      R.ctx.strokeStyle = on ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel;
      R.ctx.lineWidth = on ? 5 : 3;
      R.ctx.strokeRect(lx, y, lw, rh);
      const id = fitted[i];
      if (id) {
        R.smallText(GADGETS[id].name || id, lx + 16, y + 38, 26,
          CONFIG.COLOR.cyan);
        R.smallText(GADGETS[id].power + ' POWER', lx + 16, y + 68, 19,
          CONFIG.COLOR.steel);
      } else R.smallText('EMPTY', lx + 16, y + 44, 26, '#5a6890');
    }

    const rx = s.left + (s.right - s.left) * 0.55;
    R.smallText('FOUND', rx, ly - 34, 24,
      this.pane === 1 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    const owned = Object.keys(Progress.gadgets || {})
      .filter(g => GADGETS[g]).sort();
    if (!owned.length) {
      R.smallText('NONE YET. THEY ARE FOUND, NEVER BOUGHT.', rx, ly + 30, 22,
        CONFIG.COLOR.steel);
    }
    owned.forEach((id, i) => {
      const y = ly + i * (rh + 12);
      if (y > s.bottom - 340) return;
      const on = this.pane === 1 && i === this.listIdx;
      const isOn = Gadgets.isFitted(id);
      R.ctx.fillStyle = on ? '#2c3a66' : '#1a2138';
      R.ctx.fillRect(rx, y, 620, rh);
      R.ctx.strokeStyle = on ? CONFIG.COLOR.yellow
        : (isOn ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel);
      R.ctx.lineWidth = on ? 5 : 3;
      R.ctx.strokeRect(rx, y, 620, rh);
      R.smallText((GADGETS[id].name || id) + '  ' +
        (Progress.gadgets[id] > 1 ? Progress.gadgets[id] : ''),
        rx + 16, y + 34, 26, isOn ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel);
      // A TRAVERSAL GADGET IS A KEY, NOT A BUTTON, and the screen says so
      // rather than letting a player fit a drill and wonder why nothing
      // happens when they press it.
      R.smallText(GADGETS[id].gate
        ? 'OPENS THE MAP — NO SLOT NEEDED'
        : (isOn ? 'FITTED' : GADGETS[id].power + ' POWER'),
        rx + 16, y + 66, 19,
        GADGETS[id].gate ? CONFIG.COLOR.lime : CONFIG.COLOR.steel);
    });
  }

  _drawPermanents() {
    const s = Display.safe;
    const v = this._vehicle();
    const cap = Permanents.slotCap(v), have = Permanents.slotCount(v);
    // R.smallText's baseline is TOP: a 24pt heading placed 16px above a box
    // renders 8px INSIDE it. Both headings on this tab were doing it and the
    // gadget tab inherited the fault by being copied from here.
    // 620 RATHER THAN THE 470 EVERY OTHER TAB USES. This one carries three
    // things on two rows -- the name, what the gun IS, and both ladders --
    // and at 470 the skill readout printed straight through the character
    // line. Found in a still, like every overlap on this project.
    const lx = s.left + 60, ly = this._paneTop() + 62, lw = 620, rh = 92;
    R.smallText('SLOTS  —  ' + have + ' OF ' + cap + ' EARNED', lx, ly - 34, 24,
      this.pane === 0 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    R.smallText('NO POWER. NEVER SHOT OFF. HEAT IS THE ONLY BRAKE.',
      lx, ly - 62, 20, CONFIG.COLOR.grid);
    const fitted = Permanents.fitted(v);
    for (let i = 0; i < Math.max(1, cap); i++) {
      const y = ly + i * (rh + 12);
      const earned = i < have;
      const on = this.pane === 0 && i === this.slot && earned;
      R.ctx.fillStyle = earned ? (on ? '#2c3a66' : '#1a2138') : '#141a2c';
      R.ctx.fillRect(lx, y, lw, rh);
      R.ctx.strokeStyle = on ? CONFIG.COLOR.yellow
        : (earned ? CONFIG.COLOR.steel : '#232b44');
      R.ctx.lineWidth = on ? 5 : 3;
      R.ctx.strokeRect(lx, y, lw, rh);
      if (!earned) {
        const src = PERM.SLOT_SOURCES[i];
        R.smallText('LOCKED', lx + 16, y + 34, 24, '#5a6890');
        R.smallText(src ? src.why.toUpperCase() : 'MORE TO FIND', lx + 16, y + 64,
          19, '#3f4a70');
        continue;
      }
      const id = fitted[i];
      if (id) {
        R.smallText(Permanents.part(id).name, lx + 16, y + 38, 26,
          Permanents.part(id).color);
        // CLIPPED, because the skill readout shares this row and prose does
        // not stop where a box does.
        const ch = WEAPON_VARIANTS[id].character.toUpperCase();
        R.smallText(ch.length > 28 ? ch.slice(0, 27) + '…' : ch,
          lx + 16, y + 68, 19, CONFIG.COLOR.steel);
        // HOW FAR THE SPINE HAS BEEN TAKEN, and what the next rung costs.
        // Block 10 built the ladder and the screen said nothing about it — a
        // ladder you cannot see is a ladder nobody climbs, and the player
        // would have had ten upgrade parts and no idea what they were for.
        if (typeof Spine !== 'undefined') {
          const cls = Spine.classOf(id);
          const n = Spine.step(cls);
          const cap2 = Spine.hasCapstone(id);
          const c2 = Spine.costOf(cls);
          const txt = cap2 ? 'FINISHED'
            : (n >= 3 ? 'CAPSTONE ' + Spine.capstoneCost().scrap + ' + ' +
                        Spine.capstoneCost().parts
                      : 'SPINE ' + n + '/3   NEXT ' + c2.scrap + ' + ' + c2.parts);
          R.smallText(txt, lx + lw - 16, y + 34, 19,
            cap2 ? CONFIG.COLOR.lime : (n > 0 ? CONFIG.COLOR.cyan : '#5a6890'),
            'right');
        }
        // AND THE CLASS SKILL, WHICH IS THE OTHER LADDER AND IS NOT BOUGHT.
        // CONTENT_ECONOMY Part 5: "show the number anyway — people like the
        // number." The spine line above says what you have SPENT; this says
        // what you have EARNED, and putting them on the same row is the only
        // way a player finds out there are two.
        if (typeof WeaponSkill !== 'undefined' && WeaponSkill.rank) {
          const r = WeaponSkill.rank(id);
          const kills = WeaponSkill.of(id);
          R.smallText('SKILL ' + r + '/' + SKILL_B.MAX_RANK + '   ' +
            kills.toLocaleString() + ' KILLS', lx + lw - 16, y + 66, 19,
            r > 0 ? CONFIG.COLOR.lime : '#5a6890', 'right');
        }
      } else R.smallText('EMPTY', lx + 16, y + 44, 26, '#5a6890');
    }

    const rx = s.left + (s.right - s.left) * 0.55;
    R.smallText('FOUND', rx, ly - 34, 24,
      this.pane === 1 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    const owned = Permanents.ownedList();
    if (!owned.length) {
      R.smallText('NONE YET. THEY COME OFF BOSSES AND OUT OF PLACES.', rx, ly + 30,
        22, CONFIG.COLOR.steel);
    }
    owned.forEach((id, i) => {
      const y = ly + i * (rh + 12);
      if (y > s.bottom - 340) return;
      const on = this.pane === 1 && i === this.listIdx;
      const part = Permanents.part(id);
      R.ctx.fillStyle = on ? '#2c3a66' : '#1a2138';
      R.ctx.fillRect(rx, y, 620, rh);
      R.ctx.strokeStyle = on ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel;
      R.ctx.lineWidth = on ? 5 : 3;
      R.ctx.strokeRect(rx, y, 620, rh);
      const inSlot = fitted.indexOf(id);
      R.smallText(part.name, rx + 16, y + 36, 25, part.color);
      R.smallText('DMG ' + part.damage + '   RATE ' + part.fireRate +
        '   HEAT ' + (part.heatPerShot || 0) +
        (inSlot >= 0 ? '   • IN SLOT ' + (inSlot + 1) : ''),
        rx + 16, y + 66, 19,
        inSlot >= 0 ? CONFIG.COLOR.cyan : CONFIG.COLOR.steel);
    });
  }

  _drawPresets() {
    const s = Display.safe;
    const x = s.left + 60, y0 = this._paneTop() + 20, w = 900, rh = 84;
    const list = this._presets();
    R.smallText('SAVED BUILDS', x, y0 - 16, 24, CONFIG.COLOR.yellow);
    R.smallText('A preset only rebuilds what the Rack still owns — stolen ' +
      'hardware stays temporary.', x, y0 - 44, 19, CONFIG.COLOR.grid);
    for (let i = 0; i <= list.length; i++) {
      const y = y0 + i * (rh + 10);
      if (y > s.bottom - 340) break;
      const on = i === this.presetIdx;
      R.ctx.fillStyle = on ? '#2c3a66' : '#1a2138';
      R.ctx.fillRect(x, y, w, rh);
      R.ctx.strokeStyle = on ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel;
      R.ctx.lineWidth = on ? 5 : 3;
      R.ctx.strokeRect(x, y, w, rh);
      if (i === list.length) {
        R.smallText('+ SAVE CURRENT BUILD', x + 16, y + 50, 26, CONFIG.COLOR.lime);
      } else {
        R.smallText(list[i].name, x + 16, y + 34, 25, CONFIG.COLOR.cyan);
        R.smallText(list[i].parts.length + ' PARTS   ' +
          list[i].parts.map(p => (PARTS[p.partId] || { name: '?' }).name.split(' ')[0])
            .slice(0, 6).join(', '),
          x + 16, y + 62, 18, CONFIG.COLOR.steel);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// PRESETS, as data. Kept out of the state class so the save shape and the
// rebuild rule are testable without a screen — and so Block 10's FIELD
// WORKSHOP has something to call.
//
// A preset records ROOT INDEX rather than socket id: socket ids are minted at
// runtime and change every time a Frame is refitted, so a preset keyed on them
// would rebuild onto the wrong sockets the first time you upgraded.
const Presets = {
  capture(player, name) {
    if (!player || !player.sockets) return null;
    const roots = player.sockets
      .filter(s => s.parentId === undefined && !s.permanent)
      .sort((a, b) => a.id - b.id);
    const parts = [];
    // Structure first, so a rebuild has its mounts before it needs them.
    const ordered = player.sockets
      .filter(s => s.comp && !s.permanent)
      .sort((a, b) => {
        const sa = a.comp.part.childSockets ? 0 : 1;
        const sb = b.comp.part.childSockets ? 0 : 1;
        return sa - sb || a.id - b.id;
      });
    for (const s of ordered) {
      // -1 means 'a child socket', which has no stable identity of its own:
      // it is minted by whatever structure part sits on its root, so getting
      // the structure back on the right root puts the children back too.
      parts.push({ partId: s.comp.part.id, root: roots.indexOf(s) });
    }
    if (!parts.length) return null;
    Progress.presets = Progress.presets || [];
    const p = { name: name || ('BUILD ' + (Progress.presets.length + 1)), parts };
    Progress.presets.push(p);
    return p;
  },

  // Rebuilds ONLY what the Rack permanently owns, the same rule
  // Progress.buildMachine's template follows: stolen builds stay temporary.
  load(player, preset) {
    if (!player || !preset) return { placed: 0, missing: 0 };
    Machine.clearAll(player);
    let placed = 0, missing = 0;
    const roots = () => player.sockets
      .filter(s => s.parentId === undefined && !s.permanent)
      .sort((a, b) => a.id - b.id);
    for (const t of preset.parts) {
      if (!Rack.ownsAny(t.partId)) { missing++; continue; }
      // THE RECORDED SOCKET FIRST, for every part, not just structure.
      // Falling back to 'next free socket' for weapons quietly rebuilt a
      // machine with different recoil balance from the one that was saved.
      let sid = null;
      const r = roots();
      if (t.root >= 0 && r[t.root] && !r[t.root].comp) {
        sid = r[t.root].id;
      } else if (PARTS[t.partId] && PARTS[t.partId].childSockets) {
        const free = r.find(k => !k.comp);
        if (!free) { missing++; continue; }
        sid = free.id;
      } else {
        const free = player.sockets.find(k => !k.comp && !k.permanent);
        if (!free) { missing++; continue; }
        sid = free.id;
      }
      if (Machine.attach(player, t.partId, sid) === -1) missing++;
      else placed++;
    }
    Machine.recalcPower(player);
    Machine.recalcStats(player);
    return { placed, missing };
  },
};

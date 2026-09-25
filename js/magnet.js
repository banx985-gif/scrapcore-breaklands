// SCRAPCORE: BREAKLANDS — Magnet system (Milestone 8)
// The signature interaction (plan §21–22). Hold MAGNET to:
//   1. RIP: if a critically-damaged enemy connector is close, tear the part
//      off the living machine (~0.8s channel). Enemy stays alive.
//   2. PULL: otherwise, drag the nearest loose part toward the player.
// While a part is close, the 8 socket targets appear; the socket matching
// the part's bearing is selected (steer by strafing around the part).
// Release to attach: CLANK! — occupied sockets eject their old part intact.

const Magnet = {
  RANGE: 660,          // loose-part acquisition range
  RIP_RANGE: 260,      // must be CLOSE to rip (high risk, plan §22)
  SNAP_SHOW: 470,      // distance at which socket targets appear
  ATTACH_RANGE: 310,   // release inside this = snap in
  HOLD_DIST: 165,      // held part hovers at this ring around the player
  RIP_TIME: 0.8,

  held: null,          // LooseParts item currently magnetized
  ripSocket: null,     // { ent, socket } currently being ripped
  ripT: 0,
  selectedSocket: -1,

  reset() {
    this.held = null;
    this.ripSocket = null;
    this.ripT = 0;
    this.selectedSocket = -1;
  },

  update(dt, player, enemies) {
    // Held item may have been recycled by the loose-part cap.
    if (this.held && !LooseParts.items.includes(this.held)) this.held = null;

    if (!Controls.magnet.pressed) {
      this._release(player);
      return;
    }

    if (!this.held) {
      // --- RIP takes priority when a weakened joint is in reach ---
      // MAGNET REACH, at the one place the reach is used.
      const reach = this.RIP_RANGE * (player.magnetRangeMul || 1) *
        (typeof Skills !== 'undefined' ? Skills.mul('magnetRangeMul') : 1);
      const rip = this._findRipTarget(player, enemies, reach);
      if (rip) {
        if (this.ripSocket && this.ripSocket.socket === rip.socket) {
          // RIP LINE (M14 Harpoon Mastery 10): a harpooned critical
          // connector rips in half the time while the mark lasts.
          const ripLine = rip.socket.comp && rip.socket.comp._ripLineT > 0 ? 2 : 1;
          // RECLAIMER MAGNET (§22): RIP-ready connector rip time -50% —
          // ripTimeMul 0.5 makes the SAME accumulator run twice as fast.
          // QUICK HANDS: less time exposed with a part half-torn.
          this.ripT += dt * (player.ripSpeedMul || 1) * ripLine *
            (typeof Skills !== 'undefined' ? Skills.mul('ripSpeedMul') : 1) /
            (player.ripTimeMul || 1);
          if (this.ripT >= this.RIP_TIME) this._completeRip(player);
        } else {
          this.ripSocket = rip;
          this.ripT = 0;
          // RIP STAGE 1: the magnet bites.
          if (typeof Audio_ !== 'undefined') Audio_.play('ripGrab');
        }
        // RIP STAGE 2: the strain, retriggered while you hold it. "MUST sound
        // like it might fail. Long enough to be frightening. This is the
        // point." The riskiest thing in the game had no voice at all.
        if (typeof Audio_ !== 'undefined') Audio_.play('ripStrain');
        return;
      }
      this.ripSocket = null;
      this.ripT = 0;

      // --- otherwise acquire nearest loose part ---
      if (typeof Tutorial !== 'undefined' && LooseParts.items.length) {
        Tutorial.did('magnet');
      }
      this.held = LooseParts.nearest(player.x, player.y,
        this.RANGE * (player.magnetRangeMul || 1));
      if (!this.held) return;
    }

    this._pull(dt, player);
  },

  _findRipTarget(player, enemies, range) {
    let best = null, bestD = range || this.RIP_RANGE;
    for (const e of enemies) {
      if (!e.alive || !e.sockets) continue;
      for (const s of e.sockets) {
        if (!s.comp) continue;
        // SURE HANDS: "rip an UNDAMAGED connector". Without it the rip is
        // only ever a finisher; with it, it is an opener - which is a
        // different verb, and that is what a deep pick should buy.
        const undam = (typeof Skills !== 'undefined') && Skills.has('ripUndamaged');
        if (!undam &&
            s.comp.connectorHp / s.comp.maxConnectorHp > Machine.RIP_THRESHOLD) continue;
        const cp = Machine.connectorPos(e, s);
        const d = Math.hypot(cp.x - player.x, cp.y - player.y);
        if (d < bestD) { bestD = d; best = { ent: e, socket: s }; }
      }
    }
    return best;
  },

  _completeRip(player) {
    // "You walked up to a live machine and unbolted it."
    if (typeof Radio !== 'undefined') Radio.fire('first_rip');
    // LESSON 3, and the document puts it LAST on purpose: "it requires nerve
    // rather than understanding", and a player who has not yet understood
    // flanking will just die trying it.
    if (typeof Opening !== 'undefined') Opening.learn('rip');
    // RIP STAGE 3: the payoff. Louder than an ordinary break, because you
    // earned this one by standing still next to something that was shooting.
    if (typeof Audio_ !== 'undefined') Audio_.play('ripRelease');
    const { ent, socket } = this.ripSocket;
    const comp = Machine.detach(ent, socket.id);
    this.ripSocket = null;
    this.ripT = 0;
    if (!comp) return;
    // Ripping a part off a LIVING machine is the game's best-case action, so
    // it pays the most XP. Machine.detach already fired no XP for this path.
    if (typeof Unlocks !== 'undefined') Unlocks.event('rip');
    // CORE CHARGE (M12): an intact live rip is +8, a WARDEN component +15 —
    // stealing from the boss is the single best charge in the game (§20).
    if (typeof Mods !== 'undefined') {
      Mods.event(player, ent.isWarden ? 'wardenRip' : 'rip');
      Mods.note('intactRip');
      const p0 = Machine.socketPos(ent, socket);
      if (Math.hypot(player.x - p0.x, player.y - p0.y) < 220) Mods.note('closeRip');
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('connectorBreak', { pitch: 0.8 });
    if (typeof Tutorial !== 'undefined') Tutorial.did('magnet');

    const p = Machine.socketPos(ent, socket);
    const dx = player.x - p.x, dy = player.y - p.y;
    const d = Math.hypot(dx, dy) || 1;

    Effects.comicWord(Math.random() < 0.5 ? 'RIP!' : 'CRACK!', p.x, p.y - 80);
    Effects.ring(p.x, p.y, 110, '#ff3fa4');
    Effects.spark(p.x, p.y, Math.atan2(dy, dx), 14, '#ffd23f', 800);
    Camera.shake(7, 0.18);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);

    // The freed part flies toward the player and is instantly magnet-held.
    this.held = LooseParts.spawn(comp.part.id, comp.hp / comp.maxHp,
      p.x, p.y, dx / d * 520, dy / d * 520);
  },

  _pull(dt, player) {
    const it = this.held;
    const dx = player.x - it.x, dy = player.y - it.y;
    const d = Math.hypot(dx, dy) || 1;

    // Accelerating pull, faster as it closes (plan §21: "accelerates").
    const speed = (520 + (1 - Math.min(d / this.RANGE, 1)) * 1300)
      * (player.magnetPullMul || 1);
    it.vx = dx / d * speed;
    it.vy = dy / d * speed;

    // Hover on a ring at HOLD_DIST so the bearing (= socket pick) is steerable.
    if (d < this.HOLD_DIST) {
      it.x = player.x - dx / d * this.HOLD_DIST;
      it.y = player.y - dy / d * this.HOLD_DIST;
      it.vx = it.vy = 0;
    }

    // Socket selection: bearing from player to the incoming part.
    const bearing = Math.atan2(it.y - player.y, it.x - player.x);
    let bestIdx = -1, bestDiff = Infinity;
    for (const s of player.sockets) {
      let diff = Math.abs(s.angle - bearing) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < bestDiff) { bestDiff = diff; bestIdx = s.id; }
    }
    this.selectedSocket = bestIdx;
  },

  _release(player) {
    if (this.held) {
      const it = this.held;
      const d = Math.hypot(it.x - player.x, it.y - player.y);
      if (d <= this.ATTACH_RANGE && this.selectedSocket >= 0) {
        this._attach(player, it, this.selectedSocket);
      }
      // else: it simply drops where it is, still salvage
    }
    this.held = null;
    this.ripSocket = null;
    this.ripT = 0;
    this.selectedSocket = -1;
  },

  // Nearest empty socket to `from`, measured by angle around the ring so the
  // part appears to slide to the next gap rather than teleport across the rig.
  // A splitter CHILD socket is not offered to a splitter (they cannot nest).
  _nearestFreeSocket(player, from, part) {
    const open = player.sockets.filter(k => !k.comp && k !== from &&
      !(part && part.childSockets && k.parentId !== undefined));
    if (!open.length) return null;
    let best = null, bestD = Infinity;
    for (const k of open) {
      let d = Math.abs(Math.atan2(Math.sin(k.angle - from.angle),
                                  Math.cos(k.angle - from.angle)));
      // Prefer a root socket over a splitter child at the same bearing.
      if (k.parentId !== undefined) d += 0.35;
      if (d < bestD) { bestD = d; best = k; }
    }
    return best;
  },

  _attach(player, item, socketIdx) {
    const s = Machine.getSocket(player, socketIdx);
    if (!s) return;

    // Hard cap 10 modules (plan §15): a full machine can only REPLACE.
    if (!s.comp && player.moduleCount >= (player.maxModules || Machine.MAX_MODULES)) {
      Effects.comicWord('FULL!', player.x, player.y - 140);
      return;
    }

    // Splitters cannot nest into child sockets.
    if (item.part.childSockets && s.parentId !== undefined) {
      Effects.comicWord('NO FIT!', player.x, player.y - 140);
      return;
    }

    // Occupied socket. The rig SHUFFLES to make room: the part already there
    // moves to the nearest free socket rather than being thrown away, because
    // losing a good weapon just for aiming the magnet slightly off is a
    // punishment for a mis-tap, not for a decision. Only a machine with no
    // room left ejects the part it is pushed against (plan §21).
    let replacedOne = false;
    let shuffledTo = -1;   // eslint-friendly: read below in the unlock event
    this.lastShuffleTo = -1;
    if (s.comp) {
      replacedOne = true;
      const moving = s.comp.part;
      const cap = player.maxModules || Machine.MAX_MODULES;
      const canShuffle = !moving.childSockets && player.moduleCount < cap;
      const free = canShuffle ? this._nearestFreeSocket(player, s, moving) : null;
      if (free) {
        // Move it across, keeping its damage and its connector state.
        free.comp = s.comp;
        s.comp = null;
        shuffledTo = free.id;
        this.lastShuffleTo = free.id;   // exposed for tests
        const fp = Machine.socketPos(player, free);
        Effects.ring(fp.x, fp.y, 80, CONFIG.COLOR.yellow);
        Effects.spark(fp.x, fp.y, free.angle, 6, CONFIG.COLOR.yellow, 380);
        if (typeof Audio_ !== 'undefined') Audio_.play('eject', { gain: 0.5 });
      } else {
        const p = Machine.socketPos(player, s);
        const old = Machine.detach(player, s.id);
        if (old) {
          LooseParts.spawn(old.part.id, old.hp / old.maxHp, p.x, p.y,
            Math.cos(s.angle) * 420, Math.sin(s.angle) * 420);
        }
      }
    }

    if (Machine.attach(player, item.part.id, socketIdx) < 0) return;
    // PATCHWORK NODE (§22): a part bolted on IN THE FIELD is tagged here —
    // the one attach path salvage takes — so the Node knows its set.
    {
      const fs = Machine.getSocket(player, socketIdx);
      if (fs && fs.comp) fs.comp.fieldAttached = true;
    }
    if (typeof Mods !== 'undefined') Mods.note('attachSalvage');
    // M2 / Master §15: the salvaged copy keeps its own Grade, and recovering it
    // OFFERS it to the Yard Rack. Offering is not owning — it only becomes
    // permanent when the screen is cleared (RECOVERY SCAN), so carrying good
    // hardware across a screen is a decision you can still lose.
    if (typeof applyGradeToComponent === 'function' && item.gradeId) {
      applyGradeToComponent(s.comp, item.gradeId);
    }
    // Salvage keeps its damage — unless a Salvage Compressor is running,
    // which bolts field salvage on 10 percentage points healthier (Master
    // Utility table). Rack hardware is unaffected; this is FIELD salvage.
    let cond = item.hpFrac;
    for (const k of player.sockets) {
      if (k.comp && k.comp.online && k.comp.part.salvageConditionAdd) {
        cond = Math.min(1, cond + k.comp.part.salvageConditionAdd);
        break;
      }
    }
    s.comp.hp = s.comp.maxHp * cond;
    if (typeof Rack !== 'undefined') {
      if (Rack.isImprovement(item.part.id, item.gradeId || 'G1')) {
        Rack.offer(item.part.id, item.gradeId || 'G1');
        Effects.comicWord('RECOVERY SCAN PENDING', player.x, player.y - 300,
          CONFIG.COLOR.lime, 44);
      }
    }
    LooseParts.remove(item);

    // Bolted on but unpowered? Say so now, not when they wonder why it is
    // silent. Power is a fixed budget, not a resource that recharges.
    if (s.comp && s.comp.online === false) {
      Effects.comicWord('NO POWER!', player.x, player.y - 250, CONFIG.COLOR.red, 92);
      Effects.comicWord('NEEDS A REACTOR', player.x, player.y - 170,
        CONFIG.COLOR.steel, 46);
    }

    // CLANK! — the most important feedback moment in the game (plan §74).
    const p = Machine.socketPos(player, s);
    Effects.comicWord('CLANK!', p.x, p.y - 90);
    Effects.ring(p.x, p.y, 100, CONFIG.COLOR.cyan);
    Effects.spark(p.x, p.y, s.angle, 12, CONFIG.COLOR.cyan, 620);
    if (typeof Unlocks !== 'undefined') {
      const roots = player.sockets.filter(k => k.parentId === undefined);
      if (typeof Tutorial !== 'undefined') Tutorial.did('attach');
      if (typeof Audio_ !== 'undefined') Audio_.play('clank');
      Unlocks.event('partAttached', {
        replaced: !!replacedOne,
        shuffled: shuffledTo >= 0,
        rootsFull: roots.every(k => !!k.comp),
      });
    }
    Camera.shake(5, 0.14);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(28);
  },

  // -------------------------------------------------------------------------
  draw(ctx, player) {
    // Rip channel: stretched connector + progress arc
    if (this.ripSocket) {
      const { ent, socket } = this.ripSocket;
      if (socket.comp) {
        const cp = Machine.connectorPos(ent, socket);
        this._beam(ctx, player, cp.x, cp.y, '#ff3fa4');
        const k = this.ripT / this.RIP_TIME;
        ctx.strokeStyle = '#ff3fa4';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 54, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
        ctx.stroke();
        if (Math.random() < 0.5) {
          Effects.spark(cp.x, cp.y, socket.angle, 1, '#ff3fa4', 420);
        }
        // Name what you are tearing off, same as a carried part.
        const rp = socket.comp.part;
        R.text(rp.name.toUpperCase(), cp.x, cp.y - 84, 28,
          rp.color || CONFIG.COLOR.white);
      }
      return;
    }

    if (!this.held) return;
    const it = this.held;

    // Magnet beam + grabbed highlight
    this._beam(ctx, player, it.x, it.y, CONFIG.COLOR.violet);
    R.circle(it.x, it.y, 58, null, CONFIG.COLOR.violet, 6);

    // NAME THE PART. On a phone the sprite is ~100px and half a dozen parts
    // read alike at a glance, so the player was bolting on things without
    // knowing what they were. The label rides above the part while it is on
    // the beam, tinted with the part's own colour, and carries a condition
    // reading — salvage keeps its damage, and that is worth knowing BEFORE
    // you commit a socket to it.
    {
      const p = it.part;
      const label = p.name.toUpperCase();
      const pct = Math.round((it.hpFrac !== undefined ? it.hpFrac : 1) * 100);
      const ly = it.y - 84;
      R.text(label, it.x, ly, 30, p.color || CONFIG.COLOR.white);
      R.smallText(p.category.toUpperCase() + '  \u2022  ' + pct + '%',
        it.x, ly + 30, 22,
        pct >= 70 ? CONFIG.COLOR.steel
                  : (pct >= 35 ? CONFIG.COLOR.yellow : CONFIG.COLOR.red),
        'center');
    }

    // Socket targets appear when the part is close (plan §21)
    const d = Math.hypot(it.x - player.x, it.y - player.y);
    if (d < this.SNAP_SHOW) {
      for (const s of player.sockets) {
        const p = Machine.socketPos(player, s);
        const sel = s.id === this.selectedSocket;
        if (sel) {
          const pulse = 40 + Math.sin(performance.now() / 90) * 5;
          R.circle(p.x, p.y, pulse, 'rgba(168,232,50,0.25)', CONFIG.COLOR.lime, 7);
          ctx.strokeStyle = CONFIG.COLOR.lime;
          ctx.lineWidth = 5;
          ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.globalAlpha = 0.6;
          R.circle(p.x, p.y, 30, null,
            s.comp ? CONFIG.COLOR.orange : CONFIG.COLOR.steel, 5);
          ctx.globalAlpha = 1;
        }
      }
    }
  },

  _beam(ctx, player, tx, ty, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.setLineDash([16, 12]);
    ctx.lineDashOffset = -(performance.now() / 18) % 28;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  },
};

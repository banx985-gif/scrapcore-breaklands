// SCRAPCORE: BREAKLANDS — YARD 13 (Milestone 2 slice)
// Master v3.2 §14 (Core Forge), §15 (Yard Rack), §17 (Weapon Mastery).
//
// The place between attempts where permanent progress is visible and spendable.
// M2 builds the honest minimum: what you own, what it cost, what it did. The
// full seven-tab Garage is M42 and the Yard 13 story presentation is M20.
//
// The bar this screen has to clear is M2's actual done-when:
//   "the player can articulate what got better and why WITHOUT A TOOLTIP."
// So everything here states a number and its effect in the same line.

class YardState {
  enter() {
    this.msg = null;
    this.msgT = 0;
    this.forgeOpen = false;
    this.labOpen = false;
    this.labWeapon = null;
    this.rigOpen = false;
    this.build();
  }

  onResize() { this.build(); }

  build() {
    const s = Display.safe;
    this.buttons = new UIButtons();

    // ---- CORE FORGE (M11): all ten §14 tracks, on their own panel --------
    // The panel REPLACES the Yard buttons while open, so the pad cursor walks
    // the tracks instead of fighting the Jackrig row underneath it.
    if (this.forgeOpen) {
      this._buildForge(s);
      return;
    }
    if (this.labOpen) {
      this._buildLab(s);
      return;
    }
    if (this.rigOpen) {
      this._buildRig(s);
      return;
    }
    // THE RIGHT-HAND COLUMN, AND WHY IT STARTS HIGHER THAN IT USED TO.
    //
    // At s.top+220 the column ran CORE FORGE / WEAPON LAB / RIG SETUP / DEV
    // down to y=680, and the JACKRIG plate row begins at s.bottom-454 = 626.
    // The DEV button sat ON the last two plates: `UIButtons.hit` returns the
    // FIRST rect containing the point, so one of them could not be clicked,
    // and on a pad the highlight was drawn over a control nobody had chosen.
    // Found by tools/padnav.py, which is the first thing in this project to
    // ask whether two focusable rects share pixels.
    //
    // 150 puts the column's bottom at 610 and leaves 16 above the plates. The
    // SCRAP readout above it is at s.top+90 and is clear of 150.
    const bx = s.right - 560, by = s.top + 150;
    const spent = Forge.maxCost() - FORGE_TRACK_LIST.reduce((a, id) => {
      const t = FORGE_TRACKS[id];
      return a + t.costs.slice(Forge.levelOf(id)).reduce((x, y) => x + y, 0);
    }, 0);
    this.buttons.add('CORE FORGE  ' + spent + ' / ' + Forge.maxCost(),
      bx, by, 500, 120, () => {
        this.forgeOpen = true;
        this.build();
      }, { size: 34, color: CONFIG.COLOR.lime, textColor: CONFIG.COLOR.ink });

    // WEAPON LAB (Aaron, 25 Aug): the machine has its Forge, the guns get
    // theirs. Per-weapon damage / spread / cycle / Heat, same SCRAP bank.
    this.buttons.add('WEAPON LAB', bx, by + 140, 500, 100, () => {
      this.labOpen = true;
      this.labWeapon = null;
      this.build();
    }, { size: 34, color: CONFIG.COLOR.cyan, textColor: CONFIG.COLOR.ink });

    // RIG SETUP (M12): the selected Jackrig's Core Mod, Tuning ranks and —
    // at rank 5 — its final Specialization, switchable free (§19).
    this.buttons.add('RIG SETUP — ' + Progress.jackrig.name,
      bx, by + 260, 500, 100, () => {
        this.rigOpen = true;
        this.build();
      }, { size: 30, color: CONFIG.COLOR.magenta, textColor: CONFIG.COLOR.ink });

    // M2 dev proof: the story-earned Frame transition, triggered by hand.
    // Master §9 makes this a Boss-2 reward in production; this button exists
    // only so the physical upgrade can be seen working before Boss 2 exists.
    // (Moved below the Weapon Lab button when that arrived.)
    // DEV-ONLY-BEGIN
    if (CONFIG.DEV && Progress.canAdvanceFrame()) {
      this.buttons.add('DEV: ' + Frames.next(Progress.frameId).name,
        bx, by + 380, 500, 80, () => {
          const step = Progress.DEV.forceFrameUp(null);
          if (step) {
            this._say(step.from.name + '  ->  ' + step.to.name +
              '   sockets ' + step.from.roots + '->' + step.to.roots +
              ', modules ' + step.from.moduleCap + '->' + step.to.moduleCap +
              ', Power ' + step.from.basePower + '->' + step.to.basePower);
            this.build();
          }
        }, { size: 26, color: '#3a2a10', textColor: CONFIG.COLOR.orange });
    }
    // DEV-ONLY-END

    // ---- JACKRIG selection (Master §8 / M5) -------------------------------
    // Six machines on the Yard floor. A fresh save owns only the Jackal; the
    // other five are wrecks in the world, towed home and restored (Q4, 20
    // Sept 2026). Selecting one is IMMEDIATE — Frame stage,
    // Rack, Forge, Grades and Mastery are Yard-wide technology, so the new
    // chassis walks straight into everything the Yard has earned.
    // Width DERIVED from the safe rect: six fixed-width buttons overflow a
    // narrow phone, and test_layout rightly refuses that.
    const rigGap = 14;
    const rigAvail = (s.right - 60) - (s.left + 60);
    const rigW = Math.max(150, Math.min(300, (rigAvail - rigGap * 5) / 6));
    const rigX0 = s.left + 60;
    const rigY = s.bottom - 380;
    JACKRIG_LIST.forEach((id, i) => {
      const R_ = JACKRIGS[id];
      const owned = Progress.rigUnlocked(id);
      const sel = Progress.jackrigId === id;
      // Taller, label-less plates: the thumbnail overlay (after the final
      // buttons.draw) puts the machine on the plate, name at the bottom.
      this.buttons.add('', rigX0 + i * (rigW + rigGap), rigY - 74, rigW, 170, () => {
        if (Progress.selectRig(id)) {
          Progress.save();
          this._say(R_.name + '  —  ' + R_.identity.toUpperCase() +
            '   ·   inherits ' + Progress.frame.name);
          this.build();
        } else {
          // Say WHERE its wreck is, or where it is parked and what it
          // costs -- not just "locked". The refusal is the prompt.
          this._say((typeof MachineWrecks !== 'undefined')
            ? MachineWrecks.lockedText(id) : 'LOCKED');
        }
      }, { size: 28,
           color: !owned ? '#232b44' : (sel ? CONFIG.COLOR.lime : '#3a4468'),
           textColor: !owned ? '#8fa3c8' : (sel ? CONFIG.COLOR.ink : '#ffffff') });
      const rb = this.buttons.items[this.buttons.items.length - 1];
      if (rb) { rb.rigId = id; rb.rigOwned = owned; rb.rigName = R_.name; }
    });

    this.buttons.add('HOME', s.left + 40, s.top + 40, 200, 90,
      () => Game.switch('HOME'), { size: 30, color: '#232b44', textColor: '#fff' });
  }

  // The ten §14 tracks in a two-column grid, every size derived from the
  // safe rect — a fixed tile ran through the tab bar once already (the PARTS
  // grid), and this panel must survive the 854x480 phone the same way.
  _buildForge(s) {
    const cols = 2, rows = 5, gap = 10;
    const top = s.top + 150;
    const availW = (s.right - 60) - (s.left + 60);
    const availH = (s.bottom - 120) - top;
    const w = (availW - gap) / cols;
    const h = Math.min(96, (availH - (rows - 1) * gap) / rows);
    FORGE_TRACK_LIST.forEach((id, i) => {
      const t = FORGE_TRACKS[id];
      const lv = Forge.levelOf(id), maxed = Forge.isMaxed(id);
      const cost = Forge.costOf(id);
      const eff = t.per < 1 && t.per > -1
        ? (Math.abs(t.per * lv) * 100).toFixed(1).replace(/\.0$/, '') + t.unit
        : (t.per * lv) + t.unit;
      const label = t.name + '  ' + lv + '/' + t.levels +
        (maxed ? '   MAX' : '   ' + cost + ' SCRAP') +
        (lv ? '   (' + (t.per > 0 ? '+' : '-') + eff + ')' : '');
      const x = s.left + 60 + (i % cols) * (w + gap);
      const y = top + Math.floor(i / cols) * (h + gap);
      this.buttons.add(label, x, y, w, h, () => {
        if (Forge.buy(id)) {
          Progress.save();
          this._say(t.name + ' ' + Forge.levelOf(id) + '  —  ' +
            (t.per > 0 ? '+' : '') +
            (Math.abs(t.per) < 1
              ? (Forge.levelOf(id) * t.per * 100).toFixed(1).replace(/\.0$/, '')
              : Forge.levelOf(id) * t.per) + t.unit);
          // A bought level lands NOW, not next run (Master §14) — the same
          // promise the M2 slice made for Core Integrity.
          if (Game.state && Game.state.player) Forge.applyTo(Game.state.player);
          this.build();
        } else {
          this._say(maxed ? 'ALREADY MAXED' : 'NOT ENOUGH SCRAP');
        }
      }, { size: 22,
           color: Forge.canBuy(id) ? CONFIG.COLOR.lime : '#2a3350',
           textColor: Forge.canBuy(id) ? CONFIG.COLOR.ink : CONFIG.COLOR.steel });
    });
    this.buttons.add('BACK', s.left + 60, s.bottom - 104, 240, 80, () => {
      this.forgeOpen = false;
      this.build();
    }, { size: 30, color: '#232b44', textColor: '#ffffff' });
  }

  // The Weapon Lab panel. Two stages on one screen: pick a weapon, then buy
  // its four tracks. Derived sizes throughout — the PARTS-grid lesson.
  _buildLab(s) {
    const gap = 10;
    const top = s.top + 150;
    const left = s.left + 60, right = s.right - 60;
    const weapons = WeaponLab.weapons();

    if (!this.labWeapon) {
      // Stage 1: the weapon list.
      const cols = 2, rows = Math.ceil(weapons.length / cols);
      const availH = (s.bottom - 120) - top;
      const w = (right - left - gap) / cols;
      const h = Math.min(88, (availH - (rows - 1) * gap) / rows);
      weapons.forEach((wid, i) => {
        const spent = WeaponLab.spentOn(wid);
        const label = PARTS[wid].name + (spent ? '   ' + spent + ' SCRAP IN' : '');
        this.buttons.add(label,
          left + (i % cols) * (w + gap), top + Math.floor(i / cols) * (h + gap),
          w, h, () => {
            this.labWeapon = wid;
            this.build();
          }, { size: 24, color: spent ? CONFIG.COLOR.cyan : '#2a3454',
               textColor: spent ? CONFIG.COLOR.ink : '#ffffff' });
      });
    } else {
      // Stage 2: the four tracks for the chosen weapon.
      const wid = this.labWeapon;
      // Tracks a weapon cannot use at all (EFFICIENCY on a 0/1-Power weapon)
      // are dropped rather than shown permanently dead.
      const rows = WEAPON_LAB_TRACK_LIST
        .filter(tid => WeaponLab.maxLevels(wid, tid) > 0);
      const availH = (s.bottom - 120) - top;
      const h = Math.min(110, (availH - (rows.length - 1) * gap) / rows.length);
      rows.forEach((tid, i) => {
        const t = WEAPON_LAB_TRACKS[tid];
        const lv = WeaponLab.levelOf(wid, tid);
        const cap = WeaponLab.maxLevels(wid, tid);
        const maxed = WeaponLab.isMaxed(wid, tid);
        const cost = WeaponLab.costOf(wid, tid);
        // Flat tracks state whole points; percentage tracks state percent.
        const effText = t.flat
          ? Math.abs(t.flat * lv) + ' ' + t.what
          : Math.abs(t.per * lv * 100).toFixed(0) + '% ' + t.what;
        const label = t.name + '  ' + lv + '/' + cap +
          (maxed ? '   MAX' : '   ' + cost + ' SCRAP') +
          (lv ? '   (' + ((t.flat || t.per) > 0 ? '+' : '-') + effText + ')' : '');
        this.buttons.add(label, left, top + i * (h + gap), right - left, h, () => {
          if (WeaponLab.buy(wid, tid)) {
            Progress.save();
            const nl = WeaponLab.levelOf(wid, tid);
            this._say(PARTS[wid].name + ' ' + t.name + ' ' + nl + '  —  ' +
              (t.flat
                ? '-' + Math.abs(t.flat * nl) + ' ' + t.what
                : (t.per > 0 ? '+' : '-') +
                  Math.abs(t.per * nl * 100).toFixed(0) + '% ' + t.what));
            // A cheaper draw can light something that was dark: re-run the
            // grid on the live machine the moment it is bought.
            if (Game.state && Game.state.player) {
              Machine.recalcPower(Game.state.player);
            }
            this.build();
          } else {
            this._say(maxed ? 'ALREADY MAXED' : 'NOT ENOUGH SCRAP');
          }
        }, { size: 26,
             color: WeaponLab.canBuy(wid, tid) ? CONFIG.COLOR.cyan : '#2a3350',
             textColor: WeaponLab.canBuy(wid, tid)
               ? CONFIG.COLOR.ink : CONFIG.COLOR.steel });
      });
    }

    this.buttons.add('BACK', left, s.bottom - 104, 240, 80, () => {
      if (this.labWeapon) this.labWeapon = null;
      else this.labOpen = false;
      this.build();
    }, { size: 30, color: '#232b44', textColor: '#ffffff' });
  }

  // RIG SETUP panel (M12): Core Mods (top), Tuning (middle), Special (label).
  _buildRig(s) {
    const rig = Progress.jackrigId;
    const gap = 10, left = s.left + 60, right = s.right - 60;
    let y = s.top + 150;
    const w = right - left;

    // --- the three Core Mods: equip, or read the unlock condition ---------
    const mods = Mods.modsFor(rig);
    const h = 86;
    mods.forEach((m) => {
      const un = Mods.isUnlocked(m.id);
      const eq = (Mods.mod({ isPlayer: true, jackrigId: rig }) || {}).id === m.id;
      const prog = m.unlock && !un
        ? '   [' + Math.min(Mods.counters[m.unlock.counter] || 0, m.unlock.need)
          + '/' + m.unlock.need + ']' : '';
      const label = (eq ? '\u25CF  ' : '') + m.name + '  —  ' +
        (un ? m.text : m.unlock.text + prog);
      this.buttons.add(label, left, y, w, h, () => {
        if (!un) { this._say('LOCKED — ' + m.unlock.text); return; }
        Mods.equip(rig, m.id);
        Progress.save();
        this._say(m.name + ' EQUIPPED — ' + m.text);
        this.build();
      }, { size: 22,
           color: eq ? CONFIG.COLOR.magenta : (un ? '#3a4468' : '#1b2138'),
           textColor: eq ? CONFIG.COLOR.ink : (un ? '#ffffff' : '#5f708f') });
      y += h + gap;
    });

    // --- Tuning: one buy button + the A/B finals at rank 5 ----------------
    y += 14;
    const t = TUNING[rig];
    const rank = Mods.rankOf(rig);
    const cost = Mods.rankCost(rig);
    this.buttons.add(t.name + '  RANK ' + rank + '/5' +
      (cost === null ? '   MAX' : '   ' + cost + ' SCRAP'),
      left, y, w, 86, () => {
        if (Mods.buyRank(rig)) {
          Progress.save();
          if (Game.state && Game.state.player) Machine.recalcStats(Game.state.player);
          this._say(t.name + ' RANK ' + Mods.rankOf(rig));
          this.build();
        } else {
          this._say(cost === null ? 'ALREADY MAXED' : 'NOT ENOUGH SCRAP');
        }
      }, { size: 24,
           color: cost !== null && Forge.scrap >= cost ? CONFIG.COLOR.lime : '#2a3350',
           textColor: cost !== null && Forge.scrap >= cost
             ? CONFIG.COLOR.ink : CONFIG.COLOR.steel });
    y += 96;

    if (rank >= 5) {
      const half = (w - gap) / 2;
      t.finals.forEach((f, i) => {
        const on = Mods.finals[rig] === f.id;
        this.buttons.add((on ? '\u25CF  ' : '') + f.name, left + i * (half + gap),
          y, half, 80, () => {
            Mods.setFinal(rig, f.id);
            Progress.save();
            if (Game.state && Game.state.player) Machine.recalcStats(Game.state.player);
            this._say(f.name + ' — ' + f.text);
            this.build();
          }, { size: 24, color: on ? CONFIG.COLOR.yellow : '#3a4468',
               textColor: on ? CONFIG.COLOR.ink : '#ffffff' });
      });
      y += 90;
    }

    this.buttons.add('BACK', left, s.bottom - 104, 240, 80, () => {
      this.rigOpen = false;
      this.build();
    }, { size: 30, color: '#232b44', textColor: '#ffffff' });
  }

  _say(m) { this.msg = m; this.msgT = 5; }

  update(dt) {
    if (typeof UINav !== 'undefined') UINav.update(this.buttons);
    if (this.msgT > 0) this.msgT -= dt;
  }

  pointerDown(id, x, y) { this.buttons.hit(x, y); }
  pointerMove() {}
  pointerUp() {}

  render() {
    const s = Display.safe;
    R.clear(CONFIG.COLOR.bg);
    drawFloorGrid();

    if (this.forgeOpen || this.labOpen || this.rigOpen) {
      const title = this.forgeOpen ? 'CORE FORGE'
        : this.rigOpen
          ? ('RIG SETUP — ' + Progress.jackrig.name + '   ·   SPECIAL: '
             + SPECIALS[Progress.jackrigId].name)
        : (this.labWeapon ? 'WEAPON LAB — ' + PARTS[this.labWeapon].name
                          : 'WEAPON LAB');
      R.text(title, (s.left + s.right) / 2, s.top + 80,
        this.rigOpen ? 44 : 56,
        this.forgeOpen ? CONFIG.COLOR.lime
          : this.rigOpen ? CONFIG.COLOR.magenta : CONFIG.COLOR.cyan);
      R.text('SCRAP  ' + Forge.scrap, s.right - 60, s.top + 90, 44,
        CONFIG.COLOR.yellow, 'right');
      this.buttons.draw();
      if (this.msgT > 0 && this.msg) {
        R.ctx.globalAlpha = Math.min(1, this.msgT);
        R.text(this.msg, (s.left + s.right) / 2, s.bottom - 20, 26,
          CONFIG.COLOR.yellow);
        R.ctx.globalAlpha = 1;
      }
      return;
    }

    R.text('YARD 13', (s.left + s.right) / 2, s.top + 80, 64, CONFIG.COLOR.yellow);
    R.text('SCRAP  ' + Forge.scrap, s.right - 60, s.top + 90, 44,
      CONFIG.COLOR.yellow, 'right');

    // ---- what you own, stated plainly -------------------------------------
    const F = Progress.frame, J = Progress.jackrig;
    let y = s.top + 140;
    const LX = s.left + 60, VX = s.left + 470;
    const line = (a, b, col) => {
      R.text(a, LX, y, 26, CONFIG.COLOR.steel, 'left');
      R.text(b, VX, y, 26, col || '#ffffff', 'left');
      y += 40;
    };
    const head = (t) => {
      y += 16;
      R.text(t, LX, y, 30, CONFIG.COLOR.cyan, 'left');
      y += 44;
    };

    head('MACHINE');
    line('JACKRIG', J.name + '  —  ' + J.identity);
    line('FRAME', F.name, CONFIG.COLOR.yellow);
    line('SOCKETS / MODULES', F.roots + ' sockets, ' + F.moduleCap + ' modules');
    line('BASE POWER', String(F.basePower + J.powerMod));
    line('CORE HP', Math.round(J.coreHp * F.hp * Forge.coreHpMul()) +
      (Forge.levelOf('coreIntegrity')
        ? '   (' + Math.round(J.coreHp * F.hp) + ' + Forge)' : ''),
      Forge.levelOf('coreIntegrity') ? CONFIG.COLOR.lime : '#ffffff');

    head('YARD RACK');
    const owned = Rack.typesOwned();
    if (!owned.length) line('EMPTY', 'recover hardware and clear a screen');
    for (const id of owned.slice(0, 5)) {
      const g = Rack.best(id);
      const copies = Rack.owned(id).length;
      line(PARTS[id].name,
        gradeLabel(g) + (copies > 1 ? '   x' + copies : '') +
        (GRADES[g].n > 1
          ? '   +' + Math.round((GRADES[g].output - 1) * 100) + '% output' : ''),
        GRADES[g].colour);
    }

    head('WEAPON MASTERY');
    const tracks = Mastery.tracks()
      .filter(id => Mastery.creditsOf(id) > 0)
      .sort((a, b) => Mastery.creditsOf(b) - Mastery.creditsOf(a));
    if (!tracks.length) line('NONE YET', 'kills credit the weapon that lands them');
    for (const id of tracks.slice(0, 4)) {
      const lv = Mastery.levelOf(id);
      const next = Mastery.toNext(id);
      line(PARTS[id].name,
        'LEVEL ' + lv +
        (lv > 1 ? '   +' + Math.round((Mastery.damageMul(id) - 1) * 100) + '% damage' : '') +
        (next ? '   (' + next + ' kills to ' + (lv + 1) + ')' : '   MAX'),
        lv > 1 ? CONFIG.COLOR.cyan : '#ffffff');
    }

    R.text('JACKRIG PROJECTS', s.left + 60, s.bottom - 470, 28,
      CONFIG.COLOR.steel, 'left');

    // ---- the sentence the milestone is actually judged on ------------------
    const sum = Progress.summary();
    R.text('WHAT CHANGED', LX, s.bottom - 200, 28, CONFIG.COLOR.steel, 'left');
    R.text(sum || 'Nothing yet — clear a screen.', LX, s.bottom - 156, 26,
      CONFIG.COLOR.lime, 'left');

    if (this.msgT > 0 && this.msg) {
      R.ctx.globalAlpha = Math.min(1, this.msgT);
      R.text(this.msg, (s.left + s.right) / 2, s.bottom - 20, 26,
        CONFIG.COLOR.yellow);
      R.ctx.globalAlpha = 1;
    }
    this.buttons.draw();
    // Jackrig thumbnails ON the project plates — drawn after buttons.draw,
    // so they actually show (the PARTS-tab draw-order lesson). Locked rigs
    // draw dimmed: a machine you have not earned yet.
    if (typeof Assets !== 'undefined') {
      for (const b of this.buttons.items) {
        if (!b.rigId) continue;
        if (!b.rigOwned) R.ctx.globalAlpha = 0.25;
        UI.fitInto(R.ctx, MACHINE_SET_PREFIX + b.rigId, b.x + b.w / 2, b.y + 6,
          b.w - 20, b.h - 46);
        R.ctx.globalAlpha = 1;
        R.text(b.rigName, b.x + b.w / 2, b.y + b.h - 20, 24,
          b.rigOwned ? '#ffffff' : '#8fa3c8');
      }
    }
  }
}

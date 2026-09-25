// SCRAPCORE: BREAKLANDS — Unlocks & challenge tracking (Milestone 17, plan §53/§55)
// Gameplay calls Unlocks.event(name, data). Everything else — which part that
// unlocks, which challenge it advances, when to save — lives here, so combat
// code never has to know the progression rules.

const UNLOCKS = [
  { id: 'crusher',    parts: ['rocketPod', 'heavyArmour'], chassis: 'runner',
    label: 'DEFEAT CRUSHER' },
  { id: 'zone2',      parts: ['flamethrower'],  label: 'REACH THE FOUNDRY' },
  { id: 'overheat10', parts: ['heatSink'],      label: 'OVERHEAT 10 TIMES' },
  { id: 'rip20',      parts: ['directionalShield'], label: 'RIP 20 LIVE PARTS' },
  { id: 'strip30',    parts: ['arcGun'],        label: 'DESTROY 30 MODULES' },
  { id: 'fullRig',    parts: ['heavyTreads'],   label: 'FILL EVERY ROOT SOCKET' },
  { id: 'furnace',    parts: ['bigReactor', 'repairArm'], chassis: 'tank',
    label: 'DEFEAT FURNACE' },
  { id: 'zone2Healthy', parts: ['beamLaser'],   label: 'CLEAR THE FOUNDRY ABOVE 75 HP' },
  { id: 'victoryParts', parts: ['railgun', 'splitter'], label: 'FIRST VICTORY' },
  { id: 'victory',    difficulty: 'hard',  label: 'CLEAR NORMAL' },
  { id: 'hardWin',    difficulty: 'overdrive',  label: 'CLEAR HARD' },
];

const Unlocks = {
  // Queue of freshly unlocked things, drained by the UI for its banner.
  pending: [],

  // Challenge counters. These used to be reset per RUN; with no runs they
  // are lifetime counters and nothing clears them, so they are declared
  // here rather than built by a reset that no longer has a moment to fire.
  run: {
    rips: 0, ripsThisEncounter: 0, swapsThisEncounter: 0,
    coreDamageThisEncounter: 0, hazardKills: 0, sawKills: 0,
    modulesDestroyed: 0, hotSeconds: 0, startedAt: 0,
    kills: 0, attached: 0, bosses: 0, damageTaken: 0, deaths: 0,
  },

  startEncounter() {
    this.run.ripsThisEncounter = 0;
    this.run.swapsThisEncounter = 0;
    this.run.coreDamageThisEncounter = 0;
  },

  _grant(rule) {
    let granted = false;
    for (const id of (rule.parts || [])) {
      if (Profile.unlockPart(id)) {
        this.pending.push(PARTS[id] ? PARTS[id].name : id);
        granted = true;
      }
    }
    if (rule.chassis && Profile.unlockChassis(rule.chassis)) {
      this.pending.push(CHASSIS[rule.chassis].name + ' CHASSIS');
      granted = true;
    }
    if (rule.difficulty && Profile.unlockDifficulty(rule.difficulty)) {
      this.pending.push(DIFFICULTIES[rule.difficulty].name + ' MODE');
      granted = true;
    }
    if (granted && typeof Save !== 'undefined') Save.save();
    return granted;
  },

  fire(id) {
    const rule = UNLOCKS.find(u => u.id === id);
    return rule ? this._grant(rule) : false;
  },

  // -----------------------------------------------------------------------
  // The single entry point gameplay uses.
  // Cosmetic unlock + banner, in one place.
  _palette(id) {
    if (typeof Profile === 'undefined' || !Profile.unlockPalette) return;
    if (Profile.unlockPalette(id)) {
      this.pending.push('PALETTE: ' + (PALETTES[id] ? PALETTES[id].name : id));
    }
  },

  event(name, data) {
    const d = data || {};
    switch (name) {
      case 'bossDefeated': {
        this.run.bosses++;

        Profile.bump('bossesDefeated');
        if (d.zone === 1) { this.fire('crusher'); Profile.addChallenge('scrapKing'); }
        if (d.zone === 2) { this.fire('furnace'); Profile.addChallenge('meltdown'); }
        if (d.zone === 3) { Profile.addChallenge('firstNode'); }
        break;
      }
      case 'zoneReached': {
        if (d.zone === 2) this.fire('zone2');
        // Beam Laser: leave the Foundry still healthy (plan §53).
        if (d.zone === 3 && d.hpFrac !== undefined && d.hpFrac > 0.75) {
          this.fire('zone2Healthy');
        }
        break;
      }
      case 'victory': {
        Profile.bump('victories');
        // Parts are earned by finishing the game at all. The DIFFICULTY ladder
        // is separate: clear Normal to earn Hard, clear Hard to earn Overdrive.
        // Winning on Easy unlocks the parts but not the next tier up.
        this.fire('victoryParts');
        if (d.difficulty === 'normal' || d.difficulty === 'hard' ||
            d.difficulty === 'overdrive') {
          this.fire('victory');
        }
        if (d.difficulty === 'hard') {
          this.fire('hardWin');
          Profile.addChallenge('hardwired');
        }
        if (d.difficulty === 'overdrive') Profile.addChallenge('zeroFaults');
        if (d.time) Profile.fastest('fastestVictory', d.time);
        this._palette('coolant');                       // finish the game at all
        if (d.difficulty === 'hard') this._palette('ember');
        if (d.difficulty === 'overdrive') this._palette('circuit');
        break;
      }
      case 'overheat': {
        Profile.bump('overheats');
        if (Profile.stats.overheats >= 10) this.fire('overheat10');
        break;
      }
      case 'rip': {
        this.run.rips++;
        // The other earner. Stripping pays more per part than killing does,
        // because stripping is the verb this game is about.
        if (typeof Forge !== 'undefined' && typeof GARAGE !== 'undefined') {
          Forge.bank(GARAGE.SCRAP_STRIP);
        }
        this.run.ripsThisEncounter++;
        Profile.bump('partsRipped');
        if (Profile.stats.partsRipped >= 20) this.fire('rip20');
        if (this.run.ripsThisEncounter >= 3) Profile.addChallenge('reclaimer');
        break;
      }
      case 'moduleDestroyed': {          // an ENEMY module, victim still alive
        this.run.modulesDestroyed++;
        Profile.bump('partsDestroyed');
        if (Profile.stats.partsDestroyed >= 30) this.fire('strip30');
        break;
      }
      case 'partAttached': {
        this.run.attached++;

        Profile.bump('partsAttached');
        if (d.replaced) {
          this.run.swapsThisEncounter++;
          if (this.run.swapsThisEncounter >= 4) Profile.addChallenge('hotSwap');
        }
        if (d.rootsFull) {
          this.fire('fullRig');
          Profile.addChallenge('scrapFort');
        }
        break;
      }
      case 'partLost':      Profile.bump('partsLost'); break;
      case 'enemyKilled': {
        Profile.bump('enemiesDestroyed');
        this.run.kills++;
        // Block 3.6: SCRAP is the only currency and this is one of its two
        // earners. Paid here rather than in Enemy._die so every kill route
        // - shot, hazard, rammed - pays the same, once.
        if (typeof Forge !== 'undefined' && typeof GARAGE !== 'undefined') {
          Forge.bank(Salvage.killScrap(d));
          // AND THE XP, on the same event and for the same reason: every kill
          // route — shot, hazard, rammed — pays the same, once. Until this
          // line the only XP in the game came from a single mission, and the
          // forty-level tree had four points in it.
          if (typeof Levels !== 'undefined' && Levels.addXp) {
            Levels.addXp(Salvage.killXp(d));
          }
        }

        if (d.byHazard) {
          this.run.hazardKills++;
          Profile.addChallenge('handsOff');
        }
        if (d.bySaw) {
          this.run.sawKills++;
          Profile.addChallenge('sawblade');
        }
        if (d.stripped) Profile.addChallenge('surgical');
        break;
      }
      case 'coreDamage':
        this.run.coreDamageThisEncounter += d.amount || 0;
        this.run.damageTaken += d.amount || 0;
        break;
      case 'hot': {                       // seconds spent above 80 Heat
        this.run.hotSeconds += d.dt || 0;
        if (this.run.hotSeconds >= 10) Profile.addChallenge('tooHot');
        break;
      }
      case 'cooled':        this.run.hotSeconds = 0; break;
      case 'powerCap':      if (d.cap >= 20) Profile.addChallenge('powerHungry'); break;
      case 'weaponsFiring': if (d.count >= 4) Profile.addChallenge('overkill'); break;
      case 'mineChain':     if (d.kills >= 3) Profile.addChallenge('minefield'); break;
      default: break;
    }
  },

  // Drain the banner queue.
  takePending() {
    const list = this.pending;
    this.pending = [];
    return list;
  },
};

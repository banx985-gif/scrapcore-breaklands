// SCRAPCORE: BREAKLANDS — Save system (Milestone 17, plan §65)
// One local save profile. No accounts, no cloud, no server. The shape is
// versioned so future changes can migrate instead of wiping people's unlocks.
//
// Deliberately NOT saved: bullets, enemy positions, particle state. If the app
// dies mid-fight we restore the state recorded at the START of that encounter
// (plan §65) — reliable beats perfect.

const Save = {
  // M0: derived from GAME_ID (config.js) so no BREAKLANDS save can ever
  // collide with a WRECKJACK or SCRAPCORE: ZERO save on a device carrying
  // more than one of them.
  // Resolved defensively: several test harnesses load save.js WITHOUT
  // config.js, and a save module that throws at parse time would take the
  // whole suite down rather than fail one assertion.
  GAME: (typeof GAME_ID !== 'undefined') ? GAME_ID : 'scrapcore-breaklands',
  DESIGN: (typeof DESIGN_VERSION !== 'undefined')
    ? DESIGN_VERSION : 'BREAKLANDS_v1',
  KEY: ((typeof GAME_ID !== 'undefined') ? GAME_ID : 'scrapcore-breaklands')
    + '-save',
  VERSION: 1,
  available: true,
  lastError: null,

  _storage() {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage;
    } catch (e) {
      return null;              // private mode / blocked storage
    }
  },

  // ---- serialise ---------------------------------------------------------
  snapshot() {
    return {
      game: this.GAME,
      design: this.DESIGN,
      version: this.VERSION,
      profile: {
        chassis: Profile.chassis,
        starter: Profile.starter,
        difficulty: Profile.difficulty,
        palette: Profile.palette,
        unlockedChassis: Profile.unlockedChassis.slice(),
        unlockedDifficulties: Profile.unlockedDifficulties.slice(),
        unlockedParts: Profile.unlockedParts.slice(),
        unlockedPalettes: Profile.unlockedPalettes.slice(),
        discovered: Profile.discovered.slice(),
        challenges: Object.assign({}, Profile.challenges),
        stats: Object.assign({}, Profile.stats),
        tutorialDone: !!Profile.tutorialDone,
        introSeen: !!Profile.introSeen,
        endingSeen: !!Profile.endingSeen,
      },
      settings: Object.assign({}, Settings.values),
      bindings: (typeof Keys !== 'undefined' && Keys.bindings)
        ? JSON.parse(JSON.stringify(Keys.bindings)) : null,
      run: this.run ? Object.assign({}, this.run) : null,
      // M1: six-screen Campaign progress. Separate from `run` because the
      // machine snapshot and the MAP position are restored independently —
      // a death rebuilds the machine, the midpoint decides which screen.
      campaign: this.campaign ? Object.assign({}, this.campaign) : null,
      // M2: Frame stage, Yard Rack, Weapon Mastery, Core Forge and SCRAP.
      // Master §13 — all of it survives death, so it is saved separately
      // from anything to do with the current attempt.
      progress: this.progress ? JSON.parse(JSON.stringify(this.progress)) : null,
    };
  },

  save() {
    const st = this._storage();
    if (!st) { this.available = false; return false; }
    try {
      st.setItem(this.KEY, JSON.stringify(this.snapshot()));
      this.available = true;
      this.lastError = null;
      return true;
    } catch (e) {
      // Quota or serialisation failure must never take the game down.
      this.available = false;
      this.lastError = String(e);
      return false;
    }
  },

  load() {
    const st = this._storage();
    if (!st) { this.available = false; return false; }
    let raw;
    try {
      raw = st.getItem(this.KEY);
    } catch (e) {
      this.available = false;
      return false;
    }
    if (!raw) return false;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      this.lastError = 'corrupt save';
      return false;             // corrupt: fall back to a fresh profile
    }
    return this.apply(data);
  },

  // Restore a snapshot onto the live objects. Anything missing or unknown is
  // ignored rather than trusted, so an old or hand-edited save cannot inject
  // parts and chassis that do not exist.
  apply(data) {
    if (!data || typeof data !== 'object') return false;
    const migrated = this.migrate(data);
    if (!migrated) return false;
    const p = migrated.profile || {};

    Profile.reset();
    // Key bindings. Validated hard: only known actions, only string codes, and
    // any action left empty falls back to its default — a save with a wiped
    // binding must not leave the player unable to move.
    if (typeof Keys !== 'undefined') {
      Keys.bindings = Keys.defaults();
      const b = migrated.bindings;
      if (b && typeof b === 'object') {
        // A save written BEFORE keyboard aim existed has the arrow keys bound
        // to MOVE, because that is what they used to be. Restoring it verbatim
        // would leave the arrows driving movement AND aim at the same time, so
        // pressing Up would walk up the screen and fire upward at once.
        //
        // Detected by the aim actions simply not being in the save. In that
        // case the arrows are dropped from movement and the new defaults stand;
        // WASD, which is what the player was actually using to move, is
        // untouched.
        const preAim = !Array.isArray(b.aimUp);
        const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        for (const a of Keys.ACTION_LIST) {
          let codes = Array.isArray(b[a])
            ? b[a].filter(c => typeof c === 'string' && c.length < 24).slice(0, 2)
            : null;
          if (codes && preAim && ['up', 'down', 'left', 'right'].indexOf(a) >= 0) {
            codes = codes.filter(c => ARROWS.indexOf(c) < 0);
          }
          if (codes && codes.length) Keys.bindings[a] = codes;
        }
      }
    }
    // Palettes: only ones that exist, and the always-open one is re-added on
    // every load — the §31 lesson, where restoring a list verbatim silently
    // removed content that did not exist when the save was written.
    Profile.unlockedPalettes = (Array.isArray(p.unlockedPalettes) ? p.unlockedPalettes : [])
      .filter(id => !!PALETTES[id]);
    for (const id of PALETTE_LIST) {
      if (PALETTES[id].alwaysOpen && !Profile.hasPalette(id)) {
        Profile.unlockedPalettes.push(id);
      }
    }
    Profile.palette = (typeof p.palette === 'string' && Profile.hasPalette(p.palette))
      ? p.palette : 'original';

    const validParts = (list) => (Array.isArray(list) ? list : [])
      .filter(id => PART_LIST.indexOf(id) >= 0);

    if (Array.isArray(p.unlockedChassis)) {
      const c = p.unlockedChassis.filter(id => !!CHASSIS[id]);
      if (c.length) Profile.unlockedChassis = c;
    }
    if (Array.isArray(p.unlockedDifficulties)) {
      const d = p.unlockedDifficulties.filter(id => !!DIFFICULTIES[id]);
      if (d.length) Profile.unlockedDifficulties = d;
    }
    // MIGRATION: saves written before EASY existed do not list it, which left
    // returning players with Easy mysteriously locked. Anything marked
    // alwaysOpen is re-added on every load.
    for (const id of DIFFICULTY_LIST) {
      if (DIFFICULTIES[id].alwaysOpen && Profile.unlockedDifficulties.indexOf(id) < 0) {
        Profile.unlockedDifficulties.push(id);
      }
    }
    const up = validParts(p.unlockedParts);
    if (up.length) Profile.unlockedParts = up;
    const dp = validParts(p.discovered);
    if (dp.length) Profile.discovered = dp;

    if (p.challenges && typeof p.challenges === 'object') {
      for (const c of CHALLENGES) {
        const v = p.challenges[c.id];
        if (typeof v === 'number' && v >= 0) {
          Profile.challenges[c.id] = Math.min(v, c.goal);
        }
      }
    }
    if (p.stats && typeof p.stats === 'object') {
      for (const k of Object.keys(p.stats)) {
        if (typeof p.stats[k] === 'number') Profile.stats[k] = p.stats[k];
      }
    }
    for (const flag of ['tutorialDone', 'introSeen', 'endingSeen']) {
      if (typeof p[flag] === 'boolean') Profile[flag] = p[flag];
    }

    // Selections last, so they are validated against the restored unlocks.
    if (CHASSIS[p.chassis] && Profile.hasChassis(p.chassis)) Profile.chassis = p.chassis;
    if (STARTER_WEAPONS.indexOf(p.starter) >= 0 && Profile.hasPart(p.starter)) {
      Profile.starter = p.starter;
    }
    if (DIFFICULTIES[p.difficulty] && Profile.hasDifficulty(p.difficulty)) {
      Profile.difficulty = p.difficulty;
    }

    if (migrated.settings && typeof migrated.settings === 'object') {
      for (const k of Object.keys(SETTINGS_DEFS)) {
        if (migrated.settings[k] !== undefined) Settings.values[k] = migrated.settings[k];
      }
      Settings.apply();
    }

    this.progress = migrated.progress || null;
    return true;
  },

  // Version bridge. Nothing to migrate yet, but the door is open and an
  // unknown FUTURE version is refused rather than half-read.
  migrate(data) {
    // M0: refuse a snapshot from a different game outright. The key is
    // already namespaced, so this only fires if a save was hand-edited or
    // copied across — in which case loading it would silently corrupt a
    // profile. A save with NO game stamp predates M0 and cannot be ours.
    if (data.game !== this.GAME) return null;
    const v = data.version || 0;
    if (v > this.VERSION) return null;
    return data;
  },

  // The Campaign's per-map progress and the run checkpoint (plan §65:
  // zone, encounter, machine, HP, levels, firmware, plus the zone-entry
  // snapshot a death restored) both went with the systems they served.
  // BREAKLANDS has no runs and no screens to re-enter. What persists is
  // the permanent layer, and Progress owns that.
  progress: null,

  wipe() {
    const st = this._storage();
    this.run = null;
    if (!st) return false;
    try { st.removeItem(this.KEY); return true; } catch (e) { return false; }
  },

  // START OVER (D349). "Delete my save" is a real button now -- HOME's quiet
  // START OVER, behind a two-step confirm -- and this is what it does. For
  // fourteen runs `wipe` had no caller (unwire --boot, D348): a player who
  // wanted to begin BREAKLANDS again could not.
  //
  // The store's copy goes through wipe(), the one call test_isolation proves
  // leaves WRECKJACK's save alone. The LIVE objects are then put back to a
  // new save -- the profile, the permanent layer, the run -- because a wiped
  // store with the old Progress still in memory is a save that comes back
  // the moment anything saves. Settings and key bindings are not progress
  // and stay; the fresh save written at the end carries them.
  startOver() {
    const wiped = this.wipe();
    this.campaign = null;
    this.progress = null;
    Profile.reset();
    if (typeof Progress !== 'undefined') Progress.newSave();
    if (typeof Progress !== 'undefined' && Progress.save) Progress.save();
    else this.save();
    return wiped;
  },
};

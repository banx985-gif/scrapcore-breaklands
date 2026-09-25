// SCRAPCORE: BREAKLANDS — the permanent layer (Milestone 2)
// Master v3.2 §9 (new-save machine), §13 (what survives death), §14, §15, §17.
//
// Everything the player KEEPS lives here: Frame stage, Yard Rack, Weapon
// Mastery, Core Forge, SCRAP. One module owns it, one snapshot saves it, and
// one call applies it to a machine — so there is exactly one answer to "why is
// my rig better than last time".
//
// M2's whole job is to make that answer say something a player could repeat
// out loud without a tooltip.

const Progress = {
  jackrigId: 'jackal',
  frameId: 'bare',
  mapsCleared: 0,
  unlockedRigs: ['jackal'],

  // PLAYTEST 2, ITEM 4. WHERE YOU ARE.
  //
  // The front end says DISTRICT and names one, and the primary button
  // says which district it will drop you into. Both of those need an
  // answer on a save that has been closed and reopened, when there is no
  // live world to ask - and the menu is not allowed to guess, because a
  // status block that names the wrong place is worse than no status
  // block. So the district you last stood in is a saved fact.
  lastDistrictId: null,

  // Master §9: a brand-new Campaign save.
  //   JACKAL, BARE Frame, 4 root sockets / 4-module cap, one permanent G1
  //   Armour Plate equipped, three empty root sockets, 0 SCRAP, no Forge
  //   purchases, Weapon Mastery 1 on every family.
  //
  // Q8 (BREAKLANDS_ANSWERS, 20 Sept 2026): A NEW SAVE STARTS WITH ONE GUN.
  // Master §9 also put a Rack copy of the MACHINE GUN on socket 0, and Block 4
  // put the permanent MACHINE GUN on its own ring, so every player since
  // Block 4 woke with two. The Rack copy was WRECKJACK's leftover: it doubled
  // opening damage, skewed the early economy and sat in the socket the
  // player should be choosing what to put in. The permanent is the gun that
  // cannot be shot off; it is the one gun now.
  newSave() {
    this.jackrigId = 'jackal';
    this.frameId = 'bare';
    this.mapsCleared = 0;
    this.unlockedRigs = ['jackal'];   // Master §8: Campaign starts JACKAL only
    this.lastDistrictId = null;
    Rack.startingRack();
    Mastery.reset();
    Forge.reset();
    if (typeof WeaponLab !== 'undefined') WeaponLab.reset();
    if (typeof Mods !== 'undefined') Mods.reset();
    this.protoOwned = [];             // Warden Prototypes recovered (§22)
    this.clearedMaps = [];            // map NUMBERS beaten (M20)
    this.modes = {};                  // side modes opened by the story (§25)
    this.records = {};                // M28: side-mode bests (waves, times)
    this.ngplusActive = false;        // §32: the world is on its second lap
    this.arenaBuild = [];             // M26: the player's saved Arena build
    this.fwCounters = {};             // §30 firmware challenge progress
    this.fwUnlocked = {};             // §30 challenge-earned firmware
    this.story = {};                  // Archive flags: what has been seen
    // Block 2: placed machines killed for good, by permanent id. Killing one
    // is progress, and progress that undoes itself is not progress — so this
    // is in the save, not in World, which is rebuilt on every entry.
    this.killedPlaced = {};
    // Block 3. Garages owned, the wreck you owe yourself, where you last
    // banked, and the ground you have covered. Exploration was deferred
    // from Block 1 (D28) on the grounds that Block 3 owns the save shape;
    // this is Block 3.
    this.garages = {};
    this.wreck = null;
    this.lastGarage = null;
    // Block 4. `permanentsOwned` is what you have FOUND — permanents come
    // off bosses and out of places, never out of a shop, so there is no
    // purchase list to keep. `permanents` is what is fitted, per vehicle,
    // because a rig found late starts near zero and you build it up.
    // `weaponSkill` is the 4.5 counter: fed now, spent in Block 10.
    this.permanentsOwned = { perm_machineGun: true };
    // Keyed by the VEHICLE, which since Block 7 is the core you are walking
    // as rather than the Jackrig chassis. Left as 'jackal' the starting
    // permanent existed but belonged to nothing you were driving.
    this.permanents = { 'core:clip': ['perm_machineGun'] };
    this.weaponSkill = {};
    this.presets = [];        // Block 5: saved builds
    this.partsSeen = {};      // Block 5: what has been fitted at least once
    // Block 7. You start as CLIP, on foot, owning no rigs — every one of
    // them is dragged home and restored.
    this.coreId = 'clip';
    this.rigsOwned = {};
    this.dockedRig = null;
    this.parked = {};
    this.parkedChassis = [];
    // Q4 (20 Sept 2026). Machine wrecks dragged to a garage and waiting to
    // be paid for, like parkedChassis: [{ machineId, garage }].
    this.parkedMachines = [];
    this.shortcuts = {};      // Block 8: opened once, open forever
    this.gadgets = {};        // Block 8/11: gadget ranks the gates read
    // WHICH of the ones you own are FITTED. Separate from `gadgets` on
    // purpose: owning is permanent and is about the map, fitting is a loadout
    // and is about the fight. A traversal gadget you found in the Ironworks
    // must never be something you can lose by changing your build.
    this.gadgetsFitted = [];
    // WHAT A SCAVENGING ROAMER TOOK OFF YOU. Keyed by boss id, because
    // PATCHWORK is not the only machine that could ever wear its kills.
    this.roamerWears = {};
    // PHASE C.3: what has been taken out of the world, and what that gave you.
    // `finds` is keyed by the find's PERMANENT id, so taken-once-taken-forever
    // survives a district file being reordered.
    this.finds = {};
    this.missions = {};       // Block 13: mission id -> offered/active/done
    // BLOCK 13, the mission kinds that needed a world record and had none.
    // Both are keyed by a PERMANENT id and both are one-way, for the same
    // reason `finds` is: a job you have done stays done through a district
    // reload, a save round-trip and a district file being reordered.
    this.towed = {};          // named wreck id -> stripped at a garage
    this.rode = {};           // freight destination id -> you were on it
    // BLOCK 14. "Roaming bosses disengage when badly hurt AND STAY HURT."
    // boss id -> the lowest health fraction it has ever been driven to. One
    // way, like every other record here: you cannot un-wound a roamer by
    // walking away, and it cannot heal by being reloaded.
    this.roamerDamage = {};
    // BLOCK 14. Where a roamer went when it broke off, and whether it is
    // currently away. `{ cx, cy, district }` per boss - so it is FINDABLE
    // AGAIN, which is the difference between a boss that disengaged and a
    // boss that despawned.
    this.roamerAt = {};
    // BLOCK 16. Which MAGS lines have been heard. Only `once: true` lines are
    // recorded - the ambient pool is meant to come round again - and it is
    // one-way like every other record here: a first time is a first time.
    this.radioHeard = {};
    // BLOCK 13. Escort runs delivered. One-way like every other record here:
    // an escort you completed stays completed, and a FAILED one leaves no
    // record at all - because failing an escort is not a state you are stuck
    // in, it is a thing you go and do again.
    this.escorted = {};
    // THE FIRST TWENTY MINUTES. Which of the five lessons have landed. NEVER
    // SHOWN TO THE PLAYER - it exists to decide whether the Yard keeps
    // offering something, and how loud the connector highlight is.
    this.taught = {};
    // BLOCK 12. Per vehicle and per weapon: four slot colours and up to four
    // decals. SAVE_FORMAT asks for `paint{}` on each, and one namespace keyed
    // by id is that - a rig and a weapon are both things you paint, and two
    // tables would mean two of everything.
    this.paint = {};
    this.colourPresets = [];
    // BLOCK 9. Character level and the tree. "skills{} - node id -> rank.
    // MUST TOLERATE UNKNOWN NODE IDS so a renamed node doesn't corrupt a
    // save", which is why nothing here validates against SKILLS on the way
    // in: an unknown id is carried and ignored, never dropped and never fatal.
    this.xp = 0;
    this.skills = {};
    this.coresOwned = {};
    this.paintOwned = {};
    this.foundSlots = 0;
    // BLOCK 14's payout ledger. Which bosses have handed their drops over, so
    // a roamer beaten, let go and beaten again is one trophy and a reloaded
    // save on top of a dead boss does not pay twice. `endingReached` is the
    // one flag THE DISPATCHER sets and the only drop that is not an object.
    this.bossesPaid = {};
    // Which missions have had their thing brought to a garage. One-way, keyed
    // by mission id, like every other record here.
    this.delivered = {};
    // CONTENT_ECONOMY Part 4's three one-off XP awards, each one-way: the
    // districts you have entered, the barrier TYPES you have opened, and the
    // firsts (the first elite is worth three of the rest).
    this.districtsEntered = {};
    this.barrierKinds = {};
    this.xpFirsts = {};
    // BLOCK 16's scenes and CLIP's own log beats. Keyed by id, valued with the
    // PLAY SECONDS at which each fired, because the reclassification scene's
    // callback is 'much later' and later has to be measured from something.
    this.scenesPlayed = {};
    this.endingReached = false;
    this.ending = null;            // 'shutdown' | 'desk' | 'walk', once chosen
    // CONTENT_ECONOMY's second currency: "found and missions ONLY, the
    // throttle on power". A mission has paid two of them since Block 13 and
    // there was nowhere for them to land.
    this.upgradeParts = 0;
    // BLOCK 10. The spine is per weapon CLASS and shared by its variants; the
    // capstone is per variant. Two records because they are two facts.
    this.spine = {};
    this.capstones = {};
    this.explored = {};
  },

  get frame() { return Frames.get(this.frameId); },
  get jackrig() { return JACKRIGS[this.jackrigId] || JACKRIGS.jackal; },

  // ---- Jackrig unlocks (Master §8) ---------------------------------------
  // Per-save state, owned here. The JACKRIGS const carries no unlock flag on
  // purpose — a shared const is one save leaking into another.
  rigUnlocked(id) { return this.unlockedRigs.indexOf(id) >= 0; },

  unlockRig(id) {
    if (!JACKRIGS[id] || this.rigUnlocked(id)) return false;
    this.unlockedRigs.push(id);
    return true;
  },

  // Select a rig in the Yard. Master §8: a newly unlocked Jackrig immediately
  // inherits Yard-wide technology — Frame stage, Rack, Forge, Grades, Mastery.
  // That inheritance is STRUCTURAL here: all of those are Progress/Yard state
  // keyed by nothing rig-specific, so switching rigs simply leaves them alone.
  selectRig(id) {
    if (!this.rigUnlocked(id)) return false;
    this.jackrigId = id;
    return true;
  },

  // ---- the machine --------------------------------------------------------
  // Build the starting machine for a Campaign map: Frame stats, then the two
  // permanent Rack copies bolted on, then Forge on top.
  buildMachine(player) {
    Frames.apply(player, this.jackrigId, this.frameId);
    Machine.clearAll(player);
    // BLOCK 4: the permanents go on FIRST and are never taken off again.
    // They are the reason a machine stripped to a bare core is a fight you
    // can still win rather than a walk home.
    if (typeof Permanents !== 'undefined') {
      Permanents.applyTo(player,
        (typeof Rigs !== 'undefined') ? Rigs.vehicleId() : this.jackrigId);
    }
    // WRECKJACK's map-start TEMPLATE (the build that won the last map,
    // rebuilt here) is gone: BREAKLANDS has no maps to win and nothing ever
    // wrote one. The defaults are the whole of a rebuilt machine.
    this._equipDefaults(player);
    Forge.applyTo(player);
    Machine.recalcPower(player);
    return player;
  },

  _equipDefaults(player) {
    // Master §9 put the starting weapon on socket 0 at the top. Q8: not any
    // more -- the permanent MACHINE GUN on its own ring is the starting
    // weapon, and socket 0 is the player's to fill. A Rack copy of the gun
    // bolted here was the second gun every new save woke with.
    if (Rack.ownsAny('armourPlate')) this.equip(player, 'armourPlate', 2);
  },

  // Attach a part AT ITS BEST OWNED GRADE. Grade is not a separate item — it
  // is a property of the copy you own, so equipping always uses your best.
  equip(player, partId, socketId) {
    const idx = Machine.attach(player, partId, socketId);
    if (idx < 0) return -1;
    const s = Machine.getSocket(player, idx);
    if (s && s.comp) applyGradeToComponent(s.comp, Rack.best(partId) || 'G1');
    return idx;
  },

  // WRECKJACK's campaign meta -- map locks, breach keys, mode unlocks, the
  // map-start template, the Warden that hands over a Jackrig -- had no
  // caller in BREAKLANDS. Gone. How a second machine is EARNED is answered
  // (Q4, 20 Sept 2026): it is found in the world as a wreck, towed home and
  // restored -- MachineWrecks in rigs.js, which calls unlockRig above.

  // ---- Frame growth (Master §9: story-earned, NEVER purchased) ------------
  // Q6 (BREAKLANDS_ANSWERS, 20 Sept 2026): A FRAME STAGE IS EARNED BY
  // REACHING A NEW DISTRICT. The five stages were gated on "beat Warden
  // 2 / 4 / 6 / 8" -- WRECKJACK's Wardens, which BREAKLANDS does not have --
  // so advanceFrame had one caller, the DEV button, and every shipping
  // player stayed on the BARE FRAME for the whole game. The Yard is the
  // start; stages 2 to 5 land on the second, third, fourth and fifth
  // district a player reaches. Not bosses, not garages claimed, not level:
  // districts. Interiors do not count, the rule `districtsEntered` already
  // keeps (a lair is a room inside a place you already arrived at).
  //
  // What grows is sockets, modules, branching, core HP and power -- and the
  // frame's speed multiplier, 0.90 to 1.00, which is why Q7 sizes the Yard
  // from the BARE figure and leaves the rest of the world at 640: the
  // player grows into it.
  frameStageEarned() {
    const n = Object.keys(this.districtsEntered || {}).length;
    return Math.max(0, Math.min(FRAME_STAGES.length - 1, n - 1));
  },

  // Called from the ONE place that changes which district you stand in
  // (GameState._enterDistrict), after the district is recorded. One stage
  // per district reached, with the fanfare advanceFrame gives each; a save
  // that is behind catches up (one from before Q6 with three districts
  // entered walks in on the COMBAT FRAME). `player` is null on a session's
  // first entry, when the machine is not built yet: it is then built on the
  // stage this leaves behind, which is the same machine.
  growFrame(player) {
    let last = null;
    while (Frames.index(this.frameId) < this.frameStageEarned()) {
      const step = this.advanceFrame(player);
      if (!step) break;
      last = step;
    }
    return last;
  },

  canAdvanceFrame() { return !Frames.isLast(this.frameId); },

  advanceFrame(player) {
    if (!this.canAdvanceFrame()) return null;
    const from = this.frame;
    this.frameId = Frames.next(this.frameId).id;
    const to = this.frame;
    if (player) {
      // Keep the damage you were carrying: a Frame upgrade grows the machine,
      // it is not a free heal. Proportion is preserved, not raw HP.
      Frames.apply(player, this.jackrigId, this.frameId, { keepHpFraction: true });
      Forge.applyTo(player);
      Machine.recalcPower(player);
      // The frame's own speed multiplier moved: the modules' speed and dash
      // figures are on top of it, and a machine grown mid-district (Q6)
      // has nobody else to re-derive them.
      if (Machine.recalcStats) Machine.recalcStats(player);
      if (typeof Effects !== 'undefined') {
        Effects.comicWord(to.name + '!', player.x, player.y - 240,
          CONFIG.COLOR.yellow, 84);
        Effects.ring(player.x, player.y, 420, CONFIG.COLOR.yellow);
      }
      if (typeof Camera !== 'undefined') Camera.shake(12, 0.5);
      if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    }
    return { from, to };
  },

  // ---- persistence --------------------------------------------------------
  // Master §13: all of this survives death immediately. That is the point.
  snapshot() {
    return {
      jackrigId: this.jackrigId,
      frameId: this.frameId,
      mapsCleared: this.mapsCleared,
      unlockedRigs: this.unlockedRigs.slice(),
      lastDistrictId: this.lastDistrictId || null,
      rack: Rack.snapshot(),
      mastery: Mastery.snapshot(),
      forge: Forge.snapshot(),
      weaponLab: (typeof WeaponLab !== 'undefined') ? WeaponLab.snapshot() : null,
      mods: (typeof Mods !== 'undefined') ? Mods.snapshot() : null,
      protoOwned: (this.protoOwned || []).slice(),   // §22: permanent copies
      clearedMaps: (this.clearedMaps || []).slice(),
      modes: Object.assign({}, this.modes || {}),
      records: Object.assign({}, this.records || {}),
      ngplusActive: !!this.ngplusActive,
      arenaBuild: (this.arenaBuild || []).slice(),
      fwCounters: Object.assign({}, this.fwCounters || {}),
      fwUnlocked: Object.assign({}, this.fwUnlocked || {}),
      // `fragments` (item 6's found record) is a nested object; a shallow
      // copy of story would hand the snapshot a live reference, and a find()
      // after snapshot() would silently edit the saved copy.
      story: (s => {
        const c = Object.assign({}, s || {});
        if (c.fragments) c.fragments = Object.assign({}, c.fragments);
        return c;
      })(this.story),
      killedPlaced: Object.assign({}, this.killedPlaced || {}),
      garages: Object.assign({}, this.garages || {}),
      wreck: this.wreck ? JSON.parse(JSON.stringify(this.wreck)) : null,
      lastGarage: this.lastGarage || null,
      explored: Object.assign({}, this.explored || {}),
      // Block 4. A permanent weapon you found is a permanent weapon; which
      // slot of which vehicle it sits in is a choice, and both survive.
      permanentsOwned: Object.assign({}, this.permanentsOwned || {}),
      permanents: JSON.parse(JSON.stringify(this.permanents || {})),
      weaponSkill: Object.assign({}, this.weaponSkill || {}),
      // Block 5. Saved builds, and which parts the player has already
      // fitted once (so STORAGE can float genuinely new hardware to the top
      // rather than shouting NEW at everything forever).
      presets: JSON.parse(JSON.stringify(this.presets || [])),
      partsSeen: Object.assign({}, this.partsSeen || {}),
      // Block 7. Which core you are, which rigs you own, which one you are
      // docked into, and WHERE each one is parked — walking out of a mine
      // and finding your Mammoth gone is the worst thing this system could
      // do, so the parked position is a save fact.
      coreId: this.coreId || 'clip',
      rigsOwned: Object.assign({}, this.rigsOwned || {}),
      dockedRig: this.dockedRig || null,
      parked: JSON.parse(JSON.stringify(this.parked || {})),
      parkedChassis: JSON.parse(JSON.stringify(this.parkedChassis || [])),
      parkedMachines: JSON.parse(JSON.stringify(this.parkedMachines || [])),
      // Block 8. A shortcut opened once stays open forever — it is what
      // makes the map feel like it is becoming yours. And the gadget ranks
      // the gates are laid out against, which Block 11 will start granting.
      shortcuts: Object.assign({}, this.shortcuts || {}),
      finds: Object.assign({}, this.finds || {}),
      missions: Object.assign({}, this.missions || {}),
      towed: Object.assign({}, this.towed || {}),
      rode: Object.assign({}, this.rode || {}),
      roamerDamage: Object.assign({}, this.roamerDamage || {}),
      roamerAt: JSON.parse(JSON.stringify(this.roamerAt || {})),
      radioHeard: Object.assign({}, this.radioHeard || {}),
      escorted: Object.assign({}, this.escorted || {}),
      taught: Object.assign({}, this.taught || {}),
      paint: JSON.parse(JSON.stringify(this.paint || {})),
      colourPresets: JSON.parse(JSON.stringify(this.colourPresets || [])),
      xp: this.xp || 0,
      skills: Object.assign({}, this.skills || {}),
      coresOwned: Object.assign({}, this.coresOwned || {}),
      paintOwned: Object.assign({}, this.paintOwned || {}),
      foundSlots: this.foundSlots || 0,
      bossesPaid: Object.assign({}, this.bossesPaid || {}),
      delivered: Object.assign({}, this.delivered || {}),
      districtsEntered: Object.assign({}, this.districtsEntered || {}),
      barrierKinds: Object.assign({}, this.barrierKinds || {}),
      xpFirsts: Object.assign({}, this.xpFirsts || {}),
      scenesPlayed: Object.assign({}, this.scenesPlayed || {}),
      endingReached: !!this.endingReached,
      ending: this.ending || null,
      upgradeParts: this.upgradeParts || 0,
      spine: Object.assign({}, this.spine || {}),
      capstones: Object.assign({}, this.capstones || {}),
      gadgets: Object.assign({}, this.gadgets || {}),
      gadgetsFitted: (this.gadgetsFitted || []).slice(),
      roamerWears: JSON.parse(JSON.stringify(this.roamerWears || {})),
    };
  },

  restore(d) {
    if (!d) return false;
    this.newSave();
    if (Array.isArray(d.unlockedRigs)) {
      // Jackal is never lockable, whatever a hand-edited save claims, and an
      // unknown id (a future rig, a typo) is dropped rather than kept as a
      // ghost entry the UI would have to defend against forever.
      this.unlockedRigs = ['jackal'].concat(
        d.unlockedRigs.filter(r => r !== 'jackal' && JACKRIGS[r]));
    }
    // The selected rig must actually be OWNED by this save. A save written on
    // a dev build with everything forced open, restored on a fresh one, must
    // not hand over a locked chassis.
    if (JACKRIGS[d.jackrigId] && this.rigUnlocked(d.jackrigId)) {
      this.jackrigId = d.jackrigId;
    }
    // Warden Prototypes (§22): one permanent copy each — unknown ids from a
    // hand-edited save are dropped, like unknown rigs above.
    this.protoOwned = (Array.isArray(d.protoOwned) ? d.protoOwned : [])
      .filter(id => PARTS[id] && PARTS[id].prototype);
    this.clearedMaps = (Array.isArray(d.clearedMaps) ? d.clearedMaps : [])
      .filter(n => Number.isInteger(n) && n >= 1 && n <= 10);
    this.modes = (d.modes && typeof d.modes === 'object')
      ? Object.assign({}, d.modes) : {};
    this.records = (d.records && typeof d.records === 'object')
      ? Object.assign({}, d.records) : {};
    this.ngplusActive = !!d.ngplusActive;
    this.arenaBuild = Array.isArray(d.arenaBuild) ? d.arenaBuild.slice() : [];
    this.fwCounters = (d.fwCounters && typeof d.fwCounters === 'object')
      ? Object.assign({}, d.fwCounters) : {};
    this.fwUnlocked = (d.fwUnlocked && typeof d.fwUnlocked === 'object')
      ? Object.assign({}, d.fwUnlocked) : {};
    this.story = (d.story && typeof d.story === 'object')
      ? Object.assign({}, d.story) : {};
    // The found-fragment record is validated at the door the way
    // lastDistrictId is validated against DISTRICTS: an id from a stale or
    // hand-edited save naming a fragment that no longer exists is dropped
    // here, not defended against in every screen forever.
    {
      const fr = (this.story.fragments && typeof this.story.fragments === 'object')
        ? this.story.fragments : {};
      this.story.fragments = {};
      for (const id of Object.keys(fr)) {
        if (typeof FRAGMENTS === 'undefined' || FRAGMENTS[id]) {
          this.story.fragments[id] = true;
        }
      }
    }
    this.killedPlaced = (d.killedPlaced && typeof d.killedPlaced === 'object')
      ? Object.assign({}, d.killedPlaced) : {};
    this.garages = (d.garages && typeof d.garages === 'object')
      ? Object.assign({}, d.garages) : {};
    this.wreck = d.wreck ? JSON.parse(JSON.stringify(d.wreck)) : null;
    this.lastGarage = d.lastGarage || null;
    this.explored = (d.explored && typeof d.explored === 'object')
      ? Object.assign({}, d.explored) : {};
    this.permanentsOwned = (d.permanentsOwned && typeof d.permanentsOwned === 'object')
      ? Object.assign({}, d.permanentsOwned) : {};
    this.permanents = (d.permanents && typeof d.permanents === 'object')
      ? JSON.parse(JSON.stringify(d.permanents)) : {};
    this.weaponSkill = (d.weaponSkill && typeof d.weaponSkill === 'object')
      ? Object.assign({}, d.weaponSkill) : {};
    this.presets = Array.isArray(d.presets)
      ? JSON.parse(JSON.stringify(d.presets)) : [];
    this.partsSeen = (d.partsSeen && typeof d.partsSeen === 'object')
      ? Object.assign({}, d.partsSeen) : {};
    this.coreId = (typeof CORES !== 'undefined' && CORES[d.coreId])
      ? d.coreId : 'clip';
    this.rigsOwned = (d.rigsOwned && typeof d.rigsOwned === 'object')
      ? Object.assign({}, d.rigsOwned) : {};
    // A docked rig you do not own is dropped rather than kept as a ghost.
    this.dockedRig = (d.dockedRig && this.rigsOwned[d.dockedRig])
      ? d.dockedRig : null;
    this.parked = (d.parked && typeof d.parked === 'object')
      ? JSON.parse(JSON.stringify(d.parked)) : {};
    this.parkedChassis = Array.isArray(d.parkedChassis)
      ? JSON.parse(JSON.stringify(d.parkedChassis)) : [];
    // A parked wreck of a machine that is not one, or that this save
    // already owns, is dropped at the door -- the same rule as unlockedRigs.
    this.parkedMachines = (Array.isArray(d.parkedMachines) ? d.parkedMachines : [])
      .filter(m => m && JACKRIGS[m.machineId] && !this.rigUnlocked(m.machineId))
      .map(m => ({ machineId: m.machineId, garage: m.garage || null }));
    this.shortcuts = (d.shortcuts && typeof d.shortcuts === 'object')
      ? Object.assign({}, d.shortcuts) : {};
    this.finds = (d.finds && typeof d.finds === 'object')
      ? Object.assign({}, d.finds) : {};
    this.missions = (d.missions && typeof d.missions === 'object')
      ? Object.assign({}, d.missions) : {};
    this.towed = (d.towed && typeof d.towed === 'object')
      ? Object.assign({}, d.towed) : {};
    this.rode = (d.rode && typeof d.rode === 'object')
      ? Object.assign({}, d.rode) : {};
    this.roamerDamage = (d.roamerDamage && typeof d.roamerDamage === 'object')
      ? Object.assign({}, d.roamerDamage) : {};
    this.roamerAt = (d.roamerAt && typeof d.roamerAt === 'object')
      ? JSON.parse(JSON.stringify(d.roamerAt)) : {};
    this.radioHeard = (d.radioHeard && typeof d.radioHeard === 'object')
      ? Object.assign({}, d.radioHeard) : {};
    this.escorted = (d.escorted && typeof d.escorted === 'object')
      ? Object.assign({}, d.escorted) : {};
    this.taught = (d.taught && typeof d.taught === 'object')
      ? Object.assign({}, d.taught) : {};
    this.paint = (d.paint && typeof d.paint === 'object')
      ? JSON.parse(JSON.stringify(d.paint)) : {};
    this.colourPresets = Array.isArray(d.colourPresets)
      ? JSON.parse(JSON.stringify(d.colourPresets)) : [];
    this.xp = Number(d.xp) || 0;
    this.skills = (d.skills && typeof d.skills === 'object')
      ? Object.assign({}, d.skills) : {};
    this.coresOwned = (d.coresOwned && typeof d.coresOwned === 'object')
      ? Object.assign({}, d.coresOwned) : {};
    this.paintOwned = (d.paintOwned && typeof d.paintOwned === 'object')
      ? Object.assign({}, d.paintOwned) : {};
    this.foundSlots = Number(d.foundSlots) || 0;
    this.bossesPaid = (d.bossesPaid && typeof d.bossesPaid === 'object')
      ? Object.assign({}, d.bossesPaid) : {};
    this.delivered = (d.delivered && typeof d.delivered === 'object')
      ? Object.assign({}, d.delivered) : {};
    this.districtsEntered = (d.districtsEntered && typeof d.districtsEntered === 'object')
      ? Object.assign({}, d.districtsEntered) : {};
    this.barrierKinds = (d.barrierKinds && typeof d.barrierKinds === 'object')
      ? Object.assign({}, d.barrierKinds) : {};
    this.xpFirsts = (d.xpFirsts && typeof d.xpFirsts === 'object')
      ? Object.assign({}, d.xpFirsts) : {};
    this.scenesPlayed = (d.scenesPlayed && typeof d.scenesPlayed === 'object')
      ? Object.assign({}, d.scenesPlayed) : {};
    this.endingReached = !!d.endingReached;
    this.ending = (typeof ENDINGS !== 'undefined' && ENDINGS[d.ending]) ? d.ending : null;
    this.upgradeParts = Number(d.upgradeParts) || 0;
    // Only classes and variants that still EXIST come back. A save from a
    // build where a weapon has since been renamed must not leave scrap and
    // upgrade parts spent on nothing — the same rule Rack.restore follows.
    this.spine = {};
    const sp2 = (d.spine && typeof d.spine === 'object') ? d.spine : {};
    for (const k of Object.keys(sp2)) {
      if (typeof WEAPON_SPINES !== 'undefined' && WEAPON_SPINES[k]) {
        this.spine[k] = Number(sp2[k]) || 0;
      }
    }
    this.capstones = {};
    const cp = (d.capstones && typeof d.capstones === 'object') ? d.capstones : {};
    for (const k of Object.keys(cp)) {
      if (typeof WEAPON_VARIANTS !== 'undefined' && WEAPON_VARIANTS[k]) {
        this.capstones[k] = true;
      }
    }
    this.gadgets = (d.gadgets && typeof d.gadgets === 'object')
      ? Object.assign({}, d.gadgets) : {};
    // Only gadgets still OWNED come back fitted, and only as many as the
    // slots allow. A save from a build with GADGET BAY, loaded into one
    // without, must not leave a machine drawing power for a gadget it cannot
    // fit — which is the same rule Rack.restore follows for unknown parts.
    this.gadgetsFitted = Array.isArray(d.gadgetsFitted)
      ? d.gadgetsFitted.filter(id => typeof GADGETS !== 'undefined' &&
          GADGETS[id] && (this.gadgets[id] || 0) > 0) : [];
    if (typeof Gadgets !== 'undefined') Gadgets.trim();
    // Only parts that still EXIST come back on it. A save from a build where
    // a part has since been renamed must not put a boss together out of
    // nothing — the same rule Rack.restore follows.
    this.roamerWears = {};
    const rw = (d.roamerWears && typeof d.roamerWears === 'object') ? d.roamerWears : {};
    for (const bid of Object.keys(rw)) {
      const list = Array.isArray(rw[bid]) ? rw[bid] : [];
      this.roamerWears[bid] = list.filter(w => w && w.partId &&
        typeof PARTS !== 'undefined' && PARTS[w.partId]);
    }
    if (FRAME_IDS.indexOf(d.frameId) >= 0) this.frameId = d.frameId;
    this.mapsCleared = Math.max(0, d.mapsCleared || 0);
    // Validated against the real district table, so a hand-edited or
    // out-of-date save cannot make the front end name a place that does not
    // exist - it falls back to "wherever ENTER would take you" instead.
    this.lastDistrictId = (typeof DISTRICTS !== 'undefined' &&
      d.lastDistrictId && DISTRICTS[d.lastDistrictId]) ? d.lastDistrictId : null;
    Rack.restore(d.rack);
    Mastery.restore(d.mastery);
    Forge.restore(d.forge);
    if (typeof WeaponLab !== 'undefined') WeaponLab.restore(d.weaponLab);
    if (typeof Mods !== 'undefined') Mods.restore(d.mods);
    return true;
  },

  // ---- persistence to the save file --------------------------------------
  save() {
    if (typeof Save === 'undefined') return false;
    Save.progress = this.snapshot();
    return Save.save();
  },

  load() {
    if (typeof Save === 'undefined' || !Save.progress) { this.newSave(); return false; }
    return this.restore(Save.progress);
  },

  // ---- M2 DEV PROOFS ------------------------------------------------------
  // Both of these are milestone scaffolding and both are named as such, so
  // nobody later mistakes them for shipping behaviour.
  //
  // Master §9 makes Frame growth story-earned at Boss 2, and Master §15 opens
  // G2 only after Boss 1 — so on Map 1 neither can legitimately happen yet.
  // M2 still has to prove both loops WORK before ten of them are built on top,
  // which is exactly what a dev trigger is for.
  // DEV-ONLY-BEGIN
  DEV: {
    // "one dev-triggered/story-style Frame transition Bare -> Patch to prove
    // the physical upgrade presentation; NO SCRAP purchase."
    forceFrameUp(player) {
      const step = Progress.advanceFrame(player);
      if (step) Progress.save();
      return step;
    },

    // "Yard Rack with a single working part type and one Grade recovery
    // (G1 -> G2)." The drop is forced because Map 1 cannot legally produce a
    // G2 yet; the RECOVERY LOOP it exercises is the real thing.
    // M5: "others dev-forceable." One switch opens every chassis for testing
    // builds and art without playing five maps; a real save never calls it.
    forceUnlockAllRigs() {
      for (const id of JACKRIG_LIST) Progress.unlockRig(id);
      Progress.save();
      return Progress.unlockedRigs.slice();
    },

    enabled: true,
    dropG2Cannon(state) {
      if (!this.enabled || !state || !state.player) return false;
      const a = Math.random() * Math.PI * 2;
      const d = 620 + Math.random() * 260;
      LooseParts.spawn('cannon', 1,
        state.player.x + Math.cos(a) * d,
        state.player.y + Math.sin(a) * d, 0, 0, 'G2');
      Effects.comicWord('G2 CANNON DETECTED', state.player.x,
        state.player.y - 280, GRADES.G2.colour, 52);
      return true;
    },
  },
  // DEV-ONLY-END

  // One line the player can read and repeat. If this cannot be written
  // truthfully, the progression is not working.
  summary() {
    const bits = [];
    bits.push(this.frame.name);
    const forged = FORGE_TRACK_LIST.filter(id => Forge.levelOf(id) > 0);
    if (forged.length) {
      bits.push(forged.map(id =>
        FORGE_TRACKS[id].name + ' ' + Forge.levelOf(id)).join(', '));
    }
    const upgraded = Rack.typesOwned().filter(id => Rack.bestN(id) > 1);
    if (upgraded.length) {
      bits.push(upgraded.map(id =>
        PARTS[id].name + ' ' + Rack.best(id)).join(', '));
    }
    const mastered = Mastery.tracks().filter(id => Mastery.levelOf(id) > 1);
    if (mastered.length) {
      bits.push(mastered.map(id =>
        PARTS[id].name + ' MASTERY ' + Mastery.levelOf(id)).join(', '));
    }
    return bits.join('  •  ');
  },
};

// Grade changes a component's OUTPUT and DURABILITY, and never its Power Cost
// (Master §15). Kept as a free function so both the player and any future
// enemy/Warden hardware go through exactly the same rule.
function applyGradeToComponent(comp, gradeId) {
  // Master §22: Prototypes are not G6 and take NO Grade scaling — refused at
  // the one function every grade assignment goes through.
  if (comp.part && comp.part.prototype) return comp;
  const g = GRADES[gradeId] || GRADES.G1;
  comp.grade = g.id;
  comp.gradeOutput = g.output;
  comp.gradeDurability = g.durability;
  comp.maxHp = Math.round(comp.maxHp * g.durability);
  comp.hp = comp.maxHp;
  comp.maxConnectorHp = Math.round(comp.maxConnectorHp * g.durability);
  comp.connectorHp = comp.maxConnectorHp;
  return comp;
}

// SCRAPCORE: BREAKLANDS — Game states (Milestones 1–3)
// States: BOOT -> HOME -> GAME (input test arena).
// GAME currently renders the Milestone 2 scaling test objects plus the
// Milestone 3 twin-stick controls, so both milestones can be verified
// on a real phone before Milestone 4 (player movement) begins.

const Game = {
  state: null,
  states: {},
  debug: false,
  paused: false,

  init() {
    Save.load();                      // unlocks/settings from last session
    Progress.load();                  // M2: Frame, Rack, Mastery, Forge, SCRAP
    Settings.apply();                 // now that every system exists
    this.states.BOOT = new BootState();
    this.states.HOME = new MenuState();
    this.states.GAME = new GameState();
    this.states.YARD = new YardState();           // M2: the permanent layer
    this.states.MAP = new MapState();             // Block 1: the district map
    // Block 5: the garage screen. It ABSORBED Block 4's FitState — two
    // screens doing the same job is how a player learns to trust neither.
    this.states.GARAGE = new GarageState();
    // Every weapon variant becomes a real entry in PARTS, so the firing
    // pipe, the draw path and Mastery treat one exactly like any other
    // part. Registered ONCE, before any save is read for what is fitted.
    Permanents.register();
    // M3, temporary: the §3.1 worst-case rig, for certifying the camera.
    // Goes when the camera is frozen — see js/certstate.js.
    this.states.INTRO = new IntroState();
    this.states.ENDING = new EndingState();
    this.states.CREDITS = new CreditsState();
    this.switch('BOOT');

    Display.onResize(() => {
      Controls.layout();
      if (this.state && this.state.onResize) this.state.onResize();
    });
    Controls.layout();

    // Suspend rule groundwork (Milestone 22/82): pause when backgrounded.
    // Losing WINDOW focus releases everything held, exactly like being
    // backgrounded — alt-tab must not leave a machine driving itself.
    window.addEventListener('blur', () => Controls.releaseAll());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.paused = true;
        Controls.releaseAll();
        if (typeof Save !== 'undefined') Save.save();   // plan §65/§82
        if (typeof Audio_ !== 'undefined') Audio_.suspend();
      }
    });
  },

  switch(name) {
    if (typeof Audio_ !== 'undefined') {
      // GAME plays nothing here: a district's entry music is started by
      // _enterDistrict, for twenty seconds, and the bed is the soundtrack.
      if (name === 'HOME' || name === 'CREDITS' ||
               name === 'YARD' || name === 'MAP' || name === 'GARAGE') {
        Audio_.playMusic('menu');
      } else if (name === 'ENDING' || name === 'INTRO') Audio_.stopMusic();
    }
    if (this.state && this.state.exit) this.state.exit();
    this.state = this.states[name];
    this.stateName = name;
    Controls.releaseAll();
    if (this.state.enter) this.state.enter();
  },

  update(dt) {
    if (Display.isPortrait) return;      // portrait overlay is up; hold state
    this.state.update(dt);
    Controls.endFrame();
  },

  render() {
    this.state.render();
  },

  // Pointer routing from PointerHub
  pointerDown(id, x, y) {
    // Mobile browsers only allow audio to start from a real gesture.
    if (typeof Audio_ !== 'undefined') Audio_.unlock();
    // Same gesture buys fullscreen + landscape lock (plan §24).
    if (typeof Fullscreen !== 'undefined') Fullscreen.request();
    this.paused = false; // any touch resumes after a background suspend
    if (this.state.pointerDown) this.state.pointerDown(id, x, y);
  },
  pointerMove(id, x, y) {
    if (this.state.pointerMove) this.state.pointerMove(id, x, y);
  },
  pointerUp(id) {
    if (this.state.pointerUp) this.state.pointerUp(id);
  },
};

// ===========================================================================
// BOOT — fast splash (plan §6): logo fades in, auto-continue ~1.5 s.
class BootState {
  enter() { this.t = 0; }
  update(dt) {
    this.t += dt;
    if (this.t > 1.5) Game.switch('HOME');
  }
  pointerDown() { if (this.t > 0.3) Game.switch('HOME'); } // tap to skip
  render() {
    R.clear(CONFIG.COLOR.ink);
    const a = Math.min(this.t / 0.6, 1);
    R.ctx.globalAlpha = a;
    // Real logo when the art has loaded; the typeset fallback otherwise, so
    // boot never waits on an image.
    const drew = typeof Assets !== 'undefined' &&
      Assets.sprite(R.ctx, 'logo', 960, 520, 1100, 672, 0);
    if (!drew) {
      R.text('SCRAPCORE', 960, 490, 130, CONFIG.COLOR.yellow);
      R.text('ZERO', 960, 610, 96, CONFIG.COLOR.cyan);
    }
    if (typeof UI !== 'undefined' && UI.fitInto) {
      UI.fitInto(R.ctx, 'logo_studio', 960, 760, 210, 150);
    }
    R.ctx.globalAlpha = 1;
  }
}

// ===========================================================================
// GAME — Milestone 4: real arena, player Core movement, following camera.
// Seconds before the next wave pushes in regardless of survivors.
const WAVE_TIME_SECONDS = 22;
// Crusher escorts: it has no ranged attack, so once its ram telegraph is
// learned the fight becomes a slow circle. A couple of escorts keep the floor
// dangerous. Never stacked — a new pair only after the last pair is dead.
const BOSS_ADD_GAP = 40;      // seconds after the last escort dies
const BOSS_ADD_COUNT = 2;     // alive at once, never more

// Pillar obstacles pick their art by `style` — how a map gets its own props
// (Voltworks pillars are reactors, the War Depot's are gun turrets, collapse
// debris is rubble) without new obstacle types or new draw code.
const PILLAR_ART = {
  scrap: 'prop_scrapHeap',
  reactor: 'prop_reactor',        // Map 3 VOLTWORKS
  turret: 'prop_turret',          // Map 5 WAR DEPOT
  debris: 'prop_debrisPillar',    // Map 6 collapse rubble
  steam: 'prop_steamStack',       // Map 7 FURNACE MILE
  coolant: 'prop_coolantRig',     // Map 7 FURNACE MILE
  hazardRig: 'prop_hazardRig',    // Map 8 PROVING GROUND
  scanner: 'prop_scanner',        // Map 8 PROVING GROUND
  crown: 'prop_crownMachinery',   // Map 10 CROWN FORGE
};

class GameState {
  enter() {
    if (this.player) this.player.cellPower = 0;   // power cells are run-only
    Tutorial.start();
    this.partUse = {};               // for FAVOURITE PART on the results screen
    this.peakPower = 0;
    this.unlockBanner = null;
    this.unlockT = 0;
    this.rankButtons = null;
    this.scrapped = false;
    this.deathT = 0;
    this.pendingUnlockNames = [];
    this.dashFlash = 0;
    this.magnetHeld = 0;
    this.player = null;              // built by _enterDistrict

    this.paused = false;
    this.confirm = null;
    this.pauseButtons = null;
    // CONTENT_WORLD: THE YARD is where CLIP wakes up, marked as scrap — and
    // it is still where a FRESH save begins. But ENTER THE BREAKLANDS has
    // named the district you were last standing in since the menu pass, and
    // a caption that promises THE SPRAWL while the button delivers THE YARD
    // is a lie (HANDOVER open question 8). Resume means resume: the saved,
    // validated lastDistrictId is the destination, and on a fresh save it is
    // null and the Yard wins.
    const resume = (typeof Progress !== 'undefined' && Progress.lastDistrictId &&
      DISTRICTS[Progress.lastDistrictId])
      ? DISTRICTS[Progress.lastDistrictId] : DISTRICTS.yard;
    this._enterDistrict(resume);
    // "Belt's stopped. You're upright." The first thing anybody says to you,
    // fired after the district so it queues behind the arrival line rather
    // than being overwritten by it.
    if (typeof Radio !== 'undefined') Radio.fire('first_boot');
    this.buildButtons();
  }

  // Wake at your last garage with the machine rebuilt from what is
  // permanently yours. Everything banked is still here; the stolen gear you
  // had not banked is in the wreck you just left.
  respawnAtGarage() {
    const at = Garages.respawnPoint();
    this.scrapped = false;
    this.player.x = at.x;
    this.player.y = at.y;
    this.player.vx = 0; this.player.vy = 0;
    this.player.alive = true;
    this.player.hp = this.player.maxHp;
    this.player.heat = 0;
    this.player.overheated = false;
    // The permanent machine, rebuilt from the Rack. Progress.buildMachine
    // only ever fits hardware the Rack permanently owns, which is the same
    // sentence as 'you keep everything permanent'.
    if (typeof Progress !== 'undefined') Progress.buildMachine(this.player);
    Machine.recalcStats(this.player);
    Camera.snapTo(this.player.x, this.player.y);
    if (typeof Alert !== 'undefined') Alert.clearAtGarage();
    Garages.message = 'RECOVERED AT ' +
      ((Garages.nearest && Garages.nearest.g.name) || 'THE YARD');
    Garages.messageT = 4;
    Garages.update(0, this.player, this);
  }

  // Adopt a new entity list and rebuild the tick / draw / band indices.
  // Called on load and on every chunk load or unload — never per frame,
  // which is the whole reason the indices are worth keeping.
  setEntities(list) {
    this.entities = list;
    const idx = Hazards.orderIndex(list);
    this._updIdx = idx.update;
    this._drawIdx = idx.draw;
    this._bandIdx = idx.band;
    this._tags = idx.tags;
  }

  // BLOCK 1. Enter a district and stream it. The Block 0 placeholder — one
  // flat handmade room — is gone; the world is now a grid of chunks and the
  // arena rect is the whole district.
  _enterDistrict(district, at) {
    // CONTENT_WORLD: `THE YARD — start here. Where CLIP wakes up, marked as
    // scrap.` It is also the only garage in the game that is given rather
    // than earned, which is what makes it the place you begin.
    this.district = district || DISTRICTS.yard;
    this.arenaName = this.district.name;
    // ITEM 4: the front end names the district you are in, and has to be
    // able to do it with no world loaded. One assignment, at the one place
    // that changes which district you are standing in.
    if (typeof Progress !== 'undefined') Progress.lastDistrictId = this.district.id;
    // "First entry to a district -- 20 seconds, then it fades into the
    // ambient bed." On a CHANGE of district, not on every switch to GAME:
    // coming back from the pause menu is not an entry.
    if (typeof Audio_ !== 'undefined' && Audio_.playMusicFor &&
        this._musicDistrict !== this.district.id) {
      this._musicDistrict = this.district.id;
      Audio_.playMusicFor('scrapyard', Audio_.ENTRY_MUSIC);
    }
    this.arena = World.enter(this.district);
    // A run does not survive a district change: the thing you were walking
    // somewhere is in the district you left, and carrying it through a gate
    // would be teleporting the mission rather than doing it.
    if (typeof Escorts !== 'undefined') Escorts.reset();
    // MAGS ON ARRIVAL. Fired from the ONE place that changes which district
    // you are standing in - and only for a real district, so walking into a
    // lair does not get a line about the place you were already in.
    // "FIRST ENTRY TO A DISTRICT — 1,500 XP." Here rather than in
    // `World.enter`, because this is the player ARRIVING somewhere and that is
    // the world being BUILT — the loader and the tools call the second one,
    // and an award there would write to the save mid-reload.
    //
    // One-way, so walking back and forth over a district line is not an
    // income, and interiors are excluded: a lair is a room inside a place you
    // already arrived at.
    if (typeof Progress !== 'undefined' && typeof Levels !== 'undefined' &&
        Levels.addXp && !this.district._spec.interior) {
      Progress.districtsEntered = Progress.districtsEntered || {};
      if (!Progress.districtsEntered[this.district.id]) {
        Progress.districtsEntered[this.district.id] = true;
        Levels.addXp(GARAGE.XP_DISTRICT);
      }
    }
    if (typeof Radio !== 'undefined' && !this.district._spec.interior) {
      Radio.enter(this.district.id);
    }

    // PHASE C: the district's exits stand at its edges, world-owned — an
    // exit is infrastructure and exists whether or not its chunk is loaded.
    if (typeof DistrictExit !== 'undefined' && this.district._spec) {
      for (const ex of (this.district._spec.exits || [])) {
        // Through the registry, not `new` — make() stamps the type the
        // update/draw dispatch reads, and forgetting that stamp is exactly
        // the class of bug the registry exists to prevent.
        World.own(Hazards.make('exits', [
          ex.cx * WORLD.CHUNK + (ex.x === undefined ? 1536 : ex.x),
          ex.cy * WORLD.CHUNK + (ex.y === undefined ? 1536 : ex.y), ex.to,
        ], null, null));
      }
    }

    // `at` is where an exit delivered you; a plain entry uses the district's
    // own spawn point.
    const spawn = at || World.spawnPoint();
    // AND A SPAWN POINT IS NEVER ON A GATE. The Ironworks and the Ash
    // Barrens both spawn on the chunk that holds their exit to the Yard, so
    // a plain entry -- ENTER THE BREAKLANDS resuming where you last saved --
    // stood you inside EXIT.GO_R of the gate and `_checkExits` sent you to
    // the Yard on the first frame. A player who saved in the Ironworks woke
    // up in the Yard, every time. Found the first time the cold run stepped
    // a real GameState.update. Stepped inward the way `_travelTo` steps an
    // arrival, from the nearest gate, so the spawn is a spawn.
    if (!at && typeof DistrictExit !== 'undefined' && typeof EXIT !== 'undefined') {
      let near = null, nd = Infinity;
      for (const o of World.owned) {
        if (!(o instanceof DistrictExit)) continue;
        const d = Math.hypot(o.x - spawn.x, o.y - spawn.y);
        if (d < nd) { nd = d; near = o; }
      }
      if (near && nd < EXIT.NEAR_R) {
        const ccx = this.district.cols * WORLD.CHUNK / 2;
        const ccy = this.district.rows * WORLD.CHUNK / 2;
        const dx = ccx - near.x, dy = ccy - near.y;
        const m = Math.hypot(dx, dy) || 1;
        spawn.x = near.x + (dx / m) * EXIT.ARRIVE_STEP;
        spawn.y = near.y + (dy / m) * EXIT.ARRIVE_STEP;
      }
    }
    // Build the player's own chunk and its neighbours BEFORE the player
    // exists, with no budget: arriving in a world that has not been built
    // yet means spawning inside geometry that appears a frame later.
    World.update(spawn.x, spawn.y, Infinity);
    this._adoptWorld();

    if (!this.player) {
      this.player = new PlayerCore(spawn.x, spawn.y, Profile.chassis);
      Machine._xpPlayer = this.player;
      // §20 identity: the machine rides the Yard's selected Jackrig, so the
      // SPECIAL button is not a dead light out here.
      this.player.jackrigId = (typeof Progress !== 'undefined' &&
        Progress.jackrigId) || 'jackal';
      // Progress.buildMachine is the ONE place that answers "what is my
      // machine" (menus.js says so, and the garage and the recovery path
      // both ask it). This branch used to answer it a second way — the
      // starter weapon on socket 0 and nothing else — so a fresh session
      // walked out WITHOUT its Frame: no frameId, so the Jackrig's model
      // never drew and ZERO's Scrapper stood in for it; 100 HP at 640 u/s
      // from the Scrapper chassis instead of JACKAL BARE's 74 at 576; no
      // permanent gun, no armour plate. The first garage visit or the first
      // death rebuilt it properly and everything changed under the player
      // (D336). The fallback below is the menu's own, for a build with no
      // Progress at all.
      if (typeof Progress !== 'undefined' && Progress.buildMachine) {
        Progress.buildMachine(this.player);
      } else {
        // Starter weapon (plan §8) goes on socket 0 at the top of the machine.
        Machine.attach(this.player, Profile.starter, 0);
      }
      Profile.discover(Profile.starter);
      Machine.recalcStats(this.player);
    } else {
      this.player.x = spawn.x;
      this.player.y = spawn.y;
      this.player.vx = 0; this.player.vy = 0;
    }
    // THE OWNERSHIP RULE: the player is never chunk-owned.
    this.player._chunk = null;
    Camera.snapTo(this.player.x, this.player.y);
    Camera.zoom = 1;

    Projectiles.init();
    Mines.init();
    Effects.init();
    LooseParts.init();
    Pickups.init();
    Magnet.reset();
    Machine._xpPlayer = this.player;   // salvage credit routes to the player
    EmergencyBlaster.cooldown = 0;
    // AND THE FRAME GROWS (Q6). A new district reached is a frame stage
    // earned; the one-way record `districtsEntered` above decides both.
    // Grown HERE, after the player stands in the district and after
    // Effects.init() -- the first draft grew it beside the XP award, and
    // the comic word, the ring and the shake it fires were wiped by the
    // effects reset eighty lines later: the frame grew and nobody saw it
    // (the `grown` shot refused the picture). Not inside the "new
    // district" branch, so a save from before the rule catches up on its
    // next entry, with the same fanfare.
    if (typeof Progress !== 'undefined' && Progress.growFrame &&
        !this.district._spec.interior) {
      Progress.growFrame(this.player);
    }

    // Reused every frame by the depth-sorted world pass, so the sort does
    // not allocate a fresh array sixty times a second.
    this._band = [];
    this._discoverT = 0;
    this._aliveLast = 0;
    Unlocks.startEncounter();

    // Block 2 owns who is in the district. Population holds the machines and
    // the state borrows the list every frame, so every existing system that
    // reads `this.enemies` keeps working unchanged.
    Population.reset();
    Garages.enter(this.district);
    // A GARAGE IS A BUILDING. Same treatment as an exit and for the same
    // reason: the place you bank is infrastructure and must exist whether or
    // not its chunk happens to be loaded. Until now nothing stood here at all
    // — the most important place in the game was an invisible circle. AFTER
    // Garages.enter, because that is what fills the list this reads.
    if (typeof GarageBuilding !== 'undefined') {
      for (const g of Garages.list) {
        World.own(Hazards.make('garageBuildings', [g.x, g.y, g.id], null, null));
      }
      this._adoptWorld();
    }

    // BLOCK 13. THE PEOPLE. World-owned for the same reason a garage is:
    // somebody who has stood in one place for four hundred years does not
    // come and go with a chunk. Placed from NPCS' own `at`, so adding a person
    // is one entry in the content library and nothing here.
    if (typeof NPC !== 'undefined' && typeof NPCS !== 'undefined') {
      for (const nid of Object.keys(NPCS)) {
        const n = NPCS[nid];
        if (!n.at || n.district !== this.district.id) continue;
        // AND WHATEVER THEY ASKED FOR. An NPC standing somewhere you cannot
        // reach yet is not a person, it is a promise you cannot keep.
        if (typeof Missions !== 'undefined' && Missions.npcPresent &&
            !Missions.npcPresent(nid)) continue;
        World.own(Hazards.make('npcs', [
          n.at[0] * WORLD.CHUNK + WORLD.CHUNK / 2,
          n.at[1] * WORLD.CHUNK + WORLD.CHUNK / 2, nid,
        ], null, null));
      }
      this._adoptWorld();
    }
    // RAIL SPINE. THE TRAINS. World-owned, because a train runs the whole
    // length of the district and belongs to no chunk — the same argument as a
    // district gate, and the reason the owned list exists at all.
    if (typeof MovingFreight !== 'undefined' &&
        typeof RAILSPINE_LINES !== 'undefined' &&
        this.district.id === 'railspine') {
      const H = this.district.rows * WORLD.CHUNK;
      const n = 9;                                  // the nine lines
      for (const t of RAILSPINE_LINES) {
        World.own(Hazards.make('freight', [
          400, (t.line + 0.5) * (H / n),
          this.district.cols * WORLD.CHUNK - 800,
          t.cars, t.dir, t.phase,
          t.to || null,
          t.toCx === undefined ? null : t.toCx * WORLD.CHUNK + WORLD.CHUNK / 2,
        ], null, null));
      }
      this._adoptWorld();
    }

    // BLOCK 14. LAIR MOUTHS. World-owned like a district gate: a door in the
    // world exists whether or not its chunk is loaded.
    if (typeof Lairs !== 'undefined' && typeof LairDoor !== 'undefined') {
      Lairs.registerBuilds();
      for (const lid of Object.keys(LAIRS)) {
        const L = LAIRS[lid];
        if (L.district !== this.district.id) continue;
        World.own(Hazards.make('lairDoors', [
          L.at[0] * WORLD.CHUNK + WORLD.CHUNK / 2,
          L.at[1] * WORLD.CHUNK + WORLD.CHUNK / 2, lid,
        ], null, null));
      }
      // THE WAY OUT of a beaten lair. A sealed lair has no exits at all; the
      // door back is spawned only once the boss is dead, which is what makes
      // the commitment real rather than a prompt asking if you are sure.
      const inLair = this.district._spec && this.district._spec.lairOf;
      if (inLair && Lairs.beaten(inLair)) {
        const home = LAIRS[inLair].district;
        World.own(Hazards.make('exits', [
          this.district.cols * WORLD.CHUNK / 2,
          this.district.rows * WORLD.CHUNK - 400, home,
        ], null, null));
      }
      this._adoptWorld();
    }
    Garages.applyGradeAccess();      // 3.6: grade access is garages owned
    Wrecks.restore();
    this.enemies = Population.machines;
    this.lastSpecs = [];

    // The posts the already-loaded chunks brought with them were registered
    // before Population.reset() cleared them, so re-offer them.
    for (const k of Object.keys(World.loaded)) {
      Population.onChunkLoad(World.loaded[k]);
    }
  }

  // Take the world's current entity and collision lists. Called on entry and
  // whenever streaming changes them — never per frame.
  _adoptWorld() {
    this.obstacles = World.obstacles;
    this.setEntities(World.entities);
    Machine.world = { arena: this.arena, obstacles: this.obstacles };
  }

  onResize() { this.buildButtons(); }

  buildButtons() {
    const s = Display.safe;
    this.buttons = new UIButtons();
    // THE PAUSE BUTTON WAS SITTING ON TOP OF THE DBG BUTTON, and not only
    // visually: `_pauseButtonRect` is s.right-110, 94 wide, and DBG ran from
    // s.right-186 to s.right-16, so the pause rect was entirely INSIDE it --
    // and `pointerDown` tests the pause rect first. Tapping the right half of
    // DBG opened the pause menu. Found by tools/hudcheck.py, which reported
    // the word DBG as 61% painted over by a box drawn after it.
    //
    // The row now reads, right to left: pause (94), DBG (170), HOME (170),
    // CHUNKS (190), each with a 12-pixel gap. Every number below is
    // s.right minus a running total, so a change to one moves the rest.
    // HOME sits beside the pause button in a player build. In a dev build
    // DBG sits between them, so HOME moves one slot left; the compass reads
    // HOME's actual rect for its right-hand clearance rather than a copy of
    // this number (D318 was two constants agreeing by hand until one moved).
    this.buttons.add('HOME', s.right - (CONFIG.DEV ? 474 : 292), s.top + 16, 170, 76,
      () => Game.switch('HOME'), { size: 34 });
    // DEV-ONLY-BEGIN
    // THE DBG BUTTON, THE CHUNK OVERLAY AND THE DEV RIG exist in a dev build
    // only (CONFIG.DEV: index.html opened with ?dev). The standalone build
    // strips everything between these two markers, so a player's copy does
    // not carry the code. Nineteen blocks of screenshots had DBG next to
    // HOME in every one of them; plan §88 is "no debug menus left exposed".
    if (CONFIG.DEV) {
      this.buttons.add('DBG', s.right - 292, s.top + 16, 170, 76,
        () => { Game.debug = !Game.debug; this.buildButtons(); },
        { size: 34, color: CONFIG.COLOR.violet, textColor: CONFIG.COLOR.white });
    }
    if (CONFIG.DEV && Game.debug) {
      this.buttons.add(Game.debugChunks ? 'CHUNKS*' : 'CHUNKS',
        s.right - 676, s.top + 16, 190, 76,
        () => { Game.debugChunks = !Game.debugChunks; this.buildButtons(); },
        { size: 28, color: CONFIG.COLOR.cyan, textColor: CONFIG.COLOR.ink });
    }

    // DEV RIG (part cycler, zone/boss jumps, +XP, RANK+). Hidden unless the
    // DBG toggle is on, so a normal player never sees it (plan §88: no debug
    // menus left exposed).
    if (CONFIG.DEV && Game.debug) {
      // Milestone 12 test rig: cycle through ALL 24 parts, bolt one on,
      // or DROP it as loose salvage to test the Magnet path.
      // (Scaffolding — replaced by real encounters/Garage in M13/M16.)
      this.rigIdx = this.rigIdx ?? 0;
      // The dev cycler covers the WHOLE hangar: catalogue + Prototypes.
      const DEV_PARTS = PART_LIST.concat(
        typeof PROTO_LIST !== 'undefined' ? PROTO_LIST : []);
      const rigPart = () => PARTS[DEV_PARTS[this.rigIdx]];
      const cx = 960, bw = 96, lw = 380, bh = 66, y0 = s.top + 16, gap = 10;
      this.buttons.add('CLR', cx - lw / 2 - gap * 2 - bw - 140, y0, 140, bh, () => {
        Machine.clearAll(this.player);
      }, { size: 26, color: CONFIG.COLOR.red });
      // §27 profile rig (dev only): cycle Map 1-10, spawn a profile wave —
      // families, brains, Grades and one Elite, all from the data table.
      this.mapIdx = this.mapIdx ?? 1;
      this.buttons.add('MAP ' + this.mapIdx, s.left + 496, y0 + 164, 170, bh, () => {
        this.mapIdx = this.mapIdx % 10 + 1;
        this.buildButtons();
      }, { size: 24, color: CONFIG.COLOR.cyan });
      this.buttons.add('WAVE', s.left + 686, y0 + 164, 150, bh, () => {
        const specs = SpawnGen.wave(this.mapIdx, 5);
        const born = Director.spawn(specs, this.arena, this.obstacles,
          this.player, this.enemies.filter(e => e.alive));
        this.enemies = this.enemies.concat(born);
      }, { size: 26, color: CONFIG.COLOR.orange });
      // Warden fight rig (dev only): cycle the roster, spawn the pick in its
      // FINAL phase, fight it on the spot. This is how each boss gets its
      // "press the button" pass before its map exists.
      this.wardenIdx = this.wardenIdx ?? 0;
      const wNames = Wardens.list();
      this.buttons.add('W:' + wNames[this.wardenIdx % wNames.length],
        s.left + 16, y0 + 164, 300, bh, () => {
        this.wardenIdx = (this.wardenIdx + 1) % wNames.length;
        this.buildButtons();
      }, { size: 24, color: CONFIG.COLOR.violet, textColor: CONFIG.COLOR.white });
      this.buttons.add('FIGHT', s.left + 326, y0 + 164, 150, bh, () => {
        const name = wNames[this.wardenIdx % wNames.length];
        const w = Wardens.create(name, this.player.x, this.player.y - 700,
          WARDEN_PHASE.FINAL, 1);
        this.enemies.push(w);
      }, { size: 26, color: CONFIG.COLOR.red });
      this.buttons.add('<', cx - lw / 2 - gap - bw, y0, bw, bh, () => {
        this.rigIdx = (this.rigIdx + DEV_PARTS.length - 1) % DEV_PARTS.length;
        this.buildButtons();
      }, { size: 30 });
      this.buttons.add(rigPart().name, cx - lw / 2, y0, lw, bh,
        () => {}, { size: 26, color: rigPart().color });
      this.buttons.add('>', cx + lw / 2 + gap, y0, bw, bh, () => {
        this.rigIdx = (this.rigIdx + 1) % DEV_PARTS.length;
        this.buildButtons();
      }, { size: 30 });
      this.buttons.add('+ADD', cx + lw / 2 + gap * 2 + bw, y0, 140, bh, () => {
        Machine.attach(this.player, DEV_PARTS[this.rigIdx]);
      }, { size: 26, color: CONFIG.COLOR.lime });
      this.buttons.add('DROP', cx + lw / 2 + gap * 3 + bw + 140, y0, 140, bh, () => {
        const a = Math.random() * Math.PI * 2;
        LooseParts.spawn(DEV_PARTS[this.rigIdx], 1,
          this.player.x + Math.cos(a) * 380, this.player.y + Math.sin(a) * 380, 0, 0);
      }, { size: 26, color: CONFIG.COLOR.violet, textColor: CONFIG.COLOR.white });
    }
    // DEV-ONLY-END
  }

  // Milestone 13: no hand-written enemy lists any more. The director spends
  // an encounter budget on Cores, brains and parts from this zone's pool.
  // Push the next wave in. Survivors from the previous wave STAY — a wave
  // landing on top of stragglers is the point of timing them.
  // Boss arenas field no ordinary machines, so nothing drops power cells and a
  // heavy rig can starve for the entire fight. Two crates, placed apart, so
  // topping up costs a trip across the floor rather than being free.
  // Mid-fight support and, for the Crusher only, escorts.
  //
  // The Crusher has no ranged attack, so once you learn its ram telegraph the
  // fight becomes a slow circle. A couple of escorts force you to keep moving
  // for a reason. The shooting bosses do not need them.
  // A wave ends when it is wiped OR when its timer runs out — so a player who
  // leaves stragglers alive gets the next wave on top of them.
  // ---- Milestone 14: rank-up overlay -----------------------------------
  // ---- Core Levels: spend panel -----------------------------------------
  // Card geometry, defined ONCE. It used to be computed separately in the build
  // and the draw, which is exactly how the two drifted apart and put text on
  // top of text.
  // THE UNLOCK BANNER. Unlocks.event queues a name the moment a rule is met
  // -- a part, a palette, a difficulty -- and this drains the queue onto the
  // banner. It was called from the arena's between-encounter transition,
  // which went with the arena, so for the whole of BREAKLANDS every unlock
  // was earned and none was ever announced: the queue only grew. Found by
  // unwire --boot over game.js (D334). Called from the loop now, the frame
  // the queue has something in it.
  _showUnlocks() {
    const list = Unlocks.takePending();
    this.pendingUnlockNames = (this.pendingUnlockNames || []).concat(list);
    if (!list.length) return;
    this.unlockBanner = list.join('   \u2022   ') + '  UNLOCKED';
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
    this.unlockT = 4;
    Save.save();
  }

  // SAVE RUN used to write an encounter-boundary checkpoint. There is no run
  // to check-point any more, so this just flushes the permanent layer.
  // Returns false if storage refused it (private mode, quota) so the UI can
  // say so instead of lying.
  saveNow() {
    try {
      // THROUGH Progress.save, which snapshots the run and then writes.
      // Save.save() alone wrote whatever Progress had LAST snapshotted --
      // the garage you entered ten minutes ago -- so SAVE RUN on the pause
      // menu saved nothing you had done since, and said RUN SAVED. Found by
      // unwire --boot over game.js (D334).
      if (typeof Progress !== 'undefined' && Progress.save) return Progress.save() === true;
      return Save.save() === true;
    } catch (e) {
      return false;
    }
  }

  // ---- Pause (plan §64) ---------------------------------------------------
  _buildPause() {
    this.pauseButtons = new UIButtons();
    const w = 520, x = 960 - w / 2;
    // Block 1 added MAP and pushed QUIT TO HOME off the bottom on a short
    // screen. The menu now SIZES ITSELF to the safe area rather than
    // assuming it fits: `fit` is 1 when there is room and shrinks when there
    // is not, so the next entry a later block adds cannot silently strand
    // the last button below the fold. tests/test_boot_cut.js checks every
    // button fits vertically, which is what caught it.
    const top = Display.safe.top + 90;
    const avail = Display.safe.bottom - 40 - top;
    const WANT = 1290;                 // height the full menu wants
    const fit = Math.min(1, avail / WANT);
    const bh = Math.round(96 * fit);
    const gap = Math.round(16 * fit);
    let y = top;
    const add = (label, cb, color) => {
      this.pauseButtons.add(label, x, y, w, bh, cb,
        { size: Math.round(36 * fit), color: color || '#232b44',
          textColor: color ? CONFIG.COLOR.ink : '#ffffff' });
      y += bh + gap;
    };
    add('RESUME', () => { this.paused = false; }, CONFIG.COLOR.lime);
    // Block 1: the district map. On the pause menu because that is the one
    // place a pad can always reach, whatever else is on screen.
    add('MAP', () => { this.paused = false; Game.switch('MAP'); },
      CONFIG.COLOR.cyan);
    add('SAVE RUN', () => {
      const okSave = this.saveNow();
      this.saveMsg = okSave ? 'RUN SAVED' : 'COULD NOT SAVE';
      this.saveMsgT = 2.2;
      this._buildPause();
    }, CONFIG.COLOR.cyan);
    // Sound lives here as well as in Settings: wanting to mute mid-run is the
    // single most common reason to open a pause menu on a phone.
    const vol = (k) => Settings.get(k);
    this.pauseButtons.add('SOUND  ' + (vol('masterVolume') > 0 ? vol('masterVolume') + '%' : 'OFF'),
      x, y, w, bh, () => {
        const steps = [0, 25, 50, 75, 100];
        const cur = steps.indexOf(vol('masterVolume'));
        Settings.set('masterVolume', steps[(cur + 1) % steps.length]);
        this._buildPause();
      }, { size: Math.round(30 * fit),
           color: vol('masterVolume') > 0 ? CONFIG.COLOR.cyan : '#3a4468',
           textColor: vol('masterVolume') > 0 ? CONFIG.COLOR.ink : '#ffffff' });
    y += bh + gap;
    this.pauseButtons.add('MUSIC  ' + (vol('musicVolume') > 0 ? 'ON' : 'OFF'),
      x, y, w / 2 - 8, bh, () => {
        Settings.set('musicVolume', vol('musicVolume') > 0 ? 0 : 70);
        this._buildPause();
      }, { size: Math.round(26 * fit),
           color: vol('musicVolume') > 0 ? '#3a4468' : '#232b44',
           textColor: '#ffffff' });
    this.pauseButtons.add('SFX  ' + (vol('sfxVolume') > 0 ? 'ON' : 'OFF'),
      x + w / 2 + 8, y, w / 2 - 8, bh, () => {
        Settings.set('sfxVolume', vol('sfxVolume') > 0 ? 0 : 90);
        this._buildPause();
      }, { size: Math.round(26 * fit),
           color: vol('sfxVolume') > 0 ? '#3a4468' : '#232b44',
           textColor: '#ffffff' });
    y += bh + gap;
    // Master §11: Pause -> MACHINE -> POWER. Only worth showing when the
    // machine actually HAS powered parts to rank.
    if (this.player && typeof Machine !== 'undefined' &&
        Machine.powerOrder(this.player).length > 1) {
      const short = (this.player.powerDemand || 0) - (this.player.powerCap || 0);
      add('MACHINE  ·  POWER' + (short > 0 ? '   (' + short + ' SHORT)' : ''),
        () => { this.powerPanel = true; this._buildPowerPanel(); },
        short > 0 ? CONFIG.COLOR.red : CONFIG.COLOR.cyan);
    }
    add('RESTART RUN', () => {
      if (this.confirm === 'restart') { this.paused = false; this.confirm = null; this.enter(); }
      else { this.confirm = 'restart'; this._buildPause(); }
    });
    add('QUIT TO HOME', () => {
      if (this.confirm === 'quit') { this.paused = false; this.confirm = null; Game.switch('HOME'); }
      else { this.confirm = 'quit'; this._buildPause(); }
    });
  }

  // ---- POWER priority panel (Master §11) ---------------------------------
  // The player picks what stays lit. Tap a part to promote it to the top of
  // the queue; everything else slides down, and the lights move as you do it.
  _buildPowerPanel() {
    this.powerButtons = new UIButtons();
    const order = Machine.powerOrder(this.player);
    const w = 620, h = 74, x = 960 - w / 2;
    let y = 330;
    order.forEach((s, i) => {
      const c = s.comp;
      const label = (i + 1) + '.  ' + c.part.name + '   ' +
        Machine.powerCostOf(this.player, c) + 'P   ' + (c.online ? 'ON' : 'OFF');
      this.powerButtons.add(label, x, y, w, h, () => {
        // Promote: this part becomes priority 0, everything else keeps its
        // relative order below it. Renumbering the whole list each time keeps
        // the saved priorities dense and comparable.
        const cur = Machine.powerOrder(this.player).filter(k => k !== s);
        s.comp.powerPriority = 0;
        cur.forEach((k, n) => { k.comp.powerPriority = n + 1; });
        Machine.recalcPower(this.player);
        this._buildPowerPanel();
      }, { size: 26,
           color: c.online ? '#1d3a2a' : '#3a1720',
           textColor: c.online ? CONFIG.COLOR.lime : CONFIG.COLOR.red });
      y += h + 10;
    });
    this.powerButtons.add('DONE', 960 - 130, y + 14, 260, 78, () => {
      this.powerPanel = false;
      this.powerButtons = null;
      this._buildPause();
    }, { size: 30, color: CONFIG.COLOR.yellow });
  }

  _drawPowerPanel() {
    const v = Display.viewRect();
    R.rect(v.x, v.y, v.w, v.h, 'rgba(5,6,14,0.9)');
    const p = this.player;
    R.text('POWER  ' + (p.powerUsed || 0) + ' / ' + (p.powerCap || 0),
      960, 200, 72, CONFIG.COLOR.yellow);
    const short = (p.powerDemand || 0) - (p.powerCap || 0);
    R.text(short > 0
      ? 'THE MACHINE WANTS ' + (p.powerDemand || 0) + '.  ' + short + ' SHORT.'
      : 'EVERYTHING IS RUNNING.',
      960, 262, 30, short > 0 ? CONFIG.COLOR.red : CONFIG.COLOR.lime);
    R.smallText('TAP A PART TO KEEP IT LIT — the bottom of the list goes dark first',
      960, 296, 22, CONFIG.COLOR.steel, 'center');
    if (this.powerButtons) this.powerButtons.draw();
  }

  _tickSaveMsg(dt) {
    if (this.saveMsgT > 0) this.saveMsgT = Math.max(0, this.saveMsgT - dt);
  }

  _drawPause() {
    if (this.powerPanel) { this._drawPowerPanel(); return; }
    const v = Display.viewRect();
    R.rect(v.x, v.y, v.w, v.h, 'rgba(5,6,14,0.82)');
    R.text('PAUSED', 960, 270, 96, CONFIG.COLOR.yellow);
    if (this.pauseButtons) this.pauseButtons.draw();
    if (this.confirm) {
      R.text('TAP AGAIN TO CONFIRM', 960, 740, 32, CONFIG.COLOR.red);
    }
    if (this.saveMsgT > 0) {
      R.text(this.saveMsg, 960, 700, 34,
        this.saveMsg === 'RUN SAVED' ? CONFIG.COLOR.lime : CONFIG.COLOR.red);
    }
    R.smallText(this.player.moduleCount + ' MODULES',
      760, 800, 26, CONFIG.COLOR.steel);
  }

  _pauseButtonRect() {
    const s = Display.safe;
    return { x: s.right - 110, y: s.top + 16, w: 94, h: 76 };
  }

  pointerDown(id, x, y) {
    if (Cutscene.playing) { Cutscene.skip(); return; }
    if (this.paused) {
      if (this.powerPanel) { if (this.powerButtons) this.powerButtons.hit(x, y); return; }
      if (this.pauseButtons) this.pauseButtons.hit(x, y);
      return;
    }
    const pb = this._pauseButtonRect();
    if (!this.scrapped && x >= pb.x && x <= pb.x + pb.w &&
        y >= pb.y && y <= pb.y + pb.h) {
      this.paused = true;
      this.confirm = null;
      this._buildPause();
      Controls.releaseAll();
      return;
    }
    if (this.scrapped) {
      // A TAP SKIPS THE WAIT, NOT THE WORLD. This used to switch to the
      // arena-era RESULTS screen -- a score card with RUN AGAIN on it --
      // which Block 3.3 replaced with waking at your last garage ("not a
      // results screen, not a run over: there is no run"). update() had
      // been respawning after 2.4 s since Block 3; a tap inside those 2.4 s
      // still went to the score card. Found in the sweep for anything a
      // player should never see.
      this.deathT = 0;
      this.respawnAtGarage();
      return;
    }
    if (this.buttons.hit(x, y)) return;     // top UI first
    Controls.claim(id, x, y);               // then twin-stick controls
  }
  pointerMove(id, x, y) { Controls.moved(id, x, y); }
  pointerUp(id) { Controls.released(id); }

  update(dt) {
    // PAUSE from a binding rather than the on-screen button. This fixes a
    // quiet cousin of the dash bug: Escape/P have been listed and REBINDABLE
    // as Pause in Settings since the keyboard landed, and nothing consumed
    // them — bound, displayed, dead. Start on a pad goes through the same
    // door so the two can never drift apart.
    //
    // It runs ABOVE the paused early-return on purpose. The first version sat
    // with the rest of the input gathering below the gate, where it could
    // pause but never resume — while paused, update bails out before any key
    // is read. Found by pressing the key, exactly like the dash bug.
    {
      const kbPause = typeof Keys !== 'undefined' && Keys.down && Keys.down('pause');
      let padPause = false;
      if (typeof Pads !== 'undefined') {
        // While paused the main gather below never runs, so poll here too:
        // Start must resume from the pad as well as pause from it.
        if (this.paused || Game.paused) Pads.apply(Controls, this.player);
        padPause = Pads.pausePressed === true;
        Pads.pausePressed = false;
        // BACK OPENS THE MAP, one press. Consumed here rather than inside
        // Pads for the same reason pause is: the pad reports an edge, the
        // state decides whether now is a moment to act on it.
        if (Pads.mapPressed) {
          Pads.mapPressed = false;
          if (!this.paused && !this.scrapped && !Cutscene.playing) {
            Game.switch('MAP');
            return;
          }
        }
        // D-PAD DOWN DROPS THE TOW, and only that.
        if (Pads.dropPressed) {
          Pads.dropPressed = false;
          if (typeof Tow !== 'undefined' && Tow.towing()) Tow.unhook();
        }
      }
      const edge = (kbPause && !this._pauseKeyWas) || padPause;
      this._pauseKeyWas = kbPause;
      if (edge && !this.scrapped && !Cutscene.playing
          && !Game.paused) {
        if (this.paused) {
          this.paused = false;
        } else {
          this.paused = true;
          this.confirm = null;
          this.powerPanel = false;
          this._buildPause();
          Controls.releaseAll();
        }
      }
    }
    if (Game.paused || this.paused) {
      if (this.paused && typeof UINav !== 'undefined') {
        UINav.update(this.powerPanel ? this.powerButtons : this.pauseButtons);
      }
      this._tickSaveMsg(dt);
      return;
    }
    Profile.bump('playTime', dt);

    // INPUT IS GATHERED FIRST, BEFORE ANYTHING READS IT.
    //
    // Keyboard and mouse write into the SAME Controls fields the thumb sticks
    // write into, so everything downstream is device-agnostic. Touch still wins
    // while a finger is down — apply() skips any stick or button a pointer
    // already owns.
    //
    // This used to run two hundred lines further down, AFTER dash and rotate
    // had already read their justPressed flags. Those flags are cleared at the
    // end of every frame, so a keyboard dash or rotate was set and wiped
    // without anything ever seeing it: the keys registered, the buttons lit up,
    // and the machine did nothing. Movement and aim worked, because they are
    // read later in the frame, which is exactly why it looked like the action
    // buttons specifically were unbound.
    if (typeof Keys !== 'undefined') Keys.apply(Controls, this.player);
    // The pad is POLLED, so it must be read here every frame — same top-of-
    // update rule the keyboard learned the hard way (dash/rotate read their
    // justPressed flags long before the old call site ran).
    if (typeof Pads !== 'undefined' && Pads.apply(Controls, this.player)) {
      Controls.setDevice && Controls.setDevice('pad');
    }


    if (Cutscene.playing) {
      Cutscene.update(dt);
      Effects.update(dt);
      return;
    }

    Tutorial.update(dt);
    if (Tutorial.active) {
      if (Controls.move.mag > 0.4) Tutorial.did('move');
      if (Controls.firing) Tutorial.did('aim');
    }
    this.peakPower = Math.max(this.peakPower || 0, this.player.powerCap || 0);
    for (const k of this.player.sockets) {
      if (k.comp) this.partUse[k.comp.part.id] = (this.partUse[k.comp.part.id] || 0) + dt;
    }


    if (Controls.dash.justPressed && this.player.tryDash()) {
      this.dashFlash = 0.25;
      Profile.bump('dashes');
      if (typeof Audio_ !== 'undefined') Audio_.play('dash');
    }
    this.dashFlash = Math.max(0, this.dashFlash - dt);

    // SPECIAL (M12): one press at full Charge fires the Jackrig's Special —
    // touch button, C/V on a keyboard, X/square on a pad, all the same edge.
    if (Controls.special.justPressed && typeof Mods !== 'undefined') {
      if (Mods.activate(this.player)) {
        this.specialFlash = 0.4;
      } else if ((this.player.charge || 0) < 100 && !this.player.special) {
        Effects.comicWord('CHARGE ' + Math.floor(this.player.charge || 0) + '%',
          this.player.x, this.player.y - 200, CONFIG.COLOR.steel, 44);
      }
    }
    this.specialFlash = Math.max(0, (this.specialFlash || 0) - dt);

    // BLOCK 6.1: HOOK / UNHOOK, on the shared action button. Context is the
    // whole point of the binding: with something in reach it hooks, with a
    // hulk on the line it drops it, and Block 7 hangs the rig ability off
    // the same press when neither applies.
    if (Controls.action && Controls.action.justPressed && !this.scrapped &&
        this.player.alive) {
      // BLOCK 14: a lair mouth is checked FIRST. It is the only thing on this
      // button you cannot undo, so it must never lose to something you could
      // have walked two steps away from.
      const mouth = (typeof LairDoors !== 'undefined')
        ? LairDoors.nearest(this.player) : null;
      if (mouth && !mouth.beaten) { this._enterLair(mouth); return; }
      // RIDING A TRAIN, the drop-tow input lets go of the hitch too: spat
      // out at line speed, no harm done, the tow still on. Checked before
      // everything else on the button because nothing else is in reach of a
      // machine doing 1,440 u/s along a rail.
      if (typeof RailHitch !== 'undefined' && RailHitch.riding()) {
        RailHitch.release(this.player, 'letgo');
        return;
      }
      const bar = (typeof Barriers !== 'undefined')
        ? Barriers.nearest(this.player) : null;
      if (bar && Barriers.canOpen(this.player, bar) &&
          Math.hypot(bar.x - this.player.x, bar.y - this.player.y) < BARRIER.OPEN_R) {
        Barriers.tryOpen(this.player, bar);
      } else {
        // ITEM 6: a story fragment in reach is read BEFORE the tow hook — a
        // plate you walked up to on purpose should never lose the button to
        // a hulk that happens to be lying nearby.
        const frag = (typeof Story !== 'undefined' && Story.nearest)
          ? Story.nearest(this.player) : null;
        // PHASE C.3: a FIND in reach outranks the tow for the same reason a
        // fragment does — you drove to it on purpose. It sits after the
        // fragment because a fragment is the smaller, quieter thing and would
        // otherwise always lose to a crate standing beside it.
        const find = (typeof Finds !== 'undefined') ? Finds.nearest(this.player) : null;
        // BLOCK 13: a PERSON in reach outranks everything except a barrier.
        // They are the rarest thing in the world and the only one that talks
        // back; losing the button to a crate lying beside one would be the
        // same fault the fragment ordering was written to avoid.
        const npc = (typeof Missions !== 'undefined' && Missions.nearest)
          ? Missions.nearest(this.player) : null;
        if (npc) this._talkTo(npc);
        else if (frag) this._readFragment(frag);
        else if (find) this._takeFind(find);
        else if (Tow.towing() || Tow.nearest(this.player)) Tow.hook(this.player);
        else if (typeof Rigs !== 'undefined' && Rigs.ability &&
                 Rigs.ability(this.player)) { /* the rig answered */ }
        // FIELD WORKSHOP is LAST on this button, and deliberately: it is the
        // only thing on it that holds you still, so it must never take the
        // press from something you could have done and kept moving.
        else if (typeof FieldWork !== 'undefined') {
          if (FieldWork.running(this.player)) FieldWork.cancel(this.player);
          else if (!FieldWork.refusal(this.player, 'fit')) {
            FieldWork.begin(this.player, 'fit');
          } else if (!FieldWork.refusal(this.player, 'preset')) {
            FieldWork.begin(this.player, 'preset');
          }
        }
      }
    }
    // The read fragment's text stays up long enough to actually read, then
    // clears itself; any new read replaces it.
    if (this.fragmentShow && (this.fragmentShow.t -= dt) <= 0) {
      this.fragmentShow = null;
    }
    // THE RADIO. Ticked every frame; whether anything comes off the queue is
    // the Radio's decision and it turns on whether you are in a fight.
    if (typeof Radio !== 'undefined') Radio.update(dt, this.player);
    // AND THE SCENES, beside the radio they queue into. Two string splits a
    // frame, and the thing they reach is the beat §20 calls the whole story:
    // MAGS telling you that she is the one who reclassified you.
    if (typeof Scenes !== 'undefined') { Scenes.update(); Scenes.updateLogs(); }
    if (typeof Escorts !== 'undefined') Escorts.update(dt, this.player);
    if (typeof FieldWork !== 'undefined') FieldWork.update(dt, this.player);
    if (typeof GadgetRun !== 'undefined') GadgetRun.update(dt, this.player);
    // THE YARD KEEPS OFFERING THE LESSON until it lands. Silent and free
    // everywhere else, and dead weight the moment it has - which is exactly
    // what an opening should become.
    if (typeof Opening !== 'undefined') Opening.update(dt, this.player);
    if (typeof Unlocks !== 'undefined' && Unlocks.pending && Unlocks.pending.length) {
      this._showUnlocks();
    }
    // THE AMBIENT BED. One line, because the whole point of putting the
    // table in Audio_ is that the game does not have to know which
    // district sounds like what.
    if (typeof Audio_ !== 'undefined' && Audio_.bed) {
      Audio_.bed(dt, this.district.id, this.player.x, this.player.y);
      if (Audio_.musicTick) Audio_.musicTick(dt);
    }
    this._radioWatch();

    // GADGET 1 AND 2. CONTENT_CONTROLS_HUD gives them LB and RB; those are
    // ROTATE, which is a verb this game has and a gadget button is one it did
    // not — that divergence is written down in DECISIONS (D283). So they are
    // on the SPECIAL button and the one below it, which is where a rig ability
    // and a gadget both live: one press, no modifier, and the prompt says
    // which. When gadget slots are on the garage screen this is the line that
    // moves them back onto the shoulders.
    if (typeof GadgetRun !== 'undefined' && !this.scrapped && this.player.alive) {
      if (Controls.special && Controls.special.justPressed &&
          GadgetRun.inSlot(0)) {
        const why = GadgetRun.refusal(this.player, GadgetRun.inSlot(0));
        if (why) { Garages.message = why; Garages.messageT = 2; }
        else GadgetRun.useSlot(this.player, 0);
      }
      if (typeof Keys !== 'undefined' && Keys.pressed && Keys.pressed('gadget2') &&
          GadgetRun.inSlot(1)) {
        GadgetRun.useSlot(this.player, 1);
      }
    }

    // ROTATE: spin the whole rig one socket either way (re-aim saws/shields/
    // armour without ripping anything off). Free, but everything moves.
    const rotDir = Controls.rotateR.justPressed ? 1
      : (Controls.rotateL.justPressed ? -1 : 0);
    if (rotDir && !this.scrapped && this.player.alive) {
      if (this.player.moduleCount > 0 && Machine.rotate(this.player, rotDir)) {
        if (typeof Audio_ !== 'undefined') Audio_.play('eject', { pitch: 1.4, gain: 0.6 });
        this.rotateFlash = 0.22;
        for (const sk of this.player.sockets) {
          if (!sk.comp) continue;
          const sp = Machine.socketPos(this.player, sk);
          Effects.spark(sp.x, sp.y, sk.angle + Math.PI / 2, 3, CONFIG.COLOR.cyan, 300);
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
      }
    }
    this.rotateFlash = Math.max(0, (this.rotateFlash || 0) - dt);
    if (this.unlockT > 0) this.unlockT = Math.max(0, this.unlockT - dt);
    this.magnetHeld = Controls.magnet.pressed ? this.magnetHeld + dt : 0;
    // THE COUPLING. Same button as the magnet; a press with a train passing
    // in reach, moving with it, hooks on. The magnet's own update is skipped
    // while hitched -- the hand is on the bar.
    if (typeof RailHitch !== 'undefined' && Controls.magnet.justPressed &&
        !this.scrapped && this.player.alive && !RailHitch.riding()) {
      RailHitch.tryHook(this.player);
    }

    if (this.scrapped) {
      // Let the debris settle, then hand over to the Results screen.
      this.deathT = (this.deathT || 0) + dt;
      // 3.3: you wake at your last garage. Not a results screen, not a run
      // over — there is no run. The world is still there and so are you.
      if (this.deathT > 2.4) {
        this.deathT = 0;
        this.respawnAtGarage();
        return;
      }
      Projectiles.update(dt, this.arena, this.obstacles,
        { player: [], enemy: [] });
      LooseParts.update(dt, this.arena, this.obstacles);
      Effects.update(dt);
      Camera.update(dt, this.player.x, this.player.y, 0, this.arena);
      return;
    }

    // Aim assist needs to know what is on the field. Handed over each frame
    // rather than reached for globally, so the player object stays testable
    // in isolation and a state with no enemies simply assists nothing.
    // (Keys.apply now runs at the TOP of update — see the note there.)
    this.player._assistTargets = this.enemies;
    // STREAM. Cheap when nothing has changed; when a chunk loads or unloads
    // the world lists are re-adopted and the order indices rebuilt, which is
    // the only moment that work happens.
    if (World.update(this.player.x, this.player.y)) this._adoptWorld();

    this.player.update(dt, this.arena, this.obstacles);
    EmergencyBlaster.update(dt, this.player);
    Machine.update(dt, this.player, this.enemies, Controls.firing, 'player');
    if (typeof RailHitch !== 'undefined' && RailHitch.riding()) {
      RailHitch.update(dt, this.player);
    } else {
      Magnet.update(dt, this.player, this.enemies);
    }
    // Shootable hazards come from registry tags, not from named arrays, so a
    // new shootable hazard is reachable by a bullet the moment it registers.
    Projectiles.update(dt, this.arena, this.obstacles, {
      player: [...this.enemies, ...this._tags.shootable,
               ...this._tags.playerShootable],
      enemy: [this.player, ...this._tags.shootable],
    });
    LooseParts.update(dt, this.arena, this.obstacles);
    Pickups.update(dt, this.player);
    Effects.update(dt);

    Mines.update(dt, this.player, this.enemies);
    // Every hazard, in the registry's tick order, from one list.
    Hazards.updateAll(this._updIdx, dt, this.player, this.enemies);
    // Block 2: who is out there, whether they have noticed you, and what the
    // district's alert level is doing about it.
    Garages.tick(dt);
    Garages.update(dt, this.player, this);
    // Drive over your own wreck and the gear is yours again - back into the
    // unbanked carry, because recovering it is not the same as banking it.
    {
      const got = Wrecks.tryRecover(this.player, this.district.id);
      if (got) {
        Garages.message = 'RECOVERED ' + got.parts.length + ' PART' +
          (got.parts.length === 1 ? '' : 'S');
        Garages.messageT = 4;
        Effects.comicWord('RECOVERED', this.player.x, this.player.y - 170,
          CONFIG.COLOR.lime, 64);
        if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
      }
    }
    // BLOCK 6. The tow runs BEFORE the population so a hulk that is being
    // dragged has already moved when anything else looks at where it is.
    this._updateOcclusion(dt);
    Rigs.tick(dt, this.player);
    // THE MAMMOTH: "Drive at it and it stops being a wall." Rigs.smashes is
    // the speed rule (55% of max, at a wall the rig opens) and had no caller
    // (D343) -- the wall opened on ACTION by ownership, standing still. At
    // speed it opens on contact, no button; ACTION still works as before.
    if (typeof Barriers !== 'undefined' && this.player.alive && this.player.rigId) {
      const wall = Barriers.nearest(this.player);
      if (wall && Rigs.smashes(this.player, wall.typeId) &&
          Math.hypot(wall.x - this.player.x, wall.y - this.player.y) < BARRIER.OPEN_R) {
        Barriers.tryOpen(this.player, wall);
      }
    }
    Tow.update(dt, this.player);
    // PLAYTEST 3 ITEM 3. Arriving clears the waypoint. A waypoint you have
    // reached is a pip you have to remember to dismiss, which is a chore.
    Waypoint.tick(this.player, this.district && this.district.id);
    // PHASE C: driving onto an exit gate travels. After Tow.update so the
    // hulk on the line has already moved when the crossing carries it over.
    this._checkExits();
    Population.update(dt, this.player);
    this.enemies = Population.machines;
    Enemy._flock = this.enemies;      // lets enemies push apart from each other
    // THE ENDING. Bosses.payDrops wrote `endingReached` when the DISPATCHER
    // died; nothing read it. Two and a half seconds of the floor going
    // quiet, then the last screen. Once: a chosen ending is never asked
    // again, and the save continues past it.
    if (typeof Progress !== 'undefined' && Progress.endingReached && !Progress.ending &&
        typeof ENDINGS !== 'undefined') {
      this._endingT = (this._endingT || 0) + dt;
      if (this._endingT > 2.5) {
        this._endingT = 0;
        Game.switch('ENDING');
        return;
      }
    }
    for (const e of this.enemies) {
      e.update(dt, this.player, this.arena, this.obstacles,
        Population.brainTarget(e, this.player));
    }
    // Wardens that FABRICATE (Stitcher) or CALL (Bailiff) queue their adds;
    // draining here keeps the spawn in the one list every system reads.
    for (const e of this.enemies.slice()) {
      if (!e.pendingAdds || !e.pendingAdds.length) continue;
      for (const add of e.pendingAdds) this.enemies.push(add);
      e.pendingAdds.length = 0;
    }

    // Kill accounting now happens in Enemy._die, which is the only place that
    // knows HOW the machine died (SURGICAL / hazard / saw). Counting here as
    // well would double every kill.
    this._aliveLast = this.enemies.filter(e => e.alive).length;

    // TOO HOT challenge + POWER HUNGRY + OVERKILL
    if (this.player.heat > 80) Unlocks.event('hot', { dt });
    else Unlocks.event('cooled');
    Unlocks.event('powerCap', { cap: this.player.powerCap || 0 });
    if (Controls.firing) {
      const guns = this.player.sockets.filter(s => s.comp && s.comp.online &&
        (s.comp.part.damage || s.comp.part.dps)).length;
      Unlocks.event('weaponsFiring', { count: guns });
    }

    // Catalogue discovery: anything that shows up on the battlefield counts.
    this._discoverT -= dt;
    if (this._discoverT <= 0) {
      this._discoverT = 0.5;
      for (const e of this.enemies) {
        if (!e.alive || !e.sockets) continue;
        for (const s of e.sockets) if (s.comp) Profile.discover(s.comp.part.id);
      }
      for (const it of LooseParts.items) Profile.discover(it.part.id);
    }

    // Soft separation so enemies never stack into one blob.
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy), min = a.radius + b.radius + 60;
        if (d < min && d > 0.001) {
          const push = (min - d) * 0.5;
          a.x -= dx / d * push; a.y -= dy / d * push;
          b.x += dx / d * push; b.y += dy / d * push;
        }
      }
    }

    // Player death -> SCRAPPED (full flow in Milestone 20)
    if (!this.player.alive) {
      this.scrapped = true;
      // "You're a wreck on a map now. Go and get yourself."
      if (typeof Radio !== 'undefined') Radio.fire('first_death');
      Profile.bump('deaths');

      // BLOCK 3.3. You lose the UNBANKED and keep everything permanent.
      // The lost gear does not evaporate: it stays where you fell, and
      // going back for it is a decision with its own risk, because dying
      // again before you reach it loses it for good.
      //
      // Captured BEFORE Rack.clearPending, or the wreck is always empty -
      // which is exactly the kind of quiet nothing that would make the
      // whole loop feel like it was not implemented.
      {
        const carried = Rack.pending.slice();
        if (carried.length) {
          // "That one's gone. It happens. It's supposed to happen." Fired
          // only when a marker is dropped ON TOP of one you never went back
          // for, because that is the loss the line is about - the first
          // death has its own line and this is not it.
          if (typeof Radio !== 'undefined' && typeof Wrecks !== 'undefined' &&
              Wrecks.current) {
            Radio.fire('wreck_lost');
          }
          Wrecks.drop(this.player.x, this.player.y, this.district.id,
            carried, 0);
          Effects.comicWord('DROPPED ' + carried.length + ' PART' +
            (carried.length === 1 ? '' : 'S'),
            this.player.x, this.player.y - 240, CONFIG.COLOR.red, 56);
        }
        // WHAT PATCHWORK TAKES. `wearsPlayerLosses` has been true in the
        // boss data since the content pass and read by nothing, and it is the
        // best hook in the boss set: the machine that killed you is wearing
        // your parts the next time you see it.
        //
        // Recorded HERE, where the loss actually happens and where the list
        // still exists, rather than reconstructed later from the wreck — the
        // wreck is cleared the moment you recover it, and what PATCHWORK took
        // is not something recovering your own gear should undo.
        if (typeof Roamers !== 'undefined') {
          Roamers.recordLoss(this.player, carried);
        }
        Rack.clearPending();
      }
      if (this.onPlayerDeath) this.onPlayerDeath();
      // Deaths in THIS zone, for the comeback assist below. Reset whenever a
      // new zone is reached, so a wall in Zone 2 does not hand out help in
      // Zone 3.
      Game.zoneDeaths = (Game.zoneDeaths || 0) + 1;
      Save.save();
      for (const s of this.player.sockets) {
        if (!s.comp) continue;
        const sp = Machine.socketPos(this.player, s);
        LooseParts.spawn(s.comp.part.id, s.comp.hp / s.comp.maxHp,
          sp.x, sp.y, Math.cos(s.angle) * 620, Math.sin(s.angle) * 620);
      }
      Machine.clearAll(this.player);
      Effects.explosion(this.player.x, this.player.y, 260);
      Effects.hitStop(0.45, 0.25);   // let the death land
      Effects.comicWord('SCRAP!', this.player.x, this.player.y - 160);
      if (typeof Audio_ !== 'undefined') {
        Audio_.play('scrapped');
        Audio_.stopMusic();
      }
      Camera.shake(12, 0.4);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([60, 50, 90]);
      return;
    }

    // Encounter clear -> short breather -> next wave (test loop)
    // Waves push in on a timer; the encounter is only CLEAR once the last
    // wave is down, so this must run before the clear check below.
    Camera.update(dt, this.player.x, this.player.y,
      this.player.moduleCount, this.arena);
  }

  // Extracted from update() at M1. The Campaign's six-screen structure has to
  // replace this auto-advance with physical exits, and overriding one method
  // beats duplicating a 290-line update loop. Behaviour here is unchanged:
  // returns true when the caller must stop updating this frame.
  render() {
    const ctx = R.ctx;
    R.clear(CONFIG.COLOR.bg);

    // ---- WORLD (under camera) ----
    Camera.begin(ctx);
    this.drawArena(ctx);
    // The floor pass, in the registry's painter order, culled to the view.
    // A hazard is a point plus a radius or a rect; one generous pad covers
    // both, and a hazard that draws slightly outside its own bounds (a vent
    // plume, a beam) still gets in.
    const view = Camera.worldView();
    for (const e of this._drawIdx) {
      if (World.visible(view, e.x - 400, e.y - 400,
          (e.w || 0) + 800, (e.h || 0) + 800)) e.draw(ctx);
    }
    Mines.draw(ctx);
    LooseParts.draw(ctx);
    Pickups.draw(ctx);

    // ---- THE WORLD BAND, DEPTH SORTED (Master v3.2 §5) -------------------
    // Everything that STANDS on the floor is drawn in one pass ordered by how
    // far down the screen it is, so a machine in front covers one behind it and
    // can walk behind a pillar. Before 44 degrees this did not matter — flat
    // top-down art has nothing to occlude with — which is why the old code
    // simply drew each category in turn.
    //
    // Floor decals above and effects/projectiles below stay where they were:
    // those are different bands, not different depths.
    if (!this._band) this._band = [];
    this._band.length = 0;
    // §5 CULLING. The depth sort is the most expensive thing in the frame and
    // it is O(n log n), so what goes INTO it matters more than anywhere else.
    // Everything below is filtered against the view before it is pushed.
    if (typeof Iso !== 'undefined' && Iso.use44) {
      // PROPS STAND UP, so they go in the depth-sorted band with the
      // machines - a housing block a machine can walk behind, rather than a
      // floor panel it walks over.
      for (const o of this.obstacles) {
        if (o.type !== 'prop') continue;
        if (!World.visible(view, o.cx - 700, o.cy - 900, 1400, 1800)) continue;
        o.heightLayer = Iso.layers.tallProp;
        o._isProp = true;
        this._band.push(o);
      }
      for (const o of this.obstacles) {
        if (o.type !== 'pillar') continue;
        if (!World.visible(view, o.x - (o.r || 0), o.y - (o.r || 0),
            (o.r || 0) * 2, (o.r || 0) * 2, 300)) continue;
        // A pillar is TALLER than a machine, so at the same floor Y it wins the
        // tie. Stamped once, here, rather than in the arena data — height is a
        // presentation fact, and the arenas are shared with the top-down build.
        o.heightLayer = Iso.layers.tallProp;
        o._isProp = true;
        this._band.push(o);
      }
    }
    // Hazards that stand up off the floor join the depth sort. Which ones
    // those are is a registry fact, not a list kept here.
    for (const e of this._bandIdx) {
      if (World.visible(view, e.x - 300, e.y - 300,
          (e.w || 0) + 600, (e.h || 0) + 600)) this._band.push(e);
    }
    // A machine off screen is not drawn, but it is still updated: an enemy
    // that froze when it left the view would be standing exactly where you
    // left it when you turned back, which reads as broken rather than as a
    // saving.
    for (const e of this.enemies) {
      if (World.visible(view, e.x - 400, e.y - 400, 800, 800)) this._band.push(e);
    }
    const drawPlayer = this.player.alive;
    if (drawPlayer) this._band.push(this.player);
    Iso.sortWorld(this._band);

    for (const o of this._band) {
      if (o === this.player) {
        // THE SHAPE CUE, under everything: it must never compete with the
        // connector highlight, which is the one affordance that always wins.
        if (typeof ShapeCue !== 'undefined') ShapeCue.draw(ctx, this.player);
        this.player.draw(ctx);
        // BLOCK 6: the tow line, under the machines so the hulk and the
        // player both sit on top of it.
        Tow.drawLine(ctx, this.player);
        Machine.draw(ctx, this.player);
        Magnet.draw(ctx, this.player);
      } else if (o._isProp) {
        this._drawProp(ctx, o);
      } else {
        if (typeof ShapeCue !== 'undefined' && o.sockets) ShapeCue.draw(ctx, o);
        o.draw(ctx);
      }
    }
    // ASSAY MODULE: the marker over the best wreck in range. WORLD space,
    // because it points at somewhere to drive rather than at an edge of the
    // screen — but drawn AFTER the band rather than at the player's slot in
    // it, because the band sorts by y and a wreck south of a building had its
    // marker painted over by the building. A marker that can be hidden by the
    // scenery is not a marker.
    Tow.drawAssay(ctx, this.player);
    // THE STASH GLINT, for the same reason and in the same place: a tell the
    // scenery can hide is not a tell.
    if (typeof Stashes !== 'undefined') Stashes.drawGlints(ctx, this.player);
    // DEV-ONLY-BEGIN
    if (Game.debug) for (const e of this.enemies) if (e.alive) Machine.drawDebug(ctx, e);
    // DEV-ONLY-END
    Projectiles.draw(ctx);
    // DEV-ONLY-BEGIN
    if (Game.debug) Machine.drawDebug(ctx, this.player);
    // DEV-ONLY-END
    Effects.draw(ctx);
    // DEV-ONLY-BEGIN
    if (Game.debugChunks) this._drawChunkGrid(ctx);
    // DEV-ONLY-END
    Camera.end(ctx);

    // ---- UI (logical screen space) ----
    this.drawHUD();
    if (!this.scrapped) this.drawControls();
    this.buttons.draw();
    if (!this.paused && !this.scrapped) this._drawAlert(R.ctx);
    if (!this.paused && !this.scrapped) this._drawCarry(R.ctx);
    if (!this.paused && !this.scrapped) this._drawTow(R.ctx);
    if (!this.paused && !this.scrapped) this._drawHitch(R.ctx);
    // MAGS, at the TOP of the screen and on her own. Every other message
    // in this game lives at the bottom - prompts, tow readout, fragments -
    // and she is not a prompt. Drawn last so nothing paints over her.
    if (typeof Radio !== 'undefined' && !this.paused) Radio.draw(R.ctx);
    if (!this.paused && !this.scrapped) this._drawBarrier(R.ctx);
    if (!this.paused && !this.scrapped) this._drawFragment(R.ctx);
    if (!this.paused && !this.scrapped) this._drawExit(R.ctx);
    if (!this.paused && !this.scrapped) this._drawFieldWork(R.ctx);
    // PLAYTEST 3 ITEM 2. The compass strip, along the top, whenever it is
    // useful. Drawn before the minimap so the minimap's own frame wins any
    // argument about the top-right corner.
    if (!this.paused && !this.scrapped) Compass.draw(R.ctx, this);
    // The minimap sits under the top-right buttons. Drawn last of the HUD so
    // nothing overlaps it, and skipped while paused because the pause menu
    // owns the screen.
    if (!this.paused && !this.scrapped) {
      const ms = Display.safe;
      Minimap.draw(R.ctx, this, { x: ms.right - MAP.MINI_SIZE - 30,
        y: ms.top + 110, w: MAP.MINI_SIZE, h: MAP.MINI_SIZE });
    }
    // DEV-ONLY-BEGIN
    if (Game.debug) this.drawDebugPanel();
    // DEV-ONLY-END

    if (!this.scrapped && !this.paused) {
      const pb = this._pauseButtonRect();
      R.roundRect(pb.x, pb.y, pb.w, pb.h, 12, 'rgba(0,0,0,0.5)', CONFIG.COLOR.steel, 5);
      const pDrew = typeof Assets !== 'undefined' &&
        Assets.sprite(R.ctx, 'icon_pause', pb.x + pb.w / 2, pb.y + pb.h / 2, 46, 46, 0);
      if (!pDrew) R.text('II', pb.x + pb.w / 2, pb.y + pb.h / 2 + 2, 34, '#ffffff');
    }
    if (!this.scrapped && !this.paused) Tutorial.draw();
    if (Cutscene.playing) Cutscene.draw(R.ctx);
    if (Garages.messageT > 0 && Garages.message) {
      R.text(Garages.message, 960, Display.safe.top + 250, 44, CONFIG.COLOR.lime);
    }
    if (this.unlockT > 0 && this.unlockBanner) {
      R.text(this.unlockBanner, 960, Display.safe.top + 330, 40, CONFIG.COLOR.lime);
    }
    if (this.paused) this._drawPause();

    if (this.scrapped) {
      const v = Display.viewRect();
      R.rect(v.x, v.y, v.w, v.h, 'rgba(5,6,14,0.62)');
      R.text('SCRAPPED', 960, 470, 150, CONFIG.COLOR.red);
      R.text(this.arenaName || '', 960, 690, 34, CONFIG.COLOR.steel);
    } else {
      // BELOW THE COMPASS, AND IN A COLOUR THAT CAN BE READ.
      //
      // Two faults in one line, both of them things this project had already
      // written down. The compass strip is s.top+18 by 72 tall, so s.top+74
      // is INSIDE it and the name was printed across the distance labels --
      // "16,162m" through "THE SPRAWL", measured by tools/hudcheck.py. And
      // `CONFIG.COLOR.grid` on a panel is 1.05:1, which HANDOVER names as the
      // one colour never to use for text inside a box; the strip is a box and
      // this was text inside it.
      R.smallText(this.arenaName || '', 960 - 120, Display.safe.top + 100, 22,
        CONFIG.COLOR.steel);
    }
  }

  drawArena(ctx) {
    const a = this.arena;
    const view = Camera.worldView();

    // PHASE A. THE ARENA FLOOR IS GONE.
    //
    // What used to be here: fill the district rect with one colour, tile ONE
    // texture across all of it, stroke a 26px black wall and a 10px steel wall
    // around the outside, and paint rust-orange CORNER MARKINGS at the four
    // corners like a boxing ring. Every one of those is an arena instruction,
    // and together they are why the player said it felt like being inside a
    // massive rectangular building.
    //
    // In its place: ground that varies at the scale of chunks, scatter detail
    // on top of it, far silhouettes on the horizon, and an edge made of
    // terrain and haze instead of a wall. All Canvas primitives — nothing
    // here needs art, and nothing here is blocked on any.
    //
    // ...UNLESS YOU ARE INDOORS. A lair is a hall you walked into through a
    // door, and it was getting the full outdoor treatment: patchy ground,
    // scatter, ROADS running through the boss arena and a hazy horizon past
    // the walls. Neon Cut's street plan was drawing straight across the
    // Bailiff's plaza. An interior gets its floor and its own edges and
    // nothing else — which is also cheaper, and is the only place in the
    // renderer that has ever needed to know the difference.
    const inside = !!(this.district && this.district._spec &&
                      this.district._spec.interior);
    Outdoors.drawGround(ctx, view, this.district);
    if (!inside) {
      Outdoors.drawRoutes(ctx, view, this.district, a);
      Outdoors.drawScatter(ctx, view, this.district, this.player.x, this.player.y);
      Outdoors.drawEdges(ctx, a, view, this.district);
    }

    this._drawArenaEdges(ctx, a);
  }

  // Arena wall + obstacles. Shared by the textured and untextured floor paths.
  _drawArenaEdges(ctx, a) {
    // NO WALL. `A wall you can see and drive along says room, and nothing
    // else you do will overcome it.` The bounds still exist and the player
    // is still stopped — but they are stopped by terrain they can see
    // continuing past them, not by a 26px black line drawn around the level.

    for (const o of this.obstacles) {
      // Real prop art when we have it, code shapes otherwise.
      // Pillars and scrap heaps STAND on the floor, so they are drawn later,
      // in the depth-sorted world band, where a machine can pass behind them.
      // Everything else here is arena structure and stays under the fight.
      if (o.type === 'pillar' && typeof Iso !== 'undefined' && Iso.use44) continue;

      if (typeof Assets !== 'undefined') {
        if (o.type === 'pillar') {
          const key = PILLAR_ART[o.style] || 'prop_pillar';
          // Same rule as _drawProp: the art is the size of the collision.
          if (Assets.sprite(ctx, key, o.x, o.y, o.r * 2, o.r * 2, 0)) continue;
        } else if (o.type === 'wall') {
          const img = Assets.get('prop_wall');
          if (img) {
            // Tile the block along the wall so long walls do not stretch.
            const step = Math.min(o.w, o.h);
            for (let wx = o.x; wx < o.x + o.w; wx += step) {
              for (let wy = o.y; wy < o.y + o.h; wy += step) {
                const sw = Math.min(step, o.x + o.w - wx);
                const sh = Math.min(step, o.y + o.h - wy);
                Assets.sprite(ctx, 'prop_wall', wx + sw / 2, wy + sh / 2,
                  sw * 1.06, sh * 1.06, 0);
              }
            }
            continue;
          }
        }
      }
      if (o.type === 'pillar' && o.style === 'scrap') {
        // Scrap heap: same collision circle, junk-pile read (plan §73).
        R.circle(o.x + 8, o.y + 10, o.r, 'rgba(0,0,0,0.45)');
        R.circle(o.x, o.y, o.r, '#3a2f2a', CONFIG.COLOR.ink, 9);
        const seed = (o.x * 31 + o.y * 17) % 360;
        for (let i = 0; i < 7; i++) {
          const a = (seed + i * 51) * Math.PI / 180;
          const rr = o.r * (0.3 + ((i * 37) % 40) / 100);
          R.roundRect(o.x + Math.cos(a) * o.r * 0.42 - rr / 2,
            o.y + Math.sin(a) * o.r * 0.42 - rr / 2, rr, rr * 0.7, 6,
            i % 3 === 0 ? CONFIG.COLOR.orange : (i % 3 === 1 ? '#5f708f' : '#7a4b2a'),
            CONFIG.COLOR.ink, 5);
        }
      } else if (o.type === 'pillar') {
        R.circle(o.x + 8, o.y + 10, o.r, 'rgba(0,0,0,0.45)');
        R.circle(o.x, o.y, o.r, '#2a3454', CONFIG.COLOR.ink, 9);
        R.circle(o.x, o.y, o.r * 0.55, '#3b4a77', CONFIG.COLOR.ink, 6);
      } else {
        R.roundRect(o.x + 8, o.y + 10, o.w, o.h, 14, 'rgba(0,0,0,0.45)');
        R.roundRect(o.x, o.y, o.w, o.h, 14, '#2a3454', CONFIG.COLOR.ink, 9);
      }
    }
  }

  // One standing prop, drawn from the depth-sorted band. Same art and the same
  // fallback shapes as the arena pass — only WHEN it is drawn has changed.
  // ITEM 1b. WHICH BUILDING IS BETWEEN THE CAMERA AND THE PLAYER.
  //
  // The depth-sorted band already knows what draws in FRONT of the player:
  // anything nearer the camera, which at 44 degrees means a larger y. So a
  // prop occludes when it draws after the player AND the player sits inside
  // the column it draws — its footprint width, and its height rising from
  // the near edge.
  //
  // ONLY THE PLAYER. `Enemies behind buildings do NOT get revealed by the
  // fade - hiding spots should stay hiding spots.` So this asks about one
  // position and no other, deliberately.
  //
  // Only props near the player are considered: occlusion cannot happen at
  // range, and the obstacle list is the whole streamed world.
  _updateOcclusion(dt) {
    if (typeof Props === 'undefined') return;
    const p = this.player;
    const k = Math.min(1, dt / Props.FADE_TIME);
    const R2 = 2600 * 2600;
    for (const o of this.obstacles) {
      if (o.type !== 'prop') continue;
      const dx = o.cx - p.x, dy = o.cy - p.y;
      if (dx * dx + dy * dy > R2) {
        if (o._fade) o._fade = Math.max(0, o._fade - k);
        continue;
      }
      o._fade = o._fade || 0;
      let want = 0;
      if (o.height >= 1 && o.cy > p.y) {          // nearer the camera
        const w = Props.footprint(o.kind);
        const near = o.cy + w * 0.3;
        const up = Props.rise(o.height);
        if (Math.abs(p.x - o.cx) < w * 0.5 + p.radius &&
            p.y > near - up) want = 1;
      }
      o._fade += (want - o._fade) * k;
      if (o._fade < 0.002) o._fade = 0;
    }
  }

  _drawProp(ctx, o) {
    // A NAMED PROP draws itself from the palette: all four parts of
    // DRAWING_AT_44, derived from the one height in its row.
    if (o.type === 'prop' && typeof Props !== 'undefined') {
      const P = (typeof Outdoors !== 'undefined')
        ? Outdoors.palette(this.district) : null;
      // ITEM 1b. THE OCCLUSION FADE. A building between the camera and the
      // player goes to ~35% while its ink outline stays at full strength, so
      // the silhouette survives and the building still reads as solid.
      const fade = o._fade || 0;
      Props.drawProp(ctx, o.kind, o.cx, o.cy, o.seed || 0,
        (P && P.edgeRockLit) || '#2c2f36', fade, P && P.neon);
      return;
    }
    const key = PILLAR_ART[o.style] || 'prop_pillar';
    // ART MATCHES THE COLLISION. `o.r` is the radius the game actually stops
    // you at, so the sprite is asked for a DIAMETER of exactly r*2 and the art
    // lands within a couple of percent of the circle it represents.
    //
    // It used to ask for r*2.4, which drew the prop ~23% wider than it is
    // solid: you could walk visibly into a scrap heap before hitting anything.
    // The sprite is still TALLER than r*2 and that is correct — the extra is
    // height standing up out of the footprint, which is the whole point of the
    // 44-degree camera. Only the width has to agree.
    if (typeof Assets !== 'undefined' &&
        Assets.sprite(ctx, key, o.x, o.y, o.r * 2, o.r * 2, 0)) return;
    R.circle(o.x + 8, o.y + 10, o.r, 'rgba(0,0,0,0.45)');
    if (o.style === 'scrap') {
      R.circle(o.x, o.y, o.r, '#3a2f2a', CONFIG.COLOR.ink, 9);
    } else {
      R.circle(o.x, o.y, o.r, '#2a3454', CONFIG.COLOR.ink, 9);
      R.circle(o.x, o.y, o.r * 0.55, '#3b4a77', CONFIG.COLOR.ink, 6);
    }
  }

  drawControls() {
    // PROMPT SWITCHING (M4): the touch overlay belongs to touch. On keyboard
    // or pad it is eight phantom circles over the fight; the first real
    // finger brings it straight back. Defaults to touch so a stubbed Controls
    // (tests) and the first frame of a phone session draw as before.
    if ((Controls.device || 'touch') !== 'touch') return;
    this.drawStick(Controls.move, Controls.moveHome, CONFIG.COLOR.cyan, 'MOVE');
    this.drawStick(Controls.aim, Controls.aimHome,
      Controls.firing ? CONFIG.COLOR.red : CONFIG.COLOR.magenta,
      Controls.firing ? 'FIRE!' : 'AIM / FIRE');
    const cdFrac = 1 - this.player.dashCd / this.player.dashCdMax;
    this.drawActionButton(Controls.dash, 'DASH', CONFIG.COLOR.lime, this.dashFlash > 0, cdFrac);
    // SPECIAL: the fill sweep IS the Charge meter; it lights when ready and
    // burns while the Special runs.
    if (typeof Mods !== 'undefined') {
      const p = this.player;
      const frac = p.special ? 1 : (p.charge || 0) / 100;
      this.drawActionButton(Controls.special, p.special ? 'ACTIVE' : 'SPECIAL',
        CONFIG.COLOR.cyan,
        !!p.special || (this.specialFlash || 0) > 0 ||
          (frac >= 1 && Math.sin(performance.now() / 120) > 0),
        frac);
    }
    this.drawActionButton(Controls.magnet, 'MAGNET', CONFIG.COLOR.violet, Controls.magnet.pressed);
    this.drawActionButton(Controls.rotateL, 'TURN L', CONFIG.COLOR.orange,
      Controls.rotateL.pressed || (this.rotateFlash || 0) > 0);
    this.drawActionButton(Controls.rotateR, 'TURN R', CONFIG.COLOR.orange,
      Controls.rotateR.pressed || (this.rotateFlash || 0) > 0);
  }

  drawStick(st, home, color, label) {
    const ST = CONFIG.STICK;
    if (st.active) {
      R.circle(st.originX, st.originY, ST.baseRadius, 'rgba(0,0,0,0.35)', color, 7);
      R.circle(st.originX + st.rawX, st.originY + st.rawY, ST.knobRadius, color, CONFIG.COLOR.ink, 7);
    } else {
      R.ctx.globalAlpha = 0.45;
      R.circle(home.x, home.y, ST.baseRadius, 'rgba(0,0,0,0.3)', color, 5);
      R.text(label, home.x, home.y, 30, color);
      R.ctx.globalAlpha = 1;
    }
  }

  drawActionButton(btn, label, color, lit, cdFrac = 1) {
    R.circle(btn.x + 5, btn.y + 5, btn.r, 'rgba(0,0,0,0.8)');
    R.circle(btn.x, btn.y, btn.r, lit ? color : 'rgba(0,0,0,0.45)', color, 8);
    if (cdFrac < 1) {
      // Cooldown sweep: dark wedge shrinking clockwise (plan: visible CD)
      const ctx = R.ctx;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.beginPath();
      ctx.moveTo(btn.x, btn.y);
      ctx.arc(btn.x, btn.y, btn.r - 5,
        -Math.PI / 2 + cdFrac * Math.PI * 2, -Math.PI / 2 + Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
    const ICON = { DASH: 'icon_dash', MAGNET: 'icon_magnet', ROTATE: 'icon_rotate' };
    const key = ICON[label];
    const sz = btn.r * 1.25;
    const drew = key && typeof Assets !== 'undefined' &&
      Assets.sprite(R.ctx, key, btn.x, btn.y, sz, sz, 0);
    if (!drew) R.text(label, btn.x, btn.y, 26, lit ? CONFIG.COLOR.ink : color);
  }

  // ---- Milestone 9 HUD: Core / Power / Heat (plan §14, top-left) ----
  drawHUD() {
    const s = Display.safe;
    const p = this.player;
    // THE PLATE. Every readout on the world HUD is steel or white on a dark
    // ground, and CENTRAL DISPATCH's ground is the one white floor in the
    // game: 1.1:1 on it, measured by tools/hudcheck.py the first time the
    // district was shot. A look that declares `brightGround` gets a dark
    // plate behind the left column and the district name -- the same
    // rgba(8,10,18,0.82) MAGS's strip uses, so what clears 3:1 on her strip
    // clears it here.
    if (typeof Outdoors !== 'undefined' && World.district &&
        Outdoors.palette(World.district).brightGround) {
      R.roundRect(s.left + 12, s.top + 8, 380, 240, 12, 'rgba(8,10,18,0.82)');
      R.roundRect(960 - 260, s.top + 92, 520, 40, 8, 'rgba(8,10,18,0.82)');
    }
    const x = s.left + 126, w = 260, h = 24;   // room for the HUD icons
    let y = s.top + 22;

    this._hudBar('CORE', x, y, w, h, p.hp / p.maxHp,
      p.hp / p.maxHp > 0.35 ? CONFIG.COLOR.lime : CONFIG.COLOR.red,
      String(Math.ceil(p.hp)), 'icon_health');

    y += 42;
    const demand = p.sockets.reduce((n, k) => n + (k.comp ? Machine.powerCostOf(p, k.comp) : 0), 0);
    const cap = p.powerCap ?? p.power;
    const over = demand > cap;
    const pDrew = typeof Assets !== 'undefined' &&
      Assets.sprite(R.ctx, 'icon_power', x - 52, y + h / 2, 66, 66, 0);
    if (!pDrew) R.text('POWER', x - 12, y + h / 2 + 2, 26, '#ffffff', 'right');
    R.text(`${demand}/${cap}`, x + 6, y + h / 2 + 2, 30,
      over ? CONFIG.COLOR.red : CONFIG.COLOR.cyan, 'left');
    if (over) R.text('OVERLOAD', x + 130, y + h / 2 + 2, 34, CONFIG.COLOR.red, 'left');

    // LOAD (§12) — weight, drawn apart from POWER because they are different
    // problems with different fixes. The band label IS the feedback: HEAVY /
    // OVERLOADED / STRAINING tell the player the movement penalty in a word.
    if (p.loadCap !== undefined) {
      y += 42;
      const lCap = p.loadCapEff !== undefined ? p.loadCapEff : p.loadCap;
      const lc = p.loadLabel
        ? (p.loadFrac > 1.2 ? CONFIG.COLOR.red : CONFIG.COLOR.orange)
        : CONFIG.COLOR.steel;
      R.text('LOAD', x - 12, y + h / 2 + 2, 26, '#ffffff', 'right');
      R.text((p.loadUsed || 0) + '/' + lCap, x + 6, y + h / 2 + 2, 30, lc, 'left');
      if (p.loadLabel) {
        R.text(p.loadLabel, x + 130, y + h / 2 + 2, 30, lc, 'left');
      }
    }

    y += 42;
    const hf = p.heat / p.heatCap;
    let hc = CONFIG.COLOR.cyan;
    if (p.overheated) hc = Math.sin(performance.now() / 70) > 0 ? '#ff3b3b' : '#ffd23f';
    else if (hf > 0.7) hc = CONFIG.COLOR.orange;
    else if (hf > 0.4) hc = CONFIG.COLOR.yellow;
    this._hudBar('HEAT', x, y, w, h, hf, hc, p.overheated ? 'MAX!' : '',
      'icon_heat');

    // ---- WHERE THE LEFT COLUMN ENDS ------------------------------------
    //
    // THE TOP-LEFT WAS TRIPLE-BOOKED AND HAD BEEN SINCE BLOCK 2.
    // `drawHUD` starts at `s.top + 22` and runs three or four rows of 42.
    // `_drawAlert` started at `s.top + 30` and `_drawCarry` at `s.top + 108`.
    // All three read `Display.safe` and all three picked their own number
    // out of it, so the word ALERT was printed through the CORE bar's icon,
    // "DISPATCHED - BREAK CONTACT OR RUN" through the POWER readout, and
    // "CARRYING NOTHING" through HEAT. Three readouts, one rectangle.
    //
    // It survived seventeen blocks because it is in every screenshot this
    // project has ever taken and nobody read one closely: overlapping text
    // still LOOKS like a HUD at a glance, and the tests that cover this
    // corner assert on the SOURCE ("is it anchored top-left?") rather than
    // on where the pixels land.
    //
    // So the column has one cursor. Each block publishes where it ended and
    // the next one starts below it, which also means the layout closes up on
    // its own when LOAD is absent (it draws only for a machine with a load
    // cap) instead of leaving a hole. `tools/hudcheck.py` measures the boxes
    // in a browser and fails on any overlap.
    this._hudBottom = y + h;
  }

  // Core Level: XP bar plus a tappable LVL button that glows when points are
  // banked. Levelling never interrupts the fight — the player opens it.
  // Boss bar, top-centre — big, unmistakable, and it shows how much of the
  // machine is still bolted together (plan §44: strip it, don't just burn it).
  // WHAT YOU ARE CARRYING AND HAVE NOT KEPT.
  //
  // 3.2: "The HUD must show, at all times, how much unbanked value you're
  // carrying. This number is the tension. Without it there is no decision."
  // Taken literally: it is on screen whenever you are carrying anything, it
  // names the nearest garage so 'bank it' is an action rather than a wish,
  // and it turns red once the haul is worth more than a drive home.
  _drawCarry(ctx) {
    const n = Salvage.unbankedCount();
    const s = Display.safe;
    // "Top left, directly under health. Never anywhere else." It was under
    // health by 108 pixels and health is 130 tall, so it was ON health.
    const x = s.left + 30;
    const y = (this._alertBottom !== undefined ? this._alertBottom
                                               : s.top + 108) + 26;
    if (!n) {
      // Nothing carried is still information: it means dying costs nothing.
      // Quiet, and still a word: grid on the world is 1.12:1 (measured),
      // which is a smudge. Steel is the quietest colour that reads -- on a
      // dark floor. On Central Dispatch's white one it was 1.88:1 (D338),
      // and this line sits on the floor, not a panel, once the LOAD row is
      // present, which it is for every framed machine. So it carries an ink
      // shadow and is its own contrast on any ground.
      R.smallText('CARRYING NOTHING', x, y, 22, CONFIG.COLOR.steel, 'left', true);
      return;
    }
    const v = Salvage.unbankedValue();
    const heavy = v >= 120;
    R.smallText('UNBANKED', x, y, 22, CONFIG.COLOR.steel, 'left', true);
    // LEFT-ALIGNED, AND CLEAR OF ITS OWN LABEL. `R.text` defaults to CENTRE,
    // so "200 SCRAP" was centred ON the column's left edge and half of it hung
    // off the left of the readout; and at y+34 with a 40px middle baseline it
    // ran from y+14, through the bottom of the word UNBANKED at y+22. The
    // number that Block 3 calls "the tension" was the least legible thing in
    // the corner.
    R.text(v + ' SCRAP', x, y + 52, 40,
      heavy ? CONFIG.COLOR.orange : CONFIG.COLOR.lime, 'left');
    // THE CARRY LIMIT, ON SCREEN. A cap the player only discovers by being
    // refused is a cap that reads as a bug. It is written as N/LIMIT from the
    // first part carried, and it turns orange on the last slot and red when
    // it is full, so "I should bank" arrives before "why did that not pick
    // up" does.
    const lim = (typeof Rack !== 'undefined' && Rack.carryLimit)
      ? Rack.carryLimit(this.player) : 0;
    const full = lim && n >= lim;
    // ON ITS OWN LINE. Beside the value it collided with it: "200 SCRAP" is
    // 223 pixels of 40px Arial Black and "1,200 SCRAP" is 273, so no fixed
    // offset to the right of a number of unknown length is safe. Under it,
    // nothing has to be predicted.
    const carryLine = n + (lim ? '/' + lim : '') + ' PART' + (n === 1 ? '' : 'S');
    R.smallText(carryLine, x, y + 80, 24,
      full ? CONFIG.COLOR.red : (lim && n >= lim - 1 ? CONFIG.COLOR.orange
                                                     : CONFIG.COLOR.steel));
    if (full) {
      // AND THIS ONE IS MEASURED OFF THE LINE BESIDE IT, not placed at a
      // number picked by eye. The comment five lines up says no fixed offset
      // past a number of unknown length is safe -- and then this banner sat
      // at a flat x + 150 anyway, which worked only because the carry was 8.
      // At "8/8 PARTS" it cleared by 31 pixels. D368 took the carry to 12,
      // "12/12 PARTS" is two characters longer, and the gap fell to FIVE:
      // the two readouts ran together and read as one string. They never
      // shared a pixel, so tools/hudcheck.py was right to pass them, and the
      // screenshot is what caught it.
      //
      // R.smallText draws MONOSPACE, so the width of the line is exactly its
      // character count times the advance. 0.6 is deliberately WIDER than the
      // 0.55 measured in Chrome, because erring wide pushes this clear and
      // erring narrow is the bug above.
      R.smallText('FULL — BANK IT', x + carryLine.length * 24 * 0.6 + 12,
        y + 80, 20, CONFIG.COLOR.red);
    }
    const near = Garages.nearest;
    if (near) {
      const owned = Garages.owned(near.g.id);
      R.smallText((owned ? '' : 'HELD ' + '\u2014' + ' ') + near.g.name + '  ' +
        Math.round(near.d / 10) + 'm', x, y + 110, 22,
        owned ? CONFIG.COLOR.cyan : CONFIG.COLOR.red);
    }
  }

  // THE ALERT BAR. Without this, alert is a number the game knows and the
  // player does not, and the decision to push on or bank cannot be made.
  //
  // Drawn as three SEGMENTS, one per stage, rather than one continuous bar:
  // the stages are the design, and a player needs to see that crossing into
  // the next one is a threshold rather than a slope. The stage name is spelt
  // out because 'DENSITY' and 'QUALITY' mean different things and a colour
  // alone cannot say which you are in.
  // BLOCK 6. What you are dragging, what it is costing you, and — when
  // nothing is hooked — that something is in reach. A tow the player cannot
  // see the price of is a tow they will never choose to take.
  // ---- WHAT MAGS NOTICES --------------------------------------------------
  //
  // The events that are STATES rather than moments. A kill, a bank and a tow
  // all happen at a line of code and fire from there; "you are nearly full"
  // and "the alert has climbed" are conditions, and a condition needs
  // watching or it fires every frame it is true.
  //
  // Edge-triggered, all of them: the flag remembers what was last true, so a
  // line fires when the world crosses into a state and not while it sits
  // there. That is also why they can be `once: false` in the pool and still
  // not spam - the pool decides how often, and this decides WHEN.
  _radioWatch() {
    if (typeof Radio === 'undefined' || !this.player) return;
    const w = this._rw || (this._rw = {});

    if (typeof Rack !== 'undefined' && Rack.pending) {
      const lim = Rack.carryLimit(this.player);
      const n = Rack.pending.length;
      const full = n >= lim;
      const high = !full && lim > 0 && n / lim >= 0.75;
      if (full && !w.full) Radio.fire('carry_full');
      if (high && !w.high) Radio.fire('carry_high');
      w.full = full; w.high = high;
    }

    if (typeof Alert !== 'undefined') {
      const st = Alert.stage();
      const tier = st ? (st.tier || 0) : 0;
      if (tier > (w.tier || 0)) {
        // Stage 3 is a first-time beat of its own; 1 and 2 are the ladder.
        Radio.fire(tier >= 2 ? 'first_alert_3' : 'alert_' + tier);
      }
      w.tier = tier;
    }

    const hp = this.player.hp, mx = this.player.maxHp;
    if (hp !== undefined && mx) {
      const low = hp / mx <= 0.28;
      if (low && !w.low) Radio.fire('health_low');
      w.low = low;
    }

    if (typeof Tow !== 'undefined') {
      const t = !!Tow.hooked;
      if (t && !w.tow) {
        Radio.fire('first_tow');
        if (Tow.hooked.chassis) Radio.fire('towing_chassis');
      }
      w.tow = t;
    }

    if (typeof Machine !== 'undefined' && this.player.heat !== undefined) {
      const hot = this.player.overheated || this.player.heat >= (this.player.maxHeat || 100);
      if (hot && !w.hot) {
        Radio.fire('first_overheat');
        if (this.player.inCombat) Radio.fire('overheat_combat');
      }
      w.hot = hot;
    }
  }

  _drawTow(ctx) {
    const s = Display.safe;
    // RIDING. While you are hitched, the coupling bar, the strain meter and
    // the ride line own the bottom-centre column -- they are a thing you are
    // HOLDING -- and this is a status readout, so it goes above them rather
    // than through them. The two were drawn on top of each other from the
    // day the hitch was built until tools/hudcheck.py measured the ride for
    // the first time: 13,894 square pixels of TOWING LOADER HULK over
    // RIDING THE LINE, in the one state the design says is the hardest hold
    // in the game. The ride owns the number (RailHitch.hudTop); this reads it.
    const rideTop = (typeof RailHitch !== 'undefined' && RailHitch.hudTop)
      ? RailHitch.hudTop() : null;
    // This block's lowest row is `bottom - 180` at 20px. Clear the ride's
    // top by one more row of gap.
    const lift = rideTop === null ? 0
      : Math.max(0, (s.bottom - 180 + 20 + 14) - rideTop);
    const bottom = s.bottom - lift;
    const h = Tow.hooked;
    if (!h) {
      const near = Tow.nearest(this.player);
      if (near) {
        // WITH AN ASSAY MODULE the prompt says what stripping it is worth;
        // without one it says what you can see from here, which is a parts
        // count and nothing else. That difference IS the module.
        // A GUARDED MACHINE WRECK says so BEFORE the press: the guard's
        // name, in the refusal colour, where the hook prompt would be.
        if (Tow.guardOf(near)) {
          R.smallText('GUARDED — KILL THE ' + Tow.guardName(near) + ' TO HOOK THE ' + near.label,
            (s.left + s.right) / 2, bottom - 210, 26, CONFIG.COLOR.orange, 'center');
        } else {
          R.smallText('ACTION TO HOOK — ' + near.label + '  (' +
            (Tow.assaying(this.player) ? Tow.valueText(near)
                                       : near.parts.length + ' PARTS') + ')',
            (s.left + s.right) / 2, bottom - 210, 26,
            (near.chassis || near.machine) ? CONFIG.COLOR.yellow : CONFIG.COLOR.cyan, 'center');
        }
      }
      if (Tow._msgT > 0) {
        R.smallText(Tow._msg, (s.left + s.right) / 2, bottom - 250, 26,
          CONFIG.COLOR.orange, 'center');
      }
      return;
    }
    const pct = Math.round(Tow.speedMul(this.player) * 100);
    R.smallText('TOWING ' + h.label + '  —  ' + h.parts.length +
      ' PARTS, ' + h.scrap + ' SCRAP  —  SPEED ' + pct + '%',
      (s.left + s.right) / 2, bottom - 240, 26,
      (h.chassis || h.machine) ? CONFIG.COLOR.yellow : CONFIG.COLOR.cyan, 'center');
    // PLAYTEST 3 ITEM 2. The missing half of the readout: WHERE. Distance is
    // information in a world this size, and a player should never have to open
    // the map to find out which way home is.
    const home = Compass.homeward(this);
    if (home) {
      R.smallText('NEAREST GARAGE: ' + home.g.name + ', ' +
        Compass.metres(home.d) + ' ' +
        Compass.arrow(Compass.rel(this.player, home.g.x, home.g.y)),
        (s.left + s.right) / 2, bottom - 210, 24, CONFIG.COLOR.lime, 'center');
    } else {
      // No owned garage at all is itself the answer, and a blank line would
      // read as a bug rather than as "you have not claimed one yet".
      R.smallText('NO GARAGE CLAIMED — NOWHERE TO TOW IT YET',
        (s.left + s.right) / 2, bottom - 210, 24, CONFIG.COLOR.orange, 'center');
    }
    // WHITE, NOT GRID. `CONFIG.COLOR.grid` is 1.87:1 on the Ironworks'
    // ground -- measured by tools/hudcheck.py sampling the pixels under the
    // string, and steel cleared it on average but not over the molten patch
    // behind its brightest quarter -- and this is a rule the player has to
    // be able to read.
    R.smallText('NO FAST TRAVEL WHILE TOWING',
      (s.left + s.right) / 2, bottom - 180, 20, CONFIG.COLOR.white, 'center');
  }

  // RIDING THE TRAIN: the coupling bar and the strain meter while hitched,
  // the hook prompt while a car is passing in reach. RailHitch owns both.
  _drawHitch(ctx) {
    if (typeof RailHitch === 'undefined') return;
    RailHitch.draw(ctx);
    if (RailHitch.riding()) return;
    const p = RailHitch.prompt(this.player);
    if (!p) return;
    const s = Display.safe;
    R.smallText(p.text, (s.left + s.right) / 2, s.bottom - 292, 26,
      p.ok ? CONFIG.COLOR.lime : CONFIG.COLOR.yellow, 'center');
  }

  // PLAYTEST 2 ITEM 6. Reading a fragment: the record fills through
  // Story.find (the ONE writer), the text shows in the same bottom-centre
  // register the barrier prompts use, and 'pickup' marks the moment. A
  // reread shows the text again and writes nothing.
  _readFragment(f) {
    const frag = (typeof FRAGMENTS !== 'undefined') ? FRAGMENTS[f.fragId] : null;
    if (!frag) return;
    Story.find(f.fragId);
    const lines = frag.text.split('\n');
    this.fragmentShow = { id: f.fragId, lines, t: 4 + lines.length * 1.1 };
    if (typeof Audio_ !== 'undefined') Audio_.play('pickup');
  }

  // PHASE C.3. Taking a find. Everything the grant knows lives in Finds.take
  // (the one writer); this is only the words and the banner timer.
  _takeFind(find) {
    const said = Finds.take(find, this.player);
    if (!said) return;
    this.findShow = { text: said, t: 3.2 };
    // A find is a REWARD, so it reuses the unlock banner the rest of the game
    // already uses for one, rather than inventing a second celebration.
    this.unlockBanner = said;
    this.unlockT = 3.2;
  }

  // BLOCK 14. Going in. The door shuts behind you: a sealed lair has no exit
  // until its boss is dead, and that is the whole of what "commit" means here.
  _enterLair(mouth) {
    const d = Lairs.district(mouth.lairId);
    if (!d) return;
    this._lairReturn = { district: this.district.id, x: mouth.x, y: mouth.y + 500 };
    // CONTENT_RIGS: "Cities, mines and lairs are core only -- you park the
    // rig at the entrance and walk in as the core." RIG_REFUSES and
    // Rigs.entryRefusal were written for it and had no caller: a MAMMOTH
    // drove into the Crucible (D341). The refusal is the prompt on the
    // mouth, and ACTION does what it says: the rig is parked at the return
    // spot and the core goes in alone. The exit below climbs you back in.
    const why = (typeof Rigs !== 'undefined') ? Rigs.entryRefusal(this.player, 'lair') : null;
    if (why) {
      const left = Rigs.docked();
      Rigs.undock(this.player, this._lairReturn.x, this._lairReturn.y, this.district.id);
      Machine.recalcStats(this.player);
      if (typeof Effects !== 'undefined' && Effects.comicWord && left) {
        Effects.comicWord(left.name + ' LEFT AT THE DOOR', this.player.x, this.player.y - 300,
          CONFIG.COLOR.yellow, 54);
      }
    }
    this._enterDistrict(d, null);
    if (typeof Effects !== 'undefined' && Effects.comicWord) {
      Effects.comicWord('SEALED', this.player.x, this.player.y - 200,
        CONFIG.COLOR.orange, 84);
    }
  }

  // BLOCK 13. Talking. Missions.talk owns everything that happens; this is
  // the words on screen and the timer under them.
  _talkTo(npc) {
    const said = Missions.talk(npc);
    if (!said) return;
    const lines = [said.name + ':'].concat(said.lines || []);
    if (said.kind === 'given' && said.title) lines.push('→ ' + said.title);
    if (said.kind === 'done' && said.reward) lines.push('→ ' + said.reward);
    this.fragmentShow = { id: 'npc', lines, t: 4 + lines.length * 1.1 };
    if (typeof Audio_ !== 'undefined') {
      Audio_.play(said.kind === 'done' ? 'unlock' : 'pickup');
    }
  }

  // The fragment prompt and the read text. Sits one line above the barrier
  // register so the two can coexist when a fragment stands beside a gate.
  _drawFragment(ctx) {
    if (typeof Story === 'undefined') return;
    const s = Display.safe;
    const mid = (s.left + s.right) / 2;
    if (this.fragmentShow) {
      const ls = this.fragmentShow.lines;
      const lh = 30, w = 940;
      const h = ls.length * lh + 52;
      const y0 = s.bottom - 280 - h;
      R.roundRect(mid - w / 2, y0, w, h, 14, 'rgba(5,6,14,0.88)', '#ffb020', 4);
      ls.forEach((l, i) => {
        R.smallText(l, mid, y0 + 38 + i * lh,
          R.fitText(l, 22, w - 70), '#e8ddc8', 'center');
      });
      return;
    }
    const f = Story.nearest ? Story.nearest(this.player) : null;
    if (f) {
      R.smallText(f.found ? 'ACTION TO REREAD — LOGGED' : 'ACTION TO READ — RECORD',
        mid, s.bottom - 292, 24,
        f.found ? CONFIG.COLOR.steel : CONFIG.COLOR.lime, 'center');
      return;
    }
    // PHASE C.3. The find prompt, in the same register and NAMING WHAT IS IN
    // IT. "ACTION TO TAKE" is a shrug; "ACTION TO TAKE — GADGET: JAMMER 1" is
    // a reason to have driven here, and it is the difference between a find
    // being loot and being a destination.
    // THE MOUTH OF A LAIR, first and loudest. It says what it is and what it
    // costs before you press anything.
    if (typeof LairDoors !== 'undefined') {
      const m = LairDoors.nearest(this.player);
      if (m && !m.beaten) {
        const L = LAIRS[m.lairId];
        // Both on the WORLD, where a building's amber stripe can run under
        // them: the opt-in ink shadow (D338), so they read on any ground.
        R.smallText('ACTION TO ENTER — ' + (L ? L.name : 'THE LAIR') +
          '   (NO WAY OUT UNTIL IT IS DEAD)', mid, s.bottom - 292, 24,
          CONFIG.COLOR.orange, 'center', true);
        // The rig does not fit. Said BEFORE the press, not after (D341).
        const why = (typeof Rigs !== 'undefined') ? Rigs.entryRefusal(this.player, 'lair') : null;
        if (why) R.smallText(why, mid, s.bottom - 262, 22, CONFIG.COLOR.yellow, 'center', true);
        return;
      }
    }
    // A PERSON FIRST. Named, and saying what they want, so walking up to one
    // is never a guess.
    if (typeof Missions !== 'undefined' && Missions.nearest) {
      const n = Missions.nearest(this.player);
      if (n) {
        const bd = Missions.badgeFor(n.npcId);
        const dn = NPCS[n.npcId];
        const what = !bd ? 'TALK'
          : (bd.mark === '?' ? 'A JOB' : (bd.mark === '!' ? 'HAND IT IN' : 'TALK'));
        R.smallText('ACTION TO SPEAK — ' + (dn ? dn.name : 'UNIT') +
          '  (' + what + ')', mid, s.bottom - 292, 24,
          bd && bd.mark === '!' ? CONFIG.COLOR.lime : '#ffb020', 'center');
        return;
      }
    }
    if (typeof Finds === 'undefined') return;
    const g = Finds.nearest(this.player);
    if (!g) return;
    // A SEALED VAULT names its opener instead of offering the button, and
    // the seal's own tell under it -- the barrier prompt's register, because
    // a vault is a barrier with money behind it.
    const sealed = Finds.refusal(g, this.player);
    if (sealed) {
      R.smallText(sealed, mid, s.bottom - 292, 24, CONFIG.COLOR.orange, 'center');
      if (g.seal) R.smallText(g.seal.tell, mid, s.bottom - 262, 20, CONFIG.COLOR.steel, 'center');
      return;
    }
    R.smallText('ACTION TO TAKE — ' + g.label() + ': ' + g.name(),
      mid, s.bottom - 292, 24, '#ffb020', 'center');
  }

  // ---- PHASE C: DISTRICT EXITS -------------------------------------------
  // The exits are world-owned, so this scans World.owned (a handful of
  // entries), never the full entity list.
  _nearestExit() {
    if (typeof DistrictExit === 'undefined' || typeof World === 'undefined') {
      return null;
    }
    let best = null, bd = EXIT.NEAR_R;
    for (const e of World.owned) {
      if (!(e instanceof DistrictExit)) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Why you cannot pass, in words that name the opener (B.2's rule, applied
  // to doors between districts). Null means drive through.
  _exitRefusal(exit) {
    const d = DISTRICTS[exit.to];
    if (!d) return 'THE ROAD GOES NOWHERE';
    if (d.coreOnly && typeof Rigs !== 'undefined' && Rigs.dockedId()) {
      return d.name + ' — CORE ONLY. LEAVE THE RIG AND GO IN ON FOOT.';
    }
    if (d.gateIn && typeof Barriers !== 'undefined' &&
        !Barriers._hasOpener(this.player, d.gateIn)) {
      if (d.gateIn === 'story:final' && typeof Story !== 'undefined' && Story.finalRefusal) {
        return d.name + ' — ' + (Story.finalRefusal() || 'NOT YET');
      }
      const bits = d.gateIn.split(':');
      const g = (typeof GADGETS !== 'undefined') ? GADGETS[bits[0]] : null;
      return d.name + ' — NEEDS ' +
        (g ? g.name : bits[0].toUpperCase()) + (bits[1] ? ' ' + bits[1] : '');
    }
    return null;
  }

  _checkExits() {
    if (this.scrapped || !this.player.alive) return;
    const e = this._nearestExit();
    if (!e) return;
    if (Math.hypot(e.x - this.player.x, e.y - this.player.y) > EXIT.GO_R) return;
    if (this._exitRefusal(e)) return;      // the refusal is drawn, not acted
    this._travelTo(e);
  }

  _travelTo(exit) {
    // Fast travel is a district crossing, and the arrival line fires from
    // _enterDistrict at the other end - so this is only the first time.
    if (typeof Radio !== 'undefined') Radio.fire('first_fast_travel');
    const from = this.district.id;
    const target = DISTRICTS[exit.to];
    if (!target) return;
    // The tow comes too. The hulk is world-owned while hooked (Block 6), but
    // World.enter wipes the owned list, so it is carried across by hand —
    // towing a chassis home THROUGH another district is the expedition the
    // design asks for, and no fast-travel rule applies to driving.
    const towed = (typeof Tow !== 'undefined' && Tow.towing()) ? Tow.hooked : null;
    // Arrive at the far side's gate back to here, stepped inward so you do
    // not land ON the gate and bounce straight back; a district with no
    // return gate uses its own spawn.
    let at = null;
    // OUT OF A LAIR, you stand where you went in -- beside the rig you left
    // there. `_lairReturn` was written for this on the way in and never
    // read on the way out (D341), so a beaten lair put you at the home
    // district's default spawn, a garage away from your vehicle.
    const back = this._lairReturn;
    if (back && back.district === exit.to) at = { x: back.x, y: back.y };
    for (const ex of (target._spec && target._spec.exits) || []) {
      if (at) break;
      if (ex.to !== from) continue;
      at = { x: ex.cx * WORLD.CHUNK + (ex.x === undefined ? 1536 : ex.x),
             y: ex.cy * WORLD.CHUNK + (ex.y === undefined ? 1536 : ex.y) };
      const ccx = target.cols * WORLD.CHUNK / 2;
      const ccy = target.rows * WORLD.CHUNK / 2;
      const dx = ccx - at.x, dy = ccy - at.y;
      const m = Math.hypot(dx, dy) || 1;
      at.x += (dx / m) * EXIT.ARRIVE_STEP;
      at.y += (dy / m) * EXIT.ARRIVE_STEP;
      break;
    }
    this._enterDistrict(target, at);
    // And climb back in. Rigs.canDockHere is the rule (same district, within
    // reach of where it was parked), and it had no caller either.
    if (back && back.district === exit.to) {
      this._lairReturn = null;
      if (typeof Rigs !== 'undefined' && !Rigs.dockedId()) {
        const mine = Rigs.owned().find(id => Rigs.canDockHere(this.player, id));
        if (mine && Rigs.dock(this.player, mine)) {
          Machine.recalcStats(this.player);
          if (typeof Effects !== 'undefined' && Effects.comicWord) {
            Effects.comicWord('BACK IN THE ' + RIGS[mine].name, this.player.x, this.player.y - 300,
              CONFIG.COLOR.lime, 54);
          }
        }
      }
    }
    if (towed) {
      towed.x = this.player.x - 260;
      towed.y = this.player.y;
      World.own(towed);
      this._adoptWorld();
    }
    if (typeof Effects !== 'undefined') {
      Effects.comicWord(target.name, this.player.x, this.player.y - 260,
        CONFIG.COLOR.yellow, 72);
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('unlock');
  }

  _drawExit(ctx) {
    const e = this._nearestExit();
    if (!e) return;
    const s = Display.safe;
    const mid = (s.left + s.right) / 2;
    const why = this._exitRefusal(e);
    if (why) {
      R.smallText(why, mid, s.bottom - 334, 24, CONFIG.COLOR.orange, 'center');
    } else {
      R.smallText('→ ' + e.targetName, mid, s.bottom - 334, 24,
        CONFIG.COLOR.steel, 'center');
    }
  }

  // THE FIELD WORKSHOP'S COUNTDOWN (D351). garage.js: "the one place the
  // duration is decided, so the HUD's countdown and the timer that actually
  // blocks you can never disagree" -- and there was no countdown: the
  // player stood still, unarmed, for three and a half seconds with nothing
  // on screen saying so or for how long. FieldWork.left is that number.
  _drawFieldWork(ctx) {
    if (typeof FieldWork === 'undefined' || !FieldWork.running(this.player)) return;
    const s = Display.safe;
    const mid = (s.left + s.right) / 2;
    const what = this.player._fieldWhat === 'preset' ? 'SWAPPING PRESET'
      : (this.player._fieldWhat === 'dock' ? 'DOCKING' : 'FITTING');
    R.smallText('FIELD WORK — ' + what + '  ' + FieldWork.left(this.player).toFixed(1) +
      's  —  HOLD STILL, ACTION CANCELS', mid, s.bottom - 290, 26,
      CONFIG.COLOR.yellow, 'center');
  }

  // BLOCK 8 / B.2. What the barrier in front of you wants. Never `blocked`
  // — always the thing that would open it, because the player has to be
  // able to guess, and a barrier they read as broken game instead of as a
  // locked door is a bug.
  _drawBarrier(ctx) {
    if (typeof Barriers === 'undefined') return;
    const b = Barriers.nearest(this.player);
    if (!b) return;
    const s = Display.safe;
    const why = Barriers.refusal(this.player, b);
    const mid = (s.left + s.right) / 2;
    if (why) {
      R.smallText(why, mid, s.bottom - 250, 26, CONFIG.COLOR.orange, 'center');
      R.smallText(b.type.tell, mid, s.bottom - 220, 20, CONFIG.COLOR.grid, 'center');
    } else {
      R.smallText('ACTION TO OPEN — ' + b.type.name, mid, s.bottom - 250, 26,
        CONFIG.COLOR.lime, 'center');
    }
  }

  _drawAlert(ctx) {
    const s = Display.safe;
    const st = Alert.stage();
    const w = 340, h = 16;
    // BELOW THE MACHINE, NOT THROUGH IT. See the note at the end of drawHUD:
    // this used to be s.top + 30, which is inside the CORE bar.
    const x = s.left + 30;
    const y = (this._hudBottom !== undefined ? this._hudBottom : s.top + 148) + 34;
    const segs = POP.STAGES.length - 1;      // stage 0 is 'no bar filled'

    // THE TRAP THIS PROJECT ALREADY WROTE DOWN AND THEN WALKED INTO.
    // `R.smallText` has `textBaseline: 'top'`, so a label at `y - 6` occupies
    // y-6 to y+16 and the bar starts at y+6: the words ALERT and DISPATCH
    // were printed THROUGH the top ten pixels of their own bar in every
    // screenshot this project has taken. A heading placed six pixels above a
    // box is a heading inside it.
    R.smallText('ALERT', x, y - 28, 22, CONFIG.COLOR.steel);
    R.smallText(st.name, x + w - 4, y - 30, 24, st.ink, 'right');

    const segW = (w - (segs - 1) * 6) / segs;
    for (let i = 0; i < segs; i++) {
      const sx = x + i * (segW + 6);
      R.rect(sx, y + 6, segW, h, 'rgba(0,0,0,0.55)');
      const lo = POP.STAGES[i].at, hi = POP.STAGES[i + 1].at;
      const f = Math.max(0, Math.min(1, (Alert.level - lo) / (hi - lo)));
      if (f > 0) R.rect(sx, y + 6, segW * f, h, POP.STAGES[i + 1].ink);
      R.roundRect(sx, y + 6, segW, h, 3, null, CONFIG.COLOR.ink, 3);
    }

    // At the top of the curve, say so in words. A player being hunted should
    // never have to infer it from a bar being full.
    if (st.dispatch) {
      // TWO LINES, BECAUSE THE COLUMN IS 340 WIDE AND THE SENTENCE WAS 449.
      // As one line it ran out of the left column and under the middle of
      // MAGS's strip, which is drawn last and on purpose paints over
      // everything. A warning that is only legible when nobody is talking is
      // not a warning. Stacked, it fits inside the bar it belongs to.
      R.smallText('DISPATCHED', x, y + 32, 22, st.ink);
      R.smallText('BREAK CONTACT OR RUN', x, y + 58, 22, st.ink);
    }
    this._alertBottom = y + (st.dispatch ? 82 : 24);
  }

  _hudBar(label, x, y, w, h, frac, color, valText, iconKey) {
    // Icon instead of the word when the art has loaded; the label stays as the
    // fallback so the HUD is never blank.
    const drew = iconKey && typeof Assets !== 'undefined' &&
      Assets.sprite(R.ctx, iconKey, x - 52, y + h / 2, 66, 66, 0);
    if (!drew) R.text(label, x - 12, y + h / 2 + 2, 26, '#ffffff', 'right');
    R.roundRect(x - 3, y - 3, w + 6, h + 6, 8, 'rgba(0,0,0,0.7)', CONFIG.COLOR.ink, 4);
    R.rect(x, y, w * Math.min(Math.max(frac, 0), 1), h, color);
    if (valText) R.text(valText, x + w + 16, y + h / 2 + 2, 26, '#ffffff', 'left');
  }

  // Draw the chunk grid in WORLD space so the loading can be watched: a
  // live chunk is outlined, the one the player is standing in is filled,
  // and a chunk that has been queued but not built yet is dashed. Without
  // this, a streaming bug is invisible until something pops.
  _drawChunkGrid(ctx) {
    const view = Camera.worldView();
    const here = World.chunkAt(this.player.x, this.player.y);
    ctx.save();
    ctx.lineWidth = 6;
    for (const c of World.visibleChunks(view)) {
      const mine = c.cx === here.cx && c.cy === here.cy;
      ctx.globalAlpha = mine ? 0.30 : 0.16;
      ctx.strokeStyle = mine ? CONFIG.COLOR.lime : CONFIG.COLOR.cyan;
      ctx.strokeRect(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
      if (mine) {
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = CONFIG.COLOR.lime;
        ctx.fillRect(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
      }
    }
    ctx.restore();
  }

  drawDebugPanel() {
    const s = Display.safe;
    const x = s.left + 16, y = s.top + 110;
    const p = this.player;
    const speed = Math.hypot(p.vx, p.vy);
    const here = World.chunkAt(p.x, p.y);
    const chunkKey = World.key(here.cx, here.cy);
    const lines = [
      `fps        ${Main.fps.toFixed(0)}  frame ${Main.frameMs.toFixed(1)}ms (peak ${Main.peakMs.toFixed(1)})`,
      // §7 WORLD BLOCK. First, because when something is wrong in an open
      // world it is almost always streaming, and scrolling to find it is
      // how a debug overlay stops getting used.
      `world      ${this.district.name}  ${World.bounds.w}x${World.bounds.h}  (${this.district.cols}x${this.district.rows} chunks of ${WORLD.CHUNK})`,
      `chunk      ${chunkKey}  [${this.district.templateAt(here.cx, here.cy)}]`,
      `chunks     ${World.loadedCount()} loaded, ${World.queuedCount()} queued  (r${WORLD.LOAD_R} load / r${WORLD.UNLOAD_R} unload)`,
      `built      ${World.stats.built} total, ${World.stats.dropped} entities dropped  last ${World.stats.lastBuildMs.toFixed(2)}ms`,
      `entities   ${this.entities.length} live  (${this._drawIdx.length} flat, ${this._bandIdx.length} band)`,
      `css px     ${Display.cssW} x ${Display.cssH}  dpr ${Display.dpr.toFixed(2)}`,
      // The pixel count, because that is what the draw costs: 1.796 ms per
      // megapixel measured. A frame that is unexpectedly slow is answered by
      // this line more often than by any other in the overlay.
      `canvas     ${Display.canvas ? Display.canvas.width : 0} x ` +
        `${Display.canvas ? Display.canvas.height : 0}  ` +
        `${(((Display.canvas ? Display.canvas.width * Display.canvas.height : 0)) / 1e6).toFixed(2)} Mpx  ` +
        `render scale ${(Display.renderScale * 100).toFixed(0)}%` +
        (Display.userScale ? ' (set)' : ' (auto)'),
      `view       ${Display.viewW.toFixed(0)} x ${Display.viewH.toFixed(0)} logical`,
      `player     ${p.x.toFixed(0)}, ${p.y.toFixed(0)} world`,
      `speed      ${speed.toFixed(0)} / ${p.maxSpeed}`,
      `aim        ${p.aimX.toFixed(2)}, ${p.aimY.toFixed(2)}`,
      `camera     ${Camera.x.toFixed(0)}, ${Camera.y.toFixed(0)}  zoom ${Camera.zoom.toFixed(2)}`,
      `move stick ${Controls.move.dx.toFixed(2)}, ${Controls.move.dy.toFixed(2)}  mag ${Controls.move.mag.toFixed(2)}`,
      `power      ${this.player.powerUsed ?? 0}/${this.player.powerCap ?? this.player.power} used`,
      `heat       ${this.player.heat.toFixed(0)}/${this.player.heatCap} ${this.player.overheated ? 'OVERHEATED' : ''}`,
      `dash cd    ${this.player.dashCd.toFixed(1)}s`,
      `modules    ${this.player.moduleCount}/${this.player.maxModules}  [${this.player.sockets.map(s => s.comp ? s.comp.part.id.slice(0,3).toUpperCase() : '---').join(' ')}]`,
      `mines      ${Mines.items.length} / ${Mines.MAX}   spdMul ${(this.player.speedMul || 1).toFixed(2)} recMul ${(this.player.recoilMul || 1).toFixed(2)}`,
      `projectiles ${Projectiles.activeCount()} / ${Projectiles.MAX}`,
      `loose parts ${LooseParts.items.length} / ${LooseParts.MAX}`,
      `alert      ${Alert.level.toFixed(2)} / ${POP.ALERT_MAX}  ${Alert.stage().name}  (peak ${Alert.peak.toFixed(2)}, ${Alert.dispatches} dispatched)`,
      `machines   ${Population.aliveCount()} alive  (${Population.patrolCount()} patrol, ${Population.eliteCount()} elite, cap ${Alert.stage().cap})`,
      `posts      ${Object.keys(Population.spawners).length} loaded, ${Population.stats.spawned} spawned, ${Population.stats.retired} retired, ${Population.stats.killed} killed`,
      `placed     ${World.killedCount()} dead for good  (unseen ${Alert.seenT.toFixed(1)}s)`,
      `unbanked   ${Salvage.unbankedValue()} scrap in ${Salvage.unbankedCount()} part(s)   bank ${Forge.scrap}`,
      `garage     ${Garages.nearest ? (Garages.nearest.g.name + ' ' + Math.round(Garages.nearest.d) + 'u' + (Garages.owned(Garages.nearest.g.id) ? ' OWNED' : ' HELD')) : 'none'}  (${Garages.ownedCount()} owned, grade ${Rack.access})`,
      `wreck      ${Wrecks.current ? (Wrecks.current.parts.length + ' parts at ' + Math.round(Wrecks.current.x) + ',' + Math.round(Wrecks.current.y)) : 'none'}`,
            `rot step   ${this.player.rotStep || 0}/${Machine.rootCount(this.player)}`,
      `magnet     held:${Magnet.held ? Magnet.held.part.id : '-'} sock:${Magnet.selectedSocket} rip:${Magnet.ripSocket ? (Magnet.ripT / Magnet.RIP_TIME * 100).toFixed(0) + '%' : '-'}`,
      `firing     ${Controls.firing}`,
      `dash       ${Controls.dash.pressed}   magnet ${Controls.magnet.pressed} ${this.magnetHeld.toFixed(1)}s`,
    ];
    R.roundRect(x - 8, y - 8, 620, lines.length * 30 + 16, 12, 'rgba(0,0,0,0.65)');
    lines.forEach((ln, i) =>
      R.smallText(ln, x, y + i * 30, 24, CONFIG.COLOR.lime));
  }
}

// ---------------------------------------------------------------------------
// Screen-space background grid for menu states.
function drawFloorGrid() {
  const v = Display.viewRect();
  const c = R.ctx;
  c.strokeStyle = CONFIG.COLOR.grid;
  c.lineWidth = 2;
  const step = 120;
  const x0 = Math.floor(v.x / step) * step;
  const y0 = Math.floor(v.y / step) * step;
  c.beginPath();
  for (let x = x0; x <= v.x + v.w; x += step) { c.moveTo(x, v.y); c.lineTo(x, v.y + v.h); }
  for (let y = y0; y <= v.y + v.h; y += step) { c.moveTo(v.x, y); c.lineTo(v.x + v.w, y); }
  c.stroke();
}

// SCRAPCORE: BREAKLANDS — Machine attachment system (Milestones 6–12)
// THE core system of the game. Works on ANY entity with {x, y, radius,
// aimX, aimY, vx, vy}. Design rules honoured here (plan §15–17, §32–37):
//   - 8 root sockets in fixed world directions around the Core
//   - Splitter adds 2 child sockets; HARD CAP 10 attached modules
//   - ranged weapons rotate toward aim like turrets
//   - Saws grind outward; beams lance outward toward aim
//   - Armour physically blocks; Directional Shield projects a blocking arc
//   - stat parts (thruster/treads/targeting/etc.) feed recalcStats

const Machine = {
  // Set by the GameState each frame so XP awards can reach the player.
  _xpPlayer: null,

  // Where the saw's blade sits inside its sprite, as fractions of the sprite
  // size. Generated when part_saw was split into body + blade; regenerate
  // these if the saw model is ever re-rendered.
  SAW_RIG: { hubX: 0.1733, hubY: -0.0184, bladeFrac: 0.6658 },

  // The Drone Bay's drones fire a real projectile through the normal pipe,
  // so they collide, spark and credit damage exactly like any other shot.
  // Master Utility table: 5 dmg x 3/s each, range 650.
  DRONE_SHOT: {
    id: 'droneBay', damage: 5, fireRate: 3,
    projSpeed: 1300, projRadius: 7, projLife: 0.62, spread: 0.05,
    splash: 0, heatPerShot: 0, recoil: 0, color: '#9b5cff',
  },
  // 230, not 168. At 168 the drones orbit ON the Barrier Projector's ring
  // and read as two beads sliding round it rather than as machines of their
  // own — caught by putting a Drone Bay and a Barrier Projector on the same
  // rig and looking at the screen. Well outside the ring they are obviously
  // separate things.
  DRONE_ORBIT: 230,      // how far out the drones fly
  DRONE_R: 20,           // drone hit radius — they can be shot down

  SOCKET_DIST_PAD: 46,   // how far past the core radius sockets sit
  CHILD_DIST_PAD: 132,   // splitter child sockets sit further out
  CONNECTOR_R: 28,       // connector hitbox — bigger than its art (plan §19)
  RIP_THRESHOLD: 0.25,   // below 25% connector HP: magnet-rip possible (M8)
  // 10 root sockets max (8 at run start, +1 at Core Level 10 and 20).
  // A Splitter eats one root and grows two children, so a fully levelled
  // machine running one Splitter tops out at exactly 12 modules.
  MAX_MODULES: 12,
  _attachOrder: 0,       // global counter: newest parts go OFFLINE first (§24)
  world: null,           // { arena, obstacles } set by the game state (beams)

  initSockets(ent, count = 8) {
    ent.sockets = [];
    ent.rotRadians = 0;           // total rig rotation (ROTATE button)
    for (let i = 0; i < count; i++) {
      // Socket 0 at top, clockwise — matches the plan §15 diagram.
      const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
      ent.sockets.push({ id: i, angle, angleTarget: angle, comp: null });
    }
    ent._nextSocketId = count;
    ent.maxModules = this.MAX_MODULES;
    ent.moduleCount = 0;
    ent.rotStep = 0;              // how many socket steps the rig is turned
    // recalcPower (not just recalcStats) so powerUsed/powerCap are defined on
    // a bare machine — the HUD and firmware both read them before any attach.
    this.recalcPower(ent);
  },

  getSocket(ent, id) {
    return ent.sockets.find(s => s.id === id) || null;
  },

  socketDist(ent, s) {
    return ent.radius + (s.distPad !== undefined ? s.distPad : this.SOCKET_DIST_PAD);
  },

  connectorPos(ent, s) {
    // Child connectors sit between the parent splitter and the child part.
    let ox = ent.x, oy = ent.y, baseD = ent.radius;
    if (s.parentId !== undefined) {
      const parent = this.getSocket(ent, s.parentId);
      if (parent) {
        const pp = this.socketPos(ent, parent);
        ox = pp.x; oy = pp.y; baseD = 0;
      }
    }
    const target = this.socketPos(ent, s);
    const dx = target.x - ox, dy = target.y - oy;
    const l = Math.hypot(dx, dy) || 1;
    const d = baseD + (l - baseD) * 0.45;
    return { x: ox + dx / l * d, y: oy + dy / l * d };
  },

  socketPos(ent, s) {
    const d = this.socketDist(ent, s);
    return {
      x: ent.x + Math.cos(s.angle) * d,
      y: ent.y + Math.sin(s.angle) * d,
    };
  },

  shieldRadius(ent) {
    return ent.radius + this.SOCKET_DIST_PAD + 48;
  },

  // Attach into a specific socket id, or the first free one. Returns the
  // socket id or -1. Enforces the 10-module hard cap; Splitters cannot
  // nest into child sockets.
  attach(ent, partId, socketId = null) {
    let s = null;
    if (socketId !== null) {
      const k = this.getSocket(ent, socketId);
      if (k && !k.comp) s = k;
    } else {
      s = ent.sockets.find(k => !k.comp);
    }
    if (!s) return -1;
    if (ent.moduleCount >= (ent.maxModules ?? this.MAX_MODULES)) return -1;
    // Master §12: past 130% Load the machine physically cannot take another
    // part. Refused HERE, not penalised later — the same shape as the module
    // cap, and the same place the player learns it.
    if (!this.loadAllows(ent, partId)) return -1;
    // Master §22: player Prototype equip cap (1; PROTOTYPE SYNC raises the
    // POWERED cap to 2). Refused HERE like the module cap and the Load wall.
    if (typeof Proto !== 'undefined' && !Proto.attachAllowed(ent, partId)) {
      return -1;
    }
    if (PARTS[partId].childSockets && s.parentId !== undefined) return -1;
    // Master §9: the BARE Frame does not branch. A Splitter on a Bare Jackal
    // would mint sockets the frame cannot structurally carry. `=== false` on
    // purpose — enemies and test rigs have no branching flag and are not the
    // player's frame progression.
    if (PARTS[partId].childSockets && ent.branchingAllowed === false) return -1;

    s.comp = new Component(partId);
    s.comp.order = ++this._attachOrder;
    // TOUGH MOUNTS: your own connectors are harder to break. At attach, so
    // the part is built with it rather than patched afterwards.
    if (ent.isPlayer && typeof Skills !== 'undefined') {
      const cm = Skills.mul('ownConnHpMul');
      if (cm !== 1) {
        s.comp.maxConnectorHp *= cm;
        s.comp.connectorHp = s.comp.maxConnectorHp;
      }
    }
    // "You bolted somebody else's arm onto yourself and it WORKED."
    if (ent.isPlayer && typeof Radio !== 'undefined') Radio.fire('first_fit');
    if (ent.isPlayer && typeof Opening !== 'undefined') Opening.learn('fit');
    // SIGNATURE #3. "Heard hundreds of times: short, dry, low, and it must
    // never get annoying." Pitched by the part's weight, so a heavy plate
    // lands lower than a targeting module - which is the whole of what
    // "pitched by part size" costs.
    if (typeof Audio_ !== 'undefined') {
      const wgt = (PARTS[partId] && PARTS[partId].loadCost) || 2;
      Audio_.play('partFitted', { pitch: 1.25 - Math.min(0.5, wgt * 0.07) });
    }

    // HARD CLAMPS firmware (M14): tougher joints on everything bolted on.
    const cm = ent.connectorHpMul || 1;
    if (cm !== 1) {
      s.comp.maxConnectorHp *= cm;
      s.comp.connectorHp *= cm;
    }
    // Core Mods (M12): Bastion Plating, Web Clamp, Surge/Field Medic heals.
    if (typeof Mods !== 'undefined') Mods.onAttach(ent, s.comp);

    // Structure parts (Master §Structure): occupy their root socket and spawn
    // child sockets at the LOCKED per-part angles — Splitter ±35°, Fork Beam
    // ±30°, Cross Hub -45/0/+45, the single-child parts dead ahead. The
    // Straight Beam's whole purpose is REACH: its child sits a further 100
    // world units out (`mountExtend`).
    if (s.comp.part.childSockets) {
      s.comp.childIds = [];
      const pt = s.comp.part;
      const n = pt.childSockets;
      for (let i = 0; i < n; i++) {
        const off = (pt.childAngles && pt.childAngles.length === n)
          ? pt.childAngles[i] * Math.PI / 180
          : (i - (n - 1) / 2) * 0.5;         // legacy spread, tests/fixtures
        const id = ent._nextSocketId++;
        ent.sockets.push({
          id, angle: s.angle + off,
          // Inherit the parent's TARGET so children join a rotation already
          // in progress instead of snapping back. childOffset lets the child
          // follow if the root ring is ever re-spaced (level-up sockets).
          angleTarget: (s.angleTarget !== undefined ? s.angleTarget : s.angle) + off,
          childOffset: off,
          comp: null, parentId: s.id,
          distPad: this.CHILD_DIST_PAD + (pt.mountExtend || 0),
        });
        s.comp.childIds.push(id);
      }
    }
    this._recount(ent);
    return s.id;
  },

  detach(ent, socketId) {
    const s = this.getSocket(ent, socketId);
    if (!s || !s.comp) return null;
    const comp = s.comp;
    s.comp = null;

    // Removing a Splitter scatters child parts as salvage and deletes
    // the child sockets themselves.
    if (comp.childIds) {
      for (const cid of comp.childIds) {
        const cs = this.getSocket(ent, cid);
        if (!cs) continue;
        if (cs.comp) {
          const p = this.socketPos(ent, cs);
          // A branch dropping with its parent keeps whatever HP it had — and
          // on a Sacrificial Coupler the child ejects INTACT: never below the
          // §Structure 25% floor. Breaking the cheap joint is the design.
          let frac = cs.comp.hp / cs.comp.maxHp;
          if (comp.part.ejectChildIntact) {
            frac = Math.max(comp.part.ejectChildIntact, frac);
          }
          LooseParts.spawn(cs.comp.part.id, frac,
            p.x, p.y,
            Math.cos(cs.angle) * 420, Math.sin(cs.angle) * 420);
          cs.comp = null;
        }
        const idx = ent.sockets.indexOf(cs);
        if (idx >= 0) ent.sockets.splice(idx, 1);
      }
    }
    this._recount(ent);
    // BLOCK 14. A BOSS CHANGES WHAT IT IS DOING WHEN YOU TAKE THE RIGHT PART.
    //
    // Hooked HERE and nowhere else, because `detach` is the single place in
    // the codebase where a part leaves a machine — breakConnector and
    // destroyComponent both come through it. Two hooks would mean one of
    // them getting forgotten, which is the class of bug the registry exists
    // to prevent everywhere else in this project.
    // "It came off WHOLE. That's the difference between wrecking a thing and
    // taking it." Fired at the one place a part leaves a machine - which is
    // where the boss phases hook too, and for the same reason.
    if (!ent.isPlayer && typeof Radio !== 'undefined') {
      Radio.fire('first_connector_break');
    }
    // LESSON 1 LANDED. Written HERE, at the moment a part comes off whole,
    // because that is the only place in the game where the player can be said
    // to have understood it - and not one frame earlier.
    if (!ent.isPlayer && typeof Opening !== 'undefined') Opening.learn('connector');
    if (typeof BossPhases !== 'undefined' && ent.bossId && comp && comp.part) {
      const fx = BossPhases.onPartLost(ent, comp.standsFor || comp.part.id);
      if (fx && typeof Effects !== 'undefined') {
        Effects.comicWord(fx.says, ent.x, ent.y - 260, CONFIG.COLOR.orange, 62);
        if (typeof Camera !== 'undefined') Camera.shake(14, 0.35);
        if (typeof Audio_ !== 'undefined') Audio_.play('shieldBreak');
      }
    }
    return comp;
  },

  // BLOCK 4.1: permanents are never cleared. `clearAll` is what death and a
  // garage rebuild both call, and a machine that loses its permanent guns to
  // either would defeat the point of having them.
  clearAll(ent) {
    // Remove children first so splitter removal doesn't double-handle.
    for (const s of [...ent.sockets]) {
      if (s.permanent) continue;
      if (s.comp) this.detachSilent(ent, s.id);
    }
    this._recount(ent);
  },

  // Detach without scattering salvage (used by clearAll / death cleanup).
  detachSilent(ent, socketId) {
    const s = this.getSocket(ent, socketId);
    if (!s || !s.comp) return null;
    const comp = s.comp;
    s.comp = null;
    if (comp.childIds) {
      for (const cid of comp.childIds) {
        const cs = this.getSocket(ent, cid);
        if (!cs) continue;
        cs.comp = null;
        const idx = ent.sockets.indexOf(cs);
        if (idx >= 0) ent.sockets.splice(idx, 1);
      }
    }
    return comp;
  },

  _recount(ent) {
    // BLOCK 4.2: a permanent is in a SLOT, not a module socket. Counting one
    // here would charge the player a module for a weapon they cannot remove,
    // and would zoom the camera out for it.
    ent.moduleCount = ent.sockets
      .reduce((n, s) => n + (s.comp && !s.permanent ? 1 : 0), 0);
    this.recalcPower(ent);
  },

  // ---------------------------------------------------------------------
  // Power (Milestone 9, plan §24). Entities without a power stat run
  // everything. Otherwise: parts power up in attach order; when demand
  // exceeds capacity, the NEWEST parts go OFFLINE.
  // What a mounted part actually draws from the grid: its locked cost minus
  // the Weapon Lab's EFFICIENCY levels, never below 1. Player weapons only —
  // enemies, 0-Power parts and non-weapons pay the table price. THE one place
  // this number is computed, so the budget, the demand figure, the shortfall
  // and the POWER panel can never disagree about it.
  powerCostOf(ent, comp) {
    // BLOCK 4.1: a permanent weapon does not use power. It always fires;
    // heat is the only thing holding it back. One of exactly three places
    // that know what `permanent` means.
    if (comp && comp.part && comp.part.permanent) return 0;
    let cost = comp.part.powerCost || 0;
    if (cost > 0 && ent.isPlayer && comp.part.category === 'weapon' &&
        typeof WeaponLab !== 'undefined') {
      cost = Math.max(1, cost - WeaponLab.powerDrawCut(comp.part.id));
    }
    // POWER BUS Core Mod (M12): Utility parts cost 1 less, minimum 1 (§18).
    if (cost > 0 && ent.isPlayer && comp.part.category === 'utility' &&
        typeof Mods !== 'undefined') {
      cost = Math.max(1, cost - Mods.utilityPowerCut(ent));
    }
    // §30 EFFICIENT BUS: the one or two hungriest ACTIVE standard modules
    // cost 1 less. Which ones those are is decided in recalcPower (it can
    // see the whole machine) and flagged on the component; the discount is
    // spent HERE, at the one draw pipe, like every other cut.
    if (cost > 0 && ent.isPlayer && comp._busCut) cost = Math.max(1, cost - 1);
    return cost;
  },

  recalcPower(ent) {
    if (ent.power === undefined) {
      for (const s of ent.sockets) if (s.comp) s.comp.online = true;
      this.recalcStats(ent);
      return;
    }
    // GENERATOR: "power budget". The one number every fitted part is checked
    // against, so raising it here raises it everywhere and nothing else has
    // to know the skill exists.
    let cap = ent.power;
    if (ent.isPlayer && typeof Skills !== 'undefined') {
      cap = Math.round(cap * Skills.mul('powerMul'));
    }
    for (const s of ent.sockets) {
      // A Capacitor knocked off the grid by an overheat takes its +3 with
      // it — otherwise "drops offline" would be a label with no consequence.
      if (s.comp && s.comp.part.powerBonus && !(s.comp._forcedOffT > 0)) {
        cap += s.comp.part.powerBonus;
      }
    }
    // FORTRESS GRID Core Mod (M12): +2 Power, active even in Pure (§18).
    if (ent.isPlayer && typeof Mods !== 'undefined') cap += Mods.powerBonus(ent);
    if (ent.isPlayer) cap += ent.cellPower || 0;    // collected power cells
    // GADGETS COST POWER, off the same budget the modules spend from — which
    // is the whole reason gadget slots are a decision rather than a menu.
    // Taken off the CAP rather than added to the demand so an overloaded
    // gadget bay switches MODULES off, and the player sees the cost where
    // they already read the budget. PARALLEL BUS is what makes it free, and
    // it is spent inside Gadgets.powerDraw so nothing here has to know.
    if (ent.isPlayer && typeof Gadgets !== 'undefined') {
      cap = Math.max(0, cap - Gadgets.powerDraw());
    }

    // POWER PRIORITY (Master §11). Over budget, the LOWEST-priority powered
    // parts go offline — and priority is the player's saved choice, not the
    // order they happened to bolt things on. `powerPriority` is set from the
    // Pause -> MACHINE -> POWER screen.
    //
    // 0-Power parts are never really in the running: §11 says they stay
    // online, and they cost nothing, so they are forced on below.
    const list = this._powerSorted(ent.sockets.filter(s => s.comp));
    let used = 0;
    for (const s of list) {
      const c = s.comp;
      const cost = this.powerCostOf(ent, c);
      const was = c.online;
      // §11: a 0-Power part is always online. It is physical, not electrical
      // — unless something has explicitly knocked it out (Capacitor).
      if (c._forcedOffT > 0) c.online = false;
      else c.online = cost === 0 ? true : (used + cost <= cap);
      if (c.online) used += cost;
      const changed = (was === undefined && !c.online) ||
                      (was !== undefined && was !== c.online);
      if (changed && typeof Effects !== 'undefined') {
        const p = this.socketPos(ent, s);
        Effects.comicWord(c.online ? 'ONLINE!' : 'OFFLINE!', p.x, p.y - 70);
      }
      if (c.online === undefined) c.online = true;
    }
    ent.powerUsed = used;
    ent.powerCap = cap;
    this.recalcLoad(ent);
    // How much the machine WANTS, so the HUD and the drop curve can both talk
    // about the shortfall rather than each deriving it differently.
    let demand = 0;
    for (const s of ent.sockets) {
      if (s.comp) demand += this.powerCostOf(ent, s.comp);
    }
    ent.powerDemand = demand;
    this.recalcStats(ent);
  },

  // ---- LOAD (Master §12) -------------------------------------------------
  // Load is WEIGHT, not electricity: every attached part counts, online or
  // not, because a dead railgun is exactly as heavy as a live one. The
  // penalties are banded and the top band is a hard refusal to attach more.
  LOAD_BANDS: [
    { upTo: 1.00, move: 1.00, dash: 1.00, label: null },
    { upTo: 1.10, move: 0.90, dash: 1.00, label: 'HEAVY' },
    { upTo: 1.20, move: 0.80, dash: 0.90, label: 'OVERLOADED' },
    { upTo: 1.30, move: 0.70, dash: 0.80, label: 'STRAINING' },
  ],

  recalcLoad(ent) {
    if (ent.loadCap === undefined) return;   // enemies have their own budgets
    let load = 0, capAdd = 0;
    for (const s of ent.sockets) {
      if (!s.comp) continue;
      if (s.permanent) continue;   // BLOCK 4.1: bolted to the frame, not carried
      load += s.comp.part.loadCost || 0;
      // Heavy Treads: +8 effective cap, but only while POWERED — dead treads
      // are just four more Load of dead weight.
      if (s.comp.online && s.comp.part.loadCapAdd) capAdd += s.comp.part.loadCapAdd;
    }
    // LOAD BEARER / FORTRESS GRID Core Mods (M12) — §18, Pure included.
    if (ent.isPlayer && typeof Mods !== 'undefined') capAdd += Mods.loadCapAdd(ent);
    ent.loadUsed = load;
    const effCap = ent.loadCap + capAdd;
    ent.loadCapEff = effCap;
    const frac = effCap > 0 ? load / effCap : 0;
    ent.loadFrac = frac;
    let band = this.LOAD_BANDS[this.LOAD_BANDS.length - 1];
    for (const b of this.LOAD_BANDS) {
      if (frac <= b.upTo + 1e-9) { band = b; break; }
    }
    // Over 130% you could not have attached the last part at all (see
    // attach), so the worst band the machine can actually be IN is 121-130.
    ent.loadMoveMul = band.move;
    ent.loadDashMul = band.dash;
    ent.loadLabel = band.label;
  },

  // Would adding this part push the machine past the hard 130% ceiling?
  loadAllows(ent, partId) {
    if (ent.loadCap === undefined) return true;
    const add = (PARTS[partId] && PARTS[partId].loadCost) || 0;
    const cap = ent.loadCapEff !== undefined ? ent.loadCapEff : ent.loadCap;
    return (ent.loadUsed || 0) + add <= cap * 1.30 + 1e-9;
  },

  // Set a part's power priority and re-resolve the grid immediately, so the
  // player SEES the lights move as they choose. Lower number = higher
  // priority = last to go dark.
  setPowerPriority(ent, socketId, priority) {
    const s = this.getSocket(ent, socketId);
    if (!s || !s.comp) return false;
    s.comp.powerPriority = priority;
    this.recalcPower(ent);
    return true;
  },

  // Sort sockets by power priority, highest priority first.
  //
  // The subtlety that bit once: `comp.order` is a global attach counter, so
  // its numbers (137, 138...) are nowhere near the small explicit priorities
  // (0, 1, 2) the panel writes. Comparing them raw made ANY explicit value
  // beat ANY default — so demoting a part to the bottom of the list did
  // nothing. Unset parts are ranked by their POSITION in this machine's
  // attach order instead, which puts both on the same scale and makes
  // "default = attach order" literally true.
  _powerSorted(list) {
    const byOrder = list.slice().sort((a, b) => a.comp.order - b.comp.order);
    const implicit = new Map();
    byOrder.forEach((s, i) => implicit.set(s, i));
    return list.slice().sort((a, b) => {
      const pa = a.comp.powerPriority !== undefined
        ? a.comp.powerPriority : implicit.get(a);
      const pb = b.comp.powerPriority !== undefined
        ? b.comp.powerPriority : implicit.get(b);
      if (pa !== pb) return pa - pb;              // lower number = keep it on
      return implicit.get(a) - implicit.get(b);   // stable tiebreak
    });
  },

  // The powered parts, in the order the grid will drop them (last first).
  powerOrder(ent) {
    return this._powerSorted(
      ent.sockets.filter(s => s.comp && (s.comp.part.powerCost || 0) > 0));
  },

  // ---------------------------------------------------------------------
  // Milestone 12: aggregate stat modifiers from ONLINE parts (plan §36–37).
  // M2: the single place a weapon's output is assembled. Machine multiplier x
  // component GRADE (Master §15) x Weapon MASTERY (Master §17). Mastery and
  // Forge both self-suppress in Pure modes, so this needs no mode check of its
  // own — there is exactly one POWERED switch and they read it.
  outputMul(ent, comp) {
    let m = ent.damageMul || 1;
    // M26 ARENA Sudden Death (§29): +50% damage BOTH sides for the last 30s.
    // The one output pipe, so every weapon family obeys without knowing why.
    if (ent._suddenDeathMul) m *= ent._suddenDeathMul;
    if (comp && comp.gradeOutput) m *= comp.gradeOutput;
    if (ent.isPlayer && comp && typeof Mastery !== 'undefined') {
      // §22: the Siege Cannon and Boremaw Drill USE the standard track
      // (masteryAs); everything else is keyed by its own id.
      m *= Mastery.damageMul(comp.part.masteryAs || comp.part.id);
    }
    // CRUCIBLE CORE (§22): Beam/Flame/Plasma weapon output +10% while online.
    if (comp && (ent.hotOutputMul || 1) !== 1 &&
        (comp.part.beam || comp.part.flame || comp.part.id === 'plasmaRepeater')) {
      m *= ent.hotOutputMul;
    }
    // PATCHWORK NODE (§22): +15% primary output on a tagged field-salvaged
    // part — consumed HERE, at the one output pipe, not where the tag is set.
    if (comp && comp._nodeBoost) m *= PARTS.patchworkNode.nodeOutMul;
    // Overcharger (Master Power/Cooling table): powered weapons only.
    if (comp && comp.part.category === 'weapon') m *= (ent.weaponDamageMul || 1);
    // WEAPON OUTPUT Forge track (M11) — player weapons, +2%/level.
    if (ent.isPlayer && typeof Forge !== 'undefined' && Forge.damageMul) {
      m *= Forge.damageMul();
    }
    // Weapon Lab POWER — per-weapon, bought with SCRAP.
    if (ent.isPlayer && comp && typeof WeaponLab !== 'undefined') {
      m *= WeaponLab.damageMul(comp.part.id);
    }
    // THE SPINE (Block 10). A permanent's class upgrades, bought with scrap AND
    // upgrade parts. Applied at the one output pipe like everything else, so a
    // spine step lands on every weapon family without any of them knowing the
    // spine exists.
    if (ent.isPlayer && comp && comp.part.permanent && typeof Spine !== 'undefined') {
      m *= Spine.mul(comp.part.id, 'damage') * Spine.mul(comp.part.id, 'dps');
    }
    // WEAPON CLASS SKILL (§7). The spine above is what you BUY; this is what
    // you EARN, and the difference that matters here is the missing
    // `comp.part.permanent` guard: "kill with machine guns and EVERY machine
    // gun improves — STOLEN AND PERMANENT ALIKE". A skill that only paid the
    // gun you were given would be the spine with extra steps.
    if (ent.isPlayer && comp && typeof WeaponSkill !== 'undefined' &&
        WeaponSkill.mul) {
      m *= WeaponSkill.mul(comp.part.id, 'damage');
    }
    // §30 firmware that depends on the WEAPON or the range (CLOSE QUARTERS,
    // HEAVY HAND). Asked as one question so this pipe never learns the table.
    // M12: Core Mods / Tuning / Specials — Heavy, melee and window bonuses.
    if (ent.isPlayer && comp && typeof Mods !== 'undefined') {
      m *= Mods.damageMul(ent, comp.part);
    }
    return m;
  },

  recalcStats(ent) {
    let speed = 1, dashP = 1, dashCd = 1, recoil = 1, knock = 1;
    let mRange = 1, mPull = 1, mRip = 1, spread = 1, heatBonus = 0;
    let wRate = 1, wDmg = 1, wHeat = 1, ripTime = 1, hotOut = 1;
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c || !c.online) continue;
      const p = c.part;
      if (p.speedAdd) speed += p.speedAdd;
      if (p.dashPowerMul) dashP *= p.dashPowerMul;
      if (p.dashCdMul) dashCd *= p.dashCdMul;
      if (p.recoilMul) recoil *= p.recoilMul;
      // knockbackMul is the OTHER half of recoil: what the world does to you.
      // A part that only lists recoilMul (Heavy Treads used to) resists both,
      // so the fallback keeps every existing part behaving as it did.
      if (p.knockbackMul !== undefined) knock *= p.knockbackMul;
      else if (p.recoilMul) knock *= p.recoilMul;
      if (p.weaponRateMul) wRate *= p.weaponRateMul;
      if (p.weaponDamageMul) wDmg *= p.weaponDamageMul;
      if (p.weaponHeatMul) wHeat *= p.weaponHeatMul;
      if (p.magnetRangeMul) mRange *= p.magnetRangeMul;
      if (p.magnetPullMul) mPull *= p.magnetPullMul;
      if (p.ripSpeedMul) mRip *= p.ripSpeedMul;
      if (p.spreadMul) spread *= p.spreadMul;
      if (p.heatCapBonus) heatBonus += p.heatCapBonus;
      if (p.ripTimeMul) ripTime *= p.ripTimeMul;        // Reclaimer Magnet
      if (p.hotOutputMul) hotOut *= p.hotOutputMul;     // Crucible Core
    }
    ent.speedMul = Math.max(0.5, speed);
    ent.dashPowerMul = dashP;
    ent.dashCdMul = dashCd;
    ent.recoilMul = recoil;
    ent.knockbackMul = knock;
    ent.weaponRateMul = wRate;      // Overcharger
    ent.weaponDamageMul = wDmg;
    ent.weaponHeatMul = wHeat;      // Overcharger up, Coolant Pump down
    ent.magnetRangeMul = mRange;
    ent.magnetPullMul = mPull;
    ent.ripSpeedMul = mRip;
    ent.ripTimeMul = ripTime;
    ent.hotOutputMul = hotOut;
    ent.spreadMul = spread;
    if (ent.baseHeatCap !== undefined) {
      // Heat Sinks on top of the frame base — PLUS the Heat Bank Forge track
      // for the player. Without the Forge term, recalcStats ran after
      // Forge.applyTo and silently clobbered every bought level back to the
      // frame's number: the track showed as purchased and did nothing.
      const forgeHeat = (ent.isPlayer && typeof Forge !== 'undefined'
        && Forge.heatCapBonus) ? Forge.heatCapBonus() : 0;
      ent.heatCap = ent.baseHeatCap + heatBonus + forgeHeat;
      // COOLANT: a bigger heat cap for permanents. At the one place the cap
      // is computed, so nothing downstream has to know the skill exists.
      if (ent.isPlayer && typeof Skills !== 'undefined') {
        ent.heatCap = Math.round(ent.heatCap * Skills.mul('permHeatCapMul'));
      }
      if (ent.heat > ent.heatCap) ent.heat = ent.heatCap;
    }
    // THE RESET LINE. Rank.applyStats used to ASSIGN these five with '=',
    // which is what made them safe for every later layer to multiply into.
    // Stripping Rank took the reset away, so each recalc compounded on the
    // last (CORE PLATING went 0.85 -> 0.72 -> 0.61 ...). They are rebuilt
    // here instead, in the one place recalcStats rebuilds everything else.
    ent.connectorHpMul = 1;
    ent.connectorDamageMul = 1;
    ent.coolingMul = 1;
    ent.coreDamageMul = 1;
    ent.projSpeedMul = 1;
    // Forge, then Mods last of all.
    if (ent.isPlayer && typeof Forge !== 'undefined' && Forge.applyStats) {
      Forge.applyStats(ent);
    }
    // Core Mods, Tuning and the live Special (M12). Last of all: Specials
    // multiply on top of everything, and Mods are identity, not equipment.
    if (ent.isPlayer && typeof Mods !== 'undefined') Mods.applyStats(ent);
  },

  // -------------------------------------------------------------------------
  // Rotate the WHOLE rig by whole socket steps. Sockets are world-fixed, so
  // turning the frame is the only way to re-aim a saw, shield or armour plate
  // without ripping it off — one tap, one step, everything moves together.
  // Rotating is therefore a trade: the shield you swing forward takes the saw
  // off the front.
  rotate(ent, steps = 1) {
    if (!ent.sockets || !ent.sockets.length) return false;
    const roots = this.rootCount(ent);
    ent.rotRadians = (ent.rotRadians || 0) + steps * (Math.PI * 2) / roots;
    ent.rotStep = (((ent.rotStep || 0) + steps) % roots + roots) % roots;
    this._respaceRoots(ent);
    return true;
  },

  // Permanent slots sit on their own ring (Permanents.applyTo) and are not
  // roots: _respaceRoots and Frames.fitSockets both leave them out, and this
  // used not to, so a machine with one permanent fitted -- every machine
  // after the first garage, and every machine from the first frame since
  // D336 -- counted its four-root ring as five and ROTATE turned it 72
  // degrees a tap instead of 90 (D337).
  rootCount(ent) {
    return ent.sockets.filter(s => s.parentId === undefined && !s.permanent).length || 8;
  },

  // How far apart two permanents sit on the aim, in radians: 22 degrees,
  // enough that a second gun's muzzle is not inside the first's.
  PERMANENT_FAN: 0.38,

  // Recompute every root socket's TARGET angle for the current ring size and
  // rotation, then drag children along by their stored offset. Used by both
  // ROTATE and by growing the ring at level 10 / 20.
  _respaceRoots(ent) {
    // Permanent slots have their own ring and are never re-spaced with the
    // roots; a Frame upgrade must not shuffle them.
    const roots = ent.sockets
      .filter(s => s.parentId === undefined && !s.permanent)
      .sort((a, b) => a.id - b.id);
    const n = roots.length;
    roots.forEach((s, i) => {
      s.angleTarget = -Math.PI / 2 + (i / n) * Math.PI * 2 + (ent.rotRadians || 0);
    });
    for (const s of ent.sockets) {
      if (s.parentId === undefined) continue;
      const parent = this.getSocket(ent, s.parentId);
      if (parent) s.angleTarget = parent.angleTarget + (s.childOffset || 0);
    }
  },

  // Add a root socket (level 10 and 20). The ring re-spaces evenly, so parts
  // already bolted on shuffle around rather than the new socket squeezing in.
  addRootSocket(ent) {
    if (!ent.sockets) return false;
    const id = ent._nextSocketId++;
    const angle = -Math.PI / 2 + (ent.rotRadians || 0);
    ent.sockets.push({ id, angle, angleTarget: angle, comp: null });
    this._respaceRoots(ent);
    return true;
  },

  // Ease sockets toward their target angle so the machine servos around
  // instead of teleporting. Positions/arcs all derive from s.angle, so armour
  // facing, shield arcs and saw reach follow for free.
  _updateRotation(dt, ent) {
    // FAST SWAP: "switching between FITTED weapons, +35% / +70% swap speed."
    // In this game you do not select a weapon — you ROTATE the ring until the
    // one you want is pointing at the thing you want it pointing at. The servo
    // rate IS the swap speed, and it is the only number in the machine that
    // answers to that sentence.
    const sk = (ent && ent.isPlayer && typeof Skills !== 'undefined')
      ? Skills.mul('swapMul') : 1;
    const k = 1 - Math.exp(-16 * sk * dt);
    for (const s of ent.sockets) {
      if (s.angleTarget === undefined) { s.angleTarget = s.angle; continue; }
      const diff = s.angleTarget - s.angle;
      if (Math.abs(diff) < 0.004) s.angle = s.angleTarget;
      else s.angle += diff * k;
    }

    // ROTARY JOINT (Master §Structure): the child subassembly swings toward
    // the aim, up to ±90° off its mount, at 180°/s. The swing is a separate
    // number ADDED to the ring angle, so TURN, ring re-spacing and the swing
    // never fight over who owns s.angle.
    const hasAim = ent.aimX !== undefined || ent.aimY !== undefined;

    // THE PERMANENT RING TURNS WITH THE AIM STICK (BREAKLANDS_ANSWERS round
    // 2, 22 Sept 2026; HANDOVER question 5). Permanents.applyTo put the
    // gun that cannot be shot off at the top of its own ring, and nothing
    // ever moved that ring: ROTATE re-spaces the ROOTS (_respaceRoots),
    // children follow their parents, and the permanents were the one ring
    // left out -- so the starting gun fired from a mount at twelve o'clock
    // along the aim, a ring-radius wide of whatever was dead ahead. Nobody
    // noticed for the whole project because the Rack's second copy of the
    // gun hid it (Q8); dropping that copy exposed it: 3.7 s to kill a
    // pinned PICKER where a gun turned to face it took 0.8.
    //
    // Aaron: "aim like the rest." Being permanent is about not being able
    // to lose it, not about where it points. So every frame the permanent
    // ring's TARGET is the aim, the slots fanned a little either side of it
    // so two or four permanents do not stack on one mount, and the servo
    // below eases them there the way it eases a ROTATE. The rotary-joint
    // swing is the precedent; this is the same idea for the ring that had
    // no button.
    if (hasAim && (ent.aimX || ent.aimY)) {
      const perms = ent.sockets.filter(s => s.permanent);
      if (perms.length) {
        const aimA = Math.atan2(ent.aimY || 0, ent.aimX || 0);
        const fan = this.PERMANENT_FAN;
        perms.forEach((s, i) => {
          const want = aimA + (i - (perms.length - 1) / 2) * fan;
          // Take the short way round, or a stick swung through six o'clock
          // sends the gun the long way and it fires backwards on the way.
          let d = want - s.angle;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          s.angleTarget = s.angle + d;
        });
      }
    }
    for (const s of ent.sockets) {
      if (s.parentId === undefined) continue;
      const parent = this.getSocket(ent, s.parentId);
      const pt = parent && parent.comp && parent.comp.part;
      if (!pt || !pt.rotarySwing) { s.rotSwing = 0; continue; }
      const base = parent.angle + (s.childOffset || 0);
      let want = 0;
      if (hasAim && (ent.aimX || ent.aimY)) {
        const aimA = Math.atan2(ent.aimY || 0, ent.aimX || 0);
        // shortest signed difference, then clamped to the swing range
        let d = aimA - base;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const lim = pt.rotarySwing * Math.PI / 180;
        want = Math.max(-lim, Math.min(lim, d));
      }
      const rate = (pt.rotaryRate || 180) * Math.PI / 180 * dt;
      const cur = s.rotSwing || 0;
      const step = Math.max(-rate, Math.min(rate, want - cur));
      s.rotSwing = cur + step;
      s.angle = base + s.rotSwing;
      s.angleTarget = s.angle;    // the swing owns this socket this frame
    }
  },

  // -------------------------------------------------------------------------
  // Per-frame behaviour for every attached component.
  // `firing` = whether ranged weapons should shoot (aim stick held).
  // Every drop of weapon Heat goes through here, so the Overcharger's +18%,
  // the Coolant Pump's -6% and the Weapon Lab's per-weapon COOLING cannot be
  // forgotten at one of the four separate places weapons generate Heat.
  // partId is optional: hazard/system heat has no weapon to discount.
  addHeat(ent, amount, partId) {
    if (ent.heat === undefined) return;
    let a = amount * (ent.weaponHeatMul || 1);
    if (partId && ent.isPlayer && typeof WeaponLab !== 'undefined') {
      a *= WeaponLab.heatMul(partId);
    }
    // HEAVY MOUNT / BOMBARDMENT (M12): heavy weapons run cooler.
    if (partId && ent.isPlayer && typeof Mods !== 'undefined') {
      a *= Mods.heatMul(ent, PARTS[partId]);
    }
    // RULE 4: a permanent runs HOT. No power grid regulates it, so it is the
    // thing that cooks the machine, and heat is the only brake it has.
    if (partId && PARTS[partId] && PARTS[partId].permanent &&
        typeof PERM !== 'undefined') {
      a *= PERM.HEAT_MUL;
    }
    // WEAPON CLASS SKILL (§7): "heat generated -1.5% a rank". Applied after
    // the permanent's HEAT_MUL rather than before, so getting good with a
    // class takes the edge off rule 4 without cancelling it — at rank 10 a
    // permanent still runs hot, just 15% less hot.
    if (partId && ent.isPlayer && typeof WeaponSkill !== 'undefined' &&
        WeaponSkill.mul) {
      a *= WeaponSkill.mul(partId, 'heat');
    }
    ent.heat = Math.min(ent.heatCap, ent.heat + a);
  },

  // RULE 4. A permanent is cut out from the moment the machine overheats
  // until it is properly cool, not merely until the overheat lockout clears.
  // One predicate, so the fire gate, the blade gate and the HUD can never
  // disagree about whether your last gun is answering.
  //
  // `peek` asks the same question and writes nothing. D365 needed a THIRD
  // caller — the emergency blaster, deciding whether anything else can fire —
  // and a predicate that sets `_permCut` and arms OVERBURN's mount damage
  // would have made the asking cost the player a connector. One predicate,
  // one answer, and the read-only caller cannot change the game by looking.
  permanentCutOut(ent, c, peek) {
    if (!c || !c.part || !c.part.permanent) return false;
    if (ent.heatCap === undefined) return false;
    if (ent.overheated) {
      if (!peek) ent._permCut = true;
      return this._overburn(ent, peek);
    }
    if (!ent._permCut) return false;
    if (ent.heat <= ent.heatCap * PERM.RESUME_AT) {
      if (!peek) ent._permCut = false;
      return false;
    }
    return this._overburn(ent, peek);
  },

  // THE EMERGENCY GUN'S ONE QUESTION (D365). Aaron's ruling on question 20:
  // "THE BLASTER ONLY FIRES WHEN NOTHING ELSE WORKS. It is the emergency gun
  // — no gun fitted, or every fitted gun destroyed, out of ammo or
  // overheated. The moment a real weapon can fire, the blaster stops."
  //
  // So the blaster does not get its own idea of what "working" means. It asks
  // THIS, and this reads the same four things the fire gate reads, in the same
  // order: is the mount still there, is it on the grid, is the machine
  // overheated or jammed, is a permanent cut out. A destroyed weapon is not a
  // weapon here because a destroyed weapon leaves no `comp` — `destroyComponent`
  // detaches the socket — which is why 'every fitted gun destroyed' needs no clause of
  // its own. There is no ammo in this game, so that clause has nothing to
  // gate — if ammo is ever added, it belongs in this one function.
  //
  // The built-in gun is skipped so it can never answer its own question, even
  // if something ever bolts one into a socket (the PICKER does).
  hasLiveWeapon(ent) {
    if (!ent || !ent.sockets) return false;
    if (ent.overheated) return false;
    if ((ent.jamT || 0) > 0) return false;
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c || !c.part || c.part.category !== 'weapon') continue;
      if (c.part.id === 'emergencyBlaster') continue;
      if (!c.online) continue;
      if (this.permanentCutOut(ent, c, true)) continue;
      return true;
    }
    return false;
  },

  // OVERBURN, the Combat deep pick: "turns overheat from a hard stop into a
  // DECISION." The permanent no longer cuts out — it keeps firing at half
  // rate (in _shotCooldown) and the MOUNT starts taking damage (in
  // _tickOverburn). Rule 4 is not repealed for anyone who has not bought it.
  //
  // Returns false where the cut-out would have returned true, so it changes
  // exactly one answer and every gate that reads this predicate — the fire
  // gate, the blade gate, the HUD — follows without being told.
  _overburn(ent, peek) {
    if (!ent.isPlayer || typeof Skills === 'undefined' ||
        !Skills.has('overburn')) return true;
    if (!peek) ent._overburning = true;
    return false;
  },

  // The cost. "Sustained heat above the line starts damaging the weapon's own
  // mount — it will not break the weapon (nothing can), but the mount takes
  // real damage and needs garage repair." So it wears the CONNECTOR, down to
  // PERM.MOUNT_WEAR_FLOOR and no further. That floor used to be Rule 2's and
  // was borrowed here; Rule 2 is gone (D366) and this one is its own number
  // now, because BLOCK 4.1 still says a permanent is never lost and wearing
  // the mount to nothing would lose it.
  // Nothing here can lose you the gun; it can only leave you limping to a
  // garage, which is the trade the deep pick is asking you to take.
  OVERBURN_MOUNT_DPS: 7,
  _tickOverburn(dt, ent) {
    if (!ent._overburning) return;
    ent._overburning = false;              // re-armed every frame it applies
    if (!ent.sockets) return;
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c || !c.part || !c.part.permanent) continue;
      const floor = c.maxConnectorHp * PERM.MOUNT_WEAR_FLOOR;
      if (c.connectorHp <= floor) continue;
      c.connectorHp = Math.max(floor,
        c.connectorHp - this.OVERBURN_MOUNT_DPS * dt);
    }
  },

  update(dt, ent, targets, firing, owner) {
    this._updateRotation(dt, ent);
    if (ent.jamT > 0) ent.jamT -= dt;
    // The dead-trigger call-out is throttled PER FRAME, not per socket: with
    // two offline weapons each subtracting dt it fired twice as often.
    this._deadTrigger = (this._deadTrigger || 0) - dt;
    this._deadShown = false;
    this._tickPartTimers(dt, ent);
    this._assignAutoTurrets(ent);
    // Warden Prototypes (M17): Lockdown field, Patchwork Node set, Crown
    // gravity — all player-side field effects tick here, with the live
    // target list, so nothing needs its own update entry point.
    if (owner === 'player' && typeof Proto !== 'undefined') {
      Proto.update(dt, ent, targets);
    }
    // HARPOONED (M14): a tethered machine is hauled toward whoever landed
    // the harpoon for the tether's 1.8 seconds. Works on both sides.
    if (ent._tetherT > 0) {
      ent._tetherT -= dt;
      // BOREMAW HARPOON DRAG (§26A): "Dash can break tether." A live dash
      // burst snaps the line — the player's escape tool works on the drag.
      if (ent.isPlayer && ent.dashT > 0) {
        ent._tetherT = 0;
        Effects.comicWord('SNAPPED!', ent.x, ent.y - 140, CONFIG.COLOR.cyan, 54);
      }
      const an = ent._tetherAnchor;
      if (an && an.alive !== false) {
        const d = Math.hypot(an.x - ent.x, an.y - ent.y) || 1;
        const pull = ent._tetherPull || 900;
        ent.vx += (an.x - ent.x) / d * pull * dt;
        ent.vy += (an.y - ent.y) / d * pull * dt;
        if (typeof Effects !== 'undefined' && Math.random() < dt * 8) {
          Effects.bolt(an.x, an.y, ent.x, ent.y, '#ffd23f');
        }
      }
    }
    // Age every component's shot timer; the draw uses it for recoil.
    for (const s of ent.sockets) {
      if (s.comp) s.comp.sinceShot = (s.comp.sinceShot || 0) + dt;
    }
    for (const s of [...ent.sockets]) {   // copy: parts may detach mid-loop
      const c = s.comp;
      if (!c) continue;
      const part = c.part;
      c.spin += dt * 22;
      c.cooldown -= dt;

      // Connector readability (plan §19): sparks once damaged,
      // intense sparks when critical (rip range).
      const frac = c.connectorHp / c.maxConnectorHp;
      if (frac < 1) {
        const critical = frac <= Machine.RIP_THRESHOLD;
        if (Math.random() < dt * (critical ? 14 : 3.5)) {
          const cp = this.connectorPos(ent, s);
          Effects.spark(cp.x, cp.y, s.angle + Math.PI,
            critical ? 2 : 1, critical ? '#ff3b3b' : '#ffd23f', 320);
        }
      }

      // ---- non-weapon systems ----
      if (part.category !== 'weapon') {
        c.cooldown = Math.max(c.cooldown, 0);
        if (part.shieldValue) this._updateShield(dt, ent, s, c);
        if (part.barrierValue) this._updateBarrier(dt, ent, s, c);
        if (part.repairRate && c.online) this._updateRepair(dt, ent, c);
        if (part.pdRange) this._updatePointDefence(dt, ent, s, c, owner);
        if (part.drones) this._updateDrones(dt, ent, s, c, targets, owner);
        continue;
      }

      // ---- weapons ----
      // MELEE family (Saw, and the M14 Drill): grinds outward, no trigger.
      if (part.dps !== undefined && !part.beam && part.bladeRadius) {
        c.cooldown = Math.max(c.cooldown, 0);
        if (c.online && !ent.overheated && !(ent.jamT > 0) &&
            !this.permanentCutOut(ent, c)) c.bladeSpin += dt * 34;
        this._updateSaw(dt, ent, s, c, targets);
        continue;
      }

      // WAVE family (M14 Shockwave Cannon): no projectile — a ring from the
      // machine itself, on the ordinary trigger and cooldown.
      if (part.wave) {
        if (!c.online || ent.overheated || (ent.jamT || 0) > 0 ||
            c._autoClaimed || !firing) {
          c.cooldown = Math.max(c.cooldown, 0);
          continue;
        }
        while (c.cooldown <= 0) {
          c.sinceShot = 0;
          this._fireWave(ent, s, c, targets, owner);
          c.cooldown += this._shotCooldown(ent, c);
        }
        continue;
      }

      // BURST family (M14 Burst Rifle): a started burst always finishes,
      // trigger held or not — the trigger buys BURSTS, not rounds.
      if (part.burst && c._burstLeft > 0) {
        c._burstT -= dt;
        while (c._burstLeft > 0 && c._burstT <= 0) {
          c.sinceShot = 0;
          c._burstIdx++;
          this._fireShot(ent, s, c, owner, undefined, targets);
          c._burstLeft--;
          c._burstT += part.burstGap;
        }
      }

      if (part.beam) {
        c.cooldown = Math.max(c.cooldown, 0);
        this._updateBeam(dt, ent, s, c, targets, firing, owner);
        continue;
      }

      // A weapon claimed by an Auto-Turret Controller stops answering the
      // player's trigger entirely and is run by the controller instead.
      if (c._autoClaimed) {
        this._updateAutoTurret(dt, ent, s, c, targets, owner);
        continue;
      }

      // OFFLINE or overheated weapons cannot fire (plan §24–25).
      // BLOCK 4.3: a jammed machine is silenced the same way, because the
      // ARC GUN DRAIN's whole character is 'shuts things down' and the game
      // already has a concept for 'your guns do not answer'. Reusing it
      // means the callout, the blade stop and the turret stop all follow.
      //
      // RULE 4: and a permanent stays dead LONGER. The machine's own overheat
      // vents at 42/sec down to 45 and clears in well under a second on a
      // bare frame — a stutter, not a stop. A permanent does not come back
      // until the machine is properly cool, which is what turns a
      // permanent-only walk home into fight, stop, cool, fight.
      if (!c.online || ent.overheated || (ent.jamT || 0) > 0 ||
          this.permanentCutOut(ent, c)) {
        c.cooldown = Math.max(c.cooldown, 0);
        if (firing && ent.isPlayer && !this._deadShown) {
          if (this._deadTrigger <= 0) {
            this._deadTrigger = 1.2;
            this._deadShown = true;
            const sp = this.socketPos(ent, s);
            Effects.comicWord(ent.overheated ? 'OVERHEATED!' : 'NO POWER!',
              sp.x, sp.y - 70,
              ent.overheated ? CONFIG.COLOR.orange : CONFIG.COLOR.red, 92);
          }
        }
        continue;
      }

      // Ranged turret: fires toward the entity's aim direction.
      if (!firing) {
        c.cooldown = Math.max(c.cooldown, 0);  // keep sub-frame remainder
        // FEED RAMP resets when the trigger is released — the Master's own
        // wording. Letting it survive a release made it a permanent buff.
        c._feedRamp = 0; c._feedTarget = null;
        continue;                              // only while actively firing
      }
      while (c.cooldown <= 0) {
        c.sinceShot = 0;                 // drives the recoil kick in the draw
        if (part.burst) {
          // Round one now; the burst machinery above delivers the rest.
          // THE LENGTH is decided here, once per burst: the part's, plus
          // the spine's first step on the player's own permanent (D352).
          c._burstN = part.burst +
            ((typeof Spine !== 'undefined' && Spine.add) ? Spine.add(ent, part.id, 'burst') : 0);
          c._burstId = (c._burstId || 0) + 1;
          c._burstIdx = 1;
          this._fireShot(ent, s, c, owner, undefined, targets);
          c._burstLeft = c._burstN - 1;
          c._burstT = part.burstGap;
        } else {
          this._fireShot(ent, s, c, owner, undefined, targets);
        }
        c.cooldown += this._shotCooldown(ent, c);
      }
    }
    // LAST, because the flag it consumes is set by permanentCutOut inside the
    // loop above. Anything earlier would always be reading last frame's answer.
    this._tickOverburn(dt, ent);
    // THE SPINE'S VENT BURST (plasmaRepeater step 3): overheating vents a
    // plasma burst around you. On the EDGE of overheating -- once per
    // overheat, not once per frame of it -- and only while a finished
    // plasma repeater is fitted.
    if (ent.isPlayer && typeof Spine !== 'undefined') {
      if (ent.overheated && !ent._vented) {
        ent._vented = true;
        for (const s of ent.sockets) {
          const cc = s.comp;
          if (!cc || !cc.part.splash || !Spine.live(ent, cc.part.id, 'ventBurst')) continue;
          const dmg = cc.part.damage * 3 * this.outputMul(ent, cc);
          this._waveHit(ent, targets, 300, dmg, 500, cc.part.id);
          Effects.ring(ent.x, ent.y, 300, cc.part.color);
          Effects.comicWord('VENT!', ent.x, ent.y - 200, cc.part.color, 60);
          break;
        }
      }
      if (!ent.overheated) ent._vented = false;
    }
  },

  // Shockwave Cannon (M14, Master §21): 24 damage and HIGH knockback to
  // everything opposing within 360 of the machine. AFTERSHOCK (Mastery 10)
  // schedules a second ring at half strength 0.35s later.
  _fireWave(ent, s, c, targets, owner) {
    const part = c.part;
    const dmg = part.damage * this.outputMul(ent, c);
    this._waveHit(ent, targets, part.waveRange, dmg, part.waveKnock, part.id);
    this.addHeat(ent, part.heatPerShot, part.id);
    if (typeof Effects !== 'undefined') {
      Effects.ring(ent.x, ent.y, part.waveRange, part.color);
      Effects.ring(ent.x, ent.y, part.waveRange * 0.55, '#ffffff');
      Effects.comicWord('WHOOM!', ent.x, ent.y - 160, part.color, 64);
    }
    if (typeof Camera !== 'undefined' && ent.isPlayer) Camera.shake(7, 0.2);
    if (typeof Audio_ !== 'undefined' && ent.isPlayer) Audio_.play('cannon');
    // THE SPINE'S `pullsLoose`. Four classes end up here — the shockwave
    // cannon, the mine layer, the disc launcher and the harpoon all say some
    // version of "drags loose parts toward you" — so it is ONE function and
    // one flag, because four slightly different versions of one behaviour is
    // how four bugs get built by accident.
    this.pullLoose(ent, part.waveRange, part.id);
    // THE SPINE'S WAVE POPS (shockwaveCannon step 3): the wave destroys
    // enemy projectiles it passes through.
    if (typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'wavePops') &&
        typeof Projectiles !== 'undefined') {
      let popped = 0;
      for (const q of Projectiles.pool) {
        if (!q.active || q.owner === 'player') continue;
        if (Math.hypot(q.x - ent.x, q.y - ent.y) > part.waveRange + q.r) continue;
        q.active = false;
        popped++;
        Effects.spark(q.x, q.y, 0, 2, '#ffffff', 240);
      }
      if (popped) Effects.comicWord('POP!', ent.x, ent.y - 230, '#ffffff', 44);
    }
    const E = this._expertise(ent, c);
    if (E && E.name === 'AFTERSHOCK' && typeof Projectiles !== 'undefined') {
      Projectiles.scheduleWave(0.35, ent, part.waveRange * 0.9, dmg * 0.5,
        part.waveKnock * 0.5, part.id, targets);
    }
  },

  // SALVAGE COMES TO YOU. The spine step four classes share: what the weapon
  // hits, it also sweeps toward you — which turns a crowd-clearing shot into
  // a looting one and is the reason a finished shockwave cannon changes how
  // you fight rather than how hard you hit.
  //
  // Velocity, not teleportation: LooseParts.update already decays it, so the
  // parts drift in and settle exactly the way a magnet-flung part does.
  pullLoose(ent, range, srcId) {
    if (!ent || !ent.isPlayer || typeof LooseParts === 'undefined') return 0;
    if (typeof Spine === 'undefined' || !srcId) return 0;
    if (!PARTS[srcId] || !PARTS[srcId].permanent) return 0;
    if (!Spine.has(srcId, 'pullsLoose')) return 0;
    let n = 0;
    for (const it of LooseParts.items) {
      const d = Math.hypot(it.x - ent.x, it.y - ent.y);
      if (d > range || d < 1) continue;
      it.vx += (ent.x - it.x) / d * this.PULL_SPEED;
      it.vy += (ent.y - it.y) / d * this.PULL_SPEED;
      n++;
    }
    return n;
  },
  PULL_SPEED: 900,

  _waveHit(ent, targets, range, dmg, knock, srcId) {
    // BLOCK 14. A machine that has lost every shockwave cannon cannot throw
    // you any more — the damage stays, the SHOVE stops, which is the whole
    // difference between an arena you are being kept out of and one you are
    // being hurt in. Read here because this is the one place knockback is
    // applied, so the phase and the feel cannot disagree.
    if (ent && ent.noKnockback) knock = 0;
    for (const t of targets) {
      if (!t || !t.alive) continue;
      const d = Math.hypot(t.x - ent.x, t.y - ent.y);
      if (d > range + (t.radius || 0)) continue;
      const a = Math.atan2(t.y - ent.y, t.x - ent.x);
      if (t.sockets) {
        const hit = this.resolveHit(t, t.x, t.y, t.radius) || { kind: 'core' };
        this.applyDamage(t, hit, dmg, t.x, t.y, false, srcId);
      } else if (t.hit) {
        t.hit(dmg, t.x, t.y);
      }
      // High knockback is the weapon's identity (§21).
      const kb = knock * (t.knockbackMul !== undefined ? t.knockbackMul
        : (t.recoilMul !== undefined ? t.recoilMul : 1));
      if (t.vx !== undefined) {
        t.vx += Math.cos(a) * kb;
        t.vy += Math.sin(a) * kb;
      }
    }
  },

  // Seconds until this component may fire again — the ONE place perk timing
  // lands, so the hand trigger and the Auto-Turret can never disagree on it.
  _shotCooldown(ent, c, rateScale = 1) {
    let rate = this._rate(ent, c.part.fireRate * rateScale);
    let mul = 1;
    // RELOAD and the cooldown skills, at the ONE place perk timing lands - so
    // the hand trigger and the Auto-Turret can never disagree about them
    // either, which is what this function's own comment already promises.
    if (ent && ent.isPlayer && typeof Skills !== 'undefined') {
      mul *= Skills.mul('reloadMul') * Skills.mul('cooldownMul');
    }
    const H = this._handling(ent, c);
    if (H && H.cooldown) mul *= H.cooldown;          // Railgun Mastery 5
    const E = this._expertise(ent, c);
    if (E && E.rampPerHit !== undefined && E.breakAfter === undefined) {
      rate *= 1 + (c._feedRamp || 0);                // FEED RAMP
    }
    // M12: REDLINE (+20% all), BOMBARDMENT (+10% heavy), RETURN FIRE.
    if (ent.isPlayer && typeof Mods !== 'undefined') {
      rate *= Mods.rateMul(ent, c.part);
    }
    let cd = mul / rate;
    // Weapon Lab CYCLE — per-weapon time between shots.
    if (ent.isPlayer && typeof WeaponLab !== 'undefined') {
      cd *= WeaponLab.cooldownMul(c.part.id);
    }
    if (E && E.cdMul && c._recyclerReady) {          // RECYCLER: one deploy
      cd *= E.cdMul;
      c._recyclerReady = false;
    }
    // THE SPINE's rate steps. Divided for the same reason OVERBURN is: the
    // data says a RATE and this function returns a GAP.
    if (ent && ent.isPlayer && c.part.permanent && typeof Spine !== 'undefined') {
      cd /= Spine.mul(c.part.id, 'fireRate');
    }
    // AND THE CLASS SKILL's rate, divided for the same reason: the document
    // says "+2% reload speed a rank" and this function returns a GAP.
    if (ent && ent.isPlayer && typeof WeaponSkill !== 'undefined' &&
        WeaponSkill.mul) {
      cd /= WeaponSkill.mul(c.part.id, 'fireRate');
    }
    // OVERBURN's half rate. Divided rather than multiplied because the skill
    // states a RATE (0.5) and this function returns a GAP — writing 2.0 here
    // instead would make the tree's own number unfindable in the code.
    if (ent && ent.isPlayer && c.part.permanent && ent._permCut &&
        typeof Skills !== 'undefined' && Skills.has('overburn')) {
      cd /= Skills.mul('overRateMul');
    }
    return cd;
  },

  // The one place a weapon's shots-per-second is assembled.
  // FIRE CONTROL reads the Forge directly rather than through a field,
  // because fireRateBonus persists between recalcs — a *= there compounds.
  _rate(ent, base) {
    const forge = (ent.isPlayer && typeof Forge !== 'undefined' && Forge.rateMul)
      ? Forge.rateMul() : 1;
    return base * (ent.fireRateMul || 1) * (ent.fireRateBonus || 1)
                * (ent.weaponRateMul || 1) * forge;
  },

  // ---- WEAPON MASTERY PERKS (M10, Master §17) ----------------------------
  // Level-5 handling and Level-10 Expertise, player machines only. Both
  // lookups return null for enemies, for Pure modes, and below the level
  // gate — Mastery itself owns those decisions, this is just the reach-in.
  // §22: a Prototype that "uses X Mastery" reads AND feeds that track.
  masteryKey(part) { return part.masteryAs || part.id; },

  // PLAYTEST 2, ITEM 3. WHICH SPRITE A PART DRAWS WITH.
  //
  // Aaron saw the new weapons drawing as canvas primitives and the first
  // reading was `45 guns need modelling`. It was not: a VARIANT is supposed
  // to reuse its base class's sprite, and this lookup keyed on part.id — so
  // `mg_hornet` asked for `part_mg_hornet`, which does not exist and never
  // will, and fell through to primitives even though `part_machineGun` was
  // sitting right there.
  //
  // One mapping, in one place, and all 54 variants inherit their class's
  // model. Distinct per-variant art can come later as polish; it was never
  // a blocker.
  //
  // Falls back to the variant's own key FIRST, so the day someone does model
  // a HORNET specifically, dropping `part_mg_hornet` into the manifest is
  // the whole of the work.
  artKey(part) {
    if (!part) return 'part_unknown';
    const own = 'part_' + part.id;
    if (typeof Assets !== 'undefined' && Assets.has(own)) return own;
    return 'part_' + (part.variantOf || part.id);
  },

  _handling(ent, c) {
    if (!ent.isPlayer || typeof Mastery === 'undefined') return null;
    return Mastery.handling(this.masteryKey(c.part));
  },

  _expertise(ent, c) {
    if (!ent.isPlayer || typeof Mastery === 'undefined') return null;
    return Mastery.expertise(this.masteryKey(c.part));
  },

  // A player projectile connected with a machine. FEED RAMP and WHITE HOT
  // are the two Expertises that care; both are "sustained" mechanics, so
  // both live or die by the same-target and time-window checks here.
  noteWeaponHit(comp, target) {
    if (typeof Mastery === 'undefined') return;
    const key = this.masteryKey(comp.part);
    const ex = Mastery.EXPERTISE[key];
    if (!ex || Mastery.levelOf(key) < Mastery.MAX_LEVEL) return;
    const now = performance.now() / 1000;
    if (ex.rampPerHit === undefined) return;
    if (ex.breakAfter !== undefined) {          // WHITE HOT: window, any target
      if (now - (comp._hotLast || -999) > ex.breakAfter) comp._hotRamp = 0;
      comp._hotRamp = Math.min(ex.rampCap, (comp._hotRamp || 0) + ex.rampPerHit);
      comp._hotLast = now;
    } else {                                    // FEED RAMP: same machine only
      if (comp._feedTarget !== target) { comp._feedRamp = 0; comp._feedTarget = target; }
      comp._feedRamp = Math.min(ex.rampCap, (comp._feedRamp || 0) + ex.rampPerHit);
    }
  },

  // ---- per-part timers ---------------------------------------------------
  // Reactive Armour recharge, Reflector Plate lockout, Emergency Vent
  // cooldown, and the Capacitor's post-overheat blackout all tick here so
  // there is exactly one place they can be forgotten.
  _tickPartTimers(dt, ent) {
    let repower = false;
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c) continue;
      if (c._reactiveT > 0) c._reactiveT = Math.max(0, c._reactiveT - dt);
      if (c._reflectCd > 0) c._reflectCd = Math.max(0, c._reflectCd - dt);
      if (c._ventCd > 0) c._ventCd = Math.max(0, c._ventCd - dt);
      if (c._ripLineT > 0) c._ripLineT = Math.max(0, c._ripLineT - dt);
      if (c._forcedOffT > 0) {
        c._forcedOffT -= dt;
        if (c._forcedOffT <= 0) { c._forcedOffT = 0; repower = true; }
      }
    }
    if (repower) this.recalcPower(ent);
  },

  // ---- OVERHEAT HOOK -----------------------------------------------------
  // Called by the Core the instant it locks out. Two parts care: the
  // Emergency Vent dumps Heat, the Capacitor falls off the grid.
  onOverheat(ent) {
    if (!ent.sockets) return;
    let repower = false;
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c) continue;
      const part = c.part;
      if (part.ventHeat && c.online && !(c._ventCd > 0)) {
        c._ventCd = part.ventCd;
        if (ent.heat !== undefined) ent.heat = Math.max(0, ent.heat - part.ventHeat);
        const p = this.socketPos(ent, s);
        if (typeof Effects !== 'undefined') {
          Effects.comicWord('VENT!', p.x, p.y - 70);
          Effects.ring(p.x, p.y, 110, part.color);
        }
      }
      if (part.offlineOnOverheat) {
        c._forcedOffT = part.offlineOnOverheat;
        repower = true;
      }
    }
    if (repower) this.recalcPower(ent);
  },

  // aimOverride lets the Auto-Turret Controller point ONE weapon somewhere
  // other than where the machine is aiming. `targets` is only needed by the
  // PACK HUNTER Expertise, which hands each rocket its own lock at launch.
  _fireShot(ent, s, c, owner, aimOverride, targets) {
    const part = c.part;
    const aimA = aimOverride !== undefined
      ? aimOverride : Math.atan2(ent.aimY, ent.aimX);
    const H = this._handling(ent, c);       // Mastery 5 handling, or null
    const E = this._expertise(ent, c);      // Mastery 10 Expertise, or null

    // Mine Layer (plan §33): drops proximity mines BEHIND the machine.
    if (part.mine) {
      const back = aimA + Math.PI;
      const mx = ent.x + Math.cos(back) * (ent.radius + 100);
      const my = ent.y + Math.sin(back) * (ent.radius + 100);
      // Mastery 5 arms them faster; RECYCLER needs to know who laid it.
      // THE SPINE'S INSTANT ARM (mineLayer step 2): a mine that is live
      // the moment it touches the ground.
      const armMul = (typeof Spine !== 'undefined' &&
        Spine.live(ent, part.id, 'instantArm')) ? 0 : ((H && H.arm) || 1);
      Mines.spawn(mx, my, part, owner, armMul, ent.isPlayer ? c : null);
      Effects.spark(mx, my, back, 3, part.color, 240);
      this.addHeat(ent, part.heatPerShot, part.id);
      return;
    }

    // Spread: the base number, the machine's own modifiers, then Mastery —
    // the Level-5 handling for the spread weapons and TIGHT CHOKE on top.
    let spreadBase = part.spread;
    if (H && H.spread) spreadBase *= H.spread;
    if (E && E.spread) spreadBase *= E.spread;
    // Weapon Lab ACCURACY — per-weapon, on top of Mastery like everything.
    if (ent.isPlayer && typeof WeaponLab !== 'undefined') {
      spreadBase *= WeaponLab.spreadMul(part.id);
    }
    // WEAPON CLASS SKILL (§7): "accuracy (spread) -2% a rank". Per PART, here,
    // rather than through `ent.spreadMul` — that one is the machine's, and the
    // skill belongs to the class of gun in this socket. A machine-wide version
    // would make being good with machine guns tighten your cannon.
    if (ent.isPlayer && typeof WeaponSkill !== 'undefined' && WeaponSkill.mul) {
      spreadBase *= WeaponSkill.mul(part.id, 'spread');
    }
    let spread = spreadBase * (ent.spreadMul || 1) + (ent.extraSpread || 0);
    // THE SPINE'S STEADY SPREAD (machineGun step 2): spread halves while
    // stationary. Stationary is under 60 u/s -- a machine easing to a stop,
    // not one that has to be pinned to a pixel.
    if (typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'steadySpread') &&
        Math.hypot(ent.vx || 0, ent.vy || 0) < 60) {
      spread *= 0.5;
    }
    const p = this.socketPos(ent, s);
    const mx = p.x + Math.cos(aimA) * part.barrel;
    const my = p.y + Math.sin(aimA) * part.barrel;

    let dmgMul = this.outputMul(ent, c);
    // THE SPINE'S TRACER (machineGun step 3): every tenth round does double
    // HULL damage. Counted on the component rather than on a timer, because
    // "every tenth round" is a promise about rounds, and a machine that stops
    // firing and starts again should not lose its count.
    //
    // HULL. Not connectors — rule 2, and the reason this is applied to the
    // damage multiplier and never to a joint path.
    if (ent.isPlayer && part.permanent && typeof Spine !== 'undefined' &&
        Spine.has(part.id, 'tracer')) {
      c._round = (c._round || 0) + 1;
      if (c._round % 10 === 0) { dmgMul *= 2; c._tracer = 0.2; }
    }
    // THE SPINE'S LAST ROUND (burstRifle step 2): the last round of a burst
    // does x2 HULL damage. `_burstIdx` counts from 1 and `part.burst` is
    // the length, so the last one is the one that equals it.
    if (part.burst && typeof Spine !== 'undefined' &&
        Spine.live(ent, part.id, 'lastRoundDouble') && c._burstIdx === (c._burstN || part.burst)) {
      dmgMul *= 2;
    }
    // WHITE HOT: sustained flame contact ramps the burn. The ramp is
    // checked against its break window HERE too, so stopping the spray
    // really does cool it off rather than freezing it at its last value.
    if (E && E.breakAfter !== undefined) {
      const now = performance.now() / 1000;
      if (now - (c._hotLast || -999) > E.breakAfter) c._hotRamp = 0;
      dmgMul *= 1 + (c._hotRamp || 0);
    }
    // PACK HUNTER: with one target the salvo hits harder; with several,
    // each rocket takes an unclaimed lock before any target gets doubles.
    let packTargets = null;
    if (E && E.soloDmg && targets) {
      packTargets = targets.filter(t => t && t.alive && t.sockets &&
        Math.hypot(t.x - mx, t.y - my) < 950);
      if (packTargets.length === 1) dmgMul *= E.soloDmg;
    }

    // The part's pellets, plus the SCATTERGUN spine's +2 on the player's
    // own permanent (D352).
    const pellets = (part.pellets || 1) +
      ((typeof Spine !== 'undefined' && Spine.add) ? Spine.add(ent, part.id, 'pellets') : 0);
    for (let i = 0; i < pellets; i++) {
      // TIGHT CHOKE: pellet 0 becomes the CENTRE pellet — dead straight,
      // and half again harder on connectors. The rest fan as normal.
      const centre = E && E.centreConnMul && i === 0;
      const angle = centre ? aimA
        : aimA + (Math.random() - 0.5) * 2 * spread;
      const shot = Projectiles.spawn(mx, my, angle, part, owner, dmgMul);
      if (shot) {
        if (ent.isPlayer) shot.compRef = c;   // FEED RAMP / WHITE HOT feedback
        if (centre) shot.connMul = E.centreConnMul;
        // Connector damage rides the shot; GYRO CODE MKII's projectile
        // speed is applied inside Projectiles.spawn, where the velocity is
        // actually built (setting a `speed` field here changed nothing).
        if (ent.isPlayer) {
          shot.connMul = (shot.connMul || 1) * (ent.connectorDamageMul || 1);
        }
        // BLOCK 4.3: a part may bite harder on JOINTS than on hulls. The
        // melee path already honoured `part.connMul`; ranged did not, so a
        // shredder variant was a normal gun.
        if (part.connMul) shot.connMul = (shot.connMul || 1) * part.connMul;
        // RULE 2: and a PERMANENT is capped, hard. ASSIGNED, not multiplied,
        // so it lands after every perk above and nothing can stack past it.
        // A permanent must never be the thing that farms you parts.
        if (part.permanent) shot.connMul = PERM.CONN_MUL;
        if (H && H.homing) shot.homing *= H.homing;      // Rocket Pod lock
        if (H && H.life) shot.life *= H.life;            // flame reach
        if (H && H.chainRange) shot.chainRange *= H.chainRange;  // Arc M5
        if (H && H.projSpeed) {                          // M14 speed perks
          shot.spd *= H.projSpeed;
          shot.vx *= H.projSpeed; shot.vy *= H.projSpeed;
        }
        if (E && E.extraChain) shot.chain += E.extraChain;   // CHAIN REACTION
        // ---- M14 flight behaviours ---------------------------------------
        if (part.burst) {           // PERFECT BURST bookkeeping
          shot._burstId = c._burstId;
          shot._burstIdx = c._burstIdx;
          // The payoff itself is GATED here at spawn — the round carries
          // whether the Expertise was live when it left the barrel.
          shot._pbArmed = !!(E && E.name === 'PERFECT BURST');
        }
        if (part.flak) {
          shot.flak = true;
          // FLAK CANNON step 1: +2 fragments (D352).
          shot.fragments = part.fragments +
            ((typeof Spine !== 'undefined' && Spine.add) ? Spine.add(ent, part.id, 'fragments') : 0);
          shot.fragDamage = part.fragDamage * dmgMul;
          shot.proxRadius = part.proxRadius;
          if (E && E.name === 'SHRED CLOUD') shot.shred = true;
          // THE SPINE, flakCannon steps 2 and 3: fragments ricochet once,
          // and the shell bursts on its own at the ideal range rather than
          // waiting to touch something. Both ride the shell and are read
          // in Projectiles.update.
          if (typeof Spine !== 'undefined') {
            if (Spine.live(ent, part.id, 'ricochet')) shot.fragRicochet = 1;
            if (Spine.live(ent, part.id, 'autoDetonate')) shot.autoDetonate = true;
          }
        }
        // THE SPINE'S CLUSTER SHELL (cannon step 3): a direct hit also
        // bursts into three fragments. Written as a flak shell with the
        // cannon's own damage on it, so the burst is the one the game
        // already knows how to draw and land.
        if (!part.flak && typeof Spine !== 'undefined' &&
            Spine.live(ent, part.id, 'cluster')) {
          shot.cluster = 3;
          shot.fragDamage = part.damage * 0.35 * dmgMul;
        }
        // THE SPINE'S PIERCE (railgun step 2): two more machines per shot.
        if (typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'pierce')) {
          shot.pierce = (shot.pierce || 1) + 2;
        }
        // RAILGUN step 3. The prose is "pierces one wall or obstacle" and
        // the flag in SPINE_FX is named `chargeHold`; the prose is what the
        // player was told, so that is what is built, under the flag's name.
        if (typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'chargeHold')) {
          shot.wallPierce = 1;
        }
        // ROCKET POD steps 2 and 3: a rocket that runs out of life without
        // hitting loiters and re-acquires once; a full volley on one machine
        // adds a bonus detonation. The volley is the cooldown-batch of
        // rockets, counted per component.
        if (part.homing && typeof Spine !== 'undefined') {
          if (Spine.live(ent, part.id, 'reacquire')) shot.reacquire = 1;
          if (Spine.live(ent, part.id, 'volleyBonus')) {
            c._volleyN = (c._volleyN || 0) + 1;
            if (!c._volleyId || (c._volleyN % 4) === 1) c._volleyId = (c._volleyId || 0) + 1;
            shot.volleyId = c._volleyId;
            shot.volleyBonus = true;
            shot.compRef = c;
          }
        }
        // ARC GUN step 3: a chain returning to a machine already hit does
        // double. Read in Projectiles._impact where the chain is walked.
        if (part.chain && typeof Spine !== 'undefined' &&
            Spine.live(ent, part.id, 'chainReturn')) shot.chainReturn = true;
        // CHAINS TO ALLIES (the GALVANIC): its arc may jump to its own side.
        if (part.chain && ent.traits && ent.traits.chainsToAllies) shot.chainAllies = true;
        // ARC GUN step 1: +1 chain (D352). Projectiles.spawn copied the
        // part's own count; the spine's add lands on the shot after it.
        if (part.chain && typeof Spine !== 'undefined' && Spine.add) {
          shot.chain = (shot.chain || 0) + Spine.add(ent, part.id, 'chains');
        }
        // BURST RIFLE step 3: a full burst on one target refunds a quarter of
        // its heat. The round carries the size of its burst so the impact
        // can tell when the last one landed on the same machine.
        if (part.burst && typeof Spine !== 'undefined' &&
            Spine.live(ent, part.id, 'burstHeatRefund')) {
          shot.burstRefund = c._burstN || part.burst;
          shot.burstHeat = part.heatPerShot * (c._burstN || part.burst) * 0.25;
          shot.compRef = c;
        }
        // FLAMETHROWER steps 2 and 3, PLASMA step 2: what the round leaves
        // behind. Read where the round dies.
        if (typeof Spine !== 'undefined') {
          if (part.flame && Spine.live(ent, part.id, 'lingering')) shot.lingering = 1.2;
          if (part.flame && Spine.live(ent, part.id, 'fuelBurn')) shot.fuelBurn = true;
          if (part.splash && Spine.live(ent, part.id, 'scorch')) shot.scorch = true;
          if (part.tether && Spine.live(ent, part.id, 'tetherMark')) shot.tetherMark = true;
          if (part.ricochet && Spine.live(ent, part.id, 'bounceRamp')) shot.bounceRamp = 1.15;
        }
        if (part.arc) {
          // Targeted arc: land on the nearest opposing machine near the aim
          // line, else at full range along the aim. Flies OVER everything.
          // MORTAR step 1: +150 range (D352).
          const range = part.arcRange +
            ((typeof Spine !== 'undefined' && Spine.add) ? Spine.add(ent, part.id, 'range') : 0);
          let tx = mx + Math.cos(aimA) * range;
          let ty = my + Math.sin(aimA) * range;
          if (targets) {
            let bestT = null, bestD = 1e9;
            for (const t of targets) {
              if (!t || !t.alive || !t.sockets) continue;
              const d = Math.hypot(t.x - ent.x, t.y - ent.y);
              if (d > range) continue;
              let dA = Math.atan2(t.y - ent.y, t.x - ent.x) - aimA;
              while (dA > Math.PI) dA -= Math.PI * 2;
              while (dA < -Math.PI) dA += Math.PI * 2;
              if (Math.abs(dA) > 0.35) continue;   // ~20 degrees of the aim
              if (d < bestD) { bestD = d; bestT = t; }
            }
            if (bestT) { tx = bestT.x; ty = bestT.y; }
          }
          let arcT = part.arcTime;
          if (H && H.life) arcT *= H.life;     // Mortar Mastery 5: -8% travel
          shot.arcTo = { x: tx, y: ty };
          shot.arcT = arcT;
          shot.arcTotal = arcT;
          if (E && E.name === 'SECOND IMPACT') shot.secondImpact = true;
          if (typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'impactMarker')) {
            shot.impactMarker = true;
          }
        }
        if (part.tether) {
          shot.tether = part.tether;
          shot.tetherPull = part.tetherPull *
            (H && H.tether ? H.tether : 1);    // Harpoon Mastery 5: +10%
          shot.tetherEnt = ent;
          if (E && E.name === 'RIP LINE') shot.ripLine = true;
        }
        if (part.ricochet) {
          shot.ricochet = part.ricochet +
            ((E && E.name === 'RICOCHET+') ? 1 : 0);
        }
        // OVERCHARGE CYCLE (Plasma Mastery 10): every eighth shot goes big.
        if (E && E.name === 'OVERCHARGE CYCLE') {
          c._plasmaN = (c._plasmaN || 0) + 1;
          if (c._plasmaN % 8 === 0) {
            shot.r *= 1.8;
            shot.damage *= 1.3;                 // (tune)
            shot.splash = 140;
            shot.splashDamage = (part.splashDamage || 4) * 2 * dmgMul;
            if (typeof Effects !== 'undefined') {
              Effects.ring(mx, my, 60, part.color);
            }
          }
        }
        if (packTargets && packTargets.length > 1) {
          // First unclaimed target by distance; only duplicate when every
          // valid target already has a live rocket on it.
          const claimed = [];
          for (const q of Projectiles.pool) {
            if (q.active && q !== shot && q.owner === owner && q.prefer) {
              claimed.push(q.prefer);
            }
          }
          const byDist = packTargets.slice().sort((a, b) =>
            Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my));
          shot.prefer = byDist.find(t => !claimed.includes(t)) || byDist[0];
        }
      }
      if (typeof Audio_ !== 'undefined' && ent.isPlayer) {
        Audio_.play(Audio_.WEAPON_SFX[part.id] || 'machineGun');
      }
    }
    // DOUBLE TAP: every fifth shell chambers a 60% bonus shell instantly.
    // The counter runs on every fired shell so reaching Level 10 mid-fight
    // does not need a warm-up; only the bonus itself is gated.
    c._tapCount = (c._tapCount || 0) + 1;
    if (E && E.every && c._tapCount % E.every === 0) {
      const bonus = Projectiles.spawn(mx, my, aimA, part, owner,
        dmgMul * E.bonusDmg);
      if (bonus && ent.isPlayer) bonus.compRef = c;
      Effects.muzzleFlash(mx, my, aimA, true);
      if (typeof Effects !== 'undefined') {
        Effects.comicWord('DOUBLE TAP!', mx, my - 60, part.color, 56);
      }
    }
    Effects.muzzleFlash(mx, my, aimA,
      part.id === 'cannon' || part.id === 'railgun' || part.id === 'scattergun');

    // Heat generation (plan §25) — entities with a Heat stat only.
    if (ent.heat !== undefined) {
      const hm = (ent.isPlayer && typeof Mastery !== 'undefined')
        ? Mastery.heatMul(part.id) : 1;
      this.addHeat(ent, part.heatPerShot * hm, part.id);
    }

    // Recoil (plan §28) — Heavy Treads soak it via recoilMul, the Cannon's
    // Mastery 5 takes 15% off at the source, and M12 layers Heavy-weapon
    // reductions on top. The Viper's identity: a slice of the kick becomes
    // FORWARD motion instead (Engine Tune ranks x REDLINE).
    // STEADY MOUNT reads here for the same reason Heavy Treads does: this is
    // where the shove is actually applied, so the garage's NET RECOIL readout
    // and what the machine does cannot disagree. Player only — a skill is the
    // player's, and ent.recoilMul above is the part's.
    let kick = part.recoil * ((H && H.recoil) || 1)
               * (ent.recoilMul || 1) * (ent.braceMul || 1);
    if (ent.isPlayer && typeof Skills !== 'undefined') {
      kick *= Skills.mul('recoilMul');
    }
    let conv = 0;
    if (ent.isPlayer && typeof Mods !== 'undefined') {
      kick *= Mods.kickMul(ent, part);
      conv = Mods.recoilConvert(ent);
      Mods.noteKick(ent, kick);          // Backblast window opens on big kicks
    }
    ent.vx -= Math.cos(aimA) * kick * (1 - conv);
    ent.vy -= Math.sin(aimA) * kick * (1 - conv);
    if (conv > 0) {
      ent.vx += Math.cos(aimA) * kick * conv;
      ent.vy += Math.sin(aimA) * kick * conv;
    }
  },

  _updateSaw(dt, ent, s, c, targets) {
    // Mounted saws grind OUTWARD from their socket, always active (melee
    // needs no trigger — the machine simply becomes dangerous to touch).
    const part = c.part;
    const p = this.socketPos(ent, s);
    const bx = p.x + Math.cos(s.angle) * part.reach;
    const by = p.y + Math.sin(s.angle) * part.reach;
    c.bladeX = bx; c.bladeY = by;

    if (!c.online || ent.overheated || (ent.jamT || 0) > 0 ||
        this.permanentCutOut(ent, c)) return;   // dead blades don't cut

    let anyHit = false;
    for (const t of targets) {
      if (!t.alive) continue;
      const hx = bx + (Math.random() - 0.5) * 40;
      const hy = by + (Math.random() - 0.5) * 40;
      if (t.sockets) {
        const hit = Machine.resolveHit(t, bx, by, part.bladeRadius);
        if (hit) {
          anyHit = true;
          // CHEW THROUGH (Mastery 10) and the Drill's own x1.5 both bite
          // connectors harder; BORE LOCK ramps the Drill a further +50%
          // over 2.5s of CONTINUOUS contact with the same machine.
          const E = Machine._expertise(ent, c);
          let connMul = 1;
          if (hit.kind === 'connector') {
            if (part.connMul) connMul *= part.connMul;
            if (E && E.connMul) connMul *= E.connMul;
            if (E && E.name === 'BORE LOCK') {
              if (c._boreTarget !== t) { c._boreTarget = t; c._boreT = 0; }
              c._boreT += dt;
              connMul *= 1 + Math.min(0.5, (c._boreT / 2.5) * 0.5);
            }
          }
          // §30 PRECISION ROUTINE / CLEAN BREAK ride the same connMul the
          // parts and Elites use — one multiplier, one meaning.
          if (ent.isPlayer) connMul *= (ent.connectorDamageMul || 1);
          // RULE 2, the melee half: a permanent saw is capped the same way
          // and for the same reason.
          if (part.permanent) connMul = PERM.CONN_MUL;
          // THE SPINE'S DRILL BITE (drill step 3): bites faster the longer
          // it stays on one MODULE -- the same component, not merely the
          // same machine -- up to +60% over two seconds. HULL, per rule 2:
          // it rides the output, never the connector multiplier.
          let biteMul = 1;
          if (typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'drillBite')) {
            // The module is the component, or the core when there is none
            // under the blade -- keyed so a core hit is one module too.
            const mod = hit.comp || (hit.kind + ':' + t.id);
            if (c._biteComp !== mod) { c._biteComp = mod; c._biteT = 0; }
            c._biteT = (c._biteT || 0) + dt;
            biteMul = 1 + Math.min(0.6, (c._biteT / 2) * 0.6);
          }
          // THE SPINE'S SAW GRIP (saw step 3): contact slows the target.
          // Its own window on the machine, read by Enemy._steer beside the
          // stagger, and refreshed every frame the blade is in it.
          if (typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'sawGrip')) {
            t._sawGripT = 0.25;
          }
          Machine.applyDamage(t, hit,
            part.dps * Machine.outputMul(ent, c) * connMul * biteMul * dt,
            hx, hy, true, Machine.masteryKey(part));
          if (Math.random() < dt * 30) {
            Effects.spark(bx, by, Math.atan2(by - t.y, bx - t.x), 2, '#ffd23f', 650);
          }
        }
      } else if (Math.hypot(bx - t.x, by - t.y) < part.bladeRadius + t.radius) {
        anyHit = true;
        t.hit(part.dps * (ent.damageMul || 1) * dt, hx, hy, true);
        if (Math.random() < dt * 30) {
          Effects.spark(bx, by, Math.atan2(by - t.y, bx - t.x), 2, '#ffd23f', 650);
        }
      }
    }
    if (anyHit) {
      this.addHeat(ent, part.heatPerSecond * dt, part.id);
      // BOREMAW DRILL (§22): movement -20% WHILE ENGAGED — set here, where
      // engagement is known, consumed in the player's speed product.
      if (part.engagedSlowMul && ent.isPlayer) {
        ent._grindSlowT = 0.12;
        ent._grindSlowMul = part.engagedSlowMul;
      }
    }
  },

  // Beam Laser (plan §33): precise sustained beam. Marched raycast against
  // arena walls, obstacles (via Machine.world) and machines.
  _updateBeam(dt, ent, s, c, targets, firing, owner) {
    const part = c.part;
    c.beamOn = firing && c.online && !ent.overheated;
    if (!c.beamOn) { c._focusTarget = null; c._focusT = 0; return; }

    const aimA = Math.atan2(ent.aimY, ent.aimX);
    const cos = Math.cos(aimA), sin = Math.sin(aimA);
    const p = this.socketPos(ent, s);
    let x = p.x + cos * part.barrel;
    let y = p.y + sin * part.barrel;
    c.beamX0 = x; c.beamY0 = y;

    const step = 34;
    const world = Machine.world;
    // FOCUS LOCK (Mastery 10): after holdTime seconds of continuous contact
    // with the SAME machine, damage ramps toward +30%. The state advances at
    // the bottom of the march, where we know what this frame touched.
    const E = this._expertise(ent, c);
    let focusMul = 1;
    if (E && E.holdTime !== undefined && c._focusT > E.holdTime) {
      focusMul = 1 + Math.min(E.rampCap, (c._focusT - E.holdTime) * E.rampPerSec);
    }
    // THE SPINE'S BEAM RAMP (beamLaser step 2): the beam ramps on one held
    // target, +50% over two seconds. Its own clock (`_rampT`), so the
    // Mastery FOCUS LOCK and the spine can each be bought without one
    // depending on the other's bookkeeping.
    const ramp = typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'beamRamp');
    if (ramp && c._rampTarget && c._rampT > 0) {
      focusMul *= 1 + Math.min(0.5, (c._rampT / 2) * 0.5);
    }
    // AND BEAM SPLIT (step 3): the beam continues through a kill to the
    // next machine. When the march below kills what it was on, the beam is
    // marched once more from the kill point toward the nearest live
    // machine, this frame, at the same damage.
    const split = typeof Spine !== 'undefined' && Spine.live(ent, part.id, 'beamSplit');
    // M11: beams go through outputMul like every other weapon. They used to
    // read ent.damageMul directly, which silently excluded them from Grade
    // output, the Mastery damage stat, the Overcharger AND the new WEAPON
    // OUTPUT track — four systems that all say "weapon damage" and one
    // weapon that heard none of them. outputMul contains damageMul and
    // weaponDamageMul, so enemies behave exactly as before.
    const dmgMul = (owner === 'enemy' ? 0.6 : 1)
                 * this.outputMul(ent, c) * focusMul;
    let travelled = 0;
    let focusHit = null;

    march:
    while (travelled < part.range) {
      x += cos * step; y += sin * step;
      travelled += step;

      if (world) {
        const a = world.arena;
        if (x < a.x || x > a.x + a.w || y < a.y || y > a.y + a.h) break;
        for (const o of world.obstacles) {
          if (o.type === 'pillar') {
            if (Math.hypot(x - o.x, y - o.y) < o.r) break march;
          } else if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) {
            break march;
          }
        }
      }

      for (const t of targets) {
        if (!t.alive) continue;
        const broad = t.radius + (t.sockets ? 200 : 0);
        if (Math.hypot(x - t.x, y - t.y) > broad) continue;
        if (t.sockets) {
          const hit = Machine.resolveHit(t, x, y, 16);
          if (!hit) continue;
          focusHit = t;
          Machine.applyDamage(t, hit, part.dps * dmgMul * dt, x, y, true, part.id);
          // BEAM SPLIT: it died under the beam; carry on to the next one.
          if (split && !t.alive) {
            let nx = null, nd = part.range * 0.6;
            for (const u of targets) {
              if (!u.alive || !u.sockets || u === t) continue;
              const du = Math.hypot(u.x - x, u.y - y);
              if (du < nd) { nd = du; nx = u; }
            }
            if (nx) {
              const h2 = Machine.resolveHit(nx, nx.x, nx.y, nx.radius) || { kind: 'core' };
              Machine.applyDamage(nx, h2, part.dps * dmgMul * dt, nx.x, nx.y, true, part.id);
              Effects.bolt(x, y, nx.x, nx.y, part.color);
              c._splitX = nx.x; c._splitY = nx.y; c._splitT = 0.1;
            }
          }
        } else {
          if (Math.hypot(x - t.x, y - t.y) > t.radius + 16) continue;
          t.hit(part.dps * dmgMul * dt, x, y, true);
        }
        if (Math.random() < dt * 30) {
          Effects.spark(x, y, aimA + Math.PI, 2, part.color, 420);
        }
        break march;
      }
    }
    c.beamEndX = x; c.beamEndY = y;
    if (ramp) {
      if (focusHit && focusHit === c._rampTarget) c._rampT = (c._rampT || 0) + dt;
      else { c._rampTarget = focusHit; c._rampT = 0; }
    }

    // FOCUS LOCK bookkeeping: same machine sustains the hold, a different
    // machine restarts it, and losing contact entirely drops it cold.
    if (E && E.holdTime !== undefined) {
      if (focusHit && focusHit === c._focusTarget) c._focusT += dt;
      else if (focusHit) { c._focusTarget = focusHit; c._focusT = 0; }
      else { c._focusTarget = null; c._focusT = 0; }
    }

    this.addHeat(ent, part.heatPerSecond * dt, part.id);
  },

  // Directional Shield (plan §34): rechargeable arc; breaks temporarily.
  _updateShield(dt, ent, s, c) {
    const part = c.part;
    c.shieldHit += dt;
    // FORTRESS REACTOR ranks and FORTRESS MODE (M12) speed the recharge and
    // shorten the delay before it starts.
    const regenMul = (ent.isPlayer && typeof Mods !== 'undefined')
      ? Mods.shieldRegenMul(ent) : 1;
    const delayMul = (ent.isPlayer && typeof Mods !== 'undefined')
      ? Mods.shieldDelayMul(ent) : 1;
    if (c.online && c.shieldHit > part.shieldRegenDelay * delayMul &&
        c.shieldHp < part.shieldValue) {
      const was = c.shieldHp;
      c.shieldHp = Math.min(part.shieldValue,
        c.shieldHp + part.shieldRegen * regenMul * dt);
      if (was <= 0 && c.shieldHp > 0) {
        const sp = this.socketPos(ent, s);
        Effects.ring(sp.x, sp.y, 90, part.color);
      }
    }
  },

  // Barrier Projector (Master Defence table): the Directional Shield's
  // whole-circle cousin. One 100-point pool covering every angle, so it is
  // simpler to use and much easier to strip — and it costs 4 Power for it.
  _updateBarrier(dt, ent, s, c) {
    const part = c.part;
    c.barrierHit += dt;
    if (c.online && c.barrierHit > part.barrierRegenDelay &&
        c.barrierHp < part.barrierValue) {
      const was = c.barrierHp;
      c.barrierHp = Math.min(part.barrierValue,
        c.barrierHp + part.barrierRegen * dt);
      if (was <= 0 && c.barrierHp > 0 && typeof Effects !== 'undefined') {
        Effects.ring(ent.x, ent.y, this.shieldRadius(ent), part.color);
      }
    }
  },

  // Point Defence (Master Defence table): shoots incoming fire out of the
  // air. Four intercepts a second, 320 range, 0.8 Heat each — so leaning on
  // it in a firefight is a real thermal cost, not a free bubble.
  _updatePointDefence(dt, ent, s, c, owner) {
    const part = c.part;
    c._pdCd = (c._pdCd || 0) - dt;
    if (!c.online || ent.overheated) { c._pdCd = Math.max(c._pdCd, 0); return; }
    if (typeof Projectiles === 'undefined') return;
    const p = this.socketPos(ent, s);
    let guard = 0;
    while (c._pdCd <= 0 && guard++ < 8) {
      let best = null, bestD = part.pdRange;
      for (const pr of Projectiles.pool) {
        if (!pr.active || pr.owner === owner) continue;
        const d = Math.hypot(pr.x - p.x, pr.y - p.y);
        if (d < bestD) { bestD = d; best = pr; }
      }
      if (!best) { c._pdCd = Math.max(c._pdCd, 0); return; }
      best.active = false;
      if (typeof Effects !== 'undefined') {
        Effects.bolt(p.x, p.y, best.x, best.y, part.color);
        Effects.spark(best.x, best.y, Math.atan2(p.y - best.y, p.x - best.x),
          3, part.color, 300);
      }
      this.addHeat(ent, part.pdHeat);
      c._pdCd += 1 / part.pdRate;
    }
  },

  // Drone Bay (Master Utility table): two drones, 5 dmg x 3/s each, range
  // 650, 20 HP, 8s respawn. They orbit, they shoot, and they can be shot
  // down — a drone nothing could kill would make the HP and respawn numbers
  // decoration.
  // DRONE FRAME: "combat drone health AND damage, +20/40/60%." One number for
  // both, read in three places (spawn, respawn, shot) rather than stored on
  // the drone — a drone that banked its multiplier at spawn would keep an old
  // one after the skill was taken, and there is no respec to fix it with.
  _droneMul(ent) {
    return (ent && ent.isPlayer && typeof Skills !== 'undefined')
      ? Skills.mul('droneMul') : 1;
  },

  // DRONE LOGIC R1: "they flank, and they retreat when damaged."
  //
  // FLANK is the orbit turning into a position relative to the TARGET rather
  // than to you: the drone sits on the far side of what it is shooting, so a
  // machine facing you has something behind it. RETREAT is a hurt drone
  // pulling back to your own hull and holding fire until it is safe — which is
  // what makes DRONE FRAME's health worth buying rather than just more bodies.
  DRONE_HURT: 0.4,
  DRONE_FLANK: 190,
  _droneFlank(ent) {
    return ent && ent.isPlayer && typeof Skills !== 'undefined' &&
           Skills.has('droneFlank');
  },
  _droneRetreat(ent, d, part) {
    if (!ent || !ent.isPlayer || typeof Skills === 'undefined') return false;
    if (!Skills.has('droneRetreat')) return false;
    return d.hp < part.droneHp * this._droneMul(ent) * this.DRONE_HURT;
  },

  _updateDrones(dt, ent, s, c, targets, owner) {
    const part = c.part;
    // M12: DRONE SWARM adds a permanent drone, SWARM PROTOCOL adds temporary
    // ones. The flight resizes live so a Special mid-fight grows the flock
    // and its expiry shrinks it back.
    const want = part.drones +
      ((ent.isPlayer && typeof Mods !== 'undefined') ? Mods.extraDrones(ent) : 0);
    if (!c._drones) c._drones = [];
    while (c._drones.length < want) {
      c._drones.push({
        alive: true, hp: part.droneHp * this._droneMul(ent), cd: 0, respawn: 0,
        a: (c._drones.length / Math.max(1, want)) * Math.PI * 2,
        x: ent.x, y: ent.y,
      });
    }
    if (c._drones.length > want) c._drones.length = Math.max(part.drones, want);
    const live = c.online && !ent.overheated;
    for (const d of c._drones) {
      if (!d.alive) {
        // SWARM PROTOCOL: downed drones come back in 1s while it runs.
        let rs = (ent.isPlayer && typeof Mods !== 'undefined')
          ? Mods.droneRespawn(ent, d.respawn) : d.respawn;
        // DRONE LOGIC R2: "revive at a garage for FREE." Standing in a garage
        // is the free revive — a downed drone comes straight back instead of
        // sitting out its respawn, which is what makes going home between
        // fights worth doing with a flight as well as with a hull.
        if (ent.isPlayer && typeof Skills !== 'undefined' &&
            Skills.has('droneFreeRevive') && typeof Garages !== 'undefined' &&
            Garages.nearest && Garages.nearest.d < GARAGE.CLAIM_R) {
          rs = 0;
        }
        if (rs < d.respawn) d.respawn = rs;
        d.respawn -= dt;
        if (d.respawn <= 0 && live) {
          d.alive = true; d.hp = part.droneHp * this._droneMul(ent); d.cd = 0;
          const p = this.socketPos(ent, s);
          if (typeof Effects !== 'undefined') Effects.ring(p.x, p.y, 70, part.color);
        }
        continue;
      }
      d.a += dt * 0.9;
      // DRONE LOGIC: a hurt drone comes home and hugs the hull, which is both
      // the retreat and the reason it survives to be repaired.
      d.hurt = this._droneRetreat(ent, d, part);
      const orbit = d.hurt ? this.DRONE_ORBIT * 0.45 : this.DRONE_ORBIT;
      d.x = ent.x + Math.cos(d.a) * orbit;
      d.y = ent.y + Math.sin(d.a) * orbit;
      if (!live) continue;

      // Shot down by anything the OTHER side is firing.
      if (typeof Projectiles !== 'undefined') {
        for (const pr of Projectiles.pool) {
          if (!pr.active || pr.owner === owner) continue;
          if (Math.hypot(pr.x - d.x, pr.y - d.y) > pr.r + this.DRONE_R) continue;
          pr.active = false;
          d.hp -= pr.damage;
          if (typeof Effects !== 'undefined') {
            Effects.spark(d.x, d.y, Math.atan2(pr.vy, pr.vx), 3, part.color, 320);
          }
          if (d.hp <= 0) {
            d.alive = false;
            d.respawn = part.droneRespawn;
            if (typeof Effects !== 'undefined') Effects.explosion(d.x, d.y, 60);
          }
          break;
        }
      }
      if (!d.alive) continue;

      d.cd -= dt;
      let tgt = null, tD = part.droneRange;
      for (const t of targets) {
        if (!t || !t.alive) continue;
        const dd = Math.hypot(t.x - d.x, t.y - d.y);
        if (dd < tD) { tD = dd; tgt = t; }
      }
      if (!tgt || d.hurt) { d.cd = Math.max(d.cd, 0); continue; }
      // FLANK: sit on the far side of the target, on the line through it from
      // you. A machine that has turned to face you then has a gun behind it,
      // which is the whole of what "they flank" has to mean to be worth a
      // point. Not applied while retreating — that would send a dying drone
      // straight back into the fight.
      if (this._droneFlank(ent)) {
        const fa = Math.atan2(tgt.y - ent.y, tgt.x - ent.x);
        d.x = tgt.x + Math.cos(fa) * this.DRONE_FLANK;
        d.y = tgt.y + Math.sin(fa) * this.DRONE_FLANK;
      }
      // SURGICAL / SWARM PROTOCOL (M12): aim at the target's weakest
      // connector instead of its centre — the drones hunt joints.
      let ax = tgt.x, ay = tgt.y;
      if (tgt.sockets && ent.isPlayer && (
            (typeof Mods !== 'undefined' && Mods.dronesPreferConnectors(ent)) ||
            (typeof Skills !== 'undefined' &&
             Skills.has('droneTargetsConnectors')))) {
        let weak = null, wf = 1.01;
        for (const ts of tgt.sockets) {
          if (!ts.comp) continue;
          const f = ts.comp.connectorHp / ts.comp.maxConnectorHp;
          if (f < wf) { wf = f; weak = ts; }
        }
        if (weak) { const cp = this.connectorPos(tgt, weak); ax = cp.x; ay = cp.y; }
      }
      d.aim = Math.atan2(ay - d.y, ax - d.x);
      const rateMul = (ent.isPlayer && typeof Mods !== 'undefined')
        ? Mods.autoRateMul(ent) : 1;
      let guard = 0;
      while (d.cd <= 0 && guard++ < 4) {
        const shot = this.DRONE_SHOT;
        const a = d.aim + (Math.random() - 0.5) * 2 * shot.spread;
        Projectiles.spawn(d.x, d.y, a, shot, owner,
          this.outputMul(ent, null) * this._droneMul(ent));
        d.cd += 1 / (part.droneRate * rateMul);
      }
    }
  },

  // Auto-Turret Controller (Master Utility table). Claims the first eligible
  // unclaimed ranged weapon CLOCKWISE from socket 0 and runs it itself at 90%
  // of its base rate. The claimed weapon no longer answers the trigger — that
  // is the trade, and it is why the part is worth only 2 Power.
  _assignAutoTurrets(ent) {
    let any = false;
    for (const s of ent.sockets) {
      if (s.comp && s.comp.part.autoTurret && s.comp.online) { any = true; break; }
    }
    if (!any) {
      for (const s of ent.sockets) if (s.comp) s.comp._autoClaimed = false;
      return;
    }
    for (const s of ent.sockets) if (s.comp) s.comp._autoClaimed = false;
    // Clockwise = ascending socket angle, which is the order initSockets
    // lays them out in. Child sockets sort in beside their parent.
    const clockwise = ent.sockets.slice().sort((a, b) => a.angle - b.angle);
    const controllers = ent.sockets.filter(
      k => k.comp && k.comp.part.autoTurret && k.comp.online);
    for (const ctl of controllers) {
      for (const s of clockwise) {
        const c = s.comp;
        if (!c || c._autoClaimed) continue;
        if (c.part.category !== 'weapon') continue;
        // "ranged": something that throws a projectile. Saws, beams and mines
        // are not weapons a turret can usefully swing at a target.
        if (!c.part.projSpeed || !c.part.fireRate || c.part.mine) continue;
        c._autoClaimed = true;
        c._autoBy = ctl.comp;
        break;
      }
    }
  },

  _updateAutoTurret(dt, ent, s, c, targets, owner) {
    const part = c.part;
    // NOTE: the caller has already aged c.cooldown by dt this frame, exactly
    // as it does for a hand-fired weapon. Ageing it again here made the
    // turret fire at double rate.
    const ctl = c._autoBy;
    if (!c.online || ent.overheated || !ctl || !ctl.online) {
      c.cooldown = Math.max(c.cooldown, 0);
      return;
    }
    const p = this.socketPos(ent, s);
    const reach = part.projSpeed * part.projLife;
    let tgt = null, tD = reach;
    for (const t of targets) {
      if (!t || !t.alive) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < tD) { tD = d; tgt = t; }
    }
    if (!tgt) {
      c._autoAim = undefined;
      c.cooldown = Math.max(c.cooldown, 0);
      return;
    }
    const aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
    c._autoAim = aim;
    let guard = 0;
    const autoMul = (ent.isPlayer && typeof Mods !== 'undefined')
      ? Mods.autoRateMul(ent) : 1;
    while (c.cooldown <= 0 && guard++ < 6) {
      c.sinceShot = 0;
      this._fireShot(ent, s, c, owner, aim, targets);
      c.cooldown += this._shotCooldown(ent, c, ctl.part.turretRate * autoMul);
    }
  },

  // Reflector Plate (Master Defence table). Called from Projectiles the
  // instant a shot resolves onto a plate, because reflecting needs the
  // projectile itself — applyDamage only ever sees a number.
  //
  // Front impacts only: the shot has to be travelling INTO the plate's own
  // outward face. A round that clips the back of it is just damage.
  tryReflect(ent, hit, pr) {
    if (!hit || hit.kind !== 'component') return false;
    const c = hit.comp, s = hit.socket;
    const part = c.part;
    if (!part.reflectChance || !c.online) return false;
    if (c._reflectCd > 0) return false;
    if (pr.splash > 0) return false;                 // explosives do not bounce
    const nx = Math.cos(s.angle), ny = Math.sin(s.angle);
    const dot = pr.vx * nx + pr.vy * ny;
    if (dot >= 0) return false;                      // leaving, not arriving
    if (Math.random() >= part.reflectChance) return false;

    c._reflectCd = part.reflectCd;
    // Mirror the velocity about the plate face, then hand the shot to the
    // other side at 60% damage. It is now YOUR bullet.
    pr.vx -= 2 * dot * nx;
    pr.vy -= 2 * dot * ny;
    pr.damage *= part.reflectDamage;
    pr.owner = pr.owner === 'enemy' ? 'player' : 'enemy';
    pr.color = pr.owner === 'enemy' ? '#ff5c7a' : part.color;
    pr.t = 0;
    pr.homing = 0;                                   // a bounced rocket is dumb
    if (pr.hitList) pr.hitList.length = 0;
    if (typeof Effects !== 'undefined') {
      Effects.spark(pr.x, pr.y, s.angle, 5, part.color, 520);
      Effects.comicWord('BOUNCE!', pr.x, pr.y - 60, part.color, 64);
    }
    return true;
  },

  // Repair Arm (plan §34): after several damage-free seconds, slowly fixes
  // the most damaged attached component; the Core only when parts are healthy.
  _updateRepair(dt, ent, c) {
    const part = c.part;
    // STITCHER ARM (§22): once per map, the FIRST destroyed standard module
    // is rebuilt at 25% after 12s of calm, if a legal socket is free.
    if (part.rebuildDelay && ent.isPlayer && ent._protoLostPart &&
        typeof Proto !== 'undefined' && !Proto.mapState.stitcherRebuilt &&
        (ent.sinceDamage ?? 0) >= part.rebuildDelay) {
      const lost = ent._protoLostPart;
      ent._protoLostPart = null;
      const idx = this.attach(ent, lost);
      if (idx >= 0) {
        Proto.mapState.stitcherRebuilt = true;
        const ns = this.getSocket(ent, idx);
        if (ns && ns.comp) {
          ns.comp.hp = Math.max(1, ns.comp.maxHp * part.rebuildFrac);
        }
        Effects.comicWord('REBUILT!', ent.x, ent.y - 200, part.color, 66);
        Effects.ring(ent.x, ent.y, 260, part.color);
      }
    }
    if ((ent.sinceDamage ?? 999) < part.idleDelay) return;

    let worst = null, worstFrac = 0.999;
    for (const s of ent.sockets) {
      if (!s.comp) continue;
      const f = s.comp.hp / s.comp.maxHp;
      if (f < worstFrac) { worstFrac = f; worst = s; }
    }
    if (worst) {
      worst.comp.hp = Math.min(worst.comp.maxHp,
        worst.comp.hp + part.repairRate * dt);
      // STITCHER ARM (§22): the weakest module's CONNECTOR heals too.
      if (part.connRepairRate) {
        worst.comp.connectorHp = Math.min(worst.comp.maxConnectorHp,
          worst.comp.connectorHp + part.connRepairRate * dt);
      }
      if (Math.random() < dt * 6) {
        const p = this.socketPos(ent, worst);
        Effects.spark(p.x, p.y, -Math.PI / 2, 1, '#a8e832', 180);
      }
    } else if (ent.hp !== undefined && ent.maxHp && part.coreRepairRate &&
               ent.hp < ent.maxHp) {
      ent.hp = Math.min(ent.maxHp, ent.hp + part.coreRepairRate * dt);
      if (Math.random() < dt * 4) {
        Effects.spark(ent.x, ent.y - ent.radius, -Math.PI / 2, 1, '#a8e832', 180);
      }
    }
  },

  // -------------------------------------------------------------------------
  // Collision ordering (plan §17 + §34): shield arc first, then nearest of
  // connector / component / Core. A mounted part physically shields the
  // Core behind it; a raised Directional Shield blocks its whole arc.
  resolveHit(ent, px, py, pr) {
    // Directional Shields: blocking arc band outside the machine.
    const sr = this.shieldRadius(ent);
    const dCore = Math.hypot(px - ent.x, py - ent.y);
    // Barrier Projector first: it is a full circle, so it wraps whatever a
    // Directional Shield covers. Any live barrier eats the hit.
    if (Math.abs(dCore - sr) < 34 + pr) {
      for (const s of ent.sockets) {
        const c = s.comp;
        if (!c || !c.part.barrierValue || !c.online || c.barrierHp <= 0) continue;
        return { kind: 'barrier', socket: s, comp: c };
      }
    }
    if (Math.abs(dCore - sr) < 34 + pr) {
      const hitA = Math.atan2(py - ent.y, px - ent.x);
      for (const s of ent.sockets) {
        const c = s.comp;
        if (!c || !c.part.shieldValue || !c.online || c.shieldHp <= 0) continue;
        let diff = Math.abs(hitA - s.angle) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff <= c.part.shieldArcHalf) {
          return { kind: 'shield', socket: s, comp: c };
        }
      }
    }

    // Nearest overlapped hitbox wins: connector, component, then Core.
    let best = null, bestD = Infinity;
    for (const s of ent.sockets) {
      if (!s.comp) continue;
      const cp = this.connectorPos(ent, s);
      const dc = Math.hypot(px - cp.x, py - cp.y);
      if (dc < this.CONNECTOR_R + pr && dc < bestD) {
        bestD = dc;
        best = { kind: 'connector', socket: s, comp: s.comp };
      }
      const p = this.socketPos(ent, s);
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < s.comp.part.bodyRadius + pr && d < bestD) {
        bestD = d;
        best = { kind: 'component', socket: s, comp: s.comp };
      }
    }
    if (best) return best;
    if (dCore < ent.radius + pr) {
      return { kind: 'core' };
    }
    return null;
  },

  // -------------------------------------------------------------------------
  // The outcomes (plan §18 + §34): shield soak, Core damage, part
  // destruction, or connector break -> intact loose salvage.
  applyDamage(ent, hit, dmg, hx, hy, isSaw = false, srcId = null, cause = null) {
    // M2: record the last weapon family to touch this machine so its death
    // can credit the right Mastery track.
    if (srcId) ent._lastHitBy = srcId;
    // WHAT KIND OF HIT. `cause` is named by the source when it knows
    // ('mine', 'blast' from a shell or a canister); a weapon's splash is read
    // off the part. It is what the TANK's BLAST RESISTANT reads, and HARD HAT.
    if (!cause && srcId && typeof PARTS !== 'undefined' && PARTS[srcId] && PARTS[srcId].splash) {
      cause = 'splash';
    }
    // THE TANK: "shrugs off arty, mines, and anything explosive". Rigs.damageMul
    // was written for it and had no caller (D343). Here, on the player, on
    // core, part and joint alike, before anything else scales the number.
    if (ent.isPlayer && cause && typeof Rigs !== 'undefined' && Rigs.damageMul) {
      dmg *= Rigs.damageMul(ent, cause);
    }
    // CORE CHARGE (§20/M12): the player's effective damage feeds the meter,
    // rate-capped inside Mods. Only damage TO enemies counts.
    if (!ent.isPlayer && typeof Mods !== 'undefined' && this._xpPlayer) {
      Mods.addChargeDamage(this._xpPlayer, dmg);
    }
    // SUSTAINED FIRE: "holding fire on one target builds a damage ramp THAT
    // RESETS WHEN YOU SWITCH." Which is why it cannot live in outputMul with
    // the other output multipliers — that pipe has no idea what it is hitting,
    // and the whole character of this skill is that it does.
    if (!ent.isPlayer && typeof Sustain !== 'undefined') {
      dmg *= Sustain.mul(ent);
    }
    // THE SPINE'S STAGGER (cannon step 2, scattergun step 3). A hit that
    // staggers is a hit that takes the machine's next second off it — which is
    // the one upgrade in the whole spine that changes the SHAPE of a fight
    // rather than its arithmetic, and the reason a cannon is worth finishing.
    //
    // Written as a window on the target, read by Enemy._steer, so nothing here
    // has to know how a machine moves.
    if (!ent.isPlayer && srcId && typeof PARTS !== 'undefined' &&
        PARTS[srcId] && PARTS[srcId].permanent &&
        typeof Spine !== 'undefined' && Spine.has(srcId, 'stagger')) {
      ent._staggerT = Math.max(ent._staggerT || 0, 0.6);
      if (typeof Effects !== 'undefined') {
        Effects.spark(hx, hy, 0, 4, CONFIG.COLOR.yellow, 300);
      }
    }
    // FORTRESS MODE: the player's connectors take 35% less while it runs.
    if (ent.isPlayer && hit.kind === 'connector' && typeof Mods !== 'undefined') {
      dmg *= Mods.connInMul(ent);
    }
    // THE SPINE'S TETHER MARK (harpoon step 2): a tethered machine takes
    // +20% from everything, for as long as the line holds. Set by the
    // harpoon round that landed it, decays with the tether.
    if (!ent.isPlayer && ent._tetherT > 0 && ent._tetherMarked) dmg *= 1.2;
    // HEAT RESIST (the POURER 0.6, the SLAGJAW 0.7): flame rounds, burning
    // ground and molten lanes do that much less to it. "Flamethrowers are a
    // bad idea here" -- the Ironworks' own machines are built for the heat.
    if (!ent.isPlayer && ent.heatResist && srcId && typeof PARTS !== 'undefined' &&
        ((PARTS[srcId] && PARTS[srcId].flame) || srcId === 'hazard')) {
      dmg *= (1 - ent.heatResist);
    }
    // A big single hit (Cannon, Railgun, a press) reads much better with two
    // frames of freeze. Saws are excluded: they tick every frame and would
    // turn the whole game into a stutter.
    if (!isSaw && dmg >= 25) Effects.hitStop(0.035, 0.2);

    if (hit.kind === 'barrier') {
      const c = hit.comp;
      c.barrierHit = 0;
      c.barrierHp -= dmg;
      if (!isSaw) {
        Effects.spark(hx, hy, Math.atan2(hy - ent.y, hx - ent.x), 2,
          c.part.color, 340);
      }
      if (c.barrierHp <= 0) {
        c.barrierHp = 0;
        Effects.ring(hx, hy, 140, c.part.color);
        Effects.comicWord('BARRIER DOWN!', hx, hy - 70);
      }
      return;   // like the shield, this does NOT reset the Repair Arm timer
    }

    if (hit.kind === 'shield') {
      const c = hit.comp;
      c.shieldHit = 0;
      c.shieldHp -= dmg;
      if (!isSaw) Effects.spark(hx, hy, Math.atan2(hy - ent.y, hx - ent.x), 2, '#22d9ff', 340);
      if (c.shieldHp <= 0) {
        c.shieldHp = 0;
        Effects.ring(hx, hy, 120, '#22d9ff');
        Effects.comicWord('CRACK!', hx, hy - 70);
      }
      return;  // shield hits do NOT reset the Repair Arm idle timer
    }

    if (ent.sinceDamage !== undefined) ent.sinceDamage = 0;

    if (hit.kind === 'core') {
      if (ent.takeCoreDamage) ent.takeCoreDamage(dmg, hx, hy, isSaw, cause);
      return;
    }
    const c = hit.comp, s = hit.socket;

    // Reactive Armour (Master Defence table): one charged absorb every 5s,
    // and only against a projectile or an explosion — a saw grinding on it
    // is not the kind of hit the charge is for.
    if (!isSaw && hit.kind === 'component' && c.part.reactiveCd && c.online
        && !(c._reactiveT > 0)) {
      c._reactiveT = c.part.reactiveCd;
      dmg *= (1 - c.part.reactiveReduce);
      const rp = this.socketPos(ent, s);
      Effects.ring(rp.x, rp.y, c.part.bodyRadius + 40, c.part.color);
      Effects.comicWord('ABSORB!', rp.x, rp.y - 70, c.part.color, 64);
    }

    // Damage numbers: saw/beam ticks accumulate into readable chunks
    if (isSaw) {
      c._dmgAcc = (c._dmgAcc || 0) + dmg;
      if (c._dmgAcc >= 10) {
        Effects.damageNumber(hx, hy - 34, c._dmgAcc);
        c._dmgAcc = 0;
      }
    } else {
      Effects.damageNumber(hx, hy - 34, dmg);
    }

    if (hit.kind === 'connector') {
      // KINGMAKER CORRECTION MARK (§26A): the next hit on the marked player
      // connector lands at x1.4. Consumed here — the ONE connector-damage
      // site — because the recurring probe hole is effects checked where
      // they are SET instead of where they are APPLIED.
      if (ent.isPlayer && c._correctionArmed) {
        c._correctionArmed = false;
        dmg *= WARDEN_TUNING.kingmaker.markBonus;
        Effects.comicWord('CORRECTED!', hx, hy - 60, '#ffd23f', 54);
      }
      // BLOCK 4.1: never shot off, lost or destroyed. There is nothing to
      // shear on a permanent, so the hit simply does not land on the joint.
      if (c.part && c.part.permanent) return false;
      // RULE 2 STOOD HERE AND IT IS GONE (D366). A permanent's rounds used to
      // be walled off at PERM.CONN_FLOOR of a joint's max, "farming impossible
      // by construction". The wall never stood: it asked PARTS[srcId].permanent
      // and a permanent's rounds carry their BASE class as srcId for Mastery
      // credit, so it was false every time. Aaron's ruling is that it should
      // not be repaired — the Yard teaches SHOOT THE JOINT and a new save's
      // only gun is a permanent. A permanent shears a joint like any other
      // weapon; PERM.CONN_MUL, assigned back in Machine.update, is all that
      // makes it slow about it.
      //
      // BREAKER: "connector damage". ONE line, before the two paths split,
      // so a permanent and a stolen gun both benefit and neither can drift.
      if (ent && !ent.isPlayer && typeof Skills !== 'undefined') {
        dmg *= Skills.mul('connDamageMul');
      }
      c.connectorHp -= dmg;
      Effects.spark(hx, hy, s.angle, 3, '#ffd23f', 420);
      if (c.connectorHp <= 0) this.breakConnector(ent, s);
    } else {
      // WEAK POINT: "reactors, legs and beams take extra damage — the parts
      // whose loss CHANGES BEHAVIOUR". Which is the whole reason it is not
      // simply a damage skill: it rewards shooting the part that turns the
      // machine into a different machine, and those three are exactly the
      // categories that do. Read off `category`, so a new reactor or a new
      // set of treads is covered the day it is written.
      if (ent && !ent.isPlayer && typeof Skills !== 'undefined' &&
          this.behaviourCritical(c.part)) {
        dmg *= Skills.mul('critModuleMul');
      }
      c.hp -= dmg;
      Effects.spark(hx, hy, s.angle, 2, c.part.color, 380);
      if (c.hp <= 0) this.destroyComponent(ent, s);
    }
  },

  // The parts whose loss changes what a machine DOES rather than how hard it
  // hits: its power, its legs, and a beam (which is the one weapon whose loss
  // changes the shape of the fight rather than its arithmetic).
  behaviourCritical(part) {
    if (!part) return false;
    return part.category === 'power' || part.category === 'movement' ||
           !!part.beam;
  },

  // Connector snapped: part flies off INTACT and becomes salvage.
  breakConnector(ent, s) {
    // XP: only for wrecking SOMEONE ELSE'S machine.
    if (!ent.isPlayer && typeof Levels !== 'undefined') {
    }
    // CORE CHARGE: a broken connector is worth +4 (§20).
    if (!ent.isPlayer && typeof Mods !== 'undefined' && Machine._xpPlayer) {
      Mods.event(Machine._xpPlayer, 'connector');
    }
    if (!ent.isPlayer && typeof Tutorial !== 'undefined') Tutorial.did('joint');
    if (typeof Audio_ !== 'undefined') Audio_.play('connectorBreak');
    // Shearing a part off is the best thing you can do — give it a beat.
    Effects.hitStop(0.055, 0.12);
    const comp = this.detach(ent, s.id);
    if (!comp) return;
    const p = this.socketPos(ent, s);
    Effects.ring(p.x, p.y, 95, '#ffd23f');
    Effects.spark(p.x, p.y, s.angle, 12, '#ffd23f', 750);
    // CLEAN SALVAGE (M12): parts the player shears off land healthier.
    let hpMul = (!ent.isPlayer && typeof Mods !== 'undefined')
      ? Mods.salvageHpMul() : 1;
    // §30 CLEAN BREAK stacks on it, and the rip counts toward the challenge
    // that unlocks the firmware in the first place.
    LooseParts.spawn(comp.part.id,
      Math.min(1, (comp.hp / comp.maxHp) * hpMul),
      p.x, p.y,
      Math.cos(s.angle) * 460 + (ent.vx || 0) * 0.4,
      Math.sin(s.angle) * 460 + (ent.vy || 0) * 0.4);
  },

  // Component HP zeroed: destroyed, unsalvageable, small debris burst.
  // Reactors go up violently and scorch their own machine (plan §35).
  destroyComponent(ent, s) {
    // SURGEON / SCRAPPER: a module you shot to pieces sometimes survives
    // whole, and one that does not pays out anyway. HERE, at the one place a
    // module is destroyed, so every weapon and every hazard obeys both.
    if (!ent.isPlayer && typeof Skills !== 'undefined' && s && s.comp) {
      if (Math.random() < Skills.sum('intactChance')) {
        return this.detach(ent, s.id);        // it came off whole after all
      }
      const frac = Skills.sum('destroyScrapFrac');
      if (frac > 0 && typeof Forge !== 'undefined' && s.comp.part) {
        Forge.bank(Math.round((s.comp.part.loadCost || 1) * 9 * frac));
      }
    }
    // SIGNATURE SOUND #1's OTHER HALF. "A player must be able to tell these
    // two apart WITH THEIR EYES SHUT - if they can't, the flanking mechanic
    // is invisible in the audio channel."
    //
    // A part shot to pieces used to make the SAME noise as a part taken off
    // whole, which is the single loudest thing this game could get wrong
    // about itself: the reward and the failure sounded identical.
    if (typeof Audio_ !== 'undefined') Audio_.play('moduleDestroyed');
    // XP: only for wrecking SOMEONE ELSE'S machine.
    if (!ent.isPlayer && typeof Levels !== 'undefined') {
    }
    if (typeof Unlocks !== 'undefined') {
      Unlocks.event(ent.isPlayer ? 'partLost' : 'moduleDestroyed');
    }
    // §30 ABLATIVE LOGIC: losing a module pays a Core shield (and the
    // challenge counter that unlocks it) — the one module-lost moment.
    const comp = s.comp;
    // STITCHER ARM (§22): record the FIRST destroyed standard module so a
    // mounted Arm can rebuild it later. Recorded unconditionally — cheap,
    // and the Arm may be bolted on AFTER the loss.
    if (ent.isPlayer && comp && !comp.part.prototype && !ent._protoLostPart) {
      ent._protoLostPart = comp.part.id;
    }
    const p = this.socketPos(ent, s);
    this.detach(ent, s.id);
    if (comp && comp.part.explodeRadius) {
      Effects.explosion(p.x, p.y, comp.part.explodeRadius);
      Effects.comicWord('BOOM!', p.x, p.y - 70);
      Camera.shake(5, 0.16);
      if (ent.takeCoreDamage) ent.takeCoreDamage(comp.part.explodeDamage, p.x, p.y);
    } else {
      Effects.explosion(p.x, p.y, 85);
    }
  },

  // -------------------------------------------------------------------------
  // ---- PART 5 FIX 5: WHAT NOT TO DRAW ON A MACHINE ----------------------
  //
  // 'A late-game player with fifteen branched modules, fighting six machines
  // with eight modules each, is ~120 module draws plus connectors plus damage
  // states. This is the game, so this is the one to spend budget on. Cull
  // modules that are smaller than a few pixels, and do not draw connector
  // highlights beyond a distance.'
  //
  // Both are implemented. Only one of them ever fires, and that is worth
  // knowing rather than guessing:
  //
  // THE PIXEL CULL NEVER FIRES AT THE SHIPPED ZOOM. The camera runs 0.45 to
  // 0.62 and a module bodyRadius is 34 to 42, so a module is 15 to 26 screen
  // pixels -- never near 'a few'. It is kept because it costs one multiply
  // and is the guard that makes a future zoom-out safe, and because a check
  // that never fires is much better than a check somebody assumed was there.
  //
  // THE CONNECTOR HIGHLIGHT IS THE ONE THAT PAYS. It is two full-width
  // strokes per module -- the widest lines in the frame at 22 and 12 units --
  // and Part 5 is right that it does not need drawing on a machine across the
  // district. It is THE load-bearing affordance in the game, so the distance
  // is set well past the range at which anybody could act on it, and the
  // PLAYER'S OWN machine is never culled at any distance.
  CULL: true,
  MIN_MODULE_PX: 3,
  HIGHLIGHT_R: 2600,

  draw(ctx, ent) {
    const aimA = Math.atan2(ent.aimY, ent.aimX);
    const zoom = (typeof Camera !== 'undefined' && Camera.zoom) ? Camera.zoom : 1;
    // The player is always fully drawn: it is the thing being read.
    let far = false;
    if (this.CULL && !ent.isPlayer) {
      const pl = this._xpPlayer;
      if (pl) far = Math.hypot(ent.x - pl.x, ent.y - pl.y) > this.HIGHLIGHT_R;
    }
    for (const s of ent.sockets) {
      if (!s.comp) continue;
      if (this.CULL && !ent.isPlayer &&
          (s.comp.part.bodyRadius || 0) * zoom < this.MIN_MODULE_PX) continue;
      const c = s.comp;
      const part = c.part;
      const frac = c.connectorHp / c.maxConnectorHp;
      const critical = frac <= this.RIP_THRESHOLD;

      // Critical connectors wobble the whole mounted part (plan §19).
      let p = this.socketPos(ent, s);
      if (critical) {
        const w = Math.sin(c.spin * 9) * 6;
        p = { x: p.x + Math.cos(s.angle + Math.PI / 2) * w,
              y: p.y + Math.sin(s.angle + Math.PI / 2) * w };
      }

      // Connector strut: steel -> scorched -> flashing red near break.
      // Child parts strut from their parent Splitter, not the Core.
      let ex = ent.x + Math.cos(s.angle) * ent.radius;
      let ey = ent.y + Math.sin(s.angle) * ent.radius;
      if (s.parentId !== undefined) {
        const parent = this.getSocket(ent, s.parentId);
        if (parent) {
          const pp = this.socketPos(ent, parent);
          ex = pp.x; ey = pp.y;
        }
      }
      // THE CONNECTOR HIGHLIGHT. "The load-bearing visual affordance in the
      // ENTIRE GAME. In the first district it should be brighter than it will
      // ever be again, and fade to normal after the first few kills."
      //
      // WEIGHT, not colour. A different colour in the first district would be
      // a tutorial the player then has to unlearn; the whole point is that
      // this is the same highlight they will read for the next twenty hours,
      // just louder while it is new.
      const hl = (typeof Opening !== 'undefined') ? Opening.highlightMul() : 1;
      let strut = CONFIG.COLOR.steel;
      if (critical) strut = Math.sin(c.spin * 12) > 0 ? '#ff3b3b' : '#ffd23f';
      else if (frac < 1) strut = '#c9a23f';
      if (!far) {
        ctx.strokeStyle = CONFIG.COLOR.ink;
        ctx.lineWidth = 22 * hl;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.strokeStyle = strut;
        ctx.lineWidth = 12 * hl;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(p.x, p.y); ctx.stroke();
      }

      this._drawComponent(ctx, ent, s, c, p, aimA);

      // Component damage state (plan §68): darker tint when badly hurt.
      if (c.hp / c.maxHp < 0.5) {
        R.circle(p.x, p.y, part.bodyRadius * 0.9, 'rgba(0,0,0,0.32)');
      }

      // OFFLINE parts are visibly dead weight (plan §24). Drawn hard: a part
      // that silently does nothing reads as a broken weapon, not a power
      // problem — the whole point is that the player goes and fixes the power.
      if (!c.online) {
        R.circle(p.x, p.y, part.bodyRadius * 1.02, 'rgba(10,12,24,0.72)');
        R.circle(p.x, p.y, part.bodyRadius * 1.02, 'rgba(0,0,0,0)', CONFIG.COLOR.red, 5);
        // a slash across it, so it reads even without the label
        ctx.save();
        ctx.strokeStyle = CONFIG.COLOR.red;
        ctx.lineWidth = 6;
        const rr = part.bodyRadius * 0.72;
        ctx.beginPath();
        ctx.moveTo(p.x - rr, p.y - rr); ctx.lineTo(p.x + rr, p.y + rr);
        ctx.stroke();
        ctx.restore();
        R.text('NO POWER', p.x, p.y - part.bodyRadius - 24, 24, CONFIG.COLOR.red);
      }

      // CONNECTOR READ: "connector health shows as a readout on enemy modules,
      // NOT JUST A GUESS. R1: on the machine you're locked onto. R2: on every
      // machine on screen."
      //
      // Enemy modules only, and that is the skill rather than a limitation:
      // your own connectors already wobble and flash, and a number over every
      // joint on your own machine would bury the affordance the whole game is
      // built on.
      this._drawConnRead(ctx, ent, s, c, frac);
    }

    // Shield arcs render over everything on the machine (plan §34).
    this._drawShields(ctx, ent);
    this._drawBarriers(ctx, ent);
    this._drawDrones(ctx, ent);
  },

  // CONNECTOR READ. 'locked' is rank 1, 'all' is rank 2 — the string is the
  // rank, so the tree's own data says which and this function does not have to
  // count ranks a second time.
  _drawConnRead(ctx, ent, s, c, frac) {
    if (ent.isPlayer || typeof Skills === 'undefined') return;
    const mode = Skills.pick('connReadout');
    if (!mode) return;
    if (mode === 'locked' && !ent._aimLocked) return;
    const cp = this.connectorPos(ent, s);
    const col = frac <= this.RIP_THRESHOLD ? CONFIG.COLOR.red
      : (frac < 1 ? CONFIG.COLOR.yellow : CONFIG.COLOR.steel);
    // CLAMPED. MOUNT BRACING raises a connector's ceiling, and a joint healed
    // past the max it was minted with would otherwise print 145% at the player
    // — a number that is true about the data and meaningless on screen.
    const pct = Math.max(0, Math.min(100, Math.ceil(frac * 100)));
    R.smallText(pct + '%', cp.x, cp.y - 34, 20, col, 'center');
  },

  // The Barrier Projector's ring. Deliberately the same visual language as
  // the Directional Shield arc, because it is the same idea all the way
  // round — the player should read one as the other's bigger brother.
  _drawBarriers(ctx, ent) {
    const sr = this.shieldRadius(ent);
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c || !c.part.barrierValue || !c.online || c.barrierHp <= 0) continue;
      const f = c.barrierHp / c.part.barrierValue;
      const flash = c.barrierHit < 0.09;
      ctx.save();
      ctx.globalAlpha = flash ? 0.9 : 0.22 + f * 0.34;
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 20;
      ctx.beginPath(); ctx.arc(ent.x, ent.y, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = flash ? '#ffffff' : c.part.color;
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(ent.x, ent.y, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  },

  _drawDrones(ctx, ent) {
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c || !c._drones) continue;
      const col = c.part.color;
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      for (const d of c._drones) {
        if (!d.alive) continue;
        const R0 = this.DRONE_R;
        // A tether back to its bay FIRST, so the drone draws on top of it.
        // Without it a drone reads as a stray enemy the moment it drifts.
        const bay = this.socketPos(ent, s);
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(bay.x, bay.y); ctx.lineTo(d.x, d.y); ctx.stroke();
        ctx.restore();

        R.circle(d.x + 4, d.y + 7, R0, 'rgba(0,0,0,0.38)');
        // Spinning rotor arcs. The drones were two dots before: at a glance
        // they read as beads on the Barrier ring rather than as machines.
        // Motion and an outline are what separate them from the furniture.
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        for (let i = 0; i < 2; i++) {
          const a0 = t * 14 + i * Math.PI;
          ctx.beginPath();
          ctx.arc(d.x, d.y, R0 * 1.5, a0, a0 + 1.5);
          ctx.stroke();
        }
        ctx.restore();
        R.circle(d.x, d.y, R0, col, CONFIG.COLOR.ink, 5);
        R.circle(d.x - 5, d.y - 6, 6, '#ffffff');
        // A muzzle stub pointing where it is shooting, so the player can see
        // what it has picked out.
        if (d.aim !== undefined) {
          ctx.save();
          ctx.strokeStyle = CONFIG.COLOR.ink;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + Math.cos(d.aim) * R0 * 1.4, d.y + Math.sin(d.aim) * R0 * 1.4);
          ctx.stroke();
          ctx.restore();
        }
        // Health pip once hurt, so "20 HP, 8s respawn" is legible in play.
        const f = d.hp / c.part.droneHp;
        if (f < 1) {
          R.circle(d.x, d.y - this.DRONE_R - 12, 4,
            f > 0.5 ? CONFIG.COLOR.lime : CONFIG.COLOR.red);
        }
      }
    }
  },

  _drawShields(ctx, ent) {
    const sr = this.shieldRadius(ent);
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c || !c.part.shieldValue || !c.online || c.shieldHp <= 0) continue;
      const f = c.shieldHp / c.part.shieldValue;
      const flash = c.shieldHit < 0.09;
      ctx.save();
      ctx.globalAlpha = flash ? 0.95 : 0.35 + f * 0.4;
      ctx.strokeStyle = CONFIG.COLOR.ink;
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(ent.x, ent.y, sr, s.angle - c.part.shieldArcHalf, s.angle + c.part.shieldArcHalf);
      ctx.stroke();
      ctx.strokeStyle = flash ? '#ffffff' : c.part.color;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(ent.x, ent.y, sr, s.angle - c.part.shieldArcHalf, s.angle + c.part.shieldArcHalf);
      ctx.stroke();
      ctx.restore();
    }
    // Beams render here too so they draw over the machine.
    for (const s of ent.sockets) {
      const c = s.comp;
      if (!c || !c.part.beam || !c.beamOn) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(c.beamX0, c.beamY0);
      ctx.lineTo(c.beamEndX, c.beamEndY); ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = c.part.color;
      ctx.lineWidth = 16 + Math.sin(c.spin * 6) * 4;
      ctx.beginPath(); ctx.moveTo(c.beamX0, c.beamY0);
      ctx.lineTo(c.beamEndX, c.beamEndY); ctx.stroke();
      ctx.restore();
      R.circle(c.beamEndX, c.beamEndY, 14 + Math.sin(c.spin * 8) * 4, '#ffffff');
    }
  },

  // THE ONE QUESTION THE RENDERER ASKS THE PAINT SHOP.
  //
  // `Paint.colourFor` was written in Block 12 as exactly this hook and NOTHING
  // EVER CALLED IT — the whole paint layer was data, rules, unlocks, presets
  // and a randomiser that no line of drawing code had ever heard of. This is
  // the line that makes a colour a player chose into a colour a player sees.
  //
  // Player parts only. An enemy carrying a part it shot off you draws hostile
  // red, because faction is not cosmetic and never becomes cosmetic.
  //
  // BODY ONLY, and that is a real limit rather than an oversight: `body`,
  // `trim`, `metal` and `dark` are four ROLES within one part, and telling
  // them apart at draw time needs a slot map per part — the yes-or-no the
  // bible has been holding open on 113 sets. Until that is answered the shop
  // stores all four and shows all four, and one of them reaches the machine.
  paintOf(ent, part) {
    if (!ent || !ent.isPlayer || typeof Paint === 'undefined') return null;
    const who = (typeof Rigs !== 'undefined' && Rigs.vehicleId)
      ? Rigs.vehicleId() : null;
    if (!who) return null;
    return Paint.colourFor(who, part, 'body', null);
  },

  // The same part with its body colour replaced, or the part itself when no
  // paint applies. `Object.create` rather than a spread: every other field —
  // and there are forty of them — keeps coming off the real part, so a part
  // definition that gains a field cannot leave a painted copy behind holding
  // the old shape. Cached per part per colour, so a repaint is a lookup.
  _paintedCache: new Map(),
  _painted(ent, part) {
    const hex = this.paintOf(ent, part);
    if (!hex || !part || hex === part.color) return part;
    let byColour = this._paintedCache.get(part);
    if (!byColour) { byColour = new Map(); this._paintedCache.set(part, byColour); }
    let cp = byColour.get(hex);
    if (!cp) { cp = Object.create(part); cp.color = hex; byColour.set(hex, cp); }
    return cp;
  },

  _drawComponent(ctx, ent, s, c, p, aimA) {
    // Real art when we have it; the code-drawn shape stays as the fallback.
    // Drawn at the part's own reach so it matches the collision gameplay uses,
    // and rotated the way this component actually faces: turret weapons follow
    // the aim, everything else points out of its socket.
    if (typeof Assets !== 'undefined' && Assets.has(this.artKey(c.part))) {
      const pt = c.part;
      // ONE MODEL, BOTH SIDES. The same Machine Gun is drawn green on your
      // machine and red on the thing shooting at you, so a part changing hands
      // is always coloured correctly and no part needs a second model.
      // js/tint.js does the work and caches it.
      const hostile = !ent.isPlayer;
      const turret = !!(pt.projSpeed || pt.beam || pt.flame || pt.chain);
      // A weapon an Auto-Turret Controller has taken over points at ITS
      // target, not at where the player is aiming — otherwise the shots come
      // out sideways from a barrel facing forward.
      const face = (turret && c._autoClaimed && c._autoAim !== undefined)
        ? c._autoAim : (turret ? aimA : s.angle);
      let ang = face + (pt.artAngle || 0);
      const reach = Math.max(pt.bodyRadius || 36, pt.barrel || 0, pt.bladeRadius || 0);
      let size = reach * 2.3;
      let ox = 0, oy = 0;

      // ---- LIVE ANIMATION -------------------------------------------------
      // Sprites are static, so movement comes from the transform. No frame
      // sheets, no extra art: the model is spun, kicked and shaken in code.
      const t = performance.now() / 1000;

      if (pt.bladeRadius && Assets.has('part_saw_blade')) {
        // ONLY THE BLADE SPINS. Rotating the whole sprite made the motor
        // housing orbit with it, which looked ridiculous. The sprite is split
        // into a static body and a disc centred on its own axle, so the blade
        // turns about the hub exactly as it would on the real machine.
        const rate = c.online ? 11 : 1.4;
        const RIG = Machine.SAW_RIG;
        // Hub offset is stored in sprite space, so it has to be rotated with
        // the mount before it is applied.
        const cs = Math.cos(ang), sn = Math.sin(ang);
        const hx = (RIG.hubX * size) * cs - (RIG.hubY * size) * sn;
        const hy = (RIG.hubX * size) * sn + (RIG.hubY * size) * cs;
        Assets.sprite(ctx, 'part_saw_body', p.x + ox, p.y + oy, size, size, ang, hostile);
        const bsz = size * RIG.bladeFrac;
        ctx.save();
        ctx.globalAlpha = c.online ? 0.30 : 0.10;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(3, bsz * 0.10);
        for (let i = 0; i < 4; i++) {
          const a0 = t * rate * 1.6 + i * 1.6;
          ctx.beginPath();
          ctx.arc(p.x + ox + hx, p.y + oy + hy, bsz * 0.40, a0, a0 + 0.9);
          ctx.stroke();
        }
        ctx.restore();

        // MOTION SMEAR. A spinning toothed disc aliases — the teeth strobe and
        // can read as standing still or turning backwards. Ghosting the blade
        // at small angular offsets stops individual teeth resolving, so the
        // speed reads honestly whatever the framerate lands on. Skipped in
        // LITE, where it is the first thing worth dropping.
        const lite = typeof Effects !== 'undefined' && Effects.densityScale < 1;
        if (c.online && !lite) {
          ctx.save();
          for (let i = 1; i <= 2; i++) {
            ctx.globalAlpha = 0.30 / i;
            Assets.sprite(ctx, 'part_saw_blade', p.x + ox + hx, p.y + oy + hy,
                          bsz, bsz, ang + t * rate - i * 0.22, hostile);
          }
          ctx.restore();
        }
        Assets.sprite(ctx, 'part_saw_blade', p.x + ox + hx, p.y + oy + hy,
                      bsz, bsz, ang + t * rate, hostile);
        return;
      }

      if (pt.fireRate) {
        // Weapons RECOIL: the sprite kicks backwards along its own barrel and
        // snaps forward, driven by how recently it fired.
        const since = c.sinceShot === undefined ? 9 : c.sinceShot;
        const kick = Math.max(0, 1 - since / 0.12);
        if (kick > 0) {
          const k = kick * kick;
          ox -= Math.cos(ang) * reach * 0.20 * k;
          oy -= Math.sin(ang) * reach * 0.20 * k;
          size *= 1 + 0.06 * k;                 // slight muzzle bloom
        }
      }

      // `moving` is derived here rather than trusted: nothing was ever
      // setting it, so thrusters never shuddered.
      const speed2 = (ent.vx || 0) * (ent.vx || 0) + (ent.vy || 0) * (ent.vy || 0);
      if (pt.speedAdd && pt.speedAdd > 0 && speed2 > 900) {
        // Thrusters shudder while under power.
        ox += Math.cos(t * 42) * 1.6;
        oy += Math.sin(t * 37) * 1.6;
      }

      if (pt.powerBonus) {
        // Reactors breathe.
        size *= 1 + Math.sin(t * 3.1 + (s.id || 0)) * 0.025;
      }

      if (Assets.sprite(ctx, this.artKey(c.part), p.x + ox, p.y + oy,
                        size, size, ang, hostile, this.paintOf(ent, c.part))) return;
    }
    // AND THE PRIMITIVE FALLBACK IS PAINTED TOO.
    //
    // Standing rule 5: sprites are optional, and every object keeps its
    // Canvas-primitive drawing. A paint job that only appeared on parts that
    // happen to have art would break that — the machine would change colour as
    // the art landed, one part at a time.
    //
    // The whole fallback below reads `part.color`, thirty-odd times across
    // fifteen branches, so the painted part is substituted ONCE here instead.
    const part = this._painted(ent, c.part);
    R.circle(p.x + 5, p.y + 7, part.bodyRadius, 'rgba(0,0,0,0.4)');

    if (part.id === 'saw') {
      R.circle(p.x, p.y, part.bodyRadius * 0.7, CONFIG.COLOR.steel, CONFIG.COLOR.ink, 6);
      ctx.save();
      ctx.translate(c.bladeX ?? p.x, c.bladeY ?? p.y);
      ctx.rotate(c.bladeSpin);
      R.circle(0, 0, part.bladeRadius, part.color, CONFIG.COLOR.ink, 7);
      ctx.fillStyle = CONFIG.COLOR.ink;
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i / 8) * Math.PI * 2);
        ctx.fillRect(part.bladeRadius - 6, -8, 16, 16);
        ctx.restore();
      }
      R.circle(0, 0, 14, CONFIG.COLOR.steel, CONFIG.COLOR.ink, 5);
      ctx.restore();
      return;
    }

    if (part.id === 'mineLayer') {
      // Rear-facing hopper: box + hazard hatch, no turret rotation.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(s.angle);
      R.roundRect(-part.bodyRadius * 0.8, -part.bodyRadius * 0.75,
        part.bodyRadius * 1.6, part.bodyRadius * 1.5, 9, '#6b6420', CONFIG.COLOR.ink, 7);
      R.roundRect(-part.bodyRadius * 0.5, -part.bodyRadius * 0.45,
        part.bodyRadius, part.bodyRadius * 0.9, 6, part.color, CONFIG.COLOR.ink, 5);
      ctx.fillStyle = CONFIG.COLOR.ink;
      ctx.fillRect(-part.bodyRadius * 0.5, -4, part.bodyRadius, 8);
      ctx.restore();
      return;
    }

    if (part.id === 'rocketPod') {
      // Rocket rack rotating toward aim, visible rocket tips (plan §3.3).
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(aimA);
      R.roundRect(-part.bodyRadius * 0.8, -part.bodyRadius * 0.8,
        part.bodyRadius * 1.6, part.bodyRadius * 1.6, 9, '#7a6a1c', CONFIG.COLOR.ink, 7);
      for (let i = 0; i < 4; i++) {
        const yy = -part.bodyRadius * 0.55 + i * (part.bodyRadius * 1.1 / 3);
        R.roundRect(-6, yy - 6, part.bodyRadius * 0.9 + 10, 12, 5,
          CONFIG.COLOR.steel, CONFIG.COLOR.ink, 3);
        R.circle(part.bodyRadius * 0.9 + 6, yy, 7, '#ff3b3b', CONFIG.COLOR.ink, 3);
      }
      ctx.restore();
      return;
    }

    if (part.category === 'power') {
      if (part.id === 'radiator' || part.id === 'heatSink') {
        // Finned block (radiator cools; heat sink stores)
        const base = part.id === 'radiator' ? '#155a6e' : '#5e2a12';
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(s.angle);
        R.roundRect(-part.bodyRadius * 0.7, -part.bodyRadius * 0.8,
          part.bodyRadius * 1.4, part.bodyRadius * 1.6, 8, base, CONFIG.COLOR.ink, 7);
        ctx.strokeStyle = part.color;
        ctx.lineWidth = 6;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 14, -part.bodyRadius * 0.62);
          ctx.lineTo(i * 14, part.bodyRadius * 0.62);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Reactor: glowing coil that pulses (bigReactor simply larger)
        const pulse = 0.75 + Math.sin(c.spin * 3) * 0.25;
        R.circle(p.x, p.y, part.bodyRadius, '#5a4a12', CONFIG.COLOR.ink, 7);
        R.circle(p.x, p.y, part.bodyRadius * 0.62 * pulse, part.color, CONFIG.COLOR.ink, 5);
        R.circle(p.x - 6, p.y - 8, 6, '#ffffff');
      }
      return;
    }

    if (part.category === 'defence') {
      if (part.id === 'directionalShield') {
        // Compact projector; the arc itself draws in _drawShields.
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(s.angle);
        R.roundRect(-part.bodyRadius * 0.7, -part.bodyRadius * 0.6,
          part.bodyRadius * 1.4, part.bodyRadius * 1.2, 8, '#123a4e', CONFIG.COLOR.ink, 7);
        R.circle(part.bodyRadius * 0.35, 0, 11,
          c.shieldHp > 0 ? part.color : '#3a4a5a', CONFIG.COLOR.ink, 4);
        ctx.restore();
        return;
      }
      if (part.id === 'repairArm') {
        // Service block + white cross + little articulated arm
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(s.angle);
        R.roundRect(-part.bodyRadius * 0.75, -part.bodyRadius * 0.7,
          part.bodyRadius * 1.5, part.bodyRadius * 1.4, 8, '#1f4a1f', CONFIG.COLOR.ink, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5, -18, 10, 36);
        ctx.fillRect(-18, -5, 36, 10);
        const wag = Math.sin(c.spin * 1.4) * 0.5;
        ctx.strokeStyle = part.color;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(part.bodyRadius * 0.55, 0);
        ctx.lineTo(part.bodyRadius * 0.55 + Math.cos(wag) * 26,
                   Math.sin(wag) * 26);
        ctx.stroke();
        ctx.restore();
        return;
      }
      // Armour plate / heavy armour: chunky plate facing outward.
      const pw = part.bodyRadius * 0.62;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(s.angle);
      R.roundRect(-pw * 0.45, -part.bodyRadius, pw, part.bodyRadius * 2, 10,
        part.color, CONFIG.COLOR.ink, 8);
      R.roundRect(pw * 0.06, -part.bodyRadius * 0.72, pw * 0.5, part.bodyRadius * 1.44, 8,
        part.id === 'heavyArmour' ? '#3c4a63' : '#5f708f', CONFIG.COLOR.ink, 5);
      if (part.id === 'heavyArmour') {
        ctx.fillStyle = CONFIG.COLOR.ink;
        for (let i = -1; i <= 1; i++) R.circle(-pw * 0.2, i * part.bodyRadius * 0.55, 6, CONFIG.COLOR.ink);
      }
      ctx.restore();
      return;
    }

    if (part.category === 'utility') {
      // Compact chip module, oriented to its socket.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(s.angle);
      R.roundRect(-part.bodyRadius * 0.75, -part.bodyRadius * 0.75,
        part.bodyRadius * 1.5, part.bodyRadius * 1.5, 8, '#20263e', CONFIG.COLOR.ink, 7);
      if (part.id === 'splitter') {
        // Hub with two prongs toward its child sockets
        R.circle(0, 0, part.bodyRadius * 0.42, part.color, CONFIG.COLOR.ink, 5);
        ctx.strokeStyle = part.color;
        ctx.lineWidth = 7;
        for (const off of [-0.5, 0.5]) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(off) * part.bodyRadius * 0.95,
                     Math.sin(off) * part.bodyRadius * 0.95);
          ctx.stroke();
        }
      } else if (part.id === 'targetingModule') {
        R.circle(0, 0, part.bodyRadius * 0.42, null, part.color, 5);
        R.circle(0, 0, 6, part.color);
        ctx.strokeStyle = part.color;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-part.bodyRadius * 0.6, 0); ctx.lineTo(part.bodyRadius * 0.6, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -part.bodyRadius * 0.6); ctx.lineTo(0, part.bodyRadius * 0.6); ctx.stroke();
      } else {
        // Magnet amplifier: horseshoe glyph
        ctx.strokeStyle = part.color;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(0, 0, part.bodyRadius * 0.4, 0.6, Math.PI * 2 - 0.6);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (part.category === 'movement') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(s.angle);
      if (part.id === 'heavyTreads') {
        R.roundRect(-part.bodyRadius * 0.75, -part.bodyRadius * 0.85,
          part.bodyRadius * 1.5, part.bodyRadius * 1.7, 10, '#2c3450', CONFIG.COLOR.ink, 7);
        ctx.fillStyle = part.color;
        for (let i = -2; i <= 2; i++) {
          ctx.fillRect(-part.bodyRadius * 0.55, i * 13 - 4, part.bodyRadius * 1.1, 8);
        }
      } else {
        // Thruster / dash booster: block + outward nozzle + exhaust flicker
        R.roundRect(-part.bodyRadius * 0.7, -part.bodyRadius * 0.6,
          part.bodyRadius * 1.4, part.bodyRadius * 1.2, 8, '#20263e', CONFIG.COLOR.ink, 7);
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.moveTo(part.bodyRadius * 0.5, -part.bodyRadius * 0.45);
        ctx.lineTo(part.bodyRadius * 1.05, 0);
        ctx.lineTo(part.bodyRadius * 0.5, part.bodyRadius * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = CONFIG.COLOR.ink;
        ctx.lineWidth = 5;
        ctx.stroke();
        if (c.online && Math.hypot(ent.vx || 0, ent.vy || 0) > 120) {
          const fl = 12 + Math.random() * 16;
          R.circle(part.bodyRadius * 1.05 + fl * 0.4, 0, fl * 0.5, '#ffd23f');
        }
      }
      ctx.restore();
      return;
    }

    // Generic ranged weapon: body block + barrel rotating toward aim.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(aimA);
    const big = part.id === 'cannon' || part.id === 'railgun';
    R.roundRect(-part.bodyRadius * 0.8, -part.bodyRadius * 0.7,
      part.bodyRadius * 1.6, part.bodyRadius * 1.4, 9, part.color, CONFIG.COLOR.ink, 7);
    if (part.id === 'scattergun') {
      R.roundRect(part.bodyRadius * 0.5, -16, part.barrel, 13, 5,
        CONFIG.COLOR.steel, CONFIG.COLOR.ink, 5);
      R.roundRect(part.bodyRadius * 0.5, 3, part.barrel, 13, 5,
        CONFIG.COLOR.steel, CONFIG.COLOR.ink, 5);
    } else {
      R.roundRect(part.bodyRadius * 0.5, big ? -12 : -8, part.barrel, big ? 24 : 16, 6,
        CONFIG.COLOR.steel, CONFIG.COLOR.ink, 6);
    }
    if (part.id === 'railgun') {
      ctx.strokeStyle = part.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(part.bodyRadius * 0.6, 0);
      ctx.lineTo(part.bodyRadius * 0.5 + part.barrel, 0);
      ctx.stroke();
    }
    R.circle(-part.bodyRadius * 0.15, 0, big ? 12 : 8, '#ffffff', CONFIG.COLOR.ink, 4);
    ctx.restore();
  },

  // Small debug overlay: socket rings + indices (toggled with DBG).
  drawDebug(ctx, ent) {
    for (const s of ent.sockets) {
      const p = this.socketPos(ent, s);
      ctx.globalAlpha = 0.55;
      if (s.comp) {
        R.circle(p.x, p.y, s.comp.part.bodyRadius, null, CONFIG.COLOR.lime, 3);
        const cp = this.connectorPos(ent, s);
        const frac = s.comp.connectorHp / s.comp.maxConnectorHp;
        R.circle(cp.x, cp.y, this.CONNECTOR_R, null,
          frac <= this.RIP_THRESHOLD ? CONFIG.COLOR.red : CONFIG.COLOR.yellow, 3);
        R.text(Math.ceil(frac * 100) + '%', cp.x, cp.y - 40, 22, CONFIG.COLOR.yellow);
      } else {
        R.circle(p.x, p.y, 34, null, CONFIG.COLOR.steel, 4);
        R.text(String(s.id + 1), p.x, p.y, 26, CONFIG.COLOR.steel);
      }
      ctx.globalAlpha = 1;
    }
  },
};

// ---------------------------------------------------------------------------
class Component {
  constructor(partId) {
    this.part = PARTS[partId];
    this.hp = this.part.hp;
    this.maxHp = this.part.hp;
    this.connectorHp = this.part.connectorHp;
    this.maxConnectorHp = this.part.connectorHp;
    this.cooldown = 0;
    this.online = undefined;      // set by recalcPower on attach
    this.order = 0;
    this.bladeSpin = Math.random() * 6;
    this.spin = Math.random() * 6;
    this.bladeX = 0;
    this.bladeY = 0;
    if (this.part.shieldValue) {  // Directional Shield state (M12)
      this.shieldHp = this.part.shieldValue;
      this.shieldHit = 999;
    }
    if (this.part.barrierValue) { // Barrier Projector state
      this.barrierHp = this.part.barrierValue;
      this.barrierHit = 999;
    }
    this._reactiveT = 0;          // Reactive Armour: 0 = charged
    this._reflectCd = 0;          // Reflector Plate lockout
    this._ventCd = 0;             // Emergency Vent cooldown
    this._forcedOffT = 0;         // Capacitor blackout after an overheat
    this._pdCd = 0;               // Point Defence intercept timer
    this._drones = null;          // Drone Bay flight, built on first update
    this._autoClaimed = false;    // taken over by an Auto-Turret Controller
    this._autoBy = null;
    this._autoAim = undefined;
    this.beamOn = false;          // Beam Laser state (M12)
    this.beamX0 = 0; this.beamY0 = 0;
    this.beamEndX = 0; this.beamEndY = 0;
    this.childIds = null;         // Splitter child socket ids (M12)
  }
}

// SCRAPCORE: BREAKLANDS — Player Core (Milestone 4)
// The Scrapper Core: position, velocity with accel/decel, collision radius,
// aim direction independent of movement, base stats from the game plan.
// Sockets/attachments arrive in Milestone 6; weapons in Milestone 5.

class PlayerCore {
  // chassisId picks the base stats (plan §8). Defaults to Scrapper so every
  // existing test and the dev arena keep working unchanged.
  constructor(x, y, chassisId = 'scrapper') {
    const C = (typeof CHASSIS !== 'undefined' && CHASSIS[chassisId]) || null;
    this.chassisId = C ? chassisId : 'scrapper';
    this.hp = C ? C.hp : 100;
    this.maxHp = this.hp;
    this.power = C ? C.power : 10;
    this.heat = 0;
    this.baseHeatCap = 100;     // Heat Sink raises heatCap via recalcStats
    this.heatCap = 100;
    this.cooling = 10;          // heat/sec (used from Milestone 9)
    this.sinceDamage = 999;     // Repair Arm idle timer (plan §34)
    this.charge = 0;            // CORE CHARGE (M12, Master §20)
    this.special = null;        // the live Special, if any
    this._chargeBank = 0;
    this._backblastT = 0;

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 62;

    // Raised from 540 after the arena size pass: the enlarged Scrap Yard made
    // the old base speed feel sluggish before any movement parts were found.
    // DIFFICULTY DOES NOT CHANGE HOW BIG THE WORLD IS.
    //
    // This was `* Profile.difficultyData.spd`, and NORMAL's spd is 0.95 — so
    // the machine ran at 608 u/s while WORLD_SCALE, every district size, every
    // garage placement and every towing time in the design were derived from
    // 640. The tracker said 640 and the game did 608, and the reason nobody
    // could tell which was wrong is that both were: the number was right and
    // the multiplication should not have been there.
    //
    // In WRECKJACK slowing the player was a fair difficulty lever, because an
    // arena is one screen. Here it silently RESIZES THE CONTINENT: on
    // OVERDRIVE (0.85) the drive home from a far corner is 18% longer than the
    // number the world was laid out against, and "90 seconds to 2.5 minutes"
    // is only true on EASY.
    //
    // Difficulty still bites four other ways, all of them about the machines
    // rather than the map: enemy `hp`, the `dmg` you take, the Director's spawn
    // budget `mul`, and power-cell `cell`. `spd` was the fifth and the only one
    // that touched traversal, and it is gone from the table as well as from
    // here — dead data left in place is the next person's wrong assumption.
    this.baseMaxSpeed = (C ? C.speed : 640);          // movement parts modify it
    this.maxSpeed = this.baseMaxSpeed;
    // REINFORCED: more Core health. Applied where maxHp is first set, so a
    // machine built after taking the skill is built with it.
    if (typeof Skills !== 'undefined') {
      const hm = Skills.mul('hpMul');
      if (hm !== 1) { this.maxHp = Math.round(this.maxHp * hm); this.hp = this.maxHp; }
    }
    this.cellPower = 0;         // power collected from destroyed machines
    this.assistMul = 1;         // comeback assist, set by GameState
    this.isPlayer = true;        // firmware (M14) only applies to the player
    this.baseMaxHp = this.maxHp; // PLATING levels raise maxHp from this base
    this.damageMul = 1;
    this.fireRateMul = 1;
    this.lastSparkMul = 1;
    this.coolingMul = 1;
    this.coreDamageMul = 1;
    this._lastCircuitT = 0;      // §23 LAST CIRCUIT's live 3s window
    this.connectorHpMul = 1;
    this.accelRate = 10;        // exponential approach factor
    this.decelRate = 14;

    // Dash (Milestone 9, plan §27) — Scrapper baseline
    this.baseDashCd = C ? C.dashCd : 2.8;    // Dash Booster modifies this
    this.dashCdMax = this.baseDashCd;
    this.dashCd = 0;
    this.dashT = 0;             // active dash burst window
    this.invulnT = 0;           // brief hit-forgiveness at dash start
    this.lastMoveX = 1;
    this.lastMoveY = 0;
    this.overheated = false;
    this.alive = true;
    this.flash = 0;

    this.aimX = 1;              // facing/aim direction (unit vector),
    this.aimY = 0;              // fully independent of movement

    Machine.initSockets(this, 8);   // Milestone 6: eight root sockets
  }

  update(dt, arena, obstacles) {
    // --- movement input: touch stick, with WASD desktop fallback ---
    let ix = Controls.move.dx * Controls.move.mag;
    let iy = Controls.move.dy * Controls.move.mag;
    if (ix === 0 && iy === 0 && (DebugKeys.x || DebugKeys.y)) {
      ix = DebugKeys.x; iy = DebugKeys.y;
    }

    if (ix || iy) {
      const l = Math.hypot(ix, iy) || 1;
      this.lastMoveX = ix / l;
      this.lastMoveY = iy / l;
    }

    // Accel toward target velocity; decel when input released.
    // During a dash burst the impulse carries instead of being steered away.
    // Movement parts (Thruster / Heavy Treads / heavy plating) modify speed.
    // Firmware that depends on live state (REDLINE / LAST SPARK), M14.
    // §12 Load bands multiply movement on top of everything else — weight is
    // not a stat effect, it is physics, so nothing can buy it off.
    // M12 dynamic movement: HOT ROD (heat), BACKBLAST window — per-frame
    // factors that cannot live in recalcStats.
    const modSpeed = (typeof Mods !== 'undefined') ? Mods.dynamicSpeedMul(this) : 1;
    // Boss/hazard slow fields (Bailiff LOCKDOWN §26A, Crown Gate LOCK ZONE
    // §26B) refresh _fieldSlowT every frame the player is inside; it decays
    // here so leaving the field is the whole counter-play.
    this._fieldSlowT = Math.max(0, (this._fieldSlowT || 0) - dt);
    const fieldSlow = this._fieldSlowT > 0 ? (this._fieldSlowMul || 1) : 1;
    // BOREMAW DRILL (§22): -20% while the blade is engaged (the grinder
    // refreshes the window every contact frame).
    this._grindSlowT = Math.max(0, (this._grindSlowT || 0) - dt);
    const grindSlow = this._grindSlowT > 0 ? (this._grindSlowMul || 1) : 1;
    // BLOCK 6.1: towing is a real handling penalty, applied HERE where the
    // speed is actually decided, so the garage's quoted number and what the
    // machine does cannot disagree. A big chassis is a commitment.
    const towMul = (typeof Tow !== 'undefined') ? Tow.speedMul(this) : 1;
    // BLOCK 7: the CHEETAH's sprint. Passive, and only out in the open — a
    // rig that exists to make the map crossable should not turn every fight
    // into a chase.
    const rigMul = (typeof Rigs !== 'undefined') ? Rigs.speedMul(this) : 1;
    // THE OPEN WORLD'S OWN TWO MOVE MODULES, both read here for the same
    // reason towing is: this is where the speed is actually decided, so the
    // garage's quoted number and what the machine does cannot disagree.
    //
    // FUEL CELL: "+25% out of combat. Does nothing in a fight." The first part
    // in the game that only matters because the world is big — and the first
    // one that reads `inCombat`, which until now was checked by the Cheetah
    // and set by nobody.
    //
    // RUGGED TREADS: -15% everywhere, and (in Terrain) nothing slows it on bad
    // ground. Slower everywhere, faster where it is bad — a real trade, which
    // only reads as one if the -15% is always on.
    let modMove = 1;
    if (typeof Modules !== 'undefined') {
      modMove = Modules.mul(this, 'speedMul');
      // Scaled by how far out of the fight you are (Population.think writes
      // calmK), so the bonus arrives over a second and a half, not in a frame.
      const calm = this.calmK !== undefined ? this.calmK : (this.inCombat ? 0 : 1);
      modMove *= 1 + Modules.sum(this, 'outOfCombatSpeed') * calm;
    }
    // SECOND WIND's burst, and HARD SHUTDOWN's absence. Both read here for the
    // same reason towing and the rigs do: this is where the speed is decided.
    //
    // A heat lockout used to cost nothing but your guns, which made HARD
    // SHUTDOWN R2 ("you retain steering") a rank with nothing to give back. So
    // an overheat now DRAGS — you keep moving, sluggishly — and the rank
    // removes the drag. A hard stop would have been the other reading of the
    // doc and it is the wrong one: taking control away from the player to sell
    // a skill that gives it back is not a trade, it is a toll.
    let heatDrag = 1;
    if (this.overheated && !(typeof Skills !== 'undefined' &&
        Skills.has('steerThrough'))) {
      heatDrag = PlayerCore.OVERHEAT_DRAG;
    }
    const sw = (typeof SecondWind !== 'undefined') ? SecondWind.speedMul(this) : 1;
    // FIELD WORKSHOP holds you still while it runs. Zero, not slow: the cost
    // of changing your build in the open is that for those seconds you are
    // not going anywhere, and a machine that could still crawl away would
    // make that no cost at all.
    const work = ((this._fieldT || 0) > 0) ? 0 : 1;
    // HITCHED TO A TRAIN the stick is on the coupling bar, not the wheels:
    // RailHitch pins the position and the stick's x counters the needle.
    // Zero here so the machine cannot also crawl off the flatbed.
    const hitched = (typeof RailHitch !== 'undefined' && RailHitch.train) ? 0 : 1;
    this.maxSpeed = rigMul * towMul * modMove * modSpeed * this.baseMaxSpeed * (this.speedMul || 1) *
      (this.lastSparkMul || 1) * this._loadMove() * fieldSlow *
      grindSlow * heatDrag * sw * work * hitched;

    // ZOOM COMPENSATION. The camera pulls back as the rig grows (1.0 -> 0.72),
    // which makes the SAME world speed cover fewer pixels per second — measured
    // at ~60% of the starting feel by the time a machine is full. Players read
    // that as "the machine got slower while I was playing", because on a phone
    // the only speed you can feel is the on-screen one. Scaling by 1/zoom keeps
    // pixels-per-second constant, so movement feels identical from the first
    // fight to the last. Set PlayerCore.ZOOM_COMPENSATION to 0 to disable.
    const z = (typeof Camera !== 'undefined' && Camera.zoom) ? Camera.zoom : 1;
    if (z > 0 && PlayerCore.ZOOM_COMPENSATION > 0) {
      const full = 1 / z;
      this.maxSpeed *= 1 + (full - 1) * PlayerCore.ZOOM_COMPENSATION;
    }
    this.moving = Math.hypot(this.vx, this.vy) > 60;   // thruster shudder
    this.sinceDamage += dt;

    if (this.dashT <= 0) {
      const tx = ix * this.maxSpeed;
      const ty = iy * this.maxSpeed * PlayerCore.VERTICAL_TRIM;
      // BLOCK 6.1's OTHER HALF (D351). `TOW.TURN_PER_WEIGHT` and
      // `Tow.turnMul` -- "handling: a big chassis is a real commitment" --
      // were written with speedMul and never read: the speed dropped and the
      // machine still re-aimed on a sixpence. A twin-stick machine turns by
      // how fast its velocity chases the stick, which is this rate, so the
      // turn penalty lands here: a MAMMOTH chassis on the line makes every
      // change of direction sluggish, not just slow.
      const towTurn = (typeof Tow !== 'undefined') ? Tow.turnMul(this) : 1;
      const rate = ((ix || iy) ? this.accelRate : this.decelRate) * towTurn;
      const k = 1 - Math.exp(-rate * dt);
      this.vx += (tx - this.vx) * k;
      this.vy += (ty - this.vy) * k;
    }

    // Timers
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dashT = Math.max(0, this.dashT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    // §23 LAST CIRCUIT's 3s window ages with the other run timers.
    this._lastCircuitT = Math.max(0, (this._lastCircuitT || 0) - dt);
    if (this.dashT > 0 && Math.random() < dt * 40) {
      Effects.spark(this.x - this.vx * 0.03, this.y - this.vy * 0.03,
        Math.atan2(-this.vy, -this.vx), 1, CONFIG.COLOR.cyan, 200);
    }

    this._updateHeat(dt);
    this._updateMods(dt);
    // SECOND WIND is edge-triggered on CROSSING a quarter health, so it has to
    // be asked every frame rather than at the moment of damage — you can cross
    // the line by gaining max HP as easily as by losing health.
    if (typeof SecondWind !== 'undefined') SecondWind.update(dt, this);
    this._updateRegen(dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // --- aim: right stick sets facing; keep last direction on release ---
    if (Controls.aim.mag > 0) {
      this.aimX = Controls.aim.dx;
      this.aimY = Controls.aim.dy;
      // Aim assist nudges toward what you are already pointing at (plan §20).
      // Applied to the WEAPON aim only; rawAimX/Y keeps the stick's true
      // direction so the Dash never gets steered somewhere you did not ask.
      this.rawAimX = this.aimX; this.rawAimY = this.aimY;
      if (typeof AimAssist !== 'undefined' && this._assistTargets) {
        const a = AimAssist.apply(this, this._assistTargets, this.aimX, this.aimY, dt);
        this.aimX = a.x; this.aimY = a.y;
      }
    } else if (Math.hypot(this.vx, this.vy) > 40 && !Controls.firing) {
      // Idle nicety: drift facing toward movement when not aiming.
      const len = Math.hypot(this.vx, this.vy);
      const kf = 1 - Math.exp(-4 * dt);
      this.aimX += (this.vx / len - this.aimX) * kf;
      this.aimY += (this.vy / len - this.aimY) * kf;
      const al = Math.hypot(this.aimX, this.aimY) || 1;
      this.aimX /= al; this.aimY /= al;
    }

    this.flash = Math.max(0, this.flash - dt);
    this._collide(arena, obstacles);
  }

  // Incoming fire (Milestone 10). Dash grants brief hit-forgiveness on
  // the Core only — mounted parts can still be shot off mid-dash.
  // WORKHORSE: "weight penalty reduced". The penalty, not the multiplier -
  // halving a 0.7 multiplier makes a heavy machine SLOWER, which is the sum
  // TOLERANT MOUNTS taught this project not to write (D239).
  _loadMove() {
    const raw = this.loadMoveMul || 1;
    if (typeof Skills === 'undefined' || raw >= 1) return raw;
    const k = Skills.mul('weightPenaltyMul');
    return 1 - (1 - raw) * k;
  }

  takeCoreDamage(dmg, hx, hy, isSaw) {
    if (!this.alive) return;
    if (this.invulnT > 0) {
      Effects.spark(hx, hy, 0, 2, CONFIG.COLOR.cyan, 300);
      return;
    }
    // CORE PLATING firmware, then the difficulty's damage scale (EASY 0.6x,
    // OVERDRIVE 1.35x). Difficulty changing only the enemy COUNT was not much
    // of a difficulty setting.
    const diff = (typeof Profile !== 'undefined' && Profile.difficultyData &&
      Profile.difficultyData.dmg) || 1;
    // FORTRESS REACTOR ranks (M12): resistance while crawling.
    const slow = (typeof Mods !== 'undefined') ? Mods.slowResistMul(this) : 1;
    // THE SKILLS THAT REDUCE WHAT REACHES YOU, at the one entry every damage
    // source in the game comes through. `cause` says where it came from, so
    // HARD HAT can be about hazards without being about everything.
    let net = dmg * (this.coreDamageMul || 1) * slow * diff * (this.assistMul || 1);
    if (typeof Skills !== 'undefined') {
      net *= Skills.mul('coreDamageMul');
      // HARD HAT is about HAZARDS, not about everything - `cause` is what
      // lets one skill be about one kind of damage.
      if (arguments[4] === 'hazard' || arguments[4] === 'blast') net *= Skills.mul('hazardDamageMul');
    }
    // SECOND WIND's resistance half. Same entry point as everything else that
    // reduces what reaches you, so it cannot be routed around by a damage
    // source that forgot about it.
    if (typeof SecondWind !== 'undefined') net *= SecondWind.damageMul(this);
    // §30 ABLATIVE LOGIC / HOT SWAP MKII: a temporary Core shield eats the
    // hit first. One place, so every damage source obeys it.
    if (this.coreShield > 0) {
      const eaten = Math.min(this.coreShield, net);
      this.coreShield -= eaten;
      net -= eaten;
      if (typeof Effects !== 'undefined') {
        Effects.ring(this.x, this.y, this.radius + 40, CONFIG.COLOR.cyan);
      }
    }
    this.hp -= net;
    if (typeof Unlocks !== 'undefined') Unlocks.event('coreDamage', { amount: dmg });
    this.flash = 0.12;
    this.sinceDamage = 0;       // Repair Arm waits after any Core hit
    // Brief post-hit grace caps burst intake so one volley can't melt the
    // Core — saw grinding does not refresh it.
    if (!isSaw) this.invulnT = Math.max(this.invulnT, 0.15);
    Effects.damageNumber(hx, hy - 60, dmg);
    Effects.spark(hx, hy, Math.atan2(hy - this.y, hx - this.x), 4, '#ff5c7a');
    Camera.shake(3, 0.1);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(18);
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  // Dash: burst toward where the guns point — right-stick aim direction.
  // (Design change from plan §27: aim-directed, not movement-directed.)
  tryDash() {
    if (this.dashCd > 0) return false;
    let dx = Controls.aim.mag > 0 ? Controls.aim.dx : this.aimX;
    let dy = Controls.aim.mag > 0 ? Controls.aim.dy : this.aimY;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    // §12: an overloaded machine dashes shorter, too.
    const boost = (this.dashPowerMul || 1) * (this.loadDashMul || 1);
    this.vx = dx * PlayerCore.DASH_SPEED * boost;
    this.vy = dy * PlayerCore.DASH_SPEED * boost;
    this.dashCdMax = this.baseDashCd * (this.dashCdMul || 1);
    // REDLINE (M12): the Dash cooldown becomes a fixed 0.45s while it runs —
    // and near nothing with the AFTERBURNER specialization.
    if (typeof Mods !== 'undefined' && Mods.sp(this, 'redline')) {
      this.dashCdMax = Mods.final(this) === 'afterburner' ? 0.1 : 0.45;
    }
    this.dashCd = this.dashCdMax;
    this.dashT = PlayerCore.DASH_TIME * Math.sqrt(boost);
    // §30 DASH.EXE MKII opens a 1.5s fire-rate window here, at the dash.
    this.invulnT = 0.12;        // early hit-forgiveness only, not full immunity
    Effects.ring(this.x, this.y, 70, CONFIG.COLOR.cyan);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(16);
    return true;
  }

  // Core Charge, Special timer and Mod windows tick with the machine (M12).
  _updateMods(dt) {
    if (typeof Mods !== 'undefined') Mods.update(dt, this);
  }

  // ---- OUT-OF-COMBAT REGEN ------------------------------------------------
  // FIELD REPAIR is "out-of-combat health regeneration rate, +30/60/90%", and
  // there was nothing to be a percentage OF: the only healing in the game came
  // off a Repair Arm, and a machine with no Repair Arm crossed forty thousand
  // units of Barrens at whatever health it left the last fight on.
  //
  // That is fine for an arena and wrong for an open world, where most of the
  // clock is driving. So there is a slow base trickle, and the skill is a
  // multiplier on it. Deliberately slow: at 1.2%/s a full heal is about eighty
  // seconds of NOT fighting, which is a real drive. It must never be quicker
  // than going to a garage, or the garage stops being a place you go.
  _updateRegen(dt) {
    if (!this.alive || this.hp <= 0 || !this.maxHp) return;
    if (this.hp >= this.maxHp) return;
    if (this.inCombat) return;
    if (this.sinceDamage < PlayerCore.REGEN_DELAY) return;
    let rate = PlayerCore.REGEN_FRAC * this.maxHp;
    if (typeof Skills !== 'undefined') rate *= Skills.mul('regenMul');
    this.hp = Math.min(this.maxHp, this.hp + rate * dt);
  }

  // Heat + overheat state machine (plan §25).
  _updateHeat(dt) {
    // Threshold check BEFORE cooling: firing clamps heat at exactly the cap,
    // so checking after this frame's cooling would never see it.
    // SIGNATURE #4's FIRST event: "a strain that builds over the last 20% of
    // the bar". Edge-triggered on crossing 80%, because a sound that plays
    // for every frame you are hot is an alarm, and an alarm is something you
    // learn to stop hearing.
    if (!this.overheated) {
      const hot = this.heat >= this.heatCap * 0.8;
      if (hot && !this._heatWarned && typeof Audio_ !== 'undefined') {
        Audio_.play('heatWarning');
      }
      this._heatWarned = hot;
    }
    if (!this.overheated && this.heat >= this.heatCap - 0.01) {
      this.overheated = true;
      if (typeof Unlocks !== 'undefined') Unlocks.event('overheat');
      // SIGNATURE #4. The CUT, which is its own sound: a hard mechanical
      // stop, not the same rising tone that warned you it was coming.
      if (typeof Audio_ !== 'undefined') Audio_.play('heatCut');
      Effects.comicWord('OVERHEAT!', this.x, this.y - 170, CONFIG.COLOR.orange, 110);
      Effects.ring(this.x, this.y, 130, '#ff3b3b');
      Camera.shake(6, 0.22);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 40, 40]);
      // Parts that react to an overheat get told the moment it happens, not
      // a frame later: the Emergency Vent dumps 30 Heat and the Capacitor
      // falls off the grid. Called BEFORE this frame's cooling, so the vent
      // actually shortens the lockout instead of arriving after it.
      Machine.onOverheat(this);
    }

    let cooling = this.cooling;
    for (const s of this.sockets) {
      if (s.comp && s.comp.online && s.comp.part.coolingBonus) {
        cooling += s.comp.part.coolingBonus;
      }
    }
    // COOLANT LOOP firmware boosts both normal and vent cooling.
    // Crucible SMELT FIELD (§26A): cooling -60% while the aura holds you —
    // refreshed by the boss each frame, decays here.
    this._coolCutT = Math.max(0, (this._coolCutT || 0) - dt);
    const coolCut = this._coolCutT > 0 ? (this._coolCutMul || 1) : 1;
    const coolRate = (this.overheated ? 42 : cooling) * (this.coolingMul || 1) *
      coolCut;
    this.heat = Math.max(0, this.heat - coolRate * dt);
    if (this.overheated) {
      // Venting smoke while locked out
      if (Math.random() < dt * 14) {
        Effects.spark(this.x + (Math.random() - 0.5) * 60,
          this.y + (Math.random() - 0.5) * 60, -Math.PI / 2, 1, '#8fa3c8', 140);
      }
      // HARD SHUTDOWN: "-35% / -60% shutdown time." The lockout's length is
      // the distance from the cap down to this threshold at a fixed cool rate,
      // so shortening it means RAISING the threshold — which keeps one number
      // (42/s) describing how fast a machine sheds heat while cut out, instead
      // of two numbers that could drift apart.
      let resume = PlayerCore.OVERHEAT_RESUME;
      if (typeof Skills !== 'undefined') {
        const k = Skills.mul('shutdownMul');
        if (k !== 1) resume = this.heatCap - (this.heatCap - resume) * k;
      }
      if (this.heat <= resume) {
        this.overheated = false;
        Effects.comicWord('ONLINE!', this.x, this.y - 150);
        // SIGNATURE #4's third event: "a distinct READY-TONE - start firing
        // again WITHOUT LOOKING AT THE HUD". Which is a brief for a sound
        // that is not like anything else in the library, and is why it is
        // the only clean rising interval in it.
        if (typeof Audio_ !== 'undefined') Audio_.play('heatReady');
      }
    }
  }

  _collide(arena, obstacles) {
    const r = this.radius;

    // Arena bounds — the Core can never escape.
    if (this.x < arena.x + r) { this.x = arena.x + r; this.vx = Math.max(0, this.vx); }
    if (this.x > arena.x + arena.w - r) { this.x = arena.x + arena.w - r; this.vx = Math.min(0, this.vx); }
    if (this.y < arena.y + r) { this.y = arena.y + r; this.vy = Math.max(0, this.vy); }
    if (this.y > arena.y + arena.h - r) { this.y = arena.y + arena.h - r; this.vy = Math.min(0, this.vy); }

    // Obstacles: circles (pillars) and AABBs (barriers) — plan §76.
    for (const o of obstacles) {
      if (o.type === 'pillar') {
        const dx = this.x - o.x, dy = this.y - o.y;
        const d = Math.hypot(dx, dy);
        const min = r + o.r;
        if (d < min && d > 0.0001) {
          const push = (min - d);
          this.x += dx / d * push;
          this.y += dy / d * push;
        }
      } else if (o.w && o.h) {
        // ANYTHING WITH AN AABB - a wall, and since item 1 a building too.
        // Widened from `o.type === 'wall'` rather than adding a second
        // branch, because a second branch is a second thing to forget.
        // Closest point on rect to circle centre.
        const cx = Math.min(Math.max(this.x, o.x), o.x + o.w);
        const cy = Math.min(Math.max(this.y, o.y), o.y + o.h);
        const dx = this.x - cx, dy = this.y - cy;
        const d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 0.0001) {
            this.x += dx / d * (r - d);
            this.y += dy / d * (r - d);
          } else {
            this.y = o.y - r; // degenerate: centre inside rect, push up
          }
        }
      }
    }
  }

  draw(ctx) {
    const a = Math.atan2(this.aimY, this.aimX);

    // Shadow
    R.circle(this.x + 8, this.y + 10, this.radius, 'rgba(0,0,0,0.45)');

    // THE VEHICLE UNDER THE MACHINE. BUILD BIBLE, "THE TWO LAYERS": the
    // machine you are always in docks into a bigger vehicle, and the first
    // three vehicles have art (D340: mammoth, crab, hauler -- set id IS the
    // rig id, which is why the machine sets took `machine_` in D335). Drawn
    // under the machine at the size its own meta records, facing the way
    // the body faces, in the vehicle's own paint. A rig with no set yet
    // draws nothing here and the machine stands alone, as before.
    if (this.rigId && typeof Sprites44 !== 'undefined' && Sprites44.has(this.rigId)
        && typeof Assets !== 'undefined' && this.flash <= 0) {
      const vw = Sprites44.worldSize(this.rigId);
      const vpaint = (typeof Paint !== 'undefined' && Paint.slot) ? Paint.slot(this.rigId, 'body') : null;
      Assets.sprite(R.ctx, this.rigId, this.x, this.y, vw, vw,
        Sprites44.bodyAngleFor(this.rigId, this), false, vpaint);
    }

    // Core body — candy orange with thick ink outline (flashes white on hit)
    // Palette is cosmetic and applies to the PLAYER's Core only — enemies own
    // red/pink and hazards own red/white (§19), so tinting anything else would
    // trade readability for flair.
    const pal = (typeof Profile !== 'undefined' && Profile.paletteData)
      ? Profile.paletteData : null;
    const bodyCol = this.flash > 0 ? '#ffffff'
      : ((pal && pal.body) || CONFIG.COLOR.orange);
    // The machine's own model, if one exists for this Jackrig and Frame stage
    // (see FRAME_ART_STAGE). Until those are made, this falls through to ZERO's
    // core sprite, which is why the Bare Jackal currently looks like a Scrapper.
    let coreKey = 'core_' + (this.chassisId || 'scrapper');
    if (typeof Frames !== 'undefined' && this.jackrigId && this.frameId
        && typeof Sprites44 !== 'undefined' && typeof Iso !== 'undefined'
        && Iso.use44) {
      const set = Frames.artSet(this.jackrigId, this.frameId);
      if (Sprites44.has(set)) coreKey = set;
    }
    // HOW BIG IS THE CORE?
    //
    // `radius * 2.5` is ZERO's number, and it was right there: a ZERO core is
    // modelled at reach 62, exactly the collision radius. The Jackal is not —
    // Bare is modelled at 75 and Wreckjack at 105, because a Jackrig model is
    // the whole machine including its socket ring, while the collision stays
    // the body. Asking for 155 when the model wants 233 draws the Wreckjack
    // Core at two thirds scale, and the modules around it then look too big.
    //
    // So the size comes from the set's OWN recorded reach when there is one,
    // and falls back to ZERO's number when there is not — which keeps every
    // ZERO core drawing exactly as it always did.
    //
    // Aaron compared both in a real fight and kept this one. It is not a
    // tuning constant: `worldSize` is derived from what the model was actually
    // built at, so a future Jackrig gets the right size without anyone
    // choosing a number for it.
    let coreSize = this.radius * 2.5;
    if (typeof Sprites44 !== 'undefined') {
      const w = Sprites44.worldSize(coreKey);
      if (w > 0) coreSize = w;
    }
    const coreArt = this.flash <= 0 && typeof Assets !== 'undefined' &&
      Assets.sprite(R.ctx, coreKey, this.x, this.y,
        coreSize, coreSize,
        (typeof Sprites44 !== 'undefined')
          ? Sprites44.bodyAngleFor(coreKey, this) : 0);
    if (!coreArt)
    R.circle(this.x, this.y, this.radius, bodyCol, CONFIG.COLOR.ink, 9);

    // Emergency blaster barrel showing aim direction (plan §16)
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    R.roundRect(this.radius - 14, -13, 46, 26, 8, CONFIG.COLOR.steel, CONFIG.COLOR.ink, 6);
    ctx.restore();

    // Player marker — a reactor ring rather than a flat dot. It has to be
    // findable at a glance in a busy fight, so it MOVES: the ring pulses and a
    // sweep rotates inside it, which the eye catches even among 12 machines.
    const accent = (pal && pal.glow) || CONFIG.COLOR.yellow;
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    const pulse = 1 + Math.sin(t * 3.4) * 0.06;

    ctx.save();
    ctx.translate(this.x, this.y);

    // soft halo so the Core reads against a busy floor
    ctx.globalAlpha = 0.22 + Math.sin(t * 3.4) * 0.05;
    R.circle(0, 0, 40 * pulse, accent);
    ctx.globalAlpha = 1;

    // the ring itself
    R.circle(0, 0, 25 * pulse, 'rgba(0,0,0,0)', CONFIG.COLOR.ink, 8);
    R.circle(0, 0, 25 * pulse, 'rgba(0,0,0,0)', accent, 5);

    // rotating sweep inside it
    ctx.save();
    ctx.rotate(t * 1.7);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 0.75);
    ctx.stroke();
    ctx.restore();

    // heart
    R.circle(0, 0, 7, '#ffffff', CONFIG.COLOR.ink, 3);
    ctx.restore();

  }
}

// How much of the camera's zoom-out to give back as movement speed.
// 1 = on-screen speed is constant no matter how big the rig gets.
PlayerCore.ZOOM_COMPENSATION = 1;

// Vertical speed trim. The screen is far wider than tall, so vertical travel
// eats the view much faster at identical speed. 1 = perfectly isotropic.
// Keep this close to 1: it is a feel correction, not a movement rule.
PlayerCore.VERTICAL_TRIM = 0.88;

// What an overheat costs you besides your guns. A DRAG, not a stop — you can
// still get out of the way, badly. HARD SHUTDOWN rank 2 removes it entirely,
// which is what makes "you retain steering" a thing you can feel.
PlayerCore.OVERHEAT_DRAG = 0.55;

// The heat you have to come back down to before the machine is yours again.
// Was a bare 45 inside the heat loop; named because HARD SHUTDOWN moves it.
PlayerCore.OVERHEAT_RESUME = 45;

// The open world's slow trickle. See _updateRegen: it exists so FIELD REPAIR
// has something to be a percentage of, and it is set below the speed at which
// walking back to a garage stops being worth it.
PlayerCore.REGEN_FRAC = 0.012;    // of max HP per second
PlayerCore.REGEN_DELAY = 6;       // seconds since the last hit

// Dash burst. Reach is SPEED x TIME: 1550 x 0.16 covered only ~248 units,
// which barely cleared the player's own rig, so a dash could not break away
// from anything. 1900 x 0.20 is ~380.
PlayerCore.DASH_SPEED = 1900;
PlayerCore.DASH_TIME = 0.20;

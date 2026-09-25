// SCRAPCORE: BREAKLANDS — Repair cells (health pickups)
//
// A run is 25 fights long and HP only came back +5 on an encounter clear, so a
// bad opening fight followed you for the whole zone with nothing you could do
// about it. Repair cells give the player something to CHASE mid-fight.
//
// Two deliberate design choices:
//  1. The drop chance rises as the player gets hurt. A cell dropped at full HP
//     is wasted, and a player at 15% needs one NOW. This is a mercy curve, not
//     a random sprinkle — it makes a comeback possible without making a healthy
//     player drown in pickups.
//  2. They are collected by TOUCH, with a gentle drift toward a close player.
//     The Magnet is the game's signature verb and belongs to parts; making
//     health compete for it would muddy both.
const Pickups = {
  MAX: 6,                 // pooled like everything else (plan §75)
  // Master §12: heal = max(30 HP, 20% of CURRENT max Core HP). Flat 30 was
  // ZERO's number; on a forged 150-HP Wreckjack it had shrunk to a fifth of
  // the §12 promise. The floor keeps early-game cells meaningful.
  HEAL_MIN: 30,
  HEAL_FRAC: 0.20,
  healFor(player) {
    const m = (player && player.maxHp) || 0;
    return Math.max(this.HEAL_MIN, Math.round(m * this.HEAL_FRAC));
  },
  LIFETIME: 14,           // seconds before it fizzles
  BLINK_AT: 4,            // starts flashing this long before it goes
  ATTRACT: 230,           // drifts to the player inside this
  ATTRACT_SPEED: 620,
  RADIUS: 26,

  // Chance a destroyed machine drops one, by how hurt the player is.
  CHANCE_HEALTHY: 0.07,
  CHANCE_HURT: 0.42,

  // --- POWER CELLS ------------------------------------------------------
  // Power used to be a fixed budget, so a part you could not power when you
  // bolted it on was dead for the whole run. Machines now drop power cells,
  // and a REACTOR doubles what each one is worth — so reactors stay the way
  // to run a heavy rig, they are just no longer the only way.
  POWER_PER_CELL: 1,
  // Master §11: base Field Power cap is +12. Asked for through powerCap()
  // rather than read directly, so one rule covers every call site.
  POWER_CAP: 12,

  // Master §11 need-driven drop chances. NOT health-driven: Field Power is a
  // fix for a power problem, so it arrives when there IS a power problem. A
  // rig running fine still banks the occasional cell for a future refit.
  CHANCE_POWER_NONE_OFF: 0.05,
  CHANCE_POWER_ONE_OFF: 0.45,
  CHANCE_POWER_MANY_OFF: 0.75,

  items: [],

  init() { this.items = []; },

  // 0 at full HP, 1 at death's door.
  _need(player) {
    if (!player || !player.maxHp) return 0;
    const frac = Math.max(0, Math.min(1, player.hp / player.maxHp));
    return 1 - frac;
  },

  // How much power the player is SHORT — 0 when everything runs.
  _shortfall(player) {
    if (!player || !player.sockets) return 0;
    let need = 0;
    for (const s of player.sockets) {
      if (s.comp && s.comp.online === false) {
        need += Machine.powerCostOf(player, s.comp);
      }
    }
    return need;
  },

  // Harder tiers drop FEWER cells, so power has to be rationed — but never so
  // few that a rig cannot be lit at all.
  cellFactor() {
    if (typeof Profile === 'undefined' || !Profile.difficultyData) return 1;
    const c = Profile.difficultyData.cell;
    return (typeof c === 'number' && c > 0) ? c : 1;
  },

  // The live Field Power ceiling. One place, so the cap can never be respected
  // in one code path and ignored in another.
  powerCap(player) {
    return this.POWER_CAP;
  },

  // How many powered modules are dark right now.
  _offlineCount(player) {
    if (!player || !player.sockets) return 0;
    let n = 0;
    for (const s of player.sockets) {
      if (s.comp && s.comp.online === false && (s.comp.part.powerCost || 0) > 0) n++;
    }
    return n;
  },

  powerChance(player) {
    if (!player) return 0;
    if ((player.cellPower || 0) >= this.powerCap(player)) return 0;
    const off = this._offlineCount(player);
    const base = off >= 2 ? this.CHANCE_POWER_MANY_OFF
      : (off === 1 ? this.CHANCE_POWER_ONE_OFF : this.CHANCE_POWER_NONE_OFF);
    return base * this.cellFactor();
  },

  // A reactor doubles what a cell is worth (the player's request).
  cellValue(player) {
    const hasReactor = player && player.sockets &&
      player.sockets.some(s => s.comp && s.comp.online && s.comp.part.powerBonus);
    return this.POWER_PER_CELL * (hasReactor ? 2 : 1);
  },

  dropChance(player) {
    const n = this._need(player);
    // Weighted toward the top end so the curve only really opens up when the
    // player is actually in trouble, rather than drip-feeding from the start.
    return this.CHANCE_HEALTHY + (this.CHANCE_HURT - this.CHANCE_HEALTHY) * (n * n);
  },

  // Called from a machine's death. Returns true if anything was dropped.
  maybeDrop(x, y, player) {
    if (!player || !player.alive) return false;
    // Power first: an offline weapon is a bigger problem than a dented Core.
    if (Math.random() < this.powerChance(player)) {
      this.spawn(x, y, 'power');
      return true;
    }
    if (player.hp >= player.maxHp) return false;      // nothing to heal
    if (Math.random() >= this.dropChance(player)) return false;
    this.spawn(x, y, 'hp');
    return true;
  },

  spawn(x, y, kind) {
    if (this.items.length >= this.MAX) this.items.shift();
    const a = Math.random() * Math.PI * 2;
    this.items.push({
      x, y,
      vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
      t: 0, bob: Math.random() * Math.PI * 2,
      kind: kind === 'power' ? 'power' : 'hp',
    });
    return this.items[this.items.length - 1];
  },

  update(dt, player) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      it.bob += dt * 3.4;

      if (it.t >= this.LIFETIME) { this.items.splice(i, 1); continue; }

      // settle
      it.vx *= Math.pow(0.06, dt);
      it.vy *= Math.pow(0.06, dt);

      if (player && player.alive) {
        const dx = player.x - it.x, dy = player.y - it.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < this.ATTRACT) {
          const pull = this.ATTRACT_SPEED * (1 - d / this.ATTRACT);
          it.vx += (dx / d) * pull * dt * 4;
          it.vy += (dy / d) * pull * dt * 4;
        }
        if (d < player.radius + this.RADIUS) {
          this.collect(it, player);
          this.items.splice(i, 1);
          continue;
        }
      }
      it.x += it.vx * dt;
      it.y += it.vy * dt;
    }
  },

  collect(it, player) {
    if (it.kind === 'power') return this._collectPower(it, player);
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + this.healFor(player));
    const gained = Math.round(player.hp - before);
    if (typeof Effects !== 'undefined') {
      Effects.ring(it.x, it.y, 90, '#5cff9d');
      if (gained > 0) Effects.comicWord('+' + gained, it.x, it.y - 40, '#5cff9d');
    }
    if (typeof Audio_ !== 'undefined') Audio_.play('pickup');
    if (typeof buzz === 'function') buzz(10);
  },

  _collectPower(it, player) {
    const want = this.cellValue(player);
    const gain = Math.min(want, this.powerCap(player) - (player.cellPower || 0));
    if (gain <= 0) return;
    player.cellPower = (player.cellPower || 0) + gain;

    // Anything that was starved may now run — report it, because a weapon
    // silently coming back on is the payoff for chasing the cell.
    const wasOff = player.sockets.filter(s => s.comp && s.comp.online === false);
    if (typeof Machine !== 'undefined') Machine.recalcPower(player);
    const cameOn = wasOff.filter(s => s.comp && s.comp.online).length;

    if (typeof Effects !== 'undefined') {
      Effects.ring(it.x, it.y, 100, CONFIG.COLOR.yellow);
      Effects.comicWord('+' + gain + ' POWER', it.x, it.y - 40, CONFIG.COLOR.yellow, 64);
      if (cameOn > 0) {
        Effects.comicWord(cameOn > 1 ? cameOn + ' ONLINE!' : 'ONLINE!',
          player.x, player.y - 190, CONFIG.COLOR.lime, 86);
      }
    }
    if (typeof Audio_ !== 'undefined') Audio_.play(cameOn > 0 ? 'unlock' : 'pickup');
    if (typeof buzz === 'function') buzz(cameOn > 0 ? 18 : 10);
  },

  draw(ctx) {
    for (const it of this.items) {
      // Blink out the last few seconds so nobody watches one vanish unexplained.
      const left = this.LIFETIME - it.t;
      if (left < this.BLINK_AT && Math.floor(left * 6) % 2 === 0) continue;
      const bob = Math.sin(it.bob) * 6;
      R.circle(it.x + 3, it.y + bob + 8, this.RADIUS, 'rgba(0,0,0,0.35)');
      const artKey = it.kind === 'power' ? 'pickup_power' : 'pickup_health';
      if (typeof Assets !== 'undefined' && Assets.has(artKey)) {
        const img = Assets.get(artKey);
        const long = Math.max(img.width, img.height) || 1;
        const sc = (this.RADIUS * 2.8) / long;
        if (Assets.sprite(ctx, artKey, it.x, it.y + bob,
                          img.width * sc, img.height * sc, 0)) continue;
      }
      if (it.kind === 'power') {
        // Yellow cell with a bolt: never confusable with the green cross.
        R.circle(it.x, it.y + bob, this.RADIUS, '#3a3312', CONFIG.COLOR.ink, 5);
        R.circle(it.x, it.y + bob, this.RADIUS * 0.66, CONFIG.COLOR.yellow,
          CONFIG.COLOR.ink, 3);
        ctx.save();
        ctx.fillStyle = '#241f06';
        ctx.beginPath();
        const r = this.RADIUS;
        ctx.moveTo(it.x + r * 0.10, it.y + bob - r * 0.46);
        ctx.lineTo(it.x - r * 0.24, it.y + bob + r * 0.06);
        ctx.lineTo(it.x - r * 0.02, it.y + bob + r * 0.06);
        ctx.lineTo(it.x - r * 0.10, it.y + bob + r * 0.46);
        ctx.lineTo(it.x + r * 0.26, it.y + bob - r * 0.10);
        ctx.lineTo(it.x + r * 0.02, it.y + bob - r * 0.10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }
      R.circle(it.x, it.y + bob, this.RADIUS, '#123a26', CONFIG.COLOR.ink, 5);
      R.circle(it.x, it.y + bob, this.RADIUS * 0.62, '#5cff9d', CONFIG.COLOR.ink, 3);
      // cross, so it reads as health and not as salvage
      const a = this.RADIUS * 0.34, b = this.RADIUS * 0.12;
      R.rect(it.x - a, it.y + bob - b, a * 2, b * 2, '#0b2418');
      R.rect(it.x - b, it.y + bob - a, b * 2, a * 2, '#0b2418');
    }
  },
};

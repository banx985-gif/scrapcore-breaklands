// SCRAPCORE: BREAKLANDS — RIDING THE TRAIN (content/CONTENT_RAIL_HITCH.md,
// 22 Sept 2026). Aaron's idea, his hold-the-bar design.
//
// Hook onto a moving train as it goes by and ride it. Fast ground travel
// along the rails, paid for by HOLDING THE COUPLING rather than by a cooldown
// or a cost. Rail Spine's own note says "collision at speed is lethal; a
// stopped train is cover" -- this turns the district's most dangerous thing
// into its best thing, which is the strongest turn a district can make.
//
// HOOKING ON. Alongside a moving train, MAGNET hooks the coupling (the same
// button the magnet already uses; the prompt appears only when a car is
// passing and in reach). You must already be MOVING WITH IT: hooking from a
// standstill onto a train at speed is the collision that is already lethal,
// so the window is a speed match, not a button press. Let go any time: the
// drop-tow input (ACTION) releases the hitch too, and you are spat out at
// line speed, which is the fun of it.
//
// THE HOLD -- AARON'S DESIGN. "Make it so ya have to keep it in control or it
// snaps off. Maybe a bar ya have to keep in a section coloured green, and if
// it's in the red there's a bar that fills and when full it snaps." Two
// meters, and only the second one hurts:
//
//   THE COUPLING BAR   a needle drifts along a track and the player counters
//                      it with the stick. The green band in the middle is
//                      holding; the red ends are losing it. The drift is
//                      never still -- points and junctions push it, and the
//                      train's own sway does too.
//   THE STRAIN METER   fills while the needle is in the red, drains while it
//                      is in the green, and neither is instant: a moment in
//                      the red is recoverable, a long fight with it is not.
//                      FULL: THE HITCH SNAPS.
//
// Nothing else punishes a wobble. No damage on a red moment, no warning
// stack, no screen shake: the strain meter filling is the whole feedback.
//
// WHEN IT SNAPS. The machine is thrown clear at line speed, takes fall
// damage, and THE TOW COMES OFF. The wreck is left where it lands, not
// destroyed -- it can be picked up again. Expensive in time, never a
// run-ender, which is the tone the rest of the game takes with death.
//
// TOWING ON THE TRAIN -- CONFIRMED. You CAN ride with a wreck on the hook,
// and the wreck makes it harder: it widens the drift and narrows the green
// band, by its WEIGHT, so a MAMMOTH chassis on a long line is a genuine hold
// and an empty machine is an easy one. THIS IS WHAT PROTECTS THE BANKING
// LOOP. The drive home is the tension the whole economy runs on, and a train
// that carried a full haul for free would delete it. It does not: it offers
// to carry the haul if the player can hold it. Do not ban towing.
//
// WHAT IT MUST NOT BREAK. The world is sized from drive time; a train is
// faster than driving ALONG THE RAILS ONLY, and the rails are Rail Spine's,
// so the drive-time figures elsewhere stand. The hitch is not a hazard and
// creates none. If rails ever cross into another district the hitch goes
// with them and WORLD_SCALE gets re-derived.
//
// SPEED -- DECIDED. "A little more than double": 2.25x base, which is the
// line speed in MovingFreight (hazards.js) -- the train and the ride are the
// same number, so there is one. Tune by eye from there.
const HITCH = {
  // ---- hooking on ----
  REACH: 420,             // how far from the car's side the magnet reaches
  MATCH: 0.55,            // "moving with it": this much of your own top speed
                          // along the line, in its direction
  // ---- the bar ----
  GREEN: 0.36,            // half-width of the green band, of a track -1..1
  CONTROL: 2.4,           // how fast a full stick moves the needle (per s)
  DRIFT: 0.42,            // the sway's amplitude (needle units per s)
  JOLT: 0.30,             // a set of points: an impulse on the needle
  JOLT_EVERY: [2.2, 4.6], // seconds between points, rolled
  // ---- the wreck in tow ----
  DRIFT_PER_WEIGHT: 0.05, // each unit of hulk weight adds 5% drift
  GREEN_PER_WEIGHT: 0.025,// and narrows the band: 1 / (1 + w * this)
  // ---- the strain ----
  FILL: 2.6,              // seconds of red to snap, from empty
  DRAIN: 4.0,             // seconds of green to empty, from full
  // ---- the snap ----
  FALL: 30,               // core damage, thrown clear
  RIDE_Y: 0,              // you ride ON the flatbed: pinned to the line
};

const RailHitch = {
  train: null,            // the MovingFreight on the hook, or null
  off: 0,                 // where along the train you hooked, from its head
  needle: 0,              // -1..1
  strain: 0,              // 0..1
  t: 0,                   // ride clock, drives the sway
  _joltIn: 0,             // seconds to the next set of points
  _msg: '', _msgT: 0,
  rides: 0,               // hooks this session, for the record
  snaps: 0,

  reset() {
    this.train = null; this.off = 0; this.needle = 0; this.strain = 0;
    this.t = 0; this._joltIn = 0; this._msg = ''; this._msgT = 0;
  },

  riding() { return !!this.train; },

  // ---- the window ---------------------------------------------------------
  // The train a magnet press would hook: a car of it alongside, within
  // reach of its side, the player not on the line in front of its face.
  candidate(player) {
    if (!player || typeof World === 'undefined' || typeof MovingFreight === 'undefined') return null;
    let best = null, bd = Infinity;
    for (const e of World.owned) {
      if (!(e instanceof MovingFreight) || e._dead) continue;
      const b = e.bounds();
      if (player.x < b.x - 40 || player.x > b.x + b.w + 40) continue;   // no car beside you
      const dy = Math.abs(player.y - e.y);
      if (dy > MovingFreight.CAR_W / 2 + HITCH.REACH) continue;
      if (dy < bd) { bd = dy; best = e; }
    }
    return best;
  },

  // "Moving with it": your velocity along the line, in the train's
  // direction, is a real fraction of your own top speed. A standstill never
  // matches; neither does driving the other way.
  matched(player, train) {
    if (!player || !train) return false;
    const along = (player.vx || 0) * train.dir;
    const top = player.maxSpeed || player.baseMaxSpeed || 600;
    return along >= HITCH.MATCH * top;
  },

  // What the HUD says, or null. Only while a train is actually passing.
  prompt(player) {
    if (this.train) return null;
    const t = this.candidate(player);
    if (!t) return null;
    return this.matched(player, t)
      ? { text: 'MAGNET — HOOK THE COUPLING', ok: true }
      : { text: 'MATCH ITS SPEED TO HOOK ON', ok: false };
  },

  // ---- hooking ------------------------------------------------------------
  tryHook(player) {
    if (this.train) return false;
    const t = this.candidate(player);
    if (!t) return false;
    if (!this.matched(player, t)) { this._say('MATCH ITS SPEED TO HOOK ON'); return false; }
    this.train = t;
    this.off = player.x - t.head;
    this.needle = 0;
    this.strain = 0;
    this.t = 0;
    this._joltIn = this._nextJolt();
    t.rider = player;
    this.rides++;
    this._say('HITCHED — HOLD THE BAR');
    if (typeof Audio_ !== 'undefined') Audio_.play('connectorBreak');
    if (typeof Profile !== 'undefined' && Profile.bump) Profile.bump('rides');
    return true;
  },

  // Letting go, and the snap. Both spit you out at line speed; only the snap
  // hurts, and only the snap drops the tow.
  release(player, why) {
    const t = this.train;
    if (!t) return false;
    t.rider = null;
    this.train = null;
    if (player) {
      player.vx = t.dir * MovingFreight.SPEED;
      player.vy = 0;
    }
    if (why === 'snap') {
      this.snaps++;
      if (player && player.takeCoreDamage) {
        player.invulnT = 0;
        player.takeCoreDamage(HITCH.FALL, player.x, player.y, false, 'hazard');
      }
      // THE TOW COMES OFF. Dropped, not destroyed: Tow.unhook leaves the
      // hulk world-owned where it is, and it can be hooked again.
      if (typeof Tow !== 'undefined' && Tow.hooked) Tow.unhook();
      if (typeof Camera !== 'undefined') Camera.shake(18, 0.45);
      if (typeof Effects !== 'undefined' && player) {
        Effects.comicWord('SNAPPED', player.x, player.y - 200, CONFIG.COLOR.red, 70);
      }
      if (typeof Audio_ !== 'undefined') Audio_.play('scrapped');
      this._say('THE HITCH SNAPPED');
    } else {
      this._say('LET GO');
      if (typeof Audio_ !== 'undefined') Audio_.play('pickup');
    }
    this.needle = 0;
    this.strain = 0;
    return true;
  },

  // ---- the ride -------------------------------------------------------------
  // How much the wreck in tow widens the drift and narrows the band. By
  // weight, so a stripped hulk is a small nuisance and a chassis is a fight.
  towWeight() {
    return (typeof Tow !== 'undefined' && Tow.hooked) ? (Tow.hooked.weight || 0) : 0;
  },
  greenBand() {
    return HITCH.GREEN / (1 + this.towWeight() * HITCH.GREEN_PER_WEIGHT);
  },
  driftMul() {
    return 1 + this.towWeight() * HITCH.DRIFT_PER_WEIGHT;
  },
  inRed() { return Math.abs(this.needle) > this.greenBand(); },

  _nextJolt() {
    const [a, b] = HITCH.JOLT_EVERY;
    return a + Math.random() * (b - a);
  },

  update(dt, player) {
    this._msgT = Math.max(0, this._msgT - dt);
    const t = this.train;
    if (!t || !player) return;
    if (player.alive === false || t._dead) { this.release(player, 'dead'); return; }
    this.t += dt;

    // CARRIED. Pinned to the car you hooked, exactly like the conveyor
    // carries you: position, never velocity, so the moment you let go the
    // spit-out speed is yours and nothing else is.
    player.x = t.head + this.off;
    player.y = t.y + HITCH.RIDE_Y;
    player.vx = 0; player.vy = 0;

    // THE BAR. The sway is two sines that never line up, plus a set of
    // points now and then; the stick's x is the counter.
    const mul = this.driftMul();
    const sway = (Math.sin(this.t * 2.1) * 0.6 + Math.sin(this.t * 0.83 + 1.7) * 0.4) *
      HITCH.DRIFT * mul;
    this._joltIn -= dt;
    let jolt = 0;
    if (this._joltIn <= 0) {
      this._joltIn = this._nextJolt();
      jolt = (Math.random() < 0.5 ? -1 : 1) * HITCH.JOLT * mul;
    }
    const stick = (typeof Controls !== 'undefined' && Controls.move)
      ? Controls.move.dx * Controls.move.mag : 0;
    this.needle += sway * dt + jolt + stick * HITCH.CONTROL * dt;
    this.needle = Math.max(-1, Math.min(1, this.needle));

    // THE STRAIN. Fills in the red, drains in the green, neither instant.
    if (this.inRed()) this.strain = Math.min(1, this.strain + dt / HITCH.FILL);
    else this.strain = Math.max(0, this.strain - dt / HITCH.DRAIN);
    if (this.strain >= 1) this.release(player, 'snap');
  },

  _say(m) { this._msg = m; this._msgT = 3; },

  // ---- the HUD --------------------------------------------------------------
  // The two meters, bottom centre where the tow readout lives, big enough to
  // read without looking away from the world. The green band and the red
  // ends are the faction colours doing their one job: green is holding,
  // red is losing it.

  // WHERE THE RIDE'S STACK STARTS, in screen space, or null when it is not
  // up. ONE answer: draw() lays the bar, the strain meter and the ride line
  // out from it, and anything else that draws in the bottom-centre column
  // gets out of its way by reading it rather than carrying its own copy of
  // the number. The tow readout and the ride line were drawn straight
  // through each other -- 13,894 square pixels of it -- from the day the
  // hitch was built (D359) until the ride was measured for the first time
  // (tools/hudcheck.py, D363).
  hudTop() {
    if (!this.train || typeof Display === 'undefined') return null;
    return Display.safe.bottom - 330;
  },

  // THE TWO METERS. "bottom centre where the tow readout lives" was written
  // before there was a tow readout to share it with; the tow block reads
  // hudTop() and lifts itself clear now.
  draw(ctx) {
    const s = Display.safe;
    const mid = (s.left + s.right) / 2;
    if (!this.train) {
      if (this._msgT > 0) {
        R.smallText(this._msg, mid, s.bottom - 250, 26, CONFIG.COLOR.orange, 'center');
      }
      return;
    }
    const w = 520, h = 30, y = this.hudTop() + 30, x = mid - w / 2;
    const g = this.greenBand();
    // The track: red ends, green middle.
    R.rect(x, y, w, h, 'rgba(0,0,0,0.6)');
    R.rect(x, y, w * (1 - g) / 2, h, 'rgba(255,59,59,0.55)');
    R.rect(x + w * (1 + g) / 2, y, w * (1 - g) / 2, h, 'rgba(255,59,59,0.55)');
    R.rect(x + w * (1 - g) / 2, y, w * g, h, 'rgba(168,232,50,0.55)');
    R.rect(x, y, w, h, null, CONFIG.COLOR.ink, 3);
    // The needle.
    const nx = x + w * (this.needle + 1) / 2;
    R.rect(nx - 5, y - 8, 10, h + 16, this.inRed() ? CONFIG.COLOR.red : CONFIG.COLOR.white,
      CONFIG.COLOR.ink, 2);
    R.smallText('COUPLING — HOLD IT IN THE GREEN', mid, y - 30, 22,
      this.inRed() ? CONFIG.COLOR.red : CONFIG.COLOR.lime, 'center');
    // The strain, under it: fills red, and full is the snap.
    const sy = y + h + 12, sh = 14;
    R.rect(x, sy, w, sh, 'rgba(0,0,0,0.6)');
    R.rect(x, sy, w * this.strain, sh, CONFIG.COLOR.red);
    R.rect(x, sy, w, sh, null, CONFIG.COLOR.ink, 2);
    R.smallText('STRAIN', x - 8, sy - 3, 18, CONFIG.COLOR.steel, 'right');
    const tw = this.towWeight();
    R.smallText('RIDING THE LINE  —  ' + Math.round(MovingFreight.SPEED) + ' u/s' +
      (tw ? '  —  A WRECK ON THE HOOK WIDENS THE DRIFT' : '') +
      '  —  ACTION TO LET GO', mid, sy + sh + 12, 20, CONFIG.COLOR.white, 'center');
  },
};

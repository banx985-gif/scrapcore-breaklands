// SCRAPCORE: BREAKLANDS — Aim assist (plan §20)
//
// Sockets are world-fixed and connectors sit physically BETWEEN core and part,
// so shearing a joint means hitting a small target from a specific angle. That
// is intended skill on a controller — on a phone, with a thumb over the stick,
// it is often just fiddly. This nudges aim toward what the player is already
// pointing at, and per plan §20 it prefers DAMAGED CONNECTORS, because
// finishing a joint you have already softened is the game's best action.
//
// Rules it must never break:
//  - It only ever ROTATES aim, never picks a different direction outright.
//  - It only engages when a target is already inside the cone, so it cannot
//    drag the player's aim somewhere they were not pointing.
//  - It never overshoots the target.
//  - At strength 0 it is a no-op that costs one comparison.
const AimAssist = {
  // Half-angle of the cone searched, in radians. Generous, because the
  // correction is small — a wide cone with a gentle pull feels like help,
  // a narrow cone with a hard snap feels like the game grabbing the stick.
  CONE: 0.42,
  RANGE: 1250,

  // Max correction per second at full strength, radians. Deliberately a RATE,
  // not a fraction of the error: a rate cannot snap, and it stays consistent
  // whether the frame took 16ms or 33ms.
  MAX_TURN: 3.4,

  ON_STRENGTH: 0.5,

  // Tiers that refuse aim assist outright.
  bannedOn(difficultyId) {
    return difficultyId === 'overdrive';
  },

  available() {
    if (typeof Profile === 'undefined') return true;
    return !this.bannedOn(Profile.difficulty);
  },

  strength() {
    if (!this.available()) return 0;
    if (typeof Settings === 'undefined') return this.ON_STRENGTH;
    const v = Settings.get ? Settings.get('aimAssist') : true;
    // Tolerates the old numeric (0-100) value from a save written before this
    // was a toggle: anything above zero counts as ON.
    const on = (typeof v === 'number') ? v > 0 : !!v;
    return on ? this.ON_STRENGTH : 0;
  },

  // One place, so the cone search and the distance tie-break can never
  // disagree about how far "in range" reaches.
  range() {
    return this.RANGE;
  },

  // Score a candidate. Lower is better.
  // Angular error dominates (the player's intent wins), then the damaged
  // connector bonus, then distance as a tie-break.
  //
  // The bonus is deliberately withdrawn once a joint drops into the RIP BAND.
  // Below that threshold the joint is the player's to STEAL with the Magnet,
  // and an assist that keeps pouring fire into it just shears the part off at
  // range — which is how "the magnet no longer steals guns" happened. Helping
  // you weaken a joint is the point; helping you destroy the prize is not.
  _score(angErr, dist, damagedFrac, rippable, range) {
    const bonus = rippable ? 0 : damagedFrac * 0.55;
    return angErr * 3.0 + (dist / (range || this.RANGE)) * 0.5 - bonus;
  },

  // Find the best aim point among live enemies, or null.
  // `enemies` may contain bosses; anything with sockets and .alive works.
  findTarget(player, enemies, aimX, aimY) {
    if (!enemies || !enemies.length) return null;
    const aim = Math.atan2(aimY, aimX);
    const RANGE = this.range();
    let best = null, bestScore = Infinity;

    for (const e of enemies) {
      if (!e || !e.alive) continue;
      const dx0 = e.x - player.x, dy0 = e.y - player.y;
      if (Math.hypot(dx0, dy0) > RANGE + (e.radius || 0)) continue;

      const points = [];
      // Connectors first — this is the shot worth helping with.
      if (e.sockets && typeof Machine !== 'undefined') {
        for (const s of e.sockets) {
          const c = s.comp;
          if (!c || c.dead) continue;
          const p = Machine.connectorPos(e, s);
          const hpFrac = c.maxConnectorHp
            ? Math.max(0, Math.min(1, c.connectorHp / c.maxConnectorHp)) : 1;
          const rippable = typeof Machine !== 'undefined' &&
            hpFrac <= (Machine.RIP_THRESHOLD || 0.25);
          points.push({ x: p.x, y: p.y, damaged: 1 - hpFrac, rippable });
        }
      }
      // The Core itself, so a machine stripped bare is still assisted.
      points.push({ x: e.x, y: e.y, damaged: 0, rippable: false });

      for (const pt of points) {
        const dx = pt.x - player.x, dy = pt.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1 || dist > RANGE) continue;
        let err = Math.atan2(dy, dx) - aim;
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        if (Math.abs(err) > this.CONE) continue;      // outside the cone: not intent
        const sc = this._score(Math.abs(err), dist, pt.damaged, pt.rippable, RANGE);
        // `enemy` rides along so callers can ask WHICH MACHINE the assist
        // chose, not just where on it. CONNECTOR READ rank 1 is the only
        // reader; nothing about the assist's own behaviour uses it.
        if (sc < bestScore) {
          bestScore = sc;
          best = { x: pt.x, y: pt.y, err, dist, enemy: e };
        }
      }
    }
    return best;
  },

  // Returns the adjusted unit aim vector. Never returns null; on any failure
  // path it hands back exactly what it was given.
  apply(player, enemies, aimX, aimY, dt) {
    const k = this.strength();
    const t0 = (k <= 0) ? null : this.findTarget(player, enemies, aimX, aimY);
    // WHO YOU ARE LOCKED ONTO, stamped on the machines rather than held here.
    // CONNECTOR READ rank 1 is "the machine you're locked onto", and the
    // aim assist is the only thing in the game that has an opinion about
    // which machine that is — so it is the only honest place to say so.
    // Cleared on everything else, so a target that walks out of the cone
    // stops claiming the readout.
    // `findTarget` already tolerates a null/empty list and so must this: apply
    // is called every frame, including the frames where there is nobody.
    if (enemies && enemies.length) {
      for (const e of enemies) if (e) e._aimLocked = (e === (t0 && t0.enemy));
    }
    if (k <= 0) return { x: aimX, y: aimY };
    const t = t0;
    if (!t) return { x: aimX, y: aimY };

    // Rotate toward the target, capped by the turn rate and never past it.
    const maxStep = this.MAX_TURN * k * (dt || 0);
    const step = Math.max(-maxStep, Math.min(maxStep, t.err));
    const a = Math.atan2(aimY, aimX) + step;
    return { x: Math.cos(a), y: Math.sin(a) };
  },
};

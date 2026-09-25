// SCRAPCORE: BREAKLANDS — Emergency blaster + dummy targets (Milestones 5–6)
// The old single-test-weapon rig became the socket system (machine.js).
// What remains here: the Core's built-in emergency blaster (plan §16) and
// the practice targets.

const EmergencyBlaster = {
  cooldown: 0,

  update(dt, player) {
    const w = PARTS.emergencyBlaster;
    this.cooldown -= dt;
    if (!Controls.firing) {
      this.cooldown = Math.max(this.cooldown, 0);
      return;
    }
    // IT ONLY FIRES WHEN NOTHING ELSE WORKS (D365, Aaron on question 20).
    //
    // It was ungated for a reason and the reason was minute zero: a player
    // with nothing must not be stuck. But the rule never stopped, so it was
    // still adding its 15 dps to a finished railgun build — half that
    // build's damage was the gun the player did not choose, and every dps
    // figure and every kill time this project has ever measured through a
    // real frame was the chosen gun PLUS 15.
    //
    // The minute-zero reason is satisfied exactly by this: fire when there is
    // no gun fitted, or when nothing fitted can answer the trigger. Machine
    // owns that question — see `Machine.hasLiveWeapon`.
    if (typeof Machine !== 'undefined' && Machine.hasLiveWeapon(player)) {
      this.cooldown = Math.max(this.cooldown, 0);
      return;
    }
    while (this.cooldown <= 0) {
      const angle = Math.atan2(player.aimY, player.aimX)
        + (Math.random() - 0.5) * 2 * w.spread;
      const d = player.radius + 40;
      const mx = player.x + Math.cos(angle) * d;
      const my = player.y + Math.sin(angle) * d;
      Projectiles.spawn(mx, my, angle, w, 'player');
      Effects.muzzleFlash(mx, my, angle, false);
      // No heat while already overheated: the built-in gun must never make
      // the lockout longer.
      if (!player.overheated) {
        player.heat = Math.min(player.heatCap, player.heat + w.heatPerShot);
      }
      this.cooldown += 1 / w.fireRate;
    }
  },
};

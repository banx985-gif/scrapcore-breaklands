// SCRAPCORE: BREAKLANDS — Weapon Mastery (Milestone 2 slice)
// Master v3.2 §17.
//
// Permanent, by weapon FAMILY, not by physical item. Swap the Cannon, sell the
// Cannon, lose the Cannon to a Warden — the Cannon mastery is still yours. It
// is the one progression track that rewards playing the way you like playing.
//
// M2 implemented credits, the level curve and the per-level stat effect.
// M10 (25 Aug) adds the Level-5 handling perks and Level-10 Expertises —
// the DATA for all 18 tracks from Master §17, live behaviour for the ten
// weapons that exist. The eight M14 weapons' rows sit inert until their
// parts do; tracks() derives from PART_LIST, so they join by existing.

const Mastery = {
  MAX_LEVEL: 10,
  LEVEL_CAP_IMPLEMENTED: 10,     // stats AND the L5/L10 perks (M10)

  // =========================================================================
  // LEVEL-5 HANDLING PERKS — Master §17, verbatim table. `text` is the
  // Master's own wording; the machine-readable fields are how this engine
  // applies it. Multipliers are named for what they multiply:
  //   spread    weapon spread            recoil   the gun's own kick
  //   cooldown  seconds between shots    homing   rocket turn rate
  //   life      projectile lifetime      arm      mine arming time
  //   chainRange  arc chain search radius
  //
  // Three rows are marked engineNoop — the mechanic the Master's line
  // modifies does not exist in this engine, so the honest effect is nothing:
  //   beamLaser: the beam tracks aim EXACTLY, so stability is already
  //     perfect and +10% of perfect is perfect;
  //   saw: mounted saws impose no movement penalty while grinding, so
  //     -10% of no penalty is no penalty.
  // They are recorded rather than omitted so a later engine change (a beam
  // with sweep lag, a saw that drags) knows a perk is waiting for it.
  // =========================================================================
  HANDLING: {
    machineGun:  { text: 'Spread -10%',                          spread: 0.90 },
    scattergun:  { text: 'Spread -8%',                           spread: 0.92 },
    cannon:      { text: 'Recoil -15%',                          recoil: 0.85 },
    railgun:     { text: 'Charge/recovery time -8%',             cooldown: 0.92 },
    rocketPod:   { text: 'Lock acquisition +15%',                homing: 1.15 },
    flamethrower:{ text: 'Effective flame reach +5%',            life: 1.05 },
    beamLaser:   { text: 'Beam tracking/sweep stability +10%',   engineNoop: 'beam already tracks aim exactly' },
    arcGun:      { text: 'Chain acquisition radius +10%',        chainRange: 1.10 },
    saw:         { text: 'Movement penalty while engaged -10%',  engineNoop: 'saws impose no movement penalty in this engine' },
    mineLayer:   { text: 'Mine arming time -15%',                arm: 0.85 },
    // M14 weapons — inert until the parts exist.
    burstRifle:      { text: 'Burst recoil recovery +12%',       recoil: 0.88 },
    flakCannon:      { text: 'Projectile speed +8%',             projSpeed: 1.08 },
    mortar:          { text: 'Projectile travel time -8%',       life: 0.92 },
    harpoon:         { text: 'Tether retract/pull speed +10%',   tether: 1.10 },
    shockwaveCannon: { text: 'Post-shot recovery time -8%',      cooldown: 0.92 },
    drill:           { text: 'Movement penalty while engaged -10%', engineNoop: 'no engagement movement penalty in this engine yet' },
    discLauncher:    { text: 'Disc speed +10%',                  projSpeed: 1.10 },
    plasmaRepeater:  { text: 'Spread -10%',                      spread: 0.90 },
  },

  // =========================================================================
  // LEVEL-10 EXPERTISES — Master §17, names and wording verbatim. The caps
  // are the Master's; where the Master gives a cap but no rate (how fast a
  // ramp climbs), the rate is an implementation choice and is recorded here
  // as data so retuning it never means hunting through machine.js.
  //
  // railgun CLEAN THROUGH is engineNoop for the opposite reason to the two
  // above: piercing already does not reduce damage in this engine, so every
  // railgun behaves as if it had the Expertise. If pierce falloff is ever
  // added to the base weapon, delete the flag and the perk goes live.
  // =========================================================================
  EXPERTISE: {
    machineGun: { name: 'FEED RAMP',
      text: 'Sustained hits on the same machine raise fire rate up to +20%; resets when target/trigger is lost.',
      rampCap: 0.20, rampPerHit: 0.025 },
    scattergun: { name: 'TIGHT CHOKE',
      text: 'Spread narrows a further 15%; centre pellet gains +50% Connector damage.',
      spread: 0.85, centreConnMul: 1.5 },
    cannon: { name: 'DOUBLE TAP',
      text: 'Every fifth fired shell immediately chambers a bonus 60%-damage shell with no normal reload delay.',
      every: 5, bonusDmg: 0.60 },
    railgun: { name: 'CLEAN THROUGH',
      text: 'First penetrated target does not reduce remaining projectile damage.',
      engineNoop: 'pierce has no damage falloff in this engine, so this is base behaviour' },
    rocketPod: { name: 'PACK HUNTER',
      text: 'Salvos distribute locks across nearby valid targets before duplicating; single-target salvo gains +15% damage.',
      soloDmg: 1.15 },
    flamethrower: { name: 'WHITE HOT',
      text: 'Sustained contact ramps burn damage up to +40% until contact breaks.',
      rampCap: 0.40, rampPerHit: 0.04, breakAfter: 0.6 },
    beamLaser: { name: 'FOCUS LOCK',
      text: 'Holding beam contact for 0.8s begins a precision damage ramp up to +30%.',
      holdTime: 0.8, rampCap: 0.30, rampPerSec: 0.20 },
    arcGun: { name: 'CHAIN REACTION',
      text: 'Gains one additional chain target; powered components are preferred after first hit.',
      extraChain: 1 },
    saw: { name: 'CHEW THROUGH',
      text: '+35% Connector damage.',
      connMul: 1.35 },
    mineLayer: { name: 'RECYCLER',
      text: 'A mine kill reduces the next mine deployment cooldown by 35%.',
      cdMul: 0.65 },
    // M14 weapons — inert until the parts exist.
    burstRifle: { name: 'PERFECT BURST',
      text: 'If first two rounds hit the same target, the third deals +50% damage.' },
    flakCannon: { name: 'SHRED CLOUD',
      text: 'Detonation throws a short-lived fragment cloud damaging drones/projectiles and exposed modules.' },
    mortar: { name: 'SECOND IMPACT',
      text: 'Main blast creates a smaller delayed aftershock.' },
    harpoon: { name: 'RIP LINE',
      text: 'A harpoon lodged in a critical connector reduces Magnet rip time on that connector by 50%.' },
    shockwaveCannon: { name: 'AFTERSHOCK',
      text: 'A second weaker shock ring fires 0.35s after the first.' },
    drill: { name: 'BORE LOCK',
      text: 'Continuous contact ramps Connector damage up to +50%.' },
    discLauncher: { name: 'RICOCHET+',
      text: 'Disc gains one additional full-damage bounce.' },
    plasmaRepeater: { name: 'OVERCHARGE CYCLE',
      text: 'Every eighth shot becomes a larger splash projectile.' },
  },

  // The live perk for a weapon, or null — the level gate (5 / 10) in one place.
  handling(partId) {
    if (this.levelOf(partId) < 5) return null;
    return this.HANDLING[partId] || null;
  },

  expertise(partId) {
    if (this.levelOf(partId) < this.MAX_LEVEL) return null;
    return this.EXPERTISE[partId] || null;
  },

  // Master §17 cumulative curve. Index 0 is unused so index === level.
  CURVE: [0, 0, 20, 55, 110, 190, 300, 445, 630, 860, 1140],

  // Master §17 kill credits.
  CREDIT: { normal: 1, elite: 3, warden: 10 },

  credits: {},                   // partId -> lifetime credits
  _justLevelled: null,           // {partId, level} for one notification

  reset() { this.credits = {}; this._justLevelled = null; },

  isWeapon(partId) {
    const p = PARTS[partId];
    return !!(p && p.category === 'weapon' && partId !== 'emergencyBlaster');
  },

  tracks() { return PART_LIST.filter(id => this.isWeapon(id)); },

  creditsOf(partId) { return this.credits[partId] || 0; },

  levelOf(partId) {
    const c = this.creditsOf(partId);
    let lv = 1;
    for (let i = 2; i <= this.MAX_LEVEL; i++) if (c >= this.CURVE[i]) lv = i;
    return lv;
  },

  toNext(partId) {
    const lv = this.levelOf(partId);
    if (lv >= this.MAX_LEVEL) return 0;
    return this.CURVE[lv + 1] - this.creditsOf(partId);
  },

  // Master §13: Mastery credits bank IMMEDIATELY and survive Campaign death.
  // That is deliberate — it is the one thing a bad run always leaves you with.
  award(partId, kind = 'normal') {
    if (!this.isWeapon(partId)) return 0;
    // BLOCK 4.5: the per-CLASS weapon skill counter. Nothing reads it yet —
    // Block 10 builds the spines and capstones that spend it — but it is
    // fed from here because this is the one place in the game a kill is
    // credited to a weapon, and adding the field now costs nothing while
    // adding it later costs a save migration.
    if (typeof WeaponSkill !== 'undefined') WeaponSkill.add(partId, 1);
    const before = this.levelOf(partId);
    const gain = this.CREDIT[kind] || 1;
    this.credits[partId] = this.creditsOf(partId) + gain;
    const after = this.levelOf(partId);
    if (after > before) {
      this._justLevelled = { partId, level: after };
      if (typeof Effects !== 'undefined' && Machine._xpPlayer) {
        const p = Machine._xpPlayer;
        Effects.comicWord(PARTS[partId].name + ' MASTERY ' + after,
          p.x, p.y - 230, CONFIG.COLOR.cyan, 58);
      }
      if (typeof Audio_ !== 'undefined') Audio_.play('rankUp');
    }
    return gain;
  },

  // (takeLevelUp -- WRECKJACK's results screen took the one-shot
  // notification from here. BREAKLANDS says it as a comic word above, at
  // the moment it happens, and nothing read the flag: gone, D351.)

  // Master §17 permanent stats:
  //   every level 2-10: +2% damage
  //   levels 2/4/6/8/10: -2% Heat generation
  // Level 10 therefore totals +18% damage and -10% Heat.
  damageMul(partId) {
    return 1 + (this.levelOf(partId) - 1) * 0.02;
  },

  heatMul(partId) {
    const lv = this.levelOf(partId);
    return 1 - Math.floor(lv / 2) * 0.02;
  },

  snapshot() { return { credits: Object.assign({}, this.credits) }; },

  restore(d) {
    this.reset();
    if (!d || !d.credits) return false;
    for (const k of Object.keys(d.credits)) {
      const v = d.credits[k];
      if (this.isWeapon(k) && typeof v === 'number' && v >= 0) {
        this.credits[k] = Math.min(v, this.CURVE[this.MAX_LEVEL] * 10);
      }
    }
    return true;
  },
};

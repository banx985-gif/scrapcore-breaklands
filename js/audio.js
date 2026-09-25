// SCRAPCORE: BREAKLANDS — Audio (Milestone 21, plan §66)
// Every sound is SYNTHESISED at runtime with WebAudio. No .wav or .mp3 files
// exist, which means: nothing to download, nothing to inline into the
// standalone build, no licensing, and infinite pitch/timbre variation from one
// definition (plan §66 asks for exactly that variation).
//
// Everything is guarded: if WebAudio is unavailable, blocked, or the context
// cannot start, the game runs silently rather than failing.

const Audio_ = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  ready: false,
  blocked: false,
  _music: null,
  _lastPlay: {},        // per-sound throttle so 80 bullets do not stack
  _voices: 0,
  MAX_VOICES: 18,

  init() {
    if (this.ready || this.blocked) return;
    try {
      const AC = (typeof window !== 'undefined') &&
        (window.AudioContext || window.webkitAudioContext);
      if (!AC) { this.blocked = true; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      // Master chain. Phone speakers exaggerate everything above ~5kHz, and
      // that harshness is what makes synthesised SFX grating over a long
      // session. A gentle low-pass plus a compressor fixes most of it.
      this.tone = this.ctx.createBiquadFilter();
      this.tone.type = 'lowpass';
      this.tone.frequency.value = 5200;
      this.tone.Q.value = 0.4;

      this.shelf = this.ctx.createBiquadFilter();
      this.shelf.type = 'highshelf';
      this.shelf.frequency.value = 3200;
      this.shelf.gain.value = -6;          // take the edge off the top

      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -22;
      this.comp.knee.value = 26;
      this.comp.ratio.value = 7;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.18;

      this.sfxGain.connect(this.tone);
      this.tone.connect(this.shelf);
      this.shelf.connect(this.comp);
      this.comp.connect(this.master);
      this.musicGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.ready = true;
      this.applyVolumes();
    } catch (e) {
      this.blocked = true;
    }
  },

  // Mobile browsers refuse to start audio until a real user gesture, so this
  // is called from the first touch.
  unlock() {
    this.init();
    if (!this.ready) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  suspend() { if (this.ready && this.ctx.resume) this.ctx.suspend().catch(() => {}); },
  // (There is no resume(): the next touch goes through unlock(), which is
  // the one place a suspended context is resumed.)

  applyVolumes() {
    if (!this.ready) return;
    const g = (k, d) => (typeof Settings !== 'undefined' ? Settings.get(k) : d) / 100;
    this.master.gain.value = g('masterVolume', 80);
    this.musicGain.gain.value = g('musicVolume', 70) * 0.5;
    this.sfxGain.gain.value = g('sfxVolume', 90) * 0.42;   // headroom for the compressor
  },

  _now() { return this.ctx.currentTime; },

  _env(node, t, attack, hold, release, peak) {
    const g = this.ctx.createGain();
    // Floor the attack at 6ms: anything faster is heard as a click rather than
    // a transient, and 20 clicks a second is what "annoying" actually means.
    attack = Math.max(attack, 0.006);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), t + attack);
    g.gain.setValueAtTime(Math.max(0.0001, peak), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    node.connect(g);
    g.connect(this.sfxGain);
    this._voices++;
    setTimeout(() => { this._voices = Math.max(0, this._voices - 1); },
      (attack + hold + release) * 1000 + 60);
    return g;
  },

  _noise(dur) {
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  },

  // ---- the sound library -------------------------------------------------
  // Each entry is a tiny synth recipe. `vary` is pitch jitter in semitone-ish
  // ratio, so repeated shots never sound identical (plan §66).
  DEFS: {
    // ---- UI: soft, low, brief. Never a square wave.
    uiTap:        { kind: 'tone', freq: 420, type: 'sine',     a: 0.006, h: 0.012, r: 0.06, gain: 0.10, vary: 0.02, lp: 2200 },

    // ---- Weapons. The machine gun fires ~9/sec all run, so it is the one
    // sound that MUST be soft: a filtered noise thump with a short body,
    // rather than a buzzy tone.
    machineGun:   { kind: 'thump', freq: 190, a: 0.004, h: 0.008, r: 0.055, gain: 0.15, vary: 0.09, lp: 1500, noise: 0.7 },
    scattergun:   { kind: 'thump', freq: 130, a: 0.004, h: 0.02,  r: 0.14, gain: 0.24, vary: 0.08, lp: 1900, noise: 1.0 },
    cannon:       { kind: 'boom',  freq: 74,  a: 0.005, h: 0.05,  r: 0.34, gain: 0.34, vary: 0.05, lp: 900 },
    railgun:      { kind: 'sweep', from: 900, to: 120, a: 0.008, h: 0.03, r: 0.30, gain: 0.28, vary: 0.03, lp: 1800, type: 'triangle' },
    rocket:       { kind: 'noise', freq: 420, a: 0.03,  h: 0.10,  r: 0.22, gain: 0.17, vary: 0.06, lp: 1400 },
    flame:        { kind: 'noise', freq: 520, a: 0.04,  h: 0.06,  r: 0.14, gain: 0.09, vary: 0.12, lp: 1100 },
    laser:        { kind: 'tone',  freq: 560, type: 'triangle', a: 0.02, h: 0.05, r: 0.10, gain: 0.09, vary: 0.02, lp: 2400 },
    arc:          { kind: 'noise', freq: 1500, a: 0.004, h: 0.02, r: 0.11, gain: 0.13, vary: 0.16, lp: 3200 },
    saw:          { kind: 'tone',  freq: 110, type: 'triangle', a: 0.03, h: 0.05, r: 0.08, gain: 0.06, vary: 0.08, lp: 900 },
    minePlace:    { kind: 'tone',  freq: 330, type: 'sine', a: 0.006, h: 0.02, r: 0.10, gain: 0.12, vary: 0.04, lp: 1600 },

    // ---- Impacts
    explosion:    { kind: 'boom',  freq: 52,  a: 0.006, h: 0.09, r: 0.50, gain: 0.38, vary: 0.09, lp: 800 },
    metalHit:     { kind: 'thump', freq: 320, a: 0.003, h: 0.010, r: 0.06, gain: 0.10, vary: 0.18, lp: 2600, noise: 1.0 },
    coreHit:      { kind: 'boom',  freq: 110, a: 0.004, h: 0.03, r: 0.18, gain: 0.24, vary: 0.08, lp: 1000 },
    connectorHit: { kind: 'thump', freq: 480, a: 0.003, h: 0.010, r: 0.05, gain: 0.09, vary: 0.16, lp: 3000, noise: 0.8 },
    connectorBreak: { kind: 'sweep', from: 620, to: 180, a: 0.005, h: 0.02, r: 0.24, gain: 0.26, vary: 0.08, lp: 2200, type: 'triangle' },

    // ---- Salvage
    magnetGrab:   { kind: 'sweep', from: 180, to: 560, a: 0.02, h: 0.04, r: 0.16, gain: 0.14, vary: 0.05, lp: 1800, type: 'sine' },
    clank:        { kind: 'clank', freq: 300, a: 0.003, h: 0.03, r: 0.34, gain: 0.30, vary: 0.06, lp: 3000 },
    eject:        { kind: 'sweep', from: 460, to: 150, a: 0.005, h: 0.02, r: 0.16, gain: 0.15, vary: 0.08, lp: 1800, type: 'triangle' },

    // ---- Defence / machine state
    shieldHit:    { kind: 'tone',  freq: 380, type: 'sine', a: 0.006, h: 0.03, r: 0.16, gain: 0.14, vary: 0.08, lp: 1800 },
    shieldBreak:  { kind: 'sweep', from: 520, to: 110, a: 0.006, h: 0.03, r: 0.28, gain: 0.22, vary: 0.04, lp: 1600, type: 'triangle' },
    overheat:     { kind: 'sweep', from: 220, to: 640, a: 0.05, h: 0.12, r: 0.40, gain: 0.24, vary: 0.02, lp: 2000, type: 'triangle' },
    dash:         { kind: 'noise', freq: 900, a: 0.008, h: 0.02, r: 0.14, gain: 0.15, vary: 0.05, lp: 2600 },
    repair:       { kind: 'tone',  freq: 720, type: 'sine', a: 0.02, h: 0.04, r: 0.18, gain: 0.10, vary: 0.03, lp: 2400 },
    pickup:       { kind: 'tone',  freq: 880, type: 'sine', a: 0.008, h: 0.03, r: 0.14, gain: 0.13, vary: 0.02, lp: 2600 },
    bossWarn:     { kind: 'sweep', from: 140, to: 76, a: 0.06, h: 0.34, r: 0.55, gain: 0.32, vary: 0.01, lp: 700, type: 'sine' },

    // ---- THE OPENING. Two sounds, and the first one plays over black
    // before there is anything to look at, which is the whole trick: the
    // player knows they are ON something and being MOVED before they know
    // what they are. Low and dull, because a sorting belt is neither
    // dramatic nor in a hurry - it is machinery that has been running for
    // four hundred years with nobody watching.
    beltGrind:    { kind: 'thump', freq: 58,  a: 0.05, h: 0.30, r: 0.55, gain: 0.16, vary: 0.05, lp: 520, noise: 0.9 },
    // And the thing at the end of it. Harsh on purpose, and it gets
    // louder the closer the belt carries you.
    shredder:     { kind: 'noise', freq: 240, a: 0.04, h: 0.22, r: 0.40, gain: 0.20, vary: 0.14, lp: 1300 },

    // ---- RIDING A BELT (Playtest 3 item 1b). The same trick as the opening:
    // one-shots retriggered on a timer to fake a loop, and the CALLER raises
    // the pitch with the ride, so it climbs as you get up to speed instead of
    // droning at one note.
    //
    // TRIANGLE, not the sawtooth a driven roller would suggest. The audio
    // redesign banned square and saw outright and test_audio enforces it -
    // they are what made every synthesised sound in this game harsh on a
    // phone speaker. A triangle carried high and rolled off at 1.6k reads as
    // the same machine and does not buzz. The rule is older and better
    // reasoned than my preference for it.
    beltRide:     { kind: 'tone',  freq: 186, type: 'triangle', a: 0.02, h: 0.10, r: 0.18, gain: 0.10, vary: 0.02, lp: 1600 },

    // ---- RAIL SPINE. "The crush is only fair if you hear it coming."
    //
    // MovingFreight kills anything on the line in front of it, and the visual
    // warning is 200 units at 620 u/s - a third of a second, which is not a
    // warning, it is a verdict. THE SOUND IS THE WARNING: the rumble carries
    // four thousand units and the horn fires four seconds out.
    //
    // Low, dull and long, because a loaded freight train heard across a yard
    // is felt before it is heard. The noise component is most of it - rolling
    // stock is not a note.
    // ======================================================================
    // THE FIVE SIGNATURE SOUNDS (draft_audio.js)
    //
    // "If only five sounds get made properly, these are the five, and #1 is
    //  the one the whole combat design speaks through."
    //
    // #1 was already here (`connectorBreak`) and so was its opposite number,
    // but three of the five were not: the rip had no sound of its own, fitting
    // a part borrowed the UI click, and heat had one tone for three different
    // events. What follows is the rest of them.
    // ======================================================================

    // ---- #1's OTHER HALF ---------------------------------------------------
    // "A player must be able to tell these two apart WITH THEIR EYES SHUT - if
    //  they can't, the flanking mechanic is invisible in the audio channel."
    //
    // So this is built to be the ANTI-connectorBreak in every dimension the
    // synth has: it falls where the snap rises, it is dull where the snap is
    // bright (lp 700 against 1600), and it is over before the snap's ring has
    // started. A failure noise, deliberately worse.
    moduleDestroyed: { kind: 'thump', freq: 96, a: 0.004, h: 0.05, r: 0.10,
                       gain: 0.20, vary: 0.06, lp: 700, noise: 0.55 },

    // ---- #2 THE RIP, IN THREE STAGES --------------------------------------
    // "Three stages so the player hears their own progress." The rip is the
    // riskiest thing in the game - you have to be close and hold still - and
    // it was silent, so the risk had no voice.
    ripGrab:    { kind: 'tone',  freq: 88,  type: 'sine', a: 0.03, h: 0.14,
                  r: 0.22, gain: 0.16, vary: 0.03, lp: 900 },
    // "Rising metal groan - MUST sound like it might fail. Long enough to be
    //  frightening. THIS IS THE POINT." A full second, rising, and the only
    //  sound in the library whose job is to make you doubt.
    ripStrain:  { kind: 'sweep', from: 120, to: 232, a: 0.10, h: 0.55, r: 0.35,
                  gain: 0.22, vary: 0.02, lp: 1400, type: 'triangle' },
    // The payoff: the snap again, louder, plus the thunk of it landing on you.
    ripRelease: { kind: 'sweep', from: 620, to: 150, a: 0.004, h: 0.03, r: 0.30,
                  gain: 0.32, vary: 0.05, lp: 2400, type: 'triangle' },

    // ---- #3 BOLTING A PART ON ---------------------------------------------
    // "Heard hundreds of times: short, dry, low, and it must never get
    //  annoying." Which is a brief for what NOT to do: no ring, no sweep, no
    //  tail. A clunk and a lock, and out.
    partFitted: { kind: 'thump', freq: 132, a: 0.003, h: 0.035, r: 0.10,
                  gain: 0.17, vary: 0.08, lp: 1000, noise: 0.3 },

    // ---- #4 OVERHEAT, WHICH IS THREE EVENTS AND NOT ONE -------------------
    // "The only thing holding a permanent back, so it must be unmissable and
    //  legible mid-fight."
    //
    // A strain that builds over the last 20% of the bar; a hard mechanical
    // stop; and a READY TONE distinct enough to start firing again on WITHOUT
    // LOOKING AT THE HUD. That last one is why it is a clean rising interval
    // and nothing else in the library sounds like it.
    heatWarning: { kind: 'sweep', from: 300, to: 430, a: 0.06, h: 0.22, r: 0.30,
                   gain: 0.18, vary: 0.02, lp: 1800, type: 'sine' },
    heatCut:     { kind: 'thump', freq: 70,  a: 0.002, h: 0.06, r: 0.34,
                   gain: 0.26, vary: 0.02, lp: 800, noise: 0.7 },
    heatReady:   { kind: 'arp',   freq: 520, type: 'sine', a: 0.01, h: 0.05,
                   r: 0.14, gain: 0.20, vary: 0, lp: 3000, steps: 2, step: 1.33 },

    // ---- #5 THE ALERT LADDER ----------------------------------------------
    // "Three sounds, each further away, LAYERED not replaced." So each is
    // quieter and duller than the last rather than louder: the third is the
    // furthest away and the most frightening, and that is not a contradiction
    // - it is the point.
    //
    // "The SILENCE is the sound. A beat of nothing is more frightening than
    //  anything you could play." Alert 3 is the horn AND the gap after it;
    //  the gap belongs to the Director, not to this table.
    alert1: { kind: 'sweep', from: 260, to: 236, a: 0.10, h: 0.42, r: 0.55,
              gain: 0.16, vary: 0.01, lp: 900, type: 'sine' },
    alert2: { kind: 'sweep', from: 196, to: 174, a: 0.10, h: 0.48, r: 0.58,
              gain: 0.19, vary: 0.01, lp: 760, type: 'sine' },
    alert3: { kind: 'sweep', from: 104, to: 82, a: 0.14, h: 0.55, r: 0.50,
              gain: 0.24, vary: 0.01, lp: 520, type: 'sine' },

    // ---- THE SIX WEAPON FAMILIES ------------------------------------------
    // "Sound follows the SAME SIX FAMILIES as colour. A player who learned
    //  'orange means get out of the way' learns the matching sound once and it
    //  transfers to every weapon in the family."
    //
    // Four families already had a voice through a specific weapon. Two did not
    // and are added here; the mapping from class to family is WEAPON_FAMILY,
    // below, which is what makes it a family rather than a list.
    //
    // CONTACT (yellow): "grinding, tearing, physical. Pitch RISES as it bites."
    contact:  { kind: 'sweep', from: 150, to: 205, a: 0.02, h: 0.16, r: 0.18,
                gain: 0.15, vary: 0.05, lp: 1500, type: 'triangle' },
    // PLACED (lime): "a click on deploy, silence, then a very loud detonation."
    // The click only - the detonation is `explosion`, which already exists and
    // is already loud, and giving it a second one would be two explosions.
    placedClick: { kind: 'thump', freq: 210, a: 0.002, h: 0.02, r: 0.06,
                   gain: 0.13, vary: 0.05, lp: 2600 },

    // ---- THE AMBIENT BEDS --------------------------------------------------
    // "The soundtrack is the plant: conveyors, pour spouts, coolant, distant
    //  hammering. It should sound like standing inside a working factory at
    //  3am." Eleven districts, one bed each, retriggered on a slow timer -
    //  which is what a bed IS in a synth with no sample playback.
    //
    // Deliberately narrow: each is ONE gesture, because a bed you can pick
    // apart stops being a bed. The variety comes from the timer and from
    // `playAt`, not from the sound.
    bedIndustry: { kind: 'thump', freq: 52,  a: 0.14, h: 0.34, r: 0.55,
                   gain: 0.10, vary: 0.14, lp: 520, noise: 0.85 },
    bedWind:     { kind: 'noise', freq: 190, a: 0.35, h: 0.40, r: 0.44,
                   gain: 0.08, vary: 0.20, lp: 620 },
    bedDrip:     { kind: 'tone',  freq: 880, type: 'sine', a: 0.002, h: 0.02,
                   r: 0.16, gain: 0.07, vary: 0.30, lp: 3200 },
    bedNeon:     { kind: 'tone',  freq: 118, type: 'triangle', a: 0.10,
                   h: 0.34, r: 0.40, gain: 0.07, vary: 0.05, lp: 1500 },
    // "AIR CONDITIONING. Clean, quiet, and horrible." The only bed in the game
    // that is not made of broken things, and the last room in the game.
    bedClean:    { kind: 'noise', freq: 240, a: 0.40, h: 0.34, r: 0.40,
                   gain: 0.05, vary: 0.04, lp: 900 },
    // "BIRDS IN THE SPRAWL MATTER. They are the only living thing in the game,
    //  they are never seen, and they cost nothing."
    bedBirds:    { kind: 'arp',   freq: 1750, type: 'sine', a: 0.006, h: 0.03,
                   r: 0.09, gain: 0.05, vary: 0.22, lp: 4600, steps: 3,
                   step: 1.18 },

    railRumble:   { kind: 'thump', freq: 44,  a: 0.08, h: 0.38, r: 0.62, gain: 0.24, vary: 0.06, lp: 520, noise: 1.0 },
    // The horn. The ONE sound in this district that exists to save your life,
    // so it is the one that carries furthest and is least like anything else:
    // a long two-note fall, which is what every horn in the world does.
    railHorn:     { kind: 'sweep', from: 300, to: 196, a: 0.05, h: 0.45, r: 0.65, gain: 0.34, vary: 0.01, lp: 1100, type: 'triangle' },
    // And the pass: brief, bright-ish, and only when one goes by close.
    railPass:     { kind: 'noise', freq: 300, a: 0.03, h: 0.26, r: 0.45, gain: 0.20, vary: 0.10, lp: 1500 },

    // ---- Rewards: warm triangle arpeggios, not square stabs
    rankUp:       { kind: 'arp',  freq: 440, a: 0.01, h: 0.06, r: 0.24, gain: 0.20, vary: 0, lp: 2600 },
    unlock:       { kind: 'arp',  freq: 587, a: 0.01, h: 0.06, r: 0.26, gain: 0.20, vary: 0, lp: 2600 },
    levelUp:      { kind: 'arp',  freq: 392, a: 0.01, h: 0.05, r: 0.20, gain: 0.18, vary: 0, lp: 2600 },
    scrapped:     { kind: 'sweep', from: 340, to: 48, a: 0.02, h: 0.12, r: 0.90, gain: 0.34, vary: 0, lp: 900, type: 'triangle' },
    victory:      { kind: 'arp',  freq: 349, a: 0.02, h: 0.12, r: 0.45, gain: 0.26, vary: 0, lp: 3000 },
  },

  // Which recipe each weapon fires. Anything unlisted falls back to the
  // machine gun blip.
  // ---- THE SIX FAMILIES, AND WHICH CLASS IS IN WHICH ----------------------
  //
  // draft_audio.js: "A player must always be able to hear WHICH CLASS is
  // firing at them", and "variants SHARE their class's sound".
  //
  // WEAPON_SFX used to be eight hand-written class->sound pairs, which meant
  // the other twenty-odd weapon classes fired SILENTLY and a new one was
  // silent by default. Now a class names its FAMILY and the family owns the
  // sound, so adding a weapon is a line here and never a new sound - and the
  // failure mode is a wrong family rather than no sound at all.
  WEAPON_FAMILY: {
    // BULLETS (cyan): dry, fast, mechanical.
    machineGun: 'bullets', scattergun: 'bullets', burstRifle: 'bullets',
    plasmaRepeater: 'bullets', emergencyBlaster: 'bullets',
    // SHELLS (orange): a thump you feel, a delay, then the hit.
    cannon: 'shells', rocketPod: 'shells', mortar: 'shells',
    flakCannon: 'shells', flamethrower: 'shells',
    // BEAMS (red): continuous, electrical, no impact transient.
    beamLaser: 'beams', railgun: 'beams',
    // CONTACT (yellow): grinding, tearing, physical.
    saw: 'contact', drill: 'contact', harpoon: 'contact',
    // PLACED (lime): a click, silence, then a very loud detonation.
    mineLayer: 'placed', discLauncher: 'placed',
    // SHOCK (magenta): a crack and a discharge tail.
    arcGun: 'shock', shockwaveCannon: 'shock',
  },

  // What each family sounds like. The four that already had a voice keep it -
  // the machine gun IS the bullet family and always was.
  FAMILY_SFX: {
    bullets: 'machineGun', shells: 'cannon', beams: 'laser',
    contact: 'contact', placed: 'placedClick', shock: 'arc',
  },

  // The sound a weapon class makes. Asked through the family, with the
  // hand-written exceptions below still winning - a flamethrower is in the
  // shell family by CHARACTER and by colour, and still does not sound like a
  // cannon.
  weaponSfx(classId) {
    if (this.WEAPON_SFX[classId]) return this.WEAPON_SFX[classId];
    const fam = this.WEAPON_FAMILY[classId];
    return (fam && this.FAMILY_SFX[fam]) || null;
  },

  WEAPON_SFX: {
    machineGun: 'machineGun', scattergun: 'scattergun', cannon: 'cannon',
    railgun: 'railgun', rocketPod: 'rocket', flamethrower: 'flame',
    arcGun: 'arc', mineLayer: 'minePlace',
    // The two whose CHARACTER is not their family's -- a flamethrower is a
    // shell weapon and must still not sound like a cannon; a railgun is a beam
    // and still needs its own charge -- are the two already named on the line
    // above. They were written twice, and a repeated key in an object literal
    // is a silent overwrite: harmless here only because both copies said the
    // same thing. Found by tools/dupkeys.js.
  },

  // Throttle in seconds per sound id, so a wall of bullets stays a texture
  // rather than a distorted mess.
  THROTTLE: {
    machineGun: 0.045, flame: 0.07, saw: 0.12, laser: 0.09, arc: 0.05,
    // The two new weapon-family voices, throttled like the ones they stand
    // beside: a saw and a drill are the same family, and a drill firing
    // untethered would be a texture nobody asked for.
    contact: 0.12, placedClick: 0.08,
    // THE RIP'S STRAIN, retriggered every frame you hold it. Throttled
    // just under its own length so it reads as one continuous groan
    // getting longer rather than as a stutter.
    ripStrain: 0.28,
    // And the beds. Their pacing is Audio_.bed's jittered timer; this is
    // the safety net under it, exactly as it is for the belt.
    bedIndustry: 0.28, bedWind: 0.28, bedDrip: 0.22, bedNeon: 0.28,
    bedClean: 0.28, bedBirds: 0.22,
    // The belt and the shredder are ATMOSPHERE, retriggered on a ~0.45s
    // timer in OpeningScene to fake a loop out of one-shots. The throttle
    // is the safety net under that timer, not the pacing - without it a
    // dropped frame stacks them into a roar. It stays inside the 0.3s
    // ceiling every other sound is held to, because a throttle longer than
    // that starts swallowing sounds somebody meant to hear.
    beltGrind: 0.25, shredder: 0.20, beltRide: 0.12,
    // The rumble is atmosphere retriggered on a timer, like the belt.
    // The horn is NOT throttled at the source - it is fired once per
    // approach by the train itself, which is a better gate than a timer.
    railRumble: 0.28, railPass: 0.25,
    metalHit: 0.035, connectorHit: 0.04, scattergun: 0.05,
  },

  // ---- A SOUND THAT HAS A PLACE IN THE WORLD -----------------------------
  //
  // CONTENT_AUDIO Part 5: "Sound sources placed in the world, audible from a
  // distance, that make it feel occupied: a stuck conveyor, a hammering press,
  // a phone ringing somewhere in the Sprawl and never answered. THESE ARE THE
  // BEST VALUE-PER-EFFORT AUDIO IN THE WHOLE GAME."
  //
  // Every one of them needs the same thing and none of them could have it:
  // `play` had no position, so a sound was either at full volume everywhere or
  // nowhere. This is that thing, once, so the freight, the pour spouts and the
  // phone all use one falloff and the world has one sense of distance.
  //
  // The listener is the CAMERA, not the player: the camera is what the player
  // is looking through, and on a dead-zone camera those are not the same point.
  HEAR_NEAR: 900,          // full volume within this
  HEAR_FAR: 5200,          // silent beyond it

  // How loud something at (x, y) should be, 0..1. Public because the freight
  // needs to know whether it is worth playing at all before it plays.
  audibility(x, y) {
    let lx = 0, ly = 0;
    if (typeof Camera !== 'undefined') { lx = Camera.x; ly = Camera.y; }
    const d = Math.hypot(x - lx, y - ly);
    if (d <= this.HEAR_NEAR) return 1;
    if (d >= this.HEAR_FAR) return 0;
    // Linear in distance rather than in energy: the point is legibility, not
    // physics, and a physical rolloff makes everything inaudible too early.
    const t = 1 - (d - this.HEAR_NEAR) / (this.HEAR_FAR - this.HEAR_NEAR);
    return t * t;          // squared, so far-away things sit under near ones
  },

  playAt(id, x, y, opts) {
    const g = this.audibility(x, y);
    if (g <= 0.02) return false;
    const o = Object.assign({}, opts || {});
    o.gain = (o.gain === undefined ? 1 : o.gain) * g;
    return this.play(id, o);
  },

  // ---- THE AMBIENT BED ---------------------------------------------------
  //
  // "The machines make the noise. No licensed music, no score, no drop. The
  //  soundtrack IS the plant. It should sound like standing inside a working
  //  factory at 3am."
  //
  // Eleven districts, one bed each, from draft_audio's own descriptions. A bed
  // in a synth with no sample playback is a sound retriggered on a slow,
  // JITTERED timer - and the jitter is most of the work, because a bed on an
  // exact period stops being a room and becomes a metronome.
  //
  // PLACED, not global. Each hit goes down at a random point around the player
  // and through `playAt`, so it arrives from a direction and at a distance.
  // That is the difference between a room and a volume slider.
  BEDS: {
    yard:      { id: 'bedIndustry', every: 5.2 },
    ironworks: { id: 'bedIndustry', every: 3.4 },
    sprawl:    { id: 'bedBirds',    every: 7.5 },
    neoncut:   { id: 'bedNeon',     every: 4.6 },
    // "Wind. Almost nothing else. THE QUIET IS THE POINT." The longest gap in
    // the table, deliberately: the Barrens is the one district allowed to have
    // nothing in it.
    barrens:   { id: 'bedWind',     every: 11.0 },
    railspine: { id: 'bedIndustry', every: 6.0 },
    grows:     { id: 'bedWind',     every: 6.5 },
    digs:      { id: 'bedIndustry', every: 4.2 },
    sumpworks: { id: 'bedDrip',     every: 3.0 },
    stacks:    { id: 'bedWind',     every: 5.5 },
    // "AIR CONDITIONING. Clean, quiet, and horrible." The only bed in the game
    // that is not made of broken things.
    dispatch:  { id: 'bedClean',    every: 3.8 },
  },
  BED_R: 2200,              // how far out a bed hit is placed

  _bedT: 0,
  _bedFor: null,

  // Called once a frame with wherever the player is. SILENT for a district
  // with no bed rather than falling back to one - a lair with the Ironworks'
  // hammering in it would be the same mistake the outdoor renderer was making
  // indoors, and that one took a screenshot to find.
  bed(dt, districtId, x, y) {
    if (this._bedFor !== districtId) {
      this._bedFor = districtId;
      this._bedT = 0.9;               // a beat after arriving, not on it
    }
    const B = this.BEDS[districtId];
    if (!B) return false;
    this._bedT -= dt;
    if (this._bedT > 0) return false;
    this._bedT = B.every * (0.6 + Math.random() * 0.8);   // +/-40%
    const a = Math.random() * Math.PI * 2;
    const r = this.BED_R * (0.35 + Math.random() * 0.65);
    return this.playAt(B.id, x + Math.cos(a) * r, y + Math.sin(a) * r);
  },

  play(id, opts) {
    if (!this.ready || this.blocked) return false;
    if (this.ctx.state === 'suspended') return false;
    const def = this.DEFS[id];
    if (!def) return false;
    if (this._voices > this.MAX_VOICES) return false;

    const t = this._now();
    const gap = this.THROTTLE[id];
    if (gap) {
      if (this._lastPlay[id] && t - this._lastPlay[id] < gap) return false;
      this._lastPlay[id] = t;
    }

    const o = opts || {};
    const vary = def.vary || 0;
    const pitch = (1 + (Math.random() * 2 - 1) * vary) * (o.pitch || 1);
    const gain = (def.gain || 0.2) * (o.gain !== undefined ? o.gain : 1);

    try {
      this._render(def, t, pitch, gain);
    } catch (e) { /* never let audio break the frame */ }
    return true;
  },

  // Per-sound low-pass. Synthesised SFX are harsh mainly because they carry
  // energy far above where a phone speaker is pleasant; rolling each sound off
  // at its own corner frequency is most of the difference between "annoying"
  // and "punchy".
  _shaped(t, dur, cutoff) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    // Slight downward sweep gives every hit a natural "settling" tail.
    f.frequency.exponentialRampToValueAtTime(Math.max(180, cutoff * 0.55), t + dur);
    f.Q.value = 0.7;
    return f;
  },

  _render(def, t, pitch, gain) {
    const ctx = this.ctx;
    const dur = (def.a || 0) + (def.h || 0) + (def.r || 0);
    const lp = def.lp || 4000;

    if (def.kind === 'thump') {
      // Percussive body: a short pitch-dropping sine plus filtered noise.
      // This replaces the old square-wave blip that made repeated fire buzz.
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(def.freq * pitch * 1.6, t);
      osc.frequency.exponentialRampToValueAtTime(def.freq * pitch * 0.7, t + dur);
      const bf = this._shaped(t, dur, lp);
      osc.connect(bf);
      this._env(bf, t, def.a, def.h, def.r, gain);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      if (def.noise) {
        const n = this._noise(dur);
        const nf = this._shaped(t, dur, lp * 1.4);
        n.connect(nf);
        this._env(nf, t, def.a, def.h * 0.6, def.r * 0.7, gain * def.noise * 0.55);
        n.start(t);
      }
      return;
    }
    if (def.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = def.type || 'triangle';
      osc.frequency.setValueAtTime(def.freq * pitch, t);
      const tf = this._shaped(t, dur, lp);
      osc.connect(tf);
      this._env(tf, t, def.a, def.h, def.r, gain);
      osc.start(t);
      osc.stop(t + def.a + def.h + def.r + 0.02);
      if (def.noise) {
        const n = this._noise(def.a + def.h + def.r);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1800 * pitch;
        n.connect(f);
        this._env(f, t, def.a, def.h, def.r, gain * def.noise);
        n.start(t);
      }
    } else if (def.kind === 'noise') {
      const dur = def.a + def.h + def.r;
      const n = this._noise(dur);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(def.freq * pitch, t);
      f.Q.value = 0.9;                 // wider = airier, less whistly
      n.connect(f);
      this._env(f, t, def.a, def.h, def.r, gain);
      n.start(t);
    } else if (def.kind === 'boom') {
      // Low sine drop + a noise transient: reads as a heavy impact.
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(def.freq * pitch * 2.2, t);
      osc.frequency.exponentialRampToValueAtTime(def.freq * pitch * 0.5,
        t + def.a + def.h + def.r);
      this._env(osc, t, def.a, def.h, def.r, gain);
      osc.start(t);
      osc.stop(t + def.a + def.h + def.r + 0.02);
      const n = this._noise(def.a + def.h + def.r * 0.6);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      n.connect(f);
      this._env(f, t, def.a, def.h * 0.5, def.r * 0.5, gain * 0.7);
      n.start(t);
    } else if (def.kind === 'sweep') {
      const osc = ctx.createOscillator();
      osc.type = def.type || 'triangle';
      osc.frequency.setValueAtTime(def.from * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, def.to * pitch),
        t + def.a + def.h + def.r);
      const f = this._shaped(t, dur, lp);
      osc.connect(f);
      this._env(f, t, def.a, def.h, def.r, gain);
      osc.start(t);
      osc.stop(t + def.a + def.h + def.r + 0.02);
    } else if (def.kind === 'clank') {
      // Two detuned metallic partials — the signature attach sound (§74).
      for (const [mul, g] of [[1, 1], [2.76, 0.5], [5.4, 0.25]]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(def.freq * pitch * mul, t);
        this._env(osc, t, def.a, def.h, def.r * (1 / mul + 0.25), gain * g);
        osc.start(t);
        osc.stop(t + def.a + def.h + def.r + 0.05);
      }
      const n = this._noise(0.05);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2400;
      n.connect(f);
      this._env(f, t, 0.001, 0.008, 0.04, gain * 0.5);
      n.start(t);
    } else if (def.kind === 'arp') {
      // Little rising figure. FOUR NOTES - a major triad and the octave - is
      // the reward shape, and every unlock in the game uses it.
      //
      // `steps` and `step` open it up for the two entries that want the SHAPE
      // and not the fanfare: the heat READY tone (two notes, a clean interval,
      // recognisable without looking at the HUD) and the birds in the Sprawl
      // (three short chirps). Written because those two declared the fields
      // and this function did not read them, which is exactly the fault this
      // session has spent its time deleting.
      const n = def.steps || 4;
      const gap = def.gap || 0.07;
      for (let i = 0; i < n; i++) {
        const osc = ctx.createOscillator();
        osc.type = def.type || 'triangle';   // warmer than square for rewards
        const f = def.step
          ? def.freq * Math.pow(def.step, i)
          : def.freq * Math.pow(2, [0, 4, 7, 12][i % 4] / 12);
        const st = t + i * gap;
        osc.frequency.setValueAtTime(f, st);
        this._env(osc, st, def.a, def.h, def.r, gain * 0.5);
        osc.start(st);
        osc.stop(st + def.a + def.h + def.r + 0.02);
      }
    }
  },

  // ---- music (plan §66: four loops) --------------------------------------
  // Also synthesised: a slow bass pulse plus a sparse arpeggio per zone, with
  // the boss variant simply adding percussion and filter movement rather than
  // being a separate track.
  MUSIC: {
    menu:      { root: 110, tempo: 1.10, scale: [0, 3, 7, 10], wave: 'triangle' },
    scrapyard: { root: 98,  tempo: 0.85, scale: [0, 3, 5, 7], wave: 'square' },
    foundry:   { root: 87,  tempo: 0.72, scale: [0, 2, 3, 7], wave: 'sawtooth' },
    coreworks: { root: 123, tempo: 0.62, scale: [0, 1, 5, 8], wave: 'square' },
  },

  // CONTENT_AUDIO, "Music -- used four times and no more": the menu; "FIRST
  // ENTRY TO A DISTRICT -- 20 seconds, then it fades into the ambient bed";
  // boss fights; the endings. "No combat music otherwise. The plant is the
  // soundtrack." Game.switch('GAME') played WRECKJACK's arena loop on every
  // entry and never stopped it, over the bed, for the whole session -- the
  // one thing the audio document says the game must not do. Found by
  // unwire --boot: playMusic could be stubbed and nothing noticed.
  ENTRY_MUSIC: 20,          // seconds a district's entry music runs
  MUSIC_FADE: 4,            // and the tail it fades over, into the bed
  _musicLeft: 0,            // seconds left on a timed piece; 0 = untimed

  // A piece that stops itself. Ticked by the game loop (musicTick), not by
  // a wall-clock timer, so a paused game holds it and a suite can drive it.
  playMusicFor(key, secs, intense) {
    this.playMusic(key, intense);
    this._musicLeft = this._music ? Math.max(0, secs || 0) : 0;
    this._musicSecs = this._musicLeft;
  },

  musicTick(dt) {
    if (!this._music || !(this._musicLeft > 0)) return;
    this._musicLeft = Math.max(0, this._musicLeft - dt);
    // The fade, on the music bus: the volume the settings ask for, scaled
    // down over the last MUSIC_FADE seconds, and put back by applyVolumes
    // when the next piece starts.
    if (this.ready && this.musicGain) {
      const g = (typeof Settings !== 'undefined' ? Settings.get('musicVolume') : 70) / 100 * 0.5;
      this.musicGain.gain.value = g * Math.min(1, this._musicLeft / this.MUSIC_FADE);
    }
    if (this._musicLeft <= 0) this.stopMusic();
  },

  playMusic(key, intense) {
    if (!this.ready || this.blocked) return;
    if (this._music && this._music.key === key && this._music.intense === !!intense) return;
    this.stopMusic();
    const def = this.MUSIC[key];
    if (!def) return;
    this._musicLeft = 0;
    this.applyVolumes();
    this._music = { key, intense: !!intense, step: 0, timer: null };
    const beat = def.tempo * (intense ? 0.72 : 1);
    const tick = () => {
      if (!this._music || this._music.key !== key) return;
      try { this._musicStep(def, this._music.step++, !!intense); } catch (e) {}
      this._music.timer = setTimeout(tick, beat * 1000);
    };
    tick();
  },

  _musicStep(def, step, intense) {
    if (!this.ready || this.ctx.state === 'suspended') return;
    const t = this._now();
    const ctx = this.ctx;
    // Bass pulse on every step
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(def.root / 2, t);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    bass.connect(bg); bg.connect(this.musicGain);
    bass.start(t); bass.stop(t + 0.55);

    // Sparse melody note
    if (step % 2 === 0 || intense) {
      const semi = def.scale[(step * 3) % def.scale.length] +
        (step % 8 < 4 ? 0 : 12);
      const osc = ctx.createOscillator();
      osc.type = def.wave;
      osc.frequency.setValueAtTime(def.root * Math.pow(2, semi / 12), t);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(intense ? 2600 : 1400, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(f); f.connect(g); g.connect(this.musicGain);
      osc.start(t); osc.stop(t + 0.45);
    }

    // Boss intensity: extra percussion (plan §66 — no separate boss tracks)
    if (intense) {
      const n = this._noise(0.09);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 3200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      n.connect(f); f.connect(g); g.connect(this.musicGain);
      n.start(t);
    }
  },

  stopMusic() {
    if (this._music && this._music.timer) clearTimeout(this._music.timer);
    this._music = null;
    this._musicLeft = 0;
  },
};

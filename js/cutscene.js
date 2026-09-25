// SCRAPCORE: BREAKLANDS — Cutscenes (device feedback: transitions felt flat)
//
// Deliberately CHEAP and SHORT. These are comic panels with camera drift, not
// animation: a hero render slides and scales behind an inked frame while a line
// of text types on. Nothing here loads new geometry at runtime, and every
// cutscene is skippable with a tap.
//
// Design rules, learned from the plan's own pacing targets:
//   * a boss intro is ~2.6s, a zone card ~2.2s, the run opener ~3.2s
//   * they NEVER block a retry — the player has seen it by run three
//   * if the hero art is missing, the cutscene still plays as a text card

const CUTSCENES = {
  runStart: {
    dur: 3.2,
    // hero deliberately omitted: the only Core image is a weak software
    // render, and a clean text card beats bad art. Restore a hero when the
    // 44-degree Jackal render exists (M3 art gate).
    title: 'JACKAL',
    line: 'ONLINE',
    sub: 'THE ONLY ONE THAT MOVES',
    color: '#22d9ff',
    warn: true,
    zoom: [1.35, 1.0],          // drift in
    drift: [-40, 0],
  },
  zone1: { dur: 2.2, title: 'ZONE 1', line: 'SCRAP YARD',
           sub: 'RECLAMATION SECTOR', color: '#ff7a1a', floor: 'floor_scrapyard',
           zoom: [1.0, 1.18], drift: [0, -30] },
  zone2: { dur: 2.2, title: 'ZONE 2', line: 'FOUNDRY',
           sub: 'THERMAL PROCESSING', color: '#ff3b3b', floor: 'floor_foundry',
           zoom: [1.0, 1.18], drift: [0, -30] },
  zone3: { dur: 2.2, title: 'ZONE 3', line: 'COREWORKS',
           sub: 'CONTROL SUBSTRATE', color: '#22d9ff', floor: 'floor_coreworks',
           zoom: [1.0, 1.18], drift: [0, -30] },
  crusher: { dur: 2.6, hero: 'hero_crusher', title: 'CRUSHER',
             line: 'RECYCLING UNIT DEPLOYED', sub: 'THREAT: HEAVY',
             color: '#ff3b3b', warn: true, zoom: [1.5, 1.05], drift: [60, 0] },
  furnace: { dur: 2.6, hero: 'hero_furnace', title: 'FURNACE',
             line: 'THERMAL PURGE AUTHORISED', sub: 'THREAT: EXTREME',
             color: '#ff7a1a', warn: true, zoom: [1.5, 1.05], drift: [-60, 0] },
  // The Foreman render is a straight-on T-pose — a modelling reference stance,
  // which on an ordinary card reads as a mannequin (the exact failure noted in
  // HANDOVER §34). So the pose becomes the premise: this is Zero SCANNING it.
  // `scan: true` adds the sweep line, the frame and the stat readout.
  foreman: { dur: 3.4, hero: 'hero_foreman', title: 'FOREMAN',
             line: 'THREAT ASSESSMENT COMPLETE', sub: 'IT SALVAGES. LIKE YOU DO.',
             color: '#22d9ff', warn: true, scan: true,
             zoom: [1.06, 1.0], drift: [0, 0] },
};

// Stats for the scan readout are READ FROM THE GAME, never written here, so a
// rebalance can't leave the card telling the player something untrue.
function foremanScanRows() {
  const rows = [];
  const haveBoss = typeof ForemanBoss !== 'undefined';
  const haveParts = typeof PARTS !== 'undefined';
  rows.push(['INTEGRITY', String(haveBoss ? ForemanBoss.MAX_HP : '—')]);

  const ids = (haveBoss && ForemanBoss.LOADOUT) ? ForemanBoss.LOADOUT.map(e => e[0]) : [];
  const named = cat => ids
    .filter(id => haveParts && PARTS[id] && PARTS[id].category === cat)
    .map(id => PARTS[id].name.toUpperCase());

  const guns = named('weapon');
  if (guns.length) rows.push(['ARMAMENT', guns.join(' / ')]);
  const def = named('defence');
  if (def.length) rows.push(['DEFENCE', def.join(' / ')]);

  // The lesson of the fight, not a stat: it rebuilds itself off the floor.
  rows.push(['WEAKNESS', 'DENY IT SALVAGE']);
  return rows;
}

// ===========================================================================
// PLAYTEST 2, ITEM 5 - THE COLD OPEN.
//
// Aaron wants an opening, and a story that plays as a mystery the player
// wants to solve. What was there was WRECKJACK's: six text cards about Yard
// 13, Crown Forge and six unfinished Jackrigs - a different game's premise,
// read off a black screen before anything has happened.
//
// CONTENT_OPENING.md already had the right one, and it opens with the single
// strongest idea in the document:
//
//     "You wake up already being taken somewhere. [...] The first thing the
//      game teaches is that you are cargo."
//
// So the cold open is forty seconds ON THE BELT. No card explains it. You
// hear machinery before you can see anything, the light comes up on a sorting
// belt carrying you toward a shredder, other units go in ahead of you, and
// then your eye comes on. The belt stops. Nobody says why. The first line of
// dialogue in the game is Mags noticing that two impossible things have
// already happened.
//
// EVERY BEAT IS PRIMITIVES. The standing rule is that sprites are optional,
// and an opening that needs art nobody has drawn yet is an opening that does
// not ship. A belt is slats, a shredder is teeth, a crane is an arm.
// ===========================================================================

const OPENING = {
  // ~40 seconds, and the durations are the pacing: three long beats where
  // nothing happens on purpose, because the point of the scene is that
  // nothing is going to happen. You are cargo.
  beats: [
    // 1. BLACK. Machinery, and one sentence. The war is over and lost, and
    //    it is not what the game is about - it is just why the world is
    //    like this.
    { id: 'black', dur: 6.0, dark: 1.0, belt: 1, shred: 0.12,
      text: 'The war ended four hundred years ago.' },

    // 2. THE LIGHT COMES UP ON THE BELT. Scrap, and other units, going the
    //    same way you are. Nothing is said about it.
    { id: 'belt', dur: 8.0, dark: 0.0, belt: 1, shred: 0.30 },

    // 3. YOUR EYE COMES ON. This is the whole reclassification mystery in
    //    two words, and the game will not mention it again for an hour.
    { id: 'wake', dur: 5.0, dark: 0, belt: 1, shred: 0.45, eye: 1,
      log: 'unit active.' },

    // 4. ONE BELT-LENGTH OF NOTHING, while the shredder gets loud. The
    //    longest beat, and deliberately: the player has just worked out
    //    where the belt goes and can do nothing at all about it.
    { id: 'approach', dur: 9.0, dark: 0, belt: 1, shred: 1.0, eye: 1 },

    // 5. THE BELT STOPS. Silence, which after nine seconds of shredder is
    //    the loudest thing in the scene. A crane swings across and holds.
    { id: 'stop', dur: 6.0, dark: 0, belt: 0, shred: 0.18, eye: 1, crane: 1 },

    // 6. THE FIRST LINE ANYONE SAYS TO YOU.
    { id: 'mags', dur: 6.0, dark: 0, belt: 0, shred: 0.15, eye: 1, crane: 1,
      speaker: 'MAGS',
      line: "Belt's stopped. You're upright. Both of those took some doing." },
  ],
};

// HOW LONG IT RUNS. Derived, never typed - a beat retimed during a pacing
// pass would otherwise leave every waiting caller counting the old length.
OPENING.dur = OPENING.beats.reduce((n, b) => n + b.dur, 0);

// The scene itself. One continuous world with a few numbers that the beats
// steer - the belt does not restart between beats, it slows down, and the
// shredder does not cut, it gets louder. Cross-fading STATE rather than
// cutting between panels is what keeps forty seconds of it from reading as
// six slides.
const OpeningScene = {
  t: 0,             // seconds since the sequence began
  scroll: 0,        // how far the belt has carried everything
  belt: 1,          // current belt speed, eased toward the beat's target
  shred: 0.12,      // current shredder loudness, likewise
  eye: 0,           // CLIP's eye light, 0 until beat 3
  crane: 0,         // crane arm sweep, 0 until beat 5
  dark: 1,          // 1 = black screen
  _sfx: 0,
  SPEED: 300,       // belt units per second at full speed

  reset() {
    this.t = 0; this.scroll = 0; this.belt = 1; this.shred = 0.12;
    this.eye = 0; this.crane = 0; this.dark = 1; this._sfx = 0;
    this._scrap = null;
  },

  // Deterministic scrap, so the opening is the same every time it is watched
  // and identical in a screenshot taken twice.
  _seedScrap() {
    this._scrap = [];
    let n = 0x811c9dc5;
    const rnd = () => {
      n = Math.imul(n ^ (n >>> 15), 0x2545f491) >>> 0;
      return n / 4294967296;
    };
    for (let i = 0; i < 26; i++) {
      this._scrap.push({
        lane: rnd(),                 // 0..1 across the belt
        at: rnd() * 3000,            // position along it
        w: 30 + rnd() * 90,
        h: 22 + rnd() * 70,
        rot: rnd() * Math.PI,
        unit: rnd() < 0.28,          // a machine, not a plate: these go in
        tone: rnd(),
      });
    }
  },

  update(dt, beat) {
    this.t += dt;
    // Ease toward the beat's targets. The belt takes about a second and a
    // half to stop, because a loaded belt does not stop instantly and the
    // moment it does is the beat.
    const ease = (cur, target, rate) =>
      cur + (target - cur) * Math.min(1, dt * rate);
    this.belt = ease(this.belt, beat.belt === undefined ? 1 : beat.belt, 2.2);
    this.shred = ease(this.shred, beat.shred === undefined ? 0.3 : beat.shred, 1.4);
    this.eye = ease(this.eye, beat.eye || 0, 3.0);
    this.crane = ease(this.crane, beat.crane || 0, 1.1);
    this.dark = ease(this.dark, beat.dark === undefined ? 0 : beat.dark, 2.0);
    this.scroll += this.belt * this.SPEED * dt;

    // Atmosphere, retriggered on a timer. The throttle in Audio_ stops a
    // dropped frame stacking these into a roar.
    this._sfx += dt;
    if (this._sfx > 0.45 && typeof Audio_ !== 'undefined') {
      this._sfx = 0;
      if (this.belt > 0.08) Audio_.play('beltGrind', { gain: 0.55 + this.belt * 0.5 });
      if (this.shred > 0.05) Audio_.play('shredder', { gain: this.shred });
    }
  },

  draw(ctx) {
    const v = Display.viewRect();
    if (!this._scrap) this._seedScrap();

    // Looking DOWN at the belt. It runs up the screen and the shredder is at
    // the top, so "where this is going" is a fact of the composition rather
    // than something a line of text has to say.
    const bw = Math.min(720, v.w * 0.46);
    const bx = v.x + v.w / 2 - bw / 2;
    // Low enough to be a place you are being taken TO. At 0.16 it sat
    // right under the letterbox bar and read as a ceiling.
    const maw = v.y + v.h * 0.27;          // the shredder's mouth

    R.rect(v.x, v.y, v.w, v.h, '#07080e');

    // The floor either side: sorted metal, to the horizon.
    for (let i = 0; i < 40; i++) {
      const h = ((i * 137) % 97) / 97;
      const y = v.y + h * v.h;
      const w = 40 + ((i * 61) % 160);
      const x = (i % 2 === 0) ? bx - 60 - ((i * 83) % 520)
                              : bx + bw + 20 + ((i * 71) % 520);
      R.rect(x, y, w, 10 + ((i * 29) % 26), '#12141b');
    }

    // THE BELT BED.
    R.rect(bx - 26, v.y, 26, v.h, '#1b1f2b');
    R.rect(bx + bw, v.y, 26, v.h, '#1b1f2b');
    R.rect(bx, v.y, bw, v.h, '#0f1219');

    // SLATS, scrolling toward the maw. This is the only thing on screen that
    // says you are moving, so it carries the whole first beat.
    const gap = 74;
    const off = this.scroll % gap;
    ctx.save();
    for (let y = v.y + v.h + gap; y > v.y - gap; y -= gap) {
      const sy = y - off;
      R.rect(bx, sy, bw, 5, '#1d2230');
      R.rect(bx, sy + 5, bw, 3, '#080a10');
    }
    ctx.restore();

    // WHAT IS ON THE BELT WITH YOU. Plates, and units - other machines,
    // going in ahead of you, which is the beat that makes the maw mean
    // something without a word being said about it.
    const span = v.h + 600;
    for (const sc of this._scrap) {
      let y = v.y + v.h + 200 - ((sc.at + this.scroll) % span);
      if (y < maw - 40) continue;          // gone in
      const x = bx + 50 + sc.lane * (bw - 100);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sc.rot);
      if (sc.unit) {
        R.circle(0, 0, sc.w * 0.34, '#20242f', '#0a0c12', 4);
        R.rect(-sc.w * 0.42, -6, sc.w * 0.84, 12, '#171b25');
      } else {
        R.rect(-sc.w / 2, -sc.h / 2, sc.w, sc.h,
          sc.tone > 0.6 ? '#232733' : '#1a1e28', '#0a0c12', 3);
      }
      ctx.restore();
    }

    // CLIP. A bare core, no guns, nothing bolted on - which is what the
    // player is about to be handed and why the first gun in the game feels
    // like something.
    const px = bx + bw * 0.5;
    const py = v.y + v.h * 0.62;
    R.circle(px + 8, py + 12, 66, 'rgba(0,0,0,0.5)');
    R.circle(px, py, 64, '#2a3140', '#0a0c12', 7);
    R.circle(px, py, 40, '#333c50', '#0a0c12', 5);
    // Four bare sockets, empty, which is the thing the whole first hour is
    // about filling.
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + i / 4 * Math.PI * 2;
      R.circle(px + Math.cos(a) * 64, py + Math.sin(a) * 64, 13,
        '#1b2029', '#0a0c12', 4);
    }
    // The eye. Everything about beat 3 is this dot.
    if (this.eye > 0.01) {
      const flick = this.eye > 0.9 ? 1
        : (Math.sin(this.t * 41) > -0.2 ? 1 : 0.15);
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.eye) * flick;
      R.circle(px, py, 18, CONFIG.COLOR.cyan);
      ctx.globalAlpha = Math.min(1, this.eye) * flick * 0.30;
      R.circle(px, py, 44, CONFIG.COLOR.cyan);
      ctx.restore();
    }

    // THE SHREDDER. A dark band across the top with teeth, and sparks coming
    // off whatever went in last. It gets brighter and busier with `shred`,
    // so beat 4's rising tension is a real change on screen and not just a
    // change in the sound.
    R.rect(v.x, v.y, v.w, maw - v.y, '#05060a');
    ctx.save();
    // THE GLOW COMES OUT OF IT, ONTO THE BELT. The first pass painted this
    // gradient ABOVE the mouth, inside the dark band, which lit the band and
    // made the whole thing read as a warmly lit ceiling with a decorative
    // frieze under it. The light has to fall on the thing being fed in.
    // Falls off FAST. At full loudness the first version laid a solid orange
    // slab over the top third of the belt and buried everything on it - the
    // scrap you are queued behind stopped being visible at exactly the beat
    // where it matters most.
    const g = ctx.createLinearGradient(0, maw, 0, maw + 170);
    g.addColorStop(0, 'rgba(255,122,26,' + (0.10 + this.shred * 0.26).toFixed(3) + ')');
    g.addColorStop(0.35, 'rgba(255,122,26,' + (0.05 + this.shred * 0.11).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,122,26,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - 40, maw, bw + 80, 170);

    // TEETH HANGING DOWN out of the dark, biting toward the player. They
    // pointed up before, away from the belt, which is a decoration rather
    // than a threat.
    for (let i = 0; i < 22; i++) {
      const tx = bx - 20 + i * ((bw + 40) / 21);
      const bite = (Math.sin(this.t * 6 + i) * 0.5 + 0.5) * 14 * (0.4 + this.shred);
      ctx.beginPath();
      ctx.moveTo(tx, maw - 6);
      ctx.lineTo(tx + 16, maw + 30 + bite);
      ctx.lineTo(tx + 32, maw - 6);
      ctx.closePath();
      ctx.fillStyle = '#12141b';
      ctx.fill();
      ctx.strokeStyle = '#05060a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // The lip of the housing, so the teeth hang off something solid, and a
    // black throat behind them - a mouth with nothing visible in it reads as
    // deeper than one with a wall at the back.
    R.rect(bx - 40, maw - 8, bw + 80, 22, 'rgba(4,5,9,0.85)');
    R.rect(bx - 44, maw - 30, bw + 88, 26, '#151822', '#05060a', 4);
    // sparks
    const sparks = Math.round(this.shred * 26);
    for (let i = 0; i < sparks; i++) {
      const a = (this.t * 3 + i * 1.7) % 1;
      const sx = bx + 40 + ((i * 137) % Math.max(1, bw - 80));
      const sy = maw + 6 + a * 150;
      ctx.globalAlpha = (1 - a) * 0.9;
      R.circle(sx, sy, 2 + (1 - a) * 3, i % 3 ? '#ffd23f' : '#ff7a1a');
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // THE CRANE. Swings in from the left and HOLDS - it does not do
    // anything, it does not pick you up, it just stops over you and stays
    // there. Somebody or something stopped this belt and the game is not
    // going to tell you who for a long time.
    if (this.crane > 0.01) {
      const k = Math.min(1, this.crane);
      const armY = v.y + v.h * 0.40;
      const reach = v.x + (px - v.x) * k + 60;
      ctx.save();
      ctx.globalAlpha = k;
      // A TRUSS, not a bar. The first pass drew one flat pale rectangle
      // across the frame, which read as a UI element laid over the scene
      // rather than as a gantry crane in the room with you.
      const top = armY - 30, bot = armY + 30;
      R.rect(v.x - 40, top, reach - v.x + 40, 9, '#2a3143', '#0a0c12', 4);
      R.rect(v.x - 40, bot - 9, reach - v.x + 40, 9, '#212736', '#0a0c12', 4);
      ctx.strokeStyle = '#232838';
      ctx.lineWidth = 6;
      for (let x = v.x - 20; x < reach - 30; x += 78) {
        ctx.beginPath();
        ctx.moveTo(x, top + 9); ctx.lineTo(x + 39, bot - 9);
        ctx.lineTo(x + 78, top + 9);
        ctx.stroke();
      }
      // The trolley, and the magnet hanging off it - UNLIT. It is not here
      // to lift you. It came across, and it stopped, and that is all.
      R.rect(reach - 40, top - 16, 80, 92, '#333b4f', '#0a0c12', 5);
      ctx.strokeStyle = '#0a0c12';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(reach, bot); ctx.lineTo(reach, armY + 96);
      ctx.stroke();
      R.circle(reach, armY + 118, 34, '#1a1f2b', '#0a0c12', 6);
      R.rect(reach - 34, armY + 118, 68, 14, '#12161f', '#0a0c12', 4);
      ctx.globalAlpha = k * 0.30;
      R.rect(reach - 34, armY + 132, 68, v.h, 'rgba(0,0,0,0.6)');
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // The darkness of beat 1, over the top of everything, so beat 2 is the
    // same shot with the light coming up rather than a cut to a new one.
    if (this.dark > 0.002) {
      ctx.globalAlpha = Math.min(1, this.dark);
      R.rect(v.x, v.y, v.w, v.h, '#000000');
      ctx.globalAlpha = 1;
    }
  },
};

const Cutscene = {
  active: null,
  t: 0,
  onDone: null,

  // ---- SEQUENCES (item 5) ------------------------------------------------
  // A card is one panel with a duration. The cold open is six beats over a
  // continuous scene, and cutting it into six independent cards would make
  // it read as six slides - the belt has to keep moving THROUGH the beat
  // change, and the shredder has to get louder across it.
  //
  // So a sequence is a beat list plus a scene that owns the continuous
  // state. The beats steer the scene; the scene draws. Skipping is the same
  // gesture at either level, because a player who wants out wants out.
  seq: null,
  seqScene: null,
  beat: 0,
  beatT: 0,

  play(key, onDone) {
    const def = CUTSCENES[key];
    if (!def) { if (onDone) onDone(); return false; }
    this.active = def;
    this.t = 0;
    this.onDone = onDone || null;
    if (typeof Audio_ !== 'undefined') {
      Audio_.play(def.warn ? 'bossWarn' : 'uiTap', { gain: def.warn ? 1 : 0.6 });
    }
    return true;
  },

  get playing() { return !!this.active || !!this.seq; },

  // Play a beat sequence over a scene. `scene` needs reset(), update(dt,
  // beat) and draw(ctx); everything else about how it looks is its own.
  playSequence(seq, scene, onDone) {
    if (!seq || !seq.beats || !seq.beats.length) { if (onDone) onDone(); return false; }
    this.seq = seq;
    this.seqScene = scene;
    this.beat = 0;
    this.beatT = 0;
    this.onDone = onDone || null;
    if (scene && scene.reset) scene.reset();
    return true;
  },

  get currentBeat() {
    if (!this.seq) return null;
    return this.seq.beats[Math.min(this.beat, this.seq.beats.length - 1)];
  },

  // One beat forward. Tapping through a scene you have watched before is
  // not the same gesture as skipping it, and a forty-second opening needs
  // both - the second playthrough wants to move, not to be gone.
  nextBeat() {
    if (!this.seq) return;
    this.beat++;
    this.beatT = 0;
    if (this.beat >= this.seq.beats.length) this.skip();
  },

  // How far through the WHOLE sequence, for a progress hint.
  seqProgress() {
    if (!this.seq) return 0;
    let done = 0, total = 0;
    this.seq.beats.forEach((b, i) => {
      total += b.dur;
      if (i < this.beat) done += b.dur;
      else if (i === this.beat) done += Math.min(b.dur, this.beatT);
    });
    return total > 0 ? done / total : 0;
  },

  skip() {
    if (!this.active && !this.seq) return;
    const cb = this.onDone;
    this.active = null;
    this.seq = null;
    this.seqScene = null;
    this.beat = 0;
    this.beatT = 0;
    this.onDone = null;
    this.t = 0;
    if (cb) cb();
  },

  update(dt) {
    if (this.seq) {
      const beat = this.currentBeat;
      this.beatT += dt;
      if (this.seqScene && this.seqScene.update) this.seqScene.update(dt, beat);
      // Advance AFTER the scene has been updated for this frame, so the last
      // frame of a beat is drawn with that beat's targets rather than the
      // next one's.
      if (this.beatT >= beat.dur) this.nextBeat();
      return;
    }
    if (!this.active) return;
    this.t += dt;
    if (this.t >= this.active.dur) this.skip();
  },

  draw(ctx) {
    if (this.seq) { this._drawSequence(ctx); return; }
    const d = this.active;
    if (!d) return;
    const k = Math.min(1, this.t / d.dur);
    const v = Display.viewRect();
    const cx = (Display.safe.left + Display.safe.right) / 2;
    const cy = (Display.safe.top + Display.safe.bottom) / 2;

    // Letterbox: the whole screen goes dark, then bars pull back at the end.
    const inFade = Math.min(1, this.t / 0.25);
    const outFade = Math.min(1, (d.dur - this.t) / 0.3);
    const cover = Math.min(inFade, outFade);
    ctx.globalAlpha = cover;
    R.rect(v.x, v.y, v.w, v.h, '#04050c');
    ctx.globalAlpha = 1;
    if (cover < 0.05) return;

    ctx.save();
    ctx.globalAlpha = cover;

    // Optional floor plate behind the subject, for zone cards.
    if (d.floor && typeof Assets !== 'undefined' && Assets.has(d.floor)) {
      ctx.save();
      ctx.globalAlpha = cover * 0.5;
      const pan = k * 120;
      Assets.tile(ctx, d.floor, v.x - pan, v.y, v.w + 240, v.h, 640);
      ctx.restore();
      ctx.globalAlpha = cover * 0.55;
      R.rect(v.x, v.y, v.w, v.h, '#04050c');
      ctx.globalAlpha = cover;
    }

    // Hero render, drifting and scaling — the "camera move".
    if (d.hero && typeof Assets !== 'undefined' && Assets.has(d.hero)) {
      const z = d.zoom ? d.zoom[0] + (d.zoom[1] - d.zoom[0]) * k : 1;
      const dx = d.drift ? d.drift[0] * (k - 0.5) : 0;
      const dy = d.drift ? d.drift[1] * (k - 0.5) : 0;
      const size = 620 * z;
      Assets.sprite(ctx, d.hero, cx + dx, cy - 40 + dy, size, size, 0);
    }

    // SCAN overlay — a bright line travels down the subject, a bracket frames
    // it, and the readout types on line by line. Everything is derived from
    // `k`, so skipping mid-scan simply stops; nothing is left half-drawn.
    if (d.scan) {
      const bw = 560, bh = 640;
      const bx = cx - bw / 2, by = cy - 40 - bh / 2;
      ctx.save();
      // bracket corners
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 5;
      ctx.globalAlpha = cover * 0.9;
      const arm = 60;
      for (const [px, py, sx, sy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1],
                                      [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(px + arm * sx, py);
        ctx.lineTo(px, py);
        ctx.lineTo(px, py + arm * sy);
        ctx.stroke();
      }
      // the sweep itself, one pass down the body
      const sweepK = Math.min(1, this.t / (d.dur * 0.72));
      const sy2 = by + bh * sweepK;
      ctx.globalAlpha = cover * 0.85;
      R.rect(bx, sy2 - 2, bw, 4, '#ffffff');
      ctx.globalAlpha = cover * 0.22;
      R.rect(bx, by, bw, Math.max(0, sy2 - by), d.color);
      ctx.restore();

      // readout, right of the subject, one row at a time
      const rows = foremanScanRows();
      const rx = bx + bw + 40;
      ctx.save();
      rows.forEach((row, i) => {
        const at = 0.5 + i * 0.35;
        if (this.t < at) return;
        ctx.globalAlpha = cover * Math.min(1, (this.t - at) / 0.2);
        const ry = by + 90 + i * 74;
        R.smallText(row[0], rx, ry, 24, CONFIG.COLOR.steel);
        R.smallText(row[1], rx, ry + 34, 30, i === rows.length - 1
          ? CONFIG.COLOR.yellow : '#ffffff');
      });
      ctx.restore();
      ctx.globalAlpha = cover;
    }

    // Warning chevrons sweep across for hostile subjects.
    if (d.warn) {
      ctx.save();
      ctx.globalAlpha = cover * 0.16;
      const sweep = (this.t * 220) % 120;
      ctx.fillStyle = d.color;
      for (let i = -2; i < v.w / 120 + 2; i++) {
        ctx.save();
        ctx.translate(v.x + i * 120 + sweep, v.y);
        ctx.rotate(Math.PI / 5);
        ctx.fillRect(-16, -200, 32, v.h + 400);
        ctx.restore();
      }
      ctx.restore();
    }

    // Inked frame + text block, sliding up into place.
    const slide = (1 - Math.min(1, this.t / 0.45)) * 60;
    const ty = Display.safe.bottom - 250 + slide;
    R.rect(Display.safe.left, ty - 8, Display.safe.right - Display.safe.left, 6, d.color);
    R.text(d.title, cx, ty + 60, 78, d.color);
    // The main line types on, which reads as a machine transmission.
    const chars = Math.floor(Math.min(1, (this.t - 0.35) / 0.7) * d.line.length);
    if (chars > 0) R.text(d.line.slice(0, chars), cx, ty + 130, 38, '#ffffff');
    if (d.sub && this.t > 1.0) {
      ctx.globalAlpha = cover * Math.min(1, (this.t - 1.0) / 0.3);
      R.text(d.sub, cx, ty + 178, 26, CONFIG.COLOR.steel);
      ctx.globalAlpha = cover;
    }
    R.rect(Display.safe.left, ty + 205, Display.safe.right - Display.safe.left, 6, d.color);

    R.smallText('TAP TO SKIP', Display.safe.right - 190,
      Display.safe.bottom - 44, 22, CONFIG.COLOR.steel);
    ctx.restore();
  },

  // ---- a sequence draws its scene, then whatever this beat says ---------
  _drawSequence(ctx) {
    const beat = this.currentBeat;
    const v = Display.viewRect();
    if (this.seqScene && this.seqScene.draw) this.seqScene.draw(ctx);

    // Letterboxing. It is what says CUTSCENE without a word, and it is what
    // the bottom third of the screen stops being once the player has
    // control, so the transition out is a real one.
    const bar = Math.round(v.h * 0.085);
    R.rect(v.x, v.y, v.w, bar, '#000000');
    R.rect(v.x, v.y + v.h - bar, v.w, bar, '#000000');

    const cx = (Display.safe.left + Display.safe.right) / 2;
    const fade = Math.min(1, this.beatT / 0.6) *
      Math.min(1, (beat.dur - this.beatT) / 0.5);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));

    // NARRATION. One sentence, centred, over black. Used once.
    if (beat.text) {
      R.text(beat.text, cx, Display.safe.top + (Display.safe.bottom -
        Display.safe.top) * 0.5, 54, '#e6e9f2');
    }

    // A MACHINE LOG. Not dialogue and not narration - it is the world's own
    // record, in its own voice, and the whole reclassification mystery is
    // written in this register.
    if (beat.log) {
      const ly = Display.safe.bottom - bar - 150;
      R.smallText('> ' + beat.log, Display.safe.left + 90, ly, 30,
        CONFIG.COLOR.cyan);
    }

    // DIALOGUE. Speaker in their colour, line typing on underneath, because
    // a line that arrives all at once reads as a caption and a line that
    // types reads as somebody talking to you.
    if (beat.line) {
      const ly = Display.safe.bottom - bar - 190;
      R.smallText(beat.speaker || '', Display.safe.left + 90, ly, 30,
        CONFIG.COLOR.yellow);
      const chars = Math.floor(Math.min(1, (this.beatT - 0.35) / 2.2) *
        beat.line.length);
      if (chars > 0) {
        R.smallText(beat.line.slice(0, chars), Display.safe.left + 90,
          ly + 44, 34, '#ffffff');
      }
    }
    ctx.restore();

    // How much of it is left, so a player who does not want to skip still
    // knows they are not stuck. Thin, dim, and along the bottom bar.
    const pk = this.seqProgress();
    R.rect(v.x, v.y + v.h - 4, v.w * pk, 4, 'rgba(143,163,200,0.35)');
  },
};

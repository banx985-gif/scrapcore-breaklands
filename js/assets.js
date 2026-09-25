// SCRAPCORE: BREAKLANDS — Art assets (Milestone 21)
// Sprites are OPTIONAL. Everything in the game still draws itself with Canvas
// primitives, and a sprite simply replaces that drawing when one is available.
// That means art can land one file at a time without ever blocking the build,
// and a missing or failed image degrades to the shape it always drew.
//
// IMPORTANT: the user tests from a SINGLE STANDALONE HTML over file://, where
// <img src="assets/..."> is blocked by the browser's file origin rules. The
// build step therefore inlines every image as a base64 data URL into
// js/assetdata.js. ASSET_DATA is that table; if it is absent (modular dev
// build) we fall back to loading the files from disk over http.

const Assets = {
  images: {},
  ready: false,
  loaded: 0,
  failed: 0,
  total: 0,

  // key -> path used by the modular build (and by the packer)
  MANIFEST: {
    floor_scrapyard: 'assets/sprites/floor_scrapyard.jpg',
    floor_foundry: 'assets/sprites/floor_foundry.jpg',
    floor_coreworks: 'assets/sprites/floor_coreworks.jpg',
    // WRECKJACK's per-map floors for Maps 4-10 USED TO BE LISTED HERE, and
    // that is all they were: seven entries, 753 KB of a build already at its
    // ceiling, for maps BREAKLANDS does not have. Maps 1-3 above stay, because
    // cutscene.js still names all three by hand.
    //
    // Nothing had noticed because nothing was looking: Assets.init walks
    // MANIFEST, so a key here is a DOWNLOAD, and only the code asking for it
    // makes it a picture. tools/asset_audit.js is what asks the second
    // question, and tests/test_assets.js now pins the answer.
    hazard_plate: 'assets/sprites/hazard_plate.webp',
    // NO `logo` ENTRY. BREAKLANDS has no wordmark of its own yet, and the one
    // it inherited said WRECKJACK. The Block 0 rename changed every string
    // and missed the art, so the home screen still read WRECKJACK in a
    // browser — the text scans could not see it, and the SHA pin only
    // checked that the file had not CHANGED, not that it was still drawn.
    //
    // With no manifest entry, Assets.get('logo') returns nothing and
    // menus.js draws its Canvas-primitive text fallback instead. That is the
    // sprites-are-optional rule doing exactly what it exists for. When the
    // BREAKLANDS wordmark is drawn, add the entry back and the art takes over.
    icon_health: 'assets/sprites/icon_health.webp',
    icon_power: 'assets/sprites/icon_power.webp',
    icon_heat: 'assets/sprites/icon_heat.webp',
    icon_magnet: 'assets/sprites/icon_magnet.webp',
    icon_dash: 'assets/sprites/icon_dash.webp',
    icon_rotate: 'assets/sprites/icon_rotate.webp',
    icon_lock: 'assets/sprites/icon_lock.webp',
    icon_check: 'assets/sprites/icon_check.webp',
    icon_pause: 'assets/sprites/icon_pause.webp',
    ending_skyline: 'assets/sprites/ending_skyline.webp',
    part_machineGun: 'assets/sprites/part_machineGun.webp',
    part_scattergun: 'assets/sprites/part_scattergun.webp',
    part_cannon: 'assets/sprites/part_cannon.webp',
    part_railgun: 'assets/sprites/part_railgun.webp',
    part_saw: 'assets/sprites/part_saw.webp',
    part_saw_body: 'assets/sprites/part_saw_body.webp',
    part_saw_blade: 'assets/sprites/part_saw_blade.webp',
    part_flamethrower: 'assets/sprites/part_flamethrower.webp',
    part_beamLaser: 'assets/sprites/part_beamLaser.webp',
    part_arcGun: 'assets/sprites/part_arcGun.webp',
    part_rocketPod: 'assets/sprites/part_rocketPod.webp',
    part_mineLayer: 'assets/sprites/part_mineLayer.webp',
    part_armourPlate: 'assets/sprites/part_armourPlate.webp',
    part_heavyArmour: 'assets/sprites/part_heavyArmour.webp',
    part_heavyTreads: 'assets/sprites/part_heavyTreads.webp',
    part_repairArm: 'assets/sprites/part_repairArm.webp',
    part_radiator: 'assets/sprites/part_radiator.webp',
    part_heatSink: 'assets/sprites/part_heatSink.webp',
    part_targetingModule: 'assets/sprites/part_targetingModule.webp',
    part_magnetAmplifier: 'assets/sprites/part_magnetAmplifier.webp',
    part_splitter: 'assets/sprites/part_splitter.webp',
    part_thruster: 'assets/sprites/part_thruster.webp',
    part_dashBooster: 'assets/sprites/part_dashBooster.webp',
    part_smallReactor: 'assets/sprites/part_smallReactor.webp',
    part_bigReactor: 'assets/sprites/part_bigReactor.webp',
    part_directionalShield: 'assets/sprites/part_directionalShield.webp',
    logo_studio: 'assets/sprites/logo_studio.webp',
    pickup_health: 'assets/sprites/pickup_health.webp',
    pickup_power: 'assets/sprites/pickup_power.webp',
    crate_weapon: 'assets/sprites/crate_weapon.webp',
    crate_power: 'assets/sprites/crate_power.webp',

    // ---- Illustrated art (3/4 view) -------------------------------------
    // NOT gameplay sprites: these never rotate to aim. They are used where a
    // dramatic angle helps the player RECOGNISE a part — the catalogue, the
    // Garage, and salvage lying on the floor waiting to be magneted up.
    art_machineGun: 'assets/sprites/art_machineGun.webp',
    art_scattergun: 'assets/sprites/art_scattergun.webp',
    art_cannon: 'assets/sprites/art_cannon.webp',
    art_railgun: 'assets/sprites/art_railgun.webp',
    art_rocketPod: 'assets/sprites/art_rocketPod.webp',
    art_flamethrower: 'assets/sprites/art_flamethrower.webp',
    art_beamLaser: 'assets/sprites/art_beamLaser.webp',
    art_arcGun: 'assets/sprites/art_arcGun.webp',
    art_saw: 'assets/sprites/art_saw.webp',
    art_mineLayer: 'assets/sprites/art_mineLayer.webp',
    art_armourPlate: 'assets/sprites/art_armourPlate.webp',
    art_heavyArmour: 'assets/sprites/art_heavyArmour.webp',
    art_directionalShield: 'assets/sprites/art_directionalShield.webp',
    art_repairArm: 'assets/sprites/art_repairArm.webp',
    art_smallReactor: 'assets/sprites/art_smallReactor.webp',
    art_bigReactor: 'assets/sprites/art_bigReactor.webp',
    art_radiator: 'assets/sprites/art_radiator.webp',
    art_heatSink: 'assets/sprites/art_heatSink.webp',
    art_targetingModule: 'assets/sprites/art_targetingModule.webp',
    art_magnetAmplifier: 'assets/sprites/art_magnetAmplifier.webp',
    art_splitter: 'assets/sprites/art_splitter.webp',
    art_thruster: 'assets/sprites/art_thruster.webp',
    art_dashBooster: 'assets/sprites/art_dashBooster.webp',
    art_heavyTreads: 'assets/sprites/art_heavyTreads.webp',
    art_core_scrapper: 'assets/sprites/art_core_scrapper.webp',
    art_core_runner: 'assets/sprites/art_core_runner.webp',
    art_core_tank: 'assets/sprites/art_core_tank.webp',
    // Catalogue tiles for everything added since ZERO (generated 27 Aug
    // from the 44-degree d1 frames — replace freely with hand art).
    art_burstRifle: 'assets/sprites/art_burstRifle.webp',
    art_flakCannon: 'assets/sprites/art_flakCannon.webp',
    art_mortar: 'assets/sprites/art_mortar.webp',
    art_harpoon: 'assets/sprites/art_harpoon.webp',
    art_shockwaveCannon: 'assets/sprites/art_shockwaveCannon.webp',
    art_drill: 'assets/sprites/art_drill.webp',
    art_discLauncher: 'assets/sprites/art_discLauncher.webp',
    art_plasmaRepeater: 'assets/sprites/art_plasmaRepeater.webp',
    art_reactiveArmour: 'assets/sprites/art_reactiveArmour.webp',
    art_reflectorPlate: 'assets/sprites/art_reflectorPlate.webp',
    art_pointDefence: 'assets/sprites/art_pointDefence.webp',
    art_barrierProjector: 'assets/sprites/art_barrierProjector.webp',
    art_capacitor: 'assets/sprites/art_capacitor.webp',
    art_overcharger: 'assets/sprites/art_overcharger.webp',
    art_coolantPump: 'assets/sprites/art_coolantPump.webp',
    art_emergencyVent: 'assets/sprites/art_emergencyVent.webp',
    art_gyroStabiliser: 'assets/sprites/art_gyroStabiliser.webp',
    art_salvageCompressor: 'assets/sprites/art_salvageCompressor.webp',
    art_droneBay: 'assets/sprites/art_droneBay.webp',
    art_autoTurretController: 'assets/sprites/art_autoTurretController.webp',
    art_straightBeam: 'assets/sprites/art_straightBeam.webp',
    art_forkBeam: 'assets/sprites/art_forkBeam.webp',
    art_crossHub: 'assets/sprites/art_crossHub.webp',
    art_rotaryJoint: 'assets/sprites/art_rotaryJoint.webp',
    art_sacrificialCoupler: 'assets/sprites/art_sacrificialCoupler.webp',
    // Yard thumbnails: each Jackrig's finished machine (generated 27 Aug).
    // `machine_` is MACHINE_SET_PREFIX (frames.js): the rig ids in rigs.js
    // own the bare words.
    machine_jackal: 'assets/sprites/machine_jackal.webp',
    machine_viper: 'assets/sprites/machine_viper.webp',
    machine_ironclad: 'assets/sprites/machine_ironclad.webp',
    machine_mammoth: 'assets/sprites/machine_mammoth.webp',
    machine_mantis: 'assets/sprites/machine_mantis.webp',
    machine_hive: 'assets/sprites/machine_hive.webp',
    boss_crusher: 'assets/sprites/boss_crusher.webp',
    boss_crusherJaw: 'assets/sprites/boss_crusherJaw.webp',
    hero_crusher: 'assets/sprites/hero_crusher.webp',
    hero_furnace: 'assets/sprites/hero_furnace.webp',
    hero_foreman: 'assets/sprites/hero_foreman.webp',
    prop_pressSlab: 'assets/sprites/prop_pressSlab.webp',
    prop_canister: 'assets/sprites/prop_canister.webp',
    core_scrapper: 'assets/sprites/core_scrapper.webp',
    core_runner: 'assets/sprites/core_runner.webp',
    core_tank: 'assets/sprites/core_tank.webp',
    core_enemySwarm: 'assets/sprites/core_enemySwarm.webp',
    core_enemyLight: 'assets/sprites/core_enemyLight.webp',
    core_enemyMedium: 'assets/sprites/core_enemyMedium.webp',
    core_enemyHeavy: 'assets/sprites/core_enemyHeavy.webp',
    boss_furnace: 'assets/sprites/boss_furnace.webp',
    boss_foreman: 'assets/sprites/boss_foreman.webp',
    prop_pillar: 'assets/sprites/prop_pillar.webp',
    prop_wall: 'assets/sprites/prop_wall.webp',
    prop_scrapHeap: 'assets/sprites/prop_scrapHeap.webp',
    prop_heatVent: 'assets/sprites/prop_heatVent.webp',
    prop_piston: 'assets/sprites/prop_piston.webp',
    prop_laserEmitter: 'assets/sprites/prop_laserEmitter.webp',
    prop_pulseEmitter: 'assets/sprites/prop_pulseEmitter.webp',
  },

  // The 44-degree library is not listed above one frame at a time — there are
  // hundreds of them and the exporter already writes a manifest per set. This
  // folds those manifests into MANIFEST at boot, so the loader, the standalone
  // packer and the fallback-to-disk path all keep working unchanged.
  //
  // Sprites44.register() is what decides whether a set is ALLOWED: a set whose
  // renderVersion does not match the build is refused and recorded, never
  // quietly drawn (Milestones v3.2 §3.2).
  register44() {
    if (typeof SPRITE44_SETS === 'undefined' || typeof Sprites44 === 'undefined') return 0;
    let n = 0;
    for (const meta of SPRITE44_SETS) {
      if (!Sprites44.register(meta)) continue;
      for (const fr of (meta.frames || [])) {
        this.MANIFEST['d44_' + fr.file.replace(/\.[^.]+$/, '')] =
          'assets/sprites44/' + fr.file;
        n++;
      }
    }
    return n;
  },

  init(onDone) {
    this.register44();
    const keys = Object.keys(this.MANIFEST);
    this.total = keys.length;
    if (!this.total) { this.ready = true; if (onDone) onDone(); return; }
    if (typeof Image === 'undefined') {     // headless tests
      this.ready = true;
      if (onDone) onDone();
      return;
    }
    for (const key of keys) {
      const src = (typeof ASSET_DATA !== 'undefined' && ASSET_DATA[key])
        ? ASSET_DATA[key]
        : this.MANIFEST[key];
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        this.loaded++;
        this._check(onDone);
      };
      img.onerror = () => {
        // Missing art is not an error: the game draws its own shapes.
        this.failed++;
        this._check(onDone);
      };
      img.src = src;
    }
  },

  _check(onDone) {
    if (this.loaded + this.failed >= this.total) {
      this.ready = true;
      if (onDone) onDone();
    }
  },

  get(key) { return this.images[key] || null; },
  has(key) {
    if (this.images[key]) return true;
    // A key with no single top-down sprite can still have a 44-degree SET —
    // the five Structure parts are the first art that never existed in ZERO.
    // Without this, their call sites fell back to code-drawn boxes while the
    // real renders sat in the build unused. Found by LOOKING at a branch rig.
    return !!(typeof Iso !== 'undefined' && Iso.use44
      && typeof Sprites44 !== 'undefined' && Sprites44.setForKey
      && Sprites44.setForKey(key));
  },

  // Tile an image across a world rect. Used for arena floors.
  tile(ctx, key, x, y, w, h, scale) {
    const img = this.get(key);
    if (!img) return false;
    const step = scale || 512;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // Alternate flips per tile so a single texture does not read as a grid.
    let row = 0;
    for (let ty = y; ty < y + h; ty += step, row++) {
      let col = 0;
      for (let tx = x; tx < x + w; tx += step, col++) {
        const fx = ((row + col) % 2) ? -1 : 1;
        const fy = ((row * 2 + col) % 3 === 0) ? -1 : 1;
        ctx.save();
        ctx.translate(tx + step / 2, ty + step / 2);
        ctx.scale(fx, fy);
        ctx.drawImage(img, -step / 2, -step / 2, step, step);
        ctx.restore();
      }
    }
    ctx.restore();
    return true;
  },

  // Draw a centred sprite, optionally rotated. Returns false if unavailable so
  // callers can fall back to their own drawing.
  sprite(ctx, key, cx, cy, w, h, angle, hostile, paintHex) {
    // ---- 44 DEGREES -----------------------------------------------------
    // The conversion happens HERE, in the one function every sprite already
    // goes through, rather than at forty call sites. Master v3.2 §5: the
    // facing snaps to the nearest of eight and the picture is NOT rotated,
    // because the machine was photographed turned — rotating it would tip it
    // over. Everything else about each call site is left exactly as it was,
    // including the size it asked for, so nothing moves or changes scale.
    //
    // Falls through to the single top-down sprite whenever a 44-degree set is
    // missing, which is what lets the art land one set at a time.
    if (typeof Iso !== 'undefined' && Iso.use44
        && typeof Sprites44 !== 'undefined'
        && Sprites44.drawSized(ctx, key, angle || 0, cx, cy, w, hostile, paintHex)) return true;

    let img = this.get(key);
    if (!img) return false;
    // Same rule on the fallback path, so turning the 44-degree art off does
    // not quietly turn enemy colouring off with it.
    if (hostile && typeof Tint !== 'undefined') img = Tint.hostile(img);
    if (paintHex && !hostile && typeof Tint !== 'undefined') img = Tint.paint(img, paintHex);
    ctx.save();
    ctx.translate(cx, cy);
    // A sprite STANDS UP out of the floor, so the ground foreshortening the
    // camera applied is wrong for it — it would squat every machine. Undo it
    // about the sprite's own centre, which leaves the sprite's FOOT where the
    // projected floor put it.
    const ys = (typeof Camera !== 'undefined') ? Camera.yScale : 1;
    if (ys !== 1) ctx.scale(1, 1 / ys);
    if (angle) ctx.rotate(angle);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  },
};

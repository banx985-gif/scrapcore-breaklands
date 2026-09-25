// SCRAPCORE: BREAKLANDS — THE FIVE DISTRICTS THAT SHIP (Phase C.2)
//
// Per CONTENT_WORLD Part 5, in the order BLOCKS_8_15 gives, because each one
// proves something the next depends on:
//
//   1. THE YARD          the format, the starting garage, the tutorial ground
//   2. THE SPRAWL        scale and driving. Cheapest to build, biggest payoff.
//   3. IRONWORKS         an industrial hazard district, a lair boss, a rig
//   4. NEON CUT          the city, core-only play, the cyberpunk in one shot
//   5. THE ASH BARRENS   connective ground, roaming bosses, far silhouettes
//
// EVERY ONE OF THESE IS A PAGE OF DATA. That is the whole claim of C.1, and
// this file is the evidence: five districts, no district-specific code, and
// adding a sixth is another entry.
//
// ---------------------------------------------------------------------------
// SIZED FROM WORLD_SCALE, WHICH SAYS THE WORLD WAS ~20x TOO SMALL
//
// "Never pick a unit count. Pick a drive time, measure the actual speed, and
//  derive the units."
//
// At 640 u/s base, one chunk (3,072) is 4.8 seconds of driving. So:
//
//   THE YARD      18x18 =  55,296 units  ~96s across            AT 576 -- see below
//   THE SPRAWL    56x56 = 172,032 units  ~4.5 min               (scale IS its content)
//   IRONWORKS     36x36 = 110,592 units  ~2.9 min               (standard)
//   NEON CUT      24x24 =  73,728 units  ~1.9 min               (dense; on foot, so
//                                                                small in units and
//                                                                huge in time)
//   ASH BARRENS   80x60 = 245,760 units  ~6.4 min               (the connective
//                                                                ground, and the
//                                                                biggest single area)
//
// Chunk size stays 3,072 exactly as WORLD_SCALE says: scale by adding chunks,
// never by growing them, because growing them churns everything.
//
// THE YARD IS THE ONE DISTRICT SIZED FROM 576, NOT 640 (Q7, BREAKLANDS_ANSWERS,
// 20 Sept 2026). 640 is the Jackrig base; the machine a new save walks out
// as is the JACKAL on the BARE FRAME, 640 x 1.00 x 0.90 = 576, and the frame
// only reaches 1.00 on the fifth district (Q6). So the opening ground was
// laid out for a speed nobody has in it: every Yard drive ran 11% long.
// Aaron: "no i want a big map. we can do something to make the first section
// smaller not the map." The Yard's design drive is ~96 s across (the figure
// the table above has always meant by a side); 96 s x 576 u/s = 55,296
// units = 18 chunks. EVERY OTHER DISTRICT KEEPS ITS
// 640 SIZING ON PURPOSE -- the player grows into it as the frame grows.
// tests/coldrun.js pins this derivation; an audit that "fixes" the Yard
// back to 20x20 is putting the 11% back.

// ---------------------------------------------------------------------------
// 1. THE YARD — start here. Small on purpose, and sized from 576 (above).
const DISTRICT_YARD = DistrictGen.make({
  id: 'yard',
  name: 'THE YARD',
  cols: 18, rows: 18,      // 96 s across AT 576 u/s. Not 20: see above.
  // CONTENT_PLACEMENT: you wake ON THE BELT, two chunks south of the garage,
  // which is where the cold open leaves you. (The south rows moved up two
  // with the Q7 footprint: garage 16 -> 14, spawn 18 -> 16, first machine
  // 17 -> 15; the pair, the saw, the elite and the wall did not move. Two,
  // not one: the coastline bites the outermost ring of chunks, and a spawn
  // on row 17 of 18 was bitten out -- test_block15 said so.)
  spawn: { cx: 10, cy: 16, x: 1536, y: 1536 },
  spawnPool: 'yard',
  density: 0.75,                 // the gentlest ground in the game
  look: 'rust orange, ash grey, one dead neon sign reading a company name',
  says: 'the machines sort scrap forever and made you part of it',
  terrain: ['open', 'open', 'haul', 'alleys'],
  // A YARD: heaps and sheds gather round where the work is. Clustered.
  layout: { kind: 'cluster' },
  props: ['scrappile', 'crate', 'sortingbelt', 'gantry', 'scrapmount',
          'oildrum', 'canteen', 'neonsign'],
  hazards: [
    // A belt's LENGTH and DIRECTION now come from the two anchors it runs
    // between (PLAYTEST 3 item 1a), so only its width across is data here.
    { key: 'belts', args: { h: [230, 300] } },
    { key: 'plates', args: {} },
    // ROUGH GROUND. The Yard is a scrapyard; broken ground is what it is
    // made of, and it is where a player first meets the cost that RUGGED
    // TREADS exist to stop paying.
    { key: 'rough', args: { w: [900, 1900], h: [700, 1300] } },
  ],
  elites: [],                    // no seeded elites: the ONE elite is placed,
                                 // behind the wall, as the restraint lesson
  garages: [
    // GIVEN, NOT EARNED — the only one in the game. No guard.
    { id: 'yard_mags', name: "MAGS' YARD", cx: 10, cy: 14, x: 1536, y: 1200,
      guard: null },
  ],
  // THE TUTORIAL, per CONTENT_PLACEMENT — each machine is a lesson, by
  // roster build. Rows are [x, y, id, build-or-brain, reward, permanent].
  placed: {
    // 2:00 — the connector lesson. Dies fast, drops nothing to keep.
    '10,15': [[1536, 1536, 'yard_first', 'picker']],
    // 5:00 — the flanking lesson: armour in FRONT of the gun, twice.
    '9,13': [[1200, 1500, 'yard_pair_a', 'stacker', 'armourPlate'],
             [1900, 1700, 'yard_pair_b', 'stacker', 'smallReactor']],
    // 11:00 — the rip lesson: it closes to melee, so its connector gets
    // damaged whether the player means it to or not.
    '13,12': [[1536, 1536, 'yard_saw', 'grabber', 'saw']],
    // HOB mission 2's target, at grid nineteen.
    '14,9': [[1536, 1536, 'yard_grid19', 'stacker', 'repairArm']],
    // 13:00 — the restraint lesson. Not beatable at hour one, and it should
    // look it. Behind the Mammoth wall.
    '5,6': [[1536, 1536, 'yard_elite', 'foremans_hand']],
  },
  // HOB 3, "THE REST OF HIM". Both repair arms came off this, which is why
  // grid nineteen is where the first two missions sent you: the third one is
  // the same place a third time, and the joke is that HOB has been asking
  // about it for sixty years.
  //
  // It sits BESIDE the two machines rather than under them, so a player who
  // has been there twice recognises the spot before they read the brief.
  wrecks: {
    '14,9': [[2100, 1100, 'yard_loader', 'LOADER HULK',
              [{ partId: 'repairArm', gradeId: 'G2' },
               { partId: 'armourPlate', gradeId: 'G2' },
               { partId: 'heavyTreads', gradeId: 'G1' }], 240]],
  },
  // Q4 (20 Sept 2026): THE FIRST MACHINE YOU CAN BECOME THAT IS NOT THE
  // JACKAL. The VIPER, dead in the north-east of the Yard -- a real drive
  // from the garage (about 34,000 units, two minutes on the tow line) with
  // nothing guarding it. "Machines come EARLIER than the rigs": a player
  // is choosing between machines before any chassis is even seen.
  //
  // THE ONE LEFT BARE, ON PURPOSE (round 2, 22 Sept 2026). The other four
  // machine wrecks carry a guard in their fourth column; this row has none
  // and must keep none. Aaron: "the odd 1 could be lying with nothing
  // around it" -- the opening does not gate on a fight, and the bare one is
  // what makes the guarded ones read as a choice rather than a rule.
  machines: { '15,4': [[1536, 1536, 'viper']] },
  barriers: {
    // A duct, early, so the core/rig split is taught before it matters.
    '9,11': [[1536, 1536, 'duct', 'yard_duct', 'gadget:scanner']],
    // 15:00 — the wall you remember. Nothing you own touches it, and no
    // prompt says what opens it. That is the point.
    '4,5': [[1536, 1536, 'wall', 'yard_rack_wall', 'slot']],
    // Drill 1, much later: a module, a fragment's shortcut home.
    '17,7': [[1536, 1536, 'rubble', 'yard_rubble', 'module:assayModule']],
  },
  story: {
    '10,15': [[1536, 900, 'anomaly_log']],
    '11,15': [[1536, 1536, 'shift_roster']],
    '7,11': [[1536, 1536, 'work_order_44119c']],
    '15,16': [[1536, 1536, 'grow_lamps_note']],
  },
  // FOUND MONEY (content/CONTENT_STASHES.md, 22 Sept 2026). Eight stashes,
  // no vault: the opening district teaches the tell, and the first vault is
  // the Sprawl's. Never on a road, never in the garage's line of sight
  // (6,000 units), inside the coastline; stash 1 sits past the Mammoth wall,
  // the one that must be behind a traversal ability. Rows are
  // [x, y, spec, id], the finds vocabulary; the value is rolled from the id.
  stashes: {
    '13,2': [[1078, 1676, 'stash', 'yard_stash_7']],
    '9,4': [[1325, 1508, 'stash', 'yard_stash_8']],
    '4,5': [[1536, 2436, 'stash', 'yard_stash_1']],
    '11,8': [[626, 790, 'stash', 'yard_stash_5']],
    '4,10': [[551, 1160, 'stash', 'yard_stash_2']],
    '8,11': [[566, 1737, 'stash', 'yard_stash_6']],
    '14,12': [[1942, 913, 'stash', 'yard_stash_3']],
    '5,14': [[2235, 2399, 'stash', 'yard_stash_4']],
  },
  finds: ['permanent:mg_rasp', 'core:spindle', 'module:cargoRack',
          'decal:scrapMark'],
  // PHASE C.3. And WHERE each one stands. Rows are [x, y, spec, id], the spec
  // is the same string the manifest above uses, and the id is permanent -
  // taken once is taken forever, through a district file being reordered.
  //
  // Positions come from draft_district_yard.js where it gave one. Finds the
  // draft marked `reward:` or `given:` are NOT here on purpose: they come from
  // a mission or from the tutorial, and Block 13 owns those. A crate is only
  // for something you find by going and looking.
  findsAt: {
    // The cargo rack, found EARLY on purpose - it makes you worse off when
    // you die, which is the loop working.
    '12,14': [[1536, 1536, 'module:cargoRack', 'yard_rack']],
    // The mark that got CLIP reclassified. Wearable.
    '10,16': [[1900, 1100, 'decal:scrapMark', 'yard_decal_scrap']],
    // A drive from the garage, in the open, visible from a distance.
    '6,9':   [[1400, 1700, 'permanent:mg_rasp', 'yard_rasp']],
    // The far corner. Nothing sends you here; the map does. (Row 15, not
    // 17: the last two rings are coastline and (3,17) is bitten out.)
    '3,15':  [[1536, 1536, 'core:spindle', 'yard_spindle']],
    // BLOCK 13: HOB's arm. Grid nineteen, beside the STACKER sitting on it -
    // hob_1 asks you to fetch this and hob_2 to move the machine.
    '14,9':  [[2200, 1200, 'relic:grid19Arm', 'yard_grid19_arm']],
    // ---- UPGRADE PARTS (Block 10) --------------------------------------
    // CONTENT_ECONOMY: 46 across the five shippable districts, and NEVER let
    // the count drift upward quietly - "every new upgrade part placed anywhere
    // is a deliberate decision about how much power exists in the game".
    // Fourteen sit in gated pockets and ten on ground you have to cross;
    // twelve come from missions, six from bosses, four from first elite kills.
    // tests/test_spine.js counts the placed ones and refuses a forty-seventh.
    '17,7':  [[1536, 1536, 'upgrade:part:1', 'yard_up_1']],
    '4,5':   [[1700, 1400, 'upgrade:part:1', 'yard_up_2']],
    '9,11':  [[1400, 1700, 'upgrade:part:1', 'yard_up_3']],
  },
  // PHASE B.5. A ROUTE THAT OPENS ONCE AND STAYS OPEN. Drilling the rubble at
  // 17,7 is what turns a drive round the north edge into a straight line to
  // the Barrens gate. `opensWith` names a barrier in this district; the map
  // screen draws the line, dashed and named once you have seen the barrier,
  // solid once you have opened it.
  shortcuts: [
    { id: 'yard_to_barrens', from: [17, 7], to: [17, 10],
      opensWith: 'yard_rubble' },
  ],
  boss: null,
  gateIn: null,
  exits: [
    { cx: 2, cy: 3, to: 'ironworks' },
    { cx: 17, cy: 10, to: 'barrens' },    // the east edge of an 18-wide Yard
  ],
});

// ---------------------------------------------------------------------------
// 2. THE SPRAWL — where people actually lived. Kilometres of it.
//
// "Emotional centre of the game. No hazard gimmick, no boss lair. Just scale
//  and silence. Story fragments should be densest here."
const DISTRICT_SPRAWL = DistrictGen.make({
  id: 'sprawl',
  name: 'THE SPRAWL',
  cols: 56, rows: 56,            // the biggest of the five. Scale IS its content.
  spawn: { cx: 2, cy: 28, x: 1536, y: 1536 },
  spawnPool: 'yard',
  density: 0.55,                 // deliberately QUIET. The silence is the point.
  look: 'the most human district, and the saddest. Warm dead colours, one ' +
        'working streetlight per block',
  says: 'this is who it happened to',
  terrain: ['alleys', 'alleys', 'open', 'collapse'],
  // KILOMETRES OF HOUSING, from draft_district_sprawl.js's own layout block.
  // Long blocks and wide straight streets - you drive DOWN a road here, and
  // that is the difference between a city and buildings on dirt.
  layout: { kind: 'grid', blockSize: [1400, 2200], jitter: 0.18, roadWidth: 340 },
  // THE MOST IMPORTANT PROP SET IN THE GAME. `A washing line does more work
  // than any boss. Every one of these says someone lived here.`
  props: ['housingblock', 'housingruin', 'housingblock', 'abandonedcar',
          'shopfront', 'busshelter', 'washingline', 'playgroundframe',
          'streetlight', 'fencerun', 'bus', 'factorywall'],
  hazards: [
    { key: 'collapses', args: {} },
    { key: 'gates', args: {} },
    { key: 'rough', args: { w: [1000, 2200], h: [800, 1500] } },
  ],
  elites: ['reinforced', 'overclocked'],
  garages: [
    // CONTENT_PLACEMENT: dead centre, so every corner is ~2.5 minutes away.
    { id: 'sprawl_fire', name: 'STATION 12', cx: 28, cy: 30, x: 1536, y: 1536,
      guard: 'sp_station_guard' },
  ],
  // CONTENT_PLACEMENT's full set, by roster build. A `count` in the draft is
  // suffixed rows here — each machine keeps its own permanent id, so killing
  // one of a pair stays killed.
  placed: {
    // The MANTIS wreck's guard (round 2). Beside it, inside its own leash.
    '42,18': [[1536, 1000, 'sp_mantis_guard', 'stalk']],
    '28,31': [[1200, 900, 'sp_station_guard', 'knock', 'railgun'],
              [1900, 1000, 'sp_station_b', 'knock'],
              [1000, 1700, 'sp_station_c', 'sweep'],
              [2100, 1800, 'sp_station_d', 'sweep']],
    '18,22': [[1100, 1300, 'sp_school_a', 'sweep', 'targetingModule'],
              [1700, 1500, 'sp_school_b', 'sweep'],
              [1400, 2000, 'sp_school_c', 'sweep']],
    '33,14': [[1300, 1500, 'sp_block12_a', 'knock', 'shockwaveCannon'],
              [1900, 1600, 'sp_block12_b', 'knock']],
    '12,40': [[1200, 1400, 'sp_market_a', 'sweep', 'burstRifle'],
              [1800, 1300, 'sp_market_b', 'sweep'],
              [1500, 1900, 'sp_market_c', 'sweep'],
              [2000, 2000, 'sp_market_d', 'sweep']],
    '44,36': [[1300, 1500, 'sp_overpass_a', 'stalk', 'railgun'],
              [1900, 1700, 'sp_overpass_b', 'stalk', 'targetingModule']],
    // The factory built through the housing, without demolishing anything.
    '36,26': [[1536, 1200, 'sp_factory_cut', 'slagjaw', 'heavyArmour'],
              [1100, 1800, 'sp_factory_b', 'pourer', 'flamethrower'],
              [2000, 1900, 'sp_factory_c', 'pourer']],
    // The elite, parked in a residential street. Nothing else in this
    // district is dangerous, and that contrast IS the district.
    '26,34': [[1536, 1536, 'sp_warden', 'block_warden', null, 'arc_drain']],
    '48,12': [[1200, 1400, 'sp_depot_a', 'knock', 'heavyArmour'],
              [1800, 1500, 'sp_depot_b', 'knock', 'heavyArmour'],
              [1500, 2000, 'sp_depot_c', 'knock']],
    '8,18': [[1300, 1500, 'sp_clinic_a', 'sweep', 'repairArm'],
             [1900, 1700, 'sp_clinic_b', 'sweep']],
    // Teaches suicide runners. Watch the telegraph in playtest — a contact
    // detonation that one-shots a full carry is unfair.
    '40,46': [[1100, 1300, 'sp_yardend_a', 'charge'],
              [1800, 1200, 'sp_yardend_b', 'charge'],
              [1400, 1900, 'sp_yardend_c', 'charge'],
              [2100, 1800, 'sp_yardend_d', 'charge']],
    '16,8': [[1200, 1300, 'sp_towers_a', 'sweep', 'plasmaRepeater'],
             [1800, 1400, 'sp_towers_b', 'sweep'],
             [1400, 1900, 'sp_towers_c', 'sweep'],
             [2000, 2000, 'sp_towers_d', 'stalk']],
  },
  // DENSEST STORY. The Sprawl teaches you what was lost, and it holds
  // fourteen of the sixty-six fragments - more than twice any other place.
  //
  // These are FRAGMENT IDS, not prose. The text lives in js/storydata.js and
  // nowhere else: before this the districts carried their own hand-written
  // lines, which is two copies of the game's writing and exactly the shape of
  // problem that has bitten this project four times now.
  story: {
    '18,22': [[900, 1100, 'class_3b_drawings'],
              [2100, 1400, 'shift_roster_week_41']],
    '33,14': [[1536, 2100, 'not_coming_back_on']],
    '22,26': [[1536, 1536, 'dana_took_the_kids']],
    '8,18': [[1536, 2100, 'clinic_triage_log']],
    '28,30': [[1536, 2100, 'last_callout']],
    '12,40': [[1536, 900, 'market_notice']],
    '44,36': [[1536, 2100, 'evacuation_route']],
    '36,26': [[1536, 2100, 'factory_build_order']],
    '46,44': [[1536, 1536, 'removal_manifest_half_loaded']],
    '16,8': [[1536, 2100, 'barricade_order']],
    '50,6': [[1536, 2100, 'birthday_card']],
    '6,48': [[1536, 1536, 'lease_renewal']],
    '40,46': [[1536, 2100, 'note_about_a_cat']],
  },
  barriers: {
    // The way into the city: a grapple face at the collapsed overpass.
    '4,28': [[1536, 1536, 'rooftop', 'sp_overpass_gap', 'exit:neoncut']],
    '16,8': [[1000, 800, 'wall', 'sp_barricade', 'module:redundantBus']],
    // Halves the drive across the district once opened.
    '40,20': [[1536, 1536, 'flooded', 'sp_underpass', 'shortcut']],
    '48,12': [[1000, 900, 'shutter', 'sp_depot_shutter', 'gadget:jammer']],
    '30,44': [[1536, 1536, 'minefield', 'sp_mined_park', 'colourset:civic']],
  },
  // The two chassis are in OPPOSITE far corners on purpose: you cannot get
  // both in one trip, and either is a tow you think twice about starting.
  chassis: { '50,6': [[1536, 1536, 'cheetah']],
             '6,48': [[1536, 1536, 'hauler']] },
  // Q4: the MANTIS -- the melee machine -- in the housing, nearer the
  // station than either chassis (about 48,000 units): a machine is an
  // earlier find than a rig. GUARDED (round 2): a STALK stands over it, the
  // fourth column, and the wreck refuses the hook until it is dead.
  machines: { '42,18': [[1536, 1536, 'mantis', 'sp_mantis_guard']] },
  // FOUND MONEY (CONTENT_STASHES). Eight stashes and the game's FIRST TWO
  // VAULTS: one behind a COLLAPSED WALL (Mammoth) in the street grid, where
  // a player learns what a locked one looks like before they can open one,
  // and one behind a SHUTTER (Cutter 1) for the core. Stash 1 sits past the
  // barricade. Never in the street, never within 6,000 of Station 12.
  stashes: {
    '23,5': [[1001, 2358, 'stash', 'sp_stash_4']],
    '16,8': [[1000, 1700, 'stash', 'sp_stash_1']],
    '2,15': [[925, 964, 'vault:wall', 'sp_vault_1']],
    '10,17': [[537, 1894, 'stash', 'sp_stash_3']],
    '45,27': [[2223, 1338, 'vault:shutter', 'sp_vault_2']],
    '48,30': [[2145, 1431, 'stash', 'sp_stash_2']],
    '10,36': [[2362, 1214, 'stash', 'sp_stash_6']],
    '32,43': [[1240, 2225, 'stash', 'sp_stash_8']],
    '53,48': [[1899, 750, 'stash', 'sp_stash_5']],
    '26,50': [[993, 1544, 'stash', 'sp_stash_7']],
  },
  finds: ['rig:cheetah', 'rig:hauler', 'gadget:jammer', 'decal:hand',
          'module:longRangeTank', 'module:signalMask', 'module:cargoRack'],
  // Positions from draft_district_sprawl.js. The two rigs are not here: a
  // chassis is a HULK you tow home (the `chassis` rows above), not a crate.
  findsAt: {
    // THE ANSWER TO ALERT, behind the depot shutter. The most valuable thing
    // in the district and the hardest door in it.
    '48,12': [[1536, 1536, 'gadget:jammer:1', 'sp_jammer']],
    // THE ONLY DECAL A PERSON MADE. One place, never repeated, never sold.
    '18,22': [[1536, 1536, 'decal:hand', 'sp_hand']],
    // Rewards driving to a far corner for nothing in particular.
    '44,8':  [[1536, 1536, 'module:longRangeTank', 'sp_tank']],
    '12,40': [[1536, 1536, 'module:signalMask', 'sp_mask']],
    '46,44': [[1536, 1536, 'module:cargoRack', 'sp_bus']],
    // BLOCK 13: BOLT's work order, out on the road it names.
    '30,30': [[1536, 1536, 'relic:workOrderRoad', 'sp_work_order_road']],
    // GRAPPLE 1. merit_2 asks for it as gear and both districts' rooftops need
    // it; nothing granted it. The Sprawl is where the overpasses are, so it is
    // where the hook is.
    '20,26': [[1536, 1536, 'gadget:grapple:1', 'sp_grapple']],
    // SEAL 1. drain_1 asks for it as gear and the flooded underpass takes it
    // as the alternative to a Diver — and it was the only requirement in the
    // whole mission table with no source at all.
    '38,18': [[1536, 1536, 'gadget:seal:1', 'sp_seal']],
    // Six in the Sprawl, four of them behind something.
    '4,28':  [[1536, 1536, 'upgrade:part:1', 'sp_up_1']],
    '16,8':  [[1700, 1400, 'upgrade:part:1', 'sp_up_2']],
    '40,20': [[1400, 1700, 'upgrade:part:1', 'sp_up_3']],
    '44,16': [[1500, 1500, 'upgrade:part:1', 'sp_up_4']],
    '30,44': [[1536, 1536, 'upgrade:part:1', 'sp_up_5']],
    '22,10': [[1536, 1536, 'upgrade:part:1', 'sp_up_6']],
  },
  // The flooded underpass. Its barrier row already carried the reward
  // 'shortcut' and nothing drew one; this is the route it was promising.
  shortcuts: [
    { id: 'sp_cross', from: [40, 20], to: [24, 20], opensWith: 'sp_underpass' },
  ],
  // An ID into BOSSES (js/bossdata.js) — the boss data has ONE home, and the
  // draft-era duplicate {kind, name, reuse} object here is exactly the
  // two-copies shape that has bitten this project four times.
  boss: 'roadblock',
  gateIn: null,                  // wide open. Best district for the Cheetah.
  exits: [
    { cx: 52, cy: 50, to: 'ironworks' },
    { cx: 54, cy: 2, to: 'railspine' },
    // Behind sp_overpass_gap, and NEON CUT itself is core-only at the gate.
    { cx: 4, cy: 28, to: 'neoncut' },
    { cx: 53, cy: 20, to: 'barrens' },   // was (54,20): the coastline bites that chunk
    { cx: 20, cy: 54, to: 'barrens' },
  ],
});

// ---------------------------------------------------------------------------
// 3. THE IRONWORKS — smelting and casting. The furnace never went out.
const DISTRICT_IRONWORKS_GEN = DistrictGen.make({
  id: 'ironworks',
  name: 'THE IRONWORKS',
  cols: 36, rows: 36,
  spawn: { cx: 2, cy: 2, x: 1536, y: 1536 },
  spawnPool: 'foundry',
  density: 1.25,                 // the densest of the five. Everything is heat.
  look: 'black and orange, glowing pour spouts, heat shimmer, ash fall',
  says: 'it is still making steel for a war that ended',
  terrain: ['presses', 'furnace', 'haul', 'open', 'testyard', 'collapse'],
  // A WORKS. Clustered - plant, stacks and heaps gather round the furnaces.
  layout: { kind: 'cluster' },
  props: ['slagheap', 'ingotrack', 'ladlecar', 'pourspout', 'shiftoffice',
          'coolingtower', 'stack', 'pipe_run', 'debrispillar'],
  hazards: [
    { key: 'vents', args: {} },
    { key: 'lanes', args: {} },
    { key: 'belts', args: { h: [250, 340] } },
    { key: 'canisters', args: {} },
  ],
  elites: ['reinforced', 'volatile'],
  garages: [
    { id: 'iw_westYard', name: 'WEST YARD', cx: 6, cy: 5, x: 1536, y: 1536,
      guard: 'iw_pressWarden' },
    { id: 'iw_haulDepot', name: 'HAUL DEPOT', cx: 22, cy: 14, x: 1400, y: 1600,
      guard: 'iw_haulBoss' },
    { id: 'iw_eastGate', name: 'EAST GATE', cx: 31, cy: 19, x: 1536, y: 1536,
      guard: 'iw_eastGate' },
  ],
  placed: {
    // The HIVE wreck's guard (round 2). Its good gear, once, like every
    // placed machine in this district.
    '14,30': [[1536, 1000, 'iw_hive_guard', 'slagjaw', 'heavyArmour']],
    '6,5': [[1536, 1536, 'iw_pressWarden', 'turret', 'siegeCannon', 'cn_breaker']],
    '22,14': [[1400, 1600, 'iw_haulBoss', 'turret', 'railgun', 'mg_longshot']],
    '9,13': [[1536, 1400, 'iw_furnaceKeeper', 'kiter', 'flamethrower', 'mg_hornet']],
    '27,24': [[1500, 1500, 'iw_collapseHunter', 'rusher', 'beamLaser', 'cn_spray']],
    '11,28': [[1536, 1536, 'iw_testWarden', 'turret', 'arcGun', 'arc_drain']],
    '31,19': [[1536, 1536, 'iw_eastGate', 'salvager', 'heavyArmour']],
  },
  barriers: {
    '13,9': [[1536, 900, 'wall', 'iw_pressWall', 'slot']],
    '20,4': [[1200, 1536, 'rockfall', 'iw_northFall', 'permanent:cn_spray']],
    '26,13': [[1536, 1536, 'minefield', 'iw_oldMines', 'gadget:jammer']],
    '8,17': [[1536, 1200, 'molten', 'iw_pourLine', 'permanent:cn_siege']],
    '17,26': [[1536, 1536, 'ledge', 'iw_shelf', 'story:ironworks_shift']],
    '33,33': [[1536, 1536, 'vault', 'iw_payVault', 'rig:crab']],
    '5,22': [[1400, 1400, 'duct', 'iw_ductRun', 'gadget:scanner']],
    // BLOCK 13: the office that collapsed a century ago, which is where VANE'"'"'s
    // shutdown signature has to be filed. vane_2 asks you to get into it.
    '15,12': [[1536, 1536, 'wall', 'iw_office_wall', 'mission:vane_2']],
  },
  chassis: { '34,2': [[1536, 1536, 'mammoth']] },   // far corner
  // Q4: the HIVE -- drones and automation -- south of the haul depot, the
  // wrong side of the district from the MAMMOTH chassis.
  // GUARDED (round 2): a SLAGJAW stands over it.
  machines: { '14,30': [[1536, 1536, 'hive', 'iw_hive_guard']] },
  story: {
    '18,20': [[1536, 1536, 'iw_shift_change']],
    '14,8': [[1536, 1536, 'iw_spec_drift']],
    '8,12': [[1536, 1536, 'iw_requisition']],
    '26,14': [[1536, 1536, 'iw_roster_41']],
    // The lair's own work order, at the approach to hall one.
    '4,4': [[1536, 1536, 'iw_lair_docket']],
  },
  // FOUND MONEY (CONTENT_STASHES). Eight stashes; two vaults, one behind
  // MOLTEN GROUND (Kiln), one behind a RUBBLE WALL (Drill 1). Stash 1 sits
  // past the press wall.
  stashes: {
    '3,9': [[966, 1455, 'stash', 'iw_stash_4']],
    '13,9': [[1536, 1800, 'stash', 'iw_stash_1']],
    '26,10': [[2320, 2069, 'stash', 'iw_stash_8']],
    '23,17': [[2068, 930, 'vault:rubble', 'iw_vault_2']],
    '18,18': [[1857, 1605, 'stash', 'iw_stash_7']],
    '27,18': [[502, 991, 'stash', 'iw_stash_2']],
    '3,21': [[2357, 2412, 'stash', 'iw_stash_5']],
    '15,26': [[1694, 1305, 'vault:molten', 'iw_vault_1']],
    '19,26': [[2110, 528, 'stash', 'iw_stash_3']],
    '31,29': [[1893, 1948, 'stash', 'iw_stash_6']],
  },
  finds: ['rig:mammoth', 'gadget:scanner', 'permanent:cn_breaker', 'permanent:cn_siege',
          'permanent:mortar'],
  // The Ironworks has no draft - this file IS its schema - so these are placed
  // to the same rule the drafts follow: one near the working heart of the
  // place, one out past it where the hazards are worst.
  findsAt: {
    '12,20': [[1536, 1536, 'permanent:cn_breaker', 'iw_breaker']],
    '28,30': [[1536, 1536, 'permanent:cn_siege', 'iw_siege']],
    // A MORTAR, on purpose and near where you arrive: PLAYTEST 3 item 4 found
    // that eight weapon classes already have eight-direction art nobody has
    // confirmed in a browser, and this is the one to go and look at.
    '4,4':   [[1536, 1536, 'permanent:mortar', 'iw_mortar']],
    // BLOCK 13: VANE's authorisation stamp, in the office that collapsed a
    // century ago. It wants a signature and this is the thing that signs.
    '13,9':  [[2100, 1300, 'relic:authStamp', 'iw_auth_stamp']],
    // THE SCANNER, AND A GATE THAT HAD NO KEY.
    //
    // `gadget:scanner` gates two ducts - one in the Yard, one here - and
    // NOTHING IN THE WORLD GRANTED IT. Two barriers the player could see,
    // could read, and could never open, which is the exact failure a
    // gated map is one missing find away from at all times.
    //
    // draft_gadgets puts it at "ironworks garage claim": the WEST YARD
    // depot, which is the first garage you take off a guard rather than
    // being given, so the first gadget in the game is a thing you won.
    '6,5':   [[2200, 1200, 'gadget:scanner:1', 'iw_scanner']],
    // Six here: the Ironworks is where the first spine step becomes affordable.
    '15,7':  [[1700, 1400, 'upgrade:part:1', 'iw_up_1']],
    '20,4':  [[1400, 1700, 'upgrade:part:1', 'iw_up_2']],
    '8,17':  [[1536, 1536, 'upgrade:part:1', 'iw_up_3']],
    '33,33': [[1700, 1500, 'upgrade:part:1', 'iw_up_4']],
    '17,26': [[1500, 1700, 'upgrade:part:1', 'iw_up_5']],
    '26,13': [[1536, 1536, 'upgrade:part:1', 'iw_up_6']],
    // THE KEYSTONE. Nothing in the world granted the MAMMOTH, and three
    // missions, two districts' worth of walls and every rockfall in the game
    // are downstream of it — vane_2 asks for it as GEAR and vane_3's reward is
    // where the Kiln is, so without this the Ironworks chain stops dead at its
    // second step and the Barrens cliff is never opened by anyone.
    //
    // Sited to its own entry: "a wreck in the second district, behind a fight
    // you will lose the first time."
    '22,18': [[1536, 1536, 'rig:mammoth', 'iw_mammoth']],
    // DRILL 1, which is what opens the Yard's rubble shortcut — placed in the
    // district that is full of drilling rigs rather than the one the shortcut
    // is in, so the Yard shortcut is something you come BACK for.
    '30,8':  [[1536, 1536, 'gadget:drill:1', 'iw_drill']],
    // CUTTER 2, which merit_3 and ledger_3 both ask for as gear and the Neon
    // Cut bulkhead needs. An industrial district is where a better torch is.
    '9,26':  [[1900, 1400, 'gadget:cutter:2', 'iw_cutter2']],
  },
  // The shelf in the south-east, climbed once, drops you onto the haul road
  // and cuts the run back to the depot in half. Authored here rather than
  // taken from a draft: the Ironworks has no draft, this file is its schema.
  shortcuts: [
    { id: 'iw_shelf_drop', from: [17, 26], to: [22, 14], opensWith: 'iw_shelf' },
  ],
  boss: 'crucible',              // id into BOSSES — drops live there too
  gateIn: null,
  exits: [
    { cx: 2, cy: 2, to: 'yard' },
    { cx: 34, cy: 34, to: 'sprawl' },
    { cx: 18, cy: 34, to: 'barrens' },
  ],
});

// ---------------------------------------------------------------------------
// 4. NEON CUT — CITY. CORE ONLY. The cyberpunk in one screenshot.
//
// "The darkest district, and the brightest." Rigs refuse: the doorway is
// visibly too small, and the player sees a collapsed overpass across the
// street mouth rather than an invisible wall.
const DISTRICT_NEONCUT = DistrictGen.make({
  id: 'neoncut',
  name: 'NEON CUT',
  cols: 24, rows: 24,            // small in units, huge in time - it is on foot
  spawn: { cx: 12, cy: 22, x: 1536, y: 1536 },
  spawnPool: 'coreworks',
  density: 1.6,                  // dense, vertical, tight
  coreOnly: true,
  look: 'wet black streets, magenta and amber neon, rain, reflections',
  says: 'this is what the world was, and the machines never noticed it ended',
  terrain: ['alleys', 'alleys', 'presses'],
  // A CITY YOU WALK. Tight blocks and NARROW streets - draft_district_neoncut
  // says 220 wide, and that narrowness IS the rig refusal made visible.
  layout: { kind: 'grid', blockSize: [900, 1300], jitter: 0.10, roadWidth: 220 },
  // Streets too narrow for a rig, and the only district where neon does the
  // work. Magenta, amber and white only — never the faction three.
  props: ['citytower', 'shopfront', 'holoboard', 'hangingsign',
          'vendingmachine', 'tramstop', 'overpass_fallen', 'neonstrip',
          'puddle', 'abandonedcar'],
  hazards: [
    { key: 'lasers', args: {} },
    { key: 'arcs', args: {} },
    { key: 'gates', args: {} },
  ],
  elites: ['reinforced', 'overclocked', 'fortified'],
  garages: [
    // CONTENT_PLACEMENT: earned by story — claimed after a chase, not a
    // stand-up fight. The chase pack is the guard until Block 13 scripts it.
    { id: 'nc_parking', name: 'LEVEL 3 PARKING', cx: 12, cy: 16,
      x: 1536, y: 1536, guard: 'nc_chase_a' },
  ],
  placed: {
    '21,12': [[1300, 1500, 'nc_gate_a', 'marshal', 'directionalShield'],
              [1900, 1600, 'nc_gate_b', 'marshal', 'burstRifle']],
    '10,10': [[1100, 1300, 'nc_plaza_a', 'watch', 'beamLaser'],
              [1800, 1400, 'nc_plaza_b', 'watch'],
              [1400, 1900, 'nc_plaza_c', 'watch']],
    '16,8': [[1200, 1400, 'nc_transit_a', 'cite', 'railgun'],
             [1800, 1500, 'nc_transit_b', 'cite'],
             [1500, 2000, 'nc_transit_c', 'marshal']],
    '14,15': [[1300, 1500, 'nc_chase_a', 'curfew'],
              [1900, 1700, 'nc_chase_b', 'curfew']],
    '8,18': [[1100, 1300, 'nc_arcade_a', 'watch', 'pointDefence'],
             [1800, 1400, 'nc_arcade_b', 'watch'],
             [1400, 1900, 'nc_arcade_c', 'watch'],
             [2000, 2000, 'nc_arcade_d', 'watch']],
    '18,20': [[1300, 1400, 'nc_summons', 'summons', 'barrierProjector'],
              [1900, 1500, 'nc_summons_b', 'marshal', 'repairArm'],
              [1500, 2000, 'nc_summons_c', 'marshal', 'repairArm']],
    // A wall with lasers. You will not out-damage it. You go around it,
    // and that is the point.
    '6,14': [[1536, 1536, 'nc_clerk', 'bailiffs_clerk', null, 'arc_cascade']],
    '11,6': [[1200, 1400, 'nc_vault_a', 'marshal'],
             [1800, 1500, 'nc_vault_b', 'marshal'],
             [1500, 2000, 'nc_vault_c', 'marshal']],
  },
  barriers: {
    // The way IN is a grapple. The city is gated on reaching it at all.
    // (13,23), not (12,23): the coastline bites (12,23) out of the city, so
    // this barrier and the upgrade part beside it had never once been in
    // the world -- found by test_block15's coastline check (D346).
    '13,23': [[1536, 1536, 'rooftop', 'nc_wayIn', 'story:neon_arrival']],
    '10,10': [[900, 900, 'rooftop', 'nc_rooftop', 'mission:merit_2']],
    '11,6': [[1000, 900, 'bulkhead', 'nc_vault_door', 'map:barriers']],
    '15,19': [[1536, 1536, 'duct', 'nc_duct', 'permanent:arc_spike']],
    // Grapple 3, and THE STACKS behind it — the expansion hook, visible.
    '6,4': [[1536, 1536, 'chain', 'nc_skybridge', 'exit:stacks']],
  },
  story: {
    '10,10': [[2000, 900, 'tram_timetable']],
    '16,8': [[900, 900, 'transit_closure_notice']],
    '8,18': [[900, 2100, 'arcade_high_scores']],
    '12,16': [[1536, 2100, 'parking_rates_still_accruing']],
    '18,20': [[2100, 900, 'civic_evacuation_orderly']],
    '14,15': [[900, 2100, 'curfew_notice']],
    '11,6': [[2100, 2100, 'transit_authority_minutes']],
    '4,20': [[1536, 1536, 'lair_docket_nc']],
  },
  // FOUND MONEY (CONTENT_STASHES). Eight stashes; two vaults, both CORE
  // seals because the city refuses rigs: a HIGH LEDGE (Grapple 1) and a
  // BULKHEAD (Cutter 2). Stash 1 sits past the rooftop face.
  stashes: {
    '9,2': [[2467, 2296, 'stash', 'nc_stash_6']],
    '15,3': [[1409, 1139, 'stash', 'nc_stash_3']],
    '3,6': [[2356, 2038, 'vault:bulkhead', 'nc_vault_2']],
    '12,6': [[2340, 1947, 'stash', 'nc_stash_7']],
    '6,9': [[1704, 1836, 'stash', 'nc_stash_8']],
    '10,10': [[900, 1800, 'stash', 'nc_stash_1']],
    '5,13': [[729, 893, 'stash', 'nc_stash_2']],
    '16,14': [[1491, 886, 'stash', 'nc_stash_5']],
    '2,16': [[2554, 2284, 'stash', 'nc_stash_4']],
    '17,19': [[1432, 1114, 'vault:rooftop', 'nc_vault_1']],
  },
  finds: ['core:dynamo', 'permanent:arc_spike', 'permanent:arc_cascade',
          'gadget:cutter', 'decal:neonGlyph', 'decal:adBlock', 'decal:barcode'],
  // Positions from draft_district_neoncut.js. The three decals are the
  // commercial glyphs the city is papered in; the cutter is the district's
  // real prize, because it is what opens every shutter in the game after it.
  findsAt: {
    '8,18':  [[1536, 1536, 'gadget:cutter:1', 'nc_cutter']],
    '15,11': [[1536, 1536, 'decal:neonGlyph', 'nc_comm1']],
    '19,17': [[1536, 1536, 'decal:adBlock', 'nc_comm2']],
    '7,9':   [[1536, 1536, 'decal:barcode', 'nc_comm3']],
    '10,10': [[1536, 1536, 'permanent:arc_spike', 'nc_spike']],
    '20,4':  [[1536, 1536, 'permanent:arc_cascade', 'nc_cascade']],
    '3,20':  [[1536, 1536, 'core:dynamo', 'nc_dynamo']],
    // MERIT 2, "THREE ROOFTOPS". Gated on the GRAPPLE by the mission's own
    // `requires.gear`, and placed deep in the grid where the blocks are
    // tightest — the part of Neon Cut a machine on the ground has the least
    // business being in.
    '13,6':  [[1536, 1536, 'relic:surveyDrone', 'nc_drone_1']],
    '17,13': [[1536, 1536, 'relic:surveyDrone', 'nc_drone_2']],
    '5,15':  [[1536, 1536, 'relic:surveyDrone', 'nc_drone_3']],
    // CUTTER 3 — what opens the Ironworks pay vault, and the pay vault is
    // where the CRAB is. Deliberately in a different district from the door it
    // opens: the best torch in the game should be a trip.
    '22,21': [[1536, 1536, 'gadget:cutter:3', 'nc_cutter3']],
    // GRAPPLE 3 for the skybridge. The city is vertical and this is the top
    // of it.
    '4,12':  [[1536, 1536, 'gadget:grapple:3', 'nc_grapple3']],
    // Five in Neon Cut, all of them up somewhere.
    '13,23': [[1536, 1536, 'upgrade:part:1', 'nc_up_1']],   // was (12,23): coastline
    '18,8':  [[1700, 1400, 'upgrade:part:1', 'nc_up_2']],
    '11,6':  [[1400, 1700, 'upgrade:part:1', 'nc_up_3']],
    '15,19': [[1536, 1536, 'upgrade:part:1', 'nc_up_4']],
    '6,4':   [[1536, 1536, 'upgrade:part:1', 'nc_up_5']],
  },
  // A duct through the block. Core only, like everything in this city, and
  // the only way across the middle that is not a street.
  shortcuts: [
    { id: 'nc_cross', from: [15, 19], to: [9, 15], opensWith: 'nc_duct' },
  ],
  boss: 'bailiff',               // id into BOSSES
  gateIn: 'grapple:1',
  exits: [
    { cx: 22, cy: 12, to: 'sprawl' },
    // THE WAY INTO CENTRAL DISPATCH. Part 3's map reaches it through the
    // Sumpworks and the Stacks, neither of which ships; the city is the
    // control facility's own district in the six that do, and the gate is
    // a STORY gate rather than a rig or a gadget -- see `gateIn` on the
    // district itself.
    { cx: 2, cy: 2, to: 'dispatch' },
  ],
});

// ---------------------------------------------------------------------------
// 5. THE ASH BARRENS — the connective ground. No garage.
//
// "Long sight lines and far silhouettes — this is where the world reads as
//  big." And WORLD_SCALE: open-range patrol density about a third of a
//  district's, so you meet something every twelve to fifteen seconds of
//  driving but the ground between feels empty. Empty stretches are not a bug.
const DISTRICT_BARRENS = DistrictGen.make({
  id: 'barrens',
  name: 'THE ASH BARRENS',
  cols: 80, rows: 60,            // the biggest single area in the game
  spawn: { cx: 4, cy: 30, x: 1536, y: 1536 },
  spawnPool: 'yard',
  density: 0.34,                 // QUIET. A continent needs quiet ground.
  look: 'grey haze, low contrast, distant silhouettes of every other district',
  says: 'there was more of this world than you will ever see',
  terrain: ['open', 'open', 'open', 'collapse'],
  // CONNECTIVE GROUND. draft_district_barrens says layout 'open': no clusters
  // and far fewer of them. The emptiness is the content, not a shortfall.
  layout: { kind: 'open' },
  props: ['wreckpile', 'roadsign', 'dustdrift', 'outpostshack', 'pylon',
          'debrispillar', 'rubble'],
  hazards: [
    { key: 'arty', args: {} },
    { key: 'collapses', args: {} },
    // THE BARRENS IS THE CROSSING, so the ground it is crossed on matters
    // more here than anywhere. Bigger patches: this is the district where a
    // move module is worth a socket.
    { key: 'rough', args: { w: [1600, 3200], h: [1200, 2200] } },
  ],
  elites: ['hunter'],
  // ONE, AND ONLY ONE, AND IT IS FAR AWAY.
  //
  // This said `garages: []` with the note "NONE. This is what you cross." That
  // is a good line and it was true when the Barrens was connective ground —
  // but TALLY has since moved in with a three-mission chain, PATCHWORK roams
  // here, and there are three fragments and four outposts. Eighty chunks of
  // content with nowhere to bank means dying with a full carry costs a crossing
  // to the Ironworks and back, against an economy tuned for a banking run
  // every eight to fifteen minutes.
  //
  // So: one yard, at the FAR side, guarded. The crossing keeps its character —
  // nothing to bank at on the way, nothing at the start — and gains an end.
  // A crossing with a destination is a journey; one without is a commute.
  garages: [
    { id: 'bar_farside', name: 'THE FAR SIDE', cx: 70, cy: 27,
      x: 1536, y: 1536, guard: 'bar_out4_a' },
  ],
  // CONTENT_PLACEMENT's outposts and nests. The draft authored the Barrens
  // on the WHOLE-WORLD grid (240x180, districts stamped onto it) — a model
  // the runtime does not have — so its coordinates are translated into this
  // 80x60 local grid with their relative geometry kept (D138).
  placed: {
    // The IRONCLAD wreck's guard (round 2).
    '58,40': [[1536, 1000, 'bar_ironclad_guard', 'knock']],
    // Four tiny fortified points. Two or three machines each.
    '19,46': [[1200, 1400, 'bar_out1_a', 'spoil'],
              [1900, 1500, 'bar_out1_b', 'spoil'],
              [1500, 2000, 'bar_out1_c', 'stalk', 'mortar']],
    '46,21': [[1200, 1400, 'bar_out2_a', 'knock', 'heavyArmour'],
              [1900, 1500, 'bar_out2_b', 'sweep'],
              [1500, 2000, 'bar_out2_c', 'sweep']],
    // TALLY 1, "OFF THE ROSTER". Three machines TALLY holds no record of,
    // and the reason they are SEPARATE from the four outposts is the whole
    // joke: an outpost is on the roster. These are not. They stand alone, in
    // three different corners, and nothing else in the district explains them.
    '12,12': [[1536, 1536, 'bar_stray_1', 'stalk']],
    '38,34': [[1536, 1536, 'bar_stray_2', 'spoil']],
    '27,52': [[1536, 1536, 'bar_stray_3', 'knock']],
    '8,6': [[1200, 1400, 'bar_out3_a', 'stalk', 'railgun'],
            [1900, 1500, 'bar_out3_b', 'stalk'],
            [1500, 2000, 'bar_out3_c', 'spoil']],
    '68,52': [[1200, 1400, 'bar_out4_a', 'knock'],
              [1900, 1500, 'bar_out4_b', 'knock'],
              [1500, 2000, 'bar_out4_c', 'charge']],
    // The nest by the main crossing, and the two that overlook it.
    '30,33': [[900, 1100, 'bar_nest_a', 'charge'],
              [1600, 1000, 'bar_nest_b', 'charge'],
              [1200, 1700, 'bar_nest_c', 'charge'],
              [2000, 1500, 'bar_nest_d', 'charge'],
              [1700, 2100, 'bar_nest_e', 'charge']],
    '35,29': [[1300, 1500, 'bar_crossing_a', 'stalk', null, 'mg_longshot'],
              [1900, 1700, 'bar_crossing_b', 'stalk']],
  },
  barriers: {
    // Halves the main crossing once the Tank can walk it.
    '39,36': [[1536, 1536, 'minefield', 'bar_mined_crossing', 'shortcut']],
    // Crab climb, and the best wreck in the district on the shelf above.
    '16,26': [[1536, 1536, 'cliff', 'bar_cliff', 'wreck']],
    '55,46': [[1536, 1536, 'gap', 'bar_gap', 'shortcut']],
  },
  // Roughly equidistant from the Yard, Ironworks and Sprawl garages, so the
  // player has to pick a destination before they hook it.
  chassis: { '32,40': [[1536, 1536, 'tank']] },
  // Q4: the IRONCLAD -- the defence machine -- on the far side, about
  // three minutes of open ground from THE FAR SIDE.
  // GUARDED (round 2): a KNOCK stands over it, the Barrens' quality roster.
  machines: { '58,40': [[1536, 1536, 'ironclad', 'bar_ironclad_guard']] },
  story: {
    '28,30': [[1536, 1536, 'road_sign_distances_no_names']],
    '46,21': [[2100, 900, 'weathered_work_order']],
    '12,57': [[1536, 1536, 'convoy_manifest_half_gone']],
  },
  // FOUND MONEY (CONTENT_STASHES). Eight stashes across the connective
  // ground -- pocket change by now, which is the right shape -- and two
  // vaults, a CLIFF FACE (Crab) and an OLD MINEFIELD (Tank). Stash 1 sits
  // past the mined crossing.
  stashes: {
    '11,3': [[1633, 604, 'stash', 'bar_stash_3']],
    '44,7': [[1327, 2290, 'vault:cliff', 'bar_vault_1']],
    '38,9': [[676, 2489, 'stash', 'bar_stash_8']],
    '20,22': [[2284, 2025, 'stash', 'bar_stash_7']],
    '73,23': [[952, 1995, 'stash', 'bar_stash_6']],
    '18,27': [[953, 992, 'vault:minefield', 'bar_vault_2']],
    '65,29': [[1169, 1778, 'stash', 'bar_stash_2']],
    '39,36': [[1536, 2436, 'stash', 'bar_stash_1']],
    '56,37': [[2560, 1532, 'stash', 'bar_stash_5']],
    '29,50': [[2097, 1068, 'stash', 'bar_stash_4']],
  },
  finds: ['rig:tank', 'permanent:mg_longshot', 'colourset:rust'],
  // The Barrens is the emptiest ground in the game, so its two finds are
  // deliberately far apart and far from any garage: this is where towing is
  // most expensive and most rewarding, and a find out here is the reason to
  // have come. The tank chassis is a hulk (the `chassis` rows), not a crate.
  findsAt: {
    '18,44': [[1536, 1536, 'permanent:mg_longshot', 'bar_longshot']],
    '62,14': [[1536, 1536, 'colourset:rust', 'bar_rust']],
    // BLOCK 13: TALLY's unserialised object - a human-made thing, which is
    // the one category its four hundred years of counting cannot file.
    '30,26': [[1536, 1536, 'relic:unserialised', 'bar_unserialised']],
    // Four in the Barrens. Deliberately the thinnest of the five: crossing it
    // is the cost, and the far side is where the reward is.
    '16,26': [[1536, 1536, 'upgrade:part:1', 'bar_up_1']],
    '55,46': [[1536, 1536, 'upgrade:part:1', 'bar_up_2']],
    '39,36': [[1700, 1400, 'upgrade:part:1', 'bar_up_3']],
    '70,27': [[1400, 1700, 'upgrade:part:1', 'bar_up_4']],
  },
  // TWO, because the Barrens is connective ground and a shortcut across it is
  // worth more than a shortcut anywhere else. Both barriers already carried
  // the reward 'shortcut'; these are the routes they meant.
  shortcuts: [
    { id: 'bar_crossing', from: [39, 36], to: [50, 30],
      opensWith: 'bar_mined_crossing' },
    { id: 'bar_leap', from: [55, 46], to: [44, 52], opensWith: 'bar_gap' },
  ],
  boss: 'patchwork',             // id into BOSSES
  gateIn: null,
  exits: [
    { cx: 2, cy: 30, to: 'railspine' },
    { cx: 4, cy: 30, to: 'yard' },
    { cx: 30, cy: 4, to: 'ironworks' },
    { cx: 76, cy: 28, to: 'sprawl' },
  ],
});

// ---------------------------------------------------------------------------
// THE FIVE, and the order they open in. Part 3's map, as data.
// ---------------------------------------------------------------------------
// RAIL SPINE — 64x16, long and thin on purpose, from
// content/draft_district_railspine.js.
//
// "Carries the only genuinely new hazard class in the game: freight that moves
//  along the lines, that you can ride and that can crush you. It is the best
//  idea in the content library and the most expensive. If scope ever bites,
//  cut that district rather than simplify the hazard, because THE HAZARD IS
//  THE DISTRICT." — content/README.md
//
// So it was drafted as expansion and is promoted here, hazard intact.
const DISTRICT_RAILSPINE = DistrictGen.make({
  id: 'railspine',
  name: 'RAIL SPINE',
  cols: 64, rows: 16,            // you read this place by looking ALONG it
  spawn: { cx: 2, cy: 8, x: 1536, y: 1536 },
  spawnPool: 'foundry',
  density: 0.9,
  look: 'ballast, oil, container colours - the only brightness for a mile',
  says: 'the network still moves things, and nothing is waiting for them',
  terrain: ['haul', 'haul', 'open', 'presses'],
  // Everything aligns to the lines, because the lines are what the place is.
  layout: { kind: 'lines', lineCount: 9, lineSpacing: 900, axis: 'x' },
  // SIGNAL LAMPS, which CONTENT_WORLD asks for by name -- "container colours
  // as the only brightness, signal lamps" -- and which the Rail Spine had no
  // way to draw: not one prop in its mix was emissive, so the neon identity it
  // was given lit nothing and measured 0.00%. Data that nothing can read is
  // the defect this project keeps finding; a declared look that cannot appear
  // is the same defect wearing a different hat.
  //
  // `streetlight` is the existing emissive prop closest to a trackside lamp.
  // MY CALL, NOT AARON'S -- he named five districts and this is the sixth.
  props: ['ingotrack', 'stack', 'pipe_run', 'gantry', 'crate', 'oildrum',
          'debrispillar', 'streetlight'],
  // TERRAIN ONLY in the open, like everywhere else (D191). The freight is not
  // in this list: a train runs a LINE, and a line is placed, never scattered.
  hazards: [{ key: 'collapses', args: {} }],
  elites: ['reinforced'],
  garages: [
    { id: 'rs_depot', name: 'THE DEPOT', cx: 30, cy: 8, x: 1536, y: 1536,
      guard: 'rs_yardWarden' },
  ],
  placed: {
    // The MAMMOTH wreck's guard (round 2).
    '48,4': [[1536, 1000, 'rs_mammoth_guard', 'slagjaw']],
    '30,7': [[1536, 1200, 'rs_yardWarden', 'block_warden', 'heavyTreads']],
    '12,8': [[1536, 1536, 'rs_shunter', 'stacker', 'armourPlate']],
    '48,8': [[1536, 1536, 'rs_gantryCrew', 'picker']],
    // BLOCK 13: LEDGER's escort, which ledger_2 names.
    '40,8': [[1536, 1536, 'rs_escort', 'stacker', 'targetingModule']],
  },
  barriers: {
    '20,8': [[1536, 1536, 'barricade', 'rs_crossing', 'shortcut']],
    '52,8': [[1536, 1536, 'shutter', 'rs_depot_door', 'permanent:mg_longshot']],
  },
  chassis: {},
  // Q4: the MAMMOTH -- the MACHINE, the heavy-weapons Jackrig, which shares
  // its id with the rig in rigs.js and is a different thing (MODELS_ON_DISK)
  // -- down the line from the depot.
  // GUARDED (round 2): a SLAGJAW, the works roster's heavy.
  machines: { '48,4': [[1536, 1536, 'mammoth', 'rs_mammoth_guard']] },
  // The three fragments storydata.js already writes for this district. A
  // fragment whose district ships and stands nowhere is a fragment nobody
  // can ever read, and test_phasec has always said so.
  story: {
    '6,8':  [[1536, 1536, 'manifest_to_nowhere']],
    '26,8': [[1536, 1536, 'signal_box_log']],
    '44,8': [[1536, 1536, 'timetable_freight']],
    '16,8': [[1536, 1536, 'wagon_chalk']],
    '56,8': [[1536, 1536, 'level_crossing']],
  },
  // FOUND MONEY (CONTENT_STASHES). Eight stashes beside the lines, never on
  // one (the four running rails are checked in world y); two vaults, a
  // FLOODED GROUND (Diver) and a HIGH SHELF (Cheetah). Stash 1 sits past the
  // level crossing.
  stashes: {
    '10,3': [[2180, 721, 'stash', 'rs_stash_8']],
    '34,3': [[2194, 1899, 'vault:ledge', 'rs_vault_2']],
    '16,5': [[2397, 504, 'stash', 'rs_stash_6']],
    '56,7': [[2050, 1499, 'stash', 'rs_stash_3']],
    '20,8': [[1536, 2436, 'stash', 'rs_stash_1']],
    '5,10': [[1271, 1150, 'vault:flooded', 'rs_vault_1']],
    '47,10': [[1914, 557, 'stash', 'rs_stash_2']],
    '59,10': [[1934, 2112, 'stash', 'rs_stash_7']],
    '42,11': [[1586, 1035, 'stash', 'rs_stash_4']],
    '34,13': [[1123, 2209, 'stash', 'rs_stash_5']],
  },
  finds: ['permanent:mg_longshot', 'module:ruggedTreads'],
  findsAt: {
    '52,8': [[1900, 1536, 'permanent:mg_longshot', 'rs_longshot']],
    '8,4':  [[1536, 1536, 'module:ruggedTreads', 'rs_treads']],
  },
  shortcuts: [
    { id: 'rs_cross', from: [20, 8], to: [34, 8], opensWith: 'rs_crossing' },
  ],
  boss: null,
  gateIn: null,
  exits: [
    { cx: 1, cy: 8, to: 'sprawl' },
    { cx: 62, cy: 8, to: 'barrens' },
  ],
});

// THE LINES THEMSELVES, and the trains on them. Placed, never scattered: a
// train runs the whole length of the district, so it belongs to the district
// rather than to any chunk, and it is spawned world-owned at entry the way a
// district gate is.
//
// Nine lines, four of them running. Five quiet ones matter as much as the four
// live ones: a district where every rail has a train on it is a district with
// no cover and no rhythm.
const RAILSPINE_LINES = [
  { line: 1, cars: 5, dir: 1,  phase: 0.00 },
  // LEDGER 1, "RIDE IT DOWN". The one line with a destination, and it
  // runs WEST, so riding it means going away from the district's entrance
  // - which is the whole point of the errand: nothing has ever come back.
  { line: 3, cars: 4, dir: -1, phase: 0.35, to: 'siding_40', toCx: 6 },
  { line: 5, cars: 6, dir: 1,  phase: 0.62 },
  { line: 7, cars: 3, dir: -1, phase: 0.15 },
];

// ---------------------------------------------------------------------------
// 7. CENTRAL DISPATCH -- ENDGAME. From content/draft_district_dispatch.js.
//
// "Not a factory. A CONTROL FACILITY. Server halls, dispatch floors, a wall
//  of screens showing every district at once, still allocating work orders.
//  Cold, clean, quiet, and lit. The only place in the world that isn't
//  broken." And: "THIS DISTRICT BEING CLEAN IS THE WHOLE ENDING."
//
// Small, tight, final: 16 x 16. You do not come here to explore. The draft's
// `halls` layout is the grid the Sprawl uses at a hall's size; its five
// props are four new ones in props.js and the Sprawl's streetlight for the
// corridor signage; its four hazard names map onto the classes that exist
// (`fields` for the shield lines, `pulses` for the pulse emitters, `locks`
// for the lockdown gear, `plates` for the floor). The art pass the draft
// asks for is still an art pass -- these are the procedural boxes every
// prop draws as until it has a sprite -- but the district STANDS, the
// dispatcher's hall is reachable, and the three endings can be reached.
//
// GATE IN: STORY. `story:final` is Story.finalOpen(): the reclassification
// scene played, and both shipping lairs beaten. The refusal names what is
// missing.
const DISTRICT_DISPATCH = DistrictGen.make({
  id: 'dispatch',
  name: 'CENTRAL DISPATCH',
  endgame: true,
  cols: 16, rows: 16,
  spawn: { cx: 2, cy: 13, x: 1536, y: 1536 },
  spawnPool: 'coreworks',
  density: 0.55,
  look: 'white, cyan-white, sterile - the one district that is not filthy',
  says: 'nobody is in charge. That is the point. There was never anyone to reason with.',
  terrain: ['open', 'open', 'presses'],
  layout: { kind: 'grid', blockSize: [2400, 2400] },
  props: ['serverrack', 'serverrack', 'screenwall', 'dispatchdesk', 'signage', 'streetlight'],
  hazards: [{ key: 'pulses', args: {} }, { key: 'fields', args: {} }],
  elites: ['fortified', 'reclaimer'],
  garages: [
    // Given on arrival. There is no going back easily and the game says so
    // by handing you the door rather than making you earn it.
    { id: 'cd_staffBay', name: 'STAFF BAY', cx: 12, cy: 12, x: 1536, y: 1536,
      guard: null },
  ],
  placed: {
    // The network's own guard: the best-built machines in the game. Not
    // more numerous -- BETTER. Same roster, top-tier builds.
    '12,10': [[1200, 1400, 'cd_lobby_a', 'marshal'],
              [1900, 1400, 'cd_lobby_b', 'marshal'],
              [1536, 2000, 'cd_lobby_c', 'summons']],
    '8,8':   [[1536, 1536, 'cd_halls', 'bailiffs_clerk', 'heavyArmour']],
    '6,12':  [[1000, 1200, 'cd_racks_a', 'cite'], [2100, 1200, 'cd_racks_b', 'cite'],
              [1000, 2000, 'cd_racks_c', 'watch'], [2100, 2000, 'cd_racks_d', 'watch']],
    '5,5':   [[900, 1500, 'cd_floor_a', 'marshal'], [2200, 1500, 'cd_floor_b', 'marshal'],
              [1536, 900, 'cd_floor_c', 'marshal'], [1536, 2200, 'cd_floor_d', 'summons']],
  },
  barriers: {
    // The bulkhead onto the server halls: CUTTER 3, with the CLERK and the
    // core slot behind it.
    '8,7': [[1536, 2800, 'shutter', 'cd_bulkhead', 'slot:core']],
  },
  chassis: {},
  story: {
    '10,10': [[1536, 1536, 'allocation_log']],
    '6,12':  [[1536, 1536, 'requirement_field']],
    '12,12': [[900, 900, 'desk_note']],
    '12,10': [[1536, 900, 'visitor_log']],
    '8,8':   [[900, 900, 'air_conditioning']],
    '4,5':   [[1536, 2800, 'the_queue']],
  },
  finds: ['colourset:dispatch', 'slot:core'],
  findsAt: {
    '12,12': [[2100, 2100, 'colourset:dispatch', 'cd_white']],
    '8,8':   [[2100, 900, 'slot:core', 'cd_slot']],
  },
  shortcuts: [],
  boss: 'dispatcher',
  gateIn: 'story:final',
  exits: [
    { cx: 2, cy: 13, to: 'neoncut' },
  ],
});

const DISTRICTS = {
  yard: DISTRICT_YARD,
  railspine: DISTRICT_RAILSPINE,
  sprawl: DISTRICT_SPRAWL,
  ironworks: DISTRICT_IRONWORKS_GEN,
  neoncut: DISTRICT_NEONCUT,
  barrens: DISTRICT_BARRENS,
  dispatch: DISTRICT_DISPATCH,
};
// SEVEN. Rail Spine was drafted as expansion and is PROMOTED: the moving
// freight is a headline feature the player expects, and content/README says
// outright that if scope bites you cut the district rather than simplify the
// hazard, because THE HAZARD IS THE DISTRICT. And CENTRAL DISPATCH, the
// endgame, is promoted because the three endings are unreachable without
// it and a game whose ending cannot be reached is not a game (D330).
const DISTRICT_LIST = ['yard', 'ironworks', 'sprawl', 'neoncut', 'barrens',
                       'railspine', 'dispatch'];

// ---------------------------------------------------------------------------
// THE OLD HAND-AUTHORED IRONWORKS IS GONE, and these are what is left of it.
//
// It was 8x8 chunks with a hand-typed template grid — the thing WORLD_SCALE
// says is 20x too small and BLOCKS_8_15 C.1 says nobody will ever author
// 43,200 of. Keeping it alongside the generated 36x36 one would have been
// two sources of truth for the same district, which is precisely the shape
// of bug this project has now been bitten by three times: World.explored
// shadowing the save, the 'placed:' id prefix, and the Block 7 vehicle key.
//
// The names it exported stay as aliases, so nothing that referred to it has
// to care that it is now generated.
const DISTRICT_IRONWORKS = DISTRICTS.ironworks;
const IRONWORKS_PLACED = DISTRICT_IRONWORKS._spec.placed;
const IRONWORKS_BARRIERS = DISTRICT_IRONWORKS._spec.barriers;

// B.4: TWO THINGS OPEN AT ONCE, TWICE. Neither side of a pair is the
// 'right' one — they open together and the player picks.
const WORLD_ROUTES = [
  { from: 'yard', opens: ['ironworks', 'sprawl'], why: 'walkable, no gate' },
  { from: 'sprawl', opens: ['neoncut', 'barrens'],
    why: 'Grapple into the city, or drive out across the Barrens' },
  { from: 'neoncut', opens: ['dispatch'],
    why: 'the story gate: the reclassification scene, and both lairs beaten' },
];

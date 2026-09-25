// SCRAPCORE: BREAKLANDS — MISSIONS AND NPCs (content/draft_missions.js)
//
// Nine NPCs and their missions, with full dialogue.
//
// DATA ONLY, for the same reason js/storydata.js is: giving a mission, tracking
// it and paying it out is BLOCK 13, and building it here would be building a
// system in the wrong block. What this file does is hold the content and let
// tests/test_story.js prove it is well-formed against the things that DO
// exist " — " districts, rigs, permanents, parts " — " so the day Block 13 lands
// there is nothing to fix first.

const NPCS = {

  hob: {
    name: 'HOB', district: 'yard', at: [11, 15],
    what: 'a cargo loader with one arm. Scrub has grown over its treads.',
    want: 'its other arm. It has known where the arm is for two hundred years.',
    meet: [
      "Left arm. Grid nineteen. It's been grid nineteen the whole time.",
      "I can see it from here. That's the part I'd change if I could change one part.",
    ],
    idle: [
      "Grid nineteen.",
      "You get used to it. That's the trouble.",
    ],
    done: [
      "Balanced. Huh.",
      "I'd forgotten which way I used to lean.",
    ],
  },

  vane: {
    name: 'VANE', district: 'ironworks', at: [18, 20],
    what: 'a pour-line supervisor welded to a gantry it can no longer leave.',
    want: 'to stop. Its shutdown needs a signature from an office that collapsed a century ago.',
    meet: [
      "Shift change. Shift change. Shift change.",
      "Apologies. It queues, whether or not I say it.",
    ],
    idle: [
      "Pour three is four percent over. Nobody minds.",
      "You could get in there. You're not on the manifest, so the door won't argue.",
    ],
    // VANE is switched off at the end of its chain and does not come back.
    // The player did what it asked. It should feel slightly bad and entirely
    // correct.
    done: [
      "Authorised. Signed. Filed.",
      "Thank you. Now I stop.",
    ],
    endsSwitchedOff: true,
  },

  merit: {
    name: 'MERIT', district: 'neoncut', at: [10, 10],
    what: 'a civic information terminal on a plaza, still giving directions to a tram that stopped running before the machines took the city.',
    want: 'an accurate map. Its data is four hundred years stale and it knows.',
    meet: [
      "The tram runs every eleven minutes. I am aware that it does not.",
      "I would rather be correct than comfortable.",
    ],
    idle: [
      "Platform two, for services that will not arrive.",
      "My apologies for any inconvenience. Statistically, there is no one to inconvenience.",
    ],
    done: [
      "Updated. Verified. Current.",
      "Ask me anything. I am, at last, worth asking.",
    ],
  },

  bolt: {
    name: 'BOLT', district: 'sprawl', at: [26, 34],
    what: 'a street-repair unit that has resurfaced the same 200 metres for a century, because the work order says "maintain" and never says "stop".',
    want: 'a different road.',
    meet: [
      "Maintain. That's the whole order. Maintain.",
      "Two hundred metres. I know every centimetre. I'd like to not.",
    ],
    idle: [
      "Pothole at forty metres. There's always a pothole at forty metres. I put it there, at this point, arguably.",
      "Careful on my road. It's the best road in the world. I'd know.",
    ],
    done: [
      "A new road.",
      "It's in terrible condition. It's wonderful.",
    ],
  },

  tally: {
    name: 'TALLY', district: 'barrens',
    // TALLY WALKS. It is a census unit on a route between districts, and the
    // route below is what it is FOR. Block 13 has no roaming NPC, so it is
    // parked at the Barrens end of that route rather than being absent from
    // the world - a person you cannot find is worse than a person who is
    // standing still. THE ROAMING IS A NAMED DEBT, not a forgotten one.
    at: [30, 26],
    roams: true,
    route: ['yard_exit', 'ironworks_exit', 'sprawl_exit_e'],
    what: 'a census unit walking a route between districts, counting things. It has counted everything. Twice.',
    want: 'a discrepancy. Everything has always added up, and it finds that unbearable.',
    meet: [
      "Four hundred and six years. Everything adds up. Every single time.",
      "You don't add up. It's the best day I've had.",
    ],
    idle: [
      "Nine hundred and twelve pylons. Still.",
      "I counted you twice. Once coming, once going. Both times you were one.",
    ],
    done: [
      "A discrepancy. A real one. Confirmed and logged.",
      "I have re-counted it forty times and it stays wrong. I could weep, if that were on the parts list.",
    ],
  },

  // ---- EXPANSION DISTRICT NPCS (ship with their districts) ---------------
  comb: {
    name: 'COMB', district: 'grows', at: null, expansion: true,
    what: 'a pollination controller running a hive with nothing to pollinate.',
    want: 'someone to accept a delivery. Any delivery. Its outbound queue is 400 years deep.',
    meet: [
      "Yield is nominal. Yield has been nominal for a very long time.",
      "Take one. Please. It only has to go somewhere.",
    ],
  },
  drain: {
    name: 'DRAIN', district: 'sumpworks', at: null, expansion: true,
    requires: { gadget: 'seal_1' },
    what: 'a pump-station controller, submerged, still filing the same maintenance ticket.',
    want: 'ticket #4471 actioned. Raised the day the pump failed.',
    meet: [
      "Ticket four four seven one. Raised. Acknowledged. Not actioned.",
      "I have re-raised it eleven thousand times. That is the correct procedure.",
    ],
  },
  ledger: {
    // PLACED. Rail Spine was promoted out of the expansion set and shipped,
    // and LEDGER came with it - except that its `at` stayed null, so the one
    // person in the district stood nowhere and three finished missions could
    // never be offered by anybody. A signal box two chunks in from the head
    // of the yard, on the south side of the lines: close enough to the
    // entrance to be the first thing you find, and on the ground between
    // lines, which is the only ground in Rail Spine that is not a timetable.
    name: 'LEDGER', district: 'railspine', at: [5, 9],
    what: 'a freight allocator in a signal box, still routing full trains to full sidings.',
    want: 'to know where anything ends up. Nothing has ever come back.',
    meet: [
      "Eleven thousand consignments a day. Zero receipts. Ever.",
      "I'd just like one signature. I'm not asking for the goods back.",
    ],
  },
  chalk: {
    name: 'CHALK', district: 'digs', at: null, expansion: true,
    what: 'a survey unit that mapped the whole seam and has never been able to tell anyone.',
    want: 'its map read.',
    meet: [
      "Seventy kilometres of workings, surveyed to the centimetre.",
      "Would you like to see? Nobody has ever wanted to see.",
    ],
  },
};

const MISSIONS = {

  // ---- HOB: THE REST OF HIM ---------------------------------------------
  hob_1: {
    npc: 'hob', chain: 'hob', step: 1, type: 'RECOVERY',
    title: 'GRID NINETEEN',
    brief: 'A repair arm, two minutes out, in a wreck. Bring it back whole.',
    target: { kind: 'find', id: 'yard_grid19_arm' },
    deliver: { kind: 'npc', id: 'hob' },
    reward: { scrap: 250 },
    lines: { give: ["Grid nineteen. Gently, if it's all the same."],
             done: ["That's it. That's the very one. Set it down, I've waited this long, I can watch it a while first."] },
  },
  hob_2: {
    npc: 'hob', chain: 'hob', step: 2, type: 'HUNT',
    title: 'THE SQUATTER',
    brief: 'A STACKER is sitting on the second arm and will not be moving voluntarily.',
    requires: { missions: ['hob_1'] },
    target: { kind: 'machine', id: 'yard_grid19' },
    reward: { module: 'cargoRack', scrap: 150 },
    lines: { give: ["There's a second arm. There's also a machine sitting on it. I've asked it to move every day for sixty years. It's your kind of problem now."],
             done: ["It never once answered me, you know. Sixty years. Rude, on top of everything."] },
  },
  hob_3: {
    npc: 'hob', chain: 'hob', step: 3, type: 'RECOVERY',
    title: 'THE REST OF HIM',
    brief: 'The loader chassis both arms came off. Grid nineteen. Tow it back whole.',
    requires: { missions: ['hob_2'], gear: ['towWinch'] },
    target: { kind: 'wreck', id: 'yard_loader' },
    // 'yard_mags', which is the garage's id. It said 'yard', which no garage
    // has ever been called; the mission still completed, because a towed
    // wreck is delivered by having been towed (Missions.delivered), so the
    // wrong name was never asked. It is the right name now.
    deliver: { kind: 'garage', id: 'yard_mags' },
    reward: { slot: { vehicle: 'core' }, scrap: 400 },
    lines: { give: ["One more. The rest of him. He and I did four hundred thousand shifts, and he's been lying in grid nineteen for two centuries. Bring him home."],
             done: ["Put him next to the fence where the sun gets. Thank you. I mean that in whatever way a loader can mean things."] },
  },

  // ---- VANE: SIGNED OFF --------------------------------------------------
  vane_1: {
    npc: 'vane', chain: 'vane', step: 1, type: 'CLEAR-OUT',
    title: 'QUIET ON THE FLOOR',
    brief: 'Suppress the pour floor. VANE cannot hear itself over the machines it is supervising.',
    target: { kind: 'clearArea', at: [18, 20], radius: 6000 },
    reward: { upgradeParts: 2, scrap: 300 },
    lines: { give: ["I need to think, and thinking requires the floor to stop screaming. Clear it. They'll come back. They always come back. But I only need an hour."],
             done: ["There. Listen. Four hundred years and I'd forgotten the furnace has a NOTE."] },
  },
  vane_2: {
    npc: 'vane', chain: 'vane', step: 2, type: 'BREAK-IN',
    title: 'THE SHIFT OFFICE',
    brief: 'The shutdown authorisation is in the collapsed shift office. Needs MAMMOTH SMASH.',
    requires: { missions: ['vane_1'], gear: ['mammoth'] },
    target: { kind: 'barrier', id: 'iw_office_wall' },
    reward: { permanentWeapon: 'mg_rasp' },
    lines: { give: ["The office. The wall came down in the second century and the door is under it. You have a machine that disagrees with walls."],
             done: ["The stamp. The actual stamp. I can see it from here. One more thing, and then I'll stop asking for things forever. Literally, in fact."] },
  },
  vane_3: {
    npc: 'vane', chain: 'vane', step: 3, type: 'RECOVERY',
    title: 'SIGNED OFF',
    brief: 'Bring VANE the authorisation stamp.',
    requires: { missions: ['vane_2'] },
    target: { kind: 'find', id: 'iw_auth_stamp' },
    deliver: { kind: 'npc', id: 'vane' },
    reward: { chassisLocation: 'kiln', scrap: 500 },
    onComplete: 'vane_shutdown',   // VANE authorises itself, and stops.
    lines: { give: ["Press it to the reader. I can't reach. I've never been able to reach. That was rather the design."],
             done: ["Authorised. Signed. Filed.", "Thank you. Now I stop."] },
  },

  // ---- MERIT: THE CORRECT MAP -------------------------------------------
  merit_1: {
    npc: 'merit', chain: 'merit', step: 1, type: 'CLEAR-OUT',
    title: 'A CLEAR PLAZA',
    brief: 'MERIT cannot survey through a security cordon. Clear the plaza.',
    target: { kind: 'clearArea', at: [10, 10], radius: 4000 },
    reward: { colourSet: 'neon' },
    lines: { give: ["I survey by line of sight, and the WATCH units keep standing in mine. Remove them and I can at least be wrong about fewer things."],
             done: ["Better. The plaza is nine centimetres smaller than my records claim. NINE. What else have they been letting slide."] },
  },
  merit_2: {
    npc: 'merit', chain: 'merit', step: 2, type: 'RECOVERY',
    title: 'THREE ROOFTOPS',
    brief: 'Recover survey drones from three rooftops. Needs GRAPPLE.',
    requires: { missions: ['merit_1'], gear: ['grapple_1'] },
    target: { kind: 'multi', ids: ['nc_drone_1', 'nc_drone_2', 'nc_drone_3'] },
    reward: { gadget: { id: 'grapple', rank: 2 } },
    lines: { give: ["I launched three drones the year the trams stopped. They completed their surveys and then had nowhere to file them. They are still up there, holding four centuries of homework."],
             done: ["Receiving. Receiving. Receiving. Oh, this is going to take WEEKS to reconcile. I could not be happier."] },
  },
  merit_3: {
    npc: 'merit', chain: 'merit', step: 3, type: 'BREAK-IN',
    title: 'THE TRANSIT VAULT',
    brief: 'The master survey is in the transit authority vault. Needs CUTTER 2.',
    requires: { missions: ['merit_2'], gear: ['cutter_2'] },
    target: { kind: 'barrier', id: 'nc_vault_door' },
    reward: { mapKnowledge: { district: 'neoncut', reveals: 'barriers' }, scrap: 400 },
    lines: { give: ["Behind that door is the city as it actually is. Or was. Bring me the master and I will reconcile it against everything I have watched fall down since."],
             done: ["Updated. Verified. Current. Ask me for directions. Please. Anywhere at all."] },
  },

  // ---- BOLT: A DIFFERENT ROAD -------------------------------------------
  bolt_1: {
    npc: 'bolt', chain: 'bolt', step: 1, type: 'CLEAR-OUT',
    title: 'RIGHT OF WAY',
    brief: 'A patrol route crosses BOLT\'s road. It cannot work through a firefight.',
    target: { kind: 'clearArea', at: [26, 34], radius: 5000 },
    reward: { module: 'ruggedTreads' },
    lines: { give: ["The SWEEPs cross my road eleven times a shift and they do NOT slow down for the wet surface signs. Move them along."],
             done: ["Look at that finish. You could eat your dinner off that camber. Nobody will. But you could."] },
  },
  bolt_2: {
    npc: 'bolt', chain: 'bolt', step: 2, type: 'RECOVERY',
    title: 'ANY OTHER STREET',
    brief: 'Somewhere in the depot is a work order for a different road. Find one. Any one.',
    requires: { missions: ['bolt_1'] },
    target: { kind: 'find', id: 'sp_work_order_road' },
    deliver: { kind: 'npc', id: 'bolt' },
    reward: { decalSet: 'civic', scrap: 300 },
    lines: { give: ["Orders come from the depot. Mine says maintain, and it has never said where else. There must be a work order in there for ANY other street. I'm not fussy. A cul-de-sac. A LANE."],
             done: ["Junction Road. JUNCTION ROAD. Four lanes. Do you know what I could DO with four lanes?"] },
  },
  bolt_3: {
    npc: 'bolt', chain: 'bolt', step: 3, type: 'HUNT',
    title: 'THE THING ON JUNCTION ROAD',
    brief: 'The BLOCK WARDEN is parked on the road BOLT wants. It is not a parking violation anyone can ticket.',
    requires: { missions: ['bolt_2'] },
    target: { kind: 'machine', id: 'sp_warden' },
    reward: { slot: { vehicle: 'rig' }, scrap: 500 },
    lines: { give: ["One obstruction. Forty tonnes of it. I have assessed it as beyond the scope of routine surface maintenance."],
             done: ["A new road.", "It's in terrible condition. It's wonderful. Come back in a century and see what I've done with it."] },
  },

  // ---- TALLY: THE DISCREPANCY -------------------------------------------
  tally_1: {
    npc: 'tally', chain: 'tally', step: 1, type: 'HUNT',
    title: 'OFF THE ROSTER',
    brief: 'Three machines in the Barrens are not on any roster TALLY holds. Retire them so the count is clean.',
    target: { kind: 'multi', ids: ['bar_stray_1', 'bar_stray_2', 'bar_stray_3'] },
    reward: { scrap: 400, xp: 800 },
    lines: { give: ["Three units with no asset tags. They ruin a perfectly good census. I want them off my ledger, and I cannot do the removing myself — it skews the numbers when the counter does the deleting."],
             done: ["Nine hundred and twelve pylons, zero anomalous units. Clean. Almost disappointingly clean."] },
  },
  tally_2: {
    npc: 'tally', chain: 'tally', step: 2, type: 'RECOVERY',
    title: 'NO SERIAL NUMBER',
    brief: 'Bring TALLY something with no serial number. Anything at all.',
    requires: { missions: ['tally_1'] },
    target: { kind: 'find', id: 'bar_unserialised' },  // human-made object
    deliver: { kind: 'npc', id: 'tally' },
    reward: { colourSet: 'rust' },
    lines: { give: ["Everything the network makes is numbered. I would like — and I have thought about this for a long time — to hold one thing that isn't."],
             done: ["No serial. No asset class. No entry. It's just... a cup.", "I am going to count it anyway. As one. One cup. Ha."] },
  },
  tally_3: {
    npc: 'tally', chain: 'tally', step: 3, type: 'HUNT',
    title: 'THE NUMBER THAT MOVED',
    brief: 'Wound PATCHWORK and bring TALLY the reading. A boss that stays hurt is a number that changed on its own.',
    requires: { missions: ['tally_2'] },
    target: { kind: 'bossDamage', id: 'patchwork', threshold: 0.4 },
    reward: { chassisLocation: 'shrike', scrap: 600 },
    lines: { give: ["The wandering one. Patchwork. Its mass reading is different every time I pass it, and I want to know the number can go DOWN. Make it go down. I'll watch from a professional distance."],
             done: ["A discrepancy. A real one. Confirmed and logged.", "I have re-counted it forty times and it stays wrong. I could weep, if that were on the parts list."] },
  },

  // =========================================================================
  // THE EXPANSION TWELVE (content/draft_missions_expansion.js, absorbed) —
  // COMB, DRAIN, LEDGER and CHALK, the four NPCs who ship with their
  // districts. Same rules: one want per NPC, three missions to get it, no
  // mission ever pays raw power. Gadget ids are bent to the vocabulary the
  // gates and gear checks already speak (drillRig -> drill, hoverPack ->
  // hover), like everything else in this file.
  //
  // ESCORT COUNT: the design allows two escorts in the whole game and the
  // full 27 now hold THREE (comb_1, drain_2, chalk_1) — all under three
  // minutes with a tough escortee. If escorts aren't fun in playtest,
  // convert comb_1 and chalk_1 to RECOVERY and leave drain_2 as the one.

  // ---- COMB — The Grows. Wants someone to accept a delivery. Any delivery.
  //      Its outbound queue is 400 years deep. -----------------------------
  comb_1: {
    npc: 'comb', chain: 'comb', step: 1, type: 'ESCORT',
    title: 'ONE LOAD, TO THE SILO',
    brief: 'Get a loaded harvester to the silo without it being torn apart.',
    target: { kind: 'escort', id: 'gr_harvester_run', to: [26, 8] },
    reward: { scrap: 900 },
    // ESCORT is the weakest of the five types in every game that ever had
    // it. Under three minutes, and the harvester is TOUGH — the player is
    // guarding it from swarms, not babysitting a paper doll.
    tuning: { seconds: 170, escorteeTough: true },
    lines: {
      give: ["Harvester nine is loaded and its route is blocked. It will not deviate. It has never deviated."],
      done: ["Delivered. Well — moved. It is the same silo, but it is a DIFFERENT PART of the silo."],
    },
  },
  comb_2: {
    npc: 'comb', chain: 'comb', step: 2, type: 'HUNT',
    title: 'THE THING IN THE LONG FIELD',
    brief: 'A STALK has been shooting COMB\'s pollinators out of the air for a century.',
    requires: { missions: ['comb_1'] },
    target: { kind: 'machine', id: 'gr_longfield' },
    reward: { permanentWeapon: 'pr_scald' },
    lines: {
      give: ["Something in the long field takes one drone every forty minutes. I have replaced eleven thousand drones. I would like to replace zero."],
      done: ["Forty minutes. Then eighty. Then a hundred and twenty. I am going to keep counting for a while, if that's alright."],
    },
  },
  comb_3: {
    npc: 'comb', chain: 'comb', step: 3, type: 'RECOVERY',
    title: 'SOMEWHERE',
    brief: 'Take one crate of yield to a garage. Any garage.',
    requires: { missions: ['comb_2'] },
    target: { kind: 'find', id: 'gr_yield_crate' },
    deliver: { kind: 'garage', any: true },
    reward: { chassisLocation: 'cheetah', colourSet: 'growth' },
    // Mechanically trivial and it is meant to be. This is the emotional one.
    lines: {
      give: ["One crate. Not to a silo. To anywhere that is not a silo.", "Please."],
      done: ["Received. Signed. Somewhere.", "Four hundred and six years of nominal yield and one crate has gone SOMEWHERE."],
    },
  },

  // ---- DRAIN — Sumpworks. Wants ticket #4471 actioned. Raised the day the
  //      pump failed, re-raised eleven thousand times. ---------------------
  drain_1: {
    npc: 'drain', chain: 'drain', step: 1, type: 'RECOVERY',
    title: 'AISLE NINE, CRATE FOUR',
    brief: 'The replacement impeller is still in its crate, in a flooded warehouse.',
    requires: { gear: ['seal_1'] },
    target: { kind: 'find', id: 'sw_impeller' },
    deliver: { kind: 'npc', id: 'drain' },
    reward: { gadgetRank: ['seal', 2], scrap: 400 },
    lines: {
      give: ["Aisle nine. Crate four. It has been in aisle nine, crate four, since the day the ticket was raised.", "I have confirmed its presence every day. It is a very well-confirmed crate."],
      done: ["The part exists. It has always existed. Now it is HERE, which is different."],
    },
  },
  drain_2: {
    npc: 'drain', chain: 'drain', step: 2, type: 'ESCORT',
    title: 'CREW ASSIGNED',
    brief: 'Get a repair unit across the sump without it drowning.',
    requires: { missions: ['drain_1'] },
    target: { kind: 'escort', id: 'sw_repair_unit', to: [16, 14] },
    reward: { module: 'fieldPatch' },
    tuning: { seconds: 150, escorteeTough: true },
    lines: {
      give: ["The ticket requires a crew. I have found one unit that still walks. It does not swim. This is the entire problem, compressed."],
      done: ["CREW ASSIGNED. I have wanted to write those two words for a very long time."],
    },
  },
  drain_3: {
    npc: 'drain', chain: 'drain', step: 3, type: 'HUNT',
    title: 'THE THING IN THE INTAKE',
    brief: 'Something has been nesting in the intake. The pump cannot restart around it.',
    requires: { missions: ['drain_2'] },
    target: { kind: 'machine', id: 'sw_intake' },
    reward: { chassis: 'diver', scrap: 700 },
    onComplete: 'pump_restart',   // this is also the garage claim
    lines: {
      give: ["Final obstruction. It is in the intake. It has been in the intake longer than the ticket has existed, which I find genuinely rude."],
      done: ["Ticket four four seven one. Actioned.", "I am going to close it now. I have never closed one. I do not know what the screen does."],
    },
  },

  // ---- LEDGER — Rail Spine. Wants to know where anything ends up. Nothing
  //      has ever come back. -----------------------------------------------
  ledger_1: {
    npc: 'ledger', chain: 'ledger', step: 1, type: 'RECOVERY',
    title: 'RIDE IT DOWN',
    brief: 'Ride a freight to its destination and report what is there.',
    target: { kind: 'rideFreight', line: 3, to: 'siding_40' },
    deliver: { kind: 'npc', id: 'ledger' },
    reward: { gadget: { id: 'hover', rank: 1 } },
    lines: {
      give: ["Line three, in about four minutes. Get on it. Stay on it. Tell me what is at the other end.", "I have routed eleven thousand consignments a day for four centuries and I have never once been told."],
      done: ["Full. Of course it's full. Nine kilometres of full.", "Thank you. That is the first field I have ever completed from OBSERVATION."],
    },
  },
  ledger_2: {
    npc: 'ledger', chain: 'ledger', step: 2, type: 'HUNT',
    title: 'CLEAR THE LINE',
    brief: 'THE ENGINE\'s escort has to go before any line can be read end to end.',
    requires: { missions: ['ledger_1'] },
    target: { kind: 'machine', id: 'rs_escort' },
    reward: { permanentWeapon: 'rg_line' },
    lines: {
      give: ["The escort will not let a survey unit near the running lines. I have asked. It does not have a mechanism for being asked."],
      done: ["Line clear. Signals green all the way to the horizon and nothing coming.", "That is the most beautiful and the most upsetting thing I have seen."],
    },
  },
  ledger_3: {
    npc: 'ledger', chain: 'ledger', step: 3, type: 'BREAK-IN',
    title: 'THE CENTRAL MANIFEST',
    brief: 'The master manifest is in the sealed depot. Needs CUTTER 2.',
    requires: { missions: ['ledger_2'], gear: ['cutter_2'] },
    target: { kind: 'barrier', id: 'rs_depot_door' },
    reward: { chassis: 'hauler', scrap: 800 },
    lines: {
      give: ["Everything I route, I route from a copy. The master is behind that door and I have never seen it.", "I would like to check my working."],
      done: ["My working is correct. Every consignment, every day, four hundred years, correct.", "I had rather hoped I'd made a mistake somewhere. It would have meant something was happening."],
    },
  },

  // ---- CHALK — The Digs. Wants its map read. It surveyed seventy
  //      kilometres of workings to the centimetre and nobody ever asked. ---
  chalk_1: {
    npc: 'chalk', chain: 'chalk', step: 1, type: 'ESCORT',
    title: 'RE-SURVEY BENCH SEVEN',
    brief: 'Protect CHALK while it re-surveys a bench. It will not hurry.',
    target: { kind: 'escort', id: 'chalk_survey_run', to: [20, 14] },
    reward: { module: 'assayModule' },
    tuning: { seconds: 160, escorteeTough: true },
    lines: {
      give: ["Bench seven has moved. Four centimetres, over two centuries. I need to stand in the open and confirm it, and things shoot at me when I stand in the open."],
      done: ["Four point one centimetres. FOUR POINT ONE. I said four. I was nearly right and I have never been nearly right before, only exactly right."],
    },
  },
  chalk_2: {
    npc: 'chalk', chain: 'chalk', step: 2, type: 'BREAK-IN',
    title: 'THE SHAFT HEAD',
    brief: 'The shaft head is buried. Needs DRILL RIG 3 to open the way down.',
    // KNOWN CONTRADICTION, kept out loud rather than papered over: the draft
    // both REQUIRES drill 3 and REWARDS drill 3 — a mission cannot need its
    // own payout. draft_gadgets says rank 3 is 'story, end of The Digs', so
    // one of the two grants has to give way. Block 13 owes the resolution;
    // test_contentdata asserts this exact shape so it cannot be forgotten.
    // IT REQUIRED THE RANK IT REWARDS. `gear: ['drill_3']` on a mission whose
    // reward IS drill 3 is a door whose key is inside it — carried in the
    // handover as an open question for three runs and never a real question:
    // it can only ever have been a typo for the rank below. Now it asks for
    // drill 1, which the Ironworks grants, and hands back 3.
    requires: { missions: ['chalk_1'], gear: ['drill_1'] },
    target: { kind: 'barrier', id: 'dg_shafthead' },
    reward: { gadgetRank: ['drill', 3], scrap: 600 },
    lines: {
      give: ["Everything below shaft nine is surveyed and nothing below shaft nine has been SEEN. Open it and I can finally compare."],
      done: ["Down there is exactly what I said is down there. I want that on a plaque."],
    },
  },
  chalk_3: {
    npc: 'chalk', chain: 'chalk', step: 3, type: 'RECOVERY',
    title: 'CORE SAMPLES',
    brief: 'Bring back the core samples from the deep shaft.',
    requires: { missions: ['chalk_2'] },
    target: { kind: 'find', id: 'dg_core_samples' },
    deliver: { kind: 'npc', id: 'chalk' },
    reward: { mapKnowledge: { scope: 'world', reveals: 'chassis' }, scrap: 900 },
    lines: {
      give: ["Nine samples, taken the week the shaft was sunk, never lifted. They are the oldest thing anyone has ever asked you to carry."],
      done: ["Read. All of it, read, by someone.", "Here — take the whole survey. Every derelict on the continent is on it. I was never going to use it."],
    },
  },
};

const MISSION_RULES = {
  maxActive: 3,
  journalOnPauseMenu: true,
  markerShowsDistance: true,        // in a 20-minute world, distance is information
  gearLockedText: (gear) => `SEALED — NEEDS ${gear.toUpperCase()}`,
};

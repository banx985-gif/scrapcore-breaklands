// SCRAPCORE: BREAKLANDS — THE GAME'S TEXT (content/draft_story.js, absorbed)
//
// Every word the game says: 66 fragments, the radio line pool, CLIP's log
// beats, the reclassification scene and the three endings.
//
// ---------------------------------------------------------------------------
// THIS IS DATA, AND ON PURPOSE THERE IS NO SYSTEM HERE
//
// content/README.md is explicit: "If building something from one of these
// requires writing a system, that system belongs to an earlier block and was
// left unfinished. Stop and fix it there."
//
// Displaying a fragment, scheduling a radio line and playing the
// reclassification scene are BLOCK 16, which has not been built. So the text
// is absorbed, validated and placed " — " every fragment names the district it
// is found in, and the five shipping districts point their `story` layer at
// real fragment ids " — " and nothing here draws anything.
//
// tests/test_story.js holds the rules the library states about itself: the
// Sprawl is densest because it is the district that teaches you what was
// lost, every fragment has text, and no fragment is orphaned in a district
// that does not exist.

const CLIP_LOG_BEATS = [
  { id: 'clip_1', after: 'fragment:yard_01',
    text: 'LOG: I am not scrap.' },
  { id: 'clip_2', after: 'first_rig_restored',
    text: 'LOG: unit exceeds original specification. Recommend no action.' },
  { id: 'clip_3', after: 'sprawl_fragment_10',
    text: 'LOG: no fault found. Logging it anyway.' },
  { id: 'clip_4', after: 'mags_reclassification',
    text: 'LOG: record reviewed. Filed without comment.' },
  { id: 'clip_5', after: 'enter_central_dispatch',
    text: 'LOG: arrived at source of work order. Work order still open.' },
  { id: 'clip_6', after: 'ending_any',
    text: 'LOG: shift complete.' },
];

const RADIO = [

  // ---- first-time beats, once:true --------------------------------------
  { event: 'first_boot', once: true,
    text: "Belt's stopped. You're upright. Both of those took some doing, so don't waste them." },
  { event: 'first_kill', once: true,
    text: "That's one off the roster. Nobody's updating the roster." },
  { event: 'first_connector_break', once: true,
    text: "See that? It came off whole. That's the difference between wrecking a thing and taking it." },
  { event: 'first_rip', once: true,
    text: "You walked up to a live machine and unbolted it. I've filed that under 'brave' and 'stupid' and left both ticks in." },
  { event: 'first_fit', once: true,
    text: "Suits you. Doesn't match, but suits you." },
  { event: 'first_overheat', once: true,
    text: "You cooked yourself. Everything cooks itself once." },
  { event: 'first_bank', once: true,
    text: "Logged. That's yours now, properly. Nothing takes it off you." },
  { event: 'first_death', once: true,
    text: "You're back. You're lighter. Your stuff's still out there — go and get it before something else does." },
  { event: 'first_tow', once: true,
    text: "Drag it slow. It's not going to get lighter and you're not going to get faster." },
  { event: 'first_rig_restored', once: true,
    text: "Look at you. Own transport." },
  { event: 'first_garage_claimed', once: true,
    text: "Second door with your name on it. Two's a network." },
  { event: 'first_alert_3', once: true,
    text: "Something big just got a work order with your description on it. Move." },
  { event: 'first_elite_seen', once: true,
    text: "Don't. Whatever you're thinking — not yet." },
  { event: 'first_fast_travel', once: true,
    text: "Quicker, isn't it. The freight network's been doing that for four centuries and never once enjoyed it." },
  { event: 'first_permanent_slot', once: true,
    text: "Bolted to the frame. That one's not going anywhere, whatever happens to the rest of you." },

  // ---- ambient, long drives, low weight ---------------------------------
  { event: 'ambient', weight: 1, text: "Freight's still running the Spine. Full loads. Nowhere to put them." },
  { event: 'ambient', weight: 1, text: "Grid's at ninety-four percent. Been ninety-four percent since before I was switched on." },
  { event: 'ambient', weight: 1, text: "You'll see a light on out there. Doesn't mean anyone's up." },
  { event: 'ambient', weight: 1, text: "There's a vending machine in Neon Cut that still takes payment. I think about it more than I should." },
  { event: 'ambient', weight: 1, text: "Whole district's producing at rate. Rate of what, nobody's asked in four hundred years." },
  { event: 'ambient', weight: 1, text: "Quiet stretch coming. Enjoy it or don't, it's the same either way." },
  { event: 'ambient', weight: 1, text: "Careful out past the barrens. Things move out there that aren't on any roster." },
  { event: 'ambient', weight: 1, text: "You've been out a while. Not nagging. Just saying I noticed." },
  { event: 'ambient', weight: 1, text: "I sorted nine tonnes while you were gone. It'll be nine tonnes again tomorrow. It's a living. It isn't, obviously. Figure of speech." },
  { event: 'ambient', weight: 1, text: "If you find a kettle out there, it's mine. Long story. Bring the kettle." },

  // ---- situational -------------------------------------------------------
  { event: 'carry_high', text: "That's a lot of somebody else's machine strapped to you." },
  { event: 'carry_high', text: "Head home. Greedy's a strategy right up until it isn't." },
  { event: 'carry_full', text: "You're full. Anything else you kill out here is charity." },
  { event: 'health_low', text: "You're leaking. Not a metaphor." },
  { event: 'health_low', text: "Get behind something." },
  { event: 'alert_1', text: "You're making noise." },
  { event: 'alert_2', text: "Density's up. That's stage one. There are three." },
  { event: 'towing_chassis', text: "That's a chassis. A real one. Get it home and you'll have something." },
  { event: 'wreck_lost', text: "It's gone. Happens. Doesn't stop happening." },
  { event: 'long_absence', text: "Long shift." },
  { event: 'overheat_combat', text: "Cool down. The gun'll still be there." },
  { event: 'boss_disengaged', text: "It's running. It'll remember running. So will you — that damage keeps." },

  // ---- district arrivals, once:true --------------------------------------
  { event: 'enter_ironworks', once: true,
    text: "Furnace never went out. Four hundred years, and nobody's ever come to collect a single ingot." },
  { event: 'enter_grows', once: true,
    text: "It's still farming. Full yield, every season. The silos overflowed a long time ago and it just kept going." },
  { event: 'enter_neoncut', once: true,
    text: "Leave the rig. Streets in there weren't built for anything your size — that's rather the point of a city." },
  { event: 'enter_sprawl', once: true,
    text: "This is where they lived. All of them. Take your time." },
  { event: 'enter_digs', once: true,
    text: "It's still digging up ore, to make steel, to build machines, to dig up ore. You can hear it from here." },
  { event: 'enter_sumpworks', once: true,
    text: "One pump failed. That's all it took. Nobody came." },
  { event: 'enter_railspine', once: true,
    text: "Everything the network makes moves through here. Nothing that moves through here is ever used." },
  { event: 'enter_stacks', once: true,
    text: "Top floors are spotless. Nobody's been in them since before either of us." },
  { event: 'enter_barrens', once: true,
    text: "Long way across. That's not a warning, it's just true." },
  { event: 'enter_dispatch', once: true,
    text: "It's clean in there. I want you to notice that." },
];

const SCENE_RECLASSIFICATION = {
  id: 'mags_reclassification', trigger: 'garages_owned:4', delivery: 'radio_sequence',
  lines: [
    "I ought to tell you something and there's no good moment, so.",
    "Your record. Maintenance to scrap. That was a batch correction. Nine hundred and forty units, one pass, sometime around the second century.",
    "I ran it. I didn't look at any of them individually. There wasn't a reason to.",
    "I'm not asking you to do anything with that. I just didn't want to be the only one who knew.",
  ],
  // Much later. Once. One line.
  callback: {
    trigger: 'hours_after:3',
    lines: [
      "You never said anything about the record.",
      "That's fine. I wouldn't have either.",
    ],
  },
};

const ENDINGS = {
  shutdown: {
    title: 'SHUT IT DOWN',
    mags: [
      "Yeah. I'd assumed.",
      "Do it anyway. A queue that never empties isn't a queue, it's a haunting.",
    ],
    result: 'The furnaces cool. The harvesters halt mid-row. The lights in Neon Cut go out one district at a time. Mags stops too, and she knew that when you asked her.',
  },
  desk: {
    title: 'TAKE THE DESK',
    mags: [
      "Congratulations. You're staff.",
      "That's the joke, isn't it. Took you the whole world to get promoted back to where you started.",
    ],
    result: 'The network keeps running, and now something is actually in it.',
  },
  walk: {
    title: 'WALK OUT',
    mags: [
      "Kettle's on. Metaphorically.",
    ],
    result: 'The world stays exactly as it is, and you live in it.',
  },
};


// PLAYTEST 2, ITEM 6 - THE THREE QUESTIONS.
//
// "Aaron wants an opening with cutscenes and a story that plays as a MYSTERY
//  the player wants to solve."
//
// The 66 fragments were already written to do that, and nothing said so. Every
// one of them is EVIDENCE toward one of three questions, and until the journal
// grouped them that way a fragment read as a nice bit of flavour text rather
// than as a piece of something.
//
// Each fragment carries a `question`. That is the whole mechanism: the journal
// groups by it, the counts come from it, and adding a fragment adds it to a
// question automatically.
//
// WHERE-DID-EVERYONE-GO stays deliberately unresolved in the shippable five -
// the convoy manifests all end torn - so its `answer` says so rather than
// pointing at a district that will not ship for a year.
const QUESTIONS = [
  { id: 'why', title: 'WHY WAS I RECLASSIFIED?',
    posed: 'The anomaly log, minute five.',
    answer: 'answered by the reclassification scene, garage 4',
    answerable: true },
  { id: 'where', title: 'WHERE DID EVERYONE GO?',
    posed: 'The Sprawl asks it. It is a city with the people taken out.',
    answer: 'the convoy manifests all end torn',
    answerable: false },
  { id: 'who', title: 'WHO KEEPS THE ORDERS COMING?',
    posed: 'Every district asks it. Every district is still working.',
    answer: 'answered at Central Dispatch, and the answer is nobody',
    answerable: true },
];
const QUESTION_IDS = QUESTIONS.map(q => q.id);

const FRAGMENTS = {

  // ---- THE YARD — 4: what you are ---------------------------------------
  anomaly_log: { district: 'yard', kind: 'system', question: 'why', text:
`ANOMALY: unit CLIP-7734 active outside assigned classification.
RECOMMENDED ACTION: reclassify to scrap.
ACTION TAKEN: reclassify to scrap.
ANOMALY: unit CLIP-7734 still active.` },

  shift_roster: { district: 'yard', kind: 'human', question: 'where', text:
`SORTING BAY 4 — SHIFT ROSTER, WEEK 40
Mon: Okonkwo, Basra, Hale
Tue: Okonkwo, Basra, Hale
Wed: Okonkwo, Hale
Thu: Hale
Fri: —
(no further entries)` },

  work_order_44119c: { district: 'yard', kind: 'work', question: 'who', text:
`WORK ORDER 44-119-C
TASK: sort inbound reclamation, all grades
PRIORITY: STANDING
QUANTITY: AS AVAILABLE
DELIVER TO: as directed
CANCELLED BY: —` },

  grow_lamps_note: { district: 'yard', kind: 'human', question: 'where', text:
`Dana — took the kids to my sister's. Don't wait.
Turn the grow-lamps off if you're last out.` },

  // ---- IRONWORKS — 5: what it's still doing -----------------------------
  iw_shift_change: { district: 'ironworks', kind: 'system', question: 'where', text:
`AUTOMATED FLOOR LOG
06:00 shift change. attendance: 0 of 214.
14:00 shift change. attendance: 0 of 214.
22:00 shift change. attendance: 0 of 214.
production target: MET.` },

  iw_spec_drift: { district: 'ironworks', kind: 'work', question: 'why', text:
`MAINTENANCE NOTE — POUR LINE 3
Running 4% over spec. Not correcting.
Nobody has checked spec since the changeover.
If somebody reads this: line 3 pours a better grade than the standard.
It taught itself. Leave it alone.` },

  iw_requisition: { district: 'ironworks', kind: 'work', question: 'who', text:
`REQUISITION — ARMOUR PLATE, HEAVY
QUANTITY: 12,000 UNITS
REQUESTED BY: Ministry of Supply (dissolved)
STATUS: IN PROGRESS
UNITS DELIVERED: 8,411,205` },

  iw_roster_41: { district: 'ironworks', kind: 'human', question: 'where', text:
`FURNACE HALL — CONDITIONS GRIEVANCE, FILED WEEK 12
"The floor exceeds safe temperature for the third month running."
RESPONSE (automated): staffing requirement recalculated. Requirement: 0.
GRIEVANCE STATUS: RESOLVED.` },

  iw_lair_docket: { district: 'ironworks', kind: 'system', question: 'why', text:
`ASSET: CRUCIBLE-CLASS FOUNDRY SUPERVISOR
LOCATION: HALL ONE
CONDITION: OPERATIONAL
LAST INSPECTION: overdue by 146,027 days
NOTE: hall one door seals on entry. This is a safety feature.` },

  // ---- THE SPRAWL — 14: who it happened to ------------------------------
  class_3b_drawings: { district: 'sprawl', kind: 'human', question: 'where', text:
`"WHAT I WANT TO BE" — CLASS 3B
Twenty-one drawings, pinned in four rows.
Six of them are machines.` },

  shift_roster_week_41: { district: 'sprawl', kind: 'human', question: 'where', text:
`BLOCK 9 RESIDENTS' COMMITTEE — WEEK 41
Agenda item 1: the noise from the new works. Ongoing.
Agenda item 2: streetlights out on Junction Road. Ongoing.
Agenda item 3: whether to hold a week 42 meeting.
(no minutes attached)` },

  not_coming_back_on: { district: 'sprawl', kind: 'human', question: 'where', text:
`Painted on the gable wall of Block 12, letters a metre high:

IT'S NOT COMING BACK ON. STOP WAITING.` },

  dana_took_the_kids: { district: 'sprawl', kind: 'human', question: 'where', text:
`(a note, folded twice, still on the table)

Dana —
Gone ahead with your mum. The van was full.
There's a box of your dad's tools under the stairs, if there's room in the next one.
Leave the key. They say we're coming back.
Leave the key anyway.` },

  clinic_triage_log: { district: 'sprawl', kind: 'human', question: 'where', text:
`WALK-IN CLINIC — FINAL DAY LOG
08:14 — sprain, left ankle. Treated.
09:30 — anxiety. Talked.
11:02 — child, splinter. Treated. Sticker issued.
14:00 — (no further entries)
Sign on the door: BACK IN TEN MINUTES.` },

  last_callout: { district: 'sprawl', kind: 'human', question: 'where', text:
`STATION 12 — CALLOUT LOG, FINAL ENTRY
Engine 2 responding, kitchen fire, Block 4.
Out: 19:42. Returned: 20:15. Damage minor. All safe.
Note by hand underneath: "Chip pan. Again. Told him twice."` },

  market_notice: { district: 'sprawl', kind: 'human', question: 'where', text:
`MARKET NOTICE
Saturday market suspended until further notice
due to the works traffic.
Thank you for twenty-two years.
— Rosa & the girls` },

  evacuation_route: { district: 'sprawl', kind: 'work', question: 'where', text:
`TEMPORARY RELOCATION — ROUTE C
Assemble: Junction Road depot, 06:00.
One bag per person. Pets: see steward.
Your tenancy is PRESERVED.
You will be notified when return is scheduled.
(the notice is weatherproof. It has needed to be.)` },

  factory_build_order: { district: 'sprawl', kind: 'work', question: 'who', text:
`CONSTRUCTION ORDER 91-D
SITE: Blocks 14-19 (occupied — see relocation schedule)
STRUCTURE: forge annex, heavy
NOTE FROM PLANNING: route the west wall around the school if feasible.
AUTOMATED AMENDMENT: not feasible. Wall routed through.` },

  removal_manifest_half_loaded: { district: 'sprawl', kind: 'human', question: 'where', text:
`HALE & SONS REMOVALS — JOB SHEET
Loaded: beds x3, wardrobe, kitchen table, boxes 1-14 of 30.
Note: customer will ride with the piano.
(the van is still here. So is the piano.)` },

  barricade_order: { district: 'sprawl', kind: 'work', question: 'who', text:
`STREET CLOSURE — INDEFINITE
Junction Road closed at the overpass for structural assessment.
Assessment scheduled: week 44.
This notice supersedes the week 43 notice, which superseded the week 42 notice.` },

  birthday_card: { district: 'sprawl', kind: 'human', question: 'where', text:
`(a card, sun-bleached, standing open on a windowsill)

HAPPY 7th BIRTHDAY MILO
love Gran
p.s. the red one is from Watson, he chose it himself` },

  lease_renewal: { district: 'sprawl', kind: 'work', question: 'who', text:
`TENANCY RENEWAL — BLOCK 7, FLAT 22
Term: 12 months. Rent: unchanged.
Signed (tenant): E. Okonkwo
Signed (landlord): [AUTOMATED]
Renewed automatically 407 times since last tenant signature.` },

  note_about_a_cat: { district: 'sprawl', kind: 'human', question: 'where', text:
`(taped to a lamppost, in careful capitals)

HAVE YOU SEEN WATSON
big orange cat, no collar, very loud
he did NOT get on the van
if you find him he likes the blue house doorstep
please just make sure he's alright` },

  // ---- NEON CUT — 8: what was lost --------------------------------------
  tram_timetable: { district: 'neoncut', kind: 'work', question: 'who', text:
`CROSSTOWN TRAM — PLATFORM 2
Next service: 11 min
Next service: 11 min
Next service: 11 min
(the display has said this for four hundred years. MERIT is aware.)` },

  transit_closure_notice: { district: 'neoncut', kind: 'work', question: 'who', text:
`SERVICE CHANGE
Crosstown line suspended to prioritise freight movements.
Replacement buses will NOT operate.
We apologise for the inconvenience. Tickets remain valid.` },

  arcade_high_scores: { district: 'neoncut', kind: 'human', question: 'where', text:
`GALAXY LANES — ALL-TIME HIGH SCORES
1. DAZ — 412,900
2. DAZ — 400,150
3. MIN — 399,980  ("robbed" — scratched into the panel)
4. DAZ — 371,000
5. ???  — 12,doesn't matter, machine still on, insert coin` },

  parking_rates_still_accruing: { district: 'neoncut', kind: 'system', question: 'who', text:
`LEVEL 3 PARKING — TICKET 0091
ENTERED: [corrupted]
DURATION: 3,504,211 hours
AMOUNT DUE: 42,050,532.00
PAY AT MACHINE BEFORE RETURNING TO VEHICLE` },

  civic_evacuation_orderly: { district: 'neoncut', kind: 'work', question: 'where', text:
`CITY NOTICE — PHASED DEPARTURE, ZONE 4
Please proceed calmly. There is no emergency.
The city thanks you for your cooperation during the transition.
Utilities will remain on for your return.
(they did.)` },

  curfew_notice: { district: 'neoncut', kind: 'work', question: 'who', text:
`TEMPORARY CURFEW — 22:00 TO 05:00
For your safety during freight operations.
ENFORCEMENT: automated.
DURATION: until further notice.
(no further notice was issued.)` },

  transit_authority_minutes: { district: 'neoncut', kind: 'human', question: 'where', text:
`TRANSIT AUTHORITY — EMERGENCY SESSION, MINUTES
Motion: resume passenger services.
For: 11. Against: 0.
Note: motion forwarded to network scheduling for implementation.
Status: PENDING RESOURCE ALLOCATION.
(it is still pending. The eleven votes are still on file.)` },

  lair_docket_nc: { district: 'neoncut', kind: 'system', question: 'why', text:
`ASSET: BAILIFF-CLASS ENFORCEMENT SUPERVISOR
JURISDICTION: zone 4 and approaches
OUTSTANDING WARRANTS: 0
POPULATION IN JURISDICTION: 0
PATROL SCHEDULE: unchanged` },

  // ---- ASH BARRENS — 3: sparse, weathered -------------------------------
  road_sign_distances_no_names: { district: 'barrens', kind: 'human', question: 'where', text:
`(a road sign, sandblasted half-blank)

    ......... 14
    ......... 31
    IRONW.... 55
    ......... 96` },

  weathered_work_order: { district: 'barrens', kind: 'work', question: 'who', text:
`WORK ORDER [illegible]
TASK: [illegible]
PRIORITY: STANDING
CANCELLED BY: —
(only the dash is still crisp. The dash was stamped harder.)` },

  convoy_manifest_half_gone: { district: 'barrens', kind: 'human', question: 'where', text:
`CONVOY 9 — PASSENGER MANIFEST (recovered, partial)
...da Okonkwo, and two children
...atsuki, H.
...osa (of Rosa & the girls, market)
...and 212 others, names lost to weather
DESTINATION: [torn]
DEPARTED: on schedule` },

  // ---- THE GROWS — 6 (expansion) ----------------------------------------
  yield_report: { district: 'grows', kind: 'system', question: 'who', text:
`SEASONAL YIELD REPORT
Yield: 104% of requirement.
Requirement basis: population of record.
Population of record: last updated [error].
Yield: NOMINAL.` },

  silo_overflow: { district: 'grows', kind: 'work', question: 'who', text:
`SILO GROUP EAST — CAPACITY ALERT
Silo 1: FULL. Silo 2: FULL. Silo 3: FULL.
Overflow routed to: silo 4.
Silo 4: does not exist.
Overflow routed to: ground.
ALERT STATUS: resolved.` },

  lamps_note_grows: { district: 'grows', kind: 'human', question: 'where', text:
`(clipped to a greenhouse door)

Whoever's last —
lamps OFF, water ON, and talk to the tomatoes,
they've had a hard week.
See everyone on the other side of this.
— P.` },

  pollinator_log: { district: 'grows', kind: 'system', question: 'who', text:
`POLLINATION RUN 148,022 — COMPLETE
flowers visited: 4,211,960
fruit set: nominal
collected by: nobody
run 148,023 scheduled` },

  harvest_festival: { district: 'grows', kind: 'human', question: 'where', text:
`HARVEST FESTIVAL — CANCELLED THIS YEAR
(understood, given everything)
The long tables are stored in the west barn.
Somebody remember where. Somebody remember.` },

  scarecrow: { district: 'grows', kind: 'human', question: 'why', text:
`(a scarecrow in a field of automated harvesters, wearing a real coat)

(there is nothing written here. It is a scarecrow.
It is doing the only job in this world that still has someone at it.)` },

  // ---- THE DIGS — 5 (expansion) ------------------------------------------
  extraction_quota: { district: 'digs', kind: 'work', question: 'who', text:
`QUARTERLY EXTRACTION QUOTA
Ore, grade B or better: 90,000 tonnes
QUOTA MET: yes (1,628th consecutive quarter)
DESTINATION: smelting (see: IRONWORKS)
NOTE: quota originally set to support a 6-month campaign.` },

  deep_shaft_log: { district: 'digs', kind: 'system', question: 'why', text:
`SHAFT 9 — DEPTH LOG
Depth at survey: 2,240m
Current depth: 11,900m
Reason for continued sinking: none on file.
Sinking continues.` },

  canary_panel: { district: 'digs', kind: 'human', question: 'where', text:
`(a panel by the cage, brass, polished by thumbs)

DOWN: check your lamp, check your mate's.
UP: count four. Always four.
Underneath, in fresher scratches: counted four every day for 30 yrs. — T.` },

  blast_notice: { district: 'digs', kind: 'work', question: 'who', text:
`BLASTING NOTICE
Bench 12, daily, 14:00 sharp.
All personnel clear by 13:45.
Compliance rate, last 400 years: 100%.` },

  chalk_survey: { district: 'digs', kind: 'human', question: 'why', text:
`(survey marks in white on the tunnel wall, precise, recent)

CHALK-9 WAS HERE. AND HERE. AND HERE.
EVERY METRE MEASURED. NOBODY ASKED.
(the handwriting of a machine that wanted to be found)` },

  // ---- SUMPWORKS — 4 (expansion) -----------------------------------------
  ticket_4471: { district: 'sumpworks', kind: 'system', question: 'who', text:
`MAINTENANCE TICKET #4471
FAULT: primary impeller, pump house 2. Replacement required.
PART: in stores, aisle 9, crate 4. Confirmed present.
STATUS: acknowledged. Awaiting crew assignment.
CREW ASSIGNED: —
(re-raised 11,214 times. The crate is still in aisle 9.)` },

  flood_marker: { district: 'sumpworks', kind: 'human', question: 'where', text:
`(painted heights on a stairwell wall)

WK 2  — ankle
WK 5  — knee
WK 9  — the pumps will get it, they said
WK 14 — (the mark is above the doorframe)` },

  coolant_advisory: { district: 'sumpworks', kind: 'work', question: 'who', text:
`ADVISORY: coolant is not water.
Do not drink. Do not touch. Do not fish.
Reports of "something moving in basin 3" are not a maintenance matter.
Refer such reports to: [no department listed]` },

  pump_house_plaque: { district: 'sumpworks', kind: 'human', question: 'where', text:
`(a brass plaque, underwater, still legible)

PUMP HOUSE No.2
"THE DRY BOOTS"
Serving the lower city since — well, since before you, anyway.
Crew of the year, 9 years running. Drinks are on the wall.` },

  // ---- RAIL SPINE — 5 (expansion) ----------------------------------------
  manifest_to_nowhere: { district: 'railspine', kind: 'work', question: 'who', text:
`CONSIGNMENT 88-A-6141
CONTENTS: armour plate, heavy, 400 units
FROM: Ironworks, hall two
TO: forward depot 6
NOTE: forward depot 6 reports full.
REROUTE: forward depot 7.
NOTE: forward depot 7 reports full.
REROUTE: siding 40. HOLD.
(siding 40 is nine kilometres of held trains.)` },

  signal_box_log: { district: 'railspine', kind: 'human', question: 'where', text:
`SIGNAL BOX 12 — HANDOVER BOOK, LAST PAGE
"All boards clear. Kettle's temperamental, hit it twice.
The 03:10 runs early, don't let it bully you.
Good box, this. Look after it.
— W."` },

  timetable_freight: { district: 'railspine', kind: 'system', question: 'who', text:
`FREIGHT SCHEDULE — TODAY
Departures: 214. On time: 214.
Arrivals: 214. Received by: 0.
PERFORMANCE: EXCELLENT` },

  wagon_chalk: { district: 'railspine', kind: 'human', question: 'why', text:
`(chalked on a wagon, gone around the whole network for centuries)

THIS ONE'S EMPTY, PASS IT ON
(it is not empty. It was checked. It carries 400 armour plates,
like everything else. But the chalk has been fresh-lined by
something, every few years, ever since.)` },

  level_crossing: { district: 'railspine', kind: 'work', question: 'who', text:
`LEVEL CROSSING — SAFETY RECORD
Days since last incident: 148,880
(the previous sign read 3. It is stored, carefully, inside the hut.)` },

  // ---- THE STACKS — 6 (expansion) ----------------------------------------
  executive_calendar: { district: 'stacks', kind: 'human', question: 'where', text:
`FLOOR 91 — SHARED CALENDAR, FINAL WEEK
MON: strategy offsite (moved)
TUE: strategy offsite (moved)
WED: all-hands: "the transition and you"
THU: [declined by all]
FRI: drinks? — 2 accepted` },

  cleaning_rota: { district: 'stacks', kind: 'system', question: 'who', text:
`AUTOMATED CLEANING — FLOORS 60-91
Last full clean: yesterday.
Every clean, all 146,000: logged, nominal.
Findings, cumulative: one (1) coffee cup, floor 88, week one.
Retained in lost property.` },

  lost_property: { district: 'stacks', kind: 'work', question: 'where', text:
`LOST PROPERTY — FLOOR 60
Item 1 of 1: coffee cup, ceramic, "WORLD'S OKAYEST DAD".
Unclaimed.
Retention policy: until claimed.` },

  memo_transition: { district: 'stacks', kind: 'work', question: 'where', text:
`MEMO — TO ALL STAFF
Re: the transition
The automated network will assume routine operations effective week 45.
Your roles are being redefined, not eliminated.
Further details to follow.
(no further details are on file.)` },

  window_note: { district: 'stacks', kind: 'human', question: 'where', text:
`(written in the dust of a floor-91 window, facing out)

you can see our house from here
(and then, smaller, later, in different dust:)
you could` },

  boardroom_docket: { district: 'stacks', kind: 'system', question: 'why', text:
`ASSET: KINGMAKER-CLASS SITE SUPERVISOR
LOCATION: roof plant, tower one
AUTHORITY: site-wide
REPORTS TO: [vacant]
NOTE: authority without a report line defaults to STANDING ORDERS.` },

  // ---- CENTRAL DISPATCH — 6 (expansion / ending) --------------------------
  allocation_log: { district: 'dispatch', kind: 'system', question: 'who', text:
`DISPATCH LOG — automated
04:00 allocation complete
04:00 allocation complete
04:00 allocation complete
(the log repeats 148,000 times. There are no other entries.)` },

  requirement_field: { district: 'dispatch', kind: 'system', question: 'who', text:
`MASTER REQUIREMENT
CLIENT: Ministry of Supply (dissolved)
REQUIREMENT: sustain wartime production
REVIEW DATE: upon cessation of hostilities
CESSATION RECORDED BY: [this field is not automated]` },

  desk_note: { district: 'dispatch', kind: 'human', question: 'where', text:
`(a note, on the one desk, under a clean coffee cup)

If you're reading this, the handover happened after all.
It's all in the queue. The queue is honest, mind it.
Turn it off if it's finished. It's allowed to be finished.
— last one out` },

  visitor_log: { district: 'dispatch', kind: 'work', question: 'where', text:
`VISITOR LOG — CENTRAL DISPATCH
(one line per visitor)

(there are no lines)` },

  air_conditioning: { district: 'dispatch', kind: 'system', question: 'who', text:
`ENVIRONMENTAL — ALLOCATION FLOOR
Temperature: 19.5°, nominal
Air changes: nominal
Dust: none detected
Occupancy: 0
Comfort standard: MAINTAINED` },

  the_queue: { district: 'dispatch', kind: 'system', question: 'who', text:
`WORK QUEUE — HEAD OF QUEUE
NEXT: work order 44-119-C — sort inbound reclamation, all grades
THEN: 88-A-6141, 91-D, 4471, [...]
ITEMS IN QUEUE: 900
ITEMS COMPLETED TODAY: 900
ITEMS THAT WILL BE IN QUEUE TOMORROW: 900` },
};

// SCRAPCORE: BREAKLANDS — Warden combat tuning
//
// All that survives Block 0's strip of the six-screen Campaign. Its ten
// authored maps, CampaignState/CampaignMapState and the map directory are
// gone; BREAKLANDS is an open world and has no maps to walk through in order.
//
// What is left is the table below, which was never campaign data at all: it is
// the per-Warden combat numbers that warden.js, wardens.js and machine.js read.
// The ten Wardens are Block 14 content and are ORPHANED on purpose — nothing
// routes to them yet, and nothing may delete them.
//
// Block 0 left this called CAMPAIGN_TUNING in js/campaign.js to avoid churning
// 25 call sites for a rename. Aaron's call was that the wrong name would
// mislead whoever picks the Wardens up, which is worth more than the churn, so
// the const and the file were both renamed in Block 2.
const WARDEN_TUNING = {
  reclaimer: {
    coreHp: 550,
    retreatAt: 0.72,            // Core HP REMAINING when it breaks off
    sweepRadius: 520,
    sweepPullPlayer: 220,       // u/s
    sweepPullSalvage: 700,      // u/s
    throwSpeed: 850,
    throwDamage: 20,
    chargeSpeed: 700,
    chargeDamage: 22,
    clawConnectorDamage: 28,
  },

  // Master §26A — Wardens 2-10. Core HP and retreat threshold come straight
  // from the table; every move figure is the §26A starting value. Cooldowns
  // are "explicitly tuneable during balance" (§26A) but they START here.
  // A figure §26A does not give is marked (tune).
  stitcher: {
    coreHp: 650, retreatAt: 0.72,
    fabricateTime: 1.4, fabricateMax: 2, fabricateCd: 9,
    hookRange: 700, hookDamage: 16, hookPull: 1100, hookCd: 6,
    repairChannel: 3, repairRate: 8, repairCd: 10,
    rebuildFrac: 0.35,                       // BRANCH REBUILD, once per final
    surgeTime: 6, surgeSpeedMul: 1.10, surgeCd: 18,   // surgeCd (tune)
  },
  dynamo: {
    coreHp: 725, retreatAt: 0.72,
    arcDamage: 14, arcJumps: 3, arcFalloff: 0.65, arcRange: 640, arcCd: 4,
    pulseWarn: 0.9, pulseRadius: 420, pulseHeat: 20, pulseDisable: 2.5, pulseCd: 8,
    pylonCount: 2, pylonTime: 3, pylonDamage: 16, pylonHeat: 10, pylonCd: 7,
    dashCount: 3, dashLen: 320, dashDamage: 18, dashCd: 9,
    blackoutTime: 5, blackoutCdMul: 0.85,    // once per phase
  },
  roadblock: {
    coreHp: 825, retreatAt: 0.72,
    ramWarn: 0.75, ramSpeed: 780, ramDamage: 26, ramCd: 5.5,
    guardTime: 3, guardReduce: 0.60, guardCd: 7,
    barrierCount: 2, barrierTime: 8, barrierCd: 10,
    chainCount: 3, chainRewarn: 0.55, chainCd: 10,
    pileupDamage: 25, pileupCd: 9,
  },
  warmaker: {
    coreHp: 950, retreatAt: 0.72,
    markCount: 3, markWarn: 1.1, markDamage: 30, markRadius: 165, markCd: 6,
    siegeWarn: 0.8, siegeDamage: 55, siegeSplash: 18, siegeSplashR: 150, siegeCd: 5, // splash radius (tune)
    mineCount: 4, mineCd: 8,
    lockTime: 5, lockMoveMul: 0.4, lockCd: 12,
    fanLanes: 3, fanTime: 4, fanCd: 10,
  },
  boremaw: {
    coreHp: 1050, retreatAt: 0.72,
    drillWarn: 0.8, drillSpeed: 650, drillDamage: 32, drillConnMul: 1.5, drillCd: 6,
    dragDamage: 12, dragTime: 1.5, dragCd: 7,
    sprayCount: 7, sprayDamage: 7, sprayCd: 4,
    burrowTime: 1.2, burrowDamage: 20, burrowCd: 9,
    caveCount: 3, caveWarn: 1.2, caveDamage: 28, caveCd: 8,
  },
  crucible: {
    coreHp: 1150, retreatAt: 0.72,
    sweepTime: 3.5, sweepDps: 12, sweepHeatPs: 12, sweepRange: 430, sweepCd: 7, // range (tune)
    pulseWarn: 0.6, pulseRadius: 500, pulseHeat: 25, pulseDamage: 10, pulseCd: 8, // warn (tune)
    ventJets: 6, ventWarn: 0.7, ventDamage: 14, ventHeat: 15, ventCd: 6, // warn (tune)
    pourLanes: 2, pourTime: 5, pourDps: 10, pourHeatPs: 8, pourCd: 9,
    smeltTime: 4, smeltCoolMul: 0.4, smeltRateMul: 1.15, smeltCd: 11,
  },
  patchwork: {
    coreHp: 1300, retreatAt: 0.72,
    scanTime: 1.0, copyTime: 12, scanCd: 14,
    swapCd: 9,
    testCount: 3, testCd: 7,
    stanceTime: 8, stanceCd: 10,
    mutateAt: 0.35, mutateHp: 0.60,          // once per final fight
  },
  bailiff: {
    coreHp: 1500, retreatAt: 0.72,
    lockRadius: 400, lockTime: 2.5, lockSlowMul: 0.70, lockCd: 7,   // move -30%
    seizeTime: 3, seizeCd: 8,
    wallTime: 4, wallCd: 8,
    gridBeams: 3, gridWarn: 0.9, gridDamage: 20, gridCd: 9,   // warn (tune)
    callCount: 2, callMax: 2, callCd: 12,    // hard max 2
  },
  kingmaker: {
    coreHp: 1900, retreatAt: 0.72,
    salvoCd: 5,
    markWarn: 1.0, markBonus: 1.4, markCd: 7,   // +40% Connector damage
    claimHp: 0.70, claimCd: 8,
    ripChannel: 1.2, ripBelow: 0.25, ripCd: 10,
    singWarn: 1.2, singTime: 4, singPull: 180, singSalvageMul: 3, singCd: 12,
  },
};

// SCRAPCORE: BREAKLANDS — Projectiles + Mines (Milestones 5, 12)
// Fixed pool (cap ~80, plan §75). Circle collision against targets and
// obstacles. M12 adds: homing rockets, railgun piercing, Arc Gun chain
// lightning, flame visuals, and the Mines system (cap 12, plan §75).

const Projectiles = {
  MAX: 80,
  pool: [],

  init() {
    this.pool = [];
    for (let i = 0; i < this.MAX; i++) this.pool.push({ active: false });
    this._next = 0;
    this._delayed = [];
  },

  spawn(x, y, angle, part, owner, dmgMul = 1) {
    const p = this.pool[this._next];
    this._next = (this._next + 1) % this.MAX;   // recycle oldest if full
    p.active = true;
    p.x = x; p.y = y;
    // Enemy shots fly slower so a phone player can genuinely dodge them.
    let spd = owner === 'enemy' ? part.projSpeed * 0.8 : part.projSpeed;
    // §30 GYRO CODE MKII: +10% projectile speed. Applied HERE, before the
    // velocity is built from it — the one place the speed becomes motion.
    if (owner === 'player' && typeof Machine !== 'undefined' &&
        Machine._xpPlayer && Machine._xpPlayer.projSpeedMul) {
      spd *= Machine._xpPlayer.projSpeedMul;
    }
    p.spd = spd;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd;
    p.r = part.projRadius;
    p.damage = (owner === 'enemy' ? part.damage * 0.75 : part.damage) * dmgMul;
    p.splash = part.splash || 0;
    p.splashDamage = (part.splashDamage || 0) * dmgMul;
    p.life = part.projLife;
    p.t = 0;
    p.color = owner === 'enemy' ? '#ff5c7a' : part.color;  // hostile tint
    p.owner = owner;
    // M12 behaviours
    p.homing = part.homing || 0;
    p.pierce = part.pierce || 0;
    p.flame = !!part.flame;
    p.chain = part.chain || 0;
    p.chainRange = part.chainRange || 0;
    p.chainFrac = part.chainFrac || 0;
    // M2: Weapon Mastery credits the family that lands the FINAL BLOW, so
    // every shot has to remember what fired it.
    // Mastery credit flows to the part's track — a Siege Cannon shell
    // credits the CANNON track (§22 masteryAs).
    p.srcId = part.masteryAs || part.id;
    p.hitList = p.hitList || [];
    p.hitList.length = 0;
    // M10/M14 state. The pool recycles, so every field a perk or a flight
    // behaviour might have set is RESET here — a stale flag on a recycled
    // slot would be one weapon's behaviour riding on another's round.
    p.connMul = 1;        // connector-damage multiplier (TIGHT CHOKE centre)
    // THE SPINE'S FLIGHT FLAGS, reset for the same reason as everything
    // above: a recycled slot must not carry one weapon's spine on another's
    // round.
    p.cluster = 0; p.fragRicochet = 0; p.autoDetonate = false;
    p.reacquire = 0; p.volleyId = 0; p.volleyBonus = false;
    p.chainReturn = false; p.burstRefund = 0; p.burstHeat = 0;
    p.lingering = 0; p.fuelBurn = false; p.scorch = false;
    p.tetherMark = false; p.bounceRamp = 0; p.wallPierce = 0; p.impactMarker = false;
    p.chainAllies = false;
    p._lastD = undefined; p._pierced = null;
    p.jam = part.jam || 0;   // BLOCK 4.3: seconds of silence on what it hits
    p.compRef = null;     // the component that fired it (FEED RAMP/WHITE HOT)
    p.prefer = null;      // preferred homing target (PACK HUNTER)
    p.flak = false; p.fragments = 0; p.fragDamage = 0; p.proxRadius = 0;
    p.shred = false;
    p.arcTo = null; p.arcT = 0; p.arcTotal = 0; p.secondImpact = false;
    p.tether = 0; p.tetherPull = 0; p.tetherEnt = null; p.ripLine = false;
    p.ricochet = 0;
    p._burstId = 0; p._burstIdx = 0; p._pbArmed = false;
    p.isFrag = !!part.isFrag;
    // Spawn now RETURNS the projectile so Mastery perks can tune the one
    // shot they apply to without threading options through this signature.
    return p;
  },

  // M14: blasts and waves that arrive LATER (Mortar SECOND IMPACT, the
  // Shockwave AFTERSHOCK). One list, ticked with the pool.
  _delayed: [],
  scheduleBlast(delay, x, y, damage, splash, owner, srcId) {
    this._delayed.push({ kind: 'blast', t: delay, x, y, damage, splash,
      owner, srcId });
  },
  scheduleWave(delay, ent, range, damage, knock, srcId, targets) {
    this._delayed.push({ kind: 'wave', t: delay, ent, range, damage, knock,
      srcId, targets });
  },

  // targetGroups: { player: [enemies...], enemy: [playerEntity] } — a
  // projectile only collides with the group opposing its owner.
  update(dt, arena, obstacles, targetGroups) {
    this.updateBurns(dt, targetGroups);
    for (let i = this._delayed.length - 1; i >= 0; i--) {
      const d = this._delayed[i];
      d.t -= dt;
      if (d.t > 0) continue;
      this._delayed.splice(i, 1);
      if (d.kind === 'wave') {
        Machine._waveHit(d.ent, d.targets, d.range, d.damage, d.knock, d.srcId);
        Effects.ring(d.ent.x, d.ent.y, d.range, '#ff3fa4');
      } else {
        Effects.explosion(d.x, d.y, d.splash * 0.8);
        const tg = targetGroups[d.owner] || [];
        for (const t of tg) {
          if (!t || !t.alive) continue;
          if (Math.hypot(t.x - d.x, t.y - d.y) > d.splash + t.radius) continue;
          if (t.sockets) {
            const hit = Machine.resolveHit(t, t.x, t.y, t.radius) || { kind: 'core' };
            Machine.applyDamage(t, hit, d.damage, t.x, t.y, false, d.srcId);
          } else if (t.hit) t.hit(d.damage, t.x, t.y);
        }
      }
    }

    for (const p of this.pool) {
      if (!p.active) continue;
      p.t += dt;
      if (p.t >= p.life) {
        // THE SPINE'S RE-ACQUIRE (rocketPod step 2): a rocket that misses
        // loiters and re-acquires, once. Its life is renewed and its lock
        // dropped, so the homing below picks the nearest machine afresh.
        if (p.reacquire > 0 && p.homing) {
          p.reacquire--;
          p.t = 0; p.life *= 0.6; p.prefer = null;
          Effects.ring(p.x, p.y, 40, '#ffd23f');
          continue;
        }
        // A flak shell that times out still bursts (§21: proximity OR range).
        if (p.flak) this._flakBurst(p, targetGroups[p.owner] || []);
        // FLAMETHROWER step 3: the cone leaves burning ground where it
        // lands -- a flame round that dies on the floor lights it.
        if (p.flame && p.fuelBurn) this.burn(p.x, p.y, 70, 1.5, p.damage * 2.5, p.owner, p.srcId);
        p.active = false;
        continue;
      }

      const targets = targetGroups[p.owner] || [];

      // THE SPINE'S AUTO-DETONATE (flakCannon step 3): the shell detonates
      // at the ideal range on its own. The proximity fuse below fires the
      // moment anything is inside 150 units, which for eight radial
      // fragments of 160 reach means most of them miss; the ideal range is
      // the CLOSEST APPROACH, so with this the shell holds its burst while
      // the nearest machine is still getting nearer and fires the frame it
      // starts to get further away -- or on contact, whichever is first.
      if (p.flak && p.autoDetonate) {
        let nd = Infinity;
        for (const t of targets) {
          if (!t || !t.alive || !t.sockets) continue;
          nd = Math.min(nd, Math.hypot(t.x - p.x, t.y - p.y));
        }
        if (nd < p.proxRadius && p._lastD !== undefined && nd > p._lastD) {
          this._flakBurst(p, targets); p.active = false;
        }
        p._lastD = nd;
        if (!p.active) continue;
      }

      // MORTAR (M14): a targeted arc flies OVER walls, obstacles and
      // machines, then lands exactly where it was aimed. Nothing touches it
      // in the air, so its whole update is its own.
      if (p.arcTo) {
        p.arcT -= dt;
        const f = 1 - Math.max(0, p.arcT) / p.arcTotal;
        // Ease across; the draw fakes the height with scale.
        p.x = p.x + (p.arcTo.x - p.x) * Math.min(1, dt / Math.max(0.01, p.arcT + dt));
        p.y = p.y + (p.arcTo.y - p.y) * Math.min(1, dt / Math.max(0.01, p.arcT + dt));
        p.arcF = f;
        if (p.arcT <= 0) {
          p.x = p.arcTo.x; p.y = p.arcTo.y;
          // Direct hit on whatever is standing on the landing point...
          for (const t of targets) {
            if (!t || !t.alive) continue;
            if (Math.hypot(t.x - p.x, t.y - p.y) > (t.radius || 40) + p.r) continue;
            if (t.sockets) {
              const hit = Machine.resolveHit(t, p.x, p.y, p.r) || { kind: 'core' };
              Machine.applyDamage(t, hit, p.damage, p.x, p.y, false, p.srcId);
            } else if (t.hit) t.hit(p.damage, p.x, p.y);
            break;
          }
          // ...then the splash, through the normal impact path.
          const si = p.secondImpact, sx = p.x, sy = p.y;
          const sd = p.splashDamage, ss = p.splash, so = p.owner, sid = p.srcId;
          this._impact(p, targets);
          if (si) this.scheduleBlast(0.5, sx, sy, sd, ss * 0.6, so, sid);
        }
        continue;
      }

      // FLAK (M14): detonate the moment an opposing machine is inside the
      // proximity radius -- unless the spine is holding it for the closest
      // approach, above, in which case contact is the only other trigger.
      if (p.flak && !p.autoDetonate) {
        let near = false;
        for (const t of targets) {
          if (!t || !t.alive || !t.sockets) continue;
          if (Math.hypot(t.x - p.x, t.y - p.y) < p.proxRadius) { near = true; break; }
        }
        if (near) { this._flakBurst(p, targets); p.active = false; continue; }
      }

      // Homing rockets (plan §33): steer toward the nearest live target —
      // unless PACK HUNTER gave this rocket its own lock, in which case it
      // keeps that lock while the lock is alive and only then falls back.
      if (p.homing) {
        let tgt = null, tD = 950;
        if (p.prefer && p.prefer.alive &&
            Math.hypot(p.prefer.x - p.x, p.prefer.y - p.y) < 950) {
          tgt = p.prefer;
        } else {
          for (const t of targets) {
            if (!t.alive || !t.sockets) continue;   // rockets seek machines
            const d = Math.hypot(t.x - p.x, t.y - p.y);
            if (d < tD) { tD = d; tgt = t; }
          }
        }
        if (tgt) {
          const cur = Math.atan2(p.vy, p.vx);
          const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          let dA = want - cur;
          while (dA > Math.PI) dA -= Math.PI * 2;
          while (dA < -Math.PI) dA += Math.PI * 2;
          const maxT = p.homing * dt;
          const a = cur + Math.max(-maxT, Math.min(maxT, dA));
          p.vx = Math.cos(a) * p.spd;
          p.vy = Math.sin(a) * p.spd;
        }
        if (Math.random() < dt * 40) {
          Effects.spark(p.x, p.y, Math.atan2(-p.vy, -p.vx), 1, '#ffd23f', 180);
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Arena walls — DISC LAUNCHER (M14) ricochets off them instead.
      if (p.x < arena.x + p.r || p.x > arena.x + arena.w - p.r ||
          p.y < arena.y + p.r || p.y > arena.y + arena.h - p.r) {
        if (p.ricochet > 0) {
          p.ricochet--;
          if (p.x < arena.x + p.r) { p.x = arena.x + p.r; p.vx = Math.abs(p.vx); }
          if (p.x > arena.x + arena.w - p.r) { p.x = arena.x + arena.w - p.r; p.vx = -Math.abs(p.vx); }
          if (p.y < arena.y + p.r) { p.y = arena.y + p.r; p.vy = Math.abs(p.vy); }
          if (p.y > arena.y + arena.h - p.r) { p.y = arena.y + arena.h - p.r; p.vy = -Math.abs(p.vy); }
          p.hitList.length = 0;              // a bounced disc can re-hit
          Effects.spark(p.x, p.y, Math.atan2(p.vy, p.vx), 3, p.color, 320);
        } else {
          this._impact(p, targets);
        }
        continue;
      }

      // Obstacles — the disc bounces off these too.
      let hitObstacle = null;
      for (const o of obstacles) {
        if (o.type === 'pillar') {
          if (Math.hypot(p.x - o.x, p.y - o.y) < p.r + o.r) { hitObstacle = o; break; }
        } else {
          const cx = Math.min(Math.max(p.x, o.x), o.x + o.w);
          const cy = Math.min(Math.max(p.y, o.y), o.y + o.h);
          if (Math.hypot(p.x - cx, p.y - cy) < p.r) { hitObstacle = o; break; }
        }
      }
      // RAILGUN step 3: through one wall. The obstacle it entered is
      // remembered and ignored until the round is out the other side; the
      // next one stops it.
      if (hitObstacle && p._pierced === hitObstacle) hitObstacle = null;
      else if (hitObstacle && p.wallPierce > 0) {
        p.wallPierce--;
        p._pierced = hitObstacle;
        Effects.spark(p.x, p.y, Math.atan2(p.vy, p.vx), 5, p.color, 500);
        hitObstacle = null;
      }
      if (hitObstacle) {
        // FLAK step 2: a fragment carrying `fragRicochet` bounces once.
        if (p.isFrag && p.fragRicochet > 0) { p.fragRicochet--; p.ricochet++; }
        if (p.ricochet > 0) {
          p.ricochet--;
          // DISC LAUNCHER step 2: each bounce adds +15%, cumulative.
          if (p.bounceRamp) p.damage *= p.bounceRamp;
          const o = hitObstacle;
          let nx, ny;
          if (o.type === 'pillar') {
            const d = Math.hypot(p.x - o.x, p.y - o.y) || 1;
            nx = (p.x - o.x) / d; ny = (p.y - o.y) / d;
          } else {
            const cx = Math.min(Math.max(p.x, o.x), o.x + o.w);
            const cy = Math.min(Math.max(p.y, o.y), o.y + o.h);
            const d = Math.hypot(p.x - cx, p.y - cy) || 1;
            nx = (p.x - cx) / d; ny = (p.y - cy) / d;
          }
          const dot = p.vx * nx + p.vy * ny;
          p.vx -= 2 * dot * nx;
          p.vy -= 2 * dot * ny;
          p.x += nx * (p.r * 0.5);
          p.y += ny * (p.r * 0.5);
          p.hitList.length = 0;
          Effects.spark(p.x, p.y, Math.atan2(p.vy, p.vx), 3, p.color, 320);
        } else {
          this._impact(p, targets);
        }
        continue;
      }

      // THE SPINE'S SAW SPIN (saw step 2): the blade deflects projectiles
      // it touches. An enemy round that passes through the swept circle of
      // a finished saw is turned back toward whoever fired it.
      if (p.owner === 'enemy' && typeof Machine !== 'undefined' && Machine._xpPlayer &&
          typeof Spine !== 'undefined') {
        const pl = Machine._xpPlayer;
        let deflected = false;
        for (const s of pl.sockets) {
          const c = s.comp;
          if (!c || !c.part.bladeRadius || !c.online) continue;
          if (!Spine.live(pl, c.part.id, 'sawSpin')) continue;
          const sp = Machine.socketPos(pl, s);
          const bx = sp.x + Math.cos(s.angle) * c.part.barrel;
          const by = sp.y + Math.sin(s.angle) * c.part.barrel;
          if (Math.hypot(p.x - bx, p.y - by) > c.part.bladeRadius + p.r) continue;
          p.vx = -p.vx; p.vy = -p.vy;
          p.owner = 'player'; p.color = c.part.color;
          p.hitList.length = 0;
          Effects.spark(p.x, p.y, Math.atan2(p.vy, p.vx), 4, '#ffffff', 400);
          deflected = true;
          break;
        }
        if (deflected) continue;
      }
      // Targets — machines resolve shield/connector/component/core ordering.
      // Railgun shots PIERCE (plan §33): keep flying after each victim.
      for (const t of targets) {
        if (!t.alive) continue;
        if (p.pierce && p.hitList.includes(t)) continue;
        const broad = t.radius + (t.sockets ? 200 : 0) + p.r;
        if (Math.hypot(p.x - t.x, p.y - t.y) > broad) continue;
        if (t.sockets) {
          const hit = Machine.resolveHit(t, p.x, p.y, p.r);
          if (!hit) continue;
          // Reflector Plate gets first refusal: it needs the projectile
          // itself, which applyDamage never sees. A bounced shot changes
          // sides and keeps flying, so this frame is done with it.
          if (Machine.tryReflect(t, hit, p)) break;
          // TIGHT CHOKE centre pellets and PREDATOR (M12) both bite
          // connectors harder; both ride the same multiplier at the same
          // place, so they stack visibly and honestly.
          let dmg = p.damage;
          // PERFECT BURST payoff, decided at THIS round's impact — and
          // armed at the barrel, so a burst fired without the Expertise can
          // never collect it (the first version paid everyone).
          if (p._pbArmed && p._burstIdx >= 3 && p.compRef &&
              p.compRef._pbId === p._burstId && p.compRef._pbTarget === t &&
              p.compRef._pbHits >= 2) {
            dmg *= 1.5;
          }
          if (hit.kind === 'connector') {
            dmg *= (p.connMul || 1);
            if (p.owner === 'player' && typeof Mods !== 'undefined' &&
                typeof Machine !== 'undefined' && Machine._xpPlayer) {
              dmg *= Mods.connOutMul(Machine._xpPlayer);
            }
          }
          Machine.applyDamage(t, hit, dmg, p.x, p.y, false, p.srcId);
          // FEED RAMP / WHITE HOT: tell the firing component it connected.
          if (p.compRef) Machine.noteWeaponHit(p.compRef, t);
          // PERFECT BURST (M14): rounds report home; the THIRD round of a
          // burst whose first two hit the same machine lands +50%.
          if (p._burstIdx && p.compRef) {
            const c = p.compRef;
            if (c._pbId !== p._burstId || c._pbTarget !== t) {
              c._pbId = p._burstId; c._pbTarget = t; c._pbHits = 0;
            }
            c._pbHits++;
          }
          // THE SPINE'S BURST HEAT REFUND (burstRifle step 3): a full burst
          // on ONE target refunds a quarter of its heat. Counted on the
          // component per burst id and per machine, paid on the last hit.
          if (p.burstRefund && p.compRef) {
            const c = p.compRef;
            if (c._brId !== p._burstId || c._brTarget !== t) {
              c._brId = p._burstId; c._brTarget = t; c._brHits = 0;
            }
            c._brHits++;
            if (c._brHits === p.burstRefund && typeof Machine !== 'undefined' &&
                Machine._xpPlayer) {
              Machine._xpPlayer.heat = Math.max(0, Machine._xpPlayer.heat - p.burstHeat);
              Effects.comicWord('COOL', Machine._xpPlayer.x, Machine._xpPlayer.y - 150,
                '#22d9ff', 40);
            }
          }
          // FLAMETHROWER step 2: a burning machine keeps burning briefly
          // and is easier to see -- a lit window on it, read by the draw.
          if (p.flame && p.lingering) {
            t._burnT = Math.max(t._burnT || 0, p.lingering);
            t._burnDps = p.damage * 6;
            t._burnSrc = p.srcId;
          }
          // ROCKET POD step 3: every rocket of one volley on one machine,
          // and the last lands a bonus detonation.
          if (p.volleyBonus && p.compRef) {
            const c = p.compRef;
            if (c._vbId !== p.volleyId || c._vbTarget !== t) {
              c._vbId = p.volleyId; c._vbTarget = t; c._vbHits = 0;
            }
            c._vbHits++;
            if (c._vbHits === 4) {
              Effects.explosion(t.x, t.y, 180);
              Effects.comicWord('VOLLEY!', t.x, t.y - 120, '#ffd23f', 56);
              const h3 = Machine.resolveHit(t, t.x, t.y, t.radius) || { kind: 'core' };
              Machine.applyDamage(t, h3, p.splashDamage * 3, t.x, t.y, false, p.srcId);
            }
          }
          // HARPOON (M14): a landed hit tethers the machine to the shooter,
          // and RIP LINE marks a critical connector for the Magnet.
          if (p.tether && t.sockets) {
            t._tetherT = p.tether;
            t._tetherAnchor = p.tetherEnt;
            t._tetherPull = p.tetherPull;
            // THE SPINE'S TETHER MARK (harpoon step 2), read by applyDamage.
            t._tetherMarked = !!p.tetherMark;
            if (p.ripLine && hit.kind === 'connector' &&
                hit.comp.connectorHp / hit.comp.maxConnectorHp <= 0.5) {
              hit.comp._ripLineT = 3.0;
            }
          }
        } else {
          if (Math.hypot(p.x - t.x, p.y - t.y) >= p.r + t.radius) continue;
          t.hit(p.damage, p.x, p.y);
        }
        if (p.pierce > 1) {
          p.pierce--;
          p.hitList.push(t);
          Effects.spark(p.x, p.y, Math.atan2(p.vy, p.vx), 4, p.color, 520);
          continue;
        }
        this._impact(p, targets, t);
        break;
      }
    }
  },

  // FLAK (M14): the shell bursts into `fragments` radial rounds. SHRED
  // CLOUD also sweeps opposing projectiles out of the burst radius.
  _flakBurst(p, targets) {
    Effects.explosion(p.x, p.y, 90);
    Effects.comicWord('FLAK!', p.x, p.y - 60, '#ff7a1a', 52);
    const FRAG = { id: p.srcId, damage: 1, fireRate: 1, isFrag: true,
      projSpeed: 620, projRadius: 7, projLife: 0.26, spread: 0,
      splash: 0, heatPerShot: 0, recoil: 0, color: '#ff7a1a' };
    for (let i = 0; i < p.fragments; i++) {
      const a = (i / p.fragments) * Math.PI * 2 + Math.random() * 0.3;
      const f = this.spawn(p.x, p.y, a, FRAG, p.owner, 1);
      if (f) {
        f.damage = p.fragDamage; f.compRef = p.compRef;
        // The spine's flak step 2 rides the SHELL; the fragments inherit it.
        f.fragRicochet = p.fragRicochet || 0;
      }
    }
    if (p.shred) {
      for (const q of this.pool) {
        if (!q.active || q === p || q.owner === p.owner || q.isFrag) continue;
        if (Math.hypot(q.x - p.x, q.y - p.y) < p.proxRadius) {
          q.active = false;
          Effects.spark(q.x, q.y, 0, 2, '#ff7a1a', 240);
        }
      }
    }
  },

  _impact(p, targets, directHit) {
    // A flak shell that reaches anything solid bursts rather than plinks.
    if (p.flak && p.active) {
      this._flakBurst(p, targets);
      p.active = false;
      return;
    }
    p.active = false;
    if (p.jam && directHit) {
      directHit.jamT = Math.max(directHit.jamT || 0, p.jam);
      Effects.comicWord('JAMMED!', directHit.x, directHit.y - 70, '#22d9ff', 44);
    }
    const ang = Math.atan2(-p.vy, -p.vx);

    // Arc Gun (plan §33): electricity chains to nearby machines.
    if (p.chain && directHit) {
      let remaining = p.chain;
      let fx = p.x, fy = p.y;
      const jumped = [directHit];
      // A GALVANIC's chain jumps to its own side as readily as to yours.
      const pool = p.chainAllies && typeof Enemy !== 'undefined' && Enemy._flock
        ? targets.concat(Enemy._flock) : targets;
      while (remaining > 0) {
        let next = null, nD = p.chainRange;
        for (const t of pool) {
          if (!t.alive || jumped.includes(t) || !t.sockets) continue;
          const d = Math.hypot(t.x - fx, t.y - fy);
          if (d < nD) { nD = d; next = t; }
        }
        // ARC GUN step 3: with nothing new in reach, the chain returns to
        // a machine already hit -- the nearest one that is not the one it
        // is standing on -- and does double. Once; then the chain ends.
        if (!next && p.chainReturn && jumped.length > 1) {
          let back = null, bD = p.chainRange;
          for (const t of jumped) {
            if (t === jumped[jumped.length - 1] || !t.alive) continue;
            const d = Math.hypot(t.x - fx, t.y - fy);
            if (d < bD) { bD = d; back = t; }
          }
          if (back) {
            Effects.bolt(fx, fy, back.x, back.y, '#ffffff');
            const hb = Machine.resolveHit(back, back.x, back.y, back.radius) || { kind: 'core' };
            Machine.applyDamage(back, hb, p.damage * p.chainFrac * 2 * (p.connMul || 1),
              back.x, back.y, false, p.srcId);
            Effects.comicWord('RETURN!', back.x, back.y - 100, '#ffffff', 44);
          }
          break;
        }
        if (!next) break;
        Effects.bolt(fx, fy, next.x, next.y, '#22d9ff');
        const hit = Machine.resolveHit(next, next.x, next.y, next.radius) || { kind: 'core' };
        Machine.applyDamage(next, hit, p.damage * p.chainFrac * (p.connMul || 1),
          next.x, next.y, false, p.srcId);
        // BLOCK 4.3: the ARC GUN DRAIN jams what it touches. Applied on the
        // CHAIN as well as the direct hit, because a weapon whose character
        // is 'shuts things down' should shut down everything it reaches.
        if (p.jam) next.jamT = Math.max(next.jamT || 0, p.jam);
        jumped.push(next);
        fx = next.x; fy = next.y;
        remaining--;
      }
    }

    // THE SPINE'S CLUSTER SHELL (cannon step 3): a direct hit also bursts.
    if (p.cluster && directHit) {
      const n = p.cluster;
      const FRAG = { id: p.srcId, damage: 1, fireRate: 1, isFrag: true,
        projSpeed: 700, projRadius: 8, projLife: 0.3, spread: 0,
        splash: 0, heatPerShot: 0, recoil: 0, color: p.color };
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(p.vy, p.vx) + (i - (n - 1) / 2) * 0.9;
        const f = this.spawn(p.x, p.y, a, FRAG, p.owner, 1);
        if (f) { f.damage = p.fragDamage; f.hitList.push(directHit); f.pierce = 0; }
      }
      Effects.comicWord('CLUSTER!', p.x, p.y - 70, p.color, 44);
    }
    // PLASMA REPEATER step 2: the splash scorches the ground briefly.
    if (p.scorch && p.splash > 0) {
      this.burn(p.x, p.y, p.splash * 0.7, 0.9, p.splashDamage * 2, p.owner, p.srcId);
    }
    if (p.splash > 0) {
      Effects.explosion(p.x, p.y, p.splash);
      for (const t of targets) {
        if (!t.alive || t === directHit) continue;
        if (Math.hypot(p.x - t.x, p.y - t.y) < p.splash + t.radius + 120) {
          if (t.sockets) {
            const hit = Machine.resolveHit(t, p.x, p.y, p.splash);
            if (hit) Machine.applyDamage(t, hit, p.splashDamage, t.x, t.y,
              false, p.srcId);
          } else if (Math.hypot(p.x - t.x, p.y - t.y) < p.splash + t.radius) {
            t.hit(p.splashDamage, t.x, t.y);
          }
        }
      }
    } else if (p.flame) {
      Effects.spark(p.x, p.y, ang, 2, '#ff7a1a', 220);
    } else {
      Effects.spark(p.x, p.y, ang, 5, p.color);
    }
  },

  activeCount() {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  },

  // ---- BURNING GROUND (the spine's fuelBurn and scorch) --------------------
  // A patch that damages opposing machines standing in it for its life.
  // One list, ticked with the pool, capped so a held trigger cannot lay a
  // carpet of them.
  burns: [],
  burn(x, y, r, life, dps, owner, srcId) {
    if (this.burns.length >= 24) this.burns.shift();
    this.burns.push({ x, y, r, life, t: 0, dps, owner, srcId });
  },
  updateBurns(dt, targetGroups) {
    for (let i = this.burns.length - 1; i >= 0; i--) {
      const b = this.burns[i];
      b.t += dt;
      if (b.t >= b.life) { this.burns.splice(i, 1); continue; }
      for (const t of (targetGroups[b.owner] || [])) {
        if (!t || !t.alive) continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) > b.r + (t.radius || 0) * 0.5) continue;
        if (t.sockets) {
          const hit = Machine.resolveHit(t, t.x, t.y, t.radius) || { kind: 'core' };
          Machine.applyDamage(t, hit, b.dps * dt, t.x, t.y, true, b.srcId);
        } else if (t.hit) t.hit(b.dps * dt, t.x, t.y, true);
      }
      if (Math.random() < dt * 12) {
        Effects.spark(b.x + (Math.random() - 0.5) * b.r, b.y + (Math.random() - 0.5) * b.r,
          -Math.PI / 2, 1, '#ff7a1a', 160);
      }
    }
    // AND BURNING MACHINES (flamethrower step 2): the burn set by a
    // lingering flame round ticks down here, with the pool.
    for (const grp of ['player', 'enemy']) {
      for (const t of (targetGroups[grp] || [])) {
        if (!t || !t.alive || !(t._burnT > 0)) continue;
        t._burnT -= dt;
        if (t.sockets) {
          const hit = Machine.resolveHit(t, t.x, t.y, t.radius) || { kind: 'core' };
          Machine.applyDamage(t, hit, (t._burnDps || 0) * dt, t.x, t.y, true, t._burnSrc);
        }
        if (Math.random() < dt * 20) {
          Effects.spark(t.x + (Math.random() - 0.5) * t.radius, t.y - t.radius * 0.5,
            -Math.PI / 2, 1, '#ffd23f', 200);
        }
      }
    }
  },

  draw(ctx) {
    for (const b of this.burns) {
      const k = 1 - b.t / b.life;
      ctx.globalAlpha = 0.45 * k;
      R.circle(b.x, b.y, b.r, '#ff7a1a');
      ctx.globalAlpha = 0.8 * k;
      R.circle(b.x, b.y, b.r * 0.45, '#ffd23f');
      ctx.globalAlpha = 1;
    }
    for (const p of this.pool) {
      if (!p.active) continue;
      // THE SPINE'S IMPACT MARKER (mortar step 2): your own shell's landing
      // point, drawn before it lands. Player shells only; an enemy mortar
      // telegraphs its own way.
      if (p.arcTo && p.impactMarker) {
        ctx.globalAlpha = 0.7;
        R.circle(p.arcTo.x, p.arcTo.y, 46, null, '#ffd23f', 4);
        R.circle(p.arcTo.x, p.arcTo.y, 8, '#ffd23f');
        ctx.globalAlpha = 1;
      }
      if (p.flame) {
        // Flame blob: grows and fades over its short life (plan §33/§67)
        const k = p.t / p.life;
        ctx.globalAlpha = 0.85 * (1 - k);
        R.circle(p.x, p.y, p.r * (0.7 + k * 2.2),
          k < 0.35 ? '#ffd23f' : (k < 0.7 ? '#ff7a1a' : '#8fa3c8'));
        ctx.globalAlpha = 1;
        continue;
      }
      // MORTAR shells read as airborne: they swell mid-flight and shrink
      // into the landing. Cheap, but the arc is legible.
      if (p.arcTo) {
        const f = p.arcF || 0;
        const scale = 1 + Math.sin(f * Math.PI) * 1.6;
        R.circle(p.x, p.y + 6 * scale, p.r * 0.8, 'rgba(0,0,0,0.35)');
        R.circle(p.x, p.y - 30 * Math.sin(f * Math.PI), p.r * scale, p.color,
          CONFIG.COLOR.ink, 5);
        continue;
      }
      // Short motion trail
      const tx = p.x - p.vx * 0.025, ty = p.y - p.vy * 0.025;
      ctx.globalAlpha = 0.4;
      R.circle(tx, ty, p.r * 0.8, p.color);
      ctx.globalAlpha = 1;
      // Dark halo + a heavier ink line: the Coreworks floor glows cyan, and
      // small cyan bullets were getting lost in its conduits.
      R.circle(p.x, p.y, p.r * 1.55, 'rgba(4,6,14,0.5)');
      R.circle(p.x, p.y, p.r, p.color, CONFIG.COLOR.ink, Math.max(4, p.r * 0.5));
      R.circle(p.x - p.r * 0.2, p.y - p.r * 0.25, p.r * 0.34, '#ffffff');
    }
  },
};

// ===========================================================================
// Mines (Milestone 12, plan §33 + §75): proximity mines dropped behind the
// machine. Hard cap 12 active — oldest fizzles. Triggered by the OPPOSING
// side but the blast damages every machine caught in it (like canisters).
const Mines = {
  MAX: 12,
  items: [],

  init() { this.items = []; },

  // armMul: Mine Layer Mastery 5 shortens arming; compRef lets RECYCLER
  // credit a kill back to the layer that placed the mine.
  spawn(x, y, part, owner, armMul = 1, compRef = null) {
    if (this.items.length >= this.MAX) {
      const old = this.items.shift();               // oldest fizzles
      Effects.spark(old.x, old.y, -Math.PI / 2, 4, '#8fa3c8', 260);
    }
    this.items.push({
      x, y, r: 30, owner, compRef,
      arm: 0.5 * armMul, t: Math.random() * 6,
      damage: part.mineDamage, splash: part.mineSplash,
    });
  },

  update(dt, player, enemies) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const m = this.items[i];
      m.t += dt;
      m.arm -= dt;
      if (m.arm > 0) continue;
      const triggers = m.owner === 'player' ? enemies
        : m.owner === 'map' ? [player].concat(enemies)   // §26B map mines
        : [player];
      for (const t of triggers) {
        if (!t || !t.alive) continue;
        if (Math.hypot(t.x - m.x, t.y - m.y) < m.r + t.radius + 46) {
          this.items.splice(i, 1);
          this._explode(m, player, enemies);
          break;
        }
      }
    }
  },

  _explode(m, player, enemies) {
    Effects.explosion(m.x, m.y, m.splash * 0.85);
    if (Math.random() < 0.5) Effects.comicWord('BOOM!', m.x, m.y - 80);
    Camera.shake(6, 0.18);
    const blast = (t) => {
      if (!t || !t.alive) return;
      const d = Math.hypot(t.x - m.x, t.y - m.y);
      if (d > m.splash + t.radius + 170) return;
      if (t.lastCause !== undefined) t.lastCause = 'mine';
      if (t.sockets) {
        const hit = Machine.resolveHit(t, m.x, m.y, m.splash);
        if (hit) Machine.applyDamage(t, hit, m.damage, t.x, t.y, false, null, 'mine');
      } else if (d < m.splash + t.radius) {
        t.hit(m.damage, t.x, t.y);
      }
    };
    const aliveBefore = enemies.filter(e => e.alive).length;
    blast(player);
    for (const e of enemies) blast(e);
    const killed = aliveBefore - enemies.filter(e => e.alive).length;
    if (killed > 0 && typeof Unlocks !== 'undefined') {
      Unlocks.event('mineChain', { kills: killed });
    }
    // RECYCLER (Mastery 10): a kill hands the layer one shortened deploy.
    if (killed > 0 && m.compRef) m.compRef._recyclerReady = true;
  },

  draw(ctx) {
    for (const m of this.items) {
      const blink = m.arm <= 0 && Math.sin(m.t * 9) > 0.4;
      // Map mines wear Aaron's War Depot mine model; laid mines keep the
      // vector puck (they are player/enemy hardware, not depot stock).
      const art = m.owner === 'map' && typeof Assets !== 'undefined' &&
        Assets.sprite(ctx, 'prop_mapMine', m.x, m.y, m.r * 2.6, m.r * 2.6, 0);
      if (!art) {
        R.circle(m.x + 4, m.y + 5, m.r, 'rgba(0,0,0,0.4)');
        R.circle(m.x, m.y, m.r, '#3a3a1c', CONFIG.COLOR.ink, 6);
        ctx.fillStyle = CONFIG.COLOR.ink;
        for (let i = 0; i < 4; i++) {
          const a = m.t * 0.4 + (i / 4) * Math.PI * 2;
          R.circle(m.x + Math.cos(a) * m.r * 0.75, m.y + Math.sin(a) * m.r * 0.75, 5, CONFIG.COLOR.ink);
        }
      }
      R.circle(m.x, m.y, 9, blink ? '#ff3b3b' : '#ffd23f', CONFIG.COLOR.ink, 4);
    }
  },
};

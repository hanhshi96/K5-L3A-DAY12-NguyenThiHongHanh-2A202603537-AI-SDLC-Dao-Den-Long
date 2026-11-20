// Đảo Đèn Lồng — deterministic game simulation (pure JS, no DOM).
// Shared by the 3D web client and the headless runner (Test Contract v1.0).
// 1 tick = 1/60 s. Y is up. Ground at Y = 0. Distances are measured on XZ.

export const TICK_RATE = 60;

// Single source of truth for tuning; game.contract.json must mirror this
// (tests/contract.test.js checks they are identical).
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.2,
  interact_radius: 2.5,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: { per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 2, per_flame_left: 50 },
};

// Non-contract constants (game design choices, documented in README).
export const WORLD = {
  island_radius: 40,
  lantern_ring_radius: 22,
  jump_speed: 6,
  gravity: 20,
  shade_y: 1,
  shade_chase_range: 15,
  shade_wander_factor: 0.5,
  initial_shades: 3,
  max_shades: 6,
  shade_spawn_every_s: 30,
  initial_motes: 40,
  mote_min_active: 20,
  mote_respawn_every_s: 2,
};

// ---------- deterministic RNG (mulberry32) ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class ScenarioError extends Error {}

// ---------- world construction ----------
function defaultLanterns() {
  const out = [];
  for (let i = 0; i < TUNING.lantern_count_night1; i++) {
    const ang = (i * 2 * Math.PI) / TUNING.lantern_count_night1;
    const r = WORLD.lantern_ring_radius;
    out.push({
      id: `L${i + 1}`,
      pos: [Math.round(r * Math.sin(ang) * 1000) / 1000, 0, Math.round(r * Math.cos(ang) * 1000) / 1000],
      deposited: 0,
      lit: false,
    });
  }
  return out;
}

export function createGame({ seed = 0, scenario = null } = {}) {
  const g = {
    rng: makeRng(seed),
    tick: 0,
    state: 'playing',
    score: 0,
    timeLeftTicks: TUNING.night1_duration_s * TICK_RATE,
    player: { pos: [0, 0, 0], vy: 0, flames: TUNING.flames, carried: 0, invuln: 0, pulseCd: 0 },
    lanterns: defaultLanterns(),
    shades: [],
    motes: [],
    nextMote: 1,
    nextShade: 1,
    randomMotes: true,
    randomShades: true,
    prevInput: { jump: false, interact: false, pulse: false, dash: false },
    events: [],
    result: null,
  };

  const sc = scenario || {};
  if (sc.random_motes !== undefined) g.randomMotes = sc.random_motes;
  if (sc.random_shades !== undefined) g.randomShades = sc.random_shades;

  if (sc.player) {
    if (sc.player.pos) g.player.pos = sc.player.pos.slice();
    if (sc.player.carried !== undefined) g.player.carried = sc.player.carried;
    if (sc.player.flames !== undefined) g.player.flames = sc.player.flames;
  }
  if (sc.time_left_s !== undefined) g.timeLeftTicks = Math.round(sc.time_left_s * TICK_RATE);

  if (sc.lanterns) {
    for (const l of sc.lanterns) {
      const t = g.lanterns.find((x) => x.id === l.id);
      if (!t) throw new ScenarioError(`unknown lantern id ${l.id}`);
      if (l.pos) t.pos = l.pos.slice();
      if (l.deposited !== undefined) t.deposited = l.deposited;
      if (l.lit !== undefined) t.lit = l.lit;
      if (t.lit && l.deposited === undefined) t.deposited = TUNING.lantern_cost;
      if (t.deposited >= TUNING.lantern_cost) t.lit = true;
    }
  }

  // Motes: scenario list replaces the default list.
  if (sc.motes) {
    for (const p of sc.motes) g.motes.push({ id: `M${g.nextMote++}`, pos: p.slice() });
  } else if (g.randomMotes) {
    for (let i = 0; i < WORLD.initial_motes; i++) spawnRandomMote(g);
  }

  // Shades: scenario list replaces the default list.
  if (sc.shades) {
    const used = new Set(sc.shades.filter((s) => s.id).map((s) => s.id));
    for (const s of sc.shades) {
      let id = s.id;
      if (!id) {
        while (used.has(`S${g.nextShade}`)) g.nextShade++;
        id = `S${g.nextShade++}`;
        used.add(id);
      }
      g.shades.push(makeShade(id, s.pos.slice()));
    }
    g.usedShadeIds = used;
  } else {
    g.usedShadeIds = new Set();
    if (g.randomShades) for (let i = 0; i < WORLD.initial_shades; i++) spawnRandomShade(g, false);
  }
  return g;
}

function makeShade(id, pos) {
  return { id, pos, state: 'wander', stun: 0, target: null };
}

function randomPointInRing(g, rMin, rMax) {
  const ang = g.rng() * Math.PI * 2;
  const r = rMin + g.rng() * (rMax - rMin);
  return [Math.round(r * Math.cos(ang) * 1000) / 1000, 0, Math.round(r * Math.sin(ang) * 1000) / 1000];
}

function spawnRandomMote(g) {
  g.motes.push({ id: `M${g.nextMote++}`, pos: randomPointInRing(g, 4, WORLD.island_radius - 2) });
}

function spawnRandomShade(g, emit) {
  let id;
  do id = `S${g.nextShade++}`; while (g.usedShadeIds.has(id));
  g.usedShadeIds.add(id);
  const p = randomPointInRing(g, 30, WORLD.island_radius - 1);
  p[1] = WORLD.shade_y;
  const s = makeShade(id, p);
  enforceSafe(g, s);
  g.shades.push(s);
  if (emit) g.events.push({ type: 'event', tick: g.tick + 1, name: 'shade_spawned', data: { id } });
}

// Shades can never be within safe_radius (distance <= r) of a LIT lantern.
function enforceSafe(g, s) {
  const r = TUNING.safe_radius;
  for (const l of g.lanterns) {
    if (!l.lit) continue;
    const dx = s.pos[0] - l.pos[0];
    const dz = s.pos[2] - l.pos[2];
    const d = Math.hypot(dx, dz);
    if (d <= r + 0.01) {
      const ux = d > 1e-9 ? dx / d : 1;
      const uz = d > 1e-9 ? dz / d : 0;
      s.pos[0] = l.pos[0] + ux * (r + 0.01);
      s.pos[2] = l.pos[2] + uz * (r + 0.01);
    }
  }
}

// ---------- step ----------
// input: { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash }
export function step(g, input) {
  if (g.state !== 'playing') return [];
  g.events = [];
  const T = TUNING;
  const next = g.tick + 1;
  const emit = (name, data) => g.events.push({ type: 'event', tick: next, name, data });
  const p = g.player;
  const rising = (k) => !!input[k] && !g.prevInput[k];

  // 1. movement
  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += (wx * T.player_speed) / TICK_RATE;
  p.pos[2] += (wz * T.player_speed) / TICK_RATE;
  const pr = Math.hypot(p.pos[0], p.pos[2]);
  if (pr > WORLD.island_radius) { // fall disabled: island edge is a wall
    p.pos[0] *= WORLD.island_radius / pr;
    p.pos[2] *= WORLD.island_radius / pr;
  }
  // jump
  if (rising('jump') && p.pos[1] <= 0 && p.vy === 0) p.vy = WORLD.jump_speed;
  if (p.pos[1] > 0 || p.vy > 0) {
    p.vy -= WORLD.gravity / TICK_RATE;
    p.pos[1] += p.vy / TICK_RATE;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // 2. pickup (automatic)
  for (let i = 0; i < g.motes.length && p.carried < T.carry_capacity; ) {
    if (distXZ(p.pos, g.motes[i].pos) <= T.pickup_radius) {
      g.motes.splice(i, 1);
      p.carried++;
      g.score += T.score.per_mote;
      emit('mote_picked', { carried: p.carried });
    } else i++;
  }

  // 3. interact: deposit into nearest unlit lantern in range
  if (rising('interact') && p.carried > 0) {
    let best = null, bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = distXZ(p.pos, l.pos);
      if (d <= T.interact_radius && d < bd) { best = l; bd = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      p.carried -= amount;
      best.deposited += amount;
      emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        emit('lantern_lit', { lantern_id: best.id });
        for (const s of g.shades) enforceSafe(g, s);
      }
    }
  }

  // 4. pulse
  if (rising('pulse') && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = Math.round(T.pulse_cooldown_s * TICK_RATE);
    const ids = [];
    for (const s of g.shades) {
      const d = distXZ(p.pos, s.pos);
      if (d > T.pulse_radius) continue;
      ids.push(s.id);
      s.state = 'stunned';
      s.stun = Math.round(T.pulse_stun_s * TICK_RATE);
      const ux = d > 1e-9 ? (s.pos[0] - p.pos[0]) / d : 1;
      const uz = d > 1e-9 ? (s.pos[2] - p.pos[2]) / d : 0;
      s.pos[0] += ux * T.pulse_push_m;
      s.pos[2] += uz * T.pulse_push_m;
      enforceSafe(g, s);
    }
    g.score += ids.length * T.score.per_stun;
    emit('pulse', { stunned_ids: ids });
  }

  // 5. shades
  for (const s of g.shades) {
    // Stunned for exactly pulse_stun_s*60 ticks (no move, no hit), then resumes.
    if (s.stun > 0) { s.stun--; continue; }
    const dp = distXZ(s.pos, p.pos);
    let tx, tz, speed;
    if (dp <= WORLD.shade_chase_range) {
      s.state = 'chase';
      tx = p.pos[0]; tz = p.pos[2]; speed = T.shade_speed;
    } else {
      s.state = 'wander';
      if (!s.target || distXZ(s.pos, s.target) < 1) s.target = randomPointInRing(g, 5, WORLD.island_radius - 2);
      tx = s.target[0]; tz = s.target[2]; speed = T.shade_speed * WORLD.shade_wander_factor;
    }
    const dx = tx - s.pos[0], dz = tz - s.pos[2];
    const d = Math.hypot(dx, dz);
    const stepLen = Math.min(d, speed / TICK_RATE);
    if (d > 1e-9) { s.pos[0] += (dx / d) * stepLen; s.pos[2] += (dz / d) * stepLen; }
    enforceSafe(g, s);
  }

  // 6. hits
  if (p.invuln > 0) p.invuln--;
  else {
    for (const s of g.shades) {
      if (s.state === 'stunned') continue;
      if (distXZ(s.pos, p.pos) <= T.shade_hit_radius) {
        p.flames--;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        p.invuln = Math.round(T.invuln_s * TICK_RATE);
        emit('player_hit', { by: 'shade', flames: p.flames, dropped });
        break;
      }
    }
  }
  if (p.pulseCd > 0) p.pulseCd--;

  // 7. spawns
  if (g.randomMotes && next % Math.round(WORLD.mote_respawn_every_s * TICK_RATE) === 0 &&
      g.motes.length < WORLD.mote_min_active) spawnRandomMote(g);
  if (g.randomShades && next % Math.round(WORLD.shade_spawn_every_s * TICK_RATE) === 0 &&
      g.shades.length < WORLD.max_shades) spawnRandomShade(g, true);

  // 8. time & end conditions
  g.timeLeftTicks--;
  g.tick = next;
  g.prevInput = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash };
  if (g.lanterns.every((l) => l.lit)) {
    g.score += Math.floor(Math.max(0, g.timeLeftTicks) / TICK_RATE) * T.score.per_second_left +
               p.flames * T.score.per_flame_left;
    end(g, 'won', 'all_lit', emit);
  } else if (p.flames <= 0) end(g, 'lost', 'no_flames', emit);
  else if (g.timeLeftTicks <= 0) end(g, 'lost', 'dawn', emit);
  return g.events;
}

function end(g, result, reason, emit) {
  g.state = result;
  g.result = { result, reason };
  emit('game_over', { result, reason });
}

// ---------- serialization ----------
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const v3 = (p) => p.map(r3);

export function snapshot(g) {
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.tick,
    state: g.state,
    time_left_s: r3(g.timeLeftTicks / TICK_RATE),
    score: g.score,
    player: { pos: v3(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
  };
}

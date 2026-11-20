// Đảo Đèn Lồng — deterministic game simulation (pure JS, no DOM).
// Shared by the 3D web client and the headless runner (Test Contract v1.1).
// 1 tick = 1/60 s. Y is up. Distances on XZ unless stated. Tick order follows Ticket-02.
import { NIGHTS, angPoint } from './nights.js';

export const TICK_RATE = 60;

// Standard numbers (Ticket-02 Part 1). game.contract.json mirrors this (tested).
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  score: { per_mote: 5, per_lantern: 100, per_stun: 5, per_second_left: 0, per_flame_left: 50 },
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  night2_duration_s: 270,
  night3_duration_s: 300,
  // Contract v1.2 (Ticket-03)
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
};

// Other standard rules from Ticket-02 (not contract keys).
export const RULES = {
  jump_speed: 7, gravity: 20, step_up: 0.3, height_tol: 1.5,
  charm_speed: 7.2, charm_ticks: 600, charm_respawn_ticks: 2700,
  shade_detect: 12, shade_lose: 18, shade_hover: 1, shade_wander_factor: 0.5,
  spawning_ticks: 60, recoil_m: 2, recoil_ticks: 60, push_ticks: 15, safe_push_per_tick: 0.2,
  pulse_center_h: 0.8, dropped_ttl: 480, drop_ring: [1.5, 2.5],
  fall_y: -10, fall_wait: 60, respawn_invuln: 90,
  mote_initial: 20, mote_cap: 30, mote_every: 240,
  shade_first_tick: 300, shade_first_count: 2, shade_min_player_dist: 15,
  drifter_speed: 7, drifter_idle_speed: 2, drifter_max: 2, drifter_every: 1200,
  drifter_chase_carried: 5, drifter_chase_range: 15, drifter_touch: 1.2, drifter_steal_max: 3,
  drifter_flee_ticks: 240, drifter_drop_flee_ticks: 120, drifter_hover: 1.5,
  wind_every: 1800, wind_ticks: 300, wind_speed: 2,
  // Phase 3
  relight_score: 40, drain_stun_score: 15, dawn_per_lantern: 50, capacity_per_light: 2,
  drain_range: 2, drain_chase_range: 6, fuel_drain_event_every: 60,
};
// Fuel is stored as integer units of 1/60 (ADR 0001): 1 unit per tick = 1 fuel per second.
const FU = TICK_RATE;
const FUEL_MAX_U = T_fuel(100);
function T_fuel(f) { return Math.round(f * FU); }
const safeLantern = (l) => l.lit && l.fuelU >= TUNING.low_fuel_threshold * FU;
const weakLantern = (l) => l.lit && l.fuelU < TUNING.low_fuel_threshold * FU;
export const capacityOf = (p) => Math.min(TUNING.capacity_max, TUNING.carry_capacity + RULES.capacity_per_light * p.successfulLights);

const T = TUNING, R = RULES;
const ticks = (s) => Math.round(s * TICK_RATE);
const r1 = (v) => Math.round(v * 10) / 10 + 0;
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const lanternNum = (id) => parseInt(id.slice(1), 10);

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

export class ScenarioError extends Error {}

// ---------- construction ----------
export function createGame({ seed = 0, night = 1, scenario = null } = {}) {
  const N = NIGHTS[night];
  if (!N) throw new ScenarioError(`unknown night ${night}`);
  const sc = scenario || {};
  const g = {
    seed, night, N, rng: makeRng(seed),
    tick: 0, simTick: 0, state: 'playing', paused: false, score: 0,
    timeLeftTicks: ticks(N.duration_s),
    player: {
      pos: N.start.slice(), vy: 0, vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: T.flames, carried: 0, invuln: 0, pulseCd: 0, dashCd: 0, dashTicks: 0, dashDir: [0, 1],
      charm: 0, launch: null, fallWait: 0, successfulLights: 0,
    },
    lanterns: N.lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: p.slice(), deposited: 0, lit: false, fuelU: 0, everLit: false, relitCount: 0 })),
    shades: [], motes: [], drifters: [], charms: [],
    nextMote: 1, nextShade: 1, nextDrifter: 1,
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    randomDrifters: (sc.random_drifters ?? true) && N.drifters,
    windEnabled: (sc.wind_enabled ?? true) && N.wind,
    prevInput: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    events: [],
  };
  const p = g.player;
  if (sc.player) {
    const sp = sc.player;
    if (sp.pos) p.pos = sp.pos.slice();
    if (sp.carried !== undefined) p.carried = sp.carried;
    if (sp.flames !== undefined) p.flames = sp.flames;
    if (sp.invuln_ticks !== undefined) p.invuln = sp.invuln_ticks;
    if (sp.dash_cd_ticks !== undefined) p.dashCd = sp.dash_cd_ticks;
    if (sp.pulse_cd_ticks !== undefined) p.pulseCd = sp.pulse_cd_ticks;
    if (sp.charm_ticks !== undefined) p.charm = sp.charm_ticks;
    if (sp.successful_lights !== undefined) p.successfulLights = sp.successful_lights;
  }
  const g0 = ground(g, p.pos[0], p.pos[2]);
  p.grounded = g0 !== null && Math.abs(p.pos[1] - g0) < 1e-9;
  if (sc.time_left_s !== undefined) g.timeLeftTicks = ticks(sc.time_left_s);

  if (sc.lanterns) {
    for (const l of sc.lanterns) {
      const t = g.lanterns.find((x) => x.id === l.id);
      if (!t) throw new ScenarioError(`unknown lantern id ${l.id} for night ${night}`);
      if (l.pos) t.pos = l.pos.slice();
      if (l.deposited !== undefined) t.deposited = l.deposited;
      if (l.lit !== undefined) t.lit = l.lit;
      if (l.ever_lit !== undefined) t.everLit = l.ever_lit;
      else if (t.lit) t.everLit = true;
      const cost = t.everLit && !t.lit ? T.relight_cost : T.lantern_cost;
      if (!t.lit && t.deposited >= cost) t.lit = true;
      if (t.lit && l.deposited === undefined) t.deposited = cost;
      if (t.lit) t.fuelU = l.fuel !== undefined ? T_fuel(l.fuel) : FUEL_MAX_U; // lit:true without fuel -> 100
    }
  }

  if (sc.motes) for (const m of sc.motes) g.motes.push({ id: `M${g.nextMote++}`, pos: m.slice(), kind: 'random', ttl: null, point: -1 });
  else if (g.randomMotes) {
    const idx = N.motePoints.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (const i of idx.slice(0, R.mote_initial)) addRandomMote(g, i);
  }

  if (sc.shades) {
    const used = new Set(sc.shades.filter((s) => s.id).map((s) => s.id));
    for (const s of sc.shades) {
      let id = s.id;
      if (!id) { while (used.has(`S${g.nextShade}`)) g.nextShade++; id = `S${g.nextShade++}`; used.add(id); }
      const sh = makeShade(id, s.pos.slice(), s.state || 'wander');
      if (s.target_lantern_id !== undefined) sh.targetL = s.target_lantern_id;
      if (s.state_ticks_left !== undefined) sh.stateTicks = s.state_ticks_left;
      else sh.stateTicks = { spawning: R.spawning_ticks, stunned: ticks(T.pulse_stun_s), recoil: R.recoil_ticks }[sh.state] || 0;
      g.shades.push(sh);
    }
    g.usedShadeIds = used;
  } else g.usedShadeIds = new Set();

  if (sc.drifters) {
    for (const d of sc.drifters) {
      const id = d.id || `D${g.nextDrifter}`;
      g.nextDrifter = Math.max(g.nextDrifter, parseInt(id.slice(1), 10) + 1 || g.nextDrifter + 1);
      g.drifters.push({ id, pos: d.pos.slice(), state: d.state || 'idle', stolen: d.stolen || 0, timer: d.state_ticks_left ?? (d.state === 'flee' ? R.drifter_flee_ticks : 0), target: null });
    }
  }
  const charmSrc = sc.charms || N.charms.map((pos) => ({ pos }));
  charmSrc.forEach((c, i) => g.charms.push({ id: c.id || `C${i + 1}`, pos: c.pos.slice(), available: c.available ?? true, respawn: c.respawn_ticks ?? 0 }));
  return g;
}

function makeShade(id, pos, state = 'wander') {
  return { id, pos, state, stateTicks: 0, pushTicks: 0, pushDir: [1, 0], target: null, targetL: null, drainTicks: 0 };
}

function addRandomMote(g, pointIdx) {
  const pt = g.N.motePoints[pointIdx];
  g.motes.push({ id: `M${g.nextMote++}`, pos: pt.slice(), kind: 'random', ttl: null, point: pointIdx });
}

// ---------- terrain ----------
export function ground(g, x, z) { return g.N.ground(x, z); }
function shadeY(g, x, z, hover) {
  const h = g.N.ground(x, z);
  return (h === null || h > 6 ? 0 : h) + hover;
}
function inLitZone(g, pos) {
  for (const l of g.lanterns) if (safeLantern(l) && distXZ(pos, l.pos) < T.safe_radius - 1e-9) return true;
  return false;
}
// Keep a moving shade from entering a lit safe zone: project to the 6 m edge.
function blockSafe(g, s, from) {
  for (const l of g.lanterns) {
    if (!safeLantern(l)) continue;
    const d = distXZ(s.pos, l.pos);
    if (d < T.safe_radius - 1e-9 && distXZ(from, l.pos) >= T.safe_radius - 1e-9) {
      const ux = d > 1e-9 ? (s.pos[0] - l.pos[0]) / d : 1, uz = d > 1e-9 ? (s.pos[2] - l.pos[2]) / d : 0;
      s.pos[0] = l.pos[0] + ux * T.safe_radius; s.pos[2] = l.pos[2] + uz * T.safe_radius;
    }
  }
}
function moveToward(e, tx, tz, speed) {
  const dx = tx - e.pos[0], dz = tz - e.pos[2], d = Math.hypot(dx, dz);
  const st = Math.min(d, speed / TICK_RATE);
  if (d > 1e-9) { e.pos[0] += (dx / d) * st; e.pos[2] += (dz / d) * st; }
  return d;
}
function moveAway(e, from, speed) {
  const dx = e.pos[0] - from[0], dz = e.pos[2] - from[2], d = Math.hypot(dx, dz);
  const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
  e.pos[0] += (ux * speed) / TICK_RATE; e.pos[2] += (uz * speed) / TICK_RATE;
}

export function windAt(g, t) {
  // Gust k (k >= 1) is active on sim ticks [1800k, 1800k + 300). Direction per gust from seed.
  const k = Math.max(1, Math.floor(t / R.wind_every) + (t % R.wind_every >= R.wind_ticks ? 1 : 0));
  const active = g.windEnabled && t >= R.wind_every && t % R.wind_every < R.wind_ticks;
  const dir = makeRng((g.seed ^ Math.imul(k, 0x9e3779b9)) >>> 0)() * 360;
  return { active, dir_deg: dir, k };
}

// ---------- step ----------
// input: { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash, pause }
export function step(g, input) {
  g.events = [];
  if (g.state !== 'playing' && g.state !== 'paused') return [];
  const next = g.tick + 1;
  const emit = (name, data) => g.events.push({ type: 'event', tick: next, name, data });
  const rising = (k) => !!input[k] && !g.prevInput[k];
  const p = g.player;
  const finish = () => {
    g.tick = next;
    g.prevInput = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash, pause: !!input.pause };
    return g.events;
  };

  // 1. input; pause first
  if (rising('pause')) {
    g.paused = !g.paused;
    g.state = g.paused ? 'paused' : 'playing';
    emit(g.paused ? 'paused' : 'resumed', {});
  }
  if (g.paused) return finish();
  const st = g.simTick + 1; // sim tick produced by this step

  // 2. counters
  g.timeLeftTicks--;
  for (const k of ['pulseCd', 'dashCd', 'invuln', 'charm', 'dashTicks']) if (p[k] > 0) p[k]--;
  for (const s of g.shades) if (s.state === 'stunned' && s.stateTicks > 0) s.stateTicks--;
  for (const d of g.drifters) if (d.state === 'flee' && d.timer > 0) d.timer--;
  for (let i = g.motes.length - 1; i >= 0; i--) {
    const m = g.motes[i];
    if (m.ttl !== null && --m.ttl <= 0) g.motes.splice(i, 1);
  }
  for (const c of g.charms) if (!c.available && --c.respawn <= 0) { c.available = true; c.respawn = 0; }
  // fuel: decay + drain (integer units), then lanterns at fuel <= 0 go out (Ticket-03)
  for (const l of g.lanterns) {
    if (!l.lit) continue;
    l.fuelU -= Math.round(T.fuel_decay_per_s * FU / TICK_RATE);
    for (const s of [...g.shades].sort(byId)) {
      if (s.state !== 'drain' || s.targetL !== l.id) continue;
      l.fuelU -= Math.round(T.drain_per_s * FU / TICK_RATE);
      if (++s.drainTicks % R.fuel_drain_event_every === 0) emit('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: r1(Math.max(0, l.fuelU) / FU) });
    }
  }
  for (const l of g.lanterns) {
    if (l.lit && l.fuelU <= 0) {
      l.lit = false; l.fuelU = 0; l.deposited = 0;
      emit('lantern_out', { lantern_id: l.id });
    }
  }
  if (p.fallWait > 0 && --p.fallWait === 0) {
    p.pos = g.N.start.slice(); p.vy = 0; p.vel = [0, 0, 0]; p.launch = null; p.dashTicks = 0;
    p.grounded = true; p.invuln = R.respawn_invuln;
  }

  // 3. move Mây (jump, dash, jump pad, wind), then fall check
  const wind = windAt(g, st);
  if (p.fallWait === 0) {
    let [mx, mz] = input.move || [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) p.facing = [wx / wl, wz / wl];

    if (rising('jump') && p.grounded) { p.vy = R.jump_speed; p.grounded = false; }
    if (rising('dash') && p.dashTicks === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashTicks = ticks(T.dash_duration_s);
      p.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : p.facing.slice();
      p.dashCd = p.charm > 0 ? 0 : ticks(T.dash_cooldown_s);
      emit('dash', {});
    }
    let vx, vz;
    if (p.dashTicks > 0) { vx = p.dashDir[0] * T.dash_speed; vz = p.dashDir[1] * T.dash_speed; }
    else if (p.launch) { [vx, vz] = p.launch; }
    else { const sp = p.charm > 0 ? R.charm_speed : T.player_speed; vx = wx * sp; vz = wz * sp; }
    if (wind.active) {
      const a = (wind.dir_deg * Math.PI) / 180;
      vx += Math.cos(a) * R.wind_speed; vz += Math.sin(a) * R.wind_speed;
    }
    const nx = p.pos[0] + vx / TICK_RATE, nz = p.pos[2] + vz / TICK_RATE;
    const gn = ground(g, nx, nz);
    if (!(gn !== null && gn > p.pos[1] + R.step_up)) { p.pos[0] = nx; p.pos[2] = nz; } else { vx = 0; vz = 0; }
    if (!(p.dashTicks > 0 && !p.grounded)) { // dash in the air keeps altitude
      // exact integration for constant gravity (apex = v²/2g, flight = 2v/g)
      const dt = 1 / TICK_RATE;
      p.pos[1] += p.vy * dt - 0.5 * R.gravity * dt * dt;
      p.vy -= R.gravity * dt;
    }
    const gh = ground(g, p.pos[0], p.pos[2]);
    if (gh !== null && p.pos[1] <= gh + 1e-9 && p.vy <= 0 && gh <= p.pos[1] + R.step_up + 1) {
      p.pos[1] = gh; p.vy = 0; p.grounded = true; p.launch = null;
    } else p.grounded = false;
    if (p.grounded) {
      for (const pad of g.N.pads) {
        if (distXZ(p.pos, pad.pos) <= pad.r && Math.abs(p.pos[1] - pad.pos[1]) < 0.05) {
          p.launch = pad.h.slice(); p.vy = pad.vy; p.grounded = false;
        }
      }
    }
    p.vel = p.launch && p.dashTicks === 0 ? [p.launch[0], p.vy, p.launch[1]] : [vx, p.grounded ? 0 : p.vy, vz];
    if (T.fall_enabled && p.pos[1] < R.fall_y) {
      p.flames--;
      const lost = p.carried;
      p.carried = 0; p.fallWait = R.fall_wait; p.vel = [0, 0, 0]; p.vy = 0; p.launch = null; p.dashTicks = 0;
      emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  // 4. pick up motes and charms
  if (p.fallWait === 0) {
    const near = (pos) => distXZ(p.pos, pos) <= T.pickup_radius && Math.abs(p.pos[1] - pos[1]) <= R.height_tol;
    for (let i = 0; i < g.motes.length && p.carried < capacityOf(p);) {
      if (near(g.motes[i].pos)) {
        g.motes.splice(i, 1);
        p.carried++;
        emit('mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of g.charms) {
      if (c.available && near(c.pos)) {
        c.available = false; c.respawn = R.charm_respawn_ticks; p.charm = R.charm_ticks;
        emit('charm_picked', { charm_id: c.id, charm_ticks: R.charm_ticks });
      }
    }
  }

  // 5. interact with lanterns: light / relight unlit ones, refuel lit ones that are not full
  if (rising('interact') && p.carried > 0 && p.fallWait === 0) {
    let best = null, bd = Infinity;
    for (const l of g.lanterns) {
      if (l.lit && l.fuelU >= FUEL_MAX_U) continue; // full lanterns are not selectable
      const d = distXZ(p.pos, l.pos);
      if (d <= T.interact_radius && (d < bd || (d === bd && lanternNum(l.id) < lanternNum(best.id)))) { best = l; bd = d; }
    }
    if (best && best.lit) {
      const used = Math.min(p.carried, Math.ceil((FUEL_MAX_U - best.fuelU) / (T.fuel_per_mote * FU)));
      best.fuelU = Math.min(FUEL_MAX_U, best.fuelU + used * T.fuel_per_mote * FU);
      p.carried -= used;
      g.score += used * T.score.per_mote;
      emit('refuel', { lantern_id: best.id, amount: used, fuel: r1(best.fuelU / FU) });
    } else if (best) {
      const cost = best.everLit ? T.relight_cost : T.lantern_cost;
      const amount = Math.min(p.carried, cost - best.deposited);
      p.carried -= amount;
      best.deposited += amount;
      g.score += amount * T.score.per_mote;
      emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true; best.everLit = true; best.fuelU = FUEL_MAX_U;
        if (relight) { best.relitCount++; g.score += R.relight_score; } else g.score += T.score.per_lantern;
        p.successfulLights++;
        emit('lantern_lit', { lantern_id: best.id, relight });
      }
    }
  }

  // 6. safe zones: shades inside a lit zone are pushed out (<= 30 ticks), harmless meanwhile
  for (const s of g.shades) {
    for (const l of g.lanterns) {
      if (!safeLantern(l)) continue;
      const d = distXZ(s.pos, l.pos);
      if (d < T.safe_radius - 1e-9) {
        if (s.state === 'drain') { s.state = 'wander'; s.targetL = null; }
        const ux = d > 1e-9 ? (s.pos[0] - l.pos[0]) / d : 1, uz = d > 1e-9 ? (s.pos[2] - l.pos[2]) / d : 0;
        const nd = Math.min(T.safe_radius, d + R.safe_push_per_tick);
        s.pos[0] = l.pos[0] + ux * nd; s.pos[2] = l.pos[2] + uz * nd;
        s.inZone = true;
      }
    }
  }

  // 7. pulse
  if (rising('pulse') && p.pulseCd === 0 && p.carried >= T.pulse_cost && p.fallWait === 0) {
    p.carried -= T.pulse_cost;
    p.pulseCd = ticks(T.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + R.pulse_center_h, p.pos[2]];
    const d3 = (e) => Math.hypot(e.pos[0] - c[0], e.pos[1] - c[1], e.pos[2] - c[2]);
    const ids = [];
    for (const s of [...g.shades].sort(byId)) {
      if (d3(s) > T.pulse_radius) continue;
      ids.push(s.id);
      g.score += s.state === 'drain' ? R.drain_stun_score : T.score.per_stun;
      s.targetL = null;
      const dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2], d = Math.hypot(dx, dz);
      s.pushDir = d > 1e-9 ? [dx / d, dz / d] : [1, 0];
      s.state = 'stunned'; s.stateTicks = ticks(T.pulse_stun_s); s.pushTicks = R.push_ticks;
    }
    for (const d of g.drifters) {
      if (d3(d) > T.pulse_radius) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.timer = R.drifter_flee_ticks; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        dropMotes(g, d.pos, amount);
        d.stolen = 0; d.timer = R.drifter_drop_flee_ticks;
        emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    emit('pulse', { stunned_ids: ids });
  }

  // 8. move shades and drifters
  const speed = g.N.shade_speed;
  for (const s of [...g.shades].sort(byId)) {
    const from = s.pos.slice();
    if (s.inZone) { s.inZone = inLitZone(g, s.pos); continue; } // being pushed out this tick
    if (s.state === 'spawning') { if (--s.stateTicks <= 0) s.state = 'wander'; continue; }
    if (s.state === 'stunned') {
      if (s.pushTicks > 0) {
        s.pos[0] += (s.pushDir[0] * T.pulse_push_m) / R.push_ticks;
        s.pos[2] += (s.pushDir[1] * T.pulse_push_m) / R.push_ticks;
        s.pushTicks--;
        if (inLitZone(g, s.pos) || (g.N.ground(s.pos[0], s.pos[2]) ?? 0) > 6) { s.pos = from; s.pushTicks = 0; }
      }
      if (s.stateTicks > 0) continue;
      s.state = 'wander';
    }
    if (s.state === 'recoil') {
      moveAway(s, p.pos, R.recoil_m / R.recoil_ticks * TICK_RATE);
      blockSafe(g, s, from);
      s.pos[1] = shadeY(g, s.pos[0], s.pos[2], R.shade_hover);
      if (--s.stateTicks <= 0) s.state = 'wander';
      continue;
    }
    const dp = distXZ(s.pos, p.pos);
    if (s.state === 'drain') {
      const L = g.lanterns.find((l) => l.id === s.targetL);
      if (dp <= R.drain_chase_range) { s.state = 'chase'; s.targetL = null; }
      else if (!L || !L.lit || !weakLantern(L) || distXZ(s.pos, L.pos) > R.drain_range) { s.state = 'wander'; s.targetL = null; }
      else continue; // stays still while draining
    }
    if (s.state === 'chase' && dp > R.shade_lose) s.state = 'wander';
    else if (s.state === 'wander' && dp <= R.shade_detect) { s.state = 'chase'; s.targetL = null; }
    let weak = null;
    if (s.state === 'wander') {
      const cur = g.lanterns.find((l) => l.id === s.targetL);
      if (cur && weakLantern(cur)) weak = cur;
      else {
        let bd = Infinity;
        for (const l of g.lanterns) {
          if (!weakLantern(l)) continue;
          const d = distXZ(s.pos, l.pos);
          if (d < bd || (d === bd && lanternNum(l.id) < lanternNum(weak.id))) { weak = l; bd = d; }
        }
        s.targetL = weak ? weak.id : null;
      }
    }
    if (s.state === 'chase') moveToward(s, p.pos[0], p.pos[2], speed);
    else if (weak) {
      if (distXZ(s.pos, weak.pos) <= R.drain_range) { s.state = 'drain'; s.drainTicks = 0; }
      else {
        moveToward(s, weak.pos[0], weak.pos[2], speed);
        if (distXZ(s.pos, weak.pos) <= R.drain_range) { s.state = 'drain'; s.drainTicks = 0; }
      }
    } else {
      if (!s.target || distXZ(s.pos, s.target) < 1) s.target = g.N.motePoints[Math.floor(g.rng() * g.N.motePoints.length)];
      moveToward(s, s.target[0], s.target[2], speed * R.shade_wander_factor);
    }
    blockSafe(g, s, from);
    s.pos[1] = shadeY(g, s.pos[0], s.pos[2], R.shade_hover);
  }
  for (const d of g.drifters) {
    if (d.state === 'removed') continue;
    const dp = distXZ(d.pos, p.pos);
    const want = p.carried >= R.drifter_chase_carried && dp <= R.drifter_chase_range;
    if (d.state === 'idle' && want) d.state = 'chase';
    else if (d.state === 'chase' && !want) d.state = 'idle';
    if (d.state === 'chase') moveToward(d, p.pos[0], p.pos[2], R.drifter_speed);
    else if (d.state === 'idle') {
      if (!d.target || distXZ(d.pos, d.target) < 1) d.target = g.N.motePoints[Math.floor(g.rng() * g.N.motePoints.length)];
      moveToward(d, d.target[0], d.target[2], R.drifter_idle_speed);
    } else if (d.state === 'flee') {
      moveAway(d, p.pos, R.drifter_speed);
      if (d.timer <= 0) d.state = 'removed'; // timer is decremented in step 2
    }
    d.pos[1] = shadeY(g, d.pos[0], d.pos[2], R.drifter_hover);
  }

  // 9. touch: drifters steal first, then shades hit (ascending id)
  if (p.fallWait === 0) {
    for (const d of [...g.drifters].sort(byId)) {
      if ((d.state === 'idle' || d.state === 'chase') && p.carried > 0 && distXZ(d.pos, p.pos) <= R.drifter_touch) {
        const amount = Math.min(R.drifter_steal_max, p.carried);
        p.carried -= amount; d.stolen = amount; d.state = 'flee'; d.timer = R.drifter_flee_ticks;
        emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    if (p.invuln === 0) {
      for (const s of [...g.shades].sort(byId)) {
        if (s.state !== 'wander' && s.state !== 'chase') continue;
        if (inLitZone(g, s.pos)) continue;
        if (distXZ(s.pos, p.pos) > T.shade_hit_radius || Math.abs(s.pos[1] - p.pos[1]) > R.height_tol) continue;
        p.flames--;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        dropMotes(g, p.pos, dropped);
        p.invuln = ticks(T.invuln_s);
        s.state = 'recoil'; s.stateTicks = R.recoil_ticks;
        emit('player_hit', { by: 'shade', flames: p.flames, dropped });
        break; // at most one flame per tick
      }
    }
  }

  // 10. spawns (new entities interact from the next tick)
  if (g.randomMotes && st % R.mote_every === 0 && g.motes.filter((m) => m.kind === 'random').length < R.mote_cap) {
    const used = new Set(g.motes.map((m) => m.point));
    const free = g.N.motePoints.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length) addRandomMote(g, free[Math.floor(g.rng() * free.length)]);
  }
  if (g.randomShades && st >= R.shade_first_tick && (st - R.shade_first_tick) % g.N.shade_every === 0) {
    const n = st === R.shade_first_tick ? R.shade_first_count : 1;
    for (let i = 0; i < n && g.shades.length < g.N.shade_max; i++) {
      const pts = g.N.shadePoints.filter((q) => distXZ(q, p.pos) >= R.shade_min_player_dist && !inLitZone(g, q));
      if (!pts.length) break;
      const q = pts[Math.floor(g.rng() * pts.length)];
      let id;
      do id = `S${g.nextShade++}`; while (g.usedShadeIds.has(id));
      g.usedShadeIds.add(id);
      const s = makeShade(id, [q[0], shadeY(g, q[0], q[2], R.shade_hover), q[2]], 'spawning');
      s.stateTicks = R.spawning_ticks;
      g.shades.push(s);
      emit('shade_spawned', { id });
    }
  }
  if (g.randomDrifters && st % R.drifter_every === 0 && g.drifters.filter((d) => d.state !== 'removed').length < R.drifter_max) {
    const q = g.N.shadePoints[Math.floor(g.rng() * g.N.shadePoints.length)];
    g.drifters.push({ id: `D${g.nextDrifter++}`, pos: [q[0], shadeY(g, q[0], q[2], R.drifter_hover), q[2]], state: 'idle', stolen: 0, timer: 0, target: null });
  }

  // 11. win / lose
  g.simTick = st;
  // Ticket-03: no early win. At dawn: alive and lit >= ceil(0.6 * total) -> won.
  if (p.flames <= 0) end(g, 'lost', 'no_flames', emit);
  else if (g.timeLeftTicks <= 0) {
    const lit = g.lanterns.filter((l) => l.lit);
    if (lit.length >= Math.ceil(T.win_ratio * g.lanterns.length - 1e-9)) {
      for (const l of lit) g.score += R.dawn_per_lantern + Math.floor(l.fuelU / FU);
      g.score += p.flames * T.score.per_flame_left;
      end(g, 'won', 'dawn_survived', emit);
    } else end(g, 'lost', 'dawn', emit);
  }
  return finish();
}

const byId = (a, b) => parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10);

function dropMotes(g, at, n) {
  for (let i = 0; i < n; i++) {
    const a = ((i / n) + g.rng() * 0.1) * Math.PI * 2;
    const r = R.drop_ring[0] + g.rng() * (R.drop_ring[1] - R.drop_ring[0]);
    const x = at[0] + Math.cos(a) * r, z = at[2] + Math.sin(a) * r;
    const h = g.N.ground(x, z);
    g.motes.push({ id: `M${g.nextMote++}`, pos: [x, h === null || h > 6 ? at[1] : h, z], kind: 'dropped', ttl: R.dropped_ttl, point: -1 });
  }
}

function end(g, result, reason, emit) {
  g.state = result;
  emit('game_over', { result, reason });
}

// ---------- serialization ----------
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const v3 = (p) => p.map(r3);

export function snapshot(g) {
  const p = g.player;
  const w = windAt(g, g.simTick);
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.state,
    time_left_s: r3(g.timeLeftTicks / TICK_RATE),
    score: g.score,
    player: {
      pos: v3(p.pos), vel: v3(p.vel), grounded: p.grounded, flames: p.flames, carried: p.carried, capacity: capacityOf(p),
      invuln: p.invuln > 0, dash_cd_s: r3(p.dashCd / TICK_RATE), pulse_cd_s: r3(p.pulseCd / TICK_RATE), charm_s: r3(p.charm / TICK_RATE),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited, fuel: l.lit ? r1(l.fuelU / FU) : 0, ever_lit: l.everLit, relit_count: l.relitCount })),
    shades: g.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: v3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TICK_RATE) })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: v3(c.pos), available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
    wind: { active: w.active, dir_deg: r3(w.dir_deg) },
  };
}

export { NIGHTS, angPoint };

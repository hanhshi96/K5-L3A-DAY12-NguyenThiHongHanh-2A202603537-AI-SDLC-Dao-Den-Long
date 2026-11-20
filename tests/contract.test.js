// Test Contract (v1.0 rules kept by Ticket-02 + v1.1 changes) — black-box via the headless command.
// Lines marked "P2:" were changed in Phase 2 because Ticket-02 changed the rule (see docs/spec/phase-2.md §1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet, T, contract } from './helpers.js';
import { TUNING } from '../src/sim/sim.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const named = (r, n) => r.events.filter((e) => e.name === n);

test('game.contract.json is v1.1 and mirrors the standard numbers', () => {
  assert.equal(contract.contract_version, '1.1'); // P2: was 1.0
  assert.deepEqual(contract.tuning, TUNING);
  // P2: standard numbers from Ticket-02 Part 1
  const std = { player_speed: 6, carry_capacity: 10, lantern_cost: 10, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, pulse_cooldown_s: 3, pulse_stun_s: 2, pulse_push_m: 4, safe_radius: 6,
    shade_speed: 4, shade_hit_radius: 1, invuln_s: 1.5, flames: 3, night1_duration_s: 300, night2_duration_s: 330,
    night3_duration_s: 360, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, fall_enabled: true, lantern_count_night1: 5 };
  for (const [k, v] of Object.entries(std)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('tick 0 snapshot = state after scenario, before input; night_start at tick 0', () => {
  const r = runHeadless({ ticks: 10, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(r.code, 0);
  assert.deepEqual(r.lines[0], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } }); // P2: new event
  const s0 = r.snapAt(0);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.equal(s0.time_left_s, T.night1_duration_s);
  assert.equal(s0.state, 'playing');
  assert.equal(s0.night, 1);
  assert.deepEqual(s0.lanterns.map((l) => [l.id, l.pos]), [
    ['L1', [0, 0, 25]], ['L2', [23.8, 0, 7.7]], ['L3', [14.7, 0, -20.2]], ['L4', [-14.7, 0, -20.2]], ['L5', [-23.8, 0, 7.7]]]);
});

test('--ticks N runs exactly N steps; snapshots every n from 0; end line last', () => {
  const r = runHeadless({ ticks: 25, every: 10, scenario: quiet() });
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20]);
  assert.deepEqual(r.end, { type: 'end', ticks: 25, state: 'playing', score: 0 });
  near(r.snapAt(20).time_left_s, T.night1_duration_s - 20 / 60);
  assert.equal(r.snapAt(20).sim_tick, 20);
});

test('movement: speed, normalisation, camera yaw rotation', () => {
  const fwd = runHeadless({ ticks: 60, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.deepEqual(fwd.snapAt(60).player.pos, [0, 0, T.player_speed]);
  const diag = runHeadless({ ticks: 60, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const [x, , z] = diag.snapAt(60).player.pos;
  near(Math.hypot(x, z), T.player_speed);
  near(x, z);
  const yaw = runHeadless({ ticks: 60, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  near(yaw.snapAt(60).player.pos[0], T.player_speed);
  const yaw2 = runHeadless({ ticks: 60, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 90 }] } });
  near(yaw2.snapAt(60).player.pos[2], -T.player_speed);
});

test('input frames: absent fields keep their value; input at tick k affects state k+1', () => {
  const r = runHeadless({ ticks: 30, scenario: quiet(), inputs: { frames: [
    { tick: 0, move: [0, 1] }, { tick: 10, cam_yaw_deg: 0 }, { tick: 20, move: [0, 0] }] } });
  near(r.snapAt(30).player.pos[2], T.player_speed * 20 / 60);
  const r2 = runHeadless({ ticks: 10, every: 1, scenario: quiet(), inputs: { frames: [{ tick: 5, move: [0, 1] }] } });
  assert.equal(r2.snapAt(5).player.pos[2], 0);
  near(r2.snapAt(6).player.pos[2], T.player_speed / 60);
});

test('pickup: XZ <= pickup_radius and height diff <= 1.5; no score on pickup', () => {
  const r = runHeadless({ ticks: 5, every: 1, scenario: quiet({ motes: [[T.pickup_radius, 0, 0], [0, 0, T.pickup_radius + 0.01], [0, 1.6, 0], [-0.5, 1.5, 0]] }) });
  const ev = named(r, 'mote_picked');
  assert.equal(ev.length, 2); // P2: height rule — y=1.6 is too high, y=1.5 is ok
  assert.equal(ev[0].tick, 1);
  assert.equal(r.snapAt(1).motes_active, 2);
  assert.equal(r.end.score, 0); // P2: +10 is now given on deposit, not on pickup
});

test('carry_capacity limits pickup', () => {
  const r = runHeadless({ ticks: 2, scenario: quiet({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }) });
  assert.equal(named(r, 'mote_picked').length, 0);
});

test('deposit: one lantern per press, min(carried, missing); +10 per mote deposited; lit at lantern_cost', () => {
  const sc = quiet({ player: { carried: T.carry_capacity }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius], deposited: 4 }, { id: 'L2', lit: true }] });
  const r = runHeadless({ ticks: 10, scenario: sc, inputs: { frames: [{ tick: 3, interact: true }] } });
  assert.equal(r.snapAt(0).score, 0);
  const dep = named(r, 'deposit');
  assert.equal(dep.length, 1);
  assert.equal(dep[0].tick, 4);
  assert.deepEqual(dep[0].data, { lantern_id: 'L1', amount: 6, deposited: 10 });
  assert.deepEqual(named(r, 'lantern_lit')[0].data, { lantern_id: 'L1' });
  assert.equal(r.end.score, 6 * T.score.per_mote + T.score.per_lantern); // P2
  assert.equal(r.snapAt(10).player.carried, 4);
});

test('interact: nearest unlit lantern, tie -> smaller id; out of range does nothing', () => {
  const sc = quiet({ player: { carried: 2 }, lanterns: [{ id: 'L2', pos: [1, 0, 0] }, { id: 'L1', pos: [-1, 0, 0] }] });
  const r = runHeadless({ ticks: 3, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(named(r, 'deposit')[0].data, { lantern_id: 'L1', amount: 2, deposited: 2 });
  const far = runHeadless({ ticks: 5, scenario: quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius + 0.01] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(named(far, 'deposit').length, 0);
});

test('lighting the last lantern wins with bonus', () => {
  const sc = quiet({ player: { carried: T.lantern_cost, flames: 2 }, time_left_s: 100,
    lanterns: ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })).concat([{ id: 'L1', pos: [0, 0, 1] }]) });
  const r = runHeadless({ ticks: 100, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(r.events.at(-1).data, { result: 'won', reason: 'all_lit' });
  const timeLeft = Math.floor(100 - 1 / 60);
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won',
    score: T.lantern_cost * T.score.per_mote + T.score.per_lantern + timeLeft * T.score.per_second_left + 2 * T.score.per_flame_left });
});

test('pulse: 3D radius from feet+0.8, cost, +5 per shade, push 4 m over 15 ticks, cooldown 3 s', () => {
  const sc = quiet({ player: { carried: 3 * T.pulse_cost, invuln_ticks: 400 }, shades: [ // invuln: isolate pulse from hits
    { id: 'S1', pos: [4.9, 1, 0] }, { id: 'S2', pos: [-5.1, 1, 0] }, { id: 'S3', pos: [0, 3.5, 4.5] }] });
  const r = runHeadless({ ticks: 200, every: 1, scenario: sc, inputs: { frames: [
    { tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }, { tick: 3, pulse: false },
    { tick: 180, pulse: true }] } });
  const pulses = named(r, 'pulse');
  // one tick earlier is still inside the cooldown
  const early = runHeadless({ ticks: 200, scenario: sc, inputs: { frames: [
    { tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 179, pulse: true }] } });
  assert.equal(named(early, 'pulse').length, 1);
  assert.equal(pulses.length, 2); // second press is inside the cooldown
  assert.equal(pulses[0].tick, 1);
  assert.equal(pulses[1].tick, 1 + T.pulse_cooldown_s * 60); // P2: 3 s
  assert.deepEqual(pulses[0].data, { stunned_ids: ['S1'] }); // P2: S3 is 4.5 m on XZ but 3D > 5
  const s1 = (t) => r.snapAt(t).shades.find((s) => s.id === 'S1');
  assert.equal(s1(1).state, 'stunned');
  near(s1(1).pos[0], 4.9 + T.pulse_push_m / 15); // P2: push spread over 15 ticks
  near(s1(15).pos[0], 4.9 + T.pulse_push_m);
  assert.deepEqual(s1(60).pos, s1(15).pos);
  assert.equal(r.snapAt(1).player.carried, 2 * T.pulse_cost);
  assert.equal(r.snapAt(1).score, T.score.per_stun);
});

test('pulse needs enough carried light', () => {
  const r = runHeadless({ ticks: 5, scenario: quiet({ player: { carried: T.pulse_cost - 1 }, shades: [{ pos: [1, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(named(r, 'pulse').length, 0);
});

test('stun lasts pulse_stun_s (120 ticks)', () => {
  const sc = quiet({ player: { carried: T.pulse_cost }, shades: [{ id: 'S1', pos: [2, 1, 0] }] });
  const st = T.pulse_stun_s * 60;
  const r = runHeadless({ ticks: st + 3, every: 1, scenario: sc, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(r.snapAt(st).shades[0].state, 'stunned');
  assert.notEqual(r.snapAt(st + 1).shades[0].state, 'stunned');
});

test('shade hit: -1 flame, drop floor(carried/2) as dropped motes (480 ticks), recoil, invuln 90, lose', () => {
  const sc = quiet({ player: { carried: 4, flames: 2 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] });
  const r = runHeadless({ ticks: 600, every: 1, scenario: sc });
  const hits = named(r, 'player_hit');
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 1, dropped: 2 });
  assert.ok(Math.abs(hits[0].tick - 30) <= 1, `first hit at ${hits[0].tick}`);
  const s = r.snapAt(hits[0].tick);
  assert.equal(s.shades[0].state, 'recoil'); // P2
  const dropped = s.motes.filter((m) => m.kind === 'dropped'); // P2: dropped motes stay on the ground
  assert.equal(dropped.length, 2);
  for (const m of dropped) {
    const d = Math.hypot(m.pos[0] - s.player.pos[0], m.pos[2] - s.player.pos[2]);
    assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, `drop ring ${d}`);
    assert.equal(m.ttl_s, 8);
  }
  assert.equal(s.player.invuln, true);
  assert.ok(hits[1].tick - hits[0].tick >= 90);
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.ticks, hits[1].tick);
});

test('safe zone 6 m: shades outside are blocked at the edge', () => {
  const sc = quiet({ shades: [{ id: 'S1', pos: [9, 1, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] });
  const r = runHeadless({ ticks: 300, every: 1, scenario: sc });
  for (const s of r.snaps) {
    const [x, , z] = s.shades[0].pos;
    assert.ok(Math.hypot(x, z) >= T.safe_radius - 1e-3, `tick ${s.tick} shade at ${Math.hypot(x, z)}`);
  }
  assert.equal(named(r, 'player_hit').length, 0);
});

test('safe zone: shade inside when the lantern is lit is pushed out within 30 ticks, harmless', () => {
  const sc = quiet({ player: { carried: 1 }, shades: [{ id: 'S1', pos: [1.2, 1, 0] }],
    lanterns: [{ id: 'L1', pos: [0, 0, 0.5], deposited: T.lantern_cost - 1 }] });
  const r = runHeadless({ ticks: 60, every: 1, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(named(r, 'lantern_lit')[0].tick, 1);
  const s = r.snapAt(31).shades[0].pos;
  assert.ok(Math.hypot(s[0], s[2] - 0.5) >= T.safe_radius - 1e-3);
  assert.equal(named(r, 'player_hit').length, 0);
});

test('dawn: time runs out -> lost/dawn', () => {
  const r = runHeadless({ ticks: 1000, scenario: quiet({ time_left_s: 2 }) });
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 120, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 120, state: 'lost', score: 0 });
});

test('determinism: same seed/scenario/inputs -> identical output', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1] }, { tick: 300, move: [-1, 0], pulse: true }, { tick: 301, pulse: false }] };
  for (const night of [1, 2, 3]) {
    const extra = ['--night', String(night)];
    const a = runHeadless({ seed: 42, ticks: 3000, inputs, extraArgs: extra });
    const b = runHeadless({ seed: 42, ticks: 3000, inputs, extraArgs: extra });
    assert.equal(a.code, 0);
    assert.equal(a.text, b.text);
    assert.notEqual(a.text, runHeadless({ seed: 43, ticks: 3000, inputs, extraArgs: extra }).text);
  }
});

test('Night 1 standard spawns: 20 motes at 20 distinct points; 2 shades at tick 300 then every 480', () => {
  const r = runHeadless({ seed: 3, ticks: 1800, scenario: { player: { flames: 99 } } });
  const m0 = r.snapAt(0).motes;
  assert.equal(m0.length, 20); // P2
  assert.equal(new Set(m0.map((m) => m.pos.join())).size, 20);
  assert.ok(m0.every((m) => m.kind === 'random' && m.ttl_s === null));
  assert.deepEqual(named(r, 'shade_spawned').map((e) => [e.tick, e.data.id]),
    [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4'], [1740, 'S5']]); // P2
  assert.equal(r.snapAt(300).shades[0].state, 'spawning'); // P2: v1.1 state names
  assert.equal(r.snapAt(240).motes.filter((m) => m.kind === 'random').length, 21);
});

test('scenario shades without id get unique ids; lanterns updated by id', () => {
  const r = runHeadless({ ticks: 0, scenario: quiet({ shades: [{ pos: [20, 1, 0] }, { id: 'S1', pos: [-20, 1, 0] }], lanterns: [{ id: 'L3', pos: [1, 0, 2] }] }) });
  const ids = r.snapAt(0).shades.map((s) => s.id);
  assert.equal(new Set(ids).size, 2);
  assert.deepEqual(r.snapAt(0).lanterns[2].pos, [1, 0, 2]);
});

test('malformed inputs/scenario -> exit code 2 with stderr', () => {
  const bad = [
    { rawInputs: '{not json' },
    { inputs: { frames: [{ tick: 5 }, { tick: 5 }] } },
    { inputs: { frames: [{ tick: 3 }, { tick: 1 }] } },
    { inputs: { frames: [{ tick: 0, move: [2, 0] }] } },
    { inputs: { frames: [{ tick: 0, pause: 'yes' }] } },
    { inputs: { nope: [] } },
    { rawScenario: '[]' },
    { scenario: { lanterns: [{ id: 'L9' }] } },
    { scenario: { lanterns: [{ id: 'L6' }] } }, // Night 1 has only L1..L5
    { scenario: { player: { pos: [0, 0] } } },
    { scenario: { shades: [{ pos: [1, 1, 1], state: 'dancing' }] } },
  ];
  for (const b of bad) {
    const r = runHeadless({ ticks: 5, ...b });
    assert.equal(r.code, 2, JSON.stringify(b));
    assert.ok(r.stderr.length > 0);
  }
  assert.notEqual(runHeadless({ ticks: 5, extraArgs: ['--night', '7'] }).code, 0);
});

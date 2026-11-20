// Test Contract v1.0 — black-box tests through the headless command.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet, T, contract } from './helpers.js';
import { TUNING } from '../src/sim/sim.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('game.contract.json tuning mirrors the numbers the game uses', () => {
  assert.equal(contract.contract_version, '1.0');
  assert.deepEqual(contract.tuning, TUNING);
  assert.equal(T.lantern_count_night1, 5);
});

test('tick 0 snapshot = state after scenario, before input; player starts at origin', () => {
  const r = runHeadless({ ticks: 10, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(r.code, 0);
  const s0 = r.snapAt(0);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.equal(s0.time_left_s, T.night1_duration_s);
  assert.equal(s0.state, 'playing');
  assert.equal(s0.lanterns.length, 5);
  assert.deepEqual(s0.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
});

test('--ticks N runs exactly N steps; snapshots every n from 0; end line last', () => {
  const r = runHeadless({ ticks: 25, every: 10, scenario: quiet() });
  assert.deepEqual(r.snaps.map((s) => s.tick), [0, 10, 20]);
  assert.deepEqual(r.end, { type: 'end', ticks: 25, state: 'playing', score: 0 });
  near(r.snapAt(20).time_left_s, T.night1_duration_s - 20 / 60);
  assert.equal(r.snapAt(20).sim_tick, 20);
  const def = runHeadless({ ticks: 20, scenario: quiet() });
  assert.deepEqual(def.snaps.map((s) => s.tick), [0, 10, 20]);
});

test('movement: speed, normalisation, camera yaw rotation', () => {
  const fwd = runHeadless({ ticks: 60, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.deepEqual(fwd.snapAt(60).player.pos, [0, 0, T.player_speed]);
  const diag = runHeadless({ ticks: 60, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const [x, , z] = diag.snapAt(60).player.pos;
  near(Math.hypot(x, z), T.player_speed);
  near(x, z);
  // yaw 90: move [0,1] -> x' = sin90 = +1 -> +X
  const yaw = runHeadless({ ticks: 60, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] } });
  const p = yaw.snapAt(60).player.pos;
  near(p[0], T.player_speed); near(p[2], 0);
  // yaw 90: move [1,0] -> z' = -sin90 = -1 -> -Z
  const yaw2 = runHeadless({ ticks: 60, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 90 }] } });
  near(yaw2.snapAt(60).player.pos[2], -T.player_speed);
});

test('input frames: absent fields keep their value; input at tick k affects state k+1', () => {
  const r = runHeadless({ ticks: 30, scenario: quiet(), inputs: { frames: [
    { tick: 0, move: [0, 1] }, { tick: 10, cam_yaw_deg: 0 }, { tick: 20, move: [0, 0] },
  ] } });
  near(r.snapAt(20).player.pos[2], T.player_speed * 20 / 60);
  near(r.snapAt(30).player.pos[2], T.player_speed * 20 / 60);
  const r2 = runHeadless({ ticks: 10, every: 1, scenario: quiet(), inputs: { frames: [{ tick: 5, move: [0, 1] }] } });
  assert.equal(r2.snapAt(5).player.pos[2], 0);
  near(r2.snapAt(6).player.pos[2], T.player_speed / 60);
});

test('pickup within pickup_radius (<= r), event tick = k+1, score per_mote', () => {
  const r = runHeadless({ ticks: 5, every: 1, scenario: quiet({ motes: [[T.pickup_radius, 0, 0], [0, 0, T.pickup_radius + 0.01]] }) });
  const ev = r.events.filter((e) => e.name === 'mote_picked');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tick, 1);
  assert.deepEqual(ev[0].data, { carried: 1 });
  assert.equal(r.snapAt(0).motes_active, 2);
  assert.equal(r.snapAt(1).motes_active, 1);
  assert.equal(r.end.score, T.score.per_mote);
});

test('carry_capacity limits pickup', () => {
  const r = runHeadless({ ticks: 2, scenario: quiet({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }) });
  assert.equal(r.events.length, 0);
});

test('deposit on interact rising edge; lantern lit after lantern_cost; setup gives no score', () => {
  const sc = quiet({ player: { carried: T.lantern_cost + 1 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius] }, { id: 'L2', lit: true }] });
  const r = runHeadless({ ticks: 10, scenario: sc, inputs: { frames: [{ tick: 3, interact: true }] } });
  assert.equal(r.snapAt(0).score, 0);
  const dep = r.events.find((e) => e.name === 'deposit');
  assert.equal(dep.tick, 4);
  assert.deepEqual(dep.data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.deepEqual(r.events.find((e) => e.name === 'lantern_lit').data, { lantern_id: 'L1' });
  assert.equal(r.end.score, T.score.per_lantern);
  assert.equal(r.snapAt(10).player.carried, 1);
  // holding interact does not deposit again
  assert.equal(r.events.filter((e) => e.name === 'deposit').length, 1);
});

test('partial deposit, then out of range does nothing', () => {
  const sc = quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] });
  const r = runHeadless({ ticks: 5, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(r.events.map((e) => e.name), ['deposit']);
  assert.equal(r.snapAt(0).lanterns[0].deposited, 0);
  const far = runHeadless({ ticks: 5, scenario: quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius + 0.1] }] }),
    inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(far.events.length, 0);
});

test('lighting the last lantern wins with bonus', () => {
  const sc = quiet({ player: { carried: T.lantern_cost, flames: 2 }, time_left_s: 100,
    lanterns: ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })).concat([{ id: 'L1', pos: [0, 0, 1] }]) });
  const r = runHeadless({ ticks: 100, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(r.events.at(-1).data, { result: 'won', reason: 'all_lit' });
  const timeLeft = Math.floor(100 - 1 / 60);
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won',
    score: T.score.per_lantern + timeLeft * T.score.per_second_left + 2 * T.score.per_flame_left });
});

test('pulse: costs light, stuns & pushes shades within pulse_radius, scores per_stun, cooldown', () => {
  const sc = quiet({ player: { carried: 3 * T.pulse_cost }, shades: [
    { id: 'A', pos: [T.pulse_radius, 1, 0] }, { id: 'B', pos: [-(T.pulse_radius + 0.5), 1, 0] }] });
  const r = runHeadless({ ticks: 70, every: 1, scenario: sc, inputs: { frames: [
    { tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }, { tick: 3, pulse: false },
    { tick: 60, pulse: true }] } });
  const pulses = r.events.filter((e) => e.name === 'pulse');
  assert.equal(pulses.length, 2); // second press inside cooldown is ignored
  assert.equal(pulses[0].tick, 1);
  assert.equal(pulses[1].tick, 1 + T.pulse_cooldown_s * 60);
  assert.deepEqual(pulses[0].data, { stunned_ids: ['A'] });
  const a = r.snapAt(1).shades.find((s) => s.id === 'A');
  assert.equal(a.state, 'stunned');
  near(a.pos[0], T.pulse_radius + T.pulse_push_m);
  assert.equal(r.snapAt(1).player.carried, 2 * T.pulse_cost);
  assert.equal(r.snapAt(1).score, T.score.per_stun);
});

test('pulse needs enough carried light', () => {
  const r = runHeadless({ ticks: 5, scenario: quiet({ player: { carried: T.pulse_cost - 1 }, shades: [{ pos: [1, 1, 0] }] }),
    inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(r.events.filter((e) => e.name === 'pulse').length, 0);
});

test('stun lasts pulse_stun_s', () => {
  const sc = quiet({ player: { carried: T.pulse_cost }, shades: [{ id: 'S1', pos: [2, 1, 0] }] });
  const st = T.pulse_stun_s * 60;
  const r = runHeadless({ ticks: st + 3, every: 1, scenario: sc, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(r.snapAt(st).shades[0].state, 'stunned');
  assert.deepEqual(r.snapAt(st).shades[0].pos, r.snapAt(1).shades[0].pos);
  assert.notEqual(r.snapAt(st + 1).shades[0].state, 'stunned');
});

test('shade chases and hits: flames-1, drop ratio, invulnerability, lose on no_flames', () => {
  const sc = quiet({ player: { carried: 4, flames: 2 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] });
  const r = runHeadless({ ticks: 600, every: 1, scenario: sc });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0].data, { by: 'shade', flames: 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
  assert.ok(hits[1].tick - hits[0].tick >= T.invuln_s * 60);
  assert.ok(hits[1].tick - hits[0].tick <= T.invuln_s * 60 + 1);
  // first hit tick: shade must travel (3 - hit_radius) at shade_speed
  const expected = Math.ceil(((3 - T.shade_hit_radius) / T.shade_speed) * 60 - 1e-9);
  assert.equal(hits[0].tick, expected);
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.state, 'lost');
  assert.equal(r.end.ticks, hits[1].tick);
});

test('shades never enter safe_radius of a lit lantern', () => {
  const sc = quiet({ shades: [{ id: 'S1', pos: [8, 1, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] });
  const r = runHeadless({ ticks: 300, every: 1, scenario: sc });
  for (const s of r.snaps) {
    const [x, , z] = s.shades[0].pos;
    assert.ok(Math.hypot(x, z) > T.safe_radius, `tick ${s.tick} shade at ${Math.hypot(x, z)}`);
  }
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('dawn: time runs out -> lost/dawn', () => {
  const r = runHeadless({ ticks: 1000, scenario: quiet({ time_left_s: 2 }) });
  assert.deepEqual(r.events.at(-1), { type: 'event', tick: 120, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 120, state: 'lost', score: 0 });
});

test('determinism: same seed/scenario/inputs -> identical output; random world spawns ids', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1] }, { tick: 300, move: [-1, 0], pulse: true }, { tick: 301, pulse: false }] };
  const a = runHeadless({ seed: 42, ticks: 3000, inputs });
  const b = runHeadless({ seed: 42, ticks: 3000, inputs });
  assert.equal(a.code, 0);
  assert.equal(a.text, b.text);
  const c = runHeadless({ seed: 43, ticks: 3000, inputs });
  assert.notEqual(a.text, c.text);
  assert.ok(a.snapAt(0).motes_active > 0);
  assert.ok(a.snapAt(0).shades.length > 0);
});

test('random_shades spawns emit shade_spawned', () => {
  const r = runHeadless({ seed: 3, ticks: 30 * 60, scenario: { random_motes: false, shades: [], player: { flames: 99 } } });
  assert.deepEqual(r.events.filter((e) => e.name === 'shade_spawned').map((e) => e.tick), [1800]);
});

test('scenario shades without id get unique ids; lanterns updated by id', () => {
  const r = runHeadless({ ticks: 0, scenario: quiet({ shades: [{ pos: [20, 1, 0] }, { id: 'S1', pos: [-20, 1, 0] }], lanterns: [{ id: 'L3', pos: [1, 0, 2] }] }) });
  const ids = r.snapAt(0).shades.map((s) => s.id);
  assert.equal(new Set(ids).size, 2);
  assert.ok(ids.includes('S1'));
  assert.deepEqual(r.snapAt(0).lanterns[2].pos, [1, 0, 2]);
  assert.deepEqual(r.end, { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('malformed inputs/scenario -> exit code 2 with stderr', () => {
  const bad = [
    { rawInputs: '{not json' },
    { inputs: { frames: [{ tick: 5 }, { tick: 5 }] } },
    { inputs: { frames: [{ tick: 3 }, { tick: 1 }] } },
    { inputs: { frames: [{ tick: 0, move: [2, 0] }] } },
    { inputs: { frames: [{ tick: 0, pulse: 'yes' }] } },
    { inputs: { nope: [] } },
    { rawScenario: '[]' },
    { scenario: { lanterns: [{ id: 'L9' }] } },
    { scenario: { player: { pos: [0, 0] } } },
  ];
  for (const b of bad) {
    const r = runHeadless({ ticks: 5, ...b });
    assert.equal(r.code, 2, JSON.stringify(b));
    assert.ok(r.stderr.length > 0);
  }
  assert.notEqual(runHeadless({ ticks: 5, extraArgs: ['--night', '7'] }).code, 0);
});

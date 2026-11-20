// Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2). See docs/adr/0001-lantern-fuel-and-dawn-win.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet } from './helpers.js';

const named = (r, n) => r.events.filter((e) => e.name === n);
const L = (r, t, id = 'L1') => r.snapAt(t).lanterns.find((l) => l.id === id);

test('fuel: lit lantern starts at 100 (scenario default), decays 1/s exactly; snapshot fields', () => {
  const r = runHeadless({ ticks: 600, every: 60, scenario: quiet({ lanterns: [{ id: 'L1', lit: true }] }) });
  assert.deepEqual(L(r, 0), { id: 'L1', pos: [0, 0, 25], lit: true, deposited: 10, fuel: 100, ever_lit: true, relit_count: 0 });
  assert.equal(L(r, 60).fuel, 99);
  assert.equal(L(r, 600).fuel, 90); // integer 1/60 units: no drift
  assert.deepEqual(L(r, 0, 'L2'), { id: 'L2', pos: [23.8, 0, 7.7], lit: false, deposited: 0, fuel: 0, ever_lit: false, relit_count: 0 });
});

test('fuel <= 0: lantern goes out (lantern_out), deposited = 0, ever_lit stays true', () => {
  const r = runHeadless({ ticks: 80, every: 1, scenario: quiet({ lanterns: [{ id: 'L1', lit: true, fuel: 1 }] }) });
  assert.deepEqual(named(r, 'lantern_out'), [{ type: 'event', tick: 60, name: 'lantern_out', data: { lantern_id: 'L1' } }]);
  assert.equal(L(r, 59).lit, true);
  assert.deepEqual(L(r, 60), { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
});

test('refuel: used = min(carried, ceil((100 - fuel)/10)), +10 fuel and +5 score per mote', () => {
  const sc = quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] });
  const r = runHeadless({ ticks: 5, every: 1, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(named(r, 'refuel')[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 });
  assert.equal(r.snapAt(1).player.carried, 5);
  assert.equal(r.end.score, 25);
  const one = runHeadless({ ticks: 3, scenario: quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 95 }] }),
    inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(named(one, 'refuel')[0].data, { lantern_id: 'L1', amount: 1, fuel: 100 });
});

test('relight: ever_lit lantern needs only 5 motes, +40, relit_count, lantern_lit relight:true', () => {
  const sc = quiet({ player: { carried: 7 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], ever_lit: true }] });
  const r = runHeadless({ ticks: 3, every: 1, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(named(r, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(named(r, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.equal(L(r, 1).relit_count, 1);
  assert.equal(L(r, 1).fuel, 100);
  assert.equal(r.end.score, 5 * 5 + 40);
  assert.equal(r.snapAt(1).player.carried, 2);
});

test('capacity = 10 + 2 x successful lights (incl. relights, not scenario-preset), max 20', () => {
  const sc = quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }, { id: 'L2', lit: true }] });
  const r = runHeadless({ ticks: 3, every: 1, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(r.snapAt(0).player.capacity, 10);
  assert.equal(r.snapAt(1).player.capacity, 12);
  const max = runHeadless({ ticks: 0, scenario: quiet({ player: { successful_lights: 9 } }) });
  assert.equal(max.snapAt(0).player.capacity, 20);
  const pick = runHeadless({ ticks: 2, scenario: quiet({ player: { carried: 12, successful_lights: 1 }, motes: [[0, 0, 0], [0.5, 0, 0]] }) });
  assert.equal(named(pick, 'mote_picked').length, 0); // 12/12
});

test('weak lantern (fuel < 30): no safe zone; wandering shade goes there, drains 5/s (+1/s decay), fuel_drain every 60 ticks', () => {
  const sc = quiet({ player: { pos: [0, 0, -20] }, shades: [{ id: 'S1', pos: [8, 1, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 29 }] });
  const r = runHeadless({ ticks: 500, every: 1, scenario: sc });
  const t0 = r.snaps.find((s) => s.shades[0].state === 'drain').tick;
  assert.ok(t0 >= 88 && t0 <= 92, `drain at ${t0}`);
  const s = r.snapAt(t0).shades[0].pos;
  assert.ok(Math.hypot(s[0], s[2]) <= 2 + 1e-3);
  const f0 = L(r, t0).fuel, f60 = L(r, t0 + 60).fuel;
  assert.ok(Math.abs(f0 - f60 - 6) < 0.11, `drained ${f0 - f60}`);
  const ev = named(r, 'fuel_drain');
  assert.equal(ev[0].tick, t0 + 60);
  assert.deepEqual(Object.keys(ev[0].data), ['lantern_id', 'shade_id', 'fuel']);
  assert.equal(ev[0].data.shade_id, 'S1');
  const out = named(r, 'lantern_out')[0];
  assert.ok(out, 'lantern went out');
  assert.equal(r.snapAt(out.tick + 1).shades[0].state, 'wander');
  assert.equal(named(r, 'player_hit').length, 0);
});

test('fuel exactly 30 keeps the safe zone (shade blocked at 6 m)', () => {
  const sc = quiet({ player: { pos: [0, 0, 1] }, shades: [{ id: 'S1', pos: [9, 1, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 31 }] });
  const r = runHeadless({ ticks: 60, every: 1, scenario: sc });
  for (const s of r.snaps) assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2]) >= 6 - 1e-3, `t${s.tick}`);
  assert.equal(L(r, 60).fuel, 30);
});

test('drain -> chase when Mây within 6 m; pulse on a draining shade scores +15', () => {
  const base = { shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'drain', target_lantern_id: 'L1' }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }] };
  const c = runHeadless({ ticks: 1, every: 1, scenario: quiet({ ...base, player: { pos: [6, 0, 0], invuln_ticks: 99 } }) });
  assert.equal(c.snapAt(1).shades[0].state, 'chase');
  const p = runHeadless({ ticks: 1, every: 1, scenario: quiet({ ...base, player: { pos: [4, 0, 0], carried: 3, invuln_ticks: 99 } }), inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(p.snapAt(1).shades[0].state, 'stunned');
  assert.equal(p.end.score, 15);
});

test('refuel to >= 30 pushes a draining shade out within 30 ticks, harmless, back to wander', () => {
  const sc = quiet({ player: { pos: [-1.5, 0, 0], carried: 2, invuln_ticks: 0 }, shades: [{ id: 'S1', pos: [1.5, 1, 0], state: 'drain', target_lantern_id: 'L1' }],
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }] });
  const r = runHeadless({ ticks: 40, every: 1, scenario: sc, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(named(r, 'refuel')[0].data.fuel, 39.9); // step 2 decay+drain (20 - 6/60) happens before interact (step 5)
  assert.equal(r.snapAt(1).shades[0].state, 'wander');
  const s = r.snapAt(31).shades[0].pos;
  assert.ok(Math.hypot(s[0], s[2]) >= 6 - 1e-3);
  assert.equal(named(r, 'player_hit').length, 0);
});

test('win: alive at dawn with lit >= ceil(0.6 x total) -> won/dawn_survived; bonus 50 + floor(fuel) per lit lantern + 50 per flame', () => {
  const lit = (ids, fuel) => ids.map((id) => ({ id, lit: true, fuel }));
  const w = runHeadless({ ticks: 100, scenario: quiet({ time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3'], 50) }) });
  assert.deepEqual(w.events.at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } });
  assert.equal(w.end.score, 3 * (50 + 49) + 3 * 50);
  const l = runHeadless({ ticks: 100, scenario: quiet({ time_left_s: 1, lanterns: lit(['L1', 'L2'], 50) }) });
  assert.deepEqual(l.events.at(-1).data, { result: 'lost', reason: 'dawn' });
  assert.equal(l.end.score, 0);
  const n3ok = runHeadless({ ticks: 100, extraArgs: ['--night', '3'], scenario: quiet({ time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3', 'L4', 'L5'], 80) }) });
  assert.equal(n3ok.end.state, 'won');
  const n3no = runHeadless({ ticks: 100, extraArgs: ['--night', '3'], scenario: quiet({ time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3', 'L4'], 80) }) });
  assert.equal(n3no.end.state, 'lost');
});

test('no flames always loses first, even on the dawn tick', () => {
  const r = runHeadless({ ticks: 10, scenario: quiet({ time_left_s: 1 / 60, player: { flames: 0 }, lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true })) }) });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
});

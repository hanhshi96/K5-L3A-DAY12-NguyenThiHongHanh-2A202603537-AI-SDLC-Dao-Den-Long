// Phase 2: Night 2 / Night 3 maps, jump pads, floors, wind, drifters (Gió Lạc). See docs/spec/phase-2.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet } from './helpers.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const named = (r, n) => r.events.filter((e) => e.name === n);
const night = (n) => ['--night', String(n)];

// ---------- C3: maps ----------
test('Night 2/3 setup: lanterns, durations, start, night field, night_start', () => {
  const n2 = runHeadless({ ticks: 0, extraArgs: night(2) });
  const s2 = n2.snapAt(0);
  assert.deepEqual(n2.lines[0].data, { night: 2 });
  assert.equal(s2.night, 2);
  assert.equal(s2.time_left_s, 330);
  assert.deepEqual(s2.lanterns.map((l) => [l.id, l.pos]), [
    ['L1', [0, 0, 20]], ['L2', [17, 0, -10]], ['L3', [-17, 0, -10]], ['L4', [70, 0, 20]], ['L5', [87, 0, -10]], ['L6', [53, 0, -10]]]);
  const s3 = runHeadless({ ticks: 0, extraArgs: night(3) }).snapAt(0);
  assert.equal(s3.time_left_s, 360);
  assert.deepEqual(s3.player.pos, [0, 0, -30]); // spec G11
  assert.deepEqual(s3.lanterns.map((l) => l.pos), [
    [0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]);
});

test('initial motes: 20 distinct standard spawn points (Night 2 islands, Night 3 floors)', () => {
  const s2 = runHeadless({ seed: 9, ticks: 0, extraArgs: night(2) }).snapAt(0);
  assert.equal(s2.motes.length, 20);
  for (const m of s2.motes) {
    const r = Math.min(Math.hypot(m.pos[0], m.pos[2]), Math.hypot(m.pos[0] - 70, m.pos[2]));
    assert.ok([10, 22].some((R) => Math.abs(r - R) < 1e-2), `N2 mote r=${r}`);
  }
  const s3 = runHeadless({ seed: 9, ticks: 0, extraArgs: night(3) }).snapAt(0);
  for (const m of s3.motes) {
    const r = Math.hypot(m.pos[0], m.pos[2]);
    const ok = (Math.abs(r - 34) < 1e-2 && m.pos[1] === 0) || (Math.abs(r - 18) < 1e-2 && m.pos[1] === 3) || (Math.abs(r - 5) < 1e-2 && m.pos[1] === 6);
    assert.ok(ok, `N3 mote ${m.pos}`);
  }
});

test('shade schedule: Night 2 every 7 s (max 8), Night 3 every 6 s (max 10)', () => {
  const sc = { random_motes: false, random_drifters: false, player: { flames: 99 } };
  const n2 = runHeadless({ seed: 2, ticks: 1200, scenario: sc, extraArgs: night(2) });
  assert.deepEqual(named(n2, 'shade_spawned').map((e) => e.tick), [300, 300, 720, 1140]);
  const n3 = runHeadless({ seed: 2, ticks: 1100, scenario: sc, extraArgs: night(3) });
  assert.deepEqual(named(n3, 'shade_spawned').map((e) => e.tick), [300, 300, 660, 1020]);
});

test('Night 3 shades move at 4.5 m/s', () => {
  const r = runHeadless({ ticks: 30, every: 1, extraArgs: night(3), scenario: quiet({ shades: [{ id: 'S1', pos: [8, 1, -30] }] }) });
  near(r.snapAt(30).shades[0].pos[0], 8 - 4.5 * 30 / 60);
});

test('Night 2 bridge: walk across from A to B; stepping off the bridge falls', () => {
  const r = runHeadless({ ticks: 200, every: 1, extraArgs: night(2), scenario: quiet({ player: { pos: [24, 0, 0] } }),
    inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 40, move: [0, 0] }] } });
  assert.deepEqual(r.snapAt(40).player.pos, [28, 0, 0]);
  assert.equal(named(r, 'player_hit').length, 0);
  const across = runHeadless({ ticks: 330, every: 10, extraArgs: night(2), scenario: quiet({ player: { pos: [24, 0, 0] } }),
    inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 320, move: [0, 0] }] } });
  assert.deepEqual(across.snapAt(330).player.pos, [56, 0, 0]);
  assert.equal(across.snapAt(330).player.grounded, true);
  const off = runHeadless({ ticks: 200, extraArgs: night(2), scenario: quiet({ player: { pos: [35, 0, 0] } }),
    inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(named(off, 'player_hit')[0].data.by, 'fall');
});

test('Night 2 jump pad: launched towards the other island, lands there after ~1.4 s', () => {
  const r = runHeadless({ ticks: 120, every: 1, extraArgs: night(2), scenario: quiet({ player: { pos: [20, 0, 18] } }) });
  const s1 = r.snapAt(1);
  assert.equal(s1.player.grounded, false);
  near(Math.hypot(s1.player.vel[0], s1.player.vel[2]), 24);
  const land = r.snaps.find((s) => s.tick > 1 && s.player.grounded);
  assert.ok(land.tick >= 80 && land.tick <= 90, `landed at ${land.tick}`);
  const p = land.player.pos;
  assert.ok(Math.hypot(p[0] - 70, p[2]) <= 28, `landed at ${p}`);
  assert.equal(named(r, 'player_hit').length, 0);
});

test('Night 3: floor 1 edge is a wall; ramp leads up to Y=3; jump pad reaches floor 2 (Y=6)', () => {
  const wall = runHeadless({ ticks: 60, extraArgs: night(3), scenario: quiet({ player: { pos: [0, 0, 27] } }),
    inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
  const pw = wall.snapAt(60).player.pos;
  assert.ok(pw[2] > 24 && pw[1] === 0, `wall ${pw}`);
  const a = Math.PI / 6; // ramp at 30°
  const ramp = runHeadless({ ticks: 120, extraArgs: night(3), scenario: quiet({ player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }),
    inputs: { frames: [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }] } });
  const pr = ramp.snapAt(120).player;
  assert.equal(pr.pos[1], 3);
  assert.equal(pr.grounded, true);
  const pad = runHeadless({ ticks: 90, every: 1, extraArgs: night(3), scenario: quiet({ player: { pos: [0, 3, 13] } }) });
  const land = pad.snaps.find((s) => s.tick > 1 && s.player.grounded);
  assert.equal(land.player.pos[1], 6);
  assert.ok(Math.hypot(land.player.pos[0], land.player.pos[2]) <= 8);
});

test('Night 3 wind: gust every 30 s for 5 s pushes 2 m/s in dir_deg; wind_enabled:false disables it', () => {
  const r = runHeadless({ seed: 4, ticks: 2100, every: 1, extraArgs: night(3), scenario: quiet({ player: { flames: 9 } }) });
  assert.equal(r.snapAt(1799).wind.active, false);
  const w = r.snapAt(1800).wind;
  assert.equal(w.active, true);
  assert.equal(r.snapAt(2100).wind.active, false);
  const p0 = r.snapAt(1799).player.pos, p1 = r.snapAt(2099).player.pos;
  const a = (w.dir_deg * Math.PI) / 180;
  near(p1[0] - p0[0], 2 * 5 * Math.cos(a), 0.05);
  near(p1[2] - p0[2], 2 * 5 * Math.sin(a), 0.05);
  const off = runHeadless({ seed: 4, ticks: 2100, extraArgs: night(3), scenario: quiet({ wind_enabled: false }) });
  assert.deepEqual(off.end.ticks, 2100);
  assert.deepEqual(off.snaps.at(-1).player.pos, [0, 0, -30]);
  assert.equal(runHeadless({ ticks: 1900, scenario: quiet() }).snapAt(1800).wind.active, false); // Night 1: no wind
});

// ---------- F1: drifters (Gió Lạc) ----------
test('drifters spawn at ticks 1200, 2400 with ids D1, D2 (Night 2/3 only)', () => {
  const sc = { random_motes: false, random_shades: false, player: { flames: 9 } };
  const r = runHeadless({ seed: 1, ticks: 2400, extraArgs: night(2), scenario: sc });
  assert.equal(r.snapAt(1190).drifters.length, 0);
  assert.deepEqual(r.snapAt(1200).drifters.map((d) => [d.id, d.state, d.stolen]), [['D1', 'idle', 0]]);
  assert.deepEqual(r.snapAt(2400).drifters.map((d) => d.id), ['D1', 'D2']);
  assert.equal(runHeadless({ ticks: 1300, scenario: sc }).snapAt(1300).drifters.length, 0);
});

test('drifter: idle -> chase (carried >= 5, <= 15 m), steals min(3, carried) despite invuln, flees 240 ticks, removed', () => {
  const sc = quiet({ player: { carried: 6, invuln_ticks: 1000 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] });
  const r = runHeadless({ ticks: 400, every: 1, extraArgs: night(2), scenario: sc });
  assert.equal(r.snapAt(1).drifters[0].state, 'chase');
  const steal = named(r, 'drifter_steal');
  assert.equal(steal.length, 1);
  assert.deepEqual(steal[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.ok(Math.abs(steal[0].tick - 76) <= 1, `steal at ${steal[0].tick}`);
  const t = steal[0].tick;
  assert.deepEqual([r.snapAt(t).drifters[0].state, r.snapAt(t).drifters[0].stolen], ['flee', 3]);
  assert.equal(r.snapAt(t + 239).drifters[0].state, 'flee');
  assert.equal(r.snapAt(t + 240).drifters[0].state, 'removed');
  assert.equal(r.snapAt(t + 1).player.flames, 3); // drifters never cost flames
});

test('drifter stays idle when carried < 5', () => {
  const r = runHeadless({ ticks: 60, extraArgs: night(2), scenario: quiet({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }) });
  assert.equal(r.snapAt(60).drifters[0].state, 'idle');
  assert.equal(named(r, 'drifter_steal').length, 0);
});

test('pulse on a chasing drifter -> flee without stealing', () => {
  const sc = quiet({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0], state: 'chase' }] });
  const r = runHeadless({ ticks: 260, every: 1, extraArgs: night(2), scenario: sc, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(r.snapAt(1).drifters[0].state, 'flee');
  assert.equal(named(r, 'drifter_steal').length, 0);
  assert.equal(r.snapAt(241).drifters[0].state, 'removed');
});

test('pulse on a fleeing drifter with loot -> drifter_drop, loot becomes dropped motes, removed after 120 ticks', () => {
  const sc = quiet({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] });
  const r = runHeadless({ ticks: 130, every: 1, extraArgs: night(2), scenario: sc, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.deepEqual(named(r, 'drifter_drop')[0], { type: 'event', tick: 1, name: 'drifter_drop', data: { drifter_id: 'D1', amount: 3 } });
  assert.equal(r.snapAt(1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(r.snapAt(1).drifters[0].stolen, 0);
  assert.equal(r.snapAt(120).drifters[0].state, 'flee');
  assert.equal(r.snapAt(121).drifters[0].state, 'removed');
});

test('drifters are not blocked by lantern safe zones', () => {
  const sc = quiet({ player: { carried: 6 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], drifters: [{ id: 'D1', pos: [8, 1.5, 0] }] });
  const r = runHeadless({ ticks: 120, extraArgs: night(2), scenario: sc });
  assert.equal(named(r, 'drifter_steal').length, 1);
});

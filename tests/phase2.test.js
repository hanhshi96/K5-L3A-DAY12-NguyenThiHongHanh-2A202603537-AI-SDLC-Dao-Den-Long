// Phase 2 (Ticket-02) features — one or more headless scenarios per feature. See docs/spec/phase-2.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet, T } from './helpers.js';

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const named = (r, n) => r.events.filter((e) => e.name === n);
const night = (n) => ['--night', String(n)];

// ---------- C2: dash ----------
test('dash: 14 m/s for 12 ticks along move direction, event dash {}', () => {
  const r = runHeadless({ ticks: 20, every: 1, scenario: quiet(), inputs: { frames: [{ tick: 0, move: [0, 1], dash: true }] } });
  assert.deepEqual(named(r, 'dash'), [{ type: 'event', tick: 1, name: 'dash', data: {} }]);
  near(r.snapAt(12).player.pos[2], 12 * T.dash_speed / 60); // 2.8 m
  near(r.snapAt(13).player.pos[2], 12 * T.dash_speed / 60 + T.player_speed / 60);
});

test('dash: standing still uses facing direction (initially +Z, then last move direction)', () => {
  const still = runHeadless({ ticks: 12, scenario: quiet(), inputs: { frames: [{ tick: 0, dash: true }] } });
  assert.deepEqual(still.end.ticks, 12);
  const r = runHeadless({ ticks: 40, every: 1, scenario: quiet(), inputs: { frames: [
    { tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }, { tick: 20, dash: true }] } });
  const x0 = r.snapAt(20).player.pos[0];
  near(r.snapAt(32).player.pos[0] - x0, 2.8);
  near(r.snapAt(32).player.pos[2], 0);
});

test('dash cooldown 1.5 s from the start of the dash', () => {
  const ok = runHeadless({ ticks: 100, scenario: quiet(), inputs: { frames: [
    { tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 90, dash: true }] } });
  assert.deepEqual(named(ok, 'dash').map((e) => e.tick), [1, 91]);
  const early = runHeadless({ ticks: 100, scenario: quiet(), inputs: { frames: [
    { tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 89, dash: true }] } });
  assert.deepEqual(named(early, 'dash').map((e) => e.tick), [1]);
  assert.equal(ok.snapAt(10).player.dash_cd_s, 1.35);
});

test('dash in the air keeps altitude', () => {
  const r = runHeadless({ ticks: 40, every: 1, scenario: quiet(), inputs: { frames: [
    { tick: 0, jump: true }, { tick: 10, dash: true, move: [0, 1] }] } });
  const y10 = r.snapAt(10).player.pos[1];
  assert.ok(y10 > 0.5);
  for (let t = 11; t <= 22; t++) assert.equal(r.snapAt(t).player.pos[1], y10, `tick ${t}`);
  // after the dash the previous vertical motion resumes (spec G3)
  assert.notEqual(r.snapAt(24).player.pos[1], y10);
});

// ---------- jump (standard numbers) ----------
test('jump: 7 m/s, gravity 20 (apex ~1.225 m), only when grounded, lands again', () => {
  const r = runHeadless({ ticks: 60, every: 1, scenario: quiet(), inputs: { frames: [
    { tick: 0, jump: true }, { tick: 5, jump: false }, { tick: 6, jump: true }] } });
  near(r.snapAt(1).player.vel[1], 7 - 20 / 60);
  assert.equal(r.snapAt(1).player.grounded, false);
  const maxY = Math.max(...r.snaps.map((s) => s.player.pos[1]));
  assert.ok(Math.abs(maxY - 49 / 40) < 0.01, `apex ${maxY}`); // double jump ignored
  assert.equal(r.snapAt(42).player.grounded, true); // flight time 2v/g = 0.7 s = 42 ticks
  assert.equal(r.snapAt(41).player.grounded, false);
  assert.equal(r.snapAt(50).player.grounded, true);
  assert.equal(r.snapAt(50).player.pos[1], 0);
});

// ---------- F4: pause ----------
test('pause: tick advances, sim_tick/time/movement freeze, state paused, events paused/resumed', () => {
  const r = runHeadless({ ticks: 50, every: 10, scenario: quiet({ player: { pulse_cd_ticks: 100 } }), inputs: { frames: [
    { tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 40, pause: true }] } });
  assert.deepEqual(named(r, 'paused').map((e) => e.tick), [11]);
  assert.deepEqual(named(r, 'resumed').map((e) => e.tick), [41]);
  const s20 = r.snapAt(20), s30 = r.snapAt(30);
  assert.equal(s20.state, 'paused');
  assert.equal(s20.sim_tick, 10);
  assert.deepEqual(s20.player.pos, s30.player.pos);
  assert.equal(s20.time_left_s, s30.time_left_s);
  assert.equal(s20.player.pulse_cd_s, s30.player.pulse_cd_s);
  assert.equal(r.snapAt(50).state, 'playing');
  assert.equal(r.snapAt(50).sim_tick, 20);
  assert.equal(r.end.ticks, 50);
});

// ---------- fall off the island ----------
test('fall (Y < -10): -1 flame, lose all motes, wait 60 ticks, respawn at start with invuln 90', () => {
  const sc = quiet({ player: { pos: [39.5, 0, 0], carried: 5, invuln_ticks: 30 } });
  const r = runHeadless({ ticks: 300, every: 1, scenario: sc, inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }] } });
  const hit = named(r, 'player_hit');
  assert.equal(hit.length, 1); // happens once, ignores invulnerability
  assert.deepEqual(hit[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 5 });
  assert.ok(r.snapAt(hit[0].tick).player.pos[1] <= -10); // snapshot rounds to 3 decimals
  const back = r.snapAt(hit[0].tick + 60);
  assert.deepEqual(back.player.pos, [0, 0, 0]);
  assert.equal(back.player.invuln, true);
  assert.equal(back.player.carried, 0);
  assert.notDeepEqual(r.snapAt(hit[0].tick + 59).player.pos, [0, 0, 0]);
});

test('fall with the last flame loses immediately (no respawn)', () => {
  const r = runHeadless({ ticks: 300, scenario: quiet({ player: { pos: [39.5, 0, 0], flames: 1 } }), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.state, 'lost');
});

// ---------- F2: wind charm ----------
test('charm: picked like a mote, 600 ticks of 7.2 m/s and dash without cooldown, respawns after 2700', () => {
  const sc = quiet({ charms: [{ pos: [0, 0, 0] }] });
  const r = runHeadless({ ticks: 2710, every: 1, scenario: sc, extraArgs: night(2), inputs: { frames: [
    { tick: 5, move: [0, 1] }, { tick: 65, move: [0, 0] },
    { tick: 100, dash: true }, { tick: 101, dash: false }, { tick: 120, dash: true }] } });
  assert.deepEqual(named(r, 'charm_picked'), [{ type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } }]);
  near(r.snapAt(65).player.pos[2], 7.2); // 60 ticks at 7.2 m/s
  assert.deepEqual(named(r, 'dash').map((e) => e.tick), [101, 121]); // no cooldown while charmed
  assert.equal(r.snapAt(1).player.charm_s, 10);
  assert.deepEqual(r.snapAt(1).charms[0], { id: 'C1', pos: [0, 0, 0], available: false, respawn_s: 45 });
  assert.equal(r.snapAt(2700).charms[0].available, false);
  assert.equal(r.snapAt(2701).charms[0].available, true);
});

test('charm: picking again refreshes; dash during a dash is ignored', () => {
  const sc = quiet({ player: { charm_ticks: 50 }, charms: [{ id: 'C1', pos: [0, 0, 3] }] });
  const r = runHeadless({ ticks: 40, every: 1, scenario: sc, extraArgs: night(2), inputs: { frames: [
    { tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }] } });
  assert.deepEqual(named(r, 'dash').map((e) => e.tick), [1]);
  const pick = named(r, 'charm_picked')[0];
  assert.equal(r.snapAt(pick.tick).player.charm_s, 10);
});

test('default charm positions: Night 2 (35,0,0); Night 3 (30,0,25) and (-30,0,25)', () => {
  const n2 = runHeadless({ ticks: 0, extraArgs: night(2) });
  assert.deepEqual(n2.snapAt(0).charms.map((c) => [c.id, c.pos]), [['C1', [35, 0, 0]]]);
  const n3 = runHeadless({ ticks: 0, extraArgs: night(3) });
  assert.deepEqual(n3.snapAt(0).charms.map((c) => [c.id, c.pos]), [['C1', [30, 0, 25]], ['C2', [-30, 0, 25]]]);
  assert.equal(runHeadless({ ticks: 0 }).snapAt(0).charms.length, 0);
});

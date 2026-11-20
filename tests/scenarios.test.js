// Own headless scenarios (also replayed by scripts/proof.sh into docs/proof/).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runHeadless, ROOT, T } from './helpers.js';

const load = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/scenarios', n), 'utf8'));

test('scenario light-L1: walk, pick 5 motes, deposit, light L1', () => {
  const r = runHeadless({ ticks: 120, scenario: load('light-L1.scenario.json'), inputs: load('light-L1.inputs.json') });
  const names = r.events.map((e) => e.name);
  assert.equal(names.filter((n) => n === 'mote_picked').length, 5);
  assert.deepEqual(names.slice(-2), ['deposit', 'lantern_lit']);
  assert.equal(r.events.at(-1).tick, 76);
  assert.equal(r.end.score, 5 * T.score.per_mote + T.score.per_lantern);
  assert.equal(r.snapAt(120).lanterns[0].lit, true);
});

test('scenario pulse-shade: shade stunned before it reaches the player', () => {
  const r = runHeadless({ ticks: 120, scenario: load('pulse-shade.scenario.json'), inputs: load('pulse-shade.inputs.json') });
  const pulse = r.events.find((e) => e.name === 'pulse');
  assert.deepEqual(pulse, { type: 'event', tick: 11, name: 'pulse', data: { stunned_ids: ['S1'] } });
  assert.equal(r.snapAt(20).shades[0].state, 'stunned');
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

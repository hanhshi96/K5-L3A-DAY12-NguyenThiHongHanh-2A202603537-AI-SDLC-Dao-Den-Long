// Phase 4 (Ticket-04): soak test and release commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, contract } from './helpers.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-rel-'));
const run = (cmd, args) => spawnSync(cmd.split(' ')[0], [...cmd.split(' ').slice(1), ...args], { cwd: ROOT, encoding: 'utf8' });

test('soak: 10 nights in one process, rotating 1-2-3, 0 crashes, memory within 1.2x', () => {
  const out = path.join(tmp, 'soak.json');
  const r = run(contract.soak_cmd, ['--seed', '7', '--nights', '10', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(s.nights, 10);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 10);
  assert.ok(s.results.every((x) => x === 'won' || x === 'lost'));
  assert.deepEqual(s.details.map((d) => [d.night, d.seed]), Array.from({ length: 10 }, (_, i) => [(i % 3) + 1, 7 + i]));
  assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb, `${s.mem_end_mb} > 1.2 x ${s.mem_start_mb}`);
});

test('soak is deterministic for the same seed (results and ticks)', () => {
  const a = path.join(tmp, 'a.json'), b = path.join(tmp, 'b.json');
  run(contract.soak_cmd, ['--seed', '11', '--nights', '3', '--out', a]);
  run(contract.soak_cmd, ['--seed', '11', '--nights', '3', '--out', b]);
  const da = JSON.parse(fs.readFileSync(a, 'utf8')).details, db = JSON.parse(fs.readFileSync(b, 'utf8')).details;
  assert.deepEqual(da, db);
});

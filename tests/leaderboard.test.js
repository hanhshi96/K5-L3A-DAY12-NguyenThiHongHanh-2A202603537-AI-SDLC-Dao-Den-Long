// Phase 4: local leaderboard (Ticket-04 §3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validName, addEntry, sortEntries, validateEntry, isoWithOffset } from '../src/leaderboard.js';
import { ROOT, contract } from './helpers.js';

test('names: 3–12 of [A-Za-z0-9_]; Vietnamese with diacritics accepted (bonus)', () => {
  for (const ok of ['May', 'abc_123', 'ABCDEFGHIJKL', 'Hạnh', 'Nguyễn_Thị']) assert.equal(validName(ok), true, ok);
  for (const bad of ['ab', 'ABCDEFGHIJKLM', 'a b c', 'x-y-z', '<script>', '', null]) assert.equal(validName(bad), false, String(bad));
});

test('top 10 sorted by score desc; ties -> earlier achieved_at ranks higher; rank returned', () => {
  let list = [];
  for (let i = 0; i < 12; i++) list = addEntry(list, { name: `P${i}xx`, score: i * 10, nights_won: 1, seed: i, achieved_at: `2026-11-20T10:00:${String(i).padStart(2, '0')}+07:00` }).entries;
  assert.equal(list.length, 10);
  assert.deepEqual(list.map((e) => e.score), [110, 100, 90, 80, 70, 60, 50, 40, 30, 20]);
  const tie = addEntry(list, { name: 'Late', score: 100, nights_won: 2, seed: 1, achieved_at: '2026-11-20T11:00:00+07:00' });
  assert.equal(tie.rank, 3); // after the earlier 100
  assert.equal(addEntry(list, { name: 'Low', score: 5, nights_won: 0, seed: 1 }).rank, 0);
  const early = sortEntries([{ score: 5, achieved_at: '2026-11-20T10:00:00+07:00', name: 'B' }, { score: 5, achieved_at: '2026-11-20T09:00:00+09:00', name: 'A' }]);
  assert.equal(early[0].name, 'A'); // compares real instants, not strings
});

test('entry validation and ISO 8601 timestamp with offset', () => {
  assert.match(isoWithOffset(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.deepEqual(validateEntry({ name: 'Mây_1', score: 10, nights_won: 3, seed: 7, achieved_at: isoWithOffset() }), []);
  assert.ok(validateEntry({ name: 'Mây', score: -1, nights_won: 4, seed: 'x' }).length >= 3);
});

test('saved on local disk, survives a server restart, exported with <run_cmd> --export-leaderboard', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
  const env = { ...process.env, LEADERBOARD_FILE: path.join(dir, 'lb.json'), PORT: '5391' };
  const [cmd, ...pre] = contract.run_cmd.split(' ');
  const start = async () => {
    const proc = spawn(cmd, pre, { cwd: ROOT, env });
    await new Promise((res) => proc.stdout.once('data', res));
    return proc;
  };
  let srv = await start();
  for (const [name, score] of [['Alice', 300], ['Bob_2', 500]]) {
    const r = await fetch('http://localhost:5391/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, nights_won: 2, seed: 42, achieved_at: isoWithOffset() }) });
    assert.equal(r.status, 200);
  }
  const bad = await fetch('http://localhost:5391/api/leaderboard', { method: 'POST', body: JSON.stringify({ name: 'x', score: 1, nights_won: 0, seed: 1 }) });
  assert.equal(bad.status, 400);
  srv.kill(); await new Promise((r) => srv.once('exit', r));
  srv = await start(); // "restart the game"
  const got = await (await fetch('http://localhost:5391/api/leaderboard')).json();
  assert.deepEqual(got.entries.map((e) => [e.name, e.score]), [['Bob_2', 500], ['Alice', 300]]);
  srv.kill(); await new Promise((r) => srv.once('exit', r));
  const out = path.join(dir, 'out.json');
  const ex = spawnSync(cmd, [...pre, '--export-leaderboard', out], { cwd: ROOT, env, encoding: 'utf8' });
  assert.equal(ex.status, 0, ex.stderr);
  const exp = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(exp), ['entries']);
  assert.deepEqual(exp.entries.map((e) => e.name), ['Bob_2', 'Alice']);
  assert.deepEqual(Object.keys(exp.entries[0]).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
});

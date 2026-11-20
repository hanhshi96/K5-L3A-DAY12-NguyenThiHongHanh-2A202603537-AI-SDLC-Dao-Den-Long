#!/usr/bin/env node
// Soak test (Ticket-04 §2): N nights in ONE process, nights 1→2→3 rotating, night i uses seed + i.
// Random input from the seed: new move direction every 30 ticks; per tick 5% jump, 3% dash, 2% pulse, 10% interact.
// node --expose-gc src/soak.js --seed 7 --nights 10 --out soak.json
import fs from 'node:fs';
import { createGame, step, makeRng, NIGHTS, TICK_RATE } from './sim/sim.js';

function fail(msg) { process.stderr.write(`error: ${msg}\n`); process.exit(1); }
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail(`bad argument ${argv[i]}`);
  args[argv[i].slice(2)] = argv[i + 1];
}
const seed = parseInt(args.seed ?? '7', 10), nights = parseInt(args.nights ?? '10', 10), out = args.out;
if (!out || !Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) fail('usage: --seed <int> --nights <int> --out <file>');

const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const gc = () => { if (global.gc) global.gc(); };

export function playNight(night, s) {
  const g = createGame({ seed: s, night });
  const rng = makeRng((s * 2654435761) >>> 0); // input stream, separate from the game's RNG
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const maxTicks = NIGHTS[night].duration_s * TICK_RATE;
  for (let k = 0; k < maxTicks && g.state === 'playing'; k++) {
    if (k % 30 === 0) { const a = rng() * Math.PI * 2; input.move = [Math.cos(a), Math.sin(a)]; }
    input.jump = rng() < 0.05;
    input.dash = rng() < 0.03;
    input.pulse = rng() < 0.02;
    input.interact = rng() < 0.1;
    step(g, input);
  }
  return { g, result: g.state === 'won' ? 'won' : 'lost', ticks: g.tick, score: g.score };
}

const t0 = Date.now();
const results = [], details = [];
let crashes = 0, memStart = null;
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  try {
    if (i === 0) { createGame({ seed: seed + i, night }); gc(); memStart = rssMb(); } // after loading the first night
    const r = playNight(night, seed + i);
    results.push(r.result);
    details.push({ night, seed: seed + i, result: r.result, ticks: r.ticks, score: r.score });
  } catch (e) {
    crashes++;
    results.push('crash');
    details.push({ night, seed: seed + i, error: String(e && e.stack || e) });
  }
}
gc(); // "reset" after the last night: drop the game and collect
const report = {
  nights, crashes, results,
  mem_start_mb: memStart, mem_end_mb: rssMb(),
  duration_s: Math.round((Date.now() - t0) / 100) / 10,
  gc_exposed: !!global.gc,
  details,
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
process.exit(0);

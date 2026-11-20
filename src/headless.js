#!/usr/bin/env node
// Headless runner — Test Contract v1.1.
// node src/headless.js --seed <int> --night 1|2|3 [--scenario f] [--inputs f] --ticks <int> --out f.jsonl [--snapshot-every n]
import fs from 'node:fs';
import { createGame, step, snapshot, ScenarioError } from './sim/sim.js';
import { validateInputs, validateScenario, FormatError } from './sim/validate.js';

function fail(msg, code) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail(`unexpected argument ${k}`, 1);
    const v = argv[i + 1];
    if (v === undefined) fail(`missing value for ${k}`, 1);
    a[k.slice(2)] = v;
    i++;
  }
  const int = (name, req, def) => {
    if (a[name] === undefined) { if (req) fail(`--${name} is required`, 1); return def; }
    if (!/^-?\d+$/.test(a[name])) fail(`--${name} must be an integer`, 1);
    return parseInt(a[name], 10);
  };
  const opts = {
    seed: int('seed', true),
    night: int('night', false, 1),
    ticks: int('ticks', true),
    every: int('snapshot-every', false, 10),
    scenario: a.scenario,
    inputs: a.inputs,
    out: a.out,
  };
  if (!opts.out) fail('--out is required', 1);
  if (![1, 2, 3].includes(opts.night)) fail(`night ${opts.night} not supported (1, 2, 3)`, 1);
  if (opts.ticks < 0) fail('--ticks must be >= 0', 1);
  if (opts.every < 1) fail('--snapshot-every must be >= 1', 1);
  return opts;
}

function readJson(file, validate) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { fail(`cannot read ${file}: ${e.message}`, 2); }
  let doc;
  try { doc = JSON.parse(text); } catch (e) { fail(`${file}: invalid JSON: ${e.message}`, 2); }
  try { return validate(doc); } catch (e) {
    if (e instanceof FormatError) fail(`${file}: ${e.message}`, 2);
    throw e;
  }
}

export function run(opts) {
  const scenario = opts.scenario ? readJson(opts.scenario, validateScenario) : null;
  const inputsDoc = opts.inputs ? readJson(opts.inputs, validateInputs) : { frames: [] };
  let g;
  try { g = createGame({ seed: opts.seed, night: opts.night, scenario }); } catch (e) {
    if (e instanceof ScenarioError) fail(e.message, 2);
    throw e;
  }
  // night_start is emitted at tick 0, before the tick-0 snapshot (spec G20).
  const lines = [JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night: opts.night } }), JSON.stringify(snapshot(g))];
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const frames = inputsDoc.frames;
  let fi = 0;
  let k = 0;
  for (; k < opts.ticks && (g.state === 'playing' || g.state === 'paused'); k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      for (const key of Object.keys(input)) if (key in f) input[key] = f[key];
    }
    for (const ev of step(g, input)) lines.push(JSON.stringify(ev));
    if (g.tick % opts.every === 0) lines.push(JSON.stringify(snapshot(g)));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: g.tick, state: g.state, score: g.score }));
  return lines.join('\n') + '\n';
}

const opts = parseArgs(process.argv.slice(2));
try {
  fs.writeFileSync(opts.out, run(opts));
} catch (e) {
  fail(e.message, 1);
}
process.exit(0);

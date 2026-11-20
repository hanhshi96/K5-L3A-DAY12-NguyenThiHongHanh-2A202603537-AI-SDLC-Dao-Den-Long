import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
export const T = contract.tuning;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
let n = 0;

// Runs the headless command exactly as declared in game.contract.json.
export function runHeadless({ seed = 1, ticks = 60, scenario, inputs, every, extraArgs = [], rawScenario, rawInputs } = {}) {
  const id = n++;
  const out = path.join(tmp, `out${id}.jsonl`);
  const args = ['--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out];
  if (scenario || rawScenario !== undefined) {
    const f = path.join(tmp, `sc${id}.json`);
    fs.writeFileSync(f, rawScenario !== undefined ? rawScenario : JSON.stringify(scenario));
    args.push('--scenario', f);
  }
  if (inputs || rawInputs !== undefined) {
    const f = path.join(tmp, `in${id}.json`);
    fs.writeFileSync(f, rawInputs !== undefined ? rawInputs : JSON.stringify(inputs));
    args.push('--inputs', f);
  }
  if (every) args.push('--snapshot-every', String(every));
  args.push(...extraArgs);
  const [cmd, ...pre] = contract.headless_cmd.split(' ');
  const r = spawnSync(cmd, [...pre, ...args], { cwd: ROOT, encoding: 'utf8' });
  const text = r.status === 0 ? fs.readFileSync(out, 'utf8') : '';
  const lines = text ? text.trim().split('\n').map((l) => JSON.parse(l)) : [];
  return {
    code: r.status,
    stderr: r.stderr,
    text,
    lines,
    snaps: lines.filter((l) => l.type === 'snapshot'),
    events: lines.filter((l) => l.type === 'event'),
    end: lines[lines.length - 1],
    snapAt: (t) => lines.find((l) => l.type === 'snapshot' && l.tick === t),
  };
}

// An empty, quiet world: no random motes/shades.
export const quiet = (extra = {}) => ({ random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], ...extra });

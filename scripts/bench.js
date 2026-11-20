#!/usr/bin/env node
// Benchmark (Ticket-04 §1): node scripts/bench.js --seed 42 --duration 30 --out bench.json
// Opens a 1280x720 Chrome window (not fullscreen, vsync off), loads the bench scene, waits 3 s warm-up,
// measures exactly --duration seconds of frames, writes bench.json and exits 0.
// BENCH_HEADLESS=1 runs without a window (for machines without a display; numbers are then not comparable).
const T0 = Date.now(); // process start, for load_ms
import fs from 'node:fs';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import puppeteer from 'puppeteer';
import { startServer } from '../server.js';

function fail(msg) { process.stderr.write(`error: ${msg}\n`); process.exit(1); }
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail(`bad argument ${argv[i]}`);
  args[argv[i].slice(2)] = argv[i + 1];
}
const seed = parseInt(args.seed ?? '42', 10), duration = parseFloat(args.duration ?? '30'), out = args.out;
if (!out || !Number.isFinite(duration) || duration <= 0) fail('usage: --seed <int> --duration <s> --out <file>');

// npm >= 11 may skip puppeteer's postinstall download: install Chrome on demand, else use a system Chrome.
function findChrome() {
  let p = puppeteer.executablePath();
  if (fs.existsSync(p)) return p;
  process.stderr.write('bench: downloading Chrome for puppeteer (first run)…\n');
  spawnSync('npx', ['--yes', 'puppeteer', 'browsers', 'install', 'chrome'], { stdio: 'inherit' });
  p = puppeteer.executablePath();
  if (fs.existsSync(p)) return p;
  const sys = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return sys.find((x) => fs.existsSync(x)) || fail('no Chrome found');
}

// RSS of the browser process tree (MB).
function treeRssMb(rootPid) {
  try {
    const rows = execSync('ps -A -o pid=,ppid=,rss=', { encoding: 'utf8' }).trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
    const kids = new Map();
    for (const [pid, ppid] of rows) { if (!kids.has(ppid)) kids.set(ppid, []); kids.get(ppid).push(pid); }
    const rss = new Map(rows.map(([pid, , r]) => [pid, r]));
    let total = 0; const stack = [rootPid];
    while (stack.length) { const p = stack.pop(); total += rss.get(p) || 0; stack.push(...(kids.get(p) || [])); }
    return total / 1024;
  } catch { return null; }
}

const headless = process.env.BENCH_HEADLESS === '1';
const server = await startServer(0);
const port = server.address().port;
const launchOpts = {
  headless: headless ? 'new' : false,
  defaultViewport: { width: 1280, height: 720 },
  args: ['--window-size=1280,720', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--no-first-run',
    ...(headless ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])],
};
const SYSTEM_CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
let browser;
for (const exe of [findChrome(), ...SYSTEM_CHROME.filter((x) => fs.existsSync(x))]) {
  try { browser = await puppeteer.launch({ ...launchOpts, executablePath: exe }); break; } catch (e) {
    process.stderr.write(`bench: cannot launch ${exe} (${String(e.message).split('\n')[0]}), trying next…\n`);
  }
}
if (!browser) fail('could not launch any Chrome');
const pid = browser.process()?.pid;
let peak = null;
const sampler = setInterval(() => { const m = treeRssMb(pid); if (m !== null) peak = Math.max(peak ?? 0, m); }, 250);
const page = await browser.newPage();
page.on('pageerror', (e) => process.stderr.write(`page error: ${e.message}\n`));
await page.goto(`http://localhost:${port}/src/web/index.html?bench&seed=${seed}&duration=${duration}`);
await page.waitForFunction('window.__benchResult', { timeout: (duration + 120) * 1000, polling: 200 });
const res = await page.evaluate(() => ({ ...window.__benchResult, first: window.__benchFirstFrameEpoch, info: window.__benchInfo }));
clearInterval(sampler);
const version = await browser.version();
await browser.close();
server.close();

if (res.info.shades !== 200 || res.info.motes !== 100) fail(`bench scene has ${res.info.shades} shades / ${res.info.motes} motes`);
const report = {
  contract_version: '1.3',
  avg_fps: res.avg_fps,
  p1_low_fps: res.p1_low_fps,
  frame_ms_p95: res.frame_ms_p95,
  frames: res.frames,
  load_ms: res.first - T0,
  peak_mem_mb: peak === null ? null : Math.round(peak),
  vsync_off: true,
  renderer: `${res.info.renderer}; ${version}${headless ? ' (headless)' : ''}`,
  os: `${os.type()} ${os.release()} ${os.arch()}; ${os.cpus()[0]?.model || ''}`,
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exit(0);

// 3D client (Phase 2): renders the shared simulation and feeds it input. No gameplay rules here.
import * as THREE from 'three';
import { createGame, step, TUNING, TICK_RATE, NIGHTS, capacityOf, makeRng, windAt } from '../sim/sim.js';
import { validName, isoWithOffset, addEntry, sortEntries } from '../leaderboard.js';
import { buildDecor } from './decor.js';

const T = TUNING;
const $ = (id) => document.getElementById(id);

// Standard palette (Ticket-02 Part 3.8)
export const PALETTE = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, cloudSea: 0x12384a,
  lanternLit: 0xffb347, lanternCore: 0xffe9b0, lanternOff: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shadeBody: 0x120a1a, shadeRim: 0x7a3cff, shadeStunned: 0x3a3450, shirt: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8, danger: '#FF5A5F', text: '#F5F1E6',
};
// Ticket-03 colour-blind mode: shade rim/eyes #00B3FF, UI danger white + ⚠.
const shadeRim = () => (settings.colorblind ? 0x00b3ff : PALETTE.shadeRim);
const dangerColor = () => (settings.colorblind ? '#FFFFFF' : PALETTE.danger);
const need = (n) => Math.ceil(TUNING.win_ratio * n - 1e-9);
const INTRO = {
  1: 'Ông Đăng: "Đảo Bến là nơi con thắp ngọn đèn đầu tiên. Đừng sợ bóng tối, Mây."',
  2: 'Ông Đăng: "Hai đảo Cau nối nhau bằng cầu tre. Coi chừng Gió Lạc, chúng thích đom đóm lắm."',
  3: 'Ông Đăng: "Đảo Chuông có ba tầng và gió mạnh. Thắp hết đèn, bình minh sẽ tới."',
};

// ---------- settings (persisted) ----------
// Remappable actions (Ticket-04 §4). Arrow keys always move too; Escape always pauses.
export const ACTIONS = [['up', 'Đi lên'], ['down', 'Đi xuống'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Nạp / châm đèn'], ['pulse', 'Tỏa sáng'], ['pause', 'Tạm dừng'], ['view', 'Đổi góc nhìn']];
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'KeyP', view: 'KeyV' };
const settings = { volume: 0.6, sensitivity: 1, colorblind: false, reducedMotion: false, largeText: false, topDown: false, keys: { ...DEFAULT_KEYS } };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch { /* private mode */ }
settings.keys = { ...DEFAULT_KEYS, ...(settings.keys || {}) };
const keyName = (c) => ({ Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', Escape: 'Esc', Enter: 'Enter',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ControlLeft: 'Ctrl trái', AltLeft: 'Alt trái', Tab: 'Tab' }[c] || c.replace(/^Key|^Digit/, ''));
function duplicateKeys() {
  const by = {};
  for (const [a] of ACTIONS) (by[settings.keys[a]] ||= []).push(a);
  return Object.entries(by).filter(([, v]) => v.length > 1);
}
const applyTextSize = () => document.documentElement.style.setProperty('--ui', settings.largeText ? 1.25 : 1);
applyTextSize();
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } };

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 20, 110);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
const ambient = new THREE.AmbientLight(0xbfc8ff, 0.15);
const moon = new THREE.DirectionalLight(0x9aa8e0, 0.35);
moon.position.set(-20, 40, -10);
scene.add(ambient, moon);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const mat = (color, emissive = 0, ei = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.85 });

// ---------- world building per night ----------
let world = new THREE.Group(), decorAnim = null;
const LH = 4.6; // lantern head height (visual only)
function buildWorld(n) {
  scene.remove(world);
  world = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat(PALETTE.cloudSea));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -12; world.add(sea);
  const disc = (r, x, z, y = 0, h = 4) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, h, 64), mat(PALETTE.grass));
    m.position.set(x, y - h / 2, z); world.add(m);
    const rim = new THREE.Mesh(new THREE.RingGeometry(r - 1.2, r, 64), mat(PALETTE.sand));
    rim.rotation.x = -Math.PI / 2; rim.position.set(x, y + 0.02, z); world.add(rim);
  };
  if (n === 1) disc(40, 0, 0);
  if (n === 2) {
    disc(28, 0, 0); disc(28, 70, 0);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(0x4a3420));
    bridge.position.set(35, -0.15, 0); world.add(bridge);
  }
  if (n === 3) {
    disc(45, 0, 0);
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 24, 0, Math.PI, false); sh.absarc(0, 0, 12, Math.PI, 0, true);
    const f1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 32 }), mat(PALETTE.grass));
    f1.rotation.x = Math.PI / 2; f1.position.y = 3; world.add(f1);
    const f2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), mat(PALETTE.sand)); f2.position.y = 3; world.add(f2);
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180, len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), mat(PALETTE.wood));
      ramp.position.set(27 * Math.cos(a), 1.5, 27 * Math.sin(a));
      ramp.rotation.set(0, -a, Math.atan2(3, 6)); world.add(ramp);
    }
  }
  for (const pad of NIGHTS[n].pads) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r, 0.15, 24), mat(PALETTE.gold, PALETTE.gold, 0.8));
    m.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]); world.add(m);
  }
  decorAnim = buildDecor(n, world, PALETTE);
  scene.add(world);
}

// ---------- entity meshes ----------
function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.1, 12), mat(PALETTE.shirt)); body.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.08, 8, 16), mat(PALETTE.scarf)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), mat(0xf2d0a9)); head.position.y = 1.4;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.45, 24), mat(PALETTE.sand)); hat.position.y = 1.8;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(PALETTE.lanternLit, PALETTE.lanternLit, 2)); lamp.position.set(0.7, 1.25, 0);
  const light = new THREE.PointLight(0xffa040, 2, 10, 1.5); light.position.copy(lamp.position);
  g.add(body, scarf, head, hat, lamp, light);
  g.userData = { lamp, light };
  return g;
}
function makeLantern() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.5, 8), mat(0x8c8494)); base.position.y = 0.25;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 4.2, 8), mat(PALETTE.wood)); post.position.y = 2.1;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.14), mat(PALETTE.wood)); arm.position.y = LH + 1.05;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.6, 8), mat(0x8a3b2e)); cap.position.y = LH + 1.35;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), mat(PALETTE.lanternOff, PALETTE.lanternLit, 0)); body.scale.y = 1.3; body.position.y = LH;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), mat(PALETTE.lanternCore, PALETTE.lanternCore, 0)); core.position.y = LH;
  const light = new THREE.PointLight(0xffa040, 0, 28, 1.2); light.position.y = LH;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide }));
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, side: THREE.DoubleSide }));
  barBg.position.y = LH + 1.9; bar.position.set(0, LH + 1.9, 0.01);
  const tear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.05), mat(0x111111)); // torn paper (unlit, colour-independent)
  tear.position.set(0.25, LH - 0.15, 0.92); tear.rotation.z = 0.5;
  g.add(base, post, arm, cap, body, core, light, ring, barBg, bar, tear);
  g.userData = { body, core, light, ring, bar, barBg, tear };
  return g;
}
// Motes (visual only, Phase 4 creative): bigger core, glowing additive halo, and a faint light column so they are
// easy to spot from far away. Sizes are display-only; pickup radius still comes from TUNING in sim.js.
const moteGeo = new THREE.SphereGeometry(0.28, 12, 8);
const haloGeo = new THREE.SphereGeometry(0.65, 12, 8);
const beamGeo = new THREE.CylinderGeometry(0.06, 0.25, 6, 8, 1, true);
const moteMat = mat(PALETTE.moteCore, PALETTE.moteCore, 4);
const haloMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
const beamMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
function makeMote() {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(haloGeo, haloMat), beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 3;
  g.add(new THREE.Mesh(moteGeo, moteMat), halo, beam);
  g.userData = { halo };
  return g;
}
function makeShade() {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), mat(PALETTE.shadeBody, PALETTE.shadeRim, 0.5));
  const eyeM = mat(0xffffff, shadeRim(), 1);
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeM), e2 = e1.clone();
  e1.position.set(0.25, 0.15, 0.62); e2.position.set(-0.25, 0.15, 0.62);
  g.add(blob, e1, e2); g.userData = { blob, eyeM };
  return g;
}
function makeDrifter() {
  const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.4, 0.08, 48, 6), mat(PALETTE.drifter, PALETTE.drifter, 0.4));
  return m;
}
function makeCharm() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.05), mat(PALETTE.scarf, PALETTE.scarf, 0.3));
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.03), mat(PALETTE.gold, PALETTE.gold, 0.5));
  g.add(border, paper); return g;
}

// ---------- audio (WebAudio, synthesized) ----------
let actx = null, master = null, musicTimer = null;
function initAudio() {
  if (actx) return;
  try { actx = new AudioContext(); master = actx.createGain(); master.connect(actx.destination); } catch { actx = null; }
  applyVolume();
}
const applyVolume = () => { if (master) master.gain.value = settings.volume; };
function tone(freq, dur = 0.25, type = 'sine', vol = 0.15) {
  if (!actx) return;
  const o = actx.createOscillator(), gn = actx.createGain();
  o.type = type; o.frequency.value = freq;
  gn.gain.setValueAtTime(vol, actx.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(gn).connect(master); o.start(); o.stop(actx.currentTime + dur);
}
const SCALES = { 1: [262, 294, 330, 392, 440], 2: [220, 247, 277, 330, 370], 3: [196, 220, 247, 294, 330] };
function startMusic(n) {
  stopMusic();
  let i = 0;
  musicTimer = setInterval(() => {
    if (ui !== 'play') return;
    const s = SCALES[n];
    tone(s[(i * 3) % s.length] / 2, 1.2, 'triangle', 0.05);
    if (i % 2 === 0) tone(s[(i * 7) % s.length], 0.6, 'sine', 0.04);
    i++;
  }, 600);
}
const stopMusic = () => { if (musicTimer) clearInterval(musicTimer); musicTimer = null; };
const SFX = {
  lantern_out: () => [392, 294, 196].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'sine', 0.08), i * 140)),
  refuel: () => tone(587, 0.2, 'triangle', 0.08),
  mote_picked: (e) => tone(523 * Math.pow(2, e.data.carried / 12), 0.15),
  lantern_lit: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle'), i * 110)),
  pulse: () => tone(220, 0.5, 'sawtooth', 0.08),
  player_hit: () => tone(130, 0.4, 'square', 0.1),
  dash: () => tone(880, 0.12, 'triangle', 0.08),
  shade_spawned: () => tone(98, 0.6, 'sawtooth', 0.05),
  drifter_steal: () => tone(300, 0.3, 'square', 0.06),
  charm_picked: () => tone(1046, 0.3, 'triangle', 0.1),
};

// ---------- game flow: menu -> intro -> play -> result -> next night -> dawn ----------
let ui = 'menu', game = null, nightNo = 1, totalScore = 0, yaw = 0, acc = 0;
let runSeed = Date.now() & 0x7fffffff, nightsWon = 0, saved = false; // one run = nights 1..3
const meshes = { lantern: new Map(), mote: new Map(), shade: new Map(), drifter: new Map(), charm: new Map() };
const player = makePlayer();
scene.add(player);
// Guide arrow (visual only, Phase 4 creative): a glowing arrow floating above Mây that points at the nearest mote.
const moteArrow = (() => {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.85, depthTest: false });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 12), m);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 8), m);
  head.rotation.x = tail.rotation.x = Math.PI / 2; // point along +Z, then turn the group with rotation.y
  head.position.z = 0.75; tail.position.z = 0.1;
  g.add(head, tail); g.renderOrder = 10; g.visible = false;
  return g;
})();
scene.add(moteArrow);
const fx = [];
// Pulse effect (visual only, Phase 4 creative): light bursts out of Mây's own lantern instead of a plain ring.
// The rule in sim.js stuns shades in a sphere of T.pulse_radius around Mây, in every direction, so the effect
// radiates evenly: a glowing sphere, 12 light rays and a ground ring that all end exactly at T.pulse_radius.
const pulseMats = {
  glow: new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  ray: new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  ring: new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
};
function spawnPulseFx() {
  const R = T.pulse_radius, dur = 0.6;
  const lamp = player.userData.lamp.getWorldPosition(new THREE.Vector3());
  const g = new THREE.Group();
  const mats = Object.fromEntries(Object.entries(pulseMats).map(([k, m]) => [k, m.clone()]));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mats.glow);
  glow.position.copy(lamp);
  const rays = new THREE.Group(); rays.position.copy(lamp);
  const rayGeo = new THREE.ConeGeometry(0.12, 1, 6); rayGeo.translate(0, 0.5, 0); rayGeo.rotateX(Math.PI / 2); // base at origin, tip at +Z
  for (let i = 0; i < 12; i++) {
    const r = new THREE.Mesh(rayGeo, mats.ray); r.rotation.y = (i / 12) * Math.PI * 2; rays.add(r);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.25, R, 64), mats.ring);
  ring.rotation.x = -Math.PI / 2; ring.position.set(game.player.pos[0], game.player.pos[1] + 0.1, game.player.pos[2]);
  g.add(glow, rays, ring);
  g.userData = {
    life: dur, dur,
    update(k) {
      const ease = 1 - (1 - k) * (1 - k); // fast out, slow in
      glow.scale.setScalar(0.3 + ease * (R - 0.3)); mats.glow.opacity = 0.55 * (1 - k);
      rays.children.forEach(r => r.scale.set(1, 1, 0.5 + ease * (R - 0.5))); mats.ray.opacity = 0.9 * (1 - k);
      if (!settings.reducedMotion) rays.rotation.y = k * 0.6;
      mats.ring.opacity = 0.8 * (1 - k * k);
      player.userData.light.intensity += 6 * (1 - k); // lantern flares up, sync() resets it each frame
    },
  };
  g.userData.update(0);
  scene.add(g); fx.push(g);
}
let prevInput = {}, lastCountdown = -1, wasGrounded = true;

function startNight(n, opts = {}) {
  nightNo = n;
  for (const [k, m] of Object.entries(meshes)) { for (const o of m.values()) scene.remove(o); m.clear(); }
  game = createGame({ seed: opts.seed ?? (runSeed + n - 1), night: n, scenario: opts.scenario || null, bench: !!opts.bench });
  buildWorld(n);
  for (const l of game.lanterns) { const m = makeLantern(); m.position.set(...l.pos); scene.add(m); meshes.lantern.set(l.id, m); }
  for (const c of game.charms) { const m = makeCharm(); scene.add(m); meshes.charm.set(c.id, m); }
  const st = game.player.facing;
  yaw = Math.atan2(st[0], st[1]); acc = 0; lastCountdown = -1;
  const sp = game.player.pos; // snap the camera behind Mây (avoid starting inside the tower)
  camera.position.set(sp[0] - Math.sin(yaw) * 9, sp[1] + 6, sp[2] - Math.cos(yaw) * 9);
  showOverlay(`<h1>Đêm ${n} — ${NIGHTS[n].name}</h1><p>${INTRO[n]}</p><p>Giữ ít nhất <b>${need(game.lanterns.length)}/${game.lanterns.length}</b> đèn sáng tới bình minh. Đèn cạn dầu sẽ tắt — nhấn E để châm.</p><p><kbd>Enter</kbd> để bắt đầu</p>`);
  ui = 'intro';
}
function play() { initAudio(); hideOverlay(); ui = 'play'; startMusic(nightNo); }
function onGameOver({ result }) {
  stopMusic();
  if (result === 'won') {
    totalScore += game.score; nightsWon++;
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.6, 'triangle'), i * 120));
    if (nightNo === 3) {
      ui = 'dawn';
      showOverlay(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng trở lại. Cảm ơn con, Mây.</p><p>Tổng điểm: <b>${totalScore}</b></p>${saveForm()}<p><kbd>Enter</kbd> về menu</p>`);
      document.body.style.background = '#f7c56b';
    } else {
      ui = 'result';
      showOverlay(`<h1>Đêm ${nightNo}: thắng!</h1><p>Điểm đêm: <b>${game.score}</b> · Tổng: <b>${totalScore}</b></p><p><kbd>Enter</kbd> sang Đêm ${nightNo + 1}</p>`);
    }
  } else {
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'sine'), i * 180));
    ui = 'lost';
    showOverlay(`<h1>Thua rồi</h1><p>${game.player.flames <= 0 ? 'Mây đã hết lửa…' : `Bình minh tới nhưng chưa đủ ${need(game.lanterns.length)} đèn sáng…`}</p><p>Tổng điểm (các Đêm đã thắng): <b>${totalScore}</b></p>${saveForm()}<p><kbd>R</kbd> / <kbd>Enter</kbd> chơi lại Đêm ${nightNo}</p>`);
  }
}
function controlsHelp() {
  const k = (a) => `<kbd>${keyName(settings.keys[a])}</kbd>`;
  return `${k('up')}${k('left')}${k('down')}${k('right')} đi · ${k('jump')} nhảy · ${k('dash')} lướt · ${k('interact')} nạp/châm đèn · ${k('pulse')} tỏa sáng<br>
    kéo chuột / <kbd>Q</kbd> <kbd>C</kbd> xoay camera · ${k('view')} nhìn từ trên xuống · <kbd>Esc</kbd>/${k('pause')} tạm dừng · đổi phím trong Cài đặt`;
}
function showMenu() {
  stopMusic(); ui = 'menu'; totalScore = 0;
  showOverlay(`<h1>Đảo Đèn Lồng</h1><p>Giúp Mây giữ đèn lồng của ba hòn đảo sáng tới bình minh.</p>
    <p>${controlsHelp()}</p>
    <p><button data-act="start">Bắt đầu (Enter)</button> <button data-act="board">Bảng xếp hạng</button> <button data-act="settings">Cài đặt</button></p>`);
}
function showPause() {
  ui = 'pause';
  showOverlay(`<h1>Tạm dừng</h1><p><button data-act="resume">Tiếp tục</button></p><p><button data-act="restart">Chơi lại Đêm</button></p>
    <p><button data-act="settings">Cài đặt</button></p><p><button data-act="menu">Về menu</button></p>`);
}
let settingsBack = 'menu';
let waitingBind = null;
function showSettings() {
  if (ui !== 'settings') settingsBack = ui === 'pause' ? 'pause' : 'menu';
  ui = 'settings';
  const dups = duplicateKeys(), dupSet = new Set(dups.flatMap(([, v]) => v));
  const label = Object.fromEntries(ACTIONS);
  const rows = ACTIONS.map(([a, l]) => `<tr><td>${l}</td><td><button data-bind="${a}" class="${dupSet.has(a) ? 'dup' : ''}">${waitingBind === a ? 'Nhấn phím…' : keyName(settings.keys[a])}</button></td></tr>`).join('');
  showOverlay(`<h1>Cài đặt</h1>
    <p>Âm lượng <input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}">
       Độ nhạy chuột <input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"></p>
    <p><label><input id="cb" type="checkbox" ${settings.colorblind ? 'checked' : ''}> Bảng màu dễ phân biệt</label>
       <label><input id="rm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}> Giảm chuyển động</label>
       <label><input id="lt" type="checkbox" ${settings.largeText ? 'checked' : ''}> Chữ lớn (×1.25)</label></p>
    <table class="board keys">${rows}</table>
    ${dups.length ? `<p class="warn">⚠ Trùng phím: ${dups.map(([k, v]) => `${keyName(k)} → ${v.map((x) => label[x]).join(' và ')}`).join('; ')}</p>` : ''}
    <p><button data-act="resetkeys">Khôi phục mặc định</button> <button data-act="back">Xong</button></p>`);
  $('cb').onchange = (e) => { settings.colorblind = e.target.checked; saveSettings(); };
  $('rm').onchange = (e) => { settings.reducedMotion = e.target.checked; saveSettings(); };
  $('lt').onchange = (e) => { settings.largeText = e.target.checked; applyTextSize(); saveSettings(); };
  $('vol').oninput = (e) => { settings.volume = +e.target.value; applyVolume(); saveSettings(); };
  $('sens').oninput = (e) => { settings.sensitivity = +e.target.value; saveSettings(); };
}
function showOverlay(html) { $('overlayBox').innerHTML = html; $('overlay').classList.remove('hidden'); }
function hideOverlay() { $('overlay').classList.add('hidden'); }
$('overlay').addEventListener('click', (e) => {
  if (e.target.dataset && e.target.dataset.bind) { waitingBind = e.target.dataset.bind; showSettings(); return; }
  const act = e.target.dataset && e.target.dataset.act;
  if (!act) return;
  if (act === 'start') newRun();
  if (act === 'board') showBoard();
  if (act === 'save') saveScore();
  if (act === 'settings') showSettings();
  if (act === 'resume') play();
  if (act === 'restart') { startNight(nightNo); }
  if (act === 'menu') showMenu();
  if (act === 'back') { if (duplicateKeys().length) return; waitingBind = null; (settingsBack === 'pause' ? showPause : showMenu)(); }
  if (act === 'resetkeys') { settings.keys = { ...DEFAULT_KEYS }; saveSettings(); showSettings(); }
});

// ---------- leaderboard (Ticket-04 §3): stored on disk by server.js (data/leaderboard.json) ----------
function newRun() { initAudio(); totalScore = 0; nightsWon = 0; saved = false; runSeed = Date.now() & 0x7fffffff; startNight(1); }
function saveForm() {
  return saved ? '<p>Đã lưu điểm.</p>' : `<p><input id="lbName" maxlength="12" placeholder="Tên (3–12 ký tự)" autocomplete="off">
    <button data-act="save">Lưu điểm</button></p><p id="lbMsg" class="small"></p>`;
}
async function saveScore() {
  const input = $('lbName');
  if (!input || saved) return;
  const name = input.value.trim();
  if (!validName(name)) { $('lbMsg').textContent = '⚠ Tên cần 3–12 ký tự: chữ (có dấu cũng được), số hoặc _'; return; }
  const entry = { name, score: totalScore, nights_won: nightsWon, achieved_at: isoWithOffset(), seed: runSeed };
  let rank = 0;
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    const j = await r.json();
    if (!r.ok) { $('lbMsg').textContent = '⚠ ' + (j.errors || []).join('; '); return; }
    rank = j.rank;
  } catch { // server unreachable (e.g. opened as a static file): keep a browser-local copy
    let list = []; try { list = JSON.parse(localStorage.getItem('ddl-leaderboard') || '[]'); } catch { /* ignore */ }
    const res = addEntry(list, entry); rank = res.rank;
    try { localStorage.setItem('ddl-leaderboard', JSON.stringify(res.entries)); } catch { /* ignore */ }
  }
  saved = true;
  $('lbMsg').textContent = rank ? `Đã lưu! Hạng ${rank} trong top 10.` : 'Đã lưu, nhưng chưa vào top 10.';
  input.disabled = true;
}
let boardBack = 'menu';
async function showBoard() {
  boardBack = ui; ui = 'board';
  let entries = [];
  try { entries = (await (await fetch('/api/leaderboard')).json()).entries; } catch {
    try { entries = sortEntries(JSON.parse(localStorage.getItem('ddl-leaderboard') || '[]')); } catch { /* ignore */ }
  }
  const rows = entries.map((e, i) => `<tr><td>${i + 1}</td><td>${e.name.replace(/[<>&]/g, '')}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${e.achieved_at.slice(0, 16).replace('T', ' ')}</td></tr>`).join('');
  showOverlay(`<h1>Bảng xếp hạng</h1>${entries.length ? `<table class="board"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Thời điểm</th></tr>${rows}</table>` : '<p>Chưa có ai. Hãy là người đầu tiên!</p>'}
    <p><button data-act="menu">Về menu</button></p>`);
}

// ---------- input ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  if (waitingBind) { // capturing a new key for an action
    e.preventDefault();
    if (e.code !== 'Escape') settings.keys[waitingBind] = e.code;
    waitingBind = null; saveSettings(); showSettings(); return;
  }
  if (e.target && e.target.tagName === 'INPUT' && e.target.id === 'lbName') { if (e.code === 'Enter') saveScore(); return; } // typing a name
  keys.add(e.code);
  if (Object.values(settings.keys).includes(e.code) || e.code === 'Space') e.preventDefault();
  if (e.code === 'Escape' || e.code === settings.keys.pause) { if (ui === 'play') showPause(); else if (ui === 'pause') play(); }
  if (e.code === 'Enter') {
    if (ui === 'menu') newRun();
    else if (ui === 'intro') play();
    else if (ui === 'result') startNight(nightNo + 1);
    else if (ui === 'lost') startNight(nightNo);
    else if (ui === 'dawn') { document.body.style.background = ''; showMenu(); }
  }
  if (e.code === 'KeyR' && ui === 'lost') startNight(nightNo);
  if (e.code === settings.keys.view && !e.repeat && ui === 'play') { settings.topDown = !settings.topDown; saveSettings(); } // camera only
});
addEventListener('keyup', (e) => keys.delete(e.code));
let dragging = false;
addEventListener('mousedown', (e) => { if (e.target === renderer.domElement) dragging = true; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (dragging) yaw -= e.movementX * 0.006 * settings.sensitivity; });
function readInput() {
  const k = settings.keys, on = (a) => keys.has(k[a]);
  const x = (on('left') || keys.has('ArrowLeft') ? 1 : 0) - (on('right') || keys.has('ArrowRight') ? 1 : 0);
  const z = (on('up') || keys.has('ArrowUp') ? 1 : 0) - (on('down') || keys.has('ArrowDown') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: (yaw * 180) / Math.PI, jump: on('jump'), interact: on('interact'),
    pulse: on('pulse'), dash: on('dash'), pause: false };
}

// ---------- sync & HUD ----------
function syncList(kind, list, make, place) {
  const map = meshes[kind], alive = new Set();
  for (const e of list) {
    alive.add(e.id);
    let m = map.get(e.id);
    if (!m) { m = make(); scene.add(m); map.set(e.id, m); }
    place(m, e);
  }
  for (const [id, m] of map) if (!alive.has(id)) { scene.remove(m); map.delete(id); }
}
function sync(t) {
  const p = game.player;
  player.position.set(...p.pos);
  player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  player.visible = !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0) && p.fallWait === 0;
  player.userData.light.intensity = 1 + p.carried * 0.25;
  syncList('mote', game.motes, makeMote, (m, e) => {
    const ph = parseInt(e.id.slice(1), 10);
    m.position.set(e.pos[0], e.pos[1] + 0.9 + Math.sin(t * 3 + ph) * 0.2, e.pos[2]);
    m.scale.setScalar(e.kind === 'dropped' ? 0.8 + Math.sin(t * 10) * 0.1 : 1);
    if (!settings.reducedMotion) m.userData.halo.scale.setScalar(1 + Math.sin(t * 4 + ph) * 0.15); // soft "breathing" glow
  });
  // Point the guide arrow at the nearest mote on the XZ plane; hide it when none is left or one is right here.
  let near = null, best = Infinity;
  for (const e of game.motes) {
    const d = Math.hypot(e.pos[0] - p.pos[0], e.pos[2] - p.pos[2]);
    if (d < best) { best = d; near = e; }
  }
  moteArrow.visible = !!near && best > 2.5 && ui !== 'bench';
  if (moteArrow.visible) {
    const bob = settings.reducedMotion ? 0 : Math.sin(t * 5) * 0.12;
    moteArrow.position.set(p.pos[0], p.pos[1] + 3 + bob, p.pos[2]);
    moteArrow.rotation.y = Math.atan2(near.pos[0] - p.pos[0], near.pos[2] - p.pos[2]);
  }
  syncList('shade', game.shades, makeShade, (m, s) => {
    m.position.set(s.pos[0], s.pos[1] + Math.sin(t * 4 + s.pos[0]) * 0.1, s.pos[2]);
    m.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    const stunned = s.state === 'stunned';
    m.scale.setScalar(s.state === 'spawning' ? 0.5 + 0.5 * (1 - s.stateTicks / 60) : 1);
    if (stunned) m.scale.set(1.3, 0.6, 1.3);
    m.userData.blob.material.color.setHex(stunned ? PALETTE.shadeStunned : PALETTE.shadeBody);
    m.userData.blob.material.emissive.setHex(shadeRim()); m.userData.eyeM.emissive.setHex(shadeRim());
    m.userData.blob.material.emissiveIntensity = s.state === 'drain' ? 0.9 + Math.sin(t * 8) * 0.3 : 0.5;
  });
  syncList('drifter', game.drifters.filter((d) => d.state !== 'removed'), makeDrifter, (m, d) => {
    m.position.set(...d.pos); m.rotation.set(t * 2, t * 3, 0);
  });
  for (const c of game.charms) {
    const m = meshes.charm.get(c.id);
    m.visible = c.available; m.position.set(c.pos[0], c.pos[1] + 1 + Math.sin(t * 2) * 0.2, c.pos[2]); m.rotation.y = t;
  }
  let lit = 0;
  for (const l of game.lanterns) {
    const u = meshes.lantern.get(l.id).userData, f = l.deposited / T.lantern_cost;
    if (l.lit) lit++;
    u.body.material.color.setHex(l.lit ? PALETTE.lanternLit : PALETTE.lanternOff);
    u.body.material.emissiveIntensity = l.lit ? 1.6 + Math.sin(t * 2) * 0.2 : f * 0.8;
    u.core.material.emissiveIntensity = l.lit ? 2 : f;
    u.light.intensity = l.lit ? 6 : f * 1.5;
    u.ring.material.opacity = l.lit && l.fuelU >= T.low_fuel_threshold * 60 ? 0.35 : 0; // no safe zone when fuel < 30
    // fuel bar on lit lanterns; lantern + bar blink at 1 Hz when fuel < 30
    const fuel = l.lit ? l.fuelU / 60 : 0, low = l.lit && fuel < T.low_fuel_threshold;
    const blinkOff = low && Math.floor(t * 2) % 2 === 1;
    u.bar.visible = u.barBg.visible = l.lit && !blinkOff;
    u.bar.scale.x = Math.max(0.001, fuel / T.fuel_max); u.bar.position.x = -0.8 * (1 - fuel / T.fuel_max);
    u.bar.material.color.set(low ? dangerColor() : '#FFB347');
    u.bar.lookAt(camera.position); u.barBg.lookAt(camera.position);
    if (blinkOff) { u.body.material.emissiveIntensity *= 0.2; u.light.intensity *= 0.2; }
    u.body.scale.set(1, l.lit ? 1.3 : 1.04, 1); u.body.position.y = l.lit ? LH : LH - 0.3; // unlit: collapsed 20%
    u.tear.visible = !l.lit;
  }
  ambient.intensity = 0.15 + 0.55 * (lit / game.lanterns.length); // standard formula
}
function hud(t) {
  const p = game.player, lit = game.lanterns.filter((l) => l.lit).length;
  const secs = Math.max(0, Math.ceil(game.timeLeftTicks / TICK_RATE));
  const danger = secs <= 30;
  $('hudFlames').textContent = '🏮'.repeat(Math.max(0, p.flames)) + '·'.repeat(Math.max(0, T.flames - p.flames));
  const clock = $('hudClock');
  clock.textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  clock.style.color = danger ? dangerColor() : PALETTE.text;
  if (danger && settings.colorblind) clock.textContent = '⚠ ' + clock.textContent;
  clock.style.opacity = danger && Math.floor(t * 2) % 2 ? 0.35 : 1;
  const req = need(game.lanterns.length);
  $('hudRight').innerHTML = `Đèn sáng <b style="color:${lit < req ? dangerColor() : '#F2C14E'}">${lit < req && settings.colorblind ? '⚠ ' : ''}${lit}/${game.lanterns.length}</b> (cần ${req} lúc bình minh)<br>Điểm <b>${totalScore + game.score}</b>`;
  const cap = capacityOf(p);
  $('hudBar').innerHTML = Array.from({ length: cap }, (_, i) => `<span class="${i < p.carried ? 'on' : ''}"></span>`).join('') + `<em>${p.carried}/${cap}</em>`;
  const cd = (left, total) => (left > 0 ? `${(left / TICK_RATE).toFixed(1)}s` : 'sẵn sàng');
  $('hudCd').innerHTML = `Lướt [Shift]: <b>${p.charm > 0 ? 'bùa!' : cd(p.dashCd)}</b><br>Tỏa sáng [F]: <b>${p.carried < T.pulse_cost ? `cần ${T.pulse_cost}` : cd(p.pulseCd)}</b>`;
  let hint = '';
  const unlit = game.lanterns.filter((l) => !l.lit);
  const near = game.lanterns.find((l) => Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius);
  if (near && !near.lit) hint = `E — Nạp ánh sáng (${near.deposited}/${near.everLit ? T.relight_cost : T.lantern_cost})`;
  else if (near) hint = `E — Châm dầu (${Math.floor(near.fuelU / 60)}/100)`;
  $('hint').textContent = hint;
  // arrow to the nearest unlit lantern when it is off-screen
  const arrow = $('arrow');
  arrow.style.display = 'none';
  if (unlit.length) {
    const tgt = unlit.reduce((a, b) => (Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) < Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]) ? a : b));
    const v = new THREE.Vector3(tgt.pos[0], tgt.pos[1] + LH, tgt.pos[2]).project(camera);
    const off = v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1;
    if (off) {
      let x = v.x, y = v.y;
      if (v.z > 1) { x = -x; y = -y; }
      const a = Math.atan2(y, x);
      arrow.style.display = 'block';
      arrow.style.left = `${innerWidth / 2 + Math.cos(a) * (innerWidth / 2 - 50)}px`;
      arrow.style.top = `${innerHeight / 2 - Math.sin(a) * (innerHeight / 2 - 50)}px`;
      arrow.style.transform = `translate(-50%,-50%) rotate(${-a}rad)`;
    }
  }
  captions(t, secs);
  if (secs <= 10 && secs !== lastCountdown && ui === 'play') { lastCountdown = secs; tone(secs === 0 ? 220 : 660, 0.12, 'square', 0.06); }
}

// ---------- benchmark scene (Ticket-04 §1) ----------
// Night 1, exactly 200 wandering shades + 100 motes spread over the island (seed), L1–L3 lit with fuel 100.
// Spawns, damage, pickup, fuel and end conditions are off in the sim (bench flag). No player input.
// Camera orbits (0,0,0): radius 30, Y = 15, start at angle 0 = (30,15,0), counter-clockwise seen from above, 15 s per lap.
const BENCH_INPUT = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
const bench = { start: 0, warmup: 3000, duration: 30000, last: 0, dts: [], done: false };
function startBench(seed, durationS) {
  const rng = makeRng(seed);
  const disc = (r, y) => { const a = rng() * Math.PI * 2, d = r * Math.sqrt(rng()); return [d * Math.cos(a), y, d * Math.sin(a)]; };
  const scenario = {
    random_motes: false, random_shades: false, random_drifters: false,
    shades: Array.from({ length: 200 }, (_, i) => ({ id: `S${i + 1}`, pos: disc(38, 1), state: 'wander' })),
    motes: Array.from({ length: 100 }, () => disc(38, 0)),
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  };
  startNight(1, { seed, scenario, bench: true });
  hideOverlay();
  bench.duration = durationS * 1000;
  ui = 'bench';
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  window.__benchInfo = { renderer: `three.js r${THREE.REVISION}, WebGL: ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`,
    shades: game.shades.length, motes: game.motes.length };
}
function benchCamera(now) {
  if (!bench.start) bench.start = now;
  const a = ((now - bench.start) / 15000) * Math.PI * 2;
  camera.position.set(30 * Math.cos(a), 15, 30 * Math.sin(a)); // same angle convention as the maps (spec G15)
  camera.lookAt(0, 0, 0);
}
function benchRecord(now) {
  if (bench.done) return;
  if (!window.__benchFirstFrameEpoch) window.__benchFirstFrameEpoch = Date.now();
  if (bench.last && now - bench.start > bench.warmup) bench.dts.push(now - bench.last);
  bench.last = now;
  if (now - bench.start >= bench.warmup + bench.duration) {
    bench.done = true;
    const dts = bench.dts, N = dts.length, sum = dts.reduce((a, b) => a + b, 0);
    const sorted = [...dts].sort((a, b) => a - b);
    const k = Math.max(1, Math.ceil(0.01 * N));
    const worst = sorted.slice(N - k);
    const r2 = (v) => Math.round(v * 100) / 100;
    window.__benchResult = {
      frames: N,
      avg_fps: r2((1000 * N) / sum),
      p1_low_fps: r2(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
      frame_ms_p95: r2(sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)]),
    };
  }
}

// ---------- visual cues / subtitles (Ticket-04 §4) ----------
const cue = { shade: null, shakeUntil: 0 };
function flash() { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.35; requestAnimationFrame(() => { f.style.transition = 'opacity .4s'; f.style.opacity = 0; }); }
function edgeArrow(el, pos) { // place an arrow on the screen edge pointing at a world position
  const v = new THREE.Vector3(...pos).project(camera);
  let x = v.x, y = v.y;
  if (v.z > 1) { x = -x; y = -y; }
  const a = Math.atan2(y, x);
  el.style.display = 'block';
  el.style.left = `${innerWidth / 2 + Math.cos(a) * (innerWidth / 2 - 50)}px`;
  el.style.top = `${innerHeight / 2 - Math.sin(a) * (innerHeight / 2 - 50)}px`;
  el.style.transform = `translate(-50%,-50%) rotate(${-a}rad)`;
}
function captions(t, secs) {
  const lines = [];
  const sa = $('shadeArrow');
  sa.style.display = 'none';
  if (cue.shade && performance.now() < cue.shade.until) {
    const s = game.shades.find((x) => x.id === cue.shade.id);
    if (s) { lines.push('⚠ Bóng Mực xuất hiện'); edgeArrow(sa, s.pos); sa.style.color = settings.colorblind ? '#00B3FF' : '#B98CFF'; }
  }
  if (game.windEnabled) {
    const w = windAt(game, game.simTick), soon = windAt(game, game.simTick + 120);
    if (!w.active && soon.active) lines.push('🍃 Gió sắp thổi!');
    else if (w.active) lines.push('🍃 Gió mạnh đang thổi');
  }
  if (secs <= 10 && secs > 0) lines.push(`⏳ ${secs} giây cuối!`);
  const low = game.lanterns.filter((l) => l.lit && l.fuelU < T.low_fuel_threshold * 60).map((l) => l.id);
  if (low.length) lines.push(`🏮 Đèn ${low.join(', ')} sắp cạn dầu`);
  $('captions').innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
}

// ---------- main loop ----------
let last = performance.now(), frames = 0, fpsT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (keys.has('KeyQ')) yaw += 1.8 * dt * settings.sensitivity;
  if (keys.has('KeyC')) yaw -= 1.8 * dt * settings.sensitivity;
  if (ui === 'play' || ui === 'bench') {
    acc += dt;
    while (acc >= 1 / TICK_RATE && ui === 'play') {
      acc -= 1 / TICK_RATE;
      const inp = ui === 'bench' ? BENCH_INPUT : readInput();
      if (inp.jump && !prevInput.jump && game.player.grounded) tone(440, 0.15, 'sine', 0.08);
      prevInput = inp;
      for (const ev of step(game, inp)) {
        if (ev.name === 'shade_spawned') cue.shade = { id: ev.data.id, until: performance.now() + 3000 };
        if (ev.name === 'player_hit' && !settings.reducedMotion) cue.shakeUntil = performance.now() + 300;
        if ((ev.name === 'lantern_lit' || ev.name === 'pulse') && !settings.reducedMotion) flash();
        if (SFX[ev.name]) SFX[ev.name](ev);
        if (ev.name === 'pulse') spawnPulseFx();
        if (ev.name === 'game_over') onGameOver(ev.data);
      }
    }
  }
  const t = now / 1000;
  if (decorAnim) decorAnim(t);
  if (game) {
    sync(t); hud(t);
    $('hud').style.display = ui === 'menu' || ui === 'dawn' ? 'none' : 'block';
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.userData.life -= dt;
      const k = Math.min(1, 1 - f.userData.life / f.userData.dur); // 0 → 1 over the effect's lifetime
      f.userData.update(k);
      if (f.userData.life <= 0) { scene.remove(f); f.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); fx.splice(i, 1); }
    }
    if (ui === 'bench') benchCamera(now);
    else {
      const p = player.position, fxv = Math.sin(yaw), fzv = Math.cos(yaw);
      // Top-down view (visual only, Phase 4 creative): high above Mây, tilted slightly so "forward" (yaw) stays
      // at the top of the screen and WASD keeps the same meaning in both views. Movement is never changed here.
      if (settings.topDown) {
        camera.position.lerp(new THREE.Vector3(p.x - fxv * 4, p.y + 18, p.z - fzv * 4), 0.12);
        camera.lookAt(p.x + fxv * 1.5, p.y, p.z + fzv * 1.5);
      } else {
        camera.position.lerp(new THREE.Vector3(p.x - fxv * 9, p.y + 6, p.z - fzv * 9), 0.15);
        camera.lookAt(p.x + fxv * 2, p.y + 1.2, p.z + fzv * 2);
      }
      if (now < cue.shakeUntil && !settings.reducedMotion) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0));
    }
  }
  renderer.render(scene, camera);
  if (ui === 'bench') benchRecord(now);
  frames++; fpsT += dt;
  if (fpsT >= 1) { window.__fps = frames / fpsT; frames = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}

// ?night=N&autostart jumps straight into a night (used for screenshots / proof).
const qs = new URLSearchParams(location.search);
if (qs.has('bench')) startBench(parseInt(qs.get('seed') || '42', 10), parseFloat(qs.get('duration') || '30'));
else {
  startNight(Math.min(3, Math.max(1, parseInt(qs.get('night') || '1', 10))));
  if (qs.has('autostart')) play(); else showMenu();
  if (qs.has('board')) showBoard(); // ?board opens the leaderboard (used for screenshots / proof)
  if (qs.has('settings')) showSettings();
}
requestAnimationFrame(frame);

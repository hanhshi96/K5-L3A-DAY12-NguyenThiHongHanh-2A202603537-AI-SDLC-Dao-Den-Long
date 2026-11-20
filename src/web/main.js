// 3D client: renders the shared simulation (src/sim/sim.js) and feeds it keyboard input.
// All gameplay rules live in the sim; this file is presentation only (visuals, audio, HUD).
import * as THREE from 'three';
import { createGame, step, TUNING, WORLD, TICK_RATE } from '../sim/sim.js';

const T = TUNING;
const $ = (id) => document.getElementById(id);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const NIGHT = new THREE.Color(0x1a0d2e), WARM = new THREE.Color(0x4a3050);
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(0x1a0d2e, 0.035);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const ambient = new THREE.AmbientLight(0x6a5a9a, 0.5);
const moon = new THREE.DirectionalLight(0x9a8acd, 0.4);
moon.position.set(-20, 40, -10);
scene.add(ambient, moon);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const mat = (color, emissive = 0x000000, ei = 0) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.8 });

// island + cloud sea
const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 4, 4, 64), mat(0x2f4a3a));
island.position.y = -2;
scene.add(island);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x2a1a45));
sea.rotation.x = -Math.PI / 2; sea.position.y = -5;
scene.add(sea);
// a few static rocks/trees for decoration (fixed positions, no randomness needed)
for (let i = 0; i < 18; i++) {
  const a = i * 2.4, r = 10 + ((i * 7) % 27);
  const tree = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3, 6), mat(0x1e3a2c));
  tree.position.set(Math.cos(a) * r, 1.5, Math.sin(a) * r);
  scene.add(tree);
}

// ---------- entity meshes ----------
function makePlayer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.1, 12), mat(0x3b6ea8));
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), mat(0xf2d0a9));
  head.position.y = 1.35;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.45, 24), mat(0xe8d39a)); // nón lá
  hat.position.y = 1.75;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35), mat(0x553311));
  string.position.set(0.7, 1.4, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(0xffb347, 0xff9a2a, 2));
  lamp.position.set(0.7, 1.2, 0);
  const light = new THREE.PointLight(0xffa040, 2, 9, 1.5);
  light.position.copy(lamp.position);
  g.add(body, head, hat, string, lamp, light);
  g.userData = { lamp, light };
  return g;
}
function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 8), mat(0x4a2e1a));
  post.position.y = 1.6;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), mat(0x6b3a2a, 0xff8a20, 0));
  body.scale.y = 1.3; body.position.y = 3.6;
  const light = new THREE.PointLight(0xffa040, 0, 26, 1.2);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.15, T.safe_radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  g.add(post, body, light, ring);
  g.userData = { body, light, ring };
  return g;
}
const moteGeo = new THREE.SphereGeometry(0.15, 8, 6);
const moteMat = mat(0xfff0a0, 0xffd060, 3);
function makeShade() {
  const g = new THREE.Group();
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), mat(0x14081f, 0x3a0a5a, 0.6));
  const eyeM = mat(0xffffff, 0xd0b0ff, 1);
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeM);
  const e2 = e1.clone();
  e1.position.set(0.25, 0.15, 0.62); e2.position.set(-0.25, 0.15, 0.62);
  g.add(blob, e1, e2);
  g.userData = { blob };
  return g;
}

// ---------- game state & sync ----------
let game, yaw = 0, started = false;
const lanternMeshes = new Map(), moteMeshes = new Map(), shadeMeshes = new Map();
const player = makePlayer();
scene.add(player);
const pulses = []; // visual rings
const sparks = []; // creative: firefly swirl when a lantern is lit

function reset() {
  for (const m of [...lanternMeshes.values(), ...moteMeshes.values(), ...shadeMeshes.values()]) scene.remove(m);
  lanternMeshes.clear(); moteMeshes.clear(); shadeMeshes.clear();
  game = createGame({ seed: (Date.now() & 0x7fffffff) });
  for (const l of game.lanterns) {
    const m = makeLantern(); m.position.set(l.pos[0], l.pos[1], l.pos[2]);
    scene.add(m); lanternMeshes.set(l.id, m);
  }
  prev = { jump: false, interact: false, pulse: false };
}

function sync(t) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.visible = !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);
  player.userData.light.intensity = 1 + p.carried * 0.25;
  player.userData.lamp.scale.setScalar(1 + p.carried * 0.06);
  // motes
  const alive = new Set();
  for (const m of game.motes) {
    alive.add(m.id);
    let mesh = moteMeshes.get(m.id);
    if (!mesh) { mesh = new THREE.Mesh(moteGeo, moteMat); scene.add(mesh); moteMeshes.set(m.id, mesh); }
    const ph = parseInt(m.id.slice(1), 10);
    mesh.position.set(m.pos[0] + Math.sin(t * 2 + ph) * 0.15, 0.9 + Math.sin(t * 3 + ph) * 0.25, m.pos[2]);
  }
  for (const [id, mesh] of moteMeshes) if (!alive.has(id)) { scene.remove(mesh); moteMeshes.delete(id); }
  // shades
  const live = new Set();
  for (const s of game.shades) {
    live.add(s.id);
    let mesh = shadeMeshes.get(s.id);
    if (!mesh) { mesh = makeShade(); scene.add(mesh); shadeMeshes.set(s.id, mesh); }
    mesh.position.set(s.pos[0], s.pos[1] + Math.sin(t * 4 + s.pos[0]) * 0.1, s.pos[2]);
    mesh.lookAt(p.pos[0], s.pos[1], p.pos[2]);
    const stunned = s.state === 'stunned';
    mesh.scale.set(stunned ? 1.3 : 1, stunned ? 0.6 : 1, stunned ? 1.3 : 1);
    mesh.userData.blob.material.emissive.setHex(stunned ? 0x6060a0 : 0x3a0a5a);
  }
  for (const [id, mesh] of shadeMeshes) if (!live.has(id)) { scene.remove(mesh); shadeMeshes.delete(id); }
  // lanterns: glow grows with deposited light
  let lit = 0;
  for (const l of game.lanterns) {
    const u = lanternMeshes.get(l.id).userData;
    const f = l.deposited / T.lantern_cost;
    if (l.lit) lit++;
    u.body.material.emissiveIntensity = l.lit ? 2.2 + Math.sin(t * 2) * 0.2 : f * 0.6;
    u.body.material.color.setHex(l.lit ? 0xffb347 : 0x6b3a2a);
    u.light.intensity = l.lit ? 6 : f * 1.5;
    u.ring.material.opacity = l.lit ? 0.35 : 0;
  }
  // creative: island warms up as lanterns are lit
  const k = lit / game.lanterns.length;
  scene.background.copy(NIGHT).lerp(WARM, k);
  scene.fog.color.copy(scene.background);
  scene.fog.density = 0.035 - 0.02 * k;
  ambient.intensity = 0.5 + 0.8 * k;
}

// ---------- audio (creative, WebAudio, no asset files) ----------
let actx = null;
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98, 1760, 2093];
function tone(freq, dur = 0.25, type = 'sine', vol = 0.15) {
  if (!actx) return;
  const o = actx.createOscillator(), gn = actx.createGain();
  o.type = type; o.frequency.value = freq;
  gn.gain.setValueAtTime(vol, actx.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(gn).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
}

function onEvent(ev) {
  const p = game.player.pos;
  switch (ev.name) {
    case 'mote_picked': tone(PENTA[Math.min(ev.data.carried, PENTA.length - 1)], 0.2); break;
    case 'deposit': tone(392, 0.3, 'triangle'); break;
    case 'lantern_lit': {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'triangle'), i * 110));
      const l = game.lanterns.find((x) => x.id === ev.data.lantern_id);
      for (let i = 0; i < 40; i++) {
        const s = new THREE.Mesh(moteGeo, moteMat);
        s.userData = { c: l.pos, a: i * 0.7, r: 0.5 + (i % 5) * 0.4, life: 2.5 };
        scene.add(s); sparks.push(s);
      }
      break;
    }
    case 'pulse': {
      tone(220, 0.5, 'sawtooth', 0.08);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48),
        new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p[0], 0.2, p[2]); ring.userData.life = 0.4;
      scene.add(ring); pulses.push(ring);
      break;
    }
    case 'player_hit': tone(140, 0.4, 'square', 0.1); break;
    case 'game_over': showEnd(ev.data); break;
  }
}

// ---------- input ----------
const keys = new Set();
let prev = { jump: false, interact: false, pulse: false };
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Enter' && !started) start();
  if (e.code === 'KeyR' && started && game.state !== 'playing') start();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let dragging = false;
addEventListener('mousedown', () => { dragging = true; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (dragging) yaw -= e.movementX * 0.006; });

function readInput() {
  // Screen-right is world -X at yaw 0 (camera looks along +Z), so D sends x = -1.
  const x = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  const z = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  return {
    move: [x, z],
    cam_yaw_deg: (yaw * 180) / Math.PI,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyF') || keys.has('ShiftLeft'),
  };
}

// ---------- HUD / overlay ----------
function fmtTime(ticks) {
  const s = Math.max(0, Math.ceil(ticks / TICK_RATE));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function hud() {
  const p = game.player;
  const lit = game.lanterns.filter((l) => l.lit).length;
  $('hud').innerHTML =
    `Lửa: <b>${'●'.repeat(Math.max(0, p.flames))}${'○'.repeat(Math.max(0, T.flames - p.flames))}</b><br>` +
    `Đom đóm: <b>${p.carried}/${T.carry_capacity}</b><br>` +
    `Đèn đã thắp: <b>${lit}/${game.lanterns.length}</b><br>` +
    `Bình minh sau: <b>${fmtTime(game.timeLeftTicks)}</b><br>` +
    `Điểm: <b>${game.score}</b><br>` +
    `Tỏa sáng [F]: <b>${p.pulseCd > 0 ? 'hồi…' : p.carried >= T.pulse_cost ? 'sẵn sàng' : `cần ${T.pulse_cost} đom đóm`}</b>`;
  let hint = '';
  if (game.state === 'playing') {
    const near = game.lanterns.find((l) => !l.lit &&
      Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius);
    if (near) hint = p.carried > 0 ? `Nhấn E để nạp ánh sáng (${near.deposited}/${T.lantern_cost})`
                                   : `Đèn cần ${T.lantern_cost - near.deposited} đom đóm nữa`;
  }
  $('hint').textContent = hint;
}
function showIntro() {
  $('overlayBox').innerHTML = `<h1>Đảo Đèn Lồng</h1>
    <p>Đêm 1 – Đảo Bến. Sương đen đã nuốt ánh sáng của đảo.<br>Hãy giúp Mây gom đom đóm và thắp lại <b>5 Đèn Lồng Lớn</b> trước bình minh.</p>
    <p><kbd>W A S D</kbd> di chuyển · <kbd>Space</kbd> nhảy · kéo chuột hoặc <kbd>Q</kbd>/<kbd>C</kbd> xoay camera<br>
    <kbd>E</kbd> nạp ánh sáng vào đèn · <kbd>F</kbd> tỏa sáng xua Bóng Mực (tốn ${T.pulse_cost} đom đóm)</p>
    <p>Bóng Mực sợ đèn đã thắp: đứng gần đèn sáng là an toàn.</p>
    <p><kbd>Enter</kbd> để bắt đầu</p>`;
  $('overlay').classList.remove('hidden');
}
function showEnd({ result, reason }) {
  const why = { all_lit: 'Mọi Đèn Lồng Lớn đã sáng!', dawn: 'Trời đã sáng mà đảo vẫn tối…', no_flames: 'Mây đã hết lửa…' }[reason];
  $('overlayBox').innerHTML = `<h1>${result === 'won' ? 'Chiến thắng!' : 'Thua rồi'}</h1>
    <p>${why}</p><p>Điểm: <b>${game.score}</b></p><p><kbd>R</kbd> để chơi lại</p>`;
  $('overlay').classList.remove('hidden');
}
function start() {
  if (!actx) try { actx = new AudioContext(); } catch { actx = null; }
  reset(); started = true; yaw = 0;
  $('overlay').classList.add('hidden');
}

// ---------- main loop (fixed 60 Hz sim) ----------
reset();
showIntro();
// ?autostart skips the intro (used for screenshots / proof).
if (new URLSearchParams(location.search).has('autostart')) start();
let acc = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (keys.has('KeyQ')) yaw += 1.8 * dt;
  if (keys.has('KeyC')) yaw -= 1.8 * dt;
  if (started && game.state === 'playing') {
    acc += dt;
    while (acc >= 1 / TICK_RATE) {
      acc -= 1 / TICK_RATE;
      for (const ev of step(game, readInput())) onEvent(ev);
      if (game.state !== 'playing') break;
    }
  }
  const t = now / 1000;
  sync(t);
  hud();
  // effects
  for (let i = pulses.length - 1; i >= 0; i--) {
    const r = pulses[i]; r.userData.life -= dt;
    const s = 1 + (1 - r.userData.life / 0.4) * (T.pulse_radius - 1);
    r.scale.set(s, s, s); r.material.opacity = Math.max(0, r.userData.life / 0.4);
    if (r.userData.life <= 0) { scene.remove(r); pulses.splice(i, 1); }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i], u = s.userData; u.life -= dt; u.a += dt * 3; u.r += dt * 1.5;
    s.position.set(u.c[0] + Math.cos(u.a) * u.r, 3.6 + (2.5 - u.life) * 2, u.c[2] + Math.sin(u.a) * u.r);
    if (u.life <= 0) { scene.remove(s); sparks.splice(i, 1); }
  }
  // camera behind the player, looking along the yaw direction
  const p = player.position;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  camera.position.lerp(new THREE.Vector3(p.x - fx * 9, p.y + 6, p.z - fz * 9), 0.15);
  camera.lookAt(p.x + fx * 2, p.y + 1.2, p.z + fz * 2);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

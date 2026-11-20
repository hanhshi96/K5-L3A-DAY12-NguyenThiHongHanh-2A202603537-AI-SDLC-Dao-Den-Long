// Visual-only island decoration (creative, Phase 4). No gameplay: nothing here is read by the simulation.
// Sky (stars, moon, pink horizon haze), pink/gold sparkles on the cloud sea, trees (areca palms on Night 2),
// rocks, bushes, flowers, bamboo bridge planks, a detailed bell tower. Uses instancing to stay fast.
import * as THREE from 'three';
import { makeRng, NIGHTS } from '../sim/sim.js';

const lam = (color, emissive = 0, ei = 0) => new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei });

// Scatter n points on walkable ground of night `n`, away from lanterns, pads and the start point.
function scatter(rng, N, count, minR, maxR, avoid) {
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 30; tries++) {
    const centers = N === NIGHTS[2] ? [[0, 0], [70, 0]] : [[0, 0]];
    const c = centers[Math.floor(rng() * centers.length)];
    const a = rng() * Math.PI * 2, r = minR + Math.sqrt(rng()) * (maxR - minR);
    const x = c[0] + Math.cos(a) * r, z = c[1] + Math.sin(a) * r;
    const h = N.ground(x, z);
    if (h === null || h > 6) continue;
    if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
    out.push([x, h, z, rng()]);
  }
  return out;
}

function instanced(geo, material, items, place) {
  const m = new THREE.InstancedMesh(geo, material, items.length);
  const o = new THREE.Object3D();
  items.forEach((it, i) => { place(o, it); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.instanceMatrix.needsUpdate = true;
  return m;
}

export function buildDecor(n, group, P) {
  const N = NIGHTS[n];
  const rng = makeRng(1000 + n);
  const anim = [];

  // --- sky: stars + moon + soft pink haze at the horizon ---
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const a = rng() * Math.PI * 2, e = 0.12 + rng() * 1.3, R = 260;
    starPos.push(R * Math.cos(e) * Math.cos(a), R * Math.sin(e), R * Math.cos(e) * Math.sin(a));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xfff6e0, size: 1.4, sizeAttenuation: false, transparent: true, fog: false });
  group.add(new THREE.Points(starGeo, starMat));
  anim.push((t) => { starMat.opacity = 0.75 + 0.25 * Math.sin(t * 1.7); });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false }));
  moon.position.set(-140, 95, 150);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.12, fog: false }));
  halo.position.copy(moon.position);
  group.add(moon, halo);
  const haze = new THREE.Mesh(new THREE.CylinderGeometry(200, 200, 40, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff9ec7, transparent: true, opacity: 0.07, side: THREE.BackSide, fog: false, depthWrite: false }));
  haze.position.y = 2; group.add(haze);

  // --- cloud-sea sparkles (sea base colour stays the standard #12384A) ---
  for (const [color, phase] of [[0xff9ec7, 0], [0xf2c14e, Math.PI]]) {
    const pos = [];
    for (let i = 0; i < 700; i++) { const a = rng() * Math.PI * 2, r = 30 + Math.sqrt(rng()) * 170; pos.push(Math.cos(a) * r + (n === 2 ? 35 : 0), -11.8, Math.sin(a) * r); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size: 0.5, transparent: true, opacity: 0.6, depthWrite: false });
    group.add(new THREE.Points(geo, m));
    anim.push((t) => { m.opacity = 0.35 + 0.35 * Math.max(0, Math.sin(t * 2.3 + phase)); });
  }

  // --- vegetation and rocks, kept away from lanterns, pads, start and the bridge ---
  const avoid = [...N.lanterns.map((l) => [l[0], l[2], 4]), ...N.pads.map((p) => [p.pos[0], p.pos[2], 3]), [N.start[0], N.start[2], 5],
    ...(n === 2 ? [[35, 0, 10]] : []), ...(n === 3 ? [[0, 0, 9]] : [])];
  const maxR = n === 1 ? 37 : n === 2 ? 26 : 42;
  const trees = scatter(rng, N, n === 2 ? 26 : 34, 8, maxR, avoid);
  const palms = n === 2 ? scatter(rng, N, 24, 6, maxR, avoid) : [];
  const rocks = scatter(rng, N, 30, 5, maxR + 1, avoid);
  const bushes = scatter(rng, N, 70, 4, maxR, avoid);
  const flowers = scatter(rng, N, 220, 3, maxR, avoid);

  const trunkMat = lam(P.wood), leafA = lam(P.grass), leafB = lam(0x3d7a5f);
  // round-canopy trees and cone trees (alternating)
  const roundT = trees.filter((_, i) => i % 2 === 0), coneT = trees.filter((_, i) => i % 2 === 1);
  group.add(instanced(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6), trunkMat, trees, (o, [x, y, z, s]) => { o.position.set(x, y + 1.2, z); o.scale.setScalar(0.8 + s * 0.6); }));
  group.add(instanced(new THREE.IcosahedronGeometry(1.6, 1), leafA, roundT, (o, [x, y, z, s]) => { o.position.set(x, y + 3.2 + s, z); o.scale.setScalar(0.8 + s * 0.6); o.rotation.set(s, s * 3, 0); }));
  group.add(instanced(new THREE.ConeGeometry(1.5, 3.4, 7), leafB, coneT, (o, [x, y, z, s]) => { o.position.set(x, y + 3.6 + s, z); o.scale.setScalar(0.8 + s * 0.6); }));
  // areca palms (cây cau): tall thin trunk + drooping fronds
  if (palms.length) {
    group.add(instanced(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lam(0x8a6a4a), palms, (o, [x, y, z, s]) => { o.position.set(x, y + 3, z); o.rotation.z = (s - 0.5) * 0.15; }));
    const fronds = palms.flatMap((p) => Array.from({ length: 6 }, (_, k) => [...p, k]));
    group.add(instanced(new THREE.ConeGeometry(0.35, 2.6, 4), lam(0x4f9a6b), fronds, (o, [x, y, z, s, k]) => {
      const a = (k / 6) * Math.PI * 2 + s;
      o.position.set(x + Math.cos(a) * 0.9, y + 5.8, z + Math.sin(a) * 0.9);
      o.rotation.set(0, -a, Math.PI / 2 + 0.5); o.rotation.order = 'YZX';
    }));
    const nuts = palms.map((p) => p);
    group.add(instanced(new THREE.SphereGeometry(0.22, 6, 5), lam(0xd9a441), nuts, (o, [x, y, z]) => { o.position.set(x + 0.2, y + 5.6, z); o.scale.set(1.2, 1, 1); }));
  }
  group.add(instanced(new THREE.DodecahedronGeometry(0.7, 0), lam(0x6f6a78), rocks, (o, [x, y, z, s]) => { o.position.set(x, y + 0.25, z); o.scale.set(0.6 + s, 0.4 + s * 0.5, 0.6 + s * 0.8); o.rotation.y = s * 6; }));
  group.add(instanced(new THREE.IcosahedronGeometry(0.55, 0), lam(0x356b55), bushes, (o, [x, y, z, s]) => { o.position.set(x, y + 0.35, z); o.scale.set(1 + s, 0.7 + s * 0.4, 1 + s * 0.6); }));
  const flowerColors = [0xff9ec7, 0xfff6c2, 0xffffff, 0xf2c14e];
  flowerColors.forEach((c, ci) => {
    const fl = flowers.filter((_, i) => i % flowerColors.length === ci);
    group.add(instanced(new THREE.SphereGeometry(0.11, 6, 4), lam(c, c, 0.25), fl, (o, [x, y, z]) => { o.position.set(x, y + 0.2, z); }));
  });

  // --- Night 2: bamboo bridge made of planks (no railing, as specified) ---
  if (n === 2) {
    const planks = [];
    for (let x = 26.2; x <= 43.8; x += 0.55) planks.push([x]);
    group.add(instanced(new THREE.BoxGeometry(0.42, 0.14, 4.1), lam(0xb08d57), planks, (o, [x]) => { o.position.set(x, 0.02, 0); o.rotation.y = (Math.sin(x * 7) * 0.03); }));
    const poles = [];
    for (let x = 26; x <= 44; x += 3) { poles.push([x, -2.1]); poles.push([x, 2.1]); }
    group.add(instanced(new THREE.CylinderGeometry(0.12, 0.12, 12, 6), lam(0x9c7d47), poles, (o, [x, z]) => { o.position.set(x, -6, z); }));
  }

  // --- Night 3: detailed bell tower (same 2 m radius, 8 m tall footprint) ---
  if (n === 3) {
    const wood = lam(P.wood), roof = lam(0x8a3b2e), gold = lam(P.gold, P.gold, 0.3);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 8, 8), wood);
      pillar.position.set(Math.cos(a) * 1.6, 10, Math.sin(a) * 1.6); group.add(pillar);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.6, 16), lam(0x8c8494)); base.position.y = 6.3; group.add(base);
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.8, 8), roof); roof1.position.y = 14.6; group.add(roof1);
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 8), roof); roof2.position.y = 15.9; group.add(roof2);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), gold); tip.position.y = 16.9; group.add(tip);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 1.6, 16, 1, true), lam(P.gold, P.gold, 0.25));
    bell.material.side = THREE.DoubleSide; bell.position.y = 12.6; group.add(bell);
    anim.push((t) => { bell.rotation.z = Math.sin(t * 1.2) * 0.08; });
  }

  return (t) => { for (const f of anim) f(t); };
}

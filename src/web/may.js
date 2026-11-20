// Mây, the player character (visual only, Phase 4 creative). An original chibi child built from simple shapes:
// big head, white blouse, maroon jumpsuit with straps and puffy cuffs, red headscarf with small white flowers,
// nón lá (conical hat) on top, and a paper lantern on a short stick. Nothing here is read by the simulation.
// Front of the model is +Z (main.js turns the group with rotation.y = atan2(facing.x, facing.z)).
import * as THREE from 'three';

const MAROON = 0x7a1f2b, MAROON_DARK = 0x5c1520, SKIN = 0xf2d0a9, HAIR = 0x2a1a14, SHOE = 0x3b2a22;

export function makeMay(PALETTE) {
  const lam = (color, emissive = 0, ei = 0) => new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei });
  const mesh = (geo, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); return m; };
  const g = new THREE.Group();
  const blouse = lam(PALETTE.shirt), suit = lam(MAROON), suitDark = lam(MAROON_DARK), skin = lam(SKIN);
  const scarfMat = lam(PALETTE.scarf), flowerMat = lam(0xffffff, 0xffffff, 0.3);

  // --- legs: short maroon trousers with puffy cuffs, little shoes (each leg is a group so it can swing) ---
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group(); leg.position.set(side * 0.14, 0.42, 0);
    leg.add(mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.3, 10), suit, 0, -0.15, 0));
    const cuff = mesh(new THREE.SphereGeometry(0.15, 12, 8), suit, 0, -0.3, 0); cuff.scale.y = 0.6; leg.add(cuff);
    const shoe = mesh(new THREE.SphereGeometry(0.11, 10, 8), lam(SHOE), 0, -0.38, 0.04); shoe.scale.set(1, 0.55, 1.4); leg.add(shoe);
    g.add(leg);
    return leg;
  });

  // --- body: white blouse on top, maroon jumpsuit below with a bib and two straps ---
  const body = new THREE.Group(); g.add(body);
  body.add(mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.4, 14), suit, 0, 0.58, 0)); // jumpsuit lower part
  body.add(mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.28, 14), blouse, 0, 0.9, 0)); // blouse chest
  body.add(mesh(new THREE.BoxGeometry(0.3, 0.22, 0.06), suit, 0, 0.86, 0.23)); // bib
  for (const side of [-1, 1]) {
    const strap = mesh(new THREE.BoxGeometry(0.06, 0.32, 0.05), suitDark, side * 0.12, 0.92, 0.22); strap.rotation.x = -0.15; body.add(strap);
    const back = mesh(new THREE.BoxGeometry(0.06, 0.3, 0.05), suitDark, side * 0.12, 0.9, -0.24); back.rotation.x = 0.15; body.add(back);
    body.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), lam(PALETTE.gold), side * 0.12, 0.8, 0.27)); // buttons
  }
  const collar = mesh(new THREE.TorusGeometry(0.17, 0.04, 8, 16), blouse, 0, 1.04, 0); collar.rotation.x = Math.PI / 2; body.add(collar);

  // --- arms: puffy blouse sleeves, small hands; the right arm (−X side) holds the lantern stick ---
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group(); arm.position.set(side * 0.3, 0.98, 0);
    const puff = mesh(new THREE.SphereGeometry(0.12, 10, 8), blouse); puff.scale.set(1, 0.9, 1); arm.add(puff);
    arm.add(mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.28, 8), blouse, 0, -0.2, 0));
    arm.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), skin, 0, -0.36, 0));
    arm.rotation.z = side * 0.25;
    body.add(arm);
    return arm;
  });
  arms[0].rotation.x = -0.9; // right arm raised forward to hold the stick

  // --- head: big chibi head, hair fringe, eyes, rosy cheeks ---
  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.4, 20, 16), skin));
  const fringe = mesh(new THREE.SphereGeometry(0.41, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), lam(HAIR), 0, 0.04, 0.02);
  fringe.rotation.x = 0.35; head.add(fringe);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.055, 10, 8), lam(0x1a1210), side * 0.14, -0.02, 0.36); eye.scale.z = 0.5; head.add(eye);
    head.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), lam(0xffffff, 0xffffff, 0.6), side * 0.14 + 0.02, 0.01, 0.39)); // eye shine
    const cheek = mesh(new THREE.SphereGeometry(0.06, 8, 6), lam(0xf28b8b), side * 0.24, -0.12, 0.3); cheek.scale.z = 0.3; head.add(cheek);
  }
  const mouth = mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 10, Math.PI), lam(0x8a3b2e), 0, -0.14, 0.38); mouth.rotation.z = Math.PI; head.add(mouth);

  // --- red headscarf with small white flowers, tied at the back, under the hat ---
  const scarf = mesh(new THREE.SphereGeometry(0.43, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), scarfMat, 0, 0.02, -0.03);
  scarf.rotation.x = -0.45; head.add(scarf); // pulled back so the face and fringe show
  for (let i = 0; i < 14; i++) { // little white flowers dotted over the scarf
    const a = (i / 14) * Math.PI * 2 + 0.3, up = 0.25 + (i % 3) * 0.12;
    const dir = new THREE.Vector3(Math.cos(a) * Math.sin(up * 2.2), Math.cos(up * 2.2), Math.sin(a) * Math.sin(up * 2.2));
    dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.45);
    if (dir.z > 0.55) continue; // keep flowers off the face
    const f = mesh(new THREE.SphereGeometry(0.03, 6, 4), flowerMat); f.position.copy(dir.multiplyScalar(0.44)).add(new THREE.Vector3(0, 0.02, -0.03));
    head.add(f);
  }
  const knot = mesh(new THREE.SphereGeometry(0.08, 8, 6), scarfMat, 0, -0.2, -0.38); head.add(knot);
  for (const side of [-1, 1]) { // two scarf tails
    const tail = mesh(new THREE.ConeGeometry(0.07, 0.28, 6), scarfMat, side * 0.07, -0.34, -0.4); tail.rotation.set(0.3, 0, side * 0.35 + Math.PI); head.add(tail);
  }

  // --- nón lá: wide conical hat with woven rings and a chin strap ---
  const hat = new THREE.Group(); hat.position.y = 0.36; head.add(hat);
  hat.add(mesh(new THREE.ConeGeometry(0.85, 0.42, 32, 1, true), new THREE.MeshLambertMaterial({ color: PALETTE.sand, side: THREE.DoubleSide }), 0, 0.12, 0));
  const ringMat = lam(0xa8915f);
  for (const r of [0.28, 0.5, 0.72]) {
    const ring = mesh(new THREE.TorusGeometry(r, 0.012, 4, 32), ringMat, 0, 0.33 - r * 0.49, 0); ring.rotation.x = Math.PI / 2; hat.add(ring);
  }

  // --- lantern on a stick, held in the right hand (the glowing part is `lamp`, used by main.js) ---
  const stick = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), lam(PALETTE.wood), -0.42, 1.05, 0.42);
  stick.rotation.x = 0.9; body.add(stick);
  const lanternGroup = new THREE.Group(); lanternGroup.position.set(-0.42, 1.12, 0.72); body.add(lanternGroup);
  lanternGroup.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 4), lam(0x222222), 0, 0.02, 0)); // string
  const lamp = mesh(new THREE.SphereGeometry(0.14, 14, 10), lam(0xe8402a, 0xff7a30, 0.9), 0, -0.16, 0);
  lamp.scale.y = 1.25; lanternGroup.add(lamp);
  for (const dy of [-0.01, -0.31]) lanternGroup.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), lam(PALETTE.gold), 0, dy, 0));
  lanternGroup.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 6), lam(PALETTE.gold), 0, -0.38, 0)); // tassel
  const light = new THREE.PointLight(0xffa040, 2, 10, 1.5); light.position.set(-0.42, 0.96, 0.72); body.add(light);

  // Small idle/walk animation: legs swing and the body bobs while moving; the lantern sways a little.
  let last = null;
  function animate(t, pos, reducedMotion) {
    const moving = last && Math.hypot(pos[0] - last[0], pos[2] - last[2]) > 0.001;
    last = [pos[0], pos[1], pos[2]];
    const s = reducedMotion ? 0 : moving ? Math.sin(t * 12) : 0;
    legs[0].rotation.x = s * 0.5; legs[1].rotation.x = -s * 0.5;
    arms[1].rotation.x = -s * 0.4;
    body.position.y = moving && !reducedMotion ? Math.abs(s) * 0.04 : 0;
    lanternGroup.rotation.z = reducedMotion ? 0 : Math.sin(t * 2.5) * 0.12 + s * 0.08;
  }

  g.scale.setScalar(1.2); // a bit bigger so Mây reads well from the follow camera (display only)
  g.userData = { lamp, light, animate };
  return g;
}

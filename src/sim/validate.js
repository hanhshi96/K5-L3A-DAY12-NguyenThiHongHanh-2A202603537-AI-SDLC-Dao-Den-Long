// Strict validation of inputs/scenario files. Any problem -> FormatError (exit code 2).
export class FormatError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
function need(cond, msg) { if (!cond) throw new FormatError(msg); }

export function validateInputs(doc) {
  need(isObj(doc), 'inputs: root must be an object');
  need(Array.isArray(doc.frames), 'inputs: "frames" must be an array');
  let last = -1;
  doc.frames.forEach((f, i) => {
    need(isObj(f), `inputs: frame ${i} must be an object`);
    need(isInt(f.tick) && f.tick >= 0, `inputs: frame ${i} tick must be a non-negative integer`);
    need(f.tick > last, `inputs: frame ${i} tick must be strictly increasing`);
    last = f.tick;
    if ('move' in f) {
      need(Array.isArray(f.move) && f.move.length === 2 && f.move.every((x) => isNum(x) && x >= -1 && x <= 1),
        `inputs: frame ${i} move must be [x,z] with components in [-1,1]`);
    }
    if ('cam_yaw_deg' in f) need(isNum(f.cam_yaw_deg), `inputs: frame ${i} cam_yaw_deg must be a number`);
    for (const k of ['jump', 'interact', 'pulse', 'dash']) {
      if (k in f) need(typeof f[k] === 'boolean', `inputs: frame ${i} ${k} must be boolean`);
    }
  });
  return doc;
}

export function validateScenario(doc) {
  need(isObj(doc), 'scenario: root must be an object');
  if ('player' in doc) {
    const p = doc.player;
    need(isObj(p), 'scenario: player must be an object');
    if ('pos' in p) need(isVec3(p.pos), 'scenario: player.pos must be [x,y,z]');
    if ('carried' in p) need(isInt(p.carried) && p.carried >= 0, 'scenario: player.carried must be int >= 0');
    if ('flames' in p) need(isInt(p.flames) && p.flames >= 0, 'scenario: player.flames must be int >= 0');
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (k in doc) need(typeof doc[k] === 'boolean', `scenario: ${k} must be boolean`);
  }
  if ('motes' in doc) {
    need(Array.isArray(doc.motes) && doc.motes.every(isVec3), 'scenario: motes must be an array of [x,y,z]');
  }
  if ('shades' in doc) {
    need(Array.isArray(doc.shades), 'scenario: shades must be an array');
    const ids = new Set();
    doc.shades.forEach((s, i) => {
      need(isObj(s) && isVec3(s.pos), `scenario: shades[${i}].pos must be [x,y,z]`);
      if ('id' in s) {
        need(typeof s.id === 'string' && s.id.length > 0, `scenario: shades[${i}].id must be a string`);
        need(!ids.has(s.id), `scenario: duplicate shade id ${s.id}`);
        ids.add(s.id);
      }
    });
  }
  if ('lanterns' in doc) {
    need(Array.isArray(doc.lanterns), 'scenario: lanterns must be an array');
    doc.lanterns.forEach((l, i) => {
      need(isObj(l) && typeof l.id === 'string', `scenario: lanterns[${i}].id must be a string`);
      need(/^L[1-5]$/.test(l.id), `scenario: unknown lantern id ${l.id}`);
      if ('pos' in l) need(isVec3(l.pos), `scenario: lanterns[${i}].pos must be [x,y,z]`);
      if ('deposited' in l) need(isInt(l.deposited) && l.deposited >= 0, `scenario: lanterns[${i}].deposited must be int >= 0`);
      if ('lit' in l) need(typeof l.lit === 'boolean', `scenario: lanterns[${i}].lit must be boolean`);
    });
  }
  if ('time_left_s' in doc) need(isNum(doc.time_left_s) && doc.time_left_s > 0, 'scenario: time_left_s must be > 0');
  return doc;
}

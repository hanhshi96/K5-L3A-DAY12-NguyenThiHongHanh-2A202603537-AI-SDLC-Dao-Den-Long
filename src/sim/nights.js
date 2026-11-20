// Standard maps (Ticket-02 Part 2). Angle θ from +X, point = (r·cosθ, y, r·sinθ) (spec G15).
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
export const angPoint = (r, deg, y = 0, cx = 0, cz = 0) => {
  const a = (deg * Math.PI) / 180;
  return [r3(cx + r * Math.cos(a)), y, r3(cz + r * Math.sin(a))];
};
const ring = (r, startDeg, stepDeg, n, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => angPoint(r, startDeg + i * stepDeg, y, cx, cz));

export const TOWER_H = 14; // bell tower top (6 + 8), not climbable

// Night 3 terrain: floor 0 (r<=45), floor 1 ring 12–24 on z>0 (Y=3), floor 2 disc r<=8 (Y=6),
// ramps 3 m wide at 30° and 150° from r=30 (Y=0) to r=24 (Y=3), tower r<=2.
function ground3(x, z) {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  if (r <= 2) return TOWER_H;
  if (r <= 8) return 6;
  if (z > 0 && r >= 12 && r <= 24) return 3;
  for (const deg of [30, 150]) {
    const a = (deg * Math.PI) / 180, ux = Math.cos(a), uz = Math.sin(a);
    const along = x * ux + z * uz, perp = Math.abs(-x * uz + z * ux);
    if (perp <= 1.5 && along >= 24 && along <= 30) return (3 * (30 - along)) / 6;
  }
  return 0;
}

function toward(from, to, speed) {
  const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz);
  return [(dx / d) * speed, (dz / d) * speed];
}

export const NIGHTS = {
  1: {
    name: 'Đảo Bến', duration_s: 300, start: [0, 0, 0], shade_speed: 4, shade_every: 480, shade_max: 6,
    drifters: false, wind: false,
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
    shadePoints: ring(37, 15, 30, 12),
    charms: [], pads: [],
    ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  },
  2: {
    name: 'Đảo Cau', duration_s: 330, start: [0, 0, 0], shade_speed: 4, shade_every: 420, shade_max: 8,
    drifters: true, wind: false,
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [0, 70].flatMap((cx) => [...ring(10, 0, 90, 4, 0, cx), ...ring(22, 0, 45, 8, 0, cx)]),
    shadePoints: [0, 70].flatMap((cx) => ring(26, 22.5, 45, 8, 0, cx)),
    charms: [[35, 0, 0]],
    pads: [
      { pos: [20, 0, 18], r: 1, vy: 14, h: toward([20, 0, 18], [70, 0, 0], 24) },
      { pos: [50, 0, -18], r: 1, vy: 14, h: toward([50, 0, -18], [0, 0, 0], 24) },
    ],
    ground: (x, z) =>
      Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28 || (x >= 26 && x <= 44 && z >= -2 && z <= 2) ? 0 : null,
  },
  3: {
    name: 'Đảo Chuông', duration_s: 360, start: [0, 0, -30], shade_speed: 4.5, shade_every: 360, shade_max: 10,
    drifters: true, wind: true,
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(34, 0, 20, 18, 0), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
    shadePoints: ring(43, 0, 22.5, 16),
    charms: [[30, 0, 25], [-30, 0, 25]],
    pads: [{ pos: [0, 3, 13], r: 1, vy: 12, h: [0, -8] }],
    ground: ground3,
  },
};

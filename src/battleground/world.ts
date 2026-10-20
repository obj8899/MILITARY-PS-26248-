// Shared geometry for the 3D battleground: lon/lat -> world metres, terrain height,
// river centreline and track polylines. Pure functions, used by the 3D engine,
// the minimap and the simulation so they can never disagree about where things are.

export const WORLD_W = 220;
export const WORLD_D = 190;
/** Approximate ground metres represented by one world unit (map is ~8 km wide). */
export const METRES_PER_UNIT = 37.6;

const B = { minLon: 77.97, maxLon: 78.05, minLat: 22.48, maxLat: 22.545 };

export type XZ = [number, number];

export function toWorld(lon: number, lat: number): XZ {
  const x = ((lon - B.minLon) / (B.maxLon - B.minLon) - 0.5) * WORLD_W;
  const z = -((lat - B.minLat) / (B.maxLat - B.minLat) - 0.5) * WORLD_D;
  return [x, z];
}

export function dist(a: XZ, b: XZ): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function metres(units: number): number {
  return Math.round(units * METRES_PER_UNIT);
}

/** Bearing in degrees (0 = north, clockwise) from a to b. */
export function bearing(a: XZ, b: XZ): number {
  const dx = b[0] - a[0];
  const dz = -(b[1] - a[1]);
  return (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
}

// ---------- deterministic noise ----------
function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
export function fbm(x: number, y: number, oct = 4): number {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += valueNoise(x * f, y * f) * amp; f *= 2; amp *= 0.5; }
  return v;
}
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- named places (from the scenario fixture) ----------
export const PLACES = {
  ford: toWorld(78.008, 22.514),
  bridge: toWorld(78.018, 22.532),
  ridge: toWorld(77.994, 22.528),
  fup: toWorld(77.986, 22.496),
  hq: toWorld(77.991, 22.507),
  hawk2: toWorld(78.001, 22.505),
  hawk3: toWorld(77.982, 22.515),
} as const;

// ---------- river ----------
const RIVER_CTRL: XZ[] = [
  [38, -110], [26, -80], [PLACES.bridge[0], PLACES.bridge[1]], [10, -32],
  [PLACES.ford[0], PLACES.ford[1]], [-1, 26], [10, 56], [22, 100],
];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
export function sampleSpline(ctrl: XZ[], perSeg = 24): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg;
      out.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
export const RIVER: XZ[] = sampleSpline(RIVER_CTRL, 20);

function distToPolyline(x: number, z: number, line: XZ[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1];
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) best = d;
  }
  return best;
}
export const riverDistance = (x: number, z: number) => distToPolyline(x, z, RIVER);

// ---------- tracks (dirt roads) ----------
export const TRACKS: XZ[][] = [
  sampleSpline([[-70, 78], PLACES.fup, [-60, 30], PLACES.hq, PLACES.hawk2, [-14, 8], PLACES.ford], 14),
  sampleSpline([PLACES.hq, [-64, 6], PLACES.hawk3, [-70, -28], [-58, -44]], 14),
  sampleSpline([PLACES.ford, [4, -14], [14, -40], PLACES.bridge, [30, -80], [44, -105]], 14),
  sampleSpline([PLACES.hawk2, [-30, -10], [-40, -28], [-34, -46], [-10, -52], PLACES.bridge], 14),
  sampleSpline([PLACES.ford, [30, 6], [62, 14], [100, 4]], 14),
];
export const trackDistance = (x: number, z: number) => Math.min(...TRACKS.map((t) => distToPolyline(x, z, t)));

// ---------- terrain ----------
const ridgeA: XZ = [-74, -22];
const ridgeB: XZ = [-18, -64];

function ridgeLift(x: number, z: number): number {
  // elongated ridge along A->B
  const dx = ridgeB[0] - ridgeA[0], dz = ridgeB[1] - ridgeA[1];
  const l2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - ridgeA[0]) * dx + (z - ridgeA[1]) * dz) / l2));
  const d = Math.hypot(x - (ridgeA[0] + dx * t), z - (ridgeA[1] + dz * t));
  const along = Math.sin(t * Math.PI);
  return 30 * Math.exp(-(d * d) / 260) * (0.45 + 0.55 * along);
}

export function terrainHeight(x: number, z: number): number {
  const base = 2.4 + fbm(x * 0.021 + 11, z * 0.021 + 7, 4) * 9 - 3;
  const east = Math.max(0, x - 40) * 0.09 * (0.5 + fbm(x * 0.03, z * 0.03, 2)); // rising ground east
  const far = Math.max(0, Math.hypot(x, z * 1.15) - 120) * 0.12; // map-edge bowl
  let h = base + ridgeLift(x, z) + east + far;
  const rd = riverDistance(x, z);
  const banks = smooth(Math.min(1, Math.max(0, (rd - 3.2) / 11)));
  const bed = -1.6 + 0.5 * fbm(x * 0.2, z * 0.2, 2);
  h = bed + (Math.max(h, 1.1) - bed) * banks;
  // the FORD: a raised gravel bar across the riverbed
  const fd = Math.hypot(x - PLACES.ford[0], z - PLACES.ford[1]);
  h += Math.exp(-(fd * fd) / 55) * (-0.05 - bed) * (1 - banks) * 1.0;
  // flatten pads under the bridge approaches and HQ
  const pad = (p: XZ, r: number, y: number) => {
    const d = Math.hypot(x - p[0], z - p[1]);
    if (d < r) { const k = smooth(1 - d / r); h = h + (y - h) * k * 0.85; }
  };
  pad(PLACES.hq, 9, 3.2); pad(PLACES.fup, 9, 3.4); pad(PLACES.hawk2, 6, 3.0); pad(PLACES.hawk3, 6, 3.4);
  return h;
}

export const WATER_LEVEL = 0.05;

export function forestDensity(x: number, z: number): number {
  return fbm(x * 0.045 + 40, z * 0.045 - 13, 3);
}

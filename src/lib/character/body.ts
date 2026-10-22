// ─────────────────────────────────────────────────────────────
// سازنده‌ی بدن اناتومیک — SkinnedMesh با وزن‌دهی نرم مفصلی
// بدن از کپسول/لاته/کره ساخته می‌شود، سپس برای هر رأس،
// وزن دو استخوانِ نزدیک (فاصله نقطه-پاره‌خط) محاسبه می‌شود.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BONE_ORDER, BONE_WORLD, BONE_TIP } from './skeleton';
import type { RacePreset } from './types';

export type MatKey = 'skin' | 'outfit' | 'pants' | 'boots' | 'metal';
export const MATERIAL_KEYS: MatKey[] = ['skin', 'outfit', 'pants', 'boots', 'metal'];

interface Seg { bone: string; a: THREE.Vector3; b: THREE.Vector3; }

export interface BodyParams {
  race: RacePreset;
  width: number;   // bulk × race.width
}

// ── ابزارهای هندسی ───────────────────────────────────────────
function capsuleX(r: number, len: number, cx: number, cy: number, cz: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, 6, 14);
  g.rotateZ(Math.PI / 2);
  g.translate(cx, cy, cz);
  return g;
}
function capsuleY(r: number, len: number, cx: number, cy: number, cz: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, 6, 14);
  g.translate(cx, cy, cz);
  return g;
}
function sphere(rx: number, ry: number, rz: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 22, 16);
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}
function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

// ── ساخت قطعات بدن ───────────────────────────────────────────
function buildParts(p: BodyParams): Map<MatKey, THREE.BufferGeometry[]> {
  const { race, width: W } = p;
  const k = Math.pow(W, 0.62);          // ضخامت اندام‌ها
  const hw = 1 + (W - 1) * 0.35;        // ضریب سر
  const parts: Map<MatKey, THREE.BufferGeometry[]> = new Map();
  const add = (m: MatKey, g: THREE.BufferGeometry) => {
    if (!parts.has(m)) parts.set(m, []);
    parts.get(m)!.push(g);
  };

  // ── لگن ──
  add('pants', sphere(0.155 * W, 0.118, 0.108 * W, 0, 0.968, 0));

  // ── تنه (لاته) ──
  const profile: [number, number][] = [
    [0.02, 0.952], [0.138, 0.962], [0.144, 1.0], [0.13, 1.06], [0.132, 1.12],
    [0.15, 1.2], [0.165, 1.3], [0.172, 1.375], [0.165, 1.43], [0.148, 1.462],
    [0.095, 1.488], [0.02, 1.494],
  ];
  const lathe = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r * W, y)), 26,
  );
  lathe.scale(1, 1, 0.74 * Math.pow(W, 0.5));
  add('outfit', lathe);

  // ── کمربند و سینه‌پهن ──
  const belt = new THREE.TorusGeometry(0.152 * W, 0.027, 12, 30);
  belt.rotateX(Math.PI / 2);
  belt.scale(1, 1, 0.76 * Math.pow(W, 0.5));
  belt.translate(0, 1.043, 0);
  add('metal', belt);
  add('metal', box(0.062, 0.055, 0.024, 0, 1.043, 0.118 * W));

  // ── شانه‌پوش (پلد) ──
  const px = 0.165 + 0.05 * W;
  for (const s of [1, -1] as const) {
    const pad = sphere(0.095, 0.068, 0.085, s * px, 1.455, 0);
    add('metal', pad);
  }

  // ── گردن ──
  add('skin', capsuleY(0.048 * (1 + (W - 1) * 0.3), 0.09, 0, 1.525, 0));

  // ── سر ──
  const [hx, hy, hz] = race.headShape;
  add('skin', sphere(0.115 * hx * hw, 0.115 * hy, 0.115 * hz * hw, 0, 1.665, 0.008));
  if (race.jaw) {
    add('skin', box(0.135, 0.072, 0.105, 0, 1.612, 0.05, -0.1));
    add('skin', box(0.15, 0.032, 0.07, 0, 1.708, 0.082, -0.15)); // ابروی غارتی
  } else if (race.browRidge) {
    add('skin', box(0.13, 0.028, 0.055, 0, 1.712, 0.08, -0.12));
  }

  // ── بازوها ──
  for (const s of [1, -1] as const) {
    const S = s > 0 ? 'L' : 'R';
    add('outfit', capsuleX(0.056 * k, 0.148, s * 0.33, 1.47, 0));
    add('outfit', capsuleX(0.047 * k, 0.128, s * 0.57, 1.47, 0));
    add('skin', sphere(0.052 * k, 0.052 * k * 0.62, 0.052 * k * 1.05, s * 0.725, 1.468, 0));
    void S;
  }

  // ── پاها ──
  for (const s of [1, -1] as const) {
    add('pants', capsuleY(0.079 * k, 0.283, s * 0.11, 0.72, 0));
    add('boots', capsuleY(0.057 * k, 0.298, s * 0.11, 0.295, 0.012));
    add('boots', box(0.096 * k, 0.075, 0.235, s * 0.11, 0.045, 0.07));
    add('boots', sphere(0.05 * k, 0.04, 0.055, s * 0.11, 0.038, 0.185));
  }

  return parts;
}

// ── وزن‌دهی اسکین ────────────────────────────────────────────
function distPointSeg(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function buildSegments(boneIndex: Record<string, number>): Seg[] {
  return BONE_ORDER.map((name) => ({
    bone: name,
    a: new THREE.Vector3(...BONE_WORLD[name]),
    b: new THREE.Vector3(...BONE_TIP[name]),
    idx: boneIndex[name],
  })) as Seg[] & { idx: number }[];
}

function applySkinWeights(geo: THREE.BufferGeometry, segs: (Seg & { idx: number })[]) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  const v = new THREE.Vector3();
  const cand: { i: number; w: number }[] = [];

  for (let vi = 0; vi < n; vi++) {
    v.fromBufferAttribute(pos, vi);
    cand.length = 0;
    for (const s of segs) {
      const d = distPointSeg(v, s.a, s.b);
      cand.push({ i: s.idx, w: 1 / Math.pow(d + 0.004, 3.1) });
    }
    cand.sort((x, y) => y.w - x.w);
    const t = cand[0].w + cand[1].w;
    si[vi * 4] = cand[0].i; sw[vi * 4] = cand[0].w / t;
    si[vi * 4 + 1] = cand[1].i; sw[vi * 4 + 1] = cand[1].w / t;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}

// ── خروجی ────────────────────────────────────────────────────
export interface BodyBuild {
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[]; // به ترتیب MATERIAL_KEYS
}

export function buildBody(p: BodyParams, boneIndex: Record<string, number>, mats: Record<MatKey, THREE.Material>): BodyBuild {
  const parts = buildParts(p);
  const perMat: THREE.BufferGeometry[] = [];
  for (const key of MATERIAL_KEYS) {
    const list = parts.get(key) ?? [];
    const merged = mergeGeometries(list, false)!;
    list.forEach((g) => g.dispose());
    perMat.push(merged);
  }
  const geo = mergeGeometries(perMat, true)!;
  perMat.forEach((g) => g.dispose());
  applySkinWeights(geo, buildSegments(boneIndex) as (Seg & { idx: number })[]);
  geo.computeBoundingSphere();
  return {
    geometry: geo,
    materials: MATERIAL_KEYS.map((k) => mats[k]),
  };
}

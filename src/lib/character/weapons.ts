// ─────────────────────────────────────────────────────────────
// سلاح‌ها — به استخوان‌های دست وصل می‌شوند
// قرارداد: دست راست روی محور −X (جهت بازو)، +Z جلو.
// تیغه در راستای بازو ساخته می‌شود تا وقتی بازو آویزان است،
// سلاح طبیعی رو به پایین carried شود.
// مبدأ استخوان handR: (−0.68, 1.47, 0) — handL: (+0.68, 1.47, 0)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharConfig } from './types';

export type WeaponId = 'none' | 'sword' | 'axe' | 'mace' | 'bow' | 'staff' | 'swordShield';

export const WEAPONS: { id: WeaponId; label: string; desc: string }[] = [
  { id: 'none', label: 'بدون سلاح', desc: 'دست خالی' },
  { id: 'sword', label: 'شمشیر', desc: 'تیغ فولادی یک‌دست' },
  { id: 'axe', label: 'تبر جنگی', desc: 'تبر بربرها' },
  { id: 'mace', label: 'گرز خاردار', desc: 'سلاح ستبرها' },
  { id: 'bow', label: 'کمان', desc: 'کمان بلند کماندارها' },
  { id: 'staff', label: 'عصای جادو', desc: 'عصای افسون‌خوان‌ها' },
  { id: 'swordShield', label: 'شمشیر و سپر', desc: 'تجهیز کامل پالادین' },
];

export type WeaponMats = {
  metal: THREE.Material;
  boots: THREE.Material; // چرم/چوب
  outfit: THREE.Material;
  ivory: THREE.Material;
  iris: THREE.Material;
};

// ── ابزارهای هندسی (مختصات محلی سلاح) ────────────────────────
function boxG(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}
function cylG(r: number, h: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'x'): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, 12);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
function coneG(r: number, h: number, pos: [number, number, number], dir: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, 10);
  g.translate(0, h / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(...dir).normalize(),
  );
  g.applyQuaternion(q);
  g.translate(...pos);
  return g;
}
function torusG(r: number, tube: number, x: number, y: number, z: number, face: 'z' | 'x' = 'z'): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, tube, 10, 28);
  if (face === 'x') g.rotateY(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
function sphereG(r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 18, 12);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = mergeGeometries(list, false)!;
  list.forEach((g) => g.dispose());
  return out;
}

type Part = { geo: THREE.BufferGeometry; mat: keyof WeaponMats };

function assemble(parts: Part[], mats: WeaponMats): THREE.Group {
  const group = new THREE.Group();
  const byMat = new Map<keyof WeaponMats, THREE.BufferGeometry[]>();
  for (const p of parts) {
    if (!byMat.has(p.mat)) byMat.set(p.mat, []);
    byMat.get(p.mat)!.push(p.geo);
  }
  for (const [key, geos] of byMat) {
    const mesh = new THREE.Mesh(merge(geos), mats[key]);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

// ── شمشیر (دست راست، تیغه رو به −X) ──────────────────────────
function buildSword(mats: WeaponMats): THREE.Group {
  const parts: Part[] = [
    { geo: sphereG(0.024, 0.014, 0, 0.01), mat: 'metal' },                       // گوی انتهای دسته
    { geo: cylG(0.016, 0.11, -0.055, 0, 0.01), mat: 'boots' },                   // دسته چرمی
    { geo: boxG(0.022, 0.15, 0.032, -0.118, 0, 0.01), mat: 'metal' },            // گارد
    { geo: boxG(0.48, 0.052, 0.013, -0.375, 0, 0.01), mat: 'metal' },            // تیغه
    { geo: coneG(0.027, 0.09, [-0.657, 0, 0.01], [-1, 0, 0]), mat: 'metal' },    // نوک
  ];
  return assemble(parts, mats);
}

// ── تبر جنگی (دست راست) ──────────────────────────────────────
function buildAxe(mats: WeaponMats): THREE.Group {
  const parts: Part[] = [
    { geo: cylG(0.015, 0.7, -0.27, 0, 0.015), mat: 'boots' },                    // دسته چوبی
    { geo: boxG(0.055, 0.2, 0.022, -0.52, 0.055, 0.015), mat: 'metal' },         // تیغه اصلی
    { geo: boxG(0.075, 0.09, 0.02, -0.5, 0.135, 0.015), mat: 'metal' },          // لبه خمیده
    { geo: boxG(0.04, 0.08, 0.02, -0.53, -0.05, 0.015), mat: 'metal' },          // سیخ پشت
    { geo: torusG(0.021, 0.006, -0.44, 0, 0.015, 'x'), mat: 'metal' },           // حلقه دور دسته
  ];
  return assemble(parts, mats);
}

// ── گرز خاردار (دست راست) ────────────────────────────────────
function buildMace(mats: WeaponMats): THREE.Group {
  const C: [number, number, number] = [-0.4, 0, 0.012];
  const parts: Part[] = [
    { geo: cylG(0.014, 0.42, -0.17, 0, 0.012), mat: 'boots' },
    { geo: sphereG(0.052, ...C), mat: 'metal' },
    { geo: coneG(0.014, 0.05, [C[0] - 0.05, C[1], C[2]], [-1, 0, 0]), mat: 'metal' },
    { geo: coneG(0.014, 0.05, [C[0], C[1] + 0.05, C[2]], [0, 1, 0]), mat: 'metal' },
    { geo: coneG(0.014, 0.05, [C[0], C[1] - 0.05, C[2]], [0, -1, 0]), mat: 'metal' },
    { geo: coneG(0.014, 0.05, [C[0], C[1], C[2] + 0.05], [0, 0, 1]), mat: 'metal' },
    { geo: coneG(0.014, 0.05, [C[0], C[1], C[2] - 0.05], [0, 0, -1]), mat: 'metal' },
    { geo: torusG(0.019, 0.005, -0.33, 0, 0.012, 'x'), mat: 'metal' },
  ];
  return assemble(parts, mats);
}

// ── کمان بلند (دست چپ، دسته در مبدأ، کمان رو به +Y محلی) ─────
function buildBow(mats: WeaponMats): THREE.Group {
  const ARC = 2.4;
  const R = 0.5;
  const limbs = new THREE.TorusGeometry(R, 0.013, 8, 28, ARC);
  limbs.rotateZ(Math.PI / 2 - ARC / 2); // قوس رو به +Y
  limbs.translate(0, -R, 0);            // دسته (وسط کمان) در مبدأ
  const endY = R * Math.cos(ARC / 2) - R; // ارتفاع دو سر کمان (≈ −0.316)
  const parts: Part[] = [
    { geo: limbs, mat: 'boots' },
    { geo: cylG(0.0035, R * 2 * Math.sin(ARC / 2), 0, endY, 0), mat: 'ivory' }, // زه
    { geo: boxG(0.03, 0.1, 0.034, 0, 0.005, 0), mat: 'outfit' },                // پیچ دسته
  ];
  return assemble(parts, mats);
}

// ── عصای جادو (دست راست) ─────────────────────────────────────
function buildStaff(mats: WeaponMats): THREE.Group {
  const parts: Part[] = [
    { geo: cylG(0.016, 1.28, -0.02, 0, 0.012), mat: 'boots' },                  // بدنه چوبی
    { geo: torusG(0.024, 0.007, 0.6, 0, 0.012, 'x'), mat: 'metal' },            // نگین‌گیر
    { geo: sphereG(0.045, 0.665, 0, 0.012), mat: 'iris' },                      // گوی جادو
  ];
  return assemble(parts, mats);
}

// ── سپر گرد (بازوی چپ، رو به +Z) ─────────────────────────────
function buildShield(mats: WeaponMats): THREE.Group {
  const parts: Part[] = [
    { geo: cylG(0.185, 0.026, 0.11, 0, 0.095, 'z'), mat: 'metal' },             // صفحه سپر
    { geo: torusG(0.185, 0.01, 0.11, 0, 0.113), mat: 'metal' },                 // لبه
    { geo: sphereG(0.044, 0.11, 0, 0.124, 1, 1, 0.55), mat: 'metal' },          // سینه سپر
  ];
  return assemble(parts, mats);
}

// ── ساخت و اتصال به اسکلت ────────────────────────────────────
export function buildWeapons(
  cfg: CharConfig,
  mats: WeaponMats,
  byName: Record<string, THREE.Object3D>,
): THREE.Group | null {
  const w = cfg.weapon;
  if (!w || w === 'none') return null;
  const group = new THREE.Group();
  group.name = 'weapons';

  const attach = (bone: string, obj: THREE.Object3D) => {
    const b = byName[bone];
    if (b) b.add(obj);
  };

  if (w === 'sword' || w === 'swordShield') attach('handR', buildSword(mats));
  if (w === 'axe') attach('handR', buildAxe(mats));
  if (w === 'mace') attach('handR', buildMace(mats));
  if (w === 'bow') attach('handL', buildBow(mats));
  if (w === 'staff') attach('handR', buildStaff(mats));
  if (w === 'swordShield') attach('lowerArmL', buildShield(mats));

  return group.children.length ? group : null;
}

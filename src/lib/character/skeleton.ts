// ─────────────────────────────────────────────────────────────
// اسکلت استاندارد هیومنوید — T-Pose
// این اسکلت مرجع (canonical) است: انیمیشن‌ها روی آن ساخته می‌شوند
// و سپس به هر مدل استاندارد دیگری Retarget می‌شوند.
// واحد: متر — قد مرجع: ~1.78m — رو به +Z
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

/** نام استخوان‌ها به ترتیب top-down (برای FK و skinIndex) */
export const BONE_ORDER = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'lowerArmL', 'handL',
  'upperArmR', 'lowerArmR', 'handR',
  'upperLegL', 'lowerLegL', 'footL',
  'upperLegR', 'lowerLegR', 'footR',
] as const;

export type BoneName = (typeof BONE_ORDER)[number];

/** والد هر استخوان در همان ترتیب */
export const BONE_PARENT: Record<BoneName, string | null> = {
  hips: null,
  spine: 'hips',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  upperArmL: 'chest', lowerArmL: 'upperArmL', handL: 'lowerArmL',
  upperArmR: 'chest', lowerArmR: 'upperArmR', handR: 'lowerArmR',
  upperLegL: 'hips', lowerLegL: 'upperLegL', footL: 'lowerLegL',
  upperLegR: 'hips', lowerLegR: 'upperLegR', footR: 'lowerLegR',
};

/** موقعیت محلی هر استخوان نسبت به والدش (meters) */
export const BONE_LOCAL: Record<BoneName, [number, number, number]> = {
  hips: [0, 0.98, 0],
  spine: [0, 0.14, 0],
  chest: [0, 0.16, 0],
  neck: [0, 0.22, 0],
  head: [0, 0.10, 0],
  upperArmL: [0.20, 0.19, 0],
  lowerArmL: [0.26, 0, 0],
  handL: [0.22, 0, 0],
  upperArmR: [-0.20, 0.19, 0],
  lowerArmR: [-0.26, 0, 0],
  handR: [-0.22, 0, 0],
  upperLegL: [0.11, -0.04, 0],
  lowerLegL: [0, -0.44, 0],
  footL: [0, -0.41, 0.02],
  upperLegR: [-0.11, -0.04, 0],
  lowerLegR: [0, -0.44, 0],
  footR: [0, -0.41, 0.02],
};

/** موقعیت جهانی مرجع هر استخوان در T-Pose (بدون مقیاس) */
export const BONE_WORLD: Record<BoneName, [number, number, number]> = (() => {
  const out = {} as Record<BoneName, [number, number, number]>;
  for (const b of BONE_ORDER) {
    const p = BONE_PARENT[b];
    const l = BONE_LOCAL[b];
    if (!p) { out[b] = [...l]; continue; }
    const pw = out[p as BoneName];
    out[b] = [pw[0] + l[0], pw[1] + l[1], pw[2] + l[2]];
  }
  return out;
})();

/** انتهای هر استخوان برای ساخت segment وزن‌دهی */
export const BONE_TIP: Record<BoneName, [number, number, number]> = {
  hips: [...BONE_WORLD.spine],
  spine: [...BONE_WORLD.chest],
  chest: [...BONE_WORLD.neck],
  neck: [...BONE_WORLD.head],
  head: [0, 1.78, 0],                 // headTop
  upperArmL: [...BONE_WORLD.lowerArmL],
  lowerArmL: [...BONE_WORLD.handL],
  handL: [0.78, 1.47, 0],
  upperArmR: [...BONE_WORLD.lowerArmR],
  lowerArmR: [...BONE_WORLD.handR],
  handR: [-0.78, 1.47, 0],
  upperLegL: [...BONE_WORLD.lowerLegL],
  lowerLegL: [...BONE_WORLD.footL],
  footL: [0.11, 0.03, 0.17],
  upperLegR: [...BONE_WORLD.lowerLegR],
  lowerLegR: [...BONE_WORLD.footR],
  footR: [-0.11, 0.03, 0.17],
};

/** درجه‌ی انیمیشن استخوان‌ها برای مرتب‌سازی FK */
export const BONE_DEPTH: Record<BoneName, number> = (() => {
  const d = {} as Record<BoneName, number>;
  for (const b of BONE_ORDER) {
    let n = 0, p: string | null = b;
    while (p) { p = BONE_PARENT[p as BoneName]; n++; }
    d[b] = n;
  }
  return d;
})();

export interface SkeletonBuild {
  rootBone: THREE.Bone;
  bones: THREE.Bone[];               // به ترتیب BONE_ORDER
  byName: Record<string, THREE.Bone>;
  skeleton: THREE.Skeleton;
}

/**
 * ساخت درخت استخوان با مقیاس‌های نژادی (یکنواخت ⇒ بدون shear)
 * heightScale روی hips اعمال می‌شود (کل بدن).
 */
export function createSkeleton(raceScales: Record<string, number>, heightScale: number): SkeletonBuild {
  const byName: Record<string, THREE.Bone> = {};

  for (const name of BONE_ORDER) {
    const bone = new THREE.Bone();
    bone.name = name;
    const l = BONE_LOCAL[name];
    bone.position.set(l[0], l[1], l[2]);
    const s = name === 'hips' ? heightScale : (raceScales[name] ?? 1);
    bone.scale.setScalar(s);
    byName[name] = bone;
  }
  for (const name of BONE_ORDER) {
    const p = BONE_PARENT[name];
    if (p) byName[p].add(byName[name]);
  }

  const bones = BONE_ORDER.map((n) => byName[n]);
  const rootBone = byName.hips;
  const skeleton = new THREE.Skeleton(bones);
  return { rootBone, bones, byName, skeleton };
}

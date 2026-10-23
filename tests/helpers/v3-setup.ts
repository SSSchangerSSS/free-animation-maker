// ─────────────────────────────────────────────────────────────
// راه‌انداز مشترک هارنس V3 — لود بدنه، نرمال‌سازی، ریتارگت proc،
// پروفایل سلاح داده‌محور از V3_WEAPONS + استخراج مرز گارد از هندسه.
// بین collision-v3 و offhand-grip مشترک است (بدون تکرار).
// ─────────────────────────────────────────────────────────────
import { expect } from 'vitest';
import * as THREE from 'three';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRig, type LoadedRig } from './glb-rig';
import { buildClipLibrary } from '../../src/lib/animation/clips';
import { detectHumanoidBones, measureRest, retargetClipCustom } from '../../src/lib/animation/retarget';
import { V3_WEAPONS } from '../../src/lib/character/weapons3';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

const here = path.dirname(fileURLToPath(import.meta.url));
export const V3_MODELS = path.join(here, '../../public/models/v3');

export function v3WeaponProfile(def: typeof V3_WEAPONS[string], guardTopRaw: number) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(def.rot[0], def.rot[1], def.rot[2], 'XYZ'));
  if (def.tweak?.rx) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), def.tweak.rx));
  if (def.tweak?.ry) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), def.tweak.ry));
  if (def.tweak?.rz) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), def.tweak.rz));
  const pos = new THREE.Vector3(...def.pos);
  if (def.tweak) pos.add(new THREE.Vector3(def.tweak.px ?? 0, def.tweak.py ?? 0, def.tweak.pz ?? 0));
  const toHand = (p: THREE.Vector3) =>
    p.clone().multiplyScalar(def.scale).applyQuaternion(q).add(pos);
  const grip = toHand(new THREE.Vector3(0, 0, 0));
  const bladeA = toHand(new THREE.Vector3(...def.bladeFrom));
  const bladeB = toHand(new THREE.Vector3(...def.bladeTo));
  // مرز واقعی گارد: نقطه‌ای روی محور Y خام که پهنای جانبی افت می‌کند
  // (گارد هرگز زیر شروع تیغهٔ جدول نمی‌آید — max با bladeFrom)
  const guardTop = Math.max(def.bladeFrom[1], guardTopRaw);
  const guardA = toHand(new THREE.Vector3(0, guardTop, 0));
  return {
    def,
    grip, bladeA, bladeB, guardA,
    slices: [
      { a: grip, b: bladeA, r: 0.03, zone: 'handle' as const, swept: false },
      { a: bladeA, b: guardA, r: 0.05, zone: 'handle' as const, swept: false }, // گارد روی دست — تماس طبیعی
      { a: guardA, b: bladeB, r: 0.035, zone: 'blade' as const, swept: false },
    ],
  };
}

/** استخراج مرز گارد از هندسهٔ واقعی سلاح: آخرین لایه با پهنای جانبی > ۶cm */
export async function extractGuardTop(weaponFile: string): Promise<number> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const doc = await io.read(path.join(V3_MODELS, 'weapons', weaponFile));
  let pos: { getCount(): number; getElement(i: number, t: number[]): void } | null = null;
  for (const n of doc.getRoot().listNodes()) {
    const mesh = n.getMesh();
    if (!mesh) continue;
    const attr = mesh.listPrimitives()[0]?.getAttribute('POSITION');
    if (attr) { pos = attr; break; }
  }
  if (!pos) return 0.4; // پیش‌فرض محافظه‌کارانه (raw units)
  const n = pos.getCount();
  const t = [0, 0, 0];
  let ymin = Infinity; let ymax = -Infinity;
  for (let i = 0; i < n; i++) { pos.getElement(i, t); ymin = Math.min(ymin, t[1]); ymax = Math.max(ymax, t[1]); }
  const SL = 16; const L = (ymax - ymin) / SL;
  const buckets: number[][] = Array.from({ length: SL }, () => []);
  for (let i = 0; i < n; i++) {
    pos.getElement(i, t);
    const bi = Math.min(SL - 1, Math.max(0, Math.floor((t[1] - ymin) / L)));
    buckets[bi].push(Math.hypot(t[0], t[2]));
  }
  let guardTop = ymin;
  for (let i = 0; i < SL; i++) {
    const b = buckets[i].sort((a, x) => a - x);
    if (!b.length) continue;
    const p90 = b[Math.round(0.9 * (b.length - 1))];
    if (p90 > 0.2) guardTop = Math.max(guardTop, ymin + (i + 1) * L);
  }
  return guardTop;
}

export interface PreparedBody {
  rig: LoadedRig;
  clips: Record<string, THREE.AnimationClip>;
  hand: THREE.Bone;
}

/** لود بدنه + نرمال‌سازی (قد هدف ۱٫۸۲ و فرود روی زمین) + ریتارگت proc — همان مسیر موتور */
export async function prepareBody(glbFile: string): Promise<PreparedBody> {
  const rig = await loadRig(path.join(V3_MODELS, glbFile));
  rig.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rig.root);
  const rawH = Math.max(0.01, box.max.y - box.min.y);
  const s = 1.82 / rawH;
  rig.root.scale.set(s, s, s);
  rig.root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(rig.root);
  rig.root.position.y = 0.004 - box2.min.y;
  rig.root.updateMatrixWorld(true);

  const mapping = detectHumanoidBones(rig.root);
  const rest = measureRest(rig.root, mapping);
  for (const [c, b] of Object.entries(mapping.target)) (rig.canon as Record<string, THREE.Bone>)[c] = b;
  const raw = buildClipLibrary();
  const clips: Record<string, THREE.AnimationClip> = {};
  for (const id of Object.keys(raw)) {
    try { clips[id] = retargetClipCustom(raw[id], mapping, rest); } catch { /* کلیپ خراب رد */ }
  }
  const hand = rig.canon['handR'] as THREE.Bone;
  expect(hand, `handR bone must map on ${glbFile}`).toBeTruthy();
  return { rig, clips, hand };
}

/** گروه ترنسفورم سلاح در فضای دست (بدون مش — ارزیابی با پروفایل کپسولی)
 *  ⚠️ باید دقیقاً مثل runtime (universal.ts) scale داشته باشد — فرزندان
 *  گروه مثل grip2 با scale ضرب می‌شوند؛ نبودِ آن نقطهٔ چنگ را ~۳٫۸× دور می‌برد */
export function makeWeaponGroup(def: typeof V3_WEAPONS[string]): THREE.Group {
  const g = new THREE.Group();
  g.position.set(...def.pos);
  g.rotation.set(...def.rot);
  g.scale.setScalar(def.scale);
  const tw = def.tweak;
  if (tw) {
    if (tw.rx) g.rotateX(tw.rx);
    if (tw.ry) g.rotateY(tw.ry);
    if (tw.rz) g.rotateZ(tw.rz);
    if (tw.px || tw.py || tw.pz) g.position.add(new THREE.Vector3(tw.px ?? 0, tw.py ?? 0, tw.pz ?? 0));
  }
  return g;
}

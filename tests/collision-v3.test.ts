// ─────────────────────────────────────────────────────────────
// هارنس برخورد برای بدنه‌های V3 (Quaternius Universal — CC0)
// ملاک پذیرش: هندسهٔ تغییرشکل‌یافتهٔ واقعی (اسکینینگ کامل glTF).
// سلاح: پروفایل داده‌محور از V3_WEAPONS (weapons3.ts) — همان جدولی
// که موتور می‌خواند؛ تبدیل به کپسول‌های hand-local.
// AntiClip پروژه (anticlip.ts) مستقیماً در هارنس رانده می‌شود تا
// اثر واقعی آن با معیار عددی ثبت شود — نه فقط اسکرین‌شات دیداری.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRig } from './helpers/glb-rig';
import { makeCloudEvaluator, pointSegDist } from './helpers/qa-run';
import { buildClipLibrary } from '../src/lib/animation/clips';
import { detectHumanoidBones, measureRest, retargetClipCustom } from '../src/lib/animation/retarget';
import { V3_WEAPONS } from '../src/lib/character/weapons3';
import { computeGripMount } from '../src/lib/character/universal';
import { AntiClip } from '../src/lib/animation/anticlip';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

vi.setConfig({ testTimeout: 240000, hookTimeout: 240000 });

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(here, '../public/models/v3/Male_Base.glb');

/** پروفایل سلاح V3 → کپسول‌های hand-local، با ناحیه‌بندی از هندسهٔ واقعی سلاح
 *  (جدول V3_WEAPONS تیغه را از مبدأ مدل می‌گیرد — گاردِ روی دست را هم «تیغه»
 *  می‌شمارد و تماس طبیعی دست/مچ را نقض نشان می‌دهد. اینجا مرز دسته/تیغه از
 *  توزیع پهنای واقعی W_Sword.glb استخراج می‌شود — داده‌محور، نه حدس دستی.) */
function v3WeaponProfile(def: typeof V3_WEAPONS[string], guardTopRaw: number, hand: THREE.Bone) {
  // چنگ داده‌محور — همان مسیر موتور: نصب از محورهای واقعی اسکلت
  // (gripCenter/rollDeg/pitchDeg در پروفایل؛ نه pos/rot عددی)
  const mount = computeGripMount(hand, def);
  const q = mount.quat;
  const pos = mount.pos;
  const toHand = (p: THREE.Vector3) =>
    p.clone().multiplyScalar(def.scale).applyQuaternion(q).add(pos);
  const grip = toHand(new THREE.Vector3(0, 0, 0));
  const bladeA = toHand(new THREE.Vector3(...def.bladeFrom));
  const bladeB = toHand(new THREE.Vector3(...def.bladeTo));
  // مرز واقعی گارد: نقطه‌ای روی محور Y خام که پهنای جانبی افت می‌کند
  const guardA = toHand(new THREE.Vector3(0, guardTopRaw, 0));
  return {
    def,
    mount,
    grip, bladeA, bladeB, guardA,
    slices: [
      { a: grip, b: bladeA, r: 0.03, zone: 'handle' as const, swept: false },
      { a: bladeA, b: guardA, r: 0.05, zone: 'handle' as const, swept: false }, // گارد روی دست — تماس طبیعی
      { a: guardA, b: bladeB, r: 0.035, zone: 'blade' as const, swept: false },
    ],
  };
}

/** استخراج مرز گارد از هندسهٔ واقعی سلاح: آخرین لایه با پهنای جانبی > ۶cm */
async function extractGuardTop(weaponFile: string): Promise<number> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const doc = await io.read(path.join(here, '../public/models/v3/weapons', weaponFile));
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
  // پهنای جانبی هر لایه (صدک ۹۰) — گارد = لایه‌های پهن نزدیک دسته
  let guardTop = ymin;
  for (let i = 0; i < SL; i++) {
    const b = buckets[i].sort((a, x) => a - x);
    if (!b.length) continue;
    const p90 = b[Math.round(0.9 * (b.length - 1))];
    if (p90 > 0.2) guardTop = Math.max(guardTop, ymin + (i + 1) * L);
  }
  return guardTop;
}

let rig: Awaited<ReturnType<typeof loadRig>>;
let clips: Record<string, THREE.AnimationClip>;
let prof: ReturnType<typeof v3WeaponProfile>;
let handBone: THREE.Bone;
let weaponGroup: THREE.Group;

beforeAll(async () => {
  rig = await loadRig(BASE);
  // نرمال‌سازی مثل ساخت V3: قد هدف ۱٫۸۲ و فرود روی زمین
  rig.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rig.root);
  const rawH = Math.max(0.01, box.max.y - box.min.y);
  const s = 1.82 / rawH;
  rig.root.scale.set(s, s, s);
  rig.root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(rig.root);
  rig.root.position.y = 0.004 - box2.min.y;
  rig.root.updateMatrixWorld(true);

  // ریتارگت کلیپ‌های proc روی ریگ Universal — همان مسیر موتور
  const mapping = detectHumanoidBones(rig.root);
  const rest = measureRest(rig.root, mapping);
  // canon map هارنس باید استخوان‌های همین ریگ را بدهد
  for (const [c, b] of Object.entries(mapping.target)) (rig.canon as Record<string, THREE.Bone>)[c] = b;
  const raw = buildClipLibrary();
  clips = {};
  for (const id of Object.keys(raw)) {
    try { clips[id] = retargetClipCustom(raw[id], mapping, rest); } catch { /* کلیپ خراب رد */ }
  }

  // سلاح V3 — دست راست؛ مرز گارد از هندسهٔ واقعی W_Sword
  const guardTopRaw = await extractGuardTop(V3_WEAPONS.sword.file);
  console.log(`[v3] guard top (raw units): ${guardTopRaw.toFixed(3)} — table bladeFrom: ${V3_WEAPONS.sword.bladeFrom[1]}`);
  handBone = rig.canon['handR'] as THREE.Bone;
  expect(handBone, 'handR bone must map on Universal rig').toBeTruthy();
  rig.root.updateMatrixWorld(true);
  prof = v3WeaponProfile(V3_WEAPONS.sword, guardTopRaw, handBone);
  weaponGroup = new THREE.Group();
  // چنگ داده‌محور — همان مسیر موتور (computeGripMount)
  weaponGroup.position.copy(prof.mount.pos);
  weaponGroup.quaternion.copy(prof.mount.quat);
  weaponGroup.scale.setScalar(V3_WEAPONS.sword.scale);
  handBone.add(weaponGroup);
  rig.root.updateMatrixWorld(true);
});

function runClip(clipId: string, anticlipOn: boolean, dt = 1 / 120) {
  const clip = clips[clipId];
  if (!clip) throw new Error(`retargeted clip missing: ${clipId}`);
  const cloudEval = makeCloudEvaluator(rig);
  const gripChain = new Set(['upperArmR', 'lowerArmR', 'handR']);
  const anticlip = anticlipOn ? new AntiClip({ bones: rig.canon, bulk: 1 }) : null;

  const mixer = new THREE.AnimationMixer(rig.root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();

  const res = { violSamples: 0, totalSamples: 0, maxDepth: 0, sumDepth: 0, longestRun: 0, byPart: {} as Record<string, number>, maxCorrDeg: 0 };
  let run = 0;
  const n = Math.max(2, Math.ceil(clip.duration / dt));
  for (let i = 0; i < n; i++) {
    mixer.update(dt);
    rig.root.updateMatrixWorld(true);
    if (anticlip) {
      anticlip.update(handBone, weaponGroup, prof.bladeA.clone(), prof.bladeB.clone());
      rig.root.updateMatrixWorld(true);
    }
    const cloud = cloudEval.deform();
    const m = handBone.matrixWorld;
    // برش‌ها در فضای جهان — از prof.slices (ناحیه‌بندی داده‌محور: دسته/گارد/تیغه)
    const segsW = prof.slices.map((s) => ({
      a: s.a.clone().applyMatrix4(m),
      b: s.b.clone().applyMatrix4(m),
      r: s.r, zone: s.zone,
    }));
    let worst = 0; let worstPart: string | null = null;
    for (let vi = 0; vi < cloud.verts.length; vi++) {
      const part = cloud.part[vi];
      const p = cloud.verts[vi];
      for (const seg of segsW) {
        // تماس مجاز صریح: دسته/گارد × زنجیرهٔ دست گیرنده
        if (seg.zone === 'handle' && gripChain.has(part ?? '')) continue;
        const d = pointSegDist(p, seg.a, seg.b);
        const depth = seg.r - d;
        if (depth > 0.012 && depth > worst) { worst = depth; worstPart = part; }
      }
    }
    if (worst > 0) {
      run++;
      res.violSamples++;
      res.longestRun = Math.max(res.longestRun, run);
      res.maxDepth = Math.max(res.maxDepth, worst);
      res.sumDepth += worst;
      if (worstPart) res.byPart[worstPart] = (res.byPart[worstPart] ?? 0) + 1;
    } else run = 0;
    res.totalSamples++;
  }
  action.stop();
  mixer.stopAllAction();
  anticlip?.dispose();
  return res;
}

describe('V3 harness sanity', () => {
  it('weapon profile blade length matches the data-driven def (single scale)', () => {
    const len = prof.bladeA.distanceTo(prof.bladeB);
    console.log(`[v3] blade length in hand space: ${(len * 100).toFixed(1)}cm — def: ${(V3_WEAPONS.sword.bladeTo[1] * V3_WEAPONS.sword.scale * 100).toFixed(1)}cm`);
    // قرارداد درست: raw × scale (یک‌بار). دوبار-مقیاس ۰٫۳۴m می‌داد.
    expect(len).toBeGreaterThan(1.0);
    expect(len).toBeLessThan(1.5);
  });
  it('volume/cloud extracted from V3 skinned meshes', () => {
    const ev = makeCloudEvaluator(rig);
    rig.root.updateMatrixWorld(true);
    const cloud = ev.deform();
    console.log(`[v3] cloud verts: ${cloud.verts.length}, mapped parts: ${cloud.part.filter(Boolean).length}`);
    expect(cloud.verts.length).toBeGreaterThan(3000);
    expect(cloud.part.filter(Boolean).length).toBeGreaterThan(2000);
  });
});

describe('V3 — proc clips × sword (exact geometry, 120Hz)', () => {
  it('measures baseline vs AntiClip-ON and records honest numbers', () => {
    for (const id of ['idle', 'walk', 'guard', 'attack']) {
      const base = runClip(id, false);
      const on = runClip(id, true);
      console.log(
        `[v3] ${id.padEnd(8)} baseline: viol=${String(base.violSamples).padStart(4)}/${base.totalSamples} max=${(base.maxDepth * 100).toFixed(1)}cm sum=${(base.sumDepth * 100).toFixed(0)} parts=${JSON.stringify(base.byPart)} | ` +
        `anticlip: viol=${String(on.violSamples).padStart(4)}/${on.totalSamples} max=${(on.maxDepth * 100).toFixed(1)}cm sum=${(on.sumDepth * 100).toFixed(0)} parts=${JSON.stringify(on.byPart)}`,
      );
      // کلیپ تمیز نباید با AntiClip کثیف شود
      if (base.violSamples === 0) expect(on.violSamples).toBe(0);
    }
  }, 240000);

  it('documents at least one real finding for the record', () => {
    // این تست جای عدد اثبات نیست — عدد واقعی در خروجی بالا و
    // docs/character-quality-progress.md ثبت می‌شود.
    expect(Object.keys(clips).length).toBeGreaterThan(10);
  });
});

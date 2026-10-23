// ─────────────────────────────────────────────────────────────
// هارنس برخورد برای بدنه‌های V3 (Quaternius Universal — CC0)
// ملاک پذیرش: هندسهٔ تغییرشکل‌یافتهٔ واقعی (اسکینینگ کامل glTF).
// سلاح: پروفایل داده‌محور از V3_WEAPONS (weapons3.ts) — همان جدولی
// که موتور می‌خواند؛ تبدیل به کپسول‌های hand-local.
// AntiClip پروژه (anticlip.ts) مستقیماً در هارنس رانده می‌شود تا
// اثر واقعی آن با معیار عددی ثبت شود — نه فقط اسکرین‌شات دیداری.
//
// پوشش ترکیب‌ها (جلسهٔ ۲): بدنه × سلاح — Male_Base و Female_Base ×
// sword (1H) و sword2h (Claymore دو‌دست). اعداد ثبت می‌شوند؛ آستانهٔ
// pass/fail فقط برای ترکیب‌هایی که رفتارشان اندازه‌گیری شده گذاشته
// می‌شود — بدون ادعای تعمیم به همهٔ سلاح‌ها.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRig, type LoadedRig } from './helpers/glb-rig';
import { makeCloudEvaluator, pointSegDist } from './helpers/qa-run';
import { buildClipLibrary } from '../src/lib/animation/clips';
import { detectHumanoidBones, measureRest, retargetClipCustom } from '../src/lib/animation/retarget';
import { V3_WEAPONS } from '../src/lib/character/weapons3';
import { AntiClip } from '../src/lib/animation/anticlip';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

vi.setConfig({ testTimeout: 240000, hookTimeout: 240000 });

const here = path.dirname(fileURLToPath(import.meta.url));
const MODELS = path.join(here, '../public/models/v3');

/** پروفایل سلاح V3 → کپسول‌های hand-local، با ناحیه‌بندی از هندسهٔ واقعی سلاح
 *  (جدول V3_WEAPONS تیغه را از مبدأ مدل می‌گیرد — گاردِ روی دست را هم «تیغه»
 *  می‌شمارد و تماس طبیعی دست/مچ را نقض نشان می‌دهد. مرز دسته/تیغه از
 *  توزیع پهنای واقعی GLB سلاح استخراج می‌شود — داده‌محور، نه حدس دستی.) */
function v3WeaponProfile(def: typeof V3_WEAPONS[string], guardTopRaw: number) {
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
async function extractGuardTop(weaponFile: string): Promise<number> {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const doc = await io.read(path.join(MODELS, 'weapons', weaponFile));
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

/** لود بدنه + نرمال‌سازی (قد هدف ۱٫۸۲ و فرود روی زمین) + ریتارگت proc — همان مسیر موتور */
async function prepareBody(glbFile: string) {
  const rig = await loadRig(path.join(MODELS, glbFile));
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

/** گروه ترنسفورم سلاح در فضای دست (بدون مش — ارزیابی با پروفایل کپسولی) */
function makeWeaponGroup(def: typeof V3_WEAPONS[string]): THREE.Group {
  const g = new THREE.Group();
  g.position.set(...def.pos);
  g.rotation.set(...def.rot);
  const tw = def.tweak;
  if (tw) {
    if (tw.rx) g.rotateX(tw.rx);
    if (tw.ry) g.rotateY(tw.ry);
    if (tw.rz) g.rotateZ(tw.rz);
    if (tw.px || tw.py || tw.pz) g.position.add(new THREE.Vector3(tw.px ?? 0, tw.py ?? 0, tw.pz ?? 0));
  }
  return g;
}

interface RunResult {
  violSamples: number; totalSamples: number; maxDepth: number; sumDepth: number;
  longestRun: number; byPart: Record<string, number>;
  /** کمینهٔ فاصلهٔ تیغه (ناحیهٔ blade) تا رئوس غیرمجاز — حاشیهٔ اطمینان (m) */
  minBladeClearance: number;
  /** نقض‌ها به تفکیک ناحیه — handle/blade (سالم‌سازی تماس مجاز) */
  byZone: Record<string, number>;
  /** نقض فقط در زیرگام swept (بین فریم‌ها) — نه در پوز نهایی */
  sweptOnlySamples: number;
}

/** پخش کلیپ روی بدنهٔ آماده + ارزیابی دقیق روی ابر رئوس (120Hz) */
function runClip(
  body: { rig: LoadedRig; clips: Record<string, THREE.AnimationClip>; hand: THREE.Bone },
  prof: ReturnType<typeof v3WeaponProfile>,
  clipId: string,
  anticlipOn: boolean,
  dt = 1 / 120,
): RunResult {
  const clip = body.clips[clipId];
  if (!clip) throw new Error(`retargeted clip missing: ${clipId}`);
  const cloudEval = makeCloudEvaluator(body.rig);
  const gripChain = new Set(['upperArmR', 'lowerArmR', 'handR']);
  const offChain = new Set(['upperArmL', 'lowerArmL', 'handL']);
  const twoHanded = !!prof.def.twoHanded;
  const anticlip = anticlipOn ? new AntiClip({ bones: body.rig.canon, bulk: 1 }) : null;
  const weaponGroup = makeWeaponGroup(prof.def);
  body.hand.add(weaponGroup);
  body.rig.root.updateMatrixWorld(true);

  const mixer = new THREE.AnimationMixer(body.rig.root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();

  const res: RunResult = { violSamples: 0, totalSamples: 0, maxDepth: 0, sumDepth: 0, longestRun: 0, byPart: {}, minBladeClearance: Infinity, byZone: {}, sweptOnlySamples: 0 };
  let run = 0;
  const n = Math.max(2, Math.ceil(clip.duration / dt));
  let prevHandM: THREE.Matrix4 | null = null;
  const wslices: { a: THREE.Vector3; b: THREE.Vector3; r: number; zone: 'handle' | 'blade'; swept: boolean }[] = [];
  const p0 = new THREE.Vector3(); const q0 = new THREE.Quaternion(); const s0 = new THREE.Vector3();
  const p1 = new THREE.Vector3(); const q1 = new THREE.Quaternion(); const s1 = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    mixer.update(dt);
    body.rig.root.updateMatrixWorld(true);
    if (anticlip) {
      anticlip.update(body.hand, weaponGroup, prof.bladeA.clone(), prof.bladeB.clone());
      body.rig.root.updateMatrixWorld(true);
    }
    const cloud = cloudEval.deform();
    const m = body.hand.matrixWorld;
    // برش‌ها در فضای جهان — پوز فعلی + زیرگام‌های swept نسبت به فریم قبل
    // (مأموریت §۲: مسیر طی‌شدهٔ کل تیغه بررسی شود، نه فقط فریم پایانی)
    wslices.length = 0;
    for (const s of prof.slices) {
      wslices.push({ a: s.a.clone().applyMatrix4(m), b: s.b.clone().applyMatrix4(m), r: s.r, zone: s.zone, swept: false });
    }
    const handM = body.hand.matrixWorld;
    if (prevHandM) {
      prevHandM.decompose(p0, q0, s0);
      handM.decompose(p1, q1, s1);
      const dist = p0.distanceTo(p1);
      if (dist > 0.035) {
        const K = Math.min(4, Math.ceil(dist / 0.035));
        for (let k = 1; k < K; k++) {
          const f = k / K;
          const mi = new THREE.Matrix4().compose(p0.clone().lerp(p1, f), q0.clone().slerp(q1, f), s0);
          for (const s of prof.slices) {
            wslices.push({ a: s.a.clone().applyMatrix4(mi), b: s.b.clone().applyMatrix4(mi), r: s.r, zone: s.zone, swept: true });
          }
        }
      }
    }
    prevHandM = handM.clone();
    let worst = 0; let worstPart: string | null = null; let worstZone = ''; let anyFinal = false; let anySwept = false;
    for (let vi = 0; vi < cloud.verts.length; vi++) {
      const part = cloud.part[vi];
      const p = cloud.verts[vi];
      for (const seg of wslices) {
        // تماس مجاز صریح: دسته/گارد × زنجیرهٔ دست گیرنده (+ دست دوم فقط سلاح دو‌دست)
        if (seg.zone === 'handle' && (gripChain.has(part ?? '') || (twoHanded && offChain.has(part ?? '')))) continue;
        const d = pointSegDist(p, seg.a, seg.b);
        if (seg.zone === 'blade' && !seg.swept && d < res.minBladeClearance) res.minBladeClearance = d;
        const depth = seg.r - d;
        if (depth > 0.012 && depth > worst) { worst = depth; worstPart = part; worstZone = seg.zone; }
        if (depth > 0.012) { if (seg.swept) anySwept = true; else anyFinal = true; }
      }
    }
    if (worst > 0) {
      run++;
      res.violSamples++;
      res.longestRun = Math.max(res.longestRun, run);
      res.maxDepth = Math.max(res.maxDepth, worst);
      res.sumDepth += worst;
      if (worstPart) res.byPart[worstPart] = (res.byPart[worstPart] ?? 0) + 1;
      if (worstZone) res.byZone[worstZone] = (res.byZone[worstZone] ?? 0) + 1;
      if (!anyFinal && anySwept) res.sweptOnlySamples++;
    } else run = 0;
    res.totalSamples++;
  }
  action.stop();
  mixer.stopAllAction();
  anticlip?.dispose();
  body.hand.remove(weaponGroup);
  return res;
}

const fmt = (r: RunResult) =>
  `viol=${String(r.violSamples).padStart(4)}/${r.totalSamples} max=${(r.maxDepth * 100).toFixed(1)}cm sum=${(r.sumDepth * 100).toFixed(0)} clearance=${r.minBladeClearance === Infinity ? '—' : (r.minBladeClearance * 100).toFixed(1) + 'cm'}${r.sweptOnlySamples ? ' sweptOnly=' + r.sweptOnlySamples : ''} parts=${JSON.stringify(r.byPart)}${Object.keys(r.byZone).length ? ' zone=' + JSON.stringify(r.byZone) : ''}`;

// ── آماده‌سازی مشترک ─────────────────────────────────────────
let male: Awaited<ReturnType<typeof prepareBody>>;
let female: Awaited<ReturnType<typeof prepareBody>>;
let guardTopSword: number;
let guardTopClay: number;
let profSword: ReturnType<typeof v3WeaponProfile>;
let profClay: ReturnType<typeof v3WeaponProfile>;

beforeAll(async () => {
  guardTopSword = await extractGuardTop(V3_WEAPONS.sword.file);
  guardTopClay = await extractGuardTop(V3_WEAPONS.sword2h.file);
  profSword = v3WeaponProfile(V3_WEAPONS.sword, guardTopSword);
  profClay = v3WeaponProfile(V3_WEAPONS.sword2h, guardTopClay);
  male = await prepareBody('Male_Base.glb');
  female = await prepareBody('Female_Base.glb');
  console.log(`[v3] guard top sword: ${guardTopSword.toFixed(3)} raw — claymore: ${guardTopClay.toFixed(3)} raw — table bladeFrom clay: ${V3_WEAPONS.sword2h.bladeFrom[1]}`);
});

describe('V3 harness sanity', () => {
  it('weapon profile blade length matches the data-driven def (single scale)', () => {
    const lenSword = profSword.bladeA.distanceTo(profSword.bladeB);
    const lenClay = profClay.bladeA.distanceTo(profClay.bladeB);
    console.log(`[v3] blade in hand space — sword: ${(lenSword * 100).toFixed(1)}cm (def ${(V3_WEAPONS.sword.bladeTo[1] * V3_WEAPONS.sword.scale * 100).toFixed(1)}) — claymore: ${(lenClay * 100).toFixed(1)}cm (def ${(V3_WEAPONS.sword2h.bladeTo[1] * V3_WEAPONS.sword2h.scale * 100).toFixed(1)})`);
    // قرارداد درست: raw × scale (یک‌بار). دوبار-مقیاس ۰٫۳۴m می‌داد.
    expect(lenSword).toBeGreaterThan(1.0);
    expect(lenSword).toBeLessThan(1.5);
    expect(lenClay).toBeGreaterThan(1.0);
    expect(lenClay).toBeLessThan(2.0);
  });
  it('volume/cloud extracted from both V3 bodies (male + female)', () => {
    for (const [name, body] of [['male', male], ['female', female]] as const) {
      body.rig.root.updateMatrixWorld(true);
      const cloud = makeCloudEvaluator(body.rig).deform();
      console.log(`[v3] ${name} cloud verts: ${cloud.verts.length}, mapped parts: ${cloud.part.filter(Boolean).length}`);
      expect(cloud.verts.length).toBeGreaterThan(3000);
      expect(cloud.part.filter(Boolean).length).toBeGreaterThan(2000);
    }
  });
});

describe('V3 — proc clips × sword 1H (exact geometry, 120Hz)', () => {
  it('male: baseline vs AntiClip-ON, clean clips must stay clean', () => {
    for (const id of ['idle', 'walk', 'guard', 'attack']) {
      const base = runClip(male, profSword, id, false);
      const on = runClip(male, profSword, id, true);
      console.log(`[v3] male sword ${id.padEnd(8)} baseline: ${fmt(base)} | anticlip: ${fmt(on)}`);
      if (base.violSamples === 0) expect(on.violSamples).toBe(0);
    }
  }, 240000);

  it('female: baseline vs AntiClip-ON, clean clips must stay clean', () => {
    for (const id of ['idle', 'walk', 'guard', 'attack']) {
      const base = runClip(female, profSword, id, false);
      const on = runClip(female, profSword, id, true);
      console.log(`[v3] female sword ${id.padEnd(8)} baseline: ${fmt(base)} | anticlip: ${fmt(on)}`);
      if (base.violSamples === 0) expect(on.violSamples).toBe(0);
    }
  }, 240000);
});

describe('V3 — proc clips × claymore 2H (exact geometry, 120Hz)', () => {
  // حرکت حملهٔ دو‌دست اختصاصی — ترکیب واقعی موتور برای سلاح دو‌دست
  it('male: idle/walk/guard/attack2h — baseline vs AntiClip-ON', () => {
    for (const id of ['idle', 'walk', 'guard', 'attack2h']) {
      const base = runClip(male, profClay, id, false);
      const on = runClip(male, profClay, id, true);
      console.log(`[v3] male clay ${id.padEnd(8)} baseline: ${fmt(base)} | anticlip: ${fmt(on)}`);
      if (base.violSamples === 0) expect(on.violSamples).toBe(0);
    }
  }, 240000);

  it('female: idle/walk/guard/attack2h — baseline vs AntiClip-ON', () => {
    for (const id of ['idle', 'walk', 'guard', 'attack2h']) {
      const base = runClip(female, profClay, id, false);
      const on = runClip(female, profClay, id, true);
      console.log(`[v3] female clay ${id.padEnd(8)} baseline: ${fmt(base)} | anticlip: ${fmt(on)}`);
      if (base.violSamples === 0) expect(on.violSamples).toBe(0);
    }
  }, 240000);

  it('claymore × 1H attack clip: INVALID combo — recorded for the record (engine routes 2H weapons to attack2h)', () => {
    // این ترکیب دیگر در موتور مسیر ندارد (play() سلاح دو‌دست را به
    // attack2h می‌فرستد)؛ عدد اینجا فقط سند است — چنگ دست دوم در بُرد نیست
    const base = runClip(male, profClay, 'attack', false);
    console.log(`[v3] male clay attack ⚠️ INVALID-1H-clip baseline: ${fmt(base)}`);
  }, 240000);
});

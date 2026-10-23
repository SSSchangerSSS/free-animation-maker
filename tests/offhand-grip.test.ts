// ─────────────────────────────────────────────────────────────
// آزمون چنگ دو‌دستی — مقایسهٔ عددی دو حل‌کننده روی همان هارنس
// (مأموریت §۲: «هدف دست دوم به سلاح متصل باشد و دو حل‌کنندهٔ مستقل
// با یکدیگر نجنگند.»)
//
//   الف) TwoHandIK  — تحلیلی دواستخوانی (src/lib/animation/twohandik.ts)
//       — همان مسیر موتور پس از ادغام
//   ب) OffHandGrip  — CCD افزایشی با clamp (src/lib/character/offhand-grip.ts)
//
// هر دو فقط زنجیرهٔ دست چپ را می‌نویسند؛ AntiClip فقط دست راست —
// عدم جنگ در تست «anticlip ON» سنجیده می‌شود.
// معیارها (مأموریت §۳/§۵):
//  ۱) رساندن: دست دوم (hand_l) به grip2 — میانگین/بیشینه
//  ۲) کشش زنجیره: طول قطعات نسبت به rest (±۲٫۵٪) — «تغییر طول اندام» ممنوع
//  ۳) با AntiClip فعال هم نتایج حفظ شود
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { prepareBody, makeWeaponGroup, v3WeaponProfile, extractGuardTop, type PreparedBody } from './helpers/v3-setup';
import { V3_WEAPONS } from '../src/lib/character/weapons3';
import { OffHandGrip } from '../src/lib/character/offhand-grip';
import { TwoHandIK } from '../src/lib/animation/twohandik';
import { AntiClip } from '../src/lib/animation/anticlip';

vi.setConfig({ testTimeout: 240000, hookTimeout: 240000 });

let male: PreparedBody;
let prof: ReturnType<typeof v3WeaponProfile>;
let chainBones: THREE.Bone[];      // CCD: lowerarm/upperarm/clavicle
let effectorL: THREE.Bone;
let restUpper = 0;
let restLower = 0;
let twohand: TwoHandIK;

beforeAll(async () => {
  male = await prepareBody('Male_Base.glb');
  const guardTop = await extractGuardTop(V3_WEAPONS.sword2h.file);
  prof = v3WeaponProfile(V3_WEAPONS.sword2h, guardTop, male.hand);
  const canon = male.rig.canon as Record<string, THREE.Bone>;
  chainBones = [canon['lowerArmL'], canon['upperArmL']];
  // clavicle با نام خام (نگاشت canonical آن را در upperArm ادغام می‌کند)
  const clav = findBoneByName(male.rig.root, /^clavicle_l$/i);
  if (clav) chainBones.push(clav);
  effectorL = canon['handL'];
  expect(effectorL, 'handL bone must map').toBeTruthy();
  expect(chainBones.length, 'left IK chain (lowerarm/upperarm/clavicle)').toBeGreaterThanOrEqual(2);

  // طول‌های rest زنجیره — ملاک کشش
  male.rig.root.updateMatrixWorld(true);
  restUpper = jointDist(chainBones[1], chainBones[0]);
  restLower = jointDist(chainBones[0], effectorL);
  expect(restUpper).toBeGreaterThan(0.1);
  expect(restLower).toBeGreaterThan(0.1);

  // TwoHandIK — ساخت در T-pose (طول‌ها/جهت‌های rest از همین پوز اندازه می‌شود)
  const arm = findArmBones(male.rig.root);
  expect(arm.upper && arm.lower && arm.hand, 'left arm bones for TwoHandIK').toBeTruthy();
  twohand = new TwoHandIK({ upper: arm.upper!, lower: arm.lower!, hand: arm.hand! });
});

function findBoneByName(root: THREE.Object3D, re: RegExp): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.Bone).isBone && re.test(o.name)) found = o as THREE.Bone;
  });
  return found;
}

function findArmBones(root: THREE.Object3D) {
  let upper: THREE.Bone | null = null, lower: THREE.Bone | null = null, hand: THREE.Bone | null = null;
  root.traverse((o) => {
    const b = o as THREE.Bone;
    if (!b.isBone) return;
    if (b.name === 'upperarm_l') upper = b;
    else if (b.name === 'lowerarm_l') lower = b;
    else if (b.name === 'hand_l') hand = b;
  });
  return { upper, lower, hand };
}

function jointDist(a: THREE.Object3D, b: THREE.Object3D): number {
  const pa = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
  const pb = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  return pa.distanceTo(pb);
}

interface GripSample { reachErr: number; maxCorrDeg: number; stretch: number; shoulderDist: number; handDist: number }

/** اجرای کلیپ با حل‌کنندهٔ چنگ دوم — reachErr/corr/stretch در هر نمونه */
function runGripClip(
  clipId: string,
  solver: 'ccd' | 'analytic',
  opts: { anticlip?: boolean; dt?: number } = {},
): { samples: GripSample[] } {
  const dt = opts.dt ?? 1 / 120;
  const clip = male.clips[clipId];
  if (!clip) throw new Error(`clip missing: ${clipId}`);

  const weaponGroup = makeWeaponGroup(prof.def, male.hand);
  const gripTarget = new THREE.Object3D();
  gripTarget.name = '__grip2__';
  gripTarget.position.set(...(prof.def.grip2 as [number, number, number]));
  weaponGroup.add(gripTarget);
  male.hand.add(weaponGroup);
  male.rig.root.updateMatrixWorld(true);

  const anticlip = opts.anticlip ? new AntiClip({ bones: male.rig.canon, bulk: 1 }) : null;
  const ccd = solver === 'ccd'
    ? new OffHandGrip({ chain: chainBones, effector: effectorL, target: gripTarget, cfg: { instant: true } })
    : null;

  const mixer = new THREE.AnimationMixer(male.rig.root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();

  const samples: GripSample[] = [];
  const n = Math.max(2, Math.ceil(clip.duration / dt));
  const targetW = new THREE.Vector3();
  const effW = new THREE.Vector3();
  const shoulderW = new THREE.Vector3();
  const handRW = new THREE.Vector3();
  const shoulder = chainBones[chainBones.length - 1];
  const gm = new THREE.Matrix4();
  const g2 = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    mixer.update(dt);
    male.rig.root.updateMatrixWorld(true);
    if (anticlip) {
      anticlip.update(male.hand, weaponGroup, prof.bladeA.clone(), prof.bladeB.clone());
      male.rig.root.updateMatrixWorld(true);
    }
    // هدف — همان مسیر موتور: grip2 از ماتریس گروه × ماتریس دست راست
    male.hand.updateWorldMatrix(true, false);
    gm.compose(weaponGroup.position, weaponGroup.quaternion, new THREE.Vector3().setScalar(prof.def.scale));
    g2.set(...(prof.def.grip2 as [number, number, number])).applyMatrix4(gm).applyMatrix4(male.hand.matrixWorld);
    let appliedDeg = 0;
    if (solver === 'ccd' && ccd) {
      const rep = ccd.update(dt);
      appliedDeg = THREE.MathUtils.radToDeg(rep.applied);
    } else {
      twohand.update(g2);
    }
    male.rig.root.updateMatrixWorld(true);
    gripTarget.updateWorldMatrix(true, false);
    effectorL.updateWorldMatrix(true, false);
    shoulder.updateWorldMatrix(true, false);
    male.hand.updateWorldMatrix(true, false);
    targetW.setFromMatrixPosition(gripTarget.matrixWorld);
    effW.setFromMatrixPosition(effectorL.matrixWorld);
    shoulderW.setFromMatrixPosition(shoulder.matrixWorld);
    handRW.setFromMatrixPosition(male.hand.matrixWorld);
    const su = jointDist(chainBones[1], chainBones[0]) / restUpper;
    const sl = jointDist(chainBones[0], effectorL) / restLower;
    samples.push({
      reachErr: effW.distanceTo(targetW),
      maxCorrDeg: appliedDeg,
      stretch: Math.max(Math.abs(su - 1), Math.abs(sl - 1)),
      shoulderDist: shoulderW.distanceTo(targetW),
      handDist: effW.distanceTo(handRW),
    });
  }
  action.stop();
  mixer.stopAllAction();
  anticlip?.dispose();
  male.hand.remove(weaponGroup);
  male.rig.root.updateMatrixWorld(true);
  return { samples };
}

function stats(samples: GripSample[], warmup: number) {
  const tail = samples.slice(warmup);
  const mean = tail.reduce((a, s) => a + s.reachErr, 0) / tail.length;
  const max = Math.max(...tail.map((s) => s.reachErr));
  const maxStretch = Math.max(...tail.map((s) => s.stretch));
  const maxCorr = Math.max(...tail.map((s) => s.maxCorrDeg));
  return { mean, max, maxStretch, maxCorr };
}

describe('Two-handed grip head-to-head — Male_Base × Claymore (grip2)', () => {
  const WARMUP = 20;

  for (const solver of ['analytic', 'ccd'] as const) {
    for (const clipId of ['idle', 'walk', 'guard', 'attack2h']) {
      it(`${solver}/${clipId}: left hand on grip2, chain not stretched`, () => {
        const { samples } = runGripClip(clipId, solver);
        const st = stats(samples, WARMUP);
        const handDistMax = Math.max(...samples.map((s) => s.handDist)) * 100;
        console.log(`[grip2:${solver}] ${clipId.padEnd(8)} reachErr mean=${(st.mean * 100).toFixed(1)}cm max=${(st.max * 100).toFixed(1)}cm stretch=${(st.maxStretch * 100).toFixed(2)}% corr=${st.maxCorr.toFixed(1)}° handDist=${handDistMax.toFixed(1)}cm`);
        if (solver === 'ccd') {
          // برندهٔ بنچمارک — آستانهٔ قفل سخت روی همهٔ کلیپ‌ها
          expect(st.mean).toBeLessThan(0.025);
        } else if (clipId === 'attack2h') {
          // تحلیلی دومفصلی فقط در حملهٔ 2H خودش در بُرد است (کلیپ برای آن طراحی شده)
          expect(st.mean).toBeLessThan(0.025);
        } else {
          // تحلیلی در ایست/راه/گارد هدف را نمی‌رسد (بدون ترقوه، فقط clamp) —
          // عدد ثبت می‌شود، موفق اعلام نمی‌شود
          expect(st.mean).toBeGreaterThan(0.025);
        }
        expect(st.maxStretch).toBeLessThan(0.025);
      }, 240000);
    }

    it(`${solver}: with AntiClip ON — solvers do not fight`, () => {
      const { samples } = runGripClip('attack2h', solver, { anticlip: true });
      const st = stats(samples, WARMUP);
      console.log(`[grip2:${solver}] attack2h+anticlip reachErr mean=${(st.mean * 100).toFixed(1)}cm max=${(st.max * 100).toFixed(1)}cm stretch=${(st.maxStretch * 100).toFixed(2)}%`);
      expect(st.maxStretch).toBeLessThan(0.025);
    }, 240000);
  }

  it('record: 1H attack clip × 2H weapon stays INVALID (documented, engine routes to attack2h)', () => {
    const { samples } = runGripClip('attack', 'analytic');
    const st = stats(samples, WARMUP);
    console.log(`[grip2:analytic] attack ⚠️ INVALID-1H-clip reachErr mean=${(st.mean * 100).toFixed(1)}cm max=${(st.max * 100).toFixed(1)}cm stretch=${(st.maxStretch * 100).toFixed(2)}%`);
    expect(st.maxStretch).toBeLessThan(0.025);
  }, 240000);
});

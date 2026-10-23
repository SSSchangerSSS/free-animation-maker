// ─────────────────────────────────────────────────────────────
// اجراکنندهٔ QA برخورد — ملاک پذیرش: هندسهٔ تغییرشکل‌یافتهٔ واقعی
// (اسکینینگ کامل glTF روی مش بدنه)، نه فقط حجم‌های تقریبی.
//
// برای هر نمونهٔ زمانی:
//   • پوز از AnimationMixer (کلیپ واقعی روی اسکلت واقعی)
//   • Pose-Guard (کپسولی — همان مسیر ران‌تایم مرورگر) اصلاح پوز
//   • ابر رئوس تغییرشکل‌یافتهٔ بدن (بدون شنل/سلاح) محاسبه می‌شود
//   • هر رأس → فاصله تا برش‌های تیغه (پوز فعلی + زیرگام‌های swept)
//   • عمق نفوذ رأس = شعاع برش − فاصله؛ تماس مجاز صریح رعایت می‌شود
//     (دسته × زنجیرهٔ دست گیرنده؛ دست دوم فقط سلاح دو‌دستی)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { LoadedRig } from './glb-rig';
import { createPoseGuard, type PoseGuardConfig } from '../../src/lib/animation/pose-guard';

export interface ClipQaResult {
  clip: string;
  weapon: string;
  /** نمونه‌های نقض‌دار (پس از اصلاح — ملاک: هندسهٔ دقیق) */
  violSamples: number;
  totalSamples: number;
  /** عمیق‌ترین نفوذ واقعی (m) */
  maxDepth: number;
  /** عمق انباشته (m·sample) */
  sumDepth: number;
  /** طولانی‌ترین رگبار نقض پیوسته (نمونه) */
  longestRun: number;
  /** عضو درگیر → تعداد نمونه */
  byPart: Record<string, number>;
  /** نقض‌های فقط-swept (بین فریم‌ها) */
  sweptOnlySamples: number;
  /** حداکثر زاویهٔ اصلاح اعمال‌شده (deg) */
  maxCorrDeg: number;
  /** وفاداری سیگنال کپسولی ران‌تایم نسبت به هندسهٔ دقیق */
  capsuleFP: number;
  capsuleTP: number;
}

export interface RunQaOpts {
  dt?: number;
  /** اصلاح فعال باشد یا فقط اندازه‌گیری baseline */
  guard?: boolean;
  arm?: 'R' | 'L';
  tolerance?: number;
}

interface DeformedCloud { verts: THREE.Vector3[]; part: (string | null)[] }

function buildCloud(rig: LoadedRig): { meshData: { mesh: THREE.SkinnedMesh; pos: THREE.BufferAttribute; ji: THREE.BufferAttribute; jw: THREE.BufferAttribute; bones: THREE.Bone[]; ibms: THREE.Matrix4[]; partOfJoint: (string | null)[] }[] } {
  // نگاشت مفصل → عضو canonical (مچ/handslot غیر-canonical به دستِ همان سمت
  // می‌روند تا تماس مجاز «دسته × دستِ گیرنده» کامل باشد، نه فقط استخوان hand)
  const canonByBone = new Map<string, string>();
  for (const [c, b] of Object.entries(rig.canon)) canonByBone.set(b.name, c);
  const jointPart = (boneName: string): string | null => {
    const c = canonByBone.get(boneName);
    if (c) return c;
    const m = /(?:^|[._-])(l|r)$/i.exec(boneName);
    const side = m ? (m[1].toLowerCase() === 'l' ? 'L' : 'R') : null;
    // انگشتان (ریگ Universal: index_02_l و…) به دستِ همان سمت — رئوس نافذِ
    // روی دست آزاد باید در گزارش عضو درگیر داشته باشند، نه null
    if (side && /index|middle|ring|pinky|thumb/i.test(boneName)) return `hand${side}`;
    if (side && /wrist|handslot|hand\b/i.test(boneName)) return `hand${side}`;
    return null;
  };
  const meshData: ReturnType<typeof buildCloud>['meshData'] = [];
  rig.root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton || !mesh.geometry.getAttribute('skinIndex')) return;
    if (/cape|cloak|skirt|sword|shield|knife|axe|staff|wand|spellbook|helmet|hat/i.test(mesh.name)) return;
    const bones = mesh.skeleton.bones;
    meshData.push({
      mesh,
      pos: mesh.geometry.getAttribute('position'),
      ji: mesh.geometry.getAttribute('skinIndex'),
      jw: mesh.geometry.getAttribute('skinWeight'),
      bones,
      ibms: mesh.skeleton.boneInverses,
      partOfJoint: bones.map((b) => jointPart(b.name)),
    });
  });
  return { meshData };
}

export function makeCloudEvaluator(rig: LoadedRig) {
  const { meshData } = buildCloud(rig);
  const accE = new Array(16).fill(0);
  const bm = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const out = new THREE.Vector3();
  const verts: THREE.Vector3[] = [];
  const parts: (string | null)[] = [];

  return {
    /** ابر تغییرشکل‌یافتهٔ همین لحظه (باید updateMatrixWorld شده باشد) */
    deform(): DeformedCloud {
      verts.length = 0; parts.length = 0;
      for (const md of meshData) {
        const mw = md.mesh.matrixWorld;
        for (let i = 0; i < md.pos.count; i++) {
          v.fromBufferAttribute(md.pos, i);
          accE.fill(0);
          let dSlot = 0, dW = -1;
          for (let k = 0; k < 4; k++) {
            const w = md.jw.getComponent(i, k);
            if (w < 1e-4) continue;
            if (w > dW) { dW = w; dSlot = k; }
            const j = md.ji.getComponent(i, k);
            bm.multiplyMatrices(md.bones[j].matrixWorld, md.ibms[j]);
            const be = bm.elements;
            for (let e = 0; e < 16; e++) accE[e] += w * be[e];
          }
          const acc = new THREE.Matrix4().fromArray(accE);
          out.copy(v).applyMatrix4(acc).applyMatrix4(mw);
          verts.push(out.clone());
          // عضو = مفصلِ غالب از skinIndex (اندیس اسلات وزن، نه اندیس مفصل)
          parts.push(md.partOfJoint[md.ji.getComponent(i, dSlot)]);
        }
      }
      return { verts, part: parts };
    },
  };
}

/** نزدیک‌ترین فاصلهٔ نقطه تا پاره‌خط (بدون تخصیص) */
export function pointSegDist(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const lenSq = abx * abx + aby * aby + abz * abz;
  let t = lenSq > 1e-12 ? (apx * abx + apy * aby + apz * abz) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

interface SliceW2 { a: THREE.Vector3; b: THREE.Vector3; r: number; zone: 'handle' | 'blade'; swept: boolean }

export function runClipQa(rig: LoadedRig, clipName: string, weaponName: string, opts: RunQaOpts = {}): ClipQaResult {
  const dt = opts.dt ?? 1 / 120;
  const arm = opts.arm ?? 'R';
  const tolerance = opts.tolerance ?? 0.012;
  const clip = rig.clips[clipName];
  if (!clip) throw new Error(`clip not found: ${clipName}`);
  const weapon = rig.profiles[weaponName];
  if (!weapon) throw new Error(`weapon profile not found: ${weaponName}`);
  const slot = arm === 'R' ? rig.handSlots.r : rig.handSlots.l;
  if (!slot) throw new Error('handslot missing');

  const guardCfg: Partial<PoseGuardConfig> = {
    weaponArm: arm,
    instant: true,
    ...(opts.guard ? {} : { maxStep: 0, depthGain: 0 }),
  };
  const guard = createPoseGuard({ root: rig.root, bones: rig.canon, handSlot: slot }, weapon, rig.volumes, guardCfg);
  const cloudEval = makeCloudEvaluator(rig);

  // زنجیره‌های مجاز
  const gripChain = new Set([`upperArm${arm}`, `lowerArm${arm}`, `hand${arm}`]);
  const offArm = arm === 'R' ? 'L' : 'R';
  const twoHanded = !!weapon.secondHand;
  const offChain = new Set([`upperArm${offArm}`, `lowerArm${offArm}`, `hand${offArm}`]);

  const mixer = new THREE.AnimationMixer(rig.root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();

  const res: ClipQaResult = {
    clip: clipName, weapon: weaponName,
    violSamples: 0, totalSamples: 0, maxDepth: 0, sumDepth: 0,
    longestRun: 0, byPart: {}, sweptOnlySamples: 0, maxCorrDeg: 0,
    capsuleFP: 0, capsuleTP: 0,
  };
  let run = 0;

  const nSamples = Math.max(2, Math.ceil(clip.duration / dt));
  const prevSlotM: THREE.Matrix4 | null = null;
  let prevM: THREE.Matrix4 | null = null;
  const worldSlices: SliceW2[] = [];

  for (let i = 0; i < nSamples; i++) {
    mixer.update(dt);
    rig.root.updateMatrixWorld(true);
    const rep = guard.update(dt, true);

    // برش‌های جهانی: پوز فعلی + زیرگام swept نسبت به فریم قبل
    worldSlices.length = 0;
    for (const s of weapon.slices) {
      worldSlices.push({
        a: s.a.clone().applyMatrix4(slot.matrixWorld),
        b: s.b.clone().applyMatrix4(slot.matrixWorld),
        r: s.r, zone: s.zone, swept: false,
      });
    }
    if (prevM) {
      const tipNow = weapon.axis.clone().multiplyScalar(weapon.bladeEnd).applyMatrix4(slot.matrixWorld);
      const tipPrev = weapon.axis.clone().multiplyScalar(weapon.bladeEnd).applyMatrix4(prevM);
      const dist = tipNow.distanceTo(tipPrev);
      if (dist > 0.035) {
        const K = Math.min(4, Math.ceil(dist / 0.035));
        const p0 = new THREE.Vector3(); const q0 = new THREE.Quaternion(); const s0v = new THREE.Vector3();
        prevM.decompose(p0, q0, s0v);
        const p1 = new THREE.Vector3().setFromMatrixPosition(slot.matrixWorld);
        const q1 = new THREE.Quaternion().setFromRotationMatrix(slot.matrixWorld);
        for (let k = 1; k < K; k++) {
          const f = k / K;
          const mi = new THREE.Matrix4().compose(p0.clone().lerp(p1, f), q0.clone().slerp(q1, f), s0v);
          for (const s of weapon.slices) {
            worldSlices.push({
              a: s.a.clone().applyMatrix4(mi),
              b: s.b.clone().applyMatrix4(mi),
              r: s.r, zone: s.zone, swept: true,
            });
          }
        }
      }
    }
    prevM = slot.matrixWorld.clone();
    void prevSlotM;

    // ارزیابی دقیق: هر رأس تغییرشکل‌یافته → فاصله تا برش‌ها
    const cloud = cloudEval.deform();
    let worst = 0; let worstPart: string | null = null; let anySweptOnly = false; let hasFinal = false;
    for (let vi = 0; vi < cloud.verts.length; vi++) {
      const p = cloud.verts[vi];
      const part = cloud.part[vi];
      for (const ws of worldSlices) {
        if (ws.zone === 'handle' && (gripChain.has(part ?? '') || (twoHanded && offChain.has(part ?? '')))) continue;
        const d = pointSegDist(p, ws.a, ws.b);
        const depth = ws.r - d;
        if (depth <= tolerance) continue;
        if (depth > worst) { worst = depth; worstPart = part; }
        if (ws.swept && !anySweptOnly) {
          // نقض فقط در زیرگام؟ فعلاً شمارندهٔ ترکیبی — جزئیات زیر
          anySweptOnly = true;
        }
        if (!ws.swept) hasFinal = true;
      }
    }
    if (worst > 0) {
      run++;
      res.violSamples++;
      res.longestRun = Math.max(res.longestRun, run);
      res.maxDepth = Math.max(res.maxDepth, worst);
      res.sumDepth += worst;
      if (worstPart) res.byPart[worstPart] = (res.byPart[worstPart] ?? 0) + 1;
      if (!hasFinal && anySweptOnly) res.sweptOnlySamples++;
    } else {
      run = 0;
    }
    // وفاداری سیگنال کپسولی: آیا هارنس کپسولی و هندسهٔ دقیق هم‌نظرند؟
    if (rep.violations.length > 0 && worst > 0) res.capsuleTP++;
    else if (rep.violations.length > 0 && worst === 0) res.capsuleFP++;

    const ang = guard.appliedAngles();
    res.maxCorrDeg = Math.max(res.maxCorrDeg, THREE.MathUtils.radToDeg(Math.max(ang.elbow, ang.shoulder)));
    res.totalSamples++;
  }
  action.stop();
  mixer.stopAllAction();
  return res;
}

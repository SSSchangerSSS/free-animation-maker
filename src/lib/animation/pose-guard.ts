// ─────────────────────────────────────────────────────────────
// Pose-Guard — جلوگیری از نفوذ سلاح در بدن (اولویت ۱ پروژه)
//
// دو بخش کاملاً جدا:
//   الف) تشخیص: مسیر swept تیغه (برش‌های کپسولی پروفایل سلاح با
//       زیرگام‌بندی بین پوز رندرشدهٔ قبلی و فعلی) در برابر کپسول‌های
//       بدن (از رئوس اسکین‌شده) — یعنی «مسیر طی‌شدهٔ کل تیغه»
//       بررسی می‌شود، نه فقط نوک و نه فقط فریم پایانی.
//   ب) اصلاح: چرخش افزایشی کوچک آرنج/شانهٔ دستِ سلاح با:
//       • محور حل‌شده از هندسه (حرکتِ نقطهٔ تماس ∥ جهت جداسازی)
//       • سقف گام هر فریم + هموارسازی نمایی (پیوستگی زمانی — بدون پرش)
//       • سقف کل نسبت به پوز انیمیت‌شده (حدود مفصلی)
//       • بازگشت نرم به صفر وقتی برخورد منتفی می‌شود
//
// تماس مجاز صریح: ناحیهٔ «دسته» سلاح با زنجیرهٔ دستِ گیرنده فقط.
// عبور تیغه از کف دست یا ساعد از سینه = نقض.
//
// گزارش، وضعیت رندرشده است: نقض‌های باقی‌مانده پس از اعمال اصلاح
// هموارشده → invalid=true برای نشانگر «آزمایشی» در UI. هیچ چیز
// مخفی، کوچک یا جابه‌جا نمی‌شود.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { WeaponProfile } from './weapon-profiles';
import type { BodyVolumeSet } from '../character/body-volumes';

export interface PoseGuardConfig {
  /** بازویی که سلاح را می‌گیرد */
  weaponArm: 'R' | 'L';
  /** عمق نفوذی که نقض محسوب می‌شود (m) */
  tolerance: number;
  /** حداکثر چرخش اصلاحی هدف در هر فریم (rad) */
  maxStep: number;
  /** حداکثر چرخش انباشته نسبت به پوز انیمیت‌شده (rad) */
  maxTotal: number;
  /** رادیان اصلاح به ازای هر متر نفوذ */
  depthGain: number;
  /** آستانهٔ زیرگام‌بندی swept بر اساس جابه‌جایی نوک (m) */
  sweepStep: number;
  maxSweep: number;
  /** برای هارنس QA: بدون هموارسازی — هدف بلافاصله اعمال می‌شود */
  instant: boolean;
}

export const DEFAULT_GUARD_CFG: PoseGuardConfig = {
  weaponArm: 'R',
  // آستانهٔ اقدام (تصمیم به اصلاح) — کپسول‌ها تقریبی‌اند (~۲-۳cm خطا).
  // ملاک گزارش QA جداگانه و دقیق‌تر است (۱٫۲cm روی هندسهٔ واقعی).
  tolerance: 0.03,
  maxStep: THREE.MathUtils.degToRad(5),
  maxTotal: THREE.MathUtils.degToRad(30),
  depthGain: 14,
  sweepStep: 0.035,
  maxSweep: 4,
  instant: false,
};

export interface GuardViolation {
  /** استخوان canonical عضو درگیر */
  part: string;
  /** عمق نفوذ (m) */
  depth: number;
  /** نقطهٔ تماس جهانی */
  point: THREE.Vector3;
  /** در زیرگام swept (حرکت سریع) یا پوز نهایی */
  swept: boolean;
}

export interface PoseGuardReport {
  /** نقض‌های باقی‌مانده در پوز رندرشدهٔ همین فریم */
  violations: GuardViolation[];
  corrected: boolean;
  /** پس از اصلاح هنوز نفوذ هست — وضعیت آزمایشی/نامعتبر برای UI */
  invalid: boolean;
  totalDepth: number;
}

export interface PoseGuardRig {
  root: THREE.Object3D;
  /** استخوان‌های canonical (خروجی detectHumanoidBones) */
  bones: Record<string, THREE.Object3D>;
  /** نود والد سلاح (handslot) — world آن باید به‌روز باشد */
  handSlot: THREE.Object3D | null;
}

// ── نزدیک‌ترین فاصلهٔ دو پاره‌خط (Ericson) ──
function closestSegSeg(
  p1: THREE.Vector3, q1: THREE.Vector3,
  p2: THREE.Vector3, q2: THREE.Vector3,
  out: { c1: THREE.Vector3; c2: THREE.Vector3; distSq: number },
) {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.lengthSq(), e = d2.lengthSq(), f = d2.dot(r);
  let s: number, t: number;
  const EPS = 1e-10;
  if (a <= EPS && e <= EPS) { s = 0; t = 0; }
  else if (a <= EPS) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1.dot(r);
    if (e <= EPS) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1.dot(d2);
      const denom = a * e - b * b;
      s = denom > EPS ? Math.min(1, Math.max(0, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  out.c1.copy(p1).addScaledVector(d1, s);
  out.c2.copy(p2).addScaledVector(d2, t);
  out.distSq = out.c1.distanceToSquared(out.c2);
}

export interface PoseGuard {
  /** یک گام: اندازه‌گیری + اصلاح هموارشده + گزارشِ وضعیت رندرشده */
  update(dt: number, weaponInHand: boolean): PoseGuardReport;
  /** فقط اندازه‌گیری (پوز فعلی را دست نمی‌زند) — برای هارنس QA */
  measure(): PoseGuardReport;
  reset(): void;
  appliedAngles(): { elbow: number; shoulder: number };
}

interface SliceW { a: THREE.Vector3; b: THREE.Vector3; r: number; zone: 'handle' | 'blade'; swept: boolean }

export function createPoseGuard(
  rig: PoseGuardRig,
  weapon: WeaponProfile | null,
  volumes: BodyVolumeSet,
  cfgIn?: Partial<PoseGuardConfig>,
): PoseGuard {
  // کلیدهای undefined حذف می‌شوند تا پیش‌فرض‌ها override نشوند
  const clean: Partial<PoseGuardConfig> = {};
  if (cfgIn) for (const [k, v] of Object.entries(cfgIn)) if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
  const cfg = { ...DEFAULT_GUARD_CFG, ...clean };
  const arm = cfg.weaponArm;
  const elbow = rig.bones[`lowerArm${arm}`] ?? null;
  const shoulder = rig.bones[`upperArm${arm}`] ?? null;
  const gripChain = new Set([`upperArm${arm}`, `lowerArm${arm}`, `hand${arm}`]);
  // سلاح دودستی: دست دوم روی دسته — تماس دسته با زنجیرهٔ دست دوم مجاز و صریح است
  const offArm = arm === 'R' ? 'L' : 'R';
  const twoHanded = !!weapon?.secondHand;
  const offChain = new Set([`upperArm${offArm}`, `lowerArm${offArm}`, `hand${offArm}`]);

  // وضعیت هموارشدهٔ اصلاح (چهارمک در فضای محلی والد)
  const curElbow = new THREE.Quaternion();
  const curShoulder = new THREE.Quaternion();
  const tgtElbow = new THREE.Quaternion();
  const tgtShoulder = new THREE.Quaternion();
  /** پوز رندرشدهٔ فریم قبل handslot — مبنای swept */
  let prevSlotM: THREE.Matrix4 | null = null;
  /** هیسترزیس: اصلاح فقط پس از ۲ فریم نقض پیوسته (مقاوم به فلیکر کپسول) */
  let violateRun = 0;

  const vsScratch: GuardViolation[] = [];
  const segRes = { c1: new THREE.Vector3(), c2: new THREE.Vector3(), distSq: 0 };
  const _pw = new THREE.Quaternion();
  const _dq = new THREE.Quaternion();

  function evalSlices(slices: SliceW[], out: GuardViolation[]) {
    for (const [canon, caps] of Object.entries(volumes.byCanon)) {
      const bone = rig.bones[canon];
      if (!bone) continue;
      for (const vol of caps) {
        const aW = vol.a.clone().applyMatrix4(bone.matrixWorld);
        const bW = vol.b.clone().applyMatrix4(bone.matrixWorld);
        for (const ws of slices) {
          closestSegSeg(aW, bW, ws.a, ws.b, segRes);
          const depth = ws.r + vol.r - Math.sqrt(segRes.distSq);
          if (depth <= cfg.tolerance) continue;
          // تماس مجاز صریح و محدود: دسته × زنجیرهٔ دست گیرنده
          // (دست دوم فقط برای سلاح دودستی — روی ناحیهٔ دسته)
          if (ws.zone === 'handle' && (gripChain.has(canon) || (twoHanded && offChain.has(canon)))) continue;
          out.push({
            part: canon, depth,
            point: segRes.c1.clone().lerp(segRes.c2, 0.5),
            swept: ws.swept,
          });
        }
      }
    }
  }

  /**
   * جمع عمق نفوذ اضافه بر آستانه روی «همهٔ» کپسول‌ها — دقیق:
   * کپسول‌های دیستال نسبت به مفصلِ چرخان صلب همراهش می‌چرخند
   * (lowerArm/hand برای آرنج؛ + upperArm برای شانه)، بقیه ثابت‌اند.
   */
  function capsuleObjective(
    slices: SliceW[],
    pivot: THREE.Vector3 | null,
    q: THREE.Quaternion | null,
    moved: Set<string>,
  ): number {
    let sum = 0;
    const aT = new THREE.Vector3(); const bT = new THREE.Vector3();
    for (const [canon, caps] of Object.entries(volumes.byCanon)) {
      const bone = rig.bones[canon];
      if (!bone) continue;
      const isMoved = moved.has(canon);
      for (const vol of caps) {
        if (isMoved && pivot && q) {
          aT.copy(vol.a).sub(pivot).applyQuaternion(q).add(pivot);
          bT.copy(vol.b).sub(pivot).applyQuaternion(q).add(pivot);
        } else {
          aT.copy(vol.a).applyMatrix4(bone.matrixWorld);
          bT.copy(vol.b).applyMatrix4(bone.matrixWorld);
        }
        for (const ws of slices) {
          closestSegSeg(aT, bT, ws.a, ws.b, segRes);
          const depth = ws.r + vol.r - Math.sqrt(segRes.distSq);
          if (depth > cfg.tolerance) sum += depth - cfg.tolerance;
        }
      }
    }
    return sum;
  }

  function buildSlices(weaponInHand: boolean): { slices: SliceW[]; ok: boolean } {
    const slices: SliceW[] = [];
    if (!weaponInHand || !weapon || !rig.handSlot) return { slices, ok: false };
    const slot = rig.handSlot;
    // پوز فعلی
    for (const s of weapon.slices) {
      slices.push({
        a: s.a.clone().applyMatrix4(slot.matrixWorld),
        b: s.b.clone().applyMatrix4(slot.matrixWorld),
        r: s.r, zone: s.zone, swept: false,
      });
    }
    // swept: زیرگام بین پوز قبلی و فعلی — کل مسیر تیغه پوشش داده می‌شود
    if (prevSlotM) {
      const tipNow = weapon.axis.clone().multiplyScalar(weapon.bladeEnd).applyMatrix4(slot.matrixWorld);
      const tipPrev = weapon.axis.clone().multiplyScalar(weapon.bladeEnd).applyMatrix4(prevSlotM);
      const dist = tipNow.distanceTo(tipPrev);
      if (dist > cfg.sweepStep) {
        const K = Math.min(cfg.maxSweep, Math.ceil(dist / cfg.sweepStep));
        const p0 = new THREE.Vector3(); const q0 = new THREE.Quaternion(); const s0 = new THREE.Vector3();
        prevSlotM.decompose(p0, q0, s0);
        const p1 = new THREE.Vector3().setFromMatrixPosition(slot.matrixWorld);
        const q1 = new THREE.Quaternion().setFromRotationMatrix(slot.matrixWorld);
        for (let k = 1; k < K; k++) {
          const f = k / K;
          const mi = new THREE.Matrix4().compose(p0.clone().lerp(p1, f), q0.clone().slerp(q1, f), s0);
          for (const s of weapon.slices) {
            slices.push({
              a: s.a.clone().applyMatrix4(mi),
              b: s.b.clone().applyMatrix4(mi),
              r: s.r, zone: s.zone, swept: true,
            });
          }
        }
      }
    }
    return { slices, ok: true };
  }

  function measure(): PoseGuardReport {
    const report: PoseGuardReport = { violations: vsScratch, corrected: false, invalid: false, totalDepth: 0 };
    vsScratch.length = 0;
    const { slices, ok } = buildSlices(true);
    if (!ok) { prevSlotM = null; return report; }
    evalSlices(slices, vsScratch);
    report.totalDepth = vsScratch.reduce((s, v) => s + v.depth, 0);
    return report;
  }

  /** چرخش جهانی Δ حول محور axis (از مبدأ bone) → فضای محلی والد */
  function toLocalDelta(bone: THREE.Object3D, axisW: THREE.Vector3, angle: number): THREE.Quaternion {
    const parent = bone.parent;
    if (parent) parent.getWorldQuaternion(_pw);
    else _pw.identity();
    _dq.setFromAxisAngle(axisW, angle);
    return _pw.clone().invert().multiply(_dq).multiply(_pw);
  }

  function clampQuatAngle(q: THREE.Quaternion, maxAngle: number) {
    const w = Math.min(1, Math.max(-1, q.w));
    const angle = 2 * Math.acos(w);
    if (angle <= maxAngle) return;
    const t = maxAngle / angle;
    const s = Math.sqrt(1 - t * t);
    q.set(q.x * s, q.y * s, q.z * s, t).normalize();
  }

  function update(dt: number, weaponInHand: boolean): PoseGuardReport {
    tgtElbow.identity();
    tgtShoulder.identity();

    // ۱) اندازه‌گیری پوز فعلی (پس از Blend — ماتریس‌ها باید به‌روز باشند)
    const { slices, ok } = buildSlices(weaponInHand);
    vsScratch.length = 0;
    if (ok) evalSlices(slices, vsScratch);

    // ۲) انتخاب اصلاح با جست‌وجوی حریصانهٔ چندکاندیدی — با هیسترزیس ۲ فریم
    // کاندیدها: ±X/±Y/±Z جهانی در آرنج و شانه با دو بزرگی زاویه.
    // هدف: کمینه‌کردن نفوذ کل روی مدل کپسولی، «به‌جز» کپسول‌های زنجیرهٔ
    // بازوی سلاح (آن‌ها با چرخش مفصل حرکت می‌کنند و در ارزیابی دقیق
    // نیستند) — برای بقیهٔ کپسول‌ها ارزیابی چرخشِ برش‌ها حول پوت دقیق است.
    // انتخابِ بهترین تضمین می‌کند روی هدف کپسولی هرگز بدتر از بی‌عمل نشویم.
    if (vsScratch.length) violateRun++; else violateRun = 0;
    if (vsScratch.length && elbow && (violateRun >= 2 || cfg.instant)) {
      let worst: GuardViolation | null = null;
      for (const v of vsScratch) if (!worst || v.depth > worst.depth) worst = v;
      const worstDepth = worst!.depth;
      const finalSlices = slices.filter((s) => !s.swept);
      const baseScore = capsuleObjective(finalSlices, null, null, new Set());
      const angle = Math.min(cfg.maxStep, Math.max(0.02, worstDepth * cfg.depthGain));

      // کپسول‌های دیستال هر مفصل — با همان چرخش جابه‌جا می‌شوند (هدف دقیق)
      const arm = cfg.weaponArm;
      const movedFor = (joint: 'elbow' | 'shoulder') => {
        const s = new Set<string>([`hand${arm}`]);
        if (joint === 'elbow') { s.add(`lowerArm${arm}`); }
        else { s.add(`lowerArm${arm}`); s.add(`upperArm${arm}`); }
        return s;
      };

      const joints: { obj: THREE.Object3D; scale: number; kind: 'elbow' | 'shoulder' }[] = [{ obj: elbow, scale: 1, kind: 'elbow' }];
      if (shoulder) joints.push({ obj: shoulder, scale: 0.7, kind: 'shoulder' });
      const axes = [
        new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
      ];
      const magnitudes = [angle, angle * 0.5];

      let bestScore = baseScore;
      let bestDqE = new THREE.Quaternion();
      let bestDqS = new THREE.Quaternion();

      const rotAboutPivot = (p: THREE.Vector3, q: THREE.Quaternion, pivot: THREE.Vector3, out: { a: THREE.Vector3; b: THREE.Vector3 }) => {
        out.a.copy(p).sub(pivot).applyQuaternion(q).add(pivot);
        out.b.copy(p).sub(pivot).applyQuaternion(q).add(pivot);
      };

      for (const j of joints) {
        const pivotP = j.obj.getWorldPosition(new THREE.Vector3());
        const rotated = { a: new THREE.Vector3(), b: new THREE.Vector3() };
        for (const axis of axes) {
          for (const mag of magnitudes) {
            const ang = mag * j.scale;
            const q = new THREE.Quaternion().setFromAxisAngle(axis, ang);
            // برش‌ها را حول پوت می‌چرخانیم و هدف کپسولی می‌سنجیم
            const cand: SliceW[] = finalSlices.map((s) => {
              rotAboutPivot(s.a, q, pivotP, rotated);
              const a = rotated.a.clone();
              rotAboutPivot(s.b, q, pivotP, rotated);
              return { a, b: rotated.b.clone(), r: s.r, zone: s.zone, swept: false };
            });
            const score = capsuleObjective(cand, pivotP, q, movedFor(j.kind));
            if (score < bestScore - 1e-6) {
              bestScore = score;
              const dq = toLocalDelta(j.obj, axis, ang);
              if (j.obj === elbow) { bestDqE = dq; bestDqS = new THREE.Quaternion(); }
              else { bestDqS = dq; bestDqE = new THREE.Quaternion(); }
            }
          }
        }
      }
      tgtElbow.copy(bestDqE);
      tgtShoulder.copy(bestDqS);
    }

    // ۳) هموارسازی (یا فوری در حالت هارنس) + حدود مفصلی
    const k = cfg.instant ? 1 : 1 - Math.exp(-dt * 12);
    curElbow.slerp(tgtElbow, k);
    curShoulder.slerp(tgtShoulder, k);
    clampQuatAngle(curElbow, cfg.maxTotal);
    clampQuatAngle(curShoulder, cfg.maxTotal * 0.6);

    // ۴) اعمال روی پوز انیمیت‌شده (افزایشی — mixer هر فریم بازنویسی می‌کند)
    let applied = false;
    const el = Math.abs(curElbow.x) + Math.abs(curElbow.y) + Math.abs(curElbow.z);
    const sh = Math.abs(curShoulder.x) + Math.abs(curShoulder.y) + Math.abs(curShoulder.z);
    if (el > 1e-6 && elbow) { elbow.quaternion.multiply(curElbow); applied = true; }
    if (sh > 1e-6 && shoulder) { shoulder.quaternion.multiply(curShoulder); applied = true; }

    // ۵) ارزیابی دوباره پس از اصلاح — گزارش = وضعیت رندرشده
    const report: PoseGuardReport = { violations: [], corrected: applied, invalid: false, totalDepth: 0 };
    if (weaponInHand) {
      rig.root.updateMatrixWorld(true);
      const re = buildSlices(true);
      if (re.ok) {
        const remaining: GuardViolation[] = [];
        evalSlices(re.slices, remaining);
        report.violations = remaining;
        report.invalid = remaining.length > 0;
        report.totalDepth = remaining.reduce((s, v) => s + v.depth, 0);
      }
      // مبنا برای swept فریم بعد = پوز رندرشدهٔ همین فریم (پس از اصلاح)
      if (rig.handSlot) prevSlotM = rig.handSlot.matrixWorld.clone();
    } else {
      prevSlotM = null;
    }
    return report;
  }

  function reset() {
    curElbow.identity(); curShoulder.identity();
    tgtElbow.identity(); tgtShoulder.identity();
    prevSlotM = null;
  }

  function appliedAngles() {
    return {
      elbow: 2 * Math.acos(Math.min(1, Math.abs(curElbow.w))),
      shoulder: 2 * Math.acos(Math.min(1, Math.abs(curShoulder.w))),
    };
  }

  return { update, measure, reset, appliedAngles };
}

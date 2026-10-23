// ─────────────────────────────────────────────────────────────
// AntiClip — جلوگیری از نفوذ سلاح در بدن (مأموریت §۲)
//
// دو بخش مجزا طبق مأموریت:
//   ۱) تشخیص: حجم‌های تقریبی بدن (کپسول per استخوان) + نمونه‌گیری
//      تیغه در ۸ نقطه + swept بین فریم قبلی و فعلی (حرکت سریع)
//   ۲) اصلاح: جست‌وجوی کاندید چرخش مچ (±δ حول دو محور) با کمینه‌سازی
//      نفوذ — بدون به‌روزرسانی صحنه (FK دستی از ماتریس دست)؛
//      fallback: جابه‌جایی سلاح در راستای نرمال (حداکثر ۴cm)
//
// تماس‌های مجاز: دستِ چنگ‌زننده با ناحیه‌ی دسته — کپسول‌های
// ساعد/دست همان سمت از آزمون تیغه مستثنا می‌شوند (گرفتن دسته).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export interface Capsule {
  a: THREE.Vector3;
  b: THREE.Vector3;
  r: number;
  tag: string;
}

/** نیم‌متر شعاع کپسول هر بخش canonical — با bulk مقیاس می‌شود */
const CAPSRadii: Record<string, number> = {
  head: 0.13, neck: 0.055, chest: 0.155, spine: 0.14, hips: 0.13,
  upperArmL: 0.062, upperArmR: 0.062,
  lowerArmL: 0.048, lowerArmR: 0.048,
  handL: 0.045, handR: 0.045,
  upperLegL: 0.085, upperLegR: 0.085,
  lowerLegL: 0.062, lowerLegR: 0.062,
};

export interface AntiClipOptions {
  /** استخوان‌های canonical بدنه (از detectHumanoidBones) */
  bones: Record<string, THREE.Bone>;
  /** ضریب پهنای بدن (bulk) برای شعاع کپسول‌ها */
  bulk?: number;
}

/** نزدیک‌ترین فاصله بین دو پاره‌خط — خروجی: فاصله و نقاط */
function segSegClosest(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3,
  c1: THREE.Vector3, c2: THREE.Vector3): number {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;
  const EPS = 1e-9;
  if (a <= EPS && e <= EPS) { c1.copy(p1); c2.copy(p2); return c1.distanceTo(c2); }
  if (a <= EPS) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
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
  c1.copy(p1).addScaledVector(d1, s);
  c2.copy(p2).addScaledVector(d2, t);
  return c1.distanceTo(c2);
}

export class AntiClip {
  private bones: Record<string, THREE.Bone>;
  private bulk: number;
  private capsules: Capsule[] = [];
  /** تیغه‌ی فریم قبل — برای swept */
  private prevFrom: THREE.Vector3 | null = null;
  private prevTo: THREE.Vector3 | null = null;
  /** اصلاح نرم فعلی مچ */
  private smoothQ = new THREE.Quaternion();
  private hasSmooth = false;
  /** اعمال فعلی روی سلاح (جابه‌جایی) */
  private smoothPush = new THREE.Vector3();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpD = new THREE.Vector3();

  constructor(opts: AntiClipOptions) {
    this.bones = opts.bones;
    this.bulk = opts.bulk ?? 1;
  }

  dispose() {
    this.capsules.length = 0;
    this.prevFrom = null; this.prevTo = null;
    this.hasSmooth = false;
  }

  /** ساخت کپسول‌ها از موقعیت‌های جهانی فعلی استخوان‌ها */
  private buildCapsules(excludeTags: Set<string>) {
    this.capsules.length = 0;
    const w = (bone: THREE.Bone | undefined, out: THREE.Vector3) => {
      if (!bone) return false;
      bone.updateWorldMatrix(true, false);
      out.setFromMatrixPosition(bone.matrixWorld);
      return true;
    };
    const vA = this.tmpA, vB = this.tmpB;
    const push = (canon: string, childCanon: string | null, r: number, tag: string) => {
      const bone = this.bones[canon];
      if (!bone) return;
      const child = childCanon ? this.bones[childCanon] : null;
      if (child) {
        if (!w(bone, vA) || !w(child, vB)) return;
      } else {
        // استخوان انتهایی — کپسول کوتاه به سمت پایین/بیرون
        if (!w(bone, vA)) return;
        vB.copy(vA).add(new THREE.Vector3(0, -0.12, 0));
      }
      this.capsules.push({ a: vA.clone(), b: vB.clone(), r: r * this.bulk, tag });
    };
    push('hips', 'spine', CAPSRadii.hips, 'hips');
    push('spine', 'chest', CAPSRadii.spine, 'spine');
    push('chest', 'neck', CAPSRadii.chest, 'chest');
    push('neck', 'head', CAPSRadii.neck, 'neck');
    push('head', null, CAPSRadii.head, 'head');
    push('upperLegL', 'lowerLegL', CAPSRadii.upperLegL, 'upperLegL');
    push('upperLegR', 'lowerLegR', CAPSRadii.upperLegR, 'upperLegR');
    push('lowerLegL', null, CAPSRadii.lowerLegL, 'lowerLegL');
    push('lowerLegR', null, CAPSRadii.lowerLegR, 'lowerLegR');
    // بازوها — اگر دست فعال همان سمت است، ساعد/دست مستثنا (گرفتن دسته)
    for (const side of ['L', 'R'] as const) {
      const active = excludeTags.has(`arm${side}`);
      if (!active) {
        push(`upperArm${side}`, `lowerArm${side}`, CAPSRadii[`upperArm${side}`], `upperArm${side}`);
      } else {
        // فقط بازوی بالا (نزدیک شانه) بررسی شود — ساعد/دست ناحیه‌ی چنگ مجازند
        push(`upperArm${side}`, `lowerArm${side}`, CAPSRadii[`upperArm${side}`] * 0.92, `upperArm${side}`);
      }
      if (!active) push(`lowerArm${side}`, null, CAPSRadii[`lowerArm${side}`], `lowerArm${side}`);
    }
  }

  /** عمق نفوذ یک پاره‌خط (تیغه) به کپسول‌ها — بدترین مورد؛ خروجی نرمال خروج */
  private penetrate(from: THREE.Vector3, to: THREE.Vector3): { depth: number; normal: THREE.Vector3; tag: string } {
    let worst = 0;
    const worstN = new THREE.Vector3();
    let worstTag = '';
    const c1 = this.tmpC, c2 = this.tmpD;
    const N = 6;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const p0 = from.clone().lerp(to, t0);
      const p1 = from.clone().lerp(to, t1);
      for (const cap of this.capsules) {
        const d = segSegClosest(p0, p1, cap.a, cap.b, c1, c2);
        const depth = cap.r - d;
        if (depth > worst) {
          worst = depth;
          // نرمال از محور کپسول به نزدیک‌ترین نقطه‌ی تیغه
          worstN.copy(c1).sub(c2);
          if (worstN.lengthSq() < 1e-8) worstN.set(0, 1, 0);
          worstN.normalize();
          worstTag = cap.tag;
        }
      }
    }
    return { depth: worst, normal: worstN, tag: worstTag };
  }

  /**
   * اصلاح هر فریم — بعد از mixer.update صدا زده می‌شود.
   * handBone: استخوان دستِ چنگ‌زننده (والد گروه سلاح).
   * weaponGroup: گروه سلاح (برای fallback جابه‌جایی).
   * bladeFrom/bladeTo: تیغه در فضای محلی دست (ثابت per سلاح).
   */
  update(
    handBone: THREE.Bone,
    weaponGroup: THREE.Object3D,
    bladeFromLocal: THREE.Vector3,
    bladeToLocal: THREE.Vector3,
  ): void {
    const side = handBone.name.endsWith('_l') || handBone.name.includes('L') ? 'L' : 'R';
    this.buildCapsules(new Set([`arm${side}`]));

    // تیغه در فضای محلی دست → جهان (با چرخش کاندید، بدون به‌روزرسانی صحنه)
    const handWorld = new THREE.Matrix4().copy(handBone.matrixWorld);
    const bladeW = (R: THREE.Quaternion | null) => {
      const m = R ? handWorld.clone().multiply(new THREE.Matrix4().makeRotationFromQuaternion(R)) : handWorld.clone();
      const from = bladeFromLocal.clone().applyMatrix4(m);
      const to = bladeToLocal.clone().applyMatrix4(m);
      return { from, to };
    };

    const base = bladeW(null);

    // swept: مسیر تیغه از فریم قبل
    let swept = this.penetrate(base.from, base.to);
    if (this.prevFrom && this.prevTo) {
      // بدترین حالت: نوک تیغه بین دو فریم + وضعیت فعلی
      const tipPrev = this.prevTo.clone();
      const tipNow = base.to.clone();
      const p1 = this.penetrate(tipPrev, tipNow);
      if (p1.depth > swept.depth) swept = p1;
    }
    this.prevFrom = base.from.clone();
    this.prevTo = base.to.clone();

    if (swept.depth <= 0.004) {
      // بی‌نفوذ — اصلاح نرم به صفر برگردد
      this.smoothQ.slerp(new THREE.Quaternion(), 0.25);
      this.smoothPush.multiplyScalar(0.75);
      if (this.smoothQ.lengthSq() > 1e-8) handBone.quaternion.multiply(this.smoothQ);
      if (this.smoothPush.lengthSq() > 1e-8) {
        weaponGroup.position.add(this.smoothPush.clone().multiplyScalar(0.25));
      }
      return;
    }

    // ── اصلاح: جست‌وجوی کاندید چرخش مچ ──
    const axes = [
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0),
    ];
    const angles = [0.10, -0.10, 0.20, -0.20, 0.32, -0.32];
    let bestQ: THREE.Quaternion | null = null;
    let bestDepth = swept.depth;
    for (const ax of axes) {
      for (const ang of angles) {
        const R = new THREE.Quaternion().setFromAxisAngle(ax, ang);
        const { from, to } = bladeW(R);
        const res = this.penetrate(from, to);
        if (res.depth < bestDepth - 0.002) {
          bestDepth = res.depth;
          bestQ = R;
        }
        if (bestDepth <= 0.004) break;
      }
      if (bestDepth <= 0.004) break;
    }

    if (bestQ) {
      // نرم‌سازی — بدون پرش
      if (!this.hasSmooth) { this.smoothQ.copy(bestQ); this.hasSmooth = true; }
      else this.smoothQ.slerp(bestQ, 0.5);
      handBone.quaternion.multiply(this.smoothQ);
      handBone.updateWorldMatrix(false, false);
      this.smoothPush.multiplyScalar(0.7);
      return;
    }

    // ── fallback: جابه‌جایی سلاح در راستای نرمال (حداکثر ۴cm) ──
    const push = swept.normal.clone().multiplyScalar(Math.min(0.04, swept.depth));
    this.smoothPush.lerp(push, 0.5);
    weaponGroup.position.add(this.smoothPush.clone().multiplyScalar(0.35));
  }
}

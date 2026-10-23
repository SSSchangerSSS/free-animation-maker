// ─────────────────────────────────────────────────────────────
// OffHandGrip — چنگ دو‌دستی (مأموریت §۲)
//
// «برای سلاح دو‌دستی، هدف دست دوم به سلاح متصل باشد و دو حل‌کنندهٔ
// مستقل با یکدیگر نجنگند.»
//
// معماری وابستگی یک‌طرفه — بدون حلقهٔ بازخورد:
//   دست راست (کلیپ) → سلاح → نقطهٔ grip2 (فرزند گروه سلاح)
//   → حل‌کنندهٔ CCD این ماژول فقط زنجیرهٔ دست چپ را اصلاح می‌کند.
// AntiClip روی مچ دست راست کار می‌کند؛ این ماژول فقط روی
// lowerarm/upperarm/clavicle چپ — دو زنجیرهٔ جفت‌نشدنی، بدون جنگ.
//
// • فقط چرخش؛ طول استخوان‌ها دست نمی‌خورد (تست کشش در هارنس)
// • گام هر مفصل clamp می‌شود + هموارسازی نمانی زمانی (بدون پرش)
// • mixer هر فریم quats زنجیرهٔ چپ را بازنویسی می‌کند ⇒ این
//   اصلاح «افزایشی روی پوز انیمیت‌شده» است، نه حل از صفر
// • وقتی سلاح «پشت» است update() صدا زده نمی‌شود ⇒ دست آزاد
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export interface OffHandGripConfig {
  /** گام بیشینهٔ هر مفصل در هر فریم (rad) */
  maxStep: number;
  /** تعداد تکرار CCD در هر فریم */
  iterations: number;
  /** ثابت هموارسازی زمانی (سرعت نرخ نمایی) */
  smoothRate: number;
  /** برای هارنس QA: بدون هموارسازی — هدف بلافاصله دنبال می‌شود */
  instant: boolean;
}

export const DEFAULT_GRIP_CFG: OffHandGripConfig = {
  maxStep: THREE.MathUtils.degToRad(12),
  iterations: 3,
  smoothRate: 16,
  instant: false,
};

export interface GripReport {
  /** فاصلهٔ باقی‌ماندهٔ دست تا grip2 (m) */
  reachErr: number;
  /** بیشینهٔ زاویهٔ اعمال‌شده در این فریم (rad) */
  applied: number;
}

export class OffHandGrip {
  private chain: THREE.Bone[];
  private effector: THREE.Bone;
  private target: THREE.Object3D;
  private cfg: OffHandGripConfig;
  private tmpV1 = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private tmpAxis = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpQp = new THREE.Quaternion();
  private tmpQpInv = new THREE.Quaternion();
  private tmpWorld = new THREE.Vector3();

  constructor(opts: {
    /** زنجیره از دیستال به پرکسیمال — مثل [lowerarm_l, upperarm_l, clavicle_l] */
    chain: THREE.Bone[];
    /** استخوان دستِ دوم (hand_l) — افکتور موقعیتی */
    effector: THREE.Bone;
    /** نقطهٔ چنگ — فرزند گروه سلاح (خودکار با سلاح حرکت می‌کند) */
    target: THREE.Object3D;
    cfg?: Partial<OffHandGripConfig>;
  }) {
    this.chain = opts.chain;
    this.effector = opts.effector;
    this.target = opts.target;
    this.cfg = { ...DEFAULT_GRIP_CFG, ...opts.cfg };
  }

  /** هدف فعلی در جهان — پس از آنتی‌کلیپ/توییک چنگ باید صدا زده شود */
  private refreshTargetWorld(): THREE.Vector3 {
    this.target.updateWorldMatrix(true, false);
    return this.tmpWorld.setFromMatrixPosition(this.target.matrixWorld);
  }

  /**
   * یک گام اصلاح — بعد از mixer.update و AntiClip صدا زده شود.
   * خروجی: گزارش خطای رساندن برای ثبت عددی و نشانگر UI.
   */
  update(dt: number): GripReport {
    const targetPos = this.refreshTargetWorld().clone();
    const k = this.cfg.instant ? 1 : 1 - Math.exp(-Math.max(0, dt) * this.cfg.smoothRate);
    let applied = 0;

    for (let it = 0; it < this.cfg.iterations; it++) {
      for (const link of this.chain) {
        link.updateWorldMatrix(true, true);
        const lp = new THREE.Vector3().setFromMatrixPosition(link.matrixWorld);
        const ep = new THREE.Vector3().setFromMatrixPosition(this.effector.matrixWorld);
        this.tmpV1.subVectors(ep, lp);
        this.tmpV2.subVectors(targetPos, lp);
        const l1 = this.tmpV1.length();
        const l2 = this.tmpV2.length();
        if (l1 < 1e-6 || l2 < 1e-6) continue;
        this.tmpV1.divideScalar(l1);
        this.tmpV2.divideScalar(l2);
        const cos = Math.min(1, Math.max(-1, this.tmpV1.dot(this.tmpV2)));
        const angle = Math.acos(cos);
        if (angle < 1e-4) continue;
        this.tmpAxis.crossVectors(this.tmpV1, this.tmpV2);
        if (this.tmpAxis.lengthSq() < 1e-10) continue;
        this.tmpAxis.normalize();
        // گام مفصلی clamp — هیچ پرشی رخ نمی‌دهد
        const step = Math.min(angle, this.cfg.maxStep);
        const worldDelta = new THREE.Quaternion().setFromAxisAngle(this.tmpAxis, step * k);
        // تبدیل چرخش جهانی به فضای محلی مفصل: Lq' = (Qp⁻¹·W·Qp)·Lq
        const parent = link.parent;
        if (!parent) continue;
        parent.updateWorldMatrix(true, false);
        this.tmpQp.setFromRotationMatrix(parent.matrixWorld);
        // حذف مقیاس از کواترنیون والد (ریگ ممکن است scale داشته باشد)
        this.tmpQp.normalize();
        this.tmpQpInv.copy(this.tmpQp).invert();
        this.tmpQ.copy(this.tmpQpInv).multiply(worldDelta).multiply(this.tmpQp);
        link.quaternion.premultiply(this.tmpQ);
        applied = Math.max(applied, step * k);
        // به‌روزرسانی زیردرخت برای تکرار بعدی
        link.updateWorldMatrix(false, true);
      }
    }

    // خطای رساندن نهایی
    this.effector.updateWorldMatrix(true, false);
    const ep = new THREE.Vector3().setFromMatrixPosition(this.effector.matrixWorld);
    return { reachErr: ep.distanceTo(targetPos), applied };
  }
}

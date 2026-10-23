// ─────────────────────────────────────────────────────────────
// TwoHandIK — اتصال دست دوم به نقطه‌ی grip2 سلاح دو‌دست
// مأموریت §۲: «هدف دست دوم به سلاح متصل باشد و دو حل‌کنندهٔ
// مستقل با یکدیگر نجنگند» — این حل‌کننده فقط زنجیره‌ی دست چپ را
// می‌نویسد (anticlip فقط مچ راست/گروه سلاح را اصلاح می‌کند).
// تحلیلی دواستخوانی روی استخوان‌های واقعی ریگ + محدودیت برد.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export interface TwoHandIKOpts {
  upper: THREE.Bone;   // upperarm_l
  lower: THREE.Bone;   // lowerarm_l
  hand: THREE.Bone;    // hand_l (مبدأ مچ)
  /** جهت کشش آرنج در فضای جهان (پایین-بیرون برای چپ) */
  pole?: THREE.Vector3;
}

export class TwoHandIK {
  private upper: THREE.Bone;
  private lower: THREE.Bone;
  private hand: THREE.Bone;
  private pole: THREE.Vector3;
  private l1 = 0.25;
  private l2 = 0.22;
  private restDir1 = new THREE.Vector3(-1, 0, 0);
  private restDir2 = new THREE.Vector3(-1, 0, 0);
  /** آخرین وضعیت — برای QA/دیباگ */
  lastReach = 1;

  constructor(opts: TwoHandIKOpts) {
    this.upper = opts.upper;
    this.lower = opts.lower;
    this.hand = opts.hand;
    this.pole = (opts.pole ?? new THREE.Vector3(1, -0.5, -0.3)).normalize();
    this.measure();
  }

  /** اندازه‌گیری طول قطعات و جهت‌های rest از خود ریگ */
  private measure() {
    this.upper.updateWorldMatrix(true, false);
    this.lower.updateWorldMatrix(true, false);
    this.hand.updateWorldMatrix(true, false);
    const pU = new THREE.Vector3().setFromMatrixPosition(this.upper.matrixWorld);
    const pL = new THREE.Vector3().setFromMatrixPosition(this.lower.matrixWorld);
    const pH = new THREE.Vector3().setFromMatrixPosition(this.hand.matrixWorld);
    this.l1 = Math.max(0.05, pL.distanceTo(pU));
    this.l2 = Math.max(0.05, pH.distanceTo(pL));
    // جهت rest هر قطعه در قاب والدش (پوز T بدون چرخش)
    const rest1W = pL.clone().sub(pU).normalize();
    const rest2W = pH.clone().sub(pL).normalize();
    const qUinv = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().extractRotation(this.upper.matrixWorld),
    ).invert();
    const qLinv = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().extractRotation(this.lower.matrixWorld),
    ).invert();
    this.restDir1 = rest1W.applyQuaternion(qUinv).normalize();
    this.restDir2 = rest2W.applyQuaternion(qLinv).normalize();
  }

  /**
   * حل IK — gripWorld: نقطه‌ی هدف مچ چپ (grip2 سلاح در جهان).
   * بعد از mixer.update صدا زده شود؛ فقط upper/lower می‌نویسد.
   */
  update(gripWorld: THREE.Vector3): void {
    this.upper.updateWorldMatrix(true, false);
    const P = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().extractRotation(this.upper.parent!.matrixWorld),
    );
    const shoulder = new THREE.Vector3().setFromMatrixPosition(this.upper.matrixWorld);

    const delta = gripWorld.clone().sub(shoulder);
    const maxD = (this.l1 + this.l2) * 0.995;
    const d = Math.min(Math.max(delta.length(), 1e-4), maxD);
    this.lastReach = delta.length() / maxD;
    const dir = delta.normalize();

    const perp = this.pole.clone().addScaledVector(dir, -this.pole.dot(dir));
    if (perp.lengthSq() < 1e-6) {
      perp.set(0, 0, 1).cross(dir);
      if (perp.lengthSq() < 1e-6) perp.set(0, 1, 0).cross(dir);
    }
    perp.normalize();
    const a = (this.l1 * this.l1 - this.l2 * this.l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, this.l1 * this.l1 - a * a));
    const elbow = shoulder.clone().addScaledVector(dir, a).addScaledVector(perp, h);
    const d1 = elbow.clone().sub(shoulder).normalize();
    const d2 = gripWorld.clone().sub(elbow).normalize();

    const upWorld = new THREE.Quaternion().setFromUnitVectors(
      this.restDir1.clone().applyQuaternion(P), d1,
    ).multiply(P);
    const loWorld = new THREE.Quaternion().setFromUnitVectors(this.restDir2, d2);
    // محلی
    this.upper.quaternion.copy(P.clone().invert().multiply(upWorld));
    this.lower.quaternion.copy(upWorld.clone().invert().multiply(loWorld));
    this.upper.updateWorldMatrix(false, true);
  }

  dispose() { /* بدون منبع */ }
}

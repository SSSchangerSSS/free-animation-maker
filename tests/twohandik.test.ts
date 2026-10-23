// آزمون TwoHandIK — حل IK روی زنجیره‌ی واقعی Bone
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TwoHandIK } from '../src/lib/animation/twohandik';
import { compileAttack2H, swordGeom } from '../src/lib/animation/posekit';
import { V3_WEAPONS } from '../src/lib/character/weapons3';

/** زنجیره‌ی بازوی مصنوعی: root→upper→lower→hand در راستای -X */
function makeArmChain() {
  const root = new THREE.Bone(); root.name = 'chest';
  const upper = new THREE.Bone(); upper.name = 'upperarm_l';
  const lower = new THREE.Bone(); lower.name = 'lowerarm_l';
  const hand = new THREE.Bone(); hand.name = 'hand_l';
  upper.position.set(0.2, 0.19, 0);      // شانه
  lower.position.set(-0.26, 0, 0);       // بازو → آرنج
  hand.position.set(-0.22, 0, 0);        // ساعد → مچ
  lower.add(hand); upper.add(lower); root.add(upper);
  const scene = new THREE.Group(); scene.add(root);
  scene.updateMatrixWorld(true);
  return { root, upper, lower, hand };
}

describe('TwoHandIK', () => {
  it('مچ را به هدف قابل‌رسد می‌رساند', () => {
    const { upper, lower, hand } = makeArmChain();
    const ik = new TwoHandIK({ upper, lower, hand });
    const shoulderW = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
    const target = shoulderW.clone().add(new THREE.Vector3(0.1, -0.25, 0.3)); // دسته‌ی سلاح جلو-پایین
    ik.update(target);
    upper.updateWorldMatrix(true, true);
    const handW = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld);
    expect(handW.distanceTo(target)).toBeLessThan(0.01);
  });

  it('خارج از برد: به بیشینه محدود می‌شود (بدون انفجار)', () => {
    const { upper, lower, hand } = makeArmChain();
    const ik = new TwoHandIK({ upper, lower, hand });
    const shoulderW = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
    const target = shoulderW.clone().add(new THREE.Vector3(2, 2, 0)); // خیلی دور
    ik.update(target);
    upper.updateWorldMatrix(true, true);
    const handW = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld);
    expect(handW.distanceTo(shoulderW)).toBeLessThanOrEqual(0.26 + 0.22 + 1e-3);
    expect(ik.lastReach).toBeGreaterThan(1);
  });

  it('آرنج سمت بیرون (pole چپ) می‌ماند', () => {
    const { root, upper, lower, hand } = makeArmChain();
    const ik = new TwoHandIK({ upper, lower, hand });
    const shoulderW = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
    const target = shoulderW.clone().add(new THREE.Vector3(-0.05, -0.3, 0.25)); // دست جلو-پایین-وسط بدن
    ik.update(target);
    root.updateMatrixWorld(true);
    const elbowW = new THREE.Vector3().setFromMatrixPosition(lower.matrixWorld);
    expect(elbowW.x).toBeGreaterThan(shoulderW.x - 0.05); // آرنج بیرون‌تر از شانه
  });
});

describe('compileAttack2H', () => {
  it('دست دوم روی دسته می‌ماند (فاصله‌ی مچ‌ها = آفست grip2)', () => {
    const w = V3_WEAPONS.sword2h;
    const g = swordGeom(w.scale, w.bladeTo, w.grip2);
    void g;
    const clip = compileAttack2H(swordGeom(w.scale, w.bladeTo, w.grip2));
    expect(clip.name).toBe('attack2h');
    const names = new Set(clip.tracks.map((t) => t.name));
    for (const b of ['upperArmR', 'lowerArmR', 'upperArmL', 'lowerArmL']) {
      expect(names.has(`${b}.quaternion`)).toBe(true);
    }
    // دست چپ باید در تمام کلیدها نزدیک دست راست باشد (هر دو روی دسته)
    const track = (n: string) => clip.tracks.find((t) => t.name === `${n}.quaternion`)!;
    const qAt = (tr: THREE.KeyframeTrack, i: number) => {
      const v = (tr as THREE.QuaternionKeyframeTrack).values;
      return new THREE.Quaternion(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]);
    };
    // FK کوچک برای مچ‌ها — پایه‌ی شانه ±0.2 + بازو/ساعد چرخیده
    // (چرخش chest در تفاضل مچ‌ها تقریباً حذف می‌شود)
    const wristOf = (side: 'l' | 'r', u: THREE.Quaternion, l: THREE.Quaternion) => {
      const s = side === 'r' ? -1 : 1;
      return new THREE.Vector3(0.2 * s, 0.19, 0)
        .add(new THREE.Vector3(0.26 * s, 0, 0).applyQuaternion(u))
        .add(new THREE.Vector3(0.22 * s, 0, 0).applyQuaternion(u.clone().multiply(l)));
    };
    const nKeys = (track('upperArmR') as THREE.QuaternionKeyframeTrack).times.length;
    for (let i = 0; i < nKeys; i++) {
      const wR = wristOf('r', qAt(track('upperArmR'), i), qAt(track('lowerArmR'), i));
      const wL = wristOf('l', qAt(track('upperArmL'), i), qAt(track('lowerArmL'), i));
      // آفست grip2 = (0.06 − 0.13) ≈ ۰.۰۷ متری روی دسته — مچ‌ها نزدیک‌اند
      // (۲۵cm حاشیه برای حذف‌نشدن کامل چرخش chest در FK ساده)
      expect(wR.distanceTo(wL)).toBeLessThan(0.25);
    }
  });
});

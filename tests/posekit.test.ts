// آزمون posekit — صحت IK/FK و قیود قوس حمله
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  compileArmPoses, solveArmIK, attack1HTipArc, compileAttack1H,
  ARC_1H, ARC_1H_L, TORSO_1H, HIPS_POS_1H,
  SHOULDER_R, SHOULDER_L, L_UPPER, L_LOWER,
} from '../src/lib/animation/posekit';
import { BONE_LOCAL } from '../src/lib/character/skeleton';

const D = Math.PI / 180;

// ── FK کامل اسکلت canonical — پیاده‌سازی مستقل از کد تولید ──
function fkSkeleton(
  quats: Record<string, THREE.Quaternion>,
  hipsD: [number, number, number] = [0, 0, 0],
): Record<string, { pos: THREE.Vector3; q: THREE.Quaternion }> {
  const out: Record<string, { pos: THREE.Vector3; q: THREE.Quaternion }> = {};
  for (const b of ['hips', 'spine', 'chest', 'neck', 'head',
    'upperArmL', 'lowerArmL', 'handL', 'upperArmR', 'lowerArmR', 'handR',
    'upperLegL', 'lowerLegL', 'footL', 'upperLegR', 'lowerLegR', 'footR'] as const) {
    const p = { hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
      upperArmL: 'chest', lowerArmL: 'upperArmL', handL: 'lowerArmL',
      upperArmR: 'chest', lowerArmR: 'upperArmR', handR: 'lowerArmR',
      upperLegL: 'hips', lowerLegL: 'upperLegL', footL: 'lowerLegL',
      upperLegR: 'hips', lowerLegR: 'upperLegR', footR: 'lowerLegR' }[b] as string | null;
    const lpos = new THREE.Vector3(...BONE_LOCAL[b]);
    if (!p) {
      out[b] = {
        pos: lpos.add(new THREE.Vector3(...hipsD)),
        q: quats[b] ?? new THREE.Quaternion(),
      };
    } else {
      const parent = out[p as keyof typeof out];
      out[b] = {
        pos: parent.pos.clone().add(lpos.clone().applyQuaternion(parent.q)),
        q: parent.q.clone().multiply(quats[b] ?? new THREE.Quaternion()),
      };
    }
  }
  return out;
}

describe('solveArmIK', () => {
  it('مچ را به هدف می‌رساند (داخل برد)', () => {
    const target = new THREE.Vector3(-0.35, 1.25, 0.3);
    const pose = solveArmIK(SHOULDER_R.clone(), target, new THREE.Quaternion(), 'r');
    const wrist = SHOULDER_R.clone()
      .add(new THREE.Vector3(...BONE_LOCAL.lowerArmR).applyQuaternion(pose.upper))
      .add(new THREE.Vector3(...BONE_LOCAL.handR).applyQuaternion(
        pose.upper.clone().multiply(pose.lower),
      ));
    expect(wrist.distanceTo(target)).toBeLessThan(1e-3);
  });

  it('خارج از برد: به بیشینه محدود می‌شود و بازو صاف می‌ماند', () => {
    const target = new THREE.Vector3(-1.2, 2.5, 0);
    const pose = solveArmIK(SHOULDER_R.clone(), target, new THREE.Quaternion(), 'r');
    const wrist = SHOULDER_R.clone()
      .add(new THREE.Vector3(...BONE_LOCAL.lowerArmR).applyQuaternion(pose.upper))
      .add(new THREE.Vector3(...BONE_LOCAL.handR).applyQuaternion(
        pose.upper.clone().multiply(pose.lower),
      ));
    expect(wrist.distanceTo(SHOULDER_R)).toBeCloseTo(L_UPPER + L_LOWER, 2);
  });

  it('آرنج سمت pole می‌خزد (پایین-عقب برای راست)', () => {
    const target = new THREE.Vector3(-0.5, 1.3, 0.25);
    const pose = solveArmIK(SHOULDER_R.clone(), target, new THREE.Quaternion(), 'r');
    expect(pose.elbow.y).toBeLessThan(SHOULDER_R.y);
  });

  it('بازوی چپ قرینه رفتار می‌کند', () => {
    const target = new THREE.Vector3(0.4, 1.25, 0.2);
    const pose = solveArmIK(SHOULDER_L.clone(), target, new THREE.Quaternion(), 'l');
    expect(pose.elbow.y).toBeLessThan(SHOULDER_L.y);
    expect(pose.elbow.x).toBeGreaterThan(0);
  });
});

describe('compileAttack1H — قوس نوک تیغه', () => {
  it('FK کامل اسکلت: مچ به هدف قوس می‌رسد', () => {
    const pose = compileArmPoses(ARC_1H, ARC_1H_L, TORSO_1H, HIPS_POS_1H);
    for (let i = 0; i < ARC_1H.length; i++) {
      const degQ = (f: [number, number, number]) =>
        new THREE.Quaternion().setFromEuler(new THREE.Euler(f[0] * D, f[1] * D, f[2] * D, 'XYZ'));
      const skel = fkSkeleton(
        {
          hips: degQ(TORSO_1H[i].hips),
          spine: degQ(TORSO_1H[i].spine),
          chest: degQ(TORSO_1H[i].chest),
          upperArmR: pose.upR[i], lowerArmR: pose.loR[i],
        },
        HIPS_POS_1H[i],
      );
      const wrist = skel.handR!.pos;
      expect(wrist.distanceTo(new THREE.Vector3(...ARC_1H[i].w))).toBeLessThan(0.012);
    }
  });

  it('سرعت نوک تیغه فازبندی درست دارد: کولس کند، ضربه تند، بازیابی ملایم', () => {
    const arc = attack1HTipArc();
    // فاز کولس (کلید ۰→۲): آماده‌سازی باید خوانا/کند باشد
    const windup = arc[2].tip.distanceTo(arc[0].tip) / (arc[2].t - arc[0].t);
    expect(windup).toBeLessThan(7);
    // فاز ضربه (کلید ۲→۴): برش تند اما ≤ برش واقعی شمشیر
    const strike = arc[4].tip.distanceTo(arc[2].tip) / (arc[4].t - arc[2].t);
    expect(strike).toBeGreaterThan(6);
    expect(strike).toBeLessThan(17);
    // بازیابی (کلید ۴→۷): کنترل‌شده
    const recover = arc[7].tip.distanceTo(arc[4].tip) / (arc[7].t - arc[4].t);
    expect(recover).toBeLessThan(7);
  });

  it('قوس: کولس بالا، ضربه جلو-پایین، بدون ماندن تیغه داخل بدن', () => {
    const arc = attack1HTipArc();
    expect(arc[2].tip.y).toBeGreaterThan(2.0);            // اوج کولس
    expect(arc[4].tip.z).toBeGreaterThan(0.9);            // نوک جلو
    expect(arc[4].tip.y).toBeLessThan(0.9);               // نوک پایین
    for (const p of arc) {
      const radial = Math.hypot(p.tip.x, p.tip.z);
      expect(radial).toBeGreaterThan(0.25);               // دور از محور بدن
    }
  });

  it('کلیپ خروجی ترک‌های کامل دارد و حلقه می‌بندد', () => {
    const clip = compileAttack1H();
    const names = new Set(clip.tracks.map((t) => t.name));
    for (const b of ['upperArmR', 'lowerArmR', 'upperArmL', 'lowerArmL', 'hips', 'chest']) {
      expect(names.has(`${b}.quaternion`)).toBe(true);
    }
    expect(names.has('hips.position')).toBe(true);
    const hips = clip.tracks.find((t) => t.name === 'hips.position')!;
    const first = Array.from(hips.values).slice(0, 3);
    const lastV = Array.from(hips.values).slice(-3);
    expect(first).toEqual(lastV);
  });
});

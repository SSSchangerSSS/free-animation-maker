// A03 — آزمون نگاشت استخوان‌ها: شانه نباید جای بازو و root نباید
// جای لگن بنشیند؛ نتیجه مستقل از ترتیب پیمایش باشد.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { detectHumanoidBones, normName } from '../src/lib/animation/retarget';

function bone(name: string, parent?: THREE.Object3D): THREE.Bone {
  const b = new THREE.Bone();
  b.name = name;
  parent?.add(b);
  return b;
}

/** درخت Mixamo-وار — ترتیب ساخت فرزندان shoulder→arm یا arm→shoulder */
function buildMixamoLike(shoulderFirst: boolean): { root: THREE.Group; armName: string } {
  const root = new THREE.Group();
  const hips = bone('Hips', root);
  bone('Spine', hips);
  const chest = bone('Chest', hips);
  const armParent: THREE.Object3D = chest;
  if (shoulderFirst) {
    const shoulder = bone('LeftShoulder', armParent);
    const arm = bone('LeftArm', shoulder);
    bone('LeftForeArm', arm);
    bone('LeftHand', arm);
  } else {
    // بازو مستقیماً زیر chest ساخته می‌شود و شانه بعداً به chest اضافه می‌شود
    const arm = bone('LeftArm', armParent);
    bone('LeftForeArm', arm);
    bone('LeftHand', arm);
    const shoulder = bone('LeftShoulder', armParent);
    // در این سناریو پدر واقعی بازو شانه است — ساختار را اصلاح می‌کنیم
    shoulder.add(arm);
  }
  bone('RightShoulder', chest);
  bone('RightArm', chest);
  return { root, armName: 'LeftArm' };
}

describe('detectHumanoidBones — A03', () => {
  it('LeftArm را برای upperArmL انتخاب می‌کند نه LeftShoulder', () => {
    const { root } = buildMixamoLike(true);
    const m = detectHumanoidBones(root);
    expect(m.target.upperArmL?.name).toBe('LeftArm');
    expect(m.missing).not.toContain('upperArmL');
  });

  it('نتیجه مستقل از ترتیب ساخت درخت است', () => {
    const a = detectHumanoidBones(buildMixamoLike(true).root);
    const b = detectHumanoidBones(buildMixamoLike(false).root);
    expect(a.target.upperArmL?.name).toBe(b.target.upperArmL?.name);
  });

  it('pelvis بر root مقدم است برای canonical hips', () => {
    const root = new THREE.Group();
    const rootBone = bone('Root', root); // با چرخش ‎−90°X‎ مثل UAL
    rootBone.rotation.x = -Math.PI / 2;
    const pelvis = bone('Pelvis', rootBone);
    bone('Spine', pelvis);
    const legL = bone('LeftUpLeg', pelvis);
    bone('LeftLeg', legL);
    const legR = bone('RightUpLeg', pelvis);
    bone('RightLeg', legR);
    const m = detectHumanoidBones(root);
    expect(m.target.hips?.name).toBe('Pelvis');
  });

  it('ریگ با نام root تنها، hips را همان می‌گیرد (بدون رقیب)', () => {
    const root = new THREE.Group();
    const rootBone = bone('Root', root);
    bone('Spine', rootBone);
    const legL = bone('LeftUpLeg', rootBone);
    bone('LeftLeg', legL);
    const legR = bone('RightUpLeg', rootBone);
    bone('RightLeg', legR);
    const m = detectHumanoidBones(root);
    expect(m.target.hips?.name).toBe('Root');
  });

  it('نام‌های mixamorig و پسوندهای Rigify پاک‌سازی می‌شوند', () => {
    expect(normName('mixamorig:LeftArm')).toBe('leftarm');
    expect(normName('DEF-upper_arm.L')).toBe('upperarml');
  });
});

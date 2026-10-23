// A04 — آزمون پذیرش ریتارگت با rest واقعی:
//  ۱) پوز مرجع مبدأ باید دلتای صفر بدهد (rest پوز مقصد دست‌نخورده می‌ماند)
//  ۲) دلتای چرخش جهانی باید با حضور استخوان واسط چرخیده (کلویکل)
//     و ریشه‌ی چرخیده (root ‎−90°X‎) دقیقاً منتقل شود
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  detectHumanoidBones, measureRest, measureSourceRest, retargetClipFromRest,
} from '../src/lib/animation/retarget';

function bone(name: string, parent?: THREE.Object3D): THREE.Bone {
  const b = new THREE.Bone();
  b.name = name;
  parent?.add(b);
  return b;
}

/** مبدأ: ریگ UAL-مانند با root چرخیده و shoulder واسط چرخیده */
function buildSourceRig(): { root: THREE.Group; arm: THREE.Bone } {
  const root = new THREE.Group();
  const rootB = bone('Root', root);
  rootB.rotation.x = -Math.PI / 2; // مثل UAL
  const hips = bone('Hips', rootB);
  hips.position.set(0, 0.98, 0);
  const spine = bone('Spine', hips);
  spine.position.set(0, 0.14, 0);
  const chest = bone('Chest', spine);
  chest.position.set(0, 0.16, 0);
  const shoulder = bone('LeftShoulder', chest);
  shoulder.position.set(0.05, 0.19, 0);
  shoulder.rotation.set(0.3, 0.2, -0.1);
  const arm = bone('LeftArm', shoulder);
  arm.position.set(0.15, 0, 0);
  arm.rotation.set(0.5, 0, -1.2); // A-pose
  const fore = bone('LeftForeArm', arm);
  fore.position.set(0.26, 0, 0);
  bone('LeftHand', fore).position.set(0.22, 0, 0);
  const leg = bone('LeftUpLeg', hips);
  leg.position.set(0.11, -0.04, 0);
  const shin = bone('LeftLeg', leg);
  shin.position.set(0, -0.44, 0);
  bone('LeftFoot', shin).position.set(0, -0.41, 0.02);
  const shoulderR = bone('RightShoulder', chest);
  shoulderR.position.set(-0.05, 0.19, 0);
  shoulderR.rotation.set(0.3, -0.2, 0.1);
  const armR = bone('RightArm', shoulderR);
  armR.position.set(-0.15, 0, 0);
  armR.rotation.set(0.5, 0, 1.2);
  const foreR = bone('RightForeArm', armR);
  foreR.position.set(-0.26, 0, 0);
  bone('RightHand', foreR).position.set(-0.22, 0, 0);
  const legR = bone('RightUpLeg', hips);
  legR.position.set(-0.11, -0.04, 0);
  const shinR = bone('RightLeg', legR);
  shinR.position.set(0, -0.44, 0);
  bone('RightFoot', shinR).position.set(0, -0.41, 0.02);
  return { root, arm };
}

/** مقصد: ریگ canonical با کلویکلِ واسطِ چرخیده (نگاشت نمی‌شود) */
function buildTargetRig(): { root: THREE.Group; bindLocal: Record<string, THREE.Quaternion> } {
  const root = new THREE.Group();
  const hips = bone('hips', root);
  hips.position.set(0, 0.98, 0);
  const spine = bone('spine', hips);
  spine.position.set(0, 0.14, 0);
  spine.rotation.set(0.05, -0.03, 0.02);
  const chest = bone('chest', spine);
  chest.position.set(0, 0.16, 0);
  chest.rotation.set(0.08, 0.05, -0.04);
  const clav = bone('clavicleL', chest); // واسط نگاشت‌نشده با چرخش
  clav.position.set(0.06, 0.18, 0);
  clav.rotation.set(0.35, 0.2, -0.15);
  const ua = bone('upperArmL', clav);
  ua.position.set(0.14, 0, 0);
  const la = bone('lowerArmL', ua);
  la.position.set(0.26, 0, 0);
  la.rotation.set(0, 0.3, 0);
  bone('handL', la).position.set(0.22, 0, 0);
  const leg = bone('upperLegL', hips);
  leg.position.set(0.11, -0.04, 0);
  leg.rotation.set(0.06, 0, 0.03);
  const shin = bone('lowerLegL', leg);
  shin.position.set(0, -0.44, 0);
  bone('footL', shin).position.set(0, -0.41, 0.02);

  const bindLocal: Record<string, THREE.Quaternion> = {};
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bindLocal[o.name] = (o as THREE.Bone).quaternion.clone();
  });
  return { root, bindLocal };
}

function worldQuatOf(o: THREE.Object3D): THREE.Quaternion {
  const q = new THREE.Quaternion();
  o.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
  return q;
}

describe('retargetClipFromRest — A04', () => {
  it('در پوز مرجع، دلتا صفر است (rest مقصد دقیقاً حفظ می‌شود)', () => {
    const src = buildSourceRig();
    src.root.updateMatrixWorld(true);
    const srcRest = measureSourceRest(src.root, 'Hips');

    const tgt = buildTargetRig();
    tgt.root.updateMatrixWorld(true);
    const mapping = detectHumanoidBones(tgt.root);
    // A03 در عمل: upperArmL باید خود استخوان باشد نه کلویکل
    expect(mapping.target.upperArmL?.name).toBe('upperArmL');
    const rest = measureRest(tgt.root, mapping);

    const clip = new THREE.AnimationClip('rest', 1, [
      new THREE.QuaternionKeyframeTrack('LeftArm.quaternion', [0, 1],
        [src.arm.quaternion.x, src.arm.quaternion.y, src.arm.quaternion.z, src.arm.quaternion.w,
          src.arm.quaternion.x, src.arm.quaternion.y, src.arm.quaternion.z, src.arm.quaternion.w]),
    ]);
    const retargeted = retargetClipFromRest(clip, srcRest, mapping, rest);

    const mixer = new THREE.AnimationMixer(tgt.root);
    const action = mixer.clipAction(retargeted);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.update(0);
    tgt.root.updateMatrixWorld(true);

    for (const [canon] of Object.entries(mapping.target)) {
      const b = mapping.target[canon];
      const got = b.quaternion;
      const want = tgt.bindLocal[b.name];
      const angle = Math.abs(got.angleTo(want));
      // آستانه = نویز float32 ذخیره‌سازی track (≈0.05°)
      expect(angle, `rest drift در ${b.name}: ${angle} rad`).toBeLessThan(2e-3);
    }
  });

  it('دلتای چرخش جهانی با استخوان واسط و root چرخیده دقیقاً منتقل می‌شود', () => {
    const src = buildSourceRig();
    src.root.updateMatrixWorld(true);
    const srcRest = measureSourceRest(src.root, 'Hips');
    const srcRestWorld = worldQuatOf(src.arm);

    const tgt = buildTargetRig();
    tgt.root.updateMatrixWorld(true);
    const mapping = detectHumanoidBones(tgt.root);
    const rest = measureRest(tgt.root, mapping);
    const tgtRestWorld = worldQuatOf(mapping.target.upperArmL);

    // انیمیشن: بازو ۳۰° حول X محلی می‌چرخد
    const restLocal = src.arm.quaternion.clone();
    const q30 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 6, 0, 0));
    const animatedLocal = q30.clone().multiply(restLocal);
    const clip = new THREE.AnimationClip('delta', 1, [
      new THREE.QuaternionKeyframeTrack('LeftArm.quaternion', [0, 1], [
        restLocal.x, restLocal.y, restLocal.z, restLocal.w,
        animatedLocal.x, animatedLocal.y, animatedLocal.z, animatedLocal.w,
      ]),
    ]);
    const retargeted = retargetClipFromRest(clip, srcRest, mapping, rest);

    // مبدأ در فریم انیمیشن — دلتای جهانی مرجع
    src.arm.quaternion.copy(animatedLocal);
    src.root.updateMatrixWorld(true);
    const srcWorldT = worldQuatOf(src.arm);
    const delta = srcWorldT.clone().multiply(srcRestWorld.clone().invert());
    const expectedWorld = delta.multiply(tgtRestWorld);

    const mixer = new THREE.AnimationMixer(tgt.root);
    const action = mixer.clipAction(retargeted);
    // ⚠️ setTime(duration) روی مرز حلقه به فریم ۰ برمی‌گردد —
    // LoopOnce + clamp فریم آخر را دقیق می‌دهد
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.update(1);
    tgt.root.updateMatrixWorld(true);
    const gotWorld = worldQuatOf(mapping.target.upperArmL);

    const angle = gotWorld.angleTo(expectedWorld);
    expect(angle, `دلتای منتقل‌شده نادرست: ${angle} rad`).toBeLessThan(1e-4);
  });
});

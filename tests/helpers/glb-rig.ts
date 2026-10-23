// ─────────────────────────────────────────────────────────────
// هارنس QA هدلس — لود GLB بدنه‌های KayKit به سلسله‌مراتب three.js
// در Node (بدون مرورگر/WebGL) برای آزمون هندسی واقعی:
//   • پخش کلیپ‌های واقعی روی اسکلت واقعی (کیفیت منبع، بدون خطای
//     ریتارگت) با AnimationMixer (ریاضی خالص)
//   • محاسبهٔ حجم‌های بدن از رئوس اسکین‌شدهٔ rest
//   • پروفایل برخورد سلاح از هندسهٔ واقعی سلاح
// همان ماژول‌های ران‌تایم برنامه استفاده می‌شوند — نه شبیه‌سازی جدا.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import type { Document, Node as GNode, AnimationChannel } from '@gltf-transform/core';
import type { WeaponProfile } from '../../src/lib/animation/weapon-profiles';
import { extractWeaponProfile } from '../../src/lib/animation/weapon-profiles';
import type { BodyVolumeSet } from '../../src/lib/character/body-volumes';
import { computeBodyVolumes, GUARD_BONES } from '../../src/lib/character/body-volumes';
import { detectHumanoidBones } from '../../src/lib/animation/retarget';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

function readAccessorVec(a: { getCount(): number; getElement(i: number, t: number[]): void }, count: number, size: number): Float32Array {
  const out = new Float32Array(count * size);
  const tmp: number[] = [];
  for (let i = 0; i < count; i++) {
    a.getElement(i, tmp);
    for (let k = 0; k < size; k++) out[i * size + k] = tmp[k] ?? 0;
  }
  return out;
}

export interface LoadedRig {
  root: THREE.Group;
  /** نود سلاح بر اساس نام (مثل 1H_Sword) */
  weaponNodes: Record<string, THREE.Object3D>;
  handSlots: { l: THREE.Bone | null; r: THREE.Bone | null };
  profiles: Record<string, WeaponProfile>;
  volumes: BodyVolumeSet;
  clips: Record<string, THREE.AnimationClip>;
  /** canonical → Bone (detectHumanoidBones روی همین ریگ) */
  canon: Record<string, THREE.Bone>;
}

/** درخت glTF → Object3D/Bone/SkinnedMesh با نام و TRS دقیق */
function buildHierarchy(doc: Document): { root: THREE.Group; byName: Map<string, THREE.Object3D> } {
  const groot = doc.getRoot();
  const byName = new Map<string, THREE.Object3D>();
  const allJoints = new Set<GNode>();
  for (const skin of groot.listSkins()) for (const j of skin.listJoints()) allJoints.add(j);

  const objOf = (gn: GNode): THREE.Object3D => {
    const name = gn.getName() || `node_${byName.size}`;
    const o: THREE.Object3D = gn.getMesh() && !allJoints.has(gn) ? new THREE.Mesh() : new THREE.Bone();
    o.name = name;
    const t = gn.getTranslation(); const r = gn.getRotation(); const s = gn.getScale();
    o.position.set(t[0], t[1], t[2]);
    o.quaternion.set(r[0], r[1], r[2], r[3]);
    o.scale.set(s[0], s[1], s[2]);
    byName.set(name, o);
    for (const ch of gn.listChildren()) o.add(objOf(ch));
    return o;
  };

  const sceneRoot = new THREE.Group();
  sceneRoot.name = '__rigRoot__';
  for (const scn of groot.listScenes()) for (const n of scn.listChildren()) sceneRoot.add(objOf(n));
  return { root: sceneRoot, byName };
}

/** مش‌های اسکین‌شده: هندسه + اسکلت (IBM) — نود مش با SkinnedMesh جایگزین می‌شود */
function attachSkinnedMeshes(doc: Document, byName: Map<string, THREE.Object3D>) {
  for (const gn of doc.getRoot().listNodes()) {
    const mesh = gn.getMesh();
    if (!mesh) continue;
    const o = byName.get(gn.getName() || '');
    if (!o || !(o as THREE.Mesh).isMesh) continue;

    const prim = mesh.listPrimitives()[0];
    if (!prim) continue;
    const posAttr = prim.getAttribute('POSITION');
    const jntAttr = prim.getAttribute('JOINTS_0');
    const wgtAttr = prim.getAttribute('WEIGHTS_0');
    if (!posAttr) continue;

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(readAccessorVec(posAttr, posAttr.getCount(), 3), 3));
    geom.computeBoundingBox();
    if (jntAttr && wgtAttr) {
      // مش اسکین‌شدهٔ بدنه
      geom.setAttribute('skinIndex', new THREE.BufferAttribute(readAccessorVec(jntAttr, jntAttr.getCount(), 4), 4));
      geom.setAttribute('skinWeight', new THREE.BufferAttribute(readAccessorVec(wgtAttr, wgtAttr.getCount(), 4), 4));
    }

    const sm = new THREE.SkinnedMesh(geom);
    const skin = gn.getSkin();
    if (skin) {
      const joints = skin.listJoints().map((j) => byName.get(j.getName() || '') as THREE.Bone);
      const ibmAcc = skin.getInverseBindMatrices()!;
      const flat = readAccessorVec(ibmAcc, ibmAcc.getCount(), 16);
      const boneInverses: THREE.Matrix4[] = [];
      for (let i = 0; i < ibmAcc.getCount(); i++) {
        const m = new THREE.Matrix4();
        m.fromArray(Array.from(flat.slice(i * 16, i * 16 + 16)));
        boneInverses.push(m);
      }
      sm.skeleton = new THREE.Skeleton(joints, boneInverses);
      sm.bindMatrix.identity();
      sm.bindMatrixInverse.identity();
    }
    // جایگزینی نود مش با SkinnedMesh — TRS/والد/فرزندان حفظ می‌شوند
    sm.position.copy(o.position);
    sm.quaternion.copy(o.quaternion);
    sm.scale.copy(o.scale);
    sm.name = o.name;
    const parent = o.parent; const children = [...o.children];
    if (parent) parent.remove(o);
    for (const c of children) sm.add(c);
    if (parent) parent.add(sm);
    byName.set(o.name, sm);
  }
}

/** انیمیشن‌های glTF → AnimationClip (track بر اساس نام نود) */
function convertAnimations(doc: Document, byName: Map<string, THREE.Object3D>): Record<string, THREE.AnimationClip> {
  const clips: Record<string, THREE.AnimationClip> = {};
  for (const anim of doc.getRoot().listAnimations()) {
    const tracks: THREE.KeyframeTrack[] = [];
    let maxT = 0;
    for (const ch of anim.listChannels()) {
      const sampler = ch.getSampler()!;
      const target = ch.getTargetNode()!;
      const path = ch.getTargetPath() as AnimationChannel.TargetPath;
      const obj = byName.get(target.getName() || '');
      if (!obj) continue;
      const timeAcc = sampler.getInput()!;
      const valAcc = sampler.getOutput()!;
      const times = Array.from(readAccessorVec(timeAcc, timeAcc.getCount(), 1));
      const interp = sampler.getInterpolation();
      if (interp === 'CUBICSPLINE') continue; // KayKit ندارد
      const mode = interp === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear;
      if (path === 'rotation') {
        const vals = Array.from(readAccessorVec(valAcc, valAcc.getCount(), 4));
        tracks.push(new THREE.QuaternionKeyframeTrack(`${obj.name}.quaternion`, times, vals, mode));
      } else {
        const vals = Array.from(readAccessorVec(valAcc, valAcc.getCount(), 3));
        tracks.push(new THREE.VectorKeyframeTrack(`${obj.name}.${path === 'translation' ? 'position' : 'scale'}`, times, vals, mode));
      }
      maxT = Math.max(maxT, times[times.length - 1] ?? 0);
    }
    if (tracks.length) clips[anim.getName()] = new THREE.AnimationClip(anim.getName(), maxT, tracks);
  }
  return clips;
}

export async function loadRig(glbPath: string): Promise<LoadedRig> {
  const doc = await io.read(glbPath);
  const { root, byName } = buildHierarchy(doc);
  attachSkinnedMeshes(doc, byName);
  const clips = convertAnimations(doc, byName);
  root.updateMatrixWorld(true);

  const mapping = detectHumanoidBones(root);
  const canon = mapping.target;
  // نگاشت معکوس: نام استخوان واقعی → canonical
  const canonOf = (boneName: string): string | null => {
    for (const [c, b] of Object.entries(canon)) if (b.name === boneName) return c;
    return null;
  };

  // نودهای سلاح + پروفایل‌ها (هندسهٔ محلی واقعی)
  const weaponNodes: Record<string, THREE.Object3D> = {};
  const profiles: Record<string, WeaponProfile> = {};
  const weaponNames = ['1H_Sword', '2H_Sword', '1H_Axe', '2H_Axe', 'Knife', 'Knife_Offhand'];
  byName.forEach((o, name) => {
    if (!weaponNames.includes(name)) return;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.getAttribute('position')) return;
    weaponNodes[name] = o;
    profiles[name] = extractWeaponProfile(name, mesh.geometry);
  });

  const handSlots = {
    l: (byName.get('handslot.l') as THREE.Bone) ?? null,
    r: (byName.get('handslot.r') as THREE.Bone) ?? null,
  };

  // حجم‌های بدن از رئوس اسکین‌شدهٔ rest (ریگ در bind)
  const volumes = computeBodyVolumes(root, canonOf);

  return { root, weaponNodes, handSlots, profiles, volumes, clips, canon };
}

/** فقط استخوان‌های اولویت‌دار (GUARD_BONES) — حجم سبک‌تر و سریع‌تر */
export function filterVolumes(v: BodyVolumeSet): BodyVolumeSet {
  const byCanon: BodyVolumeSet['byCanon'] = {};
  for (const b of GUARD_BONES) if (v.byCanon[b]) byCanon[b] = v.byCanon[b];
  return { byCanon, samples: v.samples };
}

export { extractWeaponProfile };

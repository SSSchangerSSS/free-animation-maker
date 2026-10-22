// ─────────────────────────────────────────────────────────────
// Import مدل GLB استاندارد + Retarget انیمیشن‌ها
//
// استاندارد ورود مدل:
//   • فرمت GLB / GLTF با SkinnedMesh و اسکلت هیومنوید
//   • حالت T-Pose (پوز مرجع) — پوز A با اصلاح خودکار هم پشتیبانی می‌شود
//   • اسکلت سازگار Mixamo / Blender / Unity (تشخیص خودکار نام استخوان‌ها)
//
// روش ریتارگت: دلتای چرخش جهانی (world-space delta)
//   Δ_bone(t) = Q_source_world(t) · Q_source_world_rest⁻¹
//   Q_target_world(t) = Δ_bone(t) · Q_target_world_rest
//   Q_target_local(t) = Q_parent_world(t)⁻¹ · Q_target_world(t)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BONE_ORDER, BONE_PARENT, BONE_DEPTH } from '../character/skeleton';
import { ANIM_DEFS, buildClipLibrary } from './clips';

// ── پاک‌سازی نام‌ها (mixamorig:LeftArm → LeftArm) ────────────
function sanitizeName(name: string): string {
  return name.replace(/mixamorig[:_]?/gi, '').replace(/[:\s]/g, '_') || name;
}

function renameInScene(root: THREE.Object3D): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  root.traverse((o) => {
    const old = o.name;
    let n = sanitizeName(old);
    let i = 2;
    while (used.has(n) && n !== old) { n = `${n}_${i++}`; }
    // اگر خود نام قبلا استفاده شده ولی همان آبجکت است، مجاز است
    if (used.has(n) && n === old) { n = `${old}_${i++}`; }
    used.add(n);
    o.name = n;
    if (n !== old) map.set(old, n);
  });
  return map;
}

function renameTracks(clips: THREE.AnimationClip[], map: Map<string, string>) {
  for (const clip of clips) {
    for (const tr of clip.tracks) {
      const dot = tr.name.indexOf('.');
      if (dot < 0) continue;
      const node = tr.name.slice(0, dot);
      const rest = tr.name.slice(dot);
      const nn = map.get(node);
      if (nn) tr.name = `${nn}${rest}`;
    }
  }
}

// ── تشخیص استخوان‌های هیومنوید ───────────────────────────────
function matchCanonical(rawNorm: string): string | null {
  const s = rawNorm.replace(/^mixamorig/, '');
  const simple: Record<string, string> = {
    hips: 'hips', pelvis: 'hips', hip: 'hips', root: 'hips',
    spine: 'spine', spine1: 'chest', spine2: 'chest', chest: 'chest', upperchest: 'chest',
    neck: 'neck', head: 'head',
  };
  if (simple[s]) return simple[s];

  let side: 'L' | 'R' | null = null;
  let part = '';
  for (const [pre, sd] of [['left', 'L'], ['right', 'R']] as const) {
    if (s.startsWith(pre)) { side = sd as 'L' | 'R'; part = s.slice(pre.length); break; }
  }
  if (!side) {
    for (const [suf, sd] of [['l', 'L'], ['r', 'R']] as const) {
      if (s.length > 1 && s.endsWith(suf)) { side = sd as 'L' | 'R'; part = s.slice(0, -1); break; }
    }
  }
  if (!side) return null;

  const map: Record<string, string> = {
    arm: 'upperArm', upperarm: 'upperArm', uparm: 'upperArm',
    forearm: 'lowerArm', lowerarm: 'lowerArm', elbow: 'lowerArm',
    hand: 'hand',
    upleg: 'upperLeg', upperleg: 'upperLeg', thigh: 'upperLeg', legupper: 'upperLeg',
    leg: 'lowerLeg', lowerleg: 'lowerLeg', shin: 'lowerLeg', calf: 'lowerLeg', leglower: 'lowerLeg',
    foot: 'foot',
  };
  const c = map[part];
  return c ? `${c}${side}` : null;
}

export interface BoneMapping {
  /** canonical → Bone در مدل واردشده */
  target: Record<string, THREE.Bone>;
  found: string[];
  missing: string[];
  boneCount: number;
}

export function detectHumanoidBones(root: THREE.Object3D): BoneMapping {
  const target: Record<string, THREE.Bone> = {};
  let boneCount = 0;
  root.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    boneCount++;
    // ارقام حفظ می‌شوند تا Spine1 با Spine اشتباه نشود
    const norm = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const canon = matchCanonical(norm);
    if (canon && !target[canon]) target[canon] = o as THREE.Bone;
  });
  const found = Object.keys(target);
  const missing = BONE_ORDER.filter((b) => !target[b]);
  return { target, found, missing, boneCount };
}

// ── اندازه‌گیری پوز مرجع + اصلاح خودکار A-Pose ───────────────
export interface TargetRest {
  /** canonical → چرخش جهانی استخوان در پوز مرجع (با اصلاح T-Pose) */
  worldQuat: Record<string, THREE.Quaternion>;
  /** نزدیک‌ترین والد نگاشت‌شده (برای FK) */
  parentCanon: Record<string, string | null>;
  hipsLocalRest: THREE.Vector3;
  hipsWorldY: number;
}

export function measureRest(root: THREE.Object3D, mapping: BoneMapping): TargetRest {
  root.updateMatrixWorld(true);
  const worldQuat: Record<string, THREE.Quaternion> = {};
  const worldPos: Record<string, THREE.Vector3> = {};
  for (const [canon, bone] of Object.entries(mapping.target)) {
    const q = new THREE.Quaternion();
    bone.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    worldQuat[canon] = q;
    const p = new THREE.Vector3();
    bone.getWorldPosition(p);
    worldPos[canon] = p;
  }

  // اصلاح A-Pose → T-Pose برای بازوها (اگر بازوها آویزان باشند)
  for (const side of ['L', 'R'] as const) {
    const ua = `upperArm${side}`, la = `lowerArm${side}`;
    if (!worldPos[ua] || !worldPos[la]) continue;
    const d = worldPos[la].clone().sub(worldPos[ua]).normalize();
    if (d.y < -0.12) {
      const h = new THREE.Vector3(d.x, 0, d.z);
      if (h.lengthSq() < 1e-6) h.set(side === 'L' ? 1 : -1, 0, 0);
      h.normalize();
      const C = new THREE.Quaternion().setFromUnitVectors(d, h);
      for (const b of [ua, la, `hand${side}`]) {
        if (worldQuat[b]) worldQuat[b].premultiply(C);
      }
    }
  }

  // والد نگاشت‌شده‌ی نزدیک
  const parentCanon: Record<string, string | null> = {};
  for (const canon of Object.keys(mapping.target)) {
    let p = BONE_PARENT[canon as keyof typeof BONE_PARENT] ?? null;
    while (p && !mapping.target[p]) p = BONE_PARENT[p as keyof typeof BONE_PARENT] ?? null;
    parentCanon[canon] = p;
  }

  const hips = mapping.target.hips;
  const hipsLocalRest = hips ? hips.position.clone() : new THREE.Vector3(0, 1, 0);
  const hipsWorldY = worldPos.hips ? worldPos.hips.y : 1;

  return { worldQuat, parentCanon, hipsLocalRest, hipsWorldY };
}

// ── نمونه‌گیری track چهاربعدی ────────────────────────────────
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
function sampleQuat(track: THREE.QuaternionKeyframeTrack, t: number, out: THREE.Quaternion) {
  const times = track.times;
  const v = track.values as Float32Array;
  const last = times.length - 1;
  let i: number;
  if (t <= times[0]) i = 0;
  else if (t >= times[last]) i = last - 1;
  else {
    let lo = 0, hi = last;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
    i = lo;
  }
  const t0 = times[i], t1 = times[i + 1] ?? t0 + 1e-6;
  const a = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  _qa.fromArray(v, i * 4);
  _qb.fromArray(v, Math.min(i + 1, last) * 4);
  out.slerpQuaternions(_qa, _qb, a);
}

function sampleVec(track: THREE.VectorKeyframeTrack, t: number, out: THREE.Vector3) {
  const times = track.times;
  const v = track.values as Float32Array;
  const last = times.length - 1;
  let i: number;
  if (t <= times[0]) i = 0;
  else if (t >= times[last]) i = last - 1;
  else {
    let lo = 0, hi = last;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
    i = lo;
  }
  const t0 = times[i], t1 = times[i + 1] ?? t0 + 1e-6;
  const a = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  out.fromArray(v, i * 3).lerp(_tv.fromArray(v, Math.min(i + 1, last) * 3), a);
}
const _tv = new THREE.Vector3();

// ── ریتارگت یک کلیپ ──────────────────────────────────────────
export function retargetClipCustom(
  sourceClip: THREE.AnimationClip,
  mapping: BoneMapping,
  rest: TargetRest,
): THREE.AnimationClip {
  const dur = sourceClip.duration;
  const nFrames = Math.max(2, Math.ceil(dur * 30) + 1);
  const dt = dur / (nFrames - 1);

  // track های مبدأ بر اساس نام canonical
  const srcQ: Record<string, THREE.QuaternionKeyframeTrack> = {};
  let hipsTrack: THREE.VectorKeyframeTrack | null = null;
  for (const tr of sourceClip.tracks) {
    const node = tr.name.split('.')[0];
    if (tr instanceof THREE.QuaternionKeyframeTrack) srcQ[node] = tr;
    else if (node === 'hips' && tr instanceof THREE.VectorKeyframeTrack) hipsTrack = tr;
  }

  // مرتب‌سازی canonicalها بر اساس عمق (FK top-down)
  const canons = Object.keys(mapping.target).sort(
    (a, b) => (BONE_DEPTH[a as keyof typeof BONE_DEPTH] ?? 0) - (BONE_DEPTH[b as keyof typeof BONE_DEPTH] ?? 0),
  );

  const qLocal: Record<string, THREE.Quaternion> = {};
  const qSrcWorld: Record<string, THREE.Quaternion> = {};
  const qTgtWorld: Record<string, THREE.Quaternion> = {};
  for (const c of canons) {
    qLocal[c] = new THREE.Quaternion();
    qSrcWorld[c] = new THREE.Quaternion();
    qTgtWorld[c] = new THREE.Quaternion();
  }
  const sampled = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion();
  const desired = new THREE.Quaternion();
  const local = new THREE.Quaternion();
  const I = new THREE.Quaternion();

  const outTracks: THREE.KeyframeTrack[] = [];

  for (const canon of canons) {
    const bone = mapping.target[canon];
    const times = new Float32Array(nFrames);
    const values = new Float32Array(nFrames * 4);

    for (let f = 0; f < nFrames; f++) {
      const t = f * dt;
      times[f] = t;

      // 1) نمونه‌گیری چرخش محلی مبدأ
      const tr = srcQ[canon];
      if (tr) { sampleQuat(tr, t, sampled); qLocal[canon].copy(sampled); }
      else qLocal[canon].identity();

      // 2) FK سمت مبدأ — rest جهانی مبدأ identity است ⇒ Δ = جهانی
      const parentCanon = BONE_PARENT[canon as keyof typeof BONE_PARENT] as string | null;
      if (parentCanon && qSrcWorld[parentCanon]) {
        qSrcWorld[canon].copy(qSrcWorld[parentCanon]).multiply(qLocal[canon]);
      } else {
        qSrcWorld[canon].copy(qLocal[canon]);
      }

      // 3) اعمال دلتا روی rest جهانی مقصد
      desired.copy(qSrcWorld[canon]).multiply(rest.worldQuat[canon] ?? I);

      // 4) تبدیل به چرخش محلی مقصد
      const pc = rest.parentCanon[canon] ?? null;
      if (pc && qTgtWorld[pc]) parentQ.copy(qTgtWorld[pc]);
      else parentQ.identity();
      local.copy(parentQ).invert().multiply(desired);
      qTgtWorld[canon].copy(desired);

      values[f * 4] = local.x; values[f * 4 + 1] = local.y;
      values[f * 4 + 2] = local.z; values[f * 4 + 3] = local.w;
    }
    outTracks.push(new THREE.QuaternionKeyframeTrack(
      `${bone.name}.quaternion`, Array.from(times), Array.from(values),
    ));
  }

  // ── موقعیت لگن ──
  if (hipsTrack && mapping.target.hips) {
    const hipsRest = rest.hipsLocalRest.clone();
    const ratio = rest.hipsWorldY / 0.98;
    const times = new Float32Array(nFrames);
    const values = new Float32Array(nFrames * 3);
    const p = new THREE.Vector3();
    for (let f = 0; f < nFrames; f++) {
      const t = f * dt;
      times[f] = t;
      sampleVec(hipsTrack, t, p);
      values[f * 3] = hipsRest.x + p.x * ratio;
      values[f * 3 + 1] = hipsRest.y + (p.y - 0.98) * ratio;
      values[f * 3 + 2] = hipsRest.z + p.z * ratio;
    }
    outTracks.push(new THREE.VectorKeyframeTrack(
      `${mapping.target.hips.name}.position`, Array.from(times), Array.from(values),
    ));
  }

  return new THREE.AnimationClip(sourceClip.name || 'retargeted', dur, outTracks);
}

// ── Import کامل ──────────────────────────────────────────────
export interface ImportedClipDef {
  id: string;
  label: string;
  clip: THREE.AnimationClip;
  loop: boolean;
  origin: 'library' | 'model';
}

export interface ImportedModel {
  wrapper: THREE.Group;
  mixer: THREE.AnimationMixer;
  clips: ImportedClipDef[];
  report: { found: string[]; missing: string[]; boneCount: number; modelClips: number; ok: boolean };
  dispose: () => void;
}

export async function importExternalModel(buffer: ArrayBuffer): Promise<ImportedModel> {
  const loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
  } catch { /* بدون دراکو ادامه بده */ }

  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((res, rej) => {
    loader.parse(buffer, '', (g) => res(g as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }), rej);
  });

  const scene = gltf.scene;
  const renameMap = renameInScene(scene);
  const modelClips = (gltf.animations ?? []).map((c) => { renameTracks([c], renameMap); return c; });

  // نرمال‌سازی مقیاس و موقعیت
  const bbox = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const scale = size.y > 0 ? 1.75 / size.y : 1;
  const wrapper = new THREE.Group();
  wrapper.name = 'importedWrapper';
  wrapper.add(scene);
  wrapper.scale.setScalar(THREE.MathUtils.clamp(scale, 0.05, 25));
  wrapper.updateMatrixWorld(true);
  const bbox2 = new THREE.Box3().setFromObject(wrapper);
  const center = new THREE.Vector3();
  bbox2.getCenter(center);
  wrapper.position.x -= center.x;
  wrapper.position.z -= center.z;
  wrapper.position.y -= bbox2.min.y;

  // تشخیص و اعتبارسنجی
  const mapping = detectHumanoidBones(wrapper);
  const critical = ['hips', 'spine', 'head'];
  const ok = critical.every((c) => Boolean(mapping.target[c]))
    && Boolean(mapping.target.upperArmL || mapping.target.upperArmR);

  // پوز مرجع (قبل از هر انیمیشنی)
  const rest = measureRest(wrapper, mapping);

  // ریتارگت کتابخانه
  const clips: ImportedClipDef[] = [];
  if (ok) {
    const lib = buildClipLibrary();
    for (const def of ANIM_DEFS) {
      try {
        const rc = retargetClipCustom(lib[def.id], mapping, rest);
        clips.push({ id: def.id, label: def.label, clip: rc, loop: def.loop, origin: 'library' });
      } catch (e) {
        console.error('retarget fail', def.id, e);
      }
    }
  }
  for (const mc of modelClips) {
    clips.push({ id: `model_${mc.name || 'clip'}`, label: mc.name || 'کلیپ مدل', clip: mc, loop: true, origin: 'model' });
  }

  const mixer = new THREE.AnimationMixer(wrapper);

  return {
    wrapper,
    mixer,
    clips,
    report: {
      found: mapping.found,
      missing: mapping.missing,
      boneCount: mapping.boneCount,
      modelClips: modelClips.length,
      ok,
    },
    dispose: () => {
      wrapper.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      mixer.stopAllAction();
    },
  };
}

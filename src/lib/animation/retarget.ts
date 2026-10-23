// ─────────────────────────────────────────────────────────────
// Import مدل GLB استاندارد + Retarget انیمیشن‌ها
//
// استاندارد ورود مدل:
//   • فرمت GLB / GLTF با SkinnedMesh و اسکلت هیومنوید
//   • حالت T-Pose (پوز مرجع) — پوز A با اصلاح خودکار هم پشتیبانی می‌شود
//   • اسکلت سازگار Mixamo / Blender / Unity (تشخیص خودکار نام استخوان‌ها)
//
// روش ریتارگت: دلتای چرخش جهانی (world-space delta)
//   Δ_bone(t)   = Q_source_world(t) · Q_source_world_rest⁻¹
//   Q_dst_world(t) = Δ_bone(t) · Q_dst_world_rest
//   Q_dst_local(t) = (Q_canonParent_world(t) · bridge)⁻¹ · Q_dst_world(t)
//
// bridge (A04) = Q_canonParent_rest⁻¹ · Q_realParent_rest
//   جبران «استخوان‌های واسط نگاشت‌نشده» بین والد canonical و والد واقعی؛
//   در پوز rest خروجی محلی دقیقاً برابر چرخش محلی bind می‌شود (دلتا صفر).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { BONE_ORDER, BONE_PARENT, BONE_DEPTH } from '../character/skeleton';
import { ANIM_DEFS, buildClipLibrary } from './clips';
import { assetUrl } from '../base-path';

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

// ════════════════════════════════════════════════════════════
// تشخیص استخوان‌های هیومنوید — رزولور مشترک با اولویت معنایی
// و ساختاری (A03): شانه هرگز جای بازو و root هرگز جای لگن
// نمی‌نشیند و نتیجه مستقل از ترتیب پیمایش است.
// ════════════════════════════════════════════════════════════

export function normName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
    .replace(/^mixamorig/, '')
    .replace(/^(def|org|mch|ctl)/, '');
}

/** نگاشت نام نرمال‌شده → canonical (بدون پسوند سمت) */
function canonBase(norm: string): { base: string; rank: number } | null {
  const simple: Record<string, [string, number]> = {
    hips: ['hips', 90], pelvis: ['hips', 80], hip: ['hips', 70], root: ['hips', 25],
    spine: ['spine', 90], torso: ['spine', 55],
    // Universal rig (Quaternius): spine_01/02/03 و neck_01
    // spine_02 برنده می‌شود (spine_01 جریمه‌ی نسلی می‌گیرد) — مفصل میانی کمر
    spine01: ['spine', 88], spine02: ['spine', 86], spine03: ['chest', 88],
    spine1: ['chest', 50], spine2: ['chest', 55], chest: ['chest', 90], upperchest: ['chest', 80],
    neck: ['neck', 90], neck01: ['neck', 88], head: ['head', 90],
  };
  if (simple[norm]) { const [b, r] = simple[norm]; return { base: b, rank: r }; }

  let side: 'L' | 'R' | null = null;
  let part = '';
  for (const [pre, sd] of [['left', 'L'], ['right', 'R']] as const) {
    if (norm.startsWith(pre)) { side = sd as 'L' | 'R'; part = norm.slice(pre.length); break; }
  }
  if (!side) {
    for (const [suf, sd] of [['l', 'L'], ['r', 'R']] as const) {
      if (norm.length > 1 && norm.endsWith(suf)) { side = sd as 'L' | 'R'; part = norm.slice(0, -1); break; }
    }
  }
  if (!side) return null;

  // رتبه‌ی مستعارها — بالاتر = نام دقیق‌تر برای همان مفصل
  const ranks: Record<string, number> = {
    arm: 65, upperarm: 90, uparm: 80, shoulder: 25, clavicle: 10,
    forearm: 90, lowerarm: 85, elbow: 60,
    hand: 90,
    upleg: 80, upperleg: 90, thigh: 85, legupper: 60,
    leg: 60, lowerleg: 85, shin: 80, calf: 70, leglower: 55,
    foot: 90,
  };
  const base = ({
    arm: 'upperArm', upperarm: 'upperArm', uparm: 'upperArm', shoulder: 'upperArm', clavicle: 'upperArm',
    forearm: 'lowerArm', lowerarm: 'lowerArm', elbow: 'lowerArm',
    hand: 'hand',
    upleg: 'upperLeg', upperleg: 'upperLeg', thigh: 'upperLeg', legupper: 'upperLeg',
    leg: 'lowerLeg', lowerleg: 'lowerLeg', shin: 'lowerLeg', calf: 'lowerLeg', leglower: 'lowerLeg',
    foot: 'foot',
  } as Record<string, string>)[part];
  if (!base) return null;
  return { base, rank: ranks[part] ?? 40 };
}

/** نام کامل canonical با سمت — دقیقاً با همان قواعد پیشوند/پسوند canonBase */
function canonFull(norm: string): string | null {
  const c = canonBase(norm);
  if (!c) return null;
  if (c.base === 'hips' || c.base === 'spine' || c.base === 'chest' || c.base === 'neck' || c.base === 'head') {
    return c.base;
  }
  let side: 'L' | 'R' | null = null;
  for (const [pre, sd] of [['left', 'L'], ['right', 'R']] as const) {
    if (norm.startsWith(pre)) { side = sd as 'L' | 'R'; break; }
  }
  if (!side) {
    for (const [suf, sd] of [['l', 'L'], ['r', 'R']] as const) {
      if (norm.length > 1 && norm.endsWith(suf)) { side = sd as 'L' | 'R'; break; }
    }
  }
  if (!side) return null;
  return `${c.base}${side}`;
}

/** آیا a جدِ b است (پیمایش محدود والدین) */
function isAncestorOf(a: THREE.Object3D, b: THREE.Object3D): boolean {
  let p = b.parent;
  let depth = 0;
  while (p && depth < 64) {
    if (p === a) return true;
    p = p.parent;
    depth++;
  }
  return false;
}

interface BoneCandidate {
  norm: string;
  node: THREE.Bone;
  rank: number;
}

/**
 * انتخاب بهترین کاندید هر canonical — مستقل از ترتیب پیمایش:
 *  ۱) رتبه‌ی نام (نام دقیق مفصل بر شانه/کلویکل و root مقدم است)
 *  ۲) جریمه‌ی نسلی: اگر کاندید دیگری «فرزندِ» این استخوان است،
 *     این استخوان جد بزرگ‌تر زنجیره است و نباید برگزیده شود
 *  ۳) پاداش ساختاری: upperArm واقعی فرزند lowerArm دارد؛
 *     لگن واقعی فرزند spine/upperLeg دارد
 */
function resolveCandidates(candidates: Record<string, BoneCandidate[]>): Record<string, THREE.Bone> {
  const target: Record<string, THREE.Bone> = {};
  for (const [canon, list] of Object.entries(candidates)) {
    let best = list[0];
    let bestScore = -Infinity;
    for (const c of list) {
      let score = c.rank;
      for (const other of list) {
        if (other !== c && isAncestorOf(c.node, other.node)) score -= 50;
      }
      if (canon.startsWith('upperArm')) {
        const hasForearmChild = c.node.children.some((ch) => canonFull(normName(ch.name)) === `lowerArm${canon.slice(-1)}`);
        if (hasForearmChild) score += 30;
      }
      if (canon === 'hips') {
        const spineOrLeg = c.node.children.some((ch) => {
          const f = canonFull(normName(ch.name));
          return f === 'spine' || f === 'upperLegL' || f === 'upperLegR';
        });
        if (spineOrLeg) score += 30;
      }
      if (score > bestScore) { bestScore = score; best = c; }
    }
    target[canon] = best.node;
  }
  return target;
}

/** جمع‌آوری کاندیدها از درخت — مشترک بین detect و measureSourceRest */
function collectCandidates(root: THREE.Object3D): { candidates: Record<string, BoneCandidate[]>; boneCount: number } {
  const candidates: Record<string, BoneCandidate[]> = {};
  let boneCount = 0;
  root.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    boneCount++;
    // ارقام حفظ می‌شوند تا Spine1 با Spine اشتباه نشود
    const norm = normName(o.name);
    const full = canonFull(norm);
    if (!full) return;
    (candidates[full] ??= []).push({ norm, node: o as THREE.Bone, rank: canonBase(norm)!.rank });
  });
  return { candidates, boneCount };
}

export interface BoneMapping {
  /** canonical → Bone در مدل واردشده */
  target: Record<string, THREE.Bone>;
  found: string[];
  missing: string[];
  boneCount: number;
}

export function detectHumanoidBones(root: THREE.Object3D): BoneMapping {
  const { candidates, boneCount } = collectCandidates(root);
  const target = resolveCandidates(candidates);
  const found = Object.keys(target);
  const missing = BONE_ORDER.filter((b) => !target[b]);
  return { target, found, missing, boneCount };
}

// ── اندازه‌گیری پوز مرجع مقصد + اصلاح خودکار A-Pose ──────────
export interface TargetRest {
  /** canonical → چرخش جهانی استخوان در پوز مرجع (با اصلاح T-Pose) */
  worldQuat: Record<string, THREE.Quaternion>;
  /** نزدیک‌ترین والد نگاشت‌شده (برای FK) */
  parentCanon: Record<string, string | null>;
  hipsLocalRest: THREE.Vector3;
  hipsWorldY: number;
  /**
   * A04 — bridge هر استخوان: Q_canonParent_rest⁻¹ · Q_realParent_rest
   * برای والد canonical تهی، bridge = Q_realParent_rest.
   */
  bridgeQuat: Record<string, THREE.Quaternion>;
  /** چرخش جهانی والد واقعی هر استخوان در rest (برای دلتای موقعیت لگن) */
  realParentQuat: Record<string, THREE.Quaternion>;
}

function armTPoseCorrection(worldQuat: Record<string, THREE.Quaternion>, worldPos: Record<string, THREE.Vector3>) {
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
}

export function measureRest(root: THREE.Object3D, mapping: BoneMapping): TargetRest {
  root.updateMatrixWorld(true);
  const worldQuat: Record<string, THREE.Quaternion> = {};
  const worldPos: Record<string, THREE.Vector3> = {};
  const realParentQuat: Record<string, THREE.Quaternion> = {};
  for (const [canon, bone] of Object.entries(mapping.target)) {
    const q = new THREE.Quaternion();
    bone.matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    worldQuat[canon] = q;
    const p = new THREE.Vector3();
    bone.getWorldPosition(p);
    worldPos[canon] = p;
    const pq = new THREE.Quaternion();
    const parent = bone.parent;
    if (parent) parent.matrixWorld.decompose(new THREE.Vector3(), pq, new THREE.Vector3());
    else pq.identity();
    realParentQuat[canon] = pq;
  }

  // اصلاح A-Pose → T-Pose برای بازوهای مقصد (اگر بازوها آویزان باشند) —
  // کلیپ‌های canonical/KayKit/UAL همگی تی‌پوز‌محورند
  armTPoseCorrection(worldQuat, worldPos);

  // والد نگاشت‌شده‌ی نزدیک + bridge
  const parentCanon: Record<string, string | null> = {};
  const bridgeQuat: Record<string, THREE.Quaternion> = {};
  for (const canon of Object.keys(mapping.target)) {
    let p = BONE_PARENT[canon as keyof typeof BONE_PARENT] ?? null;
    while (p && !mapping.target[p]) p = BONE_PARENT[p as keyof typeof BONE_PARENT] ?? null;
    parentCanon[canon] = p;
    if (p && worldQuat[p]) {
      // A04: bridge = Q_canonParent⁻¹ · Q_realParent
      bridgeQuat[canon] = worldQuat[p].clone().invert().multiply(realParentQuat[canon]);
    } else {
      // بدون والد canonical: کل زنجیره‌ی بالای استخوان جبران می‌شود
      bridgeQuat[canon] = realParentQuat[canon].clone();
    }
  }

  const hips = mapping.target.hips;
  const hipsLocalRest = hips ? hips.position.clone() : new THREE.Vector3(0, 1, 0);
  const hipsWorldY = worldPos.hips ? worldPos.hips.y : 1;

  return { worldQuat, parentCanon, hipsLocalRest, hipsWorldY, bridgeQuat, realParentQuat };
}

// ── نمونه‌گیری track — امن برای ترک خالی/تک‌کی‌فریم و بیرون بازه (A05)
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();

/** ناحیه‌بندی امن: خروجی همیشه finite و داخل بازه clamp می‌شود */
function findSegment(times: ArrayLike<number>, t: number): { i: number; a: number } {
  const n = times.length;
  if (n <= 1) return { i: 0, a: 0 };
  const tc = Math.min(Math.max(t, times[0]), times[n - 1]);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= tc) lo = mid; else hi = mid;
  }
  const t0 = times[lo], t1 = times[lo + 1];
  const a = t1 > t0 ? (tc - t0) / (t1 - t0) : 0;
  return { i: lo, a: Math.min(1, Math.max(0, a)) };
}

export function sampleQuat(track: THREE.QuaternionKeyframeTrack, t: number, out: THREE.Quaternion) {
  const times = track.times;
  const v = track.values as Float32Array;
  if (times.length === 0) { out.identity(); return; }
  if (times.length === 1) { out.fromArray(v, 0); return; }
  const { i, a } = findSegment(times, t);
  _qa.fromArray(v, i * 4);
  _qb.fromArray(v, (i + 1) * 4);
  out.slerpQuaternions(_qa, _qb, a);
}

const _tv = new THREE.Vector3();
export function sampleVec(track: THREE.VectorKeyframeTrack, t: number, out: THREE.Vector3) {
  const times = track.times;
  const v = track.values as Float32Array;
  if (times.length === 0) { out.set(0, 0, 0); return; }
  if (times.length === 1) { out.fromArray(v, 0); return; }
  const { i, a } = findSegment(times, t);
  out.fromArray(v, i * 3).lerp(_tv.fromArray(v, (i + 1) * 3), a);
}

const CANON_HIPS_REST = new THREE.Vector3(0, 0.98, 0);

// ── ریتارگت یک کلیپ canonical (مبدأ: اسکلت مرجع با rest یکه) ──
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
  const bridge = new THREE.Quaternion();
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

      // 4) تبدیل به چرخش محلی مقصد — با bridge والد واقعی (A04)
      const pc = rest.parentCanon[canon] ?? null;
      if (pc && qTgtWorld[pc]) parentQ.copy(qTgtWorld[pc]);
      else parentQ.identity();
      bridge.copy(rest.bridgeQuat[canon] ?? I);
      parentQ.multiply(bridge);
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
    // A04: دلتای جهانی به فضای محلیِ والدِ واقعیِ لگن مقصد برمی‌گردد
    const tgtParentInv = (rest.realParentQuat.hips ?? I).clone().invert();
    const times = new Float32Array(nFrames);
    const values = new Float32Array(nFrames * 3);
    const p = new THREE.Vector3();
    const wd = new THREE.Vector3();
    for (let f = 0; f < nFrames; f++) {
      const t = f * dt;
      times[f] = t;
      sampleVec(hipsTrack, t, p);
      wd.copy(p).sub(CANON_HIPS_REST).multiplyScalar(ratio).applyQuaternion(tgtParentInv);
      values[f * 3] = hipsRest.x + wd.x;
      values[f * 3 + 1] = hipsRest.y + wd.y;
      values[f * 3 + 2] = hipsRest.z + wd.z;
    }
    outTracks.push(new THREE.VectorKeyframeTrack(
      `${mapping.target.hips.name}.position`, Array.from(times), Array.from(values),
    ));
  }

  return new THREE.AnimationClip(sourceClip.name || 'retargeted', dur, outTracks);
}

// ── ریتارگت عمومی (مبدأ با rest واقعی — مثل UAL/Rigify/KayKit) ─
export interface SourceRest {
  /** canonical → چرخش جهانی استخوان مبدأ در پوز مرجع */
  worldQuat: Record<string, THREE.Quaternion>;
  /** canonical → نام نود نرمال‌شده‌ی مبدأ */
  canonToNode: Record<string, string>;
  /** نام نود لگن مبدأ (برای track موقعیت) */
  hipsNode: string;
  /** ارتفاع جهانی لگن مبدأ در rest */
  hipsWorldY: number;
  /**
   * A04 — چرخش «مفقود» بین والد canonical و خود استخوان در مبدأ:
   * bridge = Q_canonParent_rest⁻¹ · Q_realParent_rest
   * (فرمول قبلی ترتیب ضرب را برعکس داشت و ۹۰° انحراف می‌ساخت)
   */
  extraQuat: Record<string, THREE.Quaternion>;
  /** چرخش جهانی والدِ واقعی هر استخوان — برای دلتای موقعیت لگن */
  realParentQuat: Record<string, THREE.Quaternion>;
  /** ترجمه‌ی محلی استراحت لگن در فضای والد واقعی‌اش */
  hipsRestLocal: THREE.Vector3;
}

const _decompV = new THREE.Vector3();
const _decompS = new THREE.Vector3();

export function measureSourceRest(root: THREE.Object3D, hipsNode: string): SourceRest {
  root.updateMatrixWorld(true);
  const { candidates } = collectCandidates(root);
  const nodeWorldQuat = new Map<string, THREE.Quaternion>();
  const nodeByNorm = new Map<string, THREE.Object3D>();
  let hipsWorldY = 1;
  let hipsRestLocal = new THREE.Vector3(0, 1, 0);
  const hipsNorm = normName(hipsNode);
  root.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    const norm = normName(o.name);
    const q = new THREE.Quaternion();
    o.matrixWorld.decompose(_decompV, q, _decompS);
    if (!nodeWorldQuat.has(norm)) {
      nodeWorldQuat.set(norm, q);
      nodeByNorm.set(norm, o);
    }
    if (norm === hipsNorm) {
      o.getWorldPosition(_hipsP);
      hipsWorldY = _hipsP.y;
      hipsRestLocal = o.position.clone();
    }
  });

  // حل تعارض مشترک (A03) — مستقل از ترتیب پیمایش
  const resolved = resolveCandidates(candidates);
  const worldQuat: Record<string, THREE.Quaternion> = {};
  const canonToNode: Record<string, string> = {};
  for (const [canon, node] of Object.entries(resolved)) {
    const norm = normName(node.name);
    const q = new THREE.Quaternion();
    node.matrixWorld.decompose(_decompV, q, _decompS);
    worldQuat[canon] = q;
    canonToNode[canon] = norm;
  }

  // ⚠️ A04 — rest مبدأ «بدون تصحیح A-Pose» اندازه‌گیری می‌شود:
  // قرارداد rest باید با فریم مرجع خود کلیپ‌ها یکی بماند تا دلتای صفر
  // در پوز مرجع تضمین شود (کلیپ‌های kk/UAL روی rest خودشان نوشته شده‌اند).
  // تصحیح A-Pose فقط سمت مقصد (برای کلیپ‌های canonical تی‌پوز) اعمال می‌شود.

  // ── والد واقعی + bridge با ترتیب صحیح ضرب (A04) ──
  const extraQuat: Record<string, THREE.Quaternion> = {};
  const realParentQuat: Record<string, THREE.Quaternion> = {};
  for (const [canon, nodeName] of Object.entries(canonToNode)) {
    const node = nodeByNorm.get(nodeName);
    const pq = new THREE.Quaternion();
    const parentNode = node?.parent;
    if (parentNode) parentNode.matrixWorld.decompose(_decompV, pq, _decompS);
    else pq.identity();
    realParentQuat[canon] = pq;

    // نزدیک‌ترین والد canonical نگاشت‌شده
    let p = BONE_PARENT[canon as keyof typeof BONE_PARENT] ?? null;
    while (p && !worldQuat[p]) p = BONE_PARENT[p as keyof typeof BONE_PARENT] ?? null;
    if (p && canonToNode[p]) {
      const parentWorld = nodeWorldQuat.get(canonToNode[p])!;
      // A04: bridge = Q_canonParent⁻¹ · Q_realParent  (ترتیب اصلاح شد)
      extraQuat[canon] = parentWorld.clone().invert().multiply(pq);
    } else {
      // لگن (یا بدون والد canonical): کل زنجیره‌ی بالای سر — مثل root با ‎−90°X‎
      extraQuat[canon] = pq.clone();
    }
  }

  return { worldQuat, canonToNode, hipsNode, hipsWorldY, extraQuat, realParentQuat, hipsRestLocal };
}
const _hipsP = new THREE.Vector3();

export function retargetClipFromRest(
  sourceClip: THREE.AnimationClip,
  srcRest: SourceRest,
  mapping: BoneMapping,
  rest: TargetRest,
): THREE.AnimationClip {
  const dur = sourceClip.duration;
  const nFrames = Math.max(2, Math.ceil(dur * 30) + 1);
  const dt = dur / (nFrames - 1);

  const srcQ: Record<string, THREE.QuaternionKeyframeTrack> = {};
  let hipsTrack: THREE.VectorKeyframeTrack | null = null;
  const hipsNorm = normName(srcRest.hipsNode);
  for (const tr of sourceClip.tracks) {
    // نام نود ممکن است نقطه داشته باشد (Rigify: DEF-upper_arm.L) ⇒ آخرین نقطه جداکننده است
    const dot = tr.name.lastIndexOf('.');
    const node = normName(dot > 0 ? tr.name.slice(0, dot) : tr.name);
    if (tr instanceof THREE.QuaternionKeyframeTrack) srcQ[node] = tr;
    else if (node === hipsNorm && tr instanceof THREE.VectorKeyframeTrack) hipsTrack = tr;
  }

  const canons = Object.keys(mapping.target).sort(
    (a, b) => (BONE_DEPTH[a as keyof typeof BONE_DEPTH] ?? 0) - (BONE_DEPTH[b as keyof typeof BONE_DEPTH] ?? 0),
  );

  const qLocal = new THREE.Quaternion();
  const qWorldT = new THREE.Quaternion();   // world(t) مبدأ
  const qDelta = new THREE.Quaternion();    // world(t) · worldRest⁻¹
  const parentWorldT = new THREE.Quaternion();
  const desired = new THREE.Quaternion();
  const parentTgt = new THREE.Quaternion();
  const tgtBridge = new THREE.Quaternion();
  const local = new THREE.Quaternion();
  const I = new THREE.Quaternion();

  // والد canonical مبدأ — با ترتیب FK روی canons مقصد نمی‌سازد؛
  // ما world مبدأ را مستقل به‌صورت top-down روی درخت مقصد حساب می‌کنیم.
  const srcParentCanon: Record<string, string | null> = {};
  const PARENT: Record<string, string | null> = {
    spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
    upperArmL: 'chest', lowerArmL: 'upperArmL', handL: 'lowerArmL',
    upperArmR: 'chest', lowerArmR: 'upperArmR', handR: 'lowerArmR',
    upperLegL: 'hips', lowerLegL: 'upperLegL', footL: 'lowerLegL',
    upperLegR: 'hips', lowerLegR: 'upperLegR', footR: 'lowerLegR',
  };
  for (const c of canons) {
    let p = PARENT[c] ?? null;
    while (p && !srcRest.worldQuat[p]) p = PARENT[p] ?? null;
    srcParentCanon[c] = p;
  }

  const outTracks: THREE.KeyframeTrack[] = [];

  for (const canon of canons) {
    const bone = mapping.target[canon];
    const track = srcRest.canonToNode[canon] ? srcQ[srcRest.canonToNode[canon]] : undefined;
    // ⚠️ چرخش مفقود بین والد canonical و خود استخوان (root ‎−90°X‎، shoulder و…)
    const extra = srcRest.extraQuat?.[canon] ?? I;
    const realParentQ = srcRest.realParentQuat?.[canon] ?? null;
    const times = new Float32Array(nFrames);
    const values = new Float32Array(nFrames * 4);

    for (let f = 0; f < nFrames; f++) {
      const t = f * dt;
      times[f] = t;

      if (track) {
        sampleQuat(track, t, qLocal);
      } else {
        // track مفقود ⇒ rest محلی نسبت به «والد واقعی» تا دلتا صفر بماند
        if (realParentQ && srcRest.worldQuat[canon]) {
          qLocal.copy(_qTmp.copy(realParentQ).invert()).multiply(srcRest.worldQuat[canon]);
        } else if (srcRest.worldQuat[canon]) {
          qLocal.copy(srcRest.worldQuat[canon]);
        } else {
          qLocal.identity();
        }
      }

      // world مبدأ top-down: world(t) = parentWorld(t) · bridge · local(t)
      const pc = srcParentCanon[canon];
      if (pc && qWorldT_set[pc]) {
        parentWorldT.copy(qWorldT_set[pc]);
      } else parentWorldT.identity();
      qWorldT.copy(parentWorldT).multiply(extra).multiply(qLocal);
      qWorldT_set[canon] = qWorldT.clone();

      // دلتا نسبت به rest مبدأ
      qDelta.copy(qWorldT).multiply(_qTmp.copy(srcRest.worldQuat[canon] ?? I).invert());

      // اعمال روی rest مقصد
      desired.copy(qDelta).multiply(rest.worldQuat[canon] ?? I);

      // A04: والد canonical مقصد + bridge والد واقعی
      const tpc = rest.parentCanon[canon] ?? null;
      if (tpc && qTgt_set[tpc]) parentTgt.copy(qTgt_set[tpc]);
      else parentTgt.identity();
      tgtBridge.copy(rest.bridgeQuat[canon] ?? I);
      parentTgt.multiply(tgtBridge);
      local.copy(parentTgt).invert().multiply(desired);
      qTgt_set[canon] = desired.clone();

      values[f * 4] = local.x; values[f * 4 + 1] = local.y;
      values[f * 4 + 2] = local.z; values[f * 4 + 3] = local.w;
    }
    outTracks.push(new THREE.QuaternionKeyframeTrack(
      `${bone.name}.quaternion`, Array.from(times), Array.from(values),
    ));
  }

  // ── موقعیت لگن مبدأ ──
  if (hipsTrack && mapping.target.hips) {
    const hipsRest = rest.hipsLocalRest.clone();
    const ratio = rest.hipsWorldY / Math.max(0.01, srcRest.hipsWorldY);
    // دلتای محلی لگن در فضای والد واقعی مبدأ است — با چرخش جهانی والد به جهان می‌رود
    // (مثلاً root مبدأ ‎−90°X‎ دارد؛ بدون این تصحیح محورها جابه‌جا می‌شوند)
    const srcParentQ = srcRest.realParentQuat?.hips ?? I;
    const pRestLocal = srcRest.hipsRestLocal ?? new THREE.Vector3(0, srcRest.hipsWorldY, 0);
    // A04: دلتای جهانی به فضای محلی والد واقعی لگن مقصد برمی‌گردد
    const tgtParentInv = (rest.realParentQuat?.hips ?? I).clone().invert();
    const times = new Float32Array(nFrames);
    const values = new Float32Array(nFrames * 3);
    const p = new THREE.Vector3();
    const wd = new THREE.Vector3();
    for (let f = 0; f < nFrames; f++) {
      const t = f * dt;
      times[f] = t;
      sampleVec(hipsTrack, t, p);
      wd.copy(p).sub(pRestLocal).applyQuaternion(srcParentQ).multiplyScalar(ratio);
      wd.applyQuaternion(tgtParentInv);
      values[f * 3] = hipsRest.x + wd.x;
      values[f * 3 + 1] = hipsRest.y + wd.y;
      values[f * 3 + 2] = hipsRest.z + wd.z;
    }
    outTracks.push(new THREE.VectorKeyframeTrack(
      `${mapping.target.hips.name}.position`, Array.from(times), Array.from(values),
    ));
  }

  return new THREE.AnimationClip(sourceClip.name || 'retargeted', dur, outTracks);
}
const _qTmp = new THREE.Quaternion();
const qWorldT_set: Record<string, THREE.Quaternion> = {};
const qTgt_set: Record<string, THREE.Quaternion> = {};

// ── Import کامل ──────────────────────────────────────────────
export type ImportedOrigin = 'library' | 'model';

export interface ImportedClipDef {
  id: string;
  label: string;
  clip: THREE.AnimationClip;
  loop: boolean;
  origin: ImportedOrigin;
  /** دسته‌ی اصلی کلیپ کتابخانه (A16) */
  cat: string;
  /** منشأ کلیپ کتابخانه (A16) */
  source: string;
}

export interface ImportedModel {
  wrapper: THREE.Group;
  mixer: THREE.AnimationMixer;
  clips: ImportedClipDef[];
  report: {
    found: string[]; missing: string[]; boneCount: number; modelClips: number;
    libraryClips: number; failed: number; ok: boolean;
  };
  dispose: () => void;
}

export interface LibraryClipDef {
  id: string;
  label: string;
  loop: boolean;
  cat: string;
  origin: string;
  clip: THREE.AnimationClip;
  /**
   * A02 — قرارداد مبدأ کلیپ:
   *  • 'canonical' — کلیپ روی اسکلت مرجع با rest یکه (کلیپ‌های رویه‌ای)
   *  • 'rest'      — کلیپ روی ریگ واقعی؛ باید با SourceRest همان ریگ
   *                  ریتارگت شود (کلیپ‌های KayKit و UAL خام)
   */
  kind: 'canonical' | 'rest';
  srcRest?: SourceRest;
}

export interface ImportOptions {
  library?: LibraryClipDef[];
  onProgress?: (done: number, total: number) => void;
  /** لغو همکاری‌کننده — بین chunk ها بررسی می‌شود (A27) */
  shouldAbort?: () => boolean;
  /** A13 — فایل‌های جانبی .gltf (نام فایل → blob URL) */
  resourceFiles?: Map<string, string>;
}

/** حداکثر مدت ریتارگت برای جلوگیری از قفل‌شدن تب — بودجه‌ی پیچیدگی (A27) */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export async function importExternalModel(
  buffer: ArrayBuffer,
  opts: ImportOptions = {},
): Promise<ImportedModel> {
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Error('MODEL_TOO_LARGE');
  }

  const loader = new GLTFLoader();
  try {
    // A27 — دیکودر Draco به‌صورت محلی سرو می‌شود (بدون وابستگی شبکه)
    const draco = new DRACOLoader();
    draco.setDecoderPath(assetUrl('/draco/'));
    loader.setDRACOLoader(draco);
  } catch { /* بدون دراکو ادامه بده */ }

  // A13/A27 — نگاشت فایل‌های جانبی + سیاست منابع خارجی
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    if (/^https?:\/\//i.test(url)) {
      throw new Error('EXTERNAL_RESOURCE');
    }
    if (opts.resourceFiles && opts.resourceFiles.size > 0) {
      const base = decodeURIComponent(url.split(/[\\/]/).pop() ?? url).toLowerCase();
      const hit = opts.resourceFiles.get(base);
      if (hit) return hit;
    }
    return url;
  });
  const multiLoader = new GLTFLoader(manager);
  try {
    const draco = new DRACOLoader(manager);
    draco.setDecoderPath(assetUrl('/draco/'));
    multiLoader.setDRACOLoader(draco);
  } catch { /* بدون دراکو ادامه بده */ }

  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((res, rej) => {
    if (opts.resourceFiles && opts.resourceFiles.size > 0) {
      multiLoader.parse(buffer, '', (g) => res(g as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }), rej);
    } else {
      loader.parse(buffer, '', (g) => res(g as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }), rej);
    }
  });

  const scene = gltf.scene;
  const renameMap = renameInScene(scene);
  const modelClips = (gltf.animations ?? []).map((c) => { renameTracks([c], renameMap); return c; });

  // نرمال‌سازی مقیاس — A14: نسبت دقیق و بدون clamp بی‌مورد؛
  // مدل با واحد متر/سانتی‌متر/میلی‌متر همیشه به ارتفاع ۱.۷۵m می‌رسد
  const bbox = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const scale = Number.isFinite(size.y) && size.y > 1e-4 ? 1.75 / size.y : 1;
  const wrapper = new THREE.Group();
  wrapper.name = 'importedWrapper';
  wrapper.add(scene);
  wrapper.scale.setScalar(scale);
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

  // ریتارگت کتابخانه — هر کلیپ با قرارداد مبدأ خودش (A02)
  const clips: ImportedClipDef[] = [];
  let failed = 0;
  if (ok) {
    const library = opts.library;
    if (library && library.length > 0) {
      let done = 0;
      for (const item of library) {
        try {
          const rc = item.kind === 'rest' && item.srcRest
            ? retargetClipFromRest(item.clip, item.srcRest, mapping, rest)
            : retargetClipCustom(item.clip, mapping, rest);
          clips.push({
            id: item.id, label: item.label, clip: rc, loop: item.loop,
            origin: 'library', cat: item.cat, source: item.origin,
          });
        } catch (e) {
          failed++;
          console.error('retarget fail', item.id, e);
        }
        done++;
        if (done % 10 === 0) {
          if (opts.shouldAbort?.()) throw new Error('IMPORT_ABORTED');
          opts.onProgress?.(done, library.length);
          await new Promise((r) => setTimeout(r, 0));
          if (opts.shouldAbort?.()) throw new Error('IMPORT_ABORTED');
        }
      }
      opts.onProgress?.(library.length, library.length);
    } else {
      const lib = buildClipLibrary();
      for (const def of ANIM_DEFS) {
        try {
          const rc = retargetClipCustom(lib[def.id], mapping, rest);
          clips.push({
            id: def.id, label: def.label, clip: rc, loop: def.loop,
            origin: 'library', cat: 'other', source: 'proc',
          });
        } catch (e) {
          failed++;
          console.error('retarget fail', def.id, e);
        }
      }
    }
  }
  for (const mc of modelClips) {
    clips.push({
      id: `model_${mc.name || 'clip'}`, label: mc.name || 'کلیپ مدل', clip: mc,
      loop: true, origin: 'model', cat: 'other', source: 'model',
    });
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
      libraryClips: clips.filter((c) => c.origin === 'library').length,
      failed,
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

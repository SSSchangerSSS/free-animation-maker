// ─────────────────────────────────────────────────────────────
// بدنه‌های V3 — Quaternius Universal Base Characters + Modular
// Character Outfits (CC0 1.0) با ریگ ۶۵ استخوانی استاندارد
// (pelvis / spine_01..03 / neck_01 / Head / clavicle_* / …)
//
// معماری:
//  • بدنه‌ی پایه + قطعات مدولار (کیت لباس/مو/ابرو/ریش) همگی با
//    «همان اسکلت» rig شده‌اند ⇒ اتصال با rebind به اسکلت بدنه
//  • بازرنگی با موتور ماسک UV موجود (recolor.ts) روی هر تکسچر
//  • سلاح‌های OBJ→GLB با پروفایل داده‌محور (grip/tip) به دست
//    متصل می‌شوند — فیکس پراکنده‌ی offset ممنوع (مأموریت §۲)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import {
  buildPartMasks, createRecolorTarget, applyRecolors,
  type RecolorTarget, type RecolorRule, type RecolorColors, type MaskSet, type RecolorKey,
} from './recolor';
import { applyReshape, DEFAULT_PHYSIQUE, type Physique } from './reshape';
import type { CharConfig } from './types';
import { assetUrl } from '../base-path';
import { V3_WEAPONS, type V3WeaponDef } from './weapons3';

export type { V3WeaponDef };
export { V3_WEAPONS };

// ── تعریف بدنه ───────────────────────────────────────────────
export interface V3BodyDef {
  id: string;
  label: string;
  desc: string;
  base: 'Male_Base' | 'Female_Base';
  outfit?: string;
  /** موهای بدنه باید مخفی شود (کلاه‌سر) */
  hood?: boolean;
  weapons: string[];
  defaultWeapon: string;
  /** قد هدف (متر) */
  height: number;
}

export const V3_BODIES: Record<string, V3BodyDef> = {
  V3_Ranger: {
    id: 'V3_Ranger', label: 'شانس‌دار V3', desc: 'بدن واقعی هفت‌ونیم‌سری با کیت شانس‌دار — مدل Quaternius',
    base: 'Male_Base', outfit: 'Male_Ranger', hood: true,
    weapons: ['none', 'sword', 'sword2h', 'axe', 'bow', 'dagger', 'spear'],
    defaultWeapon: 'sword', height: 1.82,
  },
  V3_Peasant: {
    id: 'V3_Peasant', label: 'روستایی V3', desc: 'پوشش ساده‌ی روستایی روی بدن واقعی',
    base: 'Male_Base', outfit: 'Male_Peasant',
    weapons: ['none', 'dagger', 'axe', 'hammer'],
    defaultWeapon: 'hammer', height: 1.82,
  },
  V3_Bare: {
    id: 'V3_Bare', label: 'آزمایشی V3', desc: 'بدن پایه — برای تست مورف و پوشش',
    base: 'Male_Base',
    weapons: ['none', 'dagger'],
    defaultWeapon: 'none', height: 1.82,
  },
};

// ── پروفایل بازرنگی هر بدنه بر اساس متریال‌های واقعی GLB ──────
// اسلات‌ها: skin→بدن، eye→چشم، hair→مو، beard→ریش، cloth/metal→کیت
// ⚠️ حالت shade: تکسچرهای Quaternius سایه‌ی دستی دارند — hue/sat
// از رنگ کاربر و lightness نسبی تکسچر حفظ می‌شود (ضد عروسکی)
const SKIN_RANGE: RecolorRule = {
  parts: ['superhero_male', 'superhero_female', 'regular_male', 'regular_female'],
  range: { hue: [8, 48], sat: [0.12, 0.9], light: [0.12, 0.97] }, meanL: 0.62,
  mode: 'shade', contrast: 0.5,
};
const EYE_RANGE: RecolorRule = {
  parts: ['eyes'],
  range: { hue: [10, 55], sat: [0.18, 1], light: [0.08, 0.75] }, meanL: 0.35,
  mode: 'shade', contrast: 0.5,
};
const HAIR_RANGE: RecolorRule = {
  parts: ['hair'], range: { hue: [0, 360], sat: [0, 1], light: [0.03, 0.985] }, meanL: 0.42,
  mode: 'shade', contrast: 0.55,
};
const OUTFIT_CLOTH: RecolorRule = {
  parts: ['ranger', 'peasant'],
  range: { hue: [0, 360], sat: [0.08, 1], light: [0.05, 0.95] }, meanL: 0.44,
  mode: 'shade', contrast: 0.5,
};
const OUTFIT_METAL: RecolorRule = {
  parts: ['ranger', 'peasant'],
  range: { hue: [0, 360], sat: [0, 0.14], light: [0.3, 0.97] }, meanL: 0.68,
  mode: 'shade', contrast: 0.5,
};

// ── لودر DRACO کش‌شده ────────────────────────────────────────
let _loader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (_loader) return _loader;
  const l = new GLTFLoader();
  const d = new DRACOLoader();
  d.setDecoderPath(assetUrl('/draco/'));
  l.setDRACOLoader(d);
  _loader = l;
  return l;
}

const gltfCache = new Map<string, Promise<THREE.Group>>();
function loadGltfScene(path: string): Promise<THREE.Group> {
  let p = gltfCache.get(path);
  if (p) return p;
  p = new Promise<THREE.Group>((res, rej) => {
    getLoader().load(assetUrl(path), (g) => res(g.scene), undefined, rej);
  });
  gltfCache.set(path, p);
  return p;
}

/** هندسه‌های اشتراکی v3 — dispose شخصیت نباید آزادشان کند */
export const v3SharedGeometries = new WeakSet<THREE.BufferGeometry>();
export function isV3SharedGeometry(g: THREE.BufferGeometry): boolean {
  return v3SharedGeometries.has(g);
}

// ── اتصال SkinnedMesh به اسکلت بدنه (rebind) ─────────────────
function rebindSkinned(
  src: THREE.SkinnedMesh,
  boneMap: Map<string, THREE.Bone>,
): THREE.SkinnedMesh | null {
  const srcSkel = src.skeleton;
  const bones: THREE.Bone[] = [];
  for (const b of srcSkel.bones) {
    const target = boneMap.get(b.name);
    if (!target) return null; // ناسازگاری اسکلت — قطعه رد می‌شود
    bones.push(target);
  }
  const geo = src.geometry;
  v3SharedGeometries.add(geo);
  const mesh = new THREE.SkinnedMesh(geo, (src.material as THREE.Material).clone());
  mesh.name = src.name;
  mesh.bind(new THREE.Skeleton(bones, srcSkel.boneInverses), new THREE.Matrix4());
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function findBones(root: THREE.Object3D): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) map.set(o.name, o as THREE.Bone);
  });
  return map;
}

// ── چنگ داده‌محور — نصب سلاح از محورهای واقعی اسکلت ──────────
// مأموریت §۲: هر سلاح فقط gripCenter/roll/pitch در پروفایل دارد؛
// محور چنگ = امتداد ساعد (اندازه‌گیری‌شده)، نه عدد پراکنده per پوز.
export interface GripMount { pos: THREE.Vector3; quat: THREE.Quaternion }

export function computeGripMount(hand: THREE.Bone, wdef: V3WeaponDef): GripMount {
  hand.updateWorldMatrix(true, false);
  const handPos = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld);
  const elbow = hand.parent as THREE.Bone | null;
  let gripAxis: THREE.Vector3;
  if (elbow) {
    elbow.updateWorldMatrix(true, false);
    gripAxis = handPos.clone().sub(new THREE.Vector3().setFromMatrixPosition(elbow.matrixWorld));
    if (gripAxis.lengthSq() < 1e-8) gripAxis.set(0, -1, 0);
    gripAxis.normalize();
  } else {
    gripAxis = new THREE.Vector3(0, -1, 0);
  }
  // مرجع غلت: محور Y جهانی استخوان دست — پایدار در خانواده‌ی ریگ
  const rotM = new THREE.Matrix4().extractRotation(hand.matrixWorld);
  const handQ = new THREE.Quaternion().setFromRotationMatrix(rotM);
  const handUp = new THREE.Vector3(0, 1, 0).applyQuaternion(handQ);
  if (Math.abs(handUp.dot(gripAxis)) > 0.92) handUp.set(0, 0, 1).applyQuaternion(handQ);
  const gx = new THREE.Vector3().crossVectors(handUp, gripAxis);
  if (gx.lengthSq() < 1e-6) gx.set(1, 0, 0);
  gx.normalize();
  const gy = new THREE.Vector3().crossVectors(gripAxis, gx).normalize();

  // غلت حول محور چنگ + پیچ تیغه نسبت به ساعد
  const roll = (wdef.rollDeg * Math.PI) / 180;
  const pitch = (wdef.pitchDeg * Math.PI) / 180;
  const Rroll = new THREE.Quaternion().setFromAxisAngle(gripAxis, roll);
  const Tx = gx.clone().applyQuaternion(Rroll);            // جانبی (لبه)
  const Rpitch = new THREE.Quaternion().setFromAxisAngle(gx, pitch);
  const Ty = gy.clone().applyQuaternion(Rroll).applyQuaternion(Rpitch); // کف‌دستی
  const Tz = gripAxis.clone().applyQuaternion(Rpitch);      // امتداد تیغه

  // قاب مدل خام: تیغه a، لبه e، عمود c
  const a = new THREE.Vector3(...(wdef.gripAxisModel ?? [0, 1, 0])).normalize();
  const e0 = new THREE.Vector3(...(wdef.edgeModel ?? [0, 0, 1]));
  const e = e0.clone().addScaledVector(a, -e0.dot(a));
  if (e.lengthSq() < 1e-6) e.set(1, 0, 0);
  e.normalize();
  const c = new THREE.Vector3().crossVectors(a, e).normalize();
  const Bm = new THREE.Matrix4().makeBasis(a, e, c);
  const Bt = new THREE.Matrix4().makeBasis(Tz, Tx, Ty);
  const W = Bt.multiply(Bm.invert());

  // مرکز چنگ در جهان → محلی دست
  const gc = [wdef.gripCenter[0], wdef.gripCenter[1], wdef.gripCenter[2]];
  const gripCenterWorld = handPos.clone()
    .addScaledVector(gripAxis, gc[0])
    .addScaledVector(gx, gc[1])
    .addScaledVector(gy, gc[2]);
  const Qhand = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().extractRotation(hand.matrixWorld),
  );
  const QhandInv = Qhand.clone().invert();
  const pos = gripCenterWorld.clone().sub(handPos).applyQuaternion(QhandInv);
  const quat = QhandInv.clone().multiply(
    new THREE.Quaternion().setFromRotationMatrix(W),
  );
  return { pos, quat };
}

// ── اصلاح متریال بدنه/کیت — ضد ظاهر پاستلی عروسکی ────────────
// GLBهای Quaternius با metalness=۱ خروجی شده‌اند؛ متریال فلزی کامل
// رنگ بافت را بازتاب محیط می‌کند (شسته‌شده). پارچه/پوست/مو باید
// دی‌الکتریک باشند؛ فقط قطعات زره‌ای واقعاً فلز می‌مانند.
const V3_METAL_PART = /pauldron|helmet|armor|buckle|shoulder|greave|bracer/i;
function fixV3Material(mat: THREE.MeshStandardMaterial, meshName: string): void {
  const isMetal = V3_METAL_PART.test(meshName);
  mat.metalness = isMetal ? 0.55 : 0;
  mat.roughness = isMetal ? 0.45 : 0.9;
}

// ── ساختار بازرنگی چندتکسچری ─────────────────────────────────
interface TexTarget {
  recolor: RecolorTarget;
  slots: Partial<Record<RecolorKey, RecolorRule[]>>;
}

export interface V3WeaponHandle {
  def: V3WeaponDef;
  group: THREE.Group;
}

export interface V3Build {
  root: THREE.Group;
  def: V3BodyDef;
  physique: Physique;
  /** سازگاری با CharacterBuild موتور */
  animations: THREE.AnimationClip[];
  handBones: { l: THREE.Bone | null; r: THREE.Bone | null };
  /** زنجیره‌ی بازو برای IK دست دوم (سلاح دو‌دست) — clavicle برای بُردِ کامل */
  armBones: {
    l: { upper: THREE.Bone | null; lower: THREE.Bone | null; hand: THREE.Bone | null; clavicle: THREE.Bone | null };
    r: { upper: THREE.Bone | null; lower: THREE.Bone | null; hand: THREE.Bone | null; clavicle: THREE.Bone | null };
  };
  chestBone: THREE.Bone | null;
  weapon: V3WeaponHandle | null;
  /** نقطهٔ چنگ دست دوم — فرزند گروه سلاح؛ فقط سلاح دو‌دست با grip2 */
  grip2Target: THREE.Object3D | null;
  /** دست/پشت کردن سلاح */
  setWeaponMode: (mode: 'hand' | 'back') => void;
  getWeaponMode: () => 'hand' | 'back';
  /** توییک نرم چنگ سلاح */
  setGripTweak: (t: { rx?: number; ry?: number; rz?: number; px?: number; py?: number; pz?: number } | null) => void;
  update: (dt: number) => void;
  applyColors: (c: { skin: string; hairColor: string; beardColor: string; cloth: string; metal: string; eye: string }) => void;
  dispose: () => void;
}

const ALL_KEYS: RecolorKey[] = ['skin', 'hair', 'beard', 'cloth', 'metal', 'bone'];

export async function buildV3Character(cfg: CharConfig): Promise<V3Build> {
  const def = V3_BODIES[cfg.body] ?? V3_BODIES.V3_Ranger;
  const phys: Physique = cfg.physique ?? DEFAULT_PHYSIQUE;

  // ── ۱) بدنه‌ی پایه ──
  const root = skeletonClone(await loadGltfScene(`/models/v3/${def.base}.glb`)) as THREE.Group;
  root.name = 'characterRoot';
  const boneMap = findBones(root);

  // متریال مستقل + تکسچر زنده برای بازرنگی
  const targets: TexTarget[] = [];
  const meshMats = new Map<THREE.Mesh, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (!mat?.map) return;
    const src = mat.map;
    const tex = new THREE.Texture(src.image);
    tex.flipY = false; // glTF استاندارد
    tex.colorSpace = src.colorSpace;
    tex.wrapS = src.wrapS; tex.wrapT = src.wrapT;
    tex.needsUpdate = true;
    const m2 = mat.clone(); m2.map = tex; m2.needsUpdate = true;
    fixV3Material(m2, m.name);
    m.material = m2;
    m.castShadow = true; m.frustumCulled = false;
    meshMats.set(m, m2);
  });

  // ── ۲) قطعات مدولار (کیت لباس / مو / ابرو / ریش) ──
  const attach = async (name: string, slot: RecolorKey) => {
    let part: THREE.Group;
    try {
      part = skeletonClone(await loadGltfScene(`/models/v3/${name}.glb`)) as THREE.Group;
    } catch (e) { console.error('[v3] attach load fail', name, e); return; }
    part.updateMatrixWorld(true);
    let found = 0, added = 0;
    part.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      found++;
      if (!m.skeleton) { console.warn('[v3] no skeleton', name, m.name); return; }
      const rebound = rebindSkinned(m, boneMap);
      if (!rebound) { console.error('[v3] rebind fail (bone mismatch)', name, m.name); return; }
      added++;
      const mat = m.material as THREE.MeshStandardMaterial;
      const tex = new THREE.Texture((mat.map as THREE.Texture).image);
      tex.flipY = false; tex.needsUpdate = true;
      // ⚠️ colorSpace باید از مبدأ کپی شود وگرنه sRGB به‌صورت linear
      // تفسیر می‌شود ⇒ همه‌ی رنگ‌ها بیش‌روشنِ صورتی می‌شوند
      tex.colorSpace = (mat.map as THREE.Texture).colorSpace;
      tex.wrapS = (mat.map as THREE.Texture).wrapS;
      tex.wrapT = (mat.map as THREE.Texture).wrapT;
      const m2 = (mat as THREE.MeshStandardMaterial).clone(); m2.map = tex; m2.needsUpdate = true;
      fixV3Material(m2, m.name);
      rebound.material = m2;
      root.add(rebound);
      // تارگت بازرنگی برای این تکسچر — ماسک فقط برای رستر UV لازم است؛
      // ⚠️ reparent موقت باید به root برگردانده شود وگرنه مش حذف می‌شود
      const img = tex.image as HTMLImageElement;
      const W = img.width, H = img.height;
      const maskRoot = new THREE.Group(); maskRoot.add(rebound);
      let masks: MaskSet;
      try { masks = buildPartMasks(maskRoot, W, H); } catch { root.add(rebound); return; }
      root.add(rebound);
      const rt = createRecolorTarget(tex, masks);
      const slotRule: Partial<Record<RecolorKey, RecolorRule[]>> = {};
      if (slot === 'hair') slotRule.hair = [HAIR_RANGE];
      else if (slot === 'beard') slotRule.beard = [HAIR_RANGE];
      else if (slot === 'cloth') { slotRule.cloth = [OUTFIT_CLOTH]; slotRule.metal = [OUTFIT_METAL]; }
      rt.rules = slotRule as RecolorTarget['rules'];
      targets.push({ recolor: rt, slots: slotRule });
    });
    void found; void added;
  };

  const hairMap: Record<string, string> = {
    baked: 'Hair_SimpleParted', short: 'Hair_Buzzed', long: 'Hair_Long',
    ponytail: 'Hair_Buns', mohawk: 'Hair_Buzzed', none: '',
  };
  const hairFile = hairMap[cfg.hair] ?? '';
  const beardFile = cfg.beard === 'none' ? '' : 'Hair_Beard';

  if (def.outfit) await attach(def.outfit, 'cloth');
  if (hairFile && !def.hood) await attach(hairFile, 'hair');
  if (beardFile && !def.hood) await attach(beardFile, 'beard');
  await attach('Eyebrows_Regular', 'hair'); // ابرو با رنگ مو

  // ماسک UV برای هر «تکسچر» یک‌بار — چون متریال‌ها تکسچر جدا دارند،
  // فیلتر نام مش در هر قاعده، ماسک همان تکسچر را برمی‌دارد
  const maskCache3 = new Map<string, MaskSet>();
  for (const [mesh, mat] of meshMats) {
    const img = (mat.map as THREE.Texture).image as HTMLImageElement;
    if (!img?.width) continue;
    const nm = mesh.name.toLowerCase();
    let slots: Partial<Record<RecolorKey, RecolorRule[]>> | null = null;
    if (nm.includes('eye')) slots = { bone: [EYE_RANGE] };
    else if (nm.includes('eyebrow')) slots = { hair: [HAIR_RANGE] };
    else if (nm.includes('superhero') || nm.includes('regular')) slots = { skin: [SKIN_RANGE] };
    if (!slots) continue;
    const key = `${img.width}x${img.height}`;
    let masks = maskCache3.get(key);
    if (!masks) {
      try { masks = buildPartMasks(root, img.width, img.height); } catch { continue; }
      maskCache3.set(key, masks);
    }
    const wanted = Object.values(slots).flat().flatMap((r) => r.parts);
    const filtered: MaskSet = { ...masks, parts: masks.parts.filter((p) =>
      wanted.some((q) => p.name.toLowerCase().includes(q)),
    ) };
    if (!filtered.parts.length) continue;
    const rt = createRecolorTarget(mat.map as THREE.Texture, filtered);
    rt.rules = slots as RecolorTarget['rules'];
    targets.push({ recolor: rt, slots });
  }

  // ── ۴) Reshape + نرمال‌سازی مقیاس و فرود ──
  applyReshape(root, phys);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const rawH = Math.max(0.01, box.max.y - box.min.y);
  const targetH = def.height * cfg.height;
  const s = targetH / rawH;
  root.scale.set(s * cfg.bulk, s, s * cfg.bulk);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y = 0.004 - box2.min.y;
  root.position.x -= (box2.min.x + box2.max.x) / 2;
  root.position.z -= (box2.min.z + box2.max.z) / 2;

  // ── ۵) سلاح (دست / پشت کمر) ──
  const handBones = {
    l: boneMap.get('hand_l') ?? null,
    r: boneMap.get('hand_r') ?? null,
  };
  const armBones = {
    l: {
      upper: boneMap.get('upperarm_l') ?? null,
      lower: boneMap.get('lowerarm_l') ?? null,
      hand: boneMap.get('hand_l') ?? null,
      clavicle: boneMap.get('clavicle_l') ?? null,
    },
    r: {
      upper: boneMap.get('upperarm_r') ?? null,
      lower: boneMap.get('lowerarm_r') ?? null,
      hand: boneMap.get('hand_r') ?? null,
      clavicle: boneMap.get('clavicle_r') ?? null,
    },
  };
  const chestBone = boneMap.get('spine_03') ?? boneMap.get('spine_02') ?? null;
  let weaponMode: 'hand' | 'back' = 'hand';
  let weapon: V3WeaponHandle | null = null;
  let grip2Target: THREE.Object3D | null = null;
  let backWeapon: THREE.Group | null = null;
  const weaponId = def.weapons.includes(cfg.weapon) ? cfg.weapon : def.defaultWeapon;

  if (weaponId !== 'none' && V3_WEAPONS[weaponId]) {
    const wdef = V3_WEAPONS[weaponId];
    const scene = await loadGltfScene(`/models/v3/weapons/${wdef.file}`);
    const group = new THREE.Group();
    group.name = 'v3Weapon';
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      v3SharedGeometries.add(m.geometry);
      const mm = new THREE.Mesh(m.geometry, (m.material as THREE.Material).clone());
      mm.castShadow = true;
      group.add(mm);
    });
    const hand = wdef.hand === 'l' ? handBones.l : handBones.r;
    if (hand) {
      // چنگ داده‌محور از محورهای واقعی اسکلت (پروفایل: gripCenter/roll/pitch)
      const mount = computeGripMount(hand, wdef);
      group.position.copy(mount.pos);
      group.quaternion.copy(mount.quat);
      group.scale.setScalar(wdef.scale);
      hand.add(group);
    }
    weapon = { def: wdef, group };
    // نقطهٔ چنگ دست دوم — فرزند گروه سلاح (خودکار با سلاح/AntiClip حرکت می‌کند)
    if (wdef.twoHanded && wdef.grip2) {
      grip2Target = new THREE.Object3D();
      grip2Target.name = '__grip2__';
      grip2Target.position.set(...wdef.grip2);
      group.add(grip2Target);
    }
    // نسخه‌ی پشت کمر — نصب داده‌محور در فضای جهان (کاراکتر در T-Pose
    // ایستاده است): دسته بالای شانه‌ی راست (-X)، تیغه موازی ستون با
    // شیب کم به چپ (+X)، آفست پشت = عمق سینه + فاصله. تبدیل به قاب
    // استخوان فقط با ماتریس معکوس — بدون حدس محورهای ریگ.
    if (chestBone) {
      backWeapon = group.clone(true);
      backWeapon.name = 'v3WeaponBack';
      backWeapon.visible = false;
      chestBone.updateWorldMatrix(true, false);
      const spineWorld = new THREE.Vector3().setFromMatrixPosition(chestBone.matrixWorld);
      const spineQinv = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().extractRotation(chestBone.matrixWorld),
      ).invert();
      // قاب جهان: up=(0,1,0) — back=(0,0,-1) — راست کاراکتر=(-1,0,0)
      const bladeDir = new THREE.Vector3(0.2, -1, 0).normalize(); // نوک پایین-چپ
      const bladeQ = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), bladeDir,
      );
      // غلت: تخت خوابیدن تیغه روی کمر
      const worldQ = bladeQ.multiply(
        new THREE.Quaternion().setFromAxisAngle(bladeDir, Math.PI / 2),
      );
      const depth = 0.15; // عمق سینه (~10cm) + فاصله
      const originW = spineWorld.clone()
        .add(new THREE.Vector3(-0.06, 0.18, -depth));
      backWeapon.position.copy(originW.clone().sub(spineWorld).applyQuaternion(spineQinv));
      backWeapon.quaternion.copy(spineQinv.clone().multiply(worldQ));
      chestBone.add(backWeapon);
    }
  }

  // ── ۶) توییک چنگ ──
  let gripTweak: { rx?: number; ry?: number; rz?: number; px?: number; py?: number; pz?: number } | null = null;
  const baseP = weapon ? weapon.group.position.clone() : null;
  const baseQ = weapon ? weapon.group.quaternion.clone() : null;
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const update = (dt: number) => {
    if (!weapon || !baseP || !baseQ || weapon.group.parent === null) return;
    if (weapon.group.visible === false) return;
    const k = Math.min(1, dt * 10);
    if (gripTweak) {
      tmpE.set(gripTweak.rx ?? 0, gripTweak.ry ?? 0, gripTweak.rz ?? 0, 'XYZ');
      tmpQ.setFromEuler(tmpE).multiply(baseQ);
      weapon.group.quaternion.slerp(tmpQ, k);
      weapon.group.position.lerp(new THREE.Vector3(
        baseP.x + (gripTweak.px ?? 0), baseP.y + (gripTweak.py ?? 0), baseP.z + (gripTweak.pz ?? 0),
      ), k);
    } else {
      weapon.group.quaternion.slerp(baseQ, k);
      weapon.group.position.lerp(baseP, k);
    }
  };

  // ── ۷) اعمال رنگ ──
  const applyColors = (c: { skin: string; hairColor: string; beardColor: string; cloth: string; metal: string; eye: string }) => {
    const colors: RecolorColors = {
      skin: c.skin, hair: c.hairColor, beard: c.beardColor,
      cloth: c.cloth, metal: c.metal, bone: c.eye,
    };
    for (const t of targets) {
      const keys = Object.keys(t.slots) as RecolorKey[];
      if (!keys.length) continue;
      applyRecolors(t.recolor, colors, { keys });
    }
  };
  applyColors({
    skin: cfg.skin, hairColor: cfg.hairColor, beardColor: cfg.beardColor,
    cloth: cfg.cloth, metal: cfg.metal, eye: (cfg as CharConfig & { eye?: string }).eye ?? '#5a3d20',
  });

  // ── ۸) پاک‌سازی ──
  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !isV3SharedGeometry(m.geometry)) m.geometry.dispose();
      const mat = m.material as THREE.MeshStandardMaterial | undefined;
      if (mat) { mat.map?.dispose(); mat.dispose(); }
    });
  };

  return {
    root, def, physique: phys, handBones, armBones, chestBone, weapon, grip2Target,
    animations: [],
    setWeaponMode: (mode) => {
      weaponMode = mode;
      if (weapon) weapon.group.visible = mode === 'hand';
      if (backWeapon) backWeapon.visible = mode === 'back';
    },
    getWeaponMode: () => weaponMode,
    setGripTweak: (t) => { gripTweak = t; },
    update,
    applyColors,
    dispose,
  };
}

export { ALL_KEYS };

// ─────────────────────────────────────────────────────────────
// کارخانه‌ی شخصیت V3 — اسمبل بدنه‌ی KayKit + Reshape بدن +
// بازرنگی + اجزا + سیستم سلاح دووضعیتی (دست / پشتِ کمر)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { BODIES, loadBody, isSharedGeometry, type BodyDef, type BodyId } from './kaykit';
import {
  buildPartMasks, createRecolorTarget, applyRecolors,
  type RecolorTarget, type RecolorColors, type RecolorKey, type MaskSet,
} from './recolor';
import {
  buildHair, buildBeard, buildElfEars, buildTusks,
  measureHeadFrameSkinned, type HeadFrame, type FeatureMats, type HairStyleId, type BeardStyleId,
} from './featuresKaykit';
import { applyReshape, DEFAULT_PHYSIQUE, type Physique } from './reshape';
import { RACES, type CharConfig } from './types';

export type { BodyDef, BodyId, RecolorTarget, FeatureMats, HairStyleId, BeardStyleId, Physique };

// ارتفاع هدف هر بدنه (متر) — قبل از ضریب قد کاربر
// A22 — اکسپورت شده تا UI همان عدد موتور را نمایش دهد
export const TARGET_HEIGHT: Record<string, number> = {
  Rogue: 1.78, Knight: 1.78, Barbarian: 1.8, Mage: 1.76, Rogue_Hooded: 1.78,
  Skeleton_Warrior: 1.68, Skeleton_Minion: 1.15,
};

export type WeaponMode = 'hand' | 'back';

/** توییک چنگ‌زدن سلاح برای انیمیشن‌های خاص (ریتارگت‌شده) */
export interface GripTweak {
  rx?: number; ry?: number; rz?: number;
  px?: number; py?: number; pz?: number;
}

export interface CharacterBuild {
  root: THREE.Group;
  def: BodyDef;
  animations: THREE.AnimationClip[];
  recolor: RecolorTarget;
  featureMats: FeatureMats;
  headFrame: HeadFrame;
  physique: Physique;
  /** دست/پشت کردن سلاح فعال */
  setWeaponMode: (mode: WeaponMode) => void;
  getWeaponMode: () => WeaponMode;
  /** توییک نرم چنگ سلاح (lerp در update) */
  setGripTweak: (t: GripTweak | null) => void;
  /** هر فریم — لرپ به سمت توییک هدف */
  update: (dt: number) => void;
  /** بازرنگی سریع بدون بازسازی (رنگ پوست/مو/جامه/فلز/استخوان) */
  applyColors: (cfg: CharConfig) => void;
  dispose: () => void;
}

const ALL_KEYS: RecolorKey[] = ['skin', 'hair', 'beard', 'cloth', 'metal', 'bone'];

function findBone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.Bone).isBone && o.name === name) found = o as THREE.Bone;
  });
  return found;
}

function colorsFromCfg(cfg: CharConfig): RecolorColors {
  return {
    skin: cfg.skin, hair: cfg.hairColor, beard: cfg.beardColor, cloth: cfg.cloth,
    metal: cfg.metal, bone: cfg.bone,
  };
}

// ── کش ماسک UV هر بدنه (بازسازی‌ها را ارزان می‌کند) ──────────
const maskCache = new Map<BodyId, MaskSet>();

export async function buildKaykitCharacter(cfg: CharConfig): Promise<CharacterBuild> {
  const loaded = await loadBody(cfg.body);
  const def = loaded.def;
  const phys: Physique = cfg.physique ?? DEFAULT_PHYSIQUE;
  const root = skeletonClone(loaded.pristine) as THREE.Group;
  root.name = 'characterRoot';

  // ── ۱) Reshape اسکلتی (ضدچیبی + اسلایدرهای اندام) ──
  // فقط scale استخوان‌ها — پایدار زیر انیمیشن؛ فرود خودکار با bbox
  applyReshape(root, phys);

  // ── ۲) نرمال‌سازی مقیاس و قرارگیری روی زمین ──
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const rawH = Math.max(0.01, box.max.y - box.min.y);
  const targetH = (TARGET_HEIGHT[def.id] ?? 1.78) * cfg.height;
  const s = targetH / rawH;
  root.scale.set(s * cfg.bulk, s, s * cfg.bulk);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y = 0.004 - box2.min.y;
  const cx = (box2.min.x + box2.max.x) / 2;
  const cz = (box2.min.z + box2.max.z) / 2;
  root.position.x -= cx;
  root.position.z -= cz;

  // ── ۳) متریال و تکسچر اختصاصی (برای بازرنگی بدون نشت به کش) ──
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  let texture: THREE.Texture | null = null;
  let material: THREE.MeshStandardMaterial | null = null;
  for (const m of meshes) {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat?.map && !texture) {
      // تکسچر مستقل با تصویر اصلی —clone کردن Source را با pristine به‌اشتراک
      // می‌گذارد و بازرنگی‌ها بین بیلدها نشت می‌کنند؛ پس تکسچر تازه می‌سازیم
      const src = mat.map;
      texture = new THREE.Texture(src.image);
      texture.name = src.name;
      texture.flipY = src.flipY;
      texture.colorSpace = src.colorSpace;
      texture.wrapS = src.wrapS;
      texture.wrapT = src.wrapT;
      texture.magFilter = src.magFilter;
      texture.minFilter = src.minFilter;
      texture.generateMipmaps = src.generateMipmaps;
      texture.needsUpdate = true;
      material = mat.clone();
      material.map = texture;
      material.needsUpdate = true;
    }
    if (material) m.material = material;
    m.castShadow = true;
    m.receiveShadow = false;
  }

  // ── ۴) ماسک‌ها (کش‌شده per body) + بازرنگی ──
  const texImg = texture!.image as HTMLImageElement;
  let masks = maskCache.get(def.id);
  if (!masks || masks.texWidth !== texImg.width || masks.texHeight !== texImg.height) {
    masks = buildPartMasks(root, texImg.width, texImg.height);
    maskCache.set(def.id, masks);
  }
  const recolor = createRecolorTarget(texture!, masks);
  recolor.rules = def.rules as RecolorTarget['rules'];

  // ── ۵) سلاح‌ها و اکسسوری‌ها ──
  const byName = new Map<string, THREE.Object3D[]>();
  root.traverse((o) => {
    const list = byName.get(o.name) ?? [];
    list.push(o);
    byName.set(o.name, list);
  });
  const setVis = (name: string, visible: boolean) => {
    for (const o of byName.get(name) ?? []) {
      (o as THREE.Mesh).visible = visible;
      (o as THREE.Mesh).castShadow = visible;
    }
  };
  // قانون: همه‌ی مش‌های سخت (غیر Skinned) پیش‌فرض مخفی — بعداً سلاح فعال/کلاه/شنل روشن می‌شوند
  const toggleNodes = new Set<string>();
  if (def.helmet) def.helmet.nodes.forEach((n) => toggleNodes.add(n));
  if (def.cape) def.cape.nodes.forEach((n) => toggleNodes.add(n));
  const activeWeapon = def.weapons.find((w) => w.id === cfg.weapon) ?? def.weapons.find((w) => w.id === def.defaultWeapon) ?? def.weapons[0];
  const weaponNodes = new Set<string>(activeWeapon?.nodes ?? []);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh && !toggleNodes.has(o.name)) {
      mesh.visible = weaponNodes.has(o.name);
      mesh.castShadow = mesh.visible;
    }
  });
  if (def.helmet) def.helmet.nodes.forEach((n) => setVis(n, cfg.helmet));
  if (def.cape) def.cape.nodes.forEach((n) => setVis(n, cfg.cape));

  // ── ۶) سیستم دووضعیتی سلاح: نسخه‌ی «پشت کمر» روی استخوان chest ──
  const chestBone = (byName.get('chest')?.find((o) => (o as THREE.Bone).isBone)
    ?? byName.get('chest')?.[0] ?? null) as THREE.Bone | null;
  interface WeaponPair { hand: THREE.Object3D; back: THREE.Object3D | null; baseP: THREE.Vector3; baseQ: THREE.Quaternion }
  const pairs: WeaponPair[] = [];
  for (const nodeName of activeWeapon?.nodes ?? []) {
    for (const handNode of byName.get(nodeName) ?? []) {
      const baseP = handNode.position.clone();
      const baseQ = handNode.quaternion.clone();
      let back: THREE.Object3D | null = null;
      if (chestBone) {
        back = handNode.clone();
        back.name = `${nodeName}__back`;
        back.visible = false;
        // نصب مورب روی کمر — دستگیره کنار کتف راست، تیغه رو به پایین-چپ
        const idx = pairs.length;
        back.position.set(0.015 - idx * 0.012, -0.005 - idx * 0.025, -0.085);
        back.rotation.set(0.18, 0.08, -2.5 + idx * 0.14);
        chestBone.add(back);
        back.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.castShadow = false; mm.visible = false; } });
      }
      pairs.push({ hand: handNode, back, baseP, baseQ });
    }
  }
  let weaponMode: WeaponMode = 'hand';
  const applyMode = () => {
    for (const p of pairs) {
      p.hand.visible = weaponMode === 'hand';
      p.hand.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.castShadow = weaponMode === 'hand'; });
      if (p.back) {
        p.back.visible = weaponMode === 'back';
        p.back.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.castShadow = weaponMode === 'back'; });
      }
    }
  };

  // توییک چنگ — هدف lerp می‌شود تا پرش نکند
  let gripTweak: GripTweak | null = null;
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const update = (dt: number) => {
    const k = Math.min(1, dt * 10);
    for (const p of pairs) {
      if (weaponMode !== 'hand') continue;
      if (gripTweak) {
        tmpE.set(gripTweak.rx ?? 0, gripTweak.ry ?? 0, gripTweak.rz ?? 0, 'XYZ');
        tmpQ.setFromEuler(tmpE).multiply(p.baseQ);
        p.hand.quaternion.slerp(tmpQ, k);
        p.hand.position.lerp(new THREE.Vector3(
          p.baseP.x + (gripTweak.px ?? 0),
          p.baseP.y + (gripTweak.py ?? 0),
          p.baseP.z + (gripTweak.pz ?? 0),
        ), k);
      } else {
        p.hand.quaternion.slerp(p.baseQ, k);
        p.hand.position.lerp(p.baseP, k);
      }
    }
  };

  // ── ۷) قاب سر + اجزای چهره ──
  // ⚠️ قاب از رئوس تغییرشکل‌یافته (skinning واقعی) اندازه‌گیری می‌شود تا
  // با سرِ رندرشده در همان کلون reshape شده دقیقاً یکی باشد.
  const headBone = findBone(root, 'head');
  const headMeshes: THREE.Mesh[] = meshes.filter((m) => /head/i.test(m.name) && !/helmet|hat/i.test(m.name));
  const headFrame: HeadFrame = headBone
    ? measureHeadFrameSkinned(headMeshes, headBone)
    : {
        bone: null as unknown as THREE.Bone,
        size: new THREE.Vector3(0.42, 0.4, 0.4),
        center: new THREE.Vector3(0, 0.2, 0),
        bottomY: 0, frontZ: 0.2,
      };

  const featureMats: FeatureMats = {
    hair: new THREE.MeshStandardMaterial({ color: cfg.hairColor, roughness: 0.65, flatShading: true }),
    // A12 — متریال مستقل ریش
    beard: new THREE.MeshStandardMaterial({ color: cfg.beardColor, roughness: 0.7, flatShading: true }),
    skin: new THREE.MeshStandardMaterial({ color: cfg.skin, roughness: 0.7, flatShading: true }),
    ivory: new THREE.MeshStandardMaterial({ color: '#e6dcc3', roughness: 0.45, flatShading: true }),
  };
  [featureMats.hair, featureMats.beard, featureMats.skin, featureMats.ivory].forEach((m) => { m.envMapIntensity = 0.5; });

  const refreshFeatures = () => {
    // پاک‌سازی اجزای قبلی
    for (const nm of ['proceduralHair', 'proceduralBeard', 'elfEars', 'orcTusks']) {
      const old = headBone?.children.find((c) => c.name === nm);
      if (old) {
        old.traverse((o) => { const mm = o as THREE.Mesh; if (mm.geometry) mm.geometry.dispose(); });
        old.parent?.remove(old);
      }
    }
    if (!headBone) return;
    const hair = buildHair(cfg.hair, headFrame, featureMats.hair);
    // A12 — ریش با متریال مستقل
    const beard = buildBeard(cfg.beard, headFrame, featureMats.beard);
    if (cfg.ears) headBone.add(buildElfEars(headFrame, featureMats.skin));
    if (cfg.tusks) headBone.add(buildTusks(headFrame, featureMats.ivory));
    if (hair.children.length) headBone.add(hair);
    if (beard.children.length) headBone.add(beard);
  };
  refreshFeatures();

  // ── ۸) اعمال رنگ ──
  const applyColors = (next: CharConfig) => {
    applyRecolors(recolor, colorsFromCfg(next), {
      eraseHair: next.hair !== 'baked' && def.hairErasable,
      eraseBeard: next.beard !== 'baked' && def.beardErasable,
      keys: ALL_KEYS,
    });
    featureMats.hair.color.set(next.hairColor);
    // A12 — رنگ ریش مستقل از مو
    featureMats.beard.color.set(next.beardColor);
    featureMats.skin.color.set(next.skin);
  };
  applyColors(cfg);

  // A20 — فقط منابع اختصاصی همین نمونه آزاد می‌شوند؛
  // هندسه‌های اشتراکی با کش body دست نمی‌خورند
  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !isSharedGeometry(m.geometry)) m.geometry.dispose();
    });
    material?.dispose();
    texture?.dispose();
    Object.values(featureMats).forEach((m) => m.dispose());
  };

  return {
    root, def, animations: loaded.animations, recolor, featureMats, headFrame, physique: phys,
    setWeaponMode: (mode) => { weaponMode = mode; applyMode(); },
    getWeaponMode: () => weaponMode,
    setGripTweak: (t) => { gripTweak = t; },
    update,
    applyColors,
    dispose,
  };
}

export { BODIES, RACES, loadBody };

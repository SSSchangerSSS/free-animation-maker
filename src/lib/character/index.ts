// ─────────────────────────────────────────────────────────────
// کارخانه‌ی شخصیت V2 — اسمبل بدنه‌ی KayKit + بازرنگی + اجزا
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { BODIES, loadBody, type BodyDef, type BodyId } from './kaykit';
import {
  buildPartMasks, createRecolorTarget, applyRecolors,
  type RecolorTarget, type RecolorColors, type RecolorKey,
} from './recolor';
import {
  buildHair, buildBeard, buildElfEars, buildTusks,
  measureHeadFrame, type HeadFrame, type FeatureMats, type HairStyleId, type BeardStyleId,
} from './featuresKaykit';
import { RACES, type CharConfig } from './types';

export type { BodyDef, BodyId, RecolorTarget, FeatureMats, HairStyleId, BeardStyleId };

// ارتفاع هدف هر بدنه (متر) — قبل از ضریب قد کاربر
const TARGET_HEIGHT: Record<string, number> = {
  Rogue: 1.78, Knight: 1.78, Barbarian: 1.8, Mage: 1.76, Rogue_Hooded: 1.78,
  Skeleton_Warrior: 1.68, Skeleton_Minion: 1.15,
};

export interface CharacterBuild {
  root: THREE.Group;
  def: BodyDef;
  animations: THREE.AnimationClip[];
  recolor: RecolorTarget;
  featureMats: FeatureMats;
  headFrame: HeadFrame;
  /** بازرنگی سریع بدون بازسازی (رنگ پوست/مو/جامه/فلز/استخوان) */
  applyColors: (cfg: CharConfig) => void;
  dispose: () => void;
}

const ALL_KEYS: RecolorKey[] = ['skin', 'hair', 'cloth', 'metal', 'bone'];

function colorsFromCfg(cfg: CharConfig): RecolorColors {
  return {
    skin: cfg.skin, hair: cfg.hairColor, cloth: cfg.cloth,
    metal: cfg.metal, bone: cfg.bone,
  };
}

export async function buildKaykitCharacter(cfg: CharConfig): Promise<CharacterBuild> {
  const loaded = await loadBody(cfg.body);
  const def = loaded.def;
  const root = skeletonClone(loaded.pristine) as THREE.Group;
  root.name = 'characterRoot';

  // ── نرمال‌سازی مقیاس و قرارگیری روی زمین ──
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

  // ── متریال و تکسچر اختصاصی (برای بازرنگی بدون نشت به کش) ──
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

  // ── ماسک‌ها + بازرنگی ──
  const texImg = texture!.image as HTMLImageElement;
  const masks = buildPartMasks(root, texImg.width, texImg.height);
  const recolor = createRecolorTarget(texture!, masks);
  recolor.rules = def.rules as RecolorTarget['rules'];

  // ── سلاح‌ها و اکسسوری‌ها ──
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


  // ── قاب سر + اجزای چهره ──
  const headBone = (byName.get('head')?.[0] ?? null) as THREE.Bone | null;
  const headMeshes = meshes.filter((m) => /head/i.test(m.name) && !/helmet|hat/i.test(m.name));
  const headFrame: HeadFrame = headBone
    ? measureHeadFrame(headBone, headMeshes)
    : {
        bone: null as unknown as THREE.Bone,
        size: new THREE.Vector3(0.42, 0.4, 0.4),
        center: new THREE.Vector3(0, 0.2, 0),
        bottomY: 0, frontZ: 0.2,
      };

  const featureMats: FeatureMats = {
    hair: new THREE.MeshStandardMaterial({ color: cfg.hairColor, roughness: 0.65, flatShading: true }),
    skin: new THREE.MeshStandardMaterial({ color: cfg.skin, roughness: 0.7, flatShading: true }),
    ivory: new THREE.MeshStandardMaterial({ color: '#e6dcc3', roughness: 0.45, flatShading: true }),
  };
  [featureMats.hair, featureMats.skin, featureMats.ivory].forEach((m) => { m.envMapIntensity = 0.5; });

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
    const beard = buildBeard(cfg.beard, headFrame, featureMats.hair);
    if (cfg.ears) headBone.add(buildElfEars(headFrame, featureMats.skin));
    if (cfg.tusks) headBone.add(buildTusks(headFrame, featureMats.ivory));
    if (hair.children.length) headBone.add(hair);
    if (beard.children.length) headBone.add(beard);
  };
  refreshFeatures();

  // ── اعمال رنگ ──
  const applyColors = (next: CharConfig) => {
    applyRecolors(recolor, colorsFromCfg(next), {
      eraseHair: next.hair !== 'baked' && def.hairErasable,
      eraseBeard: next.beard !== 'baked' && def.beardErasable,
      keys: ALL_KEYS,
    });
    featureMats.hair.color.set(next.hairColor);
    featureMats.skin.color.set(next.skin);
  };
  applyColors(cfg);

  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    material?.dispose();
    texture?.dispose();
    Object.values(featureMats).forEach((m) => m.dispose());
  };

  return { root, def, animations: loaded.animations, recolor, featureMats, headFrame, applyColors, dispose };
}

export { BODIES, RACES };

// ─────────────────────────────────────────────────────────────
// کارخانه‌ی شخصیت — اسکلت + بدن اسکین‌شده + اجزای چهره
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createSkeleton } from './skeleton';
import { buildBody, MATERIAL_KEYS, type MatKey } from './body';
import { buildFeatures } from './features';
import { buildWeapons, type WeaponMats } from './weapons';
import { RACES, type CharConfig } from './types';

export type CharacterMaterials = {
  skin: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  beard: THREE.MeshStandardMaterial;
  beardSoft: THREE.MeshStandardMaterial;
  eyeWhite: THREE.MeshStandardMaterial;
  iris: THREE.MeshStandardMaterial;
  ivory: THREE.MeshStandardMaterial;
} & Record<MatKey, THREE.MeshStandardMaterial>;

export interface CharacterBuild {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  materials: CharacterMaterials;
  dispose: () => void;
}

function std(color: string, rough: number, metal = 0): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  m.envMapIntensity = 0.55;
  return m;
}

export function createCharacterMaterials(cfg: CharConfig): CharacterMaterials {
  return {
    skin: std(cfg.skin, 0.68),
    outfit: std(cfg.outfit, 0.78),
    pants: std(cfg.pants, 0.8),
    boots: std(cfg.boots, 0.55),
    metal: std(cfg.metal, 0.32, 0.85),
    hair: std(cfg.hairColor, 0.52),
    beard: std(cfg.beardColor, 0.52),
    beardSoft: Object.assign(std(cfg.beardColor, 0.7), { transparent: true, opacity: 0.5 }),
    eyeWhite: std('#f2efe6', 0.25),
    iris: std(cfg.eyes, 0.2),
    ivory: std('#e6dcc3', 0.4),
  };
}

export function updateCharacterMaterials(mats: CharacterMaterials, cfg: CharConfig) {
  mats.skin.color.set(cfg.skin);
  mats.outfit.color.set(cfg.outfit);
  mats.pants.color.set(cfg.pants);
  mats.boots.color.set(cfg.boots);
  mats.metal.color.set(cfg.metal);
  mats.hair.color.set(cfg.hairColor);
  mats.beard.color.set(cfg.beardColor);
  mats.beardSoft.color.set(cfg.beardColor);
  mats.iris.color.set(cfg.eyes);
}

export function buildCharacter(cfg: CharConfig): CharacterBuild {
  const race = RACES[cfg.race];
  const mats = createCharacterMaterials(cfg);

  // مقیاس‌ها: قد کاربر روی hips، مقیاس‌های نژاد روی استخوان‌ها
  const skeleton = createSkeleton(race.boneScales, cfg.height);

  const boneIndex: Record<string, number> = {};
  skeleton.bones.forEach((b, i) => { boneIndex[b.name] = i; });

  const body = buildBody(
    { race, width: cfg.bulk * race.width },
    boneIndex,
    mats as unknown as Record<MatKey, THREE.Material>,
  );

  const mesh = new THREE.SkinnedMesh(body.geometry, body.materials);
  mesh.name = 'characterBody';
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.add(skeleton.rootBone);
  mesh.bind(skeleton.skeleton);

  buildFeatures(race, cfg, mats, skeleton.byName.head);
  buildWeapons(cfg, mats as unknown as WeaponMats, skeleton.byName);

  const root = new THREE.Group();
  root.name = 'characterRoot';
  root.add(mesh);

  // اصلاح ارتفاع: کف پا روی زمین (بعد از اعمال مقیاس‌های نژادی)
  root.updateMatrixWorld(true);
  const foot = skeleton.byName.footL;
  const fp = new THREE.Vector3();
  const fq = new THREE.Quaternion();
  const fs = new THREE.Vector3();
  foot.matrixWorld.decompose(fp, fq, fs);
  const soleY = fp.y - 0.0825 * fs.y; // کف کفش در حالت مرجع 0.0825m زیر استخوان پاست
  root.position.y = 0.005 - soleY;

  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    Object.values(mats).forEach((m) => m.dispose());
  };

  return { root, mesh, materials: mats, dispose };
}

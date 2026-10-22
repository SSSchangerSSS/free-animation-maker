// ─────────────────────────────────────────────────────────────
// اجزای چهره — مو، ریش، گوش، چشم، عاج، بینی، ابرو
// همه به استخوان head وصل می‌شوند (مختصات محلی نسبت به origin سر)
// مبدأ استخوان head در T-Pose: (0, 1.60, 0)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CharConfig, RacePreset } from './types';

type Mats = {
  skin: THREE.Material;
  hair: THREE.Material;
  beard: THREE.Material;
  beardSoft: THREE.Material; // ته‌ریش نیمه‌شفاف
  eyeWhite: THREE.Material;
  iris: THREE.Material;
  ivory: THREE.Material;
};

function sphereG(rx: number, ry: number, rz: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 20, 14);
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g;
}
function boxG(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, rz = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}
function coneG(r: number, h: number, x: number, y: number, z: number, dir: THREE.Vector3): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, 10);
  g.translate(0, h / 2, 0); // مبدأ در قاعده
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(x, y, z);
  return g;
}
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (list.length === 1) return list[0];
  const out = mergeGeometries(list, false)!;
  list.forEach((g) => g.dispose());
  return out;
}

const HAIR_CAP = [0, 0.072, -0.006];

function buildHair(style: CharConfig['hair'], mats: Mats): { geo: THREE.BufferGeometry; mat: THREE.Material }[] {
  const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  if (style === 'none') return out;
  const cap = sphereG(0.121, 0.128, 0.124, HAIR_CAP[0], HAIR_CAP[1], HAIR_CAP[2]);
  const fringe = boxG(0.135, 0.05, 0.038, 0, 0.13, 0.082, -0.32);

  if (style === 'short') {
    out.push({ geo: merge([cap, fringe]), mat: mats.hair });
  } else if (style === 'long') {
    const back = boxG(0.175, 0.3, 0.058, 0, -0.06, -0.088, 0.16);
    const strandL = boxG(0.042, 0.27, 0.052, 0.099, -0.035, 0.012, 0, 0.06);
    const strandR = boxG(0.042, 0.27, 0.052, -0.099, -0.035, 0.012, 0, -0.06);
    out.push({ geo: merge([cap, fringe, back, strandL, strandR]), mat: mats.hair });
  } else if (style === 'ponytail') {
    const tail = new THREE.CapsuleGeometry(0.034, 0.17, 6, 10);
    tail.rotateX(-0.55);
    tail.translate(0, -0.015, -0.125);
    const tie = sphereG(0.047, 0.042, 0.045, 0, 0.05, -0.104);
    out.push({ geo: merge([cap, fringe, tail, tie]), mat: mats.hair });
  } else if (style === 'mohawk') {
    const m1 = boxG(0.032, 0.085, 0.17, 0, 0.175, -0.035, 0.12);
    const m2 = boxG(0.03, 0.075, 0.1, 0, 0.165, 0.055, -0.3);
    const m3 = boxG(0.026, 0.055, 0.06, 0, 0.21, -0.1, 0.4);
    out.push({ geo: merge([m1, m2, m3]), mat: mats.hair });
  }
  return out;
}

function buildBeard(style: CharConfig['beard'], mats: Mats): { geo: THREE.BufferGeometry; mat: THREE.Material }[] {
  const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  if (style === 'none') return out;
  if (style === 'stubble') {
    out.push({ geo: boxG(0.118, 0.06, 0.035, 0, 0.005, 0.093, -0.22), mat: mats.beardSoft });
  } else if (style === 'full') {
    const main = sphereG(0.08, 0.058, 0.07, 0, -0.022, 0.058);
    const chin = sphereG(0.05, 0.045, 0.045, 0, -0.045, 0.078);
    const mustache = boxG(0.09, 0.022, 0.03, 0, 0.022, 0.098, -0.15);
    out.push({ geo: merge([main, chin, mustache]), mat: mats.beard });
  } else if (style === 'long') {
    const main = sphereG(0.08, 0.06, 0.072, 0, -0.022, 0.056);
    const mustache = boxG(0.09, 0.022, 0.03, 0, 0.022, 0.098, -0.15);
    const slab = boxG(0.098, 0.2, 0.05, 0, -0.15, 0.062, 0.1);
    const tip = sphereG(0.05, 0.06, 0.028, 0, -0.26, 0.075);
    out.push({ geo: merge([main, mustache, slab, tip]), mat: mats.beard });
  }
  return out;
}

export function buildFeatures(race: RacePreset, cfg: CharConfig, mats: Mats, headBone: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.name = 'faceFeatures';

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    group.add(m);
  };

  // چشم‌ها (بیرون سطح جمجمه)
  for (const s of [1, -1] as const) {
    add(sphereG(0.02, 0.021, 0.015, s * 0.043, 0.076, 0.106), mats.eyeWhite);
    add(sphereG(0.0105, 0.0105, 0.007, s * 0.045, 0.076, 0.1185), mats.iris);
  }

  // ابروها (کمی بیرون‌زده از پیشانی)
  add(boxG(0.055, 0.013, 0.024, 0.045, 0.107, 0.102, 0, -0.14), mats.hair);
  add(boxG(0.055, 0.013, 0.024, -0.045, 0.107, 0.102, 0, 0.14), mats.hair);

  // بینی
  add(coneG(0.016, 0.058, 0, 0.058, 0.104, new THREE.Vector3(0, -0.35, 1)), mats.skin);

  // گوش‌ها
  if (race.elfEars) {
    add(coneG(0.023, 0.17, 0.094, 0.072, -0.014, new THREE.Vector3(0.85, 0.5, -0.32)), mats.skin);
    add(coneG(0.023, 0.17, -0.094, 0.072, -0.014, new THREE.Vector3(-0.85, 0.5, -0.32)), mats.skin);
  } else {
    const earScale = race.id === 'orc' ? [0.62, 1.35, 0.95] : [0.72, 1.1, 0.9];
    for (const s of [1, -1] as const) {
      const g = sphereG(0.027 * earScale[0], 0.027 * earScale[1], 0.027 * earScale[2], s * 0.109, 0.056, -0.008);
      if (race.id === 'orc') {
        g.rotateZ(s * -0.35);
      }
      add(g, mats.skin);
    }
  }

  // عاج‌های ارگی (جلوی آرواره)
  if (race.tusks) {
    add(coneG(0.012, 0.055, 0.04, 0.008, 0.108, new THREE.Vector3(0.28, 1, 0.4)), mats.ivory);
    add(coneG(0.012, 0.055, -0.04, 0.008, 0.108, new THREE.Vector3(-0.28, 1, 0.4)), mats.ivory);
  }

  // مو و ریش
  for (const h of buildHair(cfg.hair, mats)) add(h.geo, h.mat);
  for (const b of buildBeard(cfg.beard, mats)) add(b.geo, b.mat);

  headBone.add(group);
  return group;
}

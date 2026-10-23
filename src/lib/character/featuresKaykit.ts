// ─────────────────────────────────────────────────────────────
// اجزای چهره‌ی رویه‌ای به سبک KayKit (چندضلعی chunky با flatShading)
// مو، ریش، گوش الف، عاج ارگ — parent به استخوان head
//
// ⚠️ قاب سر باید از بدنه‌ی pristine اندازه‌گیری شود (bind pose) —
// مختصات محلی نسبت به استخوان head در کلون reshape شده یکسان می‌ماند.
// هندسه‌ها بر اساس نسبت قاب: s = اندازه سر، c = مرکز جمجمه،
// top = سقف جمجمه، bottomY = کف جمجمه (بعد از حذف گردن).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export type HairStyleId = 'baked' | 'none' | 'short' | 'long' | 'ponytail' | 'mohawk';
export type BeardStyleId = 'baked' | 'none' | 'stubble' | 'full' | 'long';

export interface HeadFrame {
  /** مبدأ محلی استخوان head */
  bone: THREE.Object3D;
  /** اندازه تقریبی سر (متر) */
  size: THREE.Vector3;
  /** مرکز جم skullه نسبت به استخوان (محلی) — بالای فک */
  center: THREE.Vector3;
  /** کف جمجمه (برای فک/ریش) */
  bottomY: number;
  /** جلوی صورت (برای عاج/سبیل) */
  frontZ: number;
}

export interface FeatureMats {
  hair: THREE.MeshStandardMaterial;
  /** متریال مستقل ریش — رنگ ریش دیگر روی مو اثر نمی‌گذارد (A12) */
  beard: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  ivory: THREE.MeshStandardMaterial;
}

function chunk(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.frustumCulled = false;
  return m;
}

function faceted(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  // چندضلعی‌های تخت به سبک low-poly
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// ── ساخت موها ────────────────────────────────────────────────
export function buildHair(style: HairStyleId, frame: HeadFrame, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'proceduralHair';
  if (style === 'baked' || style === 'none') return g;

  const s = frame.size;
  const c = frame.center;
  const r = s.x * 0.5;                 // شعاع جمجمه
  const top = c.y + s.y * 0.5;         // سقف جمجمه

  // کلاه پایه — کالیبره روی سر Knight: گنبد روی جمجمه، لبه بالای پیشانی
  const cap = (thetaLength: number, sy: number, zOff: number) => {
    const m = chunk(faceted(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, thetaLength)), mat);
    m.position.set(c.x, top - r * 0.06, c.z + s.z * zOff);
    m.scale.set(1.13, sy, 1.18);
    return m;
  };

  if (style === 'short') {
    g.add(cap(Math.PI * 0.46, 0.5, 0.02));
  } else if (style === 'long') {
    g.add(cap(Math.PI * 0.52, 0.58, 0.04));
    // توده‌ی پشت مو — از پشت سر آویزان
    const back = chunk(faceted(new THREE.SphereGeometry(r * 0.5, 7, 5)), mat);
    back.position.set(c.x, c.y - s.y * 0.38, c.z - s.z * 0.55);
    back.scale.set(1.1, 1.75, 0.6);
    g.add(back);
  } else if (style === 'ponytail') {
    g.add(cap(Math.PI * 0.46, 0.5, 0.03));
    const tail = chunk(faceted(new THREE.IcosahedronGeometry(r * 0.3, 0)), mat);
    tail.position.set(c.x, c.y - s.y * 0.05, c.z - s.z * 0.62);
    tail.scale.set(0.85, 2.3, 0.85);
    tail.rotation.x = 0.25;
    g.add(tail);
  } else if (style === 'mohawk') {
    const rows = 5;
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1) - 0.5;
      const h = r * (i === 0 || i === rows - 1 ? 0.7 : 1.25 - Math.abs(t) * 0.7);
      const spike = chunk(faceted(new THREE.ConeGeometry(r * 0.14, h, 4)), mat);
      spike.position.set(c.x, top + h * 0.22, c.z + t * s.z * 0.72);
      g.add(spike);
    }
    const base = chunk(faceted(new THREE.BoxGeometry(r * 0.28, s.y * 0.18, s.z * 0.78)), mat);
    base.position.set(c.x, top - s.y * 0.06, c.z);
    g.add(base);
  }
  return g;
}

// ── ساخت ریش ─────────────────────────────────────────────────
// نوار پایین جمجمه (بول باز) — دهان باز می‌ماند؛ سبیل جلوی لب بالا.
export function buildBeard(style: BeardStyleId, frame: HeadFrame, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'proceduralBeard';
  if (style === 'baked' || style === 'none') return g;

  const s = frame.size;
  const r = s.x * 0.5;
  const c = frame.center;
  // ⚠️ mouthY با کالیبراسیون دیداری تنظیم شده (bottomY قاب بعد از حذف گردن است،
  // نه چانه — مقدار واقعی دهان پایین‌تر است)
  const mouthY = frame.bottomY + s.y * 0.26;
  const mouthZ = frame.frontZ;

  const bowl = (thetaStart: number, thetaLength: number, sy: number, yOff: number, zOff: number, rr = 1.03) => {
    const m = chunk(faceted(new THREE.SphereGeometry(r * rr, 9, 6, 0, Math.PI * 2, thetaStart, thetaLength)), mat);
    m.position.set(c.x, mouthY - s.y * 0.34 + s.y * yOff, c.z + s.z * zOff);
    m.scale.set(1.05, sy, 1.0);
    return m;
  };
  const mustache = () => {
    const m = chunk(faceted(new THREE.BoxGeometry(r * 0.72, s.y * 0.09, r * 0.24)), mat);
    m.position.set(c.x, mouthY - s.y * 0.41, mouthZ - r * 0.02);
    return m;
  };

  if (style === 'stubble') {
    g.add(bowl(Math.PI * 0.58, Math.PI * 0.24, 1.1, 0.04, 0.14));
  } else if (style === 'full') {
    g.add(bowl(Math.PI * 0.55, Math.PI * 0.3, 1.12, 0.0, 0.13));
    g.add(mustache());
  } else if (style === 'long') {
    g.add(bowl(Math.PI * 0.55, Math.PI * 0.3, 1.12, 0.0, 0.13));
    // ریش بلند — مخروطی از چانه به پایین سینه
    const hang = chunk(faceted(new THREE.ConeGeometry(r * 0.42, s.y * 1.15, 5)), mat);
    hang.position.set(c.x, mouthY - s.y * 0.75, c.z + s.z * 0.26);
    hang.rotation.x = Math.PI - 0.12;
    g.add(hang);
    g.add(mustache());
  }
  return g;
}

// ── گوش الف ──────────────────────────────────────────────────
export function buildElfEars(frame: HeadFrame, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'elfEars';
  const s = frame.size;
  const r = s.x * 0.5;
  const c = frame.center;
  for (const side of [-1, 1]) {
    const ear = chunk(faceted(new THREE.ConeGeometry(r * 0.2, r * 0.85, 4)), mat);
    ear.position.set(c.x + side * s.x * 0.5, c.y + s.y * 0.12, c.z - s.z * 0.02);
    ear.rotation.z = side * (Math.PI / 2 - 0.25);
    ear.rotation.y = side * 0.25;
    g.add(ear);
  }
  return g;
}

// ── عاج ارک ──────────────────────────────────────────────────
export function buildTusks(frame: HeadFrame, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'orcTusks';
  const s = frame.size;
  const r = s.x * 0.5;
  const c = frame.center;
  const mouthY = frame.bottomY + s.y * 0.3;
  for (const side of [-1, 1]) {
    const tusk = chunk(faceted(new THREE.ConeGeometry(r * 0.085, r * 0.42, 5)), mat);
    tusk.position.set(c.x + side * r * 0.34, mouthY, frame.frontZ - r * 0.04);
    tusk.rotation.z = side * -0.12;
    tusk.rotation.x = -0.06;
    g.add(tusk);
  }
  return g;
}

// ── اندازه‌گیری قاب سر ───────────────────────────────────────
/**
 * قاب سر را از «رئوس تغییرشکل‌یافته» (skinning واقعی) می‌سازد.
 * bbox معمولی SkinnedMesh پوز bind است و با reshape/انیمیشن هماهنگ
 * نمی‌شود — این نسخه هر رأس را با ماتریس استخوان‌هایش به جهان می‌برد
 * و سپس مستقیماً به فضای محلی استخوان head برمی‌گرداند.
 *
 * ⚠️ A08 — کل قاب (اندازه، مرکز، کف، جلو) در «فضای محلی headBone»
 * محاسبه می‌شود، نه اندازه جهانی + مصرف محلی؛ با تغییر height/bulk/head
 * نسبت اجزا به سر ثابت می‌ماند و مقیاس/چرخش استخوان دوباره اعمال نمی‌شود.
 */
export function measureHeadFrameSkinned(meshes: THREE.Object3D[], headBone: THREE.Object3D): HeadFrame {
  headBone.updateMatrixWorld(true);
  // ماتریس تبدیل جهان → محلی headBone (یک‌بار، قبل از پیمایش رئوس)
  const inv = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
  const box = new THREE.Box3();
  let first = true;
  const v = new THREE.Vector3();
  const skinMat = new THREE.Matrix4();
  const tmpMat = new THREE.Matrix4();
  const meshWorld = new THREE.Matrix4();

  for (const obj of meshes) {
    const mesh = obj as THREE.SkinnedMesh;
    if (!(mesh as THREE.SkinnedMesh).isSkinnedMesh || !mesh.geometry?.attributes?.position) continue;
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    if (!si || !sw) {
      // بدون skin — مثل مش معمولی: باکس جهانی → فضای محلی headBone
      mesh.updateMatrixWorld(true);
      tmpBox.setFromObject(mesh);
      tmpBox.applyMatrix4(inv);
      if (first) { box.copy(tmpBox); first = false; } else box.union(tmpBox);
      continue;
    }
    mesh.updateMatrixWorld(true);
    meshWorld.copy(mesh.matrixWorld);
    const bones = mesh.skeleton.bones;
    const inverses = mesh.skeleton.boneInverses;
    const elems = skinMat.elements;
    const te = tmpMat.elements;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i);
      elems.fill(0);
      let wsum = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w < 0.01) continue;
        const b = bones[si.getComponent(i, k)];
        if (!b) continue;
        tmpMat.multiplyMatrices(b.matrixWorld, inverses[si.getComponent(i, k)]);
        for (let e = 0; e < 16; e++) elems[e] += te[e] * w;
        wsum += w;
      }
      if (wsum <= 0.5) skinMat.identity();
      // فرمول کامل three.js: world = meshWorld · bind⁻¹ · skin · bind · v
      v.applyMatrix4((mesh as THREE.SkinnedMesh).bindMatrix);
      v.applyMatrix4(skinMat);
      v.applyMatrix4((mesh as THREE.SkinnedMesh).bindMatrixInverse);
      v.applyMatrix4(meshWorld);
      // A08 — مستقیم به فضای محلی headBone و ساخت باکس همان‌جا
      v.applyMatrix4(inv);
      box.expandByPoint(v);
    }
    first = false;
  }
  if (first) return fallbackFrame(headBone);

  // حذف گردن: ۳۰٪ پایین باکس کنار گذاشته می‌شود — در فضای محلی سر
  const minY = box.min.y + (box.max.y - box.min.y) * 0.3;
  const trimmed = new THREE.Box3(
    new THREE.Vector3(box.min.x, minY, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  );
  const size = new THREE.Vector3();
  trimmed.getSize(size);
  const centerLocal = new THREE.Vector3();
  trimmed.getCenter(centerLocal);
  return {
    bone: headBone, size, center: centerLocal,
    bottomY: trimmed.min.y, frontZ: trimmed.max.z,
  };
}

const tmpBox = new THREE.Box3();

function fallbackFrame(headBone: THREE.Object3D): HeadFrame {
  return {
    bone: headBone,
    size: new THREE.Vector3(0.42, 0.4, 0.4),
    center: new THREE.Vector3(0, 0.2, 0),
    bottomY: 0, frontZ: 0.2,
  };
}

/** نسخه‌ی قدیمی (bind bbox) — برای مش‌های غیر skinned */
export function measureHeadFrame(headBone: THREE.Object3D, headMeshes: THREE.Object3D[]): HeadFrame {
  headBone.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  let first = true;
  for (const m of headMeshes) {
    m.updateMatrixWorld(true);
    tmp.setFromObject(m);
    if (first) { box.copy(tmp); first = false; } else box.union(tmp);
  }
  if (first) return fallbackFrame(headBone);
  // حذف گردن: ۲۸٪ پایین باکس کنار گذاشته می‌شود
  const minY = box.min.y + (box.max.y - box.min.y) * 0.28;
  const trimmed = new THREE.Box3(
    new THREE.Vector3(box.min.x, minY, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  );
  const size = new THREE.Vector3();
  trimmed.getSize(size);
  const centerWorld = new THREE.Vector3();
  trimmed.getCenter(centerWorld);
  const inv = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
  const centerLocal = centerWorld.applyMatrix4(inv);
  const minLocal = trimmed.min.clone().applyMatrix4(inv);
  const maxLocal = trimmed.max.clone().applyMatrix4(inv);
  return {
    bone: headBone, size, center: centerLocal,
    bottomY: minLocal.y, frontZ: maxLocal.z,
  };
}

// ─────────────────────────────────────────────────────────────
// اجزای چهره‌ی رویه‌ای به سبک KayKit (چندضلعی chunky با flatShading)
// مو، ریش، گوش الف، عاج ارگ — parent به استخوان head
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export type HairStyleId = 'baked' | 'none' | 'short' | 'long' | 'ponytail' | 'mohawk';
export type BeardStyleId = 'baked' | 'none' | 'stubble' | 'full' | 'long';

export interface HeadFrame {
  /** مبدأ محلی استخوان head */
  bone: THREE.Object3D;
  /** اندازه تقریبی سر (متر) */
  size: THREE.Vector3;
  /** مرکز جمجمه نسبت به استخوان (محلی) — بالای فک */
  center: THREE.Vector3;
  /** کف جمجمه (برای فک/ریش) */
  bottomY: number;
  /** جلوی صورت (برای عاج/سبیل) */
  frontZ: number;
}

export interface FeatureMats {
  hair: THREE.MeshStandardMaterial;
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
  const r = s.x * 0.47;          // شعاع جمجمه از عرض سر
  const c = frame.center;        // مرکز جمجمه (بالای فک)
  const topY = c.y + s.y * 0.30;

  if (style === 'short') {
    const cap = chunk(faceted(new THREE.SphereGeometry(r, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.58)), mat);
    cap.position.set(c.x, topY - s.y * 0.16, c.z - s.z * 0.03);
    cap.scale.set(1.06, 0.92, 1.04);
    g.add(cap);
  } else if (style === 'long') {
    const cap = chunk(faceted(new THREE.SphereGeometry(r * 1.03, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.62)), mat);
    cap.position.set(c.x, topY - s.y * 0.14, c.z);
    cap.scale.set(1.07, 1.0, 1.06);
    g.add(cap);
    const back = chunk(faceted(new THREE.SphereGeometry(r * 0.55, 7, 5)), mat);
    back.position.set(c.x, c.y - s.y * 0.35, c.z - s.z * 0.52);
    back.scale.set(1.15, 1.8, 0.62);
    g.add(back);
  } else if (style === 'ponytail') {
    const cap = chunk(faceted(new THREE.SphereGeometry(r * 1.02, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.58)), mat);
    cap.position.set(c.x, topY - s.y * 0.15, c.z);
    cap.scale.set(1.05, 0.88, 1.03);
    g.add(cap);
    const tail = chunk(faceted(new THREE.IcosahedronGeometry(r * 0.34, 0)), mat);
    tail.position.set(c.x, c.y - s.y * 0.1, c.z - s.z * 0.6);
    tail.scale.set(0.9, 2.4, 0.9);
    tail.rotation.x = 0.22;
    g.add(tail);
  } else if (style === 'mohawk') {
    const rows = 5;
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1) - 0.5;
      const h = r * (i === 0 || i === rows - 1 ? 0.9 : 1.5 - Math.abs(t) * 0.8);
      const spike = chunk(faceted(new THREE.ConeGeometry(r * 0.15, h, 4)), mat);
      spike.position.set(c.x, topY + h * 0.28, c.z + t * s.z * 0.75);
      g.add(spike);
    }
    const base = chunk(faceted(new THREE.BoxGeometry(r * 0.3, s.y * 0.22, s.z * 0.8)), mat);
    base.position.set(c.x, topY - s.y * 0.06, c.z);
    g.add(base);
  }
  return g;
}

// ── ساخت ریش ─────────────────────────────────────────────────
export function buildBeard(style: BeardStyleId, frame: HeadFrame, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'proceduralBeard';
  if (style === 'baked' || style === 'none') return g;

  const s = frame.size;
  const r = s.x * 0.47;
  const c = frame.center;
  const mouthY = frame.bottomY + s.y * 0.16;
  const mouthZ = frame.frontZ;

  if (style === 'stubble') {
    const jaw = chunk(faceted(new THREE.SphereGeometry(r * 0.88, 8, 5, 0, Math.PI * 2, Math.PI * 0.44, Math.PI * 0.32)), mat);
    jaw.position.set(c.x, mouthY + s.y * 0.06, c.z + s.z * 0.06);
    jaw.scale.set(1.0, 0.72, 1.02);
    g.add(jaw);
  } else if (style === 'full') {
    const jaw = chunk(faceted(new THREE.SphereGeometry(r * 0.94, 8, 6, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.4)), mat);
    jaw.position.set(c.x, mouthY + s.y * 0.04, c.z + s.z * 0.05);
    jaw.scale.set(1.02, 0.9, 1.05);
    g.add(jaw);
    const mustache = chunk(faceted(new THREE.BoxGeometry(r * 0.8, s.y * 0.09, r * 0.3)), mat);
    mustache.position.set(c.x, mouthY + s.y * 0.16, mouthZ - r * 0.05);
    g.add(mustache);
  } else if (style === 'long') {
    const jaw = chunk(faceted(new THREE.SphereGeometry(r * 0.94, 8, 6, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.4)), mat);
    jaw.position.set(c.x, mouthY + s.y * 0.04, c.z + s.z * 0.05);
    jaw.scale.set(1.02, 0.9, 1.05);
    g.add(jaw);
    const hang = chunk(faceted(new THREE.ConeGeometry(r * 0.5, s.y * 1.35, 5)), mat);
    hang.position.set(c.x, mouthY - s.y * 0.62, c.z + s.z * 0.16);
    hang.rotation.x = Math.PI - 0.15;
    g.add(hang);
    const mustache = chunk(faceted(new THREE.BoxGeometry(r * 0.8, s.y * 0.09, r * 0.3)), mat);
    mustache.position.set(c.x, mouthY + s.y * 0.16, mouthZ - r * 0.05);
    g.add(mustache);
  }
  return g;
}

// ── گوش الف ──────────────────────────────────────────────────
export function buildElfEars(frame: HeadFrame, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'elfEars';
  const s = frame.size;
  const r = s.x * 0.47;
  const c = frame.center;
  for (const side of [-1, 1]) {
    const ear = chunk(faceted(new THREE.ConeGeometry(r * 0.2, r * 0.9, 4)), mat);
    ear.position.set(c.x + side * s.x * 0.5, c.y + s.y * 0.05, c.z - s.z * 0.04);
    ear.rotation.z = side * (Math.PI / 2 - 0.3);
    ear.rotation.y = side * 0.22;
    g.add(ear);
  }
  return g;
}

// ── عاج ارک ──────────────────────────────────────────────────
export function buildTusks(frame: HeadFrame, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = 'orcTusks';
  const s = frame.size;
  const r = s.x * 0.47;
  const c = frame.center;
  for (const side of [-1, 1]) {
    const tusk = chunk(faceted(new THREE.ConeGeometry(r * 0.09, r * 0.4, 5)), mat);
    tusk.position.set(c.x + side * r * 0.32, frame.bottomY + s.y * 0.2, frame.frontZ - r * 0.08);
    tusk.rotation.z = side * -0.14;
    tusk.rotation.x = -0.1;
    g.add(tusk);
  }
  return g;
}

// ── اندازه‌گیری قاب سر ───────────────────────────────────────
/**
 * قاب سر را در فضای محلی استخوان head می‌سازد تا اجزا با انیمیشن همراه بمانند.
 * headMeshes: مش‌های متعلق به سر (SkinnedMesh سر + شاید کلاه) — در پوز rest اندازه‌گیری می‌شود.
 */
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
  if (first) box.set(new THREE.Vector3(-0.2, 0, -0.2), new THREE.Vector3(0.2, 0.4, 0.2));
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
  // تبدیل به فضای محلی استخوان — applyMatrix4 خودش مقیاس/چرخش را اعمال می‌کند
  const inv = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
  const centerLocal = centerWorld.applyMatrix4(inv);
  const minLocal = trimmed.min.clone().applyMatrix4(inv);
  const maxLocal = trimmed.max.clone().applyMatrix4(inv);
  return {
    bone: headBone, size, center: centerLocal,
    bottomY: minLocal.y, frontZ: maxLocal.z,
  };
}

// ─────────────────────────────────────────────────────────────
// حجم‌های تقریبی بدن — چند کپسول per-bone از رئوس واقعی اسکین‌شدهٔ rest
//
// برای هر استخوان canonical: رئوسِ هر مشِ اسکین‌شده با بیشترین وزن
// به آن استخوان تعلق دارند؛ هر رأس به فضای محلی استخوان مال‌بندی
// (bind) برده می‌شود:  v_local = IBM_j × M_node × v
// سپس ابر نقاط روی محور اصلی (PCA) به ۳ بخش تقسیم و هر بخش یک
// کپسول مستقل (شعاع = صدک ۹۲ فاصلهٔ جانبی) — بدن مخروطی است و یک
// کپسول واحد تنه را کاذب چاق جلوه می‌دهد (مثبت کاذب نفوذ).
//
// حجم‌ها در فضای محلی استخوان ذخیره می‌شوند تا با انیمیشن، Morph و
// تغییر نسبت بدن (reshape scale) خودکار همراه حرکت کنند — چون همان
// ماتریس استخوان اعمال می‌شود.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export interface BodyVolume {
  /** دو سر کپسول در فضای محلی استخوان */
  a: THREE.Vector3;
  b: THREE.Vector3;
  r: number;
}

export interface BodyVolumeSet {
  /** canonical bone → چند کپسول */
  byCanon: Record<string, BodyVolume[]>;
  /** تعداد رئوس مشارکت‌کننده (اعتبار فیت) */
  samples: number;
}

export interface VolumeMeshInput {
  mesh: THREE.SkinnedMesh;
  /** نام استخوان واقعی → canonical (مثل lowerarm.r → lowerArmR) */
  canonOf: (boneName: string) => string | null;
}

const PAD = 0.008;      // حاشیهٔ ایمنی فیت (m)
const MIN_R = 0.04;     // حداقل شعاع کپسول
const MIN_PTS = 24;     // حداقل رأس برای فیت معتبر
const SUBCAPS = 9;      // تعداد برش هر استخوان در زنجیرهٔ کپسولی (بدن مخروطی)
const W_MIN = 0.45;     // فقط رئوس با وزن غالب واقعی — وزن‌های پخشِ نرم آلوده می‌سازند

function pca(points: THREE.Vector3[]): THREE.Vector3 {
  const n = points.length;
  const mean = new THREE.Vector3();
  for (const p of points) mean.add(p);
  mean.multiplyScalar(1 / n);
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const d = new THREE.Vector3();
  for (const p of points) {
    d.subVectors(p, mean);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d.getComponent(i) * d.getComponent(j);
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] /= n;
  let lam = new THREE.Vector3(1, 0.3, 0.1).normalize();
  for (let it = 0; it < 30; it++) {
    const nx = new THREE.Vector3(
      cov[0][0] * lam.x + cov[0][1] * lam.y + cov[0][2] * lam.z,
      cov[1][0] * lam.x + cov[1][1] * lam.y + cov[1][2] * lam.z,
      cov[2][0] * lam.x + cov[2][1] * lam.y + cov[2][2] * lam.z,
    );
    if (nx.lengthSq() < 1e-12) break;
    lam = nx.normalize();
  }
  return lam;
}

/**
 * فیت زنجیرهٔ کپسولی روی ابر نقاط یک استخوان:
 * ابر نقاط در راستای محور اصلی (PCA) به برش‌های هم‌عرض تقسیم می‌شود؛
 * هر برش: مرکز = centroid واقعی همان لایه، شعاع = صدک ۸۵ فاصله تا centroid.
 * کپسول i = پاره‌خط مرکز(i) → مرکز(i+1) با شعاع بیشینهٔ دو سر.
 * این ساختار بدنِ مخروطی/خمیده (تنه، سر با خود) را بدون مثبت کاذبِ
 * «استوانهٔ چاق روی صفحهٔ پهن» می‌پوشاند و مرکز هر لایه دنبال
 * انحنای واقعی مرکز بدن می‌رود.
 */
function fitCapsules(points: THREE.Vector3[]): BodyVolume[] {
  const n = points.length;
  if (n < MIN_PTS) return [];
  const mean = new THREE.Vector3();
  for (const p of points) mean.add(p);
  mean.multiplyScalar(1 / n);
  const lam = pca(points);

  const ts = points.map((p) => p.clone().sub(mean).dot(lam));
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const width = Math.max(1e-4, tMax - tMin);
  const sliceW = width / SUBCAPS;

  interface SliceData { c: THREE.Vector3; r: number; tMid: number }
  const slicesData: SliceData[] = [];
  const rel = new THREE.Vector3();
  for (let i = 0; i < SUBCAPS; i++) {
    const lo = tMin + i * sliceW;
    const hi = lo + sliceW;
    const bucket: THREE.Vector3[] = [];
    for (let k = 0; k < n; k++) {
      if (ts[k] >= lo && (i === SUBCAPS - 1 ? ts[k] <= hi : ts[k] < hi)) bucket.push(points[k]);
    }
    if (bucket.length < 8) continue;
    const c = new THREE.Vector3();
    for (const p of bucket) c.add(p);
    c.multiplyScalar(1 / bucket.length);
    const dists: number[] = [];
    for (const p of bucket) {
      rel.copy(p).sub(c);
      dists.push(rel.length());
    }
    dists.sort((a, b) => a - b);
    const r = Math.max(MIN_R, dists[Math.round(0.8 * (dists.length - 1))] + PAD);
    slicesData.push({ c, r, tMid: (lo + hi) / 2 });
  }
  if (slicesData.length === 0) return [];
  if (slicesData.length === 1) {
    const s = slicesData[0];
    return [{ a: s.c.clone(), b: s.c.clone(), r: s.r }];
  }
  const out: BodyVolume[] = [];
  for (let i = 0; i < slicesData.length; i++) {
    const s0 = slicesData[i];
    const s1 = slicesData[Math.min(i + 1, slicesData.length - 1)];
    out.push({ a: s0.c.clone(), b: s1.c.clone(), r: Math.max(s0.r, s1.r) });
  }
  return out;
}

/**
 * محاسبهٔ حجم‌های بدن از مش‌های اسکین‌شدهٔ یک ریشه.
 * root باید در پوز rest (bind) و با matrixWorld به‌روز باشد.
 */
export function computeBodyVolumes(root: THREE.Object3D, canonOf: (boneName: string) => string | null): BodyVolumeSet {
  root.updateMatrixWorld(true);
  const points: Record<string, THREE.Vector3[]> = {};
  const skelBones: THREE.Bone[] = [];
  const ibms: THREE.Matrix4[] = [];
  let samples = 0;

  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!(mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh || !mesh.geometry) return;
    // شنل/عبا: پارچهٔ آزاد است — با کپسول صلب مدل نمی‌شود و ابر نقاط
    // spine/chest را آلوده می‌کند (مثبت کاذب). محدودیت ثبت‌شده: تعامل
    // سلاح با پارچهٔ آزاد در این نسخه گارد ندارد.
    if (/cape|cloak|skirt/i.test(mesh.name || '')) return;
    const geom = mesh.geometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    const ji = geom.getAttribute('skinIndex') as THREE.BufferAttribute | undefined;
    const jw = geom.getAttribute('skinWeight') as THREE.BufferAttribute | undefined;
    if (!pos || !ji || !jw) return;

    // اسکلت این مش — فقط یک‌بار جمع می‌شود (بدنه‌ها یک skin دارند)
    const skeleton = (mesh as THREE.SkinnedMesh).skeleton;
    if (skeleton && skelBones.length === 0) {
      skelBones.push(...skeleton.bones);
      ibms.push(...skeleton.boneInverses);
    }

    const nodeMW = mesh.matrixWorld;
    const tmp = new THREE.Vector3();
    const local = new THREE.Vector3();
    const ibm = new THREE.Matrix4();
    const jnt = [0, 0, 0, 0]; const wgt = [0, 0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      jnt[0] = ji.getComponent(i, 0); jnt[1] = ji.getComponent(i, 1);
      jnt[2] = ji.getComponent(i, 2); jnt[3] = ji.getComponent(i, 3);
      wgt[0] = jw.getComponent(i, 0); wgt[1] = jw.getComponent(i, 1);
      wgt[2] = jw.getComponent(i, 2); wgt[3] = jw.getComponent(i, 3);
      // استخوان غالب — فقط اگر وزنش واقعاً غالب است (وزن‌های نرمِ پخش ابر نقاط را می‌آلایند)
      let bj = 0, bw = -1;
      for (let k = 0; k < 4; k++) if (wgt[k] > bw) { bw = wgt[k]; bj = k; }
      if (bw < W_MIN) continue;
      const bone = skelBones[jnt[bj]];
      if (!bone) continue;
      const canon = canonOf(bone.name);
      if (!canon) continue;

      // v_local = IBM × M_node × v  (فضای محلی استخوان در bind)
      ibm.copy(ibms[jnt[bj]] ?? new THREE.Matrix4());
      local.copy(tmp).applyMatrix4(nodeMW).applyMatrix4(ibm);
      (points[canon] ??= []).push(local.clone());
      samples++;
    }
  });

  const byCanon: Record<string, BodyVolume[]> = {};
  for (const [canon, pts] of Object.entries(points)) {
    const caps = fitCapsules(pts);
    if (caps.length) byCanon[canon] = caps;
  }
  return { byCanon, samples };
}

/** استخوان‌هایی که حجم بدن برایشان ساخته می‌شود (اولویت برخورد سلاح) */
export const GUARD_BONES = [
  'head', 'chest', 'spine', 'hips',
  'upperArmL', 'lowerArmL', 'handL',
  'upperLegL', 'lowerLegL', 'footL',
  'upperLegR', 'lowerLegR', 'footR',
] as const;

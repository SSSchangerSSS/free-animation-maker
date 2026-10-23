// ─────────────────────────────────────────────────────────────
// پروفایل برخورد داده‌محور سلاح — استخراج از هندسهٔ واقعی GLB
//
// برای هر نود سلاح، حجم برخورد به‌صورت «برش‌های کپسولی» در فضای
// محلی نود سلاح (handslot) ساخته می‌شود: محور اصلی = بلندترین محور
// bbox؛ ۸ برش در طول آن؛ هر برش یک کپسول با شعاع از پهنای واقعی
// همان برش (صدک ۹۵ برای حذف پرت‌ها). این روش شمشیر (تیغهٔ نازک +
// گارد پهن)، تبر (دستهٔ نازک + سر پهن) و خنجر را یکسان پوشش می‌دهد
// و برخلاف آفست ثابت، با هر شکل سلاحی سازگار است.
//
// تماس مجاز: ناحیهٔ «دسته» (برش‌های نزدیک مبدأ handslot) با دستِ
// گرفتن — این استثنا صریح است و عبور «تیغه» از دست را مجاز نمی‌کند.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export interface WeaponSlice {
  /** دو سر کپسول در فضای محلی نود سلاح (handslot) */
  a: THREE.Vector3;
  b: THREE.Vector3;
  r: number;
  /** handle = تماس با دستِ گیرنده مجاز؛ blade/hard = نفوذ ممنوع */
  zone: 'handle' | 'blade';
}

export interface WeaponProfile {
  /** نام نود سلاح در GLB بدنه (مثل 1H_Sword) */
  id: string;
  /** محور اصلی تیغه/سلاح در فضای handslot (واحد) */
  axis: THREE.Vector3;
  /** طول کل روی محور (m) */
  length: number;
  /** دو سر محدودهٔ تیغه (بدون دسته) روی محور */
  bladeStart: number;
  bladeEnd: number;
  slices: WeaponSlice[];
  /** شعاع ناحیهٔ چنگ دست حول مبدأ handslot (تماس مجاز دست-دسته) */
  gripRadius: number;
  /** نقطهٔ چنگ دست دوم برای سلاح دو‌دستی (روی محور، فضای handslot) — null = تک‌دست */
  secondHand: THREE.Vector3 | null;
}

const SLICES = 10;

// (percentile عمومی حذف شد — برش‌ها مستقیماً صدک خودشان را می‌سازند)

/**
 * استخراج پروفایل از هندسهٔ محلی سلاح.
 * geometry: BufferGeometry با position در فضای محلی خود نود سلاح.
 * محور اصلی = PCA رئوس (نه محور bbox — تیغه در KayKit آفست جانبی دارد).
 * هر برش با centroid خودش مرکز می‌گیرد؛ کپسول‌ها زنجیرهٔ مراکز مجاورند
 * (کره + پاره‌خط) تا تیغهٔ آفست‌دار و گارد پهن بدون مثبت کاذب پوشش داده شوند.
 * دو‌دستی بودن بر اساس نام (پیشوند/بخش 2H).
 */
export function extractWeaponProfile(id: string, geometry: THREE.BufferGeometry): WeaponProfile {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos || pos.count < 8) throw new Error(`weapon ${id}: no geometry`);
  const is2H = /(^|_)2H_|2H/.test(id);

  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    pts.push(v.clone());
  }
  // محور اصلی با PCA (توان‌یابی)
  const centroid = new THREE.Vector3();
  for (const p of pts) centroid.add(p);
  centroid.multiplyScalar(1 / pts.length);
  const axis = pcaAxis(pts, centroid);

  // پروجکشن مطلق روی محور (نسبت به مبدأ handslot — برای گزارش و ناحیهٔ دسته)
  const tsAbs = pts.map((p) => p.dot(axis));
  const tMin = Math.min(...tsAbs);
  const tMax = Math.max(...tsAbs);
  const length = tMax - tMin;
  const sliceLen = length / SLICES;

  // برش‌ها: هر برش یک «چوب» جهت‌دار مستقل — کپسولی با محور PCA محلیِ
  // همان برش. این ساختار تیغهٔ نازک، گاردِ عرضی (±۰٫۲۵m در یک لایه)
  // و سر تبر را بدون تورم گوی‌مانند می‌پوشاند.
  interface SliceData { a: THREE.Vector3; b: THREE.Vector3; r: number; tMid: number }
  const slicesData: SliceData[] = [];
  for (let i = 0; i < SLICES; i++) {
    const lo = tMin + i * sliceLen;
    const hi = lo + sliceLen;
    const bucket: THREE.Vector3[] = [];
    for (let k = 0; k < pts.length; k++) {
      if (tsAbs[k] >= lo && (i === SLICES - 1 ? tsAbs[k] <= hi : tsAbs[k] < hi)) bucket.push(pts[k]);
    }
    if (bucket.length < 3) continue;
    const c = new THREE.Vector3();
    for (const p of bucket) c.add(p);
    c.multiplyScalar(1 / bucket.length);
    // محور محلی برش (برای تیغه ≈ محور اصلی؛ برای گارد ≈ عرضی)
    const u = bucket.length >= 8 ? pcaAxis(bucket, c) : axis;
    // طول چوب روی محور محلی + شعاع عمود بر آن
    const ss: number[] = [];
    const perps: number[] = [];
    const rel = new THREE.Vector3();
    for (const p of bucket) {
      rel.copy(p).sub(c);
      const s = rel.dot(u);
      ss.push(s);
      perps.push(rel.addScaledVector(u, -s).length());
    }
    ss.sort((a, b) => a - b);
    perps.sort((a, b) => a - b);
    const aP = ss[Math.round(0.02 * (ss.length - 1))];
    const bP = ss[Math.round(0.98 * (ss.length - 1))];
    const r = Math.max(0.014, perps[Math.round(0.9 * (perps.length - 1))] + 0.006);
    slicesData.push({
      a: c.clone().addScaledVector(u, aP),
      b: c.clone().addScaledVector(u, bP),
      r, tMid: (lo + hi) / 2,
    });
  }
  if (slicesData.length < 2) throw new Error(`weapon ${id}: degenerate profile`);

  // هر برش = یک کپسول مستقل (اتحادیهٔ برش‌ها کل سلاح را می‌پوشاند)
  const slices: WeaponSlice[] = [];
  const handleEndT = tMin + length * 0.32; // دسته زیر مبدأ چنگ + بلوک مرکزی گارد
  for (const sd of slicesData) {
    slices.push({
      a: sd.a.clone(), b: sd.b.clone(), r: sd.r,
      zone: sd.tMid <= handleEndT ? 'handle' : 'blade',
    });
  }

  // محدودهٔ تیغه برای گزارش/دیاگ
  const bladeStart = handleEndT;
  const bladeEnd = tMax;

  // چنگ دست دوم: سلاح دو‌دستی — روی خط مرکزی، در ناحیهٔ دسته زیر دست اول
  const c0 = centroid.clone().addScaledVector(axis, -centroid.dot(axis)); // نقطهٔ خط مرکزی نزدیک مبدأ
  const secondHand = is2H ? c0.clone().addScaledVector(axis, Math.max(tMin, -0.12)) : null;

  return {
    id, axis, length, bladeStart, bladeEnd, slices,
    gripRadius: 0.15,
    secondHand,
  };
}

function pcaAxis(points: THREE.Vector3[], mean: THREE.Vector3): THREE.Vector3 {
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const d = new THREE.Vector3();
  for (const p of points) {
    d.subVectors(p, mean);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d.getComponent(i) * d.getComponent(j);
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] /= points.length;
  let lam = new THREE.Vector3(0.3, 1, 0.1).normalize();
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

/** ساخت پروفایل‌های استاندارد KayKit از یک ریشهٔ لودشده (مرورگر یا هارنس) */
export function extractProfilesFromRoot(root: THREE.Object3D, names: string[]): Record<string, WeaponProfile> {
  const out: Record<string, WeaponProfile> = {};
  const seen = new Set<string>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || seen.has(o.name)) return;
    if (!names.includes(o.name)) return;
    seen.add(o.name);
    try { out[o.name] = extractWeaponProfile(o.name, mesh.geometry); } catch { /* بدون هندسه */ }
  });
  return out;
}

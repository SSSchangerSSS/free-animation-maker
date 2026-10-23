// ─────────────────────────────────────────────────────────────
// موتور بازرنگی اطلس تکسچر KayKit
//
// اطلس KayKit از پچ‌های رنگی گرادیانی تمیز تشکیل شده است؛
// برای هر تکه‌ی بدن (Head/Body/Arm/…) یک ماسک UV رستر می‌سازیم و
// پیکسل‌های داخل ماسک که در بازه‌ی رنگی هر اسلات (پوست/مو/جامه/فلز/
// استخوان) قرار می‌گیرند، با رنگ جدید و حفظ نسبت روشنایی (گرادیان
// سایه) بازرنگی می‌شوند.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export interface ColorRange {
  /** بازه hue بر حسب درجه — ممکن است از ۳۶۰ بگذرد (مثلاً [350, 370]) */
  hue: [number, number];
  sat: [number, number];
  light: [number, number];
}

export type RecolorKey = 'skin' | 'hair' | 'cloth' | 'metal' | 'bone';

export interface RecolorRule {
  /** پسوند نام تکه‌ها (lowercase includes) */
  parts: string[];
  range: ColorRange;
  /** روشنایی مرجع بازه — برای حفظ گرادیان سایه */
  meanL: number;
}

export interface RecolorColors {
  skin: string;
  hair: string;
  cloth: string;
  metal: string;
  bone: string;
}

// ── ابزار رنگ ────────────────────────────────────────────────
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s, l];
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const v = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function inRange(h: number, s: number, l: number, r: ColorRange): boolean {
  let hueOk: boolean;
  if (r.hue[0] <= r.hue[1]) hueOk = h >= r.hue[0] && h <= r.hue[1];
  else hueOk = h >= r.hue[0] || h <= r.hue[1] - 360;
  return hueOk && s >= r.sat[0] && s <= r.sat[1] && l >= r.light[0] && l <= r.light[1];
}

// ── ماسک UV تکه‌های بدن ──────────────────────────────────────
export interface PartMask { name: string; data: Uint8Array }
export interface MaskSet {
  width: number; height: number;
  parts: PartMask[];
  texWidth: number; texHeight: number;
}

/** برای هر Mesh صحنه یک ماسک UV رستر می‌سازد (باید قبل از انیمیشن صدا زده شود) */
export function buildPartMasks(root: THREE.Object3D, texWidth: number, texHeight: number): MaskSet {
  const W = texWidth, H = texHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const parts: PartMask[] = [];
  const seen = new Set<string>();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes?.uv) return;
    const name = mesh.name || `part${parts.length}`;
    let key = name;
    let n = 2;
    while (seen.has(key)) key = `${name}_${n++}`;
    seen.add(key);

    const geo = mesh.geometry;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const index = geo.index ? geo.index.array : null;
    const triCount = index ? index.length / 3 : uv.count / 3;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    // هر مثلث جداگانه پر می‌شود — winding معکوس باعث سوراخ شدن ماسک نشود
    // ⚠️ تکسچرهای glTF با flipY=false لود می‌شوند: ردیف تصویر = v*H (بدون معکوس)
    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index[t * 3] : t * 3;
      const i1 = index ? index[t * 3 + 1] : t * 3 + 1;
      const i2 = index ? index[t * 3 + 2] : t * 3 + 2;
      const u0 = uv.getX(i0) * W, v0 = uv.getY(i0) * H;
      const u1 = uv.getX(i1) * W, v1 = uv.getY(i1) * H;
      const u2 = uv.getX(i2) * W, v2 = uv.getY(i2) * H;
      ctx.beginPath();
      ctx.moveTo(u0, v0); ctx.lineTo(u1, v1); ctx.lineTo(u2, v2); ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const img = ctx.getImageData(0, 0, W, H).data;
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = img[i * 4 + 3] > 10 ? 1 : 0;
    parts.push({ name: key, data: mask });
  });

  return { width: W, height: H, parts, texWidth: W, texHeight: H };
}

// ── اعمال بازرنگی ────────────────────────────────────────────
export interface ApplyOptions {
  /** پاک‌کردن موی داخلی (پر کردن ناحیه مو با رنگ پوست) */
  eraseHair?: boolean;
  /** پاک‌کردن ریش داخلی */
  eraseBeard?: boolean;
  /** کدام اسلات‌ها اعمال شوند (پیش‌فرض: همه) */
  keys?: RecolorKey[];
}

export interface RecolorTarget {
  /** تکسچر اصلی (باید CanvasTexture با image اصلی باشد) */
  texture: THREE.Texture;
  masks: MaskSet;
  rules: Partial<Record<RecolorKey, RecolorRule[]>>;
  /** وضعیت فعلی پیکسل‌ها (بین اعمال‌ها حفظ می‌شود) */
  current: ImageData;
  /** دیباگ: تعداد پیکسل‌های رنگ‌شده در آخرین اعمال */
  lastPainted: number;
}

/** وضعیت اولیه را از تکسچر می‌سازد */
export function createRecolorTarget(texture: THREE.Texture, masks: MaskSet): RecolorTarget {
  const img = texture.image as HTMLImageElement | HTMLCanvasElement;
  const W = masks.texWidth, H = masks.texHeight;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const current = ctx.getImageData(0, 0, W, H);
  return { texture, masks, rules: {}, current, lastPainted: 0 };
}

function paintPixel(data: Uint8ClampedArray, idx: number, color: [number, number, number], factor: number) {
  data[idx] = Math.min(255, color[0] * factor);
  data[idx + 1] = Math.min(255, color[1] * factor);
  data[idx + 2] = Math.min(255, color[2] * factor);
}

/**
 * بازرنگی اسلات‌ها روی current و آپدیت تکسچر.
 * rules: قواعد هر اسلات برای این بدنه.
 */
export function applyRecolors(
  target: RecolorTarget,
  colors: RecolorColors,
  options: ApplyOptions = {},
): void {
  const { masks } = target;
  const W = masks.width, H = masks.height;
  // از تصویر اصلی شروع می‌کنیم تا اعمال‌ها تجمعی نشوند
  const img = target.texture.image as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const frame = ctx.getImageData(0, 0, W, H);
  const data = frame.data;
  const px = target.current; // نگه‌داری نسخه فعلی برای سازگاری API

  const skinC = hexToRgb(colors.skin);
  const hairC = hexToRgb(colors.hair);
  const clothC = hexToRgb(colors.cloth);
  const metalC = hexToRgb(colors.metal);
  const boneC = hexToRgb(colors.bone);
  const colorMap: Record<RecolorKey, [number, number, number]> = {
    skin: skinC, hair: hairC, cloth: clothC, metal: metalC, bone: boneC,
  };
  const meanLMap: Record<RecolorKey, number> = { skin: 0.75, hair: 0.45, cloth: 0.5, metal: 0.65, bone: 0.5 };

  const keys = options.keys ?? (Object.keys(target.rules) as RecolorKey[]);
  // پاک‌سازی مو/ریش داخلی = بازرنگی اسلات مو با رنگ پوست
  const keyPaint: Record<string, [number, number, number]> = {};
  for (const k of keys) keyPaint[k] = colorMap[k];
  if (options.eraseHair || options.eraseBeard) {
    keyPaint.hair = skinC;
  }

  // آماده‌سازی ماسک مرکب هر قاعده
  type Job = { mask: Uint8Array; color: [number, number, number]; meanL: number; rule: RecolorRule };
  const jobs: Job[] = [];
  let painted = 0;
  for (const k of keys) {
    const rules = target.rules[k];
    if (!rules) continue;
    for (const rule of rules) {
      // ماسک مرکب تکه‌های قاعده
      const mask = new Uint8Array(W * H);
      let any = false;
      for (const part of masks.parts) {
        if (!rule.parts.some((p) => part.name.toLowerCase().includes(p))) continue;
        any = true;
        const d = part.data;
        for (let i = 0; i < mask.length; i++) if (d[i]) mask[i] = 1;
      }
      if (any) jobs.push({ mask, color: keyPaint[k], meanL: rule.meanL, rule });
    }
  }

  for (let i = 0; i < W * H; i++) {
    if (!jobs.length) break;
    const o = i * 4;
    if (data[o + 3] < 8) continue;
    const [h, s, l] = rgbToHsl(data[o], data[o + 1], data[o + 2]);
    for (const job of jobs) {
      if (!job.mask[i]) continue;
      if (!inRange(h, s, l, job.rule.range)) continue;
      const factor = Math.max(0.45, Math.min(1.6, l / job.meanL));
      paintPixel(data, o, job.color, factor);
      painted++;
      break; // اولین قاعده‌ی منطبق کافی است
    }
  }
  target.lastPainted = painted;

  ctx.putImageData(frame, 0, 0);
  const tex = target.texture;
  tex.image = canvas;
  tex.needsUpdate = true;
  // نگه‌داری وضعیت
  px.data.set(frame.data);
}
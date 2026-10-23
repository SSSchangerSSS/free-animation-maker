// ─────────────────────────────────────────────────────────────
// پروفایل داده‌محور سلاح‌های V3 (Quaternius Modular Weapons CC0)
//
// هر سلاح: محل گرفتن دسته، طول/شکل تیغه، مقیاس، چرخش نصب روی
// استخوان hand_* و نقطه‌ی دست دوم برای سلاح دو‌دست.
// ⚠️ هیچ offset پراکنده‌ای در کد انیمیشن مجاز نیست — همه‌ی
// تنظیمات چنگ فقط از همین جدول خوانده می‌شود (مأموریت §۲).
// مختصات در فضای محلی مدل خام (پیش از scale) است.
// ─────────────────────────────────────────────────────────────

export interface V3WeaponDef {
  id: string;
  label: string;
  file: string;
  /** دست فعال */
  hand: 'l' | 'r';
  /** دو‌دست — دست دوم باید به grip2 برود */
  twoHanded?: boolean;
  /** نصب روی استخوان دست: موقعیت (متر، پس از scale) */
  pos: [number, number, number];
  /** نصب روی استخوان دست: چرخش اویلر XYZ */
  rot: [number, number, number];
  scale: number;
  /** از این نقطه‌ی محلی تا bladeTo «تیغه» است — برای برخورد و رد سلاح */
  bladeFrom: [number, number, number];
  bladeTo: [number, number, number];
  /** نقطه‌ی گرفتن دست دوم (محلی، خام) — فقط دو‌دست */
  grip2?: [number, number, number];
  /** سرعت ضربه برای swept test (بازه‌ی زمانی حساس) */
  swingFrames?: [number, number];
  /** توییک پیش‌فرض چنگ (کالیبره‌شده‌ی دیداری) — وقتی کلیپ توییک خاص ندارد */
  tweak?: { rx?: number; ry?: number; rz?: number; px?: number; py?: number; pz?: number };
}

const DEG = Math.PI / 180;

/**
 * نصب پایه: دسته در مبدأ دست (koghi hand bone)؛ تیغه به سمت بیرون
 * دست. برای دست راست (hand_r) X محلی مدل به سمت -X جهانی بدن است،
 * پس چرخش Z = -90° مدل +Y را به سمت انگشتان می‌برد.
 * مقدار دقیق per-weapon در کالیبراسیون دیداری تنظیم شده است.
 */
export const V3_WEAPONS: Record<string, V3WeaponDef> = {
  sword: {
    id: 'sword', label: 'شمشیر یک‌دست', file: 'W_Sword.glb', hand: 'r',
    pos: [0.035, -0.035, -0.01], rot: [105 * DEG, 0, -85 * DEG], scale: 0.27,
    bladeFrom: [0, 0, 0], bladeTo: [0, 4.63, 0],
    tweak: { rz: -0.5, py: 0.01 },
  },
  sword2h: {
    id: 'sword2h', label: 'شمشیر دو‌دست', file: 'W_Claymore.glb', hand: 'r', twoHanded: true,
    pos: [0.035, -0.035, -0.01], rot: [105 * DEG, 0, -85 * DEG], scale: 0.26,
    bladeFrom: [0, 0.3, 0], bladeTo: [0, 6.2, 0], grip2: [0, -0.5, 0],
    tweak: { rz: -0.35, py: 0.01 },
  },
  axe: {
    id: 'axe', label: 'تبر یک‌دست', file: 'W_Axe.glb', hand: 'r',
    pos: [0.035, -0.035, -0.01], rot: [100 * DEG, 0, -80 * DEG], scale: 0.26,
    bladeFrom: [0, 1.2, 0], bladeTo: [0.95, 3.3, 0],
  },
  axe2h: {
    id: 'axe2h', label: 'تبر دو‌دست', file: 'W_Axe_Double.glb', hand: 'r', twoHanded: true,
    pos: [0.035, -0.035, -0.01], rot: [100 * DEG, 0, -80 * DEG], scale: 0.25,
    bladeFrom: [0, 1.0, 0], bladeTo: [1.4, 2.6, 0], grip2: [0, -0.6, 0],
  },
  dagger: {
    id: 'dagger', label: 'خنجر', file: 'W_Dagger.glb', hand: 'r',
    pos: [0.03, -0.02, -0.008], rot: [100 * DEG, 0, -85 * DEG], scale: 0.22,
    bladeFrom: [0, 0.2, 0], bladeTo: [0, 2.0, 0],
  },
  hammer: {
    id: 'hammer', label: 'پتک دو‌دست', file: 'W_Hammer_Double.glb', hand: 'r', twoHanded: true,
    pos: [0.035, -0.035, -0.01], rot: [100 * DEG, 0, -80 * DEG], scale: 0.24,
    bladeFrom: [0, 2.2, 0], bladeTo: [0, 3.19, 0], grip2: [0, -0.7, 0],
  },
  spear: {
    id: 'spear', label: 'نیزه', file: 'W_Spear.glb', hand: 'r', twoHanded: true,
    pos: [0.035, -0.035, -0.01], rot: [95 * DEG, 0, -78 * DEG], scale: 0.22,
    bladeFrom: [0, 7.0, 0], bladeTo: [0, 7.56, 0], grip2: [0, -1.6, 0],
  },
  bow: {
    id: 'bow', label: 'کمان', file: 'W_Bow_Wooden.glb', hand: 'l',
    pos: [0.03, -0.04, 0], rot: [90 * DEG, 0, -90 * DEG], scale: 0.26,
    bladeFrom: [0, -2.7, 0], bladeTo: [0, 2.7, 0],
  },
  shield: {
    id: 'shield', label: 'سپر', file: 'W_Shield_Heater.glb', hand: 'l',
    pos: [0.02, -0.06, 0.01], rot: [90 * DEG, 0, 180 * DEG], scale: 0.24,
    bladeFrom: [0, -1.3, 0], bladeTo: [0, 1.26, 0],
  },
};

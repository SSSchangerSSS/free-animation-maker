// ─────────────────────────────────────────────────────────────
// پروفایل داده‌محور سلاح‌های V3 (Quaternius Modular Weapons CC0)
//
// سیستم چنگ (جایگزین pos/rot عددی — مأموریت §۲):
//   • محور چنگ = امتداد ساعد از مچ به بیرون (اندازه‌گیری runtime از
//     استخوان‌های واقعی، در universal.ts: computeGripMount)
//   • gripCenter: محل مرکز دسته نسبت به مچ در قاب چنگ
//     [در امتداد ساعد، جانبی، سمت کف دست] بر حسب متر
//   • rollDeg: غلت حول محور چنگ — جهت لبه (کالیبره‌ی دیداری)
//   • pitchDeg: زاویه‌ی تیغه نسبت به امتداد ساعد (۰ = هم‌راستا)
//   • edgeModel: محور «لبه/پهن» مدل خام برای مرجع غلت
// ⚠️ هیچ offset پراکنده‌ای در کد انیمیشن مجاز نیست — همه‌ی
// تنظیمات چنگ فقط از همین جدول خوانده می‌شود.
// مختصات blade*/grip2 در فضای مدل خام (پیش از scale) است.
// ─────────────────────────────────────────────────────────────

export interface V3WeaponDef {
  id: string;
  label: string;
  file: string;
  /** دست فعال */
  hand: 'l' | 'r';
  /** دو‌دست — دست دوم باید به grip2 برود */
  twoHanded?: boolean;
  scale: number;
  /** از این نقطه‌ی محلی تا bladeTo «تیغه» است — برای برخورد و رد سلاح */
  bladeFrom: [number, number, number];
  bladeTo: [number, number, number];
  /** مرکز چنگ نسبت به مچ در قاب چنگ [along, lateral, palmar] — متر */
  gripCenter: [number, number, number];
  /** غلت حول محور چنگ — درجه */
  rollDeg: number;
  /** انحراف تیغه از امتداد ساعد به سمت کف دست — درجه */
  pitchDeg: number;
  /** محور تیغه/دسته در فضای مدل خام */
  gripAxisModel?: [number, number, number];
  /** محور لبه در فضای مدل خام */
  edgeModel?: [number, number, number];
  /** نقطه‌ی گرفتن دست دوم (محلی، خام) — فقط دو‌دست */
  grip2?: [number, number, number];
  /** سرعت ضربه برای swept test (بازه‌ی زمانی حساس) */
  swingFrames?: [number, number];
}

export const V3_WEAPONS: Record<string, V3WeaponDef> = {
  sword: {
    id: 'sword', label: 'شمشیر یک‌دست', file: 'W_Sword.glb', hand: 'r',
    scale: 0.27,
    bladeFrom: [0, 0, 0], bladeTo: [0, 4.63, 0],
    gripCenter: [0.055, 0.005, 0.02], rollDeg: 0, pitchDeg: 0,
  },
  sword2h: {
    id: 'sword2h', label: 'شمشیر دو‌دست', file: 'W_Claymore.glb', hand: 'r', twoHanded: true,
    scale: 0.26,
    bladeFrom: [0, 0.3, 0], bladeTo: [0, 6.2, 0], grip2: [0, -0.5, 0],
    gripCenter: [0.06, 0.005, 0.02], rollDeg: 0, pitchDeg: 0,
  },
  axe: {
    id: 'axe', label: 'تبر یک‌دست', file: 'W_Axe.glb', hand: 'r',
    scale: 0.26,
    bladeFrom: [0, 1.2, 0], bladeTo: [0.95, 3.3, 0],
    gripCenter: [0.05, 0.005, 0.02], rollDeg: 0, pitchDeg: 0,
  },
  axe2h: {
    id: 'axe2h', label: 'تبر دو‌دست', file: 'W_Axe_Double.glb', hand: 'r', twoHanded: true,
    scale: 0.25,
    bladeFrom: [0, 1.0, 0], bladeTo: [1.4, 2.6, 0], grip2: [0, -0.6, 0],
    gripCenter: [0.055, 0.005, 0.02], rollDeg: 0, pitchDeg: 0,
  },
  dagger: {
    id: 'dagger', label: 'خنجر', file: 'W_Dagger.glb', hand: 'r',
    scale: 0.22,
    bladeFrom: [0, 0.2, 0], bladeTo: [0, 2.0, 0],
    gripCenter: [0.045, 0.005, 0.015], rollDeg: 0, pitchDeg: 0,
  },
  hammer: {
    id: 'hammer', label: 'پتک دو‌دست', file: 'W_Hammer_Double.glb', hand: 'r', twoHanded: true,
    scale: 0.24,
    bladeFrom: [0, 2.2, 0], bladeTo: [0, 3.19, 0], grip2: [0, -0.7, 0],
    gripCenter: [0.06, 0.005, 0.02], rollDeg: 0, pitchDeg: 0,
  },
  spear: {
    id: 'spear', label: 'نیزه', file: 'W_Spear.glb', hand: 'r', twoHanded: true,
    scale: 0.22,
    bladeFrom: [0, 7.0, 0], bladeTo: [0, 7.56, 0], grip2: [0, -1.6, 0],
    gripCenter: [0.06, 0.005, 0.02], rollDeg: 0, pitchDeg: 0,
  },
  bow: {
    id: 'bow', label: 'کمان', file: 'W_Bow_Wooden.glb', hand: 'l',
    scale: 0.26,
    bladeFrom: [0, -2.7, 0], bladeTo: [0, 2.7, 0],
    gripCenter: [0.05, 0.005, 0.02], rollDeg: 0, pitchDeg: 0,
  },
  shield: {
    id: 'shield', label: 'سپر', file: 'W_Shield_Heater.glb', hand: 'l',
    scale: 0.24,
    bladeFrom: [0, -1.3, 0], bladeTo: [0, 1.26, 0],
    gripCenter: [0.045, 0.01, 0.03], rollDeg: 90, pitchDeg: 0,
    edgeModel: [1, 0, 0],
  },
};

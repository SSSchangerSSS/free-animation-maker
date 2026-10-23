// ─────────────────────────────────────────────────────────────
// موتور فیزیک بدن (Reshape) — تغییر نسبت‌های اسکلتی در زمان اجرا
//
// بدنه‌های استایل‌شایز (چیبی) را با کشیدن استخوان‌ها به نسبت‌های
// قهرمانی (۷.۵ سر) نزدیک می‌کند و اسلایدرهای اندام سبک AAA می‌دهد:
//   leg     — طول پا (ران + ساق)
//   arm     — طول بازو
//   torso   — طول تنه (شکم + قفسه‌سینه)
//   shoulder— پهنای شانه‌ها (فقط محور X قفسه‌سینه)
//   head    — اندازه سر
//   muscle  — ضخامت اعضای نزدیک بدن (ران/بازو)
//
// ⚠️ قانون طلایی: فقط «scale» استخوان‌ها تغییر می‌کند، هرگز «position».
// چون انیمیشن‌های KayKit برای همه‌ی استخوان‌ها track موقعیت دارند و
// position های استراحت را بازنویسی می‌کنند؛ اما track اسکیل ندارند،
// پس تغییر scale در طول انیمیشن پایدار می‌ماند.
//
// جبران زنجیره‌ای: کشیدن استخوان والد، بخش خودش + موقعیت فرزندان را
// می‌کشد؛ فرزند مستقیم با ضریب معکوس جبران می‌شود تا اندازه‌اش ثابت
// بماند. مثال پا: upperLeg.y=√L ، lowerLeg.y=√L ، foot.y=1/L ،
// toes.y=L ⇒ ران و ساق بلندتر، پا و پنجه هم‌اندازهٔ قبل.
// فرود روی زمین خودکار است: bbox بعد از reshape منفی می‌شود و کد
// موجود root.position.y را اصلاح می‌کند ⇒ لگن/پا همیشه روی زمین.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { detectHumanoidBones } from '../animation/retarget';

export interface Physique {
  leg: number;      // 0.85 – 1.30
  arm: number;      // 0.85 – 1.30
  torso: number;    // 0.88 – 1.22
  shoulder: number; // 0.85 – 1.30
  head: number;     // 0.75 – 1.15
  muscle: number;   // 0.85 – 1.30
}

export const DEFAULT_PHYSIQUE: Physique = {
  leg: 1, arm: 1, torso: 1, shoulder: 1, head: 1, muscle: 1,
};

export function isNeutralPhysique(p: Physique): boolean {
  return p.leg === 1 && p.arm === 1 && p.torso === 1
    && p.shoulder === 1 && p.head === 1 && p.muscle === 1;
}

// A22 — بازه‌ی clamp با اسلایدرها هم‌تراز شد: head تا 0.75 و عضله تا 1.35
const clamp01 = (v: number) => Math.min(1.35, Math.max(0.75, v || 1));

/** پیش‌فرض فیزیک هر نژاد — ضدچیبی + شخصیت نژادی */
export const RACE_PHYSIQUE: Record<string, Physique> = {
  human:  { leg: 1.17, arm: 1.10, torso: 1.08, shoulder: 1.13, head: 0.90, muscle: 1.05 },
  elf:    { leg: 1.26, arm: 1.12, torso: 1.10, shoulder: 0.99, head: 0.86, muscle: 0.92 },
  orc:    { leg: 1.10, arm: 1.16, torso: 1.13, shoulder: 1.26, head: 0.85, muscle: 1.30 },
  dwarf:  { leg: 0.87, arm: 1.02, torso: 1.16, shoulder: 1.30, head: 0.93, muscle: 1.32 },
  undead: { leg: 1.14, arm: 1.08, torso: 1.06, shoulder: 1.08, head: 0.90, muscle: 0.96 },
};

type Axis = { x: number; y: number; z: number };
const ax = (x = 1, y = 1, z = 1): Axis => ({ x, y, z });

/**
 * جدول ضریب هر استخوان canonical — حاصل‌ضرب همه‌ی اسلایدرها
 * با جبران‌های زنجیره‌ای. خروجی: canonical → محورهای ضریب.
 */
export function computeRescale(p: Physique): Record<string, Axis> {
  const L = clamp01(p.leg), A = clamp01(p.arm), T = clamp01(p.torso);
  const W = clamp01(p.shoulder), H = clamp01(p.head), M = clamp01(p.muscle);
  const sT = Math.sqrt(T), sL = Math.sqrt(L), sA = Math.sqrt(A);

  const r: Record<string, Axis> = {};
  const set = (k: string, x: number, y: number, z: number) => { r[k] = ax(x, y, z); };

  // ── تنه: شکم و قفسه‌سینه هرکدام √T کشیده می‌شوند؛ گردن جبران می‌شود
  set('spine', 1, sT, 1);
  set('chest', W, 1, 1);          // world.y = √T (از والد) — قفسه کشیده؛ X = پهنای شانه
  set('neck', 1 / W, 1 / sT, 1);  // world.y=1 ، world.x=1
  set('head', H, H, H);

  // ── بازو: طول (√A هر بند) + جبران شانه (1/W) + عضله (M)
  // hand: اگر مچ (wrist) موجود باشد در applyReshape جبران می‌شود؛
  // بدون مچ، hand.y=1/A خودش world را 1 می‌کند (Mixamo بدون wrist است)
  for (const s of ['L', 'R'] as const) {
    set(`upperArm${s}`, (M / W), sA, M);
    set(`lowerArm${s}`, 1 / M, sA, 1 / M);
    set(`hand${s}`, 1, 1 / A, 1);
  }

  // ── پا: طول (√L هر بند) + عضله ران؛ ساق/پا/پنجه جبران
  for (const s of ['L', 'R'] as const) {
    set(`upperLeg${s}`, M, sL, M);
    set(`lowerLeg${s}`, 1 / M, sL, 1 / M);
    set(`foot${s}`, 1, 1 / L, 1);   // world.y = L×(1/L) = 1
  }

  return r;
}

/**
 * اعمال reshape روی ریشه‌ی مدل (KayKit یا مدل واردی استاندارد).
 * استخوان‌ها با detectHumanoidBones شناسایی می‌شوند؛ فقط scale
 * تغییر می‌کند — position دست نمی‌خورد.
 * خروجی: تعداد استخوان‌های تغییرکرده.
 */
export function applyReshape(root: THREE.Object3D, phys: Physique): number {
  if (isNeutralPhysique(phys)) return 0;
  const mapping = detectHumanoidBones(root);
  const table = computeRescale(phys);
  let n = 0;
  for (const [canon, axis] of Object.entries(table)) {
    const bone = mapping.target[canon];
    if (!bone) continue;
    bone.scale.x *= axis.x;
    bone.scale.y *= axis.y;
    bone.scale.z *= axis.z;
    n++;
  }
  // ── مچ دست (KayKit: lowerarm→wrist→hand) — بین بازوی کشیده و دست
  // اگر wrist موجود باشد world آن = A می‌شود؛ جبران 1/A و بازگرداندن
  // دست به 1 (جدول hand.y=1/A برای ریگ‌های بدون wrist است).
  if (phys.arm !== 1) {
    const fix = 1 / clamp01(phys.arm);
    root.traverse((o) => {
      const nm = (o.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!/^(wrist|handwrist)(l|r|left|right)?$/.test(nm)) return;
      o.scale.y *= fix;
      // دستِ همان سمت را به 1 برگردان
      const side = /l$|left$/.test(nm) ? 'L' : 'R';
      const hand = mapping.target[`hand${side}`];
      if (hand) hand.scale.y *= clamp01(phys.arm);
    });
  }
  root.updateMatrixWorld(true);
  return n;
}

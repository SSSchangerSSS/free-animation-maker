// ─────────────────────────────────────────────────────────────
// posekit — کامپایلر پوز: ساخت کلیپ حمله از «قوس هدف نوک تیغه»
//
// مأموریت §۳: حرکات شمشیر باید آماده‌سازی/انتقال وزن/قوس دست و
// تیغه/ادامهٔ حرکت داشته باشند. این کامپایلر پوزها را از قوس‌های
// طراحی‌شدهٔ مچ + IK تحلیلی دواستخوانی روی اسکلت canonical می‌سازد
// — نه حدس زدن زوایای اویلر به‌صورت دستی.
// خروجی: کلیپ canonical (سپس با مسیر موجود retarget می‌شود)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BONE_LOCAL, BONE_WORLD } from '../character/skeleton';
import { qt, hipsPosFull, makeClip, type E } from './trackkit';

// ثابت‌های زنجیره‌ی بازوی canonical (متر)
export const SHOULDER_R = new THREE.Vector3(...BONE_WORLD.upperArmR); // (-0.2, 1.47, 0)
export const SHOULDER_L = new THREE.Vector3(...BONE_WORLD.upperArmL); // (0.2, 1.47, 0)
export const L_UPPER = Math.hypot(...BONE_LOCAL.lowerArmR);           // 0.26
export const L_LOWER = Math.hypot(...BONE_LOCAL.handR);               // 0.22
const REST_DIR_R = new THREE.Vector3(-1, 0, 0);
const REST_DIR_L = new THREE.Vector3(1, 0, 0);
const POLE_R = new THREE.Vector3(0, -1, -0.45).normalize();           // آرنج پایین-عقب
const POLE_L = new THREE.Vector3(0, -1, 0.45).normalize();            // آرنج پایین-جلو

export interface ArmPose {
  upper: THREE.Quaternion;   // محلی (نسبت به والد canonical)
  lower: THREE.Quaternion;
  elbow: THREE.Vector3;      // جهان
  wrist: THREE.Vector3;      // جهان (مبدأ hand)
  forearmDir: THREE.Vector3; // جهان — امتداد ساعد به بیرون
}

/** FK لگن/تنه → کواترنیون جهانی chest و موقعیت شانه */
function torsoFK(
  hipsE: E, spineE: E, chestE: E, hipsDx: number, hipsDy: number, hipsDz: number,
  side: 'l' | 'r',
): { chestQ: THREE.Quaternion; shoulder: THREE.Vector3 } {
  const D = Math.PI / 180;
  const q = (f: E) => new THREE.Quaternion().setFromEuler(
    new THREE.Euler(f[0] * D, f[1] * D, f[2] * D, 'XYZ'),
  );
  const hipsQ = q(hipsE), spineQ = q(spineE), chestQ = q(chestE);
  const chestWorld = hipsQ.clone().multiply(spineQ).multiply(chestQ);
  // مبدأ chest: مبدأ لگن (با جابه‌جایی) + آفست‌های spine/chest چرخیده
  const hipsWorld = new THREE.Vector3(
    BONE_WORLD.hips[0] + hipsDx, BONE_WORLD.hips[1] + hipsDy, BONE_WORLD.hips[2] + hipsDz,
  );
  const spineLocal = new THREE.Vector3(...BONE_LOCAL.spine).applyQuaternion(hipsQ);
  const chestLocal = new THREE.Vector3(...BONE_LOCAL.chest)
    .applyQuaternion(hipsQ.clone().multiply(spineQ));
  const chestOrigin = hipsWorld.clone().add(spineLocal).add(chestLocal);
  const armLocal = new THREE.Vector3(...BONE_LOCAL[`upperArm${side === 'r' ? 'R' : 'L'}`]);
  const shoulder = chestOrigin.add(armLocal.applyQuaternion(chestWorld));
  return { chestQ: chestWorld, shoulder };
}

/**
 * IK تحلیلی دواستخوانی بازو — هدف: مچ در فضای جهان canonical
 * خروجی: چرخش محلی upperArm/lowerArm + هندسه‌ی زنجیره
 */
export function solveArmIK(
  shoulder: THREE.Vector3,
  target: THREE.Vector3,
  chestQ: THREE.Quaternion,
  side: 'l' | 'r',
): ArmPose {
  const l1 = L_UPPER, l2 = L_LOWER;
  const restDir = side === 'r' ? REST_DIR_R : REST_DIR_L;
  const pole = side === 'r' ? POLE_R : POLE_L;

  const delta = target.clone().sub(shoulder);
  const maxD = (l1 + l2) * 0.998;
  const d = Math.min(Math.max(delta.length(), 1e-4), maxD);
  const dir = delta.normalize();

  // مؤلفه‌ی عمود pole نسبت به dir — صفحه‌ی مفصل آرنج
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-6) {
    perp.set(0, 0, 1).cross(dir);
    if (perp.lengthSq() < 1e-6) perp.set(0, 1, 0).cross(dir);
  }
  perp.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const elbow = shoulder.clone().addScaledVector(dir, a).addScaledVector(perp, h);
  const wrist = shoulder.clone().addScaledVector(dir, d);

  const dUpper = elbow.clone().sub(shoulder).normalize();
  const dLower = wrist.clone().sub(elbow).normalize();

  // چرخش‌های جهانی قطعات:
  //   upperWorld·restDir = dUpper  (restDir با چرخش والد chest به جهان می‌رود)
  //   lowerWorld·restDir = dLower  (restDir ساعد در قاب خودش)
  const restWorld = restDir.clone().applyQuaternion(chestQ);
  const upWorld = new THREE.Quaternion().setFromUnitVectors(restWorld, dUpper).multiply(chestQ);
  const loWorld = new THREE.Quaternion().setFromUnitVectors(restDir, dLower);

  // به فضای محلی: upper = chestQ⁻¹·upWorld، lower = upWorld⁻¹·loWorld
  const upper = chestQ.clone().invert().multiply(upWorld);
  const lower = upWorld.clone().invert().multiply(loWorld);
  return { upper, lower, elbow, wrist, forearmDir: dLower };
}

/** هندسه‌ی سلاح لازم برای کامپایل — متر، قاب canonical */
export interface WeaponGeom {
  /** فاصله‌ی مرکز چنگ از مچ در امتداد ساعد */
  gripAhead: number;
  /** فاصله‌ی نقطه‌ی دست دوم از مچ در امتداد ساعد (منفی = سمت دسته) */
  grip2Ahead: number;
  /** طول مؤثر تیغه از مرکز چنگ */
  bladeLen: number;
}

export function swordGeom(scale: number, bladeTo: [number, number, number], grip2?: [number, number, number]): WeaponGeom {
  return {
    gripAhead: 0.055,
    grip2Ahead: grip2 ? grip2[1] * scale : 0,
    bladeLen: bladeTo[1] * scale,
  };
}

// ── طراحی قوس حمله‌ی یک‌دست (شمشیر راست) ─────────────────────
// فازها: گارد → کولس (کند، انتظار) → اوج → رهاسازی مورب نزولی تند
// → ادامه → بازیابی → گارد. مچ طراحی می‌شود؛ تیغه امتداد ساعد است.
export const ARC_1H: { t: number; w: [number, number, number]; /** مچ راست */ }[] = [
  { t: 0.0, w: [-0.44, 1.32, 0.22] },   // گارد — جمع و رو به جلو
  { t: 0.14, w: [-0.52, 1.58, -0.14] },  // کولس — بالا بیرون عقب
  { t: 0.26, w: [-0.58, 1.66, -0.08] },  // اوج کولس
  { t: 0.36, w: [-0.3, 1.3, 0.34] },    // رهاسازی — شیب تند رو به جلو
  { t: 0.46, w: [-0.14, 1.06, 0.4] },   // پایان قوس — بازو کشیده
  { t: 0.62, w: [-0.18, 1.12, 0.3] },   // ادامه
  { t: 0.8, w: [-0.4, 1.24, 0.2] },     // بازیابی
  { t: 0.95, w: [-0.44, 1.32, 0.22] },  // گارد
];

// پوزهای هم‌زمان تنه/لگن/سر (درجه) — فازبندی با قوس
export const TORSO_1H: { hips: E; spine: E; chest: E; neck: E; head: E }[] = [
  { hips: [0, 8, 0], spine: [2, 4, 0], chest: [3, 6, 0], neck: [0, -2, 0], head: [0, -3, 0] },
  { hips: [0, -6, 0], spine: [-2, -4, 0], chest: [-4, -8, 0], neck: [1, 3, 0], head: [1, 4, 0] },
  { hips: [0, -9, 0], spine: [-3, -5, 0], chest: [-5, -11, 0], neck: [2, 4, 0], head: [2, 5, 0] },
  { hips: [2, 12, 0], spine: [5, 7, 0], chest: [9, 14, 0], neck: [-2, -4, 0], head: [-3, -5, 0] },
  { hips: [3, 16, 0], spine: [7, 9, 0], chest: [12, 18, 0], neck: [-3, -5, 0], head: [-4, -6, 0] },
  { hips: [2, 13, 0], spine: [6, 7, 0], chest: [10, 14, 0], neck: [-2, -4, 0], head: [-3, -5, 0] },
  { hips: [1, 10, 0], spine: [3, 5, 0], chest: [5, 9, 0], neck: [-1, -3, 0], head: [-1, -4, 0] },
  { hips: [0, 8, 0], spine: [2, 4, 0], chest: [3, 6, 0], neck: [0, -2, 0], head: [0, -3, 0] },
];

// جابه‌جایی لگن — یورش به جلو در ضربه
export const HIPS_POS_1H: [number, number, number][] = [
  [0, 0, 0], [0, -0.012, -0.015], [0, -0.016, -0.02],
  [0.01, -0.02, 0.04], [0.015, -0.03, 0.05], [0.01, -0.025, 0.04],
  [0.005, -0.01, 0.02], [0, 0, 0],
];

// پاها — وزن راست در کولس، یورش لانگ راست در ضربه
const LEGS_1H: { ulR: E; llR: E; ftR: E; ulL: E; llL: E; ftL: E }[] = [
  { ulR: [-6, 0, 3], llR: [10, 0, 0], ftR: [-3, 0, 0], ulL: [4, 0, -3], llL: [8, 0, 0], ftL: [-2, 0, 0] },
  { ulR: [-10, 0, 4], llR: [16, 0, 0], ftR: [-5, 0, 0], ulL: [6, 0, -4], llL: [10, 0, 0], ftL: [-3, 0, 0] },
  { ulR: [-12, 0, 4], llR: [18, 0, 0], ftR: [-6, 0, 0], ulL: [7, 0, -4], llL: [11, 0, 0], ftL: [-3, 0, 0] },
  { ulR: [-24, 0, 2], llR: [26, 0, 0], ftR: [-10, 0, 0], ulL: [10, 0, -5], llL: [8, 0, 0], ftL: [6, 0, 0] },
  { ulR: [-28, 0, 2], llR: [30, 0, 0], ftR: [-12, 0, 0], ulL: [12, 0, -5], llL: [8, 0, 0], ftL: [8, 0, 0] },
  { ulR: [-22, 0, 2], llR: [24, 0, 0], ftR: [-9, 0, 0], ulL: [10, 0, -5], llL: [8, 0, 0], ftL: [6, 0, 0] },
  { ulR: [-10, 0, 3], llR: [14, 0, 0], ftR: [-5, 0, 0], ulL: [5, 0, -3], llL: [8, 0, 0], ftL: [0, 0, 0] },
  { ulR: [-6, 0, 3], llR: [10, 0, 0], ftR: [-3, 0, 0], ulL: [4, 0, -3], llL: [8, 0, 0], ftL: [-2, 0, 0] },
];

// بازوی چپ — متعادل‌کننده: کولس جلو-پایین، ضربه عقب-بیرون
export const ARC_1H_L: { t: number; w: [number, number, number] }[] = [
  { t: 0.0, w: [0.4, 1.25, 0.18] },
  { t: 0.14, w: [0.45, 1.35, 0.3] },
  { t: 0.26, w: [0.48, 1.38, 0.34] },
  { t: 0.36, w: [0.3, 1.3, -0.1] },
  { t: 0.46, w: [0.15, 1.25, -0.28] },
  { t: 0.62, w: [0.2, 1.28, -0.22] },
  { t: 0.8, w: [0.35, 1.26, 0.05] },
  { t: 0.95, w: [0.4, 1.25, 0.18] },
];

interface CompiledPose {
  times: number[];
  upR: THREE.Quaternion[]; loR: THREE.Quaternion[];
  upL: THREE.Quaternion[]; loL: THREE.Quaternion[];
  tipR: THREE.Vector3[];
  bladeBaseR: THREE.Vector3[];
}

/** کامپایل قوس مچ → پوز کامل بازوها (برای تست و ساخت کلیپ) */
export function compileArmPoses(
  arcR: { t: number; w: [number, number, number] }[],
  arcL: { t: number; w: [number, number, number] }[],
  torso: { hips: E; spine: E; chest: E }[],
  hipsPos: [number, number, number][],
): CompiledPose {
  const times = arcR.map((k) => k.t);
  const out: CompiledPose = {
    times, upR: [], loR: [], upL: [], loL: [], tipR: [], bladeBaseR: [],
  };
  for (let i = 0; i < arcR.length; i++) {
    const { chestQ, shoulder: shR } = torsoFK(
      torso[i].hips, torso[i].spine, torso[i].chest,
      hipsPos[i][0], hipsPos[i][1], hipsPos[i][2], 'r',
    );
    const pR = solveArmIK(shR, new THREE.Vector3(...arcR[i].w), chestQ, 'r');
    out.upR.push(pR.upper); out.loR.push(pR.lower);
    // تیغه = مرکز چنگ + امتداد ساعد × طول تیغه (قاب canonical: gripAhead=0.055, blade=1.17)
    const base = pR.wrist.clone().addScaledVector(pR.forearmDir, 0.055);
    out.bladeBaseR.push(base.clone());
    out.tipR.push(base.clone().addScaledVector(pR.forearmDir, 1.17));
    const { chestQ: chestQL, shoulder: shL } = torsoFK(
      torso[i].hips, torso[i].spine, torso[i].chest,
      hipsPos[i][0], hipsPos[i][1], hipsPos[i][2], 'l',
    );
    const pL = solveArmIK(shL, new THREE.Vector3(...arcL[i].w), chestQL, 'l');
    out.upL.push(pL.upper); out.loL.push(pL.lower);
  }
  return out;
}

/** کلیپ حمله‌ی یک‌دست — کامپایل‌شده از قوس تیغه */
export function compileAttack1H(): THREE.AnimationClip {
  const pose = compileArmPoses(ARC_1H, ARC_1H_L, TORSO_1H, HIPS_POS_1H);
  const t = pose.times;
  const deg = (q: THREE.Quaternion): E => {
    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
    return [+(e.x / (Math.PI / 180)).toFixed(2), +(e.y / (Math.PI / 180)).toFixed(2), +(e.z / (Math.PI / 180)).toFixed(2)];
  };
  const tracks = [
    qt('upperArmR', t, pose.upR.map(deg)),
    qt('lowerArmR', t, pose.loR.map(deg)),
    qt('upperArmL', t, pose.upL.map(deg)),
    qt('lowerArmL', t, pose.loL.map(deg)),
    qt('hips', t, TORSO_1H.map((x) => x.hips)),
    qt('spine', t, TORSO_1H.map((x) => x.spine)),
    qt('chest', t, TORSO_1H.map((x) => x.chest)),
    qt('neck', t, TORSO_1H.map((x) => x.neck)),
    qt('head', t, TORSO_1H.map((x) => x.head)),
    qt('upperLegR', t, LEGS_1H.map((x) => x.ulR)),
    qt('lowerLegR', t, LEGS_1H.map((x) => x.llR)),
    qt('footR', t, LEGS_1H.map((x) => x.ftR)),
    qt('upperLegL', t, LEGS_1H.map((x) => x.ulL)),
    qt('lowerLegL', t, LEGS_1H.map((x) => x.llL)),
    qt('footL', t, LEGS_1H.map((x) => x.ftL)),
    hipsPosFull(t, HIPS_POS_1H),
  ];
  return makeClip('attack', t[t.length - 1], tracks);
}

/** قوس نوک تیغه‌ی حمله‌ی یک‌دست — برای آزمون و QA */
export function attack1HTipArc(): { t: number; base: THREE.Vector3; tip: THREE.Vector3 }[] {
  const pose = compileArmPoses(ARC_1H, ARC_1H_L, TORSO_1H, HIPS_POS_1H);
  return pose.times.map((t, i) => ({
    t, base: pose.bladeBaseR[i], tip: pose.tipR[i],
  }));
}

// ── حمله‌ی دو‌دست — مچ راست قوس اصلی، مچ چپ روی grip2 سلاح ───
// قوس ۲H: دست‌ها جلوی جناغ می‌رسند (چنگ دو‌دست واقعی) و تنه با
// خم رو به جلو (pitch) ضربه را می‌کوبد — تا grip2 همیشه در برد
// بازوی چپ (۰.۴۸m) بماند (مأموریت §۲: دست دوم متصل).
export const ARC_2H: { t: number; w: [number, number, number] }[] = [
  { t: 0.0, w: [-0.15, 1.32, 0.3] },   // گارد — دست‌ها جلو-مرکز
  { t: 0.14, w: [-0.18, 1.6, 0.1] },   // کولس — بالا جلو
  { t: 0.26, w: [-0.2, 1.66, 0.12] },  // اوج کولس
  { t: 0.36, w: [-0.1, 1.3, 0.42] },   // رهاسازی
  { t: 0.46, w: [0.0, 1.12, 0.44] },   // پایان قوس — هر دو بازو کشیده
  { t: 0.62, w: [0.02, 1.14, 0.42] },  // ادامه
  { t: 0.8, w: [-0.12, 1.24, 0.34] },  // بازیابی
  { t: 0.95, w: [-0.15, 1.32, 0.3] },  // گارد
];

export const TORSO_2H: { hips: E; spine: E; chest: E; neck: E; head: E }[] = [
  { hips: [0, 6, 0], spine: [3, 3, 0], chest: [5, 4, 0], neck: [0, -2, 0], head: [0, -3, 0] },
  { hips: [0, -6, 0], spine: [2, -4, 0], chest: [-6, -6, 0], neck: [1, 3, 0], head: [1, 4, 0] },
  { hips: [0, -8, 0], spine: [0, -5, 0], chest: [-8, -7, 0], neck: [2, 3, 0], head: [2, 4, 0] },
  { hips: [2, 8, 0], spine: [8, 5, 0], chest: [16, 10, 0], neck: [-3, -3, 0], head: [-4, -4, 0] },
  { hips: [3, 10, 0], spine: [12, 6, 0], chest: [24, 12, 0], neck: [-4, -4, 0], head: [-5, -5, 0] },
  { hips: [2, 9, 0], spine: [11, 5, 0], chest: [22, 11, 0], neck: [-3, -3, 0], head: [-4, -4, 0] },
  { hips: [1, 7, 0], spine: [5, 4, 0], chest: [9, 6, 0], neck: [-1, -2, 0], head: [-2, -3, 0] },
  { hips: [0, 6, 0], spine: [3, 3, 0], chest: [5, 4, 0], neck: [0, -2, 0], head: [0, -3, 0] },
];

/** کلیپ حمله‌ی دو‌دست — مچ چپ خودکار روی grip2 */
export function compileAttack2H(g: WeaponGeom): THREE.AnimationClip {
  const times = ARC_2H.map((k) => k.t);
  const upR: THREE.Quaternion[] = [], loR: THREE.Quaternion[] = [];
  const upL: THREE.Quaternion[] = [], loL: THREE.Quaternion[] = [];
  for (let i = 0; i < ARC_2H.length; i++) {
    const { chestQ, shoulder: shR } = torsoFK(
      TORSO_2H[i].hips, TORSO_2H[i].spine, TORSO_2H[i].chest,
      HIPS_POS_1H[i][0], HIPS_POS_1H[i][1], HIPS_POS_1H[i][2], 'r',
    );
    const pR = solveArmIK(shR, new THREE.Vector3(...ARC_2H[i].w), chestQ, 'r');
    upR.push(pR.upper); loR.push(pR.lower);
    // دست دوم: نقطه‌ی grip2 روی دسته (امتداد ساعد راست)
    const grip2 = pR.wrist.clone()
      .addScaledVector(pR.forearmDir, g.gripAhead + g.grip2Ahead);
    const { chestQ: chestQL, shoulder: shL } = torsoFK(
      TORSO_2H[i].hips, TORSO_2H[i].spine, TORSO_2H[i].chest,
      HIPS_POS_1H[i][0], HIPS_POS_1H[i][1], HIPS_POS_1H[i][2], 'l',
    );
    const pL = solveArmIK(shL, grip2, chestQL, 'l');
    upL.push(pL.upper); loL.push(pL.lower);
  }
  const t = times;
  const deg = (q: THREE.Quaternion): E => {
    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
    return [+(e.x / (Math.PI / 180)).toFixed(2), +(e.y / (Math.PI / 180)).toFixed(2), +(e.z / (Math.PI / 180)).toFixed(2)];
  };
  const tracks = [
    qt('upperArmR', t, upR.map(deg)),
    qt('lowerArmR', t, loR.map(deg)),
    qt('upperArmL', t, upL.map(deg)),
    qt('lowerArmL', t, loL.map(deg)),
    qt('hips', t, TORSO_2H.map((x) => x.hips)),
    qt('spine', t, TORSO_2H.map((x) => x.spine)),
    qt('chest', t, TORSO_2H.map((x) => x.chest)),
    qt('neck', t, TORSO_2H.map((x) => x.neck)),
    qt('head', t, TORSO_2H.map((x) => x.head)),
    qt('upperLegR', t, LEGS_1H.map((x) => x.ulR)),
    qt('lowerLegR', t, LEGS_1H.map((x) => x.llR)),
    qt('footR', t, LEGS_1H.map((x) => x.ftR)),
    qt('upperLegL', t, LEGS_1H.map((x) => x.ulL)),
    qt('lowerLegL', t, LEGS_1H.map((x) => x.llL)),
    qt('footL', t, LEGS_1H.map((x) => x.ftL)),
    hipsPosFull(t, HIPS_POS_1H),
  ];
  return makeClip('attack2h', t[t.length - 1], tracks);
}

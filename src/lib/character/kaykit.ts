// ─────────────────────────────────────────────────────────────
// رجیستری بدنه‌های KayKit (CC0) — لودر کش‌شده + سلاح‌های داخلی +
// قواعد بازرنگی هر بدنه بر اساس تحلیل پالت اطلس
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { RecolorRule } from './recolor';

export type BodyId =
  | 'Rogue' | 'Knight' | 'Barbarian' | 'Mage' | 'Rogue_Hooded'
  | 'Skeleton_Warrior' | 'Skeleton_Minion';

export interface WeaponOption { id: string; label: string; nodes: string[] }
export interface ToggleDef { id: 'helmet' | 'cape'; label: string; nodes: string[] }

export interface BodyDef {
  id: BodyId;
  label: string;
  desc: string;
  file: string;
  family: 'adventurer' | 'skeleton';
  weapons: WeaponOption[];
  defaultWeapon: string;
  helmet?: ToggleDef;
  cape?: ToggleDef;
  /** می‌توان موی داخلی را پاک کرد (سر کچل شدنی است) */
  hairErasable: boolean;
  beardErasable: boolean;
  rules: {
    skin: RecolorRule[];
    hair: RecolorRule[];
    cloth: RecolorRule[];
    metal?: RecolorRule[];
    bone?: RecolorRule[];
  };
}

// میان‌بر بازه‌ها
const skinRange = (light: [number, number] = [0.55, 0.9]): RecolorRule['range'] =>
  ({ hue: [12, 38], sat: [0.1, 0.9], light });

const SKIN_ALL_PARTS = ['armleft', 'armright', 'body', 'head', 'legleft', 'legright'];
const SKIN_HEAD_ONLY = ['head'];
const SKIN_ARMS = ['armleft', 'armright'];

// ── قواعد مشترک مهاجران ─────────────────────────────────────
const ADVENTURER_SKIN: RecolorRule[] = [
  // پوست صورت/سینه/پا — بازه‌ی استاندارد گرم روشن
  { parts: SKIN_ALL_PARTS, range: skinRange([0.55, 0.9]), meanL: 0.78 },
  // دست‌ها (روی تکه‌ی بازو، پوست روشن‌تر از چرم بازوست)
  { parts: SKIN_ARMS, range: skinRange([0.68, 0.92]), meanL: 0.8 },
];

const ADVENTURER_HAIR: Record<string, RecolorRule[]> = {
  // نایت: موی بلوند زیر خود (فقط وقتی خود خاموش است دیده می‌شود)
  Knight: [{ parts: ['head'], range: { hue: [35, 58], sat: [0.25, 0.85], light: [0.45, 0.9] }, meanL: 0.68 }],
  // بربر: ریش/ابروی خاکستری
  Barbarian: [{ parts: ['head'], range: { hue: [0, 360], sat: [0, 0.16], light: [0.38, 0.72] }, meanL: 0.55 }],
  // جادومند: موی مشکی + ریش نارنجی
  Mage: [
    { parts: ['head'], range: { hue: [10, 40], sat: [0.5, 1], light: [0.2, 0.6] }, meanL: 0.4 },
    { parts: ['head'], range: { hue: [0, 360], sat: [0, 0.18], light: [0.08, 0.3] }, meanL: 0.18 },
  ],
  // راهزن: دستمال نارنجی + موی سبز
  Rogue: [
    { parts: ['head'], range: { hue: [12, 32], sat: [0.6, 1], light: [0.35, 0.7] }, meanL: 0.52 },
    { parts: ['head'], range: { hue: [95, 150], sat: [0.25, 0.8], light: [0.35, 0.8] }, meanL: 0.6 },
  ],
  Rogue_Hooded: [
    { parts: ['head'], range: { hue: [12, 32], sat: [0.6, 1], light: [0.35, 0.7] }, meanL: 0.52 },
    { parts: ['head'], range: { hue: [95, 150], sat: [0.25, 0.8], light: [0.35, 0.8] }, meanL: 0.6 },
  ],
};

const ADVENTURER_CLOTH: Record<string, RecolorRule[]> = {
  Knight: [
    // شنل و نشان سرخ
    { parts: ['cape', 'body', 'head'], range: { hue: [348, 372], sat: [0.45, 1], light: [0.25, 0.75] }, meanL: 0.45 },
  ],
  Barbarian: [
    // پیراهن آبی
    { parts: ['body', 'legleft', 'legright'], range: { hue: [192, 228], sat: [0.12, 0.75], light: [0.18, 0.72] }, meanL: 0.45 },
  ],
  Mage: [
    // ردا و کلاه بنفش
    { parts: ['body', 'legleft', 'legright'], range: { hue: [225, 275], sat: [0.12, 0.8], light: [0.1, 0.55] }, meanL: 0.32 },
    // حاشیه‌های سرخ
    { parts: ['body', 'armleft', 'armright'], range: { hue: [348, 372], sat: [0.5, 1], light: [0.2, 0.7] }, meanL: 0.45 },
  ],
  Rogue: [
    // تونیک سبز
    { parts: ['body', 'legleft', 'legright'], range: { hue: [140, 178], sat: [0.4, 1], light: [0.08, 0.6] }, meanL: 0.33 },
  ],
  Rogue_Hooded: [
    { parts: ['body', 'legleft', 'legright'], range: { hue: [140, 178], sat: [0.4, 1], light: [0.08, 0.6] }, meanL: 0.33 },
    // کلاه‌سرِ سبز تیره روی سر
    { parts: ['head'], range: { hue: [140, 178], sat: [0.4, 1], light: [0.08, 0.6] }, meanL: 0.33 },
  ],
};

// فلز خاکستری نایت (زره)
const KNIGHT_METAL: RecolorRule[] = [
  { parts: ['armleft', 'armright', 'body', 'legleft', 'legright'], range: { hue: [0, 360], sat: [0, 0.13], light: [0.35, 0.93] }, meanL: 0.7 },
];

const SKELETON_SKIN: RecolorRule[] = [
  // استخوان بنفش-آبی
  { parts: ['armleft', 'armright', 'body', 'head', 'legleft', 'legright', 'jaw'], range: { hue: [225, 262], sat: [0.1, 0.55], light: [0.28, 0.62] }, meanL: 0.44 },
];
const SKELETON_CLOTH: RecolorRule[] = [
  // شنل کرم
  { parts: ['cloak'], range: { hue: [22, 55], sat: [0.05, 0.4], light: [0.72, 0.95] }, meanL: 0.84 },
];

export const BODIES: Record<BodyId, BodyDef> = {
  Rogue: {
    id: 'Rogue', label: 'راهزن', desc: 'چابک و سبک — تونیک سبز و دستمال', file: 'Rogue.glb', family: 'adventurer',
    weapons: [
      { id: 'none', label: 'بی‌سلاح', nodes: [] },
      { id: 'knife', label: 'خنجر', nodes: ['Knife'] },
      { id: 'dual', label: 'خنجر دوگانه', nodes: ['Knife', 'Knife_Offhand'] },
      { id: 'crossbow', label: 'کمان‌کلاهچینی', nodes: ['1H_Crossbow'] },
      { id: 'crossbow2h', label: 'کمان سنگین', nodes: ['2H_Crossbow'] },
    ],
    defaultWeapon: 'knife',
    cape: { id: 'cape', label: 'شنل', nodes: ['Rogue_Cape'] },
    hairErasable: true, beardErasable: false,
    rules: { skin: ADVENTURER_SKIN, hair: ADVENTURER_HAIR.Rogue, cloth: ADVENTURER_CLOTH.Rogue },
  },
  Knight: {
    id: 'Knight', label: 'پالادین', desc: 'زره کامل فولادی — سپر و شمشیر', file: 'Knight.glb', family: 'adventurer',
    weapons: [
      { id: 'none', label: 'بی‌سلاح', nodes: [] },
      { id: 'sword', label: 'شمشیر یک‌دست', nodes: ['1H_Sword'] },
      { id: 'swordShield', label: 'شمشیر و سپر', nodes: ['1H_Sword', 'Badge_Shield'] },
      { id: 'swordRound', label: 'شمشیر و سپر گرد', nodes: ['1H_Sword', 'Round_Shield'] },
      { id: 'sword2h', label: 'شمشیر دو‌دست', nodes: ['2H_Sword'] },
    ],
    defaultWeapon: 'swordShield',
    helmet: { id: 'helmet', label: 'خود', nodes: ['Knight_Helmet'] },
    cape: { id: 'cape', label: 'شنل', nodes: ['Knight_Cape'] },
    hairErasable: true, beardErasable: false,
    rules: {
      skin: ADVENTURER_SKIN, hair: ADVENTURER_HAIR.Knight,
      cloth: ADVENTURER_CLOTH.Knight, metal: KNIGHT_METAL,
    },
  },
  Barbarian: {
    id: 'Barbarian', label: 'بربر', desc: 'تنومند و وحشی — کلاه خز و تبر', file: 'Barbarian.glb', family: 'adventurer',
    weapons: [
      { id: 'none', label: 'بی‌سلاح', nodes: [] },
      { id: 'axe', label: 'تبر یک‌دست', nodes: ['1H_Axe'] },
      { id: 'axe2h', label: 'تبر دو‌دست', nodes: ['2H_Axe'] },
      { id: 'axeShield', label: 'تبر و سپر', nodes: ['1H_Axe', 'Barbarian_Round_Shield'] },
    ],
    defaultWeapon: 'axe',
    helmet: { id: 'helmet', label: 'کلاه خز', nodes: ['Barbarian_Hat'] },
    cape: { id: 'cape', label: 'شنل', nodes: ['Barbarian_Cape'] },
    hairErasable: false, beardErasable: true,
    rules: { skin: ADVENTURER_SKIN, hair: ADVENTURER_HAIR.Barbarian, cloth: ADVENTURER_CLOTH.Barbarian },
  },
  Mage: {
    id: 'Mage', label: 'جادومند', desc: 'ردای بنفش و کلاه نوک‌تیز', file: 'Mage.glb', family: 'adventurer',
    weapons: [
      { id: 'none', label: 'بی‌سلاح', nodes: [] },
      { id: 'staff', label: 'عصای دو‌سر', nodes: ['2H_Staff'] },
      { id: 'wand', label: 'چوب‌جرقه و کتاب', nodes: ['1H_Wand', 'Spellbook'] },
      { id: 'wandOpen', label: 'چوب‌جرقه و کتاب باز', nodes: ['1H_Wand', 'Spellbook_open'] },
    ],
    defaultWeapon: 'staff',
    helmet: { id: 'helmet', label: 'کلاه جادو', nodes: ['Mage_Hat'] },
    cape: { id: 'cape', label: 'شنل', nodes: ['Mage_Cape'] },
    hairErasable: true, beardErasable: true,
    rules: { skin: ADVENTURER_SKIN, hair: ADVENTURER_HAIR.Mage, cloth: ADVENTURER_CLOTH.Mage },
  },
  Rogue_Hooded: {
    id: 'Rogue_Hooded', label: 'سایه‌روان', desc: 'کلاه‌برداری مرموز با شنل', file: 'Rogue_Hooded.glb', family: 'adventurer',
    weapons: [
      { id: 'none', label: 'بی‌سلاح', nodes: [] },
      { id: 'knife', label: 'خنجر', nodes: ['Knife'] },
      { id: 'dual', label: 'خنجر دوگانه', nodes: ['Knife', 'Knife_Offhand'] },
      { id: 'crossbow', label: 'کمان‌کلاهچینی', nodes: ['1H_Crossbow'] },
    ],
    defaultWeapon: 'knife',
    cape: { id: 'cape', label: 'شنل', nodes: ['Rogue_Cape'] },
    hairErasable: false, beardErasable: false,
    rules: { skin: ADVENTURER_SKIN, hair: ADVENTURER_HAIR.Rogue_Hooded, cloth: ADVENTURER_CLOTH.Rogue_Hooded },
  },
  Skeleton_Warrior: {
    id: 'Skeleton_Warrior', label: 'مرده‌جنگجو', desc: 'اسکلت زره‌پوش با خود گنجشکی', file: 'Skeleton_Warrior.glb', family: 'skeleton',
    weapons: [{ id: 'none', label: 'بی‌سلاح', nodes: [] }],
    defaultWeapon: 'none',
    helmet: { id: 'helmet', label: 'خود', nodes: ['Skeleton_Warrior_Helmet'] },
    hairErasable: false, beardErasable: false,
    rules: { skin: SKELETON_SKIN, hair: [], cloth: SKELETON_CLOTH, bone: SKELETON_SKIN },
  },
  Skeleton_Minion: {
    id: 'Skeleton_Minion', label: 'مرده‌کوچک', desc: 'اسکلت ریزه‌ک و شیطون', file: 'Skeleton_Minion.glb', family: 'skeleton',
    weapons: [{ id: 'none', label: 'بی‌سلاح', nodes: [] }],
    defaultWeapon: 'none',
    hairErasable: false, beardErasable: false,
    rules: { skin: SKELETON_SKIN, hair: [], cloth: SKELETON_CLOTH, bone: SKELETON_SKIN },
  },
};

// ── لودر کش‌شده ──────────────────────────────────────────────
export interface LoadedBody {
  def: BodyDef;
  /** صحنه‌ی دست‌نخورده برای کلون (نباید به صحنه اضافه شود) */
  pristine: THREE.Group;
  animations: THREE.AnimationClip[];
  /** ابعاد مرجع */
  height: number;
}

const cache = new Map<BodyId, Promise<LoadedBody>>();

function modelUrl(file: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${base}/models/${file}`;
}

export function loadBody(id: BodyId): Promise<LoadedBody> {
  let p = cache.get(id);
  if (p) return p;
  const def = BODIES[id];
  p = new Promise<LoadedBody>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      modelUrl(def.file),
      (gltf) => {
        const root = gltf.scene;
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const height = Math.max(0.01, box.max.y - box.min.y);
        // انیمیشن‌های مفید: T-Pose و _Pose ها را نگه نمی‌داریم
        const animations = (gltf.animations ?? []).filter((a) => !/_Pose$|^T-Pose$/.test(a.name));
        resolve({ def, pristine: root, animations, height });
      },
      undefined,
      (err) => reject(err),
    );
  });
  cache.set(id, p);
  return p;
}

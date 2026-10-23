// ─────────────────────────────────────────────────────────────
// Character Creator V2 — پیکربندی شخصیت روی بدنه‌های KayKit
// نژاد = ویژگی‌های نژادی + بدنه‌های مجاز — بدنه = مدل KayKit
// ─────────────────────────────────────────────────────────────
import type { BodyId } from './kaykit';
import { BODIES } from './kaykit';
import type { HairStyleId, BeardStyleId } from './featuresKaykit';
import type { Physique } from './reshape';
import { RACE_PHYSIQUE, DEFAULT_PHYSIQUE } from './reshape';

export type { BodyId, HairStyleId, BeardStyleId, Physique };

export type RaceId = 'human' | 'elf' | 'orc' | 'dwarf' | 'undead';

export interface CharConfig {
  name: string;
  race: RaceId;
  body: BodyId;
  skin: string;
  hair: HairStyleId;
  hairColor: string;
  beard: BeardStyleId;
  beardColor: string;
  ears: boolean;
  tusks: boolean;
  cloth: string;
  metal: string;
  bone: string;
  weapon: string;
  helmet: boolean;
  cape: boolean;
  height: number; // 0.62 – 1.12
  bulk: number;   // 0.85 – 1.25 (پهنای XZ)
  /** نسبت‌های اسکلتی — ضدچیبی + اسلایدرهای اندام AAA */
  physique: Physique;
}

const PHYS = (race: RaceId): Physique => RACE_PHYSIQUE[race] ?? DEFAULT_PHYSIQUE;

export interface RacePreset {
  id: RaceId;
  label: string;
  desc: string;
  bodies: BodyId[];
  defaultBody: BodyId;
  defaultHeight: number;
  defaultBulk: number;
  ears: boolean;
  tusks: boolean;
  defaults: Omit<CharConfig, 'name' | 'race' | 'body' | 'height' | 'bulk' | 'ears' | 'tusks' | 'physique'>;
  names: string[];
}

const HUMAN_DEFAULTS = {
  // (فیزیک از RACE_PHYSIQUE می‌آید)
  skin: '#eab586', hair: 'baked' as HairStyleId, hairColor: '#4a3220',
  beard: 'baked' as BeardStyleId, beardColor: '#4a3220',
  cloth: '#8a3c3c', metal: '#c8c8cf', bone: '#9a96b8',
  weapon: 'sword', helmet: false, cape: false,
};

const ELF_DEFAULTS = {
  skin: '#f4dcc0', hair: 'baked' as HairStyleId, hairColor: '#e8d9a0',
  beard: 'none' as BeardStyleId, beardColor: '#e8d9a0',
  cloth: '#3d5a44', metal: '#d4af37', bone: '#9a96b8',
  weapon: 'none', helmet: false, cape: false,
};

const ORC_DEFAULTS = {
  skin: '#6f8f4f', hair: 'mohawk' as HairStyleId, hairColor: '#1c1c1c',
  beard: 'none' as BeardStyleId, beardColor: '#241f16',
  cloth: '#5b4a35', metal: '#8a8f98', bone: '#e6dcc3',
  weapon: 'axe', helmet: false, cape: false,
};

const DWARF_DEFAULTS = {
  skin: '#e0a878', hair: 'short' as HairStyleId, hairColor: '#a9442e',
  beard: 'full' as BeardStyleId, beardColor: '#a9442e',
  cloth: '#6b5a2e', metal: '#c8c8cf', bone: '#9a96b8',
  weapon: 'sword', helmet: false, cape: false,
};

const UNDEAD_DEFAULTS = {
  skin: '#8d89ad', hair: 'none' as HairStyleId, hairColor: '#1c1c1c',
  beard: 'none' as BeardStyleId, beardColor: '#1c1c1c',
  cloth: '#c9b896', metal: '#6e6e78', bone: '#8d89ad',
  weapon: 'none', helmet: true, cape: false,
};

export const RACES: Record<RaceId, RacePreset> = {
  human: {
    id: 'human', label: 'انسان', desc: 'متعادل و سازگار — از راهزن تا پالادین',
    bodies: ['Rogue', 'Knight', 'Barbarian', 'Mage'], defaultBody: 'Knight',
    defaultHeight: 1, defaultBulk: 1, ears: false, tusks: false,
    defaults: HUMAN_DEFAULTS,
    names: ['آریوبرزن', 'رستم', 'سهراب', 'گیو', 'بهرام', 'ژوبین', 'اردشیر', 'طوس'],
  },
  elf: {
    id: 'elf', label: 'الف', desc: 'بلندقامت جنگل‌های جاودانه — با گوش‌های تیز',
    bodies: ['Rogue_Hooded', 'Mage'], defaultBody: 'Rogue_Hooded',
    defaultHeight: 1.06, defaultBulk: 0.92, ears: true, tusks: false,
    defaults: ELF_DEFAULTS,
    names: ['ائارین', 'سلون‌تیر', 'لثارئل', 'آرِن‌دیل', 'سیلوَن', 'تارمین', 'ائوگلین'],
  },
  orc: {
    id: 'orc', label: 'ارگ', desc: 'تنومند جنگل‌های سیاه — با عاج‌های خشم',
    bodies: ['Barbarian'], defaultBody: 'Barbarian',
    defaultHeight: 1.08, defaultBulk: 1.22, ears: false, tusks: true,
    defaults: ORC_DEFAULTS,
    names: ['گروش‌نک', 'موگور', 'زاروگ', 'کراش', 'اِرومال', 'دورگ', 'بلاک‌دست'],
  },
  dwarf: {
    id: 'dwarf', label: 'دورف', desc: 'کوتاه‌قد کوه‌های عمیق — ریش‌های افتخار',
    bodies: ['Knight', 'Barbarian'], defaultBody: 'Knight',
    defaultHeight: 0.76, defaultBulk: 1.18, ears: false, tusks: false,
    defaults: DWARF_DEFAULTS,
    names: ['تورین', 'بالین', 'دورین', 'گیملی', 'بروک', 'موگ‌تبر', 'حیدرکوه'],
  },
  undead: {
    id: 'undead', label: 'مرده‌متحرک', desc: 'برخاسته از گور — استخوان و شنل کهنه',
    bodies: ['Skeleton_Warrior', 'Skeleton_Minion'], defaultBody: 'Skeleton_Warrior',
    defaultHeight: 1, defaultBulk: 1, ears: false, tusks: false,
    defaults: UNDEAD_DEFAULTS,
    names: ['استخوان‌ترک', 'مرگ‌خیز', 'گوربان', 'خاک‌زده', 'شب‌گرد', 'زمین‌پیچ'],
  },
};

// ── پالت‌های رنگ ──────────────────────────────────────────────
export const SKIN_PALETTES: Record<RaceId, string[]> = {
  human: ['#f7dcc4', '#eab586', '#d49a6a', '#b07a50', '#8a5c3c', '#63422c'],
  elf: ['#fbeedd', '#f4dcc0', '#e6c5a0', '#cf9f75', '#a97e56', '#7d5a3c'],
  orc: ['#a4b878', '#8aa460', '#6f8f4f', '#5c7a42', '#4c6638', '#7a8a5a'],
  dwarf: ['#f4cfa8', '#e0a878', '#c88a5c', '#a96e48', '#82543a', '#5f4028'],
  undead: ['#b8b4d0', '#8d89ad', '#7a7699', '#67638a', '#56527a', '#46436a'],
};

export const HAIR_COLORS = ['#121212', '#2b2118', '#4a3220', '#6b4a2e', '#8d6e63', '#c8a24a', '#e8d9a0', '#a9442e', '#e8e6e3', '#4b5563'];
export const CLOTH_COLORS = ['#8a3c3c', '#3d5a44', '#6b5a2e', '#54372a', '#2e3438', '#5a4a6b', '#8a5a2a', '#37474f', '#a4552e', '#2c4a6b'];
export const METAL_COLORS = ['#c8c8cf', '#b08d57', '#8a8f98', '#d4af37', '#6e6e78', '#9a7b4f', '#e2e2e6', '#5c6b7a'];

export const HAIR_STYLES: { id: HairStyleId; label: string }[] = [
  { id: 'baked', label: 'پیش‌فرض' },
  { id: 'none', label: 'کچل' },
  { id: 'short', label: 'کوتاه' },
  { id: 'long', label: 'بلند' },
  { id: 'ponytail', label: 'دم‌اسبی' },
  { id: 'mohawk', label: 'موهاک' },
];

export const BEARD_STYLES: { id: BeardStyleId; label: string }[] = [
  { id: 'baked', label: 'پیش‌فرض' },
  { id: 'none', label: 'بدون ریش' },
  { id: 'stubble', label: 'ته‌ریش' },
  { id: 'full', label: 'پرپشت' },
  { id: 'long', label: 'بلند' },
];

export function defaultConfig(race: RaceId = 'human', name?: string): CharConfig {
  const r = RACES[race];
  return {
    name: name ?? r.names[Math.floor(Math.random() * r.names.length)],
    race,
    body: r.defaultBody,
    height: r.defaultHeight,
    bulk: r.defaultBulk,
    ears: r.ears,
    tusks: r.tusks,
    physique: { ...PHYS(race) },
    ...JSON.parse(JSON.stringify(r.defaults)),
  };
}

/** اسلایدرهای اندام + برچسب فارسی — A22: بازه‌ها با clamp موتور هم‌ترازند */
export const PHYSIQUE_SLIDERS: { key: keyof Physique; label: string; min: number; max: number }[] = [
  { key: 'leg', label: 'طول پا', min: 0.85, max: 1.3 },
  { key: 'arm', label: 'طول بازو', min: 0.85, max: 1.3 },
  { key: 'torso', label: 'طول تنه', min: 0.88, max: 1.22 },
  { key: 'shoulder', label: 'پهنای شانه', min: 0.85, max: 1.3 },
  { key: 'head', label: 'اندازه سر', min: 0.75, max: 1.15 },
  { key: 'muscle', label: 'عضله', min: 0.85, max: 1.35 },
];

const TITLE_SUFFIX = ['آذرخش', 'گرگ‌تیر', 'سایه‌روان', 'قلدر', 'دشت‌گرد', 'آتش‌پیکر', 'بادپا'];
export function randomName(race: RaceId): string {
  const r = RACES[race];
  const base = r.names[Math.floor(Math.random() * r.names.length)];
  return Math.random() < 0.45 ? `${base} ${TITLE_SUFFIX[Math.floor(Math.random() * TITLE_SUFFIX.length)]}` : base;
}

// ── اعتبارسنجی پریست (A07) ───────────────────────────────────
// پریست نامعتبر هرگز نباید state را خراب کند یا به خطای اجرا برود.
import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'invalid hex color');
const ratio = z.number().finite().min(0.5).max(2);

const PhysiqueSchema = z.object({
  leg: ratio, arm: ratio, torso: ratio,
  shoulder: ratio, head: ratio, muscle: ratio,
});

const ConfigSchema = z.object({
  name: z.string().max(60).catch('قهرمان'),
  race: z.enum(['human', 'elf', 'orc', 'dwarf', 'undead']),
  body: z.string().max(60),
  skin: hexColor,
  hair: z.enum(['baked', 'none', 'short', 'long', 'ponytail', 'mohawk']),
  hairColor: hexColor,
  beard: z.enum(['baked', 'none', 'stubble', 'full', 'long']),
  beardColor: hexColor,
  ears: z.boolean(),
  tusks: z.boolean(),
  cloth: hexColor,
  metal: hexColor,
  bone: hexColor,
  weapon: z.string().max(60),
  helmet: z.boolean(),
  cape: z.boolean(),
  height: z.number().finite().min(0.3).max(1.5),
  bulk: z.number().finite().min(0.5).max(2),
  physique: PhysiqueSchema,
});

const PresetSchema = z.object({
  version: z.number().optional(),
  config: ConfigSchema,
});

/**
 * پریست JSON را اعتبارسنجی و نرمال می‌کند؛
 * در حالت نامعتبر null برمی‌گرداند و هرگز state را خراب نمی‌کند.
 */
export function validatePreset(data: unknown): CharConfig | null {
  const parsed = PresetSchema.safeParse(data);
  if (!parsed.success) return null;
  const c = parsed.data.config;
  const race = RACES[c.race];
  // نرمال‌سازی ارجاع‌های متقابل — body باید به نژاد تعلق داشته باشد
  const body = (race.bodies as string[]).includes(c.body) && c.body in BODIES
    ? c.body as CharConfig['body']
    : race.defaultBody;
  const bodyDef = BODIES[body];
  const weapon = bodyDef.weapons.some((w) => w.id === c.weapon)
    ? c.weapon
    : bodyDef.defaultWeapon;
  return {
    ...c,
    name: c.name.trim() || 'قهرمان',
    body,
    weapon,
    helmet: bodyDef.helmet ? c.helmet : false,
    cape: bodyDef.cape ? c.cape : false,
  };
}


/** وقتی نژاد عوض می‌شود: رنگ‌ها/ویژگی‌های نژادی اعمال و نام نژادی جدید انتخاب می‌شود */
export function rebaseConfigForRace(_cfg: CharConfig, race: RaceId): CharConfig {
  return defaultConfig(race, randomName(race));
}

// ── پریست‌های قهرمان آماده ──────────────────────────────────
export interface HeroPreset { id: string; label: string; desc: string; cfg: CharConfig }

export const HERO_PRESETS: HeroPreset[] = [
  {
    id: 'warrior', label: 'آریوبرزن آذرخش', desc: 'پالادین انسان — شمشیر و سپر',
    cfg: {
      name: 'آریوبرزن آذرخش', race: 'human', body: 'Knight',
      skin: '#eab586', hair: 'baked', hairColor: '#4a3220',
      beard: 'baked', beardColor: '#4a3220', ears: false, tusks: false,
      cloth: '#a4413c', metal: '#c8c8cf', bone: '#9a96b8',
      weapon: 'swordShield', helmet: false, cape: true, height: 1.02, bulk: 1.08,
      physique: { leg: 1.18, arm: 1.10, torso: 1.08, shoulder: 1.16, head: 0.90, muscle: 1.08 },
    },
  },
  {
    id: 'ranger', label: 'ائارین سایه‌روان', desc: 'کماندار الف — کلاه‌بردار جنگل',
    cfg: {
      name: 'ائارین سایه‌روان', race: 'elf', body: 'Rogue_Hooded',
      skin: '#f4dcc0', hair: 'baked', hairColor: '#e8d9a0',
      beard: 'none', beardColor: '#e8d9a0', ears: true, tusks: false,
      cloth: '#2e6b48', metal: '#d4af37', bone: '#9a96b8',
      weapon: 'crossbow', helmet: false, cape: true, height: 1.06, bulk: 0.92,
      physique: { leg: 1.26, arm: 1.12, torso: 1.10, shoulder: 1.0, head: 0.86, muscle: 0.92 },
    },
  },
  {
    id: 'berserker', label: 'گروش‌نک قلدر', desc: 'بربر ارگ — تبر خونین',
    cfg: {
      name: 'گروش‌نک قلدر', race: 'orc', body: 'Barbarian',
      skin: '#6f8f4f', hair: 'mohawk', hairColor: '#1c1c1c',
      beard: 'none', beardColor: '#241f16', ears: false, tusks: true,
      cloth: '#4a5a6b', metal: '#8a8f98', bone: '#e6dcc3',
      weapon: 'axe2h', helmet: true, cape: false, height: 1.1, bulk: 1.25,
      physique: { leg: 1.10, arm: 1.16, torso: 1.14, shoulder: 1.28, head: 0.84, muscle: 1.30 },
    },
  },
  {
    id: 'king', label: 'تورین تبرکوه', desc: 'شاه دورف — ریش پرپشت و زره',
    cfg: {
      name: 'تورین تبرکوه', race: 'dwarf', body: 'Knight',
      skin: '#e0a878', hair: 'short', hairColor: '#a9442e',
      beard: 'long', beardColor: '#a9442e', ears: false, tusks: false,
      cloth: '#6b5a2e', metal: '#d4af37', bone: '#9a96b8',
      weapon: 'sword', helmet: false, cape: true, height: 0.76, bulk: 1.2,
      physique: { leg: 0.87, arm: 1.02, torso: 1.16, shoulder: 1.30, head: 0.93, muscle: 1.32 },
    },
  },
  {
    id: 'mage', label: 'لثارئل افسون‌خوان', desc: 'جادوی الف — ردای بنفش',
    cfg: {
      name: 'لثارئل افسون‌خوان', race: 'elf', body: 'Mage',
      skin: '#fbeedd', hair: 'long', hairColor: '#e8d9a0',
      beard: 'none', beardColor: '#e8d9a0', ears: true, tusks: false,
      cloth: '#5a4a6b', metal: '#d4af37', bone: '#9a96b8',
      weapon: 'staff', helmet: true, cape: false, height: 1.04, bulk: 0.9,
      physique: { leg: 1.24, arm: 1.10, torso: 1.08, shoulder: 0.97, head: 0.86, muscle: 0.9 },
    },
  },
  {
    id: 'grave', label: 'استخوان‌ترک گوربان', desc: 'مرده‌متحرک — تهدید گورستان',
    cfg: {
      name: 'استخوان‌ترک گوربان', race: 'undead', body: 'Skeleton_Warrior',
      skin: '#8d89ad', hair: 'none', hairColor: '#1c1c1c',
      beard: 'none', beardColor: '#1c1c1c', ears: false, tusks: false,
      cloth: '#c9b896', metal: '#6e6e78', bone: '#8d89ad',
      weapon: 'none', helmet: true, cape: false, height: 1, bulk: 1,
      physique: { leg: 1.14, arm: 1.08, torso: 1.06, shoulder: 1.08, head: 0.9, muscle: 0.96 },
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Character Creator — Types, Race presets, Color palettes
// استاندارد مشترک برای همه نژادها (سازگار با ریتارگت Mixamo / гуманоید)
// ─────────────────────────────────────────────────────────────

import type { WeaponId } from './weapons';

export type { WeaponId };
export { WEAPONS } from './weapons';

export type RaceId = 'human' | 'elf' | 'orc' | 'dwarf';
export type HairId = 'none' | 'short' | 'long' | 'ponytail' | 'mohawk';
export type BeardId = 'none' | 'stubble' | 'full' | 'long';

export interface CharConfig {
  name: string;
  race: RaceId;
  skin: string;
  hair: HairId;
  hairColor: string;
  beard: BeardId;
  beardColor: string;
  eyes: string;
  weapon: WeaponId;
  outfit: string;
  pants: string;
  boots: string;
  metal: string;
  height: number; // 0.9 – 1.15
  bulk: number;   // 0.85 – 1.3
}

export interface RacePreset {
  id: RaceId;
  label: string;
  desc: string;
  width: number;                       // ضریب پهنای هندسه
  boneScales: Record<string, number>;  // مقیاس یکنواخت استخوان‌ها (بدون برش/shear)
  headShape: [number, number, number]; // مقیاس جمجمه
  jaw: boolean;                        // آرواره بزرگ ارگی
  browRidge: boolean;
  elfEars: boolean;
  tusks: boolean;
  defaults: Omit<CharConfig, 'name' | 'race' | 'height' | 'bulk'>;
  names: string[];
}

const HUMAN_DEFAULTS = {
  skin: '#e0ac7e', hair: 'short' as HairId, hairColor: '#3d2b1f',
  beard: 'stubble' as BeardId, beardColor: '#3d2b1f', eyes: '#5b3a1e',
  weapon: 'swordShield' as WeaponId,
  outfit: '#7a2e2e', pants: '#3a2f24', boots: '#2e2318', metal: '#b08d57',
};

const ELF_DEFAULTS = {
  skin: '#f2d5b0', hair: 'long' as HairId, hairColor: '#d9c27a',
  beard: 'none' as BeardId, beardColor: '#d9c27a', eyes: '#3a6478',
  weapon: 'bow' as WeaponId,
  outfit: '#3d4a33', pants: '#33383d', boots: '#241d16', metal: '#d4af37',
};

const ORC_DEFAULTS = {
  skin: '#6b8a4a', hair: 'mohawk' as HairId, hairColor: '#1b1b1b',
  beard: 'full' as BeardId, beardColor: '#241f16', eyes: '#c9a227',
  weapon: 'axe' as WeaponId,
  outfit: '#4a3b2a', pants: '#2e2a22', boots: '#241d16', metal: '#8a8f98',
};

const DWARF_DEFAULTS = {
  skin: '#dba173', hair: 'short' as HairId, hairColor: '#a93226',
  beard: 'long' as BeardId, beardColor: '#a93226', eyes: '#2e5339',
  weapon: 'mace' as WeaponId,
  outfit: '#6b5a2e', pants: '#4a3826', boots: '#3d2b1f', metal: '#c8c8cf',
};

export const RACES: Record<RaceId, RacePreset> = {
  human: {
    id: 'human',
    label: 'انسان',
    desc: 'متعادل و سازگار — جنگجوی سرزمین میانه',
    width: 1.0,
    boneScales: {},
    headShape: [0.92, 1.08, 0.98],
    jaw: false, browRidge: false, elfEars: false, tusks: false,
    defaults: HUMAN_DEFAULTS,
    names: ['آریوبرزن', 'رستم', 'سهراب', 'گیو', 'بهرام', 'ژوبین', 'اردشیر', 'طوس'],
  },
  elf: {
    id: 'elf',
    label: 'الف',
    desc: 'بلندقامت و چابک — کماندار جنگل‌های جاودانه',
    width: 0.88,
    boneScales: {
      upperLegL: 1.07, lowerLegL: 1.07, upperLegR: 1.07, lowerLegR: 1.07,
      spine: 1.05, chest: 1.05,
      upperArmL: 1.06, lowerArmL: 1.06, upperArmR: 1.06, lowerArmR: 1.06,
      head: 0.99, neck: 1.02,
    },
    headShape: [0.88, 1.10, 0.96],
    jaw: false, browRidge: false, elfEars: true, tusks: false,
    defaults: ELF_DEFAULTS,
    names: ['ائارین', 'سلون‌تیر', 'لثارئل', 'آرِن‌دیل', 'سیلوَن', 'تارمین', 'ائوگلین'],
  },
  orc: {
    id: 'orc',
    label: 'ارگ',
    desc: 'تنومند و خشمگین — بربر جنگل‌های سیاه',
    width: 1.28,
    boneScales: {
      upperLegL: 0.97, lowerLegL: 0.97, upperLegR: 0.97, lowerLegR: 0.97,
      spine: 1.06, chest: 1.06,
      upperArmL: 1.05, lowerArmL: 1.05, upperArmR: 1.05, lowerArmR: 1.05,
      head: 1.03, neck: 1.06,
    },
    headShape: [0.98, 1.04, 1.08],
    jaw: true, browRidge: true, elfEars: false, tusks: true,
    defaults: ORC_DEFAULTS,
    names: ['گروش‌نک', 'موگور', 'زاروگ', 'کراش', 'اِرومال', 'دورگ', 'بلاک‌دست'],
  },
  dwarf: {
    id: 'dwarf',
    label: 'دورف',
    desc: 'کوتاه‌قد و ستبر — پالادار کوه‌های عمیق',
    width: 1.26,
    boneScales: {
      upperLegL: 0.84, lowerLegL: 0.80, upperLegR: 0.84, lowerLegR: 0.80,
      spine: 0.95, chest: 0.91,
      upperArmL: 0.92, lowerArmL: 0.92, upperArmR: 0.92, lowerArmR: 0.92,
      head: 1.10, neck: 0.96,
    },
    headShape: [1.0, 1.0, 1.02],
    jaw: false, browRidge: true, elfEars: false, tusks: false,
    defaults: DWARF_DEFAULTS,
    names: ['تورین', 'بالین', 'دورین', 'گیملی', 'بروک', 'موگ‌تبر', 'حیدرکوه'],
  },
};

// ── پالت‌های رنگ ──────────────────────────────────────────────
export const SKIN_PALETTES: Record<RaceId, string[]> = {
  human: ['#f5d0a9', '#e0ac7e', '#c68a5c', '#a96e4b', '#7d5235', '#5a3a26'],
  elf: ['#f9e4c8', '#f2d5b0', '#e3bd97', '#cf9f75', '#b58257', '#8f6240'],
  orc: ['#96a86e', '#7d9b57', '#6b8a4a', '#5c7a3f', '#4f6b36', '#7a6b4a'],
  dwarf: ['#f0c49a', '#dba173', '#c08a5f', '#a96e4b', '#7d5235', '#5f4028'],
};

export const HAIR_COLORS = ['#121212', '#2b2118', '#3d2b1f', '#5d4037', '#8d6e63', '#b8860b', '#d9c27a', '#a93226', '#e8e6e3', '#4b5563'];
export const EYE_COLORS = ['#5b3a1e', '#2e5339', '#3a6478', '#7a6a34', '#9aa0a6', '#4a2c17', '#c9a227', '#6e3b3b'];
export const OUTFIT_COLORS = ['#7a2e2e', '#3d4a33', '#6b5a2e', '#54372a', '#2e3438', '#5a4a6b', '#8a5a2a', '#37474f'];
export const PANTS_COLORS = ['#3a2f24', '#2e2e2e', '#4a3826', '#5c4a33', '#33383d', '#44322c'];
export const BOOTS_COLORS = ['#2e2318', '#3d2b1f', '#241d16', '#4a3524', '#1f2426', '#33261a'];
export const METAL_COLORS = ['#c8c8cf', '#b08d57', '#8a8f98', '#d4af37', '#6e6e78', '#9a7b4f', '#e2e2e6'];

export const HAIR_STYLES: { id: HairId; label: string }[] = [
  { id: 'none', label: 'کچل' },
  { id: 'short', label: 'کوتاه' },
  { id: 'long', label: 'بلند' },
  { id: 'ponytail', label: 'دم‌اسبی' },
  { id: 'mohawk', label: 'موهاک' },
];

export const BEARD_STYLES: { id: BeardId; label: string }[] = [
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
    height: 1,
    bulk: 1,
    ...JSON.parse(JSON.stringify(r.defaults)),
  };
}

const TITLE_SUFFIX = ['آذرخش', 'گرگ‌تیر', 'سایه‌روان', 'قلدر', 'دشت‌گرد', 'آتش‌پیکر', 'بادپا'];
export function randomName(race: RaceId): string {
  const r = RACES[race];
  const base = r.names[Math.floor(Math.random() * r.names.length)];
  return Math.random() < 0.45 ? `${base} ${TITLE_SUFFIX[Math.floor(Math.random() * TITLE_SUFFIX.length)]}` : base;
}

// ── پریست‌های قهرمان آماده ──────────────────────────────────
export interface HeroPreset {
  id: string;
  label: string;
  desc: string;
  cfg: CharConfig;
}

export const HERO_PRESETS: HeroPreset[] = [
  {
    id: 'warrior',
    label: 'آریوبرزن آذرخش',
    desc: 'پالادین انسان — شمشیر و سپر',
    cfg: {
      name: 'آریوبرزن آذرخش', race: 'human', skin: '#e0ac7e',
      hair: 'short', hairColor: '#3d2b1f', beard: 'stubble', beardColor: '#3d2b1f',
      eyes: '#5b3a1e', weapon: 'swordShield',
      outfit: '#7a2e2e', pants: '#3a2f24', boots: '#2e2318', metal: '#b08d57',
      height: 1.03, bulk: 1.1,
    },
  },
  {
    id: 'ranger',
    label: 'ائارین سایه‌روان',
    desc: 'کماندار الف — تیرانداز جنگل',
    cfg: {
      name: 'ائارین سایه‌روان', race: 'elf', skin: '#f2d5b0',
      hair: 'ponytail', hairColor: '#d9c27a', beard: 'none', beardColor: '#d9c27a',
      eyes: '#3a6478', weapon: 'bow',
      outfit: '#3d4a33', pants: '#33383d', boots: '#241d16', metal: '#d4af37',
      height: 1.06, bulk: 0.92,
    },
  },
  {
    id: 'berserker',
    label: 'گروش‌نک قلدر',
    desc: 'بربر ارک — تبر خونین',
    cfg: {
      name: 'گروش‌نک قلدر', race: 'orc', skin: '#6b8a4a',
      hair: 'mohawk', hairColor: '#1b1b1b', beard: 'full', beardColor: '#241f16',
      eyes: '#c9a227', weapon: 'axe',
      outfit: '#4a3b2a', pants: '#2e2a22', boots: '#241d16', metal: '#8a8f98',
      height: 1.05, bulk: 1.24,
    },
  },
  {
    id: 'king',
    label: 'تورین تبرکوه',
    desc: 'پادشاه دورف — گرز طلایی',
    cfg: {
      name: 'تورین تبرکوه', race: 'dwarf', skin: '#dba173',
      hair: 'short', hairColor: '#a93226', beard: 'long', beardColor: '#a93226',
      eyes: '#2e5339', weapon: 'mace',
      outfit: '#6b5a2e', pants: '#4a3826', boots: '#3d2b1f', metal: '#d4af37',
      height: 0.97, bulk: 1.22,
    },
  },
  {
    id: 'mage',
    label: 'لثارئل افسون‌خوان',
    desc: 'جادوی الف — عصای مه‌آلود',
    cfg: {
      name: 'لثارئل افسون‌خوان', race: 'elf', skin: '#f9e4c8',
      hair: 'long', hairColor: '#e8e6e3', beard: 'none', beardColor: '#e8e6e3',
      eyes: '#3a6478', weapon: 'staff',
      outfit: '#5a4a6b', pants: '#33383d', boots: '#241d16', metal: '#d4af37',
      height: 1.04, bulk: 0.9,
    },
  },
];

// آزمون موتور رنگ — hslToRgb و ریاضی حالت shade
import { describe, expect, it } from 'vitest';
import { hslToRgb, rgbToHsl, hexToRgb, inHueRange } from '../src/lib/character/recolor';

describe('hslToRgb', () => {
  it('دورگشت دقیق rgb→hsl→rgb', () => {
    const cases = ['#eab586', '#8a3c3c', '#4a3220', '#ffffff', '#000000', '#3d5a44', '#d4af37'];
    for (const hex of cases) {
      const [r, g, b] = hexToRgb(hex);
      const [h, s, l] = rgbToHsl(r, g, b);
      const [r2, g2, b2] = hslToRgb(h, s, l);
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(1);
    }
  });

  it('خروجی همیشه در بازه ۰..۲۵۵', () => {
    for (let h = 0; h < 360; h += 37) {
      for (const s of [0, 0.3, 0.7, 1]) {
        for (const l of [0.04, 0.5, 0.985]) {
          const [r, g, b] = hslToRgb(h, s, l);
          expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThanOrEqual(255);
          expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(255);
          expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('خاکستری خالص (s=0) بدون خطای hue', () => {
    expect(hslToRgb(999, 0, 0.5)).toEqual([128, 128, 128]);
  });
});

describe('حالت shade — قیود ریاضی', () => {
  it('lightness خروجی = L رنگ هدف + دلتای پیکسل (کلمپ‌شده)', () => {
    // #8a3c3c: L ≈ 0.388 — جامه‌ی سرخ آجری باید سرِ همان روشنایی بماند
    const [r, g, b] = hexToRgb('#8a3c3c');
    const [h, s, l] = rgbToHsl(r, g, b);
    // پیکسل روشن‌تر از میانگین (دلتا +۰.۲) → خروجی L هدف + ۰.۲
    const out = hslToRgb(h, s, Math.min(0.985, l + 0.2));
    const [, , lOut] = rgbToHsl(out[0], out[1], out[2]);
    expect(lOut).toBeCloseTo(Math.min(0.985, l + 0.2), 2);
  });

  it('بازه‌ی hue دورپیچ برای مو (۰..۳۶۰) همه‌ی پیکسل‌ها را می‌پذیرد', () => {
    for (const h of [0, 45, 90, 180, 270, 359]) {
      expect(inHueRange(h, [0, 360])).toBe(true);
    }
  });
});

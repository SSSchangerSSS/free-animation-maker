// A21 — آزمون بازه‌ی hue دور مرز ۳۶۰ درجه
import { describe, it, expect } from 'vitest';
import { inHueRange, rgbToHsl } from '../src/lib/character/recolor';

describe('inHueRange — A21', () => {
  it('بازه‌ی دورپیچ [348, 372] مقدار 355 و 5 را می‌پذیرد و 180 را رد می‌کند', () => {
    expect(inHueRange(355, [348, 372])).toBe(true);
    expect(inHueRange(5, [348, 372])).toBe(true);
    expect(inHueRange(180, [348, 372])).toBe(false);
  });

  it('بازه‌ی معادل [348, 12] همان خروجی را می‌دهد', () => {
    expect(inHueRange(355, [348, 12])).toBe(true);
    expect(inHueRange(5, [348, 12])).toBe(true);
    expect(inHueRange(180, [348, 12])).toBe(false);
  });

  it('بازه‌ی معمولی و بازه‌ی کامل', () => {
    expect(inHueRange(100, [90, 120])).toBe(true);
    expect(inHueRange(80, [90, 120])).toBe(false);
    expect(inHueRange(200, [0, 360])).toBe(true);
  });

  it('rgbToHsl مرجع صحیح می‌دهد', () => {
    const [h] = rgbToHsl(255, 0, 0);
    expect(h).toBeCloseTo(0);
    const [h2] = rgbToHsl(0, 255, 0);
    expect(h2).toBeCloseTo(120);
  });
});

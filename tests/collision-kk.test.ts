// ─────────────────────────────────────────────────────────────
// هارنس برخورد سلاح/بدن — Knight (شمشیر) — کیفیت منبع حرکت بدون
// خطای ریتارگت: کلیپ‌های بومی KayKit روی اسکلت واقعی همان بدنه.
// نمونه‌برداری ۱۲۰Hz (دو برابر حداقلِ ۶۰Hz) + swept مسیر تیغه.
// ─────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRig, filterVolumes } from './helpers/glb-rig';
import { runClipQa, type ClipQaResult } from './helpers/qa-run';

const here = path.dirname(fileURLToPath(import.meta.url));
const KNIGHT = path.join(here, '../public/models/Knight.glb');

// مجموعهٔ اولویت: حرکات شمشیر یک‌دست و دو‌دست + لوکوموشن پایه با سلاح در دست
const CASES: { clip: string; weapon: string }[] = [
  { clip: '1H_Melee_Attack_Chop', weapon: '1H_Sword' },
  { clip: '1H_Melee_Attack_Slice_Diagonal', weapon: '1H_Sword' },
  { clip: '1H_Melee_Attack_Slice_Horizontal', weapon: '1H_Sword' },
  { clip: '1H_Melee_Attack_Stab', weapon: '1H_Sword' },
  { clip: '2H_Melee_Attack_Chop', weapon: '2H_Sword' },
  { clip: '2H_Melee_Attack_Slice', weapon: '2H_Sword' },
  { clip: '2H_Melee_Attack_Spin', weapon: '2H_Sword' },
  { clip: '2H_Melee_Attack_Stab', weapon: '2H_Sword' },
  { clip: 'Idle', weapon: '1H_Sword' },
  { clip: 'Walking_A', weapon: '1H_Sword' },
  { clip: 'Running_A', weapon: '1H_Sword' },
];

let rig: Awaited<ReturnType<typeof loadRig>>;

beforeAll(async () => {
  rig = await loadRig(KNIGHT);
  rig.volumes = filterVolumes(rig.volumes);
});

describe('harness sanity — Knight rig', () => {
  it('rig, weapon profiles and volumes extracted from real GLB', () => {
    expect(Object.keys(rig.clips).length).toBeGreaterThan(60);
    expect(rig.profiles['1H_Sword']).toBeTruthy();
    expect(rig.profiles['2H_Sword']).toBeTruthy();
    // تیغهٔ ۱H حدود ۱٫۴ متر در فضای handslot — بازهٔ منطقی
    expect(rig.profiles['1H_Sword'].bladeEnd).toBeGreaterThan(1.2);
    expect(rig.profiles['1H_Sword'].bladeEnd).toBeLessThan(1.6);
    expect(rig.profiles['2H_Sword'].bladeEnd).toBeGreaterThan(1.7);
    // حجم‌های بدن از رئوس واقعی ساخته شده‌اند
    expect(rig.volumes.samples).toBeGreaterThan(1000);
    for (const b of ['chest', 'spine', 'hips', 'head', 'upperLegR', 'lowerLegR']) {
      expect(rig.volumes.byCanon[b], `volume for ${b}`).toBeTruthy();
    }
    expect(rig.canon['lowerArmR']).toBeTruthy();
    expect(rig.handSlots.r).toBeTruthy();
  }, 180000);
});

describe('baseline — weapon/body penetration in source clips (measurement)', () => {
  const results: ClipQaResult[] = [];

  it('measures priority clips and records numbers', () => { /* timeout via 3rd arg */
    for (const c of CASES) {
      const r = runClipQa(rig, c.clip, c.weapon, { dt: 1 / 120, guard: false });
      results.push(r);
      console.log(
        `[baseline] ${c.clip.padEnd(30)} × ${c.weapon}  ` +
        `viol=${String(r.violSamples).padStart(4)}/${r.totalSamples}  ` +
        `maxDepth=${(r.maxDepth * 100).toFixed(1)}cm  sum=${(r.sumDepth * 100).toFixed(0)}  ` +
        `run=${r.longestRun}  sweptOnly=${r.sweptOnlySamples}  capFP=${r.capsuleFP}  capTP=${r.capsuleTP}  parts=${JSON.stringify(r.byPart)}`,
      );
    }
    // ثبت در محیط تست برای تست بعدی
    (globalThis as { __kkBaseline?: ClipQaResult[] }).__kkBaseline = results;
  }, 180000);

  it('documents the problem honestly — at least 3 priority clips violate', () => {
    const res = (globalThis as { __kkBaseline?: ClipQaResult[] }).__kkBaseline ?? [];
    const bad = res.filter((r) => r.violSamples > 0);
    console.log(`[baseline] violating clips: ${bad.length}/${res.length} — total sumDepth(cm·s)=${(res.reduce((s, r) => s + r.sumDepth, 0) * 100).toFixed(0)}`);
    expect(bad.length).toBeGreaterThanOrEqual(3);
  }, 180000);
});

describe('pose-guard effect — corrections vs baseline (exact geometry metric)', () => {
  it('reduces 1H penetration, never harms clean clips, no net harm overall', () => {
    const base = (globalThis as { __kkBaseline?: ClipQaResult[] }).__kkBaseline ?? [];
    expect(base.length).toBe(CASES.length);
    let baseSum = 0; let guardSum = 0;
    let base1H = 0; let guard1H = 0;
    for (const c of CASES) {
      const b = base.find((r) => r.clip === c.clip)!;
      const g = runClipQa(rig, c.clip, c.weapon, { dt: 1 / 120, guard: true });
      baseSum += b.sumDepth; guardSum += g.sumDepth;
      if (c.weapon === '1H_Sword') { base1H += b.sumDepth; guard1H += g.sumDepth; }
      console.log(
        `[guard-on] ${c.clip.padEnd(30)}  ` +
        `viol ${String(b.violSamples).padStart(4)}→${String(g.violSamples).padStart(4)}  ` +
        `maxDepth ${(b.maxDepth * 100).toFixed(1)}→${(g.maxDepth * 100).toFixed(1)}cm  ` +
        `sum ${(b.sumDepth * 100).toFixed(0)}→${(g.sumDepth * 100).toFixed(0)}  maxCorr=${g.maxCorrDeg.toFixed(1)}°`,
      );
      // کلیپ تمیز نباید با گارد کثیف شود — اصلاح‌ها فقط کاهشی‌اند
      if (b.violSamples === 0) {
        expect(g.violSamples, `${c.clip} must stay clean`).toBe(0);
      }
    }
    const reduction1H = base1H > 0 ? 1 - guard1H / base1H : 0;
    const net = guardSum - baseSum;
    console.log(`[guard-on] 1H sumDepth reduction: ${(reduction1H * 100).toFixed(1)}%  aggregate Δ=${(net * 100).toFixed(0)}cm·s`);
    // کاهش معنادار روی مجموعهٔ ۱H (۲H ساختاراً با اصلاح مفصلی رفع نمی‌شود —
    // سیاست سلاح-پشت + بازنویسی proc per-weapon؛ سیاست در engine تست می‌شود)
    expect(reduction1H).toBeGreaterThan(0.08);
    // ضرر خالص ممنوع
    expect(net).toBeLessThan(1e-6 + baseSum * 0.02);
  }, 180000);

  it('weapon-mode policy — measured-broken 2H clips go to back, 1H combat stays hand', async () => {
    const { weaponModeFor } = await import('../src/lib/three/engine');
    expect(weaponModeFor('kk:2H_Melee_Attack_Chop')).toBe('back');
    expect(weaponModeFor('kk:2H_Melee_Attack_Spin')).toBe('back');
    expect(weaponModeFor('kk:1H_Melee_Attack_Chop')).toBe('hand');
    expect(weaponModeFor('kk:Idle')).toBe('hand');
    expect(weaponModeFor('kk:Cheer')).toBe('back');
    expect(weaponModeFor('ual:Sword_Attack')).toBe('hand');
    expect(weaponModeFor('proc:attack')).toBe('hand');
  }, 180000);
});

'use client';

// ─────────────────────────────────────────────────────────────
// شخصیت‌ساز قهرمانان — رابط کاربری اصلی
// تم: فانتزی تاریک طلایی (سبک Baldur's Gate)
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  User, Leaf, Axe, Hammer, Dices, Upload, Download, Camera, RotateCw, RotateCcw,
  PersonStanding, Footprints, Zap, Swords, Sword, Hand, Music, ChevronUp,
  Wand2, Save, FolderOpen, Loader2, Bone, CheckCircle2, AlertTriangle, FileUp,
  Shield, Flame, Skull, Crown, PartyPopper, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Engine, type EngineAnimInfo } from '@/lib/three/engine';
import {
  RACES, SKIN_PALETTES, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, PANTS_COLORS,
  BOOTS_COLORS, METAL_COLORS, HAIR_STYLES, BEARD_STYLES, WEAPONS, HERO_PRESETS,
  defaultConfig, randomName,
  type CharConfig, type RaceId, type HairId, type BeardId, type WeaponId,
} from '@/lib/character/types';

// ── آیکون‌های انیمیشن ────────────────────────────────────────
const ANIM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  idle: PersonStanding, guard: Swords, block: ShieldCheck, walk: Footprints,
  run: Zap, attack: Sword, cast: Wand2, wave: Hand, dance: Music,
  cheer: PartyPopper, bow: Crown, jump: ChevronUp, hit: Flame, death: Skull,
};
const RACE_ICONS: Record<RaceId, React.ComponentType<{ className?: string }>> = {
  human: User, elf: Leaf, orc: Axe, dwarf: Hammer,
};

// ── کامپوننت‌های کوچک ────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-1 text-xs font-bold tracking-wide text-[#c8a24a]">{children}</h3>;
}

function Swatches({ colors, value, onChange }: {
  colors: string[]; value: string; onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`رنگ ${c}`}
          className={cn(
            'h-7 w-7 rounded-full border border-black/50 transition-transform hover:scale-110',
            value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-[#c8a24a] ring-offset-2 ring-offset-[#171310]',
          )}
          style={{ background: c }}
        />
      ))}
      <label
        className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-[#c8a24a]/60"
        title="رنگ دلخواه"
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <Wand2 className="h-3.5 w-3.5 text-[#c8a24a]" />
      </label>
    </div>
  );
}

function StyleGrid<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-md border px-2 py-1.5 text-xs transition-colors',
            value === o.id
              ? 'border-[#c8a24a] bg-[#c8a24a]/15 text-[#e8c97a]'
              : 'border-[#c8a24a]/20 bg-black/20 text-[#b8ad98] hover:border-[#c8a24a]/50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-[#b8ad98]">{label}</span>
        <span className="font-medium text-[#e8c97a]">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

// ── پنل شخصی‌سازی ────────────────────────────────────────────
function CustomizationPanel({ cfg, set, onRandomName }: {
  cfg: CharConfig;
  set: (patch: Partial<CharConfig>) => void;
  onRandomName: () => void;
}) {
  const race = RACES[cfg.race];
  const RaceIcon = RACE_ICONS[cfg.race];
  return (
    <div className="flex h-full flex-col">
      {/* نام */}
      <div className="border-b border-[#c8a24a]/15 p-3">
        <div className="flex items-center gap-1.5">
          <Input
            value={cfg.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="نام قهرمان"
            className="h-9 border-[#c8a24a]/25 bg-black/30 text-sm text-[#e8ddc8] placeholder:text-[#6b6252]"
          />
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-[#c8a24a]/30" onClick={onRandomName} title="نام تصادفی">
            <Dices className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="race" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 grid grid-cols-4 bg-black/30">
          <TabsTrigger value="race" className="text-xs">نژاد</TabsTrigger>
          <TabsTrigger value="body" className="text-xs">بدن</TabsTrigger>
          <TabsTrigger value="face" className="text-xs">چهره</TabsTrigger>
          <TabsTrigger value="gear" className="text-xs">جامه</TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-color:#c8a24a55_transparent] [scrollbar-width:thin]">
          {/* نژاد */}
          <TabsContent value="race" className="mt-0 space-y-2">
            <SectionTitle>قهرمانان آماده</SectionTitle>
            <div className="grid grid-cols-2 gap-1.5">
              {HERO_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set({ ...JSON.parse(JSON.stringify(p.cfg)) })}
                  title={p.desc}
                  className={cn(
                    'rounded-md border px-2 py-2 text-right text-[11px] leading-4 transition-colors',
                    cfg.name === p.cfg.name
                      ? 'border-[#c8a24a] bg-[#c8a24a]/15 text-[#e8c97a]'
                      : 'border-[#c8a24a]/20 bg-black/20 text-[#b8ad98] hover:border-[#c8a24a]/50',
                  )}
                >
                  <span className="block font-bold">{p.label}</span>
                  <span className="block text-[10px] text-[#8a8070]">{p.desc}</span>
                </button>
              ))}
            </div>
            <div className="my-1 border-t border-[#c8a24a]/10" />
            <SectionTitle>نژادها</SectionTitle>
            {(Object.keys(RACES) as RaceId[]).map((id) => {
              const r = RACES[id];
              const Icon = RACE_ICONS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => set({ race: id, ...JSON.parse(JSON.stringify(r.defaults)) })}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border p-3 text-right transition-colors',
                    cfg.race === id
                      ? 'border-[#c8a24a] bg-[#c8a24a]/10'
                      : 'border-[#c8a24a]/15 bg-black/20 hover:border-[#c8a24a]/40',
                  )}
                >
                  <span className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
                    cfg.race === id ? 'border-[#c8a24a] text-[#e8c97a]' : 'border-[#c8a24a]/20 text-[#8a8070]',
                  )}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-[#e8ddc8]">{r.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-[#8a8070]">{r.desc}</span>
                  </span>
                </button>
              );
            })}
          </TabsContent>

          {/* بدن */}
          <TabsContent value="body" className="mt-0">
            <SectionTitle>اندام {race.label}</SectionTitle>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#c8a24a]/15 bg-black/20 p-2.5 text-xs text-[#8a8070]">
              <RaceIcon className="h-4 w-4 shrink-0 text-[#c8a24a]" />
              قد و هیکل نژاد {race.label} پایه‌ی اندام شماست؛ با اسلایدرها تنظیمش کنید.
            </div>
            <SliderRow label="قد" value={cfg.height} min={0.9} max={1.15} step={0.01}
              onChange={(v) => set({ height: v })} format={(v) => `${Math.round(v * 100)}٪`} />
            <SliderRow label="تنومندی" value={cfg.bulk} min={0.85} max={1.3} step={0.01}
              onChange={(v) => set({ bulk: v })} format={(v) => `${Math.round(v * 100)}٪`} />
          </TabsContent>

          {/* چهره */}
          <TabsContent value="face" className="mt-0 space-y-4">
            <div>
              <SectionTitle>رنگ پوست</SectionTitle>
              <Swatches colors={SKIN_PALETTES[cfg.race]} value={cfg.skin} onChange={(c) => set({ skin: c })} />
            </div>
            <div>
              <SectionTitle>مدل مو</SectionTitle>
              <StyleGrid<HairId> options={HAIR_STYLES} value={cfg.hair} onChange={(v) => set({ hair: v })} />
            </div>
            <div>
              <SectionTitle>رنگ مو</SectionTitle>
              <Swatches colors={HAIR_COLORS} value={cfg.hairColor} onChange={(c) => set({ hairColor: c })} />
            </div>
            <div>
              <SectionTitle>ریش</SectionTitle>
              <StyleGrid<BeardId> options={BEARD_STYLES} value={cfg.beard} onChange={(v) => set({ beard: v })} />
            </div>
            <div>
              <SectionTitle>رنگ ریش</SectionTitle>
              <Swatches colors={HAIR_COLORS} value={cfg.beardColor} onChange={(c) => set({ beardColor: c })} />
            </div>
            <div>
              <SectionTitle>رنگ چشم</SectionTitle>
              <Swatches colors={EYE_COLORS} value={cfg.eyes} onChange={(c) => set({ eyes: c })} />
            </div>
          </TabsContent>

          {/* جامه */}
          <TabsContent value="gear" className="mt-0 space-y-4">
            <div>
              <SectionTitle>سلاح</SectionTitle>
              <StyleGrid<WeaponId> options={WEAPONS} value={cfg.weapon} onChange={(v) => set({ weapon: v })} />
            </div>
            <div>
              <SectionTitle>زره و بالاپوش</SectionTitle>
              <Swatches colors={OUTFIT_COLORS} value={cfg.outfit} onChange={(c) => set({ outfit: c })} />
            </div>
            <div>
              <SectionTitle>شلوار</SectionTitle>
              <Swatches colors={PANTS_COLORS} value={cfg.pants} onChange={(c) => set({ pants: c })} />
            </div>
            <div>
              <SectionTitle>چکمه</SectionTitle>
              <Swatches colors={BOOTS_COLORS} value={cfg.boots} onChange={(c) => set({ boots: c })} />
            </div>
            <div>
              <SectionTitle>فلزات (کمربند و شانه‌پوش)</SectionTitle>
              <Swatches colors={METAL_COLORS} value={cfg.metal} onChange={(c) => set({ metal: c })} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── گزارش import ─────────────────────────────────────────────
function ReportCard({ report }: {
  report: { found: string[]; missing: string[]; boneCount: number; modelClips: number; ok: boolean };
}) {
  return (
    <div className="space-y-2 rounded-lg border border-[#c8a24a]/25 bg-black/25 p-3 text-xs">
      <div className="flex items-center gap-2 font-bold">
        {report.ok
          ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-emerald-400">اسکلت هیومنوید شناسایی شد</span></>
          : <><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-amber-400">اسکلت کامل شناسایی نشد</span></>}
      </div>
      <div className="flex items-center gap-1.5 text-[#b8ad98]">
        <Bone className="h-3.5 w-3.5 text-[#c8a24a]" />
        {report.boneCount} استخوان — {report.found.length} قطعه‌ی بدن نگاشت شد
      </div>
      {report.missing.length > 0 && (
        <div className="text-[#8a8070]">
          نبود: {report.missing.join('، ')} — این قطعات ثابت می‌مانند
        </div>
      )}
      {report.modelClips > 0 && (
        <div className="text-[#8a8070]">{report.modelClips} انیمیشن همراه مدل هم اضافه شد</div>
      )}
      <p className="leading-5 text-[#6b6252]">
        بهترین نتیجه: GLB با پوز T و اسکلت Mixamo/Blender — رو به +Z
      </p>
    </div>
  );
}

// ── کامپوننت اصلی ────────────────────────────────────────────
export default function Creator() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [config, setConfig] = useState<CharConfig>(() => defaultConfig('human', 'آریوبرزن آذرخش'));
  const [anims, setAnims] = useState<EngineAnimInfo[]>([]);
  const [activeAnim, setActiveAnim] = useState('idle');
  const [speed, setSpeed] = useState(1);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isImported, setIsImported] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<Parameters<typeof ReportCard>[0]['report'] | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const presetInputRef = useRef<HTMLInputElement>(null);

  // ── init engine ──
  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new Engine(mountRef.current);
    engineRef.current = engine;
    engine.onImportedChange = (v) => {
      setIsImported(v);
      setAnims(engineRef.current?.getAnimList() ?? []);
    };
    engine.setCharacter(config);
    engine.play('idle', true);
    setAnims(engine.getAnimList());
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { engineRef.current?.setCharacter(config); }, [config]);
  useEffect(() => { engineRef.current?.play(activeAnim); }, [activeAnim]);
  useEffect(() => { engineRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => { engineRef.current?.setAutoRotate(autoRotate); }, [autoRotate]);

  const set = useCallback((patch: Partial<CharConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
  }, []);

  // ── اعمال ──
  const randomize = useCallback(() => {
    const races: RaceId[] = ['human', 'elf', 'orc', 'dwarf'];
    const race = races[Math.floor(Math.random() * races.length)];
    const r = RACES[race];
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    setConfig(() => ({
      ...defaultConfig(race),
      name: randomName(race),
      skin: pick(SKIN_PALETTES[race]),
      hair: pick(HAIR_STYLES).id,
      hairColor: pick(HAIR_COLORS),
      beard: race === 'elf' ? 'none' : pick(BEARD_STYLES).id,
      beardColor: pick(HAIR_COLORS),
      eyes: pick(EYE_COLORS),
      weapon: pick(WEAPONS).id,
      outfit: pick(OUTFIT_COLORS),
      pants: pick(PANTS_COLORS),
      boots: pick(BOOTS_COLORS),
      metal: pick(METAL_COLORS),
      height: 0.94 + Math.random() * 0.14,
      bulk: race === 'orc' || race === 'dwarf' ? 1.05 + Math.random() * 0.22 : 0.9 + Math.random() * 0.2,
    }));
    toast.success('قهرمان تازه‌ای ساخته شد!');
  }, []);

  const doExport = useCallback(async () => {
    try {
      const blob = await engineRef.current!.exportGLB();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.name || 'character'}.glb`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success('خروجی GLB دانلود شد — انیمیشن‌ها هم داخلش هستند');
    } catch {
      toast.error('خروجی گرفتن ناموفق بود');
    }
  }, [config.name]);

  const doScreenshot = useCallback(() => {
    const url = engineRef.current!.screenshot();
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name || 'character'}.png`;
    a.click();
    toast.success('عکس ذخیره شد');
  }, [config.name]);

  const savePreset = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: 1, config }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name || 'preset'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast.success('پریست ذخیره شد');
  }, [config]);

  const loadPreset = useCallback(async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data?.config?.race && RACES[data.config.race as RaceId]) {
        setConfig({ ...defaultConfig(data.config.race), ...data.config });
        toast.success('پریست بارگذاری شد');
      } else {
        toast.error('فایل پریست معتبر نیست');
      }
    } catch {
      toast.error('فایل پریست خوانده نشد');
    }
  }, []);

  const onImportFile = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const rep = await engineRef.current!.importGLB(buf);
      setReport(rep);
      setAnims(engineRef.current!.getAnimList());
      setActiveAnim('idle');
      if (rep.ok) toast.success('مدل وارد شد و انیمیشن‌ها رویش ریخته شدند!');
      else toast.error('اسکلت هیومنوید کامل شناسایی نشد — جزئیات را ببینید');
    } catch {
      toast.error('فایل GLB خوانده نشد');
    }
    setImporting(false);
  }, []);

  const backToCreator = useCallback(() => {
    engineRef.current?.exitImported();
    setReport(null);
    setAnims(engineRef.current!.getAnimList());
  }, []);

  const reset = useCallback(() => {
    setConfig(defaultConfig('human', 'آریوبرزن آذرخش'));
    toast('شخصیت به حالت اولیه برگشت');
  }, []);

  // ── UI ──
  return (
    <div dir="rtl" className="flex h-screen flex-col overflow-hidden bg-[#0f0c08] text-[#e8ddc8]">
      {/* هدر */}
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#c8a24a]/20 bg-[#14100b]/95 px-3 backdrop-blur md:px-4">
        <div className="flex items-center gap-2.5">
          <Swords className="h-5 w-5 text-[#c8a24a]" />
          <h1 className="text-base font-black tracking-wide md:text-lg">شخصیت‌ساز قهرمانان</h1>
          {isImported && (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-400">
              مدل خارجی فعال
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="hidden text-xs sm:inline-flex" onClick={randomize}>
            <Dices className="ml-1 h-4 w-4" /> تصادفی
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={randomize} title="شخصیت تصادفی">
            <Dices className="h-4 w-4 sm:hidden" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={savePreset} title="ذخیره پریست">
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => presetInputRef.current?.click()} title="بارگذاری پریست">
            <FolderOpen className="h-4 w-4" />
          </Button>
          <input
            ref={presetInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && loadPreset(e.target.files[0])}
          />
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={doScreenshot} title="عکس گرفتن">
            <Camera className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9', autoRotate && 'text-[#e8c97a]')}
            onClick={() => setAutoRotate((v) => !v)}
            title="چرخش خودکار"
          >
            <RotateCw className={cn('h-4 w-4', autoRotate && 'animate-spin [animation-duration:3s]')} />
          </Button>
          <Button variant="ghost" size="icon" className="hidden h-9 w-9 sm:inline-flex" onClick={reset} title="بازنشانی">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button size="sm" className="mx-1 hidden text-xs md:inline-flex" onClick={() => setImportOpen(true)}>
            <FileUp className="ml-1 h-4 w-4" /> ورود مدل GLB
          </Button>
          <Button size="sm" variant="outline" className="border-[#c8a24a]/40 text-xs" onClick={doExport}>
            <Download className="ml-1 h-4 w-4" /> <span className="hidden sm:inline">خروجی GLB</span>
          </Button>
        </div>
      </header>

      {/* صحنه */}
      <main className="relative min-h-0 flex-1">
        <div ref={mountRef} className="absolute inset-0" />

        {/* پنل شخصی‌سازی (دسکتاپ) */}
        <aside className="absolute bottom-24 right-3 top-3 z-10 hidden w-[300px] flex-col overflow-hidden rounded-xl border border-[#c8a24a]/25 bg-[#14100b]/88 shadow-2xl backdrop-blur-md lg:flex">
          <CustomizationPanel
            cfg={config}
            set={set}
            onRandomName={() => set({ name: randomName(config.race) })}
          />
        </aside>

        {/* دکمه پنل موبایل */}
        <Button
          className="absolute bottom-24 right-3 z-20 lg:hidden"
          variant="outline"
          onClick={() => setMobilePanel((v) => !v)}
        >
          <Wand2 className="ml-1 h-4 w-4" /> شخصی‌سازی
        </Button>

        {/* پنل موبایل */}
        {mobilePanel && (
          <div className="absolute inset-x-2 bottom-24 top-3 z-10 flex flex-col overflow-hidden rounded-xl border border-[#c8a24a]/25 bg-[#14100b]/95 backdrop-blur-md lg:hidden">
            <CustomizationPanel
              cfg={config}
              set={set}
              onRandomName={() => set({ name: randomName(config.race) })}
            />
          </div>
        )}

        {/* نوار انیمیشن */}
        <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-[#c8a24a]/25 bg-[#14100b]/88 px-2.5 py-2 shadow-2xl backdrop-blur-md [scrollbar-width:none]">
          {anims.length === 0 && (
            <span className="px-3 py-1.5 text-xs text-[#8a8070]">در حال آماده‌سازی انیمیشن‌ها…</span>
          )}
          {anims.map((a) => {
            const Icon = ANIM_ICONS[a.id] ?? (a.origin === 'model' ? FolderOpen : PersonStanding);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveAnim(a.id)}
                title={a.label}
                className={cn(
                  'flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 transition-colors',
                  activeAnim === a.id
                    ? 'border-[#c8a24a] bg-[#c8a24a]/15 text-[#e8c97a]'
                    : 'border-transparent text-[#a89d88] hover:border-[#c8a24a]/30 hover:text-[#e8ddc8]',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="whitespace-nowrap text-[10px]">{a.label}</span>
              </button>
            );
          })}
          {anims.length > 0 && (
            <div className="mx-1.5 flex shrink-0 items-center gap-2 border-r border-[#c8a24a]/20 pr-3">
              <span className="text-[10px] text-[#8a8070]">سرعت</span>
              <Slider
                value={[speed]}
                min={0.25}
                max={2}
                step={0.05}
                onValueChange={(v) => setSpeed(v[0])}
                className="w-20"
              />
            </div>
          )}
        </div>
      </main>

      {/* دیالوگ ورود مدل */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="border-[#c8a24a]/25 bg-[#171310] text-[#e8ddc8] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#c8a24a]" /> ورود مدل استاندارد
            </DialogTitle>
            <DialogDescription className="text-[#8a8070]">
              مدل GLB خود را وارد کنید و کل کتابخانه‌ی انیمیشن را رویش بریزید.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs leading-5 text-[#a89d88]">
            <div className="rounded-lg border border-[#c8a24a]/20 bg-black/25 p-3">
              <p className="mb-1 font-bold text-[#c8a24a]">استاندارد پذیرفته‌شده:</p>
              <ul className="list-inside list-disc space-y-0.5">
                <li>فرمت GLB یا GLTF با SkinnedMesh</li>
                <li>پوز مرجع T-Pose (پوز A هم خودکار اصلاح می‌شود)</li>
                <li>اسکلت Mixamo / Blender / Unity — تشخیص خودکار نام استخوان‌ها</li>
                <li>رو به جهت +Z</li>
              </ul>
            </div>

            <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#c8a24a]/40 bg-black/20 transition-colors hover:border-[#c8a24a] hover:bg-[#c8a24a]/5">
              {importing
                ? <><Loader2 className="h-5 w-5 animate-spin text-[#c8a24a]" /> در حال ریتارگت انیمیشن‌ها…</>
                : <><FileUp className="h-5 w-5 text-[#c8a24a]" /> فایل GLB را انتخاب کنید</>}
              <input
                type="file"
                accept=".glb,.gltf"
                className="hidden"
                disabled={importing}
                onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
              />
            </label>

            <p className="text-[11px] text-[#6b6252]">
              مدلی ندارید؟{' '}
              <a
                href="sample-model.glb"
                download="sample-model.glb"
                className="text-[#c8a24a] underline decoration-dotted hover:text-[#e8c97a]"
              >
                مدل نمونه استاندارد را دانلود کنید
              </a>{' '}
              و همان را وارد کنید تا جریان کار را ببینید.
            </p>

            {report && <ReportCard report={report} />}

            {isImported && (
              <Button variant="outline" className="w-full border-[#c8a24a]/40" onClick={() => { backToCreator(); setImportOpen(false); }}>
                <RotateCcw className="ml-1 h-4 w-4" /> بازگشت به شخصیت‌ساز
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

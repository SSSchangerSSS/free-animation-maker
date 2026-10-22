'use client';

// ─────────────────────────────────────────────────────────────
// شخصیت‌ساز قهرمانان V2 — رابط کاربری اصلی
// تم: فانتزی تاریک طلایی (سبک Baldur's Gate) + بدنه‌های KayKit
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  User, Leaf, Axe, Hammer, Skull, Dices, Upload, Download, Camera, RotateCw, RotateCcw,
  PersonStanding, Footprints, Zap, Swords, Sword, Hand, Music, ChevronUp, ChevronDown,
  Wand2, Save, FolderOpen, Loader2, Bone, CheckCircle2, AlertTriangle, FileUp,
  Shield, Flame, PartyPopper, ShieldCheck, Search, Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Engine, type EngineAnimInfo, type AnimCat } from '@/lib/three/engine';
import { BODIES } from '@/lib/character/kaykit';
import {
  RACES, SKIN_PALETTES, HAIR_COLORS, CLOTH_COLORS, METAL_COLORS,
  HAIR_STYLES, BEARD_STYLES, HERO_PRESETS, defaultConfig, randomName, rebaseConfigForRace,
  type CharConfig, type RaceId,
} from '@/lib/character/types';

// ── آیکون‌ها ─────────────────────────────────────────────────
const RACE_ICONS: Record<RaceId, React.ComponentType<{ className?: string }>> = {
  human: User, elf: Leaf, orc: Axe, dwarf: Hammer, undead: Skull,
};
const CAT_LABELS: Record<AnimCat | 'all' | 'model', string> = {
  all: 'همه', combat: 'رزم', loco: 'حرکت', magic: 'جادو', social: 'تعامل', other: 'سایر', model: 'مدل',
};
const ORIGIN_BADGE: Record<string, string> = {
  kaykit: 'کی‌کیت', ual: 'جهانی', proc: 'رویه‌ای', model: 'مدل',
};

// ── کامپوننت‌های کوچک ────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-1 flex items-center gap-2 text-xs font-bold tracking-wide text-[#c8a24a]">
      <span className="h-px flex-1 bg-gradient-to-l from-[#c8a24a]/40 to-transparent" />
      {children}
      <span className="h-px flex-1 bg-gradient-to-r from-[#c8a24a]/40 to-transparent" />
    </h3>
  );
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
            'h-8 w-8 rounded-lg border border-black/50 shadow-inner transition-transform hover:scale-110',
            value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-[#c8a24a] ring-offset-2 ring-offset-[#171310]',
          )}
          style={{ background: c }}
        />
      ))}
      <label
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#c8a24a]/60"
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

function StyleGrid<T extends string>({ options, value, onChange, cols = 3 }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; cols?: number;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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

function ToggleRow({ label, value, onChange, hint }: {
  label: string; value: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors',
        value ? 'border-[#c8a24a] bg-[#c8a24a]/10 text-[#e8c97a]' : 'border-[#c8a24a]/20 bg-black/20 text-[#b8ad98] hover:border-[#c8a24a]/50',
      )}
    >
      <span>{label}{hint && <span className="mr-1 text-[10px] text-[#8a8070]">({hint})</span>}</span>
      <span className={cn('h-3.5 w-6 rounded-full p-0.5 transition-colors', value ? 'bg-[#c8a24a]' : 'bg-black/40')}>
        <span className={cn('block h-2.5 w-2.5 rounded-full bg-[#171310] transition-transform', value && '-translate-x-2.5')} />
      </span>
    </button>
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
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

// ── پنل شخصی‌سازی ────────────────────────────────────────────
function CustomizationPanel({ cfg, set }: {
  cfg: CharConfig;
  set: (patch: Partial<CharConfig>) => void;
}) {
  const race = RACES[cfg.race];
  const RaceIcon = RACE_ICONS[cfg.race];
  const bodyDef = BODIES[cfg.body];
  const weaponOptions = bodyDef.weapons;
  const isUndead = cfg.race === 'undead';

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
          <Button
            variant="outline" size="icon" className="h-9 w-9 shrink-0 border-[#c8a24a]/30"
            onClick={() => set({ name: randomName(cfg.race) })} title="نام تصادفی"
          >
            <Dices className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="race" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 grid grid-cols-4 bg-black/30">
          <TabsTrigger value="race" className="text-xs">نژاد</TabsTrigger>
          <TabsTrigger value="face" className="text-xs">چهره</TabsTrigger>
          <TabsTrigger value="body" className="text-xs">اندام</TabsTrigger>
          <TabsTrigger value="gear" className="text-xs">جامه</TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-color:#c8a24a55_transparent] [scrollbar-width:thin]">
          {/* نژاد و بدنه */}
          <TabsContent value="race" className="mt-0 space-y-3">
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
            <SectionTitle>نژاد</SectionTitle>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(RACES) as RaceId[]).map((id) => {
                const r = RACES[id];
                const Icon = RACE_ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => set(rebaseConfigForRace(cfg, id))}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2.5 text-right transition-colors',
                      cfg.race === id
                        ? 'border-[#c8a24a] bg-[#c8a24a]/10'
                        : 'border-[#c8a24a]/15 bg-black/20 hover:border-[#c8a24a]/40',
                    )}
                  >
                    <span className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                      cfg.race === id ? 'border-[#c8a24a] text-[#e8c97a]' : 'border-[#c8a24a]/20 text-[#8a8070]',
                    )}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-[#e8ddc8]">{r.label}</span>
                      <span className="block truncate text-[10px] text-[#8a8070]">{r.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="my-1 border-t border-[#c8a24a]/10" />
            <SectionTitle>بدنه‌ی {race.label}</SectionTitle>
            {race.bodies.length > 1 ? (
              <StyleGrid
                options={race.bodies.map((b) => ({ id: b, label: BODIES[b].label }))}
                value={cfg.body}
                onChange={(b) => set({ body: b, weapon: BODIES[b].defaultWeapon, helmet: cfg.helmet && !!BODIES[b].helmet })}
                cols={2}
              />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[#c8a24a]/15 bg-black/20 p-2.5 text-xs text-[#8a8070]">
                <RaceIcon className="h-4 w-4 shrink-0 text-[#c8a24a]" />
                {bodyDef.label} — {bodyDef.desc}
              </div>
            )}
          </TabsContent>

          {/* چهره */}
          <TabsContent value="face" className="mt-0 space-y-4">
            <div>
              <SectionTitle>رنگ {isUndead ? 'استخوان' : 'پوست'}</SectionTitle>
              <Swatches colors={SKIN_PALETTES[cfg.race]} value={cfg.skin} onChange={(c) => set({ skin: c })} />
            </div>
            <div>
              <SectionTitle>مدل مو</SectionTitle>
              <StyleGrid options={HAIR_STYLES} value={cfg.hair} onChange={(v) => set({ hair: v })} cols={3} />
            </div>
            <div>
              <SectionTitle>رنگ مو</SectionTitle>
              <Swatches colors={HAIR_COLORS} value={cfg.hairColor} onChange={(c) => set({ hairColor: c })} />
            </div>
            <div>
              <SectionTitle>ریش</SectionTitle>
              <StyleGrid options={BEARD_STYLES} value={cfg.beard} onChange={(v) => set({ beard: v })} cols={3} />
            </div>
            <div>
              <SectionTitle>رنگ ریش</SectionTitle>
              <Swatches colors={HAIR_COLORS} value={cfg.beardColor} onChange={(c) => set({ beardColor: c })} />
            </div>
            {!isUndead && (
              <div className="grid grid-cols-2 gap-1.5">
                <ToggleRow label="گوش الف" value={cfg.ears} onChange={(v) => set({ ears: v })} />
                <ToggleRow label="عاج ارگ" value={cfg.tusks} onChange={(v) => set({ tusks: v })} />
              </div>
            )}
          </TabsContent>

          {/* اندام */}
          <TabsContent value="body" className="mt-0">
            <SectionTitle>اندام {race.label}</SectionTitle>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#c8a24a]/15 bg-black/20 p-2.5 text-xs text-[#8a8070]">
              <RaceIcon className="h-4 w-4 shrink-0 text-[#c8a24a]" />
              قد پایه {race.label}: {Math.round(race.defaultHeight * 100)}٪ — با اسلایدر تنظیم کنید.
            </div>
            <SliderRow label="قد" value={cfg.height} min={0.62} max={1.12} step={0.01}
              onChange={(v) => set({ height: v })} format={(v) => `${Math.round(v * 178)} سانتی‌متر`} />
            <SliderRow label="تنومندی" value={cfg.bulk} min={0.85} max={1.25} step={0.01}
              onChange={(v) => set({ bulk: v })} format={(v) => `${Math.round(v * 100)}٪`} />
          </TabsContent>

          {/* جامه */}
          <TabsContent value="gear" className="mt-0 space-y-4">
            <div>
              <SectionTitle>سلاح</SectionTitle>
              <StyleGrid
                options={weaponOptions.map((w) => ({ id: w.id, label: w.label }))}
                value={weaponOptions.some((w) => w.id === cfg.weapon) ? cfg.weapon : bodyDef.defaultWeapon}
                onChange={(v) => set({ weapon: v })}
                cols={2}
              />
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {bodyDef.helmet && (
                <ToggleRow label={bodyDef.helmet.label} value={cfg.helmet} onChange={(v) => set({ helmet: v })} />
              )}
              {bodyDef.cape && (
                <ToggleRow label={bodyDef.cape.label} value={cfg.cape} onChange={(v) => set({ cape: v })} />
              )}
            </div>
            <div>
              <SectionTitle>رنگ جامه</SectionTitle>
              <Swatches colors={CLOTH_COLORS} value={cfg.cloth} onChange={(c) => set({ cloth: c })} />
            </div>
            <div>
              <SectionTitle>رنگ فلزات</SectionTitle>
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
  const [activeAnim, setActiveAnim] = useState('kk:Idle');
  const [speed, setSpeed] = useState(1);
  const [autoRotate, setAutoRotate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isImported, setIsImported] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [report, setReport] = useState<Parameters<typeof ReportCard>[0]['report'] | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [libQuery, setLibQuery] = useState('');
  const [libCat, setLibCat] = useState<AnimCat | 'all' | 'model'>('all');
  const presetInputRef = useRef<HTMLInputElement>(null);

  // ── init engine ──
  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new Engine(mountRef.current);
    engineRef.current = engine;
    engine.onLoadingChange = (v) => setLoading(v);
    engine.onImportedChange = (v) => {
      setIsImported(v);
      if (!v) setActiveAnim('kk:Idle');
      setAnims(engineRef.current?.getAnimList() ?? []);
    };
    engine.onLibraryChange = () => {
      setAnims(engineRef.current?.getAnimList() ?? []);
    };
    // setCharacter توسط اثر [config] صدا زده می‌شود — اینجا دوباره صدا نمی‌زنیم
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
     
  }, []);

  useEffect(() => { void engineRef.current?.setCharacter(config); }, [config]);
  useEffect(() => { engineRef.current?.play(activeAnim); }, [activeAnim]);
  useEffect(() => { engineRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => { engineRef.current?.setAutoRotate(autoRotate); }, [autoRotate]);

  const set = useCallback((patch: Partial<CharConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
  }, []);

  // ── اعمال ──
  const randomize = useCallback(() => {
    const races: RaceId[] = ['human', 'elf', 'orc', 'dwarf', 'undead'];
    const race = races[Math.floor(Math.random() * races.length)];
    const r = RACES[race];
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const body = pick(r.bodies);
    const def = BODIES[body];
    setConfig(() => ({
      ...defaultConfig(race),
      name: randomName(race),
      body,
      skin: pick(SKIN_PALETTES[race]),
      hair: def.family === 'skeleton' ? 'none' : pick(HAIR_STYLES.filter((h) => h.id !== 'baked')).id,
      hairColor: pick(HAIR_COLORS),
      beard: race === 'elf' || def.family === 'skeleton' ? 'none' : pick(BEARD_STYLES.filter((b) => b.id !== 'baked')).id,
      beardColor: pick(HAIR_COLORS),
      cloth: pick(CLOTH_COLORS),
      metal: pick(METAL_COLORS),
      weapon: def.weapons[Math.floor(Math.random() * def.weapons.length)].id,
      helmet: def.helmet ? Math.random() < 0.6 : false,
      cape: def.cape ? Math.random() < 0.5 : false,
      height: r.defaultHeight * (0.94 + Math.random() * 0.12),
      bulk: (race === 'orc' || race === 'dwarf' ? 1.05 : 0.92) + Math.random() * 0.15,
    }));
    toast.success('قهرمان تازه‌ای ساخته شد!');
  }, []);

  const doExport = useCallback(async () => {
    try {
      toast('در حال ساخت خروجی…');
      const blob = await engineRef.current!.exportGLB();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.name || 'character'}.glb`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success('خروجی GLB دانلود شد — کتابخانه‌ی انیمیشن داخلش است');
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
    const blob = new Blob([JSON.stringify({ version: 2, config }, null, 2)], { type: 'application/json' });
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
        const c = data.config as CharConfig;
        if (!BODIES[c.body]) c.body = RACES[c.race].defaultBody;
        setConfig({ ...defaultConfig(c.race), ...c });
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
    setImportProgress('خواندن مدل…');
    try {
      const buf = await file.arrayBuffer();
      const rep = await engineRef.current!.importGLB(buf, (done, total) => {
        setImportProgress(`ریتارگت انیمیشن‌ها… ${done}/${total}`);
      });
      setReport(rep);
      setAnims(engineRef.current!.getAnimList());
      toast.success(`مدل وارد شد و ${Math.min(anims.length, 150)} انیمیشن رویش ریخته شد!`);
    } catch {
      toast.error('فایل GLB خوانده نشد');
    }
    setImporting(false);
    setImportProgress('');
  }, [anims.length]);

  const backToCreator = useCallback(() => {
    engineRef.current?.exitImported();
    setReport(null);
  }, []);

  // ── کتابخانه‌ی انیمیشن: دسته‌بندی و جستجو ──
  const filteredAnims = useMemo(() => {
    const q = libQuery.trim().toLowerCase();
    return anims.filter((a) => {
      if (libCat === 'model' && a.origin !== 'model') return false;
      if (libCat !== 'all' && libCat !== 'model' && a.cat !== libCat) return false;
      if (q && !a.label.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [anims, libQuery, libCat]);

  const favAnims = useMemo(() => {
    const favs = ['kk:Idle', 'kk:Walking_A', 'kk:Running_A', 'kk:1H_Melee_Attack_Slice_Horizontal', 'kk:Block', 'kk:Spellcast_Shoot', 'kk:Jump_Full_Short', 'ual:Dance_Loop', 'kk:Cheer', 'kk:Death_A', 'kk:Unarmed_Melee_Attack_Punch_A', 'kk:Throw'];
    return favs.map((id) => anims.find((a) => a.id === id)).filter((a): a is EngineAnimInfo => Boolean(a));
  }, [anims]);

  const stripAnims = libOpen ? [] : favAnims.length >= 6 ? favAnims : anims.slice(0, 12);
  const shownAnims = libOpen ? filteredAnims : stripAnims;

  // ── UI ──
  return (
    <div dir="rtl" className="flex h-screen flex-col overflow-hidden bg-[#0f0c08] text-[#e8ddc8]">
      {/* هدر */}
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-[#c8a24a]/20 bg-[#14100b]/95 px-3 backdrop-blur md:px-4">
        <div className="flex items-center gap-2.5">
          <Swords className="h-5 w-5 text-[#c8a24a]" />
          <h1 className="text-base font-black tracking-wide md:text-lg">شخصیت‌ساز قهرمانان</h1>
          <span className="hidden rounded-full border border-[#c8a24a]/30 bg-[#c8a24a]/10 px-2 py-0.5 text-[10px] text-[#c8a24a] md:inline">
            نسخه ۲ — بدنه‌های KayKit
          </span>
          {anims.length > 0 && (
            <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 lg:inline">
              {anims.length} انیمیشن
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="hidden text-xs sm:inline-flex" onClick={randomize}>
            <Dices className="ml-1 h-4 w-4" /> تصادفی
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:hidden" onClick={randomize} title="شخصیت تصادفی">
            <Dices className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={savePreset} title="ذخیره پریست">
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => presetInputRef.current?.click()} title="بارگذاری پریست">
            <FolderOpen className="h-4 w-4" />
          </Button>
          <input ref={presetInputRef} type="file" accept=".json" className="hidden"
            onChange={(e) => e.target.files?.[0] && loadPreset(e.target.files[0])} />
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={doScreenshot} title="عکس گرفتن">
            <Camera className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className={cn('h-9 w-9', autoRotate && 'text-[#e8c97a]')}
            onClick={() => setAutoRotate((v) => !v)} title="چرخش خودکار">
            <RotateCw className={cn('h-4 w-4', autoRotate && 'animate-spin [animation-duration:3s]')} />
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
        {/* وینیت سینمایی */}
        <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />

        {/* پوشش لودینگ */}
        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#0f0c08]/70 backdrop-blur-sm">
            <Loader2 className="h-9 w-9 animate-spin text-[#c8a24a]" />
            <span className="text-sm text-[#c8a24a]">در حال آماده‌سازی قهرمان…</span>
          </div>
        )}

        {/* پنل شخصی‌سازی (دسکتاپ) */}
        <aside className="absolute bottom-24 right-3 top-3 z-10 hidden w-[300px] flex-col overflow-hidden rounded-xl border border-[#c8a24a]/25 bg-[#14100b]/88 shadow-2xl backdrop-blur-md lg:flex">
          <CustomizationPanel cfg={config} set={set} />
        </aside>

        {/* دکمه پنل موبایل */}
        <Button className="absolute bottom-24 right-3 z-20 lg:hidden" variant="outline"
          onClick={() => setMobilePanel((v) => !v)}>
          <Wand2 className="ml-1 h-4 w-4" /> شخصی‌سازی
        </Button>

        {mobilePanel && (
          <div className="absolute inset-x-2 bottom-24 top-3 z-10 flex flex-col overflow-hidden rounded-xl border border-[#c8a24a]/25 bg-[#14100b]/95 backdrop-blur-md lg:hidden">
            <CustomizationPanel cfg={config} set={set} />
          </div>
        )}

        {/* پریست دوربین */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
          {([
            ['portrait', 'پرتره'],
            ['bust', 'نیم‌تنه'],
            ['full', 'تمام‌قد'],
          ] as const).map(([id, label]) => (
            <Button key={id} variant="outline" size="sm"
              className="h-8 border-[#c8a24a]/25 bg-[#14100b]/85 px-2.5 text-[11px] text-[#c8a24a] backdrop-blur hover:border-[#c8a24a]/60"
              onClick={() => engineRef.current?.setCameraPreset(id)}>
              <Video className="ml-1 h-3.5 w-3.5" /> {label}
            </Button>
          ))}
        </div>

        {/* نوار انیمیشن */}
        <div className="absolute bottom-4 left-1/2 z-10 w-[min(calc(100%-1.5rem),860px)] -translate-x-1/2">
          {libOpen && (
            <div className="mb-2 max-h-[320px] overflow-hidden rounded-xl border border-[#c8a24a]/25 bg-[#14100b]/95 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2 border-b border-[#c8a24a]/15 p-2.5">
                <Search className="h-4 w-4 shrink-0 text-[#c8a24a]" />
                <Input
                  value={libQuery}
                  onChange={(e) => setLibQuery(e.target.value)}
                  placeholder="جستجو در کتابخانه انیمیشن…"
                  className="h-8 border-[#c8a24a]/20 bg-black/30 text-xs"
                />
                <span className="shrink-0 text-[10px] text-[#8a8070]">{filteredAnims.length} مورد</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLibOpen(false)}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-1 overflow-x-auto border-b border-[#c8a24a]/10 px-2.5 py-1.5 [scrollbar-width:none]">
                {(Object.keys(CAT_LABELS) as (AnimCat | 'all' | 'model')[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setLibCat(c)}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1 text-[11px] transition-colors',
                      libCat === c
                        ? 'border-[#c8a24a] bg-[#c8a24a]/15 text-[#e8c97a]'
                        : 'border-transparent text-[#a89d88] hover:border-[#c8a24a]/30',
                    )}
                  >
                    {CAT_LABELS[c]}
                  </button>
                ))}
              </div>
              <div className="grid max-h-[220px] grid-cols-2 gap-1 overflow-y-auto p-2 sm:grid-cols-3 md:grid-cols-4 [scrollbar-color:#c8a24a55_transparent] [scrollbar-width:thin]">
                {shownAnims.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setActiveAnim(a.id)}
                    className={cn(
                      'flex items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-right text-[11px] transition-colors',
                      activeAnim === a.id
                        ? 'border-[#c8a24a] bg-[#c8a24a]/15 text-[#e8c97a]'
                        : 'border-transparent bg-black/20 text-[#a89d88] hover:border-[#c8a24a]/30',
                    )}
                  >
                    <span className="truncate">{a.label}</span>
                    <span className="shrink-0 rounded bg-black/40 px-1 text-[9px] text-[#8a8070]">{ORIGIN_BADGE[a.origin]}</span>
                  </button>
                ))}
                {shownAnims.length === 0 && (
                  <span className="col-span-full py-6 text-center text-xs text-[#6b6252]">چیزی پیدا نشد</span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-[#c8a24a]/25 bg-[#14100b]/88 px-2.5 py-2 shadow-2xl backdrop-blur-md [scrollbar-width:none]">
            {anims.length === 0 && !loading && (
              <span className="px-3 py-1.5 text-xs text-[#8a8070]">در حال آماده‌سازی انیمیشن‌ها…</span>
            )}
            {shownAnims.map((a) => {
              const Icon = a.cat === 'combat' ? Sword
                : a.cat === 'magic' ? Wand2
                : a.cat === 'social' ? PartyPopper
                : a.id.includes('Walk') ? Footprints
                : a.id.includes('Run') ? Zap
                : a.id.includes('Death') ? Skull
                : a.id.includes('Block') ? ShieldCheck
                : a.id.includes('Dance') ? Music
                : a.id.includes('Sit') || a.id.includes('Lie') ? Hand
                : PersonStanding;
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
                <button
                  type="button"
                  onClick={() => setLibOpen((v) => !v)}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] transition-colors',
                    libOpen ? 'border-[#c8a24a] bg-[#c8a24a]/15 text-[#e8c97a]' : 'border-[#c8a24a]/30 text-[#c8a24a] hover:bg-[#c8a24a]/10',
                  )}
                >
                  <Flame className="h-3.5 w-3.5" />
                  کتابخانه ({anims.length})
                  {libOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                </button>
                <span className="text-[10px] text-[#8a8070]">سرعت</span>
                <Slider value={[speed]} min={0.25} max={2} step={0.05}
                  onValueChange={(v) => setSpeed(v[0])} className="w-20" />
              </div>
            )}
          </div>
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
              مدل GLB خود را وارد کنید — کل کتابخانه‌ی {anims.length || 150} انیمیشنی رویش ریخته می‌شود.
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
                ? <><Loader2 className="h-5 w-5 animate-spin text-[#c8a24a]" /> {importProgress || 'در حال ریتارگت…'}</>
                : <><FileUp className="h-5 w-5 text-[#c8a24a]" /> فایل GLB را انتخاب کنید</>}
              <input type="file" accept=".glb,.gltf" className="hidden" disabled={importing}
                onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} />
            </label>

            <p className="text-[11px] text-[#6b6252]">
              مدلی ندارید؟{' '}
              <a href="sample-model.glb" download="sample-model.glb"
                className="text-[#c8a24a] underline decoration-dotted hover:text-[#e8c97a]">
                مدل نمونه استاندارد را دانلود کنید
              </a>{' '}
              و همان را وارد کنید تا جریان کار را ببینید.
            </p>

            {report && <ReportCard report={report} />}

            {isImported && (
              <Button variant="outline" className="w-full border-[#c8a24a]/40"
                onClick={() => { backToCreator(); setImportOpen(false); }}>
                <RotateCcw className="ml-1 h-4 w-4" /> بازگشت به شخصیت‌ساز
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

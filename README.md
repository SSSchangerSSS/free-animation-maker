# ⚔️ Free Animation Maker — شخصیت‌ساز قهرمانان

**English** | [فارسی](#فارسی)

A free, open-source 3D character creator & animation studio in the browser — inspired by Baldur's Gate style customization. Built with **Three.js** + **Next.js**, 100% client-side (no server needed).

🌐 **Live demo:** https://ssschangersss.github.io/free-animation-maker/

## ✨ Features

### 🧝 Fantasy Races (4)
- **Human** — balanced warrior of the middle lands
- **Elf** — tall, slender, long ears, archer
- **Orc** — bulky barbarian with tusks & big jaw
- **Dwarf** — short, stout, mountain paladin

Each race changes the skeleton proportions (uniform bone scaling, no shear), skull shape, ears, tusks, default colors and names.

### 🎨 Baldur's Gate style customization
- Skin color palettes per race (+ custom color picker)
- 5 hair styles × 10 hair colors
- 4 beard styles with separate beard color
- Eye colors, outfit / pants / boots / metal colors
- Height & bulk sliders
- **7 weapons**: sword, war axe, mace, longbow, magic staff, sword+shield, none

### 🏆 Hero presets
5 ready-made heroes (Ario the Paladin, Ëarin the Ranger, Groshnak the Berserker, Thorin the King, Lithariel the Mage) + random hero generator + save/load presets as JSON.

### 🎬 Animation library (14 procedural clips)
`idle, guard, block, walk, run, attack, cast, wave, dance, cheer, bow, jump, hit, death` — all generated procedurally on a canonical humanoid skeleton, with crossfade, speed control and loop/one-shot handling. Adding a new animation = adding one function in `src/lib/animation/clips.ts`.

### 📥 Standard model import + animation retargeting
- Import any **GLB/GLTF** with a standard humanoid skeleton (**Mixamo / Blender / Unity / UE** naming — auto-detected)
- Automatic **A-Pose → T-Pose** correction
- The whole 14-clip library is **retargeted** onto your model (FK world-space delta retargeting with hip-position transfer)
- Model's own animations are also detected and playable
- Sample model included: [sample-model.glb](public/sample-model.glb)

### 📤 Export
- Export the current character (with skeleton + all 14 animations) as **GLB**
- Save/load character presets as JSON
- PNG screenshots

## 🚀 Run locally

```bash
npm install     # or: bun install
npm run dev     # http://localhost:3000
```

### Build for GitHub Pages (static)

```bash
BUILD_MODE=static npx next build   # output in out/
```

The static build is fully self-contained (fonts bundled, no external CDN).

## 🗂 Project structure

```
src/
├── components/creator.tsx        # UI (Persian RTL, dark-fantasy theme)
├── lib/
│   ├── character/
│   │   ├── skeleton.ts           # canonical 17-bone humanoid rig (T-Pose)
│   │   ├── body.ts               # anatomical skinned body + soft joint weights
│   │   ├── features.ts           # hair, beard, eyes, ears, tusks
│   │   ├── weapons.ts            # 6 procedural weapons
│   │   ├── types.ts              # races, palettes, hero presets
│   │   └── index.ts              # character factory
│   ├── animation/
│   │   ├── clips.ts              # 14 procedural animation clips
│   │   └── retarget.ts           # GLB import + animation retargeting
│   └── three/engine.ts           # scene, lights, mixer, export
└── app/                          # Next.js app router
```

## 🤝 Adding your own animation

Open `src/lib/animation/clips.ts`, copy any clip function, change the keyframes (angles are in degrees), and register it in `ANIM_DEFS` + `buildClipLibrary()`. It will instantly appear in the UI and be retargeted to imported models too.

## 📄 License

MIT — see [LICENSE](LICENSE). Built with [Three.js](https://threejs.org) (MIT) and [Next.js](https://nextjs.org).

---

<a id="فارسی"></a>
# فارسی

سازنده‌ی شخصیت سه‌بعدی و استودیو انیمیشن رایگان — الهام‌گرفته از شخصی‌سازی Baldur's Gate. ساخته‌شده با **Three.js** و **Next.js**، کاملاً سمت مرورگر.

## ویژگی‌ها
- **۴ نژاد فانتزی**: انسان، الف، ارگ، دورف (با اسکلت و جمجمه‌ی مخصوص هر نژاد)
- **شخصی‌سازی کامل**: رنگ پوست، ۵ مدل مو، ۴ مدل ریش با رنگ جدا، رنگ چشم، لباس و زره و فلزات، قد و هیکل
- **۷ سلاح**: شمشیر، تبر جنگی، گرز خاردار، کمان بلند، عصای جادو، شمشیر+سپر
- **۵ پریست قهرمان آماده** + دکمه‌ی تصادفی + ذخیره/بارگذاری پریست JSON
- **۱۴ انیمیشن Procedural** با crossfade و کنترل سرعت: ایستادن، آماده نبرد، دفاع، راه رفتن، دویدن، حمله، افسون‌خوانی، سلام، رقص، شادی پیروزی، تعظیم، پرش، ضربه خوردن، مرگ
- **ورود مدل استاندارد GLB** (اسکلت Mixamo/Blender/Unity — تشخیص خودکار + اصلاح A-Pose) و **ریتارگت کل کتابخانه انیمیشن** روی مدل شما
- **خروجی GLB** با تمام انیمیشن‌ها + عکس PNG

## اجرا

```bash
npm install
npm run dev
```

## ساخت خروجی گیت‌هاب پیج

```bash
BUILD_MODE=static npx next build   # خروجی در out/
```

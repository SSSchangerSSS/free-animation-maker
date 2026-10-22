# ⚔️ Character Forge — شخصیت‌ساز قهرمانان | Free Animation Maker

A browser-based **3D character creator & animation studio** inspired by Baldur's Gate 3 —
built with **Three.js**. Fully static, no server, no build tools needed at runtime.

یک شخصیت‌ساز سه‌بعدی و استودیوی انیمیشن تحت مرورگر با الهام از Baldur's Gate 3 — با Three.js.

**🌐 Live: https://ssschangersss.github.io/free-animation-maker/**

## ✨ Features | امکانات

### Characters | کاراکترها
- **7 rigged bodies** from [KayKit Character Packs](https://kaylousberg.itch.io/) (CC0):
  Knight, Barbarian, Mage, Rogue, Rogue Hooded, Skeleton Warrior, Skeleton Minion
- **5 races**: Human, Elf (pointed ears), Orc (green skin + tusks), Dwarf, Undead
- **Real-time texture recoloring** — skin, hair, cloth and metal colors repaint the atlas
  with gradient-aware matching (no UV baking needed)
- **Procedural hair, beards, elf ears and orc tusks** in matching chunky low-poly style
- Baked weapons, helmets and capes toggleable per body
- 6 ready-made hero presets + random character generator
- Height & bulk sliders

### Animation | انیمیشن
- **129-animation master library** merged from three sources:
  - 76–95 baked KayKit clips per body (all share one rig)
  - 46 clips from Quaternius' [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) (CC0), retargeted from Rigify
  - 14 procedural clips (idle, guard, walk, run, attack, cast, dance, death, …)
- Library drawer with **search + categories** (combat / locomotion / magic / social)
- Playback speed control, one-shot clips return to the previous loop automatically
- **Import any GLB/GLTF** with a Mixamo / Blender / Unity humanoid skeleton —
  the entire animation library is **retargeted onto your model** automatically
  (A-pose auto-correction included)
- **Export GLB** with the character + whole animation library embedded

### Models | مدل‌ها
All KayKit bodies and the animation library load lazily from `/models` —
swap any `.glb` in `public/models` to customise the roster.

## 🛠 Tech | تکنولوژی
Next.js (static export) · Three.js · custom UV-mask atlas recoloring engine ·
world-space-delta animation retargeting · zero runtime dependencies beyond three

## 🚀 Run | اجرا
```bash
bun install   # or npm install
bun dev       # dev server

# static export for GitHub Pages
BUILD_MODE=static NEXT_PUBLIC_BASE_PATH=/free-animation-maker npx next build
# → deploy ./out to the gh-pages branch (with .nojekyll)
```

## 📄 License | مجوز
Code: MIT · Character assets: [KayKit](https://kaylousberg.itch.io/kaykit-adventurers) CC0 ·
Animations: [Quaternius](https://quaternius.com) CC0

# ⚔️ Character Forge — شخصیت‌ساز قهرمانان | Free Animation Maker

A browser-based **3D character creator & animation studio** inspired by Baldur's Gate 3 —
built with **Three.js**. Fully static, no server needed at runtime.

یک شخصیت‌ساز سه‌بعدی و استودیوی انیمیشن تحت مرورگر با الهام از Baldur's Gate 3 — با Three.js.

**🌐 Live: https://ssschangersss.github.io/free-animation-maker/**

## ✨ Features | امکانات

### Characters | کاراکترها
- **7 rigged bodies** from [KayKit Character Packs](https://kaylousberg.itch.io/) (CC0):
  Knight, Barbarian, Mage, Rogue, Rogue Hooded, Skeleton Warrior, Skeleton Minion
- **5 races**: Human, Elf (pointed ears), Orc (green skin + tusks), Dwarf, Undead
- **Real-time texture recoloring** — skin, hair, beard, cloth and metal colors repaint the
  atlas from the **original texture every time** (reversible, non-accumulating) with
  gradient-aware matching and full 360° hue-wrap support
- **Procedural hair, beards (with independent color), elf ears and orc tusks** in matching chunky low-poly style
- Baked weapons, helmets and capes toggleable per body
- 6 ready-made hero presets + random character generator + **validated preset import/export** (Zod schema)
- Height & bulk sliders + AAA-style limb proportion sliders (leg / arm / torso / shoulder / head / muscle)

### Animation | انیمیشن
- **129-animation master library** merged from three sources:
  - 76–95 baked KayKit clips per body (all share one rig)
  - 46 clips from Quaternius' [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) (CC0), retargeted from Rigify
  - 14 procedural clips (idle, guard, walk, run, attack, cast, dance, death, …)
- Library drawer with **search + categories** (combat / locomotion / magic / social)
- Playback speed control that **survives rebuilds/imports**, one-shot clips return to the previous loop automatically
- **Import any GLB/GLTF** with a Mixamo / Blender / Unity humanoid skeleton —
  the entire animation library is **retargeted onto your model** automatically:
  - each clip keeps its **source convention** (canonical / rig rest) and is transferred through
    the matching retarget path with correct parent-space bridges
  - shoulder-vs-arm and root-vs-pelvis name conflicts are resolved by semantic + structural priority
  - multi-file `.gltf` imports (`.bin` + textures) are supported; external CDN resources are rejected
  - 100 MB input cap; local Draco decoder (works offline)
- **Export GLB** with the character + a filtered, viewer-consistent animation library
  (weapon hand/back placement is a runtime behaviour — it is frozen at export time)

## 🛠 Tech | تکنولوژی
Next.js (static export) · Three.js · custom UV-mask atlas recoloring engine ·
world-space-delta animation retargeting with parent-bridge compensation ·
Zod-validated presets · Vitest unit tests · CI (lint + typecheck + test + build on Ubuntu/Windows)

## 🚀 Run | اجرا
```bash
bun install   # or npm install
bun dev       # dev server on :3000

# static export for GitHub Pages (cross-platform, no cp/tee/POSIX env)
bun run build:static
# → deploy ./out to the gh-pages branch (with .nojekyll)

# server build
bun run build:server && bun start

# quality gates
bun run lint && bun run typecheck && bun run test
```

## 📄 License | مجوز
Code: MIT · Character assets: [KayKit](https://kaylousberg.itch.io/kaykit-adventurers) CC0 ·
Animations: [Quaternius](https://quaternius.com) CC0

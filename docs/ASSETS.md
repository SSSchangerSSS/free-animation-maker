# Asset Provenance — V3 Model Upgrade (Phase 2)

All V3 assets are **CC0 1.0 Universal** (public domain) by [Quaternius](https://quaternius.com):

| Asset | Source pack | License file |
|---|---|---|
| `Male_Base.glb`, `Female_Base.glb` | Universal Base Characters (itch.io: quaternius.itch.io/universal-base-characters) | License_Standard.txt → CC0 1.0 |
| `Male_Ranger.glb`, `Male_Peasant.glb`, `Female_Ranger.glb`, `Female_Peasant.glb` | Modular Character Outfits - Fantasy (itch.io: quaternius.itch.io/modular-character-outfits-fantasy) | CC0 1.0 (pack page) |
| `Hair_*.glb`, `Eyebrows_*.glb` | Universal Base Characters — Hairstyles (rigged to head bone) | CC0 1.0 |
| `weapons/W_*.glb` | Modular Weapons Pack (itch.io: quaternius.itch.io/lowpoly-medieval-weapons) | CC0 1.0 |

## Processing pipeline (reproducible)
1. Download via itch.io free-download flow (`scripts/itch-dl.sh`)
2. Convert `.gltf + .bin + png` → single `.glb`: `npx gltf-pipeline -i in.gltf -o out.glb`
3. Weapons: `npx obj2gltf -i in.obj -o out.glb`
4. Optimize: `npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-compress webp --texture-size 1024` (hairstyles: `--texture-size 512`)
5. Runtime: app's GLTFLoader with local DRACOLoader (`public/draco/`), WebP textures supported natively by browsers

## Skeleton contract
All characters/outfits/hair share the **Universal 65-joint rig**
(`root, pelvis, spine_01..03, neck_01, Head, clavicle_*, upperarm_*, lowerarm_*,
hand_*, fingers 01-03+leaf, thigh_*, calf_*, foot_*, ball_*`) —
attachments are re-bound to the body skeleton by bone-name mapping
(`src/lib/character/universal.ts: rebindSkinned`).

- Universal Animation Library (already shipped as `UAL.glb`, Rigify DEF- naming)
  retargets onto this rig via the existing rest-based path.
- Modification & redistribution: permitted by CC0; no attribution required
  (attribution kept here as good practice).

## KayKit assets (previous bodies, still selectable)
KayKit Character Packs — CC0 — (kaylousberg.itch.io), unchanged from V2.

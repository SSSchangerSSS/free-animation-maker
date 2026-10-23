// بازرسی ساختار GLB بدنه‌های KayKit — سلسله‌مراتب نودها، محل سلاح‌ها، اسکین، انیمیشن‌ها
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

import draco3d from 'draco3d';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const file = process.argv[2] ?? 'public/models/Knight.glb';
const doc = await io.read(file);
const root = doc.getRoot();

const nodes = root.listNodes();
console.log(`=== ${file} ===`);
console.log(`nodes: ${nodes.length}, scenes: ${root.listScenes().length}, animations: ${root.listAnimations().length}, skins: ${root.listSkins().length}, meshes: ${root.listMeshes().length}`);

// درخت نودها (فقط depth <= 3 از ریشهٔ صحنه)
// min/max دستی — مستقل از نسخه

function bboxOf(pos) {
  const n = pos.getCount();
  const t = [0, 0, 0];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, t);
    for (let k = 0; k < 3; k++) { if (t[k] < min[k]) min[k] = t[k]; if (t[k] > max[k]) max[k] = t[k]; }
  }
  return { min, max };
}

function dump(node, depth, maxDepth) {
  if (depth > maxDepth) return;
  const name = node.getName() || '(unnamed)';
  const mesh = node.getMesh();
  const skin = node.getSkin();
  const trs = `t=[${node.getTranslation().map(v => v.toFixed(3))}] r=[${node.getRotation().map(v => v.toFixed(2))}] s=[${node.getScale().map(v => v.toFixed(2))}]`;
  const extra = [];
  if (mesh) {
    const prims = mesh.listPrimitives();
    const pos = prims[0]?.getAttribute('POSITION');
    extra.push(`mesh(${prims.length}p, v=${pos ? pos.getCount() : 0})`);
    if (pos) {
      const { min, max } = bboxOf(pos);
      extra.push(`bbox=[${min.map(v => v.toFixed(3))}..${max.map(v => v.toFixed(3))}]`);
    }
  }
  if (skin) extra.push(`skin(joints=${skin.listJoints().length})`);
  console.log(`${'  '.repeat(depth)}${name} ${trs} ${extra.join(' ')}`);
  for (const ch of node.listChildren()) dump(ch, depth + 1, maxDepth);
}

for (const scene of root.listScenes()) {
  console.log(`--- scene "${scene.getName()}" ---`);
  for (const n of scene.listChildren()) dump(n, 0, 3);
}

// نودهای سلاح — والد + هندسه
console.log('--- weapon nodes ---');
for (const n of nodes) {
  const nm = n.getName() || '';
  if (/Sword|Axe|Knife|Shield|Staff|Wand|Crossbow|Spellbook|Book/i.test(nm) && n.getMesh()) {
    const parent = n.getParentNode();
    const prims = n.getMesh().listPrimitives();
    const pos = prims[0]?.getAttribute('POSITION');
    const bb = pos ? bboxOf(pos) : null;
    console.log(`${nm}  parent=${parent?.getName()}  prims=${prims.length}  v=${pos?.getCount()}`);
    console.log(`   local bbox: min=[${bb?.min.map(v => v.toFixed(4))}] max=[${bb?.max.map(v => v.toFixed(4))}]`);
  }
}

// انیمیشن‌ها
console.log('--- animations ---');
for (const a of root.listAnimations()) console.log(`  ${a.getName()} (channels=${a.listChannels().length})`);

// استخوان‌ها
const skin = root.listSkins()[0];
if (skin) {
  console.log('--- joints ---');
  console.log(skin.listJoints().map(j => j.getName()).join(', '));
}

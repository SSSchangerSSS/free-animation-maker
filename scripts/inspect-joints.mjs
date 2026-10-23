// درخت کامل مفاصل + زنجیرهٔ handslot + پروفایل سریع همهٔ بدنه‌ها
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});


const file = process.argv[2] ?? 'public/models/Knight.glb';
const doc = await io.read(file);
const root = doc.getRoot();

// درخت کامل از ریشهٔ اسکین (Rig یا root)
function tree(node, depth) {
  const mesh = node.getMesh();
  const tag = mesh ? ' [mesh]' : '';
  console.log(`${'  '.repeat(depth)}${node.getName()}${tag}`);
  for (const ch of node.listChildren()) tree(ch, depth + 1);
}

const sceneRoot = root.listScenes()[0].listChildren()[0];
console.log('=== FULL TREE from "' + sceneRoot.getName() + '" ===');
tree(sceneRoot, 0);

// زنجیرهٔ والد handslot.r
const nodes = root.listNodes();
const hs = nodes.find(n => n.getName() === 'handslot.r');
if (hs) {
  console.log('=== handslot.r ancestor chain ===');
  let p = hs;
  const chain = [];
  while (p) { chain.push(p.getName()); p = p.getParentNode(); }
  console.log(chain.join(' ← '));
}

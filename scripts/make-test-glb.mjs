// ساخت GLB آزمایشی با اسکلت سبک Mixamo برای تست Import/Retarget
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFileSync } from 'fs';

// Polyfill برای Node (GLTFExporter از FileReader استفاده می‌کند)
globalThis.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      const u8 = new Uint8Array(b);
      let bin = '';
      for (const byte of u8) bin += String.fromCharCode(byte);
      this.result = `data:application/octet-stream;base64,${btoa(bin)}`;
      this.onload?.(); this.onloadend?.();
    });
  }
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onload?.(); this.onloadend?.(); });
  }
};

// درخت استخوان به سبک Mixamo (نام‌ها با پیشوند mixamorig:)
const M = 'mixamorig:';
const defs = [
  [`${M}Hips`, null, [0, 1.0, 0]],
  [`${M}Spine`, `${M}Hips`, [0, 0.12, 0]],
  [`${M}Spine1`, `${M}Spine`, [0, 0.14, 0]],
  [`${M}Neck`, `${M}Spine1`, [0, 0.2, 0]],
  [`${M}Head`, `${M}Neck`, [0, 0.1, 0]],
  [`${M}LeftShoulder`, `${M}Spine1`, [0.06, 0.16, 0]],
  [`${M}LeftArm`, `${M}LeftShoulder`, [0.14, 0.02, 0]],
  [`${M}LeftForeArm`, `${M}LeftArm`, [0.27, 0, 0]],
  [`${M}LeftHand`, `${M}LeftForeArm`, [0.24, 0, 0]],
  [`${M}RightShoulder`, `${M}Spine1`, [-0.06, 0.16, 0]],
  [`${M}RightArm`, `${M}RightShoulder`, [-0.14, 0.02, 0]],
  [`${M}RightForeArm`, `${M}RightArm`, [-0.27, 0, 0]],
  [`${M}RightHand`, `${M}RightForeArm`, [-0.24, 0, 0]],
  [`${M}LeftUpLeg`, `${M}Hips`, [0.1, -0.06, 0]],
  [`${M}LeftLeg`, `${M}LeftUpLeg`, [0, -0.42, 0]],
  [`${M}LeftFoot`, `${M}LeftLeg`, [0, -0.4, 0]],
  [`${M}RightUpLeg`, `${M}Hips`, [-0.1, -0.06, 0]],
  [`${M}RightLeg`, `${M}RightUpLeg`, [0, -0.42, 0]],
  [`${M}RightFoot`, `${M}RightLeg`, [0, -0.4, 0]],
];

const bones = {};
const rootBone = new THREE.Bone();
rootBone.name = defs[0][0];
rootBone.position.set(...defs[0][2]);
bones[defs[0][0]] = rootBone;
for (let i = 1; i < defs.length; i++) {
  const [name, parent, pos] = defs[i];
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(...pos);
  bones[parent].add(b);
  bones[name] = b;
}

// یک مش ساده چسبیده به اسکلت (جعبه‌های بدن)
const parts = [];
function addBox(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  parts.push(g);
}
addBox(0.26, 0.36, 0.16, 0, 1.22, 0);  // تنه
addBox(0.24, 0.14, 0.15, 0, 1.0, 0);   // لگن
addBox(0.22, 0.24, 0.2, 0, 1.5, 0.01); // سر
addBox(0.24, 0.09, 0.1, 0.42, 1.34, 0); addBox(0.24, 0.09, 0.1, -0.42, 1.34, 0); // بازوها
addBox(0.2, 0.08, 0.09, 0.66, 1.34, 0); addBox(0.2, 0.08, 0.09, -0.66, 1.34, 0); // ساعدها
addBox(0.1, 0.36, 0.12, 0.1, 0.76, 0); addBox(0.1, 0.36, 0.12, -0.1, 0.76, 0);   // ران‌ها
addBox(0.09, 0.36, 0.11, 0.1, 0.38, 0); addBox(0.09, 0.36, 0.11, -0.1, 0.38, 0); // ساق‌ها

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const merged = mergeGeometries(parts, false);

// وزن‌دهی ساده: هر رأس به نزدیک‌ترین استخوان Mixamo (فاصله نقطه-پاره‌خط)
const MAPPING = [
  [`${M}Hips`, [0, 1.0, 0], [0, 1.12, 0]],
  [`${M}Spine`, [0, 1.12, 0], [0, 1.26, 0]],
  [`${M}Spine1`, [0, 1.26, 0], [0, 1.46, 0]],
  [`${M}Neck`, [0, 1.46, 0], [0, 1.56, 0]],
  [`${M}Head`, [0, 1.56, 0], [0, 1.62, 0]],
  [`${M}LeftArm`, [0.34, 1.34, 0], [0.61, 1.34, 0]],
  [`${M}LeftForeArm`, [0.61, 1.34, 0], [0.85, 1.34, 0]],
  [`${M}LeftHand`, [0.85, 1.34, 0], [0.95, 1.34, 0]],
  [`${M}RightArm`, [-0.34, 1.34, 0], [-0.61, 1.34, 0]],
  [`${M}RightForeArm`, [-0.61, 1.34, 0], [-0.85, 1.34, 0]],
  [`${M}RightHand`, [-0.85, 1.34, 0], [-0.95, 1.34, 0]],
  [`${M}LeftUpLeg`, [0.1, 0.94, 0], [0.1, 0.52, 0]],
  [`${M}LeftLeg`, [0.1, 0.52, 0], [0.1, 0.12, 0]],
  [`${M}LeftFoot`, [0.1, 0.12, 0], [0.1, 0.02, 0]],
  [`${M}RightUpLeg`, [-0.1, 0.94, 0], [-0.1, 0.52, 0]],
  [`${M}RightLeg`, [-0.1, 0.52, 0], [-0.1, 0.12, 0]],
  [`${M}RightFoot`, [-0.1, 0.12, 0], [-0.1, 0.02, 0]],
];

const pos = merged.attributes.position;
const n = pos.count;
const si = new Uint16Array(n * 4);
const sw = new Float32Array(n * 4);
const boneIndexByName = {};
Object.keys(bones).forEach((name, i) => (boneIndexByName[name] = i));
const v = new THREE.Vector3();
for (let i = 0; i < n; i++) {
  v.fromBufferAttribute(pos, i);
  let best = 1e9, bestName = Object.keys(bones)[0];
  for (const [name, a, b] of MAPPING) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const ab = B.clone().sub(A), t = THREE.MathUtils.clamp(v.clone().sub(A).dot(ab) / ab.lengthSq(), 0, 1);
    const d = v.distanceTo(A.clone().add(ab.multiplyScalar(t)));
    if (d < best) { best = d; bestName = name; }
  }
  si[i * 4] = boneIndexByName[bestName];
  sw[i * 4] = 1;
}
merged.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
merged.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));

const mat = new THREE.MeshStandardMaterial({ color: 0x7a8a99, roughness: 0.7 });
const mesh = new THREE.SkinnedMesh(merged, mat);
mesh.add(rootBone);
mesh.bind(new THREE.Skeleton(Object.values(bones)));

const scene = new THREE.Scene();
scene.add(mesh);
const clip = new THREE.AnimationClip('Idle', 2, [
  new THREE.QuaternionKeyframeTrack(`${M}Spine1.quaternion`, [0, 1, 2],
    [0, 0, 0, 1, 0.05, 0, 0, 0.998, 0, 0, 0, 1]),
]);
scene.userData = {};

new GLTFExporter().parse(scene, (result) => {
  writeFileSync('/home/z/my-project/scripts/test-model.glb', Buffer.from(result));
  console.log('GLB saved:', result.byteLength, 'bytes');
}, (err) => { console.error(err); process.exit(1); }, { binary: true, animations: [clip] });

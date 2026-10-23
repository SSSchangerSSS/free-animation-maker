// ─────────────────────────────────────────────────────────────
// trackkit — سازنده‌های ترک کلیدفریم (مشترک clips.ts و posekit.ts)
// زوایا بر حسب درجه؛ rest: T-Pose (بازوها افقی)، رو به +Z
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BONE_ORDER } from '../character/skeleton';

const D = Math.PI / 180;
export const HIPS_REST: [number, number, number] = [0, 0.98, 0];

export type E = [number, number, number]; // euler xyz بر حسب درجه

export function qt(bone: string, times: number[], frames: E[]): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const f of frames) {
    e.set(f[0] * D, f[1] * D, f[2] * D, 'XYZ');
    q.setFromEuler(e);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

/** ترک از کواترنیون‌های محاسبه‌شده (خروجی IK) — با تضمین پیوستگی علامت */
export function qtQ(bone: string, times: number[], qs: THREE.Quaternion[]): THREE.QuaternionKeyframeTrack {
  const values: number[] = [];
  for (let i = 0; i < qs.length; i++) {
    let q = qs[i];
    if (i > 0 && q.dot(qs[i - 1]) < 0) q = new THREE.Quaternion(-q.x, -q.y, -q.z, -q.w);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

export function hipsPos(times: number[], dy: number[]): THREE.VectorKeyframeTrack {
  const values: number[] = [];
  for (const d of dy) values.push(HIPS_REST[0], HIPS_REST[1] + d, HIPS_REST[2]);
  return new THREE.VectorKeyframeTrack('hips.position', times, values);
}

/** حرکت کامل لگن (x/y/z) — برای رقص و حمله با جابه‌جایی */
export function hipsPosFull(times: number[], frames: [number, number, number][]): THREE.VectorKeyframeTrack {
  const values: number[] = [];
  for (const d of frames) values.push(HIPS_REST[0] + d[0], HIPS_REST[1] + d[1], HIPS_REST[2] + d[2]);
  return new THREE.VectorKeyframeTrack('hips.position', times, values);
}

/** همه‌ی استخوان‌هایی که در کلیپ track ندارند، ثابت اضافه می‌شوند */
export function fill(tracks: THREE.KeyframeTrack[], T: number) {
  const covered = new Set(tracks.map((t) => t.name.split('.')[0]));
  for (const b of BONE_ORDER) {
    if (!covered.has(b)) tracks.push(qt(b, [0, T], [[0, 0, 0], [0, 0, 0]]));
  }
}

export function makeClip(id: string, T: number, tracks: THREE.KeyframeTrack[]): THREE.AnimationClip {
  fill(tracks, T);
  return new THREE.AnimationClip(id, T, tracks);
}

/** کپی عنصر آخر برای بستن حلقه */
export function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

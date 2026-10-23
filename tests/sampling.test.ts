// A05 — آزمون نمونه‌گیری track: تک‌کی‌فریم و بیرون بازه هرگز NaN نمی‌سازد
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { sampleQuat, sampleVec } from '../src/lib/animation/retarget';

function quatTrack(times: number[], quats: [number, number, number, number][]) {
  const values: number[] = [];
  for (const q of quats) values.push(...q);
  return new THREE.QuaternionKeyframeTrack('x.quaternion', times, values);
}

function vecTrack(times: number[], vecs: [number, number, number][]) {
  const values: number[] = [];
  for (const v of vecs) values.push(...v);
  return new THREE.VectorKeyframeTrack('x.position', times, values);
}

describe('sampleQuat / sampleVec — A05', () => {
  it('ترک تک‌کی‌فریم همیشه همان مقدار را می‌دهد (نه NaN)', () => {
    const q = new THREE.Quaternion();
    sampleQuat(quatTrack([1], [[0, 0, 0, 1]]), 5, q);
    expect(Number.isNaN(q.x)).toBe(false);
    expect(q.w).toBeCloseTo(1);

    const v = new THREE.Vector3();
    sampleVec(vecTrack([1], [[1, 2, 3]]), 5, v);
    expect(v.toArray()).toEqual([1, 2, 3]);
  });

  it('قبل/روی/بعد از بازه به ابتدا/انتها clamp می‌شود', () => {
    const q = new THREE.Quaternion();
    const track = quatTrack([0, 1], [[0, 0, 0, 1], [0, 0, 0.7071068, 0.7071068]]);
    sampleQuat(track, -1, q);
    expect(q.w).toBeCloseTo(1);
    sampleQuat(track, 2, q);
    expect(q.z).toBeCloseTo(0.7071068);
    expect(q.w).toBeCloseTo(0.7071068);

    const v = new THREE.Vector3();
    const vt = vecTrack([0, 1, 2], [[1, 2, 3], [2, 3, 4], [3, 4, 5]]);
    sampleVec(vt, -1, v);
    expect(v.toArray()).toEqual([1, 2, 3]);
    sampleVec(vt, 2, v);
    expect(v.toArray()).toEqual([3, 4, 5]);
    sampleVec(vt, 5, v);
    expect(v.toArray()).toEqual([3, 4, 5]);
  });

  it('میان‌یابی داخل بازه finite می‌ماند', () => {
    const v = new THREE.Vector3();
    const vt = vecTrack([0, 1], [[0, 0, 0], [10, 0, 0]]);
    sampleVec(vt, 0.5, v);
    expect(v.x).toBeCloseTo(5);
  });
});

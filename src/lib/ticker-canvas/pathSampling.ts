import type { PathSample, Seg } from "./types";
import { positionOnLoop } from "./roundedRectLoop";

function lerpAngle(a: number, b: number, t: number): number {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * t;
}

/**
 * Таблица точек вдоль контура: полифиламент вместо вызова геометрии на каждый глиф в каждом кадре.
 * Угол в сэмпле — через короткую секущую (eps), чтобы на прямых и дугах было стабильно.
 */
export function buildPathSamples(
    pathLen: number,
    segments: Seg[],
    segCum: number[],
    sampleStepPx: number,
): PathSample[] {
    const samples: PathSample[] = [];
    if (pathLen <= 0) return samples;

    const n = Math.max(32, Math.ceil(pathLen / sampleStepPx));
    const eps = 1;

    for (let i = 0; i <= n; i++) {
        const dist = Math.min((i / n) * pathLen, pathLen - 1e-6);
        const p = positionOnLoop(dist, segments, segCum, pathLen);
        const pA = positionOnLoop(dist - eps, segments, segCum, pathLen);
        const pB = positionOnLoop(dist + eps, segments, segCum, pathLen);
        if (!p || !pA || !pB) continue;
        const ang = Math.atan2(pB.y - pA.y, pB.x - pA.x);
        samples.push({ x: p.x, y: p.y, angle: ang });
    }
    return samples;
}

/** Интерполяция по равномерной разметке сэмплов вдоль длины контура. */
export function interpolateOnPathSamples(
    dist: number,
    pathLen: number,
    samples: PathSample[],
): PathSample | null {
    const pl = pathLen;
    if (pl <= 0 || samples.length < 2) return null;
    const d = ((dist % pl) + pl) % pl;
    const last = samples.length - 1;
    const u = (d / pl) * last;
    const i0 = Math.floor(u);
    const i1 = Math.min(i0 + 1, last);
    const t = u - i0;
    const s0 = samples[i0];
    const s1 = samples[i1];
    return {
        x: s0.x + (s1.x - s0.x) * t,
        y: s0.y + (s1.y - s0.y) * t,
        angle: lerpAngle(s0.angle, s1.angle, t),
    };
}

import type { Seg } from "./types";

const hypot = Math.hypot;

export function quadPoint(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    t: number,
): { x: number; y: number } {
    const u = 1 - t;
    return {
        x: u * u * x0 + 2 * u * t * cx + t * t * x1,
        y: u * u * y0 + 2 * u * t * cy + t * t * y1,
    };
}

export function quadTan(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    t: number,
): { x: number; y: number } {
    return {
        x: 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx),
        y: 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy),
    };
}

/** Длина квадратичной Безье, приближение полилинией по равномерному t. */
export function quadLen(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    steps = 48,
): number {
    let len = 0;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = quadPoint(x0, y0, cx, cy, x1, y1, t);
        len += hypot(p.x - px, p.y - py);
        px = p.x;
        py = p.y;
    }
    return len;
}

/** Длина участка кривой от t=0 до t=tEnd. */
export function quadLenToT(
    x0: number,
    y0: number,
    cx: number,
    cy: number,
    x1: number,
    y1: number,
    tEnd: number,
): number {
    if (tEnd <= 0) return 0;
    const steps = Math.max(12, Math.ceil(48 * tEnd));
    let len = 0;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= steps; i++) {
        const t = (i / steps) * tEnd;
        const p = quadPoint(x0, y0, cx, cy, x1, y1, t);
        len += hypot(p.x - px, p.y - py);
        px = p.x;
        py = p.y;
    }
    return len;
}

/** Параметр t ∈ [0,1] по заданной длине дуги вдоль одного Q-сегмента. */
export function quadTForArcLen(s: Seg & { k: "Q" }, target: number): number {
    if (target <= 0) return 0;
    if (target >= s.len) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) * 0.5;
        const L = quadLenToT(s.x0, s.y0, s.cx, s.cy, s.x1, s.y1, mid);
        if (L < target) lo = mid;
        else hi = mid;
    }
    return (lo + hi) * 0.5;
}

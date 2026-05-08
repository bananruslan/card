import { quadLen, quadPoint, quadTan, quadTForArcLen } from "./bezier";
import type { PathSample, Seg } from "./types";

const hypot = Math.hypot;

/**
 * Замкнутый контур: скруглённый прямоугольник в модели как прежний SVG path —
 * от точки (x+R, y) по часовой стрелке: верх, правый верхний угол (Q), …, замыкание.
 */
export function buildRoundedRectLoop(
    ix: number,
    iy: number,
    iw: number,
    ih: number,
    r: number,
): Seg[] {
    const x = ix;
    const y = iy;
    const W = iw;
    const H = ih;
    const R = r;

    const out: Seg[] = [];

    const L = (
        x0: number,
        y0: number,
        x1: number,
        y1: number,
    ): Seg & { k: "L" } => {
        const len = hypot(x1 - x0, y1 - y0);
        return { k: "L", x0, y0, x1, y1, len };
    };

    const Q = (
        x0: number,
        y0: number,
        cx: number,
        cy: number,
        x1: number,
        y1: number,
    ): Seg & { k: "Q" } => {
        const len = quadLen(x0, y0, cx, cy, x1, y1);
        return { k: "Q", x0, y0, cx, cy, x1, y1, len };
    };

    out.push(L(x + R, y, x + W - R, y));
    out.push(Q(x + W - R, y, x + W, y, x + W, y + R));
    out.push(L(x + W, y + R, x + W, y + H - R));
    out.push(Q(x + W, y + H - R, x + W, y + H, x + W - R, y + H));
    out.push(L(x + W - R, y + H, x + R, y + H));
    out.push(Q(x + R, y + H, x, y + H, x, y + H - R));
    out.push(L(x, y + H - R, x, y + R));
    out.push(Q(x, y + R, x, y, x + R, y));

    return out;
}

export function cumSegStarts(segs: Seg[]): { cum: number[]; total: number } {
    const cum: number[] = [];
    let t = 0;
    for (let i = 0; i < segs.length; i++) {
        cum.push(t);
        t += segs[i].len;
    }
    return { cum, total: t };
}

/** Точка и направление касательной на расстоянии `dist` по длине контура от старта первого сегмента. */
export function positionOnLoop(
    dist: number,
    segments: Seg[],
    segCum: number[],
    pathLen: number,
): PathSample | null {
    const pl = pathLen;
    if (pl <= 0 || segments.length === 0) return null;
    const d = ((dist % pl) + pl) % pl;

    let si = 0;
    for (let i = segments.length - 1; i >= 0; i--) {
        if (d >= segCum[i]) {
            si = i;
            break;
        }
    }

    const seg = segments[si];
    const local = d - segCum[si];

    if (seg.k === "L") {
        const t = seg.len > 0 ? local / seg.len : 0;
        const x = seg.x0 + (seg.x1 - seg.x0) * t;
        const y = seg.y0 + (seg.y1 - seg.y0) * t;
        const ang = Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0);
        return { x, y, angle: ang };
    }

    const tt = quadTForArcLen(seg, local);
    const p = quadPoint(seg.x0, seg.y0, seg.cx, seg.cy, seg.x1, seg.y1, tt);
    const tan = quadTan(seg.x0, seg.y0, seg.cx, seg.cy, seg.x1, seg.y1, tt);
    const ang = Math.atan2(tan.y, tan.x);
    return { x: p.x, y: p.y, angle: ang };
}

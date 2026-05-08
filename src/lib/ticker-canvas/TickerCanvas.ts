/**
 * Canvas-тикер по периметру скруглённого прямоугольника: одна строка, один проход отрисовки,
 * геометрия контура предвычисляется в таблицу сэмплов, чтобы не считать Безье на каждый глиф в кадре.
 */

import type { PathSample, Seg, TickerCanvasOptions, WidthCache } from "./types";
import { DEFAULT_TICKER_CANVAS_OPTIONS } from "./types";
import { measureGlyphCenters } from "./measureGlyphs";
import {
    buildPathSamples,
    interpolateOnPathSamples,
} from "./pathSampling";
import { buildRoundedRectLoop, cumSegStarts } from "./roundedRectLoop";

export type BorderTickerController = {
    /** Запуск после загрузки шрифтов: построение пути, resize, rAF. */
    start(): void;
    /** Снять resize и анимацию. */
    destroy(): void;
};

export function createBorderTicker(
    canvas: HTMLCanvasElement,
    partial?: Partial<TickerCanvasOptions>,
): BorderTickerController {
    const opts: TickerCanvasOptions = {
        ...DEFAULT_TICKER_CANVAS_OPTIONS,
        ...partial,
    };

    let segments: Seg[] = [];
    let segCum: number[] = [];
    let pathLen = 0;
    let pathSamples: PathSample[] = [];

    let viewW = 0;
    let viewH = 0;
    let dpr = 1;
    let ctx: CanvasRenderingContext2D | null = null;

    let textContent = "";
    let cache: WidthCache | null = null;

    let phase = 0;
    let raf = 0;
    let lastTs = 0;

    let resizeHandler: (() => void) | null = null;
    let running = false;

    function buildTickerText(): void {
        textContent = `${Array(opts.wordCycles).fill(opts.words).flat().join(" - ")} -`;
    }

    function syncPath(): void {
        const iw = Math.max(0, window.innerWidth - opts.padding * 2);
        const ih = Math.max(0, window.innerHeight - opts.padding * 2);
        segments = buildRoundedRectLoop(
            opts.padding,
            opts.padding,
            iw,
            ih,
            opts.radius,
        );
        const { cum, total } = cumSegStarts(segments);
        segCum = cum;
        pathLen = total;
        pathSamples = buildPathSamples(
            pathLen,
            segments,
            segCum,
            opts.pathSampleStepPx,
        );
    }

    function bindCanvas(): void {
        dpr = Math.min(window.devicePixelRatio ?? 1, opts.maxDpr);
        viewW = window.innerWidth;
        viewH = window.innerHeight;
        canvas.style.width = `${viewW}px`;
        canvas.style.height = `${viewH}px`;
        canvas.width = Math.round(viewW * dpr);
        canvas.height = Math.round(viewH * dpr);
        ctx = canvas.getContext("2d", { alpha: true });
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function rebuildMeasure(): void {
        if (!ctx) return;
        ctx.font = opts.font;
        cache = measureGlyphCenters(ctx, textContent);
    }

    function drawTextAlongPath(
        c: CanvasRenderingContext2D,
        wc: WidthCache,
        phasePx: number,
    ): void {
        if (pathLen <= 0 || wc.total <= 0 || pathSamples.length < 2) return;

        c.fillStyle = opts.fillStyle;
        c.font = opts.font;
        c.textBaseline = "middle";
        c.textAlign = "center";

        const pl = pathLen;

        for (let i = 0; i < wc.chars.length; i++) {
            const ch = wc.chars[i];
            const mid = wc.mids[i];
            let dist = (mid / wc.total) * pl + phasePx;
            dist = ((dist % pl) + pl) % pl;

            const p = interpolateOnPathSamples(dist, pathLen, pathSamples);
            if (!p) continue;

            const co = Math.cos(p.angle);
            const si = Math.sin(p.angle);
            c.setTransform(
                co * dpr,
                si * dpr,
                -si * dpr,
                co * dpr,
                p.x * dpr,
                p.y * dpr,
            );
            c.fillText(ch, 0, 0);
        }

        c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function paint(ts: number): void {
        if (!ctx || !cache) return;

        ctx.clearRect(0, 0, viewW, viewH);

        const dt = lastTs ? (ts - lastTs) / 1000 : 0;
        lastTs = ts;
        const speed =
            pathLen > 0
                ? (pathLen * opts.scrollPathFraction) / opts.scrollDurationS
                : 0;
        if (pathLen > 0) {
            phase = (phase + speed * dt) % pathLen;
            if (phase < 0) phase += pathLen;
        }

        drawTextAlongPath(ctx, cache, phase);
    }

    function loop(ts: number): void {
        paint(ts);
        raf = requestAnimationFrame(loop);
    }

    function build(): void {
        syncPath();
        buildTickerText();
        bindCanvas();
        rebuildMeasure();
    }

    function start(): void {
        if (running) return;
        running = true;
        document.fonts.ready.then(() => {
            if (!running) return;
            build();
            resizeHandler = () => build();
            window.addEventListener("resize", resizeHandler, { passive: true });
            lastTs = 0;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(loop);
        });
    }

    function destroy(): void {
        running = false;
        cancelAnimationFrame(raf);
        raf = 0;
        if (resizeHandler) {
            window.removeEventListener("resize", resizeHandler);
            resizeHandler = null;
        }
    }

    start();

    return { start, destroy };
}

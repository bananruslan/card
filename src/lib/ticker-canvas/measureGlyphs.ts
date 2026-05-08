import type { WidthCache } from "./types";

/**
 * Центры глифов по нарастающим префиксам строки — учитывается кернинг.
 * Сумма ширин отдельных символов даёт другой результат и даёт наслоение на контуре.
 */
export function measureGlyphCenters(
    ctx: CanvasRenderingContext2D,
    text: string,
): WidthCache {
    const chars = Array.from(text);
    const mids: number[] = [];
    let prefix = "";
    for (let i = 0; i < chars.length; i++) {
        const before = prefix.length ? ctx.measureText(prefix).width : 0;
        prefix += chars[i];
        const after = ctx.measureText(prefix).width;
        mids.push((before + after) / 2);
    }
    const total = prefix.length ? ctx.measureText(prefix).width : 0;
    return { chars, mids, total };
}

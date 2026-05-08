/** Сегмент замкнутого контура: отрезок или квадратичная Безье (углы скругления). */
export type Seg =
    | {
          k: "L";
          x0: number;
          y0: number;
          x1: number;
          y1: number;
          len: number;
      }
    | {
          k: "Q";
          x0: number;
          y0: number;
          cx: number;
          cy: number;
          x1: number;
          y1: number;
          len: number;
      };

/** Точка на контуре и угол касательной (радианы), используемые при отрисовке текста. */
export type PathSample = { x: number; y: number; angle: number };

/** Кэш измерений строки: центры глифов вдоль линейной ширины (с кернингом). */
export type WidthCache = { chars: string[]; mids: number[]; total: number };

export type TickerCanvasOptions = {
    words: string[];
    padding: number;
    radius: number;
    /** Длительность прохода «105% длины контура» в секундах */
    scrollDurationS: number;
    /** Доля длины контура за один такой проход (как бывший startOffset −105%…0%) */
    scrollPathFraction: number;
    font: string;
    fillStyle: string;
    /** Шаг полифиламента контура при построении таблицы сэмплов */
    pathSampleStepPx: number;
    maxDpr: number;
    /** Сколько раз повторить блок слов в строке тикера */
    wordCycles: number;
};

export const DEFAULT_TICKER_CANVAS_OPTIONS: TickerCanvasOptions = {
    words: ["FRONTEND", "RUSLAN", "BAD TICKER", "MUKHUTDINOV"],
    padding: 20,
    radius: 36,
    scrollDurationS: 40,
    scrollPathFraction: 1.05,
    font: '500 28px "Doto Variable", sans-serif',
    fillStyle: "#fff",
    pathSampleStepPx: 3,
    maxDpr: 2,
    wordCycles: 5,
};

/**
 * Бегущая строка по периметру экрана с использованием Three.js
 *
 * Как это работает:
 * 1. Мы создаём обычный 2D canvas и рисуем на нём текст
 * 2. Three.js берёт этот canvas как текстуру и показывает на экране
 * 3. Это даёт нам аппаратное ускорение (WebGL) для плавной анимации
 */
import * as THREE from "three";

// Цвета для текста и фона
export type TickerColors = {
    text: string;      // Цвет обычного текста
    accent: string;    // Цвет акцентных символов (например, ✦)
    bg: string;        // Цвет фона бордюра
};

// Настройки бегущей строки
export type TickerConfig = {
    text: string;          // Текст, который будет бежать
    borderWidth: number;   // Толщина бордюра в пикселях
    fontSize: number;      // Размер шрифта
    speed: number;         // Скорость движения (пиксели в секунду)
    colors: TickerColors;  // Цветовая схема
    fontFamily: string;    // Шрифт текста
};

// Методы управления бегущей строкой
export type TickerController = {
    start: () => void;                            // Запустить анимацию
    stop: () => void;                             // Остановить анимацию
    resize: () => void;                           // Обновить размеры при изменении окна
    destroy: () => void;                          // Полностью удалить и очистить память
    setConfig: (next: Partial<TickerConfig>) => void;  // Изменить настройки
};

// Настройки по умолчанию
const DEFAULT_CONFIG: TickerConfig = {
    text: "ruslan frontend typescript react astro vue rust linux ruslan frontend typescript react astro vue rust linux ",
    borderWidth: 46,
    fontSize: 17,
    speed: 30,
    colors: {
        text: "#ffffff",
        accent: "#ff5e1a",
        bg: "#FF0000",
    },
    fontFamily: '"Doto", monospace',
};

// Точка на траектории движения текста
type PointOnPath = {
    x: number;      // Координата X
    y: number;      // Координата Y
    angle: number;  // Угол поворота текста (в радианах)
};

/**
 * Создаёт бегущую строку по периметру экрана
 *
 * @param canvas - HTML canvas элемент, на котором будет рендериться строка
 * @param config - Настройки (можно передать частично, остальное возьмётся по умолчанию)
 * @returns Контроллер с методами управления анимацией
 */
export function createTicker(
    canvas: HTMLCanvasElement,
    config: Partial<TickerConfig> = {},
): TickerController {
    // === ИНИЦИАЛИЗАЦИЯ THREE.JS ===

    // WebGLRenderer - это "движок", который рисует на canvas через WebGL (GPU)
    // alpha: true - включаем прозрачность фона
    // antialias: true - делает края более гладкими
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true  // ВАЖНО: позволяет видеть содержимое страницы через canvas
    });
    renderer.setPixelRatio(window.devicePixelRatio); // Для чётких изображений на Retina-дисплеях
    renderer.setClearColor(0x000000, 0); // Устанавливаем прозрачный фон (альфа = 0)

    // Scene - это "контейнер" для всех 3D объектов
    const scene = new THREE.Scene();

    // OrthographicCamera - камера без перспективы (как вид сверху)
    // Параметры: left, right, top, bottom, near, far
    // -1 до 1 означает, что мы видим квадрат от -1 до 1 по обеим осям
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // === СОСТОЯНИЕ ПРИЛОЖЕНИЯ ===
    // Здесь храним все данные, которые меняются во время работы
    const state = {
        config: { ...DEFAULT_CONFIG, ...config },  // Объединяем дефолтные настройки с переданными
        viewportWidth: 0,                          // Ширина окна браузера
        viewportHeight: 0,                         // Высота окна браузера
        pathLength: 0,                             // Длина траектории (периметр экрана)
        offsetPx: 0,                               // Текущее смещение текста (для анимации)
        prevTimeMs: 0,                             // Время предыдущего кадра (для плавной анимации)
        textureCanvas: null as HTMLCanvasElement | null,      // 2D canvas для рисования текста
        context2d: null as CanvasRenderingContext2D | null,   // Контекст для рисования на 2D canvas
        canvasTexture: null as THREE.CanvasTexture | null,    // Three.js текстура из canvas
        mesh: null as THREE.Mesh | null,                      // 3D объект (плоскость с текстурой)
        rafId: null as number | null,                         // ID анимации (для остановки)
        isRunning: false,                                     // Флаг: запущена ли анимация
        handleResize: () => resize(),                         // Обработчик изменения размера окна
    };

    /**
     * Инициализация: настраиваем размеры и создаём 3D объекты
     */
    function init() {
        // Получаем текущие размеры окна браузера
        state.viewportWidth = window.innerWidth;
        state.viewportHeight = window.innerHeight;

        // Вычисляем длину траектории
        // Периметр = 4 прямых участка + 4 скруглённых угла (четверти окружности)
        const borderWidth = state.config.borderWidth;
        const radius = borderWidth / 2;  // Радиус скругления = половина ширины бордюра

        // Длина прямых участков (без углов)
        const straightLength = 2 * (state.viewportWidth + state.viewportHeight) - 4 * borderWidth;

        // Длина всех 4 углов (4 четверти окружности = полная окружность)
        const cornersLength = 2 * Math.PI * radius;

        state.pathLength = straightLength + cornersLength;

        // Устанавливаем размер WebGL рендерера
        renderer.setSize(state.viewportWidth, state.viewportHeight);

        // Создаём 2D canvas и Three.js объекты только один раз (при первом запуске)
        if (!state.textureCanvas) {
            // Создаём невидимый 2D canvas для рисования текста
            state.textureCanvas = document.createElement("canvas");
            state.context2d = state.textureCanvas.getContext("2d") as CanvasRenderingContext2D;

            // Создаём Three.js текстуру из нашего 2D canvas
            // Эта текстура будет автоматически обновляться, когда мы рисуем на canvas
            state.canvasTexture = new THREE.CanvasTexture(state.textureCanvas);
            state.canvasTexture.minFilter = THREE.LinearFilter; // Сглаживание при уменьшении

            // Создаём плоскость (прямоугольник) размером 2×2
            // В координатах Three.js это займёт весь экран (от -1 до 1)
            const geometry = new THREE.PlaneGeometry(2, 2);

            // Создаём материал с нашей текстурой
            // MeshBasicMaterial - самый простой материал, не реагирует на свет
            // transparent: true - включаем поддержку прозрачности
            const material = new THREE.MeshBasicMaterial({
                map: state.canvasTexture,
                transparent: true,  // ВАЖНО: позволяет видеть страницу сквозь прозрачные области
            });

            // Создаём 3D объект (mesh) из геометрии и материала
            state.mesh = new THREE.Mesh(geometry, material);

            // Добавляем объект в сцену, чтобы он отображался
            scene.add(state.mesh);
        }

        // Обновляем размер 2D canvas под размер окна
        // ВАЖНО: Учитываем devicePixelRatio для чёткого изображения на Retina-дисплеях
        if (state.textureCanvas && state.context2d) {
            const dpr = window.devicePixelRatio || 1;

            // Увеличиваем физический размер canvas в dpr раз
            state.textureCanvas.width = state.viewportWidth * dpr;
            state.textureCanvas.height = state.viewportHeight * dpr;

            // Масштабируем контекст, чтобы рисовать в логических пикселях
            state.context2d.scale(dpr, dpr);
        }
    }

    /**
     * Рисует один кадр анимации
     * Вызывается каждый кадр (обычно 60 раз в секунду)
     */
    function drawFrame() {
        const ctx = state.context2d;
        if (!ctx || !state.canvasTexture) return;

        // Очищаем весь canvas перед новым кадром
        ctx.clearRect(0, 0, state.viewportWidth, state.viewportHeight);

        // Рисуем фон бордюра (4 прямоугольника по краям экрана)
        drawBorderBackground(ctx);

        // Рисуем текст, который движется по периметру
        drawTickerText(ctx, state.offsetPx);

        // Говорим Three.js, что текстура изменилась и нужно обновить её на GPU
        state.canvasTexture.needsUpdate = true;

        // Рендерим сцену: Three.js берёт нашу текстуру и показывает на экране
        renderer.render(scene, camera);
    }

    /**
     * Рисует фон бордюра со скруглёнными углами
     * Использует Path2D API для создания сложной фигуры с дугами
     */
    function drawBorderBackground(ctx: CanvasRenderingContext2D) {
        const borderWidth = state.config.borderWidth;
        const radius = borderWidth / 2;  // Радиус скругления

        ctx.fillStyle = state.config.colors.bg;

        // Создаём путь для внешнего контура экрана
        const outerPath = new Path2D();
        outerPath.rect(0, 0, state.viewportWidth, state.viewportHeight);

        // Создаём путь для внутреннего контура (со скруглёнными углами)
        const innerPath = new Path2D();

        // Начинаем с верхней левой точки (после скругления)
        innerPath.moveTo(borderWidth, borderWidth + radius);

        // Левый верхний угол (дуга)
        innerPath.arcTo(
            borderWidth, borderWidth,                    // Угловая точка
            borderWidth + radius, borderWidth,           // Конечная точка
            radius                                       // Радиус
        );

        // Верхняя сторона
        innerPath.lineTo(state.viewportWidth - borderWidth - radius, borderWidth);

        // Правый верхний угол (дуга)
        innerPath.arcTo(
            state.viewportWidth - borderWidth, borderWidth,
            state.viewportWidth - borderWidth, borderWidth + radius,
            radius
        );

        // Правая сторона
        innerPath.lineTo(state.viewportWidth - borderWidth, state.viewportHeight - borderWidth - radius);

        // Правый нижний угол (дуга)
        innerPath.arcTo(
            state.viewportWidth - borderWidth, state.viewportHeight - borderWidth,
            state.viewportWidth - borderWidth - radius, state.viewportHeight - borderWidth,
            radius
        );

        // Нижняя сторона
        innerPath.lineTo(borderWidth + radius, state.viewportHeight - borderWidth);

        // Левый нижний угол (дуга)
        innerPath.arcTo(
            borderWidth, state.viewportHeight - borderWidth,
            borderWidth, state.viewportHeight - borderWidth - radius,
            radius
        );

        // Замыкаем путь
        innerPath.closePath();

        // Рисуем бордюр: заливаем внешний контур, вырезаем внутренний
        ctx.fill(outerPath, "nonzero");
        ctx.globalCompositeOperation = "destination-out";  // Режим "вырезания"
        ctx.fill(innerPath, "nonzero");
        ctx.globalCompositeOperation = "source-over";  // Возвращаем обычный режим
    }

    /**
     * Рисует бегущий текст по периметру экрана
     *
     * @param ctx - Контекст 2D canvas для рисования
     * @param offset - Смещение текста (увеличивается каждый кадр для анимации)
     */
    function drawTickerText(ctx: CanvasRenderingContext2D, offset: number) {
        const borderWidth = state.config.borderWidth;

        // Настраиваем шрифт и выравнивание
        ctx.font = `${state.config.fontSize}px ${state.config.fontFamily}`;
        ctx.textBaseline = "middle";  // Текст центрируется по вертикали
        ctx.textAlign = "left";

        // Вычисляем, сколько раз нужно повторить текст, чтобы покрыть весь периметр
        const textWidth = ctx.measureText(state.config.text).width;
        // const repeatCount = Math.ceil((state.pathLength + 1000) / textWidth) + 3;
      const repeatCount = 1;
        const fullText = state.config.text.repeat(repeatCount);

        // Начальная позиция текста (смещаем для эффекта движения)
        let distance = -(offset % state.pathLength) - textWidth * Math.ceil(repeatCount / 2);

        // Рисуем каждый символ отдельно
        for (let i = 0; i < fullText.length; i++) {
            const char = fullText[i];
            const charWidth = ctx.measureText(char).width;

            // Находим центр символа на траектории
            const charCenter = distance + charWidth / 2;

            // Нормализуем позицию, чтобы она была в пределах [0, pathLength]
            const normalizedDistance =
                ((charCenter % state.pathLength) + state.pathLength) % state.pathLength;

            // Получаем координаты и угол поворота для этой позиции (с учётом скруглённых углов)
            const { x, y, angle } = getPointOnPath(normalizedDistance, borderWidth / 2);

            // Сохраняем текущее состояние canvas (чтобы трансформации не накапливались)
            ctx.save();

            // Перемещаем и поворачиваем canvas для рисования символа
            ctx.translate(x, y);
            ctx.rotate(angle);

            // Заливаем текст цветом из конфига
            ctx.fillStyle = state.config.colors.text;

            // Небольшая прозрачность для мягкости
            ctx.globalAlpha = 0.92;

            // Рисуем символ (центрируем по X)
            ctx.fillText(char, -charWidth / 2, 0);

            // Восстанавливаем состояние canvas
            ctx.restore();

            // Двигаемся к следующему символу
            distance += charWidth;

            // Прерываем, если прошли достаточно далеко (оптимизация)
            if (distance > state.pathLength * 1.5) break;
        }
    }

    /**
     * Вычисляет координаты и угол поворота для точки на траектории
     *
     * Траектория состоит из 4 прямых участков и 4 скруглённых углов:
     * 1. Верхняя сторона (слева направо)
     * 2. Правый верхний угол (дуга 90°)
     * 3. Правая сторона (сверху вниз)
     * 4. Правый нижний угол (дуга 90°)
     * 5. Нижняя сторона (справа налево)
     * 6. Левый нижний угол (дуга 90°)
     * 7. Левая сторона (снизу вверх)
     * 8. Левый верхний угол (дуга 90°)
     *
     * @param distance - Расстояние от начала траектории (в пикселях)
     * @param radius - Радиус скругления углов
     * @returns Координаты (x, y) и угол поворота
     */
    function getPointOnPath(distance: number, radius: number): PointOnPath {
        const borderWidth = state.config.borderWidth;

        // Длина четверти окружности (один скруглённый угол)
        const cornerArcLength = (Math.PI / 2) * radius;

        // Длины прямых участков (без углов)
        const topLength = state.viewportWidth - borderWidth;
        const rightLength = state.viewportHeight - borderWidth;
        const bottomLength = state.viewportWidth - borderWidth;
        const leftLength = state.viewportHeight - borderWidth;

        let d = distance;

        // 1. Верхняя сторона (горизонтально, слева направо)
        if (d < topLength) {
            return {
                x: radius + d,
                y: radius,
                angle: 0
            };
        }
        d -= topLength;

        // 2. Правый верхний угол (дуга от 0° до 90°)
        if (d < cornerArcLength) {
            const angleOnArc = (d / cornerArcLength) * (Math.PI / 2);  // От 0 до π/2
            return {
                x: state.viewportWidth - radius + Math.cos(angleOnArc) * radius,
                y: radius + Math.sin(angleOnArc) * radius,
                angle: angleOnArc  // Плавно меняется от 0° до 90°
            };
        }
        d -= cornerArcLength;

        // 3. Правая сторона (вертикально, сверху вниз)
        if (d < rightLength) {
            return {
                x: state.viewportWidth - radius,
                y: radius + d,
                angle: Math.PI / 2
            };
        }
        d -= rightLength;

        // 4. Правый нижний угол (дуга от 90° до 180°)
        if (d < cornerArcLength) {
            const angleOnArc = (d / cornerArcLength) * (Math.PI / 2);  // От 0 до π/2
            return {
                x: state.viewportWidth - radius - Math.sin(angleOnArc) * radius,
                y: state.viewportHeight - radius + Math.cos(angleOnArc) * radius,
                angle: Math.PI / 2 + angleOnArc  // Плавно меняется от 90° до 180°
            };
        }
        d -= cornerArcLength;

        // 5. Нижняя сторона (горизонтально, справа налево)
        if (d < bottomLength) {
            return {
                x: state.viewportWidth - radius - d,
                y: state.viewportHeight - radius,
                angle: Math.PI
            };
        }
        d -= bottomLength;

        // 6. Левый нижний угол (дуга от 180° до 270°)
      if (d < cornerArcLength) {
        const angleOnArc = (d / cornerArcLength) * (Math.PI / 2);  // От 0 до π/2

            return {
                x: radius - Math.cos(angleOnArc) * radius,
                y: state.viewportHeight - radius - Math.sin(angleOnArc) * radius,
                angle: Math.PI + angleOnArc  // Плавно меняется от 180° до 270°
            };
        }
        d -= cornerArcLength;

        // 7. Левая сторона (вертикально, снизу вверх)
        if (d < leftLength) {
            return {
                x: radius,
                y: state.viewportHeight - radius - d,
                angle: -Math.PI / 2
            };
        }
        d -= leftLength;

        // 8. Левый верхний угол (дуга от 270° до 360°)
        const angleOnArc = (d / cornerArcLength) * (Math.PI / 2);  // От 0 до π/2
        return {
            x: radius + Math.sin(angleOnArc) * radius,
            y: radius - Math.cos(angleOnArc) * radius,
            angle: -Math.PI / 2 + angleOnArc  // Плавно меняется от 270° до 360° (0°)
        };
    }

    /**
     * Главный цикл анимации (вызывается каждый кадр)
     *
     * @param currentTime - Текущее время в миллисекундах (передаётся браузером)
     */
    function loop(currentTime: number) {
        // Планируем следующий кадр
        state.rafId = requestAnimationFrame(loop);

        // Вычисляем время, прошедшее с предыдущего кадра (в секундах)
        // Ограничиваем максимум 0.05с (50мс), чтобы при лагах текст не "прыгал"
        const deltaTime = Math.min((currentTime - state.prevTimeMs) / 1000, 0.05);
        state.prevTimeMs = currentTime;

        // Обновляем смещение текста (двигаем его вперёд)
        // Используем остаток от деления, чтобы смещение циклически повторялось
        state.offsetPx = (state.offsetPx + state.config.speed * deltaTime) % state.pathLength;

        // Рисуем кадр
        drawFrame();
    }

    /**
     * Запускает анимацию бегущей строки
     */
    function start() {
        if (state.isRunning) return;  // Уже запущена

        state.isRunning = true;
        init();  // Настраиваем размеры и создаём объекты
        state.prevTimeMs = performance.now();  // Запоминаем время старта
        state.rafId = requestAnimationFrame(loop);  // Запускаем цикл анимации
        window.addEventListener("resize", state.handleResize);  // Следим за изменением размера окна
    }

    /**
     * Останавливает анимацию (можно потом запустить снова)
     */
    function stop() {
        if (!state.isRunning) return;  // Уже остановлена

        state.isRunning = false;

        // Отменяем запланированный следующий кадр
        if (state.rafId !== null) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }

        // Отключаем слежение за изменением размера окна
        window.removeEventListener("resize", state.handleResize);
    }

    /**
     * Обновляет размеры при изменении размера окна
     */
    function resize() {
        init();       // Пересчитываем размеры
        drawFrame();  // Перерисовываем кадр
    }

    /**
     * Полностью удаляет бегущую строку и освобождает память
     * Важно вызывать при удалении компонента, чтобы избежать утечек памяти
     */
    function destroy() {
        stop();  // Сначала останавливаем анимацию

        // Удаляем 3D объект и освобождаем GPU-память
        if (state.mesh) {
            scene.remove(state.mesh);                           // Убираем из сцены
            state.mesh.geometry.dispose();                      // Освобождаем геометрию
            (state.mesh.material as THREE.Material).dispose();  // Освобождаем материал
            state.mesh = null;
        }

        // Освобождаем текстуру
        if (state.canvasTexture) {
            state.canvasTexture.dispose();
            state.canvasTexture = null;
        }

        // Освобождаем WebGL рендерер
        renderer.dispose();
    }

    /**
     * Изменяет настройки бегущей строки на лету
     *
     * @param newConfig - Новые настройки (можно передать только те, что нужно изменить)
     */
    function setConfig(newConfig: Partial<TickerConfig>) {
        state.config = { ...state.config, ...newConfig };
        resize();  // Пересчитываем и перерисовываем
    }

    // Возвращаем контроллер с методами управления
    return {
        start,
        stop,
        resize,
        destroy,
        setConfig,
    };
}

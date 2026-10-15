/*
 * Чистые функции преобразования цвета.
 * Внешние диапазоны: RGB 0..255, H 0..360, остальные компоненты 0..100.
 * Округление выполняет интерфейс, а не математические функции.
 */
(function (root) {
  const wrap = h => ((h % 360) + 360) % 360;

  function rgbToCmyk([R, G, B]) {
    const [r, g, b] = [R, G, B].map(x => x / 255);
    const k = 1 - Math.max(r, g, b);
    // Для чёрного исключаем деление на ноль.
    if (k === 1) return [0, 0, 0, 100];
    return [
      (1 - r - k) / (1 - k) * 100,
      (1 - g - k) / (1 - k) * 100,
      (1 - b - k) / (1 - k) * 100,
      k * 100
    ];
  }

  function cmykToRgb(values) {
    const [c, m, y, k] = values.map(x => x / 100);
    return [c, m, y].map(x => 255 * (1 - x) * (1 - k));
  }

  // Общая часть преобразования RGB в цилиндрические модели.
  function polar(rgb) {
    const [r, g, b] = rgb.map(x => x / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0; // Для серых цветов тон условно принимается равным нулю.
    if (d) {
      if (max === r) h = 60 * ((g - b) / d);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    return { h: wrap(h), max, min, d };
  }

  function rgbToHsv(rgb) {
    const { h, max, d } = polar(rgb);
    return [h, max ? d / max * 100 : 0, max * 100];
  }

  function rgbToHls(rgb) {
    const { h, max, min, d } = polar(rgb);
    const l = (max + min) / 2;
    return [h, l * 100, d ? d / (1 - Math.abs(2 * l - 1)) * 100 : 0];
  }

  // Выбор одного из шести секторов цветового круга.
  function sector(h, c, m) {
    const q = wrap(h) / 60;
    const x = c * (1 - Math.abs(q % 2 - 1));
    const a = q < 1 ? [c, x, 0]
      : q < 2 ? [x, c, 0]
      : q < 3 ? [0, c, x]
      : q < 4 ? [0, x, c]
      : q < 5 ? [x, 0, c]
      : [c, 0, x];
    return a.map(v => (v + m) * 255);
  }

  function hsvToRgb([h, s, v]) {
    s /= 100;
    v /= 100;
    return sector(h, v * s, v - v * s);
  }

  function hlsToRgb([h, l, s]) {
    l /= 100;
    s /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    return sector(h, c, l - c / 2);
  }

  // Один файл используется и браузером, и тестами Node.js.
  const api = { rgbToCmyk, cmykToRgb, rgbToHsv, hsvToRgb, rgbToHls, hlsToRgb };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Color = api;
})(globalThis);

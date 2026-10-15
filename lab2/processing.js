/* Учебные алгоритмы: 8-битные RGB, sRGB без линеаризации каналов. */
(function (root) {
  'use strict';
  const byte = x => Math.max(0, Math.min(255, Math.round(x)));
  const value = (data, i) => Math.max(data[i], data[i + 1], data[i + 2]);

  function histograms(data) {
    const result = { r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256), v: new Uint32Array(256) };
    for (let i = 0; i < data.length; i += 4) {
      result.r[data[i]]++; result.g[data[i + 1]]++; result.b[data[i + 2]]++;
      result.v[value(data, i)]++;
    }
    return result;
  }

  function linearLut(hist) {
    let low = 0, high = 255;
    while (low < 255 && hist[low] === 0) low++;
    while (high > 0 && hist[high] === 0) high--;
    return Uint8Array.from({ length: 256 }, (_, x) => high <= low ? x : byte(255 * (x - low) / (high - low)));
  }

  // CDF_min не даёт самому тёмному присутствующему уровню оставаться серым.
  // Однотонное и пустое изображения оставляем без изменений.
  function equalizationLut(hist) {
    const total = hist.reduce((a, b) => a + b, 0);
    const first = hist.findIndex(n => n > 0);
    const cdfMin = first < 0 ? 0 : hist[first];
    let sum = 0;
    return Uint8Array.from({ length: 256 }, (_, x) => {
      sum += hist[x];
      return total === cdfMin ? x : byte(255 * (sum - cdfMin) / (total - cdfMin));
    });
  }

  function process(data, method, options = {}) {
    if (!(data instanceof Uint8ClampedArray) || data.length % 4 !== 0) throw new Error('Ожидается RGBA-массив.');
    const methods = ['original', 'negative', 'brightness', 'gamma', 'linear-rgb', 'linear-v', 'equal-rgb', 'equal-v'];
    if (!methods.includes(method)) throw new Error('Неизвестный метод.');
    const gamma = options.gamma ?? 1;
    const offset = options.offset ?? 0;
    if (!Number.isFinite(gamma) || gamma <= 0 || !Number.isFinite(offset)) throw new Error('Недопустимые параметры.');
    const out = new Uint8ClampedArray(data);
    let luts;
    if (method.startsWith('linear') || method.startsWith('equal')) {
      const hist = histograms(data);
      const make = method.startsWith('linear') ? linearLut : equalizationLut;
      luts = method.endsWith('rgb') ? [make(hist.r), make(hist.g), make(hist.b)] : [make(hist.v)];
    }
    for (let i = 0; i < data.length; i += 4) {
      if (method.endsWith('-v')) {
        const oldV = value(data, i), newV = luts[0][oldV];
        // Масштабирование RGB на V'/V эквивалентно замене V в HSV
        // при сохранении H и S; округление происходит только на выходе.
        for (let c = 0; c < 3; c++) out[i + c] = oldV === 0 ? newV : byte(data[i + c] * newV / oldV);
      } else {
        for (let c = 0; c < 3; c++) {
          const x = data[i + c];
          if (method === 'negative') out[i + c] = 255 - x;
          if (method === 'brightness') out[i + c] = byte(x + offset);
          if (method === 'gamma') out[i + c] = byte(255 * (x / 255) ** gamma);
          if (method.endsWith('-rgb')) out[i + c] = luts[c][x];
        }
      }
    }
    return out;
  }

  function stats(data) {
    const h = histograms(data).v, n = data.length / 4;
    if (!n) return { min: 0, max: 0, mean: 0, sd: 0, entropy: 0 };
    let mean = 0, entropy = 0, variance = 0;
    for (let x = 0; x < 256; x++) {
      mean += x * h[x] / n;
      if (h[x]) entropy -= h[x] / n * Math.log2(h[x] / n);
    }
    for (let x = 0; x < 256; x++) variance += (x - mean) ** 2 * h[x] / n;
    return { min: h.findIndex(x => x > 0), max: h.findLastIndex(x => x > 0), mean, sd: Math.sqrt(variance), entropy };
  }
  const api = { process, histograms, linearLut, equalizationLut, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ImageLab = api;
})(globalThis);

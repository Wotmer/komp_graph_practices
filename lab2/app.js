'use strict';
const $ = id => document.getElementById(id);
let original, result, width, height, name = '', resizeNote = '', loadVersion = 0;
const descriptions = {
  'linear-v': 'Растяжение диапазона V на 0–255. H и S сохраняются до округления; однотонное изображение остаётся прежним.',
  'linear-rgb': 'Независимое растяжение диапазона каждого канала RGB. Может изменить оттенки и баланс белого.',
  'equal-rgb': 'Три независимые функции распределения для R, G и B. Повышает контраст, но может заметно изменить цвета.',
  'equal-v': 'Эквализация только V в HSV. Тон и насыщенность сохраняются до округления; тёмные области могут стать полностью чёрными.',
  negative: 'Негатив: новое значение каждого канала равно 255 − исходное.',
  brightness: 'Сдвиг яркости: к каждому каналу прибавляется заданное число. Выход за 0–255 обрезается.',
  gamma: 'Гамма-преобразование: y = 255 · (x/255)^γ. При γ < 1 изображение светлеет, при γ > 1 темнеет.',
  original: 'Исходное изображение без преобразований.'
};
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function draw(id, data) {
  const c = $(id); c.width = width; c.height = height;
  c.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
}
function statsText(data) {
  const s = ImageLab.stats(data);
  return `HSV V: диапазон ${s.min}–${s.max} · среднее ${s.mean.toFixed(1)} · σ ${s.sd.toFixed(1)} · энтропия ${s.entropy.toFixed(2)} бит`;
}
function plot(id, h, scale) {
  const c = $(id), ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
  const left = 43, top = 12, w = c.width - left - 12, bottom = 125, height = bottom - top;
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#64758b';
  ctx.fillText(String(scale), 1, 12); ctx.fillText('0', 23, bottom);
  ctx.strokeStyle = '#d6dfeb'; ctx.strokeRect(left, top, w, height);
  const channels = $('histMode').value === 'v' ? [['v', '#425879']] : [['r', '#d94949'], ['g', '#229658'], ['b', '#3874d0']];
  for (const [key, color] of channels) {
    ctx.strokeStyle = color; ctx.globalAlpha = .8; ctx.beginPath();
    for (let x = 0; x < 256; x++) {
      const px = left + x / 255 * w;
      ctx.moveTo(px, bottom); ctx.lineTo(px, bottom - h[key][x] / scale * height);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const x of [0, 64, 128, 192, 255]) ctx.fillText(String(x), left + x / 255 * (w - 12), 145);
}
function drawHistograms() {
  if (!original || !result) return;
  const a = ImageLab.histograms(original), b = ImageLab.histograms(result);
  const keys = $('histMode').value === 'v' ? ['v'] : ['r', 'g', 'b'];
  let scale = 1;
  for (const h of [a, b]) for (const key of keys) for (const n of h[key]) scale = Math.max(scale, n);
  plot('histSource', a, scale); plot('histResult', b, scale);
  $('histLegend').textContent = keys.length === 1 ? 'HSV V — тёмная линия' : 'R — красный · G — зелёный · B — синий';
}
function render() {
  const method = $('method').value;
  $('gammaParam').hidden = method !== 'gamma'; $('offsetParam').hidden = method !== 'brightness';
  $('explain').textContent = descriptions[method];
  if (!original) return;
  if ((method === 'gamma' && (!$('gamma').value || !$('gamma').checkValidity())) ||
      (method === 'brightness' && (!$('offset').value || !$('offset').checkValidity()))) {
    $('save').disabled = true; status('Проверьте параметр: γ от 0,1 до 5; сдвиг от −255 до 255.', true); return;
  }
  const start = performance.now();
  result = ImageLab.process(original, method, { gamma: method === 'gamma' ? Number($('gamma').value) : 1, offset: method === 'brightness' ? Number($('offset').value) : 0 });
  const elapsed = performance.now() - start;
  draw('result', result); drawHistograms();
  $('sourceStats').textContent = statsText(original); $('resultStats').textContent = statsText(result);
  $('resultTitle').textContent = 'Результат'; $('save').disabled = false;
  status(`${name} · ${width} × ${height} px${resizeNote} · обработка ${elapsed.toFixed(1)} мс`);
}
async function loadImage(url, title, note = '', selected = -1) {
  const version = ++loadVersion; $('save').disabled = true; status('Загрузка изображения…');
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (version !== loadVersion) return;
    const scale = Math.min(1, Math.sqrt(2000000 / (image.width * image.height)));
    width = Math.max(1, Math.floor(image.width * scale)); height = Math.max(1, Math.floor(image.height * scale));
    const c = $('source'); c.width = width; c.height = height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height); ctx.drawImage(image, 0, 0, width, height);
    original = ctx.getImageData(0, 0, width, height).data;
    name = title; resizeNote = scale < 1 ? ` (уменьшено с ${image.width} × ${image.height})` : '';
    $('sampleNote').textContent = note || 'Загружено пользовательское изображение. Сравните методы на одном исходнике.';
    document.querySelectorAll('.sample').forEach((b, i) => b.setAttribute('aria-pressed', String(i === selected)));
    render();
  } catch (_) {
    if (version !== loadVersion) return;
    $('save').disabled = !result;
    status('Не удалось прочитать изображение. Выберите корректный PNG, JPEG или WebP.', true);
  }
}
$('upload').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 30 * 1024 * 1024) { status('Размер файла должен быть не более 30 МБ.', true); return; }
  const url = URL.createObjectURL(file);
  loadImage(url, file.name).finally(() => URL.revokeObjectURL(url));
});
$('method').addEventListener('change', render);
$('gamma').addEventListener('input', render); $('offset').addEventListener('input', render);
$('histMode').addEventListener('change', drawHistograms);
$('reset').addEventListener('click', () => { $('method').value = 'original'; $('gamma').value = '0.6'; $('offset').value = '30'; render(); });
$('save').addEventListener('click', () => {
  if (!result) return;
  $('result').toBlob(blob => {
    if (!blob) { status('Не удалось сохранить PNG.', true); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `lab2-${$('method').value}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
});
LAB_SAMPLES.forEach((sample, i) => {
  const button = document.createElement('button'); button.className = 'sample'; button.setAttribute('aria-pressed', 'false');
  const img = document.createElement('img'); img.src = sample.data; img.alt = '';
  const title = document.createElement('strong'); title.textContent = sample.title;
  const sub = document.createElement('small'); sub.textContent = sample.subtitle;
  button.append(img, title, sub); button.addEventListener('click', () => loadImage(sample.data, sample.title, sample.note, i));
  $('samples').append(button);
});
loadImage(LAB_SAMPLES[0].data, LAB_SAMPLES[0].title, LAB_SAMPLES[0].note, 0);

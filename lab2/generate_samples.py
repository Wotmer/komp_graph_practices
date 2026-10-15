"""Воспроизводимые синтетические изображения. Требуется Pillow.
Запуск из любой папки: python3 generate_samples.py
"""
from pathlib import Path
from PIL import Image, ImageDraw
import base64
import gzip
import json
import random

ROOT = Path(__file__).resolve().parent
W, H = 640, 400
out = ROOT / 'samples'
out.mkdir(exist_ok=True)

# Градиент, геометрические объекты и мелкая текстура дают разные уровни яркости.
scene = Image.new('L', (W, H))
scene.putdata([round(25 + 135 * x / (W - 1) + 25 * y / (H - 1)) for y in range(H) for x in range(W)])
d = ImageDraw.Draw(scene)
d.rectangle((40, 95, 245, 315), fill=55)
d.rectangle((70, 125, 215, 280), fill=120)
d.ellipse((315, 80, 550, 315), fill=210)
d.ellipse((365, 130, 500, 265), fill=150)
for x in range(30, 610, 12):
    d.line((x, 355, x, 380), fill=240 if (x // 12) % 2 else 15, width=4)
low = scene.point(lambda x: round(90 + x * 65 / 255)).convert('RGB')

# Основная масса уровней сжата в тени, но есть крайние значения 0 и 255.
# Линейное растяжение поэтому ничего не меняет, эквализация перераспределяет тени.
skew = scene.point(lambda x: round(15 + 100 * (x / 255) ** 2.2)).convert('RGB')
skew.putpixel((0, 0), (0, 0, 0)); skew.putpixel((1, 0), (255, 255, 255))

# Разные диапазоны каналов выявляют цветовые искажения независимой эквализации RGB.
color = Image.new('RGB', (W, H))
colors = [(180, 85, 45), (170, 120, 55), (90, 140, 65), (65, 100, 180)]
pixels = []
for y in range(H):
    for x in range(W):
        base = colors[min(3, x // 160)]
        factor = .55 + .45 * y / (H - 1)
        texture = 6 if ((x // 16 + y // 16) % 2) else -6
        pixels.append(tuple(max(0, min(255, round(v * factor + texture))) for v in base))
color.putdata(pixels)
constant = Image.new('RGB', (W, H), (100, 140, 180))
# Дополнительные сцены: полезное усиление деталей и ограничения методов.
fog = Image.new('RGB', (W, H), (175, 175, 175))
f = ImageDraw.Draw(fog)
f.polygon([(0, 240), (130, 100), (280, 255), (440, 130), (640, 245), (640, 400), (0, 400)], fill=(155, 155, 155))
f.polygon([(0, 310), (230, 180), (390, 310), (560, 210), (640, 300), (640, 400), (0, 400)], fill=(140, 140, 140))
f.rectangle((0, 335, 640, 400), fill=(130, 130, 130))
for x in range(40, 610, 75):
    f.rectangle((x + 10, 280, x + 15, 355), fill=(120, 120, 120))
    f.polygon([(x - 10, 310), (x + 12, 260), (x + 35, 310)], fill=(125, 125, 125))
f.ellipse((490, 35, 560, 105), fill=(190, 190, 190))

document = Image.new('RGB', (W, H), (220, 220, 220))
f = ImageDraw.Draw(document)
f.rectangle((45, 35, 590, 365), fill=(235, 235, 235))
f.rectangle((75, 65, 330, 80), fill=(190, 190, 190))
for row in range(8):
    y = 110 + row * 25
    for col in range(9 - row % 3):
        x = 75 + col * 51
        f.rectangle((x, y, x + 37, y + 4), fill=(205, 205, 205))
        f.line((x, y + 4, x, y + 10), fill=(205, 205, 205), width=2)

rng = random.Random(2026)
noise = Image.new('RGB', (W, H))
noisy_values = []
for y in range(H):
    for x in range(W):
        signal = 131 if (x - 320) ** 2 + (y - 200) ** 2 < 85 ** 2 else 128
        v = max(0, min(255, round(signal + rng.gauss(0, 2))))
        noisy_values.append((v, v, v))
noise.putdata(noisy_values)

quantized = Image.new('RGB', (W, H))
quantized.putdata([(v, v, v) for y in range(H) for x in range(W) for v in [110 + 3 * min(5, x * 6 // W)]])
clipped = Image.new('RGB', (W, H), (255, 255, 255))
f = ImageDraw.Draw(clipped)
f.rectangle((0, 270, 640, 400), fill=(205, 205, 205))
f.polygon([(80, 290), (170, 205), (260, 290)], fill=(220, 220, 220))
f.rectangle((105, 290, 235, 385), fill=(235, 235, 235))
f.rectangle((150, 320, 185, 385), fill=(200, 200, 200))
# В белом небе нет скрытых деталей: пересчёт уровней не может их восстановить.
full_range = Image.new('RGB', (W, H))
full_range.putdata([(v, v, v) for i in range(W * H) for v in [i % 256]])

specs = [
 ('low-contrast', low, 'Узкий диапазон', 'Серое изображение с деталями', 'Сравните линейное контрастирование и эквализацию. Оба расширяют диапазон, но по-разному распределяют промежуточные уровни.'),
 ('skewed', skew, 'Тени и крайние уровни', 'Неравномерная гистограмма', 'Диапазон уже 0–255 из-за двух пикселей. Линейное контрастирование не меняет изображение; эквализация усиливает различия в тёмных областях.'),
 ('color', color, 'Цветные поверхности', 'Разные диапазоны R, G, B', 'Сравните эквализацию RGB и HSV V: независимая обработка каналов меняет оттенки, обработка V сохраняет отношения каналов до округления.'),
 ('constant', constant, 'Однотонное поле', 'Граничный случай', 'При единственном уровне линейное контрастирование и эквализация оставляют изображение без изменений, избегая деления на ноль.'),
 ('fog', fog, 'Пейзаж в дымке', 'Хорошо: линейное растяжение', 'Узкий диапазон 120–190. Линейное растяжение делает силуэты различимее. Эквализация больших однотонных областей может давать слишком резкие переходы.'),
 ('document', document, 'Бледный документ', 'Хорошо: контрастирование', 'Слабые штрихи на светлом фоне. Линейное растяжение повышает контраст, а эквализация дополнительно затемняет частые уровни штрихов. Сравните читаемость и естественность фона.'),
 ('noise', noise, 'Слабый сигнал и шум', 'Плохо: усиливается зернистость', 'Разница яркости объекта и фона всего 3 уровня при шуме σ≈2. Растяжение и эквализация усиливают и сигнал, и шум; они не заменяют шумоподавление.'),
 ('quantized', quantized, 'Шесть уровней', 'Плохо: становятся видны полосы', 'Исходник содержит только шесть уровней серого. После растяжения и эквализации уровней не прибавится, а полосы станут заметнее. Утраченные полутона не восстанавливаются.'),
 ('clipped', clipped, 'Пересвеченное небо', 'Плохо: детали не восстановить', 'В белой области все пиксели равны 255. Методы могут усилить контраст здания, но не восстанавливают потерянные детали неба.'),
 ('full-range', full_range, 'Равномерная шкала', 'Нейтрально: улучшения нет', 'Все 256 уровней встречаются одинаково часто. Линейное растяжение и выбранная эквализация оставляют изображение без изменений: коррекция не нужна.')
]
samples = []
for key, im, title, subtitle, note in specs:
    path = out / (key + '.png'); im.save(path)
    samples.append(dict(id=key, title=title, subtitle=subtitle, note=note, data='data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode()))
(ROOT / 'samples.js').write_text('/* Встроенные копии PNG для автономного запуска через file://. */\nconst LAB_SAMPLES = ' + json.dumps(samples, ensure_ascii=False) + ';\n')
(out / 'manifest.json').write_text(json.dumps([{k: v for k, v in sample.items() if k != 'data'} for sample in samples], ensure_ascii=False, indent=2))
# RGBA-данные для воспроизводимых проверок Node.js без PNG-библиотек.
for key, im, *_ in specs:
    (out / (key + '.rgba.gz')).write_bytes(gzip.compress(im.convert('RGBA').tobytes(), mtime=0))
print(f'Создано {len(samples)} изображений 640 × 400 и встроенные копии.')

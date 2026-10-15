"""Воспроизводимые синтетические изображения. Требуется Pillow.
Запуск из любой папки: python3 generate_samples.py
"""
from pathlib import Path
from PIL import Image, ImageDraw
import base64
import gzip
import json

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
specs = [
 ('low-contrast', low, 'Узкий диапазон', 'Серое изображение с деталями', 'Сравните линейное контрастирование и эквализацию. Оба расширяют диапазон, но по-разному распределяют промежуточные уровни.'),
 ('skewed', skew, 'Тени и крайние уровни', 'Неравномерная гистограмма', 'Диапазон уже 0–255 из-за двух пикселей. Линейное контрастирование не меняет изображение; эквализация усиливает различия в тёмных областях.'),
 ('color', color, 'Цветные поверхности', 'Разные диапазоны R, G, B', 'Сравните эквализацию RGB и HSV V: независимая обработка каналов меняет оттенки, обработка V сохраняет отношения каналов до округления.'),
 ('constant', constant, 'Однотонное поле', 'Граничный случай', 'При единственном уровне линейное контрастирование и эквализация оставляют изображение без изменений, избегая деления на ноль.')
]
samples = []
for key, im, title, subtitle, note in specs:
    path = out / (key + '.png'); im.save(path)
    samples.append(dict(id=key, title=title, subtitle=subtitle, note=note, data='data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode()))
(ROOT / 'samples.js').write_text('/* Встроенные копии PNG для автономного запуска через file://. */\nconst LAB_SAMPLES = ' + json.dumps(samples, ensure_ascii=False) + ';\n')
# RGBA-данные для воспроизводимых проверок Node.js без PNG-библиотек.
for key, im, *_ in specs:
    (out / (key + '.rgba.gz')).write_bytes(gzip.compress(im.convert('RGBA').tobytes(), mtime=0))
print('Создано 4 изображения 640 × 400 и встроенные копии.')

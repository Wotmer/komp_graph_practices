"""Build the report from the computed examples and saved test results.

Dependencies for report authoring only: python-docx, Pillow.
The application itself needs no Python packages.
"""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'output'
OUT.mkdir(exist_ok=True)
DATA = json.loads((ROOT / 'results/examples.json').read_text())
TESTS = json.loads((ROOT / 'results/test-results.json').read_text())
UI = json.loads((ROOT / 'results/ui-test-results.json').read_text())

def num(x, digits=6):
    return f'{x:.{digits}f}'.rstrip('0').rstrip('.') if x else '0'

def pt(p):
    return f"({num(p['x'])}; {num(p['y'])})"

def diagram(key):
    case = DATA[key]
    w, h = 1560, 880
    image = Image.new('RGB', (w, h), '#fbfdfc')
    draw = ImageDraw.Draw(image)
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(font_path, 23)
    small = ImageFont.truetype(font_path, 20)
    bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 25)
    scale = 36
    ox, oy = 775, 420
    def xy(p):
        return (round(ox + p['x'] * scale), round(oy - p['y'] * scale))
    def line(points, fill, width=4, close=False, dashed=False):
        if not points:
            return
        pixels = [xy(p) for p in points]
        if close and len(pixels) > 2:
            pixels.append(pixels[0])
        if len(pixels) == 1 or len(pixels) == 2 and pixels[0] == pixels[1]:
            x, y = pixels[0]
            draw.ellipse((x-6, y-6, x+6, y+6), fill=fill)
        for a, b in zip(pixels, pixels[1:]):
            if dashed:
                length = math.dist(a, b)
                for d in range(0, math.ceil(length), 18):
                    t, u = d/max(1, length), min(d+10, length)/max(1, length)
                    p = (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
                    q = (a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u)
                    draw.line((p,q), fill=fill, width=width)
            else:
                draw.line((a,b), fill=fill, width=width)
    for x in range(-18, 19, 2):
        sx = ox+x*scale
        draw.line((sx, 45, sx, 765), fill='#e4ecea', width=2)
        draw.text((sx+4, oy+9), str(x), font=small, fill='#6b7e83')
    for y in range(-8, 11, 2):
        sy = oy-y*scale
        if sy < 45 or sy > 765:
            continue
        draw.line((60, sy, 1500, sy), fill='#e4ecea', width=2)
        if y:
            draw.text((ox+8, sy-28), str(y), font=small, fill='#6b7e83')
    draw.line((60,oy,1500,oy), fill='#91a5a7', width=3)
    draw.line((ox,765,ox,45), fill='#91a5a7', width=3)
    draw.polygon([(1500,oy),(1486,oy-7),(1486,oy+7)], fill='#91a5a7')
    draw.polygon([(ox,45),(ox-7,59),(ox+7,59)], fill='#91a5a7')
    draw.text((1470,oy-36),'X',font=bold,fill='#435a63')
    draw.text((ox+15,47),'Y',font=bold,fill='#435a63')
    inp = case['input']
    poly = inp['clip']
    draw.polygon([xy(p) for p in poly], fill='#edf3fb')
    line(poly, '#487dcc', 5, True)
    for i, p in enumerate(poly if key != 'polygon' else []):
        x,y = xy(p)
        offset = (-55,9) if i in (0,1) else (10,-33)
        draw.text((x+offset[0], y+offset[1]), f'W{i+1}', font=small, fill='#3466a9', stroke_width=2, stroke_fill='#fbfdfc')
    if key == 'polygon':
        line(inp['subject'], '#c16b40', 4, True, True)
        line(case['result'], '#087f73', 7, True)
        for i, p in enumerate(case['result']):
            x,y = xy(p)
            dx,dy = [(-20,-38),(-65,-18),(-55,12),(-15,15),(4,12),(15,0),(12,-28),(0,-37)][i]
            draw.ellipse((x-5,y-5,x+5,y+5),fill='#087f73')
            draw.text((x+dx,y+dy),f'R{i+1}',font=small,fill='#087f73',stroke_width=2,stroke_fill='#fbfdfc')
    else:
        for segment in inp['segments']:
            line(segment, '#c16b40', 4, dashed=True)
        for segment in case['result']:
            line(segment, '#087f73', 7)
        offsets=[(60,-10),(42,-54),(10,-32),(-65,15),(10,0),(25,-35),(-22,-26),(22,22)]
        for i, (a,b) in enumerate(inp['segments']):
            m={'x':(a['x']+b['x'])/2,'y':(a['y']+b['y'])/2}
            x,y=xy(m);dx,dy=offsets[i]
            draw.text((x+dx,y+dy),str(i+1),font=bold,fill='#a35630',stroke_width=2,stroke_fill='#fbfdfc')
    for x, color, title in [(145,'#487dcc','Отсекающее окно'),(620,'#c16b40','Исходная фигура'),(1110,'#087f73','Видимая часть')]:
        draw.line((x,823,x+45,823),fill=color,width=7)
        draw.text((x+57,806),title,font=font,fill='#20363e')
    path=ROOT/'results'/f'{key}.png'
    image.save(path)
    return path

figures={key:diagram(key) for key in ('rectangle','lines','polygon')}
doc=Document()
section=doc.sections[0]
section.page_width=Cm(21);section.page_height=Cm(29.7)
section.top_margin=Cm(1.8);section.bottom_margin=Cm(1.7)
section.left_margin=Cm(2);section.right_margin=Cm(2)
section.footer_distance=Cm(.8)
for style_name in ('Normal','Title','Subtitle','Heading 1','Heading 2','Caption'):
    s=doc.styles[style_name]
    s.font.name='Liberation Serif';s.font.color.rgb=RGBColor(0,0,0)
    s.element.get_or_add_rPr().get_or_add_rFonts().set(qn('w:eastAsia'),'Liberation Serif')
normal=doc.styles['Normal'];normal.font.size=Pt(11.5)
normal.paragraph_format.line_spacing=1.07
normal.paragraph_format.space_after=Pt(6)
for name,size in [('Title',22),('Heading 1',16),('Heading 2',13)]:
    doc.styles[name].font.size=Pt(size)
    doc.styles[name].font.bold=True
    doc.styles[name].paragraph_format.space_before=Pt(10)
    doc.styles[name].paragraph_format.space_after=Pt(7)
doc.styles['Caption'].font.size=Pt(10)
doc.styles['Caption'].font.italic=True
doc.styles['Caption'].paragraph_format.space_after=Pt(8)
doc.core_properties.title='Лабораторная работа 4 Алгоритмы отсечения отрезков и многоугольников'
doc.core_properties.subject='Компьютерная графика'
doc.core_properties.author=''

def p(text,style=None):
    return doc.add_paragraph(text,style)

def h(text):
    doc.add_heading(text,level=1)

def newpage(text):
    heading=doc.add_heading(text,level=1)
    heading.paragraph_format.page_break_before=True

def h2(text):
    doc.add_heading(text,level=2)

def formula(text):
    para=p(text);para.alignment=WD_ALIGN_PARAGRAPH.CENTER
    for r in para.runs:r.font.size=Pt(12)

def table(headers,rows,widths=None,size=10.5):
    t=doc.add_table(rows=1,cols=len(headers))
    t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    if widths:
        for col,width in zip(t.columns,widths):col.width=Cm(width)
    for cell,text in zip(t.rows[0].cells,headers):cell.text=str(text)
    for row in rows:
        for cell,text in zip(t.add_row().cells,row):cell.text=str(text)
    for i,row in enumerate(t.rows):
        trpr=row._tr.get_or_add_trPr()
        no_split=OxmlElement('w:cantSplit');trpr.append(no_split)
        if i==0:
            repeat=OxmlElement('w:tblHeader');trpr.append(repeat)
        for j,cell in enumerate(row.cells):
            if widths:cell.width=Cm(widths[j])
            cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr=cell._tc.get_or_add_tcPr()
            borders=OxmlElement('w:tcBorders')
            for side in ('top','left','bottom','right'):
                border=OxmlElement('w:'+side);border.set(qn('w:val'),'single');border.set(qn('w:sz'),'4');border.set(qn('w:color'),'D9D9D9');borders.append(border)
            tcpr.append(borders)
            shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'E7EDF2' if i==0 else 'FFFFFF');tcpr.append(shade)
            margins=OxmlElement('w:tcMar')
            for side in ('top','left','bottom','right'):
                item=OxmlElement('w:'+side);item.set(qn('w:w'),'80');item.set(qn('w:type'),'dxa');margins.append(item)
            tcpr.append(margins)
            for para in cell.paragraphs:
                para.paragraph_format.space_after=Pt(1);para.paragraph_format.line_spacing=1.03
                if j==0 or len(headers)==3:para.alignment=WD_ALIGN_PARAGRAPH.CENTER
                for run in para.runs:run.font.size=Pt(size);run.bold=i==0
    spacer=p('')
    spacer.paragraph_format.space_before=Pt(0)
    spacer.paragraph_format.space_after=Pt(0)
    spacer.paragraph_format.line_spacing=Pt(6)
    return t

def picture(key,caption):
    para=p('');para.paragraph_format.space_after=Pt(2)
    para.add_run().add_picture(str(figures[key]),width=Cm(17))
    p(caption,'Caption')

footer=section.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)

# Page 1
p('Лабораторная работа 4','Title')
p('Алгоритмы отсечения отрезков и многоугольников','Subtitle')
p('Дисциплина Компьютерная графика')
p('Разработано локальное веб-приложение для исследования отсечения. Оно отображает исходные фигуры, отсекающее окно и видимую часть в общей системе координат, а также позволяет просматривать промежуточные вычисления.')
h('1 Цель работы')
p('Закрепить методы отсечения отрезков и выпуклых многоугольников, реализовать их программно и исследовать поведение на пересечениях, параллельных границам отрезках, касаниях и вырожденных фигурах.')
h('2 Постановка задачи')
p('Программа должна читать координаты из текстового файла, строить координатные оси в соответствующем масштабе, различать цветом окно и исходные фигуры, выполнять отсечение и визуализировать полученную видимую часть.')
p('Окно обозначено синим, исходные фигуры - оранжевым пунктиром, результат - зелёным. Жёлтый цвет выделяет текущий шаг алгоритма. Масштаб одинаков по обеим осям, ось Y направлена вверх.')
h('3 Реализованные варианты')
table(['Ч.','Алгоритм','Номера вариантов'],[
    ['1','Сазерленд–Коэн','1, 4, 7, 10, 13, 16, 19'],
    ['1','Лианг–Барски','2, 5, 8, 11, 14, 17, 20'],
    ['1','Метод средней точки','3, 6, 9, 12, 15, 18, 21'],
    ['2','Кирус–Бек для отрезков','Чётные'],
    ['2','Сазерленд–Ходжман для многоугольника','Нечётные'],
],widths=[1.2,8.0,7.8])
p('При выборе номера варианта приложение оставляет соответствующий алгоритм первой части и доступную задачу второй части. Режим «Все алгоритмы» позволяет сравнить все реализации на одних исходных данных.')
h('4 Средства реализации')
p('HTML, CSS и JavaScript с Canvas 2D. Вычислительный модуль algorithms.js отделён от интерфейса app.js и не зависит от браузера. Приложение запускается открытием index.html; сервер, сборка и внешние библиотеки не нужны.')

# Page 2
newpage('5 Отсечение прямоугольным окном')
h2('5 1 Алгоритм Сазерленда Коэна')
p('Для точки формируется код: 0001 - слева, 0010 - справа, 0100 - снизу, 1000 - сверху. Точки на границе считаются внутренними. Если C₁ OR C₂ = 0, отрезок принимается; если C₁ AND C₂ ≠ 0, он отклоняется. Иначе внешняя конечная точка заменяется пересечением с границей, и проверка повторяется.')
formula('k = (y₂ − y₁) / (x₂ − x₁),   y = y₁ + k(x − x₁)')
p('Это явное уравнение прямой в форме с опорной точкой. Для горизонтальной границы y = yг получаем x = x₁ + (yг − y₁)/k, для вертикальной x = xг - значение y из уравнения. Вертикальный отрезок обрабатывается через постоянную координату x. Параллельные внешние отрезки отклоняются до деления.')
h2('5 2 Алгоритм Лианга Барски')
formula('P(t) = A + tD,   D = B − A,   0 ≤ t ≤ 1')
p('Неравенства прямоугольного окна приводятся к pᵢt ≤ qᵢ. Начальный допустимый интервал равен [0; 1]. При pᵢ < 0 обновляется tвх = max(tвх, qᵢ/pᵢ), при pᵢ > 0 - tвых = min(tвых, qᵢ/pᵢ). При pᵢ = 0 и qᵢ < 0 отрезок отклоняется.')
table(['Граница','pᵢ','qᵢ'],[
    ['Левая','−Dx','Ax − Xmin'],['Правая','Dx','Xmax − Ax'],
    ['Нижняя','−Dy','Ay − Ymin'],['Верхняя','Dy','Ymax − Ay'],
],widths=[5.5,5,6.5])
p('После четырёх проверок результат равен [P(tвх); P(tвых)]. При tвх > tвых пересечение пусто, при равенстве получается точка касания.')
h2('5 3 Метод средней точки')
p('Используются те же коды областей. Полностью внутренние ветви принимаются, ветви с общим внешним битом отклоняются. Неоднозначная ветвь делится в точке M = (A + B)/2, после чего обе половины обрабатываются рекурсивно.')
p('При длине ветви не более ε = 10⁻⁶ её середина проецируется внутрь замкнутого прямоугольника. Принятые интервалы объединяются с сохранением исходного направления отрезка. Глубина дополнительно ограничена 60 уровнями. Результат приближённый: почти касающиеся фигуры могут различаться только в пределах ε.')
h2('5 4 Пример вычисления')
p('Для A = (−9; −2), B = (9; 4), окна [−5; 5] × [−3; 3] имеем k = 1/3. Пересечения с x = −5 и x = 5 равны (−5; −2/3) и (5; 8/3). В параметрической форме tвх = 2/9, tвых = 7/9. Оба точных алгоритма дают одинаковую видимую часть; метод средней точки совпадает с ней с указанной точностью.')

# Page 3
newpage('6 Отсечение выпуклым окном')
h2('6 1 Алгоритм Кируса Бека')
p('Вершины окна предварительно приводятся к обходу против часовой стрелки. Для ребра E = Vᵢ₊₁ − Vᵢ строится единичная внутренняя нормаль n = (−Ey; Ex)/|E|. Внутренняя полуплоскость содержит точки, удовлетворяющие следующему неравенству.')
formula('n · (A + tD − Vᵢ) ≥ 0,   t = −n · (A − Vᵢ) / (n · D)')
p('Если n·D > 0, уточняется нижняя граница t; если n·D < 0 - верхняя. При n·D = 0 отрезок параллелен прямой ребра: он либо не ограничивает интервал, либо полностью отклоняется. После обхода всех рёбер принимается общий интервал параметров.')
h2('6 2 Алгоритм Сазерленда Ходжмана')
p('Исходный выпуклый многоугольник последовательно отсекается каждой внутренней полуплоскостью окна. На каждом этапе просматриваются рёбра S → P текущего результата. При переходе через границу добавляется точка пересечения.')
table(['Положение S','Положение P','Добавляемые вершины'],[
    ['Внутри','Внутри','P'],['Внутри','Снаружи','Пересечение'],
    ['Снаружи','Внутри','Пересечение, затем P'],['Снаружи','Снаружи','Ничего'],
],widths=[4.5,4.5,8])
p('Положение точки определяется знаком cross(E, P − Vᵢ). Для пересечения используется t = dS/(dS − dP), где dS и dP - знаковые расстояния до прямой ребра. Повторяющиеся соседние вершины удаляются. Пустой список означает отсутствие пересечения; касание может дать одну или две вершины.')
h2('6 3 Проверка выпуклости входных данных')
p('Для каждого ориентированного ребра проверяется, что все вершины лежат в его внутренней полуплоскости с допуском 10⁻⁹. Проверка выполняется для всех рёбер, поэтому отклоняются также самопересекающиеся звёздчатые контуры, которые нельзя надёжно выявить только по знаку поворота соседних сторон. Повторы вершин, обратный ход на ребре и нулевая площадь недопустимы.')
h2('6 4 Порядок обработки границ')
p('Нормализация направления обхода изменяет порядок рёбер, но сохраняет геометрическую область окна. Кирус–Бек пересекает интервалы параметра, а Сазерленд–Ходжман - полуплоскости. Поэтому итоговая геометрия не зависит от направления обхода входных вершин; это отдельно проверяется автоматическими тестами.')

# Page 4
newpage('7 Результаты отсечения отрезков')
p('Исходные данные приведены в samples/rectangle.txt. Отсекающее окно Xmin = −5, Ymin = −3, Xmax = 5, Ymax = 3. Вычисления выполняются для восьми отрезков, включая полностью внутренний, полностью внешний, граничный и вырожденный случаи.')
picture('rectangle','Рисунок 1. Исходные отрезки и их видимые части в прямоугольном окне')
rows=[]
for i,(seg,result) in enumerate(zip(DATA['rectangle']['input']['segments'],DATA['rectangle']['result']),1):
    rows.append([i,' → '.join(pt(p) for p in seg),' → '.join(pt(p) for p in result) if result else 'Не виден'])
table(['№','Исходный отрезок','Видимая часть'],rows,widths=[1.3,7.4,8.3],size=10)
p('Видимы 6 отрезков из 8; у 4 изменяются концы. Отрезок № 4 остаётся целиком, № 6 лежит на верхней границе, № 7 представляет собой внутреннюю точку. Отрезок № 3 находится выше окна, № 5 - слева от него; оба полностью отклоняются.')
p('Координаты в таблице округлены до шести знаков после запятой. Результаты в JSON хранятся с точностью чисел JavaScript. Сазерленд–Коэн и Лианг–Барски совпадают в пределах погрешности вычислений с плавающей точкой.')

# Page 5
newpage('8 Отрезки в шестиугольном окне')
p('Окно задано вершинами (−5; −2), (−2; −4), (4; −3), (6; 1), (2; 5), (−4; 4). Входной файл samples/convex-window.txt содержит те же восемь отрезков, что и пример первой части. Применяется алгоритм Кируса–Бека.')
picture('lines','Рисунок 2. Результат отсечения отрезков шестиугольным окном')
rows=[]
for i,(seg,result) in enumerate(zip(DATA['lines']['input']['segments'],DATA['lines']['result']),1):
    rows.append([i,' → '.join(pt(p) for p in seg),' → '.join(pt(p) for p in result) if result else 'Не виден'])
table(['№','Исходный отрезок','Видимая часть'],rows,widths=[1.3,7.4,8.3],size=10)
p('Для горизонтального отрезка № 6 на y = 3 видимая часть равна (−25/6; 3) → (4; 3). Оба направления обхода окна дают одинаковый результат. В отличие от прямоугольного отсечения, допустимые интервалы здесь ограничиваются шестью наклонными рёбрами.')

# Page 6
newpage('9 Результаты отсечения многоугольника')
p('Исходный четырёхугольник: (−7; −1), (0; −6), (8; 1), (0; 7). Используется то же шестиугольное окно, что и в разделе 6. Последовательность вычислений воспроизводится из samples/polygon.txt.')
picture('polygon','Рисунок 3. Пересечение исходного четырёхугольника с выпуклым окном')
table(['Вершина','X','Y'],[[f'R{i}',num(p['x']),num(p['y'])] for i,p in enumerate(DATA['polygon']['result'],1)],widths=[4,6.5,6.5],size=10.5)
p('Получен выпуклый восьмиугольник. Его площадь, вычисленная по формуле ориентированной площади, равна 70,193408 квадратной единицы. Число вершин может увеличиваться: точки пересечения сторон становятся новыми вершинами результата.')
formula('S = ½ |Σ (xᵢyᵢ₊₁ − yᵢxᵢ₊₁)|')
p('Встроенные примеры дополнительно показывают вложение, отсутствие пересечения и касание по ребру. При касании площадь равна нулю, но видимый отрезок сохраняется и отображается.')

# Page 7
newpage('10 Проверка корректности')
p(f'Команда node test.cjs выполняет {TESTS["checks"]:,} проверок для {TESTS["lineCases"]:,} случаев отсечения отрезков и {TESTS["polygonCases"]} вызовов отсечения многоугольников.'.replace(',',' '))
p('Проверки включают аналитически рассчитанные случаи, случайные отрезки, сравнение алгоритмов с независимым методом пересечений рёбер, обратное направление отрезков, оба направления обхода окна, симметрию площади пересечения, повторное отсечение и принадлежность результата всем полуплоскостям окна.')
table(['Группа','Проверяемое свойство'],[
    ['Отрезки','Внутри, снаружи, пересечение, параллельность, совпадение с границей'],
    ['Вырождение','Точка внутри и снаружи, касание вершины и ребра'],
    ['Многоугольники','Вложение, пустое пересечение, обратный обход, площадь'],
    ['Входные файлы','BOM, CRLF, комментарии, неверные числа и количество строк'],
    ['Валидация окна','Невыпуклость, самопересечение, повтор вершин и нулевая площадь'],
],widths=[4.2,12.8])
p(f'Команда node test-ui.cjs выполняет ещё {UI["checks"]} проверок в модели DOM: обработчики событий для всех 21 вариантов, встроенные примеры, шаги, загрузка TXT, ошибки ввода и скачивание TXT, JSON и PNG. Эта проверка не оценивает фактическую отрисовку страницы браузером.')
h('11 Работа с приложением')
p('Открыть index.html в современном браузере. Выбрать вариант и часть работы, загрузить подходящий TXT или выбрать готовый пример. После ручного изменения координат нажать «Выполнить отсечение». Номер отрезка выбирается в блоке разбора; кнопки и ползунок позволяют просмотреть промежуточные действия.')
p('«Вписать всё» показывает окно, фигуры и начало координат. Колесо мыши изменяет масштаб, перетаскивание сдвигает вид. Результат можно сохранить в JSON, а текущее изображение - в PNG. Изменённые, но ещё не применённые данные блокируют экспорт, чтобы не смешивать разные состояния.')
h('12 Ограничения и численная точность')
p('Допускаются до 200 отрезков, от 3 до 64 вершин входного выпуклого многоугольника и координаты по модулю не более 100 000. Окно имеет ненулевую площадь; самопересекающиеся и невыпуклые входные многоугольники отклоняются. Границы включены в область видимости. При валидации и удалении повторных вершин используется допуск 10⁻⁹, для метода средней точки - 10⁻⁶. Вычисления выполняются в формате IEEE 754 double.')
h('13 Выводы')
p('Реализованы пять алгоритмов отсечения и их пошаговая визуализация. Коды областей позволяют быстро принимать и отклонять простые случаи, параметрические методы определяют общий допустимый интервал, а метод средней точки приближает границу рекурсивным делением. Последовательное отсечение полуплоскостями строит пересечение выпуклых многоугольников. Автоматические проверки подтверждают согласованность результатов на исследованных данных и корректную обработку граничных случаев.')

target=OUT/'Отчёт_Лабораторная_4.docx'
# The bundled default styles include a decorative title paragraph border.
for node in list(doc.styles.element.xpath('.//w:pBdr')) + list(doc.element.xpath('.//w:pBdr')):
    node.getparent().remove(node)
doc.save(target)
print(target)

(function(){
  'use strict';
  const G=Clipping,$=id=>document.getElementById(id);
  const names={cohen:'Сазерленд–Коэн',liang:'Лианг–Барски',midpoint:'Метод средней точки',cyrus:'Кирус–Бек',sutherland:'Сазерленд–Ходжман'};
  const notes={cohen:'Региональные коды и явное уравнение прямой. Вертикальные отрезки обрабатываются отдельно.',liang:'Параметрический отрезок и пересечение ограничений на t.',midpoint:'Рекурсивное деление пополам. Абсолютная точность 10⁻⁶.',cyrus:'Пересечение параметрического отрезка с полуплоскостями выпуклого окна.',sutherland:'Последовательное отсечение исходного выпуклого многоугольника рёбрами окна.'};
  const theories={cohen:'Каждой конечной точке присваивается четырёхбитный код: сверху, снизу, справа, слева. Если оба кода нулевые, отрезок принимается; если их побитовое И ненулевое, отрезок отклоняется. В остальных случаях внешняя конечная точка заменяется пересечением с соответствующей границей. Координаты пересечения вычисляются через y = kx + b; при вертикальном отрезке x постоянно.',liang:'Подстановка P(t) = A + t(B − A), 0 ≤ t ≤ 1, в четыре неравенства окна даёт pᵢt ≤ qᵢ. При pᵢ < 0 уточняется нижняя граница t, при pᵢ > 0 — верхняя. При pᵢ = 0 внешняя параллель отклоняется. Если t входа больше t выхода, видимой части нет.',midpoint:'Коды концов позволяют принять или отклонить целую ветвь. Неоднозначный отрезок делится пополам, после чего обе половины проверяются рекурсивно. Граничный интервал длиной не более 10⁻⁶ заменяется его серединой с проекцией в замкнутое окно; итог объединяет принятые ветви. Поэтому касания и почти касающиеся отрезки различаются только с заданной точностью.',cyrus:'Для каждого ребра вычисляется единичная внутренняя нормаль n. Внутренняя полуплоскость задаётся n·(P − V) ≥ 0. После подстановки параметрического отрезка получается ограничение на t. Положительное n·D уточняет вход, отрицательное — выход. Окно автоматически приводится к обходу против часовой стрелки.',sutherland:'На каждом ребре окна просматриваются пары последовательных вершин текущего многоугольника. Внутри → внутри: добавить конечную вершину. Внутри → снаружи: добавить пересечение. Снаружи → внутри: добавить пересечение и конечную вершину. Снаружи → снаружи: ничего не добавлять. Выход текущего этапа становится входом следующего.'};
  const formulas={cohen:'y = kx + b; C₁ OR C₂ = 0; C₁ AND C₂ ≠ 0',liang:'P(t) = A + tD; pᵢt ≤ qᵢ; tвх ≤ tвых',midpoint:'M = (A + B) / 2; ε = 10⁻⁶',cyrus:'nᵢ · (A + tD − Vᵢ) ≥ 0',sutherland:'Внутри: cross(Vᵢ₊₁ − Vᵢ, P − Vᵢ) ≥ 0'};
  const rectData='8\n-9 -2 9 4\n-3 -8 3 8\n-8 6 8 6\n-4 -2 4 2\n-8 -5 -6 5\n-9 3 9 3\n0 0 0 0\n-8 -7 7 8\n-5 -3 5 3';
  const clip='6\n-5 -2\n-2 -4\n4 -3\n6 1\n2 5\n-4 4';
  const examples={
    rect:[['mixed','Пересечения, касание и точка',rectData],['boundary','Границы и вырожденные случаи','8\n-8 0 8 0\n0 -8 0 8\n-5 -3 5 -3\n-8 -6 -5 -3\n-8 3 8 3\n7 0 7 0\n5 3 5 3\n-9 -6 -7 -4\n-5 -3 5 3'],['empty','Пустой набор','0\n-5 -3 5 3']],
    lines:[['hexagon','Отрезки и шестиугольное окно',rectData.split('\n').slice(0,-1).join('\n')+'\n'+clip],['clockwise','Обход окна по часовой стрелке','3\n-8 0 8 0\n-8 5 8 5\n-5 -2 -2 -4\n6\n-4 4\n2 5\n6 1\n4 -3\n-2 -4\n-5 -2']],
    polygon:[['intersection','Пересечение двух многоугольников','4\n-7 -1\n0 -6\n8 1\n0 7\n'+clip],['inside','Исходный многоугольник внутри','3\n-1 -1\n2 -1\n0 2\n'+clip],['outside','Многоугольники не пересекаются','3\n8 7\n11 7\n9 10\n'+clip],['touch','Касание по ребру','4\n5 -2\n8 -2\n8 2\n5 2\n4\n-5 -3\n5 -3\n5 3\n-5 3']]
  };
  let data=null,outputs=[],mode='rect',method='cohen',selected=0,step=0,timer=null;
  let width=800,height=485,scale=35,cx=0,cy=0,drag=null;
  const canvas=$('canvas'),ctx=canvas.getContext('2d');
  for(let i=1;i<=21;i++)$('variant').add(new Option(`Вариант ${i}`,String(i)));
  function allowed(){const v=Number($('variant').value);return !v?['cohen','liang','midpoint']: [['cohen','liang','midpoint'][(v-1)%3]];}
  function refreshMode(reset=true){
    stop();mode=$('mode').value;
    const options=mode==='rect'?allowed():[mode==='lines'?'cyrus':'sutherland'];
    const old=$('algorithm').value;$('algorithm').replaceChildren(...options.map(id=>new Option(names[id],id)));
    if(options.includes(old))$('algorithm').value=old;
    method=$('algorithm').value;
    $('example').replaceChildren(...examples[mode].map(([id,title])=>new Option(title,id)));
    $('format').textContent=mode==='rect'?'n; затем n строк X1 Y1 X2 Y2; последняя строка Xmin Ymin Xmax Ymax.':mode==='lines'?'n; затем n строк X1 Y1 X2 Y2; затем m и m строк X Y вершин выпуклого окна.':'n; затем n строк X Y вершин исходного выпуклого многоугольника; затем m и m строк X Y вершин выпуклого окна.';
    if(reset)loadExample();else updateMethod();
  }
  function updateMethod(){method=$('algorithm').value;$('methodNote').textContent=notes[method];$('figureTitle').textContent=names[method];$('theory').textContent=theories[method];$('formula').textContent=formulas[method];$('partTitle').textContent=mode==='rect'?'ЧАСТЬ 1 · ПРЯМОУГОЛЬНОЕ ОКНО':'ЧАСТЬ 2 · ВЫПУКЛОЕ ОКНО';}
  function loadExample(){const ex=examples[mode].find(x=>x[0]===$('example').value)||examples[mode][0];$('data').value=ex[2];$('file').value='';$('notice').textContent='';apply(true);}
  function apply(fitView=false){
    stop();try{
      const parsed=G.parse($('data').value,mode);updateMethod();
      let next;
      if(mode==='polygon')next=[G.sutherlandHodgman(parsed.subject,parsed.clip)];
      else next=parsed.segments.map(([a,b])=>mode==='lines'?G.cyrusBeck(a,b,parsed.clip):({cohen:G.cohenSutherland,liang:G.liangBarsky,midpoint:G.midpoint}[method])(a,b,parsed.rect));
      data=parsed;outputs=next;selected=0;
      $('error').textContent='';$('notice').textContent='';$('data').dataset.dirty='false';
      $('object').replaceChildren(...(mode==='polygon'?[new Option('Многоугольник','0')]:data.segments.map((_,i)=>new Option(`Отрезок ${i+1}`,String(i)))));
      $('object').disabled=!outputs.length;
      step=currentTrace().length;syncStep();renderTable();stats();if(fitView)fit();else draw();
      setExports(true);return true;
    }catch(e){$('error').textContent=e.message;$('notice').textContent='Исправьте ввод. На рисунке остаётся последний успешно вычисленный результат.';setExports(false);return false;}
  }
  function setExports(on){for(const id of ['saveResult','saveInput','savePng'])$(id).disabled=!on;}
  function currentTrace(){return outputs[selected]?.trace||[];}
  function stop(){if(timer)clearInterval(timer);timer=null;$('play').textContent='Воспроизвести';}
  function syncStep(){
    const trace=currentTrace(),n=trace.length;step=Math.max(0,Math.min(step,n));
    $('step').max=String(n);$('step').value=String(step);$('stepValue').textContent=`${step} / ${n}`;
    $('explanation').textContent=!n?'Набор отрезков пуст. Загрузите данные или выберите другой пример.':step===0?'Начальное состояние. Выберите следующий шаг, чтобы проследить вычисления.':trace[step-1].message;
    $('first').disabled=$('prev').disabled=!step;$('next').disabled=$('last').disabled=step===n;$('play').disabled=!n;$('step').disabled=!n;draw();
  }
  function stats(){
    const polygon=mode==='polygon',visible=outputs.filter(o=>o.result&&o.result.length).length;
    $('inputCount').textContent=polygon?data.subject.length:data.segments.length;$('inputLabel').textContent=polygon?'исходных вершин':'отрезков';
    $('visibleCount').textContent=polygon?(outputs[0]?.result.length||0):visible;$('visibleLabel').textContent=polygon?'вершин результата':'видимых';
    const changed=polygon?Math.abs(G.area(outputs[0].result)):outputs.filter((o,i)=>o.result&&(G.pointText(o.result[0])!==G.pointText(data.segments[i][0])||G.pointText(o.result[1])!==G.pointText(data.segments[i][1]))).length;
    $('cutCount').textContent=G.fmt(changed);$('cutLabel').textContent=polygon?'площадь результата':'отсечённых частично';
  }
  function cell(row,text,cls){const td=document.createElement('td');if(cls){const span=document.createElement('span');span.className=cls;span.textContent=text;td.append(span);}else td.textContent=text;row.append(td);}
  function renderTable(){
    const head=$('results').tHead,body=$('results').tBodies[0];head.replaceChildren();body.replaceChildren();const tr=document.createElement('tr');
    const polygon=mode==='polygon';(polygon?['Вершина','X','Y']:['№','Исходный отрезок','Видимая часть','Статус']).forEach(t=>{const th=document.createElement('th');th.scope='col';th.textContent=t;tr.append(th);});head.append(tr);
    $('resultsTitle').textContent=polygon?'Вершины результата':'Видимые части отрезков';
    if(polygon){outputs[0].result.forEach((p,i)=>{const row=document.createElement('tr');cell(row,String(i+1));cell(row,G.fmt(p.x));cell(row,G.fmt(p.y));body.append(row);});}
    else outputs.forEach((o,i)=>{const row=document.createElement('tr');if(i===selected)row.className='selected';cell(row,String(i+1));cell(row,data.segments[i].map(G.pointText).join(' → '));cell(row,o.result?o.result.map(G.pointText).join(' → '):'—');cell(row,o.result?'Виден':'Вне окна',`status${o.result?'':' reject'}`);body.append(row);});
    if(!body.children.length){const row=document.createElement('tr'),td=document.createElement('td');td.colSpan=polygon?3:4;td.textContent=polygon?'Пересечение пусто.':'Нет отрезков.';row.append(td);body.append(row);}
  }
  const screen=p=>({x:width/2+(p.x-cx)*scale,y:height/2-(p.y-cy)*scale});
  const world=(x,y)=>({x:cx+(x-width/2)/scale,y:cy-(y-height/2)/scale});
  function path(points,color,lineWidth=2,closed=false,dash=[],fill=null){
    if(!points?.length)return;ctx.beginPath();const first=screen(points[0]);ctx.moveTo(first.x,first.y);for(const p of points.slice(1)){const s=screen(p);ctx.lineTo(s.x,s.y);}if(closed&&points.length>2)ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
    if(points.length===1||points.length===2&&Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)<1e-7){ctx.beginPath();ctx.arc(first.x,first.y,4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  }
  function label(p,text,color='#64767c',dx=7,dy=-8){const s=screen(p);if(s.x<5||s.x>width-5||s.y<5||s.y>height-5)return;ctx.font='11px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#fbfdfc';ctx.strokeText(text,s.x+dx,s.y+dy);ctx.fillStyle=color;ctx.fillText(text,s.x+dx,s.y+dy);}
  function niceStep(target){const power=10**Math.floor(Math.log10(target)),x=target/power;return (x<=1?1:x<=2?2:x<=5?5:10)*power;}
  function draw(){
    ctx.setTransform(window.devicePixelRatio||1,0,0,window.devicePixelRatio||1,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#fbfdfc';ctx.fillRect(0,0,width,height);
    const tick=niceStep(72/scale),min=world(0,height),max=world(width,0);
    ctx.font='10px system-ui';ctx.textBaseline='alphabetic';
    for(let x=Math.ceil(min.x/tick)*tick,i=0;x<=max.x&&i++<100;x+=tick){const sx=screen({x,y:0}).x;path([{x,y:min.y},{x,y:max.y}],'#e4ecea',1);ctx.fillStyle='#7c8b8e';ctx.fillText(G.fmt(x),sx+4,Math.min(height-12,Math.max(17,screen({x:0,y:0}).y+15)));}
    for(let y=Math.ceil(min.y/tick)*tick,i=0;y<=max.y&&i++<100;y+=tick){const sy=screen({x:0,y}).y;path([{x:min.x,y},{x:max.x,y}],'#e4ecea',1);if(Math.abs(y)>tick*1e-8){ctx.fillStyle='#7c8b8e';ctx.fillText(G.fmt(y),Math.max(7,Math.min(width-45,screen({x:0,y:0}).x+6)),sy-5);}}
    path([{x:min.x,y:0},{x:max.x,y:0}],'#99aaa9',1.4);path([{x:0,y:min.y},{x:0,y:max.y}],'#99aaa9',1.4);
    ctx.fillStyle='#52666b';ctx.font='bold 12px system-ui';ctx.fillText('X',width-18,Math.max(16,Math.min(height-18,screen({x:0,y:0}).y-9)));ctx.fillText('Y',Math.max(12,Math.min(width-18,screen({x:0,y:0}).x-15)),18);
    $('gridNote').textContent=`Шаг сетки: ${G.fmt(tick)} · Масштаб: ${G.fmt(scale)} px/ед.`;$('zoomValue').textContent=`${G.fmt(scale)} px/ед.`;
    if(!data)return;
    path(data.clip,'#487dcc',2.2,true,[],'#487dcc0c');
    if($('showOriginal').checked){if(mode==='polygon')path(data.subject,'#c16b40',1.8,true,[6,4],'#c16b4008');else data.segments.forEach(s=>path(s,'#c16b40',1.7,false,[6,4]));}
    // Other objects stay at their final result; selected object follows playback.
    outputs.forEach((o,i)=>{if(i!==selected||step===o.trace.length)path(o.result,'#087f73',mode==='polygon'?3:4,mode==='polygon',[],mode==='polygon'?'#087f731f':null);});
    if(step>0&&step<currentTrace().length){const t=currentTrace()[step-1];path(t.edge,'#d7981c',4);path(t.polygon||t.candidate,'#d7981c',3.5,!!t.polygon,[],t.polygon?'#d7981c1c':null);if(t.point)path([t.point],'#d7981c');}
    if($('showLabels').checked){
      data.clip.forEach((p,i)=>label(p,`W${i+1} ${G.pointText(p)}`,'#3e6eaf'));
      if(mode==='polygon')data.subject.forEach((p,i)=>label(p,`P${i+1}`,'#a55a34',7,15));
      else data.segments.forEach((s,i)=>label(G.at(s[0],s[1],.5),String(i+1),'#a55a34',5,14));
    }
  }
  function syncZoom(){$('zoom').value=String(100*(Math.log10(scale)+4)/7);}
  function fit(){if(!data)return;const pts=[...data.clip,...data.subject,...data.segments.flat(),{x:0,y:0}],xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);cx=(xmin+xmax)/2;cy=(ymin+ymax)/2;scale=Math.min((width-110)/Math.max(1,xmax-xmin),(height-85)/Math.max(1,ymax-ymin));scale=Math.max(.0001,Math.min(1000,scale));syncZoom();draw();}
  function resize(){const rect=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;width=rect.width;height=rect.height;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);draw();}
  function download(content,name,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('variant').addEventListener('change',()=>{const v=Number($('variant').value);for(const o of $('mode').options)o.disabled=!!v&&((o.value==='lines'&&v%2===1)||(o.value==='polygon'&&v%2===0));if($('mode').selectedOptions[0].disabled)$('mode').value='rect';refreshMode();});
  $('mode').addEventListener('change',()=>refreshMode());$('example').addEventListener('change',loadExample);
  $('algorithm').addEventListener('change',()=>apply());$('apply').addEventListener('click',()=>apply(true));
  $('data').addEventListener('input',()=>{$('data').dataset.dirty='true';$('notice').textContent='Данные изменены. Нажмите «Выполнить отсечение».';setExports(false);});
  $('file').addEventListener('change',async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('Максимальный размер файла - 1 МБ.');const text=await file.text();$('data').value=text;apply(true);}catch(e){$('error').textContent=e.message;}});
  $('showOriginal').addEventListener('change',draw);$('showLabels').addEventListener('change',draw);$('fit').addEventListener('click',fit);
  $('zoom').addEventListener('input',()=>{scale=10**(Number($('zoom').value)*7/100-4);draw();});
  $('object').addEventListener('change',()=>{stop();selected=Number($('object').value);step=currentTrace().length;syncStep();renderTable();});
  $('first').addEventListener('click',()=>{stop();step=0;syncStep();});$('last').addEventListener('click',()=>{stop();step=currentTrace().length;syncStep();});
  $('prev').addEventListener('click',()=>{stop();step--;syncStep();});$('next').addEventListener('click',()=>{stop();step++;syncStep();});
  $('step').addEventListener('input',()=>{stop();step=Number($('step').value);syncStep();});
  $('play').addEventListener('click',()=>{if(timer){stop();return;}if(step===currentTrace().length)step=0;syncStep();$('play').textContent='Пауза';timer=setInterval(()=>{step++;syncStep();if(step>=currentTrace().length)stop();},450);});
  $('saveInput').addEventListener('click',()=>download($('data').value.trim()+'\n',`clipping-${mode}.txt`,'text/plain;charset=utf-8'));
  $('saveResult').addEventListener('click',()=>download(JSON.stringify({algorithm:method,mode,tolerance:method==='midpoint'?G.MID_EPS:null,input:data,results:outputs.map(o=>o.result)},null,2),'clipping-result.json','application/json'));
  $('savePng').addEventListener('click',()=>{const link=document.createElement('a');link.download='clipping.png';link.href=canvas.toDataURL('image/png');link.click();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,before=world(x,y);scale=Math.max(.0001,Math.min(1000,scale*Math.exp(-e.deltaY*.001)));const after=world(x,y);cx+=before.x-after.x;cy+=before.y-after.y;syncZoom();draw();},{passive:false});
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,cx,cy};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),p=world(e.clientX-r.left,e.clientY-r.top);$('cursor').textContent=`x: ${G.fmt(p.x)} · y: ${G.fmt(p.y)}`;if(drag){cx=drag.cx-(e.clientX-drag.x)/scale;cy=drag.cy+(e.clientY-drag.y)/scale;draw();}});
  canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
  new ResizeObserver(resize).observe(canvas.parentElement);resize();refreshMode();
})();

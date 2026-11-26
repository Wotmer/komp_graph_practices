/* Pure geometry. The same functions run in the browser and in node test.cjs. */
(function (root) {
  'use strict';
  const EPS = 1e-9, MID_EPS = 1e-6, LIMIT = 100000;
  const copy = p => ({x:p.x, y:p.y});
  const sub = (a,b) => ({x:a.x-b.x, y:a.y-b.y});
  const dot = (a,b) => a.x*b.x+a.y*b.y;
  const cross = (a,b) => a.x*b.y-a.y*b.x;
  const at = (a,b,t) => ({x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t});
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const fmt = x => Number(x.toFixed(6)).toString();
  const pointText = p => `(${fmt(p.x)}; ${fmt(p.y)})`;
  function area(poly) { return poly.reduce((s,p,i)=>s+cross(p,poly[(i+1)%poly.length]),0)/2; }
  function validatePolygon(poly, name='Многоугольник') {
    if (!Array.isArray(poly) || poly.length<3 || poly.length>64) throw Error(`${name}: нужно от 3 до 64 вершин.`);
    for (const p of poly) if (!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.max(Math.abs(p.x),Math.abs(p.y))>LIMIT) throw Error(`${name}: неверные координаты.`);
    const ar=area(poly);
    if (Math.abs(ar)<EPS) throw Error(`${name}: площадь равна нулю.`);
    const sign=Math.sign(ar);
    for(let i=0;i<poly.length;i++) {
      for(let j=i+1;j<poly.length;j++) if(dist(poly[i],poly[j])<EPS) throw Error(`${name}: повторяющиеся вершины.`);
      const a=poly[i], edge=sub(poly[(i+1)%poly.length],a), len=Math.hypot(edge.x,edge.y);
      // Every vertex must lie in the same half-plane of EVERY oriented edge.
      // Unlike a turn-only test, this also rejects self-intersecting stars.
      for(const p of poly) if(sign*cross(edge,sub(p,a)) < -EPS*len) throw Error(`${name}: требуется простой выпуклый многоугольник с последовательным обходом вершин.`);
      const next=sub(poly[(i+2)%poly.length],poly[(i+1)%poly.length]);
      if(Math.abs(cross(edge,next))<EPS && dot(edge,next)<0) throw Error(`${name}: обратный ход на ребре.`);
    }
    return poly.map(copy);
  }
  function ccw(poly) { const p=validatePolygon(poly); return area(p)<0?p.reverse():p; }
  function rectangle(r) { return [{x:r.xmin,y:r.ymin},{x:r.xmax,y:r.ymin},{x:r.xmax,y:r.ymax},{x:r.xmin,y:r.ymax}]; }
  // Bit order: top, bottom, right, left. Boundary points belong to the window.
  function code(p,r) { return (p.x<r.xmin?1:0)|(p.x>r.xmax?2:0)|(p.y<r.ymin?4:0)|(p.y>r.ymax?8:0); }
  const binary = c => c.toString(2).padStart(4,'0');
  function cohenSutherland(a,b,r) {
    let p=copy(a),q=copy(b); const trace=[];
    const dx=b.x-a.x, dy=b.y-a.y;
    // Explicit line y=k*x+b0; the vertical case is handled separately.
    const k=dx===0?null:dy/dx;
    // Evaluate the explicit line in anchored form y = y0 + k*(x-x0)
    // to avoid subtracting large, nearly equal terms k*x and b0.
    for(let i=0;i<12;i++) {
      const c1=code(p,r),c2=code(q,r), candidate=[copy(p),copy(q)];
      if(!(c1|c2)) {trace.push({message:`Коды ${binary(c1)} и ${binary(c2)}: принять отрезок.`,candidate,status:'accept'});return {result:candidate,trace};}
      if(c1&c2) {trace.push({message:`Коды ${binary(c1)} и ${binary(c2)}: общее внешнее полупространство, отклонить.`,candidate,status:'reject'});return {result:null,trace};}
      const c=c1||c2; let v,edge;
      if(c&8) {edge='верхняя'; v={x:k===null?a.x:a.x+(r.ymax-a.y)/k,y:r.ymax};}
      else if(c&4) {edge='нижняя'; v={x:k===null?a.x:a.x+(r.ymin-a.y)/k,y:r.ymin};}
      else if(c&2) {edge='правая'; v={x:r.xmax,y:a.y+k*(r.xmax-a.x)};}
      else {edge='левая'; v={x:r.xmin,y:a.y+k*(r.xmin-a.x)};}
      trace.push({message:`Коды ${binary(c1)} / ${binary(c2)}. ${edge} граница: пересечение ${pointText(v)}.`,candidate,point:v,status:'clip'});
      if(c===c1)p=v;else q=v;
    }
    throw Error('Не удалось завершить отсечение из-за численной неустойчивости.');
  }
  function liangBarsky(a,b,r) {
    const dx=b.x-a.x,dy=b.y-a.y;
    const ps=[-dx,dx,-dy,dy],qs=[a.x-r.xmin,r.xmax-a.x,a.y-r.ymin,r.ymax-a.y];
    const names=['левая','правая','нижняя','верхняя']; let lo=0,hi=1; const trace=[];
    for(let i=0;i<4;i++) {
      const p=ps[i],q=qs[i];
      if(p===0) {
        trace.push({message:`${names[i]}: p = 0, q = ${fmt(q)}. ${q<0?'Параллелен вне окна: отклонить.':'Параллелен внутри полуплоскости.'}`,candidate:[at(a,b,lo),at(a,b,hi)],status:q<0?'reject':'keep'});
        if(q<0)return {result:null,trace};
      } else {
        const t=q/p;
        if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
        trace.push({message:`${names[i]}: p = ${fmt(p)}, q = ${fmt(q)}, q/p = ${fmt(t)}; tвх = ${fmt(lo)}, tвых = ${fmt(hi)}.`,candidate:lo<=hi?[at(a,b,lo),at(a,b,hi)]:[],status:lo>hi?'reject':'clip'});
        if(lo>hi)return {result:null,trace};
      }
    }
    const result=[at(a,b,lo),at(a,b,hi)]; trace.push({message:`Принять интервал [${fmt(lo)}; ${fmt(hi)}].`,candidate:result,status:'accept'}); return {result,trace};
  }
  function midpoint(a,b,r,tolerance=MID_EPS) {
    if(!Number.isFinite(tolerance)||tolerance<=0)throw Error('Точность должна быть положительной.');
    let lo=Infinity,hi=-Infinity;const trace=[];
    const clamp=p=>({x:Math.max(r.xmin,Math.min(r.xmax,p.x)),y:Math.max(r.ymin,Math.min(r.ymax,p.y))});
    function visit(p,q,t0,t1,depth) {
      const c1=code(p,r),c2=code(q,r),candidate=[p,q];
      const base=`Глубина ${depth}, коды ${binary(c1)} / ${binary(c2)}. `;
      if(c1&c2) {trace.push({message:base+'Отклонить ветвь.',candidate,status:'reject'});return;}
      if(!(c1|c2)) {lo=Math.min(lo,t0);hi=Math.max(hi,t1);trace.push({message:base+'Принять ветвь.',candidate,status:'accept'});return;}
      const m=at(p,q,.5),tm=(t0+t1)/2;
      if(dist(p,q)<=tolerance || depth>=60) {
        // Unresolved boundary interval is no longer than tolerance.
        // Project its midpoint into the closed rectangle (error <= tolerance).
        lo=Math.min(lo,tm);hi=Math.max(hi,tm);
        trace.push({message:base+`Граничный интервал ≤ ${tolerance}; приближение ${pointText(clamp(m))}.`,candidate,point:clamp(m),status:'boundary'});return;
      }
      trace.push({message:base+`Разделить в точке ${pointText(m)}.`,candidate,point:m,status:'split'});
      visit(p,m,t0,tm,depth+1);visit(m,q,tm,t1,depth+1);
    }
    visit(copy(a),copy(b),0,1,0);
    const result=lo===Infinity?null:[clamp(at(a,b,lo)),clamp(at(a,b,hi))];
    trace.push({message:result?`Итог с абсолютной точностью ${tolerance} по координатам.`:'Видимой части нет.',candidate:result||[],status:result?'accept':'reject'});
    return {result,trace};
  }
  function cyrusBeck(a,b,clip) {
    const poly=ccw(clip),d=sub(b,a);let lo=0,hi=1;const trace=[];
    for(let i=0;i<poly.length;i++) {
      const v=poly[i],edge=sub(poly[(i+1)%poly.length],v),len=Math.hypot(edge.x,edge.y);
      const normal={x:-edge.y/len,y:edge.x/len}; // unit inward normal
      const w=dot(normal,sub(a,v)),den=dot(normal,d);
      if(den===0) {
        trace.push({message:`Ребро ${i+1}: n·D = 0, n·(A − V) = ${fmt(w)}. ${w< -EPS?'Внешняя параллель: отклонить.':'Ограничения на t нет.'}`,candidate:[at(a,b,lo),at(a,b,hi)],edge:[v,poly[(i+1)%poly.length]],status:w< -EPS?'reject':'keep'});
        if(w< -EPS)return {result:null,trace};
      } else {
        const t=-w/den;if(den>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
        trace.push({message:`Ребро ${i+1}: n·D = ${fmt(den)}, t = ${fmt(t)}; интервал [${fmt(lo)}; ${fmt(hi)}].`,candidate:lo<=hi?[at(a,b,lo),at(a,b,hi)]:[],edge:[v,poly[(i+1)%poly.length]],status:lo>hi?'reject':'clip'});
        if(lo>hi)return {result:null,trace};
      }
    }
    const result=[at(a,b,lo),at(a,b,hi)];trace.push({message:'Все полуплоскости пройдены: принять.',candidate:result,status:'accept'});return {result,trace};
  }
  function unique(poly) {
    const out=[];for(const p of poly)if(!out.length||dist(out[out.length-1],p)>EPS)out.push(p);
    if(out.length>1&&dist(out[0],out[out.length-1])<=EPS)out.pop();return out;
  }
  function sutherlandHodgman(subject,clip) {
    let out=validatePolygon(subject,'Исходный многоугольник');const poly=ccw(clip),trace=[];
    for(let i=0;i<poly.length;i++) {
      const v=poly[i],v2=poly[(i+1)%poly.length],e=sub(v2,v),len=Math.hypot(e.x,e.y),input=out;out=[];
      const side=p=>cross(e,sub(p,v))/len;
      if(input.length) {
        let s=input[input.length-1],ds=side(s);
        for(const p of input) {
          const dp=side(p),sin=ds>=0,pin=dp>=0;
          if(sin!==pin)out.push(at(s,p,ds/(ds-dp)));
          if(pin)out.push(copy(p));s=p;ds=dp;
        }
      }
      out=unique(out);
      trace.push({message:`Ребро ${i+1}: оставить внутреннюю полуплоскость; вершин ${input.length} → ${out.length}.`,polygon:out.map(copy),edge:[v,v2],status:out.length?'clip':'reject'});
      if(!out.length)break;
    }
    return {result:out,trace};
  }
  function parse(text,mode='rect') {
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.replace(/#.*/,'').trim()).filter(Boolean);
    let pos=0;
    function row(n) {
      if(pos>=lines.length)throw Error(`Не хватает данных: ожидается строка ${pos+1}.`);
      const tokens=lines[pos++].split(/\s+/);
      const vals=tokens.map(s=>/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)?Number(s):NaN);
      if(vals.length!==n||vals.some(x=>!Number.isFinite(x)||Math.abs(x)>LIMIT))throw Error(`Строка ${pos}: нужно ${n} чисел, |координата| ≤ ${LIMIT}. Разделитель дробной части - точка.`);
      return vals;
    }
    function count(max,min=0) {const [n]=row(1);if(!Number.isInteger(n)||n<min||n>max)throw Error(`Строка ${pos}: количество должно быть целым от ${min} до ${max}.`);return n;}
    const points=n=>Array.from({length:n},()=>{const [x,y]=row(2);return {x,y};});
    let segments=[],subject=[],clip=[],rect=null;
    if(mode==='polygon') {subject=validatePolygon(points(count(64,3)),'Исходный многоугольник');}
    else {const n=count(200);segments=Array.from({length:n},()=>{const [x,y,u,v]=row(4);return [{x,y},{x:u,y:v}];});}
    if(mode==='rect') {const [xmin,ymin,xmax,ymax]=row(4);if(xmin>=xmax||ymin>=ymax)throw Error('Окно: должно быть Xmin < Xmax и Ymin < Ymax.');rect={xmin,ymin,xmax,ymax};clip=rectangle(rect);}
    else clip=validatePolygon(points(count(64,3)),'Отсекающее окно');
    if(pos!==lines.length)throw Error(`Лишние данные начиная со строки ${pos+1}.`);
    return {segments,subject,clip,rect};
  }
  const api={EPS,MID_EPS,LIMIT,at,area,code,rectangle,validatePolygon,cohenSutherland,liangBarsky,midpoint,cyrusBeck,sutherlandHodgman,parse,fmt,pointText};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.Clipping=api;
})(typeof globalThis!=='undefined'?globalThis:this);

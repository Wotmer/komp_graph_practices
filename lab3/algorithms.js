/* Pure raster algorithms shared by the application, tests and benchmarks. */
(function (root) {
  'use strict';
  const names = {step:'Пошаговый', dda:'ЦДА', bresenham:'Брезенхем · отрезок', circle:'Брезенхем · окружность'};
  function integer(v, name, min=-1000, max=1000) {
    if (!Number.isInteger(v) || v < min || v > max) throw new RangeError(`${name}: требуется целое число от ${min} до ${max}`);
  }
  // Small tolerance only compensates accumulation error at half-integer ties.
  function round(v) { return Math.floor(v + 0.5 + 1e-10); }
  function rasterize(mode, p, trace=false) {
    if (!Object.hasOwn(names, mode)) throw new RangeError('Неизвестный алгоритм');
    const points=[], steps=[];
    const emit=(x,y)=>points.push([x===0?0:x,y===0?0:y]);
    if (mode==='circle') {
      integer(p.cx,'cx'); integer(p.cy,'cy'); integer(p.r,'r',0,1000);
      let x=0,y=p.r,d=3-2*p.r; const seen=new Set();
      while(x<=y) {
        const added=[];
        for(const [u,v] of [[x,y],[-x,y],[x,-y],[-x,-y],[y,x],[-y,x],[y,-x],[-y,-x]]) {
          const a=p.cx+u,b=p.cy+v,key=`${a},${b}`;
          if(!seen.has(key)){seen.add(key);emit(a,b);if(trace)added.push([a,b]);}
        }
        if(trace)steps.push({i:steps.length,x,y,d,points:added,decision:d<0?'E: x + 1':'SE: x + 1, y − 1'});
        if(d<0)d+=4*x+6;else {d+=4*(x-y)+10;y--;}
        x++;
      }
    } else {
      for(const k of ['x0','y0','x1','y1'])integer(p[k],k);
      const dx=p.x1-p.x0,dy=p.y1-p.y0,n=Math.max(Math.abs(dx),Math.abs(dy));
      if(n===0){emit(p.x0,p.y0);if(trace)steps.push({i:0,x:p.x0,y:p.y0,points:[[p.x0,p.y0]],decision:'Одна точка'});}
      else if(mode==='step') {
        const alongX=Math.abs(dx)>=Math.abs(dy),sign=Math.sign(alongX?dx:dy);
        for(let i=0;i<=n;i++) {
          const major=(alongX?p.x0:p.y0)+i*sign;
          const minor=alongX?p.y0+(major-p.x0)*dy/dx:p.x0+(major-p.y0)*dx/dy;
          const x=alongX?major:round(minor),y=alongX?round(minor):major;
          emit(x,y);if(trace)steps.push({i,x,y,rawX:alongX?major:minor,rawY:alongX?minor:major,points:[[x,y]],decision:alongX?'Вычислить y по x':'Вычислить x по y'});
        }
      } else if(mode==='dda') {
        const sx=dx/n,sy=dy/n;let x=p.x0,y=p.y0;
        for(let i=0;i<=n;i++) {
          const px=i===n?p.x1:round(x),py=i===n?p.y1:round(y);emit(px,py);
          if(trace)steps.push({i,x:px,y:py,rawX:x,rawY:y,points:[[px,py]],decision:`Δx = ${sx}; Δy = ${sy}`});
          x+=sx;y+=sy;
        }
      } else {
        const alongX=Math.abs(dx)>=Math.abs(dy),a=alongX?Math.abs(dx):Math.abs(dy),b=alongX?Math.abs(dy):Math.abs(dx);
        const sx=Math.sign(dx),sy=Math.sign(dy);let x=p.x0,y=p.y0,d=2*b-a;
        for(let i=0;i<=a;i++) {
          emit(x,y);if(trace)steps.push({i,x,y,d,points:[[x,y]],decision:i===a?'Конец':d>=0?'Диагональный шаг':'Шаг по ведущей оси'});
          if(d>=0){if(alongX)y+=sy;else x+=sx;d-=2*a;}
          if(alongX)x+=sx;else y+=sy;d+=2*b;
        }
      }
    }
    return {points,steps};
  }
  const api={names,round,rasterize};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RasterLab=api;
})(typeof globalThis==='object'?globalThis:this);

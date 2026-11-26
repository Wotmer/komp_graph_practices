'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const G=require('./algorithms.js');
let checks=0,lineCases=0,polygonCases=0;
const P=(x,y)=>({x,y}),r={xmin:-5,ymin:-3,xmax:5,ymax:3},rect=G.rectangle(r);
function ok(v,message){checks++;assert.ok(v,message);}
function near(a,b,tol=2e-8){ok(Math.abs(a-b)<=tol,`${a} != ${b} (tol ${tol})`);}
function same(actual,expected,tol=2e-8){ok(!!actual===!!expected,'visibility');if(actual&&expected){for(let i=0;i<2;i++){near(actual[i].x,expected[i].x,tol);near(actual[i].y,expected[i].y,tol);}}}
// Independent reference: collect endpoint / line-edge intersection candidates,
// keep candidates inside every half-plane, sort by the segment parameter.
function reference(a,b,polygon){
  const poly=G.area(polygon)<0?[...polygon].reverse():polygon,dx=b.x-a.x,dy=b.y-a.y;
  const cross=(x,y,u,v)=>x*v-y*u;
  const inside=p=>poly.every((v,i)=>{const w=poly[(i+1)%poly.length];return cross(w.x-v.x,w.y-v.y,p.x-v.x,p.y-v.y)>=-1e-7;});
  const ts=[];if(inside(a))ts.push(0);if(inside(b))ts.push(1);
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],ex=q.x-p.x,ey=q.y-p.y,den=cross(dx,dy,ex,ey);
    if(!den)continue;
    const t=cross(p.x-a.x,p.y-a.y,ex,ey)/den;
    if(t>=0&&t<=1&&inside(G.at(a,b,t)))ts.push(t);
  }
  return ts.length?[G.at(a,b,Math.min(...ts)),G.at(a,b,Math.max(...ts))]:null;
}
const fixed=[
  [P(-8,0),P(8,0),[P(-5,0),P(5,0)]],
  [P(0,-8),P(0,8),[P(0,-3),P(0,3)]],
  [P(-4,-2),P(4,2),[P(-4,-2),P(4,2)]],
  [P(-8,6),P(8,6),null],
  [P(-8,-6),P(-5,-3),[P(-5,-3),P(-5,-3)]],
  [P(-8,-3),P(8,-3),[P(-5,-3),P(5,-3)]],
  [P(0,0),P(0,0),[P(0,0),P(0,0)]],
  [P(9,9),P(9,9),null],
  [P(-8,0),P(0,8),[P(-5,3),P(-5,3)]],
  [P(5,3),P(5,3),[P(5,3),P(5,3)]],
  [P(-8,3.1),P(8,3.1),null]
];
function line(a,b,expected,mid=true){
  lineCases++;
  for(const fn of [G.cohenSutherland,G.liangBarsky]){
    const out=fn(a,b,r);same(out.result,expected);ok(out.trace.length>0,'trace exists');
    same(fn(b,a,r).result,expected&&[...expected].reverse());
  }
  same(G.cyrusBeck(a,b,rect).result,expected);
  same(G.cyrusBeck(a,b,[...rect].reverse()).result,expected);
  if(mid){const out=G.midpoint(a,b,r);same(out.result,expected,2e-6);if(out.result)for(const p of out.result)ok(G.code(p,r)===0,'midpoint inside');}
}
for(const [a,b,e]of fixed)line(a,b,e);
let seed=0x41ee12;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<2400;i++){
  const a=P(Math.floor(random()*81)-40,Math.floor(random()*81)-40),b=P(Math.floor(random()*81)-40,Math.floor(random()*81)-40);
  line(a,b,reference(a,b,rect),i<600);
}
const hex=[P(-5,-2),P(-2,-4),P(4,-3),P(6,1),P(2,5),P(-4,4)];
for(let i=0;i<800;i++){
  const a=P(random()*50-25,random()*50-25),b=P(random()*50-25,random()*50-25),e=reference(a,b,hex);
  same(G.cyrusBeck(a,b,hex).result,e);same(G.cyrusBeck(a,b,[...hex].reverse()).result,e);lineCases++;
}
function polygon(subject,clip){polygonCases++;const out=G.sutherlandHodgman(subject,clip);ok(Array.isArray(out.result),'polygon result');return out.result;}
const square=[P(-2,-2),P(2,-2),P(2,2),P(-2,2)];
near(Math.abs(G.area(polygon(square,rect))),16);
ok(polygon([P(8,8),P(10,8),P(9,10)],rect).length===0,'disjoint polygons');
near(Math.abs(G.area(polygon([P(-8,-8),P(8,-8),P(8,8),P(-8,8)],rect))),60);
const overlap=polygon([P(0,0),P(8,0),P(8,6),P(0,6)],rect);near(Math.abs(G.area(overlap)),15);
const touch=polygon([P(5,-2),P(8,-2),P(8,2),P(5,2)],rect);ok(touch.length===2,'edge touch is segment');near(G.area(touch),0);
const corner=polygon([P(5,3),P(8,3),P(5,6)],rect);ok(corner.length===1,'corner touch is point');
// Area symmetry, idempotence, direction invariance and containment on rotated polygons.
for(let i=0;i<140;i++){
  function regular(n,cx,cy,radius,angle){return Array.from({length:n},(_,j)=>P(cx+radius*Math.cos(angle+2*Math.PI*j/n),cy+radius*Math.sin(angle+2*Math.PI*j/n)));}
  const a=regular(3+i%7,random()*16-8,random()*16-8,2+random()*8,random()*Math.PI),b=regular(3+i%5,random()*16-8,random()*16-8,2+random()*8,random()*Math.PI);
  const ab=polygon(a,b),ba=polygon(b,a);near(Math.abs(G.area(ab)),Math.abs(G.area(ba)),1e-7);
  near(Math.abs(G.area(polygon([...a].reverse(),[...b].reverse()))),Math.abs(G.area(ab)),1e-7);
  if(ab.length>=3){near(Math.abs(G.area(polygon(ab,b))),Math.abs(G.area(ab)),1e-7);for(const p of ab)for(let j=0;j<b.length;j++){const v=b[j],w=b[(j+1)%b.length];ok((w.x-v.x)*(p.y-v.y)-(w.y-v.y)*(p.x-v.x)>=-1e-7,'result within clip');}}
}
for(const [file,mode]of [['rectangle.txt','rect'],['convex-window.txt','lines'],['polygon.txt','polygon']]){const text=fs.readFileSync(`${__dirname}/samples/${file}`,'utf8');ok(!!G.parse(text,mode),'sample parses');ok(!!G.parse('\uFEFF# input\n'+text.replace(/\n/g,'\r\n'),mode),'BOM, comments, CRLF');}
const invalid=[
  ['-1\n-5 -3 5 3','rect'],['1\n0 0 1\n-5 -3 5 3','rect'],['0\n5 -3 -5 3','rect'],['0\n-5 -3 5 3\n7','rect'],['0\nNaN 0 1 1','rect'],['0\n-1e7 0 1 1','rect'],['0\n0 0 0 1','rect'],['0\n-0x1 0 1 1','rect'],['0\n-1,2 0 1 1','rect'],['0\n3\n0 0\n1 0\n2 0','lines'],['4\n0 0\n2 0\n1 0.5\n0 2\n3\n0 0\n2 0\n0 2','polygon']
];
for(const [text,mode]of invalid){checks++;assert.throws(()=>G.parse(text,mode));}
for(const poly of [[P(0,0),P(2,0),P(1,1),P(2,2),P(0,2)],[P(0,0),P(2,2),P(0,2),P(2,0)],[P(0,0),P(1,0),P(0,0),P(0,2)]]){checks++;assert.throws(()=>G.validatePolygon(poly));}
const star=Array.from({length:5},(_,i)=>{const a=2*Math.PI*((i*2)%5)/5;return P(Math.cos(a),Math.sin(a));});checks++;assert.throws(()=>G.validatePolygon(star));
const report={status:'PASS',checks,lineCases,polygonCases,midpointTolerance:G.MID_EPS};
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--save'))fs.writeFileSync(`${__dirname}/results/test-results.json`,JSON.stringify(report,null,2)+'\n');

/* Event-level smoke checks in a small DOM stub; this is not browser visual QA. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let checks=0;
const ok=(v,message)=>{checks++;assert.ok(v,message);};
class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.events={};this.dataset={};this._value='';this.textContent='';this.disabled=false;this.checked=false;}
  get value(){return this.tagName==='SELECT'?(this.children.find(o=>o.value===this._value)||this.children[0])?.value||'':this._value;}
  set value(v){this._value=String(v);}
  get options(){return this.children;}
  get selectedOptions(){return this.children.filter(o=>o.value===this.value);}
  add(el){this.children.push(el);}
  append(...els){this.children.push(...els);}
  replaceChildren(...els){this.children=els;}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  async fire(name,event={}){for(const fn of this.events[name]||[])await fn(event);}
  click(){if(this.tagName==='A')downloads.push({name:this.download,href:this.href});else return this.fire('click');}
  getBoundingClientRect(){return {left:0,top:0,width:1000,height:485};}
  setPointerCapture(){}
}
const html=fs.readFileSync(`${__dirname}/index.html`,'utf8'),elements={};
for(const match of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const [,tag,attrs,id]=match,el=new Element(tag);elements[id]=el;el.checked=/\bchecked\b/.test(attrs);el._value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';
  if(tag==='select'){
    const rest=html.slice(match.index+match[0].length).split('</select>')[0];
    for(const o of rest.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)){const opt=new Element('option');opt.value=o[1].match(/value="([^"]*)"/)?.[1]||o[2];opt.textContent=o[2];el.add(opt);if(/selected/.test(o[1]))el.value=opt.value;}
  }
}
const downloads=[],blobs=new Map();let nextBlob=0;
elements.results.tHead=new Element('thead');elements.results.tBodies=[new Element('tbody')];
const ctx=new Proxy({}, {get:(obj,key)=>obj[key]||((...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),'finite canvas coordinate');}),set:(obj,key,value)=>{obj[key]=value;return true;}});
elements.canvas.getContext=()=>ctx;elements.canvas.toDataURL=()=> 'data:image/png;base64,test';elements.canvas.parentElement=new Element();
const sandbox={Clipping:require('./algorithms.js'),document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag)},window:{devicePixelRatio:1},Option:function(text,value){const el=new Element('option');el.textContent=text;el.value=value;return el;},ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}},Blob,URL:{createObjectURL:blob=>{const url=`blob:${++nextBlob}`;blobs.set(url,blob);return url;},revokeObjectURL:()=>{}},setTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{}};
vm.runInNewContext(fs.readFileSync(`${__dirname}/app.js`,'utf8'),sandbox,{filename:'app.js'});
const choose=async(id,value)=>{elements[id].value=value;await elements[id].fire('change');};
const click=async id=>{await elements[id].click();};
(async()=>{
  ok(elements.inputCount.textContent==8,'initial segments');ok(elements.visibleCount.textContent==6,'initial visible count');ok(elements.cutCount.textContent==4,'partial count');
  ok(elements.results.tBodies[0].children.length===8,'result table');
  for(let v=1;v<=21;v++){
    await choose('variant',v);ok(elements.algorithm.value===['cohen','liang','midpoint'][(v-1)%3],'variant part 1');
    await choose('mode',v%2?'polygon':'lines');ok(elements.algorithm.value===(v%2?'sutherland':'cyrus'),'variant part 2');ok(!elements.error.textContent,'valid variant example');
    await choose('mode','rect');
  }
  await choose('variant','all');
  for(const mode of ['rect','lines','polygon']){
    await choose('mode',mode);
    for(const ex of [...elements.example.options]){
      await choose('example',ex.value);ok(!elements.error.textContent,`example ${mode}/${ex.value}`);
      await click('first');ok(elements.step.value==='0','first step');await click('last');ok(elements.step.value===String(elements.step.max),'last step');
    }
  }
  await choose('mode','rect');
  await click('first');await click('next');ok(elements.step.value==='1','next');await click('prev');ok(elements.step.value==='0','prev');
  await choose('object','1');ok(elements.step.value===String(elements.step.max),'object change resets to final');
  elements.data.value='1\n0 0\n-5 -3 5 3';await elements.data.fire('input');ok(elements.saveResult.disabled,'dirty data disables export');await click('apply');ok(elements.error.textContent.includes('Строка'),'invalid input message');
  await choose('example','mixed');ok(!elements.error.textContent,'recovery');
  elements.file.files=[{size:30,text:async()=> '1\n-8 0 8 0\n-5 -3 5 3'}];await elements.file.fire('change');ok(elements.inputCount.textContent==1,'file loading');ok(elements.visibleCount.textContent==1,'loaded visible segment');
  await click('saveInput');await click('saveResult');await click('savePng');ok(downloads.length===3,'all downloads');
  const json=JSON.parse(await blobs.get(downloads[1].href).text());ok(json.results[0][0].x===-5&&json.results[0][1].x===5,'JSON coordinates');
  elements.zoom.value='70';await elements.zoom.fire('input');await click('fit');
  elements.showLabels.checked=false;await elements.showLabels.fire('change');elements.showOriginal.checked=false;await elements.showOriginal.fire('change');
  await elements.canvas.fire('wheel',{preventDefault(){},clientX:300,clientY:200,deltaY:-100});
  await elements.canvas.fire('pointerdown',{clientX:300,clientY:200,pointerId:1});await elements.canvas.fire('pointermove',{clientX:350,clientY:250});await elements.canvas.fire('pointerup');
  ok(elements.cursor.textContent.includes('x:'),'cursor coordinates');
  const report={status:'PASS',checks,scope:'DOM stub and event handlers; no browser visual verification'};
  console.log(JSON.stringify(report,null,2));if(process.argv.includes('--save'))fs.writeFileSync(`${__dirname}/results/ui-test-results.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict'),C=require('./color.js');let count=0,maxError=0;
function near(a,b){a.forEach((x,i)=>{assert.ok(Math.abs(x-b[i])<1e-8,`${a} != ${b}`);count++;});}
const cases=[[[0,0,0],[0,0,0,100],[0,0,0],[0,0,0]],[[255,255,255],[0,0,0,0],[0,0,100],[0,100,0]],[[255,0,0],[0,100,100,0],[0,100,100],[0,50,100]],[[0,255,0],[100,0,100,0],[120,100,100],[120,50,100]],[[0,0,255],[100,100,0,0],[240,100,100],[240,50,100]],[[128,128,128],[0,0,0,100*(1-128/255)],[0,0,128/255*100],[0,128/255*100,0]]];
for(const[rgb,cmyk,hsv,hls]of cases){near(C.rgbToCmyk(rgb),cmyk);near(C.rgbToHsv(rgb),hsv);near(C.rgbToHls(rgb),hls);near(C.cmykToRgb(cmyk),rgb);near(C.hsvToRgb(hsv),rgb);near(C.hlsToRgb(hls),rgb);}
near(C.hsvToRgb([360,100,100]),[255,0,0]);near(C.hlsToRgb([360,50,100]),[255,0,0]);near(C.cmykToRgb([30,50,80,100]),[0,0,0]);
let seed=2026;function random(){seed=(1664525*seed+1013904223)>>>0;return seed/2**32;}
for(let i=0;i<10000;i++){const rgb=Array.from({length:3},()=>random()*255);for(const [forward,back]of [[C.rgbToCmyk,C.cmykToRgb],[C.rgbToHsv,C.hsvToRgb],[C.rgbToHls,C.hlsToRgb]]){const result=back(forward(rgb));result.forEach((x,j)=>maxError=Math.max(maxError,Math.abs(x-rgb[j])));near(result,rgb);}}
console.log(JSON.stringify({assertions:count,randomColors:10000,roundTrips:30000,maxAbsoluteError:maxError,status:'PASS'},null,2));

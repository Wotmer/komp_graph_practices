'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const P = require('./processing.js');
const rgba = values => new Uint8ClampedArray(values.flatMap(x => Array.isArray(x) ? [...x, 255] : [x, x, x, 255]));
let checks = 0;
function equal(a, b) { assert.deepEqual(Array.from(a), Array.from(b)); checks++; }
function ok(x) { assert.ok(x); checks++; }
const ramp = rgba([50, 100, 150]);
equal(P.process(ramp, 'linear-v'), rgba([0, 128, 255]));
equal(P.process(ramp, 'linear-rgb'), rgba([0, 128, 255]));
const skewed = rgba([10, 10, 20, 30]);
equal(P.process(skewed, 'equal-v'), rgba([0, 0, 128, 255]));
equal(P.process(skewed, 'equal-rgb'), rgba([0, 0, 128, 255]));
equal(P.process(rgba([0, 128, 255]), 'negative'), rgba([255, 127, 0]));
equal(P.process(rgba([0, 128, 255]), 'brightness', { offset: 30 }), rgba([30, 158, 255]));
equal(P.process(rgba([0, 128, 255]), 'gamma', { gamma: 2 }), rgba([0, 64, 255]));
for (const method of ['linear-rgb', 'linear-v', 'equal-rgb', 'equal-v']) {
  for (const color of [[0, 0, 0], [255, 255, 255], [100, 140, 180]]) {
    const source = rgba([color, color]); equal(P.process(source, method), source);
  }
  equal(P.process(new Uint8ClampedArray(), method), []);
}
const h = P.histograms(rgba([0, 0, 128, 255]));
ok(h.v[0] === 2 && h.v[128] === 1 && h.v[255] === 1);
equal(P.process(ramp, 'original'), ramp);
equal(P.process(ramp, 'gamma', { gamma: 1 }), ramp);
equal(P.process(ramp, 'brightness', { offset: 0 }), ramp);
assert.throws(() => P.process(ramp, 'missing')); checks++;
assert.throws(() => P.process(ramp, 'gamma', { gamma: 0 })); checks++;
assert.throws(() => P.process(ramp, 'brightness', { offset: NaN })); checks++;
// Случайный набор: инварианты диапазона, альфа, отсутствие мутации и сохранение V LUT.
let seed = 2026;
function rnd() { seed = (1664525 * seed + 1013904223) >>> 0; return seed >>> 24; }
const random = new Uint8ClampedArray(4000); for (let i = 0; i < random.length; i++) random[i] = rnd();
const copy = new Uint8ClampedArray(random);
for (const method of ['negative', 'brightness', 'gamma', 'linear-rgb', 'linear-v', 'equal-rgb', 'equal-v']) {
  const result = P.process(random, method, { gamma: .6, offset: -30 });
  equal(random, copy);
  for (let i = 0; i < result.length; i += 4) ok(result[i + 3] === random[i + 3]);
  if (method.endsWith('-v')) {
    const lut = method === 'linear-v' ? P.linearLut(hFor(random)) : P.equalizationLut(hFor(random));
    for (let i = 0; i < result.length; i += 4) {
      const v = Math.max(...random.slice(i, i + 3)), nv = Math.max(...result.slice(i, i + 3));
      ok(nv === lut[v]);
      if (v && nv) for (let c = 0; c < 3; c++) ok(Math.abs(result[i + c] - random[i + c] * nv / v) <= .500001);
    }
  }
}
function hFor(data) { return P.histograms(data).v; }
const rows = [];
for (const key of ['low-contrast', 'skewed', 'color', 'constant']) {
  const input = new Uint8ClampedArray(gunzipSync(fs.readFileSync(path.join(__dirname, 'samples', key + '.rgba.gz'))));
  for (const method of ['original', 'linear-v', 'equal-rgb', 'equal-v']) {
    const output = P.process(input, method);
    rows.push({ image: key, method, ...P.stats(output) });
    if (key === 'skewed' && method === 'linear-v') equal(output, input);
    if (key === 'constant') equal(output, input);
  }
}
console.log(JSON.stringify({ status: 'PASS', checks, metrics: rows }, null, 2));

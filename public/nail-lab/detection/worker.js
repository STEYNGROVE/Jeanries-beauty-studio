import { env, InferenceSession, Tensor } from './ort.wasm.min.mjs';

// Threaded WASM is available only on cross-origin isolated pages.
env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
env.wasm.wasmPaths = new URL('.', import.meta.url).href;
const size = 768;
let session;

async function loadBytes(name) {
  const response = await fetch(new URL(name, import.meta.url));
  if (!response.ok) throw new Error('Could not download the nail detector');
  return new Uint8Array(await response.arrayBuffer());
}

async function initialize() {
  const [model, runtime] = await Promise.all([
    loadBytes('./nail-seg-int8.onnx'),
    loadBytes('./ort-wasm-simd-threaded.wasm'),
  ]);
  env.wasm.wasmBinary = runtime;
  try {
    return await InferenceSession.create(model, {
      executionProviders: ['wasm'], graphOptimizationLevel: 'all',
    });
  } finally { delete env.wasm.wasmBinary; }
}

function prepare(photo) {
  const scale = Math.min(size / photo.width, size / photo.height);
  const x = (size - photo.width * scale) / 2;
  const y = (size - photo.height * scale) / 2;
  const context = new OffscreenCanvas(size, size).getContext('2d', {willReadFrequently: true});
  context.fillStyle = '#727272';
  context.fillRect(0, 0, size, size);
  context.drawImage(photo, x, y, photo.width * scale, photo.height * scale);
  const pixels = context.getImageData(0, 0, size, size).data;
  const plane = size * size;
  const data = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i++) {
    data[i] = pixels[i * 4] / 255;
    data[i + plane] = pixels[i * 4 + 1] / 255;
    data[i + plane * 2] = pixels[i * 4 + 2] / 255;
  }
  return {tensor: new Tensor('float32', data, [1, 3, size, size]), x, y, scale};
}

function overlap(a, b) {
  const w = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
  const h = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  return w * h / ((a.r - a.l) * (a.b - a.t) + (b.r - b.l) * (b.b - b.t) - w * h);
}

function candidates(tensor) {
  const {data, dims} = tensor;
  const count = dims[2], found = [];
  for (let i = 0; i < count; i++) {
    const score = data[i + count * 4];
    if (score < .42) continue;
    const x = data[i], y = data[i + count], w = data[i + count * 2], h = data[i + count * 3];
    if (w >= 12 && h >= 12) found.push({i, score, l: x-w/2, t: y-h/2, r: x+w/2, b: y+h/2});
  }
  found.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const item of found) {
    if (kept.every(previous => overlap(item, previous) < .45)) kept.push(item);
    if (kept.length === 10) break;
  }
  return kept;
}

function primaryComponent(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  let largest = [];
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index] || visited[index]) continue;
    const group = [index];
    visited[index] = 1;
    for (let i = 0; i < group.length; i++) {
      const p = group[i], x = p % width, y = Math.floor(p / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x+dx < 0 || x+dx >= width || y+dy < 0 || y+dy >= height) continue;
        const next = p + dx + dy * width;
        if (!visited[next] && mask[next]) {
          visited[next] = 1;
          group.push(next);
        }
      }
    }
    if (group.length > largest.length) largest = group;
  }
  return largest;
}

function nailMask(box, predictions, prototypes, transform, photo) {
  const [, channels, mh, mw] = prototypes.dims;
  const plane = mh * mw, count = predictions.dims[2];
  const data = prototypes.data, coeff = predictions.data;
  const l = Math.max(0, Math.floor(box.l * mw / size)), r = Math.min(mw, Math.ceil(box.r * mw / size));
  const t = Math.max(0, Math.floor(box.t * mh / size)), b = Math.min(mh, Math.ceil(box.b * mh / size));
  const width = r-l, height = b-t;
  if (width < 3 || height < 3) return null;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = 0;
    const offset = (y+t)*mw + x+l;
    for (let c = 0; c < channels; c++) value += data[c*plane+offset] * coeff[(5+c)*count+box.i];
    if (value > .12) mask[y*width+x] = 1;
  }
  const group = primaryComponent(mask, width, height);
  if (group.length < 8) return null;
  const set = new Set(group);
  const px = index => (index * size / mw - transform.x) / transform.scale;
  const py = index => (index * size / mh - transform.y) / transform.scale;
  const clamp = (n, max) => Math.max(0, Math.min(max, n));
  const rows = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width;) {
      if (!set.has(y*width+x)) { x++; continue; }
      const start = x;
      while (x < width && set.has(y*width+x)) x++;
      const x1 = clamp(px(l+start), photo.width), x2 = clamp(px(l+x), photo.width);
      const y1 = clamp(py(t+y), photo.height), y2 = clamp(py(t+y+1), photo.height);
      if (x2 > x1 && y2 > y1) rows.push([x1, y1, x2-x1, y2-y1]);
    }
  }
  return rows.length >= 3 ? geometry(rows, box.score) : null;
}

function geometry(rows, score) {
  let cx = 0, cy = 0, mass = 0;
  for (const [x,y,w,h] of rows) {
    const a = w*h;
    cx += (x+w/2)*a; cy += (y+h/2)*a; mass += a;
  }
  cx /= mass; cy /= mass;
  let xx = 0, xy = 0, yy = 0;
  for (const [x,y,w,h] of rows) {
    const dx=x+w/2-cx, dy=y+h/2-cy, a=w*h;
    xx += (dx*dx+w*w/12)*a; xy += dx*dy*a; yy += (dy*dy+h*h/12)*a;
  }
  let angle = .5*Math.atan2(2*xy, xx-yy);
  if (angle < 0) angle += Math.PI;
  const v={x:Math.cos(angle),y:Math.sin(angle)}, u={x:v.y,y:-v.x};
  let left=Infinity, top=Infinity, right=-Infinity, bottom=-Infinity;
  for (const [x,y,w,h] of rows) for (const [dx,dy] of [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]) {
    const ax=(dx-cx)*u.x+(dy-cy)*u.y, ay=(dx-cx)*v.x+(dy-cy)*v.y;
    left=Math.min(left,ax);right=Math.max(right,ax);top=Math.min(top,ay);bottom=Math.max(bottom,ay);
  }
  const points=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([a,b])=>({
    x:cx+a*u.x+b*v.x, y:cy+a*u.y+b*v.y,
  }));
  return {points, mask:rows, centre:{x:cx,y:cy}, score};
}

self.addEventListener('message', async ({data: photo}) => {
  try {
    session ??= await initialize();
    const transform = prepare(photo);
    let outputs;
    try {
      outputs = await session.run({[session.inputNames[0]]: transform.tensor});
    } finally { transform.tensor.dispose(); }
    try {
      const predictions = outputs[session.outputNames[0]], prototypes = outputs[session.outputNames[1]];
      const nails = candidates(predictions).map(box=>nailMask(box,predictions,prototypes,transform,photo)).filter(Boolean);
      self.postMessage({result:nails});
    } finally { Object.values(outputs).forEach(tensor => tensor.dispose()); }
  } catch (error) {
    self.postMessage({error: error.message});
  } finally { photo.close(); }
});

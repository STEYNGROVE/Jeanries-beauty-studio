import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', {value:webcrypto});
const source=await readFile(new URL('../public/playground/wheel-math.js',import.meta.url));
const { spinDestination, uniformIndex, wrapAngle }=await import('data:text/javascript;base64,'+source.toString('base64'));

for (let count=1; count<=12; count++) {
  for (let segment=0; segment<count; segment++) {
    for (const angle of [0,53.25,179.9,359.5]) {
      const end=spinDestination(angle,segment,count);
      assert.ok(end-angle>=2160&&end-angle<2520);
      const error=wrapAngle(end+(segment+.5)*360/count+180)-180;
      assert.ok(Math.abs(error)<1e-8);
    }
  }
}
const original=crypto.getRandomValues;
try {
  const samples=[0xffffffff, 5, 2];
  crypto.getRandomValues=array=>{array[0]=samples.shift();return array;};
  assert.equal(uniformIndex(6),5);
  assert.equal(uniformIndex(6),2);
  assert.equal(samples.length,0);
  for (const size of [0,-1,1.5,2**32+1]) assert.throws(()=>uniformIndex(size),RangeError);
} finally { crypto.getRandomValues=original; }
console.log('PASS: all resting angles align, biased upper tail is redrawn, and invalid pools are rejected.');

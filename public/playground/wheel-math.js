const uint32Size = 2 ** 32;
export const wrapAngle = n => ((n % 360) + 360) % 360;

export function uniformIndex(length) {
  if (!Number.isSafeInteger(length) || length < 1 || length > uint32Size) throw new RangeError('Invalid wheel size');
  const limit = uint32Size - uint32Size % length;
  const sample = new Uint32Array(1);
  do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % length;
}

export function spinDestination(start, segment, count) {
  const centre = (segment + .5) * 360 / count;
  return start + 6 * 360 + wrapAngle(-centre - start);
}

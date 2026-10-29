/** Deterministic LCG. State is a uint32 so game states clone cleanly. */
export function rngNext(state: number): [number, number] {
  let a = state >>> 0;
  if (a === 0) a = 0x1a2b3c4d;
  a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
  return [a, a / 4294967296];
}

export function rngInt(state: number, n: number): [number, number] {
  const [s, r] = rngNext(state);
  return [s, Math.floor(r * n)];
}

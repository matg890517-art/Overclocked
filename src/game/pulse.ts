import type { PulseCalc, PulseTile } from "./types";

export interface PulseOpts {
  flux: boolean;
  parity: "odd" | "even";
  parityDisabled: boolean;
  harmonic: boolean;
  corner: boolean;
  echo: boolean;
  arc: boolean;
  gauge: number;
  nextMult: number;
  minPulse: number;
}

/**
 * Pulse damage = (sum of active value nodes) × (product of multiplier nodes).
 * Empty multiplier product is 1. Values already on the network re-fire every pulse.
 */
export function computePulse(tiles: PulseTile[], opts: PulseOpts): PulseCalc {
  const harmonicIdx = new Set<number>();
  if (opts.harmonic) {
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i];
        const b = tiles[j];
        if (a.kind !== "value" || b.kind !== "value" || a.value !== b.value) continue;
        if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1) {
          harmonicIdx.add(i);
          harmonicIdx.add(j);
        }
      }
    }
  }

  let storedSum = 0;
  let activeSum = 0;
  let mult = 1;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t.kind === "mult") {
      mult *= t.value;
      continue;
    }
    let v = t.value;
    if (t.crit) v *= 2;
    if (harmonicIdx.has(i)) v *= 2;
    if (opts.corner && t.corner) v *= 1.5;
    storedSum += v;
    let active = v;
    if (opts.flux && !opts.parityDisabled) {
      const odd = t.value % 2 === 1;
      if (odd !== (opts.parity === "odd")) active = 0;
    }
    activeSum += active;
  }

  let damage = activeSum * mult * (opts.nextMult || 1);
  if (opts.arc && opts.gauge >= 50) damage *= 1.25;
  if (opts.echo) damage *= 1.5;
  damage = Math.floor(damage);
  let nulled = false;
  if (opts.minPulse > 0 && damage > 0 && damage < opts.minPulse) {
    damage = 0;
    nulled = true;
  }
  return { damage, activeSum, storedSum, mult, nulled };
}

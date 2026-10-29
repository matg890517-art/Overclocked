import { describe, expect, it } from "vitest";
import { computePulse } from "../src/game/pulse";
import type { PulseTile } from "../src/game/types";

function tile(partial: Partial<PulseTile> & Pick<PulseTile, "kind" | "value">): PulseTile {
  return {
    crit: false,
    row: 0,
    col: 0,
    corner: false,
    ...partial,
  };
}

const base = {
  flux: false,
  parity: "odd" as const,
  parityDisabled: false,
  harmonic: false,
  corner: false,
  echo: false,
  arc: false,
  gauge: 0,
  nextMult: 1,
  minPulse: 0,
};

describe("pulse engine", () => {
  it("treats an empty multiplier product as 1", () => {
    const r = computePulse([tile({ kind: "value", value: 4 })], base);
    expect(r.damage).toBe(4);
    expect(r.mult).toBe(1);
  });

  it("sums value nodes and multiplies multiplier nodes", () => {
    const tiles = [
      tile({ kind: "value", value: 3, row: 0, col: 0 }),
      tile({ kind: "value", value: 4, row: 0, col: 1 }),
      tile({ kind: "mult", value: 2, row: 0, col: 2 }),
    ];
    expect(computePulse(tiles, base).damage).toBe(14);
  });

  it("multiplies stacked multipliers", () => {
    const tiles = [
      tile({ kind: "value", value: 5 }),
      tile({ kind: "mult", value: 2, col: 1 }),
      tile({ kind: "mult", value: 3, col: 2 }),
    ];
    expect(computePulse(tiles, base).damage).toBe(30);
  });

  it("deals 0 from a multiplier with no values", () => {
    expect(computePulse([tile({ kind: "mult", value: 2 })], base).damage).toBe(0);
  });

  it("re-fires earlier tiles: the sum includes the whole network", () => {
    const first = computePulse([tile({ kind: "value", value: 4 })], base);
    const second = computePulse(
      [tile({ kind: "value", value: 4 }), tile({ kind: "value", value: 4, col: 1 })],
      base,
    );
    expect(first.damage).toBe(4);
    expect(second.damage).toBe(8);
  });

  it("zeroes values on the wrong flux parity and keeps the right ones", () => {
    const tiles = [
      tile({ kind: "value", value: 2 }),
      tile({ kind: "value", value: 3, col: 1 }),
      tile({ kind: "mult", value: 2, col: 2 }),
    ];
    const odd = computePulse(tiles, { ...base, flux: true, parity: "odd" });
    expect(odd.damage).toBe(6);
    const even = computePulse(tiles, { ...base, flux: true, parity: "even" });
    expect(even.damage).toBe(4);
    const open = computePulse(tiles, { ...base, flux: true, parity: "odd", parityDisabled: true });
    expect(open.damage).toBe(10);
  });

  it("doubles a critical value", () => {
    expect(computePulse([tile({ kind: "value", value: 4, crit: true })], base).damage).toBe(8);
  });

  it("doubles harmonic matches that touch", () => {
    const tiles = [
      tile({ kind: "value", value: 4, row: 0, col: 0 }),
      tile({ kind: "value", value: 4, row: 0, col: 1 }),
      tile({ kind: "value", value: 4, row: 2, col: 2 }),
    ];
    const r = computePulse(tiles, { ...base, harmonic: true });
    expect(r.damage).toBe(4 * 2 + 4 * 2 + 4);
  });

  it("boosts corner tiles by 50%", () => {
    const r = computePulse([tile({ kind: "value", value: 4, corner: true })], { ...base, corner: true });
    expect(r.damage).toBe(6);
  });

  it("applies echo, arc, and the armed next-pulse multiplier", () => {
    const tiles = [tile({ kind: "value", value: 20 })];
    expect(computePulse(tiles, { ...base, echo: true }).damage).toBe(30);
    expect(computePulse(tiles, { ...base, arc: true, gauge: 50 }).damage).toBe(25);
    expect(computePulse(tiles, { ...base, nextMult: 2 }).damage).toBe(40);
  });

  it("nullifies a pulse under the minimum", () => {
    const r = computePulse([tile({ kind: "value", value: 10 })], { ...base, minPulse: 15 });
    expect(r.damage).toBe(0);
    expect(r.nulled).toBe(true);
    const ok = computePulse([tile({ kind: "value", value: 15 })], { ...base, minPulse: 15 });
    expect(ok.damage).toBe(15);
    expect(ok.nulled).toBe(false);
  });
});

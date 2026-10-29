import type { GameState, StageDef } from "./types";
import { autoBuffs, createGame, legalCells, placeTile, rankMoves, resolveStuck } from "./engine";

function stateScore(s: GameState): number {
  if (s.status === "win") return 1e12 + s.turnsLeft * 10;
  if (s.status === "lose") return -1e12;
  let hp = 0;
  for (const t of s.targets) hp += t.hp + t.armor + t.layers * Math.max(0, t.armorMax);
  return -hp * 40 + s.turnsLeft * 8 + s.gauge * 0.1;
}

export interface SolveResult {
  win: boolean;
  turnsUsed: number;
  turnsLeft: number;
  status: string;
  hpLeft: number;
  seed: number;
}

export function solveOnce(stage: StageDef, allies: string[], seed: number, width = 1): SolveResult {
  let beam: GameState[] = [createGame(stage, allies, seed)];
  const limit = stage.turns + 12;
  for (let step = 0; step < limit; step++) {
    if (beam.some((s) => s.status === "win")) break;
    const next: GameState[] = [];
    for (const s of beam) {
      if (s.status !== "play") continue;
      autoBuffs(s);
      if ((s.status as GameState["status"]) !== "play") {
        next.push(s);
        continue;
      }
      const canAct = legalCells(s).length > 0 && (s.turnsLeft > 0 || s.bufferFree > 0);
      if (!canAct) {
        resolveStuck(s);
        next.push(s);
        continue;
      }
      const ranked = rankMoves(s);
      if (!ranked.length) {
        s.status = "lose";
        s.loseReason = "gridlock";
        next.push(s);
        continue;
      }
      const take = ranked.slice(0, width <= 1 ? 1 : Math.min(3, ranked.length));
      if (width <= 1) {
        const m = take[0];
        const before = s.turnsUsed;
        const ok = placeTile(s, m.handIndex, m.r, m.c);
        if (!ok && s.status === "play" && s.turnsUsed === before) {
          resolveStuck(s);
          if (s.status === "play" && s.turnsUsed === before && legalCells(s).length === 0) {
            s.status = "lose";
            s.loseReason = "gridlock";
          }
        }
        next.push(s);
      } else {
        for (const m of take) {
          const copy = structuredClone(s);
          placeTile(copy, m.handIndex, m.r, m.c);
          next.push(copy);
        }
      }
    }
    if (!next.length) break;
    next.sort((a, b) => stateScore(b) - stateScore(a));
    beam = next.slice(0, Math.max(1, width));
    if (beam.every((s) => s.status === "lose")) break;
  }
  const best = beam.slice().sort((a, b) => stateScore(b) - stateScore(a))[0];
  const hpLeft = best ? best.targets.reduce((n, t) => n + Math.max(0, t.hp), 0) : 0;
  return {
    win: best?.status === "win",
    turnsUsed: best?.turnsUsed ?? 0,
    turnsLeft: best?.turnsLeft ?? 0,
    status: best?.status ?? "lose",
    hpLeft,
    seed,
  };
}

/** Try several decks. Wider search only if the greedy line fails. */
export function solveStage(stage: StageDef, allies: string[], attempts = 16): SolveResult {
  let last: SolveResult = { win: false, turnsUsed: 0, turnsLeft: 0, status: "lose", hpLeft: 9999, seed: 1 };
  for (let seed = 1; seed <= attempts; seed++) {
    const res = solveOnce(stage, allies, seed, 1);
    if (res.win) return res;
    if (res.hpLeft < last.hpLeft) last = res;
  }
  const wide = stage.turns <= 8 ? 6 : 3;
  for (let seed = 1; seed <= Math.min(4, attempts); seed++) {
    const res = solveOnce(stage, allies, seed, wide);
    if (res.win) return res;
    if (res.hpLeft < last.hpLeft) last = res;
  }
  return last;
}

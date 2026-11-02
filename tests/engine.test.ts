import { describe, expect, it } from "vitest";
import { buildAllStages, buildStage } from "../src/game/stage";
import { createGame, legalCells, placeTile, rateStars, toughness, useAbility } from "../src/game/engine";
import { solveOnce } from "../src/game/solver";
import { solverSquad } from "../src/game/allies";
import { allCutsceneIds } from "../src/game/cutscenes";

function neighbors(r: number, c: number): [number, number][] {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
}

function placeValue(state: ReturnType<typeof createGame>, value: number, anchor?: { row: number; col: number }) {
  state.hand = [{ id: state.nextId++, kind: "value", value, crit: false }, ...state.hand.slice(0, 2)];
  const origin = anchor ?? state.targets[0];
  for (const [r, c] of neighbors(origin.row, origin.col)) {
    if (r < 0 || c < 0 || r >= state.stage.rows || c >= state.stage.cols) continue;
    const cell = state.cells[r][c];
    if (!cell.blocked && !cell.tile && cell.targetId == null) {
      expect(placeTile(state, 0, r, c)).toBe(true);
      return { row: r, col: c };
    }
  }
  throw new Error("no legal cell");
}

describe("stage data", () => {
  it("builds all 200 stages and starts on a 4×4", () => {
    const all = buildAllStages();
    expect(all).toHaveLength(200);
    const first = all[0];
    expect(first.id).toBe("1-1");
    expect(first.rows).toBe(4);
    expect(first.cols).toBe(4);
    expect(first.blocked).toEqual([]);
    expect(first.hp).toBe(20);
    expect(first.turns).toBe(8);
    expect(first.targetCount).toBe(1);
    expect(all.filter((s) => s.boss)).toHaveLength(25);
    expect(new Set(all.map((s) => s.id)).size).toBe(200);
  });

  it("lists 225 cutscenes", () => {
    expect(allCutsceneIds()).toHaveLength(225);
    expect(allCutsceneIds()[0]).toBe("e01-s01");
    expect(allCutsceneIds().at(-1)).toBe("e25-win");
  });
});

describe("rules on the board", () => {
  it("re-fires the network on the second placement", () => {
    const state = createGame(buildStage(1, 1), ["eli"], 1);
    const first = placeValue(state, 4);
    expect(state.lastPulse).toBe(4);
    expect(state.targets[0].hp).toBe(16);
    expect(state.turnsLeft).toBe(7);
    placeValue(state, 4, first);
    expect(state.lastPulse).toBe(8);
    expect(state.targets[0].hp).toBe(8);
    expect(state.gauge).toBe(10);
  });

  it("purges the network when the target blows", () => {
    const state = createGame(buildStage(1, 1), ["eli"], 2);
    state.targets[0].hp = 4;
    placeValue(state, 4);
    expect(state.status).toBe("win");
    const tiles = state.cells.flat().filter((c) => c.tile).length;
    expect(tiles).toBe(0);
    expect(rateStars(state.turnsLeft, state.stage.turns)).toBe(3);
  });

  it("spends armor before core HP", () => {
    const state = createGame(buildStage(1, 8), solverSquad(1, 8), 3);
    expect(state.stage.bossType).toBe("aegis");
    expect(state.targets[0].layers).toBe(1);
    const before = state.targets[0].hp;
    const armor = state.targets[0].armor;
    placeValue(state, 4);
    expect(state.targets[0].hp).toBe(before);
    expect(state.targets[0].armor).toBe(armor - 4);
  });

  it("ignores the wrong parity on a flux boss", () => {
    const state = createGame(buildStage(5, 8), solverSquad(5, 8), 4);
    expect(state.parity).toBe("odd");
    placeValue(state, 2);
    expect(state.lastPulse).toBe(0);
    expect(state.targets[0].hp).toBe(state.stage.hp);
  });

  it("fires the overclock shield instead of collapsing", () => {
    const state = createGame(buildStage(3, 2), solverSquad(3, 2), 5);
    expect(state.shieldOn).toBe(true);
    state.turnsLeft = 1;
    state.targets[0].hp = 500;
    placeValue(state, 1);
    expect(state.status).toBe("play");
    expect(state.shieldBroken).toBe(true);
    expect(state.turnsLeft).toBeGreaterThanOrEqual(3);
  });

  it("adds a ×2 through Signal Boost", () => {
    const state = createGame(buildStage(1, 3), ["eli"], 6);
    const before = state.hand.length;
    expect(useAbility(state, "eli")).toBe(true);
    expect(state.hand.length).toBe(before + 1);
    expect(state.hand.at(-1)?.kind).toBe("mult");
    expect(state.hand.at(-1)?.value).toBe(2);
    expect(useAbility(state, "eli")).toBe(false);
  });

  it("clears stage 1-1 with the solver", () => {
    const stage = buildStage(1, 1);
    const res = solveOnce(stage, solverSquad(1, 1), 1, 1);
    expect(res.win).toBe(true);
  });

  it("keeps the shield lesson on 3-2 and replaces the dead shield roll later", () => {
    expect(buildStage(3, 2).modifiers).toEqual(["shield"]);
    const late = buildAllStages().filter((s) => s.episode >= 17);
    expect(late.every((s) => !s.modifiers.includes("shield"))).toBe(true);
    expect(buildStage(18, 7).modifiers).toContain("arc");
    expect(buildStage(18, 7).modifiers).toHaveLength(2);
  });

  it("sweeps tiles that are not touching a target and leaves the one that is", () => {
    const state = createGame(buildStage(13, 2), [], 1);
    const target = state.targets[0];
    state.targets[0].hp = 9000;
    state.cells[target.row][target.col + 1].tile = { id: 50, kind: "value", value: 4, crit: false };
    state.cells[0][1].tile = { id: 51, kind: "value", value: 1, crit: false };
    state.turnsUsed = 4;
    const spot = legalCells(state).find(([r, c]) => !(r === 0 && c === 1))!;
    state.hand[0] = { id: state.nextId++, kind: "value", value: 1, crit: false };
    expect(placeTile(state, 0, spot[0], spot[1])).toBe(true);
    expect(state.cells[target.row][target.col + 1].tile?.value).toBe(4);
    expect(state.cells[0][1].tile).toBeNull();
    expect(state.events.some((e) => e.type === "banner" && e.text === "DEFRAG SWEEP")).toBe(true);
  });

  it("purges a tile that only touched the laser line", () => {
    const state = createGame(buildStage(4, 2), [], 2);
    state.targets[0].hp = 9000;
    for (let c = 0; c < state.stage.cols; c++) {
      if (!state.cells[0][c].blocked && state.cells[0][c].targetId == null) {
        state.cells[0][c].tile = { id: 60 + c, kind: "value", value: 1, crit: false };
      }
    }
    state.cells[1][3].tile = { id: 70, kind: "value", value: 9, crit: false };
    state.hand[0] = { id: state.nextId++, kind: "value", value: 1, crit: false };
    expect(placeTile(state, 0, 1, 0)).toBe(true);
    expect(state.cells[0].every((cell) => !cell.tile)).toBe(true);
    expect(state.cells[1][3].tile).toBeNull();
    expect(legalCells(state).some(([r, c]) => r === 1 && c === 3)).toBe(false);
  });

  it("refuses to punch the final HELIX armor with an early Root Access", () => {
    const state = createGame(buildStage(25, 8), ["julia"], 3);
    const core = state.targets[0];
    const hp = core.hp;
    expect(core.layers).toBe(2);
    expect(useAbility(state, "julia")).toBe(true);
    expect(state.rootStripped).toBe(false);
    expect(toughness(state, core)).toBe(core.armor);
    state.cells[core.row + 1][core.col].tile = { id: 80, kind: "value", value: 400, crit: false };
    state.hand[0] = { id: state.nextId++, kind: "value", value: 200, crit: false };
    expect(placeTile(state, 0, core.row + 1, core.col + 1)).toBe(true);
    expect(state.status).toBe("play");
    expect(state.targets[0].hp).toBe(hp);
    expect(state.targets[0].layers).toBe(1);
    expect(toughness(state, state.targets[0])).toBe(Number.POSITIVE_INFINITY);
  });
});

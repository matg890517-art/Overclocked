import type { Cell, GameEvent, GameState, MixPhase, ModId, StageDef, Target, Tile } from "./types";
import { rngNext } from "./rng";
import { computePulse, type PulseOpts } from "./pulse";
import type { PulseTile } from "./types";

export const DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function hasMod(state: GameState, id: ModId): boolean {
  return state.stage.modifiers.includes(id);
}

function inside(state: GameState, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < state.stage.rows && c < state.stage.cols;
}

function makeTile(state: GameState, kind: Tile["kind"], value: number): Tile {
  return { id: state.nextId++, kind, value, crit: false };
}

function drawTile(state: GameState, forceMax: boolean): Tile {
  const pool = state.stage.pool;
  if (!forceMax) {
    const [s1, roll] = rngNext(state.rng);
    state.rng = s1;
    if (roll < pool.multChance) {
      const [s2, roll2] = rngNext(state.rng);
      state.rng = s2;
      const value = pool.hasX3 && roll2 < 0.5 ? 3 : 2;
      return makeTile(state, "mult", value);
    }
  }
  let value = pool.maxValue;
  if (!forceMax) {
    const [s2, roll2] = rngNext(state.rng);
    state.rng = s2;
    value = 1 + Math.floor(roll2 * pool.maxValue);
  }
  return makeTile(state, "value", value);
}

function refill(state: GameState): void {
  const scrappy = hasMod(state, "scrappy") && fillRatio(state) >= 0.75;
  let guard = 0;
  while (state.hand.length < 3 && guard++ < 6) {
    state.hand.push(drawTile(state, scrappy));
  }
  if (scrappy) {
    const spot = weakestTile(state);
    if (spot && fillRatio(state) >= 0.75) {
      state.cells[spot.r][spot.c].tile = null;
      state.events.push({ type: "banner", text: "SCRAPPY DRAW" });
      purgeOrphans(state);
    }
  }
}

export function fillRatio(state: GameState): number {
  let open = 0;
  let filled = 0;
  for (const row of state.cells) {
    for (const cell of row) {
      if (cell.blocked || cell.targetId != null) continue;
      open++;
      if (cell.tile) filled++;
    }
  }
  return open === 0 ? 1 : filled / open;
}

function placeTargets(state: GameState, count: number, hp: number, armored: boolean): void {
  const open: [number, number][] = [];
  const set = new Set(state.stage.blocked.map(([r, c]) => `${r},${c}`));
  for (let r = 0; r < state.stage.rows; r++) {
    for (let c = 0; c < state.stage.cols; c++) {
      if (!set.has(`${r},${c}`)) open.push([r, c]);
    }
  }
  const cr = (state.stage.rows - 1) / 2;
  const cc = (state.stage.cols - 1) / 2;
  const neigh = (r: number, c: number) =>
    DIRS.reduce((n, [dr, dc]) => n + (set.has(`${r + dr},${c + dc}`) || !inside(state, r + dr, c + dc) ? 0 : 1), 0);
  open.sort((a, b) => {
    const da = Math.abs(a[0] - cr) + Math.abs(a[1] - cc);
    const db = Math.abs(b[0] - cr) + Math.abs(b[1] - cc);
    if (da !== db) return da - db;
    return neigh(b[0], b[1]) - neigh(a[0], a[1]);
  });
  const picked: [number, number][] = [];
  if (open[0]) picked.push(open[0]);
  for (const cell of open) {
    if (picked.length >= count) break;
    if (picked.some(([r, c]) => r === cell[0] && c === cell[1])) continue;
    const distOk = picked.every(([r, c]) => {
      const d = Math.abs(r - cell[0]) + Math.abs(c - cell[1]);
      return d >= 2 && d <= 3;
    });
    if (distOk) picked.push(cell);
  }
  for (const cell of open) {
    if (picked.length >= count) break;
    if (picked.some(([r, c]) => r === cell[0] && c === cell[1])) continue;
    picked.push(cell);
  }
  for (const [r, c] of picked.slice(0, count)) {
    const t: Target = {
      id: state.nextId++,
      row: r,
      col: c,
      hp,
      maxHp: hp,
      armor: armored ? state.stage.armorEach : 0,
      armorMax: armored ? state.stage.armorEach : 0,
      layers: armored ? state.stage.armorLayers : 0,
      layersMax: armored ? state.stage.armorLayers : 0,
      splitDone: false,
      branch: false,
    };
    state.targets.push(t);
    state.cells[r][c].targetId = t.id;
  }
}

export function createGame(stage: StageDef, allies: string[], seed: number): GameState {
  const cells: Cell[][] = [];
  const blocked = new Set(stage.blocked.map(([r, c]) => `${r},${c}`));
  for (let r = 0; r < stage.rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < stage.cols; c++) {
      let openN = 0;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= stage.rows || nc >= stage.cols) continue;
        if (!blocked.has(`${nr},${nc}`)) openN++;
      }
      row.push({
        blocked: blocked.has(`${r},${c}`),
        tile: null,
        targetId: null,
        corner: openN <= 2 && !blocked.has(`${r},${c}`),
        checker: (r + c) % 2 === 0,
      });
    }
    cells.push(row);
  }
  let openCells = 0;
  for (const row of cells) for (const cell of row) if (!cell.blocked) openCells++;
  const state: GameState = {
    stage,
    cells,
    targets: [],
    hand: [],
    rng: (seed >>> 0) || 1,
    nextId: 1,
    turnsLeft: stage.turns,
    turnsUsed: 0,
    gauge: 0,
    peakGauge: 0,
    overloadReady: false,
    nextMult: 1,
    shieldOn: stage.shield,
    shieldBroken: false,
    allies: stage.alliesBanned ? [] : [...allies],
    used: {},
    parity: "odd",
    parityLock: 0,
    negate: 0,
    rootStripped: false,
    mixPhase: stage.bossType === "mix" ? "aegis" : "none",
    mixClock: null,
    fusionLeft: Math.max(1, Math.ceil(openCells / 16)),
    refreshLeft: stage.modifiers.includes("refresh") ? 1 : 0,
    bufferFree: stage.modifiers.includes("buffer") ? 1 : 0,
    forecast: 0,
    status: "play",
    loseReason: "",
    overkill: 0,
    maxPulse: 0,
    lastPulse: 0,
    tilesPlaced: 0,
    clears: 0,
    multiClears: 0,
    events: [],
    openCells,
  };
  placeTargets(state, stage.targetCount, stage.hp, stage.armorLayers > 0);
  refill(state);
  return state;
}

export function livingTargets(state: GameState): Target[] {
  return state.targets.filter((t) => t.hp > 0);
}

/** Tiles that still connect, orthogonally, to a living target. */
function networkAnchored(state: GameState): Set<string> {
  const connected = new Set<string>();
  const q: [number, number][] = [];
  for (const t of livingTargets(state)) {
    for (const [dr, dc] of DIRS) {
      const nr = t.row + dr;
      const nc = t.col + dc;
      if (inside(state, nr, nc) && state.cells[nr][nc].tile) q.push([nr, nc]);
    }
  }
  while (q.length) {
    const [r, c] = q.shift()!;
    const k = `${r},${c}`;
    if (connected.has(k) || !state.cells[r][c].tile) continue;
    connected.add(k);
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (inside(state, nr, nc) && state.cells[nr][nc].tile) q.push([nr, nc]);
    }
  }
  return connected;
}

export function legalCells(state: GameState): [number, number][] {
  const anchored = networkAnchored(state);
  const seen = new Set<string>();
  const out: [number, number][] = [];
  const consider = (r: number, c: number) => {
    const k = `${r},${c}`;
    if (seen.has(k) || !inside(state, r, c)) return;
    const cell = state.cells[r][c];
    if (cell.blocked || cell.tile || cell.targetId != null) return;
    seen.add(k);
    out.push([r, c]);
  };
  for (let r = 0; r < state.stage.rows; r++) {
    for (let c = 0; c < state.stage.cols; c++) {
      const cell = state.cells[r][c];
      const onNetwork = Boolean(cell.tile) && anchored.has(`${r},${c}`);
      if (!onNetwork && cell.targetId == null) continue;
      for (const [dr, dc] of DIRS) consider(r + dr, c + dc);
    }
  }
  return out;
}

export function isLegal(state: GameState, r: number, c: number): boolean {
  return legalCells(state).some(([rr, cc]) => rr === r && cc === c);
}

function fluxActive(state: GameState): boolean {
  if (state.stage.bossType === "flux") return true;
  return state.stage.bossType === "mix" && state.mixPhase === "flux";
}

function bioActive(state: GameState): boolean {
  if (state.stage.bossType === "bio") return true;
  return state.stage.bossType === "mix" && state.mixPhase === "bio";
}

function mitosisActive(state: GameState): boolean {
  if (state.stage.bossType === "mitosis") return true;
  return state.stage.bossType === "mix" && state.mixPhase === "mitosis";
}

function armorActive(state: GameState, t: Target): boolean {
  if (t.layers <= 0 || t.armor <= 0) return false;
  if (state.stage.bossType === "mix" && state.mixPhase !== "aegis") return false;
  return true;
}

function lastLocked(state: GameState, t: Target): boolean {
  return state.stage.rootRequired && !state.rootStripped && t.layers === 1;
}

function addGauge(state: GameState, n: number): void {
  state.gauge = Math.min(100, state.gauge + n);
  if (state.gauge > state.peakGauge) state.peakGauge = state.gauge;
  if (state.gauge >= 100) state.overloadReady = true;
}

function pulseOpts(state: GameState): PulseOpts {
  return {
    flux: fluxActive(state),
    parity: state.parity,
    parityDisabled: state.parityLock > 0 || state.negate > 0,
    harmonic: hasMod(state, "harmonic"),
    corner: hasMod(state, "corner"),
    echo: hasMod(state, "echo") && state.tilesPlaced > 0 && state.tilesPlaced % 4 === 0,
    arc: hasMod(state, "arc"),
    gauge: state.gauge,
    nextMult: state.nextMult,
    minPulse: state.negate > 0 ? 0 : state.stage.minPulse,
  };
}

function collectNetwork(state: GameState, r: number, c: number, extra: Tile | null): PulseTile[] {
  const out: PulseTile[] = [];
  const seen = new Set<string>();
  const q: [number, number][] = [[r, c]];
  seen.add(`${r},${c}`);
  while (q.length) {
    const [cr, cc] = q.shift()!;
    const tile = cr === r && cc === c && extra ? extra : state.cells[cr][cc].tile;
    if (!tile) continue;
    const cell = state.cells[cr][cc];
    out.push({
      kind: tile.kind,
      value: tile.value,
      crit: tile.crit,
      row: cr,
      col: cc,
      corner: cell.corner,
    });
    for (const [dr, dc] of DIRS) {
      const nr = cr + dr;
      const nc = cc + dc;
      const k = `${nr},${nc}`;
      if (seen.has(k) || !inside(state, nr, nc)) continue;
      if (nr === r && nc === c) continue;
      if (state.cells[nr][nc].tile) {
        seen.add(k);
        q.push([nr, nc]);
      }
    }
  }
  return out;
}

function targetsTouching(state: GameState, tiles: { row: number; col: number }[]): Target[] {
  const ids = new Set<number>();
  for (const t of tiles) {
    for (const [dr, dc] of DIRS) {
      const nr = t.row + dr;
      const nc = t.col + dc;
      if (!inside(state, nr, nc)) continue;
      const id = state.cells[nr][nc].targetId;
      if (id != null) ids.add(id);
    }
  }
  return state.targets.filter((t) => ids.has(t.id) && t.hp > 0);
}

function findTarget(state: GameState, id: number): Target | undefined {
  return state.targets.find((t) => t.id === id);
}

/** Root Access opens normal armor. The final HELIX layer stays shut until Julia strips it. */
function armorBypass(state: GameState, t: Target): boolean {
  if (state.negate <= 0 || !armorActive(state, t)) return false;
  if (state.stage.rootRequired && !state.rootStripped) return false;
  return (
    state.stage.bossType === "aegis" ||
    (state.stage.bossType === "mix" && state.mixPhase === "aegis") ||
    state.stage.bossType === "countdown"
  );
}

/** How much damage the target can still absorb. Infinity means the hit cannot stick. */
export function toughness(state: GameState, t: Target): number {
  if (t.hp <= 0) return 0;
  if (!armorActive(state, t)) return t.hp;
  if (lastLocked(state, t) || (state.stage.rootRequired && !state.rootStripped && t.layers <= 1)) {
    return Number.POSITIVE_INFINITY;
  }
  if (armorBypass(state, t)) return t.hp;
  if (state.stage.rootRequired && !state.rootStripped) {
    return t.armor + Math.max(0, t.layers - 2) * t.armorMax;
  }
  return t.hp + t.armor + Math.max(0, t.layers - 1) * t.armorMax;
}

function applyDamage(state: GameState, t: Target, amount: number): { dealt: number; killed: boolean } {
  if (amount <= 0 || t.hp <= 0) return { dealt: 0, killed: false };
  let left = amount;
  let dealt = 0;
  const bypass = armorBypass(state, t);

  if (armorActive(state, t) && lastLocked(state, t)) {
    return { dealt: 0, killed: false };
  }

  if (armorActive(state, t) && !bypass) {
    if (state.stage.rootRequired && !state.rootStripped && t.layers === 1) {
      return { dealt: 0, killed: false };
    }
    const use = Math.min(t.armor, left);
    t.armor -= use;
    left -= use;
    dealt += use;
    state.events.push({ type: "hit", damage: use, r: t.row, c: t.col, armor: true });
    while (t.armor <= 0 && t.layers > 0) {
      t.layers -= 1;
      if (t.layers > 0) {
        t.armor = t.armorMax;
        if (state.stage.rootRequired && !state.rootStripped && t.layers === 1) {
          left = 0;
          break;
        }
        const spill = Math.min(t.armor, left);
        t.armor -= spill;
        left -= spill;
        dealt += spill;
      } else {
        t.armor = 0;
      }
    }
  }

  if (left > 0 && t.layers <= 0) {
    t.hp -= left;
    dealt += left;
    if (t.hp < 0) {
      state.overkill += -t.hp;
      t.hp = 0;
    }
    state.events.push({ type: "hit", damage: left, r: t.row, c: t.col, armor: false });
  } else if (left > 0 && bypass) {
    t.hp -= left;
    dealt += left;
    if (t.hp < 0) {
      state.overkill += -t.hp;
      t.hp = 0;
    }
    state.events.push({ type: "hit", damage: left, r: t.row, c: t.col, armor: false });
  }

  return { dealt, killed: t.hp <= 0 };
}

function stripArmor(state: GameState, t: Target, amount: number): void {
  if (t.layers <= 0 || amount <= 0) return;
  if (lastLocked(state, t)) return;
  t.armor -= amount;
  while (t.armor <= 0 && t.layers > 0) {
    t.layers -= 1;
    if (t.layers > 0) {
      t.armor = t.armorMax;
      if (lastLocked(state, t)) return;
    } else t.armor = 0;
  }
  state.events.push({ type: "hit", damage: amount, r: t.row, c: t.col, armor: true });
}

function resolveDeaths(state: GameState, killingPulse: number, chain: boolean): void {
  const dead = state.targets.filter((t) => t.hp <= 0);
  if (!dead.length) return;
  for (const t of dead) {
    if (state.cells[t.row][t.col].targetId === t.id) state.cells[t.row][t.col].targetId = null;
    state.events.push({ type: "kill", r: t.row, c: t.col });
  }
  state.targets = state.targets.filter((t) => t.hp > 0);
  state.clears += dead.length;
  for (let i = 0; i < dead.length; i++) addGauge(state, 15);
  if (dead.length >= 2) {
    state.multiClears += 1;
    addGauge(state, 30);
    state.events.push({ type: "banner", text: `MULTI-CLEAR ×${dead.length}` });
  } else {
    state.events.push({ type: "banner", text: "NODE CLEARED" });
  }
  if (chain && hasMod(state, "chain") && state.targets.length && killingPulse > 0) {
    const bonus = Math.max(1, Math.floor(killingPulse * 0.25));
    state.events.push({ type: "banner", text: `CHAIN +${bonus}` });
    for (const t of [...state.targets]) applyDamage(state, t, bonus);
    resolveDeaths(state, 0, false);
  }
  purgeOrphans(state);
}

function purgeOrphans(state: GameState): void {
  const connected = networkAnchored(state);
  const removed: Tile[] = [];
  for (let r = 0; r < state.stage.rows; r++) {
    for (let c = 0; c < state.stage.cols; c++) {
      const tile = state.cells[r][c].tile;
      if (!tile) continue;
      if (!connected.has(`${r},${c}`)) {
        removed.push(tile);
        state.cells[r][c].tile = null;
      }
    }
  }
  if (!removed.length) return;
  state.events.push({ type: "purge", count: removed.length });
  if (hasMod(state, "recycler")) {
    const best = removed.filter((t) => t.kind === "value").sort((a, b) => b.value - a.value)[0];
    if (best && state.hand.length < 6) {
      best.crit = false;
      state.hand.push(best);
      state.events.push({ type: "banner", text: `RECYCLED [-${best.value}]` });
    }
  }
}

function adjacentTarget(state: GameState, r: number, c: number): boolean {
  return DIRS.some(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    return inside(state, nr, nc) && state.cells[nr][nc].targetId != null;
  });
}

function resolveFusion(state: GameState): void {
  if (!hasMod(state, "fusion") || state.fusionLeft <= 0) return;
  for (let r = 0; r < state.stage.rows - 1; r++) {
    for (let c = 0; c < state.stage.cols - 1; c++) {
      const coords: [number, number][] = [
        [r, c],
        [r, c + 1],
        [r + 1, c],
        [r + 1, c + 1],
      ];
      if (!coords.every(([rr, cc]) => state.cells[rr][cc].tile?.kind === "value")) continue;
      const value = Math.max(1, Math.round(state.openCells * 0.75));
      const keep = state.cells[r][c].tile!;
      keep.value = value;
      keep.crit = false;
      for (const [rr, cc] of coords.slice(1)) state.cells[rr][cc].tile = null;
      state.fusionLeft -= 1;
      state.events.push({ type: "fusion", value });
      state.events.push({ type: "banner", text: `FUSION [-${value}]` });
      return;
    }
  }
}

function lineCells(state: GameState, fixed: number, horizontal: boolean): [number, number][] {
  const len = horizontal ? state.stage.cols : state.stage.rows;
  const cells: [number, number][] = [];
  for (let i = 0; i < len; i++) {
    const r = horizontal ? fixed : i;
    const c = horizontal ? i : fixed;
    const cell = state.cells[r][c];
    if (cell.blocked || cell.targetId != null) continue;
    cells.push([r, c]);
  }
  return cells;
}

function resolveLaser(state: GameState): void {
  if (!hasMod(state, "laser")) return;
  const lines: [number, number][][] = [];
  for (let r = 0; r < state.stage.rows; r++) {
    const cells = lineCells(state, r, true);
    if (cells.length >= 3 && cells.every(([rr, cc]) => state.cells[rr][cc].tile)) lines.push(cells);
  }
  for (let c = 0; c < state.stage.cols; c++) {
    const cells = lineCells(state, c, false);
    if (cells.length >= 3 && cells.every(([rr, cc]) => state.cells[rr][cc].tile)) lines.push(cells);
  }
  if (!lines.length) return;
  const cleared = new Set<string>();
  let bonus = 0;
  for (const line of lines) {
    for (const [r, c] of line) {
      const k = `${r},${c}`;
      if (cleared.has(k)) continue;
      const tile = state.cells[r][c].tile;
      if (!tile) continue;
      if (tile.kind === "value") bonus += tile.value * (tile.crit ? 2 : 1);
      cleared.add(k);
      state.cells[r][c].tile = null;
    }
  }
  bonus = Math.floor(bonus);
  state.events.push({ type: "laser", damage: bonus });
  state.events.push({ type: "banner", text: `LASER WIPE ${bonus}` });
  if (bonus > 0) {
    for (const t of [...state.targets]) applyDamage(state, t, bonus);
  }
  purgeOrphans(state);
}

function spawnNear(state: GameState, parent: Target, hp: number): void {
  if (hp <= 0) return;
  const candidates: [number, number][] = [];
  for (const [dr, dc] of DIRS) {
    const nr = parent.row + dr;
    const nc = parent.col + dc;
    if (!inside(state, nr, nc)) continue;
    const cell = state.cells[nr][nc];
    if (cell.blocked || cell.targetId != null) continue;
    candidates.push([nr, nc]);
  }
  let spot = candidates.find(([r, c]) => !state.cells[r][c].tile);
  if (!spot && candidates.length) {
    candidates.sort((a, b) => {
      const ta = state.cells[a[0]][a[1]].tile;
      const tb = state.cells[b[0]][b[1]].tile;
      const sa = !ta ? -1 : ta.kind === "mult" ? 50 : ta.value;
      const sb = !tb ? -1 : tb.kind === "mult" ? 50 : tb.value;
      return sa - sb;
    });
    spot = candidates[0];
    state.cells[spot[0]][spot[1]].tile = null;
  }
  if (!spot) {
    const any = weakestTile(state);
    if (!any) return;
    state.cells[any.r][any.c].tile = null;
    spot = [any.r, any.c];
  }
  const t: Target = {
    id: state.nextId++,
    row: spot[0],
    col: spot[1],
    hp,
    maxHp: hp,
    armor: 0,
    armorMax: 0,
    layers: 0,
    layersMax: 0,
    splitDone: true,
    branch: true,
  };
  state.targets.push(t);
  state.cells[spot[0]][spot[1]].targetId = t.id;
  state.events.push({ type: "split" });
  state.events.push({ type: "banner", text: "NODE SPLIT" });
  purgeOrphans(state);
}

function resolveMitosis(state: GameState): void {
  if (!mitosisActive(state)) return;
  if (state.negate > 0 && state.stage.bossType === "mitosis") return;
  if (state.negate > 0 && state.stage.bossType === "mix" && state.mixPhase === "mitosis") return;
  for (const t of [...state.targets]) {
    if (t.splitDone || t.branch || t.hp <= 0) continue;
    if (t.hp > t.maxHp * 0.5) continue;
    t.splitDone = true;
    const child = Math.floor(t.maxHp / 4);
    spawnNear(state, t, child);
  }
}

export function weakestTile(state: GameState): { r: number; c: number } | null {
  let best: { r: number; c: number; score: number } | null = null;
  for (let r = 0; r < state.stage.rows; r++) {
    for (let c = 0; c < state.stage.cols; c++) {
      const tile = state.cells[r][c].tile;
      if (!tile) continue;
      let neighbors = 0;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (inside(state, nr, nc) && state.cells[nr][nc].tile) neighbors++;
      }
      const base = tile.kind === "mult" ? 80 + tile.value : tile.value + (tile.crit ? 20 : 0);
      const score = neighbors * 30 + base;
      if (!best || score < best.score) best = { r, c, score };
    }
  }
  return best ? { r: best.r, c: best.c } : null;
}

function refreshCorner(state: GameState, r: number, c: number): void {
  if (!inside(state, r, c)) return;
  const cell = state.cells[r][c];
  if (cell.blocked) {
    cell.corner = false;
    return;
  }
  let openN = 0;
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inside(state, nr, nc) || state.cells[nr][nc].blocked) continue;
    openN++;
  }
  cell.corner = openN <= 2;
}

function refreshCornersNear(state: GameState, r: number, c: number): void {
  refreshCorner(state, r, c);
  for (const [dr, dc] of DIRS) refreshCorner(state, r + dr, c + dc);
}

function floodOneCell(state: GameState): void {
  let best: { r: number; c: number; dist: number } | null = null;
  for (let r = 0; r < state.stage.rows; r++) {
    for (let c = 0; c < state.stage.cols; c++) {
      const cell = state.cells[r][c];
      if (cell.blocked || cell.targetId != null || cell.tile) continue;
      let dist = 0;
      for (const t of state.targets) dist += Math.abs(t.row - r) + Math.abs(t.col - c);
      if (!best || dist > best.dist) best = { r, c, dist };
    }
  }
  if (best) {
    state.cells[best.r][best.c].blocked = true;
    refreshCornersNear(state, best.r, best.c);
    state.events.push({ type: "flood" });
    return;
  }
  const spot = weakestTile(state);
  if (!spot) return;
  state.cells[spot.r][spot.c].tile = null;
  state.cells[spot.r][spot.c].blocked = true;
  refreshCornersNear(state, spot.r, spot.c);
  state.events.push({ type: "flood" });
  purgeOrphans(state);
}

function triggerShield(state: GameState): void {
  state.shieldBroken = true;
  state.shieldOn = false;
  const bonus = Math.max(3, Math.ceil(state.stage.turns * 0.1));
  state.turnsLeft += bonus;
  if (state.mixClock != null) state.mixClock += bonus;
  for (let i = 0; i < 3; i++) {
    const spot = weakestTile(state);
    if (!spot) break;
    state.cells[spot.r][spot.c].tile = null;
  }
  purgeOrphans(state);
  state.events.push({ type: "shield", bonus });
  state.events.push({ type: "banner", text: `SHIELD +${bonus} TURNS` });
}

function updateMix(state: GameState): void {
  if (state.stage.bossType !== "mix") return;
  const core = state.targets.find((t) => !t.branch) ?? state.targets[0];
  if (!core) return;
  const ratio = core.hp / core.maxHp;
  const order: MixPhase[] = ["aegis", "bio", "flux", "mitosis", "countdown"];
  const proposed = ratio > 0.8 ? "aegis" : ratio > 0.6 ? "bio" : ratio > 0.4 ? "flux" : ratio > 0.2 ? "mitosis" : "countdown";
  const prev = state.mixPhase;
  const next = order[Math.max(order.indexOf(prev), order.indexOf(proposed))];
  state.mixPhase = next;
  if (prev !== next) state.events.push({ type: "banner", text: `PHASE · ${next.toUpperCase()}` });
  if (next === "countdown" && state.mixClock == null) state.mixClock = 5;
  if (next === "mitosis") resolveMitosis(state);
}

function endStep(state: GameState): void {
  const negated = state.negate > 0;
  if (bioActive(state) && !negated && state.stage.regen > 0) {
    for (const t of state.targets) {
      if (t.hp <= 0) continue;
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + state.stage.regen);
      const gained = t.hp - before;
      if (gained > 0) state.events.push({ type: "regen", amount: gained, r: t.row, c: t.col });
    }
  }
  if (state.parityLock > 0) state.parityLock -= 1;
  if (fluxActive(state)) state.parity = state.parity === "odd" ? "even" : "odd";
  if (negated) state.negate -= 1;
  state.nextMult = 1;

  if (state.stage.flood) floodOneCell(state);
  if (hasMod(state, "defrag") && state.turnsUsed > 0 && state.turnsUsed % 5 === 0) {
    const loose: { r: number; c: number; score: number }[] = [];
    for (let r = 0; r < state.stage.rows; r++) {
      for (let c = 0; c < state.stage.cols; c++) {
        const tile = state.cells[r][c].tile;
        if (!tile || adjacentTarget(state, r, c)) continue;
        loose.push({ r, c, score: tile.kind === "mult" ? 80 : tile.value + (tile.crit ? 20 : 0) });
      }
    }
    loose.sort((a, b) => a.score - b.score);
    const swept = loose.slice(0, 2);
    for (const cell of swept) state.cells[cell.r][cell.c].tile = null;
    if (swept.length) {
      purgeOrphans(state);
      state.events.push({ type: "banner", text: "DEFRAG SWEEP" });
    }
  }
  if (state.forecast > 0) state.forecast -= 1;
  refill(state);

  if (livingTargets(state).length === 0) {
    state.status = "win";
    state.events.push({ type: "win" });
    return;
  }
  if (state.mixClock != null) {
    state.mixClock -= 1;
    if (state.mixClock <= 0) {
      if (state.shieldOn && !state.shieldBroken) {
        triggerShield(state);
        if (state.mixClock <= 0) state.mixClock = 1;
      } else {
        state.status = "lose";
        state.loseReason = "countdown";
        state.events.push({ type: "lose", reason: "countdown" });
        return;
      }
    }
  }
  const noTurns = state.turnsLeft <= 0 && state.bufferFree <= 0;
  const noSpace = legalCells(state).length === 0;
  if (noTurns || noSpace) {
    if (state.shieldOn && !state.shieldBroken) {
      triggerShield(state);
      refill(state);
      if (livingTargets(state).length === 0) {
        state.status = "win";
        state.events.push({ type: "win" });
        return;
      }
      const still = (state.turnsLeft <= 0 && state.bufferFree <= 0) || legalCells(state).length === 0;
      if (still) {
        state.status = "lose";
        state.loseReason = noSpace ? "gridlock" : "timeout";
        state.events.push({ type: "lose", reason: state.loseReason });
        return;
      }
    } else {
      state.status = "lose";
      state.loseReason = noSpace && !noTurns ? "gridlock" : "timeout";
      state.events.push({ type: "lose", reason: state.loseReason });
      return;
    }
  }
  if (state.status === "play") updateMix(state);
}

export function refreshHand(state: GameState): boolean {
  if (state.status !== "play" || state.refreshLeft <= 0) return false;
  state.events = [];
  state.refreshLeft = 0;
  state.hand = [];
  refill(state);
  state.events.push({ type: "banner", text: "HAND REFRESH" });
  state.events.push({ type: "ability", id: "refresh", text: "Hand dumped. Three new tiles." });
  return true;
}

export function placeTile(state: GameState, handIndex: number, r: number, c: number): boolean {
  if (state.status !== "play") return false;
  const tile = state.hand[handIndex];
  if (!tile) return false;
  if (!inside(state, r, c) || !isLegal(state, r, c)) return false;
  if (state.turnsLeft <= 0 && state.bufferFree <= 0) return false;

  state.events = [];
  state.hand.splice(handIndex, 1);
  if (hasMod(state, "critical") && tile.kind === "value" && adjacentTarget(state, r, c)) tile.crit = true;
  state.cells[r][c].tile = tile;
  if (state.bufferFree > 0) state.bufferFree -= 1;
  else state.turnsLeft -= 1;
  state.turnsUsed += 1;
  state.tilesPlaced += 1;
  addGauge(state, 5);

  if (hasMod(state, "corrosive")) {
    for (const t of targetsTouching(state, [{ row: r, col: c }])) applyDamage(state, t, 2);
  }

  const net = collectNetwork(state, r, c, null);
  const opts = pulseOpts(state);
  const pulse = computePulse(net, opts);
  state.lastPulse = pulse.damage;
  if (pulse.damage > state.maxPulse) state.maxPulse = pulse.damage;
  state.events.push({ type: "pulse", damage: pulse.damage, r, c, nulled: pulse.nulled });
  if (pulse.nulled) state.events.push({ type: "banner", text: "PULSE NULLIFIED" });
  else if (pulse.damage >= 100) state.events.push({ type: "banner", text: "SYSTEM SHOCK" });
  else if (pulse.damage >= 40) state.events.push({ type: "banner", text: "HEAVY PULSE" });

  const victims = targetsTouching(state, net);
  for (const t of victims) {
    const live = findTarget(state, t.id);
    if (live) applyDamage(state, live, pulse.damage);
  }
  resolveDeaths(state, pulse.damage, true);
  if (livingTargets(state).length === 0) {
    state.status = "win";
    state.events.push({ type: "win" });
    state.nextMult = 1;
    return true;
  }
  resolveFusion(state);
  resolveLaser(state);
  resolveDeaths(state, pulse.damage, true);
  resolveMitosis(state);
  if (livingTargets(state).length === 0) {
    state.status = "win";
    state.events.push({ type: "win" });
    state.nextMult = 1;
    return true;
  }
  endStep(state);
  return true;
}

function badHand(state: GameState): boolean {
  const values = state.hand.filter((t) => t.kind === "value").map((t) => t.value);
  if (!values.length) return true;
  return Math.max(...values) <= Math.max(2, Math.ceil(state.stage.pool.maxValue / 3));
}

export function useAbility(state: GameState, ally: string, at?: { r: number; c: number }): boolean {
  if (state.status !== "play") return false;
  if (state.stage.alliesBanned) return false;
  if (!state.allies.includes(ally)) return false;
  if (state.used[ally]) return false;
  if (ally === "crane" && (state.stage.episode < 18 || state.stage.episode > 23)) return false;
  state.events = [];

  if (ally === "tank") {
    if (!at || !inside(state, at.r, at.c) || !state.cells[at.r][at.c].tile) return false;
    state.used.tank = true;
    state.cells[at.r][at.c].tile = null;
    purgeOrphans(state);
    state.events.push({ type: "ability", id: "tank", text: "Breach. Tile removed, no turn spent." });
    return true;
  }

  state.used[ally] = true;
  if (ally === "eli") {
    state.hand.push(makeTile(state, "mult", 2));
    state.events.push({ type: "ability", id: "eli", text: "Signal Boost. [×2] added to your hand." });
    return true;
  }
  if (ally === "mira") {
    const list = livingTargets(state);
    if (!list.length) {
      state.used.mira = false;
      return false;
    }
    const weak = [...list].sort((a, b) => a.hp + a.armor - (b.hp + b.armor))[0];
    applyDamage(state, weak, 6);
    state.events.push({ type: "ability", id: "mira", text: "Overwatch. 6 damage on the weakest node." });
    resolveDeaths(state, 6, true);
    if (livingTargets(state).length === 0) {
      state.status = "win";
      state.events.push({ type: "win" });
    }
    return true;
  }
  if (ally === "dex") {
    const armored = livingTargets(state).find((t) => t.layers > 0 && t.armor > 0 && !lastLocked(state, t));
    if (fluxActive(state) || !armored) state.parityLock = Math.max(state.parityLock, 1);
    if (armored) stripArmor(state, armored, 5);
    const text = armored
      ? fluxActive(state)
        ? "Backdoor. Parity dropped and 5 armor stripped."
        : "Backdoor. 5 armor stripped."
      : "Backdoor. Parity restriction lifted for one turn.";
    state.events.push({ type: "ability", id: "dex", text });
    return true;
  }
  if (ally === "rosa") {
    state.turnsLeft += 2;
    state.events.push({ type: "ability", id: "rosa", text: "Triage. Stability pool +2 turns." });
    return true;
  }
  if (ally === "nadia") {
    state.forecast = 3;
    state.events.push({ type: "ability", id: "nadia", text: "Cipher Read. The next three turns are on the glass." });
    return true;
  }
  if (ally === "hale") {
    if (state.turnsUsed > 0) {
      state.used.hale = false;
      return false;
    }
    state.hand = [];
    refill(state);
    state.events.push({ type: "ability", id: "hale", text: "Briefing. Opening hand redrawn." });
    return true;
  }
  if (ally === "crane") {
    state.nextMult *= 1.5;
    state.events.push({ type: "ability", id: "crane", text: "Last Stand. Next pulse ×1.5." });
    return true;
  }
  if (ally === "julia") {
    state.negate = 1;
    state.parityLock = Math.max(state.parityLock, 1);
    if (state.stage.bossType === "countdown" || (state.stage.bossType === "mix" && state.mixPhase === "countdown")) {
      state.turnsLeft += 1;
      if (state.mixClock != null) state.mixClock += 1;
    }
    if (state.stage.rootRequired) {
      const onLast = state.targets.some((t) => t.layers === 1);
      if (onLast) {
        state.rootStripped = true;
        for (const t of state.targets) {
          t.layers = 0;
          t.armor = 0;
        }
        state.events.push({ type: "banner", text: "ROOT ACCESS · ARMOR DOWN" });
      }
    }
    state.events.push({
      type: "ability",
      id: "julia",
      text: state.rootStripped
        ? "Root Access. Final armor stripped. Finish it."
        : "Root Access. Boss gimmick is dark for one turn.",
    });
    return true;
  }
  state.used[ally] = false;
  return false;
}

export function activateOverload(state: GameState, mode: "x2" | "scrub", at?: { r: number; c: number }): boolean {
  if (state.status !== "play" || !state.overloadReady) return false;
  if (mode === "scrub") {
    if (!at || !inside(state, at.r, at.c) || !state.cells[at.r][at.c].tile) return false;
  }
  state.events = [];
  state.overloadReady = false;
  state.gauge = 0;
  if (mode === "x2") {
    state.nextMult *= 2;
    state.events.push({ type: "overload", mode: "x2" });
    state.events.push({ type: "banner", text: "SYSTEM OVERLOAD · PULSE ×2" });
    return true;
  }
  state.cells[at!.r][at!.c].tile = null;
  purgeOrphans(state);
  state.events.push({ type: "overload", mode: "scrub" });
  state.events.push({ type: "banner", text: "MANUAL SCRUB" });
  return true;
}

export function resolveStuck(state: GameState): boolean {
  if (state.status !== "play") return false;
  if (legalCells(state).length > 0 && (state.turnsLeft > 0 || state.bufferFree > 0)) return false;
  state.events = [];
  if (state.overloadReady) {
    const spot = weakestTile(state);
    if (spot) activateOverload(state, "scrub", spot);
  }
  if (legalCells(state).length === 0 && state.allies.includes("tank") && !state.used.tank) {
    const spot = weakestTile(state);
    if (spot) useAbility(state, "tank", spot);
  }
  if ((legalCells(state).length === 0 || state.turnsLeft <= 0) && state.shieldOn && !state.shieldBroken) {
    triggerShield(state);
    refill(state);
  }
  if (legalCells(state).length === 0 || (state.turnsLeft <= 0 && state.bufferFree <= 0)) {
    state.status = "lose";
    state.loseReason = legalCells(state).length === 0 ? "gridlock" : "timeout";
    state.events.push({ type: "lose", reason: state.loseReason });
    return false;
  }
  return true;
}

export interface MoveEval {
  handIndex: number;
  r: number;
  c: number;
  damage: number;
  score: number;
}

export function evaluateMove(state: GameState, handIndex: number, r: number, c: number): MoveEval {
  const tile = state.hand[handIndex];
  const net = collectNetwork(state, r, c, tile);
  const pulse = computePulse(net, pulseOpts(state));
  const victims = targetsTouching(state, net);
  let immediate = 0;
  let kills = 0;
  for (const t of victims) {
    const need = toughness(state, t);
    if (!Number.isFinite(need)) continue;
    const hit = Math.min(pulse.damage, need);
    immediate += hit;
    const locked = state.stage.rootRequired && !state.rootStripped && t.layers > 0;
    if (!locked && pulse.damage >= need && need > 0) kills++;
  }
  const R = Math.max(0, state.turnsLeft - (state.bufferFree > 0 ? 0 : 1));
  const avg = state.stage.pool.maxValue * 0.72;
  const fluxing = fluxActive(state) && state.parityLock <= 0 && state.negate <= 0;
  const future =
    pulse.mult *
    (pulse.storedSum * R + (avg * R * (R + 1)) / 2) *
    0.2 *
    (fluxing ? 0.62 : 1) *
    Math.max(1, victims.length);
  let score = immediate + future + victims.length * 6;
  if (kills) score += 400 * kills;
  if (kills > 0 && kills === livingTargets(state).length) score += 100000;
  if (tile.kind === "mult" && pulse.storedSum <= 0) score -= 300;
  if (pulse.nulled) score = future * 0.5 + pulse.storedSum;
  if (state.turnsLeft <= 2) score = immediate * 4 + kills * 800 + (kills === livingTargets(state).length ? 100000 : 0);
  return { handIndex, r, c, damage: pulse.damage, score };
}

export function rankMoves(state: GameState): MoveEval[] {
  const cells = legalCells(state);
  const seen = new Set<string>();
  const moves: MoveEval[] = [];
  for (let i = 0; i < state.hand.length; i++) {
    const t = state.hand[i];
    const sig = `${t.kind}:${t.value}:${t.crit ? 1 : 0}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    for (const [r, c] of cells) moves.push(evaluateMove(state, i, r, c));
  }
  moves.sort((a, b) => b.score - a.score);
  return moves;
}

export function autoBuffs(state: GameState): void {
  if (state.status !== "play" || state.stage.alliesBanned) {
    maybeOverload(state);
    return;
  }
  if (state.allies.includes("hale") && !state.used.hale && state.turnsUsed === 0 && badHand(state)) {
    useAbility(state, "hale");
  }
  if (state.allies.includes("rosa") && !state.used.rosa) useAbility(state, "rosa");
  const boardHasMult = state.cells.some((row) => row.some((cell) => cell.tile?.kind === "mult"));
  const handHasMult = state.hand.some((t) => t.kind === "mult");
  if (state.allies.includes("eli") && !state.used.eli && !boardHasMult && !handHasMult) useAbility(state, "eli");
  if (state.refreshLeft > 0 && badHand(state)) {
    state.refreshLeft = 0;
    state.hand = [];
    refill(state);
    state.events.push({ type: "banner", text: "HAND REFRESH" });
  }
  const sum = storedBoardSum(state);
  const short = state.stage.turns <= 8;
  const ready = sum >= (short ? 8 : 18) || state.turnsLeft <= 2;
  if (state.stage.rootRequired && !state.rootStripped && state.allies.includes("julia") && !state.used.julia) {
    if (state.targets.some((t) => t.layers === 1)) useAbility(state, "julia");
  }
  if (
    state.allies.includes("julia") &&
    !state.used.julia &&
    (state.stage.bossType === "countdown" || (state.stage.bossType === "mix" && state.mixPhase === "countdown")) &&
    state.turnsLeft <= 2
  ) {
    useAbility(state, "julia");
  }
  if (state.allies.includes("dex") && !state.used.dex) {
    const armored = state.targets.some((t) => armorActive(state, t) && !lastLocked(state, t) && t.armor > 0);
    const wrong =
      fluxActive(state) &&
      state.hand.filter((t) => t.kind === "value").every((t) => (t.value % 2 === 1) !== (state.parity === "odd"));
    if (armored || wrong) useAbility(state, "dex");
  }
  if (state.allies.includes("mira") && !state.used.mira) {
    const weak = livingTargets(state).some((t) => toughness(state, t) <= 6);
    if (weak) useAbility(state, "mira");
  }
  if (state.allies.includes("nadia") && !state.used.nadia && (fluxActive(state) || mitosisActive(state) || state.stage.boss)) {
    useAbility(state, "nadia");
  }
  if (ready && state.allies.includes("crane") && !state.used.crane && state.stage.episode >= 18 && state.stage.episode <= 23) {
    useAbility(state, "crane");
  }
  if (legalCells(state).length <= 2 && state.allies.includes("tank") && !state.used.tank) {
    const spot = weakestTile(state);
    if (spot) useAbility(state, "tank", spot);
  }
  maybeOverload(state);
}

function maybeOverload(state: GameState): void {
  if (!state.overloadReady || state.status !== "play") return;
  if (legalCells(state).length <= 1) {
    const spot = weakestTile(state);
    if (spot) activateOverload(state, "scrub", spot);
    return;
  }
  const sum = storedBoardSum(state);
  const short = state.stage.turns <= 8;
  if (sum >= (short ? 8 : 18) || state.turnsLeft <= 2) activateOverload(state, "x2");
}

function storedBoardSum(state: GameState): number {
  let sum = 0;
  let any = false;
  for (const row of state.cells) {
    for (const cell of row) {
      if (!cell.tile || cell.tile.kind !== "value") continue;
      any = true;
      sum += cell.tile.value * (cell.tile.crit ? 2 : 1);
    }
  }
  return any ? sum : 0;
}

export function forecastLines(state: GameState): string[] {
  if (state.forecast <= 0 && !state.used.nadia) return [];
  const lines: string[] = [];
  const flux = fluxActive(state);
  let parity = state.parity;
  let lock = state.parityLock;
  let negate = state.negate;
  const n = Math.max(state.forecast, state.used.nadia ? 3 : 0);
  for (let i = 0; i < Math.min(3, n); i++) {
    const open = flux && (negate > 0 || lock > 0);
    lines.push(open ? `+${i + 1}: BOTH values land` : `+${i + 1}: ${parity.toUpperCase()} values land`);
    if (lock > 0) lock -= 1;
    if (negate > 0) negate -= 1;
    parity = parity === "odd" ? "even" : "odd";
  }
  for (const t of state.targets) {
    if (!t.splitDone && !t.branch && t.hp <= t.maxHp * 0.65 && t.hp > t.maxHp * 0.5) {
      lines.push("Split incoming under 50% HP.");
    }
  }
  if (state.mixPhase !== "none") lines.push(`Phase now: ${state.mixPhase}`);
  return lines;
}

export function rateStars(turnsLeft: number, turnLimit: number): 1 | 2 | 3 {
  if (turnLimit <= 0) return 1;
  const ratio = Math.max(0, turnsLeft) / turnLimit;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.15) return 2;
  return 1;
}

export function networkSum(state: GameState): number {
  return storedBoardSum(state);
}


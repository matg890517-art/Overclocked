export type BossType = "aegis" | "bio" | "mitosis" | "countdown" | "flux" | "mix" | "none";

export type MixPhase = "aegis" | "bio" | "flux" | "mitosis" | "countdown" | "none";

export type ModId =
  | "critical"
  | "shield"
  | "laser"
  | "echo"
  | "recycler"
  | "corner"
  | "fusion"
  | "refresh"
  | "chain"
  | "harmonic"
  | "buffer"
  | "defrag"
  | "arc"
  | "corrosive"
  | "scrappy";

export interface Tile {
  id: number;
  kind: "value" | "mult";
  value: number;
  crit: boolean;
}

export interface Target {
  id: number;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  armor: number;
  armorMax: number;
  layers: number;
  layersMax: number;
  splitDone: boolean;
  branch: boolean;
}

export interface Cell {
  blocked: boolean;
  tile: Tile | null;
  targetId: number | null;
  corner: boolean;
  checker: boolean;
}

export interface Pool {
  maxValue: number;
  multChance: number;
  hasX3: boolean;
}

export interface StageDef {
  id: string;
  episode: number;
  stage: number;
  boss: boolean;
  rows: number;
  cols: number;
  blocked: [number, number][];
  checker: boolean;
  boardLabel: string;
  targetCount: number;
  hp: number;
  turns: number;
  pool: Pool;
  modifiers: ModId[];
  shield: boolean;
  bossType: BossType;
  bossName: string;
  armorLayers: number;
  armorEach: number;
  regen: number;
  minPulse: number;
  flood: boolean;
  rootRequired: boolean;
  alliesBanned: boolean;
  gimmick: string;
  tutorial: string | null;
  episodeTitle: string;
  location: string;
  act: string;
  tuned: boolean;
}

export type GameEvent =
  | { type: "pulse"; damage: number; r: number; c: number; nulled: boolean }
  | { type: "hit"; damage: number; r: number; c: number; armor: boolean }
  | { type: "kill"; r: number; c: number }
  | { type: "banner"; text: string }
  | { type: "shield"; bonus: number }
  | { type: "regen"; amount: number; r: number; c: number }
  | { type: "split" }
  | { type: "flood" }
  | { type: "fusion"; value: number }
  | { type: "laser"; damage: number }
  | { type: "win" }
  | { type: "lose"; reason: string }
  | { type: "ability"; id: string; text: string }
  | { type: "overload"; mode: string }
  | { type: "purge"; count: number };

export interface GameState {
  stage: StageDef;
  cells: Cell[][];
  targets: Target[];
  hand: Tile[];
  rng: number;
  nextId: number;
  turnsLeft: number;
  turnsUsed: number;
  gauge: number;
  peakGauge: number;
  overloadReady: boolean;
  nextMult: number;
  shieldOn: boolean;
  shieldBroken: boolean;
  allies: string[];
  used: Record<string, boolean>;
  parity: "odd" | "even";
  parityLock: number;
  negate: number;
  rootStripped: boolean;
  mixPhase: MixPhase;
  mixClock: number | null;
  fusionLeft: number;
  refreshLeft: number;
  bufferFree: number;
  forecast: number;
  status: "play" | "win" | "lose";
  loseReason: string;
  overkill: number;
  maxPulse: number;
  lastPulse: number;
  tilesPlaced: number;
  clears: number;
  multiClears: number;
  events: GameEvent[];
  openCells: number;
}

export interface PulseTile {
  kind: "value" | "mult";
  value: number;
  crit: boolean;
  row: number;
  col: number;
  corner: boolean;
}

export interface PulseCalc {
  damage: number;
  activeSum: number;
  storedSum: number;
  mult: number;
  nulled: boolean;
}

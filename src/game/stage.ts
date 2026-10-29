import bible from "../data/bible.json";
import fixesJson from "../data/fixes.json";
import type { BossType, ModId, StageDef } from "./types";
import { tutorialFor } from "./allies";

export interface StageFix {
  hp?: number;
  turns?: number;
}

const FIXES: Record<string, StageFix> = { ...(fixesJson as Record<string, StageFix>) };

export function setFixes(next: Record<string, StageFix>): void {
  for (const key of Object.keys(FIXES)) delete FIXES[key];
  Object.assign(FIXES, next);
}

const MOD_BY_EP: (ModId | null)[] = [
  null,
  "critical",
  "shield",
  "laser",
  "echo",
  "recycler",
  "corner",
  "fusion",
  "refresh",
  "chain",
  "harmonic",
  "buffer",
  "defrag",
  "arc",
  "corrosive",
  "scrappy",
];

export const MOD_INFO: Record<ModId, { name: string; cat: "Amplifier" | "Cleaner" | "Stabilizer"; blurb: string }> = {
  critical: {
    name: "Critical Node",
    cat: "Amplifier",
    blurb: "A value tile placed beside a target deals double for the rest of the stage.",
  },
  shield: {
    name: "Overclock Shield",
    cat: "Stabilizer",
    blurb: "Once per stage, if the sector would collapse, gain extra turns and scrub the weakest tiles.",
  },
  laser: {
    name: "Laser Wipe",
    cat: "Cleaner",
    blurb: "When every open cell in a row or column of length 3+ is filled, that line fires and clears.",
  },
  echo: {
    name: "Echo Resonance",
    cat: "Amplifier",
    blurb: "Every 4th pulse echoes for 50% extra damage.",
  },
  recycler: {
    name: "Purge Recycler",
    cat: "Cleaner",
    blurb: "The strongest value tile removed as an orphan returns to your hand.",
  },
  corner: {
    name: "Corner Overclock",
    cat: "Amplifier",
    blurb: "Tiles on corner cells — two or fewer open neighbors — contribute 50% more.",
  },
  fusion: {
    name: "Fusion Reactor",
    cat: "Cleaner",
    blurb: "A 2×2 of value tiles fuses into one heavy node worth 75% of the open-cell count. Limited charges.",
  },
  refresh: {
    name: "Hand Refresh",
    cat: "Stabilizer",
    blurb: "Once per stage, discard your hand and draw three new tiles.",
  },
  chain: {
    name: "Chain React",
    cat: "Amplifier",
    blurb: "When a target blows, every survivor takes 25% of that pulse.",
  },
  harmonic: {
    name: "Harmonic Match",
    cat: "Amplifier",
    blurb: "Two equal values sitting side by side both count double.",
  },
  buffer: {
    name: "Data Buffer",
    cat: "Stabilizer",
    blurb: "Your first placement this stage does not spend a turn.",
  },
  defrag: {
    name: "Defrag Sweep",
    cat: "Cleaner",
    blurb: "Every five turns, up to two tiles that are not touching a target are swept away.",
  },
  arc: {
    name: "Overload Arc",
    cat: "Amplifier",
    blurb: "While the Overclock gauge is at least 50%, pulses deal 25% more.",
  },
  corrosive: {
    name: "Corrosive Touch",
    cat: "Cleaner",
    blurb: "The tile you place also chips 2 HP off every target it touches.",
  },
  scrappy: {
    name: "Scrappy Draw",
    cat: "Stabilizer",
    blurb: "At 75% full, your next tile is maximum value and the weakest node is dumped.",
  },
};

const LOGLINES = [
  "HALO into a Murmansk bunker and pull Julia Reyes out before HELIX seals the doors.",
  "The bird goes down on the ice. A sniper walks out of the white. The orders say: Cole, alive.",
  "An Oslo safehouse, a colonel named Hale, and a leak that rode a Pentagon channel.",
  "Three bombs under Prague at midnight. The third one was never the point.",
  "A masked waltz, a parity key, and a rifleman wearing Steven's old unit crest.",
  "Mira is bleeding out under the bazaar. Julia takes the Rig. Danny Cole is on the list.",
  "Thirty engineers first. Then burn the uplink. A silver-haired man mentions Geneva.",
  "The skull mask comes off. Silas Crane takes Julia. Act I ends on a ship's wake.",
  "Hale writes her off as a lost asset. Steven tears the patch. The lullaby is half a key.",
  "Julia opens a channel from her cell. Kane wants HELIX to govern the world.",
  "Burn Kane's fortune without burning the pensions. A line item named Harrow gets skipped.",
  "Jakarta's water turns to poison. The formula costs Julia her cover.",
  "A temple full of the first servers. The kill switch was never in the machine.",
  "The contact is a trap. The leak is signed with Hale's own clearance.",
  "One night in Venice. A tracker under her skin. She walks back into the fog.",
  "The coin stops spinning. Hale was Prometheus. Eli pays the bill.",
  "A chair, a screen, and a song through split lips. End of Act II.",
  "The wall comes in with the snow. Crane lowers the gun and opens the door.",
  "A second cursor blooms on the Rig. Julia is inside the wire, and she can still fight.",
  "Hale on the Senate floor. Steven chooses cuffs over a bullet.",
  "A Soviet silo wakes up. Every second Julia buys costs her a memory.",
  "Nadia walks into her old house alone. The coordinates are a rig in the North Sea.",
  "All hands on a drowning platform. Crane holds the elevator and stays behind.",
  "Victor Kane, half flesh and half code, in a cathedral of servers.",
  "Steven overclocks into HELIX, sings the rest of the song, and finds her at dawn.",
];

interface Shape {
  rows: number;
  cols: number;
  blocked: [number, number][];
  checker: boolean;
  label: string;
}

function corners(n: number, k: number): [number, number][] {
  const b: [number, number][] = [];
  for (let r = 0; r < k; r++) {
    for (let c = 0; c < k; c++) {
      b.push([r, c], [r, n - 1 - c], [n - 1 - r, c], [n - 1 - r, n - 1 - c]);
    }
  }
  const uniq = new Map<string, [number, number]>();
  for (const [r, c] of b) uniq.set(`${r},${c}`, [r, c]);
  return [...uniq.values()];
}

function lShape(n: number, k: number): Shape {
  const blocked: [number, number][] = [];
  for (let r = 0; r < k; r++) for (let c = n - k; c < n; c++) blocked.push([r, c]);
  return { rows: n, cols: n, blocked, checker: false, label: `${n}×${n} L-CUT` };
}

function normalShape(e: number, s: number): Shape {
  const lvl = e + (s <= 2 && e > 1 ? -1 : 0) + (s === 7 ? 1 : 0);
  if (lvl <= 2) return { rows: 4, cols: 4, blocked: [], checker: false, label: "4×4 OPEN" };
  if (lvl <= 4) {
    if (s % 2) return { rows: 4, cols: 4, blocked: [[1, 1]], checker: false, label: "4×4 BLOCK" };
    return { rows: 4, cols: 4, blocked: [[1, 2], [2, 1]], checker: false, label: "4×4 TWIN BLOCK" };
  }
  if (lvl <= 7) {
    if (s < 5) return { rows: 5, cols: 5, blocked: [], checker: false, label: "5×5 OPEN" };
    return { rows: 5, cols: 5, blocked: [[2, 2]], checker: false, label: "5×5 CORE BLOCK" };
  }
  if (lvl <= 12) {
    const i = s % 3;
    if (i === 0) return lShape(5, 2);
    if (i === 1) return { rows: 5, cols: 5, blocked: [[1, 1], [3, 3]], checker: false, label: "5×5 DIAGONAL" };
    return { rows: 5, cols: 5, blocked: corners(5, 1), checker: false, label: "5×5 CROSS" };
  }
  if (lvl <= 18) {
    const i = s % 3;
    if (i === 0) return { rows: 6, cols: 6, blocked: [[2, 2], [3, 3]], checker: false, label: "6×6 DIAGONAL" };
    if (i === 1) return lShape(6, 3);
    return { rows: 6, cols: 6, blocked: corners(6, 2), checker: false, label: "6×6 CROSS" };
  }
  const i = s % 3;
  if (i === 0) {
    return { rows: 6, cols: 6, blocked: [[1, 4], [2, 2], [3, 3], [4, 1]], checker: false, label: "6×6 SCATTER" };
  }
  if (i === 1) {
    return { rows: 6, cols: 6, blocked: [...corners(6, 2), [2, 2]], checker: false, label: "6×6 HOLLOW CROSS" };
  }
  const blocked: [number, number][] = [];
  for (let r = 0; r < 3; r++) for (let c = 4; c < 7; c++) blocked.push([r, c]);
  return { rows: 6, cols: 7, blocked, checker: false, label: "7×6 L-CUT" };
}

function bossShape(ep: number, type: BossType): Shape {
  if (type === "aegis") return { rows: 5, cols: 5, blocked: corners(5, 1), checker: false, label: "5×5 AEGIS CROSS" };
  if (type === "bio") {
    if (ep <= 12) return { rows: 5, cols: 5, blocked: [[2, 2]], checker: false, label: "5×5 RING" };
    return { rows: 6, cols: 6, blocked: [[2, 2], [2, 3], [3, 2], [3, 3]], checker: false, label: "6×6 RING" };
  }
  if (type === "mitosis") {
    if (ep < 16) return { rows: 4, cols: 6, blocked: [], checker: false, label: "6×4 WIDE" };
    return { rows: 5, cols: 7, blocked: [], checker: false, label: "7×5 WIDE" };
  }
  if (type === "countdown") {
    if (ep === 21) return { rows: 5, cols: 5, blocked: [], checker: false, label: "5×5 COUNTDOWN" };
    return { rows: 4, cols: 4, blocked: [], checker: false, label: "4×4 COUNTDOWN" };
  }
  if (type === "flux") {
    const n = ep >= 14 ? 6 : 5;
    return { rows: n, cols: n, blocked: [], checker: true, label: `${n}×${n} CHECKER` };
  }
  return { rows: 7, cols: 7, blocked: [], checker: false, label: "7×7 CATHEDRAL" };
}

function poolOf(ep: number): StageDef["pool"] {
  const maxValue = ep >= 12 ? 6 : ep >= 6 ? 5 : 4;
  const multChance = ep < 2 ? 0 : ep < 10 ? 0.2 : 0.25;
  return { maxValue, multChance, hasX3: ep >= 10 };
}

function modsFor(ep: number, stage: number): ModId[] {
  if (ep >= 17) {
    const all = MOD_BY_EP.filter((m): m is ModId => !!m);
    const a = all[(ep * 3 + stage) % all.length];
    const b = all[(ep * 7 + stage * 3) % all.length];
    return a === b ? [a] : [a, b];
  }
  const m = MOD_BY_EP[ep - 1];
  if (!m) return [];
  if (stage === 2 || stage === 5) return [m];
  return [];
}

function shieldOn(ep: number, stage: number): boolean {
  if (ep > 3) return true;
  if (ep === 3 && stage >= 2) return true;
  return false;
}

function armorLayers(ep: number, type: BossType): number {
  if (type === "mix") return 1;
  if (type === "countdown" && ep === 21) return 1;
  if (type !== "aegis") return 0;
  if (ep === 7) return 2;
  if (ep === 11) return 3;
  if (ep >= 18) return 2;
  return 1;
}

function gimmickText(ep: number, type: BossType, layers: number, regen: number): string {
  if (ep === 25) return "Final armor only falls to Julia's Root Access. Strip it together.";
  if (ep === 15) return "Pulses under 15 are nullified. Armor eats everything else until it cracks.";
  if (ep === 17) return "No allies on this one. The node regenerates 6 HP every turn.";
  if (ep === 23) return "It regenerates 4 HP a turn, and the sea floods one empty cell every turn.";
  if (ep === 21) return "Five-turn countdown, plus one armor layer on the launch core.";
  if (ep === 22) return "Two branch cores. Only odd or even values hit, and the parity flips every turn.";
  if (type === "aegis") return `${layers} armor layer${layers > 1 ? "s" : ""}. The core takes nothing while armor remains.`;
  if (type === "bio") return `Regenerates ${regen} HP at the end of every turn. Burst it.`;
  if (type === "mitosis") return "At half HP the core splits and births a second node.";
  if (type === "countdown") return "Five turns on the clock. Clear it or the sector goes.";
  if (type === "flux") return "Only odd or even values register. Parity flips after every turn.";
  if (type === "mix") return "Kane cycles armor, regen, parity, a split, then a five-turn countdown.";
  return "";
}

function actOf(ep: number): string {
  if (ep <= 8) return "ACT I · RESCUE";
  if (ep <= 17) return "ACT II · INFORMANT";
  return "ACT III · REBOOT";
}

export function buildStage(episode: number, stage: number): StageDef {
  const row = bible.B[(episode - 1) * 8 + (stage - 1)];
  const ep = bible.eps[episode - 1];
  const boss = stage === 8;
  const type = (boss ? bible.bossT[episode - 1] : "none") as BossType;
  const shape = boss ? bossShape(episode, type) : normalShape(episode, stage);
  const id = `${episode}-${stage}`;
  const fix = FIXES[id] ?? {};
  let hp = fix.hp ?? row[1];
  let turns = fix.turns ?? row[2];
  if (boss && type === "countdown") turns = fix.turns ?? 5;
  const layers = boss ? armorLayers(episode, type) : 0;
  const regen = boss && type === "bio" ? (episode === 17 ? 6 : 4) : boss && type === "mix" ? 4 : 0;
  const targetCount = boss && episode === 22 ? 2 : row[0];
  return {
    id,
    episode,
    stage,
    boss,
    rows: shape.rows,
    cols: shape.cols,
    blocked: shape.blocked,
    checker: shape.checker,
    boardLabel: shape.label,
    targetCount,
    hp,
    turns,
    pool: poolOf(episode),
    modifiers: modsFor(episode, stage),
    shield: shieldOn(episode, stage),
    bossType: type,
    bossName: boss ? ep.boss : "",
    armorLayers: layers,
    armorEach: layers > 0 ? Math.max(1, Math.round(hp * 0.2)) : 0,
    regen,
    minPulse: episode === 15 && boss ? 15 : 0,
    flood: episode === 23 && boss,
    rootRequired: episode === 25 && boss,
    alliesBanned: episode === 17,
    gimmick: boss ? gimmickText(episode, type, layers, regen) : "",
    tutorial: tutorialFor(episode, stage),
    episodeTitle: ep.title,
    location: ep.loc,
    act: actOf(episode),
    tuned: Boolean(fix.hp || fix.turns),
  };
}

export function buildAllStages(): StageDef[] {
  const stages: StageDef[] = [];
  for (let e = 1; e <= 25; e++) for (let s = 1; s <= 8; s++) stages.push(buildStage(e, s));
  return stages;
}

export function episodeMeta(episode: number) {
  const ep = bible.eps[episode - 1];
  return {
    n: episode,
    title: ep.title,
    location: ep.loc,
    logline: LOGLINES[episode - 1],
    boss: ep.boss,
    bossType: bible.bossT[episode - 1],
    act: actOf(episode),
    alliesNote: ep.allies,
  };
}

export function allEpisodes() {
  return Array.from({ length: 25 }, (_, i) => episodeMeta(i + 1));
}

export { LOGLINES };

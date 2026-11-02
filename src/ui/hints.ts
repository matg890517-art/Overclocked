import { ALLY_MAP } from "../game/allies";
import { networkSum, rankMoves } from "../game/engine";
import type { GameState } from "../game/types";

export interface Hint {
  speaker: string;
  color: string;
  text: string;
  key: string;
}

export function contextualHint(state: GameState, idleMs: number): Hint | null {
  if (state.status !== "play") return null;
  const ally = (id: string, text: string, key: string): Hint => {
    const def = ALLY_MAP[id];
    return { speaker: def?.name ?? "Steven", color: def?.color ?? "#39f3ff", text, key };
  };

  if (state.stage.rootRequired && !state.rootStripped && state.targets.some((t) => t.layers === 1)) {
    return ally("julia", "Only we can peel the last armor. Use Root Access, Steven.", "root");
  }
  if (state.turnsLeft <= 2) {
    return state.allies.includes("rosa") && !state.used.rosa
      ? ally("rosa", "Clock's almost dead. I can still buy you time — or make this pulse count.", "low")
      : { speaker: "Steven", color: "#39f3ff", text: "Almost out of turns. One chain, everything you've got.", key: "low" };
  }
  const armored = state.targets.some((t) => t.layers > 0 && t.armor > 0);
  if (armored && (idleMs > 7000 || state.tilesPlaced === 0)) {
    return state.allies.includes("dex")
      ? ally("dex", "Armor's eating the hit. Strip it or the core never feels a thing.", "armor")
      : { speaker: "Steven", color: "#39f3ff", text: "That shell has to crack before the core takes damage.", key: "armor" };
  }
  if (state.stage.bossType === "flux" || (state.stage.bossType === "mix" && state.mixPhase === "flux")) {
    const values = state.hand.filter((t) => t.kind === "value");
    const wrong = values.length > 0 && values.every((t) => (t.value % 2 === 1) !== (state.parity === "odd"));
    if (wrong) {
      return ally(
        state.allies.includes("nadia") ? "nadia" : "dex",
        `Parity is ${state.parity}. Those values will hit for zero this turn.`,
        "parity",
      );
    }
  }
  if ((state.stage.bossType === "bio" || (state.stage.bossType === "mix" && state.mixPhase === "bio")) && idleMs > 6000) {
    return { speaker: "Steven", color: "#ff5a7a", text: "It grows back every turn. Build the chain, then hit it harder than it heals.", key: "regen" };
  }
  if (state.stage.bossType === "countdown" || state.mixClock != null) {
    if (state.turnsLeft <= 4 && idleMs > 4000) {
      return { speaker: "Steven", color: "#ffc14d", text: "The timer is the whole fight. Don't spend a turn on a tiny pulse.", key: "timer" };
    }
  }
  const best = rankMoves(state)[0];
  if (best && state.hand[best.handIndex]?.kind === "mult" && networkSum(state) >= 6) {
    const who = state.allies.includes("eli") ? "eli" : "julia";
    if (ALLY_MAP[who]) return ally(who, "Try the ×2 next to the target, Steven!", "mult");
    return { speaker: "Steven", color: "#ffc14d", text: "Try the ×2 next to the target. The whole chain will feel it.", key: "mult" };
  }
  if (idleMs > 12000) {
    const tips = [
      "Grow one connected chain. Every tile already down fires again.",
      "Orthogonal only. Diagonals don't link the network.",
      "A multiplier with no values behind it is a wasted turn.",
      "Clear a node and anything no longer touching a target gets purged.",
    ];
    const text = tips[state.turnsUsed % tips.length];
    return { speaker: "Steven", color: "#39f3ff", text, key: "idle" + (state.turnsUsed % tips.length) };
  }
  return null;
}

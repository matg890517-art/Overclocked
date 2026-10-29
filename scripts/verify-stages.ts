import { writeFileSync } from "node:fs";
import { solverSquad } from "../src/game/allies";
import { solveStage } from "../src/game/solver";
import { buildAllStages, buildStage, setFixes } from "../src/game/stage";
import type { StageFix } from "../src/game/stage";

const fixes: Record<string, StageFix> = {};

function tune(id: string, episode: number, stage: number): void {
  const current = buildStage(episode, stage);
  const hp = Math.max(8, Math.round(current.hp * 0.85));
  if (current.bossType === "countdown") {
    fixes[id] = { hp };
    return;
  }
  fixes[id] = { hp, turns: Math.min(48, current.turns + 2) };
}

async function main() {
  const started = Date.now();
  let pending = buildAllStages();
  const failedNotes: string[] = [];

  for (let pass = 0; pass < 4; pass++) {
    setFixes(fixes);
    writeFileSync("src/data/fixes.json", JSON.stringify(fixes, null, 2) + "\n");
    pending = (pass === 0 ? buildAllStages() : pending.map((s) => buildStage(s.episode, s.stage))).filter((stage) => {
      const allies = solverSquad(stage.episode, stage.stage);
      const res = solveStage(stage, allies, pass === 0 ? 10 : 8);
      if (res.win) {
        console.log(`OK  ${stage.id.padEnd(5)} seed ${String(res.seed).padStart(2)}  turns ${res.turnsUsed}/${stage.turns}  hp ${stage.hp}`);
        return false;
      }
      console.log(`FAIL ${stage.id.padEnd(5)} hpLeft ${res.hpLeft}  cap ${stage.turns}  boss ${stage.bossType}`);
      return true;
    });
    if (!pending.length) break;
    for (const stage of pending) tune(stage.id, stage.episode, stage.stage);
    console.log(`-- retune pass ${pass + 1}: ${pending.map((s) => s.id).join(", ")}`);
  }

  setFixes(fixes);
  writeFileSync("src/data/fixes.json", JSON.stringify(fixes, null, 2) + "\n");
  const finalStages = buildAllStages();
  const still: string[] = [];
  for (const stage of finalStages) {
    if (!fixes[stage.id]) continue;
    const res = solveStage(stage, solverSquad(stage.episode, stage.stage), 12);
    if (!res.win) still.push(`${stage.id} (hp ${stage.hp}, turns ${stage.turns}, left ${res.hpLeft})`);
    else console.log(`TUNED OK ${stage.id} hp ${stage.hp} turns ${stage.turns}`);
  }

  const payload = finalStages.map((s) => ({
    id: s.id,
    episode: s.episode,
    stage: s.stage,
    boss: s.boss,
    rows: s.rows,
    cols: s.cols,
    blocked: s.blocked,
    board: s.boardLabel,
    targets: s.targetCount,
    hp: s.hp,
    turns: s.turns,
    pool: s.pool,
    modifiers: s.modifiers,
    shield: s.shield,
    bossType: s.bossType,
    bossName: s.bossName,
    armorLayers: s.armorLayers,
    armorEach: s.armorEach,
    regen: s.regen,
    minPulse: s.minPulse,
    flood: s.flood,
    rootRequired: s.rootRequired,
    gimmick: s.gimmick,
    tutorial: s.tutorial,
    tuned: s.tuned,
  }));
  writeFileSync("src/data/stages.json", JSON.stringify(payload));
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${finalStages.length} stages written to src/data/stages.json in ${seconds}s`);
  console.log(`fixes: ${Object.keys(fixes).length}`);
  if (still.length || pending.length) {
    console.error("STILL UNCLEARABLE:", still.length ? still.join("; ") : pending.map((s) => s.id).join(", "));
    process.exit(1);
  }
  if (failedNotes.length) console.log(failedNotes.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

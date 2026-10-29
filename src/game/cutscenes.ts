import bible from "../data/bible.json";

export interface Scene {
  cutId: string;
  panel: number;
  panels: number;
  caption: string;
  speaker: string;
  line: string;
  art: string;
}

function parseBeat(chunk: string): { speaker: string; line: string } {
  const raw = chunk.trim();
  if (!raw || raw === "—" || raw === "-") return { speaker: "", line: "" };
  const m = raw.match(/^([^:"]+):\s*(.*)$/);
  if (!m) return { speaker: "", line: raw.replace(/^"|"$/g, "") };
  let text = m[2].trim();
  if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
  return { speaker: m[1].trim(), line: text };
}

function build(visual: string, dialogue: string, cutId: string): Scene[] {
  const caps = visual.split(" / ").map((s) => s.trim()).filter(Boolean);
  const lines = dialogue.split(" / ").map((s) => s.trim()).filter(Boolean);
  const n = Math.max(caps.length, lines.length, 1);
  const scenes: Scene[] = [];
  for (let i = 0; i < n; i++) {
    const beat = lines[i] ? parseBeat(lines[i]) : { speaker: "", line: "" };
    scenes.push({
      cutId,
      panel: i + 1,
      panels: n,
      caption: caps[Math.min(i, Math.max(0, caps.length - 1))] ?? "",
      speaker: beat.speaker,
      line: beat.line,
      art: `assets/cutscenes/${cutId}-${i + 1}.jpg`,
    });
  }
  return scenes;
}

export function cutsceneId(episode: number, stage: number | "win"): string {
  const ee = String(episode).padStart(2, "0");
  if (stage === "win") return `e${ee}-win`;
  return `e${ee}-s${String(stage).padStart(2, "0")}`;
}

export function stageCutscene(episode: number, stage: number): Scene[] {
  const ep = bible.eps[episode - 1];
  const pair = ep.st[stage - 1];
  return build(pair[0], pair[1], cutsceneId(episode, stage));
}

export function winCutscene(episode: number): Scene[] {
  const ep = bible.eps[episode - 1];
  return build(ep.win[0], ep.win[1], cutsceneId(episode, "win"));
}

export function allCutsceneIds(): string[] {
  const ids: string[] = [];
  for (let e = 1; e <= 25; e++) {
    for (let s = 1; s <= 8; s++) ids.push(cutsceneId(e, s));
    ids.push(cutsceneId(e, "win"));
  }
  return ids;
}

export const ENDING_STANDARD: Scene[] = [
  {
    cutId: "ending-standard",
    panel: 1,
    panels: 2,
    caption: "Sunrise over the Shetland coast. Julia opens her eyes. The Rig is dark and quiet.",
    speaker: "Julia",
    line: "You came back for me. Again.",
    art: "assets/cutscenes/ending-standard-1.jpg",
  },
  {
    cutId: "ending-standard",
    panel: 2,
    panels: 2,
    caption: "A kiss against the white water. Caption: SYSTEM STABLE. Steven leaves the service. They leave together.",
    speaker: "Steven",
    line: "I told you I'd find you.",
    art: "assets/cutscenes/ending-standard-2.jpg",
  },
];

export const ENDING_TRUE: Scene[] = [
  {
    cutId: "ending-true",
    panel: 1,
    panels: 2,
    caption: "One year later. A beach town. The music box is open and a ring sits where the dancer was.",
    speaker: "Steven",
    line: "I don't have a mission anymore. I have a question.",
    art: "assets/cutscenes/ending-true-1.jpg",
  },
  {
    cutId: "ending-true",
    panel: 2,
    panels: 2,
    caption: "The squad on the sand. Danny's tags and Eli's tags hang side by side in the window. Caption: OVERCLOCKED HEARTS.",
    speaker: "Julia",
    line: "Ask it. I'm not going anywhere.",
    art: "assets/cutscenes/ending-true-2.jpg",
  },
];
